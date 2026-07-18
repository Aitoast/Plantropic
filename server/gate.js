// server/gate.js — 인박스 LLM 퀵애드 게이트 (유지비용·남용 방지)
//   A) 알림 후 INBOX_WINDOW_MIN(기본 15분) 창 안이면 허용
//   B) 창 밖이면 하루 INBOX_DAILY_MAX(기본 12회) 한도 안에서만 허용
//   D) 확인("네/아니오")·미루기는 이 게이트를 타지 않음(LLM 미사용, service/inbound 에서 분기)
//   E) 입력 길이 상한 = INBOX_MAX_LEN(기본 200자)  ← service.runQuickAdd 에서 사용
//
//   저장: pg면 inbox_gate 테이블 자동생성(재시작에도 한도 유지), 아니면 메모리.
import { db } from "./db.js";

const WINDOW_MIN = Number(process.env.INBOX_WINDOW_MIN ?? 15);
const DAILY_MAX = Number(process.env.INBOX_DAILY_MAX ?? 12);
export const MAX_INBOX_LEN = Number(process.env.INBOX_MAX_LEN ?? 200);

const mem = new Map(); // userId -> { lastNotifiedAt, date, count }
let pgReady = false;
const today = () => new Date().toISOString().slice(0, 10);
const blank = () => ({ lastNotifiedAt: 0, date: null, count: 0 });

async function ensureTable() {
  if (db.mode !== "postgres" || pgReady) return;
  await db.pool.query(`CREATE TABLE IF NOT EXISTS inbox_gate (
    user_id TEXT PRIMARY KEY,
    last_notified_at TIMESTAMPTZ,
    quota_date DATE,
    quota_count INT NOT NULL DEFAULT 0)`);
  pgReady = true;
}

async function load(userId) {
  if (db.mode === "postgres") {
    await ensureTable();
    const r = await db.pool.query(
      "SELECT last_notified_at, quota_date, quota_count FROM inbox_gate WHERE user_id=$1", [userId]);
    const row = r.rows[0];
    if (!row) return blank();
    return {
      lastNotifiedAt: row.last_notified_at ? new Date(row.last_notified_at).getTime() : 0,
      date: row.quota_date ? new Date(row.quota_date).toISOString().slice(0, 10) : null,
      count: row.quota_count ?? 0,
    };
  }
  return mem.get(userId) ?? blank();
}

async function save(userId, s) {
  if (db.mode === "postgres") {
    await ensureTable();
    await db.pool.query(
      `INSERT INTO inbox_gate(user_id, last_notified_at, quota_date, quota_count)
       VALUES($1, to_timestamp($2 / 1000.0), $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         last_notified_at = EXCLUDED.last_notified_at,
         quota_date = EXCLUDED.quota_date,
         quota_count = EXCLUDED.quota_count`,
      [userId, s.lastNotifiedAt || 0, s.date, s.count]);
  } else mem.set(userId, s);
}

// 스케줄러가 알림을 보낼 때 호출 → 15분 응답 창 오픈
export async function markNotified(userId) {
  const s = await load(userId);
  s.lastNotifiedAt = Date.now();
  await save(userId, s);
}

// LLM 퀵애드 진입 게이트. 통과 시 카운트 1 증가.
//   반환: { allowed:true, windowActive, remaining } | { allowed:false, reason, remaining:0 }
export async function checkQuickAdd(userId) {
  const s = await load(userId);
  const now = Date.now();
  const windowActive = !!s.lastNotifiedAt && now - s.lastNotifiedAt <= WINDOW_MIN * 60000;

  if (s.date !== today()) { s.date = today(); s.count = 0; } // 날짜 바뀌면 한도 리셋
  const underCap = s.count < DAILY_MAX;

  if (!windowActive && !underCap) {
    await save(userId, s);
    return { allowed: false, remaining: 0,
      reason: `🔒 오늘 자유 등록 한도(${DAILY_MAX}회)를 다 썼어요. 알림이 오면 ${WINDOW_MIN}분간 다시 열려요. ` +
              `(확인·미루기는 계속 가능해요)` };
  }
  s.count += 1;                       // 창 안/밖 모두 집계(창 밖 한도의 기준)
  await save(userId, s);
  return { allowed: true, windowActive, remaining: Math.max(0, DAILY_MAX - s.count) };
}
