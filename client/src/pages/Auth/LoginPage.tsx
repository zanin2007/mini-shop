import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { AxiosError } from 'axios';
import api from '../../api/instance';
import { useAlert } from '../../components/useAlert';
import './AuthPages.css';

function LoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { showAlert } = useAlert();

  useEffect(() => {
    if (localStorage.getItem('token')) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await api.post('/auth/login', {
        email: formData.email.trim(),
        password: formData.password,
      });

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));

      showAlert('로그인 성공!', 'success');
      window.dispatchEvent(new Event('userUpdated'));
      const params = new URLSearchParams(location.search);
      const redirect = params.get('redirect') || '/';
      const safeRedirect = redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/';
      navigate(safeRedirect, { replace: true });
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.message || '로그인에 실패했습니다.');
      } else {
        setError('로그인에 실패했습니다.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>로그인</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="login-email">이메일</label>
            <input
              id="login-email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="example@email.com"
            />
          </div>
          <div className="form-group">
            <label htmlFor="login-password">비밀번호</label>
            <input
              id="login-password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="비밀번호"
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="submit-btn" disabled={submitting}>
            {submitting ? '로그인 중...' : '로그인'}
          </button>
        </form>
        <p className="auth-link">
          계정이 없으신가요? <Link to="/signup">회원가입</Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
