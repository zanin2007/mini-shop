/**
 * 환불 신청 페이지
 * - 주문 정보 + 상품 목록 표시
 * - 환불 사유 입력 → 환불 신청 API 호출
 * - 수령완료(completed) 후 7일 이내만 접근 가능
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/instance';
import { useAlert } from '../../components/AlertContext';
import type { Order } from '../../types';
import './RefundPage.css';

function RefundPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlert();
  const [order, setOrder] = useState<Order | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      showConfirm('로그인 권한이 필요합니다. 로그인하시겠습니까?').then(ok => {
        if (ok) navigate('/login');
        else navigate(-1);
      });
      return;
    }
    fetchOrder();
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      const response = await api.get('/orders');
      const found = response.data.find((o: Order) => o.id === Number(orderId));
      if (!found) {
        showAlert('주문을 찾을 수 없습니다.', 'error');
        navigate('/mypage');
        return;
      }
      if (found.status !== 'completed') {
        showAlert('수령완료된 주문만 환불 신청이 가능합니다.', 'error');
        navigate('/mypage');
        return;
      }
      setOrder(found);
    } catch {
      showAlert('주문 정보를 불러올 수 없습니다.', 'error');
      navigate('/mypage');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      showAlert('환불 사유를 입력해주세요.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/refunds/${orderId}`, { reason });
      showAlert('환불 신청이 완료되었습니다.', 'success');
      navigate('/mypage');
    } catch (error: any) {
      const msg = error.response?.data?.message || '환불 신청에 실패했습니다.';
      showAlert(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading"><div className="spinner" />로딩 중...</div>;
  if (!order) return null;

  return (
    <div className="refund-page">
      <div className="refund-container">
        <button className="back-btn" onClick={() => navigate(-1)}>← 뒤로가기</button>
        <h2>환불 신청</h2>

        <div className="refund-order-info">
          <div className="refund-order-header">
            <span className="refund-order-id">주문번호 #{order.id}</span>
            <span className="refund-order-date">
              {new Date(order.created_at).toLocaleDateString('ko-KR')}
            </span>
          </div>
          {order.items && order.items.length > 0 && (
            <ul className="refund-items">
              {order.items.map((item) => (
                <li key={item.id} className="refund-item">
                  <img src={item.image_url} alt={item.name} />
                  <div className="refund-item-info">
                    <span className="refund-item-name">{item.name}</span>
                    <span className="refund-item-detail">
                      {item.quantity}개 · {(item.price * item.quantity).toLocaleString()}원
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="refund-amount">
            환불 예정 금액: <strong>{(order.final_amount || order.total_amount).toLocaleString()}원</strong>
          </div>
        </div>

        <form className="refund-form" onSubmit={handleSubmit}>
          <label htmlFor="refund-reason">환불 사유</label>
          <textarea
            id="refund-reason"
            placeholder="환불 사유를 상세히 작성해주세요..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={5}
          />
          <div className="refund-notice">
            수령완료 후 7일 이내에만 환불 신청이 가능합니다.
            관리자 승인 후 환불이 처리됩니다.
          </div>
          <button type="submit" className="refund-submit-btn" disabled={submitting}>
            {submitting ? '처리 중...' : '환불 신청'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default RefundPage;
