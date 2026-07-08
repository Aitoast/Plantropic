// Planora — Design Tokens
// 캘린더 앱 / 랜딩페이지 공통 디자인 시스템 토큰.

export const colors = {
  ink: '#16181d',        // primary / black accent (버튼, 로고)
  inkSoft: '#33383f',
  text: '#1a1d21',
  textMuted: '#5a606a',
  textSubtle: '#6b7280',
  textFaint: '#8a919c',
  textGhost: '#a0a6b0',

  bg: '#ffffff',
  bgSoft: '#fafbfc',
  bgPanel: '#f0f1f4',
  bgHover: '#f7f8fa',

  border: '#e6e9ef',
  borderSoft: '#edeff3',
  borderStrong: '#d6dae2',

  // 카테고리 색상 (일정 종류별)
  cat: {
    personal: '#1f8a5b', // 개인
    work: '#3b6fd4',     // 업무
    meeting: '#7c5cdb',  // 회의
    deadline: '#d97757', // 마감
    team: '#0e9aa7',     // 팀 공유
  },
  catBg: {
    personal: '#e7f4ee',
    work: '#e8effb',
    meeting: '#efeafc',
    deadline: '#fbeee7',
    team: '#e4f3f4',
  },
};

export const fonts = {
  sans: "'IBM Plex Sans', system-ui, sans-serif",
  mono: "'IBM Plex Mono', monospace",
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  pill: 9999,
};

export const shadow = {
  card: '0 8px 24px -16px rgba(22,24,29,0.18)',
  cta: '0 2px 8px rgba(0,0,0,0.14)',
  float: '0 30px 60px -24px rgba(22,24,29,0.28), 0 8px 20px -12px rgba(22,24,29,0.1)',
  dark: '0 30px 60px -20px rgba(0,0,0,0.5)',
};

// 컨테이너 폭 / 반응형 여백 (미디어쿼리 없이 clamp 로 유동 처리)
export const layout = {
  maxWidth: 1200,
  padX: 'clamp(20px, 4vw, 40px)',
  sectionY: 'clamp(56px, 9vw, 110px)',
};
