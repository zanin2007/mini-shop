# 코드 리뷰 4차 — 2025-03-05

> 1~3차 리뷰 수정 이후 전체 코드베이스 재점검. 이전 리뷰에서 수정된 항목은 제외하고 **현재 코드 기준** 발견 사항만 수록.

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
- [요약](#요약)
- [권장 수정 순서](#권장-수정-순서)

---

## 백엔드

### 백엔드 — Critical

#### B-C1. 옵션 재고 차감 후 affectedRows 미확인 → 옵션 초과 판매

**파일:** `server/controllers/orderController.js:214-220`
**분류:** Bug / 데이터 무결성

상품 재고 차감(line 197)은 `affectedRows === 0` 체크를 하지만, 옵션 재고 차감(line 215-218)은 체크 없이 넘어감.
동시 주문 시 옵션 재고가 0인데도 주문이 성공하여 **옵션 초과 판매** 발생.

```js
// 현재: affectedRows 체크 없음
await connection.execute(
  'UPDATE product_option_values SET stock = stock - ? WHERE id = ? AND stock >= ?',
  [item.quantity, ovId, item.quantity]
);
// 수정: 체크 추가
const [optResult] = await connection.execute(...);
if (optResult.affectedRows === 0) {
  await connection.rollback();
  return res.status(400).json({ message: '옵션 재고가 부족합니다.' });
}
```

---

#### B-C2. 선물 메시지 길이 검증이 재고 차감 이후에 수행됨

**파일:** `server/controllers/orderController.js:229-233`
**분류:** Bug / 데이터 무결성

gift 메시지 검증(500자)이 재고 차감, 쿠폰 사용, 포인트 차감 **이후**에 수행됨.
검증 실패 시 rollback 하지만, rollback 실패 시 데이터 불일치 위험.

**수정:** 함수 최상단(req.body 파싱 직후)으로 검증 이동

---

#### B-C3. 계정 삭제 시 진행 중인 주문까지 CASCADE 삭제

**파일:** `server/controllers/authController.js:244`, `server/config/initDB.js:107`
**분류:** 데이터 무결성

`DELETE FROM users` → `orders` ON DELETE CASCADE → `order_items` CASCADE.
배송 중인 주문이 있는 유저가 탈퇴하면 모든 주문 기록이 소실됨.

**수정:**
```js
const [activeOrders] = await db.execute(
  "SELECT id FROM orders WHERE user_id = ? AND status NOT IN ('completed', 'refunded')",
  [req.user.userId]
);
if (activeOrders.length > 0) {
  return res.status(400).json({ message: '진행중인 주문이 있어 탈퇴할 수 없습니다.' });
}
```
장기적으로는 소프트 삭제(`is_deleted = true`) 또는 `ON DELETE SET NULL` 권장.

---

#### B-C4. 상품 삭제 시 order_items CASCADE → 주문 이력 소실

**파일:** `server/config/initDB.js:170`, `server/controllers/productController.js:220`, `server/controllers/adminController.js:110`
**분류:** 데이터 무결성

`order_items.product_id` → `ON DELETE CASCADE`. 상품 삭제 시 과거 주문의 항목이 모두 삭제됨.
활성 주문이 있는 상품도 삭제 가능하여 주문 처리 중 데이터 깨짐.

**수정:**
1. FK를 `ON DELETE SET NULL`로 변경 (product_id nullable)
2. 삭제 전 활성 주문 확인
3. 또는 소프트 삭제 패턴 (`is_active = false`)

---

#### B-C5. 쿠폰 수령(claimCoupon) 트랜잭션 미사용 — current_uses 불일치

**파일:** `server/controllers/couponController.js:32-71`
**분류:** Race Condition / 데이터 무결성

`SELECT` → `UPDATE current_uses` → `INSERT user_coupons` 가 트랜잭션 없이 실행.
- INSERT 실패 시 current_uses만 증가된 채 남음
- 동시 요청 시 max_uses 초과 가능

**수정:** 원자적 UPDATE 사용:
```js
const [result] = await connection.execute(
  'UPDATE coupons SET current_uses = current_uses + 1 WHERE id = ? AND is_active = true AND (max_uses IS NULL OR current_uses < max_uses)',
  [couponId]
);
if (result.affectedRows === 0) return res.status(400).json({ message: '쿠폰이 소진되었습니다.' });
```

---

#### B-C6. 이벤트 선착순 보상 트랜잭션 미사용 — 보상 누락 가능

**파일:** `server/controllers/eventController.js:62-119`
**분류:** Race Condition / 데이터 무결성

참여 INSERT는 원자적이지만, fcfs 보상 지급(`is_winner` UPDATE, mailbox INSERT, notification INSERT)이 개별 `db.execute`로 실행.
서버 크래시 시 참여는 되었으나 보상 미지급 상태 발생.

**수정:** 전체 흐름을 `getConnection()` + `beginTransaction()` 트랜잭션으로 감싸기

---

#### B-C7. advanceOrderStatus가 admin 전용인데 user_id 조건으로 항상 404

**파일:** `server/controllers/orderController.js:291-295`, `server/routes/orderRoutes.js:9`
**분류:** Bug

라우트는 `isAdmin` 미들웨어 적용이지만, 쿼리에 `WHERE id = ? AND user_id = ?`(관리자의 userId)가 있어 관리자 본인 주문 외에는 항상 404.

**수정:** `user_id` 조건 제거:
```js
const [orders] = await db.execute('SELECT * FROM orders WHERE id = ?', [req.params.id]);
```

---

### 백엔드 — Medium

#### B-M1. 선물 거절 시 쿠폰 current_uses 미감소

**파일:** `server/controllers/giftController.js:171-177`
**분류:** 데이터 무결성

`user_coupons.is_used = false`로 복원하지만 `coupons.current_uses`는 미감소.
`processRefund`에서는 올바르게 `GREATEST(current_uses - 1, 0)` 수행. 로직 불일치.

---

#### B-M2. 환불/거절 시 옵션(product_option_values) 재고 미복원

**파일:** `server/controllers/adminController.js:691-700`, `server/controllers/giftController.js:159-169`
**분류:** 데이터 무결성

`products.stock`은 복원하지만 `product_option_values.stock`은 미복원. 옵션 재고 영구 감소.

**수정:** `order_item_options` JOIN으로 옵션 재고도 복원:
```js
const [opts] = await connection.execute(
  `SELECT oio.option_value_id, oi.quantity FROM order_item_options oio
   JOIN order_items oi ON oio.order_item_id = oi.id WHERE oi.order_id = ?`, [orderId]
);
for (const o of opts) {
  await connection.execute('UPDATE product_option_values SET stock = stock + ? WHERE id = ?', [o.quantity, o.option_value_id]);
}
```

---

#### B-M3. 우편함 보상 수령(claimReward) FOR UPDATE 없음 — 포인트 이중 지급

**파일:** `server/controllers/mailboxController.js:58-59`
**분류:** Race Condition

동시 요청 시 `is_claimed = false`를 두 번 읽어 포인트 이중 지급 가능.

**수정:** `SELECT * FROM mailbox WHERE id = ? AND user_id = ? FOR UPDATE`

---

#### B-M4. 비활성 상품이 목록/상세에 노출

**파일:** `server/controllers/productController.js:16, 54-57`
**분류:** Bug

`is_active` 컬럼 필터 없음. 비활성 상품이 고객에게 노출됨.

**수정:** `WHERE is_active = true` 조건 추가

---

#### B-M5. 단일 메일 삭제 시 미수령 보상도 삭제 가능

**파일:** `server/controllers/mailboxController.js:140-151`
**분류:** Bug

`deleteAll`은 미수령 보호, `deleteMail`은 보호 없음. 보상 영구 소실 위험.

---

#### B-M6. 선물 수락(acceptGift) 동시 요청 시 알림 중복 발송

**파일:** `server/controllers/giftController.js:76-107`
**분류:** Race Condition

원자적 UPDATE `WHERE status = 'pending'` + `affectedRows` 체크로 변경 필요.

---

#### B-M7. 쿠폰 배포 O(n) 개별 INSERT — 대규모 유저 타임아웃

**파일:** `server/controllers/adminController.js:185-212`
**분류:** Performance

유저당 3개 쿼리 순차 실행. 배치 INSERT로 개선 필요.

---

#### B-M8. 유저 검색에서 이메일 주소 노출

**파일:** `server/controllers/authController.js:150-166`
**분류:** Security / Privacy

모든 인증 유저가 타 유저 이메일 열람 가능. 닉네임만 검색/반환 권장.

---

#### B-M9. 환불 요청 SELECT에 FOR UPDATE 없음

**파일:** `server/controllers/refundController.js:25-28`
**분류:** Race Condition

---

#### B-M10. 상품 검색 LIKE 와일드카드(%,_) 미이스케이프

**파일:** `server/controllers/productController.js:19-21`
**분류:** Input Validation

`authController.searchUser`에서는 이스케이프하므로 패턴 불일치.

---

#### B-M11. 선물 수신자 자기 자신 가능 + 존재 확인 없음

**파일:** `server/controllers/orderController.js:236-248`
**분류:** Input Validation

---

#### B-M12. 페이지네이션 미구현 (상품/주문/관리자 전체 목록)

**파일:** `productController.js:16`, `orderController.js:331`, `adminController.js:15`
**분류:** Performance

---

### 백엔드 — Low

| # | 파일 | 설명 |
|---|------|------|
| B-L1 | `initDB.js:293` | `safeAddColumn` SQL 문자열 보간 |
| B-L2 | `db.js:16` | SSL `rejectUnauthorized: false` |
| B-L3 | `authController.js:145-147` | 로그아웃 서버 처리 없음 (JWT 7일 유효) |
| B-L4 | `authController.js:194-224` | 비밀번호 변경 후 기존 JWT 미무효화 |
| B-L5 | `reviewController.js:27` | 별점 소수점 허용 (0.5 단위 제한 권장) |
| B-L6 | `productController.js:42-43` | 카테고리에 비활성 상품 카테고리 포함 |
| B-L7 | `adminController.js:299-350` | 이벤트 start_date < end_date 미검증 |
| B-L8 | `adminController.js:122-146` | 쿠폰 만료일 과거 허용 |
| B-L9 | `wishlistController.js:22-44` | 상품 존재/활성 여부 미확인 |
| B-L10 | `cartController.js:52-54` | addToCart productId 존재 확인 미수행 |
| B-L11 | `productController.js:153-182` | addProductOption 트랜잭션 미사용 |
| B-L12 | `authMiddleware.js:35-37` | 패널티 체크 실패 시 silent pass |

---

## 프론트엔드

### 프론트엔드 — Critical

#### F-C1. 관리자 페이지 접근 제어가 localStorage 기반 — 우회 가능

**파일:** `client/src/pages/Admin/AdminPage.tsx:29-34`, `client/src/pages/Product/ProductRegisterPage.tsx:12-19`
**분류:** Security / Bug

브라우저 콘솔에서 `localStorage.setItem('user', JSON.stringify({role:'admin'}))` 실행 시 관리자 UI 전체 노출.

**수정:** 마운트 시 서버에서 역할 검증:
```tsx
useEffect(() => {
  api.get('/auth/check').then(res => {
    if (res.data.user.role !== 'admin') navigate('/', { replace: true });
  }).catch(() => navigate('/login'));
}, []);
```

---

### 프론트엔드 — Medium

#### F-M1. AbortController 미사용 — 빠른 네비게이션 시 stale 데이터

**파일:** 거의 모든 페이지 (15개+)
**분류:** Bug / Race Condition

`useEffect` API 호출에 cleanup 없음. `ProductDetailPage`는 `:id` 변경으로 동시 fetch 특히 취약.
`GiftSection.tsx`만 유일하게 AbortController 구현.

**수정 패턴:**
```tsx
useEffect(() => {
  const controller = new AbortController();
  api.get('/endpoint', { signal: controller.signal })
    .then(res => setState(res.data))
    .catch(err => { if (err.name !== 'CanceledError') console.error(err); });
  return () => controller.abort();
}, [deps]);
```

---

#### F-M2. ProductDetailPage 상품 전환 시 options/quantity 미초기화

**파일:** `client/src/pages/Product/ProductDetailPage.tsx:19, 75-81`
**분류:** Bug

추천 상품 클릭 시 이전 상품의 `selectedOptions`/`quantity`가 남아 잘못된 데이터로 장바구니 추가.

**수정:** `useEffect` 시작에 `setSelectedOptions({})`, `setQuantity(1)` 추가

---

#### F-M3. CartPage/MailboxPage stale closure로 상태 덮어씀

**파일:** `client/src/pages/Cart/CartPage.tsx:77-85`, `client/src/pages/Mailbox/MailboxPage.tsx:58-85`
**분류:** Bug

`setCartItems(cartItems.map(...))` — 클로저 캡처 배열 사용으로 빠른 연속 조작 시 이전 업데이트 소실.

**수정:** 함수형 업데이터: `setCartItems(prev => prev.map(...))`

---

#### F-M4. showConfirm을 성공 알림으로 오용

**파일:** `client/src/pages/Main/MainPage.tsx:93`, `client/src/pages/Product/ProductDetailPage.tsx:99`
**분류:** UX

위시리스트 추가 시 확인 모달이 불필요하게 표시됨.

**수정:** `showAlert('찜 목록에 추가되었습니다.', 'success')`

---

#### F-M5. 체크아웃 포인트를 localStorage에서 로드 — 서버와 불일치

**파일:** `client/src/pages/Checkout/CheckoutPage.tsx:89-96`
**분류:** Bug

다른 탭/세션에서 포인트 변동 시 localStorage 미동기화. 서버 조회로 변경 필요.

---

#### F-M6. 401 인터셉터 window.location.replace — SPA 상태 소실

**파일:** `client/src/api/instance.ts:32`
**분류:** Bug / UX

전체 페이지 리로드. `/login`에서 401 시 무한 루프 위험.

**수정:** 커스텀 이벤트로 React Router 내 처리

---

#### F-M7. CartPage에서 cartUpdated 이벤트 미발행 → 배지 미갱신

**파일:** `client/src/pages/Cart/CartPage.tsx`
**분류:** UX

장바구니 변경 후 Layout 헤더 배지 미갱신. CheckoutPage 주문 완료 후에도 동일.

---

#### F-M8. ProductDetailPage currentUser 매 렌더마다 JSON.parse

**파일:** `client/src/pages/Product/ProductDetailPage.tsx:109-114`
**분류:** Performance

**수정:** `useState` lazy initializer 또는 `useMemo` 사용

---

#### F-M9. Admin/MyPage 탭 전환 시 리마운트 + API 재호출

**파일:** `client/src/pages/Admin/AdminPage.tsx:67-72`, `client/src/pages/MyPage/MyPage.tsx:204-249`
**분류:** Performance

`{activeTab === 'x' && <Tab />}` → 전환 시 전체 언마운트/리마운트.

**수정:** `display: none`으로 숨기거나 데이터 캐싱

---

#### F-M10. AdminUsersTab 패널티 폼 상태가 유저 간 공유

**파일:** `client/src/pages/Admin/AdminUsersTab.tsx:48`
**분류:** Bug

유저 A의 사유가 유저 B 전환 시 남아있음. `expandedUser` 변경 시 폼 초기화 필요.

---

#### F-M11. 관리자 주문 상태 역방향 전이 허용

**파일:** `client/src/pages/Admin/AdminOrdersTab.tsx:237-248`
**분류:** UX / Bug

`delivered` → `checking` 등이 UI에서 가능. 현재 상태 기준 유효 전이만 드롭다운에 표시 권장.

---

#### F-M12. 품절 옵션 선택 가능 (disabled 미적용)

**파일:** `client/src/pages/Product/ProductDetailPage.tsx:240-245`
**분류:** UX / Bug

`<option>` 태그에 "(sold out)" 텍스트만 표시. `disabled` 속성 추가 필요.

---

#### F-M13. LoginPage/SignupPage non-AxiosError 무시

**파일:** `client/src/pages/Auth/LoginPage.tsx:52-55`, `client/src/pages/Auth/SignupPage.tsx:57-60`
**분류:** Error Handling

AxiosError 외 에러는 catch에서 무시 → 유저 피드백 없음.

---

#### F-M14. 접근성 문제 모음

**분류:** Accessibility

| 문제 | 영향 파일 |
|------|-----------|
| `<label>` htmlFor/id 미연결 | LoginPage, SignupPage, DeliveryForm, SettingsTab, AdminCouponsTab |
| 모달 focus trap 없음 | AlertContext (confirm), NotificationPage (상세 모달) |
| icon/emoji 버튼 aria-label 없음 | Layout (✉️, 🔔), CartPage (+/-) |
| 검색 결과 `<li>` 키보드 미지원 | GiftSection.tsx |

---

### 프론트엔드 — Low

| # | 파일 | 설명 |
|---|------|------|
| F-L1 | `Auth/SignupPage.tsx:49` | 비밀번호 `trim()` — 의도적 공백 제거 |
| F-L2 | `Auth/SignupPage.tsx` | 닉네임 길이/문자 검증 없음 |
| F-L3 | `Refund/RefundPage.tsx:27-28` | 단일 주문에 전체 목록 fetch |
| F-L4 | 여러 파일 | `CartItem`, `SearchedUser` 중복 인터페이스 |
| F-L5 | `MyPage/SettingsTab.tsx:38` | `user!` non-null assertion |
| F-L6 | `AlertContext.tsx:31-33` | Toast setTimeout 미추적 |
| F-L7 | 모든 API 호출 | `api.get<T>()` 제네릭 미사용 |
| F-L8 | `Layout.tsx:62` | 로그아웃 후 폴링 유지 |
| F-L9 | 여러 파일 | `window.dispatchEvent` 통신 — Context 권장 |
| F-L10 | `Layout.tsx:112` | 저작권 연도 2025 하드코딩 |
| F-L11 | `Main/MainPage.tsx:24` | `Promise.all` 미 await / 미 catch |

---

## 요약

### 백엔드

| 심각도 | 개수 | 핵심 |
|--------|------|------|
| 🔴 Critical | 7 | 옵션 초과판매, CASCADE 데이터 소실, 쿠폰/이벤트 Race Condition, advanceOrder 404 |
| 🟡 Medium | 12 | 옵션 재고 미복원, 보상 이중 수령, 비활성 상품 노출, 이메일 노출, 페이지네이션 |
| 🔵 Low | 12 | SSL, JWT, 입력 검증 |
| **합계** | **31** | |

### 프론트엔드

| 심각도 | 개수 | 핵심 |
|--------|------|------|
| 🔴 Critical | 1 | 관리자 페이지 localStorage 우회 |
| 🟡 Medium | 14 | AbortController, stale closure, showConfirm 오용, 탭 리마운트, 접근성 |
| 🔵 Low | 11 | 중복 타입, trim, 하드코딩 |
| **합계** | **26** | |

### 전체: 57건 (Critical 8, Medium 26, Low 23)

---

## 권장 수정 순서

### 1순위 — 데이터 손실/무결성 (즉시)

| 순번 | 항목 | 위험 |
|------|------|------|
| 1 | B-C1 옵션 재고 affectedRows | 옵션 초과 판매 |
| 2 | B-C4 상품 삭제 CASCADE | 주문 이력 영구 소실 |
| 3 | B-C3 계정 삭제 CASCADE | 진행 중 주문 소실 |
| 4 | B-C5 쿠폰 수령 트랜잭션 | current_uses 불일치 |
| 5 | B-C6 이벤트 보상 트랜잭션 | 보상 누락 |
| 6 | B-C2 선물 메시지 검증 순서 | rollback 실패 시 데이터 불일치 |
| 7 | B-C7 advanceOrderStatus 404 | 기능 완전 미작동 |

### 2순위 — 보안/UX 크리티컬

| 순번 | 항목 | 위험 |
|------|------|------|
| 8 | F-C1 관리자 페이지 접근 제어 | 일반 유저가 관리자 UI 열람 |
| 9 | B-M3 우편함 보상 이중 수령 | 포인트 이중 지급 |
| 10 | B-M4 비활성 상품 노출 | 비공개 상품 구매 가능 |
| 11 | B-M2 옵션 재고 미복원 | 재고 영구 감소 |
| 12 | B-M1 선물 거절 쿠폰 카운트 | 쿠폰 수량 drift |

### 3순위 — 프론트엔드 안정성

| 순번 | 항목 |
|------|------|
| 13 | F-M1 AbortController 도입 |
| 14 | F-M2 상품 상세 옵션 초기화 |
| 15 | F-M3 stale closure 수정 (함수형 업데이터) |
| 16 | F-M4 showConfirm → showAlert |
| 17 | F-M5 포인트 서버 조회 |
| 18 | F-M6 401 인터셉터 SPA 처리 |
| 19 | F-M12 품절 옵션 disabled |

### 4순위 — 성능/UX 개선

| 순번 | 항목 |
|------|------|
| 20 | B-M12 서버 페이지네이션 |
| 21 | B-M7 배치 INSERT (쿠폰 배포) |
| 22 | F-M9 탭 리마운트 방지 |
| 23 | F-M7 cartUpdated 이벤트 |
| 24 | F-M14 접근성 개선 |

### 5순위 — 코드 품질

나머지 Low 항목들
