import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Feed from './pages/Feed';
import Login from './pages/Login';
import PostDetail from './pages/PostDetail';
import Register from './pages/Register';
import UserDetails from './pages/UserDetails';

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  function handleClick(e: React.MouseEvent) {
    if (isActive) {
      e.preventDefault();
      scrollToTop();
    }
  }

  return (
    <Link to={to} onClick={handleClick}>
      {children}
    </Link>
  );
}

function Navbar() {
  const { user, logout, checked } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!checked) return null;

  function handleBrandClick(e: React.MouseEvent) {
    if (location.pathname === '/feed') {
      e.preventDefault();
      scrollToTop();
    }
  }

  return (
    <nav className="navbar">
      <Link to="/feed" className="brand" onClick={handleBrandClick}>Rebook</Link>
      <div className="nav-links">
        {user ? (
          <>
            <NavLink to="/feed">Feed</NavLink>
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
  if (!checked) return (
    <div className="page page-loader">
      <div className="loader-spinner" aria-hidden="true" />
      <p className="loading-text">Loading…</p>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function RedirectToMyProfile() {
  const { user } = useAuth();
  return <Navigate to={user ? `/user/${user._id}` : '/login'} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/feed" element={<Feed />} />
        <Route path="/my-posts" element={<RedirectToMyProfile />} />
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
