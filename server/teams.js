// server/teams.js — 팀 일정 조율 엔진
//   · 초대: 조율(meeting)을 만들면 공유용 토큰이 생기고, 링크로 참여(join)
//   · 여러 계정이 참여하면 각자의 일정을 참고해 "모두가 비는" 공통 시간을 제안
//     (이르거나 늦은 시간 제외 = earliest/latest 시간대, 과거 시각 제외)
//   · 확정(pick)하면 참여자 전원의 캘린더에 해당 일정을 생성
//   저장: pg면 meetings/meeting_members 테이블 자동생성, 아니면 메모리.
import { randomUUID, randomBytes } from "crypto";
import { db } from "./db.js";

const EARLY_DEFAULT = Number(process.env.MEETING_EARLIEST_HOUR ?? 9);  // 이 시각 이전 제외
const LATE_DEFAULT = Number(process.env.MEETING_LATEST_HOUR ?? 21);    // 이 시각 이후 제외
const STEP_MIN = Number(process.env.MEETING_STEP_MIN ?? 30);           // 후보 정렬 간격(분)

// ── 저장소 (메모리 + pg) ──
const mem = { meetings: new Map(), byToken: new Map(), members: new Map() }; // members: id -> Set(userId)
let pgReady = false;
async function ensureTables() {
  if (db.mode !== "postgres" || pgReady) return;
  await db.pool.query(`CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY, token TEXT UNIQUE NOT NULL, owner_id TEXT NOT NULL,
    title TEXT NOT NULL, date_from DATE NOT NULL, date_to DATE NOT NULL,
    earliest_hour INT NOT NULL, latest_hour INT NOT NULL, duration_min INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await db.pool.query(`CREATE TABLE IF NOT EXISTS meeting_members (
    meeting_id UUID NOT NULL, user_id TEXT NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (meeting_id, user_id))`);
  pgReady = true;
}

const makeToken = () => randomBytes(9).toString("base64url"); // 12자 URL-safe
const clampHour = (v, def) => { const n = Number(v); return Number.isInteger(n) && n >= 0 && n <= 23 ? n : def; };
const normRow = (r) => ({
  ...r,
  date_from: typeof r.date_from === "string" ? r.date_from : new Date(r.date_from).toISOString().slice(0, 10),
  date_to: typeof r.date_to === "string" ? r.date_to : new Date(r.date_to).toISOString().slice(0, 10),
});

// ── 조율 생성 (주최자 자동 참여) ──
export async function createMeeting(ownerId, { title, dateFrom, dateTo, earliestHour, latestHour, durationMin }) {
  let early = clampHour(earliestHour, EARLY_DEFAULT);
  let late = clampHour(latestHour, LATE_DEFAULT);
  if (late <= early) { early = EARLY_DEFAULT; late = LATE_DEFAULT; }

  const m = {
    id: randomUUID(), token: makeToken(), owner_id: ownerId,
    title: (title ?? "").trim() || "일정 조율",
    date_from: dateFrom, date_to: dateTo,
    earliest_hour: early, latest_hour: late,
    duration_min: Math.max(15, Number(durationMin) || 60),
    created_at: new Date().toISOString(),
  };

  if (db.mode === "postgres") {
    await ensureTables();
    await db.pool.query(
      `INSERT INTO meetings(id,token,owner_id,title,date_from,date_to,earliest_hour,latest_hour,duration_min)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [m.id, m.token, m.owner_id, m.title, m.date_from, m.date_to, m.earliest_hour, m.latest_hour, m.duration_min]);
  } else {
    mem.meetings.set(m.id, m);
    mem.byToken.set(m.token, m.id);
  }
  await join(m.id, ownerId);
  return m;
}

export async function getById(id) {
  if (db.mode === "postgres") {
    await ensureTables();
    const r = await db.pool.query("SELECT * FROM meetings WHERE id=$1", [id]);
    return r.rows[0] ? normRow(r.rows[0]) : null;
  }
  return mem.meetings.get(id) ?? null;
}

export async function getByToken(token) {
  if (db.mode === "postgres") {
    await ensureTables();
    const r = await db.pool.query("SELECT * FROM meetings WHERE token=$1", [token]);
    return r.rows[0] ? normRow(r.rows[0]) : null;
  }
  const id = mem.byToken.get(token);
  return id ? mem.meetings.get(id) : null;
}

export async function join(meetingId, userId) {
  if (db.mode === "postgres") {
    await ensureTables();
    await db.pool.query(
      `INSERT INTO meeting_members(meeting_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,
      [meetingId, userId]);
  } else {
    if (!mem.members.has(meetingId)) mem.members.set(meetingId, new Set());
    mem.members.get(meetingId).add(userId);
  }
}

async function memberIds(meetingId) {
  if (db.mode === "postgres") {
    await ensureTables();
    const r = await db.pool.query(
      "SELECT user_id FROM meeting_members WHERE meeting_id=$1 ORDER BY joined_at", [meetingId]);
    return r.rows.map((x) => x.user_id);
  }
  return [...(mem.members.get(meetingId) ?? [])];
}

export async function members(meetingId) {
  const ids = await memberIds(meetingId);
  const out = [];
  for (const uid of ids) {
    const u = await db.findUserById(uid);
    out.push({ userId: uid, name: u?.name ?? "알 수 없음" });
  }
  return out;
}

export async function isMember(meetingId, userId) {
  return (await memberIds(meetingId)).includes(userId);
}

export async function listForUser(userId) {
  if (db.mode === "postgres") {
    await ensureTables();
    const r = await db.pool.query(
      `SELECT DISTINCT m.* FROM meetings m
         LEFT JOIN meeting_members mm ON mm.meeting_id = m.id
        WHERE m.owner_id=$1 OR mm.user_id=$1
        ORDER BY m.created_at DESC`, [userId]);
    return r.rows.map(normRow);
  }
  return [...mem.meetings.values()]
    .filter((m) => m.owner_id === userId || mem.members.get(m.id)?.has(userId))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

// 한 사용자의 busy 구간 [startMs, endMs][] (종일 일정은 그 날 전체를 busy 로)
async function busyOf(userId, fromISO, toISO) {
  const rows = await db.listEvents(userId, { from: fromISO, to: toISO });
  return rows.map((e) => {
    if (e.all_day) {
      const s = new Date(e.starts_at); s.setHours(0, 0, 0, 0);
      const en = new Date(s); en.setDate(en.getDate() + 1);
      return [s.getTime(), en.getTime()];
    }
    return [new Date(e.starts_at).getTime(), new Date(e.ends_at).getTime()];
  });
}

// ── 공통 빈 시간 제안 ──
//   모든 멤버의 busy 를 합쳐(union), 아무도 안 겹치는 = 모두가 비는 슬롯만 반환.
//   earliest/latest 시간대 밖·과거 시각 제외. 겹치지 않는 슬롯을 앞에서부터 최대 limit개.
export async function proposeSlots(meetingId, { limit = 12, now = new Date() } = {}) {
  const m = await getById(meetingId);
  if (!m) return { error: "조율을 찾을 수 없어요." };
  const ids = await memberIds(meetingId);

  const from = new Date(`${m.date_from}T00:00:00`);
  const toExcl = new Date(`${m.date_to}T00:00:00`); toExcl.setDate(toExcl.getDate() + 1);

  let busy = [];
  for (const uid of ids) busy = busy.concat(await busyOf(uid, from.toISOString(), toExcl.toISOString()));
  busy.sort((a, b) => a[0] - b[0]);
  const overlap = (s, e) => busy.filter(([bs, be]) => bs < e && be > s);

  const durMs = m.duration_min * 60000;
  const stepMs = STEP_MIN * 60000;
  const slots = [];

  for (let d = new Date(from); d < toExcl && slots.length < limit; d.setDate(d.getDate() + 1)) {
    const dayStart = new Date(d); dayStart.setHours(m.earliest_hour, 0, 0, 0);
    const dayEnd = new Date(d); dayEnd.setHours(m.latest_hour, 0, 0, 0);

    let cursor = new Date(dayStart);
    if (cursor < now) { // 과거 제외: 지금 이후 STEP 경계로 올림
      const rounded = new Date(Math.ceil(now.getTime() / stepMs) * stepMs);
      cursor = rounded > dayStart ? rounded : dayStart;
    }

    while (cursor.getTime() + durMs <= dayEnd.getTime() && slots.length < limit) {
      const s = cursor.getTime(), e = s + durMs;
      const hit = overlap(s, e);
      if (hit.length === 0) {
        slots.push({ startsAt: new Date(s).toISOString(), endsAt: new Date(e).toISOString() });
        cursor = new Date(e);                      // 다음 비겹침 후보로
      } else {
        const jump = Math.max(...hit.map(([, be]) => be), s + stepMs); // 겹친 구간 끝으로 점프
        cursor = new Date(Math.ceil(jump / stepMs) * stepMs);
      }
    }
  }
  return { meeting: m, memberCount: ids.length, slots };
}

// ── 수정 (주최자만): 제목·기간·시간대·소요 변경 ──
export async function updateMeeting(meetingId, actorId, patch = {}) {
  const m = await getById(meetingId);
  if (!m) return { error: "조율을 찾을 수 없어요." };
  if (m.owner_id !== actorId) return { error: "주최자만 수정할 수 있어요." };

  const next = {
    title: patch.title !== undefined ? (String(patch.title).trim() || m.title) : m.title,
    date_from: patch.dateFrom ?? m.date_from,
    date_to: patch.dateTo ?? m.date_to,
    earliest_hour: patch.earliestHour !== undefined ? clampHour(patch.earliestHour, m.earliest_hour) : m.earliest_hour,
    latest_hour: patch.latestHour !== undefined ? clampHour(patch.latestHour, m.latest_hour) : m.latest_hour,
    duration_min: patch.durationMin !== undefined ? Math.max(15, Number(patch.durationMin) || m.duration_min) : m.duration_min,
  };
  if (next.date_to < next.date_from) return { error: "종료일이 시작일보다 빠를 수 없어요." };
  if (next.latest_hour <= next.earliest_hour) return { error: "늦은 시간이 이른 시간보다 커야 해요." };

  if (db.mode === "postgres") {
    await ensureTables();
    await db.pool.query(
      `UPDATE meetings SET title=$2, date_from=$3, date_to=$4, earliest_hour=$5, latest_hour=$6, duration_min=$7 WHERE id=$1`,
      [meetingId, next.title, next.date_from, next.date_to, next.earliest_hour, next.latest_hour, next.duration_min]);
  } else {
    Object.assign(mem.meetings.get(meetingId), next);
  }
  return { ok: true, meeting: await getById(meetingId) };
}

// ── 삭제 (주최자만): 조율과 참여기록 제거. 이미 확정돼 각자 캘린더에 만든 일정은 그대로 둠 ──
export async function deleteMeeting(meetingId, actorId) {
  const m = await getById(meetingId);
  if (!m) return { error: "조율을 찾을 수 없어요." };
  if (m.owner_id !== actorId) return { error: "주최자만 삭제할 수 있어요." };

  if (db.mode === "postgres") {
    await ensureTables();
    await db.pool.query("DELETE FROM meeting_members WHERE meeting_id=$1", [meetingId]);
    await db.pool.query("DELETE FROM meetings WHERE id=$1", [meetingId]);
  } else {
    mem.byToken.delete(m.token);
    mem.members.delete(meetingId);
    mem.meetings.delete(meetingId);
  }
  return { ok: true, deleted: true };
}

// ── 나가기 (멤버): 주최자는 나갈 수 없음(삭제로 처리) ──
export async function leaveMeeting(meetingId, userId) {
  const m = await getById(meetingId);
  if (!m) return { error: "조율을 찾을 수 없어요." };
  if (m.owner_id === userId) return { error: "주최자는 나갈 수 없어요. 삭제를 사용하세요." };

  if (db.mode === "postgres") {
    await ensureTables();
    await db.pool.query("DELETE FROM meeting_members WHERE meeting_id=$1 AND user_id=$2", [meetingId, userId]);
  } else {
    mem.members.get(meetingId)?.delete(userId);
  }
  return { ok: true, left: true };
}

// ── 확정: 참여자 전원 캘린더에 이벤트 생성 (주최자만) ──
export async function pickSlot(meetingId, actorId, startsAtISO) {
  const m = await getById(meetingId);
  if (!m) return { error: "조율을 찾을 수 없어요." };
  if (m.owner_id !== actorId) return { error: "주최자만 시간을 확정할 수 있어요." };

  const start = new Date(startsAtISO);
  if (isNaN(start.getTime())) return { error: "시작 시각이 올바르지 않아요." };
  const end = new Date(start.getTime() + m.duration_min * 60000);

  const ids = await memberIds(meetingId);
  let created = 0;
  for (const uid of ids) {
    const cal = (await db.findCalendar(uid, "meeting")) || (await db.findCalendar(uid, "personal"));
    if (!cal) continue;
    await db.createEvent(uid, {
      calendar_id: cal.id, title: m.title,
      starts_at: start.toISOString(), ends_at: end.toISOString(),
      location: null, summary: `팀 일정 조율: ${m.title}`, all_day: false,
    });
    created++;
  }
  return { ok: true, created, title: m.title, startsAt: start.toISOString(), endsAt: end.toISOString() };
}
