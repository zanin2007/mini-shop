import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/instance';
import type { Product } from '../types';
import './ProductDetailPage.css';

function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      const response = await api.get(`/products/${id}`);
      setProduct(response.data);
    } catch (error) {
      console.error('상품 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('로그인이 필요합니다.');
      navigate('/login');
      return;
    }

    try {
      await api.post('/cart', { productId: product?.id, quantity });
      if (confirm('장바구니에 담았습니다. 장바구니로 이동할까요?')) {
        navigate('/cart');
      }
    } catch (error) {
      console.error('장바구니 담기 실패:', error);
      alert('장바구니 담기에 실패했습니다.');
    }
  };

  if (loading) {
    return <div className="loading">로딩 중...</div>;
  }

  if (!product) {
    return <div className="loading">상품을 찾을 수 없습니다.</div>;
  }

  return (
    <div className="detail-page">
      <div className="detail-container">
        <button className="back-btn" onClick={() => navigate(-1)}>
          ← 뒤로가기
        </button>

        <div className="detail-content">
          <div className="detail-image">
            <img src={product.image_url} alt={product.name} />
          </div>

          <div className="detail-info">
            <span className="detail-category">{product.category}</span>
            <h2 className="detail-name">{product.name}</h2>
            <p className="detail-price">{product.price.toLocaleString()}원</p>
            <p className="detail-description">{product.description}</p>

            <div className="detail-stock">
              재고: {product.stock > 0 ? `${product.stock}개` : '품절'}
            </div>

            <div className="quantity-selector">
              <span className="quantity-label">수량</span>
              <div className="quantity-controls">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  -
                </button>
                <span className="quantity-value">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  disabled={quantity >= product.stock}
                >
                  +
                </button>
              </div>
            </div>

            <div className="detail-total">
              총 금액: <strong>{(product.price * quantity).toLocaleString()}원</strong>
            </div>

            <button
              className="add-to-cart-btn"
              onClick={handleAddToCart}
              disabled={product.stock === 0}
            >
              {product.stock === 0 ? '품절' : '장바구니 담기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductDetailPage;
