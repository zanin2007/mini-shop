const db = require('../config/db');

// 주문 생성 (장바구니 → 주문)
exports.createOrder = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 선택된 장바구니 상품 조회
    const [cartItems] = await connection.execute(
      `SELECT c.id, c.quantity, c.product_id, p.name, p.price, p.stock
       FROM cart_items c
       JOIN products p ON c.product_id = p.id
       WHERE c.user_id = ? AND c.is_selected = true`,
      [req.user.userId]
    );

    if (cartItems.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: '선택된 상품이 없습니다.' });
    }

    // 재고 검증
    for (const item of cartItems) {
      if (item.stock < item.quantity) {
        await connection.rollback();
        return res.status(400).json({
          message: `'${item.name}' 상품의 재고가 부족합니다. (재고: ${item.stock}개, 요청: ${item.quantity}개)`
        });
      }
    }

    // 총 금액 계산
    const totalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // 쿠폰 적용
    let discountAmount = 0;
    let couponId = null;
    const { couponId: requestedCouponId, delivery_address, receiver_name, receiver_phone } = req.body || {};

    if (requestedCouponId) {
      const [userCoupons] = await connection.execute(
        `SELECT uc.id, uc.coupon_id, c.discount_amount, c.discount_percentage, c.min_price, c.expiry_date, c.is_active
         FROM user_coupons uc
         JOIN coupons c ON uc.coupon_id = c.id
         WHERE uc.id = ? AND uc.user_id = ? AND uc.is_used = false`,
        [requestedCouponId, req.user.userId]
      );

      if (userCoupons.length > 0) {
        const uc = userCoupons[0];
        if (uc.is_active && new Date(uc.expiry_date) > new Date()) {
          if (!uc.min_price || totalAmount >= uc.min_price) {
            if (uc.discount_percentage) {
              discountAmount = Math.floor(totalAmount * uc.discount_percentage / 100);
            }
            if (uc.discount_amount && uc.discount_amount > discountAmount) {
              discountAmount = uc.discount_amount;
            }
            discountAmount = Math.min(discountAmount, totalAmount);
            couponId = uc.coupon_id;

            // 쿠폰 사용 처리
            await connection.execute(
              'UPDATE user_coupons SET is_used = true, used_at = NOW() WHERE id = ?',
              [requestedCouponId]
            );
          }
        }
      }
    }

    const finalAmount = totalAmount - discountAmount;

    // 주문 생성
    const [orderResult] = await connection.execute(
      'INSERT INTO orders (user_id, total_amount, discount_amount, final_amount, coupon_id, delivery_address, receiver_name, receiver_phone, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.userId, totalAmount, discountAmount, finalAmount, couponId, delivery_address || '', receiver_name || '', receiver_phone || '', 'pending']
    );

    const orderId = orderResult.insertId;

    // 주문 상품 추가 및 재고 감소
    for (const item of cartItems) {
      await connection.execute(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [orderId, item.product_id, item.quantity, item.price]
      );

      await connection.execute(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    // 주문된 상품만 장바구니에서 삭제
    const cartIds = cartItems.map(item => item.id);
    await connection.execute(
      `DELETE FROM cart_items WHERE id IN (${cartIds.map(() => '?').join(',')})`,
      cartIds
    );

    await connection.commit();
    res.status(201).json({ message: '주문이 완료되었습니다.', orderId });
  } catch (error) {
    await connection.rollback();
    console.error('Create order error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    connection.release();
  }
};

// 주문 내역 조회
exports.getOrders = async (req, res) => {
  try {
    const [orders] = await db.execute(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.userId]
    );

    // 각 주문의 상품 정보도 함께 조회
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
    console.error('Get orders error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};
