# Retrouver et récupérer ton travail

Tout ce que tu crées dans Lolly reste dans le navigateur ou l'application où tu l'as créé, sur cet appareil, sauf si tu actives la [synchronisation](/info/sync.html). Le travail enregistré est dans **Projets**. Un fichier téléchargé se trouve là où ton navigateur ou ton système l'a placé, et une copie attend généralement dans **Éléments**. Dans neuf outils, le travail jamais enregistré est conservé aussi. Cette page couvre chacun de ces cas, plus un onglet fermé, des données de navigateur effacées, des versions antérieures, des éléments supprimés et le transfert vers un autre appareil.

| Ce que tu as fait | Où regarder |
|---|---|
| Appuyé sur **Enregistrer sous** ou **Enregistrer** | **Projets** |
| Appuyé sur **Télécharger** | Les téléchargements de ton navigateur, et une copie dans **Éléments** |
| Ni l'un ni l'autre, dans l'un des [neuf outils qui enregistrent au fil du travail](#the-nine-tools-that-save-as-you-work) | **Projets** et **History** |
| Ni l'un ni l'autre, dans un autre outil | Seulement l'onglet où tu as travaillé, jusqu'à ce que tu le fermes |
| Déplacé vers la Corbeille | La tuile **Corbeille** dans **Projets**, pendant 30 jours |

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

- **Tu as fermé l'onglet, ou tu reviens une autre fois.** Le travail non enregistré a disparu, sauf dans les [neuf outils](#the-nine-tools-that-save-as-you-work), qui enregistrent tes modifications au fil du travail : ouvre-les depuis **Projets**.
- **Tu as rechargé la page dans le même onglet.** Tes réglages reviennent depuis l'adresse de la page. Dans les outils autres que les neuf, les images et fichiers que tu as ajoutés depuis ton appareil, et le texte sur une ligne de plus de 150 caractères, ne reviennent pas, parce que l'adresse ne les contient pas.
- **Tu as appuyé sur Accueil, ou le bouton retour en haut à gauche.** Si tu as changé quelque chose depuis ton dernier enregistrement, téléchargement ou copie, une boîte de dialogue **Modifications non enregistrées** demande s'il faut d'abord enregistrer. **Enregistrer et quitter** enregistre le travail et t'emmène vers **Projets**, ou vers le dossier de projet depuis lequel tu as ouvert le travail. **Quitter sans enregistrer** quitte ; dans les neuf outils, tes modifications sont déjà enregistrées et restent dans Projets. **Annuler** te garde dans l'outil.

Lolly ne demande que lorsque tu appuies sur **Accueil** ou le bouton retour dans un outil. Fermer l'onglet, recharger et le propre bouton retour de ton navigateur ne demandent jamais. Pour être sûr, appuie sur **Enregistrer sous**, ou **Enregistrer** dans le panneau d'export, avant de quitter un outil.

::: note Parti sans enregistrer par erreur ?
Dans les outils autres que les neuf, appuie immédiatement sur le bouton retour de ton navigateur. Les réglages de l'adresse de la page reviennent, mais pas les images que tu as ajoutées depuis ton appareil. Appuie ensuite sur **Enregistrer sous** et **Enregistrer** avant de faire quoi que ce soit d'autre : cette fois, Lolly ne demande pas avant que tu partes.
:::

::: details Les neuf outils qui enregistrent au fil du travail
[Design](/#/tool/design), [Graphique](/#/tool/chart), [QR Code](/#/tool/qr-code), [Gradient](/#/tool/gradient), [Snippet](/#/tool/snippet), [Diagramme de flux](/#/tool/org-chart), [Tarifs](/#/tool/pricing-table), [Logotype](/#/tool/wordmark) et [Texte](/#/tool/text-helper). La liste s'allonge à mesure que d'autres outils gagnent l'enregistrement automatique.

Dans ces outils, ta première modification classe le travail dans **Projets** comme si tu avais enregistré, et les modifications suivantes sont conservées en quelques secondes. Une création non enregistrée reste donc dans Projets après la fermeture de l'onglet, et **Quitter sans enregistrer** ne rejette pas tes modifications. Rouvrir l'outil depuis l'écran d'accueil démarre une nouvelle création ; ouvre l'ancienne depuis Projets.

Cela ne fonctionne que dans l'application web, pas dans les applications de bureau ou mobiles, et pas pendant que tu travailles en direct avec quelqu'un d'autre.
:::

## Retrouver un fichier téléchargé

Dans un navigateur, **Télécharger** remet le fichier à ton navigateur, qui l'enregistre dans son dossier de téléchargements (généralement **Téléchargements**) ou te demande où. Lolly n'est pas informé de l'endroit où le fichier est allé, regarde donc dans la liste des téléchargements de ton navigateur.

Si aucun fichier n'est apparu, regarde dans le panneau d'export tant que tu es encore dans l'outil. Sous **Télécharger**, une ligne indique le nom du fichier et l'heure, avec **Retry download**, et dans Chrome, Edge et les autres navigateurs Chromium, **Save file…** pour choisir toi-même un dossier. La ligne et son fichier durent jusqu'à ce que tu quittes l'outil, recharges ou exportes à nouveau.

Lolly conserve aussi deux choses après chaque téléchargement :

- **Une copie du fichier**, dans **Éléments** sous **Tes imports**, tant que **Enregistrer mes rendus dans ma bibliothèque** est activé sous **Paramètres → Tes rendus** (**Paramètres** se trouve au bas de l'écran d'accueil). Le réglage est activé par défaut. Une vidéo, ou un fichier de plus de 50 Mo, demande d'abord confirmation, et un zip n'est pas copié.
- **Les réglages que tu as utilisés**, pour tes 24 derniers téléchargements. **Exports récents**, sous ton travail enregistré dans **Projets**, rouvre l'outil avec ces réglages pour que tu puisses refaire le fichier, bien que les images et fichiers que tu as ajoutés depuis ton appareil ne soient pas inclus. La même liste se trouve sous **Paramètres → Activité et statistiques → Derniers exports** et dans l'onglet **Changes** de **History**. Cette liste conserve les réglages, pas les fichiers.

::: details Dans les applications de bureau et mobiles
- **Application de bureau :** **Télécharger** enregistre directement dans un dossier **Lolly** à l'intérieur de ton dossier **Téléchargements**, sans boîte de dialogue. Un message confirme l'enregistrement et propose **Révéler** pour montrer le fichier. **Open Exports Folder**, dans le menu **Window** ou **Exports**, ouvre le dossier à tout moment. Un fichier portant le même nom qu'un précédent est enregistré comme "name (1)".
- **iPhone et iPad :** le fichier est enregistré dans l'app **Files**, sous **Lolly**, et la feuille de partage s'ouvre pour que tu puisses l'envoyer ailleurs.
- **Android :** le menu de partage s'ouvre pour que tu puisses choisir où va le fichier.

Sur iPhone, iPad et Android, un nouveau fichier remplace un précédent portant le même nom.
:::

## Revenir à une version antérieure

- **Pendant cette visite :** **Annuler** remonte tes 100 dernières modifications, jusqu'à ce que tu quittes l'outil ou recharges. Voir [Annuler et rétablir](/info/using.html#undo-and-redo).
- **Dans les neuf outils qui enregistrent au fil du travail :** les versions antérieures de chaque création sont conservées. Suis les étapes ci-dessous.
- **Tout sur l'appareil :** avec la [synchronisation](/info/sync.html) activée, **Restore an earlier copy**, sous **Paramètres → Services connectés**, ramène l'une des sept dernières copies quotidiennes, ou la copie d'avant ta dernière application. Tout sur cet appareil correspond alors à cette copie, pas seulement un design.

Pour ouvrir une version antérieure dans l'un des neuf outils :

1. Appuie sur **History**, le bouton horloge à côté d'**Annuler** et **Rétablir**. Dans Design, **History** se trouve dans la barre du haut ; sur un téléphone, appuie sur **•••** puis **History**.
2. Trouve la version par sa date et son heure. Les lignes **Automatic checkpoint** sont prises au fil du travail ; les lignes **Saved version** sont les moments où tu as enregistré.
3. Appuie sur **Open as a copy**. La version s'ouvre comme une nouvelle création, et celle que tu avais ouverte reste telle quelle. La copie est dans **Projets**, avec "(copy)" après son nom.

Pour conserver une version sous un nom, appuie sur **Name version**, tape un nom et appuie sur **Keep milestone**. Les versions nommées sont listées sur la page **History**, sous **Milestones**.

::: details Le panneau History et la page History
Le panneau **History** liste aussi des lignes **Recovered work**, et **Protected drafts** contient tes dernières modifications entre les points de contrôle, avec **Open draft as a copy**. **Compare** et **Check assets** t'aident à choisir avant d'ouvrir une copie. Bascule **This creation** vers **All history on this device** pour voir toutes les créations.

Les points de contrôle automatiques s'éclaircissent avec le temps : un par minute pour la dernière heure, un par heure pour le dernier jour, un par jour pendant 30 jours, puis un par semaine. Les versions enregistrées sont toutes conservées. Supprimer une création depuis **Paramètres → Stockage** supprime aussi ses versions.

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

::: warning L'import remplace tes dossiers
Si l'autre appareil a déjà du travail, lis ceci d'abord. L'import ajoute ce que le fichier contient, met à jour les éléments qui correspondent et ne supprime aucun élément enregistré. Ton profil est cependant une seule fiche, donc les dossiers, favoris, modèles et informations sur cet appareil sont remplacés par ceux du fichier. Un élément enregistré qui n'existait que sur cet appareil reste, au niveau supérieur de **Projets**. **Bring it to this device**, dans Sync, fait de même.
:::

Pour tout transférer une fois :

1. Sur l'ancien appareil, ouvre **Paramètres → Stockage** et, sous **Déplacer vers un autre appareil**, appuie sur **Exporter mes données**. Lolly télécharge un fichier `.zip` dont le nom commence par `LollyTools-`.
2. Transporte le fichier par USB, e-mail à toi-même, AirDrop ou un dossier partagé.
3. Sur le nouvel appareil, ouvre **Paramètres → Stockage**, appuie sur **Importer les données…**, choisis le fichier et appuie sur **Import**.

::: note Ce qui ne voyage pas
Les connexions, les clés et la phrase secrète de synchronisation restent sur chaque appareil. La liste des téléchargements récents, les téléchargements hors ligne et les modèles d'IA ne voyagent par aucune voie. L'historique des versions ne voyage que dans un fichier **Exporter mes données**, pas via Sync ou un `.lolly`. Les copies que Sync conserve dans ton espace de stockage ne s'ouvrent que via Sync, pas avec **Importer les données…** ou **Ouvrir**.
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

**Paramètres → Stockage** montre combien d'espace utilise chaque type de données. **Vider le cache** supprime les fichiers de catalogue téléchargés, qui se retéléchargent en cas de besoin. **Effacer toutes mes données** te demande de taper un mot, puis supprime ton profil, tes sessions enregistrées, tes images téléversées et le cache d'assets. Les autres données restent, y compris l'historique des versions, la liste des téléchargements récents, les résultats de Convert, les systèmes de design et les modèles d'IA téléchargés. Pour tout supprimer, efface les données de ce site dans ton navigateur.

![La carte de stockage sur un écran de largeur téléphone : chaque catégorie de données présentes sur l'appareil est nommée, avec le bouton Effacer toutes mes données en bas](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

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

Dans **Projets**, **Déplacer vers la corbeille** conserve un élément pendant 30 jours. Un dossier part à la Corbeille avec tout son contenu, comme une seule entrée. Juste après, un message propose **Annuler** pendant environ dix secondes. Plus tard :

1. Ouvre **Projets** et appuie sur la tuile **Corbeille**. La tuile n'apparaît que tant que la Corbeille contient quelque chose.
2. Appuie sur **Restaurer** à côté de l'élément.

**Supprimer définitivement** et **Vider la corbeille** retirent les éléments immédiatement, sans demander. Les éléments de plus de 30 jours sont retirés définitivement la prochaine fois que tu ouvres Projets.

::: warning Les autres suppressions sont définitives
Supprimer une session enregistrée sous **Paramètres → Stockage**, ou depuis la liste des sessions enregistrées d'un outil dans la galerie (clic droit sur la carte de l'outil, puis **N sessions enregistrées**), retire la session définitivement, avec son historique de versions. Une image que tu supprimes depuis **Mes images** est retirée immédiatement, sans demander.
:::

Avec la [synchronisation](/info/sync.html) activée, **Restore an earlier copy** peut ramener l'état d'un jour antérieur de l'appareil entier, et un fichier **Exporter mes données** ramène ce que le fichier contient.
