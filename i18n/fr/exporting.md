# Export et formats

Comment obtenir un fichier fini à partir d'un outil - choisir le bon format, définir la taille de sortie et ce que fait chaque option. Comme pour tout le reste, **l'export se fait sur ton appareil** ; rien n'est envoyé en ligne.

## Comment fonctionne l'export

L'aperçu *est* le fichier. Quand tu exportes, l'hôte rend ce canevas dans le format choisi et te fournit un téléchargement (ou le place dans ton presse-papiers). Un outil ne propose que les formats déclarés par son auteur, et le sélecteur masque ceux que ton navigateur ne peut pas produire (voir [Video](#video)).

Trois voies produisent un fichier. La plupart des outils **rendent le canevas** dans le format choisi. Les formats texte et données (HTML, MD, TXT, JSON, CSV, ICS, VCF) sont au contraire **générés à partir du contenu de l'outil**, pas rastérisés depuis l'image. Et les utilitaires de confidentialité (par ex. *Strip Hidden Data*) empruntent une troisième voie : le fichier que *tu* choisis est transformé octet par octet sur ton appareil et rendu tel quel - pas de canevas, pas de filigrane et pas de métadonnées de provenance ajoutées, puisque c'est déjà ton propre fichier.

Les actions dans les contrôles d'export :

- <!--i:download--> **Download** - enregistrer le fichier (l'action principale).
- <!--i:photos--> **Copy** - mettre l'image dans ton presse-papiers pour la coller directement dans Slack, un e-mail, un document. Là où un navigateur ne peut pas copier d'images, il télécharge à la place et te le signale.
- <!--i:folder--> **Save** - conserver le design actuel comme une session d'outil sauvegardée dans ta bibliothèque.
- <!--i:link--> **Share** - ouvre la **boîte de dialogue Share** : un lien copiable qui reproduit le design, des bascules à l'ouverture (plein écran, panneau d'export, téléchargement ou copie à l'ouverture) et un **Shortest link** optionnel qui compresse tout l'état dans un jeton compact (voir [URL Mode](/info/url-mode.html)).

(L'auteur d'un outil choisit lesquelles de ces actions apparaissent ; l'ensemble par défaut est Copy, Download et Save.)

![Le panneau d'export - format, taille et les actions Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Share s'ouvre par-dessus l'outil, avec le lien déjà construit et les bascules à l'ouverture en dessous.

### Rendre plusieurs éléments à la fois

Un export unique donne un seul fichier, mais tu peux en rendre **plusieurs** en une seule passe - chacun livré sous forme d'un `.zip` :

- <!--i:folder--> **Projects → Render folder** exporte chaque session sauvegardée d'un dossier (et de ses sous-dossiers) sous forme d'un seul zip imbriqué ; **Render selection** fait la même chose pour toute sélection multiple ; une seule session sauvegardée s'exporte directement dans son propre fichier. Pas besoin de Batch/Pro - voir [Using Lolly → Projects](/info/using.html).
- <!--i:layers--> **Batch (Pro)** rend une grille d'ensembles d'entrées - chaque variante d'un même modèle à la fois.

Une session sauvegardée peut aussi être repartagée comme lien d'outil depuis Projects (elle reconstruit l'URL de l'outil à partir des entrées sauvegardées), de sorte qu'un lien la rouvre avec exactement les mêmes réglages.

## Choisir un format

Le nom de fichier et le sélecteur de format se trouvent en haut du panneau, formant une seule paire `nom.format`, et le sélecteur ne liste que les formats déclarés par l'auteur de cet outil.

![Le champ du nom de fichier fusionné au sélecteur de format, de sorte que l'export se lit comme une seule paire nom.format](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

| Tu veux… | Utilise | Pourquoi |
|---|---|---|
| Des logos / illustrations nets qui s'adaptent à l'échelle | **SVG** | Vectoriel - infiniment redimensionnable, léger, modifiable |
| Du vectoriel pour Office / applications Windows | **EMF** | Se colle comme vecteur modifiable dans PowerPoint / Word ; le texte reste actif et modifiable, et Google Drive l'ouvre dans Google Drawings pour Slides |
| Du vectoriel pour l'impression / applications de design | **EPS**, ou **EPS (CMJN)** | Vectoriel PostScript pour Illustrator / flux d'impression |
| Du vectoriel pour découpe / machines CAO | **DXF** | Découpeuses laser, traceurs vinyle, CNC - tracés de contour en millimètres |
| Une présentation modifiable | **PowerPoint** (PPTX) | Texte et formes natifs modifiables, images et vecteurs extractibles |
| Un cours qu'un LMS peut importer | **SCORM** (LMS) | Un zip avec le manifeste, une page de lancement, les diapositives et le film narré avec sous-titres - à partir d'une présentation Design |
| Un document texte modifiable | **Word** (DOCX) ou **OpenDocument** (ODT) | De vrais paragraphes et titres qu'un traitement de texte peut continuer à modifier (Doc Studio) |
| Une photo ou une image polyvalente | **PNG** (sans perte) ou **JPG** (plus léger) | Raster universel |
| Des images modernes plus légères | **WebP** / **AVIF** | Meilleure compression, alpha |
| Impression | **PDF**, ou **Print PDF** (CMJN) | Taille de page réelle ; CMJN pour l'impression |
| Raster d'impression pour une presse | **Print TIFF** (CMJN) | Pixels DeviceCMYK pour un RIP |
| Animé pour le web | **GIF** | Fonctionne partout, fichiers plus lourds |
| Animé en couleurs complètes + vrai alpha | **APNG** | PNG animé - pas de limite de palette, transparence réelle |
| Animé, fichier le plus léger | **WebP animé** | Couleurs complètes + alpha, mieux compressé que GIF ou APNG |
| Vectoriel animé qui s'adapte à l'échelle | **SVG animé** | Autonome ; boucle dans un navigateur ou une balise `<img>`, sans codec, à toute taille |
| Vidéo pour les réseaux sociaux / le partage | **MP4** ou **WebM** | Meilleure qualité par octet (voir ci-dessous) |
| Texte enrichi / signature e-mail | **HTML** | Se colle formaté dans les clients de messagerie |
| Contenu brut | **MD** / **TXT** | Texte seul |
| Un événement de calendrier | **ICS** | S'importe dans toute application de calendrier |
| Une carte de contact | **VCF** | S'importe dans Contacts / carnets d'adresses |
| Des données structurées à réimporter | **JSON** / **CSV** | Fait l'aller-retour avec le contenu de l'outil |
| Une favicon | **ICO** | Icône de site multi-taille (**ZIP** regroupe plusieurs formats) |

La première ligne est le cas courant. Un logotype composé dans la police de ta marque s'exporte en SVG, où chaque lettre est un tracé détouré plutôt qu'un pixel, donc il reste net aussi bien à la taille d'une carte de visite qu'à celle d'un habillage de bâtiment, à partir du même fichier.

![Un logotype fin à interlettrage large affichant Aurora, le type même d'illustration purement vectorielle dont parle la ligne SVG du tableau](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-wordmark-vector)

## Taille et unités d'impression

Par défaut, les exports utilisent la taille en pixels native de l'outil. Là où un outil expose des **dimensions**, tu peux définir largeur × hauteur et une **unité** :

- **px** (par défaut) - pixels exacts.
- **mm · cm · in · pt · pc** - tailles physiques/d'impression. Avec une unité physique, tu définis aussi le **DPI** (par défaut **300** pour l'impression) ; le moteur convertit correctement selon le format - **PDF** devient une vraie page à cette taille, le **raster** se rend au bon nombre de pixels pour le DPI (et intègre la résolution), **SVG** conserve l'unité physique avec un viewBox en px.

Pour obtenir un raster en plus haute résolution, saisis une largeur/hauteur plus grande, ou choisis une unité physique et augmente le DPI (pixels = taille × DPI). Il n'y a pas de bascule d'échelle en un clic.

Exemple : largeur `210`, hauteur `297`, unité `mm` → une page A4.

![La ligne des dimensions réglée sur 210 par 297 mm, avec le champ DPI révélé parce que l'unité est physique](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Images fixes depuis une composition temporisée

Une **composition temporelle** - une chronologie [Sequence](/info/using.html#timeline-sequence) dans Design, ou tout artboard piloté par une chronologie - est une chose en mouvement, donc un export fixe doit répondre à "quel instant ?". La règle est celle à laquelle on s'attend : **l'image à la position de lecture**. Positionne la tête de lecture où tu veux l'image et exporte ; ce que tu vois est ce qui en ressort.

Quand tu veux plus d'un instant, le champ **Frames** apparaît à côté de la taille de sortie (uniquement pour une composition temporisée, et uniquement pour un format fixe - PNG, JPG, WebP, SVG ou PDF). Laisse-le à `1` pour l'image à la tête de lecture. Augmente-le et tu obtiens ce nombre d'images fixes échantillonnées à intervalles égaux sur toute la séquence :

- **Raster et SVG** reviennent sous forme d'un seul **zip** - `<name>-01.png`, `-02.png` et ainsi de suite.
- **PDF** revient sous la forme d'un **document unique comptant ce nombre de pages**.

Utile pour un storyboard, une planche de vignettes, une planche-contact pour révision ou un carrousel social découpé directement dans un montage vidéo.

L'échantillonnage se fait au **milieu** de chaque intervalle plutôt qu'à ses bords, car le premier instant d'une séquence est souvent une transition d'entrée qui n'a pas encore terminé son fondu, et le dernier est l'état après la fin de chaque clip - un échantillonnage aux extrémités gaspillerait deux de tes images sur des images quasi vides. Le nombre est plafonné à **64** (une planche-contact est faite pour être lue par un humain), et toute saisie incohérente dans le champ retombe sur `1` plutôt que de faire échouer l'export. Chaque image est une image fixe ordinaire, donc Content Credentials, l'imprint, les unités physiques et le DPI se comportent exactement comme pour un export unique.

Le champ **Frames** est aujourd'hui le moyen d'obtenir une planche. Le moteur réserve un paramètre d'URL `cuts` correspondant, mais aucun shell ne le lit encore depuis un lien, donc un lien partagé se rouvre toujours sur l'image à la tête de lecture - voir [URL Mode](/info/url-mode.html#contact-sheets-cuts).

## PDF multi-pages

Certains outils construisent un **document PDF multi-pages** au lieu d'une œuvre unique - une couverture, un contenu qui s'étale sur autant de pages que nécessaire et une quatrième de couverture, le tout dans un seul fichier (voir l'outil *Booklet*). Chaque page est une **vraie page PDF** dimensionnée à la boîte de cette page, donc les lecteurs et les imprimeurs obtiennent de vraies pages, pas une seule image tout en hauteur.

- **Pages générées à partir du contenu.** Ajoute des blocs de texte et d'images ; de nouvelles pages se créent automatiquement à mesure que les blocs se remplissent, et tu peux forcer n'importe quel bloc à commencer une nouvelle page.
- **Vraies tailles de page.** Choisis A4, US Letter ou A5 (portrait - la mise en page à deux colonnes est conçue pour ça) - chaque page, et le PDF exporté, se rend exactement à cette taille.

Les PDF multi-pages sont des documents RGB et ne portent pas de repères de coupe/fond perdu - cela relève du chemin **Print PDF** mono-page ci-dessus. Ils portent en revanche les mêmes **métadonnées PDF/X-4** que tout export PDF (boîtes de page, XMP, identifiant de document, un intent de sortie sRGB avec profil intégré), et ils proposent les **Content Credentials** (ci-dessous) - sur l'outil *Booklet*, l'option est présélectionnée.

## Créer beaucoup de choses à la fois

Lolly propose trois façons distinctes de travailler en volume, et elles résolvent des besoins différents - l'édition par lots est une capacité de premier ordre de la plateforme, pas quelque chose que chaque outil réinvente :

- <!--i:document--> **Un design × un tableau de lignes → un document multi-pages.** Les outils avec une entrée `table` (comme *Battlecards*) transforment automatiquement chaque ligne en page - colle un tableau depuis ton tableur, obtiens un PDF façon deck. Ton vrai éditeur par lots reste le tableur : corrige dix lignes là-bas, colle à nouveau. L'outil lui-même ne gère jamais les pages.
- <!--i:layers--> **Un design × un fichier de données → plusieurs fichiers séparés.** La grille de lot `/pro` prend un CSV et rend un export *par ligne* - badges nominatifs, certificats, un fichier chacun.
- <!--i:sliders--> **Plusieurs assets différents, édités côte à côte.** *Multi-edit* ouvre plusieurs sessions sauvegardées dans une seule vue pour des retouches coordonnées sur des designs distincts.

Règle empirique : des lignes du même design qui appartiennent à **un seul document** → un outil piloté par tableau ; des lignes qui doivent sortir en **fichiers séparés** → `/pro` ; des **designs différents** qui ont besoin de la même retouche → multi-edit. (Une option de rendu « combine media » prévue fera le pont entre les deux premières - en concaténant des exports de même format en un seul PDF, une seule vidéo ou une planche-contact de vérification.)

## PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart et Diagrams peuvent exporter une **présentation PowerPoint** - une diapositive par page. Le but n'est pas une capture d'écran pixel-perfect ; c'est de remettre à un collègue une présentation qu'il peut réellement **modifier et dont il peut extraire les éléments**. Chaque page est donc décomposée en objets natifs :

- <!--i:font--> Le **texte** devient de vraies **zones de texte PowerPoint modifiables** - avec la taille de police, la couleur, la graisse, l'italique et l'alignement de la mise en page - pour que tu puisses corriger une coquille ou restyliser dans PowerPoint.
- <!--i:pentool--> Les **vecteurs** (logos, icônes, la marque SUSE) sont intégrés comme de vraies **images SVG** - ils restent nets à toute taille, et PowerPoint peut même leur appliquer *Convertir en forme*.
- <!--i:photos--> Les **images** arrivent à leur résolution native comme leurs propres images extractibles (un visuel recadré en `cover` conserve l'image complète derrière le cadrage, pour que tu puisses recadrer à nouveau), avec tout traitement appliqué sur l'image (filtres, fusions) intégré fidèlement.
- <!--i:layers--> Les **arrière-plans, bordures et règles** deviennent de vraies formes rectangle/ligne.

![Le panneau d'export avec PowerPoint sélectionné : une diapositive par page, texte et formes restent modifiables](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

La mise en page est volontairement approximative - l'objectif est un **contenu** fidèle et réutilisable, pas une capture d'écran figée. Tout ce que le walker ne peut pas exprimer nativement (une zone complexe filtrée ou masquée) est intégré comme une image pour ne rien perdre. Un diaporama a une seule taille de diapositive, reprise de la première page.

PowerPoint est aussi une voie d'**entrée**. Dépose un `.pptx` sur n'importe quelle zone d'upload et choisis les diapositives voulues - chacune devient un élément à placer, retoucher ou sur lequel construire. **Markdown Slides** écrit une nouvelle présentation à partir de Markdown (et fournit un modèle `.pptx` à ta marque), et l'utilitaire **Rebrand** rethème une présentation existante sur place - palette du thème, couleurs et polices en dur - sans toucher à ses graphiques, SmartArt ou animations, et renvoie un `.pptx`. Voir [Importer un design → Présentations et documents](/info/design-import.html#decks-and-documents).

## Penpot

Tout outil capable d'exporter en SVG peut aussi exporter un **fichier Penpot** (`.penpot`) - le document, prêt à continuer d'être modifié dans Penpot plutôt qu'à être seulement regardé.

- <!--i:layout--> Depuis **Design**, chaque cadre devient un **board** Penpot, chaque boîte qu'il contient est reprise comme sa propre forme modifiable - rectangle, ellipse, texte, image ou tracé - et le résultat arrive comme **composant** réutilisable dans le panneau Assets, prêt à être ressorti par glisser-déposer.
- <!--i:pentool--> Depuis un outil dont le rendu est de la **géométrie pure** - les outils vectoriels comme QR Code, Street Map, Wordmark et Palette Lab - chaque tracé, rectangle, ligne de texte et dégradé est repris de la même façon, comme sa propre forme modifiable.
- <!--i:font--> Depuis un outil qui construit son rendu en **HTML**, **le texte reste du texte** - un objet texte Penpot modifiable par ligne, pas un contour et pas une image plate. Une illustration pour laquelle Penpot n'a pas de construction - une illustration complexe, un canvas en direct - est reprise à part comme une image, de sorte qu'elle n'aplatit jamais le texte et les boîtes qui l'entourent. Une mise en page entière que Penpot ne peut pas séparer fidèlement peut quand même arriver comme une seule image en pleine fidélité, donc rien n'est jamais perdu.
- <!--i:palette--> Une couleur ou une police qu'une forme **hérite d'un token de marque** reste **liée** à ce token dans le fichier : change le token dans le panneau Tokens de Penpot et toutes les formes qui en héritent se repeignent ensemble, tandis qu'une couleur littérale ponctuelle reste exactement où elle est. Les couleurs et typographies de la marque atterrissent aussi dans le panneau **Assets**, et son jeu complet de design tokens dans le panneau **Tokens** - le même jeu de tokens DTCG que la propre palette de Lolly utilise. Penpot en garde sa propre copie à partir de là : une modification faite dans son panneau Tokens revient dans la marque via [l'import de Brand Studio](/info/design-import.html), pas d'elle-même.

| Ce que tu as créé | Dans Penpot |
|---|---|
| Texte | Objets texte modifiables - corriger une coquille ou restyler |
| Formes, tracés, dégradés, images | Leurs propres formes vectorielles modifiables |
| Une couleur ou une police issue d'un token de marque | Un lien de token en direct - modifie le token, toutes les formes qui en héritent suivent |
| Le design entier | Un composant réutilisable dans le panneau Assets |
| Une illustration complexe ou un canvas en direct | Intégré à part comme une image, le contenu modifiable autour reste intact |

![Le panneau d'export avec Penpot sélectionné : le fichier .penpot, et Send to Penpot à côté du téléchargement](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Pour l'ouvrir, lance Penpot, choisis un projet et sélectionne **Import**. Connecté à Penpot depuis le panneau d'export, **Send to Penpot** fait cette étape à ta place - choisis un projet là-bas et le fichier y va directement.

## SCORM (packages de cours)

Une présentation Design peut sortir comme **package SCORM** - le zip qu'un système de gestion de l'apprentissage importe, que ce soit Moodle, Canvas, Blackboard ou un LMS d'entreprise. Choisis **SCORM (LMS)** dans le sélecteur de format et l'export écrit :

- <!--i:layout--> **Les diapositives**, une image par artboard, en vectoriel là où l'artboard le permet et en pixels seulement là où ce n'est pas le cas.
- <!--i:play--> **Le film narré** avec sa piste de sous-titres - les notes du présentateur lues par une voix sur l'appareil, exactement comme [Presenting](/info/create/using.html#presenting) les joue.
- <!--i:file--> **Une page de lancement** qui déroule les diapositives, joue le film et signale la complétion au LMS via le runtime SCORM 1.2, la version que tout LMS accepte.
- <!--i:font--> Les polices utilisées par la présentation, pour que la page de lancement rende à l'identique hors ligne.

![Le panneau d'export sur une présentation Design avec SCORM (LMS) sélectionné](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Rien dans le package n'appelle vers l'extérieur : ce sont des fichiers dans un zip, et il fonctionne à l'intérieur du LMS sans bundler, sans CDN et sans compte. Les applications web et desktop le construisent ; le CLI non, parce que photographier les artboards et encoder le film nécessitent le navigateur.

## DXF (fichiers de découpe)

Les outils vectoriels (Brand Lockup, QR Code, Street Map, Wayfinding Signage, Pose Geeko, les lockups de logo, Diagram Builder) peuvent exporter en **DXF** - le format d'échange AutoCAD R12 que lisent les découpeuses laser, les traceurs vinyle et les logiciels CNC/CAO. La géométrie est écrite comme des **chemins de contour en millimètres** (courbes aplaties avec une tolérance fine), le texte est converti en chemins et la couleur est associée à l'AutoCAD Color Index le plus proche (qui pilote généralement l'outil ou l'opération sur une découpeuse). DXF n'est que du dessin au trait - une zone photographique ou filtrée n'a pas de forme de chemin de coupe et est abandonnée (Lolly prévient), utilise donc SVG/PDF quand tu dois conserver du contenu raster.

Street Map est le cas le plus clair : le design entier est déjà composé de traits, donc chaque route et canal devient un chemin de découpe sans rien à abandonner.

::: showcase
![Un rendu Street Map de Paris à l'encre sur crème - du pur trait, si bien que chaque trait survit au voyage vers une découpeuse](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Fais défiler, et la caméra recule à travers la géométrie réelle : sept chemins, aucun pixel nulle part, chaque trait net comme un cheveu à tout niveau de zoom. C'est le même fichier que lit une découpeuse.
:::

## SVG animé

Les outils d'animation (Animated Ad, Lottie Ad) peuvent exporter en **SVG animé** - une animation *vectorielle* autonome. Contrairement au GIF/APNG/WebP (qui échantillonnent chaque image en pixels), un SVG animé empile des instantanés vectoriels avec des images-clés CSS intégrées, si bien qu'il **s'adapte à toute taille sans codec et sans environnement d'exécution externe** - il boucle dans un onglet de navigateur ou une balise `<img>`. Le texte reste converti en contour pour s'afficher partout. Il partage les contrôles **Durée**/fréquence d'images des formats animés, et (étant plus lourd par image qu'un bitmap) utilise une fréquence d'images par défaut plus basse.

## Transparence

Les outils qui le prennent en charge proposent un bouton **arrière-plan transparent** (par ex. *No BG*). La transparence est préservée par PNG, WebP, AVIF, SVG (fixe et animé), APNG et WebP animé. JPG et PDF sont toujours opaques, et TIFF s'aplatit sur blanc (sur noir sur le chemin HDR - voir ci-dessous).

## Espaces colorimétriques

Deux questions différentes, à garder séparées : quels espaces colorimétriques Lolly peut **lire et penser**, et lesquels il **écrit**.

**Lecture.** Partout où une couleur est écrite - la feuille de style d'un outil, la couleur d'un SVG importé, la valeur d'un jeton de design, une ombre ou un dégradé dans un raccourci CSS - Lolly lit tout le vocabulaire **CSS Color 4** : `#hex`, `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, les couleurs nommées CSS et `color()` dans les espaces prédéfinis - `srgb`, `srgb-linear`, `display-p3`, `a98-rgb`, `prophoto-rgb`, `rec2020`, `xyz-d50`, `xyz-d65` - y compris les composants écrits avec le mot-clé `none`. Un seul analyseur fait cela pour toute la plateforme, si bien que le navigateur et chaque walker d'export s'accordent sur le sens d'une chaîne de couleur.

Cela compte plus qu'il n'y paraît, car un navigateur résout du CSS moderne en CSS moderne. Écris `color-mix(in oklab, …)` et Chrome calcule `oklab(…)` ; utilise un jeton de marque stocké en `oklch()` et c'est la valeur littérale que voit le walker d'export. Les couleurs sous ces formes sont lues correctement plutôt qu'abandonnées - ce qu'un walker ne comprenant que `rgb()` faisait, exportant un texte de couleur de marque en noir, perdant des panneaux teintés et des règles de tableau, et lisant `oklch(0.7 0.1 200) 0px 2px 4px` comme un décalage d'ombre de 0,7 sur 0,1.

**Réflexion.** Les mathématiques de couleur se font de façon perceptuelle plutôt que dans des canaux bruts. La dérivation de palette, les dégradés, les harmonies et le contraste tournent en **OKLCH/OKLab**, et une couleur hors gamut est ramenée dans la plage par l'algorithme de mappage de gamut propre à CSS Color 4 - une réduction de chroma avec une vérification de distance perceptuelle - plutôt que par écrêtage des canaux, donc une couleur vive se stabilise sur la couleur la plus proche que tu accepterais vraiment plutôt que sur une version aplatie. Les dégradés interpolent dans un espace que tu choisis (OKLab par défaut, ou `oklch`, `lab`, `lch`, `srgb`, `srgb-linear`, `hsl`, avec une direction de parcours de teinte pour les espaces polaires), et le mélange est **prémultiplié**, donc un fondu vers le transparent garde la bonne couleur au lieu de s'assombrir vers le noir en chemin. Un seul interpolateur sert à la fois l'aperçu et les walkers d'export - c'est précisément ce qui a empêché un dégradé conique d'être mélangé d'une façon à l'écran et d'une autre dans le fichier exporté.

**Écriture.** La sortie est délibérément plus étroite que l'entrée, car un fichier doit être lisible par ce qui l'ouvre, et un espace n'est *déclaré* en sortie que lorsque les nombres y ont été réellement convertis. Les formats écran et web sont écrits en **sRGB** et étiquetés comme tels ; les formats impression sont écrits en **CMJN** par rapport à une condition presse nommée (ci-dessous) ; et le chemin HDR est en **Rec.2100 PQ** (ci-dessus). Une couleur grand gamut qui atteint un export est ramenée en sRGB plutôt que mal étiquetée - faire passer `color(display-p3 …)` dans un fichier vectoriel est une extension prévue, pas quelque chose que les exports actuels prétendent faire. Un dégradé créé en OKLab est *cuit* en simples arrêts sRGB à la sortie, avec des arrêts supplémentaires insérés uniquement là où le sRGB divergerait visiblement de la courbe perceptuelle, car un `<linearGradient>` SVG et un dégradé axial PDF n'ont aucun réglage d'espace d'interpolation pour porter l'intention. Une valeur créée, trois moteurs de rendu, aucune dérive.

## Profils colorimétriques

Pour que les couleurs se reproduisent fidèlement dans les applications à gestion des couleurs (imprimeurs, Photoshop, navigateurs), les exports sont **étiquetés avec un profil colorimétrique** :

- **PNG / JPG** portent un profil ICC **sRGB** intégré - l'espace colorimétrique dans lequel l'aperçu est réellement rendu - pour ne rien laisser à deviner. (Étiquetage seulement ; les pixels ne sont pas réencodés.)
- Le **PDF impression (CMJN)** déclare une **condition presse** cible dans son *OutputIntent* (par défaut *Coated FOGRA39*), indiquant à un RIP/imprimeur comment ses encres CMJN doivent être lues. Les couleurs de marque avec valeurs d'encre mesurées sont converties exactement ; les autres couleurs utilisent une conversion périphérique standard. Cette déclaration est un *nom* : aucun profil CMJN n'est fourni avec Lolly, et le PDF/X-4 exige que le profil soit intégré, donc une condition nommée écrit l'intention de sortie sans revendiquer la conformité PDF/X-4. Charge un profil CMJN à toi et choisis sa ligne **Intégrer** dans le contrôle de profil colorimétrique et il est intégré comme *DestOutputProfile* du fichier - à ce moment-là, le PDF peut être authentiquement PDF/X-4, et le revendique dès que le reste du fichier le permet. Trois choses retiennent la revendication tout en conservant l'intention de sortie (un RIP en a toujours besoin) : les visuels RVB que la passe CMJN n'a pas pu convertir, le texte de crédit de marge de preuve `prov` (dessiné dans une police standard non intégrée, et le X-4 ne fait pas d'exception pour cela) et un mot de passe **fort**, car le X-4 interdit le chiffrement. La condition qu'il déclare est ensuite lue sur ce profil : un nom enregistré là où le profil en prouve un, `Custom` sous le nom propre du profil là où ce n'est pas le cas, si bien que le fichier ne peut jamais nommer une condition presse tout en portant les mesures d'une autre.
- Le **TIFF impression (CMJN)** écrit des pixels **DeviceCMYK** non étiquetés et enregistre la même condition presse comme provenance dans ses métadonnées TIFF (*ImageDescription*) plutôt que d'intégrer un profil. Le même contrôle de profil colorimétrique pilote les deux formats CMJN - un TIFF ne peut pas du tout intégrer un profil presse, donc une ligne **Intégrer** y enregistre uniquement le nom propre de ce profil.
- **TIFF (RVB)** est le pendant sRGB simple, non compressé - un raster sans perte à la résolution choisie pour l'archivage ou un aller-retour dans un éditeur, avec la provenance enregistrée dans les mêmes métadonnées TIFF. Toute transparence est aplatie sur blanc (ce profil ne porte pas de canal alpha). Comme le TIFF CMJN, il est réservé au bureau, car les navigateurs ne peuvent pas prévisualiser un TIFF et les téléchargements mobiles restent bloqués.
- **SVG**, **EMF**, **EPS** et **DXF** sont des vecteurs indépendants de la résolution et du profil, sans profil intégré - les couleurs du SVG sont du sRGB simple, celles de l'EMF et de l'EPS sont du RVB périphérique (et l'**EPS (CMJN)** écrit un DeviceCMYK naïf) et le **DXF** porte l'index de couleur AutoCAD le plus proche. (SVG, EPS et DXF, comme le PDF, convertissent tout texte en chemins vectoriels, si bien que le résultat s'affiche même où la police n'est pas installée. L'EMF, lui, garde le texte VIVANT par défaut - de vrais enregistrements de texte de métafichier qui restent sélectionnables et modifiables dans Office et Google Slides, se rabattant sur des contours seulement pour les segments que le format ne peut pas exprimer ; l'option « Convertir les polices en contours » du panneau d'export force les contours partout.) Le **SVG** reproduit aussi le `box-shadow` CSS du HTML - chaque ombre extérieure est peinte derrière la boîte, décalée/étalée et floutée en gaussienne pour correspondre au navigateur, et les ombres internes sont peintes à l'intérieur de la même façon.

C'est automatique - aucun réglage à ajuster. Les miniatures et aperçus sautent l'étiquette pour rester légers. Un profil *est* un choix, car il change les pixels plutôt que de simplement les étiqueter - voir **HDR** ci-dessous.

## HDR (couleurs vives)

Les exports ordinaires sont en sRGB : le blanc est blanc, et une couleur de marque saturée est aussi lumineuse que le blanc normal de l'écran. Sur un écran compatible HDR, il y a beaucoup de marge au-dessus de cela, et la carte **HDR** du panneau d'export l'utilise - tes couleurs de marque et ton texte blanc sont poussés vers la luminosité maximale pour qu'ils *rayonnent* réellement, tandis que les zones sombres restent sombres et donnent au rayonnement son contraste.

![La carte HDR dans le panneau d'export, activée, avec les molettes White / Reach / Dark lift / Focus révélées en dessous](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formats.** Les formats raster ayant une place pour porter le signal : **PNG**, **JPG**, **AVIF** et **TIFF**. (Pas WebP - il est en 8 bits sans chemin de décodage HDR fonctionnel, donc un WebP PQ paraîtrait simplement sombre. Les vecteurs et le PDF n'ont aucun modèle HDR.)
- **Désactivé par défaut**, contrairement au marquage colorimétrique - ça change les pixels, donc c'est optionnel. Coche la case, ou passe `hdr=1` dans un lien de partage.
- **Ce qui est réellement écrit.** Les pixels sont réencodés en **Rec.2100 PQ** - primaires BT.2020 avec la courbe de transfert SMPTE ST 2084 (PQ) - et le conteneur porte le signal correspondant pour qu'une application gérant la couleur sache les lire ainsi : un **profil ICC v4 généré avec une balise `cicp`** (JPG, TIFF), un **chunk `cICP`** (PNG) ou une boîte `colr` réécrite (AVIF). Le boost est piloté par la **luminosité perceptuelle (OKLab)**, donc les couleurs moyennes et au-delà montent au maximum et les tons sombres sont calmés plutôt que cramés, et il préserve la teinte - un vert de marque devient plus lumineux, pas plus menthe.
- **Les réglages.** Quatre, révélés quand la case est cochée : **White** (le plafond de luminosité maximale, 400-2000 nits), **Reach** (jusqu'où le rayonnement se propage dans les tons), **Dark lift** (de combien les tons sombres s'éclaircissent - `0` les garde sombres) et **Focus** (combien de richesse colorimétrique le boost conserve). Ils voyagent dans le même paramètre qu'une valeur réglée compacte - `hdr=1600-60-0-50` signifie White 1600, Reach 60, Dark lift 0, Focus 50 - donc un rendu réglé est reproductible depuis le lien.
- **Où tu le verras.** Les visionneuses gérant la couleur sur un écran HDR : Preview / Quick Look / Safari sur les appareils Apple, Chrome sur un moniteur HDR. Sur un écran SDR ordinaire, le fichier s'affiche toujours comme une image normale.
- **À savoir avant de publier.** De nombreuses plateformes **réencodent** ce que tu téléverses et suppriment le signal HDR - réseaux sociaux, applications de messagerie, certains CMS - ce qui peut laisser l'image paraître sombre ou délavée. Utilise le HDR là où tu maîtrises la destination (un site que tu construis, un mur vidéo, une présentation sur un écran lumineux), pas par défaut pour tout.
- **Transparence.** PNG et AVIF conservent leur alpha ; JPG reste opaque comme toujours. Le chemin **TIFF** aplatit sur **noir**, pas sur blanc comme le chemin SDR - en PQ, le blanc est le code à 10 000 nits, donc aplatir dessus cernerait chaque bord d'un halo aveuglant.
- **Les mêmes octets depuis le terminal.** `--hdr=1` avec `--export=png` ou `--export=jpg` écrit le PNG Rec.2100 PQ en 16 bits et le JPEG à gain-map ISO 21496-1 sur le [CLI](/info/cli.html) aussi, à partir des mêmes encodeurs du moteur plutôt que d'un navigateur - donc un outil `<svg>` natif produit un fichier HDR sans aucun Chromium sur le chemin, et le PNG est identique octet pour octet à celui de l'interface web. AVIF et TIFF restent des exports réservés à l'interface web pour l'instant.

## Vidéo

Les outils animés exportent le mouvement en **MP4**, **WebM** ou **GIF** - et, quand c'est proposé, en **APNG**, **WebP animé** ou en **SVG animé** vectoriel (ci-dessus). Le conteneur vidéo que tu vois dépend de ton navigateur - le sélecteur n'affiche que ce qu'il peut réellement enregistrer :

| Navigateur | Affiche |
|---|---|
| Safari / iOS | **MP4** |
| Firefox | **WebM** |
| Chrome / Edge 126+ / Android | **MP4 et WebM** |
| Chrome plus ancien | **WebM** |

Le GIF fonctionne partout (idéal pour le chat/e-mail ; plus lourd et moins riche en couleurs que la vidéo). Les outils animés exposent aussi **Wait** (secondes pour laisser l'animation se stabiliser avant l'enregistrement) et **Duration** (durée du clip).

> Un lien partagé `?format=…` qui demande un conteneur que ton navigateur ne peut pas enregistrer se rabat élégamment sur l'autre et nomme le fichier en conséquence.

**Son.** Les exports vidéo ne sont pas silencieux. Un outil peut poser une **bande musicale** sous le clip - un fichier audio du catalogue, bouclé ou coupé à la durée du clip, avec fondu d'entrée/sortie, volume et atténuation automatique sous le son propre des images - et les outils d'enregistrement font passer directement le son en direct de leurs images dans le fichier. **MP4** et **WebM** conservent la piste mixée ; le GIF et les formats d'image animée (APNG, WebP animé, SVG animé) sont silencieux par nature.

## Audio

Certains outils exportent de l'**audio seul**, pas seulement comme piste vidéo. Le **Voice Recorder** capture une prise micro avec un vumètre en direct et un accompagnement en douceur, puis l'enregistre en **MP3** (le défaut, transcodé dans ton navigateur) ou dans son conteneur natif - **M4A** (AAC), **OGG** ou **WebM** (Opus), selon ce qu'a enregistré ton navigateur. Comme pour tout le reste, l'encodage se fait sur ton appareil - rien n'est téléversé.

L'audio que tu *importes* est tout aussi large. Le sélecteur d'assets accepte **MP3**, **WAV**, **OGG**/**Opus**, **M4A**/**AAC** et **FLAC** (conservés à l'identique et décodés sur l'appareil), **MIDI** (`.mid` - converti à l'import en une minuscule piste synthé sur l'appareil) et les **modules tracker** - **MOD**, **XM**, **IT**, **S3M**, **STM**, **MTM** (décodés sur l'appareil par un lecteur intégré, quelques kilo-octets de données musicales). Chacun d'eux peut devenir la **bande musicale** sous un export vidéo, ou jouer dans le lecteur ambiant du mode Neurospicy.

L'audio *fait* partie du pipeline `format=` / `--export=` ci-dessous : `wav`, `mp3`, `m4a` et `opus` sont des identifiants de format ordinaires, si bien qu'un export audio seul est aussi partageable et scriptable qu'un PNG. Ce qui en ressort, c'est le son seul, sans image.

## Provenance et filigrane

Là où le format le permet, les exports portent des **métadonnées de provenance** - logiciel, source, nom de l'outil et ta ligne de crédit de profil - intégrées nativement (PNG iTXt, JPEG EXIF, info PDF, `<metadata>` SVG, commentaire GIF). C'est uniquement de la paternité ; rien n'est téléversé. Les outils **expérimentaux** apposent en plus un filigrane visible, appliqué par l'hôte pour qu'il ne puisse pas être retiré en modifiant l'outil.

**Le Lolly Imprint.** Les exports raster portent aussi le propre **filigrane invisible en pixels** de Lolly - le *Lolly Imprint* - **activé par défaut**, tout comme les Content Credentials. Là où le credential et les métadonnées de provenance voyagent *à côté* des pixels et se perdent lors d'un réenregistrement, d'une capture d'écran ou d'un nettoyage de métadonnées, l'Imprint vit *dans* les pixels et survit à la recompression - si bien qu'une copie de l'image peut encore être reconnue comme faite avec Lolly plus tard. C'est un indice durable, pas une garantie cryptographique, et c'est de la simple présence (il ne porte aucune donnée personnelle). Il voyage dans **PNG, JPG, WebP, AVIF, TIFF et BMP**, et dans les rasters rendus par Lolly composités dans un **PDF ou PPTX** - jamais dans une image que *toi* tu as intégrée, seulement dans ce que Lolly lui-même rend. Décoche la carte **Lolly Imprint** dans le panneau d'export pour le sauter, ou passe `imprint=0` dans un lien de partage. (La survie de l'AVIF au réencodage n'est pas encore calibrée ; la détection PDF/PPTX couvre les rasters Lolly intégrés.) [/verify](/verify) le détecte sur l'appareil - voir [Identité des Content Credentials](/info/content-credentials-identity.html#the-lolly-imprint).

**Le credential durable.** Une seconde marque, plus lourde, se trouve à côté de l'Imprint : le **Credential durable**, qui utilise un modèle neuronal sur l'appareil (format TrustMark) pour écrire l'identifiant de Lolly *dans* les pixels afin que le lien « fait avec Lolly » survive à un nettoyage de métadonnées, un réencodage et une relecture par des outils compatibles TrustMark aussi bien que par ceux de Lolly. Il est **désactivé par défaut** - contrairement à l'Imprint en pur JavaScript, il coûte une passe neuronale par export plus un téléchargement de modèle unique, donc c'est un choix explicite plutôt qu'une taxe discrète. Raster seulement (**PNG, JPG, WebP, AVIF, TIFF**), coché dans le panneau d'export ou passé en `durable=1` dans un lien de partage. Sur les applications de bureau et mobile, la carte est carrément masquée plutôt qu'affichée comme sans effet, car il n'y a pas d'origine où récupérer le modèle hors ligne.

**Protection du contenu.** Dans le panneau d'export, *Protéger par mot de passe*, les **Content Credentials C2PA**, le **Lolly Imprint** et le **Credential durable** se replient en un seul groupe **Protection du contenu** réduit et adapté au format, si bien que les options de provenance et de protection d'un fichier vivent au même endroit - le groupe n'affiche que les cartes qui s'appliquent au format choisi, et se masque entièrement quand aucune ne s'applique. Les repères d'impression n'y figurent volontairement *pas* : ce sont de la géométrie de production imprimée plutôt que de la protection, donc **Repères d'impression et fond perdu** - la mesure de fond perdu en millimètres plus Crop, Registration, Bleed, barres de couleur et détails de tampon - conserve sa propre carte de premier niveau sur les formats impression.

![Le groupe Protection du contenu ouvert sur un export PNG, montrant seulement les cartes qui s'appliquent](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

**Avant d'exporter (contrôle qualité impression).** Active le **Contrôle qualité impression** (`export-preflight`) dans les indicateurs de fonctionnalité de ton profil - il est **désactivé par défaut**, si bien qu'un particulier exportant un PNG pour un message de chat ne se fait jamais surprendre par des constats de prépresse, et un plan de contrôle de déploiement ([lolly.work](https://lolly.work)) peut l'activer par défaut pour ses membres - et une carte **Avant d'exporter** apparaît au bas du panneau, juste au-dessus des boutons, chaque fois que les règles d'impression ont quelque chose de vrai à dire sur le travail : format, taille et fond perdu, puis zones de rognage et de fond perdu, couverture d'encre, nombre de plaques et de pages, avec un verdict à côté de son titre. Elle se trouve sous chaque réglage car c'est une affirmation *à propos* de ces réglages plutôt qu'un réglage de plus - et elle ne bloque jamais un export. Elle te dit ce qu'un imprimeur est sur le point de voir.

**Coût, calculé à partir de ta grille tarifaire.** Sous le contrôle qualité - tout en bas, encore au-dessus des boutons - se trouve une carte qui transforme ces mêmes comptages en argent, et uniquement à partir de prix que quelqu'un lui a donnés. Elle lit ce que la passe de contrôle qualité a compté, que la carte de contrôle qualité elle-même soit activée ou non, et elle a besoin de deux conditions vraies : le travail a quelque chose qu'une liste de prix peut effectivement chiffrer (plaques, feuilles, surface, pages, lignes de variantes ou fichiers de sortie - donc un simple PNG de logo ne l'affiche jamais), **et** une **grille tarifaire** est présente. Une grille tarifaire est une liste de prix JSON venant de ton imprimeur. Une installation par défaut n'en fournit aucune et n'a aucun moyen d'en charger une dans l'application : elle arrive soit comme un asset de catalogue qu'un déploiement fournit, soit via l'extension de grille tarifaire optionnelle qu'un auto-hébergeur ou un plan de contrôle active. Sans grille tarifaire, rien ne s'affiche - ni invite, ni tableau vide.

La règle sur laquelle tout repose est qu'**elle n'invente jamais d'argent**. Chaque chiffre est un tarif que tu as fourni multiplié par une quantité que Lolly a comptée - `4 plaques × 35,00 €` - et le total nomme sa propre source dans la même phrase que le chiffre : l'émetteur nommé par la grille, et la date à laquelle la grille dit que ses tarifs datent. Il n'y a ni devise par défaut, ni valeur de substitution, ni zéro tenant lieu de prix manquant. Ce que le fichier dit de lui-même reste du discours rapporté : *« Le fichier indique : … Lolly n'a pas vérifié cela. »*

Et quand elle ne peut pas calculer honnêtement, le tableau de travail **disparaît** plutôt que de se dégrader en un chiffre grisé ou complété d'office :

- Des lignes que la grille ne chiffre pas signifient **aucun total du tout** - juste un en-tête indiquant combien d'entre elles ne sont pas chiffrées. Une somme partielle n'est pas une réponse plus petite, c'est une réponse fausse.
- Une quantité qui est un plafond plutôt qu'un compte exact porte **« jusqu'à »** jusque dans son sous-total, si bien qu'une borne n'est jamais blanchie en un chiffre plat.
- Les tarifs dépassant leur date de validité n'affichent que des **comptages**, jusqu'à ce que tu appuies sur *Utiliser ces tarifs quand même* - et alors la date d'expiration voyage avec le chiffre, si bien qu'un total périmé ne peut pas être lu comme un total actuel.
- Ouverte via un **lien**, la somme reste masquée jusqu'à ce que tu la demandes sur cet appareil. Ni la carte ni cette révélation ne voyagent jamais dans une URL - la même raison pour laquelle le CLI prend `--rate-card=<file.json>` comme indicateur de fichier local et jamais comme paramètre de lien.

La carte est du chrome, jamais du contenu : elle est retirée de chaque étape d'export, si bien qu'elle ne peut déplacer aucun pixel du fichier que tu télécharges. Et c'est de l'arithmétique, pas un devis - seul ton imprimeur peut t'en donner un.

**Rendus composés.** Quand un outil intègre le rendu d'un autre outil (par ex. un *Event Name Badge* intégrant un *QR Code*), le rendu imbriqué est intégré dans l'export du parent - il reste un **vrai vecteur** en SVG et PDF et se rasterise nettement en PNG/JPG/WebP. L'enfant intégré est un intermédiaire : il ne reçoit *aucun* filigrane ni *aucune* provenance propre ; seul l'asset parent terminé en reçoit. (La composition couvre le SVG et les formats raster ; le HTML/MD/TXT ne peut pas être composé.)

## Protection par mot de passe

Deux types de verrouillage indépendants, entièrement sur l'appareil.

**Mot de passe d'ouverture PDF** - la carte *Password protect* du panneau d'export propose deux niveaux :

![La carte Password protect développée sur un export PDF, avec le champ de mot de passe et les deux niveaux de verrouillage](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

- **Standard** - un verrou basique 40 bits (RC4). Il s'ouvre dans *n'importe quelle* application PDF et - n'étant qu'une dissuasion légère, pas une vraie protection - il peut voyager dans un lien de partage (en clair, par conception). RGB `pdf` uniquement.
- **Strong** - AES-256 (PDF 2.0). Son mot de passe est saisi à l'export et n'est **jamais** placé dans un lien ; il ne s'ouvre que dans les applications PDF récentes (Acrobat / Preview ~2018 et après), et les applications plus anciennes peuvent signaler le fichier comme endommagé. Strong s'applique aussi aux **PDF Print / CMYK** et à **chaque PDF à l'intérieur d'un zip de lot** (la boîte de dialogue de confirmation du lot recueille le mot de passe). PDF/X-4 interdisant le chiffrement, un PDF Print verrouillé en Strong conserve son CMYK, ses repères et son intention de sortie mais perd la conformité PDF/X-4.

Les deux niveaux sont mutuellement exclusifs avec Content Credentials (un PDF chiffré ne peut pas recevoir le credential).

**Téléchargements verrouillés (zip entier + défense en profondeur)** - un export **ZIP** (le format *ZIP* du panneau d'export, qui regroupe plusieurs formats d'un outil), un téléchargement de **dossier** (Projects → Download) ou la **grille de lot** peuvent verrouiller l'ensemble du zip avec un seul mot de passe, selon deux niveaux :

- **Standard** - **ZipCrypto** traditionnel : s'ouvre dans *n'importe quel* outil de décompression, y compris l'extraction intégrée de l'Explorateur Windows, mais faible (une dissuasion). Son mot de passe peut voyager dans un lien de partage `?password=`.
- **Strong** - **AES-256** (WinZip AE-2) : robuste, mais ne s'ouvre **pas** avec l'extraction intégrée de l'Explorateur Windows - le destinataire a besoin de 7-Zip / WinZip / Keka / macOS. Saisi à l'export, jamais placé dans un lien.

La même carte *Password protect* du panneau d'export pilote à la fois les verrous PDF et ZIP, en reformulant son texte selon le format choisi. Le mot de passe unique protège **chaque** membre - images, SVG, tout, PDF compris (seul le conteneur zip peut protéger les fichiers non-PDF, qui n'ont pas de verrou propre). Et c'est une **défense en profondeur** : tout PDF à l'intérieur est *aussi* verrouillé individuellement en AES-256 avec le même mot de passe, donc un PDF reste verrouillé même après décompression du zip. L'invite apparaît quand tu démarres le téléchargement ; un mot de passe vide signifie aucun verrou.

**Liens de partage protégés par mot de passe** - tout lien de partage peut être chiffré pour que son ouverture demande un mot de passe au destinataire. L'état complet du lien est chiffré en AES-256 sous une clé dérivée du mot de passe (PBKDF2) ; seul le texte chiffré voyage, donc le **mot de passe n'est jamais dans le lien** et le déchiffrement se fait **dans le navigateur du destinataire** - le serveur qui sert le lien ne voit que le texte chiffré dans l'URL, jamais le mot de passe ni le design déchiffré. Active-le dans la boîte de dialogue **Share**. Un lien chiffré ne peut être qu'*ouvert* dans Lolly (il ne peut pas être intégré comme image, puisque ce chemin ne peut pas afficher d'invite). Voir [URL Mode → Encrypted links](/info/url-mode.html).

## Content Credentials (C2PA)

Les exports peuvent porter des **Content Credentials** - un manifeste [C2PA](https://c2pa.org) signé, intégré au fichier, qui enregistre de façon infalsifiable que le fichier a été créé avec Lolly et n'a pas été modifié depuis. C'est la version normalisée des métadonnées de provenance ci-dessus : une déclaration cryptographique (ce qui a créé le fichier, quand, par qui et où) liée à un hachage des octets du fichier, de sorte que toute modification ultérieure est détectable par un lecteur compatible C2PA. La norme est gérée par la [Content Authenticity Initiative](https://contentauthenticity.org) (Adobe, BBC, Microsoft, Nikon et d'autres), de sorte que les credentials écrits par Lolly sont les mêmes que ceux adoptés par les appareils photo, les rédactions et les suites créatives.

![La carte C2PA Credentials, précochée, avec la durée de vie du credential à côté](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Formats.** Chaque conteneur avec intégration C2PA : **PDF** (RGB et Print), **PNG / Animated PNG**, **JPG**, **GIF**, **SVG**, **TIFF** (RGB et Print), **WebP** (fixe et animé), **AVIF**, **MP4**, **WebM** et les conteneurs audio **MP3**, **WAV**, **M4A** et **OGG/Opus** - un clip vocal enregistré ou synthétisé embarque donc le même credential qu'une image. Un bundle **ZIP** appose sa marque individuellement à chaque membre pris en charge, ce qui est aussi là qu'un **SVG animé** en récupère une (c'est un document SVG ordinaire en dessous ; un export direct en SVG animé n'offre pas de carte propre). MP4, AVIF et M4A utilisent la liaison BMFF de la spécification et MP3 son mapping ID3v2, donc `c2patool` et les autres lecteurs compatibles C2PA les vérifient ; **WebM** et **OGG/Opus** n'ont pas encore de mapping C2PA normalisé, donc Lolly porte le manifeste sous forme de pièce jointe Matroska et de champ OpusTags respectivement, que le vérificateur (et la CLI) de Lolly contrôlent. (`ico`, `eps`, `emf`, `dxf`, `bmp`, `pptx`, les formats Office et les formats texte/données n'ont pas de conteneur C2PA.)
- **Activé par défaut.** La carte **C2PA Credentials** du panneau d'export est précochée pour presque tous les outils - décoche-la pour omettre le credential sur un seul export (ou passe `c2pa=off` dans un lien de partage). Un outil peut s'en exclure entièrement dans son manifeste.
- **Ce qui est enregistré.** L'outil et l'application qui ont créé le fichier, l'heure de signature, la surface d'export (famille de moteur de navigateur + famille d'OS - volontairement grossière, jamais une empreinte) et - uniquement quand *Profile → Use my details* est activé - ton nom et ton e-mail comme auteur de l'œuvre.
- **Ce que voient les destinataires.** Les outils d'inspection des content credentials (applications Adobe, `c2patool`, contentcredentials.org/verify) liront le manifeste et afficheront la déclaration. Comme Lolly signe avec une clé générée **sur ton appareil** - pas un certificat issu d'une liste de confiance - les lecteurs signalent un credential *non vérifié*. La structure et la preuve d'intégrité sont réelles ; c'est uniquement l'identité du signataire qui n'est pas garantie par une autorité. Pour améliorer cela, tu peux inscrire une **identité vérifiée** (Profile → Content Credentials) : un certificat de courte durée émis par la CA Lolly lie ton e-mail à tes exports tandis que la clé de signature ne quitte toujours jamais ton appareil - voir [Content Credentials Identity](/info/content-credentials-identity.html).
- **Vérifier un fichier.** Lolly vérifie aussi ses propres credentials : dépose n'importe quel fichier sur [/verify](/verify) (ou lance `lolly validate <file>` dans la CLI) pour un rapport sur l'appareil - dont le point principal indique si le fichier a bien été créé avec Lolly et n'a pas changé depuis. La vue Verify du web va bien au-delà du credential : elle signale le **contenu généré par IA**, détecte le **Lolly Imprint**, vérifie les signatures **SEAL** et (en option) les tatouages numériques tiers, et fait ressortir les **données cachées** - tout cela sur l'appareil, rien n'est envoyé. Voir [Content Credentials Identity → Beyond the credential](/info/content-credentials-identity.html#beyond-the-credential-what-else-verify-shows).
- **Confidentialité.** Tout se passe sur ton appareil : la clé de signature est créée pour l'export et ne quitte jamais le navigateur, rien n'est envoyé et la déclaration ne contient que ce que les métadonnées de provenance portent déjà. Les utilitaires de confidentialité (transformations sur l'appareil de *tes propres* fichiers) n'ajoutent jamais de credential, et *Strip Hidden Data* supprimera un manifeste C2PA comme toute autre métadonnée intégrée.
- **Interactions.** Pour les PDF, Content Credentials et la **protection par mot de passe** (l'un ou l'autre niveau - voir ci-dessus) sont mutuellement exclusifs (un PDF chiffré ne peut pas recevoir la pièce jointe du credential). Le credential est ajouté en dernière étape sur les octets finaux - après l'apposition DPI/EXIF/profil colorimétrique, les métadonnées PDF/X et les repères d'impression.

## Sur téléphone

Les commandes d'export se trouvent derrière le bouton flottant **Render**, qui ouvre la feuille **Export** - mêmes formats, taille, copie, téléchargement et partage, dimensionnés pour le tactile.

## Référence des formats

Tous les identifiants que l'hôte peut rendre, regroupés. Ce sont aussi les valeurs du paramètre d'URL `format=` et du flag CLI `--export=` - voir [URL Mode](/info/url-mode.html) et [CLI](/info/cli.html). Un outil n'offre que le sous-ensemble déclaré par son auteur, donc le sélecteur est toujours plus court que cette liste.

| Type | Identifiants |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `tiff` (TIFF RGB) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vectoriel | `svg` · `svgz` (SVG gzippé) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMJN) · `dxf` (fichier de découpe) |
| Page et document | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `scorm` (package de cours SCORM, un zip) · `penpot` (fichier de design Penpot) · `docx` (Word) · `odt` (OpenDocument Text) |
| Animation | `gif` · `apng` (PNG animé) · `webp-anim` (WebP animé) · `svg-anim` (SVG animé) · `webm` · `mp4` |
| Audio | `wav` · `mp3` · `m4a` · `opus` |
| Texte et données | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `css` · `scss` · `gpl` (palette GIMP) |
| Paquet | `zip` |

Quelques identifiants supplémentaires proviennent du **hook d'export propre à l'outil** plutôt que du chemin de rendu partagé : `ase` (Adobe Swatch Exchange, depuis Palette Lab), `exr` et `hdr` (les rasters HDR de Darkroom) et `ttf` / `otf` / `woff` (Font Convert). Ils choisissent un format de la même façon - le sélecteur, `format=`, `--export=` - seuls les octets sont construits par l'outil. Font Convert est la seule exception : il transforme un fichier de police que *tu* fournis toi-même, donc une simple URL n'a rien à rendre.
