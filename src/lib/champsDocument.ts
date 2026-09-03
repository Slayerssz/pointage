import { formatDateFr } from './dates'
import type { ChampContrat, ModeleContrat } from './contratsModeles'
import type { Employee } from './types'

/**
 * Le pont entre le formulaire et le document imprimé.
 *
 * Un contrat ou un engagement se remplit une seule fois : ce que le
 * formulaire connaît déjà — le nom, les dates, le salaire — alimente le
 * document sans qu'on le retape. Ne restent à saisir que les mentions
 * qui n'existent nulle part ailleurs : le numéro du marché, la qualité en
 * arabe, la durée en toutes lettres.
 */

/** Les champs du modèle que le formulaire ne couvre pas : à saisir à la main. */
export function champsASaisir(
  modele: ModeleContrat | null,
  couverts: string[],
): ChampContrat[] {
  if (!modele) return []
  return modele.champs.filter((c) => !couverts.includes(c.id))
}

/**
 * Ce que le dossier de l'employé apporte au document.
 *
 * Sur une pièce en arabe, le nom, l'adresse et la ville ne sont pas repris :
 * le registre les écrit en caractères latins et la pièce se remplit en
 * arabe. Les préremplir obligerait à effacer avant d'écrire. Le C.I.N.,
 * les dates et les montants s'écrivent pareil dans les deux langues.
 */
export function valeursEmploye(
  employee: Employee,
  modele: ModeleContrat | null,
): Record<string, string> {
  const arabe = modele?.langue === 'ar'
  const v: Record<string, string> = {
    cin: employee.cin ?? '',
    naissance: employee.date_naissance ? formatDateFr(employee.date_naissance) : '',
    mode_reglement: employee.mode_reglement ?? '',
  }
  if (!arabe) {
    v.nom = employee.nom_prenom ?? ''
    v.adresse = [employee.adresse, employee.ville].filter(Boolean).join(', ')
    v.fait_a = employee.ville ?? ''
  }
  // Le reçu de solde nomme le mode de règlement dans sa phrase.
  v.mode = employee.mode_reglement ?? ''
  return v
}

/** Une date ISO du formulaire, telle qu'elle s'imprime sur le document. */
export function dateDoc(iso: string | null | undefined): string {
  return iso ? formatDateFr(iso) : ''
}
