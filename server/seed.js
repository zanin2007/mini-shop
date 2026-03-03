require('dotenv').config();
const db = require('./config/db');

const products = [
  {
    name: '프리미엄 오버핏 티셔츠',
    description: '부드러운 코튼 소재의 오버핏 반팔 티셔츠. 데일리 착용에 적합한 편안한 핏.',
    price: 29900,
    stock: 100,
    image_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500',
    category: '의류',
    options: [
      {
        option_name: '사이즈',
        values: [
          { value: 'S', extra_price: 0, stock: 25 },
          { value: 'M', extra_price: 0, stock: 30 },
          { value: 'L', extra_price: 0, stock: 25 },
          { value: 'XL', extra_price: 2000, stock: 20 },
        ],
      },
      {
        option_name: '색상',
        values: [
          { value: '화이트', extra_price: 0, stock: 35 },
          { value: '블랙', extra_price: 0, stock: 35 },
          { value: '네이비', extra_price: 0, stock: 30 },
        ],
      },
    ],
  },
  {
    name: '무선 블루투스 이어폰',
    description: '노이즈캔슬링 기능 탑재, 최대 24시간 재생. IPX5 방수 등급.',
    price: 59000,
    stock: 50,
    image_url: 'https://images.unsplash.com/photo-1590658268037-6bf12f032f55?w=500',
    category: '전자기기',
    options: [
      {
        option_name: '색상',
        values: [
          { value: '블랙', extra_price: 0, stock: 20 },
          { value: '화이트', extra_price: 0, stock: 20 },
          { value: '로즈골드', extra_price: 5000, stock: 10 },
        ],
      },
    ],
  },
  {
    name: '스테인리스 텀블러 500ml',
    description: '진공 단열 이중벽 구조로 보온/보냉 12시간 유지. BPA-free 소재.',
    price: 18900,
    stock: 80,
    image_url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500',
    category: '생활용품',
    options: [
      {
        option_name: '색상',
        values: [
          { value: '실버', extra_price: 0, stock: 30 },
          { value: '매트블랙', extra_price: 0, stock: 25 },
          { value: '민트', extra_price: 0, stock: 25 },
        ],
      },
      {
        option_name: '용량',
        values: [
          { value: '350ml', extra_price: -2000, stock: 30 },
          { value: '500ml', extra_price: 0, stock: 30 },
          { value: '750ml', extra_price: 4000, stock: 20 },
        ],
      },
    ],
  },
  {
    name: '가죽 미니 크로스백',
    description: '소프트 PU가죽 소재. 수납력 좋은 미니멀 디자인 크로스백.',
    price: 45000,
    stock: 40,
    image_url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=500',
    category: '패션잡화',
    options: [
      {
        option_name: '색상',
        values: [
          { value: '블랙', extra_price: 0, stock: 15 },
          { value: '브라운', extra_price: 0, stock: 10 },
          { value: '아이보리', extra_price: 0, stock: 10 },
          { value: '카키', extra_price: 3000, stock: 5 },
        ],
      },
    ],
  },
  {
    name: '유기농 드립 커피 세트',
    description: '싱글 오리진 원두 3종 세트. 에티오피아, 콜롬비아, 과테말라 각 100g.',
    price: 32000,
    stock: 60,
    image_url: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=500',
    category: '식품',
    options: [
      {
        option_name: '원두 상태',
        values: [
          { value: '홀빈 (원두)', extra_price: 0, stock: 30 },
          { value: '분쇄 (드립용)', extra_price: 0, stock: 30 },
        ],
      },
      {
        option_name: '로스팅',
        values: [
          { value: '라이트', extra_price: 0, stock: 20 },
          { value: '미디엄', extra_price: 0, stock: 25 },
          { value: '다크', extra_price: 0, stock: 15 },
        ],
      },
    ],
  },
  {
    name: 'LED 무드등 스피커',
    description: '블루투스 5.0 스피커 + 7색 LED 무드등. 터치로 색상 변경 가능.',
    price: 38000,
    stock: 35,
    image_url: 'https://img1.kakaocdn.net/thumb/C305x305@2x.fwebp.q82/?fname=https%3A%2F%2Fst.kakaocdn.net%2Fproduct%2Fgift%2Fproduct%2F20250415103329_cd7068387c5f4a4bb9007c8eed8b0311.jpg',
    category: '전자기기',
    options: [
      {
        option_name: '모양',
        values: [
          { value: '원형', extra_price: 0, stock: 15 },
          { value: '달 모양', extra_price: 5000, stock: 10 },
          { value: '구름 모양', extra_price: 5000, stock: 10 },
        ],
      },
    ],
  },
];

async function seed() {
  try {
    // admin 유저 ID 조회 (첫 번째 유저 사용)
    const [users] = await db.execute('SELECT id FROM users LIMIT 1');
    const userId = users.length > 0 ? users[0].id : null;

    for (const p of products) {
      const [result] = await db.execute(
        'INSERT INTO products (user_id, name, description, price, stock, image_url, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, p.name, p.description, p.price, p.stock, p.image_url, p.category]
      );
      const productId = result.insertId;
      console.log(`상품 등록: ${p.name} (ID: ${productId})`);

      for (const opt of p.options) {
        const [optResult] = await db.execute(
          'INSERT INTO product_options (product_id, option_name) VALUES (?, ?)',
          [productId, opt.option_name]
        );
        const optionId = optResult.insertId;

        for (const val of opt.values) {
          await db.execute(
            'INSERT INTO product_option_values (option_id, value, extra_price, stock) VALUES (?, ?, ?, ?)',
            [optionId, val.value, val.extra_price, val.stock]
          );
        }
        console.log(`  옵션: ${opt.option_name} (${opt.values.length}개 값)`);
      }
    }

    console.log(`\n총 ${products.length}개 상품 시드 완료!`);
    process.exit(0);
  } catch (error) {
    console.error('시드 실패:', error);
    process.exit(1);
  }
}

seed();
