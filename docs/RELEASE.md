Clair 0.26.0 : **repères de compréhension dans Pistes et réanalyse avec les échanges récents**.

- Après l’envoi d’un exercice et la génération de sa solution, Pistes affiche un résumé pédagogique : approche, étapes essentielles, complexité et cas limites utiles.
- Le petit bouton ↻ en haut à droite du Code relance l’analyse avec la capture actuelle, le code affiché et les deux dernières minutes de transcription finalisée du micro et de l’ordinateur.
- Le code précédent reste lisible pendant la réanalyse. Revenir annule le changement ; une erreur ou l’absence de contexte ne supprime pas la solution.
- Les repères et les réponses d’entretien peuvent continuer en parallèle, avec leur historique. Les repères sont également affichés sur iPhone.

Les repères consomment un appel API supplémentaire. Le bouton ne relit pas automatiquement l’éditeur du navigateur : renvoyer la page pour actualiser sa capture. Tests avec API et transcription simulées ; pertinence des explications à vérifier en situation réelle. [Guide](https://github.com/galagain/clair/blob/main/docs/CODING.md).

- **Clair-Mac-arm64.dmg** : Mac Apple Silicon, macOS 15 minimum. Glisser Clair dans Applications.
- **Clair-Windows-x64.exe** : Windows 10/11 64 bits. Ouvrir directement le fichier.
- **Clair-Firefox.zip** : Firefox 140 minimum sur ordinateur. Charger temporairement depuis `about:debugging` ; puis connecter l’extension avec **bouton ⌄ à côté de Code → Réglages Coding → Firefox → Copier le code** dans Clair. [Guide](https://github.com/galagain/clair/blob/main/docs/CODING.md).

L’extension n’est pas signée par Mozilla : la recharger à chaque démarrage de Firefox. Les envois ont lieu uniquement au raccourci ou au clic « Envoyer et analyser ». Aucun code exécuté ou soumis. Certains éditeurs n’exposent que les lignes visibles ; un avertissement accompagne alors la capture.

Tests unitaires et applications empaquetées vérifiés avec une API simulée. Affichage mobile vérifié avec WebKit au format iPhone ; la connexion réelle a été confirmée par l’utilisateur, les nouvelles cartes restent à vérifier sur iPhone physique. Extension testée sur Firefox Mac avec une page synthétique. Aucun appel OpenAI réel ; CoderPad, les réponses réelles et les permissions de visio restent à valider en situation.

Applications sans certificat de distribution : macOS ou Windows peut demander une autorisation. Clair peut apparaître lors du partage de tout l’écran.
