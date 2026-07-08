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