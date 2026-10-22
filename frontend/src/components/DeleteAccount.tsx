import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Modal, inputCls, btnGhost } from './ui'

const CONFIRM_WORD = 'DELETE'

/** Danger-zone control: permanently deletes the signed-in user's account and all their data. */
export default function DeleteAccount() {
  const { user, signOut } = useAuth()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    if (busy) return
    setOpen(false)
    setTyped('')
    setError(null)
  }

  async function remove() {
    if (!supabase) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('delete_my_account')
    if (error) {
      setError(error.message)
      setBusy(false)
      return
    }
    qc.clear()
    // The account no longer exists, so just drop the local session.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    await signOut().catch(() => {})
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-100">Delete account</p>
          <p className="text-sm text-slate-400">Permanently remove your account, activities, logs, records and settings. This can't be undone.</p>
        </div>
        <button onClick={() => setOpen(true)}
          className="text-sm rounded-lg border border-rose-500/60 px-3 py-1.5 text-rose-400 hover:bg-rose-500/10 whitespace-nowrap">
          Delete account…
        </button>
      </div>

      <Modal open={open} onClose={close} title="Delete your account?">
        <div className="space-y-4">
          <p className="text-slate-300">
            This permanently deletes <strong>{user?.email ?? 'your account'}</strong> and everything in it:
          </p>
          <ul className="text-sm text-slate-400 list-disc pl-5 space-y-1">
            <li>All activities and every logged session</li>
            <li>Streaks, personal records and mood history</li>
            <li>Your settings and email notifications</li>
          </ul>
          <p className="text-sm text-slate-400">There is no backup and no undo. You can sign up again later, but you'll start from scratch.</p>
          <label className="block">
            <span className="block text-sm text-slate-300 mb-1">Type <strong className="text-rose-400">{CONFIRM_WORD}</strong> to confirm</span>
            <input className={inputCls} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" />
          </label>
          {error && <p className="text-sm text-rose-400" role="alert">{error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button className={btnGhost} onClick={close} disabled={busy}>Cancel</button>
            <button
              className="rounded-lg bg-rose-500 px-4 py-2 font-medium text-white hover:bg-rose-400 disabled:opacity-50"
              disabled={busy || typed.trim().toUpperCase() !== CONFIRM_WORD}
              onClick={remove}
            >
              {busy ? 'Deleting…' : 'Delete forever'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
