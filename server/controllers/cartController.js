const db = require('../config/db');

// 장바구니 조회
exports.getCart = async (req, res) => {
  try {
    const [items] = await db.execute(
      `SELECT c.id, c.quantity, c.product_id,
              p.name, p.price, p.image_url, p.stock
       FROM cart_items c
       JOIN products p ON c.product_id = p.id
       WHERE c.user_id = ?`,
      [req.user.userId]
    );
    res.json(items);
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 장바구니에 상품 추가
exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    // 이미 장바구니에 있는지 확인
    const [existing] = await db.execute(
      'SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?',
      [req.user.userId, productId]
    );

    if (existing.length > 0) {
      // 이미 있으면 수량 추가
      await db.execute(
        'UPDATE cart_items SET quantity = quantity + ? WHERE id = ?',
        [quantity, existing[0].id]
      );
    } else {
      // 없으면 새로 추가
      await db.execute(
        'INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)',
        [req.user.userId, productId, quantity]
      );
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
