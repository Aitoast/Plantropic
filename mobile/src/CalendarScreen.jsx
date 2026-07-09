import React, { useState, useMemo } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, StatusBar, Platform, RefreshControl } from "react-native";
import { CATS, WD, fmtTime } from "@scheduler/core/calendar";   // SEED_EVENTS 제거
import { createApi } from "@scheduler/core/api";
import { useEventStore } from "@scheduler/core/useEventStore";
import { toUiEvent, toServerPayload } from "@scheduler/core/eventAdapter";
import { auth } from "./auth";
import EventSheet from "./EventSheet";

const api = createApi(
  process.env.EXPO_PUBLIC_API_URL ?? "http://172.30.1.20:4000/api",
  () => auth.getToken()
);

const DARK = "#16181d";
const TODAY = { y: 2026, m: 6, d: 7 };   
const MONTHS = [
  "1월", "2월", "3월", "4월", "5월", "6월", 
  "7월", "8월", "9월", "10월", "11월", "12월"
];

export default function CalendarScreen() {
  const [view, setView] = useState("month");     // month | week | day
  const [cursor, setCursor] = useState({ y: 2026, m: 6 });
  const [selDay, setSelDay] = useState(7);
  const store = useEventStore(api);
  const events = useMemo(
  () => store.events.map(toUiEvent).filter((e) => e.year === cursor.y && e.month === cursor.m),
  [store.events, cursor]);
  const [sheet, setSheet] = useState(null);       // null | {} | event

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await store.reload(); } finally { setRefreshing(false); }
  };

  // 일자별 그룹
  const evByDay = useMemo(() => {
    const map = {};
    events.forEach((e) => (map[e.day] = map[e.day] || []).push(e));
    Object.values(map).forEach((a) => a.sort((x, y) => x.start - y.start));
    return map;
  }, [events]);

  // 달력 셀 (6주 x 7일)
  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const off = first.getDay();
    return Array.from({ length: 42 }, (_, i) => {
      const cd = new Date(cursor.y, cursor.m, 1 - off + i);
      const inM = cd.getMonth() === cursor.m;
      const num = cd.getDate();
      return {
        num, inM,
        isToday: inM && cursor.y === TODAY.y && cursor.m === TODAY.m && num === TODAY.d,
        isSel: inM && num === selDay,
        dots: inM ? (evByDay[num] || []).slice(0, 4) : [],
      };
    });
  }, [cursor, selDay, evByDay]);

  // 주 스트립
  const weekStrip = useMemo(() => {
    const base = new Date(cursor.y, cursor.m, selDay);
    const dow = base.getDay();
    return Array.from({ length: 7 }, (_, i) => {
      const cd = new Date(cursor.y, cursor.m, selDay - dow + i);
      const inM = cd.getMonth() === cursor.m;
      const num = cd.getDate();
      return {
        num, dow: cd.getDay(),
        isToday: inM && cursor.y === TODAY.y && cursor.m === TODAY.m && num === TODAY.d,
        isSel: inM && num === selDay,
        hasEv: inM && (evByDay[num] || []).length > 0,
      };
    });
  }, [cursor, selDay, evByDay]);

  const dayList = evByDay[selDay] || [];
  const selDate = new Date(cursor.y, cursor.m, selDay);
  const selLabel = `${MONTHS[cursor.m]} ${selDay}일 ${WD[selDate.getDay()]}요일`;

  const shift = (dir) => {
    if (view === "month") {
      let m = cursor.m + dir, y = cursor.y;
      if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
      setCursor({ y, m });
    } else setSelDay((d) => d + dir * (view === "week" ? 7 : 1));
  };

  // 저장 / 삭제
  const handleSave = async (form) => {
    if (form.id != null) await store.update(form.id, toServerPayload(form, cursor.y, cursor.m));
    else                 await store.add(toServerPayload(form, cursor.y, cursor.m));
    setSelDay(Number(form.day));
    setSheet(null);
  };
  const handleDelete = async (id) => {
    await store.remove(id);
    setSheet(null);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{cursor.y}년 {MONTHS[cursor.m]}</Text>
          <View style={styles.navRow}>
            <Pressable style={styles.navBtn} onPress={() => shift(-1)}><Text style={styles.navTxt}>‹</Text></Pressable>
            <Pressable style={[styles.navBtn, styles.todayBtn]}
              onPress={() => { setCursor({ y: TODAY.y, m: TODAY.m }); setSelDay(TODAY.d); }}>
              <Text style={styles.todayTxt}>오늘</Text>
            </Pressable>
            <Pressable style={styles.navBtn} onPress={() => shift(1)}><Text style={styles.navTxt}>›</Text></Pressable>
          </View>
        </View>

        {/* 월/주/일 세그먼트 */}
        <View style={styles.seg}>
          {[["month", "월"], ["week", "주"], ["day", "일"]].map(([v, label]) => {
            const on = view === v;
            return (
              <Pressable key={v} style={[styles.segItem, on && styles.segItemOn]} onPress={() => setView(v)}>
                <Text style={[styles.segTxt, on && styles.segTxtOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}
  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#16181d" />}>
        {/* 월 그리드 */}
        {view === "month" && (
          <View style={styles.calBlock}>
            <View style={styles.gridRow}>
              {WD.map((w, i) => (
                <View key={w} style={styles.gridCell}>
                  <Text style={[styles.wdTxt, i === 0 && { color: "#d95a5a" }, i === 6 && { color: "#3b6fd4" }]}>{w}</Text>
                </View>
              ))}
            </View>
            <View style={styles.grid}>
              {cells.map((c, i) => (
                <Pressable key={i} style={styles.gridCell} onPress={() => c.inM && setSelDay(c.num)}>
                  <View style={[styles.dayWrap, c.isSel && !c.isToday && styles.daySel]}>
                    <View style={[styles.dayNum, c.isToday && styles.dayToday]}>
                      <Text style={[
                        styles.dayNumTxt,
                        c.isToday && { color: "#fff", fontWeight: "700" },
                        !c.inM && { color: "#c8ccd4" },
                      ]}>{c.num}</Text>
                    </View>
                    <View style={styles.dots}>
                      {c.dots.map((e, j) => (
                        <View key={j} style={[styles.dot, { backgroundColor: CATS[e.cal].dot }]} />
                      ))}
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* 주 스트립 */}
        {view === "week" && (
          <View style={[styles.calBlock, styles.weekStrip]}>
            {weekStrip.map((d, i) => (
              <Pressable key={i} style={[styles.weekItem, d.isSel && { backgroundColor: DARK }]}
                onPress={() => setSelDay(d.num)}>
                <Text style={[styles.weekWd, d.dow === 0 && { color: "#d95a5a" }, d.dow === 6 && { color: "#3b6fd4" }]}>
                  {WD[d.dow]}
                </Text>
                <Text style={[styles.weekNum, d.isSel && { color: "#fff", fontWeight: "700" },
                  d.isToday && !d.isSel && { color: DARK, fontWeight: "700" }]}>{d.num}</Text>
                <View style={[styles.weekDot, { backgroundColor: d.hasEv ? (d.isSel ? "#fff" : "#d97757") : "transparent" }]} />
              </Pressable>
            ))}
          </View>
        )}

        {/* 선택 날짜의 일정 */}
        <View style={styles.dayBlock}>
          <View style={styles.dayHead}>
            <Text style={styles.dayLabel}>{selLabel}</Text>
            {dayList.length > 0 && <Text style={styles.dayCount}>{dayList.length}개 일정</Text>}
          </View>

          {dayList.length > 0 ? (
            dayList.map((e) => {
              const c = CATS[e.cal];
              return (
                <Pressable key={e.id} style={styles.card} onPress={() => setSheet(e)}>
                  <View style={[styles.rail, { backgroundColor: c.dot }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{e.title}</Text>
                    <Text style={styles.cardTime}>{fmtTime(e.start)} – {fmtTime(e.end)}</Text>
                    <Text style={styles.cardLoc} numberOfLines={1}>{e.loc}</Text>
                  </View>
                  <View style={[styles.tag, { backgroundColor: c.bg }]}>
                    <Text style={[styles.tagTxt, { color: c.fg }]}>{c.label}</Text>
                  </View>
                </Pressable>
              );
            })
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>◔</Text>
              <Text style={styles.emptyTxt}>이 날은 일정이 없어요</Text>
              <Text style={styles.emptySub}>아래 버튼으로 새 일정을 추가하세요</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* 하단 일정 만들기 */}
      <View style={styles.fabWrap} pointerEvents="box-none">
        <Pressable style={styles.fab} onPress={() => setSheet({ day: selDay })}>
          <Text style={styles.fabPlus}>＋</Text>
          <Text style={styles.fabTxt}>일정 만들기</Text>
        </Pressable>
      </View>

      {/* 바텀시트 */}
      <EventSheet
        visible={!!sheet}
        initial={sheet}
        defaultDay={selDay}
        month={cursor.m}
        year={cursor.y}
        onSave={handleSave}
        onDelete={handleDelete}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f5f6f8" },
  header: { paddingTop: Platform.OS === "ios" ? 58 : 44, paddingHorizontal: 20, paddingBottom: 12,
            backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#eceef3" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  title: { fontSize: 24, fontWeight: "700", letterSpacing: -0.6, color: "#1a1d21" },
  navRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  navBtn: { height: 36, minWidth: 36, paddingHorizontal: 8, borderRadius: 9, backgroundColor: "#f0f1f4",
            alignItems: "center", justifyContent: "center" },
  navTxt: { fontSize: 18, color: "#4a4f57", marginTop: -2 },
  todayBtn: { paddingHorizontal: 13 },
  todayTxt: { fontSize: 13, fontWeight: "600", color: "#33383f" },

  seg: { flexDirection: "row", height: 38, backgroundColor: "#f0f1f4", borderRadius: 10, padding: 3 },
  segItem: { flex: 1, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  segItemOn: { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segTxt: { fontSize: 14, fontWeight: "500", color: "#6b7280" },
  segTxtOn: { color: DARK, fontWeight: "600" },

  calBlock: { backgroundColor: "#fff", paddingHorizontal: 12, paddingTop: 6, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#eceef3" },
  gridRow: { flexDirection: "row" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  gridCell: { width: `${100 / 7}%`, alignItems: "center" },
  wdTxt: { fontSize: 11, fontWeight: "600", color: "#a0a6b0", paddingVertical: 8 },
  dayWrap: { alignItems: "center", gap: 3, paddingVertical: 5, width: "100%", borderRadius: 11 },
  daySel: { backgroundColor: "#eef0f4" },
  dayNum: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  dayToday: { backgroundColor: DARK },
  dayNumTxt: { fontSize: 14, fontWeight: "500", color: "#33383f" },
  dots: { flexDirection: "row", gap: 3, height: 6, alignItems: "center" },
  dot: { width: 5, height: 5, borderRadius: 2.5 },

  weekStrip: { flexDirection: "row", gap: 6, paddingTop: 12, paddingBottom: 14 },
  weekItem: { flex: 1, alignItems: "center", gap: 5, paddingVertical: 8, borderRadius: 13 },
  weekWd: { fontSize: 11, fontWeight: "600", color: "#a0a6b0" },
  weekNum: { fontSize: 16, fontWeight: "500", color: "#33383f" },
  weekDot: { width: 5, height: 5, borderRadius: 2.5 },

  dayBlock: { paddingHorizontal: 18, paddingTop: 18 },
  dayHead: { flexDirection: "row", alignItems: "baseline", gap: 9, marginBottom: 14 },
  dayLabel: { fontSize: 17, fontWeight: "700", letterSpacing: -0.4, color: "#1a1d21" },
  dayCount: { fontSize: 13, fontWeight: "500", color: "#8a919c" },

  card: { flexDirection: "row", alignItems: "stretch", gap: 12, padding: 13, marginBottom: 10,
          borderWidth: 1, borderColor: "#eceef3", backgroundColor: "#fff", borderRadius: 14,
          shadowColor: "#141828", shadowOpacity: 0.03, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  rail: { width: 4, borderRadius: 3 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#1a1d21" },
  cardTime: { fontSize: 12.5, color: "#6b7280", marginTop: 3, fontVariant: ["tabular-nums"] },
  cardLoc: { fontSize: 12.5, color: "#9aa1ac", marginTop: 2 },
  tag: { alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  tagTxt: { fontSize: 11, fontWeight: "600" },

  empty: { paddingVertical: 44, alignItems: "center" },
  emptyIcon: { fontSize: 30, opacity: 0.35, marginBottom: 8 },
  emptyTxt: { fontSize: 14, fontWeight: "500", color: "#9aa1ac" },
  emptySub: { fontSize: 12.5, color: "#b8bdc7", marginTop: 3 },

  fabWrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 30 },
  fab: { height: 52, borderRadius: 15, backgroundColor: DARK, flexDirection: "row", alignItems: "center",
         justifyContent: "center", gap: 8, shadowColor: DARK, shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  fabPlus: { fontSize: 20, color: "#fff", marginTop: -2 },
  fabTxt: { fontSize: 16, fontWeight: "600", color: "#fff" },
});