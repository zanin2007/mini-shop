import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/instance';
import { useAlert } from '../../components/AlertContext';
import type { Product, Review } from '../../types';
import ReviewSection from './ReviewSection';
import RecommendedProducts from './RecommendedProducts';
import './ProductDetailPage.css';

function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlert();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [canReview, setCanReview] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number>>({});
  const [wishlisted, setWishlisted] = useState(false);
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
  const reviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([fetchProduct(), fetchReviews(), checkCanReview(), checkWishlisted()]);
  }, [id]);

  const fetchProduct = async () => {
    try {
      const response = await api.get(`/products/${id}`);
      const prod = response.data;
      setProduct(prod);
      if (prod.category) {
        const recRes = await api.get(`/products?category=${encodeURIComponent(prod.category)}`);
        setRecommendedProducts(recRes.data.filter((p: Product) => p.id !== prod.id).slice(0, 4));
      }
    } catch (error) {
      console.error('상품 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      const response = await api.get(`/reviews/product/${id}`);
      setReviews(response.data);
    } catch (error) {
      console.error('리뷰 조회 실패:', error);
    }
  };

  const checkCanReview = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await api.get(`/reviews/check/${id}`);
      setCanReview(response.data.purchased && !response.data.reviewed);
    } catch {
      setCanReview(false);
    }
  };

  const checkWishlisted = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await api.get(`/wishlist/check/${id}`);
      setWishlisted(response.data.wishlisted);
    } catch {
      setWishlisted(false);
    }
  };

  const handleToggleWishlist = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      showAlert('로그인이 필요합니다.', 'warning');
      navigate('/login');
      return;
    }
    const wasWishlisted = wishlisted;
    setWishlisted(!wasWishlisted);
    try {
      if (wasWishlisted) {
        await api.delete(`/wishlist/${product?.id}`);
      } else {
        await api.post('/wishlist', { productId: product?.id });
      }
    } catch {
      setWishlisted(wasWishlisted);
      showAlert('처리에 실패했습니다.', 'error');
    }
  };

  const currentUser = (() => {
    const data = localStorage.getItem('user');
    return data ? JSON.parse(data) : null;
  })();

  const isOwner = currentUser && product?.user_id === currentUser.id;

  const handleDelete = async () => {
    if (!(await showConfirm('정말 이 상품을 삭제하시겠습니까?'))) return;
    try {
      await api.delete(`/products/${id}`);
      showAlert('상품이 삭제되었습니다.', 'success');
      navigate('/');
    } catch (error) {
      console.error('상품 삭제 실패:', error);
      showAlert('삭제에 실패했습니다.', 'error');
    }
  };

  const handleAddToCart = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      showAlert('로그인이 필요합니다.', 'warning');
      navigate('/login');
      return;
    }
    if (product?.options && product.options.length > 0) {
      const unselected = product.options.filter(opt => !selectedOptions[opt.id]);
      if (unselected.length > 0) {
        showAlert(`${unselected[0].option_name}을(를) 선택해주세요.`, 'warning');
        return;
      }
    }
    const optionsPayload = product?.options?.length
      ? Object.entries(selectedOptions).map(([optionId, valueId]) => ({
          optionId: Number(optionId),
          valueId,
        }))
      : undefined;
    try {
      await api.post('/cart', { productId: product?.id, quantity, selectedOptions: optionsPayload });
      if (await showConfirm('장바구니에 담았습니다. 장바구니로 이동할까요?')) {
        navigate('/cart');
      }
    } catch (error) {
      console.error('장바구니 담기 실패:', error);
      showAlert('장바구니 담기에 실패했습니다.', 'error');
    }
  };

  const handleSubmitReview = async (rating: number, content: string) => {
    if (!content.trim()) {
      showAlert('리뷰 내용을 입력해주세요.', 'warning');
      return;
    }
    try {
      await api.post('/reviews', { productId: Number(id), rating, content });
      showAlert('리뷰가 등록되었습니다.', 'success');
      setCanReview(false);
      fetchReviews();
    } catch (error) {
      console.error('리뷰 등록 실패:', error);
      showAlert('리뷰 등록에 실패했습니다.', 'error');
    }
  };

  const handleDeleteReview = async (reviewId: number) => {
    if (!(await showConfirm('리뷰를 삭제하시겠습니까?'))) return;
    try {
      await api.delete(`/reviews/${reviewId}`);
      fetchReviews();
      setCanReview(true);
    } catch (error) {
      console.error('리뷰 삭제 실패:', error);
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner" />로딩 중...</div>;
  }

  if (!product) {
    return <div className="loading">상품을 찾을 수 없습니다.</div>;
  }

  const extraPrice = product?.options?.reduce((sum, opt) => {
    const selectedValueId = selectedOptions[opt.id];
    if (!selectedValueId) return sum;
    const val = opt.values.find(v => v.id === selectedValueId);
    return sum + (val?.extra_price || 0);
  }, 0) || 0;

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

            {product.options && product.options.length > 0 && (
              <div className="option-selectors">
                {product.options.map((option) => (
                  <div key={option.id} className="option-selector">
                    <label>{option.option_name}</label>
                    <select
                      value={selectedOptions[option.id] || ''}
                      onChange={(e) => setSelectedOptions({
                        ...selectedOptions,
                        [option.id]: Number(e.target.value),
                      })}
                    >
                      <option value="">선택해주세요</option>
                      {option.values.map((val) => (
                        <option key={val.id} value={val.id}>
                          {val.value}
                          {val.extra_price > 0 ? ` (+${val.extra_price.toLocaleString()}원)` : ''}
                          {val.stock <= 0 ? ' (품절)' : val.stock <= 5 ? ` (${val.stock}개 남음)` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

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
              총 금액: <strong>{((product.price + extraPrice) * quantity).toLocaleString()}원</strong>
              {extraPrice > 0 && (
                <span className="extra-price-note">
                  (옵션 추가금액 +{extraPrice.toLocaleString()}원 포함)
                </span>
              )}
            </div>

            <div className="detail-actions">
              <button
                className="add-to-cart-btn"
                onClick={handleAddToCart}
                disabled={product.stock === 0}
              >
                {product.stock === 0 ? '품절' : '장바구니 담기'}
              </button>
              <button
                className={`wishlist-btn ${wishlisted ? 'active' : ''}`}
                onClick={handleToggleWishlist}
                title={wishlisted ? '찜 해제' : '찜하기'}
              >
                {wishlisted ? '♥' : '♡'}
              </button>
              {reviews.length > 0 && (
                <button
                  className="review-scroll-btn"
                  onClick={() => reviewRef.current?.scrollIntoView({ behavior: 'smooth' })}
                >
                  리뷰 보기 ({reviews.length})
                </button>
              )}
            </div>

            {isOwner && (
              <button className="delete-product-btn" onClick={handleDelete}>
                상품 삭제
              </button>
            )}
          </div>
        </div>

        <RecommendedProducts products={recommendedProducts} />

        <ReviewSection
          ref={reviewRef}
          reviews={reviews}
          canReview={canReview}
          currentUserId={currentUser?.id || null}
          onSubmitReview={handleSubmitReview}
          onDeleteReview={handleDeleteReview}
        />
      </div>
    </div>
  );
}

export default ProductDetailPage;
