# Coding + Firefox

1. Dans **Clair → bouton ⌄ à côté de Code → Réglages Coding → Firefox**, clique sur **Ouvrir l’extension**.
2. Dans Firefox 140 ou plus récent, ouvre `about:debugging#/runtime/this-firefox`, clique sur **Charger un module complémentaire temporaire**, puis choisis `manifest.json` dans ce dossier. Le ZIP `Clair-Firefox.zip` convient aussi.
3. Dans Clair, clique sur **Copier le code**. Ouvre l’extension, colle-le dans **Connexion à Clair**, puis clique sur **Connecter**. Ce code relie les deux applications ; ce n’est pas ta clé API.
4. Sur la page d’exercice, sélectionne de préférence l’énoncé puis presse **Alt ⇧ C** : l’extension envoie immédiatement l’énoncé, le code accessible et les sorties de tests à Clair, qui affiche la solution. Aucun popup Firefox ne s’ouvre. Pour contrôler ou modifier le contenu avant l’envoi, clique plutôt sur l’icône de l’extension et utilise **Envoyer et analyser**.

Le raccourci fonctionne lorsque Firefox a le focus. Il est modifiable dans `about:addons` → roue dentée → **Gérer les raccourcis des extensions**. En cas d’échec, un **!** apparaît sur l’icône ; le détail est accessible en ouvrant l’extension. Aucune notification système ni fenêtre ne s’ouvre automatiquement. Le raccourci ne rend pas Clair invisible dans un partage d’écran.

L’onglet **Coding** affiche uniquement la solution, sans explications. Chaque raccourci remplace la précédente et annule sa génération si elle est encore en cours. Les réglages et commandes sont dans **bouton ⌄ à côté de Code → Réglages Coding**, en haut de Clair. **Résoudre** utilise le contenu envoyé ou modifié dans Clair. **Copier** copie la solution avec son indentation. **Effacer** retire l’exercice et la solution ; l’export de session inclut seulement la solution actuelle.

L’aide utilise le modèle et la clé déjà configurés dans Clair. Python et C++ sont sélectionnables. Si une information indispensable manque, une courte question remplace le code. Le micro n’est pas nécessaire.

## Limites

- L’extension est **non signée** : il faut la recharger après chaque fermeture de Firefox. Une distribution permanente nécessite une signature Mozilla. La fermer ne révoque pas le code de connexion ; **Déconnecter** dans Clair le révoque. Un redémarrage de Clair exige une nouvelle connexion.
- Les éditeurs Monaco, CodeMirror et Ace exposant leur modèle peuvent fournir le code complet. Sinon, seule la partie rendue est accessible. Un avertissement accompagne alors la capture dans Clair. Si plusieurs éditeurs sont détectés, le raccourci ne choisit pas de code au hasard : sélectionne le bon éditeur dans l’aperçu manuel ou colle ton code dans Clair. Les cadres d’une autre origine peuvent être inaccessibles. Aucune compatibilité avec une session CoderPad réelle n’est garantie sans essai.
- Aucun code n’est exécuté, aucun texte n’est écrit dans l’éditeur et aucune soumission n’est faite.
- Le contenu n’est pas rafraîchi en continu : un raccourci envoie une nouvelle capture, un clic envoie l’aperçu modifié. Aucun nouvel envoi automatique après une erreur. Les bornes sont 24 000 caractères d’énoncé, 32 000 de code et 8 000 de sorties de tests. Seule la dernière solution est conservée pendant cette session.

## Données

L’accès est limité à l’onglet activé par l’utilisateur et à une connexion locale sur `127.0.0.1`. Le serveur local démarre au clic sur **Copier le code** et exige un code aléatoire. L’extension ne reçoit jamais la clé OpenAI. Elle conserve le code de connexion et le langage de code choisi dans son stockage local, ainsi que le dernier statut du raccourci pendant la session Firefox ; l’aperçu disparaît à sa fermeture.

Le texte sélectionné ou rendu de la page, le code et les sorties visibles sont transmis au raccourci, sans aperçu préalable. L’icône permet toujours de consulter l’aperçu manuel. Pas de HTML brut, de cookies, d’historique de navigation, de mot de passe ni de capture d’écran. Le titre et le nom d’hôte de la page accompagnent l’exercice ; son URL complète n’est pas envoyée. Du texte sensible affiché dans la page peut figurer dans la capture : utilise le raccourci sur l’exercice voulu.

**Alt ⇧ C** ou **Envoyer et analyser** transmet ces données à Clair puis à OpenAI, avec `store:false`, sur le compte API configuré. Aucun envoi en dehors de ces actions. Clair garde l’exercice et sa solution en mémoire jusqu’au prochain envoi, à leur effacement ou à sa fermeture. L’export manuel écrit la solution actuelle sur disque. Utilise ce mode pour tes entraînements ou les sessions où l’assistance est autorisée.

Références : [permissions Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/permissions), [installation temporaire](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/), [signature Mozilla](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/), [réponses OpenAI en streaming](https://developers.openai.com/api/docs/guides/streaming-responses).
