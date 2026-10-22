import type { CapacitorConfig } from '@capacitor/cli'

// iOS app shell for Momentum. The web app is bundled into the app (webDir),
// built with `npm run build:native` so it skips the PWA service worker.
const config: CapacitorConfig = {
  appId: 'com.praveendhra.momentum',
  appName: 'Momentum',
  webDir: 'dist',
  backgroundColor: '#0f172a',
  ios: {
    contentInset: 'never',
    scheme: 'Momentum',
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: '#0f172a',
      showSpinner: false,
    },
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: '#0f172a',
      style: 'DARK',
    },
  },
}

export default config
