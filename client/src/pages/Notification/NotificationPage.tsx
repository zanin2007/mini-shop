import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/instance';
import { useAlert } from '../../components/AlertContext';
import './NotificationPage.css';

interface Notification {
  id: number;
  type: string;
  title: string;
  content: string | null;
  is_read: boolean;
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
  const { showAlert } = useAlert();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data);
    } catch (error) {
      console.error('알림 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRead = async (id: number) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (error) {
      console.error('읽음 처리 실패:', error);
    }
  };

  const handleReadAll = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      showAlert('전체 읽음 처리되었습니다.', 'success');
    } catch (error) {
      console.error('전체 읽음 처리 실패:', error);
    }
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

  if (loading) return <div className="loading">로딩 중...</div>;

  return (
    <div className="notification-page">
      <div className="notification-container">
        <div className="notification-header">
          <div className="notification-header-left">
            <button className="back-btn" onClick={() => navigate(-1)}>← 뒤로</button>
            <h2>🔔 알림</h2>
            {unreadCount > 0 && <span className="unread-count">{unreadCount}개 안읽음</span>}
          </div>
          {unreadCount > 0 && (
            <button className="read-all-btn" onClick={handleReadAll}>전체 읽음</button>
          )}
        </div>

        {notifications.length === 0 ? (
          <p className="empty-message">알림이 없습니다.</p>
        ) : (
          <div className="notification-list">
            {notifications.map(notif => (
              <div
                key={notif.id}
                className={`notification-card ${!notif.is_read ? 'unread' : ''}`}
                onClick={() => !notif.is_read && handleRead(notif.id)}
              >
                <div className="notif-icon">
                  {typeIcons[notif.type] || '📢'}
                </div>
                <div className="notif-body">
                  <div className="notif-title">
                    {!notif.is_read && <span className="unread-dot" />}
                    {notif.title}
                  </div>
                  {notif.content && <div className="notif-content">{notif.content}</div>}
                  <div className="notif-time">{formatTime(notif.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default NotificationPage;
