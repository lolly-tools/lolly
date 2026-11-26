# Exportă un fișier

Apasă **Export**, jumătatea stângă a pastilei **Export | Save**, alege un format lângă numele fișierului și apasă **Download**. Fișierul este creat pe dispozitivul tău.

Fișierul conține ce vezi pe canvas. Meniul de format listează doar ce poate crea acest instrument în acest browser.

Majoritatea sarcinilor au nevoie de unul dintre trei formate:

| Pentru | Alege | Pentru că |
|---|---|---|
| Un ecran, un mesaj sau un diapozitiv | **PNG** | Îl deschide orice aplicație și păstrează un fundal transparent când instrumentul oferă unul |
| O pagină finalizată sau orice material tipărit | **PDF** | O dimensiune reală de pagină care se tipărește așa cum arată; **Print PDF**, unde un instrument îl oferă, este versiunea CMYK pentru presă |
| Grafică ce trebuie să rămână clară la orice dimensiune | **SVG** | Forme vectoriale |

::: check Verifică fișierul la dimensiunea la care va fi folosit
Înainte să trimiți fișierul, deschide-l pe ecranul pentru care a fost creat sau tipărește-l la dimensiunea reală.
:::

::: details Aprobări și livrare cu Lolly Work (opțional)
O [organizație care rulează Lolly Work](/info/organisation.html) poate alege ce formate și setări de export văd membrii ei. Unde este necesară aprobarea, **Request approval** înlocuiește **Download**. Urmează politica afișată de instanța ta.

Lolly Work poate și să livreze un fișier către destinații S3, WebDAV și HTTP configurate, cu pași de aprobare, confirmări de livrare și o înregistrare de audit. Acea livrare trimite fișierul la serviciul organizației. O descărcare obișnuită rămâne pe dispozitivul tău. Destinațiile personale Send și livrarea organizației se configurează separat.

Operatorii configurează acest lucru cu [ghidul de livrare al organizației](/info/work-delivery.html). Pentru randări și loturi puse în coadă pe server, vezi [Loturi CLI și automatizare](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

<!--i:eti-cpu-->
## Cum funcționează exportul

Trei căi produc un fișier. Cele mai multe instrumente **randează canvasul**. Formatele de text și de date (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) sunt **generate din conținutul instrumentului**. Utilitarele de confidențialitate precum *Lolly Strip Hidden Data* **transformă fișierul ales de tine** pe dispozitivul tău. Rezultatul nu are canvas, filigran sau metadate adăugate.

![Trei căi de export converg într-un fișier finalizat: randarea canvasului, generarea de text sau date din conținut sau transformarea unui fișier ales, pe dispozitiv.](/info/diagrams/concepts/three-export-paths.svg)

Autorul unui instrument alege ce acțiuni oferă panoul de export. Setul implicit este Copy, Download și Save.

- <!--i:download--> **Download** salvează fișierul. Dacă nu îl găsești după aceea, vezi [Găsește un fișier descărcat](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> **Copy** pune imaginea în clipboard. Unde un browser nu poate copia imagini, Copy descarcă fișierul în schimb și te anunță.
- <!--i:folder--> **Save** păstrează designul curent în Projects și nu descarcă niciodată un fișier. **Save as**, lângă **Download**, întreabă unde (vezi [Salvare și continuare](/info/using.html#saving-continuing)).
- <!--i:link--> **Share** deschide dialogul Share: un link care reproduce designul, comutatoarele la vizită (ecran complet, panou de export, descărcare sau copiere la deschidere) și un **Shortest link** opțional care împachetează starea într-un token compact (vezi [Modul URL](/info/url-mode.html)).

**Send to**, un card din panoul de export, trimite fișierul către un serviciu pe care l-ai conectat. După o trimitere către Google Drive, Nextcloud, un bucket S3, Dropbox sau OneDrive, **Create a share link** poate crea un link acolo fără o a doua încărcare. Secțiunea **Share through your cloud** din dialogul Share trimite un fișier `.lolly` și îi creează linkul într-un singur pas. Panoul de linkuri arată cine poate deschide linkul, unde se află fișierul și când expiră linkul. **Links you've shared**, din dialogul Share, îți permite să oprești partajarea. Linkurile Nextcloud pot avea o parolă și o dată de expirare. Linkurile S3 durează între 1 și 7 zile și nu pot fi oprite mai devreme. Lolly nu păstrează pe un server nicio copie a fișierului și niciun token de autentificare. [Confidențialitate](/info/privacy.html#every-network-request-the-app-can-make) listează ce primește fiecare serviciu.

![Panoul de export - formatul, dimensiunea și acțiunile Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Când un design încorporează randarea altui instrument, precum o casetă de imagine Lolly Design care conține un link QR Code, exportul părintelui desenează randarea imbricată. Rămâne vectorială în SVG și PDF și se rasterizează în PNG, JPG și WebP. Randarea încorporată nu primește filigran sau proveniență proprie; doar fișierul finalizat le primește. Exporturile HTML, Markdown și TXT nu pot conține o randare compusă.

<!--i:eti-file-->
## Alege un format

Numele fișierului și meniul de format stau împreună ca o singură pereche `name.format`, sub **Download**.

![Câmpul numelui de fișier unit cu selectorul de format, astfel încât exportul se citește ca o singură pereche nume.format](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Pornește de la destinația fișierului. Fiecare card listează formatele potrivite acelei destinații.

::: figure exporting-format-chooser
Șase destinații și formatele potrivite fiecăreia.
:::

Un wordmark în fontul sistemului tău de design se exportă ca SVG cu fiecare literă transformată în cale de contur. Fișierul rămâne clar la orice dimensiune.

Textul într-o altă limbă depinde de fonturile pe care le ai. Când un font din sistemul tău de design are literele, SVG și PDF le desenează ca contururi, modelate și în ordinea de citire, inclusiv rândurile de la dreapta la stânga. Când niciunul nu le are, Lolly folosește un [font de rezervă](/info/fallback-fonts.html), iar cardul de export arată acel font. Textul pe care nu îl acoperă niciun font de rezervă rămâne text live într-un SVG, desenat cu fonturile proprii ale vizualizatorului. Într-un PDF, EPS sau WMF și într-un EMF cu **Outline fonts** activat, acel text devine imagini. Acele cuvinte arată ca pe pagină, dar nu pot fi selectate sau căutate. Cardul de export listează acele sisteme de scriere. Adaugă un font cu acele litere ca să le păstrezi ca text vectorial.

![Un wordmark cu linii fine și spațiere largă, pe care scrie Aurora, genul de grafică pur vectorială la care se referă rândul SVG din tabel](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Fiecare format și la ce folosește
| Vrei | Folosește | De ce |
|---|---|---|
| Logouri clare sau grafică scalabilă | **SVG** | Vectorial: scalabil, mic și editabil; un efect pe care exportul vectorial nu îl poate desena este încorporat ca imagine |
| Vector pentru Office și aplicații Windows | **EMF** | Se lipește ca vector editabil în PowerPoint și Word, cu text live; Google Drive îl deschide în Google Drawings |
| Vector pentru tipar și aplicații de design | **EPS** sau **EPS (CMYK)** | Vector PostScript pentru Illustrator și fluxuri de tipar |
| Vector pentru mașini de tăiat | **DXF** | Tăietoare laser, plottere de vinil și CNC: căi de contur în milimetri |
| Un deck de diapozitive editabil | **PowerPoint** (PPTX) | Text și forme native editabile, cu imagini și vectori care rămân extractibili |
| Un document text editabil | **Word** (DOCX) sau **OpenDocument** (ODT) | Paragrafe și titluri pe care un procesor de text le poate edita în continuare (Lolly Doc Studio) |
| Un layout pentru InDesign | **InDesign IDML (static subset)** | Text, dreptunghiuri, elipse și imagini, un spread pe planșă (Lolly Design) |
| Un document Penpot editabil | **Penpot** | Planșe, forme, text și tokenuri legate |
| O fotografie sau o imagine de uz general | **PNG** (fără pierderi) sau **JPG** (mai mic) | Raster universal |
| Imagini moderne mai mici | **WebP** sau **AVIF** | Compresie mai bună, cu transparență |
| Tipar | **PDF** sau **Print PDF** (CMYK) | Dimensiune reală de pagină; CMYK pentru presă |
| Raster de tipar pentru presă | **Print TIFF** (CMYK) | Pixeli DeviceCMYK pentru un RIP |
| Animație pentru web | **GIF** | Rulează peste tot; fișiere mai mari |
| Animație în culori complete și cu transparență reală | **APNG** | PNG animat: fără limită de paletă |
| Animație, cel mai mic fișier | **Animated WebP** | Culori complete și transparență, mai mic decât GIF sau APNG |
| Vector animat scalabil | **Animated SVG** | De sine stătător; rulează în buclă într-un browser sau un `<img>`, la orice dimensiune (Lottie Ad) |
| O animație care rămâne editabilă | **dotLottie** | Forme, căi și chei de transformare exterioare din cronologia Lolly Design |
| Un transfer către Premiere | **Premiere XML + media** | Clipuri temporizate și resurse media originale pentru Premiere (Lolly Design) |
| Video pentru rețele sociale și partajare | **MP4** sau **WebM** | Cea mai bună calitate pentru dimensiunea fișierului (vezi [Video](#video)) |
| Subtitrări | **SRT** sau **VTT** | Text temporizat pentru un player video (Captions, Audiogram și Record) |
| Subtitrări pentru difuzare | **TTML** sau **SCC** | Text temporizat IMSC1.1 sau subtitrări pop-on CEA-608 (Captions; vezi [Subtitrări pentru difuzare](#broadcast-captions)) |
| Un curs de instruire | **SCORM (LMS)** | Un pachet de site web, SCORM sau xAPI cu versiuni (vezi [SCORM](#scorm-course-packages)) |
| Text formatat sau o semnătură de email | **HTML** | Se lipește cu formatare în clienții de email |
| O animație care rulează într-un browser | **HTML** | Un player într-un singur fișier, din cronologia Lolly Design sau Snippet (vezi [Video](#video)) |
| Conținut simplu | **MD** sau **TXT** | Doar text |
| Un eveniment de calendar | **ICS** | Se importă în orice aplicație de calendar |
| O fișă de contact | **VCF** | Se importă în agende de contacte |
| Date structurate pentru reimportare | **JSON** sau **CSV** | Permite exportarea și reimportarea conținutului instrumentului |
| Un favicon | **ICO** | Pictogramă de site în mai multe dimensiuni; **ZIP** grupează mai multe formate |
:::

### Transparență

Instrumentele care îl acceptă oferă un comutator pentru fundal transparent, precum **No BG**. PNG, WebP, AVIF, SVG, APNG și Animated WebP păstrează transparența, iar GIF păstrează o margine netă. JPG și PDF sunt întotdeauna opace. TIFF aplatizează pe alb sau pe negru pe calea [HDR](#hdr-bright-colours).

<!--i:eti-crop-->
## Dimensiuni și unități de tipar

Exporturile folosesc dimensiunea nativă în pixeli a instrumentului, cu excepția cazului în care instrumentul oferă **dimensiuni**. În acel caz setezi lățimea, înălțimea și o **unitate**:

- **px** (implicit) înseamnă pixeli exacți.
- **mm, cm, in, pt** și **pc** sunt dimensiuni fizice. Cu o unitate fizică setezi și **DPI** (300 implicit). Un **PDF** devine o pagină reală la acea dimensiune. Un **raster** primește numărul de pixeli pentru acel DPI și înregistrează rezoluția. Un **SVG** păstrează unitatea fizică cu un viewBox în pixeli.

Pentru un raster cu rezoluție mai mare, introdu o lățime și o înălțime mai mari sau alege o unitate fizică și mărește DPI (pixeli = dimensiune × DPI). Lățimea `210`, înălțimea `297` și unitatea `mm` creează o pagină A4.

![Rândul de dimensiuni setat la 210 pe 297 mm, cu câmpul DPI afișat deoarece unitatea este fizică](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

<!--i:eti-images-->
## Imagini statice dintr-o compoziție temporizată

Dintr-o compoziție temporizată, precum o cronologie [Sequence](/info/sequence-editor.html) în Lolly Design, un export static preia **cadrul de la capul de redare**. Plasează capul de redare unde vrei imaginea și exportă.

Pentru mai multe momente, folosește câmpul **Frames** de lângă dimensiunea de ieșire. Apare doar pentru o compoziție temporizată și un format static (PNG, JPG, WebP, SVG sau PDF). `1` oferă cadrul de la capul de redare. Un număr mai mare oferă atâtea imagini statice, distribuite uniform de-a lungul secvenței:

- PNG, JPG, WebP și SVG sunt livrate într-un singur ZIP: `<name>-01.png`, `-02.png` și așa mai departe.
- PDF este livrat ca un singur document cu acel număr de pagini.

Fiecare imagine statică provine din mijlocul segmentului său de cronologie, așa că prima nu este niciodată o intrare pe jumătate estompată, iar ultima nu este niciodată momentul gol de după sfârșitul clipurilor.

::: figure exporting-contact-sheet
Frames: 4 împarte secvența în patru segmente egale și preia mijlocul fiecăruia.
:::

Folosește Frames pentru un storyboard, o planșă de contact pentru revizuire sau un carusel pentru rețele sociale extras dintr-un montaj video. Numărul este limitat la 64. Orice altceva introdus în câmp revine la `1`. Fiecare cadru este o imagine statică obișnuită, așa că acreditările, Imprint, unitățile fizice și DPI se comportă ca la un singur export. Un link de export, CLI și MCP cer aceeași planșă cu `cuts=` (vezi [Planșe de contact](/info/url-export.html#contact-sheets)).

<!--i:eti-copy-->
## Mai multe fișiere deodată

Lolly are trei moduri de a lucra în volum:

::: cols
## Un tabel devine un document
Un instrument construit pentru a pagina un tabel de intrare transformă fiecare rând într-o pagină. Lipește un tabel din foaia de calcul ca să obții un singur PDF. Ca să corectezi rânduri, editează foaia de calcul și lipește din nou. Battlecards este instrumentul de referință. Se află în dosarul open-source `community` și nu este listat pe lolly.tools.
## Un CSV devine un fișier pentru fiecare rând
**Batch** (`#/batch`) preia un CSV și randează câte un export pentru fiecare rând, de exemplu ecusoane cu nume sau certificate, livrate într-un ZIP. Vezi [Lolly Batch](/info/batch.html#make-many-versions-of-one-design).
## Mai multe designuri primesc aceeași editare
**Lolly Multi-edit** deschide mai multe sesiuni salvate una lângă alta ca să faci aceeași schimbare în fiecare. Vezi [Lolly Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Un instrument cu mai multe pagini, precum Booklet, Print Sheet, Lolly Doc Studio sau Lolly Markdown Slides, exportă PNG, JPG, WebP, SVG și celelalte formate de imagine unică într-un fișier pentru fiecare pagină, într-un ZIP când sunt mai multe. Print Sheet păstrează coala întreagă și semnele de tăiere la DPI-ul ales.

Din **Projects**, **Render folder** exportă fiecare sesiune salvată dintr-un dosar și subdosarele lui într-un singur ZIP cu structură imbricată. **Render selection** face același lucru pentru o selecție multiplă. O singură sesiune salvată se randează în propriul fișier. Projects poate și să partajeze din nou o sesiune salvată ca link de instrument care redeschide sesiunea cu aceleași setări.

<!--i:eti-pen-->
## Fișiere care rămân editabile în alte aplicații

Unele formate transferă munca ta către altă aplicație sub formă de conținut editabil, nu ca imagine.

### PowerPoint (PPTX)

Lolly Design, Lolly Markdown Slides, Booklet, Lolly Doc Studio, Lolly Chart, Diagrams, Flow Chart și Agenda exportă un deck PowerPoint, cu un diapozitiv pentru fiecare pagină. Fiecare pagină este împărțită în obiecte native pe care un coleg le poate edita și extrage:

- <!--i:font--> **Textul** devine casete de text PowerPoint editabile cu dimensiunea fontului, culoarea, grosimea, cursivele și alinierea din layout. Un deck Lolly Design setează fontul brandului pentru fiecare segment de text, chiar și fără un diapozitiv coordonator.
- <!--i:pentool--> **Vectorii**, precum logourile și pictogramele, sunt încorporați ca imagini SVG, iar PowerPoint poate aplica *Convert to Shape* asupra lor.
- <!--i:photos--> **Imaginile** sunt transferate ca imagini separate la rezoluția nativă. O imagine principală decupată păstrează imaginea completă în spatele decupării. Orice filtru sau mod de amestecare aplicat unei imagini este integrat în ea.
- <!--i:layers--> **Fundalurile, bordurile și liniile de separare** devin forme dreptunghiulare și linii. Cercurile, elipsele și pastilele din Lolly Design rămân forme native, editabile.

![Panoul de export cu PowerPoint ales: un diapozitiv pentru fiecare pagină, textul și formele rămân editabile](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Layoutul este aproximativ. Orice element pe care mecanismul de parcurgere nu îl poate exprima nativ, precum o zonă complexă cu filtre sau măști, este încorporat ca imagine. Un deck are o singură dimensiune de diapozitiv, preluată de la prima pagină.

PowerPoint este și o cale de intrare: [Aplică un nou brand unui deck](/info/rebrand.html) mută un deck pe sistemul tău de design, iar [Importă un design](/info/design-import.html) îl deschide în Lolly Design.

### Penpot

Majoritatea instrumentelor care exportă SVG exportă și un **fișier Penpot** (`.penpot`).

| Ce ai creat | În Penpot |
|---|---|
| Text | Obiecte text editabile |
| Forme, căi, degradeuri și imagini | Forme vectoriale editabile |
| O culoare sau un font dintr-un token al sistemului de design | O legătură live cu tokenul: editează tokenul și fiecare formă care îl moștenește se actualizează |
| Întregul design | O componentă reutilizabilă în panoul Assets |
| O ilustrație complexă sau un canvas live | O imagine încorporată; conținutul din jur rămâne editabil |

Din Lolly Design, fiecare cadru devine o planșă Penpot. Culorile și tipografiile sistemului de design ajung în panoul Assets, iar întregul set de tokenuri în panoul Tokens. Penpot păstrează propria copie. Un token editat în Penpot revine prin importul din [Lolly Design System Setup](/info/brand-studio.html).

![Panoul de export cu Penpot ales: fișierul .penpot și Send to Penpot lângă descărcare](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Ca să deschizi fișierul, pornește Penpot, alege un proiect și selectează **Import**. Dacă te conectezi la Penpot din panoul de export, **Send to Penpot** importă fișierul pentru tine.

### Word, OpenDocument și InDesign

**Lolly Doc Studio** exportă **Word** (DOCX) și **OpenDocument** (ODT) cu paragrafe și titluri editabile. Fișierul Word setează fonturile și culoarea textului brandului prin stilurile documentului, respectă dimensiunea paginii pe care o alegi și adaugă un PNG lângă un logo SVG pentru aplicațiile care nu pot desena SVG.

**Lolly Design** exportă **InDesign IDML (static subset)**: text, dreptunghiuri, elipse și imagini PNG sau JPEG, un spread pe planșă. Formatarea inline acceptată rămâne editabilă, imaginile sunt incluse în `Links`, iar coordonatele devin puncte InDesign. Refacerea legăturilor, înlocuirea fonturilor și modificările de împărțire pe rânduri pot necesita atenție. Efectele, animația, fluxurile de text compuse și geometria neacceptată opresc exportul cu un raport care le listează. IDML nu păstrează documentul original. Trimite PDF pentru grafică finalizată.

### Cronologii: dotLottie și Premiere

Din cronologia Lolly Design, **dotLottie** scrie o animație care rămâne editabilă în instrumentele Lottie; [Animații Lottie](/info/sequence-editor.html#lottie-animations) listează ce păstrează. **Premiere XML + media** împachetează clipurile temporizate și resursele lor media originale pentru Premiere; vezi [Schimb prin Premiere XML](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (pachete de curs)

Exportul cursurilor este dezactivat până când activezi **Training and courses** în Settings → Preferences → Feature flags.

Apoi alege **Export course** dintr-un instrument compatibil, un dosar de proiect sau o selecție. În Lolly Design, alegerea **SCORM (LMS)** și **Download** deschide același flux de lucru pentru cursuri. Lolly salvează munca, arată conținutul și ordinea cursului pentru revizuire, apoi deschide modulul și dialogul său de export.

- <!--i:layers--> Alege o reprezentare pentru fiecare sursă: pagini statice, mișcare ca video, audio sau o resursă descărcabilă. Adaugă textul lecției și alternative de lectură în modul.
- <!--i:clock--> Previzualizează playerul cursantului și revizuiește descrierile și subtitrările. Mișcarea, inclusiv animația fără sunet, este inclusă ca video.
- <!--i:document--> Alege Website, SCORM 1.2, SCORM 2004 4th Edition sau o destinație xAPI experimentală. Verifică conținutul și dimensiunea ZIP, apoi salvează și descarcă versiunea verificată.
- <!--i:check--> Finalizarea cere confirmarea fiecărei lecții obligatorii și alegerea Finish.

![Panoul de export al unui deck Lolly Design cu SCORM (LMS) ales](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Pachetul conține conținutul finalizat și nu are nevoie de cont Lolly. Pune un ZIP Website pe o gazdă HTTP(S); importă un ZIP LMS fără modificări. Testează destinația înainte să partajezi cursul. Pentru un curs construit din mai multe creații salvate, vezi [Creează un curs de instruire](/info/training-creators.html).

### Subtitrări pentru difuzare

Instrumentul Captions poate exporta și **TTML** și **SCC**. Ambele sunt scrise din aceeași listă de segmente temporizate ca fișierele SRT și VTT, așa că textul și timpii coincid.

- **TTML** este IMSC1.1 Text Profile, cu timpi de ceas raportați la timpul media și o singură regiune centrată jos. Nu conține culoare, font sau poziție pentru fiecare subtitrare, deoarece subtitrările Lolly conțin doar un început, un sfârșit și text.
- **SCC** conține subtitrări pop-on CEA-608 pe canalul 1 la 29.97 cadre pe secundă cu timecode drop-frame. Acceptă caracterele nord-americane de bază, plus cele speciale și extinse. Dacă o subtitrare are un caracter care nu este în set, exportul se oprește și spune care este caracterul. Fiecare subtitrare se împarte pe 32 de coloane și cel mult 15 rânduri. O subtitrare care nu se poate încărca înainte de momentul ei de început este întârziată cu câteva cadre.
- Subtitrările roll-up și paint-on nu sunt scrise.

::: note SCC nu a fost verificat într-un instrument de difuzare
Nici nu a fost încercat pe un decodor hardware. Testează un fișier în propriul flux de procesare înainte de livrare.
:::

### DXF (fișiere de tăiere)

Lolly Asset Export, Diagrams, Growth, Lolly Logo Wall, QR Code, Street Map, Wayfinding și Wordmark exportă **DXF**, formatul de schimb AutoCAD R12 pe care îl citesc tăietoarele laser, plotterele de vinil și software-ul CNC. Geometria este scrisă sub formă de căi de contur în milimetri, iar textul este transformat în contururi. Culoarea este asociată cu cea mai apropiată valoare AutoCAD Color Index, care de obicei controlează operația mașinii de tăiat. DXF conține doar grafică liniară: o zonă fotografică sau filtrată nu are cale de tăiere și este eliminată cu un avertisment. Folosește SVG sau PDF ca să păstrezi conținutul raster. Textul pe care nu îl acoperă niciun font, nici măcar un [font de rezervă](/info/fallback-fonts.html), oprește exportul cu un mesaj care citează textul.

Un design Street Map este alcătuit doar din linii, așa că fiecare drum și canal devine o cale de tăiere.

::: showcase
![O randare Street Map a Parisului în cerneală pe crem - grafică pur liniară, așa că fiecare linie se păstrează la transferul către o mașină de tăiat](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Derulează și camera se retrage prin geometrie: șapte căi și niciun pixel. O mașină de tăiat citește același fișier.
:::

<!--i:eti-stamp-->
## Tipar

**Print PDF** scrie CMYK pentru o condiție de tipar denumită, implicit **Coated FOGRA39**. Mostrele de culoare ale brandului cu valori măsurate ale cernelii păstrează acele valori. Celelalte culori sunt convertite printr-un profil de tipar: implicit profilul Coated FOGRA39 propriu al Lolly sau propriul tău profil când alegi rândul său **Embed**. Griurile și negrul rămân doar pe placa de negru, așa că textul mic nu poate suferi erori de registru. FOGRA51, SWOP și GRACoL folosesc o conversie standard a dispozitivului. Textul negru se și supratipărește peste culoarea de dedesubt, așa că o presă ușor dezaliniată nu lasă margini albe în jurul literelor. **Print TIFF** scrie pixeli DeviceCMYK pentru un RIP. Controlul Colour profile le gestionează pe ambele ([Profiluri de culoare](#colour-profiles)). Print TIFF și **EPS (CMYK)** separă culorile prin același profil de tipar ca Print PDF.

**Print marks & bleed** are propriul card pentru formatele de tipar: marginea de tăiere în milimetri plus Crop, Registration, Bleed, Colour bars și Stamp details. Stamp details tipărește data, instrumentul și numele tău în margine. Un nume sau un nume de instrument cu litere pe care fontul marginii nu le are, precum cele arabe, chinezești, chirilice sau un emoji, este desenat ca imagine în același gri. Cardul de export listează acele sisteme de scriere.

Unele instrumente, precum *Booklet*, construiesc un **PDF cu mai multe pagini**: o copertă, conținut care curge pe atâtea pagini câte are nevoie și o pagină de final. Fiecare pagină este o pagină PDF reală în orientare portret, în A4, US Letter sau A5. Poți forța orice bloc să înceapă pe o pagină nouă. Acestea sunt documente RGB fără semne de tăiere sau de margine de tăiere; acele semne aparțin Print PDF cu o singură pagină. Un PDF Lolly Design poate fi și un **Notes handout**: o pagină portret pentru fiecare diapozitiv, cu notele prezentatorului dedesubt.

**Înainte să exporți.** Un card **Before you export** la baza panoului arată ce va vedea o tipografie: format, dimensiune și margine de tăiere, zone de tăiere și de margine de tăiere, acoperire cu cerneală, număr de plăci și număr de pagini, cu un verdict lângă titlu. Cardul nu blochează niciodată un export. Lolly Design arată întotdeauna cardul cu propriile verificări, inclusiv regulile organizației din sistemul de design, strat cu strat, și semnalul privind redactarea textului documentului ([Înainte să exporți](/info/design.html#before-you-export)). Lolly Design adaugă aceste verificări de tipar când **Print preflight** este activat. În alte instrumente, activează **Print preflight** în Settings → Preferences → Feature flags. Este dezactivat implicit, iar o implementare Lolly Work îl poate activa pentru membrii ei.

**După ce exporți.** Lolly recitește fișierul finalizat și îl compară cu ce ai ales: format, dimensiune în pixeli sau a paginii, lungime a clipului, fundal transparent, culoare CMYK, HDR, Content Credentials și o parolă PDF sau ZIP. Orice diferență este scrisă pe cardul de export. Fiecare măsurătoare provine din fișier, niciodată din setare. O proprietate pe care fișierul nu o poate confirma nu este considerată o potrivire. Linia de comandă scrie comparația completă cu `--export-report` (vezi [Randează cu CLI](/info/cli-rendering.html)).

::: details Verificări de accesibilitate PDF din linia de comandă
**Verificări de accesibilitate PDF.** Pentru un PDF, linia de comandă listează și 32 de verificări de accesibilitate în fișierul `--export-report`, sub `pdfAccessibility`. Fiecare verificare are un id, o descriere simplă, un rezultat și locul din fișier unde a găsit o problemă:

- **Passed**: verificarea a examinat ceva și nu a găsit nimic în neregulă.
- **Failed**: verificarea a găsit o problemă. Numerele paginilor sau etichetele aferente sunt listate.
- **Not applicable**: fișierul nu avea nimic de acel tip de examinat, precum verificări de tabele într-un fișier fără tabele. Acest lucru nu spune nimic despre fișier.
- **Needs a person**: șase verificări nu pot fi evaluate de un program (ordinea de citire, contrastul culorilor, pâlpâirea, scripturile, limitele de timp și linkurile repetate).

Lista nu este un verdict. Nu spune că un PDF respectă PDF/UA sau că persoanele care folosesc tehnologie asistivă pot utiliza PDF-ul. O persoană tot trebuie să verifice fișierul cu un cititor de ecran. PDF-urile proprii ale Lolly nu trec astăzi verificările de etichetare, deoarece exportatoarele nu scriu încă etichete. Verificarea citește fișierul pe dispozitivul tău și nu schimbă nimic. Fișierele care au nevoie de parolă sunt marcate ca neverificate, nu ca trecute. Ca să verifici un PDF primit, trage-l în [Lolly Strip Hidden Data](/info/utilities.html), care arată aceeași listă sub **PDF accessibility checks**.
:::

Verificările Inspectorului din Lolly Design și comparația de brand din Lolly Design System Setup examinează designul. Aceste două carduri examinează fișierul.

::: details Costul dintr-o listă de tarife
Sub verificarea preliminară, un card de cost transformă aceleași cantități în bani, chiar și când cardul de verificare preliminară este dezactivat. Are nevoie de două lucruri: o lucrare al cărei preț poate fi calculat pe baza unei liste (plăci, coli, suprafață, pagini, rânduri de variante sau fișiere de ieșire, așa că un simplu logo PNG nu afișează niciodată cardul) și o **listă de tarife**, o listă de prețuri JSON de la tipografia ta. O versiune implicită nu conține o listă de tarife și nu are o modalitate de a încărca una în aplicație. O listă de tarife sosește ca resursă de catalog livrată cu o implementare sau prin extensia opțională pentru liste de tarife pe care o activează un operator care găzduiește singur aplicația sau un plan de control. Fără o listă de tarife, nu se afișează nimic.

Fiecare valoare este un tarif furnizat de tine înmulțit cu o cantitate numărată de Lolly, precum `4 plate × €35.00`. Totalul își arată sursa: emitentul listei și data tarifelor sale. Nu există monedă implicită și nici preț provizoriu. Ce spune fișierul despre sine rămâne o afirmație atribuită: *„Fișierul spune: … Lolly nu a verificat acest lucru.”*

Când o valoare nu poate fi calculată, tabelul este retras în loc să fie completat:

- Pozițiile pentru care lista nu are preț înseamnă **niciun total**, doar un titlu care spune câte nu au preț.
- O cantitate care este o limită maximă păstrează **„până la”** în subtotalul ei.
- Tarifele care au depășit data de valabilitate arată **doar cantitățile** până când apeși *Use these rates anyway*; data expirării rămâne apoi lângă valoare.
- La deschiderea printr-un **link**, sumele rămân ascunse până când le ceri pe acest dispozitiv. CLI acceptă `--rate-card=<file.json>` ca fișier local și niciodată ca parametru de link.

Cardul este eliminat din fiecare etapă de export și nu schimbă niciodată fișierul. Este un calcul, nu o ofertă de preț. Doar tipografia ta poate face o ofertă.
:::

<!--i:eti-film-->
## Mișcare și sunet

### Video

Instrumentele animate exportă **MP4** și **WebM**. Un link `?format=` partajat care cere un container pe care acest browser nu îl poate crea trece la celălalt, cu un nume de fișier corespunzător. **Start after** ține canvasul nemișcat pentru ca animațiile și fonturile să se stabilizeze înainte de înregistrare. **Duration** setează lungimea clipului finalizat. **Motion blur** (Off, Draft quality, Standard sau High, cu un **Shutter angle**) estompează mișcarea rapidă și încetinește randarea. Unde browserul permite, **Record live** înregistrează previzualizarea de pe ecran în timp real prin partajarea ecranului.

![Setările de temporizare pentru un export animat: Start after, Duration, Motion blur cu Shutter angle și Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** alege Smaller file, Balanced sau Best quality. **Advanced** deschide **Codec**, **Frame rate**, **Rate mode** și **Hardware acceleration**. Unde un instrument are subtitrări, **Captions** alege o **Embedded track** sau un **Sidecar .vtt + .srt** lângă videoclip. Un link conține calitatea, codecul, frecvența cadrelor, durata și întârzierea de pornire ca `vq`, `codec`, `fps`, `seconds` și `wait` ([Parametri URL](/info/url-parameters.html)).

Exporturile video își păstrează sunetul. Un instrument poate pune un **fundal muzical** sub clip: o resursă audio repetată în buclă sau tăiată la lungimea clipului, cu estompări, volum și reducerea automată a volumului sub sunetul propriu al filmării. Instrumentele de înregistrare includ sunetul live în fișier.

Un deck Lolly Design cu avansare la clic se poate exporta și ca video. **Export slides as video** din meniul Present deschide panoul de export pe MP4. Fiecare diapozitiv rulează pe propria durată de afișare sau pe Duration din panoul de export când nu are una. Tranziția deck-ului se redă între diapozitive ca o dizolvare. Documentul nu se schimbă.

**HTML** dintr-un document Lolly Design temporizat sau din Snippet este un player într-un singur fișier: controale de redare, navigare în timp și sunet peste animație, cu fonturile acceptate, imaginile și sunetul încorporate. Fișierul rulează offline. Un film Lolly Design cu scene adaugă un meniu al scenelor sale. O secvență care conține un clip video, Lottie sau 3D nu se poate exporta încă în HTML; exportă secvența ca video.

### Imagini animate

**GIF** rulează peste tot și este potrivit pentru chat și email; este mai mare și are mai puține culori decât un video. **APNG** și **Animated WebP** păstrează culorile complete și transparența. **Lottie Ad** exportă și **Animated SVG**: cadre vectoriale cu cadre-cheie CSS încorporate, care se scalează la orice dimensiune și rulează în buclă într-o filă de browser sau un `<img>` fără codec. Textul este transformat în contururi. Folosește implicit o frecvență mai mică a cadrelor, deoarece fiecare cadru este mai voluminos decât un bitmap. Toate acestea sunt fără sunet.

### Audio

Unele instrumente exportă sunetul separat. **Lolly Voice Recorder** captează o înregistrare de microfon cu un indicator de nivel live și o salvează ca **MP3**, **WAV**, **M4A (AAC)** sau **Opus (WebM)**, codificată pe dispozitivul tău. `wav`, `mp3`, `m4a` și `opus` sunt id-uri obișnuite de format, așa că un export audio se poate partaja și automatiza prin scripturi la fel ca un PNG.

Selectorul de resurse acceptă multe formate audio pentru un fundal muzical, de la MP3 și FLAC la MIDI și module tracker; [Formate](/info/formats.html) le listează. O [melodie Lolly Rondocode](/info/rondocode.html) se redă pe durata cerută de clipul ei.

<!--i:eti-palette-->
## Culoare și HDR

Lolly citește orice culoare CSS modernă, face calculele de culoare pe baza percepției și scrie fiecare fișier într-un spațiu pe care un cititor îl poate deschide: sRGB pentru ecrane, CMYK pentru tipar și Rec.2100 PQ pentru HDR ([Culoarea în motor](/info/colour-engine.html)). Un document Lolly Design setat la **Wide colour / HDR** urmează propriile reguli: vezi [Editare cu gamă largă de culori și HDR](/info/hdr-editing.html).

### Profiluri de culoare

Exporturile sunt etichetate cu un profil de culoare, așa că aplicațiile cu gestionarea culorilor, precum cele din tipografii, Photoshop și browserele, citesc culorile așa cum le-ai văzut. Miniaturile și previzualizările omit eticheta ca să rămână mici.

- **PNG și JPG** conțin un profil ICC **sRGB** încorporat, spațiul în care este desenată previzualizarea. Pixelii sunt etichetați, nu recodificați.
- **Print PDF (CMYK)** își declară condiția de tipar în *OutputIntent*, indicând tipografiei cum trebuie interpretate cernelurile CMYK.
- **Print TIFF (CMYK)** scrie pixeli DeviceCMYK neetichetați și înregistrează condiția de tipar în metadatele TIFF. Un TIFF nu poate încorpora un profil de tipar, așa că un rând **Embed** înregistrează doar numele acelui profil.
- **TIFF (RGB)** este versiunea sRGB necomprimată pentru arhivare sau pentru export și reimport într-un editor. Ambele TIFF-uri sunt disponibile doar pe desktop, deoarece browserele nu pot previzualiza un TIFF.
- **SVG**, **EMF**, **EPS** și **DXF** sunt vectori fără profil încorporat: culorile SVG sunt sRGB, EMF și EPS folosesc RGB de dispozitiv, **EPS (CMYK)** scrie DeviceCMYK și DXF folosește AutoCAD Color Index. SVG, EPS și DXF transformă textul în căi de contur. EMF păstrează textul live și editabil în Office și Google Slides și transformă în contururi doar segmentele pe care formatul nu le poate exprima. Opțiunea **Outline fonts** din panoul de export impune căi peste tot, la fel ca `_text=outline` într-un link și `--text=outline` în linia de comandă. SVG reproduce și umbrele casetelor CSS, în interior și în exterior.

::: details PDF/X-4 și propriul tău profil de tipar
Lolly include un profil CMYK, adaptat la datele de caracterizare FOGRA39 ale Fogra și publicat sub CC0, și convertește culorile prin el pentru condiția de tipar implicită. Profilul nu este încorporat, deoarece este ICC versiunea 4.3, iar PDF/X-4 acceptă versiuni până la 4.2. Prin urmare, o condiție de tipar denumită scrie intenția de ieșire fără să declare conformitatea PDF/X-4.

Încarcă propriul profil CMYK și alege rândul său **Embed** în controlul Colour profile. Este încorporat ca *DestOutputProfile* al fișierului, iar PDF-ul declară conformitatea PDF/X-4 ori de câte ori restul fișierului permite. Condiția de tipar pe care o declară este citită din acel profil: un nume înregistrat dacă profilul îl confirmă sau `Custom` sub numele profilului.

Trei lucruri împiedică declarația, păstrând totuși intenția de ieșire: grafica RGB pe care trecerea CMYK nu a putut-o converti, textul de atribuire `prov` din marginea probei (desenat într-un font standard care nu este încorporat) și o parolă **Strong**, deoarece PDF/X-4 interzice criptarea. Fiecare PDF conține și metadate PDF/X-4: casete de pagină, XMP, un ID de document și o intenție de ieșire sRGB cu profilul său.
:::

### Cerneluri speciale în policromie

Un sistem de design poate atribui unei culori o cerneală specială, precum o culoare Pantone sau HLC. **Print PDF** tipărește apoi acea culoare pe o placă proprie. Lolly Demo atribuie fiecărei culori o cerneală specială, cu excepția nuanțelor sale de alb, Sugar și Daylight, și a negrului său, Void. Un Print PDF realizat în Lolly Demo tipărește majoritatea culorilor pe plăci pentru cerneluri speciale și negrul pe placa de negru.

Pentru un fișier simplu în patru culori, bifează **Print spot inks as process** în cardul Profile din panoul de export. Fiecare cerneală specială se tipărește apoi cu cyan, magenta, galben și negru, folosind compoziția CMYK pe care sistemul de design o atribuie acelei culori. O culoare fără compoziție proprie folosește conversia profilului de tipar, ca orice altă culoare din grafică. Fișierul are atunci doar cele patru plăci de policromie. Opțiunea este dezactivată implicit. Panoul arată caseta doar pentru **Print PDF** și doar când sistemul de design atribuie unei culori o cerneală specială.

Un finisaj nu este o cerneală. Folia, embosarea, debosarea, lăcuirea selectivă, soft touch, ștanțarea, biguirea și perforarea își păstrează propriile plăci denumite când caseta este bifată, deoarece un finisaj tipărit în policromie și-ar pune masca neagră pe pagină.

Cardul **Before you export** și `lolly preflight` numără plăcile pe care le va avea fișierul. Cu caseta bifată, numără cele patru plăci de policromie și toate plăcile de finisaj și precizează că cernelurile speciale se tipăresc în policromie și nu adaugă plăci. Cu caseta debifată, numără cel mult o placă pentru fiecare cerneală specială atribuită de sistemul de design. O grilă de tarife calculează prețul pe baza acestor numere, deci nu taxează niciodată o placă pentru cerneală specială pe care fișierul nu o va avea.

**Print TIFF** și **EPS (CMYK)** nu au plăci denumite, deci tipăresc fiecare cerneală în policromie indiferent de opțiune. Pentru aceste două formate, cardul și `lolly preflight` numără cele patru plăci de policromie și niciodată o placă pentru cerneală specială sau finisaj. Un finisaj ajunge în ele ca mască neagră pe placa de negru, iar cardul raportează asta ca eroare.

Un link cere același fișier cu `_spots=process`, linia de comandă cu `--spots=process`, [serverul MCP](/info/mcp.html) cu `spots: "process"`, iar aplicația de terminal cu rândul **Spot inks**. Nimic despre opțiune nu ajunge în fișier: se schimbă doar cernelurile.

### HDR (culori luminoase)

Cardul **HDR** din panoul de export face grafica obișnuită mai luminoasă pentru ecrane HDR. Pentru a păstra originalele HDR în timpul editării, vezi [Editare cu gamă largă de culori și HDR](/info/hdr-editing.html).

Un export obișnuit este sRGB: o culoare saturată a brandului este la fel de luminoasă ca albul normal al ecranului. Un ecran HDR poate fi mai luminos. Cardul **HDR** intensifică culorile brandului și textul alb spre luminozitatea maximă. Zonele întunecate rămân întunecate.

![Cardul HDR din panoul de export, activat, cu controalele White / Reach / Dark lift / Focus afișate dedesubt](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formate.** PNG, JPG, AVIF și TIFF. WebP este pe 8 biți, fără o cale funcțională de decodare HDR, iar vectorii și PDF nu au un model HDR.
- **Dezactivat implicit**, deoarece schimbă pixelii. Bifează cardul sau transmite `hdr=1` într-un link de partajare.
- **Controalele.** **White** (plafonul luminozității maxime, de la 400 la 2000 de niți), **Reach** (cât de mult se extinde strălucirea spre tonurile întunecate), **Dark lift** (cât se luminează zonele întunecate; `0` le păstrează întunecate) și **Focus** (cât din bogăția culorilor păstrează intensificarea). Sunt transmise ca o singură valoare: `hdr=1600-60-0-50` înseamnă White 1600, Reach 60, Dark lift 0 și Focus 50.
- **Ce se scrie.** PNG primește Rec.2100 PQ pe 16 biți cu un bloc `cICP`. JPG este un JPEG cu hartă de câștig ISO 21496-1: o imagine SDR obișnuită plus o hartă de câștig atașată. AVIF primește un bloc `colr` rescris. TIFF primește pixeli PQ cu un profil ICC v4 generat care conține o etichetă `cicp`. TIFF aplatizează pe negru, deoarece albul este codul de 10.000 de niți în PQ și ar pune un halou în jurul fiecărei margini. Intensificarea urmează luminozitatea perceptuală (OKLab) și păstrează nuanța, deci verdele unui brand devine mai luminos, nu mentolat.
- **Unde se vede strălucirea.** Vizualizatoare cu gestionarea culorilor pe un ecran HDR: Preview, Quick Look și Safari pe dispozitive Apple sau Chrome pe un monitor HDR. Un ecran SDR arată o imagine normală.
- **Din terminal.** `--hdr=1` cu `--export=png` sau `--export=jpg` scrie același PNG și JPEG cu hartă de câștig prin [CLI](/info/cli.html), cu aceleași codificatoare ale motorului, fără browser. AVIF și TIFF sunt deocamdată doar exporturi web.

::: warning Multe platforme elimină semnalul HDR
O platformă care recodifică fișierele încărcate poate lăsa imaginea întunecată sau spălăcită. Folosește HDR acolo unde controlezi destinația, precum propriul site, un perete video sau un deck pe un panou luminos.
:::

<!--i:eti-badge-check-->
## Ce însoțește fișierul tău

Un fișier terminat poate avea mai multe înregistrări. Unele stau alături de pixeli și dispar când fișierul este salvat din nou, capturat ca imagine de ecran sau curățat de metadate. Două marcaje sunt în pixeli.

::: figure exporting-what-travels
Unde se află fiecare înregistrare, dacă este activată implicit și ce parametru de link o controlează.
:::

Panoul de export pune **Licence**, **Source credits**, **Password**, **C2PA Credentials**, **Lolly Imprint** și **Durable credential** într-un singur grup **Content protection**, care arată doar cardurile pe care formatul ales le poate folosi. Grupul se deschide singur când un link sau un document declară deja o licență ori când o sursă are nevoie de decizia ta. Cardul **Design system** rămâne în afara grupului, la vedere la fiecare export.

![Grupul Content protection deschis pentru un export PNG, arătând doar cardurile care i se aplică](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Proveniență & filigran

Acolo unde formatul are câmpurile necesare, exporturile conțin **metadate de proveniență**: software-ul, sursa, numele instrumentului și linia de atribuire din profilul tău, scrise în PNG iTXt, JPEG EXIF, PDF info, SVG `<metadata>` sau un comentariu GIF. Sunt înregistrate doar informații despre autor. Nu se încarcă nimic. Instrumentele **Experimental** aplică și un filigran vizibil. Gazda aplică filigranul, deci editarea instrumentului nu poate elimina marcajul.

**Lolly Imprint** este un filigran invizibil în pixeli, **activat implicit**. Rezistă la recompresie, deci o copie poate fi recunoscută în continuare ca realizată cu Lolly. Este un indiciu, nu o garanție criptografică, și nu conține date personale. Este scris în JPEG XL, PNG, JPG, WebP, AVIF, TIFF și BMP și în imaginile raster pe care Lolly le randează într-un PDF sau PPTX, niciodată într-o imagine pe care ai încorporat-o. Debifează **Lolly Imprint** sau transmite `imprint=0` pentru a omite Imprint. Rezistența AVIF la recodificare nu este încă calibrată. [Lolly Verify](/#/verify) detectează Imprint pe dispozitivul tău; vezi [Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**Durable credential** scrie ID-ul Lolly în pixeli cu un model neuronal de pe dispozitiv, în formatul TrustMark, astfel încât legătura „realizat cu Lolly” să reziste la eliminarea metadatelor și la recodificare și să poată fi citită de instrumente compatibile cu TrustMark. Este **dezactivat implicit**, deoarece necesită o trecere prin modelul neuronal la fiecare export și o singură descărcare a modelului. Acoperă PNG, JPG, WebP, AVIF și TIFF. Bifează-l în panou sau transmite `durable=1`. Aplicațiile desktop și mobile ascund cardul, deoarece offline nu au o origine de unde să preia modelul.

**Licence.** Alege cum pot folosi alții munca ta: *None (all rights reserved)* implicit, CC0 1.0, Public Domain Mark 1.0 sau o licență Creative Commons 4.0 (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). Numele licenței și un link către rezumatul ei ajung în metadatele de licență ale fișierului (EXIF, XMP și RIFF acolo unde formatul le are) și în Content Credential. Alegerea se salvează cu documentul și călătorește într-un link ca `licence=`. Lolly scrie licența pe care ai ales-o. Lolly nu verifică și nu impune respectarea termenilor. Un instrument cu propriul câmp de licență, precum Claim, păstrează în schimb acel câmp.

### Înregistrarea sistemului de design

Un export înregistrează sistemul de design care a realizat fișierul: numele său, versiunea publicată din care a fost desenat (când aceasta nu este versiunea de lucru) și [colourway-ul](/info/colourways.html) în care a fost desenat. Orice altă alegere de temă declarată de un sistem de design, precum densitatea, este înregistrată la fel. Alegerea aspectului deschis sau închis este omisă, deoarece imaginea arată deja care a fost folosit.

**Vezi înregistrarea înainte să se scrie ceva.** Cardul **Design system**, bifat implicit, arată cuvintele exacte pe care le va conține fișierul, precum *Records: Acme · Colourway: Beach*, și descrierea. Numele unui sistem de design este ceea ce au tastat proprietarii lui, iar cardul îl arată așa cum a fost scris. Debifează cardul pentru a omite înregistrarea din acel export. Panoul documentului din Lolly Design listează aceleași cuvinte sub *Embedded in exports*.

**Descrierea arată colourway-ul lângă instrument.** Cu cardul bifat, *„Realizat cu https://lolly.tools : Chart”* devine *„Realizat cu https://lolly.tools : Chart (colourway Beach)”*. Numele propriu al sistemului de design rămâne în înregistrare, nu în descriere. O descriere fără numele instrumentului sau una pe care un instrument o scrie din propriile intrări rămâne neschimbată. Un instrument care ignoră colourway-urile prin `tokenAxes` nu înregistrează niciunul, iar atribuirea de pe proba PDF (marcajul de tipar `prov`) urmează aceeași regulă.

::: details Skill-uri de brand, pagini de brand și companii partenere în înregistrare
**Skill-uri de brand care au ghidat un agent.** Când un agent a realizat piesa și a numit [skill-urile de brand](/info/brand-skills.html) pe care le-a citit și urmat, înregistrarea listează și fiecare skill cu revizia lui, precum *Guided by: acme-brand 1.0*. Cuvintele înseamnă că skill-ul a ghidat munca. Lolly nu verifică piesa în raport cu un skill. Doar declarația agentului adaugă lista. În prezent, aceasta este argumentul `brandSkills` al `lolly_render` de pe [serverul MCP](/info/mcp.html), deci o piesă realizată în aplicație sau dintr-un link de partajare nu conține niciunul. Content Credential păstrează lista ca `brandSkills`, o valoare JSON cu ID-ul, numele, revizia și hash-ul SHA-256 al fiecărui skill. Pachetul XMP și metadatele SVG păstrează aceeași valoare ca `lolly:BrandSkills`. Un PDF scris din înregistrare primește un cuvânt-cheie pentru fiecare skill. Descrierea rămâne neschimbată. Textul unui skill intern nu este niciodată înregistrat. Aceleași comutatoare omit lista împreună cu restul înregistrării: cardul **Design system**, `_madewith=0`, `--no-madewith` și `madeWith: false`. Când serverul MCP desenează fișierul într-un browser (un PDF, un JPEG și celelalte formate pe care calea sa fără browser nu le poate scrie), metadatele proprii ale fișierului nu conțin nicio listă. Doar un Content Credential poate păstra lista acolo. Transmite `c2pa` pentru a păstra înregistrarea. Fără un certificat, randarea avertizează că skill-urile de brand nu au fost înregistrate.

**Pagina de brand, când editorul ei optează pentru asta.** Editorul unui sistem de design poate alege să înregistreze adresa [paginii sale de brand](/info/brand-page.html#lead-back-from-your-files) în exporturi. Setarea este specifică fiecărui sistem de design și este dezactivată implicit. Cardul adaugă apoi adresa pe aceeași linie, precum *Records: Acme · Colourway: Beach · Brand page: https://acme.example/brand/acme/*. Debifarea cardului elimină adresa împreună cu restul. Înregistrarea păstrează adresa și nimic altceva despre pagină. Nimic altceva din fișier nu se schimbă. Un sistem de design fără adresă scrie același fișier ca înainte.

**Adresa nu călătorește cu un pachet.** O înregistrare dintr-un fișier semnat este interpretată ca aparținând semnatarului. O adresă nu trebuie să se activeze singură pentru cineva care nu a ales-o, iar un pachet nu trebuie să poată direcționa fișierele altor persoane către o pagină aleasă de el. Un pachet `.lolly`, o copie sau o ramificație a unui sistem de design, **Try these colours**, o copie de rezervă restaurată și un fișier de tokenuri furnizat pentru o singură rulare sosesc toate cu setarea dezactivată. Poți activa singur setarea, cu o adresă pe care o tastezi. Un sistem de design gestionat este singura excepție: păstrează adresa pe care administratorul său a setat-o în tokenurile sursă. [Îndrumă spre brand din fișierele tale](/info/brand-page.html#lead-back-from-your-files) oferă detaliile.

**Compania parteneră, într-un program de parteneriat Lolly Work.** O piesă realizată pentru o companie parteneră înregistrează compania și programul ei pe aceeași linie, precum *Records: Acme · Colourway: Beach · Partner: Northwind IT (Resellers, EMEA)*, cu revizia datelor companiei în fișier. Înregistrarea nu conține nicio persoană, date de contact, adresă sau monedă. Cu kitul de partener al companiei atașat, linia adaugă revizia kitului, precum *, revizia kitului 2*, iar certificatul păstrează ID-ul și revizia kitului, niciodată culorile sau regulile lui. Debifarea cardului elimină partenerul împreună cu restul înregistrării. Un PDF primește cuvântul-cheie *Partner: Northwind IT*, iar [Lolly Verify](/info/what-verify-checks.html#partner) arată înregistrarea ca **Partner** ([Înregistrarea partenerului în fișiere](/info/manage/partner-programmes.html#the-partner-record-in-files)).
:::

**Citirea înregistrării din fișier.** [Lolly Verify](/#/verify) listează înregistrarea ca **Design system** în detaliile certificatului unui fișier și orice skill-uri de brand ca **Guided by**. O pagină de brand apare separat, ca [înregistrare a unei adrese de către semnatar](/info/what-verify-checks.html#brand-page). *Recreate with these settings* redeschide instrumentul în versiunea și colourway-ul înregistrate. Linkul se deschide cu sistemul de design înregistrat când acest dispozitiv deține unul cu același ID și nume; altfel se deschide cu sistemul tău de design activ.

::: details Ce se scrie unde și ce rulări omit înregistrarea
| Unde | Ce se scrie |
|---|---|
| Content Credential | `designSystem` (ID-ul), `designSystemLabel`, `designVersion` și `themes` în declarația `tools.lolly.export`, fiecare ca valoare text simplu; `themes` este o listă JSON a alegerilor. `brandPage` când editorul a optat pentru asta |
| PNG, JPEG, WebP și JXL | Aceleași valori ca proprietăți `lolly:` ale pachetului XMP al fișierului, în spațiul de nume `https://lolly.tools/ns/export/1.0/`. `lolly:BrandPage` când editorul a optat pentru asta |
| SVG | Aceleași proprietăți `lolly:` în blocul `<metadata>` |
| PDF | Cuvinte-cheie precum *Design system: Acme*, *Colourway: Beach* și, când editorul a optat pentru asta, *Brand page: https://acme.example/brand/acme/* |
| Orice format cu un câmp de descriere | Descrierea, cu colourway-ul lângă instrument |

Cardul apare doar când există ceva de înregistrat și formatul poate păstra înregistrarea. CSV, JSON, un fișier de calendar și alte formate de text sau de date nu conțin metadate, iar EPS, EMF, DXF și BMP nu au un câmp pentru înregistrare. HTML, Markdown și CSS păstrează înregistrarea doar în Content Credential, deci pentru ele cardul nu arată o linie de descriere și este ascuns cât timp **C2PA Credentials** este dezactivat. Un câmp pe care sistemul de design nu îl furnizează rămâne în afara fișierului.

Un link de partajare dezactivează înregistrarea cu `_madewith=0` ([Parametri URL](/info/url-parameters.html)). Linia de comandă acceptă `--no-madewith`, `lolly_render` de pe [serverul MCP](/info/mcp.html) acceptă `madeWith: false`, iar panoul de export al aplicației de terminal are un rând **Design system**. Linia de comandă afișează pe ieșirea standard de eroare cuvintele pe care le conține un fișier terminat, pentru randarea unui instrument și pentru fiecare fișier pe care `lolly run` îl exportă dintr-o sesiune Lolly Design salvată. O randare MCP afișează cuvintele lângă fișier. Ambele citesc cuvintele înapoi din fișier. Un PNG desenat de linia de comandă fără browser nu conține metadate de fișier, deci înregistrarea lui călătorește doar în certificat. Utilitarele de pe dispozitiv nu adaugă metadate.

Rulările fără cardul **Design system** omit înregistrarea: o rulare Lolly Batch, un folder exportat din Projects și un export de colecție 3D, iar în aplicația de terminal un lot CSV, un export de folder sau selecție Projects și vizualizarea de randare a tuturor elementelor. Exportă un fișier din instrument pentru a înregistra sistemul de design.
:::

### Content Credentials (C2PA)

Exporturile pot conține **Content Credentials**: un manifest [C2PA](https://c2pa.org) semnat care înregistrează ce a realizat fișierul, când și unde, legat de un hash al octeților fișierului, astfel încât orice editare ulterioară să poată fi detectată. Lolly scrie manifeste standard pe care orice cititor C2PA le poate inspecta.

![Cardul C2PA Credentials, bifat, cu durata de valabilitate a certificatului lângă caseta de bifare](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Activat implicit.** Cardul **C2PA Credentials** este bifat pentru aproape fiecare instrument. Debifează-l pentru un singur export sau transmite `c2pa=off` într-un link. Fișierul nu mai are atunci certificat, iar un SVG care include direct grafică însoțită de certificat, precum un logo din catalog, pierde și certificatul acelei grafici. Lolly Imprint și celelalte metadate ale fișierului rămân. Un instrument poate renunța la această funcție în manifestul său.
- **Formate.** PDF (RGB și Print), PNG și APNG, JPG, GIF, SVG și SVGZ, TIFF (RGB și Print), WebP (static și animat), AVIF, MP4, WebM, HTML, Markdown, CSS și containerele audio MP3, WAV, M4A, OGG/Opus și FLAC. Un ZIP aplică un certificat fiecărui element acceptat, astfel primește un Animated SVG un certificat. MP4, AVIF și M4A folosesc asocierea standard BMFF, iar MP3 maparea sa ID3v2, deci `c2patool` și alte cititoare le verifică. WebM și OGG/Opus nu au încă o mapare standard, deci Lolly păstrează manifestul ca atașament Matroska și câmp OpusTags, pe care verificatorul propriu Lolly le verifică. Un SVGZ este un SVG comprimat. Specificația C2PA nu definește o formă comprimată, deci certificatul este scris în SVG înainte de compresie. Verificatorul Lolly citește fișierul ca atare; `c2patool` citește același certificat după decomprimarea fișierului (`gunzip`). ICO, EPS, EMF, DXF, BMP, PPTX, formatele Office și celelalte formate de text și de date nu au un container C2PA.
- **Ce înregistrează.** Instrumentul și aplicația care au realizat fișierul, momentul semnării și mediul aplicației care a exportat fișierul. Pentru o pagină Lolly Design exportată ca imagine, SVG sau PDF, motorul de randare care a desenat pagina (`route` în declarația `tools.lolly.export`: `gpu` pentru motorul de randare GPU al paginii, `operations` pentru operațiile de desen scrise ca vectori, `compatibility` pentru motorul de randare propriu al browserului) și versiunea acelui motor (`renderer`: rețeta GPU, `design-draw-v` și versiunea sa sau `dom-to-image` și `dom-walker`). [Sistemul de design și colourway-ul](#the-design-system-record) cât timp cardul **Design system** este bifat. Setările active: alegerile din meniuri, numerele, comutatoarele și culorile ca atare, iar orice text tastat (titluri, nume, note, linkuri și date) doar ca amprentă, deci cuvintele nu sunt în fișier. Câmpurile legate de profil, controalele inactive, versiunile browserelor și detaliile sistemului de operare sunt omise. Numele și emailul tău apar ca autor doar când **Use my details to create** este activat în Settings → Preferences → Your details. Sursele pe care le plasează un export călătoresc ca ingrediente. Fiecare imagine de pe pagină care are propriul Content Credential este înregistrată ca o componentă a paginii, cu acel certificat și orice tip de sursă AI pe care îl declară. Acest lucru este valabil într-un PNG, JPEG, WebP, AVIF, TIFF, SVG sau PDF și într-un GIF, APNG, WebP animat, MP4 sau WebM când imaginea este desenată în cel puțin un cadru din intervalul exportat. Singura imagine pe care un instrument precum Darkroom, Filter sau Asset Export o modifică este înregistrată în schimb ca părinte al fișierului, deschisă mai întâi și urmată de ce a făcut instrumentul imaginii. Alte ingrediente sunt [lucrări atribuite](#source-credits), precum emoji, [melodii Lolly Rondocode](/info/rondocode.html#songs-in-the-credential) dintr-un export video sau audio și [melodii salvate](/info/generated-music.html#what-a-track-records) dintr-un export video sau audio. Fiecare melodie salvată are numele ei, licența când melodia înregistrează una, SHA-256 al rețetei sale, versiunea motorului și mențiunea de conținut media algoritmic. Creatorul unei melodii salvate (numele de profil cu care a fost salvată) este adăugat doar cât timp **Use my details to create** este activat, la fel ca numele tău. Doar atunci panoul de export arată creatorul înainte să exporți.
- **O aprobare, când a fost înregistrată una.** Un fișier aprobat prin [Lolly Work](/info/work-approvals.html#review-an-exported-file) poate conține o a doua înregistrare semnată peste acest certificat: ID-ul aprobării, data deciziei și amprenta fișierului verificat. Nu conține nume, emailuri, grupuri, comentarii sau nume de lanțuri. Este bifată implicit în dialogul de solicitare și poate fi debifată pentru o singură solicitare sau dezactivată pentru o instanță. Înregistrează faptul că un semnatar a declarat o decizie. Nu spune că lucrarea îndeplinește vreun standard.
- **Ce i s-a cerut să facă, pentru un fișier realizat dintr-o [intenție](/info/visual-intent.html#what-goes-in-the-file).** Scopul, suprafața, instrumentul, limba, versiunile regulilor și vocabularului și amprenta intenției. Ocazia, publicul, regiunea și promptul sunt doar amprente, cu excepția cazului în care persoana sau agentul care execută randarea cere să fie înregistrate cuvintele promptului. Doar o randare pornită de la o intenție conține această înregistrare. Rularea spune ce a înregistrat, iar înregistrarea poate fi omisă.
- **Ce văd destinatarii.** Instrumente C2PA precum aplicațiile Adobe, `c2patool` și contentcredentials.org/verify citesc manifestul și arată declarația. Lolly semnează cu o cheie creată pe dispozitivul tău, nu cu un certificat dintr-o listă de încredere, deci vizualizatoarele raportează un certificat *neverificat*. Structura și dovezile modificării sunt valide, dar nimeni nu garantează identitatea semnatarului. Pentru a schimba asta, înregistrează o **identitate verificată** în Settings → Preferences → Content Credentials; vezi [Identitate Content Credentials](/info/content-credentials-identity.html).
- **Verificarea unui fișier.** Trage orice fișier peste [Lolly Verify](/#/verify) sau rulează `lolly validate <file>` pentru un raport pe dispozitiv care începe prin a spune dacă Lolly a realizat fișierul și dacă acesta s-a schimbat de atunci. Lolly Verify verifică și dincolo de certificat; vezi [Ce verifică Lolly Verify](/info/what-verify-checks.html).
- **Confidențialitate.** Cheia de semnare este creată pentru export și nu părăsește niciodată dispozitivul tău. Declarația conține doar ceea ce metadatele de proveniență conțin deja. Utilitarele de confidențialitate care transformă fișierele tale nu adaugă certificat, iar *Lolly Strip Hidden Data* elimină un manifest C2PA ca pe orice alte metadate. Utilitarul Rondocode creează conținut audio nou, deci semnează ceea ce scrie ([Melodii Lolly Rondocode](/info/rondocode.html#files-from-the-rondocode-utility)). Generatorul de muzică semnează fiecare descărcare WAV sau M4A. Certificatul înregistrează faptul că generatorul de muzică Lolly a creat piesa și licența sub care este disponibilă muzica, CC BY 4.0, cu atribuirea ei ([Ce înregistrează o piesă](/info/generated-music.html#what-a-track-records)).
- **Interacțiuni.** Un PDF protejat cu parolă nu poate conține Content Credentials, la niciunul dintre niveluri. Certificatul este adăugat la final, peste octeții terminați, după DPI, EXIF, profilul de culoare, metadatele PDF/X și marcajele de tipar.

### Atribuirea surselor

Un export care plasează lucrarea altcuiva înregistrează acea sursă în certificat. Cazul obișnuit este un emoji din setul de emoji ales: lucrarea, creatorul ei, licența, proveniența octeților exacți și ce s-a schimbat călătoresc toate cu fișierul. Textul dintr-un instrument al cărui șablon este un SVG păstrează emoji-urile proprii ale sistemului, deci acolo nu se adaugă nicio atribuire. Înainte să descarci, rândul **Source credits** spune ce cer sursele pentru livrare. După descărcare, rândul citește înapoi octeții livrați înainte să spună că atribuirile sunt în fișier. O licență care îți cere să alegi, precum un glif CC BY-SA recolorat pe care urmează să-l partajezi, primește un card cu opțiuni. Descărcarea nu este niciodată blocată. [Drepturi de creație și atribuiri](/info/creative-rights.html) prezintă formulările, licențele analizate și ce rămâne al tău.

<!--i:eti-lock-->
## Protecție prin parolă

Lolly creează două tipuri de blocare, ambele pe dispozitivul tău. Cardul **Password** din panoul de export le setează pe amândouă.

![Cardul Password extins pentru un export PDF, cu câmpul de parolă și cele două niveluri de blocare](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**O parolă de deschidere a PDF-ului** are două niveluri după ce tastezi o parolă:

- **Weak**: RC4 pe 40 de biți, pentru `pdf` RGB fără marcaje de tipar sau bleed și parole ASCII simple. O parolă cu alte caractere trece la Strong, deoarece cititoarele nu pot deschide un fișier blocat astfel la acest nivel. Contează doar primele 32 de caractere.
- **Strong**: AES-256 (PDF 2.0). Se aplică și fișierelor Print PDF și fiecărui PDF dintr-un ZIP de lot. Un Print PDF blocat cu Strong își păstrează CMYK, marcajele și intenția de ieșire, dar renunță la declarația PDF/X-4.

::: warning Weak descurajează accesul, dar nu oferă protecție
Folosește **Strong** pentru un fișier confidențial.
:::

**Un ZIP blocat** acoperă un export ZIP, descărcarea unui folder din Projects sau un lot, cu o singură parolă la două niveluri: **Weak** (ZipCrypto, pentru descurajare) sau **Strong** (AES-256). Parola protejează fiecare element. Orice PDF din interior este blocat și separat cu AES-256, deci PDF-ul rămâne blocat după dezarhivarea ZIP-ului. Solicitarea apare când începe descărcarea. O parolă goală înseamnă fără blocare.

**O parolă tastată rămâne în afara linkurilor la ambele niveluri.** Dacă un fișier sosește printr-un link `?password=`, Lolly citește valoarea și o elimină imediat din adresă. Un link care cere o blocare pe care fișierul său nu o poate avea nu scrie niciun fișier și spune de ce (vezi [`password`](/info/url-parameters.html)).

**Un link de partajare protejat prin parolă** cere destinatarului o parolă înainte să se deschidă. Starea linkului este criptată cu AES-256 folosind o cheie derivată din parolă (PBKDF2). Călătorește doar textul cifrat, iar decriptarea are loc în browserul destinatarului. Serverul care servește linkul nu vede niciodată parola sau designul. Activează opțiunea în dialogul **Share**. Un link criptat se deschide doar în Lolly, niciodată ca imagine încorporată. Vezi [Modul URL](/info/url-mode.html).

<!--i:eti-monitor-->
## Pe telefon

Controalele de export se află în spatele butonului plutitor **Export**, care deschide panoul **Export**: aceleași formate, dimensiuni, copiere, descărcare și partajare, dimensionate pentru atingere.

<!--i:eti-code-->
## ID-uri de format pentru linkuri și CLI

Acestea sunt valorile pentru parametrul URL `format=` și opțiunea CLI `--export=` (vezi [Parametri URL](/info/url-parameters.html) și [CLI](/info/cli.html)). Meniul unui instrument arată doar formatele pe care acel instrument le poate produce.

| Tip | ID-uri |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vector | `svg` · `svgz` (SVG comprimat cu gzip) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (fișier pentru tăiere) |
| Pagină și document | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (fișier de design Penpot) · `scorm` (pachet de curs, un ZIP) |
| Mișcare | `gif` · `apng` (PNG animat) · `webp-anim` (WebP animat) · `svg-anim` (SVG animat) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| Audio | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` · `mid` (note MIDI, din Lolly Rondocode) |
| Text și date | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `ttml` · `scc` · `css` · `scss` · `gpl` (paletă GIMP) |
| Arhive și pachete | `zip` · `rpm` și `tar.gz` (randarea sigilată într-un pachet Linux) |

Câteva ID-uri provin din codul de export propriu al unui instrument: `ase` (Adobe Swatch Exchange, din Lolly Palette Lab), precum și `exr` și `hdr` (imagini raster cu gamă dinamică ridicată, din Lolly Darkroom). **Convert Font** scrie `ttf`, `otf` și `woff` dintr-un fișier de font pe care îl furnizezi, deci un link simplu nu îi oferă instrumentului nimic de randat.
