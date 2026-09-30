# Transfert de données - le bundle `lolly-backup`

Tout ce qu'un utilisateur de Lolly accumule vit **sur son appareil** - pas de compte, pas de cloud. Le bundle de transfert de données est la façon dont cette valeur se déplace : exporte-le depuis une installation, transporte le fichier par n'importe quel moyen (USB, AirDrop, e-mail à soi-même, un partage réseau) et importe-le sur une autre. Le fichier *est* le transport. La cible peut être hors ligne ou en ligne. Cela ne fait aucune différence, car rien ne parle jamais à un serveur.

![Les deux boutons qui déplacent toute une installation : Export my data écrit un zip, Import data le relit](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

Cette page est la spécification du format. Pour le guide utilisateur final, voir [Retrouver et récupérer ton travail → Transférer ton travail vers un autre appareil](/info/find-your-work.html#move-your-work-to-another-device). L'implémentation se trouve dans [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts), et [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) fixe le contrat d'aller-retour.

> **Portée.** Un bundle porte des *données utilisateur*, pas des outils du catalogue. Les outils du catalogue et les assets du catalogue sont synchronisés séparément et sont supposés déjà présents sur la cible (dans le pire cas à une version plus récente) ; les outils qu'un utilisateur a lui-même créés voyagent à l'intérieur de `profile.json`. L'import n'installe ni ne met jamais à niveau un outil du catalogue.

## Objectifs

- <!--i:box--> **Un format, tous les shells.** La PWA web, les applications Tauri desktop/mobile et les futurs shells partagent la même enveloppe et les mêmes schémas de parties prises en charge. Les parties optionnelles dépendent des capacités de chaque shell ; les parties non prises en charge sont signalées. Chaque pont de capacités fournit son propre adaptateur de stockage.
- <!--i:shieldcheck--> **Survit au trajet.** Un bundle corrompu ou tronqué en transit échoue bruyamment à l'import, jamais de restauration partielle.
- <!--i:clock--> **Survit à cette version.** Une application plus ancienne peut quand même importer les parties reconnues d'un bundle plus récent. Un format réellement incompatible est refusé proprement.
- <!--i:check--> **Sûr à fusionner.** Importer sur une installation déjà en usage n'efface jamais ce qui n'était pas dans le bundle.

## L'enveloppe

Un bundle est un simple `.zip`. Le téléchargement porte le nom de la personne à qui il appartient - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (par exemple `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - pour qu'un dossier Téléchargements plein de sauvegardes reste lisible. Les parties prénom et nom viennent du profil et sont omises quand elles ne sont pas définies. Sans profil, on obtient `LollyTools-2026-06-26-1.zip`, et un simple prénom donne `LollyTools-Ada-2026-06-26-1.zip`. Chaque partie est nettoyée en un jeton sûr pour un nom de fichier (lettres/chiffres Unicode conservés, espaces/ponctuation retirés, plafonné à 32 caractères). `<n>` est une séquence par jour et par appareil, pour que des exports répétés le même jour ne se percutent pas et restent dans l'ordre. `backupFilename()` dans [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) construit le nom. Le contenu du zip est identique quel que soit le nom. À l'intérieur :

| Chemin | Requis | Contenu |
|---|---|---|
| `manifest.json` | oui | Id de format, versions, compteurs et intégrité par partie. La première chose qu'un lecteur consulte. |
| `profile.json` | si défini | La fiche `me` complète de l'utilisateur : nom, contact, référence de portrait et indicateurs, plus dossiers, Corbeille, modèles de projet, modèles utilisateur et outils créés par l'utilisateur, favoris, outils masqués, choix de langue et d'emoji. Lue via `host.profile`. |
| `sessions.json` | oui | Chaque session enregistrée : emplacement, id/version de l'outil, libellé, vignette (data-URL) et données d'entrée complètes. Lue via `host.state`. |
| `assets.json` | oui | Métadonnées de chaque asset téléversé (images, polices, tokens de marque, logos, copies enregistrées de téléchargements), chacune pointant vers ses octets sous `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | par asset | Les octets bruts de l'asset (fichiers image et police). Stockés non compressés (formats déjà compressés). L'extension est cosmétique. Le MIME dans `assets.json` fait foi. |
| `assets/blobs/<n>.c2pa` | si présent | Content Credentials extraits comme octets binaires exacts, référencés par `_credentialFile` dans la fiche de l'asset. Ce ne sont pas des clés de signature de l'appareil. |
| `design-systems.json` | si présent | Les systèmes de design créés ou ajoutés sur cette installation, sous la forme `{ active, records }`. Fusionnés par id à l'import ; le choix actif du bundle ne s'applique que si la cible n'a pas de système de design propre. |
| `file-history.json` | optionnel | Instantanés d'assets versionnés, rapports d'opérations de fichiers terminées et manifestes de lots complets. Cette partie de l'historique a sa propre version ; fournie par l'adaptateur de sauvegarde interne `fileHistory` du shell. |
| `revision-history.json` | optionnel, sauvegardes manuelles | Identifiants de création stables, points de contrôle conservés, vignettes et brouillons de récupération glissants. Fournie par `host.state.history.backup` là où c'est pris en charge. |
| `file-history/versions/` | par instantané | Octets précédents de l'asset et identifiants extraits, indépendamment du fait que l'asset actuel existe encore. |
| `file-history/results/` | par opération terminée | Octets de sortie exacts. Aucun fichier d'origine sélectionné pour conversion n'est conservé ni inclus. |
| `prefs.json` | oui | Préférences locales propres à l'utilisateur : `theme`, `sidebarWidth` et le compteur d'activité `ct-metrics`. |
| `lolly.txt` | oui | Un résumé lisible par un humain du bundle (compteurs, profil, nom de fichier) pour quiconque ouvre le zip sans Lolly. Régénéré à chaque export et reconnu à l'import, donc il ne compte jamais comme une partie ignorée. Il est écrit *après* la carte d'intégrité, donc il reste en dehors d'elle. |

Le bundle est délibérément un simple zip : il survit intact à n'importe quel transport, et n'importe quel outil de décompression peut l'inspecter.

`profile.json` est la plus petite partie et celle qu'un lecteur voit en premier dans l'application : les informations qu'un producteur renseigne une fois, plus l'opt-in qui permet aux outils de les utiliser.

![Le formulaire des détails du profil qui devient profile.json : nom, coordonnées et photo de profil](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=1100&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

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
| `format` | Toujours `lolly-backup`. Un fichier qui en est dépourvu est rejeté comme "not a Lolly backup". |
| `formatVersion` | La disposition avec laquelle ce bundle a été **écrit**. Incrémenté à chaque changement de l'ensemble ou de la forme des parties. Les lecteurs ne s'appuient **pas** dessus. |
| `minReader` | La version minimale de lecteur requise pour importer ce bundle **en toute sécurité**. C'est le champ sur lequel les lecteurs s'appuient. |
| `app` | Id de l'application productrice, pour le diagnostic. |
| `exportedAt` | Horodatage ISO de la création du bundle. |
| `counts` | Ce que l'écrivain y a mis, pour l'affichage et la vérification de cohérence. |
| `integrity` | Optionnel. Associe chaque partie sauf `manifest.json` à un digest de type SRI `sha256-<base64>` de ses octets **non compressés**. |

## Politique de version (compatibilité ascendante)

La séparation entre `formatVersion` et `minReader` est ce qui permet au format d'évoluer sans abandonner les installations plus anciennes :

- Un lecteur importe un bundle quand `manifest.minReader ≤` sa propre version de lecteur. Il refuse (avec "needs a newer version of the app") seulement quand le bundle exige explicitement un lecteur plus récent.
- Un changement **additif** - une nouvelle partie *optionnelle*, ou un nouveau champ de manifeste optionnel - incrémente `formatVersion` mais laisse `minReader` inchangé. Les applications plus anciennes importent quand même chaque partie qu'elles reconnaissent. Les parties qu'elles ne reconnaissent pas sont ignorées (voir ci-dessous), pas abandonnées silencieusement.
- Un changement **incompatible** - un cas où une mauvaise importation d'une partie corrompt les données, ou où une partie auparavant optionnelle devient obligatoire - fait monter `minReader`. Les applications plus anciennes refusent alors proprement au lieu d'importer quelque chose qu'elles ne peuvent pas gérer.
- Si un futur bundle définit `formatVersion` mais omet `minReader`, les lecteurs se rabattent prudemment sur `formatVersion` (traitant le changement comme incompatible).

> **Règle empirique pour les auteurs :** si tout lecteur existant continuerait à bien se comporter en ignorant ton ajout, c'est additif - incrémente `formatVersion`, laisse `minReader`. Sinon, fais monter `minReader`.

## Intégrité

Quand `manifest.integrity` est présent, un lecteur vérifie le SHA-256 de chaque partie listée **avant d'écrire quoi que ce soit**. Une non-correspondance ("failed its integrity check") ou une partie manquante ("incomplete") interrompt tout l'import - il n'y a pas de restauration partielle. Cela détecte la corruption qu'un transport de fichier peut introduire (un AirDrop tronqué, une passerelle e-mail qui a réencodé la pièce jointe, un mauvais secteur USB).

L'intégrité est du best-effort par conception : elle n'est écrite que là où Web Crypto est disponible (tout contexte de navigateur sécurisé et Node moderne), et vérifiée seulement quand la carte et Web Crypto sont tous deux présents. Un bundle sans la carte - par exemple un bundle antérieur à l'existence de l'intégrité - s'importe sans changement. "Cannot verify" n'est jamais traité comme "corrupt".

Le manifeste ne se liste ni lui-même ni le README `lolly.txt` régénéré. Les digests couvrent les parties dont le manifeste se porte garant.

## Sémantique de l'import

L'import est une **fusion**, jamais un remplacement total :

- Les données existantes sur la cible sont laissées en place.
- Quand un emplacement de session ou un id d'image téléversée existe des deux côtés, la copie enregistrée le plus récemment est conservée, si bien qu'une sauvegarde plus ancienne n'écrase jamais un travail plus récent sur la cible. À date égale ou inconnue, la copie de la cible est conservée. Sur une installation web avec historique de création, la même règle décide quelle copie d'une création reste active, et l'autre copie est conservée comme brouillon protégé (voir plus bas).
- La fiche de profil est fusionnée, pas remplacée. Chaque dossier de la cible garde son contenu ; un dossier du bundle que la cible n'a pas est ajouté, et un dossier présent des deux côtés garde le nom et le parent de la cible et reçoit les membres du bundle qui lui manquent. Une session classée dans un dossier sur la cible y reste classée.
- Les favoris (outils, éléments du catalogue et éléments de Projets) sont combinés. Les modèles, les modèles de Projets et les outils utilisateur du bundle sont ajoutés quand la cible n'a aucune fiche avec cet id. Les entrées de Corbeille des deux côtés sont conservées, si bien qu'un élément restaurable sur l'une ou l'autre installation peut toujours l'être.
- Tout autre champ de profil (nom, coordonnées, langue, feature flags, outils masqués et les autres réglages) garde la valeur de la cible. Un champ vide sur la cible prend la valeur du bundle. C'est pareil pour `prefs.json` : une préférence n'est écrite que là où la cible n'en a aucune.
- L'application ordinaire de la synchronisation des appareils est l'exception : pour garder les appareils au même pas, elle prend la fiche de profil, les préférences, les sessions et les images de la copie synchronisée. Restaurer une copie antérieure fait de même, puisque cela revient délibérément en arrière dans le temps. La première jonction, **Importer sur cet appareil**, fusionne comme un import.
- Les versions d'assets historiques et les id d'opérations sont des exceptions immuables : un import répété est idempotent, et un id qui nomme déjà des octets/un historique différents est refusé, jamais écrasé. Réimporter un asset actuel identique préserve sa version. Un asset actuel modifié doit porter une version différente.
- L'historique de création fusionne aussi. Une création présente des deux côtés garde la copie enregistrée le plus récemment comme active et l'autre copie comme brouillon protégé ; une création dont l'emplacement est utilisé par la cible pour une autre création est ajoutée à côté ; une création dans la Corbeille de la cible y reste. Un id de checkpoint qui nomme un contenu différent sur la cible garde celui de la cible. Une archive qui échoue à ses propres vérifications arrête l'import avant tout changement de profil, de session, d'asset ou de préférences. Un import répété identique n'ajoute aucun stockage.
- Rien de ce qui n'était pas dans le bundle n'est touché. Une session que la cible avait mais que le bundle n'avait pas survit à l'import.

Les sessions enregistrées se relient automatiquement à leurs images : les références d'assets sont conservées par id, et le pont les résout à nouveau après la restauration des images téléversées (il doit le faire de toute façon, car les URL `blob:` ne survivent pas à un rechargement).

Le résumé de l'import rapporte `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`. `failedAssets` compte les assets téléversés qui n'ont pas pu être restaurés (stockage de l'appareil plein, par exemple). C'est distinct de `skipped`, qui compte les parties d'un écrivain plus récent et rétrocompatible que cette build n'a pas reconnues. L'interface affiche `skipped` ("… · N newer items skipped"), pour que la restauration soit honnête sur ce qu'elle a laissé de côté.

Quand l'historique des fichiers est présent, le résumé porte aussi `assetVersions`, `fileOperations` et `failedHistory`. Un épuisement du stockage ou des conflits d'id immuables peuvent provoquer une restauration partielle ; l'interface indique à l'utilisateur de conserver la sauvegarde source. La synchronisation cloud **n'**avance **pas** sa révision appliquée après une restauration partielle ou non prise en charge, si bien que l'instantané reste disponible pour une nouvelle tentative. La restauration n'est pas une transaction unique couvrant tous les stockages de profil/session/asset/historique.

## Historique de création (v3)

Les sauvegardes manuelles depuis un hôte web capable d'historique incluent `revision-history.json` avec son propre schéma `{ version: 1, documents, revisions, recoveries }`. Il porte les id conservés, les instantanés d'entrée canoniques, les horodatages de version, les aperçus raster et des brouillons d'écriture séparés. L'adaptateur d'historique capture les sessions actuelles et leurs têtes en une seule transaction de lecture ; `sessions.json` utilise ces mêmes instantanés actuels pour les lecteurs plus anciens.

La restauration vérifie le SHA-256 et le nombre d'octets de la charge utile, les identités uniques, les relations document/tête, l'ascendance, les horodatages, les types d'aperçu et les limites avant de valider l'archive en une seule transaction. Des références parentes compactées peuvent être absentes. Le travail actuel existant n'est jamais remplacé en silence : quand une création existe des deux côtés, le côté non conservé comme actif devient un brouillon protégé. La limite de transfert de 384 Mio de l'archive est vérifiée explicitement, et les limites de stockage sont appliquées sans tronquer les points de contrôle conservés. La sauvegarde globale utilise toujours une implémentation ZIP en mémoire et n'est pas une archive en flux continu.

Le résumé ajoute `revisions` et `recoveryDrafts`, qui ne comptent que ce que cet import a ajouté, ainsi que `added`, `kept`, `replaced`, `copies` et `hidden` pour la façon dont chaque création a été fusionnée. Un shell sans cette capacité restaure les sessions ordinaires et signale la partie historique comme ignorée. L'historique du système de fichiers natif reste non pris en charge tant que son adaptateur ne fournit pas de transactions d'historique durables. L'état d'invité P2P n'a ni historique durable ni archive de récupération.

La synchronisation d'instantanés personnels exclut explicitement l'historique de création. Appliquer un instantané à un document local porteur d'historique préserve son état de travail précédent comme un brouillon de récupération séparé et invalide le jeton d'écriture de tout éditeur ouvert. Ses points de contrôle immuables restent sur l'appareil. Cela protège l'historique local pendant le remplacement d'instantané ; cela ne fusionne pas les historiques concurrents des appareils.

Les références d'assets historiques sont conservées, tandis que le rendu résout toujours les assets via la bibliothèque existante de la destination. Cette archive ne garantit pas encore les octets exacts des anciens assets ni les anciens rendus d'outils. Les octets de version d'asset et de résultat de fichier continuent de voyager via leur partie de sauvegarde séparée existante.

## Versions enregistrées et résultats de fichiers (v2)

La partie optionnelle de l'historique contient `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }` ; les lecteurs acceptent aussi l'ancienne forme history-v1 sans lots. Chaque instantané identifie l'id d'asset stable et la version exacte, son heure d'enregistrement, sa longueur en octets et son SHA-256 hexadécimal, plus une fiche d'asset dont `_file` et l'optionnel `_credentialFile` pointent vers des parties binaires. Les opérations portent les faits du fichier d'origine, la requête, le rapport, les horodatages et un `_file` de résultat optionnel ; les noms de backend de stockage, les handles OPFS et les baux d'exécution ne voyagent pas. Les lecteurs plus anciens, limités à history-v1, refusent la nouvelle version de l'historique avant l'import, plutôt que d'abandonner silencieusement l'appartenance à un lot.

Les manifestes de lot enregistrent chaque source sélectionnée avant le traitement, y compris les fichiers jamais lus, les membres annulés, les échecs de réservation d'espace de résultat et le travail interrompu. Chaque membre a un id d'opération stable, une référence/des faits sur la source, le nom de sortie demandé et un rapport terminal. Une source non lue a des faits déclarés, pas une empreinte inventée. L'import valide l'identité du membre et sa cohérence avec tout rapport d'opération porté. Les rapports de lot restent disponibles quand des résultats individuels ont été explicitement retirés, mais un reçu n'implique pas que ses octets de sortie sont encore stockés.

- Chaque enregistrement d'historique, rapport et fichier référencé connu est validé avant toute écriture d'import de profil ou d'asset. Des octets manquants et des SHA-256 non concordants échouent même si l'enveloppe n'a pas de carte d'intégrité. Les identifiants extraits restent des tableaux d'octets, y compris pour les imports depuis d'anciens écrivains qui les sérialisaient en JSON comme des objets à clés numériques.
- Les opérations en cours deviennent des enregistrements interrompus dans la sauvegarde, avec un rapport d'échec explicatif et aucun résultat. La restauration ne relance jamais un travail en arrière-plan ni n'importe un bail actif. Réessayer nécessite de sélectionner le fichier d'origine, vérifié contre son SHA-256 enregistré s'il est disponible.
- Les résultats restaurés valident leurs octets et métadonnées ensemble dans IndexedDB. Les nouveaux résultats ordinaires utilisent OPFS quand c'est disponible, avec un repli sur IndexedDB. Une opération active existante n'est jamais remplacée par un import.
- L'assemblage ZIP de l'historique se fait toujours en mémoire : la limite actuelle est de **256 Mio de charge utile d'historique**, **4 Mio de métadonnées d'historique**, au plus **100 opérations**, **100 lots** et **2 000 instantanés**. L'export refuse explicitement un historique trop volumineux ou incomplet ; il ne l'omet jamais silencieusement. Télécharge individuellement les versions/résultats importants avant de retirer d'anciennes copies locales. Ces limites ne sont pas une garantie mesurée de pic de mémoire pour les téléphones.
- L'historique local des résultats a un budget de 512 Mio et un plafond de 100 enregistrements. Les instantanés d'assets ont un budget séparé de 512 Mio et au plus 20 versions historiques par asset ; les octets d'identifiants extraits comptent dans ce budget d'instantanés. La restauration respecte ces limites et n'évince jamais silencieusement des données utilisateur existantes.
- Les métadonnées de lot locales ont un budget séparé de 4 Mio, au plus 100 manifestes et 20 membres par lot. Les membres en attente réservent de la capacité de métadonnées, avec un plafond de 32 Kio par rapport de membre. C'est un budget logique, pas une garantie d'espace disque du navigateur ; un véritable dépassement de quota est signalé et le rapport en mémoire reste téléchargeable. Réessayer un membre de lot crée un nouveau lot sans écraser l'ancien rapport. Retirer un enregistrement de lot ne retire ni les octets de résultat individuels ni les assets de bibliothèque.
- Les résultats convertis peuvent être explicitement ajoutés à la bibliothèque sans normalisation ni réencodage. Les empreintes source/sortie et la relation d'opération accompagnent l'asset. Des ajouts répétés réutilisent une copie inchangée ; une copie modifiée n'est jamais écrasée. Les images raster peuvent démarrer un nouveau document Design. Ce document utilise l'id d'asset de bibliothèque actuel : garantir des épinglages de version exacts sur toute l'exécution et le chemin d'URL de Design reste un travail séparé. Les résultats SVG/HTML/PDF/ZIP sont conservés par cette remise comme des assets de fichier opaques, non promus en contenu interactif/vectoriel de confiance.
- **Convertir → Opérations de fichiers récentes** expose l'usage de l'historique, les rapports, les téléchargements et le gestionnaire de versions. Le gestionnaire retrouve aussi d'anciennes versions d'assets de bibliothèque supprimés. Restaurer un instantané crée une nouvelle version actuelle tout en gardant l'instantané sélectionné intact. **Paramètres → Stockage** comptabilise résultats et versions séparément des caches jetables.
- Le nettoyage explicite des fichiers temporaires ne retire que les octets non référencés appartenant à une opération. Les enregistrements actuels protègent leurs fichiers ; les fichiers OPFS récents ont un délai de grâce d'une heure. Les résultats enregistrés et les instantanés d'assets ne sont pas nettoyés automatiquement.

Les lecteurs plus anciens acceptent toujours l'enveloppe v2 (`minReader: 1`) et restaurent les parties familières, en comptant les parties d'historique non prises en charge comme ignorées. Une récupération complète de l'historique nécessite un shell avec l'adaptateur `fileHistory` ; c'est une jointure interne au shell, pas une nouvelle capacité `HostV1` côté outil. La véritable restauration à deux appareils est couverte par le contrôle Chromium local ; l'acceptation de la récupération sur les apps Tauri/iOS/Android installées reste distincte.

## Ce qui ne voyage pas

- **Les caches du catalogue** (métadonnées et blobs d'assets téléchargés, l'index des outils) - resynchronisés gratuitement sur la cible.
- **Les outils et assets du catalogue** - hors périmètre, et supposés déjà présents sur la cible. Les tokens de marque, polices et logos que l'utilisateur a ajoutés sont des assets utilisateur, ils voyagent donc.
- **Les URL `blob:` / objet** - régénérées par le pont au chargement.
- **Les originaux de conversion, les baux d'exécution actifs et les secrets d'accès/de signature locaux à la machine** - pas une charge utile d'historique portable. Un résultat enregistré est une copie, pas une promesse que la source d'origine a été sauvegardée.
- **Le compteur de séquence d'export** - le compteur de nommage des téléchargements par jour (clé `localStorage` `lolly-export-seq`) est une commodité de nommage locale. Il est tenu hors de `PREF_KEYS`, donc il ne voyage jamais dans un bundle.

Le compteur de stockage détaille la même séparation. Les sessions enregistrées, Mes images et Résultats de fichiers & versions voyagent dans un bundle. Le cache d'assets, les aperçus d'outils et les épingles hors ligne en dessous sont tous re-dérivables, donc ils restent en arrière.

![Le compteur de stockage qui décompose les données de cet appareil en catégories nommées, avec Saved sessions et My images suivies séparément de l'Asset cache, ici sur une installation neuve où chaque catégorie est encore vide](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

## Garantie multi-shell

`data-transfer.ts` lit et écrit exclusivement via le pont de capacités (`host.profile`, `host.state`, `host.assets`) et les préférences `localStorage` partagées. Le même module lit et écrit l'enveloppe commune sur le web et Tauri, via IndexedDB ou le stockage du système de fichiers. Les parties optionnelles d'historique n'apparaissent que là où l'adaptateur correspondant est disponible ; une partie non prise en charge est signalée comme ignorée à l'import. La suite headless exerce les parties communes contre un pont en mémoire, tandis que les transactions d'historique ont aussi des tests en navigateur réel.

Deux shells échappent à cette garantie, pour des raisons différentes :

- Le **CLI ponctuel** n'a rien à transporter - son état est en mémoire et éphémère, propre à chaque invocation.
- Le **TUI** persiste bien un état (`~/.lolly` : sessions, dossiers, profil) et sa vue Profil peut le sauvegarder, mais il écrit une archive *plus simple*, la sienne : `saved-state/<slot>.json` par session, plus `profile.json` et `folders.json`, sans manifeste, sans `formatVersion`/`minReader` ni carte d'intégrité. Elle n'est **pas** importable dans ce format - un lecteur la rejette comme "not a Lolly backup" - et, source de confusion, elle utilise un nom similaire (`lolly-backup-<stamp>.zip`). Unifier les deux est un manque connu.

## Points d'extension réservés

L'enveloppe est, par conception, un manifeste plus un ensemble de parties nommées, pour que de nouveaux types de données portables puissent s'y greffer plus tard **sans rupture de compatibilité**. Elles s'insèrent comme des parties additives (nouveau `formatVersion`, même `minReader`), et le lecteur actuel ignore ce qu'il ne reconnaît pas. Ces éléments ne sont pas encore construits. Les noms sont réservés ici pour que le format reste cohérent à leur arrivée.

- **`tokens.json` - design tokens.** Un document de design tokens [W3C DTCG](https://tr.designtokens.org/format/) (le format qu'[importe et exporte Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) - des tokens avec `$value`/`$type`/`$description`, organisés en groupes, ensembles et thèmes). Un ensemble de tokens dans le paquet permet à un utilisateur de déplacer ses primitives de marque entre installations avec ses sessions. (Les tokens de marque propres d'un utilisateur voyagent déjà aujourd'hui comme l'asset `user/tokens/brand` dans `assets.json` ; cette partie porterait tout un document DTCG avec ses ensembles et thèmes.) À terme, un ensemble de tokens ingéré devient une source de premier ordre à laquelle les outils et les assets de palette se réfèrent.
- **`penpot/` - fichiers Penpot ingérés.** Un répertoire réservé pour un fichier Penpot (ou son sous-ensemble extrait, pertinent pour Lolly) importé et présenté *comme un outil*. Le paquet transportera la définition ingérée, pour qu'elle voyage avec le reste des données de l'utilisateur.

Tout ce qui sort de ces noms réservés et des parties ci-dessus est, pour un lecteur, une partie inconnue : laissée intacte et comptée dans `skipped`.

## Référence

- Module : [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - le nommeur `backupFilename()` est interne).
- Test de contrat : [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - cas d'aller-retour, de fusion, d'intégrité, de compatibilité ascendante et de verrou du lecteur.
- Tests de contrat d'historique : [`tests/file-history-backup.test.ts`](../tests/file-history-backup.test.ts), [`tests/file-batch-history.test.ts`](../tests/file-batch-history.test.ts) et [`tests/file-result-library.test.ts`](../tests/file-result-library.test.ts). Recette navigateur : [`tests/file-history.browser.test.ts`](../tests/file-history.browser.test.ts), [`tests/file-batch-history.browser.test.ts`](../tests/file-batch-history.browser.test.ts) et [`tests/file-result-reuse.browser.test.ts`](../tests/file-result-reuse.browser.test.ts).
- Surface de pont utilisée : `host.profile`, `host.state`, `host.assets` - voir [Host API](/info/host-api.html).
