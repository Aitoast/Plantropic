// auth.routes.js — Planora 인증 라우트 (Express + pg)
// 이메일/비밀번호 + Google/Kakao OAuth + JWT 발급
// 의존성: express pg bcrypt jsonwebtoken
//   npm i express pg bcrypt jsonwebtoken
// 환경변수: DATABASE_URL, JWT_SECRET,
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI,
//   KAKAO_CLIENT_ID, KAKAO_REDIRECT_URI

import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET;
const router = Router();

const DEFAULT_CALENDARS = [
  ["personal", "내 일정", "#1f8a5b"], ["work", "업무", "#3b6fd4"],
  ["meeting", "회의", "#7c5cdb"], ["deadline", "마감", "#d97757"],
  ["team", "팀 공유", "#0e9aa7"], ["family", "가족", "#d95a97"],
];

function sign(user) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "30d" });
}
function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, avatarUrl: u.avatar_url };
}

async function seedCalendars(userId) {
  for (const [key, label, color] of DEFAULT_CALENDARS) {
    await pool.query(
      `INSERT INTO calendars(user_id,key,label,color) VALUES($1,$2,$3,$4)
       ON CONFLICT (user_id,key) DO NOTHING`,
      [userId, key, label, color]
    );
  }
}

// ── 인증 미들웨어 ────────────────────────────────────────
export function requireAuth(req, res, next) {
  const h = req.headers.authorization ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ message: "로그인이 필요해요." });
  try {
    req.userId = jwt.verify(token, JWT_SECRET).sub;
    next();
  } catch {
    res.status(401).json({ message: "세션이 만료됐어요. 다시 로그인해주세요." });
  }
}

// ── 회원가입 ─────────────────────────────────────────────
router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body ?? {};
  if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({ message: "필수 항목을 입력해주세요." });
  if (password.length < 8) return res.status(400).json({ message: "비밀번호는 8자 이상이어야 해요." });

  const exists = await pool.query("SELECT 1 FROM users WHERE email=$1", [email.toLowerCase()]);
  if (exists.rowCount) return res.status(409).json({ message: "이미 가입된 이메일이에요." });

  const hash = await bcrypt.hash(password, 12);
  const { rows } = await pool.query(
    `INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING *`,
    [name.trim(), email.toLowerCase(), hash]
  );
  const user = rows[0];
  await seedCalendars(user.id);
  res.json({ token: sign(user), user: publicUser(user) });
});

// ── 로그인 ───────────────────────────────────────────────
router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  const { rows } = await pool.query("SELECT * FROM users WHERE email=$1", [String(email ?? "").toLowerCase()]);
  const user = rows[0];
  if (!user || !user.password_hash || !(await bcrypt.compare(password ?? "", user.password_hash)))
    return res.status(401).json({ message: "이메일 또는 비밀번호가 올바르지 않아요." });
  res.json({ token: sign(user), user: publicUser(user) });
});

// ── 내 정보 ──────────────────────────────────────────────
router.get("/me", requireAuth, async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM users WHERE id=$1", [req.userId]);
  if (!rows[0]) return res.status(404).json({ message: "사용자를 찾을 수 없어요." });
  res.json(publicUser(rows[0]));
});

// ── 소셜 로그인 공통: provider 프로필로 upsert 후 토큰 발급 ──
async function upsertOAuthUser({ provider, providerUid, email, name, avatarUrl }) {
  const linked = await pool.query(
    `SELECT u.* FROM oauth_accounts o JOIN users u ON u.id=o.user_id
     WHERE o.provider=$1 AND o.provider_uid=$2`,
    [provider, providerUid]
  );
  if (linked.rows[0]) return linked.rows[0];

  // 같은 이메일 계정이 있으면 연결, 없으면 신규 생성
  let user = (await pool.query("SELECT * FROM users WHERE email=$1", [email])).rows[0];
  if (!user) {
    user = (await pool.query(
      `INSERT INTO users(name,email,avatar_url) VALUES($1,$2,$3) RETURNING *`,
      [name ?? "사용자", email, avatarUrl ?? null]
    )).rows[0];
    await seedCalendars(user.id);
  }
  await pool.query(
    `INSERT INTO oauth_accounts(user_id,provider,provider_uid) VALUES($1,$2,$3)
     ON CONFLICT DO NOTHING`,
    [user.id, provider, providerUid]
  );
  return user;
}

// Google: 표준 OAuth 2.0 code 플로우
router.get("/google", (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    state: req.query.redirect ?? "",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get("/google/callback", async (req, res) => {
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: req.query.code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    }).then((r) => r.json());

    const profile = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenRes.access_token}` },
    }).then((r) => r.json());

    const user = await upsertOAuthUser({
      provider: "google", providerUid: profile.id,
      email: profile.email, name: profile.name, avatarUrl: profile.picture,
    });
    const redirect = req.query.state || process.env.WEB_ORIGIN || "/";
    res.redirect(`${redirect}#token=${sign(user)}`);
  } catch {
    res.status(500).send("Google 로그인에 실패했어요.");
  }
});

// Kakao: OAuth 2.0
router.get("/kakao", (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.KAKAO_CLIENT_ID,
    redirect_uri: process.env.KAKAO_REDIRECT_URI,
    response_type: "code",
    state: req.query.redirect ?? "",
  });
  res.redirect(`https://kauth.kakao.com/oauth/authorize?${params}`);
});

router.get("/kakao/callback", async (req, res) => {
  try {
    const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.KAKAO_CLIENT_ID,
        redirect_uri: process.env.KAKAO_REDIRECT_URI,
        code: req.query.code,
      }),
    }).then((r) => r.json());

    const profile = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${tokenRes.access_token}` },
    }).then((r) => r.json());

    const acc = profile.kakao_account ?? {};
    const user = await upsertOAuthUser({
      provider: "kakao", providerUid: String(profile.id),
      email: acc.email ?? `kakao_${profile.id}@planora.local`,
      name: acc.profile?.nickname ?? "카카오 사용자",
      avatarUrl: acc.profile?.profile_image_url,
    });
    const redirect = req.query.state || process.env.WEB_ORIGIN || "/";
    res.redirect(`${redirect}#token=${sign(user)}`);
  } catch {
    res.status(500).send("카카오 로그인에 실패했어요.");
  }
});

export default router;
