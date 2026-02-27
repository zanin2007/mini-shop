import { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import api from '../../api/instance';
import { useAlert } from '../../components/AlertContext';

interface AdminEvent {
  id: number;
  title: string;
  description: string;
  type: string;
  reward_type: string | null;
  reward_id: number | null;
  reward_amount: number | null;
  max_participants: number | null;
  current_participants: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

function AdminEventsTab() {
  const { showAlert, showConfirm } = useAlert();
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventForm, setEventForm] = useState({
    title: '', description: '', type: 'fcfs',
    reward_type: 'coupon', reward_id: '', reward_amount: '',
    max_participants: '', start_date: '', end_date: ''
  });
  const [drawCount, setDrawCount] = useState<Record<number, string>>({});

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await api.get('/admin/events');
      setEvents(res.data);
    } catch (error) {
      console.error('이벤트 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/admin/events', {
        ...eventForm,
        reward_id: Number(eventForm.reward_id) || null,
        reward_amount: Number(eventForm.reward_amount) || null,
        max_participants: Number(eventForm.max_participants) || null,
      });
      showAlert('이벤트가 생성되었습니다.', 'success');
      setEventForm({ title: '', description: '', type: 'fcfs', reward_type: 'coupon', reward_id: '', reward_amount: '', max_participants: '', start_date: '', end_date: '' });
      fetchEvents();
    } catch (error) {
      if (error instanceof AxiosError) {
        showAlert(error.response?.data?.message || '이벤트 생성에 실패했습니다.', 'error');
      }
    }
  };

  const handleDelete = async (id: number) => {
    if (!(await showConfirm('이 이벤트를 삭제하시겠습니까?'))) return;
    try {
      await api.delete(`/admin/events/${id}`);
      setEvents(prev => prev.filter(ev => ev.id !== id));
    } catch (error) {
      console.error('이벤트 삭제 실패:', error);
    }
  };

  const handleDraw = async (eventId: number, count: number) => {
    if (!(await showConfirm(`${count}명을 추첨하시겠습니까?`))) return;
    try {
      const res = await api.post(`/admin/events/${eventId}/draw`, { winner_count: count });
      showAlert(res.data.message, 'success');
      fetchEvents();
    } catch (error) {
      if (error instanceof AxiosError) {
        showAlert(error.response?.data?.message || '추첨에 실패했습니다.', 'error');
      }
    }
  };

  if (loading) return <div className="loading"><div className="spinner" />불러오는 중...</div>;

  return (
    <>
      <form className="coupon-create-form" onSubmit={handleSubmit}>
        <h4>이벤트 생성</h4>
        <div className="coupon-form-grid">
          <input
            placeholder="이벤트 제목"
            value={eventForm.title}
            onChange={e => setEventForm({ ...eventForm, title: e.target.value })}
            required
          />
          <select
            value={eventForm.type}
            onChange={e => setEventForm({ ...eventForm, type: e.target.value })}
          >
            <option value="fcfs">선착순</option>
            <option value="random">랜덤 추첨</option>
          </select>
          <select
            value={eventForm.reward_type}
            onChange={e => setEventForm({ ...eventForm, reward_type: e.target.value })}
          >
            <option value="coupon">쿠폰</option>
            <option value="point">포인트</option>
          </select>
          <input
            type="number"
            placeholder="보상 ID (쿠폰 ID)"
            value={eventForm.reward_id}
            onChange={e => setEventForm({ ...eventForm, reward_id: e.target.value })}
          />
          <input
            type="number"
            placeholder="보상 수량/금액"
            value={eventForm.reward_amount}
            onChange={e => setEventForm({ ...eventForm, reward_amount: e.target.value })}
          />
          <input
            type="number"
            placeholder="최대 참여 인원"
            value={eventForm.max_participants}
            onChange={e => setEventForm({ ...eventForm, max_participants: e.target.value })}
          />
          <input
            type="datetime-local"
            value={eventForm.start_date}
            onChange={e => setEventForm({ ...eventForm, start_date: e.target.value })}
            required
          />
          <input
            type="datetime-local"
            value={eventForm.end_date}
            onChange={e => setEventForm({ ...eventForm, end_date: e.target.value })}
            required
          />
        </div>
        <textarea
          className="event-desc-input"
          placeholder="이벤트 설명"
          value={eventForm.description}
          onChange={e => setEventForm({ ...eventForm, description: e.target.value })}
          rows={3}
        />
        <button type="submit" className="coupon-create-btn">이벤트 생성</button>
      </form>

      {events.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>제목</th>
                <th>유형</th>
                <th>보상</th>
                <th>참여</th>
                <th>기간</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {events.map(ev => (
                <tr key={ev.id}>
                  <td>{ev.title}</td>
                  <td>
                    <span className={`event-type-badge type-${ev.type}`}>
                      {ev.type === 'fcfs' ? '선착순' : '추첨'}
                    </span>
                  </td>
                  <td>{ev.reward_type || '-'}</td>
                  <td>{ev.current_participants}{ev.max_participants ? `/${ev.max_participants}` : ''}명</td>
                  <td>
                    <small>
                      {new Date(ev.start_date).toLocaleDateString('ko-KR')} ~ {new Date(ev.end_date).toLocaleDateString('ko-KR')}
                    </small>
                  </td>
                  <td>
                    <div className="event-actions">
                      {ev.type === 'random' && (
                        <div className="draw-controls">
                          <input
                            type="number"
                            min="1"
                            placeholder="인원"
                            value={drawCount[ev.id] || ''}
                            onChange={e => setDrawCount({ ...drawCount, [ev.id]: e.target.value })}
                            className="draw-input"
                          />
                          <button className="admin-draw-btn" onClick={() => handleDraw(ev.id, Number(drawCount[ev.id]) || 1)}>
                            추첨
                          </button>
                        </div>
                      )}
                      <button className="admin-delete-btn" onClick={() => handleDelete(ev.id)}>
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default AdminEventsTab;
