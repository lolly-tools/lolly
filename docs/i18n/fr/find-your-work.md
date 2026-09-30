# Retrouver et récupérer ton travail

Tout ce que tu crées dans Lolly reste dans le navigateur ou l'application où tu l'as créé, sur cet appareil, sauf si tu actives la [synchronisation](/info/sync.html). Le travail enregistré est dans **Projets**. Un fichier téléchargé se trouve là où ton navigateur ou ton système l'a placé, et une copie attend généralement dans **Éléments**. Dans la plupart des outils, le travail jamais enregistré est conservé aussi. Cette page couvre chacun de ces cas, plus un onglet fermé, des données de navigateur effacées, des versions antérieures, des éléments supprimés et le transfert vers un autre appareil.

| Ce que tu as fait | Où regarder |
|---|---|
| Appuyé sur **Enregistrer sous** ou **Enregistrer** | **Projets** |
| Appuyé sur **Télécharger** | Les téléchargements de ton navigateur, et une copie dans **Éléments** |
| Ni l'un ni l'autre, dans un [outil qui enregistre au fil du travail](#which-tools-save-as-you-work) | **Projets** et **Historique** |
| Ni l'un ni l'autre, dans un outil qui ne le fait pas | Seulement l'onglet où tu as travaillé, jusqu'à ce que tu le fermes |
| Supprimé dans l'application | **Corbeille**, dans **Projets**, **Éléments** ou **Paramètres → Stockage**, pendant 30 jours |

## Retrouver quelque chose que tu as enregistré

1. Appuie sur **Accueil** en haut à gauche de l'outil.
2. Ouvre l'onglet **Projets** en haut de l'écran d'accueil (l'icône de dossier sur un téléphone).
3. Regarde le premier écran. Le travail enregistré dans **Ma bibliothèque** s'y trouve, et chaque projet est un dossier. Pour rechercher dans tous les dossiers à la fois, tape dans **Rechercher dans tous les projets…** au bas de l'écran.

Un élément porte le nom du fichier que tu as saisi dans le panneau d'export, ou celui de son outil, comme **QR Code**, si tu n'en as saisi aucun. Ouvre l'élément et chaque réglage est de retour, prêt à être modifié et exporté à nouveau. Pour conserver un nouveau travail de cette façon, voir [Enregistrer et reprendre](/info/using.html#saving-continuing).

::: note Pas dans Projets ?
- Il se peut qu'il soit dans la **Corbeille** : voir [Récupérer quelque chose que tu as supprimé](#get-back-something-you-deleted).
- Un autre navigateur, une fenêtre privée ou un autre appareil démarre vide, sauf si tu utilises la [synchronisation](/info/sync.html) ou que tu [transfères ton travail](#move-your-work-to-another-device).
- Si tu as seulement appuyé sur **Télécharger**, voir [Retrouver un fichier téléchargé](#find-a-file-you-downloaded).
:::

::: details Travailler avec Projets
Tu peux aussi ouvrir **Projets** depuis **Paramètres → Stockage → Sessions enregistrées → Organiser en projets**. Ça fonctionne comme un gestionnaire de fichiers :

![Projets avant que quoi que ce soit ne soit enregistré : les tuiles Nouveau dossier, Nouvel asset et Modèles, l'horloge History en haut à droite et la barre Rechercher dans tous les projets… au bas](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **Des dossiers imbriqués.** Regroupe les sessions enregistrées dans des dossiers, et des dossiers dans d'autres dossiers, aussi profondément que tu veux. Crée un dossier, renomme-le ou fais glisser une tuile sur un autre dossier pour la déplacer ; un fil d'Ariane te permet de remonter. Les sessions enregistrées sans dossier apparaissent directement à la racine de **Projets**.
- <!--i:clock--> **Trie à ta façon.** **Options d'affichage**, le bouton à curseurs en haut à droite, propose **Grille** ou **Liste** et trie par **Nom**, **Date d'ajout**, **Dernière modification** (le tri par défaut), **Taille** et, dans un dossier, **Par outil**. Les dossiers viennent toujours en premier, quel que soit le tri actif - le tri n'ordonne que les sessions et les dossiers au sein de leur propre groupe.
- <!--i:document--> **Range directement le nouveau travail.** **Nouvel asset** ouvre le sélecteur commun. Choisis **Modèles** pour partir d'un modèle enregistré : ouvre-le pour le modifier, ou utilise **+ Ajouter** pour enregistrer immédiatement une nouvelle création.
- <!--i:checklist--> **Sélection multiple (ordinateur).** Coche la case d'une tuile, fais glisser un rectangle de sélection sur une zone vide ou fais **Maj/Cmd-clic** ; **clic droit** sur une tuile pour son menu contextuel. La barre de sélection propose alors **Rendre la sélection**, **Déplacer vers…**, **Nouveau dossier**, **Supprimer** (qui déplace vers la Corbeille), **Modifier ensemble** pour deux à huit sessions d'un seul outil, côte à côte sous une même barre latérale, et **Modifier en feuille**, qui ouvre une sélection de taille ou de mélange quelconque comme des lignes dans la grille de lot.
- <!--i:download--> **Rends tout un dossier ou toute une sélection.** **Rendre le dossier** exporte chaque session enregistrée d'un dossier - y compris ses sous-dossiers - dans un seul `.zip` imbriqué. **Rendre la sélection** fait de même pour n'importe quelle sélection multiple, et une session unique se rend directement dans son propre fichier. Pas besoin de Batch/Pro.
- <!--i:link--> **Va droit au travail enregistré d'un outil.** Coche un ou plusieurs outils dans la galerie Outils et choisis **Voir les sessions** dans la barre de sélection - Projets s'ouvre en n'affichant que les sessions faites avec ces outils, avec un **Effacer** pour revenir à la vue complète.
- <!--i:link--> **Partage une session enregistrée.** Clic droit sur une session (sur un téléphone, appuie sur **•••** sur sa tuile) → **Partager le lien** pour copier un lien qui la rouvre avec les mêmes réglages ; les images de ton appareil ne voyagent pas avec un lien (la boîte de dialogue de partage complète : voir [Partager ton travail](/info/using.html#sharing-your-work)).
- <!--i:pentool--> **Renomme ou duplique-en une.** Clic droit sur une session (sur un téléphone, appuie sur **•••** sur sa tuile) pour **Renommer**, **Dupliquer** (une copie dans le même dossier) et **Déplacer vers…**.

![Le popover Options d'affichage dans Projets : Disposition avec Grille et Liste, et Trier par réglé sur Dernière modification, à côté d'un bouton qui inverse l'ordre](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
<!--
SHOT NOTE (misc-projects-sort): trigger button confirmed as
`.filter-fab.projects-viewopts` in views/projects.ts (openViewOpts() is bound
to `.projects-viewopts` specifically) - `.projects-viewopts` alone is the
more specific hook, so that's what drives the click. The popover it opens
(`.projects-viewmenu`, also confirmed directly in openViewOpts()) is body-
appended, not nested under the Projects root, so cropSelector finds it
regardless. "By tool" only appears inside a folder - this recipe captures at
the Projects ROOT (`url=/#/p`), so if the capture pass wants "By tool"
visible too, point url= at a real folder instead: the route is a path
segment, `/#/p/<folderId>` (confirmed in main.ts's hash router - `parts[0]
=== 'p'` reads `folderId` from `parts[1]`), not a query param. Caveat: a
folder has to already EXIST in the capture profile, which a per-shot fresh
context has none of.
The popover (views/projects-view-options.ts, checked 2026-09-26) holds a
Layout pair (Grid / List) and a Sort by menu with a reverse button; the
options inside the menu (Name, Date added, Last modified, Size, By tool) are
not visible in the closed menu, so the alt does not list them.
-->

:::

## Si tu as fermé l'onglet ou quitté l'outil

Ce qui revient dépend de la façon dont tu es parti et de l'outil que tu as utilisé :

- **Tu as fermé l'onglet, ou tu reviens une autre fois.** Le travail non enregistré a disparu, sauf dans les [outils qui enregistrent au fil du travail](#which-tools-save-as-you-work) : ouvre ce travail depuis **Projets**.
- **Tu as rechargé la page dans le même onglet.** Tes réglages reviennent depuis l'adresse de la page. Dans les outils qui n'enregistrent pas au fil du travail, les images et fichiers que tu as ajoutés depuis ton appareil, et le texte sur une ligne de plus de 150 caractères, ne reviennent pas, parce que l'adresse ne les contient pas.
- **Tu as appuyé sur Accueil, ou le bouton retour en haut à gauche.** Si tu as changé quelque chose depuis ton dernier enregistrement, téléchargement ou copie, une boîte de dialogue **Modifications non enregistrées** demande s'il faut d'abord enregistrer. **Enregistrer et quitter** enregistre le travail et t'emmène vers **Projets**, ou vers le dossier de projet depuis lequel tu as ouvert le travail. **Quitter sans enregistrer** annule tes modifications : un élément enregistré revient à l'état de son dernier enregistrement, et une création que tu n'as jamais enregistrée quitte **Projets**. **Annuler** te garde dans l'outil.

Lolly ne demande que lorsque tu appuies sur **Accueil** ou le bouton retour dans un outil. Fermer l'onglet, recharger et le propre bouton retour de ton navigateur ne demandent jamais. Pour être sûr, appuie sur **Enregistrer sous**, ou **Enregistrer** dans le panneau d'export, avant de quitter un outil.

::: note Parti sans enregistrer par erreur ?
Dans les outils qui enregistrent au fil du travail, l'historique conserve une copie des modifications abandonnées. Ouvre la page **Historique**, trouve-les sous **Changes** et appuie sur **Ouvrir comme copie**. Dans les autres outils, les modifications ont disparu.
:::

::: details Quels outils enregistrent au fil du travail
Dans l'application web, chaque outil qui crée un document enregistre au fil du travail : Design, Chart, QR Code, Text, Sandbox et les autres. Ces outils ne le font pas :

- les outils qui travaillent sur un fichier que tu apportes, comme Redact, Sign ou Convert Image, parce que Lolly ne garde jamais de copie de ce fichier ;
- les outils qui enregistrent depuis ta caméra, ton micro ou ton écran, comme Record, Screen Capture et Voice Recorder ;
- 3D et Darkroom, qui prennent leur propre fichier ;
- un outil sans rien à changer, comme Countdown.

Dans les autres outils, ta première modification classe le travail dans **Projets** comme si tu avais enregistré, et les modifications suivantes sont conservées au fil du travail, une fois que l'outil a fini de dessiner. Une création non enregistrée reste donc dans Projets après la fermeture de l'onglet et se rouvre avec ses modifications marquées comme non enregistrées. **Quitter sans enregistrer** les rejette quand même, et l'historique conserve une copie des modifications abandonnées pendant 30 jours. Rouvrir l'outil depuis l'écran d'accueil démarre une nouvelle création ; ouvre l'ancienne depuis Projets.

Avec la [synchronisation](/info/sync.html) activée, une création classée de cette façon rejoint tes autres appareils comme tout le reste dans Projets. Ses versions restent sur l'appareil où elles ont été créées.

Si une création est ouverte dans deux onglets et que tu enregistres dans les deux, c'est le dernier enregistrement qui est conservé. Le travail qu'il a remplacé n'est pas perdu : il se trouve sous **Brouillons protégés** dans l'historique de la création, avec **Ouvrir le brouillon comme copie**.

Cela ne fonctionne que dans l'application web, pas dans les applications de bureau ou mobiles, et pas pendant que tu travailles en direct avec quelqu'un d'autre.
:::

## Retrouver un fichier téléchargé

Dans un navigateur, **Télécharger** remet le fichier à ton navigateur, qui l'enregistre dans son dossier de téléchargements (généralement **Téléchargements**) ou te demande où. Lolly n'est pas informé de l'endroit où le fichier est allé, regarde donc dans la liste des téléchargements de ton navigateur.

Si aucun fichier n'est apparu, regarde dans le panneau d'export tant que tu es encore dans l'outil. Sous **Télécharger**, une ligne indique le nom du fichier et l'heure, avec **Retry download**, et dans Chrome, Edge et les autres navigateurs Chromium, **Save file…** pour choisir toi-même un dossier. La ligne et son fichier durent jusqu'à ce que tu quittes l'outil, recharges ou exportes à nouveau.

Lolly conserve aussi deux choses après chaque téléchargement :

- **Une copie du fichier**, dans **Éléments** sous **Tes imports**, tant que **Enregistrer mes rendus dans ma bibliothèque** est activé sous **Paramètres → Tes rendus** (**Paramètres** se trouve au bas de l'écran d'accueil). Le réglage est activé par défaut. Une vidéo, ou un fichier de plus de 50 Mo, demande d'abord confirmation, et un zip n'est pas copié.
- **Les réglages que tu as utilisés**, pour tes 24 derniers téléchargements. **Exports récents**, sous ton travail enregistré dans **Projets**, rouvre l'outil avec ces réglages pour que tu puisses refaire le fichier, bien que les images et fichiers que tu as ajoutés depuis ton appareil ne soient pas inclus. La même liste se trouve sous **Paramètres → Activité et statistiques → Derniers exports** et dans l'onglet **Changes** de **History**. Cette liste conserve les réglages, pas les fichiers.

::: details Dans les applications de bureau et mobiles
- **Application de bureau :** **Télécharger** enregistre directement dans un dossier **Lolly** à l'intérieur de ton dossier **Téléchargements**, sans boîte de dialogue. La ligne sous **Télécharger** indique où le fichier est allé, du genre "Saved to Downloads/Lolly", avec **Afficher dans le dossier**. **Open Exports Folder**, dans le menu **Fenêtre** ou **Exports**, ouvre le dossier à tout moment. Un fichier portant le même nom qu'un précédent est enregistré comme "name (1)".
- **iPhone et iPad :** le fichier est enregistré dans l'app **Fichiers**, sous **Lolly**, et la feuille de partage s'ouvre pour que tu puisses l'envoyer ailleurs. La ligne sous **Télécharger** indique "Saved to Files → Lolly".
- **Android :** le menu de partage s'ouvre pour que tu puisses choisir où va le fichier.

Sur iPhone, iPad et Android, un nouveau fichier remplace un précédent portant le même nom.
:::

## Revenir à une version antérieure

- **Pendant cette visite :** **Annuler** remonte tes 100 dernières modifications, jusqu'à ce que tu quittes l'outil ou recharges. Voir [Annuler et rétablir](/info/using.html#undo-and-redo).
- **Dans les [outils qui enregistrent au fil du travail](#which-tools-save-as-you-work) :** les versions antérieures de chaque création sont conservées. Suis les étapes ci-dessous.
- **Tout sur l'appareil :** avec la [synchronisation](/info/sync.html) activée, **Restore an earlier copy**, sous **Paramètres → Services connectés**, ramène l'une des sept dernières copies quotidiennes, ou la copie d'avant ta dernière application. Tout sur cet appareil correspond alors à cette copie, pas seulement un design.

Pour ouvrir une version antérieure :

1. Appuie sur **Historique**, le bouton horloge à côté d'**Annuler** et **Rétablir**. Dans Design, **Historique** se trouve dans la barre du haut ; sur un téléphone, appuie sur **•••** puis **Historique**. Dans les outils sans **Annuler**, comme Text et Sandbox, **Historique** se trouve à côté d'**Accueil** en haut à gauche.
2. Trouve la version par sa date et son heure. Les lignes **Point de contrôle automatique** sont prises au fil du travail ; les lignes **Version enregistrée** sont les moments où tu as enregistré.
3. Appuie sur **Ouvrir comme copie**. La version s'ouvre comme une nouvelle création, et celle que tu avais ouverte reste telle quelle. La copie est dans **Projets**, avec "(copy)" après son nom.

Pour conserver une version sous un nom, appuie sur **Name version**, tape un nom et appuie sur **Keep milestone**. Les versions nommées sont listées sur la page **History**, sous **Milestones**.

::: details Le panneau History et la page History
Le panneau **History** liste aussi des lignes **Recovered work**, et **Protected drafts** contient tes dernières modifications entre les points de contrôle, avec **Open draft as a copy**. **Compare** et **Check assets** t'aident à choisir avant d'ouvrir une copie. Bascule **This creation** vers **All history on this device** pour voir toutes les créations.

Les points de contrôle automatiques s'éclaircissent avec le temps : un par minute pour la dernière heure, un par heure pour le dernier jour, un par jour pendant 30 jours, puis un par semaine. Les versions enregistrées et les versions nommées sont toutes conservées. Supprimer une création déplace aussi ses versions vers la **Corbeille**, et **Supprimer définitivement** les retire.

Quand le stockage de l'historique se remplit, les checkpoints automatiques les plus anciens des créations que tu n'as pas ouvertes depuis 30 jours sont retirés en premier. Un enregistrement est toujours conservé, même alors : il est écrit comme le travail actuel, et l'historique indique que cet enregistrement n'est pas conservé comme version. **Paramètres → Stockage** montre combien l'historique utilise.

La page **History** (`#/history`, ou **Open app history** dans le panneau) couvre chaque création dans ce navigateur. Sur un ordinateur, ouvre la page depuis le bouton horloge en haut à droite de l'écran d'accueil ou de **Projets**. Sur un téléphone, va dans la galerie d'outils sur l'écran d'accueil, appuie sur le bouton logo rond en haut à droite et choisis **Sessions enregistrées**, ce qui ouvre History. Depuis **Projets**, cet élément ne fait encore rien.

- **Récents** liste tes créations, les plus récentes en premier, avec **Reprendre**.
- **Changes** regroupe les points de contrôle, les téléchargements et les résultats de Convert sur une même chronologie. Un téléchargement a **Reopen settings**.
- **Milestones** liste les versions nommées.

Filtre par projet, outil et date (derrière **Filters** sur un téléphone). La page History n'a pas de bouton de suppression ; pour retirer un élément, utilise Projets.
:::

## Transférer ton travail vers un autre appareil

| Pour | Utilise |
|---|---|
| Garder tes appareils synchronisés | **Synchroniser entre appareils**, sous **Paramètres → Services connectés** : voir [Synchroniser tes appareils](/info/sync.html) |
| Tout transférer une fois | **Exporter mes données** et **Importer les données…**, ci-dessous |
| Remettre un design ou un projet | Un fichier `.lolly` : **Exporter**, puis **Partager**, puis **Download .lolly** ; pour un projet entier, **Download project (.lolly)** dans le menu du dossier. Appuie sur **Ouvrir** sur l'autre appareil. Voir [Le fichier .lolly](/info/using.html#the-lolly-file) |

Un lien de partage transporte tes réglages, mais pas les images ou fichiers que tu as ajoutés depuis ton appareil.

::: note L'import n'ajoute ni ne supprime rien
Les dossiers, favoris et modèles du fichier sont ajoutés à côté de ceux déjà présents sur l'autre appareil. Quand un élément enregistré existe des deux côtés, la copie enregistrée le plus récemment est conservée. Tes coordonnées et réglages sur cet appareil restent tels quels ; ceux qui sont vides sont complétés depuis le fichier. **Importer sur cet appareil**, dans Sync, fonctionne de la même façon.
:::

Pour tout transférer une fois :

1. Sur l'ancien appareil, ouvre **Paramètres → Stockage** et, sous **Déplacer vers un autre appareil**, appuie sur **Exporter mes données**. Lolly télécharge un fichier `.zip` dont le nom commence par `LollyTools-`.
2. Transporte le fichier par USB, e-mail à toi-même, AirDrop ou un dossier partagé.
3. Sur le nouvel appareil, ouvre **Paramètres → Stockage**, appuie sur **Importer les données…**, choisis le fichier et appuie sur **Import**.

::: note Ce qui ne voyage pas
Les connexions, les clés et la phrase secrète de synchronisation restent sur chaque appareil. La liste des téléchargements récents, les téléchargements hors ligne et les modèles d'IA ne voyagent par aucune voie. L'historique des versions ne voyage que dans un fichier **Exporter mes données**, pas via Sync ou un `.lolly`. Quand l'historique est trop volumineux pour un seul fichier, les checkpoints automatiques les plus anciens sont laissés de côté, et la ligne d'export indique combien. Une copie que Sync conserve dans ton espace de stockage peut être téléchargée et ouverte, ou choisie dans **Importer les données…**, comme un fichier de sauvegarde ; une copie chiffrée demande ta phrase secrète.
:::

::: details Ce que contient le fichier de sauvegarde
Le fichier s'appelle `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (les parties du nom viennent de ton profil et sont omises si non définies ; `<n>` est un compteur par jour pour que des exports le même jour n'entrent pas en collision). Il contient ton profil, avec tes dossiers, la Corbeille, les modèles et favoris ; chaque session enregistrée avec sa vignette ; tes images importées, polices, logos et les copies de tes téléchargements ; tes systèmes de design ; tes préférences (thème, largeur de la barre latérale, statistiques d'activité locales) ; les versions enregistrées et les résultats de Convert ; et, depuis l'application web, l'historique des versions de tes créations.

Le cache du catalogue n'est pas inclus - il se retélécharge tout seul sur le nouvel appareil. Chaque partie est checksumée, donc un fichier endommagé en transit est détecté à l'import plutôt que restauré à moitié cassé. Les sessions enregistrées se relient automatiquement à tes images importées. Les applications web, de bureau et mobiles lisent le même fichier ; l'application terminal écrit sa propre sauvegarde plus simple, que ce format ne lit pas. **📦 Exporter mes données et tout générer** crée le même fichier plus un second zip avec chaque session enregistrée rendue vers sa sortie. (Spécification complète du format : [Transfert de données](/info/data-transfer.html).)
:::

## Si tu effaces les données de ton navigateur

Dans l'application web, Lolly conserve tout dans le stockage de ton navigateur pour ce site : travail enregistré, images, polices, systèmes de design, historique des versions et téléchargements hors ligne. Effacer les données de ce site dans ton navigateur supprime tout cela, et Lolly ne peut rien en récupérer. Ce qui reste, c'est ce qui a déjà quitté le navigateur : les fichiers que tu as téléchargés, un fichier **Exporter mes données**, une copie [Sync](/info/sync.html) et les liens que tu as partagés.

::: warning Avant d'effacer les données du navigateur
Appuie sur **Exporter mes données** sous **Paramètres → Stockage**, et conserve le fichier ailleurs.
:::

Au démarrage de l'application, Lolly demande au navigateur de ne pas effacer son stockage quand l'appareil manque d'espace. C'est le navigateur qui décide. Sous **Paramètres → Disponible hors ligne**, une ligne commençant par **Protected** signifie que le navigateur a accepté ; "The browser may clear downloads if the device runs low on space" signifie qu'il n'a pas accepté, et **Protect downloads** redemande. Si le navigateur n'a pas accepté, il peut effacer le travail enregistré autant que les téléchargements quand l'espace manque, garde donc un fichier récent **Exporter mes données**.

**Paramètres → Stockage** montre combien d'espace utilise chaque type de données. Sa ligne **Historique** compte les checkpoints automatiques, leurs aperçus et les brouillons de récupération ; **Supprimer les checkpoints automatiques de plus de 30 jours** libère cet espace et garde les versions enregistrées et nommées. **Vider le cache** abandonne les fichiers de catalogue téléchargés, qui se retéléchargent en cas de besoin. **Effacer toutes mes données** te demande de taper un mot, désactive Sync, puis supprime tout ce que Lolly conserve dans ce navigateur : ton profil et tes réglages, les sessions enregistrées avec leur historique et la Corbeille, les imports, les polices et les design systems, le journal de téléchargement, les résultats de Convert, les modèles d'IA téléchargés et les copies hors ligne. Les fichiers que tu as téléchargés restent où tu les as enregistrés. L'application redémarre alors comme lors d'une première visite.

![La carte de stockage sur un écran de largeur téléphone : chaque catégorie de données présentes sur l'appareil est nommée, avec le bouton Effacer toutes mes données en bas](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Dans les applications de bureau et mobiles, les sessions enregistrées sont des fichiers dans le propre dossier de données de l'application, et le reste se trouve dans le stockage propre de l'application, donc effacer un navigateur web ne les touche pas.

::: details Où les applications de bureau et mobiles conservent les sessions enregistrées
Un fichier par session enregistrée, dans un dossier `saved-state` :

- macOS : `~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows : `%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux : `~/.local/share/tools.lolly.Desktop/saved-state/`, ou le même chemin sous `$XDG_DATA_HOME`
- iPhone, iPad et Android : à l'intérieur du stockage propre de l'application, que l'app Files ne montre pas

Les images, systèmes de design et la liste des téléchargements récents restent dans le stockage interne de l'application, pas dans ces dossiers. L'application terminal et la ligne de commande lisent le même dossier `saved-state` : voir [Où vivent les sessions enregistrées](/info/cli-reference.html#where-saved-sessions-live).
:::

## Récupérer quelque chose que tu as supprimé

Supprimer une session enregistrée, un dossier, l'un de tes imports ou l'une de tes polices dans l'application le déplace vers la **Corbeille** pendant 30 jours, où que tu le supprimes : **Projets**, **Éléments**, **Paramètres → Stockage** ou la liste des sessions enregistrées d'un outil. Un dossier part avec tout son contenu, comme une seule entrée. Une session garde son historique de versions tant qu'elle y est. Juste après, un message propose **Annuler**. Plus tard :

1. Ouvre la **Corbeille** : la tuile **Corbeille** dans **Projets**, le bouton **Corbeille** dans **Éléments → Tes imports**, ou la ligne **Corbeille** dans **Paramètres → Stockage**. Les trois ouvrent la même liste.
2. Appuie sur **Restaurer** à côté de l'élément. Il retourne dans son dossier, et une police retrouve les rôles qu'elle avait dans son design system.

**Supprimer définitivement** retire un élément pour de bon. **Vider la corbeille** demande d'abord confirmation, puis retire tous les éléments de la Corbeille. Les éléments de plus de 30 jours sont retirés définitivement.

::: warning Certaines suppressions sont immédiates
Supprimer un design system, un logo ou ta photo de profil ne passe pas par la Corbeille. La ligne de commande et l'application terminal suppriment aussi immédiatement.
:::

Avec la [synchronisation](/info/sync.html) activée, **Restore an earlier copy** peut ramener l'état d'un jour antérieur de l'appareil entier, et un fichier **Exporter mes données** ramène ce que le fichier contient.
