# Transfert de données - le bundle `lolly-backup`

Tout ce qu'un utilisateur de Lolly accumule vit **sur son appareil** - pas de compte, pas de cloud. Le bundle de transfert de données est la façon dont cette valeur se déplace : exporte-le depuis une installation, transporte le fichier par n'importe quel moyen (USB, AirDrop, e-mail à soi-même, un partage réseau) et importe-le sur une autre. Le fichier *est* le transport. La cible peut être hors ligne ou en ligne. Cela ne fait aucune différence, car rien ne parle jamais à un serveur.

![Les deux boutons qui déplacent toute une installation : Export my data écrit un zip, Import data le relit](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Cette page est la spécification du format. Pour le guide utilisateur final, voir [Using Lolly → Moving to another device](/info/using.html). L'implémentation se trouve dans [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts), et [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) fixe le contrat d'aller-retour.

> **Portée.** Un bundle porte des *données utilisateur*, pas des outils. Les outils et les assets du catalogue sont synchronisés séparément et sont supposés déjà présents sur la cible (dans le pire cas à une version plus récente). L'import n'installe ni ne met jamais à niveau un outil.

## Objectifs

- <!--i:box--> **Un format, tous les shells.** Les mêmes octets sont produits et consommés par la PWA web, les applications Tauri desktop/mobile et tout futur shell. Le bundle est le contrat. Le pont de capacités de chaque shell est l'adaptateur par plateforme derrière lui.
- <!--i:shieldcheck--> **Survit au trajet.** Un bundle corrompu ou tronqué en transit échoue bruyamment à l'import, jamais de restauration partielle.
- <!--i:clock--> **Survit à cette version.** Une application plus ancienne peut quand même importer les parties reconnues d'un bundle plus récent. Un format réellement incompatible est refusé proprement.
- <!--i:check--> **Sûr à fusionner.** Importer sur une installation déjà en usage n'efface jamais ce qui n'était pas dans le bundle.

## L'enveloppe

Un bundle est un simple `.zip`. Le téléchargement porte le nom de la personne à qui il appartient - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (par exemple `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - pour qu'un dossier Téléchargements plein de sauvegardes reste lisible. Les parties prénom et nom viennent du profil et sont omises quand elles ne sont pas définies. Sans profil, on obtient `LollyTools-2026-06-26-1.zip`, et un simple prénom donne `LollyTools-Ada-2026-06-26-1.zip`. Chaque partie est nettoyée en un jeton sûr pour un nom de fichier (lettres/chiffres Unicode conservés, espaces/ponctuation retirés, plafonné à 32 caractères). `<n>` est une séquence par jour et par appareil, pour que des exports répétés le même jour ne se percutent pas et restent dans l'ordre. `backupFilename()` dans [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) construit le nom. Le contenu du zip est identique quel que soit le nom. À l'intérieur :

| Chemin | Requis | Contenu |
|---|---|---|
| `manifest.json` | oui | Id de format, versions, compteurs et intégrité par partie. La première chose qu'un lecteur consulte. |
| `profile.json` | si défini | La fiche `me` de l'utilisateur (nom, contact, référence de portrait, indicateurs). Lue via `host.profile`. |
| `sessions.json` | oui | Chaque session enregistrée : emplacement, id/version de l'outil, libellé, vignette (data-URL) et données d'entrée complètes. Lue via `host.state`. |
| `assets.json` | oui | Métadonnées de chaque asset téléversé (images, polices, tokens de marque), chacune pointant vers ses octets sous `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | par asset | Les octets bruts de l'asset (fichiers image et police). Stockés non compressés (formats déjà compressés). L'extension est cosmétique. Le MIME dans `assets.json` fait foi. |
| `prefs.json` | oui | Préférences locales propres à l'utilisateur : `theme`, `sidebarWidth` et le compteur d'activité `ct-metrics`. |
| `lolly.txt` | oui | Un résumé lisible par un humain du bundle (compteurs, profil, nom de fichier) pour quiconque ouvre le zip sans Lolly. Régénéré à chaque export et reconnu à l'import, donc il ne compte jamais comme une partie ignorée. Il est écrit *après* la carte d'intégrité, donc il reste en dehors d'elle. |

Le bundle est délibérément un simple zip : il survit intact à n'importe quel transport, et n'importe quel outil de décompression peut l'inspecter.

`profile.json` est la plus petite partie et celle qu'un lecteur voit en premier dans l'application : les informations qu'un producteur renseigne une fois, plus l'opt-in qui permet aux outils de les utiliser.

![Le formulaire de détails du profil qui devient profile.json - nom, contact, portrait et l'opt-in à côté](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 1,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.webp": "sha256-…",
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

L'import est une **fusion avec écrasement**, jamais un remplacement total :

- Les données existantes sur la cible sont laissées en place.
- Toute clé qui entre en collision - le profil, un emplacement de session, un id d'image téléversée - est remplacée par la copie importée.
- Rien de ce qui n'était pas dans le bundle n'est touché. Une session que la cible avait mais que le bundle n'avait pas survit à l'import.

Les sessions enregistrées se relient automatiquement à leurs images : les références d'assets sont conservées par id, et le pont les résout à nouveau après la restauration des images téléversées (il doit le faire de toute façon, car les URL `blob:` ne survivent pas à un rechargement).

Le résumé de l'import rapporte `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`. `failedAssets` compte les assets téléversés qui n'ont pas pu être restaurés (stockage de l'appareil plein, par exemple). C'est distinct de `skipped`, qui compte les parties d'un écrivain plus récent et rétrocompatible que cette build n'a pas reconnues. L'interface affiche `skipped` ("… · N newer items skipped"), pour que la restauration soit honnête sur ce qu'elle a laissé de côté.

## Ce qui ne voyage pas

- **Les caches du catalogue** (métadonnées et blobs d'assets téléchargés, l'index des outils) - resynchronisés gratuitement sur la cible.
- **Les outils et les assets de marque** - hors périmètre, et supposés déjà présents sur la cible.
- **Les URL `blob:` / objet** - régénérées par le pont au chargement.
- **Le compteur de séquence d'export** - le compteur de nommage des téléchargements par jour (clé `localStorage` `lolly-export-seq`) est une commodité de nommage locale. Il est tenu hors de `PREF_KEYS`, donc il ne voyage jamais dans un bundle.

Le compteur de stockage détaille la même séparation. Saved sessions et My images voyagent dans un bundle. Le cache d'assets, les aperçus d'outils et les épingles hors ligne en dessous sont tous re-dérivables, donc ils restent en arrière.

![Le compteur de stockage qui décompose les données de cet appareil en catégories nommées, avec Saved sessions et My images suivies séparément de l'Asset cache, ici sur une installation neuve où chaque catégorie est encore vide](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=.store-manages%2C.storage-subsection%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&walker=1&dark=1&filename=ce-storage-categories)

## Garantie multi-shell

`data-transfer.ts` lit et écrit exclusivement via le pont de capacités (`host.profile`, `host.state`, `host.assets`) et les préférences `localStorage` partagées. Comme ce pont est le seul point de passage, le *même* module produit un bundle identique octet pour octet sur chaque shell, même si le stockage sous-jacent diffère - IndexedDB sur le web, le système de fichiers sur Tauri. Les shells Tauri réutilisent ce module sans modification. Seule leur implémentation de `host.state` diffère. Le test headless exerce l'aller-retour complet contre un pont en mémoire, ce qui explique qu'il tienne lieu de test pour tous.

Deux shells échappent à cette garantie, pour des raisons différentes :

- Le **CLI ponctuel** n'a rien à transporter - son état est en mémoire et éphémère, propre à chaque invocation.
- Le **TUI** persiste bien un état (`~/.lolly` : sessions, dossiers, profil) et sa vue Profil peut le sauvegarder, mais il écrit une archive *plus simple*, la sienne : `sessions/<slot>.json` par session, plus `profile.json` et `folders.json`, sans manifeste, sans `formatVersion`/`minReader` ni carte d'intégrité. Elle n'est **pas** importable dans ce format - un lecteur la rejette comme "not a Lolly backup" - et, source de confusion, elle utilise un nom similaire (`lolly-backup-<stamp>.zip`). Unifier les deux est un manque connu.

## Points d'extension réservés

L'enveloppe est, par conception, un manifeste plus un ensemble de parties nommées, pour que de nouveaux types de données portables puissent s'y greffer plus tard **sans rupture de compatibilité**. Elles s'insèrent comme des parties additives (nouveau `formatVersion`, même `minReader`), et le lecteur actuel ignore ce qu'il ne reconnaît pas. Ces éléments figurent sur la [feuille de route](/info/overview.html#roadmap), non encore implémentés. Les noms sont réservés ici pour que le format reste cohérent à leur arrivée.

- **`tokens.json` - design tokens.** Un document de design tokens [W3C DTCG](https://tr.designtokens.org/format/) (le format qu'[importe et exporte Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) - des tokens avec `$value`/`$type`/`$description`, organisés en groupes, ensembles et thèmes). Un ensemble de tokens dans le paquet permet à un utilisateur de déplacer ses primitives de marque entre installations avec ses sessions. À terme, un ensemble de tokens ingéré devient une source de premier ordre à laquelle les outils et les assets de palette se réfèrent.
- **`penpot/` - fichiers Penpot ingérés.** Un répertoire réservé pour un fichier Penpot (ou son sous-ensemble extrait, pertinent pour Lolly) importé et présenté *comme un outil*. Le paquet transportera la définition ingérée, pour qu'elle voyage avec le reste des données de l'utilisateur.

Tout ce qui sort de ces noms réservés et des parties ci-dessus est, pour un lecteur, une partie inconnue : laissée intacte et comptée dans `skipped`.

## Référence

- Module : [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - le nommeur `backupFilename()` est interne).
- Test de contrat : [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - cas d'aller-retour, de fusion, d'intégrité, de compatibilité ascendante et de verrou du lecteur.
- Surface de pont utilisée : `host.profile`, `host.state`, `host.assets` - voir [Host API](/info/host-api.html).
