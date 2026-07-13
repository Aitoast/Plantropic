// server/ai/analyze.js — 규칙 레이어(LLM 없이 동작). 순수 함수라 테스트 쉬움.
// 입력 event 모양: { id, calKey, title, startsAt(ISO), endsAt(ISO), location, summary }

const WD = ["일", "월", "화", "수", "목", "금", "토"];

// 그 주의 일요일(자정)을 주 식별자로
function weekKey(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x.toISOString().slice(0, 10);
}
export function startOfWeek(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

// 주간 반복 패턴 감지: (요일+시각+제목) 이 서로 다른 주에 minWeeks회 이상
export function detectWeeklyPatterns(events, { minWeeks = 2 } = {}) {
  const groups = new Map();
  for (const e of events) {
    const s = new Date(e.startsAt), en = new Date(e.endsAt);
    const key = `${s.getDay()}|${s.getHours()}|${(e.title || "").trim()}`;
    const g = groups.get(key) ?? {
      weekday: s.getDay(), weekdayLabel: WD[s.getDay()], hour: s.getHours(),
      title: (e.title || "").trim(), calKey: e.calKey,
      location: e.location || "", durationH: Math.max(0.5, (en - s) / 3.6e6),
      weeks: new Set(), count: 0,
    };
    g.weeks.add(weekKey(s));
    g.count++;
    groups.set(key, g);
  }
  return [...groups.values()]
    .filter((g) => g.weeks.size >= minWeeks)
    .map(({ weeks, ...g }) => ({ ...g, weekSpan: weeks.size }))
    .sort((a, b) => b.weekSpan - a.weekSpan || b.count - a.count);
}

// 대상 주(weekStart=일요일)에서 패턴 슬롯 중 아직 비어 있는 것 → 채움 후보 이벤트
export function missingFromPatterns(patterns, events, weekStart) {
  const ws = startOfWeek(weekStart);
  const wsEnd = new Date(ws.getTime() + 7 * 24 * 3.6e6);
  // "이미 있음" 판정은 대상 주 안의 일정만 대상으로 (패턴 자신과 충돌 방지)
  const existing = new Set(
    events
      .filter((e) => {
        const s = new Date(e.startsAt);
        return s >= ws && s < wsEnd;
      })
      .map((e) => {
        const s = new Date(e.startsAt);
        return `${s.getDay()}|${s.getHours()}|${(e.title || "").trim()}`;
      })
  );
  const out = [];
  for (const p of patterns) {
    const slot = `${p.weekday}|${p.hour}|${p.title}`;
    if (existing.has(slot)) continue; // 이번 주에 이미 있음
    const start = new Date(ws);
    start.setDate(ws.getDate() + p.weekday);
    start.setHours(p.hour, 0, 0, 0);
    const end = new Date(start.getTime() + p.durationH * 3.6e6);
    out.push({
      calKey: p.calKey, title: p.title, location: p.location,
      startsAt: start.toISOString(), endsAt: end.toISOString(),
      reason: `지난 ${p.weekSpan}주간 매주 ${p.weekdayLabel} ${p.hour}시에 "${p.title}" 일정이 있었어요.`,
    });
  }
  return out;
}

// 지금(now) 기준: 다음 일정과 그 직전 일정(이동 출발지) 구간
export function findNextHop(events, now = new Date()) {
  const sorted = [...events].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const next = sorted.find((e) => new Date(e.startsAt) > now);
  if (!next) return null;
  // next 보다 먼저 시작하는 것들 중 마지막 = 직전 일정(현재 위치의 근거)
  const before = sorted.filter((e) => new Date(e.startsAt) <= new Date(next.startsAt) && e.id !== next.id);
  const from = before.length ? before[before.length - 1] : null;
  const gapMinutes = from ? Math.round((new Date(next.startsAt) - new Date(from.endsAt)) / 60000) : null;
  return { from, to: next, gapMinutes };
}
