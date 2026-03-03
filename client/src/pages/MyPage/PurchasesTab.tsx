import { Link, useNavigate } from 'react-router-dom';
import type { Order, CartItemOption, Refund } from '../../types';

interface StatusInfo {
  label: string;
  className: string;
}

interface Props {
  orders: Order[];
  statusMap: Record<string, StatusInfo>;
  refunds: Refund[];
}

function PurchasesTab({ orders, statusMap, refunds }: Props) {
  const navigate = useNavigate();

  const getRefundForOrder = (orderId: number) => {
    return refunds.find(r => r.order_id === orderId);
  };

  const canRequestRefund = (order: Order) => {
    if (order.status !== 'completed') return false;
    if (!order.completed_at) return false;
    const completedDate = new Date(order.completed_at);
    const now = new Date();
    const diffDays = (now.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 7;
  };

  const getDaysLeft = (order: Order) => {
    if (!order.completed_at) return 0;
    const completedDate = new Date(order.completed_at);
    const now = new Date();
    const diffDays = (now.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.ceil(7 - diffDays));
  };

  const refundStatusMap: Record<string, { label: string; className: string }> = {
    requested: { label: '환불 심사중', className: 'refund-status-requested' },
    approved: { label: '환불 승인', className: 'refund-status-approved' },
    rejected: { label: '환불 거부', className: 'refund-status-rejected' },
  };

  if (orders.length === 0) {
    return <p className="empty-message">구매 내역이 없습니다.</p>;
  }

  return (
    <div className="order-list">
      {orders.map((order) => {
        const refund = getRefundForOrder(order.id);

        return (
          <div key={order.id} className="order-card">
            <div className="order-header">
              <span className="order-date-title">
                {new Date(order.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })} 구매
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
                      <img src={item.image_url} alt={item.name} />
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
            <div className="order-total">
              {order.discount_amount > 0 && (
                <span className="order-discount">
                  쿠폰 할인: -{order.discount_amount.toLocaleString()}원
                </span>
              )}
              총 결제금액: <strong>{(order.final_amount || order.total_amount).toLocaleString()}원</strong>
            </div>

            {/* 환불 영역 */}
            <div className="order-refund-area">
              {refund ? (
                <div className="refund-info">
                  <span className={`refund-status-badge ${refundStatusMap[refund.status]?.className || ''}`}>
                    {refundStatusMap[refund.status]?.label || refund.status}
                  </span>
                  {refund.status === 'rejected' && refund.admin_note && (
                    <span className="refund-reject-reason">사유: {refund.admin_note}</span>
                  )}
                </div>
              ) : order.status === 'completed' && canRequestRefund(order) ? (
                <button
                  className="refund-btn"
                  onClick={() => navigate(`/refund/${order.id}`)}
                >
                  환불 신청 <span className="refund-days-left">({getDaysLeft(order)}일 남음)</span>
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default PurchasesTab;
