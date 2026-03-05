const db = require('../config/db');

/**
 * 환불 컨트롤러
 * - 환불 신청: 수령완료(completed) 후 7일 이내만 가능, 중복 신청 차단 (트랜잭션)
 * - 내 환불 목록 조회: 환불 상태(심사중/승인/거부) 확인
 */

// 환불 신청 — 주문 상태/기간/중복 검증 → refunds INSERT + 주문 상태를 refund_requested로 변경 (트랜잭션)
exports.requestRefund = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { orderId } = req.params;
    const { reason } = req.body;
    const userId = req.user.userId;

    if (!reason || !reason.trim()) {
      await connection.rollback();
      return res.status(400).json({ message: '환불 사유를 입력해주세요.' });
    }

    // 주문 확인
    const [orders] = await connection.execute(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?',
      [orderId, userId]
    );

    if (orders.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: '주문을 찾을 수 없습니다.' });
    }

    const order = orders[0];

    if (order.status !== 'completed') {
      await connection.rollback();
      return res.status(400).json({ message: '수령완료된 주문만 환불 신청이 가능합니다.' });
    }

    // 7일 이내 확인 — DB 타임존 기준으로 계산 (JS Date 혼용 방지)
    if (!order.completed_at) {
      await connection.rollback();
      return res.status(400).json({ message: '구매확정 일시 정보가 없어 환불 신청이 불가합니다.' });
    }
    const [diffRows] = await connection.execute(
      'SELECT TIMESTAMPDIFF(DAY, completed_at, NOW()) AS diff_days FROM orders WHERE id = ?',
      [orderId]
    );
    if (diffRows[0].diff_days > 7) {
      await connection.rollback();
      return res.status(400).json({ message: '수령완료 후 7일이 지나 환불 신청이 불가합니다.' });
    }

    // INSERT 시도 — UNIQUE(order_id) 제약으로 중복 방지 (TOCTOU 레이스 방지)
    try {
      await connection.execute(
        'INSERT INTO refunds (order_id, user_id, reason) VALUES (?, ?, ?)',
        [orderId, userId, reason.trim()]
      );
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        await connection.rollback();
        return res.status(400).json({ message: '이미 환불 신청된 주문입니다.' });
      }
      throw err;
    }

    // 주문 상태 변경
    await connection.execute(
      'UPDATE orders SET status = ? WHERE id = ?',
      ['refund_requested', orderId]
    );

    await connection.commit();
    res.status(201).json({ message: '환불 신청이 완료되었습니다.' });
  } catch (error) {
    await connection.rollback();
    console.error('Request refund error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    connection.release();
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
