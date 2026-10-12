import { useState } from 'react'
import { randomQuote } from '../lib/quotes'

export default function QuoteCard() {
  const [quote, setQuote] = useState(() => randomQuote())
  const [spin, setSpin] = useState(0)

  return (
    <section
      aria-label="Motivational quote"
      className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-slate-800/60 to-slate-800/60 px-5 py-4 sm:px-6 sm:py-5"
    >
      <span aria-hidden className="pointer-events-none absolute top-1 left-3 text-7xl font-serif leading-[0.9] text-emerald-400/20 select-none">
        “
      </span>
      <div className="relative flex items-start gap-4 pl-9 sm:pl-10">
        <figure className="min-w-0 flex-1" aria-live="polite">
          <blockquote className="text-base sm:text-lg font-medium leading-snug text-slate-100">{quote.text}</blockquote>
          <figcaption className="mt-2 text-sm text-emerald-300">— {quote.author}</figcaption>
        </figure>
        <button
          type="button"
          onClick={() => {
            setQuote((q) => randomQuote(q))
            setSpin((s) => s + 1)
          }}
          className="shrink-0 h-9 w-9 rounded-full text-slate-400 hover:text-white hover:bg-slate-700/60 transition"
          aria-label="Show another quote"
          title="Another quote"
        >
          <span className="inline-block transition-transform duration-500" style={{ transform: `rotate(${spin * 360}deg)` }} aria-hidden>
            ↻
          </span>
        </button>
      </div>
    </section>
  )
}
