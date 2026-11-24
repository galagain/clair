# Souris et raccourcis clavier sur Mac

1. Dans **Clair → Réglages → Souris et clavier**, clique sur **Activer**.
2. macOS peut demander l’autorisation **Accessibilité**. Le bouton **Autorisations** ouvre le réglage. Autorise **Clair** (ou **Clair Souris** selon l’attribution de macOS), puis reviens cliquer sur **Activer**. Si le système le demande, quitte et rouvre Clair.
3. À côté d’**Arrière-plan**, clique sur **Aucun**, puis appuie sur le bouton de souris ou le raccourci clavier voulu dans les 10 secondes. L’association est enregistrée immédiatement.
4. Pour **Envoyer Firefox**, choisis **Texte** ou **Texte + images**, clique sur **＋ Ajouter**, puis appuie sur le bouton voulu ou sur une touche de fonction seule (F3 à F20), ou une combinaison avec ⌘, ⌥ ou ⌃. Échap annule. Répète pour ajouter plusieurs boutons ou combinaisons (12 maximum). Chaque ligne a son **×** pour la retirer.

Clair affiche le dernier bouton détecté. Les clics gauche/droit, le clic de molette et les boutons supplémentaires signalés par macOS sont reconnus, jusqu’au bouton 32. Tu peux ajouter une touche ⌥, ⌃, ⇧ ou ⌘ en la maintenant pendant le choix. Pour le clic gauche, une touche est obligatoire afin de conserver les clics ordinaires utilisables.

**Arrière-plan** masque ou réaffiche la fenêtre de Clair sans arrêter l’écoute. **Envoyer Firefox** demande directement une capture Texte ou Texte + images à l’extension connectée, lorsque Firefox est au premier plan. Aucun raccourci ni caractère n’est injecté dans l’éditeur. Ouvre une fois l’extension sur l’onglet de l’exercice pendant la préparation pour lui accorder cet accès ; après une navigation qui le révoque, ouvre-la de nouveau. Si l’extension n’est pas prête, Clair affiche un message au lieu de taper dans la page.

Un bouton associé est consommé pour cette action : il ne déclenche pas simultanément Retour, un menu ou le clic habituel. Le bouton Firefox garde son usage habituel dans les autres applications. Le bouton **×** près d’Ajouter retire les associations du type sélectionné ; celui de chaque ligne retire seulement ce bouton ; **Désactiver** arrête le module. Les réglages sont conservés localement. Après une mise en veille, réactive la détection si nécessaire.

Les boutons propriétaires convertis en commandes clavier ou gardés par un logiciel Logitech/Razer/etc. peuvent ne pas apparaître comme boutons de souris. Dans ce cas, configure-les comme boutons standard dans ce logiciel, ou associe directement **⌘ ⇧ H** et **Alt ⇧ C**. Une molette tournée, le changement de DPI et les gestes tactiles ne sont pas des clics de bouton standard.

F1 et F2 sans modificateur restent réservées aux modes Discours/Pistes et Code. Sur Mac, Fn peut être nécessaire pour transmettre une touche F plutôt que sa fonction multimédia.

Le module reconnaît les boutons et les combinaisons clavier enregistrés. Pendant l’ajout, seule la combinaison choisie est transmise à Clair ; les frappes ordinaires ne sont ni transmises ni enregistrées. Aucun déplacement de souris ni historique de clics n’est conservé. La détection est désactivée au départ et s’arrête à la fermeture de Clair. Aucun accès n’est accordé automatiquement par l’application.

La détection globale est implémentée pour **Mac uniquement**. Le module est compilé et testé avec des événements simulés ; les permissions, le pilote et l’envoi réel Firefox restent à vérifier avec ta souris. Le raccourci clavier reste disponible.

Références : [événements souris macOS](https://developer.apple.com/documentation/coregraphics/cgevent), [commandes et autorisation activeTab dans Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/User_actions).

Pour ajouter des raccourcis clavier, ouvre Firefox → `about:addons` → ⚙ → **Gérer les raccourcis des extensions**. Clair propose deux commandes Texte et deux commandes Texte + images : les raccourcis physiques Firefox restent configurables indépendamment des associations créées dans Clair.

Molette et poignée de taille : toute la surface des zones de texte défilantes est incluse dans le routage natif de la souris, avec conservation des espaces vides traversables. Le test Electron vérifie les régions, la molette haut/bas sur Discours, Traduction, Pistes et Code, la poignée ronde de 24 px, le glissement via IPC, la taille minimale, la fin du glissement et la conservation des dimensions lors du changement d’onglet. Le déplacement du curseur pour redimensionner est simulé dans un profil isolé ; aucune entrée système ni clé réelle n’est utilisée.

Version 0.29.2 : 186 tests unitaires réussis. Les contrôles Electron du paquet Mac vérifient l’unique accès Réglages, les rubriques accessibles à 340 et 400 px sans débordement horizontal, la taille conservée, le retour via le bouton actif, Terminé et Échap, ainsi que le lien d’ajout de clé. Les parcours Mac, Code/Firefox, recopie avec module simulé et molette/redimensionnement passent après adaptation aux rubriques repliables. Vérification visuelle du panneau et correspondance des sources embarquées effectuées. Profils temporaires et transports simulés : aucun appel API réel, aucune clé personnelle ni capture d’écran système. Le nouveau parcours Réglages est aussi ajouté à la CI Mac et Windows ; Windows n’a pas été exécuté localement.
