import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { usePeutPointer } from '../../lib/queries'
import { useParams } from 'react-router-dom'
import { useSites, useSitesPrincipaux } from '../../lib/queries'
import type { Employee, Site } from '../../lib/types'
import {
  TYPES_ABSENCE,
  TYPES_FERIE,
  TYPES_REPOS,
  TYPES_TRAVAIL,
} from '../../lib/gardes'
import SitesTree from '../../components/SitesTree'
import PointageMois from '../../components/PointageMois'
import { FicheEmployeModal } from './EmployesPage'
import { EmptyState, ErrorNote, Spinner } from '../../components/ui'
import ValidationMois from './ValidationMois'

export default function ValidationPage() {
  const { companyId } = useParams()
  const { profile } = useAuth()
  // Le personnel peut arriver ici par l'adresse : l'écran se referme de
  // lui-même sur une société qu'on ne lui a pas confiée. La base
  // refuserait de toute façon les écritures ; autant le dire ici.
  const { data: peutPointer, isLoading: droitEnCours } = usePeutPointer(companyId)
  const { data: sites, isLoading, error } = useSites(companyId, { pointageOnly: true })
  const { data: principaux } = useSitesPrincipaux(companyId)
  // Le site ouvert en plein écran, et la fiche qu'on y a demandée.
  const [siteOuvert, setSiteOuvert] = useState<Site | null>(null)
  const [fiche, setFiche] = useState<Employee | null>(null)
  const [recherche, setRecherche] = useState('')

  const maintenant = new Date()
  const moisCourant = { annee: maintenant.getFullYear(), mois: maintenant.getMonth() + 1 }

  if (droitEnCours) return <Spinner label="Ouverture du pointage…" />
  if (peutPointer === false) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <p className="text-sm font-medium text-slate-700">
          Le pointage de cette société ne vous a pas été confié.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          L’administrateur peut vous y donner accès depuis votre compte, dans
          Utilisateurs.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Pointage</h1>
        <p className="text-sm text-slate-500">
          Ouvrez un site : son mois entier s’affiche, tout le monde et tous les jours.
        </p>
      </div>

      {/* Clôture du mois → bascule vers La Paie */}
      {/* Valider le mois reste au bureau : le personnel pointe, il ne
          clôture pas. Lui montrer le pavé serait lui promettre un geste
          que la base refusera. */}
      {profile?.role !== 'rh' && <ValidationMois companyId={companyId} />}

      {/* Légende */}
      <div className="mb-5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600">
        {[...TYPES_TRAVAIL, ...TYPES_REPOS, ...TYPES_FERIE, ...TYPES_ABSENCE].map((t) => (
          <LegendItem key={t.code} cls={t.couleur} sym={t.symbole}>
            {t.label}
          </LegendItem>
        ))}
        <LegendItem cls="bg-amber-400 text-white" sym="!">Photo à valider</LegendItem>
        <LegendItem cls="bg-red-500 text-white" sym="✕">Refusé</LegendItem>
        <LegendItem cls="bg-slate-200 text-slate-500" sym="–">Absent</LegendItem>
      </div>

      {isLoading && <Spinner label="Chargement des sites…" />}
      {error && <ErrorNote>Impossible de charger les sites : {error.message}</ErrorNote>}
      {sites && sites.length === 0 && <EmptyState>Aucun site pour cette entreprise.</EmptyState>}

      {sites && sites.length > 0 && (
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Chercher un site…"
          className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:max-w-sm"
        />
      )}

      {sites && (
        <SitesTree
          sites={sites}
          principaux={principaux ?? []}
          recherche={recherche}
          onSiteClick={setSiteOuvert}
        />
      )}

      {siteOuvert && (
        <PointageMois
          site={siteOuvert}
          moisInitial={moisCourant}
          onOuvrirFiche={setFiche}
          onClose={() => setSiteOuvert(null)}
        />
      )}

      {/* La fiche s'ouvre par-dessus la grille : on corrige, on referme,
          et l'on reprend le pointage où on l'avait laissé. */}
      {fiche && companyId && (
        <FicheEmployeModal
          companyId={companyId}
          employee={fiche}
          onClose={() => setFiche(null)}
        />
      )}
    </div>
  )
}

function LegendItem({ cls, sym, children }: { cls: string; sym: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`flex h-4 w-6 items-center justify-center rounded text-[10px] font-bold ${cls}`}>
        {sym}
      </span>
      {children}
    </span>
  )
}
