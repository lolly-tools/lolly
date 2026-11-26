# Exporter un fichier

Appuie sur **Export**, la moitié gauche de la pastille **Export | Save**, choisis un format à côté du nom de fichier et appuie sur **Download**. Ton appareil crée le fichier.

Le fichier contient ce que tu vois sur le canevas. Le menu des formats propose uniquement ce que cet outil peut produire dans ce navigateur.

La plupart des tâches demandent l'un de ces trois formats :

| Pour | Choisis | Parce que |
|---|---|---|
| Un écran, un message ou une diapositive | **PNG** | Toutes les applications le lisent, et il conserve un arrière-plan transparent si l'outil le permet |
| Une page finie, ou tout ce qui est imprimé | **PDF** | Une vraie taille de page, imprimée comme à l'écran ; **Print PDF**, si l'outil le propose, fournit la version CMYK pour la presse |
| Une illustration qui doit rester nette à toute taille | **SVG** | Des formes vectorielles |

::: check Vérifie le fichier à sa taille d'utilisation
Avant d'envoyer le fichier, ouvre-le sur l'écran pour lequel il a été créé ou imprime-le à sa taille réelle.
:::

::: details Valider et livrer avec Lolly Work (facultatif)
Une [organisation qui utilise Lolly Work](/info/organisation.html) peut choisir les formats et réglages d'export que ses membres voient. Quand une approbation est nécessaire, **Request approval** prend la place de **Download**. Respecte la politique affichée par ton instance.

Lolly Work peut également envoyer un fichier aux destinations S3, WebDAV et HTTP configurées, avec des étapes d'approbation, des accusés de livraison et un enregistrement d'audit. Cette livraison envoie le fichier au service de l'organisation. Un téléchargement ordinaire reste sur ton appareil. La configuration des destinations Send personnelles est distincte de celle de la livraison d'organisation.

Le [guide de livraison de l'organisation](/info/work-delivery.html) explique aux opérateurs comment le configurer. Pour les rendus serveur et les lots en file d'attente, voir [Lots et automatisation avec la CLI](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

<!--i:eti-cpu-->
## Comment fonctionne l'export

Trois chemins mènent à un fichier. La majorité des outils **rendent le canevas**. Les formats texte et données (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) sont **générés à partir du contenu de l'outil**. Les utilitaires de confidentialité comme *Lolly Strip Hidden Data* **transforment le fichier que tu as choisi** sur ton appareil. Le résultat n'a pas de canevas, de filigrane ni de métadonnées ajoutées.

![Trois chemins d'export aboutissent à un fichier terminé : rendu du canevas, génération de texte ou de données à partir du contenu ou transformation d'un fichier choisi sur l'appareil.](/info/diagrams/concepts/three-export-paths.svg)

L'auteur d'un outil choisit les actions que propose le panneau d'export. L'ensemble par défaut est Copy, Download et Save.

- <!--i:download--> **Download** sauvegarde le fichier. Si tu ne le retrouves pas ensuite, voir [Retrouver un fichier téléchargé](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> **Copy** place l'image dans ton presse-papiers. Là où un navigateur ne peut pas copier d'images, Copy télécharge le fichier à la place et te le dit.
- <!--i:folder--> **Save** conserve le design actuel dans Projects et ne télécharge jamais de fichier. **Save as**, à côté de **Download**, demande où (voir [Enregistrer et reprendre](/info/using.html#saving-continuing)).
- <!--i:link--> **Share** ouvre la boîte de dialogue Share : un lien qui reproduit le design, les bascules à la visite (plein écran, panneau d'export, téléchargement ou copie à l'ouverture) et un **Shortest link** facultatif qui condense l'état en un jeton compact (voir [Mode URL](/info/url-mode.html)).

**Send to**, une carte du panneau d'export, envoie le fichier à un service que tu as connecté. Après un envoi vers Google Drive, Nextcloud, un bucket S3, Dropbox ou OneDrive, **Create a share link** peut y créer un lien sans second envoi. La section **Share through your cloud** de la boîte de dialogue Share envoie un fichier `.lolly` et crée son lien en une seule étape. Le panneau du lien indique qui peut l'ouvrir, où se trouve le fichier et quand le lien expire. **Links you've shared**, dans la boîte de dialogue Share, te permet d'arrêter le partage. Les liens Nextcloud peuvent avoir un mot de passe et une date d'expiration. Les liens S3 durent de 1 à 7 jours et ne peuvent pas être désactivés avant. Lolly ne conserve sur un serveur ni copie du fichier ni jeton de connexion. [Confidentialité](/info/privacy.html#every-network-request-the-app-can-make) liste ce que reçoit chaque service.

![Le panneau d'export - format, taille et actions Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Quand un design incorpore le rendu d'un autre outil, comme un bloc image de Lolly Design contenant un lien QR Code, l'export du parent dessine le rendu imbriqué. Il reste vectoriel en SVG et PDF et se rastérise en PNG, JPG et WebP. Le rendu incorporé ne reçoit ni filigrane ni provenance propres ; seul le fichier terminé en reçoit. Un export HTML, Markdown ou TXT ne peut pas inclure de rendu composé.

<!--i:eti-file-->
## Choisir un format

Le nom de fichier et le menu de format se trouvent ensemble comme une seule paire `name.format`, sous **Download**.

![Le champ du nom de fichier fusionné au sélecteur de format, pour que l'export se lise comme une seule paire name.format](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Pars de la destination du fichier. Chaque carte liste les formats qui conviennent à cette destination.

::: figure exporting-format-chooser
Six destinations, avec les formats adaptés à chacune.
:::

Un logotype composé dans la police de ton design system s'exporte en SVG avec chaque lettre convertie en tracé de contour. Le fichier reste net à toute taille.

Le texte dans une autre langue dépend des polices dont tu disposes. Quand une police de ton design system contient les lettres, SVG et PDF les dessinent en contours, composées et dans l'ordre de lecture, y compris les lignes de droite à gauche. Quand aucune ne les contient, Lolly utilise une [police de repli](/info/fallback-fonts.html), et la carte d'export indique cette police. Un texte qu'aucune police de repli ne couvre reste du texte actif dans un SVG, dessiné par les polices du lecteur. Dans un PDF, EPS ou WMF et dans un EMF avec **Outline fonts** activé, ce texte devient des images. Ces mots ont le même aspect que sur la page mais ne peuvent être ni sélectionnés ni recherchés. La carte d'export liste ces écritures. Pour conserver ces lettres en texte vectoriel, ajoute une police qui les contient.

![Un logotype très fin à espacement large qui affiche Aurora, le genre d'illustration purement vectorielle dont parle la ligne SVG du tableau](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Chaque format et son usage
| Tu veux | Utilise | Pourquoi |
|---|---|---|
| Des logos ou illustrations nets à toute taille | **SVG** | Vectoriel : s'adapte à l'échelle, reste léger et modifiable ; les effets que l'export vectoriel ne peut pas dessiner sont incorporés en images |
| Du vectoriel destiné à Office et aux applications Windows | **EMF** | Se colle dans PowerPoint et Word sous forme vectorielle modifiable avec texte actif ; s'ouvre dans Google Drawings depuis Google Drive |
| Du vectoriel destiné à l'impression et aux applications de design | **EPS**, ou **EPS (CMYK)** | Du PostScript vectoriel pour Illustrator et les flux de presse |
| Du vectoriel destiné aux machines de découpe | **DXF** | Des tracés de contour en millimètres pour les découpeuses laser, les traceurs de vinyle et les CNC |
| Un deck de diapositives à modifier | **PowerPoint** (PPTX) | Du texte et des formes natifs modifiables ; les images et les vecteurs peuvent toujours être extraits |
| Un document texte modifiable | **Word** (DOCX) ou **OpenDocument** (ODT) | Paragraphes et titres qu'un traitement de texte peut continuer de modifier (Lolly Doc Studio) |
| Une mise en page pour InDesign | **InDesign IDML (static subset)** | Texte, rectangles, ovales et images, une planche par plan de travail (Lolly Design) |
| Un document à modifier dans Penpot | **Penpot** | Des boards, des formes, du texte et des tokens liés |
| Une photo ou une image à usage général | **PNG** (sans perte) ou **JPG** (plus léger) | Des formats raster universels |
| Des images modernes de taille réduite | **WebP** ou **AVIF** | Une compression plus efficace avec transparence |
| L'impression | **PDF**, ou **Print PDF** (CMYK) | Taille de page réelle ; CMYK pour une presse |
| Une image raster pour la presse | **Print TIFF** (CMYK) | Des pixels DeviceCMYK destinés à un RIP |
| Une animation pour le web | **GIF** | Lu partout ; fichiers plus lourds |
| Une animation en pleine couleur avec vraie transparence | **APNG** | PNG animé : pas de limite de palette |
| Une animation dans le plus petit fichier | **Animated WebP** | Pleine couleur et transparence, plus léger que GIF ou APNG |
| Une animation vectorielle redimensionnable | **Animated SVG** | Autonome ; lu en boucle dans un navigateur ou un `<img>`, à toute taille (Lottie Ad) |
| Une animation qui reste modifiable | **dotLottie** | Formes, tracés et images clés de transformation externe de la timeline de Lolly Design |
| Un transfert vers Premiere | **Premiere XML + media** | Clips minutés et médias d'origine pour Premiere (Lolly Design) |
| Une vidéo pour les réseaux sociaux et le partage | **MP4** ou **WebM** | Meilleure qualité pour la taille du fichier (voir [Vidéo](#video)) |
| Des sous-titres | **SRT** ou **VTT** | Texte minuté pour un lecteur vidéo (Captions, Audiogram et Record) |
| Des sous-titres pour la diffusion télévisée | **TTML** ou **SCC** | Texte minuté IMSC1.1 ou sous-titres CEA-608 en mode pop-on (Captions ; voir [Sous-titres pour la diffusion télévisée](#broadcast-captions)) |
| Un cours de formation | **SCORM (LMS)** | Un site web, un paquet SCORM ou xAPI avec gestion des versions (voir [SCORM](#scorm-course-packages)) |
| Du texte enrichi ou une signature d'e-mail | **HTML** | Se colle avec sa mise en forme dans les clients de messagerie |
| Une animation lue dans un navigateur | **HTML** | Un lecteur dans un seul fichier, depuis la timeline de Lolly Design ou Snippet (voir [Vidéo](#video)) |
| Du contenu brut | **MD** ou **TXT** | Texte uniquement |
| Un événement de calendrier | **ICS** | S'importe dans toute application de calendrier |
| Une fiche de contact | **VCF** | S'importe dans les carnets d'adresses |
| Des données structurées à réimporter | **JSON** ou **CSV** | Permet un aller-retour du contenu de l'outil |
| Un favicon | **ICO** | Icône de site à plusieurs tailles ; **ZIP** regroupe plusieurs formats |
:::

### Transparence

Les outils qui le permettent proposent une bascule d'arrière-plan transparent, comme **No BG**. PNG, WebP, AVIF, SVG, APNG et Animated WebP conservent la transparence, et GIF garde un bord net. JPG et PDF sont toujours opaques. TIFF aplatit sur du blanc, ou sur du noir dans le chemin [HDR](#hdr-bright-colours).

<!--i:eti-crop-->
## Taille et unités d'impression

Les exports utilisent la taille native en pixels de l'outil, sauf s'il propose des **dimensions**. Tu règles alors la largeur, la hauteur et une **unité** :

- **px** (par défaut) correspond à un nombre exact de pixels.
- **mm, cm, in, pt** et **pc** sont des dimensions physiques. Avec une unité physique, tu règles aussi le **DPI** (300 par défaut). Un **PDF** devient une vraie page à cette taille. Un **raster** obtient le nombre de pixels correspondant à ce DPI et enregistre la résolution. Un **SVG** garde l'unité physique avec un viewBox en pixels.

Pour un raster de plus haute résolution, saisis une largeur et une hauteur plus grandes, ou choisis une unité physique et augmente le DPI (pixels = taille × DPI). Une largeur de `210`, une hauteur de `297` et l'unité `mm` donnent une page A4.

![La ligne des dimensions réglée sur 210 par 297 mm, avec le champ DPI visible parce que l'unité est physique](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

<!--i:eti-images-->
## Images fixes d'une composition temporelle

À partir d'une composition temporelle, comme une timeline [Sequence](/info/sequence-editor.html) dans Lolly Design, un export fixe prend **l'image à la tête de lecture**. Place la tête de lecture à l'endroit souhaité et exporte.

Pour plusieurs instants, utilise le champ **Frames** à côté de la taille de sortie. Il ne s'affiche que pour une composition temporelle et un format fixe (PNG, JPG, WebP, SVG ou PDF). `1` donne l'image à la tête de lecture. Un nombre plus élevé donne autant d'images fixes, réparties uniformément sur la séquence :

- PNG, JPG, WebP et SVG sont fournis dans un seul ZIP : `<name>-01.png`, `-02.png` et ainsi de suite.
- PDF est fourni sous forme d'un document contenant autant de pages.

Chaque image fixe vient du milieu de sa tranche de timeline, donc la première n'est jamais une entrée en cours de fondu et la dernière n'est jamais l'instant vide après la fin des clips.

::: figure exporting-contact-sheet
Frames: 4 découpe la séquence en quatre tranches égales et prend le milieu de chacune.
:::

Utilise Frames pour un storyboard, une planche-contact de révision ou un carrousel pour les réseaux sociaux tiré d'un montage vidéo. Le nombre est limité à 64. Toute autre saisie dans le champ revient à `1`. Chaque image est une image fixe ordinaire, donc les attestations, l'Imprint, les unités physiques et le DPI se comportent comme pour un export unique. Un lien d'export, la CLI et MCP demandent la même planche avec `cuts=` (voir [Planches-contacts](/info/url-export.html#contact-sheets)).

<!--i:eti-copy-->
## Plusieurs fichiers à la fois

Lolly propose trois façons de travailler en volume :

::: cols
## Un tableau devient un document
Un outil conçu pour paginer un tableau en entrée transforme chaque ligne en page. Colle un tableau depuis ton tableur pour obtenir un seul PDF. Pour corriger des lignes, modifie le tableur et colle à nouveau. Battlecards est l'outil de référence. Il se trouve dans le dossier open source `community` et n'est pas listé sur lolly.tools.
## Un CSV devient un fichier par ligne
**Batch** (`#/batch`) prend un CSV et produit un export pour chaque ligne, comme des badges nominatifs ou des certificats, livrés dans un ZIP. Voir [Lolly Batch](/info/batch.html#make-many-versions-of-one-design).
## Plusieurs designs reçoivent une même modification
**Lolly Multi-edit** ouvre plusieurs sessions enregistrées côte à côte pour appliquer le même changement à chacune. Voir [Lolly Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Un outil à plusieurs pages, comme Booklet, Print Sheet, Lolly Doc Studio ou Lolly Markdown Slides, exporte PNG, JPG, WebP, SVG et les autres formats d'image unique à raison d'un fichier par page, dans un ZIP s'il y en a plusieurs. Print Sheet conserve sa feuille entière et ses repères de coupe au DPI choisi.

Depuis **Projects**, **Render folder** exporte chaque session enregistrée d'un dossier et de ses sous-dossiers dans un seul ZIP qui en conserve l'arborescence. **Render selection** fait de même pour une sélection multiple. Une session enregistrée est rendue dans son propre fichier. Projects peut aussi partager à nouveau une session enregistrée sous forme de lien d'outil qui rouvre la session avec les mêmes réglages.

<!--i:eti-pen-->
## Des fichiers qui restent modifiables ailleurs

Certains formats transmettent ton travail à une autre application sous forme de contenu modifiable plutôt que d'image.

### PowerPoint (PPTX)

Lolly Design, Lolly Markdown Slides, Booklet, Lolly Doc Studio, Lolly Chart, Diagrams, Flow Chart et Agenda exportent un deck PowerPoint, avec une diapositive par page. Chaque page est découpée en objets natifs qu'un collègue peut modifier et extraire :

- <!--i:font--> Le **texte** devient des zones de texte PowerPoint modifiables avec la taille de police, la couleur, la graisse, l'italique et l'alignement de la mise en page. Un deck Lolly Design applique la police de la marque à chaque portion de texte, même sans masque de diapositives.
- <!--i:pentool--> Les **vecteurs**, comme les logos et les icônes, sont incorporés sous forme d'images SVG, et PowerPoint peut leur appliquer *Convert to Shape*.
- <!--i:photos--> Les **images** sont transférées comme images séparées à leur résolution native. Un visuel principal recadré conserve l'image entière derrière le recadrage. Tout filtre ou mode de fusion appliqué à une image est intégré au rendu.
- <!--i:layers--> Les **arrière-plans, bordures et filets** deviennent des formes de rectangle et de ligne. Les cercles, ellipses et pastilles de Lolly Design restent des formes natives modifiables.

![Le panneau d'export avec PowerPoint sélectionné : une diapositive par page, le texte et les formes restent modifiables](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

La mise en page est approximative. Tout ce que le moteur de parcours ne peut pas exprimer nativement, comme une zone complexe avec filtre ou masque, est incorporé sous forme d'image. Un deck a une seule taille de diapositive, tirée de la première page.

PowerPoint est aussi une voie d'entrée : [Adapter un deck à ta marque](/info/rebrand.html) transpose un deck dans ton design system, et [Importer un design](/info/design-import.html) en ouvre un dans Lolly Design.

### Penpot

La plupart des outils qui exportent du SVG exportent aussi un **fichier Penpot** (`.penpot`).

| Ce que tu as créé | Dans Penpot |
|---|---|
| Texte | Objets texte modifiables |
| Formes, tracés, dégradés et images | Formes vectorielles modifiables |
| Une couleur ou une police issue d'un token du design system | Un lien actif vers le token : modifie le token et chaque forme qui en hérite suit |
| Le design entier | Un composant réutilisable dans le panneau Assets |
| Une illustration complexe ou un canevas en direct | Une image incorporée ; le contenu autour reste modifiable |

Depuis Lolly Design, chaque cadre devient un board Penpot. Les couleurs et typographies du design system vont dans le panneau Assets et l'ensemble de ses tokens dans le panneau Tokens. Penpot conserve sa propre copie. Un token modifié dans Penpot revient par l'import dans [Lolly Design System Setup](/info/brand-studio.html).

![Le panneau d'export avec Penpot sélectionné : le fichier .penpot et Send to Penpot à côté du téléchargement](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Pour ouvrir le fichier, lance Penpot, choisis un projet puis **Import**. Si tu te connectes à Penpot depuis le panneau d'export, **Send to Penpot** importe le fichier pour toi.

### Word, OpenDocument et InDesign

**Lolly Doc Studio** exporte en **Word** (DOCX) et **OpenDocument** (ODT) avec des paragraphes et des titres modifiables. Le fichier Word définit les polices et la couleur de texte de la marque via les styles du document, respecte la taille de page choisie et ajoute un PNG à côté d'un logo SVG pour les applications qui ne savent pas dessiner du SVG.

**Lolly Design** exporte en **InDesign IDML (static subset)** : texte, rectangles, ovales et images PNG ou JPEG, avec une planche par plan de travail. La mise en forme en ligne prise en charge reste modifiable, les images voyagent dans `Links` et les coordonnées deviennent des points InDesign. Le rétablissement des liens, la substitution des polices et les changements de retour à la ligne peuvent demander des ajustements. Les effets, l'animation, les articles composés et la géométrie non prise en charge arrêtent l'export avec un rapport qui les liste. IDML ne préserve pas le document d'origine. Envoie un PDF pour une illustration terminée.

### Timelines : dotLottie et Premiere

Depuis la timeline de Lolly Design, **dotLottie** écrit une animation qui reste modifiable dans les outils Lottie ; [Animations Lottie](/info/sequence-editor.html#lottie-animations) liste ce qu'il conserve. **Premiere XML + media** regroupe les clips minutés et leurs médias d'origine pour Premiere ; voir [Échange XML avec Premiere](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (paquets de cours)

L'export de cours est désactivé tant que tu n'actives pas **Training and courses** sous Settings → Preferences → Feature flags.

Choisis ensuite **Export course** depuis un outil compatible, un dossier de projet ou une sélection. Dans Lolly Design, choisir **SCORM (LMS)** et **Download** ouvre le même flux de création de cours. Lolly enregistre le travail, affiche le contenu et l'ordre du cours pour vérification, puis ouvre le module et sa boîte de dialogue d'export.

- <!--i:layers--> Choisis un rendu pour chaque source : pages fixes, mouvement sous forme de vidéo, audio ou ressource téléchargeable. Ajoute le texte des leçons et des alternatives de lecture dans le module.
- <!--i:clock--> Prévisualise le lecteur destiné à l'apprenant et vérifie les descriptions et les sous-titres. Le mouvement, y compris l'animation muette, est inclus sous forme de vidéo.
- <!--i:document--> Choisis Website, SCORM 1.2, SCORM 2004 4th Edition ou une cible xAPI expérimentale. Vérifie le contenu et la taille du ZIP, puis enregistre et télécharge la version vérifiée.
- <!--i:check--> Pour terminer, il faut valider chaque leçon obligatoire et choisir Finish.

![Le panneau d'export sur un deck Lolly Design avec SCORM (LMS) sélectionné](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Le paquet contient son contenu terminé et ne nécessite aucun compte Lolly. Place un ZIP Website sur un hébergement HTTP(S) ; importe un ZIP LMS sans le modifier. Teste la destination avant de partager le cours. Pour un cours construit à partir de plusieurs créations enregistrées, voir [Créer un cours de formation](/info/training-creators.html).

### Sous-titres pour la diffusion télévisée

L'outil Captions peut aussi exporter en **TTML** et **SCC**. Les deux sont écrits à partir de la même liste de sous-titres minutés que les fichiers SRT et VTT, donc les mots et les temps correspondent.

- **TTML** utilise l'IMSC1.1 Text Profile, avec des temps d'horloge relatifs au média et une seule région en bas au centre. Il ne contient pas de couleur, de police ni de position propres à chaque sous-titre, car les sous-titres de Lolly ne contiennent qu'un début, une fin et du texte.
- **SCC** contient des sous-titres CEA-608 en mode pop-on sur le canal 1 à 29,97 images par seconde avec timecode drop-frame. Il prend en charge les caractères nord-américains de base ainsi que les caractères spéciaux et étendus. Si un sous-titre contient un caractère absent de ce jeu, l'export s'arrête et indique lequel. Chaque sous-titre passe à la ligne sur 32 colonnes et au plus 15 lignes. Un sous-titre qui ne peut pas se charger avant son heure de début est décalé de quelques images.
- Les sous-titres en mode roll-up et paint-on ne sont pas écrits.

::: note SCC n'a pas été vérifié dans un outil de diffusion télévisée
Il n'a pas non plus été essayé sur un décodeur matériel. Teste un fichier dans ta propre chaîne de traitement avant la livraison.
:::

### DXF (fichiers de découpe)

Lolly Asset Export, Diagrams, Growth, Lolly Logo Wall, QR Code, Street Map, Wayfinding et Wordmark exportent en **DXF**, le format d'échange AutoCAD R12 que lisent les découpeuses laser, les traceurs de vinyle et les logiciels CNC. La géométrie est écrite sous forme de tracés de contour en millimètres et le texte est converti en contours. La couleur est associée à l'AutoCAD Color Index le plus proche, qui pilote généralement l'opération de la découpeuse. DXF ne contient que du dessin au trait : une zone photographique ou filtrée n'a pas de tracé de découpe et est supprimée avec un avertissement. Utilise SVG ou PDF pour conserver le contenu raster. Un texte qu'aucune police ne couvre, pas même une [police de repli](/info/fallback-fonts.html), arrête l'export avec un message qui cite ce texte.

Un design Street Map est entièrement composé de traits, donc chaque route et chaque canal devient un tracé de découpe.

::: showcase
![Un rendu Street Map de Paris à l'encre sur fond crème - uniquement du dessin au trait, donc chaque trait est conservé lors du transfert vers une découpeuse](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Fais défiler, et la caméra recule à travers la géométrie : sept tracés et aucun pixel. Une découpeuse lit le même fichier.
:::

<!--i:eti-stamp-->
## Impression

**Print PDF** écrit du CMYK selon une condition d'impression nommée, **Coated FOGRA39** par défaut. Les nuances de marque dont les valeurs d'encre ont été mesurées conservent ces valeurs. Les autres couleurs sont converties via un profil d'impression : le profil Coated FOGRA39 de Lolly par défaut, ou ton propre profil quand tu choisis sa ligne **Embed**. Les gris et le noir restent sur la seule plaque noire, donc les petits caractères ne peuvent pas subir de défaut de repérage. FOGRA51, SWOP et GRACoL utilisent une conversion standard du périphérique. Le texte noir est aussi en surimpression sur la couleur sous-jacente, donc une presse légèrement décalée ne laisse pas de bord blanc autour des lettres. **Print TIFF** écrit des pixels DeviceCMYK pour un RIP. Le contrôle Colour profile pilote les deux ([Profils colorimétriques](#colour-profiles)). Print TIFF et **EPS (CMYK)** séparent les couleurs via le même profil d'impression que Print PDF.

**Print marks & bleed** a sa propre carte pour les formats d'impression : le fond perdu en millimètres, plus Crop, Registration, Bleed, Colour bars et Stamp details. Stamp details imprime la date, l'outil et ton nom dans la marge. Un nom ou un nom d'outil écrit avec des caractères absents de la police de marge, comme l'arabe, le chinois, le cyrillique ou un emoji, est dessiné sous forme d'image dans le même gris. La carte d'export liste ces écritures.

Certains outils, comme *Booklet*, créent un **PDF multipage** : une couverture, du contenu réparti sur autant de pages que nécessaire et une page de fin. Chaque page est une vraie page PDF au format portrait en A4, US Letter ou A5. Tu peux forcer n'importe quel bloc à commencer sur une nouvelle page. Ce sont des documents RGB sans repères de coupe ni de fond perdu ; ces repères appartiennent au Print PDF d'une seule page. Un PDF Lolly Design peut aussi être un **Notes handout** : une page portrait pour chaque diapositive avec ses notes de présentation en dessous.

**Avant d'exporter.** Une carte **Before you export** en bas du panneau montre ce que verra un imprimeur : format, taille et fond perdu, zones de coupe et de fond perdu, couverture d'encre, nombre de plaques et nombre de pages, avec un verdict à côté du titre. La carte ne bloque jamais un export. Lolly Design affiche toujours la carte avec ses propres vérifications, dont les règles internes du design system calque par calque et l'indicateur rédactionnel du texte du document ([Avant d'exporter](/info/design.html#before-you-export)). Lolly Design ajoute ces vérifications d'impression quand **Print preflight** est activé. Dans les autres outils, active **Print preflight** sous Settings → Preferences → Feature flags. Il est désactivé par défaut, et un déploiement Lolly Work peut l'activer pour ses membres.

**Après l'export.** Lolly relit le fichier terminé et le compare à tes choix : format, taille en pixels ou taille de page, durée du clip, arrière-plan transparent, couleur CMYK, HDR, Content Credentials et mot de passe PDF ou ZIP. Toute différence est inscrite sur la carte d'export. Chaque mesure vient du fichier, jamais du réglage. Une propriété que le fichier ne permet pas de déterminer n'est pas comptée comme correspondante. La ligne de commande écrit la comparaison complète avec `--export-report` (voir [Effectuer un rendu avec la CLI](/info/cli-rendering.html)).

::: details Vérifications d'accessibilité des PDF en ligne de commande
**Vérifications d'accessibilité des PDF.** Pour un PDF, la ligne de commande liste aussi 32 vérifications d'accessibilité dans le fichier `--export-report`, sous `pdfAccessibility`. Chaque vérification a un identifiant, une description simple, un résultat et l'emplacement où elle a trouvé un problème dans le fichier :

- **Passed** : la vérification a examiné un élément et n'a trouvé aucun problème.
- **Failed** : la vérification a trouvé un problème. Les numéros de page ou les balises concernés sont listés.
- **Not applicable** : le fichier ne contenait aucun élément de ce type à examiner, comme des vérifications de tableaux dans un fichier sans tableaux. Cela ne dit rien sur le fichier.
- **Needs a person** : six vérifications ne peuvent pas être évaluées par un programme (ordre de lecture, contraste des couleurs, clignotements, scripts, limites de temps et liens répétés).

La liste n'est pas un verdict. Elle ne dit pas qu'un PDF respecte PDF/UA ni que les personnes qui utilisent des technologies d'assistance peuvent utiliser ce PDF. Une personne doit encore vérifier le fichier avec un lecteur d'écran. Les PDF de Lolly échouent aujourd'hui aux vérifications de balisage, car les exporteurs n'écrivent pas encore de balises. La vérification lit le fichier sur ton appareil et ne change rien. Les fichiers qui nécessitent un mot de passe sont signalés comme non vérifiés, pas comme validés. Pour vérifier un PDF que tu as reçu, dépose-le dans [Lolly Strip Hidden Data](/info/utilities.html), qui affiche la même liste sous **PDF accessibility checks**.
:::

Les vérifications de l'Inspector de Lolly Design et la comparaison de marque dans Lolly Design System Setup examinent le design. Ces deux cartes examinent le fichier.

::: details Coût à partir d'une grille tarifaire
Sous le contrôle avant impression, une carte de coût convertit les mêmes quantités en montants, même quand la carte de contrôle est désactivée. Il lui faut deux choses : un travail qu'une liste de prix peut chiffrer (plaques, feuilles, surface, pages, lignes de variantes ou fichiers de sortie, donc un simple logo PNG n'affiche jamais la carte) et une **grille tarifaire**, une liste de prix JSON fournie par ton imprimeur. Une version par défaut ne contient aucune grille tarifaire et ne permet pas d'en charger une dans l'application. Une grille tarifaire arrive comme ressource du catalogue fournie par un déploiement, ou via l'extension facultative de grille tarifaire qu'un auto-hébergeur ou un plan de contrôle active. Sans grille tarifaire, rien ne s'affiche.

Chaque montant est un tarif que tu as fourni multiplié par une quantité comptée par Lolly, comme `4 plate × €35.00`. Le total affiche sa source : l'émetteur indiqué sur la grille et la date de ses tarifs. Il n'y a ni devise par défaut ni prix fictif. Ce que le fichier dit de lui-même reste du discours rapporté : *« Le fichier indique : … Lolly ne l'a pas vérifié. »*

Quand un montant ne peut pas être calculé, le tableau est retiré plutôt que rempli :

- Les lignes que la grille ne chiffre pas entraînent **l'absence de tout total**, avec seulement un titre indiquant combien n'ont pas de prix.
- Une quantité qui est un plafond garde la mention **« jusqu'à »** dans son sous-total.
- Les tarifs dont la date de validité est dépassée n'affichent **que les quantités** jusqu'à ce que tu appuies sur *Use these rates anyway* ; la date d'expiration reste alors avec le montant.
- En cas d'ouverture par un **lien**, les montants restent masqués jusqu'à ce que tu les demandes sur cet appareil. La CLI accepte `--rate-card=<file.json>` comme fichier local et jamais comme paramètre de lien.

La carte est retirée de chaque étape d'export et ne modifie jamais le fichier. C'est un calcul, pas un devis. Seul ton imprimeur peut établir un devis.
:::

<!--i:eti-film-->
## Mouvement et son

### Vidéo

Les outils animés exportent en **MP4** et **WebM**. Un lien partagé `?format=` qui demande un conteneur que ce navigateur ne sait pas produire se replie sur l'autre, avec un nom de fichier correspondant. **Start after** maintient le canevas immobile pour que les animations et les polices se stabilisent avant l'enregistrement. **Duration** définit la durée du clip terminé. **Motion blur** (Off, Draft quality, Standard ou High, avec un **Shutter angle**) floute les mouvements rapides et ralentit le rendu. Quand le navigateur le permet, **Record live** enregistre l'aperçu à l'écran en temps réel via un partage d'écran.

![Les réglages temporels d'un export animé : Start after, Duration, Motion blur avec son Shutter angle et Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** permet de choisir Smaller file, Balanced ou Best quality. **Advanced** ouvre **Codec**, **Frame rate**, **Rate mode** et **Hardware acceleration**. Quand un outil a des sous-titres, **Captions** permet de choisir une **Embedded track** ou un **Sidecar .vtt + .srt** à côté de la vidéo. Un lien transporte la qualité, le codec, la fréquence d'images, la durée et le délai de démarrage sous les noms `vq`, `codec`, `fps`, `seconds` et `wait` ([Paramètres d'URL](/info/url-parameters.html)).

Les exports vidéo conservent leur son. Un outil peut placer un **fond musical** sous le clip : une ressource audio lue en boucle ou coupée à la durée du clip, avec fondus, volume et atténuation sous le son propre aux images. Les outils d'enregistrement transmettent leur audio en direct dans le fichier.

Un deck Lolly Design qui avance au clic peut aussi s'exporter en vidéo. **Export slides as video** dans le menu Present ouvre le panneau d'export sur MP4. Chaque diapositive est lue pendant sa propre durée d'affichage, ou pendant la Duration du panneau d'export si elle n'en a pas. La transition du deck se joue entre les diapositives sous forme de fondu. Le document ne change pas.

**HTML** issu d'un document temporel Lolly Design, ou de Snippet, est un lecteur dans un seul fichier : des contrôles de lecture, de déplacement dans le temps et de son sur l'animation, avec ses polices prises en charge, ses images et son audio incorporés. Le fichier se lit hors ligne. Un film Lolly Design avec des scènes ajoute un menu de ses scènes. Une séquence qui contient un clip vidéo, Lottie ou 3D ne peut pas encore s'exporter en HTML ; exporte la séquence en vidéo.

### Images animées

**GIF** se lit partout et convient aux conversations et aux e-mails ; il est plus lourd et offre moins de couleurs que la vidéo. **APNG** et **Animated WebP** conservent toutes les couleurs et la transparence. **Lottie Ad** exporte aussi en **Animated SVG** : des images vectorielles avec des images clés CSS incorporées, qui s'adaptent à toute taille et tournent en boucle dans un onglet de navigateur ou un `<img>` sans codec. Son texte est converti en contours. Sa fréquence d'images par défaut est plus basse, car chaque image est plus lourde qu'un bitmap. Tous ces formats sont muets.

### Audio

Certains outils exportent du son seul. **Lolly Voice Recorder** capture une prise au microphone avec un indicateur de niveau en direct et l'enregistre en **MP3**, **WAV**, **M4A (AAC)** ou **Opus (WebM)**, encodé sur ton appareil. `wav`, `mp3`, `m4a` et `opus` sont des identifiants de format ordinaires, donc un export audio se partage et se pilote par script aussi facilement qu'un PNG.

Le sélecteur de ressources accepte de nombreux formats audio pour un fond musical, de MP3 et FLAC à MIDI et aux modules de tracker ; [Formats](/info/formats.html) les liste. Un [morceau Lolly Rondocode](/info/rondocode.html) se joue pendant la durée demandée par son clip.

<!--i:eti-palette-->
## Couleur et HDR

Lolly lit toutes les couleurs CSS modernes, effectue ses calculs de couleur selon la perception et écrit chaque fichier dans un espace qu'un lecteur peut ouvrir : sRGB pour les écrans, CMYK pour l'impression et Rec.2100 PQ pour le HDR ([La couleur dans le moteur](/info/colour-engine.html)). Un document Lolly Design réglé sur **Wide colour / HDR** suit ses propres règles : voir [Édition en gamut étendu et HDR](/info/hdr-editing.html).

### Profils colorimétriques

Les exports sont étiquetés avec un profil colorimétrique, pour que les applications qui gèrent les couleurs, comme celles des imprimeurs, Photoshop et les navigateurs, lisent les couleurs comme tu les as vues. Les vignettes et les aperçus omettent cette étiquette pour rester légers.

- **PNG et JPG** contiennent un profil ICC **sRGB** incorporé, l'espace dans lequel l'aperçu est dessiné. Les pixels sont étiquetés, pas réencodés.
- **Print PDF (CMYK)** déclare sa condition d'impression dans son *OutputIntent*, indiquant à un imprimeur comment ses encres CMYK doivent être interprétées.
- **Print TIFF (CMYK)** écrit des pixels DeviceCMYK sans étiquette et enregistre la condition d'impression dans ses métadonnées TIFF. Un TIFF ne peut pas incorporer de profil d'impression, donc une ligne **Embed** n'enregistre que le nom de ce profil.
- **TIFF (RGB)** est la version sRGB non compressée pour l'archivage ou un aller-retour dans un éditeur. Les deux TIFF sont réservés aux ordinateurs, car les navigateurs ne peuvent pas prévisualiser un TIFF.
- **SVG**, **EMF**, **EPS** et **DXF** sont des formats vectoriels sans profil incorporé : les couleurs SVG sont en sRGB, EMF et EPS utilisent le RGB du périphérique, **EPS (CMYK)** écrit du DeviceCMYK et DXF utilise l'AutoCAD Color Index. SVG, EPS et DXF convertissent le texte en tracés. EMF garde le texte actif et modifiable dans Office et Google Slides et ne convertit en contours que les portions que le format ne peut pas exprimer. L'option **Outline fonts** du panneau d'export impose des tracés partout, comme `_text=outline` dans un lien et `--text=outline` en ligne de commande. SVG reproduit aussi les ombres de boîte CSS, intérieures et extérieures.

::: details PDF/X-4 et ton propre profil d'impression
Lolly fournit un profil CMYK, ajusté aux données de caractérisation FOGRA39 de Fogra et publié sous CC0, et convertit les couleurs via ce profil pour la condition d'impression par défaut. Le profil n'est pas incorporé, car il est en version ICC 4.3 et PDF/X-4 accepte les versions jusqu'à 4.2. Une condition d'impression nommée écrit donc l'intention de sortie sans revendiquer la conformité PDF/X-4.

Charge ton propre profil CMYK et choisis sa ligne **Embed** dans le contrôle Colour profile. Il est incorporé comme *DestOutputProfile* du fichier, et le PDF revendique la conformité PDF/X-4 chaque fois que le reste du fichier le permet. La condition d'impression qu'il déclare est lue dans ce profil : un nom enregistré si le profil en atteste un, ou `Custom` sous le nom du profil lui-même.

Trois éléments empêchent cette revendication tout en conservant l'intention de sortie : une illustration RGB que la passe CMYK n'a pas pu convertir, le texte de crédit `prov` dans la marge d'épreuve (dessiné dans une police standard non incorporée) et un mot de passe **Strong**, puisque PDF/X-4 interdit le chiffrement. Chaque PDF contient aussi des métadonnées PDF/X-4 : zones de page, XMP, identifiant de document et intention de sortie sRGB avec son profil.
:::

### Tons directs en quadrichromie

Un design system peut attribuer une encre en ton direct à une couleur, comme une couleur Pantone ou HLC. Le **Print PDF** imprime alors cette couleur sur sa propre plaque. Lolly Demo attribue une encre en ton direct à chaque couleur sauf à ses blancs, Sugar et Daylight, et à son noir, Void. Un Print PDF créé dans Lolly Demo imprime la plupart des couleurs sur des plaques de tons directs et le noir sur la plaque noire.

Pour un fichier en quadrichromie simple, coche **Print spot inks as process** dans la carte Profile du panneau d'export. Chaque encre en ton direct s'imprime alors en cyan, magenta, jaune et noir, avec la composition CMYK que le design system attribue à cette couleur. Une couleur sans composition propre utilise la conversion du profil de presse, comme toute autre couleur du visuel. Le fichier ne contient alors que les quatre plaques de quadrichromie. Le choix est désactivé par défaut. Le panneau affiche la case uniquement pour **Print PDF**, et seulement quand le design system attribue une encre en ton direct à une couleur.

Une finition n'est pas une encre. Dorure, gaufrage, débossage, vernis sélectif, toucher doux, découpe, rainage et perforation gardent leurs propres plaques nommées quand la case est cochée, car une finition imprimée en quadrichromie placerait son masque noir sur la page.

La carte **Before you export** et `lolly preflight` comptent les plaques que le fichier contiendra. Quand la case est cochée, ils comptent les quatre plaques de quadrichromie et les éventuelles plaques de finition, et indiquent que les encres en tons directs s'impriment en quadrichromie sans ajouter de plaques. Quand la case est décochée, ils comptent jusqu'à une plaque de ton direct pour chaque encre en ton direct fournie par le design system. Une grille tarifaire utilise ces nombres, donc elle ne facture jamais une plaque de ton direct absente du fichier.

Les formats **Print TIFF** et **EPS (CMYK)** n'ont pas de plaques nommées, donc ils impriment chaque encre en quadrichromie, que le choix soit activé ou non. Pour ces deux formats, la carte et `lolly preflight` comptent les quatre plaques de quadrichromie et jamais de plaque de ton direct ou de finition. Une finition y est intégrée sous forme de masque noir sur la plaque noire, et la carte le signale comme une erreur.

Un lien demande le même fichier avec `_spots=process`, la ligne de commande avec `--spots=process`, le [serveur MCP](/info/mcp.html) avec `spots: "process"` et l'application de terminal avec sa ligne **Spot inks**. Rien de ce choix n'est inscrit dans le fichier : seules les encres changent.

### HDR (couleurs lumineuses)

La carte **HDR** du panneau d'export augmente la luminosité des visuels ordinaires pour les écrans HDR. Pour conserver les originaux HDR pendant l'édition, voir [Édition en couleurs étendues et HDR](/info/hdr-editing.html).

Un export ordinaire est en sRGB : une couleur de marque saturée est aussi lumineuse que le blanc normal de l'écran. Un écran HDR peut aller plus haut. La carte **HDR** pousse tes couleurs de marque et le texte blanc vers la luminosité maximale. Les zones sombres restent sombres.

![La carte HDR du panneau d'export, activée, avec les réglages White / Reach / Dark lift / Focus affichés en dessous](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formats.** PNG, JPG, AVIF et TIFF. WebP est en 8 bits sans chemin de décodage HDR fonctionnel, et les formats vectoriels et PDF n'ont pas de modèle HDR.
- **Désactivé par défaut**, car cela modifie les pixels. Coche la carte, ou passe `hdr=1` dans un lien de partage.
- **Les réglages.** **White** (le plafond de luminosité maximale, de 400 à 2000 nits), **Reach** (jusqu'où l'éclat s'étend dans les tons sombres), **Dark lift** (de combien les tons sombres s'éclaircissent ; `0` les garde sombres) et **Focus** (la richesse des couleurs que l'amplification préserve). Ils voyagent comme une seule valeur : `hdr=1600-60-0-50` correspond à White 1600, Reach 60, Dark lift 0 et Focus 50.
- **Ce qui est écrit.** PNG reçoit du Rec.2100 PQ en 16 bits avec un bloc `cICP`. JPG est un JPEG à carte de gain ISO 21496-1 : une image SDR ordinaire suivie d'une carte de gain. AVIF reçoit une boîte `colr` réécrite. TIFF reçoit des pixels PQ avec un profil ICC v4 généré contenant une balise `cicp`. TIFF s'aplatit sur du noir, car le blanc correspond au code de 10 000 nits en PQ et créerait un halo autour de chaque bord. L'amplification suit la clarté perceptuelle (OKLab) et conserve la teinte, donc un vert de marque devient plus lumineux sans virer au vert menthe.
- **Où l'éclat apparaît.** Dans les visionneuses avec gestion des couleurs sur un écran HDR : Preview, Quick Look et Safari sur les appareils Apple, ou Chrome sur un moniteur HDR. Un écran SDR affiche une image normale.
- **Depuis le terminal.** `--hdr=1` avec `--export=png` ou `--export=jpg` écrit le même PNG et le même JPEG à carte de gain via la [CLI](/info/cli.html), avec les mêmes encodeurs du moteur, sans navigateur. Pour l'instant, AVIF et TIFF ne sont disponibles qu'en export web.

::: warning Beaucoup de plateformes suppriment le signal HDR
Une plateforme qui réencode les fichiers envoyés peut rendre l'image sombre ou délavée. Utilise le HDR quand tu maîtrises la destination, comme ton propre site, un mur vidéo ou un deck sur un écran lumineux.
:::

<!--i:eti-badge-check-->
## Ce qui accompagne ton fichier

Un fichier terminé peut contenir plusieurs enregistrements. Certains sont à côté des pixels et disparaissent quand le fichier est réenregistré, capturé à l'écran ou dépouillé de ses métadonnées. Deux marques sont inscrites dans les pixels.

::: figure exporting-what-travels
Où se trouve chaque enregistrement, s'il est activé par défaut et quel paramètre de lien le contrôle.
:::

Le panneau d'export réunit **Licence**, **Source credits**, **Password**, **C2PA Credentials**, **Lolly Imprint** et **Durable credential** dans un groupe **Content protection** qui n'affiche que les cartes utilisables par le format choisi. Le groupe s'ouvre tout seul quand un lien ou un document déclare déjà une licence, ou quand une source attend ta décision. La carte **Design system** reste en dehors du groupe, visible à chaque export.

![Le groupe Content protection ouvert pour un export PNG, affichant uniquement les cartes qui s'y appliquent](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Provenance & filigrane

Quand le format dispose des champs nécessaires, les exports portent des **métadonnées de provenance** : le logiciel, la source, le nom de l'outil et la mention de crédit de ton profil, inscrits dans PNG iTXt, JPEG EXIF, les informations PDF, le `<metadata>` SVG ou un commentaire GIF. Elles ne consignent que la paternité. Rien n'est envoyé. Les outils **Experimental** ajoutent aussi un filigrane visible. L'hôte applique le filigrane, donc modifier l'outil ne permet pas de retirer la marque.

**Le Lolly Imprint** est un filigrane invisible dans les pixels, **activé par défaut**. Il résiste à la recompression, donc une copie peut encore être reconnue comme créée avec Lolly. C'est un indice, pas une garantie cryptographique, et il ne contient aucune donnée personnelle. Il est inscrit dans JPEG XL, PNG, JPG, WebP, AVIF, TIFF et BMP, ainsi que dans les images raster que Lolly rend dans un PDF ou PPTX, jamais dans une image que tu as incorporée. Décoche **Lolly Imprint** ou passe `imprint=0` pour omettre l'Imprint. Sa résistance au réencodage AVIF n'est pas encore calibrée. [Lolly Verify](/#/verify) détecte l'Imprint sur ton appareil ; voir [Le Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**Le Durable credential** inscrit l'identifiant de Lolly dans les pixels avec un modèle neuronal sur l'appareil au format TrustMark, afin que le lien « créé avec Lolly » résiste à la suppression des métadonnées et au réencodage, et reste lisible par les outils compatibles avec TrustMark. Il est **désactivé par défaut**, car il nécessite une passe neuronale par export et un téléchargement unique du modèle. Il couvre PNG, JPG, WebP, AVIF et TIFF. Coche-le dans le panneau ou passe `durable=1`. Les applications de bureau et mobiles masquent la carte, car elles n'ont pas d'origine d'où récupérer le modèle hors ligne.

**Licence.** Choisis comment les autres peuvent utiliser ton travail : *None (all rights reserved)* par défaut, CC0 1.0, Public Domain Mark 1.0 ou une licence Creative Commons 4.0 (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). Le nom de la licence et un lien vers son résumé entrent dans les métadonnées de licence du fichier (EXIF, XMP et RIFF quand le format en dispose) et dans son Content Credential. Le choix est enregistré avec le document et voyage dans un lien sous la forme `licence=`. Lolly inscrit la licence que tu as choisie. Lolly ne vérifie pas les conditions et ne les fait pas respecter. Un outil avec son propre champ de licence, comme Claim, conserve ce champ à la place.

### L'enregistrement du design system

Un export consigne le design system qui a créé le fichier : son nom, la version publiée dont il provient (quand ce n'est pas la version de travail) et le [colourway](/info/colourways.html) utilisé pour le dessiner. Tout autre choix de thème déclaré par un design system, comme une densité, est consigné de la même façon. Le choix clair ou sombre est omis, car l'image montre déjà lequel a été utilisé.

**Tu vois l'enregistrement avant toute écriture.** La carte **Design system**, cochée par défaut, montre les mots exacts que le fichier contiendra, comme *Records: Acme · Colourway: Beach*, et la description. Le nom d'un design system est celui que ses propriétaires ont saisi, et la carte l'affiche tel quel. Décoche la carte pour omettre l'enregistrement de cet export. Le panneau de document de Lolly Design liste les mêmes mots sous *Embedded in exports*.

**La description indique le colourway à côté de l'outil.** Quand la carte est cochée, *« Créé avec https://lolly.tools : Chart »* devient *« Créé avec https://lolly.tools : Chart (colourway Beach) »*. Le nom du design system reste dans l'enregistrement, pas dans la description. Une description sans nom d'outil, ou qu'un outil écrit à partir de ses propres entrées, reste inchangée. Un outil qui ignore les colourways via `tokenAxes` n'en consigne aucun, et le crédit de l'épreuve PDF (la marque d'impression `prov`) suit la même règle.

::: details Compétences de marque, pages de marque et entreprises partenaires dans l'enregistrement
**Les compétences de marque qui ont guidé un agent.** Quand un agent a créé la pièce et nommé les [compétences de marque](/info/brand-skills.html) qu'il a lues et suivies, l'enregistrement liste aussi chaque compétence avec sa révision, comme *Guided by: acme-brand 1.0*. Ces mots signifient que la compétence a guidé le travail. Lolly ne vérifie pas la pièce par rapport à une compétence. Seule la déclaration de l'agent ajoute la liste. Aujourd'hui, il s'agit de l'argument `brandSkills` de `lolly_render` du [serveur MCP](/info/mcp.html), donc une pièce créée dans l'application ou à partir d'un lien de partage n'en contient aucune. Le Content Credential contient la liste sous `brandSkills`, une seule valeur JSON avec l'identifiant, le nom, la révision et l'empreinte SHA-256 de chaque compétence. Le paquet XMP et les métadonnées SVG contiennent la même valeur sous `lolly:BrandSkills`. Un PDF écrit à partir de l'enregistrement gagne un mot-clé par compétence. La description reste inchangée. Le texte d'une compétence interne n'est jamais consigné. Les mêmes bascules omettent la liste avec le reste de l'enregistrement : la carte **Design system**, `_madewith=0`, `--no-madewith` et `madeWith: false`. Quand le serveur MCP dessine le fichier dans un navigateur (un PDF, un JPEG et les autres formats que son chemin sans navigateur ne peut pas écrire), les métadonnées propres au fichier ne contiennent aucune liste. Seul un Content Credential peut alors contenir la liste. Passe `c2pa` pour conserver l'enregistrement. Sans Content Credential, le rendu avertit que les compétences de marque n'ont pas été consignées.

**La page de marque, quand son éditeur l'active.** L'éditeur d'un design system peut choisir de consigner l'adresse de sa [page de marque](/info/brand-page.html#lead-back-from-your-files) dans les exports. Le réglage est propre à chaque design system et désactivé par défaut. La carte ajoute alors l'adresse à la même ligne, comme *Records: Acme · Colourway: Beach · Brand page: https://acme.example/brand/acme/*. Décocher la carte supprime l'adresse avec le reste. L'enregistrement contient l'adresse et rien d'autre sur la page. Rien d'autre ne change dans le fichier. Un design system sans adresse écrit le même fichier qu'avant.

**L'adresse ne voyage pas avec un pack.** Un enregistrement dans un fichier signé est présenté comme celui du signataire. Une adresse ne doit pas s'activer toute seule pour quelqu'un qui ne l'a pas choisie, et un pack ne doit pas pouvoir faire pointer les fichiers d'autres personnes vers une page de son choix. Un pack `.lolly`, une copie ou un fork de design system, **Try these colours**, une sauvegarde restaurée et un fichier de tokens fourni pour une seule exécution arrivent tous avec le réglage désactivé. Tu peux l'activer toi-même, avec une adresse que tu saisis. Un design system géré est la seule exception : il garde l'adresse que son gestionnaire a définie dans les tokens source. [Renvoyer vers ta page depuis tes fichiers](/info/brand-page.html#lead-back-from-your-files) donne les détails.

**L'entreprise partenaire, dans un programme de partenariat Lolly Work.** Une pièce créée pour une entreprise partenaire consigne l'entreprise et son programme sur la même ligne, comme *Records: Acme · Colourway: Beach · Partner: Northwind IT (Resellers, EMEA)*, avec la révision des informations de l'entreprise dans le fichier. L'enregistrement ne contient aucune personne, coordonnée, adresse ou devise. Quand le kit partenaire de l'entreprise est joint, la ligne ajoute sa révision, comme *, kit revision 2*, et l'attestation contient l'identifiant et la révision du kit, jamais ses couleurs ni ses règles. Décocher la carte supprime le partenaire avec le reste de l'enregistrement. Un PDF gagne le mot-clé *Partner: Northwind IT*, et [Lolly Verify](/info/what-verify-checks.html#partner) affiche l'enregistrement sous **Partner** ([L'enregistrement du partenaire dans les fichiers](/info/manage/partner-programmes.html#the-partner-record-in-files)).
:::

**Relire l'enregistrement.** [Lolly Verify](/#/verify) affiche l'enregistrement sous **Design system** dans les détails de l'attestation d'un fichier et les éventuelles compétences de marque sous **Guided by**. Une page de marque apparaît séparément, comme [une adresse consignée par le signataire](/info/what-verify-checks.html#brand-page). *Recreate with these settings* rouvre l'outil dans la version et le colourway consignés. Le lien s'ouvre avec le design system consigné quand cet appareil en possède un avec le même identifiant et le même nom ; sinon, il s'ouvre avec ton design system actif.

::: details Ce qui est écrit où, et quelles exécutions omettent l'enregistrement
| Où | Ce qui est écrit |
|---|---|
| Content Credential | `designSystem` (l'identifiant), `designSystemLabel`, `designVersion` et `themes` dans l'assertion `tools.lolly.export`, chacun comme valeur en texte brut ; `themes` est une liste JSON des choix. `brandPage` quand l'éditeur l'a activé |
| PNG, JPEG, WebP et JXL | Les mêmes valeurs comme propriétés `lolly:` du paquet XMP du fichier, dans l'espace de noms `https://lolly.tools/ns/export/1.0/`. `lolly:BrandPage` quand l'éditeur l'a activé |
| SVG | Les mêmes propriétés `lolly:` dans le bloc `<metadata>` |
| PDF | Des mots-clés comme *Design system: Acme*, *Colourway: Beach* et, quand l'éditeur l'a activé, *Brand page: https://acme.example/brand/acme/* |
| Tout format avec un champ de description | La description, avec le colourway à côté de l'outil |

La carte n'apparaît que s'il y a quelque chose à consigner et que le format peut contenir l'enregistrement. CSV, JSON, un fichier de calendrier et les autres formats texte ou données ne contiennent pas de métadonnées, et EPS, EMF, DXF et BMP n'ont pas de champ pour l'enregistrement. HTML, Markdown et CSS ne contiennent l'enregistrement que dans leur Content Credential, donc pour eux la carte n'affiche aucune ligne de description et se masque quand **C2PA Credentials** est désactivé. Un champ que le design system ne fournit pas reste absent du fichier.

Un lien de partage désactive l'enregistrement avec `_madewith=0` ([Paramètres d'URL](/info/url-parameters.html)). La ligne de commande accepte `--no-madewith`, `lolly_render` du [serveur MCP](/info/mcp.html) accepte `madeWith: false` et le panneau d'export de l'application de terminal a une ligne **Design system**. La ligne de commande affiche sur la sortie d'erreur standard les mots que contient un fichier terminé, pour un rendu d'outil et pour chaque fichier que `lolly run` exporte d'une session Lolly Design enregistrée. Un rendu MCP affiche les mots à côté du fichier. Les deux relisent les mots dans le fichier. Un PNG que la ligne de commande dessine sans navigateur ne contient pas de métadonnées de fichier, donc son enregistrement ne voyage que dans l'attestation. Les utilitaires sur l'appareil n'ajoutent pas de métadonnées.

Les exécutions sans carte **Design system** omettent l'enregistrement : une exécution Lolly Batch, un dossier exporté depuis Projects et un export de collection 3D, et dans l'application de terminal, un lot CSV, un export de dossier ou de sélection Projects et la vue de rendu de tous les éléments. Exporte un fichier depuis l'outil pour consigner le design system.
:::

### Content Credentials (C2PA)

Les exports peuvent contenir des **Content Credentials** : un manifeste [C2PA](https://c2pa.org) signé qui consigne ce qui a créé le fichier, quand et où, lié à une empreinte des octets du fichier pour rendre toute modification ultérieure détectable. Lolly écrit des manifestes standard que tout lecteur C2PA peut inspecter.

![La carte C2PA Credentials cochée, avec la durée de validité de l'attestation à côté de la case](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Activé par défaut.** La carte **C2PA Credentials** est cochée pour presque tous les outils. Décoche-la pour un export, ou passe `c2pa=off` dans un lien. Le fichier n'a alors aucune attestation, et un SVG qui intègre un visuel doté d'une attestation, comme un logo du catalogue, perd aussi l'attestation de ce visuel. Le Lolly Imprint et les autres métadonnées du fichier restent. Un outil peut désactiver cette fonction dans son manifeste.
- **Formats.** PDF (RGB et Print), PNG et APNG, JPG, GIF, SVG et SVGZ, TIFF (RGB et Print), WebP (fixe et animé), AVIF, MP4, WebM, HTML, Markdown, CSS et les conteneurs audio MP3, WAV, M4A, OGG/Opus et FLAC. Un ZIP marque chaque membre pris en charge, ce qui permet à un SVG animé d'obtenir une attestation. MP4, AVIF et M4A utilisent la liaison BMFF standard et MP3 sa correspondance ID3v2, donc `c2patool` et d'autres lecteurs les vérifient. WebM et OGG/Opus n'ont pas encore de correspondance standard, donc Lolly transporte le manifeste dans une pièce jointe Matroska et un champ OpusTags, que son propre vérificateur contrôle. Un SVGZ est un SVG compressé. La spécification C2PA ne définit pas de forme compressée, donc l'attestation est écrite dans le SVG avant la compression. Le vérificateur de Lolly lit le fichier tel quel ; `c2patool` lit la même attestation une fois le fichier décompressé (`gunzip`). ICO, EPS, EMF, DXF, BMP, PPTX, les formats Office et les autres formats texte et données n'ont pas de conteneur C2PA.
- **Ce qui est consigné.** L'outil et l'application qui ont créé le fichier, l'heure de signature et l'application hôte qui l'a exporté. Pour une page Lolly Design exportée en image, SVG ou PDF, le moteur qui a dessiné la page (`route` dans l'assertion `tools.lolly.export` : `gpu` pour le moteur de rendu de page GPU, `operations` pour les opérations de dessin écrites en vectoriel, `compatibility` pour le moteur du navigateur) et la version de ce moteur (`renderer` : la recette GPU, `design-draw-v` et sa version, ou `dom-to-image` et `dom-walker`). Le [design system et le colourway](#the-design-system-record) tant que la carte **Design system** est cochée. Les réglages actifs : choix de menus, nombres, bascules et couleurs tels quels, et tout ce qui est saisi (titres, noms, notes, liens et dates) uniquement sous forme d'empreinte, pour que les mots ne soient pas dans le fichier. Les champs liés au profil, les contrôles inactifs, les versions du navigateur et les détails du système d'exploitation sont omis. Ton nom et ton e-mail n'apparaissent comme auteur que si **Use my details to create** est activé sous Settings → Preferences → Your details. Les sources placées dans un export voyagent comme ingrédients. Chaque image de la page qui possède son propre Content Credential est consignée comme un composant de la page, avec cette attestation et tout type de source IA qu'elle déclare. C'est le cas dans un PNG, JPEG, WebP, AVIF, TIFF, SVG ou PDF, et dans un GIF, APNG, WebP animé, MP4 ou WebM quand l'image est dessinée dans au moins une image de la plage exportée. L'image unique qu'un outil comme Darkroom, Filter ou Asset Export modifie est plutôt consignée comme le parent du fichier, d'abord ouverte puis suivie de ce que l'outil lui a fait. Les autres ingrédients sont les [œuvres créditées](#source-credits) comme les emoji, les [morceaux Lolly Rondocode](/info/rondocode.html#songs-in-the-credential) d'un export vidéo ou audio et les [mélodies enregistrées](/info/generated-music.html#what-a-track-records) d'un export vidéo ou audio. Chaque mélodie enregistrée a son nom, la licence quand elle en consigne une, le SHA-256 de sa recette, la version du moteur et la mention de média algorithmique. Le créateur d'une mélodie enregistrée (le nom de profil utilisé à l'enregistrement) n'est ajouté que si **Use my details to create** est activé, comme ton propre nom. Ce n'est qu'alors que le panneau d'export montre le créateur avant l'export.
- **Une approbation, quand elle a été consignée.** Un fichier approuvé via [Lolly Work](/info/work-approvals.html#review-an-exported-file) peut porter un second enregistrement signé couvrant cette attestation : l'identifiant de l'approbation, la date de la décision et l'empreinte du fichier examiné. Il ne contient aucun nom, e-mail, groupe, commentaire ou nom de chaîne. Il est coché par défaut dans la boîte de dialogue de demande et peut être décoché pour une demande ou désactivé pour une instance. Il consigne qu'un signataire a déclaré une décision. Il ne dit pas que le travail respecte une norme.
- **Ce qui lui a été demandé, pour un fichier créé à partir d'une [intention](/info/visual-intent.html#what-goes-in-the-file).** L'objectif, le support, l'outil, la langue, les versions des règles et du vocabulaire et l'empreinte de l'intention. L'occasion, le public, la région et le prompt ne sont que des empreintes, sauf si la personne ou l'agent qui lance ce rendu demande de consigner les mots du prompt. Seul un rendu lancé à partir d'une intention contient cet enregistrement. L'exécution indique ce qu'elle a consigné, et l'enregistrement peut être omis.
- **Ce que voient les destinataires.** Les outils C2PA comme les applications Adobe, `c2patool` et contentcredentials.org/verify lisent le manifeste et affichent la déclaration. Lolly signe avec une clé créée sur ton appareil, pas avec un certificat issu d'une liste de confiance, donc les visionneuses signalent une attestation *non vérifiée*. La structure et les preuves de modification sont valides, mais personne ne se porte garant du signataire. Pour changer cela, enregistre une **identité vérifiée** sous Settings → Preferences → Content Credentials ; voir [Identité Content Credentials](/info/content-credentials-identity.html).
- **Vérifier un fichier.** Dépose n'importe quel fichier sur [Lolly Verify](/#/verify), ou exécute `lolly validate <file>`, pour obtenir sur ton appareil un rapport qui indique d'abord si Lolly a créé le fichier et s'il a changé depuis. Lolly Verify examine aussi ce qui dépasse l'attestation ; voir [Ce que vérifie Lolly Verify](/info/what-verify-checks.html).
- **Confidentialité.** La clé de signature est créée pour l'export et ne quitte jamais ton appareil. La déclaration ne contient que ce que les métadonnées de provenance portent déjà. Les utilitaires de confidentialité qui transforment tes propres fichiers n'ajoutent aucune attestation, et *Lolly Strip Hidden Data* supprime un manifeste C2PA comme toute autre métadonnée. L'utilitaire Rondocode crée de nouveaux fichiers audio, donc il signe ce qu'il écrit ([Morceaux Lolly Rondocode](/info/rondocode.html#files-from-the-rondocode-utility)). Le générateur de musique signe chaque téléchargement WAV ou M4A. L'attestation consigne que le générateur de musique de Lolly a créé la piste et la licence dont relève la musique, CC BY 4.0, avec son crédit ([Ce que consigne une piste](/info/generated-music.html#what-a-track-records)).
- **Interactions.** Un PDF protégé par mot de passe ne peut pas contenir de Content Credentials, quel que soit le niveau. L'attestation est ajoutée en dernier, sur les octets finaux, après les DPI, EXIF, le profil de couleur, les métadonnées PDF/X et les marques d'impression.

### Crédits des sources

Un export qui utilise le travail de quelqu'un d'autre consigne cette source dans l'attestation. Le cas courant est un emoji du jeu d'emoji choisi : l'œuvre, son créateur, la licence, l'origine exacte des octets et ce qui a changé voyagent tous avec le fichier. Le texte dans un outil dont le modèle est un SVG garde les emoji du système, donc aucun crédit n'y est ajouté. Avant le téléchargement, la ligne **Source credits** indique ce que les sources exigent de la livraison. Après le téléchargement, la ligne relit les octets livrés avant d'indiquer que les crédits sont dans le fichier. Une licence qui te demande de choisir, comme un glyphe CC BY-SA recoloré que tu t'apprêtes à partager, reçoit une carte avec les options. Le téléchargement n'est jamais bloqué. [Droits de création et crédits](/info/creative-rights.html) donne les formulations, les licences examinées et ce qui reste à toi.

<!--i:eti-lock-->
## Protection par mot de passe

Lolly propose deux types de verrouillage, tous deux sur ton appareil. La carte **Password** du panneau d'export règle les deux.

![La carte Password dépliée pour un export PDF, avec le champ de mot de passe et les deux niveaux de verrouillage](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**Un mot de passe d'ouverture PDF** a deux niveaux une fois que tu saisis un mot de passe :

- **Weak** : RC4 40 bits, pour un `pdf` RGB sans marques d'impression ni fond perdu et avec un mot de passe en ASCII simple. Un mot de passe contenant d'autres caractères passe à Strong, car les lecteurs ne peuvent pas ouvrir un fichier ainsi verrouillé à ce niveau. Seuls les 32 premiers caractères comptent.
- **Strong** : AES-256 (PDF 2.0). Il s'applique aussi aux Print PDF et à chaque PDF dans un ZIP de lot. Un Print PDF verrouillé avec Strong garde son CMYK, ses marques et son intention de sortie mais perd la déclaration PDF/X-4.

::: warning Weak dissuade, mais ne protège pas
Utilise **Strong** pour un fichier confidentiel.
:::

**Un ZIP verrouillé** couvre un export ZIP, un téléchargement de dossier depuis Projects ou un lot, avec un mot de passe et deux niveaux : **Weak** (ZipCrypto, dissuasif) ou **Strong** (AES-256). Le mot de passe protège chaque membre. Tout PDF à l'intérieur est aussi verrouillé individuellement avec AES-256, donc il reste verrouillé après la décompression du ZIP. La demande apparaît au début du téléchargement. Un mot de passe vide signifie aucun verrouillage.

**Un mot de passe saisi reste absent des liens aux deux niveaux.** Si un fichier arrive par un lien `?password=`, Lolly lit la valeur et la retire aussitôt de l'adresse. Un lien qui demande un verrouillage incompatible avec son fichier n'écrit aucun fichier et indique pourquoi (voir [`password`](/info/url-parameters.html)).

**Un lien de partage protégé par mot de passe** demande un mot de passe au destinataire avant de s'ouvrir. L'état du lien est chiffré avec AES-256 sous une clé dérivée du mot de passe (PBKDF2). Seul le texte chiffré voyage, et le déchiffrement a lieu dans le navigateur du destinataire. Le serveur qui sert le lien ne voit jamais le mot de passe ni le design. Active-le dans la boîte de dialogue **Share**. Un lien chiffré ne s'ouvre que dans Lolly, jamais comme image incorporée. Voir [Mode URL](/info/url-mode.html).

<!--i:eti-monitor-->
## Sur un téléphone

Les contrôles d'export se trouvent derrière le bouton flottant **Export**, qui ouvre le panneau **Export** : les mêmes formats, taille, copie, téléchargement et partage, adaptés au tactile.

<!--i:eti-code-->
## Identifiants de format pour les liens et la CLI

Voici les valeurs du paramètre d'URL `format=` et de l'option CLI `--export=` (voir [Paramètres d'URL](/info/url-parameters.html) et [CLI](/info/cli.html)). Le menu d'un outil n'affiche que les formats que cet outil peut produire.

| Type | Identifiants |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vectoriel | `svg` · `svgz` (SVG compressé avec gzip) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (fichier de découpe) |
| Page et document | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (fichier de design Penpot) · `scorm` (paquet de cours, un ZIP) |
| Animation | `gif` · `apng` (PNG animé) · `webp-anim` (WebP animé) · `svg-anim` (SVG animé) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + médias) |
| Audio | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` · `mid` (notes MIDI, depuis Lolly Rondocode) |
| Texte et données | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `ttml` · `scc` · `css` · `scss` · `gpl` (palette GIMP) |
| Archives et paquets | `zip` · `rpm` et `tar.gz` (le rendu scellé dans un paquet Linux) |

Quelques identifiants proviennent du code d'export propre à un outil : `ase` (Adobe Swatch Exchange, depuis Lolly Palette Lab), ainsi que `exr` et `hdr` (images raster à grande plage dynamique, depuis Lolly Darkroom). **Convert Font** écrit `ttf`, `otf` et `woff` à partir d'un fichier de police que tu fournis, donc un lien seul ne donne rien à rendre à l'outil.
