/**
 * L'identité légale des dix sociétés, telle qu'elle figure sur leurs
 * contrats : la raison sociale exacte et le siège. Les documents qui les
 * citent puisent ici, pour qu'une adresse ne soit pas écrite de deux
 * façons selon la pièce qu'on imprime.
 */
export interface Societe {
  raisonSociale: string
  siege: string
  /** Le siège en arabe, quand la société édite des pièces en arabe. */
  siegeAr?: string
  /** Les identifiants qui figurent sur le reçu pour solde de tout compte.
   *  Absents tant que la société ne les a pas communiqués : le reçu sort
   *  alors avec des pointillés, à compléter à la main. */
  rc?: string
  patente?: string
  if?: string
  ice?: string
}

const SOCIETES: Record<string, Societe> = {
  'BO': {
    raisonSociale: 'B.O NETTOYAGE S.A.R.L',
    siege: 'Lot Florencia Imm10 Appt N°4, 2eme Etage Route de Rabat-Tanger',
  },
  'DUO MULTI SERVICE': {
    raisonSociale: 'DUO MULTI SERVICE SARL',
    siege: 'AV MLY YOUSSEF IMM AL FATH BLOC A 5EME ETG NO 17 TANGER',
  },
  'GROUPE TRIPLE A': {
    raisonSociale: 'GROUPE TRIPLE AAA',
    siege: 'Lot Florencia Imm 10 Apt 2 Etage 01 Rte de Rabat Av des F.A.R -Tanger',
  },
  'MEGAINTER SERVICE MAROC': {
    raisonSociale: 'MEGAINTER SERVICE MAROC',
    siege: 'Rés Chaouia Av Youssef Ibn Tachfine Rue Rachid Reda 4éme Etg N°21-Tanger',
  },
  'NORD PLANET': {
    raisonSociale: 'NORD PLANET NEGOCE S.A.R.L',
    siege: '05 Complexe Panamaribo Rés Rachid 2eme Etage Immb 09 Rte Asilah Tanger',
  },
  'TRIMAX': {
    raisonSociale: 'TRIMAX SURVEILLANCE SARL',
    siege: '12 COMP AL FIRDAOUS IMM 12 ETAGE 05 N°18 TANGER',
  },
  'SERCLEAN NEGOCE': {
    raisonSociale: 'SERCLEAN NEGOCE SARL AU',
    siege: 'Rue de Russie Rés Nil Bloc C N°06 B Tanger',
  },
  'VIGILMA GARD MAROC': {
    raisonSociale: 'VIGILMA GARD MAROC SARL',
    siege: 'DRADEB 1 RUE 2 N°35 2ème ÉTAGE, TANGER',
    rc: '135975', patente: '50211305', if: '53692100', ice: '003258325000054',
  },
  'AL SAFAE EL MAGHREB': {
    raisonSociale: 'AL SAFAE EL MAGHREB',
    siege: 'Dradeb 1 Rue 2 N°35, 3ème étage, Tanger',
    siegeAr: 'درادب 1 زنقة 2 رقم 35 الطابق الثالث طنجة',
  },
  'EDEN VERT SERVICE': {
    raisonSociale: 'EDEN VERT SERVICE',
    siege: 'Tanger',
    siegeAr: 'طنجة',
  },
}

function cle(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

const PAR_CLE = new Map(Object.entries(SOCIETES).map(([k, v]) => [cle(k), v]))
// La même société, selon qu'on lise la base ou ses papiers.
PAR_CLE.set(cle('MEGANTER SERVICE MAROC'), SOCIETES['MEGAINTER SERVICE MAROC'])

export function societeDe(nom: string | null | undefined): Societe | null {
  if (!nom) return null
  return PAR_CLE.get(cle(nom)) ?? null
}
