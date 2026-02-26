import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/instance';
import { useAlert } from '../../components/AlertContext';
import './WishlistPage.css';

interface WishlistItem {
  id: number;
  product_id: number;
  name: string;
  price: number;
  image_url: string;
  stock: number;
  category: string;
}

function WishlistPage() {
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlert();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    fetchWishlist();
  }, []);

  const fetchWishlist = async () => {
    try {
      const response = await api.get('/wishlist');
      setItems(response.data);
    } catch (error) {
      console.error('찜 목록 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (productId: number) => {
    if (!(await showConfirm('찜 목록에서 삭제하시겠습니까?'))) return;
    try {
      await api.delete(`/wishlist/${productId}`);
      setItems(items.filter(item => item.product_id !== productId));
      showAlert('찜 목록에서 삭제되었습니다.', 'success');
    } catch {
      showAlert('삭제에 실패했습니다.', 'error');
    }
  };

  if (loading) return <div className="loading">로딩 중...</div>;

  return (
    <div className="wishlist-page">
      <div className="container">
        <h2 className="wishlist-title">찜 목록</h2>

        {items.length === 0 ? (
          <div className="wishlist-empty">
            <p>찜한 상품이 없습니다.</p>
            <Link to="/" className="go-shopping-btn">쇼핑하러 가기</Link>
          </div>
        ) : (
          <div className="wishlist-grid">
            {items.map((item) => (
              <div key={item.id} className={`wishlist-card ${item.stock <= 0 ? 'sold-out' : ''}`}>
                <Link to={`/products/${item.product_id}`} className="wishlist-card-link">
                  <div className="wishlist-image">
                    <img src={item.image_url} alt={item.name} />
                    {item.stock <= 0 && (
                      <div className="sold-out-overlay">
                        <span>Sold Out</span>
                      </div>
                    )}
                  </div>
                  <div className="wishlist-info">
                    <h4>{item.name}</h4>
                    <p className="wishlist-category">{item.category}</p>
                    <p className="wishlist-price">{item.price.toLocaleString()}원</p>
                  </div>
                </Link>
                <button
                  className="wishlist-remove-btn"
                  onClick={() => handleRemove(item.product_id)}
                >
                  ♥ 찜 해제
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default WishlistPage;
