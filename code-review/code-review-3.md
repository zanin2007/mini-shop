# 코드 리뷰 3차 — 2026-03-05

> 2차 리뷰 수정 이후 전체 코드베이스 재점검 결과

---

## 목차

- [백엔드](#백엔드)
  - [🔴 Critical](#백엔드--critical)
  - [🟠 High](#백엔드--high)
  - [🟡 Medium](#백엔드--medium)
  - [🔵 Low](#백엔드--low)
- [프론트엔드](#프론트엔드)
  - [🔴 Critical](#프론트엔드--critical)
  - [🟠 High](#프론트엔드--high)
  - [🟡 Medium](#프론트엔드--medium)
  - [🔵 Low](#프론트엔드--low)
- [잘한 점](#잘한-점)
- [요약 테이블](#요약-테이블)
- [권장 수정 순서](#권장-수정-순서)

---

## 백엔드

### 백엔드 — Critical

#### B-C1. 옵션 재고 미검증 (주문 생성)

**파일:** `server/controllers/orderController.js:42-56`
**분류:** Bug / 데이터 무결성

주문할 때 상품 자체 재고(`products.stock`)는 체크하는데, 옵션별 재고(`product_option_values.stock`)는 안 보고 있어요.
그래서 "빨강/L" 옵션 재고가 0이어도 주문이 그냥 통과돼요.

```js
// 지금은 상품 재고만 봄
if (item.stock < item.quantity) { ... }
// 옵션 재고? 안 봄
```

**수정 방안:**
```js
// 선택된 옵션 재고도 같이 확인해야 함
if (selectedOptions && selectedOptions.length > 0) {
  const [optValues] = await connection.execute(
    `SELECT id, stock FROM product_option_values WHERE id IN (${selectedOptions.map(() => '?').join(',')})`,
    selectedOptions.map(o => o.valueId)
  );
  for (const ov of optValues) {
    if (ov.stock < item.quantity) {
      await connection.rollback();
      return res.status(400).json({ message: '선택한 옵션의 재고가 부족합니다.' });
    }
  }
}
```

---

#### B-C2. 타임존 혼용 (환불 7일 기한 계산)

**파일:** `server/controllers/refundController.js:47-50`, `server/config/db.js:9`
**분류:** Bug / 로직 오류

DB 커넥션 풀은 `timezone: '+00:00'`으로 UTC를 쓰고 있는데, 환불 기한 계산은 JS의 `new Date()`를 쓰고 있어요.
서버가 KST(+09:00) 환경에서 돌면 `new Date()`는 KST 기준이고 DB에서 꺼낸 `completed_at`은 UTC 기준이라 최대 하루 정도 오차가 생길 수 있어요. 환불 7일 기한 경계에 있는 유저한테 영향이 갈 수 있는 부분이에요.

```js
// JS Date는 서버 로컬 타임존을 따름
const now = new Date();
const completedDate = new Date(order.completed_at);
const diffDays = (now.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24);
if (diffDays > 7) { ... }
```

**수정 방안:** 이런 날짜 비교는 DB한테 시키는 게 제일 깔끔해요
```js
const [rows] = await db.execute(
  'SELECT TIMESTAMPDIFF(DAY, completed_at, NOW()) AS diff_days FROM orders WHERE id = ?',
  [orderId]
);
if (rows[0].diff_days > 7) { ... }
```

---

#### B-C3. 쿠폰 배포 시 에러를 전부 삼켜버림

**파일:** `server/controllers/adminController.js:169-212`
**분류:** Bug / 데이터 무결성

`distributeCoupon`에서 유저마다 INSERT 하면서 catch로 에러를 전부 무시하고 있어요.
원래 의도는 "이미 쿠폰 가진 유저는 건너뛰자"인데, UNIQUE 위반뿐만 아니라 DB 연결 에러 같은 것도 같이 무시돼요.
중간에 DB 끊기면 일부 유저만 쿠폰 받고 나머지는 안 받는 상태가 되는데 아무 로그도 안 남아요.

```js
for (const user of users) {
  try {
    await db.execute('INSERT INTO user_coupons...', [...]);
  } catch (err) {
    // "이미 보유한 쿠폰은 건너뜀" ← 근데 다른 에러도 여기서 먹힘
  }
}
```

**수정 방안:** UNIQUE 위반만 건너뛰고 나머지 에러는 throw 하자
```js
} catch (err) {
  if (err.code === 'ER_DUP_ENTRY') {
    skipped++;
  } else {
    throw err;  // DB 에러 같은 건 위로 올려야 함
  }
}
```

---

### 백엔드 — High

#### B-H1. 선물 거절하면 이중 환불될 수 있음

**파일:** `server/controllers/giftController.js:110-197`
**분류:** Bug / 데이터 무결성

`rejectGift` 들어올 때 주문이 이미 환불된 상태인지 안 봐요.
누군가 이미 환불된 주문의 선물을 다시 거절하면 재고 복원, 쿠폰 복원, 포인트 반환이 두 번 일어나요.

```js
// 주문 상태가 뭐든 그냥 환불 처리 시작함
const [orders] = await connection.execute('SELECT * FROM orders WHERE id = ?', [gift.order_id]);
// order.status === 'refunded'인지 확인하는 코드가 없음
```

**수정 방안:** 환불 시작 전에 주문 상태부터 체크
```js
if (order.status === 'refunded') {
  await connection.rollback();
  return res.status(400).json({ message: '이미 환불된 주문입니다.' });
}
```

---

#### B-H2. 쿠폰 수령에 아직 Race Condition 여지가 남아있음

**파일:** `server/controllers/couponController.js:48-67`
**분류:** Bug / Race Condition

`current_uses < max_uses` 체크를 원자적 UPDATE로 바꿨는데, 그 앞에서 SELECT로 쿠폰 정보를 먼저 읽고 있어요.
SELECT와 UPDATE 사이에 시간 차가 있어서, 동시에 여러 명이 같은 쿠폰을 수령하면 max_uses를 넘길 수 있는 가능성이 아직 남아있어요.

**수정 방안:** UPDATE `affectedRows` 확인 후에만 `user_coupons`에 INSERT하도록 순서를 맞춰야 해요

---

#### B-H3. 관리자 환불 승인 중 동시 상태 변경 가능

**파일:** `server/controllers/adminController.js:635-638`
**분류:** Bug / Race Condition

`processRefund`에서 주문 상태를 `refunded`로 바꾸는데 `FOR UPDATE` 같은 잠금이 없어요.
두 관리자가 동시에 같은 주문을 처리하면 상태가 꼬일 수 있어요.

**수정 방안:** 트랜잭션 안에서 `SELECT ... FOR UPDATE`로 행 잠금 걸어야 해요

---

#### B-H4. 없는 상품 삭제해도 성공 응답

**파일:** `server/controllers/productController.js`
**분류:** 로직 오류

상품 DELETE 할 때 `affectedRows`를 안 봐서, 존재하지 않는 상품 ID로 삭제해도 200 OK가 나와요.
치명적이진 않지만 클라이언트가 실제로 삭제됐는지 판단할 수 없어요.

**수정 방안:** `affectedRows === 0`이면 404 반환

---

### 백엔드 — Medium

#### B-M1. 공지 만들 때 유저 수만큼 INSERT 쿼리를 쏨

**파일:** `server/controllers/adminController.js:241-248`
**분류:** 성능

공지 하나 올릴 때 전체 유저한테 알림을 보내는데, for문 안에서 유저마다 INSERT를 하나씩 날려요.
유저가 10,000명이면 INSERT 10,000번. 배치 INSERT 하나면 될 일이에요.

**수정 방안:**
```js
const placeholders = users.map(() => '(?, ?, ?, ?)').join(',');
const values = users.flatMap(u => [u.id, 'system', `📢 ${title}`, content]);
await db.execute(`INSERT INTO notifications (...) VALUES ${placeholders}`, values);
```

---

#### B-M2. 관리자 목록 조회에 페이지네이션이 없음

**파일:** `server/controllers/adminController.js:17-22, 340-342`
**분류:** 성능

`getAllOrders`, `getAllEvents` 같은 관리자 API가 LIMIT 없이 전체 데이터를 한 번에 리턴해요.
지금은 괜찮지만 주문이 10만 건 넘어가면 한 번 조회에 메모리 터질 수 있어요.

**수정 방안:** `page`, `limit` 파라미터로 페이지네이션

---

#### B-M3. 선물 메시지 길이 제한 없음

**파일:** `server/controllers/orderController.js:209`
**분류:** 유효성 검증

`giftMessage`를 길이 확인 없이 바로 DB에 넣고 있어요.
프론트에서는 제한할 수 있지만 Postman 같은 걸로 직접 API 치면 수만 자도 들어가요.

**수정 방안:**
```js
if (giftMessage && giftMessage.length > 500) {
  return res.status(400).json({ message: '선물 메시지는 500자 이하여야 합니다.' });
}
```

---

#### B-M4. 상품 등록 시 음수 가격/재고가 통과됨

**파일:** `server/controllers/productController.js:96-111`
**분류:** 유효성 검증

`stock || 0` 패턴을 쓰고 있어서 -1을 넣으면 falsy가 아니라 그대로 -1이 들어가요.
가격도 마찬가지로 음수 검증이 없어요.

**수정 방안:**
```js
if (!Number.isInteger(price) || price < 0) {
  return res.status(400).json({ message: '가격은 0 이상의 정수여야 합니다.' });
}
```

---

#### B-M5. 포인트 오버플로 방어 없음

**파일:** `server/controllers/orderController.js` 외 다수
**분류:** 데이터 무결성

포인트 적립할 때 `points = points + ?`로만 하고 있어서, 이론적으로 MySQL INT 최대값(21억)을 넘길 수 있어요.
현실적으로 안 일어나겠지만 방어 코드 한 줄이면 되니까요.

**수정 방안:**
```js
'UPDATE users SET points = LEAST(points + ?, 9999999) WHERE id = ?'
```

---

#### B-M6. 쿠폰 할인 적용할 때 0원을 falsy로 처리함

**파일:** `server/controllers/orderController.js:79-85`
**분류:** 로직 오류

`discount_amount`가 0일 때 JS에서 falsy 취급돼서 if문에 안 들어가요.
지금 당장 문제가 되는 케이스는 드물지만, 할인 금액이 정확히 0인 쿠폰이 있으면 비교 로직이 스킵돼요.

```js
// 0이면 falsy → 이 조건문 자체를 안 탐
if (uc.discount_amount && uc.discount_amount > discountAmount) {
```

**수정 방안:**
```js
if (uc.discount_amount != null && uc.discount_amount > discountAmount) {
```

---

#### B-M7. 쿠폰 배포 시 coupon_id 입력 검증 없음

**파일:** `server/controllers/adminController.js:171-173`
**분류:** 유효성 검증

`coupon_id`가 null이든 문자열이든 음수든 그냥 쿼리에 넣어요. 서버 터지진 않지만 예상치 못한 동작이 나올 수 있어요.

---

#### B-M8. 트랜잭션 롤백 시 로깅이 부족

**파일:** 다수 컨트롤러
**분류:** 운영/디버깅

롤백할 때 `console.error('Create order error:', error)` 정도만 찍고 있는데, 어떤 유저가 어떤 주문에서 터졌는지 같은 컨텍스트가 없어서 나중에 로그만 보고 디버깅하기 어려워요.

---

### 백엔드 — Low

#### B-L1. 응답 메시지에 이모지를 쓰는 곳이 일부만

**파일:** 다수 컨트롤러
**분류:** 코드 스타일

이벤트 보상 메시지만 `🎊`를 쓰고 나머지는 안 쓰고 있어요. 쓸 거면 통일하고 안 쓸 거면 빼는 게 깔끔해요.

---

#### B-L2. 리뷰 컨트롤러에서 주문 조회 쿼리가 중복

**파일:** `server/controllers/reviewController.js:88-111`
**분류:** 코드 품질

`checkPurchased`랑 다른 함수에서 비슷한 주문 조회 쿼리를 각각 쓰고 있어요. 공통 헬퍼로 빼면 좋겠어요.

---

## 프론트엔드

### 프론트엔드 — Critical

#### F-C1. 로그인 후 리다이렉트 URL을 검증 안 함 (Open Redirect)

**파일:** `client/src/pages/Auth/LoginPage.tsx:48-50`
**분류:** 보안

로그인 성공하면 `?redirect=` 파라미터의 값으로 바로 navigate 하는데, 이 값을 아무 검증 없이 쓰고 있어요.
누군가 `?redirect=https://evil.com` 이런 링크를 뿌리면 로그인한 뒤 피싱 사이트로 넘어가요.

```ts
const redirect = params.get('redirect') || '/';
navigate(redirect, { replace: true }); // 외부 URL도 그냥 들어감
```

**수정 방안:** `/`로 시작하는 내부 경로만 허용
```ts
const redirect = params.get('redirect') || '/';
const safeRedirect = redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/';
navigate(safeRedirect, { replace: true });
```

---

#### F-C2. Layout.tsx polling useEffect에서 의존성을 eslint-disable로 무시

**파일:** `client/src/components/Layout.tsx:80-81`
**분류:** Bug / Stale Closure

알림 카운트 폴링하는 useEffect에서 `fetchCounts`를 의존성 배열에 안 넣고 `eslint-disable-next-line`으로 경고를 꺼놨어요.
문제는 `fetchCounts` 안에서 `showAlert` 같은 외부 값을 참조하는데, 이게 바뀌어도 이전 클로저를 계속 쓰게 돼요. 최초 마운트 시점의 함수가 30초마다 계속 불려요.

```ts
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [];
```

**수정 방안:** `fetchCounts`를 `useCallback`으로 감싸고 의존성 배열에 제대로 넣어야 해요

---

#### F-C3. JSON.parse를 try-catch 없이 쓰는 곳이 여러 군데

**파일:** `ProductDetailPage.tsx`, `ProductRegisterPage.tsx`, `MyPage.tsx` 등
**분류:** Bug / 런타임 에러

`localStorage`에서 꺼낸 값을 `JSON.parse`로 바로 파싱하는데, try-catch가 없어요.
localStorage 데이터가 손상되면 (다른 탭에서 꼬이거나 브라우저 확장이 건드리면) 바로 앱이 터져요.

```ts
const userData = localStorage.getItem('user');
if (userData) setUser(JSON.parse(userData)); // 여기서 터지면 화이트스크린
```

**수정 방안:** 이미 `utils/storage.ts`에 안전한 파싱 유틸이 있으니까 그걸 쓰거나, 최소한 try-catch로 감싸야 해요

---

### 프론트엔드 — High

#### F-H1. 주문 후 포인트를 서버 확인 없이 로컬에서 직접 차감

**파일:** `client/src/pages/Checkout/CheckoutPage.tsx:161-170`
**분류:** 데이터 무결성

주문 성공 후 localStorage에서 직접 포인트를 빼고 있어요. 서버가 실제로 얼마를 차감했는지 확인을 안 해요.
주문은 됐는데 localStorage 업데이트가 실패하거나, 서버쪽 차감 금액이 다르면 포인트가 안 맞아요.

```ts
const u = JSON.parse(stored);
u.points = Math.max(0, (u.points || 0) - pointDiscount);
localStorage.setItem('user', JSON.stringify(u));
```

**수정 방안:** 주문 완료 후 `/api/auth/check` 호출해서 서버의 최신 유저 정보로 갱신하는 게 확실해요

---

#### F-H2. 알림 모달을 ESC 키로 못 닫음

**파일:** `client/src/pages/Notification/NotificationPage.tsx:216-255`
**분류:** 접근성 / UX

알림 상세 모달이 배경 클릭으로만 닫혀요. ESC 키 핸들링이 없어서 키보드 유저한테 불편해요.

**수정 방안:**
```ts
useEffect(() => {
  if (!selectedNotif) return;
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setSelectedNotif(null);
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}, [selectedNotif]);
```

---

#### F-H3. 선물 유저 검색할 때 이전 API 요청을 취소 안 함

**파일:** `client/src/pages/Checkout/GiftSection.tsx:24-28`
**분류:** 성능 / UX

검색어 타이핑할 때 debounce 타이머는 정리하는데, 이미 날아간 API 요청은 안 끊어요.
"홍"을 치고 바로 "홍길동"을 치면, "홍"에 대한 응답이 늦게 와서 검색 결과가 잠깐 깜빡일 수 있어요.

**수정 방안:** `AbortController`로 이전 요청을 cancel 해야 해요

---

#### F-H4. 선물 하나 처리 중이면 다른 선물 버튼도 전부 막힘

**파일:** `client/src/pages/MyPage/GiftsTab.tsx:31-34`
**분류:** UX / 로직 오류

`processingId`가 단일 값이라 선물 하나를 수락/거절하는 동안 나머지 선물 버튼이 전부 비활성화돼요.
선물이 5개인 유저가 하나씩 처리하려면 매번 기다려야 해요.

```ts
const [processingId, setProcessingId] = useState<number | null>(null);
if (processingId !== null) return; // 아무거나 하나라도 처리 중이면 전부 블록
```

**수정 방안:** `Set<number>`로 개별 선물마다 처리 상태를 추적

---

#### F-H5. 위시리스트 삭제 실패 시 UI 복구 안 됨

**파일:** `client/src/pages/Wishlist/WishlistPage.tsx:47-56`
**분류:** UX

삭제는 API 성공 후에 UI를 업데이트하고 있어서 낙관적 업데이트 문제는 아닌데, 에러가 나면 에러 토스트만 띄우고 리스트를 다시 안 불러와요.
서버에서는 삭제됐는데 에러 응답이 온 경우 UI가 안 맞을 수 있어요.

---

### 프론트엔드 — Medium

#### F-M1. 비밀번호 변경 placeholder가 실제 검증이랑 안 맞음

**파일:** `client/src/pages/MyPage/SettingsTab.tsx:130`
**분류:** UX

placeholder에는 "4자 이상"이라고 써있는데 실제 검증은 6자예요. 2차 리뷰에서 비밀번호 최소 길이를 6자로 올렸는데 placeholder는 안 바꿨어요.

```tsx
placeholder="새 비밀번호 (4자 이상)"  // 이거 "6자 이상"으로 바꿔야 함
```

---

#### F-M2. 장바구니 수량 변경할 때 재고 초과 체크 안 함

**파일:** `client/src/pages/Cart/CartPage.tsx:86-97`
**분류:** UX / 유효성 검증

`+` 버튼으로 수량을 올릴 때 재고보다 많은지 안 봐요.
서버가 거부는 하겠지만, 유저 입장에서는 "왜 안 되지?" 하고 헷갈릴 수 있어요. 클라이언트에서 미리 막는 게 좋아요.

**수정 방안:**
```ts
const handleUpdateQuantity = async (id: number, quantity: number) => {
  const item = cartItems.find(i => i.id === id);
  if (!item || quantity < 1 || quantity > item.stock) return;
};
```

---

#### F-M3. 환불 신청 화면에서 7일 기한을 미리 안 알려줌

**파일:** `client/src/pages/Refund/RefundPage.tsx:36-57`
**분류:** UX

환불 가능 기한(구매확정 후 7일)을 클라이언트에서 미리 계산해서 안 보여줘요.
유저가 사유를 열심히 쓰고 제출했는데 서버에서 "기한 지났음" 하면 짜증나잖아요.

---

#### F-M4. 주소 검색 안 될 때 native alert() 씀

**파일:** `client/src/pages/Checkout/DeliveryForm.tsx:31-35`
**분류:** UX / 일관성

다음 우편번호 서비스 로딩 실패 시 브라우저 기본 `alert()`를 쓰고 있어요. 나머지 앱은 전부 `showAlert()`인데 여기만 달라요.

---

#### F-M5. 상품 등록할 때 가격/재고 음수 검증 없음

**파일:** `client/src/pages/Product/ProductRegisterPage.tsx:36-40`
**분류:** 유효성 검증

input에 -1000 같은 걸 넣어도 클라이언트에서 안 막아요. 서버에서도 현재 안 막고 있어서(B-M4) 음수 가격 상품이 만들어질 수 있어요.

---

#### F-M6. 쿠폰 할인 금액이 NaN으로 뜰 수 있음

**파일:** `client/src/pages/Checkout/CouponSection.tsx:10-19`
**분류:** UI 오류

`calculated_discount`가 undefined면 `.toLocaleString()` 호출 시 NaN이 화면에 뜨어요.

**수정 방안:** `(coupon.calculated_discount ?? 0).toLocaleString()`

---

#### F-M7. 이미지 깨졌을 때 아무 처리도 안 함

**파일:** 다수 페이지 (MainPage, ProductDetailPage, CartPage 등)
**분류:** UX

`<img>` 태그에 `onError`가 없어서, 이미지 URL이 잘못되면 깨진 이미지 아이콘이 그대로 보여요.

**수정 방안:** 기본 플레이스홀더 이미지 표시
```tsx
<img src={product.image_url} alt={product.name}
     onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.png'; }} />
```

---

#### F-M8. 관리자 쿠폰 폼 상태가 전부 string

**파일:** `client/src/pages/Admin/AdminCouponsTab.tsx:29-32`
**분류:** 타입 안전성

쿠폰 폼 필드가 숫자인 것도 전부 string으로 관리하고 있어요. API 보낼 때 `Number()` 변환을 까먹으면 서버에 문자열이 그대로 가요.

---

#### F-M9. 이벤트 참여 후 서버 확인 없이 로컬 캐시만 업데이트

**파일:** `client/src/pages/Notification/NotificationPage.tsx:111-121`
**분류:** 데이터 일관성

이벤트 참여 API를 날리고 나서 응답 확인 없이 로컬 `Set`에 바로 추가해요.
API가 실패해도 UI에는 "참여 완료"로 보이는 상태가 돼요.

---

### 프론트엔드 — Low

#### F-L1. 아이콘 버튼에 aria-label 누락

**파일:** 다수 페이지
**분류:** 접근성

하트 버튼이나 삭제 버튼 같은 아이콘 전용 버튼에 `aria-label`이 없는 곳이 있어요. 스크린 리더 유저가 뭔지 모를 수 있어요.

---

#### F-L2. 안 쓰는 import

**파일:** `client/src/pages/MyPage/MyPage.tsx:15`
**분류:** 코드 품질

`Refund` 타입을 import하고 안 쓰고 있어요. strict 모드에서 빌드 경고 날 수 있어요.

---

#### F-L3. 페이지네이션에 매직 넘버

**파일:** `client/src/pages/Main/MainPage.tsx:119-132`
**분류:** 코드 가독성

페이지네이션 버튼 수 `5`가 로직 안에 하드코딩돼 있어요. `MAX_PAGE_BUTTONS = 5` 같은 상수로 빼면 나중에 바꾸기 편해요.

---

#### F-L4. 로딩 UI가 전부 똑같음

**파일:** 다수 페이지
**분류:** UX

모든 페이지가 동일한 스피너 + "로딩 중..." 텍스트예요. 나중에 스켈레톤 UI 같은 거 도입하면 체감이 훨씬 좋아질 거예요.

---

#### F-L5. 같은 인터페이스가 여러 파일에 중복 정의

**파일:** `client/src/pages/Cart/CartPage.tsx` 등
**분류:** 코드 품질

`CartItemOption` 같은 타입이 `types/index.ts`에도 있고 각 페이지 파일에도 또 선언돼 있어요. 중앙 타입 파일에서 import해서 쓰면 돼요.

---

## 잘한 점

### 백엔드

1. **트랜잭션 패턴이 깔끔함**: 주문, 선물 거절, 환불, 우편함 보상 등 돈/재고 관련 로직은 전부 `beginTransaction` → `commit` / `rollback` → `finally release`로 처리하고 있음
2. **SQL Injection 방어 완벽**: 전체 컨트롤러에서 `db.execute(sql, [params])` 패턴을 일관되게 사용. 문자열 결합 없음
3. **N+1 문제 해결**: 장바구니 옵션, 주문 아이템 등에서 `IN()` 배치 쿼리로 DB 왕복 최소화
4. **Rate Limiting 적용**: 로그인/회원가입에 15분당 20회 제한으로 브루트포스 방어
5. **이벤트 참여 원자성**: `INSERT...SELECT` 패턴으로 선착순 이벤트의 동시 참여 Race Condition 깔끔하게 처리
6. **제재 시스템 자동화**: 경고 3회 누적 시 자동 7일 정지, 기간 만료 체크까지 체계적
7. **선물 거절 환불 트랜잭션**: 재고·쿠폰·포인트를 하나의 트랜잭션에서 일괄 복원
8. **고정 알림 보호**: 유저가 전체 삭제해도 고정 알림은 안 지워지게 보호
9. **주문 상태 흐름 제어**: 역방향 전환 차단, `completed`/`refunded` 상태는 변경 불가
10. **복합 인덱스**: `orders(user_id, status)`, `notifications(user_id, is_read)` 등 자주 쓰는 쿼리 패턴에 맞는 인덱스 세팅

### 프론트엔드

1. **타입 시스템 잘 활용**: 중앙 `types/index.ts`에서 인터페이스 관리하고, `any` 거의 안 쓰고 있음
2. **ErrorBoundary 적용**: 렌더링 에러 나도 화이트스크린 안 뜨고 복구 UI 보여줌
3. **알림 시스템 완성도 높음**: AlertContext로 토스트/확인 모달 통합, 새 알림 도착 시 토스트까지
4. **API 레이어 설계 좋음**: Axios 인터셉터로 토큰 자동 주입, 401 시 자동 로그아웃 처리
5. **코드 스플리팅**: `React.lazy`로 페이지별 지연 로딩, 초기 로딩 빠름
6. **탭 마운트 최적화**: `mountedTabs` Set으로 안 본 탭은 렌더 안 하고, 본 탭은 유지 — 왔다 갔다 해도 데이터 다시 안 불러옴
7. **위시리스트 연타 방지**: `useRef(new Set())`로 요청 중인 상품을 추적해서 중복 호출 차단
8. **폼 이중 제출 방지**: `submitting` 상태로 로그인/회원가입 버튼 중복 클릭 막음
9. **디자인 시스템 일관성**: CSS 변수 기반으로 색상, 간격, 그림자 통일
10. **컴포넌트 구조**: 기능별 폴더 분리가 잘 돼있어서 파일 찾기 편함

---

## 요약 테이블

| 분류 | 🔴 Critical | 🟠 High | 🟡 Medium | 🔵 Low | 합계 |
|------|:-----------:|:-------:|:---------:|:------:|:----:|
| 백엔드 | 3 | 4 | 8 | 2 | **17** |
| 프론트엔드 | 3 | 5 | 9 | 5 | **22** |
| **합계** | **6** | **9** | **17** | **7** | **39** |

---

## 권장 수정 순서

### 1단계 — Critical (즉시)
1. **F-C1** 리다이렉트 URL 검증 (Open Redirect, 1분 컷)
2. **B-C2** 타임존 혼용 수정 (환불 기한 오차 방지)
3. **B-C1** 옵션 재고 검증 추가 (품절 옵션 주문 차단)
4. **B-C3** 쿠폰 배포 에러 처리 개선
5. **F-C2** Layout useEffect 의존성 수정
6. **F-C3** JSON.parse 안전 처리

### 2단계 — High (이번 주)
7. **B-H1** 선물 거절 이중 환불 방지
8. **B-H2** 쿠폰 수령 원자성 보장
9. **F-H1** 포인트 로컬 업데이트 → 서버 동기화
10. **F-H4** GiftsTab 개별 처리 상태 관리
11. **F-H2** 모달 ESC 키 지원

### 3단계 — Medium (다음 주)
12. **F-M1** placeholder "6자 이상"으로 수정
13. **B-M1** 공지 알림 배치 INSERT
14. **B-M4** 상품 등록 유효성 검증
15. **F-M2** 장바구니 수량 재고 체크
16. 나머지 Medium 항목

### 4단계 — Low (여유 있을 때)
17. 접근성 개선 (ARIA 레이블)
18. 코드 품질 (중복 제거, 상수 분리)
