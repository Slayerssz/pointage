import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { computeAge, formatDateFr, jourDeReposLabel } from '../lib/dates'
import { formatDH } from '../lib/paie'
import { contratStatut } from '../lib/contrats'
import type { ContratCourant, Employee } from '../lib/types'

/**
 * FICHE D'EMPLOYÉ imprimable — une par page.
 *
 * Contient l'identité, l'état civil, le poste, le contrat et le salaire.
 * Les DETTES n'y figurent jamais : ce document circule, elles restent
 * à l'écran, dans le dossier de l'employé.
 */
export default function FichePrint({
  employees,
  entreprise,
  sites,
  contrats,
  onClose,
}: {
  employees: Employee[]
  entreprise: string
  sites: { id: string; name: string }[]
  contrats: Map<string, ContratCourant> | undefined
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    document.body.classList.add('impression')
    return () => document.body.classList.remove('impression')
  }, [])

  // Une seule requête pour toutes les photos des fiches à imprimer
  const chemins = employees.map((e) => e.photo_path).filter((p): p is string => Boolean(p))
  const { data: photos } = useQuery({
    queryKey: ['photos-fiches', chemins],
    enabled: chemins.length > 0,
    queryFn: async (): Promise<Map<string, string>> => {
      const { data, error } = await supabase.storage.from('photos').createSignedUrls(chemins, 3600)
      if (error) throw error
      const m = new Map<string, string>()
      for (const r of data) if (r.path && r.signedUrl) m.set(r.path, r.signedUrl)
      return m
    },
  })

  const siteName = (id: string) => sites.find((s) => s.id === id)?.name ?? '—'

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-800/60 print:static print:bg-white">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-slate-900 px-4 py-3 print:hidden">
        <p className="text-sm font-medium text-white">
          {employees.length === 1
            ? `Fiche — ${employees[0].nom_prenom}`
            : `${employees.length} fiches d’employé`}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Imprimer / Enregistrer en PDF
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            Fermer
          </button>
        </div>
      </div>

      <div className="document-imprimable">
        {employees.map((e, i) => {
          const contrat = contrats?.get(e.id)
          const statut = contrat ? contratStatut(contrat.date_debut, contrat.date_fin) : null
          const photo = e.photo_path ? photos?.get(e.photo_path) : undefined
          return (
            <article
              key={e.id}
              className={`mx-auto my-6 max-w-[210mm] bg-white p-[16mm] text-[10.5pt] leading-relaxed text-black shadow-xl print:my-0 print:max-w-none print:p-0 print:shadow-none ${
                i < employees.length - 1 ? 'print:break-after-page' : ''
              }`}
            >
              <header className="mb-6 flex items-start justify-between gap-6 border-b-2 border-black pb-4">
                <div>
                  <h1 className="text-base font-bold uppercase tracking-wide">{entreprise}</h1>
                  <p className="mt-1 text-lg font-bold uppercase">Fiche d’employé</p>
                  <p className="mt-1 text-sm">
                    Matricule n° <strong>{e.matricule ?? '—'}</strong>
                  </p>
                </div>
                <div className="h-28 w-24 shrink-0 overflow-hidden border border-black bg-white">
                  {photo ? (
                    <img src={photo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-center text-[8pt] text-slate-400">
                      Photo
                    </div>
                  )}
                </div>
              </header>

              <Bloc titre="Identité">
                <Ligne label="Nom et prénom" valeur={e.nom_prenom} fort />
                <Ligne label="C.I.N." valeur={e.cin ?? '—'} />
                <Ligne label="N° CNSS" valeur={e.cnss ?? '—'} />
                <Ligne
                  label="Date de naissance"
                  valeur={
                    e.date_naissance
                      ? `${formatDateFr(e.date_naissance)} (${computeAge(e.date_naissance)} ans)`
                      : '—'
                  }
                />
                <Ligne label="Situation familiale" valeur={e.situation_familiale ?? '—'} />
                <Ligne label="Nombre d’enfants" valeur={String(e.nombre_enfants ?? 0)} />
                <Ligne label="Téléphone" valeur={e.telephone ?? '—'} />
                <Ligne label="Adresse" valeur={[e.adresse, e.ville].filter(Boolean).join(', ') || '—'} />
              </Bloc>

              <Bloc titre="Poste">
                <Ligne label="Qualification" valeur={e.qualification ?? '—'} fort />
                <Ligne label="Site d’affectation" valeur={siteName(e.site_id)} />
                <Ligne label="Date d’embauche" valeur={formatDateFr(e.date_embauche)} />
                <Ligne label="Jour de repos" valeur={jourDeReposLabel(e.jour_de_repos)} />
                <Ligne label="Heures par jour" valeur={e.heures_par_jour != null ? `${e.heures_par_jour} h` : '—'} />
                <Ligne
                  label="Statut"
                  valeur={e.actif ? 'En poste' : `Sorti le ${formatDateFr(e.date_sortie)}`}
                />
              </Bloc>

              <Bloc titre="Contrat">
                {contrat ? (
                  <>
                    <Ligne label="Type" valeur={contrat.type_contrat} fort />
                    <Ligne label="Numéro" valeur={contrat.numero ?? '—'} />
                    <Ligne label="Date de début" valeur={formatDateFr(contrat.date_debut)} />
                    <Ligne
                      label="Date de fin"
                      valeur={contrat.date_fin ? formatDateFr(contrat.date_fin) : 'Durée indéterminée'}
                    />
                    <Ligne
                      label="État"
                      valeur={
                        statut === 'termine'
                          ? 'Terminé'
                          : statut === 'bientot'
                            ? `Se termine dans ${contrat.jours_restants} jour(s)`
                            : 'En cours'
                      }
                    />
                  </>
                ) : (
                  <p className="py-1 text-sm italic">Aucun contrat enregistré.</p>
                )}
              </Bloc>

              <Bloc titre="Rémunération">
                <Ligne label="Salaire mensuel" valeur={formatDH(e.salaire)} fort />
                <Ligne label="Mode de règlement" valeur={e.mode_reglement ?? '—'} />
                <Ligne label="Banque" valeur={e.banque ?? '—'} />
                <Ligne label="RIB" valeur={e.rib ?? '—'} />
              </Bloc>

              <div className="mt-10 flex justify-between gap-8">
                <div className="w-1/2 text-center">
                  <p className="mb-14 text-sm font-semibold">L’Employeur</p>
                  <p className="border-t border-black pt-1 text-xs">{entreprise}</p>
                </div>
                <div className="w-1/2 text-center">
                  <p className="mb-14 text-sm font-semibold">Le Salarié</p>
                  <p className="border-t border-black pt-1 text-xs">{e.nom_prenom}</p>
                </div>
              </div>

              <p className="mt-6 text-center text-[8pt] text-slate-500">
                Fiche éditée le {new Date().toLocaleDateString('fr-FR')}
              </p>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 break-inside-avoid">
      <h2 className="mb-2 border-b border-black text-[9pt] font-bold uppercase tracking-widest">
        {titre}
      </h2>
      <dl>{children}</dl>
    </section>
  )
}

function Ligne({ label, valeur, fort }: { label: string; valeur: string; fort?: boolean }) {
  return (
    <div className="flex gap-3 border-b border-slate-200 py-1">
      <dt className="w-52 shrink-0 text-slate-600">{label}</dt>
      <dd className={fort ? 'font-semibold' : ''}>{valeur}</dd>
    </div>
  )
}
