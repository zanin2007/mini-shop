import { AxiosError } from 'axios';
import api from '../../api/instance';
import { useAlert } from '../../components/AlertContext';
import type { Order, CartItemOption } from '../../types';

interface StatusInfo {
  label: string;
  className: string;
}

interface Props {
  orders: Order[];
  allOrders: Order[];
  statusMap: Record<string, StatusInfo>;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
}

function OrdersTab({ orders, allOrders, statusMap, setOrders }: Props) {
  const { showAlert, showConfirm } = useAlert();
  if (orders.length === 0) {
    return <p className="empty-message">진행중인 주문이 없습니다.</p>;
  }

  return (
    <div className="order-list">
      {orders.map((order) => (
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
                  <img src={item.image_url} alt={item.name} />
                  <div className="item-name">
                    {item.name}
                    {item.options && item.options.length > 0 && (
                      <span className="item-options">
                        {item.options.map((o: CartItemOption) => `${o.option_name}: ${o.value}`).join(' / ')}
                      </span>
                    )}
                  </div>
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
            {order.status === 'delivered' ? (
              <button
                className="confirm-btn"
                onClick={async () => {
                  if (!(await showConfirm('수령완료 하시겠습니까?'))) return;
                  try {
                    await api.put(`/orders/${order.id}/confirm`);
                    showAlert('수령이 완료되었습니다.', 'success');
                    setOrders(allOrders.map(o => o.id === order.id ? { ...o, status: 'completed' } : o));
                  } catch (error) {
                    if (error instanceof AxiosError) {
                      showAlert(error.response?.data?.message || '처리에 실패했습니다.', 'error');
                    }
                  }
                }}
              >
                수령완료
              </button>
            ) : (
              <button
                className="advance-btn"
                onClick={async () => {
                  const nextLabel: Record<string, string> = {
                    checking: '준비중',
                    pending: '배송중',
                    shipped: '배송완료',
                  };
                  const label = nextLabel[order.status] || '다음 단계';
                  if (!(await showConfirm(`'${label}'(으)로 변경하시겠습니까?`))) return;
                  try {
                    const res = await api.put(`/orders/${order.id}/advance`);
                    showAlert(res.data.message, 'success');
                    setOrders(allOrders.map(o => o.id === order.id ? { ...o, status: res.data.status } : o));
                  } catch (error) {
                    if (error instanceof AxiosError) {
                      showAlert(error.response?.data?.message || '상태 변경에 실패했습니다.', 'error');
                    }
                  }
                }}
              >
                {{
                  checking: '준비중으로 변경',
                  pending: '배송중으로 변경',
                  shipped: '배송완료로 변경',
                }[order.status] || '다음 단계'}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default OrdersTab;
