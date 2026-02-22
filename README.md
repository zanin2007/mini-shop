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
│       │   └── Layout.tsx        # 공통 헤더/푸터
│       ├── pages/
│       │   ├── MainPage.tsx       # 상품 목록
│       │   ├── ProductDetailPage.tsx  # 상품 상세
│       │   ├── ProductRegisterPage.tsx # 상품 등록 (5주차)
│       │   ├── LoginPage.tsx      # 로그인
│       │   ├── SignupPage.tsx     # 회원가입
│       │   ├── CartPage.tsx       # 장바구니
│       │   ├── CheckoutPage.tsx   # 주문 확인
│       │   └── MyPage.tsx         # 마이페이지 (5주차)
│       └── types/
│           └── index.ts           # TypeScript 타입 정의
│
└── server/                  # 백엔드 (Express)
    ├── config/
    │   ├── db.js                  # MySQL 연결 풀
    │   └── initDB.js              # DB/테이블 자동 생성
    ├── controllers/           # 비즈니스 로직
    │   ├── authController.js
    │   ├── productController.js
    │   ├── cartController.js
    │   ├── orderController.js
    │   ├── wishlistController.js  # (5주차)
    │   └── reviewController.js   # (6주차)
    ├── routes/                # URL 라우팅
    │   ├── authRoutes.js
    │   ├── productRoutes.js
    │   ├── cartRoutes.js
    │   ├── orderRoutes.js
    │   ├── wishlistRoutes.js      # (5주차)
    │   └── reviewRoutes.js       # (6주차)
    ├── middleware/
    │   └── authMiddleware.js      # JWT 인증 미들웨어
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
users          회원 정보
products       상품 정보
cart_items     장바구니 (users ↔ products)
orders         주문 (users에 속함)
order_items    주문 상세 (orders ↔ products)
wishlists      찜 목록 (users ↔ products)
reviews        리뷰 (users ↔ products) [6주차]
```

---

## API 명세

### 인증 `/api/auth`

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|:----:|------|
| POST | `/signup` | | 회원가입 |
| POST | `/login` | | 로그인 → JWT 토큰 반환 |
| POST | `/logout` | | 로그아웃 |
| GET | `/check` | ✅ | 현재 로그인 유저 확인 |

### 상품 `/api/products`

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|:----:|------|
| GET | `/` | | 전체 상품 목록 조회 |
| GET | `/:id` | | 상품 상세 조회 |
| POST | `/` | ✅ | 상품 등록 |

### 장바구니 `/api/cart`

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|:----:|------|
| GET | `/` | ✅ | 내 장바구니 조회 |
| POST | `/` | ✅ | 상품 추가 |
| PUT | `/:id` | ✅ | 수량 변경 |
| DELETE | `/:id` | ✅ | 상품 삭제 |

### 주문 `/api/orders`

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|:----:|------|
| POST | `/` | ✅ | 주문 생성 (장바구니 → 주문) |
| GET | `/` | ✅ | 주문 내역 조회 |

### 위시리스트 `/api/wishlist`

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|:----:|------|
| GET | `/` | ✅ | 내 위시리스트 조회 |
| POST | `/` | ✅ | 상품 추가 |
| DELETE | `/:productId` | ✅ | 상품 삭제 |

---

## 구현 현황

| 기능 | 백엔드 | 프론트엔드 |
|------|:------:|:----------:|
| 회원가입 / 로그인 | ✅ | ✅ |
| 상품 목록 / 상세 | ✅ | ✅ |
| 상품 등록 | ✅ | ✅ |
| 장바구니 | ✅ | ✅ |
| 주문 | ✅ | ✅ |
| 마이페이지 (주문내역) | ✅ | ✅ |
| 위시리스트 | ✅ | - |
| 리뷰 | - | - |

---

## 인증 방식

로그인 성공 시 JWT 토큰을 `localStorage`에 저장합니다.
이후 모든 인증 필요 API 요청에 자동으로 헤더에 포함됩니다.

```
Authorization: Bearer <token>
```

토큰 만료 또는 인증 실패(401) 시 자동으로 로그인 페이지로 이동합니다.

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
