import { useState, type ReactNode } from 'react'
import type { Site, SitePrincipal } from '../lib/types'

const ICON_PRINCIPAL = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
    <path d="M3 21h18M5 21V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14M9 9h2m2 0h2M9 13h2m2 0h2M9 17h2m2 0h2" />
  </svg>
)

const ICON_ANNEXE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
)

function Chevron({ ouvert }: { ouvert: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${ouvert ? 'rotate-180' : ''}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

interface Props {
  /** Les annexes : c'est là que sont rattachés les employés. */
  sites: Site[]
  /** Les sites principaux qui les regroupent. */
  principaux: SitePrincipal[]
  /** Contenu affiché quand une annexe est dépliée (la liste des employés). */
  renderSite: (site: Site, expanded: boolean) => ReactNode
}

/**
 * Navigation à deux niveaux :
 *   on ouvre un site principal → ses annexes apparaissent
 *   on ouvre une annexe        → ses employés apparaissent
 *
 * Tant qu'aucun site principal n'existe, les annexes s'affichent
 * directement, comme avant : l'écran reste utilisable.
 * Le contenu d'une annexe n'est monté (donc chargé) qu'à son ouverture.
 */
export default function SitesTree({ sites, principaux, renderSite }: Props) {
  const [ouvertsPrincipaux, setOuvertsPrincipaux] = useState<Set<string>>(new Set())
  const [ouvertesAnnexes, setOuvertesAnnexes] = useState<Set<string>>(new Set())

  const basculer = (setter: typeof setOuvertsPrincipaux) => (id: string) =>
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const basculerPrincipal = basculer(setOuvertsPrincipaux)
  const basculerAnnexe = basculer(setOuvertesAnnexes)

  const annexeItem = (site: Site, imbriquee: boolean) => {
    const ouverte = ouvertesAnnexes.has(site.id)
    return (
      <div
        key={site.id}
        className={
          imbriquee
            ? 'overflow-hidden border-t border-slate-100'
            : 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm'
        }
      >
        <button
          onClick={() => basculerAnnexe(site.id)}
          aria-expanded={ouverte}
          className={`flex w-full items-center justify-between gap-3 text-left ${
            imbriquee ? 'bg-slate-50/60 px-4 py-3 pl-12 hover:bg-slate-100/70' : 'px-4 py-3.5'
          }`}
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
              {ICON_ANNEXE}
            </span>
            <span className="truncate font-medium text-slate-900">{site.name}</span>
          </span>
          <Chevron ouvert={ouverte} />
        </button>
        {ouverte && <div className="border-t border-slate-100 bg-white">{renderSite(site, ouverte)}</div>}
      </div>
    )
  }

  // Aucun site principal défini : on garde l'affichage simple d'avant.
  if (principaux.length === 0) {
    return <div className="space-y-2">{sites.map((s) => annexeItem(s, false))}</div>
  }

  const groupes = principaux
    .map((p) => ({ principal: p, annexes: sites.filter((s) => s.site_principal_id === p.id) }))
    .filter((g) => g.annexes.length > 0)

  const orphelines = sites.filter(
    (s) => !s.site_principal_id || !principaux.some((p) => p.id === s.site_principal_id),
  )

  return (
    <div className="space-y-2">
      {groupes.map(({ principal, annexes }) => {
        const ouvert = ouvertsPrincipaux.has(principal.id)
        return (
          <div
            key={principal.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <button
              onClick={() => basculerPrincipal(principal.id)}
              aria-expanded={ouvert}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
                  {ICON_PRINCIPAL}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-slate-900">{principal.name}</span>
                  <span className="block text-xs text-slate-500">
                    {annexes.length} annexe{annexes.length > 1 ? 's' : ''}
                  </span>
                </span>
              </span>
              <Chevron ouvert={ouvert} />
            </button>
            {ouvert && <div>{annexes.map((s) => annexeItem(s, true))}</div>}
          </div>
        )
      })}

      {orphelines.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-white shadow-sm">
          <button
            onClick={() => basculerPrincipal('__orphelines__')}
            aria-expanded={ouvertsPrincipaux.has('__orphelines__')}
            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                {ICON_ANNEXE}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold text-slate-700">
                  Annexes non rattachées
                </span>
                <span className="block text-xs text-slate-500">
                  {orphelines.length} annexe{orphelines.length > 1 ? 's' : ''} sans site principal
                </span>
              </span>
            </span>
            <Chevron ouvert={ouvertsPrincipaux.has('__orphelines__')} />
          </button>
          {ouvertsPrincipaux.has('__orphelines__') && (
            <div>{orphelines.map((s) => annexeItem(s, true))}</div>
          )}
        </div>
      )}
    </div>
  )
}
