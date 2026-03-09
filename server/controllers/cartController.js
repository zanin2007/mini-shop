const db = require('../config/db');

/**
 * 장바구니 컨트롤러
 * - 조회: 상품 + 옵션 배치 쿼리
 * - 추가: 같은 상품+같은 옵션 조합이면 수량 증가, 아니면 새 아이템 추가
 * - 수량 변경/삭제/선택 토글/전체 선택
 */

// 장바구니 조회 — 배치 쿼리로 모든 아이템의 옵션을 한 번에 조회
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

    if (items.length > 0) {
      // 모든 장바구니 옵션을 한 번에 조회
      const cartIds = items.map(i => i.id);
      const placeholders = cartIds.map(() => '?').join(',');
      const [allOpts] = await db.execute(
        `SELECT cio.cart_item_id, cio.option_value_id, pov.value, pov.extra_price, pov.stock as option_stock, po.option_name
         FROM cart_item_options cio
         JOIN product_option_values pov ON cio.option_value_id = pov.id
         JOIN product_options po ON pov.option_id = po.id
         WHERE cio.cart_item_id IN (${placeholders})`,
        cartIds
      );
      const optsMap = new Map();
      for (const opt of allOpts) {
        if (!optsMap.has(opt.cart_item_id)) optsMap.set(opt.cart_item_id, []);
        optsMap.get(opt.cart_item_id).push(opt);
      }
      for (const item of items) {
        item.options = optsMap.get(item.id) || [];
      }
    }

    res.json(items);
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 장바구니에 상품 추가 (옵션 지원, 트랜잭션으로 동시 요청 직렬화)
exports.addToCart = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { productId, quantity, selectedOptions } = req.body;

    if (!Number.isInteger(quantity) || quantity < 1) {
      await connection.rollback();
      return res.status(400).json({ message: '수량은 1 이상의 정수여야 합니다.' });
    }

    // 상품 존재/활성 확인 + 재고 조회 (FOR UPDATE로 잠금)
    const [productCheck] = await connection.execute(
      'SELECT id, stock FROM products WHERE id = ? AND is_active = true FOR UPDATE',
      [productId]
    );
    if (productCheck.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: '상품을 찾을 수 없습니다.' });
    }

    // 기존 장바구니 아이템 조회 (FOR UPDATE)
    const [existing] = await connection.execute(
      'SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ? FOR UPDATE',
      [req.user.userId, productId]
    );

    // 배치로 기존 아이템의 옵션 조회
    const optsMap = new Map();
    if (existing.length > 0) {
      const cartIds = existing.map(c => c.id);
      const ph = cartIds.map(() => '?').join(',');
      const [allOpts] = await connection.execute(
        `SELECT cart_item_id, option_value_id FROM cart_item_options WHERE cart_item_id IN (${ph}) ORDER BY option_value_id`,
        cartIds
      );
      for (const opt of allOpts) {
        if (!optsMap.has(opt.cart_item_id)) optsMap.set(opt.cart_item_id, []);
        optsMap.get(opt.cart_item_id).push(opt.option_value_id);
      }
    }

    if (selectedOptions && selectedOptions.length > 0) {
      // 옵션 재고 확인 (FOR UPDATE)
      const valueIds = selectedOptions.map(o => o.valueId);
      const vPh = valueIds.map(() => '?').join(',');
      const [optionStocks] = await connection.execute(
        `SELECT id, stock FROM product_option_values WHERE id IN (${vPh}) FOR UPDATE`,
        valueIds
      );

      const newIds = selectedOptions.map(o => o.valueId).sort((a, b) => a - b);
      let matchedCartId = null;
      let matchedQuantity = 0;
      for (const cart of existing) {
        const existingIds = (optsMap.get(cart.id) || []).sort((a, b) => a - b);
        if (JSON.stringify(existingIds) === JSON.stringify(newIds)) {
          matchedCartId = cart.id;
          matchedQuantity = cart.quantity;
          break;
        }
      }

      // 기존 수량 + 추가 수량이 옵션 재고를 초과하는지 확인
      const newTotal = matchedQuantity + quantity;
      for (const opt of optionStocks) {
        if (opt.stock < newTotal) {
          await connection.rollback();
          return res.status(400).json({ message: `옵션 재고가 부족합니다. (재고: ${opt.stock}개, 장바구니: ${matchedQuantity}개)` });
        }
      }

      // 상품 재고도 확인
      if (productCheck[0].stock < newTotal) {
        await connection.rollback();
        return res.status(400).json({ message: '상품 재고가 부족합니다.' });
      }

      if (matchedCartId) {
        await connection.execute('UPDATE cart_items SET quantity = quantity + ? WHERE id = ?', [quantity, matchedCartId]);
      } else {
        const [result] = await connection.execute(
          'INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)',
          [req.user.userId, productId, quantity]
        );
        const cartItemId = result.insertId;
        if (selectedOptions.length > 0) {
          const optPh = selectedOptions.map(() => '(?, ?)').join(',');
          const optValues = selectedOptions.flatMap(o => [cartItemId, o.valueId]);
          await connection.execute(`INSERT INTO cart_item_options (cart_item_id, option_value_id) VALUES ${optPh}`, optValues);
        }
      }
    } else {
      // 옵션 없는 상품: 옵션이 없는 기존 아이템 찾기
      let matchedId = null;
      let matchedQuantity = 0;
      for (const cart of existing) {
        if (!optsMap.has(cart.id) || optsMap.get(cart.id).length === 0) {
          matchedId = cart.id;
          matchedQuantity = cart.quantity;
          break;
        }
      }

      // 상품 재고 확인
      const newTotal = matchedQuantity + quantity;
      if (productCheck[0].stock < newTotal) {
        await connection.rollback();
        return res.status(400).json({ message: `상품 재고가 부족합니다. (재고: ${productCheck[0].stock}개, 장바구니: ${matchedQuantity}개)` });
      }

      if (matchedId) {
        await connection.execute('UPDATE cart_items SET quantity = quantity + ? WHERE id = ?', [quantity, matchedId]);
      } else {
        await connection.execute(
          'INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)',
          [req.user.userId, productId, quantity]
        );
      }
    }

    await connection.commit();
    res.json({ message: '장바구니에 추가되었습니다.' });
  } catch (error) {
    await connection.rollback();
    console.error('Add to cart error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    connection.release();
  }
};

// 장바구니 수량 변경 (트랜잭션 + FOR UPDATE로 재고 동시성 보호)
exports.updateQuantity = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { quantity } = req.body;

    if (!Number.isInteger(quantity) || quantity < 1) {
      await connection.rollback();
      return res.status(400).json({ message: '수량은 1 이상의 정수여야 합니다.' });
    }

    // 상품 재고 확인 (FOR UPDATE)
    const [cartProduct] = await connection.execute(
      `SELECT p.stock FROM cart_items c JOIN products p ON c.product_id = p.id WHERE c.id = ? AND c.user_id = ? FOR UPDATE`,
      [id, req.user.userId]
    );
    if (cartProduct.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: '장바구니 상품을 찾을 수 없습니다.' });
    }
    if (cartProduct[0].stock < quantity) {
      await connection.rollback();
      return res.status(400).json({ message: '상품 재고가 부족합니다.' });
    }

    // 옵션 재고 확인 (FOR UPDATE)
    const [cartOpts] = await connection.execute(
      `SELECT pov.id, pov.stock FROM cart_item_options cio
       JOIN product_option_values pov ON cio.option_value_id = pov.id
       WHERE cio.cart_item_id = ? FOR UPDATE`,
      [id]
    );
    for (const opt of cartOpts) {
      if (opt.stock < quantity) {
        await connection.rollback();
        return res.status(400).json({ message: '옵션 재고가 부족합니다.' });
      }
    }

    await connection.execute(
      'UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?',
      [quantity, id, req.user.userId]
    );

    await connection.commit();
    res.json({ message: '수량이 변경되었습니다.' });
  } catch (error) {
    await connection.rollback();
    console.error('Update quantity error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    connection.release();
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
