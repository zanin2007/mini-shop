import { useEffect, useState, useMemo } from 'react';
import api from '../../api/instance';
import { useAlert } from '../../components/AlertContext';

interface AdminProduct {
  id: number;
  name: string;
  price: number;
  stock: number;
  category: string;
  seller_nickname: string;
  created_at: string;
}

function AdminProductsTab() {
  const { showConfirm } = useAlert();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [productSearch, setProductSearch] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productSort, setProductSort] = useState('newest');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await api.get('/admin/products');
      setProducts(res.data);
    } catch (error) {
      console.error('상품 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!(await showConfirm('정말 이 상품을 삭제하시겠습니까?'))) return;
    try {
      await api.delete(`/admin/products/${id}`);
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('상품 삭제 실패:', error);
    }
  };

  const productCategories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (productSearch) {
      const keyword = productSearch.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(keyword) ||
        (p.seller_nickname && p.seller_nickname.toLowerCase().includes(keyword))
      );
    }

    if (productCategory) {
      result = result.filter(p => p.category === productCategory);
    }

    switch (productSort) {
      case 'newest': result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
      case 'oldest': result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); break;
      case 'price-high': result.sort((a, b) => b.price - a.price); break;
      case 'price-low': result.sort((a, b) => a.price - b.price); break;
      case 'stock-low': result.sort((a, b) => a.stock - b.stock); break;
      case 'name': result.sort((a, b) => a.name.localeCompare(b.name, 'ko')); break;
    }

    return result;
  }, [products, productSearch, productCategory, productSort]);

  if (loading) return <div className="loading"><div className="spinner" />불러오는 중...</div>;

  return (
    <>
      <div className="product-filters">
        <input
          className="filter-input"
          type="text"
          placeholder="상품명 또는 판매자 검색..."
          value={productSearch}
          onChange={e => setProductSearch(e.target.value)}
        />
        <select
          className="filter-select"
          value={productCategory}
          onChange={e => setProductCategory(e.target.value)}
        >
          <option value="">전체 카테고리</option>
          {productCategories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select
          className="filter-select"
          value={productSort}
          onChange={e => setProductSort(e.target.value)}
        >
          <option value="newest">최신순</option>
          <option value="oldest">오래된순</option>
          <option value="price-high">가격 높은순</option>
          <option value="price-low">가격 낮은순</option>
          <option value="stock-low">재고 적은순</option>
          <option value="name">이름순</option>
        </select>
        <span className="product-count">{filteredProducts.length}개 상품</span>
      </div>
      {filteredProducts.length === 0 ? (
        <p className="empty-msg">조건에 맞는 상품이 없습니다.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>상품명</th>
                <th>카테고리</th>
                <th>가격</th>
                <th>재고</th>
                <th>판매자</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(product => (
                <tr key={product.id}>
                  <td>{product.id}</td>
                  <td>{product.name}</td>
                  <td>{product.category || '-'}</td>
                  <td>{product.price.toLocaleString()}원</td>
                  <td className={product.stock === 0 ? 'out-of-stock' : ''}>{product.stock}개</td>
                  <td>{product.seller_nickname || '-'}</td>
                  <td>
                    <button className="admin-delete-btn" onClick={() => handleDelete(product.id)}>
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default AdminProductsTab;
