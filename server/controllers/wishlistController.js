const db = require('../config/db');

// 위시리스트 조회
exports.getWishlist = async (req, res) => {
  try {
    const [items] = await db.execute(
      `SELECT w.id, w.product_id,
              p.name, p.price, p.image_url, p.stock, p.category
       FROM wishlists w
       JOIN products p ON w.product_id = p.id
       WHERE w.user_id = ?`,
      [req.user.userId]
    );
    res.json(items);
  } catch (error) {
    console.error('Get wishlist error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 위시리스트 추가
exports.addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;

    const [existing] = await db.execute(
      'SELECT * FROM wishlists WHERE user_id = ? AND product_id = ?',
      [req.user.userId, productId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: '이미 위시리스트에 있는 상품입니다.' });
    }

    await db.execute(
      'INSERT INTO wishlists (user_id, product_id) VALUES (?, ?)',
      [req.user.userId, productId]
    );

    res.status(201).json({ message: '위시리스트에 추가되었습니다.' });
  } catch (error) {
    console.error('Add to wishlist error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 찜 상태 확인 (특정 상품)
exports.checkWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const [rows] = await db.execute(
      'SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?',
      [req.user.userId, productId]
    );
    res.json({ wishlisted: rows.length > 0 });
  } catch (error) {
    console.error('Check wishlist error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 찜한 상품 ID 목록 (메인페이지용)
exports.getWishlistIds = async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT product_id FROM wishlists WHERE user_id = ?',
      [req.user.userId]
    );
    res.json(rows.map(r => r.product_id));
  } catch (error) {
    console.error('Get wishlist ids error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 위시리스트 삭제
exports.removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;

    await db.execute(
      'DELETE FROM wishlists WHERE user_id = ? AND product_id = ?',
      [req.user.userId, productId]
    );

    res.json({ message: '위시리스트에서 삭제되었습니다.' });
  } catch (error) {
    console.error('Remove from wishlist error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};
