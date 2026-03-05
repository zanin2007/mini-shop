# UX/인터랙션 피드백 (코드 기반 분석)

> **검토일:** 2026-03-05
> **범위:** `client/src/` 전체 페이지 + CSS
> **방식:** 코드 분석으로 발견한 UX 이슈 (실행 테스트 아님)

---

## 🔴 높음 — 기능에 직접 영향

---

### 1. [인터랙션] 수령완료 / 상태변경 버튼 더블클릭 시 중복 요청

**파일:** `pages/MyPage/OrdersTab.tsx` — 99~143행

```tsx
<button
  className="confirm-btn"
  onClick={async () => {
    if (!(await showConfirm('수령완료 하시겠습니까?'))) return;
    try {
      await api.put(`/orders/${order.id}/confirm`);
      // confirm 후 API 응답 전에 또 클릭 가능!
```

**사용자 경험:** confirm 팝업에서 "확인" 누른 뒤 버튼이 여전히 활성화 → 다시 클릭 가능 → 포인트 적립이 중복될 수 있음

**수정 방향:** 주문 카드별 `processing` 상태를 `Record<number, boolean>`으로 관리, 처리 중인 주문의 버튼을 `disabled` + 로딩 텍스트로 변경

---

### 2. [인터랙션] 선물 수락/거절 버튼 중복 요청

**파일:** `pages/MyPage/GiftsTab.tsx` — 35~72행

```tsx
const handleAcceptGift = async (giftId: number) => {
  if (!(await showConfirm('선물을 수락하시겠습니까?'))) return;
  try {
    await api.put(`/gifts/${giftId}/accept`);
    showAlert('선물을 수락했습니다.', 'success');
    onGiftAction(); // 전체 다시 fetch — 완료 전까지 버튼 활성 상태
  } catch (error) { ... }
};
```

**사용자 경험:** 선물 수락 = 주문 생성이라서, 중복 클릭 시 같은 선물에 대해 주문이 두 번 만들어질 수 있음

---

### 3. [인터랙션] 장바구니 체크박스 연타 시 서버 상태 꼬임

**파일:** `pages/Cart/CartPage.tsx` — 55~64행

```tsx
const handleToggleSelect = async (id: number) => {
  try {
    await api.put(`/cart/${id}/select`);
    setCartItems(cartItems.map(item =>
      item.id === id ? { ...item, is_selected: !item.is_selected } : item
    ));
  } catch (error) {
    console.error('선택 변경 실패:', error);
    // 실패 시 롤백 없음, 에러 알림 없음
  }
};
```

**사용자 경험:** 체크박스를 빠르게 2번 누르면 → 요청 2개 발생 → 서버에서 토글 2번 = 원래대로. 근데 UI는 한 번만 반영 → **서버와 UI 상태 불일치**

**수정 방향:** 요청 중인 아이템 ID를 Set으로 추적 → 해당 아이템은 클릭 무시
```tsx
const [selectingIds, setSelectingIds] = useState<Set<number>>(new Set());

const handleToggleSelect = async (id: number) => {
  if (selectingIds.has(id)) return; // 이미 처리 중이면 무시
  setSelectingIds(prev => new Set([...prev, id]));
  // ... API 호출 ...
  // finally에서 Set에서 제거
};
```

---

### 4. [흐름] 로그인 후 원래 페이지로 안 돌아옴

**파일:** `pages/Auth/LoginPage.tsx` — 44행
**관련:** `CheckoutPage.tsx:62`, `CartPage.tsx:35`, `NotificationPage.tsx:44`, `MailboxPage.tsx:35`

```tsx
// 보호된 페이지들 — 로그인 페이지로 보내지만 redirect 정보 없음
navigate('/login');  // ← 어디서 왔는지 안 알려줌

// LoginPage.tsx — 로그인 후 무조건 메인으로
window.location.href = '/';
```

**사용자 경험:**
1. 체크아웃 페이지에서 결제하려는데 로그인 안 되어 있음
2. "로그인하시겠습니까?" → 확인 → 로그인 페이지
3. 로그인 완료 → **메인 페이지로 이동** (체크아웃이 아님!)
4. 장바구니부터 다시 시작해야 함 → 이탈

**수정 방향:**
```tsx
// 보호된 페이지에서
navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);

// LoginPage.tsx에서
const params = new URLSearchParams(location.search);
const redirect = params.get('redirect') || '/';
navigate(redirect);
```

---

### 5. [상태 처리] 체크아웃 장바구니 로딩 실패 시 빈 화면

**파일:** `pages/Checkout/CheckoutPage.tsx` — 87~91행

```tsx
} catch (error) {
  console.error('장바구니 조회 실패:', error);
  // showAlert 없음! loading만 false로 됨 → 빈 체크아웃 화면
} finally {
  setLoading(false);
}
```

**사용자 경험:** API 실패 → 로딩 끝나고 결제할 상품이 없는 빈 화면 → 사용자는 뭐가 잘못됐는지 모름

**수정 방향:**
```tsx
} catch (error) {
  showAlert('장바구니를 불러오지 못했습니다.', 'error');
  navigate('/cart');
}
```

---

### 6. [상태 처리] 관리자 삭제 기능 3곳 — 실패 시 피드백 없음 (동일 패턴)

**파일:** `AdminProductsTab.tsx:44`, `AdminCouponsTab.tsx:71`, `AdminAnnouncementsTab.tsx:57`

```tsx
// 세 곳 모두 이 패턴
const handleDelete = async (id: number) => {
  if (!(await showConfirm('정말 삭제하시겠습니까?'))) return;
  try {
    await api.delete(`/admin/.../${id}`);
    setItems(prev => prev.filter(item => item.id !== id));
  } catch (error) {
    console.error('삭제 실패:', error);
    // ← showAlert 없음! 사용자는 삭제가 됐는지 안 됐는지 모름
  }
};
```

**사용자 경험:** 관리자가 상품/쿠폰/공지를 삭제했는데 네트워크 에러 → 아무 피드백 없이 화면은 그대로 → "삭제 안 됐나?" 혼란

**수정 방향:** 세 곳 모두 catch에 `showAlert('삭제에 실패했습니다.', 'error')` 추가. 패턴이 완전히 같으니 공통 함수 추출도 고려.

---

## 🟡 중간 — 눈에 띄는 UX 저하

---

### 7. [인터랙션] 쿠폰 등록 / 이벤트 참여 / 보상 수령 — 버튼 중복 클릭

**같은 패턴이 3곳에 반복:**

| 파일 | 기능 | 위험도 |
|------|------|--------|
| `CouponsTab.tsx:31` | 쿠폰 코드 등록 | 서버에서 중복 차단하지만 UX 혼란 |
| `NotificationPage.tsx:110` | 이벤트 참여 | 참여 Set 반영 전 연타 가능 |
| `MailboxPage.tsx:66` | 보상 수령 | `is_claimed` 체크 전 연타 가능 |

**공통 수정 방향:** 요청 중인 ID를 Set으로 관리하거나, 클릭 즉시 낙관적으로 상태 반영 후 실패 시 롤백

---

### 8. [상태 처리] fetch 실패 시 "데이터 없음"으로 오해되는 화면들

**같은 패턴이 여러 곳에 반복:**

| 파일 | 기능 | catch 내용 |
|------|------|------------|
| `WishlistPage.tsx:35` | 찜 목록 | `console.error`만 → "찜한 상품이 없습니다" 표시 |
| `MyPage.tsx:95,101,107` | 쿠폰/선물/환불 탭 | `console.error`만 → 빈 탭 |
| `ProductDetailPage.tsx:172` | 리뷰 삭제 | `console.error`만 → 피드백 없음 |
| `MailboxPage.tsx:92` | 우편 삭제 | `console.error`만 → 피드백 없음 |
| `AdminEventsTab.tsx:97` | 이벤트 삭제 | `console.error`만 → 피드백 없음 |

**사용자 경험:** 서버 에러인데 "데이터가 없어요"처럼 보여서 사용자가 계속 새로고침하거나 이탈함

**공통 수정 방향:** `console.error` 있는 catch 블록에 `showAlert` 추가. 특히 데이터 조회 실패 시에는 빈 화면 대신 에러 UI + 재시도 버튼 표시

---

### 9. [폼] 회원가입 — 비밀번호 길이 검증 없음

**파일:** `pages/Auth/SignupPage.tsx` — 32~54행

```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (formData.password !== formData.confirmPassword) {
    setError('비밀번호가 일치하지 않습니다.');
    return;
  }
  // ← 비밀번호 최소 길이 검증 없음!
  // SettingsTab에서는 "4자 이상" 검증이 있는데 여기엔 없음
```

**사용자 경험:** 비밀번호 "1"로 가입 시도 → 서버 에러 메시지가 뜸 (클라이언트 검증이 더 빠르고 친절)

---

### 10. [폼] 쿠폰 생성 — 유효성 검증 부족

**파일:** `pages/Admin/AdminCouponsTab.tsx` — 49~68행

```tsx
await api.post('/admin/coupons', {
  discount_percentage: discountType === 'percentage'
    ? Number(couponForm.discount_percentage) || null  // 빈 값 → null
    : null,
  expiry_date: couponForm.expiry_date,  // ← 과거 날짜 가능!
});
```

**사용자 경험:**
- 할인율 200% 입력 가능
- 어제 날짜로 만료일 설정 가능
- 빈 값이 `null`로 넘어가서 할인 없는 쿠폰 생성 가능

---

### 11. [인터랙션] 관리자 주문 상태 select — 빠른 변경 시 race condition

**파일:** `pages/Admin/AdminOrdersTab.tsx` — 72~79행

```tsx
const handleStatusChange = async (orderId: number, status: string) => {
  try {
    await api.put(`/admin/orders/${orderId}/status`, { status });
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
  } catch { ... }
};
```

**사용자 경험:** select를 "배송중"으로 바꿨다가 바로 "배송완료"로 바꾸면, 두 요청이 동시에 날아가서 먼저 끝나는 게 UI에 반영됨 → 서버는 "배송완료"인데 UI는 "배송중"으로 보일 수 있음

---

## 🔵 낮음 — 폴리시

---

### 12. [레이아웃] 알림/우편 본문 1줄 강제 잘림

**파일:** `NotificationPage.css:163`, `MailboxPage.css:142`

```css
.notif-content {
  white-space: nowrap;     /* 1줄 강제 */
  overflow: hidden;
  text-overflow: ellipsis;
}
```

**사용자 경험:** 공지사항 같은 긴 내용이 첫 줄만 보임. 클릭하면 모달에서 전체 보이는데, 그 힌트가 없음

**수정 방향:** `-webkit-line-clamp: 2`로 2줄까지 표시

---

### 13. [레이아웃] 이미지 lazy loading 미적용

**파일:** `MainPage.tsx:187`, `WishlistPage.tsx:75`, `OrdersTab.tsx:48`

```tsx
<img src={product.image_url} alt={product.name} />
// ← loading="lazy" 없음
```

**수정 방향:** `<img loading="lazy" .../>` (1줄 추가)

---

### 14. [인터랙션] 리뷰 등록 중 버튼 비활성화 없음

**파일:** `pages/Product/ReviewSection.tsx` — 22~27행

```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  await onSubmitReview(reviewForm.rating, reviewForm.content);
  // await 하는 동안 버튼이 계속 활성화 → 연타 가능
};
```

---

### 15. [상태 처리] 장바구니 수량 변경 실패 시 피드백 없음

**파일:** `pages/Cart/CartPage.tsx` — 76~86행

```tsx
} catch (error) {
  console.error('수량 변경 실패:', error);
  // showAlert 없음, 롤백 없음
}
```

---

## 요약

| # | 카테고리 | 우선순위 | 페이지 | 이슈 |
|---|----------|----------|--------|------|
| 1 | 인터랙션 | 🔴 높음 | OrdersTab | 수령완료 버튼 더블클릭 |
| 2 | 인터랙션 | 🔴 높음 | GiftsTab | 선물 수락 중복 요청 |
| 3 | 인터랙션 | 🔴 높음 | CartPage | 체크박스 연타 상태 꼬임 |
| 4 | 흐름 | 🔴 높음 | LoginPage 외 5곳 | 로그인 후 원래 페이지 미복귀 |
| 5 | 상태 처리 | 🔴 높음 | CheckoutPage | 장바구니 로딩 실패 시 빈 화면 |
| 6 | 상태 처리 | 🔴 높음 | Admin 3개 탭 | 삭제 실패 무음 처리 (동일 패턴) |
| 7 | 인터랙션 | 🟡 중간 | CouponsTab, NotificationPage, MailboxPage | 버튼 중복 클릭 3곳 |
| 8 | 상태 처리 | 🟡 중간 | WishlistPage, MyPage 외 | fetch 실패 → "데이터 없음" 오해 |
| 9 | 폼 | 🟡 중간 | SignupPage | 비밀번호 길이 미검증 |
| 10 | 폼 | 🟡 중간 | AdminCouponsTab | 쿠폰 생성 유효성 부족 |
| 11 | 인터랙션 | 🟡 중간 | AdminOrdersTab | 상태 select race condition |
| 12 | 레이아웃 | 🔵 낮음 | NotificationPage, MailboxPage | 본문 1줄 말줄임 |
| 13 | 레이아웃 | 🔵 낮음 | MainPage 외 | 이미지 lazy loading 없음 |
| 14 | 인터랙션 | 🔵 낮음 | ReviewSection | 리뷰 제출 버튼 비활성화 없음 |
| 15 | 상태 처리 | 🔵 낮음 | CartPage | 수량 변경 실패 알림 없음 |
