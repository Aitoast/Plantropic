import React from 'react';
import { colors as c, fonts, radius as r, shadow, layout } from './tokens-land';
import { mockEvents, features, platformPoints, steps, logos, footerCols } from './data';
import './planora-landing.css';

const container = {
  maxWidth: layout.maxWidth,
  margin: '0 auto',
  padding: `0 ${layout.padX}`,
};

// ---------------------------------------------------------------- Nav
function Nav({ onStart }) {
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(12px)',
      borderBottom: `1px solid ${c.borderSoft}`,
    }}>
      <div style={{ ...container, height: 68, display: 'flex', alignItems: 'center', gap: 24 }}>
        <a href="#top" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none', color: c.text }}>
          <Logo />
          <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.4px' }}>Plantropic</span>
        </a>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
          {[['기능', '#features'], ['크로스플랫폼', '#platform'], ['사용법', '#how']].map(([label, href]) => (
            <a key={href} href={href} className="pl-navlink"
               style={{ fontSize: 14, fontWeight: 500, color: c.inkSoft, textDecoration: 'none' }}>{label}</a>
          ))}
        </div>
        <div style={{ width: 1, height: 22, background: '#e2e5ea' }} />
        <a href="#login" onClick={(e)=> {
            e.preventDefault(); 
            if (onStart) onStart();
          }} className="pl-navlink" style={{ fontSize: 14, fontWeight: 500, color: c.inkSoft, textDecoration: 'none' }}>로그인</a>
        <a href="#calendar" onClick={(e)=> {
            e.preventDefault(); 
            if (onStart) onStart();
          }}
          style={btnPrimary(40, 18, 14)}>무료로 시작</a>
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------- Hero
function Hero({ onStart }) {
  return (
    <section id="top" style={{
      ...container, padding: `clamp(48px, 8vw, 96px) ${layout.padX}`,
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'clamp(32px, 5vw, 64px)',
    }}>
      <div style={{ flex: '1 1 380px', minWidth: 300 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 13px', background: c.bgPanel, borderRadius: 20, fontSize: 12.5, fontWeight: 600, color: c.inkSoft, marginBottom: 22 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.cat.personal }} /> 웹 · 모바일 실시간 동기화
        </div>
        <h1 style={{ fontSize: 'clamp(34px, 5.2vw, 58px)', fontWeight: 700, letterSpacing: '-1.5px', lineHeight: 1.08, margin: 0, color: "#000000" }}>
          팀의 모든 일정을<br />한 곳에서.
        </h1>
        <p style={{ fontSize: 'clamp(15px, 1.6vw, 18px)', lineHeight: 1.6, color: c.textMuted, margin: '22px 0 0', maxWidth: 480 }}>
          웹과 모바일에서 함께 쓰는 협업 캘린더. 일정 공유부터 초대, 알림, 댓글까지 — Plantropic 로 팀의 시간을 정리하세요.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 32 }}>
          <a href="#calendar" onClick={(e)=> {e.preventDefault(); 
            if (onStart) onStart();
          }}
          style={{ ...btnPrimary(52, 26, 15.5), boxShadow: shadow.cta }}>무료로 시작하기</a>
          <a href="#platform"S style={{ ...btnOutline(52, 24, 15.5), gap: 8 }}>▶ 데모 보기</a>
        </div>
        <div style={{ marginTop: 18, fontSize: 13, color: c.textFaint }}> 인공지능 어시스트 </div>
      </div>
      <div style={{ flex: '1 1 380px', minWidth: 300, display: 'flex', justifyContent: 'center' }}>
        <HeroMock />
      </div>
    </section>
  );
}

function HeroMock() {
  return (
    <div style={{ width: '100%', maxWidth: 440, background: c.bg, border: `1px solid ${c.border}`, borderRadius: r.xl, boxShadow: shadow.float, overflow: 'hidden' }}>
      <div style={{ padding: '18px 22px', borderBottom: `1px solid #f0f1f4`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 12, color: c.textFaint, fontWeight: 500 }}>오늘</div>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.4px', marginTop: 2 }}>7월 7일 화요일</div>
        </div>
        <div style={{ display: 'flex' }}>
          <Avatar bg={c.catBg.work} fg="#1e4fa8">김</Avatar>
          <Avatar bg={c.catBg.meeting} fg="#5a3fb0" ml={-8}>박</Avatar>
          <Avatar bg={c.ink} fg="#fff" ml={-8} size={11}>+3</Avatar>
        </div>
      </div>
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {mockEvents.map((ev, i) => (
          <div key={ev.title} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 10px', borderRadius: 10, background: i === 0 ? c.bgHover : 'transparent' }}>
            <span style={{ fontFamily: fonts.mono, fontSize: 12, color: c.textFaint, width: 46, flexShrink: 0 }}>{ev.time}</span>
            <span style={{ width: 4, alignSelf: 'stretch', borderRadius: 3, flexShrink: 0, background: c.cat[ev.cal] }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
              <div style={{ fontSize: 11.5, color: c.textFaint, marginTop: 1 }}>{ev.meta}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Trust strip
function TrustStrip() {
  return (
    <section style={{ borderTop: `1px solid ${c.borderSoft}`, borderBottom: `1px solid ${c.borderSoft}`, background: c.bgSoft }}>
      <div style={{ ...container, padding: `28px ${layout.padX}`, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 'clamp(20px, 4vw, 52px)' }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: c.textFaint, letterSpacing: '0.3px' }}>성장하는 팀들이 신뢰합니다</span>
        {logos.map((l) => (
          <span key={l} style={{ fontSize: 17, fontWeight: 700, color: '#b6bcc6', letterSpacing: '-0.3px' }}>{l}</span>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Features
function Features() {
  return (
    <section id="features" style={{ ...container, padding: `${layout.sectionY} ${layout.padX}` }}>
      <div style={{ maxWidth: 620 }}>
        <Eyebrow>기능</Eyebrow>
        <h2 style={{...heading , color: "#000000"}}>일정 관리에 필요한<br />모든 것을 하나로</h2>
        <p style={{ fontSize: 'clamp(15px, 1.5vw, 17px)', lineHeight: 1.6, color: c.textMuted, margin: '18px 0 0' }}>
          개인 일정부터 팀 협업, 프로젝트 태스크까지 — AI agent 가 도와주는 일정을 화면 전환 없이 한 워크스페이스에서 관리하세요.
        </p>
      </div>
      <div style={{ marginTop: 'clamp(36px, 5vw, 56px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'clamp(16px, 2vw, 24px)' }}>
        {features.map((f) => (
          <div key={f.title} className="pl-feature" style={{ padding: 28, background: c.bg, border: '1px solid #e9ebf0', borderRadius: r.lg }}>
            <div style={{ width: 48, height: 48, borderRadius: r.md, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, background: c.catBg[f.cal], color: c.cat[f.cal] }}>{f.icon}</div>
            <h3 style={{ fontSize: 17.5, fontWeight: 600, letterSpacing: '-0.4px', margin: '18px 0 0' }}>{f.title}</h3>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: c.textSubtle, margin: '9px 0 0' }}>{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Cross platform
function CrossPlatform({ desktopShot, mobileShot }) {
  return (
    <section id="platform" style={{ background: c.ink, color: '#fff' }}>
      <div style={{ ...container, padding: `${layout.sectionY} ${layout.padX}`, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'clamp(32px, 5vw, 64px)' }}>
        <div style={{ flex: '1 1 360px', minWidth: 300 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#8ea6e0', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 14 }}>크로스플랫폼</div>
          <h2 style={{ ...heading, color: '#fff' }}>데스크톱에서 만들고,<br />휴대폰에서 확인하세요</h2>
          <p style={{ fontSize: 'clamp(15px, 1.5vw, 17px)', lineHeight: 1.65, color: '#b6bcc6', margin: '20px 0 0', maxWidth: 440 }}>
            웹, 태블릿, 모바일 앱이 실시간으로 동기화됩니다. 어디서 일정을 바꿔도 팀 전체에 즉시 반영돼요.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 28 }}>
            {platformPoints.map((p) => (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: '#7fe0a8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: 15, color: '#e4e7ec' }}>{p}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: '1 1 360px', minWidth: 300, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 20 }}>
          <div style={{ flex: 1, maxWidth: 420, borderRadius: '16px 16px 4px 4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.14)', boxShadow: shadow.dark, background: '#0d0f13' }}>
            <div style={{ height: 34, display: 'flex', alignItems: 'center', gap: 7, padding: '0 14px', background: '#1c1f26' }}>
              {[0, 1, 2].map((i) => <span key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: '#3a3f48' }} />)}
            </div>
            <Shot src={desktopShot} ratio="16/11" label="데스크톱 앱 스크린샷" />
          </div>
          <div style={{ width: 118, flexShrink: 0, borderRadius: 20, overflow: 'hidden', border: '3px solid #2b2f37', boxShadow: '0 20px 40px -14px rgba(0,0,0,0.6)', background: '#0d0f13', marginBottom: -8 }}>
            <Shot src={mobileShot} ratio="9/19" label="모바일" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Shot({ src, ratio, label }) {
  return (
    <div style={{ aspectRatio: ratio, position: 'relative', background: '#111318' }}>
      {src ? (
        <img src={src} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a4f57', fontSize: 12, fontFamily: fonts.mono, textAlign: 'center', padding: 8 }}>{label}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- How it works
function HowItWorks() {
  return (
    <section id="how" style={{ ...container, padding: `${layout.sectionY} ${layout.padX}` }}>
      <div style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto' }}>
        <Eyebrow>사용법</Eyebrow>
        <h2 style={{...heading, color: "#000000"}}>30초면 충분합니다</h2>
      </div>
      <div style={{ marginTop: 'clamp(36px, 5vw, 56px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'clamp(20px, 3vw, 36px)' }}>
        {steps.map((s) => (
          <div key={s.n}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ width: 44, height: 44, borderRadius: r.md, background: c.ink, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>{s.n}</span>
              <div style={{ flex: 1, height: 1, background: c.border }} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.4px', margin: '20px 0 0' }}>{s.title}</h3>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: c.textSubtle, margin: '8px 0 0' }}>{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- CTA
function CTA({ onStart }) {
  return (
    <section id="cta" style={{ ...container, margin: `0 auto clamp(56px, 9vw, 100px)`, padding: `0 ${layout.padX}` }}>
      <div style={{ background: c.bgPanel, borderRadius: r['2xl'], padding: `clamp(40px, 6vw, 72px) clamp(24px, 4vw, 56px)`, textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 46px)', fontWeight: 700, letterSpacing: '-1.2px', lineHeight: 1.1, margin: 0 ,color: "#000000"}}>오늘부터 팀의 시간을<br />정리해 보세요</h2>
        <p style={{ fontSize: 'clamp(15px, 1.6vw, 18px)', color: c.textMuted, margin: '18px auto 0', maxWidth: 440, lineHeight: 1.6 }}>개인 사용은 언제나 무료. 팀 플랜도 14일 무료로 체험하세요.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 32 }}>
          <a href="#calendar" onClick={(e)=> {
            e.preventDefault(); 
            if (onStart) onStart();
          }} style={{ ...btnPrimary(52, 28, 15.5), boxShadow: shadow.cta }}>무료로 시작하기</a>
          <a href="#" style={btnOutline(52, 26, 15.5)}>영업팀 문의</a>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Footer
function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${c.borderSoft}` }}>
      <div style={{ ...container, padding: `clamp(40px, 5vw, 56px) ${layout.padX}`, display: 'flex', flexWrap: 'wrap', gap: 40, justifyContent: 'space-between' }}>
        <div style={{ maxWidth: 280 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <Logo size={30} />
            <span style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.4px' }}>Plantropic</span>
          </div>
          <p style={{ fontSize: 13.5, color: c.textFaint, lineHeight: 1.6, margin: '16px 0 0' }}>웹과 모바일에서 함께 쓰는 협업 캘린더.</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(40px, 6vw, 80px)' }}>
          {footerCols.map((col) => (
            <div key={col.title}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: c.inkSoft, marginBottom: 14 }}>{col.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {col.links.map((lnk) => (
                  <a key={lnk} href="#" className="pl-footer-link" style={{ fontSize: 13.5, color: c.textFaint, textDecoration: 'none' }}>{lnk}</a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${c.borderSoft}` }}>
        <div style={{ ...container, padding: `20px ${layout.padX}`, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', fontSize: 12.5, color: c.textGhost }}>
          <span>© 2026 Plantropic. All rights reserved.</span>
          <span>Made for teams that value their time.</span>
        </div>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------- shared bits
function Logo({ size = 32 }) {
  return (
    <span style={{ width: size, height: size, borderRadius: size * 0.28, background: c.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: size * 0.5 }}>P</span>
  );
}
function Avatar({ children, bg, fg, ml = 0, size = 12 }) {
  return (
    <span style={{ width: 30, height: 30, borderRadius: '50%', background: bg, color: fg, border: '2px solid #fff', marginLeft: ml, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size, fontWeight: 600 }}>{children}</span>
  );
}
function Eyebrow({ children }) {
  return <div style={{ fontSize: 13, fontWeight: 600, color: c.cat.work, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 14 }}>{children}</div>;
}
const heading = { fontSize: 'clamp(28px, 3.6vw, 44px)', fontWeight: 700, letterSpacing: '-1px', lineHeight: 1.15, margin: 0 };

function btnPrimary(h, px, fs) {
  return { height: h, padding: `0 ${px}px`, background: c.ink, color: '#fff', borderRadius: r.md, fontSize: fs, fontWeight: 600, display: 'flex', alignItems: 'center', textDecoration: 'none' };
}
function btnOutline(h, px, fs) {
  return { height: h, padding: `0 ${px}px`, background: c.bg, color: c.inkSoft, border: `1px solid ${c.borderStrong}`, borderRadius: r.md, fontSize: fs, fontWeight: 600, display: 'flex', alignItems: 'center', textDecoration: 'none' };
}

// ---------------------------------------------------------------- root
export default function PlanoraLanding({ desktopShot, mobileShot, onStart }) {
  return (
    <div style={{ width: '100%', overflowX: 'hidden', fontFamily: fonts.sans, color: c.text, background: c.bg, WebkitFontSmoothing: 'antialiased' }}>
      <Nav onStart={onStart}/>
      <Hero onStart={onStart}/>
      <TrustStrip />
      <Features />
      <CrossPlatform desktopShot={desktopShot} mobileShot={mobileShot} />
      <HowItWorks />
      <CTA onStart={onStart}/>
      <Footer />
    </div>
  );
}
