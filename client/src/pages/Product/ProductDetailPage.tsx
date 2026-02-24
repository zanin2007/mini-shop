import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/instance';
import { useAlert } from '../../components/AlertContext';
import type { Product, Review, ProductOption } from '../../types';
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
  const [reviewForm, setReviewForm] = useState({ rating: 5, content: '' });
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number>>({}); // optionId -> valueId

  useEffect(() => {
    fetchProduct();
    fetchReviews();
    checkCanReview();
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

    // 옵션이 있는 상품인데 모든 옵션을 선택하지 않은 경우
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

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewForm.content.trim()) {
      showAlert('리뷰 내용을 입력해주세요.', 'warning');
      return;
    }
    try {
      await api.post('/reviews', {
        productId: Number(id),
        rating: reviewForm.rating,
        content: reviewForm.content,
      });
      showAlert('리뷰가 등록되었습니다.', 'success');
      setShowReviewForm(false);
      setReviewForm({ rating: 5, content: '' });
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

  const renderStars = (rating: number) => {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  };

  if (loading) {
    return <div className="loading">로딩 중...</div>;
  }

  if (!product) {
    return <div className="loading">상품을 찾을 수 없습니다.</div>;
  }

  // 선택한 옵션들의 추가 금액 합산
  const extraPrice = product?.options?.reduce((sum, opt) => {
    const selectedValueId = selectedOptions[opt.id];
    if (!selectedValueId) return sum;
    const val = opt.values.find(v => v.id === selectedValueId);
    return sum + (val?.extra_price || 0);
  }, 0) || 0;

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;

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

            {/* 옵션 선택 */}
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

            <button
              className="add-to-cart-btn"
              onClick={handleAddToCart}
              disabled={product.stock === 0}
            >
              {product.stock === 0 ? '품절' : '장바구니 담기'}
            </button>

            {isOwner && (
              <button className="delete-product-btn" onClick={handleDelete}>
                상품 삭제
              </button>
            )}
          </div>
        </div>

        {/* 리뷰 섹션 */}
        <div className="review-section">
          <div className="review-header">
            <h3>
              리뷰 {reviews.length > 0 && <span className="review-count">({reviews.length})</span>}
            </h3>
            {avgRating && (
              <span className="review-avg">
                <span className="stars">{renderStars(Math.round(Number(avgRating)))}</span>
                {avgRating}
              </span>
            )}
          </div>

          {canReview && !showReviewForm && (
            <button className="write-review-btn" onClick={() => setShowReviewForm(true)}>
              리뷰 작성하기
            </button>
          )}

          {showReviewForm && (
            <form className="review-form" onSubmit={handleSubmitReview}>
              <div className="rating-select">
                <span>별점</span>
                <div className="rating-stars">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`star-btn ${star <= reviewForm.rating ? 'active' : ''}`}
                      onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                placeholder="리뷰를 작성해주세요..."
                value={reviewForm.content}
                onChange={(e) => setReviewForm({ ...reviewForm, content: e.target.value })}
                rows={3}
              />
              <div className="review-form-actions">
                <button type="button" onClick={() => setShowReviewForm(false)}>취소</button>
                <button type="submit">등록</button>
              </div>
            </form>
          )}

          {reviews.length === 0 ? (
            <p className="no-reviews">아직 리뷰가 없습니다.</p>
          ) : (
            <div className="review-list">
              {reviews.map((review) => (
                <div key={review.id} className="review-item">
                  <div className="review-item-header">
                    <span className="review-author">{review.nickname || review.user?.nickname}</span>
                    <span className="review-stars">{renderStars(review.rating)}</span>
                    <span className="review-date">
                      {new Date(review.created_at).toLocaleDateString('ko-KR')}
                    </span>
                    {currentUser && review.user_id === currentUser.id && (
                      <button className="review-delete-btn" onClick={() => handleDeleteReview(review.id)}>
                        삭제
                      </button>
                    )}
                  </div>
                  <p className="review-content">{review.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProductDetailPage;
