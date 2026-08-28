import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useApercuMois, usePaieInvalidation, moisLabel, MOIS_FR } from '../../lib/paie'
import { Chip, ErrorNote } from '../../components/ui'

/** Mois précédent : c'est celui qu'on clôture le plus souvent. */
function moisParDefaut(): { annee: number; mois: number } {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return { annee: d.getFullYear(), mois: d.getMonth() + 1 }
}

/**
 * Clôture du pointage d'un mois : une fois validé, le mois part dans
 * « La Paie » et le pointage de ce mois n'est plus modifiable.
 */
export default function ValidationMois({ companyId }: { companyId: string | undefined }) {
  const [ouvert, setOuvert] = useState(false)
  const defaut = moisParDefaut()
  const [annee, setAnnee] = useState(defaut.annee)
  const [mois, setMois] = useState(defaut.mois)
  const [confirme, setConfirme] = useState(false)

  const { data: apercu, isLoading } = useApercuMois(companyId, annee, mois)
  const invalider = usePaieInvalidation(companyId)

  const valider = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('valider_pointage_mois', {
        p_company: companyId!,
        p_annee: annee,
        p_mois: mois,
      })
      if (error) throw error
    },
    onSuccess: () => {
      invalider()
      setConfirme(false)
    },
  })

  const annees = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i)
  const dejaCloture = apercu && apercu.statut !== 'ouvert'
  const bloquant = apercu ? apercu.en_attente > 0 : false

  if (!ouvert) {
    return (
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-800">Clôture du mois</p>
          <p className="text-xs text-slate-500">
            Valider tout le pointage d’un mois pour l’envoyer dans La Paie.
          </p>
        </div>
        <button
          onClick={() => setOuvert(true)}
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
        >
          Valider un mois →
        </button>
      </div>
    )
  }

  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Clôture du mois</p>
          <p className="text-xs text-slate-500">
            Une fois validé, le pointage de ce mois est verrouillé et la paie est générée.
          </p>
        </div>
        <button onClick={() => setOuvert(false)} className="text-sm text-slate-500 hover:text-slate-800">
          Fermer
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={mois}
          onChange={(e) => { setMois(Number(e.target.value)); setConfirme(false) }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {MOIS_FR.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          value={annee}
          onChange={(e) => { setAnnee(Number(e.target.value)); setConfirme(false) }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {annees.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        {isLoading && <span className="text-sm text-slate-400">Vérification…</span>}
        {apercu && dejaCloture && (
          <Chip tone={apercu.statut === 'paie_validee' ? 'green' : 'blue'}>
            {apercu.statut === 'paie_validee' ? 'Paie déjà validée' : 'Mois déjà clôturé'}
          </Chip>
        )}
      </div>

      {apercu && !dejaCloture && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Employés actifs" value={apercu.employes_actifs} />
            <Stat label="Jours validés" value={apercu.valides} />
            <Stat label="Photos en attente" value={apercu.en_attente} alerte={apercu.en_attente > 0} />
            <Stat label="Sans salaire saisi" value={apercu.sans_salaire} alerte={apercu.sans_salaire > 0} />
          </div>

          {bloquant && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Il reste <strong>{apercu.en_attente}</strong> photo(s) à valider sur {moisLabel(annee, mois)}.
              Traitez-les avant de clôturer le mois.
            </div>
          )}
          {!bloquant && apercu.sans_salaire > 0 && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <strong>{apercu.sans_salaire}</strong> employé(s) actif(s) n’ont pas de salaire renseigné :
              ils apparaîtront à 0 DH dans la paie.
            </div>
          )}

          {valider.error && (
            <div className="mb-3">
              <ErrorNote>{valider.error.message}</ErrorNote>
            </div>
          )}

          {!confirme ? (
            <button
              onClick={() => setConfirme(true)}
              disabled={bloquant}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              Valider le pointage de {moisLabel(annee, mois)}
            </button>
          ) : (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3">
              <p className="mb-2 text-sm text-emerald-900">
                Confirmer la clôture de <strong>{moisLabel(annee, mois)}</strong> ? Le pointage de ce
                mois ne sera plus modifiable sans l’accord de l’administrateur.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirme(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Annuler
                </button>
                <button
                  onClick={() => valider.mutate()}
                  disabled={valider.isPending}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {valider.isPending ? 'Validation…' : 'Oui, clôturer le mois'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {apercu && dejaCloture && (
        <p className="text-sm text-slate-600">
          {moisLabel(annee, mois)} est clôturé. La suite se passe dans l’onglet <strong>Paie</strong>.
        </p>
      )}
    </div>
  )
}

function Stat({ label, value, alerte }: { label: string; value: number; alerte?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${alerte ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
      <p className={`text-lg font-semibold ${alerte ? 'text-amber-700' : 'text-slate-900'}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}
