# Boutons de souris sur Mac

1. Dans **Clair → Réglages → Souris**, clique sur **Activer**.
2. macOS peut demander l’autorisation **Accessibilité**. Le bouton **Autorisations** ouvre le réglage. Autorise **Clair** (ou **Clair Souris** selon l’attribution de macOS), puis reviens cliquer sur **Activer**. Si le système le demande, quitte et rouvre Clair.
3. À côté d’**Arrière-plan**, clique sur **Aucun**, puis appuie sur le bouton de souris voulu dans les 10 secondes. L’association est enregistrée immédiatement.
4. Fais de même pour **Envoyer Firefox** avec un autre bouton.

Clair affiche le dernier bouton détecté. Les clics gauche/droit, le clic de molette et les boutons supplémentaires signalés par macOS sont reconnus, jusqu’au bouton 32. Tu peux ajouter une touche ⌥, ⌃, ⇧ ou ⌘ en la maintenant pendant le choix. Pour le clic gauche, une touche est obligatoire afin de conserver les clics ordinaires utilisables.

**Arrière-plan** masque ou réaffiche la fenêtre de Clair sans arrêter l’écoute. **Envoyer Firefox** déclenche **Alt ⇧ C** quand Firefox est au premier plan, ce qui utilise le même envoi que le raccourci clavier de l’extension. Il ne change pas d’application et n’écrit pas de code dans l’éditeur. Conserve Alt ⇧ C pour la commande « Envoyer la page à Clair et analyser » dans les raccourcis Firefox.

Un bouton associé est consommé pour cette action : il ne déclenche pas simultanément Retour, un menu ou le clic habituel. Le bouton Firefox garde son usage habituel dans les autres applications. Le bouton **×** retire une association ; **Désactiver** arrête le module. Les réglages sont conservés localement. Après une mise en veille, réactive la détection si nécessaire.

Les boutons propriétaires convertis en commandes clavier ou gardés par un logiciel Logitech/Razer/etc. peuvent ne pas apparaître comme boutons de souris. Dans ce cas, configure-les comme boutons standard dans ce logiciel, ou associe directement **⌘ ⇧ H** et **Alt ⇧ C**. Une molette tournée, le changement de DPI et les gestes tactiles ne sont pas des clics de bouton standard.

Le module observe uniquement les événements de boutons et les touches modificatrices présentes au moment du clic. Il n’enregistre ni saisie clavier, ni déplacement de souris, ni historique de clics. La détection est désactivée au départ et s’arrête à la fermeture de Clair. Aucun accès n’est accordé automatiquement par l’application.

La détection globale est implémentée pour **Mac uniquement**. Le module est compilé et testé avec des événements simulés ; les permissions, le pilote et l’envoi réel Firefox restent à vérifier avec ta souris. Le raccourci clavier reste disponible.

Références : [événements souris macOS](https://developer.apple.com/documentation/coregraphics/cgevent), [commandes et autorisation activeTab dans Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/User_actions).
