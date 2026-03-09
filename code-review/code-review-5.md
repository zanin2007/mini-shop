# 코드 리뷰 5차 — 2026-03-05

> 4차 리뷰 수정 이후 전체 코드베이스 재점검. 장바구니 동시성 수정, QuantityInput 컴포넌트 추가, 서버 역할 검증 등 반영된 상태에서 **현재 코드 기준** 발견 사항만 수록.

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

#### B-C1. CORS 기본값이 모든 오리진 허용

**파일:** `server/index.js:32-36`
**분류:** Security / CSRF

```javascript
const allowedOrigins = process.env.CORS_ORIGIN;
app.use(cors({
  origin: allowedOrigins || true,  // CORS_ORIGIN 미설정 시 모든 오리진 허용
  credentials: true
}));
```

`CORS_ORIGIN` 환경변수가 설정되지 않으면 `true`로 fallback되어 **모든 도메인에서 쿠키 포함 요청이 가능**해진다. 악성 사이트에서 로그인된 사용자의 세션으로 API 호출 가능(CSRF).

**수정안:**
```javascript
const allowedOrigins = process.env.CORS_ORIGIN;
if (!allowedOrigins) {
  console.warn('CORS_ORIGIN 환경변수가 설정되지 않았습니다.');
}
app.use(cors({
  origin: allowedOrigins || 'http://localhost:5173',
  credentials: true
}));
```

---

#### B-C2. 옵션 재고 검증 조건문 항상 true

**파일:** `server/controllers/orderController.js:62-72`
**분류:** Bug / 데이터 무결성

```javascript
if (opt.option_stock > 0 || opt.option_stock === 0)
```

`> 0 || === 0`은 음수가 아닌 한 항상 `true`이므로 **재고 0인 옵션도 주문이 통과**된다. 실질적으로 옵션 재고 검증이 동작하지 않음.

**수정안:**
```javascript
if (opt.option_stock != null && opt.option_stock < cartOpt.quantity) {
  // 재고 부족 에러
}
```

---

#### B-C3. 상품 삭제 시 소유자/관리자 권한 미검증

**파일:** `server/controllers/productController.js` (deleteProduct)
**분류:** Security / Authorization

```javascript
router.delete('/:id', authenticateToken, deleteProduct);
```

`authenticateToken`만 적용되어 **로그인한 아무 사용자가 타인의 상품을 삭제** 가능. 소유자(`user_id`) 또는 관리자 여부 확인이 없음.

**수정안:**
```javascript
const [products] = await db.execute('SELECT user_id FROM products WHERE id = ?', [id]);
if (products[0].user_id !== req.user.userId && req.user.role !== 'admin') {
  return res.status(403).json({ message: '삭제 권한이 없습니다.' });
}
```

---

### 백엔드 — Medium

#### B-M1. `updateQuantity` FOR UPDATE 누락 → 동시 요청 시 재고 초과

**파일:** `server/controllers/cartController.js` (updateQuantity)
**분류:** Concurrency / Race Condition

`addToCart`는 트랜잭션 + `FOR UPDATE`로 재고 검증을 직렬화했으나, `updateQuantity`는 행 잠금 없이 재고를 조회한다. 두 탭에서 동시에 수량을 변경하면 재고를 초과하는 장바구니 상태가 가능.

**수정안:** `addToCart`와 동일하게 `getConnection()` → `FOR UPDATE` 패턴 적용.

---

#### B-M2. `addToCart` dead code — `totalProductQty` 미사용

**파일:** `server/controllers/cartController.js:125`
**분류:** Code Quality

```javascript
const totalProductQty = existing.reduce((sum, c) => sum + c.quantity, 0)
  + quantity - (matchedCartId ? 0 : 0);  // (matchedCartId ? 0 : 0)은 항상 0
```

계산 후 참조하지 않는 변수. `(matchedCartId ? 0 : 0)` 표현도 의미 없음.

**수정안:** 미사용 변수 제거 또는 의도에 맞게 수정.

---

#### B-M3. 이벤트 참여 선착순 경쟁 조건

**파일:** `server/controllers/eventController.js:84-89`
**분류:** Concurrency / Race Condition

`INSERT ... SELECT ... HAVING COUNT(*) < max_participants` 패턴은 트랜잭션 격리 수준에 따라 동시 삽입 시 max_participants를 초과할 수 있다. InnoDB의 기본 REPEATABLE READ에서는 gap lock으로 어느 정도 보호되지만 완전하지 않음.

**수정안:** `FOR UPDATE`로 이벤트 행 잠금 후 COUNT 체크, 또는 `event_participants` 테이블에 UNIQUE(event_id, user_id) + 애플리케이션 레벨 재시도.

---

#### B-M4. 선물 거절 시 `FOR UPDATE` 누락 → 이중 환불 가능

**파일:** `server/controllers/giftController.js:113-128`
**분류:** Concurrency / Race Condition

`rejectGift`에서 선물 상태를 조회할 때 `FOR UPDATE` 없이 `SELECT` → 두 요청이 동시에 `status='pending'` 통과 → 이중 환불(재고 복원, 포인트 반환 중복).

**수정안:**
```sql
SELECT * FROM gifts WHERE id = ? AND receiver_id = ? FOR UPDATE
```

---

#### B-M5. 주문 최종 금액 음수 가능

**파일:** `server/controllers/orderController.js:139-161`
**분류:** Bug / 비즈니스 로직

포인트 사용량이 `totalAmount - discountAmount`보다 크면 `finalAmount`가 음수가 된다. 프론트에서 제한하더라도 API 직접 호출로 우회 가능.

**수정안:**
```javascript
const finalAmount = Math.max(0, totalAmount - discountAmount - pointsUsed);
```

---

#### B-M6. 이벤트 보상 금액 음수 미검증

**파일:** `server/controllers/adminController.js:316-350` (createEvent)
**분류:** Validation

`reward_amount`에 대한 음수 검증이 없어 음수 포인트 보상 이벤트를 생성할 수 있다. 참여자의 포인트가 차감될 수 있음.

**수정안:** `if (reward_amount != null && reward_amount < 0)` 검증 추가.

---

#### B-M7. 일부 트랜잭션 finally 블록 누락 → 커넥션 누수

**파일:** 여러 컨트롤러 (giftController, eventController, refundController 등)
**분류:** Resource Leak

catch 블록에서 `connection.rollback()` + `connection.release()`를 호출하지만 `finally` 블록이 아닌 경우가 있어, rollback 자체가 실패하면 커넥션이 반환되지 않음.

**수정안:** 모든 트랜잭션 사용부에 `finally { connection.release(); }` 패턴 적용.

---

#### B-M8. 리뷰 중복 작성 경쟁 조건

**파일:** `server/controllers/reviewController.js:43-51`
**분류:** Concurrency / 데이터 무결성

`check → insert` 사이에 동시 요청으로 같은 사용자의 리뷰가 중복 삽입 가능. DB에 UNIQUE(user_id, product_id) 제약이 없음.

**수정안:** `UNIQUE(user_id, product_id)` 제약 추가 + `INSERT IGNORE` 또는 `ON DUPLICATE KEY` 사용.

---

#### B-M9. 관리자 주문 상태 변경 동시성 문제

**파일:** `server/controllers/adminController.js` (updateOrderStatus)
**분류:** Concurrency

두 관리자가 동시에 같은 주문의 상태를 변경하면 예기치 않은 상태 전이가 발생할 수 있음. `WHERE status = ?` 조건이 없어 이전 상태를 확인하지 않음.

**수정안:**
```sql
UPDATE orders SET status = ? WHERE id = ? AND status = ?
-- affectedRows === 0이면 '이미 변경된 주문입니다' 반환
```

---

#### B-M10. URL 파라미터 정수 미검증

**파일:** 대부분의 컨트롤러 (`req.params.id` 사용부)
**분류:** Validation

`req.params.id`가 숫자인지 검증하지 않고 SQL 쿼리에 전달. 비숫자 문자열은 MySQL에서 0으로 처리되어 잘못된 결과를 반환할 수 있음.

**수정안:** 라우트 레벨 또는 컨트롤러 진입부에서 `parseInt` + `Number.isInteger` 검증.

---

### 백엔드 — Low

#### B-L1. 보안 헤더 미적용 (Helmet)

**파일:** `server/index.js`
**분류:** Security

X-Frame-Options, X-Content-Type-Options 등 보안 헤더가 없음. Clickjacking, MIME sniffing 공격에 취약.

**수정안:** `app.use(helmet())` 추가.

---

#### B-L2. 상태 변경 작업 감사 로그 없음

**파일:** 전체 컨트롤러
**분류:** Observability

환불, 주문 상태 변경, 쿠폰 배포 등 민감한 작업에 대한 감사 로그(audit log)가 없어 문제 발생 시 추적이 어려움.

**수정안:** `audit_logs` 테이블 생성 후 민감 작업에 로깅 추가.

```sql
-- initDB.js에 테이블 추가
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(30) NOT NULL,
  target_id INT NOT NULL,
  details JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id)
)
```

```javascript
// 컨트롤러에서 상태 변경 후 로깅 (예: processRefund)
await db.execute(
  'INSERT INTO audit_logs (admin_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
  [req.user.userId, 'refund_approve', 'refund', refundId, JSON.stringify({ order_id: orderId, amount })]
);
```

> **외부 정보 불필요** — 기존 DB 구조에 테이블 추가만으로 구현 가능.

---

#### B-L3. 상품 설명/관리자 메모 길이 미검증

**파일:** `productController.js`, `adminController.js`
**분류:** Validation

TEXT 필드에 대한 서버사이드 길이 제한이 없어 매우 큰 텍스트를 전송할 수 있음.

**수정안:** 서버에서 최대 길이 검증 (예: 5,000자).

---

#### B-L4. 쿠폰 배포 트랜잭션 미사용

**파일:** `server/controllers/adminController.js:189-236`
**분류:** 데이터 무결성

여러 사용자에게 쿠폰을 배포할 때 건별 INSERT로 처리. 중간에 실패하면 일부만 배포됨.

**수정안:** 전체 배포를 트랜잭션으로 감싸거나 배치 INSERT 사용.

---

## 프론트엔드

### 프론트엔드 — Critical

#### F-C1. 체크아웃 주문 중 폼 입력 비활성화 없음

**파일:** `client/src/pages/Checkout/CheckoutPage.tsx:114-159`
**분류:** Bug / UX

`ordering` 상태가 true일 때 제출 버튼만 비활성화되고, 배송지/쿠폰/포인트 입력은 여전히 수정 가능. 사용자가 주문 중 값을 변경하면 서버에 전송된 데이터와 불일치.

**수정안:** `ordering` 상태일 때 모든 폼 입력에 `disabled` 속성 추가 또는 `<fieldset disabled={ordering}>` 래핑.

---

### 프론트엔드 — Medium

#### F-M1. CartPage `handleUpdateQuantity` stale closure

**파일:** `client/src/pages/Cart/CartPage.tsx:78-100`
**분류:** Bug / State Management

```javascript
const handleUpdateQuantity = useCallback((id: number, quantity: number) => {
  const item = cartItems.find(i => i.id === id);  // cartItems 클로저 캡처
  if (!item || quantity < 1 || quantity > getMaxStock(item)) return;
  // ...
}, [cartItems, showAlert, fetchCart]);
```

`cartItems`가 의존성에 포함되어 있어 수량이 바뀔 때마다 콜백이 재생성됨. 디바운스 타이머 내부의 `quantity`도 최초 호출 시점의 값이 아닌 마지막 콜백 생성 시점의 클로저를 사용하므로, 빠른 연속 변경 시 중간 값이 무시될 수 있음.

**수정안:** `cartItems`를 ref로 추적하거나, `getMaxStock`에 필요한 값만 인자로 전달:
```javascript
const cartItemsRef = useRef(cartItems);
cartItemsRef.current = cartItems;

const handleUpdateQuantity = useCallback((id: number, quantity: number) => {
  const item = cartItemsRef.current.find(i => i.id === id);
  // ...
}, [showAlert, fetchCart]);
```

---

#### F-M2. `maxQuantity` 옵션 부분 선택 시 부정확

**파일:** `client/src/pages/Product/ProductDetailPage.tsx:215-227`
**분류:** Bug / 비즈니스 로직

옵션이 3개 중 1개만 선택된 경우, 미선택 옵션의 재고가 무시되어 `maxQuantity`가 실제보다 높게 계산됨. 모든 옵션 선택 전에는 상품 재고만으로 제한됨.

**수정안:** 모든 필수 옵션이 선택될 때까지 `maxQuantity`를 1로 제한하거나, 미선택 옵션의 최소 재고를 반영.

---

#### F-M3. 401 인터셉터 경로 체크 부정확

**파일:** `client/src/api/instance.ts:29`
**분류:** Bug

```javascript
!window.location.pathname.includes('/login')
```

`.includes()`는 `/checkout/login-verify` 같은 경로에서도 매칭됨.

**수정안:** `window.location.pathname !== '/login'` 또는 `.startsWith('/login')`.

---

#### F-M4. Layout 폴링이 다른 탭 로그아웃 시 계속 실행

**파일:** `client/src/components/Layout.tsx:61-77`
**분류:** Performance / Resource Leak

다른 탭에서 로그아웃해도 현재 탭의 30초 폴링 인터벌이 계속 실행되어 불필요한 API 호출 발생.

**수정안:** `storage` 이벤트 리스닝 또는 `userUpdated` 이벤트에서 인터벌 클리어:
```javascript
useEffect(() => {
  const handleLogout = () => { /* clear interval */ };
  window.addEventListener('storage', handleLogout);
  return () => window.removeEventListener('storage', handleLogout);
}, []);
```

---

#### F-M5. AdminEventsTab 당첨자 수 미검증

**파일:** `client/src/pages/Admin/AdminEventsTab.tsx:105-116`
**분류:** Validation

`drawCount` 입력값에 대한 검증이 없어 0, 음수, 참가자 수 초과 값으로 추첨 API 호출 가능.

**수정안:** `if (count <= 0 || count > event.current_participants)` 검증 추가.

---

#### F-M6. DeliveryForm 전화번호 포맷 버그

**파일:** `client/src/pages/Checkout/DeliveryForm.tsx:20-28`
**분류:** Bug

`formatPhone` 함수가 이미 포맷된 번호(하이픈 포함)를 붙여넣기하면 하이픈이 중복 추가됨. 숫자 추출 후 포맷팅해야 함.

**수정안:**
```javascript
const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0,3)}-${digits.slice(3)}`;
  return `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7,11)}`;
};
```

---

#### F-M7. OptionsEditor 실시간 검증 없음

**파일:** `client/src/pages/Product/OptionsEditor.tsx:52-100`
**분류:** Validation / UX

옵션 값의 중복, 추가금액/재고 음수 여부를 편집 중 검증하지 않아 잘못된 데이터가 제출될 수 있음.

**수정안:** 값 변경 시 즉시 검증 + 에러 메시지 표시.

---

#### F-M8. MailboxPage 날짜 비교 타임존 불일치

**파일:** `client/src/pages/Mailbox/MailboxPage.tsx:72, 119-120`
**분류:** Bug

```javascript
new Date(mail.expires_at) < new Date()
```

서버는 UTC, 클라이언트는 로컬 타임존. UTC+9(한국) 기준 최대 9시간 차이로 만료 판정이 달라질 수 있음.

**수정안:** 서버에서 만료 여부를 응답에 포함하거나, `Date.now()` 대신 서버 시간 기준으로 비교.

---

#### F-M9. SettingsTab 닉네임 길이 미검증

**파일:** `client/src/pages/MyPage/SettingsTab.tsx:29-49`
**분류:** Validation

닉네임이 공백이 아닌지만 확인하고, 최소/최대 길이 검증이 없음. 1자 또는 100자 이상 닉네임 설정 가능.

**수정안:** `if (newNickname.trim().length < 2 || newNickname.trim().length > 20)` 검증 추가.

---

#### F-M10. AlertProvider unmount 시 타이머 누수

**파일:** `client/src/components/AlertContext.tsx`
**분류:** Resource Leak

Provider가 언마운트될 때 남아있는 토스트 타이머를 정리하는 cleanup이 없음.

**수정안:**
```javascript
useEffect(() => {
  return () => {
    timerMap.current.forEach(timer => clearTimeout(timer));
    timerMap.current.clear();
  };
}, []);
```

---

#### F-M11. AdminAnnouncementsTab 폼 입력 미검증

**파일:** `client/src/pages/Admin/AdminAnnouncementsTab.tsx:44-56`
**분류:** Validation

공지사항 생성 시 제목/내용이 비어있는지 JS에서 검증하지 않음. HTML `required` 속성은 우회 가능.

**수정안:** 제출 핸들러에서 `if (!title.trim() || !content.trim())` 검증 추가.

---

#### F-M12. MainPage 타입 안전성 위반

**파일:** `client/src/pages/Main/MainPage.tsx:204`
**분류:** Type Safety

```javascript
handleToggleWishlist(e as unknown as React.MouseEvent, product.id);
```

`KeyboardEvent`를 `as unknown as React.MouseEvent`로 이중 캐스팅. 타입 시스템 무력화.

**수정안:** 핸들러가 `React.SyntheticEvent`를 받도록 타입 변경하거나, 이벤트 객체를 사용하지 않는 별도 함수로 분리.

---

### 프론트엔드 — Low

#### F-L1. CartPage 체크박스 접근성 부족

**파일:** `client/src/pages/Cart/CartPage.tsx:150-155`
**분류:** Accessibility

개별 상품 체크박스에 `<label>`이나 `aria-label`이 없어 스크린 리더에서 용도를 알 수 없음.

**수정안:** `aria-label={`${item.name} 선택`}` 추가.

---

#### F-L2. NotificationPage `formatTime` 타임존 불일치

**파일:** `client/src/pages/Notification/NotificationPage.tsx:147-160`
**분류:** Bug

`new Date()`로 서버 시간을 파싱하여 상대 시간 표시. 서버 UTC vs 클라이언트 로컬 타임존 차이로 "방금 전"이 수시간 전일 수 있음.

**수정안:** 서버 UTC 문자열에 `Z` 접미사를 붙여 `Date`가 UTC로 해석하도록 보장:

```typescript
const formatTime = (dateStr: string) => {
  // MySQL DATETIME은 타임존 정보가 없으므로 UTC임을 명시
  const utcStr = dateStr.endsWith('Z') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
  const date = new Date(utcStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;
  return date.toLocaleDateString('ko-KR');
};
```

---

#### F-L3. AdminCouponsTab 만료일 타임존 이슈

**파일:** `client/src/pages/Admin/AdminCouponsTab.tsx:53`
**분류:** Bug

```javascript
new Date(couponForm.expiry_date) < new Date()
```

동일한 UTC vs 로컬 타임존 문제. 한국 시간 기준 당일 만료 쿠폰이 "만료됨"으로 처리될 수 있음.

**수정안:** 만료일은 날짜 단위 비교이므로 시간을 제거하고 날짜만 비교:

```typescript
// 날짜만 비교 (시간/타임존 영향 제거)
const expiryDate = couponForm.expiry_date; // "2026-03-10" (date input value)
const today = new Date().toISOString().split('T')[0]; // "2026-03-06"
if (expiryDate && expiryDate < today) {
  showAlert('만료일은 현재 날짜 이후여야 합니다.', 'error');
  return;
}
```

---

#### F-L4. 추천 상품 fetch 에러 무시

**파일:** `client/src/pages/Product/ProductDetailPage.tsx:36-39`
**분류:** Code Quality

```javascript
api.get(`/products?category=...`).then(recRes => {
  setRecommendedProducts(...);
}).catch(() => {});
```

빈 catch로 에러를 완전히 무시. 최소한 콘솔 로깅 추가 필요.

**수정안:**
```typescript
api.get(`/products?category=${encodeURIComponent(prod.category)}`).then(recRes => {
  setRecommendedProducts(recRes.data.filter((p: Product) => p.id !== prod.id).slice(0, 4));
}).catch((err) => {
  console.warn('추천 상품 로드 실패:', err.message);
});
```

---

## 요약

| 분류 | Critical | Medium | Low | 합계 |
|------|----------|--------|-----|------|
| 백엔드 | 3 | 10 | 4 | 17 |
| 프론트엔드 | 1 | 12 | 4 | 17 |
| **합계** | **4** | **22** | **8** | **34** |

### 주요 카테고리별 분포

| 카테고리 | 건수 |
|----------|------|
| Security / Authorization | 4 |
| Concurrency / Race Condition | 6 |
| Validation | 9 |
| Bug / 비즈니스 로직 | 7 |
| Resource Leak | 3 |
| Code Quality / UX | 5 |

---

## 권장 수정 순서

### 1단계 — Critical (즉시 수정)
1. **B-C3** 상품 삭제 권한 검증 — 타인의 상품 삭제 가능한 보안 취약점
2. **B-C2** 옵션 재고 검증 조건 수정 — 재고 0인 옵션으로 주문 가능
3. **B-C1** CORS 기본값 수정 — 모든 오리진 허용 방지
4. **F-C1** 체크아웃 폼 비활성화 — 주문 중 데이터 변경 방지

### 2단계 — High Priority Medium (동시성/보안)
5. **B-M1** updateQuantity FOR UPDATE 추가
6. **B-M4** 선물 거절 FOR UPDATE 추가
7. **B-M5** 주문 최종 금액 음수 방지
8. **B-M7** 트랜잭션 finally 블록 정리
9. **B-M8** 리뷰 UNIQUE 제약 추가
10. **F-M1** CartPage stale closure 수정

### 3단계 — Validation/UX
11. **B-M3, B-M9** 이벤트/주문 동시성
12. **F-M2** maxQuantity 부분 선택 처리
13. **F-M5~M9** 프론트엔드 입력 검증
14. **F-M3** 401 인터셉터 경로 체크

### 4단계 — Low Priority
15. 나머지 Low 항목들 (접근성, 타임존, 로깅 등)
