const db = require('../config/db');

// 환불 신청
exports.requestRefund = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const userId = req.user.userId;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: '환불 사유를 입력해주세요.' });
    }

    // 주문 확인
    const [orders] = await db.execute(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?',
      [orderId, userId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ message: '주문을 찾을 수 없습니다.' });
    }

    const order = orders[0];

    if (order.status !== 'completed') {
      return res.status(400).json({ message: '수령완료된 주문만 환불 신청이 가능합니다.' });
    }

    // 7일 이내 확인
    if (order.completed_at) {
      const completedDate = new Date(order.completed_at);
      const now = new Date();
      const diffDays = (now.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > 7) {
        return res.status(400).json({ message: '수령완료 후 7일이 지나 환불 신청이 불가합니다.' });
      }
    }

    // 중복 환불 신청 확인
    const [existing] = await db.execute(
      'SELECT id FROM refunds WHERE order_id = ?',
      [orderId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: '이미 환불 신청된 주문입니다.' });
    }

    await db.execute(
      'INSERT INTO refunds (order_id, user_id, reason) VALUES (?, ?, ?)',
      [orderId, userId, reason.trim()]
    );

    // 주문 상태 변경
    await db.execute(
      'UPDATE orders SET status = ? WHERE id = ?',
      ['refund_requested', orderId]
    );

    res.status(201).json({ message: '환불 신청이 완료되었습니다.' });
  } catch (error) {
    console.error('Request refund error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 내 환불 목록 조회
exports.getMyRefunds = async (req, res) => {
  try {
    const [refunds] = await db.execute(
      'SELECT * FROM refunds WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.userId]
    );
    res.json(refunds);
  } catch (error) {
    console.error('Get my refunds error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};
