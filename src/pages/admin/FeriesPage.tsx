import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { formatDateFr, todayIso } from '../../lib/dates'
import {
  useConvertirTravailFerie, useCreerFerie, useFeries, useSupprimerFerie,
  type PoseFerie,
} from '../../lib/feries'
import { Chip, DateInputFr, EmptyState, ErrorNote, Spinner } from '../../components/ui'

/**
 * LES JOURS FÉRIÉS.
 *
 * Déclarer un férié inscrit F à tout le monde : la journée est payée
 * sans que personne ne travaille. Ceux qui ont tenu le poste passent
 * ensuite en XF au pointage, et leur journée compte double.
 *
 * Un férié déclaré après coup trouve des gardes déjà saisies ; elles ne
 * sont jamais converties toutes seules — cela changerait la paie sans
 * qu'on l'ait demandé. Le bouton le fait, une fois qu'on l'a lu.
 */
export default function FeriesPage() {
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const { data: feries, isLoading } = useFeries(null, annee)
  const creer = useCreerFerie()
  const supprimer = useSupprimerFerie()
  const convertir = useConvertirTravailFerie()

  const { data: societes } = useQuery({
    queryKey: ['companies-toutes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name').order('name')
      if (error) throw error
      return data as { id: string; name: string }[]
    },
  })

  const [form, setForm] = useState({
    nom: '',
    debut: todayIso(),
    fin: todayIso(),
    portee: '' as string, // '' = tout le groupe
  })
  const [rapport, setRapport] = useState<PoseFerie | null>(null)
  const [convertis, setConvertis] = useState<number | null>(null)

  const nomSociete = (id: string | null) =>
    id ? (societes?.find((s) => s.id === id)?.name ?? '—') : 'Tout le groupe'

  const enregistrer = () => {
    setRapport(null)
    setConvertis(null)
    creer.mutate(
      {
        companyId: form.portee || null,
        nom: form.nom,
        debut: form.debut,
        fin: form.fin < form.debut ? form.debut : form.fin,
      },
      {
        onSuccess: (r) => {
          setRapport(r)
          setForm((f) => ({ ...f, nom: '' }))
        },
      },
    )
  }

  const champ = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm'

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Jours fériés</h1>
        <p className="text-sm text-slate-500">
          Un férié est payé à tout le monde. Celui qui vient quand même travailler fait
          une garde qui compte double.
        </p>
      </div>

      {/* ---------- Déclarer ---------- */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-700 uppercase">
          Déclarer un férié
        </h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">Nom du férié</span>
            <input
              type="text"
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              placeholder="ex. Fête du Travail, Aïd al-Fitr"
              className={champ}
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-slate-700">Du</span>
            <DateInputFr
              value={form.debut}
              onChange={(v: string) => setForm({ ...form, debut: v, fin: form.fin < v ? v : form.fin })}
              className={champ}
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-slate-700">Au</span>
            <DateInputFr
              value={form.fin}
              onChange={(v: string) => setForm({ ...form, fin: v })}
              className={champ}
            />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">Pour</span>
            <select
              value={form.portee}
              onChange={(e) => setForm({ ...form, portee: e.target.value })}
              className={champ}
            >
              <option value="">Tout le groupe — les dix sociétés</option>
              {societes?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} seulement
                </option>
              ))}
            </select>
          </label>
        </div>

        {creer.error && (
          <div className="mt-3">
            <ErrorNote>{creer.error.message}</ErrorNote>
          </div>
        )}

        {rapport && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <p className="font-semibold">
              {rapport.jours_ecrits} journée{rapport.jours_ecrits > 1 ? 's' : ''} inscrite
              {rapport.jours_ecrits > 1 ? 's' : ''} au pointage.
            </p>
            {rapport.deja_pointes > 0 && (
              <p className="mt-1">
                {rapport.deja_pointes} jour{rapport.deja_pointes > 1 ? 's' : ''} étai
                {rapport.deja_pointes > 1 ? 'ent' : 't'} déjà pointé
                {rapport.deja_pointes > 1 ? 's' : ''} — ni congé ni garde saisie n’a été écrasé.
                Si ces gens ont travaillé le férié, le bouton « compter double » ci-dessous
                les passe en férié travaillé.
              </p>
            )}
            {rapport.mois_clos > 0 && (
              <p className="mt-1">
                {rapport.mois_clos} jour{rapport.mois_clos > 1 ? 's' : ''} tombe
                {rapport.mois_clos > 1 ? 'nt' : ''} dans un mois clôturé : rien n’y a été écrit.
              </p>
            )}
          </div>
        )}

        <button
          onClick={enregistrer}
          disabled={creer.isPending || !form.nom.trim()}
          className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {creer.isPending ? 'Enregistrement…' : 'Déclarer le férié'}
        </button>
      </section>

      {/* ---------- Le calendrier ---------- */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-wide text-slate-700 uppercase">
            Calendrier {annee}
          </h2>
          <span className="flex items-center gap-1">
            <button
              onClick={() => setAnnee((a) => a - 1)}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-50"
            >
              ←
            </button>
            <button
              onClick={() => setAnnee((a) => a + 1)}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-50"
            >
              →
            </button>
          </span>
        </div>

        {isLoading && <Spinner label="Chargement du calendrier…" />}

        {feries?.length === 0 && <EmptyState>Aucun férié déclaré en {annee}.</EmptyState>}

        {convertir.error && (
          <div className="mb-3">
            <ErrorNote>{convertir.error.message}</ErrorNote>
          </div>
        )}
        {supprimer.error && (
          <div className="mb-3">
            <ErrorNote>{supprimer.error.message}</ErrorNote>
          </div>
        )}
        {convertis != null && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {convertis} journée{convertis > 1 ? 's' : ''} passée{convertis > 1 ? 's' : ''} en
            férié travaillé — elle{convertis > 1 ? 's comptent' : ' compte'} désormais double.
          </div>
        )}

        <ul className="space-y-2">
          {feries?.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-800">{f.nom}</span>
                <span className="block text-xs text-slate-500">
                  {f.date_debut === f.date_fin
                    ? formatDateFr(f.date_debut)
                    : `du ${formatDateFr(f.date_debut)} au ${formatDateFr(f.date_fin)}`}
                  {' · '}
                  {nomSociete(f.company_id)}
                </span>
              </span>
              <span className="flex items-center gap-2">
                {f.company_id === null && <Chip tone="slate">Groupe</Chip>}
                <button
                  onClick={() =>
                    convertir.mutate(f.id, { onSuccess: (n) => setConvertis(n as number) })
                  }
                  disabled={convertir.isPending}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                  title="Passer en « férié travaillé » les gardes déjà saisies ces jours-là"
                >
                  Compter double ceux qui ont travaillé
                </button>
                <button
                  onClick={() => supprimer.mutate(f.id)}
                  disabled={supprimer.isPending}
                  className="rounded-lg px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  title="Retire les journées F que ce férié avait inscrites"
                >
                  Supprimer
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-6 text-xs text-slate-500">
        Au pointage : <strong>F</strong> = férié chômé, payé comme un jour travaillé.{' '}
        <strong>XF</strong> = férié travaillé, la journée compte pour deux.
      </p>
    </div>
  )
}
