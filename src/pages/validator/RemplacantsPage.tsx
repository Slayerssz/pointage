import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { MOIS_FR, formatDateFr } from '../../lib/dates'
import { formatDH } from '../../lib/montants'
import { lireNombre } from '../../lib/nombreSaisi'
import { ChampDecimal, EmptyState, ErrorNote, Spinner } from '../../components/ui'
import { champsManquants } from '../../lib/ficheIncomplete'

/**
 * LES REMPLAÇANTS.
 *
 * Ils ne travaillent pour aucune société : ils vont où l'on a besoin
 * d'eux. La liste est donc la même depuis n'importe quel compte du
 * groupe — on tient une seule fiche par personne, et non une par
 * société comme c'était devenu l'usage.
 *
 * Chacun a son tableau de paie du mois : les journées qu'il a tenues,
 * chez qui, et ce qu'elles valent. Le montant d'une journée est figé
 * au moment où on la pose dans le pointage ; le relire ici ne le
 * recalcule pas.
 */

interface Remplacant {
  id: string
  matricule: number | null
  nom_prenom: string
  cin: string | null
  cnss: string | null
  date_naissance: string | null
  telephone: string | null
  adresse: string | null
  ville: string | null
  qualification: string | null
  mode_reglement: string | null
  banque: string | null
  rib: string | null
  tarif_journalier: number | null
  actif: boolean
}

interface LignePaie {
  remplacant_id: string
  matricule: number | null
  nom_prenom: string
  mode_reglement: string | null
  banque: string | null
  rib: string | null
  jours: number
  montant: number
  par_societe: { societe: string; montant: number; date: string }[]
}

export default function RemplacantsPage() {
  const qc = useQueryClient()
  const maintenant = new Date()
  const [annee, setAnnee] = useState(maintenant.getFullYear())
  const [mois, setMois] = useState(maintenant.getMonth() + 1)
  const [recherche, setRecherche] = useState('')
  const [depuisEmploye, setDepuisEmploye] = useState(false)
  const [fiche, setFiche] = useState<Remplacant | null | 'nouveau'>(null)
  const [deplie, setDeplie] = useState<string | null>(null)

  const { data: liste, isLoading } = useQuery({
    queryKey: ['remplacants-fiches'],
    queryFn: async (): Promise<Remplacant[]> => {
      const { data, error } = await supabase
        .from('remplacants').select('*').is('archive_le', null).order('nom_prenom')
      if (error) throw error
      return data as Remplacant[]
    },
  })

  const { data: paie } = useQuery({
    queryKey: ['paie-remplacants', annee, mois],
    queryFn: async (): Promise<LignePaie[]> => {
      const { data, error } = await supabase.rpc('paie_remplacants', {
        p_annee: annee, p_mois: mois,
      })
      if (error) throw error
      return (data ?? []) as LignePaie[]
    },
  })

  const decalerMois = (pas: number) => {
    const d = new Date(annee, mois - 1 + pas, 1)
    setAnnee(d.getFullYear())
    setMois(d.getMonth() + 1)
  }

  const q = recherche.trim().toLowerCase()
  const paieParId = new Map((paie ?? []).map((p) => [p.remplacant_id, p]))
  const lignes = (liste ?? []).filter(
    (r) => !q || r.nom_prenom.toLowerCase().includes(q)
      || String(r.matricule ?? '').includes(q),
  )
  const totalMois = (paie ?? []).reduce((s, p) => s + Number(p.montant), 0)
  const joursMois = (paie ?? []).reduce((s, p) => s + Number(p.jours), 0)

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Remplaçants</h1>
        <p className="text-sm text-slate-500">
          La même liste depuis n’importe quelle société : un remplaçant ne travaille
          pour aucune en particulier. Chacun porte son tableau de paie du mois.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Chercher un remplaçant…"
          className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-1">
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
            aria-label="Mois suivant"
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            ›
          </button>
        </div>
        <button
          onClick={() => setFiche('nouveau')}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          + Remplaçant
        </button>
        <button
          onClick={() => setDepuisEmploye(true)}
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
        >
          Ajouter un employé existant
        </button>
        <span className="ml-auto text-sm text-slate-500">
          {joursMois} journée{joursMois > 1 ? 's' : ''} · {formatDH(totalMois)}
        </span>
      </div>

      {isLoading && <Spinner label="Chargement…" />}
      {!isLoading && lignes.length === 0 && (
        <EmptyState>
          {q ? 'Personne de ce nom.' : 'Aucun remplaçant pour le moment.'}
        </EmptyState>
      )}

      {lignes.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {lignes.map((r) => {
            const p = paieParId.get(r.id)
            const jours = Number(p?.jours ?? 0)
            const manquants = champsManquants(r)
            const ouvert = deplie === r.id
            return (
              <li key={r.id}>
                <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => setDeplie(ouvert ? null : r.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-slate-600">
                      {r.matricule ?? '—'}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-900">
                        {r.nom_prenom}
                        {!r.actif && <span className="ml-2 text-xs text-slate-400">inactif</span>}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {r.qualification ?? '—'}
                        {r.tarif_journalier != null
                          ? ` · ${formatDH(r.tarif_journalier)} / jour`
                          : ' · au tarif de la personne remplacée'}
                      </span>
                      {manquants.length > 0 && (
                        <span
                          className="block truncate text-xs font-medium text-red-600"
                          title={`À remplir : ${manquants.join(', ')}`}
                        >
                          {manquants.length} information{manquants.length > 1 ? 's' : ''} à remplir
                        </span>
                      )}
                    </span>
                  </button>

                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold tabular-nums text-slate-900">
                      {formatDH(Number(p?.montant ?? 0))}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {jours} journée{jours > 1 ? 's' : ''}
                    </span>
                  </span>

                  <button
                    onClick={() => setFiche(r)}
                    className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Fiche
                  </button>
                </div>

                {/* Le détail du mois : chaque journée, chez qui, pour combien. */}
                {ouvert && (
                  <div className="border-t border-slate-100 bg-slate-50 px-4 py-2">
                    {jours === 0 ? (
                      <p className="text-sm text-slate-500">
                        Aucune journée en {MOIS_FR[mois - 1].toLowerCase()}.
                      </p>
                    ) : (
                      <ul className="divide-y divide-slate-200">
                        {(p?.par_societe ?? []).map((j, i) => (
                          <li key={i} className="flex justify-between gap-3 py-1.5 text-sm">
                            <span className="text-slate-600">
                              {formatDateFr(j.date)} · {j.societe}
                            </span>
                            <span className="tabular-nums text-slate-800">
                              {formatDH(Number(j.montant))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {fiche !== null && (
        <FicheRemplacant
          remplacant={fiche === 'nouveau' ? null : fiche}
          onClose={() => setFiche(null)}
          onEnregistre={() => {
            qc.invalidateQueries({ queryKey: ['remplacants-fiches'] })
            qc.invalidateQueries({ queryKey: ['remplacants'] })
            qc.invalidateQueries({ queryKey: ['paie-remplacants'] })
            setFiche(null)
          }}
        />
      )}

      {depuisEmploye && (
        <DepuisEmploye
          onClose={() => setDepuisEmploye(false)}
          onRepris={() => {
            qc.invalidateQueries({ queryKey: ['remplacants-fiches'] })
            qc.invalidateQueries({ queryKey: ['remplacants'] })
          }}
        />
      )}
    </div>
  )
}

/**
 * REPRENDRE DES EMPLOYÉS COMME REMPLAÇANTS.
 *
 * Un remplaçant est le plus souvent quelqu'un du groupe. Sa fiche
 * existe déjà, avec sa C.I.N., sa C.N.S.S. et son R.I.B. : on la
 * reprend telle quelle, au lieu de la retaper.
 *
 * La recherche porte sur TOUT le groupe, toutes sociétés, et dit qui
 * est déjà remplaçant. La personne reste affectée à son site : c'est
 * une seconde casquette, pas une mutation.
 */
function DepuisEmploye({
  onClose,
  onRepris,
}: {
  onClose: () => void
  onRepris: () => void
}) {
  const [q, setQ] = useState('')
  const [choisis, setChoisis] = useState<Set<string>>(new Set())
  const [bilan, setBilan] = useState<
    { nom: string; etat: string }[] | null
  >(null)

  const candidats = useQuery({
    queryKey: ['employes-pour-remplacant', q],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('employes_pour_remplacant', {
        p_recherche: q.trim() || null, p_limite: 60,
      })
      if (error) throw error
      return data as {
        employee_id: string; nom_prenom: string; matricule: number | null
        qualification: string | null; societe: string; site: string | null
        deja_remplacant: boolean
      }[]
    },
  })

  const reprendre = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('remplacant_depuis_employe', {
        p_employees: [...choisis],
      })
      if (error) throw error
      return data as { nom: string; etat: string }[]
    },
    onSuccess: (r) => { setBilan(r); setChoisis(new Set()); onRepris() },
  })

  const basculer = (id: string) => setChoisis((p) => {
    const n = new Set(p)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })

  return (
    <div className="modale fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
         onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Ajouter un employé existant comme remplaçant
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Toutes les sociétés. Ses informations sont reprises telles quelles, et il
            reste affecté à son site.
          </p>
          <input
            autoFocus
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Chercher par nom, matricule ou C.I.N.…"
            className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {candidats.isLoading && <Spinner label="Chargement…" />}
          {candidats.error && (
            <div className="p-4"><ErrorNote>{(candidats.error as Error).message}</ErrorNote></div>
          )}
          {candidats.data?.length === 0 && (
            <EmptyState>Personne de ce nom.</EmptyState>
          )}
          <ul className="divide-y divide-slate-100">
            {(candidats.data ?? []).map((c) => (
              <li key={c.employee_id}>
                <label
                  className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-slate-50 ${
                    c.deja_remplacant ? 'opacity-60' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={c.deja_remplacant}
                    checked={choisis.has(c.employee_id)}
                    onChange={() => basculer(c.employee_id)}
                    className="size-4 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {c.nom_prenom}
                      {c.deja_remplacant && (
                        <span className="ml-2 text-xs font-normal text-amber-700">
                          déjà remplaçant
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {c.matricule != null ? `Mat. ${c.matricule} · ` : ''}
                      {c.societe}
                      {c.site ? ` · ${c.site}` : ''}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        {bilan && (
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-sm">
            {bilan.map((b) => (
              <p key={b.nom} className={b.etat === 'cree' ? 'text-emerald-700' : 'text-amber-700'}>
                {b.nom} — {b.etat === 'cree' ? 'ajouté aux remplaçants' : 'était déjà remplaçant'}
              </p>
            ))}
          </div>
        )}

        {reprendre.error && (
          <div className="px-4 pt-3">
            <ErrorNote>{(reprendre.error as Error).message}</ErrorNote>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-4">
          <span className="mr-auto text-sm text-slate-500">
            {choisis.size} sélectionné(s)
          </span>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Fermer
          </button>
          <button
            onClick={() => reprendre.mutate()}
            disabled={choisis.size === 0 || reprendre.isPending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            {reprendre.isPending ? '…' : 'Les ajouter'}
          </button>
        </div>
      </div>
    </div>
  )
}

function FicheRemplacant({
  remplacant,
  onClose,
  onEnregistre,
}: {
  remplacant: Remplacant | null
  onClose: () => void
  onEnregistre: () => void
}) {
  const [f, setF] = useState({
    nom_prenom: remplacant?.nom_prenom ?? '',
    cin: remplacant?.cin ?? '',
    cnss: remplacant?.cnss ?? '',
    date_naissance: remplacant?.date_naissance ?? '',
    telephone: remplacant?.telephone ?? '',
    adresse: remplacant?.adresse ?? '',
    ville: remplacant?.ville ?? '',
    qualification: remplacant?.qualification ?? '',
    mode_reglement: remplacant?.mode_reglement ?? '',
    banque: remplacant?.banque ?? '',
    rib: remplacant?.rib ?? '',
    tarif_journalier: remplacant?.tarif_journalier?.toString() ?? '',
    actif: remplacant?.actif ?? true,
  })
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }))

  const enregistrer = useMutation({
    mutationFn: async () => {
      if (!f.nom_prenom.trim()) throw new Error('Le nom est obligatoire.')
      const tarif = f.tarif_journalier.trim() ? lireNombre(f.tarif_journalier) : null
      if (f.tarif_journalier.trim() && tarif == null) {
        throw new Error('Le tarif se tape en chiffres : 150 ou 150,50.')
      }
      const { error } = await supabase.rpc('enregistrer_remplacant', {
        p_id: remplacant?.id ?? null,
        p_fiche: { ...f, tarif_journalier: tarif == null ? '' : String(tarif) },
      })
      if (error) throw error
    },
    onSuccess: onEnregistre,
  })

  const champ = (label: string, noeud: React.ReactNode, aide?: string) => (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {noeud}
      {aide && <span className="mt-1 block text-xs text-slate-500">{aide}</span>}
    </label>
  )
  const cls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm'

  return (
    <div className="modale fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
         onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900">
          {remplacant ? remplacant.nom_prenom : 'Nouveau remplaçant'}
        </h2>
        <p className="mt-1 mb-4 text-sm text-slate-500">
          Une seule fiche pour tout le groupe : il n’appartient à aucune société.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            {champ('Nom & Prénom *', (
              <input value={f.nom_prenom} onChange={(e) => set('nom_prenom')(e.target.value)}
                     className={cls} autoFocus />
            ))}
          </div>
          {champ('C.I.N.', (
            <input value={f.cin} onChange={(e) => set('cin')(e.target.value)} className={cls} />
          ))}
          {champ('N° C.N.S.S.', (
            <input value={f.cnss} onChange={(e) => set('cnss')(e.target.value)} className={cls} />
          ))}
          {champ('Date de naissance', (
            <input type="date" value={f.date_naissance}
                   onChange={(e) => set('date_naissance')(e.target.value)} className={cls} />
          ))}
          {champ('Téléphone', (
            <input value={f.telephone} onChange={(e) => set('telephone')(e.target.value)}
                   className={cls} />
          ))}
          {champ('Qualification', (
            <input value={f.qualification} onChange={(e) => set('qualification')(e.target.value)}
                   className={cls} placeholder="ex. AGENT DE SECURITE" />
          ))}
          {champ('Ville', (
            <input value={f.ville} onChange={(e) => set('ville')(e.target.value)} className={cls} />
          ))}
          <div className="sm:col-span-2">
            {champ('Adresse', (
              <input value={f.adresse} onChange={(e) => set('adresse')(e.target.value)}
                     className={cls} />
            ))}
          </div>

          <div className="sm:col-span-2 mt-1 border-t border-slate-100 pt-3">
            <p className="text-sm font-semibold text-slate-700">Ce qu’il gagne</p>
          </div>
          <div className="sm:col-span-2">
            {champ('Tarif par journée remplacée (DH)', (
              <ChampDecimal value={f.tarif_journalier} onChange={set('tarif_journalier')}
                            className={cls} placeholder="laisser vide" />
            ), 'Laissé vide, c’est la journée de la personne remplacée qui s’applique — '
             + 'couvrir un chef d’équipe n’est pas couvrir un agent.')}
          </div>
          {champ('Mode de règlement', (
            <select value={f.mode_reglement} onChange={(e) => set('mode_reglement')(e.target.value)}
                    className={cls}>
              <option value="">— Choisir —</option>
              <option value="Espece">Espèce</option>
              <option value="Virement">Virement</option>
              <option value="Versement">Versement</option>
            </select>
          ))}
          {champ('Banque', (
            <input value={f.banque} onChange={(e) => set('banque')(e.target.value)} className={cls} />
          ))}
          <div className="sm:col-span-2">
            {champ('R.I.B.', (
              <input value={f.rib} onChange={(e) => set('rib')(e.target.value)}
                     className={cls} placeholder="24 chiffres" />
            ))}
          </div>
          {remplacant && (
            <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
              <input
                type="checkbox"
                checked={f.actif}
                onChange={(e) => setF((p) => ({ ...p, actif: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300"
              />
              Disponible pour des remplacements
            </label>
          )}
        </div>

        {enregistrer.error && (
          <div className="mt-3">
            <ErrorNote>{(enregistrer.error as Error).message}</ErrorNote>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            onClick={() => enregistrer.mutate()}
            disabled={enregistrer.isPending || !f.nom_prenom.trim()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            {enregistrer.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
