import { useState } from 'react';
import { AxiosError } from 'axios';
import api from '../../api/instance';
import { useAlert } from '../../components/AlertContext';
import type { UserCoupon } from '../../types';

interface Props {
  availableCoupons: UserCoupon[];
  usedOrExpiredCoupons: UserCoupon[];
  couponsTotal: number;
  onCouponClaimed: () => void;
}

function CouponsTab({ availableCoupons, usedOrExpiredCoupons, couponsTotal, onCouponClaimed }: Props) {
  const { showAlert } = useAlert();
  const [couponCode, setCouponCode] = useState('');

  const formatCouponDiscount = (coupon: UserCoupon) => {
    if (coupon.discount_percentage) {
      return `${coupon.discount_percentage}% 할인`;
    }
    return `${coupon.discount_amount.toLocaleString()}원 할인`;
  };

  const handleClaimCoupon = async () => {
    if (!couponCode.trim()) {
      showAlert('쿠폰 코드를 입력해주세요.', 'warning');
      return;
    }
    try {
      const response = await api.post('/coupons/claim', { code: couponCode.trim() });
      showAlert(response.data.message, 'success');
      setCouponCode('');
      onCouponClaimed();
    } catch (error) {
      if (error instanceof AxiosError) {
        showAlert(error.response?.data?.message || '쿠폰 등록에 실패했습니다.', 'error');
      }
    }
  };

  return (
    <>
      <div className="coupon-claim">
        <input
          type="text"
          placeholder="쿠폰 코드를 입력하세요"
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleClaimCoupon()}
        />
        <button onClick={handleClaimCoupon}>등록</button>
      </div>

      {availableCoupons.length > 0 && (
        <>
          <h4 className="coupon-subtitle">사용 가능 ({availableCoupons.length})</h4>
          <div className="coupon-list">
            {availableCoupons.map(coupon => (
              <div key={coupon.id} className="coupon-card">
                <div className="coupon-discount-label">{formatCouponDiscount(coupon)}</div>
                <div className="coupon-code-label">{coupon.code}</div>
                {coupon.min_price && (
                  <div className="coupon-condition">{coupon.min_price.toLocaleString()}원 이상 구매 시</div>
                )}
                <div className="coupon-expiry">
                  {new Date(coupon.expiry_date).toLocaleDateString('ko-KR')} 까지
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {usedOrExpiredCoupons.length > 0 && (
        <>
          <h4 className="coupon-subtitle used">사용완료/만료 ({usedOrExpiredCoupons.length})</h4>
          <div className="coupon-list">
            {usedOrExpiredCoupons.map(coupon => (
              <div key={coupon.id} className="coupon-card used">
                <div className="coupon-discount-label">{formatCouponDiscount(coupon)}</div>
                <div className="coupon-code-label">{coupon.code}</div>
                <div className="coupon-expiry">
                  {coupon.is_used ? '사용완료' : '만료됨'}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {couponsTotal === 0 && (
        <p className="empty-message">보유한 쿠폰이 없습니다.</p>
      )}
    </>
  );
}

export default CouponsTab;
