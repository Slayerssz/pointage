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
 * fois. Si la session ne se rafraîchit pas (jeton de rafraîchissement
 * lui-même périmé), on se déconnecte proprement : l'écran de connexion
 * vaut mieux qu'une erreur incompréhensible.
 */
let rafraichissementEnCours: Promise<boolean> | null = null

const rafraichir = (): Promise<boolean> => {
  if (!rafraichissementEnCours) {
    rafraichissementEnCours = supabase.auth
      .refreshSession()
      .then(({ data, error }) => {
        if (error || !data.session) {
          void supabase.auth.signOut()
          return false
        }
        return true
      })
      .finally(() => { rafraichissementEnCours = null })
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
