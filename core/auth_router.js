// auth.routes.js — Planora 인증 라우트 (Express)
// 이메일/비밀번호 + Google/Kakao OAuth + JWT 발급, 그리고 로그인 상태 확인(/me).
// 의존성: express bcryptjs jsonwebtoken  (DB는 db.js 가 인메모리/pg 를 자동 선택)
//   npm i express cors bcryptjs jsonwebtoken
//   (선택) 실제 Postgres 사용 시:  npm i pg  +  .env 의 DATABASE_URL
// 환경변수: JWT_SECRET, (선택) DATABASE_URL, WEB_ORIGIN,
//   GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI, KAKAO_CLIENT_ID/REDIRECT_URI

import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "./db.js";

// JWT_SECRET 은 필수. 없으면 토큰 위조가 가능하므로 개발 편의용 기본값을 쓰되 경고.
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-insecure-secret-change-me";
if (!process.env.JWT_SECRET) {
  console.log("⚠  JWT_SECRET 미설정 → 개발용 임시 키 사용. 운영 전 반드시 .env 에 설정하세요.");
}

const router = Router();

// 비동기 라우트의 예외를 반드시 next(err) 로 넘겨 500 으로 응답(행 걸림/무한 대기 방지).
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function sign(user) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "30d" });
}
function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, avatarUrl: u.avatar_url ?? null };
}

// ── 인증 미들웨어: Bearer 토큰을 검증해 로그인 상태를 확인 ──
export function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "로그인이 필요해요." });
  try {
    req.userId = jwt.verify(token, JWT_SECRET).sub;
    next();
  } catch {
    res.status(401).json({ message: "세션이 만료됐어요. 다시 로그인해주세요." });
  }
}

// ── 회원가입 ─────────────────────────────────────────────
router.post("/signup", h(async (req, res) => {
  const { name, email, password } = req.body ?? {};
  if (!name?.trim() || !email?.trim() || !password)
    return res.status(400).json({ message: "필수 항목을 입력해주세요." });
  if (password.length < 8)
    return res.status(400).json({ message: "비밀번호는 8자 이상이어야 해요." });

  const normEmail = email.trim().toLowerCase();
  if (await db.findUserByEmail(normEmail))
    return res.status(409).json({ message: "이미 가입된 이메일이에요." });

  const password_hash = await bcrypt.hash(password, 12);
  let user;
  try {
    user = await db.createUser({ name: name.trim(), email: normEmail, password_hash });
  } catch (err) {
    // 동시 요청 경합: UNIQUE 제약 위반은 409 로 안전하게 변환(pg code 23505).
    if (err?.code === "23505") return res.status(409).json({ message: "이미 가입된 이메일이에요." });
    throw err;
  }
  await db.seedCalendars(user.id);
  res.json({ token: sign(user), user: publicUser(user) });
}));

// ── 로그인 ───────────────────────────────────────────────
router.post("/login", h(async (req, res) => {
  const { email, password } = req.body ?? {};
  const user = await db.findUserByEmail(String(email ?? "").trim().toLowerCase());
  // 타이밍 공격 완화를 위해 사용자 유무와 무관하게 항상 compare 수행.
  const ok = user?.password_hash
    ? await bcrypt.compare(password ?? "", user.password_hash)
    : await bcrypt.compare(password ?? "", "$2a$12$0000000000000000000000000000000000000000000000000000");
  if (!user || !ok)
    return res.status(401).json({ message: "이메일 또는 비밀번호가 올바르지 않아요." });
  res.json({ token: sign(user), user: publicUser(user) });
}));

// ── 로그인 상태 확인 ─────────────────────────────────────
// 프론트가 앱 진입 시 호출(authClient.me). 토큰이 유효하면 사용자, 아니면 401.
router.get("/me", requireAuth, h(async (req, res) => {
  const user = await db.findUserById(req.userId);
  if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없어요." });
  res.json(publicUser(user));
}));

// ── 소셜 로그인 공통: provider 프로필로 upsert 후 사용자 반환 ──
async function upsertOAuthUser({ provider, providerUid, email, name, avatarUrl }) {
  const linked = await db.findUserByOAuth(provider, providerUid);
  if (linked) return linked;

  let user = email ? await db.findUserByEmail(email.toLowerCase()) : null;
  if (!user) {
    user = await db.createUser({
      name: name ?? "사용자",
      email: (email ?? `${provider}_${providerUid}@planora.local`).toLowerCase(),
      avatar_url: avatarUrl ?? null,
    });
    await db.seedCalendars(user.id);
  }
  await db.linkOAuth(user.id, provider, providerUid);
  return user;
}

// Google: 표준 OAuth 2.0 code 플로우
router.get("/google", (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: process.env.GOOGLE_REDIRECT_URI ?? "",
    response_type: "code",
    scope: "openid email profile",
    state: req.query.redirect ?? "",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get("/google/callback", h(async (req, res) => {
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
}));

// Kakao: OAuth 2.0
router.get("/kakao", (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.KAKAO_CLIENT_ID ?? "",
    redirect_uri: process.env.KAKAO_REDIRECT_URI ?? "",
    response_type: "code",
    state: req.query.redirect ?? "",
  });
  res.redirect(`https://kauth.kakao.com/oauth/authorize?${params}`);
});

router.get("/kakao/callback", h(async (req, res) => {
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
}));

export default router;
