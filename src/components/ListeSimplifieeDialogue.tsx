import { useState } from 'react'
import { useFermerSurEchap } from '../lib/impression'
import ListeSimplifieePrint from './ListeSimplifieePrint'
import type { Employee } from '../lib/types'

/** Le mois en cours, du premier au dernier jour — sans passer par UTC. */
function moisCourant(): { du: string; au: string } {
  const d = new Date()
  const iso = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  return {
    du: iso(new Date(d.getFullYear(), d.getMonth(), 1)),
    au: iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  }
}

/** L'intitulé habituel, déduit du métier de l'équipe. */
function intituleParDefaut(employees: Employee[]): string {
  const deps = new Set(employees.map((e) => (e.departement ?? '').toUpperCase()))
  if (deps.size === 1) {
    const [d] = [...deps]
    if (d === 'GARDIENNAGE') return 'Liste Des Agents De Gardiennage'
    if (d === 'SECURITE') return 'Liste Des Agents De Sécurité'
    if (d === 'NETTOYAGE') return 'Liste Des Agents De Nettoyage'
    if (d === 'JARDINAGE' || d === 'JARDINIER') return 'Liste Des Jardiniers'
    if (d === 'ACCUEIL') return "Liste Des Agents D'Accueil"
  }
  return 'Liste Du Personnel'
}

/**
 * Ce que le document a besoin de savoir et que la base ignore : le numéro
 * du marché, la façon dont le client s'appelle sur le papier, et la
 * période couverte. Le reste vient du registre.
 */
export default function ListeSimplifieeDialogue({
  employees,
  entreprise,
  siteNom,
  onClose,
}: {
  employees: Employee[]
  entreprise: string
  siteNom: string | null
  onClose: () => void
}) {
  useFermerSurEchap(onClose)
  const mois = moisCourant()

  const [marche, setMarche] = useState('')
  const [intitule, setIntitule] = useState(intituleParDefaut(employees))
  const [etablissement, setEtablissement] = useState(siteNom ?? '')
  const [du, setDu] = useState(mois.du)
  const [au, setAu] = useState(mois.au)
  const [imprime, setImprime] = useState(false)

  if (imprime) {
    return (
      <ListeSimplifieePrint
        employees={employees}
        entreprise={entreprise}
        marche={marche}
        intitule={intitule}
        etablissement={etablissement}
        du={du}
        au={au}
        onClose={onClose}
      />
    )
  }

  const invalide = !etablissement.trim() || !du || !au || au < du

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900">Liste simplifiée</h2>
        <p className="mt-1 text-sm text-slate-500">
          {employees.length} employé(s). Il ne reste qu’à nommer le document : ces
          quatre informations ne sont pas dans le registre.
        </p>

        <div className="mt-4 space-y-3">
          <Champ
            label="Marché n° (facultatif)"
            aide="Tel qu’il figure sur le contrat. Laissez vide s’il n’y en a pas : la ligne ne s’imprimera pas."
          >
            <input
              value={marche}
              onChange={(e) => setMarche(e.target.value)}
              placeholder="04/ECIB/2024"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Champ>

          <Champ label="Intitulé">
            <input
              value={intitule}
              onChange={(e) => setIntitule(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Champ>

          <Champ
            label="Établissement"
            aide="Le nom du client tel qu’il doit paraître. Prérempli avec l’annexe filtrée."
          >
            <input
              value={etablissement}
              onChange={(e) => setEtablissement(e.target.value)}
              placeholder="Etablissement de Cooperation Intercommunale Al Boughaz"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Champ>

          <div className="grid grid-cols-2 gap-3">
            <Champ label="Période du">
              <input
                type="date"
                value={du}
                onChange={(e) => setDu(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </Champ>
            <Champ label="au">
              <input
                type="date"
                value={au}
                onChange={(e) => setAu(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </Champ>
          </div>
          {au && du && au < du && (
            <p className="text-sm text-red-600">La fin de période précède son début.</p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            onClick={() => setImprime(true)}
            disabled={invalide}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
          >
            Voir le document
          </button>
        </div>
      </div>
    </div>
  )
}

function Champ({
  label, aide, children,
}: { label: string; aide?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {aide && <span className="mt-1 block text-xs text-slate-400">{aide}</span>}
    </label>
  )
}
