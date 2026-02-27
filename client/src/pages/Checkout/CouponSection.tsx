import type { Coupon } from '../../types';

interface Props {
  coupons: Coupon[];
  selectedCoupon: Coupon | null;
  onCouponChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

function CouponSection({ coupons, selectedCoupon, onCouponChange }: Props) {
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
    <>
      {coupons.length === 0 ? (
        <p className="no-coupons">사용 가능한 쿠폰이 없습니다.</p>
      ) : (
        <select
          className="coupon-select"
          value={selectedCoupon?.user_coupon_id || 0}
          onChange={onCouponChange}
        >
          <option value={0}>쿠폰을 선택해주세요</option>
          {coupons.map(coupon => (
            <option key={coupon.user_coupon_id} value={coupon.user_coupon_id}>
              {formatCouponLabel(coupon)}
            </option>
          ))}
        </select>
      )}
    </>
  );
}

export default CouponSection;
