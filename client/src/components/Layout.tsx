import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../api/instance';
import './Layout.css';

interface User {
  id: number;
  email: string;
  nickname: string;
  role?: string;
}

function Layout() {
  const [user, setUser] = useState<User | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const userData = localStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
      fetchCartCount();
    }
  }, []);

  const fetchCartCount = async () => {
    try {
      const response = await api.get('/cart');
      setCartCount(response.data.length);
    } catch {
      setCartCount(0);
    }
  };

  const handleLogout = () => {
    if (!window.confirm('로그아웃 하시겠습니까?')) return;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/');
  };

  return (
    <div className="layout">
      <header className="header">
        <div className="container">
          <Link to="/" className="logo">
            <h1>Mini Shop</h1>
          </Link>
          <nav className="nav">
            {user ? (
              <>
                <span className="user-info">{user.nickname}님</span>
                <Link to="/products/new">상품 등록</Link>
                <Link to="/cart">장바구니{cartCount > 0 && <span className="cart-badge">{cartCount}</span>}</Link>
                <Link to="/mypage">마이페이지</Link>
                {user.role === 'admin' && <Link to="/admin" className="admin-link">관리자</Link>}
                <button onClick={handleLogout} className="logout-btn">
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link to="/login">로그인</Link>
                <Link to="/signup">회원가입</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container">
          <p>&copy; 2025 Mini Shop. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
