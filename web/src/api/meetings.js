// web/src/api/meetings.js — 웹 팀 조율 API (authClient 의 토큰 재사용)
import { getToken } from "../auth/authClient";

const BASE = import.meta.env?.VITE_API_URL ?? "/api";

async function req(path, init) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const data = res.status === 204 ? null : await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? "요청에 실패했어요.");
  return data;
}

export const meetings = {
  get: (token) => req(`/meetings/${token}`),
  join: (token) => req(`/meetings/${token}/join`, { method: "POST", body: "{}" }),
  slots: (token) => req(`/meetings/${token}/slots`),
  pick: (token, startsAt) => req(`/meetings/${token}/pick`, { method: "POST", body: JSON.stringify({ startsAt }) }),
  remove: (token) => req(`/meetings/${token}`, { method: "DELETE" }),
  leave: (token) => req(`/meetings/${token}/leave`, { method: "POST", body: "{}" }),
};

// 초대 링크에서 토큰 추출 (…/join/<token>) 또는 코드 그대로
export const tokenFromPath = () => {
  const m = window.location.pathname.match(/\/join\/([^/?#]+)/);
  return m ? m[1] : null;
};
