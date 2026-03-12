export const statusMap: Record<string, { label: string; className: string }> = {
  checking: { label: '상품확인중', className: 'status-checking' },
  pending: { label: '준비중', className: 'status-pending' },
  shipped: { label: '배송중', className: 'status-shipped' },
  delivered: { label: '배송완료', className: 'status-delivered' },
  completed: { label: '수령완료', className: 'status-completed' },
  refund_requested: { label: '환불신청', className: 'status-refund-requested' },
  refunded: { label: '환불완료', className: 'status-refunded' },
};
