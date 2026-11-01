Clair 0.19.3 : **Alt ⇧ C envoie directement l’exercice à Clair**, sans ouvrir le popup Firefox. L’icône de l’extension conserve l’aperçu manuel et les réglages de connexion. Le raccourci ne change ni le focus ni le code dans l’éditeur. Cette extension est aussi compatible avec Clair 0.19.2.

- **Clair-Mac-arm64.dmg** : Mac Apple Silicon, macOS 15 minimum. Glisser Clair dans Applications.
- **Clair-Windows-x64.exe** : Windows 10/11 64 bits. Ouvrir directement le fichier.
- **Clair-Firefox.zip** : Firefox 140 minimum sur ordinateur. Charger temporairement depuis `about:debugging` ; puis connecter l’extension avec **Coding → Firefox → Copier le code** dans Clair. [Guide](https://github.com/galagain/clair/blob/main/docs/CODING.md).

L’extension n’est pas signée par Mozilla : la recharger à chaque démarrage de Firefox. Les envois ont lieu uniquement au raccourci ou au clic « Envoyer et analyser ». Aucun code exécuté ou soumis. Certains éditeurs n’exposent que les lignes visibles ; un avertissement accompagne alors la capture.

Tests unitaires et applications empaquetées vérifiés avec une API simulée. Extension testée sur Firefox Mac avec une page synthétique. Aucun appel OpenAI réel ; CoderPad, les réponses réelles et les permissions de visio restent à valider en situation.

Applications sans certificat de distribution : macOS ou Windows peut demander une autorisation. Clair peut apparaître lors du partage de tout l’écran.
