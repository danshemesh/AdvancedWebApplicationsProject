import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { apiRequest, getUploadsUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import LikeButton from '../components/LikeButton';
import PencilIcon from '../components/icons/PencilIcon';
import PostForm from '../components/PostForm';
import PostMenu from '../components/PostMenu';
import type { User } from '../context/AuthContext';

interface Post {
  _id: string;
  content: string;
  senderId: { _id: string; username: string; profilePicturePath?: string };
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

export default function UserDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser, setUser } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const isOwnProfile = currentUser && id && currentUser._id === id;

  const showSuccess = useCallback((msg: string) => {
    setSuccessMessage(msg);
  }, []);

  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(''), 3000);
    return () => clearTimeout(t);
  }, [successMessage]);

  const fetchPosts = useCallback(async (pageNum: number, append: boolean) => {
    if (!id) return;
    const { data, ok } = await apiRequest<PaginatedResponse>(`/post?page=${pageNum}&sender=${id}`);
    if (ok && data) {
      setPosts(prev => append ? [...prev, ...data.posts] : data.posts);
      setHasMore(data.hasMore);
      setPage(pageNum);
    }
  }, [id]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    const [userRes, postsRes] = await Promise.all([
      apiRequest<User>(`/user/${id}`),
      apiRequest<PaginatedResponse>(`/post?page=1&sender=${id}`),
    ]);
    if (!userRes.ok || !userRes.data) {
      setError('User not found');
      setLoading(false);
      return;
    }
    setProfile(userRes.data);
    setEditUsername(userRes.data.username);
    if (postsRes.ok && postsRes.data) {
      setPosts(postsRes.data.posts);
      setHasMore(postsRes.data.hasMore);
      setPage(1);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    await fetchPosts(page + 1, true);
    setLoadingMore(false);
  }, [fetchPosts, page, loadingMore]);

  const sentinelRef = useInfiniteScroll(loadMore, hasMore, loadingMore);

  function handlePostCreated() {
    setShowCreateForm(false);
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

  function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    setPendingAvatarFile(file);
    setAvatarPreviewUrl(URL.createObjectURL(file));
  }

  function clearPendingAvatar() {
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    setPendingAvatarFile(null);
    setAvatarPreviewUrl(null);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !isOwnProfile || savingProfile || !profile) return;
    const usernameChanged = editUsername.trim() !== profile.username;
    const avatarChanged = !!pendingAvatarFile;
    if (!usernameChanged && !avatarChanged) return;

    setSavingProfile(true);
    let updatedProfile: User = profile;
    let saved = false;

    if (usernameChanged && editUsername.trim()) {
      const { data, ok } = await apiRequest<User>(`/user/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ username: editUsername.trim() }),
      });
      if (ok && data) {
        updatedProfile = data;
        if (isOwnProfile) setUser(data);
        saved = true;
      }
    }

    if (pendingAvatarFile) {
      const form = new FormData();
      form.append('avatar', pendingAvatarFile);
      const { data, ok } = await apiRequest<User>(`/user/${id}/avatar`, {
        method: 'PUT',
        body: form,
        headers: {},
      });
      if (ok && data) {
        updatedProfile = data;
        if (isOwnProfile) setUser(data);
        clearPendingAvatar();
        saved = true;
      }
    }

    setProfile(updatedProfile);
    setSavingProfile(false);
    if (saved) {
      showSuccess('Profile saved successfully!');
      setIsEditingUsername(false);
    }
  }

  function cancelUsernameEdit() {
    setEditUsername(profile?.username ?? '');
    setIsEditingUsername(false);
  }

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  if (!currentUser) {
    navigate('/login');
    return null;
  }

  if (loading) return (
    <div className="page page-loader">
      <div className="loader-spinner" aria-hidden="true" />
      <p className="loading-text">Loading profile…</p>
    </div>
  );
  if (error || !profile) return <div className="page"><p className="error">{error || 'User not found'}</p></div>;

  const displayAvatarUrl = avatarPreviewUrl ?? (profile.profilePicturePath ? getUploadsUrl(profile.profilePicturePath) : null);

  return (
    <div className="page user-details-page">
      {successMessage && (
        <div className="success-message" role="status">
          {successMessage}
        </div>
      )}
      <div className="user-header">
        <div className="avatar-wrap">
          {isOwnProfile ? (
            <>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarSelect}
                disabled={savingProfile}
                className="avatar-input-hidden"
                aria-label="Change profile photo"
              />
              <button
                type="button"
                className="avatar-clickable"
                onClick={() => avatarInputRef.current?.click()}
                disabled={savingProfile}
                aria-label="Change profile photo"
              >
                {displayAvatarUrl ? (
                  <img src={displayAvatarUrl} alt="" className="avatar" />
                ) : (
                  <div className="avatar placeholder">?</div>
                )}
                <span className="avatar-pencil-overlay">
                  <PencilIcon size={28} />
                </span>
              </button>
              {pendingAvatarFile && (
                <div className="avatar-actions">
                  <button
                    type="button"
                    className="avatar-save"
                    onClick={() => {
                      const syntheticEvent = { preventDefault: () => {} } as React.FormEvent;
                      handleSaveProfile(syntheticEvent);
                    }}
                    disabled={savingProfile}
                  >
                    {savingProfile ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" className="avatar-reset" onClick={clearPendingAvatar} disabled={savingProfile}>
                    Reset
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {displayAvatarUrl ? (
                <img src={displayAvatarUrl} alt="" className="avatar" />
              ) : (
                <div className="avatar placeholder">?</div>
              )}
            </>
          )}
        </div>
        <div className="user-info">
          {isOwnProfile ? (
            isEditingUsername ? (
              <form onSubmit={handleSaveProfile} className="username-form">
                <label>
                  Username
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    minLength={3}
                    maxLength={30}
                    autoFocus
                  />
                </label>
                <div className="username-form-actions">
                  <button type="submit" disabled={savingProfile || (!pendingAvatarFile && editUsername.trim() === profile?.username)}>
                    {savingProfile ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" onClick={cancelUsernameEdit} disabled={savingProfile}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <h1 className="username-display">
                {profile.username}
                <button
                  type="button"
                  className="username-edit-btn"
                  onClick={() => setIsEditingUsername(true)}
                  aria-label="Edit username"
                >
                  <PencilIcon />
                </button>
              </h1>
            )
          ) : (
            <h1>{profile.username}</h1>
          )}
          <p className="email">{profile.email}</p>
        </div>
      </div>

      <h2>Posts</h2>
      {isOwnProfile && (
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
      {posts.length === 0 && !loading && (
        <p className="muted">{isOwnProfile ? "You haven't created any posts yet." : 'No posts yet.'}</p>
      )}
      {posts.length > 0 && (
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
                    <div className="post-header">
                      <Link to={`/user/${post.senderId._id}`} className="post-author-info">
                        {(() => {
                          const avatarPath = (post.senderId._id === currentUser._id ? (profile?.profilePicturePath ?? currentUser.profilePicturePath) : null) ?? post.senderId.profilePicturePath;
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
                      {isOwnProfile && (
                        <PostMenu
                          onEdit={() => setEditingPostId(post._id)}
                          onDelete={() => handleDeletePost(post._id)}
                        />
                      )}
                    </div>
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
          {hasMore && (
            <div ref={sentinelRef} className="scroll-sentinel">
              {loadingMore && <p>Loading more…</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
