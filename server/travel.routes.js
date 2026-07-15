// server/travel.routes.js — 현재 위치 → 다음 일정까지 대중교통 이동시간 (에이전트 아님)
//   GET /api/travel/next?lat=..&lng=..   (모바일이 GPS로 즉석 조회할 때)
//   ※ 서버가 알아서 미리 알려주는 사전알림은 scheduler.js 가 담당
//     (출발권장시각 = 일정시작 - 이동시간 - 준비 30분 에 도달하면 알림 발송)
import { Router } from "express";
import { db } from "./db.js";
import { requireAuth } from "./auth.routes.js";
import { geocode, transitMinutes, computeLeaveBy, mapsConfigured } from "./maps.js";

const router = Router();
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
router.use(requireAuth);

const PREP = Number(process.env.PREP_MINUTES ?? 30);           // 준비시간(분)
const THRESHOLD = Number(process.env.TRANSIT_ALERT_MIN ?? 10); // 이 분 이상일 때만 알림

router.get("/next", h(async (req, res) => {
  const lat = parseFloat(req.query.lat), lng = parseFloat(req.query.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng))
    return res.status(400).json({ message: "현재 위치(lat,lng)가 필요합니다." });

  const now = req.query.now ? new Date(req.query.now) : new Date();
  const rows = await db.listEvents(req.userId, { from: now.toISOString() });
  const next = rows.find((e) => new Date(e.starts_at) > now) ?? null;

  if (!next) return res.json({ hasNext: false, message: "예정된 다음 일정이 없어요." });
  if (!next.location)
    return res.json({ hasNext: true, alert: false, message: `다음 일정 "${next.title}"의 장소가 없어요.` });
  if (!mapsConfigured)
    return res.json({ hasNext: true, configured: false, message: "지도 API 키(KAKAO_REST_API_KEY)를 설정하면 이동시간을 계산합니다." });

  const dest = await geocode(next.location);
  if (!dest) return res.json({ hasNext: true, alert: false, message: `"${next.location}" 위치를 찾지 못했어요.` });

  const { minutes, source } = await transitMinutes({ lat, lng }, dest);
  const event = { id: next.id, title: next.title, location: next.location, startsAt: next.starts_at };

  if (minutes < THRESHOLD) {
    return res.json({ hasNext: true, alert: false, travelMinutes: minutes, source, event,
      message: `다음 일정 "${next.title}"까지 대중교통 약 ${minutes}분 — 가까워요.` });
  }

  const { total, leaveBy, hhmm } = computeLeaveBy(next.starts_at, minutes, PREP);
  res.json({
    hasNext: true, alert: true, source, event,
    travelMinutes: minutes, prepMinutes: PREP, totalMinutes: total,
    leaveBy: leaveBy.toISOString(), leaveByLabel: hhmm,
    message: `"${next.title}"(${next.location})까지 대중교통 약 ${minutes}분 + 준비 ${PREP}분 = ${total}분 필요. 늦지 않으려면 ${hhmm}까지 출발하세요.`,
  });
}));

export default router;
