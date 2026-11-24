# Transfert de données : l'archive `lolly-backup`

Une archive de sauvegarde déplace la bibliothèque personnelle que Lolly garde sur l'appareil : exporte-la sur une installation, transporte le fichier (USB, AirDrop, e-mail à toi-même ou partage réseau) et importe-le sur une autre. L'export et l'import n'ont besoin d'aucun serveur, et la cible peut être hors ligne.

Voici la spécification du format pour les personnes qui créent des applications hôtes, des outils ou des scripts autour des sauvegardes. Pour déplacer ton propre travail, lis [Déplacer ton travail vers un autre appareil](/info/find-your-work.html#move-your-work-to-another-device).

![Les deux boutons qui déplacent toute une installation : Export my data écrit un zip, Import data le relit](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

::: note Portée
Une archive transporte les *données utilisateur*, pas les outils du catalogue. Les outils et les ressources du catalogue se synchronisent séparément et sont supposés présents sur la cible, au pire dans une version plus récente. Les outils créés par l'utilisateur voyagent dans `profile.json`. Un import n'installe jamais d'outil du catalogue et n'en met jamais à niveau.
:::

<!--i:eti-badge-check-->
## Objectifs

- <!--i:box--> **Un format pour toutes les applications hôtes.** L'application web, les applications de bureau et mobiles et les futures applications hôtes partagent la même enveloppe et les mêmes schémas de parties. Les parties facultatives dépendent des capacités de chaque application hôte, et les parties non prises en charge sont signalées. Chaque passerelle de capacités fournit son adaptateur de stockage.
- <!--i:shieldcheck--> **Résiste au transport.** Une archive endommagée ou tronquée pendant le transfert échoue à l'import avec une erreur et ne se restaure jamais à moitié.
- <!--i:clock--> **Dure au-delà de cette version.** Une application plus ancienne importe les parties d'une archive plus récente qu'elle reconnaît. Un format incompatible est refusé proprement.
- <!--i:check--> **Fusion sans risque.** Un import sur une installation déjà utilisée n'efface jamais ce qui ne figurait pas dans l'archive.

<!--i:eti-package-->
## L'enveloppe

Une archive est un simple `.zip`. Elle reste intacte quel que soit le moyen de transport, et tout outil de décompression peut inspecter son contenu.

Le téléchargement porte le nom de son propriétaire : `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, par exemple `LollyTools-Ada-Lovelace-2026-06-26-1.zip`. Le prénom et le nom viennent du profil et sont omis s'ils ne sont pas renseignés : sans profil, on obtient `LollyTools-2026-06-26-1.zip`, et avec un prénom seul, `LollyTools-Ada-2026-06-26-1.zip`. Chaque nom devient un token utilisable dans un nom de fichier (lettres Unicode et chiffres conservés, espaces et ponctuation supprimés, 32 caractères au maximum). `<n>` est une séquence par jour et par appareil, donc les exports répétés dans une journée ne créent pas de collisions et restent dans l'ordre. `backupFilename()` dans `data-transfer.ts` construit le nom. Le nom ne change pas le contenu du zip.

| Chemin | Obligatoire | Contenu |
|---|---|---|
| `manifest.json` | oui | Identifiant du format, versions, décomptes et intégrité par partie. Un lecteur lit ce fichier en premier. |
| `profile.json` | si renseigné | L'enregistrement `me` de l'utilisateur : nom, contact, référence du portrait et indicateurs, ainsi que les dossiers, Trash, les plans de projet, les modèles utilisateur et les outils créés par l'utilisateur, les favoris, les outils masqués, la langue et le choix d'emoji. Lu via `host.profile`. |
| `sessions.json` | oui | Chaque session enregistrée : emplacement, identifiant et version de l'outil, libellé, miniature (URL de données) et données d'entrée complètes. Lu via `host.state`. |
| `assets.json` | oui | Métadonnées de chaque ressource importée (images, polices, tokens de marque, logos, copies enregistrées de téléchargements), chacune pointant vers ses octets sous `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | par ressource | Les octets bruts de la ressource, stockés sans compression car la plupart sont déjà dans des formats compressés. L'extension est purement indicative ; le type MIME dans `assets.json` fait autorité. |
| `assets/blobs/<n>.c2pa` | si présent | Les Content Credentials extraits sous forme d'octets binaires exacts, référencés par `_credentialFile` dans l'enregistrement de la ressource. Ce ne sont pas des clés de signature de l'appareil. |
| `design-systems.json` | si présent | Les design systems créés ou ajoutés sur cette installation, sous la forme `{ active, records }`. Voir [Règles d'import](#import-rules). |
| `file-history.json` | facultatif | Instantanés de ressources versionnés, rapports d'opérations sur fichiers terminées et manifestes de lots complets, avec une version propre. Fourni par l'adaptateur de sauvegarde interne `fileHistory` de l'application hôte. |
| `revision-history.json` | facultatif, sauvegardes manuelles | Identifiants stables des créations, points de contrôle conservés, miniatures et brouillons de récupération glissants. Fourni par `host.state.history.backup` là où il est pris en charge. |
| `file-history/versions/` | par instantané | Octets antérieurs des ressources et attestations extraites, que la ressource actuelle existe encore ou non. |
| `file-history/results/` | par opération terminée | Octets de sortie exacts. Aucun fichier original sélectionné pour une conversion n'est conservé ni inclus. |
| `prefs.json` | oui | Préférences locales de l'utilisateur : `theme`, `sidebarWidth` et le compteur d'activité `ct-metrics`. |
| `lolly.txt` | oui | Un résumé lisible de l'archive (décomptes, profil, nom de fichier) pour quiconque ouvre le zip sans Lolly. Régénéré à chaque export et reconnu à l'import, donc jamais compté comme une partie ignorée. Il est écrit après la table d'intégrité, donc cette table ne couvre pas ce fichier. |

::: details Comment l'export écrit le zip
L'export écrit le zip une partie à la fois (`shells/web/src/lib/zip-stream.ts`). Les fichiers importés, les résultats enregistrés et les versions enregistrées des ressources sont lus par tranches de 4 Mio, jamais en entier. Les résultats et les versions enregistrés sont d'abord vérifiés par rapport à leur SHA-256 consigné. Chaque fichier est ensuite lu pour sa somme de contrôle et son empreinte d'intégrité, et le zip référence le fichier en place.

Rien n'est réencodé. Chaque partie garde ses octets et son empreinte exacts, donc un fichier contenant des Content Credentials garde les octets couverts par sa signature. Pour les mêmes parties et le même horodatage, le zip est identique à celui de l'ancien module d'écriture en mémoire, sauf qu'un fichier d'historique de plus de 16 Mio est compressé par morceaux. `tests/backup-streaming.test.ts` le vérifie par rapport aux empreintes de référence consignées.

Sur une bibliothèque synthétique de 192 Mio, mesurée dans Node, la finalisation de la sauvegarde a demandé environ 125 à 150 Mio en plus de la bibliothèque, contre environ 850 Mio pour le module d'écriture en mémoire (`node scripts/bench-backup-finalise.ts`). L'import lit toujours le zip entier en mémoire.
:::

<!--i:eti-file-->
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
| `format` | Toujours `lolly-backup`. Un fichier sans ce champ est rejeté comme « n'étant pas une sauvegarde Lolly ». |
| `formatVersion` | La structure avec laquelle cette archive a été **écrite**. Incrémenté à chaque modification de l'ensemble des parties ou de leurs structures. Les lecteurs ne se basent **pas** sur ce champ pour autoriser l'import. |
| `minReader` | La version minimale du lecteur capable d'importer cette archive **sans risque**. C'est le champ sur lequel les lecteurs se basent pour autoriser l'import. |
| `app` | Identifiant de l'application productrice, pour les diagnostics. |
| `exportedAt` | Horodatage ISO de création de l'archive. |
| `counts` | Ce que le module d'écriture a inclus, pour l'affichage et les contrôles de cohérence. |
| `integrity` | Facultatif. Associe chaque partie sauf `manifest.json` à une empreinte `sha256-<base64>` de type SRI de ses octets **non compressés**. |

<!--i:eti-tag-->
## Politique de version

Deux numéros de version permettent au format d'évoluer sans bloquer les installations plus anciennes.

![Une modification du format de l'archive est soit additive, ce que les anciens lecteurs peuvent ignorer, soit incompatible, auquel cas un mauvais import corrompt les données. Une modification additive incrémente formatVersion et conserve minReader ; une modification incompatible incrémente formatVersion et augmente minReader. Un lecteur importe quand minReader est inférieur ou égal à sa propre version.](/info/diagrams/concepts/backup-version-gate.svg)

- Un lecteur importe une archive quand `manifest.minReader` est inférieur ou égal à sa propre version de lecteur. Il ne refuse avec « nécessite une version plus récente de l'application » que si l'archive exige un lecteur plus récent.
- Une modification **additive**, comme une nouvelle partie facultative ou un nouveau champ facultatif du manifeste, incrémente `formatVersion` et laisse `minReader` inchangé. Les anciennes applications importent toujours chaque partie qu'elles reconnaissent, et les parties qu'elles ne reconnaissent pas sont signalées comme ignorées, sans être écartées silencieusement.
- Une modification **incompatible**, où le mauvais import d'une partie corrompt les données ou une partie facultative devient obligatoire, augmente `minReader`. Les anciennes applications refusent alors proprement au lieu d'importer quelque chose qu'elles ne savent pas gérer. Les anciennes applications refusent alors proprement l'archive.
- Si une future archive définit `formatVersion` mais omet `minReader`, les lecteurs se replient sur `formatVersion` pour autoriser l'import et traitent la modification comme incompatible.

::: note Règle pratique pour les auteurs
Si chaque lecteur existant continuerait à fonctionner correctement en ignorant ton ajout, la modification est additive : incrémente `formatVersion` et laisse `minReader`. Sinon, augmente `minReader`.
:::

<!--i:eti-shield-check-->
## Intégrité

Quand `manifest.integrity` est présent, un lecteur vérifie le SHA-256 de chaque partie listée **avant toute écriture**. Une différence (« échec de la vérification d'intégrité ») ou une partie manquante (« incomplet ») arrête l'import, donc aucune restauration partielle n'a lieu. Cela détecte les dommages de transport : un AirDrop tronqué, une passerelle e-mail qui a réencodé la pièce jointe, un secteur USB défectueux.

L'intégrité est assurée dans la mesure du possible. Elle n'est écrite que là où Web Crypto est disponible (tout contexte de navigateur sécurisé et les versions modernes de Node), et vérifiée que si la table et Web Crypto sont tous deux présents. Une archive sans cette table, comme une archive datant d'avant la prise en charge de l'intégrité, s'importe sans changement : « impossible à vérifier » ne signifie jamais « corrompu ».

Le manifeste ne liste ni lui-même ni le fichier `lolly.txt` régénéré.

<!--i:eti-download-->
## Règles d'import

Un import s'exécute dans l'un de deux modes.

- **Merge** est le mode utilisé par **Import data…** et la première connexion à la synchronisation, **Bring it to this device**. Les données de la cible restent, et rien en dehors de l'archive n'est touché.
- **Replace** est le mode utilisé par la synchronisation des appareils pour les garder à jour les uns par rapport aux autres. Il prend l'enregistrement de profil, les préférences, les sessions, les images et le choix du design system actif de la copie synchronisée. Il ne supprime que les éléments qu'un autre appareil a supprimés depuis la dernière synchronisation. Restaurer une copie antérieure sauvegarde d'abord l'appareil, puis le fait correspondre à cette copie et supprime tout ce qu'elle ne contient pas. [Synchroniser tes appareils](/info/sync.html) décrit ce que voit l'utilisateur.

Une fusion traite chaque type de données comme suit :

| Données | Déjà sur la cible | Uniquement dans l'archive |
|---|---|---|
| Sessions (par emplacement) et images importées (par identifiant) | La copie enregistrée le plus récemment est conservée, donc une ancienne sauvegarde n'écrase jamais du travail plus récent. Si les dates sont égales ou inconnues, la copie de la cible est conservée. | Ajoutées |
| Dossiers | Le nom et le parent de la cible sont conservés, et le dossier reçoit les membres de l'archive qui lui manquent. Une session classée dans un dossier sur la cible y reste. | Ajoutés |
| Favoris (outils, ressources du catalogue et éléments Projects) | Réunis | Ajoutés |
| Modèles, modèles Projects et outils utilisateur (par identifiant) | L'enregistrement de la cible est conservé. | Ajoutés |
| Entrées de Trash | L'entrée de la cible est conservée. | Ajoutées, pour qu'un élément restaurable sur l'une ou l'autre installation le reste. Une entrée dont le dossier est à nouveau utilisé sur la cible, ou dont la cible utilise déjà l'emplacement dans Trash, est omise. |
| Autres champs du profil (nom, coordonnées, langue, indicateurs de fonctionnalités, outils masqués et autres réglages) | La valeur de la cible est conservée. | Repris là où le champ de la cible est vide |
| Préférences (`prefs.json`) | La valeur de la cible est conservée. | Écrites là où la cible n'en a pas |
| Design systems (par identifiant) | L'enregistrement de l'archive remplace celui de la cible. | Ajoutés. Le choix actif de l'archive ne s'applique que si la cible n'a pas son propre design system. |
| Historique des créations | La copie enregistrée le plus récemment reste la version actuelle, et l'autre est conservée comme brouillon protégé. | Ajouté |

**Les sessions enregistrées se relient automatiquement à leurs images.** Les références aux ressources sont conservées par identifiant. La passerelle les résout à nouveau après la restauration des images, car les URL `blob:` ne survivent pas à un rechargement.

**Les enregistrements d'historique ne changent jamais après leur écriture.** Réimporter des versions de ressources et des identifiants d'opérations n'ajoute rien, et un identifiant qui désigne déjà des octets ou un historique différents est refusé, pas écrasé. Réimporter une ressource actuelle identique conserve sa version, et une ressource actuelle modifiée doit porter une version différente.

**L'historique des créations a quelques règles supplémentaires.** Une création dont la cible utilise l'emplacement pour une autre création est ajoutée comme création distincte, et une création dans Trash sur la cible y reste. Un identifiant de point de contrôle qui désigne un contenu différent sur la cible conserve celui de la cible. Une archive qui échoue à ses propres vérifications arrête l'import avant toute modification de profil, session, ressource ou préférence, et un réimport identique ne prend aucun espace de stockage supplémentaire.

**Le résumé rapporte ce qui s'est passé.** Chaque import renvoie `profile`, `sessions`, `userAssets`, `prefs`, `skipped` et `failedAssets`.

- `failedAssets` compte les ressources importées qui n'ont pas pu être restaurées, par exemple parce que le stockage de l'appareil est plein.
- `skipped` compte les parties d'un module d'écriture plus récent que cette version n'a pas reconnues. L'application affiche le nombre (« … · N éléments plus récents ignorés »).
- Avec l'historique des fichiers, le résumé ajoute `assetVersions`, `fileOperations`, `fileBatches` et `failedHistory`. Un stockage saturé ou un conflit d'identifiant immuable peut causer une restauration partielle, et l'application indique alors à la personne de conserver la sauvegarde source.
- Avec l'historique des créations, il ajoute `revisions` et `recoveryDrafts`, en ne comptant que ce que cet import a ajouté, ainsi que `added`, `kept`, `replaced`, `copies` et `hidden` pour indiquer comment chaque création a été fusionnée. `skippedCheckpoints` compte les points de contrôle dont l'identifiant désigne un contenu différent sur la cible, et `historyLeftOut` compte les anciens points de contrôle et brouillons qui n'ont pas trouvé de place dans l'espace d'historique de l'appareil.
- Un import en mode remplacement ajoute `removed` et `failedRemovals`.

La restauration n'est pas une transaction unique couvrant les stockages du profil, des sessions, des ressources et de l'historique. La synchronisation cloud ne fait **pas** avancer sa révision appliquée après une restauration partielle ou non prise en charge, donc la copie reste disponible pour réessayer.

<!--i:eti-unlink-->
## Ce qui ne voyage pas

- **Les caches du catalogue** (métadonnées et données binaires des ressources téléchargées, index des outils), que la cible resynchronise.
- **Les outils et ressources du catalogue**, supposés présents sur la cible. Les tokens de marque, polices et logos ajoutés par l'utilisateur sont des ressources utilisateur et voyagent bien.
- **Les URL `blob:` et d'objets**, que le pont régénère au chargement.
- **Les originaux de conversion, les baux d'exécution actifs et les secrets d'accès ou de signature locaux à la machine.** Ils ne constituent pas un historique portable. Un résultat enregistré est une copie. Cela ne signifie pas que la source originale a été sauvegardée.
- **Le compteur de séquence d'export**, le compteur quotidien de nommage des téléchargements dans `localStorage` (`lolly-export-seq`). Il reste en dehors de `PREF_KEYS`, donc il ne voyage jamais dans une archive.

L'indicateur de stockage montre la même répartition. Saved sessions, My images et File results & versions sont inclus dans une archive. Le cache des ressources, les aperçus d'outils et les éléments épinglés hors ligne peuvent être reconstruits et restent sur place.

![L'indicateur de stockage répartit les données de cet appareil en catégories nommées, avec Saved sessions et My images suivis séparément de l'Asset cache, ici sur une nouvelle installation où toutes les catégories sont encore vides](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

<!--i:eti-building-->
## Données de l'organisation avec Lolly Work

Cette archive sauvegarde la bibliothèque personnelle de l'appareil. Une archive n'est pas une sauvegarde d'une instance **Lolly Work**. Les comptes de l'organisation, les politiques d'accès, les projets partagés, les versions du catalogue, les approbations, les tâches de rendu et les enregistrements d'audit sont conservés par ce service. Reconnecte-toi au service et identifie-toi pour retrouver l'accès au travail partagé. Importer une archive personnelle n'accorde pas cet accès.

Les opérateurs sauvegardent, conservent et effacent les données du serveur avec les guides propres à Lolly Work : [Sauvegarde et restauration](/info/work-operations.html#backup-and-restore) et [Stockage et cycle de vie des données de Lolly Work](/info/work-data-lifecycle.html). Effacer ou exporter les données d'un appareil n'effectue aucune de ces opérations sur le serveur.

<!--i:eti-monitor-->
## D'une interface hôte à l'autre

`data-transfer.ts` lit et écrit uniquement via le pont de capacités (`host.profile`, `host.state`, `host.assets`) et les préférences partagées de `localStorage`. Le même module lit et écrit l'enveloppe commune sur le web et dans les applications de bureau et mobiles, avec un stockage IndexedDB ou dans le système de fichiers. Les parties facultatives de l'historique n'apparaissent que là où leur adaptateur est disponible. L'import signale une partie non prise en charge comme ignorée. La suite de tests sans interface graphique exerce les parties communes via un pont en mémoire, et les transactions de l'historique ont aussi des tests dans un vrai navigateur.

Deux interfaces hôtes sortent de cette garantie :

- La **CLI à exécution unique** n'a rien à transférer : son état est en mémoire et ne dure qu'une invocation.
- La **TUI** conserve son état dans `~/.lolly` (sessions, dossiers, profil). Sa vue Profile écrit sa propre archive de sauvegarde, plus simple : `saved-state/<slot>.json` par session, plus `profile.json` et `folders.json`, sans manifeste, sans `formatVersion` ni `minReader` et sans table d'intégrité. Un lecteur de ce format rejette cette archive comme « pas une sauvegarde Lolly », même si les noms sont similaires (`lolly-backup-<stamp>.zip`). L'unification des deux reste un point à résoudre connu.

<!--i:eti-clock-->
## Pas encore portable

De nouveaux types de données portables pourront être ajoutés plus tard sous forme de parties supplémentaires (un nouveau `formatVersion`, le même `minReader`). Les design systems voyagent déjà ainsi, sous forme de `design-systems.json` accompagné de leurs ressources utilisateur.

Deux noms sont réservés à des données qui ne voyagent pas encore :

- **`tokens.json`** contiendrait un document de design tokens [W3C DTCG](https://tr.designtokens.org/format/) avec ses groupes, ensembles et thèmes, le format que [Penpot importe et exporte](https://help.penpot.app/user-guide/design-systems/design-tokens/). Les tokens de marque propres à l'utilisateur voyagent déjà sous forme de ressource `user/tokens/brand` dans `assets.json`, et les tokens d'un design system voyagent avec son enregistrement.
- **`penpot/`** est réservé à un fichier Penpot ingéré, ou à son sous-ensemble pertinent pour Lolly, présenté comme un outil.

<!--i:eti-history-->
## Parties de l'historique

Les deux parties de l'historique sont facultatives et ont leurs propres versions.

::: details Historique de création (v3)
Les sauvegardes manuelles d'une installation web avec historique de création incluent `revision-history.json`, avec son propre schéma `{ version: 1, documents, revisions, recoveries }`. Il contient les identifiants conservés, les instantanés canoniques des entrées, les marqueurs de version, les aperçus raster et les brouillons distincts des éditeurs. L'adaptateur d'historique capture les sessions actuelles et leurs révisions de tête dans une seule transaction de lecture, et `sessions.json` utilise les mêmes instantanés actuels pour les lecteurs plus anciens.

La restauration vérifie le SHA-256 et le nombre d'octets des données, l'unicité des identifiants, les relations entre documents et révisions de tête, l'ascendance, les horodatages, les types d'aperçus et les limites avant de valider l'archive en une seule transaction. Des références parentes compactées peuvent manquer. Le travail courant existant n'est jamais remplacé silencieusement : quand une création existe des deux côtés, le côté qui ne reste pas courant devient un brouillon protégé.

L'archive a une limite de transfert de 384 MiB. Les limites de stockage sont appliquées sans tronquer les points de contrôle conservés. L'export écrit `revision-history.json` et `sessions.json` par morceaux, avec les mêmes octets que produirait un seul `JSON.stringify`, donc le texte du fichier n'est jamais conservé en entier. Un fichier d'historique qui dépasserait la limite est abandonné dès qu'il la franchit, et seuls ses octets sont comptés à partir de là. L'archive est ensuite recréée sans ses points de contrôle automatiques les plus anciens, que le résumé d'export compte dans `checkpointsLeftOut`, ou l'archive est refusée.

Une interface hôte sans cette capacité restaure les sessions ordinaires et signale la partie historique comme ignorée. L'historique natif dans le système de fichiers reste non pris en charge tant que son adaptateur ne fournit pas de transactions d'historique durables. Les invités d'une collaboration privée n'ont ni historique durable ni archive de récupération.

La synchronisation des instantanés personnels exclut l'historique de création. Appliquer un instantané à un document local avec historique conserve son état de travail précédent comme brouillon de récupération distinct et invalide le jeton d'écriture de tout éditeur ouvert. Ses points de contrôle immuables restent sur l'appareil. Cela protège l'historique local lors du remplacement par un instantané. Cela ne fusionne pas les historiques concurrents de plusieurs appareils.

Les références aux ressources historiques sont conservées, mais le rendu résout toujours les ressources via la bibliothèque existante de la destination. Cette archive ne garantit pas encore les octets exacts des anciennes ressources ni les anciens rendus des outils. Les octets des versions de ressources et des résultats de fichiers voyagent dans leur propre partie de la sauvegarde.
:::

::: details Versions enregistrées et résultats de fichiers (v2)
La partie historique facultative contient `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`, et les lecteurs acceptent aussi l'ancienne structure history-v1 sans lots. Chaque instantané donne l'identifiant stable de la ressource et sa version exacte, son heure d'enregistrement, sa longueur en octets et son SHA-256 hexadécimal, plus un enregistrement de ressource dont `_file` et le champ facultatif `_credentialFile` pointent vers des parties binaires. Les opérations contiennent les informations sur le fichier original, la requête, le rapport, les horodatages et un résultat `_file` facultatif. Les noms des systèmes de stockage, les handles OPFS et les baux d'exécution ne voyagent pas. Les lecteurs qui ne connaissent que l'historique v1 refusent la nouvelle version de l'historique avant l'import, donc l'appartenance à un lot n'est jamais perdue silencieusement.

Les manifestes de lots enregistrent chaque source sélectionnée avant le traitement, y compris les fichiers jamais lus, les éléments annulés, les échecs de réservation d'espace pour les résultats et le travail interrompu. Chaque élément a un identifiant d'opération stable, une référence à la source et ses informations, le nom de sortie demandé et un rapport final. Une source non lue a des informations déclarées, pas une empreinte inventée. L'import valide l'identité de l'élément et sa cohérence avec tout rapport d'opération inclus. Les rapports Lolly Batch restent disponibles quand des résultats individuels ont été supprimés, mais un reçu ne signifie pas que les octets du résultat sont encore stockés.

- **Valider d'abord.** Chaque enregistrement d'historique connu, rapport et fichier référencé est validé avant toute écriture d'import de profil ou de ressource. Des octets manquants et des SHA-256 différents font échouer l'import même quand l'enveloppe n'a pas de table d'intégrité. Les justificatifs extraits restent des tableaux d'octets, y compris ceux importés d'anciens producteurs qui les sérialisaient en objets à clés numériques.
- **Travail en cours.** Les opérations en cours deviennent des enregistrements interrompus dans la sauvegarde, avec un rapport d'échec et sans résultat. La restauration ne relance jamais de travail en arrière-plan et n'importe pas de bail actif. Réessayer demande de sélectionner à nouveau le fichier original, vérifié par rapport à son SHA-256 enregistré quand il est disponible.
- **Stockage.** Les résultats restaurés valident leurs octets et leurs métadonnées ensemble dans IndexedDB. Les nouveaux résultats ordinaires utilisent OPFS quand il est disponible, avec IndexedDB en repli. Une opération active existante n'est jamais remplacée par un import.
- **Limites de sauvegarde.** L'export transmet ces octets en flux dans l'archive, mais la restauration décompresse encore une sauvegarde entière en mémoire, donc les limites restent : **256 MiB de données d'historique**, **4 MiB de métadonnées d'historique**, au plus **100 opérations**, **100 lots** et **2 000 instantanés**. L'export refuse explicitement un historique trop volumineux ou incomplet et ne l'omet jamais silencieusement. Télécharge les versions et résultats importants un par un avant de supprimer d'anciennes copies locales. Ces limites ne constituent pas une garantie mesurée de pic de mémoire pour les téléphones.
- **Budgets locaux.** L'historique local des résultats a un budget de 512 MiB et un plafond de 100 enregistrements. Les instantanés de ressources ont un budget distinct de 512 MiB et au plus 20 versions historiques par ressource, et les octets des justificatifs extraits comptent dans ce budget. La restauration respecte ces limites et n'évince jamais silencieusement des données utilisateur existantes.
- **Métadonnées des lots.** Les métadonnées locales des lots ont un budget distinct de 4 MiB, au plus 100 manifestes et 20 éléments par lot. Les éléments en attente réservent de la capacité pour les métadonnées, avec un plafond de 32 KiB par rapport d'élément. C'est un budget logique, pas une garantie d'espace disque du navigateur : un véritable échec de quota est affiché, et le rapport en mémoire reste téléchargeable. Réessayer un élément de lot crée un nouveau lot sans écraser l'ancien rapport. Supprimer un enregistrement de lot ne supprime pas les octets des résultats individuels ni les ressources de la bibliothèque.
- **Résultats dans la bibliothèque.** Les résultats convertis peuvent être ajoutés à la bibliothèque sans normalisation ni réencodage, avec les empreintes de la source et de la sortie et la relation avec l'opération attachées. Les ajouts répétés réutilisent une copie inchangée, et une copie modifiée n'est jamais écrasée. Les images raster peuvent démarrer un nouveau document Lolly Design, qui utilise l'identifiant actuel de la ressource dans la bibliothèque. Imposer des versions exactes dans tout le moteur d'exécution de Lolly Design et son parcours URL est un travail distinct. Les résultats SVG, HTML, PDF et ZIP sont conservés comme des ressources fichiers opaques, sans devenir du contenu interactif ou vectoriel de confiance.
- **Où voir tout cela.** **Convert → Recent file operations** affiche l'utilisation de l'historique, les rapports, les téléchargements et le gestionnaire de versions, qui retrouve aussi les versions antérieures de ressources supprimées de la bibliothèque. Restaurer un instantané crée une nouvelle version courante et conserve l'instantané sélectionné. **Settings → Preferences → Storage** compte les résultats et versions séparément des caches jetables.
- **Nettoyage.** Le nettoyage explicite des fichiers temporaires ne supprime que les octets non référencés appartenant aux opérations. Les enregistrements courants protègent leurs fichiers, et les fichiers OPFS récents ont un délai de grâce d'une heure. Les résultats enregistrés et les instantanés de ressources ne sont pas effacés automatiquement.

Les lecteurs plus anciens acceptent toujours l'enveloppe v2 (`minReader: 1`) et restaurent les parties qu'ils connaissent, en comptant les parties d'historique non prises en charge comme ignorées. La récupération complète de l'historique demande une interface hôte avec l'adaptateur `fileHistory`, un point d'intégration interne à l'interface hôte, pas une capacité `HostV1` exposée aux outils. Une véritable restauration entre deux appareils est couverte par la validation locale sous Chromium. La récupération sur les applications installées de bureau, iOS et Android doit encore être validée séparément.
:::

<!--i:eti-code-->
## Référence

- Module : `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` ; la fonction de nommage `backupFilename()` est interne).
- Test de contrat : `tests/data-transfer.test.ts`, qui couvre l'aller-retour, la fusion, l'intégrité, la compatibilité avec les versions futures et le contrôle de version du lecteur.
- Tests de contrat de l'historique : `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts` et `tests/file-result-library.test.ts`. Validation dans le navigateur : `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts` et `tests/file-result-reuse.browser.test.ts`.
- Interface du pont utilisée : `host.profile`, `host.state` et `host.assets` ; voir [API hôte](/info/host-api.html).
