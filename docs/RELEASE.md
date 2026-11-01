Clair 0.19 ajoute **Coding** et une extension Firefox : envoi manuel de l’énoncé et du code, aperçu modifiable, puis analyse, indice, vérification ou explication. Les aides s’ajoutent dans un historique séparé de la conversation. La clé API reste dans Clair.

- **Clair-Mac-arm64.dmg** : Mac Apple Silicon, macOS 15 minimum. Glisser Clair dans Applications.
- **Clair-Windows-x64.exe** : Windows 10/11 64 bits. Ouvrir directement le fichier.
- **Clair-Firefox.zip** : Firefox 140 minimum sur ordinateur. Charger temporairement depuis `about:debugging` ; puis connecter l’extension avec **Coding → Firefox → Copier le code** dans Clair. [Guide](https://github.com/galagain/clair/blob/main/docs/CODING.md).

L’extension n’est pas signée par Mozilla : la recharger à chaque démarrage de Firefox. Aucun envoi avant le clic « Envoyer et analyser », aucun code exécuté ou soumis. Vérifier le contenu récupéré ; certains éditeurs n’exposent que les lignes visibles.

Tests unitaires et applications empaquetées vérifiés avec une API simulée. Extension testée sur Firefox Mac avec une page synthétique. Aucun appel OpenAI réel ; CoderPad, les réponses réelles et les permissions de visio restent à valider en situation.

Applications sans certificat de distribution : macOS ou Windows peut demander une autorisation. Clair peut apparaître lors du partage de tout l’écran.
