/**
 * 관리자 주문 관리 탭
 * - 전체 주문 목록 (유저 정보 + 주문 상품)
 * - 상태 변경: 드롭다운으로 변경 (환불 상태는 뱃지만 표시, 변경 차단)
 * - 환불 관리: 환불 요청 조회, 승인/거부 (관리자 메모 입력 가능)
 */
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

interface RefundRequest {
  id: number;
  order_id: number;
  user_id: number;
  nickname: string;
  email: string;
  reason: string;
  status: string;
  admin_note: string | null;
  total_amount: number;
  discount_amount: number;
  final_amount: number;
  order_date: string;
  created_at: string;
  processed_at: string | null;
  items: { id: number; name: string; quantity: number; price: number }[];
}

function AdminOrdersTab() {
  const { showAlert, showConfirm } = useAlert();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminNotes, setAdminNotes] = useState<Record<number, string>>({});

  useEffect(() => {
    Promise.all([fetchOrders(), fetchRefunds()]).finally(() => setLoading(false));
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await api.get('/admin/orders');
      setOrders(res.data);
    } catch (error) {
      console.error('주문 조회 실패:', error);
    }
  };

  const fetchRefunds = async () => {
    try {
      const res = await api.get('/admin/refunds');
      setRefunds(res.data);
    } catch (error) {
      console.error('환불 조회 실패:', error);
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

  const handleRefundAction = async (refundId: number, action: 'approve' | 'reject') => {
    const label = action === 'approve' ? '승인' : '거부';
    if (!(await showConfirm(`환불을 ${label}하시겠습니까?`))) return;
    try {
      await api.put(`/admin/refunds/${refundId}`, {
        action,
        admin_note: adminNotes[refundId] || null,
      });
      showAlert(`환불이 ${label}되었습니다.`, 'success');
      fetchRefunds();
      fetchOrders();
    } catch (error) {
      console.error('환불 처리 실패:', error);
      showAlert('환불 처리에 실패했습니다.', 'error');
    }
  };

  if (loading) return <div className="loading"><div className="spinner" />불러오는 중...</div>;

  const pendingRefunds = refunds.filter(r => r.status === 'requested');
  const processedRefunds = refunds.filter(r => r.status !== 'requested');

  return (
    <div>
      {/* 환불 요청 섹션 */}
      {pendingRefunds.length > 0 && (
        <div className="admin-refund-section">
          <h3 className="admin-section-title">환불 요청 ({pendingRefunds.length}건)</h3>
          <div className="admin-refund-list">
            {pendingRefunds.map(refund => (
              <div key={refund.id} className="admin-refund-card">
                <div className="admin-refund-header">
                  <span className="admin-refund-order">주문 #{refund.order_id}</span>
                  <span className="admin-refund-user">{refund.nickname} ({refund.email})</span>
                  <span className="admin-refund-date">
                    {new Date(refund.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                <div className="admin-refund-items">
                  {refund.items?.map(item => (
                    <span key={item.id} className="admin-refund-item">
                      {item.name} x{item.quantity}
                    </span>
                  ))}
                </div>
                <div className="admin-refund-amount">
                  환불 금액: <strong>{refund.final_amount.toLocaleString()}원</strong>
                </div>
                <div className="admin-refund-reason">
                  <strong>사유:</strong> {refund.reason}
                </div>
                <div className="admin-refund-actions">
                  <input
                    type="text"
                    placeholder="관리자 메모 (선택)"
                    value={adminNotes[refund.id] || ''}
                    onChange={(e) => setAdminNotes(prev => ({ ...prev, [refund.id]: e.target.value }))}
                    className="admin-refund-note-input"
                  />
                  <button
                    className="admin-refund-approve-btn"
                    onClick={() => handleRefundAction(refund.id, 'approve')}
                  >
                    승인
                  </button>
                  <button
                    className="admin-refund-reject-btn"
                    onClick={() => handleRefundAction(refund.id, 'reject')}
                  >
                    거부
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 처리된 환불 내역 */}
      {processedRefunds.length > 0 && (
        <div className="admin-refund-section">
          <h3 className="admin-section-title">환불 처리 내역</h3>
          <div className="admin-refund-list">
            {processedRefunds.map(refund => (
              <div key={refund.id} className="admin-refund-card processed">
                <div className="admin-refund-header">
                  <span className="admin-refund-order">주문 #{refund.order_id}</span>
                  <span className="admin-refund-user">{refund.nickname}</span>
                  <span className={`admin-refund-status ${refund.status === 'approved' ? 'approved' : 'rejected'}`}>
                    {refund.status === 'approved' ? '승인' : '거부'}
                  </span>
                </div>
                <div className="admin-refund-amount">
                  {refund.final_amount.toLocaleString()}원 · {refund.reason}
                </div>
                {refund.admin_note && (
                  <div className="admin-refund-note">메모: {refund.admin_note}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 주문 목록 */}
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
                    {order.status === 'refund_requested' || order.status === 'refunded' ? (
                      <span className={`status-badge status-${order.status}`}>
                        {order.status === 'refund_requested' ? '환불신청' : '환불완료'}
                      </span>
                    ) : (
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
                    )}
                  </td>
                  <td>{new Date(order.created_at).toLocaleDateString('ko-KR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AdminOrdersTab;
