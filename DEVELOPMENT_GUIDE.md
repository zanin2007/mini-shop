# Mini Shop 개발 가이드

## 전체 개발 흐름

```
1. 기획 → 2. DB 설계 → 3. 백엔드 API → 4. 프론트엔드 UI → 5. 연동 → 6. 테스트 → 7. 배포
```

---

## 1단계: 기획

```
페이지 목록:
- 메인 (상품 목록 + 검색 + 카테고리 필터 + 찜 하트)
- 로그인 / 회원가입
- 상품 상세 (리뷰 포함 + 찜 토글)
- 장바구니 (선택 구매)
- 주문 확인 (배송정보 + 주소 검색 + 쿠폰 적용)
- 마이페이지 (주문내역 + 쿠폰 + 선물 + 계정 설정)
- 찜 목록 (위시리스트)
- 우편함 (보상 수령)
- 알림 (주문/선물/쿠폰/시스템 알림)
- 관리자 페이지 (주문/상품/쿠폰/공지/이벤트 관리)

사용자 흐름:
회원가입 → 로그인 → 상품 탐색(검색/필터) → 찜 또는 장바구니 담기 → 선택 → 쿠폰 적용 → 주소 검색 + 배송정보 입력 → 주문하기 → 리뷰 작성
```

---

## 2단계: DB 설계 (19 테이블)

```
users                →  회원 (role: user/admin)
products             →  상품 (user_id로 등록자 추적)
cart_items           →  장바구니 (is_selected로 선택 구매)
orders               →  주문 (쿠폰 할인, 배송 정보, completed_at)
order_items          →  주문 상세 (orders ↔ products)
reviews              →  리뷰 (구매 확인, 별점 1~5)
wishlists            →  찜 목록 (users ↔ products)
coupons              →  쿠폰 (정액/정률 할인)
user_coupons         →  유저 보유 쿠폰
product_options      →  상품 옵션 그룹 (사이즈, 색상)
product_option_values→  옵션 값 (S/M/L, 추가금액, 재고)
cart_item_options    →  장바구니 선택 옵션
order_item_options   →  주문 상품 선택 옵션
gifts                →  선물하기 (sender ↔ receiver)
notifications        →  알림 (주문/선물/쿠폰/시스템)
mailbox              →  우편함 (보상 수령: 쿠폰/포인트/아이템)
announcements        →  공지사항 (고정/비고정)
events               →  이벤트 (선착순/랜덤추첨)
event_participants   →  이벤트 참여자 (당첨 여부)
```

> 팁: 모든 테이블에 `id` (PK, AUTO_INCREMENT) + `created_at` 기본 포함, 가격은 `INT` (원 단위)

---

## 3단계: 백엔드 API 개발

**개발 순서** (의존성 기준): `routes/xxxRoutes.js` → `controllers/xxxController.js`
```
① 회원가입/로그인 → ② 상품 CRUD → ③ 장바구니 → ④ 주문 → ⑤ 위시리스트
→ ⑥ 리뷰 → ⑦ 쿠폰 → ⑧ 알림/우편함 → ⑨ 관리자
```

### API 엔드포인트 요약

**인증** (`authRoutes.js`)
```
POST /api/auth/signup, /login, /logout
GET  /api/auth/check                     → 토큰 검증
GET  /api/auth/search?q=검색어            → 유저 검색 (선물용, 본인 제외)
PUT  /api/auth/nickname, /password       → 계정 설정
```

**상품** (`productRoutes.js`)
```
GET  /api/products?search=&category=     → 목록 (검색/필터)
GET  /api/products/categories            → 카테고리 목록
GET  /api/products/:id                   → 상세 (옵션 JOIN)
POST /api/products                       → 등록 (옵션 포함)
DELETE /api/products/:id                 → 삭제
```

**장바구니** (`cartRoutes.js`)
```
GET/POST/PUT/DELETE /api/cart            → CRUD (옵션 JOIN)
PUT /api/cart/:id/select                 → 개별 선택 토글
PUT /api/cart/select-all                 → 전체 선택/해제
```

**주문** (`orderRoutes.js`)
```
POST /api/orders                         → 주문 생성 (쿠폰/선물/배송정보)
GET  /api/orders                         → 내 주문 목록
PUT  /api/orders/:id/complete            → 구매확정
PUT  /api/orders/:id/advance             → 테스트용 상태 진행
```

**위시리스트** (`wishlistRoutes.js`)
```
GET    /api/wishlist                     → 찜 목록 (product JOIN)
GET    /api/wishlist/ids                 → 찜한 product_id 배열
GET    /api/wishlist/check/:productId    → 찜 여부 확인
POST   /api/wishlist                     → 찜 추가
DELETE /api/wishlist/:productId          → 찜 해제
```

**리뷰** (`reviewRoutes.js`)
```
GET  /api/reviews/product/:productId     → 리뷰 목록
GET  /api/reviews/check/:productId       → 구매/리뷰 여부
POST /api/reviews                        → 작성 (구매 검증)
DELETE /api/reviews/:id                  → 삭제 (본인만)
```

**쿠폰** (`couponRoutes.js`)
```
GET  /api/coupons                        → 내 쿠폰 목록
GET  /api/coupons/available?totalAmount= → 사용 가능 쿠폰
POST /api/coupons/claim                  → 코드 등록
```

**선물** (`giftRoutes.js`)
```
GET /api/gifts/sent, /received           → 보낸/받은 선물
PUT /api/gifts/:id/accept, /reject       → 수락/거절
```

**알림** (`notificationRoutes.js`)
```
GET /api/notifications                   → 목록 (최근 50개)
GET /api/notifications/unread-count      → 안읽은 수
PUT /api/notifications/:id/read          → 읽음
PUT /api/notifications/read-all          → 전체 읽음
```

**우편함** (`mailboxRoutes.js`)
```
GET/PUT/DELETE /api/mailbox              → 목록/읽음/삭제
GET  /api/mailbox/unread-count           → 안읽은 수
POST /api/mailbox/:id/claim              → 보상 수령
```

**관리자** (`adminRoutes.js`) — `isAdmin` 미들웨어
```
GET/PUT    /api/admin/orders             → 주문 관리 + 상태 변경
GET/DELETE /api/admin/products           → 상품 관리
GET/POST/DELETE /api/admin/coupons       → 쿠폰 관리
POST /api/admin/coupons/distribute       → 쿠폰 전체 배포
POST/GET/DELETE /api/admin/announcements → 공지 관리
POST/GET/DELETE /api/admin/events        → 이벤트 관리
POST /api/admin/events/:id/draw          → 추첨
```

**공지/이벤트 (유저용)**
```
GET  /api/announcements                  → 공지 목록 (고정 우선)
GET  /api/events                         → 진행중 이벤트
POST /api/events/:id/participate         → 이벤트 참여
```

---

## 4단계: 프론트엔드 UI 개발

**기술 스택**: React + Vite + TypeScript + Axios
**디자인 시스템**: "Refined Korean Contemporary" (29CM 스타일)
- 배경 `#f7f5f2` / 포인트 `#c47d5a` (테라코타) / 텍스트 `#1a1a1a` (차콜)
- CSS 변수 기반 (`index.css`), 모든 페이지에서 공유

**페이지 개발 순서**
```
① 로그인/회원가입 → ② 메인 (검색+카테고리) → ③ 상품 상세 (리뷰+찜)
→ ④ 장바구니 (선택 구매) → ⑤ 주문 (주소 검색+쿠폰) → ⑥ 찜 목록
→ ⑦ 마이페이지 (주문+쿠폰+선물+설정) → ⑧ 우편함 → ⑨ 알림 → ⑩ 관리자
```

**주요 구현 사항**
- **커스텀 알림창** (`AlertContext.tsx`): `showAlert(msg, type)` 토스트 + `showConfirm(msg)` 모달
- **주소 검색**: Daum Postcode API (`index.html`에 스크립트 로드), `declare global`로 타입 선언
- **위시리스트**: 메인/상세에서 하트 토글, `e.stopPropagation()`으로 Link 이동 방지
- **쿠폰 적용**: 정률/정액 중 큰 쪽 적용, 최소금액 검증, 사용 완료 처리
- **이벤트**: 선착순(즉시 당첨+보상) / 랜덤(참여 후 관리자 추첨)
- **관리자 접근**: `Layout.tsx`에서 role 체크, `ProductRegisterPage.tsx`에서 URL 직접접근 차단

**관리자 계정 설정**
```sql
UPDATE users SET role = 'admin' WHERE email = '관리자이메일';
-- 변경 후 재로그인 필요 (JWT에 role 포함)
```

---

## 5단계: 연동

| 증상 | 원인 | 해결 |
|------|------|------|
| Network Error | 서버 미실행 | `npm run dev` |
| CORS error | origin 불일치 | 서버 cors origin 확인 |
| 401 Unauthorized | 토큰 미전송/만료 | Axios 인터셉터 확인 |
| 500 Internal Error | DB 쿼리 오류 | 서버 터미널 로그 확인 |

---

## 6단계: 테스트 체크리스트

#### 인증
- [ ] 회원가입 중복 에러 / 로그인 토큰 / 새로고침 유지 / 비로그인 차단

#### 상품
- [ ] 목록 / 검색 / 카테고리 / 등록(관리자) / 삭제(본인)

#### 장바구니
- [ ] 추가 → 수량 → 삭제 / 체크박스 개별·전체 / 선택상품만 주문

#### 주문
- [ ] 배송정보 입력 / 연락처 숫자만(11자리) / 다음 주소 검색
- [ ] 쿠폰 할인 반영 / 재고 감소 / 장바구니 정리

#### 리뷰
- [ ] 미구매 → 버튼 없음 / 작성 / 중복 방지 / 본인만 삭제

#### 쿠폰
- [ ] 코드 등록 / 중복·만료 방지 / 주문 시 사용 가능 표시

#### 알림 & 우편함
- [ ] 뱃지 / 읽음·전체 읽음 / 보상 수령 / 만료 처리

#### 상품 옵션
- [ ] 옵션 등록 / 드롭다운 / 추가금액 / 다른 옵션 → 별도 항목

#### 선물하기
- [ ] 유저 검색 / 메시지 / 알림·우편함 도착 / 수락·거절

#### 위시리스트
- [ ] 메인 하트 / 상세 토글 / 비로그인 알림 / 찜 목록·해제

#### 계정 설정
- [ ] 닉네임 변경 → localStorage 반영 / 비밀번호 변경 → 현재 PW 검증

#### 관리자
- [ ] 접근 차단 / 주문 상태 / 상품 검색·삭제 / 쿠폰 생성·배포 / 공지 / 이벤트·추첨

---

## 7단계: 배포 (나중에)

```
프론트: Vercel, Netlify  |  백엔드: AWS EC2, Railway  |  DB: AWS RDS, PlanetScale
```
변경: `.env` → 운영 DB / CORS origin → 실제 도메인 / JWT_SECRET 강화

---

## 프로젝트 실행

```bash
# 서버 (server/)      → http://localhost:5000
npm run dev

# 클라이언트 (client/) → http://localhost:5173
npm run dev
```

---

## 현재 진행 상황

| 기능 | BE | FE | 상태 |
|------|:--:|:--:|------|
| 회원가입/로그인 | ✅ | ✅ | JWT + role |
| 상품 목록/상세/등록/삭제 | ✅ | ✅ | 검색 + 카테고리 + 관리자 전용 등록 |
| 장바구니 | ✅ | ✅ | 선택 구매 |
| 주문 + 배송정보 | ✅ | ✅ | 재고검증 + 다음 주소 검색 |
| 마이페이지 | ✅ | ✅ | 주문내역 + 쿠폰 + 선물 + 계정설정 |
| 위시리스트 | ✅ | ✅ | 하트 토글 + 찜 목록 |
| 리뷰 | ✅ | ✅ | 구매검증 + 별점 1~5 |
| 쿠폰 | ✅ | ✅ | 등록 + 적용 + 전체배포 |
| 상품 옵션 | ✅ | ✅ | 그룹/값 + 추가금액 + 재고 |
| 선물하기 | ✅ | ✅ | 유저 검색 + 수락/거절 |
| 알림 + 우편함 | ✅ | ✅ | 뱃지 + 읽음 + 보상수령 |
| 관리자 | ✅ | ✅ | 주문/상품/쿠폰/공지/이벤트 |
| 이벤트 | ✅ | ✅ | 선착순/랜덤추첨 |
| UI 디자인 시스템 | - | ✅ | Refined Korean Contemporary |
