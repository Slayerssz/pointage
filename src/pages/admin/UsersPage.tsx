import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatDateFr } from '../../lib/dates'
import { Chip, EmptyState, ErrorNote, Spinner } from '../../components/ui'

type Role = 'agent' | 'validator' | 'admin' | 'paie' | 'rh'

interface AdminUser {
  user_id: string
  username: string
  full_name: string | null
  role: Role
  actif: boolean
  supprimable: boolean
  nb_pointages: number
  created_at: string
}

const ROLE_LABEL: Record<Role, string> = {
  agent: 'Pointeur (terrain)',
  validator: 'Bureau (validateur)',
  paie: 'Responsable de paie',
  rh: 'Personnel (RH)',
  admin: 'Administrateur',
}
const ROLE_TONE: Record<Role, 'blue' | 'green' | 'amber' | 'slate'> = {
  agent: 'blue',
  validator: 'green',
  paie: 'slate',
  rh: 'blue',
  admin: 'amber',
}

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none'

/** Mot de passe lisible, facile à dicter au téléphone. */
function genererMotDePasse(): string {
  const mots = ['Atlas', 'Rabat', 'Cedre', 'Sahara', 'Tanger', 'Argan', 'Menara', 'Oasis']
  const mot = mots[Math.floor(Math.random() * mots.length)]
  const n = Math.floor(1000 + Math.random() * 9000)
  return `${mot}${n}`
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

  const actifs = data?.filter((u) => u.actif) ?? []
  const inactifs = data?.filter((u) => !u.actif) ?? []

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-1 text-xl font-semibold text-slate-900">Utilisateurs</h1>
          <p className="text-sm text-slate-500">
            {data
              ? `${actifs.length} compte(s) actif(s)${inactifs.length ? ` · ${inactifs.length} désactivé(s)` : ''}`
              : 'Gérer les comptes et leurs accès'}
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

      {actifs.length > 0 && <ListeComptes users={actifs} onEdit={setEditing} />}

      {inactifs.length > 0 && (
        <>
          <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Comptes désactivés
          </p>
          <ListeComptes users={inactifs} onEdit={setEditing} />
        </>
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

function ListeComptes({
  users,
  onEdit,
}: {
  users: AdminUser[]
  onEdit: (u: AdminUser) => void
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <ul className="divide-y divide-slate-100">
        {users.map((u) => (
          <li
            key={u.user_id}
            className={`flex items-center justify-between gap-3 px-4 py-3 ${u.actif ? '' : 'bg-slate-50'}`}
          >
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                <span className={u.actif ? '' : 'text-slate-500 line-through'}>{u.username}</span>
                <Chip tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Chip>
                {!u.actif && <Chip tone="red">Désactivé</Chip>}
              </p>
              <p className="truncate text-xs text-slate-500">
                {u.full_name || '—'} · créé le {formatDateFr(u.created_at.slice(0, 10))}
                {u.nb_pointages > 0 && ` · ${u.nb_pointages} pointage(s)`}
              </p>
            </div>
            <button
              onClick={() => onEdit(u)}
              className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Gérer
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function UserFormModal({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const [username, setUsername] = useState(user?.username ?? '')
  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [role, setRole] = useState<Role>(user?.role ?? 'agent')
  const [password, setPassword] = useState(user ? '' : genererMotDePasse())
  const [nouveauMdp, setNouveauMdp] = useState('')
  const [confirmeSuppression, setConfirmeSuppression] = useState(false)
  const [creeAvec, setCreeAvec] = useState<string | null>(null)

  const soiMeme = user?.user_id === profile?.user_id
  const invalider = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] })

  const save = useMutation({
    mutationFn: async () => {
      if (user) {
        const { error } = await supabase.rpc('admin_modifier_utilisateur', {
          p_user_id: user.user_id,
          p_full_name: fullName,
          p_role: role,
          p_password: null,
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
        setCreeAvec(password)
      }
    },
    onSuccess: () => {
      invalider()
      if (user) onClose()
    },
  })

  const reinitialiser = useMutation({
    mutationFn: async () => {
      if (nouveauMdp.length < 6) throw new Error('Mot de passe : 6 caractères minimum.')
      const { error } = await supabase.rpc('admin_reinitialiser_mot_de_passe', {
        p_user_id: user!.user_id,
        p_nouveau: nouveauMdp,
      })
      if (error) throw error
    },
    onSuccess: invalider,
  })

  const activer = useMutation({
    mutationFn: async (actif: boolean) => {
      const { error } = await supabase.rpc('admin_activer_utilisateur', {
        p_user_id: user!.user_id,
        p_actif: actif,
      })
      if (error) throw error
    },
    onSuccess: () => {
      invalider()
      onClose()
    },
  })

  const supprimer = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('admin_supprimer_utilisateur', {
        p_user_id: user!.user_id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      invalider()
      onClose()
    },
  })

  const erreur = save.error ?? reinitialiser.error ?? activer.error ?? supprimer.error

  // Écran affiché après la création : le mot de passe n'est visible qu'ici.
  if (creeAvec) {
    return (
      <Modal onClose={onClose} title="Compte créé">
        <p className="mb-4 text-sm text-slate-600">
          Notez ce mot de passe et communiquez-le à la personne :{' '}
          <strong>il ne pourra plus jamais être affiché.</strong>
        </p>
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
          <p className="text-xs text-emerald-800">{username}</p>
          <p className="select-all font-mono text-2xl font-bold tracking-wide text-emerald-900">
            {creeAvec}
          </p>
        </div>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
          >
            J’ai noté
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal onClose={onClose} title={user ? `${user.username}` : 'Ajouter un utilisateur'}>
      {!user && (
        <>
          <label className="mb-1 block text-sm font-medium text-slate-700">Nom d'utilisateur</label>
          <input
            type="text"
            value={username}
            autoCapitalize="none"
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ex. pointeur1"
            className={`${inputCls} mb-4`}
          />
        </>
      )}

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
        onChange={(e) => setRole(e.target.value as Role)}
        className={`${inputCls} mb-4`}
      >
        <option value="agent">Pointeur (terrain, prend les photos)</option>
        <option value="validator">Bureau (valide les pointages, gère les employés et les sites)</option>
        <option value="paie">Paie (calcule et valide la paie, bulletins de présence)</option>
        <option value="rh">Personnel (consulte, ajoute, modifie et imprime les employés)</option>
        <option value="admin">Administrateur (tout + entreprises + utilisateurs)</option>
      </select>

      {!user && (
        <>
          <label className="mb-1 block text-sm font-medium text-slate-700">Mot de passe</label>
          <div className="mb-1 flex gap-2">
            <input
              type="text"
              value={password}
              autoCapitalize="none"
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
            <button
              onClick={() => setPassword(genererMotDePasse())}
              className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Générer
            </button>
          </div>
          <p className="mb-5 text-xs text-slate-500">
            Il vous sera affiché une dernière fois après la création. Notez-le.
          </p>
        </>
      )}

      {/* --- Actions sur un compte existant --- */}
      {user && (
        <div className="mt-2 space-y-4 border-t border-slate-100 pt-4">
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">Mot de passe</p>
            <p className="mb-2 text-xs text-slate-500">
              Les mots de passe sont chiffrés : <strong>personne ne peut les lire</strong>, pas
              même vous. Si la personne a oublié le sien, définissez-en un nouveau et
              communiquez-le-lui.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={nouveauMdp}
                autoCapitalize="none"
                onChange={(e) => setNouveauMdp(e.target.value)}
                placeholder="nouveau mot de passe"
                className={inputCls}
              />
              <button
                onClick={() => setNouveauMdp(genererMotDePasse())}
                className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Générer
              </button>
              <button
                onClick={() => reinitialiser.mutate()}
                disabled={reinitialiser.isPending || nouveauMdp.length < 6}
                className="shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {reinitialiser.isPending ? '…' : 'Définir'}
              </button>
            </div>
            {reinitialiser.isSuccess && (
              <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Nouveau mot de passe de <strong>{user.username}</strong> :{' '}
                <span className="select-all font-mono font-bold">{nouveauMdp}</span>
              </p>
            )}
          </div>

          {!soiMeme && (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
              {user.actif ? (
                <button
                  onClick={() => activer.mutate(false)}
                  disabled={activer.isPending}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                >
                  Désactiver le compte
                </button>
              ) : (
                <button
                  onClick={() => activer.mutate(true)}
                  disabled={activer.isPending}
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                >
                  Réactiver le compte
                </button>
              )}

              {user.supprimable ? (
                confirmeSuppression ? (
                  <button
                    onClick={() => supprimer.mutate()}
                    disabled={supprimer.isPending}
                    className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {supprimer.isPending ? '…' : 'Confirmer la suppression'}
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmeSuppression(true)}
                    className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Supprimer définitivement
                  </button>
                )
              ) : (
                <span className="text-xs text-slate-500">
                  Suppression impossible : ce compte a {user.nb_pointages} pointage(s) à son nom.
                  Désactivez-le pour lui retirer l’accès sans effacer l’historique.
                </span>
              )}
            </div>
          )}
          {soiMeme && (
            <p className="border-t border-slate-100 pt-4 text-xs text-slate-500">
              C’est votre propre compte : vous ne pouvez ni le désactiver ni le supprimer.
            </p>
          )}
        </div>
      )}

      {erreur && (
        <div className="mt-4">
          <ErrorNote>{erreur.message}</ErrorNote>
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          Fermer
        </button>
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {save.isPending ? 'Enregistrement…' : user ? 'Enregistrer' : 'Créer le compte'}
        </button>
      </div>
    </Modal>
  )
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-5 text-lg font-semibold text-slate-900">{title}</h2>
        {children}
      </div>
    </div>
  )
}
