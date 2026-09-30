/**
 * LES COMPTES BANCAIRES D'UNE SOCIÉTÉ.
 *
 * La plupart n'en ont qu'un, et le champ ne contient alors que le
 * numéro. Groupe Triple A en a deux, et les annonce banque par banque :
 *
 *     BMCE: 011640000017210001250197 / CIH: 230640396300722101680001
 *
 * Un ordre de virement ne part que d'un compte à la fois — la banque
 * qui l'exécute n'a que faire de l'autre. On demande donc lequel, et
 * seul son numéro paraît sur la feuille.
 */
export interface CompteBancaire {
  /** Le nom de la banque, quand le champ le précise. */
  banque: string | null
  rib: string
}

export function comptesDe(ribOrdinateur: string | null | undefined): CompteBancaire[] {
  const brut = (ribOrdinateur ?? '').trim()
  if (!brut) return []
  return brut
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const i = part.indexOf(':')
      if (i < 0) return { banque: null, rib: part.replace(/\s/g, '') }
      return {
        banque: part.slice(0, i).trim().toUpperCase() || null,
        rib: part.slice(i + 1).replace(/\s/g, ''),
      }
    })
    .filter((c) => c.rib.length > 0)
}

/** Le libellé d'un compte, pour le proposer au choix. */
export const nomDuCompte = (c: CompteBancaire) => c.banque ?? 'Compte de la société'
