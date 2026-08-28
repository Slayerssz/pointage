# Pointage — Groupe Triple A

Application de pointage du personnel avec photo.

- **L'agent (pointeur)** ouvre l'app sur son téléphone → choisit l'entreprise → choisit le site → appuie sur « Pointer » à côté d'un employé → prend une photo → Valider. L'heure est enregistrée automatiquement.
- **Le validateur (bureau)** ouvre l'app → choisit l'entreprise → voit deux onglets : **Employés** (la liste complète du personnel) et **Pointage** (les photos envoyées par les agents, avec les boutons Valider / Refuser).
- **Le responsable de paie** (nouveau rôle, avec son propre compte et son propre mot de passe) ouvre l'app → onglet **Paie** : chaque mois clôturé par le bureau arrive ici avec les salaires déjà calculés. Il ajuste les primes et les retenues de dette, valide, puis exporte en **Excel** et en **PDF**. Il a aussi l'onglet **Bulletins** (présences par site, jour par jour).
- **L'admin** a en plus un onglet **Analytics** (tableau de bord : effectifs, retraites, présences/absences du jour, graphiques), un onglet **Entreprises** (lui seul peut créer une entreprise) et un onglet **Utilisateurs** pour créer et gérer tous les comptes (pointeur / bureau / paie / admin) directement dans l'app, sans SQL.

### Qui a le droit de faire quoi

| | Pointer | Valider le pointage | Employés & contrats | Sites | Paie | Entreprises | Comptes |
|---|---|---|---|---|---|---|---|
| Pointeur (agent) | ✅ | | | | | | |
| Bureau (validateur) | | ✅ | ✅ | ✅ | | | |
| Paie | | | | | ✅ | | |
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

> **Seul l'admin crée les entreprises.** Le bureau crée les **sites**.

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
   - `012_role_admin.sql` ← le rôle administrateur
   - `013_admin_fonctions.sql` ← gestion des comptes + tableau de bord
   - `014_types_garde.sql` ← types de garde (X, X̸, XX, RT)
   - `015_heures_contrats.sql` ← **heures par jour, paramètres de paie, contrats**
   - `016_absences_conges.sql` ← **½ garde, Malade, Congé payé / sans solde**
   - `017_paie.sql` ← **La Paie** (clôture du mois, calcul, dettes, réouverture)
   - `018_role_paie.sql` ← **le rôle « paie »** — ⚠️ à exécuter SEUL (voir ci-dessous)
   - `019_organisations_permissions.sql` ← **entreprises, sites, droits par rôle**

> ⚠️ **`018_role_paie.sql` doit être exécuté tout seul**, puis vous cliquez à
> nouveau sur **Run** pour `019`. PostgreSQL exige qu'un nouveau rôle soit
> enregistré avant de pouvoir être utilisé. (C'est la même chose qu'avec
> `012_role_admin.sql`.)

> Vous avez déjà exécuté certains fichiers ? Exécutez seulement ceux qui
> vous manquent, **dans l'ordre** (015 à 019 pour cette mise à jour).

Si un « Success » s'affiche à chaque fois, c'est bon. ✅

### Créer les comptes (agents et validateurs)

Toujours dans le **SQL Editor**, tapez une ligne comme celle-ci puis **Run** :

```sql
select public.creer_utilisateur('agent1', 'MotDePasse123', 'Mohamed Alami', 'agent');
```

- 1er champ : le nom d'utilisateur (celui qu'il tapera pour se connecter)
- 2e : son mot de passe
- 3e : son nom complet
- 4e : son rôle → `'agent'` pour un pointeur terrain, `'validator'` pour le bureau,
  `'paie'` pour le responsable de paie, `'admin'` pour un administrateur

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

- **Onglet Pointage (bureau)** : grille de la semaine (Lun → Dim). À la validation, le bureau choisit le **type de garde** :

  | | Symbole | Valeur | Heures si la journée fait 8 h |
  |---|---|---|---|
  | Demi-garde | `½` | 0,5 | 4 h |
  | Une garde | `X` | 1 | 8 h |
  | Une garde et demi | `X̸` | 1,5 | 12 h |
  | Deux gardes | `XX` | 2 | 16 h |
  | Repos travaillé | `RT` | 1 | 8 h |
  | **Malade** | `M` | 1 (payé) | — |
  | **Congé payé** | `C` | 1 (payé) | — |
  | Congé sans solde | `CS` | 0 | — |
  | Absence justifiée | `AJ` | 0 | — |

  `–` absent et `R` repos sont automatiques. Orange `!` = photo à valider. La case validée affiche le symbole choisi ; cliquer dessus permet de changer le type ou de supprimer un jour saisi à la main.

---

## Les nouveautés

### Heures et salaire

Sur la fiche de chaque employé (onglet **Employés** → Modifier) :

- **Salaire mensuel** — ce qu'il touche pour un mois complet
- **Heures par jour** — la durée d'une garde normale (8 h par défaut)

Le **salaire journalier** est le salaire mensuel ÷ **26**. Donc :

> Salaire 5 200 DH → 200 DH la journée.
> Il travaille 20 jours → **4 000 DH**. Il travaille les 26 jours → **5 200 DH** (salaire complet).
> Une garde double (`XX`) compte pour 2 jours ; une demi-garde (`½`) pour un demi.

Les heures suivent la même logique : une journée `XX` = 16 h, une `½` = 4 h.

Le chiffre **26** se règle par entreprise (Admin → **Entreprises** → « Paramètres de paie »),
avec deux interrupteurs : *les jours « Malade » sont-ils payés* et *les congés sont-ils payés*
(les deux sont **activés** au départ).

### Contrats

Onglet **Employés** → Modifier un employé → **Contrats · Congés · Dettes**.

Chaque contrat a une date de début et une date de fin. Dans la liste des employés, la ligne se colore :

- 🔵 **bleu** — le contrat se termine dans **10 jours ou moins**
- 🟡 **jaune** — le contrat est **terminé**

Un CDI se saisit sans date de fin : aucune alerte. Le filtre « Tous les contrats » en haut de la
liste permet de n'afficher que les contrats bientôt terminés, terminés, ou les employés sans contrat.

Le bouton **« Imprimer / PDF »** ouvre le contrat en pleine page → « Imprimer » → « Enregistrer au
format PDF ».

> 📄 **Pour mettre VOTRE modèle de contrat** : tout le texte est dans le seul fichier
> `src/components/ContratPrint.tsx`. Remplacez les articles par les vôtres ; les valeurs
> (`{employee.nom_prenom}`, `{c.salaire_mensuel}`…) se remplissent toutes seules.

### Congés

Même écran, onglet **Congés & absences** : on saisit « du … au … » et le type. Les jours sont
alors écrits automatiquement dans le pointage. Le **jour de repos hebdomadaire de l'employé n'est
pas décompté** du congé. Supprimer le congé efface aussi les jours dans le pointage.

### Dettes / avances

Même écran, onglet **Dettes / avances** : on enregistre le montant total dû (ex. une avance de
1 500 DH). Le montant **réellement retenu chaque mois se choisit dans l'onglet Paie** — vous
n'êtes pas obligé de tout reprendre d'un coup. Quand la paie est validée, la dette est diminuée
d'autant.

### La Paie

**1. Le bureau clôture le mois.** Onglet **Pointage** → « Valider un mois → ». L'écran vérifie
d'abord qu'il ne reste aucune photo en attente, puis affiche le nombre d'employés sans salaire
renseigné. Une fois validé, **le pointage de ce mois n'est plus modifiable**.

**2. La paie est calculée automatiquement.** Onglet **Paie** : tous les employés du mois, avec
salaire de base, gardes, congés, maladie, jours payés, heures, et le net à payer.

**3. Le responsable de paie ajuste.** Les colonnes *Prime*, *Dette* et *Autres* se modifient
directement dans le tableau (l'enregistrement se fait quand on quitte la case). Sous la colonne
*Dette*, un rappel indique ce qui reste dû par cet employé.

**4. Il valide.** Bouton **« Valider la paie »** : les retenues de dette sont imputées et le mois
est verrouillé.

**5. Exports.** Boutons **Excel** et **PDF** en haut, disponibles à tout moment. Les deux
contiennent **toute la paie du mois** (pas une personne) : une ligne par employé, les totaux, la
répartition **virement / espèces** et le détail **par banque** pour préparer les virements.

**6. Réouverture.** Une paie validée est verrouillée. Pour la corriger, le responsable de paie
saisit un motif et clique « Demander la réouverture ». **Seul un administrateur peut approuver** ;
à l'approbation, le mois se rouvre et les remboursements de dette sont annulés.

### Bulletins de présence

Onglet **Bulletins** : pour une date donnée, chaque site avec les employés qui y ont travaillé
ce jour-là. Exportable en Excel et en PDF (un site par page).

### Entreprises et sites

- **Seul l'administrateur** peut créer une entreprise (onglet **Entreprises**).
- **Le bureau** (et l'admin) crée et modifie les **sites** (onglet **Sites**). Un site peut être
  marqué « sans pointage » (site administratif) : il n'apparaît alors pas dans la grille de pointage.

---
- **Matricules** : numériques et triés ; un nouvel employé sans matricule reçoit automatiquement le dernier numéro + 1
- **Ajout d'employés** : bouton « + Ajouter un employé » dans l'onglet Employés (validateurs) ; la suppression n'est pas ouverte pour l'instant
- **Un seul pointage par employé et par jour** (si un pointage est refusé, l'agent peut recommencer)
- **Jour de repos** : réglable pour chaque employé dans l'onglet Employés ; ce jour-là, l'employé non pointé n'est **pas** compté absent
- **Retraite** : à 65 ans la ligne de l'employé devient rouge (« Âge de retraite atteint ») ; un compte à rebours s'affiche à partir de 30 jours avant
- **Jours travaillés** : chaque validation ajoute +1 au compteur de l'employé (pour la paie plus tard)
- ⚠️ Les employés ont été recopiés depuis des photos du registre : vérifiez les CIN/CNSS/dates dans Supabase (**Table Editor → employees**) et corrigez si besoin
- **Tests de la base** : les règles de calcul de la paie sont couvertes par un test
  automatique qui rejoue toutes les migrations dans un PostgreSQL embarqué :
  ```
  npm run test:db
  ```
  (39 vérifications : prorata 20/26 jours, mois complet, ½ garde, malade, congé, dettes,
  verrouillage du mois, réouverture par l'admin, alertes de contrat bleu/jaune.)
- **Application de bureau / mobile** : une fois en ligne (Vercel), l'app s'installe déjà comme une application — sur PC : icône « Installer » dans la barre d'adresse de Chrome/Edge ; sur téléphone : « Ajouter à l'écran d'accueil ». De vraies applis pour App Store / Play Store pourront être ajoutées plus tard.
