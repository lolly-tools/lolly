# Exportă un fișier

Ai făcut ceva și trebuie să părăsească Lolly: un PNG pentru un chat, un PDF pentru tipograf, un deck pe care un coleg îl va edita în continuare. Apasă **Export**, jumătatea stângă a pastilei **Export | Save**. Alege un format lângă numele fișierului, apoi apasă **Download**. Fișierul este făcut pe dispozitivul tău.

Ce vezi pe canvas este ce conține fișierul. Meniul de format listează doar ce poate face acest instrument în acest browser.

Pentru cele mai multe sarcini, unul din trei formate este potrivit:

| Pentru | Alege | Pentru că |
|---|---|---|
| Un ecran, un mesaj sau un slide | **PNG** | Orice aplicație îl deschide, și păstrează un fundal transparent atunci când instrumentul oferă unul |
| O pagină finalizată, sau orice se tipărește | **PDF** | O dimensiune reală de pagină care se tipărește așa cum arată; **Print PDF**, unde un instrument îl oferă, este versiunea CMYK pentru o tipografie |
| Grafică ce trebuie să rămână clară la orice dimensiune | **SVG** | Forme vectoriale, clare de la un ecuson la un banner |

::: check Verifică fișierul la dimensiunea la care va fi folosit
Înainte să-l trimiți, deschide-l pe ecranul pentru care a fost făcut, sau tipărește-l la dimensiunea lui reală.
:::

::: details Aprobări și livrare cu Lolly Work (opțional)
O [organizație care rulează Lolly Work](/info/organisation.html) poate guverna ce formate și setări de export văd membrii ei. Unde aprobarea este necesară, **Request approval** ține locul lui **Download**. Urmează politica pe care o arată instanța ta.

Lolly Work poate livra un fișier și către destinații S3, WebDAV și HTTP configurate, cu pași de aprobare, confirmări de livrare și o înregistrare de audit. Trimiterea unui fișier pentru acel flux îl trimite la serviciul organizației; o descărcare obișnuită rămâne pe dispozitivul tău. Destinațiile personale Send și livrarea organizației sunt configurate separat.

Operatorii configurează asta cu [ghidul de livrare al organizației](/info/work-delivery.html). Pentru randări și loturi pe server puse la coadă, vezi [CLI batch și automatizare](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

## Cum funcționează exportul

Când exporți, canvasul instrumentului este randat în formatul ales și îți este dat ca descărcare sau pus în clipboard.

Trei căi produc un fișier. Cele mai multe instrumente **randează canvasul**. Formatele de text și de date (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) sunt **generate din conținutul instrumentului**, nu desenate din imagine. Utilitarele de confidențialitate precum *Strip Hidden Data* **transformă fișierul ales de tine**, pe dispozitivul tău, și îl dau înapoi fără canvas, filigran sau metadate adăugate, pentru că este deja fișierul tău.

![Trei căi de export converg într-un fișier terminat: randează canvasul, generează text sau date din conținut sau transformă un fișier ales, pe dispozitiv.](/info/diagrams/concepts/three-export-paths.svg)

Panoul de export oferă aceste acțiuni. Autorul unui instrument alege care apar; setul implicit este Copy, Download și Save.

- <!--i:download--> **Download** salvează fișierul. Dacă nu îl găsești după aceea, vezi [Găsește un fișier descărcat](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> **Copy** pune imaginea în clipboard, gata de lipit într-un chat, un email sau un document. Unde un browser nu poate copia imagini, descarcă în schimb și îți spune.
- <!--i:folder--> **Save** păstrează designul curent în Projects dintr-un clic și nu descarcă niciodată un fișier. **Save as**, lângă **Download**, întreabă unde (vezi [Salvare și continuare](/info/using.html#saving-continuing)).
- <!--i:link--> **Share** deschide dialogul Share: un link care reproduce designul, comutatoarele la vizită (ecran complet, panou de export, descărcare sau copiere la deschidere) și un **Shortest link** opțional care împachetează întreaga stare într-un token compact (vezi [Modul URL](/info/url-mode.html)).

![The export panel - format, size and the Copy / Download / Save / Share actions](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Când un design încorporează randarea altui instrument, precum o casetă de imagine Design care conține un link QR Code, randarea imbricată este desenată în exportul părintelui. Rămâne vector adevărat în SVG și PDF și se rasterizează curat în PNG, JPG și WebP. Randarea încorporată nu primește filigran sau proveniență proprie; doar fișierul terminat. Exporturile HTML, Markdown și TXT nu pot conține o randare compusă.

## Alege un format

Numele fișierului și meniul de format stau împreună ca o singură pereche `name.format`, sub **Descarcă**.

![The filename field fused to the format picker, so the export reads as one name.format pair](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Pornește de la locul unde merge fișierul. Fiecare card listează formatele potrivite acelei destinații; un instrument arată doar pe cele pe care le poate face.

::: figure exporting-format-chooser
Șase destinații și formatele potrivite fiecăreia.
:::

Un wordmark setat în fontul sistemului tău de design se exportă ca SVG cu fiecare literă ca cale conturată, deci un singur fișier rămâne clar la dimensiune de carte de vizită și la dimensiune de acoperire a unei clădiri.

![Un wordmark fin, cu spațiere largă, scriind Aurora, genul de artă vectorială pură despre care este rândul SVG din tabel](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Fiecare format și pentru ce este
| Vrei | Folosește | De ce |
|---|---|---|
| Logouri sau artă clară care se scalează | **SVG** | Vector: scalabil, mic și editabil; un efect pe care exportul vectorial nu îl poate desena este încorporat ca imagine |
| Vector pentru Office și aplicații Windows | **EMF** | Se lipește ca vector editabil în PowerPoint și Word, cu text viu; Google Drive îl deschide în Google Drawings |
| Vector pentru tipar și aplicații de design | **EPS** sau **EPS (CMYK)** | Vector PostScript pentru Illustrator și fluxuri de presă |
| Vector pentru mașini de tăiat | **DXF** | Tăietoare laser, plottere de vinil și CNC: căi de contur în milimetri |
| Un deck de diapozitive editabil | **PowerPoint** (PPTX) | Text și forme native editabile, cu imagini și vectori păstrați extractibili |
| Un document text editabil | **Word** (DOCX) sau **OpenDocument** (ODT) | Paragrafe și titluri reale pe care un procesor de text le poate edita în continuare (Doc Studio) |
| Un layout pentru InDesign | **InDesign IDML (static subset)** | Text, dreptunghiuri, elipse și imagini, un spread pe planșă (Design) |
| Un document Penpot editabil | **Penpot** | Boards, forme, text și tokenuri legate |
| O fotografie sau o imagine de uz general | **PNG** (fără pierderi) sau **JPG** (mai mic) | Raster universal |
| Imagini moderne mai mici | **WebP** sau **AVIF** | Compresie mai bună, cu transparență |
| Tipar | **PDF** sau **Print PDF** (CMYK) | Dimensiune reală de pagină; CMYK pentru presă |
| Raster de tipar pentru presă | **Print TIFF** (CMYK) | Pixeli DeviceCMYK pentru un RIP |
| Animat pentru web | **GIF** | Rulează peste tot; fișiere mai mari |
| Animat cu culoare completă și transparență reală | **APNG** | PNG animat: fără limită de paletă |
| Animat, cel mai mic fișier | **Animated WebP** | Culoare completă și transparență, mai mic decât GIF sau APNG |
| Vector animat care se scalează | **Animated SVG** | De sine stătător; rulează în buclă într-un browser sau un `<img>`, la orice dimensiune (Lottie Ad) |
| O animație care rămâne editabilă | **dotLottie** | Forme, căi și chei de transformare exterioare din cronologia Design |
| Un transfer către Premiere | **Premiere XML + media** | Clipuri cronometrate și media originale pentru Premiere (Design) |
| Video pentru social și partajare | **MP4** sau **WebM** | Cea mai bună calitate pentru dimensiunea fișierului (vezi [Video](#video)) |
| Subtitrări | **SRT** sau **VTT** | Text cronometrat pentru un player video (Captions, Audiogram și Record) |
| Un curs de instruire | **SCORM (LMS)** | Un site versionat, pachet SCORM sau xAPI (vezi [SCORM](#scorm-course-packages)) |
| Text îmbogățit sau o semnătură de email | **HTML** | Se lipește formatat în clienți de email |
| Conținut simplu | **MD** sau **TXT** | Doar text |
| Un eveniment de calendar | **ICS** | Se importă în orice aplicație de calendar |
| O carte de contact | **VCF** | Se importă în agende |
| Date structurate de reimportat | **JSON** sau **CSV** | Reîntoarce conținutul instrumentului |
| Un favicon | **ICO** | Pictogramă de site cu mai multe dimensiuni; **ZIP** grupează mai multe formate |
:::

### Transparență

Instrumentele care o acceptă oferă un comutator pentru fundal transparent, precum **No BG**. PNG, WebP, AVIF, SVG, APNG și Animated WebP păstrează transparența, iar GIF păstrează o margine dură. JPG și PDF sunt mereu opace. TIFF se aplatizează pe alb sau pe negru pe calea HDR descrisă la [HDR](#hdr-bright-colours).

## Dimensiune și unități de tipar

Exporturile folosesc dimensiunea nativă în pixeli a instrumentului, dacă instrumentul nu oferă **dimensions**. Atunci setezi lățimea, înălțimea și o **unit**:

- **px** (implicit) înseamnă pixeli exacți.
- **mm, cm, in, pt** și **pc** sunt dimensiuni fizice. Cu o unitate fizică setezi și **DPI** (300 implicit). Un **PDF** devine o pagină reală la acea dimensiune, un **raster** primește numărul de pixeli pentru acel DPI și înregistrează rezoluția, iar un **SVG** păstrează unitatea fizică cu un viewBox în pixeli.

Pentru un raster cu rezoluție mai mare, introdu o lățime și o înălțime mai mari sau alege o unitate fizică și crește DPI (pixeli = dimensiune × DPI). Lățime `210`, înălțime `297` și unitate `mm` fac o pagină A4.

![The dimensions row set to 210 by 297 mm, with the DPI field revealed because the unit is physical](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Cadre statice dintr-o compoziție cronometrată

O compoziție cronometrată, precum o cronologie [Sequence](/info/sequence-editor.html) în Design, se mișcă, deci un export static trebuie să aleagă un moment: **cadrul de la capul de redare**. Pune capul de redare unde vrei imaginea și exportă.

Pentru mai mult de un moment, câmpul **Frames** apare lângă dimensiunea de ieșire. Se arată doar pentru o compoziție cronometrată și un format static (PNG, JPG, WebP, SVG sau PDF). Lasă-l la `1` pentru cadrul de la capul de redare. Crește-l și primești tot atâtea imagini statice, distribuite uniform pe toată secvența:

- PNG, JPG, WebP și SVG revin ca un singur ZIP: `<name>-01.png`, `-02.png` și așa mai departe.
- PDF revine ca un singur document cu atâtea pagini.

Fiecare imagine statică vine din mijlocul feliei ei din cronologie, deci primul cadru nu este niciodată o intrare pe jumătate estompată, iar ultimul nu este niciodată momentul gol de după ce s-au terminat toate clipurile.

::: figure exporting-contact-sheet
Frames: 4 taie secvența în patru felii egale și ia mijlocul fiecăreia.
:::

Folosește-l pentru un storyboard, o planșă de contact pentru revizuire sau un carusel social tăiat dintr-o montare video. Numărul este plafonat la 64, iar orice altceva tastat în câmp revine la `1`. Fiecare cadru este o imagine statică obișnuită, deci credențialele, Imprint, unitățile fizice și DPI se comportă ca la un singur export. Un link de export, CLI și MCP cer aceeași planșă cu `cuts=` (vezi [Planșe de contact](/info/url-export.html#contact-sheets)).

## Multe fișiere deodată

Lolly are trei moduri de a lucra în volum, fiecare pentru altă sarcină:

::: cols
## Un tabel devine un document
Un instrument cu o intrare de tip tabel, precum **Battlecards**, transformă fiecare rând într-o pagină. Lipește un tabel din foaia ta de calcul și primești un PDF. Corectează rânduri în foaia de calcul și lipește din nou.
## Un CSV devine un fișier pe rând
**Batch** (`#/batch`) ia un CSV și randează un export pentru fiecare rând: ecusoane sau certificate, câte un fișier, livrate într-un ZIP. Vezi [Batch](/info/batch.html#make-many-versions-of-one-design).
## Mai multe designuri primesc o editare
**Multi-edit** deschide mai multe sesiuni salvate unul lângă altul pentru același retuș pe designuri diferite. Vezi [Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Din **Projects**, **Render folder** exportă fiecare sesiune salvată dintr-un dosar și din subdosarele lui ca un singur ZIP imbricat, iar **Render selection** face același lucru pentru orice selecție multiplă; o sesiune salvată se randează în propriul fișier. O sesiune salvată poate fi partajată din nou ca link de instrument din Projects, care o redeschide cu aceleași setări.

## Fișiere care rămân editabile în altă parte

Unele formate predau munca ta altei aplicații ca conținut editabil, nu ca imagine.

### PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart, Diagrams, Flow Chart și Agenda exportă un deck PowerPoint, un diapozitiv pe pagină. Fiecare pagină este descompusă în obiecte native, deci un coleg poate edita deck-ul și scoate resurse din el:

- <!--i:font--> **Textul** devine casete de text PowerPoint editabile, cu dimensiunea fontului, culoarea, greutatea, italicul și alinierea layoutului.
- <!--i:pentool--> **Vectorii**, precum logourile și pictogramele, sunt încorporați ca imagini SVG; rămân clari, iar PowerPoint le poate aplica *Convert to Shape*.
- <!--i:photos--> **Imaginile** vin la rezoluție nativă ca imagini proprii. O imagine principală decupată păstrează imaginea întreagă în spatele decupajului, iar orice filtru sau amestec pe ea este copt.
- <!--i:layers--> **Fundalurile, marginile și liniile** devin forme dreptunghi și linie.

![Panoul de export cu PowerPoint selectat: un diapozitiv per pagină, text și forme păstrate editabile](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Layoutul este aproximativ; scopul este conținut reutilizabil. Tot ce walker-ul nu poate exprima nativ, precum o regiune complexă filtrată sau mascată, este încorporat ca imagine, ca să nu se piardă nimic. Un deck are o singură dimensiune de diapozitiv, luată de la prima pagină.

PowerPoint este și o cale de intrare: [Rebrand a deck](/info/rebrand.html) mută un deck pe sistemul tău de design, iar [Importă un design](/info/design-import.html) deschide unul în Design.

### Penpot

Cele mai multe instrumente care exportă SVG exportă și un **fișier Penpot** (`.penpot`), gata de editat în continuare în Penpot.

| Ce ai făcut | În Penpot |
|---|---|
| Text | Obiecte text editabile: corectezi o greșeală sau restilizezi |
| Forme, căi, gradienți și imagini | Propriile forme vectoriale editabile |
| O culoare sau un font dintr-un token de sistem de design | Un link viu de token: editează tokenul și fiecare formă care îl moștenește îl urmează |
| Întregul design | O componentă reutilizabilă în panoul Assets |
| O ilustrație complexă sau un canvas viu | Încorporat singur ca imagine, cu conținutul editabil din jur neatins |

Din Design, fiecare cadru devine o placă Penpot. Culorile și tipografiile sistemului de design ajung în panoul Assets, iar setul lui complet de tokenuri în panoul Tokens. De acolo Penpot își păstrează propria copie: un token editat în Penpot revine prin importul din [Design System Setup](/info/brand-studio.html).

![Panoul de export cu Penpot selectat: fișierul .penpot, și Send to Penpot lângă butonul de descărcare](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Ca să deschizi fișierul, pornește Penpot, alege un proiect și alege **Import**. Autentificat în Penpot din panoul de export, **Send to Penpot** face acest pas pentru tine.

### Word, OpenDocument și InDesign

**Doc Studio** exportă **Word** (DOCX) și **OpenDocument** (ODT) cu paragrafe și titluri reale.

**Design** exportă **InDesign IDML (static subset)**: text, dreptunghiuri, elipse și imagini PNG sau JPEG, un spread pe planșă. Formatarea inline acceptată rămâne editabilă, imaginile călătoresc în `Links`, iar coordonatele devin puncte InDesign. Relegarea, înlocuirea fonturilor și împachetarea schimbată pot necesita atenție. Efectele, animația, poveștile compuse și geometria neacceptată opresc exportul cu un raport care le listează. IDML nu păstrează documentul original, deci trimite PDF pentru arta finală.

### Cronologii: dotLottie și Premiere

Din cronologia Design, **dotLottie** scrie o animație care rămâne editabilă în instrumente Lottie; [Animații Lottie](/info/sequence-editor.html#lottie-animations) listează ce păstrează. **Premiere XML + media** împachetează clipurile cronometrate și media lor originală pentru Premiere; vezi [Schimb Premiere XML](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (pachete de curs)

Exportul de curs este oprit până activezi **Training and courses** în Settings → Preferences → Feature flags.

Apoi alege **Export course** dintr-un instrument acceptat, un dosar de proiect sau o selecție. În Design, alegerea **SCORM (LMS)** și **Download** deschide același flux de curs. Lolly salvează munca, îți permite să revizuiești conținutul și ordinea cursului, apoi deschide modulul și dialogul lui de export.

- <!--i:layers--> Alege o redare pentru fiecare sursă: pagini statice, mișcare ca video, audio sau o resursă descărcabilă. Adaugă text de lecție și alternative de citire în modul.
- <!--i:clock--> Previzualizează playerul cursantului și revizuiește descrierile și subtitrările. Mișcarea este inclusă ca video, inclusiv animația silențioasă.
- <!--i:document--> Alege Website, SCORM 1.2, SCORM 2004 4th Edition sau o țintă xAPI experimentală. Verifică conținutul și dimensiunea ZIP, apoi salvează și descarcă versiunea verificată.
- <!--i:check--> Finalizarea cere confirmarea fiecărei lecții obligatorii și alegerea Finish.

![Panoul de export pe un set de diapozitive Design cu SCORM (LMS) selectat](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Pachetul conține conținutul lui terminat și nu are nevoie de cont Lolly. Pune un ZIP Website pe o gazdă HTTP(S); importă un ZIP LMS neschimbat. Testează destinația înainte să partajezi cursul. Pentru un curs construit din mai multe creații salvate, vezi [Creează un curs de instruire](/info/training-creators.html).

### DXF (fișiere de tăiere)

Asset Export, Diagrams, Growth, Logo Wall, QR Code, Street Map, Wayfinding și Wordmark exportă **DXF**, formatul de schimb AutoCAD R12 pe care îl citesc tăietoarele laser, plotterele de vinil și software-ul CNC. Geometria este scrisă ca căi de contur în milimetri, textul este conturat, iar culoarea se mapează pe cea mai apropiată culoare din AutoCAD Color Index, care de obicei conduce operațiunea tăietorului. DXF este doar artă liniară: o regiune fotografică sau filtrată nu are cale de tăiere și este omisă, cu un avertisment. Folosește SVG sau PDF ca să păstrezi conținutul raster.

Street Map este cazul cel mai clar. Tot designul este deja contururi, deci fiecare drum și canal devine o cale de tăiere.

::: showcase
![Un render Street Map al Parisului în cerneală pe crem - artă pur lineară, așa că fiecare traseu supraviețuiește drumului până la un plotter de tăiere](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Derulează, iar camera se retrage prin geometria efectivă: șapte căi, fără niciun pixel nicăieri, fiecare traseu clar ca un fir de păr la orice zoom. Acesta e exact fișierul citit de un plotter de tăiere.
:::

## Tipar

**Print PDF** scrie CMYK față de o condiție de presă numită, implicit **Coated FOGRA39**. Mostrele de brand cu valori de cerneală măsurate se convertesc exact; celelalte culori folosesc o conversie standard de dispozitiv. **Print TIFF** scrie pixeli DeviceCMYK pentru un RIP și înregistrează aceeași condiție de presă în metadatele TIFF. Controlul Colour profile le conduce pe amândouă; [Profiluri de culoare](#colour-profiles) are detaliile.

**Print marks & bleed** are propriul card pe formatele de tipar: bleed-ul în milimetri plus detaliile Crop, Registration, Bleed, Colour bars și Stamp.

Unele instrumente construiesc un **PDF cu mai multe pagini**: o copertă, conținut care curge pe câte pagini are nevoie și o ultimă pagină, ca în instrumentul *Booklet*. Fiecare pagină este o pagină PDF portret reală în A4, US Letter sau A5, și poți forța orice bloc pe o pagină nouă. Acestea sunt documente RGB fără semne de tăiere sau bleed, care aparțin Print PDF cu o singură pagină. Un PDF Design poate fi și un **Notes handout**: o pagină portret pentru fiecare diapozitiv, cu notele vorbitorului dedesubt.

**Înainte să exporți.** Un card **Before you export** la baza panoului spune ce urmează să vadă o tipografie: format, dimensiune și bleed, zonele de tăiere și bleed, acoperirea cu cerneală, numărul de plăci și numărul de pagini, cu un verdict lângă titlu. Nu blochează niciodată un export. Design arată mereu cardul cu propriile verificări, inclusiv regulile de casă ale sistemului de design strat cu strat și semnalul de scriere pentru textul documentului ([Înainte să exporți](/info/design.html#before-you-export)), și adaugă aceste verificări de tipar când **Print preflight** este activ. În alte instrumente, activează **Print preflight** în Settings → Preferences → Feature flags; este oprit implicit, iar o instalare Lolly Work îl poate activa pentru membrii ei.

**După export.** Odată ce fișierul e gata, Lolly îl citește înapoi și îl compară cu ce ai ales: format, dimensiune în pixeli sau pagină, lungimea clipului, fundal transparent, culoare CMYK, HDR, Content Credentials și o parolă de PDF sau ZIP. Tot ce diferă este scris pe cardul de export. Fiecare măsurătoare vine din fișier, niciodată din setare, iar o proprietate la care fișierul nu poate răspunde nu este numărată ca potrivire. Linia de comandă scrie comparația completă cu `--export-report` (vezi [Randează cu CLI](/info/cli-rendering.html)).

Verificările inspectorului Design și compararea brandului din Design System Setup sunt verificări separate: ele se uită la design, în timp ce aceste două carduri se uită la fișier.

::: details Cost dintr-un rate card
Sub preflight, un card de cost transformă aceleași numere în bani, folosind doar prețuri furnizate de cineva. Citește acele numere chiar și când cardul preflight este oprit. Are nevoie de două lucruri: un job pe care o listă de prețuri îl poate evalua (plăci, coli, arie, pagini, rânduri de variante sau fișiere de ieșire, deci un simplu PNG de logo nu îl arată niciodată) și un **rate card**, o listă de prețuri JSON de la tipograful tău. O versiune implicită nu are niciunul și nu are o cale în aplicație de a încărca unul. Un rate card sosește ca resursă de catalog livrată de o instalare sau prin extensia opțională de rate card pe care o activează cine găzduiește singur sau un plan de control. Fără rate card, nu se arată nimic.

Fiecare cifră este un tarif furnizat de tine înmulțit cu o cantitate numărată de Lolly, precum `4 plate × €35.00`, iar totalul își poartă sursa: emitentul de pe card și data tarifelor. Nu există monedă implicită și nici preț de umplutură. Ce spune fișierul despre sine rămâne vorbire raportată: *„The file says: … Lolly has not verified this.”*

Când o cifră nu poate fi calculată, tabelul este retras, nu completat:

- Liniile pe care cardul nu le evaluează înseamnă **niciun total deloc**, doar un titlu care spune câte sunt neevaluate.
- O cantitate care este un plafon poartă **„up to”** în subtotalul ei.
- Tarifele trecute de data valid-until arată **doar numărători** până apeși *Use these rates anyway*; data expirării merge apoi cu cifra.
- Deschis printr-un **link**, banii rămân ascunși până îi ceri pe acest dispozitiv. CLI ia `--rate-card=<file.json>` ca fișier local și niciodată ca parametru de link.

Cardul este eliminat din fiecare etapă de export, deci nu schimbă niciodată fișierul. Este aritmetică, nu o ofertă; doar tipograful tău poate face o ofertă.
:::

## Mișcare și sunet

### Video

Instrumentele animate exportă **MP4** și **WebM**. Selectorul arată doar containerele pe care le poate face acest browser, iar un link `?format=` partajat care cere unul pe care nu îl poate face revine la celălalt, cu un nume de fișier potrivit. Instrumentele animate oferă și **Start after**, care ține canvasul nemișcat o clipă ca animațiile și fonturile să se stabilizeze înainte de înregistrare, și **Duration**, lungimea clipului terminat. **Motion blur** (Off, Draft quality, Standard sau High, cu un **Shutter angle**) estompează mișcarea rapidă cu prețul timpului de randare. Unde browserul o acceptă, **Record live** înregistrează în timp real previzualizarea de pe ecran printr-o partajare de ecran.

![Setările de timing pentru un export animat: Start after, Duration, Motion blur cu Shutter angle și Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** alege Smaller file, Balanced sau Best quality. **Advanced** deschide **Codec**, **Frame rate**, **Rate mode** și **Hardware acceleration**. Unde un instrument are subtitrări, **Captions** alege un **Embedded track** sau un **Sidecar .vtt + .srt** lângă video. Un link poartă calitatea, codecul, frame rate-ul, durata și întârzierea de start ca `vq`, `codec`, `fps`, `seconds` și `wait` ([Parametrii URL](/info/url-parameters.html)).

Exporturile video își păstrează sunetul. Un instrument poate pune un **music bed** sub clip: o resursă audio repetată sau tăiată la lungimea clipului, cu fade-uri, volum și ducking sub sunetul propriu al imaginilor. Instrumentele de înregistrare duc audio live în fișier.

Un deck Design care rămâne un deck cu clic poate totuși pleca ca video. **Export slides as video** din meniul Present deschide foaia de export pe MP4. Fiecare diapozitiv rulează cât durata lui sau cât Duration din foaia de export când nu are una, iar tranziția de diapozitiv a deck-ului rulează între ele ca un dissolve. Documentul în sine nu se schimbă.

### Imagini animate

**GIF** rulează peste tot și se potrivește pentru chat și email; este mai mare și are mai puține culori decât video. **APNG** și **Animated WebP** păstrează culoarea completă și transparența. **Lottie Ad** exportă și **Animated SVG**: cadre vectoriale cu keyframe-uri CSS încorporate, deci se scalează la orice dimensiune și rulează în buclă într-o filă de browser sau un `<img>` fără codec. Textul lui este conturat și folosește un frame rate implicit mai mic pentru că fiecare cadru este mai greu decât un bitmap. Toate acestea sunt silențioase.

### Audio

Unele instrumente exportă sunet de sine stătător. **Voice Recorder** captează o preluare de microfon cu un indicator de nivel live și o salvează ca **MP3**, **WAV**, **M4A (AAC)** sau **Opus (WebM)**, codificată pe dispozitivul tău. `wav`, `mp3`, `m4a` și `opus` sunt id-uri de format obișnuite, deci un export audio este la fel de partajabil și programabil ca un PNG.

Selectorul de resurse acceptă o gamă largă de audio pentru un music bed, de la MP3 și FLAC la MIDI și module tracker; [Formate](/info/formats.html) le listează. O [melodie Rondocode](/info/rondocode.html) rulează cât lungime cere clipul ei.

## Culoare și HDR

Lolly citește orice culoare CSS modernă, își face matematica culorii perceptual și scrie fiecare fișier într-un spațiu pe care un cititor îl poate deschide: sRGB pentru ecrane, CMYK pentru tipar și Rec.2100 PQ pentru HDR. [Culoarea în motor](/info/colour-engine.html) explică cum. Un document Design setat pe **Wide colour / HDR** urmează propriile reguli, descrise în [Editare cu culoare largă și HDR](/info/hdr-editing.html).

### Profiluri de culoare

Exporturile sunt etichetate cu un profil de culoare, deci aplicațiile cu gestionare a culorii, precum tipografiile, Photoshop și browserele, citesc culorile așa cum le-ai văzut. Se întâmplă automat; miniaturile și previzualizările omit eticheta ca să rămână mici.

- **PNG și JPG** poartă un profil ICC **sRGB** încorporat, spațiul în care este desenată previzualizarea. Pixelii sunt etichetați, nu recodificați.
- **Print PDF (CMYK)** își declară condiția de presă în *OutputIntent*, spunând unei tipografii cum trebuie citite cernelurile CMYK.
- **Print TIFF (CMYK)** scrie pixeli DeviceCMYK fără etichetă și înregistrează condiția de presă în metadatele TIFF. Un TIFF nu poate încorpora un profil de presă, deci un rând **Embed** înregistrează doar numele acelui profil.
- **TIFF (RGB)** este fratele sRGB necomprimat pentru arhivă sau un dus-întors cu un editor. Aplatizează transparența pe alb. Ambele TIFF sunt doar pentru desktop, pentru că browserele nu pot previzualiza un TIFF.
- **SVG**, **EMF**, **EPS** și **DXF** sunt vectori fără profil încorporat: culorile SVG sunt sRGB, EMF și EPS folosesc RGB de dispozitiv, **EPS (CMYK)** scrie DeviceCMYK, iar DXF folosește AutoCAD Color Index. SVG, EPS și DXF conturează textul în căi. EMF păstrează textul viu și editabil în Office și Google Slides, revenind la contururi doar pentru secvențele pe care formatul nu le poate exprima; opțiunea **Outline fonts** a panoului de export forțează căi peste tot. SVG reproduce și umbrele CSS ale casetelor, în interior și în exterior.

::: details PDF/X-4 și propriul profil de presă
Lolly nu livrează niciun profil CMYK. O condiție de presă numită scrie output intent fără să pretindă conformitate PDF/X-4, pentru că PDF/X-4 vrea profilul încorporat.

Încarcă un profil CMYK propriu și alege rândul lui **Embed** în controlul Colour profile. Este încorporat ca *DestOutputProfile* al fișierului, iar PDF-ul pretinde PDF/X-4 oricând restul fișierului permite. Condiția de presă pe care o declară este citită din acel profil: un nume înregistrat unde profilul dovedește unul sau `Custom` sub numele propriu al profilului.

Trei lucruri rețin pretenția păstrând output intent: arta RGB pe care trecerea CMYK nu a putut-o converti, textul de credit al marginii de probă `prov` (desenat într-un font standard care nu este încorporat) și o parolă **Strong**, deoarece PDF/X-4 interzice criptarea. Fiecare PDF poartă și metadate PDF/X-4: casete de pagină, XMP, un ID de document și un output intent sRGB cu profilul lui.
:::

### HDR (culori strălucitoare)

Aceasta este cardul **HDR** al panoului de export, care luminează arta obișnuită pentru ecrane HDR. Păstrarea originalelor HDR în timpul editării este o altă funcție: [Editare cu culoare largă și HDR](/info/hdr-editing.html).

Un export obișnuit este sRGB: o culoare de brand saturată este la fel de strălucitoare ca albul normal al ecranului. Un ecran HDR are marjă deasupra. Cardul **HDR** amplifică culorile brandului și textul alb spre strălucirea de vârf, în timp ce zonele închise rămân închise și dau strălucirii contrastul.

![Cardul HDR din panoul de export, activat, cu discurile White / Reach / Dark lift / Focus dezvăluite sub el](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formate.** PNG, JPG, AVIF și TIFF. WebP este pe 8 biți fără cale de decodare HDR funcțională, iar vectorii și PDF nu au model HDR.
- **Oprit implicit**, pentru că schimbă pixelii. Bifează cardul sau trece `hdr=1` într-un link de partajare.
- **Cadranele.** **White** (plafonul strălucirii de vârf, 400 până la 2000 nits), **Reach** (cât de departe în tonuri se răspândește strălucirea), **Dark lift** (cât se luminează zonele închise; `0` le ține închise) și **Focus** (câtă bogăție de culoare păstrează amplificarea). Călătoresc ca o singură valoare: `hdr=1600-60-0-50` este White 1600, Reach 60, Dark lift 0 și Focus 50.
- **Ce se scrie.** PNG primește Rec.2100 PQ pe 16 biți cu un chunk `cICP`. JPG este un JPG gain-map ISO 21496-1: o imagine SDR obișnuită plus un gain map atașat. AVIF primește o casetă `colr` rescrisă. TIFF primește pixeli PQ cu un profil ICC v4 generat care poartă o etichetă `cicp` și se aplatizează pe negru, pentru că albul este codul de 10.000 de nits în PQ și ar încercui fiecare margine cu un halou. Amplificarea urmează luminozitatea perceptuală (OKLab) și păstrează nuanța, deci un verde de brand devine mai strălucitor, nu mentolat.
- **Unde se vede strălucirea.** Vizualizatoare cu gestionare a culorii pe un ecran HDR: Preview, Quick Look și Safari pe dispozitive Apple sau Chrome pe un monitor HDR. Un ecran SDR arată o imagine normală.
- **Înainte să livrezi.** Multe platforme recodifică încărcările și elimină semnalul HDR, ceea ce poate lăsa imaginea închisă sau spălăcită. Folosește HDR unde controlezi destinația, precum propriul site, un perete video sau un deck pe un panou luminos.
- **Din terminal.** `--hdr=1` cu `--export=png` sau `--export=jpg` scrie același PNG și JPG gain-map în [CLI](/info/cli.html), cu aceleași codificatoare ale motorului, fără browser pe traseu. AVIF și TIFF rămân deocamdată exporturi web.

## Ce călătorește cu fișierul tău

Un fișier terminat poate purta mai multe înregistrări pe lângă imagine. Unele merg lângă pixeli și dispar când fișierul este salvat din nou sau curățat; două mărci trăiesc în pixeli.

::: figure exporting-what-travels
Unde trăiește fiecare înregistrare, dacă este activă implicit și ce parametru de link o controlează.
:::

Panoul de export pliază **Licence**, **Source credits**, *Password protect*, **C2PA Credentials**, **Lolly Imprint** și **Durable credential** într-un grup **Content protection** care arată doar cardurile pe care le poate folosi formatul ales. Se deschide singur când un link sau un document declară deja o licență sau când o sursă necesită o decizie din partea ta. Cardul **Design system** rămâne în afara grupului, vizibil la fiecare export.

![Grupul Content protection deschis la un export PNG, arătând doar cardurile care i se aplică](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Proveniență și filigran

Unde formatul are câmpurile, exporturile poartă **metadate de proveniență**: software-ul, sursa, numele instrumentului și linia ta de credit din profil, scrise în PNG iTXt, JPEG EXIF, PDF info, SVG `<metadata>` sau un comentariu GIF. Înregistrează doar autoratul și nimic nu este încărcat. Instrumentele **Experimental** ștampilează și un filigran vizibil, aplicat de gazdă, deci editarea instrumentului nu poate elimina marca.

**Lolly Imprint** este un filigran invizibil în pixeli, **activ implicit**. Credențiala și metadatele călătoresc lângă pixeli și se pierd la o salvare nouă, o captură de ecran sau o curățare de metadate. Imprint trăiește în pixeli și supraviețuiește recomprimării, deci o copie poate fi totuși recunoscută ca făcută cu Lolly. Este un indiciu, nu o garanție criptografică, și nu poartă date personale. Merge în JPEG XL, PNG, JPG, WebP, AVIF, TIFF și BMP și în rasterele pe care Lolly le randează într-un PDF sau PPTX, niciodată într-o imagine pe care ai încorporat-o. Debifează **Lolly Imprint** sau trece `imprint=0` ca să omiți Imprint. Supraviețuirea AVIF prin recodificare nu este încă calibrată. [Verify](/verify) îl detectează pe dispozitivul tău; vezi [Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**Durable credential** scrie id-ul Lolly în pixeli cu un model neural pe dispozitiv în format TrustMark, deci linkul „made with Lolly” supraviețuiește unei curățări de metadate și unei recodificări și poate fi citit de instrumente care cunosc TrustMark. Este **oprit implicit**, pentru că costă o trecere neurală pe export și o descărcare unică a modelului. Acoperă PNG, JPG, WebP, AVIF și TIFF; bifează-l în panou sau trece `durable=1`. Aplicațiile desktop și mobile ascund cardul, pentru că nu au o origine de la care să preia modelul offline.

**Licence.** Alege cum pot folosi alții munca ta: implicit *None (all rights reserved)*, CC0 1.0, Public Domain Mark 1.0 sau o licență Creative Commons 4.0 (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). Numele licenței și un link către actul ei merg în metadatele de licență ale fișierului (EXIF, XMP și RIFF unde formatul le are) și în Content Credential. Alegerea este salvată cu documentul și călătorește într-un link ca `licence=`. Lolly scrie licența aleasă de tine; nu verifică și nu impune termenii. Un instrument cu propriul câmp de licență, precum Claim, păstrează în schimb acel câmp.

### Înregistrarea sistemului de design

Un export înregistrează sistemul de design care a făcut fișierul: numele lui, versiunea publicată din care a fost desenat (când nu este versiunea de lucru) și [colourway-ul](/info/colourways.html) în care a fost desenat. Orice altă alegere de temă declarată de un sistem de design, precum o densitate, este înregistrată la fel. Alegerea deschis sau închis este omisă, pentru că imaginea arată deja care a fost folosită.

**Vezi înregistrarea înainte să se scrie ceva.** Cardul **Design system**, bifat implicit, arată cuvintele exacte pe care le va purta fișierul, precum *Records: Acme · Colourway: Beach*, și descrierea așa cum se va citi. Numele unui sistem de design este ce au tastat proprietarii lui, deci cardul îl arată așa cum este scris. Debifează cardul ca să omiți înregistrarea din acel export. Panoul de document din Design listează aceleași cuvinte sub *Embedded in exports*.

**Descrierea dă colourway-ul lângă instrument.** Cu cardul bifat, *„Made with https://lolly.tools : Chart”* devine *„Made with https://lolly.tools : Chart (Beach colourway)”*. Numele propriu al sistemului de design rămâne în înregistrare, nu în descriere. O descriere fără nume de instrument sau una pe care un instrument o scrie din propriile intrări rămâne cum este. Un instrument care ignoră colourway-urile prin `tokenAxes` nu înregistrează niciunul, iar creditul de probă din PDF (marca de tipar `prov`) urmează aceeași regulă.

**Brand skills care au ghidat un agent.** Când un agent a făcut piesa și a numit [brand skills](/info/brand-skills.html) pe care le-a citit și urmat, înregistrarea listează și fiecare skill cu revizia lui, precum *Guided by: acme-brand 1.0*. Cuvintele înseamnă că skill-ul a ghidat munca. Nu sunt o verificare: Lolly nu testează piesa față de un skill. Doar propria declarație a agentului adaugă lista, ceea ce astăzi înseamnă argumentul `brandSkills` al `lolly_render` din [serverul MCP](/info/mcp.html), deci o piesă făcută în aplicație sau dintr-un link de partajare nu poartă niciuna. Content Credential conține lista ca `brandSkills`, o singură valoare JSON cu id-ul, numele, revizia și hash-ul SHA-256 al fiecărui skill. Pachetul XMP și metadatele SVG conțin aceeași valoare ca `lolly:BrandSkills`, un PDF scris din înregistrare primește un cuvânt-cheie pe skill, iar descrierea rămâne cum era. Un skill intern este înregistrat prin id, nume, revizie și hash, niciodată prin textul lui. Aceleași comutatoare omit lista împreună cu restul înregistrării: cardul **Design system**, `_madewith=0`, `--no-madewith` și `madeWith: false`. Când serverul MCP desenează fișierul într-un browser (un PDF, un JPEG și celelalte formate pe care calea lui fără browser nu le poate scrie), metadatele proprii ale fișierului nu conțin nicio listă și doar un Content Credential poate conține una. Trece `c2pa` ca să păstrezi înregistrarea; fără o credențială, randarea avertizează că brand skills nu au fost înregistrate.

**Citirea înapoi a înregistrării.** [Verify](/verify) listează înregistrarea ca **Design system** în detaliile credențialei unui fișier și orice brand skills ca **Guided by**. *Recreate with these settings* redeschide instrumentul în versiunea și colourway-ul înregistrate. Linkul se deschide cu sistemul de design înregistrat când acest dispozitiv are unul cu același id și nume; altfel se deschide cu sistemul tău de design activ.

::: details Ce se scrie unde și ce rulări omit înregistrarea
| Unde | Ce se scrie |
|---|---|
| Content Credential | `designSystem` (id-ul), `designSystemLabel`, `designVersion` și `themes` în aserțiunea `tools.lolly.export`, fiecare o valoare text simplă; `themes` este o listă JSON a alegerilor |
| PNG, JPEG, WebP și JXL | Aceleași patru valori ca proprietăți `lolly:` ale pachetului XMP al fișierului, în spațiul de nume `https://lolly.tools/ns/export/1.0/` |
| SVG | Aceleași proprietăți `lolly:` în blocul `<metadata>` |
| PDF | Cuvinte-cheie precum *Design system: Acme* și *Colourway: Beach* |
| Fiecare format cu un câmp de descriere | Descrierea, cu colourway-ul lângă instrument |

Cardul apare doar când există ceva de înregistrat și formatul poate conține înregistrarea. CSV, JSON, un fișier de calendar și alte formate de text sau date nu conțin metadate, iar EPS, EMF, DXF și BMP nu au câmp pentru înregistrare. HTML, Markdown și CSS conțin înregistrarea doar în Content Credential, deci pentru ele cardul nu arată linie de descriere și se ascunde cât **C2PA Credentials** este oprit. Un câmp pe care sistemul de design nu îl dă rămâne în afara fișierului.

Un link de partajare oprește înregistrarea cu `_madewith=0` ([Parametrii URL](/info/url-parameters.html)); linia de comandă ia `--no-madewith`, `lolly_render` din [serverul MCP](/info/mcp.html) ia `madeWith: false`, iar panoul de export al aplicației de terminal are un rând **Design system**. Linia de comandă tipărește pe eroare standard cuvintele pe care le poartă un fișier terminat, pentru o randare de instrument și pentru fiecare fișier pe care `lolly run` îl exportă dintr-o sesiune Design salvată, iar o randare MCP le tipărește lângă fișier, ambele citite înapoi din fișier. Un PNG pe care linia de comandă îl desenează fără browser nu poartă metadate de fișier, deci înregistrarea lui călătorește doar în credențială. Utilitarele pe dispozitiv nu adaugă deloc metadate.

Rulările fără card **Design system** omit înregistrarea: o rulare Batch, un dosar exportat din Projects și un export de colecție 3D, iar în aplicația de terminal un batch CSV, un export de dosar sau selecție Projects și vederea render-everything. Exportă un fișier din instrument ca să înregistrezi sistemul de design.
:::

### Content Credentials (C2PA)

Exporturile pot purta **Content Credentials**: un manifest [C2PA](https://c2pa.org) semnat, care înregistrează ce a făcut fișierul, când și unde, legat de un hash al octeților fișierului, deci orice editare ulterioară este detectabilă. Specificația este publicată de C2PA, iar Lolly scrie manifeste standard pe care orice cititor C2PA le poate inspecta.

![Cardul C2PA Credentials, bifat, cu durata de viață a credențialei lângă caseta de bifare](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Activ implicit.** Cardul **C2PA Credentials** vine preselectat pentru aproape fiecare instrument. Debifează-l pentru un export sau trece `c2pa=off` într-un link. Un instrument poate renunța în manifestul lui.
- **Formate.** PDF (RGB și Print), PNG și APNG, JPG, GIF, SVG, TIFF (RGB și Print), WebP (static și animat), AVIF, MP4, WebM, containerele audio MP3, WAV, M4A, OGG/Opus și FLAC, plus HTML, Markdown și CSS. Un ZIP ștampilează fiecare membru acceptat, așa primește unul un Animated SVG. MP4, AVIF și M4A folosesc legarea standard BMFF, iar MP3 maparea ID3v2, deci `c2patool` și alți cititori le verifică. WebM și OGG/Opus nu au încă o mapare standard, deci Lolly poartă manifestul ca atașament Matroska și câmp OpusTags, pe care le verifică propriul verificator Lolly. ICO, EPS, EMF, DXF, BMP, PPTX, formatele Office și celelalte formate de text și date nu au container C2PA.
- **Ce înregistrează.** Instrumentul și aplicația care au făcut fișierul, ora semnării, shell-ul care l-a exportat, [sistemul de design și colourway-ul](#the-design-system-record) cât cardul **Design system** este bifat și amprente ale intrărilor active. Textul intrărilor, câmpurile legate de profil, controalele inactive, versiunile de browser și detaliile sistemului de operare sunt omise. Numele și emailul tău apar ca autor doar când **Use my details to create** este activ în Settings → Preferences → Your details. Sursele pe care le plasează un export călătoresc ca ingrediente: [lucrări creditate](#source-credits) precum emoji și [melodii Rondocode](/info/rondocode.html#songs-in-the-credential) într-un export video sau audio.
- **Ce văd destinatarii.** Instrumente C2PA precum aplicațiile Adobe, `c2patool` și contentcredentials.org/verify citesc manifestul și arată afirmația. Lolly semnează cu o cheie făcută pe dispozitivul tău, nu cu un certificat dintr-o listă de încredere, deci vizualizatoarele raportează o credențială *unverified*: structura și dovada de manipulare sunt reale, semnatarul nu este garantat. Ca să schimbi asta, înrolează o **verified identity** în Settings → Preferences → Content Credentials; vezi [Identitate Content Credentials](/info/content-credentials-identity.html).
- **Verificarea unui fișier.** Plasează orice fișier pe [Verify](/verify) sau rulează `lolly validate <file>` pentru un raport pe dispozitiv care începe cu dacă fișierul a fost făcut de Lolly și dacă s-a schimbat de atunci. Verify se uită și dincolo de credențială; vezi [Ce verifică Verify](/info/what-verify-checks.html).
- **Confidențialitate.** Cheia de semnare este făcută pentru export și nu părăsește niciodată dispozitivul tău, iar afirmația conține doar ce poartă deja metadatele de proveniență. Utilitarele de confidențialitate care transformă fișierele tale nu adaugă credențială, iar *Strip Hidden Data* elimină un manifest C2PA ca orice alt metadate. Utilitarul Rondocode face audio nou, deci semnează ce scrie ([Melodii Rondocode](/info/rondocode.html#files-from-the-rondocode-utility)).
- **Interacțiuni.** Un PDF protejat cu parolă nu poate purta Content Credentials, la niciun nivel. Credențiala este adăugată ultima, peste octeții terminați, după DPI, EXIF, profilul de culoare, metadatele PDF/X și semnele de tipar.

### Source credits (credite de sursă)

Un export care plasează munca altcuiva înregistrează acea sursă în credențială. Un emoji desenat din setul de emoji ales este cazul obișnuit: lucrarea, creatorul, licența, de unde provin octeții exacți și ce s-a schimbat călătoresc toate cu fișierul. Textul dintr-un instrument al cărui șablon este un SVG păstrează emoji-ul propriu al sistemului, deci nimic nu este creditat acolo. Rândul **Source credits** spune ce cer sursele de la livrare înainte să descarci, iar după descărcare citește înapoi octeții livrați înainte să spună că creditele sunt în fișier. O licență care cere să alegi, precum un glif CC BY-SA recolorat pe care urmează să-l partajezi, primește un card cu opțiunile; descărcarea nu este niciodată blocată. [Drepturi creative și credite](/info/creative-rights.html) are formulările, licențele revizuite și ce rămâne al tău.

## Protecție prin parolă

Două feluri de blocare, ambele făcute pe dispozitivul tău. Cardul *Password protect* al panoului de export le conduce pe amândouă.

![Cardul Password protect extins la un export PDF, cu câmpul pentru parolă și cele două niveluri de blocare](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**O parolă de deschidere PDF** are două niveluri odată ce tastezi o parolă:

- **Weak**: RC4 pe 40 de biți, un factor de descurajare, nu protecție. Parola poate călători într-un link de partajare, în text clar. Doar `pdf` RGB.
- **Strong**: AES-256 (PDF 2.0). Tastată la export și niciodată pusă într-un link. Se aplică și Print PDF și fiecărui PDF dintr-un ZIP batch. Un Print PDF blocat Strong își păstrează CMYK, semnele și output intent, dar renunță la pretenția PDF/X-4.

**Un ZIP blocat** acoperă un export ZIP, o descărcare de dosar din Projects sau un batch, cu o parolă pe două niveluri: **Weak** (ZipCrypto, un factor de descurajare; poate călători într-un link `?password=`) sau **Strong** (AES-256, tastată la export, niciodată într-un link). Parola protejează fiecare membru, iar orice PDF din interior este blocat și el cu AES-256 pe cont propriu, deci rămâne blocat după dezarhivarea ZIP. Solicitarea apare când începe descărcarea; o parolă goală înseamnă fără blocare.

**Un link de partajare cu parolă** cere destinatarului o parolă înainte să se deschidă. Întreaga stare a linkului este criptată cu AES-256 sub o cheie derivată din parolă (PBKDF2), deci călătorește doar textul cifrat, iar decriptarea are loc în browserul destinatarului. Serverul care servește linkul nu vede niciodată parola sau designul. Pornește-l în dialogul **Share**. Un link criptat se deschide doar în Lolly, niciodată ca imagine încorporată. Vezi [Modul URL](/info/url-mode.html).

## Pe telefon

Controalele de export stau în spatele butonului plutitor **Export**, care deschide foaia **Export**: aceleași formate, dimensiune, copiere, descărcare și partajare, dimensionate pentru atingere.

## Id-uri de format pentru linkuri și CLI

Acestea sunt valorile pentru parametrul URL `format=` și indicatorul CLI `--export=` (vezi [Parametrii URL](/info/url-parameters.html) și [CLI](/info/cli.html)). Meniul unui instrument arată doar formatele pe care le poate face acel instrument, deci este mereu mai scurt decât această listă.

| Fel | Id-uri |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vector | `svg` · `svgz` (SVG arhivat gzip) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (fișier de tăiere) |
| Pagină și document | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (fișier de design Penpot) · `scorm` (pachet de curs, un ZIP) |
| Mișcare | `gif` · `apng` (PNG animat) · `webp-anim` (WebP animat) · `svg-anim` (SVG animat) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| Audio | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` |
| Text și date | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `css` · `scss` · `gpl` (paletă GIMP) |
| Bundle-uri și pachete | `zip` · `rpm` și `tar.gz` (randarea sigilată într-un pachet Linux) |

Câteva id-uri vin din codul de export propriu al unui instrument: `ase` (Adobe Swatch Exchange, din Palette Lab) și `exr` și `hdr` (rastere cu gamă dinamică înaltă, din Darkroom). **Convert Font** scrie `ttf`, `otf` și `woff` dintr-un fișier de font pe care îl furnizezi, deci un link simplu nu are ce să randeze pentru el.
