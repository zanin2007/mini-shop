const mysql = require('mysql2/promise');
require('dotenv').config();

async function initializeDatabase() {
  const connConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  };
  if (process.env.DB_SSL === 'true') {
    connConfig.ssl = { rejectUnauthorized: false };
  }
  const connection = await mysql.createConnection(connConfig);

  // 데이터베이스 생성
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await connection.changeUser({ database: process.env.DB_NAME });
  console.log(`Database '${process.env.DB_NAME}' 확인 완료`);

  // 레거시 테이블 정리
  await connection.query(`DROP TABLE IF EXISTS messages`);

  // 모든 테이블 일괄 생성 (FK 의존성 순서 준수)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      nickname VARCHAR(100) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      points INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      discount_amount INT NOT NULL DEFAULT 0,
      discount_percentage INT DEFAULT NULL,
      min_price INT DEFAULT NULL,
      expiry_date DATETIME NOT NULL,
      max_uses INT DEFAULT NULL,
      current_uses INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      type VARCHAR(50) NOT NULL DEFAULT 'fcfs',
      reward_type VARCHAR(50) DEFAULT NULL,
      reward_id INT DEFAULT NULL,
      reward_amount INT DEFAULT NULL,
      max_participants INT DEFAULT NULL,
      start_date DATETIME NOT NULL,
      end_date DATETIME NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price INT NOT NULL,
      stock INT NOT NULL DEFAULT 0,
      image_url VARCHAR(500),
      category VARCHAR(100),
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS user_coupons (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      coupon_id INT NOT NULL,
      is_used BOOLEAN NOT NULL DEFAULT false,
      used_at DATETIME DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_coupon (user_id, coupon_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      total_amount INT NOT NULL,
      discount_amount INT NOT NULL DEFAULT 0,
      final_amount INT NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      delivery_address TEXT,
      receiver_name VARCHAR(100),
      receiver_phone VARCHAR(20),
      coupon_id INT DEFAULT NULL,
      points_used INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      content TEXT,
      is_read BOOLEAN NOT NULL DEFAULT false,
      is_pinned BOOLEAN NOT NULL DEFAULT false,
      link VARCHAR(500) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS mailbox (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      content TEXT,
      reward_type VARCHAR(50) DEFAULT NULL,
      reward_id INT DEFAULT NULL,
      reward_amount INT DEFAULT NULL,
      is_read BOOLEAN NOT NULL DEFAULT false,
      is_claimed BOOLEAN NOT NULL DEFAULT false,
      claimed_at DATETIME DEFAULT NULL,
      expires_at DATETIME DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      admin_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      is_pinned BOOLEAN NOT NULL DEFAULT false,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      is_selected BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT NOT NULL,
      price INT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      product_id INT NOT NULL,
      order_id INT NOT NULL,
      rating DECIMAL(2,1) NOT NULL,
      content TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_product (user_id, product_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS wishlists (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      product_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_wishlist (user_id, product_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS gifts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      sender_id INT NOT NULL,
      receiver_id INT DEFAULT NULL,
      receiver_name VARCHAR(100),
      receiver_phone VARCHAR(20),
      message TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      accepted_at DATETIME DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS event_participants (
      id INT AUTO_INCREMENT PRIMARY KEY,
      event_id INT NOT NULL,
      user_id INT NOT NULL,
      is_winner BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_event_user (event_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS product_options (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT NOT NULL,
      option_name VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS product_option_values (
      id INT AUTO_INCREMENT PRIMARY KEY,
      option_id INT NOT NULL,
      value VARCHAR(100) NOT NULL,
      extra_price INT NOT NULL DEFAULT 0,
      stock INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (option_id) REFERENCES product_options(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cart_item_options (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cart_item_id INT NOT NULL,
      option_value_id INT NOT NULL,
      FOREIGN KEY (cart_item_id) REFERENCES cart_items(id) ON DELETE CASCADE,
      FOREIGN KEY (option_value_id) REFERENCES product_option_values(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS order_item_options (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_item_id INT NOT NULL,
      option_value_id INT NOT NULL,
      FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
      FOREIGN KEY (option_value_id) REFERENCES product_option_values(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS refunds (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL UNIQUE,
      user_id INT NOT NULL,
      reason TEXT NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'requested',
      admin_note TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME DEFAULT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_penalties (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      type VARCHAR(20) NOT NULL,
      reason TEXT NOT NULL,
      admin_id INT NOT NULL,
      suspended_until DATETIME DEFAULT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  console.log('전체 테이블 확인 완료 (21개)');

  // 조건부 컬럼 추가 (기존 DB 호환)
  const safeAddColumn = async (table, column, definition) => {
    const [cols] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [process.env.DB_NAME, table, column]
    );
    if (cols.length === 0) {
      await connection.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  };

  // 인덱스 추가 (이미 존재하면 무시)
  const safeCreateIndex = async (sql) => { await connection.query(sql).catch(() => {}); };
  await safeCreateIndex('CREATE UNIQUE INDEX idx_users_nickname ON users(nickname)');
  await safeCreateIndex('CREATE INDEX idx_orders_user_status ON orders(user_id, status)');
  await safeCreateIndex('CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read)');
  await safeCreateIndex('CREATE INDEX idx_mailbox_user_read ON mailbox(user_id, is_read)');
  await safeCreateIndex('CREATE INDEX idx_cart_items_user ON cart_items(user_id)');
  await safeCreateIndex('CREATE INDEX idx_user_penalties_user_active ON user_penalties(user_id, is_active)');
  await safeCreateIndex('CREATE INDEX idx_orders_status ON orders(status)');
  await safeCreateIndex('CREATE INDEX idx_refunds_user ON refunds(user_id)');
  await safeCreateIndex('CREATE INDEX idx_refunds_order ON refunds(order_id)');
  await safeCreateIndex('CREATE INDEX idx_event_participants_event_winner ON event_participants(event_id, is_winner)');
  await safeCreateIndex('CREATE INDEX idx_mailbox_user_claimed ON mailbox(user_id, is_claimed)');
  // 상품 검색/필터링 성능 개선
  await safeCreateIndex('CREATE INDEX idx_products_active_category ON products(is_active, category)');
  await safeCreateIndex('CREATE INDEX idx_products_name ON products(name)');
  // 이벤트 기간 조회 성능 개선
  await safeCreateIndex('CREATE INDEX idx_events_active_dates ON events(is_active, start_date, end_date)');
  // 옵션 조회 성능 개선
  await safeCreateIndex('CREATE INDEX idx_product_options_product ON product_options(product_id)');
  await safeCreateIndex('CREATE INDEX idx_product_option_values_option ON product_option_values(option_id)');
  // 주문 아이템 배치 조회
  await safeCreateIndex('CREATE INDEX idx_order_items_order ON order_items(order_id)');
  await safeCreateIndex('CREATE INDEX idx_order_item_options_item ON order_item_options(order_item_id)');
  // 선물 조회 성능 개선
  await safeCreateIndex('CREATE INDEX idx_gifts_sender ON gifts(sender_id)');
  await safeCreateIndex('CREATE INDEX idx_gifts_receiver ON gifts(receiver_id)');
  // 쿠폰 배포 시 coupon_id 단독 조회 (UNIQUE(user_id, coupon_id)는 coupon_id 단독 검색 불가)
  await safeCreateIndex('CREATE INDEX idx_user_coupons_coupon ON user_coupons(coupon_id)');
  // 유저별 이벤트 참여 조회 (UNIQUE(event_id, user_id)는 user_id 단독 검색 불가)
  await safeCreateIndex('CREATE INDEX idx_event_participants_user ON event_participants(user_id)');
  // 공지 삭제 시 연결된 고정 알림 정리
  await safeCreateIndex('CREATE INDEX idx_notifications_link ON notifications(link, is_pinned)');

  await safeAddColumn('orders', 'completed_at', 'DATETIME DEFAULT NULL');
  await safeAddColumn('users', 'points', 'INT NOT NULL DEFAULT 0');
  await safeAddColumn('orders', 'points_used', 'INT NOT NULL DEFAULT 0');
  await safeAddColumn('notifications', 'is_pinned', 'BOOLEAN NOT NULL DEFAULT false');

  // 리뷰 중복 방지 UNIQUE 제약 마이그레이션
  const [reviewIdx] = await connection.execute(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'reviews' AND INDEX_NAME = 'uq_user_product'`,
    [process.env.DB_NAME]
  );
  if (reviewIdx.length === 0) {
    const [dupes] = await connection.execute(
      'SELECT user_id, product_id, COUNT(*) as cnt FROM reviews GROUP BY user_id, product_id HAVING cnt > 1'
    );
    if (dupes.length > 0) {
      console.warn(`리뷰 중복 데이터 ${dupes.length}건 발견. 수동 정리 후 UNIQUE 제약을 추가해주세요.`);
    } else {
      try {
        await connection.query('ALTER TABLE reviews ADD UNIQUE KEY uq_user_product (user_id, product_id)');
      } catch (e) {
        if (e.code !== 'ER_DUP_KEYNAME') console.warn('리뷰 UNIQUE 제약 추가 실패:', e.message);
      }
    }
  }

  await connection.end();
  console.log('데이터베이스 초기화 완료!');
}

module.exports = initializeDatabase;
