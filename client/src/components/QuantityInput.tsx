import { useState, useRef, useCallback, useEffect } from 'react';
import './QuantityInput.css';

interface Props {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
}

function QuantityInput({ value, min = 1, max, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!editing) setInputValue(String(value));
  }, [value, editing]);

  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const startHold = (delta: number) => {
    const step = () => {
      onChange(Math.max(min, Math.min(max, value + delta)));
    };
    step();
    timerRef.current = setTimeout(() => {
      let current = value + delta;
      intervalRef.current = setInterval(() => {
        current += delta;
        const clamped = Math.max(min, Math.min(max, current));
        onChange(clamped);
        if (clamped <= min || clamped >= max) clearTimers();
      }, 80);
    }, 400);
  };

  const commitInput = () => {
    setEditing(false);
    const num = parseInt(inputValue, 10);
    if (isNaN(num)) return;
    onChange(Math.max(min, Math.min(max, num)));
  };

  return (
    <div className="qty-input">
      <button
        className="qty-btn"
        aria-label="수량 감소"
        disabled={value <= min}
        onMouseDown={() => { if (value > min) startHold(-1); }}
        onMouseUp={clearTimers}
        onMouseLeave={clearTimers}
        onTouchStart={() => { if (value > min) startHold(-1); }}
        onTouchEnd={clearTimers}
      >
        -
      </button>

      {editing ? (
        <input
          ref={inputRef}
          className="qty-text"
          type="text"
          inputMode="numeric"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value.replace(/[^0-9]/g, ''))}
          onBlur={commitInput}
          onKeyDown={(e) => { if (e.key === 'Enter') commitInput(); }}
        />
      ) : (
        <span
          className="qty-value"
          onClick={() => {
            setEditing(true);
            setInputValue(String(value));
            setTimeout(() => inputRef.current?.select(), 0);
          }}
          title="클릭하여 직접 입력"
        >
          {value}
        </span>
      )}

      <button
        className="qty-btn"
        aria-label="수량 증가"
        disabled={value >= max}
        onMouseDown={() => { if (value < max) startHold(1); }}
        onMouseUp={clearTimers}
        onMouseLeave={clearTimers}
        onTouchStart={() => { if (value < max) startHold(1); }}
        onTouchEnd={clearTimers}
      >
        +
      </button>
    </div>
  );
}

export default QuantityInput;
