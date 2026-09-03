import type { ReactNode } from 'react'
import { usePhotoProfil } from '../lib/documents'
import { useCongesEmploye, useContratsEmploye } from '../lib/paie'
import { contratAffichage } from '../lib/contrats'
import { computeAge, formatDateFr, jourDeReposLabel } from '../lib/dates'
import { formatDH } from '../lib/paie'
import { formatGardes } from '../lib/gardes'
import { useFermerSurEchap } from '../lib/impression'
import type { ContratCourant, Employee } from '../lib/types'
import { Chip } from './ui'

/**
 * L'APERÇU D'UN EMPLOYÉ — en lecture seule.
 *
 * S'ouvre en cliquant n'importe où sur sa ligne. On y voit tout ce que
 * le registre sait de lui sans avoir à ouvrir le formulaire de
 * modification, où la moindre frappe peut changer une donnée.
 * Les boutons « Modifier » et « Fiche » restent la porte d'entrée
 * pour agir ; ici, on regarde.
 */
export default function ApercuEmploye({
  employee,
  entreprise,
  siteNom,
  sitePrincipalNom,
  contratCourant,
  onModifier,
  onFiche,
  onClose,
}: {
  employee: Employee
  entreprise: string
  siteNom: string | null
  sitePrincipalNom?: string | null
  /** L'état du contrat, déjà calculé par la page (bientôt fini / terminé). */
  contratCourant?: ContratCourant | null
  onModifier?: () => void
  onFiche?: () => void
  onClose: () => void
}) {
  useFermerSurEchap(onClose)

  const { data: photo } = usePhotoProfil(employee.photo_path)
  // Un rôle sans droit de lecture sur ces tables reçoit une erreur, pas
  // une liste vide : il ne faut pas la présenter comme « aucun contrat ».
  const { data: contrats, error: errContrats } = useContratsEmploye(employee.id)
  const { data: conges, error: errConges } = useCongesEmploye(employee.id)

  // Le plus récent des contrats du dossier, et son état tel que la page
  // l'affiche déjà dans le tableau.
  const contrat = contrats?.[0] ?? null
  const aff = contratAffichage(
    contratCourant?.statut ?? null,
    contratCourant?.jours_restants ?? null,
  )
  const age = employee.date_naissance ? computeAge(employee.date_naissance) : null

  // Les congés à venir ou en cours : ceux qui comptent aujourd'hui.
  const aujourdhui = new Date().toISOString().slice(0, 10)
  const congesActifs = (conges ?? []).filter((c) => c.date_fin >= aujourdhui)

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-2xl rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Bandeau : qui est-ce, et où */}
        <div className="flex items-start gap-4 border-b border-slate-200 p-5">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
            {photo ? (
              <img src={photo} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-slate-400">
                {initiales(employee.nom_prenom)}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-slate-600">
                {employee.matricule ?? '—'}
              </span>
              <h2 className="text-lg font-semibold text-slate-900">{employee.nom_prenom}</h2>
              {!employee.actif && <Chip tone="slate">Sorti</Chip>}
              {aff && <Chip tone={aff.chip}>{aff.label}</Chip>}
            </div>
            <p className="mt-0.5 text-sm text-slate-600">
              {employee.qualification || 'Sans qualification'}
              {employee.departement && ` · ${employee.departement}`}
            </p>
            <p className="mt-0.5 text-sm text-slate-500">
              {entreprise}
              {siteNom && ` · ${siteNom}`}
              {sitePrincipalNom && ` (${sitePrincipalNom})`}
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Fermer"
            className="shrink-0 rounded-lg px-2 py-1 text-xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ×
          </button>
        </div>

        <div className="space-y-5 p-5">
          <Groupe titre="Identité">
            <Champ label="C.I.N.">{employee.cin || '—'}</Champ>
            <Champ label="N° C.N.S.S.">{employee.cnss || '—'}</Champ>
            <Champ label="Date de naissance">
              {employee.date_naissance
                ? `${formatDateFr(employee.date_naissance)}${age != null ? ` · ${age} ans` : ''}`
                : '—'}
            </Champ>
            <Champ label="Situation familiale">
              {employee.situation_familiale || '—'}
              {employee.nombre_enfants > 0 && ` · ${employee.nombre_enfants} enfant(s)`}
            </Champ>
          </Groupe>

          <Groupe titre="Contact">
            <Champ label="Téléphone">{employee.telephone || '—'}</Champ>
            <Champ label="Ville">{employee.ville || '—'}</Champ>
            <Champ label="Adresse" large>{employee.adresse || '—'}</Champ>
          </Groupe>

          <Groupe titre="Travail">
            <Champ label="Date d’embauche">
              {employee.date_embauche ? formatDateFr(employee.date_embauche) : '—'}
            </Champ>
            <Champ label="Jour de repos">{jourDeReposLabel(employee.jour_de_repos)}</Champ>
            <Champ label="Heures par jour">
              {employee.heures_par_jour != null ? `${employee.heures_par_jour} h` : '—'}
            </Champ>
            <Champ label="Jours travaillés">{formatGardes(employee.jours_travailles)}</Champ>
            {!employee.actif && (
              <Champ label="Date de sortie">
                {employee.date_sortie ? formatDateFr(employee.date_sortie) : '—'}
              </Champ>
            )}
          </Groupe>

          <Groupe titre="Rémunération">
            <Champ label="Salaire mensuel">
              <span className="font-semibold text-slate-900">{formatDH(employee.salaire)}</span>
            </Champ>
            <Champ label="Mode de règlement">{employee.mode_reglement || '—'}</Champ>
            {(employee.mode_reglement ?? '').toLowerCase().startsWith('vir') && (
              <>
                <Champ label="Banque">{employee.banque || '—'}</Champ>
                <Champ label="R.I.B." large>{employee.rib || '—'}</Champ>
              </>
            )}
            <Champ label="Dette en cours">
              {employee.dette > 0 ? (
                <span className="font-semibold text-red-700">{formatDH(employee.dette)}</span>
              ) : (
                <span className="text-slate-400">Aucune</span>
              )}
            </Champ>
          </Groupe>

          {/* Contrat en cours : la date de fin est ce qu'on vient vérifier */}
          <div>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Contrat
            </h3>
            {contrat ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{contrat.type_contrat}</span>
                  {contrat.numero && <span className="text-slate-500">n° {contrat.numero}</span>}
                  {aff && <Chip tone={aff.chip}>{aff.label}</Chip>}
                </div>
                <p className="mt-1 text-slate-600">
                  Du {formatDateFr(contrat.date_debut)}
                  {contrat.date_fin
                    ? ` au ${formatDateFr(contrat.date_fin)}`
                    : ' — durée indéterminée'}
                </p>
                {contrat.salaire_mensuel != null && (
                  <p className="text-slate-600">Salaire au contrat : {formatDH(contrat.salaire_mensuel)}</p>
                )}
                {(contrats?.length ?? 0) > 1 && (
                  <p className="mt-1 text-xs text-slate-400">
                    {contrats!.length} contrats au total dans le dossier.
                  </p>
                )}
              </div>
            ) : (
              <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-400">
                {errContrats ? 'Contrats non consultables depuis ce compte.' : 'Aucun contrat enregistré.'}
              </p>
            )}
          </div>

          {/* Congés en cours ou à venir */}
          <div>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Congés
            </h3>
            {congesActifs.length > 0 ? (
              <ul className="space-y-1.5">
                {congesActifs.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  >
                    <span className="text-slate-700">
                      Du {formatDateFr(c.date_debut)} au {formatDateFr(c.date_fin)}
                    </span>
                    <span className="text-xs text-slate-500">
                      {c.type === 'M' ? 'Maladie' : 'Congé'}
                      {c.motif && ` · ${c.motif}`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-400">
                {errConges ? (
                  'Congés non consultables depuis ce compte.'
                ) : (
                  <>
                    Aucun congé en cours ni à venir.
                    {(conges?.length ?? 0) > 0 && ` ${conges!.length} congé(s) passé(s) au dossier.`}
                  </>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Depuis l'aperçu, on peut passer à l'action */}
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 p-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Fermer
          </button>
          {onFiche && (
            <button
              onClick={onFiche}
              className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Imprimer la fiche
            </button>
          )}
          {onModifier && (
            <button
              onClick={onModifier}
              className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Modifier
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Groupe({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">{titre}</h3>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">{children}</dl>
    </div>
  )
}

function Champ({ label, children, large }: { label: string; children: ReactNode; large?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 text-sm ${large ? 'sm:col-span-2' : ''}`}>
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 text-right break-words text-slate-800">{children}</dd>
    </div>
  )
}

function initiales(nom: string): string {
  return nom.trim().split(/\s+/).slice(0, 2).map((m) => m[0]?.toUpperCase() ?? '').join('')
}
