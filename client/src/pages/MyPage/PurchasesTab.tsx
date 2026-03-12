/**
 * 구매 내역 탭 (수령완료/환불 주문)
 * - 자체 데이터 fetch + 로딩 관리
 * - 완료된 주문 + 환불 상태(심사중/승인/거부) 표시
 * - 환불 신청 버튼: 수령완료 후 7일 이내만 (남은 일수 표시)
 */
import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/instance';
import LoadingSpinner from '../../components/LoadingSpinner';
import type { Order, CartItemOption, Refund } from '../../types';
import { statusMap } from './orderConstants';

const refundStatusMap: Record<string, { label: string; className: string }> = {
  requested: { label: '환불 심사중', className: 'refund-status-requested' },
  approved: { label: '환불 승인', className: 'refund-status-approved' },
  rejected: { label: '환불 거부', className: 'refund-status-rejected' },
};

function PurchasesTab() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [ordersRes, refundsRes] = await Promise.all([
        api.get('/orders'),
        api.get('/refunds'),
      ]);
      setOrders(ordersRes.data);
      setRefunds(refundsRes.data);
    } catch (error) {
      console.error('구매 내역 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const completedOrders = useMemo(
    () => orders.filter(o => ['completed', 'refund_requested', 'refunded'].includes(o.status)),
    [orders]
  );

  const refundMap = useMemo(
    () => new Map(refunds.map(r => [r.order_id, r])),
    [refunds]
  );

  // DB는 UTC 저장 — 공백을 T로 치환 + 'Z' suffix로 ISO 8601 UTC 파싱 보장
  const toUtc = (dateStr: string) => {
    if (dateStr.endsWith('Z')) return new Date(dateStr);
    return new Date(dateStr.replace(' ', 'T') + 'Z');
  };

  const canRequestRefund = (order: Order) => {
    if (order.status !== 'completed') return false;
    if (!order.completed_at) return false;
    const diffDays = (Date.now() - toUtc(order.completed_at).getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 7;
  };

  const getDaysLeft = (order: Order) => {
    if (!order.completed_at) return 0;
    const diffDays = (Date.now() - toUtc(order.completed_at).getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.ceil(7 - diffDays));
  };

  if (loading) return <LoadingSpinner />;

  if (completedOrders.length === 0) {
    return <p className="empty-message">구매 내역이 없습니다.</p>;
  }

  return (
    <div className="order-list">
      {completedOrders.map((order) => {
        const refund = refundMap.get(order.id);

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
