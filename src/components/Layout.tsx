import { NavLink, Outlet, useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

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
  entreprises: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M3 21h18M5 21V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14M9 9h2m2 0h2M9 13h2m2 0h2M9 17h2m2 0h2" />
    </svg>
  ),
}

export default function Layout() {
  const { companyId } = useParams()
  const { profile, signOut } = useAuth()

  const { data: company } = useQuery({
    queryKey: ['company', companyId],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .eq('id', companyId!)
        .single()
      if (error) throw error
      return data
    },
  })

  const tabs =
    profile?.role === 'admin'
      ? [
          { to: `/c/${companyId}/employes`, label: 'Employés', icon: ICONS.employes },
          { to: `/c/${companyId}/sorties`, label: 'Sorties', icon: ICONS.sorties },
          { to: `/c/${companyId}/validation`, label: 'Pointage', icon: ICONS.validation },
          { to: `/c/${companyId}/paie`, label: 'Paie', icon: ICONS.paie },
          { to: `/c/${companyId}/bulletins`, label: 'Bulletins', icon: ICONS.bulletins },
          { to: `/c/${companyId}/sites`, label: 'Sites', icon: ICONS.sites },
          { to: `/c/${companyId}/entreprises`, label: 'Entreprises', icon: ICONS.entreprises },
          { to: `/c/${companyId}/utilisateurs`, label: 'Utilisateurs', icon: ICONS.users },
          // Analytics en dernier : c'est l'écran le plus sensible
          { to: `/c/${companyId}/analytics`, label: 'Analytics', icon: ICONS.analytics },
        ]
      : profile?.role === 'validator'
        ? [
            { to: `/c/${companyId}/employes`, label: 'Employés', icon: ICONS.employes },
            { to: `/c/${companyId}/sorties`, label: 'Sorties', icon: ICONS.sorties },
            { to: `/c/${companyId}/validation`, label: 'Pointage', icon: ICONS.validation },
            // Le bureau couvre la paie ; l'inverse n'est pas vrai.
            { to: `/c/${companyId}/paie`, label: 'Paie', icon: ICONS.paie },
            { to: `/c/${companyId}/bulletins`, label: 'Bulletins', icon: ICONS.bulletins },
            { to: `/c/${companyId}/sites`, label: 'Sites', icon: ICONS.sites },
          ]
        : profile?.role === 'rh'
          ? [{ to: `/c/${companyId}/employes`, label: 'Employés', icon: ICONS.employes }]
          : profile?.role === 'paie'
            ? [
                { to: `/c/${companyId}/paie`, label: 'Paie', icon: ICONS.paie },
                { to: `/c/${companyId}/bulletins`, label: 'Bulletins', icon: ICONS.bulletins },
              ]
            : [{ to: `/c/${companyId}/pointage`, label: 'Pointage', icon: ICONS.pointage }]

  const navItem = (tab: (typeof tabs)[number]) => (
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
            <span className="ml-1 text-slate-500">
              (
              {profile?.role === 'admin'
                ? 'admin'
                : profile?.role === 'validator'
                  ? 'validateur'
                  : profile?.role === 'paie'
                    ? 'paie'
                    : profile?.role === 'rh'
                      ? 'personnel'
                      : 'agent'}
              )
            </span>
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

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around overflow-x-auto border-t border-slate-800 bg-slate-900 pb-[env(safe-area-inset-bottom)] md:hidden">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex min-w-16 flex-1 shrink-0 flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
                isActive ? 'text-emerald-400' : 'text-slate-400'
              }`
            }
          >
            {tab.icon}
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <main className="min-w-0 flex-1 px-4 pb-24 pt-18 md:ml-60 md:px-8 md:pb-10 md:pt-8">
        <Outlet />
      </main>
    </div>
  )
}
