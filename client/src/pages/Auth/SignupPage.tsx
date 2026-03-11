import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AxiosError } from 'axios';
import api from '../../api/instance';
import { useAlert } from '../../components/useAlert';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { FieldError } from '../../components/ui/field-error';
import './AuthPages.css';

function SignupPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nickname: '',
  });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
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
    const errs: Record<string, string> = {};
    if (!formData.email.trim()) errs.email = '이메일을 입력하세요.';
    if (!formData.nickname.trim()) errs.nickname = '닉네임을 입력하세요.';
    if (!formData.password) {
      errs.password = '비밀번호를 입력하세요.';
    } else if (formData.password.length < 6) {
      errs.password = '비밀번호는 6자 이상이어야 합니다.';
    }
    if (!formData.confirmPassword) {
      errs.confirmPassword = '비밀번호 확인을 입력하세요.';
    } else if (formData.password !== formData.confirmPassword) {
      errs.confirmPassword = '비밀번호가 일치하지 않습니다.';
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      await api.post('/auth/signup', {
        email: formData.email.trim(),
        password: formData.password,
        nickname: formData.nickname.trim(),
      });

      showAlert('회원가입이 완료되었습니다!', 'success');
      navigate('/login');
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.message || '회원가입에 실패했습니다.');
      } else {
        setError('회원가입에 실패했습니다.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>회원가입</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="signup-email">이메일</label>
            <input
              id="signup-email"
              type="email"
              name="email"
              className={fieldErrors.email ? 'has-error' : ''}
              value={formData.email}
              onChange={handleChange}
              placeholder="example@email.com"
            />
            <FieldError>{fieldErrors.email}</FieldError>
          </div>
          <div className="form-group">
            <label htmlFor="signup-nickname">닉네임</label>
            <input
              id="signup-nickname"
              type="text"
              name="nickname"
              className={fieldErrors.nickname ? 'has-error' : ''}
              value={formData.nickname}
              onChange={handleChange}
              placeholder="닉네임"
            />
            <FieldError>{fieldErrors.nickname}</FieldError>
          </div>
          <div className="form-group">
            <label htmlFor="signup-password">비밀번호</label>
            <input
              id="signup-password"
              type="password"
              name="password"
              className={fieldErrors.password ? 'has-error' : ''}
              value={formData.password}
              onChange={handleChange}
              placeholder="6자 이상"
            />
            <FieldError>{fieldErrors.password}</FieldError>
          </div>
          <div className="form-group">
            <label htmlFor="signup-confirm-password">비밀번호 확인</label>
            <input
              id="signup-confirm-password"
              type="password"
              name="confirmPassword"
              className={fieldErrors.confirmPassword ? 'has-error' : ''}
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="비밀번호 확인"
            />
            <FieldError>{fieldErrors.confirmPassword}</FieldError>
          </div>
          {error && <div className="error-message">{error}</div>}
          <Button type="submit" className="submit-btn" disabled={submitting}>
            {submitting && <Spinner className="size-4" />}
            {submitting ? '가입 중' : '회원가입'}
          </Button>
        </form>
        <p className="auth-link">
          이미 계정이 있으신가요? <Link to="/login">로그인</Link>
        </p>
      </div>
    </div>
  );
}

export default SignupPage;
