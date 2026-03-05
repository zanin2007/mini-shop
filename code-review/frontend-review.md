# Frontend Code Review

> **검토일:** 2026-03-05
> **범위:** `client/src/` 전체
> **스택:** React + Vite + TypeScript
> **환경:** 로컬 학습용 프로젝트

---

## 🔴 실제 버그 — 지금도 터질 수 있는 것들

---

### B-1. State 직접 변이 (OptionsEditor.tsx)

**파일:** `pages/Product/OptionsEditor.tsx` — 37~40번째 줄 (동일 패턴 6곳 반복)

**현재 코드:**
```tsx
onChange={(e) => {
  const updated = [...options];            // 배열은 새로 만들었지만
  updated[oi].option_name = e.target.value; // 안에 있는 객체는 원본 그대로!
  setOptions(updated);
}}
```

**왜 문제야?**

`[...options]`는 배열만 새로 복사하고, 안에 들어있는 객체는 그대로 원본을 가리켜.
그래서 `updated[oi].option_name = ...`을 하면 **원본 state를 직접 수정**하는 거야.

```
options = [objA, objB, objC]
updated = [objA, objB, objC]  ← 같은 객체를 가리킴!
updated[0].option_name = 'X'  ← objA 자체가 바뀜 = 원본도 바뀜
```

React는 "이전 state vs 새 state"를 비교해서 리렌더링하는데, 원본을 직접 바꿔버리면 이전 값도 같이 바뀌어서 **변경 감지를 못할 수 있어.** 옵션 편집할 때 값이 안 바뀌거나 이상하게 남는 버그가 터질 수 있음.

**이렇게 바꿔야 해:**
```tsx
onChange={(e) => {
  const updated = options.map((opt, i) =>
    i === oi ? { ...opt, option_name: e.target.value } : opt
  );
  setOptions(updated);
}}
```

이러면 해당 인덱스의 객체도 새로 복사하니까 불변성이 지켜져.
같은 패턴이 58~61, 67~70, 77~80, 87~89, 100~102 줄에도 있으니 전부 수정 필요.

---

### B-2. Fragment key 누락 (AdminUsersTab.tsx)

**파일:** `pages/Admin/AdminUsersTab.tsx` — 131~228번째 줄

**현재 코드:**
```tsx
{users.map(user => (
  <>                          {/* ← 여기에 key가 없음! */}
    <tr key={user.id}>        {/* ← key가 여기 있어봤자 소용없음 */}
      ...
    </tr>
    {expandedUser === user.id && (
      <tr key={`${user.id}-detail`}>
        ...
      </tr>
    )}
  </>
))}
```

**왜 문제야?**

React에서 `.map()` 안의 key는 **최상위 요소**에 있어야 해. 지금은 `<>` (Fragment)가 최상위인데 key가 없고, 안쪽 `<tr>`에 key를 넣었는데 이건 React가 리스트 추적용으로 안 써.

결과: 유저를 expand했을 때 **다른 유저의 제재 이력이 보이거나**, 리스트 순서가 바뀔 때 UI가 꼬일 수 있어.

**이렇게 바꿔야 해:**
```tsx
import { Fragment } from 'react';

{users.map(user => (
  <Fragment key={user.id}>
    <tr>
      ...
    </tr>
    {expandedUser === user.id && (
      <tr className="penalty-detail-row">
        ...
      </tr>
    )}
  </Fragment>
))}
```

`<>` 단축 문법은 key를 못 받으니까 `Fragment`를 직접 import해서 써야 해.

---

### B-3. 타이머 메모리 누수 (GiftSection.tsx)

**파일:** `pages/Checkout/GiftSection.tsx` — 22~40번째 줄

**현재 코드:**
```tsx
const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

const handleSearchUser = (query: string) => {
  if (searchTimer) clearTimeout(searchTimer);
  // ...
  const timer = setTimeout(async () => {
    const response = await api.get(`/auth/search?q=...`);
    setSearchResults(response.data);       // ← 컴포넌트가 사라진 뒤에도 호출될 수 있음!
  }, 300);
  setSearchTimer(timer);                   // ← 불필요한 리렌더링 발생
};
```

**왜 문제야?**

1. **`useState`로 타이머 ID 관리:** 타이머 ID는 화면에 보여줄 데이터가 아닌데 `useState`에 넣으면 `setSearchTimer(timer)` 할 때마다 불필요한 리렌더링이 발생해.

2. **cleanup 없음:** 선물하기 체크를 해제하면 `GiftSection`이 언마운트되는데, 그 사이에 `setTimeout`이 실행되면 이미 사라진 컴포넌트의 `setSearchResults`를 호출 → 콘솔에 `Can't perform a React state update on an unmounted component` 경고.

**이렇게 바꿔야 해:**
```tsx
const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const handleSearchUser = (query: string) => {
  if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
  // ...
  searchTimerRef.current = setTimeout(async () => { ... }, 300);
};

// cleanup 추가
useEffect(() => {
  return () => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
  };
}, []);
```

---

### B-4. JSON.parse 크래시 (ProductDetailPage.tsx 외 2곳)

**파일:** `pages/Product/ProductDetailPage.tsx` — 100~103번째 줄

**현재 코드:**
```tsx
const currentUser = (() => {
  const data = localStorage.getItem('user');
  return data ? JSON.parse(data) : null;   // ← 값이 깨져 있으면 크래시!
})();
```

**왜 문제야?**

`localStorage`에 `{잘못된 JSON}`이 들어가 있으면 `JSON.parse`가 에러를 던지고, try-catch가 없으니 **컴포넌트 전체가 하얗게 됨** (React Error Boundary가 없는 경우).

브라우저 확장, 다른 탭에서 직접 수정, 또는 저장 중 브라우저 종료 등으로 실제로 깨질 수 있어.

같은 패턴이 `CheckoutPage.tsx:71`, `Layout.tsx:27`에도 있음.

**이렇게 바꿔야 해:**

공통 유틸 함수를 하나 만들어서 재사용:
```tsx
// utils/storage.ts
export const getStoredUser = (): User | null => {
  try {
    const data = localStorage.getItem('user');
    return data ? JSON.parse(data) : null;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
};
```

---

## 🟡 패턴 개선 — 좋은 습관을 위해

---

### P-1. `any` 타입 사용 (NotificationPage.tsx, RefundPage.tsx)

**파일:** `pages/Notification/NotificationPage.tsx` — 115번째 줄

**현재 코드:**
```tsx
} catch (error: any) {
  const msg = error.response?.data?.message || '참여에 실패했습니다.';
```

**왜 고쳐야 해?**

같은 프로젝트의 `AdminUsersTab.tsx:92`, `CouponsTab.tsx` 등에서는 이미 올바른 패턴을 쓰고 있어:
```tsx
} catch (error) {
  if (error instanceof AxiosError) {
    showAlert(error.response?.data?.message || '처리에 실패했습니다.', 'error');
  }
}
```

이 패턴을 그대로 가져다 쓰면 됨. `any`를 쓰면 TypeScript의 타입 체크가 무력화돼서 의미가 없어져.

---

### P-2. useEffect 의존성 누락 (5개 파일)

**파일:** `pages/Auth/LoginPage.tsx` — 17~21번째 줄

**현재 코드:**
```tsx
useEffect(() => {
  if (localStorage.getItem('token')) {
    navigate('/', { replace: true });
  }
}, []);  // ← navigate가 빠져있음
```

**왜 고쳐야 해?**

`navigate`를 useEffect 안에서 쓰면서 의존성 배열에 안 넣으면 ESLint `exhaustive-deps` 경고가 나. React Router의 `navigate`는 stable ref라서 넣어도 무한루프 안 돌아.

같은 패턴: `SignupPage.tsx:23`, `ProductRegisterPage.tsx:18`, `AdminPage.tsx:45`, `Layout.tsx:56`

---

### P-3. `.then()` 체이닝 (Layout.tsx)

**파일:** `components/Layout.tsx` — 37~45번째 줄

**현재 코드:**
```tsx
Promise.all([
  api.get('/cart').then(r => r.data.length).catch(() => 0),
  api.get('/mailbox/unread-count').then(r => r.data.count).catch(() => 0),
  api.get('/notifications/unread-count').then(r => r.data.count).catch(() => 0),
]).then(([cart, mail, notif]) => {
  setCartCount(cart);
  setMailboxCount(mail);
  setNotifCount(notif);
});
```

**왜 고쳐야 해?**

프로젝트 전체가 async/await 기반인데 이 부분만 `.then()` 체이닝이야. 일관성이 깨지고 가독성도 떨어져.

**이렇게 바꿔야 해:**
```tsx
useEffect(() => {
  const fetchCounts = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const [cartRes, mailRes, notifRes] = await Promise.all([
        api.get('/cart').catch(() => ({ data: [] })),
        api.get('/mailbox/unread-count').catch(() => ({ data: { count: 0 } })),
        api.get('/notifications/unread-count').catch(() => ({ data: { count: 0 } })),
      ]);
      setCartCount(cartRes.data.length);
      setMailboxCount(mailRes.data.count);
      setNotifCount(notifRes.data.count);
    } catch { /* ignore */ }
  };
  fetchCounts();
}, []);
```

---

### P-4. SPA 내비게이션 파괴 (LoginPage.tsx)

**파일:** `pages/Auth/LoginPage.tsx` — 44번째 줄

**현재 코드:**
```tsx
localStorage.setItem('token', response.data.token);
localStorage.setItem('user', JSON.stringify(response.data.user));
showAlert('로그인 성공!', 'success');
window.location.href = '/';  // ← 페이지 전체 새로고침!
```

**왜 고쳐야 해?**

`window.location.href`는 브라우저가 페이지를 처음부터 다시 로드해. React 번들 다운로드, 파싱, 전체 컴포넌트 트리 재구성이 다시 일어나서 느려.

Layout.tsx에 이미 `userUpdated` 커스텀 이벤트를 감지하는 코드가 있거든:
```tsx
// Layout.tsx:51 — 이미 있는 코드
window.addEventListener('userUpdated', handleStorageChange);
```

**이렇게 바꿔야 해:**
```tsx
localStorage.setItem('token', response.data.token);
localStorage.setItem('user', JSON.stringify(response.data.user));
showAlert('로그인 성공!', 'success');
window.dispatchEvent(new Event('userUpdated'));
navigate('/');
```

---

### P-5. index를 key로 사용 (OptionsEditor.tsx, GiftsTab.tsx)

**파일:** `pages/Product/OptionsEditor.tsx` — 30, 52번째 줄

**현재 코드:**
```tsx
{options.map((option, oi) => (
  <div key={oi} className="option-group">   {/* index as key */}
    ...
    {option.values.map((val, vi) => (
      <div key={vi} className="option-value-row">  {/* index as key */}
```

**왜 고쳐야 해?**

3개 옵션(A, B, C) 중 B를 삭제하면:
- 삭제 전: `key=0 → A`, `key=1 → B`, `key=2 → C`
- 삭제 후: `key=0 → A`, `key=1 → C`

React는 "key=1인 요소가 업데이트됐다"고 판단해서 B의 DOM 요소에 C의 데이터를 넣으려고 해. input에 포커스가 있었으면 엉뚱한 곳에 커서가 가거나, 입력 값이 섞일 수 있어.

---

### P-6. User 타입 중복 정의 (Layout.tsx)

**파일:** `components/Layout.tsx` — 7~12번째 줄

**현재 코드:**
```tsx
// Layout.tsx에 따로 정의
interface User {
  id: number;
  email: string;
  nickname: string;
  role?: string;       // ← points 필드 없음!
}
```

`types/index.ts`에 이미 같은 타입이 있는데 따로 정의해놔서, 한쪽만 수정하면 동기화가 안 됨.

---

### P-7. 이벤트 타입 불일치 (AdminEventsTab.tsx)

**파일:** `pages/Admin/AdminEventsTab.tsx`

```tsx
// 131줄 — 생성 폼
<option value="random">랜덤 추첨</option>

// 215줄 — 목록 표시
{ev.type === 'fcfs' ? '선착순' : '추첨'}

// 227줄 — 추첨 버튼 조건
{ev.type === 'random' && (
```

`"random"`, `"fcfs"` 같은 문자열이 코드 여기저기에 흩어져 있어서 오타 나면 조용히 버그가 됨. `Event` 타입에 `type: 'fcfs' | 'random'` 리터럴 유니온을 쓰면 오타를 컴파일 타임에 잡아줘.

---

## 🔵 알아두면 좋은 것

| # | 이슈 | 파일 | 한줄 요약 |
|---|------|------|-----------|
| N-1 | 이미지 lazy loading 없음 | `MainPage.tsx:187` 외 | `<img loading="lazy">` 속성 추가 (1줄) |
| N-2 | 과도한 데이터 페치 | `RefundPage.tsx:35` | 전체 주문 목록 → `/orders/:id` 단건 조회로 변경 |
| N-3 | 포인트 stale data | `CheckoutPage.tsx:157` | localStorage 직접 수정 대신 서버 응답에서 동기화 |
| N-4 | div onClick | `NotificationPage.tsx:179` 외 | `<button>` 사용 → 키보드 접근성 확보 |
| N-5 | label 미연결 | `LoginPage.tsx:58` 외 | `htmlFor` + `id` 연결 → 스크린 리더 인식 |

---

## 잘 된 부분

| 항목 | 설명 |
|------|------|
| 컴포넌트 분리 | Checkout → `DeliveryForm`, `CouponSection`, `GiftSection` 적절한 분리 |
| AxiosError 타입 가드 | 대부분의 catch에서 `instanceof AxiosError` 올바르게 사용 (2곳만 `any`) |
| 낙관적 UI 업데이트 | 위시리스트(`ProductDetailPage:86-97`) — 실패 시 롤백까지 구현 |
| 커스텀 이벤트 동기화 | `userUpdated`, `storage` 이벤트로 크로스 컴포넌트 통신 |
| 타입 정의 중앙 관리 | `types/index.ts`에 인터페이스 집중 |
