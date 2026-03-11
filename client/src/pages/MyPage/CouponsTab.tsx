/**
 * 쿠폰 탭
 * - 자체 데이터 fetch + 로딩 관리
 * - 사용 가능/사용완료+만료 쿠폰 구분 표시
 * - 쿠폰 코드 입력으로 쿠폰 등록
 * - 할인 정보 (할인율 or 정액), 최소 주문금액, 만료일 표시
 */
import { useEffect, useState, useMemo, useCallback } from 'react';
import { AxiosError } from 'axios';
import api from '../../api/instance';
import { useAlert } from '../../components/useAlert';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import type { UserCoupon } from '../../types';

interface Props {
  onCountReady: (availableCount: number) => void;
}

const toUtcStr = (dateStr: string) =>
  dateStr.endsWith('Z') ? dateStr : dateStr.replace(' ', 'T') + 'Z';

const isCouponExpired = (coupon: UserCoupon) => {
  if (!coupon.expiry_date) return true;
  return new Date(toUtcStr(coupon.expiry_date)) < new Date();
};

function CouponsTab({ onCountReady }: Props) {
  const { showAlert } = useAlert();
  const [coupons, setCoupons] = useState<UserCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [couponCode, setCouponCode] = useState('');
  const [claiming, setClaiming] = useState(false);

  const fetchCoupons = useCallback(async () => {
    try {
      const response = await api.get('/coupons');
      setCoupons(response.data);
    } catch (error) {
      console.error('쿠폰 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCoupons();
  }, [fetchCoupons]);

  const availableCoupons = useMemo(() => coupons.filter(c => !c.is_used && !isCouponExpired(c)), [coupons]);
  const usedOrExpiredCoupons = useMemo(() => coupons.filter(c => c.is_used || isCouponExpired(c)), [coupons]);

  useEffect(() => {
    if (!loading) {
      onCountReady(availableCoupons.length);
    }
  }, [availableCoupons.length, loading, onCountReady]);

  const formatCouponDiscount = (coupon: UserCoupon) => {
    if (coupon.discount_percentage) {
      return `${coupon.discount_percentage}% 할인`;
    }
    return `${coupon.discount_amount.toLocaleString()}원 할인`;
  };

  const handleClaimCoupon = async () => {
    if (claiming) return;
    if (!couponCode.trim()) {
      showAlert('쿠폰 코드를 입력해주세요.', 'warning');
      return;
    }
    setClaiming(true);
    try {
      const response = await api.post('/coupons/claim', { code: couponCode.trim() });
      showAlert(response.data.message, 'success');
      setCouponCode('');
      fetchCoupons();
    } catch (error) {
      if (error instanceof AxiosError) {
        showAlert(error.response?.data?.message || '쿠폰 등록에 실패했습니다.', 'error');
      }
    } finally {
      setClaiming(false);
    }
  };

  if (loading) return <LoadingSpinner />;

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
        <Button onClick={handleClaimCoupon} disabled={claiming}>
          {claiming && <Spinner className="size-4" />}
          {claiming ? '등록 중' : '등록'}
        </Button>
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

      {coupons.length === 0 && (
        <p className="empty-message">보유한 쿠폰이 없습니다.</p>
      )}
    </>
  );
}

export default CouponsTab;
