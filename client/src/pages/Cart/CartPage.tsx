import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/instance';
import { useAlert } from '../../components/AlertContext';
import './CartPage.css';

interface CartItemOption {
  option_value_id: number;
  option_name: string;
  value: string;
  extra_price: number;
}

interface CartItem {
  id: number;
  product_id: number;
  quantity: number;
  is_selected: boolean;
  name: string;
  price: number;
  image_url: string;
  stock: number;
  options?: CartItemOption[];
}

function CartPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlert();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      showAlert('로그인이 필요합니다.', 'warning');
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

  const handleToggleSelect = async (id: number) => {
    try {
      await api.put(`/cart/${id}/select`);
      setCartItems(cartItems.map(item =>
        item.id === id ? { ...item, is_selected: !item.is_selected } : item
      ));
    } catch (error) {
      console.error('선택 변경 실패:', error);
    }
  };

  const handleToggleSelectAll = async () => {
    const allSelected = cartItems.every(item => item.is_selected);
    try {
      await api.put('/cart/select-all', { is_selected: !allSelected });
      setCartItems(cartItems.map(item => ({ ...item, is_selected: !allSelected })));
    } catch (error) {
      console.error('전체 선택 변경 실패:', error);
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
    if (!(await showConfirm('이 상품을 장바구니에서 삭제할까요?'))) return;
    try {
      await api.delete(`/cart/${id}`);
      setCartItems(cartItems.filter(item => item.id !== id));
    } catch (error) {
      console.error('삭제 실패:', error);
    }
  };

  const getItemExtraPrice = (item: CartItem) =>
    item.options?.reduce((sum, o) => sum + o.extra_price, 0) || 0;

  const selectedItems = cartItems.filter(item => item.is_selected);
  const totalPrice = selectedItems.reduce((sum, item) => sum + (item.price + getItemExtraPrice(item)) * item.quantity, 0);
  const allSelected = cartItems.length > 0 && cartItems.every(item => item.is_selected);

  if (loading) {
    return <div className="loading"><div className="spinner" />로딩 중...</div>;
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
            <div className="cart-select-all">
              <label>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleToggleSelectAll}
                />
                전체 선택
              </label>
            </div>

            <div className="cart-items">
              {cartItems.map(item => (
                <div key={item.id} className={`cart-item ${!item.is_selected ? 'cart-item-unselected' : ''}`}>
                  <input
                    type="checkbox"
                    className="cart-item-checkbox"
                    checked={item.is_selected}
                    onChange={() => handleToggleSelect(item.id)}
                  />

                  <Link to={`/products/${item.product_id}`} className="cart-item-image">
                    <img src={item.image_url} alt={item.name} />
                  </Link>

                  <div className="cart-item-info">
                    <Link to={`/products/${item.product_id}`} className="cart-item-name">
                      {item.name}
                    </Link>
                    {item.options && item.options.length > 0 && (
                      <p className="cart-item-options">
                        {item.options.map(o => `${o.option_name}: ${o.value}${o.extra_price > 0 ? ` (+${o.extra_price.toLocaleString()}원)` : ''}`).join(' / ')}
                      </p>
                    )}
                    <p className="cart-item-price">{(item.price + getItemExtraPrice(item)).toLocaleString()}원</p>
                  </div>

                  <div className="cart-item-quantity">
                    <button onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)} disabled={item.quantity <= 1}>-</button>
                    <span>{item.quantity}</span>
                    <button onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)} disabled={item.quantity >= item.stock}>+</button>
                  </div>

                  <div className="cart-item-subtotal">
                    {((item.price + getItemExtraPrice(item)) * item.quantity).toLocaleString()}원
                  </div>

                  <button className="cart-item-remove" onClick={() => handleRemove(item.id)}>
                    삭제
                  </button>
                </div>
              ))}
            </div>

            <div className="cart-summary">
              <div className="cart-summary-row">
                <span>선택 상품 수</span>
                <span>{selectedItems.reduce((sum, item) => sum + item.quantity, 0)}개</span>
              </div>
              <div className="cart-summary-total">
                <span>총 결제 금액</span>
                <strong>{totalPrice.toLocaleString()}원</strong>
              </div>
              <button
                className="checkout-btn"
                onClick={() => navigate('/checkout')}
                disabled={selectedItems.length === 0}
              >
                {selectedItems.length === 0 ? '상품을 선택해주세요' : '구매하기'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default CartPage;
