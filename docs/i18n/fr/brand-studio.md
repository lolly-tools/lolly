# Le Brand Studio

Le **Brand Studio** sur `#/start` est l'endroit unique où tu façonnes ta marque - ses logos, ses couleurs, sa typographie, le reste de tes tokens et les fichiers qu'elle conserve. Configure-le ici une fois et chaque outil, page et export le suit *par construction*, pas par relecture.

Les modifications se prévisualisent **en direct dans toute l'application** au fur et à mesure, pour que tu voies une couleur ou une police se répercuter partout avant de la valider. Tout se passe sur l'appareil : tes fichiers de marque et tes tokens ne quittent jamais ta machine (choisir une Google Font récupère cette famille chez Google, une fois, après une boîte de dialogue de consentement), et la marque voyage dans un seul fichier [brand pack](#move-a-brand-between-devices).

> **Ceci est l'éditeur. Le dashboard est le miroir.** L'onglet **Design system** du Dashboard (`#/d`) *affiche* ta marque en lecture seule ; tu l'*édites* ici, sur `#/start`. Si tu veux changer une couleur plus tard, reviens dans le Brand Studio.

## Les salles

Le studio est un ensemble de **salles** listées dans un rail sur le côté - pas des étapes. Rien n'est numéroté, rien n'est conditionné à autre chose et arriver dans n'importe laquelle d'entre elles est légitime :

- **Overview** - le hub. Ce qui existe déjà, en un coup d'œil, avec une porte vers chaque salle.
- **Colours** - ajoute des couleurs une par une, attribue des rôles ou génère une palette entière à partir d'une seule.
- **Type** - les quatre graisses que l'application, tes outils et chaque export utilisent.
- **Logos** - tes marques, dans toutes les orientations et tous les traitements.
- **Tokens** - rayon d'angle, espacement, ombres et le reste du système.
- **Files** - les fichiers image, audio et animation que conserve ta marque.

Sur un téléphone, la même liste devient une bande horizontale de puces épinglée sous l'en-tête. Changer de salle ne recharge jamais rien - l'éditeur garde tous ses panneaux montés et affiche simplement celui que tu demandes.

**Fais un lien profond vers une salle** avec `#/start?area=<key>`. Les clés sont `overview`, `color` *(remarque l'orthographe américaine dans l'URL)*, `type`, `logos`, `tokens`, `catalogue` (la salle Files - la clé du panneau est un contrat permanent, donc l'URL garde l'ancien nom) et `versions`. `?tab=` est l'alias historique pour la même chose et fonctionne toujours, donc les anciens liens et favoris continuent de marcher ; tout ce qui n'est pas reconnu ouvre Overview plutôt que de mener dans une impasse.

Épinglées **au pied du rail** se trouvent les actions qui appartiennent à l'ensemble du design system plutôt qu'à une seule salle :

- **Add from…** - le sélecteur de source, pour importer une marque depuis un fichier, un PDF, une image, une police ou un site web. Voir [Bring a brand in](#bring-a-brand-in) plus bas.
- **Tray** - les candidats qu'un scan a trouvés mais pas encore validés. Elle reste cachée tant qu'un scan n'a rien retenu, et affiche un compteur quand c'est le cas ; rien dedans ne change ta marque tant que tu n'appuies pas sur Add sur cette ligne.
- **Export** - écrit toute la marque en un seul `LollyBrand-…zip`.
- **Tokens (.json)** - le document de design tokens brut à part, pour un repo, une étape de build ou un autre outil de tokens.
- **Versions** - publie, active et restaure des copies nommées du design system. Cachée tant qu'il n'y a rien de personnel à publier (ou qu'un lien `?area=versions` la demande par son nom).

![Le rail des salles du studio - Overview, Colours, Type, Logos, Tokens et Files](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Overview

Overview est la salle où tu arrives, et elle a deux visages.

Quand **rien n'est encore configuré**, elle propose deux portes - **Start from a file** (design tokens, un projet Penpot, un pack design system ou un SVG) et **Start from scratch** (ajoute une couleur, puis continue quand tu veux) - et une sortie discrète **Explore the tools** en dessous, parce que partir est aussi une réponse légitime.

Une fois qu'un design system existe, la même salle montre **ce que tu as** : la palette et son nombre de couleurs, les familles typographiques en vigueur, combien d'emplacements de logo sont remplis, combien de tokens il y a et la salle Files. Chaque bloc est une porte vers sa salle. Il n'y a ici que des compteurs, jamais de barre de progression et jamais de carte de fin - rien n'est dû dans ce studio.

## Logos

Commence par vider ton dossier de marques dans la zone de dépôt en haut : **« Drop marks here, or choose several at once »** accepte autant de fichiers que tu en as en une seule fois. Chaque fichier est analysé pour sa forme et son encre, puis mis en attente sous **Waiting for a slot** sous forme de puce qui indique son hypothèse - *« Looks like the Horizontal primary »*, avec la mesure sur laquelle elle s'est basée, et un bouton **Place** (**Replace**, quand cet emplacement est déjà rempli). Quand elle n'est pas sûre, la puce le dit clairement et propose plutôt **Change slot**, qui liste les huit emplacements. Rien n'est placé tant que tu n'appuies pas sur quelque chose.

Deux choses se passent autour de cette file. Une marque avec une marge vide en excès reçoit d'abord une **offre de recadrage** - réponds-y ou appuie sur Échap et le fichier original est utilisé tel quel. Et quand une marque peut alimenter un emplacement frère vide, la salle propose la version **mono** ou **reverse** dérivée comme sa propre puce, marquée *Generated*, qui disparaît de nouveau si tu remplis cet emplacement autrement.

En dessous se trouve la grille dans laquelle chaque marque finit - des emplacements **orientation × traitement** :

- **Orientations :** Horizontal (wordmark + symbole en ligne) et Vertical (empilé, pour les espaces carrés et hauts).
- **Traitements :** Primary, Primary reverse (pour les fonds sombres), Mono (une couleur) et Mono reverse.

Cela fait huit emplacements optionnels. Clique sur un emplacement pour ajouter un PNG, SVG, JPEG ou WebP ; clique sur un emplacement rempli pour le remplacer. Chaque emplacement est optionnel et tout reste sur cet appareil.

![La matrice de logos - chaque orientation en haut, chaque traitement comme son propre emplacement en pointillés, tous optionnels](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** - ajoute des marques que ta marque nomme à sa façon (une icône, un blason, un favicon) sous **Custom marks** ; nomme-la et choisis un fichier.
- **More identities** - une sous-marque, un produit ou un événement peut avoir son propre jeu complet de logos. Utilise **+ Add another logo** et nomme-le ; ton jeu principal s'appelle simplement "Your logo".
- **Téléverse un SVG et Lolly lit ses couleurs.** Sur une toute nouvelle installation, elle règle discrètement ta couleur primaire à partir du logo et te le signale. Sur une marque existante, elle propose plutôt la couleur comme suggestion - *« Found in the logo: #… »* avec un bouton **Use as primary** à côté - dans la salle Colours, où tu peux l'accepter ou l'ignorer.

## Colours

![The Colours room after one colour - the two panes back, the generate offer, roles reading in three registers and the pane at one colour](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

La salle la plus riche, en deux volets. Celui de gauche est où tu travailles ; celui de droite est ta **palette en direct**. Fais glisser le séparateur entre les deux pour redimensionner (Entrée dessus replie la palette hors du chemin).

![La salle Colours - une couleur primaire dérive des rampes, des cartes spécimen avec des ratios de contraste et une palette en direct](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Ajoute une couleur, puis donne-lui un rôle

**Add a colour** est tout le chemin simple : colle ou choisis une couleur dans n'importe quelle notation et elle devient exactement un token. Rien n'en est dérivé, rien ne t'est suggéré, rien d'autre n'est exigé. Colle une *liste* entière de couleurs et chacune devient une puce que tu peux ajouter séparément.

**Roles** est la couche par-dessus - quelle couleur joue quel rôle. Les rôles sont optionnels (un design system de trois couleurs libres et sans rôles en est un parfaitement valable), n'importe quel échantillon peut en prendre un et la mesure de contraste se calcule par rapport à la surface, APCA en premier.

### Les ailes expertes

Quatre sections repliées se trouvent sous ces deux-là. Ouvre celle que tu veux ; chacune est reliable en profondeur via `#/start?area=color&focus=<wing>` :

- **Generate a starter palette** (`focus=generate`) - une couleur transformée en un jeu complet de nuances. Décrit plus bas.
- **Shade curves** (`focus=curves`) - remodèle une rampe point par point. Luminosité, chroma et teinte ont chacun leur propre courbe, sélectionnée avec L / C / H, et les nuances en dessous se recalculent en direct pendant que tu fais glisser.
- **Contrast** (`focus=contrast`) - **Contrast-lock** rétonalise une rampe pour atteindre des cibles APCA par rapport à un fond que tu choisis, chaque étape gardant sa propre teinte et son propre chroma ; **Rotate hue** fait tourner toute la rampe autour de la roue, chaque nuance gardant sa luminosité et son chroma.
- **Print** (`focus=print`) - ce que la couleur primaire devient sur presse : sa valeur écran automatique, ou une version CMYK figée ou une encre ton direct nommée à la place.

### Une couleur, une palette entière

Dans **Generate a starter palette**, choisis une **Primary colour** et Lolly calcule une palette complète - surfaces claires et sombres, texte, accents et rampes complètes de teintes/nuances - en utilisant les mêmes mathématiques de couleur perceptuelle (OKLCH) que le moteur utilise partout. Ajuste la dérivation :

- **Scheme** - Mono, Complement, Analogous ou Triad - définit la relation entre la couleur secondaire et ta couleur primaire.
- **Shades** - un curseur de 3 à 20 (5 par défaut) contrôle le nombre d'étapes que chaque rampe génère.
- **Fine-tune** (repliée) - **UI intensity** (Muted / Deep), **Contrast** (Comfort / High) et **Text on brand** (Auto / Light / Dark).

Rien dans cette aile n'écrit quoi que ce soit dans ta marque. C'est un aperçu, en direct dans toute l'application pour que tu puisses en juger, jusqu'à ce que tu appuies sur **Replace palette** (ci-dessous).

Sous la couleur primaire, tu verras en direct les rampes **Primary / Neutral / Secondary / Blend** et des cartes spécimen Light et Dark, chacune portant sa propre mesure de contraste - le ratio WCAG avec le chiffre APCA `Lc` à côté. **Clique sur une étape de la rampe Neutral ou Secondary** pour ancrer cette nuance à la place de la valeur dérivée par défaut.

![Les quatre rampes empilées au-dessus des cartes de spécimens clairs et sombres, chaque carte portant son propre ratio de contraste WCAG](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Construis ta palette (générateur d'harmonies)

Toujours dans la même aile, **Construis ta palette** génère des couleurs d'accent assorties à partir de ta couleur primaire. Choisis une **Harmonie** - **Complémentaire**, **Adjacente**, **Triade**, **Tétrade** ou **Analogue** (qui apporte son propre nombre d'**Accents**, de 2 à 5, et un **Angle** de teinte de 10° à 45°) - et chaque candidate arrive avec un nom lisible généré automatiquement et un bouton **+ Ajouter**. En ajouter une place cette couleur dans ta palette immédiatement, une pression pour un token. *"Ta palette, appliquée"* prévisualise l'ensemble sur de vrais graphiques.

![Accents générés, chacun avec un échantillon, un nom généré automatiquement, son code hexadécimal et un bouton Ajouter](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Valider une palette générée

**Remplacer la palette** est le seul contrôle de cette aile qui écrit quoi que ce soit, et il n'écrit jamais tout de suite. Appuie dessus et une carte de révision s'ouvre d'abord, intitulée **"Remplacer la palette ?"**, détaillant exactement ce qui va se passer : combien de rôles restent tels que tu les as attribués, combien de couleurs que tu as ajoutées toi-même sont conservées, combien de courbes de nuances sont réancrées, combien de verrous d'impression sont repinglés, combien de nuances cachées restent cachées, combien de points de dégradé conservent leur couleur.

**Remplacer la palette** sur cette carte le valide ; **Annuler** s'en va sans rien changer. Une fois l'opération faite, la carte devient **"Palette remplacée."** avec un seul **Annuler** déjà en focus - et un point de contrôle de tout le système de design est pris *avant* l'échange, si bien que "remettre les choses comme avant" est une restauration plutôt qu'un après-midi perdu.

### La palette, le graphique et chaque échantillon

Le panneau de droite liste toutes les couleurs que porte ta marque, groupées (Primaire, Neutre, Secondaire, Spectre, Personnalisé, Rôles), chaque groupe étant repliable avec son propre **+ Ajouter**. En dessous, **Graphique de couleur** se déplie sur deux vues des mêmes échantillons : la **Roue** (la roue OKLCH - fais glisser un point pour le recolorer, clique sur un point pour l'éditer ou clique sur un espace vide pour déposer un nouvel échantillon) et le graphique **Gamme**, qui montre où s'arrête réellement la plage affichable. `#/start?area=color&focus=chart` ouvre directement la carte, comme `?wheel` l'a toujours fait.

![Le panneau de palette, chaque groupe repliable, avec la pastille de téléchargement calée sur son bord inférieur](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![La roue OKLCH - l'angle est la teinte, la distance vers l'extérieur est la chroma et les gris suivent un rail de luminosité sur le côté](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Clique sur n'importe quel échantillon pour ouvrir son éditeur :

- **Renomme**-le.
- **Définis la couleur** - le sélecteur s'ouvre sur des curseurs perceptuels **OKLCH**, avec des modes **Hex**, **HSL**, **RGB** et **CMYK** ; le champ de valeur lit *et* écrit dans l'espace actif, donc tu peux coller un code hexadécimal ou saisir des pourcentages d'encre. Notons que saisir du CMYK définit la couleur *à l'écran* par conversion - pour figer des encres exactes, utilise le verrou d'impression ci-dessous.
- **Stocké comme** - choisis comment l'échantillon est persisté : **LCH** (par défaut - perceptuel, large gamme, le meilleur choix pour l'édition), Hex, RGB ou HSL. Passe outre quand tu dois figer un code hexadécimal historique exact ou faire correspondre une valeur sRGB.
- **Utiliser comme** - attribue directement à cet échantillon l'un des rôles de la marque, sans repasser par le panneau Rôles. (La tuile d'un rôle ne le propose pas - un rôle ne peut pas prendre un rôle.)
- **Substituts d'impression** (repliés) - verrouille le comportement d'impression de la couleur :
  - **CMYK** - passe de **Auto** à **Verrouillé** pour remplacer la conversion automatique sRGB→CMYK par des valeurs d'encre exactes (C/M/J/N, 0-100).
  - **Couleur ton direct** - passe de **Aucune** à **Définie** pour verrouiller l'échantillon sur une couleur ton direct ; donne-lui un **Nom** (par ex. `PANTONE 186 C`), un **Nuancier** optionnel et une **Finition** optionnelle (Encre ordinaire par défaut) pour le cas où l'encre n'en est pas une - une dorure, un gaufrage en relief ou en creux, un vernis sélectif, un toucher doux ou une découpe, un rainage ou une perforation.
- **Dans d'autres espaces** (repliés) - la même idée élargie : chaque ligne est un espace dans lequel cet échantillon peut être exprimé, soit dérivé de la valeur canonique, soit défini par toi, et une valeur définie par toi l'emporte à l'export.

Ces verrous d'impression sont ce qu'utilise une presse quand tu exportes un PDF ou un TIFF en CMYK - voir [Exporter](/info/exporting.html#colour-profiles).

**Supprimer un échantillon** est sans risque : les étapes de rampe dérivées et les rôles de thème sont *masqués* (le token sous-jacent continue de se résoudre, donc rien en aval ne casse), tandis que les couleurs que tu as ajoutées toi-même sont supprimées pour de bon.

### Dégradés

Un panneau **Dégradés** optionnel construit des tokens de mélange à partir de ta palette pour les fonds et les accents. Ignore-le entièrement si ta marque ne fait pas de dégradés. Chaque dégradé a un aperçu, des points nommés (2 à 8) et un angle. Le comportement clé : **un point référence un échantillon**, donc recolore cet échantillon et le dégradé suit. L'interpolation se fait en OKLCH pour des mélanges propres. Supprime un point pour raccourcir la séquence.

### Emporte la palette ailleurs

La pastille flottante calée sur le bord inférieur du panneau de palette télécharge la palette entière en **Design tokens (JSON)**, **variables CSS**, **classes CSS**, **variables SCSS**, une **palette GIMP (.gpl)** ou un **Adobe Swatch Exchange (.ase)** - de quoi faire tomber la marque directement dans Illustrator, Figma, GIMP ou une feuille de style. Elle se tient hors du défilement du panneau, donc elle garde sa place quelle que soit la distance à laquelle la palette défile. (Tu peux aussi télécharger la palette depuis la vue [Catalogue](/info/using.html).)

## Typographie

![The compare stage open under its card, with the search row, the pinned families and the cards folded to a one-line strip](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

La salle s'ouvre sur **quatre cartes de rôle** - les quatre polices que l'application, tes outils et chaque export lisent réellement. Chaque carte montre ce qui sert ce rôle en ce moment, composé dans cette police, avec une ligne de vrai texte en dessous :

- **Primaire** - le texte courant, les boutons et chaque outil.
- **Titres** - la police d'affichage pour `h1`/`h2`.
- **Code** - une police à chasse fixe pour le code et les données.
- **Italique** - un véritable compagnon italique pour l'emphase, les citations et les asides.

Titres, code et italique retombent chacun sur la primaire tant que tu ne les as pas attribués, donc une marque à une seule police n'a ici aucune décision à prendre. Rien sur une carte ne valide quoi que ce soit : **Changer** (ou **Choisir une police** sur un rôle vide) ouvre la **scène de comparaison** limitée à ce rôle.

![La salle Typographie - les cartes de rôle et un spécimen vivant de chaque police en action](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

### La scène de comparaison

La scène s'ouvre **en ligne dans la salle**, pas dans une boîte de dialogue, si bien que les cartes d'où tu viens restent à l'écran. Recherche une famille Google Fonts (Inter, Fraunces, Space Grotesk...) ou dépose un fichier de police, appuie sur **Ajouter à la comparaison** et les candidates se retrouvent côte à côte dans les mêmes mots avant qu'aucune ne s'installe. Échap annule et rend le clavier à la carte depuis laquelle tu l'as ouverte.

C'est la seule porte d'entrée, c'est pourquoi rien n'entre dans ta marque sans être vu. Sous la scène se trouvent les deux panneaux de gestion :

- **Polices sur cet appareil** - chaque famille installée, les rôles qu'elle sert et une suppression. **Ajouter une police** ici ouvre la même scène de comparaison sans restriction.
- **Tes polices** - téléverse un **TTF**, **OTF** ou **WOFF** depuis ta propre machine. C'est le chemin pour une police d'entreprise sous licence que tu possèdes déjà.

Dans les deux cas, la police reste sur cet appareil, s'affiche dans l'application, dans tes outils et dans chaque export, hors ligne pour toujours, et voyage dans ton pack de marque - rien n'est récupéré au moment du rendu. Tout ce qui vient de Google Fonts est distribué sous licence ouverte (OFL/Apache/UFL).

Le panneau **Rôles typographiques** en bas montre un spécimen vivant de chaque rôle - le texte courant et l'interface dans la primaire, une police d'affichage optionnelle pour les titres principaux, une italique pour l'emphase, une police à chasse fixe pour le code et les données - pour que tu voies l'ensemble fonctionner ensemble.

![Le spécimen Rôles typographiques - titre, texte courant, italique et code, chacun composé dans la police vers laquelle ce rôle se résout, avec le nom de la police à côté](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

## Tokens

Le reste du système de design, éditable sans toucher au code :

![La salle Tokens - un curseur de rayon d'angle plus l'espacement, le dimensionnement, les ombres et le reste du système](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Coins arrondis** - un curseur de rayon unique (0-1,5rem) que suivent les cartes, boutons et panneaux dans toute l'application.
- **Plus de tokens** - ajoute et édite l'**espacement**, le **dimensionnement**, l'**épaisseur de trait**, l'**opacité**, la **rotation**, des **nombres** simples et des **ombres**. Choisis un type, nomme-le (*Gouttière, Ombre de carte...*) et définis sa valeur. Ce sont des [design tokens](/info/design-tokens.html) standards (DTCG) stockés ainsi, qui voyagent avec ta marque.

## Fichiers

Dépose ici les fichiers que ta marque conserve - hormis les logos : ressources **vectorielles**, **image**, **audio** et **animation** (vidéo, Lottie, animée). Elles atterrissent dans ton [Catalogue](/info/using.html), triées en sections et prêtes dans le sélecteur d'assets de chaque outil. Tout reste sur cet appareil. (Le rail nomme la salle **Fichiers** ; la clé d'URL reste `catalogue`, car une clé de panneau est un contrat permanent.)

## Faire entrer une marque

**Ajouter depuis...** en bas du rail ouvre un sélecteur en deux étapes. La première étape demande ce que tu *as*, pas le format que c'est :

- **Design tokens ou un fichier de design** - JSON DTCG ou Tokens Studio, un projet Penpot, un **zip de sets de tokens**, un pack de système de design Lolly ou un SVG.
- **PDF** - un deck ou un fichier de directives, lu sur cet appareil pour ses couleurs, ses repères et ses polices intégrées.
- **Image** - une capture d'écran ou une photo ; ses couleurs sont lues sur cet appareil et rien n'est téléversé.
- **Fichier de police** - TTF, OTF ou WOFF. Ouvre la salle Typographie, où la police s'installe.
- **Site web** - une page, lue pour ses couleurs et sa typographie. Cette tuile n'apparaît que sur un appareil qui peut réellement lire une page, car une tuile désactivée annonçant quelque chose que personne ne peut presser est pire que pas de tuile du tout. Là où elle apparaît, elle nomme clairement son lecteur : récupérée par l'application sur cet appareil, ou lue via l'extension navigateur dans un onglet en arrière-plan, connectée en tant que toi. Saisir une URL ne fait que *pré-remplir* le champ - le bouton de récupération est le consentement, donc un lien que quelqu'un t'envoie ne peut jamais démarrer une lecture.

Choisis la source fichier de design et la seconde étape est la carte ci-dessous : les formats acceptés mènent en tuiles avec icône par ordre de préférence, et la carte entière est une seule zone de dépôt - clique n'importe où dessus ou glisse un fichier dessus. Tu peux aussi déposer un fichier directement sur le studio.

![La carte d'import - les formats acceptés mènent en tuiles avec icône, et la carte entière est une seule zone de dépôt](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

Ce que chaque fichier de design t'apporte :

- un pack **LollyBrand** (`.zip`) - s'installe en une étape ;
- un export **Penpot** (`.penpot`) - récupère ses design tokens ;
- un fichier **Design Tokens** (`.json`) - W3C DTCG ;
- un fichier **Tokens Studio** (`.json`) - Tokens Studio ;
- un **SVG simple** (`.svg`) - Lolly scanne ses couleurs et te laisse choisir lesquelles garder, la première devenant ta primaire.

Une installation depuis une source prend d'abord un **point de contrôle**, donc "revenir à avant l'import" tient en une restauration. Et ce qu'un scan trouve ne rentre pas directement : les candidats atterrissent dans le **Tray**, où chacun est ajouté par sa propre pression, via la salle qui possède ce type de matériau.

`#/start?source=<kind>` ouvre le sélecteur sur une source donnée (`file`, `pdf`, `image`, `font`, `url`), et `?import` l'ouvre sur la liste simple.

## Déplacer une marque entre appareils

**Exporter** en bas du rail écrit un seul **`LollyBrand-…zip`** - tes tokens, polices, logos et préférence de thème, avec un manifeste d'intégrité vérifié au retour. À côté, **Tokens (.json)** écrit le document de design tokens seul : ni polices, ni logos, juste les tokens, ce que lit réellement un dépôt, une étape CI ou un autre outil de tokens.

Faire revenir une marque se fait via **Ajouter depuis... → Design tokens ou un fichier de design** (ci-dessus), ou par glisser-déposer sur le studio. C'est ainsi qu'un collègue te transmet une marque, ou que tu en emportes une vers une seconde installation - sans compte, sans cloud. Pour faire entrer une marque depuis la ligne de commande, voir [`ingest:brand`](/info/configuration.html#brand-packs).

## Versions

**Versions**, au pied de la barre, c'est là qu'un design system arrête d'être une cible mouvante. Publie-en une et tu obtiens une **copie permanente et nommée** conservée sur cet appareil : elle ne change plus jamais ensuite, donc un outil qui l'épingle continue de dessiner la même chose. Le panneau reste masqué tant qu'il n'y a rien à toi à publier, donc un studio qui ne publie jamais ne voit jamais les contrôles.

Trois choses à savoir avant d'appuyer sur quoi que ce soit, et le panneau annonce les trois avant l'action plutôt qu'après :

- **Une version est permanente.** Il n'y a pas encore de suppression, donc le panneau indique ce qui a été conservé et que ça reste conservé plutôt que de proposer un bouton qui mentirait.
- **Les suppressions sont en tête de la carte de compatibilité.** Les tokens ajoutés et modifiés sont des nouveautés ; un token *supprimé* est ce qui casse un outil, donc il est nommé en premier et appelé par son nom.
- **Publier ne peut pas être annulé ; restaurer, si.** *Restaurer le dernier état depuis cette version* est une modification ordinaire de la tête, donc ça atterrit sur la pile d'annulation du studio et le panneau t'offre aussitôt le bouton **Annuler**.

Tu peux **Publish only**, ou **Publish and make active** - la différence étant que les outils et l'app suivent désormais cette version ou continuent de suivre ta dernière modification. **Follow the latest again** met chaque modification en ligne dès qu'elle est faite. `#/start?area=versions` ouvre le panneau directement.

## Quand la marque est fixe

Certaines versions livrent une **marque verrouillée** - ses couleurs, polices et tokens sont ce que chaque outil et export utilisent, et il n'y a rien à changer. Dans ce cas, le studio est remplacé par une courte note expliquant que cette version est livrée avec une marque fixe et que l'édition est désactivée. C'est délibéré : c'est comme ça qu'une organisation garantit que tout reste conforme à la marque.

## Où aller ensuite

- **[Using Lolly](/info/using.html)** - le canevas, la sauvegarde, les projets et le catalogue.
- **[Design Tokens](/info/design-tokens.html)** - le modèle de tokens dans lequel ta marque est exprimée.
- **[Exporting & formats](/info/exporting.html)** - unités d'impression, CMJN et les formats dans lesquels ta marque s'exporte.
