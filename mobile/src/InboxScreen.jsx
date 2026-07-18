// mobile/src/InboxScreen.jsx — 앱 인박스 (자연어로 일정 등록/미루기 + confirm 답변)
//   서버의 POST /api/notify/inbox 로 보내고, needs_confirmation 이면 등록/취소 버튼 표시.
//   같은 흐름을 슬랙에서도 쓸 수 있음(서버가 동일한 handleInbound 로 처리).
import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard,
} from "react-native";
import { createApi } from "@scheduler/core/api";
import { auth } from "./auth";
import TravelBanner from "./TravelBanner";

const api = createApi(process.env.EXPO_PUBLIC_API_URL ?? "http://172.30.1.20:4000/api", () => auth.getToken());
const DARK = "#16181d";

const HINTS = [
  "내일 오후 3시 강남역에서 김대리랑 미팅",
  "다음 주 수요일 저녁 7시 홍대 저녁약속",
  "30분 미뤄줘",
  "전체 1시간 미뤄줘",
];

let seq = 0;
const mk = (from, text, extra = {}) => ({ id: `${Date.now()}-${seq++}`, from, text, ...extra });

export default function InboxScreen() {
  const [msgs, setMsgs] = useState([
    mk("bot", "일정을 자연어로 적어주세요. 예: \"내일 오후 3시 강남역 미팅\"\n임박한 일정은 \"30분 미뤄줘\"로 미룰 수 있어요."),
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef(null);
  const toEnd = useCallback(() => scroller.current?.scrollToEnd({ animated: true }), []);
  const push = (m) => setMsgs((prev) => [...prev, m]);

  // 키보드가 올라오면 최신 메시지를 위로 끌어올려 입력창이 내용을 가리지 않게 함
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow", () => setTimeout(toEnd, 60));
    return () => sub.remove();
  }, [toEnd]);

  // 서버 응답 → 봇 말풍선 (필요시 확인 버튼 포함)
  const renderResult = (out) => {
    if (out.status === "error") return push(mk("bot", `⚠ ${out.message}`));
    if (out.status === "needs_confirmation")
      return push(mk("bot", out.message, { confirm: { threadId: out.threadId } }));
    push(mk("bot", out.message || (out.ok ? "완료했어요." : "처리했어요.")));
  };

  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    push(mk("me", t));
    setText("");
    setBusy(true);
    setTimeout(toEnd, 50);
    try { renderResult(await api.sendInbox(t)); }
    catch (e) { push(mk("bot", `⚠ ${e.message}`)); }
    finally { setBusy(false); setTimeout(toEnd, 50); }
  };

  // confirm 응답 (등록/취소)
  const decide = async (threadId, approve, msgId) => {
    setBusy(true);
    // 버튼 눌린 말풍선은 확인 버튼 제거
    setMsgs((prev) => prev.map((m) => (m.id === msgId ? { ...m, confirm: null } : m)));
    push(mk("me", approve ? "네, 등록" : "아니오, 취소"));
    try { renderResult(await api.resumeAgent(threadId, { approve })); }
    catch (e) { push(mk("bot", `⚠ ${e.message}`)); }
    finally { setBusy(false); setTimeout(toEnd, 50); }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}>
      <View style={s.header}><Text style={s.headerTxt}>인박스</Text></View>

      <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={s.list}
        onContentSizeChange={toEnd} keyboardShouldPersistTaps="handled">
        <TravelBanner />
        {msgs.map((m) => (
          <View key={m.id} style={[s.row, m.from === "me" ? s.rowMe : s.rowBot]}>
            <View style={[s.bubble, m.from === "me" ? s.bubbleMe : s.bubbleBot]}>
              <Text style={m.from === "me" ? s.txtMe : s.txtBot}>{m.text}</Text>
              {m.confirm && (
                <View style={s.confirmRow}>
                  <Pressable style={[s.cbtn, s.cbtnYes]} disabled={busy}
                    onPress={() => decide(m.confirm.threadId, true, m.id)}>
                    <Text style={s.cbtnYesTxt}>등록</Text>
                  </Pressable>
                  <Pressable style={[s.cbtn, s.cbtnNo]} disabled={busy}
                    onPress={() => decide(m.confirm.threadId, false, m.id)}>
                    <Text style={s.cbtnNoTxt}>취소</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        ))}
        {busy && <View style={[s.row, s.rowBot]}><View style={[s.bubble, s.bubbleBot]}><ActivityIndicator /></View></View>}
      </ScrollView>

      {msgs.length <= 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.hints} contentContainerStyle={{ gap: 8, paddingHorizontal: 14 }}>
          {HINTS.map((h) => (
            <Pressable key={h} style={s.hint} onPress={() => setText(h)}><Text style={s.hintTxt}>{h}</Text></Pressable>
          ))}
        </ScrollView>
      )}

      <View style={s.inputBar}>
        <TextInput style={s.input} value={text} onChangeText={setText} placeholder="일정을 자연어로 적어보세요"
          placeholderTextColor="#9aa1ac" onSubmitEditing={send} returnKeyType="send" multiline maxLength={200} />
        <Pressable style={[s.sendBtn, (!text.trim() || busy) && { opacity: 0.4 }]} onPress={send} disabled={!text.trim() || busy}>
          <Text style={s.sendTxt}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f5f6f8" },
  header: { paddingTop: Platform.OS === "ios" ? 58 : 44, paddingHorizontal: 20, paddingBottom: 12,
            backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#eceef3" },
  headerTxt: { fontSize: 22, fontWeight: "700", color: "#1a1d21", letterSpacing: -0.5 },
  list: { padding: 14, paddingBottom: 20, gap: 10 },
  row: { flexDirection: "row" },
  rowMe: { justifyContent: "flex-end" },
  rowBot: { justifyContent: "flex-start" },
  bubble: { maxWidth: "82%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  bubbleMe: { backgroundColor: DARK, borderBottomRightRadius: 4 },
  bubbleBot: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#eceef3", borderBottomLeftRadius: 4 },
  txtMe: { color: "#fff", fontSize: 14.5, lineHeight: 20 },
  txtBot: { color: "#1a1d21", fontSize: 14.5, lineHeight: 20 },
  confirmRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  cbtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10 },
  cbtnYes: { backgroundColor: DARK },
  cbtnYesTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
  cbtnNo: { backgroundColor: "#f0f1f4" },
  cbtnNoTxt: { color: "#4a4f57", fontWeight: "600", fontSize: 13 },
  hints: { maxHeight: 44, marginBottom: 6 },
  hint: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#e6e8ee" },
  hintTxt: { fontSize: 12.5, color: "#4a4f57" },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 14,
              paddingTop: 10, paddingBottom: Platform.OS === "ios" ? 28 : 14, backgroundColor: "#fff",
              borderTopWidth: 1, borderTopColor: "#eceef3" },
  input: { flex: 1, maxHeight: 120, minHeight: 44, paddingHorizontal: 14, paddingVertical: 11,
           backgroundColor: "#f0f1f4", borderRadius: 14, fontSize: 15, color: "#1a1d21" },
  sendBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: DARK, alignItems: "center", justifyContent: "center" },
  sendTxt: { color: "#fff", fontSize: 20, fontWeight: "700", marginTop: -2 },
});
