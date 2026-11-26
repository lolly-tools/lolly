# Retrouver et récupérer ton travail

Retrouve un design que tu n'as jamais enregistré, un fichier téléchargé, la version de la semaine dernière ou ton travail après l'effacement des données du navigateur. Commence par le tableau.

Ton travail personnel reste dans le navigateur ou l'application où tu l'as créé, sur cet appareil, sauf si tu actives [Sync](/info/sync.html). Une organisation qui utilise l'option Lolly Work conserve aussi **Team projects** sur son serveur.

| Ce que tu as fait | Où chercher |
|---|---|
| Appuyé sur **Save as** ou **Save** | **Projects** |
| Appuyé sur **Download** | Les téléchargements de ton navigateur et une copie dans **Assets** |
| Aucun des deux, dans un [outil qui enregistre pendant que tu travailles](#which-tools-save-as-you-work) | **Projects** et **History** |
| Aucun des deux, dans un outil qui ne le fait pas | Seulement l'onglet où tu as travaillé, jusqu'à sa fermeture |
| Supprimé l'élément dans l'application | **Trash**, dans **Projects**, **Assets** ou **Settings → Storage**, pendant 30 jours |

::: figure find-your-work-places
Où ton travail est conservé : le stockage du navigateur contient Projects, History et Trash ; les téléchargements vont dans les dossiers de ton appareil ; Sync et un fichier de sauvegarde sont les copies hors du navigateur.
:::

::: details Retrouver du travail partagé dans Lolly Work (facultatif)
Ouvre le Lolly de ton organisation, connecte-toi et regarde dans **Projects → Team projects**. Cette instance contient des sessions partagées et affiche celles auxquelles tu as accès. Te connecter sur un autre appareil peut rétablir l'accès à ces sessions. La connexion ne restaure ni ta bibliothèque personnelle ni la sauvegarde de ton appareil.

Dans une [collaboration de travail](/info/collaborate.html#collabs-through-lolly-work-optional), attends **Saved to work** avant de partir. Si un projet partagé manque, vérifie que tu es connecté à la bonne instance et demande à son opérateur ce qu'il en est des accès ou de la conservation. Effacer les données du navigateur supprime les copies locales, pas celle sur le serveur de l'organisation. Voir [Utiliser Lolly dans ton organisation](/info/organisation.html).
:::

<!--i:eti-search-->
## Retrouver quelque chose que tu as enregistré

1. Appuie sur **Home** en haut à gauche de l'outil.
2. Ouvre l'onglet **Projects** en haut de l'écran d'accueil (l'icône de dossier sur un téléphone).
3. Tout ce que tu as enregistré dans **My library** se trouve sur le premier écran. Chaque projet est un dossier. Pour rechercher dans tous les dossiers, saisis du texte dans **Search all projects…** en bas de l'écran.

Un élément prend le nom de fichier que tu as saisi dans le panneau d'export. Sans nom de fichier, il prend le nom de son outil, par exemple **QR Code**. Ouvrir l'élément restaure tous les réglages. Pour enregistrer un nouveau travail, voir [Enregistrer & reprendre](/info/using.html#saving-continuing).

::: note Absent de Projects ?
- Il est peut-être dans **Trash** : voir [Récupérer quelque chose que tu as supprimé](#get-back-something-you-deleted).
- Un autre navigateur, une fenêtre privée ou un autre appareil démarre à vide, sauf si tu utilises [Sync](/info/sync.html) ou [transfères ton travail](#move-your-work-to-another-device).
- Si tu as seulement appuyé sur **Download**, voir [Retrouver un fichier téléchargé](#find-a-file-you-downloaded).
:::

::: details Travailler avec Projects
Tu peux aussi ouvrir la vue **Projects** depuis **Settings → Storage → Saved sessions → Organise in Projects**. Elle fonctionne comme un gestionnaire de fichiers :

![Projects avant tout enregistrement : les tuiles New folder, New asset et Templates, l'horloge History en haut à droite et la barre Search all projects en bas](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **Des dossiers imbriqués.** Place les sessions enregistrées dans des dossiers, et les dossiers dans d'autres dossiers, à n'importe quelle profondeur. Crée ou renomme un dossier, ou fais glisser une tuile sur un dossier pour la déplacer. Un fil d'Ariane te permet de remonter. Les sessions enregistrées sans dossier se trouvent à la racine de **Projects**.
- <!--i:clock--> **Trie à ta façon.** **View options**, le bouton à curseurs en haut à droite, propose **Grid** ou **List** et trie par **Name**, **Date added**, **Last modified** (par défaut), **Size** et, dans un dossier, **By tool**. Les dossiers viennent toujours en premier. Les sessions et les dossiers sont triés chacun dans leur propre groupe.
- <!--i:document--> **Classe directement les nouvelles créations.** **New asset** ouvre le sélecteur commun. Choisis **Templates** pour partir d'un modèle enregistré. Ouvre le modèle pour le modifier, ou appuie sur **+ Add** pour enregistrer aussitôt une nouvelle création.
- <!--i:checklist--> **Sélection multiple (ordinateur).** Coche la case d'une tuile, trace un rectangle de sélection dans un espace vide ou fais un **Maj/Cmd-clic**. Pour le menu contextuel d'une tuile, fais un **clic droit** dessus. La barre de sélection propose **Render selection**, **Move to…**, **New folder** et **Delete** (vers Trash). Son action **Edit together** ouvre deux à huit sessions d'un seul outil chacune, côte à côte sous une même barre latérale. **Edit as sheet** ouvre une sélection de toute taille ou composition sous forme de lignes dans la grille de traitement par lots.
- <!--i:download--> **Rends un dossier entier ou une sélection.** **Render folder** exporte chaque session enregistrée dans un dossier et ses sous-dossiers en un seul `.zip` qui conserve l'arborescence. **Render selection** fait de même pour une sélection multiple. Une session seule est rendue dans son propre fichier.
- <!--i:link--> **Accède directement au travail enregistré d'un outil.** Coche un ou plusieurs outils dans la galerie Tools et choisis **View sessions** dans la barre de sélection. Projects n'affiche alors que les sessions créées avec ces outils. **Clear** restaure la vue complète.
- <!--i:link--> **Partage une session enregistrée.** Fais un clic droit sur une session (sur un téléphone, appuie sur **•••** sur sa tuile) et choisis **Share link**. Le lien rouvre la session avec les mêmes réglages. Les images de ton appareil ne voyagent pas avec un lien. Pour la boîte de dialogue Share complète, voir [Partager ton travail](/info/using.html#sharing-your-work).
- <!--i:pentool--> **Renomme ou copie une session.** Le même menu contient **Rename**, **Duplicate** (une copie dans le même dossier) et **Move to…**.

![Le popover View options dans Projects : Layout avec Grid et List, puis Sort by réglé sur Last modified, à côté d'un bouton qui inverse l'ordre](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
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

<!--i:eti-refresh-->
## Si tu as fermé l'onglet ou quitté l'outil

Ce qui revient dépend de la façon dont tu es parti et de l'outil :

- **Tu as fermé l'onglet ou es revenu plus tard.** Le travail non enregistré est perdu, sauf dans les [outils qui enregistrent pendant que tu travailles](#which-tools-save-as-you-work). Ouvre ce travail depuis **Projects**.
- **Tu as rechargé la page dans le même onglet.** Tes réglages reviennent depuis l'adresse de la page. Dans les outils qui n'enregistrent pas pendant que tu travailles, l'adresse ne contient ni les images et fichiers de ton appareil ni le texte sur une seule ligne de plus de 150 caractères, donc ils ne reviennent pas.
- **Tu as appuyé sur Home ou sur le bouton de retour en haut à gauche.** Si tu as changé quelque chose depuis ton dernier enregistrement, téléchargement ou copie, une boîte de dialogue **Unsaved edits** demande s'il faut d'abord enregistrer. **Save & leave** enregistre le travail et t'emmène dans **Projects**, ou dans le dossier du projet d'où tu l'as ouvert. **Leave anyway** abandonne tes modifications. Un élément enregistré revient à son dernier enregistrement et une création jamais enregistrée quitte **Projects**. **Cancel** te garde dans l'outil.

::: warning Fermer l'onglet ne demande pas de confirmation
Fermer l'onglet, recharger la page et utiliser le bouton de retour du navigateur ne demande jamais de confirmation. Pour être sûr, appuie sur **Save as** ou sur **Save** dans le panneau d'export avant de quitter un outil.
:::

Quand la récupération automatique n'est pas disponible, une note à côté des contrôles d'édition indique ce qu'il faut garder :

- Dans un outil qui travaille sur un fichier que tu fournis, enregistre tes réglages et garde aussi les fichiers d'origine.
- Dans un outil d'enregistrement audio ou vidéo, ou un utilitaire sans action Save, enregistre ou télécharge le résultat avant de partir.
- Les applications de bureau et mobiles indiquent quand tu dois enregistrer manuellement.
- Dans une collaboration privée, la personne qui a invité conserve le document et son historique, y compris les modifications de l'autre personne. La personne qui a rejoint travaille sur une copie temporaire et doit enregistrer une copie séparée avant la fin de la session.

::: note Tu es parti sans enregistrer par erreur ?
Dans les outils qui enregistrent pendant que tu travailles, History conserve une copie des modifications abandonnées pendant 30 jours. Ouvre la page **History**, retrouve-les sous **Changes** et appuie sur **Open as a copy**. Dans les autres outils, les modifications sont perdues.
:::

::: details Quels outils enregistrent pendant que tu travailles
Dans l'application web, chaque outil qui crée un document enregistre pendant que tu travailles, comme Lolly Design, Lolly Chart, QR Code, Text et Lolly Sandbox. Ces outils ne le font pas :

- les outils qui travaillent sur un fichier que tu fournis, comme Redact, Sign ou Convert Image, car Lolly ne conserve jamais de copie de ce fichier ;
- les outils qui enregistrent depuis ta caméra, ton microphone ou ton écran, comme Record, Lolly Screen Capture et Lolly Voice Recorder ;
- un outil où rien ne peut être modifié, comme Countdown.

Dans les autres outils, ta première modification classe le travail dans **Projects** comme si tu l'avais enregistré. Les modifications suivantes sont conservées dès que l'outil a fini de dessiner. Une création non enregistrée reste dans Projects après la fermeture de l'onglet et se rouvre avec ses modifications marquées comme non enregistrées.

**Leave anyway** abandonne quand même ces modifications. Rouvrir l'outil depuis l'écran d'accueil démarre une nouvelle création ; ouvre la précédente depuis Projects.

3D et Lolly Darkroom enregistrent pendant que tu travailles, mais ne conservent pas les fichiers que tu y charges, comme un modèle 3D ou une LUT. History et **Save** conservent le nom, le type et la taille du fichier, pas le fichier lui-même. Quand tu rouvres le travail, une note indique de quel fichier il s'agit et l'outil fonctionne sans lui jusqu'à ce que tu le charges à nouveau. Garde tes fichiers d'origine.

Avec [Sync](/info/sync.html) activé, une création classée de cette façon est transférée sur tes autres appareils. Ses versions restent sur l'appareil où elles ont été créées.

Si une création est ouverte dans deux onglets et que tu enregistres dans les deux, le dernier enregistrement est conservé. Le travail remplacé se trouve sous **Protected drafts** dans l'historique de la création, avec **Open draft as a copy**.

Cela fonctionne uniquement dans l'application web, pas dans les applications de bureau ou mobiles, ni pendant que tu travailles en direct avec quelqu'un d'autre.
:::

<!--i:eti-download-->
## Retrouver un fichier téléchargé

Dans un navigateur, **Download** remet le fichier à ton navigateur. Celui-ci l'enregistre dans son dossier de téléchargements (généralement **Downloads**) ou te demande où le mettre. Lolly ne sait pas où le fichier est allé, alors regarde dans la liste des téléchargements de ton navigateur.

Si aucun fichier n'est apparu, regarde dans le panneau d'export tant que tu es encore dans l'outil. Sous **Download**, une ligne donne le nom du fichier et l'heure, avec **Retry download**. Dans Chrome, Edge et les autres navigateurs Chromium, la ligne propose aussi **Save file…** pour choisir un dossier. La ligne et son fichier restent jusqu'à ce que tu quittes l'outil, recharges la page ou exportes à nouveau.

Lolly conserve aussi deux choses après chaque téléchargement :

- **Une copie du fichier**, dans **Assets** sous **Your uploads**, tant que **Save my renders to my library** est activé sous **Settings → Your renders** (**Settings** se trouve en bas de l'écran d'accueil). Le réglage est activé au départ. Une vidéo ou un fichier de plus de 50 MB demande d'abord confirmation, et un zip n'est pas copié.
- **Les réglages que tu as utilisés**, pour tes 24 derniers téléchargements. **Recent exports**, sous ton travail enregistré dans **Projects**, rouvre l'outil avec ces réglages. Les images et fichiers ajoutés depuis ton appareil ne sont pas inclus. La même liste se trouve sous **Settings → Activity & stats → Latest exports** et dans l'onglet **Changes** de **History**.

::: details Dans les applications de bureau et mobiles
- **Application de bureau :** **Download** enregistre dans un dossier **Lolly** à l'intérieur de ton dossier **Downloads**, sans boîte de dialogue. La ligne sous **Download** indique où le fichier est allé, par exemple « Enregistré dans Downloads/Lolly », avec **Show in folder**. **Open Exports Folder**, dans le menu **Window** ou **Exports**, ouvre le dossier à tout moment. Un fichier qui porte le même nom qu'un précédent est enregistré sous « name (1) ».
- **iPhone et iPad :** le fichier est enregistré dans l'application **Files**, sous **Lolly**, et le panneau de partage s'ouvre. La ligne sous **Download** indique « Enregistré dans Files → Lolly ».
- **Android :** le menu de partage s'ouvre. Choisis où va le fichier.

Sur iPhone, iPad et Android, un nouveau fichier remplace un fichier précédent de même nom.
:::

<!--i:eti-history-->
## Revenir à une version antérieure

- **Pendant cette visite :** **Undo** revient sur tes 100 dernières modifications, jusqu'à ce que tu quittes l'outil ou recharges la page. Voir [Annuler et rétablir](/info/using.html#undo-and-redo).
- **Dans les [outils qui enregistrent pendant que tu travailles](#which-tools-save-as-you-work) :** les versions antérieures de chaque création sont conservées.
- **Tout ce qui est sur l'appareil :** avec [Sync](/info/sync.html) activé, **Restore an earlier copy**, sous **Settings → Connected services**, restaure l'une des sept dernières copies quotidiennes ou la copie créée avant la dernière fois où tu en as appliqué une. Tout sur cet appareil correspond alors à cette copie.

Pour ouvrir une version antérieure :

1. Appuie sur **History**, le bouton en forme d'horloge à côté de **Undo** et **Redo**. Dans Lolly Design, **History** se trouve dans la barre du haut. Sur un téléphone, appuie sur **•••**, puis sur **History**. Dans les outils sans **Undo**, comme Text et Lolly Sandbox, **History** se trouve à côté de **Home** en haut à gauche.
2. Retrouve la version par sa date et son heure. Les lignes **Automatic checkpoint** sont des copies prises pendant que tu travailles ; les lignes **Saved version** correspondent aux moments où tu as enregistré.
3. Appuie sur **Open as a copy**. La version s'ouvre comme une nouvelle création et celle que tu avais ouverte reste telle quelle. La copie se trouve dans **Projects**, avec « (copy) » après son nom.

Pour conserver une version avec un nom, appuie sur **Name version**, saisis un nom et appuie sur **Keep milestone**. Les versions nommées sont listées sur la page **History**, sous **Milestones**.

::: details Le panneau History et la page History
Le panneau **History** liste aussi des lignes **Recovered work**, et **Protected drafts** contient tes dernières modifications entre les points de contrôle, avec **Open draft as a copy**. **Lolly Compare** et **Check assets** t'aident à choisir avant d'ouvrir une copie. Passe de **This creation** à **All history on this device** pour voir toutes les créations.

Les points de contrôle automatiques s'espacent avec le temps : un par minute pour la dernière heure, un par heure pour le dernier jour, un par jour pendant 30 jours, puis un par semaine. Toutes les versions enregistrées et nommées sont conservées. Supprimer une création déplace aussi ses versions dans **Trash**, et **Delete forever** les supprime.

Quand le stockage de History est plein, les points de contrôle automatiques les plus anciens des créations que tu n'as pas ouvertes depuis 30 jours sont supprimés en premier. Même alors, un enregistrement est toujours conservé. Il est écrit comme travail actuel et History indique que cet enregistrement n'est pas conservé comme version. **Settings → Storage** indique l'espace utilisé par History.

La page **History** (`#/history`) couvre toutes les créations dans ce navigateur. Pour ouvrir la page, appuie sur le bouton en forme d'horloge en haut à droite de l'écran d'accueil ou de **Projects**, choisis **Saved sessions** dans le menu du profil (sur un téléphone, le bouton rond avec le logo en haut à droite) ou appuie sur **Open app history** dans le panneau History d'un outil. Les applications de bureau et mobiles n'ont pas de page History. Le bouton en forme d'horloge de l'écran d'accueil et **Saved sessions** y ouvrent **Your recent work** : tes dernières sessions enregistrées et tes derniers exports, avec un lien vers Projects.

- **Recent** liste tes créations, les plus récentes en premier, avec **Resume**.
- **Changes** place les points de contrôle, les téléchargements et les résultats de Convert sur une même timeline. Un téléchargement propose **Reopen settings**.
- **Milestones** liste les versions nommées.

Chaque création est une tuile avec son image. **Grid** ou **List** change la disposition. Filtre par projet, outil et date (derrière **Filters** sur un téléphone). Le menu d'une tuile (clic droit ou appui long) propose **Resume**, **Versions**, **Show in Projects** et **Move to Trash**. Pour en supprimer plusieurs, sélectionne-les et choisis **Move to Trash**, qui propose Undo.
:::

<!--i:eti-folder-move-->
## Transférer ton travail sur un autre appareil

| Pour | Utilise |
|---|---|
| Garder tes appareils synchronisés | **Sync across devices**, sous **Settings → Connected services** : voir [Synchroniser tes appareils](/info/sync.html) |
| Tout transférer une fois | **Export my data** et **Import data…**, ci-dessous |
| Transmettre un design ou un projet | Un fichier `.lolly` : **Export**, puis **Share**, puis **Download .lolly** ; pour un projet entier, **Download project (.lolly)** dans le menu du dossier. Appuie sur **Open** sur l'autre appareil. Voir [Le fichier .lolly](/info/using.html#the-lolly-file) |

Un lien de partage transporte tes réglages, mais pas les images ou fichiers ajoutés depuis ton appareil.

::: note L'import ajoute sans rien supprimer
Les dossiers, favoris et modèles du fichier sont ajoutés à ceux déjà présents sur l'autre appareil. Quand un élément enregistré est présent des deux côtés, la copie enregistrée le plus récemment est conservée. Tes informations et réglages sur cet appareil restent tels quels. Ceux qui sont vides sont remplis à partir du fichier. **Bring it to this device**, dans Sync, fonctionne de la même façon.
:::

Pour tout transférer une fois :

1. Sur l'ancien appareil, ouvre **Settings → Storage** et, sous **Move to another device**, appuie sur **Export my data**. Lolly télécharge un fichier `.zip` dont le nom commence par `LollyTools-`.
2. Transfère le fichier par USB, par e-mail à toi-même, par AirDrop ou par un dossier partagé.
3. Sur le nouvel appareil, ouvre **Settings → Storage**, appuie sur **Import data…**, choisis le fichier et appuie sur **Import**.

::: note Ce qui reste sur place
Les connexions, les clés et la phrase secrète de synchronisation restent sur chaque appareil. La liste des téléchargements récents, les téléchargements hors ligne et les modèles d'IA ne sont transférés par aucun moyen. L'historique des versions ne voyage que dans un fichier **Export my data**, pas par Sync ni par un `.lolly`. Quand l'historique est trop volumineux pour un seul fichier, les points de contrôle automatiques les plus anciens sont omis et la ligne d'export indique combien. Tu peux télécharger et ouvrir une copie que Sync conserve dans ton stockage, ou choisir cette copie dans **Import data…**, comme un fichier de sauvegarde. Une copie chiffrée demande ta phrase secrète.
:::

::: details Ce que contient le fichier de sauvegarde
Le fichier s'appelle `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`. Les parties du nom viennent de ton profil et sont omises si elles ne sont pas renseignées. `<n>` compte les exports effectués le même jour. Il contient ton profil, avec tes dossiers, Trash, modèles et favoris ; chaque session enregistrée avec sa vignette ; tes images importées, polices, logos et copies de tes téléchargements ; tes design systems ; tes préférences (thème, largeur de la barre latérale, statistiques d'activité locales) ; les versions enregistrées et les résultats de Convert ; et, depuis l'application web, l'historique des versions de tes créations.

Le cache du catalogue n'est pas inclus. Le nouvel appareil télécharge à nouveau le cache. Chaque partie a une somme de contrôle, donc l'import détecte un fichier endommagé pendant le transfert. Les sessions enregistrées sont à nouveau liées à tes images importées. Les applications web, de bureau et mobiles lisent le même fichier. L'application de terminal écrit sa propre sauvegarde, plus simple, que ce format ne lit pas. **Export my data & render everything** crée le même fichier, plus un second zip avec le rendu de chaque session enregistrée dans son format de sortie. Le format complet est décrit dans [Transfert de données](/info/data-transfer.html).
:::

<!--i:eti-globe-->
## Si tu effaces les données de ton navigateur

Dans l'application web, Lolly conserve tout dans le stockage de ton navigateur pour ce site : travail enregistré, images, polices, design systems, historique des versions et téléchargements hors ligne. Effacer les données de ce site dans ton navigateur supprime tout cela, et Lolly ne peut rien récupérer. Il ne reste que ce qui est déjà sorti du navigateur : les fichiers téléchargés, un fichier **Export my data**, une copie [Sync](/info/sync.html) et les liens partagés.

::: warning Avant d'effacer les données du navigateur
Appuie sur **Export my data** sous **Settings → Storage** et garde le fichier ailleurs.
:::

Au démarrage de l'application, Lolly demande au navigateur de ne pas effacer son stockage quand l'appareil manque d'espace, et le navigateur décide. Sous **Settings → Available offline**, une ligne qui commence par **Protected** signifie que le navigateur a accepté. « Le navigateur peut effacer les téléchargements si l'appareil manque d'espace » signifie qu'il n'a pas accepté, et **Protect downloads** renouvelle la demande.

Si le navigateur n'a pas accepté, il peut effacer le travail enregistré comme les téléchargements quand l'espace manque, alors garde un fichier **Export my data** récent.

**Settings → Storage** indique l'espace utilisé par chaque type de données. Sa ligne **History** compte les points de contrôle automatiques, leurs aperçus et les brouillons de récupération. **Remove automatic checkpoints older than 30 days** libère cet espace et conserve les versions enregistrées et nommées. **Clear cache** supprime les fichiers du catalogue téléchargés, qui se téléchargent à nouveau au besoin. **Clear all my data** te demande de saisir un mot, désactive Sync, puis supprime tout ce que Lolly conserve dans ce navigateur : ton profil et tes réglages, les sessions enregistrées avec leur historique et Trash, les fichiers importés, les polices et les design systems, le journal des téléchargements, les résultats de Convert, les modèles d'IA téléchargés et les copies hors ligne. Les fichiers que tu as téléchargés restent là où tu les as enregistrés. L'application démarre alors comme lors d'une première visite.

![La carte de stockage sur un écran de la largeur d'un téléphone : chaque catégorie de données sur l'appareil est nommée, avec le bouton Clear all my data en bas](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Dans les applications de bureau et mobiles, les sessions enregistrées sont des fichiers dans le dossier de données propre à l'application, et tout le reste se trouve dans son stockage interne. Effacer les données d'un navigateur web n'y touche pas.

::: details Où les applications de bureau et mobiles conservent les sessions enregistrées
Un fichier par session enregistrée, dans un dossier `saved-state` :

- macOS : `~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows : `%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux : `~/.local/share/tools.lolly.Desktop/saved-state/`, ou le même chemin sous `$XDG_DATA_HOME`
- iPhone, iPad et Android : dans le stockage interne de l'application, que l'application Files n'affiche pas

Les images, les design systems et la liste des téléchargements récents restent dans le stockage interne de l'application, pas dans ces dossiers. L'application de terminal et la ligne de commande lisent le même dossier `saved-state` : voir [Où sont conservées les sessions enregistrées](/info/cli-reference.html#where-saved-sessions-live).
:::

<!--i:eti-trash-->
## Récupérer quelque chose que tu as supprimé

Supprimer une session enregistrée, un dossier, l'un de tes fichiers importés ou l'une de tes polices dans l'application l'envoie dans **Trash** pour 30 jours, d'où que tu le supprimes : **Projects**, **Assets**, **Settings → Storage** ou la liste des sessions enregistrées d'un outil. Un dossier et tout son contenu vont dans Trash sous une seule entrée. Une session conserve son historique des versions dans Trash. Juste après la suppression, un message propose **Undo**. Plus tard :

1. Ouvre **Trash** : la tuile **Trash** dans **Projects**, le bouton **Trash** dans **Assets → Your uploads** ou la ligne **Trash** dans **Settings → Storage**. Les trois ouvrent la même liste.
2. Appuie sur **Restore** à côté de l'élément. Il revient dans son dossier, et une police retrouve les rôles qu'elle avait dans son design system.

**Delete forever** supprime définitivement un élément. **Empty Trash** demande d'abord confirmation, puis supprime tous les éléments de Trash. Les éléments de plus de 30 jours sont supprimés définitivement.

::: warning Certaines suppressions sont immédiates
La suppression d'un design system, d'un logo ou de ta photo de profil ne passe pas par Trash. La ligne de commande et l'application de terminal suppriment aussi immédiatement.
:::

Avec [Sync](/info/sync.html) activé, **Restore an earlier copy** peut restaurer l'état de tout l'appareil à un jour antérieur, et un fichier **Export my data** restaure ce qu'il contient.
