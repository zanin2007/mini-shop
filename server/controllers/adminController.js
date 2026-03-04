const db = require('../config/db');

/**
 * 관리자 컨트롤러
 * - 주문 관리: 전체 주문 조회, 상태 변경 (환불 상태 변경 차단)
 * - 상품 관리: 전체 상품 조회, 삭제
 * - 쿠폰 관리: 생성(할인율/정액), 조회, 삭제, 전체 배포 (우편함+알림)
 * - 공지사항: 작성(상단고정 최대 3개), 조회, 삭제, 전체 유저 알림
 * - 이벤트: 생성(쿠폰/포인트 보상), 조회, 삭제, 추첨 (우편함 보상 지급)
 * - 환불 관리: 전체 조회, 승인/거부 (승인 시 포인트 환불)
 * - 회원 관리: 활동 유저 조회, 제재 이력, 경고/정지 부여 (3회 경고 시 자동 7일 정지), 해제
 */

// 전체 주문 목록 조회 — 유저 정보 + 주문 상품 포함
exports.getAllOrders = async (req, res) => {
  try {
    const [orders] = await db.execute(
      `SELECT o.*, u.nickname, u.email
       FROM orders o
       JOIN users u ON o.user_id = u.id
       ORDER BY o.created_at DESC`
    );

    for (const order of orders) {
      const [items] = await db.execute(
        `SELECT oi.*, p.name, p.image_url
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`,
        [order.id]
      );
      order.items = items;
    }

    res.json(orders);
  } catch (error) {
    console.error('Admin get orders error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 주문 상태 변경 — 환불 처리중/완료 상태는 변경 차단
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['checking', 'pending', 'shipped', 'delivered', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: '유효하지 않은 상태입니다.' });
    }

    const [orders] = await db.execute('SELECT id, status FROM orders WHERE id = ?', [id]);
    if (orders.length === 0) {
      return res.status(404).json({ message: '주문을 찾을 수 없습니다.' });
    }

    const currentStatus = orders[0].status;
    if (currentStatus === 'refund_requested' || currentStatus === 'refunded') {
      return res.status(400).json({ message: '환불 처리 중이거나 환불 완료된 주문은 상태를 변경할 수 없습니다.' });
    }

    if (currentStatus === 'completed') {
      return res.status(400).json({ message: '수령완료된 주문은 상태를 변경할 수 없습니다.' });
    }

    await db.execute('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    res.json({ message: '주문 상태가 변경되었습니다.' });
  } catch (error) {
    console.error('Admin update order error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 전체 상품 목록 조회
exports.getAllProducts = async (req, res) => {
  try {
    const [products] = await db.execute(
      `SELECT p.*, u.nickname AS seller_nickname
       FROM products p
       LEFT JOIN users u ON p.user_id = u.id
       ORDER BY p.created_at DESC`
    );
    res.json(products);
  } catch (error) {
    console.error('Admin get products error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 상품 삭제 (관리자)
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM products WHERE id = ?', [id]);
    res.json({ message: '상품이 삭제되었습니다.' });
  } catch (error) {
    console.error('Admin delete product error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 쿠폰 생성 — 할인율 또는 정액 할인, 최소 주문금액/만료일/최대 배포수 설정
exports.createCoupon = async (req, res) => {
  try {
    const { code, discount_amount, discount_percentage, min_price, expiry_date, max_uses } = req.body;

    if (!code || !expiry_date) {
      return res.status(400).json({ message: '쿠폰 코드와 만료일은 필수입니다.' });
    }
    if (!discount_amount && !discount_percentage) {
      return res.status(400).json({ message: '할인 금액 또는 할인율을 입력해주세요.' });
    }

    await db.execute(
      'INSERT INTO coupons (code, discount_amount, discount_percentage, min_price, expiry_date, max_uses) VALUES (?, ?, ?, ?, ?, ?)',
      [code, discount_amount || 0, discount_percentage || null, min_price || null, expiry_date, max_uses || null]
    );

    res.status(201).json({ message: '쿠폰이 생성되었습니다.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: '이미 존재하는 쿠폰 코드입니다.' });
    }
    console.error('Admin create coupon error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 쿠폰 목록 조회
exports.getAllCoupons = async (req, res) => {
  try {
    const [coupons] = await db.execute('SELECT * FROM coupons ORDER BY created_at DESC');
    res.json(coupons);
  } catch (error) {
    console.error('Admin get coupons error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 쿠폰 삭제
exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM coupons WHERE id = ?', [id]);
    res.json({ message: '쿠폰이 삭제되었습니다.' });
  } catch (error) {
    console.error('Admin delete coupon error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 쿠폰 전체 배포 — 전체 유저에게 쿠폰 지급 + 우편함/알림 발송 (이미 보유 시 스킵)
exports.distributeCoupon = async (req, res) => {
  try {
    const { coupon_id } = req.body;
    if (!coupon_id) {
      return res.status(400).json({ message: '쿠폰을 선택해주세요.' });
    }

    const [coupons] = await db.execute('SELECT * FROM coupons WHERE id = ?', [coupon_id]);
    if (coupons.length === 0) {
      return res.status(404).json({ message: '쿠폰을 찾을 수 없습니다.' });
    }
    const coupon = coupons[0];

    const [users] = await db.execute('SELECT id FROM users');
    let distributed = 0;

    for (const user of users) {
      try {
        await db.execute(
          'INSERT INTO user_coupons (user_id, coupon_id) VALUES (?, ?)',
          [user.id, coupon_id]
        );
        await db.execute(
          `INSERT INTO mailbox (user_id, type, title, content, reward_type, reward_id)
           VALUES (?, 'coupon', ?, ?, 'coupon', ?)`,
          [user.id, `쿠폰 지급: ${coupon.code}`, `${coupon.discount_percentage ? coupon.discount_percentage + '%' : coupon.discount_amount.toLocaleString() + '원'} 할인 쿠폰이 지급되었습니다.`, coupon_id]
        );
        await db.execute(
          `INSERT INTO notifications (user_id, type, title, content)
           VALUES (?, 'coupon', '새 쿠폰이 도착했습니다!', ?)`,
          [user.id, `${coupon.code} 쿠폰이 우편함에 도착했습니다.`]
        );
        distributed++;
      } catch (err) {
        // 이미 보유한 쿠폰은 건너뜀 (UNIQUE 제약)
      }
    }

    res.json({ message: `${distributed}명에게 쿠폰을 배포했습니다.` });
  } catch (error) {
    console.error('Admin distribute coupon error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// ===== 공지사항 =====

// 공지 작성 — 상단 고정 공지 최대 3개 제한, 전체 유저 알림 발송
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, content, is_pinned } = req.body;
    if (!title || !content) {
      return res.status(400).json({ message: '제목과 내용을 입력해주세요.' });
    }

    // 상단 고정 공지 최대 3개 제한
    if (is_pinned) {
      const [pinnedRows] = await db.execute(
        'SELECT COUNT(*) as cnt FROM announcements WHERE is_pinned = true'
      );
      if (pinnedRows[0].cnt >= 3) {
        return res.status(400).json({ message: '상단 고정 공지는 최대 3개까지만 등록할 수 있습니다. 기존 상단 공지를 삭제 후 다시 시도해주세요.' });
      }
    }

    await db.execute(
      'INSERT INTO announcements (admin_id, title, content, is_pinned) VALUES (?, ?, ?, ?)',
      [req.user.userId, title, content, is_pinned || false]
    );

    const announcementId = (await db.execute(
      'SELECT LAST_INSERT_ID() as id'
    ))[0][0].id;

    // 전체 유저에게 알림 (상단 고정이면 is_pinned=true → 유저가 삭제 불가)
    const [users] = await db.execute('SELECT id FROM users');
    for (const user of users) {
      await db.execute(
        `INSERT INTO notifications (user_id, type, title, content, is_pinned, link)
         VALUES (?, 'system', ?, ?, ?, ?)`,
        [user.id, `📢 ${title}`, content.substring(0, 100), is_pinned ? true : false, is_pinned ? `pinned:${announcementId}` : null]
      );
    }

    res.status(201).json({ message: '공지가 등록되었습니다.' });
  } catch (error) {
    console.error('Admin create announcement error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 공지 목록
exports.getAllAnnouncements = async (req, res) => {
  try {
    const [announcements] = await db.execute(
      'SELECT * FROM announcements ORDER BY is_pinned DESC, created_at DESC'
    );
    res.json(announcements);
  } catch (error) {
    console.error('Admin get announcements error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 공지 삭제 — 상단 고정 공지 삭제 시 연결된 고정 알림도 함께 삭제
exports.deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    // 상단 고정 공지의 알림도 삭제 (link = 'pinned:{id}')
    await db.execute('DELETE FROM notifications WHERE link = ? AND is_pinned = true', [`pinned:${id}`]);
    await db.execute('DELETE FROM announcements WHERE id = ?', [id]);
    res.json({ message: '공지가 삭제되었습니다.' });
  } catch (error) {
    console.error('Admin delete announcement error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// ===== 이벤트 =====

// 이벤트 생성 — 쿠폰/포인트 보상 검증, 전체 유저 알림 (link에 이벤트 ID 저장)
exports.createEvent = async (req, res) => {
  try {
    const { title, description, type, reward_type, reward_id, reward_amount, max_participants, start_date, end_date } = req.body;
    if (!title || !start_date || !end_date) {
      return res.status(400).json({ message: '제목과 기간은 필수입니다.' });
    }

    // 쿠폰 보상인 경우 쿠폰 ID 필수 검증
    if (reward_type === 'coupon') {
      if (!reward_id) {
        return res.status(400).json({ message: '쿠폰 보상에는 쿠폰 ID가 필요합니다.' });
      }
      const [couponCheck] = await db.execute('SELECT id FROM coupons WHERE id = ?', [reward_id]);
      if (couponCheck.length === 0) {
        return res.status(400).json({ message: '존재하지 않는 쿠폰 ID입니다.' });
      }
    }

    // 포인트 보상인 경우 금액 필수 검증
    if (reward_type === 'point') {
      if (!reward_amount || reward_amount <= 0) {
        return res.status(400).json({ message: '포인트 보상에는 금액이 필요합니다.' });
      }
    }

    const [result] = await db.execute(
      `INSERT INTO events (title, description, type, reward_type, reward_id, reward_amount, max_participants, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description || null, type || 'fcfs', reward_type || null, reward_id || null, reward_amount || null, max_participants || null, start_date, end_date]
    );
    const eventId = result.insertId;

    // 전체 유저에게 알림 (link에 이벤트 ID 저장)
    const [users] = await db.execute('SELECT id FROM users');
    for (const user of users) {
      await db.execute(
        `INSERT INTO notifications (user_id, type, title, content, link)
         VALUES (?, 'system', ?, ?, ?)`,
        [user.id, `🎉 새 이벤트: ${title}`, description ? description.substring(0, 100) : '새로운 이벤트가 시작되었습니다!', `event:${eventId}`]
      );
    }

    res.status(201).json({ message: '이벤트가 생성되었습니다.' });
  } catch (error) {
    console.error('Admin create event error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 이벤트 목록 (관리자)
exports.getAllEvents = async (req, res) => {
  try {
    const [events] = await db.execute(
      `SELECT e.*, (SELECT COUNT(*) FROM event_participants WHERE event_id = e.id) AS current_participants
       FROM events e ORDER BY e.created_at DESC`
    );
    res.json(events);
  } catch (error) {
    console.error('Admin get events error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 이벤트 삭제
exports.deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM events WHERE id = ?', [id]);
    res.json({ message: '이벤트가 삭제되었습니다.' });
  } catch (error) {
    console.error('Admin delete event error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 이벤트 추첨 — 랜덤 당첨자 선정 + 우편함 보상 지급 + 알림 발송
exports.drawEventWinners = async (req, res) => {
  try {
    const { id } = req.params;
    const { winner_count } = req.body;

    const [events] = await db.execute('SELECT * FROM events WHERE id = ?', [id]);
    if (events.length === 0) {
      return res.status(404).json({ message: '이벤트를 찾을 수 없습니다.' });
    }
    const event = events[0];

    const limit = parseInt(winner_count) || 1;
    const [participants] = await db.execute(
      `SELECT * FROM event_participants WHERE event_id = ? AND is_winner = false ORDER BY RAND() LIMIT ${limit}`,
      [id]
    );

    if (participants.length === 0) {
      return res.status(400).json({ message: '추첨할 참여자가 없습니다.' });
    }

    for (const p of participants) {
      await db.execute(
        'UPDATE event_participants SET is_winner = true WHERE id = ?',
        [p.id]
      );

      // 보상 지급 (우편함)
      if (event.reward_type) {
        await db.execute(
          `INSERT INTO mailbox (user_id, type, title, content, reward_type, reward_id, reward_amount)
           VALUES (?, 'event', ?, ?, ?, ?, ?)`,
          [p.user_id, `🎊 ${event.title} 당첨!`, '축하합니다! 이벤트에 당첨되었습니다. 보상을 수령해주세요.', event.reward_type, event.reward_id, event.reward_amount]
        );
      }

      await db.execute(
        `INSERT INTO notifications (user_id, type, title, content)
         VALUES (?, 'system', ?, '우편함에서 보상을 확인해주세요!')`,
        [p.user_id, `🎊 ${event.title} 당첨!`]
      );
    }

    res.json({ message: `${participants.length}명이 당첨되었습니다.` });
  } catch (error) {
    console.error('Admin draw event winners error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 전체 환불 요청 조회 — 유저/주문 정보 + 주문 상품 포함
exports.getAllRefunds = async (req, res) => {
  try {
    const [refunds] = await db.execute(
      `SELECT r.*, u.nickname, u.email,
              o.total_amount, o.discount_amount, o.final_amount, o.created_at AS order_date
       FROM refunds r
       JOIN users u ON r.user_id = u.id
       JOIN orders o ON r.order_id = o.id
       ORDER BY r.created_at DESC`
    );

    // 각 환불에 주문 상품 정보 포함
    for (const refund of refunds) {
      const [items] = await db.execute(
        `SELECT oi.*, p.name, p.image_url
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`,
        [refund.order_id]
      );
      refund.items = items;
    }

    res.json(refunds);
  } catch (error) {
    console.error('Admin get refunds error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// ===== 회원 관리 (경고/정지) =====

// 회원 활동 목록 — 리뷰/환불/제재 이력이 있는 유저 조회 (경고 누적, 정지 상태 포함)
exports.getUsersWithActivity = async (req, res) => {
  try {
    const [users] = await db.execute(
      `SELECT u.id, u.nickname, u.email, u.role, u.created_at,
              (SELECT COUNT(*) FROM reviews WHERE user_id = u.id) AS review_count,
              (SELECT COUNT(*) FROM refunds WHERE user_id = u.id) AS refund_count,
              (SELECT COUNT(*) FROM user_penalties WHERE user_id = u.id AND type = 'warning' AND is_active = true) AS warning_count,
              (SELECT p.type FROM user_penalties p
               WHERE p.user_id = u.id AND p.is_active = true AND p.type != 'warning'
               AND (p.suspended_until IS NULL OR p.suspended_until > NOW())
               ORDER BY p.created_at DESC LIMIT 1) AS suspension_type,
              (SELECT p.suspended_until FROM user_penalties p
               WHERE p.user_id = u.id AND p.is_active = true AND p.type != 'warning'
               AND (p.suspended_until IS NULL OR p.suspended_until > NOW())
               ORDER BY p.created_at DESC LIMIT 1) AS suspended_until
       FROM users u
       WHERE u.role != 'admin'
       AND ((SELECT COUNT(*) FROM reviews WHERE user_id = u.id) > 0
            OR (SELECT COUNT(*) FROM refunds WHERE user_id = u.id) > 0
            OR (SELECT COUNT(*) FROM user_penalties WHERE user_id = u.id) > 0)
       ORDER BY u.created_at DESC`
    );
    res.json(users);
  } catch (error) {
    console.error('Admin get users activity error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 특정 사용자 제재 이력 조회
exports.getUserPenalties = async (req, res) => {
  try {
    const { userId } = req.params;
    const [penalties] = await db.execute(
      `SELECT p.*, a.nickname AS admin_nickname
       FROM user_penalties p
       JOIN users a ON p.admin_id = a.id
       WHERE p.user_id = ?
       ORDER BY p.created_at DESC`,
      [userId]
    );
    res.json(penalties);
  } catch (error) {
    console.error('Admin get user penalties error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 경고/정지 부여 — 경고 3회 누적 시 자동 7일 정지, 알림 발송
exports.issuePenalty = async (req, res) => {
  try {
    const { userId } = req.params;
    const { type, reason } = req.body;

    if (!['warning', '7day', '30day', 'permanent'].includes(type)) {
      return res.status(400).json({ message: '유효하지 않은 제재 유형입니다.' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: '사유를 입력해주세요.' });
    }

    // 대상 사용자 확인
    const [users] = await db.execute('SELECT id, nickname FROM users WHERE id = ? AND role != ?', [userId, 'admin']);
    if (users.length === 0) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    let suspendedUntil = null;
    if (type === '7day') {
      suspendedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    } else if (type === '30day') {
      suspendedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    await db.execute(
      'INSERT INTO user_penalties (user_id, type, reason, admin_id, suspended_until) VALUES (?, ?, ?, ?, ?)',
      [userId, type, reason.trim(), req.user.userId, suspendedUntil]
    );

    // 알림 발송
    const typeLabel = { warning: '경고', '7day': '7일 정지', '30day': '30일 정지', permanent: '영구 정지' };
    await db.execute(
      `INSERT INTO notifications (user_id, type, title, content) VALUES (?, 'system', ?, ?)`,
      [userId, `${typeLabel[type]}를 받았습니다`, `사유: ${reason.trim()}`]
    );

    // 경고인 경우 누적 3회 이상 시 자동 7일 정지
    if (type === 'warning') {
      const [warnings] = await db.execute(
        'SELECT COUNT(*) AS cnt FROM user_penalties WHERE user_id = ? AND type = ? AND is_active = true',
        [userId, 'warning']
      );
      if (warnings[0].cnt >= 3) {
        const autoSuspendUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await db.execute(
          'INSERT INTO user_penalties (user_id, type, reason, admin_id, suspended_until) VALUES (?, ?, ?, ?, ?)',
          [userId, '7day', '경고 3회 누적으로 인한 자동 정지', req.user.userId, autoSuspendUntil]
        );
        await db.execute(
          `INSERT INTO notifications (user_id, type, title, content) VALUES (?, 'system', ?, ?)`,
          [userId, '경고 누적으로 7일 정지 처리되었습니다', '경고 3회 이상 누적으로 자동 7일 이용 정지되었습니다.']
        );
        return res.json({ message: `경고가 부여되었습니다. (누적 ${warnings[0].cnt}회 - 자동 7일 정지 적용)` });
      }
    }

    res.json({ message: `${typeLabel[type]}가 부여되었습니다.` });
  } catch (error) {
    console.error('Admin issue penalty error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 제재 해제 — is_active를 false로 변경 + 알림 발송
exports.revokePenalty = async (req, res) => {
  try {
    const { penaltyId } = req.params;

    const [penalties] = await db.execute('SELECT * FROM user_penalties WHERE id = ? AND is_active = true', [penaltyId]);
    if (penalties.length === 0) {
      return res.status(404).json({ message: '활성 제재를 찾을 수 없습니다.' });
    }

    await db.execute('UPDATE user_penalties SET is_active = false WHERE id = ?', [penaltyId]);

    // 알림 발송
    await db.execute(
      `INSERT INTO notifications (user_id, type, title, content) VALUES (?, 'system', ?, ?)`,
      [penalties[0].user_id, '제재가 해제되었습니다', '이용 제재가 해제되었습니다.']
    );

    res.json({ message: '제재가 해제되었습니다.' });
  } catch (error) {
    console.error('Admin revoke penalty error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 환불 승인/거부 — 승인 시 주문 상태 환불완료 + 포인트 환불, 거부 시 수령완료로 복원
exports.processRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, admin_note } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: '유효하지 않은 처리입니다.' });
    }

    const [refunds] = await db.execute('SELECT * FROM refunds WHERE id = ?', [id]);
    if (refunds.length === 0) {
      return res.status(404).json({ message: '환불 요청을 찾을 수 없습니다.' });
    }

    const refund = refunds[0];
    if (refund.status !== 'requested') {
      return res.status(400).json({ message: '이미 처리된 환불 요청입니다.' });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await db.execute(
      'UPDATE refunds SET status = ?, admin_note = ?, processed_at = NOW() WHERE id = ?',
      [newStatus, admin_note || null, id]
    );

    if (action === 'approve') {
      // 주문 상태 환불완료로 변경
      await db.execute(
        'UPDATE orders SET status = ? WHERE id = ?',
        ['refunded', refund.order_id]
      );
      // 포인트 환불
      const [orderRows] = await db.execute(
        'SELECT points_used FROM orders WHERE id = ?',
        [refund.order_id]
      );
      const pointsUsed = orderRows[0]?.points_used || 0;
      if (pointsUsed > 0) {
        await db.execute(
          'UPDATE users SET points = points + ? WHERE id = ?',
          [pointsUsed, refund.user_id]
        );
      }
    } else {
      // 거부 시 주문 상태를 수령완료로 복원
      await db.execute(
        'UPDATE orders SET status = ? WHERE id = ?',
        ['completed', refund.order_id]
      );
    }

    // 유저에게 알림
    const title = action === 'approve'
      ? '환불이 승인되었습니다.'
      : '환불 요청이 거부되었습니다.';
    const content = admin_note || (action === 'approve' ? '환불 처리가 완료되었습니다.' : '환불 요청이 거부되었습니다.');

    await db.execute(
      `INSERT INTO notifications (user_id, type, title, content)
       VALUES (?, 'system', ?, ?)`,
      [refund.user_id, title, content]
    );

    res.json({ message: action === 'approve' ? '환불이 승인되었습니다.' : '환불이 거부되었습니다.' });
  } catch (error) {
    console.error('Admin process refund error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};
