// auth.js — 모바일(Expo) 인증 클라이언트
// 토큰은 expo-secure-store에 안전하게 저장합니다.
//   expo install expo-secure-store expo-auth-session expo-web-browser
// import * as SecureStore from "expo-secure-store";

// // 개발: LAN IP 사용 (localhost는 실기기에서 접근 불가)
// // 예) http://192.168.0.10:4000/api  — app.json extra 또는 env로 관리 권장
// const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api";
// const TOKEN_KEY = "planora.token";

// export async function getToken() {
//   return SecureStore.getItemAsync(TOKEN_KEY);
// }
// async function setToken(t) {
//   if (t) await SecureStore.setItemAsync(TOKEN_KEY, t);
//   else await SecureStore.deleteItemAsync(TOKEN_KEY);
// }

// async function api(path, init) {
//   const token = await getToken();
//   const res = await fetch(`${BASE}${path}`, {
//     ...init,
//     headers: {
//       "Content-Type": "application/json",
//       ...(token ? { Authorization: `Bearer ${token}` } : {}),
//       ...(init?.headers ?? {}),
//     },
//   });
//   const data = await res.json().catch(() => ({}));
//   if (!res.ok) throw new Error(data?.message ?? "요청에 실패했어요.");
//   return data;
// }

// export const auth = {
//   async login(email, password) {
//     const { token, user } = await api("/auth/login", {
//       method: "POST",
//       body: JSON.stringify({ email, password }),
//     });
//     await setToken(token);
//     return user;
//   },

//   async signup(name, email, password) {
//     const { token, user } = await api("/auth/signup", {
//       method: "POST",
//       body: JSON.stringify({ name, email, password }),
//     });
//     await setToken(token);
//     return user;
//   },

//   async me() {
//     if (!(await getToken())) return null;
//     try {
//       return await api("/auth/me");
//     } catch {
//       await setToken(null);
//       return null;
//     }
//   },

//   async logout() {
//     await setToken(null);
//   },

//   // 소셜 로그인은 expo-auth-session으로 처리합니다.
//   // 아래는 서버가 발급한 커스텀 토큰을 저장하는 헬퍼입니다.
//   async saveExternalToken(token) {
//     await setToken(token);
//   },
// };


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