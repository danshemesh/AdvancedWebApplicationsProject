import { useState } from 'react';
import { apiRequest } from '../api/client';

interface LikeButtonProps {
  postId: string;
  initialCount: number;
  initialLiked: boolean;
  onUpdate?: (count: number, liked: boolean) => void;
}

export default function LikeButton({
  postId,
  initialCount,
  initialLiked,
  onUpdate,
}: LikeButtonProps) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initialLiked);
  const [loading, setLoading] = useState(false);

  async function toggleLike() {
    if (loading) return;
    setLoading(true);

    const method = liked ? 'DELETE' : 'POST';
    const { ok } = await apiRequest(`/post/${postId}/like`, { method });

    if (ok) {
      const newLiked = !liked;
      const newCount = newLiked ? count + 1 : count - 1;
      setLiked(newLiked);
      setCount(newCount);
      onUpdate?.(newCount, newLiked);
    }

    setLoading(false);
  }

  return (
    <button
      type="button"
      className={`like-button ${liked ? 'liked' : ''}`}
      onClick={toggleLike}
      disabled={loading}
    >
      <span className="like-icon">{liked ? '♥' : '♡'}</span>
      <span className="like-count">{count}</span>
    </button>
  );
}
