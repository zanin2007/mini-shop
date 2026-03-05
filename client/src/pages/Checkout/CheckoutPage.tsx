/**
 * 체크아웃 페이지
 * - 장바구니 선택 상품 확인 → 배송 정보 입력 → 쿠폰/포인트 적용 → 선물 옵션 → 결제
 * - 결제 금액: 상품금액 - 쿠폰할인 - 포인트사용 = 최종 결제금액
 * - 주문 완료 시 localStorage 포인트 동기화
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import api from '../../api/instance';
import { useAlert } from '../../components/useAlert';
import LoadingSpinner from '../../components/LoadingSpinner';
import type { Coupon, CartPageItem, SearchedUser } from '../../types';
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

function CheckoutPage() {
  const [cartItems, setCartPageItems] = useState<CartPageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const { showAlert, showConfirm } = useAlert();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [delivery, setDelivery] = useState({ receiver_name: '', receiver_phone: '', delivery_address: '', delivery_address_detail: '' });
  const navigate = useNavigate();

  const [userPoints, setUserPoints] = useState(0);
  const [pointsToUse, setPointsToUse] = useState(0);
  const [isGift, setIsGift] = useState(false);
  const [giftMessage, setGiftMessage] = useState('');
  const [selectedReceiver, setSelectedReceiver] = useState<SearchedUser | null>(null);

  const fetchCart = useCallback(async () => {
    try {
      const response = await api.get('/cart');
      const selectedItems = response.data.filter((item: CartPageItem) => item.is_selected);
      if (selectedItems.length === 0) {
        showAlert('선택된 상품이 없습니다.', 'warning');
        navigate('/cart');
        return;
      }
      setCartPageItems(selectedItems);
    } catch (error) {
      console.error('장바구니 조회 실패:', error);
      showAlert('장바구니를 불러오지 못했습니다.', 'error');
      navigate('/cart');
    } finally {
      setLoading(false);
    }
  }, [navigate, showAlert]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      showConfirm('로그인 권한이 필요합니다. 로그인하시겠습니까?').then(ok => {
        if (ok) navigate('/login');
        else navigate(-1);
      });
      return;
    }
    fetchCart();
    // 서버에서 포인트 로드
    api.get('/auth/check').then(res => {
      setUserPoints(res.data.user.points || 0);
    }).catch(() => { /* ignore */ });
  }, [navigate, showConfirm, fetchCart]);

  const getItemTotal = (item: CartPageItem) => {
    const extra = item.options?.reduce((s, o) => s + o.extra_price, 0) || 0;
    return (item.price + extra) * item.quantity;
  };
  const totalPrice = cartItems.reduce((sum, item) => sum + getItemTotal(item), 0);
  const discountAmount = selectedCoupon?.calculated_discount || 0;
  const afterCoupon = totalPrice - discountAmount;
  const maxPoints = Math.min(userPoints, afterCoupon);
  const pointDiscount = Math.min(pointsToUse, maxPoints);
  const finalPrice = afterCoupon - pointDiscount;

  const fetchCoupons = useCallback(async () => {
    try {
      const response = await api.get(`/coupons/available?totalAmount=${totalPrice}`);
      setCoupons(response.data);
    } catch (error) {
      console.error('쿠폰 조회 실패:', error);
    }
  }, [totalPrice]);

  useEffect(() => {
    if (totalPrice > 0) {
      fetchCoupons();
    }
  }, [totalPrice, fetchCoupons]);

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
        pointsToUse: pointDiscount || 0,
        receiver_name: delivery.receiver_name,
        receiver_phone: delivery.receiver_phone,
        delivery_address: fullAddress,
        isGift,
        receiverId: isGift ? selectedReceiver?.id : undefined,
        giftMessage: isGift ? giftMessage : undefined,
      });
      // 서버에서 최신 유저 정보를 받아와 localStorage 동기화
      try {
        const authRes = await api.get('/auth/check');
        localStorage.setItem('user', JSON.stringify(authRes.data.user));
        window.dispatchEvent(new Event('userUpdated'));
      } catch { /* ignore */ }
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
    return <LoadingSpinner />;
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

        {userPoints > 0 && (
          <div className="checkout-section">
            <h3>포인트 사용</h3>
            <div className="point-section">
              <span className="point-balance">보유 {userPoints.toLocaleString()}P</span>
              <div className="point-input-row">
                <input
                  type="number"
                  className="point-input"
                  value={pointsToUse || ''}
                  min={0}
                  max={maxPoints}
                  placeholder="0"
                  onChange={e => {
                    const val = Math.max(0, Math.min(Number(e.target.value) || 0, maxPoints));
                    setPointsToUse(val);
                  }}
                />
                <span className="point-unit">P</span>
                <button
                  type="button"
                  className="point-all-btn"
                  onClick={() => setPointsToUse(maxPoints)}
                >
                  전액 사용
                </button>
              </div>
            </div>
          </div>
        )}

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
          {pointDiscount > 0 && (
            <div className="payment-row payment-discount">
              <span>포인트 사용</span>
              <span>-{pointDiscount.toLocaleString()}원</span>
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
