/*
 * 토스 앱(앱인토스) 연결부.
 *
 * 앱 코드(js/app.js)는 빌드 도구 없는 순수 JS라서 SDK를 직접 import 하지 못해요.
 * 그래서 필요한 기능만 이 파일에서 꺼내 window.TossBridge 로 넘겨줘요.
 * `npm run build` 때 esbuild가 이 파일을 dist/js/toss-bridge.js 하나로 묶어요.
 *
 * 토스 앱 밖(일반 브라우저)에서는 window.ReactNativeWebView 가 없어서 TossBridge를 만들지 않아요.
 * 그러면 app.js는 브라우저 저장소(localStorage)만 써요.
 */
import { Storage, graniteEvent, Screen, Device } from '@apps-in-toss/web-framework';

const ignore = () => {};
// SDK 호출이 바로 오류를 던져도 Promise로 받아서 앱이 멈추지 않게 해요
const call = (fn) => {
  try {
    return Promise.resolve(fn());
  } catch (err) {
    return Promise.reject(err);
  }
};

if (typeof window !== 'undefined' && window.ReactNativeWebView != null) {
  window.TossBridge = {
    // 토스 앱이 보관하는 저장소: 앱을 껐다 켜도, 앱이 업데이트돼도 남아 있어요.
    getItem: (key) => call(() => Storage.getItem(key)),
    setItem: (key, value) => call(() => Storage.setItem(key, value)),
    // 시스템 뒤로가기(안드로이드 뒤로 버튼, 상단 뒤로 버튼)
    onBack: (handler) => {
      try {
        graniteEvent.addEventListener('backEvent', { onEvent: handler, onError: ignore });
        return true;
      } catch (err) {
        return false;
      }
    },
    close: () => call(() => Screen.close()).catch(ignore),
    // 퍼즐을 하는 동안 화면이 꺼지지 않게 해요
    keepAwake: (enabled) => call(() => Screen.setAwakeMode({ enabled })).catch(ignore),
    haptic: (type) => call(() => Device.triggerHaptic({ type })).catch(ignore),
  };
}
