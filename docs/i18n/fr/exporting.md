# Exporter un fichier

Tu as créé quelque chose et cela doit sortir de Lolly : un PNG pour une conversation, un PDF pour l'imprimeur, un deck qu'un collègue continuera de modifier. Appuie sur **Export**, la moitié gauche de la pastille **Export | Save**. Choisis un format à côté du nom de fichier, puis appuie sur **Download**. Le fichier est créé sur ton appareil.

Ce que tu vois sur le canevas est ce que le fichier contient. Le menu de format ne liste que ce que cet outil peut produire dans ce navigateur.

Pour la plupart des tâches, l'un de ces trois formats convient :

| Pour | Utilise | Parce que |
|---|---|---|
| Un écran, un message ou une diapositive | **PNG** | Toute application l'ouvre, et il garde un arrière-plan transparent quand l'outil en propose un |
| Une page finie, ou tout ce qui est imprimé | **PDF** | Une taille de page réelle qui s'imprime comme elle apparaît ; **Print PDF**, quand un outil le propose, est la version CMJN pour la presse |
| Une illustration qui doit rester nette à toute taille | **SVG** | Des formes vectorielles, nettes du badge à la bannière |

::: check Vérifie le fichier à la taille où il sera utilisé
Avant de l'envoyer, ouvre-le sur l'écran pour lequel il a été fait, ou imprime-le à sa taille réelle.
:::

::: details Approbations et livraison avec Lolly Work (facultatif)
Une [organisation qui utilise Lolly Work](/info/organisation.html) peut encadrer les formats et réglages d'export que ses membres voient. Là où une approbation est requise, **Request approval** remplace **Download**. Suis la politique que ton instance affiche.

Lolly Work peut aussi livrer un fichier vers des destinations S3, WebDAV et HTTP configurées, avec des étapes d'approbation, des accusés de livraison et un enregistrement d'audit. Soumettre un fichier à ce flux l'envoie au service de l'organisation ; un téléchargement ordinaire reste sur ton appareil. Les destinations Send personnelles et la livraison d'organisation sont configurées séparément.

Les opérateurs le mettent en place avec le [guide de livraison de l'organisation](/info/work-delivery.html). Pour les rendus serveur et les lots en file d'attente, voir [CLI batch and automation](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

## Comment fonctionne l'export

Quand tu exportes, le canevas de l'outil est rendu dans le format choisi et t'est remis en téléchargement, ou placé dans ton presse-papiers.

Trois chemins produisent un fichier. La plupart des outils **rendent le canevas**. Les formats texte et données (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) sont **générés à partir du contenu de l'outil** plutôt que dessinés à partir de l'image. Les utilitaires de confidentialité comme *Strip Hidden Data* **transforment le fichier que tu as choisi**, sur ton appareil, et te le rendent sans canevas, sans filigrane et sans métadonnées ajoutées, car c'est déjà ton propre fichier.

![Trois chemins d'export convergent vers un fichier terminé : rendre le canevas, générer du texte ou des données à partir du contenu, ou transformer sur l'appareil un fichier choisi.](/info/diagrams/concepts/three-export-paths.svg)

Le panneau d'export propose ces actions. L'auteur d'un outil choisit lesquelles apparaissent ; l'ensemble par défaut est Copy, Download et Save.

- <!--i:download--> **Download** enregistre le fichier. Si tu ne le retrouves pas ensuite, voir [Find a file you downloaded](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> **Copy** place l'image dans ton presse-papiers, prête à coller dans une conversation, un e-mail ou un document. Là où un navigateur ne peut pas copier d'images, il télécharge à la place et te le dit.
- <!--i:folder--> **Save** conserve le design actuel dans Projects en un clic et ne télécharge jamais de fichier. **Save as**, à côté de **Download**, demande où (voir [Saving and continuing](/info/using.html#saving-continuing)).
- <!--i:link--> **Share** ouvre la boîte de dialogue Share : un lien qui reproduit le design, les bascules à la visite (plein écran, panneau d'export, téléchargement ou copie à l'ouverture) et un **Shortest link** facultatif qui condense tout l'état en un jeton compact (voir [URL Mode](/info/url-mode.html)).

![Le panneau d'export - format, taille et les actions Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Quand un design incorpore le rendu d'un autre outil, comme un bloc image de Design contenant un lien QR Code, le rendu imbriqué est dessiné dans l'export du parent. Il reste vraiment vectoriel en SVG et PDF et se rastérise nettement en PNG, JPG et WebP. Le rendu incorporé n'a ni filigrane ni provenance propres ; seul le fichier terminé en a. Les exports HTML, Markdown et TXT ne peuvent pas contenir un rendu composé.

## Choisir un format

Le nom de fichier et le menu de format se trouvent ensemble comme une seule paire `name.format`, sous **Télécharger**.

![Le champ du nom de fichier fusionné au sélecteur de format, de sorte que l'export se lit comme une seule paire nom.format](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Pars de la destination du fichier. Chaque carte liste les formats qui conviennent à cette destination ; un outil n'affiche que ceux qu'il peut produire.

::: figure exporting-format-chooser
Six destinations et les formats qui conviennent à chacune.
:::

Un logotype composé dans la police de ton design system s'exporte en SVG avec chaque lettre en tracé détouré, donc un seul fichier reste net à la taille d'une carte de visite comme à celle d'un habillage d'immeuble.

![Un logotype fin à espacement large qui lit Aurora, le genre d'illustration purement vectorielle dont parle la ligne SVG du tableau](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Tous les formats et leur usage
| Tu veux | Utilise | Pourquoi |
|---|---|---|
| Des logos ou illustrations nets qui s'adaptent à l'échelle | **SVG** | Vectoriel : redimensionnable, léger et modifiable ; un effet que l'export vectoriel ne sait pas dessiner est incorporé comme image |
| Du vectoriel pour Office et les applications Windows | **EMF** | Se colle comme vectoriel modifiable dans PowerPoint et Word, avec texte actif ; Google Drive l'ouvre dans Google Drawings |
| Du vectoriel pour l'impression et les applications de design | **EPS**, ou **EPS (CMYK)** | Vectoriel PostScript pour Illustrator et les flux d'impression |
| Du vectoriel pour les machines de découpe | **DXF** | Découpeuses laser, traceurs de vinyle et CNC : tracés de contour en millimètres |
| Un deck de diapositives modifiable | **PowerPoint** (PPTX) | Texte et formes natifs modifiables, avec images et vecteurs restant extractibles |
| Un document texte modifiable | **Word** (DOCX) ou **OpenDocument** (ODT) | De vrais paragraphes et titres qu'un traitement de texte peut continuer de modifier (Doc Studio) |
| Une mise en page pour InDesign | **InDesign IDML (static subset)** | Texte, rectangles, ovales et images, une planche par plan de travail (Design) |
| Un document Penpot modifiable | **Penpot** | Boards, formes, texte et tokens liés |
| Une photo ou une image généraliste | **PNG** (sans perte) ou **JPG** (plus léger) | Raster universel |
| Des images modernes plus légères | **WebP** ou **AVIF** | Meilleure compression, avec transparence |
| L'impression | **PDF**, ou **Print PDF** (CMYK) | Taille de page réelle ; CMJN pour une presse |
| Un raster d'impression pour une presse | **Print TIFF** (CMYK) | Pixels DeviceCMYK pour un RIP |
| Animé pour le web | **GIF** | Lu partout ; fichiers plus lourds |
| Animé en pleine couleur avec vraie transparence | **APNG** | PNG animé : pas de limite de palette |
| Animé, fichier le plus léger | **Animated WebP** | Pleine couleur et transparence, plus léger que GIF ou APNG |
| Vecteur animé qui s'adapte à l'échelle | **Animated SVG** | Autonome ; boucle dans un navigateur ou une `<img>`, à toute taille (Lottie Ad) |
| Une animation qui reste modifiable | **dotLottie** | Formes, tracés et clés de transformation extérieures de la timeline de Design |
| Une remise à Premiere | **Premiere XML + media** | Clips minutés et médias d'origine pour Premiere (Design) |
| Vidéo pour les réseaux sociaux et le partage | **MP4** ou **WebM** | Meilleure qualité pour la taille du fichier (voir [Video](#video)) |
| Sous-titres | **SRT** ou **VTT** | Texte minuté pour un lecteur vidéo (Captions, Audiogram et Record) |
| Un cours de formation | **SCORM (LMS)** | Un site web versionné, un paquet SCORM ou xAPI (voir [SCORM](#scorm-course-packages)) |
| Du texte enrichi ou une signature d'e-mail | **HTML** | Se colle avec sa mise en forme dans les clients de messagerie |
| Du contenu simple | **MD** ou **TXT** | Texte seulement |
| Un événement de calendrier | **ICS** | S'importe dans n'importe quelle application de calendrier |
| Une carte de contact | **VCF** | S'importe dans les carnets d'adresses |
| Des données structurées à réimporter | **JSON** ou **CSV** | Aller-retour du contenu de l'outil |
| Un favicon | **ICO** | Icône de site multi-tailles ; **ZIP** regroupe plusieurs formats |
:::

### Transparence

Les outils qui la prennent en charge proposent une bascule de fond transparent, comme **No BG**. PNG, WebP, AVIF, SVG, APNG et Animated WebP gardent la transparence, et GIF garde un bord net. JPG et PDF sont toujours opaques. TIFF aplatit sur du blanc, ou sur du noir sur le chemin HDR décrit sous [HDR](#hdr-bright-colours).

## Taille et unités d'impression

Les exports utilisent la taille en pixels native de l'outil sauf si l'outil propose des **dimensions**. Dans ce cas, tu définis la largeur, la hauteur et une **unit** :

- **px** (le défaut) est en pixels exacts.
- **mm, cm, in, pt** et **pc** sont des tailles physiques. Avec une unité physique, tu définis aussi le **DPI** (300 par défaut). Un **PDF** devient une vraie page à cette taille, un **raster** reçoit le nombre de pixels correspondant à ce DPI et consigne la résolution, et un **SVG** garde l'unité physique avec un viewBox en pixels.

Pour un raster de plus haute résolution, saisis une largeur et une hauteur plus grandes, ou choisis une unité physique et augmente le DPI (pixels = taille × DPI). Largeur `210`, hauteur `297` et unité `mm` donnent une page A4.

![La ligne des dimensions réglée sur 210 par 297 mm, avec le champ DPI révélé parce que l'unité est physique](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Images fixes depuis une composition temporisée

Une composition minutée, comme une timeline [Sequence](/info/sequence-editor.html) dans Design, bouge ; un export fixe doit donc choisir un instant : **l'image à la tête de lecture**. Place la tête de lecture là où tu veux l'image et exporte.

Pour plus d'un instant, le champ **Frames** apparaît à côté de la taille de sortie. Il ne s'affiche que pour une composition minutée et un format fixe (PNG, JPG, WebP, SVG ou PDF). Laisse-le à `1` pour l'image à la tête de lecture. Augmente-le et tu obtiens ce nombre d'images fixes, réparties uniformément sur toute la séquence :

- PNG, JPG, WebP et SVG reviennent dans un seul ZIP : `<name>-01.png`, `-02.png` et ainsi de suite.
- PDF revient sous forme d'un seul document avec autant de pages.

Chaque image fixe vient du milieu de sa tranche de la timeline, donc la première image n'est jamais une entrée à moitié estompée et la dernière n'est jamais l'instant vide après la fin de tous les clips.

::: figure exporting-contact-sheet
Frames: 4 découpe la séquence en quatre tranches égales et prend le milieu de chacune.
:::

Utilise-le pour un storyboard, une planche contact de revue ou un carrousel social tiré d'un montage vidéo. Le nombre est plafonné à 64, et tout autre contenu saisi dans le champ revient à `1`. Chaque image est une image fixe ordinaire, donc les credentials, l'Imprint, les unités physiques et le DPI se comportent comme pour un export unique. Un lien d'export, la CLI et MCP demandent la même planche avec `cuts=` (voir [Contact sheets](/info/url-export.html#contact-sheets)).

## Beaucoup de fichiers à la fois

Lolly propose trois façons de travailler en volume, chacune pour un besoin différent :

::: cols
## Un tableau devient un seul document
Un outil avec une entrée tableau, comme **Battlecards**, transforme chaque ligne en page. Colle un tableau depuis ton tableur et obtiens un PDF. Corrige les lignes dans le tableur et colle de nouveau.
## Un CSV devient un fichier par ligne
**Batch** (`#/batch`) prend un CSV et rend un export pour chaque ligne : badges nominatifs ou certificats, un fichier chacun, livrés dans un ZIP. Voir [Batch](/info/batch.html#make-many-versions-of-one-design).
## Plusieurs designs reçoivent une même modification
**Multi-edit** ouvre plusieurs sessions enregistrées côte à côte pour la même retouche sur des designs différents. Voir [Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Depuis **Projects**, **Render folder** exporte chaque session enregistrée d'un dossier et de ses sous-dossiers dans un seul ZIP imbriqué, et **Render selection** fait de même pour toute sélection multiple ; une session enregistrée seule se rend dans son propre fichier. Une session enregistrée peut aussi être partagée de nouveau comme lien d'outil depuis Projects, qui la rouvre avec les mêmes réglages.

## Des fichiers qui restent modifiables ailleurs

Certains formats remettent ton travail à une autre application sous forme de contenu modifiable plutôt que d'image.

### PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart, Diagrams, Flow Chart et Agenda exportent un deck PowerPoint, une diapositive par page. Chaque page est décomposée en objets natifs, donc un collègue peut modifier le deck et en extraire des ressources :

- <!--i:font--> **Le texte** devient des zones de texte PowerPoint modifiables avec la taille de police, la couleur, la graisse, l'italique et l'alignement de la mise en page.
- <!--i:pentool--> **Les vecteurs** comme les logos et les icônes sont incorporés sous forme d'images SVG ; ils restent nets, et PowerPoint peut leur appliquer *Convert to Shape*.
- <!--i:photos--> **Les images** arrivent en résolution native comme images à part entière. Une image principale recadrée garde l'image entière derrière le cadrage, et tout filtre ou fusion qu'elle porte est intégré.
- <!--i:layers--> **Les fonds, bordures et filets** deviennent des formes de rectangles et de lignes.

![Le panneau d'export avec PowerPoint sélectionné : une diapositive par page, texte et formes restent modifiables](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

La mise en page est approximative ; l'objectif est un contenu réutilisable. Tout ce que le parcours ne peut pas exprimer nativement, comme une zone complexe filtrée ou masquée, est incorporé comme image pour que rien ne se perde. Un deck a une seule taille de diapositive, reprise de la première page.

PowerPoint est aussi une porte d'entrée : [Rebrand a deck](/info/rebrand.html) fait passer un deck sur ton design system, et [Import a design](/info/design-import.html) en ouvre un dans Design.

### Penpot

La plupart des outils qui exportent du SVG exportent aussi un **fichier Penpot** (`.penpot`), prêt à être modifié dans Penpot.

| Ce que tu as créé | Dans Penpot |
|---|---|
| Texte | Objets texte modifiables : corriger une coquille ou restyler |
| Formes, tracés, dégradés et images | Leurs propres formes vectorielles modifiables |
| Une couleur ou une police d'un token de design system | Un lien de token actif : modifie le token et chaque forme qui en hérite suit |
| Le design entier | Un composant réutilisable dans le panneau Assets |
| Une illustration complexe ou un canevas en direct | Incorporé seul comme image, le contenu modifiable autour restant intact |

Depuis Design, chaque cadre devient un board Penpot. Les couleurs et typographies du design system arrivent dans le panneau Assets et son jeu complet de tokens dans le panneau Tokens. Penpot garde sa propre copie à partir de là : un token modifié dans Penpot revient via l'import dans [Design System Setup](/info/brand-studio.html).

![Le panneau d'export avec Penpot sélectionné : le fichier .penpot, et Send to Penpot à côté du téléchargement](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Pour ouvrir le fichier, lance Penpot, choisis un projet et choisis **Import**. Connecté à Penpot depuis le panneau d'export, **Send to Penpot** fait cette étape pour toi.

### Word, OpenDocument et InDesign

**Doc Studio** exporte **Word** (DOCX) et **OpenDocument** (ODT) avec de vrais paragraphes et titres.

**Design** exporte **InDesign IDML (static subset)** : texte, rectangles, ovales et images PNG ou JPEG, une planche par plan de travail. La mise en forme en ligne prise en charge reste modifiable, les images voyagent dans `Links` et les coordonnées deviennent des points InDesign. Le rétablissement des liens, la substitution de polices et les changements de renvoi à la ligne peuvent demander de l'attention. Les effets, l'animation, les articles composés et la géométrie non prise en charge arrêtent l'export avec un rapport qui les liste. IDML ne conserve pas le document d'origine, donc envoie un PDF pour un travail final.

### Timelines : dotLottie et Premiere

Depuis la timeline de Design, **dotLottie** écrit une animation qui reste modifiable dans les outils Lottie ; [Lottie animations](/info/sequence-editor.html#lottie-animations) liste ce qu'il conserve. **Premiere XML + media** emballe les clips minutés et leurs médias d'origine pour Premiere ; voir [Premiere XML exchange](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (paquets de cours)

L'export de cours est désactivé jusqu'à ce que tu actives **Training and courses** sous Settings → Preferences → Feature flags.

Choisis ensuite **Export course** depuis un outil pris en charge, un dossier de projet ou une sélection. Dans Design, choisir **SCORM (LMS)** puis **Download** ouvre le même flux de cours. Lolly enregistre le travail, te laisse relire le contenu et l'ordre du cours, puis ouvre le module et sa boîte de dialogue d'export.

- <!--i:layers--> Choisis une restitution pour chaque source : pages fixes, animation en vidéo, audio ou ressource téléchargeable. Ajoute le texte des leçons et les alternatives de lecture dans le module.
- <!--i:clock--> Prévisualise le lecteur de l'apprenant et relis les descriptions et les sous-titres. L'animation est incluse sous forme de vidéo, y compris l'animation silencieuse.
- <!--i:document--> Choisis Website, SCORM 1.2, SCORM 2004 4th Edition ou une cible xAPI expérimentale. Vérifie le contenu et la taille du ZIP, puis enregistre et télécharge la version vérifiée.
- <!--i:check--> L'achèvement exige de reconnaître chaque leçon requise et de choisir Finish.

![Le panneau d'export sur une présentation Design avec SCORM (LMS) sélectionné](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Le paquet contient son contenu terminé et n'exige aucun compte Lolly. Place un ZIP Website sur un hôte HTTP(S) ; importe un ZIP LMS tel quel. Teste la destination avant de partager le cours. Pour un cours construit à partir de plusieurs créations enregistrées, voir [Create a training course](/info/training-creators.html).

### DXF (fichiers de découpe)

Asset Export, Diagrams, Growth, Logo Wall, QR Code, Street Map, Wayfinding et Wordmark exportent en **DXF**, le format d'échange AutoCAD R12 que lisent les découpeuses laser, les traceurs de vinyle et les logiciels CNC. La géométrie est écrite sous forme de tracés de contour en millimètres, le texte est détouré et la couleur correspond à l'AutoCAD Color Index le plus proche, qui pilote en général l'opération de la découpeuse. DXF est du dessin au trait uniquement : une zone photographique ou filtrée n'a pas de tracé de découpe et est abandonnée, avec un avertissement. Utilise SVG ou PDF pour conserver le contenu raster.

Street Map est le cas le plus clair. Tout le design est déjà fait de traits, donc chaque route et chaque canal devient un tracé de découpe.

::: showcase
![Un rendu Street Map de Paris à l'encre sur crème - du pur trait, si bien que chaque trait survit au voyage vers une découpeuse](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Fais défiler, et la caméra recule à travers la géométrie réelle : sept chemins, aucun pixel nulle part, chaque trait net comme un cheveu à tout niveau de zoom. C'est le même fichier que lit une découpeuse.
:::

## Impression

**Print PDF** écrit du CMJN selon une condition d'impression nommée, **Coated FOGRA39** par défaut. Les nuanciers de marque avec valeurs d'encre mesurées se convertissent exactement ; les autres couleurs utilisent une conversion d'appareil standard. **Print TIFF** écrit des pixels DeviceCMYK pour un RIP et consigne la même condition d'impression dans ses métadonnées TIFF. Le contrôle Colour profile pilote les deux ; [Colour profiles](#colour-profiles) donne le détail.

**Print marks & bleed** a sa propre carte sur les formats d'impression : le fond perdu en millimètres plus Crop, Registration, Bleed, Colour bars et Stamp details.

Certains outils produisent un **PDF de plusieurs pages** : une couverture, du contenu qui s'écoule sur autant de pages que nécessaire et une page de fin, comme dans l'outil *Booklet*. Chaque page est une vraie page PDF en portrait au format A4, US Letter ou A5, et tu peux forcer n'importe quel bloc sur une nouvelle page. Ce sont des documents RVB sans traits de coupe ni repères de fond perdu, qui relèvent du Print PDF d'une seule page. Un PDF Design peut aussi être un **Notes handout** : une page en portrait pour chaque diapositive avec ses notes de l'intervenant dessous.

**Avant d'exporter.** Une carte **Before you export** au pied du panneau dit ce qu'un imprimeur est sur le point de voir : format, taille et fond perdu, zones de coupe et de fond perdu, couverture d'encre, nombre de plaques et de pages, avec un verdict à côté de son titre. Elle ne bloque jamais un export. Design affiche toujours la carte avec ses propres vérifications, dont les règles maison du design system calque par calque et le signal d'écriture du texte du document ([Before you export](/info/design.html#before-you-export)), et ajoute ces vérifications d'impression quand **Print preflight** est activé. Dans les autres outils, active **Print preflight** sous Settings → Preferences → Feature flags ; il est désactivé par défaut, et un déploiement Lolly Work peut l'activer pour ses membres.

**Après l'export.** Une fois le fichier prêt, Lolly le relit et le compare à ce que tu as choisi : format, taille en pixels ou de page, durée du clip, fond transparent, couleur CMJN, HDR, Content Credentials et mot de passe de PDF ou de ZIP. Tout ce qui diffère est écrit sur la carte d'export. Chaque mesure vient du fichier, jamais du réglage, et une propriété que le fichier ne peut pas renseigner n'est pas comptée comme conforme. La ligne de commande écrit la comparaison complète avec `--export-report` (voir [Render with the CLI](/info/cli-rendering.html)).

Les vérifications de l'inspector de Design et la comparaison de marque dans Design System Setup sont des vérifications distinctes : elles examinent le design, tandis que ces deux cartes examinent le fichier.

::: details Coût à partir d'une grille tarifaire
Sous le preflight, une carte de coût transforme les mêmes comptages en argent, en n'utilisant que des prix que quelqu'un a fournis. Elle lit ces comptages même quand la carte de preflight elle-même est désactivée. Elle a besoin de deux choses : un travail qu'une liste de prix sait chiffrer (plaques, feuilles, surface, pages, lignes de variantes ou fichiers de sortie, donc un simple logo PNG ne l'affiche jamais) et une **rate card**, une liste de prix JSON de ton imprimeur. Un build par défaut n'en porte aucune et n'a aucun moyen d'en charger une dans l'application. Une rate card arrive comme ressource de catalogue qu'un déploiement livre, ou via l'extension facultative de rate card qu'un auto-hébergeur ou un plan de contrôle active. Sans rate card, rien n'est affiché.

Chaque chiffre est un tarif que tu as fourni multiplié par une quantité que Lolly a comptée, comme `4 plate × €35.00`, et le total porte sa source : l'émetteur de la carte et la date de ses tarifs. Il n'y a ni devise par défaut ni prix fictif. Ce que le fichier dit de lui-même reste du discours rapporté : *"The file says: … Lolly has not verified this."*

Quand un chiffre ne peut pas être calculé, le tableau est retiré plutôt que rempli :

- Des lignes que la carte ne chiffre pas signifient **aucun total du tout**, seulement un titre qui dit combien ne sont pas chiffrées.
- Une quantité qui est un plafond porte **"up to"** dans son sous-total.
- Des tarifs dépassant leur date de validité affichent **uniquement les comptages** jusqu'à ce que tu appuies sur *Use these rates anyway* ; la date d'expiration accompagne alors le chiffre.
- Ouvert via un **lien**, l'argent reste masqué jusqu'à ce que tu le demandes sur cet appareil. La CLI prend `--rate-card=<file.json>` comme fichier local et jamais comme paramètre de lien.

La carte est retirée de chaque étape d'export, donc elle ne change jamais le fichier. C'est de l'arithmétique, pas un devis ; seul ton imprimeur peut faire un devis.
:::

## Animation et son

### Vidéo

Les outils animés exportent en **MP4** et **WebM**. Le sélecteur n'affiche que les conteneurs que ce navigateur peut produire, et un lien partagé `?format=` qui en demande un qu'il ne peut pas produire se rabat sur l'autre, avec un nom de fichier cohérent. Les outils animés proposent aussi **Start after**, qui maintient le canevas immobile un instant pour que les animations et les polices se stabilisent avant l'enregistrement, et **Duration**, la durée du clip terminé. **Motion blur** (Off, Draft quality, Standard ou High, avec un **Shutter angle**) floute les mouvements rapides au prix du temps de rendu. Là où le navigateur le permet, **Record live** enregistre l'aperçu à l'écran en temps réel via un partage d'écran à la place.

![Les réglages de minutage d'un export animé : Start after, Duration, Motion blur avec son Shutter angle, et Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** choisit Smaller file, Balanced ou Best quality. **Advanced** ouvre **Codec**, **Frame rate**, **Rate mode** et **Hardware acceleration**. Là où un outil a des sous-titres, **Captions** choisit une **Embedded track** ou un **Sidecar .vtt + .srt** à côté de la vidéo. Un lien porte la qualité, le codec, la fréquence d'images, la durée et le délai de départ sous la forme `vq`, `codec`, `fps`, `seconds` et `wait` ([URL parameters](/info/url-parameters.html)).

Les exports vidéo conservent leur son. Un outil peut poser un **music bed** sous le clip : une ressource audio bouclée ou rognée à la durée du clip, avec fondus, volume et ducking sous le son propre de la séquence. Les outils d'enregistrement transmettent leur audio en direct jusqu'au fichier.

Un deck Design qui reste un deck à clics peut quand même sortir en vidéo. **Export slides as video** dans le menu Present ouvre la feuille d'export sur MP4. Chaque diapositive reste affichée pour sa propre durée, ou pour la Duration de la feuille d'export quand elle n'en a pas, et la transition de diapositive du deck se joue entre elles sous forme de fondu enchaîné. Le document lui-même ne change pas.

### Images animées

**GIF** se lit partout et convient à la messagerie et à l'e-mail ; il est plus lourd et a moins de couleurs qu'une vidéo. **APNG** et **Animated WebP** gardent la pleine couleur et la transparence. **Lottie Ad** exporte aussi en **Animated SVG** : des images vectorielles avec des images clés CSS incorporées, donc il s'adapte à toute taille et boucle dans un onglet de navigateur ou une `<img>` sans codec. Son texte est détouré, et il utilise une fréquence d'images par défaut plus basse car chaque image est plus lourde qu'une image bitmap. Tous ceux-ci sont silencieux.

### Audio

Certains outils exportent du son seul. **Voice Recorder** capture une prise au microphone avec un indicateur de niveau en direct et l'enregistre en **MP3**, **WAV**, **M4A (AAC)** ou **Opus (WebM)**, encodé sur ton appareil. `wav`, `mp3`, `m4a` et `opus` sont des identifiants de format ordinaires, donc un export audio est aussi partageable et scriptable qu'un PNG.

Le sélecteur de ressources accepte une large gamme d'audio pour un fond musical, du MP3 et FLAC au MIDI et aux modules tracker ; [Formats](/info/formats.html) les liste. Une [chanson Rondocode](/info/rondocode.html) se joue pendant la durée que demande son clip.

## Couleur et HDR

Lolly lit toute couleur CSS moderne, fait ses calculs de couleur de façon perceptive et écrit chaque fichier dans un espace qu'un lecteur peut ouvrir : sRGB pour les écrans, CMJN pour l'impression et Rec.2100 PQ pour le HDR. [Colour in the engine](/info/colour-engine.html) explique comment. Un document Design réglé sur **Wide colour / HDR** suit ses propres règles, décrites dans [Wide colour and HDR editing](/info/hdr-editing.html).

### Profils colorimétriques

Les exports sont balisés avec un profil colorimétrique, pour que les applications gérant la couleur, comme les imprimeurs, Photoshop et les navigateurs, lisent les couleurs comme tu les as vues. Cela se fait automatiquement ; les vignettes et aperçus omettent la balise pour rester légers.

- **PNG et JPG** portent un profil ICC **sRGB** incorporé, l'espace dans lequel l'aperçu est dessiné. Les pixels sont balisés, pas réencodés.
- **Print PDF (CMYK)** déclare sa condition d'impression dans son *OutputIntent*, ce qui indique à un imprimeur comment ses encres CMJN doivent être lues.
- **Print TIFF (CMYK)** écrit des pixels DeviceCMYK sans balise et consigne la condition d'impression dans ses métadonnées TIFF. Un TIFF ne peut pas incorporer de profil de presse, donc une ligne **Embed** ne consigne que le nom de ce profil.
- **TIFF (RGB)** est le jumeau sRGB non compressé pour l'archivage ou un aller-retour vers un éditeur. Il aplatit la transparence sur du blanc. Les deux TIFF sont réservés au bureau, car les navigateurs ne peuvent pas prévisualiser un TIFF.
- **SVG**, **EMF**, **EPS** et **DXF** sont des vecteurs sans profil incorporé : les couleurs du SVG sont en sRGB, EMF et EPS utilisent du RVB d'appareil, **EPS (CMYK)** écrit du DeviceCMYK et DXF utilise l'AutoCAD Color Index. SVG, EPS et DXF détourent le texte en tracés. EMF garde le texte actif et modifiable dans Office et Google Slides, ne revenant aux contours que pour les passages que le format ne peut pas exprimer ; l'option **Outline fonts** du panneau d'export force des tracés partout. SVG reproduit aussi les ombres portées CSS, intérieures et extérieures.

::: details PDF/X-4 et ton propre profil de presse
Aucun profil CMJN n'est livré avec Lolly. Une condition d'impression nommée écrit l'output intent sans revendiquer la conformité PDF/X-4, car PDF/X-4 exige que le profil soit incorporé.

Charge un profil CMJN à toi et choisis sa ligne **Embed** dans le contrôle Colour profile. Il est incorporé comme *DestOutputProfile* du fichier, et le PDF revendique PDF/X-4 chaque fois que le reste du fichier le permet. La condition d'impression qu'il déclare est lue sur ce profil : un nom enregistré là où le profil en prouve un, ou `Custom` sous le nom propre du profil.

Trois choses retirent la revendication tout en gardant l'output intent : un visuel RVB que la passe CMJN n'a pas pu convertir, le texte de crédit de marge d'épreuve `prov` (dessiné dans une police standard non incorporée) et un mot de passe **Strong**, car PDF/X-4 interdit le chiffrement. Chaque PDF porte aussi des métadonnées PDF/X-4 : zones de page, XMP, un identifiant de document et un output intent sRGB avec son profil.
:::

### HDR (couleurs lumineuses)

C'est la carte **HDR** du panneau d'export, qui éclaircit les visuels ordinaires pour les écrans HDR. Conserver des originaux HDR pendant l'édition est une autre fonction : [Wide colour and HDR editing](/info/hdr-editing.html).

Un export ordinaire est en sRGB : une couleur de marque saturée est aussi lumineuse que le blanc normal de l'écran. Un écran HDR a de la marge au-dessus. La carte **HDR** pousse tes couleurs de marque et le texte blanc vers la luminosité maximale, tandis que les zones sombres restent sombres et donnent son contraste à l'éclat.

![La carte HDR dans le panneau d'export, activée, avec les molettes White / Reach / Dark lift / Focus révélées en dessous](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formats.** PNG, JPG, AVIF et TIFF. WebP est en 8 bits sans chemin de décodage HDR fonctionnel, et les vecteurs et le PDF n'ont pas de modèle HDR.
- **Désactivé par défaut**, car cela change les pixels. Coche la carte, ou passe `hdr=1` dans un lien de partage.
- **Les cadrans.** **White** (le plafond de luminosité maximale, de 400 à 2000 nits), **Reach** (jusqu'où dans les tons l'éclat se répand), **Dark lift** (de combien les sombres s'éclaircissent ; `0` les garde sombres) et **Focus** (combien de richesse de couleur le boost conserve). Ils voyagent comme une seule valeur : `hdr=1600-60-0-50` signifie White 1600, Reach 60, Dark lift 0 et Focus 50.
- **Ce qui est écrit.** PNG reçoit du Rec.2100 PQ 16 bits avec un bloc `cICP`. JPG est un JPEG à carte de gain ISO 21496-1 : une image SDR ordinaire plus une carte de gain ajoutée. AVIF reçoit une boîte `colr` réécrite. TIFF reçoit des pixels PQ avec un profil ICC v4 généré portant une balise `cicp`, et s'aplatit sur du noir, car le blanc est le code 10 000 nits en PQ et ferait un halo sur chaque bord. Le boost suit la luminosité perceptive (OKLab) et conserve la teinte, donc un vert de marque devient plus lumineux, pas mentholé.
- **Où l'éclat se voit.** Dans les visionneuses gérant la couleur sur un écran HDR : Preview, Quick Look et Safari sur les appareils Apple, ou Chrome sur un moniteur HDR. Un écran SDR affiche une image normale.
- **Avant de livrer.** Beaucoup de plateformes réencodent les envois et suppriment le signal HDR, ce qui peut rendre l'image sombre ou délavée. Utilise le HDR là où tu contrôles la destination, comme ton propre site, un mur vidéo ou un deck sur un panneau lumineux.
- **Depuis le terminal.** `--hdr=1` avec `--export=png` ou `--export=jpg` écrit le même PNG et le même JPEG à carte de gain sur la [CLI](/info/cli.html), à partir des mêmes encodeurs du moteur, sans navigateur sur le trajet. AVIF et TIFF restent des exports web pour l'instant.

## Ce qui voyage avec ton fichier

Un fichier terminé peut porter plusieurs enregistrements à côté de l'image. Certains voyagent à côté des pixels et disparaissent quand le fichier est réenregistré ou nettoyé ; deux marques vivent dans les pixels eux-mêmes.

::: figure exporting-what-travels
Où vit chaque enregistrement, s'il est activé par défaut et quel paramètre de lien le contrôle.
:::

Le panneau d'export regroupe **Licence**, **Source credits**, *Password protect*, **C2PA Credentials**, le **Lolly Imprint** et le **Durable credential** dans un seul groupe **Content protection** qui n'affiche que les cartes que le format choisi peut utiliser. Il s'ouvre tout seul quand un lien ou un document déclare déjà une licence, ou quand une source exige une décision de ta part. La carte **Design system** reste en dehors du groupe, visible à chaque export.

![Le groupe Protection du contenu ouvert sur un export PNG, montrant seulement les cartes qui s'appliquent](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Provenance et filigrane

Là où le format a les champs, les exports portent des **métadonnées de provenance** : le logiciel, la source, le nom de l'outil et ta ligne de crédit de profil, écrits dans PNG iTXt, JPEG EXIF, PDF info, SVG `<metadata>` ou un commentaire GIF. Elles consignent seulement l'auteur, et rien n'est envoyé. Les outils **Experimental** apposent aussi un filigrane visible, appliqué par l'hôte pour que modifier l'outil ne puisse pas retirer la marque.

**Le Lolly Imprint** est un filigrane invisible dans les pixels, **activé par défaut**. Le credential et les métadonnées voyagent à côté des pixels et sont perdus lors d'un réenregistrement, d'une capture d'écran ou d'un nettoyage des métadonnées. L'Imprint vit dans les pixels et survit à la recompression, donc une copie peut toujours être reconnue comme faite avec Lolly. C'est un indice et non une garantie cryptographique, et il ne porte aucune donnée personnelle. Il voyage dans JPEG XL, PNG, JPG, WebP, AVIF, TIFF et BMP, et dans les rasters que Lolly rend dans un PDF ou un PPTX, jamais dans une image que tu as incorporée. Décoche **Lolly Imprint** ou passe `imprint=0` pour omettre l'Imprint. La survie d'AVIF au réencodage n'est pas encore calibrée. [Verify](/verify) le détecte sur ton appareil ; voir [The Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**Le Durable credential** écrit l'identifiant de Lolly dans les pixels avec un modèle neuronal sur l'appareil au format TrustMark, pour que le lien « fait avec Lolly » survive à un nettoyage de métadonnées et à un réencodage et puisse être lu par des outils compatibles TrustMark. Il est **désactivé par défaut**, car il coûte une passe neuronale par export et un téléchargement de modèle unique. Il couvre PNG, JPG, WebP, AVIF et TIFF ; coche-le dans le panneau ou passe `durable=1`. Les applications de bureau et mobiles masquent la carte, car elles n'ont aucune origine d'où récupérer le modèle hors ligne.

**Licence.** Choisis comment les autres peuvent utiliser ton travail : *None (all rights reserved)* par défaut, CC0 1.0, la Public Domain Mark 1.0, ou une licence Creative Commons 4.0 (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). Le nom de la licence et un lien vers son acte vont dans les métadonnées de licence du fichier (EXIF, XMP et RIFF là où le format en a) et dans son Content Credential. Le choix est enregistré avec le document et voyage dans un lien sous la forme `licence=`. Lolly écrit la licence que tu as choisie ; il ne vérifie ni n'applique ses conditions. Un outil avec son propre champ de licence, comme Claim, garde ce champ à la place.

### L'enregistrement du design system

Un export consigne le design system qui a produit le fichier : son nom, la version publiée dont il vient (quand ce n'est pas la version de travail) et le [colourway](/info/colourways.html) dans lequel il a été dessiné. Tout autre choix de thème qu'un design system déclare, comme une densité, est consigné de la même façon. Le choix clair ou sombre est omis, car l'image montre déjà lequel a été utilisé.

**Tu vois l'enregistrement avant que quoi que ce soit soit écrit.** La carte **Design system**, cochée par défaut, montre les mots exacts que le fichier portera, comme *Records: Acme · Colourway: Beach*, et la description telle qu'elle se lira. Le nom d'un design system est ce que ses propriétaires ont saisi, donc la carte l'affiche tel quel. Décoche la carte pour omettre l'enregistrement de cet export. Le panneau de document de Design liste les mêmes mots sous *Embedded in exports*.

**La description donne le colourway à côté de l'outil.** Avec la carte cochée, *"Made with https://lolly.tools : Chart"* devient *"Made with https://lolly.tools : Chart (Beach colourway)"*. Le nom propre du design system reste dans l'enregistrement, pas dans la description. Une description sans nom d'outil, ou qu'un outil écrit à partir de ses propres entrées, est laissée telle quelle. Un outil qui ignore les colourways via `tokenAxes` n'en consigne aucun, et le crédit d'épreuve du PDF (le repère d'impression `prov`) suit la même règle.

**Les brand skills qui ont guidé un agent.** Quand un agent a créé la pièce et nommé les [brand skills](/info/brand-skills.html) qu'il a lus et suivis, l'enregistrement liste aussi chaque skill avec sa révision, comme *Guided by: acme-brand 1.0*. Ces mots signifient que le skill a guidé le travail. Ce n'est pas une vérification : Lolly ne teste pas la pièce par rapport à un skill. Seule la déclaration de l'agent lui-même ajoute la liste, ce qui, aujourd'hui, veut dire l'argument `brandSkills` de `lolly_render` du [serveur MCP](/info/mcp.html), donc une pièce créée dans l'application ou depuis un lien de partage n'en porte aucune. Le Content Credential contient la liste sous `brandSkills`, une valeur JSON avec l'identifiant, le nom, la révision et le hachage SHA-256 de chaque skill. Le paquet XMP et les métadonnées SVG contiennent la même valeur sous `lolly:BrandSkills`, un PDF écrit à partir de l'enregistrement gagne un mot-clé par skill et la description reste telle quelle. Un skill interne est consigné par son identifiant, son nom, sa révision et son hachage, jamais par son texte. Les mêmes interrupteurs omettent la liste avec le reste de l'enregistrement : la carte **Design system**, `_madewith=0`, `--no-madewith` et `madeWith: false`. Quand le serveur MCP dessine le fichier dans un navigateur (un PDF, un JPEG et les autres formats que son chemin sans navigateur ne peut pas écrire), les métadonnées propres du fichier ne contiennent aucune liste et seul un Content Credential peut en contenir une. Passe `c2pa` pour conserver l'enregistrement ; sans credential, le rendu avertit que les brand skills n'ont pas été consignés.

**Relire l'enregistrement.** [Verify](/verify) liste l'enregistrement sous **Design system** dans les détails du credential d'un fichier et tout brand skill sous **Guided by**. *Recreate with these settings* rouvre l'outil dans la version et le colourway consignés. Le lien s'ouvre avec le design system consigné quand cet appareil en détient un de même identifiant et de même nom ; sinon il s'ouvre avec ton design system actif.

::: details Ce qui est écrit où, et quelles exécutions omettent l'enregistrement
| Où | Ce qui est écrit |
|---|---|
| Content Credential | `designSystem` (l'identifiant), `designSystemLabel`, `designVersion` et `themes` dans l'assertion `tools.lolly.export`, chacun une valeur de texte simple ; `themes` est une liste JSON des choix |
| PNG, JPEG, WebP et JXL | Les quatre mêmes valeurs comme propriétés `lolly:` du paquet XMP du fichier, dans l'espace de noms `https://lolly.tools/ns/export/1.0/` |
| SVG | Les mêmes propriétés `lolly:` dans le bloc `<metadata>` |
| PDF | Des mots-clés comme *Design system: Acme* et *Colourway: Beach* |
| Tout format avec un champ de description | La description, avec le colourway à côté de l'outil |

La carte n'apparaît que lorsqu'il y a quelque chose à consigner et que le format peut contenir l'enregistrement. CSV, JSON, un fichier de calendrier et les autres formats texte ou données ne contiennent aucune métadonnée, et EPS, EMF, DXF et BMP n'ont aucun champ pour l'enregistrement. HTML, Markdown et CSS ne contiennent l'enregistrement que dans leur Content Credential, donc pour eux la carte n'affiche aucune ligne de description et se masque quand **C2PA Credentials** est désactivé. Un champ que le design system ne fournit pas reste hors du fichier.

Un lien de partage désactive l'enregistrement avec `_madewith=0` ([URL parameters](/info/url-parameters.html)) ; la ligne de commande prend `--no-madewith`, `lolly_render` du [serveur MCP](/info/mcp.html) prend `madeWith: false`, et le panneau d'export de l'application de terminal a une ligne **Design system**. La ligne de commande affiche sur la sortie d'erreur standard les mots qu'un fichier terminé porte, pour un rendu d'outil et pour chaque fichier que `lolly run` exporte depuis une session Design enregistrée, et un rendu MCP les affiche à côté du fichier, les deux relus depuis le fichier. Un PNG que la ligne de commande dessine sans navigateur ne porte aucune métadonnée de fichier, donc son enregistrement voyage dans le credential seul. Les utilitaires sur l'appareil n'ajoutent aucune métadonnée.

Les exécutions sans carte **Design system** omettent l'enregistrement : un lot Batch, un dossier exporté depuis Projects et un export de collection 3D, et dans l'application de terminal un lot CSV, un export de dossier ou de sélection de Projects et la vue render-everything. Exporte un fichier depuis l'outil pour consigner le design system.
:::

### Content Credentials (C2PA)

Les exports peuvent porter des **Content Credentials** : un manifeste [C2PA](https://c2pa.org) signé qui consigne ce qui a produit le fichier, quand et où, lié à un hachage des octets du fichier de sorte que toute modification ultérieure soit détectable. La spécification est publiée par la C2PA, et Lolly écrit des manifestes standard que tout lecteur C2PA peut inspecter.

![La carte C2PA Credentials, cochée, avec la durée de vie du credential à côté de la case](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Activé par défaut.** La carte **C2PA Credentials** est présélectionnée pour presque tous les outils. Décoche-la pour un export, ou passe `c2pa=off` dans un lien. Un outil peut s'en exclure dans son manifeste.
- **Formats.** PDF (RVB et Print), PNG et APNG, JPG, GIF, SVG, TIFF (RVB et Print), WebP (fixe et animé), AVIF, MP4, WebM, les conteneurs audio MP3, WAV, M4A, OGG/Opus et FLAC, et HTML, Markdown et CSS. Un ZIP appose la marque sur chaque membre pris en charge, c'est ainsi qu'un Animated SVG en reçoit une. MP4, AVIF et M4A utilisent la liaison BMFF standard et MP3 sa correspondance ID3v2, donc `c2patool` et d'autres lecteurs les vérifient. WebM et OGG/Opus n'ont pas encore de correspondance standard, donc Lolly porte le manifeste comme pièce jointe Matroska et comme champ OpusTags, que le vérificateur propre de Lolly contrôle. ICO, EPS, EMF, DXF, BMP, PPTX, les formats Office et les autres formats texte et données n'ont pas de conteneur C2PA.
- **Ce qu'il consigne.** L'outil et l'application qui ont créé le fichier, l'heure de signature, le shell qui l'a exporté, le [design system et le colourway](#the-design-system-record) tant que la carte **Design system** est cochée, et les empreintes des entrées actives. Le texte saisi, les champs liés au profil, les contrôles inactifs, les versions du navigateur et les détails du système d'exploitation sont omis. Ton nom et ton e-mail n'apparaissent comme auteur que si **Use my details to create** est activé sous Settings → Preferences → Your details. Les sources qu'un export place voyagent comme ingrédients : les [œuvres créditées](#source-credits) comme les emoji, et les [chansons Rondocode](/info/rondocode.html#songs-in-the-credential) dans un export vidéo ou audio.
- **Ce que voient les destinataires.** Les outils C2PA comme les applications Adobe, `c2patool` et contentcredentials.org/verify lisent le manifeste et affichent la déclaration. Lolly signe avec une clé créée sur ton appareil, pas avec un certificat d'une liste de confiance, donc les visionneuses signalent un credential *unverified* : la structure et la détection d'altération sont réelles, le signataire n'est pas garanti. Pour changer cela, inscris une **verified identity** sous Settings → Preferences → Content Credentials ; voir [Content Credentials Identity](/info/content-credentials-identity.html).
- **Vérifier un fichier.** Dépose n'importe quel fichier sur [Verify](/verify), ou lance `lolly validate <file>`, pour un rapport sur l'appareil qui indique d'abord si Lolly a créé le fichier et s'il a changé depuis. Verify regarde aussi au-delà du credential ; voir [What Verify checks](/info/what-verify-checks.html).
- **Confidentialité.** La clé de signature est créée pour l'export et ne quitte jamais ton appareil, et la déclaration ne contient que ce que les métadonnées de provenance portent déjà. Les utilitaires de confidentialité qui transforment tes propres fichiers n'ajoutent aucun credential, et *Strip Hidden Data* supprime un manifeste C2PA comme toute autre métadonnée. L'utilitaire Rondocode crée de l'audio nouveau, donc il signe ce qu'il écrit ([Rondocode songs](/info/rondocode.html#files-from-the-rondocode-utility)).
- **Interactions.** Un PDF protégé par mot de passe ne peut pas porter de Content Credentials, à aucun des deux niveaux. Le credential est ajouté en dernier, sur les octets terminés, après le DPI, l'EXIF, le profil colorimétrique, les métadonnées PDF/X et les repères d'impression.

### Crédits de source

Un export qui place le travail de quelqu'un d'autre consigne cette source dans le credential. Un emoji dessiné à partir du jeu d'emoji choisi en est le cas courant : l'œuvre, son créateur, la licence, l'origine des octets exacts et ce qui a changé voyagent tous avec le fichier. Le texte d'un outil dont le modèle est un SVG garde les emoji du système, donc rien n'y est crédité. La ligne **Source credits** dit ce que les sources demandent pour la livraison avant que tu télécharges, et après le téléchargement elle relit les octets livrés avant de dire que les crédits sont dans le fichier. Une licence qui te demande de choisir, comme un glyphe CC BY-SA recoloré que tu t'apprêtes à partager, reçoit une carte avec les options ; le téléchargement n'est jamais bloqué. [Creative rights and credits](/info/creative-rights.html) contient la formulation, les licences relues et ce qui reste à toi.

## Protection par mot de passe

Deux types de verrou, tous deux créés sur ton appareil. La carte *Password protect* du panneau d'export pilote les deux.

![La carte Password protect développée sur un export PDF, avec le champ de mot de passe et les deux niveaux de verrouillage](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**Un mot de passe d'ouverture de PDF** a deux niveaux dès que tu saisis un mot de passe :

- **Weak** : RC4 40 bits, un moyen dissuasif plutôt qu'une protection. Son mot de passe peut voyager dans un lien de partage, en clair. `pdf` RVB uniquement.
- **Strong** : AES-256 (PDF 2.0). Saisi à l'export et jamais mis dans un lien. Il s'applique aussi aux Print PDF et à chaque PDF dans un ZIP de lot. Un Print PDF verrouillé en Strong garde son CMJN, ses repères et son output intent mais abandonne la revendication PDF/X-4.

**Un ZIP verrouillé** couvre un export ZIP, un téléchargement de dossier depuis Projects ou un lot, avec un seul mot de passe à deux niveaux : **Weak** (ZipCrypto, dissuasif ; il peut voyager dans un lien `?password=`) ou **Strong** (AES-256, saisi à l'export, jamais dans un lien). Le mot de passe protège chaque membre, et tout PDF à l'intérieur est aussi verrouillé en AES-256 de son côté, donc il reste verrouillé après l'extraction du ZIP. L'invite apparaît au début du téléchargement ; un mot de passe vide signifie aucun verrou.

**Un lien de partage protégé par mot de passe** demande un mot de passe au destinataire avant de s'ouvrir. Tout l'état du lien est chiffré en AES-256 avec une clé dérivée du mot de passe (PBKDF2), donc seul du texte chiffré voyage et le déchiffrement a lieu dans le navigateur du destinataire. Le serveur qui sert le lien ne voit jamais le mot de passe ni le design. Active-le dans la boîte de dialogue **Share**. Un lien chiffré ne s'ouvre que dans Lolly, jamais comme image incorporée. Voir [URL Mode](/info/url-mode.html).

## Sur téléphone

Les contrôles d'export se trouvent derrière le bouton flottant **Export**, qui ouvre la feuille **Export** : les mêmes formats, taille, copie, téléchargement et partage, dimensionnés pour le tactile.

## Identifiants de format pour les liens et la CLI

Ce sont les valeurs du paramètre d'URL `format=` et de l'option CLI `--export=` (voir [URL parameters](/info/url-parameters.html) et [CLI](/info/cli.html)). Le menu d'un outil n'affiche que les formats que cet outil peut produire, donc il est toujours plus court que cette liste.

| Type | Identifiants |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vectoriel | `svg` · `svgz` (SVG compressé en gzip) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (fichier de découpe) |
| Page et document | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (fichier de design Penpot) · `scorm` (paquet de cours, un ZIP) |
| Animation | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| Audio | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` |
| Texte et données | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `css` · `scss` · `gpl` (palette GIMP) |
| Bundles et paquets | `zip` · `rpm` et `tar.gz` (le rendu scellé dans un paquet Linux) |

Quelques identifiants viennent du code d'export propre d'un outil : `ase` (Adobe Swatch Exchange, de Palette Lab) et `exr` et `hdr` (rasters à grande plage dynamique, de Darkroom). **Convert Font** écrit `ttf`, `otf` et `woff` à partir d'un fichier de police que tu fournis, donc un lien nu n'a rien à lui faire rendre.
