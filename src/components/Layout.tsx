import { useState } from 'react'
import { NavLink, Outlet, useParams, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useSociete } from '../lib/queries'

/**
 * La barre du bas d'un téléphone tient quatre entrées, pas dix. Les
 * onglets marqués `principal` y restent ; les autres se rangent derrière
 * « Plus », qui les montre tous — y compris les quatre, pour qu'on n'ait
 * jamais à se demander où chercher.
 */
const AU_PLUS_EN_BAS = 4

function roleLisible(role: string | null | undefined) {
  return role === 'admin' ? 'admin'
    : role === 'validator' ? 'validateur'
    : role === 'paie' ? 'paie'
    : role === 'rh' ? 'personnel'
    : 'agent'
}

interface Onglet {
  to: string
  label: string
  /** Nom court pour la barre du bas, où la place manque. */
  court?: string
  icon: React.ReactNode
  /** Vrai si l'onglet a sa place dans la barre du bas. */
  principal?: boolean
}

const ICONS = {
  pointage: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M12 8v4l2.5 2.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  ),
  sorties: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  ),
  employes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M17 20h5v-1a4 4 0 0 0-4-4h-1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 0a3 3 0 1 0-2-5.2M2 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1H2Z" />
    </svg>
  ),
  validation: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="m9 12 2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  ),
  analytics: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M3 3v18h18M7 15l3-4 3 3 4-6" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  paie: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  bulletins: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6ZM14 2v6h6M8 13h8M8 17h5" />
    </svg>
  ),
  sites: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  feries: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      <path d="m9 16 2 2 4-4" />
    </svg>
  ),
  entreprises: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M3 21h18M5 21V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14M9 9h2m2 0h2M9 13h2m2 0h2M9 17h2m2 0h2" />
    </svg>
  ),
}

export default function Layout() {
  const { companyId } = useParams()
  const { profile, signOut } = useAuth()
  const { pathname } = useLocation()
  const [menu, setMenu] = useState(false)

  const { data: company } = useSociete(companyId)

  const tabs: Onglet[] =
    profile?.role === 'admin'
      ? [
          { to: `/c/${companyId}/employes`, label: 'Employés', icon: ICONS.employes, principal: true },
          { to: `/c/${companyId}/sorties`, label: 'Sorties', icon: ICONS.sorties },
          { to: `/c/${companyId}/validation`, label: 'Pointage', icon: ICONS.validation, principal: true },
          { to: `/c/${companyId}/paie`, label: 'Paie', icon: ICONS.paie, principal: true },
          { to: `/c/${companyId}/bulletins`, label: 'Bulletins de paie', court: 'Bulletins',
            icon: ICONS.bulletins, principal: true },
          { to: `/c/${companyId}/sites`, label: 'Sites', icon: ICONS.sites },
          { to: `/c/${companyId}/feries`, label: 'Jours fériés', icon: ICONS.feries },
          { to: `/c/${companyId}/entreprises`, label: 'Entreprises', icon: ICONS.entreprises },
          { to: `/c/${companyId}/utilisateurs`, label: 'Utilisateurs', icon: ICONS.users },
          // Analytics en dernier : c'est l'écran le plus sensible
          { to: `/c/${companyId}/analytics`, label: 'Analytics', icon: ICONS.analytics },
        ]
      : profile?.role === 'validator'
        ? [
            { to: `/c/${companyId}/employes`, label: 'Employés', icon: ICONS.employes, principal: true },
            { to: `/c/${companyId}/sorties`, label: 'Sorties', icon: ICONS.sorties },
            { to: `/c/${companyId}/validation`, label: 'Pointage', icon: ICONS.validation, principal: true },
            // Le bureau couvre la paie ; l'inverse n'est pas vrai.
            { to: `/c/${companyId}/paie`, label: 'Paie', icon: ICONS.paie, principal: true },
            { to: `/c/${companyId}/bulletins`, label: 'Bulletins de paie', court: 'Bulletins',
            icon: ICONS.bulletins, principal: true },
            { to: `/c/${companyId}/sites`, label: 'Sites', icon: ICONS.sites },
          ]
        : profile?.role === 'rh'
          ? [{ to: `/c/${companyId}/employes`, label: 'Employés', icon: ICONS.employes }]
          : profile?.role === 'paie'
            ? [
                { to: `/c/${companyId}/paie`, label: 'Paie', icon: ICONS.paie, principal: true },
                { to: `/c/${companyId}/bulletins`, label: 'Bulletins de paie', court: 'Bulletins',
            icon: ICONS.bulletins, principal: true },
              ]
            : [{ to: `/c/${companyId}/pointage`, label: 'Pointage', icon: ICONS.pointage, principal: true }]

  const enBas = tabs.length <= AU_PLUS_EN_BAS + 1
    ? tabs
    : tabs.filter((t) => t.principal).slice(0, AU_PLUS_EN_BAS)
  const dansLeMenu = tabs.filter((t) => !enBas.includes(t))
  // « Plus » s'allume quand c'est derrière lui que se trouve la page ouverte.
  const ailleurs = dansLeMenu.some((t) => pathname.startsWith(t.to))

  const navItem = (tab: Onglet) => (
    <NavLink
      key={tab.to}
      to={tab.to}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
          isActive
            ? 'bg-emerald-600 text-white'
            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
        }`
      }
    >
      {tab.icon}
      <span>{tab.label}</span>
    </NavLink>
  )

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col bg-slate-900 p-4 md:flex">
        <Link to="/" className="mb-8 flex items-center gap-3 px-1">
          <svg viewBox="0 0 64 64" className="h-8 w-8 shrink-0">
            <rect width="64" height="64" rx="14" fill="#1e293b" />
            <path
              d="M18 34 L28 44 L47 22"
              fill="none"
              stroke="#34d399"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{company?.name ?? '…'}</p>
            <p className="text-xs text-slate-400">Pointage</p>
          </div>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">{tabs.map(navItem)}</nav>
        <div className="border-t border-slate-800 pt-3">
          <p className="truncate px-1 text-xs text-slate-400">
            {profile?.full_name || profile?.username}
            <span className="ml-1 text-slate-500">({roleLisible(profile?.role)})</span>
          </p>
          <button
            onClick={signOut}
            className="mt-2 w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Top bar (mobile) */}
      <header className="fixed inset-x-0 top-0 z-20 flex h-14 items-center justify-between bg-slate-900 px-4 md:hidden">
        <Link to="/" className="flex items-center gap-2">
          <svg viewBox="0 0 64 64" className="h-7 w-7">
            <rect width="64" height="64" rx="14" fill="#1e293b" />
            <path
              d="M18 34 L28 44 L47 22"
              fill="none"
              stroke="#34d399"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="max-w-[50vw] truncate text-sm font-semibold text-white">
            {company?.name ?? 'Pointage'}
          </span>
        </Link>
        <button onClick={signOut} className="text-sm font-medium text-slate-300">
          Déconnexion
        </button>
      </header>

      {/* Barre du bas (téléphone) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-800 bg-slate-900 pb-[env(safe-area-inset-bottom)] md:hidden">
        {enBas.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium leading-tight ${
                isActive ? 'text-emerald-400' : 'text-slate-400'
              }`
            }
          >
            {tab.icon}
            <span className="text-center">{tab.court ?? tab.label}</span>
          </NavLink>
        ))}
        {dansLeMenu.length > 0 && (
          <button
            onClick={() => setMenu(true)}
            className={`flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium leading-tight ${
              ailleurs ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span>Plus</span>
          </button>
        )}
      </nav>

      {/* Ce que « Plus » ouvre : tous les onglets, et le compte. */}
      {menu && (
        <div
          className="fixed inset-0 z-30 flex items-end bg-black/50 md:hidden"
          onClick={() => setMenu(false)}
        >
          <div
            className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-slate-900 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-700" />
            <nav className="flex flex-col gap-1" onClick={() => setMenu(false)}>
              {tabs.map(navItem)}
            </nav>
            <p className="mt-3 border-t border-slate-800 px-1 pt-3 text-xs text-slate-400">
              {profile?.full_name || profile?.username}
              <span className="ml-1 text-slate-500">({roleLisible(profile?.role)})</span>
            </p>
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 pb-24 pt-18 md:ml-60 md:px-8 md:pb-10 md:pt-8">
        <Outlet />
      </main>
    </div>
  )
}
