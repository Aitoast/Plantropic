// server/shift.routes.js — POST /api/events/:id/shift (events 라우터와 같은 경로에 추가 마운트)
//   body: { deltaMinutes: 30, cascade: true }
//   → 해당 일정을 30분 미루고, cascade 면 같은 날 이후 일정도 전부 30분씩 이동
import { Router } from "express";
import { requireAuth } from "./auth.routes.js";
import { shiftEvent } from "./reschedule.js";

const router = Router();
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
router.use(requireAuth);

router.post("/:id/shift", h(async (req, res) => {
  const delta = Number(req.body?.deltaMinutes);
  if (!Number.isFinite(delta) || delta === 0)
    return res.status(400).json({ message: "deltaMinutes(0이 아닌 분 단위 숫자)가 필요합니다." });
  const out = await shiftEvent(req.userId, req.params.id, delta, !!req.body?.cascade);
  if (!out.ok) return res.status(404).json({ message: out.message });
  res.json(out);
}));

export default router;
