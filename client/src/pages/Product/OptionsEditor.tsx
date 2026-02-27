interface OptionValue {
  value: string;
  extra_price: string;
  stock: string;
}

interface OptionGroup {
  option_name: string;
  values: OptionValue[];
}

interface Props {
  options: OptionGroup[];
  setOptions: React.Dispatch<React.SetStateAction<OptionGroup[]>>;
}

function OptionsEditor({ options, setOptions }: Props) {
  return (
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
  );
}

export default OptionsEditor;
