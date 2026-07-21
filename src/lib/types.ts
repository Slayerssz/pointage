export type UserRole = 'agent' | 'validator'
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

export interface Site {
  id: string
  company_id: string
  name: string
  pointage_actif: boolean
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
  date_sortie: string | null
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
  validated_by: string | null
  validated_at: string | null
}
