const db = require('../config/db');

/**
 * 주문 컨트롤러
 * - 주문 생성: 장바구니 → 재고검증 → 쿠폰/포인트 할인 → 주문 생성 → 선물 처리 (트랜잭션)
 * - 구매 확정: 배송완료 → 수령완료 상태 변경
 * - 상태 변경: [테스트용] checking → pending → shipped → delivered → completed 순차 진행
 * - 주문 조회: 주문 상품 + 옵션 + 선물 여부를 배치 쿼리로 조회
 */

// 주문 생성 — 장바구니 선택 상품을 주문으로 전환 (트랜잭션)
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

    // 배치 쿼리: 모든 장바구니 아이템의 옵션 추가금액을 한 번에 조회
    const cartIds = cartItems.map(item => item.id);
    const [allCartOpts] = await connection.execute(
      `SELECT cio.cart_item_id, pov.extra_price FROM cart_item_options cio
       JOIN product_option_values pov ON cio.option_value_id = pov.id
       WHERE cio.cart_item_id IN (${cartIds.map(() => '?').join(',')})`,
      cartIds
    );
    const extraPriceMap = new Map();
    for (const opt of allCartOpts) {
      extraPriceMap.set(opt.cart_item_id, (extraPriceMap.get(opt.cart_item_id) || 0) + opt.extra_price);
    }
    for (const item of cartItems) {
      item.extraPrice = extraPriceMap.get(item.id) || 0;
    }

    // 총 금액 계산 (옵션 추가금액 포함)
    const totalAmount = cartItems.reduce((sum, item) => sum + (item.price + item.extraPrice) * item.quantity, 0);

    // 쿠폰 적용 — 유효성 확인 후 할인율/정액 중 큰 값 적용, 사용처리
    let discountAmount = 0;
    let couponId = null;
    const { couponId: requestedCouponId, pointsToUse: requestedPoints, delivery_address, receiver_name, receiver_phone, isGift, receiverId, giftMessage } = req.body || {};

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

    let finalAmount = totalAmount - discountAmount;

    // 포인트 적용 — 보유 포인트 검증 후 결제금액에서 차감
    let pointsUsed = 0;
    if (requestedPoints && requestedPoints > 0) {
      const [userRows] = await connection.execute(
        'SELECT points FROM users WHERE id = ?',
        [req.user.userId]
      );
      const userPoints = userRows[0]?.points || 0;
      if (requestedPoints > userPoints) {
        await connection.rollback();
        return res.status(400).json({ message: '보유 포인트가 부족합니다.' });
      }
      pointsUsed = Math.min(requestedPoints, finalAmount);
      finalAmount -= pointsUsed;

      // 포인트 차감
      await connection.execute(
        'UPDATE users SET points = points - ? WHERE id = ?',
        [pointsUsed, req.user.userId]
      );
    }

    // 주문 생성
    const [orderResult] = await connection.execute(
      'INSERT INTO orders (user_id, total_amount, discount_amount, final_amount, coupon_id, points_used, delivery_address, receiver_name, receiver_phone, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.userId, totalAmount, discountAmount, finalAmount, couponId, pointsUsed, delivery_address || '', receiver_name || '', receiver_phone || '', 'checking']
    );

    const orderId = orderResult.insertId;

    // 모든 장바구니 옵션을 한 번에 조회
    const [allOptsForCopy] = await connection.execute(
      `SELECT cart_item_id, option_value_id FROM cart_item_options
       WHERE cart_item_id IN (${cartIds.map(() => '?').join(',')})`,
      cartIds
    );
    const optsMap = new Map();
    for (const opt of allOptsForCopy) {
      if (!optsMap.has(opt.cart_item_id)) optsMap.set(opt.cart_item_id, []);
      optsMap.get(opt.cart_item_id).push(opt.option_value_id);
    }

    // 배치 INSERT: 주문 상품 + 옵션 일괄 추가, 재고 병렬 감소
    if (cartItems.length > 0) {
      const oiValues = cartItems.map(item => `(${orderId}, ${item.product_id}, ${item.quantity}, ${item.price + item.extraPrice})`).join(',');
      const [oiResult] = await connection.execute(
        `INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ${oiValues}`
      );
      const firstOiId = oiResult.insertId;

      // 옵션 일괄 복사
      const optRows = [];
      for (let i = 0; i < cartItems.length; i++) {
        const orderItemId = firstOiId + i;
        const opts = optsMap.get(cartItems[i].id) || [];
        for (const ovId of opts) {
          optRows.push(`(${orderItemId}, ${ovId})`);
        }
      }
      if (optRows.length > 0) {
        await connection.execute(
          `INSERT INTO order_item_options (order_item_id, option_value_id) VALUES ${optRows.join(',')}`
        );
      }

      // 재고 일괄 감소
      const stockUpdates = cartItems.map(item =>
        connection.execute('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.product_id])
      );
      await Promise.all(stockUpdates);
    }

    // 주문된 상품만 장바구니에서 삭제
    await connection.execute(
      `DELETE FROM cart_items WHERE id IN (${cartIds.map(() => '?').join(',')})`,
      cartIds
    );

    // 선물 처리 — gifts 테이블에 기록 + 받는 사람에게 알림 발송
    if (isGift && receiverId) {
      await connection.execute(
        `INSERT INTO gifts (order_id, sender_id, receiver_id, receiver_name, receiver_phone, message, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [orderId, req.user.userId, receiverId, receiver_name || '', receiver_phone || '', giftMessage || '']
      );

      // 받는 사람에게 알림
      const [senderInfo] = await connection.execute('SELECT nickname FROM users WHERE id = ?', [req.user.userId]);
      const senderName = senderInfo[0]?.nickname || '누군가';
      await connection.execute(
        `INSERT INTO notifications (user_id, type, title, content, link) VALUES (?, 'gift', ?, ?, '/mypage')`,
        [receiverId, `${senderName}님이 선물을 보냈습니다!`, giftMessage || '선물이 도착했습니다.']
      );
    }

    await connection.commit();
    res.status(201).json({ message: isGift ? '선물 주문이 완료되었습니다.' : '주문이 완료되었습니다.', orderId });
  } catch (error) {
    await connection.rollback();
    console.error('Create order error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    connection.release();
  }
};

// 구매 확정 — 배송완료(delivered) 상태의 주문을 수령완료(completed)로 변경
exports.confirmOrder = async (req, res) => {
  try {
    const [orders] = await db.execute(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.userId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ message: '주문을 찾을 수 없습니다.' });
    }

    if (orders[0].status !== 'delivered') {
      return res.status(400).json({ message: '배송 완료된 주문만 구매확정할 수 있습니다.' });
    }

    await db.execute(
      'UPDATE orders SET status = ?, completed_at = NOW() WHERE id = ?',
      ['completed', req.params.id]
    );

    res.json({ message: '구매가 확정되었습니다.' });
  } catch (error) {
    console.error('Confirm order error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// [테스트용] 주문 상태 다음 단계로 변경
exports.advanceOrderStatus = async (req, res) => {
  try {
    const [orders] = await db.execute(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.userId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ message: '주문을 찾을 수 없습니다.' });
    }

    const statusFlow = ['checking', 'pending', 'shipped', 'delivered', 'completed'];
    const currentIdx = statusFlow.indexOf(orders[0].status);

    if (currentIdx === -1 || currentIdx >= statusFlow.length - 1) {
      return res.status(400).json({ message: '더 이상 변경할 수 없는 상태입니다.' });
    }

    const nextStatus = statusFlow[currentIdx + 1];
    const extra = nextStatus === 'completed' ? ', completed_at = NOW()' : '';

    await db.execute(
      `UPDATE orders SET status = ?${extra} WHERE id = ?`,
      [nextStatus, req.params.id]
    );

    res.json({ message: `상태가 '${nextStatus}'로 변경되었습니다.`, status: nextStatus });
  } catch (error) {
    console.error('Advance order status error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 주문 내역 조회 — 배치 쿼리로 주문 상품/옵션/선물 여부를 한 번에 조회 후 메모리 조합
exports.getOrders = async (req, res) => {
  try {
    const [orders] = await db.execute(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.userId]
    );

    if (orders.length === 0) return res.json([]);

    const orderIds = orders.map(o => o.id);
    const placeholders = orderIds.map(() => '?').join(',');

    // 모든 주문 상품을 한 번에 조회
    const [allItems] = await db.execute(
      `SELECT oi.*, p.name, p.image_url
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id IN (${placeholders})`,
      orderIds
    );

    // 모든 주문 상품 옵션을 한 번에 조회
    const itemIds = allItems.map(i => i.id);
    let allOpts = [];
    if (itemIds.length > 0) {
      const itemPlaceholders = itemIds.map(() => '?').join(',');
      [allOpts] = await db.execute(
        `SELECT oio.order_item_id, oio.option_value_id, pov.value, pov.extra_price, po.option_name
         FROM order_item_options oio
         JOIN product_option_values pov ON oio.option_value_id = pov.id
         JOIN product_options po ON pov.option_id = po.id
         WHERE oio.order_item_id IN (${itemPlaceholders})`,
        itemIds
      );
    }

    // 메모리에서 조합
    const optsMap = new Map();
    for (const opt of allOpts) {
      if (!optsMap.has(opt.order_item_id)) optsMap.set(opt.order_item_id, []);
      optsMap.get(opt.order_item_id).push(opt);
    }
    const itemsMap = new Map();
    for (const item of allItems) {
      item.options = optsMap.get(item.id) || [];
      if (!itemsMap.has(item.order_id)) itemsMap.set(item.order_id, []);
      itemsMap.get(item.order_id).push(item);
    }
    // 선물 주문 여부 확인
    const [giftRows] = await db.execute(
      `SELECT order_id FROM gifts WHERE order_id IN (${placeholders})`,
      orderIds
    );
    const giftOrderIds = new Set(giftRows.map(g => g.order_id));

    for (const order of orders) {
      order.items = itemsMap.get(order.id) || [];
      order.is_gift = giftOrderIds.has(order.id);
    }

    res.json(orders);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};
