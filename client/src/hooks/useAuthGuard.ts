import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlert } from '../components/useAlert';

/**
 * 인증 가드 훅 — 토큰이 없으면 로그인 확인 후 리다이렉트
 * @returns authenticated가 true일 때만 페이지 데이터를 fetch하면 됨
 */
export function useAuthGuard() {
  const navigate = useNavigate();
  const { showConfirm } = useAlert();
  const [authenticated] = useState(() => !!localStorage.getItem('token'));

  useEffect(() => {
    if (authenticated) return;
    showConfirm('로그인 권한이 필요합니다. 로그인하시겠습니까?').then(ok => {
      if (ok) navigate('/login');
      else navigate(-1);
    });
  }, [authenticated, navigate, showConfirm]);

  return authenticated;
}
