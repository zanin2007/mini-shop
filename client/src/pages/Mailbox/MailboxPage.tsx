/**
 * 우편함 페이지
 * - 우편 목록 (이벤트 보상/쿠폰 지급), 읽음 처리, 전체 삭제
 * - 보상 수령: 쿠폰 또는 포인트 수령 (만료/수령완료 상태 구분)
 * - 상태 표시: 수령완료(초록), 만료(회색), 안읽음(액센트), 읽음(보더)
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import api from '../../api/instance';
import { useAlert } from '../../components/useAlert';
import LoadingSpinner from '../../components/LoadingSpinner';
import './MailboxPage.css';

interface Mail {
  id: number;
  type: string;
  title: string;
  content: string | null;
  reward_type: string | null;
  reward_amount: number | null;
  is_read: boolean;
  is_claimed: boolean;
  claimed_at: string | null;
  expires_at: string | null;
  created_at: string;
}

function MailboxPage() {
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlert();
  const [mails, setMails] = useState<Mail[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMails = useCallback(async () => {
    try {
      const response = await api.get('/mailbox');
      setMails(response.data);
    } catch (error) {
      console.error('우편함 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      showConfirm('로그인 권한이 필요합니다. 로그인하시겠습니까?').then(ok => {
        if (ok) navigate('/login');
        else navigate(-1);
      });
      return;
    }
    fetchMails();
  }, [navigate, showConfirm, fetchMails]);

  const handleRead = async (id: number) => {
    try {
      await api.put(`/mailbox/${id}/read`);
      setMails(prev => prev.map(m => m.id === id ? { ...m, is_read: true } : m));
    } catch (error) {
      console.error('읽음 처리 실패:', error);
    }
  };

  const handleClaim = async (mail: Mail) => {
    if (mail.is_claimed) {
      showAlert('이미 수령한 보상입니다.', 'warning');
      return;
    }
    if (mail.expires_at && new Date(mail.expires_at) < new Date()) {
      showAlert('만료된 우편입니다.', 'error');
      return;
    }
    try {
      const response = await api.post(`/mailbox/${mail.id}/claim`);
      showAlert(response.data.message, 'success');
      setMails(prev => prev.map(m => m.id === mail.id ? { ...m, is_claimed: true, is_read: true, claimed_at: new Date().toISOString() } : m));
    } catch (error) {
      if (error instanceof AxiosError) {
        showAlert(error.response?.data?.message || '보상 수령에 실패했습니다.', 'error');
      }
    }
  };

  const handleDelete = async (id: number) => {
    if (!(await showConfirm('이 우편을 삭제하시겠습니까?'))) return;
    try {
      await api.delete(`/mailbox/${id}`);
      setMails(prev => prev.filter(m => m.id !== id));
    } catch (error) {
      console.error('우편 삭제 실패:', error);
      showAlert('삭제에 실패했습니다.', 'error');
    }
  };

  const handleDeleteAll = async () => {
    if (!(await showConfirm('모든 우편을 삭제하시겠습니까?'))) return;
    try {
      await api.delete('/mailbox/all');
      setMails([]);
      showAlert('전체 우편이 삭제되었습니다.', 'success');
    } catch (error) {
      console.error('전체 삭제 실패:', error);
    }
  };

  const getRewardLabel = (mail: Mail) => {
    if (!mail.reward_type) return null;
    switch (mail.reward_type) {
      case 'coupon': return '쿠폰';
      case 'point': return `${mail.reward_amount?.toLocaleString()}P`;
      case 'item': return '아이템';
      default: return '보상';
    }
  };

  const isExpired = (mail: Mail) => {
    return mail.expires_at && new Date(mail.expires_at) < new Date();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="mailbox-page">
      <div className="mailbox-container">
        <div className="mailbox-header">
          <div className="mailbox-header-left">
            <button className="back-btn" onClick={() => navigate(-1)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg> 뒤로</button>
            <h2>우편함</h2>
          </div>
          {mails.length > 0 && (
            <button className="delete-all-btn" onClick={handleDeleteAll}>전체 삭제</button>
          )}
        </div>

        {mails.length === 0 ? (
          <p className="empty-message">우편함이 비어있습니다.</p>
        ) : (
          <div className="mail-list">
            {mails.map(mail => (
              <div
                key={mail.id}
                className={`mail-card ${!mail.is_read ? 'unread' : ''} ${mail.is_claimed ? 'claimed' : ''} ${isExpired(mail) ? 'expired' : ''}`}
                onClick={() => !mail.is_read && handleRead(mail.id)}
              >
                <div className={`mail-status ${mail.is_claimed ? 'claimed' : isExpired(mail) ? 'expired' : !mail.is_read ? 'unread' : 'read'}`} />
                <div className="mail-body">
                  <div className="mail-title">
                    {!mail.is_read && <span className="unread-dot" />}
                    {mail.title}
                  </div>
                  {mail.content && <div className="mail-content">{mail.content}</div>}
                  <div className="mail-meta">
                    <span className="mail-date">{new Date(mail.created_at).toLocaleDateString('ko-KR')}</span>
                    {mail.expires_at && (
                      <span className={`mail-expiry ${isExpired(mail) ? 'expired-text' : ''}`}>
                        {isExpired(mail) ? '만료됨' : `${new Date(mail.expires_at).toLocaleDateString('ko-KR')} 까지`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mail-actions">
                  {mail.reward_type && (
                    <button
                      className={`claim-btn ${mail.is_claimed ? 'claimed' : ''} ${isExpired(mail) ? 'disabled' : ''}`}
                      onClick={(e) => { e.stopPropagation(); handleClaim(mail); }}
                      disabled={mail.is_claimed || !!isExpired(mail)}
                    >
                      {mail.is_claimed ? '수령완료' : isExpired(mail) ? '만료' : `${getRewardLabel(mail)} 수령`}
                    </button>
                  )}
                  <button className="delete-btn" onClick={(e) => { e.stopPropagation(); handleDelete(mail.id); }}>
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MailboxPage;
