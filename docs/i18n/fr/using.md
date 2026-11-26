# Utiliser Lolly

Ouvre un outil, modifie ce qu'il te permet de modifier, enregistre le résultat et partage-le par lien ou sous forme de fichier.

Tout s'exécute sur ton appareil sans compte et fonctionne hors ligne une fois les outils et les ressources nécessaires téléchargés. Pour démarrer, l'application a besoin d'un navigateur ou d'une application prenant en charge WebGPU. [Environnements pris en charge](/info/supported-environments.html) liste ceux qui ont été testés.

**Le cycle**, en quatre étapes :

::: steps
- <!--i:eti-home--> **[Ouvrir un outil](#find-your-way-around)** Clique sur une carte de l'écran d'accueil. Les contrôles sont à côté d'un aperçu en direct.
- <!--i:eti-sliders--> **[Modifier les entrées](#change-what-the-tool-lets-you-change)** Seulement les entrées que l'auteur a laissées ouvertes. Clique sur le design pour trouver son contrôle.
- <!--i:eti-folder-plus--> **[Enregistrer ton travail](#saving-continuing)** **Save** le garde dans My library et Projects permet de le retrouver.
- <!--i:eti-link--> **[Partager le design](#sharing-your-work)** Un lien qui contient chaque entrée, ou un fichier `.lolly`.
:::

<!--i:eti-home-->
## Te repérer

::: figure using-app-map
L'écran d'accueil comporte quatre onglets en haut et une barre en bas. Quand un outil est ouvert, ses contrôles apparaissent à côté d'un aperçu en direct.
:::

En haut de l'écran d'accueil, quatre onglets se succèdent : **Tools**, **Utilities**, **Assets** et **Projects**. Tools contient les outils de création. Utilities permet de convertir, de vérifier ou de nettoyer un fichier. Assets est ta bibliothèque. Projects conserve tes enregistrements.

La barre du bas regroupe **Open**, **Settings**, un champ de recherche, un raccourci **Verify** vers Lolly Verify et **Docs**, qui ouvre ces guides. Elle est visible dans Tools, Utilities, Assets, Projects, Settings et les guides intégrés, puis disparaît quand un outil s'ouvre. Depuis ce champ, [Lolly Search](/info/search.html) retrouve tes outils, ton travail enregistré, tes ressources et tes réglages. [Ask Lolly](/info/ask.html) répond aux questions saisies en affichant la section correspondante de ces guides.

Clique sur une carte pour créer quelque chose dans cet outil. Pour rouvrir un travail enregistré, passe par **Projects**. À la première visite, un bandeau de bienvenue en haut de la galerie propose une action pour démarrer : **Start making** avec Lolly Demo, ou **Make it yours** pour configurer ton propre design system.

![Une carte de la galerie avec navigation entre les exemples et action New](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Chaque outil présente une vue partagée : les **contrôles** d'un côté, un **aperçu** en direct de l'autre. L'aperçu s'actualise quand tu modifies un contrôle et l'export correspond à ce que tu vois.

![La vue partagée d'un outil - à gauche la pile de contrôles, à droite le graphique en barres groupées qu'elle dessine en direct](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Lolly Design** fait exception : un canevas libre composé de blocs à déplacer, à redimensionner et à remplir de texte, avec sa propre barre du haut, sa timeline et ses contrôles de deck. Son guide est [Lolly Design : le canevas libre](/info/design.html).

<!--i:eti-sliders-->
## Modifie ce que l'outil te permet de modifier

Un outil affiche uniquement les entrées prévues pour varier. L'auteur a fixé les couleurs, la mise en page, la typographie et la logique, donc ton travail respecte ses règles. Les entrées peuvent être du texte, des curseurs, des sélecteurs de couleur, des listes déroulantes, des dates, des sélecteurs d'image et des groupes de lignes répétables. Certaines sont dans des sections repliables.

![La pile de contrôles d'un outil - un champ de texte, des déclencheurs de couleur et un curseur, sans aucun des éléments verrouillés par l'auteur](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Clique sur le design pour trouver le contrôle associé.** Clique sur un élément de l'aperçu : son contrôle défile jusqu'à devenir visible et reçoit le focus. Dans un groupe de lignes répétables, la ligne cliquée se déplie.

**Clear changes**, au-dessus des contrôles, rétablit la valeur par défaut de chaque entrée.

**Choix du design system.** Si ton design system propose plusieurs colourways, un aspect clair et un aspect sombre ou un autre choix de thème, tu les trouveras dans la section **Design system** sous les contrôles. Seuls les choix qui modifient cet outil sont visibles : un utilitaire de fichiers n'affiche donc pas cette section. Un point aux couleurs de chaque colourway le représente, deux boutons servent aux aspects clair et sombre et les autres choix prennent la forme d'une liste.

Ce choix est propre à cette pièce. Il est inclus dans le lien et la session enregistrée. Toutes les couleurs liées au design system le suivent, tandis que celles de l'application restent inchangées. Dans Lolly Design, ces mêmes choix se trouvent dans l'onglet **Canvas** de l'Inspector. Un outil dont les couleurs constituent le contenu peut conserver le colourway canonique et ne pas afficher de points de colourway. [Lolly Demo en pratique](/info/lolly-demo-in-use.html#colourways-on-real-work) présente des colourways sur de vraies créations. Pour appliquer un colourway à l'application et à chaque nouvelle pièce, sélectionne-le dans **Settings → Appearance** ([Adopter un colourway](/info/colourways.html#make-a-colourway-your-own)).

### Zoomer et déplacer l'aperçu

- **Zoom :** utilise Cmd/Ctrl-molette ou pince sur un trackpad, avec le pointeur comme centre. Au clavier, `0` ou `Shift+1` ajuste l'ensemble à la vue, `1` ou `Shift+0` passe à 100 % et `Shift+2` ajuste la sélection. `+` / `−` zooment autour du pointeur s'il se trouve sur la zone de travail, sinon autour du centre.
- **Déplacement :** garde **Space** enfoncé et fais glisser, ou utilise le bouton central de la souris pour glisser. Les clics simples restent disponibles pour cliquer sur des éléments du design.
- **Tactile :** pince pour zoomer, fais glisser pour déplacer la vue et touche deux fois pour l'ajuster.
- **HUD de zoom :** maintiens le doigt ou le bouton sur le tourbillon Lolly dans le coin pour faire apparaître `−`, **Fit** et `+`. Un appui bref sur le tourbillon ouvre toujours le menu du profil.

Dans Lolly Design, **Fit all** englobe les plans de travail et les calques libres. Le zoom manuel peut descendre sous 20 % jusqu'à ce que la page occupe la moitié de la vue. La limite absolue est la plus basse de ces deux valeurs : 5 % de l'échelle Fit ordinaire ou un zoom absolu de 2 %.

Dès que tu changes la taille de sortie, la vue se réajuste automatiquement.

![Le HUD de zoom déployé depuis le tourbillon au coin du canevas - moins, Fit, plus, suivis des bascules de thème et de son et de la poignée de déplacement](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### Annuler et rétablir

**Cmd/Ctrl-Z** recule d'une étape et **Cmd/Ctrl-Shift-Z** (ou **Cmd/Ctrl-Y**) avance d'une étape. Les boutons **Undo** et **Redo** se trouvent au-dessus des contrôles, ou dans la barre du haut de Lolly Design. Chacun se grise lorsqu'il ne reste plus d'étape dans son sens. Un message précise l'entrée restaurée par chaque annulation et propose un bouton **Redo**.

- **Un glissement compte pour une étape.** Les modifications répétées d'un même contrôle en moins d'une demi-seconde sont regroupées en une seule étape.
- **Les 100 dernières étapes sont conservées.** Modifier à nouveau après une annulation vide la pile de rétablissement.
- **Dans une zone de texte**, Cmd/Ctrl-Z agit sur le champ, caractère par caractère. Pour les curseurs, les listes déroulantes, les couleurs et les interrupteurs, c'est Lolly qui le gère.
- **Choisir un fichier** dans une entrée de fichier ne compte pas comme une étape : ses octets ne sont gardés que pour la session en cours.

Lors d'une [collaboration](/info/collaborate.html) en direct, les modifications de l'autre appareil n'entrent jamais dans ta pile d'annulation. L'annulation reste disponible jusqu'à ce que tu quittes l'outil ou recharges la page. Pour les modifications plus anciennes, les outils qui enregistrent au fil de ton travail gardent les versions précédentes sous **History** ([Revenir à une version antérieure](/info/find-your-work.html#go-back-to-an-earlier-version)).

### Caméra en direct

Quand une caméra est disponible, les effets de l'outil **Filter** (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art et Glitch) proposent un bouton **Go live**. Active-le pour que l'effet suive ta webcam image par image. Un export animé capture le résultat en GIF, WebM ou MP4. Le traitement des images se fait sur ton appareil. Dès que tu arrêtes ou quittes l'outil, la caméra est libérée. Chaque sélecteur d'image propose également **Take a photo** pour une seule image.

<!--i:eti-folder-plus-->
## Enregistrer & reprendre

Pour conserver ton travail, appuie sur **Save**, la coche à côté d'**Export** dans la pastille de rendu. Un nouveau travail va dans **My library**, un travail déjà enregistré est mis à jour là où il se trouve et rien n'est téléchargé. Le panneau d'export propose le même bouton **Save**.

Pour choisir où il va, appuie sur **Save as**, à côté de **Download** dans le panneau d'export. Sous **Save to a project**, laisse **My library** sélectionné ou choisis un projet (**＋ New project…** en crée un), puis appuie sur **Save**. **Save as a template** conserve le design comme [modèle](/info/templates.html), un point de départ pour de nouveaux documents. Dans Lolly Design, **Save as** se trouve dans le menu Lolly. Sur un téléphone, appuie sur **•••**, puis **File menu**, puis **Save as**.

![La pastille de rendu en deux moitiés : Export, avec une flèche vers le haut qui ouvre le panneau d'export, et Save, avec une coche qui enregistre sur place](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> Appuie sur **Save** dans la pastille de rendu, ou sur **Save as** pour choisir un projet.
- <!--i:folder--> L'élément va dans **My library**, ou dans le projet que tu as choisi.
- <!--i:home--> Plus tard, appuie sur **Home** en haut à gauche et ouvre l'onglet **Projects**.
- <!--i:document--> Ouvre l'élément. Chaque réglage est de retour, prêt à être modifié et exporté à nouveau.
:::

Les éléments prennent le nom de fichier que tu as saisi dans le panneau d'export, ou sinon le nom de leur outil, comme **QR Code**. Un fichier obtenu avec **Download** est une copie terminée. Pour le modifier plus tard, ouvre l'élément enregistré dans Projects.

::: note Les enregistrements restent sur cet appareil
Les enregistrements personnels restent sur cet appareil, dans le navigateur ou l'application depuis lesquels tu les as enregistrés, sauf si tu actives [Sync](/info/sync.html).
:::

Si quelque chose n'est pas là où tu l'attends, [Retrouver et récupérer ton travail](/info/find-your-work.html) couvre tous les cas, d'un onglet fermé aux données du navigateur effacées.

::: details Projets d'équipe avec Lolly Work (facultatif)
Si ton [organisation utilise Lolly Work](/info/organisation.html), connecte-toi à son instance et ouvre **Projects → Team projects** pour accéder aux sessions partagées avec toi. L'organisation définit l'accès et la conservation, et son service Lolly Work stocke ces sessions. Quand ton organisation autorise la modification en direct, une session partagée rejoint sa collaboration en direct dès son ouverture. [Travailler ensemble](/info/collaborate.html#collabs-through-lolly-work-optional) explique les étapes.

Ta bibliothèque personnelle reste séparée. Te connecter sur un autre appareil te donne accès au travail d'équipe. Les enregistrements personnels ont toujours besoin de Sync ou d'une sauvegarde pour passer d'un appareil à l'autre.
:::

<!--i:eti-link-->
## Partager ton travail

Partage un design sous forme de lien ou de fichier. **Share** dans les contrôles d'export ouvre une boîte de dialogue qui propose les deux. **Share link** sur une session enregistrée dans Projects ouvre la même boîte de dialogue pour cette session. Après avoir envoyé un fichier vers Google Drive, Nextcloud, un bucket S3, Dropbox ou OneDrive, la boîte de dialogue peut aussi créer un lien via ce service ([Exporter un fichier](/info/exporting.html#how-export-works)).

::: cols
## Un lien

- Transporte chaque entrée dans l'adresse, pour que le lien reproduise le design.
- Laisse de côté les images et fichiers que tu as ajoutés depuis cet appareil, les textes très longs et les très grandes listes.
- S'ouvre dans n'importe quel navigateur, pour que tu puisses ajouter le lien aux favoris, le coller ou le versionner.

## Un fichier .lolly

- Transporte la session enregistrée avec les images et fichiers de cet appareil, et peut aussi transporter l'outil et le design system.
- Retient les illustrations sous licence du catalogue, sauf si tu choisis d'inclure les fichiers.
- S'ouvre dans Lolly : double-clique dessus, utilise **Open** ou dépose-le sur l'application.
:::

### Le lien

Le lien se trouve en haut de la boîte de dialogue, avec **Copy** et un bouton **QR** qui ouvre l'outil QR Code sur ce lien. Sous le lien, **Link options** contient :

- **Open in the installed app** transforme le lien en adresse `lolly://` pour Shortcuts, les lanceurs et l'automatisation, sans changer aucun paramètre.
- **Shortest link** condense un long design en un jeton compact et affiche le nombre de caractères économisés. La forme lisible reste disponible.
- **Password-protect this link** chiffre le lien sur ton appareil avec AES-256. Le mot de passe ne fait jamais partie du lien.
- **Pin this tool version** ajoute le flag `_v`, pour qu'une mise à jour ultérieure de l'outil ne puisse pas changer le rendu du lien.
- **When the recipient opens the link…** choisit le plein écran, le panneau d'export déjà déplié, un téléchargement à l'ouverture (`&export`) ou une copie dans le presse-papiers (`&copy`).
- **Copy credit** copie une légende « Créé avec Lolly » accompagnée du lien, pour une publication ou une diapositive.

Quand un outil contient des champs personnels, comme ton nom, **Review personal fields** exclut chacun du lien jusqu'à ce que tu le coches. [Mode URL](/info/url-mode.html) couvre tout ce qu'un lien peut transporter.

**La boîte de dialogue indique ce qu'un lien ne peut pas transporter.** Lolly compte tout ce qui ne tient pas dans une adresse pendant la création du lien. Si des éléments ont été omis, la boîte de dialogue les liste et t'oriente vers l'option fichier. Un lien qui est seulement long reçoit une note plus discrète avec son nombre de caractères.

**Certains outils font du lien le produit entier.** Jump Page rassemble tes liens sur une page à diffuser : un lien de bio, une présentation ou une vitrine de boutique. La page est le lien, donc rien n'est hébergé et aucun compte ne se trouve derrière la page. Le visiteur voit la page sur toute la largeur, un lien par scène à mesure qu'il défile.

![Jump Page dans l'éditeur : la scène de titre en haut de la page, avec les scènes de liens en dessous](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Liens gérés par l'organisation avec Lolly Work
Pour les partages qui nécessitent une expiration, une révocation ou un mot de passe, Lolly Work propose des liens gérés vers des sessions partagées, des outils et des ressources du catalogue. Ils passent par le service de l'organisation et suivent ses règles d'accès. Ils sont distincts des liens autonomes ci-dessus. Révoquer un lien ne peut pas retirer un fichier déjà téléchargé par quelqu'un. [Rendu et partage](/info/manage/sharing.html) liste les types de liens et les autorisations.
:::

### Le fichier .lolly

**Download .lolly**, dans la section **Editable file** de la boîte de dialogue Share, écrit le design actuel dans un seul fichier. Les illustrations ordinaires du catalogue y entrent avec les images et fichiers de cet appareil. Un fichier périmé ou indisponible y reste sous forme de référence externe. Avant l'enregistrement, la boîte de dialogue affiche la taille du fichier, le nombre de fichiers incorporés et référencés, et si l'outil est inclus. Là où ton appareil propose une feuille de partage, **Send to…** lui transmet le fichier (AirDrop, un partage Android).

**Download project (.lolly)**, dans le menu d'un dossier de **Projects**, écrit un dossier entier, pour que quelqu'un d'autre puisse reprendre chaque session du dossier. Les sessions par lots sont exclues, et la notification indique combien. **Download originals**, dans le même menu, écrit un simple zip contenant chaque élément dans son propre fichier.

Avant l'envoi d'un fichier, tu décides de trois choses :

- **Si ton nom y figure.** Ton nom, ton e-mail et ton organisation ne sont écrits que lorsque **Use my details to create** est activé dans [ton profil](/info/profile.html). Quand cette option est désactivée, le fichier indique seulement qu'il a été créé avec Lolly, et quand.
- **Si les illustrations retenues y figurent.** Les illustrations sous licence et celles verrouillées par la marque restent exclues par défaut, tout comme une œuvre du catalogue dont Lolly ne peut pas encore lire la licence enregistrée. Si le design en utilise, la boîte de dialogue en indique le nombre et propose *Download without them* ou *Include and download*. Les inclure remet les fichiers à toute personne qui ouvre le `.lolly`. Une œuvre du catalogue sans information enregistrée sur ses droits est transportée, et la boîte de dialogue liste chacune pour que tu puisses vérifier avant l'envoi. Le fichier `CREDITS.txt` indique ce qui a été transporté ou non, avec la raison. [Droits de création et crédits](/info/creative-rights.html) explique les règles.
- **Si l'outil y figure.** **Include the tool** regroupe les fichiers propres à l'outil, pour que le design s'ouvre sur un appareil qui ne possède pas cet outil. Cette option est cochée au départ pour un outil personnalisé, comme un fork, et décochée pour un outil répertorié dans le catalogue signé. Dans une version sans catalogue signé, chaque outil compte comme personnalisé.

**Ouvrir un fichier.** Dans les applications de bureau et mobiles, double-clique ou touche un `.lolly`, choisis **Open with Lolly** ou envoie-le à Lolly depuis la feuille de partage. Dans l'application web, appuie sur **Open** ou dépose le fichier sur Lolly. Chaque méthode lit d'abord le manifeste du fichier et affiche sa taille, son contenu et ce qui va se passer, avant toute écriture.

::: warning Installer un outil exécute son code
Si le fichier contient un outil que tu n'as pas, **Trust this tool?** affiche l'outil et son auteur, et indique que l'ouvrir exécute le code propre à l'outil sur ton appareil. **Trust & install** lance l'opération.
:::

Si tu refuses, le travail est quand même enregistré dans Projects et attend que tu ajoutes l'outil. Un outil dont le code est livré sous forme de module ne peut pas encore être installé de cette façon, et il est refusé de la même manière.

::: details Ce qu'un .lolly contient et comment son ouverture fonctionne
`.lolly` est l'extension des paquets de Lolly, et le `format` dans son `manifest.json` indique ce qu'il contient :

- Un **design partagé** (`lolly-share`) contient une session enregistrée, ses fichiers incorporés et un reçu pour tout ce qui reste accessible par référence. Il peut aussi contenir l'outil et le design system. L'ouvrir ajoute un nouveau projet et n'écrase jamais une session.
- Un **projet partagé** (`lolly-share`, kind `project`) contient un dossier de Projects : ses sous-dossiers, chaque session qu'ils contiennent avec sa vignette et les images qui y sont classées. L'ouvrir ajoute une copie du dossier. Chaque session est transportée sous la forme `sessions/<key>.json` avec sa vignette sous `thumbs/`. Une version de Lolly antérieure aux fichiers de projet te demande une mise à jour.
- Un **pack de design system** (`lolly-brand`) contient des tokens et peut contenir des polices, des logos, des versions publiées et des ressources conservées. Ouvrir le pack ajoute un design system nommé distinct et active ce système.
- Un **pack d'espace de travail ou d'instance** est un `lolly-brand` avec des outils déclarés, des ressources du catalogue et éventuellement une adresse d'instance. En charger un remplace l'unique surcouche d'espace de travail chargée auparavant, et l'aperçu liste ces effets sur l'ensemble de l'appareil.

Une sauvegarde complète de l'appareil n'est pas un `.lolly`. Elle reste un `LollyTools-….zip` (format `lolly-backup`) et se restaure via **Settings → Storage → Import data…**. Un dossier d'outil zippé reste lui aussi un `.zip`. [Transfert de données](/info/data-transfer.html) est la référence des formats.

Un `.lolly` est un zip ordinaire. Renomme-le en `.zip` pour regarder à l'intérieur. Tes propres images sont sous `assets/uploads/` et les illustrations du catalogue sous `assets/catalog/`. `manifest.json` liste chaque fichier, et un README indique de quoi il s'agit.

macOS, Windows, Linux, iOS et Android enregistrent tous le format. Les gestionnaires de fichiers de bureau affichent le fichier comme un document Lolly, et GNOME Files peut afficher la vignette propre à une session enregistrée. L'ouverture depuis Lolly Design System Setup recommande l'action design system quand un design partagé en contient un, mais ne masque jamais **Open shared design**.

Sur iOS ou Android, un document transmis depuis une autre application est limité à 48 Mo, et l'application le signale. Le transfert copie ses octets d'une application à l'autre. **Open** dans Lolly n'a pas cette limite, alors utilise-le pour un paquet plus volumineux.

Après ta confirmation, Lolly décompresse et vérifie le paquet une seule fois. Les ressources vont dans ta bibliothèque, avec une comparaison par somme de contrôle pour réutiliser un fichier déjà présent sur l'appareil. Les sessions vont dans Projects avec de nouveaux identifiants, pour que le même fichier puisse être ouvert deux fois. Une session dont l'outil manque y attend. Les fichiers de plus de 100 Mo sont signalés comme volumineux, et l'aperçu avertit quand le stockage du navigateur indique moins d'espace libre que le fichier n'en demande. Chaque partie couverte par le contrôle d'intégrité est vérifiée avant toute validation, et une copie endommagée est refusée sans rien laisser derrière elle.
:::

Un lien et un fichier transmettent tous deux un instantané. Pour la modification en direct, [Travailler ensemble](/info/collaborate.html) couvre les collaborations privées entre deux appareils et les collaborations professionnelles facultatives via Lolly Work.

<!--i:eti-images-->
## Assets - ta bibliothèque

**Lolly Assets** (`#/a`) contient ce que tes outils peuvent utiliser : les logos de la marque, les images, l'audio et les animations, regroupés par type, ainsi que tes propres fichiers. Tes fichiers importés sont stockés sur ton appareil. Une organisation qui utilise Lolly Work peut aussi fournir un catalogue partagé soumis à ses propres règles d'accès ([Utiliser Lolly dans ton organisation](/info/organisation.html)).

![Assets, avec les nuanciers et les polices de la marque et tes propres fichiers importés](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Importe tes fichiers.** Dépose une image, un SVG, un clip audio, une vidéo, un Lottie, un PDF ou un deck PowerPoint sur la zone d'import, ou clique pour choisir. Le fichier apparaît aussitôt dans Assets et dans le sélecteur de ressources de chaque outil. Un PDF de plusieurs pages ou un `.pptx` demande quelles pages ou diapositives conserver, et chacune devient une ressource SVG. Une image que tu ajoutes dans un outil est conservée sans modification dans **My images**, pour qu'un Content Credential qu'elle porte reste vérifiable. Seul un très gros fichier te demande s'il faut le redimensionner. **Settings → Storage** indique le volume occupé par **My images**. Il n'y a pas d'autre limite que le stockage de ton appareil. Pour supprimer les données EXIF et GPS lors de l'import, active **Strip metadata from uploads** sous **Settings → Feature flags**. Les Content Credentials sont conservés dans les deux cas.
- <!--i:star--> **Mets en favoris ce que tu utilises.** Ajoute une étoile à une ressource ou à une nuance de la marque pour l'épingler en haut de chaque sélecteur.
- <!--i:folder--> **Fais du rangement.** Déplace une ressource vers un autre groupe, masque une ressource partagée de la marque que tu n'utilises pas (**Show hidden** la fait revenir) ou supprime tes propres fichiers importés. La même barre de sélection que dans Projects agit sur toute une sélection.
- <!--i:layers--> **Détache une vidéo de son arrière-plan.** Ouvre les détails d'une vidéo, ou fais un clic droit sur sa carte dans un sélecteur de ressources, et choisis **Remove background…**. Un **On-device model** détoure un sujet dans une scène chargée. Une **Colour key** supprime un fond éclairé uniformément, comme un fond vert, sans nécessiter de téléchargement. **Tolerance**, **Softness** et **Spill removal** ajustent ses bords. **Resolution** (360, 480, 720 ou 1080p, jamais au-dessus de la source) arbitre entre détail et vitesse. Le résultat détouré est un WebP ou PNG animé avec transparence, enregistré à côté de l'original. Le Content Credential de la source accompagne le résultat comme ingrédient. [Généré une fois, rendu à l'identique](/info/ai-features.html) explique pourquoi cela reste une simple modification.

### Emporte ta palette et tes polices partout

Le panneau **Swatches** dans Assets affiche les couleurs de ta marque : ses couleurs de marque, les couleurs que tu as ajoutées, ses gammes et son spectre. Les couleurs de rôle que Lolly garde pour l'interface (texte, surfaces, bords, couleurs principales des colourways et copies d'une couleur de marque sous un autre nom) se trouvent derrière une carte grise **Show colour roles** au bas du panneau.

Chaque couleur est une carte comme toute autre ressource. Clique sur l'une d'elles pour ouvrir ses détails, sélectionnes-en quelques-unes pour les télécharger ou télécharge la palette entière dans le format que ton autre outil lit :

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** ou **CSS classes**, pour une feuille de style ou un build. Une couleur au-delà de sRGB conserve sa valeur étendue : le CSS la définit après l'hexadécimal, et le JSON conserve l'hexadécimal avec la couleur étendue, la composition CMYK et le ton direct à côté.
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**, pour Illustrator ou Photoshop. Une couleur verrouillée sur une composition CMYK arrive comme cette nuance CMYK, un ton direct comme une nuance de ton direct nommée et une couleur au-delà de sRGB comme du Lab.
- <!--i:pentool--> **GIMP palette (.gpl)**, pour GIMP ou Inkscape, et **SCSS variables**, tous deux en sRGB.

![Le panneau Swatches - les cinq boutons de téléchargement de palette en haut, puis chaque couleur de marque sous forme de pastille qui ouvre ses détails](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

::: details Sélectionner plusieurs couleurs ou ouvrir les détails d'une couleur
Sélectionne les couleurs avec le point sur chaque carte : fais un Maj-clic sur un deuxième point pour tout sélectionner entre les deux, trace un cadre en glissant dans les espaces ou appuie sur Cmd/Ctrl+A quand une carte a le focus. La barre propose **Download as…** dans les six mêmes formats, **Copy hex** et **Favourite**. Avant que tu choisisses un format, le menu liste les couleurs qu'aucun format ne peut contenir (Transparent n'a pas de couleur), les formats qui enregistrent une couleur étendue sous sa forme de repli sRGB (SCSS et GIMP) et ceux qui transportent les valeurs CMYK et de tons directs (JSON et .ase). Fais un clic droit sur une carte pour les mêmes actions sur une seule couleur.

Les détails d'une couleur remplissent l'aperçu avec cette couleur et déplient **Linked values** (sa composition CMYK ou son ton direct, toute valeur définie pour un espace ou une presse précis et son design token), **Every notation** (hexadécimal, OKLCH, Display-P3 et les autres, chacun avec un bouton de copie), **Plotted on a colour space**, **Tones** et **Readability**. Les flèches du clavier parcourent la palette, **Copy link** partage la couleur et **Open in Colour Lab** ouvre la couleur pour continuer à la travailler.
:::

Le panneau **Fonts** liste les polices de ta marque avec un **download** pour chacune, pour les installer localement ou les remettre à un imprimeur.

<!--i:eti-grid-->
## Personnalise la grille

- <!--i:star--> **Mets en favoris ce que tu utilises.** Fais un clic droit sur une carte et choisis **Add to favourites**. L'outil obtient une grande vignette dans une bande au-dessus de la grille. [Tes favoris](/info/favourites.html) couvre cette bande.
- <!--i:eyeoff--> **Masque un outil que tu n'utilises jamais.** Fais un clic droit sur une carte, ou sélectionnes-en plusieurs, et choisis **Hide tool**. Il disparaît de la grille et des résultats de recherche quand tu tapes dans la grille. L'outil quitte la grille et ne correspond plus à ce que tu y tapes. Une vignette grise **Show hidden tools (N)** à la fin affiche à nouveau les outils masqués, atténués, chacun avec **Unhide tool** dans son menu. Le masquage ne change que ta grille : l'outil s'ouvre toujours depuis un lien ou un favori.
- <!--i:clock--> **Tes outils d'abord.** Une fois que tu as enregistré du travail dans trois outils différents, une rangée **Yours** de pastilles au-dessus de la grille met tes favoris et tes outils récents en premier.
- <!--i:sliders--> **Dispose-la à ta façon.** **View options** définit la mise en page (**Grid**, **Card** ou **List**), la taille et la densité des cartes, l'ordre de tri et un filtre par catégorie.

![La fin de la grille Tools avec les outils masqués révélés : la carte Wordmark atténuée et, à côté, la vignette grise qui l'a fait réapparaître, indiquant maintenant Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
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

**Agis sur plusieurs cartes à la fois.** Coche la case de chaque carte, trace un cadre de sélection dans un espace vide ou fais un Maj/Cmd-clic, et une barre apparaît avec les actions permises par cette vue :

- **Tools et Utilities :** Favourite, Hide, Available offline, **View sessions** (Projects, affichant seulement les sessions créées avec ces outils) et Copy link pour une seule carte.
- **Assets :** Favourite et Hide pour toute sélection. Duplicate, Download et Delete n'apparaissent que si tous les éléments sélectionnés sont tes propres fichiers importés, car une ressource partagée d'un design system constitue un contrat permanent.
- **Projects :** voir [Retrouver et récupérer ton travail](/info/find-your-work.html#find-something-you-saved).

![La barre de sélection de la galerie pour deux outils, proposant Available offline, View sessions, Favourite et Hide](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
<!--
SHOT NOTE (misc-bulkbar-gallery): drive targets `[data-select="qr-code"]` /
`[data-select="gradient"]` - the `.tile-check[data-select="<ref>"]` checkbox button
confirmed directly in views/gallery.ts's card markup (the same attribute
cardMarkup gives every tile), so these two clicks tick both cards without
opening either tool.

NOTE DE CAPTURE (misc-sessions-by-tool, NON PUBLIÉE) : le résultat « View sessions »
avait sa propre recette (`/#/p?tools=qr-code,d3`, toolsBodyHtml() de
views/projects.ts), retirée ici car elle n'a aucun `drive=` capable de
fabriquer son propre contenu - une session enregistrée n'est pas à un clic, elle doit
déjà exister, et build-docs-shots.ts donne à chaque capture un nouveau
`browser.newContext()`. Elle publierait une liste vide. Même dépendance que la capture
`projects` (maintenant dans find-your-work.md) ; à revoir si le pipeline acquiert un
hook d'initialisation du stockage.
-->

**View sessions** n'apparaît que si quelque chose est sélectionné. Fais un clic droit sur une seule carte non sélectionnée pour accéder à **N saved sessions** : une liste des sessions enregistrées de cet outil, où la suppression déplace une session vers la corbeille.

<!--i:eti-layers-->
## Sur un téléphone

Sur un écran étroit, la mise en page passe à une seule colonne :

- Les **contrôles deviennent un panneau** en haut avec une poignée sur son bord inférieur. Fais glisser la poignée pour passer à **peek**, **half** ou **full**, ou touche-la pour replier et déplier le panneau. L'aperçu remplit l'espace en dessous et reste visible pendant tes modifications.
- Un bouton flottant **Export** ouvre le panneau d'export : format, taille, copie, enregistrement et téléchargement. Touche l'arrière-plan pour fermer le panneau.

![Un outil sur un écran de la largeur d'un téléphone - les contrôles dans un panneau en haut, la palette générée remplissant l'aperçu en dessous et la pastille de rendu flottant en bas au centre](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

<!--i:eti-copy-->
## Appareils pliables et iPhone Duo

Sur un appareil pliable, un iPhone Duo ou un écran tactile presque carré, Lolly dispose un outil en deux volets :

- **Les contrôles d'un côté, le canevas de l'autre.** Les contrôles se placent à l'opposé de la main avec laquelle tu dessines. Choisis **Dominant hand** dans **Settings → Accessibility**, ou appuie sur **Swap sides** en haut des contrôles. Dans une langue de droite à gauche, les côtés s'inversent.
- **Le séparateur suit la charnière.** Quand l'appareil signale son pli, les volets se rejoignent à cet endroit, pour qu'aucun contrôle ni aucune illustration ne se trouve sur la pliure. Sur un écran continu, fais glisser le séparateur au tiers, à la moitié ou aux deux tiers de la largeur. Lolly mémorise ton choix pour chaque vue sur cet appareil.
- **Sur la table.** Avec l'appareil à moitié ouvert et le pli en travers de l'écran, le canevas occupe la moitié supérieure et les contrôles se placent sous le pli. En présentation, la diapositive est en haut, avec tes notes, la diapositive suivante et **Back** et **Next** en dessous. Dans Sequence, l'aperçu est en haut et la timeline en dessous.
- **Lolly Design, Design System Setup et Assets.** Dans Lolly Design, l'Inspector, les calques et le panneau d'export sont des onglets à côté du canevas. Les outils se tiennent le long du bord extérieur du canevas, sous ta main de dessin. Quand les outils ne tiennent pas, la colonne défile et un fondu avec une flèche indique dans quelle direction se trouve la suite. Sur la table, les outils longent le bas du canevas. Lolly Design System Setup garde le Board d'un côté et la salle que tu ouvres de l'autre. Dans Assets, les détails d'une ressource s'ouvrent à côté de la bibliothèque, pour que le toucher suivant affiche la ressource suivante au même endroit.
- **Rien sur la pliure.** Quand un pli est signalé, une boîte de dialogue s'ouvre sur la page qui contient les contrôles. Il en va de même pour le champ de recherche au bas de l'écran d'accueil et ses résultats. Un écran plat les garde au milieu.
- **Plier ne fait rien perdre.** Plier, déplier ou tourner l'appareil conserve ton document, ta sélection, le zoom et le champ dans lequel tu tapais, avec le curseur en place.

L'écran extérieur d'un appareil pliable conserve la disposition pour téléphone décrite ci-dessus, tout comme une fenêtre Lolly dans une moitié d'écran partagé.

<!--i:eti-smile-->
## Réglages, son et confort

**Settings**, au bas de l'écran d'accueil, contient tes coordonnées, tes design systems, l'accessibilité, le stockage et les téléchargements hors ligne. [Réglages de Lolly](/info/dashboard.html) décrit chaque onglet.

- **Tes coordonnées et ton portrait** remplissent tout outil prévu pour les utiliser, comme une signature d'e-mail ou un badge. [Profils](/info/profile.html) les détaille.
- **Accessibility** propose quatre interrupteurs de confort : **Reduce motion**, **Hide colourful previews**, **High contrast** et **Large text**. Ils changent l'application autour de ton travail, jamais le canevas d'un outil ni un export. À côté, **Dominant hand** choisit le côté des contrôles dans une disposition à deux volets.
- **Sound** joue des sons d'assistance discrets pour tes actions, et **Neurospicy Mode** joue une piste calme pour la concentration. Les deux sont désactivés jusqu'à ce que tu les actives dans **Settings → Accessibility** ou le menu de profil. Le curseur **Sound shape** sous l'interrupteur Sound fait passer les sons de gouttes douces et rondes (Bouba) à des clics et grattements secs (Kiki), avec les carillons de Lolly au milieu. Les pistes de Neurospicy comprennent les stations générées de Lolly : **Lolly Sings** et ses genres, et trois **Lofi stations**. Les stations créent de la musique sans fin pendant la lecture. Chacune a des contrôles pour la batterie et la texture (et l'ambiance, sur Lofi), un lien pour partager l'air que tu écoutes et un bouton qui enregistre l'air dans tes ressources. [Musique générée](/info/generated-music.html) explique comment un air est créé. **Music generator** sous Utilities (`#/music`) te permet d'en façonner un.
- **Available offline** télécharge le reste de l'application, tes outils, le catalogue et les guides avant que tu perdes la connexion. Pour installer Lolly comme application web, utilise le bouton d'installation de ton navigateur, ou *Add to Home Screen* sur un téléphone. L'application installée fonctionne en plein écran et se met à jour dès que tu es de nouveau en ligne.
- **Performance UI**, sous **Settings → Feature flags**, donne à l'application un aspect plus simple, moins coûteux à dessiner. Les canevas des outils et les exports restent identiques. Sur un appareil lent, Lolly active cet aspect de lui-même et indique pourquoi, avec **Undo** et **Keep** ([Performance UI](/info/configuration.html#curating-what-people-see)).
- **Storage** montre ce que Lolly conserve sur cet appareil. [Si tu effaces les données de ton navigateur](/info/find-your-work.html#if-you-clear-your-browser-data) explique ce que l'effacement supprime, et la [Politique de confidentialité](/info/privacy.html) liste tout ce que l'application récupère ou envoie.

::: note Si une vue ne se charge pas après une mise à jour
Un panneau vide ou un message « failed to fetch » juste après une mise à jour disparaît généralement après un rechargement. Ton travail enregistré, tes sessions et tes design systems restent intacts, car ils sont stockés sur ton appareil. Seule une image que tu as ajoutée sans jamais l'enregistrer peut devoir être ajoutée à nouveau.
:::

<!--i:eti-map-pin-->
## Où aller ensuite

- **[Lolly Design : le canevas libre](/info/design.html)** : le canevas, les formes, la timeline et la présentation d'un deck.
- **[Traitement par lots et Lolly Multi-edit](/info/batch.html)** : plusieurs versions d'un design, ou plusieurs designs enregistrés modifiés ensemble.
- **[Exporter un fichier](/info/exporting.html)** : choisir un format, une taille, des unités d'impression, la transparence et la vidéo.
- **[Importer un design](/info/design-import.html)** : importer un fichier Figma, Penpot, Illustrator, InDesign, Affinity ou DXF dans Lolly Design et continuer à le modifier.
- **[Modèles](/info/templates.html)** : des points de départ enregistrés pour un outil.
- **[Couleurs étendues et HDR](/info/hdr-editing.html)** : conserver la précision d'origine des images dans Lolly Design et Lolly Darkroom.
- **[Retrouver et récupérer ton travail](/info/find-your-work.html)** : où tout se trouve et comment le déplacer vers un autre appareil.
