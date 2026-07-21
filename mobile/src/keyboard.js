//     크래시 대신 기존 동작 유지. 완전한 동작은 개발빌드에서
import { KeyboardAvoidingView as RNKAV } from "react-native";

let KeyboardAvoidingView = RNKAV;
let KeyboardProvider = ({ children }) => children;
export let keyboardControllerAvailable = false;

try {
  // Expo Go 에는 이 네이티브 모듈이 없어서 require 시점에 throw → catch 로 폴백
  const kc = require("react-native-keyboard-controller");
  if (kc?.KeyboardProvider && kc?.KeyboardAvoidingView) {
    KeyboardAvoidingView = kc.KeyboardAvoidingView;
    KeyboardProvider = kc.KeyboardProvider;
    keyboardControllerAvailable = true;
  }
} catch {
}

export { KeyboardAvoidingView, KeyboardProvider };
