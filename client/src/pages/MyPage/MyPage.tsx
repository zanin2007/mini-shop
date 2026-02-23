import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/instance';
import type { Order, User } from '../../types';
import './MyPage.css';

function MyPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    const userData = localStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
    fetchOrders();
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

  if (loading) return <div className="loading">로딩 중...</div>;

  return (
    <div className="mypage">
      <div className="container">
        <h2 className="mypage-title">마이페이지</h2>

        {/* 사용자 정보 */}
        <section className="mypage-section">
          <h3>내 정보</h3>
          <div className="user-info-card">
            <p><span>닉네임</span>{user?.nickname}</p>
            <p><span>이메일</span>{user?.email}</p>
          </div>
        </section>

        {/* 주문 내역 */}
        <section className="mypage-section">
          <h3>주문 내역</h3>
          {orders.length === 0 ? (
            <p className="empty-message">주문 내역이 없습니다.</p>
          ) : (
            <div className="order-list">
              {orders.map((order) => (
                <div key={order.id} className="order-card">
                  <div className="order-header">
                    <span className="order-id">주문 #{order.id}</span>
                    <span className="order-status">{order.status}</span>
                    <span className="order-date">
                      {new Date(order.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  {order.items && order.items.length > 0 && (
                    <ul className="order-items">
                      {order.items.map((item) => (
                        <li key={item.id} className="order-item">
                          <img src={item.image_url} alt={item.name} />
                          <span className="item-name">{item.name}</span>
                          <span className="item-qty">{item.quantity}개</span>
                          <span className="item-price">{(item.price * item.quantity).toLocaleString()}원</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="order-total">
                    총 결제금액: <strong>{order.total_amount.toLocaleString()}원</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default MyPage;
