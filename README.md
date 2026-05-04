# Budget Foyer — V3 propre

Application web locale/PWA pour analyser les CSV bancaires du foyer.

## Nouveautés V3
- Import CSV beaucoup plus robuste :
  - Crédit Agricole CSV Excel
  - colonnes `Débit/Crédit`
  - colonne unique `Montant`
  - dates `Date`, `Date opération`, `Date valeur`
  - séparateurs `;`, `,`, tabulation
  - ignore les lignes d’intro avant l’en-tête
- Erreur plus utile : affiche les colonnes réellement détectées.
- Règles de catégorisation enrichies.
- Interface iPhone améliorée en portrait et paysage.
- Navigation basse type iOS.
- Swipe gauche/droite entre les écrans.
- Graphique recalculé au redimensionnement.

## Utilisation
1. Dézipper.
2. Ouvrir `index.html`.
3. Sur iPhone, tu peux l’ajouter à l’écran d’accueil.
4. Importer ton CSV Crédit Agricole en format CSV/Excel.
