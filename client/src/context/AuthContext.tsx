import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { apiRequest } from '../api/client';

export interface User {
  _id: string;
  username: string;
  email: string;
  profilePicturePath?: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  checked: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (username: string, email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = 'user';

function loadStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function saveStoredUser(user: User | null) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: loadStoredUser(),
    loading: false,
    checked: false,
  });

  const refreshPromiseRef = useRef<Promise<void> | null>(null);

  const refreshAuth = useCallback(async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      setState((s) => ({ ...s, user: null, checked: true }));
      return;
    }
    if (refreshPromiseRef.current) {
      await refreshPromiseRef.current;
      return;
    }
    const promise = (async () => {
      const { data, ok } = await apiRequest<{ accessToken: string; refreshToken: string }>(
        '/auth/refresh',
        {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        }
      );
      if (!ok || !data) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        saveStoredUser(null);
        setState((s) => ({ ...s, user: null, checked: true }));
        return;
      }
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      const { data: meData } = await apiRequest<{ user: User }>('/auth/me');
      const user = meData?.user ?? loadStoredUser();
      if (user) saveStoredUser(user);
      setState((s) => ({ ...s, user, checked: true }));
    })().finally(() => {
      refreshPromiseRef.current = null;
    });
    refreshPromiseRef.current = promise;
    await promise;
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === 'accessToken' || e.key === 'refreshToken' || e.key === USER_KEY) {
        const refreshToken = localStorage.getItem('refreshToken');
        const user = loadStoredUser();
        if (!refreshToken || !user) {
          setState((s) => ({ ...s, user: null, checked: true }));
        } else {
          setState((s) => ({ ...s, user }));
        }
      }
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      setState((s) => ({ ...s, loading: true }));
      const { data, ok } = await apiRequest<{
        user: User;
        accessToken: string;
        refreshToken: string;
      } | { error: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setState((s) => ({ ...s, loading: false }));
      if (!ok || !data) {
        const err = data && 'error' in data && typeof data.error === 'string'
          ? data.error
          : 'Login failed';
        return { ok: false, error: err };
      }
      if (!('user' in data)) {
        return { ok: false, error: (data as { error?: string }).error || 'Login failed' };
      }
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      saveStoredUser(data.user);
      setState((s) => ({ ...s, user: data.user }));
      return { ok: true };
    },
    []
  );

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      setState((s) => ({ ...s, loading: true }));
      const { data, ok } = await apiRequest<{
        user: User;
        accessToken: string;
        refreshToken: string;
      } | { error: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
      });
      setState((s) => ({ ...s, loading: false }));
      if (!ok || !data) {
        const err = data && 'error' in data && typeof data.error === 'string'
          ? data.error
          : 'Registration failed';
        return { ok: false, error: err };
      }
      if (!('user' in data)) {
        return { ok: false, error: (data as { error?: string }).error || 'Registration failed' };
      }
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      saveStoredUser(data.user);
      setState((s) => ({ ...s, user: data.user }));
      return { ok: true };
    },
    []
  );

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try {
        await apiRequest('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // ignore
      }
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    saveStoredUser(null);
    setState((s) => ({ ...s, user: null }));
  }, []);

  const setUser = useCallback((user: User | null) => {
    saveStoredUser(user);
    setState((s) => ({ ...s, user }));
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    register,
    logout,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
