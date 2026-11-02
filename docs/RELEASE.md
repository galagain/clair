Clair 0.22.2 : **la solution Coding s’affiche sur toute sa hauteur sur iPhone**.

Le bloc Code n’est plus limité à une demi-hauteur d’écran et n’a plus de défilement interne, en portrait comme en paysage. Les lignes longues continuent de revenir à la ligne. Si la solution dépasse l’écran, le défilement de la page reste disponible.

- **Clair-Mac-arm64.dmg** : Mac Apple Silicon, macOS 15 minimum. Glisser Clair dans Applications.
- **Clair-Windows-x64.exe** : Windows 10/11 64 bits. Ouvrir directement le fichier.
- **Clair-Firefox.zip** : Firefox 140 minimum sur ordinateur. Charger temporairement depuis `about:debugging` ; puis connecter l’extension avec **… → Réglages Coding → Firefox → Copier le code** dans Clair. [Guide](https://github.com/galagain/clair/blob/main/docs/CODING.md).

L’extension n’est pas signée par Mozilla : la recharger à chaque démarrage de Firefox. Les envois ont lieu uniquement au raccourci ou au clic « Envoyer et analyser ». Aucun code exécuté ou soumis. Certains éditeurs n’exposent que les lignes visibles ; un avertissement accompagne alors la capture.

Tests unitaires et applications empaquetées vérifiés avec une API simulée. Affichage mobile vérifié avec WebKit au format iPhone ; la connexion réelle a été confirmée par l’utilisateur, les nouvelles cartes restent à vérifier sur iPhone physique. Extension testée sur Firefox Mac avec une page synthétique. Aucun appel OpenAI réel ; CoderPad, les réponses réelles et les permissions de visio restent à valider en situation.

Applications sans certificat de distribution : macOS ou Windows peut demander une autorisation. Clair peut apparaître lors du partage de tout l’écran.
