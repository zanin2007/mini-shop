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

// 특정 상품 조회 (옵션 포함)
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const [products] = await db.execute('SELECT * FROM products WHERE id = ?', [id]);

    if (products.length === 0) {
      return res.status(404).json({ message: '상품을 찾을 수 없습니다.' });
    }

    const product = products[0];

    // 옵션 그룹 조회
    const [options] = await db.execute(
      'SELECT * FROM product_options WHERE product_id = ? ORDER BY id',
      [id]
    );

    // 각 옵션 그룹의 값 조회
    for (const option of options) {
      const [values] = await db.execute(
        'SELECT * FROM product_option_values WHERE option_id = ? ORDER BY id',
        [option.id]
      );
      option.values = values;
    }

    product.options = options;
    res.json(product);
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

    const productId = result.insertId;

    // 옵션 저장
    const { options } = req.body;
    if (options && Array.isArray(options)) {
      for (const option of options) {
        const [optResult] = await db.execute(
          'INSERT INTO product_options (product_id, option_name) VALUES (?, ?)',
          [productId, option.option_name]
        );
        const optionId = optResult.insertId;
        if (option.values && Array.isArray(option.values)) {
          for (const val of option.values) {
            await db.execute(
              'INSERT INTO product_option_values (option_id, value, extra_price, stock) VALUES (?, ?, ?, ?)',
              [optionId, val.value, val.extra_price || 0, val.stock || 0]
            );
          }
        }
      }
    }

    res.status(201).json({ message: '상품이 등록되었습니다.', productId });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 상품에 옵션 추가
exports.addProductOption = async (req, res) => {
  try {
    const { id } = req.params;
    const { option_name, values } = req.body;

    const [products] = await db.execute('SELECT user_id FROM products WHERE id = ?', [id]);
    if (products.length === 0) return res.status(404).json({ message: '상품을 찾을 수 없습니다.' });
    if (products[0].user_id !== req.user.userId) return res.status(403).json({ message: '본인 상품만 수정할 수 있습니다.' });

    const [optResult] = await db.execute(
      'INSERT INTO product_options (product_id, option_name) VALUES (?, ?)',
      [id, option_name]
    );
    const optionId = optResult.insertId;

    if (values && Array.isArray(values)) {
      for (const val of values) {
        await db.execute(
          'INSERT INTO product_option_values (option_id, value, extra_price, stock) VALUES (?, ?, ?, ?)',
          [optionId, val.value, val.extra_price || 0, val.stock || 0]
        );
      }
    }

    res.status(201).json({ message: '옵션이 추가되었습니다.', optionId });
  } catch (error) {
    console.error('Add product option error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 옵션 삭제
exports.deleteProductOption = async (req, res) => {
  try {
    const { optionId } = req.params;

    const [options] = await db.execute(
      `SELECT po.id, p.user_id FROM product_options po
       JOIN products p ON po.product_id = p.id
       WHERE po.id = ?`,
      [optionId]
    );
    if (options.length === 0) return res.status(404).json({ message: '옵션을 찾을 수 없습니다.' });
    if (options[0].user_id !== req.user.userId) return res.status(403).json({ message: '본인 상품만 수정할 수 있습니다.' });

    await db.execute('DELETE FROM product_options WHERE id = ?', [optionId]);
    res.json({ message: '옵션이 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete product option error:', error);
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
