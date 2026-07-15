// server/scheduler.js — 주기적 알림 틱 (에이전트 아님, 순수 기능)
//   1분마다 알림 설정이 있는 유저를 순회하며:
//   ① 일정 임박: 시작 remindMin(기본 30분) 전 → 알림 + "미룰까요?" (답장으로 미루기 = shift 기능)
//   ② 빈 슬롯: 앞으로 emptySlotMin 동안 일정 없음 → "자연어로 답장하면 등록해드려요" (퀵애드 유도)
//   ③ 이동 사전알림: 다음 일정 장소까지 대중교통 10분 이상이면
//      출발권장시각(시작 - 이동 - 준비30분)에 맞춰 미리 알림
import { db } from "./db.js";
import { listUsersWithSettings, sendToUser } from "./notify.js";
import { geocode, transitMinutes, computeLeaveBy, mapsConfigured } from "./maps.js";

const PREP = Number(process.env.PREP_MINUTES ?? 30);           // 준비시간(분)
const THRESHOLD = Number(process.env.TRANSIT_ALERT_MIN ?? 10); // 이 분 이상 걸릴 때만 이동알림
const TICK_SEC = Number(process.env.SCHEDULER_INTERVAL_SEC ?? 60);

// 같은 알림 중복 발송 방지 (프로세스 내)
const sent = new Set();
const once = (key) => (sent.has(key) ? false : (sent.add(key), true));
const hhmm = (d) => `${String(new Date(d).getHours()).padStart(2, "0")}:${String(new Date(d).getMinutes()).padStart(2, "0")}`;

async function tickUser(userId, cfg, now) {
  const remindMin = Number(cfg.remindMin ?? 30);
  const emptySlotMin = Number(cfg.emptySlotMin ?? 0);
  const dayKey = now.toDateString();

  const upcoming = await db.listEvents(userId, { from: now.toISOString() });
  const next = upcoming.find((e) => new Date(e.starts_at) > now) ?? null;

  // ① 일정 임박 알림 + 변경(미루기) 질문
  for (const e of upcoming) {
    const start = new Date(e.starts_at);
    const minsTo = (start - now) / 60000;
    if (minsTo > 0 && minsTo <= remindMin && once(`remind:${e.id}`)) {
      await sendToUser(userId, `🔔 곧 일정: ${e.title}`,
        `${hhmm(start)} 시작${e.location ? ` @ ${e.location}` : ""}.\n` +
        `미루려면 "30분 미뤄줘" 라고 답장하세요. (뒤 일정까지 함께 밀려면 "전체 30분 미뤄줘")`);
    }
  }

  // ② 다음 일정이 비어 있으면 퀵애드 유도 (하루 1회, 08~22시)
  const hour = now.getHours();
  if (emptySlotMin > 0 && hour >= 8 && hour < 22) {
    const horizon = new Date(now.getTime() + emptySlotMin * 60000);
    const hasSoon = upcoming.some((e) => new Date(e.starts_at) < horizon);
    if (!hasSoon && once(`empty:${dayKey}:${userId}`)) {
      await sendToUser(userId, "🗓 다음 일정이 비어 있어요",
        `앞으로 ${Math.round(emptySlotMin / 60)}시간 동안 일정이 없네요.\n` +
        `"내일 오후 3시 강남역에서 미팅"처럼 답장하면 바로 등록해드려요.`);
    }
  }

  // ③ 이동 사전알림: 출발권장시각 도달 시 (현재위치 또는 직전 일정 장소 기준)
  if (mapsConfigured && next?.location) {
    const start = new Date(next.starts_at);
    if ((start - now) / 60000 <= 180) {                       // 3시간 이내 일정만 계산 (API 절약)
      const origin = cfg.lastLocation?.lat
        ? { lat: cfg.lastLocation.lat, lng: cfg.lastLocation.lng }
        : await originFromPrevEvent(userId, next, now);
      if (origin) {
        const dest = await geocode(next.location);
        if (dest) {
          const { minutes } = await transitMinutes(origin, dest);
          if (minutes >= THRESHOLD) {
            const { leaveBy, hhmm: leaveLabel, total } = computeLeaveBy(next.starts_at, minutes, PREP);
            if (now >= leaveBy && once(`travel:${next.id}`)) {
              await sendToUser(userId, `🚇 지금 준비하세요: ${next.title}`,
                `"${next.location}"까지 대중교통 약 ${minutes}분 + 준비 ${PREP}분 = ${total}분.\n` +
                `${leaveLabel}까지 출발해야 ${hhmm(start)} 일정에 늦지 않아요.`);
            }
          }
        }
      }
    }
  }
}

// 현재위치가 없으면 직전 일정의 장소를 출발지로 근사
async function originFromPrevEvent(userId, next, now) {
  const rows = await db.listEvents(userId, { to: next.starts_at });
  const prev = [...rows].reverse().find((e) => e.location && new Date(e.ends_at) <= new Date(next.starts_at));
  return prev ? await geocode(prev.location) : null;
}

export function startScheduler() {
  const run = async () => {
    const now = new Date();
    try {
      for (const { userId, config } of await listUsersWithSettings())
        await tickUser(userId, config ?? {}, now).catch((e) => console.error("스케줄러(유저)", e.message));
    } catch (e) { console.error("스케줄러", e.message); }
  };
  setInterval(run, TICK_SEC * 1000).unref();
  console.log(`알림 스케줄러 시작 (${TICK_SEC}초 간격, 준비 ${PREP}분, 이동알림 기준 ${THRESHOLD}분)`);
}
