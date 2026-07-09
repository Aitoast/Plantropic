import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import db from "./db.js";
import { normalize } from "@scheduler/core/event.js";

const app = express();
app.use(express.json());
const SECRET = process.env.JWT_SECRET;

// ── 인증 미들웨어
function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "no token" });
  try { req.userId = jwt.verify(token, SECRET).sub; next(); }
  catch { res.status(401).json({ error: "bad token" }); }
}

// ── 로그인/가입
app.post("/auth/register", (req, res) => {
  const { email, password } = req.body;
  const id = randomUUID();
  try {
    db.prepare("INSERT INTO users (id,email,pw_hash,created) VALUES (?,?,?,?)")
      .run(id, email, bcrypt.hashSync(password, 10), Date.now());
  } catch { return res.status(409).json({ error: "email exists" }); }
  res.json({ token: jwt.sign({ sub: id }, SECRET, { expiresIn: "30d" }) });
});

app.post("/auth/login", (req, res) => {
  const { email, password } = req.body;
  const u = db.prepare("SELECT * FROM users WHERE email=?").get(email);
  if (!u || !bcrypt.compareSync(password, u.pw_hash))
    return res.status(401).json({ error: "invalid credentials" });
  res.json({ token: jwt.sign({ sub: u.id }, SECRET, { expiresIn: "30d" }) });
});

// ── 이벤트 CRUD (모두 auth 필요, user_id로 격리)
app.get("/events", auth, (req, res) => {
  res.json(db.prepare("SELECT * FROM events WHERE user_id=?").all(req.userId));
});

app.post("/events", auth, (req, res) => {
  const n = normalize(req.body);                 // ← 프론트와 동일 규칙
  if (!n.ok) return res.status(400).json({ errors: n.errors });
  const ev = { id: randomUUID(), ...n.value };
  db.prepare(`INSERT INTO events (id,user_id,cal,title,day,start,end,loc,descr,updated)
              VALUES (@id,@uid,@cal,@title,@day,@start,@end,@loc,@desc,@upd)`)
    .run({ ...ev, uid: req.userId, upd: Date.now() });
  res.status(201).json(ev);
});

app.patch("/events/:id", auth, (req, res) => {
  const n = normalize(req.body);
  if (!n.ok) return res.status(400).json({ errors: n.errors });
  const r = db.prepare(`UPDATE events SET cal=@cal,title=@title,day=@day,start=@start,
                        end=@end,loc=@loc,descr=@desc,updated=@upd
                        WHERE id=@id AND user_id=@uid`)
    .run({ ...n.value, id: req.params.id, uid: req.userId, upd: Date.now() });
  if (!r.changes) return res.status(404).end();
  res.json({ id: req.params.id, ...n.value });
});

app.delete("/events/:id", auth, (req, res) => {
  const r = db.prepare("DELETE FROM events WHERE id=? AND user_id=?")
    .run(req.params.id, req.userId);
  res.status(r.changes ? 204 : 404).end();
});

app.listen(3000, () => console.log("API on :3000"));