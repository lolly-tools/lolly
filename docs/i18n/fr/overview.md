# Architecture de Lolly

![Icône Lolly - Grande sucette verte et blanche](/info/icon.svg)

Cette page s'adresse aux personnes qui modifient le code de Lolly : comment le moteur, les shells et les packs d'outils s'articulent, où chacun se trouve dans le dépôt et les engagements qui encadrent chaque changement. Pour savoir ce que fait Lolly et qui l'utilise, lis d'abord [Comment fonctionne Lolly](/info/how-lolly-works.html).

[`engine/README.md`](https://github.com/lolly-tools/lolly/blob/main/engine/README.md) décrit le moteur module par module et est généré à partir du code. [Modèle de menaces & frontières de confiance](/info/threat-model.html) présente cette même architecture sous l'angle des frontières de confiance et indique ce que le moteur considère comme non fiable.

<!--i:eti-layers-->
## Vue d'ensemble

En haut, les outils sont des données. Au milieu, le moteur ne connaît aucune plateforme. En bas, les shells implémentent un même contrat, et les catalogues fournissent le contenu.

![Les outils fournissent un manifeste, un modèle et des hooks au moteur partagé. Les shells web, Tauri et terminal implémentent le pont de capacités HostV1 et lisent les outils et les ressources dans les catalogues.](/info/diagrams/concepts/platform-layers.svg)

Tout ce que tu peux décrire en données pures et en Handlebars relève du **moteur**. Tout ce qui touche au DOM, au système de fichiers, au réseau ou à une API du navigateur ou du système d'exploitation relève de l'**hôte**, le côté shell du pont. Le moteur est open source. Rien de spécifique à une marque n'entre dans le moteur.

<!--i:eti-folder-shared-->
## Organisation du dépôt

Lolly tient dans un seul dépôt. Chaque répertoire ci-dessous est un répertoire ordinaire, sauf `brands/suse` : un sous-module git **privé** avec le pack d'outils et le catalogue SUSE, qu'un clonage public ne récupère pas. Un profil de contenu (`profiles.json`) définit les packs qu'une compilation lit. Chaque processus résout son propre profil, et il n'y a pas de commutateur global. Le [guide de compilation](/info/build-guide.html) donne la commande de clonage et explique comment enregistrer un changement dans le pack privé.

| Répertoire | Son contenu |
|---|---|
| `engine/` | Le noyau indépendant de la plateforme : chargeur, environnement d'exécution, entrées, modèles, mode URL, unités et modules de format |
| `shells/` | L'application web, les applications Tauri pour ordinateur et mobile, la CLI, la TUI et l'extension de navigateur |
| `packages/` | Le SDK pour les auteurs d'outils (`@lolly-tools/core`), les composants partagés du shell Node et le moteur de rendu de la documentation, entre autres |
| `community/` | Les outils indépendants de toute marque, ainsi que les packs d'emoji partagés |
| `brands/` | Les packs de marque : `lolly-demo` (Lolly Demo, le design system utilisé par lolly.tools), `lolly-start` (le point de départ vierge) et le pack privé `suse` |
| `services/` | Les services facultatifs MCP, de certificats et Penpot, et le code serveur qu'ils partagent |
| `schemas/` | Les JSON Schema des manifestes d'outils, des entrées de ressources et des références de ressources |
| `scripts/`, `tests/`, `docs/`, `api/` | Les scripts de compilation et de catalogue, la suite de tests du moteur, cette documentation et les bundles serverless générés |

::: details Les premiers fichiers du moteur et des shells que tu rencontreras
```
engine/src/
  index.ts          public surface: loader, runtime, template, inputs, url-mode
  loader.ts         fetches and validates tool files
  runtime.ts        orchestrates one mounted tool, from load to export
  template.ts       Handlebars hydration and annotateTemplate
  inputs.ts         manifest to runtime input model
  url-mode.ts       URL to input state and back
  validate.ts       JSON Schema validation of manifests
  compose.ts        nested tool renders (composes)
  embed.ts          portable lolly.tools embed URLs
  bridge/host-v1.ts type re-export of the @lolly-tools/core contract

shells/web/src/
  main.ts           boot and routing
  bridge/           the web implementations of the host APIs
  catalog/sync.ts   boot-time catalog sync and offline cache
  views/            the gallery, tool, projects, free canvas and the other views
  pro/              Batch (#/batch)

shells/cli/         bin/lolly.ts (entry), src/run.ts (headless render), src/bridge.ts
shells/tui/         src/main.tsx (the full-screen app), src/bridge.ts
```
:::

::: note Aucun répertoire `tools/` ou `catalog/` à la racine du dépôt
`packages/node-shell/src/content-roots.ts` répond à « où se trouve l'outil `<id>` » et « où est le catalogue » à partir de `profiles.json`. Une vraie paire `tools/` et `catalog/` n'est écrite que dans une sortie de compilation, comme `dist/`, le contenu d'un RPM ou une image de conteneur, car un navigateur récupère ces deux chemins via HTTP.
:::

<!--i:eti-monitor-->
## Où fonctionne Lolly

Chaque interface utilise le même moteur et les mêmes fichiers d'outils.

- **L'application web.** Une application web progressive. Elle fonctionne hors ligne une fois que son service worker a mis les outils et les ressources en cache. Elle n'a besoin d'aucun compte, et son état est conservé dans IndexedDB sur chaque appareil. Une même mise en page adaptative convient aux ordinateurs et aux téléphones. Sur un téléphone, les contrôles forment un panneau et les contrôles d'export s'ouvrent depuis une pastille flottante.
- **Les applications pour ordinateur et mobile.** Des paquets Tauri de la même application web, avec des boîtes de dialogue de fichiers natives, un état conservé dans le système de fichiers et une utilisation entièrement hors ligne.
- **La CLI.** `lolly <tool-id> --input=value --output=file.png` charge le même moteur dans un DOM sans interface graphique et écrit le fichier. C'est le mode URL via un autre transport. Voir [CLI](/info/cli.html).
- **La TUI.** Une application de terminal en plein écran conçue pour le clavier. Elle réutilise le pont de la CLI et conserve les sessions enregistrées sur disque : dans le dossier de l'application de bureau si elle est installée, sinon sous `~/.lolly`. Elle ne démarre un navigateur sans interface graphique à portée limitée que si un format en a besoin. Voir [TUI](/info/tui.html).

![La vue divisée sur ordinateur : les contrôles générés à partir du manifeste à gauche, le canevas en direct à droite](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

À la largeur d'un téléphone, le panneau de contrôles est en haut et l'aperçu remplit l'écran.

![Un audiogramme sur un écran de 430px de large : le panneau de contrôles en haut, le visuel carré terminé en dessous et la pastille d'export flottante](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dzzfxm%3A7%3Alofi%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

L'application web inclut aussi **Batch** (`#/batch`, `shells/web/src/pro/`), une grille de type tableur qui effectue le rendu de nombreuses lignes à la fois avec un ou plusieurs outils. Voir [Batch et Lolly Multi-edit](/info/batch.html#make-many-versions-of-one-design). **Settings → Capabilities** liste tout ce que la plateforme déclare pouvoir faire.

![Batch sur une nouvelle installation : une ligne vide attend un outil, avec la grille du tableur et son bouton Render en place avant l'arrivée des données](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

<!--i:eti-lock-->
## Engagements architecturaux

Ces décisions sont arrêtées. Toutes les autres décisions dans le code en dépendent, donc en changer une est un chantier majeur.

### 1. Des outils déclaratifs, avec une porte de sortie impérative

Un outil est un manifeste (`tool.json`), un modèle (`template.html`) et un fichier `hooks.js` facultatif. **Le manifeste déclare les entrées**. Les entrées ne sont jamais déduites des tokens Handlebars du modèle. La plupart des outils se limitent à un manifeste et un modèle, ce qui permet aux personnes qui ne développent pas d'en créer.

![La pile de contrôles de Street Map : une liste déroulante de villes, un sélecteur de thème, des curseurs d'épaisseur et des déclencheurs de couleur, chacun issu d'une ligne du manifeste](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

Les outils qui calculent des valeurs, comme l'encodage QR ou la mise en forme de graphiques, ajoutent des hooks : des fonctions nommées du cycle de vie que l'environnement d'exécution appelle en leur injectant le pont de capacités. Les hooks sont un contrat de portabilité, pas un bac à sable de sécurité. Leur temps d'exécution est limité. Les outils dont les hooks sont prouvés indépendants des variables globales de la page portent `isolate: true` et s'exécutent dans un Worker. [Hooks des outils](/info/tool-hooks.html) décrit le cycle de vie et les budgets de temps. Le [modèle de menaces](/info/threat-model.html) indique ce que l'exécuteur intégré à la page isole ou non.

### 2. Les outils et les ressources sont des données, pas du code empaqueté

Les applications web et Tauri récupèrent les catalogues d'outils et de ressources au démarrage, les mettent en cache et utilisent ce qui est en cache. Un nouvel outil ou une nouvelle ressource n'exige pas de nouvelle version de l'application. Les octets des ressources sont vérifiés par une somme de contrôle SHA-256. L'`id` et la `version` d'une ressource pilotent l'invalidation du cache.

### 3. Le pont de capacités est la seule API visible par les outils

Les outils ne touchent jamais au DOM en dehors de leur modèle, n'appellent jamais `fetch` directement et ne lisent jamais le système de fichiers. Ils appellent des méthodes `host.*` versionnées. Le contrat est défini dans `packages/core/src/host-v1.ts`, dans le SDK pour les auteurs d'outils `@lolly-tools/core`. Un tiers peut développer avec le SDK sans dépendre du moteur. `engine/src/bridge/host-v1.ts` réexporte ses types.

| API requise | Son rôle |
|---|---|
| `host.profile` | Les informations de l'utilisateur ; préremplit les entrées via `bindToProfile` |
| `host.assets` | Les requêtes au catalogue, la résolution des ressources et le sélecteur de l'hôte |
| `host.state` | Enregistrer et charger les emplacements d'entrées : IndexedDB sur le web, le système de fichiers dans Tauri, la mémoire dans la CLI |
| `host.clipboard` | Écrire du texte ou une image dans le presse-papiers, avec des solutions de repli selon la plateforme |
| `host.export` | Rastériser ou sérialiser la cible de rendu, et le chemin de transformation des fichiers sur l'appareil |
| `host.log` | Journalisation par niveaux vers l'hôte |

Toutes les autres API sont facultatives et s'ajoutent à celles-ci : `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` et bien d'autres. Le champ `requires` d'un manifeste liste les API facultatives que ses hooks appellent sans vérification préalable. Un hôte auquel il en manque une refuse de monter l'outil. Les hooks détectent la disponibilité des autres. Certaines, comme `recorder`, ont aussi besoin d'une capacité de l'appareil déclarée par l'outil. `packages/core/src/host-v1/apis.ts` les liste toutes et [API de l'hôte](/info/host-api.html) documente chacune. Ajouter une méthode donne lieu à une version mineure. En supprimer ou en modifier une donne lieu à une version majeure, et la v1 continue de fonctionner quand la v2 sort.

### 4. Les identifiants de ressources sont permanents

`lolly/logo/primary` est un contrat. Une fois publié, un identifiant ne change jamais et n'est jamais réutilisé. Un changement d'octets incrémente `version` dans l'entrée de la ressource. Un remplacement définit `deprecated: true` et, éventuellement, `replacedBy`. Les références existantes sont toujours résolues, donc les sessions enregistrées et les liens partagés continuent de fonctionner pendant des années.

### 5. Le mode URL est une fonction à part entière

Chaque entrée peut s'exprimer comme un paramètre d'URL, donc un lien est un fichier terminé :

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Ce lien seul, sans rien d'autre, est le fichier terminé](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Change un paramètre et tu obtiens un autre fichier. Cette palette tient en une couleur de départ, une harmonie et un nombre de paliers :

![Neuf paliers sur quatre teintes, tous issus de l'unique couleur de départ contenue dans le lien](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

La CLI construit le même état d'URL à partir de ses arguments et exécute la même chaîne de traitement, ce qui l'empêche de diverger de l'application. `engine/src/url-mode.ts` analyse et sérialise l'état de l'URL. Les noms réservés (`format`, `width`, `dpi`, `c2pa`, `z` et d'autres) ne sont jamais transmis à un outil. [Paramètres d'URL réservés](/info/url-parameters.html) les liste tous. Les entrées de ressources sont transmises par `id` et résolues via `host.assets.get()` avant le remplissage du modèle.

### 6. Le stockage passe par le pont

L'application web utilise IndexedDB, Tauri le système de fichiers et la CLI la mémoire. Les outils ne voient que `host.state.save(slot, data)` et `host.state.load(slot)`, jamais `localStorage`. Tu peux conserver plusieurs sessions nommées par outil sans compte. Comme le pont est le seul point de jonction, cet état est aussi portable. `shells/web/src/data-transfer.ts` exporte l'état dans un fichier `lolly-backup` qui s'importe sur toute autre installation ([Transfert de données](/info/data-transfer.html)). [Sync](/info/sync.html) envoie le même ensemble vers le stockage que tu choisis.

### 7. Les étiquettes de maturité indiquent ce qu'est un outil

Chaque outil déclare `status: official | community | experimental`. La galerie trie par statut. Les outils expérimentaux ajoutent un filigrane à leurs exports par défaut : l'environnement d'exécution active le filigrane sauf si l'appelant passe `watermark: false`. Les outils exécutés sur l'appareil en sont exemptés. Le processus de catalogue propre à une équipe s'appuie sur ces étiquettes.

### 8. Les entrées sont typées dans le manifeste

Une entrée déclare un `type` : `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` ou `file`. L'hôte affiche un contrôle pour chaque type, donc les outils n'écrivent aucun code de contrôle. Toute entrée peut porter `bindToProfile`. Trois types comptent particulièrement :

- **`asset`**, avec `filter` et `allowUpload`, est le pont vers le système de ressources. `allowUpload: false` limite un emplacement aux ressources de la bibliothèque. Les fichiers importés par l'utilisateur partagent la structure `AssetRef` de la bibliothèque.
- **`blocks`** est un groupe de champs répété, modifié dans un panneau latéral, utilisé par Meeting Planner, Wayfinding, Diagrams et d'autres. Cliquer sur un bloc rendu donne le focus à sa ligne.
- **`file`** garde le fichier de l'utilisateur en mémoire pour les utilitaires qui fonctionnent sur l'appareil, comme Lolly Strip Hidden Data et Compress, et **`vector`** regroupe un ensemble fixe de nombres dans un seul contrôle.

### 9. Les modèles ne contiennent pas de logique

Les modèles sont en Handlebars, ce qui permet aux personnes qui ne développent pas de les écrire. `{{x}}` échappe le contenu, et `{{{x}}}` demande un choix explicite. La logique se trouve dans `hooks.js`, où elle peut être relue. Beaucoup de modèles utilisent `{{{` pour le balisage calculé par un hook, donc chaque hook doit échapper ce qu'il transmet. Les helpers sont `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` et `media`, ainsi que `icsStamp`, `rfcText`, `csvCell` et `arrow` pour les modèles associés `.ics`, `.vcf` et `.csv`. [Modèles et rendu](/info/tool-rendering.html) les décrit.

### 10. Les outils composent d'autres outils

Un outil peut incorporer le rendu d'un autre outil sans import entre outils. Le moteur résout la composition. Un manifeste peut déclarer `composes: [{ id, tool, inputs }]` et placer l'enfant avec `{{asset <id>}}`. Une URL d'intégration portable (`https://lolly.tools/tool/<id>.svg?…`) effectue le rendu de l'enfant localement ; Lolly Design place ainsi un code QR ou un graphique en direct. Un enfant SVG reste vectoriel dans un parent SVG ou PDF. Les enfants sont des intermédiaires et ne reçoivent jamais de filigrane ni de marquage. Un shell qui ne peut pas rendre un enfant laisse l'emplacement vide, et le rendu du parent se fait quand même. [Composition et surcharges de marque](/info/tool-composition.html) donne les détails.

<!--i:eti-scissors-->
## Ce que nous avons choisi de ne pas faire

- **Pas de JavaScript arbitraire dans les modèles.** La logique se trouve dans `hooks.js`.
- **Pas de serveur de ressources obligatoire.** Tu ajoutes tes propres fichiers dans Assets dans l'application et transmets ton travail sous forme de session : un lien de partage pour les entrées et les réglages, un fichier `.lolly` quand les fichiers importés doivent suivre aussi. Une session partagée peut devenir un modèle dans le sélecteur d'un outil. Une organisation qui veut un catalogue encadré peut utiliser le catalogue, les approbations et les politiques de Lolly Work, ou gérer le pack de marque dans git et y examiner les changements.
- **Pas de contrôle d'accès imposé.** L'application ouverte est publique par défaut. Les étiquettes de maturité et les filigranes portent le risque de marque. La connexion à l'organisation, les rôles et la politique viennent de Lolly Work quand une équipe en a besoin.
- **Pas de base de données centrale.** L'état utilisateur est conservé sur chaque appareil, et Sync le copie en option vers le stockage que la personne choisit, jamais vers une base de données Lolly.
- **Pas de chemin de code partagé entre les outils et le moteur.** Le moteur et les outils communautaires sont open source. Un pack de marque comme le pack privé `brands/suse/` contient ses propres outils et son catalogue sous ses propres conditions. Aucun outil n'importe depuis `engine/`, donc la séparation reste nette.

<!--i:eti-refresh-->
## Le cycle de vie d'un rendu

Quelqu'un ouvre `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H` :

1. **Démarrage.** L'application web ouvre IndexedDB, construit le pont de capacités et synchronise les catalogues d'outils et de ressources, ou les charge depuis le cache hors ligne.
2. **Routage.** Le chemin sélectionne la vue de l'outil `qr-code`, avec les paramètres de requête comme valeurs initiales.
3. **Chargement.** `loadTool` récupère `tool.json`, le valide selon le schéma et récupère le modèle, les styles et les hooks.
4. **Analyse du lien.** `parseUrlState` transforme les paramètres en valeurs d'entrée. Une référence de ressource comme `?logo=lolly/logo/primary` devient un `{ id }` non résolu.
5. **Démarrage de l'environnement d'exécution.** `createRuntime(tool, host, initialValues)` construit le modèle d'entrées à partir des données du profil, des valeurs par défaut et du lien, résout les références de ressources, charge les hooks et appelle `onInit`.
6. **Rendu.** Le shell s'abonne à l'environnement d'exécution, dessine les contrôles à partir du modèle et écrit le modèle rempli dans `#tool-canvas`.
7. **Interaction.** La saisie appelle `runtime.setInput`, qui applique les contraintes, appelle `onInput`, remplit à nouveau le modèle et le redessine.
8. **Export.** **Download** appelle `runtime.export(node, format)`, et le `host.export` du shell produit le fichier : un raster, un vectoriel issu du parcours du DOM, un PDF, un document ou l'un des autres formats de `schemas/tool.schema.json`. Les unités physiques sont converties selon le format. Les métadonnées et Content Credentials sont incorporés là où le format peut les contenir. Les outils expérimentaux reçoivent leur filigrane de l'hôte, pas de l'outil. [Modèles et rendu](/info/tool-rendering.html) et [Exporter un fichier](/info/exporting.html) décrivent l'étape d'export.

![Le panneau d'export ouvert par ?options : la paire nom de fichier et format, la taille de sortie et les contrôles qui écrivent le fichier](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Le même cycle de vie s'exécute dans Tauri et dans la CLI avec un DOM sans interface graphique, où la sortie va dans un fichier ou vers stdout.

<!--i:eti-stamp-->
## Licences

Le code, y compris `engine/`, `shells/`, `services/`, `schemas/` et le générateur de documentation, est sous MPL-2.0, dans un seul dépôt public, [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). Le texte de la documentation est sous CC BY-SA 4.0. Les packs de marque ont leurs propres conditions dans le `NOTICE.md` de chaque pack : les outils communautaires sont sous MPL-2.0, et le pack privé SUSE est propriétaire et appartient à SUSE. [À propos](/info/about.html) contient la note complète sur les licences.
