const db = require('../config/db');

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

// 선물 수락 — 원자적 UPDATE로 동시 요청 방지
exports.acceptGift = async (req, res) => {
  try {
    // 원자적 UPDATE: status = 'pending' 조건으로 중복 처리 방지
    const [result] = await db.execute(
      "UPDATE gifts SET status = 'accepted', accepted_at = NOW() WHERE id = ? AND receiver_id = ? AND status = 'pending'",
      [req.params.id, req.user.userId]
    );

    if (result.affectedRows === 0) {
      // 선물 존재 여부 확인
      const [gifts] = await db.execute(
        'SELECT id, status FROM gifts WHERE id = ? AND receiver_id = ?',
        [req.params.id, req.user.userId]
      );
      if (gifts.length === 0) {
        return res.status(404).json({ message: '선물을 찾을 수 없습니다.' });
      }
      return res.status(400).json({ message: '이미 처리된 선물입니다.' });
    }

    // 보낸 사람에게 알림
    const [gifts] = await db.execute('SELECT sender_id FROM gifts WHERE id = ?', [req.params.id]);
    if (gifts.length > 0) {
      await db.execute(
        `INSERT INTO notifications (user_id, type, title, content) VALUES (?, 'gift', ?, ?)`,
        [gifts[0].sender_id, '선물이 수락되었습니다', '보내신 선물이 수락되었습니다.']
      );
    }

    res.json({ message: '선물을 수락했습니다.' });
  } catch (error) {
    console.error('Accept gift error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
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

      // 재고 복원 — 배치 UPDATE
      const [orderItems] = await connection.execute(
        'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
        [order.id]
      );
      if (orderItems.length > 0) {
        const caseParts = orderItems.map(() => 'WHEN id = ? THEN stock + ?').join(' ');
        const caseVals = orderItems.flatMap(item => [item.product_id, item.quantity]);
        const idPh = orderItems.map(() => '?').join(',');
        const idVals = orderItems.map(item => item.product_id);
        await connection.execute(
          `UPDATE products SET stock = CASE ${caseParts} ELSE stock END WHERE id IN (${idPh})`,
          [...caseVals, ...idVals]
        );
      }

      // 옵션 재고 복원 — 배치 UPDATE
      const [optionItems] = await connection.execute(
        `SELECT oio.option_value_id, oi.quantity FROM order_item_options oio
         JOIN order_items oi ON oio.order_item_id = oi.id WHERE oi.order_id = ?`,
        [order.id]
      );
      if (optionItems.length > 0) {
        const optCaseParts = optionItems.map(() => 'WHEN id = ? THEN stock + ?').join(' ');
        const optCaseVals = optionItems.flatMap(opt => [opt.option_value_id, opt.quantity]);
        const optIdPh = optionItems.map(() => '?').join(',');
        const optIdVals = optionItems.map(opt => opt.option_value_id);
        await connection.execute(
          `UPDATE product_option_values SET stock = CASE ${optCaseParts} ELSE stock END WHERE id IN (${optIdPh})`,
          [...optCaseVals, ...optIdVals]
        );
      }

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
