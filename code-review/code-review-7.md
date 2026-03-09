# 코드 리뷰 7차 — 2026-03-09

> 5차 리뷰 Critical/Medium/Low 전체 수정 + 6차 리뷰 Medium/Low 수정 반영 후, 현재 git diff 기준 최종 검토.

---

## 변경 파일 (18개)

| 파일 | 변경 내용 |
|------|-----------|
| `CLAUDE.md` | Persona 섹션 추가 |
| `client/src/api/instance.ts` | 401 인터셉터 `.includes` → `!==` |
| `client/src/pages/Admin/AdminEventsTab.tsx` | 추첨 인원 검증 추가 |
| `client/src/pages/Cart/CartPage.tsx` | stale closure → useRef |
| `client/src/pages/Checkout/CheckoutPage.css` | `.checkout-fieldset` 클래스 |
| `client/src/pages/Checkout/CheckoutPage.tsx` | fieldset disabled 래핑 |
| `client/src/pages/Mailbox/MailboxPage.tsx` | UTC 타임존 비교 수정 |
| `client/src/pages/MyPage/SettingsTab.tsx` | 닉네임 2~20자 검증 |
| `client/src/pages/Product/OptionsEditor.tsx` | 추가금액/재고 음수 방지 |
| `client/src/pages/Product/ProductDetailPage.tsx` | maxQuantity 옵션 부분 선택 수정 |
| `server/config/initDB.js` | UNIQUE 제약 + 인덱스 5개 |
| `server/controllers/adminController.js` | 원자적 UPDATE, 배치 배포/추첨/환불, 보상 음수 검증 |
| `server/controllers/cartController.js` | updateQuantity FOR UPDATE + dead code 제거 |
| `server/controllers/eventController.js` | FOR UPDATE + COUNT 체크 |
| `server/controllers/giftController.js` | FOR UPDATE + 배치 재고복원 |
| `server/controllers/orderController.js` | 옵션 재고 `!= null` + finalAmount 음수 방지 |
| `server/controllers/productController.js` | 삭제 권한 관리자 허용 |
| `code-review/code-review-5.md` | 수정안 추가 |

---

## 리뷰 결과

### 🔴 Critical

없음.

---

### 🟡 Medium

#### M-1. `drawEventWinners` 배치 처리에 트랜잭션 누락

**파일:** `server/controllers/adminController.js` (drawEventWinners)
**분류:** 데이터 무결성

```javascript
// 배치 UPDATE — 당첨자 일괄 처리
await db.execute(`UPDATE event_participants SET is_winner = true WHERE id IN (${winnerPh})`, winnerIds);

// 보상 지급 (우편함) — 배치 INSERT
if (event.reward_type) {
  await db.execute(`INSERT INTO mailbox ...`, mailVals);
}

// 알림 — 배치 INSERT
await db.execute(`INSERT INTO notifications ...`, notiVals);
```

당첨자 UPDATE → 우편함 INSERT → 알림 INSERT가 3개의 독립 쿼리로 실행된다. 우편함 INSERT 성공 후 알림 INSERT에서 실패하면, 당첨은 되었지만 알림이 없는 불완전 상태가 된다. `distributeCoupon`에는 트랜잭션이 추가되었으나, `drawEventWinners`에는 누락.

**수정안:**
```javascript
const connection = await db.getConnection();
try {
  await connection.beginTransaction();
  await connection.execute(`UPDATE event_participants ...`);
  if (event.reward_type) await connection.execute(`INSERT INTO mailbox ...`);
  await connection.execute(`INSERT INTO notifications ...`);
  await connection.commit();
} catch (err) {
  await connection.rollback();
  throw err;
} finally {
  connection.release();
}
```

---

#### M-2. `updateQuantity` 입력 검증 후 불필요한 rollback

**파일:** `server/controllers/cartController.js:193-196`
**분류:** Code Quality / 리소스

```javascript
const connection = await db.getConnection();
try {
  await connection.beginTransaction();
  const { id } = req.params;
  const { quantity } = req.body;
  if (!Number.isInteger(quantity) || quantity < 1) {
    await connection.rollback();  // 트랜잭션에서 아무 작업 안 했는데 rollback
    return res.status(400).json({ ... });
  }
```

입력 검증은 DB 작업 전이므로, 검증 실패 시 커넥션 획득 자체가 불필요하다. 검증을 `getConnection()` 전으로 이동하면 불필요한 커넥션 풀 점유를 방지할 수 있다.

**수정안:**
```javascript
exports.updateQuantity = async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;
  if (!Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ message: '수량은 1 이상의 정수여야 합니다.' });
  }
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    // ... DB 작업
```

---

#### M-3. `OptionsEditor` 음수 방지 로직 우회 가능

**파일:** `client/src/pages/Product/OptionsEditor.tsx:70-73`
**분류:** Validation / 엣지 케이스

```javascript
const raw = e.target.value;
const sanitized = Number(raw) < 0 ? '0' : raw;
```

`Number('')`은 `0`이므로 빈 문자열은 `'0'`으로 치환되지 않고 그대로 통과한다. 빈 입력 후 서버에 전송하면 `NaN`이나 `0`으로 처리될 수 있다. 또한 `'-'`(마이너스 기호만 입력)은 `Number('-')`이 `NaN`이고, `NaN < 0`은 `false`라서 `'-'`가 그대로 상태에 저장된다.

**현재 영향:** 서버에서 숫자 파싱하므로 실제 장애는 낮음. 다만 UX에서 `-` 문자가 입력에 남을 수 있음.

**수정안:**
```javascript
const raw = e.target.value;
const num = Number(raw);
const sanitized = raw === '' ? '' : (isNaN(num) || num < 0) ? '0' : raw;
```

---

### 🔵 Low

#### L-1. `MailboxPage` UTC 변환 로직 중복

**파일:** `client/src/pages/Mailbox/MailboxPage.tsx:72-76, 122-124`
**분류:** Code Quality / DRY

```javascript
// handleClaim 내
const expiresUtc = mail.expires_at.endsWith('Z') ? mail.expires_at : mail.expires_at.replace(' ', 'T') + 'Z';

// isExpired 내
const utcStr = mail.expires_at.endsWith('Z') ? mail.expires_at : mail.expires_at.replace(' ', 'T') + 'Z';
```

동일한 UTC 변환 로직이 2곳에 중복. 헬퍼 함수로 추출하면 유지보수성 향상.

**수정안:**
```javascript
const toUtcStr = (dateStr: string) =>
  dateStr.endsWith('Z') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
```

---

#### L-2. `AdminEventsTab` `current_participants || 0` 기본값

**파일:** `client/src/pages/Admin/AdminEventsTab.tsx:247`
**분류:** 엣지 케이스

```javascript
handleDraw(ev.id, Number(drawCount[ev.id]) || 1, ev.current_participants || 0)
```

`current_participants`가 `0`일 때 `|| 0`은 정상 동작하지만, `undefined`일 때 `0`으로 설정되면 검증 로직에서 `count(1) > currentParticipants(0)`으로 추첨이 차단된다. 참가자가 없는 게 아니라 데이터가 누락된 경우를 구분하지 못함.

**현재 영향:** 서버에서도 참가자 수를 검증하므로 안전. 다만 에러 메시지가 서버/클라이언트에서 달라질 수 있음.

---

#### L-3. `CartPage` `getMaxStock` 함수가 `useCallback` 외부에서 정의

**파일:** `client/src/pages/Cart/CartPage.tsx:71-75, 83`
**분류:** Code Quality

```javascript
const getMaxStock = (item: CartPageItem) => { ... };  // 컴포넌트 본문
// ...
const handleUpdateQuantity = useCallback((id: number, quantity: number) => {
  const item = cartItemsRef.current.find(i => i.id === id);
  if (!item || quantity < 1 || quantity > getMaxStock(item)) return;  // getMaxStock 참조
}, [showAlert, fetchCart]);
```

`getMaxStock`이 매 렌더마다 새로 생성되지만, `useCallback`의 의존성 배열에 포함되지 않았다. 현재는 `getMaxStock`이 외부 상태를 참조하지 않아 실질적 문제는 없으나, 향후 변경 시 버그 원인이 될 수 있음.

**현재 영향:** `getMaxStock`은 순수 함수(인자만 사용)이므로 실제 문제 없음.

---

#### L-4. `initDB.js` 리뷰 UNIQUE 마이그레이션 에러 핸들링

**파일:** `server/config/initDB.js:267`
**분류:** Code Quality

```javascript
if (e.code !== 'ER_DUP_KEYNAME') console.warn('리뷰 UNIQUE 제약 추가 실패:', e.message);
```

`ER_DUP_KEYNAME`만 무시하지만, 기존 데이터에 `(user_id, product_id)` 중복 행이 있으면 `ER_DUP_ENTRY`로 실패한다. 이 경우 UNIQUE 제약이 추가되지 않으면서 경고만 출력.

**수정안:** 마이그레이션 전 중복 행 확인 쿼리 추가:
```javascript
const [dupes] = await connection.execute(
  'SELECT user_id, product_id, COUNT(*) as cnt FROM reviews GROUP BY user_id, product_id HAVING cnt > 1'
);
if (dupes.length > 0) {
  console.warn(`리뷰 중복 데이터 ${dupes.length}건 발견. 수동 정리 후 UNIQUE 제약을 추가해주세요.`);
} else {
  await connection.query('ALTER TABLE reviews ADD UNIQUE KEY uq_user_product (user_id, product_id)');
}
```

---

## 요약

| 분류 | Critical | Medium | Low | 합계 |
|------|----------|--------|-----|------|
| 백엔드 | 0 | 2 | 2 | 4 |
| 프론트엔드 | 0 | 1 | 2 | 3 |
| **합계** | **0** | **3** | **4** | **7** |
사항

### 긍정적 변경 
- **Critical 0건 유지** — 5차 리뷰 대비 보안/동시성 이슈 완전 해소
- **FOR UPDATE 일관 적용** — cartController, giftController, eventController 모두 행 잠금
- **배치 처리 전환** — N+1 쿼리 4곳 → CASE UPDATE / 배치 INSERT로 개선
- **원자적 상태 변경** — `updateOrderStatus`에 `WHERE status = ?` 조건 추가
- **쿠폰 배포 트랜잭션** — 부분 배포 방지
- **프론트엔드 검증 강화** — 닉네임 길이, 추첨 인원, 옵션 음수, 타임존 비교
- **stale closure 해결** — CartPage `useRef` 패턴 적용
- **dead code 정리** — `totalProductQty` 미사용 변수 제거

### 전체 진행 현황

| 리뷰 | Critical | Medium | Low | 상태 |
|------|----------|--------|-----|------|
| 5차 | 4 | 22 | 8 | 대부분 수정 완료 |
| 6차 | 0 | 6 | 6 | 전체 수정 완료 |
| **7차** | **0** | **3** | **4** | **신규 발견** |

---

## 권장 수정 순서

### 1단계 — Medium
1. **M-1** drawEventWinners 트랜잭션 래핑
2. **M-2** updateQuantity 입력 검증 위치 조정
3. **M-3** OptionsEditor `-` 문자 입력 처리 (선택적)

### 2단계 — Low
4. **L-1** MailboxPage UTC 변환 헬퍼 추출
5. **L-4** initDB 중복 행 확인 로직
6. **L-2, L-3** 기타 정리 (영향 없음, 선택적)
