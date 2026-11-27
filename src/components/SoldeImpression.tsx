import { useMemo } from 'react'
import { modeleSolde } from '../lib/soldeToutCompte'
import { dateDoc, valeursEmploye } from '../lib/champsDocument'
import { useModeleSociete } from '../lib/modeleSociete'
import { useFermerSurEchap, useImpression, useModeImpression } from '../lib/impression'
import { todayIso } from '../lib/dates'
import type { Employee } from '../lib/types'
import type { Sortie } from '../lib/sorties'
import BarreImpression from './BarreImpression'
import ContratDocument from './ContratDocument'
import PortailImpression from './PortailImpression'

/**
 * LE REÇU POUR SOLDE DE TOUT COMPTE, DEPUIS LA FICHE.
 *
 * Le même document que celui qu'on rédige dans la section Sorties, mais
 * sorti d'un clic depuis la fiche de la personne : au guichet, on ouvre
 * un nom et on imprime son reçu, sans repasser par le formulaire.
 *
 * Ce qu'il porte vient de ce qui est déjà enregistré — le montant du
 * solde, sa date, son mode de règlement. Rien n'est recalculé ici : un
 * reçu qui dirait un autre montant que celui qu'on a enregistré serait
 * pire que pas de reçu du tout. Tant que le départ n'est pas saisi, les
 * lignes correspondantes restent en blanc, à remplir à la main.
 */
export default function SoldeImpression({
  employee,
  entreprise,
  sortie,
  onClose,
}: {
  employee: Employee
  entreprise: string
  /** Le départ enregistré, s'il l'est : c'est lui qui porte le montant. */
  sortie: Sortie | null
  onClose: () => void
}) {
  useFermerSurEchap(onClose)
  useModeImpression()

  const { data: cleModele } = useModeleSociete(employee.company_id)
  const modele = useMemo(() => modeleSolde(entreprise, cleModele), [entreprise, cleModele])
  // Le reçu est entièrement dessiné : aucune image à attendre.
  const { pret, imprimer } = useImpression(0)

  const dateSolde = sortie?.date_sortie ?? employee.date_sortie ?? todayIso()
  const valeurs: Record<string, string> = {
    ...valeursEmploye(employee, modele),
    nom: employee.nom_prenom,
    adresse: [employee.adresse, employee.ville].filter(Boolean).join(', '),
    montant: sortie?.montant != null ? String(sortie.montant) : '',
    mode: sortie?.mode_reglement ?? employee.mode_reglement ?? '',
    fait_le: dateDoc(dateSolde),
    ...((sortie?.champs_document ?? {}) as Record<string, string>),
  }

  return (
    <PortailImpression>
      <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-800/60 print:static print:bg-white">
        <BarreImpression
          titre={`Solde de tout compte — ${employee.nom_prenom}`}
          pret={pret}
          imprimer={imprimer}
          nomFichier={`Solde_${employee.nom_prenom.replace(/\s+/g, '_')}`}
          onClose={onClose}
        />

        <div className="mx-auto w-fit p-4 print:p-0">
          {modele ? (
            <div className="document-imprimable bg-white shadow-xl print:shadow-none">
              <ContratDocument modele={modele} valeurs={valeurs} />
            </div>
          ) : (
            <p className="rounded-xl bg-white px-6 py-10 text-center text-sm text-slate-500 print:hidden">
              Aucun modèle de reçu n’est enregistré pour {entreprise || 'cette société'}.
            </p>
          )}
        </div>

        {!sortie && modele && (
          <p className="mx-auto mb-6 max-w-xl rounded-xl bg-amber-50 px-4 py-3 text-center text-xs text-amber-900 print:hidden">
            Aucun départ n’est enregistré pour cette personne : le montant et le mode de
            règlement sortent en blanc. Saisissez le départ dans la section Sorties pour
            qu’ils figurent sur le reçu.
          </p>
        )}
      </div>
    </PortailImpression>
  )
}
