import { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/instance';
import { useAlert } from '../../components/useAlert';
import LoadingSpinner from '../../components/LoadingSpinner';
import type { Product } from '../../types';
import './MainPage.css';

const ITEMS_PER_PAGE = 8;

function MainPage() {
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlert();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [wishlistIds, setWishlistIds] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const wishlistProcessing = useRef(new Set<number>());

  useEffect(() => {
    void Promise.all([fetchCategories(), fetchProducts(), fetchWishlistIds()]);
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/products/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('카테고리 조회 실패:', error);
    }
  };

  const fetchProducts = async (searchValue = '', category = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchValue) params.append('search', searchValue);
      if (category) params.append('category', category);
      const query = params.toString() ? `?${params.toString()}` : '';
      const response = await api.get(`/products${query}`);
      setProducts(response.data);
    } catch (error) {
      console.error('상품 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchProducts(search, selectedCategory);
  };

  const fetchWishlistIds = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await api.get('/wishlist/ids');
      setWishlistIds(response.data);
    } catch {
      setWishlistIds([]);
    }
  };

  const handleToggleWishlist = async (e: React.MouseEvent, productId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (wishlistProcessing.current.has(productId)) return;
    const token = localStorage.getItem('token');
    if (!token) {
      const ok = await showConfirm('로그인 권한이 필요합니다. 로그인하시겠습니까?');
      if (ok) navigate('/login');
      return;
    }
    wishlistProcessing.current.add(productId);
    const wasWishlisted = wishlistIds.includes(productId);

    // 낙관적 업데이트: 함수형 업데이터로 stale closure 방지
    setWishlistIds(prev => wasWishlisted
      ? prev.filter(id => id !== productId)
      : [...prev, productId]
    );

    try {
      if (wasWishlisted) {
        await api.delete(`/wishlist/${productId}`);
      } else {
        await api.post('/wishlist', { productId });
        showAlert('찜 목록에 추가되었습니다.', 'success');
      }
    } catch {
      // 실패 시 원래 상태로 되돌림
      setWishlistIds(prev => wasWishlisted
        ? [...prev, productId]
        : prev.filter(id => id !== productId)
      );
      showAlert('처리에 실패했습니다.', 'error');
    } finally {
      wishlistProcessing.current.delete(productId);
    }
  };

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1);
    fetchProducts(search, category);
  };

  const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return products.slice(start, start + ITEMS_PER_PAGE);
  }, [products, currentPage]);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    let start = currentPage - 2;
    let end = currentPage + 2;
    if (start < 1) {
      start = 1;
      end = 5;
    }
    if (end > totalPages) {
      end = totalPages;
      start = totalPages - 4;
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [totalPages, currentPage]);

  return (
    <div className="main-page">
      <div className="container">
        <section className="hero">
          <h2>간단하고 빠른 쇼핑 경험</h2>
          <p>최신 의류 상품을 만나보세요</p>
        </section>

        {/* 검색 & 필터 */}
        <section className="search-section">
          <form className="search-bar" onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="상품명 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit">검색</button>
          </form>
          <div className="category-filters">
            <button
              className={`category-btn ${selectedCategory === '' ? 'active' : ''}`}
              onClick={() => handleCategoryClick('')}
            >
              전체
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => handleCategoryClick(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </section>

        <section className="products-section">
          <h3>
            {selectedCategory || '전체'} 상품
            <span className="product-count">{products.length}개</span>
          </h3>
          {loading ? (
            <LoadingSpinner />
          ) : products.length === 0 ? (
            <div className="empty-products">검색 결과가 없습니다.</div>
          ) : (
            <>
              <div className="products-grid">
                {paginatedProducts.map((product) => (
                  <Link
                    to={`/products/${product.id}`}
                    key={product.id}
                    className={`product-card ${product.stock <= 0 ? 'sold-out' : ''}`}
                  >
                    <div className="product-image">
                      <img src={product.image_url} alt={product.name} loading="lazy" />
                      {product.stock <= 0 && (
                        <div className="sold-out-overlay">
                          <span>Sold Out</span>
                        </div>
                      )}
                      <span
                        role="button"
                        tabIndex={0}
                        className={`product-heart ${wishlistIds.includes(product.id) ? 'active' : ''}`}
                        onClick={(e) => handleToggleWishlist(e, product.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggleWishlist(e as unknown as React.MouseEvent, product.id); } }}
                        aria-label={wishlistIds.includes(product.id) ? '찜 해제' : '찜하기'}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill={wishlistIds.includes(product.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                      </span>
                    </div>
                    <div className="product-info">
                      <h4>{product.name}</h4>
                      <p className="product-category">{product.category}</p>
                      <p className="product-price">
                        {product.price.toLocaleString()}원
                      </p>
                    </div>
                  </Link>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage(p => p - 1)}
                    disabled={currentPage === 1}
                  >
                    &lt;
                  </button>
                  {pageNumbers.map(page => (
                    <button
                      key={page}
                      className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage(p => p + 1)}
                    disabled={currentPage === totalPages}
                  >
                    &gt;
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default MainPage;
