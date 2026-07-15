import { Router } from "express";
import { requireAuth } from "./auth.routes.js";
import { geocode, transitMinutes, mapsConfigured } from "./maps.js";

const router = Router();
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
router.use(requireAuth);

router.get("/next", h(async (req, res) => {
  if (!mapsConfigured) return res.json({ mapsConfigured: false, minutes: null });
  // lat/lng 또는 다음 일정 기반 이동시간 계산 …
  res.json({ mapsConfigured: true, /* … */ });
}));

export default router;