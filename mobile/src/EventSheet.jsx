import React, { useState, useEffect } from "react";
import {
  Modal, View, Text, TextInput, Pressable, ScrollView, StyleSheet, Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { CATS, CAT_KEYS, fmtTime, decFromDate } from "@scheduler/core/calendar";

const DARK = "#16181d";
const timeToDate = (dec, day, m, y) => {
  const h = Math.floor(dec), mn = Math.round((dec - h) * 60);
  return new Date(y, m, day, h, mn);
};

export default function EventSheet({ visible, initial, defaultDay, month, year, onSave, onDelete, onClose }) {
  const isEdit = initial?.id != null;
  const [form, setForm] = useState(null);
  const [picker, setPicker] = useState(null);   // 'date' | 'start' | 'end' | null

  useEffect(() => {
    if (!visible) return;
    const day = initial?.day ?? defaultDay;
    setForm({
      id: initial?.id,
      title: initial?.title ?? "",
      cal: initial?.cal ?? "personal",
      date: new Date(year, month, day),
      start: timeToDate(initial?.start ?? 9, day, month, year),
      end: timeToDate(initial?.end ?? 10, day, month, year),
      loc: initial?.loc ?? "",
    });
    setPicker(null);
  }, [visible]);

  if (!form) return null;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    if (!form.title.trim()) return;
    let start = decFromDate(form.start);
    let end = decFromDate(form.end);
    if (end <= start) end = start + 0.5;
    onSave({
      id: form.id, title: form.title.trim(), cal: form.cal,
      day: form.date.getDate(), start, end, loc: form.loc.trim() || "장소 없음",
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.grip} />

        <View style={styles.head}>
          <Text style={styles.h}>{isEdit ? "일정 편집" : "새 일정"}</Text>
          {isEdit && (
            <Pressable style={styles.delBtn} onPress={() => onDelete(form.id)}>
              <Text style={styles.delTxt}>삭제</Text>
            </Pressable>
          )}
        </View>

        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {/* 제목 */}
          <Field label="제목">
            <TextInput style={styles.input} value={form.title} placeholder="일정 제목"
              placeholderTextColor="#a0a6b0" onChangeText={(t) => set("title", t)} />
          </Field>

          {/* 캘린더 칩 */}
          <Field label="캘린더">
            <View style={styles.chips}>
              {CAT_KEYS.map((key) => {
                const c = CATS[key], on = form.cal === key;
                return (
                  <Pressable key={key} onPress={() => set("cal", key)}
                    style={[styles.chip, { borderColor: on ? c.dot : "#e6e9ef", backgroundColor: on ? c.bg : "#fff" }]}>
                    <View style={[styles.chipDot, { backgroundColor: c.dot }]} />
                    <Text style={{ fontSize: 13.5, fontWeight: "500", color: on ? c.fg : "#6b7280" }}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          {/* 날짜 */}
          <Field label="날짜">
            <Pressable style={styles.input} onPress={() => setPicker(picker === "date" ? null : "date")}>
              <Text style={styles.inputTxt}>
                {form.date.getMonth() + 1}월 {form.date.getDate()}일
              </Text>
            </Pressable>
          </Field>

          {/* 시작 / 종료 */}
          <View style={styles.row}>
            <Field label="시작" style={{ flex: 1 }}>
              <Pressable style={styles.input} onPress={() => setPicker(picker === "start" ? null : "start")}>
                <Text style={styles.inputTxt}>{fmtTime(decFromDate(form.start))}</Text>
              </Pressable>
            </Field>
            <Field label="종료" style={{ flex: 1 }}>
              <Pressable style={styles.input} onPress={() => setPicker(picker === "end" ? null : "end")}>
                <Text style={styles.inputTxt}>{fmtTime(decFromDate(form.end))}</Text>
              </Pressable>
            </Field>
          </View>

          {picker && (
            <DateTimePicker
              value={picker === "date" ? form.date : form[picker]}
              mode={picker === "date" ? "date" : "time"}
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(_, d) => {
                if (Platform.OS !== "ios") setPicker(null);
                if (d) set(picker, d);
              }}
            />
          )}

          {/* 장소 */}
          <Field label="장소">
            <TextInput style={styles.input} value={form.loc} placeholder="장소 또는 링크"
              placeholderTextColor="#a0a6b0" onChangeText={(t) => set("loc", t)} />
          </Field>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.cancel} onPress={onClose}><Text style={styles.cancelTxt}>취소</Text></Pressable>
          <Pressable style={styles.save} onPress={save}>
            <Text style={styles.saveTxt}>{isEdit ? "변경 저장" : "추가하기"}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Field({ label, children, style }) {
  return (
    <View style={[{ gap: 7 }, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(22,24,29,0.44)" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 26, borderTopRightRadius: 26,
           paddingBottom: 30, shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 40, shadowOffset: { width: 0, height: -8 } },
  grip: { width: 40, height: 5, borderRadius: 3, backgroundColor: "#d6dae2", alignSelf: "center", marginTop: 12, marginBottom: 4 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 22, paddingTop: 8, paddingBottom: 14 },
  h: { fontSize: 19, fontWeight: "700", letterSpacing: -0.4, color: "#1a1d21" },
  delBtn: { height: 34, paddingHorizontal: 14, borderRadius: 9, backgroundColor: "#fbeee7", alignItems: "center", justifyContent: "center" },
  delTxt: { fontSize: 13, fontWeight: "600", color: "#b4552f" },

  body: { paddingHorizontal: 22, paddingBottom: 22, gap: 17 },
  label: { fontSize: 12, fontWeight: "600", color: "#8a919c", letterSpacing: 0.3 },
  input: { height: 46, paddingHorizontal: 14, borderWidth: 1, borderColor: "#d6dae2", borderRadius: 12, justifyContent: "center", backgroundColor: "#fff" },
  inputTxt: { fontSize: 15, color: "#1a1d21" },
  row: { flexDirection: "row", gap: 12 },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  chipDot: { width: 9, height: 9, borderRadius: 4.5 },

  footer: { flexDirection: "row", gap: 10, paddingHorizontal: 22, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#eceef3" },
  cancel: { height: 50, paddingHorizontal: 20, borderWidth: 1, borderColor: "#d6dae2", borderRadius: 13, alignItems: "center", justifyContent: "center" },
  cancelTxt: { fontSize: 15, fontWeight: "500", color: "#33383f" },
  save: { flex: 1, height: 50, backgroundColor: DARK, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  saveTxt: { fontSize: 15, fontWeight: "600", color: "#fff" },
});