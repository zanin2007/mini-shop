import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/instance';
import type { Product } from '../types';
import './MainPage.css';

function MainPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await api.get('/products');
      setProducts(response.data);
    } catch (error) {
      console.error('상품 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">로딩 중...</div>;
  }

  return (
    <div className="main-page">
      <div className="container">
        <section className="hero">
          <h2>간단하고 빠른 쇼핑 경험</h2>
          <p>최신 의류 상품을 만나보세요</p>
        </section>

        <section className="products-section">
          <h3>전체 상품</h3>
          <div className="products-grid">
            {products.map((product) => (
              <Link
                to={`/products/${product.id}`}
                key={product.id}
                className="product-card"
              >
                <div className="product-image">
                  <img src={product.image_url} alt={product.name} />
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
        </section>
      </div>
    </div>
  );
}

export default MainPage;
