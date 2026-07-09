// core/useEventStore.js — 웹·모바일 공용 낙관적 업데이트 훅 (React)
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
