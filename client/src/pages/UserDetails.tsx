import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiRequest, getUploadsUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { User } from '../context/AuthContext';

interface Post {
  _id: string;
  content: string;
  senderId: { _id: string; username: string };
  createdAt: string;
}

export default function UserDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser, setUser } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const isOwnProfile = currentUser && id && currentUser._id === id;

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    const [userRes, postsRes] = await Promise.all([
      apiRequest<User>(`/user/${id}`),
      apiRequest<Post[]>(`/post?sender=${id}`),
    ]);
    if (!userRes.ok || !userRes.data) {
      setError('User not found');
      setLoading(false);
      return;
    }
    setProfile(userRes.data);
    setEditUsername(userRes.data.username);
    setPosts(Array.isArray(postsRes.data) ? postsRes.data : []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSaveUsername(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !editUsername.trim() || savingUsername) return;
    setSavingUsername(true);
    const { data, ok } = await apiRequest<User>(`/user/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ username: editUsername.trim() }),
    });
    setSavingUsername(false);
    if (ok && data) {
      setProfile(data);
      if (isOwnProfile) setUser(data);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !id || uploadingAvatar) return;
    setUploadingAvatar(true);
    const form = new FormData();
    form.append('avatar', file);
    const { data, ok } = await apiRequest<User>(`/user/${id}/avatar`, {
      method: 'PUT',
      body: form,
      headers: {},
    });
    setUploadingAvatar(false);
    e.target.value = '';
    if (ok && data) {
      setProfile(data);
      if (isOwnProfile) setUser(data);
    }
  }

  if (!currentUser) {
    navigate('/login');
    return null;
  }

  if (loading) return <div className="page"><p>Loading…</p></div>;
  if (error || !profile) return <div className="page"><p className="error">{error || 'User not found'}</p></div>;

  const avatarUrl = profile.profilePicturePath
    ? getUploadsUrl(profile.profilePicturePath)
    : null;

  return (
    <div className="page user-details-page">
      <div className="user-header">
        <div className="avatar-wrap">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="avatar" />
          ) : (
            <div className="avatar placeholder">?</div>
          )}
          {isOwnProfile && (
            <label className="avatar-upload">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarChange}
                disabled={uploadingAvatar}
              />
              {uploadingAvatar ? 'Uploading…' : 'Change photo'}
            </label>
          )}
        </div>
        <div className="user-info">
          {isOwnProfile ? (
            <form onSubmit={handleSaveUsername} className="username-form">
              <label>
                Username
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  minLength={3}
                  maxLength={30}
                />
              </label>
              <button type="submit" disabled={savingUsername}>
                {savingUsername ? 'Saving…' : 'Save'}
              </button>
            </form>
          ) : (
            <h1>{profile.username}</h1>
          )}
          <p className="email">{profile.email}</p>
        </div>
      </div>

      <h2>Posts</h2>
      <ul className="post-list">
        {posts.map((post) => (
          <li key={post._id} className="post-item">
            <p className="post-content">{post.content}</p>
          </li>
        ))}
      </ul>
      {posts.length === 0 && <p className="muted">No posts yet.</p>}
    </div>
  );
}
