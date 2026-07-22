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
    // 퀵애드 에이전트 (LangGraph). run(text) → needs_confirmation 이면 resume 으로 승인/거절.
    runAgent: (text) =>
      req("/agent/run", { method: "POST", body: JSON.stringify({ text }) }),
    resumeAgent: (threadId, decision) =>
      req("/agent/resume", { method: "POST", body: JSON.stringify({ threadId, decision }) }),
    // 미루기 (기능): 일정 delta분 이동, cascade=true 면 같은 날 이후 일정도 함께
    shiftEvent: (id, deltaMinutes, cascade = false) =>
      req(`/events/${id}/shift`, { method: "POST", body: JSON.stringify({ deltaMinutes, cascade }) }),
    // 알림 설정/위치/인박스
    getNotifySettings: () => req("/notify/settings"),
    saveNotifySettings: (cfg) => req("/notify/settings", { method: "PUT", body: JSON.stringify(cfg) }),
    reportLocation: (lat, lng) => req("/notify/location", { method: "POST", body: JSON.stringify({ lat, lng }) }),
    sendInbox: (text) => req("/notify/inbox", { method: "POST", body: JSON.stringify({ text }) }),
    testNotify: () => req("/notify/test", { method: "POST", body: "{}" }),
    // 팀 조율: 만들기/목록/상세/참여/공통빈시간/확정
    createMeeting: (m) => req("/meetings", { method: "POST", body: JSON.stringify(m) }),
    listMeetings: () => req("/meetings"),
    getMeeting: (token) => req(`/meetings/${token}`),
    joinMeeting: (token) => req(`/meetings/${token}/join`, { method: "POST", body: "{}" }),
    getMeetingSlots: (token) => req(`/meetings/${token}/slots`),
    pickMeetingSlot: (token, startsAt) =>
      req(`/meetings/${token}/pick`, { method: "POST", body: JSON.stringify({ startsAt }) }),
    updateMeeting: (token, patch) => req(`/meetings/${token}`, { method: "PATCH", body: JSON.stringify(patch) }),
    deleteMeeting: (token) => req(`/meetings/${token}`, { method: "DELETE" }),
    leaveMeeting: (token) => req(`/meetings/${token}/leave`, { method: "POST", body: "{}" }),
    createEvent: (e) => req("/events", { method: "POST", body: JSON.stringify(e) }),
    updateEvent: (id, patch) => req(`/events/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    deleteEvent: (id) => req(`/events/${id}`, { method: "DELETE" }),
  };
}

