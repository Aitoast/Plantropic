import { useState } from 'react'
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


function App() {
  // 'landing' 또는 'calendar' 상태를 가집니다.
  const [view, setView] = useState('landing');

  return (
    <div>
      {view === 'landing' ? (
        // 랜딩페이지 컴포넌트에 화면을 바꾸는 함수(setView)를 프롭스로 전달합니다.
        <PlanoraLanding onStart={() => setView('login')} />
      ) : 
      
      /* 로그인 페이지*/
      view === 'login' ? (
        <LoginPage
        onLoginSuccess={() => setView('calendar')} // 로그인 성공시 달력화면
        onBackToLanding = {() => setView('landing')}
        />
      ) :
      (
        <PlanoraCalendar onLogout={() => setView('landing')} />
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

