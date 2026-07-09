<<<<<<< HEAD
# Handoff: Planora 랜딩페이지

## Overview
Planora(웹·모바일 공용 협업 스케줄러)의 마케팅 랜딩페이지입니다. 방문자에게 제품 가치를 소개하고 회원가입(무료 시작)으로 전환시키는 것이 목표입니다. 캘린더 앱 본체와 동일한 디자인 시스템(IBM Plex Sans, 블랙 포인트, 카테고리 색상)을 공유합니다.

## Fidelity


## Tech Context
- 프론트: React (Vite / Next / CRA 어디든 호환). 환경: Windows · VS Code.
- 백엔드: FastAPI 고려 중 → 이 랜딩은 정적 프론트로 배포하고, 앱 화면에서 일정 CRUD·공유·알림 API를 FastAPI와 연동하는 구조를 권장.

## 빠른 시작 (참고 구현 실행)
```bash
# 예: Vite React 프로젝트
npm create vite@latest planora -- --template react
cd planora && npm install
# 이 번들의 src/ 내용을 프로젝트 src/ 로 복사
```
```jsx
// App.jsx
import PlanoraLanding from './PlanoraLanding';
export default function App() {
  return <PlanoraLanding
    desktopShot="/shots/app.png"   // 없으면 플레이스홀더 표시
    mobileShot="/shots/app-mobile.png"
  />;
}
```



## Assets


## Files
```
design_handoff_planora_landing/
├─ README.md                         # 이 문서
├─ reference/
│  ├─ Planora Landing.dc.html        # 원본 디자인 프로토타입 (룩앤필 기준)
│  └─ image-slot.js                  # 프로토타입용 이미지 슬롯(프로덕션에선 <img>로 대체)
└─ src/
   ├─ PlanoraLanding.jsx             # 메인 컴포넌트(섹션 전부 포함)
   ├─ tokens.js                      # 디자인 토큰
   ├─ data.js                        # 콘텐츠 데이터(카피/기능/스텝 등)
   └─ planora-landing.css            # 리셋·폰트·hover 상태
```

=======
# Plantropic
ai agent,web ,mobile planner
>>>>>>> 27815429a34d03b7daf3265f094dfac0decac0e4
