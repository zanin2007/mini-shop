import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import api from '../../api/instance';
import { useAlert } from '../../components/AlertContext';
import type { Coupon } from '../../types';
import './CheckoutPage.css';

interface CartItem {
  id: number;
  product_id: number;
  quantity: number;
  is_selected: boolean;
  name: string;
  price: number;
  image_url: string;
  options?: { option_name: string; value: string; extra_price: number }[];
}

interface SearchedUser {
  id: number;
  nickname: string;
  email: string;
}

function CheckoutPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const { showAlert, showConfirm } = useAlert();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [delivery, setDelivery] = useState({ receiver_name: '', receiver_phone: '', delivery_address: '' });
  const navigate = useNavigate();

  // 선물 관련 상태
  const [isGift, setIsGift] = useState(false);
  const [giftMessage, setGiftMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchedUser[]>([]);
  const [selectedReceiver, setSelectedReceiver] = useState<SearchedUser | null>(null);
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      showAlert('로그인이 필요합니다.', 'warning');
      navigate('/login');
      return;
    }
    fetchCart();
  }, []);

  const fetchCart = async () => {
    try {
      const response = await api.get('/cart');
      const selectedItems = response.data.filter((item: CartItem) => item.is_selected);
      if (selectedItems.length === 0) {
        showAlert('선택된 상품이 없습니다.', 'warning');
        navigate('/cart');
        return;
      }
      setCartItems(selectedItems);
    } catch (error) {
      console.error('장바구니 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const getItemTotal = (item: CartItem) => {
    const extra = item.options?.reduce((s, o) => s + o.extra_price, 0) || 0;
    return (item.price + extra) * item.quantity;
  };
  const totalPrice = cartItems.reduce((sum, item) => sum + getItemTotal(item), 0);
  const discountAmount = selectedCoupon?.calculated_discount || 0;
  const finalPrice = totalPrice - discountAmount;

  // 장바구니 로드 후 쿠폰 조회
  useEffect(() => {
    if (totalPrice > 0) {
      fetchCoupons();
    }
  }, [totalPrice]);

  const fetchCoupons = async () => {
    try {
      const response = await api.get(`/coupons/available?totalAmount=${totalPrice}`);
      setCoupons(response.data);
    } catch (error) {
      console.error('쿠폰 조회 실패:', error);
    }
  };

  // 유저 검색 (디바운스)
  const handleSearchUser = (query: string) => {
    setSearchQuery(query);
    setSelectedReceiver(null);
    if (searchTimer) clearTimeout(searchTimer);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const response = await api.get(`/auth/search?q=${encodeURIComponent(query)}`);
        setSearchResults(response.data);
      } catch (error) {
        console.error('유저 검색 실패:', error);
      }
    }, 300);
    setSearchTimer(timer);
  };

  const handleSelectReceiver = (user: SearchedUser) => {
    setSelectedReceiver(user);
    setSearchQuery(user.nickname);
    setSearchResults([]);
  };

  const handleCouponChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = Number(e.target.value);
    if (id === 0) {
      setSelectedCoupon(null);
    } else {
      const coupon = coupons.find(c => c.user_coupon_id === id) || null;
      setSelectedCoupon(coupon);
    }
  };

  const handleOrder = async () => {
    if (!delivery.receiver_name.trim() || !delivery.receiver_phone.trim() || !delivery.delivery_address.trim()) {
      showAlert('배송 정보를 모두 입력해주세요.', 'warning');
      return;
    }
    if (isGift && !selectedReceiver) {
      showAlert('선물 받을 사람을 선택해주세요.', 'warning');
      return;
    }
    const confirmMsg = isGift
      ? `${selectedReceiver?.nickname}님에게 선물을 보내시겠습니까?`
      : '주문을 진행하시겠습니까?';
    if (!(await showConfirm(confirmMsg))) return;

    setOrdering(true);
    try {
      await api.post('/orders', {
        couponId: selectedCoupon?.user_coupon_id || null,
        ...delivery,
        isGift,
        receiverId: isGift ? selectedReceiver?.id : undefined,
        giftMessage: isGift ? giftMessage : undefined,
      });
      showAlert(isGift ? '선물 주문이 완료되었습니다!' : '주문이 완료되었습니다!', 'success');
      navigate('/mypage');
    } catch (error) {
      console.error('주문 실패:', error);
      if (error instanceof AxiosError) {
        showAlert(error.response?.data?.message || '주문에 실패했습니다.', 'error');
      } else {
        showAlert('주문에 실패했습니다.', 'error');
      }
    } finally {
      setOrdering(false);
    }
  };

  if (loading) {
    return <div className="loading">로딩 중...</div>;
  }

  const formatCouponLabel = (coupon: Coupon) => {
    let label = coupon.code + ' - ';
    if (coupon.discount_percentage) {
      label += `${coupon.discount_percentage}% 할인`;
    } else {
      label += `${coupon.discount_amount.toLocaleString()}원 할인`;
    }
    label += ` (-${coupon.calculated_discount.toLocaleString()}원)`;
    return label;
  };

  return (
    <div className="checkout-page">
      <div className="checkout-container">
        <h2 className="checkout-title">주문 확인</h2>

        <div className="checkout-section">
          <h3>주문 상품</h3>
          <div className="checkout-items">
            {cartItems.map(item => (
              <div key={item.id} className="checkout-item">
                <div className="checkout-item-image">
                  <img src={item.image_url} alt={item.name} />
                </div>
                <div className="checkout-item-info">
                  <p className="checkout-item-name">{item.name}</p>
                  {item.options && item.options.length > 0 && (
                    <p className="checkout-item-options">
                      {item.options.map(o => `${o.option_name}: ${o.value}`).join(' / ')}
                    </p>
                  )}
                  <p className="checkout-item-detail">
                    {item.price.toLocaleString()}원 x {item.quantity}개
                  </p>
                </div>
                <div className="checkout-item-subtotal">
                  {getItemTotal(item).toLocaleString()}원
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 배송 정보 */}
        <div className="checkout-section">
          <h3>배송 정보</h3>
          <div className="delivery-form">
            <div className="delivery-field">
              <label>수령인</label>
              <input
                type="text"
                placeholder="이름을 입력하세요"
                value={delivery.receiver_name}
                onChange={(e) => setDelivery({ ...delivery, receiver_name: e.target.value })}
              />
            </div>
            <div className="delivery-field">
              <label>연락처</label>
              <input
                type="tel"
                placeholder="010-0000-0000"
                value={delivery.receiver_phone}
                onChange={(e) => setDelivery({ ...delivery, receiver_phone: e.target.value })}
              />
            </div>
            <div className="delivery-field">
              <label>배송 주소</label>
              <input
                type="text"
                placeholder="주소를 입력하세요"
                value={delivery.delivery_address}
                onChange={(e) => setDelivery({ ...delivery, delivery_address: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* 쿠폰 섹션 */}
        <div className="checkout-section">
          <h3>쿠폰 적용</h3>
          {coupons.length === 0 ? (
            <p className="no-coupons">사용 가능한 쿠폰이 없습니다.</p>
          ) : (
            <select
              className="coupon-select"
              value={selectedCoupon?.user_coupon_id || 0}
              onChange={handleCouponChange}
            >
              <option value={0}>쿠폰을 선택해주세요</option>
              {coupons.map(coupon => (
                <option key={coupon.user_coupon_id} value={coupon.user_coupon_id}>
                  {formatCouponLabel(coupon)}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* 선물하기 */}
        <div className="checkout-section">
          <div className="gift-toggle">
            <label>
              <input
                type="checkbox"
                checked={isGift}
                onChange={(e) => {
                  setIsGift(e.target.checked);
                  if (!e.target.checked) {
                    setSelectedReceiver(null);
                    setSearchQuery('');
                    setGiftMessage('');
                  }
                }}
              />
              <span>선물하기</span>
            </label>
          </div>
          {isGift && (
            <div className="gift-form">
              <div className="gift-search">
                <label>받는 사람</label>
                <div className="search-input-wrapper">
                  <input
                    type="text"
                    placeholder="닉네임 또는 이메일로 검색"
                    value={searchQuery}
                    onChange={(e) => handleSearchUser(e.target.value)}
                  />
                  {selectedReceiver && (
                    <span className="selected-badge">{selectedReceiver.nickname}</span>
                  )}
                </div>
                {searchResults.length > 0 && (
                  <ul className="search-results">
                    {searchResults.map(user => (
                      <li key={user.id} onClick={() => handleSelectReceiver(user)}>
                        <strong>{user.nickname}</strong>
                        <span>{user.email}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="gift-message-field">
                <label>선물 메시지</label>
                <textarea
                  placeholder="선물과 함께 보낼 메시지를 작성하세요"
                  value={giftMessage}
                  onChange={(e) => setGiftMessage(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
        </div>

        <div className="checkout-payment">
          <h3>결제 정보</h3>
          <div className="payment-row">
            <span>상품 금액</span>
            <span>{totalPrice.toLocaleString()}원</span>
          </div>
          {discountAmount > 0 && (
            <div className="payment-row payment-discount">
              <span>쿠폰 할인</span>
              <span>-{discountAmount.toLocaleString()}원</span>
            </div>
          )}
          <div className="payment-row">
            <span>배송비</span>
            <span>무료</span>
          </div>
          <div className="payment-total">
            <span>총 결제 금액</span>
            <strong>{finalPrice.toLocaleString()}원</strong>
          </div>

          <button
            className="order-btn"
            onClick={handleOrder}
            disabled={ordering}
          >
            {ordering ? '주문 처리 중...' : `${finalPrice.toLocaleString()}원 결제하기`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CheckoutPage;
