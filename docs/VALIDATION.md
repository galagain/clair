# Tests et limites

- Tests unitaires : audio, transcription ordonnée, annulation, historique, dédoublonnage, PDF, flux API simulés et protection des clés.
- Mac : démarrage de l’application empaquetée, interface, import PDF réel, mixage audio synthétique, opacité et navigation.
- Windows : démarrage de l’application empaquetée, démonstration, import PDF réel et mixage système/micro synthétique.
- Les sources embarquées sont comparées au dépôt avant publication.
- Les tests ne font aucun appel OpenAI réel et ne lisent aucune clé personnelle.
- Coding : entrées bornées, connexion locale authentifiée, rejet des origines web, streaming, annulation, conservation des cartes et navigation testés. L’interface empaquetée conserve la taille de fenêtre et accepte les captures reçues.
- Firefox 159 sur Mac : extension temporaire testée dans un profil isolé, permission `activeTab`, sélection d’énoncé, modèle d’éditeur synthétique complet, avertissement sur le code partiel, connexion, envoi explicite et déconnexion. Le contrôle Mozilla `web-ext lint` passe sans erreur ni avertissement.

La capture d’une vraie visio, les permissions audio, les casques et la pertinence des réponses doivent encore être vérifiés en situation réelle sur chaque système. « Tester le son » vérifie les sources localement, sans API.

CoderPad réel, les éditeurs intégrés dans des cadres d’une autre origine, Firefox sous Windows et la qualité des aides Coding avec un vrai modèle restent à valider. L’extension n’est pas signée par Mozilla ; elle est rechargeable temporairement. Aucun code n’est exécuté ni soumis.

Le son système regroupe les applications : Clair ne sépare pas plusieurs participants distants. L’attribution micro/système reste approximative en cas d’écho ou de chevauchement. Le discours et les pistes sont en anglais par défaut, modifiables manuellement.

Les PDF sans texte (scans) ou protégés par mot de passe ne sont pas pris en charge. Limites : 5 fichiers, 10 Mo et 80 pages par fichier, 60 000 caractères au total. Aucun audio n’est sauvegardé. Le texte des PDF utilisés en contexte est envoyé à OpenAI avec la demande ; les requêtes Responses utilisent `store:false`.

Les versions ne sont pas signées avec un certificat de distribution : signature locale ad hoc sur Mac, aucune signature éditeur sur Windows. Mac Intel n’est pas inclus dans la release. Un partage de tout l’écran peut montrer Clair.
