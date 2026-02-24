const db = require('../config/db');

// 장바구니 조회 (옵션 포함)
exports.getCart = async (req, res) => {
  try {
    const [items] = await db.execute(
      `SELECT c.id, c.quantity, c.product_id, c.is_selected,
              p.name, p.price, p.image_url, p.stock
       FROM cart_items c
       JOIN products p ON c.product_id = p.id
       WHERE c.user_id = ?`,
      [req.user.userId]
    );

    // 각 장바구니 아이템의 선택된 옵션 조회
    for (const item of items) {
      const [options] = await db.execute(
        `SELECT cio.option_value_id, pov.value, pov.extra_price, po.option_name
         FROM cart_item_options cio
         JOIN product_option_values pov ON cio.option_value_id = pov.id
         JOIN product_options po ON pov.option_id = po.id
         WHERE cio.cart_item_id = ?`,
        [item.id]
      );
      item.options = options;
    }

    res.json(items);
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 장바구니에 상품 추가 (옵션 지원)
exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity, selectedOptions } = req.body;

    // 옵션이 있으면 같은 상품+같은 옵션 조합인지 확인
    if (selectedOptions && selectedOptions.length > 0) {
      const [existing] = await db.execute(
        'SELECT c.id FROM cart_items c WHERE c.user_id = ? AND c.product_id = ?',
        [req.user.userId, productId]
      );

      // 기존 아이템 중 같은 옵션 조합이 있는지 확인
      let matchedCartId = null;
      for (const cart of existing) {
        const [cartOpts] = await db.execute(
          'SELECT option_value_id FROM cart_item_options WHERE cart_item_id = ? ORDER BY option_value_id',
          [cart.id]
        );
        const existingIds = cartOpts.map(o => o.option_value_id).sort((a, b) => a - b);
        const newIds = selectedOptions.map(o => o.valueId).sort((a, b) => a - b);
        if (JSON.stringify(existingIds) === JSON.stringify(newIds)) {
          matchedCartId = cart.id;
          break;
        }
      }

      if (matchedCartId) {
        await db.execute('UPDATE cart_items SET quantity = quantity + ? WHERE id = ?', [quantity, matchedCartId]);
      } else {
        const [result] = await db.execute(
          'INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)',
          [req.user.userId, productId, quantity]
        );
        const cartItemId = result.insertId;
        for (const opt of selectedOptions) {
          await db.execute(
            'INSERT INTO cart_item_options (cart_item_id, option_value_id) VALUES (?, ?)',
            [cartItemId, opt.valueId]
          );
        }
      }
    } else {
      // 옵션 없는 상품: 기존 로직
      const [existing] = await db.execute(
        'SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?',
        [req.user.userId, productId]
      );

      // 옵션 없는 기존 아이템만 매칭
      let matchedId = null;
      for (const cart of existing) {
        const [cartOpts] = await db.execute(
          'SELECT id FROM cart_item_options WHERE cart_item_id = ?',
          [cart.id]
        );
        if (cartOpts.length === 0) {
          matchedId = cart.id;
          break;
        }
      }

      if (matchedId) {
        await db.execute('UPDATE cart_items SET quantity = quantity + ? WHERE id = ?', [quantity, matchedId]);
      } else {
        await db.execute(
          'INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)',
          [req.user.userId, productId, quantity]
        );
      }
    }

    res.json({ message: '장바구니에 추가되었습니다.' });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 장바구니 수량 변경
exports.updateQuantity = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    await db.execute(
      'UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?',
      [quantity, id, req.user.userId]
    );

    res.json({ message: '수량이 변경되었습니다.' });
  } catch (error) {
    console.error('Update quantity error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 장바구니 상품 삭제
exports.removeFromCart = async (req, res) => {
  try {
    const { id } = req.params;

    await db.execute(
      'DELETE FROM cart_items WHERE id = ? AND user_id = ?',
      [id, req.user.userId]
    );

    res.json({ message: '상품이 삭제되었습니다.' });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 장바구니 아이템 선택/해제 토글
exports.toggleSelect = async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute(
      'UPDATE cart_items SET is_selected = NOT is_selected WHERE id = ? AND user_id = ?',
      [id, req.user.userId]
    );
    res.json({ message: '선택 상태가 변경되었습니다.' });
  } catch (error) {
    console.error('Toggle select error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 장바구니 전체 선택/해제
exports.toggleSelectAll = async (req, res) => {
  try {
    const { is_selected } = req.body;
    await db.execute(
      'UPDATE cart_items SET is_selected = ? WHERE user_id = ?',
      [is_selected, req.user.userId]
    );
    res.json({ message: '전체 선택 상태가 변경되었습니다.' });
  } catch (error) {
    console.error('Toggle select all error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};
