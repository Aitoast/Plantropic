// gate-test.mjs — 인박스 게이팅 검증 (LLM 키 불필요)
//   checkQuickAdd/markNotified 단위 + inbound 라우팅(확인·미루기 무료) 확인
import { db } from "./db.js";
import { checkQuickAdd, markNotified, MAX_INBOX_LEN } from "./gate.js";
import { runQuickAdd } from "./agent/service.js";

process.env.INBOX_DAILY_MAX = process.env.INBOX_DAILY_MAX ?? "12";
let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log(`${c ? "✓" : "✗"} ${n}`); };

const u = await db.createUser({ name: "g", email: "g@g.g" });
await db.seedCalendars(u.id);

// ── B) 창 밖: 하루 12회까지 통과, 13번째 차단 ──
let allowedCount = 0, blocked = null;
for (let i = 0; i < 13; i++) {
  const r = await checkQuickAdd(u.id);
  if (r.allowed) allowedCount++; else blocked = r;
}
ok("창 밖에서 12회 통과", allowedCount === 12);
ok("13번째 차단(remaining 0)", blocked && blocked.allowed === false && blocked.remaining === 0);
ok("차단 사유에 안내 포함", /한도|다시 열려/.test(blocked.reason));

// ── A) 알림 오면 창이 열려 한도 초과여도 통과 ──
await markNotified(u.id);
const afterNotify = await checkQuickAdd(u.id);
ok("알림 후 15분 창에서 한도 초과여도 통과", afterNotify.allowed === true && afterNotify.windowActive === true);

// ── 날짜 리셋: 다른 유저로 오늘 카운트는 독립 ──
const u2 = await db.createUser({ name: "g2", email: "g2@g.g" });
await db.seedCalendars(u2.id);
const fresh = await checkQuickAdd(u2.id);
ok("신규 유저는 첫 호출 통과(remaining 11)", fresh.allowed && fresh.remaining === 11);

// ── E) 길이 상한: runQuickAdd 가 LLM 전에 컷 ──
const long = "가".repeat(MAX_INBOX_LEN + 1);
const eRes = await runQuickAdd(u2.id, long);
ok(`${MAX_INBOX_LEN}자 초과 입력 거부`, eRes.status === "error" && /자까지/.test(eRes.message));

// ── D) 확인·미루기는 게이트를 안 탐 (키 없이도 카운트 불변) ──
// runQuickAdd 는 길이 통과 후 model 없으면 error(게이트 소비 전) → 카운트 영향 없음 확인
const before = (await checkQuickAdd(u2.id)); // 소비 1
const cntBefore = before.remaining;
const noKey = await runQuickAdd(u2.id, "짧은 문장"); // 키 없음 → gate 이전에 error
ok("AI 키 없으면 게이트 소비 전에 안내(카운트 불변)", noKey.status === "error");
const after = await checkQuickAdd(u2.id); // 소비 1 더
ok("키 없음 호출은 한도를 깎지 않음", after.remaining === cntBefore - 1);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
