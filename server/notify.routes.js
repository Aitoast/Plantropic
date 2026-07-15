// server/notify.routes.js — 알림 설정 / 위치 보고 / 테스트 발송 / 앱 인박스 (모두 requireAuth)
//   GET  /api/notify/settings          현재 설정 조회
//   PUT  /api/notify/settings          설정 저장 (notify.js 상단 주석의 형태)
//   POST /api/notify/location          { lat, lng }  — 모바일이 주기적으로 현재 위치 보고 (이동알림 출발지)
//   POST /api/notify/test              설정된 모든 채널로 테스트 발송
//   POST /api/notify/inbox             { text } — 앱 알림창에서 답장한 자연어 → 에이전트/미루기 라우팅
import { Router } from "express";
import { requireAuth } from "./auth.routes.js";
import { getSettings, saveSettings, sendToUser } from "./notify.js";
import { handleInbound } from "./inbound.js";

const router = Router();
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
router.use(requireAuth);

router.get("/settings", h(async (req, res) => {
  res.json((await getSettings(req.userId)) ?? { channels: {}, remindMin: 30, emptySlotMin: 0 });
}));

router.put("/settings", h(async (req, res) => {
  const prev = (await getSettings(req.userId)) ?? {};
  const cfg = { ...prev, ...req.body, channels: { ...(prev.channels ?? {}), ...(req.body?.channels ?? {}) } };
  res.json(await saveSettings(req.userId, cfg));
}));

router.post("/location", h(async (req, res) => {
  const lat = parseFloat(req.body?.lat), lng = parseFloat(req.body?.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng))
    return res.status(400).json({ message: "lat, lng 가 필요합니다." });
  const prev = (await getSettings(req.userId)) ?? {};
  await saveSettings(req.userId, { ...prev, lastLocation: { lat, lng, at: new Date().toISOString() } });
  res.json({ ok: true });
}));

router.post("/test", h(async (req, res) => {
  const sent = await sendToUser(req.userId, "✅ Plantropic 알림 테스트", "이 메시지가 보이면 채널 연결 성공!");
  res.json({ sent, ok: sent.length > 0,
    message: sent.length ? `발송됨: ${sent.join(", ")}` : "설정된 채널이 없거나 모두 실패했어요." });
}));

router.post("/inbox", h(async (req, res) => {
  res.json(await handleInbound(req.userId, req.body?.text));
}));

export default router;
