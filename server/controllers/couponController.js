const db = require('../config/db');

// 내 쿠폰 목록 조회
exports.getUserCoupons = async (req, res) => {
  try {
    const [coupons] = await db.execute(
      `SELECT uc.id, uc.is_used, uc.used_at, uc.created_at AS claimed_at,
              c.id AS coupon_id, c.code, c.discount_amount, c.discount_percentage,
              c.min_price, c.expiry_date, c.is_active
       FROM user_coupons uc
       JOIN coupons c ON uc.coupon_id = c.id
       WHERE uc.user_id = ?
       ORDER BY uc.is_used ASC, c.expiry_date ASC`,
      [req.user.userId]
    );
    res.json(coupons);
  } catch (error) {
    console.error('Get user coupons error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 쿠폰 코드로 쿠폰 등록
exports.claimCoupon = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ message: '쿠폰 코드를 입력해주세요.' });
    }

    // 쿠폰 존재 확인
    const [coupons] = await db.execute(
      'SELECT * FROM coupons WHERE code = ? AND is_active = true',
      [code]
    );

    if (coupons.length === 0) {
      return res.status(404).json({ message: '유효하지 않은 쿠폰 코드입니다.' });
    }

    const coupon = coupons[0];

    // 만료 확인
    if (new Date(coupon.expiry_date) < new Date()) {
      return res.status(400).json({ message: '만료된 쿠폰입니다.' });
    }

    // 사용 횟수 제한 확인
    if (coupon.max_uses !== null && coupon.current_uses >= coupon.max_uses) {
      return res.status(400).json({ message: '쿠폰 사용 횟수가 초과되었습니다.' });
    }

    // 이미 보유 확인
    const [existing] = await db.execute(
      'SELECT id FROM user_coupons WHERE user_id = ? AND coupon_id = ?',
      [req.user.userId, coupon.id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: '이미 보유한 쿠폰입니다.' });
    }

    // 쿠폰 등록
    await db.execute(
      'INSERT INTO user_coupons (user_id, coupon_id) VALUES (?, ?)',
      [req.user.userId, coupon.id]
    );

    // 사용 횟수 증가
    await db.execute(
      'UPDATE coupons SET current_uses = current_uses + 1 WHERE id = ?',
      [coupon.id]
    );

    res.status(201).json({ message: '쿠폰이 등록되었습니다.' });
  } catch (error) {
    console.error('Claim coupon error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 사용 가능한 쿠폰 목록 (주문 시 적용 가능)
exports.getAvailableCoupons = async (req, res) => {
  try {
    const { totalAmount } = req.query;
    const amount = Number(totalAmount) || 0;

    const [coupons] = await db.execute(
      `SELECT uc.id AS user_coupon_id, c.id AS coupon_id, c.code,
              c.discount_amount, c.discount_percentage, c.min_price, c.expiry_date
       FROM user_coupons uc
       JOIN coupons c ON uc.coupon_id = c.id
       WHERE uc.user_id = ? AND uc.is_used = false
         AND c.is_active = true AND c.expiry_date > NOW()
       ORDER BY c.discount_amount DESC, c.discount_percentage DESC`,
      [req.user.userId]
    );

    // 최소 금액 조건 필터링 및 할인 금액 계산
    const available = coupons
      .filter(c => !c.min_price || amount >= c.min_price)
      .map(c => {
        let discount = 0;
        if (c.discount_percentage) {
          discount = Math.floor(amount * c.discount_percentage / 100);
        }
        if (c.discount_amount) {
          discount = Math.max(discount, c.discount_amount);
        }
        return { ...c, calculated_discount: Math.min(discount, amount) };
      });

    res.json(available);
  } catch (error) {
    console.error('Get available coupons error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};
