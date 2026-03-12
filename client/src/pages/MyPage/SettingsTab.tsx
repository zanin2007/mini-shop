/**
 * 계정 설정 탭
 * - 닉네임 변경: 즉시 반영 (localStorage + 헤더 동기화)
 * - 비밀번호 변경: 현재 비밀번호 확인 후 변경
 * - 회원탈퇴: 비밀번호 재확인 후 삭제 (CASCADE)
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import api from '../../api/instance';
import { useAlert } from '../../components/useAlert';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import type { User } from '../../types';

interface Props {
  user: User | null;
  onUserUpdate: (user: User) => void;
}

function SettingsTab({ user, onUserUpdate }: Props) {
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlert();
  const [newNickname, setNewNickname] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [loading, setLoading] = useState<'nickname' | 'password' | 'delete' | null>(null);

  const handleChangeNickname = async () => {
    const trimmed = newNickname.trim();
    if (!trimmed) {
      showAlert('닉네임을 입력해주세요.', 'warning');
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 20) {
      showAlert('닉네임은 2~20자로 입력해주세요.', 'warning');
      return;
    }
    setLoading('nickname');
    try {
      const res = await api.put('/auth/nickname', { nickname: trimmed });
      showAlert(res.data.message, 'success');
      if (!user) return;
      const updatedUser = { ...user, nickname: res.data.nickname };
      onUserUpdate(updatedUser);
      setNewNickname('');
    } catch (error) {
      if (error instanceof AxiosError) {
        showAlert(error.response?.data?.message || '닉네임 변경에 실패했습니다.', 'error');
      }
    } finally {
      setLoading(null);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      showAlert('현재 비밀번호와 새 비밀번호를 모두 입력해주세요.', 'warning');
      return;
    }
    if (newPassword.length < 6) {
      showAlert('새 비밀번호는 6자 이상이어야 합니다.', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert('새 비밀번호가 일치하지 않습니다.', 'warning');
      return;
    }
    setLoading('password');
    try {
      const res = await api.put('/auth/password', { currentPassword, newPassword });
      showAlert(res.data.message, 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      if (error instanceof AxiosError) {
        showAlert(error.response?.data?.message || '비밀번호 변경에 실패했습니다.', 'error');
      }
    } finally {
      setLoading(null);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      showAlert('비밀번호를 입력해주세요.', 'warning');
      return;
    }
    if (!(await showConfirm('정말로 탈퇴하시겠습니까?\n모든 데이터가 삭제되며 복구할 수 없습니다.'))) return;
    setLoading('delete');
    try {
      await api.delete('/auth/account', { data: { password: deletePassword.trim() } });
      showAlert('회원탈퇴가 완료되었습니다.', 'success');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
    } catch (error) {
      if (error instanceof AxiosError) {
        showAlert(error.response?.data?.message || '회원탈퇴에 실패했습니다.', 'error');
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <div className="settings-block">
        <h4 className="settings-subtitle">닉네임 변경</h4>
        <div className="settings-form">
          <input
            type="text"
            placeholder={user?.nickname || '새 닉네임'}
            value={newNickname}
            onChange={(e) => setNewNickname(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleChangeNickname()}
          />
          <Button onClick={handleChangeNickname} disabled={loading !== null}>
            {loading === 'nickname' && <Spinner className="size-4" />}
            {loading === 'nickname' ? '변경 중' : '변경'}
          </Button>
        </div>
      </div>

      <div className="settings-block">
        <h4 className="settings-subtitle">비밀번호 변경</h4>
        <div className="settings-form vertical">
          <input
            type="password"
            placeholder="현재 비밀번호"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <input
            type="password"
            placeholder="새 비밀번호 (6자 이상)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <input
            type="password"
            placeholder="새 비밀번호 확인"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleChangePassword()}
          />
          <Button onClick={handleChangePassword} disabled={loading !== null}>
            {loading === 'password' && <Spinner className="size-4" />}
            {loading === 'password' ? '변경 중' : '비밀번호 변경'}
          </Button>
        </div>
      </div>

      <div className="settings-block danger">
        <h4 className="settings-subtitle danger">회원탈퇴</h4>
        <p className="settings-warning">탈퇴 시 모든 주문, 쿠폰, 리뷰 등의 데이터가 영구 삭제됩니다.</p>
        <div className="settings-form">
          <input
            type="password"
            placeholder="비밀번호 확인"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleDeleteAccount()}
          />
          <Button className="danger-btn" variant="destructive" onClick={handleDeleteAccount} disabled={loading !== null}>
            {loading === 'delete' && <Spinner className="size-4" />}
            {loading === 'delete' ? '처리 중' : '회원탈퇴'}
          </Button>
        </div>
      </div>
    </>
  );
}

export default SettingsTab;
