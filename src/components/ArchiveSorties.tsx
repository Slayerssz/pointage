import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { formatDateFr } from '../lib/dates'
import { MOIS_FR } from '../lib/paie'
import { useAuth } from '../contexts/AuthContext'
import { Chip, EmptyState, ErrorNote, Spinner } from './ui'

/**
 * L'ARCHIVE DES DÉPARTS.
 *
 * Ce que la clôture du mois emporte atterrit ici. Rien n'est supprimé :
 * la fiche garde ses pointages, ses contrats et ses bulletins de paie,
 * elle a seulement quitté les listes de tous les jours.
 *
 * L'administrateur peut ramener quelqu'un au registre — une erreur de
 * clôture, un salarié qui revient.
 */

interface Archive {
  id: string
  matricule: number | null
  nom_prenom: string
  cin: string | null
  qualification: string | null
  date_embauche: string | null
  date_sortie: string | null
  archive_le: string
  site: { name: string } | null
}

function useArchives(companyId: string | undefined) {
  return useQuery({
    queryKey: ['archives-sorties', companyId],
    enabled: Boolean(companyId),
    queryFn: async (): Promise<Archive[]> => {
      const { data, error } = await supabase
        .from('employees')
        .select(
          'id, matricule, nom_prenom, cin, qualification, date_embauche, date_sortie, archive_le, site:sites(name)',
        )
        .eq('company_id', companyId!)
        .not('archive_le', 'is', null)
        .order('date_sortie', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Archive[]
    },
  })
}

function useDesarchiver(companyId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('desarchiver_employe', { p_employee: id })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['archives-sorties', companyId] })
      qc.invalidateQueries({ queryKey: ['employees'] })
      qc.invalidateQueries({ queryKey: ['sorties'] })
    },
  })
}

/** Le mois d'archivage, tel qu'on le lit : « mars 2026 ». */
function moisDe(iso: string): string {
  const d = new Date(iso)
  return `${MOIS_FR[d.getMonth()]} ${d.getFullYear()}`
}

export default function ArchiveSorties({ companyId }: { companyId: string | undefined }) {
  const { profile } = useAuth()
  const { data: archives, isLoading } = useArchives(companyId)
  const desarchiver = useDesarchiver(companyId)
  const [ouvert, setOuvert] = useState(false)
  const [recherche, setRecherche] = useState('')

  const total = archives?.length ?? 0

  const filtrees = (archives ?? []).filter((a) => {
    const q = recherche.trim().toLowerCase()
    if (!q) return true
    return (
      a.nom_prenom.toLowerCase().includes(q) ||
      String(a.matricule ?? '').includes(q) ||
      (a.cin ?? '').toLowerCase().includes(q)
    )
  })

  // Regroupées par mois de clôture : c'est ainsi qu'on les cherche.
  const parMois = new Map<string, Archive[]>()
  for (const a of filtrees) {
    const cle = moisDe(a.archive_le)
    if (!parMois.has(cle)) parMois.set(cle, [])
    parMois.get(cle)!.push(a)
  }

  return (
    <section className="mt-8 rounded-xl border border-slate-200 bg-white">
      <button
        onClick={() => setOuvert((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span>
          <span className="block text-sm font-semibold tracking-wide text-slate-700 uppercase">
            Archives des départs
          </span>
          <span className="mt-0.5 block text-xs text-slate-500">
            Les fiches retirées du registre aux clôtures de fin de mois. Rien n’est supprimé.
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <Chip tone="slate">{total}</Chip>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`h-4 w-4 text-slate-400 transition ${ouvert ? 'rotate-180' : ''}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>

      {ouvert && (
        <div className="border-t border-slate-100 px-4 py-4">
          {isLoading && <Spinner label="Chargement des archives…" />}

          {archives && total === 0 && (
            <EmptyState>
              Aucune fiche archivée. Les départs validés y arrivent à la clôture du mois.
            </EmptyState>
          )}

          {total > 0 && (
            <>
              <input
                type="search"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Chercher un nom, un matricule, une C.I.N."
                className="mb-4 w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />

              {desarchiver.error && (
                <div className="mb-3">
                  <ErrorNote>{desarchiver.error.message}</ErrorNote>
                </div>
              )}

              {filtrees.length === 0 && (
                <p className="text-sm text-slate-500">Personne ne correspond à cette recherche.</p>
              )}

              {[...parMois.entries()].map(([mois, gens]) => (
                <div key={mois} className="mb-5 last:mb-0">
                  <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    Clôture de {mois} · {gens.length} fiche{gens.length > 1 ? 's' : ''}
                  </p>
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {gens.map((a) => (
                      <li
                        key={a.id}
                        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-slate-800">
                            {a.matricule != null && (
                              <span className="mr-2 text-slate-400 tabular-nums">{a.matricule}</span>
                            )}
                            {a.nom_prenom}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {a.qualification ?? '—'}
                            {a.site?.name ? ` · ${a.site.name}` : ''}
                            {a.cin ? ` · C.I.N. ${a.cin}` : ''}
                          </span>
                        </span>
                        <span className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="text-right">
                            {a.date_embauche && (
                              <span className="block">
                                Entré le {formatDateFr(a.date_embauche)}
                              </span>
                            )}
                            {a.date_sortie && (
                              <span className="block font-medium text-slate-700">
                                Parti le {formatDateFr(a.date_sortie)}
                              </span>
                            )}
                          </span>
                          {profile?.role === 'admin' && (
                            <button
                              onClick={() => desarchiver.mutate(a.id)}
                              disabled={desarchiver.isPending}
                              className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                              title="Ramener cette fiche au registre des employés"
                            >
                              Restaurer
                            </button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </section>
  )
}
