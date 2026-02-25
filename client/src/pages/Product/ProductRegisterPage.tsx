import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/instance';
import { useAlert } from '../../components/AlertContext';
import './ProductRegisterPage.css';

function ProductRegisterPage() {
  const navigate = useNavigate();
  const { showAlert } = useAlert();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData || JSON.parse(userData).role !== 'admin') {
      showAlert('관리자만 접근할 수 있습니다.', 'error');
      navigate('/', { replace: true });
    }
  }, []);

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    image_url: '',
    stock: '',
  });
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<{ option_name: string; values: { value: string; extra_price: string; stock: string }[] }[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price) {
      showAlert('상품명과 가격은 필수입니다.', 'warning');
      return;
    }
    setLoading(true);
    try {
      await api.post('/products', {
        ...form,
        price: Number(form.price),
        stock: Number(form.stock) || 0,
        options: options.filter(o => o.option_name && o.values.length > 0).map(o => ({
          option_name: o.option_name,
          values: o.values.filter(v => v.value).map(v => ({
            value: v.value,
            extra_price: Number(v.extra_price) || 0,
            stock: Number(v.stock) || 0,
          })),
        })),
      });
      showAlert('상품이 등록되었습니다.', 'success');
      navigate('/');
    } catch (error) {
      console.error('상품 등록 실패:', error);
      showAlert('상품 등록에 실패했습니다.', 'error');
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
          {/* 옵션 섹션 */}
          <div className="options-section">
            <div className="options-header">
              <label>상품 옵션</label>
              <button
                type="button"
                className="add-option-btn"
                onClick={() => setOptions([...options, { option_name: '', values: [{ value: '', extra_price: '', stock: '' }] }])}
              >
                + 옵션 그룹 추가
              </button>
            </div>
            {options.map((option, oi) => (
              <div key={oi} className="option-group">
                <div className="option-group-header">
                  <input
                    type="text"
                    placeholder="옵션명 (예: 사이즈, 색상)"
                    value={option.option_name}
                    onChange={(e) => {
                      const updated = [...options];
                      updated[oi].option_name = e.target.value;
                      setOptions(updated);
                    }}
                  />
                  <button
                    type="button"
                    className="remove-btn"
                    onClick={() => setOptions(options.filter((_, i) => i !== oi))}
                  >
                    삭제
                  </button>
                </div>
                {option.values.map((val, vi) => (
                  <div key={vi} className="option-value-row">
                    <input
                      type="text"
                      placeholder="값 (예: S, M, L)"
                      value={val.value}
                      onChange={(e) => {
                        const updated = [...options];
                        updated[oi].values[vi].value = e.target.value;
                        setOptions(updated);
                      }}
                    />
                    <input
                      type="number"
                      placeholder="추가금액"
                      value={val.extra_price}
                      onChange={(e) => {
                        const updated = [...options];
                        updated[oi].values[vi].extra_price = e.target.value;
                        setOptions(updated);
                      }}
                    />
                    <input
                      type="number"
                      placeholder="재고"
                      value={val.stock}
                      onChange={(e) => {
                        const updated = [...options];
                        updated[oi].values[vi].stock = e.target.value;
                        setOptions(updated);
                      }}
                    />
                    <button
                      type="button"
                      className="remove-btn small"
                      onClick={() => {
                        const updated = [...options];
                        updated[oi].values = updated[oi].values.filter((_, i) => i !== vi);
                        setOptions(updated);
                      }}
                    >
                      X
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="add-value-btn"
                  onClick={() => {
                    const updated = [...options];
                    updated[oi].values.push({ value: '', extra_price: '', stock: '' });
                    setOptions(updated);
                  }}
                >
                  + 옵션 값 추가
                </button>
              </div>
            ))}
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
