import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import api from '../../api/instance';
import { useAlert } from '../../components/AlertContext';
import './AdminPage.css';

interface AdminOrder {
  id: number;
  nickname: string;
  email: string;
  total_amount: number;
  discount_amount: number;
  final_amount: number;
  status: string;
  receiver_name: string;
  delivery_address: string;
  created_at: string;
  items: { id: number; name: string; quantity: number; price: number }[];
}

interface AdminProduct {
  id: number;
  name: string;
  price: number;
  stock: number;
  category: string;
  seller_nickname: string;
  created_at: string;
}

interface AdminCoupon {
  id: number;
  code: string;
  discount_amount: number;
  discount_percentage: number | null;
  min_price: number | null;
  expiry_date: string;
  max_uses: number | null;
  current_uses: number;
  is_active: boolean;
}

interface AdminAnnouncement {
  id: number;
  admin_id: number;
  title: string;
  content: string;
  is_pinned: boolean;
  is_active: boolean;
  created_at: string;
}

interface AdminEvent {
  id: number;
  title: string;
  description: string;
  type: string;
  reward_type: string | null;
  reward_id: number | null;
  reward_amount: number | null;
  max_participants: number | null;
  current_participants: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

function AdminPage() {
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlert();
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'coupons' | 'announcements' | 'events'>('orders');
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productSort, setProductSort] = useState('newest');
  const [couponForm, setCouponForm] = useState({
    code: '', discount_amount: '', discount_percentage: '',
    min_price: '', expiry_date: '', max_uses: ''
  });
  const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '', is_pinned: false });
  const [eventForm, setEventForm] = useState({
    title: '', description: '', type: 'fcfs',
    reward_type: 'coupon', reward_id: '', reward_amount: '',
    max_participants: '', start_date: '', end_date: ''
  });
  const [drawCount, setDrawCount] = useState<Record<number, string>>({});

  const productCategories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (productSearch) {
      const keyword = productSearch.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(keyword) ||
        (p.seller_nickname && p.seller_nickname.toLowerCase().includes(keyword))
      );
    }

    if (productCategory) {
      result = result.filter(p => p.category === productCategory);
    }

    switch (productSort) {
      case 'newest': result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
      case 'oldest': result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); break;
      case 'price-high': result.sort((a, b) => b.price - a.price); break;
      case 'price-low': result.sort((a, b) => a.price - b.price); break;
      case 'stock-low': result.sort((a, b) => a.stock - b.stock); break;
      case 'name': result.sort((a, b) => a.name.localeCompare(b.name, 'ko')); break;
    }

    return result;
  }, [products, productSearch, productCategory, productSort]);

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
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [ordersRes, productsRes, couponsRes, announcementsRes, eventsRes] = await Promise.all([
        api.get('/admin/orders'),
        api.get('/admin/products'),
        api.get('/admin/coupons'),
        api.get('/admin/announcements'),
        api.get('/admin/events'),
      ]);
      setOrders(ordersRes.data);
      setProducts(productsRes.data);
      setCoupons(couponsRes.data);
      setAnnouncements(announcementsRes.data);
      setEvents(eventsRes.data);
    } catch (error) {
      console.error('관리자 데이터 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId: number, status: string) => {
    try {
      await api.put(`/admin/orders/${orderId}/status`, { status });
      setOrders(orders.map(o => o.id === orderId ? { ...o, status } : o));
    } catch (error) {
      console.error('상태 변경 실패:', error);
      showAlert('상태 변경에 실패했습니다.', 'error');
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!(await showConfirm('정말 이 상품을 삭제하시겠습니까?'))) return;
    try {
      await api.delete(`/admin/products/${id}`);
      setProducts(products.filter(p => p.id !== id));
    } catch (error) {
      console.error('상품 삭제 실패:', error);
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/admin/coupons', {
        code: couponForm.code,
        discount_amount: Number(couponForm.discount_amount) || 0,
        discount_percentage: Number(couponForm.discount_percentage) || null,
        min_price: Number(couponForm.min_price) || null,
        expiry_date: couponForm.expiry_date,
        max_uses: Number(couponForm.max_uses) || null,
      });
      showAlert('쿠폰이 생성되었습니다.', 'success');
      setCouponForm({ code: '', discount_amount: '', discount_percentage: '', min_price: '', expiry_date: '', max_uses: '' });
      const res = await api.get('/admin/coupons');
      setCoupons(res.data);
    } catch (error) {
      if (error instanceof AxiosError) {
        showAlert(error.response?.data?.message || '쿠폰 생성에 실패했습니다.', 'error');
      }
    }
  };

  const handleDeleteCoupon = async (id: number) => {
    if (!(await showConfirm('이 쿠폰을 삭제하시겠습니까?'))) return;
    try {
      await api.delete(`/admin/coupons/${id}`);
      setCoupons(coupons.filter(c => c.id !== id));
    } catch (error) {
      console.error('쿠폰 삭제 실패:', error);
    }
  };

  const handleDistributeCoupon = async (couponId: number) => {
    if (!(await showConfirm('전체 유저에게 이 쿠폰을 배포하시겠습니까?'))) return;
    try {
      const res = await api.post('/admin/coupons/distribute', { coupon_id: couponId });
      showAlert(res.data.message, 'success');
    } catch (error) {
      if (error instanceof AxiosError) {
        showAlert(error.response?.data?.message || '배포에 실패했습니다.', 'error');
      }
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/admin/announcements', announcementForm);
      showAlert('공지가 등록되었습니다.', 'success');
      setAnnouncementForm({ title: '', content: '', is_pinned: false });
      const res = await api.get('/admin/announcements');
      setAnnouncements(res.data);
    } catch (error) {
      if (error instanceof AxiosError) {
        showAlert(error.response?.data?.message || '공지 등록에 실패했습니다.', 'error');
      }
    }
  };

  const handleDeleteAnnouncement = async (id: number) => {
    if (!(await showConfirm('이 공지를 삭제하시겠습니까?'))) return;
    try {
      await api.delete(`/admin/announcements/${id}`);
      setAnnouncements(announcements.filter(a => a.id !== id));
    } catch (error) {
      console.error('공지 삭제 실패:', error);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/admin/events', {
        ...eventForm,
        reward_id: Number(eventForm.reward_id) || null,
        reward_amount: Number(eventForm.reward_amount) || null,
        max_participants: Number(eventForm.max_participants) || null,
      });
      showAlert('이벤트가 생성되었습니다.', 'success');
      setEventForm({ title: '', description: '', type: 'fcfs', reward_type: 'coupon', reward_id: '', reward_amount: '', max_participants: '', start_date: '', end_date: '' });
      const res = await api.get('/admin/events');
      setEvents(res.data);
    } catch (error) {
      if (error instanceof AxiosError) {
        showAlert(error.response?.data?.message || '이벤트 생성에 실패했습니다.', 'error');
      }
    }
  };

  const handleDeleteEvent = async (id: number) => {
    if (!(await showConfirm('이 이벤트를 삭제하시겠습니까?'))) return;
    try {
      await api.delete(`/admin/events/${id}`);
      setEvents(events.filter(ev => ev.id !== id));
    } catch (error) {
      console.error('이벤트 삭제 실패:', error);
    }
  };

  const handleDrawWinners = async (eventId: number) => {
    const count = Number(drawCount[eventId]) || 1;
    if (!(await showConfirm(`${count}명을 추첨하시겠습니까?`))) return;
    try {
      const res = await api.post(`/admin/events/${eventId}/draw`, { winner_count: count });
      showAlert(res.data.message, 'success');
      const eventsRes = await api.get('/admin/events');
      setEvents(eventsRes.data);
    } catch (error) {
      if (error instanceof AxiosError) {
        showAlert(error.response?.data?.message || '추첨에 실패했습니다.', 'error');
      }
    }
  };

  if (loading) return <div className="loading">로딩 중...</div>;

  return (
    <div className="admin-page">
      <div className="admin-container">
        <h2 className="admin-title">관리자 페이지</h2>

        <div className="admin-tabs">
          <button className={`admin-tab ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>
            주문 관리 ({orders.length})
          </button>
          <button className={`admin-tab ${activeTab === 'products' ? 'active' : ''}`} onClick={() => setActiveTab('products')}>
            상품 관리 ({products.length})
          </button>
          <button className={`admin-tab ${activeTab === 'coupons' ? 'active' : ''}`} onClick={() => setActiveTab('coupons')}>
            쿠폰 관리 ({coupons.length})
          </button>
          <button className={`admin-tab ${activeTab === 'announcements' ? 'active' : ''}`} onClick={() => setActiveTab('announcements')}>
            공지 관리 ({announcements.length})
          </button>
          <button className={`admin-tab ${activeTab === 'events' ? 'active' : ''}`} onClick={() => setActiveTab('events')}>
            이벤트 ({events.length})
          </button>
        </div>

        {/* 주문 관리 */}
        {activeTab === 'orders' && (
          <div className="admin-section">
            {orders.length === 0 ? (
              <p className="empty-msg">주문이 없습니다.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>주문번호</th>
                      <th>주문자</th>
                      <th>상품</th>
                      <th>금액</th>
                      <th>상태</th>
                      <th>주문일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(order => (
                      <tr key={order.id}>
                        <td>#{order.id}</td>
                        <td>
                          <div className="order-customer">
                            <strong>{order.nickname}</strong>
                            <small>{order.receiver_name && `→ ${order.receiver_name}`}</small>
                          </div>
                        </td>
                        <td>
                          {order.items?.map(item => (
                            <div key={item.id} className="order-item-mini">
                              {item.name} x{item.quantity}
                            </div>
                          ))}
                        </td>
                        <td>
                          {order.discount_amount > 0 && (
                            <small className="discount-info">-{order.discount_amount.toLocaleString()}</small>
                          )}
                          <strong>{(order.final_amount || order.total_amount).toLocaleString()}원</strong>
                        </td>
                        <td>
                          <select
                            value={order.status}
                            onChange={(e) => handleStatusChange(order.id, e.target.value)}
                            className={`status-select status-${order.status}`}
                          >
                            <option value="pending">준비중</option>
                            <option value="shipped">배송중</option>
                            <option value="delivered">배송완료</option>
                            <option value="completed">구매확정</option>
                          </select>
                        </td>
                        <td>{new Date(order.created_at).toLocaleDateString('ko-KR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 상품 관리 */}
        {activeTab === 'products' && (
          <div className="admin-section">
            <div className="product-filters">
              <input
                className="filter-input"
                type="text"
                placeholder="상품명 또는 판매자 검색..."
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
              />
              <select
                className="filter-select"
                value={productCategory}
                onChange={e => setProductCategory(e.target.value)}
              >
                <option value="">전체 카테고리</option>
                {productCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <select
                className="filter-select"
                value={productSort}
                onChange={e => setProductSort(e.target.value)}
              >
                <option value="newest">최신순</option>
                <option value="oldest">오래된순</option>
                <option value="price-high">가격 높은순</option>
                <option value="price-low">가격 낮은순</option>
                <option value="stock-low">재고 적은순</option>
                <option value="name">이름순</option>
              </select>
              <span className="product-count">{filteredProducts.length}개 상품</span>
            </div>
            {filteredProducts.length === 0 ? (
              <p className="empty-msg">조건에 맞는 상품이 없습니다.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>상품명</th>
                      <th>카테고리</th>
                      <th>가격</th>
                      <th>재고</th>
                      <th>판매자</th>
                      <th>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map(product => (
                      <tr key={product.id}>
                        <td>{product.id}</td>
                        <td>{product.name}</td>
                        <td>{product.category || '-'}</td>
                        <td>{product.price.toLocaleString()}원</td>
                        <td className={product.stock === 0 ? 'out-of-stock' : ''}>{product.stock}개</td>
                        <td>{product.seller_nickname || '-'}</td>
                        <td>
                          <button className="admin-delete-btn" onClick={() => handleDeleteProduct(product.id)}>
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 쿠폰 관리 */}
        {activeTab === 'coupons' && (
          <div className="admin-section">
            <form className="coupon-create-form" onSubmit={handleCreateCoupon}>
              <h4>쿠폰 생성</h4>
              <div className="coupon-form-grid">
                <input
                  placeholder="쿠폰 코드"
                  value={couponForm.code}
                  onChange={e => setCouponForm({ ...couponForm, code: e.target.value })}
                  required
                />
                <input
                  type="number"
                  placeholder="할인 금액 (원)"
                  value={couponForm.discount_amount}
                  onChange={e => setCouponForm({ ...couponForm, discount_amount: e.target.value })}
                />
                <input
                  type="number"
                  placeholder="할인율 (%)"
                  value={couponForm.discount_percentage}
                  onChange={e => setCouponForm({ ...couponForm, discount_percentage: e.target.value })}
                />
                <input
                  type="number"
                  placeholder="최소 주문금액"
                  value={couponForm.min_price}
                  onChange={e => setCouponForm({ ...couponForm, min_price: e.target.value })}
                />
                <input
                  type="datetime-local"
                  value={couponForm.expiry_date}
                  onChange={e => setCouponForm({ ...couponForm, expiry_date: e.target.value })}
                  required
                />
                <input
                  type="number"
                  placeholder="최대 배포 수량"
                  value={couponForm.max_uses}
                  onChange={e => setCouponForm({ ...couponForm, max_uses: e.target.value })}
                />
              </div>
              <button type="submit" className="coupon-create-btn">쿠폰 생성</button>
            </form>

            {coupons.length > 0 && (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>코드</th>
                      <th>할인</th>
                      <th>최소금액</th>
                      <th>만료일</th>
                      <th>사용</th>
                      <th>상태</th>
                      <th>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.map(coupon => (
                      <tr key={coupon.id}>
                        <td><code>{coupon.code}</code></td>
                        <td>
                          {coupon.discount_percentage
                            ? `${coupon.discount_percentage}%`
                            : `${coupon.discount_amount.toLocaleString()}원`}
                        </td>
                        <td>{coupon.min_price ? `${coupon.min_price.toLocaleString()}원` : '-'}</td>
                        <td>{new Date(coupon.expiry_date).toLocaleDateString('ko-KR')}</td>
                        <td>{coupon.current_uses}{coupon.max_uses ? `/${coupon.max_uses}` : ''}</td>
                        <td>
                          <span className={`coupon-status ${new Date(coupon.expiry_date) < new Date() ? 'expired' : 'active'}`}>
                            {new Date(coupon.expiry_date) < new Date() ? '만료' : '활성'}
                          </span>
                        </td>
                        <td>
                          <div className="coupon-actions">
                            <button className="admin-distribute-btn" onClick={() => handleDistributeCoupon(coupon.id)}>
                              배포
                            </button>
                            <button className="admin-delete-btn" onClick={() => handleDeleteCoupon(coupon.id)}>
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 공지 관리 */}
        {activeTab === 'announcements' && (
          <div className="admin-section">
            <form className="coupon-create-form" onSubmit={handleCreateAnnouncement}>
              <h4>공지 작성</h4>
              <div className="announcement-form">
                <input
                  placeholder="공지 제목"
                  value={announcementForm.title}
                  onChange={e => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                  required
                />
                <textarea
                  placeholder="공지 내용"
                  value={announcementForm.content}
                  onChange={e => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
                  rows={4}
                  required
                />
                <label className="pin-label">
                  <input
                    type="checkbox"
                    checked={announcementForm.is_pinned}
                    onChange={e => setAnnouncementForm({ ...announcementForm, is_pinned: e.target.checked })}
                  />
                  상단 고정
                </label>
              </div>
              <button type="submit" className="coupon-create-btn">공지 등록</button>
            </form>

            {announcements.length > 0 && (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>제목</th>
                      <th>고정</th>
                      <th>등록일</th>
                      <th>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {announcements.map(ann => (
                      <tr key={ann.id}>
                        <td>{ann.title}</td>
                        <td>{ann.is_pinned ? '📌' : '-'}</td>
                        <td>{new Date(ann.created_at).toLocaleDateString('ko-KR')}</td>
                        <td>
                          <button className="admin-delete-btn" onClick={() => handleDeleteAnnouncement(ann.id)}>
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 이벤트 관리 */}
        {activeTab === 'events' && (
          <div className="admin-section">
            <form className="coupon-create-form" onSubmit={handleCreateEvent}>
              <h4>이벤트 생성</h4>
              <div className="coupon-form-grid">
                <input
                  placeholder="이벤트 제목"
                  value={eventForm.title}
                  onChange={e => setEventForm({ ...eventForm, title: e.target.value })}
                  required
                />
                <select
                  value={eventForm.type}
                  onChange={e => setEventForm({ ...eventForm, type: e.target.value })}
                >
                  <option value="fcfs">선착순</option>
                  <option value="random">랜덤 추첨</option>
                </select>
                <select
                  value={eventForm.reward_type}
                  onChange={e => setEventForm({ ...eventForm, reward_type: e.target.value })}
                >
                  <option value="coupon">쿠폰</option>
                  <option value="point">포인트</option>
                </select>
                <input
                  type="number"
                  placeholder="보상 ID (쿠폰 ID)"
                  value={eventForm.reward_id}
                  onChange={e => setEventForm({ ...eventForm, reward_id: e.target.value })}
                />
                <input
                  type="number"
                  placeholder="보상 수량/금액"
                  value={eventForm.reward_amount}
                  onChange={e => setEventForm({ ...eventForm, reward_amount: e.target.value })}
                />
                <input
                  type="number"
                  placeholder="최대 참여 인원"
                  value={eventForm.max_participants}
                  onChange={e => setEventForm({ ...eventForm, max_participants: e.target.value })}
                />
                <input
                  type="datetime-local"
                  value={eventForm.start_date}
                  onChange={e => setEventForm({ ...eventForm, start_date: e.target.value })}
                  required
                />
                <input
                  type="datetime-local"
                  value={eventForm.end_date}
                  onChange={e => setEventForm({ ...eventForm, end_date: e.target.value })}
                  required
                />
              </div>
              <textarea
                className="event-desc-input"
                placeholder="이벤트 설명"
                value={eventForm.description}
                onChange={e => setEventForm({ ...eventForm, description: e.target.value })}
                rows={3}
              />
              <button type="submit" className="coupon-create-btn">이벤트 생성</button>
            </form>

            {events.length > 0 && (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>제목</th>
                      <th>유형</th>
                      <th>보상</th>
                      <th>참여</th>
                      <th>기간</th>
                      <th>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map(ev => (
                      <tr key={ev.id}>
                        <td>{ev.title}</td>
                        <td>
                          <span className={`event-type-badge type-${ev.type}`}>
                            {ev.type === 'fcfs' ? '선착순' : '추첨'}
                          </span>
                        </td>
                        <td>{ev.reward_type || '-'}</td>
                        <td>{ev.current_participants}{ev.max_participants ? `/${ev.max_participants}` : ''}명</td>
                        <td>
                          <small>
                            {new Date(ev.start_date).toLocaleDateString('ko-KR')} ~ {new Date(ev.end_date).toLocaleDateString('ko-KR')}
                          </small>
                        </td>
                        <td>
                          <div className="event-actions">
                            {ev.type === 'random' && (
                              <div className="draw-controls">
                                <input
                                  type="number"
                                  min="1"
                                  placeholder="인원"
                                  value={drawCount[ev.id] || ''}
                                  onChange={e => setDrawCount({ ...drawCount, [ev.id]: e.target.value })}
                                  className="draw-input"
                                />
                                <button className="admin-draw-btn" onClick={() => handleDrawWinners(ev.id)}>
                                  추첨
                                </button>
                              </div>
                            )}
                            <button className="admin-delete-btn" onClick={() => handleDeleteEvent(ev.id)}>
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminPage;
