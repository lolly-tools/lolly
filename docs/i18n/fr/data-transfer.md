# Transfert de données : le bundle `lolly-backup`

Lolly garde ta bibliothèque personnelle sur l'appareil. Un bundle de sauvegarde est la façon dont cette bibliothèque se déplace : exporte-le sur une installation, transporte le fichier comme tu veux (USB, AirDrop, e-mail à toi-même ou partage réseau) et importe-le sur une autre. Exporter et importer n'exigent aucun serveur, et la cible peut être hors ligne.

Cette page est la spécification du format, pour les personnes qui construisent des shells, des outils ou des scripts autour des sauvegardes : ce que contient le zip, comment les versions sont contrôlées, comment un import fusionne et ce qui est vérifié. Le pas à pas pour les personnes qui déplacent leur propre travail est [Move your work to another device](/info/find-your-work.html#move-your-work-to-another-device).

![Les deux boutons qui déplacent toute une installation : Export my data écrit un zip, Import data le relit](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> **Périmètre.** Un bundle porte des *données d'utilisateur*, pas des outils de catalogue. Les outils et ressources du catalogue sont synchronisés séparément et sont supposés déjà présents sur la cible, au pire dans une version plus récente. Les outils qu'un utilisateur a créés lui-même voyagent dans `profile.json`. Importer n'installe ni ne met à niveau jamais un outil du catalogue.

## Objectifs

- <!--i:box--> **Un format, tous les shells.** L'application web, les applications de bureau et mobiles et les futurs shells partagent la même enveloppe et les mêmes schémas de parties. Les parties facultatives dépendent des capacités de chaque shell, et les parties non prises en charge sont signalées. Chaque pont de capacités fournit son adaptateur de stockage.
- <!--i:shieldcheck--> **Survit au voyage.** Un bundle abîmé ou tronqué en transit échoue bruyamment à l'import et ne se restaure jamais à moitié.
- <!--i:clock--> **Survit à cette version.** Une application plus ancienne peut toujours importer les parties d'un bundle plus récent qu'elle reconnaît. Un format réellement incompatible est refusé proprement.
- <!--i:check--> **Fusion sûre.** Importer sur une installation déjà utilisée n'efface jamais rien qui n'était pas dans le bundle.

## L'enveloppe

Un bundle est un simple `.zip`, donc il survit intact à n'importe quel transport et n'importe quel outil de décompression peut en inspecter le contenu.

Le téléchargement porte le nom de la personne à qui il appartient : `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, par exemple `LollyTools-Ada-Lovelace-2026-06-26-1.zip`, pour qu'un dossier Téléchargements de sauvegardes reste lisible. Les prénom et nom viennent du profil et sont omis quand ils ne sont pas définis : sans profil, on obtient `LollyTools-2026-06-26-1.zip`, et avec un prénom seul `LollyTools-Ada-2026-06-26-1.zip`. Chaque nom est réduit à un jeton compatible avec les noms de fichiers (lettres et chiffres Unicode conservés, espaces et ponctuation supprimés, 32 caractères au plus). `<n>` est une séquence par jour et par appareil, donc des exports répétés le même jour n'entrent pas en collision et restent en ordre. `backupFilename()` dans `data-transfer.ts` construit le nom, et le contenu du zip est le même quel que soit son nom.

| Chemin | Requis | Contenu |
|---|---|---|
| `manifest.json` | oui | Identifiant du format, versions, totaux et intégrité par partie. La première chose qu'un lecteur regarde. |
| `profile.json` | si défini | Tout l'enregistrement `me` de l'utilisateur : nom, coordonnées, référence de la photo et indicateurs, plus les dossiers, la Corbeille, les modèles de projets, les modèles utilisateur et les outils créés par l'utilisateur, les favoris, les outils masqués, la langue et le choix d'emoji. Lu via `host.profile`. |
| `sessions.json` | oui | Chaque session enregistrée : emplacement, identifiant et version de l'outil, libellé, vignette (URL de données) et données d'entrée complètes. Lu via `host.state`. |
| `assets.json` | oui | Métadonnées de chaque ressource importée (images, polices, tokens de marque, logos, copies enregistrées de téléchargements), chacune pointant vers ses octets sous `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | par ressource | Les octets bruts de la ressource, stockés non compressés car la plupart sont déjà dans des formats compressés. L'extension est cosmétique ; le type MIME dans `assets.json` fait foi. |
| `assets/blobs/<n>.c2pa` | si présent | Content Credentials extraits sous forme d'octets binaires exacts, référencés par `_credentialFile` dans l'enregistrement de la ressource. Ce ne sont pas des clés de signature d'appareil. |
| `design-systems.json` | si présent | Les design systems créés ou ajoutés sur cette installation, sous la forme `{ active, records }`. Voir [Import rules](#import-rules). |
| `file-history.json` | facultatif | Instantanés versionnés de ressources, rapports d'opérations de fichiers terminées et manifestes complets de lots, avec sa propre version. Fourni par l'adaptateur de sauvegarde interne `fileHistory` du shell. |
| `revision-history.json` | facultatif, sauvegardes manuelles | Identifiants de création stables, points de contrôle conservés, vignettes et brouillons de récupération glissants. Fourni par `host.state.history.backup` là où c'est pris en charge. |
| `file-history/versions/` | par instantané | Octets des ressources précédentes et credentials extraits, que la ressource actuelle existe encore ou non. |
| `file-history/results/` | par opération terminée | Octets de sortie exacts. Aucun fichier d'origine sélectionné pour une conversion n'est conservé ni inclus. |
| `prefs.json` | oui | Préférences locales appartenant à l'utilisateur : `theme`, `sidebarWidth` et le décompte d'activité `ct-metrics`. |
| `lolly.txt` | oui | Un résumé lisible du bundle (totaux, profil, nom de fichier) pour quiconque ouvre le zip sans Lolly. Régénéré à chaque export et reconnu à l'import, donc il ne compte jamais comme une partie ignorée. Il est écrit après la carte d'intégrité, donc la carte ne couvre pas ce fichier. |

::: details Comment l'export écrit le zip
L'export écrit le zip une partie à la fois (`shells/web/src/lib/zip-stream.ts`). Les envois, résultats enregistrés et versions de ressources enregistrées sont lus par tranches de 4 MiB, jamais en entier, et les résultats et versions enregistrés sont d'abord vérifiés par rapport à leur SHA-256 consigné. Chaque fichier est ensuite lu pour sa somme de contrôle et son empreinte d'intégrité, et le zip s'y réfère là où il se trouve.

Rien n'est réencodé, donc un fichier portant des Content Credentials garde les octets exacts que sa signature couvre, et chaque partie garde ses octets et son empreinte exacts. Pour les mêmes parties et la même heure, le zip est identique à celui de l'ancien écrivain en mémoire, sauf qu'un fichier d'historique de plus de 16 MiB est compressé par morceaux. `tests/backup-streaming.test.ts` le vérifie par rapport à des empreintes de référence enregistrées.

Sur une bibliothèque synthétique de 192 MiB, mesuré dans Node, terminer la sauvegarde a pris environ 125 à 150 MiB en plus de la bibliothèque, contre environ 850 MiB pour l'écrivain en mémoire (`node scripts/bench-backup-finalise.ts`). L'import lit toujours tout le zip en mémoire.
:::

## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 3,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3, "assetVersions": 1, "fileOperations": 1 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.bin": "sha256-…",
    "file-history.json": "sha256-…",
    "file-history/versions/0.bin": "sha256-…",
    "file-history/results/0.bin": "sha256-…",
    "prefs.json": "sha256-…"
  }
}
```

| Champ | Signification |
|---|---|
| `format` | Toujours `lolly-backup`. Un fichier sans lui est rejeté comme « not a Lolly backup ». |
| `formatVersion` | La disposition avec laquelle ce bundle a été **écrit**. Incrémentée à chaque changement de l'ensemble des parties ou de leurs formes. Les lecteurs ne se **fient pas** à ce champ pour décider. |
| `minReader` | La version minimale de lecteur qui peut importer ce bundle **en sécurité**. C'est le champ sur lequel les lecteurs se règlent. |
| `app` | Identifiant de l'application productrice, pour le diagnostic. |
| `exportedAt` | Horodatage ISO de création du bundle. |
| `counts` | Ce que l'écrivain a mis dedans, pour l'affichage et les contrôles de cohérence. |
| `integrity` | Facultatif. Associe chaque partie sauf `manifest.json` à une empreinte `sha256-<base64>` de style SRI de ses octets **non compressés**. |

## Politique de versions

Deux numéros de version permettent au format d'évoluer sans laisser les anciennes installations sur le carreau.

![Un changement du format de bundle est soit additif, et les anciens lecteurs peuvent l'ignorer, soit incompatible, et un mauvais import corrompt. L'additif incrémente formatVersion et garde minReader ; l'incompatible incrémente formatVersion et relève minReader. Un lecteur importe quand minReader est au plus égal à sa propre version.](/info/diagrams/concepts/backup-version-gate.svg)

- Un lecteur importe un bundle quand `manifest.minReader` est au plus égal à sa propre version de lecteur. Il refuse, avec « needs a newer version of the app », seulement quand le bundle exige un lecteur plus récent.
- Un changement **additif**, comme une nouvelle partie facultative ou un nouveau champ facultatif du manifeste, incrémente `formatVersion` et laisse `minReader` tel quel. Les applications plus anciennes importent toujours chaque partie qu'elles reconnaissent, et les parties qu'elles ne reconnaissent pas sont signalées comme ignorées, pas abandonnées en silence.
- Un changement **incompatible**, où un mauvais import d'une partie corrompt des données ou où une partie facultative devient obligatoire, relève `minReader`. Les applications plus anciennes refusent alors proprement au lieu d'importer ce qu'elles ne savent pas traiter.
- Si un futur bundle définit `formatVersion` mais omet `minReader`, les lecteurs se rabattent sur `formatVersion` et traitent le changement comme incompatible.

> **Règle pratique pour les auteurs :** si chaque lecteur existant ferait encore ce qu'il faut en ignorant ton ajout, le changement est additif : incrémente `formatVersion` et laisse `minReader`. Sinon, relève `minReader`.

## Intégrité

Quand `manifest.integrity` est présent, un lecteur vérifie le SHA-256 de chaque partie listée **avant d'écrire quoi que ce soit**. Une différence (« failed its integrity check ») ou une partie manquante (« incomplete ») arrête tout l'import, donc il n'y a pas de restauration partielle. Cela attrape les dégâts qu'un transport de fichier peut causer : un AirDrop tronqué, une passerelle de messagerie qui a réencodé la pièce jointe, un mauvais secteur USB.

L'intégrité est assurée au mieux. Elle n'est écrite que là où Web Crypto est disponible (tout contexte de navigateur sécurisé et Node moderne), et vérifiée seulement quand la carte et Web Crypto sont tous deux présents. Un bundle sans la carte, comme un bundle antérieur à l'intégrité, s'importe sans changement : « cannot verify » ne compte jamais comme « corrupt ».

Le manifeste ne liste ni lui-même ni le `lolly.txt` régénéré. Les empreintes couvrent les parties dont le manifeste répond.

## Règles d'import

Un import s'exécute selon l'un de deux modes.

- **Merge** est ce que fait **Import data…**, et ce que fait la première jonction de sync, **Bring it to this device**. Les données de la cible restent, et rien de ce qui n'était pas dans le bundle n'est touché : une session que la cible avait et que le bundle n'avait pas survit à l'import.
- **Replace** est ce que la synchronisation d'appareils utilise pour garder les appareils alignés : elle prend l'enregistrement de profil de la copie synchronisée, les préférences, les sessions, les images et le choix du design system actif, et ne supprime que les éléments qu'un autre appareil a supprimés depuis la dernière synchronisation. Restaurer une copie antérieure va plus loin et fait correspondre l'appareil à cette copie, en supprimant tout ce que la copie ne contient pas, après avoir d'abord enregistré l'appareil. [Sync your devices](/info/sync.html) couvre ce que voit une personne.

Dans une fusion, tout ce qui n'est que sur la cible est conservé, et chaque type de données du bundle rencontre la cible comme suit :

| Données | Déjà sur la cible | Seulement dans le bundle |
|---|---|---|
| Sessions (par emplacement) et images importées (par identifiant) | La copie enregistrée le plus récemment est conservée, donc une ancienne sauvegarde n'écrase jamais du travail plus récent. Des horodatages égaux ou inconnus conservent la copie de la cible. | Ajouté |
| Dossiers | Le nom et le parent de la cible sont conservés, et le dossier gagne les membres du bundle qui lui manquent. Une session rangée dans un dossier de la cible y reste rangée. | Ajouté |
| Favoris (outils, ressources de catalogue et éléments de Projects) | Combinés | Ajouté |
| Modèles, modèles de Projects et outils utilisateur (par identifiant) | L'enregistrement de la cible est conservé. | Ajouté |
| Entrées de la Corbeille | L'entrée de la cible est conservée. | Ajouté, pour qu'un élément qui pouvait être restauré sur l'une ou l'autre installation le puisse encore. Une entrée dont le dossier est de nouveau utilisé sur la cible, ou dont l'emplacement de Corbeille est déjà utilisé par la cible, est laissée de côté. |
| Autres champs du profil (nom, coordonnées, langue, feature flags, outils masqués et autres réglages) | La valeur de la cible est conservée. | Prise là où le champ de la cible est vide |
| Préférences (`prefs.json`) | La valeur de la cible est conservée. | Écrite là où la cible n'en a pas |
| Design systems (par identifiant) | L'enregistrement du bundle remplace celui de la cible. | Ajouté. Le choix actif du bundle ne s'applique que si la cible n'a aucun design system à elle. |
| Historique de création | La copie enregistrée le plus récemment reste courante, et l'autre est conservée comme brouillon protégé. | Ajouté |

**Les sessions enregistrées se relient automatiquement à leurs images.** Les références de ressources sont conservées par identifiant, et le pont les résout de nouveau après la restauration des images, ce qu'il doit faire de toute façon car les URL `blob:` ne survivent pas à un rechargement.

**Les enregistrements d'historique ne changent jamais après leur écriture.** Un import répété de versions de ressources et d'identifiants d'opérations n'ajoute rien, et un identifiant qui désigne déjà d'autres octets ou un autre historique est refusé, pas écrasé. Réimporter une ressource courante identique conserve sa version, et une ressource courante modifiée doit porter une version différente.

**L'historique de création a quelques règles de plus.** Une création dont l'emplacement est utilisé par la cible pour une création différente est ajoutée comme création séparée, et une création dans la Corbeille de la cible y reste. Un identifiant de point de contrôle qui désigne un contenu différent sur la cible conserve celui de la cible. Une archive qui échoue à ses propres vérifications arrête l'import avant que le profil, une session, une ressource ou une préférence ne change, et un import répété identique n'ajoute aucun stockage.

**Le résumé rend compte de ce qui s'est passé.** Chaque import renvoie `profile`, `sessions`, `userAssets`, `prefs`, `skipped` et `failedAssets`.

- `failedAssets` compte les ressources importées qui n'ont pas pu être restaurées, par exemple parce que le stockage de l'appareil est plein.
- `skipped` compte les parties d'un écrivain plus récent que ce build n'a pas reconnues. L'application l'affiche (« … · N newer items skipped »), donc une restauration dit ce qu'elle a laissé de côté.
- Avec l'historique de fichiers, le résumé ajoute `assetVersions`, `fileOperations`, `fileBatches` et `failedHistory`. Un stockage épuisé ou un conflit d'identifiant immuable peut provoquer une restauration partielle, et l'application demande alors à la personne de conserver la sauvegarde source.
- Avec l'historique de création, il ajoute `revisions` et `recoveryDrafts`, en ne comptant que ce que cet import a ajouté, et `added`, `kept`, `replaced`, `copies` et `hidden` pour la façon dont chaque création a été fusionnée. `skippedCheckpoints` compte les points de contrôle dont l'identifiant désigne un contenu différent sur la cible, et `historyLeftOut` compte les points de contrôle et brouillons plus anciens qui n'ont pas tenu dans l'espace d'historique de l'appareil.
- Un import en mode remplacement ajoute `removed` et `failedRemovals`.

La restauration n'est pas une seule transaction à travers les magasins de profil, de sessions, de ressources et d'historique. La synchronisation dans le cloud **n'avance pas** sa révision appliquée après une restauration partielle ou non prise en charge, donc la copie reste disponible pour une nouvelle tentative.

## Ce qui ne voyage pas

- **Les caches du catalogue** (métadonnées et blobs de ressources téléchargés, index des outils), que la cible resynchronise gratuitement.
- **Les outils et ressources du catalogue**, qui sont hors périmètre et supposés présents sur la cible. Les tokens de marque, polices et logos que l'utilisateur a ajoutés sont des ressources utilisateur, donc ils voyagent.
- **Les URL `blob:` et d'objet**, que le pont régénère au chargement.
- **Les originaux de conversion, les baux d'exécution actifs et les secrets d'accès ou de signature propres à la machine.** Ce ne sont pas des historiques portables. Un résultat enregistré est une copie, pas une promesse que la source d'origine a été sauvegardée.
- **Le compteur de séquence d'export**, le compteur quotidien de nommage des téléchargements dans `localStorage` (`lolly-export-seq`). Il est gardé hors de `PREF_KEYS`, donc il ne voyage jamais dans un bundle.

Le compteur de stockage montre la même répartition. Les sessions enregistrées, My images et File results & versions vont dans un bundle. Le cache des ressources, les aperçus d'outils et les épingles hors ligne en dessous peuvent tous être reconstruits, donc ils restent en arrière.

![Le compteur de stockage répartissant les données de cet appareil en catégories nommées, avec Saved sessions et My images comptés séparément du Asset cache, ici sur une installation neuve où chaque catégorie est encore vide](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

## Données d'organisation avec Lolly Work

Ce bundle sauvegarde la bibliothèque personnelle de l'appareil. Ce n'est pas une sauvegarde d'une instance **Lolly Work** : les comptes de l'organisation, les politiques d'accès, les projets partagés, les versions de catalogue, les approbations, les tâches de rendu et les enregistrements d'audit sont détenus par ce service. Reconnecte-toi et connecte-toi pour retrouver l'accès au travail partagé ; importer un bundle personnel n'accorde pas cet accès.

Les opérateurs sauvegardent, conservent et effacent les données du serveur avec les guides propres de Lolly Work : [Backup and restore](/info/work-operations.html#backup-and-restore) et [Work storage and data lifecycle](/info/work-data-lifecycle.html). Effacer ou exporter un appareil ne fait aucune de ces opérations côté serveur.

## À travers les shells

`data-transfer.ts` lit et écrit uniquement via le pont de capacités (`host.profile`, `host.state`, `host.assets`) et les préférences partagées de `localStorage`. Le même module lit et écrit l'enveloppe commune sur le web et dans les applications de bureau et mobiles, sur IndexedDB ou un stockage de système de fichiers. Les parties d'historique facultatives n'apparaissent que là où leur adaptateur est disponible, et une partie non prise en charge est signalée comme ignorée à l'import. La suite sans interface exerce les parties communes contre un pont en mémoire, et les transactions d'historique ont aussi des tests en navigateur réel.

Deux shells échappent à cette garantie, pour des raisons différentes :

- La **CLI à usage unique** n'a rien à transporter : son état est en mémoire et dure une invocation.
- La **TUI** garde l'état dans `~/.lolly` (sessions, dossiers, profil), et sa vue Profile peut le sauvegarder, mais elle écrit une archive plus simple qui lui est propre : `saved-state/<slot>.json` par session plus `profile.json` et `folders.json`, sans manifeste, sans `formatVersion` ni `minReader` et sans carte d'intégrité. Ce format ne peut pas l'importer (un lecteur la rejette comme « not a Lolly backup »), et son nom est trompeusement proche (`lolly-backup-<stamp>.zip`). Unifier les deux est une lacune connue.

## Pas encore portable

L'enveloppe est un manifeste plus des parties nommées, donc de nouveaux types de données portables peuvent la rejoindre plus tard comme parties additives (une nouvelle `formatVersion`, le même `minReader`), et les lecteurs d'aujourd'hui ignorent ce qu'ils ne reconnaissent pas. Les design systems voyagent déjà ainsi, sous la forme de `design-systems.json` plus leurs ressources utilisateur.

Deux noms sont réservés à des données qui ne voyagent pas encore :

- **`tokens.json`** porterait un document complet de design tokens [W3C DTCG](https://tr.designtokens.org/format/) avec ses groupes, ensembles et thèmes, le format que [Penpot importe et exporte](https://help.penpot.app/user-guide/design-systems/design-tokens/). Les tokens de marque propres à l'utilisateur voyagent déjà comme la ressource `user/tokens/brand` dans `assets.json`, et les tokens d'un design system voyagent avec son enregistrement.
- **`penpot/`** est réservé à un fichier Penpot ingéré, ou à son sous-ensemble utile à Lolly, présenté comme un outil.

Les lecteurs d'aujourd'hui ne connaissent encore aucun des deux noms. Comme tout ce qui est hors des parties ci-dessus, chacun est pour eux une partie inconnue : laissée telle quelle et comptée dans `skipped`.

## Parties d'historique

Les deux parties d'historique sont facultatives et ont leurs propres versions. La plupart des lecteurs peuvent sauter cette section.

::: details Historique de création (v3)
Les sauvegardes manuelles d'une installation web avec historique de création incluent `revision-history.json`, avec son propre schéma `{ version: 1, documents, revisions, recoveries }`. Il porte les identifiants conservés, les instantanés d'entrées canoniques, les marques de version, les aperçus raster et des brouillons d'écrivains séparés. L'adaptateur d'historique capture les sessions courantes et leurs têtes dans une seule transaction de lecture, et `sessions.json` utilise les mêmes instantanés courants pour les anciens lecteurs.

La restauration vérifie le SHA-256 et le nombre d'octets des charges utiles, les identités uniques, les relations entre documents et têtes, l'ascendance, les horodatages, les types d'aperçus et les limites avant de valider l'archive en une seule transaction. Les références parentes compactées peuvent manquer. Le travail courant existant n'est jamais remplacé en silence : quand une création existe des deux côtés, le côté non conservé comme courant devient un brouillon protégé.

La limite de transfert de 384 MiB de l'archive est vérifiée explicitement, et les limites de stockage sont appliquées sans tronquer les points de contrôle conservés. L'export écrit `revision-history.json` et `sessions.json` par morceaux, avec les mêmes octets qu'un seul `JSON.stringify`, donc le texte du fichier n'est jamais conservé en entier. Un fichier d'historique qui dépasserait la limite est abandonné au moment où il la dépasse et seulement compté à partir de là. L'archive est ensuite refaite sans ses points de contrôle automatiques les plus anciens, et le résumé d'export les compte comme `checkpointsLeftOut`, ou l'archive est refusée en bloc.

Un shell sans cette capacité restaure les sessions ordinaires et signale la partie d'historique comme ignorée. L'historique natif du système de fichiers reste non pris en charge tant que son adaptateur ne fournit pas de transactions d'historique durables. Les invités d'une collab privée n'ont ni historique durable ni archive de récupération.

La synchronisation d'instantanés personnels laisse de côté l'historique de création. Appliquer un instantané à un document local avec historique conserve son état de travail précédent comme brouillon de récupération séparé et invalide le jeton d'écriture de tout éditeur ouvert. Ses points de contrôle immuables restent sur l'appareil. Cela protège l'historique local pendant le remplacement par un instantané ; cela ne fusionne pas les historiques concurrents des appareils.

Les références historiques de ressources sont conservées, tandis que le rendu résout toujours les ressources via la bibliothèque existante de la destination. Cette archive ne garantit pas encore les octets exacts des anciennes ressources ni les anciens rendus d'outils. Les octets des versions de ressources et des résultats de fichiers voyagent dans leur propre partie de sauvegarde.
:::

::: details Versions enregistrées et résultats de fichiers (v2)
La partie d'historique facultative contient `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`, et les lecteurs acceptent aussi l'ancienne forme history-v1 sans lots. Chaque instantané donne l'identifiant stable de la ressource et la version exacte, son heure d'enregistrement, sa longueur en octets et son SHA-256 hexadécimal, plus un enregistrement de ressource dont `_file` et `_credentialFile` facultatif pointent vers des parties binaires. Les opérations portent les faits du fichier d'origine, la requête, le rapport, les horodatages et un `_file` de résultat facultatif. Les noms de backends de stockage, les handles OPFS et les baux d'exécution ne voyagent pas. Les lecteurs qui ne connaissent que l'history v1 refusent la nouvelle version d'historique avant d'importer, plutôt que d'abandonner en silence l'appartenance aux lots.

Les manifestes de lots consignent chaque source sélectionnée avant le traitement, y compris les fichiers jamais lus, les membres annulés, les échecs de réservation d'espace pour les résultats et le travail interrompu. Chaque membre a un identifiant d'opération stable, une référence de source et des faits, un nom de sortie demandé et un rapport final. Une source non lue a des faits déclarés, pas une empreinte inventée. L'import valide l'identité des membres et leur cohérence avec tout rapport d'opération transporté. Les rapports de lots restent disponibles quand des résultats individuels ont été supprimés, mais un reçu ne signifie pas que ses octets de sortie sont encore stockés.

- **La validation d'abord.** Chaque enregistrement d'historique connu, rapport et fichier référencé est validé avant que tout import de profil ou de ressource n'écrive. Les octets manquants et les SHA-256 qui ne correspondent pas échouent même quand l'enveloppe n'a pas de carte d'intégrité. Les credentials extraits restent des tableaux d'octets, y compris pour les imports d'anciens écrivains qui les sérialisaient comme des objets à clés numériques.
- **Le travail en cours.** Les opérations en cours deviennent des enregistrements interrompus dans la sauvegarde, avec un rapport d'échec explicatif et sans résultat. Restaurer ne relance jamais de travail en arrière-plan et n'importe jamais de bail actif. Réessayer consiste à sélectionner de nouveau le fichier d'origine, vérifié par rapport à son SHA-256 consigné quand il est disponible.
- **Le stockage.** Les résultats restaurés valident leurs octets et leurs métadonnées ensemble dans IndexedDB. Les nouveaux résultats ordinaires utilisent OPFS là où il est disponible, avec un repli sur IndexedDB. Une opération active existante n'est jamais remplacée par un import.
- **Les limites de sauvegarde.** L'export transmet ces octets en flux dans l'archive, mais la restauration décompresse toujours une sauvegarde entière en mémoire, donc les limites restent : **256 MiB de charge utile d'historique**, **4 MiB de métadonnées d'historique**, au plus **100 opérations**, **100 lots** et **2 000 instantanés**. L'export refuse explicitement un historique trop gros ou incomplet et ne le laisse jamais de côté en silence. Télécharge une par une les versions et résultats importants avant de supprimer d'anciennes copies locales. Ces limites ne sont pas une garantie de pic de mémoire mesuré pour les téléphones.
- **Les budgets locaux.** L'historique local des résultats a un budget de 512 MiB et un plafond de 100 enregistrements. Les instantanés de ressources ont un budget séparé de 512 MiB et au plus 20 versions historiques par ressource, et les octets de credentials extraits comptent dans ce budget. La restauration respecte ces limites et n'évince jamais en silence des données d'utilisateur existantes.
- **Les métadonnées de lots.** Les métadonnées locales de lots ont un budget séparé de 4 MiB, au plus 100 manifestes et 20 membres par lot. Les membres en attente réservent de la capacité de métadonnées, avec un plafond de rapport de 32 KiB par membre. C'est un budget logique, pas une garantie d'espace disque du navigateur : un vrai échec de quota est affiché, et le rapport en mémoire reste téléchargeable. Réessayer un membre de lot crée un nouveau lot sans écraser l'ancien rapport. Supprimer un enregistrement de lot ne supprime ni les octets des résultats individuels ni les ressources de la bibliothèque.
- **Les résultats dans la bibliothèque.** Les résultats convertis peuvent être ajoutés à la bibliothèque sans normalisation ni réencodage, avec les empreintes de source et de sortie et la relation d'opération jointes. Les ajouts répétés réutilisent une copie inchangée, et une copie modifiée n'est jamais écrasée. Les images raster peuvent démarrer un nouveau document Design, qui utilise l'identifiant courant de la ressource de la bibliothèque ; appliquer des épingles de version exactes dans tout le runtime de Design et le chemin d'URL est un travail distinct. Les résultats SVG, HTML, PDF et ZIP sont conservés comme ressources fichier opaques, non promues en contenu interactif ou vectoriel de confiance.
- **Où les gens voient cela.** **Convert → Recent file operations** montre l'usage de l'historique, les rapports, les téléchargements et le gestionnaire de versions, qui retrouve aussi les versions antérieures de ressources supprimées de la bibliothèque. Restaurer un instantané crée une nouvelle version courante et conserve l'instantané sélectionné. **Settings → Preferences → Storage** compte les résultats et les versions séparément des caches jetables.
- **Le nettoyage.** Le nettoyage explicite des fichiers temporaires ne supprime que les octets appartenant à une opération et non référencés. Les enregistrements courants protègent leurs fichiers, et les fichiers OPFS récents ont un délai de grâce d'une heure. Les résultats enregistrés et les instantanés de ressources ne sont pas effacés automatiquement.

Les anciens lecteurs acceptent toujours l'enveloppe v2 (`minReader: 1`) et restaurent les parties qu'ils connaissent, en comptant les parties d'historique non prises en charge comme ignorées. La récupération complète de l'historique exige un shell avec l'adaptateur `fileHistory`, une couture à l'intérieur du shell plutôt qu'une nouvelle capacité `HostV1` tournée vers les outils. La vraie restauration sur deux appareils est couverte par le test local Chromium ; la récupération sur les applications de bureau, iOS et Android installées reste à valider séparément.
:::

## Référence

- Module : `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` ; le nommeur `backupFilename()` est interne).
- Test de contrat : `tests/data-transfer.test.ts`, couvrant l'aller-retour, la fusion, l'intégrité, la compatibilité ascendante et la barrière de lecteur.
- Tests de contrat de l'historique : `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts` et `tests/file-result-library.test.ts`. Validation en navigateur : `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts` et `tests/file-result-reuse.browser.test.ts`.
- Surface du pont utilisée : `host.profile`, `host.state` et `host.assets` ; voir [Host API](/info/host-api.html).
