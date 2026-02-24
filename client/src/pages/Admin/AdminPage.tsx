import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

function AdminPage() {
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlert();
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'coupons'>('orders');
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [couponForm, setCouponForm] = useState({
    code: '', discount_amount: '', discount_percentage: '',
    min_price: '', expiry_date: '', max_uses: ''
  });

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
      const [ordersRes, productsRes, couponsRes] = await Promise.all([
        api.get('/admin/orders'),
        api.get('/admin/products'),
        api.get('/admin/coupons'),
      ]);
      setOrders(ordersRes.data);
      setProducts(productsRes.data);
      setCoupons(couponsRes.data);
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
    } catch (error: any) {
      showAlert(error.response?.data?.message || '쿠폰 생성에 실패했습니다.', 'error');
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
            {products.length === 0 ? (
              <p className="empty-msg">상품이 없습니다.</p>
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
                    {products.map(product => (
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
                  placeholder="최대 사용횟수"
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
                          <button className="admin-delete-btn" onClick={() => handleDeleteCoupon(coupon.id)}>
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
      </div>
    </div>
  );
}

export default AdminPage;
