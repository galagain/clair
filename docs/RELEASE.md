Clair 0.22.0 : **boutons de souris configurables sur Mac**, **quatre icônes sur l’application de bureau** et **code adapté à la largeur de l’iPhone**.

- Dans **Réglages → Souris**, activer la détection, autoriser l’Accessibilité macOS puis associer un bouton à l’arrière-plan et un autre à l’envoi Firefox. Les boutons standard et supplémentaires exposés par macOS sont reconnus (jusqu’au bouton 32). Le clic gauche nécessite une touche modificatrice. [Guide souris](https://github.com/galagain/clair/blob/main/docs/SOURIS.md).
- Les icônes Discours, Pistes, Traduction et Code affichent ou masquent les cartes sur l’ordinateur. La taille de la fenêtre est conservée ; une nouvelle solution ne rouvre pas une carte Code masquée.
- Les longues lignes de code reviennent à la ligne sur iPhone, sans défilement horizontal.

Le bouton d’envoi simule **Alt ⇧ C uniquement dans Firefox au premier plan**. Garder ce raccourci dans l’extension. L’extension actuelle reste compatible. La détection globale de souris est disponible sur Mac ; Windows conserve les raccourcis clavier. Les permissions et les boutons physiques restent à valider sur la souris de l’utilisateur.

- **Clair-Mac-arm64.dmg** : Mac Apple Silicon, macOS 15 minimum. Glisser Clair dans Applications.
- **Clair-Windows-x64.exe** : Windows 10/11 64 bits. Ouvrir directement le fichier.
- **Clair-Firefox.zip** : Firefox 140 minimum sur ordinateur. Charger temporairement depuis `about:debugging` ; puis connecter l’extension avec **Coding → Firefox → Copier le code** dans Clair. [Guide](https://github.com/galagain/clair/blob/main/docs/CODING.md).

L’extension n’est pas signée par Mozilla : la recharger à chaque démarrage de Firefox. Les envois ont lieu uniquement au raccourci ou au clic « Envoyer et analyser ». Aucun code exécuté ou soumis. Certains éditeurs n’exposent que les lignes visibles ; un avertissement accompagne alors la capture.

Tests unitaires et applications empaquetées vérifiés avec une API simulée. Affichage mobile vérifié avec WebKit au format iPhone ; la connexion réelle a été confirmée par l’utilisateur, les nouvelles cartes restent à vérifier sur iPhone physique. Extension testée sur Firefox Mac avec une page synthétique. Aucun appel OpenAI réel ; CoderPad, les réponses réelles et les permissions de visio restent à valider en situation.

Applications sans certificat de distribution : macOS ou Windows peut demander une autorisation. Clair peut apparaître lors du partage de tout l’écran.
