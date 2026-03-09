# 코드 리뷰 6차 — 2026-03-09

> 5차 리뷰 수정 반영 + 3단계(Validation/UX) 수정 후 변경사항 전체 검토. 보안/동시성/엣지케이스/성능/타입안전성 관점 점검.

---

## 목차

- [백엔드](#백엔드)
  - [🟡 Medium](#백엔드--medium)
  - [🔵 Low](#백엔드--low)
- [프론트엔드](#프론트엔드)
  - [🟡 Medium](#프론트엔드--medium)
  - [🔵 Low](#프론트엔드--low)
- [요약](#요약)
- [권장 수정 순서](#권장-수정-순서)

---

## 변경 파일 목록

| 파일 | 변경 유형 |
|------|-----------|
| `CLAUDE.md` | Persona 섹션 추가 |
| `client/package.json`, `client/package-lock.json` | `rollup-plugin-visualizer` devDependency 추가 |
| `client/src/api/instance.ts` | 401 인터셉터 경로 체크 수정 |
| `client/src/pages/Admin/AdminEventsTab.tsx` | 추첨 인원 검증 추가 |
| `client/src/pages/Cart/CartPage.tsx` | stale closure 수정 (useRef) |
| `client/src/pages/Checkout/CheckoutPage.tsx` | fieldset disabled 래핑 |
| `client/src/pages/Mailbox/MailboxPage.tsx` | 타임존 비교 수정 |
| `client/src/pages/MyPage/SettingsTab.tsx` | 닉네임 길이 검증 추가 |
| `client/src/pages/Product/OptionsEditor.tsx` | 음수 입력 방지 |
| `client/src/pages/Product/ProductDetailPage.tsx` | maxQuantity 옵션 부분 선택 수정 |
| `server/config/initDB.js` | UNIQUE 제약 + 인덱스 5개 추가 |
| `server/controllers/adminController.js` | 주문 상태 원자적 UPDATE, 쿠폰 배치 배포, 이벤트 배치 추첨, 환불 배치 재고복원 |
| `server/controllers/cartController.js` | updateQuantity 트랜잭션 + FOR UPDATE |
| `server/controllers/eventController.js` | 이벤트 참여 FOR UPDATE + COUNT 체크 |
| `server/controllers/giftController.js` | 선물 거절 FOR UPDATE + 배치 재고복원 |
| `server/controllers/orderController.js` | 옵션 재고 검증 수정, finalAmount 음수 방지 |
| `server/controllers/productController.js` | 상품 삭제 권한 검증 추가 |
| `code-review/code-review-5.md` | 수정안 추가 |

---

## 백엔드

### 백엔드 — Medium

#### B-M1. 이벤트 참여 중복 검사 제거 시 ER_DUP_ENTRY 의존

**파일:** `server/controllers/eventController.js:94`
**분류:** Concurrency / 엣지 케이스

```javascript
await connection.execute('INSERT INTO event_participants (event_id, user_id) VALUES (?, ?)', [id, userId]);
```

기존 코드에서는 `INSERT ... SELECT` 패턴으로 중복을 방지했고, `catch`에서 `ER_DUP_ENTRY`를 처리했다. 수정 후 `FOR UPDATE` + `COUNT` 체크로 인원 초과는 방지되지만, **UNIQUE(event_id, user_id) 제약이 DB에 있어야** 중복 참여가 완전히 차단된다. 현재 `catch`에서 `ER_DUP_ENTRY`를 처리하고 있어 실제로는 동작하지만, 명시적 중복 체크가 없어 코드 가독성이 떨어짐.

**현재 상태:** `catch` 블록에서 `ER_DUP_ENTRY` 처리가 있어 실질적으로 안전. 다만 의도가 명확하지 않음.

**수정안:** (이미 수정 반영됨 — linter가 중복 검사 로직을 추가)
```javascript
// 중복 참여 방지 (명시적 체크)
const [existing] = await connection.execute(
  'SELECT id FROM event_participants WHERE event_id = ? AND user_id = ?', [id, userId]
);
if (existing.length > 0) {
  await connection.rollback();
  return res.status(400).json({ message: '이미 참여한 이벤트입니다.' });
}
```

> **상태: 수정 완료** — linter에 의해 중복 검사가 추가됨.

---

#### B-M2. 쿠폰 배치 배포 시 트랜잭션 미사용

**파일:** `server/controllers/adminController.js:219-237`
**분류:** 데이터 무결성

```javascript
const CHUNK = 100;
for (let i = 0; i < targetUsers.length; i += CHUNK) {
  // ... user_coupons INSERT
  // ... mailbox INSERT
  // ... notifications INSERT
}
```

100명씩 청크 처리하지만, 전체를 트랜잭션으로 감싸지 않아 중간 청크 실패 시 **일부 유저만 쿠폰을 받는** 상태가 발생할 수 있다. 500명 배포 중 300명째에서 에러 발생 시 200명만 배포 완료.

**수정안:**
```javascript
const connection = await db.getConnection();
try {
  await connection.beginTransaction();
  // ... 청크 INSERT (connection 사용)
  await connection.commit();
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
}
```

---

#### B-M3. `updateQuantity` 검증 전 rollback 호출

**파일:** `server/controllers/cartController.js:193-196`
**분류:** Code Quality / 엣지 케이스

```javascript
if (!Number.isInteger(quantity) || quantity < 1) {
  await connection.rollback();
  return res.status(400).json({ message: '수량은 1 이상의 정수여야 합니다.' });
}
```

`beginTransaction()` 직후 입력 검증에서 실패 시 `rollback()`을 호출하지만, 트랜잭션에서 아무 작업도 하지 않은 상태라 불필요한 호출이다. 동작에 문제는 없지만, **입력 검증을 트랜잭션 시작 전으로 이동**하면 불필요한 커넥션 획득을 방지할 수 있다.

**수정안:**
```javascript
exports.updateQuantity = async (req, res) => {
  const { quantity } = req.body;
  if (!Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ message: '수량은 1 이상의 정수여야 합니다.' });
  }
  const connection = await db.getConnection();
  // ...
};
```

---

### 백엔드 — Low

#### B-L1. `rollup-plugin-visualizer`가 devDependency에 남아있음

**파일:** `client/package.json`
**분류:** Code Quality

번들 분석 용도로 추가된 `rollup-plugin-visualizer`가 `devDependencies`에 남아있다. `vite.config.ts`에서 사용하지 않으므로 불필요한 의존성.

**수정안:** `npm uninstall rollup-plugin-visualizer` 실행.

---

#### B-L2. `addToCart` dead code 미정리

**파일:** `server/controllers/cartController.js:125`
**분류:** Code Quality

5차 리뷰 B-M2에서 지적된 `totalProductQty` 미사용 변수가 여전히 존재.

```javascript
const totalProductQty = existing.reduce((sum, c) => sum + c.quantity, 0) + quantity - (matchedCartId ? 0 : 0);
```

**수정안:** 해당 라인 삭제.

---

#### B-L3. 이벤트 보상 금액 음수 미검증

**파일:** `server/controllers/adminController.js` (createEvent)
**분류:** Validation

5차 리뷰 B-M6에서 지적된 `reward_amount` 음수 검증이 여전히 없음.

**수정안:** 이벤트 생성 시 `if (reward_amount != null && reward_amount < 0)` 검증 추가.

---

## 프론트엔드

### 프론트엔드 — Medium

#### F-M1. `MailboxPage` UTC 변환 시 `expires_at`가 undefined일 때 `'undefinedZ'` 생성

**파일:** `client/src/pages/Mailbox/MailboxPage.tsx:72`
**분류:** Bug / 엣지 케이스

```javascript
const expiresUtc = mail.expires_at?.endsWith('Z') ? mail.expires_at : mail.expires_at?.replace(' ', 'T') + 'Z';
if (expiresUtc && new Date(expiresUtc) < new Date()) {
```

`mail.expires_at`가 `undefined`일 때, 옵셔널 체이닝(`?.endsWith`)이 `undefined`를 반환하여 삼항 연산자의 `false` 분기로 진입한다. `undefined?.replace(...)` → `undefined`, 그리고 `undefined + 'Z'` → **`'undefinedZ'`** 문자열이 된다. `new Date('undefinedZ')`는 `Invalid Date`이므로 비교가 항상 `false`가 되어 만료 체크가 무시됨.

실제로 `mail.expires_at`가 없는 경우가 있다면 버그. `if (expiresUtc && ...)` 조건에서 `'undefinedZ'`는 truthy이므로 통과함.

**수정안:**
```javascript
if (mail.expires_at) {
  const expiresUtc = mail.expires_at.endsWith('Z') ? mail.expires_at : mail.expires_at.replace(' ', 'T') + 'Z';
  if (new Date(expiresUtc) < new Date()) {
    showAlert('만료된 우편입니다.', 'error');
    return;
  }
}
```

---

#### F-M2. `OptionsEditor` 음수 방지 로직에서 빈 문자열 처리

**파일:** `client/src/pages/Product/OptionsEditor.tsx:70-73`
**분류:** Bug / UX

```javascript
const raw = e.target.value;
const sanitized = Number(raw) < 0 ? '0' : raw;
```

사용자가 입력값을 모두 지우면 `raw = ''`, `Number('') = 0`, `0 < 0`은 `false`이므로 빈 문자열이 그대로 저장된다. 이 경우 `value={val.extra_price}`에 빈 문자열이 들어가고, 서버에 빈 문자열이 전송될 수 있다.

**현재 상태:** 기존 코드도 빈 문자열을 허용했으므로 새로운 문제는 아님. 다만 `min="0"` 속성이 추가되었으니 브라우저 기본 검증과 일관되게 동작.

**심각도:** Low — 서버에서 숫자 파싱하므로 실제 영향 없음.

---

#### F-M3. `AdminEventsTab` `Number.isInteger` 검증이 소수점에서 부정확

**파일:** `client/src/pages/Admin/AdminEventsTab.tsx:106`
**분류:** Validation

```javascript
if (!Number.isInteger(count) || count < 1) {
```

`Number(drawCount[ev.id]) || 1`에서 `drawCount`는 문자열 상태(`e.target.value`). `Number("1.5")`는 `1.5`이므로 `isInteger`가 `false`를 반환하여 정상 차단. 하지만 `drawCount`가 설정되지 않은 경우 `|| 1`이 기본값으로 적용되어 항상 1명으로 추첨됨.

**현재 상태:** 의도된 동작일 수 있으나, 입력 없이 추첨 버튼 클릭 시 1명 추첨이 사용자 실수일 수 있음.

**수정안:** (선택적)
```javascript
const count = Number(drawCount[ev.id]);
if (!count || count < 1) {
  showAlert('추첨 인원을 입력해주세요.', 'warning');
  return;
}
handleDraw(ev.id, count, ev.current_participants || 0);
```

---

### 프론트엔드 — Low

#### F-L1. `SettingsTab`에서 `newNickname.trim()` 이중 호출

**파일:** `client/src/pages/MyPage/SettingsTab.tsx:29-38`
**분류:** Code Quality

```javascript
const trimmed = newNickname.trim();
// ... 검증 ...
const res = await api.put('/auth/nickname', { nickname: newNickname.trim() });
```

`trimmed` 변수를 만들어두고 API 호출에서는 다시 `newNickname.trim()`을 호출. 동작에 문제는 없지만 `trimmed`를 사용하는 게 일관적.

**수정안:**
```javascript
const res = await api.put('/auth/nickname', { nickname: trimmed });
```

---

#### F-L2. `ProductDetailPage` `allOptionsSelected` 변수 활용 미흡

**파일:** `client/src/pages/Product/ProductDetailPage.tsx:214-228`
**분류:** UX 개선 가능

`allOptionsSelected`가 `false`일 때 `maxQuantity`는 `product.stock`으로 설정되지만, 장바구니 담기 버튼에서 모든 옵션 선택 여부를 검증하지 않으면 옵션 미선택 상태로 주문이 진행될 수 있다.

**현재 상태:** 장바구니 담기 로직에서 별도 검증이 있다면 문제 없음. 확인 필요.

---

#### F-L3. `CheckoutPage` fieldset 인라인 스타일

**파일:** `client/src/pages/Checkout/CheckoutPage.tsx:197`
**분류:** Code Quality

```jsx
<fieldset disabled={ordering} style={{ border: 'none', padding: 0, margin: 0 }}>
```

인라인 스타일 대신 CSS 클래스를 사용하는 게 프로젝트 컨벤션(컴포넌트별 `.css` 파일)에 맞음.

**수정안:** `CheckoutPage.css`에 클래스 추가:
```css
.checkout-fieldset {
  border: none;
  padding: 0;
  margin: 0;
}
```

---

## 요약

| 분류 | Critical | Medium | Low | 합계 |
|------|----------|--------|-----|------|
| 백엔드 | 0 | 3 | 3 | 6 |
| 프론트엔드 | 0 | 3 | 3 | 6 |
| **합계** | **0** | **6** | **6** | **12** |

### 주요 카테고리별 분포

| 카테고리 | 건수 |
|----------|------|
| Concurrency / 데이터 무결성 | 2 |
| Bug / 엣지 케이스 | 3 |
| Validation | 2 |
| Code Quality | 5 |

### 긍정적 변경 사항

- **Critical 이슈 0건** — 5차 리뷰의 Critical 4건이 모두 적절히 수정됨
- **FOR UPDATE 패턴 일관 적용** — `updateQuantity`, `rejectGift`, `participateEvent` 모두 행 잠금 추가
- **배치 처리 전환** — 쿠폰 배포, 이벤트 추첨, 재고 복원이 N+1에서 배치 패턴으로 개선
- **원자적 UPDATE** — `updateOrderStatus`에 `WHERE status = ?` 추가로 동시 변경 방지
- **stale closure 수정** — `CartPage`에서 `useRef` 패턴 적용
- **입력 검증 강화** — 닉네임 길이, 추첨 인원, 옵션 음수 등 클라이언트 검증 추가

---

## 권장 수정 순서

### 1단계 — Medium (버그 수정)
1. **F-M1** MailboxPage UTC 변환 `undefined` 처리
2. **B-M2** 쿠폰 배치 배포 트랜잭션 래핑

### 2단계 — Medium (코드 개선)
3. **B-M3** `updateQuantity` 입력 검증 위치 조정
4. **B-M1** 이벤트 중복 참여 명시적 체크 (이미 반영됨)
5. **F-M3** AdminEventsTab 추첨 인원 미입력 처리 (선택적)

### 3단계 — Low (정리)
6. **B-L1** `rollup-plugin-visualizer` 제거
7. **B-L2** `addToCart` dead code 제거
8. **B-L3** 이벤트 보상 음수 검증
9. **F-L1** SettingsTab `trimmed` 변수 일관 사용
10. **F-L2** 옵션 미선택 장바구니 담기 검증 확인
11. **F-L3** fieldset 인라인 스타일 CSS 분리
