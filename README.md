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


## V1.1 mobile iPhone
- Navigation déplacée en bas comme une app mobile.
- Chaque écran principal est bloqué à la hauteur de l’iPhone.
- Le dashboard affiche l’essentiel sans scroll : KPI + graphique + top catégories.
- Les longues listes scrollent à l’intérieur des tableaux, pas toute la page.
- Optimisé pour portrait iPhone et utilisable en paysage.


## V1.2 correction iPhone
- Correction du chevauchement KPI / graphique sur le Dashboard.
- Correction du panneau Transactions qui remontait sur les filtres.
- Bouton Réinitialiser masqué sur mobile pour gagner de la place.
- Navigation basse avec icônes plus propres.
- Swipe gauche/droite entre Dashboard, Import, Transactions, Catégories et Réglages.
