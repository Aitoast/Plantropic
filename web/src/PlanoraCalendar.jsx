import { createApi } from '@scheduler/core/api';
import { useEventStore } from '@scheduler/core/useEventStore';
import { toUiEvent, toServerPayload } from '@scheduler/core/eventAdapter';
import React, { useState, useMemo } from 'react';
import { colors as c, fonts, TIME_GRID } from './tokens-calendar';
import { CATS, WEEKDAYS, EVENTS, MONTH_NAMES, TODAY, fmtTime, fmtHour } from './calendarData';
import './planora-calendar.css';

const api = createApi(import.meta.env.VITE_API_URL ?? "/api",
                      () => localStorage.getItem("planora.token"));

const isTodayCell = (num, inMonth, y, m) =>
  inMonth && y === TODAY.y && m === TODAY.m && num === TODAY.d;

// ---- 시간 변환 헬퍼 함수 -----------------------------------------
const toDec = (s) => { const [h, m] = s.split(":").map(Number); return h + (m || 0) / 60; };
const toStr = (d) => {
  const h = Math.floor(d), m = Math.round((d - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

// ---- 파생 데이터 빌더 (순수 함수) --------------------------------
function buildMonthMatrix(y, m) {
  const startOffset = new Date(y, m, 1).getDay();
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(y, m, 1 - startOffset + i);
    cells.push({ date: d, num: d.getDate(), inMonth: d.getMonth() === m });
  }
  return cells;
}

function groupByDay(events, calOn) {
  const map = {};
  events.filter((e) => calOn[e.cal]).forEach((e) => {
    (map[e.day] = map[e.day] || []).push(e);
  });
  Object.values(map).forEach((arr) => arr.sort((a, b) => a.start - b.start));
  return map;
}

// ---- 이벤트 상태 관리 커스텀 훅 -----------------------------------
function useEvents(initial = []) {
  const [events, setEvents] = useState(initial);

  const addEvent = (form) => {
    let start = toDec(form.start);
    let end = toDec(form.end);
    if (end <= start) end = start + 0.5;
    const id = Math.max(0, ...events.map((e) => e.id)) + 1;
    setEvents((prev) => [
      ...prev,
      {
        id,
        cal: form.cal,
        title: form.title.trim(),
        day: Number(form.day),
        start,
        end,
        loc: form.loc || "장소 없음",
        desc: form.desc || "",
        reminder: "정각", 
        attendees: [],   
        comments: []     
      },
    ]);
    return id;
  };

  const updateEvent = (id, form) => {
    let start = toDec(form.start);
    let end = toDec(form.end);
    if (end <= start) end = start + 0.5;
    setEvents((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, title: form.title.trim(), cal: form.cal, day: Number(form.day), start, end, loc: form.loc, desc: form.desc }
          : e
      )
    );
  };

  const deleteEvent = (id) =>
    setEvents((prev) => prev.filter((e) => e.id !== id));

  return { events, addEvent, updateEvent, deleteEvent };
}

// ---- 루트 컴포넌트 ---------------------------------------------------------
export default function PlanoraCalendar() {
  const [view, setView] = useState('month');
  const [{ y, m }, setYM] = useState({ y: TODAY.y, m: TODAY.m });
  const [selDay, setSelDay] = useState(TODAY.d);
  const [selEventId, setSelEventId] = useState(1);
  const [calOn, setCalOn] = useState({
    personal: true, work: true, meeting: true, deadline: true, team: true, family: true,
  });

  // 추가된 입력 모달 상태
  const [modal, setModal] = useState(null); 

  // 커스텀 훅 연결 (초기 데이터는 calendarData의 EVENTS 사용)
  const store = useEventStore(api);
  const events = useMemo(
    () => store.events.map(toUiEvent).filter((e) => e.year === y && e.month === m),
    [store.events, y, m]
  );

  const isMonthly = view === 'month' || view === 'agenda';
  const periodLabel = `${y}년 ${MONTH_NAMES[m]}`;

  const goToday = () => { setYM({ y: TODAY.y, m: TODAY.m }); setSelDay(TODAY.d); };
  const stepMonth = (dir) => setYM(({ y, m }) => {
    let nm = m + dir, ny = y;
    if (nm < 0) { nm = 11; ny--; } else if (nm > 11) { nm = 0; ny++; }
    return { y: ny, m: nm };
  });
  const prevPeriod = () => isMonthly ? stepMonth(-1) : setSelDay((d) => d - (view === 'week' ? 7 : 1));
  const nextPeriod = () => isMonthly ? stepMonth(1) : setSelDay((d) => d + (view === 'week' ? 7 : 1));
  const toggleCal = (k) => setCalOn((s) => ({ ...s, [k]: !s[k] }));
  const openEvent = (id) => setSelEventId(id);

  // 모달 열기 핸들러
  const openCreate = () =>
    setModal({ title: "", cal: "personal", day: selDay, start: "09:00", end: "10:00", loc: "", desc: "" });

  const openEdit = (ev) =>
    setModal({ ...ev, start: toStr(ev.start), end: toStr(ev.end) });

  const handleSave = async (form) => {
    if (form.id != null) await store.update(form.id, toServerPayload(form, y, m));
    else                 await store.add(toServerPayload(form, y, m));
    setModal(null);
  };

  // 고정된 EVENTS 대신 상탯값인 events를 바라보도록 수정
  const evByDay = useMemo(() => groupByDay(events, calOn), [events, calOn]);
  const selected = events.find((e) => e.id === selEventId) || null;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: c.appBg, overflow: 'hidden', fontFamily: fonts.sans, color: c.text, WebkitFontSmoothing: 'antialiased' }}>
      <Header {...{ view, setView, periodLabel, goToday, prevPeriod, nextPeriod }} />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Sidebar {...{ y, m, selDay, setSelDay, calOn, toggleCal, periodLabel, prevPeriod, nextPeriod, openCreate }} />
        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: c.surface }}>
          {view === 'month' && <MonthView {...{ y, m, selDay, setSelDay, evByDay, openEvent }} />}
          {(view === 'week' || view === 'day') && <TimeGridView {...{ y, m, selDay, view, evByDay, openEvent }} />}
          {view === 'agenda' && <AgendaView {...{ evByDay, openEvent }} />}
        </main>
        {selected && (
          <DetailPanel 
            event={selected} 
            onClose={() => setSelEventId(null)} 
            onEdit={() => openEdit(selected)}
            onDelete={() => { store.remove(selected.id); setSelEventId(null); }}
          />
        )}
      </div>

      {/* 모달 렌더링 영역 */}
      {modal && (
        <EventModal initial={modal} onSave={handleSave} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

// ---- Header -------------------------------------------------------
function Header({ view, setView, periodLabel, goToday, prevPeriod, nextPeriod }) {
  const tabs = [['month', '월'], ['week', '주'], ['day', '일'], ['agenda', '아젠다']];
  return (
    <header style={{ height: 60, flexShrink: 0, background: c.surface, borderBottom: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 20, zIndex: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: 232, flexShrink: 0 }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: c.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 15, letterSpacing: '-0.5px' }}>P</span>
        <span style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.4px' }}>Plantropic</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={goToday} style={{ height: 36, padding: '0 16px', border: `1px solid ${c.borderStrong}`, background: '#fff', borderRadius: 8, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 500, color: c.textInk, cursor: 'pointer', whiteSpace: 'nowrap' }}>오늘</button>
        <div style={{ display: 'flex', gap: 2 }}>
          <IconBtn onClick={prevPeriod}>‹</IconBtn>
          <IconBtn onClick={nextPeriod}>›</IconBtn>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.5px', margin: '0 0 0 8px', minWidth: 150 , color: "#000000"}}>{periodLabel}</h1>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', height: 36, background: c.panel, borderRadius: 9, padding: 3, flexShrink: 0 }}>
        {tabs.map(([v, label]) => {
          const active = view === v;
          return (
            <button key={v} onClick={() => setView(v)} style={{ height: 30, padding: '0 16px', border: 'none', borderRadius: 7, whiteSpace: 'nowrap', fontFamily: 'inherit', fontSize: 13, fontWeight: active ? 600 : 500, cursor: 'pointer', background: active ? '#fff' : 'transparent', color: active ? c.ink : c.textSubtle, boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none' }}>{label}</button>
          );
        })}
      </div>
      <div style={{ width: 200, minWidth: 120, height: 36, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', background: c.panel, borderRadius: 9, color: c.textDim, flexShrink: 1, overflow: 'hidden' }}>
        <span style={{ fontSize: 15 }}>⌕</span><span style={{ fontSize: 13.5 }}>일정 검색</span>
      </div>
      <div style={{ width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.textSubtle, cursor: 'pointer', position: 'relative' }}>
        <span style={{ fontSize: 17 }}>◔</span>
        <span style={{ position: 'absolute', top: 5, right: 6, width: 7, height: 7, borderRadius: '50%', background: '#d97757', border: '1.5px solid #fff' }} />
      </div>
      <div style={{ width: 34, height: 34, borderRadius: '50%', background: c.ink, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600 }}>유</div>
    </header>
  );
}
const IconBtn = ({ children, onClick }) => (
  <button onClick={onClick} className="pl-iconbtn" style={{ width: 34, height: 34, border: 'none', background: 'transparent', borderRadius: 8, cursor: 'pointer', color: c.textSubtle, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</button>
);

// ---- Sidebar ------------------------------------------------------
function Sidebar({ y, m, selDay, setSelDay, calOn, toggleCal, periodLabel, prevPeriod, nextPeriod, openCreate }) {
  const mini = useMemo(() => buildMonthMatrix(y, m), [y, m]);
  const CalRow = (key) => {
    const cat = CATS[key]; const on = calOn[key];
    return (
      <button key={key} onClick={() => toggleCal(key)} className="pl-calrow" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 10px', border: 'none', background: 'transparent', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%' }}>
        <span style={{ width: 18, height: 18, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0, color: '#fff', border: on ? 'none' : '1.5px solid #cfd4dd', background: on ? cat.dot : 'transparent' }}>{on ? '✓' : ''}</span>
        <span style={{ fontSize: 13.5, fontWeight: 500, color: on ? c.textInk : c.textDim }}>{cat.label}</span>
      </button>
    );
  };
  return (
    <aside style={{ width: 252, flexShrink: 0, background: c.surface, borderRight: `1px solid ${c.border}`, padding: '18px 16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* openCreate 함수 연결 */}
      <button onClick={openCreate} className="pl-create" style={{ height: 46, border: 'none', background: c.ink, color: '#fff', borderRadius: 11, fontFamily: 'inherit', fontSize: 14.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.15)' }}>
        <span style={{ fontSize: 18, fontWeight: 400, lineHeight: 1 }}>＋</span> 일정 만들기
      </button>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 10px' }}>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{periodLabel}</span>
          <div style={{ display: 'flex', gap: 2 }}>
            <button onClick={prevPeriod} style={miniNav}>‹</button>
            <button onClick={nextPeriod} style={miniNav}>›</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
          {WEEKDAYS.map((h) => <div key={h} style={{ textAlign: 'center', fontSize: 10.5, color: c.textGhost, fontWeight: 500, paddingBottom: 4 }}>{h}</div>)}
          {mini.map((d, i) => {
            const isToday = isTodayCell(d.num, d.inMonth, y, m);
            const isSel = d.inMonth && d.num === selDay;
            return (
              <button key={i} onClick={() => d.inMonth && setSelDay(d.num)} style={{ width: 28, height: 28, border: 'none', borderRadius: '50%', fontFamily: 'inherit', fontSize: 11.5, fontVariantNumeric: 'tabular-nums', cursor: 'pointer', fontWeight: (isToday || isSel) ? 600 : 400, background: isToday ? c.ink : (isSel ? c.border : 'transparent'), color: isToday ? '#fff' : (d.inMonth ? c.textInk : '#c8ccd4') }}>{d.num}</button>
            );
          })}
        </div>
      </div>

      <div>
        <div style={sideLabel}>내 캘린더</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{['personal', 'work', 'meeting', 'deadline'].map(CalRow)}</div>
      </div>
      <div>
        <div style={sideLabel}>공유 캘린더</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{['team', 'family'].map(CalRow)}</div>
      </div>
    </aside>
  );
}
const miniNav = { width: 24, height: 24, border: 'none', background: 'transparent', cursor: 'pointer', color: c.textDim, fontSize: 14 };
const sideLabel = { fontSize: 11.5, fontWeight: 600, color: c.textFaint, letterSpacing: '0.4px', textTransform: 'uppercase', padding: '0 4px 10px' };

// ---- Month view ---------------------------------------------------
function MonthView({ y, m, selDay, setSelDay, evByDay, openEvent }) {
  const matrix = useMemo(() => buildMonthMatrix(y, m), [y, m]);
  const weeks = [0, 1, 2, 3, 4, 5].map((w) => matrix.slice(w * 7, w * 7 + 7));
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${c.border}` }}>
        {WEEKDAYS.map((w, i) => (
          <div key={w} style={{ textAlign: 'center', padding: '10px 0', fontSize: 12, fontWeight: 600, color: i === 0 ? c.sun : (i === 6 ? c.sat : c.textFaint), borderRight: `1px solid ${c.gridLine}` }}>{w}</div>
        ))}
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateRows: 'repeat(6, 1fr)', minHeight: 0 }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {week.map((day, di) => {
              const isToday = isTodayCell(day.num, day.inMonth, y, m);
              const isSel = day.inMonth && day.num === selDay;
              const dayEvents = day.inMonth ? (evByDay[day.num] || []) : [];
              const shown = dayEvents.slice(0, 3);
              const more = dayEvents.length - shown.length;
              return (
                <div key={di} onClick={() => day.inMonth && setSelDay(day.num)} style={{ borderRight: `1px solid ${c.gridLine}`, borderBottom: `1px solid ${c.gridLine}`, paddingBottom: 4, overflow: 'hidden', cursor: 'pointer', background: isSel ? '#f7f8fb' : (day.inMonth ? '#fff' : c.soft) }}>
                  <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 5 }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 24, height: 24, borderRadius: '50%', fontSize: 12.5, fontWeight: isToday ? 700 : 500, fontVariantNumeric: 'tabular-nums', background: isToday ? c.ink : 'transparent', color: isToday ? '#fff' : (day.inMonth ? c.textInk : '#c2c7d0') }}>{day.num}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '3px 5px 0' }}>
                    {shown.map((ev) => {
                      const cat = CATS[ev.cal];
                      const allDay = ev.end - ev.start >= 3;
                      return (
                        <div key={ev.id} onClick={(e) => { e.stopPropagation(); openEvent(ev.id); }} style={allDay
                          ? { display: 'flex', alignItems: 'center', fontSize: 11.5, fontWeight: 500, padding: '2px 7px', borderRadius: 5, cursor: 'pointer', background: cat.dot, color: '#fff', overflow: 'hidden' }
                          : { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 500, padding: '2px 6px', borderRadius: 5, cursor: 'pointer', color: c.textInk, overflow: 'hidden' }}>
                          {!allDay && <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: cat.dot }} />}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</span>
                        </div>
                      );
                    })}
                    {more > 0 && <div style={{ fontSize: 11, color: c.textFaint, fontWeight: 500, padding: '1px 6px', cursor: 'pointer' }}>+{more} 더보기</div>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}

// ---- Week / Day view (시간축) ------------------------------------
function TimeGridView({ y, m, selDay, view, evByDay, openEvent }) {
  const { startHour, endHour, hourPx } = TIME_GRID;
  const hours = []; for (let h = startHour; h < endHour; h++) hours.push(h);

  const dayDates = useMemo(() => {
    if (view === 'week') {
      const base = new Date(y, m, selDay); const dow = base.getDay();
      return Array.from({ length: 7 }, (_, i) => new Date(y, m, selDay - dow + i));
    }
    return [new Date(y, m, selDay)];
  }, [y, m, selDay, view]);

  const cols = `repeat(${dayDates.length}, 1fr)`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr', borderBottom: `1px solid ${c.border}` }}>
        <div />
        <div style={{ display: 'grid', gridTemplateColumns: cols }}>
          {dayDates.map((d, i) => {
            const inMonth = d.getMonth() === m;
            const isToday = isTodayCell(d.getDate(), inMonth, y, m);
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '10px 0', borderRight: `1px solid ${c.gridLine}` }}>
                <span style={{ fontSize: 11, color: c.textFaint, fontWeight: 500 }}>{WEEKDAYS[d.getDay()]}</span>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 30, height: 30, borderRadius: '50%', fontSize: 16, fontWeight: isToday ? 700 : 600, background: isToday ? c.ink : 'transparent', color: isToday ? '#fff' : c.textInk, fontVariantNumeric: 'tabular-nums' }}>{d.getDate()}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr' }}>
          <div>
            {hours.map((h) => (
              <div key={h} style={{ height: hourPx, position: 'relative' }}>
                <span style={{ position: 'absolute', top: -8, right: 10, fontSize: 11, color: c.textGhost, fontFamily: fonts.mono }}>{fmtHour(h)}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: cols }}>
            {dayDates.map((d, i) => {
              const inMonth = d.getMonth() === m;
              const dayEvents = inMonth ? (evByDay[d.getDate()] || []) : [];
              return (
                <div key={i} style={{ position: 'relative', borderRight: `1px solid ${c.gridLine}` }}>
                  {hours.map((h) => <div key={h} style={{ height: hourPx, borderBottom: '1px solid #eef0f4' }} />)}
                  {dayEvents.map((ev) => {
                    const cat = CATS[ev.cal];
                    const top = (ev.start - startHour) * hourPx;
                    const height = Math.max((ev.end - ev.start) * hourPx - 3, 22);
                    return (
                      <div key={ev.id} onClick={() => openEvent(ev.id)} style={{ position: 'absolute', left: 4, right: 4, top, height, background: cat.bg, color: cat.fg, borderLeft: `3px solid ${cat.dot}`, borderRadius: 6, padding: '5px 8px', cursor: 'pointer', overflow: 'hidden' }}>
                        <div style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                        <div style={{ fontSize: 11, opacity: 0.8 }}>{`${fmtTime(ev.start)} – ${fmtTime(ev.end)}`}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Agenda view --------------------------------------------------
function AgendaView({ evByDay, openEvent }) {
  const days = Object.keys(evByDay).map(Number).sort((a, b) => a - b);
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
      {days.map((dnum) => {
        const cd = new Date(TODAY.y, TODAY.m, dnum);
        const isToday = dnum === TODAY.d;
        return (
          <div key={dnum} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', padding: '14px 32px', borderBottom: `1px solid ${c.gridLine}` }}>
            <div style={{ paddingTop: 4 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 36, height: 36, borderRadius: 10, fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', background: isToday ? c.ink : c.panel, color: isToday ? '#fff' : c.textInk }}>{dnum}</div>
              <div style={{ fontSize: 12, color: c.textFaint, marginTop: 2 }}>{WEEKDAYS[cd.getDay()]}요일</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {evByDay[dnum].map((ev) => {
                const cat = CATS[ev.cal];
                return (
                  <div key={ev.id} onClick={() => openEvent(ev.id)} className="pl-agenda-row" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', borderRadius: 10, cursor: 'pointer', border: '1px solid #eceef3' }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, background: cat.dot }} />
                    <span style={{ fontFamily: fonts.mono, fontSize: 12.5, color: c.textSubtle, width: 96, flexShrink: 0 }}>{fmtTime(ev.start)}</span>
                    <span style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>{ev.title}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: cat.bg, color: cat.fg }}>{cat.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- 입력/수정 모달 컴포넌트 ----------------------------------------
function EventModal({ initial, onSave, onClose }) {
  const isEdit = initial?.id != null;
  const [form, setForm] = useState(
    initial ?? { title: "", cal: "personal", day: 7, start: "09:00", end: "10:00", loc: "", desc: "" }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    if (!form.title.trim()) return;   
    onSave(form);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="card" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2 style={{ color: '#000000' }}>{isEdit ? "일정 편집" : "새 일정"}</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 16, cursor: 'pointer' }}>✕</button>
        </header>

        <div className="body">
          <label>제목</label>
          <input placeholder="일정 이름" value={form.title} onChange={(e) => set("title", e.target.value)} autoFocus />

          <label>캘린더</label>
          <div className="cats">
            {Object.entries(CATS).map(([key, c]) => (
              <button
                key={key}
                type="button"
                onClick={() => set("cal", key)}
                style={{
                  borderColor: form.cal === key ? c.dot : "#e6e9ef",
                  background: form.cal === key ? c.bg : "#fff",
                  color: form.cal === key ? c.fg : "#6b7280",
                }}
              >
                <span className="dot" style={{ background: c.dot }} />
                {c.label}
              </button>
            ))}
          </div>

          <label>날짜</label>
          <input
            type="date"
            value={`2026-07-${String(form.day).padStart(2, "0")}`}
            onChange={(e) => {
              const d = Number(e.target.value.split("-")[2]);
              if (d) set("day", d);
            }}
          />

          <div className="times">
            <div>
              <label>시작</label>
              <input type="time" value={form.start} onChange={(e) => set("start", e.target.value)} />
            </div>
            <div>
              <label>종료</label>
              <input type="time" value={form.end} onChange={(e) => set("end", e.target.value)} />
            </div>
          </div>

          <label>장소</label>
          <input placeholder="장소" value={form.loc} onChange={(e) => set("loc", e.target.value)} />

          <label>메모</label>
          <textarea placeholder="메모" rows={3} value={form.desc} onChange={(e) => set("desc", e.target.value)} />
        </div>

        <footer>
          <button onClick={onClose}>취소</button>
          <button className="primary" onClick={save}>{isEdit ? "변경 저장" : "일정 추가"}</button>
        </footer>
      </div>
    </div>
  );
}

// ---- Detail panel -------------------------------------------------
function DetailPanel({ event, onClose, onEdit, onDelete }) {
  const cat = CATS[event.cal];
  const cd = new Date(TODAY.y, 6, event.day);
  const dateLabel = `7월 ${event.day}일 (${WEEKDAYS[cd.getDay()]})`;
  
  // 데이터 누락 방지 안정장치
  const attendees = event.attendees || [];
  const comments = event.comments || [];

  return (
    <aside className="pl-panel" style={{ width: 352, flexShrink: 0, background: c.surface, borderLeft: `1px solid ${c.border}`, display: 'flex', flexDirection: 'column', zIndex: 10 }}>
      <div style={{ padding: '22px 24px 20px', background: cat.bg }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ display: 'inline-flex', fontSize: 11.5, fontWeight: 600, padding: '4px 11px', borderRadius: 20, background: 'rgba(255,255,255,0.6)', color: cat.fg }}>{cat.label}</span>
          
          {/* 액션 버튼 추가: 수정(✎), 삭제(🗑), 닫기(✕) */}
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={onEdit} title="수정" style={panelActionBtn}>✎</button>
            <button onClick={onDelete} title="삭제" style={panelActionBtn}>🗑</button>
            <button onClick={onClose} title="닫기" style={panelActionBtn}>✕</button>
          </div>
        </div>
        <h2 style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.5px', margin: '14px 0 0', lineHeight: 1.25 , color: "#000000"}}>{event.title}</h2>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <MetaRow icon="◷"><div><div style={{ fontSize: 14, fontWeight: 500 }}>{dateLabel}</div><div style={{ fontSize: 13, color: c.textSubtle, marginTop: 1 }}>{`${fmtTime(event.start)} – ${fmtTime(event.end)}`}</div></div></MetaRow>
          <MetaRow icon="⚑"><div style={{ fontSize: 14 }}>{event.loc}</div></MetaRow>
          <MetaRow icon="◔"><div style={{ fontSize: 14, color: c.textInk }}>{event.reminder || "없음"}</div></MetaRow>
        </div>

        <Divider />

        <div>
          <SectionLabel>{`참석자 · ${attendees.length}`}</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {attendees.map(([name, status], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={avatarSm}>{name[0]}</span>
                <div style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{name}</div>
                <span style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: status === '수락' ? '#e7f4ee' : c.panel, color: status === '수락' ? '#0f6e45' : c.textFaint }}>{status}</span>
              </div>
            ))}
          </div>
          <button style={{ marginTop: 14, width: '100%', height: 38, border: '1px dashed #d6dae2', background: c.soft, borderRadius: 9, fontFamily: 'inherit', fontSize: 13, fontWeight: 500, color: c.textSubtle, cursor: 'pointer' }}>＋ 사람 초대</button>
        </div>

        <Divider />
        <div><SectionLabel>메모</SectionLabel><p style={{ fontSize: 13.5, lineHeight: 1.6, color: c.textMuted, margin: 0 }}>{event.desc || "메모가 없습니다."}</p></div>
        <Divider />

        <div>
          <SectionLabel>{`댓글 · ${comments.length}`}</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {comments.map(([who, time, text], i) => (
              <div key={i} style={{ display: 'flex', gap: 11 }}>
                <span style={avatarSm}>{who[0]}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{who}</span>
                    <span style={{ fontSize: 11.5, color: c.textGhost }}>{time}</span>
                  </div>
                  <div style={{ fontSize: 13.5, color: c.textInk, lineHeight: 1.5, marginTop: 3 }}>{text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 20px', borderTop: `1px solid #eceef3`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 30, height: 30, borderRadius: '50%', background: c.ink, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>유</span>
        <div style={{ flex: 1, height: 38, display: 'flex', alignItems: 'center', padding: '0 14px', background: '#f4f5f7', borderRadius: 19, fontSize: 13, color: c.textDim }}>댓글 추가…</div>
      </div>
    </aside>
  );
}

const MetaRow = ({ icon, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
    <span style={{ fontSize: 15, color: c.textDim, width: 18, textAlign: 'center' }}>{icon}</span>{children}
  </div>
);
const Divider = () => <div style={{ height: 1, background: '#eceef3' }} />;
const SectionLabel = ({ children }) => <div style={{ fontSize: 12, fontWeight: 600, color: c.textFaint, letterSpacing: '0.3px', textTransform: 'uppercase', marginBottom: 12 }}>{children}</div>;
const avatarSm = { width: 30, height: 30, borderRadius: '50%', background: '#eceef3', color: c.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 };
const panelActionBtn = { width: 30, height: 30, border: 'none', background: 'rgba(255,255,255,0.55)', borderRadius: 8, cursor: 'pointer', color: c.textMuted, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' };