import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AxiosError } from 'axios';
import api from '../../api/instance';
import './AuthPages.css';

function LoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem('token')) {
      navigate('/', { replace: true });
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const response = await api.post('/auth/login', formData);

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));

      alert('로그인 성공!');
      window.location.href = '/'; // 페이지 새로고침으로 레이아웃 업데이트
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.message || '로그인에 실패했습니다.');
      }
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>로그인</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>이메일</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="example@email.com"
            />
          </div>
          <div className="form-group">
            <label>비밀번호</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="비밀번호"
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="submit-btn">
            로그인
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
