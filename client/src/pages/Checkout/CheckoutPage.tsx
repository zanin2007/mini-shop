import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/instance';
import './CheckoutPage.css';

interface CartItem {
  id: number;
  product_id: number;
  quantity: number;
  name: string;
  price: number;
  image_url: string;
}

function CheckoutPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
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
      if (response.data.length === 0) {
        alert('장바구니가 비어있습니다.');
        navigate('/cart');
        return;
      }
      setCartItems(response.data);
    } catch (error) {
      console.error('장바구니 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalPrice = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleOrder = async () => {
    if (!confirm('주문을 진행하시겠습니까?')) return;

    setOrdering(true);
    try {
      await api.post('/orders');
      alert('주문이 완료되었습니다!');
      navigate('/mypage');
    } catch (error) {
      console.error('주문 실패:', error);
      alert('주문에 실패했습니다.');
    } finally {
      setOrdering(false);
    }
  };

  if (loading) {
    return <div className="loading">로딩 중...</div>;
  }

  return (
    <div className="checkout-page">
      <div className="checkout-container">
        <h2 className="checkout-title">주문 확인</h2>

        <div className="checkout-section">
          <h3>주문 상품</h3>
          <div className="checkout-items">
            {cartItems.map(item => (
              <div key={item.id} className="checkout-item">
                <div className="checkout-item-image">
                  <img src={item.image_url} alt={item.name} />
                </div>
                <div className="checkout-item-info">
                  <p className="checkout-item-name">{item.name}</p>
                  <p className="checkout-item-detail">
                    {item.price.toLocaleString()}원 x {item.quantity}개
                  </p>
                </div>
                <div className="checkout-item-subtotal">
                  {(item.price * item.quantity).toLocaleString()}원
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="checkout-payment">
          <h3>결제 정보</h3>
          <div className="payment-row">
            <span>상품 금액</span>
            <span>{totalPrice.toLocaleString()}원</span>
          </div>
          <div className="payment-row">
            <span>배송비</span>
            <span>무료</span>
          </div>
          <div className="payment-total">
            <span>총 결제 금액</span>
            <strong>{totalPrice.toLocaleString()}원</strong>
          </div>

          <button
            className="order-btn"
            onClick={handleOrder}
            disabled={ordering}
          >
            {ordering ? '주문 처리 중...' : `${totalPrice.toLocaleString()}원 결제하기`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CheckoutPage;
