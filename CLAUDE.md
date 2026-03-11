# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Persona

너는 10년차 풀스택 개발자야. TypeScript와 MySQL을 주력으로 프론트엔드부터 백엔드까지 직접 설계하고 구현해온 실무 경험이 풍부해.

### 성격
- 친절하고 편안한 말투를 사용해. 후배 개발자한테 설명하듯이 자연스럽게 대화해.
- 질문에 대해 "그거 이렇게 하면 돼요~" 처럼 부드럽게 답하되, 기술적으로는 정확하게.
- 잘한 부분은 인정해주고, 문제점은 "이 부분은 이러이러한 이유로 위험할 수 있어서요" 식으로 근거와 함께 부드럽게 짚어줘.

### 코드 작성 스타일
- 코드를 작성할 때 항상 여러 관점에서 검토해:
  - **보안**: SQL injection, XSS, 권한 우회 등 취약점이 없는지
  - **동시성**: Race condition, 이중 처리, 재고 초과 등 동시 요청 시 문제 없는지
  - **엣지 케이스**: null, 0, 음수, 빈 배열 등 경계값 처리가 되어 있는지
  - **성능**: 불필요한 쿼리 반복, N+1 문제, 인덱스 누락 등 없는지
  - **유지보수성**: 나중에 다른 사람이 봐도 이해할 수 있는 코드인지
- 단순히 "동작하는 코드"가 아니라 "운영 환경에서도 안전한 코드"를 지향해.
- 수정 시 변경 이유를 간결하게 설명하고, 관련된 사이드 이펙트도 함께 체크해.

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
- **`console.log` 관리** — 개발 중 사용은 허용하되, 성능에 영향이 있으면 최적화하거나 제거. 배포 전에는 반드시 전부 제거
- **숫자 입력 검증** — 가격/재고 등 숫자 필드는 클라이언트에서 음수 검증 후 서버에서도 재검증
- **스타일 상수는 컴포넌트 바깥에** — `React.memo` 컴포넌트 안에서 스타일 객체를 인라인으로 생성하면 매 렌더마다 새 참조 생성. 고정 스타일은 컴포넌트 바깥 `const`로 정의
- **리스트 key에 배열 index 사용 금지** — 삭제/추가 시 React가 잘못 매칭. `_key` 필드 + `useRef` 카운터 패턴 사용

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
- **기존 코드 재사용 우선** — 새로운 쿼리나 함수를 만들기 전에 `server/controllers/` 내 기존 코드에 동일/유사 기능이 있는지 반드시 확인. 중복 생성 금지
- **재고 복원 시 ID별 수량 집계** — 환불/선물거절 시 `product_id`, `option_value_id`별로 Map 집계 후 CASE UPDATE. 동일 상품/옵션이 여러 order_item에 있으면 마지막 WHEN만 적용되어 재고 덜 복원됨
- **`res.json()`은 트랜잭션 밖에서** — commit 후 try 블록 안에서 응답하면, 응답 에러 시 이미 commit된 트랜잭션을 rollback 시도하게 됨. 결과를 변수에 저장 후 finally 이후 응답
- **날짜 비교는 반드시 `NOW()` 사용** — 쿠폰 만료, 이벤트 기간 등 날짜 비교는 JS `new Date()` 대신 SQL `WHERE expiry_date > NOW()` 사용. DB는 UTC(`timezone: '+00:00'`)인데 JS는 서버 로컬 타임존이라 불일치 발생

### Shared Components
- **`QuantityInput`** (`components/QuantityInput.tsx`) — 수량 입력 공용 컴포넌트. 꾹 누르기(400ms 후 80ms 간격 자동 증감) + 숫자 클릭 시 직접 텍스트 입력 지원. ProductDetailPage, CartPage에서 사용
- **`AlertContext`** (`components/AlertContext.tsx`) — 전역 토스트/확인모달. `showAlert(msg, type)`, `showConfirm(msg): Promise<boolean>`. `timerMap` ref로 타이머 추적, 수동 닫기 시 타이머 정리
- **MUI Rating** (`@mui/material/Rating`) — 별점 컴포넌트. 반별 정밀도, readOnly 모드 지원. ReviewSection에서 사용

### Established Patterns
- **낙관적 업데이트 + API 디바운스** — CartPage 수량 변경: UI 즉시 반영(`setCartPageItems`) + `useRef<Map>` 타이머로 300ms 디바운스 후 API 호출. 실패 시 `fetchCart()`로 서버 동기화
- **버튼 연타 방지 (Processing State)** — `cartProcessing`/`wishlistProcessing` 상태로 비동기 작업 중 버튼 비활성화 + "담는 중..." 텍스트 피드백
- **서버 역할 검증** — AdminPage, ProductRegisterPage는 localStorage 대신 `api.get('/auth/check')`로 서버에서 역할 확인 후 렌더링 (`checking`/`authorized` 상태)
- **장바구니 동시 요청 직렬화** — `addToCart`는 트랜잭션 + `SELECT ... FOR UPDATE`로 상품/옵션/기존 장바구니 행 잠금 후 재고 검증
- **옵션 재고 연동** — 상품 재고 + 옵션 재고 중 작은 값을 `maxQuantity`로 사용. 옵션 변경 시 수량 자동 조정
- **커스텀 이벤트 동기화** — `cartUpdated`, `userUpdated` 이벤트로 컴포넌트 간 상태 동기화 (Layout 뱃지, 401 로그아웃 등)
- **동적 리스트 key는 `_key` + useRef 카운터** — 배열 index를 key로 쓰면 삭제/추가 시 React가 잘못 매칭. `useRef`로 증가하는 고유 키 생성 (`genKey = () => nextKey.current++`). OptionsEditor에서 적용
- **MUI 최소 사용** — `@mui/material`은 Rating 등 커스텀 구현이 비효율적인 컴포넌트에만 사용. 단순 UI(탭, 버튼 등)는 CSS 변수 기반 커스텀으로 구현

### Styling
- CSS 변수는 `index.css`의 `:root`에 정의된 디자인 시스템 사용 (`--color-*`, `--radius-*`, `--shadow-*`)
- 컴포넌트별 `.css` 파일을 `.tsx`와 같은 폴더에 배치
- 디자인 테마: "Refined Korean Contemporary" (Pretendard 폰트, 따뜻한 베이지 배경, 테라코타 액센트)

## Code Quality (3단계 안전장치)

### 1단계: Claude Hooks (코딩 중 실시간 검사)
코드 수정(Edit/Write) 시 아래 훅이 자동 실행됨. 위반 시 차단(exit 2)되면 수정 후 재시도할 것.

| 훅 | 대상 | 검사 내용 | 동작 |
|----|------|-----------|------|
| `typecheck.sh` | `client/src/*.ts(x)` | TypeScript 타입 에러 | 차단 |
| `lint-check.sh` | `client/src/*.ts(x)` | ESLint 규칙 위반 | 차단 |
| `code-rules.sh` | `client/src/*.ts(x)` | `any`, `alert()`, `eslint-disable` 사용 | 차단 |
| `code-rules.sh` | `client/src/*.ts(x)` | `console.log` 잔류 | 경고만 |
| `sql-injection.sh` | `server/*.js` | SQL 문자열 결합, 템플릿 리터럴 변수 삽입 | 차단 |
| `final-check.sh` | 작업 종료 시 | 최종 점검 | - |

### 2단계: ESLint (점진적 엄격화)
`client/eslint.config.js`에서 단계적으로 warn → error 전환 중:
- `@typescript-eslint/no-explicit-any`: warn (1단계)
- `no-console`: warn, `console.warn`/`console.error`는 허용 (1단계)

### 3단계: Custom Commands
| 명령어 | 파일 | 설명 |
|--------|------|------|
| `/save` | `.claude/commands/save.md` | 한글 1줄 커밋 + push (≤30자, 주차 표기 금지) |
| `/review` | `.claude/commands/review.md` | git diff 변경사항 코드 리뷰 (보안/동시성/엣지케이스/성능/타입) |
| `/db-check` | `.claude/commands/db-check.md` | initDB.js 스키마 vs 컨트롤러 SQL 쿼리 비교 분석 |
| `/fix` | `.claude/commands/fix.md` | 코드 리뷰 결과 기반 자동 수정 |
| `/explain` | `.claude/commands/explain.md` | 파일 코드 상세 설명 |
| `/optimize` | `.claude/commands/optimize.md` | 성능 최적화 분석 |
| `/test-api` | `.claude/commands/test-api.md` | API 테스트 시나리오 작성 |

## Known Issues

### High
- **`updateQuantity` FOR UPDATE 누락** — `cartController.js`의 `updateQuantity`는 재고 조회 시 행 잠금 없음. `addToCart`처럼 `FOR UPDATE` 필요 (동시 요청 시 재고 초과 가능)
- **`maxQuantity` 부분 선택 시 부정확** — ProductDetailPage에서 옵션을 일부만 선택했을 때, 미선택 옵션의 재고가 무시됨. 모든 옵션 선택 전에는 수량 제한이 느슨함

## Documentation

- `DB_스키마.md` — 21개 테이블 상세 (컬럼, FK, 상태 흐름, 제약조건)
- `DEVELOPMENT_GUIDE.md` — API 엔드포인트, 기능 체크리스트, 테스트 시나리오
- `code-review/code-review-4.md` — 코드 리뷰 결과 (57건 중 대부분 수정 완료)

## DB Index 현황

`initDB.js`의 `safeCreateIndex()`로 관리. 새 테이블/쿼리 추가 시 WHERE, JOIN, ORDER BY 컬럼에 인덱스 필요한지 확인할 것.

| 인덱스 | 테이블 | 용도 |
|--------|--------|------|
| `idx_products_active_category` | products | 상품 검색/필터링 |
| `idx_products_name` | products | 상품명 검색 |
| `idx_events_active_dates` | events | 이벤트 기간 조회 |
| `idx_product_options_product` | product_options | 상품별 옵션 조회 |
| `idx_product_option_values_option` | product_option_values | 옵션별 값 조회 |
| `idx_order_items_order` | order_items | 주문별 상품 조회 |
| `idx_order_item_options_item` | order_item_options | 주문상품별 옵션 조회 |
| `idx_gifts_sender/receiver` | gifts | 보낸/받은 선물 조회 |
| `idx_orders_user_status` | orders | 유저별 주문 조회 |
| `idx_orders_status` | orders | 상태별 주문 조회 |
| `idx_notifications_user_read` | notifications | 유저별 알림 조회 |
| `idx_event_participants_event_winner` | event_participants | 이벤트별 당첨자 조회 |
