const db = require('../config/db');

/**
 * 상품 컨트롤러
 * - 상품 목록: 검색어 + 카테고리 필터링
 * - 상품 상세: 옵션 그룹 + 옵션 값 배치 조회
 * - 상품 등록: 기본 정보 + 옵션(옵션명, 값, 추가금액) 저장
 * - 옵션 추가/삭제: 본인 상품만 가능
 * - 상품 삭제: 본인 상품만 가능 (관리자 삭제는 adminController)
 */

// 상품 목록 조회 — 검색어 + 카테고리 필터링
exports.getAllProducts = async (req, res) => {
  try {
    const { search, category } = req.query;
    let sql = 'SELECT * FROM products WHERE is_active = true';
    const params = [];

    if (search) {
      const escaped = search.replace(/[%_\\]/g, '\\$&');
      sql += ' AND name LIKE ?';
      params.push(`%${escaped}%`);
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
      "SELECT DISTINCT category FROM products WHERE category != '' AND is_active = true ORDER BY category"
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
    const [products] = await db.execute('SELECT * FROM products WHERE id = ? AND is_active = true', [id]);

    if (products.length === 0) {
      return res.status(404).json({ message: '상품을 찾을 수 없습니다.' });
    }

    const product = products[0];

    // 옵션 그룹 + 값을 한 번에 조회
    const [options] = await db.execute(
      'SELECT * FROM product_options WHERE product_id = ? ORDER BY id', [id]
    );
    if (options.length > 0) {
      const optIds = options.map(o => o.id);
      const ph = optIds.map(() => '?').join(',');
      const [allValues] = await db.execute(
        `SELECT * FROM product_option_values WHERE option_id IN (${ph}) ORDER BY id`, optIds
      );
      const valMap = new Map();
      for (const v of allValues) {
        if (!valMap.has(v.option_id)) valMap.set(v.option_id, []);
        valMap.get(v.option_id).push(v);
      }
      for (const opt of options) opt.values = valMap.get(opt.id) || [];
    }
    product.options = options;
    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 상품 등록 (트랜잭션)
exports.createProduct = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { name, description, price, category, image_url, stock } = req.body;

    if (!name || price === undefined || price === null) {
      await connection.rollback();
      return res.status(400).json({ message: '상품명과 가격은 필수입니다.' });
    }

    if (!Number.isInteger(Number(price)) || Number(price) < 0) {
      await connection.rollback();
      return res.status(400).json({ message: '가격은 0 이상의 정수여야 합니다.' });
    }

    const parsedStock = Number(stock) || 0;
    if (!Number.isInteger(parsedStock) || parsedStock < 0) {
      await connection.rollback();
      return res.status(400).json({ message: '재고는 0 이상의 정수여야 합니다.' });
    }

    const [result] = await connection.execute(
      'INSERT INTO products (user_id, name, description, price, category, image_url, stock) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.userId, name, description || '', Number(price), category || '', image_url || '', parsedStock]
    );

    const productId = result.insertId;

    // 옵션 저장
    const { options } = req.body;
    if (options && Array.isArray(options)) {
      for (const option of options) {
        const [optResult] = await connection.execute(
          'INSERT INTO product_options (product_id, option_name) VALUES (?, ?)',
          [productId, option.option_name]
        );
        const optionId = optResult.insertId;
        if (option.values && Array.isArray(option.values)) {
          for (const val of option.values) {
            await connection.execute(
              'INSERT INTO product_option_values (option_id, value, extra_price, stock) VALUES (?, ?, ?, ?)',
              [optionId, val.value, val.extra_price || 0, val.stock || 0]
            );
          }
        }
      }
    }

    await connection.commit();
    res.status(201).json({ message: '상품이 등록되었습니다.', productId });
  } catch (error) {
    await connection.rollback();
    console.error('Create product error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    connection.release();
  }
};

// 상품에 옵션 추가 (트랜잭션)
exports.addProductOption = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { option_name, values } = req.body;

    const [products] = await connection.execute('SELECT user_id FROM products WHERE id = ?', [id]);
    if (products.length === 0) { await connection.rollback(); return res.status(404).json({ message: '상품을 찾을 수 없습니다.' }); }
    if (products[0].user_id !== req.user.userId) { await connection.rollback(); return res.status(403).json({ message: '본인 상품만 수정할 수 있습니다.' }); }

    const [optResult] = await connection.execute(
      'INSERT INTO product_options (product_id, option_name) VALUES (?, ?)',
      [id, option_name]
    );
    const optionId = optResult.insertId;

    if (values && Array.isArray(values)) {
      for (const val of values) {
        await connection.execute(
          'INSERT INTO product_option_values (option_id, value, extra_price, stock) VALUES (?, ?, ?, ?)',
          [optionId, val.value, val.extra_price || 0, val.stock || 0]
        );
      }
    }

    await connection.commit();
    res.status(201).json({ message: '옵션이 추가되었습니다.', optionId });
  } catch (error) {
    await connection.rollback();
    console.error('Add product option error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    connection.release();
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

    if (products[0].user_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: '삭제 권한이 없습니다.' });
    }

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

    await db.execute('DELETE FROM products WHERE id = ?', [id]);
    res.json({ message: '상품이 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};
