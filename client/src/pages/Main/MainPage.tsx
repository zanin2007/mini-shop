import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/instance';
import { useAlert } from '../../components/AlertContext';
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

  useEffect(() => {
    Promise.all([fetchCategories(), fetchProducts(), fetchWishlistIds()]);
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
    const token = localStorage.getItem('token');
    if (!token) {
      const ok = await showConfirm('로그인 권한이 필요합니다. 로그인하시겠습니까?');
      if (ok) navigate('/login');
      return;
    }
    const wasWishlisted = wishlistIds.includes(productId);

    // 낙관적 업데이트: UI 먼저 반영
    if (wasWishlisted) {
      setWishlistIds(wishlistIds.filter(id => id !== productId));
    } else {
      setWishlistIds([...wishlistIds, productId]);
    }

    try {
      if (wasWishlisted) {
        await api.delete(`/wishlist/${productId}`);
      } else {
        await api.post('/wishlist', { productId });
      }
    } catch {
      // 실패 시 원래 상태로 되돌림
      setWishlistIds(wasWishlisted
        ? [...wishlistIds]
        : wishlistIds.filter(id => id !== productId)
      );
      showAlert('처리에 실패했습니다.', 'error');
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
            <div className="loading"><div className="spinner" />로딩 중...</div>
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
                      <img src={product.image_url} alt={product.name} />
                      {product.stock <= 0 && (
                        <div className="sold-out-overlay">
                          <span>Sold Out</span>
                        </div>
                      )}
                      <button
                        className={`product-heart ${wishlistIds.includes(product.id) ? 'active' : ''}`}
                        onClick={(e) => handleToggleWishlist(e, product.id)}
                      >
                        {wishlistIds.includes(product.id) ? '♥' : '♡'}
                      </button>
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
