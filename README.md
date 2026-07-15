# Pointage — Groupe Triple A

Système de pointage du personnel (PWA) : les **agents** pointent les employés
sur le terrain en prenant une photo ; les **validateurs** au bureau confirment
ou refusent chaque pointage et gèrent la liste des employés.

**Stack** : React (Vite) · Supabase (auth, base de données, stockage) · PWA
installable sur mobile et ordinateur.

## Mise en route

### 1. Configurer Supabase

Suivez le guide détaillé dans [`supabase/README.md`](supabase/README.md) :

1. Exécuter les 4 fichiers SQL de `supabase/migrations/` dans le SQL Editor
2. Créer les comptes utilisateurs (agents / validateurs)
3. Récupérer l'URL du projet et la clé `anon`

> ⚠️ Les employés de `004_seed.sql` ont été saisis à partir de photos du
> registre : vérifiez les CIN/CNSS/dates dans le Table Editor et corrigez si
> besoin. Les pages restantes du registre seront ajoutées dans une migration
> `005_seed_2.sql`.

### 2. Configurer l'application

```bash
cp .env.example .env
# puis remplir VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

L'application est disponible sur http://localhost:5173.

### 3. Déployer (nécessaire pour la caméra sur mobile)

La caméra du téléphone n'est autorisée que sur une page **HTTPS**. Le plus
simple est un hébergeur gratuit :

1. Créez un compte sur [vercel.com](https://vercel.com) et connectez ce dépôt GitHub
2. Ajoutez les deux variables d'environnement (`VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`) dans les réglages du projet Vercel
3. Déployez — vous obtenez une adresse `https://…vercel.app` à ouvrir sur les
   téléphones des agents (l'app peut ensuite être « installée » depuis le
   navigateur : menu → Ajouter à l'écran d'accueil)

Pour les routes SPA sur Vercel, aucun réglage supplémentaire n'est requis
(Vite est détecté automatiquement).

## Rôles

| Rôle | Onglets | Actions |
|---|---|---|
| **Agent** (pointeur) | Pointage | Choisir un site → « Pointer » un employé → photo → Valider (horodatage serveur automatique) |
| **Validateur** (bureau) | Employés, Pointage | Voir la photo de chaque pointage → Valider / Refuser (la validation incrémente les jours travaillés) ; gérer téléphone & jour de repos |

## Logique métier

- **Un pointage actif par employé et par jour** (un pointage refusé peut être refait)
- **Jour de repos** : un employé non pointé son jour de repos n'est **pas** compté absent
- **Retraite (65 ans au Maroc)** : ligne rouge + badge « Âge de retraite atteint » ;
  badge d'avertissement « X jours avant la retraite » dans les 30 jours précédents
- **Horodatage serveur** : le client ne peut pas falsifier l'heure du pointage
  (défini par la base de données)

## Structure

```
supabase/migrations/   Schéma SQL, sécurité RLS, stockage, données initiales
src/lib/               Client Supabase, calculs d'âge/retraite, requêtes
src/pages/agent/       Écran de pointage terrain (caméra)
src/pages/validator/   Validation des pointages + liste des employés
src/components/        Mise en page, capture caméra, composants UI
```

## Performance

Pensé pour grossir (plusieurs entreprises, des centaines d'employés) :
pagination côté serveur partout, chargement des employés site par site à
l'ouverture, index SQL sur les requêtes fréquentes, photos compressées
(≤ 1280 px) avant envoi, URLs signées mises en cache.
