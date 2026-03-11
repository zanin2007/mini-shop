/**
 * 마이페이지
 * - 프로필 (주문/구매/쿠폰/포인트 통계), 탭 네비게이션
 * - 진입 시 /orders/summary로 탭 카운트 미리 로드 (탭 마운트 전에도 뱃지 표시)
 * - 각 탭이 자체 데이터를 fetch하고 로딩 관리, onCountReady로 카운트 갱신
 * - fetchUser로 최신 유저 정보 동기화 (role, points 등)
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlert } from '../../components/useAlert';
import { useTabIndicator } from '../../hooks/useTabIndicator';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../api/instance';
import type { User } from '../../types';
import OrdersTab from './OrdersTab';
import PurchasesTab from './PurchasesTab';
import CouponsTab from './CouponsTab';
import GiftsTab from './GiftsTab';
import SettingsTab from './SettingsTab';
import './MyPage.css';

type MyTab = 'orders' | 'purchases' | 'coupons' | 'gifts' | 'settings';
const TABS: MyTab[] = ['orders', 'purchases', 'coupons', 'gifts', 'settings'];
const tabLabels: Record<MyTab, string> = {
  orders: '주문 내역',
  purchases: '구매 내역',
  coupons: '쿠폰',
  gifts: '선물',
  settings: '계정 설정',
};

function MyPage() {
  const navigate = useNavigate();
  const { showConfirm } = useAlert();

  // localStorage 캐시로 즉시 렌더 — 캐시 없으면 스피너
  const [user, setUser] = useState<User | null>(() => {
    try {
      const cached = localStorage.getItem('user');
      return cached ? JSON.parse(cached) as User : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(() => !user || !localStorage.getItem('token'));
  const [activeTab, setActiveTab] = useState<MyTab>('orders');
  const [mountedTabs, setMountedTabs] = useState<Set<MyTab>>(new Set(['orders']));

  // 탭에서 전달받는 카운트
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
  const [completedOrdersCount, setCompletedOrdersCount] = useState(0);
  const [availableCouponsCount, setAvailableCouponsCount] = useState(0);
  const [pendingGiftsCount, setPendingGiftsCount] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      showConfirm('로그인 권한이 필요합니다. 로그인하시겠습니까?').then(ok => {
        if (ok) navigate('/login');
        else navigate(-1);
      });
      return;
    }
    // 유저 정보 + 탭 카운트 백그라운드 갱신
    Promise.all([
      api.get('/auth/check'),
      api.get('/orders/summary'),
    ]).then(([authRes, summaryRes]) => {
      const freshUser = authRes.data.user;
      setUser(freshUser);
      localStorage.setItem('user', JSON.stringify(freshUser));
      const s = summaryRes.data;
      setActiveOrdersCount(s.activeOrders);
      setCompletedOrdersCount(s.completedOrders);
      setAvailableCouponsCount(s.availableCoupons);
      setPendingGiftsCount(s.pendingGifts);
    }).catch(error => {
      console.error('마이페이지 초기 로드 실패:', error);
    }).finally(() => {
      setLoading(false);
    });
  }, [navigate, showConfirm]);

  const handleUserUpdate = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
    window.dispatchEvent(new Event('userUpdated'));
  }, []);

  const getInitials = (nickname: string) => {
    return nickname.slice(0, 2);
  };

  const handleOrderCountReady = useCallback((active: number, completed: number) => {
    setActiveOrdersCount(active);
    setCompletedOrdersCount(completed);
  }, []);

  const handleCouponCountReady = useCallback((available: number) => {
    setAvailableCouponsCount(available);
  }, []);

  const handleGiftCountReady = useCallback((pending: number) => {
    setPendingGiftsCount(pending);
  }, []);

  const handleTabClick = useCallback((tab: MyTab) => {
    setActiveTab(tab);
    setMountedTabs(prev => new Set(prev).add(tab));
  }, []);

  const { tabsRef, setTabRef, indicator, handleKeyDown } = useTabIndicator(TABS, activeTab, handleTabClick);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="mypage">
      <div className="container">
        {/* Profile Hero */}
        <div className="mypage-hero">
          <div className="hero-orb hero-orb--1" />
          <div className="hero-orb hero-orb--2" />
          <div className="hero-orb hero-orb--3" />
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
                <span className="hero-stat-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10H3M16 2v4M8 2v4M3 6h18a0 0 0 0 1 0 0v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a0 0 0 0 1 0 0Z"/></svg>
                </span>
                <span className="hero-stat-value">{activeOrdersCount}</span>
                <span className="hero-stat-label">주문</span>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4ZM3 6h18M16 10a4 4 0 0 1-8 0"/></svg>
                </span>
                <span className="hero-stat-value">{completedOrdersCount}</span>
                <span className="hero-stat-label">구매</span>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><circle cx="8" cy="15" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="15" r="1" fill="currentColor" stroke="none"/></svg>
                </span>
                <span className="hero-stat-value">{availableCouponsCount}</span>
                <span className="hero-stat-label">쿠폰</span>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
                </span>
                <span className="hero-stat-value">{(user?.points || 0).toLocaleString()}</span>
                <span className="hero-stat-label">포인트</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mypage-tabs" ref={tabsRef} role="tablist" aria-label="마이페이지 메뉴">
          {TABS.map(tab => (
            <button
              key={tab}
              ref={setTabRef(tab)}
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`mp-panel-${tab}`}
              id={`mp-tab-${tab}`}
              tabIndex={activeTab === tab ? 0 : -1}
              className={`mypage-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => handleTabClick(tab)}
              onKeyDown={handleKeyDown}
            >
              {tabLabels[tab]}
              {tab === 'orders' && activeOrdersCount > 0 && <span className="tab-badge">{activeOrdersCount}</span>}
              {tab === 'coupons' && availableCouponsCount > 0 && <span className="tab-badge">{availableCouponsCount}</span>}
              {tab === 'gifts' && pendingGiftsCount > 0 && <span className="tab-badge">{pendingGiftsCount}</span>}
            </button>
          ))}
          <span
            className="mypage-tab-indicator"
            style={{ left: indicator.left, width: indicator.width }}
          />
        </div>

        {/* Tab Contents */}
        <div
          role="tabpanel"
          id="mp-panel-orders"
          aria-labelledby="mp-tab-orders"
          className="mypage-section"
          hidden={activeTab !== 'orders'}
        >
          {mountedTabs.has('orders') && (
            <OrdersTab onCountReady={handleOrderCountReady} />
          )}
        </div>

        <div
          role="tabpanel"
          id="mp-panel-purchases"
          aria-labelledby="mp-tab-purchases"
          className="mypage-section"
          hidden={activeTab !== 'purchases'}
        >
          {mountedTabs.has('purchases') && <PurchasesTab />}
        </div>

        <div
          role="tabpanel"
          id="mp-panel-coupons"
          aria-labelledby="mp-tab-coupons"
          className="mypage-section"
          hidden={activeTab !== 'coupons'}
        >
          {mountedTabs.has('coupons') && (
            <CouponsTab onCountReady={handleCouponCountReady} />
          )}
        </div>

        <div
          role="tabpanel"
          id="mp-panel-gifts"
          aria-labelledby="mp-tab-gifts"
          className="mypage-section"
          hidden={activeTab !== 'gifts'}
        >
          {mountedTabs.has('gifts') && (
            <GiftsTab onCountReady={handleGiftCountReady} />
          )}
        </div>

        <div
          role="tabpanel"
          id="mp-panel-settings"
          aria-labelledby="mp-tab-settings"
          className="mypage-section"
          hidden={activeTab !== 'settings'}
        >
          {mountedTabs.has('settings') && (
            <SettingsTab
              user={user}
              onUserUpdate={handleUserUpdate}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default MyPage;
