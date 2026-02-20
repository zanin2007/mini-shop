const mysql = require('mysql2/promise');
require('dotenv').config();

async function initializeDatabase() {
  // 먼저 데이터베이스 없이 연결하여 DB 생성
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  // 데이터베이스 생성
  await connection.execute(
    `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  console.log(`Database '${process.env.DB_NAME}' 확인 완료`);

  // 생성한 데이터베이스 사용
  await connection.changeUser({ database: process.env.DB_NAME });

  // users 테이블 생성
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      nickname VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('users 테이블 확인 완료');

  await connection.end();
  console.log('데이터베이스 초기화 완료!');
}

module.exports = initializeDatabase;
