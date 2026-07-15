// server/reschedule.js — 일정 미루기 (에이전트 아님, 순수 기능)
//   shiftEvent(userId, eventId, deltaMinutes, cascade)
//   cascade=true 면 같은 날 그 일정 이후의 일정들도 전부 같은 간격만큼 이동
//   (간격 유지 = 모든 후속 일정에 동일 delta 적용)
import { db } from "./db.js";

const addMin = (iso, min) => new Date(new Date(iso).getTime() + min * 60000).toISOString();

export async function shiftEvent(userId, eventId, deltaMinutes, cascade = false) {
  const all = await db.listEvents(userId);
  const target = all.find((e) => e.id === eventId);
  if (!target) return { ok: false, message: "일정을 찾을 수 없어요." };

  const moved = [];
  const doShift = async (e) => {
    await db.updateEvent(userId, e.id, {
      starts_at: addMin(e.starts_at, deltaMinutes),
      ends_at: addMin(e.ends_at, deltaMinutes),
    });
    moved.push({ id: e.id, title: e.title, from: e.starts_at, to: addMin(e.starts_at, deltaMinutes) });
  };

  await doShift(target);

  if (cascade) {
    const dayKey = new Date(target.starts_at).toDateString();
    const followers = all.filter((e) =>
      e.id !== target.id &&
      new Date(e.starts_at).toDateString() === dayKey &&
      new Date(e.starts_at) >= new Date(target.starts_at)
    );
    for (const e of followers) await doShift(e);
  }

  const dir = deltaMinutes >= 0 ? "미뤘어요" : "당겼어요";
  return {
    ok: true, moved,
    message: `"${target.title}" 포함 ${moved.length}건을 ${Math.abs(deltaMinutes)}분 ${dir}.`,
  };
}

// 지금 시각 이후 가장 먼저 시작하는 일정 (알림·채팅 미루기의 기본 대상)
export async function findNextEvent(userId, now = new Date()) {
  const rows = await db.listEvents(userId, { from: now.toISOString() });
  return rows.find((e) => new Date(e.starts_at) > now) ?? null;
}
