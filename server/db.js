import { randomUUID } from "crypto";

export const DEFAULT_CALENDARS = [
  ["personal", "내 일정", "#1f8a5b"], ["work", "업무", "#3b6fd4"],
  ["meeting", "회의", "#7c5cdb"], ["deadline", "마감", "#d97757"],
  ["team", "팀 공유", "#0e9aa7"], ["family", "가족", "#d95a97"],
];

// ── 인메모리 저장소 ───────────────────────────────────────
function memoryStore() {
  const users = new Map();          // id -> user row
  const emailIndex = new Map();     // email -> id
  const oauthIndex = new Map();     // `${provider}:${uid}` -> userId
  const calendars = [];             // { id, user_id, key, label, color }
  const events = [];                // { id, user_id, calendar_id, ... }

  const calById = (id) => calendars.find((c) => c.id === id);

  return {
    mode: "memory",

    async findUserByEmail(email) {
      const id = emailIndex.get(email);
      return id ? users.get(id) : null;
    },
    async findUserById(id) {
      return users.get(id) ?? null;
    },
    async createUser({ name, email, password_hash = null, avatar_url = null }) {
      const user = {
        id: randomUUID(), email, name,
        password_hash, avatar_url,
        timezone: "Asia/Seoul", created_at: new Date().toISOString(),
      };
      users.set(user.id, user);
      emailIndex.set(email, user.id);
      return user;
    },
    async seedCalendars(userId) {
      for (const [key, label, color] of DEFAULT_CALENDARS) {
        if (!calendars.some((c) => c.user_id === userId && c.key === key)) {
          calendars.push({ id: randomUUID(), user_id: userId, key, label, color });
        }
      }
    },
    async findCalendar(userId, key) {
      return calendars.find((c) => c.user_id === userId && c.key === key) ?? null;
    },

    async findUserByOAuth(provider, uid) {
      const userId = oauthIndex.get(`${provider}:${uid}`);
      return userId ? users.get(userId) : null;
    },
    async linkOAuth(userId, provider, uid) {
      oauthIndex.set(`${provider}:${uid}`, userId);
    },

    async listEvents(userId, { from, to } = {}) {
      return events
        .filter((e) => e.user_id === userId)
        .filter((e) => (from ? e.starts_at >= from : true))
        .filter((e) => (to ? e.starts_at < to : true))
        .sort((a, b) => (a.starts_at < b.starts_at ? -1 : 1))
        .map((e) => joinCal(e, calById(e.calendar_id)));
    },
    async createEvent(userId, ev) {
      const row = {
        id: randomUUID(), user_id: userId, ...ev,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      events.push(row);
      return joinCal(row, calById(row.calendar_id));
    },
    async updateEvent(userId, id, fields) {
      const row = events.find((e) => e.id === id && e.user_id === userId);
      if (!row) return null;
      Object.assign(row, fields, { updated_at: new Date().toISOString() });
      return joinCal(row, calById(row.calendar_id));
    },
    async deleteEvent(userId, id) {
      const i = events.findIndex((e) => e.id === id && e.user_id === userId);
      if (i === -1) return false;
      events.splice(i, 1);
      return true;
    },
  };
}

function joinCal(e, cal) {
  return { ...e, cal_key: cal?.key ?? null, cal_color: cal?.color ?? null };
}

// ── PostgreSQL 저장소 ─────────────────────────────────────
async function pgStore(connectionString) {
  const { Pool } = await import("pg");
  const needSsl = /sslmode=require|neon\.tech|supabase|render\.com|amazonaws|azure/.test(connectionString);
  const pool = new Pool({ connectionString, ssl: needSsl ? { rejectUnauthorized: false } : undefined });
  const one = async (sql, params) => (await pool.query(sql, params)).rows[0] ?? null;

  return {
    mode: "postgres",
    pool,

    findUserByEmail: (email) => one("SELECT * FROM users WHERE email=$1", [email]),
    findUserById: (id) => one("SELECT * FROM users WHERE id=$1", [id]),
    createUser: ({ name, email, password_hash = null, avatar_url = null }) =>
      one(
        `INSERT INTO users(name,email,password_hash,avatar_url)
         VALUES($1,$2,$3,$4) RETURNING *`,
        [name, email, password_hash, avatar_url]
      ),
    async seedCalendars(userId) {
      for (const [key, label, color] of DEFAULT_CALENDARS) {
        await pool.query(
          `INSERT INTO calendars(user_id,key,label,color) VALUES($1,$2,$3,$4)
           ON CONFLICT (user_id,key) DO NOTHING`,
          [userId, key, label, color]
        );
      }
    },
    findCalendar: (userId, key) =>
      one("SELECT * FROM calendars WHERE user_id=$1 AND key=$2", [userId, key]),

    findUserByOAuth: (provider, uid) =>
      one(
        `SELECT u.* FROM oauth_accounts o JOIN users u ON u.id=o.user_id
         WHERE o.provider=$1 AND o.provider_uid=$2`,
        [provider, uid]
      ),
    linkOAuth: (userId, provider, uid) =>
      pool.query(
        `INSERT INTO oauth_accounts(user_id,provider,provider_uid) VALUES($1,$2,$3)
         ON CONFLICT (provider,provider_uid) DO NOTHING`,
        [userId, provider, uid]
      ),

    async listEvents(userId, { from, to } = {}) {
      const params = [userId];
      let where = "e.user_id = $1";
      if (from) { params.push(from); where += ` AND e.starts_at >= $${params.length}`; }
      if (to)   { params.push(to);   where += ` AND e.starts_at <  $${params.length}`; }
      const { rows } = await pool.query(
        `SELECT e.*, c.key AS cal_key, c.color AS cal_color
           FROM events e JOIN calendars c ON c.id = e.calendar_id
          WHERE ${where} ORDER BY e.starts_at`,
        params
      );
      return rows;
    },
    async createEvent(userId, ev) {
      const row = await one(
        `INSERT INTO events(user_id,calendar_id,title,starts_at,ends_at,location,summary,all_day)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [userId, ev.calendar_id, ev.title, ev.starts_at, ev.ends_at, ev.location, ev.summary, ev.all_day]
      );
      const cal = await one("SELECT key,color FROM calendars WHERE id=$1", [ev.calendar_id]);
      return { ...row, cal_key: cal?.key, cal_color: cal?.color };
    },
    async updateEvent(userId, id, fields) {
      const cols = [], params = [];
      for (const [col, val] of Object.entries(fields)) {
        params.push(val); cols.push(`${col}=$${params.length}`);
      }
      params.push(id, userId);
      const row = await one(
        `UPDATE events SET ${cols.join(",")}, updated_at=now()
          WHERE id=$${params.length - 1} AND user_id=$${params.length} RETURNING *`,
        params
      );
      if (!row) return null;
      const cal = await one("SELECT key,color FROM calendars WHERE id=$1", [row.calendar_id]);
      return { ...row, cal_key: cal?.key, cal_color: cal?.color };
    },
    async deleteEvent(userId, id) {
      const r = await pool.query("DELETE FROM events WHERE id=$1 AND user_id=$2", [id, userId]);
      return r.rowCount > 0;
    },
  };
}

// DATABASE_URL 유무로 저장소 자동 선택 (top-level await, ESM)
export const db = process.env.DATABASE_URL
  ? await pgStore(process.env.DATABASE_URL)
  : memoryStore();

if (db.mode === "memory") {
  console.log("⚠  DATABASE_URL 미설정 → 인메모리 저장소로 구동합니다(재시작 시 데이터 소멸). 실제 DB는 .env 에 DATABASE_URL 설정.");
}