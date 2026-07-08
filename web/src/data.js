// Planora 랜딩페이지 콘텐츠 데이터.
// 실제 프로젝트에서는 CMS / i18n 파일로 분리해도 됩니다.

export const mockEvents = [
  { time: '09:00', cal: 'meeting',  title: '주간 팀 스탠드업',   meta: '회의실 A · 3명' },
  { time: '11:00', cal: 'work',     title: '제품 스펙 문서 리뷰', meta: 'Notion · 2명' },
  { time: '12:30', cal: 'personal', title: '점심 - 지수',         meta: '성수동' },
  { time: '17:00', cal: 'deadline', title: '분기 보고서 제출',    meta: '오늘 마감' },
];

export const features = [
  { icon: '▦', cal: 'work',     title: '통합 캘린더 뷰',        desc: '월·주·일·아젠다 뷰를 클릭 한 번으로 전환. 필요한 시야로 일정을 확인하세요.' },
  { icon: '⇆', cal: 'team',     title: '실시간 일정 공유 · 초대', desc: '링크로 일정을 공유하고 참석자를 초대하세요. 수락 여부가 실시간으로 보입니다.' },
  { icon: '◔', cal: 'deadline', title: '스마트 알림 · 리마인더',  desc: '10분 전부터 하루 전까지, 일정별로 알림을 설정해 중요한 순간을 놓치지 마세요.' },
  { icon: '✎', cal: 'meeting',  title: '댓글 · 메모 협업',       desc: '일정마다 댓글과 메모를 남겨 맥락을 공유하세요. 회의 준비가 한결 수월해집니다.' },
  { icon: '●', cal: 'personal', title: '캘린더 색상 관리',       desc: '개인·업무·팀·마감을 색으로 구분하고, 체크 한 번으로 원하는 캘린더만 골라 보세요.' },
  { icon: '↻', cal: 'work',     title: '어디서나 동기화',        desc: '데스크톱 웹과 모바일 앱이 즉시 동기화됩니다. 기기를 바꿔도 일정은 그대로.' },
];

export const platformPoints = [
  '오프라인에서 편집하고 온라인 복귀 시 자동 반영',
  '기기별 푸시 알림으로 어디서든 리마인드',
  '팀원 초대·권한 관리를 모바일에서도 그대로',
];

export const steps = [
  { n: '1', title: '계정 만들기',  desc: '이메일 또는 구글 계정으로 30초 만에 가입하세요.' },
  { n: '2', title: '캘린더 연결',  desc: '기존 캘린더를 불러오거나 새 팀 캘린더를 만드세요.' },
  { n: '3', title: '팀 초대하기',  desc: '링크로 팀원을 초대하면 바로 일정 공유가 시작됩니다.' },
];

export const logos = ['Northwind', 'Acme Co', '스튜디오랩', 'Vertex', '한빛대학'];

export const footerCols = [
  { title: '제품', links: ['기능', '크로스플랫폼', '요금제', '업데이트'] },
  { title: '회사', links: ['소개', '블로그', '채용', '문의하기'] },
  { title: '지원', links: ['도움말', '개발자 API', '개인정보', '이용약관'] },
];
