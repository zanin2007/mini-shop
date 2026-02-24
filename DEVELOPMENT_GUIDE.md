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
- 메인 (상품 목록 + 검색 + 카테고리 필터)
- 로그인 / 회원가입
- 상품 상세 (리뷰 포함)
- 장바구니 (선택 구매)
- 주문 확인 (배송정보 + 쿠폰 적용)
- 마이페이지 (주문내역 + 쿠폰)
- 우편함 (보상 수령)
- 알림 (주문/선물/쿠폰/시스템 알림)
- 관리자 페이지 (주문/상품/쿠폰 관리)

사용자 흐름:
회원가입 → 로그인 → 상품 탐색(검색/필터) → 장바구니 담기 → 선택 → 쿠폰 적용 → 배송정보 입력 → 주문하기 → 리뷰 작성
알림/우편함: 헤더의 🔔/✉️ 아이콘으로 접근, 읽지 않은 개수 뱃지 표시
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
2) 각 엔티티의 속성 정의: 사용자 → email, password, nickname, role ...
3) 관계 설정: 주문은 사용자에게 속한다 (user_id FK)
```

### Mini Shop DB 구조
```
users                →  회원 정보 (role: user/admin)
products             →  상품 정보 (user_id로 등록자 추적)
cart_items           →  장바구니 (is_selected로 선택 구매)
orders               →  주문 (쿠폰 할인, 배송 정보 포함)
order_items          →  주문 상세 (orders ↔ products)
reviews              →  리뷰 (구매 확인 후 작성, 별점 1~5)
wishlists            →  찜 목록 (users ↔ products)
coupons              →  쿠폰 (정액/정률 할인)
user_coupons         →  유저 보유 쿠폰
product_options      →  상품 옵션 그룹 (사이즈, 색상 등)
product_option_values→  옵션 값 (S, M, L, 빨강, 파랑 등)
cart_item_options    →  장바구니 선택 옵션
order_item_options   →  주문 상품 선택 옵션
gifts                →  선물하기 (보내는 사람 ↔ 받는 사람)
notifications        →  알림 (주문/선물/쿠폰/시스템)
mailbox              →  우편함 (보상 수령: 쿠폰/포인트/아이템)
```

### 팁
- 테이블마다 `id` (PK, AUTO_INCREMENT)와 `created_at` 컬럼은 기본으로 넣기
- 가격은 `INT` 타입 사용 (원 단위)
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
② 상품 CRUD        ← 상품이 있어야 장바구니/주문 가능
③ 장바구니         ← 로그인 + 상품 필요
④ 주문             ← 장바구니 → 주문 전환
⑤ 위시리스트       ← 부가 기능
⑥ 리뷰             ← 구매 후 작성 (orders + order_items 필요)
⑦ 쿠폰             ← 주문 시 할인 적용
⑧ 알림/우편함      ← 알림 + 보상 수령 시스템
⑨ 관리자           ← 모든 기능 완성 후 관리 도구
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
② 메인 페이지 (상품 목록 + 검색 + 카테고리)
③ 상품 상세 페이지 (리뷰 섹션 포함)
④ 장바구니 페이지 (선택 구매)
⑤ 주문 확인 페이지 (배송정보 + 쿠폰)
⑥ 마이페이지 (주문내역 탭 + 쿠폰 탭)
⑦ 우편함 페이지 (보상 수령)
⑧ 알림 페이지 (읽음 처리 + 전체 읽음)
⑨ 관리자 페이지 (주문/상품/쿠폰 관리)
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
- [x] CORS 설정 확인
- [x] Axios baseURL이 서버 주소와 일치하는지 확인
- [x] 로그인 후 토큰이 localStorage에 저장되는지 확인
- [x] 인증이 필요한 API 호출 시 Authorization 헤더에 토큰이 포함되는지 확인
- [x] 에러 응답(400, 401, 500 등) 처리가 되는지 확인

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

#### 인증
- [ ] 회원가입 → 같은 이메일로 다시 가입 시 에러 뜨는지
- [ ] 로그인 → 토큰 받아오는지 (role 포함)
- [ ] 비로그인 상태에서 장바구니 접근 시 처리
- [ ] 새로고침해도 로그인 유지되는지
- [ ] 로그인 상태에서 로그인/회원가입 페이지 접근 차단

#### 상품
- [ ] 메인 페이지에서 상품 목록 표시
- [ ] 검색어 입력 후 검색 → 필터된 결과 확인
- [ ] 카테고리 버튼 클릭 → 해당 카테고리만 표시
- [ ] 상품 등록 → user_id 저장 확인
- [ ] 본인 상품 → 삭제 버튼 표시, 타인 상품 → 버튼 없음

#### 장바구니
- [ ] 상품 장바구니 추가 → 수량 변경 → 삭제
- [ ] 체크박스 개별 선택/해제 → 총 금액 변동
- [ ] 전체 선택/해제 동작
- [ ] 선택된 상품만 주문됨 확인

#### 주문
- [ ] 배송 정보 입력 (수령인, 연락처, 주소)
- [ ] 쿠폰 적용 → 할인 금액 표시
- [ ] 주문 생성 → 재고 감소 확인
- [ ] 주문 완료 후 장바구니에서 해당 상품 삭제 확인
- [ ] 재고 부족 시 구체적 에러 메시지 표시

#### 리뷰
- [ ] 미구매 상품 → 리뷰 작성 버튼 없음
- [ ] 구매한 상품 → 리뷰 작성 가능
- [ ] 별점 + 내용 입력 후 등록
- [ ] 중복 리뷰 방지
- [ ] 본인 리뷰만 삭제 가능

#### 쿠폰
- [ ] 마이페이지에서 쿠폰 코드 입력 → 등록
- [ ] 중복 등록 방지
- [ ] 만료된 쿠폰 코드 등록 시 에러
- [ ] 주문 시 사용 가능한 쿠폰 드롭다운 표시
- [ ] 쿠폰 적용 후 결제 금액 변동
- [ ] 사용완료/만료 쿠폰 구분 표시

#### 알림
- [ ] 헤더 🔔 아이콘에 안읽은 알림 수 뱃지 표시
- [ ] 알림 클릭 시 읽음 처리 (파란 배경 → 흰 배경)
- [ ] "전체 읽음" 버튼 동작
- [ ] ← 뒤로가기 버튼으로 이전 페이지 이동
- [ ] 타입별 아이콘 정상 표시

#### 우편함
- [ ] 헤더 ✉️ 아이콘에 안읽은 우편 수 뱃지 표시
- [ ] 보상 수령 버튼 클릭 → 수령 완료 처리
- [ ] 이미 수령한 보상 → "수령완료" 비활성화
- [ ] 만료된 우편 → "만료" 비활성화
- [ ] 우편 삭제 동작
- [ ] ← 뒤로가기 버튼으로 이전 페이지 이동

#### 관리자
- [ ] 일반 유저 → 관리자 메뉴 안 보임
- [ ] 관리자 계정 → 헤더에 "관리자" 메뉴 표시
- [ ] 주문 상태 변경 (드롭다운)
- [ ] 상품 삭제
- [ ] 쿠폰 생성 + 삭제

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
|------|:------:|:---------:|------|
| 회원가입/로그인 | ✅ | ✅ | 완료 (JWT에 role 포함) |
| 로그인 시 auth 페이지 접근 차단 | - | ✅ | 완료 |
| 상품 목록/상세 | ✅ | ✅ | 완료 (검색 + 카테고리 필터) |
| 상품 등록 | ✅ | ✅ | 완료 (user_id 자동 저장) |
| 상품 삭제 | ✅ | ✅ | 완료 (본인 등록 상품만) |
| 장바구니 | ✅ | ✅ | 완료 (선택 구매 체크박스) |
| 주문 | ✅ | ✅ | 완료 (재고검증 + 선택상품만) |
| 배송 정보 | ✅ | ✅ | 완료 (수령인/연락처/주소) |
| 마이페이지 (주문 내역) | ✅ | ✅ | 완료 (상태 진행 바 + 할인 표시) |
| 위시리스트 | ✅ | ✅ | 완료 |
| 리뷰 | ✅ | ✅ | 완료 (구매 후 작성, 별점 1~5) |
| 쿠폰 | ✅ | ✅ | 완료 (코드 등록, 주문 시 적용) |
| 알림 | ✅ | ✅ | 완료 (🔔 뱃지 + 읽음처리 + 전체읽음) |
| 우편함 | ✅ | ✅ | 완료 (✉️ 뱃지 + 보상수령 + 만료처리) |
| 커스텀 알림창 | - | ✅ | 완료 (토스트 알림 + 확인 모달) |
| 관리자 | ✅ | ✅ | 완료 (주문/상품/쿠폰 관리) |

---

## 구현된 기능 상세 가이드

### 검색 & 카테고리 필터

**서버** (`productController.js`)
```
GET /api/products?search=키워드&category=의류
- WHERE 1=1 패턴으로 동적 SQL 빌드
- search → name LIKE '%키워드%'
- category → category = '의류'

GET /api/products/categories
- DISTINCT category로 중복 제거 목록 반환
```

**클라이언트** (`MainPage.tsx`)
```
- 히어로 배너 아래에 검색바 (input + 검색 버튼)
- 카테고리 버튼 그룹 (전체, 의류, 전자기기 등)
- 검색어 + 카테고리 동시 필터 가능
- 결과 개수 표시
```

### 장바구니 선택 구매

**서버** (`cartController.js`)
```
PUT /api/cart/select-all     → 전체 선택/해제 (body: { selected: true/false })
PUT /api/cart/:id/select     → 개별 선택 토글 (NOT is_selected)
```

**클라이언트** (`CartPage.tsx`)
```
- 각 아이템에 체크박스
- 상단에 전체 선택/해제 체크박스
- 선택된 아이템만 총 금액 계산
- 선택 없으면 구매 버튼 비활성화
```

**주문 시** (`orderController.js`)
```
- WHERE c.is_selected = true 조건으로 선택된 상품만 주문
- 주문 완료 후 해당 아이템만 장바구니에서 삭제
```

### 리뷰 시스템

**서버** (`reviewController.js`)
```
GET  /api/reviews/product/:productId  → 리뷰 목록 (users JOIN으로 닉네임 포함)
GET  /api/reviews/check/:productId    → 구매 여부 + 리뷰 작성 여부 확인
POST /api/reviews                     → 리뷰 작성 (orders+order_items JOIN으로 구매 검증)
DELETE /api/reviews/:id               → 리뷰 삭제 (본인만)
```

**클라이언트** (`ProductDetailPage.tsx`)
```
- 상품 상세 하단에 리뷰 섹션
- 평균 별점 + 리뷰 수 표시
- 구매 확인된 유저에게만 "리뷰 작성하기" 버튼
- 별점 선택 (★ 1~5) + 텍스트 입력
- 본인 리뷰에만 삭제 버튼
```

### 쿠폰 시스템

**서버** (`couponController.js`)
```
GET  /api/coupons                          → 내 쿠폰 목록
GET  /api/coupons/available?totalAmount=N  → 사용 가능한 쿠폰 (금액 조건 필터)
POST /api/coupons/claim                    → 쿠폰 코드 등록 ({ code: "WELCOME10" })
```

**주문 시 쿠폰 적용** (`orderController.js`)
```
- body에서 couponId 받음
- user_coupons 테이블에서 검증 (본인 소유, 미사용, 유효기간, 최소금액)
- discount_percentage면 정률 할인, discount_amount면 정액 할인
- 둘 다 있으면 더 큰 쪽 적용
- 쿠폰 사용 완료 처리 (is_used = true, used_at = NOW())
```

**클라이언트**
- `CheckoutPage.tsx`: 쿠폰 선택 드롭다운, 할인 금액 실시간 표시
- `MyPage.tsx`: 쿠폰 탭 (코드 입력 등록, 사용가능/사용완료 구분)

### 배송 정보 & 주문 추적

**서버** (`orderController.js`)
```
- 주문 생성 시 receiver_name, receiver_phone, delivery_address 저장
```

**클라이언트**
- `CheckoutPage.tsx`: 수령인/연락처/주소 입력 폼 (필수 입력)
- `MyPage.tsx`: 주문별 배송 상태 진행 바 (준비중 → 배송중 → 배송완료 → 구매확정)

### 관리자 기능

**서버**

미들웨어 (`authMiddleware.js`)
```
- authenticateToken: JWT 검증
- isAdmin: req.user.role === 'admin' 확인
```

API (`adminController.js`)
```
GET    /api/admin/orders              → 전체 주문 목록 (유저 닉네임 포함)
PUT    /api/admin/orders/:id/status   → 주문 상태 변경
GET    /api/admin/products            → 전체 상품 목록 (판매자 닉네임 포함)
DELETE /api/admin/products/:id        → 상품 삭제
GET    /api/admin/coupons             → 전체 쿠폰 목록
POST   /api/admin/coupons             → 쿠폰 생성
DELETE /api/admin/coupons/:id         → 쿠폰 삭제
```

**클라이언트** (`AdminPage.tsx`)
```
- 관리자 전용 페이지 (role !== 'admin'이면 메인으로 리다이렉트)
- 3개 탭: 주문 관리 / 상품 관리 / 쿠폰 관리
- 주문: 테이블 + 상태 변경 드롭다운 (색상별 구분)
- 상품: 테이블 + 삭제 버튼
- 쿠폰: 생성 폼 + 테이블 + 삭제 버튼
```

**관리자 계정 설정**
```sql
UPDATE users SET role = 'admin' WHERE email = '관리자이메일';
```
> 변경 후 **재로그인** 필요 (JWT에 role이 포함되어야 함)

### 알림 시스템

**서버** (`notificationController.js`)
```
GET  /api/notifications              → 알림 목록 (최근 50개)
GET  /api/notifications/unread-count → 안읽은 알림 수
PUT  /api/notifications/:id/read     → 알림 읽음 처리
PUT  /api/notifications/read-all     → 전체 읽음 처리
```

**클라이언트** (`NotificationPage.tsx`)
```
- 헤더 🔔 아이콘 (안읽은 수 뱃지)
- ← 뒤로가기 버튼
- 타입별 아이콘 (📦주문, ⭐리뷰, 🎟️쿠폰, 🎁선물, 📢시스템)
- 안읽은 알림은 파란 배경
- "전체 읽음" 버튼
- 상대 시간 표시 (방금 전, N분 전, N시간 전)
```

### 우편함 (보상 수령)

**서버** (`mailboxController.js`)
```
GET    /api/mailbox              → 우편 목록
GET    /api/mailbox/unread-count → 안읽은 우편 수
PUT    /api/mailbox/:id/read     → 읽음 처리
POST   /api/mailbox/:id/claim    → 보상 수령 (쿠폰/포인트/아이템)
DELETE /api/mailbox/:id          → 우편 삭제
```

**보상 수령 로직** (`claimReward()`)
```
1) 우편 조회 → 본인 소유 확인
2) 이미 수령했는지 확인
3) 만료 여부 확인
4) 보상 종류별 처리:
   - coupon: user_coupons에 쿠폰 추가
   - point: 유저 포인트 증가 (미구현)
   - item: 상품 지급 (미구현)
5) is_claimed = true, claimed_at = NOW() 업데이트
* 트랜잭션으로 처리하여 데이터 일관성 보장
```

**클라이언트** (`MailboxPage.tsx`)
```
- 헤더 ✉️ 아이콘 (안읽은 수 뱃지)
- ← 뒤로가기 버튼
- 상태별 아이콘 (📩미확인, 📧확인, ✅수령완료, ⏰만료)
- 보상 수령 버튼 (수령/수령완료/만료 상태 구분)
- 우편 삭제 기능
- 만료일 표시
```

### 커스텀 알림창 (토스트 + 확인 모달)

**AlertContext.tsx**
```
- useAlert() 훅으로 전역 사용
- showAlert(message, type): 토스트 알림 (3초 후 자동 사라짐)
  - type: success(초록), error(빨강), warning(노랑), info(파랑)
- showConfirm(message): 확인 모달 (Promise<boolean> 반환)
  - await showConfirm('삭제하시겠습니까?') → true/false
```

**적용된 곳**: 로그아웃, 삭제, 구매, 회원가입 등 모든 alert/confirm 대체

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
