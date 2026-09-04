export type UserRole = 'agent' | 'validator' | 'admin' | 'paie' | 'rh'
export type PointageStatus = 'pending' | 'validated' | 'refused'

export interface Profile {
  user_id: string
  username: string
  full_name: string | null
  role: UserRole
}

export interface Company {
  id: string
  name: string
}

/** Une « annexe » : c'est là que les employés sont rattachés. */
export interface Site {
  id: string
  company_id: string
  name: string
  pointage_actif: boolean
  /** Site principal de rattachement (null = annexe indépendante). */
  site_principal_id: string | null
}

/** Un regroupement d'annexes (ex. « LA COMMUNE »). */
export interface SitePrincipal {
  id: string
  company_id: string
  name: string
}

export interface Employee {
  id: string
  company_id: string
  site_id: string
  matricule: number | null
  nom_prenom: string
  cin: string | null
  cnss: string | null
  date_naissance: string | null
  date_embauche: string | null
  qualification: string | null
  /** Branche d'activité (NETTOYAGE, SÉCURITÉ…), distincte du poste. */
  departement: string | null
  adresse: string | null
  ville: string | null
  mode_reglement: string | null
  telephone: string | null
  jour_de_repos: number | null
  jours_travailles: number
  actif: boolean
  rib: string | null
  banque: string | null
  salaire: number | null
  /** Durée d'une garde normale, en heures (ex. 8). */
  heures_par_jour: number | null
  /** Ce que l'employé doit encore. La paie le fait baisser à la validation. */
  dette: number
  /** Matin, nuit ou journée. Null quand l'horaire n'est pas fixe. */
  horaire: Horaire | null
  situation_familiale: SituationFamiliale | null
  nombre_enfants: number
  /** Photo de profil, chemin dans le bucket « photos ». */
  photo_path: string | null
  date_sortie: string | null
}

export type Horaire = 'MATIN' | 'NUIT' | 'JOURNEE'

export const HORAIRES: { code: Horaire; label: string }[] = [
  { code: 'MATIN', label: 'Matin' },
  { code: 'NUIT', label: 'Nuit' },
  { code: 'JOURNEE', label: 'Journée' },
]

export type SituationFamiliale = 'Célibataire' | 'Marié(e)' | 'Divorcé(e)' | 'Veuf/Veuve'

export const SITUATIONS_FAMILIALES: SituationFamiliale[] = [
  'Célibataire', 'Marié(e)', 'Divorcé(e)', 'Veuf/Veuve',
]

/** Les situations pour lesquelles on demande le nombre d'enfants. */
export const SITUATIONS_AVEC_ENFANTS: SituationFamiliale[] = [
  'Marié(e)', 'Divorcé(e)', 'Veuf/Veuve',
]

/** Pièce signée scannée : engagement de congé, contrat légalisé… */
export interface Document {
  id: string
  company_id: string
  employee_id: string
  type: 'engagement' | 'contrat' | 'sortie' | 'autre'
  conge_id: string | null
  contrat_id: string | null
  chemin: string
  nom_fichier: string
  mime: string | null
  taille: number | null
  libelle: string | null
  created_at: string
}

export interface Pointage {
  id: string
  company_id: string
  site_id: string
  employee_id: string
  agent_id: string
  photo_path: string | null
  pointed_at: string
  pointed_on: string
  status: PointageStatus
  type_garde: string | null
  conge_id: string | null
  validated_by: string | null
  validated_at: string | null
}

/** Paramètres de calcul de la paie, propres à chaque entreprise. */
export interface ParametresPaie {
  company_id: string
  jours_base: number
  maladie_payee: boolean
  conge_paye: boolean
  heures_par_jour_defaut: number | null
  devise: string
}

// --- Contrats ---------------------------------------------------------------

export type TypeContrat = 'CONTRAT' | 'STAGE'

/** `bientot` → bleu (fin dans ≤ 10 j) · `termine` → jaune (fin dépassée) */
export type ContratStatut = 'actif' | 'bientot' | 'termine' | 'a_venir'

export interface Contrat {
  id: string
  company_id: string
  employee_id: string
  numero: string | null
  type_contrat: TypeContrat
  date_debut: string
  /** Obligatoire : c'est elle qui déclenche les alertes de fin. */
  date_fin: string
  periode_essai_jours: number | null
  poste: string | null
  lieu_travail: string | null
  salaire_mensuel: number | null
  heures_par_jour: number | null
  mode_reglement: string | null
  signe_a: string | null
  signe_le: string | null
  representant_employeur: string | null
  observations: string | null
  archive: boolean
  /** Les mentions du document imprimé qui n'ont pas de colonne à elles :
   *  numéro de marché, durée en toutes lettres, qualité en arabe… */
  champs_document: Record<string, string> | null
  /** Renseignée quand le contrat signé a été scanné. Sans elle, rien n'engage. */
  valide_le: string | null
  created_at: string
}

export interface ContratCourant {
  id: string
  employee_id: string
  company_id: string
  numero: string | null
  type_contrat: TypeContrat
  date_debut: string
  date_fin: string | null
  poste: string | null
  salaire_mensuel: number | null
  statut: ContratStatut
  jours_restants: number | null
}

// --- Congés & absences ------------------------------------------------------

export type TypeConge = 'C' | 'M'

export interface Conge {
  id: string
  company_id: string
  employee_id: string
  type: TypeConge
  date_debut: string
  date_fin: string
  motif: string | null
  jours: number
  /** Idem, pour l'engagement de congé signé par le salarié. */
  champs_document: Record<string, string> | null
  /** Renseignée quand l'engagement signé a été scanné. */
  valide_le: string | null
  created_at: string
}

// --- Paie -------------------------------------------------------------------

export type PeriodeStatut =
  | 'ouvert'
  | 'pointage_valide'
  | 'paie_validee'
  | 'reouverture_demandee'

export interface PeriodePaie {
  id: string
  company_id: string
  annee: number
  mois: number
  statut: PeriodeStatut
  jours_base: number
  maladie_payee: boolean
  conge_paye: boolean
  pointage_valide_le: string | null
  paie_validee_le: string | null
  reouverture_motif: string | null
  reouverture_demandee_le: string | null
}

export interface LignePaie {
  id: string
  periode_id: string
  employee_id: string
  matricule: number | null
  nom_prenom: string
  cin: string | null
  cnss: string | null
  site_id: string | null
  site_nom: string | null
  site_principal_nom: string | null
  qualification: string | null
  mode_reglement: string | null
  banque: string | null
  rib: string | null
  salaire_base: number
  jours_base: number
  heures_par_jour: number | null
  gardes_travaillees: number
  jours_conge: number
  jours_maladie: number
  /** Colonne héritée : plus alimentée depuis le retrait de CS / AJ. */
  jours_sans_solde: number
  jours_absent: number
  jours_repos: number
  jours_payes: number
  heures_effectuees: number | null
  salaire_brut: number
  prime: number
  retenue_dette: number
  autres_retenues: number
  net_a_payer: number
  observations: string | null
}

export interface TotauxPeriode {
  employes: number
  total_brut: number
  total_primes: number
  total_dettes: number
  total_autres_retenues: number
  total_net: number
  total_virement: number
  total_especes: number
  par_banque: { banque: string; n: number; montant: number }[]
}

/** Une entrée du bulletin journalier : un site et les employés qui y ont travaillé. */
export interface BulletinSite {
  site_id: string
  site: string
  employes: {
    employee_id: string
    matricule: number | null
    nom_prenom: string
    qualification: string | null
    cin: string | null
    type_garde: string | null
    heure: string | null
    photo: boolean
  }[]
}
