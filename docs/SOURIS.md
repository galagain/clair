# Souris et raccourcis clavier sur Mac

1. Dans **Clair → Réglages → Souris et clavier**, clique sur **Activer**.
2. macOS peut demander l’autorisation **Accessibilité**. Le bouton **Autorisations** ouvre le réglage. Autorise **Clair** (ou **Clair Souris** selon l’attribution de macOS), puis reviens cliquer sur **Activer**. Si le système le demande, quitte et rouvre Clair.
3. À côté d’**Arrière-plan**, clique sur **Aucun**, puis appuie sur le bouton de souris voulu dans les 10 secondes. L’association est enregistrée immédiatement.
4. Pour **Envoyer Firefox**, choisis **Texte** ou **Texte + images**, clique sur **＋ Ajouter**, puis appuie sur le bouton voulu ou sur un raccourci clavier avec ⌘, ⌥ ou ⌃. Échap annule. Répète pour ajouter plusieurs boutons ou combinaisons (12 maximum). Chaque ligne a son **×** pour la retirer.

Clair affiche le dernier bouton détecté. Les clics gauche/droit, le clic de molette et les boutons supplémentaires signalés par macOS sont reconnus, jusqu’au bouton 32. Tu peux ajouter une touche ⌥, ⌃, ⇧ ou ⌘ en la maintenant pendant le choix. Pour le clic gauche, une touche est obligatoire afin de conserver les clics ordinaires utilisables.

**Arrière-plan** masque ou réaffiche la fenêtre de Clair sans arrêter l’écoute. **Envoyer Firefox** déclenche **Alt ⇧ C** pour Texte ou **Alt ⇧ V** pour Texte + images quand Firefox est au premier plan, ce qui utilise le même envoi que le raccourci clavier de l’extension. Il ne change pas d’application et n’écrit pas de code dans l’éditeur. Conserve Alt ⇧ C sur la commande Texte et Alt ⇧ V sur la commande Texte + images dans les raccourcis Firefox.

Un bouton associé est consommé pour cette action : il ne déclenche pas simultanément Retour, un menu ou le clic habituel. Le bouton Firefox garde son usage habituel dans les autres applications. Le bouton **×** près d’Ajouter retire les associations du type sélectionné ; celui de chaque ligne retire seulement ce bouton ; **Désactiver** arrête le module. Les réglages sont conservés localement. Après une mise en veille, réactive la détection si nécessaire.

Les boutons propriétaires convertis en commandes clavier ou gardés par un logiciel Logitech/Razer/etc. peuvent ne pas apparaître comme boutons de souris. Dans ce cas, configure-les comme boutons standard dans ce logiciel, ou associe directement **⌘ ⇧ H** et **Alt ⇧ C**. Une molette tournée, le changement de DPI et les gestes tactiles ne sont pas des clics de bouton standard.

Le module reconnaît les boutons et les combinaisons clavier enregistrés. Pendant l’ajout, seule la combinaison choisie est transmise à Clair ; les frappes ordinaires ne sont ni transmises ni enregistrées. Aucun déplacement de souris ni historique de clics n’est conservé. La détection est désactivée au départ et s’arrête à la fermeture de Clair. Aucun accès n’est accordé automatiquement par l’application.

La détection globale est implémentée pour **Mac uniquement**. Le module est compilé et testé avec des événements simulés ; les permissions, le pilote et l’envoi réel Firefox restent à vérifier avec ta souris. Le raccourci clavier reste disponible.

Références : [événements souris macOS](https://developer.apple.com/documentation/coregraphics/cgevent), [commandes et autorisation activeTab dans Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/User_actions).

Pour ajouter des raccourcis clavier, ouvre Firefox → `about:addons` → ⚙ → **Gérer les raccourcis des extensions**. Clair propose deux commandes Texte et deux commandes Texte + images : conserve **Alt ⇧ C** et **Alt ⇧ V** sur les deux premières pour les associations créées dans Clair ; les deux autres peuvent recevoir des touches supplémentaires.
