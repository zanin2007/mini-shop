# 코드 리뷰 8차 — 2026-03-09

> 7차 리뷰 Medium 3건 + Low 4건 수정 반영 후, 현재 git diff 기준 최종 검토.

---

## 변경 파일 (18개)

| 파일 | 변경 내용 |
|------|-----------|
| `CLAUDE.md` | Persona 섹션 추가 |
| `client/src/api/instance.ts` | 401 인터셉터 `.includes` → `!==` |
| `client/src/pages/Admin/AdminEventsTab.tsx` | 추첨 인원 검증 + `?? 0` |
| `client/src/pages/Cart/CartPage.tsx` | stale closure → useRef, `getMaxStock` 외부 함수 |
| `client/src/pages/Checkout/CheckoutPage.css` | `.checkout-fieldset` 클래스 |
| `client/src/pages/Checkout/CheckoutPage.tsx` | fieldset disabled 래핑 |
| `client/src/pages/Mailbox/MailboxPage.tsx` | `toUtcStr` 헬퍼 추출, UTC 비교 수정 |
| `client/src/pages/MyPage/SettingsTab.tsx` | 닉네임 2~20자 검증 |
| `client/src/pages/Product/OptionsEditor.tsx` | 추가금액/재고 음수·NaN 방지 |
| `client/src/pages/Product/ProductDetailPage.tsx` | maxQuantity 옵션 부분 선택 수정 |
| `server/config/initDB.js` | UNIQUE 제약 + 중복 행 검사 + 인덱스 5개 |
| `server/controllers/adminController.js` | 원자적 UPDATE, 배치 배포/추첨/환불, 보상 음수 검증, 추첨 트랜잭션 |
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

#### M-1. 재고 복원 CASE UPDATE — 동일 `product_id` 중복 시 수량 누락

**파일:** `server/controllers/adminController.js` (processRefund), `server/controllers/giftController.js` (rejectGift)
**분류:** 데이터 무결성

```javascript
// 현재 코드 — processRefund 재고 복원
const caseParts = orderItems.map(() => 'WHEN id = ? THEN stock + ?').join(' ');
// ...
await connection.execute(
  `UPDATE products SET stock = CASE ${caseParts} ELSE stock END WHERE id IN (${idPh})`,
  [...caseVals, ...idVals]
);
```

한 주문에 같은 상품이 서로 다른 옵션으로 2개 있을 경우 (`order_items`에 `product_id`가 중복), CASE 문에 동일 ID가 2번 나타난다:

```sql
UPDATE products SET stock = CASE
  WHEN id = 5 THEN stock + 2   -- 첫 번째 아이템
  WHEN id = 5 THEN stock + 3   -- 두 번째 아이템 (무시됨!)
ELSE stock END WHERE id IN (5)
```

MySQL은 **첫 번째 매칭 WHEN**만 실행하므로, 두 번째 아이템의 수량(+3)이 누락된다. 환불/선물 거절 시 재고가 덜 복원되는 결과.

`giftController.js`의 `rejectGift`에도 동일한 패턴이 존재.

**수정안:** `product_id`별로 수량을 집계한 후 CASE 생성:

```javascript
// product_id별 수량 집계
const stockMap = new Map();
for (const item of orderItems) {
  stockMap.set(item.product_id, (stockMap.get(item.product_id) || 0) + item.quantity);
}
const aggregated = [...stockMap.entries()].map(([pid, qty]) => ({ product_id: pid, quantity: qty }));

if (aggregated.length > 0) {
  const caseParts = aggregated.map(() => 'WHEN id = ? THEN stock + ?').join(' ');
  const caseVals = aggregated.flatMap(a => [a.product_id, a.quantity]);
  const idPh = aggregated.map(() => '?').join(',');
  const idVals = aggregated.map(a => a.product_id);
  await connection.execute(
    `UPDATE products SET stock = CASE ${caseParts} ELSE stock END WHERE id IN (${idPh})`,
    [...caseVals, ...idVals]
  );
}
```

---

#### M-2. `drawEventWinners` 참가자 조회가 트랜잭션 외부

**파일:** `server/controllers/adminController.js:446-449`
**분류:** 동시성 / TOCTOU

```javascript
// 트랜잭션 밖에서 참가자 조회 (db.execute — 풀에서 직접)
const [participants] = await db.execute(
  `SELECT * FROM event_participants WHERE event_id = ? AND is_winner = false ORDER BY RAND() LIMIT ${limit}`,
  [id]
);

// 트랜잭션 시작
const connection = await db.getConnection();
await connection.beginTransaction();
// ... 여기서 UPDATE
```

두 관리자가 동시에 추첨하면, 같은 참가자가 두 번 SELECT될 수 있다. 트랜잭션 안의 UPDATE는 `is_winner = true`를 중복 설정하므로 에러는 없지만, 실제 당첨 인원이 의도보다 적어진다.

**수정안:** 참가자 SELECT도 트랜잭션 내부에서 `FOR UPDATE`로 실행:

```javascript
const connection = await db.getConnection();
try {
  await connection.beginTransaction();

  const [participants] = await connection.execute(
    `SELECT * FROM event_participants WHERE event_id = ? AND is_winner = false ORDER BY RAND() LIMIT ${limit} FOR UPDATE`,
    [id]
  );
  if (participants.length === 0) {
    await connection.rollback();
    return res.status(400).json({ message: '추첨할 참여자가 없습니다.' });
  }

  // ... 기존 배치 UPDATE/INSERT 로직
```

---

### 🔵 Low

#### L-1. `OptionsEditor` 음수 방지 로직 인라인 중복

**파일:** `client/src/pages/Product/OptionsEditor.tsx:71-73, 87-89`
**분류:** Code Quality / DRY

```javascript
// extra_price onChange (71행)
const num = Number(raw);
const sanitized = raw === '' ? '' : (isNaN(num) || num < 0) ? '0' : raw;

// stock onChange (87행) — 동일 로직
const num = Number(raw);
const sanitized = raw === '' ? '' : (isNaN(num) || num < 0) ? '0' : raw;
```

동일한 검증 로직이 2곳에 중복. 헬퍼 함수 추출로 유지보수성 향상 가능.

**수정안:**
```javascript
const sanitizeNumeric = (raw: string) => {
  const num = Number(raw);
  return raw === '' ? '' : (isNaN(num) || num < 0) ? '0' : raw;
};
```

---

#### L-2. `ProductDetailPage` `allOptionsSelected` 후 `selectedStocks`에 `undefined` 가능성

**파일:** `client/src/pages/Product/ProductDetailPage.tsx:220-225`
**분류:** 엣지 케이스

```javascript
if (!allOptionsSelected) return product.stock;
const selectedStocks = product.options
  .map(opt => {
    const val = opt.values.find(v => v.id === selectedOptions[opt.id]);
    return val?.stock ?? 0;  // val이 undefined면 0
  });
return Math.min(product.stock, ...selectedStocks);
```

`allOptionsSelected`가 `true`이면 `selectedOptions[opt.id]`가 존재하므로 `val`이 `undefined`일 가능성은 극히 낮다. 다만 옵션 데이터가 서버와 동기화되지 않은 경우(삭제된 옵션값 ID가 `selectedOptions`에 남아있을 때), `val`이 `undefined`가 되어 `0`으로 처리된다. 실질적 영향은 미미.

---

## 요약

| 분류 | Critical | Medium | Low | 합계 |
|------|----------|--------|-----|------|
| 백엔드 | 0 | 2 | 0 | 2 |
| 프론트엔드 | 0 | 0 | 2 | 2 |
| **합계** | **0** | **2** | **2** | **4** |

### 긍정적 변경 사항

- **7차 리뷰 전건 반영** — M-1(추첨 트랜잭션), M-3(OptionsEditor NaN), L-1~L-4 모두 수정
- **Critical 0건 3회 연속** — 보안/동시성 근본 이슈 완전 해소
- **일관된 패턴** — FOR UPDATE, 배치 INSERT, CASE UPDATE, 트랜잭션이 전체 컨트롤러에 균일 적용
- **프론트엔드 품질** — stale closure, UTC 변환, 음수 검증 등 엣지 케이스 체계적 정리
- **DRY 개선** — `toUtcStr` 헬퍼, `getMaxStock` 외부 함수 등 중복 제거

### 전체 진행 현황

| 리뷰 | Critical | Medium | Low | 상태 |
|------|----------|--------|-----|------|
| 5차 | 4 | 22 | 8 | 대부분 수정 완료 |
| 6차 | 0 | 6 | 6 | 전체 수정 완료 |
| 7차 | 0 | 3 | 4 | 전체 수정 완료 |
| **8차** | **0** | **2** | **2** | **신규 발견** |

---

## 권장 수정 순서

### 1단계 — Medium (데이터 무결성)
1. **M-1** processRefund / rejectGift 재고 복원 CASE 중복 product_id 집계
2. **M-2** drawEventWinners 참가자 SELECT를 트랜잭션 내부로 이동

### 2단계 — Low (선택적)
3. **L-1** OptionsEditor 검증 로직 헬퍼 추출
4. **L-2** ProductDetailPage selectedStocks 방어 (현재 영향 없음)
