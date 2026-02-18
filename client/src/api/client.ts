const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function getAccessToken(): string | null {
  return localStorage.getItem('accessToken');
}

function getRefreshToken(): string | null {
  return localStorage.getItem('refreshToken');
}

async function refreshTokens(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (res.status !== 200) return false;
    const data = await res.json();
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit = {},
  retried = false
): Promise<{ data?: T; ok: boolean; status: number }> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const token = getAccessToken();
  const headers: HeadersInit = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!headers['Content-Type'] && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  let res = await fetch(url, { ...options, headers });

  if (res.status === 401 && !retried) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      const newToken = getAccessToken();
      if (newToken) headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(url, { ...options, headers });
    }
  }

  let data: T | undefined;
  const contentType = res.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      // ignore
    }
  }

  return { data, ok: res.ok, status: res.status };
}

export function getUploadsUrl(relativePath: string): string {
  if (!relativePath) return '';
  const base = API_BASE.replace(/\/$/, '');
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return `${base}/uploads${path}`;
}

export { API_BASE };
