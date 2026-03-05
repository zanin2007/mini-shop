import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/instance';
import { useAlert } from '../../components/useAlert';
import LoadingSpinner from '../../components/LoadingSpinner';
import QuantityInput from '../../components/QuantityInput';
import type { CartPageItem } from '../../types';
import './CartPage.css';

function CartPage() {
  const [cartItems, setCartPageItems] = useState<CartPageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectingIds, setSelectingIds] = useState<Set<number>>(new Set());
  const navigate = useNavigate();
  const { showConfirm, showAlert } = useAlert();

  const fetchCart = useCallback(async () => {
    try {
      const response = await api.get('/cart');
      setCartPageItems(response.data);
    } catch (error) {
      console.error('장바구니 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      showConfirm('로그인 권한이 필요합니다. 로그인하시겠습니까?').then(ok => {
        if (ok) navigate('/login');
        else navigate(-1);
      });
      return;
    }
    fetchCart();
  }, [navigate, showConfirm, fetchCart]);

  const handleToggleSelect = async (id: number) => {
    if (selectingIds.has(id)) return;
    setSelectingIds(prev => new Set(prev).add(id));
    try {
      await api.put(`/cart/${id}/select`);
      setCartPageItems(prev => prev.map(item =>
        item.id === id ? { ...item, is_selected: !item.is_selected } : item
      ));
    } catch (error) {
      console.error('선택 변경 실패:', error);
      showAlert('선택 변경에 실패했습니다.', 'error');
    } finally {
      setSelectingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleToggleSelectAll = async () => {
    const allSelected = cartItems.every(item => item.is_selected);
    try {
      await api.put('/cart/select-all', { is_selected: !allSelected });
      setCartPageItems(prev => prev.map(item => ({ ...item, is_selected: !allSelected })));
      window.dispatchEvent(new Event('cartUpdated'));
    } catch (error) {
      console.error('전체 선택 변경 실패:', error);
    }
  };

  const getMaxStock = (item: CartPageItem) => {
    if (!item.options || item.options.length === 0) return item.stock;
    const minOptionStock = Math.min(...item.options.map(o => o.option_stock ?? item.stock));
    return Math.min(item.stock, minOptionStock);
  };

  const qtyTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const handleUpdateQuantity = useCallback((id: number, quantity: number) => {
    const item = cartItems.find(i => i.id === id);
    if (!item || quantity < 1 || quantity > getMaxStock(item)) return;

    // 즉시 UI 반영 (낙관적 업데이트)
    setCartPageItems(prev => prev.map(i =>
      i.id === id ? { ...i, quantity } : i
    ));

    // API 호출 디바운스 (300ms)
    const prev = qtyTimers.current.get(id);
    if (prev) clearTimeout(prev);
    qtyTimers.current.set(id, setTimeout(async () => {
      qtyTimers.current.delete(id);
      try {
        await api.put(`/cart/${id}`, { quantity });
      } catch {
        showAlert('수량 변경에 실패했습니다.', 'error');
        fetchCart();
      }
    }, 300));
  }, [cartItems, showAlert, fetchCart]);

  const handleRemove = async (id: number) => {
    if (!(await showConfirm('이 상품을 장바구니에서 삭제할까요?'))) return;
    try {
      await api.delete(`/cart/${id}`);
      setCartPageItems(prev => prev.filter(item => item.id !== id));
      window.dispatchEvent(new Event('cartUpdated'));
    } catch (error) {
      console.error('삭제 실패:', error);
    }
  };

  const getItemExtraPrice = (item: CartPageItem) =>
    item.options?.reduce((sum, o) => sum + o.extra_price, 0) || 0;

  const selectedItems = cartItems.filter(item => item.is_selected);
  const totalPrice = selectedItems.reduce((sum, item) => sum + (item.price + getItemExtraPrice(item)) * item.quantity, 0);
  const allSelected = cartItems.length > 0 && cartItems.every(item => item.is_selected);

  if (loading) {
    return <LoadingSpinner />;
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
                    disabled={selectingIds.has(item.id)}
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
                    <QuantityInput
                      value={item.quantity}
                      max={getMaxStock(item)}
                      onChange={(qty) => handleUpdateQuantity(item.id, qty)}
                    />
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
