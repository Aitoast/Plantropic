// teams-test.mjs — 팀 조율 엔진 검증 (LLM/네트워크 불필요)
import { db } from "./db.js";
import * as teams from "./teams.js";

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log(`${c ? "✓" : "✗"} ${n}`); };
const iso = (y, mo, d, h, mi = 0) => new Date(y, mo - 1, d, h, mi).toISOString();
const hourOf = (s) => new Date(s).getHours();

// 두 계정 A, B + 캘린더
const A = await db.createUser({ name: "앨리스", email: "a@t.t" });
const B = await db.createUser({ name: "밥", email: "b@t.t" });
await db.seedCalendars(A.id); await db.seedCalendars(B.id);
const calA = await db.findCalendar(A.id, "work");
const calB = await db.findCalendar(B.id, "work");
const ev = (uid, cal, title, s, e) => db.createEvent(uid, {
  calendar_id: cal.id, title, starts_at: s, ends_at: e, location: null, summary: null, all_day: false });

// 2026-08-10(월) 하루, 09~21시, 60분 슬롯으로 조율
// A: 10:00~12:00 바쁨 / B: 14:00~15:00, 18:00~19:00 바쁨
await ev(A.id, calA, "A회의", iso(2026, 8, 10, 10), iso(2026, 8, 10, 12));
await ev(B.id, calB, "B수업", iso(2026, 8, 10, 14), iso(2026, 8, 10, 15));
await ev(B.id, calB, "B약속", iso(2026, 8, 10, 18), iso(2026, 8, 10, 19));

const now = new Date("2026-08-10T08:00:00"); // 조율일 아침(과거 제외 테스트용)

// ── 초대·참여 ──
const m = await teams.createMeeting(A.id, {
  title: "팀 미팅", dateFrom: "2026-08-10", dateTo: "2026-08-10",
  earliestHour: 9, latestHour: 21, durationMin: 60,
});
ok("초대 토큰 생성", typeof m.token === "string" && m.token.length >= 10);
ok("주최자 자동 참여", (await teams.isMember(m.id, A.id)) === true);

// B 가 링크로 참여
const found = await teams.getByToken(m.token);
ok("토큰으로 조율 조회", found?.id === m.id);
await teams.join(m.id, B.id);
ok("멤버 2명", (await teams.members(m.id)).length === 2);

// ── 공통 빈 시간 제안 (A∪B busy 제외) ──
const { slots, memberCount } = await teams.proposeSlots(m.id, { now, limit: 20 });
ok("멤버 수 2 반영", memberCount === 2);
const starts = slots.map((s) => hourOf(s.startsAt));

ok("이른 시간(09시 이전) 없음", slots.every((s) => hourOf(s.startsAt) >= 9));
ok("늦은 시간(끝이 21시 초과) 없음", slots.every((s) => new Date(s.endsAt) <= new Date(iso(2026, 8, 10, 21))));
ok("A 바쁜 10~12시 슬롯 없음", !starts.includes(10) && !starts.includes(11));
ok("B 바쁜 14시 슬롯 없음", !starts.includes(14));
ok("B 바쁜 18시 슬롯 없음", !starts.includes(18));
ok("모두 비는 09시 제안됨", starts.includes(9));
ok("모두 비는 12시(정오) 제안됨", starts.includes(12));
ok("모두 비는 15/16시 제안됨", starts.includes(15) || starts.includes(16));

// ── 과거 제외: 지금을 13:10 로 두면 그 이전 슬롯 없음 ──
const later = new Date("2026-08-10T13:10:00");
const r2 = await teams.proposeSlots(m.id, { now: later, limit: 20 });
ok("현재(13:10) 이전 슬롯 없음", r2.slots.every((s) => new Date(s.startsAt) >= later));

// ── 확정: 주최자만, 전원 캘린더에 생성 ──
const notOwner = await teams.pickSlot(m.id, B.id, slots[0].startsAt);
ok("주최자 아니면 확정 거부", !!notOwner.error);
const picked = await teams.pickSlot(m.id, A.id, slots.find((s) => hourOf(s.startsAt) === 12).startsAt);
ok("확정 시 멤버 2명 캘린더에 생성", picked.ok && picked.created === 2);
const aHas = (await db.listEvents(A.id)).some((e) => e.title === "팀 미팅" && hourOf(e.starts_at) === 12);
const bHas = (await db.listEvents(B.id)).some((e) => e.title === "팀 미팅" && hourOf(e.starts_at) === 12);
ok("A·B 둘 다 12시에 '팀 미팅' 생성됨", aHas && bHas);

// ── 목록 ──
ok("A 목록에 조율 있음", (await teams.listForUser(A.id)).some((x) => x.id === m.id));
ok("B 목록에도 조율 있음(참여)", (await teams.listForUser(B.id)).some((x) => x.id === m.id));

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
