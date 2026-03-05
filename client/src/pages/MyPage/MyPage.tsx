/**
 * 마이페이지
 * - 프로필 (주문/구매/쿠폰/포인트 통계), 탭 네비게이션
 * - 주문 내역: 진행중 주문 (checking~delivered)
 * - 구매 내역: 완료/환불 주문 (completed, refund_requested, refunded) + 환불 신청
 * - 쿠폰: 사용 가능/만료 쿠폰, 쿠폰 코드 등록
 * - 선물: 보낸/받은 선물 관리
 * - 계정 설정: 닉네임/비밀번호 변경, 회원탈퇴
 * - fetchUser로 최신 유저 정보 동기화 (role, points 등)
 */
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlert } from '../../components/useAlert';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../api/instance';
import type { Order, User, UserCoupon, Gift, Refund } from '../../types';
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
  refund_requested: { label: '환불신청', className: 'status-refund-requested' },
  refunded: { label: '환불완료', className: 'status-refunded' },
};

function MyPage() {
  const navigate = useNavigate();
  const { showConfirm } = useAlert();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [coupons, setCoupons] = useState<UserCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  type MyTab = 'orders' | 'purchases' | 'coupons' | 'gifts' | 'settings';
  const [activeTab, setActiveTab] = useState<MyTab>('orders');
  const [mountedTabs, setMountedTabs] = useState<Set<MyTab>>(new Set(['orders']));
  const [sentGifts, setSentGifts] = useState<Gift[]>([]);
  const [receivedGifts, setReceivedGifts] = useState<Gift[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);

  const fetchUser = useCallback(async () => {
    try {
      const response = await api.get('/auth/check');
      const freshUser = response.data.user;
      setUser(freshUser);
      localStorage.setItem('user', JSON.stringify(freshUser));
    } catch (error) {
      console.error('유저 정보 조회 실패:', error);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const response = await api.get('/orders');
      setOrders(response.data);
    } catch (error) {
      console.error('주문 내역 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const fetchRefunds = useCallback(async () => {
    try {
      const response = await api.get('/refunds');
      setRefunds(response.data);
    } catch (error) {
      console.error('환불 조회 실패:', error);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      showConfirm('로그인 권한이 필요합니다. 로그인하시겠습니까?').then(ok => {
        if (ok) navigate('/login');
        else navigate(-1);
      });
      return;
    }
    const userData = localStorage.getItem('user');
    if (userData) {
      try { setUser(JSON.parse(userData)); } catch { /* ignore corrupt data */ }
    }
    fetchUser();
    Promise.all([fetchOrders(), fetchCoupons(), fetchGifts(), fetchRefunds()]);
  }, [navigate, showConfirm, fetchUser, fetchOrders, fetchCoupons, fetchGifts, fetchRefunds]);

  const handleUserUpdate = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
    window.dispatchEvent(new Event('userUpdated'));
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
  const activeOrders = useMemo(() => orders.filter(o => !['completed', 'refund_requested', 'refunded'].includes(o.status)), [orders]);
  const completedOrders = useMemo(() => orders.filter(o => ['completed', 'refund_requested', 'refunded'].includes(o.status)), [orders]);

  if (loading) return <LoadingSpinner />;

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
              <div className="hero-stat">
                <span className="hero-stat-value">{(user?.points || 0).toLocaleString()}</span>
                <span className="hero-stat-label">포인트</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mypage-tabs">
          <button
            className={`mypage-tab ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => { setActiveTab('orders'); setMountedTabs(prev => new Set(prev).add('orders')); }}
          >
            주문 내역 {activeOrders.length > 0 && <span className="tab-badge">{activeOrders.length}</span>}
          </button>
          <button
            className={`mypage-tab ${activeTab === 'purchases' ? 'active' : ''}`}
            onClick={() => { setActiveTab('purchases'); setMountedTabs(prev => new Set(prev).add('purchases')); }}
          >
            구매 내역
          </button>
          <button
            className={`mypage-tab ${activeTab === 'coupons' ? 'active' : ''}`}
            onClick={() => { setActiveTab('coupons'); setMountedTabs(prev => new Set(prev).add('coupons')); }}
          >
            쿠폰 {availableCoupons.length > 0 && <span className="tab-badge">{availableCoupons.length}</span>}
          </button>
          <button
            className={`mypage-tab ${activeTab === 'gifts' ? 'active' : ''}`}
            onClick={() => { setActiveTab('gifts'); setMountedTabs(prev => new Set(prev).add('gifts')); }}
          >
            선물 {pendingGiftsCount > 0 && <span className="tab-badge">{pendingGiftsCount}</span>}
          </button>
          <button
            className={`mypage-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => { setActiveTab('settings'); setMountedTabs(prev => new Set(prev).add('settings')); }}
          >
            계정 설정
          </button>
        </div>

        {/* Tab Contents — display:none으로 숨겨 리마운트 방지 */}
        <section className="mypage-section" style={{ display: activeTab === 'orders' ? 'block' : 'none' }}>
          {mountedTabs.has('orders') && (
            <OrdersTab
              orders={activeOrders}
              allOrders={orders}
              statusMap={statusMap}
              setOrders={setOrders}
            />
          )}
        </section>

        <section className="mypage-section" style={{ display: activeTab === 'purchases' ? 'block' : 'none' }}>
          {mountedTabs.has('purchases') && (
            <PurchasesTab orders={completedOrders} statusMap={statusMap} refunds={refunds} />
          )}
        </section>

        <section className="mypage-section" style={{ display: activeTab === 'coupons' ? 'block' : 'none' }}>
          {mountedTabs.has('coupons') && (
            <CouponsTab
              availableCoupons={availableCoupons}
              usedOrExpiredCoupons={usedOrExpiredCoupons}
              couponsTotal={coupons.length}
              onCouponClaimed={fetchCoupons}
            />
          )}
        </section>

        <section className="mypage-section" style={{ display: activeTab === 'settings' ? 'block' : 'none' }}>
          {mountedTabs.has('settings') && (
            <SettingsTab
              user={user}
              onUserUpdate={handleUserUpdate}
            />
          )}
        </section>

        <section className="mypage-section" style={{ display: activeTab === 'gifts' ? 'block' : 'none' }}>
          {mountedTabs.has('gifts') && (
            <GiftsTab
              sentGifts={sentGifts}
              receivedGifts={receivedGifts}
              onGiftAction={fetchGifts}
            />
          )}
        </section>
      </div>
    </div>
  );
}

export default MyPage;
