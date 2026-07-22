// mobile/src/TeamScreen.jsx — 팀 일정 조율
//   · 조율 만들기 → 초대 링크 공유(Share)
//   · 코드/링크로 참여 → 여러 계정의 일정을 참고한 "공통 빈 시간" 제안
//   · 주최자는 한 시간을 확정 → 참여자 전원 캘린더에 생성
//   joinToken prop: 딥링크(plantropic://join/<token>)로 들어오면 자동 참여+열기
import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet,
  Platform, ActivityIndicator, Alert, Share, RefreshControl,
} from "react-native";
import { createApi } from "@scheduler/core/api";
import { auth } from "./auth";

const api = createApi(process.env.EXPO_PUBLIC_API_URL ?? "http://172.30.1.20:4000/api", () => auth.getToken());
const DARK = "#16181d";
const WD = ["일", "월", "화", "수", "목", "금", "토"];

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const hhmm = (iso) => new Date(iso).toISOString().slice(11, 16); // 서버가 로컬 기준 ISO 저장 → 그대로 표시
const fmtDay = (iso) => { const d = new Date(iso); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})`; };
const tokenOf = (input) => input.trim().replace(/\/+$/, "").split("/").pop(); // 링크/코드 → 토큰

export default function TeamScreen({ joinToken }) {
  const [view, setView] = useState("list");        // list | detail
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [dateFrom, setDateFrom] = useState(ymd(new Date()));
  const [dateTo, setDateTo] = useState(ymd(addDays(new Date(), 6)));
  const [early, setEarly] = useState("9");
  const [late, setLate] = useState("21");
  const [dur, setDur] = useState("60");
  const [joinInput, setJoinInput] = useState("");

  const [detail, setDetail] = useState(null);       // { token, meeting, members, isOwner, slots }
  const [editing, setEditing] = useState(false);
  const [eForm, setEForm] = useState(null);

  const load = useCallback(async () => {
    try { setMeetings(await api.listMeetings()); } catch (e) { Alert.alert("목록 실패", e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const openDetail = useCallback(async (token) => {
    setBusy(true);
    try {
      const m = await api.getMeeting(token);
      let slots = [];
      try { slots = (await api.getMeetingSlots(token)).slots ?? []; } catch { /* 미참여 등 */ }
      setDetail({ token, meeting: m, members: m.members, isOwner: m.isOwner, slots });
      setView("detail");
    } catch (e) { Alert.alert("열기 실패", e.message); }
    finally { setBusy(false); }
  }, []);

  // 딥링크로 토큰이 들어오면 자동 참여 후 열기
  useEffect(() => {
    if (!joinToken) return;
    (async () => {
      setBusy(true);
      try { await api.joinMeeting(joinToken); await load(); await openDetail(joinToken); }
      catch (e) { Alert.alert("참여 실패", e.message); }
      finally { setBusy(false); }
    })();
  }, [joinToken, load, openDetail]);

  const create = async () => {
    if (dateTo < dateFrom) return Alert.alert("확인", "종료일이 시작일보다 빠를 수 없어요.");
    setBusy(true);
    try {
      const m = await api.createMeeting({
        title, dateFrom, dateTo,
        earliestHour: Number(early), latestHour: Number(late), durationMin: Number(dur),
      });
      setShowForm(false); setTitle("");
      await load();
      shareInvite(m);
      openDetail(m.inviteToken);
    } catch (e) { Alert.alert("생성 실패", e.message); }
    finally { setBusy(false); }
  };

  const join = async () => {
    const tk = tokenOf(joinInput);
    if (!tk) return;
    setBusy(true);
    try { await api.joinMeeting(tk); setJoinInput(""); await load(); await openDetail(tk); }
    catch (e) { Alert.alert("참여 실패", e.message); }
    finally { setBusy(false); }
  };

  const shareInvite = async (m) => {
    try {
      await Share.share({
        message: `"${m.title}" 일정 조율에 초대합니다.\n${m.inviteUrl}\n(앱에서 참여 코드: ${m.inviteToken})`,
      });
    } catch { /* 취소 무시 */ }
  };

  const pick = async (startsAt) => {
    setBusy(true);
    try {
      const r = await api.pickMeetingSlot(detail.token, startsAt);
      Alert.alert("확정됨", `참여자 ${r.created}명의 캘린더에 "${r.meeting?.title ?? detail.meeting.title}" 일정을 넣었어요.`);
      await openDetail(detail.token);
    } catch (e) { Alert.alert("확정 실패", e.message); }
    finally { setBusy(false); }
  };

  const refreshSlots = async () => {
    setBusy(true);
    try { const s = await api.getMeetingSlots(detail.token); setDetail((d) => ({ ...d, slots: s.slots ?? [] })); }
    catch (e) { Alert.alert("빈 시간 실패", e.message); }
    finally { setBusy(false); }
  };

  // 수정/삭제/나가기
  const startEdit = () => {
    const m = detail.meeting;
    setEForm({ title: m.title, dateFrom: m.date_from, dateTo: m.date_to,
      early: String(m.earliest_hour), late: String(m.latest_hour), dur: String(m.duration_min) });
    setEditing(true);
  };
  const saveEdit = async () => {
    setBusy(true);
    try {
      await api.updateMeeting(detail.token, {
        title: eForm.title, dateFrom: eForm.dateFrom, dateTo: eForm.dateTo,
        earliestHour: Number(eForm.early), latestHour: Number(eForm.late), durationMin: Number(eForm.dur),
      });
      setEditing(false); await load(); await openDetail(detail.token);
    } catch (e) { Alert.alert("수정 실패", e.message); }
    finally { setBusy(false); }
  };
  const removeMeeting = () => Alert.alert("이 조율을 삭제할까요?",
    "참여 기록이 사라져요. (이미 확정해 각자 캘린더에 만든 일정은 유지됩니다)",
    [{ text: "취소", style: "cancel" }, { text: "삭제", style: "destructive", onPress: async () => {
      setBusy(true);
      try { await api.deleteMeeting(detail.token); setView("list"); setEditing(false); await load(); }
      catch (e) { Alert.alert("삭제 실패", e.message); } finally { setBusy(false); }
    } }]);
  const leaveMeeting = () => Alert.alert("이 조율에서 나갈까요?", "",
    [{ text: "취소", style: "cancel" }, { text: "나가기", style: "destructive", onPress: async () => {
      setBusy(true);
      try { await api.leaveMeeting(detail.token); setView("list"); await load(); }
      catch (e) { Alert.alert("나가기 실패", e.message); } finally { setBusy(false); }
    } }]);

  if (loading) return <View style={s.center}><ActivityIndicator /></View>;

  // ── 상세 화면 ──
  if (view === "detail" && detail) {
    const m = detail.meeting;
    return (
      <View style={s.root}>
        <View style={s.header}>
          <Pressable onPress={() => setView("list")} hitSlop={10}><Text style={s.back}>‹ 목록</Text></Pressable>
          <Text style={s.headerTxt} numberOfLines={1}>{m.title}</Text>
          <Pressable onPress={() => shareInvite(m)} hitSlop={10}><Text style={s.share}>공유</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Text style={s.meta}>{m.date_from} ~ {m.date_to} · {m.earliest_hour}–{m.latest_hour}시 · {m.duration_min}분</Text>

          <View style={s.actions}>
            {detail.isOwner ? (
              <>
                <Pressable style={s.actBtn} onPress={editing ? () => setEditing(false) : startEdit}>
                  <Text style={s.actTxt}>{editing ? "수정 닫기" : "수정"}</Text>
                </Pressable>
                <Pressable style={[s.actBtn, s.actDanger]} onPress={removeMeeting}>
                  <Text style={[s.actTxt, s.actDangerTxt]}>삭제</Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={[s.actBtn, s.actDanger]} onPress={leaveMeeting}>
                <Text style={[s.actTxt, s.actDangerTxt]}>나가기</Text>
              </Pressable>
            )}
          </View>

          {editing && eForm && (
            <View style={s.form}>
              <Field label="제목" value={eForm.title} onChangeText={(v) => setEForm((f) => ({ ...f, title: v }))} />
              <View style={s.formRow}>
                <Field label="시작일" value={eForm.dateFrom} onChangeText={(v) => setEForm((f) => ({ ...f, dateFrom: v }))} placeholder="YYYY-MM-DD" flex />
                <Field label="종료일" value={eForm.dateTo} onChangeText={(v) => setEForm((f) => ({ ...f, dateTo: v }))} placeholder="YYYY-MM-DD" flex />
              </View>
              <View style={s.formRow}>
                <Field label="이른 시간" value={eForm.early} onChangeText={(v) => setEForm((f) => ({ ...f, early: v }))} keyboardType="number-pad" suffix="시" flex />
                <Field label="늦은 시간" value={eForm.late} onChangeText={(v) => setEForm((f) => ({ ...f, late: v }))} keyboardType="number-pad" suffix="시" flex />
                <Field label="소요" value={eForm.dur} onChangeText={(v) => setEForm((f) => ({ ...f, dur: v }))} keyboardType="number-pad" suffix="분" flex />
              </View>
              <Pressable style={[s.createBtn, busy && { opacity: 0.5 }]} onPress={saveEdit} disabled={busy}>
                <Text style={s.createTxt}>저장</Text>
              </Pressable>
            </View>
          )}

          <Text style={s.sectionTitle}>참여자 {detail.members?.length ?? 0}명</Text>
          <View style={s.chips}>
            {detail.members?.map((mm) => (
              <View key={mm.userId} style={s.chip}><Text style={s.chipTxt}>{mm.name}</Text></View>
            ))}
          </View>

          <View style={s.rowBetween}>
            <Text style={s.sectionTitle}>공통 빈 시간</Text>
            <Pressable onPress={refreshSlots} disabled={busy}><Text style={s.link}>새로고침</Text></Pressable>
          </View>
          {detail.members?.length < 2 && (
            <Text style={s.hint}>혼자면 본인 일정 기준이에요. 위 "공유"로 팀원을 초대하면 모두가 비는 시간을 찾아줘요.</Text>
          )}

          {busy && <ActivityIndicator style={{ marginVertical: 12 }} />}
          {detail.slots?.length ? detail.slots.map((sl) => (
            <View key={sl.startsAt} style={s.slot}>
              <View style={{ flex: 1 }}>
                <Text style={s.slotDay}>{fmtDay(sl.startsAt)}</Text>
                <Text style={s.slotTime}>{hhmm(sl.startsAt)} – {hhmm(sl.endsAt)}</Text>
              </View>
              {detail.isOwner && (
                <Pressable style={s.pickBtn} disabled={busy}
                  onPress={() => Alert.alert("이 시간으로 확정할까요?", `${fmtDay(sl.startsAt)} ${hhmm(sl.startsAt)}`,
                    [{ text: "취소", style: "cancel" }, { text: "확정", onPress: () => pick(sl.startsAt) }])}>
                  <Text style={s.pickTxt}>확정</Text>
                </Pressable>
              )}
            </View>
          )) : (!busy && <Text style={s.empty}>가능한 공통 시간이 없어요. 기간이나 시간대를 넓혀보세요.</Text>)}
        </ScrollView>
      </View>
    );
  }

  // ── 목록 화면 ──
  return (
    <View style={s.root}>
      <View style={s.header}><Text style={s.headerTxt}>팀 조율</Text></View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DARK} />}>

        {/* 참여 */}
        <Text style={s.sectionTitle}>초대 코드로 참여</Text>
        <View style={s.joinRow}>
          <TextInput style={s.joinInput} value={joinInput} onChangeText={setJoinInput}
            placeholder="초대 링크 또는 코드 붙여넣기" placeholderTextColor="#9aa1ac" autoCapitalize="none" />
          <Pressable style={[s.joinBtn, (!joinInput.trim() || busy) && { opacity: 0.4 }]}
            onPress={join} disabled={!joinInput.trim() || busy}>
            <Text style={s.joinBtnTxt}>참여</Text>
          </Pressable>
        </View>

        {/* 만들기 */}
        <Pressable style={s.newBtn} onPress={() => setShowForm((v) => !v)}>
          <Text style={s.newBtnTxt}>{showForm ? "닫기" : "＋ 새 조율 만들기"}</Text>
        </Pressable>
        {showForm && (
          <View style={s.form}>
            <Field label="제목" value={title} onChangeText={setTitle} placeholder="예: 팀 주간회의" />
            <View style={s.formRow}>
              <Field label="시작일" value={dateFrom} onChangeText={setDateFrom} placeholder="YYYY-MM-DD" flex />
              <Field label="종료일" value={dateTo} onChangeText={setDateTo} placeholder="YYYY-MM-DD" flex />
            </View>
            <View style={s.formRow}>
              <Field label="이른 시간" value={early} onChangeText={setEarly} keyboardType="number-pad" suffix="시" flex />
              <Field label="늦은 시간" value={late} onChangeText={setLate} keyboardType="number-pad" suffix="시" flex />
              <Field label="소요" value={dur} onChangeText={setDur} keyboardType="number-pad" suffix="분" flex />
            </View>
            <Pressable style={[s.createBtn, busy && { opacity: 0.5 }]} onPress={create} disabled={busy}>
              <Text style={s.createTxt}>만들고 초대 링크 공유</Text>
            </Pressable>
          </View>
        )}

        {/* 내 조율 */}
        <Text style={[s.sectionTitle, { marginTop: 22 }]}>내 조율</Text>
        {meetings.length ? meetings.map((m) => (
          <Pressable key={m.token} style={s.card} onPress={() => openDetail(m.inviteToken)}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle} numberOfLines={1}>{m.title}</Text>
              <Text style={s.cardMeta}>{m.date_from} ~ {m.date_to} · {m.earliest_hour}–{m.latest_hour}시</Text>
            </View>
            <Text style={s.cardArrow}>›</Text>
          </Pressable>
        )) : <Text style={s.empty}>아직 조율이 없어요. 위에서 새로 만들어보세요.</Text>}
      </ScrollView>
    </View>
  );
}

function Field({ label, suffix, flex, ...props }) {
  return (
    <View style={flex && { flex: 1 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.fieldRow}>
        <TextInput style={s.fieldInput} placeholderTextColor="#9aa1ac" autoCapitalize="none" {...props} />
        {suffix && <Text style={s.fieldSuffix}>{suffix}</Text>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f5f6f8" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f5f6f8" },
  header: { paddingTop: Platform.OS === "ios" ? 58 : 44, paddingHorizontal: 20, paddingBottom: 12,
            backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#eceef3",
            flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTxt: { fontSize: 22, fontWeight: "700", color: "#1a1d21", letterSpacing: -0.5, flex: 1 },
  back: { fontSize: 15, color: "#4a4f57", fontWeight: "600" },
  share: { fontSize: 15, color: "#3b6fd4", fontWeight: "600" },
  meta: { fontSize: 13, color: "#8a919c", marginBottom: 14 },
  actions: { flexDirection: "row", gap: 8, marginBottom: 4 },
  actBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: "#f0f1f4" },
  actTxt: { fontSize: 13, fontWeight: "600", color: "#33383f" },
  actDanger: { backgroundColor: "#fbeaea" },
  actDangerTxt: { color: "#d95a5a" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#1a1d21", marginBottom: 10 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20 },
  link: { fontSize: 13, color: "#3b6fd4", fontWeight: "600" },
  hint: { fontSize: 12.5, color: "#9aa1ac", marginBottom: 10, lineHeight: 18 },

  joinRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  joinInput: { flex: 1, height: 44, paddingHorizontal: 12, backgroundColor: "#fff", borderRadius: 11,
               borderWidth: 1, borderColor: "#e6e8ee", fontSize: 14, color: "#1a1d21" },
  joinBtn: { paddingHorizontal: 18, height: 44, borderRadius: 11, backgroundColor: DARK, alignItems: "center", justifyContent: "center" },
  joinBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },

  newBtn: { marginTop: 6, height: 46, borderRadius: 12, borderWidth: 1, borderColor: "#d7dae1",
            borderStyle: "dashed", alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  newBtnTxt: { fontSize: 14, fontWeight: "600", color: "#4a4f57" },
  form: { marginTop: 10, backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#eceef3", gap: 12 },
  formRow: { flexDirection: "row", gap: 10 },
  fieldLabel: { fontSize: 12.5, fontWeight: "500", color: "#4a4f57", marginBottom: 6 },
  fieldRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#f0f1f4", borderRadius: 10, paddingHorizontal: 12 },
  fieldInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: "#1a1d21" },
  fieldSuffix: { fontSize: 12.5, color: "#8a919c", marginLeft: 4 },
  createBtn: { height: 48, borderRadius: 12, backgroundColor: DARK, alignItems: "center", justifyContent: "center", marginTop: 2 },
  createTxt: { color: "#fff", fontSize: 15, fontWeight: "700" },

  card: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, marginBottom: 10,
          backgroundColor: "#fff", borderRadius: 13, borderWidth: 1, borderColor: "#eceef3" },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#1a1d21" },
  cardMeta: { fontSize: 12.5, color: "#8a919c", marginTop: 3 },
  cardArrow: { fontSize: 22, color: "#c8ccd4" },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "#eef0f4", borderRadius: 18 },
  chipTxt: { fontSize: 13, color: "#33383f", fontWeight: "500" },

  slot: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, marginTop: 10,
          backgroundColor: "#fff", borderRadius: 13, borderWidth: 1, borderColor: "#eceef3" },
  slotDay: { fontSize: 13, color: "#8a919c" },
  slotTime: { fontSize: 16, fontWeight: "700", color: "#1a1d21", marginTop: 2, fontVariant: ["tabular-nums"] },
  pickBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: DARK },
  pickTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },

  empty: { fontSize: 13.5, color: "#9aa1ac", paddingVertical: 16, textAlign: "center" },
});
