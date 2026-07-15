// core/api.js — 웹·모바일 공용 API 클라이언트 (프레임워크 무관, fetch만 사용)
//   const api = createApi("/api", () => getToken());   // 웹(Vite 프록시)
//   const api = createApi("http://192.168.0.15:4000/api", () => auth.getToken()); // 모바일
export function createApi(baseUrl, getToken) {
  const req = async (path, init = {}) => {
    const token = typeof getToken === "function" ? await getToken() : getToken;
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers || {}),
      },
    });
    const data = res.status === 204 ? null : await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || `요청 실패 (${res.status})`);
    return data;
  };

  return {
    // 인증
    signup: (name, email, password) =>
      req("/auth/signup", { method: "POST", body: JSON.stringify({ name, email, password }) }),
    login: (email, password) =>
      req("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
    me: () => req("/auth/me"),
    // 일정 CRUD (서버가 user_id 로 격리)
    listEvents: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return req(`/events${q ? `?${q}` : ""}`);
    },
    getNextTravel: (lat, lng) => req(`/travel/next?lat=${lat}&lng=${lng}`),
    // AI 에이전트 (LangGraph). run → 확인필요시 needs_confirmation, resume 로 재개.
    runAgent: (feature, input) =>
      req("/agent/run", { method: "POST", body: JSON.stringify({ feature, input }) }),
    resumeAgent: (threadId, decision) =>
      req("/agent/resume", { method: "POST", body: JSON.stringify({ threadId, decision }) }),
    createEvent: (e) => req("/events", { method: "POST", body: JSON.stringify(e) }),
    updateEvent: (id, patch) => req(`/events/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    deleteEvent: (id) => req(`/events/${id}`, { method: "DELETE" }),
  };
}

