import type { CalEvent } from "./event";

export interface EventApi {
  list(): Promise<CalEvent[]>;
  create(e: Omit<CalEvent, "id">): Promise<CalEvent>;
  update(id: string, e: Partial<CalEvent>): Promise<CalEvent>;
  remove(id: string): Promise<void>;
}

export function createEventApi(baseUrl: string, getToken: () => string | null): EventApi {
  const req = async (path: string, init?: RequestInit) => {
    const token = getToken();
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers || {}),
      },
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.status === 204 ? null : res.json();
  };
  return {
    list: () => req("/events"),
    create: (e) => req("/events", { method: "POST", body: JSON.stringify(e) }),
    update: (id, e) => req(`/events/${id}`, { method: "PATCH", body: JSON.stringify(e) }),
    remove: (id) => req(`/events/${id}`, { method: "DELETE" }),
  };
}

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
    signup: (name, email, password) => req("/auth/signup", { method: "POST", body: JSON.stringify({ name, email, password }) }),
    login: (email, password) => req("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
    me: () => req("/auth/me"),
    listEvents: (params = {}) => { const q = new URLSearchParams(params).toString(); return req(`/events${q ? `?${q}` : ""}`); },
    createEvent: (e) => req("/events", { method: "POST", body: JSON.stringify(e) }),
    updateEvent: (id, patch) => req(`/events/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    deleteEvent: (id) => req(`/events/${id}`, { method: "DELETE" }),
  };
}