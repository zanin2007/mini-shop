import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/instance';
import './ProductRegisterPage.css';

function ProductRegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    image_url: '',
    stock: '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price) {
      alert('상품명과 가격은 필수입니다.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/products', {
        ...form,
        price: Number(form.price),
        stock: Number(form.stock) || 0,
      });
      alert('상품이 등록되었습니다.');
      navigate('/');
    } catch (error) {
      console.error('상품 등록 실패:', error);
      alert('상품 등록에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-container">
        <h2 className="register-title">상품 등록</h2>
        <form onSubmit={handleSubmit} className="register-form">
          <div className="form-group">
            <label>상품명 *</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="상품명을 입력하세요"
            />
          </div>
          <div className="form-group">
            <label>설명</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="상품 설명을 입력하세요"
              rows={4}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>가격 (원) *</label>
              <input
                type="number"
                name="price"
                value={form.price}
                onChange={handleChange}
                placeholder="0"
                min="0"
              />
            </div>
            <div className="form-group">
              <label>재고 수량</label>
              <input
                type="number"
                name="stock"
                value={form.stock}
                onChange={handleChange}
                placeholder="0"
                min="0"
              />
            </div>
          </div>
          <div className="form-group">
            <label>카테고리</label>
            <input
              type="text"
              name="category"
              value={form.category}
              onChange={handleChange}
              placeholder="예: 전자기기, 의류, 식품"
            />
          </div>
          <div className="form-group">
            <label>이미지 URL</label>
            <input
              type="text"
              name="image_url"
              value={form.image_url}
              onChange={handleChange}
              placeholder="https://example.com/image.jpg"
            />
          </div>
          <div className="form-actions">
            <button type="button" className="cancel-btn" onClick={() => navigate(-1)}>
              취소
            </button>
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? '등록 중...' : '상품 등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProductRegisterPage;
