# Clair

Une petite fenêtre pour transcrire une visio, traduire les échanges et proposer des réponses avec tes PDF en contexte.

## Télécharger

- **[Mac Apple Silicon (M1 et suivants)](https://github.com/galagain/clair/releases/latest/download/Clair-Mac-arm64.dmg)** — macOS 15 ou plus récent.
- **[Windows 64 bits](https://github.com/galagain/clair/releases/latest/download/Clair-Windows-x64.exe)** — Windows 10 ou 11, sans installation.
- **[Extension Firefox](https://github.com/galagain/clair/releases/latest/download/Clair-Firefox.zip)** — chargement temporaire, [installation](docs/CODING.md).

## Utiliser

1. Ouvre Clair et ajoute ta clé OpenAI dans **Réglages**.
2. Glisse tes PDF dans **Fichiers**, si nécessaire.
3. Choisis la langue du discours et des réponses, puis clique sur **▶**.

Les quatre icônes du haut affichent ou masquent Discours, Pistes, Traduction et Code, sur Mac comme sur iPhone. Sur ordinateur, **F1** affiche Discours + Pistes et **F2** affiche Code. Sur Mac, utilise **Fn + F1/F2** si les touches règlent la luminosité.

Clair écoute le son de l’ordinateur et le micro. La traduction est facultative. Les nouvelles pistes s’ajoutent sous les anciennes ; remonte pour relire et clique sur **↓** pour revenir au direct.

**Coding** : ouvre **bouton ⌄ à côté de Code → Réglages Coding** pour coller un énoncé et du code, ou utilise **Alt ⇧ C** dans Firefox pour les envoyer directement à Clair, sans popup. **Alt ⇧ C** envoie le texte et le code ; **Alt ⇧ V** ajoute les images de la page. Dans **Réglages → Souris et clavier**, choisis le type d’envoi avant **＋ Ajouter** pour associer tes propres touches ou boutons. Le code contient de courts commentaires. **Suivre ma voix** adapte la solution à tes indications au micro, avec **Revenir** pour annuler. Chaque nouvel envoi Firefox remplace la solution. [Installer l’extension et l’utiliser](docs/CODING.md).

**Sur iPhone** : mets les deux appareils sur le même réseau local (Mac en Ethernet possible), puis ouvre **Réglages → iPhone → Connecter** dans Clair et scanne le QR code. Les quatre icônes affichent ou masquent des cartes empilées. **⌘ ⇧ H** sur Mac ou **Ctrl ⇧ H** sur Windows masque/réaffiche Clair sans arrêter l’écoute. [Guide](docs/IPHONE.md).

**Souris sur Mac** : dans **Réglages → Souris et clavier**, active la détection puis choisis un bouton pour l’arrière-plan et utilise **＋ Ajouter** pour associer des boutons ou combinaisons clavier à l’envoi depuis Firefox. [Configuration](docs/SOURIS.md).

Les appels API sont facturés sur ton compte OpenAI. Les versions ne sont pas certifiées par Apple ou Microsoft : le système peut demander une autorisation d’ouverture. Clair peut apparaître si tu partages tout ton écran.

[Développement](docs/DEVELOPMENT.md) · [Tests et limites](docs/VALIDATION.md) · [Toutes les versions](https://github.com/galagain/clair/releases)

**Recopie sans Clair (Mac)** : le bouton aux deux écrans, en haut, reproduit un écran sur un autre en excluant Clair. [Utilisation](docs/RECOPIE.md).
