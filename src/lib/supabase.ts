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
  },
)

/** Domaine fictif utilisé pour mapper nom d'utilisateur → e-mail Supabase. */
export const AUTH_EMAIL_DOMAIN = 'pointage.local'

export function usernameToEmail(username: string): string {
  const clean = username.trim().toLowerCase()
  return clean.includes('@') ? clean : `${clean}@${AUTH_EMAIL_DOMAIN}`
}
