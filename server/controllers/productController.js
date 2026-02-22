const db = require('../config/db');

// 모든 상품 조회
exports.getAllProducts = async (req, res) => {
  try {
    const [products] = await db.execute('SELECT * FROM products ORDER BY created_at DESC');
    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 특정 상품 조회
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const [products] = await db.execute('SELECT * FROM products WHERE id = ?', [id]);

    if (products.length === 0) {
      return res.status(404).json({ message: '상품을 찾을 수 없습니다.' });
    }

    res.json(products[0]);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 상품 등록
exports.createProduct = async (req, res) => {
  try {
    const { name, description, price, category, image_url, stock } = req.body;

    if (!name || !price) {
      return res.status(400).json({ message: '상품명과 가격은 필수입니다.' });
    }

    const [result] = await db.execute(
      'INSERT INTO products (name, description, price, category, image_url, stock) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || '', price, category || '', image_url || '', stock || 0]
    );

    res.status(201).json({ message: '상품이 등록되었습니다.', productId: result.insertId });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};
