# Recopie sans Clair sur Mac

1. Connecte deux écrans et choisis **Affichage étendu** dans Réglages Système → Moniteurs.
2. Dans Clair, clique sur le **bouton aux deux écrans**, en haut à gauche des icônes de sections.
3. Choisis **Écran à recopier** et **Afficher la copie sur**, sélectionne la **Qualité**, puis **Démarrer**.
4. Au premier essai, macOS peut demander l’accès à **Enregistrement de l’écran** pour Clair ou Clair Recopie. Le bouton **Autorisations** ouvre le réglage. Autorise l’application, puis réessaie ; redémarre Clair si macOS le demande.

Une fenêtre sans bordure remplit l’écran de destination avec une copie de l’écran source. Clair et ses fenêtres sont exclus par le filtre ScreenCaptureKit. Les éventuelles bandes noires conservent les proportions. La copie reste une vue en lecture seule : continue de cliquer et d’écrire sur l’écran d’origine.

**Reclique sur le bouton aux deux écrans pour arrêter.** Le bouton Arrêter du menu fonctionne aussi. Un clic sur la copie puis **Échap** ferme la recopie. Masquer la fenêtre principale de Clair ne l’arrête pas. La fermeture ou le rechargement de Clair, la veille, le verrouillage et un changement de disposition des écrans arrêtent la recopie. Aucun démarrage automatique.

Les images restent dans le module natif local. Elles ne sont ni enregistrées sur disque, ni transmises à l’IA, à Firefox ou à l’iPhone. La recopie ne capture pas d’audio et n’ajoute pas de coût API. Le module est arrêté avec Clair ; aucun service permanent n’est installé.

Ce mode remplace la recopie macOS par une capture locale : un décalage est possible. Deux qualités sont disponibles : **Maximale** capture la résolution native Retina de la source, avec jusqu’à 60 images/seconde ; **Économique** limite la capture à 1920 × 1080 et 30 images/seconde. Maximale est sélectionnée au départ, puis le choix est mémorisé sur cet ordinateur. Arrête la recopie avant de changer de qualité. Le mode maximal utilise davantage de ressources et le débit réel dépend du Mac. L’image reste adaptée à la définition et aux proportions de l’écran de destination : des résolutions différentes peuvent encore entraîner une mise à l’échelle. Certains contenus protégés peuvent ne pas être capturés. Ce mode ne rend pas Clair invisible si tu partages directement l’écran source ; vérifie la source choisie dans ton outil de partage.

Le module compile et ses contrôles sont testés. Les tests automatisés du menu utilisent un module simulé et ne déclenchent ni capture ni demande de permission. **La recopie réelle et l’absence de Clair dans les pixels restent à vérifier sur deux écrans physiques** avant de s’y fier.

Disponible sur Mac uniquement, macOS 15 minimum. Référence : [filtre Apple qui exclut les fenêtres d’applications d’un écran capturé](https://developer.apple.com/documentation/screencapturekit/sccontentfilter/init(display:excludingapplications:exceptingwindows:)).

Le mode natif calcule les pixels de capture à partir des points et du [facteur Retina fourni par Apple](https://developer.apple.com/documentation/screencapturekit/sccontentfilter/pointpixelscale).
