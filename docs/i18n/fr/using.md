# Utiliser Lolly

Tu as Lolly ouvert et tu veux créer quelque chose, le garder et l'envoyer. Cette page déroule cette boucle : ouvrir un outil, changer ce qu'il te laisse changer, enregistrer le résultat et le partager sous forme de lien ou de fichier.

Tout ici tourne sur ton appareil, sans compte, et continue de fonctionner hors ligne une fois les outils et ressources dont tu as besoin téléchargés. L'application a besoin d'un navigateur ou d'une application avec WebGPU pour démarrer ; [Supported environments](/info/supported-environments.html) liste ceux qui ont été testés.

## Te repérer

::: figure using-app-map
L'écran d'accueil : quatre onglets en haut et la barre en bas. Un outil, une fois ouvert, affiche ses contrôles à côté d'un aperçu en direct.
:::

Quatre onglets courent en haut de l'écran d'accueil : **Tools**, **Utilities**, **Assets** et **Projects**. Tools, c'est ce avec quoi tu crées ; Utilities, ce sont des établis pour des tâches comme convertir, vérifier ou nettoyer un fichier ; Assets est ta bibliothèque et Projects contient ce que tu as enregistré.

La barre en bas contient **Open**, **Settings**, un champ de recherche, **Verify** et **What?**. Elle s'affiche sur Tools, Utilities, Assets, Projects, Settings et les guides que tu lis dans l'application, et s'efface dès qu'un outil est ouvert. [Search](/info/search.html) atteint tes outils, ton travail enregistré, tes ressources et tes réglages depuis ce champ. [Ask Lolly](/info/ask.html) répond à une question saisie avec la section correspondante de ces guides.

Clique sur une carte pour commencer quelque chose de nouveau dans cet outil. Le travail enregistré se rouvre plutôt depuis **Projects**.

![Une carte de galerie avec une navigation d'exemple et une action Nouveau](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Chaque outil est une vue partagée : les **contrôles** d'un côté et un **aperçu** en direct de l'autre. Change un contrôle et l'aperçu suit aussitôt, et ce que tu vois est ce qui s'exporte.

![La vue divisée d'un outil - la pile de contrôles à gauche, et le graphique en barres groupées en direct qu'elle dessine à droite](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Design** est l'exception. Il s'ouvre comme un canevas libre de blocs que tu fais glisser, redimensionnes et dans lesquels tu tapes du texte, avec sa propre barre du haut, sa timeline et ses contrôles de deck. [Design: the free canvas](/info/design.html) en est le guide.

## Change ce que l'outil te laisse changer

Un outil n'affiche que les entrées censées varier. Son auteur a déjà fixé les couleurs, la mise en page, la typographie et la logique, donc tout ce que tu crées respecte ses règles. Les entrées comprennent du texte, des curseurs, des sélecteurs de couleur, des listes déroulantes, des dates, des sélecteurs d'image et des groupes de lignes répétables, et certaines se trouvent dans des sections repliables.

![La pile de contrôles d'un outil - un champ de texte, des déclencheurs de couleur et un curseur, rien de plus, tout le reste ayant été verrouillé par l'auteur](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Clique sur le design pour trouver son contrôle.** Clique sur n'importe quel élément de l'aperçu et le contrôle correspondant prend le focus et défile dans la vue. Dans un groupe de lignes répétables, la ligne exacte sur laquelle tu as cliqué se déplie.

**Clear changes**, au-dessus des contrôles, ramène chaque entrée à sa valeur par défaut.

**Choix du design system.** Quand ton design system propose plus d'un colourway, un aspect clair et un aspect sombre ou un autre choix de thème, une section **Design system** sous les contrôles les contient. Un choix n'apparaît que s'il modifie cet outil, donc un utilitaire de fichiers n'affiche aucune section. Chaque colourway est un point dans ses propres couleurs, clair et sombre sont deux boutons et tout autre choix est une liste.

Le choix appartient à cette pièce. Il voyage dans le lien et dans la session enregistrée, chaque couleur liée au design system le suit et les couleurs propres de l'application ne changent pas. Design montre les mêmes choix dans l'onglet **Canvas** de l'Inspector. Un outil dont les couleurs sont son contenu peut rester sur le colourway canonique, et n'affiche alors aucun point de colourway. [Lolly Demo in use](/info/lolly-demo-in-use.html#colourways-on-real-work) montre les colourways sur du vrai travail.

### Zoomer et déplacer l'aperçu

L'aperçu montre toujours exactement ce qui sera exporté.

- **Zoom :** Cmd/Ctrl-molette ou pincement sur un trackpad, centré sur ton pointeur. Au clavier, `0` ou `Shift+1` ajuste tout, `1` ou `Shift+0` règle le zoom à 100 % et `Shift+2` ajuste la sélection. `+` / `−` zooment autour du pointeur quand il survole la zone de travail, ou autour du centre sinon.
- **Déplacement :** maintiens **Space** et fais glisser, ou fais glisser avec le bouton central de la souris. Les simples clics restent libres pour cliquer sur des parties du design.
- **Tactile :** pince pour zoomer, fais glisser pour déplacer et touche deux fois pour ajuster.
- **HUD de zoom :** appuie longuement sur le tourbillon Lolly dans le coin pour déplier `−`, **Fit** et `+`. Un court appui sur le tourbillon ouvre toujours le menu de ton profil.

Dans Design, **Fit all** inclut les plans de travail et les calques libres. Tu peux dézoomer manuellement sous 20 % jusqu'à ce que la page entière occupe la moitié de la vue. La limite basse est la plus petite des deux valeurs : 5 % de l'échelle Fit normale et 2 % de zoom absolu.

Un changement de taille de sortie ramène toujours la vue à un ajustement propre.

![Le HUD de zoom déplié depuis le tourbillon dans le coin du canevas - moins, Fit, plus, puis les bascules de thème et de son et la poignée qui le déplace](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### Annuler et rétablir

**Cmd/Ctrl-Z** revient en arrière et **Cmd/Ctrl-Shift-Z** (ou **Cmd/Ctrl-Y**) avance. La même paire figure sous forme de boutons **Undo** et **Redo** au-dessus des contrôles (dans Design, ils sont dans la barre du haut), et chacun se grise quand il n'y a plus rien à annuler. Un message indique quelle entrée chaque annulation a restaurée, avec un bouton **Redo** dans le message.

- **Un glissement est une seule étape.** Les changements répétés d'un contrôle en une demi-seconde fusionnent, donc faire glisser un curseur sur toute sa plage est une seule annulation.
- **Les 100 dernières étapes sont conservées.** Une nouvelle modification après une annulation vide la pile de rétablissement.
- **Dans une zone de texte**, Cmd/Ctrl-Z appartient au champ, caractère par caractère. Lolly prend le relais pour les curseurs, les listes déroulantes, les couleurs et les interrupteurs.
- **Choisir un fichier** dans une entrée de fichier n'est pas une étape, car ces octets ne sont conservés que pour cette session.

Dans une [collaboration](/info/collaborate.html) en direct, ton historique reste le tien : un changement venu de l'autre appareil n'entre jamais dans ta pile. L'annulation dure jusqu'à ce que tu quittes l'outil ou recharges. Pour tout ce qui est plus ancien, les outils qui enregistrent pendant que tu travailles conservent les versions antérieures sous **History** ; voir [Go back to an earlier version](/info/find-your-work.html#go-back-to-an-earlier-version).

### Caméra en direct

Les effets de l'outil **Filter** (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art et Glitch) affichent un bouton **Go live** là où une caméra est disponible. Active-le et l'effet suit ta webcam image par image, et un export animé enregistre le résultat en GIF, WebM ou MP4. Les images sont traitées sur ton appareil, et la caméra est libérée dès que tu arrêtes ou quittes l'outil. Tout sélecteur d'image propose aussi **Take a photo** pour une seule image.

## Enregistrer et reprendre

Pour conserver ton travail, appuie sur **Save**, la coche à côté de **Export** sur la pastille de rendu. Un nouveau travail va dans **My library**, un travail enregistré auparavant est mis à jour là où il est et rien ne se télécharge. Le panneau d'export a le même bouton **Save**.

Pour choisir où il va, appuie sur **Save as**, à côté de **Download** dans le panneau d'export. Sous **Save to a project**, laisse **My library** sélectionné ou choisis un projet (**＋ New project…** en crée un), puis appuie sur **Save** ; **Save as a template** conserve le design comme [modèle](/info/templates.html), un point de départ pour de nouveaux documents. Dans Design, **Save as** est dans le menu Lolly ; sur un téléphone, appuie sur **•••**, puis **File menu**, puis **Save as**.

![La pastille de rendu en deux moitiés : Export, avec une flèche vers le haut qui ouvre le panneau d'export, et Save, avec une coche qui enregistre sur place](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> Appuie sur **Save** sur la pastille de rendu, ou sur **Save as** pour choisir un projet.
- <!--i:folder--> L'élément va dans **My library**, ou dans le projet que tu as choisi.
- <!--i:home--> Plus tard, appuie sur **Home** en haut à gauche et ouvre l'onglet **Projects**.
- <!--i:document--> Ouvre l'élément. Tous les réglages sont de retour, prêts à être modifiés et exportés à nouveau.
:::

Les éléments portent le nom de fichier que tu as saisi dans le panneau d'export, ou à défaut le nom de leur outil, comme **QR Code**. Un fichier obtenu avec **Download** est une copie terminée ; pour le modifier plus tard, ouvre l'élément enregistré dans Projects.

Les enregistrements personnels restent sur cet appareil, dans le navigateur ou l'application d'où tu les as enregistrés, sauf si tu actives [Sync](/info/sync.html). Si quelque chose n'est pas là où tu l'attends, [Find and recover your work](/info/find-your-work.html) couvre tous les cas, de l'onglet fermé aux données de navigateur effacées.

::: details Projets d'équipe avec Lolly Work (facultatif)
Si [ton organisation utilise Lolly Work](/info/organisation.html), connecte-toi à son instance et ouvre **Projects → Team projects** pour les sessions partagées avec toi. L'organisation définit l'accès et la conservation, et son service Lolly Work stocke ces sessions. Une session partagée rejoint sa collab en direct à l'ouverture quand ton organisation autorise l'édition en direct ; [Working together](/info/collaborate.html#work-collabs-with-lolly-work-optional) explique les étapes.

Ta bibliothèque personnelle reste séparée. Te connecter sur un autre appareil te donne le travail d'équipe, alors que les enregistrements personnels ont encore besoin de Sync ou d'une sauvegarde pour passer d'un appareil à l'autre.
:::

## Partager ton travail

Un design sort sous forme de lien ou de fichier. **Share** dans les contrôles d'export ouvre une boîte de dialogue qui propose les deux, et **Share link** sur une session enregistrée dans Projects ouvre la même boîte pour cette session.

::: cols
## Un lien

- Porte chaque entrée dans l'adresse, donc le lien reproduit le design.
- Laisse de côté les images et fichiers que tu as ajoutés depuis cet appareil, les textes très longs et les très grandes listes.
- S'ouvre dans n'importe quel navigateur, donc tu peux mettre le lien en favori, le coller ou l'archiver dans un dépôt.

## Un fichier .lolly

- Porte la session enregistrée avec les images et fichiers de cet appareil, et peut aussi porter l'outil et le design system.
- Retient l'art de catalogue sous licence, sauf si tu choisis d'inclure les fichiers.
- S'ouvre dans Lolly : double-clique dessus, utilise **Open** ou dépose-le sur l'application.
:::

### Le lien

Le lien prêt à copier se trouve en haut de la boîte de dialogue, avec **Copy** et un bouton **QR** qui ouvre l'outil QR Code sur le lien. Sous le lien, **Link options** contient :

- **Open in the installed app** fait passer le lien à une adresse `lolly://` pour Raccourcis, les lanceurs et l'automatisation, sans modifier aucun paramètre.
- **Shortest link** condense un long design en un jeton compact et indique le gain en caractères. La forme lisible est toujours disponible aussi.
- **Password-protect this link** chiffre le lien sur ton appareil avec AES-256. Le mot de passe ne fait jamais partie du lien.
- **Pin this tool version** ajoute le drapeau `_v`, pour qu'une mise à jour ultérieure de l'outil ne puisse pas changer ce que le lien produit.
- **When the recipient opens the link…** choisit le plein écran, le panneau d'export déjà déplié, un téléchargement à l'ouverture (`&export`) ou une copie dans le presse-papiers (`&copy`).
- **Copy credit** copie une légende « Made with Lolly » avec le lien, pour une publication ou une diapositive.

Quand un outil contient des champs personnels, comme ton nom, **Review personal fields** garde chacun hors du lien tant que tu ne coches pas ce champ. [URL mode](/info/url-mode.html) couvre tout ce qu'un lien peut porter.

**La boîte de dialogue dit ce qu'un lien ne peut pas porter.** Une image ou un fichier que tu as ajouté depuis cet appareil, une très longue valeur de texte et une très grande liste ne tiennent pas dans une adresse. Chacun est compté pendant la construction du lien. Si quelque chose a dû être écarté, la boîte de dialogue le liste et te renvoie vers l'option fichier, au lieu de te remettre un lien qui s'ouvre avec une image manquante. Un lien simplement long reçoit une note plus légère avec son nombre de caractères.

**Certains outils font du lien tout le produit.** Jump Page rassemble tes liens dans une seule page à distribuer : un lien de bio, une conférence, une vitrine. Rien n'est hébergé et aucun compte ne se cache derrière la page, car la page est le lien. Un visiteur la voit en pleine largeur, un lien par scène au fil du défilement.

![Jump Page dans l'éditeur : la scène du titre en haut de la page, avec les scènes de liens en dessous](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Liens gérés par l'organisation avec Lolly Work
Pour un partage qui exige une expiration, une révocation ou un mot de passe, Lolly Work propose des liens gérés vers des sessions partagées, des outils et des ressources du catalogue. Ils se résolvent via le service de l'organisation et suivent ses règles d'accès. Ils sont distincts des liens autonomes ci-dessus, et en révoquer un ne peut pas rappeler un fichier que quelqu'un a déjà téléchargé. [Rendering and sharing](/info/manage/sharing.html) liste les types de liens et les permissions.
:::

### Le fichier .lolly

**Download .lolly**, dans la section **Editable file** de la boîte de dialogue Share, écrit le design actuel dans un seul fichier. Il porte la session enregistrée avec les images et fichiers de cet appareil, et l'art ordinaire du catalogue voyage aussi avec. Un fichier périmé ou indisponible reste une référence externe au lieu de disparaître. Avant l'enregistrement, la boîte de dialogue montre la taille du fichier, le nombre de fichiers qu'il incorpore, le nombre qu'il référence et si l'outil est inclus. Là où ton appareil a une feuille de partage, **Send to…** lui passe le fichier directement (AirDrop, un partage Android).

**Download project (.lolly)**, dans le menu d'un dossier dans **Projects**, écrit un dossier entier, pour que quelqu'un d'autre puisse continuer avec chaque session du dossier. Les sessions de lot restent en arrière, et l'avis indique combien. **Download originals**, dans le même menu, écrit un zip simple de chaque élément comme fichier à part.

Trois choses te reviennent avant qu'un fichier parte :

- **Si ton nom y figure.** Ton nom, ton e-mail et ton organisation ne sont écrits que si **Use my details to create** est activé dans [ton profil](/info/profile.html). Désactivé, le fichier enregistre seulement qu'il a été créé avec Lolly, et quand.
- **Si l'art retenu y figure.** L'art sous licence, l'art verrouillé par la marque et les œuvres du catalogue dont la licence n'a jamais été enregistrée restent dehors par défaut. Si le design en utilise, la boîte de dialogue dit combien et propose *Download without them* ou *Include and download*, car les inclure remet les fichiers à quiconque ouvre le `.lolly`. Le `CREDITS.txt` du fichier liste ce qui a voyagé et ce qui n'a pas voyagé, avec la raison ; [Creative rights and credits](/info/creative-rights.html) explique les règles.
- **Si l'outil y figure.** **Include the tool** emballe les fichiers propres de l'outil, pour que le design s'ouvre sur un appareil sans cet outil. L'option est cochée au départ pour un outil personnalisé, comme un fork, et décochée pour un outil que le catalogue signé liste. Sur une version sans catalogue signé, chaque outil compte comme personnalisé.

**Ouvrir un fichier.** Dans les applications de bureau et mobiles, double-clique ou touche un `.lolly`, choisis **Open with Lolly** ou envoie-le à Lolly depuis la feuille de partage. Dans l'application web, appuie sur **Open** ou dépose le fichier sur Lolly. Chaque chemin lit d'abord le manifeste du fichier et montre sa taille, son contenu et ce qui va se passer, avant que quoi que ce soit soit écrit.

Si le fichier porte un outil que tu n'as pas, **Trust this tool?** montre l'outil et son auteur, et précise que l'ouvrir exécute le code propre de l'outil sur ton appareil. **Trust & install** poursuit. Si tu refuses, le travail est quand même enregistré dans Projects, en attendant le jour où tu ajoutes l'outil. Un outil dont le code est livré sous forme de module ne peut pas encore être installé ainsi, et il est refusé de la même façon.

::: details Ce que contient un .lolly et comment s'en ouvre un
`.lolly` est l'extension de bundle de Lolly, et le `format` de son `manifest.json` indique ce qu'il y a dedans :

- Un **design partagé** (`lolly-share`) contient une session enregistrée, ses fichiers incorporés et un reçu pour tout ce qui se résout encore par référence. Il peut aussi porter l'outil et le design system. L'ouvrir ajoute un nouveau Project et n'écrase jamais une session.
- Un **projet partagé** (`lolly-share`, kind `project`) contient un dossier de Projects : ses sous-dossiers, chaque session qu'ils renferment avec sa vignette et les images qui y sont rangées. L'ouvrir ajoute une copie du dossier entier. Chaque session voyage sous la forme `sessions/<key>.json` avec sa vignette sous `thumbs/`. Un Lolly antérieur aux fichiers de projet te demande de le mettre à jour.
- Un **pack de design system** (`lolly-brand`) contient des tokens et peut contenir des polices, des logos, des versions publiées et des ressources conservées. Ouvrir le pack ajoute un design system nommé distinct et le rend actif.
- Un **pack d'espace de travail ou d'instance** est un `lolly-brand` avec des outils déclarés, des ressources de catalogue et éventuellement une adresse d'instance. En charger un remplace l'unique surcouche d'espace de travail chargée auparavant, et l'aperçu liste ces effets à l'échelle de l'appareil.

Une sauvegarde complète de l'appareil n'est pas un `.lolly`. Elle reste un `LollyTools-….zip` (format `lolly-backup`) et se restaure via **Settings → Storage → Import data…**. Un dossier d'outil zippé reste aussi un `.zip`. [Data transfer](/info/data-transfer.html) est la référence des formats.

Un `.lolly` est un zip ordinaire. Renomme-le en `.zip` pour regarder dedans : tes propres images sont sous `assets/uploads/`, l'art du catalogue sous `assets/catalog/`, `manifest.json` liste chaque fichier, et un README dit ce qu'est le fichier.

macOS, Windows, Linux, iOS et Android enregistrent tous le format, les gestionnaires de fichiers de bureau l'affichent comme un document Lolly et GNOME Files peut montrer la vignette propre d'une session enregistrée. Ouvrir depuis Design System Setup recommande l'action de design system quand un design partagé en porte un, mais ne masque jamais **Open shared design**.

Un document transmis depuis une autre application sur iOS ou Android est plafonné à 48 MB, car le transfert copie ses octets à travers la frontière de l'application, et l'application le dit. **Open** dans Lolly n'a pas ce plafond, donc utilise-le pour un bundle plus gros.

Après ta confirmation, Lolly décompresse et vérifie le bundle une seule fois. Les ressources vont dans ta bibliothèque, appariées par somme de contrôle pour qu'un fichier déjà présent sur l'appareil soit réutilisé. Les sessions vont dans Projects avec de nouveaux identifiants, donc le même fichier peut être ouvert deux fois ; une session dont l'outil manque y attend. Les fichiers de plus de 100 MB sont signalés comme volumineux, et l'aperçu avertit quand le stockage du navigateur indique moins d'espace libre que le fichier n'en demande. Chaque partie couverte par l'intégrité est vérifiée avant que quoi que ce soit soit validé, et une copie endommagée est refusée sans rien laisser derrière.
:::

Un lien et un fichier remettent tous deux un instantané. Pour l'édition en direct, [Working together](/info/collaborate.html) couvre les collabs privées entre deux appareils et les collabs de travail facultatives via Lolly Work.

## Éléments - ta bibliothèque

**Assets** (`#/a`) rassemble tout ce que tes outils peuvent utiliser : logos de marque, images, audio et animation, groupés par type, avec tes propres fichiers. Tes envois sont stockés sur ton appareil. Une organisation qui utilise Lolly Work peut aussi fournir un catalogue partagé selon ses propres règles d'accès ; voir [Use Lolly at your organisation](/info/organisation.html).

![Éléments, avec les échantillons et les polices de la marque, ainsi que tes propres imports](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Apporte tes fichiers.** Dépose une image, un SVG, un clip audio, une vidéo, un Lottie, un PDF ou un deck PowerPoint sur la zone d'envoi, ou clique pour choisir. Il arrive aussitôt dans Assets et dans le sélecteur de ressources de chaque outil. Un PDF de plusieurs pages ou un `.pptx` demande quelles pages ou diapositives garder, et chacune devient une ressource SVG. Une image que tu ajoutes dans un outil est conservée telle qu'elle est arrivée dans **My images**, donc un Content Credential qu'elle porte reste vérifiable, et seul un fichier très volumineux demande s'il faut le redimensionner. **Settings → Storage** montre ce que **My images** contient. Il n'y a pas de plafond au-delà du stockage de ton appareil. Pour effacer les données EXIF et GPS à l'arrivée des images, active **Strip metadata from uploads** sous **Settings → Feature flags** ; les Content Credentials sont conservés dans les deux cas.
- <!--i:star--> **Mets en favori ce que tu utilises.** Marque une ressource ou un échantillon de marque d'une étoile et il s'épingle en haut de chaque sélecteur.
- <!--i:folder--> **Range.** Déplace une ressource vers un autre groupe, masque une ressource de marque partagée que tu n'utilises pas (**Show hidden** la ramène) ou supprime tes propres envois. La même barre de sélection que dans Projects agit sur toute une sélection.
- <!--i:layers--> **Détache une vidéo de son fond.** Ouvre les détails d'une vidéo, ou fais un clic droit sur sa carte dans un sélecteur de ressources, et choisis **Remove background…**. Un **On-device model** découpe un sujet dans une scène chargée ; un **Colour key** retire un fond éclairé uniformément, comme un fond vert, avec **Tolerance**, **Softness** et **Spill removal** pour le bord, et ne demande aucun téléchargement. **Resolution** (360, 480, 720 ou 1080p, jamais au-delà de la source) échange du détail contre de la vitesse. Le détourage, un WebP animé ou un PNG avec une vraie transparence, est enregistré à côté de l'original, et le Content Credential de la source l'accompagne comme ingrédient. [Generated once, rendered the same](/info/ai-features.html) explique pourquoi cela reste une simple modification.

### Emporte ta palette et tes polices partout

Le panneau **Swatches** dans Assets montre les couleurs dont ta marque est faite : ses couleurs de marque, les couleurs que tu as ajoutées, ses dégradés et son spectre. Les couleurs de rôle que Lolly garde pour l'interface (texte, surfaces, bords, couleurs de tête de colourway et copies d'une couleur de marque sous un autre nom) attendent derrière une carte grise **Show colour roles** au pied du panneau.

Chaque couleur est une carte comme n'importe quelle autre ressource. Clique sur l'une pour ouvrir ses détails, sélectionnes-en quelques-unes pour ne télécharger que celles-là ou télécharge toute la palette dans le format que lit ton autre outil :

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** ou **CSS classes**, pour une feuille de style ou un build. Une couleur plus large que sRGB garde sa valeur étendue : le CSS la définit après l'hexadécimal, et le JSON garde l'hexadécimal avec la couleur étendue, la composition CMJN et l'encre d'accompagnement.
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**, pour Illustrator ou Photoshop. Une couleur verrouillée sur une composition CMJN arrive comme ce nuancier CMJN, une encre d'accompagnement comme un nuancier d'accompagnement nommé et une couleur plus large que sRGB comme Lab.
- <!--i:pentool--> **GIMP palette (.gpl)**, pour GIMP ou Inkscape, et **SCSS variables**, tous deux en sRGB.

![Le panneau Swatches - les cinq boutons de téléchargement de palette en haut, puis chaque couleur de marque sous forme de pastille qui ouvre ses détails](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

Sélectionne des couleurs avec le point de chaque carte : Maj-clic sur un second point pour tout ce qui se trouve entre les deux, fais glisser un cadre à travers les espaces ou appuie sur Cmd/Ctrl+A avec une carte au focus. La barre propose **Download as…** dans les mêmes six formats, **Copy hex** et **Favourite**. Avant que tu choisisses un format, le menu liste toute couleur qu'aucun format ne peut contenir (Transparent n'a aucune couleur), les formats qui enregistrent une couleur étendue sous sa valeur de repli sRGB (SCSS et GIMP) et ceux qui portent les valeurs CMJN et d'accompagnement (JSON et .ase). Fais un clic droit sur une carte pour les mêmes actions sur une seule couleur.

Les détails d'une couleur remplissent l'aperçu de cette couleur et déplient **Linked values** (sa composition CMJN ou son encre d'accompagnement, toute valeur définie pour un espace ou une presse particuliers et son design token), **Every notation** (hexadécimal, OKLCH, Display-P3 et le reste, chacun avec un bouton de copie), **Plotted on a colour space**, **Tones** et **Readability**. Les flèches du clavier parcourent la palette, **Copy link** partage la couleur elle-même et **Open in Colour Lab** va plus loin.

Le panneau **Fonts** liste les polices de ta marque avec un bouton **download** pour chacune, à installer en local ou à remettre à un imprimeur.

## Fais la grille à ta main

- <!--i:star--> **Mets en favori ce que tu utilises.** Fais un clic droit sur une carte et choisis **Add to favourites**, et elle obtient une grande tuile dans une bande au-dessus de la grille. [Your favourites](/info/favourites.html) couvre cette bande.
- <!--i:eyeoff--> **Masque un outil que tu n'utilises jamais.** Fais un clic droit sur une carte, ou sélectionne-en plusieurs, et choisis **Hide tool**. Il disparaît de la grille et de ce que trouve la saisie dans la grille. Une tuile grise **Show hidden tools (N)** à la fin les révèle de nouveau, atténués, chacun avec **Unhide tool** dans son menu. Masquer ne change que ta grille : l'outil s'ouvre toujours depuis un lien ou un favori.
- <!--i:clock--> **Tes outils, en premier.** Une fois que tu as enregistré du travail dans trois outils différents, une rangée de pastilles **Yours** au-dessus de la grille commence par tes favoris et tes outils récents.
- <!--i:sliders--> **Organise à ta façon.** **View options** règle la disposition (**Grid**, **Card** ou **List**), la taille et la densité des cartes, l'ordre de tri et un filtre de catégorie.

![La fin de la grille Tools avec les outils masqués révélés : la carte Wordmark atténuée, et à côté la tuile grise qui les a remis en vue, qui indique maintenant Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed the tile. The alt says so rather than quoting the resting
label the prose above already gives.
The recipe hides nothing itself. The lolly-demo catalog the captures pin
ships Wordmark hidden (`defaultHiddenTools` in its assets index.json), so a
fresh profile already has one hidden tool and the recipe only clicks the grey
reveal tile (`.gtile--hiddenbox`, confirmed in gallery.ts). It used to tick
the QR Code card and press the bulk bar's Hide button first; under lolly-demo
that published Wordmark dimmed and QR Code not, under a caption naming QR
Code, so the steps were dropped rather than relied on. QR Code was hidden
in that run too: the End scroll had left the pointer over its card, and a
hovered hidden card lifts its dimming (gallery.css), so it read as a normal
tool. The closing `hover:` puts the pointer back on the reveal tile, which
keeps every revealed card dimmed.
-->

**Agis sur plusieurs cartes à la fois.** Coche la case de chaque carte, fais glisser un cadre de sélection sur un espace vide ou clique avec Maj/Cmd, et une barre apparaît avec ce que cette vue permet :

- **Tools et Utilities :** Favourite, Hide, Available offline, **View sessions** (Projects, n'affichant que les sessions créées avec ces outils) et Copy link pour une seule carte.
- **Assets :** Favourite et Hide pour toute sélection. Duplicate, Download et Delete n'apparaissent que lorsque chaque élément sélectionné est un de tes propres envois, car une ressource partagée d'un design system est un contrat permanent.
- **Projects :** voir [Find and recover your work](/info/find-your-work.html#find-something-you-saved).

![La barre de sélection de la galerie pour deux outils, proposant Disponible hors ligne, Voir les sessions, Favori et Masquer](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
<!--
SHOT NOTE (misc-bulkbar-gallery): drive targets `[data-select="qr-code"]` /
`[data-select="gradient"]` - the `.tile-check[data-select="<ref>"]` checkbox button
confirmed directly in views/gallery.ts's card markup (the same attribute
cardMarkup gives every tile), so these two clicks tick both cards without
opening either tool.

SHOT NOTE (misc-sessions-by-tool, NOT PUBLISHED): the "View sessions" result
had a recipe of its own (`/#/p?tools=qr-code,d3`, views/projects.ts's
toolsBodyHtml()), dropped here because it has no `drive=` that can
manufacture its own content - a saved session isn't a click away, it has to
already exist, and build-docs-shots.ts gives every shot a fresh
`browser.newContext()`. It would publish an empty list. Same dependency the
`projects` shot (now on find-your-work.md) carries; revisit if the pipeline gains a
storage-seeding hook.
-->

**View sessions** n'apparaît qu'une fois que quelque chose est sélectionné. Fais plutôt un clic droit sur une seule carte non sélectionnée et elle propose **N saved sessions**, une liste des sessions enregistrées de cet outil où une suppression déplace la session dans la Corbeille.

## Sur téléphone

Sur un écran étroit, la mise en page passe sur une seule colonne :

- Les **contrôles deviennent une feuille** en haut, avec une poignée de glissement sur son bord inférieur. Fais glisser la poignée pour l'accrocher à **peek**, **half** ou **full**, ou touche-la pour replier et déplier. L'aperçu remplit l'espace en dessous et reste visible pendant que tu modifies.
- Un bouton **Export** flottant ouvre la feuille d'export : format, taille, copie, enregistrement et téléchargement au même endroit. Touche l'arrière-plan pour fermer la feuille.

![Un outil sur un écran de largeur téléphone - les contrôles en feuille en haut, la palette générée qui remplit l'aperçu en dessous et la pastille de rendu flottant en bas au centre](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Réglages, son et confort

**Settings**, au pied de l'écran d'accueil, contient tes informations, tes design systems, l'accessibilité, le stockage et les téléchargements hors ligne. [Settings](/info/dashboard.html) cartographie chaque onglet.

- **Tes informations et ta photo** remplissent tout outil conçu pour les utiliser, comme une signature d'e-mail ou un badge. [Profiles](/info/profile.html) les couvre.
- **Accessibility** a quatre interrupteurs de confort : **Reduce motion**, **Hide colourful previews**, **High contrast** et **Large text**. Ils changent l'application autour de ton travail, jamais le canevas d'un outil ni un export.
- **Sound** joue de doux sons d'assistance pour ce que tu fais, et **Neurospicy Mode** joue une piste calme de concentration. Les deux sont désactivés tant que tu ne les actives pas, dans **Settings → Accessibility** ou le menu du profil.
- **Available offline** télécharge le reste de l'application, tes outils, le catalogue et les guides avant que tu perdes la connexion. Lolly est une application web que tu peux installer : utilise le bouton d'installation de ton navigateur, ou *Add to Home Screen* sur un téléphone, pour une application plein écran qui se met à jour toute seule quand tu es de nouveau en ligne.
- **Storage** montre ce que Lolly conserve sur cet appareil. [If you clear your browser data](/info/find-your-work.html#if-you-clear-your-browser-data) explique ce que l'effacement supprime, et la [Privacy Policy](/info/privacy.html) liste tout ce que l'application récupère ou envoie.

::: note Si une vue ne se charge pas après une mise à jour
Un panneau vide ou un message « failed to fetch » juste après une mise à jour se règle généralement par un seul rechargement. Ton travail enregistré, tes sessions et tes design systems ne sont pas touchés, car ils sont stockés sur ton appareil. Seule une image que tu as ajoutée sans l'enregistrer peut devoir être ajoutée à nouveau.
:::

## Où aller ensuite

- **[Design: the free canvas](/info/design.html)** : le canevas, les formes, la timeline et la présentation d'un deck.
- **[Batch and Multi-edit](/info/batch.html)** : plusieurs versions d'un même design, ou plusieurs designs enregistrés modifiés ensemble.
- **[Export a file](/info/exporting.html)** : choisir un format, une taille, des unités d'impression, la transparence et la vidéo.
- **[Import a design](/info/design-import.html)** : apporter un fichier Figma, Penpot, Illustrator ou InDesign dans Design et continuer à le modifier.
- **[Templates](/info/templates.html)** : des points de départ enregistrés pour un outil.
- **[Wide Colour and HDR](/info/hdr-editing.html)** : conserver la précision d'origine des images dans Design et Darkroom.
- **[Find and recover your work](/info/find-your-work.html)** : où se trouve chaque chose, et comment la déplacer vers un autre appareil.
