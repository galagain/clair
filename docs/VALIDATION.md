# Tests et limites

- Tests unitaires : audio, transcription ordonnée, annulation, historique, dédoublonnage, PDF, flux API simulés et protection des clés.
- Mac : démarrage de l’application empaquetée, interface, import PDF réel, mixage audio synthétique, opacité et navigation.
- Windows : démarrage de l’application empaquetée, démonstration, import PDF réel et mixage système/micro synthétique.
- Les sources embarquées sont comparées au dépôt avant publication.
- Les tests ne font aucun appel OpenAI réel et ne lisent aucune clé personnelle.
- Le lecteur PDF portable s’exécute dans un processus enfant avec délai maximal et annulation : un plantage de son composant natif ne doit plus fermer l’application.
- Coding : entrées bornées, connexion locale authentifiée, rejet des origines web, streaming, solution seule, remplacement pendant une génération, rejet des réponses obsolètes, copie exacte de l’indentation et navigation testés. L’interface empaquetée conserve la taille de fenêtre et accepte les captures reçues.
- Firefox 159 sur Mac : extension temporaire testée dans un profil isolé, permission `activeTab`, sélection d’énoncé, modèle d’éditeur synthétique complet, avertissement sur le code partiel, connexion, envoi explicite et déconnexion. Le contrôle Mozilla `web-ext lint` passe sans erreur ni avertissement.
- Raccourci direct : commande Alt ⇧ C enregistrée par Firefox déclenchée sur un nouvel onglet, sans popup et sans modifier l’éditeur ; échec hors connexion sans ouverture de fenêtre. Tests unitaires du double déclenchement, du changement de page, des erreurs réseau et des éditeurs multiples. Le test sans interface appelle la commande Firefox ; il ne simule pas une frappe physique sur le clavier du Mac.

iPhone : serveur arrêté par défaut, contenu borné et limité aux textes affichés, authentification par lien aléatoire, validation Host/Origin, lecture seule, révocation et reconnexion testées. Intégration native testée avec un profil isolé ; interface mobile vérifiée dans WebKit au format iPhone, en portrait et paysage, avec les sources du discours, la traduction, la relecture sans saut, le remplacement Coding et l’effacement. L’utilisateur a confirmé la connexion à un iPhone physique en sélectionnant l’adresse Ethernet du Mac. Les nouvelles cartes sont vérifiées dans WebKit : icônes indépendantes, affichage simultané, choix conservé au rechargement, relecture préservée, carte Code masquée non rouverte par une nouvelle solution.

Arrière-plan : bascule masquer/réafficher, restauration d’une fenêtre réduite et conflit de raccourci testés. Le test natif vérifie la poursuite de l’audio synthétique pendant le masquage ; le test iPhone vérifie que le partage reste actif et reçoit de nouveaux textes. La frappe physique du raccourci n’est pas simulée. Le raccourci utilise [globalShortcut](https://www.electronjs.org/docs/latest/api/global-shortcut) ; la fenêtre reste vivante via [BrowserWindow.hide](https://www.electronjs.org/docs/latest/api/browser-window).

Souris Mac : module Swift compilé et autotest sans accès aux entrées globales ; protocole, associations, doublons, désactivation concurrente, oubli, permissions refusées et arrêt testés. L’interface est vérifiée avec un module simulé, sans demander d’Accessibilité ni injecter de touches dans les applications personnelles. La capture de boutons physiques et l’émission réelle du raccourci Firefox ne sont pas encore validées. Les quatre icônes bureau sont testées avec taille conservée et Code masqué ; une ligne de 350 caractères est vérifiée sans débordement horizontal dans WebKit iPhone.

La capture d’une vraie visio, les permissions audio, les casques et la pertinence des réponses doivent encore être vérifiés en situation réelle sur chaque système. « Tester le son » vérifie les sources localement, sans API.

CoderPad réel, les éditeurs intégrés dans des cadres d’une autre origine, Firefox sous Windows et la qualité des aides Coding avec un vrai modèle restent à valider. L’extension n’est pas signée par Mozilla ; elle est rechargeable temporairement. Aucun code n’est exécuté ni soumis.

Sous Windows, une erreur transitoire d’ouverture du son système (`NotReadableError`, notamment « Could not start audio source ») déclenche deux nouvelles tentatives après 350 ms et 1 s. Arrêter l’écoute annule cette reprise. Un refus d’autorisation n’est jamais relancé automatiquement. Si l’échec persiste, Clair indique de vérifier la sortie audio par défaut, de rouvrir l’application puis, si nécessaire, d’essayer une autre sortie ou de désactiver ses améliorations audio. Les blocages de pilote, de confidentialité ou de sécurité restent à résoudre dans Windows ; cette reprise ne garantit pas leur disparition.

Le son système regroupe les applications : Clair ne sépare pas plusieurs participants distants. L’attribution micro/système reste approximative en cas d’écho ou de chevauchement. Le discours et les pistes sont en anglais par défaut, modifiables manuellement.

Les PDF sans texte (scans) ou protégés par mot de passe ne sont pas pris en charge. Limites : 5 fichiers, 10 Mo et 80 pages par fichier, 60 000 caractères au total. Aucun audio n’est sauvegardé. Le texte des PDF utilisés en contexte est envoyé à OpenAI avec la demande ; les requêtes Responses utilisent `store:false`.

Les versions ne sont pas signées avec un certificat de distribution : signature locale ad hoc sur Mac, aucune signature éditeur sur Windows. Mac Intel n’est pas inclus dans la release. Un partage de tout l’écran peut montrer Clair.

Le suivi vocal Coding est testé avec des transcriptions et une API simulées : source micro seule, regroupement, temporisation, annulation, réponse atomique, absence de changement, erreur, remplacement par une nouvelle capture et retour à la version précédente. Aucun appel API réel ni test de pertinence avec la voix de l’utilisateur.

Recopie Mac : module Swift compilé et contrôle interne sans capture ; tests du contrôleur (écrans invalides, permissions, arrêt, expiration, messages incorrects) et de l’interface avec un module simulé (sélection, activation, arrière-plan, débranchement, verrouillage). Pas de capture ni de validation des pixels sur deux écrans réels.

Envois successifs Coding : tests de page bloquée puis reprise sans capture tardive, raccourci ignorant une ancienne sélection, remplacement du contexte oral par le nouvel exercice et rejet d’une ancienne réponse retardée. Les tests utilisent des exercices, transcriptions et API simulés ; la cause exacte du texte hors sujet signalé par l’utilisateur n’a pas été enregistrée.

Associations multiples Firefox : migration de l’ancien bouton unique, ajout sans remplacement, doublons refusés, retrait individuel et effacement groupé testés ; interface empaquetée vérifiée avec le module souris simulé. Autotest Swift des listes et des anciennes associations réussi. Les quatre commandes clavier sont déclarées et utilisent le même envoi ; le raccourci principal a été retesté dans un vrai Firefox isolé. Les touches physiques et les boutons réels restent à vérifier avec le matériel de l’utilisateur.

Ajout clavier depuis ＋ Ajouter : combinaisons avec modificateur obligatoire, coexistence avec la souris, doublons indépendants du libellé de touche, sauvegarde, retrait et annulation testés avec des événements simulés. Le module Swift compile et son autotest distingue touches et boutons ; les frappes ordinaires ne sont pas publiées. L’envoi de touches synthétiques est marqué pour éviter une boucle. Les raccourcis physiques restent à valider avec les permissions et le clavier du Mac.

Modes F1/F2 : enregistrement des deux raccourcis globaux et résultat d’un conflit testés ; bascule depuis les réglages, panneaux exacts même avec traduction activée, conservation du code, répétition sans bascule inverse et dimensions inchangées contrôlées dans Electron avec des événements simulés. Les touches physiques ne sont pas injectées sur le Mac personnel.
