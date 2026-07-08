// authClient.ts — 웹 인증 클라이언트
// 자체 server(Express) REST API를 호출합니다. JWT를 localStorage에 보관.
// 소셜 로그인은 서버의 OAuth 시작 엔드포인트로 브라우저를 리다이렉트합니다.

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

const BASE = import.meta.env?.VITE_API_URL ?? "/api";
const TOKEN_KEY = "planora.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? "요청에 실패했어요.");
  return data as T;
}

type AuthResult = { token: string; user: AuthUser };

export const auth = {
  async login(email: string, password: string): Promise<AuthUser> {
    const { token, user } = await api<AuthResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(token);
    return user;
  },

  async signup(name: string, email: string, password: string): Promise<AuthUser> {
    const { token, user } = await api<AuthResult>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    setToken(token);
    return user;
  },

  async me(): Promise<AuthUser | null> {
    if (!getToken()) return null;
    try {
      return await api<AuthUser>("/auth/me");
    } catch {
      setToken(null);
      return null;
    }
  },

  logout() {
    setToken(null);
  },

  // 소셜 로그인: 서버가 OAuth 콜백에서 토큰을 발급하고
  // {origin}/oauth/callback#token=... 형태로 다시 리다이렉트합니다.
  oauth(provider: "google" | "kakao") {
    const redirect = encodeURIComponent(`${window.location.origin}/oauth/callback`);
    window.location.href = `${BASE}/auth/${provider}?redirect=${redirect}`;
  },

  // /oauth/callback 라우트에서 호출: URL 해시의 토큰을 저장
  consumeOAuthRedirect(): boolean {
    const m = window.location.hash.match(/token=([^&]+)/);
    if (!m) return false;
    setToken(decodeURIComponent(m[1]));
    history.replaceState(null, "", window.location.pathname);
    return true;
  },
};
