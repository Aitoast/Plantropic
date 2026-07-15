// server/agent/graph.js — 퀵애드 에이전트 (LangGraph 구조화 파이프라인)
//
//   알림(앱푸시/카카오/디스코드/슬랙)에 자연어로 답장한 문장을
//   프로젝트의 일정 데이터(년/월/일/시간/장소/요약)로 변환·검증·등록한다.
//
//   START → parse → check ─(문제 있으면 parse 재시도, 최대 2회)→ confirm(HITL 멈춤) → commit → END
//                                                                └(거절)→ cancel → END
//
//   각 단계가 그래프 노드로 분리되어 있어 상태(draft/issues/conflicts)가
//   체크포인터에 그대로 저장된다 → 서버가 재시작돼도 confirm 대기중인 흐름이 유지됨.
import { Annotation, StateGraph, START, END, interrupt } from "@langchain/langgraph";
import { z } from "zod";
import { db } from "../db.js";

// ── LLM이 채우는 구조화 초안 (프로젝트 일정 등록 폼과 같은 필드) ──
const DraftSchema = z.object({
  title: z.string().describe("일정 제목 (간결하게)"),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  startHour: z.number().int().min(0).max(23),
  startMinute: z.number().int().min(0).max(59).default(0),
  durationMin: z.number().int().min(5).max(720).default(60).describe("언급 없으면 60"),
  location: z.string().nullable().describe("장소. 없으면 null"),
  summary: z.string().nullable().describe("한 줄 요약/메모. 없으면 null"),
  calKey: z.enum(["personal", "work", "meeting", "deadline", "team", "family"])
    .default("personal").describe("내용에 맞는 캘린더 분류"),
});

// ── 그래프 상태: 메시지 나열이 아니라 명시적 필드 (LangGraph Annotation) ──
const QuickAddState = Annotation.Root({
  text:      Annotation(),                                              // 사용자가 보낸 자연어 원문
  draft:     Annotation(),                                              // LLM이 만든 구조화 초안
  payload:   Annotation(),                                              // DB에 넣을 최종 형태(startsAt/endsAt ISO)
  issues:    Annotation({ reducer: (_, b) => b ?? [], default: () => [] }), // 검증 실패 사유
  attempts:  Annotation({ reducer: (a, b) => b ?? a, default: () => 0 }),   // parse 재시도 횟수
  conflicts: Annotation({ reducer: (_, b) => b ?? [], default: () => [] }), // 겹치는 기존 일정
  decision:  Annotation(),                                              // confirm 에서 받은 사용자 응답
  result:    Annotation(),                                              // 최종 결과
});

const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => new Date(d).toISOString();

function draftToPayload(draft) {
  const start = new Date(draft.year, draft.month - 1, draft.day, draft.startHour, draft.startMinute ?? 0);
  const end = new Date(start.getTime() + (draft.durationMin ?? 60) * 60000);
  return {
    calKey: draft.calKey ?? "personal",
    title: draft.title,
    startsAt: toISO(start),
    endsAt: toISO(end),
    location: draft.location ?? null,
    summary: draft.summary ?? null,
    label: `${draft.year}-${pad(draft.month)}-${pad(draft.day)} ${pad(draft.startHour)}:${pad(draft.startMinute ?? 0)}`,
  };
}

export function buildQuickAddGraph({ userId, now = new Date(), model, checkpointer }) {
  // ① parse — 자연어 → 구조화 초안 (재시도 시 issues 를 힌트로 전달)
  const parse = async (state) => {
    const hints = state.issues.length
      ? `\n\n이전 시도의 문제점을 고쳐서 다시 만들어줘: ${state.issues.join(" / ")}`
      : "";
    const structured = model.withStructuredOutput
      ? model.withStructuredOutput(DraftSchema, { name: "event_draft" })
      : model; // 테스트 스텁 허용
    const draft = await structured.invoke(
      `너는 일정 비서다. 현재 시각은 ${now.toISOString()} (KST 기준 해석).\n` +
      `아래 문장을 일정 데이터로 변환해줘. "다음 주", "내일", "모레" 같은 상대 표현은 현재 시각 기준으로 계산.\n` +
      `문장: "${state.text}"${hints}`
    );
    return { draft, attempts: state.attempts + 1 };
  };

  // ② check — LLM 없이 결정적으로 검증 + DB 충돌 검사
  const check = async (state) => {
    const issues = [];
    const d = state.draft;
    if (!d?.title?.trim()) issues.push("제목이 비어 있음");
    const start = new Date(d.year, d.month - 1, d.day, d.startHour, d.startMinute ?? 0);
    if (isNaN(start.getTime())) issues.push("날짜/시간이 유효하지 않음");
    else {
      if (d.day > new Date(d.year, d.month, 0).getDate()) issues.push(`${d.month}월에는 ${d.day}일이 없음`);
      if (start.getTime() < now.getTime() - 60000) issues.push("과거 시각임 — 미래 시각으로 해석해야 함");
    }
    if (issues.length) return { issues, conflicts: [], payload: null };

    const payload = draftToPayload(d);
    // 같은 시간대에 겹치는 기존 일정 (알려만 주고 등록은 사용자 판단)
    const dayFrom = new Date(d.year, d.month - 1, d.day, 0, 0).toISOString();
    const dayTo = new Date(d.year, d.month - 1, d.day + 1, 0, 0).toISOString();
    const rows = await db.listEvents(userId, { from: dayFrom, to: dayTo });
    const conflicts = rows
      .filter((e) => new Date(e.starts_at) < new Date(payload.endsAt) &&
                     new Date(e.ends_at) > new Date(payload.startsAt))
      .map((e) => ({ id: e.id, title: e.title, startsAt: e.starts_at, endsAt: e.ends_at }));
    return { issues: [], payload, conflicts };
  };

  // ③ confirm — HITL: 사용자 응답이 올 때까지 그래프 정지 (체크포인터에 저장됨)
  const confirm = async (state) => {
    const decision = interrupt({
      type: "confirm",
      draft: state.payload,
      conflicts: state.conflicts,
      message:
        `"${state.payload.title}" — ${state.payload.label}` +
        (state.payload.location ? ` @ ${state.payload.location}` : "") +
        (state.conflicts.length ? ` (⚠ 겹치는 일정 ${state.conflicts.length}건)` : "") +
        `\n등록할까요?`,
    });
    return { decision };
  };

  // ④ commit — 승인 시에만 DB 반영 (사용자 수정사항 edits 반영)
  const commit = async (state) => {
    const p = { ...state.payload, ...(state.decision?.edits ?? {}) };
    const cal = (await db.findCalendar(userId, p.calKey)) || (await db.findCalendar(userId, "personal"));
    const row = await db.createEvent(userId, {
      calendar_id: cal.id, title: p.title, starts_at: p.startsAt, ends_at: p.endsAt,
      location: p.location, summary: p.summary, all_day: false,
    });
    return { result: { ok: true, id: row.id, title: row.title, startsAt: row.starts_at, location: row.location } };
  };

  const cancel = async (state) => ({
    result: { ok: false, cancelled: true, reason: state.decision?.reason ?? "사용자가 취소함" },
  });

  const failed = async (state) => ({
    result: { ok: false, error: `일정으로 해석하지 못했어요: ${state.issues.join(", ")}` },
  });

  // 라우팅: 검증 실패 → 재시도(최대 2회) 또는 실패 / 통과 → confirm
  const afterCheck = (state) =>
    state.issues.length ? (state.attempts < 2 ? "parse" : "failed") : "confirm";
  const afterConfirm = (state) => (state.decision?.approve ? "commit" : "cancel");

  return new StateGraph(QuickAddState)
    .addNode("parse", parse)
    .addNode("check", check)
    .addNode("confirm", confirm)
    .addNode("commit", commit)
    .addNode("cancel", cancel)
    .addNode("failed", failed)
    .addEdge(START, "parse")
    .addEdge("parse", "check")
    .addConditionalEdges("check", afterCheck, ["parse", "confirm", "failed"])
    .addConditionalEdges("confirm", afterConfirm, ["commit", "cancel"])
    .addEdge("commit", END)
    .addEdge("cancel", END)
    .addEdge("failed", END)
    .compile({ checkpointer });
}

// ── LLM 선택: AI_PROVIDER(또는 존재하는 키)에 따라 Claude / GPT / Gemini ──
// 세 클래스 모두 withStructuredOutput 을 지원하므로 파이프라인은 프로바이더 무관.
export async function makeChatModel() {
  const provider = process.env.AI_PROVIDER ||
    (process.env.ANTHROPIC_API_KEY ? "claude" :
     process.env.OPENAI_API_KEY   ? "openai" :
     process.env.GEMINI_API_KEY   ? "gemini" : null);
  if (!provider) return null;
  switch (provider.toLowerCase()) {
    case "openai": { const { ChatOpenAI } = await import("@langchain/openai");
      return new ChatOpenAI({ model: process.env.OPENAI_MODEL || "gpt-4o", maxTokens: 1024 }); }
    case "gemini": { const { ChatGoogleGenerativeAI } = await import("@langchain/google-genai");
      return new ChatGoogleGenerativeAI({ model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
        apiKey: process.env.GEMINI_API_KEY, maxOutputTokens: 1024 }); }
    case "claude": default: { const { ChatAnthropic } = await import("@langchain/anthropic");
      return new ChatAnthropic({ model: process.env.ANTHROPIC_MODEL || "claude-opus-4-8", maxTokens: 1024 }); }
  }
}
