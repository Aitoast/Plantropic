// server/agent/service.js — 에이전트 실행 서비스 (HTTP 라우트·채팅 채널 공용)
//   runQuickAdd(userId, text)                 → { threadId, status, ... }
//   resumeQuickAdd(userId, threadId, decision) → { threadId, status, ... }
import { randomUUID } from "crypto";
import { MemorySaver, Command } from "@langchain/langgraph";
import { buildQuickAddGraph, makeChatModel } from "./graph.js";

// 체크포인터: DATABASE_URL 있으면 Postgres(재시작에도 대기중 confirm 유지), 없으면 메모리
async function makeCheckpointer() {
  const url = process.env.DATABASE_URL;
  if (!url) return new MemorySaver();
  const { PostgresSaver } = await import("@langchain/langgraph-checkpoint-postgres");
  const { Pool } = await import("pg");
  const needSsl = /sslmode=require|neon\.tech|supabase|render\.com|amazonaws|azure/.test(url);
  const pool = new Pool({ connectionString: url, ssl: needSsl ? { rejectUnauthorized: false } : undefined });
  const saver = new PostgresSaver(pool);
  await saver.setup();
  console.log("에이전트 체크포인터: Postgres (재시작에도 대기중 작업 유지)");
  return saver;
}
export const checkpointer = await makeCheckpointer();

// 채널별(유저별) 마지막 confirm 대기 스레드 — 채팅 답장 "네/아니오"를 이어붙이기 위함
const pendingConfirm = new Map(); // userId -> { threadId, at }
export const getPendingConfirm = (userId) => pendingConfirm.get(userId) ?? null;
export const clearPendingConfirm = (userId) => pendingConfirm.delete(userId);

function formatResult(threadId, out) {
  const itr = out.__interrupt__?.[0]?.value;
  if (itr) return { threadId, status: "needs_confirmation", ...itr };
  if (out.result?.ok) return { threadId, status: "done", result: out.result,
    message: `✅ 일정 등록: "${out.result.title}"` };
  return { threadId, status: "done", result: out.result,
    message: out.result?.error ?? out.result?.reason ?? "완료" };
}

export async function runQuickAdd(userId, text) {
  const model = await makeChatModel();
  if (!model) return { status: "error", message: "AI 키(ANTHROPIC/OPENAI/GEMINI_API_KEY)를 설정하면 동작합니다." };
  const threadId = randomUUID();
  const graph = buildQuickAddGraph({ userId, model, checkpointer });
  const out = await graph.invoke({ text }, { configurable: { thread_id: threadId } });
  const res = formatResult(threadId, out);
  if (res.status === "needs_confirmation") pendingConfirm.set(userId, { threadId, at: Date.now() });
  return res;
}

export async function resumeQuickAdd(userId, threadId, decision) {
  const model = await makeChatModel();
  if (!model) return { status: "error", message: "AI 키 필요" };
  const graph = buildQuickAddGraph({ userId, model, checkpointer });
  const out = await graph.invoke(new Command({ resume: decision }), { configurable: { thread_id: threadId } });
  const res = formatResult(threadId, out);
  if (res.status !== "needs_confirmation" && pendingConfirm.get(userId)?.threadId === threadId)
    pendingConfirm.delete(userId);
  return res;
}
