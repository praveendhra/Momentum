import { useState, type ReactNode } from 'react'
import { useInstall } from '../hooks/useInstall'
import type { Platform } from '../lib/install'
import { Modal, btnPrimary } from './ui'

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" className="inline h-5 w-5 -mt-1 text-sky-400" fill="none" stroke="currentColor" strokeWidth="2" aria-label="Share">
    <path d="M12 3v12M7 8l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" strokeLinecap="round" />
  </svg>
)

const STEPS: Record<Platform, { title: string; steps: ReactNode[] }> = {
  ios: {
    title: 'Add to your iPhone / iPad home screen',
    steps: [
      <>Open this page in <strong>Safari</strong> (other iOS browsers also work via their Share menu).</>,
      <>Tap the <strong>Share</strong> button <ShareIcon /> in the toolbar.</>,
      <>Scroll down and tap <strong>Add to Home Screen</strong>.</>,
      <>Tap <strong>Add</strong>. Momentum opens full-screen like a regular app.</>,
    ],
  },
  android: {
    title: 'Add to your Android home screen',
    steps: [
      <>Tap the browser menu <strong>⋮</strong> (top right in Chrome).</>,
      <>Tap <strong>Add to Home screen</strong> or <strong>Install app</strong>.</>,
      <>Confirm with <strong>Install</strong>.</>,
    ],
  },
  'mac-safari': {
    title: 'Add Momentum to your Dock',
    steps: [
      <>In Safari's menu bar choose <strong>File → Add to Dock…</strong> (or Share <ShareIcon /> → Add to Dock).</>,
      <>Click <strong>Add</strong>. It opens in its own window from the Dock.</>,
    ],
  },
  firefox: {
    title: 'Create a shortcut',
    steps: [
      <>Firefox on desktop can't install web apps. Open this page in <strong>Chrome</strong> or <strong>Edge</strong> and use the install icon in the address bar.</>,
      <>Or just bookmark it: press <strong>Ctrl/⌘ + D</strong>.</>,
    ],
  },
  desktop: {
    title: 'Install Momentum',
    steps: [
      <>Click the <strong>install icon</strong> at the right end of the address bar (a monitor with a down arrow).</>,
      <>Or open the browser menu <strong>⋮</strong> → <strong>Cast, save and share</strong> → <strong>Install page as app</strong>.</>,
    ],
  },
}

/** "Install app" control. `variant="header"` is a compact pill; `variant="card"` is a full-width button. */
export default function InstallButton({ variant = 'header' }: { variant?: 'header' | 'card' }) {
  const { installed, canPrompt, platform, promptInstall } = useInstall()
  const [help, setHelp] = useState(false)

  if (installed) {
    return variant === 'card' ? <p className="text-sm text-emerald-300">✓ You're using the installed app.</p> : null
  }

  const onClick = async () => {
    if (canPrompt) await promptInstall()
    else setHelp(true)
  }
  const guide = STEPS[platform]

  return (
    <>
      {variant === 'header' ? (
        <button onClick={onClick} title="Add Momentum to your home screen"
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-300 hover:bg-emerald-500/20 transition whitespace-nowrap">
          <span aria-hidden>📲</span>
          Install<span className="hidden sm:inline">&nbsp;app</span>
        </button>
      ) : (
        <button onClick={onClick} className={btnPrimary}>📲 {platform === 'ios' || platform === 'android' ? 'Add to home screen' : 'Install app'}</button>
      )}

      <Modal open={help} onClose={() => setHelp(false)} title={guide.title}>
        <ol className="space-y-3 mb-5">
          {guide.steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm text-slate-300">
              <span className="h-6 w-6 shrink-0 rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-semibold flex items-center justify-center">{i + 1}</span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-slate-500 mb-4">You get a home-screen icon, full-screen view and faster loading. Your data stays synced to your account.</p>
        <div className="flex justify-end">
          <button className={btnPrimary} onClick={() => setHelp(false)}>Got it</button>
        </div>
      </Modal>
    </>
  )
}
