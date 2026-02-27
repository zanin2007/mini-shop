import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import api from '../../api/instance';
import { useAlert } from '../../components/AlertContext';
import type { Coupon } from '../../types';
import DeliveryForm from './DeliveryForm';
import CouponSection from './CouponSection';
import GiftSection from './GiftSection';
import './CheckoutPage.css';

declare global {
  interface Window {
    daum: {
      Postcode: new (options: { oncomplete: (data: { zonecode: string; roadAddress: string; jibunAddress: string }) => void }) => { open: () => void };
    };
  }
}

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
  const [delivery, setDelivery] = useState({ receiver_name: '', receiver_phone: '', delivery_address: '', delivery_address_detail: '' });
  const navigate = useNavigate();

  const [isGift, setIsGift] = useState(false);
  const [giftMessage, setGiftMessage] = useState('');
  const [selectedReceiver, setSelectedReceiver] = useState<SearchedUser | null>(null);

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
    if (!delivery.receiver_name.trim() || !delivery.receiver_phone.trim() || !delivery.delivery_address.trim() || !delivery.delivery_address_detail.trim()) {
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
      const fullAddress = `${delivery.delivery_address} ${delivery.delivery_address_detail}`.trim();
      await api.post('/orders', {
        couponId: selectedCoupon?.user_coupon_id || null,
        receiver_name: delivery.receiver_name,
        receiver_phone: delivery.receiver_phone,
        delivery_address: fullAddress,
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
    return <div className="loading"><div className="spinner" />로딩 중...</div>;
  }

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

        <div className="checkout-section">
          <h3>배송 정보</h3>
          <DeliveryForm delivery={delivery} setDelivery={setDelivery} />
        </div>

        <div className="checkout-section">
          <h3>쿠폰 적용</h3>
          <CouponSection coupons={coupons} selectedCoupon={selectedCoupon} onCouponChange={handleCouponChange} />
        </div>

        <div className="checkout-section">
          <GiftSection
            isGift={isGift}
            setIsGift={setIsGift}
            giftMessage={giftMessage}
            setGiftMessage={setGiftMessage}
            selectedReceiver={selectedReceiver}
            setSelectedReceiver={setSelectedReceiver}
          />
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
