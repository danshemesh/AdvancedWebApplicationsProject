import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest, getUploadsUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import LikeButton from '../components/LikeButton';
import PostForm from '../components/PostForm';
import PostMenu from '../components/PostMenu';
import SearchBox from '../components/SearchBox';

interface Post {
  _id: string;
  content: string;
  senderId: { _id: string; username: string; profilePicturePath?: string };
  createdAt: string;
  commentCount: number;
  likeCount: number;
  likedByCurrentUser: boolean;
  imagePath?: string;
  searchReason?: string;
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
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);

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

  const sentinelRef = useInfiniteScroll(loadMore, hasMore && !isSearchMode, loadingMore);

  function handlePostCreated() {
    setShowCreateForm(false);
    if (!isSearchMode) {
      fetchPosts(1, false);
    }
  }

  function handlePostUpdated() {
    setEditingPostId(null);
    if (!isSearchMode) {
      fetchPosts(1, false);
    }
  }

  function handleSearchResults(results: Post[] | null, query: string) {
    if (results === null) {
      setIsSearchMode(false);
      setSearchQuery('');
      fetchPosts(1, false);
    } else {
      setIsSearchMode(true);
      setSearchQuery(query);
      setPosts(results);
      setHasMore(false);
    }
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

  if (loading) {
    return (
      <div className="page page-loader">
        <div className="loader-spinner" aria-hidden="true" />
        <p className="loading-text">Loading feed…</p>
      </div>
    );
  }

  return (
    <div className="page feed-page">
      <h1>Feed</h1>
      <SearchBox onSearchResults={handleSearchResults} isSearchMode={isSearchMode} />
      {isSearchMode ? (
        <div className="search-results-info">
          <p>
            Showing {posts.length} result{posts.length !== 1 ? 's' : ''} for "{searchQuery}"
          </p>
        </div>
      ) : (
        <div className="create-post-section">
          <button
            type="button"
            className="create-post-toggle"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? '✕ Cancel' : '+ Create Post'}
          </button>
          {showCreateForm && (
            <div className="create-post-form-wrapper">
              <PostForm onSuccess={handlePostCreated} onCancel={() => setShowCreateForm(false)} />
            </div>
          )}
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {!error && (
        <>
          {posts.length === 0 ? (
            <div className="no-results">
              <div className="no-results-icon">{isSearchMode ? '🔍' : '📝'}</div>
              <h3 className="no-results-title">
                {isSearchMode ? 'No matching posts found' : 'No posts yet'}
              </h3>
              <p className="no-results-description">
                {isSearchMode
                  ? 'Try different keywords or go back to see all posts'
                  : 'Be the first to create a post!'}
              </p>
            </div>
          ) : (
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
                      <div className="post-header">
                        <Link to={`/user/${post.senderId._id}`} className="post-author-info">
                          {(() => {
                            const avatarPath = (post.senderId._id === user._id ? user.profilePicturePath : null) ?? post.senderId.profilePicturePath;
                            return avatarPath ? (
                              <img
                                src={getUploadsUrl(avatarPath)}
                                alt={post.senderId.username}
                                className="post-author-avatar"
                              />
                            ) : (
                              <span className="post-author-avatar placeholder">👤</span>
                            );
                          })()}
                          <span className="post-author-name">{post.senderId.username}</span>
                        </Link>
                        {isOwnPost(post) && (
                          <PostMenu
                            onEdit={() => setEditingPostId(post._id)}
                            onDelete={() => handleDeletePost(post._id)}
                          />
                        )}
                      </div>
                      {post.searchReason && (
                        <p className="search-reason">Match: {post.searchReason}</p>
                      )}
                      <p className="post-content">{post.content}</p>
                      {post.imagePath && (
                        <div className="post-image">
                          <img src={getUploadsUrl(post.imagePath)} alt="Post image" />
                        </div>
                      )}
                      <div className="post-interactions">
                        <LikeButton
                          postId={post._id}
                          initialCount={post.likeCount}
                          initialLiked={post.likedByCurrentUser}
                        />
                        <Link to={`/post/${post._id}`} className="comment-link">
                          💬 {post.commentCount} comments
                        </Link>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!isSearchMode && (
            <div ref={sentinelRef} className="scroll-sentinel">
              {loadingMore && (
                <>
                  <span className="spinner spinner-sm" aria-hidden="true"></span>
                  <span>Loading more</span>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
