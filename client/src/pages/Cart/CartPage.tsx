import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/instance';
import './CartPage.css';

interface CartItem {
  id: number;
  product_id: number;
  quantity: number;
  name: string;
  price: number;
  image_url: string;
  stock: number;
}

function CartPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('로그인이 필요합니다.');
      navigate('/login');
      return;
    }
    fetchCart();
  }, []);

  const fetchCart = async () => {
    try {
      const response = await api.get('/cart');
      setCartItems(response.data);
    } catch (error) {
      console.error('장바구니 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateQuantity = async (id: number, quantity: number) => {
    if (quantity < 1) return;
    try {
      await api.put(`/cart/${id}`, { quantity });
      setCartItems(cartItems.map(item =>
        item.id === id ? { ...item, quantity } : item
      ));
    } catch (error) {
      console.error('수량 변경 실패:', error);
    }
  };

  const handleRemove = async (id: number) => {
    if (!confirm('이 상품을 장바구니에서 삭제할까요?')) return;
    try {
      await api.delete(`/cart/${id}`);
      setCartItems(cartItems.filter(item => item.id !== id));
    } catch (error) {
      console.error('삭제 실패:', error);
    }
  };

  const totalPrice = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (loading) {
    return <div className="loading">로딩 중...</div>;
  }

  return (
    <div className="cart-page">
      <div className="cart-container">
        <h2 className="cart-title">장바구니</h2>

        {cartItems.length === 0 ? (
          <div className="cart-empty">
            <p>장바구니가 비어있습니다.</p>
            <Link to="/" className="go-shopping-btn">쇼핑하러 가기</Link>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {cartItems.map(item => (
                <div key={item.id} className="cart-item">
                  <Link to={`/products/${item.product_id}`} className="cart-item-image">
                    <img src={item.image_url} alt={item.name} />
                  </Link>

                  <div className="cart-item-info">
                    <Link to={`/products/${item.product_id}`} className="cart-item-name">
                      {item.name}
                    </Link>
                    <p className="cart-item-price">{item.price.toLocaleString()}원</p>
                  </div>

                  <div className="cart-item-quantity">
                    <button onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)} disabled={item.quantity <= 1}>-</button>
                    <span>{item.quantity}</span>
                    <button onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)} disabled={item.quantity >= item.stock}>+</button>
                  </div>

                  <div className="cart-item-subtotal">
                    {(item.price * item.quantity).toLocaleString()}원
                  </div>

                  <button className="cart-item-remove" onClick={() => handleRemove(item.id)}>
                    삭제
                  </button>
                </div>
              ))}
            </div>

            <div className="cart-summary">
              <div className="cart-summary-row">
                <span>총 상품 수</span>
                <span>{cartItems.reduce((sum, item) => sum + item.quantity, 0)}개</span>
              </div>
              <div className="cart-summary-total">
                <span>총 결제 금액</span>
                <strong>{totalPrice.toLocaleString()}원</strong>
              </div>
              <button className="checkout-btn" onClick={() => navigate('/checkout')}>
                구매하기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default CartPage;
