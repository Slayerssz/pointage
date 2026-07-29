import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { formatDateFr } from '../../lib/dates'
import { Chip, EmptyState, ErrorNote, Spinner } from '../../components/ui'

interface AdminUser {
  user_id: string
  username: string
  full_name: string | null
  role: 'agent' | 'validator' | 'admin'
  created_at: string
}

const ROLE_LABEL: Record<AdminUser['role'], string> = {
  agent: 'Pointeur (terrain)',
  validator: 'Bureau (validateur)',
  admin: 'Administrateur',
}
const ROLE_TONE: Record<AdminUser['role'], 'blue' | 'green' | 'amber'> = {
  agent: 'blue',
  validator: 'green',
  admin: 'amber',
}

export default function UsersPage() {
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [adding, setAdding] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async (): Promise<AdminUser[]> => {
      const { data, error } = await supabase.rpc('admin_liste_utilisateurs')
      if (error) throw error
      return data as AdminUser[]
    },
  })

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-1 text-xl font-semibold text-slate-900">Utilisateurs</h1>
          <p className="text-sm text-slate-500">
            {data ? `${data.length} compte(s)` : 'Gérer les comptes et leurs accès'}
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          + Ajouter un utilisateur
        </button>
      </div>

      {isLoading && <Spinner label="Chargement…" />}
      {error && <ErrorNote>Erreur : {error.message}</ErrorNote>}
      {data && data.length === 0 && <EmptyState>Aucun utilisateur.</EmptyState>}

      {data && data.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <ul className="divide-y divide-slate-100">
            {data.map((u) => (
              <li key={u.user_id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium text-slate-900">
                    {u.username}
                    <Chip tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Chip>
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {u.full_name || '—'} · créé le {formatDateFr(u.created_at.slice(0, 10))}
                  </p>
                </div>
                <button
                  onClick={() => setEditing(u)}
                  className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Modifier
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(adding || editing) && (
        <UserFormModal
          user={editing}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function UserFormModal({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [username, setUsername] = useState(user?.username ?? '')
  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [role, setRole] = useState<AdminUser['role']>(user?.role ?? 'agent')
  const [password, setPassword] = useState('')

  const save = useMutation({
    mutationFn: async () => {
      if (user) {
        const { error } = await supabase.rpc('admin_modifier_utilisateur', {
          p_user_id: user.user_id,
          p_full_name: fullName,
          p_role: role,
          p_password: password.trim() ? password : null,
        })
        if (error) throw error
      } else {
        if (!username.trim()) throw new Error("Le nom d'utilisateur est obligatoire.")
        if (password.length < 6) throw new Error('Mot de passe : 6 caractères minimum.')
        const { error } = await supabase.rpc('admin_creer_utilisateur', {
          p_username: username,
          p_password: password,
          p_full_name: fullName,
          p_role: role,
        })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      onClose()
    },
  })

  const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-1 text-lg font-semibold text-slate-900">
          {user ? `Modifier — ${user.username}` : 'Ajouter un utilisateur'}
        </h2>
        <p className="mb-5 text-sm text-slate-500">
          {user
            ? 'Modifiez le rôle, le nom, ou réinitialisez le mot de passe.'
            : "Le compte pourra se connecter immédiatement avec ce nom d'utilisateur et ce mot de passe."}
        </p>

        <label className="mb-1 block text-sm font-medium text-slate-700">Nom d'utilisateur</label>
        <input
          type="text"
          value={username}
          disabled={Boolean(user)}
          autoCapitalize="none"
          onChange={(e) => setUsername(e.target.value)}
          placeholder="ex. pointeur1"
          className={`${inputCls} mb-4 ${user ? 'bg-slate-100 text-slate-500' : ''}`}
        />

        <label className="mb-1 block text-sm font-medium text-slate-700">Nom complet</label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className={`${inputCls} mb-4`}
        />

        <label className="mb-1 block text-sm font-medium text-slate-700">Rôle</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as AdminUser['role'])}
          className={`${inputCls} mb-4`}
        >
          <option value="agent">Pointeur (terrain, prend les photos)</option>
          <option value="validator">Bureau (valide les pointages, gère les employés)</option>
          <option value="admin">Administrateur (tout + analytics + utilisateurs)</option>
        </select>

        <label className="mb-1 block text-sm font-medium text-slate-700">
          {user ? 'Nouveau mot de passe (laisser vide = inchangé)' : 'Mot de passe'}
        </label>
        <input
          type="text"
          value={password}
          autoCapitalize="none"
          onChange={(e) => setPassword(e.target.value)}
          placeholder={user ? '••••••' : '6 caractères minimum'}
          className={`${inputCls} mb-5`}
        />

        {save.error && (
          <div className="mb-4">
            <ErrorNote>{save.error.message}</ErrorNote>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Annuler
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {save.isPending ? 'Enregistrement…' : user ? 'Enregistrer' : 'Créer le compte'}
          </button>
        </div>
      </div>
    </div>
  )
}
