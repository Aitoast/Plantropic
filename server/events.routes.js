// events.routes.js — 사용자별 일정 CRUD (Express + pg)
// 모든 라우트는 requireAuth로 보호되어 req.userId 기준으로만 데이터 접근.
import { Router } from "express";
import { Pool } from "pg";
import { requireAuth } from "./auth.routes.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const router = Router();
router.use(requireAuth);

// 목록: ?from=2026-07-01&to=2026-07-31 (기간 필터)
router.get("/", async (req, res) => {
  const { from, to } = req.query;
  const params = [req.userId];
  let where = "e.user_id = $1";
  if (from) { params.push(from); where += ` AND e.starts_at >= $${params.length}`; }
  if (to)   { params.push(to);   where += ` AND e.starts_at <  $${params.length}`; }
  const { rows } = await pool.query(
    `SELECT e.*, c.key AS cal_key, c.color AS cal_color
       FROM events e JOIN calendars c ON c.id = e.calendar_id
      WHERE ${where} ORDER BY e.starts_at`,
    params
  );
  res.json(rows.map(serialize));
});

router.post("/", async (req, res) => {
  const { calKey, title, startsAt, endsAt, location, summary, allDay } = req.body ?? {};
  if (!title?.trim() || !startsAt || !endsAt) return res.status(400).json({ message: "제목과 시간은 필수예요." });

  const cal = await pool.query("SELECT id FROM calendars WHERE user_id=$1 AND key=$2", [req.userId, calKey ?? "personal"]);
  if (!cal.rows[0]) return res.status(400).json({ message: "존재하지 않는 캘린더예요." });

  const { rows } = await pool.query(
    `INSERT INTO events(user_id,calendar_id,title,starts_at,ends_at,location,summary,all_day)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [req.userId, cal.rows[0].id, title.trim(), startsAt, endsAt, location ?? null, summary ?? null, !!allDay]
  );
  res.json(serialize(rows[0]));
});

router.patch("/:id", async (req, res) => {
  const fields = [], params = [];
  const map = { title: "title", startsAt: "starts_at", endsAt: "ends_at", location: "location", summary: "summary", allDay: "all_day" };
  for (const [k, col] of Object.entries(map)) {
    if (req.body?.[k] !== undefined) { params.push(req.body[k]); fields.push(`${col}=$${params.length}`); }
  }
  if (!fields.length) return res.status(400).json({ message: "변경할 내용이 없어요." });
  params.push(req.params.id, req.userId);
  const { rows } = await pool.query(
    `UPDATE events SET ${fields.join(",")}, updated_at=now()
      WHERE id=$${params.length - 1} AND user_id=$${params.length} RETURNING *`,
    params
  );
  if (!rows[0]) return res.status(404).json({ message: "일정을 찾을 수 없어요." });
  res.json(serialize(rows[0]));
});

router.delete("/:id", async (req, res) => {
  const r = await pool.query("DELETE FROM events WHERE id=$1 AND user_id=$2", [req.params.id, req.userId]);
  if (!r.rowCount) return res.status(404).json({ message: "일정을 찾을 수 없어요." });
  res.status(204).end();
});

function serialize(r) {
  return {
    id: r.id, calKey: r.cal_key, calColor: r.cal_color, title: r.title,
    startsAt: r.starts_at, endsAt: r.ends_at, allDay: r.all_day,
    location: r.location, summary: r.summary,
  };
}

export default router;
