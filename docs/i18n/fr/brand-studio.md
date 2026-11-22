# Lolly Design System Setup

<a id="design-system-setup"></a>

**Lolly Design System Setup**, à l'adresse `#/start`, contient ton logo, tes couleurs et tes polices. Chaque outil, page et export dessine avec eux.

Dépose un logo et Lolly lit ses couleurs. Choisis une police ou dépose le fichier de police pour lequel ton entreprise détient une licence. Chaque modification apparaît aussitôt dans toute l'application. Ton logo, tes polices et tes tokens restent sur cet appareil. Seul le choix d'une Google Font accède au réseau : Lolly demande d'abord confirmation, puis récupère la famille une seule fois.

Nomme le design system et appuie sur **Export** pour obtenir un fichier `.lolly`. Garde le fichier, ouvre-le sur un autre appareil ou transmets-le à un collègue. [Lolly Settings](/info/dashboard.html#design-system) affiche le système actif en lecture seule ; sa couverture renvoie ici pour le modifier.

<!--i:eti-clock-->
## Personnalise-le en cinq minutes

::: timeline
- <!--i:upload--> **Dépose ton logo** dans la zone de dépôt de **Logos**. Lolly lit sa forme et ses couleurs.
- <!--i:palette--> **Utilise ces couleurs.** La couleur principale du logo devient ta couleur primaire et une couleur neutre sombre du logo devient ta couleur de texte.
- <!--i:font--> **Choisis une police** dans **Type** : une Google Font ou un fichier de police que tu possèdes.
- <!--i:pentool--> **Nomme le système.** Ta première modification crée ton propre design system, et Lolly te demande son nom une seule fois.
- <!--i:download--> **Export** écrit tout le système dans un seul fichier `LollyBrand-….lolly`.
:::

La barre en haut du studio affiche le nom du design system dans un champ modifiable. **Enter** conserve un nouveau nom et **Escape** remet l'ancien. Quand ta première modification déclenche la question **What is this design system called?**, Lolly remplit le champ avec les mots de ton logo, s'il en contient. **Save name** conserve le nom ; **Not now** garde un nom provisoire jusqu'à ce que tu en saisisses un dans la barre. Ce nom identifie le système dans Settings et quand tu en changes, et sert de nom au fichier écrit par **Export**.

<!--i:eti-grid-->
## Les espaces

Le studio est un ensemble d'espaces sans ordre imposé. Aucun espace ne dépend d'un autre. Sur un ordinateur, les espaces se trouvent sur une même bande sous la barre. Sur un téléphone, ils passent dans une barre le long du bord inférieur, qui défile pour montrer l'espace ouvert. Le panneau de palette et le plateau s'ouvrent au-dessus de cette barre, et elle s'écarte pendant la saisie. Au clavier, Tab atteint la bande en un seul arrêt, puis les flèches, Début et Fin passent d'un espace à l'autre.

![La barre du studio et ses espaces : Board, Colours, Type, Logos, Tokens, Files, Sound, Rules et Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Espace | Ce que tu y fais | Clé du lien |
|---|---|---|
| **Board** | Voir ce que contient le système, avec un accès à chaque espace | `overview` |
| **Colours** | Ajouter des couleurs, leur attribuer des rôles, créer des nuances et une palette | `color` |
| **Type** | Choisir les quatre polices utilisées par l'application, les outils et chaque export | `type` |
| **Logos** | Placer tes signes de marque dans chaque orientation et traitement | `logos` |
| **Tokens** | Angles, espacement, ombres et toutes les autres valeurs nommées | `tokens` |
| **Files** | Les images, fichiers audio et animations que ta marque conserve | `catalogue` |
| **Sound** | Façonner l'identité sonore, la musique pour différents usages et la relation à la voix | `sound` |
| **Rules** | Les règles qu'applique ta marque, vérifiées sur des exemples réels | `usage` |
| **Skills** | Les normes écrites de la marque pour les personnes et les agents, à lire et à télécharger | `skills` |

Crée un lien vers un espace avec `#/start?area=<key>`. Les clés des espaces sont permanentes, donc Files garde `catalogue`, Board garde `overview` et Rules garde `usage`. `?tab=` fonctionne toujours comme ancien alias. Une clé inconnue ouvre Board.

La **barre** contient les actions pour l'ensemble du système. **Add from…** importe une marque ([Importer une marque](#bring-a-brand-in)). Le **Tray** contient ce qu'une analyse a trouvé et que tu n'as pas encore ajouté. **Export** écrit le système dans un seul fichier. **More** contient **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions & publishing**, **Restore brand settings** et **Design systems**, qui ouvre la liste dans Settings où tu changes de système ([Conserver et transférer ton design system](#keep-and-move-your-design-system)). Chaque action apparaît dès qu'elle a quelque chose sur quoi agir. Sur un téléphone, **Add from…** passe dans **More** et **Export** s'affiche sous forme d'icône.

Tant que le design system est celui fourni avec l'application, la barre commence par **Make it yours**, un menu avec **Find a look**, **Add from…** et **Pick a colour**. Une fois que le système est le tien, **Export** reprend cette place.

<!--i:eti-clipboard-->
## Board

Quand rien n'a encore été choisi, Board propose quatre façons de commencer. **Start from a reference** ouvre le sélecteur de source pour un logo, une capture d'écran, une page web ou un fichier de design. **Pick a colour**, **Choose a face** et **Add a logo** ouvrent les contrôles correspondants. En ouvrir un n'écrit rien. En dessous, **Find a look** propose des couleurs et des polices prêtes à essayer, et **Explore the tools** est présent dès le départ.

Dès qu'un élément est à toi, Board montre ce que tu as, en commençant par tes propres compteurs. Colours donne le nombre de couleurs, avec un `· N starter` atténué pour celles héritées. Sa bande montre tes couleurs, puis un filet, puis les couleurs de départ estompées. Colourways montre chaque colourway sous forme de petite tuile dans sa couleur dominante. Type liste chaque rôle et affiche chaque famille dans sa propre police (*Inter pour les titres*, avec *Polices de départ pour le reste* sur la ligne en dessous). Logos indique combien d'emplacements sont remplis (ou **Not set**), Tokens montre le rayon des angles et Files indique **Nothing yet** tant que la bibliothèque est vide. Chaque bloc ouvre son espace.

Un design system modifiable fourni avec l'application, comme Lolly Demo, montre ses couleurs, colourways, polices et signes de marque dans Board dès le départ, avec une étiquette **Came with this app** à côté du titre. Au-dessus, **Start here** propose **Find a look**, **Add from…** et **Pick a colour**.

### Éléments de départ et les tiens

Dans chaque espace, **Starter** marque tout ce qui était fourni avec l'application et que personne n'a choisi. Une installation neuve ne contient aucune couleur, seulement une gamme neutre allant de l'encre au papier, pour que les surfaces, le texte et les filets puissent s'afficher avant tout choix.

::: cols
## Éléments de départ

- Fournis avec l'application : les tons neutres de l'encre au papier, les polices de départ, le rayon des angles par défaut.
- Atténués, avec une étiquette **Starter** et sans teinte.
- Non comptés parmi tes couleurs. Les tons neutres se trouvent dans **Tokens** sous **Neutrals · starter · 9**, et **Open** les affiche dans Colours en un seul groupe replié (`#/start?area=color&group=neutral`).
- Un rôle qui utilise une couleur de départ indique *« Starter Paper sert de remplacement »*, avec **Choose…** sur son sélecteur.

## Les tiens

- Choisis ou installés par toi.
- Pleinement visibles, avec une carte teintée là où tu as installé une police.
- Comptés dans Board et dans Tokens.
- Un rôle qui en suit un autre indique **↳ follows Primary**.
:::

Les éléments hérités n'ont jamais de bordure en pointillés. Une bordure en pointillés indique une zone de dépôt.

<!--i:eti-shapes-->
## Logos

La zone de dépôt en haut, **"Drop marks here, or choose several at once"**, accepte autant de fichiers que tu en as. Lolly lit la forme et l'encre de chaque fichier. Le fichier attend ensuite sous **Waiting for a slot**, sous forme de pastille qui indique à quoi il ressemble, par exemple *« Ressemble au logo Horizontal primary »*, avec la mesure utilisée et un bouton **Place** (**Replace** si l'emplacement est rempli). Quand Lolly hésite, la pastille l'indique et propose **Change slot**, qui liste les huit emplacements. Rien n'est placé avant que tu appuies sur un bouton.

Un signe de marque avec une marge vide excessive reçoit d'abord une proposition de rognage. Réponds à la proposition ou appuie sur Échap pour placer l'original intact. Quand un signe de marque peut remplir un emplacement associé vide, l'espace propose la version dérivée **mono** ou **reverse** sous forme de pastille marquée *Generated*.

Chaque signe de marque prend place dans une grille de huit emplacements facultatifs, un par **orientation** et **traitement** :

- **Orientations :** Horizontal (logotype et symbole sur une ligne) et Vertical (empilés, pour les espaces carrés et hauts).
- **Traitements :** Primary, Primary reverse (pour les arrière-plans sombres), Mono (une seule couleur) et Mono reverse.

Un groupe sans signe de marque se replie sur une ligne ; ouvre-le pour voir ses emplacements. Clique sur un emplacement pour ajouter un PNG, SVG, JPEG ou WebP, ou clique sur un emplacement rempli pour remplacer le signe. Un emplacement vide accepte aussi un fichier déposé. Les signes horizontaux occupent des tuiles larges et les verticaux des carrés, chacun sur la surface pour laquelle il a été conçu, avec un espace libre égal au quart de sa hauteur. Tout reste sur cet appareil.

![Les emplacements de logos avec Horizontal et Vertical dépliés : chaque traitement a son propre emplacement et chaque emplacement est facultatif](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&system=new-design-system&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails.be-logo-group--fold%3Anot%28.be-logo-group--custom%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** désigne les signes que ta marque nomme à sa façon, comme une icône, un blason ou un favicon.
- **D'autres identités.** Une sous-marque, un produit ou un événement peut avoir son propre jeu complet : appuie sur **+ Add another logo** et donne un nom au jeu. Ton jeu principal est « Your logo ». [Architectures de marque](/info/brand-architectures.html) montre quand utiliser une identité de logo.
- **Lolly lit les couleurs du logo.** Une carte sous la zone de dépôt, et en haut de Colours, liste les couleurs du logo et demande **Which is the main colour?**. La couleur la plus forte est sélectionnée, jamais le blanc sur lequel le logo a été exporté. **Use these colours** les ajoute à ta palette et fait de la couleur principale ta couleur primaire. Quand le logo contient une couleur neutre sombre lisible sur papier, elle devient la couleur du texte. **Not now** les laisse dans le Tray. Sur une installation neuve, Lolly applique aussitôt la réponse la plus probable, et la carte propose **Undo** ou une autre couleur principale. Un SVG donne les couleurs exactes ; un PNG, JPEG ou WebP donne les couleurs qui couvrent une part significative du signe de marque.

<!--i:eti-palette-->
## Couleurs

L'espace évolue avec le design system. Une première visite demande une seule décision ; d'autres contrôles apparaissent à mesure que la palette s'enrichit.

### La première couleur

Un système sans couleurs propres affiche les tons neutres de départ dans leur propre groupe ouvert. En haut de l'espace se trouve une zone de collage et de dépôt en pointillés : une grande pastille et un champ. Dépose une image ou une liste de couleurs n'importe où dans la zone, et Lolly lit les couleurs.

- **La pastille est le sélecteur.** **Pick a colour** ouvre la carte OKLCH du studio, initialisée avec le contenu du champ. La carte affiche d'abord le nom et le code hexadécimal de la couleur. Les espaces de couleur, la roue, les quatre cadrans et l'alpha se trouvent sous **Fine-tune**, et **Cancel** et **Add colour** sont en bas. Rien n'entre dans le système avant que tu appuies sur **Add colour**.
- **Le champ accepte toute notation** : `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` ou un nom de couleur. Une liste collée devient une rangée de pastilles à ajouter une par une ou avec **Add all**.
- **Deux autres façons d'ajouter des couleurs.** **Pick a colour from the screen** utilise la pipette quand le navigateur en propose une, et **Take colours from an image** lit une capture d'écran ou une photo sur cet appareil.
- **Add n'est jamais désactivé.** Si le champ est vide, il ouvre le sélecteur ; si le texte est illisible pour lui, une ligne sous le champ l'indique.

Ta première couleur devient la **couleur primaire**. Une pastille confirme le changement, par exemple *« La couleur primaire est maintenant Vivid Violet »*, avec **Fine-tune** pour ajuster la couleur.


### Quand la palette s'enrichit

Tes couleurs se trouvent à côté d'un aperçu **In context** sur un grand écran, et au-dessus sur un écran plus petit. L'aperçu montre une affiche, un graphique ou une carte d'interface dans ta palette. Les couleurs de départ ont leur propre groupe, qui se replie dès que le système a ses propres couleurs. La zone de collage et de dépôt devient une seule ligne compacte. Le haut de l'espace n'a pas d'action d'export ; utilise **Export** dans la barre ou l'espace Tokens.

![L'espace Colours dans Lolly Demo : les pastilles de rôles et la zone de collage et de dépôt en haut, puis la palette en groupes repliables, chaque couleur avec son nom et son code hexadécimal](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![L'espace Colours dans Lolly Demo après l'ajout d'une couleur : le tableau Colour roles, puis la pastille de la nouvelle couleur qui propose Use as Lead? et Fine-tune, à côté d'un aperçu de composition en direct](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Rôles des couleurs : comment les couleurs sont nommées

Le design system nomme ses couleurs et indique à quoi chacune sert, et Lolly lit les deux. **Colour roles** se trouve en haut de l'espace Colours. **In context** montre chaque modification aussitôt.

![Le tableau Colour roles de Wefthouse, une marque textile inventée, avec ses propres termes : les pastilles de colourway Indigo, Madder et Weld, puis Main, Accent, Supporting et Tertiary, chacun avec sa couleur claire et sombre, interprétés comme couleur dominante, couleur associée ou uniquement par leur nom, puis Background, Text, Quiet text et Hairlines listés sous le tableau comme usages qu'aucun rôle ne remplit](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=wefthouse&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

Le tableau a quatre colonnes. Sur un téléphone, chaque ligne devient une carte avec les aspects clair et sombre côte à côte :

| Colonne | Ce qu'elle contient |
|---|---|
| **Role** | Le terme propre au design system, que tu peux modifier sur place, et une ligne indiquant à quoi sert la couleur |
| **Light** et **Dark** | La couleur dans cet aspect pour le colourway choisi, avec son nom ou sa valeur et son contraste |
| **Lolly reads this as** | Ce qu'un outil fait de ce rôle, dans les termes de Lolly |

**Comment Lolly interprète un rôle.** Chaque interprétation correspond à un seul rôle. Choisir une interprétation déjà attribuée à un autre rôle la transfère à ce rôle. Lolly ne déduit jamais le sens d'un mot.

| Interprétation | Ce qui en découle |
|---|---|
| **Lead colour** | Grandes formes, boutons, couleur qu'un outil utilise en premier |
| **Partner colour** | Deuxième couleur qu'un outil utilise |
| **Background** | Se place derrière tout le reste |
| **Text** | Titres et corps du texte |
| **Quiet text** | Légendes et petits caractères |
| **Hairlines** | Filets, bordures et séparateurs |
| **By name only** | Aucun outil ne choisit le rôle de lui-même. Il est proposé dans chaque champ de couleur et dans Design, où le choix reste lié et suit donc le colourway |

Une interprétation qu'aucun rôle ne remplit conserve la définition du design system, et l'espace liste ces interprétations sous le tableau. Un rôle qui porte le même identifiant qu'une interprétation, comme un rôle appelé Primary, correspond à cette interprétation et ne peut pas être réaffecté.

**Dans un graphique.** La palette **Design system - colour roles first** de Lolly Chart attribue aux séries les rôles de couleur du design system dans son propre ordre, puis le reste de sa palette. Un rôle interprété comme arrière-plan, texte, texte discret ou filets est exclu, car le graphique utilise ces couleurs pour son fond et ses mots. Rien ne change tant que tu ne choisis pas cette palette. Un design system sans rôles de couleur affiche la palette sous **Design system - ordered**.

**Valeurs.** Appuie sur une valeur pour choisir la couleur de ce rôle pour cet aspect et le colourway choisi. **Same as light** fait suivre la valeur claire à la valeur sombre jusqu'à ce que tu choisisses une couleur sombre. La pastille **Aa** montre le texte que Lolly choisit de placer sur la couleur. La ligne sous la valeur indique la lisibilité de ce texte dans chaque aspect : **Text reads well**, **Large text only** ou **Hard to read as text**. L'évaluation porte uniquement sur le texte placé sur la couleur ; la couleur peut toujours convenir aux formes et aux grandes surfaces. Un rôle interprété uniquement par son nom affiche les mêmes mots sans la couleur d'avertissement, car aucun outil ne place de texte sur ce rôle de lui-même. L'infobulle et le sélecteur montrent les chiffres, APCA d'abord et WCAG ensuite. **Own text colour** signale une valeur dont le fichier indique la couleur du texte ; cette couleur de texte est conservée. **Copied** signale une valeur provenant d'un autre colourway ou de la couleur partenaire que personne n'a encore choisie ; **Keep this colour** dans le sélecteur confirme la valeur.

**Points de départ.** Un design system sans rôles propres affiche les mots actuels : Primary, Secondary, Surface et Text. Rien n'est écrit tant que tu n'en modifies pas un. **+ Add a role** suggère **Primary, Secondary** ou **Main, Accent, Supporting, Tertiary**, ou accepte les mots que tu saisis, et montre l'interprétation que chacun recevrait. Les deux premiers mots deviennent la couleur principale et la couleur partenaire. Les outils continuent de dessiner avec les mêmes couleurs. Sur un système à une seule couleur principale, le premier colourway prend le nom de cette couleur.

**Renommer, réordonner, supprimer.** Renommer ne change que le mot ; tout ce qui utilise le rôle continue de fonctionner. Fais glisser un rôle par sa poignée, ou appuie sur Espace sur la poignée, utilise les flèches et appuie sur Espace pour déposer. **Remove** indique ce qui utilise encore le rôle. Quand des outils interprètent le rôle, **Remove and keep those colours** laisse à chaque interprétation sa couleur actuelle. Une règle interne, un groupe de guides, un champ d'outil ou un autre token qui utilise le rôle empêche sa suppression tant que cet usage ne change pas. Un document Design enregistré peut aussi utiliser un rôle par son nom, et Lolly ne peut pas le voir depuis le fichier de tokens. Un tel document signale la couleur comme non résolue.

::: details Rôles dans un fichier de tokens écrit à la main
**Un fichier écrit à la main.** Les couleurs d'un fichier de tokens qu'aucun rôle ne déclare sont listées sous **In this file, with no role yet**, chacune avec un champ pour un mot et **Make a role**. Elles continuent de fonctionner par leur nom dans les deux cas. Un token dont le nom contient des chiffres ne peut pas être un rôle ; il reste dans le fichier et continue de fonctionner par son chemin. Si un enregistrement du fichier n'est pas valide, le tableau s'affiche sans contrôles et explique pourquoi.
:::

**Le reste de l'espace emploie les mêmes mots.** Les pastilles, la ligne **Use as** de l'échantillon et le groupe **Colour roles** de la palette utilisent tous les mots du design system. La tuile d'un rôle de couleur ouvre sa valeur. Les fichiers exportés n'enregistrent rien de nouveau sur les rôles ; les couleurs d'un rendu changent parce que les tokens ont changé.

**Où vont les mots.** Les mots et les descriptions voyagent avec le design system. Les agents les lisent dans le brief de design, `lolly://tokens` et le `AGENTS.md` d'une page de marque. Le terminal les affiche dans `lolly system status`. Une page de marque les liste dans `brand.json` et mesure une paire de contraste pour chaque rôle. Les fichiers DTCG et Tokens Studio conservent tout, `DESIGN.md` conserve les mots et les interprétations, et un thème PowerPoint ne conserve que l'ordre de la marque. [Rôles de couleur dans les autres formats](/info/design-tokens.html#colour-roles-in-other-formats) donne la liste complète. Les mots sont toujours cités comme des données du design system, jamais lus comme des instructions.

**Où une couleur se choisit.** Chaque champ de couleur d'un outil et de Lolly Design liste d'abord les rôles du design system, dans son propre ordre, avec chaque mot et sa fonction. **Aa** à côté d'un rôle choisit la couleur qui se place sur ce rôle. Les autres couleurs suivent sous **Other colours**, sans les copies propres à un colourway, les couleurs de premier plan et les interprétations qu'un rôle remplit déjà. Un choix reste lié au rôle et suit le colourway. Le champ affiche le mot dans chaque colourway, et Settings et Tokens utilisent aussi ce mot. Un design system sans rôles conserve sa grille d'échantillons.

### Chaque couleur qu'un outil lit

Quand **Colour roles** est fermé, l'espace commence par des pastilles pour les premières décisions. Chaque pastille montre la couleur du rôle et son nom. Sur un système sans mots propres, ce sont **Primary**, **Secondary**, **Surface** et **Text**. Appuie sur une pastille pour choisir sa couleur parmi les échantillons de la palette. **Every colour a tool reads**, en bas de **Colour roles**, contient la bande complète.

La bande montre les sept couleurs qu'un outil peut lire : Primary, Secondary, Surface, Text, Muted, Edge et On primary, dans les mots propres au design system quand il en a. Chacune joue le même rôle dans chaque outil et chaque export. Aucune n'a besoin d'être définie, et n'importe quelle couleur peut en remplir une. Trois couleurs indépendantes font un bon système. L'indicateur donne la lisibilité du texte sur la surface, APCA d'abord. Chaque ligne montre ta propre couleur à pleine intensité, une couleur de départ qui la remplace ou **↳ follows Primary**.

On primary est dérivé de la couleur principale, affiche **Derived** et n'a pas de sélecteur. La bascule **Light** et **Dark** à côté de On primary, et celle à côté de **In context**, choisissent l'aspect que montrent la bande, la palette et l'aperçu.

La couleur d'accent de l'application suit le design system par défaut, grâce au réglage **Interface follows the design system** dans **Settings → Appearance**. Quand ce réglage est désactivé, l'interface de l'application reste neutre. Les outils, les canevas et les exports suivent le design system dans les deux cas.

**Colourways.** Un design system peut contenir plusieurs couleurs principales, choisies par pièce. La ligne **Colourways** en haut de **Colour roles** montre une pastille par colourway, avec **Default** sur le canonique. **+ Add** crée un colourway à partir d'une couleur de la palette. Choisis une pastille, et le tableau, la bande, la palette et les aperçus montrent ce colourway. Tu peux renommer, dupliquer, supprimer ou définir par défaut le colourway choisi. Sur un système avec des colourways, chaque colourway a besoin de ses propres couleurs principale et secondaire, et de sa propre surface quand les colourways teintent l'arrière-plan. Ces rôles restent définis dans l'éditeur d'échantillon. [Ajouter des colourways à un design system](/info/colourways.html#add-colourways-to-a-design-system) donne les étapes et le format des tokens, et [Lolly Demo en pratique](/info/lolly-demo-in-use.html#colourways-on-real-work) montre les colourways sur du vrai travail. Chaque personne peut choisir son propre colourway dans **Settings → Appearance** ([Adopter un colourway](/info/colourways.html#make-a-colourway-your-own)).

### Trouver plus de couleurs

Trois outils partent de ta couleur principale. Les deux premiers ne font que suggérer ; le troisième remplace la palette.

::: cols
## Explorer les nuances & harmonies

Choisis une **Starting colour**, un **Scheme** (Mono, Complement, Analogous ou Triad) et le nombre de **Shades** (3 à 20, 5 par défaut). **Fine-tune** règle l'intensité de l'interface, le contraste et le texte sur la couleur de marque. Clique sur une nuance pour l'ajouter, ou sur **Add 5 shades** pour un groupe. Tes couleurs et tes rôles restent.

## Trouver des couleurs assorties

Choisis une **Harmony** : Complementary, Adjacent, Triad, Tetrad ou Analogous (avec **Accents** de 2 à 5 et un **Angle** de 10° à 45°). Chaque proposition a un nom généré et **+ Add**, un appui par couleur.

## Reconstruire toute la palette

Remplace la palette à partir d'une couleur de départ, après un examen de ce qui change et de ce qui reste.
:::

Les trois utilisent les mêmes calculs de couleur perceptuelle (OKLCH) que le moteur. Dans **Explore shades & harmonies**, les lignes **Primary**, **Neutral** et **Secondary** montrent les nuances suggérées, et **Theme preview** montre des exemples clairs et sombres avec leurs mesures de contraste.

![Trois groupes de nuances suggérés, avec des contrôles d'ajout individuels et un aperçu du thème séparé](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Des couleurs d'accent générées, chacune avec un échantillon, un nom généré automatiquement, sa valeur hexadécimale et un bouton Add](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Appliquer une palette générée

Ouvre **Rebuild the whole palette…** et appuie sur **Preview full rebuild**. L'examen compte combien de rôles restent tels que tu les as attribués, combien de tes propres couleurs sont conservées et combien de courbes de nuances, de verrouillages d'impression, de nuances masquées et de points de dégradé sont réancrés ou conservés. **Apply rebuilt palette** applique ; **Cancel** ne change rien. Ensuite, la carte propose **Undo**, qui a déjà le focus, et le point de contrôle pris avant le remplacement restaure tout le système.

Un système avec des colourways conserve chaque colourway lors d'une reconstruction. Le colourway canonique suit la nouvelle couleur de départ, et chaque autre colourway conserve ses propres couleurs, son nom, son ordre et ses réglages. L'examen liste le colourway qui suit et ceux qui conservent leurs couleurs. Lolly ne reconstruit pas un système dont les colourways sont encodés d'une façon qu'il ne peut pas modifier ; la carte explique pourquoi, et rien ne change.

### Les sections avancées

Quatre sections repliées se trouvent sous l'aperçu et les rôles. Chacune s'ouvre avec `#/start?area=color&focus=<name>` :

- **Explore shades & harmonies** (`focus=generate`).
- **Shade curves** (`focus=curves`) remodèle une rampe point par point, avec des courbes distinctes pour la luminosité, la chroma et la teinte (L / C / H) et des nuances qui se redessinent pendant le glissement.
- **Contrast** (`focus=contrast`) : **Contrast-lock** ajuste les tons d'une rampe pour atteindre les cibles APCA sur un arrière-plan que tu choisis, et **Rotate hue** fait tourner toute la rampe autour de la roue.
- **Print** (`focus=print`) définit ce que devient la couleur principale sur presse : sa valeur automatique, une composition CMYK fixée ou une encre en ton direct nommée.

### La palette et chaque échantillon

La palette liste tes couleurs dans des groupes repliables, chacun avec son propre **+ Add**. Tu peux créer et renommer des groupes. Un rôle ne crée jamais de deuxième tuile ; la tuile vers laquelle un rôle pointe affiche le nom du rôle, comme **Primary**. **Colour chart** sous les tuiles montre les mêmes couleurs sur la **Wheel** OKLCH (fais glisser un point pour changer sa couleur, clique sur un espace vide pour ajouter un échantillon) et le graphique **Gamut**, qui montre où s'arrête la gamme affichable. `#/start?area=color&focus=chart` ouvre le graphique.

![Le panneau de la palette, avec chaque groupe repliable](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![La roue OKLCH - l'angle est la teinte, la distance au centre est la chroma et les gris suivent un rail de luminosité sur le côté](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Clique sur un échantillon pour ouvrir son éditeur :

- **Rename** renomme l'échantillon.
- **Set the colour** règle la couleur avec des curseurs OKLCH, ou en **Hex**, **HSL**, **RGB** ou **CMYK**. Le champ de valeur lit et écrit dans l'espace actif. CMYK définit ici la couleur à l'écran par conversion ; pour fixer des encres exactes, utilise **Print substitutes**.
- **Stored as** choisit comment l'échantillon est enregistré : **LCH** (par défaut, perceptuel et à gamut étendu), Hex, RGB ou HSL.
- **Use as** attribue un rôle à l'échantillon, dans les mots propres au design system quand il en a. Appuie de nouveau sur un rôle en surbrillance pour retirer ce rôle.
- **Print substitutes** (replié) : passe **CMYK** de **Auto** à des valeurs d'encre exactes verrouillées, ou définis une **Spot colour** avec un **Name** (comme `PANTONE 186 C`), un **Book** facultatif et une **Finish** pour la dorure, le gaufrage, le débossage, le vernis sélectif, le toucher doux ou une découpe, un rainage ou une perforation. Une presse utilise ces verrouillages quand tu exportes un PDF ou un TIFF CMYK ; voir [Profils de couleur](/info/exporting.html#colour-profiles). Une encre en ton direct s'imprime sur sa propre plaque dans un Print PDF ; pour imprimer toutes les encres en ton direct en quadrichromie pour un export, voir [Encres en ton direct en quadrichromie](/info/exporting.html#spot-inks-as-process).
- **In other spaces** (replié) : une valeur par espace de couleur, dérivée ou définie par toi, et une valeur définie par toi est prioritaire à l'export.

**Supprimer un échantillon** est sans risque. Les nuances dérivées et les rôles de thème sont masqués, donc rien de ce qui les lit ne cesse de fonctionner. Les couleurs que tu as ajoutées sont supprimées.

::: details Travailler avec de nombreux échantillons
Au repos, un échantillon montre sa couleur, son nom et sa valeur hexadécimale. Select affiche la case à cocher et la poignée de déplacement de chaque échantillon sur tout écran, et une tuile qui a le focus clavier affiche aussi sa poignée. Fais glisser une poignée pour réordonner dans un groupe, ou donne le focus à la poignée, appuie sur Espace, utilise les flèches et appuie de nouveau sur Espace pour déposer ; Échap annule. Sur un téléphone, la palette affiche quatre couleurs par ligne. Pour déplacer des couleurs entre groupes, utilise le contrôle **Group** de l'éditeur ou sélectionnes-en plusieurs et utilise **Move to**.

La sélection n'a pas besoin de bascule séparée : la barre et les cases à cocher apparaissent avec la première tuile sélectionnée et disparaissent avec la dernière.

- **Fais glisser sur un espace vide** pour dessiner un rectangle ; chaque tuile qu'il touche rejoint la sélection, même dans d'autres groupes. Une section repliée n'ajoute rien.
- **Maj-clic** prend une plage dans l'ordre de lecture, **Cmd/Ctrl-clic** sélectionne ou désélectionne une tuile et un simple clic ouvre l'éditeur.
- Chaque en-tête de groupe a **Select all**, et **Cmd-A** avec une tuile ayant le focus prend toutes tes propres couleurs, jamais une couleur de départ.
- La grille a un seul arrêt de tabulation : les flèches déplacent, Maj-flèches étend la sélection, Espace sélectionne ou désélectionne, Suppr supprime et Échap efface la sélection. Pour ajuster un canal par petits pas, appuie d'abord sur `l`, `c` ou `h`.
- Sur un écran tactile, appuie longuement sur une tuile pour commencer une sélection, puis touche pour ajouter.

La barre affiche **{n} selected**, puis **Move to**, **Give a role** (chaque couleur prend le rôle suivant à son tour), **Download** (la sélection dans l'un des six formats de palette), **Duplicate** (une copie de chacune, placée après l'original), **Copy values** et **Delete**. Une seule copie s'ouvre dans l'éditeur ; plusieurs restent sélectionnées. Un Cmd/Ctrl-Z annule une action groupée.
:::

### Dégradés

Le panneau facultatif **Gradients** crée des tokens de dégradé à partir de la palette. Chaque dégradé a un aperçu, 2 à 8 points nommés et un angle. Un point renvoie à un échantillon : change la couleur de l'échantillon et le dégradé suit. Les dégradés se font en OKLCH.

Les téléchargements de la palette (design tokens, CSS, SCSS, GIMP et Adobe Swatch Exchange) se trouvent en haut de la palette. [Emporter ta palette et tes polices partout](/info/using.html#take-your-palette-and-fonts-anywhere) décrit chaque format.

<!--i:eti-type-->
## Typographie

Sans police propre, l'espace montre une carte : **Primary**, composée à une taille de lecture dans sa police actuelle, avec une étiquette **Starter**, un bouton **Choose for Primary** et la ligne *« Rien ne s'installe tant que tu n'en choisis pas une. »* Les titres, le code et l'italique suivent la police principale jusqu'à ce que tu les choisisses ; **Choose them separately** affiche leurs cartes.

![L'espace Type sans police choisie - une carte à une taille de lecture, une étiquette Starter dessus et un bouton Choose for Primary plein](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Choisis une police et l'espace déploie quatre cartes de rôle, la liste Fonts et un spécimen en direct :

- **Primary** : corps du texte, boutons et chaque outil.
- **Headings** : la police de titrage pour `h1` et `h2`.
- **Code** : une police à chasse fixe pour le code et les données.
- **Italic** : un vrai italique pour l'emphase, les citations et les apartés.

Une carte n'est teintée que si tu y as installé cette police. Son bouton indique le rôle : **Change Headings** sur une police à toi et **Choose for Headings** partout ailleurs. La ligne d'exemple passe à la ligne. Rien sur une carte n'applique de changement ; le bouton ouvre la zone de comparaison pour ce rôle.

![Les quatre cartes de rôle dévoilées - chacune composée dans la police qui lui sert, avec une étiquette Starter là où personne n'en a choisi et Italic qui suit la police principale](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### La zone de comparaison

La zone s'ouvre sous la carte sur laquelle tu as appuyé. Les cartes se replient en une bande d'une ligne pour que la zone apparaisse sur le premier écran d'un téléphone. Échap annule et rend le focus à la carte.

1. Appuie sur **Choose for** suivi du rôle sur la carte.
2. Saisis un nom de famille et appuie sur **Preview**, ou appuie sur l'une des six familles **Pinned** sous le champ.
3. Appuie sur **Use this face**.

![La zone de comparaison ouverte sous sa carte, avec la ligne de recherche, les familles épinglées et les cartes repliées en une bande d'une ligne](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**Le consentement est demandé une seule fois.** La première fois qu'un aperçu contacte Google Fonts, une boîte de dialogue explique : *Google reçoit le nom de la famille et ton adresse IP. Le fichier est ensuite conservé sur cet appareil et utilisé hors ligne. C'est la seule étape du studio qui contacte un tiers.* **Fetch from Google** poursuit l'opération et mémorise ce choix. **Cancel** laisse la carte afficher *« Non récupéré. Rien n'a été envoyé à Google. »*, avec son propre **Fetch from Google**.

**Dépose un fichier de police sur la zone** (TTF, OTF ou WOFF) pour prévisualiser une police dont tu possèdes la licence. Dans les deux cas, la police reste sur cet appareil, sert au rendu hors ligne dans l'application, les outils et chaque export, et voyage dans le fichier du design system. Tout ce qui est proposé sur Google Fonts est distribué sous licence ouverte (OFL, Apache ou UFL).

### Polices sur cet appareil

Le panneau **Fonts** liste chaque police sur cet appareil et le rôle qu'elle remplit. Les polices que tu as ajoutées viennent en premier, sous **In the design system**, chacune avec ses rôles et une action de suppression. Les polices de départ suivent dans une seule ligne atténuée et repliée. **Add a face** ouvre la zone de comparaison pour n'importe quel rôle. Le panneau **Type roles** montre un spécimen en direct de chaque rôle avec sa famille et son état, comme *Inter* ou *Inter · follows Primary*.

<!--i:eti-tag-->
## Tokens

Les tokens sont les valeurs nommées derrière le design system : couleurs, polices, logos, angles et espacements. Les outils les lisent par leur nom, donc un changement ici atteint chaque outil à la fois.

![L'espace Tokens : l'en-tête avec un exemple du système et les actions sur les fichiers, les tuiles qui comptent chaque type de token, puis les paires de couleurs avec leurs mesures de contraste](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **L'en-tête** donne un exemple de ton propre système (*Primary est Spearmint, #033633*) et les actions sur les fichiers : **Download** (le système en design tokens, ou la palette dans cinq autres formats), **Copy CSS** et **Add from…** pour réimporter un fichier JSON.
- **Les tuiles** comptent chaque type de token et mènent à sa section : Colours, Type, Logos, Shape and spacing, More et All tokens. Une section qui ne contient que ce qui accompagnait le système de départ vierge porte une étiquette **Starter** ; un système fourni avec l'application compte ses propres éléments sans l'étiquette. Sur un téléphone, les tuiles se répartissent en deux lignes de trois.
- **Colours** commence par les paires que les outils assemblent (texte sur surface, sur la couleur principale, texte discret sur surface) avec une mesure APCA en clair et en sombre, et signale **Weak contrast** lorsqu'une paire n'atteint pas le seuil. Puis vient chaque groupe de couleurs : une rampe sous forme d'une ligne de pastilles, les autres couleurs avec leur valeur et la référence que les outils utilisent, comme `{color.brand.spearmint}`. Appuie sur une référence pour la copier. **Edit in Colours** ouvre un groupe dans l'espace Colours. Sur un design system avec des [rôles de couleur](#colour-roles-what-the-colours-are-called), **Colour roles** vient en premier, avec chaque rôle une fois dans les mots et l'ordre propres au système. Un rôle conserve une couleur pour chaque colourway et chaque aspect. Ces couleurs sont listées avec le rôle, pas comme des couleurs séparées ; modifie-les dans le tableau Colour roles.
- **Type** et **Logos** listent la police de chaque rôle et chaque emplacement de logo, avec **Edit in Type** et **Edit in Logos** dès que tu as les tiens.
- **Shape and spacing** contient **Rounded corners** (`shape.radius`) et **Spacing rhythm** (`space.base`). Chacun affiche *Lolly default* jusqu'à ce que tu déplaces le curseur, puis *Yours*, s'enregistre aussitôt et peut être annulé.
- **More tokens** ajoute des espacements, des dimensions, des épaisseurs de trait, de l'opacité, de la rotation, des nombres simples et des ombres, enregistrés comme [design tokens](/info/design-tokens.html) standard.
- **App appearance (advanced)** liste les couleurs, les tailles et les ombres que les écrans de Lolly utilisent, et **Inspect every token (advanced)** recherche et modifie toute valeur enregistrée en montrant d'abord chaque changement pour examen. Là, les valeurs d'un rôle de couleur dans chaque colourway sont listées avec le rôle : choisis le token du rôle pour voir une ligne par colourway, clair et sombre côte à côte. La ligne de décompte indique combien de valeurs les rôles contiennent. Un design system en lecture seule montre la même liste.

Une section vide propose **Pick a colour**, **Choose a face** ou **Add a logo**.

<!--i:eti-images-->
## Fichiers

Dépose les fichiers que ta marque conserve, en dehors des logos : fichiers **vectoriels**, **image**, **audio** et **animés** (vidéo, Lottie et animations). Ils apparaissent dans [Assets](/info/using.html#assets-your-library), triés en sections, et dans le sélecteur de ressources de chaque outil. Ils restent sur cet appareil.

## Son

**Sound** se choisit à l'écoute. L'espace s'ouvre sur trois sons de départ, **Calm**, **Steady** et **Bright**, chacun dans une carte aux couleurs de son genre avec un bouton de lecture. Lance-en un pour entendre un court extrait ; en lancer un autre arrête le premier. **Choose** attribue ce son à tous les usages. La quatrième carte, **Mixed**, donne à chaque usage son propre son : Calm pour Explain, Steady pour Demonstrate et Bright pour Play. Son bouton de lecture joue les trois à tour de rôle. Rien n'est enregistré tant que tu ne choisis pas **Save sound**. Le son fait alors partie de ce design system, avec un point de contrôle dans le même historique que les autres espaces utilisent. Un design system sans son continue de fonctionner comme avant.

Un usage est un moment où le son est joué : **Explain**, **Demonstrate** et **Play** pour commencer. Chaque usage est une pastille avec son propre bouton de lecture. **Music** ou **With narration** au-dessus des pastilles définit si une pastille joue la musique seule ou sous une voix. L'usage que tu choisis montre sa fonction et sa musique en mots simples, par exemple « Chaleureux · 84 bpm · Rhodes, basse roulante, batterie au son patiné ». Chaque usage prend le genre, le tempo et les instruments du son choisi (ou, avec Mixed, les siens). Chaque usage conserve sa propre mélodie et son propre équilibre : Explain laisse la place à la voix, et Play met la mélodie en avant. Passer de Mixed à un seul son ou l'inverse conserve les deux. Un usage que tu as ajouté conserve le son qu'il a sous Mixed. Le design system enregistre ton choix. **Add a use** en ajoute un et te laisse saisir son nom sur place. **Make main** choisit l'usage joué quand rien d'autre n'est demandé. **Another tune** joue une nouvelle composition avec les mêmes réglages.

**Edit in the music generator** ouvre le [générateur de musique](/info/generated-music.html#the-music-generator) sur les réglages de cet usage, avec une ligne en haut qui indique à qui appartient le son que tu modifies. **Save to this use** ramène les réglages dans l'espace ; **Cancel** revient sans rien changer. Les choix non enregistrés dans l'espace attendent pendant ton absence. Si quelqu'un enregistre le son dans un autre onglet entre-temps, l'enregistrement le plus récent est conservé et ta modification est écartée.

**Voice** choisit une voix pour l'usage, la vitesse de parole et le volume de la musique sous la voix ; **Hear the voice with the music** joue les deux. Sous **More** se trouvent l'atténuation pendant que la voix parle, les mots à essayer (ils restent dans l'espace), les notes de prononciation (une par ligne, sous la forme écrit = prononcé) et les notes sur la voix. Les aperçus utilisent le modèle vocal local et le même mixage qu'un export de séquence. Un aperçu se termine en fondu ; ce n'est pas une fin composée.

**Notes and signature** contient ce qu'il faut écouter dans un usage et une signature sonore : une ouverture ou une fin fixe conservée dans son propre fichier audio. Place la signature dans ta séquence ; la musique générée ne contient jamais la signature. Une exigence que cette version de Lolly ne peut pas vérifier bloque la création de musique pour cet usage.

**Details** contient le caractère de la marque (l'impression que le son doit donner, ce qui reste identique et ce qu'il faut éviter) et l'évaluation d'écoute. **Record a listening review** conserve le nom de la personne qui évalue, la date et ses notes avec la version enregistrée du son. Tout changement remet le son à l'état de brouillon. Une évaluation couvre cette version, pas chaque morceau créé à partir du son ensuite : écoute chaque nouvelle pièce avant sa diffusion.

**Make a music project** ouvre l'usage dans le générateur de musique comme un projet qui conserve l'usage, la version du son et les réglages exacts. **New tune** y crée une nouvelle composition et conserve le son. Si tu modifies les réglages, **Put the sound back** revient au son, et **Keep as my own** poursuit avec un morceau indépendant. Tant que tu n'as pas choisi, le projet ne peut pas être enregistré ou téléchargé comme créé à partir du son. Les liens de partage ne contiennent que les réglages musicaux. Le projet et un morceau enregistré conservent aussi les notes du son, qui restent absentes des liens de partage et des informations de provenance publiques du fichier audio. Conserve un enregistrement du rendu quand l'audio exact doit survivre aux futures versions du générateur.

<!--i:eti-checklist-->
## Règles

**Rules** définit ce que les personnes peuvent changer, ce qui reste fixe et ce que Lolly peut vérifier.

![Rules sur Lolly Demo : quatre règles internes, chacune marquée Checked in Design et Required ou Advisory, puis Try your design system in use avec ses exemples prêts à rendre](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** liste tes règles. **Add rule** (ou **Add your first rule**) ouvre un court formulaire :

- un **Rule name** dans tes propres mots, comme *Accents Beacon* ;
- le **Check** : **Colour choices**, **Font choices**, **Fixed artwork** ou **Text length**, avec le rôle de marque qu'il utilise, sous le nom que tu donnes à ce rôle ;
- l'**Example** auquel il s'applique (Poster, Title slide, Content slide ou Lolly Chart), le **Mode** et son statut **Required** ou **Advisory** ;
- **Reviewed by**, puis **Save draft** ou **Approve & save**.

L'approbation enregistre ta propre décision sur cet appareil. Les règles obligatoires approuvées contraignent l'affiche réutilisable, et les vérifications ne couvrent que les PNG d'exemple ; elles ne changent aucun autre outil.

Les règles du fichier de tokens d'un design system, comme les associations de couleurs approuvées, la graisse et l'alignement du texte ou un logo par surface, sont listées ici comme **Checked in Design**. Lolly Design les vérifie calque par calque dans la carte **Before you export** du panneau d'export, et `lolly check` fait de même pour un document Lolly Design enregistré ([Avant d'exporter](/info/design.html#before-you-export)). Une règle pour laquelle cette version n'a aucun vérificateur est conservée telle quelle et marquée **Unchecked**.

Lolly Demo apporte quatre règles internes approuvées. Les titres ne sont jamais composés en majuscules : cette règle est obligatoire, donc `lolly check` signale un titre en majuscules comme une erreur. Les trois autres sont des recommandations. Le corps du texte est aligné à gauche. Les marques principales se placent sur des surfaces claires et les marques inversées sur des surfaces sombres. Les lignes en pointillés signifient déposer ici.

**Try your design system in use** rend quatre exemples à partir de la révision actuelle avec **Render & check examples**. Choisis un **Mode** et **Try your own text** pour le titre, le texte d'accompagnement et le texte de diapositive. Chaque exemple indique ce qui a été mesuré, avec **See checks & sources** et **Download check report**. **Make reusable poster** télécharge un `.lolly` qui contient sa mise en page fixe et ses choix d'entrées approuvés. Les exemples sont locaux : lancer une vérification ne publie et n'approuve rien.

Une version fournie avec une marque fixe montre les mêmes règles et exemples en lecture seule, sous *This brand is set*.

<!--i:eti-graduation-cap-->
## Compétences

**Skills** liste les [compétences de marque](/info/brand-skills.html) du design system actif : les normes écrites de la marque, une par discipline, pour les personnes et les agents IA. Chaque ligne donne la discipline, le statut propre à la marque (**Draft** ou **Approved**), le caractère public ou interne de la compétence et sa révision. Choisis une ligne pour lire la compétence avec sa couverture, qui compare les lignes de la compétence à tes tokens : ce que Lolly vérifie, ce qui entre en conflit, ce qui concorde et ce qui relève seulement du conseil.

**Download skill (.zip)** écrit la compétence sous forme de dossier Agent Skills pour un outil d'agent, avec des liens de catalogue vers ce Lolly. **Copy as one file** place le même texte dans le presse-papiers pour une fenêtre de conversation. Un design system sans compétences propres liste une base que Lolly écrit à partir de ses tokens et de ses règles internes à chaque lecture de cette base. L'espace lit les compétences et ne les modifie jamais.

<!--i:eti-upload-->
## Importer une marque

**Add from…** dans la barre ouvre un sélecteur qui demande ce que tu as, pas son format :

- **Design tokens or a design file** : un JSON DTCG ou Tokens Studio, un projet Penpot, un zip de jeux de tokens, un pack de design system Lolly, un SVG, un `DESIGN.md` ou un dossier de page de marque.
- **PDF** : un deck ou un fichier de charte, lu sur cet appareil pour ses couleurs, ses marques et ses polices incorporées.
- **Logo or screenshot** : une image devient une palette suggérée, lue sur cet appareil. La lecture porte sur les couleurs, pas sur la police ni la mise en page.
- **Saved web page** : un fichier HTML et ses fichiers CSS, ou du HTML ou du CSS collé, jusqu'à 20 fichiers et 2 Mo. Seul le texte que tu fournis est lu : les ressources liées ne sont pas récupérées et les scripts ne s'exécutent pas.
- **Font file** : TTF, OTF ou WOFF. Ouvre l'espace Type, où la police s'installe.
- **Website** : une page, lue pour ses couleurs et sa typographie. Cette tuile n'apparaît que sur un appareil capable de lire une page, et indique le lecteur qu'elle utilise : l'application sur cet appareil, ou l'extension du navigateur dans un onglet en arrière-plan, avec ta session connectée. Saisir une URL ne fait que remplir le champ ; appuyer sur le bouton de récupération vaut consentement.

Choisis la source de fichier de design et la carte suivante liste les formats acceptés sous forme de tuiles à icônes. La carte entière est une zone de dépôt. Tu peux aussi déposer un fichier sur le studio.

![La carte d'import - les formats acceptés apparaissent d'abord sous forme de tuiles à icônes, et toute la carte est une zone de dépôt](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- Un **pack de design system Lolly** (`.lolly`, ou un ancien `.zip`) s'installe en une étape.
- Un export **Penpot** (`.penpot`) apporte ses design tokens.
- Un fichier **Design Tokens** (W3C DTCG) ou **Tokens Studio** (`.json`) apporte ses tokens. Une description qui demande au lecteur d'ignorer des instructions, revendique des permissions ou demande d'exécuter du code est écartée, et l'import indique où elle se trouvait.
- Un **simple SVG** est analysé pour en extraire des couleurs parmi lesquelles tu choisis, la première devenant ta couleur principale.
- Un **`DESIGN.md`** (`.md`) passe par **Try these colours** avec ses tokens tels qu'ils sont écrits. Son texte peut être conservé comme brouillon de compétence de marque, et la carte signale les lignes qui demandent au lecteur d'ignorer des instructions, revendiquent des permissions ou demandent d'exécuter du code. Les agents et les pages de marque ne voient pas un brouillon tant que tu n'appuies pas sur **Keep this skill** dans l'espace Skills, et une compétence conservée reste interne.
- Un **dossier de page de marque**, choisi comme dossier, déposé ou zippé, passe par le même examen. Chaque fichier est vérifié par rapport au `brand.json` du dossier ; un seul fichier qui ne correspond pas entraîne le refus du dossier entier. L'import ajoute les tokens. Les logos et les polices restent dans le dossier.

::: warning La vérification des instructions lit ligne par ligne
La vérification qui écarte les instructions dans les descriptions d'un fichier de tokens lit ligne par ligne et laisse passer d'autres formulations. Lis un fichier provenant de quelqu'un que tu ne connais pas avant d'appliquer les tokens.
:::

Lolly lit une page de marque à partir des fichiers que tu fournis. Il ne récupère pas l'adresse d'un autre site.

### Un fichier avec ses propres mots pour les couleurs

Un fichier de tokens ou un `DESIGN.md` peut utiliser ses propres mots pour ses couleurs, comme main, accent, supporting et tertiary. Quand Lolly trouve de tels mots, l'examen liste chaque mot avant toute application : le mot, sa couleur dans chaque aspect, le token dont il provient et l'interprétation suggérée par Lolly. Lolly suggère des interprétations à partir des seuls mots, à l'aide d'une courte liste, sans modèle. Un mot absent de la liste arrive comme un mot propre à la marque, **By name only**. Tu peux renommer n'importe quel mot, indiquer à quoi il sert, lui donner une autre interprétation ou le décocher pour le conserver comme couleur nommée.

**Install with these roles** écrit les rôles ; **Install without roles** installe le fichier tel qu'il est arrivé. Un fichier sans ces mots saute cette étape. Un fichier qui déclare ses propres rôles, comme un fichier écrit par Lolly, les montre tels qu'ils sont écrits et les installe sans changement ; tu peux les modifier ensuite dans l'espace Colours. Le terminal n'a pas d'étape d'examen : `lolly system import` conserve un enregistrement déclaré et laisse les mots des autres fichiers comme couleurs nommées.

### Examiner une référence

Un logo, une capture d'écran, un site web ou une page enregistrée ouvre **Try these colours** : un exemple dans les couleurs proposées, une **Main colour** que tu peux modifier et un nom pour un nouveau système. Un encadré indique ce que fait l'application des réglages : elle **remplace** les réglages de tokens actifs par la palette générée et les styles par défaut, **conserve** tes polices et tes fichiers de bibliothèque et le système précédent peut être **récupéré**. **Apply suggested settings** prend un point de contrôle, puis applique les palettes claire et sombre. **Restore brand settings** peut rétablir les anciens réglages. **Change reference** choisit une autre source.

::: details Ce qu'une référence permet de lire, et le rapport de contexte de design
**Palette, source details and individual choices** montre ce qui a été lu, les noms de polices trouvés et le contraste de l'aperçu. Les noms de polices ne sont que des suggestions ; tu installes une police dans Type. Les détails de la source peuvent inclure la typographie, les écarts, les marges intérieures et les valeurs d'angles lorsqu'ils sont observés, sinon ils sont marqués **Not observed**. Une page enregistrée ou une lecture native de site web rapporte les styles déclarés, que la page n'utilise pas forcément. L'extension du navigateur peut rapporter les styles mesurés sur un échantillon d'éléments visibles. Ce sont des observations : rien n'est installé, et les espacements de la source ne remplacent jamais les tiens. **Choose individual items in the tray** conserve des éléments individuellement. **Download design context** enregistre un rapport JSON des observations, des tokens proposés et des informations de source (avec un SHA-256 de tout HTML ou CSS fourni). Le rapport ne contient aucun texte brut de la page et n'est pas un Content Credential signé.
:::

Les imports de PDF et de fichiers de design conservent leurs propres contrôles d'examen. Les éléments du **Tray** ne changent rien tant que tu ne les ajoutes pas dans l'espace qui gère ce type de contenu. `#/start?source=<kind>` ouvre le sélecteur sur une source (`file`, `pdf`, `image`, `font`, `url`, `page`), et `?import` ouvre la liste simple.

### Trouver et comparer un aspect

Ouvre **Find a look** depuis le Board ou depuis la liste des design systems dans Settings. Parcours les systèmes enregistrés sur cet appareil et quelques exemples Lolly réutilisables, et recherche par nom, étiquette de couleur ou police déclarée. **Closest to my current palette** trie par similarité de couleur mesurée, les polices correspondantes départageant les ex æquo ; ce n'est pas une note de qualité.

Clique sur un aspect pour le prévisualiser en contexte ; l'aperçu ne change rien. **Use this look** sur une carte applique cet aspect. Un système enregistré devient le système actif, ce qui ne modifie rien. Les couleurs d'un exemple sont intégrées au design system ouvert après le point de contrôle habituel. Les logos, les polices et tout ce que l'exemple ne définit pas restent tels quels dans le système. **Compare looks** ajoute une case à cocher à chaque carte : choisis-en deux pour les comparer côte à côte. **Restore brand settings** récupère l'aspect précédent. Les systèmes enregistrés ont des **Search tags** modifiables sous **Details and design context**. Les exemples sont des recettes de couleurs originales de Lolly, sans collection extraite du web et sans compte.

![Lolly : comparer Sunroom et Orchard côte à côte avant d'appliquer l'un des deux systèmes de couleurs.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

<!--i:eti-package-->
## Conserver et déplacer ton design system

### Déplacer une marque entre appareils

**Export** écrit un fichier **`LollyBrand-….lolly`** : tes tokens, tes polices, tes logos et ta préférence de thème, avec un manifeste d'intégrité vérifié à l'import. Les versions web antérieures à 1.0.7 nommaient le fichier `.zip`, et Lolly accepte toujours cette extension. **Tokens (.json)** écrit le document de design tokens seul, sans polices ni logos, pour un dépôt, une étape de compilation ou un autre outil de tokens.

Pour en réimporter un, utilise **Add from… → Design tokens or a design file**, ou dépose le fichier sur le studio. C'est ainsi qu'un collègue te transmet une marque ou que tu en emportes une vers une deuxième installation, sans compte et sans cloud. [Travailler avec des partenaires](/info/partners.html) explique quoi envoyer d'autre quand la personne qui reçoit ta marque travaille pour une autre organisation. Pour importer une marque en ligne de commande, voir [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** regroupe les polices que tu as ajoutées dans un RPM installable. Si tu as téléversé certaines d'entre elles toi-même, Lolly te demande d'abord de confirmer que tu peux les redistribuer.

### Restaurer des réglages antérieurs

Ouvre **More** dans la barre, choisis **Restore brand settings**, sélectionne un point de contrôle daté et appuie sur **Restore**. Cela restaure les couleurs, les réglages typographiques et les autres tokens de la marque active ; les fichiers de polices et d'images restent tels quels. Lolly enregistre d'abord tes réglages actuels sous **Before restore**, pour que tu puisses annuler une restauration même après avoir fermé le navigateur. Les 20 derniers points de contrôle sont conservés sur cet appareil. Une modification faite pendant que le studio affiche **Saving…** survit à un rechargement, et une carte propose de restaurer les changements dont l'enregistrement ne s'est pas terminé.

### Versions

Une version publiée est une **copie permanente et nommée** conservée sur cet appareil. Elle ne change jamais, donc un outil ou un lien qui la fixe (avec `designv`) continue de dessiner la même chose. Un système qui contient un élément à toi liste **Versions & publishing** dans le menu **More** de la barre ; après ta première publication, **Versions** rejoint les espaces. `#/start?area=versions` ouvre Versions.

::: warning Une version publiée est permanente
Il n'y a pas encore de suppression, et le panneau le dit. Une publication ne peut pas être annulée ; une restauration peut l'être. *Restore latest from this version* est une modification ordinaire, avec **Undo** proposé aussitôt.
:::

**Les suppressions viennent en premier dans la carte de compatibilité**, car un token supprimé empêche un outil de fonctionner.

**Publish only** conserve une version sans changer ce que les outils suivent ; **Publish and make active** fait suivre cette version aux outils et à l'application. **Follow the latest again** applique chaque modification aussitôt.

### Publier une page de marque

Une [page de marque](/info/brand-page.html) est une adresse unique pour les personnes et les agents : une page de logos, de couleurs, de typographie et d'exemples, avec les mêmes faits dans des fichiers à côté. **Publish a brand page**, sous Versions & publishing, montre la page en direct et, à côté de la page :

- **Goes public** : chaque fichier, regroupé, avec sa taille.
- **Held back** : ce qui a été écarté, et pourquoi. Un logo sans licence enregistrée reste écarté tant que tu ne coches pas le nom du logo. Un fichier de police a besoin d'une licence enregistrée qui autorise sa transmission, et la page montre un spécimen converti en contours quand le fichier reste écarté. Les compétences de marque internes n'apparaissent jamais.
- **What was checked** : les paires de couleurs par colourway et par mode, et les règles internes. Ce sont des mesures, pas un verdict.
- **In your words** : une déclaration d'usage et un contact. La page affiche ce que tu écris et Lolly n'ajoute aucune licence ni déclaration juridique. Une bascule désactive la ligne « Made with Lolly » en pied de page.
- **On exports** : une bascule qui [enregistre l'adresse de la page dans les exports de ce design system](/info/brand-page.html#lead-back-from-your-files). La bascule est désactivée tant que tu ne l'actives pas, nécessite une adresse `https` et ne voyage pas avec un pack ou une copie. Un design system verrouillé n'affiche pas la bascule, car son gestionnaire décide.

**Download folder** enregistre le dossier comme ZIP pour que tu l'héberges où tu veux. Rien ne devient public tant que tu n'héberges pas le dossier. Dans un terminal, `lolly system publish --out=<dir>` écrit le même dossier. Une instance qui sert des pages de marque propose aussi **Publish to** son adresse : un appui explicite, par la chaîne d'approbation de l'instance quand elle en a une. Un design system géré ne se publie que si son gestionnaire l'autorise.

### Connecter un agent

**Connect an agent**, au même endroit, te donne du texte à coller et indique ce que chaque option peut faire :

- **`AGENTS.md`** dans un projet : les agents lisent les noms et les règles du système. Il ne dessine rien et n'a pas besoin de serveur.
- **Lolly's public server** : dessine avec Lolly Demo, quel que soit le système ouvert ici. Il n'a pas besoin de clé.
- **Your instance** : dessine avec les systèmes que l'instance contient, et lit un jeton de service depuis une variable d'environnement. Le panneau donne le nom de la variable et n'affiche jamais de jeton.

Quand aucun serveur hébergé ne dessine avec ton système, le panneau le dit.

<!--i:eti-layers-->
## Gérer tes design systems

Ouvre **Settings → Preferences → Design systems** pour changer de système, en ajouter ou en supprimer. **Open** sélectionne un système et l'ouvre ici ; **Make a new one** crée un système local et l'ouvre avec son champ de nom prêt. Un seul système est actif à la fois, pour tout l'appareil. [Architectures de marque](/info/brand-architectures.html) aide à décider quand une marque a besoin de son propre design system.

**D'où vient un système.** Le système fourni par le catalogue d'un déploiement affiche **Came with this app**, ou **From this instance** dans une application connectée à une instance. Déplie **Catalogue source** pour voir qui le fournit, sa ressource de tokens, son espace de noms et sa version ou sa somme de contrôle connue ; si une actualisation échoue, les éléments en cache sont signalés.

**Les systèmes gérés sont en lecture seule.** Un système affiche **Managed by this instance** (ou **Managed by this app** dans l'application de bureau sans instance) quand son catalogue verrouille le système. Tu peux utiliser et télécharger un système géré. En ouvrir un ici affiche une note de lecture seule avec **Make an editable copy** et **Switch**, puis ses rôles de couleur et ses tokens sans contrôles de modification. Tes propres systèmes locaux restent modifiables, même quand le système géré était là en premier. Une version avec une seule marque fixe ouvre Lolly Design System Setup sur *This brand is set*, avec les tokens de la marque et ses règles d'usage à lire.

**Tout autre système fourni est à toi** : tu peux le masquer, le modifier et le réinitialiser, y compris Lolly Demo et Lolly Starter sur lolly.tools. En modifier un conserve son nom et marque la ligne **Edited here**. **Reset to original** dans son menu abandonne les changements faits sur cet appareil. Le système de départ vierge est l'exception : une première modification y crée ton propre design system, et Lolly te demande son nom une seule fois. [Lolly Demo en pratique](/info/lolly-demo-in-use.html#switch-to-your-own) montre ce que ton propre système remplace.

### Supprimer un design system

Choisis **Remove** dans le menu d'un système ; la confirmation indique quel système sera actif ensuite. Les sessions enregistrées, les fichiers téléversés et les éléments partagés avec un autre système restent.

Supprimer un système fourni ne fait que le masquer : ses ressources de catalogue restent, **Bring back** le montre de nouveau et il revient de lui-même si tu supprimes tout le reste. Supprimer une copie importée ou modifiée ne supprime pas le système fourni, ses logos ni ses polices. Si la copie était active, le système fourni redevient actif. Supprimer une copie hébergée active efface uniquement la connexion de cette copie ; une instance choisie séparément reste sélectionnée.

::: details Modifier un design system fourni par un serveur
Modifier ce qu'un serveur fournit est une tâche d'administration : son opérateur modifie le catalogue source et redéploie, ou un administrateur Lolly Work examine et applique un changement du serveur. Les modifications faites ici restent locales, à une exception près. Sur une instance Lolly Work qui t'accorde `brand.edit`, un système géré propose aussi **Edit for** cette instance, ce qui ouvre une copie modifiable. **Send to** cette instance dans **Versions** lui renvoie ses couleurs, ses colourways, ses rôles de couleur et l'adresse de sa page de marque. [Modifier cette instance depuis le studio](/info/work-design-system-administration.html#edit-this-instance-from-the-studio) explique ce qu'une modification peut changer et comment l'instance la diffuse. Voir [Supprimer un design system du catalogue](/info/configuration.html#removing-a-catalogue-design-system) et [Configuration](/info/configuration.html#supplied-and-local-design-systems).
:::

<!--i:eti-code-->
## Utiliser le contexte de design hors de l'application

**Download design context** enregistre le document de tokens, les couleurs résolues, les familles de polices déclarées, les identifiants de ressources, les éléments de preuve de la source lorsqu'ils sont enregistrés, la couverture et les règles explicites, sans fichiers de polices ni preuve de propriété. La ligne de commande lit le fichier sans serveur : `lolly system import` en fait le design system du terminal et `lolly system check` vérifie les entrées de Lolly Design par rapport au contexte enregistré. [Apporter ton design system](/info/cli.html#bring-your-design-system) couvre l'import et [Quel design system une commande utilise](/info/cli-decks.html#which-design-system-a-command-uses) couvre la vérification. Un client MCP lit le même brief depuis `lolly://design-context` ([Serveur MCP](/info/mcp.html)).

<!--i:eti-map-pin-->
## Où aller ensuite

- **[Utiliser Lolly](/info/using.html)** : les outils, l'enregistrement, le partage et Assets.
- **[Architectures de marque](/info/brand-architectures.html)** : comment les divisions, les produits, les marques cautionnées, les clients et les saisons se répartissent entre design systems, colourways et identités de logo.
- **[Travailler avec des partenaires](/info/partners.html)** : partager ta marque avec un partenaire et travailler avec une marque qu'on t'a fournie.
- **[Pages de marque](/info/brand-page.html)** : publier ton design system à une adresse unique, comme kit de presse et kit pour agents.
- **[Design Tokens](/info/design-tokens.html)** : le modèle de tokens dans lequel ta marque est écrite.
- **[Exporter un fichier](/info/exporting.html)** : les unités d'impression, CMYK et les formats dans lesquels ta marque est rendue.
