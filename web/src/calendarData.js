// Planora 캘린더 — 도메인 데이터 & 헬퍼

// 카테고리(캘린더 종류)별 색상
export const CATS = {
  personal: { label: '내 일정', bg: '#e7f4ee', fg: '#0f6e45', dot: '#1f8a5b' },
  work:     { label: '업무',    bg: '#e8effb', fg: '#1e4fa8', dot: '#3b6fd4' },
  meeting:  { label: '회의',    bg: '#efeafc', fg: '#5a3fb0', dot: '#7c5cdb' },
  deadline: { label: '마감',    bg: '#fbeee7', fg: '#b4552f', dot: '#d97757' },
  team:     { label: '팀 공유', bg: '#e4f3f4', fg: '#0a6d76', dot: '#0e9aa7' },
  family:   { label: '가족',    bg: '#fdeef4', fg: '#a83a72', dot: '#d95a97' },
};

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 현재 기준일 (데모). 실제 앱에서는 new Date() 사용.
export const TODAY = { y: 2026, m: 6, d: 7 }; // 2026-07-07 (m 은 0-index)

// 샘플 일정. 실제 앱에서는 API(FastAPI)에서 fetch.
// day = 해당 월의 날짜, start/end = 소수 시각(9.5 === 09:30)
export const EVENTS = [
];

export const MONTH_NAMES = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

// 09:30 → "오전 9:30"
export function fmtTime(t) {
  const h = Math.floor(t);
  const mn = Math.round((t - h) * 60);
  const ap = h < 12 ? '오전' : '오후';
  let hh = h % 12; if (hh === 0) hh = 12;
  return `${ap} ${hh}:${String(mn).padStart(2, '0')}`;
}

// 시간축 라벨: 13 → "1 PM"
export function fmtHour(h) {
  const ap = h < 12 ? 'AM' : 'PM';
  let hh = h % 12; if (hh === 0) hh = 12;
  return `${hh} ${ap}`;
}
