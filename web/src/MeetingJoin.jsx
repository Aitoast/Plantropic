// web/src/MeetingJoin.jsx — 초대 링크(/join/:token)로 열리는 팀 조율 참여 화면
//   로그인된 상태에서 마운트되며: 자동 참여 → 멤버·공통 빈 시간 표시 → 주최자 확정/삭제
import { useState, useEffect, useCallback } from "react";
import { meetings } from "./api/meetings";

const DARK = "#16181d";
const WD = ["일", "월", "화", "수", "목", "금", "토"];
const hhmm = (iso) => new Date(iso).toISOString().slice(11, 16);
const fmtDay = (iso) => { const d = new Date(iso); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})`; };

export default function MeetingJoin({ token, onDone }) {
  const [state, setState] = useState({ loading: true });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const detail = await meetings.get(token);
    let slots = [];
    try { slots = (await meetings.slots(token)).slots ?? []; } catch { /* 미참여 */ }
    setState({ detail, slots });
  }, [token]);

  useEffect(() => {
    (async () => {
      try { await meetings.join(token); await refresh(); }
      catch (e) { setState({ error: e.message }); }
    })();
  }, [token, refresh]);

  const pick = async (startsAt) => {
    if (!window.confirm(`${fmtDay(startsAt)} ${hhmm(startsAt)} 로 확정할까요?`)) return;
    setBusy(true);
    try { const r = await meetings.pick(token, startsAt); alert(`참여자 ${r.created}명 캘린더에 등록했어요.`); await refresh(); }
    catch (e) { alert(e.message); } finally { setBusy(false); }
  };
  const del = async () => {
    if (!window.confirm("이 조율을 삭제할까요? (이미 확정한 일정은 유지)")) return;
    setBusy(true);
    try { await meetings.remove(token); onDone?.(); }
    catch (e) { alert(e.message); } finally { setBusy(false); }
  };
  const leave = async () => {
    setBusy(true);
    try { await meetings.leave(token); onDone?.(); }
    catch (e) { alert(e.message); } finally { setBusy(false); }
  };

  const wrap = { maxWidth: 560, margin: "0 auto", padding: "40px 20px", fontFamily: "system-ui, sans-serif", color: "#1a1d21" };
  if (state.loading) return <div style={{ ...wrap, color: "#8a919c" }}>불러오는 중…</div>;
  if (state.error) return (
    <div style={wrap}>
      <p style={{ color: "#d95a5a" }}>초대를 여는 데 문제가 있어요: {state.error}</p>
      <button onClick={onDone} style={btn(false)}>달력으로</button>
    </div>
  );

  const m = state.detail;
  return (
    <div style={wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{m.title}</h1>
        <button onClick={onDone} style={{ ...btn(false), padding: "6px 12px" }}>달력으로</button>
      </div>
      <p style={{ color: "#8a919c", fontSize: 14 }}>
        {m.date_from} ~ {m.date_to} · {m.earliest_hour}–{m.latest_hour}시 · {m.duration_min}분
      </p>

      <h3 style={h3}>참여자 {m.members?.length ?? 0}명</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {m.members?.map((mm) => (
          <span key={mm.userId} style={chip}>{mm.name}</span>
        ))}
      </div>

      <h3 style={h3}>공통 빈 시간</h3>
      {m.members?.length < 2 && (
        <p style={{ color: "#9aa1ac", fontSize: 13 }}>혼자면 본인 일정 기준이에요. 팀원이 이 링크로 참여하면 모두가 비는 시간을 찾아줍니다.</p>
      )}
      {state.slots?.length ? state.slots.map((sl) => (
        <div key={sl.startsAt} style={slotRow}>
          <div>
            <div style={{ fontSize: 13, color: "#8a919c" }}>{fmtDay(sl.startsAt)}</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{hhmm(sl.startsAt)} – {hhmm(sl.endsAt)}</div>
          </div>
          {m.isOwner && <button disabled={busy} onClick={() => pick(sl.startsAt)} style={btn(true)}>확정</button>}
        </div>
      )) : <p style={{ color: "#9aa1ac", fontSize: 13.5 }}>가능한 공통 시간이 없어요. 주최자에게 기간·시간대를 넓혀달라고 해보세요.</p>}

      <div style={{ marginTop: 28, display: "flex", gap: 8 }}>
        {m.isOwner
          ? <button disabled={busy} onClick={del} style={danger}>조율 삭제</button>
          : <button disabled={busy} onClick={leave} style={danger}>나가기</button>}
      </div>
    </div>
  );
}

const h3 = { fontSize: 15, fontWeight: 700, marginTop: 26, marginBottom: 10 };
const chip = { padding: "7px 12px", background: "#eef0f4", borderRadius: 18, fontSize: 13, fontWeight: 500, color: "#33383f" };
const slotRow = { display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: 14, marginTop: 10, background: "#fff", border: "1px solid #eceef3", borderRadius: 13 };
const btn = (dark) => ({ padding: "9px 16px", borderRadius: 10, border: dark ? "none" : "1px solid #d7dae1",
  background: dark ? DARK : "#fff", color: dark ? "#fff" : "#33383f", fontWeight: 600, fontSize: 14, cursor: "pointer" });
const danger = { padding: "10px 18px", borderRadius: 10, border: "1px solid #f0d3d3",
  background: "#fbeaea", color: "#d95a5a", fontWeight: 600, fontSize: 14, cursor: "pointer" };
