import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './planora-landing.css';
import './planora-calendar.css';
import './App.css'
import './pages/LoginPage.css';

import PlanoraLanding from './PlanoraLanding';
import PlanoraCalendar from './PlanoraCalendar';
import LoginPage from './pages/LoginPage';
import MeetingJoin from './MeetingJoin';
import { auth } from './auth/authClient';
import { tokenFromPath } from './api/meetings';


function App() {
  const [view, setView] = useState('landing');
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [joinToken, setJoinToken] = useState(tokenFromPath()); // 초대 링크로 접속했으면 토큰 보관

  useEffect(() => {
    auth.consumeOAuthRedirect();
    const pendingJoin = tokenFromPath();  // /join/<token> 로 들어왔는지
    auth.me()
      .then((user) => {
        if (user) {
          setAuthed(true);
          setView(pendingJoin ? 'join' : 'calendar');   // 로그인돼 있으면 바로 참여 화면
        } else if (pendingJoin) {
          setView('login');                              // 미로그인 → 로그인 후 참여
        }
      })
      .finally(() => setChecking(false));
  }, []);

  // 참여 화면을 벗어날 때 URL 을 홈으로 정리
  const leaveJoin = () => { history.replaceState(null, '', '/'); setJoinToken(null); setView('calendar'); };

  if (checking) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a919c' }}>불러오는 중…</div>;
  }

  return (
    <div>
      {view === 'join' && authed && joinToken ? (
        <MeetingJoin token={joinToken} onDone={leaveJoin} />
      ) : view === 'landing' ? (
        <PlanoraLanding onStart={() => setView(authed ? 'calendar' : 'login')} />
      ) : view === 'login' ? (
        <LoginPage onAuthed={() => { setAuthed(true); setView(joinToken ? 'join' : 'calendar'); }} />
      ) : (
        <PlanoraCalendar
          onHome={() => setView('landing')}                               /* 로고: 랜딩으로(로그아웃 X) */
          onLogout={() => { auth.logout(); setAuthed(false); setView('landing'); }}
        />
      )}
    </div>
  );
}

// function App() {
//   return (
//     <div className="App">
//       {/* 2. 기존 내용을 다 지우고, 보여주고 싶은 페이지를 여기에 넣습니다. */}
//       <PlanoraLanding/>
//     </div>
//   );
// }

export default App;

