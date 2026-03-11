import { useState, forwardRef, memo } from 'react';
import Rating from '@mui/material/Rating';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import type { Review } from '../../types';

interface Props {
  reviews: Review[];
  canReview: boolean;
  currentUserId: number | null;
  onSubmitReview: (rating: number, content: string) => Promise<void>;
  onDeleteReview: (reviewId: number) => void;
}

const ReviewSection = memo(forwardRef<HTMLDivElement, Props>(
  ({ reviews, canReview, currentUserId, onSubmitReview, onDeleteReview }, ref) => {
    const [showForm, setShowForm] = useState(false);
    const [reviewForm, setReviewForm] = useState({ rating: 5, content: '' });
    const [submitting, setSubmitting] = useState(false);

    const avgRating = reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + Number(r.rating), 0) / reviews.length)
      : null;

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      try {
        await onSubmitReview(reviewForm.rating, reviewForm.content);
        setShowForm(false);
        setReviewForm({ rating: 5, content: '' });
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div className="review-section" ref={ref}>
        <div className="review-header">
          <h3>
            리뷰 {reviews.length > 0 && <span className="review-count">({reviews.length})</span>}
          </h3>
          {avgRating !== null && (
            <span className="review-avg">
              <Rating value={avgRating} precision={0.5} size="small" readOnly />
              <span className="review-avg-number">{avgRating.toFixed(1)}</span>
            </span>
          )}
        </div>

        {canReview && !showForm && (
          <button className="write-review-btn" onClick={() => setShowForm(true)}>
            리뷰 작성하기
          </button>
        )}

        {showForm && (
          <form className="review-form" onSubmit={handleSubmit}>
            <div className="rating-select">
              <span>별점</span>
              <Rating
                value={reviewForm.rating}
                precision={0.5}
                size="large"
                onChange={(_e: React.SyntheticEvent, value: number | null) => setReviewForm({ ...reviewForm, rating: value ?? 5 })}
              />
              <span className="rating-value">{reviewForm.rating}</span>
            </div>
            <textarea
              placeholder="리뷰를 작성해주세요..."
              value={reviewForm.content}
              onChange={(e) => setReviewForm({ ...reviewForm, content: e.target.value })}
              rows={3}
            />
            <div className="review-form-actions">
              <button type="button" onClick={() => setShowForm(false)} disabled={submitting}>취소</button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Spinner className="size-4" />}
                {submitting ? '등록 중' : '등록'}
              </Button>
            </div>
          </form>
        )}

        {reviews.length === 0 ? (
          <p className="no-reviews">아직 리뷰가 없습니다.</p>
        ) : (
          <div className="review-list">
            {reviews.map((review) => (
              <div key={review.id} className="review-item">
                <div className="review-item-header">
                  <span className="review-author">{review.nickname || review.user?.nickname}</span>
                  <Rating value={Number(review.rating)} precision={0.5} size="small" readOnly />
                  <span className="review-date">
                    {new Date(review.created_at).toLocaleDateString('ko-KR')}
                  </span>
                  {currentUserId && review.user_id === currentUserId && (
                    <button className="review-delete-btn" onClick={() => onDeleteReview(review.id)}>
                      삭제
                    </button>
                  )}
                </div>
                <p className="review-content">{review.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
));

ReviewSection.displayName = 'ReviewSection';

export default ReviewSection;
