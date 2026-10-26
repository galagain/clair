# Tests et limites

- Tests unitaires : audio, transcription ordonnée, annulation, historique, dédoublonnage, PDF, flux API simulés et protection des clés.
- Mac : démarrage de l’application empaquetée, interface, import PDF réel, mixage audio synthétique, opacité et navigation.
- Windows : démarrage de l’application empaquetée, démonstration, import PDF réel et mixage système/micro synthétique.
- Les sources embarquées sont comparées au dépôt avant publication.
- Les tests ne font aucun appel OpenAI réel et ne lisent aucune clé personnelle.

La capture d’une vraie visio, les permissions audio, les casques et la pertinence des réponses doivent encore être vérifiés en situation réelle sur chaque système. « Tester le son » vérifie les sources localement, sans API.

Sous Windows, une erreur transitoire d’ouverture du son système (`NotReadableError`, notamment « Could not start audio source ») déclenche deux nouvelles tentatives après 350 ms et 1 s. Arrêter l’écoute annule cette reprise. Un refus d’autorisation n’est jamais relancé automatiquement. Si l’échec persiste, Clair indique de vérifier la sortie audio par défaut, de rouvrir l’application puis, si nécessaire, d’essayer une autre sortie ou de désactiver ses améliorations audio. Les blocages de pilote, de confidentialité ou de sécurité restent à résoudre dans Windows ; cette reprise ne garantit pas leur disparition.

Le son système regroupe les applications : Clair ne sépare pas plusieurs participants distants. L’attribution micro/système reste approximative en cas d’écho ou de chevauchement. Le discours et les pistes sont en anglais par défaut, modifiables manuellement.

Les PDF sans texte (scans) ou protégés par mot de passe ne sont pas pris en charge. Limites : 5 fichiers, 10 Mo et 80 pages par fichier, 60 000 caractères au total. Aucun audio n’est sauvegardé. Le texte des PDF utilisés en contexte est envoyé à OpenAI avec la demande ; les requêtes Responses utilisent `store:false`.

Les versions ne sont pas signées avec un certificat de distribution : signature locale ad hoc sur Mac, aucune signature éditeur sur Windows. Mac Intel n’est pas inclus dans la release. Un partage de tout l’écran peut montrer Clair.
