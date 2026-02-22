import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface Post {
  _id: string;
  content: string;
  senderId: { _id: string; username: string };
  createdAt: string;
}

export default function Feed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data, ok } = await apiRequest<Post[]>('/post');
      if (ok && Array.isArray(data)) setPosts(data);
      else setError('Failed to load posts');
      setLoading(false);
    })();
  }, []);

  if (!user) return null;

  return (
    <div className="page feed-page">
      <h1>Feed</h1>
      {loading && <p>Loading…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && (
        <ul className="post-list">
          {posts.map((post) => (
            <li key={post._id} className="post-item">
              <p className="post-content">{post.content}</p>
              <p className="post-meta">
                <Link to={`/user/${post.senderId._id}`}>{post.senderId.username}</Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
