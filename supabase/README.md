# Configuration Supabase — Pointage Groupe Triple A

## 1. Exécuter les migrations SQL

Dans le **Dashboard Supabase → SQL Editor**, exécutez les fichiers dans l'ordre :

1. `migrations/001_schema.sql` — tables, index, fonction de validation
2. `migrations/002_rls.sql` — sécurité (Row Level Security)
3. `migrations/003_storage.sql` — bucket de stockage des photos
4. `migrations/004_seed.sql` — données : Groupe Triple A, sites et employés

Copiez-collez le contenu de chaque fichier et cliquez **Run**.

## 2. Créer les utilisateurs (agents et validateurs)

L'application utilise un **nom d'utilisateur + mot de passe**. Techniquement,
Supabase exige un e-mail : on utilise la convention `<nom_utilisateur>@pointage.local`.

### a) Créer le compte

Dashboard → **Authentication → Users → Add user → Create new user** :

- **Email** : par exemple `agent1@pointage.local` (l'utilisateur se connectera avec `agent1`)
- **Password** : le mot de passe choisi
- Cochez **Auto Confirm User**

### b) Donner un rôle et l'accès à l'entreprise

Dans le **SQL Editor**, exécutez (en adaptant le nom d'utilisateur et le rôle) :

```sql
-- Pour un AGENT (pointeur terrain) :
with u as (select id from auth.users where email = 'agent1@pointage.local')
insert into public.profiles (user_id, username, full_name, role)
select id, 'agent1', 'Nom complet de l''agent', 'agent' from u;

with u as (select id from auth.users where email = 'agent1@pointage.local')
insert into public.user_companies (user_id, company_id)
select u.id, c.id from u, public.companies c where c.name = 'Groupe Triple A';
```

```sql
-- Pour un VALIDATEUR (bureau) :
with u as (select id from auth.users where email = 'bureau1@pointage.local')
insert into public.profiles (user_id, username, full_name, role)
select id, 'bureau1', 'Nom complet du validateur', 'validator' from u;

with u as (select id from auth.users where email = 'bureau1@pointage.local')
insert into public.user_companies (user_id, company_id)
select u.id, c.id from u, public.companies c where c.name = 'Groupe Triple A';
```

## 3. Récupérer les clés pour l'application

Dashboard → **Settings → API** :

- **Project URL** → `VITE_SUPABASE_URL`
- **anon public key** → `VITE_SUPABASE_ANON_KEY`

Copiez ces deux valeurs dans le fichier `.env` à la racine du projet
(voir `.env.example`).

## Ajouter une nouvelle entreprise plus tard

```sql
insert into public.companies (name) values ('Nouvelle Entreprise');

insert into public.sites (company_id, name)
select id, 'Nom du site' from public.companies where name = 'Nouvelle Entreprise';
```

Puis donnez l'accès aux utilisateurs concernés via `user_companies` (voir plus haut).
