# Backend Code Review

> **검토일:** 2026-03-05
> **범위:** `server/` 전체
> **스택:** Express.js + MySQL + JWT
> **환경:** 로컬 학습용 프로젝트

---

## 🔴 실제 버그 — 지금도 터질 수 있는 것들

---

### B-1. insertId 연속 가정 — 데이터가 조용히 꼬임 (orderController.js)

**파일:** `controllers/orderController.js` — 142~162번째 줄

**현재 코드:**
```javascript
// 배치로 order_items 삽입
const oiValues = cartItems.map(item =>
  `(${orderId}, ${item.product_id}, ${item.quantity}, ${item.price + item.extraPrice})`
).join(',');
const [oiResult] = await connection.execute(
  `INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ${oiValues}`
);
const firstOiId = oiResult.insertId;  // ← 첫 번째 행의 ID

// 옵션 매핑 — ID가 연속이라고 가정!
for (let i = 0; i < cartItems.length; i++) {
  const orderItemId = firstOiId + i;   // ← 첫번째 ID + 0, +1, +2, ...
  const opts = optsMap.get(cartItems[i].id) || [];
  for (const ovId of opts) {
    optRows.push(`(${orderItemId}, ${ovId})`);
  }
}
```

**왜 문제야?**

3개 상품을 주문했다고 하면, 코드가 기대하는 건:
```
order_item_id: 100 → 상품A의 옵션들
order_item_id: 101 → 상품B의 옵션들
order_item_id: 102 → 상품C의 옵션들
```

근데 MySQL의 `innodb_autoinc_lock_mode=2` (MySQL 8.0 기본값)에서는 동시 INSERT가 있으면 ID가 `100, 103, 104` 처럼 건너뛸 수 있어. 이러면:

```
order_item_id: 100 → 상품A의 옵션들 (올바름)
order_item_id: 101 → 상품B의 옵션들 (101은 다른 주문의 아이템!)
order_item_id: 102 → 상품C의 옵션들 (102도 다른 주문의 아이템!)
```

**에러가 안 나고 조용히 틀린 데이터가 들어가서 나중에 발견하기 엄청 힘들어.**

**이렇게 바꿔야 해:**
```javascript
const [oiResult] = await connection.execute(
  `INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ${oiValues}`
);

// 실제 생성된 ID를 조회
const [insertedItems] = await connection.execute(
  'SELECT id FROM order_items WHERE order_id = ? ORDER BY id ASC',
  [orderId]
);

for (let i = 0; i < cartItems.length; i++) {
  const orderItemId = insertedItems[i].id;  // ← 실제 ID 사용
  // ... 옵션 매핑
}
```

---

### B-2. LAST_INSERT_ID() 풀 커넥션 레이스 (adminController.js)

**파일:** `controllers/adminController.js` — 219~226번째 줄

**현재 코드:**
```javascript
await db.execute(
  'INSERT INTO announcements (admin_id, title, content, is_pinned) VALUES (?, ?, ?, ?)',
  [req.user.userId, title, content, is_pinned || false]
);

// ⚠️ 이 쿼리가 다른 커넥션에서 실행될 수 있음!
const announcementId = (await db.execute(
  'SELECT LAST_INSERT_ID() as id'
))[0][0].id;
```

**왜 문제야?**

`db.execute()`는 커넥션 풀에서 빈 커넥션을 빌려와. 두 번의 `db.execute()`가 **같은 커넥션을 쓸 거라는 보장이 없어.** `LAST_INSERT_ID()`는 커넥션(세션) 단위로 작동하니까, 다른 커넥션에서 실행되면 **다른 관리자가 방금 만든 공지의 ID**가 반환될 수 있어.

재미있는 건, 같은 프로젝트의 다른 곳에선 이미 올바르게 하고 있거든:
```javascript
// orderController.js:127 — 올바른 패턴
const [orderResult] = await connection.execute('INSERT INTO orders ...', [...]);
const orderId = orderResult.insertId;  // ← INSERT 결과에서 바로 꺼냄
```

**이렇게 바꿔야 해:**
```javascript
const [result] = await db.execute(
  'INSERT INTO announcements (admin_id, title, content, is_pinned) VALUES (?, ?, ?, ?)',
  [req.user.userId, title, content, is_pinned || false]
);
const announcementId = result.insertId;  // ← 이 한 줄이면 끝!
```

---

### B-3. dotenv 호출 순서 (index.js)

**파일:** `server/index.js`

**현재 상태:**
```javascript
// line 1~7 (require 먼저)
const express = require('express');
const cors = require('cors');
const initializeDatabase = require('./config/initDB');  // ← db.js를 require함
// ...

// line 25 (dotenv는 한참 뒤에)
dotenv.config();
```

**왜 문제야?**

`initDB.js`가 `require`되는 시점에 `db.js`도 실행되는데, 이때 `process.env.DB_HOST` 등이 전부 `undefined`야. `initDB.js`가 자체적으로 `dotenv.config()`를 호출해서 "우연히" 동작하는 상태. dotenv가 두 번 호출되고, 의존 관계가 숨겨져 있어.

**이렇게 바꿔야 해:**
```javascript
// index.js 최상단 — 다른 require보다 먼저!
const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
// ...나머지 require
```

---

### B-4. isAdmin 미들웨어 크래시 (authMiddleware.js)

**파일:** `middleware/authMiddleware.js` — 21~25번째 줄

**현재 코드:**
```javascript
exports.isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {   // ← req.user가 없으면 TypeError!
    return res.status(403).json({ message: '관리자 권한이 필요합니다.' });
  }
  next();
};
```

**왜 문제야?**

지금은 라우터에서 항상 `authenticateToken` → `isAdmin` 순서로 쓰고 있어서 괜찮지만, 나중에 실수로 `isAdmin`만 붙이면 서버가 크래시해.

```javascript
// 실수로 이렇게 쓰면 → 서버 죽음
router.get('/admin/stats', isAdmin, getStats);
```

**이렇게 바꿔야 해:**
```javascript
exports.isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: '관리자 권한이 필요합니다.' });
  }
  next();
};
```

---

### B-5. 장바구니 수량 검증 없음 (cartController.js)

**파일:** `controllers/cartController.js` — 131~146번째 줄

**현재 코드:**
```javascript
exports.updateQuantity = async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;

  // ← 아무 검증 없이 바로 UPDATE!
  await db.execute(
    'UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?',
    [quantity, id, req.user.userId]
  );
  res.json({ message: '수량이 변경되었습니다.' });
};
```

**왜 문제야?**

Postman이나 프론트엔드 버그로 `quantity: 0`, `quantity: -5`, `quantity: 99999`를 보내면 그대로 DB에 들어가. 체크아웃할 때 가격이 0원이 되거나 음수가 되는 버그로 이어질 수 있어.

**이렇게 바꿔야 해:**
```javascript
exports.updateQuantity = async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;

  if (!Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ message: '수량은 1 이상의 정수여야 합니다.' });
  }

  await db.execute(
    'UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?',
    [quantity, id, req.user.userId]
  );
  res.json({ message: '수량이 변경되었습니다.' });
};
```

---

## 🟡 패턴 개선 — 좋은 습관을 위해

---

### P-1. N+1 쿼리 — 같은 프로젝트 안에서도 불일치 (adminController.js)

**파일:** `controllers/adminController.js` — 24~32번째 줄

**현재 코드 (admin — 느린 방식):**
```javascript
for (const order of orders) {
  const [items] = await db.execute(
    `SELECT oi.*, p.name, p.image_url FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = ?`,
    [order.id]
  );
  order.items = items;
}
// 100건이면 → 101번 쿼리!
```

**같은 프로젝트의 올바른 패턴 (orderController.js — 빠른 방식):**
```javascript
// orderController.js에서는 이렇게 배치로 한 번에 가져옴
const orderIds = orders.map(o => o.id);
const [allItems] = await db.execute(
  `SELECT oi.*, p.name, p.image_url FROM order_items oi
   JOIN products p ON oi.product_id = p.id
   WHERE oi.order_id IN (${orderIds.map(() => '?').join(',')})`,
  orderIds
);
// 100건이든 1000건이든 → 딱 2번 쿼리!
```

`orderController`에 이미 잘 만든 패턴이 있으니까, 그걸 admin 쪽에도 똑같이 적용하면 돼. `getAllRefunds`(414~422줄)에도 같은 문제가 있어.

---

### P-2. processRefund 트랜잭션 누락 (adminController.js)

**파일:** `controllers/adminController.js` — 574~643번째 줄

**현재 코드:**
```javascript
// 1. 환불 상태 업데이트
await db.execute('UPDATE refunds SET status = ? ...', [newStatus, ...]);

// 2. 주문 상태 업데이트
await db.execute('UPDATE orders SET status = ? ...', ['refunded', ...]);

// 3. 포인트 환불
await db.execute('UPDATE users SET points = points + ? ...', [pointsUsed, ...]);

// 4. 알림 발송
await db.execute('INSERT INTO notifications ...', [...]);
```

**왜 문제야?**

4개의 UPDATE/INSERT가 트랜잭션 없이 순차 실행돼. 만약 2번까지 성공하고 3번에서 DB 에러가 나면:

- 환불 상태: "승인됨" ✓
- 주문 상태: "환불완료" ✓
- 포인트: **안 돌려줌** ✗ ← 데이터 불일치!

같은 프로젝트의 `orderController.createOrder`에서 이미 트랜잭션을 잘 쓰고 있어:
```javascript
const connection = await db.getConnection();
await connection.beginTransaction();
try {
  // ... 여러 쿼리
  await connection.commit();
} catch {
  await connection.rollback();
}
```

이 패턴을 `processRefund`에도 동일하게 적용하면 됨.

---

### P-3. 환불 TOCTOU 레이스 컨디션 (refundController.js)

**파일:** `controllers/refundController.js` — 47~65번째 줄

**현재 코드:**
```javascript
// Step 1: 확인
const [existing] = await db.execute(
  'SELECT id FROM refunds WHERE order_id = ?', [orderId]
);
if (existing.length > 0) {
  return res.status(400).json({ message: '이미 환불 신청된 주문입니다.' });
}

// ← 이 사이에 다른 요청이 같은 체크를 통과할 수 있음!

// Step 2: 삽입
await db.execute(
  'INSERT INTO refunds (order_id, user_id, reason) VALUES (?, ?, ?)',
  [orderId, userId, reason.trim()]
);
```

**왜 문제야?**

사용자가 환불 버튼을 빠르게 두 번 클릭하면:
1. 요청 A: "기존 환불 없음" → 통과
2. 요청 B: "기존 환불 없음" → 통과 (A가 아직 INSERT 전)
3. 요청 A: INSERT 성공
4. 요청 B: INSERT 성공 → **중복 환불!**

DB에 `UNIQUE(order_id)` 제약이 있으면 요청 B는 DB 에러로 터지는데, catch에서 이걸 구분 안 하니까 사용자에게 "서버 오류" 500이 감.

**이렇게 바꿔야 해:**
```javascript
try {
  await db.execute(
    'INSERT INTO refunds (order_id, user_id, reason) VALUES (?, ?, ?)',
    [orderId, userId, reason.trim()]
  );
} catch (error) {
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(400).json({ message: '이미 환불 신청된 주문입니다.' });
  }
  throw error;
}
```

체크 쿼리를 없애고 그냥 INSERT를 시도한 뒤, DB가 중복을 잡아주면 그걸 처리하는 방식. 이게 더 안전하고 쿼리도 1개 줄어.

---

### P-4. 대량 배포 순차 쿼리 (adminController.js)

**파일:** `controllers/adminController.js` — 229~236번째 줄

**현재 코드:**
```javascript
const [users] = await db.execute('SELECT id FROM users');
for (const user of users) {
  await db.execute(
    `INSERT INTO notifications (user_id, type, title, content, is_pinned, link)
     VALUES (?, 'system', ?, ?, ?, ?)`,
    [user.id, ...]
  );
}
// 유저 1000명이면 → 1000번 INSERT!
```

**이렇게 바꿔야 해:**
```javascript
const [users] = await db.execute('SELECT id FROM users');
if (users.length > 0) {
  const values = users.map(u => `(${u.id}, 'system', ?, ?, ?, ?)`).join(',');
  const params = users.flatMap(u => [title, content, isPinned, link]);
  await db.execute(
    `INSERT INTO notifications (user_id, type, title, content, is_pinned, link)
     VALUES ${values}`,
    params
  );
}
// 유저가 몇 명이든 → 딱 1번 INSERT!
```

같은 패턴이 쿠폰 배포(170~189줄), 이벤트 생성(309~314줄)에도 있어.

---

### P-5. SQL 템플릿 리터럴 (adminController.js)

**파일:** `controllers/adminController.js` — 364번째 줄

**현재 코드:**
```javascript
const limit = parseInt(winner_count, 10);
// ...
const [candidates] = await db.execute(
  `SELECT * FROM event_participants WHERE event_id = ? AND is_winner = false
   ORDER BY RAND() LIMIT ${limit}`   // ← 직접 삽입!
);
```

**왜 고쳐야 해?**

`parseInt()` 덕분에 지금은 안전하지만, 이 패턴을 다른 곳에서 복사해서 `parseInt` 없이 쓰면 SQL injection이 돼. "파라미터는 항상 `?`로 바인딩"이라는 원칙을 지키는 습관이 중요해.

MySQL2의 `execute()`에서 LIMIT에 `?` 쓸 수 없는 제약이 있으니:
```javascript
const limit = parseInt(winner_count, 10);
if (!limit || limit < 1 || limit > 1000) {
  return res.status(400).json({ message: '유효하지 않은 당첨 인원입니다.' });
}
// 검증 후 삽입 — 예외 사유 주석 추가
// NOTE: LIMIT에는 파라미터 바인딩 불가, parseInt로 검증 완료
```

---

### P-6. rating / 이메일 검증 없음

**rating — `controllers/reviewController.js:50`**
```javascript
// rating: -99, 9999, "abc" 등이 그대로 DB로 전달됨
// DB DECIMAL(2,1) 제약에서 에러 → 기술적 메시지가 사용자에게 노출

// 추가할 검증:
if (typeof rating !== 'number' || rating < 0.5 || rating > 5) {
  return res.status(400).json({ message: '별점은 0.5~5 사이여야 합니다.' });
}
```

**이메일 — `controllers/authController.js:21`**
```javascript
// "notanemail" 등이 가입 가능

// 추가할 검증:
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  return res.status(400).json({ message: '유효한 이메일 형식이 아닙니다.' });
}
```

---

## 🔵 알아두면 좋은 것

| # | 이슈 | 파일 | 한줄 요약 |
|---|------|------|-----------|
| N-1 | 장바구니 N+1 옵션 매칭 | `cartController.js:65` | 같은 상품 아이템마다 개별 옵션 조회 → `IN` 배치로 변경 |
| N-2 | 에러 응답 형식 불일치 | 전체 컨트롤러 | `{ message }` vs `{ error }` 혼용 → `{ message }` 통일 |
| N-3 | 비밀번호 trim | `authController.js:17` | `"pass "` == `"pass"` 처리됨 → 의도한 건지 확인 필요 |
| N-4 | multipleStatements: true | `config/initDB.js:10` | init 전용이라 안전하지만 사유 주석 추가 권장 |

---

## 잘 된 부분

| 항목 | 코드 위치 | 설명 |
|------|-----------|------|
| 트랜잭션 | `orderController.js:13-15` | `getConnection()` + `beginTransaction()` 올바른 패턴 사용 |
| 파라미터 바인딩 | 전체 | SQL 쿼리 대부분 `?` 바인딩 일관 적용 (1곳 제외) |
| 배치 쿼리 | `orderController.js:280-299` | N+1 회피하는 `IN (...)` 배치 패턴 올바르게 구현 |
| JWT 미들웨어 | `authMiddleware.js` | `authenticateToken`이 라우트 레벨에서 일관 적용 |
| bcrypt 해싱 | `authController.js` | 비밀번호 bcrypt salt 10 사용 |
| 에러 핸들링 | 대부분 컨트롤러 | try-catch + 적절한 HTTP 상태 코드 |
| 방어적 코딩 | `orderController.js:32-39` | 재고 검증 후 구체적 에러 메시지 반환 |
