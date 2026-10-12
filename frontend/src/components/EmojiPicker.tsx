import { useMemo, useState } from 'react'
import { ALL_EMOJIS, EMOJI_GROUPS } from '../lib/emojis'
import { inputCls } from './ui'

/** Words in the text that match an emoji's keywords, best matches first. */
function matches(text: string, limit = 24): string[] {
  const words = text.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 2)
  if (!words.length) return []
  const scored = ALL_EMOJIS.map(([e, kw]) => {
    const keys = kw.split(' ')
    const score = words.reduce((s, w) => s + (keys.includes(w) ? 3 : keys.some((k) => k.startsWith(w) || (w.length >= 4 && w.startsWith(k))) ? 1 : 0), 0)
    return { e, score }
  }).filter((x) => x.score > 0)
  scored.sort((a, b) => b.score - a.score)
  return [...new Set(scored.map((x) => x.e))].slice(0, limit)
}

function Grid({ emojis, value, onPick }: { emojis: string[]; value: string; onPick: (e: string) => void }) {
  return (
    <div className="grid grid-cols-8 sm:grid-cols-10 gap-1">
      {emojis.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => onPick(e)}
          aria-label={`Use ${e}`}
          aria-pressed={e === value}
          className={`h-9 rounded-lg text-xl leading-none transition hover:bg-slate-700 ${e === value ? 'bg-emerald-500/20 ring-1 ring-emerald-500' : ''}`}
        >
          {e}
        </button>
      ))}
    </div>
  )
}

/** Inline emoji panel: name-based suggestions, search, categories, plus a box for any custom emoji. */
export default function EmojiPicker({ value, onChange, hint, onClose }: { value: string; onChange: (e: string) => void; hint: string; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState(EMOJI_GROUPS[0].name)
  const suggested = useMemo(() => matches(hint, 10), [hint])
  const results = useMemo(() => (query.trim() ? matches(query, 40) : null), [query])

  const pick = (e: string) => {
    onChange(e)
    onClose()
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-3 space-y-3">
      <div className="flex gap-2">
        <input
          autoFocus
          className={`${inputCls} !py-1.5 text-sm`}
          placeholder="Search emojis… (run, read, water)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (results?.[0]) pick(results[0])
            }
          }}
        />
        <button type="button" onClick={onClose} className="shrink-0 px-2 text-slate-400 hover:text-white" aria-label="Close emoji picker">✕</button>
      </div>

      {results ? (
        results.length ? <Grid emojis={results} value={value} onPick={pick} /> : <p className="text-sm text-slate-400 py-2">No match. Paste any emoji in the box below.</p>
      ) : (
        <>
          {suggested.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 mb-1.5">Suggested for “{hint.trim()}”</p>
              <Grid emojis={suggested} value={value} onPick={pick} />
            </div>
          )}
          <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist">
            {EMOJI_GROUPS.map((g) => (
              <button key={g.name} type="button" role="tab" aria-selected={group === g.name} onClick={() => setGroup(g.name)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs border transition ${
                  group === g.name ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300' : 'border-slate-700 text-slate-400 hover:text-white'
                }`}>
                {g.items[0][0]} {g.name}
              </button>
            ))}
          </div>
          <div className="max-h-48 overflow-y-auto">
            <Grid emojis={EMOJI_GROUPS.find((g) => g.name === group)!.items.map(([e]) => e)} value={value} onPick={pick} />
          </div>
        </>
      )}

      <label className="flex items-center gap-2 text-xs text-slate-400 border-t border-slate-700/60 pt-3">
        Or type / paste your own:
        <input className={`${inputCls} !w-16 !py-1 text-center text-lg`} value={value} maxLength={8} onChange={(e) => onChange(e.target.value)} aria-label="Custom emoji" />
      </label>
    </div>
  )
}
