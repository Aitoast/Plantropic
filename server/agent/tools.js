// server/agent/tools.js — 에이전트가 쥐는 도구들 (DB·지도에 연결). userId 로 스코프.
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { db } from "../db.js";
import { geocode, transitMinutes, mapsConfigured } from "../maps.js";

const toEvent = (r) => ({
  id: r.id, calKey: r.cal_key, title: r.title,
  startsAt: r.starts_at, endsAt: r.ends_at, location: r.location, summary: r.summary,
});

// MUTATING(쓰기) 도구 이름 — HITL 로 사용자 확인 후에만 실행
export const SENSITIVE = new Set(["create_event", "move_event"]);

export function makeTools(userId, now = new Date()) {
  const search_events = tool(
    async ({ fromISO, toISO }) => {
      const rows = await db.listEvents(userId, { from: fromISO, to: toISO });
      return JSON.stringify(rows.map(toEvent));
    },
    { name: "search_events", description: "사용자의 일정을 기간으로 조회한다.",
      schema: z.object({ fromISO: z.string().optional(), toISO: z.string().optional() }) }
  );

  const find_free_slots = tool(
    async ({ dateISO, durationMin = 60 }) => {
      const day = new Date(dateISO);
      const dayStart = new Date(day); dayStart.setHours(8, 0, 0, 0);
      const dayEnd = new Date(day); dayEnd.setHours(22, 0, 0, 0);
      const rows = (await db.listEvents(userId)).map(toEvent)
        .filter((e) => new Date(e.startsAt).toDateString() === day.toDateString())
        .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
      const slots = []; let cursor = dayStart;
      for (const e of rows) {
        const s = new Date(e.startsAt);
        if (s - cursor >= durationMin * 60000) slots.push({ startsAt: cursor.toISOString(), endsAt: s.toISOString() });
        const en = new Date(e.endsAt); if (en > cursor) cursor = en;
      }
      if (dayEnd - cursor >= durationMin * 60000) slots.push({ startsAt: cursor.toISOString(), endsAt: dayEnd.toISOString() });
      return JSON.stringify(slots);
    },
    { name: "find_free_slots", description: "특정 날짜에 비어 있는 시간대를 찾는다.",
      schema: z.object({ dateISO: z.string(), durationMin: z.number().optional() }) }
  );

  const travel_time = tool(
    async ({ fromLoc, toLoc }) => {
      if (!mapsConfigured) return JSON.stringify({ error: "지도 키 미설정" });
      const a = await geocode(fromLoc), b = await geocode(toLoc);
      if (!a || !b) return JSON.stringify({ error: "장소를 찾지 못함" });
      const { minutes, source } = await transitMinutes(a, b);
      return JSON.stringify({ minutes, source });
    },
    { name: "travel_time", description: "두 장소 사이 대중교통 이동시간(분)을 구한다.",
      schema: z.object({ fromLoc: z.string(), toLoc: z.string() }) }
  );

  const get_goals = tool(
    async () => JSON.stringify(await loadGoals(userId)),
    { name: "get_goals", description: "사용자의 장기 목표를 가져온다.", schema: z.object({}) }
  );

  const get_weather = tool(
    async ({ loc, dateISO }) => JSON.stringify({ loc, dateISO, note: "날씨 API 연동 필요(스텁)" }),
    { name: "get_weather", description: "특정 장소·시각의 날씨를 가져온다.",
      schema: z.object({ loc: z.string(), dateISO: z.string() }) }
  );

  // ── MUTATING (HITL 승인 후 실행) ──
  const create_event = tool(
    async ({ calKey = "personal", title, startsAt, endsAt, location }) => {
      const cal = await db.findCalendar(userId, calKey) || await db.findCalendar(userId, "personal");
      const row = await db.createEvent(userId, {
        calendar_id: cal.id, title, starts_at: startsAt, ends_at: endsAt,
        location: location ?? null, summary: null, all_day: false,
      });
      return JSON.stringify({ ok: true, id: row.id, title });
    },
    { name: "create_event", description: "새 일정을 DB에 추가한다. (사용자 확인 필요)",
      schema: z.object({ calKey: z.string().optional(), title: z.string(), startsAt: z.string(), endsAt: z.string(), location: z.string().optional() }) }
  );

  const move_event = tool(
    async ({ id, startsAt, endsAt }) => {
      const row = await db.updateEvent(userId, id, { starts_at: startsAt, ends_at: endsAt });
      return JSON.stringify({ ok: !!row, id });
    },
    { name: "move_event", description: "기존 일정의 시간을 옮긴다. (사용자 확인 필요)",
      schema: z.object({ id: z.string(), startsAt: z.string(), endsAt: z.string() }) }
  );

  const all = [search_events, find_free_slots, travel_time, get_goals, get_weather, create_event, move_event];
  const byName = Object.fromEntries(all.map((t) => [t.name, t]));
  return { all, byName };
}

// 목표 저장소(스텁). 실제론 goals 테이블 추가 권장.
async function loadGoals(_userId) {
  return [
    { title: "독서", perWeek: 3, durationMin: 60 },
    { title: "러닝", perWeek: 2, durationMin: 40 },
  ];
}
