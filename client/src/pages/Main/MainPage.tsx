import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/instance';
import { useAlert } from '../../components/AlertContext';
import type { Product } from '../../types';
import './MainPage.css';

function MainPage() {
  const navigate = useNavigate();
  const { showAlert } = useAlert();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [wishlistIds, setWishlistIds] = useState<number[]>([]);

  useEffect(() => {
    fetchCategories();
    fetchProducts();
    fetchWishlistIds();
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
      showAlert('로그인이 필요합니다.', 'warning');
      navigate('/login');
      return;
    }
    try {
      if (wishlistIds.includes(productId)) {
        await api.delete(`/wishlist/${productId}`);
        setWishlistIds(wishlistIds.filter(id => id !== productId));
      } else {
        await api.post('/wishlist', { productId });
        setWishlistIds([...wishlistIds, productId]);
      }
    } catch {
      showAlert('처리에 실패했습니다.', 'error');
    }
  };

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category);
    fetchProducts(search, category);
  };

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
            <div className="loading">로딩 중...</div>
          ) : products.length === 0 ? (
            <div className="empty-products">검색 결과가 없습니다.</div>
          ) : (
            <div className="products-grid">
              {products.map((product) => (
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
          )}
        </section>
      </div>
    </div>
  );
}

export default MainPage;
