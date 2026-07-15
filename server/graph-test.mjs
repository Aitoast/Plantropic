// graph-test.mjs — 새 LangGraph 파이프라인 검증 (LLM 키 불필요: 스텁 모델)
import { MemorySaver, Command } from "@langchain/langgraph";
import { db } from "./db.js";
import { buildQuickAddGraph } from "./agent/graph.js";
import { shiftEvent, findNextEvent } from "./reschedule.js";

let pass = 0, fail = 0;
const ok = (name, cond) => { cond ? pass++ : fail++; console.log(`${cond ? "✓" : "✗"} ${name}`); };

// 준비: 유저 + 기본 캘린더 + 기존 일정 1건
const user = await db.createUser({ name: "테스터", email: "t@t.t" });
await db.seedCalendars(user.id);
const cal = await db.findCalendar(user.id, "personal");
const now = new Date("2026-07-15T09:00:00");
await db.createEvent(user.id, {
  calendar_id: cal.id, title: "기존 회의",
  starts_at: new Date("2026-07-16T15:30:00").toISOString(),
  ends_at: new Date("2026-07-16T16:30:00").toISOString(),
  location: "판교역", summary: null, all_day: false,
});

// 스텁 LLM: withStructuredOutput(schema) → invoke 가 정해진 초안을 순서대로 반환
function stubModel(drafts) {
  let i = 0;
  return { withStructuredOutput: () => ({ invoke: async () => drafts[Math.min(i++, drafts.length - 1)] }) };
}

const checkpointer = new MemorySaver();

// ── 1) 정상 흐름: parse → check → confirm(멈춤) → 승인 → commit ──
{
  const model = stubModel([{ title: "김대리 미팅", year: 2026, month: 7, day: 16, startHour: 15,
    startMinute: 0, durationMin: 60, location: "강남역", summary: "주간 미팅", calKey: "meeting" }]);
  const g = buildQuickAddGraph({ userId: user.id, now, model, checkpointer });
  const cfg = { configurable: { thread_id: "t1" } };
  const out = await g.invoke({ text: "내일 오후 3시 강남역에서 김대리랑 미팅" }, cfg);
  const itr = out.__interrupt__?.[0]?.value;
  ok("confirm 에서 멈춤 (needs_confirmation)", !!itr && itr.type === "confirm");
  ok("초안에 날짜/장소 반영", itr?.draft?.label === "2026-07-16 15:00" && itr?.draft?.location === "강남역");
  ok("겹치는 기존 일정 감지 (15:30 회의)", itr?.conflicts?.length === 1);

  const out2 = await g.invoke(new Command({ resume: { approve: true } }), cfg);
  ok("승인 후 commit 결과", out2.result?.ok === true);
  const rows = await db.listEvents(user.id);
  ok("DB에 등록됨", rows.some((e) => e.title === "김대리 미팅"));
}

// ── 2) 거절 흐름 ──
{
  const model = stubModel([{ title: "저녁약속", year: 2026, month: 7, day: 17, startHour: 19,
    startMinute: 0, durationMin: 90, location: "홍대", summary: null, calKey: "personal" }]);
  const g = buildQuickAddGraph({ userId: user.id, now, model, checkpointer });
  const cfg = { configurable: { thread_id: "t2" } };
  await g.invoke({ text: "금요일 저녁 7시 홍대" }, cfg);
  const out = await g.invoke(new Command({ resume: { approve: false, reason: "취소" } }), cfg);
  ok("거절 시 cancelled", out.result?.cancelled === true);
  ok("거절한 일정은 DB에 없음", !(await db.listEvents(user.id)).some((e) => e.title === "저녁약속"));
}

// ── 3) 검증 실패 → parse 재시도 루프 ──
{
  const model = stubModel([
    { title: "과거 일정", year: 2026, month: 7, day: 1, startHour: 10, startMinute: 0, durationMin: 60, location: null, summary: null, calKey: "personal" }, // 과거 → issue
    { title: "고쳐진 일정", year: 2026, month: 7, day: 20, startHour: 10, startMinute: 0, durationMin: 60, location: null, summary: null, calKey: "personal" },
  ]);
  const g = buildQuickAddGraph({ userId: user.id, now, model, checkpointer });
  const cfg = { configurable: { thread_id: "t3" } };
  const out = await g.invoke({ text: "다음 주 언젠가 10시" }, cfg);
  const itr = out.__interrupt__?.[0]?.value;
  ok("과거날짜 초안 → 재시도 후 confirm 도달", itr?.draft?.title === "고쳐진 일정");
}

// ── 4) 미루기 기능 (에이전트 아님): 단건 + cascade ──
{
  const d = "2026-07-18";
  const mk = (t, h) => db.createEvent(user.id, { calendar_id: cal.id, title: t,
    starts_at: new Date(`${d}T${h}:00:00`).toISOString(), ends_at: new Date(`${d}T${h}:50:00`).toISOString(),
    location: null, summary: null, all_day: false });
  const a = await mk("A수업", "10"); await mk("B수업", "13"); await mk("C수업", "15");

  const single = await shiftEvent(user.id, a.id, 30, false);
  ok("단건 미루기 1건만 이동", single.ok && single.moved.length === 1);

  const casc = await shiftEvent(user.id, a.id, 30, true);
  ok("cascade 미루기: A 이후 같은 날 전부 이동", casc.ok && casc.moved.length === 3);
  const rows = await db.listEvents(user.id);
  const b = rows.find((e) => e.title === "B수업");
  ok("B수업이 13:00→13:30 로 밀림", new Date(b.starts_at).getHours() === 13 && new Date(b.starts_at).getMinutes() === 30);
}

// ── 5) 다음 일정 찾기 ──
{
  const next = await findNextEvent(user.id, new Date("2026-07-16T00:00:00"));
  ok("findNextEvent 가 가장 이른 미래 일정 반환", !!next && new Date(next.starts_at) > new Date("2026-07-16T00:00:00"));
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
