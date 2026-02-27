import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Feed from './pages/Feed';
import Login from './pages/Login';
import MyPosts from './pages/MyPosts';
import PostDetail from './pages/PostDetail';
import Register from './pages/Register';
import UserDetails from './pages/UserDetails';

function Navbar() {
  const { user, logout, checked } = useAuth();
  const navigate = useNavigate();

  if (!checked) return null;

  return (
    <nav className="navbar">
      <Link to="/" className="brand">Rebook</Link>
      <div className="nav-links">
        {user ? (
          <>
            <Link to="/feed">Feed</Link>
            <Link to="/my-posts">My Posts</Link>
            <Link to={`/user/${user._id}`}>My profile</Link>
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Log in</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}

function ProtectedLayout() {
  const { user, checked } = useAuth();
  if (!checked) return <div className="page"><p>Loading…</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/feed" element={<Feed />} />
        <Route path="/my-posts" element={<MyPosts />} />
        <Route path="/post/:id" element={<PostDetail />} />
        <Route path="/user/:id" element={<UserDetails />} />
      </Route>
      <Route path="/" element={<Navigate to="/feed" replace />} />
      <Route path="*" element={<Navigate to="/feed" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="layout">
          <Navbar />
          <main className="main">
            <AppRoutes />
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
