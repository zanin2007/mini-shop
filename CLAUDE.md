# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Backend (Express + MySQL) — http://localhost:5000
cd server && npm run dev      # nodemon auto-restart

# Frontend (React + Vite) — http://localhost:5173
cd client && npm run dev      # Vite HMR

# Frontend build & lint
cd client && npm run build
cd client && npm run lint
```

Both servers must run simultaneously. Backend requires `server/.env` with DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSL, JWT_SECRET, PORT.

## Architecture

**Monorepo**: `client/` (React 19 + TypeScript + Vite) and `server/` (Express 5 + MySQL2)

### Backend (`server/`)
- **Entry**: `index.js` — Express setup, DB auto-init via `config/initDB.js`, 14 route modules mounted at `/api/*`
- **Flow**: `routes/` (middleware chains) → `controllers/` (async business logic) → `config/db.js` (mysql2 promise pool)
- **Auth**: JWT 7-day expiry via `middleware/authMiddleware.js` — `authenticateToken` sets `req.user`, `isAdmin` checks role
- **DB**: 21 tables, auto-created on startup. Pool config uses `timezone: '+00:00'` (UTC). Schema migrations use `safeAddColumn()` in initDB
- **Responses**: JSON `{ message }` with HTTP status codes (200, 400, 401, 403, 404, 500)

### Frontend (`client/`)
- **Routing**: `App.tsx` — React Router, `Layout` wrapper, lazy-loaded pages via `React.lazy` + `Suspense`
- **API layer**: `api/instance.ts` — Axios instance, auto Bearer token from localStorage, auto-logout on 401
- **State**: React hooks + Context API (AlertContext for toasts/confirm modals). No Redux
- **Types**: `types/index.ts` — shared TypeScript interfaces (User, Product, Order, Gift, Coupon, Event, etc.)
- **Styling**: CSS variables in `index.css` (design system), component `.css` alongside `.tsx`
- **Pages**: `pages/` — feature folders (Auth, Main, Product, Cart, Checkout, MyPage, Admin, Mailbox, Notification, Wishlist, Refund)

### Routes (14 modules)
| Prefix | File | Auth | Description |
|--------|------|------|-------------|
| `/api/auth` | authRoutes | - | 회원가입, 로그인, 계정관리, 유저검색 |
| `/api/products` | productRoutes | partial | 상품 CRUD, 카테고리, 검색 |
| `/api/cart` | cartRoutes | required | 장바구니 추가/수정/삭제/선택 |
| `/api/orders` | orderRoutes | required | 주문 생성, 조회, 구매확정, 상태변경(테스트) |
| `/api/wishlist` | wishlistRoutes | required | 위시리스트 추가/삭제/조회 |
| `/api/reviews` | reviewRoutes | partial | 리뷰 작성(구매검증)/삭제/조회 |
| `/api/coupons` | couponRoutes | required | 보유 쿠폰, 사용가능 쿠폰, 쿠폰코드 등록 |
| `/api/gifts` | giftRoutes | required | 보낸/받은 선물, 수락/거절(자동환불)/수령완료 |
| `/api/refunds` | refundRoutes | required | 환불 신청, 상태 조회 |
| `/api/notifications` | notificationRoutes | required | 알림 조회(고정우선)/읽음/전체삭제(고정보호) |
| `/api/mailbox` | mailboxRoutes | required | 우편함 조회/읽음/보상수령/삭제 |
| `/api/announcements` | announcementRoutes | - | 공지사항 목록 (고정 우선 정렬) |
| `/api/events` | eventRoutes | required | 이벤트 목록, 참여 (선착순/랜덤) |
| `/api/admin` | adminRoutes | admin | 주문/상품/쿠폰/공지/이벤트/환불/유저 관리 |

### Database (21 tables)
- **Core**: users, products, cart_items, orders, order_items
- **상품옵션**: product_options, product_option_values, cart_item_options, order_item_options
- **마켓기능**: coupons, user_coupons, wishlists, reviews, gifts, refunds
- **시스템**: notifications (is_pinned 지원), mailbox, announcements (상단고정 최대 3개), events, event_participants, user_penalties

### Key Business Logic
- **주문 상태**: `checking → pending → shipped → delivered → completed` + `refund_requested → refunded`
- **관리자 상태변경 제한**: 수령완료(completed), 환불요청(refund_requested), 환불완료(refunded) 상태는 변경 불가
- **선물 거절**: 자동 환불 처리 — 주문 상태 `refunded`, 재고 복원, 쿠폰 복원, 포인트 반환 (트랜잭션)
- **상단 고정 알림**: `is_pinned=true` — 유저 전체삭제에서 보호, 항상 최상단 정렬, 관리자 공지 삭제 시에만 삭제
- **전체 알림 삭제**: 고정 알림 제외 삭제 + 남은 고정 알림 읽음 처리
- **환불**: 구매확정(completed) 후 7일 이내만 신청 가능, 관리자 승인/거부
- **제재**: 경고 3회 누적 시 자동 7일 정지

## Coding Rules

### TypeScript (Frontend)
- **`any` 타입 사용 금지** — 반드시 적절한 타입/인터페이스를 정의하거나 `types/index.ts`의 기존 타입을 사용할 것
- strict 모드 활성화 (tsconfig), `noUnusedLocals`, `noUnusedParameters` 적용
- 인터페이스는 PascalCase, `types/index.ts`에 중앙 관리
- 컴포넌트는 함수형 + hooks (useState, useEffect, useContext)
- 페이지 컴포넌트는 `React.lazy`로 지연 로딩
- **`JSON.parse`는 반드시 `try-catch`로 감싸기** — localStorage 데이터는 손상될 수 있음. 파싱 실패 시 null 반환 또는 기본값 사용
- **`eslint-disable` 사용 금지** — 특히 `react-hooks/exhaustive-deps` 경고를 무시하지 말 것. `useCallback`으로 감싸고 의존성 배열을 정확히 작성
- **useEffect 내 직접 setState 금지** — 초기 fetch는 `void setTimeout(fn, 0)` 패턴으로 비동기화하여 cascading render 방지
- **모달은 ESC 키 핸들링 필수** — `useEffect`로 `keydown` 이벤트 리스너 등록, cleanup에서 제거
- **리다이렉트 URL은 반드시 검증** — `startsWith('/') && !startsWith('//')` 패턴으로 내부 경로만 허용 (Open Redirect 방지)
- **API 결과를 서버에서 동기화** — 주문/결제 후 로컬 상태를 직접 수정하지 말고 `/auth/check` 등으로 서버 최신 데이터를 fetch
- **연타 방지는 개별 추적** — 여러 아이템에 대한 처리 상태는 `Set<number>`로 개별 ID 추적. 단일 `processingId`는 전체 UI를 차단함
- **검색 API 호출 시 `AbortController` 사용** — debounce 타이머만으로는 이미 발송된 요청의 응답 순서 문제를 방지할 수 없음
- **`alert()` 사용 금지** — 항상 `showAlert()`(AlertContext) 사용으로 일관된 UX 유지
- **placeholder와 실제 검증 로직 동기화** — 비밀번호 최소 길이 등 변경 시 관련 placeholder도 반드시 업데이트
- **숫자 입력 검증** — 가격/재고 등 숫자 필드는 클라이언트에서 음수 검증 후 서버에서도 재검증

### Backend (JavaScript)
- SQL 쿼리는 반드시 파라미터 배열 사용: `db.execute(sql, [param1, param2])` — 문자열 결합 금지 (SQL injection 방지)
- 대량 조회는 배치 쿼리: `IN (${ids.map(() => '?').join(',')})` 패턴
- **대량 INSERT는 배치로** — for문 안에서 건별 INSERT 대신 `INSERT INTO ... VALUES (?,?),(?,?),...` 패턴 사용
- 데이터 변경이 여러 테이블에 걸칠 때는 트랜잭션 사용: `getConnection()` → `beginTransaction()` → `commit()`/`rollback()` → finally `release()`
- **트랜잭션 내 동시 수정 방지** — 환불, 쿠폰 등 상태 변경 시 `SELECT ... FOR UPDATE`로 행 잠금 필수
- **이중 처리 방지** — 환불/거절 로직 진입 전 이미 처리된 상태인지 반드시 확인 (예: `order.status === 'refunded'`)
- 컨트롤러 함수: `exports.fn = async (req, res) => { try { ... } catch { 500 } }`
- **catch 블록에서 에러를 무조건 삼키지 말 것** — 특정 에러(`ER_DUP_ENTRY` 등)만 건너뛰고 나머지는 `throw` 또는 로깅
- 에러 응답은 `{ message: '한글 메시지' }` 형식
- **날짜/시간 비교는 DB에서 처리** — JS `new Date()`는 서버 로컬 타임존, DB는 UTC → `TIMESTAMPDIFF()` 등 DB 함수 사용
- **falsy 비교 주의** — `0`은 falsy이므로 `if (value && ...)` 대신 `if (value != null && ...)` 사용
- **숫자 입력 검증** — `Number.isInteger()` + 음수 체크 필수. `|| 0` 패턴은 음수를 통과시킴
- **포인트 오버플로 방지** — `points = LEAST(points + ?, 9999999)` 패턴 사용
- **재고 검증은 상품 + 옵션 모두** — 주문 생성 시 `products.stock`과 `product_option_values.stock` 모두 확인
- **DELETE 결과 확인** — `affectedRows === 0`이면 404 반환 (존재하지 않는 리소스 삭제 방어)

### Shared Components
- **`QuantityInput`** (`components/QuantityInput.tsx`) — 수량 입력 공용 컴포넌트. 꾹 누르기(400ms 후 80ms 간격 자동 증감) + 숫자 클릭 시 직접 텍스트 입력 지원. ProductDetailPage, CartPage에서 사용
- **`AlertContext`** (`components/AlertContext.tsx`) — 전역 토스트/확인모달. `showAlert(msg, type)`, `showConfirm(msg): Promise<boolean>`. `timerMap` ref로 타이머 추적, 수동 닫기 시 타이머 정리

### Established Patterns
- **낙관적 업데이트 + API 디바운스** — CartPage 수량 변경: UI 즉시 반영(`setCartPageItems`) + `useRef<Map>` 타이머로 300ms 디바운스 후 API 호출. 실패 시 `fetchCart()`로 서버 동기화
- **버튼 연타 방지 (Processing State)** — `cartProcessing`/`wishlistProcessing` 상태로 비동기 작업 중 버튼 비활성화 + "담는 중..." 텍스트 피드백
- **서버 역할 검증** — AdminPage, ProductRegisterPage는 localStorage 대신 `api.get('/auth/check')`로 서버에서 역할 확인 후 렌더링 (`checking`/`authorized` 상태)
- **장바구니 동시 요청 직렬화** — `addToCart`는 트랜잭션 + `SELECT ... FOR UPDATE`로 상품/옵션/기존 장바구니 행 잠금 후 재고 검증
- **옵션 재고 연동** — 상품 재고 + 옵션 재고 중 작은 값을 `maxQuantity`로 사용. 옵션 변경 시 수량 자동 조정
- **커스텀 이벤트 동기화** — `cartUpdated`, `userUpdated` 이벤트로 컴포넌트 간 상태 동기화 (Layout 뱃지, 401 로그아웃 등)

### Styling
- CSS 변수는 `index.css`의 `:root`에 정의된 디자인 시스템 사용 (`--color-*`, `--radius-*`, `--shadow-*`)
- 컴포넌트별 `.css` 파일을 `.tsx`와 같은 폴더에 배치
- 디자인 테마: "Refined Korean Contemporary" (Pretendard 폰트, 따뜻한 베이지 배경, 테라코타 액센트)

## Known Issues

### High
- **`updateQuantity` FOR UPDATE 누락** — `cartController.js`의 `updateQuantity`는 재고 조회 시 행 잠금 없음. `addToCart`처럼 `FOR UPDATE` 필요 (동시 요청 시 재고 초과 가능)
- **`maxQuantity` 부분 선택 시 부정확** — ProductDetailPage에서 옵션을 일부만 선택했을 때, 미선택 옵션의 재고가 무시됨. 모든 옵션 선택 전에는 수량 제한이 느슨함

### Medium
- **401 인터셉터 경로 체크 부정확** — `instance.ts`에서 `.includes('/login')` 사용 중. `/admin/login-verify` 같은 경로에서도 리다이렉트 차단됨. `.startsWith('/login')`으로 변경 필요
- **AlertProvider unmount 시 타이머 누수** — `AlertContext.tsx`에서 Provider 언마운트 시 남은 토스트 타이머를 정리하는 cleanup effect 없음

### Low
- **`addToCart` dead code** — `cartController.js` line 125의 `totalProductQty` 변수 계산 후 미사용 (정리 필요)

## Documentation

- `DB_스키마.md` — 21개 테이블 상세 (컬럼, FK, 상태 흐름, 제약조건)
- `DEVELOPMENT_GUIDE.md` — API 엔드포인트, 기능 체크리스트, 테스트 시나리오
- `code-review/code-review-4.md` — 코드 리뷰 결과 (57건 중 대부분 수정 완료)
