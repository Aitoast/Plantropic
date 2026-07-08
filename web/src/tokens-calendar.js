// Planora — 공통 디자인 토큰 (캘린더 앱 / 랜딩 공용)
export const colors = {
  ink: '#16181d',
  text: '#1a1d21',
  textInk: '#33383f',
  textMuted: '#4a4f57',
  textSubtle: '#6b7280',
  textFaint: '#8a919c',
  textGhost: '#a0a6b0',
  textDim: '#9aa1ac',

  appBg: '#f5f6f8',
  surface: '#ffffff',
  panel: '#f0f1f4',
  hover: '#f7f8fa',
  soft: '#fafbfc',

  border: '#e6e9ef',
  gridLine: '#f0f1f4',
  borderStrong: '#d6dae2',

  sun: '#d95a5a',   // 일요일 헤더
  sat: '#3b6fd4',   // 토요일 헤더
};

export const fonts = {
  sans: "'IBM Plex Sans', system-ui, sans-serif",
  mono: "'IBM Plex Mono', monospace",
};

// 시간축 뷰(주/일) 설정
export const TIME_GRID = {
  startHour: 7,   // 07:00
  endHour: 22,    // 22:00
  hourPx: 56,     // 1시간 = 56px
};
