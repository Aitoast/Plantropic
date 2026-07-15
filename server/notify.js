// server/notify.js — 알림 발송 (앱푸시/카카오톡/디스코드/슬랙) + 유저별 설정 저장
//
//   설정 형태 (PUT /api/notify/settings 로 저장):
//   {
//     channels: {
//       push:    { expoToken: "ExponentPushToken[...]" },        // 어플 알림창 (Expo)
//       kakao:   { accessToken: "..." },                          // 카카오 "나에게 보내기" (talk_message 동의 필요)
//       discord: { webhook: "https://discord.com/api/webhooks/..." },
//       slack:   { webhook: "https://hooks.slack.com/services/...", userId: "U0..." }
//     },
//     remindMin: 30,          // 일정 시작 몇 분 전에 알림
//     emptySlotMin: 180       // 앞으로 이 시간 동안 일정이 없으면 퀵애드 유도 (0이면 끔)
//   }
import { db } from "./db.js";

// ── 유저별 설정 저장소 (pg 테이블 자동생성 / 메모리 폴백) ──
const memSettings = new Map();
let pgReady = false;

async function ensureTable() {
  if (db.mode !== "postgres" || pgReady) return;
  await db.pool.query(`CREATE TABLE IF NOT EXISTS notify_settings (
    user_id TEXT PRIMARY KEY, config JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  pgReady = true;
}

export async function getSettings(userId) {
  if (db.mode === "postgres") {
    await ensureTable();
    const r = await db.pool.query("SELECT config FROM notify_settings WHERE user_id=$1", [userId]);
    return r.rows[0]?.config ?? null;
  }
  return memSettings.get(userId) ?? null;
}

export async function saveSettings(userId, config) {
  if (db.mode === "postgres") {
    await ensureTable();
    await db.pool.query(
      `INSERT INTO notify_settings(user_id, config) VALUES($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET config=$2, updated_at=now()`,
      [userId, config]);
  } else memSettings.set(userId, config);
  return config;
}

export async function listUsersWithSettings() {
  if (db.mode === "postgres") {
    await ensureTable();
    const r = await db.pool.query("SELECT user_id, config FROM notify_settings");
    return r.rows.map((x) => ({ userId: x.user_id, config: x.config }));
  }
  return [...memSettings.entries()].map(([userId, config]) => ({ userId, config }));
}

// 슬랙 user ID → 우리 유저 (슬랙 인바운드 웹훅에서 사용)
export async function findUserBySlackId(slackUserId) {
  for (const { userId, config } of await listUsersWithSettings())
    if (config?.channels?.slack?.userId === slackUserId) return userId;
  return null;
}

// ── 채널별 발송 ──
async function post(url, body, headers = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return res.ok;
}

const senders = {
  // Expo 푸시 (모바일 앱 알림창)
  push: (cfg, title, text) =>
    post("https://exp.host/--/api/v2/push/send", { to: cfg.expoToken, title, body: text, sound: "default" }),

  // 카카오톡 "나에게 보내기" (사용자 액세스 토큰 필요: talk_message 스코프)
  kakao: async (cfg, title, text) => {
    const template = { object_type: "text", text: `${title}\n${text}`, link: { web_url: process.env.WEB_ORIGIN ?? "" } };
    const res = await fetch("https://kapi.kakao.com/v2/api/talk/memo/default/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.accessToken}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ template_object: JSON.stringify(template) }),
    });
    return res.ok;
  },

  // 디스코드 웹훅
  discord: (cfg, title, text) => post(cfg.webhook, { content: `**${title}**\n${text}` }),

  // 슬랙 Incoming Webhook
  slack: (cfg, title, text) => post(cfg.webhook, { text: `*${title}*\n${text}` }),
};

// 설정된 모든 채널로 발송. 반환: 성공한 채널 목록
export async function sendToUser(userId, title, text) {
  const cfg = await getSettings(userId);
  const channels = cfg?.channels ?? {};
  const sent = [];
  for (const [name, chCfg] of Object.entries(channels)) {
    const fn = senders[name];
    if (!fn || !chCfg) continue;
    try { if (await fn(chCfg, title, text)) sent.push(name); }
    catch (e) { console.error(`알림 실패 [${name}]`, e.message); }
  }
  return sent;
}
