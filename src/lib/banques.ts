/**
 * Les banques du menu déroulant de la fiche employé.
 *
 * La liste est fixe : c'est celle relevée dans le registre en septembre
 * 2026, une fois les orthographes mises au propre. Une banque tapée d'une
 * seule façon fait un seul groupe sur la liste des versements ; une liste
 * fermée est ce qui garantit cela. « Autre banque… » reste possible pour
 * une banque vraiment nouvelle — elle s'ajoute ici ensuite.
 */
export const BANQUES = [
  'AL BARID BANK',
  'AL BARID CASH',
  'ASSAFA BANK',
  'ATTIJARIWAFA BANK',
  'BANQUE POPULAIRE',
  'BMCE BANK',
  'BMCI',
  'CASH PLUS',
  'CIH BANK',
  'CREDIT AGRICOLE',
  'CREDIT DU MAROC',
  'DAMANE CASH',
  'SAHAM BANK',
  'SOCIETE GENERALE',
  'TRESORERIE GENERALE',
  'UMNIA BANK',
  'WAFACASH',
] as const

/**
 * Les anciennes orthographes, ramenées à la banque qu'elles désignaient.
 * Adam a confirmé les trois paires le 15 septembre 2026. La base a été
 * corrigée le même jour (FUSIONNER_banques.sql) ; ceci rattrape une fiche
 * qui aurait échappé à la correction.
 */
const ANCIENNES: Record<string, string> = {
  'ATTIJARI WAFA BANK': 'ATTIJARIWAFA BANK',
  'BMCE': 'BMCE BANK',
  'BARID CASH': 'AL BARID CASH',
  'TRESORERIE GENERAL': 'TRESORERIE GENERALE',
}

/** La forme sous laquelle une banque est comparée et enregistrée. */
export function normaliserBanque(v: string | null | undefined): string {
  const n = (v ?? '').trim().replace(/\s+/g, ' ').toUpperCase()
  return ANCIENNES[n] ?? n
}
