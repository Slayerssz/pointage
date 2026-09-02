import type { ModeleContrat } from './contratsModeles'
import { societeDe } from './societes'

/**
 * L'ENGAGEMENT DE CONGÉ ANNUEL — « التزام العطلة السنوية ».
 *
 * Un seul modèle pour les dix sociétés : c'est le salarié qui déclare
 * avoir pris son congé, pas l'employeur qui s'engage. Le document est en
 * arabe et se remplit en arabe, à l'exception du numéro de C.I.N. et des
 * dates, qui s'écrivent partout en caractères latins.
 *
 * Il réutilise la même structure que les contrats, donc le même écran de
 * saisie et le même rendu.
 */
export function modeleEngagement(entreprise: string | null | undefined): ModeleContrat {
  const s = societeDe(entreprise)

  return {
    titre: 'التزام',
    langue: 'ar',
    // « gauche » est le premier bloc : sur une page arabe il s'affiche à
    // droite, là où commence la lecture. C'est là que va la signature,
    // seule sur ce document.
    gauche: 'التوقيع',
    droite: '',
    champs: [
      { id: 'nom', label: 'الاسم الكامل — Nom et prénom', type: 'texte' },
      { id: 'cin', label: 'رقم البطاقة الوطنية — N° C.I.N.', type: 'texte', depuis: 'cin' },
      { id: 'sifa', label: 'الصفة — Qualité, fonction', type: 'texte' },
      { id: 'societe', label: 'الشركة — Société', type: 'texte' },
      { id: 'siege', label: 'العنوان — Siège de la société', type: 'long' },
      { id: 'annee', label: 'السنة — Année du congé', type: 'texte', aide: 'Par exemple : 2026' },
      { id: 'debut', label: 'تبدأ من — Date de début', type: 'date' },
      { id: 'fin', label: 'تنتهي يوم — Date de fin', type: 'date' },
      { id: 'duree', label: 'المدة — Durée', type: 'texte', aide: 'Par exemple : 18 يوما' },
    ],
    // Les valeurs que la société renseigne d'office.
    defauts: {
      societe: s?.raisonSociale ?? '',
      siege: s?.siegeAr ?? s?.siege ?? '',
    },
    blocs: [
      { type: 'para', texte: 'انا الموقع اسفله' },
      { type: 'espace' },
      {
        type: 'para',
        texte: 'السيد {{nom}} الحامل لبطاقة التعريف الوطنية رقم {{cin}}',
      },
      { type: 'para', texte: 'صفة {{sifa}}' },
      { type: 'para', texte: 'أعمل لصالح شركة {{societe}} الكائن {{siege}}' },
      { type: 'espace' },
      {
        type: 'para',
        texte:
          'أصرح بشرفي وأنا في كامل قواي العقلية بأنني استفدت من عطلتي السنوية {{annee}}',
      },
      {
        type: 'para',
        texte: 'التي تبدأ من {{debut}} وتنتهي يوم {{fin}} مدة {{duree}}',
      },
    ],
  }
}
