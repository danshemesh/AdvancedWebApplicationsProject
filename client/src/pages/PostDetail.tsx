import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiRequest, getUploadsUrl } from '../api/client';
import LikeButton from '../components/LikeButton';
import CommentList from '../components/CommentList';

interface Post {
  _id: string;
  content: string;
  senderId: { _id: string; username: string };
  createdAt: string;
  commentCount: number;
  likeCount: number;
  likedByCurrentUser: boolean;
  imagePath?: string;
}

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    fetchPost();
  }, [id]);

  async function fetchPost() {
    const { data, ok } = await apiRequest<{ posts: Post[] }>(`/post?_id=${id}`);
    if (ok && data?.posts?.length) {
      setPost(data.posts[0]);
    } else {
      setError('Post not found');
    }
    setLoading(false);
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (loading) return <div className="page"><p>Loading…</p></div>;
  if (error) return <div className="page"><p className="error">{error}</p></div>;
  if (!post) return null;

  return (
    <div className="page post-detail-page">
      <Link to="/feed" className="back-link">← Back to Feed</Link>
      <div className="post-detail">
        <div className="post-detail-header">
          <Link to={`/user/${post.senderId._id}`} className="post-author">
            {post.senderId.username}
          </Link>
          <span className="post-date">{formatDate(post.createdAt)}</span>
        </div>
        <p className="post-detail-content">{post.content}</p>
        {post.imagePath && (
          <div className="post-detail-image">
            <img src={getUploadsUrl(post.imagePath)} alt="Post image" />
          </div>
        )}
        <div className="post-detail-actions">
          <LikeButton
            postId={post._id}
            initialCount={post.likeCount}
            initialLiked={post.likedByCurrentUser}
          />
        </div>
      </div>
      <CommentList postId={post._id} />
    </div>
  );
}
