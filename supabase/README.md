# Supabase — fichiers SQL

Tout est expliqué pas à pas dans le [README principal](../README.md) (ÉTAPE 1).

En résumé : dans le **SQL Editor** de Supabase, exécutez dans l'ordre
`001` → `002` → `003` → `004` → `005` → `006`, puis créez les comptes avec :

```sql
select public.creer_utilisateur('agent1', 'MotDePasse123', 'Nom complet', 'agent');
select public.creer_utilisateur('bureau1', 'MotDePasse123', 'Nom complet', 'validator');
```

| Fichier | Rôle |
|---|---|
| `001_schema.sql` | Tables (entreprises, sites, employés, pointages, profils) |
| `002_rls.sql` | Sécurité : qui a le droit de lire/écrire quoi |
| `003_storage.sql` | Espace de stockage des photos |
| `004_seed.sql` | Données : Groupe Triple A (pages 1-3 et 5-7 du registre) |
| `005_utilisateurs.sql` | La commande `creer_utilisateur` (comptes sans e-mail) |
| `006_seed_page4.sql` | Page 4 du registre → total : 31 sites, 145 employés |
| `007_ameliorations.sql` | Matricules numériques, présence manuelle, corrections |
| `008_details_paie.sql` | Champs RIB, banque, salaire, date de sortie |
| `009_nouvelles_entreprises.sql` | AL SAFAE EL MAGHREB, BO, DUO MULTI SERVICE, EDEN VERT SERVICE |
| `010_maj_triple_a.sql` | Mise à jour Groupe Triple A depuis l'Excel (adresses, etc.) |
| `011_nouvelles_entreprises_2.sql` | MEGANTER, NORD PLANET, SERCLEAN, TRIMAX, VIGILMA |
