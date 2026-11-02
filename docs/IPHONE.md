# Clair sur iPhone

1. Ouvre Clair sur ton Mac ou PC et connecte l’iPhone au **même Wi-Fi**.
2. Dans Clair, ouvre **Réglages → iPhone → Connecter**.
3. Scanne le QR code avec l’appareil photo de l’iPhone et ouvre le lien dans **Safari**.

Tu retrouves **Pistes**, **Discours**, **Traduction** si elle est activée, et **Coding**. **A− / A+** règlent la taille du texte. Les pistes continuent de s’ajouter ; remonte pour relire, puis touche **Au direct**. Chaque nouveau raccourci Firefox remplace la solution Coding, sur les deux écrans. Le code se fait défiler horizontalement si une ligne est trop longue.

Clair doit rester ouvert sur l’ordinateur, qui écoute le son et appelle l’IA. Tu peux réduire sa fenêtre avec **… → Réduire la fenêtre**. L’iPhone sert d’écran de lecture : les réglages, les fichiers et les commandes restent sur l’ordinateur. Garde Safari au premier plan et l’écran de l’iPhone allumé pour suivre le direct. Au retour dans Safari, la page récupère l’affichage actuel.

## Connexion

- Aucun compte ni application iPhone à installer. Aucun coût API supplémentaire pour cet affichage.
- Utilise un **Wi-Fi de confiance**. La connexion locale utilise HTTP/WebSocket sans chiffrement ; une personne capable d’observer ce réseau peut lire le trafic. Le lien privé donne accès aux textes affichés : ne le partage pas.
- **Déconnecter** dans Clair ferme l’accès et invalide le lien. Quitter ou recharger Clair, ou mettre l’ordinateur en veille, arrête aussi le partage. Il faut ensuite scanner un nouveau QR code.
- Une coupure temporaire affiche **Reconnexion** ; le texte précédent reste visible et sera actualisé au retour du réseau. Si le partage est explicitement arrêté pendant la connexion, l’écran du téléphone est vidé.
- Pas de relais Internet : cette version fonctionne sur le réseau local, pas depuis un autre Wi-Fi ou en 4G/5G. La clé API, les PDF, l’audio et les réglages ne sont pas envoyés au téléphone ; les réponses peuvent évidemment contenir des éléments tirés des PDF.
- Les derniers textes sont conservés en mémoire pour l’affichage, jusqu’à 60 000 caractères par section et 48 000 pour Coding. Aucun contenu n’est enregistré par la page. Safari conserve le lien de connexion dans le stockage de l’onglet pour permettre son rechargement.

Si la page ne s’ouvre pas, vérifie le Wi-Fi, autorise Clair à recevoir les connexions locales dans le pare-feu et évite le réseau invité qui isole les appareils. Si plusieurs réseaux sont proposés dans Clair, choisis celui de ton iPhone. Après un changement de réseau, déconnecte puis reconnecte l’affichage.

Vérifié dans WebKit au format iPhone avec des données synthétiques. L’ouverture du QR code et la connexion sur un iPhone physique restent à tester.

Le direct utilise l’[API WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket). Le QR code est généré localement avec [qrcode](https://www.npmjs.com/package/qrcode), sans service externe.
