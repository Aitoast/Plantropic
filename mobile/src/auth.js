// mobile/src/auth.js — 서버 인증 API 호출 + 토큰 보관(SecureStore)
import * as SecureStore from "expo-secure-store";

// ⚠️ 폰은 localhost 로 PC 서버에 못 붙습니다. PC의 LAN IP 로 바꾸세요 (ipconfig → IPv4).
const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://172.30.1.20:4000/api";
const TOKEN_KEY = "planora.token";

async function req(path, body) {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const res = await fetch(`${BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? "요청에 실패했어요.");
  return data;
}

export const auth = {
  async login(email, password) {
    const { token, user } = await req("/auth/login", { email, password });
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    return user;
  },
  async signup(name, email, password) {
    const { token, user } = await req("/auth/signup", { name, email, password });
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    return user;
  },
  async me() {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) return null;
    try { return await req("/auth/me"); }
    catch { await SecureStore.deleteItemAsync(TOKEN_KEY); return null; }
  },
  async logout() { await SecureStore.deleteItemAsync(TOKEN_KEY); },
  async getToken() { return SecureStore.getItemAsync(TOKEN_KEY); },
};