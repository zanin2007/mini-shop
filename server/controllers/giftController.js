const db = require('../config/db');
const { restoreOrderStock } = require('../utils/stockHelper');

// 보낸 선물 목록
exports.getSentGifts = async (req, res) => {
  try {
    const [gifts] = await db.execute(
      `SELECT g.*, u.nickname as receiver_nickname, o.total_amount, o.final_amount, o.status as order_status
       FROM gifts g
       LEFT JOIN users u ON g.receiver_id = u.id
       JOIN orders o ON g.order_id = o.id
       WHERE g.sender_id = ?
       ORDER BY g.created_at DESC`,
      [req.user.userId]
    );

    if (gifts.length > 0) {
      const orderIds = gifts.map(g => g.order_id);
      const ph = orderIds.map(() => '?').join(',');
      const [allItems] = await db.execute(
        `SELECT oi.*, p.name, p.image_url FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id IN (${ph})`, orderIds
      );
      const itemsMap = new Map();
      for (const item of allItems) {
        if (!itemsMap.has(item.order_id)) itemsMap.set(item.order_id, []);
        itemsMap.get(item.order_id).push(item);
      }
      for (const gift of gifts) gift.order_items = itemsMap.get(gift.order_id) || [];
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
      `SELECT g.*, u.nickname as sender_nickname, o.total_amount, o.final_amount, o.status as order_status
       FROM gifts g
       LEFT JOIN users u ON g.sender_id = u.id
       JOIN orders o ON g.order_id = o.id
       WHERE g.receiver_id = ?
       ORDER BY g.created_at DESC`,
      [req.user.userId]
    );

    if (gifts.length > 0) {
      const orderIds = gifts.map(g => g.order_id);
      const ph = orderIds.map(() => '?').join(',');
      const [allItems] = await db.execute(
        `SELECT oi.*, p.name, p.image_url FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id IN (${ph})`, orderIds
      );
      const itemsMap = new Map();
      for (const item of allItems) {
        if (!itemsMap.has(item.order_id)) itemsMap.set(item.order_id, []);
        itemsMap.get(item.order_id).push(item);
      }
      for (const gift of gifts) gift.order_items = itemsMap.get(gift.order_id) || [];
    }

    res.json(gifts);
  } catch (error) {
    console.error('Get received gifts error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 선물 수락 — 트랜잭션으로 상태 변경, 알림은 best-effort
exports.acceptGift = async (req, res) => {
  const connection = await db.getConnection();
  let senderId = null;
  try {
    await connection.beginTransaction();

    // SELECT FOR UPDATE로 선물 행 잠금 + sender_id 확보
    const [gifts] = await connection.execute(
      'SELECT id, sender_id, status FROM gifts WHERE id = ? AND receiver_id = ? FOR UPDATE',
      [req.params.id, req.user.userId]
    );

    if (gifts.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: '선물을 찾을 수 없습니다.' });
    }
    if (gifts[0].status !== 'pending') {
      await connection.rollback();
      return res.status(400).json({ message: '이미 처리된 선물입니다.' });
    }

    // 수락 처리
    await connection.execute(
      "UPDATE gifts SET status = 'accepted', accepted_at = NOW() WHERE id = ?",
      [req.params.id]
    );

    await connection.commit();
    senderId = gifts[0].sender_id;
  } catch (error) {
    await connection.rollback();
    console.error('Accept gift error:', error);
    return res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    connection.release();
  }

  // 보낸 사람에게 알림 (best-effort — 실패해도 수락은 유지)
  try {
    await db.execute(
      `INSERT INTO notifications (user_id, type, title, content) VALUES (?, 'gift', ?, ?)`,
      [senderId, '선물이 수락되었습니다', '보내신 선물이 수락되었습니다.']
    );
  } catch (notifError) {
    console.error('Accept gift notification error:', notifError);
  }

  res.json({ message: '선물을 수락했습니다.' });
};

// 선물 거절 — 자동 환불 처리 (재고 복원, 쿠폰 복원, 포인트 환불, 주문 상태 변경)
exports.rejectGift = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [gifts] = await connection.execute(
      'SELECT * FROM gifts WHERE id = ? AND receiver_id = ? FOR UPDATE',
      [req.params.id, req.user.userId]
    );

    if (gifts.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: '선물을 찾을 수 없습니다.' });
    }

    if (gifts[0].status !== 'pending') {
      await connection.rollback();
      return res.status(400).json({ message: '이미 처리된 선물입니다.' });
    }

    const gift = gifts[0];

    // 선물 상태 → 거절
    await connection.execute(
      'UPDATE gifts SET status = ? WHERE id = ?',
      ['rejected', req.params.id]
    );

    // 주문 정보 조회 (FOR UPDATE로 행 잠금 — 동시 환불 방지)
    const [orders] = await connection.execute(
      'SELECT * FROM orders WHERE id = ? FOR UPDATE',
      [gift.order_id]
    );

    if (orders.length > 0) {
      const order = orders[0];

      // 이미 환불된 주문이면 이중 환불 방지
      if (order.status === 'refunded') {
        await connection.rollback();
        return res.status(400).json({ message: '이미 환불된 주문입니다.' });
      }

      // 주문 상태 → 환불완료
      await connection.execute(
        'UPDATE orders SET status = ? WHERE id = ?',
        ['refunded', order.id]
      );

      // 재고 복원 (상품 + 옵션)
      await restoreOrderStock(connection, order.id);

      // 쿠폰 복원
      if (order.coupon_id) {
        await connection.execute(
          'UPDATE user_coupons SET is_used = false, used_at = NULL WHERE user_id = ? AND coupon_id = ?',
          [gift.sender_id, order.coupon_id]
        );
        await connection.execute(
          'UPDATE coupons SET current_uses = GREATEST(current_uses - 1, 0) WHERE id = ?',
          [order.coupon_id]
        );
      }

      // 포인트 환불
      if (order.points_used > 0) {
        await connection.execute(
          'UPDATE users SET points = LEAST(points + ?, 9999999) WHERE id = ?',
          [order.points_used, gift.sender_id]
        );
      }
    }

    // 보낸 사람에게 알림 (거절 + 환불 안내)
    await connection.execute(
      `INSERT INTO notifications (user_id, type, title, content) VALUES (?, 'gift', ?, ?)`,
      [gift.sender_id, '선물이 거절되었습니다', '보내신 선물이 거절되어 자동으로 환불 처리되었습니다.']
    );

    await connection.commit();
    res.json({ message: '선물을 거절했습니다. 보낸 분에게 자동 환불됩니다.' });
  } catch (error) {
    await connection.rollback();
    console.error('Reject gift error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    connection.release();
  }
};

// 선물 수령완료 (받는 사람이 확인)
exports.confirmGift = async (req, res) => {
  try {
    const [gifts] = await db.execute(
      `SELECT g.*, o.status as order_status FROM gifts g
       JOIN orders o ON g.order_id = o.id
       WHERE g.id = ? AND g.receiver_id = ?`,
      [req.params.id, req.user.userId]
    );

    if (gifts.length === 0) {
      return res.status(404).json({ message: '선물을 찾을 수 없습니다.' });
    }

    if (gifts[0].status !== 'accepted') {
      return res.status(400).json({ message: '수락된 선물만 수령완료할 수 있습니다.' });
    }

    if (gifts[0].order_status !== 'delivered') {
      return res.status(400).json({ message: '배송 완료된 선물만 수령완료할 수 있습니다.' });
    }

    await db.execute(
      'UPDATE orders SET status = ?, completed_at = NOW() WHERE id = ?',
      ['completed', gifts[0].order_id]
    );

    // 보낸 사람에게 알림
    await db.execute(
      `INSERT INTO notifications (user_id, type, title, content) VALUES (?, 'gift', ?, ?)`,
      [gifts[0].sender_id, '선물이 수령완료되었습니다', '보내신 선물을 상대방이 수령완료했습니다.']
    );

    res.json({ message: '수령이 완료되었습니다.' });
  } catch (error) {
    console.error('Confirm gift error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};
