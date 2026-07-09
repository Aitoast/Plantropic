// core/eventAdapter.js — 서버(ISO 절대시각) ↔ 캘린더 UI(day + 소수시간) 변환
export const toDec = (v) => {
  if (typeof v === "number") return v;
  const [h, m] = String(v).split(":").map(Number);
  return h + (m || 0) / 60;
};
export const decFromDate = (d) => d.getHours() + d.getMinutes() / 60;

// (연, 월[0~11], 일, 소수시간) → ISO
export function toISO(year, month, day, dec) {
  const d = toDec(dec);
  const h = Math.floor(d);
  const min = Math.round((d - h) * 60);
  return new Date(year, month, day, h, min).toISOString();
}

// 서버 이벤트 → UI 이벤트
export function toUiEvent(srv) {
  const s = new Date(srv.startsAt);
  const e = new Date(srv.endsAt);
  return {
    id: srv.id, cal: srv.calKey, title: srv.title,
    year: s.getFullYear(), month: s.getMonth(), day: s.getDate(),
    start: decFromDate(s), end: decFromDate(e),
    loc: srv.location ?? "", desc: srv.summary ?? "",
  };
}

// UI 폼 + 현재 연·월 → 서버 payload
export function toServerPayload(form, year, month) {
  return {
    calKey: form.cal,
    title: (form.title ?? "").trim(),
    startsAt: toISO(year, month, Number(form.day), form.start),
    endsAt: toISO(year, month, Number(form.day), form.end),
    location: form.loc || null,
    summary: form.desc || null,
  };
}
