import { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import api from '../../api/instance';
import { useAlert } from '../../components/AlertContext';

interface AdminAnnouncement {
  id: number;
  admin_id: number;
  title: string;
  content: string;
  is_pinned: boolean;
  is_active: boolean;
  created_at: string;
}

function AdminAnnouncementsTab() {
  const { showAlert, showConfirm } = useAlert();
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', content: '', is_pinned: false });

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const res = await api.get('/admin/announcements');
      setAnnouncements(res.data);
    } catch (error) {
      console.error('공지 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/admin/announcements', form);
      showAlert('공지가 등록되었습니다.', 'success');
      setForm({ title: '', content: '', is_pinned: false });
      fetchAnnouncements();
    } catch (error) {
      if (error instanceof AxiosError) {
        showAlert(error.response?.data?.message || '공지 등록에 실패했습니다.', 'error');
      }
    }
  };

  const handleDelete = async (id: number) => {
    if (!(await showConfirm('이 공지를 삭제하시겠습니까?'))) return;
    try {
      await api.delete(`/admin/announcements/${id}`);
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    } catch (error) {
      console.error('공지 삭제 실패:', error);
    }
  };

  if (loading) return <div className="loading"><div className="spinner" />불러오는 중...</div>;

  return (
    <>
      <form className="coupon-create-form" onSubmit={handleSubmit}>
        <h4>공지 작성</h4>
        <div className="announcement-form">
          <input
            placeholder="공지 제목"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            required
          />
          <textarea
            placeholder="공지 내용"
            value={form.content}
            onChange={e => setForm({ ...form, content: e.target.value })}
            rows={4}
            required
          />
          <label className="pin-label">
            <input
              type="checkbox"
              checked={form.is_pinned}
              onChange={e => setForm({ ...form, is_pinned: e.target.checked })}
            />
            상단 고정
          </label>
        </div>
        <button type="submit" className="coupon-create-btn">공지 등록</button>
      </form>

      {announcements.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>제목</th>
                <th>고정</th>
                <th>등록일</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {announcements.map(ann => (
                <tr key={ann.id}>
                  <td>{ann.title}</td>
                  <td>{ann.is_pinned ? '📌' : '-'}</td>
                  <td>{new Date(ann.created_at).toLocaleDateString('ko-KR')}</td>
                  <td>
                    <button className="admin-delete-btn" onClick={() => handleDelete(ann.id)}>
                      삭제
                    </button>
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

export default AdminAnnouncementsTab;
