# Mini Shop 개발 가이드

## 전체 개발 흐름 (순서대로)

```
1. 기획 → 2. DB 설계 → 3. 백엔드 API → 4. 프론트엔드 UI → 5. 연동 → 6. 테스트 → 7. 배포
```

---

## 1단계: 기획

코드를 작성하기 전에 **무엇을 만들 것인지** 정리하는 단계.

### 해야 할 것
- 어떤 페이지가 필요한지 목록 작성
- 각 페이지에서 사용자가 할 수 있는 행동 정리
- 화면 흐름도(wireframe) 간단히 그리기 (종이, Figma, Excalidraw 등)

### 예시 (Mini Shop 기준)
```
페이지 목록:
- 메인 (상품 목록)
- 로그인 / 회원가입
- 상품 상세
- 장바구니
- 주문 확인
- 마이페이지

사용자 흐름:
회원가입 → 로그인 → 상품 탐색 → 장바구니 담기 → 주문하기
```

### 팁
- 완벽하지 않아도 된다. 개발하면서 수정해도 괜찮음
- 핵심 기능부터 정리하고, 부가 기능은 나중에 추가

---

## 2단계: DB 설계

기획이 끝나면 **데이터를 어떻게 저장할지** 설계한다.

### 해야 할 것
1. 어떤 데이터가 필요한지 나열
2. 테이블과 컬럼 정의
3. 테이블 간의 관계(FK) 설정

### 설계 순서
```
1) 핵심 엔티티 파악: 사용자, 상품, 주문 ...
2) 각 엔티티의 속성 정의: 사용자 → email, password, nickname ...
3) 관계 설정: 주문은 사용자에게 속한다 (user_id FK)
```

### Mini Shop DB 구조
```
users          →  회원 정보
products       →  상품 정보
cart_items     →  장바구니 (users ↔ products)
orders         →  주문 (users에 속함)
order_items    →  주문 상세 (orders ↔ products)
reviews        →  리뷰 (users ↔ products)  [미구현][테이블 완료]
wishlists      →  찜 목록 (users ↔ products) [미구현][테이블 완료]
```

### 팁
- 테이블마다 `id` (PK, AUTO_INCREMENT)와 `created_at` 컬럼은 기본으로 넣기
- 가격은 `DECIMAL(10, 2)` 타입 사용 (소수점 계산 정확)
- 관계가 있는 테이블은 반드시 FK(외래키) 설정

---

## 3단계: 백엔드 API 개발

DB 설계가 끝나면 **서버 코드**를 작성한다.

### 작업 순서
```
1) 프로젝트 초기 설정 (Express, MySQL 연결, .env)
2) DB 테이블 생성 스크립트 작성 (initDB.js)
3) 기능별로 Route → Controller 순서로 개발
```

### 기능별 개발 순서 (의존성 고려)
```
① 회원가입/로그인  ← 가장 먼저 (다른 기능에서 인증이 필요)
② 상품 조회        ← 상품이 있어야 장바구니/주문 가능
③ 장바구니         ← 로그인 + 상품 필요
④ 주문             ← 장바구니 → 주문 전환
⑤ 리뷰/위시리스트  ← 부가 기능, 나중에
```

### 각 기능 개발 시 파일 작성 순서
```
1) routes/xxxRoutes.js    → URL과 HTTP 메서드 정의
2) controllers/xxxController.js → 실제 로직 구현
3) Postman이나 Thunder Client로 API 테스트
```

### 팁
- 하나의 API를 만들면 바로 테스트한 후 다음으로 넘어가기
- console.log로 데이터 확인하며 개발
- 에러가 나면 터미널 로그를 꼼꼼히 확인

---

## 4단계: 프론트엔드 UI 개발

API가 준비되면 **화면**을 만든다. (API와 병행해도 됨)

### 작업 순서
```
1) 프로젝트 초기 설정 (React + Vite + TypeScript)
2) 공통 레이아웃 (헤더, 푸터, 네비게이션)
3) 라우팅 설정 (React Router)
4) 페이지별 UI 개발
5) API 연동용 Axios 인스턴스 설정
```

### 페이지 개발 순서 (백엔드와 동일하게)
```
① 로그인 / 회원가입 페이지
② 메인 페이지 (상품 목록)
③ 상품 상세 페이지
④ 장바구니 페이지
⑤ 주문 확인 페이지
⑥ 마이페이지
```

### 각 페이지 개발 시 순서
```
1) 먼저 하드코딩된 더미 데이터로 UI 구현
2) UI가 완성되면 API 연동으로 교체
3) 로딩/에러 상태 처리
```

### 팁
- UI를 먼저 만들고, 그 다음에 API를 붙이면 디버깅이 쉬움
- TypeScript 인터페이스를 미리 정의하면 실수가 줄어듦

---

## 5단계: 프론트엔드 ↔ 백엔드 연동

### 체크리스트
- [ ] CORS 설정 확인
- [ ] Axios baseURL이 서버 주소와 일치하는지 확인
- [ ] 로그인 후 토큰이 localStorage에 저장되는지 확인
- [ ] 인증이 필요한 API 호출 시 Authorization 헤더에 토큰이 포함되는지 확인
- [ ] 에러 응답(400, 401, 500 등) 처리가 되는지 확인

### 자주 겪는 문제
| 증상 | 원인 | 해결 |
|------|------|------|
| Network Error | 서버가 안 켜져 있음 | `npm run dev`로 서버 실행 |
| CORS error | origin 설정 불일치 | 서버의 cors origin 확인 |
| 401 Unauthorized | 토큰 미전송 또는 만료 | Axios 인터셉터 확인 |
| 500 Internal Server Error | DB 쿼리 오류 | 서버 터미널 에러 로그 확인 |

---

## 6단계: 테스트

### 수동 테스트 체크리스트
- [ ] 회원가입 → 같은 이메일로 다시 가입 시 에러 뜨는지
- [ ] 로그인 → 토큰 받아오는지
- [ ] 비로그인 상태에서 장바구니 접근 시 처리
- [ ] 상품 장바구니 추가 → 수량 변경 → 삭제
- [ ] 주문 생성 → 재고 감소 확인
- [ ] 새로고침해도 로그인 유지되는지

### 팁
- 브라우저 개발자 도구(F12) > Network 탭에서 API 요청/응답 확인
- 서버 터미널에서 에러 로그 확인

---

## 7단계: 배포 (나중에)

개발이 완료되면 실제 서버에 올리는 단계.

```
프론트엔드: Vercel, Netlify 등
백엔드: AWS EC2, Railway, Render 등
DB: AWS RDS, PlanetScale 등
```

배포 시 변경 사항:
- `.env`의 DB 접속 정보를 운영 DB로 변경
- CORS origin을 실제 도메인으로 변경
- JWT_SECRET을 강력한 값으로 변경

---

## 현재 Mini Shop 진행 상황

| 기능 | 백엔드 | 프론트엔드 | 상태 |
|------|--------|-----------|------|
| 회원가입/로그인 | ✅ | ✅ | 완료 |
| 로그인 시 auth 페이지 접근 차단 | - | ✅ | 완료 |
| 상품 목록/상세 | ✅ | ✅ | 완료 |
| 상품 등록 | ✅ | ✅ | 완료 |
| 장바구니 | ✅ | ✅ | 완료 |
| 주문 | ✅ | ✅ | 완료 |
| 마이페이지 (주문 내역) | ✅ | ✅ | 완료 |
| 위시리스트 | ✅ | - | 백엔드만 완료 |
| 리뷰 | - | - | 미구현 |

### 다음 할 일

#### 6주차 예정
1. **위시리스트 프론트엔드** 구현
   - 상품 상세 페이지에 찜 버튼 추가
   - 마이페이지에 찜 목록 탭 추가

2. **리뷰 기능** 구현 (백엔드 + 프론트엔드)
   - 구매한 상품에만 리뷰 작성 가능
   - 상품 상세 페이지에 리뷰 목록 표시
   - 별점(1~5) + 텍스트 리뷰

#### 구현 가이드: 위시리스트 프론트엔드

```
1) ProductDetailPage.tsx에 찜 버튼 추가
   - 페이지 진입 시 GET /api/wishlist 로 내 위시리스트 조회
   - product.id가 목록에 있으면 "찜 해제" 버튼, 없으면 "찜하기" 버튼
   - 찜하기: POST /api/wishlist  { productId }
   - 찜 해제: DELETE /api/wishlist/:productId

2) MyPage.tsx에 위시리스트 탭 추가
   - 탭 전환: "주문 내역" | "찜 목록"
   - GET /api/wishlist 로 목록 조회 후 상품 카드 표시
```

#### 구현 가이드: 리뷰 기능

```
백엔드
1) controllers/reviewController.js 구현
   - GET  /api/reviews/:productId  → 해당 상품 리뷰 목록
   - POST /api/reviews             → 리뷰 작성 (로그인 필수)
   - DELETE /api/reviews/:id       → 내 리뷰 삭제

2) routes/reviewRoutes.js 라우트 연결

프론트엔드
1) ProductDetailPage.tsx 하단에 리뷰 섹션 추가
   - 별점 선택 UI + 텍스트 입력
   - 기존 리뷰 목록 표시 (닉네임, 별점, 내용, 날짜)
```

#### API 명세: 리뷰
| 메서드 | 경로 | 인증 | 설명 |
|--------|------|:----:|------|
| GET | /api/reviews/:productId | | 상품 리뷰 목록 |
| POST | /api/reviews | ✅ | 리뷰 작성 |
| DELETE | /api/reviews/:id | ✅ | 내 리뷰 삭제 |

### 상품 등록 기능 구현 가이드

로그인한 사용자가 새 상품을 등록할 수 있는 기능. (추후 관리자 전용으로 변경 가능)

#### 백엔드
```
1) controllers/productController.js에 createProduct 함수 추가
   - req.body에서 name, description, price, category, image_url, stock 받기
   - INSERT INTO products 쿼리 실행
   - 필수 필드 검증 (name, price)

2) routes/productRoutes.js에 POST 라우트 추가
   - POST /  →  createProduct
   - authenticateToken 미들웨어 적용 (로그인 필수)
```

#### 프론트엔드
```
1) pages/ProductRegisterPage.tsx 생성
   - 폼 필드: 상품명, 설명, 가격, 카테고리, 이미지 URL, 재고
   - api.post('/products', formData)로 서버에 전송
   - 등록 성공 시 메인 페이지로 이동

2) App.tsx에 라우트 추가
   - <Route path="products/new" element={<ProductRegisterPage />} />
   - 주의: products/:id 보다 위에 선언해야 함 (new가 :id로 매칭되지 않도록)

3) components/Layout.tsx 헤더에 "상품 등록" 링크 추가
   - 로그인 상태일 때만 표시
```

#### API 명세
| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| POST | /api/products | 필요 | 새 상품 등록 |

#### 요청 바디 예시
```json
{
  "name": "상품명",
  "description": "상품 설명",
  "price": 15000,
  "category": "카테고리",
  "image_url": "https://example.com/image.jpg",
  "stock": 100
}
```

---

## 참고: 프로젝트 실행 방법

```bash
# 서버 실행 (server 폴더에서)
npm run dev

# 클라이언트 실행 (client 폴더에서)
npm run dev
```

서버: http://localhost:5000
클라이언트: http://localhost:5173
