// server.js — Express 진입점 (ESM: package.json 에 "type":"module")
//   개발용 최소 구동:  npm i && node server.js   (DB 없이 인메모리로 바로 실행)
//   실제 DB 구동:      .env 에 DATABASE_URL 설정 + npm i pg + psql -f schema.sql
import "dotenv/config";
import express from "express";
import cors from "cors";
import { seedFixedUsers } from "./seedUsers.js";
import { db } from "./db.js";
import authRoutes from "./auth.routes.js";
import eventRoutes from "./events.routes.js";
import shiftRoutes from "./shift.routes.js";
import travelRoutes from "./travel.routes.js";
import agentRoutes from "./agent.routes.js";
import notifyRoutes from "./notify.routes.js";
import hooksRoutes from "./hooks.routes.js";
import { startScheduler } from "./scheduler.js";

const app = express();
app.use(cors({ origin: process.env.WEB_ORIGIN ?? true, credentials: true }));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/events", shiftRoutes);   // POST /api/events/:id/shift (미루기 기능)
app.use("/api/travel", travelRoutes);  // GET /api/travel/next (즉석 이동시간 조회)
app.use("/api/agent", agentRoutes);    // 퀵애드 에이전트 run/resume
app.use("/api/notify", notifyRoutes);  // 알림 설정/위치/테스트/인박스
app.use("/api/hooks", hooksRoutes);    // 슬랙 등 외부 인바운드 웹훅

app.get("/api/health", (_req, res) => res.json({ ok: true, store: db.mode }));

// 정의되지 않은 경로 → 404 (HTML 스택트레이스 대신 JSON)
app.use((_req, res) => res.status(404).json({ message: "찾을 수 없는 경로예요." }));

// 에러 핸들링 미들웨어: 라우트에서 next(err) 로 넘어온 예외를 JSON 500 으로 응답
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status ?? 500).json({ message: err.message ?? "서버 오류가 발생했어요." });
});

const seeded = await seedFixedUsers(db);
console.log(`고정 계정 ${seeded.length}개 준비됨:`, seeded.join(", "));

startScheduler(); // 알림 틱 시작 (임박/빈슬롯/이동 사전알림)

const port = process.env.PORT ?? 4000;
app.listen(port, () => console.log(`Planora API on :${port}  (store: ${db.mode})`));
