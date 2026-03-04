/**
 * 관리자 쿠폰 관리 탭
 * - 쿠폰 생성: 할인율(%) / 정액(원) 선택, 최소주문금액, 만료일, 최대 배포수 설정
 * - 쿠폰 목록: 할인 정보, 사용/만료 상태 표시
 * - 전체 유저 배포 / 개별 삭제
 */
import { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import api from '../../api/instance';
import { useAlert } from '../../components/AlertContext';

interface AdminCoupon {
  id: number;
  code: string;
  discount_amount: number;
  discount_percentage: number | null;
  min_price: number | null;
  expiry_date: string;
  max_uses: number | null;
  current_uses: number;
  is_active: boolean;
}

function AdminCouponsTab() {
  const { showAlert, showConfirm } = useAlert();
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [couponForm, setCouponForm] = useState({
    code: '', discount_amount: '', discount_percentage: '',
    min_price: '', expiry_date: '', max_uses: ''
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const res = await api.get('/admin/coupons');
      setCoupons(res.data);
    } catch (error) {
      console.error('쿠폰 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/admin/coupons', {
        code: couponForm.code,
        discount_amount: discountType === 'fixed' ? Number(couponForm.discount_amount) || 0 : 0,
        discount_percentage: discountType === 'percentage' ? Number(couponForm.discount_percentage) || null : null,
        min_price: Number(couponForm.min_price) || null,
        expiry_date: couponForm.expiry_date,
        max_uses: Number(couponForm.max_uses) || null,
      });
      showAlert('쿠폰이 생성되었습니다.', 'success');
      setCouponForm({ code: '', discount_amount: '', discount_percentage: '', min_price: '', expiry_date: '', max_uses: '' });
      setDiscountType('percentage');
      fetchCoupons();
    } catch (error) {
      if (error instanceof AxiosError) {
        showAlert(error.response?.data?.message || '쿠폰 생성에 실패했습니다.', 'error');
      }
    }
  };

  const handleDelete = async (id: number) => {
    if (!(await showConfirm('이 쿠폰을 삭제하시겠습니까?'))) return;
    try {
      await api.delete(`/admin/coupons/${id}`);
      setCoupons(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('쿠폰 삭제 실패:', error);
    }
  };

  const handleDistribute = async (couponId: number) => {
    if (!(await showConfirm('전체 유저에게 이 쿠폰을 배포하시겠습니까?'))) return;
    try {
      const res = await api.post('/admin/coupons/distribute', { coupon_id: couponId });
      showAlert(res.data.message, 'success');
    } catch (error) {
      if (error instanceof AxiosError) {
        showAlert(error.response?.data?.message || '배포에 실패했습니다.', 'error');
      }
    }
  };

  if (loading) return <div className="loading"><div className="spinner" />불러오는 중...</div>;

  return (
    <>
      <form className="coupon-create-form" onSubmit={handleSubmit}>
        <h4>쿠폰 생성</h4>
        <div className="coupon-form-grid">
          <input
            placeholder="쿠폰 코드"
            value={couponForm.code}
            onChange={e => setCouponForm({ ...couponForm, code: e.target.value })}
            required
          />
          <select
            value={discountType}
            onChange={e => {
              setDiscountType(e.target.value as 'percentage' | 'fixed');
              setCouponForm({ ...couponForm, discount_amount: '', discount_percentage: '' });
            }}
          >
            <option value="percentage">할인율 (%)</option>
            <option value="fixed">금액 할인 (원)</option>
          </select>
          {discountType === 'percentage' ? (
            <input
              type="number"
              placeholder="할인율 (%)"
              value={couponForm.discount_percentage}
              onChange={e => setCouponForm({ ...couponForm, discount_percentage: e.target.value })}
              required
            />
          ) : (
            <input
              type="number"
              placeholder="할인 금액 (원)"
              value={couponForm.discount_amount}
              onChange={e => setCouponForm({ ...couponForm, discount_amount: e.target.value })}
              required
            />
          )}
          <input
            type="number"
            placeholder="최소 주문금액"
            value={couponForm.min_price}
            onChange={e => setCouponForm({ ...couponForm, min_price: e.target.value })}
          />
          <input
            type="datetime-local"
            value={couponForm.expiry_date}
            onChange={e => setCouponForm({ ...couponForm, expiry_date: e.target.value })}
            required
          />
          <input
            type="number"
            placeholder="최대 배포 수량"
            value={couponForm.max_uses}
            onChange={e => setCouponForm({ ...couponForm, max_uses: e.target.value })}
          />
        </div>
        <button type="submit" className="coupon-create-btn">쿠폰 생성</button>
      </form>

      {coupons.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>코드</th>
                <th>할인</th>
                <th>최소금액</th>
                <th>만료일</th>
                <th>사용</th>
                <th>상태</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map(coupon => (
                <tr key={coupon.id}>
                  <td><code>{coupon.code}</code></td>
                  <td>
                    {coupon.discount_percentage
                      ? `${coupon.discount_percentage}%`
                      : `${coupon.discount_amount.toLocaleString()}원`}
                  </td>
                  <td>{coupon.min_price ? `${coupon.min_price.toLocaleString()}원` : '-'}</td>
                  <td>{new Date(coupon.expiry_date).toLocaleDateString('ko-KR')}</td>
                  <td>{coupon.current_uses}{coupon.max_uses ? `/${coupon.max_uses}` : ''}</td>
                  <td>
                    <span className={`coupon-status ${new Date(coupon.expiry_date) < new Date() ? 'expired' : 'active'}`}>
                      {new Date(coupon.expiry_date) < new Date() ? '만료' : '활성'}
                    </span>
                  </td>
                  <td>
                    <div className="coupon-actions">
                      <button className="admin-distribute-btn" onClick={() => handleDistribute(coupon.id)}>
                        배포
                      </button>
                      <button className="admin-delete-btn" onClick={() => handleDelete(coupon.id)}>
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default AdminCouponsTab;
