import { Link } from 'react-router-dom';
import type { Product } from '../../types';

interface Props {
  products: Product[];
}

function RecommendedProducts({ products }: Props) {
  if (products.length === 0) return null;

  return (
    <div className="recommended-section">
      <h3>이런 상품은 어떠세요?</h3>
      <div className="recommended-grid">
        {products.map((p) => (
          <Link to={`/products/${p.id}`} key={p.id} className="recommended-card">
            <div className="recommended-image">
              <img src={p.image_url} alt={p.name} />
              {p.stock <= 0 && <div className="recommended-soldout">Sold Out</div>}
            </div>
            <div className="recommended-info">
              <span className="recommended-name">{p.name}</span>
              <span className="recommended-price">{p.price.toLocaleString()}원</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default RecommendedProducts;
