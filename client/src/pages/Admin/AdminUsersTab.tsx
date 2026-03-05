/**
 * 관리자 회원 관리 탭
 * - 활동 유저 목록: 리뷰/환불/제재 이력 있는 유저 (경고 누적, 정지 상태 표시)
 * - 제재 이력 모달: 특정 유저의 경고/정지 이력 조회
 * - 경고/정지 부여: warning, 7일, 30일, 영구 (3회 경고 시 자동 7일 정지)
 * - 제재 해제
 */
import { Fragment, useCallback, useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import api from '../../api/instance';
import { useAlert } from '../../components/useAlert';
import LoadingSpinner from '../../components/LoadingSpinner';

interface UserActivity {
  id: number;
  nickname: string;
  email: string;
  review_count: number;
  refund_count: number;
  warning_count: number;
  suspension_type: string | null;
  suspended_until: string | null;
}

interface Penalty {
  id: number;
  user_id: number;
  type: string;
  reason: string;
  admin_nickname: string;
  suspended_until: string | null;
  is_active: boolean;
  created_at: string;
}

const typeLabels: Record<string, string> = {
  warning: '경고',
  '7day': '7일 정지',
  '30day': '30일 정지',
  permanent: '영구 정지',
};

function AdminUsersTab() {
  const { showAlert, showConfirm } = useAlert();
  const [users, setUsers] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [penaltyForm, setPenaltyForm] = useState<{ type: string; reason: string }>({ type: 'warning', reason: '' });

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get('/admin/users-activity');
      setUsers(res.data);
    } catch {
      showAlert('사용자 목록을 불러오지 못했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const toggleHistory = async (userId: number) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
      return;
    }
    try {
      const res = await api.get(`/admin/users/${userId}/penalties`);
      setPenalties(res.data);
      setExpandedUser(userId);
      setPenaltyForm({ type: 'warning', reason: '' });
    } catch {
      showAlert('제재 이력을 불러오지 못했습니다.', 'error');
    }
  };

  const handleIssue = async (userId: number) => {
    if (!penaltyForm.reason.trim()) {
      showAlert('사유를 입력해주세요.', 'error');
      return;
    }
    if (!(await showConfirm(`${typeLabels[penaltyForm.type]}를 부여하시겠습니까?`))) return;
    try {
      const res = await api.post(`/admin/users/${userId}/penalties`, penaltyForm);
      showAlert(res.data.message, 'success');
      setPenaltyForm({ type: 'warning', reason: '' });
      fetchUsers();
      // 이력 새로고침
      const histRes = await api.get(`/admin/users/${userId}/penalties`);
      setPenalties(histRes.data);
    } catch (error) {
      if (error instanceof AxiosError) {
        showAlert(error.response?.data?.message || '처리에 실패했습니다.', 'error');
      }
    }
  };

  const handleRevoke = async (penaltyId: number, userId: number) => {
    if (!(await showConfirm('제재를 해제하시겠습니까?'))) return;
    try {
      await api.put(`/admin/penalties/${penaltyId}/revoke`);
      showAlert('제재가 해제되었습니다.', 'success');
      fetchUsers();
      const res = await api.get(`/admin/users/${userId}/penalties`);
      setPenalties(res.data);
    } catch (error) {
      if (error instanceof AxiosError) {
        showAlert(error.response?.data?.message || '처리에 실패했습니다.', 'error');
      }
    }
  };

  if (loading) return <LoadingSpinner />;
  if (users.length === 0) return <p className="empty-msg">대상 사용자가 없습니다.</p>;

  return (
    <div className="admin-users">
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>사용자</th>
              <th>리뷰</th>
              <th>환불</th>
              <th>경고</th>
              <th>정지 상태</th>
              <th>제재</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <Fragment key={user.id}>
                <tr>
                  <td>
                    <div className="order-customer">
                      <span>{user.nickname}</span>
                      <small>{user.email}</small>
                    </div>
                  </td>
                  <td>{user.review_count}건</td>
                  <td>{user.refund_count}건</td>
                  <td>
                    <span className={`penalty-warning-count ${user.warning_count >= 3 ? 'danger' : ''}`}>
                      {user.warning_count}회
                    </span>
                  </td>
                  <td>
                    {user.suspension_type ? (
                      <span className="penalty-status suspended">
                        {typeLabels[user.suspension_type]}
                        {user.suspended_until && (
                          <> (~{new Date(user.suspended_until).toLocaleDateString('ko-KR')})</>
                        )}
                      </span>
                    ) : (
                      <span className="penalty-status normal">정상</span>
                    )}
                  </td>
                  <td>
                    <button className="penalty-history-btn" onClick={() => toggleHistory(user.id)}>
                      {expandedUser === user.id ? '접기' : '이력/제재'}
                    </button>
                  </td>
                </tr>
                {expandedUser === user.id && (
                  <tr key={`${user.id}-detail`} className="penalty-detail-row">
                    <td colSpan={6}>
                      <div className="penalty-detail">
                        <div className="penalty-issue-form">
                          <h4>제재 부여 - {user.nickname}</h4>
                          <div className="penalty-form-row">
                            <select
                              value={penaltyForm.type}
                              onChange={e => setPenaltyForm({ ...penaltyForm, type: e.target.value })}
                            >
                              <option value="warning">경고</option>
                              <option value="7day">7일 정지</option>
                              <option value="30day">30일 정지</option>
                              <option value="permanent">영구 정지</option>
                            </select>
                            <input
                              type="text"
                              placeholder="사유 입력"
                              value={penaltyForm.reason}
                              onChange={e => setPenaltyForm({ ...penaltyForm, reason: e.target.value })}
                            />
                            <button className="penalty-issue-btn" onClick={() => handleIssue(user.id)}>부여</button>
                          </div>
                        </div>
                        {penalties.length > 0 ? (
                          <div className="penalty-history">
                            <h4>제재 이력</h4>
                            <ul className="penalty-list">
                              {penalties.map(p => (
                                <li key={p.id} className={`penalty-item ${p.is_active ? 'active' : 'inactive'}`}>
                                  <div className="penalty-item-header">
                                    <span className={`penalty-type-badge ${p.type}`}>{typeLabels[p.type]}</span>
                                    <span className="penalty-date">
                                      {new Date(p.created_at).toLocaleDateString('ko-KR')}
                                    </span>
                                    {p.suspended_until && (
                                      <span className="penalty-until">
                                        ~{new Date(p.suspended_until).toLocaleDateString('ko-KR')}
                                      </span>
                                    )}
                                    <span className={`penalty-active-badge ${p.is_active ? 'active' : ''}`}>
                                      {p.is_active ? '활성' : '해제됨'}
                                    </span>
                                  </div>
                                  <p className="penalty-reason">{p.reason}</p>
                                  <span className="penalty-admin">처리: {p.admin_nickname}</span>
                                  {p.is_active && (
                                    <button className="penalty-revoke-btn" onClick={() => handleRevoke(p.id, user.id)}>
                                      해제
                                    </button>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <p className="empty-msg">제재 이력이 없습니다.</p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminUsersTab;
