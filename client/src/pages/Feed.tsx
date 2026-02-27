import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest, getUploadsUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import PostForm from '../components/PostForm';

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
  const [editingPostId, setEditingPostId] = useState<string | null>(null);

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

  function handlePostCreated() {
    fetchPosts(1, false);
  }

  function handlePostUpdated() {
    setEditingPostId(null);
    fetchPosts(1, false);
  }

  async function handleDeletePost(postId: string) {
    if (!confirm('Are you sure you want to delete this post?')) return;
    const { ok } = await apiRequest(`/post/${postId}`, { method: 'DELETE' });
    if (ok) {
      setPosts(prev => prev.filter(p => p._id !== postId));
    }
  }

  function isOwnPost(post: Post): boolean {
    return user?._id === post.senderId._id;
  }

  if (!user) return null;

  return (
    <div className="page feed-page">
      <h1>Feed</h1>
      <div className="create-post-section">
        <h2>Create Post</h2>
        <PostForm onSuccess={handlePostCreated} />
      </div>
      {loading && <p>Loading…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && (
        <>
          <ul className="post-list">
            {posts.map((post) => (
              <li key={post._id} className="post-item">
                {editingPostId === post._id ? (
                  <PostForm
                    postId={post._id}
                    initialContent={post.content}
                    initialImagePath={post.imagePath}
                    onSuccess={handlePostUpdated}
                    onCancel={() => setEditingPostId(null)}
                  />
                ) : (
                  <>
                    <p className="post-content">{post.content}</p>
                    {post.imagePath && (
                      <div className="post-image">
                        <img src={getUploadsUrl(post.imagePath)} alt="Post image" />
                      </div>
                    )}
                    <p className="post-meta">
                      <Link to={`/user/${post.senderId._id}`}>{post.senderId.username}</Link>
                      <span className="comment-count">{post.commentCount} comments</span>
                    </p>
                    {isOwnPost(post) && (
                      <div className="post-actions">
                        <button onClick={() => setEditingPostId(post._id)}>Edit</button>
                        <button onClick={() => handleDeletePost(post._id)}>Delete</button>
                      </div>
                    )}
                  </>
                )}
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
