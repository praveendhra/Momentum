/** Helpers for the iOS app build (Capacitor). All no-ops on the web. */
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

export const isNative = Capacitor.isNativePlatform()

/** Public site, used for links that must open outside the app (email confirmation, password reset). */
export const WEB_URL = 'https://momentum.praveendhra.com/'

/** Match the iOS status bar to the app theme. */
export function syncStatusBar(theme: 'light' | 'dark') {
  if (!isNative) return
  void StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light }).catch(() => {})
  void StatusBar.setBackgroundColor({ color: theme === 'dark' ? '#0f172a' : '#f8fafc' }).catch(() => {})
}
