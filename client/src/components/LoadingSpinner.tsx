import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  text?: string;
}

function LoadingSpinner({ text = '로딩 중...' }: LoadingSpinnerProps) {
  return (
    <div className="loading">
      <div className="spinner" />
      {text}
    </div>
  );
}

export default LoadingSpinner;
