# Développement

Node.js 22.12 ou plus récent. Sur Mac, installer les outils de ligne de commande Xcode (`xcode-select --install`).

```sh
npm ci
npm run build:native # Mac uniquement
npm start
```

## Vérifier

```sh
npm test
npm run check
npm run qa:coding # application isolée, API simulée
```

## Construire

```sh
npm run dist:mac # Mac Apple Silicon, depuis un Mac
npm run dist:win # Windows x64, depuis Windows
npm run dist:firefox # ZIP temporaire non signé
```

Les fichiers générés sont dans `release/`. Les dépendances, caches et exécutables ne sont pas versionnés.

Après construction : `npm run qa:mac` ou `npm run qa:windows`. Ces contrôles utilisent un profil temporaire et des données synthétiques, sans clé personnelle.

Pour Firefox : construire le ZIP, installer Firefox et `geckodriver`, puis lancer `npm run qa:firefox`. `GECKODRIVER` et `FIREFOX_BIN` permettent de préciser les exécutables. Le test ouvre un profil temporaire sans interface, vérifie l’extraction, la connexion et l’envoi sur un exercice synthétique. `web-ext lint --source-dir extensions/firefox` contrôle le manifeste.

## Publier

Mettre à jour la version dans `package.json` et `package-lock.json`, puis pousser un tag `vX.Y.Z`. Le workflow GitHub construit et teste séparément sur Mac et Windows. La release est publiée seulement lorsque les deux builds réussissent, avec leurs exécutables et les sommes SHA-256.

## Organisation

- `src/` : application Electron, interface et moteur audio/IA.
- `extensions/firefox/` : extension manuelle, aperçu et connexion locale Coding.
- `native/` : capture audio et lecture PDF natives sur Mac.
- `test/` : tests automatisés et PDF synthétiques.
- `scripts/` : construction et vérifications.
- `build/icon.png` : icône source.

Les PDF sont extraits localement : PDFKit sur Mac, lecteur isolé `pdf-parse` sur Windows. Aucun fichier utilisateur ni clé API n’est inclus dans le dépôt.
