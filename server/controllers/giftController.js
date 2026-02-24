const db = require('../config/db');

// 보낸 선물 목록
exports.getSentGifts = async (req, res) => {
  try {
    const [gifts] = await db.execute(
      `SELECT g.*, u.nickname as receiver_nickname, o.total_amount, o.final_amount
       FROM gifts g
       LEFT JOIN users u ON g.receiver_id = u.id
       JOIN orders o ON g.order_id = o.id
       WHERE g.sender_id = ?
       ORDER BY g.created_at DESC`,
      [req.user.userId]
    );

    for (const gift of gifts) {
      const [items] = await db.execute(
        `SELECT oi.*, p.name, p.image_url
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`,
        [gift.order_id]
      );
      gift.order_items = items;
    }

    res.json(gifts);
  } catch (error) {
    console.error('Get sent gifts error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 받은 선물 목록
exports.getReceivedGifts = async (req, res) => {
  try {
    const [gifts] = await db.execute(
      `SELECT g.*, u.nickname as sender_nickname, o.total_amount, o.final_amount
       FROM gifts g
       LEFT JOIN users u ON g.sender_id = u.id
       JOIN orders o ON g.order_id = o.id
       WHERE g.receiver_id = ?
       ORDER BY g.created_at DESC`,
      [req.user.userId]
    );

    for (const gift of gifts) {
      const [items] = await db.execute(
        `SELECT oi.*, p.name, p.image_url
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`,
        [gift.order_id]
      );
      gift.order_items = items;
    }

    res.json(gifts);
  } catch (error) {
    console.error('Get received gifts error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 선물 수락
exports.acceptGift = async (req, res) => {
  try {
    const [gifts] = await db.execute(
      'SELECT * FROM gifts WHERE id = ? AND receiver_id = ?',
      [req.params.id, req.user.userId]
    );

    if (gifts.length === 0) {
      return res.status(404).json({ message: '선물을 찾을 수 없습니다.' });
    }

    if (gifts[0].status !== 'pending') {
      return res.status(400).json({ message: '이미 처리된 선물입니다.' });
    }

    await db.execute(
      'UPDATE gifts SET status = ?, accepted_at = NOW() WHERE id = ?',
      ['accepted', req.params.id]
    );

    // 보낸 사람에게 알림
    await db.execute(
      `INSERT INTO notifications (user_id, type, title, content) VALUES (?, 'gift', ?, ?)`,
      [gifts[0].sender_id, '선물이 수락되었습니다', '보내신 선물이 수락되었습니다.']
    );

    res.json({ message: '선물을 수락했습니다.' });
  } catch (error) {
    console.error('Accept gift error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 선물 거절
exports.rejectGift = async (req, res) => {
  try {
    const [gifts] = await db.execute(
      'SELECT * FROM gifts WHERE id = ? AND receiver_id = ?',
      [req.params.id, req.user.userId]
    );

    if (gifts.length === 0) {
      return res.status(404).json({ message: '선물을 찾을 수 없습니다.' });
    }

    if (gifts[0].status !== 'pending') {
      return res.status(400).json({ message: '이미 처리된 선물입니다.' });
    }

    await db.execute(
      'UPDATE gifts SET status = ? WHERE id = ?',
      ['rejected', req.params.id]
    );

    // 보낸 사람에게 알림
    await db.execute(
      `INSERT INTO notifications (user_id, type, title, content) VALUES (?, 'gift', ?, ?)`,
      [gifts[0].sender_id, '선물이 거절되었습니다', '보내신 선물이 거절되었습니다.']
    );

    res.json({ message: '선물을 거절했습니다.' });
  } catch (error) {
    console.error('Reject gift error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};
