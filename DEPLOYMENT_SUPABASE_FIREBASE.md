# Déploiement statique Firebase Hosting + Supabase (sans Cloud Run)

## État et ordre impératif

Le dépôt contient une fonction Supabase Edge `api`, un client React/Vite sans route Cloud Run et deux migrations additives. Ne publiez pas le frontend et ne verrouillez pas les grants en premier : procédez dans cet ordre et gardez un backup Supabase.

1. Sauvegarder la base et vérifier que `202610100002_edge_api_support.sql` est appliquée.
2. Exécuter la migration additive `202610100004_public_tracking_rate_limit.sql` avant la dernière version Edge : le suivi public l’utilise pour limiter les essais entre toutes les instances.
2b. Exécuter la migration additive `202610110002_parcel_freight_pricing.sql` (tarif universel par kg + tarif figé sur chaque colis) avant de déployer la fonction `api` qui l’utilise.
3. Déployer la fonction `api` et vérifier `/functions/v1/api`.
4. Configurer les seules variables publiques du build (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Ne jamais inclure la clé `service_role` dans `.env` Vite, `VITE_*`, `firebase.json` ou le navigateur.
5. Vérifier les flux : connexion Auth/profil, lectures, création colis et acompte, paiement, statuts, expéditions, dépenses, paie, invitation Auth, suppressions protégées, suivi public.
6. Une fois ces tests réussis, exécuter `202610100003_lock_direct_table_access.sql`. Cette migration retire les anciennes policies permissives et grants anon/authenticated. Les opérations métier doivent alors passer par Edge.
7. Construire puis déployer Firebase Hosting.

## Commandes (PowerShell, racine du projet)

```powershell
supabase login
supabase link --project-ref VOTRE_PROJECT_REF
supabase secrets set APP_ORIGIN=https://VOTRE_SITE.web.app
supabase functions deploy api --no-verify-jwt
```

`--no-verify-jwt` est requis ici parce que la route publique de suivi partage la fonction avec les routes privées. La fonction vérifie elle-même le JWT Supabase de toutes les routes privées et applique les rôles.

Préparer les seules variables publiques du build dans l’environnement du shell, ou dans un fichier `.env.local` non versionné :

```powershell
$env:VITE_SUPABASE_URL = "https://VOTRE_PROJECT_REF.supabase.co"
$env:VITE_SUPABASE_ANON_KEY = "VOTRE_CLE_ANON_OU_PUBLISHABLE"
$env:VITE_SUPABASE_FUNCTIONS_URL = "$($env:VITE_SUPABASE_URL)/functions/v1/api"
```

Puis vérifier et publier le frontend statique :

```powershell
npm run lint
npm run build
firebase deploy --only hosting
```

Aucune commande `gcloud`/Cloud Run n’est nécessaire. La fonction Edge est hébergée par Supabase; Firebase ne reçoit que le dossier statique `dist`.

## Limites actuelles

- Le runtime Edge local n’a pas été lancé dans cet environnement; le code a le contrôle TypeScript mais doit faire l’objet de tests de parcours après déploiement.
- Le flux création de client/employé/expédition et les modifications génériques ne sont pas tous transactionnels avec leur journal d’audit. La création/suppression de colis, paiements, transitions expédition et création de paie possèdent des RPC transactionnels.
- L’association d’un profil `public.users` à Supabase Auth et la migration `get_my_app_profile()` doivent être vérifiées avant connexion.
- La fonction Edge version 2 a été testée pour le suivi public (404 attendu sur numéro inexistant) et le refus 401 des routes privées anonymes. Le dernier correctif de suivi avec limite partagée est local et nécessite migration 004 + nouveau déploiement.
- Ne lancez pas le verrouillage RLS 003 avant les tests complets avec la fonction Edge à jour.
