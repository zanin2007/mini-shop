import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/instance';
import { useAlert } from '../../components/AlertContext';
import type { Order, User, UserCoupon } from '../../types';
import './MyPage.css';

const statusMap: Record<string, { label: string; className: string }> = {
  pending: { label: '준비중', className: 'status-pending' },
  shipped: { label: '배송중', className: 'status-shipped' },
  delivered: { label: '배송완료', className: 'status-delivered' },
  completed: { label: '구매확정', className: 'status-completed' },
};

function MyPage() {
  const navigate = useNavigate();
  const { showAlert } = useAlert();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [coupons, setCoupons] = useState<UserCoupon[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'orders' | 'coupons'>('orders');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    const userData = localStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
    fetchOrders();
    fetchCoupons();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await api.get('/orders');
      setOrders(response.data);
    } catch (error) {
      console.error('주문 내역 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCoupons = async () => {
    try {
      const response = await api.get('/coupons');
      setCoupons(response.data);
    } catch (error) {
      console.error('쿠폰 조회 실패:', error);
    }
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
      fetchCoupons();
    } catch (error: any) {
      showAlert(error.response?.data?.message || '쿠폰 등록에 실패했습니다.', 'error');
    }
  };

  const formatCouponDiscount = (coupon: UserCoupon) => {
    if (coupon.discount_percentage) {
      return `${coupon.discount_percentage}% 할인`;
    }
    return `${coupon.discount_amount.toLocaleString()}원 할인`;
  };

  const isCouponExpired = (coupon: UserCoupon) => {
    return new Date(coupon.expiry_date) < new Date();
  };

  if (loading) return <div className="loading">로딩 중...</div>;

  const availableCoupons = coupons.filter(c => !c.is_used && !isCouponExpired(c));
  const usedOrExpiredCoupons = coupons.filter(c => c.is_used || isCouponExpired(c));

  return (
    <div className="mypage">
      <div className="container">
        <h2 className="mypage-title">마이페이지</h2>

        {/* 사용자 정보 */}
        <section className="mypage-section">
          <h3>내 정보</h3>
          <div className="user-info-card">
            <p><span>닉네임</span>{user?.nickname}</p>
            <p><span>이메일</span>{user?.email}</p>
          </div>
        </section>

        {/* 탭 네비게이션 */}
        <div className="mypage-tabs">
          <button
            className={`mypage-tab ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            주문 내역
          </button>
          <button
            className={`mypage-tab ${activeTab === 'coupons' ? 'active' : ''}`}
            onClick={() => setActiveTab('coupons')}
          >
            쿠폰 {availableCoupons.length > 0 && <span className="tab-badge">{availableCoupons.length}</span>}
          </button>
        </div>

        {/* 주문 내역 */}
        {activeTab === 'orders' && (
          <section className="mypage-section">
            {orders.length === 0 ? (
              <p className="empty-message">주문 내역이 없습니다.</p>
            ) : (
              <div className="order-list">
                {orders.map((order) => (
                  <div key={order.id} className="order-card">
                    <div className="order-header">
                      <span className="order-id">주문 #{order.id}</span>
                      <span className={`order-status ${statusMap[order.status]?.className || ''}`}>
                        {statusMap[order.status]?.label || order.status}
                      </span>
                      <span className="order-date">
                        {new Date(order.created_at).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    {order.items && order.items.length > 0 && (
                      <ul className="order-items">
                        {order.items.map((item) => (
                          <li key={item.id} className="order-item">
                            <img src={item.image_url} alt={item.name} />
                            <span className="item-name">{item.name}</span>
                            <span className="item-qty">{item.quantity}개</span>
                            <span className="item-price">{(item.price * item.quantity).toLocaleString()}원</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {/* 배송 상태 진행 바 */}
                    <div className="delivery-progress">
                      {['pending', 'shipped', 'delivered', 'completed'].map((step, idx) => {
                        const steps = ['pending', 'shipped', 'delivered', 'completed'];
                        const currentIdx = steps.indexOf(order.status);
                        const isActive = idx <= currentIdx;
                        return (
                          <div key={step} className={`progress-step ${isActive ? 'active' : ''}`}>
                            <div className="progress-dot" />
                            <span>{statusMap[step]?.label}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* 배송 정보 */}
                    {order.receiver_name && (
                      <div className="delivery-info">
                        <span>{order.receiver_name}</span>
                        <span>{order.receiver_phone}</span>
                        <span>{order.delivery_address}</span>
                      </div>
                    )}

                    <div className="order-total">
                      {order.discount_amount > 0 && (
                        <span className="order-discount">
                          쿠폰 할인: -{order.discount_amount.toLocaleString()}원
                        </span>
                      )}
                      총 결제금액: <strong>{(order.final_amount || order.total_amount).toLocaleString()}원</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 쿠폰 */}
        {activeTab === 'coupons' && (
          <section className="mypage-section">
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

            {coupons.length === 0 && (
              <p className="empty-message">보유한 쿠폰이 없습니다.</p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default MyPage;
