<<<<<<< HEAD
# Handoff: Planora 랜딩페이지

## Overview
Planora(웹·모바일 공용 협업 스케줄러)의 마케팅 랜딩페이지입니다. 방문자에게 제품 가치를 소개하고 회원가입(무료 시작)으로 전환시키는 것이 목표입니다. 캘린더 앱 본체와 동일한 디자인 시스템(IBM Plex Sans, 블랙 포인트, 카테고리 색상)을 공유합니다.

## Fidelity
**High-fidelity (hifi).** 최종 색상·타이포·간격·반응형 규칙이 모두 확정된 픽셀 단위 목업입니다. 아래 디자인 토큰과 컴포넌트 스펙을 그대로 재현하세요.

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

## Screens / Views
단일 랜딩페이지, 위→아래 8개 섹션.

### 1. Nav (sticky)
- 높이 68px, `position: sticky; top:0`, 배경 `rgba(255,255,255,0.82)` + `backdrop-filter: blur(12px)`, 하단 보더 `#edeff3`.
- 좌: 로고(P 마크 32px 라운드 사각 `#16181d` + "Planora" 20px/600). 우: 텍스트 링크(기능/크로스플랫폼/사용법 14px/500 `#33383f`) · 구분선 · 로그인 · 블랙 "무료로 시작" 버튼(높이 40).
- 링크 hover 시 색상 `#16181d`.

### 2. Hero
- `flex-wrap` 2열: 좌측 카피, 우측 목업 카드. 각 컬럼 `flex: 1 1 380px; min-width: 300px` → 좁아지면 세로 스택.
- 배지: "웹 · 모바일 실시간 동기화" (초록 dot `#1f8a5b`, 배경 `#f0f1f4`, pill).
- H1: `clamp(34px, 5.2vw, 58px)`, 700, letter-spacing -1.5px, line-height 1.08. "팀의 모든 일정을,\n한 곳에서."
- 본문: `clamp(15px,1.6vw,18px)` `#5a606a`.
- CTA: 블랙 "무료로 시작하기"(높이 52, shadow `0 2px 8px rgba(0,0,0,.14)`) + 아웃라인 "▶ 데모 보기".
- 목업 카드: 흰 배경, 보더 `#e6e9ef`, radius 20, shadow float. 상단 "오늘 / 7월 7일 화요일" + 아바타 스택(김·박·+3). 하단 일정 4행(모노 시간 46px + 카테고리 색상 바 4px + 제목/메타). 첫 행 배경 `#f7f8fa`.

### 3. Trust strip
- 배경 `#fafbfc`, 상하 보더 `#edeff3`. `flex-wrap` 중앙 정렬. "성장하는 팀들이 신뢰합니다" + 로고 텍스트 5개(17px/700 `#b6bcc6`).

### 4. Features
- Eyebrow "기능"(13px/600 `#3b6fd4` uppercase) + H2 `clamp(28px,3.6vw,44px)`.
- 카드 그리드: `grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))`, gap `clamp(16px,2vw,24px)`.
- 카드: padding 28, 보더 `#e9ebf0`, radius 16. 아이콘 48px 라운드(카테고리 배경/전경색) + 제목 17.5px/600 + 설명 14px `#6b7280`.
- 카드 hover: 보더 `#d3d8e0` + shadow.
- 6개: 통합 캘린더 뷰 / 실시간 공유·초대 / 스마트 알림 / 댓글·메모 / 색상 관리 / 어디서나 동기화.

### 5. Cross platform (다크)
- 배경 `#16181d`, 흰 텍스트. `flex-wrap` 2열(텍스트 + 디바이스 목업).
- Eyebrow `#8ea6e0`. 체크리스트 3개(반투명 원 배경 + 그린 체크 `#7fe0a8`).
- 목업: 데스크톱 브라우저 창(트래픽 라이트 3점, aspect 16/11) + 모바일(폭 118px, aspect 9/19). 각각 이미지 슬롯 — `desktopShot`/`mobileShot` prop 미지정 시 모노 라벨 플레이스홀더.

### 6. How it works
- 중앙 정렬 헤더 "30초면 충분합니다". `grid auto-fit minmax(240px,1fr)`.
- 3단계: 숫자 뱃지 44px 블랙 라운드 + 연결선. 계정 만들기 / 캘린더 연결 / 팀 초대하기.

### 7. CTA
- 패널 배경 `#f0f1f4`, radius 24, 중앙 정렬. H2 `clamp(28px,4vw,46px)`. 블랙 + 아웃라인 버튼.

### 8. Footer
- 상단 보더. 좌측 로고+설명, 우측 3개 링크 컬럼(제품/회사/지원). 하단 카피라이트 바.

## Interactions & Behavior
- 네비/CTA 링크는 앵커(`#features`, `#platform`, `#how`, `#cta`) → `scroll-behavior: smooth` 로 부드럽게 스크롤.
- hover 전이: 링크·카드 `0.15s ease` (색/보더/그림자). `src/planora-landing.css` 참고.
- 상태 없음(정적 마케팅 페이지). 실제 CTA는 라우팅(`/signup`) 또는 모달로 연결.

## Responsive behavior
**미디어쿼리 없음.** 유동 규칙으로만 처리:
- 타이포: `clamp(min, vw, max)`.
- 2열 섹션(Hero, Cross platform): `flex-wrap` + `flex: 1 1 380px; min-width: 300px` → 폭 부족 시 세로 스택.
- 카드/스텝: `grid-template-columns: repeat(auto-fit, minmax(Npx, 1fr))` → 자동 열 수 조정, 모바일 1열.
- 섹션 여백: `clamp()` 로 화면 폭 따라 축소.
- 필요하면 프로젝트 컨벤션에 맞춰 실제 미디어쿼리(모바일 네비 햄버거 등)를 추가로 얹어도 됩니다.

## Design Tokens
`src/tokens.js` 에 전체 정의. 요약:
- 색: ink `#16181d`, text `#1a1d21`, muted `#5a606a`, subtle `#6b7280`, faint `#8a919c`, ghost `#a0a6b0`
- 배경: bg `#fff`, soft `#fafbfc`, panel `#f0f1f4`, hover `#f7f8fa`
- 보더: `#e6e9ef` / soft `#edeff3` / strong `#d6dae2`
- 카테고리: personal `#1f8a5b`, work `#3b6fd4`, meeting `#7c5cdb`, deadline `#d97757`, team `#0e9aa7` (+ 각 배경 catBg)
- 폰트: IBM Plex Sans(본문), IBM Plex Mono(시간 표기)
- radius: 8/12/16/20/24, 그림자: card/cta/float/dark
- 레이아웃: maxWidth 1200, padX `clamp(20px,4vw,40px)`, sectionY `clamp(56px,9vw,110px)`

## Assets
- 폰트: Google Fonts — IBM Plex Sans, IBM Plex Mono (CSS `@import`).
- 아이콘: 유니코드 글리프(▦ ⇆ ◔ ✎ ● ↻ ✓ ▶) 사용 중 → 프로덕션에서는 lucide-react 등 아이콘 라이브러리로 교체 권장.
- 제품 스크린샷: `desktopShot`/`mobileShot` prop로 주입. Planora 캘린더 앱 화면을 캡처해 넣으세요(원본 디자인은 이미지 슬롯 사용).
- 로고 텍스트/회사명·후기는 플레이스홀더 — 실제 데이터로 교체 필요.

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
> 캘린더 앱 본체 화면(`Planora Calendar.dc.html`)도 같은 토큰을 씁니다. 앱 화면 핸드오프가 필요하면 별도 요청해 주세요.
=======
# Plantropic
ai agent,web ,mobile planner
>>>>>>> 27815429a34d03b7daf3265f094dfac0decac0e4
