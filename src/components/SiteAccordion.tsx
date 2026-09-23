import { useState, type ReactNode } from 'react'
import type { Site } from '../lib/types'

interface Props {
  sites: Site[]
  renderSite: (site: Site, expanded: boolean) => ReactNode
}

/** Liste de sites dépliables ; le contenu n'est monté (et donc chargé) qu'à l'ouverture. */
export default function SiteAccordion({ sites, renderSite }: Props) {
  const [open, setOpen] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-2">
      {sites.map((site) => {
        const expanded = open.has(site.id)
        return (
          <div key={site.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <button
              onClick={() => toggle(site.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
              aria-expanded={expanded}
            >
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </span>
                <span className="font-medium text-slate-900">{site.name}</span>
              </span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {expanded && <div className="border-t border-slate-100">{renderSite(site, expanded)}</div>}
          </div>
        )
      })}
    </div>
  )
}
