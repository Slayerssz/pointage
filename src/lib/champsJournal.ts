/**
 * LE NOM DES COLONNES, EN FRANÇAIS.
 *
 * Le journal relève ce qui a changé colonne par colonne, sous le nom
 * que porte la base. « date_naissance » ne se lit pas ; « Date de
 * naissance », si. Ce qui n'est pas traduit ici paraît tel quel —
 * mieux vaut un nom technique qu'une ligne manquante.
 */
const NOMS: Record<string, string> = {
  // Employé
  nom_prenom: 'Nom et prénom',
  matricule: 'Matricule',
  cin: 'C.I.N.',
  cnss: 'N° C.N.S.S.',
  date_naissance: 'Date de naissance',
  date_embauche: 'Date d’embauche',
  date_sortie: 'Date de sortie',
  qualification: 'Qualification',
  departement: 'Département',
  telephone: 'Téléphone',
  adresse: 'Adresse',
  ville: 'Ville',
  site_id: 'Annexe',
  salaire: 'Salaire',
  heures_par_jour: 'Heures par jour',
  horaire: 'Horaire',
  jour_de_repos: 'Jour de repos',
  mode_reglement: 'Mode de règlement',
  banque: 'Banque',
  rib: 'R.I.B.',
  dette: 'Dette',
  situation_familiale: 'Situation familiale',
  nombre_enfants: 'Nombre d’enfants',
  photo_path: 'Photo',
  archive_le: 'Archivé le',
  // Pointage
  pointed_on: 'Jour',
  type_garde: 'Type de garde',
  status: 'État',
  validated_at: 'Validé le',
  validated_by: 'Validé par',
  // Congé, contrat
  date_debut: 'Début',
  date_fin: 'Fin',
  type_contrat: 'Type de contrat',
  motif: 'Motif',
  // Paie
  annee: 'Année',
  mois: 'Mois',
  statut: 'Statut',
  jours_base: 'Jours de base',
  // Compte
  username: 'Nom d’utilisateur',
  full_name: 'Nom complet',
  role: 'Rôle',
  // Société, site
  name: 'Nom',
  rib_ordinateur: 'R.I.B. de l’ordinateur',
  site_principal_id: 'Site principal',
}

export const nomDuChamp = (champ: string) => NOMS[champ] ?? champ

/** L'objet dont il s'agit, pour le titre de la fenêtre. */
const OBJETS: Record<string, string> = {
  employees: 'Fiche employé',
  pointages: 'Pointage',
  conges: 'Congé',
  contrats: 'Contrat',
  periodes_paie: 'Paie du mois',
  profiles: 'Compte',
  companies: 'Société',
  sites: 'Site',
}

export const nomDeLObjet = (objet: string) => OBJETS[objet] ?? objet

/**
 * Une valeur telle qu'on la lit. Le journal garde du JSON brut : une
 * date y est une chaîne ISO, un booléen un vrai booléen, et l'absence
 * de valeur un `null` qu'il vaut mieux écrire « — » que « null ».
 */
export function valeurLisible(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non'
  if (typeof v === 'string') {
    // Une date ISO, seule ou avec son heure.
    const d = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2})?/.exec(v)
    if (d) return `${d[3]}/${d[2]}/${d[1]}`
    return v
  }
  if (typeof v === 'number') return v.toLocaleString('fr-FR')
  return JSON.stringify(v)
}
