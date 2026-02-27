import { useState } from 'react';
import { AxiosError } from 'axios';
import api from '../../api/instance';
import { useAlert } from '../../components/AlertContext';
import type { Gift } from '../../types';

interface Props {
  sentGifts: Gift[];
  receivedGifts: Gift[];
  onGiftAction: () => void;
}

function GiftsTab({ sentGifts, receivedGifts, onGiftAction }: Props) {
  const { showAlert, showConfirm } = useAlert();
  const [giftSubTab, setGiftSubTab] = useState<'received' | 'sent'>('received');

  const handleAcceptGift = async (giftId: number) => {
    if (!(await showConfirm('선물을 수락하시겠습니까?'))) return;
    try {
      await api.put(`/gifts/${giftId}/accept`);
      showAlert('선물을 수락했습니다.', 'success');
      onGiftAction();
    } catch (error) {
      if (error instanceof AxiosError) {
        showAlert(error.response?.data?.message || '처리에 실패했습니다.', 'error');
      }
    }
  };

  const handleRejectGift = async (giftId: number) => {
    if (!(await showConfirm('선물을 거절하시겠습니까?'))) return;
    try {
      await api.put(`/gifts/${giftId}/reject`);
      showAlert('선물을 거절했습니다.', 'success');
      onGiftAction();
    } catch (error) {
      if (error instanceof AxiosError) {
        showAlert(error.response?.data?.message || '처리에 실패했습니다.', 'error');
      }
    }
  };

  return (
    <>
      <div className="gift-sub-tabs">
        <button
          className={`gift-sub-tab ${giftSubTab === 'received' ? 'active' : ''}`}
          onClick={() => setGiftSubTab('received')}
        >
          받은 선물 ({receivedGifts.length})
        </button>
        <button
          className={`gift-sub-tab ${giftSubTab === 'sent' ? 'active' : ''}`}
          onClick={() => setGiftSubTab('sent')}
        >
          보낸 선물 ({sentGifts.length})
        </button>
      </div>

      {giftSubTab === 'received' && (
        receivedGifts.length === 0 ? (
          <p className="empty-message">받은 선물이 없습니다.</p>
        ) : (
          <div className="gift-list">
            {receivedGifts.map(gift => (
              <div key={gift.id} className={`gift-card gift-status-${gift.status}`}>
                <div className="gift-card-header">
                  <span className="gift-sender">{gift.sender_nickname || '알 수 없음'}님의 선물</span>
                  <span className={`gift-status-badge ${gift.status}`}>
                    {gift.status === 'pending' ? '대기중' : gift.status === 'accepted' ? '수락됨' : '거절됨'}
                  </span>
                  <span className="gift-date">{new Date(gift.created_at).toLocaleDateString('ko-KR')}</span>
                </div>
                {gift.message && <p className="gift-message">"{gift.message}"</p>}
                {gift.order_items && gift.order_items.length > 0 && (
                  <ul className="gift-items">
                    {gift.order_items.map((item, i) => (
                      <li key={i}>
                        {item.name} x {item.quantity}개
                      </li>
                    ))}
                  </ul>
                )}
                {gift.status === 'pending' && (
                  <div className="gift-actions">
                    <button className="gift-accept-btn" onClick={() => handleAcceptGift(gift.id)}>수락</button>
                    <button className="gift-reject-btn" onClick={() => handleRejectGift(gift.id)}>거절</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {giftSubTab === 'sent' && (
        sentGifts.length === 0 ? (
          <p className="empty-message">보낸 선물이 없습니다.</p>
        ) : (
          <div className="gift-list">
            {sentGifts.map(gift => (
              <div key={gift.id} className={`gift-card gift-status-${gift.status}`}>
                <div className="gift-card-header">
                  <span className="gift-sender">{gift.receiver_nickname || '알 수 없음'}님에게</span>
                  <span className={`gift-status-badge ${gift.status}`}>
                    {gift.status === 'pending' ? '대기중' : gift.status === 'accepted' ? '수락됨' : '거절됨'}
                  </span>
                  <span className="gift-date">{new Date(gift.created_at).toLocaleDateString('ko-KR')}</span>
                </div>
                {gift.message && <p className="gift-message">"{gift.message}"</p>}
                {gift.order_items && gift.order_items.length > 0 && (
                  <ul className="gift-items">
                    {gift.order_items.map((item, i) => (
                      <li key={i}>
                        {item.name} x {item.quantity}개
                      </li>
                    ))}
                  </ul>
                )}
                <div className="gift-total">
                  {(gift.final_amount || gift.total_amount || 0).toLocaleString()}원
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </>
  );
}

export default GiftsTab;
