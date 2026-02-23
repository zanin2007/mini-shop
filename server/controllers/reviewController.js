const db = require('../config/db');

// 상품별 리뷰 조회
exports.getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const [reviews] = await db.execute(
      `SELECT r.*, u.nickname
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.product_id = ?
       ORDER BY r.created_at DESC`,
      [productId]
    );
    res.json(reviews);
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 리뷰 작성 (구매자만 가능)
exports.createReview = async (req, res) => {
  try {
    const { productId, rating, content } = req.body;

    // 구매 여부 확인
    const [orders] = await db.execute(
      `SELECT o.id FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       WHERE o.user_id = ? AND oi.product_id = ?`,
      [req.user.userId, productId]
    );

    if (orders.length === 0) {
      return res.status(403).json({ message: '구매한 상품만 리뷰를 작성할 수 있습니다.' });
    }

    // 중복 리뷰 확인
    const [existing] = await db.execute(
      'SELECT id FROM reviews WHERE user_id = ? AND product_id = ?',
      [req.user.userId, productId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: '이미 리뷰를 작성하셨습니다.' });
    }

    await db.execute(
      'INSERT INTO reviews (user_id, product_id, order_id, rating, content) VALUES (?, ?, ?, ?, ?)',
      [req.user.userId, productId, orders[0].id, rating, content]
    );

    res.status(201).json({ message: '리뷰가 등록되었습니다.' });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 리뷰 삭제 (본인만)
exports.deleteReview = async (req, res) => {
  try {
    const { id } = req.params;

    const [reviews] = await db.execute('SELECT * FROM reviews WHERE id = ?', [id]);
    if (reviews.length === 0) {
      return res.status(404).json({ message: '리뷰를 찾을 수 없습니다.' });
    }

    if (reviews[0].user_id !== req.user.userId) {
      return res.status(403).json({ message: '본인의 리뷰만 삭제할 수 있습니다.' });
    }

    await db.execute('DELETE FROM reviews WHERE id = ?', [id]);
    res.json({ message: '리뷰가 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 구매 여부 확인 API
exports.checkPurchased = async (req, res) => {
  try {
    const { productId } = req.params;
    const [orders] = await db.execute(
      `SELECT o.id FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       WHERE o.user_id = ? AND oi.product_id = ?`,
      [req.user.userId, productId]
    );

    const [existing] = await db.execute(
      'SELECT id FROM reviews WHERE user_id = ? AND product_id = ?',
      [req.user.userId, productId]
    );

    res.json({
      purchased: orders.length > 0,
      reviewed: existing.length > 0
    });
  } catch (error) {
    console.error('Check purchased error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};
