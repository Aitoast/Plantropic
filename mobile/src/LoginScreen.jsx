// LoginScreen.jsx — Plantropic 모바일 로그인/회원가입 (Expo React Native)
// 디자인: 상단 다크 헤더 + 스크롤 폼, 세그먼트 토글, 이메일/비밀번호, Google·Kakao
// 아이콘: expo install @expo/vector-icons  (AntDesign)
import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator,
} from "react-native";
import { AntDesign } from "@expo/vector-icons";
import { auth } from "./auth";

export default function LoginScreen({ onAuthed }) {
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [remember, setRemember] = useState(true);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const isLogin = mode === "login";
  const checked = isLogin ? remember : agree;

  async function handleSubmit() {
    setError(null);
    if (!email.trim() || !pw) return setError("이메일과 비밀번호를 입력해주세요.");
    if (!isLogin) {
      if (!name.trim()) return setError("이름을 입력해주세요.");
      if (pw.length < 8) return setError("비밀번호는 8자 이상이어야 해요.");
      if (pw !== pw2) return setError("비밀번호가 일치하지 않아요.");
      if (!agree) return setError("약관에 동의해주세요.");
    }
    setBusy(true);
    try {
      const user = isLogin
        ? await auth.login(email.trim(), pw)
        : await auth.signup(name.trim(), email.trim(), pw);
      onAuthed?.(user);
    } catch (e) {
      setError(e?.message ?? "문제가 발생했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#f5f6f8" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* HEADER */}
        <View style={s.header}>
          <View style={s.logoRow}>
            <View style={s.logoMark}><Text style={s.logoMarkTxt}>P</Text></View>
            <Text style={s.logoWord}>Plantropic</Text>
          </View>
          <Text style={s.heading}>{isLogin ? "다시 오신 걸\n환영해요" : "계정 만들기"}</Text>
          <Text style={s.subheading}>
            {isLogin ? "로그인하고 일정을 이어서 관리하세요." : "30초면 시작할 수 있어요. 카드는 필요 없어요."}
          </Text>
        </View>

        {/* FORM */}
        <View style={s.form}>
          {/* 세그먼트 토글 */}
          <View style={s.tabs}>
            <Tab label="로그인" on={isLogin} onPress={() => setMode("login")} />
            <Tab label="회원가입" on={!isLogin} onPress={() => setMode("signup")} />
          </View>

          {!isLogin && (
            <Field label="이름">
              <TextInput style={s.input} value={name} onChangeText={setName} placeholder="홍길동" placeholderTextColor="#b3b9c2" />
            </Field>
          )}

          <Field label="이메일">
            <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="you@company.com"
              placeholderTextColor="#b3b9c2" autoCapitalize="none" keyboardType="email-address" />
          </Field>

          <Field label="비밀번호" aside={isLogin ? <Text style={s.link}>비밀번호 찾기</Text> : null}>
            <TextInput style={s.input} value={pw} onChangeText={setPw} secureTextEntry
              placeholder={isLogin ? "비밀번호 입력" : "8자 이상 입력"} placeholderTextColor="#b3b9c2" />
          </Field>

          {!isLogin && (
            <Field label="비밀번호 확인">
              <TextInput style={s.input} value={pw2} onChangeText={setPw2} secureTextEntry
                placeholder="한 번 더 입력" placeholderTextColor="#b3b9c2" />
            </Field>
          )}

          {/* 체크 */}
          <TouchableOpacity style={s.checkRow} activeOpacity={0.7}
            onPress={() => (isLogin ? setRemember((v) => !v) : setAgree((v) => !v))}>
            <View style={[s.check, checked && s.checkOn]}>{checked && <Text style={s.checkMark}>✓</Text>}</View>
            <Text style={s.checkLabel}>{isLogin ? "로그인 상태 유지" : "이용약관 및 개인정보 처리방침에 동의합니다"}</Text>
          </TouchableOpacity>

          {error && <View style={s.errorBox}><Text style={s.errorTxt}>{error}</Text></View>}

          {/* CTA */}
          <TouchableOpacity style={s.cta} activeOpacity={0.9} onPress={handleSubmit} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.ctaTxt}>{isLogin ? "로그인" : "가입하고 시작하기"}</Text>}
          </TouchableOpacity>

          {/* divider */}
          <View style={s.divider}>
            <View style={s.line} /><Text style={s.dividerTxt}>또는 소셜 계정으로</Text><View style={s.line} />
          </View>

          {/* social */}
          <TouchableOpacity style={s.social} activeOpacity={0.85} onPress={() => {/* expo-auth-session Google 플로우 */}}>
            <AntDesign name="google" size={18} color="#EA4335" />
            <Text style={s.socialTxt}>Google로 계속하기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.social, s.kakao]} activeOpacity={0.85} onPress={() => {/* Kakao 로그인 플로우 */}}>
            <AntDesign name="message1" size={18} color="#191600" />
            <Text style={[s.socialTxt, { color: "#191600" }]}>카카오로 계속하기</Text>
          </TouchableOpacity>

          <View style={s.switchRow}>
            <Text style={s.switchTxt}>{isLogin ? "아직 계정이 없으신가요? " : "이미 계정이 있으신가요? "}</Text>
            <TouchableOpacity onPress={() => setMode(isLogin ? "signup" : "login")}>
              <Text style={[s.link, { fontWeight: "600" }]}>{isLogin ? "회원가입" : "로그인"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Tab({ label, on, onPress }) {
  return (
    <TouchableOpacity style={[s.tab, on && s.tabOn]} activeOpacity={0.8} onPress={onPress}>
      <Text style={[s.tabTxt, on && s.tabTxtOn]}>{label}</Text>
    </TouchableOpacity>
  );
}
function Field({ label, aside, children }) {
  return (
    <View style={s.field}>
      <View style={s.fieldHead}>
        <Text style={s.label}>{label}</Text>
        {aside}
      </View>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  header: { paddingTop: 68, paddingBottom: 30, paddingHorizontal: 26, backgroundColor: "#16181d", borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  logoMark: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  logoMarkTxt: { color: "#16181d", fontWeight: "700", fontSize: 17 },
  logoWord: { fontSize: 20, fontWeight: "600", letterSpacing: -0.4, color: "#fff" },
  heading: { fontSize: 25, fontWeight: "700", letterSpacing: -0.7, lineHeight: 30, marginTop: 26, color: "#fff" },
  subheading: { fontSize: 14, lineHeight: 21, color: "#a3aab6", marginTop: 10 },

  form: { flex: 1, paddingHorizontal: 26, paddingTop: 24, paddingBottom: 40 },
  tabs: { flexDirection: "row", height: 42, backgroundColor: "#e9ebf0", borderRadius: 12, padding: 4, marginBottom: 24 },
  tab: { flex: 1, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  tabOn: { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  tabTxt: { fontSize: 14, fontWeight: "500", color: "#8a919c" },
  tabTxtOn: { color: "#16181d", fontWeight: "600" },

  field: { marginBottom: 14 },
  fieldHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 7 },
  label: { fontSize: 12, fontWeight: "600", color: "#8a919c", letterSpacing: 0.3 },
  input: { height: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: "#d6dae2", borderRadius: 12, fontSize: 15, color: "#1a1d21", backgroundColor: "#fff" },

  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 9, marginTop: 2 },
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: "#c3c9d2", backgroundColor: "#fff", alignItems: "center", justifyContent: "center", marginTop: 1 },
  checkOn: { borderColor: "#16181d", backgroundColor: "#16181d" },
  checkMark: { color: "#fff", fontSize: 12, lineHeight: 14 },
  checkLabel: { flex: 1, fontSize: 12.5, color: "#6b7280", lineHeight: 19 },

  errorBox: { marginTop: 14, backgroundColor: "#fbeee7", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 13 },
  errorTxt: { fontSize: 13, color: "#b4552f", lineHeight: 19 },

  cta: { height: 52, marginTop: 22, backgroundColor: "#16181d", borderRadius: 14, alignItems: "center", justifyContent: "center", shadowColor: "#16181d", shadowOpacity: 0.26, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  ctaTxt: { color: "#fff", fontSize: 16, fontWeight: "600" },

  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 24 },
  line: { flex: 1, height: 1, backgroundColor: "#e6e9ef" },
  dividerTxt: { fontSize: 11.5, color: "#a0a6b0", fontWeight: "500" },

  social: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 11, height: 50, borderWidth: 1, borderColor: "#dce0e7", backgroundColor: "#fff", borderRadius: 13, marginBottom: 10 },
  kakao: { borderWidth: 0, backgroundColor: "#FEE500" },
  socialTxt: { fontSize: 14.5, fontWeight: "600", color: "#33383f" },

  switchRow: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  switchTxt: { fontSize: 13, color: "#8a919c" },
  link: { fontSize: 13, color: "#3b6fd4" },
});
