import { useEffect, useRef, useState } from 'react'
import { formatDateFr } from '../lib/dates'
import { modeleContrat, type ChampContrat, type ModeleContrat } from '../lib/contratsModeles'
import { useFermerSurEchap, useImpression, useModeImpression } from '../lib/impression'
import BarreImpression from './BarreImpression'
import PortailImpression from './PortailImpression'
import ContratDocument from './ContratDocument'
import type { Employee } from '../lib/types'

/**
 * RÉDIGER UN CONTRAT — le modèle de la société de l'employé.
 */
export default function ContratRedaction({
  employee, entreprise, valeursContrat, onClose,
}: {
  employee: Employee
  entreprise: string
  /** Ce que le contrat enregistré dicte : on réimprime ce qui a été signé. */
  valeursContrat?: Record<string, string>
  onClose: () => void
}) {
  const modele = modeleContrat(entreprise)
  return (
    <RedactionDocument
      modele={modele}
      employee={employee}
      entreprise={entreprise}
      intitule="Contrat de travail"
      prefixeFichier="Contrat"
      valeursInitiales={valeursContrat}
      onClose={onClose}
    />
  )
}

/**
 * REMPLIR UN DOCUMENT, LA PAGE SOUS LES YEUX.
 *
 * À gauche les champs, à droite la page telle qu'elle sortira de
 * l'imprimante — elle se met à jour à chaque frappe, de sorte qu'on voit
 * ce qu'on signe avant de l'imprimer. Ce qui est déjà au dossier de
 * l'employé est prérempli ; le reste se saisit une fois.
 *
 * Sert au contrat comme à l'engagement de congé : c'est la même mécanique,
 * seul le modèle change.
 */
export function RedactionDocument({
  modele,
  employee,
  entreprise,
  intitule,
  prefixeFichier,
  valeursInitiales,
  onClose,
}: {
  modele: ModeleContrat | null
  employee: Employee
  entreprise: string
  intitule: string
  prefixeFichier: string
  /** Ce que l'appelant sait déjà — les dates d'un congé, par exemple. */
  valeursInitiales?: Record<string, string>
  onClose: () => void
}) {
  useFermerSurEchap(onClose)
  const [valeurs, setValeurs] = useState<Record<string, string>>({})
  const [imprime, setImprime] = useState(false)

  // Ce que le dossier sait déjà : inutile de le retaper.
  //
  // Sauf sur les contrats arabes : le registre écrit les noms, adresses et
  // villes en caractères latins, alors que ces contrats se remplissent en
  // arabe. Les préremplir obligerait à effacer avant d'écrire. On ne garde
  // donc que ce qui s'écrit pareil dans les deux langues — le C.I.N., qui
  // est de toute façon en lettres latines sur la carte, les dates et les
  // montants.
  useEffect(() => {
    if (!modele) return
    const enArabe = modele.langue === 'ar'
    const LATIN_SEULEMENT: ChampContrat['depuis'][] = ['nom_prenom', 'adresse', 'ville']
    const depuis: Record<NonNullable<ChampContrat['depuis']>, string> = {
      nom_prenom: employee.nom_prenom ?? '',
      cin: employee.cin ?? '',
      date_naissance: employee.date_naissance ? formatDateFr(employee.date_naissance) : '',
      adresse: [employee.adresse, employee.ville].filter(Boolean).join(', '),
      salaire: employee.salaire != null ? String(employee.salaire) : '',
      ville: employee.ville ?? '',
    }
    const initial: Record<string, string> = { ...(modele.defauts ?? {}) }
    for (const c of modele.champs) {
      if (!c.depuis) continue
      if (enArabe && LATIN_SEULEMENT.includes(c.depuis)) continue
      initial[c.id] = depuis[c.depuis]
    }
    setValeurs({ ...initial, ...(valeursInitiales ?? {}) })
  }, [modele, employee, valeursInitiales])

  if (!modele) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
        <div className="max-w-md rounded-2xl bg-white p-5 text-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
          <p className="font-semibold text-slate-900">Aucun modèle</p>
          <p className="mt-1 text-slate-600">
            {entreprise} n’a pas encore de modèle enregistré pour ce document.
            Envoyez-le et il sera ajouté.
          </p>
          <button onClick={onClose} className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            Fermer
          </button>
        </div>
      </div>
    )
  }

  if (imprime) {
    return (
      <DocumentImpression
        modele={modele}
        valeurs={valeurs}
        titre={`${intitule} — ${employee.nom_prenom}`}
        nomFichier={`${prefixeFichier}_${employee.nom_prenom.replace(/\s+/g, '_')}`}
        onClose={() => setImprime(false)}
      />
    )
  }

  const set = (id: string) => (v: string) => setValeurs((x) => ({ ...x, [id]: v }))
  const remplis = modele.champs.filter((c) => (valeurs[c.id] ?? '').trim()).length
  const manquants = modele.champs.length - remplis

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 bg-white px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {intitule} — {employee.nom_prenom}
          </h2>
          <p className="text-xs text-slate-500">
            {entreprise} · {remplis} champ(s) sur {modele.champs.length}
            {manquants > 0 && ` · ${manquants} encore en pointillés`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Fermer
          </button>
          <button
            onClick={() => setImprime(true)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Imprimer / PDF
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Les champs */}
        <div className="w-full shrink-0 overflow-y-auto border-b border-slate-300 bg-white p-4 lg:w-80 lg:border-r lg:border-b-0">
          <p className="mb-3 text-xs text-slate-500">
            Un champ laissé vide s’imprime en pointillés, comme sur le formulaire papier.
          </p>
          {modele.langue === 'ar' && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Ce document se remplit <strong>en arabe</strong> : basculez le clavier.
              Le champ s’oriente tout seul selon ce que vous tapez. Le C.I.N., les
              dates et les montants restent en chiffres et lettres latins.
            </p>
          )}
          <div className="space-y-3">
            {modele.champs.map((c) => (
              <label key={c.id} className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">{c.label}</span>
                {c.type === 'long' ? (
                  <textarea
                    rows={2}
                    dir="auto"
                    value={valeurs[c.id] ?? ''}
                    onChange={(e) => set(c.id)(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                ) : (
                  <input
                    // « auto » laisse le navigateur orienter le champ d'après
                    // le premier caractère saisi : latin à gauche, arabe à droite.
                    dir="auto"
                    type={c.type === 'nombre' ? 'number' : 'text'}
                    value={valeurs[c.id] ?? ''}
                    onChange={(e) => set(c.id)(e.target.value)}
                    placeholder={c.type === 'date' ? 'jj/mm/aaaa' : undefined}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                )}
                {c.aide && <span className="mt-1 block text-xs text-slate-400">{c.aide}</span>}
              </label>
            ))}
          </div>
        </div>

        {/* La page, à jour à chaque frappe */}
        <div className="min-h-0 flex-1 overflow-auto bg-slate-200 p-4">
          <Apercu>
            <ContratDocument modele={modele} valeurs={valeurs} />
          </Apercu>
        </div>
      </div>
    </div>
  )
}

/** Met la page A4 à l'échelle de la place disponible, sans la déformer. */
function Apercu({ children }: { children: React.ReactNode }) {
  const boite = useRef<HTMLDivElement>(null)
  const [echelle, setEchelle] = useState(1)
  const LARGEUR_MM = 210
  const PX_PAR_MM = 96 / 25.4

  useEffect(() => {
    const el = boite.current
    if (!el) return
    const mesurer = () => {
      const dispo = el.clientWidth
      setEchelle(Math.min(1, dispo / (LARGEUR_MM * PX_PAR_MM)))
    }
    mesurer()
    const ro = new ResizeObserver(mesurer)
    ro.observe(el)
    return () => ro.disconnect()
  }, [PX_PAR_MM])

  const largeur = LARGEUR_MM * PX_PAR_MM
  return (
    <div ref={boite} className="mx-auto max-w-[900px]">
      <div style={{ width: largeur * echelle, margin: '0 auto' }}>
        <div
          className="shadow-xl"
          style={{
            width: largeur,
            transform: `scale(${echelle})`,
            transformOrigin: 'top left',
            marginBottom: echelle < 1 ? `-${(1 - echelle) * 100}%` : undefined,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

/** La vue d'impression : la page seule, portée dans le corps du document. */
function DocumentImpression({
  modele, valeurs, titre, nomFichier, onClose,
}: {
  modele: ModeleContrat
  valeurs: Record<string, string>
  titre: string
  nomFichier: string
  onClose: () => void
}) {
  useModeImpression()
  const { pret, imprimer } = useImpression(0)

  return (
    <PortailImpression>
      <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-800/60 print:static print:bg-white">
        <BarreImpression
          titre={titre}
          pret={pret}
          imprimer={imprimer}
          nomFichier={nomFichier}
          onClose={onClose}
        />
        <div className="document-imprimable mx-auto my-6 shadow-xl print:my-0 print:shadow-none">
          <ContratDocument modele={modele} valeurs={valeurs} />
        </div>
      </div>
    </PortailImpression>
  )
}
