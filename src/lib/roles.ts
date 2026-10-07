import type { UserRole } from './types'

/**
 * QUI PASSE OÙ.
 *
 * Le propriétaire et le développeur sont au-dessus de l'administrateur,
 * et passent donc partout où il passe. La base dit la même chose à sa
 * façon : `current_user_role` les présente comme administrateurs à tous
 * ses contrôles.
 *
 * Ce fichier existe parce que l'oubli s'est produit : les onglets
 * savaient reconnaître ces deux rôles, les gardes de route non — on
 * voyait les onglets et toutes les pages se refusaient. Mieux vaut une
 * seule réponse à la question qu'une dizaine éparpillées.
 */
const AU_DESSUS: UserRole[] = ['owner', 'dev']

/** Ce rôle est-il au-dessus de l'administrateur ? */
export const estAuDessus = (role: UserRole | undefined | null) =>
  Boolean(role && AU_DESSUS.includes(role))

/** Ce rôle a-t-il au moins les droits de l'administrateur ? */
export const estAdministrateur = (role: UserRole | undefined | null) =>
  role === 'admin' || estAuDessus(role)

/**
 * Ce rôle ouvre-t-il une page réservée à `roles` ? Demander
 * l'administrateur, c'est accepter ceux qui sont au-dessus de lui.
 */
export function aLeDroit(role: UserRole | undefined | null, roles: UserRole[]): boolean {
  if (!role) return false
  if (roles.includes(role)) return true
  return roles.includes('admin') && estAuDessus(role)
}
