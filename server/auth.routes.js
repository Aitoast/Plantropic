import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { db } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-insecure-secret-change-me";
if (!process.env.JWT_SECRET) {
  console.log("⚠  JWT_SECRET 미설정 → 개발용 임시 키 사용. 운영 전 반드시 .env 에 설정해야 합니다.");
}

const BOOT_ID = randomUUID();

const router = Router();
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function sign(user) {
  return jwt.sign({ sub: user.id, boot: BOOT_ID }, JWT_SECRET, { expiresIn: "30d" });
}
function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, avatarUrl: u.avatar_url ?? null };
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "로그인이 필요합니다." });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.boot !== BOOT_ID)
      return res.status(401).json({ message: "서버가 재시작되어 다시 로그인해야 해요." });
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ message: "세션이 만료됐습니다. 다시 로그인하여 주십시요." });
  }
}

// ── 회원가입 ──
router.post("/signup", h(async (req, res) => {
  if (process.env.ALLOW_SIGNUP === "false")
    return res.status(403).json({ message: "회원가입이 비활성화되어 있어요. 등록된 계정으로 로그인해주세요." });
  const { name, email, password } = req.body ?? {};
  if (!name?.trim() || !email?.trim() || !password)
    return res.status(400).json({ message: "필수 항목을 입력해주세요." });
  if (password.length < 8)
    return res.status(400).json({ message: "비밀번호는 8자 이상이어야 합니다." });

  const normEmail = email.trim().toLowerCase();
  if (await db.findUserByEmail(normEmail))
    return res.status(409).json({ message: "이미 가입된 이메일입니다." });

  const password_hash = await bcrypt.hash(password, 12);
  let user;
  try {
    user = await db.createUser({ name: name.trim(), email: normEmail, password_hash });
  } catch (err) {
    if (err?.code === "23505") return res.status(409).json({ message: "이미 가입된 이메일입니다." });
    throw err;
  }
  await db.seedCalendars(user.id);
  res.json({ token: sign(user), user: publicUser(user) });
}));

// ── 로그인 ──
router.post("/login", h(async (req, res) => {
  const { email, password } = req.body ?? {};
  const user = await db.findUserByEmail(String(email ?? "").trim().toLowerCase());
  const ok = user?.password_hash
    ? await bcrypt.compare(password ?? "", user.password_hash)
    : await bcrypt.compare(password ?? "", "$2a$12$0000000000000000000000000000000000000000000000000000");
  if (!user || !ok)
    return res.status(401).json({ message: "이메일 또는 비밀번호가 올바르지 않습니다." });
  res.json({ token: sign(user), user: publicUser(user) });
}));

// ── 로그인 상태 확인 ──
router.get("/me", requireAuth, h(async (req, res) => {
  const user = await db.findUserById(req.userId);
  if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
  res.json(publicUser(user));
}));

// ── 소셜 로그인 공통 ──
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

router.get("/google", (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: process.env.GOOGLE_REDIRECT_URI ?? "",
    response_type: "code", scope: "openid email profile",
    state: req.query.redirect ?? "",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get("/google/callback", h(async (req, res) => {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: req.query.code, client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI, grant_type: "authorization_code",
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

router.get("/kakao", (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.KAKAO_CLIENT_ID ?? "",
    redirect_uri: process.env.KAKAO_REDIRECT_URI ?? "",
    response_type: "code", state: req.query.redirect ?? "",
  });
  res.redirect(`https://kauth.kakao.com/oauth/authorize?${params}`);
});

router.get("/kakao/callback", h(async (req, res) => {
  const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code", client_id: process.env.KAKAO_CLIENT_ID,
      redirect_uri: process.env.KAKAO_REDIRECT_URI, code: req.query.code,
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