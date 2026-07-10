// server/ai.routes.js — AI 에이전트 라우트 (모두 requireAuth, user_id 기준)
import { Router } from "express";
import { db } from "./db.js";
import { requireAuth } from "./auth.routes.js";
import { detectWeeklyPatterns, findNextHop, startOfWeek } from "./ai/analyze.js";
import { suggestEvents, travelAdvice, aiAvailable } from "./ai/agent.js";

const router = Router();
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
router.use(requireAuth);

const toEvents = (rows) => rows.map((r) => ({
  id: r.id, calKey: r.cal_key, title: r.title,
  startsAt: r.starts_at, endsAt: r.ends_at, location: r.location, summary: r.summary,
}));

// AI 사용 가능 여부(키 설정됐는지)
router.get("/status", (_req, res) => res.json({ aiAvailable }));

// 주간 패턴 기반 자동채움 제안
router.get("/suggestions", h(async (req, res) => {
  const events = toEvents(await db.listEvents(req.userId));
  const patterns = detectWeeklyPatterns(events);
  const weekStart = (req.query.weekStart ? new Date(req.query.weekStart) : startOfWeek(new Date())).toISOString();
  const result = await suggestEvents({ patterns, events, weekStart });
  res.json({ aiAvailable, patternCount: patterns.length, weekStart, ...result });
}));

// 다음 일정까지 이동시간 조언
router.get("/travel", h(async (req, res) => {
  const events = toEvents(await db.listEvents(req.userId));
  const now = req.query.now ? new Date(req.query.now) : new Date();
  const hop = findNextHop(events, now);
  if (!hop) return res.json({ aiAvailable, hop: null, message: "예정된 다음 일정이 없어요." });
  const advice = await travelAdvice(hop);
  res.json({ aiAvailable, from: hop.from, to: hop.to, gapMinutes: hop.gapMinutes, ...advice });
}));

export default router;
