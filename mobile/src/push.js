// mobile/src/push.js — Expo 백그라운드 푸시 토큰 발급 + 서버 등록
//   ⚠️ Expo Go(SDK 53+)에는 원격 푸시 네이티브 모듈이 없습니다.
//      → Expo Go 에서는 expo-notifications 를 아예 로드하지 않아 경고/에러가 안 뜹니다.
//      → 실제 백그라운드 푸시는 개발빌드(eas build)에서만 동작합니다.
//   설치:  npx expo install expo-notifications expo-device expo-constants
//   토큰 발급에는 EAS projectId 필요 → `eas init` 1회 (app.json 의 extra.eas.projectId 에 기록됨)
import { Platform } from "react-native";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { createApi } from "@scheduler/core/api";
import { auth } from "./auth";

const api = createApi(process.env.EXPO_PUBLIC_API_URL ?? "http://172.30.1.20:4000/api", () => auth.getToken());

// Expo Go 감지 — storeClient(Expo Go)에는 원격 푸시가 없음(SDK 53+에서 제거됨).
// expo-constants 는 Expo Go 에서도 안전하게 동작.
export const isExpoGo =
  Constants.executionEnvironment === "storeClient" ||
  Constants.appOwnership === "expo";

// expo-notifications 는 Expo Go 밖에서만 "지연 로드".
//   - Expo Go 에서 import/사용하면 그 경고·에러가 출력되므로 아예 require 하지 않음.
//   - require() 는 호출 시점에만 실행되므로, Expo Go 에선 네이티브 초기화가 일어나지 않음.
let _N;
function loadNotifications() {
  if (isExpoGo) return null;
  if (_N !== undefined) return _N;
  try {
    _N = require("expo-notifications");
    // 포그라운드에서도 배너/소리 표시 (SDK 54: shouldShowBanner/List, 구버전 shouldShowAlert 병기)
    _N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowAlert: true,
      }),
    });
  } catch {
    _N = null; // 개발빌드인데 모듈이 없을 때
  }
  return _N;
}

function getProjectId() {
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId ??
    null
  );
}

// 권한 요청 + Expo 푸시토큰 발급. 반환: { token } | { error, skipped? }
export async function getPushToken() {
  if (isExpoGo)
    return { skipped: true,
      error: "Expo Go 에서는 백그라운드 푸시가 지원되지 않아요. 개발빌드(eas build)에서 켜집니다." };

  const N = loadNotifications();
  if (!N) return { skipped: true, error: "expo-notifications 모듈을 불러오지 못했어요." };
  if (!Device.isDevice)
    return { skipped: true, error: "실기기에서만 푸시 토큰을 받을 수 있어요 (시뮬레이터/에뮬레이터 불가)." };

  if (Platform.OS === "android") {
    await N.setNotificationChannelAsync("default", {
      name: "기본 알림",
      importance: N.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#16181d",
    });
  }

  let { status } = await N.getPermissionsAsync();
  if (status !== "granted") status = (await N.requestPermissionsAsync()).status;
  if (status !== "granted") return { error: "알림 권한이 거부되었어요. 설정에서 허용해주세요." };

  const projectId = getProjectId();
  try {
    const { data } = await N.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return { token: data };
  } catch (e) {
    return { error: `토큰 발급 실패: ${e.message}` +
      (projectId ? "" : " — app.json 에 EAS projectId 가 없습니다. `eas init` 을 1회 실행하세요.") };
  }
}

// 토큰 발급 후 서버에 등록 (channels.push.expoToken). 성공 시 { token }.
export async function registerPush() {
  const r = await getPushToken();
  if (r.error) return r;                       // Expo Go/권한거부/시뮬레이터는 여기서 { skipped/error }
  await api.saveNotifySettings({ channels: { push: { expoToken: r.token } } }); // 병합 저장(슬랙 등 유지)
  return { token: r.token };
}

// 알림을 탭했을 때 실행할 콜백 등록. Expo Go 에서는 no-op.
export function onNotificationResponse(handler) {
  const N = loadNotifications();
  if (!N) return () => {};
  const sub = N.addNotificationResponseReceivedListener(() => handler?.());
  return () => sub.remove();
}
