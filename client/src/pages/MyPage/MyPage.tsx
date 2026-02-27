import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/instance';
import type { Order, User, UserCoupon, Gift } from '../../types';
import OrdersTab from './OrdersTab';
import PurchasesTab from './PurchasesTab';
import CouponsTab from './CouponsTab';
import GiftsTab from './GiftsTab';
import SettingsTab from './SettingsTab';
import './MyPage.css';

const statusMap: Record<string, { label: string; className: string }> = {
  checking: { label: '상품확인중', className: 'status-checking' },
  pending: { label: '준비중', className: 'status-pending' },
  shipped: { label: '배송중', className: 'status-shipped' },
  delivered: { label: '배송완료', className: 'status-delivered' },
  completed: { label: '수령완료', className: 'status-completed' },
};

function MyPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [coupons, setCoupons] = useState<UserCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'orders' | 'purchases' | 'coupons' | 'gifts' | 'settings'>('orders');
  const [sentGifts, setSentGifts] = useState<Gift[]>([]);
  const [receivedGifts, setReceivedGifts] = useState<Gift[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    const userData = localStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
    Promise.all([fetchOrders(), fetchCoupons(), fetchGifts()]);
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

  const fetchCoupons = useCallback(async () => {
    try {
      const response = await api.get('/coupons');
      setCoupons(response.data);
    } catch (error) {
      console.error('쿠폰 조회 실패:', error);
    }
  }, []);

  const fetchGifts = useCallback(async () => {
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
  }, []);

  const handleUserUpdate = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  }, []);

  const isCouponExpired = (coupon: UserCoupon) => {
    return new Date(coupon.expiry_date) < new Date();
  };

  const getInitials = (nickname: string) => {
    return nickname.slice(0, 2);
  };

  const availableCoupons = useMemo(() => coupons.filter(c => !c.is_used && !isCouponExpired(c)), [coupons]);
  const usedOrExpiredCoupons = useMemo(() => coupons.filter(c => c.is_used || isCouponExpired(c)), [coupons]);
  const pendingGiftsCount = useMemo(() => receivedGifts.filter(g => g.status === 'pending').length, [receivedGifts]);
  const activeOrders = useMemo(() => orders.filter(o => o.status !== 'completed'), [orders]);
  const completedOrders = useMemo(() => orders.filter(o => o.status === 'completed'), [orders]);

  if (loading) return <div className="loading"><div className="spinner" />로딩 중...</div>;

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
                <span className="hero-stat-value">{activeOrders.length}</span>
                <span className="hero-stat-label">주문</span>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-value">{completedOrders.length}</span>
                <span className="hero-stat-label">구매</span>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-value">{availableCoupons.length}</span>
                <span className="hero-stat-label">쿠폰</span>
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
            주문 내역 {activeOrders.length > 0 && <span className="tab-badge">{activeOrders.length}</span>}
          </button>
          <button
            className={`mypage-tab ${activeTab === 'purchases' ? 'active' : ''}`}
            onClick={() => setActiveTab('purchases')}
          >
            구매 내역
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
          <button
            className={`mypage-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            계정 설정
          </button>
        </div>

        {/* Tab Contents */}
        {activeTab === 'orders' && (
          <section className="mypage-section">
            <OrdersTab
              orders={activeOrders}
              allOrders={orders}
              statusMap={statusMap}
              setOrders={setOrders}
            />
          </section>
        )}

        {activeTab === 'purchases' && (
          <section className="mypage-section">
            <PurchasesTab orders={completedOrders} statusMap={statusMap} />
          </section>
        )}

        {activeTab === 'coupons' && (
          <section className="mypage-section">
            <CouponsTab
              availableCoupons={availableCoupons}
              usedOrExpiredCoupons={usedOrExpiredCoupons}
              couponsTotal={coupons.length}
              onCouponClaimed={fetchCoupons}
            />
          </section>
        )}

        {activeTab === 'settings' && (
          <section className="mypage-section">
            <SettingsTab
              user={user}
              onUserUpdate={handleUserUpdate}
            />
          </section>
        )}

        {activeTab === 'gifts' && (
          <section className="mypage-section">
            <GiftsTab
              sentGifts={sentGifts}
              receivedGifts={receivedGifts}
              onGiftAction={fetchGifts}
            />
          </section>
        )}
      </div>
    </div>
  );
}

export default MyPage;
