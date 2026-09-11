# Utiliser Lolly

Un guide pratique pour *utiliser* concrètement l'application - ouvrir un outil, travailler le canevas, exporter, enregistrer et partager. Tout ici s'exécute **sur ton appareil** : pas de compte, aucun envoi, aucune connexion nécessaire après le premier chargement.

> Nouveau ici ? Le [Démarrage rapide](/info/quickstart.html) te fait créer en quelques minutes, et [Lolly pour les opérateurs](/info/operators.html) couvre l'installation et le déploiement de l'application ; cette page, elle, explique comment la piloter une fois ouverte.

## Ouvrir un outil

L'écran d'accueil est la **galerie** - tous les outils, regroupés par catégorie. Clique sur une carte pour ouvrir l'outil ; si tu y as déjà travaillé, un bouton **Continuer** reprend ta session la plus récente. Utilise la zone de recherche pour filtrer par nom - ou lance une [Recherche](/info/search.html) depuis la barre au pied des six écrans de liste (la galerie, les Utilitaires, Projets, le Catalogue, le Tableau de bord et Profil), qui atteint ton travail enregistré, le catalogue et tes réglages en plus des outils. Dans un outil, la barre s'efface au profit de l'habillage propre à l'outil.

![La galerie d'outils - chaque outil sous forme de carte, regroupés par catégorie](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&filename=gallery&try=1)

Chaque outil se présente en vue divisée : les **contrôles** d'un côté, un **aperçu** en direct (le canevas) de l'autre. Modifie n'importe quel contrôle et l'aperçu se met à jour instantanément.

![La vue divisée d'un outil - la pile de contrôles à gauche, et le graphique en barres groupées en direct qu'elle dessine à droite](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

> Quelques outils (comme **Design**) s'ouvrent plutôt en **canevas libre** - une surface de manipulation directe, sans habillage, où tu fais glisser, redimensionnes, fais pivoter et alignes des boîtes de texte, de formes et d'images, et où tu double-cliques pour modifier le texte sur place. Il s'exporte par le même chemin de rendu que tout autre outil, donc le canevas *est* le fichier. Voir [Le canevas libre](#the-free-canvas-design) ci-dessous.

Deux façons de façonner la grille elle-même pour qu'elle devienne la tienne :

- <!--i:star--> **Mets une étoile sur ce que tu utilises.** Marque une carte d'une ★ et elle obtient sa propre grande tuile dans un bandeau au-dessus de la grille - voir [Tes favoris](/info/favourites.html).
- <!--i:eyeoff--> **Masque un outil que tu n'utilises jamais.** Clic droit sur une carte (ou sélectionnes-en plusieurs et utilise la barre de sélection) → **Masquer l'outil**. Il sort de la grille, et de ce que la saisie dans la grille trouve ; une tuile grise **Afficher les outils masqués (N)** tout à la fin les fait réapparaître, estompés, chacun avec **Réafficher l'outil** dans son propre menu. Le masquage ne concerne que ta grille - l'outil s'ouvre toujours depuis un lien enregistré ou un favori, et il reste exactement où il était pour tout le monde.

![La fin de la grille Outils avec les outils masqués révélés : la carte estompée du générateur de QR Code, et à côté la tuile grise qui l'a ramenée dans la vue, qui affiche désormais Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-bulk%3D%22hide%22%5D%3Bwait%3A300%3Bclick%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed it. The alt says so rather than quoting the resting
label the prose above already gives.
There is no standalone per-card "hide" button
(unlike the always-visible fav/pin corner icons) - Hide only exists inside a
tile's right-click menu or the bulk bar, both confirmed in views/gallery.ts.
The recipe goes the bulk-bar route since it needs no `|right` context-menu
step: tick the card (`[data-select="qr-code"]`, the same checkbox hook the
selection bullet under Projects uses), click the bar's Hide button
(`[data-bulk="hide"]` - the literal `data-bulk` value bulkBarHtml() writes,
confirmed in lib/bulk-bar.ts), then click the grey reveal tile
(`.gtile--hiddenbox`, confirmed in gallery.ts).
-->

### Ask Lolly

Quand tu préfères demander plutôt que chercher, **Ask Lolly** (`#/ask`) prend une question saisie et renvoie la section correspondante de cette documentation **mot pour mot** - les mots mêmes des guides, ni un résumé ni une génération - en citant la page d'où elle vient, avec un lien **Ouvrir dans la doc** à côté. Sous la réponse figurent les endroits de l'application auxquels la même question correspond : un outil, un réglage, un projet enregistré, chacun sous forme de bouton qui t'y emmène, tout simplement.

La transcription est une mémoire de session : pose une question de suivi et le fil se construit au fur et à mesure, puis recharge la page et il repart à zéro. Les résultats de recherche portent en bas une ligne **Ask Lolly : *ta requête*** - sous les résultats concrets trouvés par les autres groupes - qui transmet la question directement, si bien que tu peux commencer dans la barre et finir ici.

## Le canevas (aperçu)

L'aperçu montre toujours exactement ce qui sera exporté.

**Ordinateur**

- **Zoom :** Cmd/Ctrl + molette, ou pince sur un trackpad - le zoom se centre sur ton pointeur.
- **Déplacement :** maintiens **Espace** et fais glisser, ou fais glisser avec le **bouton central de la souris**. (Les clics simples restent libres pour cliquer sur des éléments du design.)
- **Clavier :** `0` = ajuster à la fenêtre · `1` = 100 % · `+` / `−` = zoom.
- **HUD de zoom :** le petit contrôle `−  NN%  +  Fit` dans le coin. Clique sur le pourcentage pour basculer entre Fit et 100 %.

![Le HUD de zoom dans le coin du canevas - moins, le pourcentage en direct, plus, Fit, puis les interrupteurs de thème et de son](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

**Tactile**

- **Pince** pour zoomer, **glisse** pour déplacer, **double-tape** pour revenir à l'ajustement.

**Cliquer pour accéder à un contrôle :** clique sur n'importe quel élément du design et le champ correspondant dans la barre latérale reçoit le focus et défile jusqu'à être visible - pour un groupe de lignes répétitives, cela déplie exactement la ligne sur laquelle tu as cliqué, si bien que modifier ce que tu vois n'est qu'à un tap.

Un changement de dimension ramène toujours la vue à un ajustement net.

### Le canevas libre (Design)

Les outils en canevas libre ajoutent une surface de travail *autour* du plan de travail, comme le plan de collage d'un designer :

- **Mise en attente hors-canevas.** Fais glisser une boîte au-delà du bord du cadre et elle reste entièrement **visible et sélectionnable** - mets des éléments de côté pendant que tu composes, puis ramène-les à l'intérieur. Tout ce qui se trouve hors du cadre est **légèrement estompé** pour que la zone d'export reste lisible d'un coup d'œil, et le cadre conserve son ombre pour marquer précisément où le fichier commence.
- **Seul le cadre s'exporte.** Le fichier exporté est délimité par le plan de travail - tout ce qui reste à l'extérieur (ou la partie d'une boîte qui dépasse du bord) est simplement rogné du résultat, aussi bien en formats matriciels que vectoriels.
- **Dézoome au-delà de Fit** (jusqu'à 20 %) pour voir tout le plan de collage quand tu as mis des éléments loin en dehors du cadre.
- **Plan de travail redimensionnable.** Changer les dimensions d'export redimensionne le cadre sur place ; les boîtes gardent leur position, ce qui te permet de recadrer une mise en page autour d'un contenu existant.

![Design's free canvas - the artboard with its surrounding pasteboard](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

**Retourner une sélection.** Fais un clic droit sur une boîte et choisis **Retourner horizontalement** ou **Retourner verticalement** pour la mettre en miroir sur place, ou appuie sur `Shift+H` / `Shift+V` au clavier - Shift, car un simple `V` correspond à l'outil Pointeur. Chaque boîte sélectionnée se retourne selon son propre axe en une seule étape d'annulation, et le miroir est une vraie transformation, donc il tient dans le SVG, le PDF et le PNG exportés, pas seulement sur le canevas.

### Dessiner tes propres formes (la plume)

Les boîtes, les cercles et les cadres arrondis couvrent la plupart des mises en page. Quand il te faut une forme absente de cette liste, dessine-la : le bouton **Plume** de la barre d'outils (ou la touche `P`) te met en mode dessin. Trois touches simples font passer d'un mode à l'autre - **`V`** pour revenir au Pointeur, **`P`** pour la Plume, **`N`** pour l'outil de nœuds (**Modifier les points**) - et le Pointeur est toujours la sortie, quel que soit le mode où tu es.

![La barre d'outils du canevas libre : une poignée de déplacement, le menu Lolly, puis Pointeur, Ajouter une boîte, Plume, Modifier les points, Ligne, Chronologie, Plans de travail et Rangement automatique](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

- **Clique** pour poser un point. Avec le type de courbe par défaut, **cliquer-glisser** fait sortir les poignées de ce point, ce qui est la façon de dessiner une courbe plutôt qu'un angle - maintiens **Alt** en cliquant pour obtenir un angle net à la place. (Avec les autres types de courbe, chaque point posé est un angle et le glissement ne fait rien ; voir **Type de spline** ci-dessous.)
- Les points s'accrochent au plan de travail et à tes autres boîtes à mesure que tu les poses, en traçant les mêmes repères qu'un glissement ordinaire. Alt supprime la grille pendant que tu dessines, et à la fois la grille et les bords quand tu déplaces un point ensuite.
- **Clique sur ton premier point** pour fermer la boucle et terminer d'un seul geste. Sinon appuie sur **Entrée**, double-clique ou change simplement d'outil - le dessin est conservé, pas jeté.
- **Échap** agit un cran à la fois : la première pression abandonne le dessin sans rien écrire, la seconde quitte la plume.
- **Suppr** pendant le dessin retire le dernier point posé.

Le résultat est une boîte ordinaire sur le canevas. Déplace-la, redimensionne-la, fais-la pivoter, groupe-la, aligne-la, réempile-la, donne-lui un fond, un dégradé, une ombre ou une opacité - un tracé se comporte comme n'importe quelle autre boîte, et aucun de ces contrôles ne le traite différemment.

Il arrive déjà peint, en plus. Le premier tracé que tu dessines prend le fond et le trait que ta marque attribue à un tracé, puis chaque nouveau tracé reprend **ce que tu as utilisé en dernier** - règle un fond une fois et continue à dessiner, plutôt que de recolorer chaque forme. (Dans un outil dont la marque ne dit rien des tracés, un tracé dessiné porte le trait de la couleur avec laquelle tu l'as vu se dessiner, il n'est donc jamais invisible.)

**Revenir modifier les points.** Double-clique sur la forme (ou utilise **Modifier les points** dans la barre d'objet) et les points reviennent. Fais glisser un point pour le déplacer, une poignée pour la réorienter, clique n'importe où sur la courbe pour insérer un point, encadre un groupe de points au lasso rectangulaire et appuie sur Suppr pour retirer ceux qui sont sélectionnés. Un tracé garde toujours au moins deux points, tu ne peux donc pas le faire disparaître par accident.

**Type de spline** décide quelle sorte de courbe passe par tes points, et c'est le choix qui vaut la peine d'être compris :

| Type | Ce qu'il fait |
|---|---|
| **Lisse (auto)** | Le choix par défaut. Il calcule lui-même la longueur des poignées, si bien qu'un simple clic-clic-clic donne une courbe vraiment lisse, sans bataille avec les poignées. Si tu règles une poignée, elle fixe la *direction* et la courbe garde la maîtrise de la longueur. |
| **Poignées Bézier** | La plume classique. Les poignées sont les points de contrôle, et insérer un point ne déplace jamais la courbe. |
| **À travers les points** | Passe exactement par chaque point posé, sans poignées. |
| **B-spline** | Longe les points au lieu de passer par eux, pour une forme plus douce. |
| **Lignes droites** | Une polyligne. |

Faire passer un tracé existant à un type qui calcule lui-même ses poignées demande d'abord confirmation, parce que les longueurs de poignées que tu as réglées ne peuvent pas être récupérées - passer aux **Poignées Bézier** est toujours sans perte. En cours de dessin, il n'y a pas de confirmation : le changement s'applique directement au brouillon, et les poignées que tu avais déjà tirées partent avec. Sur les types qui possèdent leurs poignées, insérer un point remodèle très légèrement la courbe ; avec les **Poignées Bézier**, non.

Chaque point porte aussi une règle de continuité, indiquée par sa forme sur le canevas - carré pour **Angle** (les poignées bougent indépendamment), rond pour **Lisse** (les poignées restent alignées), rond cerclé pour **Symétrique** (alignées et de même longueur). Applique-la aux points sélectionnés et la courbe s'y conforme aussitôt.

![Deux tracés à la plume rendus directement depuis un lien : une courbe en S au trait et une tache fermée remplie](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

Un tracé dessiné voyage dans le lien comme tout le reste, si bien qu'une forme que tu dessines se rouvre depuis un lien de partage et se rend à l'identique depuis la CLI. Rien en elle ne dépend de l'éditeur.

### Combiner des formes (opérations sur les tracés)

Sélectionne deux formes ou plus, fais un **clic droit** sur le canevas (tape à deux doigts sur tactile) et le menu propose les opérations attendues d'une application de dessin :

- **Union** les fusionne en une seule forme, en gardant la peinture de celle du dessus.
- **Soustraire** retire de la forme du dessous tout ce qui se trouve au-dessus.
- **Intersecter** ne garde que le chevauchement.
- **Exclure** garde tout sauf le chevauchement.

Trois autres agissent sur une seule forme : **Contourner le trait…** transforme un trait en forme pleine de même silhouette (utile quand tu veux garder une épaisseur exactement telle que dessinée), **Décaler le tracé…** élargit la silhouette vers l'extérieur ou, avec un nombre négatif, la rétrécit vers l'intérieur et **Simplifier** reconstruit un tracé avec moins de segments à forme égale.

![Un croissant et un anneau percé d'un vrai trou, tous deux produits par Soustraire](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=path-ops-boolean-result)

Le résultat est un nouveau tracé que tu peux continuer à modifier à la plume. Les trous sont de vrais trous - un contrôle **Règle de remplissage** dans le panneau de trait décide si les contours qui se chevauchent se remplissent (*non-zero*) ou se percent (*even-odd*).

Deux choses que ces opérations ne font délibérément pas. Elles **refusent au lieu de détruire** : demande l'intersection de deux formes qui ne se chevauchent pas et on te répond qu'il n'y a rien à garder, et rien ne change. Et les boîtes de texte et d'image n'ont pas de silhouette exploitable, elles sont donc laissées telles quelles plutôt qu'approximées par leur cadre. Un résultat combiné est stocké en simples courbes de Bézier, ce que fait aussi une application de dessin - le type de spline d'origine ne survit pas à l'opération.

## Chronologie (Sequence Studio)

![The timeline with the music clip selected: its strip runs along the bottom with Speed, Fades, Volume, Pan, EQ, Pitch, Normalize volume and the Effect slot](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dvideo%26_sel%3Dbed&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px!important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip)

**Sequence Studio** ajoute le *temps* au canevas libre. Chaque boîte peut démarrer à un instant donné, durer un certain temps et s'animer à l'entrée comme à la sortie, et c'est dans la chronologie ancrée sous le plan de travail que tu les organises. Ouvre-le et une séquence tourne déjà - un carton-titre, un clip, un carton de fin, un bandeau de bas d'écran et un fond musical - si bien que le modèle est visible avant même que tu changes quoi que ce soit.

![La timeline de Sequence Studio : le transport, la règle, une piste de superposition, la rangée de séquence magnétique avec ses clips et ses puces de jointure, et la bande Always on](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

Il y a deux sortes de lignes, et la différence fait toute l'idée :

- La **ligne de séquence** est *magnétique*. Les clips se suivent sans trou, l'un après l'autre, et en faire glisser un réordonne l'enchaînement au lieu de laisser un vide. Supprime un clip et les autres se resserrent. C'est ta colonne vertébrale.
- Les **pistes de superposition** sont libres. Un bandeau de bas d'écran, un logo, une légende - tout ce qui flotte au-dessus de la colonne vertébrale à son propre rythme - reçoit sa propre piste et son propre départ.
- En dessous, **Toujours actif** rassemble les boîtes sans aucun minutage : le décor, simplement présent du début à la fin. Le `+` d'une pastille en promeut une sur une piste ; **Rendre toujours actif** l'y renvoie.

![La scène d'édition : le plateau au premier plan, la barre d'outils à gauche et le HUD de zoom dans le coin](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-stage)

Ouvrir la chronologie lui donne le clavier : Espace et les flèches pilotent alors la tête de lecture plutôt que la page - et comme elle s'ouvre d'elle-même sur une composition déjà minutée, c'est vrai dès le chargement de Sequence Studio.

> **[L'éditeur de séquence](/info/sequence-editor.html)** approfondit les quatre choses qui décident si le montage dans le temps reste prévisible : quel clip un clic sur le canevas modifie, les fantômes en pelure d'oignon des clips voisins, la portée du fractionnement et le Joindre qui défait une coupe et le rognage (raccourcis clavier compris). Appuie sur `?` avec la chronologie au premier plan pour la fiche des raccourcis.

**Le montage.** Fais glisser le milieu d'un clip pour le déplacer ou le réordonner, glisse à quelques pixels de l'une ou l'autre extrémité pour le rogner et appuie sur **Scinder à la tête de lecture** (ou `S`) pour couper un clip en deux. Scinder demande un clip doté d'une **Longueur** réelle et la tête de lecture un peu à l'intérieur, si bien qu'un clip ouvert (le fond musical, par exemple) ne peut pas être scindé. **Aligner sur les bords** est actif par défaut et s'accroche aux bords des clips, à la tête de lecture et aux secondes entières, avec Alt pour passer outre. Chaque glissement est une seule étape d'annulation, et l'aperçu du glissement fait le même calcul que la validation, donc ce que tu vois en glissant est ce que tu obtiens.

Sélectionne un clip et l'inspecteur te donne les mêmes réglages en nombres : **Longueur**, **Rogner le début** (à quel point du média source il commence), **Vitesse** sous forme de multiplicateurs fixes de ×0,25 à ×4, **Animer l'entrée** / **Animer la sortie** avec leurs durées et **Couper le son du clip**. Un clip sur la ligne magnétique n'a volontairement pas de champ **Début** - c'est la ligne qui possède l'ordre, alors tu le déplaces en le faisant glisser.

**Les transitions** sont des préréglages, pas des images clés : Fondu, Pop, Agrandir, Montée, Dépose, les quatre Glissements, Zoomer et Dézoomer, Inclinaison, Envolée, Rotation, Dérive ou **Coupe (sans animation)**. Les distances s'adaptent à l'objet, si bien que le même préréglage rend correctement sur un carton plein cadre comme sur un petit badge. Entre deux clips voisins de la ligne de séquence se trouve une **pastille de raccord** : clique dessus et choisis **Coupe** ou **Fondu enchaîné**, qui s'applique aussitôt et se referme. Rouvre la même pastille pour changer la **Durée (ms)** et appuie sur **Terminé**. Un fondu enchaîné est stocké comme une sortie en fondu de l'un et une entrée en fondu du suivant, et l'export en déduit le vrai fondu à partir de cette paire - c'est pourquoi un fondu enchaîné ressemble à deux fondus dans l'aperçu et à un vrai passage de relais dans le fichier.

**Le son.** Ajoute un clip **Audio** et il vit sur la chronologie comme n'importe quel autre clip : forme d'onde, rognage, coupure du son. (Le fond généré livré avec la session par défaut est la seule exception - il est synthétisé au moment de l'export, sa barre reste donc unie et muette jusqu'au rendu.) Appuie sur le micro pour **enregistrer une voix off** directement sur la chronologie, avec un décompte et un vumètre, et la prise est enregistrée comme ton propre asset à l'endroit où tu as commencé. Appuie sur la caméra à côté pour **enregistrer une vidéo** de la même manière : la prise est rognée à la taille d'export du plan de travail pendant l'enregistrement, si bien que le petit aperçu de toi montre exactement ce qui arrive dans la séquence à la tête de lecture, plein cadre - la façon de récupérer le clip d'un collègue depuis un lien partagé. La musique, les dialogues et la bande-son propre à un clip arrivent tous dans le mixage exporté. (La **piste audio** du panneau d'export est autre chose : un seul fond posé sous tout le clip, avec fondu et atténuation. Les deux coexistent.)

**Le rendu.** Un export animé est un **composite déterministe**, pas un enregistrement d'écran - chaque image est décodée, dessinée et encodée à un instant exact, si bien que le fichier ne dépend pas de la capacité de ta machine à suivre, et il n'y a pas de plafond d'images pratique en MP4 ou WebM. La longueur de la chronologie fixe la durée, sauf si tu en saisis une. Les Content Credentials sont apposés comme sur n'importe quel autre export. Un export d'image fixe te donne l'image à la tête de lecture, ou une planche-contact entière depuis le champ **Images** à côté de la taille de sortie - voir [Export](/info/exporting.html#stills-from-a-timed-composition).

Quelques limites à garder en tête : une séquence est plafonnée à une heure, le GIF et le PNG animé mettent leurs images en mémoire tampon et restent donc courts, le son est muet sur un clip dont la vitesse n'est pas ×1 (il n'y a pas encore d'étirement temporel) et **Enregistrer en direct** est masqué ici parce que le compositeur est la meilleure voie.

**Au-delà des préréglages : images clés, profondeur et une caméra.** Une transition anime un clip à son arrivée et à son départ. Pour poser une boîte *à l'intérieur* d'un clip - la faire dériver, la faire apparaître ou disparaître en fondu, la flouter, la soulever de la page et la reposer - ajoute des images clés : sélectionne le clip, appuie sur **+Image clé** (le losange dans le groupe d'outils de la timeline, le losange sur la barre d'objet du canevas, ou `K`), et la position de la tête de lecture décide quelle pose ta prochaine modification écrit. Le même système d'images clés donne à chaque composition minutée une **caméra** qui s'approche, panote et fait le point, et transforme un SVG plat en une pile de calques entre lesquels tu peux voler. **[Animer](/info/animating.html)** est le guide complet.

L'outil Design a la même chronologie, tu peux donc minuter une mise en page sans changer d'outil, et il exporte aussi de l'animation.

## Présenter

![The inspector's Document section: Voice, Blend with, Speed, Lead-in, Tail and Show captions when presenting](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

Un document Design fait de **plans de travail** est déjà un diaporama. Ouvre le **menu Lolly** de la barre d'outils et choisis **Présenter** - la dernière ligne - et chaque plan de travail devient une diapositive plein écran, dans l'ordre où les plans de travail sont posés sur le canevas. Le diaporama tourne sur une copie des plans de travail rendus, si bien que l'éditeur en dessous n'est jamais touché et que le quitter te ramène exactement là où tu étais.

- **Avance** avec **Space**, `→`, **Page Down** ou un clic sur la bande au bord droit de l'écran ; recule avec `←`, **Page Up** ou la bande au bord gauche. **Home** et **End** sautent à la première et à la dernière diapositive. Une petite barre de contrôles apparaît en fondu dès que tu déplaces le pointeur et se cache à nouveau une fois que tu t'arrêtes.
- **Vue d'ensemble** (`O` ou le bouton grille) dispose tous les artboards en une fois, dans l'agencement que tu leur as donné sur le canevas ; clique sur l'un d'eux pour l'ouvrir.
- **Étapes de révélation.** Fais un clic droit sur une boîte et choisis **Reveal at step 1**, **2** ou **3** au lieu du réglage par défaut **Always visible**. Cette boîte attend alors que tu avances jusqu'à son étape, ce qui permet à une diapositive d'arriver par morceaux ; les boîtes qui partagent un numéro arrivent ensemble.
- **Vue orateur** (`S`) ouvre une seconde fenêtre avec la diapositive en cours, la suivante, tes notes pour cette diapositive et un chronomètre en cours. Si le navigateur bloque la pop-up, elle bascule en panneau par-dessus le deck. Les notes sont définies par artboard et n'apparaissent jamais sur la diapositive elle-même.
- `B` maintient un écran noir (n'importe quelle touche ramène la diapositive), `F` revient au plein écran et **Escape** enlève une couche à la fois : de la vue d'ensemble au deck, du deck à l'éditeur.
- **Kiosque.** Donne à un artboard une **Length** et le deck s'y maintient pendant cette durée, puis avance de lui-même derrière une fine barre de progression ; `K` (ou le bouton pause, qui n'apparaît qu'une fois qu'un élément a une durée) arrête et redémarre cela. Ajoute `kiosk` au lien et le deck reboucle à la fin, ce qui en fait un affichage de signalétique.

Le diaporama est aussi un lien. `?present` l'ouvre directement, `s=` désigne la diapositive - une position, un id de plan de travail ou `id.step` pour une étape de révélation - et l'adresse se met à jour à mesure que tu avances, si bien que ce que tu envoies est la diapositive où tu es. Auteurs d'outils : ces paramètres sont documentés sur la page [Mode URL](/info/url-mode.html#reserved-parameters).

## Sur téléphone

Sur les écrans étroits, la mise en page se réorganise en une seule colonne :

- Les **contrôles deviennent une feuille** en haut, avec une **poignée de glissement** sur son bord inférieur. Fais glisser la poignée pour la redimensionner - elle s'accroche aux positions **aperçu / moitié / plein écran** - ou **tape** sur la poignée pour basculer entre replié et déplié. L'aperçu occupe l'espace en dessous et reste visible pendant que tu modifies.
- Un bouton **Export** flottant ouvre la feuille d'export - tous les contrôles de format, taille, copie, enregistrement et téléchargement au même endroit. Ferme-la en tapant sur le fond.

![Un outil sur un écran de largeur téléphone - les contrôles en feuille en haut, la palette générée qui remplit l'aperçu en dessous et la pastille de rendu flottant en bas au centre](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Contrôles (champs)

Les outils n'exposent que les champs destinés à varier - tout le reste (couleurs, mise en page, typographie, logique) est verrouillé par l'auteur de l'outil, si bien que ce que tu produis respecte les règles qu'il a fixées. Les champs incluent du texte, des curseurs, des sélecteurs de couleur, des menus déroulants, des dates, des sélecteurs d'images et des groupes de lignes répétitives. Certains sont regroupés dans des sections repliables.

![La pile de contrôles d'un outil - un champ de texte, des déclencheurs de couleur et un curseur, rien de plus, tout le reste ayant été verrouillé par l'auteur](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Réinitialiser :** *Effacer les modifications* remet chaque champ à sa valeur par défaut.

### Annuler et rétablir

**Cmd/Ctrl-Z** revient en arrière et **Cmd/Ctrl-Maj-Z** (ou **Cmd/Ctrl-Y**) repart en avant. La même paire se retrouve en boutons **Annuler** et **Rétablir** dans la rangée au-dessus des contrôles - sur le canevas libre, ils sont plutôt sur la barre d'outils - et chacun se grise tant qu'il n'y a plus rien à reprendre. Chaque étape dit ce qu'elle était : annule une couleur et un petit message nomme le champ qu'il vient de restaurer, avec un bouton **Rétablir** dedans pour repartir en avant.

- **Un glissement est une seule étape.** Les changements répétés sur le même contrôle en moins d'une demi-seconde fusionnent, si bien que promener un curseur sur toute sa plage donne une seule annulation plutôt que deux cents.
- **Les 100 dernières étapes sont conservées** - les plus anciennes tombent du bout. Faire une nouvelle modification après une annulation vide la pile avant, comme partout ailleurs.
- **Tant que ton curseur est dans une zone de texte**, Cmd/Ctrl-Z appartient au champ lui-même, caractère par caractère. Lolly prend le relais pour les contrôles qui n'ont pas d'annulation utile en propre : curseurs, menus déroulants, couleurs et interrupteurs.
- **Choisir un fichier** dans un champ **fichier** n'est pas une étape - ces octets ne sont gardés que pour la session, il n'y aurait donc rien à remettre.

Dans une [collaboration](/info/collaborate.html) en direct, l'historique reste uniquement le tien. Une modification arrivant depuis l'autre appareil n'atterrit jamais sur ta pile, donc annuler ne peut jamais reprendre que quelque chose que tu as fait toi-même.

## Tes informations et ta photo

**Profil** (en haut à droite de la galerie) contient ton nom, tes coordonnées et une **photo** facultative. Les outils qui demandent ces champs les pré-remplissent automatiquement - règle-les une fois et ta signature e-mail, tes lockups et tes badges se remplissent tout seuls. Tu peux toujours modifier n'importe quel champ pour une session donnée. Active **Utiliser mes informations pour créer** pour que tes informations accompagnent ce que tu exportes, en tant qu'auteur.

Ta photo et tes informations résident **uniquement sur cet appareil**. Un profil peut représenter plus que toi seul - une équipe ou un rôle que tu endosses de temps en temps. Consulte **[Profils](/info/profile.html)** pour la vue d'ensemble, y compris comment en garder plusieurs.

## Enregistrer et reprendre

Clique sur **Enregistrer** pour stocker les champs actuels comme session pour cet outil. Tu peux garder plusieurs sessions nommées par outil ; le bouton **Continuer** de chaque outil rouvre ta session la plus récente, et le **bouton historique** (en haut à droite, à côté de ton profil) liste toutes les sessions enregistrées, tous outils confondus. Les sessions sont locales à l'appareil. Pour les organiser, ouvre **Projets** (ci-dessous).

![La pastille de rendu en deux moitiés - une flèche vers le haut qui ouvre le panneau d'export et une coche qui enregistre la session sur place](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

## Projets

**Projets** - ouvre-le depuis l'onglet **Projets** à côté de **Outils**, ou depuis **Profil → Stockage → Organiser dans Projets** - est un espace pour tout ce que tu as enregistré, et fonctionne comme un gestionnaire de fichiers :

![Projets - des sessions enregistrées organisées en dossiers imbriquables](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)

- <!--i:folder--> **Des dossiers imbriqués.** Regroupe les sessions enregistrées dans des dossiers, et des dossiers dans d'autres dossiers, aussi profondément que tu veux. Crée un dossier, renomme-le ou fais glisser une tuile sur un autre dossier pour la déplacer ; un fil d'Ariane te permet de remonter. Un dossier **Sans catégorie**, toujours présent, contient tout ce qui n'a pas encore été rangé.
- <!--i:clock--> **Trie à ta façon.** **Afficher et trier** propose **Nom**, **Date d'ajout**, **Dernière modification** (le tri par défaut) et, dans un dossier, **Par outil**. Les dossiers viennent toujours en premier, quel que soit le tri actif - le tri n'ordonne que les sessions et les dossiers au sein de leur propre groupe.
- <!--i:document--> **Range directement le nouveau travail.** **Nouvel asset** (« Démarrer une nouvelle création » à la racine, « Ajouter à *dossier* » à l'intérieur d'un dossier) ouvre un outil et range automatiquement son premier enregistrement dans ce dossier.
- <!--i:checklist--> **Sélection multiple (ordinateur).** Coche la case d'une tuile, fais glisser un rectangle de sélection sur une zone vide ou fais **Maj/Cmd-clic** ; **clic droit** sur une tuile pour son menu contextuel. Agis ensuite sur toute la sélection d'un coup - le même geste et la même barre d'action flottante fonctionnent dans la galerie Outils, les Utilitaires, le Catalogue et Projets, pas seulement ici.
- <!--i:download--> **Rends tout un dossier ou toute une sélection.** **Rendre le dossier** exporte chaque session enregistrée d'un dossier - y compris ses sous-dossiers - dans un seul `.zip` imbriqué. **Rendre la sélection** fait de même pour n'importe quelle sélection multiple, et une session unique se rend directement dans son propre fichier. Pas besoin de Batch/Pro.
- <!--i:link--> **Va droit au travail enregistré d'un outil.** Coche un ou plusieurs outils dans la galerie Outils et choisis **Voir les sessions** dans la barre de sélection - Projets s'ouvre en n'affichant que les sessions faites avec ces outils, avec un **Effacer** pour revenir à la vue complète.
- <!--i:link--> **Partage une session enregistrée.** Clic droit sur une session → **Partager le lien** pour copier un lien qui la rouvre avec exactement les mêmes champs (la boîte de dialogue de partage complète - voir ci-dessous).

![Le popover Afficher et trier ouvert dans Projets, avec une ligne de thème, un choix d'affichage Aperçu ou Liste et Nom, Date d'ajout et Dernière modification sous Trier](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
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
Also: the popover is not sort-only. openViewOpts() writes a theme segment, a
"View" pair (Preview / List) and a sound segment around the Sort rows, so the
alt text names them - do not re-caption this as "the sort menu".
-->

**Ce que propose la barre de sélection** varie un peu selon la vue, car toutes les actions n'ont pas de sens partout :

- **Outils / Utilitaires :** Favori (ou Retirer des favoris), Masquer (ou Réafficher), Disponible hors ligne (ou Retirer du hors ligne), **Voir les sessions** (le saut décrit ci-dessus) et Copier le lien quand exactement une carte est sélectionnée.
- **Catalogue :** Favori et Masquer s'appliquent à n'importe quelle sélection ; Dupliquer, Télécharger et Supprimer n'apparaissent que si chaque élément sélectionné est l'un de tes propres imports - un asset partagé du design system est un contrat permanent, ces trois-là ne le touchent donc pas, même en lot.
- **Projets :** **Rendre la sélection**, **Déplacer vers…**, **Nouveau dossier**, **Supprimer**, **Modifier ensemble** quand la sélection compte entre deux et huit sessions d'un même outil (elles s'ouvrent côte à côte sous une seule barre latérale combinée) et **Modifier en feuille**, qui ouvre plutôt toute la sélection en lignes dans la grille de lot. Celle-ci n'a **aucune limite de taille** et se moque de savoir si les sessions viennent du même outil, c'est donc la porte de sortie quand une sélection est plus grande ou plus mélangée que le deux-à-huit de Modifier ensemble.

> Un piège de libellé : **Voir les sessions** n'existe qu'une fois quelque chose *sélectionné*. Un clic droit sur une seule carte non sélectionnée propose plutôt **N sessions enregistrées**, qui ouvre la boîte de dialogue d'historique de cet outil au lieu d'aller dans Projets.

![Deux cartes d'outils cochées dans la galerie Outils, avec la barre de sélection flottante affichant 2 sélectionnés et proposant Disponible hors ligne, Voir les sessions, Favori et Masquer](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery)
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
`projects` shot above already carries; revisit if the pipeline gains a
storage-seeding hook.
-->


## Partager ton travail

Un design sort de deux façons : en lien ou en fichier. La boîte de dialogue de partage propose les deux. Ouvre-la avec **Partager** dans les contrôles d'export ; **Partager le lien** sur une session enregistrée dans Projets ouvre la même boîte de dialogue pour cette session.

### Le lien

Chaque champ est capturé dans l'URL de la page, donc un lien *est* le design. En haut de la boîte de dialogue se trouve le lien prêt à copier, avec deux sections repliées en dessous.

- **Options du lien** contient **Lien le plus court** (un gros design donne une longue URL, alors ceci compresse tout l'état dans un jeton compact et t'indique l'économie en caractères ; la forme lisible reste toujours disponible), **Protéger ce lien par mot de passe** (AES-256 sur tout le lien, le mot de passe n'y figurant jamais) et **Épingler cette version de l'outil** - le drapeau `_v`, qui cloue le lien à la version de l'outil que tu as sous les yeux pour qu'une mise à jour ultérieure ne puisse pas changer ce qu'il rend.
- **Comportement du lien**, c'est ce qui se passe quand le destinataire l'ouvre : plein écran, panneau d'export déjà déplié, téléchargement à l'ouverture avec `&export` ou copie dans le presse-papiers avec `&copy`.

Colle le lien à un collègue, mets-le en favori ou commite-le. (Tous les détails : [Mode URL](/info/url-mode.html).)

**Certains outils font du lien le produit tout entier.** Jump Page rassemble tes liens sur une seule page à distribuer - un lien bio, une conférence, une vitrine. Il n'y a rien à héberger et aucun compte derrière : la page est le lien, donc elle s'ouvre aussi vite que l'URL voyage. Dans l'éditeur, tu vois la page finie à côté des champs ; qui ouvre le lien la reçoit en pleine largeur, une scène par lien au fil du défilement.

![Jump Page dans l'éditeur - le titre, trois scènes de liens ayant chacune sa propre teinte, et un pied de page Made with Lolly, disposés comme une seule page sur le canevas](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

**La boîte de dialogue dit ce qu'un lien ne peut pas transporter.** Trois choses n'entrent pas dans une URL : une image ou un fichier ajouté depuis cet appareil, une valeur de texte très longue ou une liste très grande. Chacune est comptée à mesure que le lien se construit. Si quelque chose a dû être abandonné, la boîte de dialogue le nomme et te renvoie au fichier ci-dessous, au lieu de te remettre un lien qui s'ouvre sans l'image. Un lien seulement *long* reçoit une note plus douce avec son nombre de caractères, puisque la compression peut encore sauver la longueur.

### Le fichier .lolly

**Télécharger .lolly**, dans la boîte de dialogue de partage de l'outil où tu travailles, écrit le même design sous forme de fichier. Il emporte la session enregistrée avec les images et les fichiers que tu as ajoutés depuis ton appareil. Les visuels du catalogue sur lesquels le design s'appuie voyagent aussi dedans, si bien que le fichier s'ouvre complet sur une machine qui n'a jamais vu ta marque. Là où ton appareil a une feuille de partage, **Envoyer à…** lui remet ce fichier directement (AirDrop, un partage Android) au lieu de l'enregistrer sur le disque.

Un `.lolly` est un zip ordinaire. Renomme-le `.zip` et ouvre-le : tes propres images sont sous `assets/uploads/` et les visuels du catalogue sous `assets/catalog/`, chacun avec son vrai nom et son extension, `manifest.json` les liste tous et un README à la racine explique ce qu'est le fichier.

Trois choses te reviennent avant qu'il ne parte :

- **Si ton nom y figure.** Ton nom, ton e-mail et ton organisation ne sont inscrits dans le fichier que lorsque **Use my details to create** est activé dans ton profil. Une fois désactivé, le fichier indique qu'il a été créé avec Lolly et quand - rien à ton sujet.
- **Si des visuels sous licence y figurent.** Les ressources sous licence et verrouillées à la marque sont retenues par défaut. Si le design en utilise, la boîte de dialogue indique combien et propose deux boutons - *Download without them* ou *Include and download* - car les inclure remet les fichiers réels à quiconque ouvre le `.lolly`.
- **Si l'outil y figure.** **Include the tool** intègre les fichiers propres de l'outil avec le design, afin qu'il s'ouvre sur un appareil qui n'a pas cet outil. La case est cochée par défaut pour un outil personnalisé - un fork ou un outil de marque privée que ton destinataire risque de ne pas avoir - et décochée pour un outil listé dans le catalogue signé, puisque sa copie provient de la même source. (Sur une version sans catalogue signé, chaque outil compte comme personnalisé et la case démarre cochée.)

**Ouvrir un fichier.** Dépose un `.lolly` sur l'app : les assets vont dans ta bibliothèque, la session va dans Projets et l'outil s'ouvre dessus. Rien de ce qui est à toi n'est écrasé : la session arrive comme un nouvel emplacement enregistré, tandis qu'un asset déjà présent sur cet appareil est reconnu par somme de contrôle et réutilisé plutôt que dupliqué. Chaque partie est vérifiée par rapport aux propres sommes de contrôle du fichier à l'import, donc une copie endommagée en transit est refusée plutôt qu'à moitié importée.

Si le fichier apporte un outil que tu n'as pas, Lolly demande avant que cet outil puisse s'exécuter : **Faire confiance à cet outil ?** le nomme, nomme son auteur et dit clairement que l'ouvrir exécute le code de l'outil sur ton appareil, avec **Faire confiance et installer** comme voie de passage. Refuse et le travail partagé est quand même enregistré dans tes projets, où il attend le jour où tu ajouteras l'outil. (Un type d'outil ne peut pas encore être installé ainsi - celui dont le code arrive sous forme de module - et il est écarté de la même façon.)

Un lien comme un fichier remettent un instantané. Pour travailler sur la même session *en même temps* que quelqu'un d'autre - deux appareils, pas de serveur, pas besoin d'internet si vous êtes sur le même réseau - voir [Travailler ensemble](/info/collaborate.html).

## Caméra en direct (outils réactifs au mouvement)

Chaque **filtre** photo - Halftone, Scanline, Posterize, Voronoi cells, Colour treatment, Pixel stretch et Imperfections - affiche un bouton **Passer en direct** là où une caméra est disponible. Active-le et l'effet suit ta webcam image par image, il réagit donc au mouvement ; tu peux enregistrer le résultat en GIF, WebM ou MP4. Les images sont lues et traitées **sur ton appareil** et n'en sortent jamais, et la caméra est libérée dès que tu arrêtes ou quittes l'outil. (N'importe quel sélecteur d'image dispose aussi de **Prendre une photo** pour capturer une seule image directement sur l'appareil.)

## Mes images

Quand un outil te permet d'ajouter une image depuis ton appareil, elle est conservée exactement telle qu'elle est arrivée - un Content Credential posé dessus se vérifie donc toujours - et enregistrée dans ta bibliothèque personnelle **Mes images** (sous **Profil → Stockage**). Seul un fichier vraiment énorme te demande s'il faut le garder tel quel ou le redimensionner. Réutilise-la dans n'importe quel outil. Pour effacer les données EXIF/GPS à l'arrivée des images, active **Supprimer les métadonnées des imports** dans ton profil. Il n'y a pas de plafond : la bibliothèque est entièrement locale et limitée seulement par le stockage de ton appareil - gère ou supprime les images à cet endroit.

## Le Catalogue - ta bibliothèque de ressources

Le **Catalogue** (`#/c`, ou le segment **Catalogue** du sélecteur Projets · Outils · Utilitaires · Catalogue en haut de chaque vue de liste) rassemble tout ce sur quoi tes outils peuvent s'appuyer - logos de marque, images, audio et animations, regroupés par type - et c'est aussi là que vivent tes **propres fichiers créatifs**. Pas de serveur, pas de console d'administration, pas de pull request : tout est sur ton appareil.

![Le Catalogue - assets de marque, nuances et polices, plus tes propres imports](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=catalogue)

- <!--i:upload--> **Fais entrer tes fichiers.** Fais glisser n'importe quelle image, SVG, clip audio, vidéo, Lottie, PDF ou présentation PowerPoint sur la zone d'import - ou clique pour choisir - et ça arrive instantanément dans ton catalogue, prêt dans le sélecteur d'assets de chaque outil. Un PDF multipage ou un `.pptx` demande quelles pages ou diapositives garder - chacune devient un asset SVG. Importe autant que tu veux ; ça ne quitte jamais ton appareil.
- <!--i:star--> **Mets en favori ce que tu utilises souvent.** ★ un asset (ou une couleur de marque) et il s'épingle en haut de chaque sélecteur, pour que ton logo ou ta couleur habituels soient à un clic.
- <!--i:folder--> **Fais du rangement.** Recatégorise un asset dans un autre groupe, masque un asset de marque partagé que tu n'utilises pas (avec **Afficher les masqués** pour le récupérer) ou supprime carrément tes propres imports. Le même geste de sélection multiple et la même barre d'action flottante que dans Projets fonctionnent ici aussi, donc tout ça peut se faire sur toute une sélection à la fois.
- <!--i:layers--> **Détache une vidéo de son fond.** Ouvre le détail d'une vidéo ou fais un clic droit sur sa carte dans n'importe quel sélecteur d'assets, et choisis **Retirer le fond…** pour enregistrer une alternative transparente - un WebP ou PNG animé avec un vrai canal alpha. Choisis une **Méthode** : un **Modèle sur l'appareil** détoure un sujet dans une scène chargée, ou une **Clé de couleur** détoure un fond uni et bien éclairé comme un fond vert ou un mur uni, avec **Tolérance**, **Douceur** et **Suppression du débordement** pour ajuster le contour. La clé de couleur ne nécessite aucun téléchargement de modèle ni réseau, donc **Retirer le fond** est proposé sur toute vidéo et donne souvent un résultat plus propre sur des images bien nettes. Un contrôle de **Résolution** (360, 480, 720 ou 1080p, jamais au-delà de la source) échange du détail contre un fichier plus petit et plus rapide. Ça tourne en tâche de fond sur ton appareil. Le détourage final est enregistré à côté de l'original comme son propre asset, et le Content Credential de la vidéo source voyage avec en tant qu'ingrédient. (Voir [Généré une fois, rendu à l'identique](/info/ai-features.html) pour comprendre pourquoi retirer un fond reste une simple modification.)

### Emporte ta palette et tes polices partout

Le panneau **Nuancier** du Catalogue ne fait pas qu'afficher - clique sur une couleur pour la copier, ou **télécharge toute la palette de marque** dans le format que parle ton autre outil :

- <!--i:code--> **Design tokens (JSON)**, **variables CSS** ou **classes CSS** - intègre la marque directement dans une feuille de style ou un build ;
- <!--i:palette--> **Adobe Swatch Exchange (.ase)** - charge-la dans Illustrator ou Photoshop ;
- <!--i:pentool--> **Palette GIMP (.gpl)** - pour GIMP ou Inkscape.

![Le panneau Nuancier - les cinq boutons de téléchargement de palette en haut, puis chaque couleur de marque sous forme de pastille copiable](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

Le panneau **Polices** liste tes fontes de marque avec un **téléchargement** à côté de chacune, pour les installer localement ou les remettre à un imprimeur. (La salle Couleurs du [Brand Studio](/info/brand-studio.html) propose le même téléchargement de palette.)

Les ressources sont une moitié du chemin ouvert et « fais-le toi-même » ; l'autre, c'est **créer tes propres outils** - le canevas libre (Design, décrit ci-dessus) te permet d'en construire un visuellement, sans aucun code.

## Son et accessibilité

Lolly vise à être confortable à utiliser pour tout le monde. L'interface est navigable au clavier, les contrôles personnalisés portent des libellés adaptés aux lecteurs d'écran et l'aperçu en direct de chaque outil est exposé comme une image unique et libellée décrivant ce qu'il produit.

Une couche discrète de **sons d'assistance** confirme tes actions - l'arrivée dans la galerie, une vérification Content Credentials valide ou invalide, la fermeture d'un panneau, le changement de filtre. C'est **désactivé par défaut** : active le **son** partout où l'interrupteur apparaît (le popover d'options de chaque vue, ou le **Profil**), et le choix est mémorisé.

Quatre réglages de confort optionnels vivent sous **Profil → Accessibilité** : **Réduire les animations** (supprime les transitions et fioritures de l'application), **Masquer les aperçus colorés** (cartes de galerie calmes, en icône et texte, et vignettes de projet plus sobres), **Contraste élevé** (bordures, textes et anneaux de focus plus marqués) et **Grand texte** (typographie d'application plus grande - libellés, menus, texte des boutons). Tous les quatre apaisent l'application *autour* de ton travail : ils n'entrent jamais dans le canevas d'un outil et ne changent pas un pixel de ce que tu exportes, et chacun est désactivé tant que tu ne l'actives pas. Détails complets dans [Ton profil → Accessibilité](/info/profile.html#accessibility).

À côté de l'interrupteur Son se trouve le **Mode Neurospicy** - une piste de fond apaisante et facultative, qui joue discrètement pendant que tu travailles. L'activer ouvre un petit **dock de lecture** dans le coin inférieur qui te suit dans toute l'application ; depuis là, tu peux rechercher et choisir une piste, avancer et reculer, régler le volume et le réduire ou le fermer. La liste de pistes couvre quelques catégories - des morceaux procéduraux *Lolly Sings*, des boucles et rythmes d'ambiance, tes propres fichiers audio importés et une poignée de stations de **radio** internet en direct (celles-ci nécessitent une connexion ; tout le reste se joue hors ligne). C'est **désactivé par défaut** et, comme le son, mémorisé d'une session et d'un appareil à l'autre. Désactiver le son coupe aussi la piste de concentration.

## Stockage et confidentialité

Tout est stocké dans la base de données locale de ton navigateur (IndexedDB) : ton profil, tes sessions enregistrées, tes images importées et un cache du contenu de catalogue téléchargé. **Profil → Stockage** affiche l'utilisation et te permet de :

- <!--i:box--> **Vider le cache** - supprimer le contenu de catalogue téléchargé (se resynchronise au prochain chargement).
- <!--i:trash--> **Effacer toutes mes données** - supprimer le profil, les sessions et les images. *Action irréversible.*

![La carte de stockage sur un écran de largeur téléphone : chaque catégorie de données présentes sur l'appareil est nommée, avec le bouton Effacer toutes mes données en bas](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Aucune de ces données locales n'est transmise où que ce soit - pas de télémétrie, pas de rendu dans le cloud. La liste complète de ce que l'application récupère ou envoie se trouve dans la [Politique de confidentialité](/info/privacy.html), et [Surface serveur](/info/server-surface.html) recense les composants serveur facultatifs.

## Passer à un autre appareil

Comme tout réside sur ton appareil, **Profil → Stockage → Déplacer vers un autre appareil** te permet de tout emporter vers une seconde installation - sans compte, sans cloud :

- <!--i:download--> **Exporter mes données** télécharge un unique `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (les parties du nom viennent de ton profil et sont omises si elles ne sont pas renseignées ; `<n>` est un compteur journalier pour que deux exports le même jour ne se percutent pas) contenant ton profil, chaque session enregistrée (avec sa vignette), tes images importées et tes préférences (thème, largeur de la barre latérale, statistiques d'activité locales).
- <!--i:upload--> **Importer les données…** sur l'autre installation relit ce fichier. Cela **fusionne** : tout élément portant le même nom (ton profil, un emplacement de session, une image) est remplacé par la copie importée ; tout le reste sur cet appareil est conservé. Les sessions enregistrées se relient automatiquement à tes images importées.

Le cache de catalogue n'est pas inclus - il se retélécharge tout seul sur le nouvel appareil. Le paquet est un simple zip (`manifest.json` + `profile.json` + `sessions.json` + `assets.json` + `assets/blobs/…` + `prefs.json`, identifiant de format `lolly-backup`), donc il survit intact à un e-mail, une clé USB ou un AirDrop, et c'est le même format que lit chaque shell. Chaque partie est vérifiée par somme de contrôle, donc un fichier endommagé en transit est détecté à l'import plutôt que restauré à moitié cassé. (Spécification complète du format : [Transfert de données](/info/data-transfer.html).)

## Importer un design (Figma, Penpot, Illustrator, InDesign)

Tu peux importer un design existant dans Lolly et continuer à y travailler : ouvre **Design**, clique sur **Importer un design** dans la barre d'outils du canevas et choisis un fichier Figma **.fig** ou SVG, un Penpot **.penpot**, un Illustrator **.ai** / **.pdf** ou un InDesign **.idml**. Les calques deviennent des boîtes modifiables sur le canevas libre - le texte reste re-saisissable, les images atterrissent dans **Mes images** et la typographie et les couleurs se conforment aux globales de marque - puis le résultat s'enregistre, se partage et se rend comme n'importe quelle autre session. L'analyse se fait entièrement sur ton appareil. Détails complets : **[Importer un design](/info/design-import.html)**.

## Exporter

Consulte **[Export et formats](/info/exporting.html)** pour l'histoire complète - choisir un format, une taille de sortie et des unités d'impression, la transparence, la vidéo et la copie/le partage. En bref : choisis un format, règle la taille si besoin et **Télécharge** (ou **Copie** dans le presse-papiers).

## Mode Batch (Pro)

Pour les utilisateurs avancés, **Batch** (accessible depuis la galerie, réservé au drapeau de fonctionnalité Pro, activé par défaut) rend de nombreuses variantes d'un coup - une grille où chaque ligne est un ensemble de champs, exportés ensemble. Idéal pour localiser une carte en une douzaine de langues ou générer toutes les variantes de taille en une seule passe. Remplis les lignes en tapant, en collant directement depuis un tableur ou en important un CSV (tu peux aussi en exporter un), et règle le format, la taille et le nom de fichier de sortie ligne par ligne. Enregistre toute une grille comme une **session batch** nommée qui se rouvre depuis la galerie, et télécharge chaque ligne dans un seul `.zip`.

![La barre d'outils Batch - nom du zip, unités, DPI et le format hérité par chaque ligne, avec Sessions et Rendre à droite](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.pro-toolbar&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

Batch sert à générer **de nombreuses variantes d'un même modèle** d'un coup. Pour re-rendre des sessions que tu as **déjà enregistrées**, utilise **Projets → Rendre le dossier / Rendre la sélection** (ci-dessus) - pas besoin de Pro.

## Modifier côte à côte (Multi-édition)

Batch, c'est plusieurs variantes d'*un seul* design. **Multi-Edit** est l'autre moitié du travail : plusieurs designs enregistrés **différents** ouverts en même temps, pour qu'une modification s'applique à tous. Coche entre **deux et huit** sessions enregistrées dans **Projets** et choisis **Modifier ensemble** dans la barre de sélection ; elles s'ouvrent en cartes live côte à côte à `#/multi?s=<slot>,<slot>…`. Chaque carte est un vrai rendu de cette session, pas une miniature stockée, donc ce que tu vois est ce qui sera exporté.

Une seule barre latérale pilote l'ensemble :

- <!--i:sliders--> **Partagés** ouvre la marche - chaque champ que deux sessions sélectionnées ou plus déclarent de la *même façon* (même id, même type, mêmes contraintes - la règle de fusion qu'applique la grille de lot à ses colonnes). Modifie un contrôle partagé une fois et la valeur se diffuse à chaque session qui le déclare, en direct sur chaque carte. Deux sessions du même outil partagent tout ; deux outils différents ne partagent que ce qu'ils ont en commun, rien de plus.
- <!--i:document--> En dessous, **une carte repliée par session** avec tous les champs propres à cette session, avec la même fidélité que la barre latérale de l'outil - sélecteurs d'assets, groupes de lignes répétitives, champs de couleur - plus un bloc d'export compact : **Format**, **L** / **H**, **Unité**, **DPI** et son propre **Télécharger**. Ce Télécharger enregistre d'abord la session puis la rend par le chemin d'export de session ordinaire, si bien que le fichier porte le même nom, le même format et les mêmes Content Credentials que depuis l'outil lui-même.
- <!--i:search--> **Filtrer les champs…** en haut réduit les contrôles de *toutes* les cartes d'un coup - c'est comme ça qu'on atteint « le titre » dans huit sessions sans le chercher en défilant.

Clique sur un canevas (ou appuie sur Entrée dessus) et la carte de barre latérale de cette session s'ouvre et défile jusqu'à être visible. **Tout enregistrer** réécrit chaque session dans son propre emplacement. **Tout télécharger** enregistre d'abord, puis rend l'ensemble par la même chaîne que **Rendre la sélection** dans Projets - un seul zip, avec le verrou par mot de passe facultatif proposé au passage.

Deux limites assumées. Le plafond de deux à huit est réel : chaque carte monte son propre runtime en direct, et c'est le nombre qui reste réactif - un lien qui en demande plus (ou qui demande une session qui n'existe plus) le dit plutôt que de charger à moitié. Et le lien nomme *tes* emplacements enregistrés, il rouvre donc cet ensemble sur cet appareil ; ce n'est pas un lien de partage.

Quand la sélection dépasse huit éléments, mélange des outils ou contient des images en plus des sessions, la porte de sortie est **Modifier en feuille** dans la même barre de sélection : elle ouvre toute la sélection en **lignes dans la grille de lot** (`#/pro?s=…`), sans limite de taille ni règle du même outil. Les dossiers restent en dehors des deux - ils ont leur propre chemin d'ouverture en grille. ([Recherche](/info/search.html) est la seule chose qui n'atteint pas encore cet endroit : la Multi-édition est la seule vue que la barre de recherche ne connaît pas.)

## Hors ligne et installation

Lolly est une PWA. Après le premier chargement, elle fonctionne **hors ligne** - installe-la depuis la barre d'adresse de ton navigateur (ou *Ajouter à l'écran d'accueil* sur mobile) pour une expérience plein écran, comme une application. Elle se met à jour toute seule dès que tu es de nouveau en ligne.

À propos des mises à jour : si une vue ne charge pas juste après une mise à jour (un panneau vide, un « failed to fetch » dans un coin), recharge la page une fois - l'app récupère proprement la nouvelle version et ton travail, tes sessions et ta marque restent intacts. Elle stocke tout sur ton appareil, pas dans la page.
