# Design System Setup

Ton logo, tes couleurs et tes polices vivent au même endroit, pour que chaque outil, page et export dessine avec eux. Cet endroit est **Design System Setup**, à `#/start`, et son slogan dit à quoi il sert : *Make it yours*.

Pars de ce que tu as. Dépose un logo et Lolly lit ses couleurs. Choisis une police, ou dépose le fichier de police dont ton entreprise détient la licence. Chaque changement se voit aussitôt dans toute l'application. Ton logo, tes polices et tes tokens restent sur cet appareil. Choisir une Google Font est la seule étape qui sort de l'appareil : Lolly demande d'abord, puis récupère la famille une fois.

Quand le résultat te convient, donne un nom au design system et appuie sur **Export**. Tu obtiens un fichier `.lolly` à conserver, à ouvrir sur un autre appareil ou à remettre à un collègue. [Settings](/info/dashboard.html#design-system) montre le système actif en lecture seule, et sa couverture renvoie ici pour le modifier.

## Fais-le tien en cinq minutes

::: timeline
- <!--i:upload--> **Dépose ton logo** sur la zone de dépôt dans **Logos**. Lolly lit sa forme et ses couleurs.
- <!--i:palette--> **Utilise ces couleurs.** La couleur principale du logo devient ton primaire, et un neutre foncé du logo devient ta couleur de texte.
- <!--i:font--> **Choisis une police** dans **Type** : une Google Font, ou un fichier de police que tu possèdes.
- <!--i:pentool--> **Nomme le système.** Ta première modification crée un design system à toi, et Lolly en demande le nom une seule fois.
- <!--i:download--> **Export** écrit tout le système dans un seul fichier `LollyBrand-….lolly`.
:::

L'en-tête indique quel design system tu es en train de **Editing**, et son nom est un champ que tu peux changer à tout moment. Quand ta première modification demande **What is this design system called?**, les mots de ton logo sont préremplis si le logo les épelle. **Save name** garde le nom ; **Not now** garde un nom provisoire jusqu'à ce que tu en saisisses un dans l'en-tête. Le nom étiquette le système dans Settings et quand tu changes, et il devient le nom du fichier qu'**Export** écrit.

## Les salles

Le studio est un ensemble de pièces dans un rail sur le côté, sans ordre fixe : rien n'est numéroté et rien n'attend autre chose. Sur un téléphone, le rail devient une bande de pastilles sous l'en-tête.

![Le rail des pièces du studio : Overview, Colours, Type, Logos, Tokens, Files et Usage & rules](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Pièce | Ce que tu y fais | Clé de lien |
|---|---|---|
| **Overview** | Voir ce que contient le système, avec une porte vers chaque pièce | `overview` |
| **Colours** | Ajouter des couleurs, leur donner des rôles, créer des nuances et une palette | `color` |
| **Type** | Choisir les quatre polices que lisent l'application, les outils et chaque export | `type` |
| **Logos** | Placer tes marques dans chaque orientation et chaque traitement | `logos` |
| **Tokens** | Angles, espacements, ombres et toute autre valeur nommée | `tokens` |
| **Files** | Les images, fichiers audio et animations que ta marque conserve | `catalogue` |
| **Usage & rules** | Les règles que ta marque applique, vérifiées sur des exemples réels | `usage` |

Renvoie vers une pièce avec `#/start?area=<key>`. La pièce Files garde la clé `catalogue`, car une clé de pièce est un contrat permanent, et `?tab=` fonctionne toujours comme ancien alias. Une clé inconnue ouvre Overview.

Le **pied du rail** contient les actions pour tout le système plutôt que pour une pièce. **Add from…** fait entrer une marque ([Bring a brand in](#bring-a-brand-in)), et le **Tray** contient ce qu'une analyse a trouvé et que tu n'as pas encore ajouté. **Export**, **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions** et **Restore brand settings** conservent et déplacent le système ([Keep and move your design system](#keep-and-move-your-design-system)). Chacune n'apparaît que lorsqu'il y a quelque chose sur quoi elle peut agir.

## Overview

Tant que rien n'est choisi, Overview propose quatre façons de commencer. **Start from a reference** ouvre le sélecteur de source pour un logo, une capture d'écran, une page web ou un fichier de design, et **Pick a colour**, **Choose a face** et **Add a logo** ouvrent directement ces contrôles. En ouvrir un n'écrit rien, et **Explore the tools** est là dès le départ.

Dès que quelque chose t'appartient, Overview montre ce que tu as, avec tes propres totaux en premier. Colours donne le nombre de couleurs, avec un `· N starter` atténué là où des couleurs héritées s'affichent ; sa bande place d'abord tes couleurs, puis un filet, puis les couleurs de départ estompées. Type se lit par rôle (*Inter for headings*, avec *Starter for the rest* sur la ligne en dessous). Logos indique combien d'emplacements sont remplis (ou **Not set**), Tokens montre le rayon des angles et Files dit **Nothing yet** tant que la bibliothèque est vide. Chaque bloc ouvre sa pièce.

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
- Compté dans Overview et dans Tokens.
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

![Les emplacements de logo avec Horizontal et Vertical ouverts : chaque traitement est un emplacement à part, et chaque emplacement est facultatif](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails%3Anth-of-type%281%29%3Esummary%3Bclick%3A.be-logo-identity%3Edetails%3Anth-of-type%282%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** sont les marques que ta marque appelle par son propre nom, comme une icône, un blason ou un favicon.
- **Plus d'identités.** Une sous-marque, un produit ou un événement peut avoir son propre jeu complet : **+ Add another logo** et donne un nom au jeu. Ton jeu principal est « Your logo ». [Brand architectures](/info/brand-architectures.html) montre quand une identité de logo est le bon bloc.
- **Lolly lit les couleurs du logo.** Une carte sous la zone de dépôt, et de nouveau en haut de Colours, liste les couleurs du logo et demande **Which is the main colour?**, la couleur la plus forte étant déjà sélectionnée (jamais le blanc sur lequel il a été exporté). **Use these colours** les ajoute à ta palette, fait de la couleur principale ton primaire et, quand le logo a un neutre foncé lisible sur papier, en fait la couleur du texte. **Not now** les laisse dans le Tray. Sur une installation toute neuve, la réponse la plus probable est appliquée tout de suite, et la carte propose **Undo** ou une autre couleur principale. Un SVG donne des couleurs exactes ; un PNG, JPEG ou WebP donne les couleurs qui couvrent une part réelle de la marque.

## Colours

La pièce grandit avec le design system : une première visite est une seule décision, et le reste arrive avec la palette.

### La première couleur

Un système sans couleur propre s'ouvre sur une grande pastille et un champ, avec une ligne disant que les rôles, les nuances et les réglages d'impression arrivent à mesure que le système grandit.

- **La pastille est le sélecteur.** Appuie sur **Pick a colour** et la carte OKLCH du studio s'ouvre, préremplie avec ce que contient le champ : un nom, la roue, les quatre cadrans, l'alpha et **Stored as**, avec **Cancel** et **Add colour** en bas. Rien n'atteint le système tant que tu n'appuies pas sur **Add colour**.
- **Le champ accepte toute notation** : `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` ou un nom de couleur. Colle une liste et elle devient une rangée de pastilles à ajouter une par une ou avec **Add all**.
- **Deux autres entrées.** **Pick a colour from the screen** utilise la pipette là où le navigateur en a une, et **Take colours from an image** lit une capture d'écran ou une photo de cet appareil.
- **Add n'est jamais désactivé.** Avec rien dans le champ, il ouvre le sélecteur ; un texte qu'il ne sait pas lire reçoit une ligne sous le champ qui le dit.

Ta première couleur devient le **primaire**, et une pastille le confirme, comme *"Primary is now Vivid Violet"*, avec **Fine-tune** pour ajuster la couleur.


### À mesure que la palette grandit

Tes couleurs se placent à côté d'un aperçu **In context** sur un grand écran, et au-dessus sur un plus petit. L'aperçu montre une affiche, un graphique ou une carte d'interface dans ta palette. Les couleurs de départ restent dans leur propre groupe repliable.

![La pièce Colours sur Lolly Demo : la palette en groupes repliables, chaque couleur avec son nom et son hexadécimal, et la pastille de téléchargement en bas](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![La salle Colours après l'ajout d'une couleur, avec sa palette et un aperçu de composition en direct](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Rôles : ce que lisent les outils

Les **Roles** disent quelle couleur joue quel rôle dans chaque outil et chaque export. Ils sont facultatifs (trois couleurs libres sans rôle forment un système tout à fait valable), toute couleur peut en prendre un et l'indicateur de contraste est mesuré par rapport à la surface, APCA d'abord. Chaque ligne de rôle montre une couleur propre à pleine intensité, une couleur de départ qui tient lieu, ou **↳ follows Primary**.

Une fois que la palette a des nuances, la bande montre les sept rôles qu'un outil peut lire : Primary, Secondary, Surface, Text, Muted, Edge et On primary. On primary est dérivé du primaire, affiche **Derived** et n'a pas de sélecteur.

L'accent propre de l'application suit le design system par défaut. C'est le réglage **Interface follows the design system** dans **Settings → Appearance** ; le désactiver laisse l'habillage de l'application neutre, tandis que les outils, canevas et exports suivent le design system dans les deux cas.

**Colourways.** Un design system peut contenir plusieurs couleurs dominantes, chacune choisie par pièce. Lolly conserve chaque colourway, mais cette pièce ne peut pas encore en créer : un colourway s'écrit dans le fichier de tokens. Sur un système avec des colourways, chaque colourway a besoin de son propre primaire et secondaire, et de sa propre surface quand les colourways teintent le fond, donc ces rôles restent définis dans l'éditeur de nuancier. [Lolly Demo in use](/info/lolly-demo-in-use.html#colourways-on-real-work) montre les colourways sur du vrai travail, et [Add colourways to a design system](/info/colourways.html#add-colourways-to-a-design-system) donne le format.

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

La palette liste tes couleurs en groupes repliables, chacun avec son propre **+ Add**. Crée et renomme les groupes comme tu veux. Un rôle ne crée jamais une seconde tuile : une tuile sur laquelle pointe un rôle porte plutôt une petite marque (**P**, **S**, **Su**, **T**). **Colour chart** sous les tuiles montre les mêmes couleurs sur la **Wheel** OKLCH (fais glisser un point pour recolorer, clique sur un espace vide pour ajouter un échantillon) et le graphique **Gamut**, qui montre où s'arrête la plage affichable. `#/start?area=color&focus=chart` ouvre directement le graphique.

![Le panneau de palette, chaque groupe repliable, avec la pastille de téléchargement calée sur son bord inférieur](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![La roue OKLCH - l'angle est la teinte, la distance vers l'extérieur est la chroma et les gris suivent un rail de luminosité sur le côté](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Clique sur un échantillon pour ouvrir son éditeur :

- **Rename** l'échantillon.
- **Set the colour** avec des curseurs OKLCH, ou en **Hex**, **HSL**, **RGB** ou **CMYK**. Le champ de valeur lit et écrit dans l'espace actif. Ici, CMYK définit la couleur d'écran par conversion ; pour épingler des encres exactes, utilise **Print substitutes**.
- **Stored as** choisit comment l'échantillon est enregistré : **LCH** (le défaut, perceptif et à large gamut), Hex, RGB ou HSL.
- **Use as** donne directement un rôle à l'échantillon. Appuie de nouveau sur un rôle en surbrillance pour l'effacer.
- **Print substitutes** (replié) : verrouille **CMYK** depuis **Auto** vers des valeurs d'encre exactes, ou définis une **Spot colour** avec un **Name** (comme `PANTONE 186 C`), un **Book** facultatif et une **Finish** pour dorure, gaufrage, débossage, vernis sélectif, soft touch ou une découpe, un pli ou une perforation. Une presse utilise ces verrous quand tu exportes un PDF ou un TIFF CMJN ; voir [Colour profiles](/info/exporting.html#colour-profiles).
- **In other spaces** (replié) : une valeur par espace colorimétrique, dérivée ou définie par toi, et une valeur définie l'emporte à l'export.

**Supprimer un échantillon** est sans risque. Les nuances dérivées et les rôles de thème sont masqués, donc rien de ce qui les lit ne casse, tandis que les couleurs que tu as ajoutées sont supprimées.

::: details Travailler avec beaucoup d'échantillons
Chaque échantillon a une poignée de glissement. Fais glisser pour réordonner au sein d'un groupe, ou mets la poignée au focus, appuie sur Espace, utilise les flèches et appuie de nouveau sur Espace pour déposer ; Échap annule. Pour déplacer des couleurs entre groupes, utilise le contrôle **Group** de l'éditeur ou sélectionnes-en plusieurs et utilise **Move to**.

La sélection n'exige aucun mode. La barre apparaît avec la première tuile sélectionnée et disparaît avec la dernière.

- **Fais glisser sur un espace vide** pour tracer un rectangle ; chaque tuile qu'il touche rejoint la sélection, à travers les groupes. Une section repliée n'ajoute rien.
- **Maj-clic** prend une plage dans l'ordre de lecture, **Cmd/Ctrl-clic** bascule une tuile, et un simple clic ouvre l'éditeur.
- Chaque en-tête de groupe a **Select all**, et **Cmd-A** avec une tuile au focus prend chaque couleur qui t'appartient, jamais une couleur de départ.
- La grille a un seul arrêt de tabulation : les flèches déplacent, Maj-flèches étendent, Espace bascule, Suppr supprime et Échap efface. Pour ajuster un canal, appuie d'abord sur `l`, `c` ou `h`.
- Sur un écran tactile, appuie longuement sur une tuile pour démarrer une sélection, puis touche pour ajouter.

La barre affiche **{n} selected**, puis **Move to**, **Give a role** (chaque couleur prend le rôle suivant à tour de rôle), **Download** (la sélection dans l'un des six formats de palette), **Duplicate** (une copie de chacune, placée après l'original), **Copy values** et **Delete**. Une copie s'ouvre directement dans l'éditeur ; plusieurs restent sélectionnées. Un seul Cmd/Ctrl-Z annule toute une action groupée.
:::

### Dégradés

Le panneau facultatif **Gradients** construit des tokens de dégradé à partir de la palette. Chaque dégradé a un aperçu, de 2 à 8 points nommés et un angle. Un point renvoie à un échantillon, donc recolore l'échantillon et le dégradé suit. Les dégradés se calculent en OKLCH.

Les téléchargements de la palette (design tokens, CSS, SCSS, GIMP et Adobe Swatch Exchange) se trouvent dans une pastille au pied de la palette dès qu'il y a des nuances. [Take your palette and fonts anywhere](/info/using.html#take-your-palette-and-fonts-anywhere) décrit chaque format.

## Typographie

Sans police propre, la pièce est une seule carte : **Primary**, composée à taille de lecture dans la police qui la sert aujourd'hui, avec une étiquette **Starter**, un bouton **Choose a face** et la ligne *"Nothing installs until you choose one."* Headings, code et italique suivent le primaire jusqu'à ce que tu les choisisses ; **Choose them separately** affiche leurs cartes.

![La salle Typographie sans graisse choisie pour l'instant - une carte à la taille de lecture, une étiquette Starter dessus, et un Choisir une graisse rempli](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Choisis une police et la pièce s'ouvre sur quatre cartes de rôle, la liste Fonts et un spécimen en direct :

- **Primary** : le texte courant, les boutons et chaque outil.
- **Headings** : la police d'affichage pour `h1` et `h2`.
- **Code** : une police à chasse fixe pour le code et les données.
- **Italic** : une vraie italique pour l'emphase, les citations et les apartés.

Une carte n'est teintée que là où tu as installé cette police, et son bouton affiche **Change** sur une police à toi et **Choose a face** partout ailleurs. Rien sur une carte ne valide quoi que ce soit : le bouton ouvre la scène de comparaison pour ce rôle.

![Les quatre cartes de rôle révélées - chacune composée dans la graisse qui la sert, avec une étiquette Starter là où personne n'en a choisi une, et l'italique qui suit la principale](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### La scène de comparaison

La scène s'ouvre dans la pièce, sous la carte sur laquelle tu as appuyé, et les cartes se replient en une bande d'une ligne pour que la scène s'affiche dès le premier écran d'un téléphone. Échap annule et rend le focus à la carte.

1. Appuie sur **Choose a face** sur la carte.
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
- **Les tuiles** comptent chaque type de token et renvoient à sa section : Colours, Type, Logos, Shape and spacing, More et All tokens. Elles comptent ce qui t'appartient, comme Overview. Sur un téléphone, les tuiles défilent latéralement.
- **Colours** commence par les paires que les outils assemblent (texte sur surface, sur primaire, atténué sur surface) avec une mesure APCA en clair et en sombre, et signale **Weak contrast** là où une paire est insuffisante. Puis chaque groupe de couleurs : une rampe sous forme d'une rangée de pastilles, les autres couleurs avec leur valeur et la référence que les outils utilisent, comme `{color.brand.spearmint}`. Appuie sur une référence pour la copier. **Edit in Colours** ouvre un groupe dans la pièce Colours.
- **Type** et **Logos** listent la police de chaque rôle et chaque emplacement de logo, avec **Edit in Type** et **Edit in Logos** dès que tu as les tiens.
- **Shape and spacing** contient **Rounded corners** (`shape.radius`) et **Spacing rhythm** (`space.base`). Chacun affiche *Lolly default* jusqu'à ce que tu déplaces le curseur et *Yours* ensuite, s'enregistre aussitôt et peut être annulé.
- **More tokens** ajoute espacement, dimensions, épaisseur de trait, opacité, rotation, nombres simples et ombres, stockés comme [design tokens](/info/design-tokens.html) standard.
- **App appearance (advanced)** liste les couleurs, tailles et ombres qu'utilisent les écrans propres de Lolly, et **Inspect every token (advanced)** recherche et modifie n'importe quelle valeur stockée, en montrant chaque changement pour relecture d'abord.

Une section vide propose le moyen de combler le vide : **Pick a colour**, **Choose a face** ou **Add a logo**.

## Fichiers

Dépose les fichiers que ta marque conserve, hors logos : fichiers **vector**, **image**, **audio** et **motion** (vidéo, Lottie et animations). Ils apparaissent dans [Assets](/info/using.html#assets-your-library), classés en sections et prêts dans le sélecteur de ressources de chaque outil, et ils restent sur cet appareil.

## Usage & rules

**Usage & rules** met au travail les choix de ta marque : ce que les gens peuvent changer, ce qui reste fixe et ce que Lolly peut vérifier.

![Usage & rules sur Lolly Demo : une carte Brand rules vide avec Add your first rule, puis Try your brand in use avec ses exemples prêts à être rendus](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** liste tes règles. **Add rule** (ou **Add your first rule**) ouvre un court formulaire :

- un **Rule name** dans tes propres mots, comme *Beacon accents* ;
- le **Check** : **Colour choices**, **Font choices**, **Fixed artwork** ou **Text length**, avec le rôle de marque qu'il utilise, sous ton propre nom pour le rôle ;
- l'**Example** auquel il s'applique (Poster, Title slide, Content slide ou Chart), le **Mode** et s'il est **Required** ou **Advisory** ;
- **Reviewed by**, puis **Save draft** ou **Approve & save**.

L'approbation enregistre ta propre décision sur cet appareil. Les règles requises approuvées contraignent l'affiche réutilisable, et les vérifications ne couvrent que les PNG d'exemple ; elles ne changent aucun autre outil.

Les règles qu'un design system apporte dans son fichier de tokens, comme les associations de couleurs approuvées, le poids et l'alignement du texte ou un logo par support, sont listées ici comme **Checked in Design**. Design les vérifie calque par calque dans la carte **Before you export** du panneau d'export, et `lolly check` fait de même pour un document Design enregistré ([Before you export](/info/design.html#before-you-export)). Une règle pour laquelle ce build n'a pas de vérificateur est conservée telle que fournie et marquée **Unchecked**.

**Try your brand in use** rend quatre exemples à partir de la révision actuelle avec **Render & check examples**. Choisis un **Brand mode** et **Try your own text** pour le titre, le texte d'appui et le texte de diapositive. Chaque exemple rend compte de ce qui a été mesuré, avec **See checks & sources** et **Download check report**, et **Make reusable poster** télécharge un `.lolly` dont la mise en page fixe et les choix d'entrées approuvés voyagent avec le fichier. Les exemples sont locaux : rien n'est publié ni approuvé en lançant une vérification.

Un build livré avec une marque figée montre les mêmes règles et exemples en lecture seule, sous *This brand is set*.

## Faire entrer une marque

**Add from…** au pied du rail ouvre un sélecteur qui demande ce que tu as, pas quel est le format :

- **Design tokens or a design file** : du JSON DTCG ou Tokens Studio, un projet Penpot, un zip d'ensembles de tokens, un pack de design system Lolly ou un SVG.
- **PDF** : un deck ou un fichier de directives, lu sur cet appareil pour ses couleurs, ses marques et ses polices incorporées.
- **Logo or screenshot** : une image devient une palette suggérée, lue sur cet appareil. Elle lit des couleurs, pas la police ni la mise en page.
- **Saved web page** : un fichier HTML et ses fichiers CSS, ou du HTML ou du CSS collé, jusqu'à 20 fichiers et 2 MB. Seul le texte que tu fournis est lu : les ressources liées ne sont pas récupérées et les scripts ne s'exécutent pas.
- **Font file** : TTF, OTF ou WOFF. Ouvre la pièce Type, où la police s'installe.
- **Website** : une page, lue pour ses couleurs et sa typographie. Cette tuile n'apparaît que sur un appareil qui peut lire une page, et dit quel lecteur elle utilise : l'application sur cet appareil, ou l'extension de navigateur dans un onglet d'arrière-plan, connecté en ton nom. Saisir une URL ne fait que remplir le champ ; appuyer sur fetch est le consentement.

Choisis la source fichier de design et la carte suivante liste les formats acceptés sous forme de tuiles d'icônes, la carte entière servant de cible de dépôt. Tu peux aussi déposer un fichier directement sur le studio.

![La carte d'import - les formats acceptés mènent en tuiles avec icône, et la carte entière est une seule zone de dépôt](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- Un **Lolly design-system pack** (`.lolly`, ou un ancien `.zip`) s'installe en une étape.
- Un export **Penpot** (`.penpot`) apporte ses design tokens.
- Un fichier **Design Tokens** (W3C DTCG) ou **Tokens Studio** (`.json`) apporte ses tokens.
- Un **SVG simple** est analysé pour les couleurs parmi lesquelles tu choisis, la première devenant ton primaire.

### Relire une référence

Un logo, une capture d'écran, un site web ou une page enregistrée ouvre **Try these colours** : un exemple dans les couleurs proposées, une **Main colour** que tu peux changer et un nom pour un nouveau système. Un encadré explique ce que fait l'application : elle **replaces** les réglages de tokens actifs par la palette générée et les styles par défaut, **keeps** tes polices et les fichiers de ta bibliothèque, et le système précédent peut être **recovered**. **Apply suggested settings** applique les palettes claire et sombre, après un point de contrôle, et **Restore brand settings** peut ramener les anciens réglages. **Change reference** choisit une autre source.

**Palette, source details and individual choices** montre ce qui a été lu, les noms de polices trouvés et le contraste de l'aperçu. Les noms de polices ne sont que des suggestions ; Type reste l'endroit où tu installes une police. Les détails de la source peuvent inclure la typographie, les écarts, les marges intérieures et les valeurs d'angle quand ils sont observés, étiquetés **Not observed** sinon. Une page enregistrée ou une lecture native d'un site web rend compte des styles déclarés, que la page peut ne pas utiliser, et l'extension de navigateur peut rendre compte de styles mesurés sur un échantillon d'éléments visibles. Ce sont des observations : rien n'est installé, et l'espacement de la source ne remplace jamais le tien. **Choose individual items in the tray** garde des éléments isolés, et **Download design context** enregistre un rapport JSON d'observations, de tokens proposés et d'informations de source (avec un SHA-256 de tout HTML ou CSS fourni). Le rapport ne contient aucun texte brut de la page et n'est pas un Content Credential signé.

Les imports de PDF et de fichiers de design gardent leurs propres contrôles de relecture. Les éléments du **Tray** ne changent rien tant que tu ne les ajoutes pas dans la pièce qui possède ce type de matériel. `#/start?source=<kind>` ouvre le sélecteur sur une source (`file`, `pdf`, `image`, `font`, `url`, `page`), et `?import` ouvre la liste simple.

### Trouver et comparer une ambiance

Ouvre **Find a look** depuis Overview ou depuis la liste des design systems dans Settings. Parcours les systèmes enregistrés sur cet appareil et quelques exemples Lolly réutilisables, et cherche par nom, étiquette de couleur ou police déclarée. **Closest to my current palette** trie selon la similarité de couleur mesurée, les polices correspondantes départageant les ex æquo ; ce n'est pas une note de qualité.

Sélectionne une ambiance pour la relire, ou deux pour les comparer côte à côte. Sélectionner ne change rien. **Use this saved system** bascule dessus, et **Use these colours** applique les couleurs d'un exemple via le point de contrôle habituel, en gardant tes polices. **Restore brand settings** récupère l'ambiance précédente. Les systèmes enregistrés ont des **Search tags** modifiables sous **Details and design context**. Les exemples sont des recettes de couleurs originales de Lolly, sans collection aspirée et sans compte.

![Comparer Sunroom et Orchard côte à côte avant d'appliquer l'un des deux systèmes de couleur.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

## Conserver et déplacer ton design system

### Déplacer une marque entre appareils

**Export** écrit un fichier **`LollyBrand-….lolly`** : tes tokens, polices, logos et préférence de thème, avec un manifeste d'intégrité vérifié au retour. Les versions web antérieures à la 1.0.7 nommaient le même fichier `.zip`, et cette orthographe est toujours acceptée. **Tokens (.json)** écrit seul le document simple de design tokens, sans polices ni logos, pour un dépôt, une étape de build ou un autre outil de tokens.

Pour en rapatrier un, utilise **Add from… → Design tokens or a design file**, ou dépose le fichier sur le studio. C'est ainsi qu'un collègue te remet une marque, ou que tu en emportes une sur une seconde installation, sans compte et sans cloud. Pour faire entrer une marque depuis la ligne de commande, voir [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** emballe les polices que tu as ajoutées dans un RPM installable. Si tu en as importé toi-même, Lolly te demande d'abord de confirmer que tu as le droit de les redistribuer.

### Restaurer des réglages antérieurs

Choisis **Restore brand settings**, sélectionne un point de contrôle daté et appuie sur **Restore**. Il restaure les couleurs, les réglages de typographie et les autres tokens de la marque active ; les fichiers de polices et d'images restent comme ils sont. Lolly enregistre d'abord tes réglages actuels sous **Before restore**, pour que tu puisses annuler une restauration même après avoir fermé le navigateur. Les 20 derniers points de contrôle sont conservés sur cet appareil.

### Versions

Une version publiée est une **copie nommée et permanente** conservée sur cet appareil. Elle ne change jamais, donc un outil ou un lien qui l'épingle (avec `designv`) continue de dessiner la même chose. Un système avec quelque chose de toi affiche un discret lien **Versions & publishing** au pied du rail ; après ta première publication, il devient l'entrée **Versions**. `#/start?area=versions` l'ouvre directement.

- **Une version est permanente.** Il n'y a pas encore de suppression, et le panneau le dit.
- **Les suppressions ouvrent la carte de compatibilité**, car un token supprimé est ce qui casse un outil.
- **Publier ne s'annule pas ; restaurer, si.** *Restore latest from this version* est une modification ordinaire, avec **Undo** proposé aussitôt.

**Publish only** conserve une version sans changer ce que suivent les outils ; **Publish and make active** fait suivre cette version aux outils et à l'application. **Follow the latest again** met chaque modification en ligne dès que tu la fais.

## Gérer tes design systems

Ouvre **Settings → Preferences → Design systems** pour changer, ajouter ou supprimer des systèmes. **Open** sélectionne un système et l'ouvre ici ; **Make a new one** crée un système local et l'ouvre avec son champ de nom prêt. Un système est actif à la fois, pour tout l'appareil. [Brand architectures](/info/brand-architectures.html) aide à décider quand une marque a besoin de son propre design system.

**D'où vient un système.** Le système que fournit le catalogue d'un déploiement s'affiche **Came with this app**, ou **From this instance** dans une application connectée à une instance. Déplie **Catalogue source** pour voir qui le fournit, son ressource de tokens et son espace de noms, et sa version ou somme de contrôle connues ; si une actualisation échoue, le matériel en cache est étiqueté.

**Les systèmes gérés sont en lecture seule.** Un système affiche **Managed by this instance** (ou **Managed by this app** dans l'application de bureau sans instance) quand son catalogue le verrouille. Tu peux l'utiliser et le télécharger, et l'ouvrir ici affiche une note en lecture seule avec **Make an editable copy** et **Switch**. Tes propres systèmes locaux restent modifiables, même quand le système géré est arrivé en premier. Un build avec une marque fixe ouvre Design System Setup sur *This brand is set*, avec les tokens et les règles d'usage de la marque à lire.

**Tout autre système fourni est à toi** pour le masquer, le modifier et le réinitialiser, y compris Lolly Demo et Lolly Starter sur lolly.tools. En modifier un conserve son nom et marque la ligne **Edited here**, et **Reset to original** dans son menu abandonne les changements faits sur cet appareil. Le système de départ vierge fait exception : une première modification y démarre un design system à toi, donc Lolly demande une fois comment nommer le nouveau système. [Lolly Demo in use](/info/lolly-demo-in-use.html#switch-to-your-own) montre ce que ton propre système remplace.

### Supprimer un design system

Choisis **Remove** dans le menu d'un système ; la confirmation dit quel système sera actif ensuite. Les sessions enregistrées, les envois et le matériel partagé avec un autre système restent.

Supprimer un système fourni ne fait que le masquer : ses ressources de catalogue restent, **Bring back** le montre de nouveau et il revient de lui-même si tu supprimes tout le reste. Supprimer une copie importée ou modifiée ne supprime ni le système fourni, ni ses logos, ni ses polices, et si la copie était active, le système fourni redevient actif. Supprimer une copie hébergée active n'efface que la connexion de cette copie ; une instance choisie séparément reste sélectionnée.

Changer ce qu'un serveur fournit est une tâche d'administrateur : son opérateur modifie le catalogue source et redéploie, ou un administrateur Lolly Work relit et applique un changement de serveur. Les modifications faites ici restent locales. Voir [Removing a catalogue design system](/info/configuration.html#removing-a-catalogue-design-system) et [Configuration](/info/configuration.html#supplied-and-local-design-systems).

## Utiliser le contexte de design hors de l'application

**Download design context** enregistre le document de tokens, les couleurs résolues, les familles de polices déclarées, les identifiants de ressources, les preuves de source quand elles sont consignées, la couverture et les règles explicites, sans fichiers de polices et sans preuve de propriété. La ligne de commande lit le fichier sans serveur : `lolly system import` en fait le design system du terminal et `lolly system check` vérifie les entrées Design par rapport au contexte enregistré. [Bring your design system](/info/cli.html#bring-your-design-system) couvre l'import et [Which design system a command uses](/info/cli-decks.html#which-design-system-a-command-uses) couvre la vérification, et un client MCP lit le même brief depuis `lolly://design-context` ([MCP Server](/info/mcp.html)).

## Où aller ensuite

- **[Using Lolly](/info/using.html)** : les outils, l'enregistrement, le partage et Assets.
- **[Brand architectures](/info/brand-architectures.html)** : comment les divisions, produits, marques endossées, clients et saisons se rattachent aux design systems, aux colourways et aux identités de logo.
- **[Design Tokens](/info/design-tokens.html)** : le modèle de tokens dans lequel ta marque est écrite.
- **[Export a file](/info/exporting.html)** : unités d'impression, CMJN et les formats dans lesquels ta marque s'exporte.
