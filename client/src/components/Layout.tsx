import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback, useRef } from 'react';
import api from '../api/instance';
import { useAlert } from './useAlert';
import { APP_EVENTS } from '../constants/events';
import { getStoredUser } from '../utils/storage';
import type { User } from '../types';
import './Layout.css';

function Layout() {
  const [user, setUser] = useState<User | null>(() => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    return getStoredUser();
  });
  const [cartCount, setCartCount] = useState(0);
  const [mailboxCount, setMailboxCount] = useState(0);
  const [notifCount, setNotifCount] = useState(0);
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlert();
  const prevMailboxCount = useRef(0);
  const prevNotifCount = useRef(0);
  const isFirstFetch = useRef(true);

  const fetchCounts = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const [cartRes, mailRes, notifRes] = await Promise.all([
        api.get('/cart').catch(() => ({ data: [] })),
        api.get('/mailbox/unread-count').catch(() => ({ data: { count: 0 } })),
        api.get('/notifications/unread-count').catch(() => ({ data: { count: 0 } })),
      ]);
      const newCartCount = cartRes.data.length ?? 0;
      const newMailboxCount = mailRes.data.count ?? 0;
      const newNotifCount = notifRes.data.count ?? 0;

      setCartCount(newCartCount);
      setMailboxCount(newMailboxCount);
      setNotifCount(newNotifCount);

      // 새 알림/우편 도착 시 토스트 표시 (최초 로드 제외)
      if (!isFirstFetch.current) {
        if (newNotifCount > prevNotifCount.current) {
          showAlert('새 알림이 도착했습니다!', 'info');
        }
        if (newMailboxCount > prevMailboxCount.current) {
          showAlert('새 우편이 도착했습니다!', 'info');
        }
      }
      isFirstFetch.current = false;
      prevMailboxCount.current = newMailboxCount;
      prevNotifCount.current = newNotifCount;
    } catch { /* ignore */ }
  }, [showAlert]);

  // 초기 로드 + 폴링 + 커스텀 이벤트 구독 (로그인 시에만)
  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    void setTimeout(fetchCounts, 0); // 초기 로드 (비동기로 호출하여 cascading render 방지)
    const interval = setInterval(fetchCounts, 30000);

    const handleCountsUpdate = () => { fetchCounts(); };
    window.addEventListener(APP_EVENTS.CART_UPDATED, handleCountsUpdate);
    window.addEventListener(APP_EVENTS.NOTIFICATION_UPDATED, handleCountsUpdate);
    window.addEventListener(APP_EVENTS.MAILBOX_UPDATED, handleCountsUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener(APP_EVENTS.CART_UPDATED, handleCountsUpdate);
      window.removeEventListener(APP_EVENTS.NOTIFICATION_UPDATED, handleCountsUpdate);
      window.removeEventListener(APP_EVENTS.MAILBOX_UPDATED, handleCountsUpdate);
    };
  }, [fetchCounts]);

  // localStorage 변경 감지 (닉네임 등 실시간 반영)
  useEffect(() => {
    const loadUser = () => {
      const token = localStorage.getItem('token');
      setUser(token ? getStoredUser() : null);
    };

    window.addEventListener('storage', loadUser);
    window.addEventListener(APP_EVENTS.USER_UPDATED, loadUser);
    return () => {
      window.removeEventListener('storage', loadUser);
      window.removeEventListener(APP_EVENTS.USER_UPDATED, loadUser);
    };
  }, []);

  const handleLogout = async () => {
    if (!(await showConfirm('로그아웃 하시겠습니까?'))) return;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/');
  };

  return (
    <div className="layout">
      <header className="header">
        <div className="container">
          <Link to="/" className="logo">
            <h1>Mini Shop</h1>
          </Link>
          <nav className="nav">
            {user ? (
              <>
                <span className="user-info">{user.nickname}님</span>
                <Link to="/mailbox" className="icon-link" title="우편함">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  {mailboxCount > 0 && <span className="icon-badge">{mailboxCount}</span>}
                </Link>
                <Link to="/notifications" className="icon-link" title="알림">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                  {notifCount > 0 && <span className="icon-badge">{notifCount}</span>}
                </Link>
                <Link to="/wishlist">찜</Link>
                <Link to="/cart">장바구니{cartCount > 0 && <span className="cart-badge">{cartCount}</span>}</Link>
                <Link to="/mypage">마이페이지</Link>
                {user.role === 'admin' && (
                  <>
                    <Link to="/products/new">상품 등록</Link>
                    <Link to="/admin" className="admin-link">관리자</Link>
                  </>
                )}
                <button onClick={handleLogout} className="logout-btn">
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link to="/login">로그인</Link>
                <Link to="/signup">회원가입</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container">
          <p>&copy; {new Date().getFullYear()} Mini Shop. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
