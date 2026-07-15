// mobile/src/push.js — Expo 백그라운드 푸시 토큰 발급 + 서버 등록
//   설치:  npx expo install expo-notifications expo-device expo-constants
//   ※ 토큰 발급에는 EAS projectId 가 필요합니다 → 프로젝트에서 `eas init` 1회 실행
//     (app.json 의 expo.extra.eas.projectId 에 자동 기록됨)
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { createApi } from "@scheduler/core/api";
import { auth } from "./auth";

const api = createApi(process.env.EXPO_PUBLIC_API_URL ?? "http://172.30.1.20:4000/api", () => auth.getToken());

// 포그라운드(앱 켜져 있을 때)에도 배너/소리 표시.
// SDK 54: shouldShowBanner/shouldShowList 사용(구버전 shouldShowAlert 도 함께 둠).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowAlert: true, // 구버전 호환
  }),
});

function getProjectId() {
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId ??
    null
  );
}

// 권한 요청 + Expo 푸시토큰 발급. 반환: { token } 또는 { error }
export async function getPushToken() {
  if (!Device.isDevice)
    return { error: "실기기에서만 푸시 토큰을 받을 수 있어요 (시뮬레이터/에뮬레이터 불가)." };

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "기본 알림",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#16181d",
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return { error: "알림 권한이 거부되었어요. 설정에서 허용해주세요." };

  const projectId = getProjectId();
  try {
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return { token: data };
  } catch (e) {
    return { error: `토큰 발급 실패: ${e.message}` +
      (projectId ? "" : " — app.json 에 EAS projectId 가 없습니다. `eas init` 을 1회 실행하세요.") };
  }
}

// 토큰 발급 후 서버에 등록 (channels.push.expoToken). 성공 시 { token }.
export async function registerPush() {
  const r = await getPushToken();
  if (r.error) return r;
  // 서버 PUT 은 channels 를 병합 저장 → 슬랙/디스코드 설정은 유지됨
  await api.saveNotifySettings({ channels: { push: { expoToken: r.token } } });
  return { token: r.token };
}

// 알림을 탭했을 때 실행할 콜백 등록 (예: 인박스 탭으로 이동). 해제 함수 반환.
export function onNotificationResponse(handler) {
  const sub = Notifications.addNotificationResponseReceivedListener(() => handler?.());
  return () => sub.remove();
}
