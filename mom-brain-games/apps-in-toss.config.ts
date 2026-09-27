import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  // 앱인토스 콘솔에 등록한 앱 이름(영문 케밥-케이스)과 똑같이 맞춰 주세요. 빌드 파일 이름(<appName>.ait)도 이 값으로 정해져요.
  appName: 'masterpiece-puzzle',
  brand: {
    primaryColor: '#2B3F73', // css/style.css 의 버튼 색(--btn-bg)과 같아요
  },
  permissions: [],
  navigationBar: {
    withBackButton: true, // 누르면 app.js 가 처음 화면으로 돌아가거나(퍼즐 중) 앱을 닫아요(처음 화면)
    withHomeButton: false,
  },
  webView: {
    // 조각을 끌다가 화면이 튕기거나 새로고침되지 않게 막아요
    bounces: false,
    pullToRefreshEnabled: false,
    overScrollMode: 'never',
    allowsBackForwardNavigationGestures: false,
  },
  webBundleDir: 'dist',
});
