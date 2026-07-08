// server.js — Express 진입점 (ESM: package.json에 "type":"module")
//   npm i express cors pg bcrypt jsonwebtoken
import express from "express";
import cors from "cors";
import authRoutes from "./auth.routes.js";
import eventRoutes from "./events.routes.js";

const app = express();
app.use(cors({ origin: process.env.WEB_ORIGIN ?? true, credentials: true }));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const port = process.env.PORT ?? 4000;
app.listen(port, () => console.log(`Planora API on :${port}`));
