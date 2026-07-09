// smoke-test.mjs — 로그인 상태 확인 플로우를 실제로 검증합니다.
const BASE = process.env.BASE ?? "http://localhost:4000/api";
const email = `test_${Date.now()}@planora.local`;

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { console.log(`  ✓ ${name}`); pass++; }
  else { console.log(`  ✗ ${name}  ${extra}`); fail++; }
}
const j = async (r) => { try { return await r.json(); } catch { return {}; } };

console.log(`\n로그인 상태 검증 시작 → ${BASE}\n`);

{
  const r = await fetch(`${BASE}/health`);
  const b = await j(r);
  check("health OK", r.ok && b.ok === true, JSON.stringify(b));
  console.log(`    (store: ${b.store})`);
}
{
  const r = await fetch(`${BASE}/auth/me`);
  check("토큰 없이 /me → 401 (미로그인)", r.status === 401);
}
let token;
{
  const r = await fetch(`${BASE}/auth/signup`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "테스트", email, password: "password123" }),
  });
  const b = await j(r);
  token = b.token;
  check("회원가입 → 토큰 발급", r.ok && !!b.token && b.user?.email === email, JSON.stringify(b));
}
{
  const r = await fetch(`${BASE}/auth/signup`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "테스트", email, password: "password123" }),
  });
  check("같은 이메일 재가입 → 409", r.status === 409);
}
{
  const r = await fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  const b = await j(r);
  check("유효 토큰으로 /me → 200 (로그인됨)", r.ok && b.email === email, JSON.stringify(b));
}
{
  const r = await fetch(`${BASE}/auth/me`, { headers: { Authorization: "Bearer not.a.real.token" } });
  check("잘못된 토큰으로 /me → 401", r.status === 401);
}
{
  const r = await fetch(`${BASE}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });
  const b = await j(r);
  check("올바른 자격증명으로 로그인 → 토큰", r.ok && !!b.token);
}
{
  const r = await fetch(`${BASE}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "wrong-password" }),
  });
  check("틀린 비밀번호로 로그인 → 401", r.status === 401);
}
{
  const noAuth = await fetch(`${BASE}/events`);
  check("토큰 없이 /events → 401", noAuth.status === 401);

  const created = await fetch(`${BASE}/events`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      calKey: "work", title: "스프린트 계획",
      startsAt: "2026-07-07T13:00:00.000Z", endsAt: "2026-07-07T14:30:00.000Z",
      location: "회의실 C", summary: "분기 목표 정렬",
    }),
  });
  const cb = await j(created);
  check("로그인 상태로 일정 생성 → 200", created.ok && cb.title === "스프린트 계획", JSON.stringify(cb));

  const list = await fetch(`${BASE}/events`, { headers: { Authorization: `Bearer ${token}` } });
  const lb = await j(list);
  check("내 일정 목록에 1건", list.ok && Array.isArray(lb) && lb.length === 1);
}

console.log(`\n결과: ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);