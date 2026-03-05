import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/instance';
import { useAlert } from '../../components/useAlert';
import LoadingSpinner from '../../components/LoadingSpinner';
import AdminOrdersTab from './AdminOrdersTab';
import AdminProductsTab from './AdminProductsTab';
import AdminCouponsTab from './AdminCouponsTab';
import AdminAnnouncementsTab from './AdminAnnouncementsTab';
import AdminEventsTab from './AdminEventsTab';
import AdminUsersTab from './AdminUsersTab';
import './AdminPage.css';

type Tab = 'orders' | 'products' | 'coupons' | 'announcements' | 'events' | 'users';

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

        <div className="admin-tabs">
          {(Object.keys(tabLabels) as Tab[]).map(tab => (
            <button
              key={tab}
              className={`admin-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => { setActiveTab(tab); setMountedTabs(prev => new Set(prev).add(tab)); }}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        <div className="admin-section">
          <div style={{ display: activeTab === 'orders' ? 'block' : 'none' }}>
            {mountedTabs.has('orders') && <AdminOrdersTab />}
          </div>
          <div style={{ display: activeTab === 'products' ? 'block' : 'none' }}>
            {mountedTabs.has('products') && <AdminProductsTab />}
          </div>
          <div style={{ display: activeTab === 'coupons' ? 'block' : 'none' }}>
            {mountedTabs.has('coupons') && <AdminCouponsTab />}
          </div>
          <div style={{ display: activeTab === 'announcements' ? 'block' : 'none' }}>
            {mountedTabs.has('announcements') && <AdminAnnouncementsTab />}
          </div>
          <div style={{ display: activeTab === 'events' ? 'block' : 'none' }}>
            {mountedTabs.has('events') && <AdminEventsTab />}
          </div>
          <div style={{ display: activeTab === 'users' ? 'block' : 'none' }}>
            {mountedTabs.has('users') && <AdminUsersTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminPage;
