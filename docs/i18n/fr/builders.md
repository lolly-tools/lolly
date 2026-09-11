# Lolly pour les développeurs

La documentation technique - pour toute personne qui crée des outils, intègre Lolly dans un pipeline, l'auto-héberge, ou étend la plateforme.

**Ce que tu y gagnes.** Crée un outil une fois, et la demande arrête de te revenir. L'éternel « tu peux juste me faire un… » qui te bouffe tes après-midis devient un template que les autres remplissent eux-mêmes - correctement, sans que tu sois dans la boucle. Ton travail, c'est du HTML/CSS/JS pur : versionné, diffable, relisable, et il tourne sur un moteur ouvert sans dépendance à un fournisseur, donc ça reste à toi. Automatise la chaîne de production, et ton temps va au problème intéressant, pas au dix-millième export.

Lolly est un **moteur** indépendant de la plateforme qui exécute le même chemin de rendu sur plusieurs **shells** (PWA web, Tauri desktop/mobile, CLI, TUI). Les outils sont des **données, pas du code embarqué** - un manifeste, plus un template, plus des hooks optionnels - si bien que les nouveaux outils sont livrés sans mise à jour de l'application. Commence par la [Vue d'ensemble](/info/overview.html) pour l'architecture, puis suis le parcours adapté à ce que tu construis.

Nouveau sur la plateforme ? Le **[Guide de démarrage rapide](/info/quickstart.html)** met en place une marque et ton premier rendu avant d'aller plus loin.

## Comprendre l'architecture



- **[Vue d'ensemble](/info/overview.html)** - pourquoi Lolly existe, la séparation moteur/shell/outils, le pont de capacités, et les décisions d'architecture arrêtées.
- **[Jetons de design](/info/design-tokens.html)** - le modèle de jetons DTCG dans lequel les marques sont exprimées, et comment les outils les consomment.

## Créer des outils

Chaque contrôle ci-dessous a été généré à partir d'une entrée déclarée dans `tool.json`. Tu écris la ligne du manifeste, le host dessine le widget, et le même modèle pilote la CLI et l'URL.

![One declared input, one generated control: a url, a colour, a select, a number, a boolean](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code&width=1440&height=900&dpi=192&waitMs=2000&cropSelector=.tool-inputs&walker=1&format=svg&dark=1&filename=aud-manifest-controls)

Et ça monte bien au-delà de cinq contrôles. Donne une `section` à une entrée et le host la replie : un outil à cinquante entrées comme D3 Chart Studio s'ouvre malgré tout sur une pile courte, le reste étant rangé derrière des groupes nommés.

![The D3 sidebar - a handful of primary controls, then Data, Columns, Chart, Axes and the other sections collapsed into one line each](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=1600&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-d3-sections)

- **[Guide de création d'outils](/info/authoring-tools.html)** - le guide complet : manifeste, template, styles, hooks, composition et publication.
- **[Créer des assets](/info/authoring-assets.html)** - assets du catalogue, niveaux, locales, palettes, icônes thémables et polices.
- **[API Host](/info/host-api.html)** - le pont de capacités `HostV1` sur lequel chaque outil est écrit (la seule API que voient les outils).
- **[Mode URL](/info/url-mode.html)** - chaque entrée sous forme de paramètre d'URL ; paramètres réservés, encodage compact, liens compactés.

## Exécuter et intégrer

- **[CLI](/info/cli.html)** - rendu headless ; le même chemin de rendu que l'interface graphique, piloté par des arguments `--foo=bar`.
- **[TUI](/info/tui.html)** - le shell terminal interactif.
- **[Serveur MCP](/info/mcp.html)** - le point de terminaison natif qui permet à un agent IA de découvrir et d'exécuter des outils.
- **[Agents IA](/info/ai-agents.html)** - piloter Lolly depuis un modèle : une URL, c'est l'API.
- **[Extension Chrome](/info/extension.html)** - capture une URL en direct sous forme d'asset réutilisable.

## Livrer et exploiter

- **[Guide de build](/info/build-guide.html)** - compile chaque cible : CLI, TUI, desktop, mobile.
- **[Déploiement](/info/deployment.html)** - l'appli web, les applis, et les services backend ; où s'exécute chaque partie.
- **[Configuration](/info/configuration.html)** - profils, packs de marque, contrôle des capacités, feature flags, et validation du catalogue.

## Confiance et données

Les droits et la paternité sont des entrées comme les autres. Embed & Track Image déclare des champs auteur, copyright, licence et contact, et l'export les écrit dans les métadonnées du fichier lui-même et dans son manifeste C2PA.

![The Embed and Track Image controls - creator, copyright, a licence dropdown, contact and title, filled from the link](/t/url-shot?url=%2F%23%2Ftool%2Fclaim%3Fcreator%3DAda%2520Lovelace%26title%3DEngine%2520Notes&width=1440&height=1200&dpi=192&waitMs=2200&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-rights-fields)

- **[Identité Content Credentials](/info/content-credentials-identity.html)** - signature délivrée par une autorité de certification (AC) pour le C2PA sur l'appareil ; contrats du moteur et runbook opérateur.
- **[Transfert de données](/info/data-transfer.html)** - le bundle `lolly-backup` : enveloppe, intégrité, et garanties inter-shells.
- **[À propos](/info/about.html)** - le projet, le périmètre de sa licence, et le dépôt.
