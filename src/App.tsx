import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import CompanySelectPage from './pages/CompanySelectPage'
import AgentPointagePage from './pages/agent/AgentPointagePage'
import ValidationPage from './pages/validator/ValidationPage'
import EmployesPage from './pages/validator/EmployesPage'
import AnalyticsPage from './pages/admin/AnalyticsPage'
import UsersPage from './pages/admin/UsersPage'
import OrganisationsPage from './pages/admin/OrganisationsPage'
import SitesPage from './pages/validator/SitesPage'
import PaiePage from './pages/paie/PaiePage'
import BulletinsPage from './pages/paie/BulletinsPage'
import VerrouMotDePasse from './components/VerrouMotDePasse'
import { Spinner } from './components/ui'
import type { UserRole } from './lib/types'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Chargement…" />
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  if (!profile) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center text-sm text-slate-600">
        <p className="font-medium text-red-600">Profil introuvable.</p>
        <p className="mt-2">
          Votre compte existe mais aucun profil (rôle) ne lui est associé. Contactez
          l'administrateur.
        </p>
      </div>
    )
  }
  return <>{children}</>
}

/** Redirige l'index de l'entreprise vers l'onglet par défaut du rôle. */
function CompanyIndexRedirect() {
  const { profile } = useAuth()
  const { companyId } = useParams()
  const target =
    profile?.role === 'admin'
      ? 'employes'
      : profile?.role === 'validator' || profile?.role === 'rh'
        ? 'employes'
        : profile?.role === 'paie'
          ? 'paie'
          : 'pointage'
  return <Navigate to={`/c/${companyId}/${target}`} replace />
}

function RequireRole({ roles, children }: { roles: UserRole[]; children: React.ReactNode }) {
  const { profile } = useAuth()
  const { companyId } = useParams()
  if (!profile || !roles.includes(profile.role)) {
    return <Navigate to={`/c/${companyId}`} replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <CompanySelectPage />
                </RequireAuth>
              }
            />
            <Route
              path="/c/:companyId"
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route index element={<CompanyIndexRedirect />} />
              <Route
                path="pointage"
                element={
                  <RequireRole roles={['agent', 'admin']}>
                    <AgentPointagePage />
                  </RequireRole>
                }
              />
              <Route
                path="validation"
                element={
                  <RequireRole roles={['validator', 'admin']}>
                    <ValidationPage />
                  </RequireRole>
                }
              />
              <Route
                path="employes"
                element={
                  <RequireRole roles={['validator', 'admin', 'rh']}>
                    <EmployesPage />
                  </RequireRole>
                }
              />
              <Route
                path="sites"
                element={
                  <RequireRole roles={['validator', 'admin']}>
                    <SitesPage />
                  </RequireRole>
                }
              />
              <Route
                path="paie"
                element={
                  <RequireRole roles={['paie', 'admin']}>
                    <PaiePage />
                  </RequireRole>
                }
              />
              <Route
                path="bulletins"
                element={
                  <RequireRole roles={['paie', 'admin']}>
                    <BulletinsPage />
                  </RequireRole>
                }
              />
              <Route
                path="analytics"
                element={
                  <RequireRole roles={['admin']}>
                    <VerrouMotDePasse
                      titre="Analytics"
                      explication="Cet écran affiche l’ensemble des effectifs et des chiffres de l’entreprise. Ressaisissez votre mot de passe pour l’ouvrir, même si la session est déjà ouverte."
                    >
                      <AnalyticsPage />
                    </VerrouMotDePasse>
                  </RequireRole>
                }
              />
              <Route
                path="entreprises"
                element={
                  <RequireRole roles={['admin']}>
                    <OrganisationsPage />
                  </RequireRole>
                }
              />
              <Route
                path="utilisateurs"
                element={
                  <RequireRole roles={['admin']}>
                    <UsersPage />
                  </RequireRole>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
