// server/agent.routes.js — LangGraph 스케줄러 에이전트 (HITL). 모두 requireAuth.
import { Router } from "express";
import { randomUUID } from "crypto";
import { MemorySaver, Command } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { requireAuth } from "./auth.routes.js";
import { buildGraph, makeChatModel } from "./agent/graph.js";

const router = Router();
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
router.use(requireAuth);

// 프로세스 내 상태 유지(요청 간 재개용). 영속 필요 시 Postgres 체크포인터로 교체.
const checkpointer = new MemorySaver();

// 4개 기능 = 같은 그래프, 다른 진입 지시
const PROMPTS = {
  "quick-add":     (i) => `다음 자연어를 해석해 적절한 일정으로 만들어 create_event 로 제안해줘: "${i.text ?? ""}"`,
  "reschedule":    (i) => `일정 "${i.eventId ?? ""}"가 취소/변경됐어. search_events 와 find_free_slots 로 최적 대체 시간을 찾아 move_event 로 제안해줘.`,
  "travel-buffer": ()  => `오늘 일정들을 검토해, 장소 이동이 필요한 연속 일정 사이에 travel_time 으로 이동시간을 구하고 '이동' 버퍼 일정을 create_event 로 제안해줘.`,
  "nudge":         ()  => `get_goals 로 목표를 보고, find_free_slots 로 이번 주 한가한 시간을 찾아 목표 일정을 create_event 로 제안해줘.`,
};

function formatResult(threadId, out) {
  const itr = out.__interrupt__?.[0]?.value;
  if (itr) return { threadId, status: "needs_confirmation", ...itr }; // 클라가 확인 UI 표시
  const last = out.messages.at(-1);
  return { threadId, status: "done", message: last?.content ?? "" };
}

// 에이전트 실행 (기능 지정). 멈추면 needs_confirmation, 아니면 done.
router.post("/run", h(async (req, res) => {
  const model = await makeChatModel();
  if (!model) return res.status(400).json({ message: "ANTHROPIC_API_KEY 를 설정하면 AI 에이전트가 동작합니다." });
  const { feature = "quick-add", input = {} } = req.body ?? {};
  const prompt = (PROMPTS[feature] ?? PROMPTS["quick-add"])(input);
  const threadId = randomUUID();
  const graph = buildGraph({ userId: req.userId, model, checkpointer });
  const out = await graph.invoke({ messages: [new HumanMessage(prompt)] }, { configurable: { thread_id: threadId } });
  res.json(formatResult(threadId, out));
}));

// 사용자 확인(승인/거절/수정) 후 재개
router.post("/resume", h(async (req, res) => {
  const model = await makeChatModel();
  if (!model) return res.status(400).json({ message: "ANTHROPIC_API_KEY 필요" });
  const { threadId, decision } = req.body ?? {};
  if (!threadId) return res.status(400).json({ message: "threadId 가 필요합니다." });
  const graph = buildGraph({ userId: req.userId, model, checkpointer });
  const out = await graph.invoke(new Command({ resume: decision }), { configurable: { thread_id: threadId } });
  res.json(formatResult(threadId, out));
}));

export default router;
