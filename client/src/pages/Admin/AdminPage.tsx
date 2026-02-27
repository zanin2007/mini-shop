import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlert } from '../../components/AlertContext';
import AdminOrdersTab from './AdminOrdersTab';
import AdminProductsTab from './AdminProductsTab';
import AdminCouponsTab from './AdminCouponsTab';
import AdminAnnouncementsTab from './AdminAnnouncementsTab';
import AdminEventsTab from './AdminEventsTab';
import './AdminPage.css';

type Tab = 'orders' | 'products' | 'coupons' | 'announcements' | 'events';

const tabLabels: Record<Tab, string> = {
  orders: '주문 관리',
  products: '상품 관리',
  coupons: '쿠폰 관리',
  announcements: '공지 관리',
  events: '이벤트',
};

function AdminPage() {
  const navigate = useNavigate();
  const { showAlert } = useAlert();
  const [activeTab, setActiveTab] = useState<Tab>('orders');
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      navigate('/login');
      return;
    }
    const user = JSON.parse(userData);
    if (user.role !== 'admin') {
      showAlert('관리자 권한이 필요합니다.', 'error');
      navigate('/');
      return;
    }
    setAuthorized(true);
  }, []);

  if (!authorized) return <div className="loading"><div className="spinner" />로딩 중...</div>;

  return (
    <div className="admin-page">
      <div className="admin-container">
        <h2 className="admin-title">관리자 페이지</h2>

        <div className="admin-tabs">
          {(Object.keys(tabLabels) as Tab[]).map(tab => (
            <button
              key={tab}
              className={`admin-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        <div className="admin-section">
          {activeTab === 'orders' && <AdminOrdersTab />}
          {activeTab === 'products' && <AdminProductsTab />}
          {activeTab === 'coupons' && <AdminCouponsTab />}
          {activeTab === 'announcements' && <AdminAnnouncementsTab />}
          {activeTab === 'events' && <AdminEventsTab />}
        </div>
      </div>
    </div>
  );
}

export default AdminPage;
