# Le Brand Studio

Le **Brand Studio** sur `#/start` est l'endroit unique où tu façonnes ta marque - ses logos, ses couleurs, sa typographie, le reste de tes tokens et les fichiers qu'elle conserve. Configure-le ici une fois et chaque outil, page et export le suit *par construction*, pas par relecture.

Les modifications se prévisualisent **en direct dans toute l'application** au fur et à mesure, pour que tu voies une couleur ou une police se répercuter partout avant de la valider. Tout se passe sur l'appareil : tes fichiers de marque et tes tokens ne quittent jamais ta machine (choisir une Google Font récupère cette famille chez Google, une fois, après une boîte de dialogue de consentement), et la marque voyage dans un seul fichier [brand pack](#move-a-brand-between-devices).

> **Ceci est l'éditeur. Le dashboard est le miroir.** L'onglet **Design system** du Dashboard (`#/d`) *affiche* ta marque en lecture seule ; tu l'*édites* ici, sur `#/start`. Si tu veux changer une couleur plus tard, reviens dans le Brand Studio.

## Les salles

Le studio est un ensemble de **salles** listées dans un rail sur le côté - pas des étapes. Rien n'est numéroté, rien n'est conditionné à autre chose et arriver dans n'importe laquelle d'entre elles est légitime :

- **Vue d'ensemble** - le point central. Ce qui existe déjà, en un coup d'œil, avec une porte vers chaque salle.
- **Couleurs** - ajoute des couleurs une par une, attribue des rôles ou génère une palette entière à partir d'une seule.
- **Typographie** - les quatre graisses que l'application, les outils et chaque export lisent.
- **Logos** - tes marques, dans toutes les orientations et tous les traitements.
- **Tokens** - rayon d'angle, espacement, ombres et le reste du système.
- **Fichiers** - les fichiers image, audio et animation que conserve ta marque.

Sur un téléphone, la même liste devient une bande horizontale de puces épinglée sous l'en-tête. Changer de salle ne recharge jamais rien - l'éditeur garde tous ses panneaux montés et affiche simplement celui que tu demandes.

**Fais un lien profond vers une salle** avec `#/start?area=<key>`. Les clés sont `overview`, `color` *(remarque l'orthographe américaine dans l'URL)*, `type`, `logos`, `tokens`, `catalogue` (la salle Files - la clé du panneau est un contrat permanent, donc l'URL garde l'ancien nom) et `versions`. `?tab=` est l'alias historique pour la même chose et fonctionne toujours, donc les anciens liens et favoris continuent de marcher ; tout ce qui n'est pas reconnu ouvre Overview plutôt que de mener dans une impasse.

Épinglées **au pied du rail** se trouvent les actions qui appartiennent à l'ensemble du design system plutôt qu'à une seule salle :

- **Add from…** - le sélecteur de source, pour importer une marque depuis un fichier, un PDF, une image, une police ou un site web. Voir [Bring a brand in](#bring-a-brand-in) plus bas.
- **Tray** - les candidats qu'un scan a trouvés mais pas encore validés. Elle reste cachée tant qu'un scan n'a rien retenu, et affiche un compteur quand c'est le cas ; rien dedans ne change ta marque tant que tu n'appuies pas sur Add sur cette ligne.
- **Export** - écrit tout le design system en un seul `LollyBrand-….lolly`.
- **Tokens (.json)** - le document de design tokens brut à part, pour un repo, une étape de build ou un autre outil de tokens.
- **Restore brand settings** - revient à un point de contrôle enregistré avant un import ou un remplacement des réglages de marque.
- **Versions** - publie, active et restaure des copies nommées du design system. Cachée tant qu'il n'y a rien de personnel à publier (ou qu'un lien `?area=versions` la demande par son nom).

![Le rail des salles du studio - Overview, Colours, Type, Logos, Tokens et Files](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Overview

Overview est la première salle, et elle a deux visages.

Avec **rien encore choisi**, elle dit **Personnalise-le**. **Start from a reference** ouvre le sélecteur de source pour un logo, une capture d'écran, une page web ou un fichier de design. **Choisir une couleur**, **Choisir une graisse** et **Ajouter un logo** ouvrent directement leurs contrôles existants. Chaque piste commence par un choix ; en ouvrir une n'écrit rien. **Explorer les outils** est disponible immédiatement.

Une fois qu'autre chose t'appartient, la même salle montre **ce que tu as**, menée par les compteurs que tu as créés. Colours indique le nombre de couleurs que porte le design system, et ajoute un `· N starter` discret seulement là où des couleurs héritées sont visibles ; la bande à côté place d'abord les couleurs que tu as choisies, puis un filet et les couleurs de départ estompées. Typographie se lit par rôle (*Inter pour les titres*, avec *Starter pour le reste · SUSE, SUSE Mono* en dessous). Logos indique combien d'emplacements sont remplis, ou **Non défini**. Tokens porte le rayon d'angle, marqué *starter* tant que tu ne le déplaces pas. Fichiers dit **Rien pour l'instant** tant que la bibliothèque est vide. Chaque bloc est une porte vers sa salle. Il n'y a ici que des compteurs, jamais de barre de progression et jamais de carte de fin - rien n'est dû dans ce studio.

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

La salle grandit avec le design system. Rien de ce dont tu n'as pas encore eu besoin ne figure sur la page, si bien qu'une première visite est une seule décision et que le reste arrive à mesure que la palette grandit.

### La première couleur

Un design system sans couleur propre s'ouvre sur une seule colonne centrée : **Commence avec une couleur**, une grande puce active, un champ, et une ligne discrète disant que les rôles, les nuances et les réglages d'impression arrivent à mesure que le système grandit.

- **La puce est le sélecteur.** Appuie dessus et la carte OKLCH propre au studio s'ouvre sur la puce, préremplie avec ce que contient le champ : un nom, la roue, les quatre curseurs, l'alpha et **Stocké comme**, avec **Annuler** et **Ajouter une couleur** au pied. Faire glisser un curseur peint la puce et réécrit le champ au fur et à mesure, et rien n'atteint le design system avant que tu appuies sur **Ajouter une couleur**.
- **Le champ accepte n'importe quelle notation** - `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` ou un simple nom de couleur - et une *liste* entière de couleurs devient une rangée de puces que tu ajoutes une par une.
- **Deux autres portes se trouvent à côté.** La pipette (sur un navigateur qui en a une) prélève une couleur sur l'écran, et **Depuis une image** lit une capture d'écran ou une photo sur cet appareil et propose les couleurs qu'elle y trouve.
- **Ajouter n'est jamais désactivé.** Sans rien de lisible dans le champ, ça ouvre le sélecteur, ce qu'une pression à vide signifie généralement ; un texte qu'il ne peut pas analyser reçoit une ligne sous le champ qui le dit, plutôt qu'un bouton mort.

La première couleur devient la **principale**, et la puce qui répond à l'ajout le dit - *« La principale est maintenant Vivid Violet »* - avec **Affiner** à côté.

![La salle Colours avec rien encore choisi - une grande puce active, un champ et une ligne sur ce qui arrive plus tard](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Starter

**Starter** est le mot pour tout ce qui est venu avec l'application au lieu d'être choisi. Une installation neuve ne porte aucune couleur du tout : ce qu'elle a, c'est une rampe neutre, de l'encre à travers le papier, pour que surfaces, texte et filets se rendent avant que quiconque ait décidé quoi que ce soit. Ces neutres sont un échafaudage, donc ils ne comptent pas comme des couleurs et ne se dessinent pas dans le panneau de palette. Ils vivent dans la salle [Tokens](#tokens) sous **Neutres · départ · 9**, avec un **Ouvrir** qui les montre dans le panneau Colours comme un groupe replié et marqué (`#/start?area=color&group=neutral`).

Le même mot se retrouve dans chaque salle : un rôle reposant sur une couleur starter se lit *« Starter Paper prend le relais »*, et son sélecteur propose **Choisir…** ; une graisse starter porte une étiquette **Starter** et aucune teinte ; un rayon d'angle starter est marqué sur l'Overview. Le matériau hérité n'est jamais dessiné avec une bordure en pointillés, parce qu'une bordure en pointillés signifie ici une zone de dépôt.

### À mesure que la palette grandit

Tes couleurs restent à côté d'un aperçu **En contexte** sur un grand écran et s'empilent au-dessus sur les écrans plus petits. L'aperçu peut montrer une affiche, un graphique ou une carte d'interface utilisant ta palette. Les couleurs starter restent dans leur propre groupe repliable, séparé des couleurs que tu ajoutes.

Ajoute des couleurs individuelles ou un jeu de nuances, attribue-leur des rôles, et ouvre les sections avancées quand tu en as besoin. Le graphique des couleurs, les dégradés et les contrôles de téléchargement restent avec la palette.

![La salle Colours après l'ajout d'une couleur, avec sa palette et un aperçu de composition en direct](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Rôles - ce que les outils lisent

Les **Rôles** sont la couche par-dessus les échantillons : quelle couleur joue quel rôle dans chaque outil et export. Les rôles sont optionnels (un design system de trois couleurs libres et sans rôles en est un parfaitement valable), n'importe quel échantillon peut en prendre un et la mesure de contraste se calcule par rapport à la surface, APCA en premier.

Une ligne se lit dans l'un de trois registres, si bien que la bande ne prétend jamais à une décision que personne n'a prise :

- une couleur propre servant le rôle, à pleine intensité ;
- **Starter *Paper* prend le relais** - discrète, avec **Choisir…** sur son sélecteur ;
- **↳ suit la principale** - le rôle se résout via la principale plutôt que vers une couleur propre.

Une fois que la palette a des nuances, la bande s'étend aux sept emplacements qu'un outil peut lire : Principale, Secondaire, Surface, Texte, Sourd, Bord et Sur la principale. Sur la principale est dérivé de la principale, se lit **Dérivé** et ne porte pas de sélecteur.

**L'accent propre de l'application est une préférence, pas un token.** Par défaut, l'interface suit le design system et l'accent du chrome prend la couleur principale. C'est un réglage d'apparence sur [ton profil](/info/profile.html) - **L'interface suit le design system** - et le désactiver laisse le chrome neutre. Les outils, les canevas et les exports ne sont affectés dans aucun des deux cas, et les polices et le rayon d'angle suivent le design system, que le réglage soit activé ou non.

### Les ailes expertes

Quatre sections repliées se trouvent sous l'aperçu de composition et les rôles de couleur. Ouvre celle que tu veux ; chacune est reliable en profondeur via `#/start?area=color&focus=<wing>`, ce qui l'ouvre quoi que la salle montre par ailleurs :

- **Explorer les nuances et harmonies** (`focus=generate`) - une couleur transformée en un jeu complet de nuances. Décrit plus bas.
- **Courbes de teinte** (`focus=curves`) - remodèle une rampe point par point. Luminosité, chroma et teinte ont chacun leur propre courbe, sélectionnée avec L / C / H, et les nuances en dessous se recalculent en direct pendant que tu fais glisser.
- **Contraste** (`focus=contrast`) - **Verrou de contraste** rétonalise une rampe pour atteindre des cibles APCA par rapport à un fond que tu choisis, chaque étape gardant sa propre teinte et son propre chroma ; **Faire pivoter la teinte** fait tourner toute la rampe autour de la roue, chaque nuance gardant sa luminosité et son chroma.
- **Imprimer** (`focus=print`) - ce que la couleur principale devient sur presse : sa valeur écran automatique, ou une version CMYK figée ou une encre ton direct nommée à la place.

### Une couleur, une palette entière

Dans **Explorer les nuances et harmonies**, choisis une **Starting colour**. Lolly suggère des nuances assorties en utilisant les mêmes mathématiques de couleur perceptuelle (OKLCH) que le moteur utilise ailleurs. Ajuste les suggestions :

- **Combinaison** - Mono, Complémentaire, Analogue ou Triade - définit la relation entre la couleur secondaire et la principale.
- **Nuances** - un curseur de 3 à 20 (5 par défaut) contrôle le nombre d'étapes que chaque rampe génère.
- **Affiner** (repliée) - **Intensité de l'interface** (Sourd / Profond), **Contraste** (Confort / Élevé) et **Texte sur la marque** (Auto / Clair / Sombre).

Changer la couleur de départ et les réglages ne change que les suggestions. Clique sur une nuance pour ajouter cette couleur, ou sur **Ajouter 5 nuances** pour ajouter un groupe (le nombre suit ton réglage Nuances). Les couleurs et rôles existants restent en place. Annuler retire l'ajout.

Les lignes **Principale**, **Neutre** et **Secondaire** montrent les nuances suggérées. Ouvre **Theme preview** pour inspecter des exemples clairs et sombres et leurs mesures de contraste. Choisis là une étape Neutre ou Secondaire pour ajuster les ancres de thème proposées. Reconstruire la palette complète reste une action séparée et relue plus bas.

![Trois groupes de nuances suggérés, avec des contrôles d'ajout individuels et un Theme preview séparé](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Construire la palette (générateur d'harmonies)

Dans **Trouver des couleurs assorties**, le générateur d'harmonies suggère des couleurs d'accent assorties à partir de la principale. Choisis une **Harmonie** - **Complementary**, **Adjacent**, **Triad**, **Tetrad** ou **Analogous** (qui apporte son propre nombre d'**Accents**, de 2 à 5, et un **Angle** de teinte de 10° à 45°) - et chaque candidate arrive avec un nom lisible généré automatiquement et un bouton **+ Ajouter**. En ajouter une place cette couleur dans la palette immédiatement, une pression pour un token. **En contexte** prévisualise tes couleurs ajoutées sur des compositions d'exemple.

![Accents générés, chacun avec un échantillon, un nom généré automatiquement, son code hexadécimal et un bouton Ajouter](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Valider une palette générée

Ajouter une couleur ou un groupe de nuances suggéré garde le reste de ta palette. Pour un remplacement complet, ouvre **Rebuild the whole palette…** et appuie sur **Preview full rebuild**. La relecture explique les changements : combien de rôles restent tels que tu les as attribués, combien de couleurs que tu as ajoutées toi-même sont conservées, combien de courbes de teinte sont réancrées, combien de verrous d'impression sont repinglés, combien de nuances cachées restent cachées, combien de points de dégradé conservent leur couleur.

**Apply rebuilt palette** sur cette carte la valide ; **Annuler** s'en va sans rien changer. Une fois l'opération effectuée, la carte propose **Annuler** avec le focus déjà dessus - et un point de contrôle de tout le design system est pris *avant* l'échange, si bien que « remettre les choses comme avant » est une restauration plutôt qu'un après-midi perdu.

### La palette, le graphique et chaque échantillon

La palette liste les couleurs du design system en groupes repliables, chacun avec son propre contrôle **+ Ajouter**. Crée et renomme des groupes pour organiser ton travail. Un rôle ne crée jamais une deuxième tuile : un token est une tuile, et une tuile vers laquelle pointe un rôle porte à la place une petite marque de coin (**P**, **S**, **Su**, **T**). Sous les tuiles, **Graphique des couleurs** se déplie sur deux vues des mêmes échantillons : la **Roue** (la roue OKLCH - fais glisser un point pour le recolorer, clique sur un point pour l'éditer ou clique sur un espace vide pour déposer un nouvel échantillon) et le graphique **Gamut**, qui montre où s'arrête réellement la plage affichable. `#/start?area=color&focus=chart` ouvre directement la carte, comme `?wheel` l'a toujours fait.

![Le panneau de palette, chaque groupe repliable, avec la pastille de téléchargement calée sur son bord inférieur](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![La roue OKLCH - l'angle est la teinte, la distance vers l'extérieur est la chroma et les gris suivent un rail de luminosité sur le côté](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

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

### Travailler avec de nombreux échantillons

Chaque échantillon a une poignée de glissement séparée. Fais-la glisser pour réordonner les couleurs au sein de son groupe, ou donne-lui le focus, appuie sur Espace, utilise les flèches, et appuie de nouveau sur Espace pour déposer. Échap annule. L'ordre survit à la réouverture du studio et peut être annulé. Pour déplacer des couleurs entre groupes, utilise le contrôle **Grouper** de l'éditeur d'échantillon ou sélectionne plusieurs couleurs et utilise **Déplacer**. Les noms de tokens et les références de rôle restent intacts.

La sélection dans le panneau de palette est un geste, pas un mode. Il n'y a pas de bouton à presser d'abord, et la barre arrive avec la première tuile sélectionnée et repart avec la dernière.

- **Fais glisser sur l'espace vide du panneau** pour tracer un rectangle : chaque tuile qu'il touche rejoint la sélection, à travers les limites de groupe. Une section repliée n'apporte rien, et un glissement qui ne bouge jamais efface la sélection.
- **Maj-clic** prend la plage dans l'ordre de lecture ; **Cmd/Ctrl-clic** bascule une tuile ; un simple clic ouvre quand même l'éditeur de cette tuile.
- Chaque en-tête de groupe porte **Tout sélectionner**, et **Cmd-A** avec une tuile ayant le focus prend toutes les couleurs que possède le design system - jamais une starter.
- La grille a un seul point d'arrêt de tabulation. Les flèches s'y déplacent, Maj-flèches étendent la sélection, Espace bascule une tuile, Suppr retire la sélection et Échap l'efface. (Les flèches ne font que déplacer le focus : pour ajuster un canal, appuie d'abord sur `l`, `c` ou `h`, comme l'indique la lecture.)
- Sur un écran tactile, il n'y a pas de rectangle. Appuie et maintiens une tuile pour démarrer une sélection, puis tape pour ajouter ; **Tout sélectionner** par groupe prend le reste.

La barre elle-même indique **{n} sélectionnés**, puis **Déplacer vers** (un groupe existant, ou un nouveau que tu nommes dans le menu), **Donner un rôle** (chaque couleur sélectionnée prend le rôle suivant à tour de rôle, si bien que quatre tuiles remplissent les quatre rôles en une pression), **Télécharger** (la sélection dans l'un des six formats de palette), **Copier les valeurs** (une ligne par couleur dans sa notation stockée) et **Supprimer**. Déplacer vers et Donner un rôle apparaissent une fois que la palette a des nuances à déplacer. Un seul Ctrl/Cmd-Z annule toute une action groupée - un déplacement de quarante, un tour de rôles, une suppression - et une suppression dit ce qu'elle a gardé, parce qu'une sélection atteint des tuiles que cette salle ne retire pas.

### Dégradés

Un panneau **Dégradés** optionnel construit des tokens de mélange à partir de la palette pour les fonds et les accents. Ignore-le entièrement si le design system ne fait pas de dégradés. Chaque dégradé a un aperçu, des points nommés (2-8) et un angle. Le comportement clé : **un point référence un échantillon**, donc recolore cet échantillon et le dégradé suit. L'interpolation se fait en OKLCH pour des mélanges propres. Supprime un point pour raccourcir la séquence.

### Emporte la palette ailleurs

La pastille flottante calée sur le bord inférieur du panneau de palette télécharge toute la palette en **Design tokens (JSON)**, **variables CSS**, **classes CSS**, **variables SCSS**, une **palette GIMP (.gpl)** ou un **Adobe Swatch Exchange (.ase)** - de quoi faire tomber le design system directement dans Illustrator, Figma, GIMP ou une feuille de style. Elle se tient hors du défilement du panneau, donc elle garde sa place quelle que soit la distance à laquelle la palette défile, et elle apparaît une fois que la palette a des nuances. (Tu peux aussi télécharger la palette depuis [Éléments](/info/using.html#assets-your-library).)

## Typographie

Cette salle grandit de la même façon. Sans graisse propre, c'est une carte et une décision : **Principale**, composée à la taille de lecture dans la graisse qui la sert aujourd'hui, une étiquette **Starter** à côté du nom, un **Choisir une graisse** rempli et la ligne « Rien ne s'installe tant que tu n'en as pas choisi une. » Sous la carte se trouve « Les titres, le code et l'italique retombent sur la principale tant que tu ne les as pas attribués », avec **Les choisir séparément** qui révèle les trois autres cartes pour le reste de la visite.

![La salle Typographie sans graisse choisie pour l'instant - une carte à la taille de lecture, une étiquette Starter dessus, et un Choisir une graisse rempli](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Choisis une graisse et la salle s'ouvre sur **quatre cartes de rôle**, la liste des polices et le spécimen en direct. Les quatre graisses sont celles que l'application, les outils et chaque export lisent réellement :

- **Primaire** - le texte courant, les boutons et chaque outil.
- **Titres** - la police d'affichage pour `h1`/`h2`.
- **Code** - une police à chasse fixe pour le code et les données.
- **Italique** - un véritable compagnon italique pour l'emphase, les citations et les asides.

Titres, code et italique retombent chacun sur la principale tant que tu ne les as pas attribués, donc un design system à une seule police n'a ici aucune décision à prendre.

**Une teinte signifie que tu l'as choisie.** Une carte n'est teintée que là où tu as installé cette graisse. Une graisse starter porte la même étiquette **Starter** que les groupes hérités de la palette, dans le registre discret et sans teinte, et un rôle que personne n'a choisi se lit **↳ suit la principale** plutôt que de répéter le nom de la principale comme s'il avait été choisi. Le bouton dit **Modifier** sur une graisse à toi et **Choisir une graisse** partout ailleurs. Rien sur une carte ne valide quoi que ce soit : le bouton ouvre la **scène de comparaison** limitée à ce rôle.

![Les quatre cartes de rôle révélées - chacune composée dans la graisse qui la sert, avec une étiquette Starter là où personne n'en a choisi une, et l'italique qui suit la principale](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### La scène de comparaison

![La scène de comparaison ouverte sous sa carte, avec la ligne de recherche, les familles épinglées et les cartes repliées en un bandeau d'une ligne](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

La scène s'ouvre **en ligne dans la salle**, pas dans une boîte de dialogue, et directement sous la carte sur laquelle tu as appuyé. Tant qu'elle est ouverte, les cartes se replient en un bandeau d'une ligne de rôle et de graisse, si bien que la scène tient sur le premier écran même sur un téléphone. Échap annule et rend le clavier à la carte depuis laquelle tu l'as ouverte.

Choisir une graisse tient en trois pressions :

1. **Choisir une graisse** sur la carte.
2. Tape un nom de famille et appuie sur **Aperçu** - ou appuie sur l'une des six familles **Épinglé** sous le champ, une pression chacune. La carte apparaît déjà en chargement, avec une barre squelette là où sera le spécimen, à la place de la graisse de l'interface qui tient lieu d'une graisse que tu n'as pas encore vue.
3. **Utiliser cette graisse**.

**Le consentement est demandé une fois, sur la pression que tu as faite.** La première fois qu'un aperçu atteint Google Fonts, une boîte de dialogue dit ce qui se passe : *Google apprend le nom de la famille et ton adresse IP. Le fichier est ensuite conservé sur cet appareil et utilisé hors ligne. C'est la seule étape du studio qui contacte un tiers.* **Récupérer depuis Google** continue et est mémorisé. **Annuler** laisse la carte dire *« Non récupéré. Rien n'a été envoyé à Google. »* avec son propre **Récupérer depuis Google** toujours actif, si bien que changer d'avis est une pression sur la carte elle-même. Aucune carte ne montre jamais de bouton mort : quel que soit son état, son unique bouton principal dit quelle est la prochaine étape.

**Dépose un fichier de police sur la scène** et il se prévisualise aussitôt - **TTF**, **OTF** ou **WOFF** depuis ta propre machine, ce qui est le chemin pour une police d'entreprise sous licence que tu possèdes déjà. Cette zone de dépôt est la seule porte de fichier dans la salle.

Dans les deux cas, la graisse reste sur cet appareil, s'affiche dans l'application, dans les outils et dans chaque export, hors ligne pour toujours, et voyage dans le fichier du design system - rien n'est récupéré au moment du rendu. Tout ce qui vient de Google Fonts est distribué sous licence ouverte (OFL/Apache/UFL).

### Polices sur cet appareil

Le panneau **Polices** liste chaque graisse que possède cet appareil et le rôle qu'elle sert. Les graisses que tu as ajoutées viennent en tête sous **In the design system**, chacune avec ses rôles et une suppression, et celle qui sert Principale porte le badge. Les graisses starter suivent dans une ligne repliée - *Starter · SUSE, SUSE Mono · sert Principale et Code tant que tu ne choisis pas* - discrète, sans suppression et sans rien à promouvoir, parce qu'aucune des deux n'est une décision que quiconque a prise. **Ajouter une graisse** ouvre la même scène de comparaison sans restriction.

Le panneau **Rôles typographiques** en bas montre un spécimen vivant de chaque rôle - le texte courant et l'interface dans la principale, une police d'affichage optionnelle pour les titres principaux, une italique pour l'emphase, une police à chasse fixe pour le code et les données - avec la famille et son état à côté de chacune (*Inter*, *SUSE · starter*, *SUSE · suit la principale*), pour que l'ensemble puisse se lire d'un coup.

## Tokens

Le reste du système de design, éditable sans toucher au code :

![La salle Tokens - un curseur de rayon d'angle plus l'espacement, le dimensionnement, les ombres et le reste du système](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Coins arrondis** - un curseur de rayon unique (0-1,5rem) que suivent les cartes, boutons et panneaux dans toute l'application.
- **Neutres** - la rampe d'encre à travers le papier livrée avec une installation neuve, listée comme **Neutres · départ · 9** avec ses neuf étapes et un **Ouvrir** vers le panneau Colours. C'est le seul endroit où les neutres starter sont gérés, et l'étiquette *starter* disparaît au moment où la rampe est générée plutôt qu'héritée.
- **Plus de tokens** - ajoute et édite l'**espacement**, le **dimensionnement**, l'**épaisseur de trait**, l'**opacité**, la **rotation**, des **nombres** simples et des **ombres**. Choisis un type, nomme-le (*Gouttière, Ombre de carte...*) et définis sa valeur. Ce sont des [design tokens](/info/design-tokens.html) standards (DTCG) stockés ainsi, qui voyagent avec le design system.

## Fichiers

Dépose ici les fichiers que ta marque conserve - hormis les logos : ressources **vectorielles**, **image**, **audio** et **animation** (vidéo, Lottie, animée). Elles atterrissent dans [Éléments](/info/using.html#assets-your-library), triées en sections et prêtes dans le sélecteur d'assets de chaque outil. Tout reste sur cet appareil. (Le rail nomme la salle **Fichiers** ; la clé d'URL reste `catalogue`, car une clé de panneau est un contrat permanent.)

## Faire entrer une marque

**Ajouter depuis...** en bas du rail ouvre un sélecteur en deux étapes. La première étape demande ce que tu *as*, pas le format que c'est :

- **Design tokens ou un fichier de design** - JSON DTCG ou Tokens Studio, un projet Penpot, un **zip de sets de tokens**, un pack de système de design Lolly ou un SVG.
- **PDF** - un deck ou un fichier de directives, lu sur cet appareil pour ses couleurs, ses repères et ses polices intégrées.
- **Logo ou capture d'écran** - une image devient une palette suggérée, lue sur cet appareil. Rien n'est téléversé. Ça lit les couleurs, pas la police ou la mise en page dans l'image.
- **Page web enregistrée** - choisis un fichier HTML et ses fichiers CSS, ou colle du HTML ou du CSS. Jusqu'à 20 fichiers et 2 Mo au total. Seul le texte fourni est lu ; les ressources liées ne sont pas récupérées et les scripts ne s'exécutent pas. Ce chemin fonctionne aussi sans l'extension ni l'application de bureau.
- **Fichier de police** - TTF, OTF ou WOFF. Ouvre la salle Typographie, où la police s'installe.
- **Site web** - une page, lue pour ses couleurs et sa typographie. Cette tuile n'apparaît que sur un appareil qui peut réellement lire une page, car une tuile désactivée annonçant quelque chose que personne ne peut presser est pire que pas de tuile du tout. Là où elle apparaît, elle nomme clairement son lecteur : récupérée par l'application sur cet appareil, ou lue via l'extension navigateur dans un onglet en arrière-plan, connectée en tant que toi. Saisir une URL ne fait que *pré-remplir* le champ - le bouton de récupération est le consentement, donc un lien que quelqu'un t'envoie ne peut jamais démarrer une lecture.

Choisis la source fichier de design et la seconde étape est la carte ci-dessous : les formats acceptés mènent en tuiles avec icône par ordre de préférence, et la carte entière est une seule zone de dépôt - clique n'importe où dessus ou glisse un fichier dessus. Tu peux aussi déposer un fichier directement sur le studio.

![La carte d'import - les formats acceptés mènent en tuiles avec icône, et la carte entière est une seule zone de dépôt](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

Ce que chaque fichier de design t'apporte :

- un **pack de système de design Lolly** (`.lolly` ; l'ancienne forme `.zip` est toujours acceptée) - s'installe en une étape ;
- un export **Penpot** (`.penpot`) - récupère ses design tokens ;
- un fichier **Design Tokens** (`.json`) - W3C DTCG ;
- un fichier **Tokens Studio** (`.json`) - Tokens Studio ;
- un **SVG simple** (`.svg`) - Lolly scanne ses couleurs et te laisse choisir lesquelles garder, la première devenant ta primaire.

Un logo/screenshot, un site web ou une page enregistrée ouvre **Your suggested design system**. Regarde un exemple utilisant les couleurs proposées, choisis une **Main colour** différente si besoin, et nomme le système. **Use this design system** applique les palettes claire et sombre générées et retourne à Overview. Les polices existantes restent en place. Cela remplace les couleurs et autres réglages de tokens du système actif. Un point de contrôle doit d'abord réussir ; **Restore brand settings** récupère les réglages précédents.

**Source details and individual choices** montre ce qui a été lu, les noms de police détectés et le contraste texte/action de l'aperçu. Ça propose aussi **Choose individual items in the tray** et **Download design context**. Le rapport JSON porte des observations, des tokens proposés et des informations de source ; le HTML/CSS enregistré inclut un SHA-256 du texte fourni. Il ne contient aucun texte brut de la page et n'est pas un Content Credential signé. Les noms de police sont des suggestions : Typographie reste l'endroit où choisir et installer les polices.

Les imports de PDF et d'autres fichiers de design gardent leurs contrôles de relecture existants. Les éléments conservés dans le **Tray** ne changent rien tant qu'ils ne sont pas ajoutés via la salle qui possède ce type de matériau.

`#/start?source=<kind>` ouvre le sélecteur sur une source donnée (`file`, `pdf`, `image`, `font`, `url`, `page`), et `?import` l'ouvre sur la liste simple.

## Déplacer une marque entre appareils

**Export** en bas du rail écrit un seul **`LollyBrand-….lolly`** - tes tokens, polices, logos et préférence de thème, avec un manifeste d'intégrité vérifié au retour. Les versions web antérieures à 1.0.7 nommaient la même charge `.zip` ; cette ancienne orthographe est toujours acceptée. À côté, **Tokens (.json)** écrit le document de design tokens seul : ni polices, ni logos, juste les tokens, ce que lit réellement un dépôt, une étape CI ou un autre outil de tokens.

Faire revenir une marque se fait via **Ajouter depuis... → Design tokens ou un fichier de design** (ci-dessus), ou par glisser-déposer sur le studio. C'est ainsi qu'un collègue te transmet une marque, ou que tu en emportes une vers une seconde installation - sans compte, sans cloud. Pour faire entrer une marque depuis la ligne de commande, voir [`ingest:brand`](/info/configuration.html#brand-packs).

## Restaurer des réglages antérieurs

Choisis **Restore brand settings** au pied du rail, sélectionne un point de contrôle daté, puis appuie sur **Restaurer**. Ça restaure les couleurs, les réglages typographiques et les autres tokens de marque pour la marque active. Les fichiers de police et d'image restent tels quels.

Lolly enregistre tes réglages actuels comme **Before restore** avant d'appliquer le point de contrôle. Choisis ce point de contrôle pour inverser la restauration, y compris après avoir fermé et rouvert le navigateur. Les 20 derniers points de contrôle sont conservés sur cet appareil. Si le stockage ne peut pas être lu ou si les réglages actuels ne peuvent pas être enregistrés, la boîte de dialogue signale le problème pour que tu puisses réessayer.

## Versions

**Versions**, au pied de la barre, c'est là qu'un design system arrête d'être une cible mouvante. Publie-en une et tu obtiens une **copie permanente et nommée** conservée sur cet appareil : elle ne change plus jamais ensuite, donc un outil qui l'épingle continue de dessiner la même chose. Le panneau reste masqué tant qu'il n'y a rien à toi à publier, donc un studio qui ne publie jamais ne voit jamais les contrôles.

Trois choses à savoir avant d'appuyer sur quoi que ce soit, et le panneau annonce les trois avant l'action plutôt qu'après :

- **Une version est permanente.** Il n'y a pas encore de suppression, donc le panneau indique ce qui a été conservé et que ça reste conservé plutôt que de proposer un bouton qui mentirait.
- **Les suppressions sont en tête de la carte de compatibilité.** Les tokens ajoutés et modifiés sont des nouveautés ; un token *supprimé* est ce qui casse un outil, donc il est nommé en premier et appelé par son nom.
- **Publier ne peut pas être annulé ; restaurer, si.** *Restaurer le dernier état depuis cette version* est une modification ordinaire de la tête, donc ça atterrit sur la pile d'annulation du studio et le panneau t'offre aussitôt le bouton **Annuler**.

Tu peux **Publish only**, ou **Publish and make active** - la différence étant que les outils et l'app suivent désormais cette version ou continuent de suivre ta dernière modification. **Follow the latest again** met chaque modification en ligne dès qu'elle est faite. `#/start?area=versions` ouvre le panneau directement.

## Quand la marque est fixe

Certaines versions livrent un **design system verrouillé**, comme la SUSE Brand. L'ouvrir montre une note en lecture seule avec **Faites une copie éditable** et **Changer**. Ses couleurs, polices et tokens d'origine restent intacts. Tes propres systèmes locaux restent modifiables, même quand le système verrouillé était le premier sur l'appareil. Dans Profil, **Ouvrir** sélectionne un système et ouvre son studio ; **Créer un nouveau** crée un système local et l'ouvre sur `#/start` avec le champ de nom en focus.

## Où aller ensuite

- **[Utiliser Lolly](/info/using.html)** - le canevas, la sauvegarde, les projets et Éléments.
- **[Design Tokens](/info/design-tokens.html)** - le modèle de tokens dans lequel ta marque est exprimée.
- **[Exporter et formats](/info/exporting.html)** - unités d'impression, CMYK et les formats dans lesquels ta marque s'exporte.


## Trouver et comparer un look

Ouvre **Find a look** depuis Overview ou la liste des design systems dans Profil. Parcours les systèmes enregistrés sur cet appareil et quelques exemples Lolly réutilisables. Cherche par nom, étiquette de couleur ou police déclarée. **Closest to my current palette** trie par similarité de couleur mesurée, les familles de polices correspondantes départageant les égalités ; ce n'est pas un score de qualité.

Sélectionne un look pour le relire, ou deux pour comparer. Le bouton de relecture reste disponible sur un petit écran. Sélectionner un look ne change rien. **Use this saved system** bascule à travers le registre existant des design systems. **Utiliser ces couleurs** applique un exemple via le flux normal de point de contrôle et d'installation, en préservant les polices actuelles. **Restore brand settings** peut récupérer le look précédent.

Sous **Details and design context**, les systèmes enregistrés ont des **Search tags** modifiables et un téléchargement de contexte. Les exemples utilisent des recettes de couleur Lolly originales ; il n'y a pas de collection d'inspiration récupérée à distance ni de compte requis.

![Comparer Sunroom et Orchard côte à côte avant d'appliquer l'un des deux systèmes de couleur.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

La comparaison garde les deux palettes visibles ensemble. Relire un look ne change rien tant que tu ne choisis pas **Utiliser ces couleurs** ou **Use this saved system**.

## Lire les preuves de source

Les détails optionnels de la relecture de source montrent la typographie, les espaces, le padding et les valeurs de coin là où ils sont observés. Le HTML/CSS enregistré et les lectures natives de site web signalent des déclarations, qui peuvent ne pas être utilisées par la page rendue. L'extension navigateur peut signaler des styles mesurés à partir d'un échantillon borné d'éléments visibles, avec sa fenêtre d'affichage et sa préférence de couleur du navigateur. Les extensions plus anciennes fonctionnent encore avec les styles déclarés. Les champs manquants disent **Not observed**.

Ce sont des observations, pas des réglages de style automatiques. Les fichiers de police ne sont ni récupérés ni installés par un scan de référence, et l'espacement de la source ne remplace pas silencieusement le tien. Les comptages décrivent des occurrences dans l'échantillon, pas une confiance ou une qualité.

## Vérifier une composition par rapport au design system

Dans Design, ouvre **Export**, puis **Avant d'exporter**. La vérification utilise la même version effective du design system que le rendu. Elle compare les couleurs saisies, les alias de tokens, les choix de police et les ID d'assets image. Des valeurs personnalisées peuvent être intentionnelles ; une image en dehors des assets de marque déclarés est un point à relire, pas une image interdite.

Là où une suggestion concrète de couleur ou de police est disponible, son bouton ne change que cette seule couche. L'**Annuler** normal restaure la valeur d'origine. Les couches verrouillées ou modifiées ne sont pas écrasées par une ancienne suggestion. Les preuves de source manquantes restent séparées d'une correspondance. Le contraste rendu et la mise en page du texte sont vérifiés par les contrôles déjà en place. Les dégradés, les effets, le contenu d'outil imbriqué, les droits et la qualité subjective ne sont pas évalués par la comparaison de marque. Les vérifications ne bloquent pas **Télécharger**.

## Utiliser le contexte de design localement

**Download design context** inclut le document de tokens, les couleurs résolues, les familles de police déclarées, les ID d'assets, les preuves de source là où elles sont enregistrées, la couverture et les règles explicites. Ça n'inclut pas les fichiers de police ni de preuve de propriété. La relecture de référence inclut aussi ses tokens proposés et ses observations.

La CLI peut lire l'un ou l'autre téléchargement sans serveur :

```bash
lolly system import ./lolly-design-context.json
lolly system context --output=design-context.json
lolly system check ./design-inputs.json --file=design-context.json
```

`system check` accepte des entrées Design avec un tableau `boxes` ou un document Design compilé. Ça signale des corrections proposées sans modifier la composition. Ça ne peut pas mesurer la mise en page du navigateur ni le contraste rendu. La ressource MCP existante **lolly://design-context** expose le contexte du système effectif via le processus MCP local configuré ; aucun nouveau service hébergé ni clé API n'est nécessaire.
