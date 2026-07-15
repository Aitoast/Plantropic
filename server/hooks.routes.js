// server/hooks.routes.js — 외부 채팅 서비스 인바운드 웹훅 (인증 없음 → 자체 검증)
//
//   슬랙: Slack App → Event Subscriptions → Request URL 을
//         https://<서버>/api/hooks/slack 로 등록, message.im 이벤트 구독.
//         유저 매핑: 알림 설정의 channels.slack.userId (슬랙 멤버 ID, U로 시작)
//         답신: channels.slack.webhook (Incoming Webhook) 으로 발송.
//   ※ 디스코드/카카오 인바운드는 봇 계정이 필요해 이 파일엔 미구현 —
//     아웃바운드(알림)는 notify.js 가 지원하고, 답장은 앱의 /api/notify/inbox 를 쓰세요.
import { Router } from "express";
import { findUserBySlackId, sendToUser } from "./notify.js";
import { handleInbound } from "./inbound.js";

const router = Router();
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// 중복 이벤트 방지 (슬랙은 3초 내 미응답 시 재전송함)
const seen = new Set();

router.post("/slack", h(async (req, res) => {
  const body = req.body ?? {};

  // 슬랙 URL 검증 핸드셰이크
  if (body.type === "url_verification") return res.json({ challenge: body.challenge });

  // (선택) 토큰 검증 — Slack App Basic Info 의 Verification Token 을 .env 에
  if (process.env.SLACK_VERIFY_TOKEN && body.token !== process.env.SLACK_VERIFY_TOKEN)
    return res.status(401).end();

  res.json({ ok: true }); // 슬랙엔 즉시 200 (3초 제한) — 처리는 이어서

  const ev = body.event;
  if (!ev || ev.type !== "message" || ev.bot_id || ev.subtype) return;
  if (seen.has(body.event_id)) return;
  seen.add(body.event_id);

  const userId = await findUserBySlackId(ev.user);
  if (!userId) return;

  const out = await handleInbound(userId, ev.text);
  // 결과를 같은 유저의 슬랙 웹훅으로 답신
  const reply = out.status === "needs_confirmation"
    ? `${out.message}\n(답장: "네" 등록 / "아니오" 취소)`
    : out.message ?? "처리했어요.";
  await sendToUser(userId, "Plantropic", reply);
}));

export default router;
