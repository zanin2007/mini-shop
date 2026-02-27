import { useState, forwardRef } from 'react';
import type { Review } from '../../types';

interface Props {
  reviews: Review[];
  canReview: boolean;
  currentUserId: number | null;
  onSubmitReview: (rating: number, content: string) => Promise<void>;
  onDeleteReview: (reviewId: number) => void;
}

const ReviewSection = forwardRef<HTMLDivElement, Props>(
  ({ reviews, canReview, currentUserId, onSubmitReview, onDeleteReview }, ref) => {
    const [showForm, setShowForm] = useState(false);
    const [reviewForm, setReviewForm] = useState({ rating: 5, content: '' });

    const renderStars = (rating: number) => {
      return '★'.repeat(rating) + '☆'.repeat(5 - rating);
    };

    const avgRating = reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null;

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      await onSubmitReview(reviewForm.rating, reviewForm.content);
      setShowForm(false);
      setReviewForm({ rating: 5, content: '' });
    };

    return (
      <div className="review-section" ref={ref}>
        <div className="review-header">
          <h3>
            리뷰 {reviews.length > 0 && <span className="review-count">({reviews.length})</span>}
          </h3>
          {avgRating && (
            <span className="review-avg">
              <span className="stars">{renderStars(Math.round(Number(avgRating)))}</span>
              {avgRating}
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
              <div className="rating-stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={`star-btn ${star <= reviewForm.rating ? 'active' : ''}`}
                    onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <textarea
              placeholder="리뷰를 작성해주세요..."
              value={reviewForm.content}
              onChange={(e) => setReviewForm({ ...reviewForm, content: e.target.value })}
              rows={3}
            />
            <div className="review-form-actions">
              <button type="button" onClick={() => setShowForm(false)}>취소</button>
              <button type="submit">등록</button>
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
                  <span className="review-stars">{renderStars(review.rating)}</span>
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
);

export default ReviewSection;
