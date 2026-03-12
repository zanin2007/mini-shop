import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import api from '../../api/instance';
import { useAlert } from '../../components/useAlert';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import QuantityInput from '../../components/QuantityInput';
import type { Product, Review } from '../../types';
import ReviewSection from './ReviewSection';
import RecommendedProducts from './RecommendedProducts';
import './ProductDetailPage.css';

const BackIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
);

const HeartIcon = ({ filled }: { filled: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
);

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
  const [wishlistProcessing, setWishlistProcessing] = useState(false);
  const [cartProcessing, setCartProcessing] = useState(false);
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
  const reviewRef = useRef<HTMLDivElement>(null);

  const fetchProduct = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await api.get(`/products/${id}`, { signal });
      const prod = response.data;
      setProduct(prod);
      setLoading(false);
      // 추천 상품은 메인 로딩과 별도로 비동기 로드
      if (prod.category) {
        api.get(`/products?category=${encodeURIComponent(prod.category)}`, { signal }).then(recRes => {
          setRecommendedProducts(recRes.data.filter((p: Product) => p.id !== prod.id).slice(0, 4));
        }).catch((err) => {
          if (!(err instanceof AxiosError && err.code === 'ERR_CANCELED')) {
            console.error('추천 상품 조회 실패:', err);
          }
        });
      }
    } catch (error) {
      if (error instanceof AxiosError && error.code === 'ERR_CANCELED') return;
      console.error('상품 조회 실패:', error);
      setLoading(false);
    }
  }, [id]);

  const fetchReviews = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await api.get(`/reviews/product/${id}`, { signal });
      setReviews(response.data);
    } catch (error) {
      if (error instanceof AxiosError && error.code === 'ERR_CANCELED') return;
      console.error('리뷰 조회 실패:', error);
    }
  }, [id]);

  const checkCanReview = useCallback(async (signal?: AbortSignal) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await api.get(`/reviews/check/${id}`, { signal });
      setCanReview(response.data.purchased && !response.data.reviewed);
    } catch (error) {
      if (error instanceof AxiosError && error.code === 'ERR_CANCELED') return;
      setCanReview(false);
    }
  }, [id]);

  const checkWishlisted = useCallback(async (signal?: AbortSignal) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await api.get(`/wishlist/check/${id}`, { signal });
      setWishlisted(response.data.wishlisted);
    } catch (error) {
      if (error instanceof AxiosError && error.code === 'ERR_CANCELED') return;
      setWishlisted(false);
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setRecommendedProducts([]);
    setSelectedOptions({});
    setQuantity(1);
    const { signal } = controller;
    Promise.all([fetchProduct(signal), fetchReviews(signal), checkCanReview(signal), checkWishlisted(signal)]);
    return () => controller.abort();
  }, [id, fetchProduct, fetchReviews, checkCanReview, checkWishlisted]);

  const handleToggleWishlist = async () => {
    if (wishlistProcessing || !product?.id) return;
    const token = localStorage.getItem('token');
    if (!token) {
      const ok = await showConfirm('로그인 권한이 필요합니다. 로그인하시겠습니까?');
      if (ok) navigate('/login');
      return;
    }
    setWishlistProcessing(true);
    const wasWishlisted = wishlisted;
    setWishlisted(!wasWishlisted);
    try {
      if (wasWishlisted) {
        await api.delete(`/wishlist/${product?.id}`);
      } else {
        await api.post('/wishlist', { productId: product?.id });
        showAlert('찜 목록에 추가되었습니다.', 'success');
      }
    } catch {
      setWishlisted(wasWishlisted);
      showAlert('처리에 실패했습니다.', 'error');
    } finally {
      setWishlistProcessing(false);
    }
  };

  const [currentUser] = useState(() => {
    try {
      const data = localStorage.getItem('user');
      return data ? JSON.parse(data) : null;
    } catch { return null; }
  });

  const isOwner = currentUser && product?.user_id === currentUser.id;

  const handleDelete = async () => {
    if (!(await showConfirm('정말 이 상품을 삭제하시겠습니까?'))) return;
    try {
      await api.delete(`/admin/products/${id}`);
      showAlert('상품이 삭제되었습니다.', 'success');
      navigate('/');
    } catch (error) {
      console.error('상품 삭제 실패:', error);
      showAlert('삭제에 실패했습니다.', 'error');
    }
  };

  const handleAddToCart = async () => {
    if (cartProcessing) return;
    const token = localStorage.getItem('token');
    if (!token) {
      const ok = await showConfirm('로그인 권한이 필요합니다. 로그인하시겠습니까?');
      if (ok) navigate('/login');
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
    setCartProcessing(true);
    try {
      await api.post('/cart', { productId: product?.id, quantity, selectedOptions: optionsPayload });
      if (await showConfirm('장바구니에 담았습니다. 장바구니로 이동할까요?')) {
        navigate('/cart');
      }
    } catch (error) {
      if (error instanceof AxiosError) {
        showAlert(error.response?.data?.message || '장바구니 담기에 실패했습니다.', 'error');
      } else {
        showAlert('장바구니 담기에 실패했습니다.', 'error');
      }
    } finally {
      setCartProcessing(false);
    }
  };

  const handleSubmitReview = useCallback(async (rating: number, content: string) => {
    if (!content.trim()) {
      showAlert('리뷰 내용을 입력해주세요.', 'warning');
      return;
    }
    try {
      await api.post('/reviews', { productId: Number(id), rating, content });
      showAlert('리뷰가 등록되었습니다.', 'success');
      setCanReview(false);
      await fetchReviews();
    } catch (error) {
      console.error('리뷰 등록 실패:', error);
      showAlert('리뷰 등록에 실패했습니다.', 'error');
    }
  }, [id, showAlert, fetchReviews]);

  const handleDeleteReview = useCallback(async (reviewId: number) => {
    if (!(await showConfirm('리뷰를 삭제하시겠습니까?'))) return;
    try {
      await api.delete(`/reviews/${reviewId}`);
      await fetchReviews();
      setCanReview(true);
    } catch (error) {
      console.error('리뷰 삭제 실패:', error);
      showAlert('리뷰 삭제에 실패했습니다.', 'error');
    }
  }, [showConfirm, showAlert, fetchReviews]);

  const extraPrice = useMemo(() => product?.options?.reduce((sum, opt) => {
    const selectedValueId = selectedOptions[opt.id];
    if (!selectedValueId) return sum;
    const val = opt.values.find(v => v.id === selectedValueId);
    return sum + (val?.extra_price || 0);
  }, 0) || 0, [product, selectedOptions]);

  // 모든 옵션이 선택되어야 정확한 maxQuantity 계산 가능
  const maxQuantity = useMemo(() => {
    if (!product?.options || product.options.length === 0) return product?.stock ?? 0;
    const allSelected = product.options.every(opt => selectedOptions[opt.id]);
    if (!allSelected) return product.stock;
    const selectedStocks = product.options
      .map(opt => {
        const val = opt.values.find(v => v.id === selectedOptions[opt.id]);
        return val?.stock ?? 0;
      });
    return Math.min(product.stock, ...selectedStocks);
  }, [product, selectedOptions]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!product) {
    return <div className="loading">상품을 찾을 수 없습니다.</div>;
  }

  return (
    <div className="detail-page">
      <div className="detail-container">
        <button className="back-btn" onClick={() => navigate(-1)}>
          {BackIcon}
          뒤로가기
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
                      onChange={(e) => {
                        const newOptions = { ...selectedOptions, [option.id]: Number(e.target.value) };
                        setSelectedOptions(newOptions);
                        // 선택된 옵션 재고에 맞게 수량 조정
                        const val = option.values.find(v => v.id === Number(e.target.value));
                        if (val && quantity > val.stock) {
                          setQuantity(Math.max(1, val.stock));
                        }
                      }}
                    >
                      <option value="">선택해주세요</option>
                      {option.values.map((val) => (
                        <option key={val.id} value={val.id} disabled={val.stock <= 0}>
                          {val.value}
                          {val.extra_price > 0 ? ` (+${val.extra_price.toLocaleString()}원)` : ''}
                          {val.stock <= 0 ? ' (품절)' : ` (재고: ${val.stock}개)`}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            <div className="quantity-selector">
              <span className="quantity-label">수량</span>
              <QuantityInput value={quantity} max={maxQuantity} onChange={setQuantity} />
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
              <Button
                className="add-to-cart-btn h-12 text-base"
                onClick={handleAddToCart}
                disabled={product.stock === 0 || cartProcessing}
              >
                {cartProcessing && <Spinner className="size-4" />}
                {product.stock === 0 ? '품절' : cartProcessing ? '담는 중' : '장바구니 담기'}
              </Button>
              <button
                className={`wishlist-btn ${wishlisted ? 'active' : ''}`}
                onClick={handleToggleWishlist}
                title={wishlisted ? '찜 해제' : '찜하기'}
              >
                <HeartIcon filled={wishlisted} />
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
