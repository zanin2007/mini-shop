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

    const validStatuses = ['pending', 'shipped', 'delivered', 'completed'];
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
