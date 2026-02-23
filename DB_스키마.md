# mini-shop DB 스키마 정리

> **AUTO_INCREMENT (자동 증가)란?**
> 데이터를 넣을 때 id를 직접 지정하지 않아도 1, 2, 3... 자동으로 번호가 올라가는 기능
> 코드: `id INT AUTO_INCREMENT PRIMARY KEY`

---

## 1. users (회원)
- 회원가입한 사용자 정보를 저장하는 테이블
- 코드: `CREATE TABLE users ( id INT AUTO_INCREMENT PRIMARY KEY, ... )`

| 컬럼명 | 타입 | NULL | 키 | 설명 |
|---|---|---|---|---|
| id | INT | NO | PK | 유저 고유 번호 (자동 증가) |
| email | VARCHAR(255) | NO | UNI | 로그인용 이메일 (중복 불가) |
| password | VARCHAR(255) | NO | | 비밀번호 (bcrypt 암호화 저장) |
| nickname | VARCHAR(100) | NO | | 사이트에서 보여질 닉네임 |
| created_at | TIMESTAMP | YES | | 가입 일시 (자동 기록) |

---

## 2. products (상품)
- 판매하는 상품 정보를 저장하는 테이블
- 코드: `CREATE TABLE products ( id INT AUTO_INCREMENT PRIMARY KEY, ... )`

| 컬럼명 | 타입 | NULL | 키 | 설명 |
|---|---|---|---|---|
| id | INT | NO | PK | 상품 고유 번호 (자동 증가) |
| user_id | INT | YES | FK | 등록한 사람 (-> users.id) |
| name | VARCHAR(255) | NO | | 상품 이름 |
| description | TEXT | YES | | 상품 상세 설명 |
| price | INT | NO | | 상품 가격 (원) |
| stock | INT | NO | | 재고 수량 (기본값: 0) |
| image_url | VARCHAR(500) | YES | | 상품 이미지 경로 |
| category | VARCHAR(100) | YES | | 상품 카테고리 (예: 의류, 전자기기) |
| created_at | TIMESTAMP | YES | | 상품 등록 일시 (자동 기록) |

---

## 3. cart_items (장바구니)
- 사용자가 장바구니에 담은 상품 목록을 저장하는 테이블
- 어떤 유저가 어떤 상품을 몇 개 담았는지 기록
- 코드: `CREATE TABLE cart_items ( id INT AUTO_INCREMENT PRIMARY KEY, ... )`

| 컬럼명 | 타입 | NULL | 키 | 설명 |
|---|---|---|---|---|
| id | INT | NO | PK | 장바구니 항목 고유 번호 (자동 증가) |
| user_id | INT | NO | FK | 담은 사람 (-> users.id) |
| product_id | INT | NO | FK | 담은 상품 (-> products.id) |
| quantity | INT | NO | | 담은 수량 (기본값: 1) |
| created_at | TIMESTAMP | YES | | 장바구니에 담은 일시 (자동 기록) |

---

## 4. orders (주문)
- 결제 완료된 주문 1건의 요약 정보를 저장하는 테이블
- 장바구니에서 결제하면 주문 1건이 생성됨
- 코드: `CREATE TABLE orders ( id INT AUTO_INCREMENT PRIMARY KEY, ... )`

| 컬럼명 | 타입 | NULL | 키 | 설명 |
|---|---|---|---|---|
| id | INT | NO | PK | 주문 고유 번호 (자동 증가) |
| user_id | INT | NO | FK | 주문한 사람 (-> users.id) |
| total_amount | INT | NO | | 주문 총 금액 (원) |
| status | VARCHAR(50) | NO | | 주문 상태 (기본값: 'completed') |
| created_at | TIMESTAMP | YES | | 주문 일시 (자동 기록) |

---

## 5. order_items (주문 상세)
- 주문 1건에 포함된 개별 상품 내역을 저장하는 테이블
- 예: 주문 1건에 모자 2개 + 티셔츠 1개 -> order_items 2줄
- 코드: `CREATE TABLE order_items ( id INT AUTO_INCREMENT PRIMARY KEY, ... )`

| 컬럼명 | 타입 | NULL | 키 | 설명 |
|---|---|---|---|---|
| id | INT | NO | PK | 주문 상세 고유 번호 (자동 증가) |
| order_id | INT | NO | FK | 어떤 주문인지 (-> orders.id) |
| product_id | INT | NO | FK | 주문한 상품 (-> products.id) |
| quantity | INT | NO | | 해당 상품 구매 수량 |
| price | INT | NO | | 결제 당시 상품 가격 (원) |

---

## 6. reviews (리뷰)
- 사용자가 상품에 남긴 리뷰와 별점을 저장하는 테이블
- 코드: `CREATE TABLE reviews ( id INT AUTO_INCREMENT PRIMARY KEY, ... )`

| 컬럼명 | 타입 | NULL | 키 | 설명 |
|---|---|---|---|---|
| id | INT | NO | PK | 리뷰 고유 번호 (자동 증가) |
| user_id | INT | NO | FK | 작성자 (-> users.id) |
| product_id | INT | NO | FK | 리뷰 대상 상품 (-> products.id) |
| rating | INT | NO | | 별점 (1~5점만 가능) |
| content | TEXT | YES | | 리뷰 내용 |
| created_at | TIMESTAMP | YES | | 리뷰 작성 일시 (자동 기록) |

---

## 7. wishlists (위시리스트)
- 사용자가 찜한 상품 목록을 저장하는 테이블
- 같은 상품을 중복으로 찜할 수 없음
- 코드: `CREATE TABLE wishlists ( id INT AUTO_INCREMENT PRIMARY KEY, ... )`

| 컬럼명 | 타입 | NULL | 키 | 설명 |
|---|---|---|---|---|
| id | INT | NO | PK | 위시리스트 고유 번호 (자동 증가) |
| user_id | INT | NO | FK | 찜한 사람 (-> users.id) |
| product_id | INT | NO | FK | 찜한 상품 (-> products.id) |
| created_at | TIMESTAMP | YES | | 찜한 일시 (자동 기록) |

> **(user_id + product_id) 조합 중복 불가 (UNIQUE)**

---

## FK 관계도 (외래키)

> **FK(외래키)란?**
> 다른 테이블의 id를 참조하여 테이블 간 관계를 연결하는 것

> **CASCADE란?**
> 부모 데이터가 삭제되면 연결된 자식 데이터도 자동 삭제
> 예: 유저 탈퇴 -> 그 유저의 장바구니, 주문, 리뷰 등 자동 삭제

| 참조하는 컬럼 | 참조 대상 | 삭제 시 동작 |
|---|---|---|
| products.user_id | users.id | SET NULL |
| cart_items.user_id | users.id | CASCADE |
| cart_items.product_id | products.id | CASCADE |
| orders.user_id | users.id | CASCADE |
| order_items.order_id | orders.id | CASCADE |
| order_items.product_id | products.id | CASCADE |
| reviews.user_id | users.id | CASCADE |
| reviews.product_id | products.id | CASCADE |
| wishlists.user_id | users.id | CASCADE |
| wishlists.product_id | products.id | CASCADE |
