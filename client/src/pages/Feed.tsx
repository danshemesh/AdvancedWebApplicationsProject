import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';

interface Post {
  _id: string;
  content: string;
  senderId: { _id: string; username: string };
  createdAt: string;
  commentCount: number;
}

interface PaginatedResponse {
  posts: Post[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

export default function Feed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchPosts = useCallback(async (pageNum: number, append: boolean) => {
    const { data, ok } = await apiRequest<PaginatedResponse>(`/post?page=${pageNum}`);
    if (ok && data) {
      setPosts(prev => append ? [...prev, ...data.posts] : data.posts);
      setHasMore(data.hasMore);
      setPage(pageNum);
    } else {
      setError('Failed to load posts');
    }
  }, []);

  useEffect(() => {
    (async () => {
      await fetchPosts(1, false);
      setLoading(false);
    })();
  }, [fetchPosts]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    await fetchPosts(page + 1, true);
    setLoadingMore(false);
  }, [fetchPosts, page, loadingMore]);

  const sentinelRef = useInfiniteScroll(loadMore, hasMore, loadingMore);

  if (!user) return null;

  return (
    <div className="page feed-page">
      <h1>Feed</h1>
      {loading && <p>Loading…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && (
        <>
          <ul className="post-list">
            {posts.map((post) => (
              <li key={post._id} className="post-item">
                <p className="post-content">{post.content}</p>
                <p className="post-meta">
                  <Link to={`/user/${post.senderId._id}`}>{post.senderId.username}</Link>
                  <span className="comment-count">{post.commentCount} comments</span>
                </p>
              </li>
            ))}
          </ul>
          <div ref={sentinelRef} className="scroll-sentinel">
            {loadingMore && <p>Loading more…</p>}
          </div>
        </>
      )}
    </div>
  );
}
