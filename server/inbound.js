// server/inbound.js — 채팅/알림 답장 한 줄을 해석해 알맞은 곳으로 라우팅 (채널 공용)
//   1) confirm 대기 중이면: "네/응/ok/등록" → 승인, "아니오/취소" → 거절
//   2) "30분 미뤄줘" / "전체 1시간 연기" → shift 기능 (에이전트 아님)
//   3) 그 외 → 퀵애드 에이전트 (자연어 → 일정 변환 → confirm)
import { runQuickAdd, resumeQuickAdd, getPendingConfirm } from "./agent/service.js";
import { shiftEvent, findNextEvent } from "./reschedule.js";

const YES = /^(네|넹|예|응|어|좋아|등록|ㅇㅋ|ok|yes|y)\b/i;
const NO = /^(아니|아뇨|취소|싫어|no|n)\b/i;
// "30분 미뤄", "1시간 늦춰줘", "전체 40분 연기"
const SHIFT = /(전체\s*)?(?:(\d+)\s*시간)?\s*(?:(\d+)\s*분)?\s*(미뤄|미루|연기|늦춰|밀어)/;

export async function handleInbound(userId, rawText) {
  const text = (rawText ?? "").trim();
  if (!text) return { message: "내용이 비어 있어요." };

  // 1) confirm 대기 응답
  const pending = getPendingConfirm(userId);
  if (pending && (YES.test(text) || NO.test(text))) {
    const out = await resumeQuickAdd(userId, pending.threadId, { approve: YES.test(text) });
    return { kind: "confirm", ...out };
  }

  // 2) 미루기 (기능) — 대상은 다음 일정
  const m = text.match(SHIFT);
  if (m && (m[2] || m[3])) {
    const delta = (Number(m[2] ?? 0) * 60) + Number(m[3] ?? 0);
    const cascade = !!m[1] || /전체|다\s*같이|이후/.test(text);
    const next = await findNextEvent(userId);
    if (!next) return { kind: "shift", message: "미룰 다음 일정이 없어요." };
    const out = await shiftEvent(userId, next.id, delta, cascade);
    return { kind: "shift", ...out };
  }

  // 3) 퀵애드 에이전트
  const out = await runQuickAdd(userId, text);
  return { kind: "quick-add", ...out };
}
