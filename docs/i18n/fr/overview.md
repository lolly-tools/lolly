# Aperçu

![Icône Lolly - Grande sucette verte et blanche](/info/icon.svg)

Ce document décrit l'objectif, la structure et les décisions architecturales de la plateforme Lolly. Il reflète à la fois la vision produit et l'état actuel du code.

> **Statut :** Lolly est un prototype interne dans un **pilote fermé qui n'est pas encore terminé**. Le moteur est déterministe et cohérent en interne, mais le produit est jeune - SUSE est le client numéro un - et ses moteurs de cryptographie et d'analyse de fichiers sont actuellement soumis au durcissement strict de l'infrastructure SUSE, en préparation d'une échelle entreprise (on excelle dans ce domaine). Lis l'architecture ci-dessous comme une intention de conception en cours de test, pas un produit fini et certifié. Voir [Adoption et gouvernance](/info/adoption-governance.html#status) pour savoir comment le pilote est mené et mesuré.

> **Comment lire cette page.** Elle contient deux types de contenu, dans l'ordre. La première moitié
> explique **pourquoi cela existe** : le problème, le positionnement et le cycle de vie qu'un seul
> asset parcourt. À partir de [La vue d'ensemble](#the-big-picture-how-the-layers-fit), il s'agit de
> **comment les couches s'articulent** : le document d'architecture pour les contributeurs, couvrant
> la séparation moteur/coquille/pack, la disposition du dépôt, les cibles de livraison et les
> engagements qui contraignent chaque changement de la plateforme. Si tu es ici pour modifier le
> code plutôt que pour comprendre le produit, commence par la vue d'ensemble.
>
> Deux documents compagnons vont plus loin que cette page. [`engine/README.md`](../engine/README.md)
> dans le dépôt est la carte module par module du moteur, avec un tableau généré de chaque module et
> de ce qu'il analyse ou écrit. [Modèle de menace et limites de confiance](/info/threat-model.html)
> reprend la même architecture lue sous l'angle des limites de confiance, et c'est la bonne page
> pour toute question sur ce que le moteur traite comme non fiable.

---

## Pourquoi cela existe

Les équipes font face à un problème récurrent : un travail créatif et éditorial répétitif, trop prévisible pour justifier des mains expertes à chaque fois, mais trop sensible à la qualité pour être délégué sans garde-fous. Le résultat est soit un débit lent (goulot d'étranglement du spécialiste), soit une incohérence (chacun utilise l'outil qu'il a sous la main), soit un enfermement propriétaire (un DAM SaaS qui contrôle tes modèles).

Cette plateforme est la réponse directe :

> **Du créatif et du contenu programmatiques à grande échelle** - une génération de ressources sans main-d'œuvre, avec les règles sous contrôle central, pour les employés, les fournisseurs et les partenaires.

Lolly n'est pas l'endroit où un système de marque s'invente - c'est l'endroit où il se produit. Pense à un distributeur automatique pour le design : tu fais un choix, tu obtiens un résultat. À chaque fois. Le moteur vise la plus haute qualité que chaque format puisse produire sur le matériel que tu as sous la main, et le même moteur produit le même fichier sur chaque surface où il est livré.

Le résultat est l'**abondance** : chaque événement a une signalétique correcte, chaque alerte CVE respecte la charte, chaque étiquette s'imprime proprement, chaque signature e-mail est à jour - tout cela sans ticket de design. La plateforme gère le créatif opérationnalisé récurrent. Ce n'est délibérément pas un outil créatif sur mesure - les designers continuent de posséder le travail phare.

### Innover de façon probabiliste, passer à l'échelle de façon déterministe

Tout débat sur l'IA dans un pipeline créatif bute sur la même question : quelle part revient à la machine ? C'est une vieille question dont la réponse est établie. Les scribes et les enlumineurs travaillaient déjà entre deux instruments - l'esquisse libre, où rien n'était fixé et tout pouvait être tenté, et la presse à imprimer, intimidante justement parce qu'elle engageait. Les esquisses étaient là où l'art se produisait. La presse était le moyen de l'atteindre. Personne ne confondait les deux, et les deux ont continué à progresser - nouvelles encres, nouveaux caractères, nouvelles presses - chacune s'améliorant en harmonie avec l'artisanat et l'intention qu'elle servait.

Lolly trace la même ligne. Explore de façon probabiliste : un modèle, un designer, une idée brute, une invite qui mène quelque part que personne n'avait prévu. Puis passe à l'échelle de façon déterministe - ce qui atteint dix mille sorties est un *outil*, et un outil se restitue de la même manière à chaque fois à partir d'entrées que tu peux lire. L'exploration reste libre parce que rien en aval ne dépend qu'elle aboutisse de la même façon deux fois. Le résultat gagne la confiance parce que ce n'est pas une supposition. Faire passer l'expérimentation par IA à des résultats prévisibles et reproductibles n'est pas une discipline nouvelle ; c'est la même division du travail qui a rendu l'imprimé digne de confiance à l'origine.

> Fais confiance au processus créatif, passe à l'échelle avec rigueur.

### Face aux alternatives

::: figure positioning-comparison
Exhaustivité des fonctionnalités des outils créatifs actuels, étudiée en août 2026. Notation : 0 absent, 25 solution de contournement, 50 réel mais restreint ou partiel, 75 solide avec réserves, 100 compétence de base.
:::

L'écart est évident : rien de ce qui est actuellement disponible n'offre une sortie axée sur les contraintes, capable de fonctionner hors ligne, accessible sans compétence pointue et en interne. Lolly comprend même un canevas ouvert - **Design** - où les couleurs, la typographie et les ressources se conforment aux globaux de marque, si bien que la disposition libre reste axée sur les contraintes. Ce que ce n'est **pas**, c'est une suite de design sans contraintes : les designers continuent d'utiliser Illustrator et Figma pour le travail phare sur mesure. Des permutations peuvent être assemblées avec cet outil.

![Chaque outil de la bibliothèque sous forme de carte, groupé par catégorie, pour qu'un producteur en choisisse un et commence](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=aud-gallery-landscape)

**À utiliser pour :** la génération rapide de ressources créatives opérationnalisées - tuiles d'événement, badges nominatifs, signatures, alertes CVE, codes QR, cartes sociales, étiquettes de consignation, rapports structurés.

**À ne pas utiliser pour :** le contenu phare sur mesure.

---

## Le cycle de vie d'une campagne

La façon la plus claire de voir ce qu'est Lolly n'est pas une liste de fonctionnalités - c'est de suivre une seule ressource au fil de son passage de main en main. Observe une carte de campagne localisée circuler dans l'organisation :

1. **Le créatif fixe les règles.** Un designer crée le modèle de base dans l'outil Design, en codant en dur les variables de typographie et de couleur de la marque. Il ne fait pas une seule carte - il fait le travail fondamental *une fois* pour ne plus jamais avoir à la localiser à la main.
2. **Le développeur le déploie à grande échelle.** Ce même modèle est intégré dans un pipeline nocturne via la CLI, si bien qu'un nouveau graphique ou une nouvelle variante linguistique est généré automatiquement - personne ne rouvre le fichier.
3. **Le producteur l'utilise simplement.** Un commercial, hors ligne dans un avion, ouvre le même outil et génère une présentation parfaitement conforme à la marque pour un rendez-vous client. Aucune compétence en design, aucun réseau, aucune attente.

Le « nouveau graphique » de l'étape deux est une restitution comme celle-ci, produite à partir d'une chaîne de données et d'une poignée de paramètres, sans que personne n'ouvre un fichier de design :

![Un graphique en aires empilées avec titre, ses trois séries en bandes dans une palette froide, avec axes, légende et titre tous placés par le modèle plutôt qu'à la main](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Le point n'est pas que Lolly soit bon pour les designers *et* bon pour les développeurs *et* bon pour les commerciaux, chacun dans son coin. C'est une **course de relais** : le travail initial du créatif est déployé à l'échelle par le développeur, qui à son tour donne du pouvoir au producteur. L'expérience sans effort pour le commercial non technique dans l'avion n'est possible que grâce à la rigueur fixée par le designer et déployée par le développeur.

C'est le multiplicateur de force. Lolly n'est pas un tiroir d'outils séparés pour des rôles séparés - c'est un seul cycle de vie déterministe des ressources auquel chaque rôle contribue, et chaque main par laquelle il passe multiplie la valeur de la précédente.

---

## Une approbation, dix mille ressources

Parce que l'approbation réside dans l'outil et non dans le fichier (voir [Comment Lolly se compare](/info/positioning.html)), passer à l'échelle cesse d'être un problème de révision. Approuve un outil de carte sociale localisée une fois, puis génère **10 000 ressources dans 12 langues** à partir d'un tableur - et aucune d'elles n'a besoin d'un nouveau contrôle de conformité du service juridique ou de la marque, parce que le modèle dont elles proviennent toutes a déjà été approuvé.

Le même outil déterministe atteint cette échelle de trois façons, toutes produisant une sortie identique et pré-approuvée :

- <!--i:people--> **Une personne, dans l'app.** La grille de lot `/pro` : colle ou importe les lignes, obtiens une ressource finie par ligne, télécharge le zip. Aucune compétence en design, aucun ticket, aucune attente.
- <!--i:code--> **Un développeur, depuis la ligne de commande.** La CLI exécute le *même* moteur et le *même* chemin de restitution en mode headless, si bien que l'outil peut être enchaîné sur les 10 000 lignes dans un script ou un pipeline nocturne. Un appel `lolly <tool> --field=…` dans une boucle constitue toute l'intégration.
- <!--i:cpu--> **Un système ou un agent IA, via MCP.** Le même outil piloté de façon programmatique, avec la même fidélité et une échelle encore plus grande - car une machine ne s'ennuiera pas pendant que des milliers de fichiers défilent.

![Le mode Batch sur une installation fraîche : une ligne vide attend un outil, avec toute la surface façon tableur et son bouton Rendre déjà en place avant l'arrivée de données](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

Un seul jeu de contraintes de marque, fixé une fois par un designer ; trois voies vers la même sortie pré-approuvée - et la voie machine passe à l'échelle plus loin que toutes les autres, car elle ne se fatigue jamais pendant que les fichiers défilent.

---

## La vue d'ensemble : comment les couches s'articulent

Tout ce qui suit relève de l'architecture. Le diagramme est le système entier en une seule vue : les outils sont
des données en haut, le moteur au milieu ne connaît aucune plateforme, les coquilles en dessous
mettent en œuvre un seul contrat, et les catalogues fournissent le contenu.

```
                ┌─────────────────────────────────────────────┐
                │              Tools (data, not code)         │
                │   tool.json + template.html + hooks.js?     │
                └─────────────────────────────────────────────┘
                                    ▲
                                    │ talks to via Capability Bridge v1
                                    ▼
                ┌─────────────────────────────────────────────┐
                │                  Engine                     │
                │   loader · validator · runtime · template   │
                │   inputs · url-mode                         │
                │   PLATFORM AGNOSTIC. Knows nothing of DOM,  │
                │   filesystem, or You.                       │
                └─────────────────────────────────────────────┘
                                    ▲
                                    │ implements HostV1
                                    ▼
        ┌──────────────┬──────────────┬──────────────┬──────────────┐
        │  Web Shell   │ Tauri Desktop│ Tauri Mobile │  CLI Shell   │
        │   (PWA)      │              │              │              │
        └──────────────┴──────────────┴──────────────┴──────────────┘
                                    ▲
                                    │ fetches from
                                    ▼
                ┌─────────────────────────────────────────────┐
                │              Catalogs                       │
                │   catalog/tools/index.json + tool dirs      │
                │   catalog/assets/index.json + asset files   │
                └─────────────────────────────────────────────┘
```

### Disposition du dépôt

Le contenu est monté sous forme de packs : `community/`, `docs/`, chaque `shells/*`, `services/*` et `brands/suse` sont chacun leur propre dépôt, extraits comme sous-modules git de celui-ci. Le dépôt parent possède `engine/`, `schemas/`, `scripts/`, `tests/`, `api/`, `brands/lolly-start/` et `profiles.json`. Voir [Guide de compilation » Obtenir la source](/info/build-guide.html) pour la commande d'extraction et le flux de travail multi-dépôts.

```
lolly/
├── engine/           # Platform-agnostic core. Open source (MPL-2.0).
│   └── src/
│       ├── index.ts          # public surface - loader, runtime, template, inputs, url-mode
│       ├── loader.ts         # fetches and validates tool files
│       ├── runtime.ts        # orchestrates the 5-step lifecycle
│       ├── template.ts       # Handlebars hydration + annotateTemplate
│       ├── inputs.ts         # manifest → runtime input model
│       ├── url-mode.ts       # URL ↔ input state round-trip
│       ├── validate.ts       # JSON Schema validation of manifests
│       ├── compose.ts        # resolve nested tool renders (composes)
│       ├── embed.ts          # parse portable lolly.tools embed URLs
│       └── bridge/
│           └── host-v1.ts    # type re-export of the @lolly-tools/core contract
│
├── shells/
│   ├── web/          # PWA - hosted online; primary distribution
│   │   └── src/
│   │       ├── main.ts           # boot, routing
│   │       ├── theme.ts          # theme apply/persist (FOUC prevention)
│   │       ├── bridge/           # web implementations of HostV1 APIs
│   │       │   ├── index.ts      # compose all bridge pieces
│   │       │   ├── db.ts         # IndexedDB setup
│   │       │   ├── state.ts      # host.state - saved edits
│   │       │   ├── profile.ts    # host.profile - user details
│   │       │   ├── assets.ts     # host.assets - catalog + user uploads
│   │       │   ├── clipboard.ts  # host.clipboard
│   │       │   ├── export.ts     # host.export - rasterise/serialize
│   │       │   ├── net.ts        # host.net - allowlisted fetch
│   │       │   └── media.ts      # host.media - live camera frames (onFrame)
│   │       ├── catalog/
│   │       │   └── sync.ts       # boot-time catalog sync + offline cache
│   │       ├── styles/           # app-wide CSS (app.css, picker.css, tokens.css)
│   │       └── views/
│   │           ├── gallery.ts    # tool library listing + saved-state cards
│   │           ├── tool.ts       # mounts one tool (inputs + canvas + actions)
│   │           ├── picker.ts     # asset picker UI (invoked by host.assets)
│   │           ├── profile.ts    # user details editor
│   │           ├── projects.ts   # /p - folders of saved sessions (nested; folder/selection export)
│   │           └── free-canvas.ts # free-canvas editor overlay for render.layout:"editor" tools
│   │
│   ├── cli/          # Node.js CLI - same engine, headless jsdom
│   │   ├── bin/lolly.ts
│   │   └── src/
│   │       ├── run.ts    # loadTool → createRuntime → export → write file
│   │       └── bridge.ts # CLI implementation of HostV1
│   │
│   ├── tui/          # Interactive terminal shell (Ink) - reuses the CLI bridge
│   │   └── src/
│   │       ├── main.tsx  # full-screen app: Gallery / Projects / Profile / ToolView
│   │       └── bridge.ts # CLI bridge + on-disk state under ~/.lolly
│   │
│   ├── tauri-desktop/ # downloadable desktop app
│   └── tauri-mobile/  # iOS/Android app
│
├── tools/            # profile VIEW (gitignored) - data, not code. Merged from packs:
│                     #   community/ (public, brand-agnostic, MPL) + brands/<active>/tools (brand-owned).
│                     #   A SELECTION follows - the mounted set depends on the profile.
│   ├── qr-code/
│   ├── quotes/
│   ├── email-signature/
│   ├── snippet/
│   ├── countdown-timer/
│   ├── color-palette/
│   ├── color-block/           # typed/heterogeneous blocks (addMenu discriminator)
│   ├── dynamic-layout/
│   ├── tool-logo/         # "Logo" - auto-switching brand logo
│   ├── street-map/        # offline vector city-block maps
│   ├── url-shot/          # "URL Screenshot" (capture capability)
│   ├── strip-data/        # on-device metadata strip - JPEG/PNG/SVG/PDF (file in → clean file out)
│   ├── compress-pdf/      # on-device PDF compressor - recompresses images (file in → smaller file out)
│   ├── brand-lockup/      # "Brand Lockup" - SUSE logo lockups; HarfBuzz text-to-path (wasm)
│   ├── chart-creator/     # SVG charts from structured data
│   ├── filter/            # photo effects in one tool - halftone/scanline/posterize/voronoi (vector), duotone/pixel-stretch/imperfections (raster)
│   ├── meeting-planner/   # global timezone meeting scheduler
│   ├── calendar-ics/      # event → .ics calendar file plus a card
│   ├── digi-ad/           # "Animated Ad" - looping banner from scenes
│   ├── event-name-badge/  # conference badges - composes qr-code as an SVG
│   ├── wayfinding-signage/ # event signage; directions blocks auto-fit label text
│   ├── text-helper/       # on-device text workbench (format/decode/hash/de-identify)
│   ├── design/     # "Design" - freeform WYSIWYG editor canvas (render.layout: editor)
│   ├── multi-page-pdf/    # multi-page PDF document - cover, flowing content blocks, back page
│   ├── diagram-builder/   # org / layercake / process / cycle / pyramid diagrams
│   ├── logo-wall/         # many logos → auto-packed grid
│   ├── logo-lockup-partner/ # SUSE + partner co-brand lockup
│   ├── icon/          # favicon .ico / png / svg from text + colours
│   ├── lottie-digi-ad/    # animated Lottie ad banners
│   └── pose-geeko/        # pose the SUSE Geeko mascot - print-ready stills
│
├── catalog/
│   ├── tools/index.json        # tool registry
│   └── assets/
│       ├── index.json          # asset registry
│       └── suse/...            # logo, palette, etc.
│
├── schemas/          # JSON Schema for tool.json, asset entries, AssetRef
├── scripts/          # build-catalog-index.ts, checksum-assets.ts, validate-catalog.ts
├── tests/            # engine tests
└── docs/             # this file + authoring guides + positioning
```

---

## Modèle de livraison de la plateforme

La plateforme fonctionne sur plusieurs surfaces - PWA web, Tauri desktop/mobile, la CLI scriptable et le TUI interactif. Toutes utilisent le même moteur et les mêmes fichiers d'outils.

### Web (PWA) - distribution principale
Hébergée sur une URL contrôlée par SUSE. Fonctionne hors ligne une fois que le service worker a mis en cache les outils et les ressources. C'est ici que la plupart des employés, fournisseurs et partenaires utiliseront la plateforme. Aucun compte requis - l'état est stocké dans IndexedDB par appareil.

La coquille web est responsive depuis une seule mise en page. Sur ordinateur, un outil se présente comme une barre latérale de contrôles redimensionnable à côté d'une scène d'aperçu avec une navigation du canevas native au trackpad (Cmd/Ctrl-molette ou pincement pour zoomer autour du curseur, glissement avec Espace ou clic central pour se déplacer, les touches `0`/`1`/`+`/`−` et un HUD Fit/%). Sur mobile (≤640px), les contrôles deviennent une feuille ancrée en haut avec une poignée de glissement qui s'aligne sur peek/moitié/plein (un tap bascule) au-dessus d'un aperçu plein écran statique, et un bouton flottant **Render** ouvre les contrôles **Export** dans une fenêtre contextuelle en feuille du bas. Le tactile obtient le pincement pour zoomer et le glissement pour se déplacer sur l'aperçu. Le chemin de restitution et les contrôles d'export sont identiques dans les deux cas - seule l'interface se réorganise.

![La vue partagée du bureau - les contrôles générés depuis le manifeste à gauche, le canvas en direct à droite](/t/url-shot?url=%2F%23%2Ftool%2Fchart-creator&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=aud-web-split)

Le même outil en largeur téléphone, sans second layout à maintenir : les contrôles deviennent une feuille en haut, l'aperçu occupe tout l'écran et la pastille de rendu flotte par-dessus.

![Un audiogramme sur un écran de 430px de large - la feuille de contrôles en haut, l'illustration carrée finie en bas et la pastille de rendu flottante](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

**Mode batch (`/pro`).** Le shell web embarque aussi une grille batch façon tableur (`shells/web/src/pro/`) qui rend de nombreuses lignes à la fois sur un ou plusieurs outils. Il gère l'aller-retour CSV/TSV plus le collage tableur, le template/format/taille/unité/dpi par ligne, un panneau latéral éditeur de blocs avec aperçu en direct, des colonnes d'export repliables, une barre de tags de « pertinence » par ligne, la réorganisation des lignes par poignée de glisser à gauche, une confirmation de suppression en deux temps, des sessions batch sauvegardées et un téléchargement `.zip`. C'est la surface un-vers-plusieurs derrière le positionnement « génération de contenu en masse ».

### Bureau / mobile Tauri
Application native packagée (petite empreinte via Tauri). Fournit une disponibilité hors ligne complète, un accès au système de fichiers pour les outils dépendant de la CLI (PDF Smasher, Font Outliner) et l'accès caméra. Amélioration de l'outillage prévue mi-2026.

### CLI
`lolly <tool-id> [--input=value ...] --output=file.png`

Les utilisateurs de bureau peuvent invoquer de nombreux outils depuis le terminal. Le shell CLI charge le même moteur, crée un DOM jsdom, exécute le même chemin de rendu et écrit le fichier. Le mode URL est le transport - la CLI n'est pas une implémentation séparée. Cela garantit que les sorties CLI et GUI sont identiques.

```bash
lolly qr-code --url=https://suse.com --output=qr.svg
lolly quotes --quote="Ship it." --output=quote.png
lolly                        # lists available tools
lolly qr-code                # lists inputs for that tool
```

### TUI
`npm run tui`

L'équivalent interactif de la CLI : une application terminal plein écran, pilotée au clavier (construite sur Ink) pour parcourir les outils, remplir les entrées, sauvegarder des projets et exporter - tout cela sans GUI. Son pont hôte **réutilise l'implémentation de la CLI** pour les formats sans DOM (SVG/EMF/EPS/HTML + texte/données), et ajoute un état sur disque sous `~/.lolly` plus un aperçu en ligne optionnel. Au-delà, elle dispose d'un **palier de rendu navigateur** : un Chromium headless dédié (le même que celui installé par le serveur MCP) qui produit du raster/PDF/vidéo et de la capture d'URL en direct à la demande - en pilotant une copie compilée du shell web pour que la sortie soit identique, et en ne se lançant qu'au premier export d'un tel format. Ainsi `url-shot` (avec recadrage + recoloration + PDF/SVG vectoriel) et tous les outils raster/pdf tournent aussi dans le terminal. Voir le [guide TUI](/info/tui.html).

Quelle que soit la surface sur laquelle tu es, l'onglet Capabilities du tableau de bord est la carte complète de ce que la plateforme déclare pouvoir faire, groupée et lisible sans ouvrir un seul outil.

---

## Catégories d'outils

Les outils sont étiquetés avec une `category` dans leur manifeste pour le regroupement dans la galerie.

Les lignes sont listées dans l'ordre des sections de la galerie. La section `utility` s'affiche toujours **en dernier** dans la galerie (après toute autre catégorie, y compris les futures) - c'est le tiroir « Outils hors ligne » sur l'appareil.

| Catégorie | Exemples | Prévu |
|---|---|---|
| `everyone` | QR Code Generator, Quote Card, Email Signature, Logo, Wordmark, Audiogram, Battlecards, Sequence Studio, Record | Employee Image Stationery |
| `designer` | Brand Lockup, Design, Chart, Darkroom, Filter, Pose Geeko, Multi-Page PDF | Font Outliner |
| `event` | Meeting Planner, Event Name Badge, Wayfinding Signage, Calendar ICS, Booth Studio | Event Stationery, Bulk Name Badges, Room Agenda Cards |
| `product` | - | CVE Alert, Product Release Announcement, Blog OG Image |
| `utility` | Strip Hidden Data, Text Helper, Compress PDF, Convert Image, Convert Font, Redact, Run Web Code, Screen Capture, URL Screenshot | Unit/format converters, more on-device privacy utilities |

Ces cellules sont des **exemples, pas des inventaires**. Les outils existants dépendent du profil que tu as monté, pas de cette page : un pack de marque ajoute les siens, et peut exclure un outil communautaire qu'il préfère ne pas livrer. `catalog/tools/index.json` - généré depuis les manifestes, et le registre que la galerie lit réellement - est la liste faisant autorité ; pour compter ce qu'un profil monte, compte les manifestes (`ls community/*/tool.json brands/*/tools/*/tool.json`) plutôt que de te fier à un nombre écrit ici. (Un id d'outil présent dans deux packs se monte une seule fois, depuis le pack gagnant.)

Les outils sont aussi classés par statut : `official` (approuvé par la marque, pas de filigrane), `community` (contribution externe), `experimental` (exports filigranés). L'essentiel de la bibliothèque est `official` ; les studios les plus récents et les outils de capture ont tendance à rester en `community` ou `experimental` le temps de se stabiliser. Chaque surface affiche le badge, pour que le lecteur sache ce qu'il récupère avant d'ouvrir l'outil - et, comme les cellules de catégorie ci-dessus, l'appartenance par statut bouge trop vite pour être énumérée ici. Lis-la depuis la galerie ou l'index généré.

**Design** est le premier outil construit sur le mode canvas libre `render.layout: "editor"` - une surface sans chrome, à manipulation directe, où tu déplaces, redimensionnes, fais pivoter et aimantes des boîtes de texte, de formes et d'images, puis exportes via le même chemin de rendu que tout autre outil.

**Strip Hidden Data** est le premier **utilitaire sur l'appareil** (`privacy: "on-device"`) : un outil de transformation de contenu qui prend un fichier que *tu* fournis, le traite entièrement dans le navigateur et te rend une copie propre - jamais téléversée, jamais filigranée, aucune provenance apposée. **Text Helper** est le deuxième - un atelier sur l'appareil pour les tâches quotidiennes de copier-coller vers un site web (formatage JSON, décodage JWT, Base64, encodage/décodage URL, hachage SHA). **Compress PDF** est le troisième - il réduit un PDF en recompressant ses images, là encore entièrement sur l'appareil. Le marqueur et son texte de badge « Fonctionne sur ton appareil - rien n'est téléversé » couvrent désormais tout l'ensemble transform : Strip Hidden Data, Text Helper, Compress PDF, **Convert Image** (HEIC/TIFF/AVIF → WebP/JPG/PNG), **Convert Font**, **Redact** (détruire des zones d'une image, d'un SVG ou d'un PDF), **Prompt to Image** et **Rebrand a Deck** (re-thémer un `.pptx` sur place) là où le profil le monte. C'est une catégorie d'utilitaires de confidentialité qui remplace le fait de confier des fichiers confidentiels à des sites à usage unique.

![Le tiroir Utilities, où chaque carte est un outil qui transforme un fichier que tu possèdes déjà](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=aud-utilities)

> Remarque : `category` et `status` sont dénormalisés dans `catalog/tools/index.json` (le registre que la galerie lit) à partir de chaque `tool.json`. Le manifeste fait foi - l'index est **généré** par `npm run build:catalog` et `npm run validate:catalog` échoue en CI si l'index committé diverge des manifestes.

---

## Engagements architecturaux

Ces décisions sont arrêtées. En changer une est une entreprise majeure - elles façonnent chaque autre décision de la base de code.

### 1. Outils déclaratifs, avec une échappatoire impérative

Un outil, c'est un manifeste (`tool.json`) + un template (`template.html`) + optionnellement `hooks.js`.

**Le manifeste déclare les entrées.** Pas le template. Les entrées ne sont pas déduites des tokens Handlebars. Le manifeste est le contrat ; le template consomme des variables nommées via `{{id}}`.

![La pile de contrôles de Street Map - un menu déroulant de ville, une sélection de thème, des curseurs d'épaisseur et des déclencheurs de couleur, chacun tiré d'une ligne du manifeste](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

**Les hooks sont optionnels.** La plupart des outils sont purement déclaratifs - manifeste + template suffisent. Les outils nécessitant des valeurs calculées (encodage QR, mise en forme de données de chart) fournissent un `hooks.js` exposant des fonctions de cycle de vie nommées (`onInit`, `onInput`, `onFrame` - le hook caméra en direct par image pour les outils réactifs au mouvement - `onLevel`, `beforeExport`, `afterExport`, `exportFile` - le chemin de transformation fichier-entrée/fichier-sortie utilisé par les utilitaires sur l'appareil comme Strip Hidden Data - et `exportStill`, pour un outil qui gère son propre raster en profondeur). L'hôte charge les hooks via `new Function('host', …)` avec le pont de capacités injecté comme portée de fermeture. C'est un **contrat de portabilité, pas un bac à sable de sécurité** : les hooks s'exécutent toujours dans le contexte de la page et *peuvent* accéder à `window`/`fetch`/`document` dans un shell navigateur - `host.*` est la surface prise en charge et portable, pas une frontière imposée. Les résultats asynchrones des hooks sont chronométrés (`onInit` 5 s, `onInput` 2 s, `beforeExport`/`afterExport` 5 s, `exportFile`/`exportStill` 10 s) et les résultats tardifs sont écartés ; un hook *synchrone* incontrôlé ne peut pas être préempté. Le code de hook tiers non fiable n'est donc pas sûr à exécuter avant l'arrivée de l'isolation Worker.

Cela compte parce que : les outils déclaratifs peuvent être créés par des non-développeurs. Si chaque outil était une application web, la note de risque « compétences limitées pour créer/maintenir des templates de production » devient un goulot d'étranglement permanent.

### 2. Les outils et les assets sont des données, pas du code embarqué

Les applications web et Tauri récupèrent les catalogues d'outils et d'assets depuis une URL connue au démarrage, les mettent en cache localement et fonctionnent avec ce qui s'y trouve. **Ajouter une nouvelle tuile d'événement ou un asset saisonnier ne nécessite pas de publication d'application.**

Les octets d'assets sont vérifiés par somme de contrôle SHA-256 pour empêcher l'empoisonnement de CDN. L'`id` + la `version` de l'asset pilotent l'invalidation du cache.

### 3. Le Capability Bridge est la seule API que les outils voient

Les outils ne touchent jamais au DOM en dehors de leur zone de template, n'appellent jamais `fetch` directement, ne lisent jamais le système de fichiers. Ils appellent des méthodes `host.*` versionnées. La définition canonique du contrat est `packages/core/src/host-v1.ts` - le SDK auteur-d'outils `@lolly-tools/core`, pour qu'un tiers puisse construire dessus sans dépendre du moteur ; `engine/src/bridge/host-v1.ts` en est une réexportation de type, et le code du moteur/des shells continue d'importer depuis ce chemin sans changement :

| API du pont | Ce qu'elle fait |
|---|---|
| `host.profile` | Prénom, e-mail, photo de profil, ville, etc. de l'utilisateur. Préremplit les entrées via `bindToProfile`. |
| `host.assets` | Requêtes de catalogue, résolution d'assets, UI de sélecteur fournie par l'hôte. |
| `host.state` | Sauvegarde / chargement des emplacements d'entrées. IndexedDB sur le web, système de fichiers sur Tauri, mémoire sur la CLI. |
| `host.clipboard` | Écrit du texte ou une image dans le presse-papiers (avec repli selon la plateforme). |
| `host.export` | Rastérise ou sérialise la cible de rendu. Applique le filigrane pour les outils expérimentaux. |
| `host.net` | Fetch en liste blanche - disponible uniquement si l'outil a déclaré la capacité `"network"`. (Aucun outil livré ne l'utilise actuellement.) |

Les surfaces optionnelles et additives n'apparaissent que lorsqu'un shell les fournit. Certaines sont **conditionnées par une capacité** - exposées uniquement quand l'outil déclare le drapeau correspondant : `host.compose` (intégrer le rendu d'un autre outil - `compose`), `host.capture` (capture de page pour URL Screenshot - `capture`) et `host.recorder` (capture micro/caméra/écran pour les outils d'enregistrement - `microphone` / `camera` / `screen`). Les autres sont **détectées par fonctionnalité** - présentes chaque fois que le shell peut les fournir, l'outil gardant un repli pour les shells qui ne le peuvent pas.

Quelques surfaces phares, pour montrer l'étendue - [Host API](/info/host-api.html) documente chacune d'elles, et `packages/core/src/host-v1.ts` est le contrat lui-même :

| Surface | Depuis | Ce qu'elle ajoute |
|---|---|---|
| `host.tokens` | 1.0 | Tokens de design DTCG - les primitives propres à la marque |
| `host.text` | 1.0 | Texte-vers-chemin via HarfBuzz WASM (le flag de capacité `wasm` signale les outils qui en dépendent) |
| `host.media` | 1.4 | Images de caméra en direct pilotant le hook `onFrame`. Amélioration progressive, délibérément *pas* conditionnée par le flag `camera` - un tel outil fonctionne quand même comme un outil ordinaire d'image fixe |
| `host.color` | 1.40 | Mathématiques de couleur perceptuelles : ΔEOK, contraste WCAG et APCA, dégradés OKLab, seuils de classes, palettes catégorielles, schémas d'harmonie (1.60), mélange CSS Color 4 et cuisson de dégradés (1.68). Pur et synchrone - les shells rattachent le `makeColorApi()` du moteur plutôt que d'implémenter quoi que ce soit, donc ça ne peut pas diverger |
| `host.images` | 1.60 | Décoder / redimensionner / réencoder des octets sur l'appareil - le chemin de conversion (HEIC → JPEG, compression en WebP, réduction d'échelle). Livré dans le shell web comme une façade paresseuse, donc le décodeur HEIC n'entre jamais dans le chunk de démarrage |
| `host.geom` | 1.64 | Géométrie vectorielle exacte : booléens de chemins, décalage, contour-vers-remplissage, réduction de splines, simplification, détection de collision. Également pur, synchrone et rattaché depuis le moteur (`makeGeomApi()`) ; les échecs sont *retournés*, jamais levés |

Le reste suit les mêmes règles et est documenté avec elles : `pdf` (1.8) et `pptx` (1.58) pour la chirurgie de documents sur l'appareil, `audio` (1.71) et `speech` (1.96) pour l'analyse de clips et la synthèse/transcription vocale sur l'appareil, `viz` (1.72) pour le contrat de remplacement MilkDrop, `codec` (1.100) et `layers` (1.102) pour la sortie en profondeur de bits et en bitmap par couches, `upscale` (1.101) et `matte` (1.103) pour les modèles sur l'appareil, `raster` (1.105) pour les hooks qui font leur propre travail de pixels, `connectors` (1.106) pour les flèches compatibles export et `c2pa` (1.85) pour signer des octets finis. Le nombre grandit ; les règles non.

Les capacités déclarables sont : `network`, `filesystem`, `clipboard`, `camera`, `microphone`, `screen`, `ffmpeg`, `wasm`, `capture`, `compose`. (`screen`, ajoutée en 1.54, est la capture d'écran via `host.recorder` - l'utilisateur choisit un écran/une fenêtre/un onglet dans l'UI native du navigateur ; distincte de `capture`, qui rastérise une URL que l'outil lui-même désigne.)

Le même outil tourne dans le navigateur, Tauri et la CLI headless car chaque shell implémente cette interface - l'outil ne sait jamais dans lequel il se trouve.

Le pont est versionné. Ajouter des méthodes est une version mineure. Supprimer ou modifier des signatures est un incrément de version majeure. Quand la v2 sortira, la v1 devra continuer de fonctionner.

### 4. Les ID d'assets sont éternels

`suse/logo/primary` est un contrat. Une fois publié :
- L'ID ne change jamais, n'est jamais réutilisé.
- Changement d'octets → incrémenter `version` dans le manifeste.
- Remplacé par un nouvel asset → définir `deprecated: true` et éventuellement `replacedBy`.
- Les références existantes se résolvent toujours.

Cela rend les états d'outils sauvegardés et les liens partagés par URL durables au fil des années.

### 5. Le mode URL est de premier ordre

Chaque entrée doit pouvoir s'exprimer comme un paramètre d'URL :

```
lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H
```

![Ce lien à lui seul, sans rien d'autre, est l'asset fini](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fsuse.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Le mode CLI est le mode URL sous un autre transport - le shell CLI construit un objet d'état URL à partir de argv et exécute le **même** pipeline moteur. Il n'y a qu'un seul chemin de rendu. La CLI ne peut pas diverger de la GUI parce que ce n'est pas une implémentation séparée.

`url-mode.ts` gère l'aller-retour (analyse et sérialisation). Un ensemble de **paramètres réservés** n'est jamais transmis à l'outil comme entrées : les contrôles de sortie (`format`, `export`, `copy`, `filename`, `width`/`w`, `height`/`h`, `unit`, `dpi`), les cadrans d'impression et de provenance (`bleed`, `marks`, `profile`, `password`, `c2pa`, `imprint`, `durable`, `meta`, `hdr`, `depth`, `cuts`) et les porteurs d'état (`template`, `z` - le jeton compacté « Lien le plus court » - et `zx`, le même chiffré avec un mot de passe). L'ensemble `RESERVED` dans `engine/src/url-mode.ts` fait autorité et est fixé par un test ; [URL Mode](/info/url-mode.html) documente chacun d'eux, y compris la poignée non listée ici. Les entrées de type asset en mode URL sont sérialisées par leur `id` ; le runtime les résout via `host.assets.get()` avant l'hydratation. `width`/`height` sont des valeurs dans `unit` (par défaut `px`, aussi `mm`/`cm`/`in`/`pt`/`pc`) ; avec une unité physique, `dpi` fixe la résolution raster. Ils définissent la taille du document du canvas et préremplissent le panneau de dimensions d'export.

Parce que chaque entrée voyage dans le lien, un changement de paramètre donne un asset fini différent. Toute cette palette n'est qu'une couleur de départ, une harmonie et un nombre de pas :

![Neuf nuances sur quatre teintes, toutes issues de la seule couleur de départ portée par le lien](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

### 6. Le stockage passe par le pont, jamais en direct

Web shell : IndexedDB. Tauri : système de fichiers. CLI : en mémoire. Les outils ne voient que `host.state.save(slot, data)` et `host.state.load(slot)`. `localStorage` n'est pas utilisé - trop petit et incapable de stocker des blobs.

Les utilisateurs peuvent enregistrer plusieurs emplacements d'édition nommés par outil et retrouver chaque session plus tard. Aucune création de compte n'est requise ; l'état est propre à l'appareil. Comme le pont est le seul point de passage, cet état par appareil est aussi *portable* : `shells/web/src/data-transfer.ts` relit tout via `host.profile`/`host.state`/`host.assets` dans un unique zip `lolly-backup` qui s'importe sur n'importe quelle autre installation - la réponse hors ligne à "passer à un nouvel appareil" qui ne nécessite aucun serveur (spécification complète : `docs/data-transfer.md`). L'intégration SUSE ID (synchronisation multi-appareils) est une étape future construite par-dessus.

### 7. Les étiquettes de maturité répondent par conception au risque "validé par la marque"

Chaque outil déclare `status: official | community | experimental` dans son manifeste. La galerie trie par statut. Les outils expérimentaux filigranent automatiquement leurs exports - le filigrane est appliqué par `host.export.render`, pas par l'outil, si bien qu'un auteur d'outil non officiel ne peut pas le désactiver.

C'est une réponse structurelle au risque de perception selon lequel l'usage d'un outil implique une validation de la marque. Des réponses de processus (une file de revue, un contrôle SUSE ID) viennent s'ajouter par-dessus.

### 8. Les entrées d'outil sont typées via le manifeste, y compris les assets

Les entrées déclarent un `type` : `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` et `file`. L'hôte génère un contrôle générique par type à partir du manifeste - les outils n'écrivent aucun code de contrôle. (Le préremplissage depuis le profil de l'utilisateur n'est pas un type - toute entrée peut porter `bindToProfile`.) Trois pèsent plus que les autres :

- **`asset`** (avec `filter` et `allowUpload`) est le pont vers le système d'assets global ; `allowUpload: false` est le levier d'applicabilité de la marque pour des cas comme les logos de tuile de sponsoring, où seuls les assets de la bibliothèque sont autorisés. Les envois de l'utilisateur utilisent la même forme `AssetRef` que les assets de bibliothèque, si bien que les outils les traitent de façon identique.
- **`blocks`** est un groupe de champs répétable - une mini-table dans une seule entrée, édité dans un panneau latéral, avec un menu d'ajout typé/discriminé et des champs d'asset par bloc. Cliquer sur un bloc rendu sur le canevas met le focus sur la ligne correspondante. Utilisé par `meeting-planner`, `chart-creator`, `event-name-badge`, `wayfinding-signage`, `color-block` et `digi-ad`.
- **`vector`** regroupe un ensemble fixe de nombres (par exemple une transformation) en un seul contrôle composé ; **`file`** conserve le fichier propre de l'utilisateur sous forme d'octets en mémoire pour des utilitaires de transformation sur l'appareil (par exemple `strip-data` et `compress-pdf`).

### 9. Les templates sont sans logique (Handlebars, pas EJS)

Handlebars a été choisi plutôt qu'EJS délibérément :
- Sans logique. Les templates peuvent être écrits par des non-développeurs.
- Sûr par défaut. `{{x}}` échappe le HTML ; `{{{x}}}` est brut, à activer explicitement.
- Aucun JS arbitraire dans les templates signifie aucune surface d'audit XSS par template.

La logique vit dans `hooks.js`, où elle est explicite et révisable. Assistants Handlebars disponibles : `{{default}}`, `{{upper}}`, `{{lower}}`, `{{eq}}`, `{{markdown}}`, `{{asset ref}}`, `{{asset ref "property"}}` (plus les assistants de format de données `icsStamp`/`rfcText`/`csvCell` utilisés par les templates jumeaux `.ics`/`.vcf`/`.csv`).

### 10. Les outils composent des outils

Un outil peut intégrer le rendu d'un **autre** outil sans import d'outil à outil - la composition est résolue par le moteur, jamais par le code de l'outil. Il y a deux surfaces :

- **Manifeste déclaratif** - `composes: [{ id, tool, inputs, format?, width?, height? }]`. Le moteur rend l'enfant nommé et place le résultat dans le template sans logique sous la forme `{{asset <id>}}`. `event-name-badge` compose `qr-code` en SVG aujourd'hui.
- **URL d'intégration portable** - `<img src="https://lolly.tools/tool/<id>.<ext>?<inputs>">`. Le shell rend cet enfant **localement** (un pixel de remplacement s'affiche jusqu'à la résolution du rendu local) ; rien n'est jamais récupéré depuis `lolly.tools`.

Composer le rendu de n'importe quel outil : un enfant **SVG** reste un vrai vecteur quand le parent exporte en SVG ou PDF, et se rastérise avec netteté pour PNG ; les enfants **PNG/JPG/WEBP** s'intègrent comme des images. Nécessite la capacité `compose`. Les enfants composés sont des intermédiaires - jamais filigranés ni estampillés de provenance - et la composition se dégrade avec élégance : un shell incapable de rendre un enfant omet simplement l'emplacement et le parent se rend quand même.

---

## Ce que nous avons délibérément choisi de ne pas faire

- **Pas d'EJS ni de JS arbitraire dans les templates.** La surface XSS est nulle. La logique vit dans `hooks.js`.
- **Pas de CMS d'assets obligatoire.** Chacun ingère ses propres fichiers créatifs directement dans son catalogue, dans l'application (la vue [Catalogue](/info/using.html) et le Brand Studio) - aucun serveur, aucune console d'administration. Le travail se transmet comme une **session** : un lien de partage porte l'état complet, et la même session voyage dans une sauvegarde ou via une session collaborative. Qui contrôle le déploiement peut alors verrouiller une session partagée en tant que **template** - ouvrir le lien, enregistrer ses valeurs comme entrée de template dans le répertoire de cet outil au sein du pack de marque, puis commiter - après quoi elle apparaît dans le sélecteur "New from template" de l'outil et devient accessible par lien direct via `?template=<id>`. Git est l'étape de verrouillage du propriétaire du déploiement, jamais celle du créateur. Pour un catalogue *partagé et gouverné*, une organisation **peut** gérer le répertoire d'assets de la même façon et conditionner les mises à jour à une revue de PR - un modèle de gouvernance disponible, pas une exigence de l'application.
- **Pas de RBAC imposé.** L'application ouverte est en accès public par défaut ; le risque de marque se gère par des étiquettes de maturité et des filigranes. Une organisation qui veut un contrôle plus strict superpose sa propre authentification et le catalogue relu par git ci-dessus.
- **Pas de base de données centrale.** Tout l'état utilisateur est propre à l'appareil. L'intégration SUSE ID est sur la feuille de route mais ne bloque pas le lancement.
- **Pas de chemin de code outils/moteur partagé.** Le moteur est open source, tout comme les outils indépendants de la marque dans `community/` ; un pack de marque comme le `brands/suse/` privé porte ses propres outils et son propre catalogue selon ses propres conditions. Dans les deux cas, la séparation est appliquée (aucune importation croisée depuis `engine/` vers le contenu des outils), si bien que la coupure reste nette.

---

## Le cycle de vie, de bout en bout

Un utilisateur ouvre `lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H` :

1. **Démarrage.** Le web shell ouvre IndexedDB, construit le pont de capacités, synchronise les catalogues d'outils et d'assets (ou charge depuis le cache hors ligne).
2. **Routage.** Le hash d'URL → vue `tool`, avec `qr-code` et les paramètres d'URL extraits.
3. **Chargement.** `loadTool('qr-code', fetchFile)` récupère `tool.json`, le valide contre le schéma JSON, récupère `template.html`, `styles.css` et le code source de `hooks.js`.
4. **Analyse de l'état d'URL.** `parseUrlState` traduit les paramètres d'URL en valeurs d'entrée initiales. Les références d'asset (`?logo=suse/logo/primary`) sont analysées comme des objets légers `{ id, _unresolved: true }`.
5. **Runtime.** `createRuntime(tool, host, initialValues)` construit le modèle d'entrée (fusionnant les données de profil, les valeurs par défaut et les valeurs initiales), résout les références d'asset via `host.assets.get()`, charge les hooks (`host` en portée de fermeture, non isolé en bac à sable), appelle `hooks.onInit`.
6. **Rendu.** Le shell s'abonne au runtime ; à chaque changement d'état il reçoit `{ model, hydrated }`. Il rend les contrôles d'entrée à partir du modèle et écrit le HTML du template hydraté dans `#tool-canvas`.
7. **Interaction.** L'utilisateur saisit une valeur → `runtime.setInput(id, value)` → contraintes appliquées → `hooks.onInput` appelé → réhydratation → nouveau rendu. Le canevas se met à jour en direct.
8. **Export.** L'utilisateur clique sur Télécharger (PNG) → `runtime.export(canvasNode, 'png')` → `host.export.render` (rastérise via dom-to-image-more ; SVG/PDF passent par des vectoriseurs dédiés qui parcourent le DOM) → blob → `host.export.download`. La gamme de formats qu'un outil peut choisir est large, et l'énumération `render.formats` dans `schemas/tool.schema.json` en fait autorité - rasters et rasters flottants, vecteurs et fichiers de découpe, impression/CMJN, animation, documents éditables (`pptx`, `docx`, `odt`), palette et sorties données/texte, fichiers audio et de police. [Mode URL](/info/url-mode.html) nomme chaque id et ce qu'il produit. L'audio figure dans cette énumération comme n'importe quoi d'autre (`wav`, `mp3`, `m4a`, `opus`, déclarés par l'audiogramme et les outils d'enregistrement) ; séparément, le mode `render.capture` d'un outil d'enregistrement pilote `host.recorder`, dont la prise arrive comme un Blob terminé dans le conteneur enregistré par le navigateur, quel qu'il soit. (Les outils qui définissent `render.export: false` - par exemple Color Palette, Countdown Timer, Strip Hidden Data, Text Helper, Compress PDF - masquent les contrôles de téléchargement/format/dimension.) Les unités physiques sont converties par format ici (PDF → points de page réels, raster → pixels au DPI avec un chunk `pHYs`). Les métadonnées d'auteur/provenance (auteur, outil, source - construites par `engine/src/metadata.ts`) sont intégrées par format : iTXt PNG, EXIF JPEG, dictionnaire d'info PDF, `<metadata>` SVG, commentaire GIF. Les outils expérimentaux reçoivent un filigrane inséré par l'hôte, pas par l'outil.

![Le panneau d'export qu'ouvre `?options` : le couple nom de fichier/format, la taille de sortie et les contrôles qui écrivent le fichier](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Même cycle de vie sous Tauri. Même cycle de vie en CLI - jsdom fournit le DOM headless ; la sortie va vers un fichier ou stdout.

---

## Statut open source

**Le code est sous MPL-2.0.** `engine/`, `shells/*`, `services/*`, `schemas/` et `docs/` sont open source sous **MPL-2.0** - une plateforme d'échafaudage neutre vis-à-vis des fournisseurs pour l'outillage de marque, chaque unité livrable ayant son propre dépôt sous [github.com/lolly-tools](https://github.com/lolly-tools).

**Le contenu des outils est livré sous forme de packs de marque**, chacun avec ses propres conditions (voir le `NOTICE.md` du pack). `community/` est le dépôt public [`lolly-tools`](https://github.com/lolly-tools/lolly-tools) et ses outils indépendants de la marque sont eux aussi sous MPL-2.0. `brands/suse/` est le pack privé `suse-lolly` : les outils SUSE et le catalogue SUSE, **propriété exclusive de SUSE**, y compris sa musique PremiumBeat sous licence. `brands/lolly-start/` est la marque de démarrage vierge que possède ce dépôt. Les polices sont livrées dans un pack sous la **SIL Open Font License 1.1** - le pack SUSE porte les polices SUSE et SUSE Mono.

Les répertoires `tools/` et `catalog/` à la racine du dépôt sont des *vues* ignorées par git : un profil les assemble à partir de `community/` et du pack de marque actif, c'est pourquoi chaque script et chaque shell lit ces deux chemins et jamais un pack directement.

La séparation est appliquée - il n'y a aucune importation croisée depuis `engine/` vers le contenu des outils - si bien que la frontière plateforme/contenu reste nette.

---

## Où le moteur s'arrête et où l'hôte commence

Si tu peux le décrire en données pures + Handlebars → **moteur**.
Si ça touche au DOM, au système de fichiers, au réseau ou à une API navigateur/OS quelconque → **hôte**.

La ligne est nette exprès. Le moteur est la partie open source. Tout ce qui connaît SUSE, des plateformes spécifiques ou des environnements d'exécution en reste dehors.

Pour le niveau de détail suivant, [`engine/README.md`](../engine/README.md) énumère chaque module du moteur et sa responsabilité, et [Modèle de menace et frontières de confiance](/info/threat-model.html) consigne où cette même ligne fait aussi office de frontière de confiance.
