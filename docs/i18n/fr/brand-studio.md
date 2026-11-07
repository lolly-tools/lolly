# Lolly Design System Setup

<a id="design-system-setup"></a>

Ton logo, tes couleurs et tes polices ont leur place à un seul endroit, pour que chaque outil, chaque page et chaque export les utilise. Cet endroit, c'est **Lolly Design System Setup**, à `#/start`.

Pars de ce que tu as. Dépose un logo et Lolly lit ses couleurs. Choisis une police, ou dépose le fichier de police dont ton entreprise détient la licence. Chaque changement se voit aussitôt dans toute l'application. Ton logo, tes polices et tes tokens restent sur cet appareil. Choisir une Google Font est la seule étape qui sort de l'appareil : Lolly demande d'abord, puis récupère la famille une fois.

Quand le résultat te convient, donne un nom au design system et appuie sur **Export**. Tu obtiens un fichier `.lolly` à garder, à ouvrir sur un autre appareil ou à confier à un collègue. [Lolly Settings](/info/dashboard.html#design-system) montre le système actif en lecture seule, et sa couverture renvoie ici pour le modifier.

## Fais-le tien en cinq minutes

::: timeline
- <!--i:upload--> **Dépose ton logo** sur la zone de dépôt dans **Logos**. Lolly lit sa forme et ses couleurs.
- <!--i:palette--> **Utilise ces couleurs.** La couleur principale du logo devient ton primaire, et un neutre foncé du logo devient ta couleur de texte.
- <!--i:font--> **Choisis une police** dans **Type** : une Google Font, ou un fichier de police que tu possèdes.
- <!--i:pentool--> **Nomme le système.** Ta première modification crée un design system à toi, et Lolly en demande le nom une seule fois.
- <!--i:download--> **Export** écrit tout le système dans un seul fichier `LollyBrand-….lolly`.
:::

La barre en haut du studio porte le nom du design system, et ce nom est un champ que tu peux changer à tout moment : **Enter** garde un nouveau nom et **Escape** remet l'ancien. Quand ta première modification demande **What is this design system called?**, les mots de ton logo sont préremplis si le logo les épelle. **Save name** garde le nom ; **Not now** garde un nom provisoire jusqu'à ce que tu en saisisses un dans la barre. Le nom étiquette le système dans Settings et quand tu changes, et il devient le nom du fichier qu'**Export** écrit.

## Les salles

Le studio est un ensemble de pièces sans ordre fixe : rien n'est numéroté et rien n'attend autre chose. Sur un bureau, les pièces se rangent en une bande sous la barre. Sur un téléphone, elles passent dans une barre au bord inférieur, là où le pouce les atteint, avec la pièce ouverte amenée dans la vue ; la feuille de la palette et le plateau s'élèvent au-dessus de cette barre, et la barre s'efface pendant que tu saisis. Au clavier, Tab atteint la bande une seule fois, et les flèches, Début et Fin passent d'une pièce à l'autre.

![La barre du studio et ses pièces : Board, Colours, Type, Logos, Tokens, Files, Rules et Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Pièce | Ce que tu y fais | Clé de lien |
|---|---|---|
| **Board** | Voir ce que contient le système, avec une porte vers chaque pièce | `overview` |
| **Colours** | Ajouter des couleurs, leur donner des rôles, créer des nuances et une palette | `color` |
| **Type** | Choisir les quatre polices que lisent l'application, les outils et chaque export | `type` |
| **Logos** | Placer tes marques dans chaque orientation et chaque traitement | `logos` |
| **Tokens** | Angles, espacements, ombres et toute autre valeur nommée | `tokens` |
| **Files** | Les images, fichiers audio et animations que ta marque conserve | `catalogue` |
| **Rules** | Les règles que ta marque applique, vérifiées sur des exemples réels | `usage` |
| **Skills** | Les standards écrits de la marque, pour les personnes et les agents, à lire et à télécharger | `skills` |

Renvoie vers une pièce avec `#/start?area=<key>`. La pièce Files garde la clé `catalogue`, Board garde `overview` et Rules garde `usage`, car une clé de pièce est un contrat permanent, et `?tab=` fonctionne toujours comme ancien alias. Une clé inconnue ouvre Board.

La **barre** contient les actions pour tout le système plutôt que pour une pièce. **Add from…** fait entrer une marque ([Bring a brand in](#bring-a-brand-in)), et le **Tray** contient ce qu'une analyse a trouvé et que tu n'as pas encore ajouté. **Export** écrit le système en un seul fichier, et **More** contient **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions & publishing**, **Restore brand settings** et **Design systems**, qui ouvre la liste dans Settings où tu changes de système ([Keep and move your design system](#keep-and-move-your-design-system)). Chacune n'apparaît que lorsqu'il y a quelque chose sur quoi elle peut agir. Sur un téléphone, **Add from…** passe dans **More** et **Export** s'affiche comme son icône.

## Board

Tant que rien n'est choisi, Board propose quatre façons de commencer. **Start from a reference** ouvre le sélecteur de source pour un logo, une capture d'écran, une page web ou un fichier de design, et **Pick a colour**, **Choose a face** et **Add a logo** ouvrent directement ces contrôles. En ouvrir un n'écrit rien, et **Explore the tools** est là dès le départ.

Dès que quelque chose t'appartient, Board montre ce que tu as, avec tes propres totaux en premier. Colours donne le nombre de couleurs, avec un `· N starter` atténué là où des couleurs héritées s'affichent ; sa bande place d'abord tes couleurs, puis un filet, puis les couleurs de départ estompées. Colourways montre chaque colourway comme une petite tuile dans sa couleur dominante. Type se lit par rôle et compose chaque famille dans sa propre police (*Inter for headings*, avec *Starter for the rest* sur la ligne en dessous). Logos indique combien d'emplacements sont remplis (ou **Not set**), Tokens montre le rayon des angles et Files dit **Nothing yet** tant que la bibliothèque est vide. Chaque bloc ouvre sa pièce.

Un design system livré avec l'application et modifiable, comme Lolly Demo, a tout cela dès le départ : Board montre ses couleurs, colourways, polices et marques, avec une étiquette **Came with this app** à côté du titre.

### Starter et à toi

**Starter** désigne tout ce qui est venu avec l'application au lieu d'avoir été choisi. Une installation neuve ne porte aucune couleur, seulement une rampe de neutres de l'encre au papier, pour que surfaces, texte et filets puissent s'afficher avant que quiconque ne décide quoi que ce soit. Le même mot marque le matériel hérité dans chaque pièce.

::: cols
## Starter

- Venu avec l'application : les neutres de l'encre au papier, les polices de départ, le rayon d'angle par défaut.
- Atténué, avec une étiquette **Starter** et sans teinte.
- Non compté parmi tes couleurs. Les neutres vivent dans **Tokens** sous **Neutrals · starter · 9**, et **Open** les montre dans Colours comme un seul groupe replié (`#/start?area=color&group=neutral`).
- Un rôle qui s'appuie sur une couleur de départ affiche *"Starter Paper stands in"*, avec **Choose…** sur son sélecteur.

## À toi

- Choisi ou installé par toi.
- À pleine intensité, et une carte teintée là où tu as installé une police.
- Compté dans Board et dans Tokens.
- Un rôle qui en suit un autre affiche **↳ follows Primary** plutôt que de répéter le nom du primaire.
:::

Le matériel hérité n'est jamais dessiné avec une bordure en tirets, car ici une bordure en tirets désigne une cible de dépôt.

## Logos

Vide ton dossier de marques dans la zone de dépôt en haut : **"Drop marks here, or choose several at once"** accepte autant de fichiers que tu en as. Chaque fichier est lu pour sa forme et son encre, puis attend sous **Waiting for a slot** sous forme de pastille qui dit à quoi il ressemble, comme *"Looks like the Horizontal primary"*, avec la mesure utilisée et un bouton **Place** (**Replace** là où l'emplacement est rempli). Quand elle hésite, la pastille le dit et propose **Change slot**, qui liste les huit. Rien n'est placé tant que tu n'appuies sur rien.

Une marque avec un excédent de marge vide reçoit d'abord une proposition de rognage ; réponds-y ou appuie sur Échap et l'original est mis tel quel. Là où une marque peut remplir un emplacement voisin vide, la pièce propose la version dérivée **mono** ou **reverse** sous forme de pastille marquée *Generated*.

Chaque marque finit dans une grille de huit emplacements facultatifs, un par **orientation** et **traitement** :

- **Orientations :** Horizontal (logotype et symbole sur une ligne) et Vertical (empilés, pour les espaces carrés et hauts).
- **Traitements :** Primary, Primary reverse (pour les fonds sombres), Mono (une couleur) et Mono reverse.

Un groupe sans marque se replie sur une seule ligne ; ouvre-le pour voir ses emplacements. Clique sur un emplacement pour ajouter un PNG, SVG, JPEG ou WebP, ou clique sur un emplacement rempli pour remplacer la marque. Tout reste sur cet appareil.

![Les emplacements de logo avec Horizontal et Vertical ouverts : chaque traitement est un emplacement à part, et chaque emplacement est facultatif](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&system=new-design-system&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails.be-logo-group--fold%3Anot%28.be-logo-group--custom%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** sont les marques que ta marque appelle par son propre nom, comme une icône, un blason ou un favicon.
- **Plus d'identités.** Une sous-marque, un produit ou un événement peut avoir son propre jeu complet : **+ Add another logo** et donne un nom au jeu. Ton jeu principal est « Your logo ». [Brand architectures](/info/brand-architectures.html) montre quand une identité de logo est le bon bloc.
- **Lolly lit les couleurs du logo.** Une carte sous la zone de dépôt, et de nouveau en haut de Colours, liste les couleurs du logo et demande **Which is the main colour?**, la couleur la plus forte étant déjà sélectionnée (jamais le blanc sur lequel il a été exporté). **Use these colours** les ajoute à ta palette, fait de la couleur principale ton primaire et, quand le logo a un neutre foncé lisible sur papier, en fait la couleur du texte. **Not now** les laisse dans le Tray. Sur une installation toute neuve, la réponse la plus probable est appliquée tout de suite, et la carte propose **Undo** ou une autre couleur principale. Un SVG donne des couleurs exactes ; un PNG, JPEG ou WebP donne les couleurs qui couvrent une part réelle de la marque.

## Colours

La pièce grandit avec le design system : une première visite est une seule décision, et le reste arrive avec la palette.

### La première couleur

Un système sans couleur propre affiche les neutres de départ, ouverts dans leur propre groupe, et en haut de la pièce un champ de collage et de dépôt en pointillés : une grande pastille et un champ. Dépose une image ou une liste de couleurs n'importe où sur le champ, et Lolly lit les couleurs de ce que tu as déposé.

- **La pastille est le sélecteur.** Appuie sur **Pick a colour** et la carte OKLCH du studio s'ouvre, préremplie avec ce que contient le champ : le nom et l'hexadécimal de la couleur d'abord, avec les espaces colorimétriques, la roue, les quatre cadrans et l'alpha sous **Fine-tune**, et **Cancel** et **Add colour** en bas. Rien n'arrive dans le système avant que tu appuies sur **Add colour**.
- **Le champ accepte toute notation** : `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` ou un nom de couleur. Colle une liste et elle devient une rangée de pastilles à ajouter une à une ou avec **Add all**.
- **Deux autres façons d'entrer.** **Pick a colour from the screen** utilise la pipette là où le navigateur en a une, et **Take colours from an image** lit une capture d'écran ou une photo sur cet appareil.
- **Add n'est jamais désactivé.** Avec un champ vide, il ouvre le sélecteur ; un texte qu'il ne sait pas lire reçoit une ligne sous le champ qui le dit.

Ta première couleur devient le **primaire**, et une pastille le confirme, comme *"Primary is now Vivid Violet"*, avec **Fine-tune** pour ajuster la couleur.


### À mesure que la palette grandit

Tes couleurs se placent à côté d'un aperçu **In context** sur un grand écran, et au-dessus sur un plus petit. L'aperçu montre une affiche, un graphique ou une carte d'interface dans ta palette. Les couleurs de départ restent dans leur propre groupe repliable, qui se replie dès que le système a des couleurs propres, et le champ de collage et de dépôt devient une seule rangée compacte. L'export se trouve dans **Export** de la barre et dans la pièce Tokens, donc l'en-tête de la pièce n'en porte aucun.

![La pièce Colours sur Lolly Demo : la palette en groupes repliables, chaque couleur avec son nom et son hexadécimal, et le téléchargement de la palette dans l'en-tête](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![La pièce Colours sur Lolly Demo après l'ajout d'une couleur : le tableau Colour roles, puis la pastille de la nouvelle couleur qui propose Use as Lead? et Fine-tune, à côté d'un aperçu de composition en direct](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Colour roles : comment s'appellent les couleurs

Le design system dit comment s'appellent ses couleurs et à quoi sert chacune, et Lolly le lit. **Colour roles** se trouve en tête de la pièce Colours. Sur un grand écran, **In context** partage la vue, donc un changement apparaît sur l'affiche, le graphique et la carte d'interface au fur et à mesure.

![Le tableau Colour roles sur Wefthouse, une marque textile inventée, dans ses propres mots : les pastilles de colourway Indigo, Madder et Weld, puis Main, Accent, Supporting et Tertiary, chacun avec sa couleur claire et sombre, lus comme la couleur dominante, la couleur partenaire et par le nom seulement, et Background, Text, Quiet text et Hairlines listés sous le tableau comme les lectures qu'aucun rôle ne remplit](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=wefthouse&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

Le tableau a quatre colonnes, et sur un téléphone chaque ligne devient une carte qui garde le clair et le sombre côte à côte :

| Colonne | Ce qu'elle contient |
|---|---|
| **Role** | Le mot propre au design system, que tu peux modifier sur place, et une ligne disant à quoi sert la couleur |
| **Light** et **Dark** | La couleur dans cette apparence pour le colourway choisi, avec son nom ou sa valeur, et son contraste |
| **Lolly reads this as** | Ce qu'un outil fait du rôle, dans les mots de Lolly |

**Comment Lolly lit un rôle.** Chaque lecture prend un seul rôle : choisir une lecture qu'un autre rôle détient la déplace ici. Lolly ne tire jamais un sens d'un mot.

| Lecture | Ce qui en découle |
|---|---|
| **Lead colour** | Les grandes formes, les boutons, la couleur avec laquelle un outil mène |
| **Partner colour** | La deuxième couleur qu'un outil prend |
| **Background** | Se place derrière tout le reste |
| **Text** | Titres et corps de texte |
| **Quiet text** | Légendes et petits caractères |
| **Hairlines** | Filets, bordures et séparateurs |
| **By name only** | Aucun outil ne choisit le rôle de lui-même. Il est proposé dans chaque champ de couleur et dans Design, où un choix reste lié, donc il suit le colourway |

Une lecture qu'aucun rôle ne remplit reste telle que le design system la définit, et la pièce les liste sous le tableau. Un rôle qui partage l'identifiant d'une lecture, comme un rôle appelé Primary, est cette lecture et ne peut pas être déplacé.

**Dans un graphique.** La palette **Design system - colour roles first** de Lolly Chart donne aux séries les rôles de couleur du design system dans son propre ordre, puis le reste de sa palette. Un rôle lu comme arrière-plan, texte, texte discret ou filets est écarté, car le graphique dessine son fond et ses mots avec ces couleurs. Rien ne change tant que tu ne choisis pas cette palette, et un design system sans rôles de couleur dessine la palette comme **Design system - ordered**.

**Valeurs.** Appuie sur une valeur pour choisir une couleur pour ce rôle, dans cette apparence, dans le colourway choisi. **Same as light** fait suivre la valeur sombre par la valeur claire jusqu'à ce que tu choisisses une couleur propre. La pastille **Aa** montre le texte que Lolly choisit pour se placer sur la couleur, et la ligne sous la valeur dit comment ce texte se lit, pour chaque apparence : **Text reads well**, **Large text only** ou **Hard to read as text**. Cela concerne le texte sur la couleur et ne dit rien contre la couleur elle-même, qui peut encore convenir pour des formes et de grandes surfaces. Un rôle lu par son nom seulement affiche les mêmes mots sans la couleur d'alerte, car aucun outil n'y place de texte de lui-même. Les chiffres derrière les mots, APCA d'abord et WCAG ensuite, se trouvent dans l'infobulle et dans le sélecteur. **Own text colour** marque une valeur dont le fichier indique la couleur du texte, qui est conservée. **Copied** marque une valeur venue d'un autre colourway ou de la couleur partenaire et que personne n'a encore choisie ; **Keep this colour** dans le sélecteur fixe la valeur.

**Points de départ.** Un design system sans rôles propres affiche les mots d'aujourd'hui : Primary, Secondary, Surface et Text. Rien n'est écrit tant que tu n'en changes pas un. **+ Add a role** propose **Primary, Secondary** ou **Main, Accent, Supporting, Tertiary** comme suggestions, ou n'importe quels mots que tu tapes, avec la lecture que chacun recevrait. Les deux premiers mots deviennent la couleur dominante et la couleur partenaire. Les outils continuent de dessiner les mêmes couleurs, et sur un système avec une seule couleur dominante, le premier colourway porte le nom de cette couleur.

**Renommer, réordonner, supprimer.** Un renommage ne change que le mot, donc tout ce qui utilise le rôle continue de fonctionner. Fais glisser un rôle par sa poignée, ou appuie sur Espace sur la poignée, utilise les flèches et appuie sur Espace pour déposer. **Remove** dit ce qui utilise encore le rôle. Quand des outils le lisent, **Remove and keep those colours** laisse chaque lecture avec la couleur qu'elle dessine maintenant. Une règle maison, un groupe de guides, un champ d'outil ou un autre token qui utilise le rôle le retient jusqu'à ce que cet usage change. Un document Design enregistré peut aussi utiliser un rôle par son nom, et Lolly ne peut pas le voir depuis le fichier de tokens : un document qui le fait signale la couleur comme non résolue.

**Un fichier écrit à la main.** Les couleurs qu'un fichier de tokens contient et qu'aucun rôle ne déclare sont listées sous **In this file, with no role yet**, chacune avec un champ pour un mot et **Make a role**. Elles continuent de fonctionner par leur nom dans les deux cas. Un token dont le nom contient des chiffres ne peut pas être un rôle, donc il reste dans le fichier et continue de fonctionner par son chemin. Un enregistrement du fichier qui ne passe pas la validation montre le tableau sans commandes et dit pourquoi.

**Le reste de la pièce parle avec les mêmes mots.** Les pastilles, la rangée **Use as** du nuancier et le groupe **Colour roles** de la palette emploient tous les mots du design system, et la tuile d'un rôle de couleur ouvre sa valeur. Les fichiers exportés n'enregistrent rien de nouveau sur les rôles : les couleurs d'un rendu changent parce que les tokens ont changé.

**Où vont les mots.** Les mots et les descriptions voyagent avec le design system. Les agents les lisent dans le brief de design, `lolly://tokens` et le `AGENTS.md` d'une page de marque, le terminal les montre dans `lolly system status`, et une page de marque les liste dans `brand.json` et mesure une paire de contraste pour chaque rôle. Chaque format d'export garde ce qu'il a la place de contenir : les fichiers DTCG et Tokens Studio gardent tout, `DESIGN.md` garde les mots et les lectures, et un thème PowerPoint ne garde que l'ordre de la marque. [Colour roles in other formats](/info/design-tokens.html#colour-roles-in-other-formats) donne la liste complète. Les mots sont toujours cités comme des données du design system, jamais lus comme des instructions.

**Où une couleur se choisit.** Chaque champ de couleur dans un outil et dans Lolly Design commence par les rôles du design system, dans son propre ordre, avec chaque mot et à quoi sert la couleur bien en vue. **Aa** à côté d'un rôle choisit la couleur qui se place sur ce rôle. Le reste suit sous **Other colours**, sans les copies propres d'un colourway, les couleurs « sur » et toute lecture qu'un rôle remplit déjà. Un choix reste lié au rôle et suit le colourway, le champ continue d'afficher le mot quel que soit le colourway choisi, et Settings et Tokens emploient le mot aussi. Un design system sans rôles garde la grille de nuances qu'il a toujours eue.

### Chaque couleur qu'un outil lit

Avec **Colour roles** fermé, les premières décisions mènent la pièce sous forme de pastilles, chacune montrant la couleur qui joue le rôle et son nom. Sur un système sans mots propres, ce sont **Primary**, **Secondary**, **Surface** et **Text**. Appuie sur une pastille pour choisir sa couleur parmi les nuances de la palette. **Every colour a tool reads**, au bas de **Colour roles**, contient la bande complète.

La bande montre les sept couleurs qu'un outil peut lire : Primary, Secondary, Surface, Text, Muted, Edge et On primary, dans les mots propres du design system quand il en a. Chacune joue le même rôle dans chaque outil et chaque export. Aucune n'a besoin d'être définie (trois couleurs libres font un système valable), n'importe quelle couleur peut en occuper une, et l'affichage dit comment le texte se lit, mesuré contre la surface, APCA d'abord. Chaque ligne montre une couleur propre à pleine intensité, une couleur de départ qui la remplace, ou **↳ follows Primary**.

On primary est dérivé du primaire, affiche **Derived** et n'a pas de sélecteur. Le commutateur **Light** et **Dark** à côté, et celui à côté de **In context**, choisissent l'apparence que montrent la bande, la palette et l'aperçu.

L'accent propre de l'application suit le design system par défaut. C'est le réglage **Interface follows the design system** dans **Settings → Appearance** ; le désactiver laisse l'habillage de l'application neutre, tandis que les outils, canevas et exports suivent le design system dans les deux cas.

**Colourways.** Un design system peut contenir plusieurs couleurs dominantes, chacune choisie par pièce. La ligne **Colourways** en tête de **Colour roles** montre une pastille par colourway, avec **Default** sur le colourway canonique. **+ Add** démarre un nouveau colourway à partir d'une des couleurs de la palette. Choisis une pastille, et le tableau, la bande, la palette et les aperçus montrent ce colourway ; le colourway choisi peut être renommé, dupliqué, défini comme défaut ou supprimé. Sur un système avec des colourways, chaque colourway a besoin de son propre primaire et secondaire, et de sa propre surface quand les colourways teintent le fond, donc ces rôles restent définis dans l'éditeur de nuancier. [Add colourways to a design system](/info/colourways.html#add-colourways-to-a-design-system) donne les étapes et le format de tokens, et [Lolly Demo in use](/info/lolly-demo-in-use.html#colourways-on-real-work) montre les colourways sur du vrai travail.

### Trouver d'autres couleurs

Trois outils s'appuient sur ton primaire. Les deux premiers ne font que suggérer, et le troisième remplace la palette après que tu as relu le changement.

::: cols
## Explore shades & harmonies

Choisis une **Starting colour**, un **Scheme** (Mono, Complement, Analogous ou Triad) et le nombre de **Shades** (de 3 à 20, 5 par défaut). **Fine-tune** règle l'intensité de l'interface, le contraste et le texte sur la marque. Clique sur une nuance pour l'ajouter, ou **Add 5 shades** pour un groupe. Tes couleurs et tes rôles restent.

## Find matching colours

Choisis une **Harmony** : Complementary, Adjacent, Triad, Tetrad ou Analogous (avec des **Accents** de 2 à 5 et un **Angle** de 10° à 45°). Chaque candidate a un nom généré et **+ Add**, un appui par couleur.

## Rebuild the whole palette

Remplace la palette à partir d'une couleur de départ, après une relecture de ce qui change et de ce qui reste. Un point de contrôle est pris d'abord, et **Undo** est proposé ensuite.
:::

Les trois utilisent les mêmes calculs perceptifs de couleur (OKLCH) que le moteur. Dans **Explore shades & harmonies**, les lignes **Primary**, **Neutral** et **Secondary** montrent les nuances suggérées, et **Theme preview** montre des exemples clairs et sombres avec leurs mesures de contraste.

![Trois groupes de nuances suggérés, avec des contrôles d'ajout individuels et un Theme preview séparé](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Accents générés, chacun avec un échantillon, un nom généré automatiquement, son code hexadécimal et un bouton Ajouter](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Valider une palette générée

Ouvre **Rebuild the whole palette…** et appuie sur **Preview full rebuild**. La relecture compte combien de rôles restent tels que tu les as attribués, combien de tes propres couleurs sont conservées et combien de courbes de nuances, de verrous d'impression, de nuances masquées et de points de dégradé sont ré-ancrés ou conservés. **Apply rebuilt palette** valide ; **Cancel** ne change rien. Ensuite, la carte propose **Undo** avec le focus dessus, et le point de contrôle pris avant l'échange restaure tout le système.

Un système avec des colourways garde chaque colourway lors d'une reconstruction. Le colourway canonique suit la nouvelle couleur de départ, et chaque autre colourway garde ses propres couleurs, son nom, son ordre et ses réglages. La relecture liste quel colourway suit et lesquels gardent leurs couleurs. Lolly ne reconstruit pas un système qui encode ses colourways d'une manière qu'il ne peut pas modifier ; la carte dit pourquoi, et rien ne change.

### Les sections avancées

Quatre sections repliées se trouvent sous l'aperçu et les rôles. Chacune s'ouvre directement avec `#/start?area=color&focus=<name>` :

- **Explore shades & harmonies** (`focus=generate`), décrit plus haut.
- **Shade curves** (`focus=curves`) remodèlent une rampe point par point, avec des courbes séparées de luminosité, de chroma et de teinte (L / C / H) et les nuances se redessinent pendant que tu fais glisser.
- **Contrast** (`focus=contrast`) : **Contrast-lock** retone une rampe pour atteindre des cibles APCA sur un fond que tu choisis, et **Rotate hue** fait tourner toute la rampe autour de la roue.
- **Print** (`focus=print`) définit ce que devient le primaire sur presse : sa valeur automatique, une composition CMJN épinglée ou une encre d'accompagnement nommée.

### La palette et chaque nuancier

La palette liste tes couleurs en groupes repliables, chacun avec son propre **+ Add**. Crée et renomme les groupes comme tu veux. Un rôle ne crée jamais une deuxième tuile : une tuile vers laquelle pointe un rôle porte le nom du rôle à la place, comme **Primary**. **Colour chart** sous les tuiles montre les mêmes couleurs sur la **Wheel** OKLCH (fais glisser un point pour recolorer, clique dans l'espace vide pour ajouter une nuance) et le graphique **Gamut**, qui montre où s'arrête la plage affichable. `#/start?area=color&focus=chart` ouvre directement le graphique.

![Le panneau de palette, chaque groupe repliable, avec le téléchargement de la palette dans son en-tête](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![La roue OKLCH - l'angle est la teinte, la distance vers l'extérieur est la chroma et les gris suivent un rail de luminosité sur le côté](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Clique sur un échantillon pour ouvrir son éditeur :

- **Rename** la nuance.
- **Set the colour** avec les curseurs OKLCH, ou en **Hex**, **HSL**, **RGB** ou **CMYK**. Le champ de valeur lit et écrit dans l'espace actif. Ici, CMYK règle la couleur d'écran par conversion ; pour fixer des encres exactes, utilise **Print substitutes**.
- **Stored as** choisit comment la nuance est enregistrée : **LCH** (par défaut, perceptuel et à large gamut), Hex, RGB ou HSL.
- **Use as** donne directement un rôle à la nuance, dans les mots propres du design system quand il en a. Appuie de nouveau sur un rôle en surbrillance pour l'effacer.
- **Print substitutes** (replié) : verrouille **CMYK** depuis **Auto** vers des valeurs d'encre exactes, ou définis une **Spot colour** avec un **Name** (comme `PANTONE 186 C`), un **Book** facultatif et une **Finish** pour dorure, gaufrage, débossage, vernis sélectif, soft touch ou une découpe, un pli ou une perforation. Une presse utilise ces verrous quand tu exportes un PDF ou un TIFF CMYK ; voir [Colour profiles](/info/exporting.html#colour-profiles).
- **In other spaces** (replié) : une valeur par espace colorimétrique, dérivée ou écrite par toi, et une valeur écrite l'emporte à l'export.

**Supprimer un échantillon** est sans risque. Les nuances dérivées et les rôles de thème sont masqués, donc rien de ce qui les lit ne casse, tandis que les couleurs que tu as ajoutées sont supprimées.

::: details Travailler avec beaucoup d'échantillons
Chaque échantillon a une poignée de glissement. Fais glisser pour réordonner au sein d'un groupe, ou mets la poignée au focus, appuie sur Espace, utilise les flèches et appuie de nouveau sur Espace pour déposer ; Échap annule. Sur un téléphone, la palette montre quatre couleurs par ligne et les poignées apparaissent en mode Select, plutôt qu'en une ligne sous chaque couleur. Pour déplacer des couleurs entre groupes, utilise le contrôle **Group** de l'éditeur ou sélectionnes-en plusieurs et utilise **Move to**.

La sélection n'a pas besoin d'interrupteur séparé. La barre et les cases à cocher apparaissent avec la première tuile sélectionnée et disparaissent avec la dernière.

- **Fais glisser sur un espace vide** pour tracer un rectangle ; chaque tuile qu'il touche rejoint la sélection, à travers les groupes. Une section repliée n'ajoute rien.
- **Maj-clic** prend une plage dans l'ordre de lecture, **Cmd/Ctrl-clic** bascule une tuile, et un simple clic ouvre l'éditeur.
- Chaque en-tête de groupe a **Select all**, et **Cmd-A** avec une tuile au focus prend chaque couleur qui t'appartient, jamais une couleur de départ.
- La grille a un seul arrêt de tabulation : les flèches déplacent, Maj-flèches étendent, Espace bascule, Suppr supprime et Échap efface. Pour ajuster un canal, appuie d'abord sur `l`, `c` ou `h`.
- Sur un écran tactile, appuie longuement sur une tuile pour démarrer une sélection, puis touche pour ajouter.

La barre affiche **{n} selected**, puis **Move to**, **Give a role** (chaque couleur prend le rôle suivant à tour de rôle), **Download** (la sélection dans l'un des six formats de palette), **Duplicate** (une copie de chacune, placée après l'original), **Copy values** et **Delete**. Une copie s'ouvre directement dans l'éditeur ; plusieurs restent sélectionnées. Un seul Cmd/Ctrl-Z annule toute une action groupée.
:::

### Dégradés

Le panneau facultatif **Gradients** construit des tokens de dégradé à partir de la palette. Chaque dégradé a un aperçu, de 2 à 8 points nommés et un angle. Un point renvoie à un échantillon, donc recolore l'échantillon et le dégradé suit. Les dégradés se calculent en OKLCH.

Les téléchargements de la palette (design tokens, CSS, SCSS, GIMP et Adobe Swatch Exchange) se trouvent dans l'en-tête de la palette, à côté de son titre. [Take your palette and fonts anywhere](/info/using.html#take-your-palette-and-fonts-anywhere) décrit chaque format.

## Typographie

Sans police propre, la pièce est une seule carte : **Primary**, composée à taille de lecture dans la police qui la sert aujourd'hui, avec une étiquette **Starter**, un bouton **Choose for Primary** et la ligne *"Nothing installs until you choose one."* Headings, code et italique suivent le primaire jusqu'à ce que tu les choisisses ; **Choose them separately** affiche leurs cartes.

![La pièce Type sans police choisie pour l'instant : une carte à taille de lecture, une étiquette Starter dessus et un seul **Choose for Primary** rempli](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Choisis une police et la pièce s'ouvre sur quatre cartes de rôle, la liste Fonts et un spécimen en direct :

- **Primary** : le texte courant, les boutons et chaque outil.
- **Headings** : la police d'affichage pour `h1` et `h2`.
- **Code** : une police à chasse fixe pour le code et les données.
- **Italic** : une vraie italique pour l'emphase, les citations et les apartés.

Une carte n'est teintée que là où tu as installé cette police. Son bouton dit pour quel rôle il est : **Change Headings** sur une police à toi et **Choose for Headings** partout ailleurs. La ligne d'exemple passe à la ligne au lieu d'être coupée. Rien sur une carte ne valide quoi que ce soit : le bouton ouvre la scène de comparaison pour ce rôle.

![Les quatre cartes de rôle révélées - chacune composée dans la graisse qui la sert, avec une étiquette Starter là où personne n'en a choisi une, et l'italique qui suit la principale](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### La scène de comparaison

La scène s'ouvre dans la pièce, sous la carte sur laquelle tu as appuyé, et les cartes se replient en une bande d'une ligne pour que la scène s'affiche dès le premier écran d'un téléphone. Échap annule et rend le focus à la carte.

1. Appuie sur **Choose for** et le rôle sur la carte.
2. Saisis un nom de famille et appuie sur **Preview**, ou appuie sur l'une des six familles **Pinned** sous le champ.
3. Appuie sur **Use this face**.

![La scène de comparaison ouverte sous sa carte, avec la ligne de recherche, les familles épinglées et les cartes repliées en un bandeau d'une ligne](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**Le consentement est demandé une fois.** La première fois qu'un aperçu atteint Google Fonts, une boîte de dialogue explique : *Google learns the family name and your IP address. The file is then kept on this device and used offline. This is the one step in the studio that reaches a third party.* **Fetch from Google** poursuit et est mémorisé. **Cancel** laisse la carte affichant *"Not fetched. Nothing was sent to Google."*, avec son propre **Fetch from Google**.

**Dépose un fichier de police sur la scène** (TTF, OTF ou WOFF) pour prévisualiser une police sous licence que tu possèdes déjà. Dans les deux cas, la police reste sur cet appareil, s'affiche hors ligne dans l'application, les outils et chaque export, et voyage dans le fichier du design system. Tout ce qui est sur Google Fonts est publié sous une licence ouverte (OFL, Apache ou UFL).

### Polices sur cet appareil

Le panneau **Fonts** liste chaque police présente sur cet appareil et le rôle qu'elle remplit. Les polices que tu as ajoutées passent en premier sous **In the design system**, chacune avec ses rôles et un bouton de suppression. Les polices de départ suivent sur une rangée atténuée et repliée. **Add a face** ouvre la scène de comparaison pour n'importe quel rôle. Le panneau **Type roles** montre un spécimen en direct de chaque rôle avec sa famille et son état, comme *Inter* ou *Inter · follows Primary*.

## Tokens

Les tokens sont les valeurs nommées derrière le design system : couleurs, polices, logos, angles et espacements. Les outils les lisent par leur nom, donc un changement ici atteint tous les outils à la fois.

![La pièce Tokens : l'en-tête avec un exemple tiré du système et les actions sur les fichiers, des tuiles comptant chaque type de token, puis les paires de couleurs avec leurs mesures de contraste](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **L'en-tête** donne un exemple tiré de ton propre système (*Primary is Spearmint, #033633*) et les actions sur les fichiers : **Download** (tout le système sous forme de design tokens, ou la palette dans cinq autres formats), **Copy CSS** et **Add from…** pour relire un fichier JSON.
- **Les tuiles** comptent chaque type de token et renvoient à sa section : Colours, Type, Logos, Shape and spacing, More et All tokens. Elles comptent ce que contient chaque section ; une section qui ne contient que ce qui vient du modèle vierge porte une étiquette **Starter**, et un système livré avec l'application compte son propre contenu sans elle. Sur un téléphone, les tuiles passent sur deux rangées de trois.
- **Colours** commence par les paires que les outils assemblent (texte sur surface, sur primaire, atténué sur surface) avec une mesure APCA en clair et en sombre, et signale **Weak contrast** là où une paire est insuffisante. Puis chaque groupe de couleurs : une rampe sous forme d'une rangée de pastilles, les autres couleurs avec leur valeur et la référence que les outils utilisent, comme `{color.brand.spearmint}`. Appuie sur une référence pour la copier. **Edit in Colours** ouvre un groupe dans la pièce Colours. Dans un design system avec des [rôles de couleur](#colour-roles-what-the-colours-are-called), **Colour roles** vient en premier, avec chaque rôle une seule fois, dans les mots et l'ordre du système. Un rôle garde une couleur pour chaque variante de couleur et chaque look, et ces couleurs restent avec le rôle au lieu d'apparaître comme des couleurs à part : modifie-les dans le tableau Colour roles.
- **Type** et **Logos** listent la police de chaque rôle et chaque emplacement de logo, avec **Edit in Type** et **Edit in Logos** dès que tu as les tiens.
- **Shape and spacing** contient **Rounded corners** (`shape.radius`) et **Spacing rhythm** (`space.base`). Chacun affiche *Lolly default* jusqu'à ce que tu déplaces le curseur et *Yours* ensuite, s'enregistre aussitôt et peut être annulé.
- **More tokens** ajoute espacement, dimensions, épaisseur de trait, opacité, rotation, nombres simples et ombres, stockés comme [design tokens](/info/design-tokens.html) standard.
- **App appearance (advanced)** liste les couleurs, tailles et ombres qu'utilisent les écrans propres de Lolly, et **Inspect every token (advanced)** recherche et modifie n'importe quelle valeur stockée, en montrant chaque changement pour relecture d'abord. Là, les valeurs d'un rôle de couleur dans chaque variante de couleur sont listées avec le rôle : choisis le token du rôle pour voir une ligne par variante de couleur, clair et sombre côte à côte, et la ligne de décompte indique combien de valeurs les rôles contiennent. Un design system en lecture seule affiche la même liste.

Une section vide propose le moyen de combler le vide : **Pick a colour**, **Choose a face** ou **Add a logo**.

## Fichiers

Dépose les fichiers que ta marque conserve, hors logos : fichiers **vector**, **image**, **audio** et **motion** (vidéo, Lottie et animations). Ils apparaissent dans [Assets](/info/using.html#assets-your-library), classés en sections et prêts dans le sélecteur de ressources de chaque outil, et ils restent sur cet appareil.

## Rules

**Rules** met au travail les choix de ta marque : ce que les gens peuvent changer, ce qui reste fixe et ce que Lolly peut vérifier.

![Rules sur Lolly Demo : quatre règles maison, chacune marquée Checked in Lolly Design et Required ou Advisory, puis Try your design system in use avec ses exemples prêts à être rendus](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** liste tes règles. **Add rule** (ou **Add your first rule**) ouvre un court formulaire :

- un **Rule name** dans tes propres mots, comme *Beacon accents* ;
- le **Check** : **Colour choices**, **Font choices**, **Fixed artwork** ou **Text length**, avec le rôle de marque qu'il utilise, sous ton propre nom pour le rôle ;
- l'**Example** auquel elle s'applique (Poster, Title slide, Content slide ou Lolly Chart), le **Mode** et si elle est **Required** ou **Advisory** ;
- **Reviewed by**, puis **Save draft** ou **Approve & save**.

L'approbation enregistre ta propre décision sur cet appareil. Les règles requises approuvées contraignent l'affiche réutilisable, et les vérifications ne couvrent que les PNG d'exemple ; elles ne changent aucun autre outil.

Les règles qu'un design system apporte dans son fichier de tokens, comme des associations de couleurs approuvées, l'épaisseur et l'alignement du texte ou un logo par surface, sont listées ici comme **Checked in Lolly Design**. Lolly Design les vérifie calque par calque dans la carte **Before you export** du panneau d'export, et `lolly check` fait de même pour un document Lolly Design enregistré ([Before you export](/info/design.html#before-you-export)). Une règle pour laquelle ce build n'a pas de vérificateur est conservée telle quelle et marquée **Unchecked**.

Lolly Demo apporte quatre règles maison approuvées. Les titres ne sont jamais composés en capitales : cette règle est obligatoire, donc `lolly check` signale un titre en capitales comme une erreur. Les trois autres sont consultatives. Le corps de texte est aligné à gauche. Les marques principales se placent sur des surfaces claires et les marques inversées sur des surfaces sombres. Les lignes en pointillés signifient déposer ici.

**Try your design system in use** rend quatre exemples de la révision actuelle avec **Render & check examples**. Choisis un **Mode** et **Try your own text** pour le titre, le texte d'appui et le texte des diapositives. Chaque exemple indique ce qui a été mesuré, avec **See checks & sources** et **Download check report**, et **Make reusable poster** télécharge un `.lolly` dont la mise en page fixe et les choix de champs approuvés voyagent avec le fichier. Les exemples sont locaux : rien n'est publié ni approuvé en lançant une vérification.

Un build livré avec une marque figée montre les mêmes règles et exemples en lecture seule, sous *This brand is set*.

## Skills

**Skills** liste les [brand skills](/info/brand-skills.html) du design system actif : les standards écrits de la marque, un par discipline, pour les personnes et les agents IA. Chaque ligne donne la discipline, le statut propre à la marque (**Draft** ou **Approved**), si le skill est public ou interne et sa révision. Choisis une ligne pour lire le skill à côté de sa couverture, qui confronte les lignes du skill à tes tokens : ce que Lolly vérifie, ce qui est en conflit, ce qui concorde et ce qui n'est qu'un conseil.

**Download skill (.zip)** écrit le skill sous forme de dossier Agent Skills pour un outil d'agent, avec des liens de catalogue qui pointent vers ce Lolly, et **Copy as one file** place le même texte dans le presse-papiers pour une fenêtre de discussion. Un design system sans skills propres liste une base que Lolly écrit à partir de ses tokens et de ses règles maison à chaque lecture de la base. La pièce lit les skills et ne les modifie jamais.

## Faire entrer une marque

**Add from…** dans la barre ouvre un sélecteur qui demande ce que tu as, pas quel en est le format :

- **Design tokens or a design file** : du JSON DTCG ou Tokens Studio, un projet Penpot, un zip de jeux de tokens, un paquet de design system Lolly, un SVG, un `DESIGN.md` ou un dossier de page de marque.
- **PDF** : une présentation ou un fichier de directives, lu sur cet appareil pour ses couleurs, ses marques et ses polices intégrées.
- **Logo or screenshot** : une image devient une palette suggérée, lue sur cet appareil. Elle lit les couleurs, pas la police ni la mise en page.
- **Saved web page** : un fichier HTML et ses fichiers CSS, ou du HTML ou du CSS collé, jusqu'à 20 fichiers et 2 Mo. Seul le texte que tu fournis est lu : les ressources liées ne sont pas récupérées et les scripts ne s'exécutent pas.
- **Font file** : TTF, OTF ou WOFF. Ouvre la pièce Type, où la police s'installe.
- **Website** : une page, lue pour ses couleurs et sa typographie. Cette tuile n'apparaît que sur un appareil qui peut lire une page, et dit quel lecteur elle utilise : l'application sur cet appareil, ou l'extension de navigateur dans un onglet d'arrière-plan, connectée comme toi. Nommer une URL ne fait que remplir le champ ; appuyer sur récupérer vaut consentement.

Choisis la source fichier de design et la carte suivante liste les formats acceptés sous forme de tuiles d'icônes, la carte entière servant de cible de dépôt. Tu peux aussi déposer un fichier directement sur le studio.

![La carte d'import - les formats acceptés mènent en tuiles avec icône, et la carte entière est une seule zone de dépôt](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- Un **Lolly design-system pack** (`.lolly`, ou un ancien `.zip`) s'installe en une étape.
- Un export **Penpot** (`.penpot`) apporte ses design tokens.
- Un fichier **Design Tokens** (W3C DTCG) ou **Tokens Studio** (`.json`) apporte ses tokens. Une description qui demande à un lecteur d'ignorer des instructions, revendique des permissions ou demande d'exécuter du code est écartée, et l'import dit où elle se trouvait. C'est une vérification ligne par ligne qui laisse passer d'autres formulations, donc lis un fichier venant de quelqu'un que tu ne connais pas avant d'appliquer les tokens.
- Un **plain SVG** est analysé pour les couleurs parmi lesquelles tu choisis, la première devenant ta couleur primaire.
- Un **`DESIGN.md`** (`.md`) va vers **Try these colours** avec ses tokens tels qu'écrits. Son texte peut être gardé comme brouillon de brand skill, et la carte signale les lignes qui demandent à un lecteur d'ignorer des instructions, de revendiquer des permissions ou d'exécuter du code. Les agents et les pages de marque ne voient pas un brouillon tant que tu n'appuies pas sur **Keep this skill** dans la pièce Skills, et un skill conservé reste interne.
- Un **brand page folder**, choisi comme dossier, déposé ou zippé, passe par la même relecture. Chaque fichier est vérifié contre le `brand.json` du dossier, et un fichier qui ne correspond pas fait refuser tout le dossier. Il ajoute les tokens. Les logos et les polices restent dans le dossier.

Lolly lit une page de marque à partir des fichiers que tu fournis. Il ne récupère pas l'adresse d'un autre site.

### Un fichier avec ses propres mots de couleur

Un fichier de tokens ou un `DESIGN.md` peut employer ses propres mots pour ses couleurs, comme main, accent, supporting et tertiary. Quand Lolly trouve de tels mots, la relecture liste chacun avant que rien ne s'applique : le mot, sa couleur dans chaque apparence, le token d'où il vient et ce que Lolly en lirait. Lolly suggère ces lectures à partir des mots seuls, face à une courte liste, et n'utilise aucun modèle. Un mot hors de la liste arrive comme propre à la marque, **By name only**. Renomme n'importe quel mot, dis à quoi il sert, lis-le comme autre chose, ou décoche-le pour le laisser comme couleur nommée.

**Install with these roles** les écrit, et **Install without roles** installe le fichier exactement comme il est arrivé. Un fichier sans de tels mots ne montre aucune étape de plus. Un fichier qui énonce ses propres rôles, comme un fichier écrit par Lolly, les montre tels qu'écrits et les installe sans changement, et tu peux les modifier ensuite dans la pièce Colours. Le terminal n'a pas de relecture, donc `lolly system import` garde un enregistrement énoncé et laisse les mots des autres fichiers comme couleurs nommées.

### Relire une référence

Un logo, une capture d'écran, un site web ou une page enregistrée ouvre **Try these colours** : un exemple dans les couleurs proposées, une **Main colour** que tu peux changer et un nom pour un nouveau système. Un encadré explique ce que fait l'application : elle **replaces** les réglages de tokens actifs par la palette générée et les styles par défaut, **keeps** tes polices et les fichiers de ta bibliothèque, et le système précédent peut être **recovered**. **Apply suggested settings** applique les palettes claire et sombre, après un point de contrôle, et **Restore brand settings** peut ramener les anciens réglages. **Change reference** choisit une autre source.

**Palette, source details and individual choices** montre ce qui a été lu, les noms de polices trouvés et le contraste de l'aperçu. Les noms de polices ne sont que des suggestions ; Type reste l'endroit où tu installes une police. Les détails de la source peuvent inclure la typographie, les écarts, les marges intérieures et les valeurs d'angle quand ils sont observés, étiquetés **Not observed** sinon. Une page enregistrée ou une lecture native d'un site web rend compte des styles déclarés, que la page peut ne pas utiliser, et l'extension de navigateur peut rendre compte de styles mesurés sur un échantillon d'éléments visibles. Ce sont des observations : rien n'est installé, et l'espacement de la source ne remplace jamais le tien. **Choose individual items in the tray** garde des éléments isolés, et **Download design context** enregistre un rapport JSON d'observations, de tokens proposés et d'informations de source (avec un SHA-256 de tout HTML ou CSS fourni). Le rapport ne contient aucun texte brut de la page et n'est pas un Content Credential signé.

Les imports de PDF et de fichiers de design gardent leurs propres contrôles de relecture. Les éléments du **Tray** ne changent rien tant que tu ne les ajoutes pas dans la pièce qui possède ce type de matériel. `#/start?source=<kind>` ouvre le sélecteur sur une source (`file`, `pdf`, `image`, `font`, `url`, `page`), et `?import` ouvre la liste simple.

### Trouver et comparer une ambiance

Ouvre **Find a look** depuis Board ou depuis la liste des design systems dans Settings. Parcours les systèmes enregistrés sur cet appareil et quelques exemples Lolly réutilisables, et cherche par nom, étiquette de couleur ou police déclarée. **Closest to my current palette** trie selon la similarité de couleur mesurée, les polices correspondantes départageant les ex æquo ; ce n'est pas une note de qualité.

Clique sur une apparence pour l'aperçu en contexte. Un aperçu ne change rien. Le **Use this look** de chaque carte utilise cette apparence. Un système enregistré devient le système actif, ce qui ne modifie rien. Les couleurs d'un exemple passent par le point de contrôle habituel dans le design system ouvert, dont les logos, les polices et tout ce que l'exemple ne définit pas restent tels quels. **Compare looks** ajoute une case à chaque carte, pour en choisir deux et les comparer côte à côte. **Restore brand settings** récupère l'apparence précédente. Les systèmes enregistrés ont des **Search tags** modifiables sous **Details and design context**. Les exemples sont des recettes de couleur originales de Lolly, sans collection aspirée ni compte.

![Comparer Sunroom et Orchard côte à côte avant d'appliquer l'un des deux systèmes de couleur.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

## Conserver et déplacer ton design system

### Déplacer une marque entre appareils

**Export** écrit un fichier **`LollyBrand-….lolly`** : tes tokens, polices, logos et préférence de thème, avec un manifeste d'intégrité vérifié au retour. Les versions web antérieures à la 1.0.7 nommaient le même fichier `.zip`, et cette orthographe est toujours acceptée. **Tokens (.json)** écrit seul le document simple de design tokens, sans polices ni logos, pour un dépôt, une étape de build ou un autre outil de tokens.

Pour en rapatrier un, utilise **Add from… → Design tokens or a design file**, ou dépose le fichier sur le studio. C'est ainsi qu'un collègue te remet une marque, ou que tu en emportes une sur une seconde installation, sans compte et sans cloud. [Working with partners](/info/partners.html) couvre ce qu'il faut envoyer d'autre quand la personne qui reçoit ta marque travaille pour une autre organisation. Pour faire entrer une marque depuis la ligne de commande, voir [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** emballe les polices que tu as ajoutées dans un RPM installable. Si tu en as importé toi-même, Lolly te demande d'abord de confirmer que tu as le droit de les redistribuer.

### Restaurer des réglages antérieurs

Ouvre **More** dans la barre, choisis **Restore brand settings**, sélectionne un point de contrôle daté et appuie sur **Restore**. Il restaure les couleurs, les réglages de typographie et les autres tokens de la marque active ; les fichiers de polices et d'images restent comme ils sont. Lolly enregistre d'abord tes réglages actuels sous **Before restore**, pour que tu puisses annuler une restauration même après avoir fermé le navigateur. Les 20 derniers points de contrôle sont conservés sur cet appareil.

### Versions

Une version publiée est une **copie nommée et permanente** conservée sur cet appareil. Elle ne change jamais, donc un outil ou un lien qui l'épingle (avec `designv`) continue de dessiner la même chose. Un système avec quelque chose de toi propose **Versions & publishing** dans le menu **More** de la barre ; après ta première publication, **Versions** rejoint les pièces. `#/start?area=versions` l'ouvre directement.

- **Une version est permanente.** Il n'y a pas encore de suppression, et le panneau le dit.
- **Les suppressions ouvrent la carte de compatibilité**, car un token supprimé est ce qui casse un outil.
- **Publier ne s'annule pas ; restaurer, si.** *Restore latest from this version* est une modification ordinaire, avec **Undo** proposé aussitôt.

**Publish only** conserve une version sans changer ce que suivent les outils ; **Publish and make active** fait suivre cette version aux outils et à l'application. **Follow the latest again** met chaque modification en ligne dès que tu la fais.

### Publier une page de marque

Une [page de marque](/info/brand-page.html) est une adresse unique pour les personnes et pour les agents : une page qui montre les logos, les couleurs, la typographie et des exemples, avec les mêmes faits dans des fichiers à côté de la page. **Publish a brand page**, sous Versions & publishing, montre la page en ligne et, à côté de la page :

- **Goes public** : chaque fichier, regroupé, avec sa taille.
- **Held back** : ce qui est resté de côté, et pourquoi. Un logo sans licence enregistrée reste de côté jusqu'à ce que tu coches le nom du logo. Un fichier de police demande une licence enregistrée qui autorise sa transmission, et la page montre un spécimen en contours quand le fichier reste de côté. Les brand skills internes n'apparaissent jamais.
- **What was checked** : les paires de couleurs par colourway et par mode, et les règles maison. Ce sont des mesures, pas un verdict.
- **In your words** : une déclaration d'usage et un contact. La page imprime ce que tu écris et Lolly n'ajoute aucune licence ni revendication juridique. Un interrupteur retire la ligne « Made with Lolly » du pied de page.
- **On exports** : un interrupteur qui [enregistre l'adresse de la page dans les exports de ce design system](/info/brand-page.html#lead-back-from-your-files). Il est désactivé tant que tu ne l'actives pas, il demande une adresse `https`, et il ne voyage pas avec un paquet ni une copie. Un design system verrouillé n'affiche pas l'interrupteur, car son gestionnaire décide.

**Download folder** enregistre le dossier en ZIP pour que tu l'héberges où tu veux, et rien ne devient public tant que tu ne le fais pas. Dans un terminal, `lolly system publish --out=<dir>` écrit le même dossier. Une instance qui sert des pages de marque propose aussi **Publish to** son adresse, ce qui est une pression explicite, et passe par sa chaîne d'approbation quand elle en a une. Un design system géré ne publie que si son gestionnaire l'autorise.

### Connecter un agent

**Connect an agent**, au même endroit, te donne du texte à coller et dit ce que chaque option peut faire :

- **`AGENTS.md`** dans un projet : les agents lisent les noms et les règles du système. Il ne dessine rien et n'a besoin d'aucun serveur.
- **Lolly's public server** : dessine avec Lolly Demo, quel que soit le système que tu as ouvert ici. Il n'a pas besoin de clé.
- **Your instance** : dessine avec les systèmes que l'instance détient, et lit un jeton de service dans une variable d'environnement. La feuille donne le nom de la variable et ne montre jamais un jeton.

Quand aucun serveur hébergé ne dessine avec ton système, la feuille le dit.

## Gérer tes design systems

Ouvre **Settings → Preferences → Design systems** pour changer, ajouter ou supprimer des systèmes. **Open** sélectionne un système et l'ouvre ici ; **Make a new one** crée un système local et l'ouvre avec son champ de nom prêt. Un système est actif à la fois, pour tout l'appareil. [Brand architectures](/info/brand-architectures.html) aide à décider quand une marque a besoin de son propre design system.

**D'où vient un système.** Le système que fournit le catalogue d'un déploiement s'affiche **Came with this app**, ou **From this instance** dans une application connectée à une instance. Déplie **Catalogue source** pour voir qui le fournit, son ressource de tokens et son espace de noms, et sa version ou somme de contrôle connues ; si une actualisation échoue, le matériel en cache est étiqueté.

**Les systèmes gérés sont en lecture seule.** Un système indique **Managed by this instance** (ou **Managed by this app** dans l'application de bureau sans instance) quand son catalogue le verrouille. Tu peux l'utiliser et le télécharger, et l'ouvrir ici affiche une note en lecture seule avec **Make an editable copy** et **Switch**, puis ses rôles de couleur et ses tokens sans commandes de modification. Tes propres systèmes locaux restent modifiables, même quand le système géré est arrivé en premier. Un build avec une seule marque fixe ouvre Lolly Design System Setup sur *This brand is set*, avec les tokens de la marque et les règles d'usage à lire.

**Tout autre système fourni est à toi** pour le masquer, le modifier et le réinitialiser, y compris Lolly Demo et Lolly Starter sur lolly.tools. En modifier un conserve son nom et marque la ligne **Edited here**, et **Reset to original** dans son menu abandonne les changements faits sur cet appareil. Le système de départ vierge fait exception : une première modification y démarre un design system à toi, donc Lolly demande une fois comment nommer le nouveau système. [Lolly Demo in use](/info/lolly-demo-in-use.html#switch-to-your-own) montre ce que ton propre système remplace.

### Supprimer un design system

Choisis **Remove** dans le menu d'un système ; la confirmation dit quel système sera actif ensuite. Les sessions enregistrées, les envois et le matériel partagé avec un autre système restent.

Supprimer un système fourni ne fait que le masquer : ses ressources de catalogue restent, **Bring back** le montre de nouveau et il revient de lui-même si tu supprimes tout le reste. Supprimer une copie importée ou modifiée ne supprime ni le système fourni, ni ses logos, ni ses polices, et si la copie était active, le système fourni redevient actif. Supprimer une copie hébergée active n'efface que la connexion de cette copie ; une instance choisie séparément reste sélectionnée.

Changer ce qu'un serveur fournit est une tâche d'administrateur : son opérateur modifie le catalogue source et redéploie, ou un administrateur Lolly Work relit et applique un changement de serveur. Les modifications faites ici restent locales, avec une exception : sur une instance Lolly Work qui t'accorde `brand.edit`, un système géré propose aussi **Edit for** cette instance, qui ouvre une copie de modification, et **Send to** cette instance dans **Versions** renvoie ses couleurs, colourways, rôles de couleur et l'adresse de la page de marque. [Edit this instance from the studio](/info/work-design-system-administration.html#edit-this-instance-from-the-studio) couvre ce qu'une modification peut changer et comment l'instance sert le changement. Voir [Removing a catalogue design system](/info/configuration.html#removing-a-catalogue-design-system) et [Configuration](/info/configuration.html#supplied-and-local-design-systems).

## Utiliser le contexte de design hors de l'application

**Download design context** enregistre le document de tokens, les couleurs résolues, les familles de polices déclarées, les identifiants de ressources, les preuves de source quand elles sont consignées, la couverture et les règles explicites, sans fichiers de police ni preuve de propriété. La ligne de commande lit le fichier sans serveur : `lolly system import` en fait le design system du terminal et `lolly system check` vérifie les champs de Lolly Design par rapport au contexte enregistré. [Bring your design system](/info/cli.html#bring-your-design-system) couvre l'import et [Which design system a command uses](/info/cli-decks.html#which-design-system-a-command-uses) couvre la vérification, et un client MCP lit le même brief depuis `lolly://design-context` ([MCP Server](/info/mcp.html)).

## Où aller ensuite

- **[Using Lolly](/info/using.html)** : les outils, l'enregistrement, le partage et Assets.
- **[Brand architectures](/info/brand-architectures.html)** : comment les divisions, produits, marques endossées, clients et saisons se rattachent aux design systems, aux colourways et aux identités de logo.
- **[Working with partners](/info/partners.html)** : partager ta marque avec un partenaire, et travailler dans une marque qu'on t'a confiée.
- **[Brand pages](/info/brand-page.html)** : publie ton design system à une adresse unique, comme kit de presse et kit pour agents.
- **[Design Tokens](/info/design-tokens.html)** : le modèle de tokens dans lequel ta marque est écrite.
- **[Export a file](/info/exporting.html)** : unités d'impression, CMYK et les formats dans lesquels ta marque se rend.
