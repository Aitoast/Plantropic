// mobile/src/SettingsScreen.jsx — 알림 설정 (슬랙/디스코드 채널, 알림 시점, 위치 자동보고)
//   서버: GET/PUT /api/notify/settings, POST /api/notify/test, POST /api/notify/location
import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet,
  Switch, Platform, ActivityIndicator, Alert,
} from "react-native";
import * as Location from "expo-location";
import { createApi } from "@scheduler/core/api";
import { auth } from "./auth";
import { registerPush } from "./push";

const api = createApi(process.env.EXPO_PUBLIC_API_URL ?? "http://172.30.1.20:4000/api", () => auth.getToken());
const DARK = "#16181d";

export default function SettingsScreen({ onLogout }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [remindMin, setRemindMin] = useState("30");
  const [emptySlotMin, setEmptySlotMin] = useState("180");
  const [slackWebhook, setSlackWebhook] = useState("");
  const [slackUserId, setSlackUserId] = useState("");
  const [discordWebhook, setDiscordWebhook] = useState("");
  const [autoLocation, setAutoLocation] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await api.getNotifySettings();
        setRemindMin(String(cfg.remindMin ?? 30));
        setEmptySlotMin(String(cfg.emptySlotMin ?? 0));
        setSlackWebhook(cfg.channels?.slack?.webhook ?? "");
        setSlackUserId(cfg.channels?.slack?.userId ?? "");
        setDiscordWebhook(cfg.channels?.discord?.webhook ?? "");
        setAutoLocation(!!cfg.lastLocation);
        setPushOn(!!cfg.channels?.push?.expoToken);
      } catch (e) { /* 첫 사용 시 설정 없음 → 기본값 유지 */ }
      finally { setLoading(false); }
    })();
  }, []);

  const buildChannels = () => {
    const channels = {};
    if (slackWebhook.trim()) channels.slack = { webhook: slackWebhook.trim(), userId: slackUserId.trim() || undefined };
    if (discordWebhook.trim()) channels.discord = { webhook: discordWebhook.trim() };
    return channels;
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.saveNotifySettings({
        remindMin: Number(remindMin) || 30,
        emptySlotMin: Number(emptySlotMin) || 0,
        channels: buildChannels(),
      });
      Alert.alert("저장됨", "알림 설정을 저장했어요.");
    } catch (e) { Alert.alert("저장 실패", e.message); }
    finally { setSaving(false); }
  };

  const test = async () => {
    try {
      const r = await api.testNotify();
      Alert.alert(r.ok ? "발송됨" : "발송 안 됨", r.message);
    } catch (e) { Alert.alert("테스트 실패", e.message); }
  };

  // 현재 위치를 서버에 1회 보고 (이동 사전알림 출발지로 사용). 켜면 즉시 1회 보고.
  const toggleLocation = async (on) => {
    setAutoLocation(on);
    if (!on) return;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setAutoLocation(false); return Alert.alert("권한 필요", "위치 권한을 허용해주세요."); }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await api.reportLocation(loc.coords.latitude, loc.coords.longitude);
      Alert.alert("위치 보고됨", "현재 위치를 이동 알림 계산에 사용해요.");
    } catch (e) { setAutoLocation(false); Alert.alert("실패", e.message); }
  };

  // 이 기기에서 백그라운드 푸시 켜기 (권한 요청 + 토큰 발급 + 서버 등록)
  const togglePush = async (on) => {
    if (!on) return setPushOn(false); // 끄기: 로컬 표시만 (토큰 폐기는 로그아웃/재설치 시)
    setPushBusy(true);
    const r = await registerPush();
    setPushBusy(false);
    if (r.error) {
      setPushOn(false);
      // Expo Go/시뮬레이터 등 "지원 안 됨"은 실패가 아니라 안내로 표시
      return Alert.alert(r.skipped ? "푸시 사용 불가" : "푸시 설정 실패", r.error);
    }
    setPushOn(true);
    Alert.alert("푸시 켜짐", "이 기기로 백그라운드 알림을 받습니다.");
  };

  if (loading) return <View style={s.center}><ActivityIndicator /></View>;

  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <View style={s.header}><Text style={s.headerTxt}>알림 설정</Text></View>

      {/* 앱 푸시 (백그라운드) */}
      <Section title="앱 푸시" hint="앱을 닫아도 이 기기로 알림을 받습니다. 실기기 + 알림 권한이 필요해요.">
        <View style={s.switchRow}>
          <Text style={s.switchLabel}>이 기기에서 백그라운드 푸시 받기</Text>
          {pushBusy ? <ActivityIndicator /> :
            <Switch value={pushOn} onValueChange={togglePush} trackColor={{ true: DARK }} thumbColor="#fff" />}
        </View>
      </Section>

      {/* 알림 시점 */}
      <Section title="알림 시점">
        <Field label="일정 시작 몇 분 전에 알림" value={remindMin} onChangeText={setRemindMin} keyboardType="number-pad" suffix="분" />
        <Field label="다음 일정이 비면 채우기 유도 (0=끔)" value={emptySlotMin} onChangeText={setEmptySlotMin} keyboardType="number-pad" suffix="분" />
      </Section>

      {/* 슬랙 */}
      <Section title="슬랙" hint="Incoming Webhook URL 로 알림을 받고, 슬랙에서 답장하려면 멤버 ID 도 입력하세요.">
        <Field label="Webhook URL" value={slackWebhook} onChangeText={setSlackWebhook}
          placeholder="https://hooks.slack.com/services/..." autoCapitalize="none" />
        <Field label="내 멤버 ID (답장 매핑용)" value={slackUserId} onChangeText={setSlackUserId}
          placeholder="U01ABCDEF" autoCapitalize="none" />
      </Section>

      {/* 디스코드 */}
      <Section title="디스코드" hint="채널 설정 → 연동 → 웹훅 생성 후 URL 붙여넣기.">
        <Field label="Webhook URL" value={discordWebhook} onChangeText={setDiscordWebhook}
          placeholder="https://discord.com/api/webhooks/..." autoCapitalize="none" />
      </Section>

      {/* 위치 */}
      <Section title="위치" hint="다음 일정까지 이동시간을 계산해 출발 시각을 미리 알려줘요.">
        <View style={s.switchRow}>
          <Text style={s.switchLabel}>현재 위치를 이동 알림에 사용</Text>
          <Switch value={autoLocation} onValueChange={toggleLocation}
            trackColor={{ true: DARK }} thumbColor="#fff" />
        </View>
      </Section>

      <View style={{ paddingHorizontal: 18, gap: 10, marginTop: 6 }}>
        <Pressable style={[s.btn, s.btnDark, saving && { opacity: 0.5 }]} onPress={save} disabled={saving}>
          <Text style={s.btnDarkTxt}>{saving ? "저장 중…" : "저장"}</Text>
        </Pressable>
        <Pressable style={[s.btn, s.btnGhost]} onPress={test}>
          <Text style={s.btnGhostTxt}>테스트 알림 보내기</Text>
        </Pressable>
        <Pressable style={s.logout} onPress={async () => { await auth.logout(); onLogout?.(); }}>
          <Text style={s.logoutTxt}>로그아웃</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Section({ title, hint, children }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {hint && <Text style={s.sectionHint}>{hint}</Text>}
      <View style={{ gap: 12, marginTop: 10 }}>{children}</View>
    </View>
  );
}

function Field({ label, suffix, ...props }) {
  return (
    <View>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.fieldRow}>
        <TextInput style={s.fieldInput} placeholderTextColor="#9aa1ac" {...props} />
        {suffix && <Text style={s.fieldSuffix}>{suffix}</Text>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f5f6f8" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f5f6f8" },
  header: { paddingTop: Platform.OS === "ios" ? 58 : 44, paddingHorizontal: 20, paddingBottom: 12,
            backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#eceef3" },
  headerTxt: { fontSize: 22, fontWeight: "700", color: "#1a1d21", letterSpacing: -0.5 },
  section: { backgroundColor: "#fff", marginTop: 12, marginHorizontal: 14, borderRadius: 16, padding: 16,
             borderWidth: 1, borderColor: "#eceef3" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#1a1d21" },
  sectionHint: { fontSize: 12.5, color: "#9aa1ac", marginTop: 4, lineHeight: 18 },
  fieldLabel: { fontSize: 13, fontWeight: "500", color: "#4a4f57", marginBottom: 6 },
  fieldRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#f0f1f4", borderRadius: 11, paddingHorizontal: 12 },
  fieldInput: { flex: 1, paddingVertical: 11, fontSize: 14.5, color: "#1a1d21" },
  fieldSuffix: { fontSize: 13, color: "#8a919c", marginLeft: 6 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  switchLabel: { fontSize: 14, color: "#33383f", flex: 1 },
  btn: { height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  btnDark: { backgroundColor: DARK },
  btnDarkTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },
  btnGhost: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e6e8ee" },
  btnGhostTxt: { color: "#33383f", fontSize: 15, fontWeight: "600" },
  logout: { alignItems: "center", paddingVertical: 14, marginTop: 4 },
  logoutTxt: { color: "#d95a5a", fontSize: 14, fontWeight: "600" },
});
