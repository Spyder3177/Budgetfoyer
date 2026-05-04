# Budget Foyer — V1 locale

Application web locale pour analyser les CSV bancaires Crédit Agricole.

## Fonctions
- Import CSV : Date, Libellé, Débit euros, Crédit euros
- Comptes séparés : Jérémy / Conjointe / Foyer
- Fusion des opérations avec dédoublonnage
- Catégorisation automatique par règles
- Correction manuelle des catégories
- Moyenne mensuelle par catégorie sur 6 / 12 / 24 / 36 mois
- Détection simple des dépenses récurrentes
- Export CSV
- Données stockées localement dans le navigateur

## Utilisation simple
1. Dézipper le dossier.
2. Ouvrir `index.html` dans Chrome, Edge ou Safari.
3. Aller dans `Import CSV`.
4. Choisir le compte puis importer les fichiers CSV.
5. Vérifier les catégories dans `Transactions`.

## Important
Les données sont stockées uniquement dans le navigateur utilisé.
Pour une future V2 cloud/multi-appareils, il faudra connecter Supabase ou une base locale plus robuste.
