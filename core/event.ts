
export type CalKey = "personal" | "work" | "meeting" | "deadline" | "team" | "family";

export interface CalEvent {
  id: string;
  cal: CalKey;
  title: string;
  day: number;        // 월 내 일자 (또는 ISO date로 확장)
  start: number;      // 소수 시간 9.5 = 09:30
  end: number;
  loc: string;
  desc: string;
}

export interface EventInput {
  title: string; cal: CalKey; day: number | string;
  start: string; end: string; loc?: string; desc?: string;
}

export const toDec = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h + (m || 0) / 60;
};
export const toStr = (d: number) => {
  const h = Math.floor(d), m = Math.round((d - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/** 입력을 검증·정규화. 실패 시 문자열 배열 반환 */
export function normalize(input: EventInput): { ok: true; value: Omit<CalEvent, "id"> } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!input.title.trim()) errors.push("제목은 필수입니다.");
  let start = toDec(input.start);
  let end = toDec(input.end);
  if (Number.isNaN(start) || Number.isNaN(end)) errors.push("시간 형식이 올바르지 않습니다.");
  if (end <= start) end = start + 0.5;               // 자동 보정
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      cal: input.cal,
      title: input.title.trim(),
      day: Number(input.day),
      start, end,
      loc: input.loc?.trim() || "장소 없음",
      desc: input.desc?.trim() || "",
    },
  };
}