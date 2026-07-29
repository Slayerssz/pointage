# Pointage — Groupe Triple A

Application de pointage du personnel avec photo.

- **L'agent (pointeur)** ouvre l'app sur son téléphone → choisit l'entreprise → choisit le site → appuie sur « Pointer » à côté d'un employé → prend une photo → Valider. L'heure est enregistrée automatiquement.
- **Le validateur (bureau)** ouvre l'app → choisit l'entreprise → voit deux onglets : **Employés** (la liste complète du personnel) et **Pointage** (les photos envoyées par les agents, avec les boutons Valider / Refuser).
- **L'admin** a en plus un onglet **Analytics** (tableau de bord : effectifs, retraites, présences/absences du jour, graphiques) et un onglet **Utilisateurs** pour créer et gérer tous les comptes (pointeur / bureau / admin) directement dans l'app, sans SQL.

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
   - `004_seed.sql` ← remplit les sites et les employés (pages 1-3 et 5-7 du registre)
   - `005_utilisateurs.sql`
   - `006_seed_page4.sql` ← la page 4 du registre (total : 31 sites, 145 employés ✅)
   - `007_ameliorations.sql` ← matricules numériques + auto, présence manuelle,
     ajout d'employés, corrections de sites/dates/règlements
   - `008_details_paie.sql` ← champs RIB, banque, salaire, date de sortie
   - `009_nouvelles_entreprises.sql` ← 4 nouvelles entreprises (import Excel)
   - `010_maj_triple_a.sql` ← complète les infos de Groupe Triple A depuis l'Excel
   - `011_nouvelles_entreprises_2.sql` ← 5 entreprises de plus (MEGANTER, NORD
     PLANET, SERCLEAN, TRIMAX, VIGILMA) → 10 entreprises, 494 employés au total

> Vous avez déjà exécuté certains fichiers ? Exécutez seulement ceux qui
> vous manquent, dans l'ordre (008 à 011 pour cette mise à jour).

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
3. **Connexion à Supabase** : rien à faire — le fichier `.env` est déjà inclus
   avec les bonnes valeurs du projet Groupe Triple A.
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

- **Onglet Pointage (bureau)** : grille de la semaine (Lun → Dim). Vert ✓ = présent validé, orange ! = photo à valider, rouge ✕ = refusé, bleu R = jour de repos, gris – = absent. Cliquer sur une case pour voir la photo, valider/refuser ou **marquer présent** manuellement (pour les employés injoignables sur le terrain)
- **Matricules** : numériques et triés ; un nouvel employé sans matricule reçoit automatiquement le dernier numéro + 1
- **Ajout d'employés** : bouton « + Ajouter un employé » dans l'onglet Employés (validateurs) ; la suppression n'est pas ouverte pour l'instant
- **Un seul pointage par employé et par jour** (si un pointage est refusé, l'agent peut recommencer)
- **Jour de repos** : réglable pour chaque employé dans l'onglet Employés ; ce jour-là, l'employé non pointé n'est **pas** compté absent
- **Retraite** : à 65 ans la ligne de l'employé devient rouge (« Âge de retraite atteint ») ; un compte à rebours s'affiche à partir de 30 jours avant
- **Jours travaillés** : chaque validation ajoute +1 au compteur de l'employé (pour la paie plus tard)
- ⚠️ Les employés ont été recopiés depuis des photos du registre : vérifiez les CIN/CNSS/dates dans Supabase (**Table Editor → employees**) et corrigez si besoin
- **Application de bureau / mobile** : une fois en ligne (Vercel), l'app s'installe déjà comme une application — sur PC : icône « Installer » dans la barre d'adresse de Chrome/Edge ; sur téléphone : « Ajouter à l'écran d'accueil ». De vraies applis pour App Store / Play Store pourront être ajoutées plus tard.
