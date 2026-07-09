import { useState, useCallback, useEffect } from "react";
import type { CalEvent, EventInput } from "./event";
import { normalize } from "./event";
import type { EventApi } from "./api";

export function useEventStore(api: EventApi) {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.list().then(setEvents).catch(() => setError("불러오기 실패")); }, [api]);

  const add = useCallback(async (input: EventInput) => {
    const n = normalize(input);
    if (!n.ok) { setError(n.errors.join(" ")); return; }
    const temp: CalEvent = { ...n.value, id: `tmp-${Date.now()}` };
    setEvents((p) => [...p, temp]);                       // 낙관적 추가
    try {
      const saved = await api.create(n.value);
      setEvents((p) => p.map((e) => (e.id === temp.id ? saved : e)));
    } catch {
      setEvents((p) => p.filter((e) => e.id !== temp.id)); // 롤백
      setError("저장 실패");
    }
  }, [api]);

  const remove = useCallback(async (id: string) => {
    const prev = events;
    setEvents((p) => p.filter((e) => e.id !== id));        // 낙관적 삭제
    try { await api.remove(id); }
    catch { setEvents(prev); setError("삭제 실패"); }      // 롤백
  }, [api, events]);

  return { events, error, add, remove };
}

// core/useEventStore.js
import { useState, useEffect, useCallback } from "react";

export function useEventStore(api) {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try { setEvents(await api.listEvents()); setError(null); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [api]);

  useEffect(() => { reload(); }, [reload]);

  const add = useCallback(async (payload) => {
    const temp = { ...payload, id: `tmp-${Date.now()}` };
    setEvents((p) => [...p, temp]);                         // 낙관적 추가
    try {
      const saved = await api.createEvent(payload);
      setEvents((p) => p.map((e) => (e.id === temp.id ? saved : e)));
      return saved;
    } catch (e) { setEvents((p) => p.filter((e) => e.id !== temp.id)); setError(e.message); } // 롤백
  }, [api]);

  const update = useCallback(async (id, patch) => {
    const prev = events;
    setEvents((p) => p.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    try { const saved = await api.updateEvent(id, patch); setEvents((p) => p.map((e) => (e.id === id ? saved : e))); }
    catch (e) { setEvents(prev); setError(e.message); }
  }, [api, events]);

  const remove = useCallback(async (id) => {
    const prev = events;
    setEvents((p) => p.filter((e) => e.id !== id));
    try { await api.deleteEvent(id); } catch (e) { setEvents(prev); setError(e.message); }
  }, [api, events]);

  return { events, error, loading, add, update, remove, reload };
}