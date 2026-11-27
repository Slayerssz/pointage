import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && anonKey)

// Nettoyage d'anciennes sessions mémorisées de façon permanente
// (avant, la connexion restait enregistrée dans localStorage).
try {
  for (const key of Object.keys(window.localStorage)) {
    if (key.startsWith('sb-')) window.localStorage.removeItem(key)
  }
} catch {
  // stockage indisponible : ignorer
}

/**
 * Le jeton d'accès vit une heure. Le rafraîchissement automatique repose
 * sur un minuteur — qui s'endort avec l'ordinateur. Au retour, la première
 * requête part avec un jeton mort et la base répond « JWT expired » ; l'écran
 * reste figé sur l'erreur.
 *
 * Ici, une telle réponse rafraîchit la session et rejoue la requête une
 * fois.
 *
 * CE QU'ON NE FAIT PLUS : se déconnecter quand le rafraîchissement
 * échoue. C'était la cause de l'écran de paie qui « se fermait tout
 * seul » : une coupure de réseau d'une seconde, ou un second onglet qui
 * renouvelle le jeton en premier — le jeton de rafraîchissement ne sert
 * qu'une fois — suffisait à renvoyer tout le monde à l'écran de
 * connexion, en perdant ce qui était saisi.
 *
 * Maintenant : on relit la session (un autre onglet l'a peut-être
 * renouvelée), on réessaie une fois, et si rien n'y fait on PRÉVIENT,
 * sans rien effacer. La page reste à l'écran, avec ce qui y est tapé.
 */
let rafraichissementEnCours: Promise<boolean> | null = null

/** Prévient l'application que la session est perdue, sans la fermer. */
export const EVENEMENT_SESSION_PERDUE = 'session-perdue'
const prevenir = () => {
  try { window.dispatchEvent(new Event(EVENEMENT_SESSION_PERDUE)) } catch { /* ignorer */ }
}

/** Une session encore valable pour au moins cinq secondes. */
const sessionVivante = async (): Promise<boolean> => {
  const { data } = await supabase.auth.getSession()
  const s = data.session
  return Boolean(s && (s.expires_at ?? 0) * 1000 > Date.now() + 5_000)
}

const rafraichir = (): Promise<boolean> => {
  if (!rafraichissementEnCours) {
    rafraichissementEnCours = (async () => {
      for (const essai of [0, 1]) {
        const { data, error } = await supabase.auth.refreshSession()
        if (!error && data.session) return true
        // Un autre onglet a pu renouveler avant nous : le jeton de
        // rafraîchissement est alors « déjà utilisé », mais la session
        // en mémoire est bonne.
        if (await sessionVivante()) return true
        // Une panne de réseau n'est pas une session morte : on laisse
        // passer une seconde et l'on réessaie une fois.
        if (essai === 0) await new Promise((r) => setTimeout(r, 1_000))
      }
      prevenir()
      return false
    })().finally(() => { rafraichissementEnCours = null })
  }
  return rafraichissementEnCours
}

const fetchAvecReprise: typeof fetch = async (entree, init) => {
  const reponse = await fetch(entree, init)
  if (reponse.status !== 401) return reponse

  let corps = ''
  try { corps = await reponse.clone().text() } catch { /* corps illisible */ }
  if (!/jwt expired|token is expired|invalid jwt/i.test(corps)) return reponse

  // Le point de terminaison d'authentification lui-même : ne pas boucler.
  const cible = typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url
  if (cible.includes('/auth/v1/')) return reponse

  if (!(await rafraichir())) return reponse

  const { data } = await supabase.auth.getSession()
  const jeton = data.session?.access_token
  if (!jeton) return reponse

  const entetes = new Headers(init?.headers)
  entetes.set('Authorization', `Bearer ${jeton}`)
  return fetch(entree, { ...init, headers: entetes })
}

export const supabase = createClient(
  url ?? 'https://placeholder.supabase.co',
  anonKey ?? 'placeholder',
  {
    auth: {
      // Session conservée uniquement tant que l'onglet/l'appli reste ouvert :
      // à chaque ouverture de l'application, il faut se reconnecter.
      storage: window.sessionStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
    global: { fetch: fetchAvecReprise },
  },
)

/** Domaine fictif utilisé pour mapper nom d'utilisateur → e-mail Supabase. */
export const AUTH_EMAIL_DOMAIN = 'pointage.local'

export function usernameToEmail(username: string): string {
  const clean = username.trim().toLowerCase()
  return clean.includes('@') ? clean : `${clean}@${AUTH_EMAIL_DOMAIN}`
}
