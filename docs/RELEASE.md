Clair 0.25.0 : **choix de qualité de la recopie**.

Dans le menu aux deux écrans, le sélecteur **Qualité** propose :
- **Maximale** : résolution native Retina de la source, jusqu’à 60 images/seconde ; sélectionnée par défaut.
- **Économique** : jusqu’à 1080p, 30 images/seconde.

Le choix est mémorisé. Arrêter la recopie avant de changer de qualité, puis la redémarrer. Le mode maximal demande davantage de ressources ; la fluidité et la netteté finales dépendent aussi des écrans. Les dimensions et la cadence configurées sont indiquées dans l’infobulle du bouton pendant la recopie.

154 tests unitaires, compilation native et interface vérifiée avec une capture simulée. La netteté et les performances du nouveau mode restent à vérifier sur les écrans physiques. [Guide](https://github.com/galagain/clair/blob/main/docs/RECOPIE.md).

- **Clair-Mac-arm64.dmg** : Mac Apple Silicon, macOS 15 minimum. Glisser Clair dans Applications.
- **Clair-Windows-x64.exe** : Windows 10/11 64 bits. Ouvrir directement le fichier.
- **Clair-Firefox.zip** : Firefox 140 minimum sur ordinateur. Charger temporairement depuis `about:debugging` ; puis connecter l’extension avec **bouton ⌄ à côté de Code → Réglages Coding → Firefox → Copier le code** dans Clair. [Guide](https://github.com/galagain/clair/blob/main/docs/CODING.md).

L’extension n’est pas signée par Mozilla : la recharger à chaque démarrage de Firefox. Les envois ont lieu uniquement au raccourci ou au clic « Envoyer et analyser ». Aucun code exécuté ou soumis. Certains éditeurs n’exposent que les lignes visibles ; un avertissement accompagne alors la capture.

Tests unitaires et applications empaquetées vérifiés avec une API simulée. Affichage mobile vérifié avec WebKit au format iPhone ; la connexion réelle a été confirmée par l’utilisateur, les nouvelles cartes restent à vérifier sur iPhone physique. Extension testée sur Firefox Mac avec une page synthétique. Aucun appel OpenAI réel ; CoderPad, les réponses réelles et les permissions de visio restent à valider en situation.

Applications sans certificat de distribution : macOS ou Windows peut demander une autorisation. Clair peut apparaître lors du partage de tout l’écran.
