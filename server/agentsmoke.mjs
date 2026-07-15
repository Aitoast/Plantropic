// agent-smoke.mjs — AI 에이전트(퀵애드+HITL)를 실제 서버에 붙여 테스트.
// 사용법: 서버 실행 후(API_KEY 설정) →  node agent-smoke.mjs
//   BASE, EMAIL, PW 환경변수로 대상/계정 지정 가능.
const BASE = process.env.BASE ?? "http://localhost:4000/api";
const EMAIL = process.env.EMAIL ?? "aa@aa.com";   // 고정 계정
const PW = process.env.PW ?? "12345678";

const j = async (r) => { const t = await r.text(); try { return { s: r.status, d: JSON.parse(t) }; } catch { return { s: r.status, d: t }; } };

console.log(`\n에이전트 테스트 → ${BASE}\n`);

// 1) 로그인
let { d: login } = await j(await fetch(`${BASE}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: PW }) }));
const token = login?.token;
if (!token) { console.log("✗ 로그인 실패:", login, "\n→ 고정계정(EMAIL/PW)이 맞는지 확인하세요."); process.exit(1); }
console.log("✓ 로그인:", login.user?.name);
const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

// 2) 에이전트 실행 (자연어 퀵애드)
const text = "다음 주 수요일 오후 3시에 강남역에서 김대리랑 미팅";
console.log(`\n▶ /agent/run quick-add: "${text}"`);
let { s, d: run } = await j(await fetch(`${BASE}/agent/run`, { method: "POST", headers: H, body: JSON.stringify({ feature: "quick-add", input: { text } }) }));
if (s === 400) { console.log("✗", run?.message, "\n→ server/.env 에 AI_API 를 넣고 서버를 재시작하세요."); process.exit(1); }
console.log("  status:", run.status);

// 3) HITL: 확인 필요하면 제안 출력 후 승인 재개
if (run.status === "needs_confirmation") {
  console.log("  🅰 에이전트 제안(사용자 확인 대기):");
  for (const a of run.actions ?? []) console.log("    -", a.name, JSON.stringify(a.args));
  console.log("\n▶ /agent/resume approve=true");
  ({ d: run } = await j(await fetch(`${BASE}/agent/resume`, { method: "POST", headers: H, body: JSON.stringify({ threadId: run.threadId, decision: { approve: true } }) })));
  console.log("  status:", run.status, "| 메시지:", run.message);
}

// 4) DB 반영 확인
const { d: events } = await j(await fetch(`${BASE}/events`, { headers: H }));
const added = Array.isArray(events) && events.find((e) => e.title?.includes("미팅") || e.location?.includes("강남"));
console.log("\n결과:", added ? `✓ 일정이 DB에 생성됨 — "${added.title}" @ ${added.location}` : "일정 미확인(제안이 거절됐거나 파싱 실패)");
