const db = require('../config/db');

// 주문 생성 (장바구니 → 주문)
exports.createOrder = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 장바구니 상품 조회
    const [cartItems] = await connection.execute(
      `SELECT c.id, c.quantity, c.product_id, p.price, p.stock
       FROM cart_items c
       JOIN products p ON c.product_id = p.id
       WHERE c.user_id = ?`,
      [req.user.userId]
    );

    if (cartItems.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: '장바구니가 비어있습니다.' });
    }

    // 총 금액 계산
    const totalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // 주문 생성
    const [orderResult] = await connection.execute(
      'INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, ?)',
      [req.user.userId, totalAmount, 'completed']
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

    // 장바구니 비우기
    await connection.execute(
      'DELETE FROM cart_items WHERE user_id = ?',
      [req.user.userId]
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
