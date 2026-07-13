import { useState, useEffect } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import * as Location from "expo-location";
import { createApi } from "@scheduler/core/api";
import { auth } from "./auth";

const api = createApi(process.env.EXPO_PUBLIC_API_URL ?? "http://172.30.1.20:4000/api", () => auth.getToken());

export default function TravelBanner() {
  const [state, setState] = useState({ loading: true });

  const check = async () => {
    setState({ loading: true });
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return setState({ error: "위치 권한이 필요해요." });
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const r = await api.getNextTravel(loc.coords.latitude, loc.coords.longitude);
      setState({ data: r });
    } catch (e) { setState({ error: e.message }); }
  };
  useEffect(() => { check(); }, []);

  if (state.loading) return <View style={s.card}><ActivityIndicator /></View>;
  if (state.error) return <Pressable style={s.card} onPress={check}><Text style={s.sub}>{state.error} · 탭하여 재시도</Text></Pressable>;

  const r = state.data;
  if (!r?.hasNext || r.configured === false || !r.alert) return null;  // 없거나/키없음/10분미만이면 숨김

  return (
    <Pressable style={[s.card, s.alert]} onPress={check}>
      <Text style={s.title}>🚇 {r.leaveByLabel}까지 출발하세요</Text>
      <Text style={s.msg}>{r.message}</Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  card: { margin: 16, marginBottom: 0, padding: 14, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#eceef3" },
  alert: { backgroundColor: "#fbeee7", borderColor: "#f0d3c4" },
  title: { fontSize: 15, fontWeight: "700", color: "#b4552f" },
  msg: { fontSize: 13, color: "#6b7280", marginTop: 4, lineHeight: 19 },
  sub: { fontSize: 13, color: "#8a919c" },
});