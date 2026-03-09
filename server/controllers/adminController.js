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

    if (orders.length > 0) {
      const orderIds = orders.map(o => o.id);
      const ph = orderIds.map(() => '?').join(',');
      const [allItems] = await db.execute(
        `SELECT oi.*, p.name, p.image_url FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id IN (${ph})`,
        orderIds
      );
      const itemsMap = new Map();
      for (const item of allItems) {
        if (!itemsMap.has(item.order_id)) itemsMap.set(item.order_id, []);
        itemsMap.get(item.order_id).push(item);
      }
      for (const order of orders) {
        order.items = itemsMap.get(order.id) || [];
      }
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

    // 정방향 전이만 허용
    const statusOrder = { checking: 0, pending: 1, shipped: 2, delivered: 3, completed: 4 };
    if (statusOrder[status] <= statusOrder[currentStatus]) {
      return res.status(400).json({ message: '현재 상태보다 이전 단계로 변경할 수 없습니다.' });
    }

    // 원자적 UPDATE: 현재 상태 조건으로 동시 변경 방지
    const extra = status === 'completed' ? ', completed_at = NOW()' : '';
    const [updateResult] = await db.execute(`UPDATE orders SET status = ?${extra} WHERE id = ? AND status = ?`, [status, id, currentStatus]);
    if (updateResult.affectedRows === 0) {
      return res.status(409).json({ message: '다른 관리자가 이미 상태를 변경했습니다. 새로고침 해주세요.' });
    }
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

    // 활성 주문이 있는 상품은 삭제 차단
    const [activeItems] = await db.execute(
      `SELECT oi.id FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE oi.product_id = ? AND o.status NOT IN ('completed', 'refunded')
       LIMIT 1`,
      [id]
    );
    if (activeItems.length > 0) {
      return res.status(400).json({ message: '진행중인 주문이 있는 상품은 삭제할 수 없습니다.' });
    }

    const [result] = await db.execute('DELETE FROM products WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '상품을 찾을 수 없습니다.' });
    }
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

    if (new Date(expiry_date) < new Date()) {
      return res.status(400).json({ message: '만료일은 현재 이후여야 합니다.' });
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
    if (!coupon_id || !Number.isInteger(Number(coupon_id)) || Number(coupon_id) <= 0) {
      return res.status(400).json({ message: '유효한 쿠폰을 선택해주세요.' });
    }

    const [coupons] = await db.execute('SELECT * FROM coupons WHERE id = ?', [coupon_id]);
    if (coupons.length === 0) {
      return res.status(404).json({ message: '쿠폰을 찾을 수 없습니다.' });
    }
    const coupon = coupons[0];

    const [users] = await db.execute('SELECT id FROM users');
    if (users.length === 0) {
      return res.json({ message: '배포할 유저가 없습니다.' });
    }

    // 이미 보유한 유저 제외
    const [existing] = await db.execute(
      'SELECT user_id FROM user_coupons WHERE coupon_id = ?',
      [coupon_id]
    );
    const existingSet = new Set(existing.map(e => e.user_id));
    const targetUsers = users.filter(u => !existingSet.has(u.id));

    if (targetUsers.length === 0) {
      return res.json({ message: '모든 유저가 이미 보유한 쿠폰입니다.' });
    }

    const discountText = coupon.discount_percentage
      ? coupon.discount_percentage + '%'
      : coupon.discount_amount.toLocaleString() + '원';

    // 배치 INSERT — 100명씩 청크 처리 (트랜잭션으로 원자성 보장)
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const CHUNK = 100;
      for (let i = 0; i < targetUsers.length; i += CHUNK) {
        const chunk = targetUsers.slice(i, i + CHUNK);

        const couponPh = chunk.map(() => '(?, ?)').join(',');
        const couponVals = chunk.flatMap(u => [u.id, coupon_id]);
        await connection.execute(`INSERT INTO user_coupons (user_id, coupon_id) VALUES ${couponPh}`, couponVals);

        const mailPh = chunk.map(() => "(?, 'coupon', ?, ?, 'coupon', ?)").join(',');
        const mailVals = chunk.flatMap(u => [u.id, `쿠폰 지급: ${coupon.code}`, `${discountText} 할인 쿠폰이 지급되었습니다.`, coupon_id]);
        await connection.execute(`INSERT INTO mailbox (user_id, type, title, content, reward_type, reward_id) VALUES ${mailPh}`, mailVals);

        const notiPh = chunk.map(() => "(?, 'coupon', '새 쿠폰이 도착했습니다!', ?)").join(',');
        const notiVals = chunk.flatMap(u => [u.id, `${coupon.code} 쿠폰이 우편함에 도착했습니다.`]);
        await connection.execute(`INSERT INTO notifications (user_id, type, title, content) VALUES ${notiPh}`, notiVals);
      }

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    res.json({ message: `${targetUsers.length}명에게 쿠폰을 배포했습니다.` });
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

    const [annResult] = await db.execute(
      'INSERT INTO announcements (admin_id, title, content, is_pinned) VALUES (?, ?, ?, ?)',
      [req.user.userId, title, content, is_pinned || false]
    );
    const announcementId = annResult.insertId;

    // 전체 유저에게 알림 — 배치 INSERT (상단 고정이면 is_pinned=true → 유저가 삭제 불가)
    const [users] = await db.execute('SELECT id FROM users');
    if (users.length > 0) {
      const notifTitle = `📢 ${title}`;
      const notifContent = content.substring(0, 100);
      const isPinned = is_pinned ? true : false;
      const link = is_pinned ? `pinned:${announcementId}` : null;
      const ph = users.map(() => '(?, ?, ?, ?, ?, ?)').join(',');
      const vals = users.flatMap(u => [u.id, 'system', notifTitle, notifContent, isPinned, link]);
      await db.execute(
        `INSERT INTO notifications (user_id, type, title, content, is_pinned, link) VALUES ${ph}`,
        vals
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

    if (new Date(start_date) >= new Date(end_date)) {
      return res.status(400).json({ message: '시작일은 종료일보다 이전이어야 합니다.' });
    }

    if (reward_amount != null && reward_amount < 0) {
      return res.status(400).json({ message: '보상 금액은 0 이상이어야 합니다.' });
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

    // 전체 유저에게 알림 — 배치 INSERT (link에 이벤트 ID 저장)
    const [users] = await db.execute('SELECT id FROM users');
    if (users.length > 0) {
      const notifTitle = `🎉 새 이벤트: ${title}`;
      const notifContent = description ? description.substring(0, 100) : '새로운 이벤트가 시작되었습니다!';
      const link = `event:${eventId}`;
      const ph = users.map(() => '(?, ?, ?, ?, ?)').join(',');
      const vals = users.flatMap(u => [u.id, 'system', notifTitle, notifContent, link]);
      await db.execute(
        `INSERT INTO notifications (user_id, type, title, content, link) VALUES ${ph}`,
        vals
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

// 이벤트 추첨 — 랜덤 당첨자 선정 + 우편함 보상 지급 + 알림 발송 (트랜잭션)
exports.drawEventWinners = async (req, res) => {
  try {
    const { id } = req.params;
    const { winner_count } = req.body;

    const [events] = await db.execute('SELECT * FROM events WHERE id = ?', [id]);
    if (events.length === 0) {
      return res.status(404).json({ message: '이벤트를 찾을 수 없습니다.' });
    }
    const event = events[0];

    const limit = parseInt(winner_count, 10) || 1;
    if (limit < 1 || limit > 1000) {
      return res.status(400).json({ message: '당첨 인원은 1~1000명이어야 합니다.' });
    }
    // NOTE: LIMIT에는 파라미터 바인딩 불가, parseInt로 검증 완료
    const [participants] = await db.execute(
      `SELECT * FROM event_participants WHERE event_id = ? AND is_winner = false ORDER BY RAND() LIMIT ${limit}`,
      [id]
    );

    if (participants.length === 0) {
      return res.status(400).json({ message: '추첨할 참여자가 없습니다.' });
    }

    // 트랜잭션으로 당첨 UPDATE + 우편함 + 알림을 원자적 처리
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 배치 UPDATE — 당첨자 일괄 처리
      const winnerIds = participants.map(p => p.id);
      const winnerPh = winnerIds.map(() => '?').join(',');
      await connection.execute(
        `UPDATE event_participants SET is_winner = true WHERE id IN (${winnerPh})`,
        winnerIds
      );

      // 보상 지급 (우편함) — 배치 INSERT
      if (event.reward_type) {
        const mailPh = participants.map(() => "(?, 'event', ?, ?, ?, ?, ?)").join(',');
        const mailVals = participants.flatMap(p => [
          p.user_id, `🎊 ${event.title} 당첨!`, '축하합니다! 이벤트에 당첨되었습니다. 보상을 수령해주세요.',
          event.reward_type, event.reward_id, event.reward_amount
        ]);
        await connection.execute(
          `INSERT INTO mailbox (user_id, type, title, content, reward_type, reward_id, reward_amount) VALUES ${mailPh}`,
          mailVals
        );
      }

      // 알림 — 배치 INSERT
      const notiPh = participants.map(() => "(?, 'system', ?, '우편함에서 보상을 확인해주세요!')").join(',');
      const notiVals = participants.flatMap(p => [p.user_id, `🎊 ${event.title} 당첨!`]);
      await connection.execute(
        `INSERT INTO notifications (user_id, type, title, content) VALUES ${notiPh}`,
        notiVals
      );

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
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

    if (refunds.length > 0) {
      const orderIds = refunds.map(r => r.order_id);
      const ph = orderIds.map(() => '?').join(',');
      const [allItems] = await db.execute(
        `SELECT oi.*, p.name, p.image_url FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id IN (${ph})`,
        orderIds
      );
      const itemsMap = new Map();
      for (const item of allItems) {
        if (!itemsMap.has(item.order_id)) itemsMap.set(item.order_id, []);
        itemsMap.get(item.order_id).push(item);
      }
      for (const refund of refunds) {
        refund.items = itemsMap.get(refund.order_id) || [];
      }
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
              COALESCE(rv.cnt, 0) AS review_count,
              COALESCE(rf.cnt, 0) AS refund_count,
              COALESCE(wc.cnt, 0) AS warning_count,
              sp.type AS suspension_type,
              sp.suspended_until
       FROM users u
       LEFT JOIN (SELECT user_id, COUNT(*) AS cnt FROM reviews GROUP BY user_id) rv ON rv.user_id = u.id
       LEFT JOIN (SELECT user_id, COUNT(*) AS cnt FROM refunds GROUP BY user_id) rf ON rf.user_id = u.id
       LEFT JOIN (SELECT user_id, COUNT(*) AS cnt FROM user_penalties WHERE type = 'warning' AND is_active = true GROUP BY user_id) wc ON wc.user_id = u.id
       LEFT JOIN (
         SELECT p1.user_id, p1.type, p1.suspended_until
         FROM user_penalties p1
         INNER JOIN (
           SELECT user_id, MAX(created_at) AS max_created
           FROM user_penalties
           WHERE is_active = true AND type != 'warning'
             AND (suspended_until IS NULL OR suspended_until > NOW())
           GROUP BY user_id
         ) p2 ON p1.user_id = p2.user_id AND p1.created_at = p2.max_created
         WHERE p1.is_active = true AND p1.type != 'warning'
       ) sp ON sp.user_id = u.id
       WHERE u.role != 'admin'
         AND (rv.cnt > 0 OR rf.cnt > 0 OR EXISTS (SELECT 1 FROM user_penalties WHERE user_id = u.id))
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

// 환불 승인/거부 — 트랜잭션: 승인 시 주문 상태 환불완료 + 포인트 환불, 거부 시 수령완료로 복원
exports.processRefund = async (req, res) => {
  const { id } = req.params;
  const { action, admin_note } = req.body;

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ message: '유효하지 않은 처리입니다.' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [refunds] = await connection.execute('SELECT * FROM refunds WHERE id = ? FOR UPDATE', [id]);
    if (refunds.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: '환불 요청을 찾을 수 없습니다.' });
    }

    const refund = refunds[0];
    if (refund.status !== 'requested') {
      await connection.rollback();
      return res.status(400).json({ message: '이미 처리된 환불 요청입니다.' });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await connection.execute(
      'UPDATE refunds SET status = ?, admin_note = ?, processed_at = NOW() WHERE id = ?',
      [newStatus, admin_note || null, id]
    );

    if (action === 'approve') {
      // 주문 행 잠금 후 상태 변경 (동시 상태 변경 방지)
      const [orderRows] = await connection.execute(
        'SELECT * FROM orders WHERE id = ? FOR UPDATE',
        [refund.order_id]
      );

      if (orderRows.length === 0 || orderRows[0].status === 'refunded') {
        await connection.rollback();
        return res.status(400).json({ message: '이미 환불 처리된 주문입니다.' });
      }

      await connection.execute(
        'UPDATE orders SET status = ? WHERE id = ?',
        ['refunded', refund.order_id]
      );
      const order = orderRows[0];

      // 포인트 환불
      const pointsUsed = order?.points_used || 0;
      if (pointsUsed > 0) {
        await connection.execute(
          'UPDATE users SET points = LEAST(points + ?, 9999999) WHERE id = ?',
          [pointsUsed, refund.user_id]
        );
      }

      // 쿠폰 복원
      if (order?.coupon_id) {
        await connection.execute(
          'UPDATE user_coupons SET is_used = false, used_at = NULL WHERE user_id = ? AND coupon_id = ?',
          [refund.user_id, order.coupon_id]
        );
        await connection.execute(
          'UPDATE coupons SET current_uses = GREATEST(current_uses - 1, 0) WHERE id = ?',
          [order.coupon_id]
        );
      }

      // 재고 복원 — 배치 UPDATE (CASE 패턴)
      const [orderItems] = await connection.execute(
        'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
        [refund.order_id]
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
        [refund.order_id]
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
    } else {
      await connection.execute(
        'UPDATE orders SET status = ? WHERE id = ?',
        ['completed', refund.order_id]
      );
    }

    const title = action === 'approve'
      ? '환불이 승인되었습니다.'
      : '환불 요청이 거부되었습니다.';
    const content = admin_note || (action === 'approve' ? '환불 처리가 완료되었습니다.' : '환불 요청이 거부되었습니다.');

    await connection.execute(
      `INSERT INTO notifications (user_id, type, title, content)
       VALUES (?, 'system', ?, ?)`,
      [refund.user_id, title, content]
    );

    await connection.commit();
    res.json({ message: action === 'approve' ? '환불이 승인되었습니다.' : '환불이 거부되었습니다.' });
  } catch (error) {
    await connection.rollback();
    console.error('Admin process refund error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    connection.release();
  }
};
