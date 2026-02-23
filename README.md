# Mini Shop

React + Express + MySQL로 만드는 쇼핑몰 프로젝트

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | React 19, TypeScript, Vite, React Router, Axios |
| 백엔드 | Node.js, Express 5, JWT, bcrypt |
| 데이터베이스 | MySQL 2 |

---

## 프로젝트 구조

```
mini-shop/
├── client/                  # 프론트엔드 (React)
│   └── src/
│       ├── api/
│       │   └── instance.ts      # Axios 인스턴스 (baseURL, 토큰 자동 첨부)
│       ├── components/
│       │   ├── Layout.tsx        # 공통 헤더/푸터 (장바구니 뱃지, 관리자 메뉴)
│       │   └── Layout.css
│       ├── pages/
│       │   ├── Main/
│       │   │   ├── MainPage.tsx       # 상품 목록 (검색 + 카테고리 필터)
│       │   │   └── MainPage.css
│       │   ├── Product/
│       │   │   ├── ProductDetailPage.tsx  # 상품 상세 (리뷰, 삭제)
│       │   │   ├── ProductDetailPage.css
│       │   │   ├── ProductRegisterPage.tsx # 상품 등록
│       │   │   └── ProductRegisterPage.css
│       │   ├── Auth/
│       │   │   ├── LoginPage.tsx      # 로그인
│       │   │   ├── SignupPage.tsx     # 회원가입
│       │   │   └── AuthPage.css
│       │   ├── Cart/
│       │   │   ├── CartPage.tsx       # 장바구니 (선택 구매)
│       │   │   └── CartPage.css
│       │   ├── Checkout/
│       │   │   ├── CheckoutPage.tsx   # 주문 확인 (배송정보, 쿠폰 적용)
│       │   │   └── CheckoutPage.css
│       │   ├── MyPage/
│       │   │   ├── MyPage.tsx         # 마이페이지 (주문내역, 쿠폰)
│       │   │   └── MyPage.css
│       │   └── Admin/
│       │       ├── AdminPage.tsx      # 관리자 페이지 (주문/상품/쿠폰 관리)
│       │       └── AdminPage.css
│       ├── types/
│       │   └── index.ts           # TypeScript 타입 정의
│       └── App.tsx                # 라우트 정의
│
└── server/                  # 백엔드 (Express)
    ├── config/
    │   ├── db.js                  # MySQL 연결 풀
    │   └── initDB.js              # DB/테이블 자동 생성
    ├── controllers/           # 비즈니스 로직
    │   ├── authController.js      # 인증 (회원가입, 로그인, JWT)
    │   ├── productController.js   # 상품 (CRUD, 검색, 카테고리)
    │   ├── cartController.js      # 장바구니 (CRUD, 선택 토글)
    │   ├── orderController.js     # 주문 (생성, 쿠폰적용, 재고차감)
    │   ├── wishlistController.js  # 위시리스트
    │   ├── reviewController.js    # 리뷰 (CRUD, 구매검증)
    │   ├── couponController.js    # 쿠폰 (등록, 조회, 적용)
    │   └── adminController.js     # 관리자 (주문관리, 상품관리, 쿠폰생성)
    ├── routes/                # URL 라우팅
    │   ├── authRoutes.js
    │   ├── productRoutes.js
    │   ├── cartRoutes.js
    │   ├── orderRoutes.js
    │   ├── wishlistRoutes.js
    │   ├── reviewRoutes.js
    │   ├── couponRoutes.js
    │   └── adminRoutes.js
    ├── middleware/
    │   └── authMiddleware.js      # JWT 인증 + 관리자 권한 미들웨어
    └── index.js               # 서버 진입점
```

---

## 시작하기

### 1. 사전 요구사항

- Node.js 18 이상
- MySQL 8 이상 (실행 중이어야 함)

### 2. 환경 변수 설정

`server/.env` 파일 생성:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=비밀번호
DB_NAME=mini_shop
PORT=5000
JWT_SECRET=임의의_긴_문자열
```

### 3. 패키지 설치

```bash
# 프론트엔드
cd client
npm install

# 백엔드
cd server
npm install
```

### 4. 실행

터미널 2개를 열어서 각각 실행:

```bash
# 터미널 1 - 백엔드 (서버 자동 재시작)
cd server
npm run dev

# 터미널 2 - 프론트엔드
cd client
npm run dev
```

| 서비스 | 주소 |
|--------|------|
| 프론트엔드 | http://localhost:5173 |
| 백엔드 API | http://localhost:5000 |

> 서버를 처음 실행하면 `mini_shop` DB와 모든 테이블이 자동으로 생성됩니다.

---

## DB 테이블 구조

```
users          회원 정보 (role 포함: user/admin)
products       상품 정보 (user_id로 등록자 추적)
cart_items     장바구니 (is_selected로 선택 구매)
orders         주문 (쿠폰 할인, 배송 정보 포함)
order_items    주문 상세 (orders ↔ products)
wishlists      찜 목록 (users ↔ products)
reviews        리뷰 (구매 확인 후 작성, 별점 1~5)
coupons        쿠폰 (정액/정률 할인, 최소금액, 만료일)
user_coupons   유저 보유 쿠폰 (사용 여부 추적)
```

---

## API 명세

### 인증 `/api/auth`

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|:----:|------|
| POST | `/signup` | | 회원가입 |
| POST | `/login` | | 로그인 → JWT 토큰 반환 (role 포함) |
| POST | `/logout` | | 로그아웃 |
| GET | `/check` | ✅ | 현재 로그인 유저 확인 |

### 상품 `/api/products`

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|:----:|------|
| GET | `/` | | 전체 상품 목록 (검색: `?search=키워드`, 카테고리: `?category=의류`) |
| GET | `/categories` | | 카테고리 목록 조회 |
| GET | `/:id` | | 상품 상세 조회 |
| POST | `/` | ✅ | 상품 등록 (user_id 자동 저장) |
| DELETE | `/:id` | ✅ | 상품 삭제 (본인 등록 상품만) |

### 장바구니 `/api/cart`

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|:----:|------|
| GET | `/` | ✅ | 내 장바구니 조회 (is_selected 포함) |
| POST | `/` | ✅ | 상품 추가 |
| PUT | `/select-all` | ✅ | 전체 선택/해제 토글 |
| PUT | `/:id` | ✅ | 수량 변경 |
| PUT | `/:id/select` | ✅ | 개별 선택 토글 |
| DELETE | `/:id` | ✅ | 상품 삭제 |

### 주문 `/api/orders`

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|:----:|------|
| POST | `/` | ✅ | 주문 생성 (선택된 장바구니 → 주문, 쿠폰/배송정보 포함) |
| GET | `/` | ✅ | 주문 내역 조회 |

**주문 생성 요청 body:**
```json
{
  "couponId": 1,
  "receiver_name": "홍길동",
  "receiver_phone": "010-1234-5678",
  "delivery_address": "서울시 강남구..."
}
```

### 위시리스트 `/api/wishlist`

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|:----:|------|
| GET | `/` | ✅ | 내 위시리스트 조회 |
| POST | `/` | ✅ | 상품 추가 |
| DELETE | `/:productId` | ✅ | 상품 삭제 |

### 리뷰 `/api/reviews`

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|:----:|------|
| GET | `/product/:productId` | | 상품별 리뷰 목록 (닉네임 포함) |
| GET | `/check/:productId` | ✅ | 리뷰 작성 가능 여부 (구매 확인) |
| POST | `/` | ✅ | 리뷰 작성 (구매한 상품만, 중복 불가) |
| DELETE | `/:id` | ✅ | 리뷰 삭제 (본인만) |

### 쿠폰 `/api/coupons`

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|:----:|------|
| GET | `/` | ✅ | 내 쿠폰 목록 |
| GET | `/available?totalAmount=50000` | ✅ | 사용 가능한 쿠폰 (금액 기준 필터) |
| POST | `/claim` | ✅ | 쿠폰 코드 등록 (`{ "code": "WELCOME10" }`) |

### 관리자 `/api/admin` (admin 권한 필요)

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|:----:|------|
| GET | `/orders` | ✅🔒 | 전체 주문 목록 |
| PUT | `/orders/:id/status` | ✅🔒 | 주문 상태 변경 (`{ "status": "shipped" }`) |
| GET | `/products` | ✅🔒 | 전체 상품 목록 (판매자 닉네임 포함) |
| DELETE | `/products/:id` | ✅🔒 | 상품 삭제 |
| GET | `/coupons` | ✅🔒 | 전체 쿠폰 목록 |
| POST | `/coupons` | ✅🔒 | 쿠폰 생성 |
| DELETE | `/coupons/:id` | ✅🔒 | 쿠폰 삭제 |

> 🔒 = 관리자 전용 (role: admin)

---

## 구현 현황

| 기능 | 백엔드 | 프론트엔드 | 설명 |
|------|:------:|:----------:|------|
| 회원가입 / 로그인 | ✅ | ✅ | JWT 인증, role 포함 |
| 상품 목록 / 상세 | ✅ | ✅ | 검색 + 카테고리 필터 |
| 상품 등록 | ✅ | ✅ | user_id 자동 저장 |
| 상품 삭제 | ✅ | ✅ | 본인 등록 상품만 |
| 장바구니 | ✅ | ✅ | 선택 구매 (체크박스) |
| 주문 | ✅ | ✅ | 재고 검증, 선택 상품만 주문 |
| 배송 정보 | ✅ | ✅ | 수령인/연락처/주소 입력, 상태 진행 바 |
| 마이페이지 | ✅ | ✅ | 주문내역 + 쿠폰 탭 |
| 위시리스트 | ✅ | ✅ | |
| 리뷰 | ✅ | ✅ | 구매 후 작성, 별점 (1~5), 본인 삭제 |
| 쿠폰 | ✅ | ✅ | 코드 등록, 주문 시 적용, 할인 표시 |
| 관리자 | ✅ | ✅ | 주문 상태 변경, 상품/쿠폰 관리 |

---

## 주요 기능 상세

### 검색 & 필터
- 메인 페이지 상단 검색바에서 상품명 검색
- 카테고리 버튼으로 필터링 (전체/의류/전자기기 등)
- 검색어 + 카테고리 동시 필터 가능

### 장바구니 선택 구매
- 각 아이템에 체크박스 (개별 선택/해제)
- 전체 선택/해제 체크박스
- 선택된 상품만 총 금액 계산, 선택 상품만 주문

### 리뷰 시스템
- 구매한 상품에만 리뷰 작성 버튼 표시
- 별점 1~5 선택 + 텍스트 입력
- 본인 리뷰만 삭제 가능
- 상품 상세 페이지 하단에 평균 별점 + 리뷰 목록

### 쿠폰 시스템
- 마이페이지 쿠폰 탭에서 쿠폰 코드 입력하여 등록
- 주문 시 사용 가능한 쿠폰 드롭다운 선택
- 정액 할인 (예: 3,000원) 또는 정률 할인 (예: 10%)
- 최소 주문 금액 조건 지원
- 사용/만료 쿠폰 구분 표시

### 배송 정보 & 주문 추적
- 체크아웃에서 수령인/연락처/배송주소 입력
- 마이페이지에서 주문별 배송 상태 진행 바 (준비중 → 배송중 → 배송완료 → 구매확정)
- 배송 정보(수령인, 주소) 표시

### 관리자 기능
- 관리자 계정으로 로그인 시 헤더에 "관리자" 메뉴 표시
- **주문 관리**: 전체 주문 목록, 상태 변경 (드롭다운)
- **상품 관리**: 전체 상품 테이블, 삭제
- **쿠폰 관리**: 쿠폰 생성 폼, 쿠폰 목록, 삭제

### 관리자 계정 설정 방법
```sql
-- MySQL에서 직접 실행
UPDATE users SET role = 'admin' WHERE email = '관리자이메일';
```
> 변경 후 **재로그인** 필요 (JWT에 role이 포함되어야 함)

---

## 인증 방식

로그인 성공 시 JWT 토큰을 `localStorage`에 저장합니다.
이후 모든 인증 필요 API 요청에 자동으로 헤더에 포함됩니다.

```
Authorization: Bearer <token>
```

JWT 토큰에 포함된 정보:
- `userId`: 유저 ID
- `email`: 이메일
- `role`: 권한 (user 또는 admin)

토큰 만료 또는 인증 실패(401) 시 자동으로 로그인 페이지로 이동합니다.

---

## 주문 상태 흐름

```
pending (준비중) → shipped (배송중) → delivered (배송완료) → completed (구매확정)
```

관리자가 `/api/admin/orders/:id/status` API로 상태 변경 가능.

---

## 자주 겪는 문제

| 증상 | 원인 | 해결 |
|------|------|------|
| `DB 초기화 실패: Access denied` | `.env` 파일 없거나 DB 비밀번호 틀림 | `server/.env` 확인 |
| `vite is not recognized` | `npm install` 안 함 | `client/` 에서 `npm install` |
| `nodemon is not recognized` | `npm install` 안 함 | `server/` 에서 `npm install` |
| Network Error | 서버가 꺼져 있음 | `server/` 에서 `npm run dev` |
| CORS error | origin 불일치 | 서버 cors 설정 확인 |
| 401 Unauthorized | 토큰 없거나 만료 | 다시 로그인 |
| 관리자 메뉴 안 보임 | role이 JWT에 없음 | DB에서 role 변경 후 **재로그인** |
| 쿠폰 적용 안 됨 | 최소 금액 미달 or 만료 | 쿠폰 조건 확인 |
| 리뷰 작성 버튼 안 보임 | 해당 상품 미구매 | 상품 구매 후 시도 |
