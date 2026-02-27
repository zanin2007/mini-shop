import { useEffect, useState } from 'react';
import api from '../../api/instance';
import { useAlert } from '../../components/AlertContext';

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

function AdminOrdersTab() {
  const { showAlert } = useAlert();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await api.get('/admin/orders');
      setOrders(res.data);
    } catch (error) {
      console.error('주문 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId: number, status: string) => {
    try {
      await api.put(`/admin/orders/${orderId}/status`, { status });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    } catch (error) {
      console.error('상태 변경 실패:', error);
      showAlert('상태 변경에 실패했습니다.', 'error');
    }
  };

  if (loading) return <div className="loading"><div className="spinner" />불러오는 중...</div>;
  if (orders.length === 0) return <p className="empty-msg">주문이 없습니다.</p>;

  return (
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
                  <option value="checking">상품확인중</option>
                  <option value="pending">준비중</option>
                  <option value="shipped">배송중</option>
                  <option value="delivered">배송완료</option>
                  <option value="completed">수령완료</option>
                </select>
              </td>
              <td>{new Date(order.created_at).toLocaleDateString('ko-KR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AdminOrdersTab;
