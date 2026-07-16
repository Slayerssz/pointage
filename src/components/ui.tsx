import { useEffect, useState, type ReactNode } from 'react'

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-500">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  )
}

type ChipTone = 'slate' | 'green' | 'amber' | 'red' | 'blue'

const chipTones: Record<ChipTone, string> = {
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
}

export function Chip({
  tone = 'slate',
  children,
  title,
}: {
  tone?: ChipTone
  children: ReactNode
  title?: string
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${chipTones[tone]}`}
    >
      {children}
    </span>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-sm text-slate-500">{children}</p>
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {children}
    </div>
  )
}

/** Convertit jj/mm/aaaa → yyyy-mm-dd ; null si invalide. */
function parseFrDate(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [, d, mo, y] = m
  const day = Number(d)
  const month = Number(mo)
  const year = Number(y)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  const p = (n: number) => String(n).padStart(2, '0')
  return `${year}-${p(month)}-${p(day)}`
}

function isoToFr(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/**
 * Champ de date au format français jj/mm/aaaa, quel que soit le réglage
 * du navigateur (les <input type="date"> s'affichent dans la langue du
 * navigateur, souvent mm/dd/yyyy).
 * `value` reste au format ISO (yyyy-mm-dd) ou '' si vide.
 */
export function DateInputFr({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (iso: string) => void
  className?: string
}) {
  const [text, setText] = useState(value ? isoToFr(value) : '')
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    setText(value ? isoToFr(value) : '')
    setInvalid(false)
  }, [value])

  const handleChange = (raw: string) => {
    // N'accepter que chiffres et /, et insérer les / automatiquement
    let t = raw.replace(/[^\d/]/g, '')
    if (/^\d{2}$/.test(t) && text.length < t.length) t = t + '/'
    else if (/^\d{2}\/\d{2}$/.test(t) && text.length < t.length) t = t + '/'
    t = t.slice(0, 10)
    setText(t)

    if (t === '') {
      setInvalid(false)
      onChange('')
      return
    }
    const iso = parseFrDate(t)
    if (iso) {
      setInvalid(false)
      onChange(iso)
    }
  }

  const handleBlur = () => {
    setInvalid(text !== '' && parseFrDate(text) === null)
  }

  return (
    <div>
      <input
        type="text"
        inputMode="numeric"
        placeholder="jj/mm/aaaa"
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        className={`${className ?? ''} ${invalid ? '!border-red-400' : ''}`}
      />
      {invalid && <p className="mt-1 text-xs text-red-600">Date invalide — format jj/mm/aaaa</p>}
    </div>
  )
}

export function Pagination({
  page,
  pageCount,
  onPage,
}: {
  page: number
  pageCount: number
  onPage: (p: number) => void
}) {
  if (pageCount <= 1) return null
  return (
    <div className="flex items-center justify-between gap-2 py-3 text-sm">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 disabled:opacity-40"
      >
        ← Précédent
      </button>
      <span className="text-slate-500">
        Page {page} / {pageCount}
      </span>
      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= pageCount}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 disabled:opacity-40"
      >
        Suivant →
      </button>
    </div>
  )
}
