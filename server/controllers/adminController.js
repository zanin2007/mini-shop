const db = require('../config/db');

// 전체 주문 목록 조회
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

// 주문 상태 변경
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['checking', 'pending', 'shipped', 'delivered', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: '유효하지 않은 상태입니다.' });
    }

    const [orders] = await db.execute('SELECT id FROM orders WHERE id = ?', [id]);
    if (orders.length === 0) {
      return res.status(404).json({ message: '주문을 찾을 수 없습니다.' });
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

// 쿠폰 생성
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

// 쿠폰 전체 배포
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

// 공지 작성
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, content, is_pinned } = req.body;
    if (!title || !content) {
      return res.status(400).json({ message: '제목과 내용을 입력해주세요.' });
    }

    await db.execute(
      'INSERT INTO announcements (admin_id, title, content, is_pinned) VALUES (?, ?, ?, ?)',
      [req.user.userId, title, content, is_pinned || false]
    );

    // 전체 유저에게 알림
    const [users] = await db.execute('SELECT id FROM users');
    for (const user of users) {
      await db.execute(
        `INSERT INTO notifications (user_id, type, title, content)
         VALUES (?, 'system', ?, ?)`,
        [user.id, `📢 ${title}`, content.substring(0, 100)]
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

// 공지 삭제
exports.deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM announcements WHERE id = ?', [id]);
    res.json({ message: '공지가 삭제되었습니다.' });
  } catch (error) {
    console.error('Admin delete announcement error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// ===== 이벤트 =====

// 이벤트 생성
exports.createEvent = async (req, res) => {
  try {
    const { title, description, type, reward_type, reward_id, reward_amount, max_participants, start_date, end_date } = req.body;
    if (!title || !start_date || !end_date) {
      return res.status(400).json({ message: '제목과 기간은 필수입니다.' });
    }

    await db.execute(
      `INSERT INTO events (title, description, type, reward_type, reward_id, reward_amount, max_participants, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description || null, type || 'fcfs', reward_type || null, reward_id || null, reward_amount || null, max_participants || null, start_date, end_date]
    );

    // 전체 유저에게 알림
    const [users] = await db.execute('SELECT id FROM users');
    for (const user of users) {
      await db.execute(
        `INSERT INTO notifications (user_id, type, title, content)
         VALUES (?, 'system', ?, ?)`,
        [user.id, `🎉 새 이벤트: ${title}`, description ? description.substring(0, 100) : '새로운 이벤트가 시작되었습니다!']
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

// 이벤트 추첨
exports.drawEventWinners = async (req, res) => {
  try {
    const { id } = req.params;
    const { winner_count } = req.body;

    const [events] = await db.execute('SELECT * FROM events WHERE id = ?', [id]);
    if (events.length === 0) {
      return res.status(404).json({ message: '이벤트를 찾을 수 없습니다.' });
    }
    const event = events[0];

    const [participants] = await db.execute(
      'SELECT * FROM event_participants WHERE event_id = ? AND is_winner = false ORDER BY RAND() LIMIT ?',
      [id, winner_count || 1]
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
