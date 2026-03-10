/**
 * 주문 내역 탭 (진행중 주문)
 * - 자체 데이터 fetch + 로딩 관리
 * - 주문 상태별 뱃지 + 상품 목록 + 옵션 표시
 * - 배송완료(delivered) → 구매확정 버튼 (낙관적 업데이트 + completed_at 설정)
 * - [테스트용] 주문 상태 다음 단계 변경 버튼
 */
import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AxiosError } from 'axios';
import api from '../../api/instance';
import { useAlert } from '../../components/useAlert';
import LoadingSpinner from '../../components/LoadingSpinner';
import type { Order, CartItemOption } from '../../types';

const statusMap: Record<string, { label: string; className: string }> = {
  checking: { label: '상품확인중', className: 'status-checking' },
  pending: { label: '준비중', className: 'status-pending' },
  shipped: { label: '배송중', className: 'status-shipped' },
  delivered: { label: '배송완료', className: 'status-delivered' },
  completed: { label: '수령완료', className: 'status-completed' },
  refund_requested: { label: '환불신청', className: 'status-refund-requested' },
  refunded: { label: '환불완료', className: 'status-refunded' },
};

interface Props {
  onCountReady: (activeCount: number, completedCount: number) => void;
}

function OrdersTab({ onCountReady }: Props) {
  const { showAlert, showConfirm } = useAlert();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const response = await api.get('/orders');
      setOrders(response.data);
    } catch (error) {
      console.error('주문 내역 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const activeOrders = useMemo(
    () => orders.filter(o => !['completed', 'refund_requested', 'refunded'].includes(o.status)),
    [orders]
  );
  const completedCount = useMemo(
    () => orders.filter(o => ['completed', 'refund_requested', 'refunded'].includes(o.status)).length,
    [orders]
  );

  useEffect(() => {
    if (!loading) {
      onCountReady(activeOrders.length, completedCount);
    }
  }, [activeOrders.length, completedCount, loading, onCountReady]);

  if (loading) return <LoadingSpinner />;

  if (activeOrders.length === 0) {
    return <p className="empty-message">진행중인 주문이 없습니다.</p>;
  }

  return (
    <div className="order-list">
      {activeOrders.map((order) => (
        <div key={order.id} className="order-card">
          <div className="order-header">
            <span className="order-date-title">
              {new Date(order.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })} 주문
            </span>
            <span className={`order-status ${statusMap[order.status]?.className || ''}`}>
              {statusMap[order.status]?.label || order.status}
            </span>
          </div>
          {order.items && order.items.length > 0 && (
            <ul className="order-items">
              {order.items.map((item) => (
                <li key={item.id} className="order-item">
                  <Link to={`/products/${item.product_id}`} className="order-item-link">
                    <img src={item.image_url} alt={item.name} loading="lazy" />
                    <div className="item-name">
                      {item.name}
                      {item.options && item.options.length > 0 && (
                        <span className="item-options">
                          {item.options.map((o: CartItemOption) => `${o.option_name}: ${o.value}`).join(' / ')}
                        </span>
                      )}
                    </div>
                  </Link>
                  <span className="item-qty">{item.quantity}개</span>
                  <span className="item-price">{(item.price * item.quantity).toLocaleString()}원</span>
                </li>
              ))}
            </ul>
          )}
          <div className="delivery-progress">
            {['checking', 'pending', 'shipped', 'delivered'].map((step, idx) => {
              const steps = ['checking', 'pending', 'shipped', 'delivered'];
              const currentIdx = steps.indexOf(order.status);
              const isActive = idx <= currentIdx;
              return (
                <div key={step} className={`progress-step ${isActive ? 'active' : ''}`}>
                  <div className="progress-dot" />
                  <span>{statusMap[step]?.label}</span>
                </div>
              );
            })}
          </div>

          {order.receiver_name && (
            <div className="delivery-info">
              <span>{order.receiver_name}</span>
              <span>{order.receiver_phone}</span>
              <span>{order.delivery_address}</span>
            </div>
          )}

          <div className="order-total">
            {order.discount_amount > 0 && (
              <span className="order-discount">
                쿠폰 할인: -{order.discount_amount.toLocaleString()}원
              </span>
            )}
            총 결제금액: <strong>{(order.final_amount || order.total_amount).toLocaleString()}원</strong>
          </div>

          <div className="order-actions">
            {order.is_gift ? (
              <span className="gift-order-label">선물 주문 (선물 탭에서 확인)</span>
            ) : order.status === 'delivered' ? (
              <button
                className="confirm-btn"
                disabled={processingId === order.id}
                onClick={async () => {
                  if (!(await showConfirm('수령완료 하시겠습니까?'))) return;
                  setProcessingId(order.id);
                  try {
                    await api.put(`/orders/${order.id}/confirm`);
                    showAlert('수령이 완료되었습니다.', 'success');
                    fetchOrders();
                  } catch (error) {
                    if (error instanceof AxiosError) {
                      showAlert(error.response?.data?.message || '처리에 실패했습니다.', 'error');
                    }
                  } finally {
                    setProcessingId(null);
                  }
                }}
              >
                {processingId === order.id ? '처리중...' : '수령완료'}
              </button>
            ) : (
              <button
                className="advance-btn"
                disabled={processingId === order.id}
                onClick={async () => {
                  const nextLabel: Record<string, string> = {
                    checking: '준비중',
                    pending: '배송중',
                    shipped: '배송완료',
                  };
                  const label = nextLabel[order.status] || '다음 단계';
                  if (!(await showConfirm(`'${label}'(으)로 변경하시겠습니까?`))) return;
                  setProcessingId(order.id);
                  try {
                    const res = await api.put(`/orders/${order.id}/advance`);
                    showAlert(res.data.message, 'success');
                    fetchOrders();
                  } catch (error) {
                    if (error instanceof AxiosError) {
                      showAlert(error.response?.data?.message || '상태 변경에 실패했습니다.', 'error');
                    }
                  } finally {
                    setProcessingId(null);
                  }
                }}
              >
                {processingId === order.id ? '처리중...' : ({
                  checking: '준비중으로 변경',
                  pending: '배송중으로 변경',
                  shipped: '배송완료로 변경',
                }[order.status] || '다음 단계')}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default OrdersTab;
