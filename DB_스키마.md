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
| email | VARCHAR(255) | NO | UK | 로그인용 이메일 (중복 불가) |
| password | VARCHAR(255) | NO | | 비밀번호 (bcrypt 암호화 저장) |
| nickname | VARCHAR(100) | NO | | 사이트에서 보여질 닉네임 |
| role | VARCHAR(20) | NO | | 유저 권한 (기본값: 'user', 관리자: 'admin') |
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
| is_active | BOOLEAN | NO | | 상품 활성 여부 (기본값: true, 삭제 시 false) |
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
| is_selected | BOOLEAN | NO | | 구매 선택 여부 (기본값: true) |
| created_at | TIMESTAMP | YES | | 장바구니에 담은 일시 (자동 기록) |

---

## 4. coupons (쿠폰)
- 할인 쿠폰 정보를 저장하는 테이블
- 코드: `CREATE TABLE coupons ( id INT AUTO_INCREMENT PRIMARY KEY, ... )`

| 컬럼명 | 타입 | NULL | 키 | 설명 |
|---|---|---|---|---|
| id | INT | NO | PK | 쿠폰 고유 번호 (자동 증가) |
| code | VARCHAR(50) | NO | UK | 쿠폰 코드 (중복 불가) |
| discount_amount | INT | NO | | 할인 금액 (원) (기본값: 0) |
| discount_percentage | INT | YES | | 할인 비율 (%) |
| min_price | INT | YES | | 최소 사용 금액 (원) |
| expiry_date | DATETIME | NO | | 쿠폰 만료일 |
| max_uses | INT | YES | | 최대 사용 횟수 |
| current_uses | INT | NO | | 현재 사용 횟수 (기본값: 0) |
| is_active | BOOLEAN | NO | | 쿠폰 활성 여부 (기본값: true) |
| created_at | TIMESTAMP | YES | | 쿠폰 생성 일시 (자동 기록) |

---

## 5. user_coupons (유저 보유 쿠폰)
- 사용자가 보유한 쿠폰 목록을 저장하는 테이블
- 같은 쿠폰을 중복 보유할 수 없음
- 코드: `CREATE TABLE user_coupons ( id INT AUTO_INCREMENT PRIMARY KEY, ... )`

| 컬럼명 | 타입 | NULL | 키 | 설명 |
|---|---|---|---|---|
| id | INT | NO | PK | 고유 번호 (자동 증가) |
| user_id | INT | NO | FK | 쿠폰 보유자 (-> users.id) |
| coupon_id | INT | NO | FK | 보유한 쿠폰 (-> coupons.id) |
| is_used | BOOLEAN | NO | | 사용 여부 (기본값: false) |
| used_at | DATETIME | YES | | 사용한 일시 |
| created_at | TIMESTAMP | YES | | 쿠폰 수령 일시 (자동 기록) |

> **(user_id + coupon_id) 조합 중복 불가 (UNIQUE)**

---

## 6. orders (주문)
- 결제 완료된 주문 1건의 요약 정보를 저장하는 테이블
- 장바구니에서 결제하면 주문 1건이 생성됨
- 코드: `CREATE TABLE orders ( id INT AUTO_INCREMENT PRIMARY KEY, ... )`

| 컬럼명 | 타입 | NULL | 키 | 설명 |
|---|---|---|---|---|
| id | INT | NO | PK | 주문 고유 번호 (자동 증가) |
| user_id | INT | NO | FK | 주문한 사람 (-> users.id) |
| total_amount | INT | NO | | 상품 총 금액 (원) |
| discount_amount | INT | NO | | 할인 금액 (기본값: 0) |
| final_amount | INT | NO | | 최종 결제 금액 (total - discount) |
| status | VARCHAR(50) | NO | | 주문 상태 (pending/shipped/delivered/completed) |
| delivery_address | TEXT | YES | | 배송 주소 |
| receiver_name | VARCHAR(100) | YES | | 수령인 이름 |
| receiver_phone | VARCHAR(20) | YES | | 수령인 전화번호 |
| coupon_id | INT | YES | FK | 사용한 쿠폰 (-> coupons.id) |
| completed_at | DATETIME | YES | | 구매 확정 일시 |
| created_at | TIMESTAMP | YES | | 주문 일시 (자동 기록) |
| updated_at | TIMESTAMP | YES | | 상태 변경 일시 (자동 갱신) |

> **주문 상태 흐름: pending(준비중) → shipped(배송중) → delivered(배송완료) → completed(구매확정)**
> 관리자가 상태를 변경할 수 있음 (관리자 페이지에서 드롭다운으로 변경)

---

## 7. order_items (주문 상세)
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

## 8. reviews (리뷰)
- 사용자가 상품에 남긴 리뷰와 별점을 저장하는 테이블
- 구매 완료 후에만 리뷰 작성 가능
- 코드: `CREATE TABLE reviews ( id INT AUTO_INCREMENT PRIMARY KEY, ... )`

| 컬럼명 | 타입 | NULL | 키 | 설명 |
|---|---|---|---|---|
| id | INT | NO | PK | 리뷰 고유 번호 (자동 증가) |
| user_id | INT | NO | FK | 작성자 (-> users.id) |
| product_id | INT | NO | FK | 리뷰 대상 상품 (-> products.id) |
| order_id | INT | NO | FK | 구매한 주문 (-> orders.id) |
| rating | INT | NO | | 별점 (1~5점만 가능) |
| content | TEXT | YES | | 리뷰 내용 |
| created_at | TIMESTAMP | YES | | 리뷰 작성 일시 (자동 기록) |

---

## 9. wishlists (위시리스트)
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

## 10. product_options (상품 옵션 그룹)
- 상품에 달린 옵션 종류를 저장하는 테이블
- 예: 옷 → "사이즈", "색상" 두 가지 옵션 그룹
- 코드: `CREATE TABLE product_options ( id INT AUTO_INCREMENT PRIMARY KEY, ... )`

| 컬럼명 | 타입 | NULL | 키 | 설명 |
|---|---|---|---|---|
| id | INT | NO | PK | 옵션 그룹 고유 번호 (자동 증가) |
| product_id | INT | NO | FK | 어떤 상품의 옵션인지 (-> products.id) |
| option_name | VARCHAR(100) | NO | | 옵션 이름 (예: 사이즈, 색상) |
| created_at | TIMESTAMP | YES | | 생성 일시 (자동 기록) |

---

## 11. product_option_values (상품 옵션 값)
- 옵션 그룹에 속한 구체적인 선택지를 저장하는 테이블
- 예: "사이즈" 옵션 → S, M, L, XL
- 코드: `CREATE TABLE product_option_values ( id INT AUTO_INCREMENT PRIMARY KEY, ... )`

| 컬럼명 | 타입 | NULL | 키 | 설명 |
|---|---|---|---|---|
| id | INT | NO | PK | 옵션 값 고유 번호 (자동 증가) |
| option_id | INT | NO | FK | 어떤 옵션 그룹인지 (-> product_options.id) |
| value | VARCHAR(100) | NO | | 옵션 값 (예: S, M, L, 빨강, 파랑) |
| extra_price | INT | NO | | 추가 금액 (기본값: 0원) |
| stock | INT | NO | | 해당 옵션 재고 수량 (기본값: 0) |
| created_at | TIMESTAMP | YES | | 생성 일시 (자동 기록) |

---

## 12. cart_item_options (장바구니 선택 옵션)
- 장바구니에 담을 때 선택한 옵션을 기록하는 테이블
- 예: 장바구니에 티셔츠 담을 때 "사이즈: M", "색상: 빨강" 선택
- 코드: `CREATE TABLE cart_item_options ( id INT AUTO_INCREMENT PRIMARY KEY, ... )`

| 컬럼명 | 타입 | NULL | 키 | 설명 |
|---|---|---|---|---|
| id | INT | NO | PK | 고유 번호 (자동 증가) |
| cart_item_id | INT | NO | FK | 장바구니 항목 (-> cart_items.id) |
| option_value_id | INT | NO | FK | 선택한 옵션 값 (-> product_option_values.id) |

---

## 13. order_item_options (주문 상품 선택 옵션)
- 주문 시점에 선택된 옵션을 기록하는 테이블
- 나중에 주문 내역에서 "사이즈: M" 등 확인 가능
- 코드: `CREATE TABLE order_item_options ( id INT AUTO_INCREMENT PRIMARY KEY, ... )`

| 컬럼명 | 타입 | NULL | 키 | 설명 |
|---|---|---|---|---|
| id | INT | NO | PK | 고유 번호 (자동 증가) |
| order_item_id | INT | NO | FK | 주문 상세 항목 (-> order_items.id) |
| option_value_id | INT | NO | FK | 선택한 옵션 값 (-> product_option_values.id) |

---

## 14. gifts (선물)
- 선물하기로 보낸 주문을 추적하는 테이블
- 회원/비회원 모두 받을 수 있음 (receiver_id는 회원일 때만)
- 코드: `CREATE TABLE gifts ( id INT AUTO_INCREMENT PRIMARY KEY, ... )`

| 컬럼명 | 타입 | NULL | 키 | 설명 |
|---|---|---|---|---|
| id | INT | NO | PK | 선물 고유 번호 (자동 증가) |
| order_id | INT | NO | FK | 선물과 연결된 주문 (-> orders.id) |
| sender_id | INT | NO | FK | 보내는 사람 (-> users.id) |
| receiver_id | INT | YES | FK | 받는 사람 - 회원일 경우 (-> users.id) |
| receiver_name | VARCHAR(100) | YES | | 받는 사람 이름 |
| receiver_phone | VARCHAR(20) | YES | | 받는 사람 연락처 |
| message | TEXT | YES | | 선물 메시지 |
| status | VARCHAR(50) | NO | | 상태 (pending/accepted/rejected) |
| accepted_at | DATETIME | YES | | 선물 수락 일시 |
| created_at | TIMESTAMP | YES | | 선물 보낸 일시 (자동 기록) |

> **선물 상태 흐름: pending(대기중) → accepted(수락) / rejected(거절)**

---

## 15. notifications (알림)
- 사용자에게 보내는 알림을 저장하는 테이블
- 주문 상태 변경, 선물 도착, 쿠폰 발급 등 이벤트 알림
- 코드: `CREATE TABLE notifications ( id INT AUTO_INCREMENT PRIMARY KEY, ... )`

| 컬럼명 | 타입 | NULL | 키 | 설명 |
|---|---|---|---|---|
| id | INT | NO | PK | 알림 고유 번호 (자동 증가) |
| user_id | INT | NO | FK | 알림 받는 사람 (-> users.id) |
| type | VARCHAR(50) | NO | | 알림 종류 (order/gift/coupon/system) |
| title | VARCHAR(255) | NO | | 알림 제목 |
| content | TEXT | YES | | 알림 내용 |
| is_read | BOOLEAN | NO | | 읽음 여부 (기본값: false) |
| link | VARCHAR(500) | YES | | 클릭 시 이동할 경로 |
| created_at | TIMESTAMP | YES | | 알림 생성 일시 (자동 기록) |

> **알림 타입 종류:**
> - `order`: 주문/배송 관련 (배송 시작, 배송 완료 등)
> - `gift`: 선물 관련 (선물 도착, 수락/거절)
> - `coupon`: 쿠폰 관련 (새 쿠폰 발급)
> - `system`: 시스템 공지

---

## 16. mailbox (우편함)
- 보상 수령용 우편함 테이블
- 선물, 쿠폰 지급, 이벤트 당첨 보상 등을 수령하는 곳
- 보상이 있는 우편은 "수령하기" 버튼으로 보상을 받을 수 있음
- 코드: `CREATE TABLE mailbox ( id INT AUTO_INCREMENT PRIMARY KEY, ... )`

| 컬럼명 | 타입 | NULL | 키 | 설명 |
|---|---|---|---|---|
| id | INT | NO | PK | 우편 고유 번호 (자동 증가) |
| user_id | INT | NO | FK | 받는 사람 (-> users.id) |
| type | VARCHAR(50) | NO | | 우편 종류 (gift/coupon/event/system) |
| title | VARCHAR(255) | NO | | 우편 제목 |
| content | TEXT | YES | | 우편 내용 |
| reward_type | VARCHAR(50) | YES | | 보상 종류 (coupon/point/item, 없으면 NULL) |
| reward_id | INT | YES | | 보상 연결 ID (쿠폰 ID 등) |
| reward_amount | INT | YES | | 보상 수량/금액 |
| is_read | BOOLEAN | NO | | 읽음 여부 (기본값: false) |
| is_claimed | BOOLEAN | NO | | 보상 수령 여부 (기본값: false) |
| claimed_at | DATETIME | YES | | 보상 수령 일시 |
| expires_at | DATETIME | YES | | 우편 만료일 (만료 시 수령 불가) |
| created_at | TIMESTAMP | YES | | 우편 도착 일시 (자동 기록) |

> **우편 종류 (type):**
> - `gift`: 선물 도착 (다른 유저가 보낸 선물)
> - `coupon`: 쿠폰 지급 (관리자가 지급한 쿠폰)
> - `event`: 이벤트 보상 (이벤트 당첨 보상)
> - `system`: 시스템 공지 (보상 없음)
>
> **보상 종류 (reward_type):**
> - `coupon`: 쿠폰 지급 → reward_id = 쿠폰 ID
> - `point`: 포인트 지급 → reward_amount = 포인트 금액
> - `item`: 상품 지급 → reward_id = 상품 ID
> - NULL: 보상 없음 (안내 우편)

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
| user_coupons.user_id | users.id | CASCADE |
| user_coupons.coupon_id | coupons.id | CASCADE |
| orders.user_id | users.id | CASCADE |
| orders.coupon_id | coupons.id | SET NULL |
| order_items.order_id | orders.id | CASCADE |
| order_items.product_id | products.id | CASCADE |
| reviews.user_id | users.id | CASCADE |
| reviews.product_id | products.id | CASCADE |
| reviews.order_id | orders.id | CASCADE |
| wishlists.user_id | users.id | CASCADE |
| wishlists.product_id | products.id | CASCADE |
| product_options.product_id | products.id | CASCADE |
| product_option_values.option_id | product_options.id | CASCADE |
| cart_item_options.cart_item_id | cart_items.id | CASCADE |
| cart_item_options.option_value_id | product_option_values.id | CASCADE |
| order_item_options.order_item_id | order_items.id | CASCADE |
| order_item_options.option_value_id | product_option_values.id | CASCADE |
| gifts.order_id | orders.id | CASCADE |
| gifts.sender_id | users.id | CASCADE |
| gifts.receiver_id | users.id | SET NULL |
| notifications.user_id | users.id | CASCADE |
| mailbox.user_id | users.id | CASCADE |
