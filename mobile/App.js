import React, { useState, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View, Text, Pressable, ActivityIndicator, Platform } from "react-native";
import CalendarScreen from "./src/CalendarScreen";
import InboxScreen from "./src/InboxScreen";
import SettingsScreen from "./src/SettingsScreen";
import LoginScreen from "./src/LoginScreen";
import { auth } from "./src/auth";
import { registerPush, onNotificationResponse } from "./src/push";

const DARK = "#16181d";
const TABS = [
  { key: "calendar", label: "달력", icon: "▦" },
  { key: "inbox",    label: "인박스", icon: "✉" },
  { key: "settings", label: "설정", icon: "⚙" },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState("calendar");

  // 앱 시작 시 저장된 토큰이 유효하면 바로 로그인 상태로 (로그인 유지)
  useEffect(() => {
    auth.me().then(setUser).finally(() => setChecking(false));
  }, []);

  // 로그인되면 푸시 토큰 등록(베스트에포트) + 알림 탭 시 인박스로 이동
  useEffect(() => {
    if (!user) return;
    registerPush().catch(() => {}); // 권한 거부/시뮬레이터 등은 조용히 무시
    return onNotificationResponse(() => setTab("inbox"));
  }, [user]);

  if (checking) return <View style={styles.center}><ActivityIndicator /></View>;
  if (!user) return (
    <View style={styles.container}>
      <LoginScreen onAuthed={setUser} />
      <StatusBar style="auto" />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={{ flex: 1 }}>
        {tab === "calendar" && <CalendarScreen />}
        {tab === "inbox" && <InboxScreen />}
        {tab === "settings" && <SettingsScreen onLogout={() => { setUser(null); setTab("calendar"); }} />}
      </View>

      {/* 하단 탭바 */}
      <View style={styles.tabbar}>
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <Pressable key={t.key} style={styles.tab} onPress={() => setTab(t.key)}>
              <Text style={[styles.tabIcon, on && styles.tabIconOn]}>{t.icon}</Text>
              <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabbar: { flexDirection: "row", backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#eceef3",
            paddingBottom: Platform.OS === "ios" ? 26 : 10, paddingTop: 8 },
  tab: { flex: 1, alignItems: "center", gap: 3 },
  tabIcon: { fontSize: 20, color: "#b8bdc7" },
  tabIconOn: { color: DARK },
  tabLabel: { fontSize: 11, fontWeight: "500", color: "#b8bdc7" },
  tabLabelOn: { color: DARK, fontWeight: "700" },
});
