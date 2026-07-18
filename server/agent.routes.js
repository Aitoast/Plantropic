// server/agent.routes.js — 퀵애드 에이전트 API (모두 requireAuth)
//   POST /api/agent/run    { text }                  → needs_confirmation | done
//   POST /api/agent/resume { threadId, decision }    → done
//   decision: { approve: true } | { approve: false, reason? } | { approve: true, edits: {...} }
import { Router } from "express";
import { requireAuth } from "./auth.routes.js";
import { runQuickAdd, resumeQuickAdd } from "./agent/service.js";

const router = Router();
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
router.use(requireAuth);

router.post("/run", h(async (req, res) => {
  const { text } = req.body ?? {};
  if (!text?.trim()) return res.status(400).json({ message: "text(자연어 일정)가 필요합니다." });
  const out = await runQuickAdd(req.userId, text.trim());
  if (out.status === "error") return res.status(400).json({ message: out.message });
  if (out.status === "blocked") return res.status(429).json({ message: out.message });
  res.json(out);
}));

router.post("/resume", h(async (req, res) => {
  const { threadId, decision } = req.body ?? {};
  if (!threadId) return res.status(400).json({ message: "threadId 가 필요합니다." });
  const out = await resumeQuickAdd(req.userId, threadId, decision ?? { approve: false });
  if (out.status === "error") return res.status(400).json({ message: out.message });
  res.json(out);
}));

export default router;
