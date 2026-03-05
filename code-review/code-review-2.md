# 코드 리뷰 2차 — 2025-03-05

> 1차 리뷰(backend-review.md, frontend-review.md, ux-feedback.md) 수정 이후 전체 코드베이스 재점검 결과

---

## 목차

- [백엔드](#백엔드)
  - [🔴 Critical](#백엔드--critical)
  - [🟡 Medium](#백엔드--medium)
  - [🔵 Low](#백엔드--low)
- [프론트엔드](#프론트엔드)
  - [🔴 Critical](#프론트엔드--critical)
  - [🟡 Medium](#프론트엔드--medium)
  - [🔵 Low](#프론트엔드--low)
- [요약 테이블](#요약-테이블)
- [권장 수정 순서](#권장-수정-순서)

---

## 백엔드

### 백엔드 — Critical

#### B-C1. 주문 생성 시 재고 Race Condition (SELECT FOR UPDATE 미사용)

**파일:** `server/controllers/orderController.js:18-39, 170`
**분류:** Bug / 데이터 무결성

재고를 일반 `SELECT`로 읽은 뒤, 한참 뒤에 `UPDATE products SET stock = stock - ?`로 차감한다.
두 사용자가 동시에 같은 상품(재고 1개)을 주문하면 둘 다 재고 체크를 통과하여 **초과 판매** 발생.

```js
// 현재: 일반 SELECT → 검증 → ... 중간 로직 ... → UPDATE
const [cartItems] = await connection.execute('SELECT ... p.stock ...');
if (item.stock < item.quantity) { ... } // 다른 트랜잭션이 이미 차감했을 수 있음
// ... 100줄 뒤 ...
connection.execute('UPDATE products SET stock = stock - ? WHERE id = ?', ...);
```

**수정 방안:**
```js
// SELECT ... FOR UPDATE로 행 잠금
const [cartItems] = await connection.execute(
  'SELECT ... p.stock ... FOR UPDATE', [userId]
);
// 또는 UPDATE 시 WHERE stock >= ? 조건 + affectedRows 확인
const [result] = await connection.execute(
  'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
  [qty, productId, qty]
);
if (result.affectedRows === 0) throw new Error('재고 부족');
```

---

#### B-C2. 쿠폰 수령 Race Condition (max_uses 초과 가능)

**파일:** `server/controllers/couponController.js:48-67`
**분류:** Bug / 데이터 무결성

`max_uses` 체크와 `current_uses` 증가가 트랜잭션/잠금 없이 분리되어 있어 동시 요청 시 `max_uses` 초과 가능.

**수정 방안:** 원자적 UPDATE 사용
```js
const [result] = await db.execute(
  'UPDATE coupons SET current_uses = current_uses + 1 WHERE id = ? AND (max_uses IS NULL OR current_uses < max_uses)',
  [couponId]
);
if (result.affectedRows === 0) {
  return res.status(400).json({ message: '쿠폰이 모두 소진되었습니다.' });
}
```

---

#### B-C3. 이벤트 참여 Race Condition (max_participants 초과 가능)

**파일:** `server/controllers/eventController.js:72-82`
**분류:** Bug / 데이터 무결성

`COUNT(*)`를 읽고 → `INSERT`하는 사이에 다른 요청이 끼어들면 `max_participants` 초과.
B-C2와 동일한 TOCTOU 패턴.

**수정 방안:** 트랜잭션 + SELECT FOR UPDATE 또는 서브쿼리 활용
```js
const [result] = await db.execute(`
  INSERT INTO event_participants (event_id, user_id)
  SELECT ?, ? FROM events
  WHERE id = ? AND (max_participants IS NULL OR
    (SELECT COUNT(*) FROM event_participants WHERE event_id = ?) < max_participants)
`, [id, userId, id, id]);
if (result.affectedRows === 0) {
  return res.status(400).json({ message: '참여 인원이 마감되었습니다.' });
}
```

---

#### B-C4. 환불 요청 트랜잭션 미사용

**파일:** `server/controllers/refundController.js:48-63`
**분류:** Bug / 데이터 무결성

`INSERT INTO refunds` 와 `UPDATE orders SET status = 'refund_requested'`가 별도 쿼리로 실행.
중간에 서버 크래시 시 환불 레코드는 있지만 주문 상태는 변경되지 않은 불일치 상태 발생.

**수정 방안:** `getConnection()` → `beginTransaction()` → `commit()`/`rollback()` → `release()` 패턴 사용

---

#### B-C5. orderController 배치 INSERT에 SQL 문자열 보간 사용

**파일:** `server/controllers/orderController.js:143-145, 159, 163-165`
**분류:** Security

```js
const oiValues = cartItems.map(item =>
  `(${orderId}, ${item.product_id}, ${item.quantity}, ${item.price + item.extraPrice})`
).join(',');
await connection.execute(`INSERT INTO order_items ... VALUES ${oiValues}`);
```

현재는 DB에서 온 값이라 안전하지만, 향후 업스트림 변경 시 SQL 인젝션으로 이어질 수 있는 위험한 패턴.

**수정 방안:** 파라미터화된 배치 INSERT 사용
```js
const placeholders = cartItems.map(() => '(?, ?, ?, ?)').join(',');
const values = cartItems.flatMap(item => [orderId, item.product_id, item.quantity, item.price + item.extraPrice]);
await connection.execute(`INSERT INTO order_items ... VALUES ${placeholders}`, values);
```

---

#### B-C6. express.json() 바디 크기 제한 없음

**파일:** `server/index.js:35`
**분류:** Security (DoS)

```js
app.use(express.json()); // 크기 제한 없음
```

공격자가 수 GB JSON을 전송하여 서버 메모리 고갈 가능.

**수정:** `app.use(express.json({ limit: '1mb' }));`

---

### 백엔드 — Medium

#### B-M1. 환불 승인 시 재고/쿠폰 미복원

**파일:** `server/controllers/adminController.js:594-669`
**분류:** Bug

`processRefund`에서 포인트는 반환하지만 **재고 복원**과 **쿠폰 복원**이 빠져있음.
`giftController.rejectGift`에서는 재고+쿠폰+포인트 모두 복원하므로 로직 불일치.

---

#### B-M2. JWT 토큰 로그아웃/비밀번호 변경/계정 삭제 후에도 유효

**파일:** `server/controllers/authController.js:128-130, 166-196, 199-222`
**분류:** Security

로그아웃은 서버에서 아무 작업도 하지 않음. 7일 유효 JWT가 그대로 유효.
비밀번호 변경이나 계정 삭제 후에도 기존 토큰으로 API 호출 가능.

**수정 방안:** 토큰 블랙리스트(Redis) 또는 짧은 수명 access token + refresh token 패턴

---

#### B-M3. 정지 유저 체크가 로그인 시에만 수행됨

**파일:** `server/controllers/authController.js:86-101`
**분류:** Security

이미 로그인된 유저가 정지되어도 JWT 만료까지 서비스 계속 이용 가능.

**수정:** `authenticateToken` 미들웨어에서 `user_penalties` 확인 추가

---

#### B-M4. advanceOrderStatus가 일반 유저에게 노출

**파일:** `server/routes/orderRoutes.js:9`
**분류:** Security

```js
router.put('/:id/advance', authenticateToken, advanceOrderStatus);
```

테스트용 엔드포인트가 `authenticateToken`만 적용. 일반 유저가 주문 상태를 `delivered`까지 임의 변경 가능.

**수정:** `isAdmin` 미들웨어 추가하거나 엔드포인트 제거

---

#### B-M5. 관리자 주문 상태 역방향 변경 가능

**파일:** `server/controllers/adminController.js:51-81`
**분류:** Bug

`shipped` 주문을 `checking`으로 되돌리는 등 역방향 전이 가능.
정방향 전이만 허용하는 검증 필요.

---

#### B-M6. 페이지네이션 없는 목록 API

**파일:** `server/controllers/productController.js:16`, `orderController.js:273`, `adminController.js:17`
**분류:** Performance

모든 목록 API가 `LIMIT` 없이 전체 데이터 반환. 데이터 증가 시 심각한 성능 저하.

---

#### B-M7. N+1 쿼리 패턴

| 위치 | 설명 |
|------|------|
| `eventController.js:24-31` | 이벤트별 참여 여부 개별 조회 |
| `cartController.js:65-76, 95-111` | 장바구니 옵션 개별 조회 |
| `adminController.js:178-198, 240-246` | 쿠폰/공지 배포 시 유저별 개별 INSERT |

**수정:** 배치 쿼리 또는 JOIN으로 통합

---

#### B-M8. ON DELETE CASCADE로 주문/유저 기록 소실

**파일:** `server/config/initDB.js:107, 169-170`
**분류:** 데이터 무결성

- `orders.user_id` → CASCADE: 유저 삭제 시 전체 주문 기록 소실
- `order_items.product_id` → CASCADE: 상품 삭제 시 주문 항목 소실

커머스 시스템에서 금전 기록은 보존해야 함. `ON DELETE SET NULL` 또는 소프트 삭제 사용 권장.

---

#### B-M9. 주문 시 쿠폰 사용해도 coupons.current_uses 미증가

**파일:** `server/controllers/orderController.js:65-95`
**분류:** Bug

`user_coupons.is_used = true`로 마킹하지만 `coupons.current_uses`는 증가시키지 않음.
수령(claim) 시에만 증가하여 사용 추적이 부정확.

---

#### B-M10. completed_at NULL인 완료 주문의 환불 기간 체크 우회

**파일:** `server/controllers/refundController.js:37-44`
**분류:** Bug

`completed_at`이 NULL이면 7일 제한 체크 자체가 스킵됨.

---

#### B-M11. 상품 생성 트랜잭션 미사용

**파일:** `server/controllers/productController.js:91-131`
**분류:** Bug

상품 INSERT 후 옵션 INSERT가 실패하면 옵션 없는 불완전한 상품이 생성됨.

---

#### B-M12. Rate Limiting 없음

**파일:** `server/index.js`
**분류:** Security

로그인 브루트포스, 쿠폰 코드 추측, 회원가입 스팸 등에 취약.
`express-rate-limit` 미들웨어 추가 권장.

---

#### B-M13. CORS origin: true (모든 도메인 허용)

**파일:** `server/index.js:31-34`
**분류:** Security

프로덕션 배포 시 특정 도메인만 허용하도록 변경 필요.

---

#### B-M14. 우편함 전체삭제 시 미수령 보상도 삭제됨

**파일:** `server/controllers/mailboxController.js:154-165`
**분류:** Bug

`DELETE FROM mailbox WHERE user_id = ?` — 미수령 보상(쿠폰, 포인트)도 영구 삭제됨.

**수정:** `WHERE is_claimed = true OR reward_type IS NULL` 조건 추가, 또는 삭제 전 미수령 알림

---

### 백엔드 — Low

| # | 파일 | 설명 |
|---|------|------|
| B-L1 | `authController.js:30` | 비밀번호 최소 4자 — 취약한 정책 |
| B-L2 | `initDB.js:33` | 닉네임 UNIQUE 제약 없음 — 선물 검색 시 혼란 |
| B-L3 | `authController.js:151-163` | 닉네임 길이/문자 제한 없음 |
| B-L4 | `cartController.js:54` | addToCart에서 quantity 양수 검증 없음 |
| B-L5 | `productController.js:95` | price 음수 허용 |
| B-L6 | `initDB.js` | 복합 인덱스 부재 (`orders(user_id, status)`, `notifications(user_id, is_read)` 등) |
| B-L7 | `adminController.js:458-477` | getUsersWithActivity 상관 서브쿼리 5개 — 유저 증가 시 느림 |
| B-L8 | `reviewController.js:32-37` | 환불된 주문에도 리뷰 작성 가능 |
| B-L9 | `orderController.js:237-268` | advanceOrderStatus에서 선물 수락 여부 미확인 |
| B-L10 | `authController.js:141` | LIKE 검색에서 `%`, `_` 특수문자 미이스케이프 |
| B-L11 | `index.js` | 글로벌 에러 핸들러 미들웨어 없음 |
| B-L12 | `adminController.js:232-236` | 공지 생성 시 insertId 대신 쿼리로 ID 조회 — 동시성 위험 |

---

## 프론트엔드

### 프론트엔드 — Critical

#### F-C1. OptionsEditor에서 렌더마다 새로운 key 생성 — 입력 중 포커스 소실

**파일:** `client/src/pages/Product/OptionsEditor.tsx:17-18, 34`
**분류:** Bug / React 패턴

```tsx
let optionKeyCounter = 0;  // 모듈 레벨
const getOptionKey = () => `opt-${++optionKeyCounter}`;
// ...
<div key={getOptionKey()} className="option-group">
```

`getOptionKey()`가 렌더 시 호출되어 매번 다른 key → React가 매 렌더마다 DOM을 전부 언마운트/마운트.
**증상:** 상품 등록 시 옵션명 입력할 때마다 커서 초기화, 포커스 손실.

**수정:** `key={oi}` (인덱스) 또는 옵션 생성 시 stable ID 부여

---

#### F-C2. 위시리스트 낙관적 업데이트 stale closure 버그

**파일:** `client/src/pages/Main/MainPage.tsx:67-98`
**분류:** Bug

```tsx
const wasWishlisted = wishlistIds.includes(productId);
setWishlistIds(wishlistIds.filter(id => id !== productId)); // 클로저 캡처된 배열 사용
```

빠르게 두 상품의 하트를 연속 클릭하면 두 번째 클릭이 첫 번째 업데이트 이전의 스냅샷을 참조하여 첫 번째 변경이 덮어씌워짐.

**수정:** 함수형 업데이터 사용
```tsx
setWishlistIds(prev => wasWishlisted
  ? prev.filter(id => id !== productId)
  : [...prev, productId]
);
```

---

### 프론트엔드 — Medium

#### F-M1. Error Boundary 없음 — 렌더 에러 시 백지 화면

**파일:** `client/src/App.tsx`
**분류:** UX

컴포넌트 렌더 중 에러 발생 시 전체 앱이 백지 화면. 복구 불가.
`ErrorBoundary` 클래스 컴포넌트를 `<Routes>` 상위에 추가 필요.

---

#### F-M2. 404 catch-all 라우트 없음

**파일:** `client/src/App.tsx:27-42`
**분류:** UX

존재하지 않는 URL 접속 시 헤더+푸터만 보이는 빈 페이지 표시.

**수정:** `<Route path="*" element={<NotFoundPage />} />` 추가

---

#### F-M3. API baseURL 하드코딩

**파일:** `client/src/api/instance.ts:4`
**분류:** Configuration

```tsx
baseURL: 'http://localhost:5000/api',
```

배포 환경에서 동작 불가. `import.meta.env.VITE_API_URL` 환경변수 사용 필요.

---

#### F-M4. 401 인터셉터에서 window.location.href 사용 — SPA 깨짐 + 무한 루프 위험

**파일:** `client/src/api/instance.ts:29-33`
**분류:** Bug

전체 페이지 리로드 발생. `/login`에서 401 응답 시 무한 리다이렉트 루프 가능.
`navigate('/login')` 콜백 패턴 또는 이벤트 기반 처리 필요.

---

#### F-M5. DeliveryForm에서 Daum Postcode SDK 미로드 시 크래시

**파일:** `client/src/pages/Checkout/DeliveryForm.tsx:32`
**분류:** Bug

```tsx
new window.daum.Postcode({ ... }).open();
```

외부 스크립트 로드 실패 시 `TypeError`. 가드 체크 필요:
```tsx
if (!window.daum?.Postcode) { alert('주소 검색 불가'); return; }
```

---

#### F-M6. 상품 상세 페이지 네비게이션 시 selectedOptions/quantity 미초기화

**파일:** `client/src/pages/Product/ProductDetailPage.tsx:19, 24-28`
**분류:** Bug

추천 상품 클릭으로 같은 페이지 내 `id` 변경 시, 이전 상품의 옵션/수량이 그대로 남아 잘못된 데이터가 장바구니에 추가될 수 있음.

**수정:**
```tsx
useEffect(() => {
  setSelectedOptions({});
  setQuantity(1);
  // ... fetch logic
}, [id]);
```

---

#### F-M7. AdminUsersTab 패널티 폼 상태가 모든 유저 간 공유

**파일:** `client/src/pages/Admin/AdminUsersTab.tsx:48`
**분류:** Bug

유저 A의 패널티 사유를 작성 중 유저 B로 전환하면 입력값이 유지됨.
`expandedUser` 변경 시 `setPenaltyForm` 초기화 필요.

---

#### F-M8. useEffect 의존성 배열 누락 (다수 파일)

**분류:** React 패턴

`showConfirm`, `navigate` 등이 `[]` 의존성 배열에 포함되지 않음.
현재 안정 참조라 실질적 버그는 없지만 ESLint `react-hooks/exhaustive-deps` 경고 발생.

**영향 파일:** Layout, MainPage, ProductDetailPage, CartPage, CheckoutPage, MyPage, MailboxPage, NotificationPage, WishlistPage, RefundPage 등 12개+

---

#### F-M9. API 호출 후 언마운트된 컴포넌트에 setState 호출 (AbortController 미사용)

**분류:** React 패턴

모든 페이지의 `useEffect` API 호출에 cleanup 없음. 빠른 네비게이션 시 경고 발생 가능.

**수정 패턴:**
```tsx
useEffect(() => {
  let cancelled = false;
  fetchData().then(data => { if (!cancelled) setState(data); });
  return () => { cancelled = true; };
}, []);
```

---

#### F-M10. 네비게이션 배지(장바구니/알림/우편함) 카운트 실시간 미갱신

**파일:** `client/src/components/Layout.tsx:34-48`
**분류:** UX

카운트가 마운트 시 1회만 조회됨. 장바구니 추가/알림 읽음 등 액션 후 업데이트 안 됨.

**수정:** 커스텀 이벤트(`cartUpdated`, `notificationUpdated`) 발행 + Layout에서 수신하여 재조회

---

#### F-M11. 관리자/마이페이지 탭 전환 시 전체 리마운트

**파일:** `client/src/pages/Admin/AdminPage.tsx:67-72`, `MyPage/MyPage.tsx:204-249`
**분류:** Performance

`{activeTab === 'orders' && <AdminOrdersTab />}` 패턴으로 탭마다 언마운트/리마운트.
탭 전환할 때마다 API 재호출 + 스크롤/폼 상태 소실.

**수정:** `display: none`으로 숨기거나 상태 캐싱

---

#### F-M12. RefundPage에서 `error: any` 타입 사용

**파일:** `client/src/pages/Refund/RefundPage.tsx:69`
**분류:** TypeScript

코드베이스 유일한 `any` 타입. `error instanceof AxiosError` 패턴으로 변경 필요.

---

#### F-M13. form label에 htmlFor/id 연결 누락 (접근성)

**분류:** Accessibility

LoginPage, SignupPage, ProductRegisterPage, DeliveryForm, SettingsTab, AdminCouponsTab 등 대부분의 폼에서 `<label>`과 `<input>`이 `htmlFor`/`id`로 연결되지 않음.
스크린 리더 사용 불가 + 라벨 클릭 시 입력 포커스 안 됨.

---

#### F-M14. `<Link>` 안에 `<button>` 중첩 — 무효 HTML

**파일:** `client/src/pages/Main/MainPage.tsx:181-207`
**분류:** Accessibility / Bug

`<a>` 태그 안에 `<button>`은 HTML 명세 위반. 스크린 리더 해석 오류 가능.
`e.stopPropagation()`으로 동작은 하지만 구조적으로 잘못됨.

---

### 프론트엔드 — Low

| # | 파일 | 설명 |
|---|------|------|
| F-L1 | `Auth/SignupPage.tsx:49`, `LoginPage.tsx` | 비밀번호 `trim()` — 의도적 공백 제거됨 |
| F-L2 | `Main/MainPage.tsx:34-48, 107-111` | 클라이언트 사이드 페이지네이션 — 상품 수 증가 시 비효율 |
| F-L3 | `Refund/RefundPage.tsx:36-38` | 단일 주문 조회에 전체 주문 목록 fetch |
| F-L4 | 여러 파일 | `CartItem`, `SearchedUser`, `CartItemOption` 등 중복 인터페이스 정의 |
| F-L5 | `MyPage/CouponsTab.tsx:69` | `coupon.min_price` falsy 체크 — 0일 때 미표시 |
| F-L6 | `MyPage/SettingsTab.tsx:38` | `user!` non-null assertion — null 가능성 무시 |
| F-L7 | `Auth/LoginPage.tsx`, `SignupPage.tsx` | 로그인/회원가입 버튼 submitting 상태 없음 — 더블클릭 가능 |
| F-L8 | `Product/ReviewSection.tsx` | `forwardRef` 사용 시 `displayName` 미설정 — DevTools에서 "Anonymous" |
| F-L9 | `AlertContext.tsx:44-46` | setTimeout 반환값 미추적 — 대량 토스트 시 타이머 누적 |
| F-L10 | 여러 파일 | 이모지/기호 버튼에 `aria-label` 없음 (`♥`, `×` 등) |
| F-L11 | `Layout.tsx:112` | 저작권 연도 2025 하드코딩 |
| F-L12 | `Auth/LoginPage.tsx:25`, `SignupPage.tsx:25` | `handleChange`에서 클로저 캡처 대신 함수형 업데이터 사용 권장 |
| F-L13 | `AlertContext.tsx:88-103` | Confirm 모달 ESC 키/포커스 트랩 미지원 |
| F-L14 | 여러 파일 | `window.dispatchEvent(new Event('userUpdated'))` — React Context 권장 |

---

## 요약 테이블

### 백엔드

| 심각도 | 개수 | 주요 항목 |
|--------|------|-----------|
| 🔴 Critical | 6 | 재고 Race Condition, 쿠폰/이벤트 동시성, 환불 트랜잭션, SQL 보간, Body 크기 |
| 🟡 Medium | 14 | 환불 재고 미복원, JWT 미무효화, 주문상태 역전이, N+1, CASCADE 등 |
| 🔵 Low | 12 | 검증 미비, 인덱스, 리뷰 허용 범위 등 |
| **합계** | **32** | |

### 프론트엔드

| 심각도 | 개수 | 주요 항목 |
|--------|------|-----------|
| 🔴 Critical | 2 | OptionsEditor key, 위시리스트 stale closure |
| 🟡 Medium | 14 | Error Boundary, 404, API URL, 탭 리마운트, 접근성 등 |
| 🔵 Low | 14 | 중복 타입, 비밀번호 trim, aria-label 등 |
| **합계** | **30** | |

### 전체 합계: 62건 (Critical 8, Medium 28, Low 26)

---

## 권장 수정 순서

### 1순위 — 데이터 무결성/보안 (즉시 수정)

| # | 항목 | 영향 |
|---|------|------|
| 1 | B-C1 재고 Race Condition | 초과 판매 → 금전적 손실 |
| 2 | B-C2 쿠폰 수령 Race Condition | 쿠폰 초과 발급 |
| 3 | B-C3 이벤트 참여 Race Condition | 정원 초과 |
| 4 | B-C4 환불 트랜잭션 | 데이터 불일치 |
| 5 | B-C6 Body 크기 제한 | DoS 공격 |
| 6 | B-M1 환불 재고/쿠폰 미복원 | 재고 누수 |

### 2순위 — UX 크리티컬 (사용자 경험 저해)

| # | 항목 | 영향 |
|---|------|------|
| 7 | F-C1 OptionsEditor key | 상품 등록 불가 수준 |
| 8 | F-C2 위시리스트 stale closure | 찜 상태 꼬임 |
| 9 | F-M6 상품 상세 옵션 미초기화 | 잘못된 주문 |
| 10 | F-M5 Daum Postcode 가드 | 체크아웃 크래시 |

### 3순위 — 보안 강화

| # | 항목 | 영향 |
|---|------|------|
| 11 | B-M4 advanceOrderStatus 권한 | 주문 상태 조작 |
| 12 | B-M2 JWT 무효화 | 로그아웃 후 토큰 남용 |
| 13 | B-M3 정지 유저 실시간 체크 | 정지 우회 |
| 14 | B-M12 Rate Limiting | 브루트포스 |
| 15 | B-C5 SQL 문자열 보간 → 파라미터화 | 잠재적 SQL 인젝션 |

### 4순위 — 안정성/성능

| # | 항목 |
|---|------|
| 16 | F-M1 Error Boundary |
| 17 | F-M2 404 라우트 |
| 18 | F-M3 API URL 환경변수 |
| 19 | F-M4 401 인터셉터 SPA 처리 |
| 20 | B-M6 페이지네이션 |
| 21 | B-M7 N+1 쿼리 해소 |
| 22 | B-M8 CASCADE → SET NULL |
| 23 | F-M11 탭 리마운트 방지 |

### 5순위 — 코드 품질/접근성

나머지 Medium, Low 항목들 (중복 인터페이스 통합, a11y 개선, ESLint 경고 해소 등)
