# Retrouver et récupérer ton travail

Quelque chose manque : un design que tu n'as jamais enregistré, un fichier que tu as téléchargé, la version de la semaine dernière, ou tout après l'effacement du navigateur. Commence par le tableau, puis suis la section vers laquelle il renvoie.

Le travail personnel reste dans le navigateur ou l'application où tu l'as créé, sur cet appareil, sauf si tu actives [Sync](/info/sync.html). Une organisation qui utilise Lolly Work, facultatif, conserve aussi des **Team projects** sur son serveur, traités plus bas.

| Ce que tu as fait | Où regarder |
|---|---|
| Appuyé sur **Enregistrer sous** ou **Enregistrer** | **Projets** |
| Appuyé sur **Télécharger** | Les téléchargements de ton navigateur, et une copie dans **Éléments** |
| Ni l'un ni l'autre, dans un [outil qui enregistre au fil du travail](#which-tools-save-as-you-work) | **Projets** et **Historique** |
| Ni l'un ni l'autre, dans un outil qui ne le fait pas | Seulement l'onglet où tu as travaillé, jusqu'à ce que tu le fermes |
| Supprimé dans l'application | **Corbeille**, dans **Projets**, **Éléments** ou **Paramètres → Stockage**, pendant 30 jours |

::: figure find-your-work-places
Où vit ton travail : le stockage propre du navigateur contient Projects, History et Trash ; les téléchargements vont dans les dossiers de ton appareil ; Sync et un fichier de sauvegarde sont les copies hors du navigateur.
:::

::: details Retrouver le travail partagé dans Lolly Work (facultatif)
Ouvre le Lolly de ton organisation et connecte-toi, puis regarde dans **Projects → Team projects**. Les sessions partagées sont détenues par cette instance et apparaissent selon ton accès. Se connecter peut rétablir l'accès à ces sessions sur un autre appareil ; cela ne restaure ni ta bibliothèque personnelle ni la sauvegarde de l'appareil.

Dans une [collab de travail](/info/collaborate.html#work-collabs-with-lolly-work-optional), attends **Saved to work** avant de partir. Si un projet partagé manque, vérifie que tu es connecté à la bonne instance et demande à son opérateur au sujet de l'accès ou de la conservation. Effacer les données du navigateur supprime les copies locales, pas la copie du serveur de l'organisation. Voir [Use Lolly at your organisation](/info/organisation.html).
:::

## Retrouver quelque chose que tu as enregistré

1. Appuie sur **Accueil** en haut à gauche de l'outil.
2. Ouvre l'onglet **Projets** en haut de l'écran d'accueil (l'icône de dossier sur un téléphone).
3. Regarde le premier écran. Le travail enregistré dans **Ma bibliothèque** s'y trouve, et chaque projet est un dossier. Pour rechercher dans tous les dossiers à la fois, tape dans **Rechercher dans tous les projets…** au bas de l'écran.

Un élément porte le nom de fichier que tu as saisi dans le panneau d'export, ou le nom de son outil, comme **QR Code**, si tu n'en as saisi aucun. Ouvre l'élément et tous les réglages sont de retour, prêts à être modifiés et exportés à nouveau. Pour conserver ainsi du nouveau travail, voir [Saving & continuing](/info/using.html#saving-continuing).

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

- <!--i:folder--> **Des dossiers imbriqués.** Regroupe les sessions enregistrées dans des dossiers, et des dossiers dans des dossiers, aussi profond que tu veux. Crée un dossier, renomme-le ou fais glisser une tuile sur un autre dossier pour la déplacer ; un fil d'Ariane te ramène vers le haut. Les sessions enregistrées sans dossier apparaissent directement à la racine de **Projects**.
- <!--i:clock--> **Trie à ta façon.** **View options**, le bouton à curseurs en haut à droite, propose **Grid** ou **List** et trie par **Name**, **Date added**, **Last modified** (le défaut), **Size** et, dans un dossier, **By tool**. Les dossiers passent toujours en premier quel que soit le tri actif - le tri n'ordonne que les sessions et les dossiers au sein de leur propre groupe.
- <!--i:document--> **Range du nouveau travail directement.** **New asset** ouvre le sélecteur partagé. Choisis **Templates** pour partir d'un modèle enregistré : ouvre-le pour le modifier, ou utilise **+ Add** pour enregistrer aussitôt une nouvelle création.
- <!--i:checklist--> **Sélection multiple (bureau).** Coche la case d'une tuile, fais glisser un cadre de sélection sur un espace vide ou **Shift/Cmd-clic** ; fais un **clic droit** sur une tuile pour son menu contextuel. La barre de sélection propose alors **Render selection**, **Move to…**, **New folder**, **Delete** (qui déplace dans la Corbeille), **Edit together** pour deux à huit sessions d'un seul outil, côte à côte sous une même barre latérale, et **Edit as sheet**, qui ouvre une sélection de n'importe quelle taille ou composition sous forme de lignes dans la grille de Batch.
- <!--i:download--> **Rendre un dossier ou une sélection entière.** **Render folder** exporte chaque session enregistrée d'un dossier - sous-dossiers compris - dans un seul `.zip` imbriqué. **Render selection** fait de même pour toute sélection multiple, et une session seule se rend directement dans son propre fichier.
- <!--i:link--> **Aller droit au travail enregistré d'un outil.** Coche un ou plusieurs outils dans la galerie Tools et choisis **View sessions** dans la barre de sélection - Projects s'ouvre en n'affichant que les sessions créées avec ces outils, avec un **Clear** pour revenir à la vue complète.
- <!--i:link--> **Partager une session enregistrée.** Fais un clic droit sur une session (sur un téléphone, appuie sur **•••** sur sa tuile) → **Share link** pour copier un lien qui la rouvre avec les mêmes réglages ; les images de ton appareil ne voyagent pas avec un lien (la boîte de dialogue Share complète : voir [Sharing your work](/info/using.html#sharing-your-work)).
- <!--i:pentool--> **Renommer ou copier une session.** Fais un clic droit sur une session (sur un téléphone, appuie sur **•••** sur sa tuile) pour **Rename**, **Duplicate** (une copie dans le même dossier) et **Move to…**.

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

- **Tu as fermé l'onglet, ou tu es revenu une autre fois.** Le travail non enregistré est perdu, sauf dans les [outils qui enregistrent pendant que tu travailles](#which-tools-save-as-you-work) : ouvre ce travail depuis **Projects**.
- **Tu as rechargé la page dans le même onglet.** Tes réglages reviennent depuis l'adresse de la page. Dans les outils qui n'enregistrent pas pendant que tu travailles, les images et fichiers ajoutés depuis ton appareil, et le texte d'une seule ligne de plus de 150 caractères, ne reviennent pas, car l'adresse ne les contient pas.
- **Tu as appuyé sur Home, ou sur le bouton retour en haut à gauche.** Si tu as modifié quelque chose depuis ton dernier enregistrement, téléchargement ou copie, une boîte de dialogue **Unsaved edits** demande s'il faut d'abord enregistrer. **Save & leave** enregistre le travail et t'emmène dans **Projects**, ou de retour dans le dossier de projet d'où tu as ouvert le travail. **Leave anyway** abandonne tes modifications : un élément enregistré revient à son dernier état enregistré, et une création jamais enregistrée quitte **Projects**. **Cancel** te garde dans l'outil.

Lolly ne demande que lorsque tu appuies sur **Accueil** ou le bouton retour dans un outil. Fermer l'onglet, recharger et le propre bouton retour de ton navigateur ne demandent jamais. Pour être sûr, appuie sur **Enregistrer sous**, ou **Enregistrer** dans le panneau d'export, avant de quitter un outil.

Quand la récupération automatique n'est pas disponible, une note à côté des contrôles d'édition dit quoi conserver :

- Dans un outil qui travaille sur un fichier que tu apportes, enregistre tes réglages et garde aussi les fichiers d'origine.
- Dans un outil d'enregistrement, ou un utilitaire sans action Save, enregistre ou télécharge le résultat avant de partir.
- Les applications de bureau et mobiles disent quand tu dois enregistrer à la main.
- Dans une collaboration privée, la personne qui a invité conserve le document et son historique, y compris les modifications de l'autre personne. La personne qui a rejoint travaille sur une copie temporaire et doit enregistrer une copie séparée avant la fin de la session.

::: note Parti sans enregistrer par erreur ?
Dans les outils qui enregistrent au fil du travail, l'historique conserve une copie des modifications abandonnées. Ouvre la page **Historique**, trouve-les sous **Changes** et appuie sur **Ouvrir comme copie**. Dans les autres outils, les modifications ont disparu.
:::

::: details Quels outils enregistrent au fil du travail
Dans l'application web, chaque outil qui crée un document enregistre au fil du travail : Design, Chart, QR Code, Text, Sandbox et les autres. Ces outils ne le font pas :

- les outils qui travaillent sur un fichier que tu apportes, comme Redact, Sign ou Convert Image, car Lolly ne garde jamais de copie de ce fichier ;
- les outils qui enregistrent depuis ta caméra, ton microphone ou ton écran, comme Record, Screen Capture et Voice Recorder ;
- un outil sans rien à modifier, comme Countdown.

Dans les autres outils, ta première modification range le travail dans **Projects** comme si tu l'avais enregistré, et les modifications suivantes sont conservées au fil du travail une fois que l'outil a fini de dessiner. Une création non enregistrée est toujours dans Projects après que tu fermes l'onglet, et se rouvre avec ses modifications marquées comme non enregistrées.

**Leave anyway** abandonne quand même ces modifications, et History conserve une copie des modifications abandonnées pendant 30 jours. Rouvrir l'outil depuis l'écran d'accueil démarre une nouvelle création ; ouvre la précédente depuis Projects.

3D et Darkroom enregistrent au fil du travail, mais ils ne conservent pas un fichier que tu y charges, comme un modèle 3D ou une LUT. History et **Save** gardent le nom, le type et la taille du fichier, pas le fichier. Quand tu rouvres le travail, une note dit de quel fichier il s'agissait, et l'outil fonctionne sans lui jusqu'à ce que tu le charges de nouveau. Garde tes fichiers d'origine.

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

La page **History** (`#/history`) couvre chaque création de ce navigateur. Pour l'ouvrir, appuie sur le bouton horloge en haut à droite de l'écran d'accueil ou de **Projects**, choisis **Saved sessions** dans le menu du profil (sur un téléphone, le bouton rond du logo en haut à droite), ou appuie sur **Open app history** dans le panneau History d'un outil. Les applications de bureau et mobiles n'ont pas de page History ; là, le bouton horloge de l'écran d'accueil et **Saved sessions** ouvrent donc **Your recent work** : tes dernières sessions enregistrées et tes derniers exports, avec un lien vers Projects.

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

Le cache du catalogue n'est pas inclus : il se retélécharge tout seul sur le nouvel appareil. Chaque partie a une somme de contrôle, donc un fichier endommagé en transit est repéré à l'import plutôt que restauré à moitié cassé. Les sessions enregistrées se relient automatiquement à tes images importées. Les applications web, de bureau et mobiles lisent le même fichier ; l'application de terminal écrit une sauvegarde plus simple qui lui est propre, que ce format ne lit pas. **Export my data & render everything** produit le même fichier plus un second zip avec chaque session enregistrée rendue dans sa sortie. (Spécification complète du format : [Data transfer](/info/data-transfer.html).)
:::

## Si tu effaces les données de ton navigateur

Dans l'application web, Lolly conserve tout dans le stockage de ton navigateur pour ce site : travail enregistré, images, polices, systèmes de design, historique des versions et téléchargements hors ligne. Effacer les données de ce site dans ton navigateur supprime tout cela, et Lolly ne peut rien en récupérer. Ce qui reste, c'est ce qui a déjà quitté le navigateur : les fichiers que tu as téléchargés, un fichier **Exporter mes données**, une copie [Sync](/info/sync.html) et les liens que tu as partagés.

::: warning Avant d'effacer les données du navigateur
Appuie sur **Exporter mes données** sous **Paramètres → Stockage**, et conserve le fichier ailleurs.
:::

Au démarrage de l'application, Lolly demande au navigateur de ne pas effacer son stockage quand l'appareil manque d'espace, et le navigateur décide. Sous **Settings → Available offline**, une ligne commençant par **Protected** signifie que le navigateur a accepté. « The browser may clear downloads if the device runs low on space » signifie qu'il n'a pas accepté, et **Protect downloads** redemande.

Si le navigateur n'a pas accepté, il peut effacer le travail enregistré en plus des téléchargements quand l'espace manque ; garde donc un fichier **Export my data** récent.

**Paramètres → Stockage** montre combien d'espace utilise chaque type de données. Sa ligne **Historique** compte les checkpoints automatiques, leurs aperçus et les brouillons de récupération ; **Supprimer les checkpoints automatiques de plus de 30 jours** libère cet espace et garde les versions enregistrées et nommées. **Vider le cache** abandonne les fichiers de catalogue téléchargés, qui se retéléchargent en cas de besoin. **Effacer toutes mes données** te demande de taper un mot, désactive Sync, puis supprime tout ce que Lolly conserve dans ce navigateur : ton profil et tes réglages, les sessions enregistrées avec leur historique et la Corbeille, les imports, les polices et les design systems, le journal de téléchargement, les résultats de Convert, les modèles d'IA téléchargés et les copies hors ligne. Les fichiers que tu as téléchargés restent où tu les as enregistrés. L'application redémarre alors comme lors d'une première visite.

![La carte de stockage sur un écran de la largeur d'un téléphone : chaque catégorie de données sur l'appareil est nommée, avec le bouton Clear all my data en bas](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

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
