Clair 0.20.0 : **l’affichage est disponible sur iPhone**. Dans Clair, ouvrir **Réglages → iPhone → Connecter**, puis scanner le QR code avec l’iPhone sur le même Wi-Fi. Safari affiche les pistes, le discours, la traduction facultative et la solution Coding en direct. Le raccourci Firefox continue de fonctionner. [Guide iPhone](https://github.com/galagain/clair/blob/main/docs/IPHONE.md).

Clair doit rester ouvert sur l’ordinateur, qui gère l’audio et les appels IA. La clé API reste sur l’ordinateur. Utiliser un Wi-Fi de confiance : le lien local donne accès à l’affichage et le transport n’est pas chiffré. Déconnecter, quitter Clair ou mettre l’ordinateur en veille révoque le lien. L’extension actuelle reste compatible.

- **Clair-Mac-arm64.dmg** : Mac Apple Silicon, macOS 15 minimum. Glisser Clair dans Applications.
- **Clair-Windows-x64.exe** : Windows 10/11 64 bits. Ouvrir directement le fichier.
- **Clair-Firefox.zip** : Firefox 140 minimum sur ordinateur. Charger temporairement depuis `about:debugging` ; puis connecter l’extension avec **Coding → Firefox → Copier le code** dans Clair. [Guide](https://github.com/galagain/clair/blob/main/docs/CODING.md).

L’extension n’est pas signée par Mozilla : la recharger à chaque démarrage de Firefox. Les envois ont lieu uniquement au raccourci ou au clic « Envoyer et analyser ». Aucun code exécuté ou soumis. Certains éditeurs n’exposent que les lignes visibles ; un avertissement accompagne alors la capture.

Tests unitaires et applications empaquetées vérifiés avec une API simulée. Affichage mobile vérifié avec WebKit au format iPhone ; aucun test sur iPhone physique. Extension testée sur Firefox Mac avec une page synthétique. Aucun appel OpenAI réel ; CoderPad, les réponses réelles et les permissions de visio restent à valider en situation.

Applications sans certificat de distribution : macOS ou Windows peut demander une autorisation. Clair peut apparaître lors du partage de tout l’écran.
