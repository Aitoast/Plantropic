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
import { auth } from './auth/authClient';


function App() {
  const [view, setView] = useState('landing');
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    auth.consumeOAuthRedirect();
    auth.me()
      .then((user) => { if (user) { setAuthed(true); setView('calendar'); } })
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a919c' }}>불러오는 중…</div>;
  }

  return (
    <div>
      {view === 'landing' ? (
        <PlanoraLanding onStart={() => setView(authed ? 'calendar' : 'login')} />
      ) : view === 'login' ? (
        <LoginPage onAuthed={(user) => { setAuthed(true); setView('calendar'); }} />
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

