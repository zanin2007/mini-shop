/**
 * 마이페이지
 * - 프로필 (주문/구매/쿠폰/포인트 통계), 탭 네비게이션
 * - 각 탭이 자체 데이터를 fetch하고 로딩 관리 (AdminPage 패턴)
 * - 탭에서 onCountReady 콜백으로 히어로 스탯/뱃지 카운트 전달
 * - fetchUser로 최신 유저 정보 동기화 (role, points 등)
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlert } from '../../components/useAlert';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../api/instance';
import type { User } from '../../types';
import OrdersTab from './OrdersTab';
import PurchasesTab from './PurchasesTab';
import CouponsTab from './CouponsTab';
import GiftsTab from './GiftsTab';
import SettingsTab from './SettingsTab';
import './MyPage.css';

function MyPage() {
  const navigate = useNavigate();
  const { showConfirm } = useAlert();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  type MyTab = 'orders' | 'purchases' | 'coupons' | 'gifts' | 'settings';
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
    const userData = localStorage.getItem('user');
    if (userData) {
      try { setUser(JSON.parse(userData)); } catch { /* ignore corrupt data */ }
    }
    api.get('/auth/check').then(res => {
      const freshUser = res.data.user;
      setUser(freshUser);
      localStorage.setItem('user', JSON.stringify(freshUser));
    }).catch(error => {
      console.error('유저 정보 조회 실패:', error);
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

  const handleTabClick = (tab: MyTab) => {
    setActiveTab(tab);
    setMountedTabs(prev => new Set(prev).add(tab));
  };

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
        <div className="mypage-tabs">
          <button
            className={`mypage-tab ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => handleTabClick('orders')}
          >
            주문 내역 {activeOrdersCount > 0 && <span className="tab-badge">{activeOrdersCount}</span>}
          </button>
          <button
            className={`mypage-tab ${activeTab === 'purchases' ? 'active' : ''}`}
            onClick={() => handleTabClick('purchases')}
          >
            구매 내역
          </button>
          <button
            className={`mypage-tab ${activeTab === 'coupons' ? 'active' : ''}`}
            onClick={() => handleTabClick('coupons')}
          >
            쿠폰 {availableCouponsCount > 0 && <span className="tab-badge">{availableCouponsCount}</span>}
          </button>
          <button
            className={`mypage-tab ${activeTab === 'gifts' ? 'active' : ''}`}
            onClick={() => handleTabClick('gifts')}
          >
            선물 {pendingGiftsCount > 0 && <span className="tab-badge">{pendingGiftsCount}</span>}
          </button>
          <button
            className={`mypage-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => handleTabClick('settings')}
          >
            계정 설정
          </button>
        </div>

        {/* Tab Contents — display:none으로 숨겨 리마운트 방지 */}
        <section className="mypage-section" style={{ display: activeTab === 'orders' ? 'block' : 'none' }}>
          {mountedTabs.has('orders') && (
            <OrdersTab onCountReady={handleOrderCountReady} />
          )}
        </section>

        <section className="mypage-section" style={{ display: activeTab === 'purchases' ? 'block' : 'none' }}>
          {mountedTabs.has('purchases') && <PurchasesTab />}
        </section>

        <section className="mypage-section" style={{ display: activeTab === 'coupons' ? 'block' : 'none' }}>
          {mountedTabs.has('coupons') && (
            <CouponsTab onCountReady={handleCouponCountReady} />
          )}
        </section>

        <section className="mypage-section" style={{ display: activeTab === 'gifts' ? 'block' : 'none' }}>
          {mountedTabs.has('gifts') && (
            <GiftsTab onCountReady={handleGiftCountReady} />
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
      </div>
    </div>
  );
}

export default MyPage;
