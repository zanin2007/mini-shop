import { useRef } from 'react';

interface OptionValue {
  _key: number;
  value: string;
  extra_price: string;
  stock: string;
}

interface OptionGroup {
  _key: number;
  option_name: string;
  values: OptionValue[];
}

interface Props {
  options: OptionGroup[];
  setOptions: React.Dispatch<React.SetStateAction<OptionGroup[]>>;
}

const sanitizeNumeric = (raw: string) => {
  if (raw === '') return '';
  const num = Number(raw);
  return (isNaN(num) || num < 0 || !Number.isInteger(num)) ? '0' : raw;
};

function OptionsEditor({ options, setOptions }: Props) {
  const nextKey = useRef(
    options.reduce((max, opt) => {
      const valMax = opt.values.reduce((m, v) => Math.max(m, v._key), 0);
      return Math.max(max, opt._key, valMax);
    }, 0) + 1
  );

  const genKey = () => nextKey.current++;

  return (
    <div className="options-section">
      <div className="options-header">
        <label>상품 옵션</label>
        <button
          type="button"
          className="add-option-btn"
          onClick={() => setOptions([...options, { _key: genKey(), option_name: '', values: [{ _key: genKey(), value: '', extra_price: '', stock: '' }] }])}
        >
          + 옵션 그룹 추가
        </button>
      </div>
      {options.map((option, oi) => (
        <div key={option._key} className="option-group">
          <div className="option-group-header">
            <input
              type="text"
              placeholder="옵션명 (예: 사이즈, 색상)"
              value={option.option_name}
              onChange={(e) => {
                setOptions(options.map((opt, i) =>
                  i === oi ? { ...opt, option_name: e.target.value } : opt
                ));
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
            <div key={val._key} className="option-value-row">
              <input
                type="text"
                placeholder="값 (예: S, M, L)"
                value={val.value}
                onChange={(e) => {
                  setOptions(options.map((opt, i) =>
                    i === oi ? { ...opt, values: opt.values.map((v, j) =>
                      j === vi ? { ...v, value: e.target.value } : v
                    )} : opt
                  ));
                }}
              />
              <input
                type="number"
                placeholder="추가금액"
                min="0"
                value={val.extra_price}
                onChange={(e) => {
                  const sanitized = sanitizeNumeric(e.target.value);
                  setOptions(options.map((opt, i) =>
                    i === oi ? { ...opt, values: opt.values.map((v, j) =>
                      j === vi ? { ...v, extra_price: sanitized } : v
                    )} : opt
                  ));
                }}
              />
              <input
                type="number"
                placeholder="재고"
                min="0"
                value={val.stock}
                onChange={(e) => {
                  const sanitized = sanitizeNumeric(e.target.value);
                  setOptions(options.map((opt, i) =>
                    i === oi ? { ...opt, values: opt.values.map((v, j) =>
                      j === vi ? { ...v, stock: sanitized } : v
                    )} : opt
                  ));
                }}
              />
              <button
                type="button"
                className="remove-btn small"
                onClick={() => {
                  setOptions(options.map((opt, i) =>
                    i === oi ? { ...opt, values: opt.values.filter((_, j) => j !== vi) } : opt
                  ));
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
              setOptions(options.map((opt, i) =>
                i === oi ? { ...opt, values: [...opt.values, { _key: genKey(), value: '', extra_price: '', stock: '' }] } : opt
              ));
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
