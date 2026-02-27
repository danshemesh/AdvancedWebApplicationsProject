import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client';

interface Comment {
  _id: string;
  content: string;
  authorId: { _id: string; username: string };
  createdAt: string;
}

interface CommentListProps {
  postId: string;
}

export default function CommentList({ postId }: CommentListProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [postId]);

  async function fetchComments() {
    const { data, ok } = await apiRequest<Comment[]>(`/comment?post=${postId}`);
    if (ok && data) {
      setComments(data);
    } else {
      setError('Failed to load comments');
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    const { ok } = await apiRequest('/comment', {
      method: 'POST',
      body: JSON.stringify({ content: newComment.trim(), postId }),
    });

    if (ok) {
      setNewComment('');
      fetchComments();
    }
    setSubmitting(false);
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (loading) return (
    <div className="loading-text">
      <span className="spinner spinner-sm" aria-hidden="true"></span>
      <span>Loading comments</span>
    </div>
  );
  if (error) return <p className="error">{error}</p>;

  return (
    <div className="comment-list">
      <h3>Comments ({comments.length})</h3>
      {comments.length === 0 ? (
        <p className="no-comments">No comments yet. Be the first to comment!</p>
      ) : (
        <ul className="comments">
          {comments.map((comment) => (
            <li key={comment._id} className="comment-item">
              <div className="comment-header">
                <Link to={`/user/${comment.authorId._id}`} className="comment-author">
                  {comment.authorId.username}
                </Link>
                <span className="comment-date">{formatDate(comment.createdAt)}</span>
              </div>
              <p className="comment-content">{comment.content}</p>
            </li>
          ))}
        </ul>
      )}
      <form className="comment-form" onSubmit={handleSubmit}>
        <textarea
          className="comment-textarea"
          placeholder="Write a comment…"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          rows={2}
        />
        <button type="submit" disabled={submitting || !newComment.trim()}>
          {submitting ? 'Posting…' : 'Post Comment'}
        </button>
      </form>
    </div>
  );
}
