import { useSyncExternalStore } from 'react'
import { canPrompt, installState, isStandalone, platform, promptInstall, subscribe } from '../lib/install'

export function useInstall() {
  useSyncExternalStore(subscribe, installState)
  return { installed: isStandalone(), canPrompt: canPrompt(), platform: platform(), promptInstall }
}
