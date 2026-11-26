import { useMemo, useState } from 'react'
import {
  useEmployesDesAnnexes, usePointagesDesAnnexes, useRemplacementsDuMois,
} from '../lib/queries'
import { JOURS_COURTS, formatDateFr, todayIso } from '../lib/dates'
import type { Employee, Site } from '../lib/types'
import { MOIS_FR } from '../lib/dates'
import { DayCell, type CellSelection } from './PointageCellule'
import MenuCase from './MenuCase'
import BandeAnnexes from './BandeAnnexes'
import { EmptyState, ErrorNote, Spinner } from './ui'

/**
 * LA GRILLE DU MOIS, PLEIN ÉCRAN.
 *
 * On ouvre un site et l'on voit son mois entier : tout le monde, du
 * premier au dernier jour, sur une seule page. Pas de pagination, pas
 * de semaine à tourner — le mois est ce qu'on paie, c'est donc le mois
 * qu'on doit pouvoir lire d'un bout à l'autre.
 *
 * Deux volets restent en place quand on défile : la colonne des noms
 * et la ligne des dates. Sans eux, à la troisième semaine on ne sait
 * plus de qui ni de quel jour il s'agit.
 *
 * On ne pointe pas l'avenir : les jours à venir sont éteints.
 */
export default function PointageMois({
  titre,
  principalId,
  annexes,
  moisInitial,
  onClose,
  onOuvrirFiche,
}: {
  /** Ce qu'on a ouvert : le site principal, ou l'annexe esseulée. */
  titre: string
  /** Nul quand on a ouvert une annexe sans site principal. */
  principalId: string | null
  /** Les annexes dont on montre le monde. Une seule, le plus souvent. */
  annexes: Site[]
  /** Le mois ouvert au départ : { annee, mois } avec mois de 1 à 12. */
  moisInitial: { annee: number; mois: number }
  onClose: () => void
  /** Un clic sur un nom ouvre sa fiche, pour la lire et la corriger. */
  onOuvrirFiche: (employe: Employee) => void
}) {
  // L'annexe mise en avant ; nulle, on voit tout le site principal.
  const [annexeChoisie, setAnnexeChoisie] = useState<string | null>(null)
  const [recherche, setRecherche] = useState('')
  const [selection, setSelection] = useState<CellSelection | null>(null)
  const [{ annee, mois }, setMois] = useState(moisInitial)

  // On ne va pas pointer un mois qui n'a pas commencé.
  const maintenant = new Date()
  const moisCourant = { annee: maintenant.getFullYear(), mois: maintenant.getMonth() + 1 }
  const auMoisCourant = annee === moisCourant.annee && mois === moisCourant.mois
  const decalerMois = (pas: number) => setMois(({ annee: a, mois: m }) => {
    const d = new Date(a, m - 1 + pas, 1)
    return { annee: d.getFullYear(), mois: d.getMonth() + 1 }
  })

  const premier = `${annee}-${String(mois).padStart(2, '0')}-01`
  const dernier = useMemo(() => {
    const d = new Date(annee, mois, 0)
    return `${annee}-${String(mois).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [annee, mois])

  const jours = useMemo(() => {
    const n = new Date(annee, mois, 0).getDate()
    return Array.from({ length: n }, (_, i) =>
      `${annee}-${String(mois).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`)
  }, [annee, mois])

  // Le mois affiché décide de qui doit y figurer : quelqu'un parti
  // depuis reste sur le mois qu'il a travaillé.
  const idsAnnexes = annexes.map((a) => a.id)
  const employes = useEmployesDesAnnexes(idsAnnexes, true, { depuis: premier })
  const pointages = usePointagesDesAnnexes(idsAnnexes, premier, dernier, true)
  // Qui a été couvert, quel jour, et par qui.
  const remplacements = useRemplacementsDuMois(premier, dernier, true)

  const today = todayIso()
  const q = recherche.trim().toLowerCase()
  const surLAnnexe = (employes.data ?? []).filter(
    (e) => !annexeChoisie || e.site_id === annexeChoisie,
  )
  const lignes = surLAnnexe.filter(
    (e) => !q
      || e.nom_prenom.toLowerCase().includes(q)
      || String(e.matricule ?? '').includes(q),
  )

  const enChargement = employes.isLoading || pointages.isLoading
  const erreur = employes.error ?? pointages.error

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
      {/* ── La barre : où l'on est, qui l'on cherche, comment on sort ── */}
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-slate-900">{titre}</h1>
          <p className="text-xs text-slate-500">
            {lignes.length} employé(s)
            {lignes.length !== (employes.data ?? []).length
              && ` sur ${(employes.data ?? []).length}`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => decalerMois(-1)}
            aria-label="Mois précédent"
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            ‹
          </button>
          <span className="min-w-36 text-center text-sm font-medium text-slate-700">
            {MOIS_FR[mois - 1]} {annee}
          </span>
          <button
            onClick={() => decalerMois(1)}
            disabled={auMoisCourant}
            aria-label="Mois suivant"
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            ›
          </button>
        </div>

        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Chercher un agent…"
          className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-64"
        />

        <button
          onClick={onClose}
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Fermer
        </button>
      </header>

      {/* ── La grille ──────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-auto">
        {enChargement && <Spinner label="Chargement du mois…" />}
        {erreur && (
          <div className="p-4">
            <ErrorNote>Erreur : {erreur.message}</ErrorNote>
          </div>
        )}
        {!enChargement && !erreur && lignes.length === 0 && (
          <EmptyState>
            {q ? 'Personne de ce nom sur ce site.' : 'Aucun employé affecté à ce site.'}
          </EmptyState>
        )}

        {!enChargement && !erreur && lignes.length > 0 && (
          <table className="border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                {/* Le coin : il couvre les deux volets, donc il passe
                    devant l'un et l'autre. */}
                <th className="sticky top-0 left-0 z-30 min-w-56 border-r border-b border-slate-200 bg-white px-4 py-2 text-left text-xs font-medium text-slate-500">
                  Employé
                </th>
                {jours.map((d) => {
                  const jourSemaine = JOURS_COURTS[(new Date(d + 'T12:00:00').getDay() + 6) % 7]
                  const futur = d > today
                  return (
                    <th
                      key={d}
                      className={`sticky top-0 z-20 w-10 border-b border-slate-200 bg-white px-1 py-2 text-center text-[11px] font-medium ${
                        d === today
                          ? 'text-emerald-600'
                          : futur ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {jourSemaine.slice(0, 1)}
                      <br />
                      {d.slice(8, 10)}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {lignes.map((emp) => {
                const empDays = pointages.data?.get(emp.id)
                return (
                  <tr key={emp.id} className="group">
                    <th className="sticky left-0 z-10 min-w-56 border-r border-b border-slate-100 bg-white px-4 py-1.5 text-left font-normal group-hover:bg-slate-50">
                      <button
                        onClick={() => onOuvrirFiche(emp)}
                        title="Ouvrir sa fiche"
                        className="block w-full truncate text-left"
                      >
                        <span className="block truncate text-sm font-medium text-slate-900 underline-offset-2 hover:underline">
                          {emp.nom_prenom}
                        </span>
                        <span className="block truncate text-xs text-slate-400">
                          {emp.matricule != null ? `Mat. ${emp.matricule}` : '—'}
                          {emp.qualification ? ` · ${emp.qualification}` : ''}
                        </span>
                      </button>
                    </th>
                    {jours.map((d) => (
                      <td
                        key={d}
                        className="border-b border-slate-100 px-0.5 py-1 text-center group-hover:bg-slate-50"
                      >
                        <DayCell
                          pointage={empDays?.get(d) ?? null}
                          isFuture={d > today}
                          remplacant={remplacements.data?.get(emp.id)?.get(d) ?? null}
                          sorti={Boolean(emp.date_sortie) && d > emp.date_sortie!}
                          onClick={() => {
                            if (d > today) return
                            setSelection({
                              employee: emp,
                              // La case appartient à l'annexe de la personne,
                              // qui n'est pas forcément celle qu'on regarde.
                              site: annexes.find((a) => a.id === emp.site_id) ?? annexes[0],
                              date: d,
                              pointage: empDays?.get(d) ?? null,
                            })
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <BandeAnnexes
        principalId={principalId}
        annexes={annexes}
        choisie={annexeChoisie}
        onChoisir={setAnnexeChoisie}
        employes={employes.data ?? []}
      />

      <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
        Du {formatDateFr(premier)} au {formatDateFr(dernier)}. Les jours à venir ne se
        pointent pas.
      </footer>

      {selection && (
        <MenuCase
          employee={selection.employee}
          site={selection.site}
          date={selection.date}
          pointage={selection.pointage}
          remplacant={
            remplacements.data?.get(selection.employee.id)?.get(selection.date) ?? null
          }
          onFerme={() => setSelection(null)}
        />
      )}
    </div>
  )
}
