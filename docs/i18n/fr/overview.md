# Architecture de Lolly

![Icône Lolly - Grande sucette verte et blanche](/info/icon.svg)

Cette page s'adresse aux personnes qui modifient le code de Lolly : comment le moteur, les shells et les packs d'outils s'articulent, où chacun se trouve dans le dépôt, et les engagements qui contraignent chaque changement. Si tu veux savoir ce que fait Lolly et qui l'utilise, lis d'abord [How Lolly works](/info/how-lolly-works.html).

Deux compagnons vont plus loin. [`engine/README.md`](../engine/README.md) est la carte du moteur module par module, générée à partir du code. [Threat Model & Trust Boundaries](/info/threat-model.html) lit la même architecture comme des frontières de confiance, et c'est la page pour toute question sur ce que le moteur traite comme non fiable.

## Vue d'ensemble

Les outils sont des données, tout en haut. Le moteur, au milieu, ne connaît aucune plateforme. Les shells, en bas, implémentent un seul contrat, et les catalogues fournissent le contenu.

![Les outils fournissent un manifeste, un modèle et des hooks au moteur partagé. Les shells web, Tauri et terminal implémentent le pont de capacités HostV1 et lisent les outils et ressources depuis les catalogues.](/info/diagrams/concepts/platform-layers.svg)

Si tu peux le décrire en données pures et en Handlebars, cela appartient au **moteur**. Si cela touche le DOM, le système de fichiers, le réseau ou n'importe quelle API de navigateur ou de système d'exploitation, cela appartient à l'**hôte**, le côté du pont qui revient au shell. Le moteur est open source, et rien de ce qui connaît une marque ou une plateforme particulière n'entre dans le moteur.

## Organisation du dépôt

Lolly est un seul dépôt. Chaque répertoire ci-dessous est un simple répertoire de celui-ci, sauf `brands/suse`, un sous-module git **privé** qui contient le pack d'outils et le catalogue SUSE, qu'un clone public ne récupère pas. Les packs qu'un build lit forment un profil de contenu (`profiles.json`), résolu par processus plutôt que basculé globalement. Le [Build Guide](/info/build-guide.html) donne la commande de clonage et la façon de valider un changement dans le pack privé.

| Répertoire | Ce qu'il contient |
|---|---|
| `engine/` | Le cœur indépendant de la plateforme : chargeur, runtime, entrées, modèles, mode URL, unités et modules de formats |
| `shells/` | L'application web, les applications de bureau et mobiles Tauri, la CLI, la TUI et l'extension de navigateur |
| `packages/` | Le SDK des auteurs d'outils (`@lolly-tools/core`), les éléments communs du shell Node et le moteur de rendu des docs, entre autres |
| `community/` | Les outils indépendants d'une marque, plus les packs d'emoji partagés |
| `brands/` | Les packs de marque : `lolly-demo` (Lolly Demo, le design system que fait tourner lolly.tools), `lolly-start` (le point de départ vierge) et le `suse` privé |
| `services/` | Les services facultatifs MCP, de certificats et Penpot, et le code serveur qu'ils partagent |
| `schemas/` | JSON Schema pour les manifestes d'outils, les entrées de ressources et les références de ressources |
| `scripts/`, `tests/`, `docs/`, `api/` | Les scripts de build et de catalogue, la suite de tests du moteur, ces docs et les bundles serverless générés |

::: details Les fichiers du moteur et des shells que tu rencontres en premier
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

Il n'y a pas de répertoire `tools/` ou `catalog/` à la racine du dépôt. `packages/node-shell/src/content-roots.ts` répond à « où vit l'outil `<id>` » et « où est le catalogue » à partir de `profiles.json` quand on le lui demande. Une vraie paire `tools/` et `catalog/` n'est écrite que dans une sortie de build, comme `dist/`, une charge utile RPM ou une image de conteneur, car un navigateur récupère ces deux chemins en HTTP.

## Où Lolly tourne

Chaque surface utilise le même moteur et les mêmes fichiers d'outils.

- **L'application web.** Une application web progressive qui fonctionne hors ligne une fois que son service worker a mis en cache les outils et les ressources. Elle n'a besoin d'aucun compte ; l'état vit dans IndexedDB sur chaque appareil. Une seule mise en page adaptative sert le bureau et le téléphone : sur un téléphone, les contrôles deviennent une feuille et les contrôles d'export s'ouvrent depuis une pastille flottante.
- **Les applications de bureau et mobiles.** Des paquets Tauri de la même application web, avec des boîtes de dialogue de fichiers natives, un état dans le système de fichiers et un usage hors ligne complet.
- **La CLI.** `lolly <tool-id> --input=value --output=file.png` charge le même moteur dans un DOM sans interface et écrit le fichier. C'est le mode URL sur un autre transport, pas une implémentation distincte. Voir [CLI](/info/cli.html).
- **La TUI.** Une application de terminal plein écran, pensée pour le clavier, qui réutilise le pont de la CLI, garde les sessions enregistrées sur disque (dans le dossier propre de l'application de bureau quand elle est installée, sinon sous `~/.lolly`) et ne démarre un navigateur sans interface limité que lorsqu'un format en a besoin. Voir [TUI](/info/tui.html).

![La vue partagée sur ordinateur : les contrôles générés à partir du manifeste à gauche, le canevas en direct à droite](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

Le même outil à la largeur d'un téléphone n'a pas besoin d'une seconde mise en page : les contrôles deviennent une feuille en haut et l'aperçu occupe l'écran.

![Un audiogramme sur un écran de 430 px de large : la feuille de contrôles au-dessus, l'illustration carrée terminée en dessous et la pastille d'export flottante](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

L'application web inclut aussi **Batch** (`#/batch`, `shells/web/src/pro/`), une grille de type tableur qui rend beaucoup de lignes à la fois pour un ou plusieurs outils ; [Batch and Multi-edit](/info/batch.html#make-many-versions-of-one-design) couvre Batch. **Settings → Capabilities** cartographie tout ce que la plateforme déclare pouvoir faire.

![Batch sur une installation neuve : une ligne vide en attente d'un outil, avec la surface de tableur et son bouton Render en place avant l'arrivée de toute donnée](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

## Engagements architecturaux

Ces décisions sont arrêtées. Changer l'une d'elles est une entreprise majeure, car elles façonnent toutes les autres décisions de la base de code.

### 1. Outils déclaratifs, avec une échappatoire impérative

Un outil est un manifeste (`tool.json`), un modèle (`template.html`) et un `hooks.js` facultatif. **Le manifeste déclare les entrées**, jamais le modèle : les entrées ne sont pas déduites des jetons Handlebars. La plupart des outils se réduisent au manifeste et au modèle, ce qui permet à des non-développeurs de les créer.

![La pile de contrôles de Street Map : une liste de villes, un sélecteur de thème, des curseurs de poids et des déclencheurs de couleur, chacun tiré d'une ligne de manifeste](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

Les outils qui calculent des valeurs, comme l'encodage de QR ou la mise en forme de graphiques, ajoutent des hooks : des fonctions de cycle de vie nommées que le runtime appelle avec le pont de capacités injecté. Les hooks sont un contrat de portabilité, pas un bac à sable de sécurité, et ils s'exécutent dans un budget de temps. Les outils dont les hooks sont reconnus sans globales de page portent `isolate: true` et tournent dans un Worker. [Tool hooks](/info/tool-hooks.html) détaille le cycle de vie et les budgets, et le [Threat Model](/info/threat-model.html) dit ce que l'exécuteur dans la page contient et ne contient pas.

### 2. Les outils et les assets sont des données, pas du code embarqué

Les applications web et Tauri récupèrent les catalogues d'outils et de ressources au démarrage, les mettent en cache et travaillent avec ce qui s'y trouve, donc un nouvel outil ou une nouvelle ressource n'exige aucune version de l'application. Les octets des ressources ont une somme de contrôle SHA-256, et l'`id` et la `version` d'une ressource pilotent l'invalidation du cache.

### 3. Le pont de capacités est la seule API que les outils voient

Les outils ne touchent jamais le DOM en dehors de leur modèle, n'appellent jamais `fetch` directement et ne lisent jamais le système de fichiers. Ils appellent des méthodes `host.*` versionnées. La définition canonique du contrat est `packages/core/src/host-v1.ts`, le SDK des auteurs d'outils `@lolly-tools/core`, pour qu'un tiers puisse construire dessus sans dépendre du moteur ; `engine/src/bridge/host-v1.ts` en réexporte les types.

| API requise | Ce qu'elle fait |
|---|---|
| `host.profile` | Les informations de l'utilisateur ; préremplit les entrées via `bindToProfile` |
| `host.assets` | Requêtes sur le catalogue, résolution des ressources et sélecteur de l'hôte |
| `host.state` | Enregistre et charge des emplacements d'entrées : IndexedDB sur le web, le système de fichiers dans Tauri, la mémoire dans la CLI |
| `host.clipboard` | Écrit du texte ou une image dans le presse-papiers, avec des solutions de repli selon la plateforme |
| `host.export` | Rastérise ou sérialise la cible de rendu, et le chemin de transformation de fichiers sur l'appareil |
| `host.log` | Journalisation par niveaux vers l'hôte |

Toute autre API est facultative et additive : `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` et bien d'autres. Le manifeste d'un outil liste sous `requires` les API facultatives que ses hooks appellent sans vérification préalable, et un hôte qui en manque une refuse de monter l'outil ; les hooks détectent les autres. Quelques-unes, comme `recorder`, exigent aussi une capacité d'appareil que l'outil déclare. `packages/core/src/host-v1/apis.ts` les liste toutes et [Host API](/info/host-api.html) documente chacune. Ajouter une méthode est une version mineure ; en retirer ou en modifier une est une version majeure, et la v1 continue de fonctionner quand la v2 sort.

### 4. Les identifiants de ressources sont éternels

`lolly/logo/primary` est un contrat. Une fois publié, un identifiant ne change jamais et n'est jamais réutilisé. Un changement d'octets incrémente `version` dans l'entrée de la ressource, et un remplacement définit `deprecated: true` et, éventuellement, `replacedBy`, pour que les références existantes se résolvent toujours. C'est ce qui fait fonctionner pendant des années les sessions enregistrées et les liens partagés.

### 5. Le mode URL est de premier ordre

Chaque entrée peut s'exprimer comme paramètre d'URL, donc un lien est un fichier terminé :

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Ce lien seul, sans rien d'autre, est le fichier terminé](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Change un paramètre et tu obtiens un autre fichier. Toute cette palette tient dans une couleur de départ, une harmonie et un nombre de pas :

![Neuf nuances sur quatre teintes, toutes issues de la seule couleur de départ portée par le lien](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

La CLI construit le même état d'URL à partir de ses arguments et exécute le même pipeline, donc la CLI ne peut pas s'écarter de l'application. `engine/src/url-mode.ts` analyse et sérialise ; un ensemble de noms réservés (`format`, `width`, `dpi`, `c2pa`, `z` et d'autres) n'est jamais transmis à un outil, et [Reserved URL parameters](/info/url-parameters.html) les liste tous. Les entrées de ressources voyagent par `id` et se résolvent via `host.assets.get()` avant que le modèle se remplisse.

### 6. Le stockage passe par le pont

L'application web utilise IndexedDB, Tauri le système de fichiers et la CLI la mémoire. Les outils ne voient que `host.state.save(slot, data)` et `host.state.load(slot)`, jamais `localStorage`. On peut garder plusieurs sessions nommées par outil sans compte. Comme le pont est la seule couture, cet état est aussi portable : `shells/web/src/data-transfer.ts` le relit dans un seul fichier `lolly-backup` qui s'importe sur n'importe quelle autre installation ([Data transfer](/info/data-transfer.html)), et [Sync](/info/sync.html) envoie le même bundle vers un stockage que la personne choisit.

### 7. Les étiquettes de maturité disent ce qu'est un outil

Chaque outil déclare `status: official | community | experimental`. La galerie trie par statut, et les outils expérimentaux mettent un filigrane sur leurs exports par défaut : le runtime active le filigrane sauf si l'appelant passe `watermark: false`, et les outils sur l'appareil en sont exemptés. Tout processus qu'une équipe met autour du catalogue vient s'ajouter par-dessus.

### 8. Les entrées sont typées dans le manifeste

Une entrée déclare un `type` : `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` ou `file`. L'hôte affiche un contrôle par type, donc les outils n'écrivent aucun code de contrôle, et toute entrée peut porter `bindToProfile`. Trois pèsent le plus lourd :

- **`asset`**, avec `filter` et `allowUpload`, est le pont vers le système de ressources. `allowUpload: false` limite un emplacement aux ressources de la bibliothèque, et les envois des utilisateurs partagent la forme `AssetRef` de la bibliothèque.
- **`blocks`** est un groupe de champs répétable modifié dans un panneau latéral, utilisé par Meeting Planner, Wayfinding, Diagrams et d'autres. Cliquer sur un bloc rendu met sa ligne au focus.
- **`file`** garde en mémoire le fichier de l'utilisateur pour les utilitaires sur l'appareil comme Strip Hidden Data et Compress, et **`vector`** regroupe un ensemble fixe de nombres en un seul contrôle.

### 9. Les modèles sont sans logique

Les modèles sont en Handlebars, choisi pour que des non-développeurs puissent les écrire : `{{x}}` échappe, et `{{{x}}}` est un choix explicite. La logique vit dans `hooks.js`, où elle est explicite et relisible. Beaucoup de modèles utilisent `{{{` pour du balisage qu'un hook a calculé, donc chaque hook doit échapper ce qu'il transmet. Les helpers sont `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` et `media`, plus `icsStamp`, `rfcText`, `csvCell` et `arrow` pour les modèles frères `.ics`, `.vcf` et `.csv`. [Templates and rendering](/info/tool-rendering.html) les couvre.

### 10. Les outils composent des outils

Un outil peut incorporer le rendu d'un autre outil sans importation d'outil à outil ; le moteur résout la composition. Un manifeste peut déclarer `composes: [{ id, tool, inputs }]` et placer l'enfant avec `{{asset <id>}}`, et une URL d'incorporation portable (`https://lolly.tools/tool/<id>.svg?…`) rend l'enfant en local, c'est ainsi que Design place un QR code ou un graphique en direct. Un enfant SVG reste vectoriel dans un parent SVG ou PDF. Les enfants sont des intermédiaires, jamais filigranés ni estampillés, et un shell qui ne peut pas en rendre un laisse l'emplacement vide tandis que le parent se rend quand même. [Composition and brand overlays](/info/tool-composition.html) donne les détails.

## Ce que nous avons choisi de ne pas faire

- **Pas de JavaScript arbitraire dans les modèles.** La logique vit dans `hooks.js`.
- **Pas de serveur de ressources obligatoire.** Les gens ajoutent leurs propres fichiers à Assets dans l'application et transmettent le travail sous forme de session : un lien de partage pour les entrées et réglages, un fichier `.lolly` quand les envois voyagent aussi. Une session partagée peut devenir un modèle dans le sélecteur d'un outil. Une organisation qui veut un catalogue encadré peut utiliser le catalogue, les approbations et les politiques de Lolly Work, ou gérer le pack de marque dans git et y relire les changements.
- **Pas de contrôle d'accès imposé.** L'application ouverte est publique par défaut, et les étiquettes de maturité et les filigranes portent le risque de marque. La connexion d'organisation, les rôles et la politique viennent de Lolly Work quand une équipe les veut.
- **Pas de base de données centrale.** L'état de l'utilisateur vit sur chaque appareil, et Sync facultatif le copie vers un stockage que la personne choisit, jamais vers une base de données Lolly.
- **Pas de chemin de code partagé entre les outils et le moteur.** Le moteur et les outils communautaires sont open source, et un pack de marque comme le `brands/suse/` privé porte ses propres outils et son catalogue selon ses propres conditions. Aucun outil n'importe depuis `engine/`, donc la séparation reste nette.

## Le cycle de vie d'un rendu

Quelqu'un ouvre `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H` :

1. **Démarrage.** L'application web ouvre IndexedDB, construit le pont de capacités et synchronise les catalogues d'outils et de ressources, ou les charge depuis le cache hors ligne.
2. **Route.** Le chemin sélectionne la vue d'outil pour `qr-code`, avec la requête comme valeurs initiales.
3. **Chargement.** `loadTool` récupère `tool.json`, le valide par rapport au schéma et récupère le modèle, les styles et les hooks.
4. **Analyse du lien.** `parseUrlState` transforme les paramètres en valeurs d'entrées. Une référence de ressource comme `?logo=lolly/logo/primary` devient un `{ id }` non résolu.
5. **Démarrage du runtime.** `createRuntime(tool, host, initialValues)` construit le modèle d'entrées à partir des données du profil, des valeurs par défaut et du lien, résout les références de ressources, charge les hooks et appelle `onInit`.
6. **Rendu.** Le shell s'abonne au runtime, dessine les contrôles à partir du modèle et écrit le modèle rempli dans `#tool-canvas`.
7. **Interaction.** Saisir appelle `runtime.setInput`, qui applique les contraintes, appelle `onInput`, remplit de nouveau le modèle et redessine.
8. **Export.** **Download** appelle `runtime.export(node, format)`, et `host.export` du shell produit le fichier : un raster, un vecteur issu du parcours du DOM, un PDF, un document ou l'un des autres formats de `schemas/tool.schema.json`. Les unités physiques sont converties par format, et les métadonnées et Content Credentials sont incorporés là où le format peut les contenir. Les outils expérimentaux reçoivent leur filigrane de l'hôte, pas de l'outil. [Templates and rendering](/info/tool-rendering.html) et [Export a file](/info/exporting.html) couvrent l'étape d'export.

![Le panneau d'export qu'ouvre ?options : le nom de fichier et le format, la taille de sortie et les contrôles qui écrivent le fichier](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Le même cycle de vie s'exécute dans Tauri, et dans la CLI avec un DOM sans interface, où la sortie va dans un fichier ou sur stdout.

## Licences

Le code, y compris `engine/`, `shells/`, `services/`, `schemas/` et le générateur de documentation, est sous MPL-2.0, dans un seul dépôt public, [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). La prose de la documentation est sous CC BY-SA 4.0. Les packs de marque portent leurs propres conditions dans le `NOTICE.md` de chaque pack : les outils communautaires sont sous MPL-2.0, et le pack SUSE privé est la propriété de SUSE. [About](/info/about.html) contient la note complète sur les licences.
