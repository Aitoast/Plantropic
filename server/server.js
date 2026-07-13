// server.js — Express 진입점 (ESM: package.json 에 "type":"module")
//   개발용 최소 구동:  npm i && node server.js   (DB 없이 인메모리로 바로 실행)
//   실제 DB 구동:      .env 에 DATABASE_URL 설정 + npm i pg + psql -f schema.sql
import "dotenv/config";
import express from "express";
import { seedFixedUsers } from "./seedUsers.js";
import cors from "cors";
import authRoutes from "./auth.routes.js";
import eventRoutes from "./events.routes.js";
import aiRoutes from "./ai.routes.js";
import { db } from "./db.js";
import travelRoutes from "./travel.routes.js"
import agentRoutes from "./agent.routes.js";

const app = express();
app.use(cors({ origin: process.env.WEB_ORIGIN ?? true, credentials: true }));
app.use(express.json());
app.use("/api/travel", travelRoutes); 
app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);


app.use("/api/ai", aiRoutes);
app.use("/api/agent", agentRoutes); 


app.get("/api/health", (_req, res) => res.json({ ok: true, store: db.mode }));

// 정의되지 않은 경로 → 404 (HTML 스택트레이스 대신 JSON)
app.use((_req, res) => res.status(404).json({ message: "찾을 수 없는 경로예요." }));

// 에러 핸들링 미들웨어: 라우트에서 next(err) 로 넘어온 예외를 JSON 500 으로 응답.
// (이게 없으면 async 예외가 그대로 노출되거나 요청이 끊김
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status ?? 500).json({ message: err.message ?? "서버 오류가 발생했어요." });
});

const seeded = await seedFixedUsers(db);
console.log(`고정 계정 ${seeded.length}개 준비됨:`, seeded.join(", "));

const port = process.env.PORT ?? 4000;
app.listen(port, () => console.log(`Planora API on :${port}  (store: ${db.mode})`));
