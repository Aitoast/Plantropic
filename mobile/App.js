import React, { useState, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View, ActivityIndicator } from "react-native";
import CalendarScreen from "./src/CalendarScreen";
import LoginScreen from "./src/LoginScreen";
import { auth } from "./src/auth";

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  // 앱 시작 시 저장된 토큰이 유효하면 바로 캘린더로 (로그인 상태 유지)
  useEffect(() => {
    auth.me().then(setUser).finally(() => setChecking(false));
  }, []);

  if (checking) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }

  return (
    <View style={styles.container}>
      {user ? <CalendarScreen /> : <LoginScreen onAuthed={setUser} />}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },          // ← center 제거 (전체화면 보장)
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});