import { useState, type FormEvent } from "react";
import { auth, type AuthUser } from "../auth/authClient";
import "./LoginPage.css";

type Mode = "login" | "signup";

const MOCK_ROWS = [
  { time: "09:00", title: "주간 팀 스탠드업", color: "#7c5cdb" },
  { time: "12:30", title: "점심 - 지수", color: "#1f8a5b" },
  { time: "17:00", title: "분기 보고서 제출", color: "#d97757" },
];

export default function LoginPage({ onAuthed }: { onAuthed: (u: AuthUser) => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [remember, setRemember] = useState(true);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isLogin = mode === "login";
  const checked = isLogin ? remember : agree;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !pw) return setError("이메일과 비밀번호를 입력해주세요.");
    if (!isLogin) {
      if (!name.trim()) return setError("이름을 입력해주세요.");
      if (pw.length < 8) return setError("비밀번호는 8자 이상이어야 해요.");
      if (pw !== pw2) return setError("비밀번호가 일치하지 않아요.");
      if (!agree) return setError("약관에 동의해주세요.");
    }
    setBusy(true);
    try {
      const user = isLogin
        ? await auth.login(email.trim(), pw)
        : await auth.signup(name.trim(), email.trim(), pw);
      onAuthed(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "문제가 발생했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pl-page">
      {/* LEFT BRAND PANEL */}
      <aside className="pl-brand">
        <div className="pl-brand-glow" />
        <a href="/" className="pl-logo">
          <span className="pl-logo-mark">P</span>
          <span className="pl-logo-word">Planora</span>
        </a>

        <div className="pl-brand-body">
          <span className="pl-badge">
            <span className="pl-badge-dot" /> 웹 · 모바일 실시간 동기화
          </span>
          <h2 className="pl-brand-title">
            팀의 모든 일정을,<br />한 곳에서 관리하세요.
          </h2>
          <p className="pl-brand-sub">
            로그인하면 웹과 모바일 어디서든 같은 일정이 실시간으로 동기화됩니다.
          </p>

          <div className="pl-mock">
            <div className="pl-mock-head">
              <span className="pl-mock-date">7월 7일 화요일</span>
              <span className="pl-mock-count">3 EVENTS</span>
            </div>
            {MOCK_ROWS.map((r) => (
              <div className="pl-mock-row" key={r.title}>
                <span className="pl-mock-time">{r.time}</span>
                <span className="pl-mock-bar" style={{ background: r.color }} />
                <span className="pl-mock-title">{r.title}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pl-brand-foot">© 2026 Planora · 웹과 모바일에서 함께 쓰는 협업 캘린더</div>
      </aside>

      {/* RIGHT FORM PANEL */}
      <main className="pl-form-panel">
        <div className="pl-form-wrap">
          <div className="pl-tabs" role="tablist">
            <button className={`pl-tab ${isLogin ? "on" : ""}`} onClick={() => setMode("login")}>로그인</button>
            <button className={`pl-tab ${!isLogin ? "on" : ""}`} onClick={() => setMode("signup")}>회원가입</button>
          </div>

          <h1 className="pl-heading">{isLogin ? "다시 오신 걸 환영해요" : "계정을 만들어 시작하세요"}</h1>
          <p className="pl-subheading">
            {isLogin ? "계정에 로그인하고 일정을 이어서 관리하세요." : "30초면 충분해요. 신용카드는 필요 없습니다."}
          </p>

          <div className="pl-social">
            <button type="button" className="pl-social-btn" onClick={() => auth.oauth("google")}>
              <GoogleIcon /> Google로 계속하기
            </button>
            <button type="button" className="pl-social-btn pl-kakao" onClick={() => auth.oauth("kakao")}>
              <KakaoIcon /> 카카오로 계속하기
            </button>
          </div>

          <div className="pl-divider"><span>또는 이메일로</span></div>

          <form className="pl-fields" onSubmit={handleSubmit}>
            {!isLogin && (
              <Field label="이름">
                <input className="pl-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" />
              </Field>
            )}

            <Field label="이메일">
              <input className="pl-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </Field>

            <Field label="비밀번호" aside={isLogin ? <a href="/reset" className="pl-link">비밀번호를 잊으셨나요?</a> : null}>
              <input className="pl-input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={isLogin ? "비밀번호 입력" : "8자 이상 입력"} />
            </Field>

            {!isLogin && (
              <Field label="비밀번호 확인">
                <input className="pl-input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="비밀번호를 한 번 더 입력" />
              </Field>
            )}

            <label className="pl-check-row">
              <button
                type="button"
                className={`pl-check ${checked ? "on" : ""}`}
                onClick={() => (isLogin ? setRemember((v) => !v) : setAgree((v) => !v))}
              >
                {checked ? "✓" : ""}
              </button>
              <span>{isLogin ? "로그인 상태 유지" : "이용약관 및 개인정보 처리방침에 동의합니다"}</span>
            </label>

            {error && <div className="pl-error">{error}</div>}

            <button type="submit" className="pl-cta" disabled={busy}>
              {busy ? "처리 중…" : isLogin ? "로그인" : "가입하고 시작하기"}
            </button>
          </form>

          <p className="pl-switch">
            {isLogin ? "아직 계정이 없으신가요?" : "이미 계정이 있으신가요?"}{" "}
            <a href="#" className="pl-link" onClick={(e) => { e.preventDefault(); setMode(isLogin ? "signup" : "login"); }}>
              {isLogin ? "회원가입" : "로그인"}
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}

function Field({ label, aside, children }: { label: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="pl-field">
      <div className="pl-field-head">
        <label className="pl-label">{label}</label>
        {aside}
      </div>
      {children}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.7 1.22 9.2 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
function KakaoIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden>
      <path fill="#191600" d="M12 3C6.48 3 2 6.58 2 10.99c0 2.87 1.9 5.38 4.75 6.79-.21.77-.76 2.79-.87 3.22-.14.53.19.52.4.38.17-.11 2.66-1.81 3.74-2.55.64.09 1.3.14 1.98.14 5.52 0 10-3.58 10-7.98C22 6.58 17.52 3 12 3z" />
    </svg>
  );
}
