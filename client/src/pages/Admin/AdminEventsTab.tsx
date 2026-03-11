/**
 * 관리자 이벤트 탭
 * - 이벤트 생성: 선착순(fcfs)/추첨(draw) 타입, 보상(쿠폰 선택/포인트 금액 입력)
 * - 이벤트 목록: 참여자 수, 기간, 추첨 기능 (draw 타입만)
 * - 삭제
 */
import { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import api from '../../api/instance';
import { useAlert } from '../../components/useAlert';
import { FieldError } from '../../components/ui/field-error';
import LoadingSpinner from '../../components/LoadingSpinner';

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

interface AdminCoupon {
  id: number;
  code: string;
  discount_amount: number;
  discount_percentage: number | null;
  expiry_date: string;
  is_active: boolean;
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
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchEvents();
    fetchCoupons();
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

  const fetchCoupons = async () => {
    try {
      const res = await api.get('/admin/coupons');
      setCoupons(res.data);
    } catch (error) {
      console.error('쿠폰 목록 조회 실패:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!eventForm.title.trim()) errs.title = '이벤트 제목을 입력하세요.';
    if (eventForm.reward_type === 'coupon' && !eventForm.reward_id) errs.reward = '쿠폰을 선택하세요.';
    if (eventForm.reward_type === 'point' && (!eventForm.reward_amount || Number(eventForm.reward_amount) <= 0)) errs.reward = '포인트 금액을 입력하세요.';
    if (!eventForm.start_date) errs.start_date = '시작일을 선택하세요.';
    if (!eventForm.end_date) errs.end_date = '종료일을 선택하세요.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    try {
      await api.post('/admin/events', {
        ...eventForm,
        reward_id: Number(eventForm.reward_id) || null,
        reward_amount: Number(eventForm.reward_amount) || null,
        max_participants: Number(eventForm.max_participants) || null,
      });
      showAlert('이벤트가 생성되었습니다.', 'success');
      setEventForm({ title: '', description: '', type: 'fcfs', reward_type: 'coupon', reward_id: '', reward_amount: '', max_participants: '', start_date: '', end_date: '' });
      setErrors({});
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
      showAlert('삭제에 실패했습니다.', 'error');
    }
  };

  const handleDraw = async (eventId: number, count: number, currentParticipants: number) => {
    if (!Number.isInteger(count) || count < 1) {
      showAlert('추첨 인원은 1명 이상이어야 합니다.', 'warning');
      return;
    }
    if (count > currentParticipants) {
      showAlert(`참가자 수(${currentParticipants}명)보다 많이 추첨할 수 없습니다.`, 'warning');
      return;
    }
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

  if (loading) return <LoadingSpinner text="불러오는 중..." />;

  return (
    <>
      <form className="coupon-create-form" onSubmit={handleSubmit}>
        <h4>이벤트 생성</h4>
        <div className="coupon-form-grid">
          <div className="coupon-field">
            <input
              placeholder="이벤트 제목"
              className={errors.title ? 'has-error' : ''}
              value={eventForm.title}
              onChange={e => setEventForm({ ...eventForm, title: e.target.value })}
            />
            <FieldError>{errors.title}</FieldError>
          </div>
          <select
            value={eventForm.type}
            onChange={e => setEventForm({ ...eventForm, type: e.target.value })}
          >
            <option value="fcfs">선착순</option>
            <option value="random">랜덤 추첨</option>
          </select>
          <select
            value={eventForm.reward_type}
            onChange={e => {
              setEventForm({ ...eventForm, reward_type: e.target.value, reward_id: '', reward_amount: '' });
              setErrors(prev => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== 'reward')));
            }}
          >
            <option value="coupon">쿠폰</option>
            <option value="point">포인트</option>
          </select>
          <div className="coupon-field">
            {eventForm.reward_type === 'coupon' ? (
              <select
                className={errors.reward ? 'has-error' : ''}
                value={eventForm.reward_id}
                onChange={e => setEventForm({ ...eventForm, reward_id: e.target.value })}
              >
                <option value="">쿠폰 선택</option>
                {coupons
                  .filter(c => c.is_active && new Date(c.expiry_date) > new Date())
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      {c.code} ({c.discount_percentage ? `${c.discount_percentage}%` : `${c.discount_amount.toLocaleString()}원`} 할인)
                    </option>
                  ))}
              </select>
            ) : (
              <input
                type="number"
                placeholder="포인트 금액 (필수)"
                className={errors.reward ? 'has-error' : ''}
                value={eventForm.reward_amount}
                onChange={e => setEventForm({ ...eventForm, reward_amount: e.target.value })}
              />
            )}
            <FieldError>{errors.reward}</FieldError>
          </div>
          <input
            type="number"
            placeholder="최대 참여 인원"
            value={eventForm.max_participants}
            onChange={e => setEventForm({ ...eventForm, max_participants: e.target.value })}
          />
          <div className="coupon-field">
            <input
              type="datetime-local"
              className={errors.start_date ? 'has-error' : ''}
              value={eventForm.start_date}
              onChange={e => setEventForm({ ...eventForm, start_date: e.target.value })}
            />
            <FieldError>{errors.start_date}</FieldError>
          </div>
          <div className="coupon-field">
            <input
              type="datetime-local"
              className={errors.end_date ? 'has-error' : ''}
              value={eventForm.end_date}
              onChange={e => setEventForm({ ...eventForm, end_date: e.target.value })}
            />
            <FieldError>{errors.end_date}</FieldError>
          </div>
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
                          <button className="admin-draw-btn" onClick={() => handleDraw(ev.id, Number(drawCount[ev.id]) || 1, ev.current_participants ?? 0)}>
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
