import React, { useState, useEffect, useRef, useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import {
  StyleSheet, View, Text, Pressable, ActivityIndicator, Platform,
  ScrollView, Dimensions, Keyboard,
} from "react-native";
import { KeyboardProvider } from "./src/keyboard";
import CalendarScreen from "./src/CalendarScreen";
import InboxScreen from "./src/InboxScreen";
import SettingsScreen from "./src/SettingsScreen";
import LoginScreen from "./src/LoginScreen";
import { auth } from "./src/auth";
import { registerPush, onNotificationResponse } from "./src/push";

const DARK = "#16181d";
const TABS = [
  { key: "calendar", label: "달력", icon: "▦" },
  { key: "inbox",    label: "어시스트", icon: "✉" },
  { key: "settings", label: "설정", icon: "⚙" },
];
const ORDER = TABS.map((t) => t.key);

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState("calendar");
  const [width, setWidth] = useState(Dimensions.get("window").width);
  const [kbOpen, setKbOpen] = useState(false);   // 키보드 열림 → 탭바 숨김(입력창 높이 계산 정확)
  const pager = useRef(null);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKbOpen(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKbOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // 탭 선택 , 알림 탭 
  const goTab = useCallback((key) => {
    const i = ORDER.indexOf(key);
    if (i < 0) return;
    setTab(key);
    pager.current?.scrollTo({ x: i * width, animated: true });
  }, [width]);

  // 좌우 스와이프로
  const onPagerEnd = (e) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (ORDER[i] && ORDER[i] !== tab) setTab(ORDER[i]);
  };

  // 로그인 유지
  useEffect(() => {
    auth.me().then(setUser).finally(() => setChecking(false));
  }, []);

  // 알림 탭 시 어시스트로 이동
  useEffect(() => {
    if (!user) return;
    registerPush().catch(() => {});
    return onNotificationResponse(() => goTab("inbox"));
  }, [user, goTab]);

  if (checking) return <View style={styles.center}><ActivityIndicator /></View>;
  if (!user) return (
    <View style={styles.container}>
      <LoginScreen onAuthed={setUser} />
      <StatusBar style="auto" />
    </View>
  );

  return (
    <KeyboardProvider>
      <View style={styles.container}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {/* 좌우 스와이프 가능한 3화면 페이저 */}
        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onPagerEnd}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          scrollEventThrottle={16}
          style={{ flex: 1 }}
        >
          <View style={{ width }}><CalendarScreen /></View>
          <View style={{ width }}><InboxScreen /></View>
          <View style={{ width }}><SettingsScreen onLogout={() => { setUser(null); goTab("calendar"); }} /></View>
        </ScrollView>

        {/* 하단 탭바 */}
        {!kbOpen && (
          <View style={styles.tabbar}>
            {TABS.map((t) => {
              const on = tab === t.key;
              return (
                <Pressable key={t.key} style={styles.tab} onPress={() => goTab(t.key)}>
                  <Text style={[styles.tabIcon, on && styles.tabIconOn]}>{t.icon}</Text>
                  <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <StatusBar style="auto" />
      </View>
    </KeyboardProvider>
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
