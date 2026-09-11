# Démarrage rapide

Lolly transforme tes règles - couleurs, typographie, mises en page, logique - en outils que n'importe qui peut utiliser pour produire des fichiers finis : images, PDF, cartes sociales, vidéo, en remplissant quelques champs. Il y a peu à apprendre et rien à téléverser : la création et l'export s'exécutent sur ton appareil, en ligne comme hors ligne.

C'est la page à lire en premier. Deux choses te rendent opérationnel : **fais de Lolly la tienne** et **importe ce que tu as déjà** (tes fichiers de design et tes tokens). Tout le reste n'est qu'à un lien de distance.

> Nouveau sur Lolly et tu veux juste créer quelque chose ? [Créer quelque chose en 60 secondes](/info/make-something.html) t'en fait faire trois, ou alors [ouvre l'application](/#/), choisis n'importe quel outil dans la galerie, remplis les champs et clique sur **Exporter**. Reviens ici quand tu voudras que ce soit aux couleurs de *ta* marque.

![La vue Utilities - les bêtes de somme qui tournent sur l'appareil comme Strip Hidden Data, Compress PDF et Convert Image, toutes au même endroit](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## 1. Fais-en la tienne - configure ton design system

Ta marque dans Lolly est un petit document de **design tokens** - couleurs, polices et quelques règles - sur lequel chaque outil s'appuie pour son rendu. Configure-la une fois et tout ce que tu crées est conforme à la marque par construction, pas par relecture. Il y a trois portes d'entrée ; choisis celle qui correspond à l'endroit où ta marque vit déjà.

### Partir de zéro (le générateur de design system)

Au premier lancement, tu atterris sur la **galerie**, avec un court dialogue de bienvenue par-dessus qui propose trois portes d'entrée - **Personnalise-le** (le Brand Studio à `#/start`), **Apporte ton design** (dépose un fichier Figma, Penpot, InDesign ou PDF et il s'ouvre comme une mise en page modifiable - le chemin le plus rapide vers [Importe ce que tu as déjà](#2-bring-in-what-you-already-have) plus bas) et **Explorer les outils de la communauté** - plus une rangée de langues si l'anglais n'est pas la tienne. Prends la première carte et tu arrives dans le [**Brand Studio**](/info/brand-studio.html). Donne-lui un nom et une couleur principale et Lolly *dérive* une palette complète et accessible à partir de celle-ci - surfaces claires/sombres, texte, accents - avec les mêmes calculs de couleur que le moteur utilise partout ailleurs.

![L'espace Couleurs du Brand Studio - une couleur principale, et la palette accessible que Lolly en dérive](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours) Choisis une police et tu as une marque fonctionnelle en moins d'une minute. À partir de là, les six espaces du studio - Vue d'ensemble, Couleurs, Typographie, Logos, Tokens, Fichiers - te laissent aller aussi loin que tu veux, dans l'ordre que tu veux, et affiner n'importe quelle partie à chaque fois que tu reviens. L'onglet **Design system** du tableau de bord (`#/d`) montre le résultat en lecture seule et renvoie vers `#/start`, où se fait l'édition (sauf si tu es sur une version de Lolly verrouillée sur une marque, où la marque est fixe et où il n'y a rien à changer).

### Importer une marque que tu as déjà

Si ta marque est déjà consignée sous forme de design tokens - depuis **Penpot**, **Tokens Studio** (Figma) ou n'importe quel fichier **DTCG** simple - importe-la en bloc plutôt que de la ressaisir. Deux chemins :

- <!--i:palette--> **Dans l'application :** le [générateur de design system : Brand Studio](/info/brand-studio.html) (`#/start`) l'accepte via **Add from…** au pied de son rail d'espaces - un fichier de tokens, un export Penpot, un SVG ou un pack `LollyBrand`. Dépose-le et la palette s'anime.
- <!--i:code--> **Depuis la ligne de commande**, pour mettre en place un pack de marque réutilisable :

```bash
# a monolithic tokens.json, a one-file-per-set directory, or a Penpot project archive
npm run ingest:brand -- ./my-tokens.json --name acme --label "Acme" --activate
```

`ingest:brand` accepte les trois conteneurs dans lesquels Penpot / Tokens Studio exportent le même document - un unique `tokens.json`, un répertoire (`$metadata.json` + fichiers par ensemble) ou une archive `project.penpot`. Avec `--activate`, il enregistre la marque comme profil, bascule dessus et reconstruit le catalogue. Voir [Configuration](/info/configuration.html) pour savoir comment les packs de marque et les profils s'articulent.

### L'affiner dans l'application

Une fois une marque active, continue de la façonner dans le [**Brand Studio**](/info/brand-studio.html) (`#/start`) - change une couleur ou un rôle et chaque aperçu de l'application se met à jour au fur et à mesure que tu tapes. (L'onglet **Design system** du tableau de bord, à `#/d`, *montre* la marque en lecture seule ; c'est dans le Studio que tu la modifies.)

![L'onglet Design system du tableau de bord - la marque active affichée en lecture seule](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand) La même marque est résumée sur la carte **Profil → Ta marque**. Les polices sont réelles : choisis-en une dans Google Fonts et Lolly enregistre le fichier **sur ton appareil** comme ressource de marque, si bien que ta typographie voyage hors ligne et que rien n'est récupéré au moment du rendu.

Quand tu es satisfait, **exporte la marque sous forme de pack `LollyBrand`** - un seul fichier qu'un collègue peut importer pour obtenir exactement la même palette, les mêmes polices et les mêmes règles. C'est ainsi qu'une marque circule entre personnes et machines sans serveur intermédiaire.

> **Les tokens de marque font l'aller-retour dans les deux sens.** Parce que la marque de Lolly *est* des tokens DTCG - le format que Penpot lit et écrit nativement et que Tokens Studio apporte à Figma - la palette avec laquelle tu conçois et la palette que Lolly *impose* sont un seul et même document, pas deux listes que tu synchronises à la main. Voir [Tokens de design](/info/design-tokens.html).

## 2. Importe ce que tu as déjà

Tu ne pars pas d'une page blanche. Lolly ouvre le travail de design et les formats ouverts que tu possèdes déjà.

### Fichiers de design open source

Le travail terminé dans **Figma, Penpot, Illustrator, InDesign ou n'importe quelle application SVG** n'a pas à rester enfermé dans l'application où tu l'as dessiné. Ouvre **Design**, clique sur **Importer un design** et le fichier s'ouvre comme une *mise en page vivante* - pas une image aplatie. Chaque calque devient une boîte modifiable : le texte reste ressaisissable, les formes restent des formes, les images atterrissent dans ta bibliothèque et l'art vectoriel complexe est fidèlement préservé. Il arrive déjà conforme à tes polices de marque et à tes règles de couleur.

| Tu as | Importe-le comme |
|---|---|
| Une frame Figma | `.fig` natif (File → Save local copy), ou un export SVG |
| Un design Penpot | Son export `.penpot`, ou n'importe quel SVG |
| Un fichier Illustrator | `.ai` natif (compatible PDF) ou `.pdf` - s'ouvre directement |
| Une mise en page InDesign | `.idml` (File → Export → InDesign Markup) |
| Tout le reste | **N'importe quel SVG** - la porte d'entrée universelle |

L'import se fait entièrement **sur ton appareil** - le fichier est analysé dans ton navigateur et rien n'est téléversé. Tous les détails, et ce qui est exactement conservé, se trouvent dans [Importer un design](/info/design-import.html).

Tu as plutôt une **présentation PowerPoint** ? Dépose le `.pptx` sur **Deck Builder** pour la modifier diapo par diapo, déjà alignée sur ta marque - ou lance **Rebrand a Deck** pour récupérer la même présentation rehabillée, graphiques et animations intacts.

### D'une création ponctuelle à un modèle

Voici la récompense : une mise en page importée est une session Design ordinaire, donc dès que tu l'**enregistres**, elle vit à une URL. N'importe qui possédant Lolly peut ouvrir cette URL, changer les mots, remplacer une image et produire sa propre version - sans application de design, et les parties verrouillées restent verrouillées. Un design ponctuel devient un outil réutilisable. C'est toute l'idée, atteinte sans écrire une seule ligne de configuration.

### Données ouvertes et outils ouverts

L'[ensemble d'outils communautaires](/info/builders.html) est open source et indépendant de toute marque - codes QR, cartes de rues, filtres, utilitaires de confidentialité - et son rendu s'appuie sur *ta* marque dès que tu l'actives.

Alimente aussi les outils avec tes propres données ouvertes : colle ou dépose un tableau **CSV** ou **JSON** et les champs répétitifs d'un outil s'en remplissent, un fichier fini par ligne.

## 3. Crée quelque chose, puis partage-le ou automatise-le

Avec une marque active et ton matériel en main, chaque outil produit un fichier fini :

- <!--i:download--> **Fais le rendu** de n'importe quel outil en **SVG, PDF, PNG, JPG, WebP, vidéo** et plus encore - aux véritables dimensions d'impression et en unités physiques quand tu en as besoin. Voir [Export et formats](/info/exporting.html).
- <!--i:link--> **Partage un lien.** Chaque état d'outil est une URL, donc un fichier fini est reproductible et adressable par paramètres - archive le lien, régénère à la demande.
- <!--i:layers--> **Fais-le en masse.** Pilote un modèle depuis une feuille de calcul dans la [grille de traitement par lots](/info/exporting.html) : un fichier fini par ligne.
- <!--i:cpu--> **Automatise-le.** Le même rendu s'exécute depuis la [CLI](/info/cli.html) et depuis un [agent IA](/info/ai-agents.html) - une URL est l'API.

« Une URL, c'est l'API » est à prendre au pied de la lettre. Le graphique ci-dessous n'a été dessiné par personne : son type, son titre et tout son tableau de données ont été tapés dans la barre d'adresse, et le même lien produit le même graphique sur n'importe quel appareil.

![Un graphique en aires des inscriptions mensuelles, dont chaque valeur est arrivée comme paramètre de requête plutôt que par un clic](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Où aller ensuite

Trois parcours, selon ce que tu es venu faire ici :

- <!--i:people--> **[Lolly pour les créateurs](/info/creators.html)** - tu crées des choses. Les avantages, et comment tirer le meilleur parti de l'application.
- <!--i:code--> **[Lolly pour les développeurs](/info/builders.html)** - tu conçois des outils, tu intègres et tu déploies. La documentation technique.
- <!--i:shieldcheck--> **[Lolly pour les opérateurs](/info/operators.html)** - tu es responsable de la marque, de la sécurité et du déploiement dans une organisation.
