# Supabase — fichiers SQL

Tout est expliqué pas à pas dans le [README principal](../README.md) (ÉTAPE 1).

En résumé : dans le **SQL Editor** de Supabase, exécutez dans l'ordre
`001` → `002` → `003` → `004` → `005`, puis créez les comptes avec :

```sql
select public.creer_utilisateur('agent1', 'MotDePasse123', 'Nom complet', 'agent');
select public.creer_utilisateur('bureau1', 'MotDePasse123', 'Nom complet', 'validator');
```

| Fichier | Rôle |
|---|---|
| `001_schema.sql` | Tables (entreprises, sites, employés, pointages, profils) |
| `002_rls.sql` | Sécurité : qui a le droit de lire/écrire quoi |
| `003_storage.sql` | Espace de stockage des photos |
| `004_seed.sql` | Données : Groupe Triple A, 26 sites, 121 employés |
| `005_utilisateurs.sql` | La commande `creer_utilisateur` (comptes sans e-mail) |
