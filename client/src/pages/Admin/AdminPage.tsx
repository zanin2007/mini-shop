import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/instance';
import { useAlert } from '../../components/useAlert';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useTabIndicator } from '../../hooks/useTabIndicator';
import AdminOrdersTab from './AdminOrdersTab';
import AdminProductsTab from './AdminProductsTab';
import AdminCouponsTab from './AdminCouponsTab';
import AdminAnnouncementsTab from './AdminAnnouncementsTab';
import AdminEventsTab from './AdminEventsTab';
import AdminUsersTab from './AdminUsersTab';
import './AdminPage.css';

type Tab = 'orders' | 'products' | 'coupons' | 'announcements' | 'events' | 'users';

const TABS: Tab[] = ['orders', 'products', 'coupons', 'announcements', 'events', 'users'];

const tabLabels: Record<Tab, string> = {
  orders: '주문 관리',
  products: '상품 관리',
  coupons: '쿠폰 관리',
  announcements: '공지 관리',
  events: '이벤트',
  users: '회원 관리',
};

function AdminPage() {
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlert();
  const [activeTab, setActiveTab] = useState<Tab>('orders');
  const [mountedTabs, setMountedTabs] = useState<Set<Tab>>(new Set(['orders']));
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  const handleTabClick = useCallback((tab: Tab) => {
    setActiveTab(tab);
    setMountedTabs(prev => new Set(prev).add(tab));
  }, []);

  const { tabsRef, setTabRef, indicator, handleKeyDown } = useTabIndicator(TABS, activeTab, handleTabClick);

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      showConfirm('로그인 권한이 필요합니다. 로그인하시겠습니까?').then(ok => {
        if (ok) navigate('/login');
        else navigate(-1);
      });
      return;
    }
    api.get('/auth/check').then(res => {
      if (res.data.user.role === 'admin') {
        setAuthorized(true);
      } else {
        showAlert('관리자 권한이 필요합니다.', 'error');
        navigate('/', { replace: true });
      }
    }).catch(() => {
      navigate('/login', { replace: true });
    }).finally(() => {
      setChecking(false);
    });
  }, [navigate, showAlert, showConfirm]);

  if (checking || !authorized) return <LoadingSpinner />;

  return (
    <div className="admin-page">
      <div className="admin-container">
        <h2 className="admin-title">관리자 페이지</h2>

        <div className="admin-tabs" ref={tabsRef} role="tablist" aria-label="관리자 메뉴">
          {TABS.map(tab => (
            <button
              key={tab}
              ref={setTabRef(tab)}
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`panel-${tab}`}
              id={`tab-${tab}`}
              tabIndex={activeTab === tab ? 0 : -1}
              className={`admin-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => handleTabClick(tab)}
              onKeyDown={handleKeyDown}
            >
              {tabLabels[tab]}
            </button>
          ))}
          <span
            className="admin-tab-indicator"
            style={{ left: indicator.left, width: indicator.width }}
          />
        </div>

        <div className="admin-section">
          {TABS.map(tab => (
            <div
              key={tab}
              role="tabpanel"
              id={`panel-${tab}`}
              aria-labelledby={`tab-${tab}`}
              hidden={activeTab !== tab}
            >
              {mountedTabs.has(tab) && (
                tab === 'orders' ? <AdminOrdersTab /> :
                tab === 'products' ? <AdminProductsTab /> :
                tab === 'coupons' ? <AdminCouponsTab /> :
                tab === 'announcements' ? <AdminAnnouncementsTab /> :
                tab === 'events' ? <AdminEventsTab /> :
                <AdminUsersTab />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AdminPage;
