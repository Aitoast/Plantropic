// server/teams.routes.js — 팀 조율 API (모두 requireAuth)
//   POST /api/meetings                 새 조율 만들기 → { ...meeting, inviteUrl, inviteToken }
//   GET  /api/meetings                 내가 만들거나 참여한 조율 목록
//   GET  /api/meetings/:token          상세(멤버·주최여부·참여여부)
//   POST /api/meetings/:token/join     초대 링크로 참여
//   GET  /api/meetings/:token/slots    공통 빈 시간 제안
//   POST /api/meetings/:token/pick     { startsAt } 시간 확정(주최자만) → 전원 캘린더 생성
import { Router } from "express";
import { requireAuth } from "./auth.routes.js";
import * as teams from "./teams.js";

const router = Router();
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
router.use(requireAuth);

const WEB = process.env.WEB_ORIGIN ?? "http://localhost:5173";
const withInvite = (m) => ({ ...m, inviteToken: m.token, inviteUrl: `${WEB}/join/${m.token}` });

router.post("/", h(async (req, res) => {
  const { title, dateFrom, dateTo, earliestHour, latestHour, durationMin } = req.body ?? {};
  if (!dateFrom || !dateTo) return res.status(400).json({ message: "기간(dateFrom, dateTo)이 필요합니다." });
  if (dateTo < dateFrom) return res.status(400).json({ message: "종료일이 시작일보다 빠를 수 없어요." });
  const m = await teams.createMeeting(req.userId, { title, dateFrom, dateTo, earliestHour, latestHour, durationMin });
  res.json(withInvite(m));
}));

router.get("/", h(async (req, res) => {
  res.json((await teams.listForUser(req.userId)).map(withInvite));
}));

// 토큰으로 조율을 찾아 req.meeting 에 실어주는 헬퍼
const load = h(async (req, res, next) => {
  const m = await teams.getByToken(req.params.token);
  if (!m) return res.status(404).json({ message: "초대를 찾을 수 없어요. 링크가 만료되었거나 잘못됐어요." });
  req.meeting = m;
  next();
});

router.get("/:token", load, h(async (req, res) => {
  const m = req.meeting;
  res.json({
    ...withInvite(m),
    members: await teams.members(m.id),
    isOwner: m.owner_id === req.userId,
    isMember: await teams.isMember(m.id, req.userId),
  });
}));

router.post("/:token/join", load, h(async (req, res) => {
  await teams.join(req.meeting.id, req.userId);
  res.json({ ok: true, ...withInvite(req.meeting), joined: true });
}));

router.get("/:token/slots", load, h(async (req, res) => {
  if (!(await teams.isMember(req.meeting.id, req.userId)))
    return res.status(403).json({ message: "먼저 참여해야 빈 시간을 볼 수 있어요." });
  const limit = Math.min(30, Number(req.query.limit) || 12);
  res.json(await teams.proposeSlots(req.meeting.id, { limit }));
}));

router.post("/:token/pick", load, h(async (req, res) => {
  const { startsAt } = req.body ?? {};
  if (!startsAt) return res.status(400).json({ message: "startsAt 이 필요합니다." });
  const out = await teams.pickSlot(req.meeting.id, req.userId, startsAt);
  if (out.error) return res.status(403).json({ message: out.error });
  res.json(out);
}));

// 수정 (주최자만)
router.patch("/:token", load, h(async (req, res) => {
  const out = await teams.updateMeeting(req.meeting.id, req.userId, req.body ?? {});
  if (out.error) return res.status(out.error.includes("주최자") ? 403 : 400).json({ message: out.error });
  res.json({ ...withInvite(out.meeting), members: await teams.members(out.meeting.id),
    isOwner: true, isMember: true });
}));

// 삭제 (주최자만)
router.delete("/:token", load, h(async (req, res) => {
  const out = await teams.deleteMeeting(req.meeting.id, req.userId);
  if (out.error) return res.status(403).json({ message: out.error });
  res.json(out);
}));

// 나가기 (멤버)
router.post("/:token/leave", load, h(async (req, res) => {
  const out = await teams.leaveMeeting(req.meeting.id, req.userId);
  if (out.error) return res.status(400).json({ message: out.error });
  res.json(out);
}));

export default router;
