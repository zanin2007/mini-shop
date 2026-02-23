const db = require('../config/db');

// 상품 조회 (검색 + 카테고리 필터)
exports.getAllProducts = async (req, res) => {
  try {
    const { search, category } = req.query;
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND name LIKE ?';
      params.push(`%${search}%`);
    }

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY created_at DESC';

    const [products] = await db.execute(sql, params);
    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 카테고리 목록 조회
exports.getCategories = async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT DISTINCT category FROM products WHERE category != '' ORDER BY category"
    );
    const categories = rows.map(row => row.category);
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
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
      'INSERT INTO products (user_id, name, description, price, category, image_url, stock) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.userId, name, description || '', price, category || '', image_url || '', stock || 0]
    );

    res.status(201).json({ message: '상품이 등록되었습니다.', productId: result.insertId });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 상품 삭제 (본인만 가능)
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const [products] = await db.execute('SELECT * FROM products WHERE id = ?', [id]);
    if (products.length === 0) {
      return res.status(404).json({ message: '상품을 찾을 수 없습니다.' });
    }

    if (products[0].user_id !== req.user.userId) {
      return res.status(403).json({ message: '본인이 등록한 상품만 삭제할 수 있습니다.' });
    }

    await db.execute('DELETE FROM products WHERE id = ?', [id]);
    res.json({ message: '상품이 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};
