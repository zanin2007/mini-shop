/**
 * 관리자 공지사항 탭
 * - 공지 작성: 상단 고정(is_pinned) 최대 3개 제한, 전체 유저 알림 발송
 * - 공지 목록: 고정(📌)/일반 구분, 등록일 표시
 * - 삭제: 상단 고정 공지 삭제 시 고정 슬롯 해제
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AxiosError } from 'axios';
import api from '../../api/instance';
import { useAlert } from '../../components/useAlert';
import { FieldError } from '../../components/ui/field-error';
import LoadingSpinner from '../../components/LoadingSpinner';

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
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await api.get('/admin/announcements');
      setAnnouncements(res.data);
    } catch (error) {
      console.error('공지 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = '제목을 입력하세요.';
    if (!form.content.trim()) errs.content = '내용을 입력하세요.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    try {
      await api.post('/admin/announcements', form);
      showAlert('공지가 등록되었습니다.', 'success');
      setForm({ title: '', content: '', is_pinned: false });
      setErrors({});
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
      showAlert('삭제에 실패했습니다.', 'error');
    }
  };

  const pinnedCount = useMemo(() => announcements.filter(a => a.is_pinned).length, [announcements]);

  if (loading) return <LoadingSpinner text="불러오는 중..." />;

  return (
    <>
      <form className="coupon-create-form" onSubmit={handleSubmit}>
        <h4>공지 작성</h4>
        <div className="announcement-form">
          <div>
            <input
              placeholder="공지 제목"
              className={errors.title ? 'has-error' : ''}
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />
            <FieldError>{errors.title}</FieldError>
          </div>
          <div>
            <textarea
              placeholder="공지 내용"
              className={errors.content ? 'has-error' : ''}
              value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })}
              rows={4}
            />
            <FieldError>{errors.content}</FieldError>
          </div>
          <label className="pin-label">
            <input
              type="checkbox"
              checked={form.is_pinned}
              onChange={e => setForm({ ...form, is_pinned: e.target.checked })}
              disabled={!form.is_pinned && pinnedCount >= 3}
            />
            상단 고정 ({pinnedCount}/3)
            {pinnedCount >= 3 && !form.is_pinned && (
              <span className="pin-limit-warn"> - 최대 3개 도달, 기존 상단 공지를 삭제해주세요</span>
            )}
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
