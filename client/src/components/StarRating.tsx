import { memo } from 'react';

interface StarRatingProps {
  value: number;
  readOnly?: boolean;
  size?: 'small' | 'large';
  precision?: number;
  onChange?: (value: number) => void;
}

const containerStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '1px',
  verticalAlign: 'middle',
};

const halfFilledStyle: React.CSSProperties = {
  position: 'absolute',
  overflow: 'hidden',
  width: '50%',
  color: '#e8a230',
};

const halfEmptyStyle: React.CSSProperties = { color: '#d4d0c8' };

const StarRating = memo(function StarRating({
  value,
  readOnly = false,
  size = 'small',
  precision = 1,
  onChange,
}: StarRatingProps) {
  const stars = [1, 2, 3, 4, 5];
  const fontSize = size === 'large' ? '1.6rem' : '1rem';

  const handleClick = (star: number) => {
    if (!onChange) return;
    onChange(star);
  };

  const handleHalfClick = (star: number, e: React.MouseEvent<HTMLSpanElement>) => {
    if (!onChange || precision >= 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const isLeft = e.clientX - rect.left < rect.width / 2;
    onChange(isLeft ? star - 0.5 : star);
  };

  return (
    <span
      style={containerStyle}
      role={readOnly ? 'img' : undefined}
      aria-label={readOnly ? `${value}점` : undefined}
    >
      {stars.map((star) => {
        const filled = value >= star;
        const half = !filled && value >= star - 0.5;

        return (
          <span
            key={star}
            onClick={readOnly ? undefined : (e) => precision < 1 ? handleHalfClick(star, e) : handleClick(star)}
            style={{
              fontSize,
              cursor: readOnly ? 'default' : 'pointer',
              color: filled || half ? '#e8a230' : '#d4d0c8',
              position: 'relative',
              userSelect: 'none',
              lineHeight: 1,
            }}
          >
            {half ? (
              <>
                <span style={halfFilledStyle}>★</span>
                <span style={halfEmptyStyle}>★</span>
              </>
            ) : (
              '★'
            )}
          </span>
        );
      })}
    </span>
  );
});

export default StarRating;
