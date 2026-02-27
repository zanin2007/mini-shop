import type { Order, CartItemOption } from '../../types';

interface StatusInfo {
  label: string;
  className: string;
}

interface Props {
  orders: Order[];
  statusMap: Record<string, StatusInfo>;
}

function PurchasesTab({ orders, statusMap }: Props) {
  if (orders.length === 0) {
    return <p className="empty-message">구매 내역이 없습니다.</p>;
  }

  return (
    <div className="order-list">
      {orders.map((order) => (
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
          <div className="order-total">
            {order.discount_amount > 0 && (
              <span className="order-discount">
                쿠폰 할인: -{order.discount_amount.toLocaleString()}원
              </span>
            )}
            총 결제금액: <strong>{(order.final_amount || order.total_amount).toLocaleString()}원</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

export default PurchasesTab;
