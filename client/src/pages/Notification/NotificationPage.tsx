/**
 * 알림 페이지
 * - 알림 목록 (읽음/안읽음), 전체 읽음/전체 삭제
 * - 이벤트 알림: link에 "event:{id}" 형태로 이벤트 ID 저장 → 참여 버튼 표시
 * - 참여 상태: /events/my-participations로 영구 유지 (만료 이벤트도 참여완료 표시)
 * - 알림 상세 모달: 카드 클릭 시 확대 보기
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import api from '../../api/instance';
import { useAlert } from '../../components/useAlert';
import LoadingSpinner from '../../components/LoadingSpinner';
import './NotificationPage.css';

interface Notification {
  id: number;
  type: string;
  title: string;
  content: string | null;
  link: string | null;
  is_read: boolean;
  is_pinned: boolean;
  created_at: string;
}

const typeIcons: Record<string, string> = {
  order: '📦',
  review: '⭐',
  coupon: '🎟️',
  gift: '🎁',
  system: '📢',
};

function NotificationPage() {
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlert();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [participatedEvents, setParticipatedEvents] = useState<Set<number>>(new Set());
  const [selectedNotif, setSelectedNotif] = useState<Notification | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await api.get('/notifications');
      // 상단 고정 알림이 항상 최상단에 오도록 정렬
      const sorted = [...response.data].sort((a: Notification, b: Notification) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setNotifications(sorted);
    } catch (error) {
      console.error('알림 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEventParticipation = useCallback(async () => {
    try {
      const response = await api.get('/events/my-participations');
      setParticipatedEvents(new Set<number>(response.data));
    } catch {
      // 이벤트 조회 실패해도 알림은 정상 표시
    }
  }, []);

  // F-H2: ESC 키로 모달 닫기
  useEffect(() => {
    if (!selectedNotif) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedNotif(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [selectedNotif]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      showConfirm('로그인 권한이 필요합니다. 로그인하시겠습니까?').then(ok => {
        if (ok) navigate('/login');
        else navigate(-1);
      });
      return;
    }
    fetchNotifications();
    fetchEventParticipation();
  }, [navigate, showConfirm, fetchNotifications, fetchEventParticipation]);

  const handleRead = async (id: number) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (error) {
      console.error('읽음 처리 실패:', error);
    }
  };

  const handleReadAll = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      showAlert('전체 읽음 처리되었습니다.', 'success');
    } catch (error) {
      console.error('전체 읽음 처리 실패:', error);
    }
  };

  const handleDeleteAll = async () => {
    if (!(await showConfirm('모든 알림을 삭제하시겠습니까? (상단 고정 공지는 유지됩니다)'))) return;
    try {
      await api.delete('/notifications/all');
      // 고정 알림은 서버에서도 삭제되지 않으므로 로컬에서도 유지 (읽음 처리)
      setNotifications(prev => prev.filter(n => n.is_pinned).map(n => ({ ...n, is_read: true })));
      showAlert('전체 알림이 삭제되었습니다.', 'success');
    } catch (error) {
      console.error('전체 삭제 실패:', error);
    }
  };

  const handleParticipate = async (eventId: number) => {
    try {
      await api.post(`/events/${eventId}/participate`);
      setParticipatedEvents(prev => new Set([...prev, eventId]));
      showAlert('이벤트에 참여했습니다!', 'success');
    } catch (error) {
      if (error instanceof AxiosError) {
        showAlert(error.response?.data?.message || '참여에 실패했습니다.', 'error');
      }
    }
  };

  const handleCardClick = (notif: Notification) => {
    if (!notif.is_read) handleRead(notif.id);
    setSelectedNotif(notif);
  };

  const getEventIdFromLink = (link: string | null): number | null => {
    if (!link || !link.startsWith('event:')) return null;
    const id = parseInt(link.split(':')[1], 10);
    return isNaN(id) ? null : id;
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    return date.toLocaleDateString('ko-KR');
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="notification-page">
      <div className="notification-container">
        <div className="notification-header">
          <div className="notification-header-left">
            <button className="back-btn" onClick={() => navigate(-1)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg> 뒤로</button>
            <h2>알림</h2>
            {unreadCount > 0 && <span className="unread-count">{unreadCount}개 안읽음</span>}
          </div>
          <div className="notification-header-actions">
            {unreadCount > 0 && (
              <button className="read-all-btn" onClick={handleReadAll}>전체 읽음</button>
            )}
            {notifications.length > 0 && (
              <button className="delete-all-btn" onClick={handleDeleteAll}>전체 삭제</button>
            )}
          </div>
        </div>

        {notifications.length === 0 ? (
          <p className="empty-message">알림이 없습니다.</p>
        ) : (
          <div className="notification-list">
            {notifications.map(notif => {
              const eventId = getEventIdFromLink(notif.link);
              const isParticipated = eventId !== null && participatedEvents.has(eventId);

              return (
                <div
                  key={notif.id}
                  className={`notification-card ${!notif.is_read ? 'unread' : ''} ${notif.is_pinned ? 'pinned' : ''}`}
                  onClick={() => handleCardClick(notif)}
                >
                  <div className="notif-icon">
                    {notif.is_pinned ? '📌' : (typeIcons[notif.type] || '🔔')}
                  </div>
                  <div className="notif-body">
                    <div className="notif-title">
                      {!notif.is_read && <span className="unread-dot" />}
                      {notif.title}
                    </div>
                    {notif.content && <div className="notif-content">{notif.content}</div>}
                    <div className="notif-time">{formatTime(notif.created_at)}</div>
                  </div>
                  {eventId !== null && (
                    <button
                      className={`event-participate-btn ${isParticipated ? 'participated' : ''}`}
                      disabled={isParticipated}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isParticipated) handleParticipate(eventId);
                      }}
                    >
                      {isParticipated ? '참여 완료' : '참여하기'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 알림 상세 모달 */}
      {selectedNotif && (
        <div className="notif-modal-overlay" onClick={() => setSelectedNotif(null)}>
          <div className="notif-modal" onClick={e => e.stopPropagation()}>
            <div className="notif-modal-header">
              <span className="notif-modal-icon">
                {selectedNotif.is_pinned ? '📌' : (typeIcons[selectedNotif.type] || '🔔')}
              </span>
              <h3>{selectedNotif.title}</h3>
              <button className="notif-modal-close" onClick={() => setSelectedNotif(null)}>×</button>
            </div>
            <div className="notif-modal-body">
              {selectedNotif.content ? (
                <p className="notif-modal-content">{selectedNotif.content}</p>
              ) : (
                <p className="notif-modal-empty">추가 내용이 없습니다.</p>
              )}
            </div>
            <div className="notif-modal-footer">
              <span className="notif-modal-time">
                {new Date(selectedNotif.created_at).toLocaleString('ko-KR')}
              </span>
              {(() => {
                const eventId = getEventIdFromLink(selectedNotif.link);
                if (eventId === null) return null;
                const isParticipated = participatedEvents.has(eventId);
                return (
                  <button
                    className={`event-participate-btn ${isParticipated ? 'participated' : ''}`}
                    disabled={isParticipated}
                    onClick={() => { if (!isParticipated) handleParticipate(eventId); }}
                  >
                    {isParticipated ? '참여 완료' : '참여하기'}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationPage;
