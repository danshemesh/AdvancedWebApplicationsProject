import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiRequest, API_BASE } from '../api/client';
import type { User } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const { login, setUser, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const err = searchParams.get('error');
    if (err) {
      setError(decodeURIComponent(err));
      setSearchParams({}, { replace: true });
      return;
    }
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    if (accessToken && refreshToken) {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      setSearchParams({}, { replace: true });
      (async () => {
        const { data, ok } = await apiRequest<{ user: User }>('/auth/me');
        if (ok && data?.user) {
          setUser(data.user);
          navigate('/feed', { replace: true });
        } else {
          setError('Could not load user after sign-in');
        }
      })();
    }
  }, [searchParams, setSearchParams, setUser, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const result = await login(email, password);
    if (result.ok) navigate('/feed');
    else setError(result.error || 'Login failed');
  }

  function handleGoogleLogin() {
    window.location.href = `${API_BASE}/auth/google`;
  }

  return (
    <div className="page auth-page">
      <h1>Rebook</h1>
      <p className="tagline">Share books with others</p>
      <form onSubmit={handleSubmit} className="auth-form">
        <h2>Log in</h2>
        {error && <p className="error">{error}</p>}
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Logging in…' : 'Log in'}
        </button>
        <button
          type="button"
          className="google-login"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          Log in with Google
        </button>
        <p className="auth-switch">
          Don’t have an account? <Link to="/register">Register</Link>
        </p>
      </form>
    </div>
  );
}
