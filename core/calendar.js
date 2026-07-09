export const CATS = {
  personal: { label: "내 일정", bg: "#e7f4ee", fg: "#0f6e45", dot: "#1f8a5b" },
  work:     { label: "업무",    bg: "#e8effb", fg: "#1e4fa8", dot: "#3b6fd4" },
  meeting:  { label: "회의",    bg: "#efeafc", fg: "#5a3fb0", dot: "#7c5cdb" },
  deadline: { label: "마감",    bg: "#fbeee7", fg: "#b4552f", dot: "#d97757" },
  team:     { label: "팀 공유", bg: "#e4f3f4", fg: "#0a6d76", dot: "#0e9aa7" },
  family:   { label: "가족",    bg: "#fdeef4", fg: "#a83a72", dot: "#d95a97" },
};

export const CAT_KEYS = ["personal", "work", "meeting", "deadline", "team", "family"];
export const WD = ["일", "월", "화", "수", "목", "금", "토"];
export const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

// 소수 시간 9.5 ↔ Date/문자열
export const decFromDate = (d) => d.getHours() + d.getMinutes() / 60;
export const fmtTime = (t) => {
  const h = Math.floor(t), mn = Math.round((t - h) * 60);
  const ap = h < 12 ? "오전" : "오후";
  let hh = h % 12; if (hh === 0) hh = 12;
  return `${ap} ${hh}:${String(mn).padStart(2, "0")}`;
};

export const SEED_EVENTS = [
];