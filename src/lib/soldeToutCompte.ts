import type { ModeleContrat } from './contratsModeles'
import { societeDe } from './societes'

/**
 * REÇU POUR SOLDE DE TOUT COMPTE.
 *
 * Le papier que le salarié signe en partant : il y reconnaît avoir touché
 * tout ce qui lui était dû. Un seul modèle pour les dix sociétés.
 *
 * L'article 75 du code du travail y est cité tel quel — il donne au
 * salarié soixante jours pour dénoncer ce reçu. Ce n'est pas une formule
 * de style : c'est ce qui rend le document opposable.
 */
export function modeleSolde(entreprise: string | null | undefined): ModeleContrat {
  const s = societeDe(entreprise)

  return {
    titre: 'RECU POUR SOLDE DE TOUT COMPTE',
    langue: 'fr',
    gauche: '',
    droite: 'Signature',
    champs: [
      { id: 'nom', label: 'Nom et prénom', type: 'texte', depuis: 'nom_prenom' },
      { id: 'cin', label: 'N° C.I.N.', type: 'texte', depuis: 'cin' },
      { id: 'adresse', label: 'Demeurant à', type: 'long', depuis: 'adresse' },
      { id: 'societe', label: 'Société', type: 'texte' },
      { id: 'siege', label: 'Siège de la société', type: 'long' },
      { id: 'patente', label: 'N° Patente', type: 'texte' },
      { id: 'rc', label: 'R.C.', type: 'texte' },
      { id: 'montant', label: 'Somme versée (DH)', type: 'texte' },
      { id: 'mode', label: 'Payée en', type: 'texte', depuis: 'mode_reglement' },
      { id: 'fait_le', label: 'Fait le', type: 'date' },
    ],
    defauts: {
      societe: s?.raisonSociale ?? '',
      siege: s?.siege ?? '',
      patente: s?.patente ?? '',
      rc: s?.rc ?? '',
    },
    blocs: [
      { type: 'para', texte: 'Je Soussigné(e) : {{nom}}     CIN : {{cin}}' },
      { type: 'para', texte: 'Demeurant : {{adresse}}' },
      { type: 'espace' },
      { type: 'para', texte: 'Reconnais avoir reçu de la société : {{societe}} sise {{siege}}' },
      { type: 'para', texte: 'N° Patente : {{patente}}     RC : {{rc}}' },
      { type: 'espace' },
      { type: 'para', texte: 'Mon certificat de travail, et' },
      {
        type: 'para',
        texte:
          'Pour SOLDE DE TOUT COMPTE, La Somme de {{montant}} DH payée En {{mode}}',
      },
      {
        type: 'para',
        texte:
          'En paiement des salaires, accessoires de salaires, remboursements de frais et toutes indemnités, quels qu’en soient la nature ou le montant, qui m’étaient dus au titre de l’exécution et de la cessation de mon contrat de travail.',
      },
      {
        type: 'para',
        texte:
          'Je déclare connaitre les dispositions de l’article 75 du Code du travail, qui me confère le droit de dénoncer ce reçu pour solde de tout compte dans délai maximum de 60 jours à partir de la date de signature du présent.',
      },
      {
        type: 'para',
        texte: 'Le présent reçu a été établi en deux exemplaires, dont un m’a été remis.',
      },
      { type: 'espace' },
      { type: 'para', texte: 'Fait le {{fait_le}}' },
    ],
  }
}
