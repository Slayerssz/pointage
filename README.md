# Pointage — Groupe Triple A

Application de pointage du personnel avec photo.

- **L'agent (pointeur)** ouvre l'app sur son téléphone → choisit l'entreprise → choisit le site → appuie sur « Pointer » à côté d'un employé → prend une photo → Valider. L'heure est enregistrée automatiquement.
- **Le validateur (bureau)** ouvre l'app → choisit l'entreprise → voit deux onglets : **Employés** (la liste complète du personnel) et **Pointage** (les photos envoyées par les agents, avec les boutons Valider / Refuser).

La connexion se fait avec un **nom d'utilisateur et un mot de passe**. Pas d'e-mail, aucun message n'est envoyé à personne.

À la connexion, tout le monde voit **toutes les entreprises** et choisit celle sur laquelle travailler. Pour l'instant il n'y en a qu'une : Groupe Triple A.

---

## ÉTAPE 1 — Préparer Supabase (une seule fois, ~10 minutes)

Supabase, c'est la base de données en ligne : c'est là que vivent les employés, les photos et les pointages.

1. Allez sur [supabase.com](https://supabase.com) → ouvrez votre projet
2. Dans le menu de gauche, cliquez sur **SQL Editor**
3. Ouvrez le fichier `supabase/migrations/001_schema.sql` de ce projet, **copiez tout son contenu**, collez-le dans le SQL Editor, puis cliquez sur **Run** (en bas à droite)
4. Faites exactement pareil, dans l'ordre, avec :
   - `002_rls.sql`
   - `003_storage.sql`
   - `004_seed.sql` ← c'est lui qui remplit les 26 sites et les 121 employés
   - `005_utilisateurs.sql`

Si un « Success » s'affiche à chaque fois, c'est bon. ✅

### Créer les comptes (agents et validateurs)

Toujours dans le **SQL Editor**, tapez une ligne comme celle-ci puis **Run** :

```sql
select public.creer_utilisateur('agent1', 'MotDePasse123', 'Mohamed Alami', 'agent');
```

- 1er champ : le nom d'utilisateur (celui qu'il tapera pour se connecter)
- 2e : son mot de passe
- 3e : son nom complet
- 4e : son rôle → `'agent'` pour un pointeur terrain, `'validator'` pour le bureau

Exemple pour un validateur :

```sql
select public.creer_utilisateur('bureau1', 'MotDePasse123', 'Salma Bennani', 'validator');
```

Créez autant de comptes que nécessaire. C'est tout pour Supabase.

---

## ÉTAPE 2 — Installer l'application sur votre PC

1. **Installer Node.js** (si ce n'est pas déjà fait) : [nodejs.org](https://nodejs.org) → bouton vert « LTS » → installez comme n'importe quel logiciel
2. **Télécharger ce projet** : sur la page GitHub du projet, bouton vert **« Code »** → **« Download ZIP »** → décompressez le dossier où vous voulez
   *(ou, si vous avez git : `git clone <adresse du dépôt>`)*
3. **Connecter l'app à votre Supabase** :
   - Dans le dossier du projet, faites une copie du fichier `.env.example` et renommez-la `.env`
   - Ouvrez `.env` avec le Bloc-notes
   - Sur supabase.com : **Settings → API**. Copiez **Project URL** et **anon public key** dans les deux lignes du fichier, par exemple :
     ```
     VITE_SUPABASE_URL=https://abcdefgh.supabase.co
     VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
     ```
4. **Lancer** : ouvrez un terminal (cmd) dans le dossier du projet, puis :
   ```
   npm install
   npm run dev
   ```
5. Ouvrez http://localhost:5173 dans votre navigateur → l'écran de connexion apparaît → connectez-vous avec un compte créé à l'étape 1

---

## ÉTAPE 3 — Tester sur un téléphone

### Test rapide (téléphone et PC sur le même Wi-Fi)

1. Lancez l'app avec :
   ```
   npm run dev -- --host
   ```
2. Le terminal affiche une ligne **« Network: http://192.168.x.x:5173 »** → tapez cette adresse dans le navigateur du téléphone
3. Quand l'agent appuie sur « Pointer », le téléphone ouvre son **appareil photo natif** → photo → Valider. Ça marche.

### Mise en ligne réelle (recommandé pour l'utilisation quotidienne)

Pour que les agents utilisent l'app depuis n'importe où (4G, autre Wi-Fi), il faut la mettre en ligne. C'est **gratuit** avec Vercel :

1. Créez un compte sur [vercel.com](https://vercel.com) avec votre compte GitHub
2. « Add New → Project » → choisissez ce dépôt GitHub
3. Dans « Environment Variables », ajoutez vos deux valeurs : `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`
4. **Deploy** → vous obtenez une adresse du type `https://pointage-xxx.vercel.app`

Donnez cette adresse aux agents. Sur leur téléphone, ils peuvent aussi **installer l'app** : menu du navigateur → « Ajouter à l'écran d'accueil » → elle se comporte comme une vraie application.

---

## Bon à savoir

- **Un seul pointage par employé et par jour** (si un pointage est refusé, l'agent peut recommencer)
- **Jour de repos** : réglable pour chaque employé dans l'onglet Employés ; ce jour-là, l'employé non pointé n'est **pas** compté absent
- **Retraite** : à 65 ans la ligne de l'employé devient rouge (« Âge de retraite atteint ») ; un compte à rebours s'affiche à partir de 30 jours avant
- **Jours travaillés** : chaque validation ajoute +1 au compteur de l'employé (pour la paie plus tard)
- ⚠️ Les employés ont été recopiés depuis des photos du registre : vérifiez les CIN/CNSS/dates dans Supabase (**Table Editor → employees**) et corrigez si besoin
- ⚠️ **Il manque la page 4/7 du registre** (121 employés saisis sur les 145 annoncés) — envoyez-la pour compléter
