const db = require('../config/db');

/**
 * 우편함 컨트롤러
 * - 우편함 조회/읽음 처리/삭제/전체 삭제
 * - 보상 수령: 쿠폰 → user_coupons에 추가, 포인트 → users.points 증가 (트랜잭션)
 * - 만료/중복 수령 방지
 */

// 우편함 목록 조회
exports.getMailbox = async (req, res) => {
  try {
    const [mails] = await db.execute(
      `SELECT * FROM mailbox WHERE user_id = ? ORDER BY created_at DESC`,
      [req.user.userId]
    );
    res.json(mails);
  } catch (error) {
    console.error('Get mailbox error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 안읽은 우편 수
exports.getUnreadCount = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT COUNT(*) as count FROM mailbox WHERE user_id = ? AND is_read = false`,
      [req.user.userId]
    );
    res.json({ count: rows[0].count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 우편 읽음 처리
exports.markAsRead = async (req, res) => {
  try {
    await db.execute(
      `UPDATE mailbox SET is_read = true WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.userId]
    );
    res.json({ message: '읽음 처리되었습니다.' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 보상 수령
exports.claimReward = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [mails] = await connection.execute(
      `SELECT * FROM mailbox WHERE id = ? AND user_id = ? FOR UPDATE`,
      [req.params.id, req.user.userId]
    );

    if (mails.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: '우편을 찾을 수 없습니다.' });
    }

    const mail = mails[0];

    if (mail.is_claimed) {
      await connection.rollback();
      return res.status(400).json({ message: '이미 수령한 보상입니다.' });
    }

    if (!mail.reward_type) {
      await connection.rollback();
      return res.status(400).json({ message: '수령할 보상이 없는 우편입니다.' });
    }

    if (mail.expires_at) {
      const [expiryCheck] = await connection.execute('SELECT ? < NOW() AS is_expired', [mail.expires_at]);
      if (expiryCheck[0].is_expired) {
        await connection.rollback();
        return res.status(400).json({ message: '만료된 우편입니다.' });
      }
    }

    // 보상 종류별 처리
    if (mail.reward_type === 'coupon') {
      if (!mail.reward_id) {
        await connection.rollback();
        return res.status(400).json({ message: '쿠폰 정보가 누락되어 수령할 수 없습니다.' });
      }
      // 쿠폰 존재 + 활성/유효기간 확인
      const [couponCheck] = await connection.execute(
        `SELECT id FROM coupons WHERE id = ? AND is_active = true AND expiry_date > NOW()`,
        [mail.reward_id]
      );
      if (couponCheck.length === 0) {
        await connection.rollback();
        return res.status(400).json({ message: '해당 쿠폰이 존재하지 않습니다.' });
      }
      // 쿠폰 지급 (이미 보유 중이면 스킵 - 배포 쿠폰은 이미 추가됨)
      const [existing] = await connection.execute(
        `SELECT id FROM user_coupons WHERE user_id = ? AND coupon_id = ?`,
        [req.user.userId, mail.reward_id]
      );
      if (existing.length === 0) {
        await connection.execute(
          `INSERT INTO user_coupons (user_id, coupon_id) VALUES (?, ?)`,
          [req.user.userId, mail.reward_id]
        );
      }
    } else if (mail.reward_type === 'point') {
      if (mail.reward_amount == null || mail.reward_amount < 0) {
        await connection.rollback();
        return res.status(400).json({ message: '포인트 정보가 누락되어 수령할 수 없습니다.' });
      }
      await connection.execute(
        'UPDATE users SET points = LEAST(points + ?, 9999999) WHERE id = ?',
        [mail.reward_amount, req.user.userId]
      );
    }

    // 수령 처리
    await connection.execute(
      `UPDATE mailbox SET is_claimed = true, claimed_at = NOW(), is_read = true WHERE id = ?`,
      [req.params.id]
    );

    await connection.commit();
    res.json({ message: '보상을 수령했습니다!' });
  } catch (error) {
    await connection.rollback();
    console.error('Claim reward error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    connection.release();
  }
};

// 우편 삭제 — 미수령 보상이 있는 우편은 보호
exports.deleteMail = async (req, res) => {
  try {
    const [mails] = await db.execute(
      `SELECT reward_type, is_claimed FROM mailbox WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.userId]
    );
    if (mails.length > 0 && mails[0].reward_type && !mails[0].is_claimed) {
      return res.status(400).json({ message: '미수령 보상이 있는 우편은 삭제할 수 없습니다.' });
    }
    const [result] = await db.execute(
      `DELETE FROM mailbox WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.userId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '우편을 찾을 수 없습니다.' });
    }
    res.json({ message: '우편이 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete mail error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 전체 삭제 — 미수령 보상이 있는 우편은 보호
exports.deleteAll = async (req, res) => {
  try {
    await db.execute(
      `DELETE FROM mailbox WHERE user_id = ? AND (is_claimed = true OR reward_type IS NULL)`,
      [req.user.userId]
    );
    res.json({ message: '전체 우편이 삭제되었습니다. (미수령 보상 우편 제외)' });
  } catch (error) {
    console.error('Delete all mails error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};
