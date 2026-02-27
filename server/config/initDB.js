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
      rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
      content TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
  `);
  console.log('전체 테이블 확인 완료 (19개)');

  // orders 테이블 completed_at 컬럼 확인 (조건부 ALTER)
  const [cols] = await connection.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'completed_at'`,
    [process.env.DB_NAME]
  );
  if (cols.length === 0) {
    await connection.query('ALTER TABLE orders ADD COLUMN completed_at DATETIME DEFAULT NULL');
  }

  await connection.end();
  console.log('데이터베이스 초기화 완료!');
}

module.exports = initializeDatabase;
