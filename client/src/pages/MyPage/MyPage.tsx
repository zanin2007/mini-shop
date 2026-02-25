import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import api from '../../api/instance';
import { useAlert } from '../../components/AlertContext';
import type { Order, User, UserCoupon, Gift, CartItemOption } from '../../types';
import './MyPage.css';

const statusMap: Record<string, { label: string; className: string }> = {
  pending: { label: '준비중', className: 'status-pending' },
  shipped: { label: '배송중', className: 'status-shipped' },
  delivered: { label: '배송완료', className: 'status-delivered' },
  completed: { label: '구매확정', className: 'status-completed' },
};

function MyPage() {
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlert();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [coupons, setCoupons] = useState<UserCoupon[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'orders' | 'coupons' | 'gifts'>('orders');
  const [sentGifts, setSentGifts] = useState<Gift[]>([]);
  const [receivedGifts, setReceivedGifts] = useState<Gift[]>([]);
  const [giftSubTab, setGiftSubTab] = useState<'received' | 'sent'>('received');

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
    fetchGifts();
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

  const fetchGifts = async () => {
    try {
      const [sentRes, receivedRes] = await Promise.all([
        api.get('/gifts/sent'),
        api.get('/gifts/received'),
      ]);
      setSentGifts(sentRes.data);
      setReceivedGifts(receivedRes.data);
    } catch (error) {
      console.error('선물 조회 실패:', error);
    }
  };

  const handleAcceptGift = async (giftId: number) => {
    if (!(await showConfirm('선물을 수락하시겠습니까?'))) return;
    try {
      await api.put(`/gifts/${giftId}/accept`);
      showAlert('선물을 수락했습니다.', 'success');
      fetchGifts();
    } catch (error) {
      if (error instanceof AxiosError) {
        showAlert(error.response?.data?.message || '처리에 실패했습니다.', 'error');
      }
    }
  };

  const handleRejectGift = async (giftId: number) => {
    if (!(await showConfirm('선물을 거절하시겠습니까?'))) return;
    try {
      await api.put(`/gifts/${giftId}/reject`);
      showAlert('선물을 거절했습니다.', 'success');
      fetchGifts();
    } catch (error) {
      if (error instanceof AxiosError) {
        showAlert(error.response?.data?.message || '처리에 실패했습니다.', 'error');
      }
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
    } catch (error) {
      if (error instanceof AxiosError) {
        showAlert(error.response?.data?.message || '쿠폰 등록에 실패했습니다.', 'error');
      }
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

  const getInitials = (nickname: string) => {
    return nickname.slice(0, 2);
  };

  if (loading) return <div className="loading">로딩 중...</div>;

  const availableCoupons = coupons.filter(c => !c.is_used && !isCouponExpired(c));
  const usedOrExpiredCoupons = coupons.filter(c => c.is_used || isCouponExpired(c));
  const pendingGiftsCount = receivedGifts.filter(g => g.status === 'pending').length;

  return (
    <div className="mypage">
      <div className="container">
        {/* Profile Hero */}
        <div className="mypage-hero">
          <div className="hero-content">
            <div className="hero-avatar">
              {user?.nickname ? getInitials(user.nickname) : '?'}
            </div>
            <div className="hero-info">
              <div className="hero-nickname">{user?.nickname}</div>
              <div className="hero-email">{user?.email}</div>
            </div>
            <div className="hero-stats">
              <div className="hero-stat">
                <span className="hero-stat-value">{orders.length}</span>
                <span className="hero-stat-label">주문</span>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-value">{availableCoupons.length}</span>
                <span className="hero-stat-label">쿠폰</span>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-value">{receivedGifts.length + sentGifts.length}</span>
                <span className="hero-stat-label">선물</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
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
          <button
            className={`mypage-tab ${activeTab === 'gifts' ? 'active' : ''}`}
            onClick={() => setActiveTab('gifts')}
          >
            선물 {pendingGiftsCount > 0 && <span className="tab-badge">{pendingGiftsCount}</span>}
          </button>
        </div>

        {/* Orders Tab */}
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
                            <div className="item-name">
                              {item.name}
                              {item.options && item.options.length > 0 && (
                                <span className="item-options">
                                  {item.options.map((o: CartItemOption) => `${o.option_name}: ${o.value}`).join(' / ')}
                                </span>
                              )}
                            </div>
                            <span className="item-qty">{item.quantity}개</span>
                            <span className="item-price">{(item.price * item.quantity).toLocaleString()}원</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {/* Delivery Progress */}
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

                    {/* Delivery Info */}
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

                    {/* Advance Status (Test) */}
                    {order.status !== 'completed' && (
                      <div className="order-actions">
                        <button
                          className="advance-btn"
                          onClick={async () => {
                            const nextLabel: Record<string, string> = {
                              pending: '배송중',
                              shipped: '배송완료',
                              delivered: '구매확정',
                            };
                            const label = nextLabel[order.status] || '다음 단계';
                            if (!(await showConfirm(`'${label}'(으)로 변경하시겠습니까?`))) return;
                            try {
                              const res = await api.put(`/orders/${order.id}/advance`);
                              showAlert(res.data.message, 'success');
                              setOrders(orders.map(o => o.id === order.id ? { ...o, status: res.data.status } : o));
                            } catch (error) {
                              if (error instanceof AxiosError) {
                                showAlert(error.response?.data?.message || '상태 변경에 실패했습니다.', 'error');
                              }
                            }
                          }}
                        >
                          {{
                            pending: '배송중으로 변경',
                            shipped: '배송완료로 변경',
                            delivered: '구매확정',
                          }[order.status] || '다음 단계'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Coupons Tab */}
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

        {/* Gifts Tab */}
        {activeTab === 'gifts' && (
          <section className="mypage-section">
            <div className="gift-sub-tabs">
              <button
                className={`gift-sub-tab ${giftSubTab === 'received' ? 'active' : ''}`}
                onClick={() => setGiftSubTab('received')}
              >
                받은 선물 ({receivedGifts.length})
              </button>
              <button
                className={`gift-sub-tab ${giftSubTab === 'sent' ? 'active' : ''}`}
                onClick={() => setGiftSubTab('sent')}
              >
                보낸 선물 ({sentGifts.length})
              </button>
            </div>

            {giftSubTab === 'received' && (
              receivedGifts.length === 0 ? (
                <p className="empty-message">받은 선물이 없습니다.</p>
              ) : (
                <div className="gift-list">
                  {receivedGifts.map(gift => (
                    <div key={gift.id} className={`gift-card gift-status-${gift.status}`}>
                      <div className="gift-card-header">
                        <span className="gift-sender">{gift.sender_nickname || '알 수 없음'}님의 선물</span>
                        <span className={`gift-status-badge ${gift.status}`}>
                          {gift.status === 'pending' ? '대기중' : gift.status === 'accepted' ? '수락됨' : '거절됨'}
                        </span>
                        <span className="gift-date">{new Date(gift.created_at).toLocaleDateString('ko-KR')}</span>
                      </div>
                      {gift.message && <p className="gift-message">"{gift.message}"</p>}
                      {gift.order_items && gift.order_items.length > 0 && (
                        <ul className="gift-items">
                          {gift.order_items.map((item, i) => (
                            <li key={i}>
                              {item.name} x {item.quantity}개
                            </li>
                          ))}
                        </ul>
                      )}
                      {gift.status === 'pending' && (
                        <div className="gift-actions">
                          <button className="gift-accept-btn" onClick={() => handleAcceptGift(gift.id)}>수락</button>
                          <button className="gift-reject-btn" onClick={() => handleRejectGift(gift.id)}>거절</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {giftSubTab === 'sent' && (
              sentGifts.length === 0 ? (
                <p className="empty-message">보낸 선물이 없습니다.</p>
              ) : (
                <div className="gift-list">
                  {sentGifts.map(gift => (
                    <div key={gift.id} className={`gift-card gift-status-${gift.status}`}>
                      <div className="gift-card-header">
                        <span className="gift-sender">{gift.receiver_nickname || '알 수 없음'}님에게</span>
                        <span className={`gift-status-badge ${gift.status}`}>
                          {gift.status === 'pending' ? '대기중' : gift.status === 'accepted' ? '수락됨' : '거절됨'}
                        </span>
                        <span className="gift-date">{new Date(gift.created_at).toLocaleDateString('ko-KR')}</span>
                      </div>
                      {gift.message && <p className="gift-message">"{gift.message}"</p>}
                      {gift.order_items && gift.order_items.length > 0 && (
                        <ul className="gift-items">
                          {gift.order_items.map((item, i) => (
                            <li key={i}>
                              {item.name} x {item.quantity}개
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="gift-total">
                        {(gift.final_amount || gift.total_amount || 0).toLocaleString()}원
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default MyPage;
