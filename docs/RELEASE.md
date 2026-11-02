Clair 0.24.0 : **bouton Recopie sans Clair sur Mac**.

Le bouton aux deux écrans, en haut, ouvre le choix de l’écran source et de l’écran de destination. La copie locale s’affiche en plein écran sur la destination avec les fenêtres de Clair exclues par ScreenCaptureKit. Reclique sur le bouton pour arrêter. Deux écrans en affichage étendu et l’autorisation macOS d’enregistrement de l’écran sont nécessaires.

Les images ne quittent pas le module natif et ne sont pas sauvegardées. Vue en lecture seule, 1080p et 30 images/seconde au maximum. Arrêt à la fermeture, en veille, au verrouillage ou lors d’un changement d’écrans. [Guide et limites](https://github.com/galagain/clair/blob/main/docs/RECOPIE.md).

153 tests unitaires et contrôles d’interface avec module de recopie simulé ; module natif compilé. La capture réelle et l’exclusion de Clair restent à vérifier sur deux écrans physiques. Aucun accès à l’écran n’a été accordé automatiquement pendant les tests.

- **Clair-Mac-arm64.dmg** : Mac Apple Silicon, macOS 15 minimum. Glisser Clair dans Applications.
- **Clair-Windows-x64.exe** : Windows 10/11 64 bits. Ouvrir directement le fichier.
- **Clair-Firefox.zip** : Firefox 140 minimum sur ordinateur. Charger temporairement depuis `about:debugging` ; puis connecter l’extension avec **bouton ⌄ à côté de Code → Réglages Coding → Firefox → Copier le code** dans Clair. [Guide](https://github.com/galagain/clair/blob/main/docs/CODING.md).

L’extension n’est pas signée par Mozilla : la recharger à chaque démarrage de Firefox. Les envois ont lieu uniquement au raccourci ou au clic « Envoyer et analyser ». Aucun code exécuté ou soumis. Certains éditeurs n’exposent que les lignes visibles ; un avertissement accompagne alors la capture.

Tests unitaires et applications empaquetées vérifiés avec une API simulée. Affichage mobile vérifié avec WebKit au format iPhone ; la connexion réelle a été confirmée par l’utilisateur, les nouvelles cartes restent à vérifier sur iPhone physique. Extension testée sur Firefox Mac avec une page synthétique. Aucun appel OpenAI réel ; CoderPad, les réponses réelles et les permissions de visio restent à valider en situation.

Applications sans certificat de distribution : macOS ou Windows peut demander une autorisation. Clair peut apparaître lors du partage de tout l’écran.
