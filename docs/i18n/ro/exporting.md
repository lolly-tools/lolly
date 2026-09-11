# Export și formate

Cum să obții un fișier finalizat dintr-un tool - alegerea formatului potrivit, setarea dimensiunii de ieșire și ce face fiecare opțiune. Ca orice altceva, **exportul se face pe dispozitivul tău**; nimic nu e încărcat pe server.

## Cum funcționează exportul

Previzualizarea *este* fișierul. Când exporți, host-ul randează acel canvas în formatul ales și îți dă un download (sau îl pune pe clipboard). Un tool oferă doar formatele pe care autorul lui le-a declarat, iar selectorul ascunde orice format pe care browserul tău nu-l poate produce (vezi [Video](#video)).

Trei căi produc un fișier. Majoritatea tool-urilor **randează canvasul** în formatul ales. Formatele de text și date (HTML, MD, TXT, JSON, CSV, ICS, VCF) sunt în schimb **generate din conținutul tool-ului**, nu rasterizate din imagine. Iar utilitarele de confidențialitate (de ex. *Strip Hidden Data*) folosesc o a treia cale: fișierul pe care *tu* îl alegi este transformat byte cu byte pe dispozitiv și înapoiat direct - fără canvas, fără watermark și fără metadate de proveniență adăugate, pentru că e deja fișierul tău.

Acțiunile din controalele de export:

- <!--i:download--> **Download** - salvează fișierul (acțiunea principală).
- <!--i:photos--> **Copy** - pune imaginea pe clipboard pentru a o lipi direct în Slack, email, un document. Unde un browser nu poate copia imagini, descarcă în schimb și te anunță.
- <!--i:folder--> **Save** - păstrează designul curent ca sesiune de tool salvată în biblioteca ta.
- <!--i:link--> **Share** - deschide **dialogul Share**: un link copiabil care reproduce designul, comutatoare la vizitare (fullscreen, panoul de export, descărcare sau copiere la deschidere) și un opțional **Shortest link** care împachetează întreaga stare într-un token compact (vezi [URL Mode](/info/url-mode.html)).

(Autorul unui tool alege care dintre acestea apar; setul implicit este Copy, Download și Save.)

![The export panel - format, size and the Copy / Download / Save / Share actions](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Share se deschide peste tool, cu linkul deja construit și comutatoarele la vizitare dedesubt.

### Randarea mai multor deodată

Un export unic e un singur fișier, dar poți randa **mai multe** dintr-o singură trecere - fiecare livrat ca un singur `.zip`:

- <!--i:folder--> **Projects → Render folder** exportă fiecare sesiune salvată dintr-un folder (și subfolderele lui) ca un singur zip imbricat; **Render selection** face același lucru pentru orice selecție multiplă; o singură sesiune salvată se randează direct în propriul fișier. Nu e nevoie de Batch/Pro - vezi [Using Lolly → Projects](/info/using.html).
- <!--i:layers--> **Batch (Pro)** randează o grilă de seturi de intrări - fiecare variantă a unui template deodată.

O sesiune salvată poate fi de asemenea partajată din nou ca link de tool din Projects (reconstruiește URL-ul tool-ului din intrările salvate), astfel încât un link îl redeschide cu exact aceleași setări.

## Alegerea unui format

Câmpul de nume de fișier și selectorul de format stau în partea de sus a panoului ca o singură pereche `nume.format`, iar selectorul listează doar formatele pe care le-a declarat autorul acestui tool.

![The filename field fused to the format picker, so the export reads as one name.format pair](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

| Vrei… | Folosește | De ce |
|---|---|---|
| Logo-uri / grafică clară care se scalează | **SVG** | Vector - se scalează la infinit, mic, editabil |
| Vector pentru aplicații Office / Windows | **EMF** | Se lipește ca vector editabil în PowerPoint / Word; textul rămâne activ și editabil, iar Google Drive îl deschide în Google Drawings pentru Slides |
| Vector pentru tipar / aplicații de design | **EPS**, sau **EPS (CMYK)** | Vector PostScript pentru Illustrator / fluxuri de tipar |
| Vector pentru mașini de tăiat / CAD | **DXF** | Aparate de tăiat cu laser, plottere de vinil, CNC - trasee de contur în milimetri |
| Un set de diapozitive editabil | **PowerPoint** (PPTX) | Text nativ editabil + forme, cu imagini și vectori care rămân extractibili |
| Un curs pe care un LMS îl poate importa | **SCORM** (LMS) | O arhivă zip cu manifestul, o pagină de lansare, diapozitivele și filmul narat cu subtitrări - dintr-un set de diapozitive Design |
| Un document text editabil | **Word** (DOCX) sau **OpenDocument** (ODT) | Paragrafe și titluri reale pe care un procesor de texte le poate continua să le editeze (Doc Studio) |
| O fotografie sau o imagine de uz general | **PNG** (fără pierderi) sau **JPG** (mai mic) | Raster universal |
| Imagini moderne mai mici | **WebP** / **AVIF** | Compresie mai bună, alpha |
| Tipar | **PDF**, sau **Print PDF** (CMYK) | Dimensiune reală a paginii; CMYK pentru tipar |
| Raster de tipar pentru o tipografie | **Print TIFF** (CMYK) | Pixeli DeviceCMYK pentru un RIP |
| Animat pentru web | **GIF** | Funcționează peste tot, fișiere mai mari |
| Animat cu culoare completă + alpha real | **APNG** | PNG animat - fără limită de paletă, transparență reală |
| Animat, cel mai mic fișier | **WebP animat** | Culoare completă + alpha, comprimat mai bine decât GIF sau APNG |
| Vector animat care se scalează | **SVG animat** | Autonom; se repetă într-un browser sau `<img>`, fără codec, orice dimensiune |
| Video pentru social / partajare | **MP4** sau **WebM** | Cel mai bun raport calitate-per-byte (vezi mai jos) |
| Text bogat / semnătură de email | **HTML** | Se lipește formatat în clienții de email |
| Conținut simplu | **MD** / **TXT** | Doar text |
| Un eveniment de calendar | **ICS** | Se importă în orice aplicație de calendar |
| O carte de vizită | **VCF** | Se importă în Contacte / agende de adrese |
| Date structurate de reimportat | **JSON** / **CSV** | Face un tur complet al conținutului instrumentului |
| Un favicon | **ICO** | Iconiță de site cu mai multe dimensiuni (**ZIP** grupează mai multe formate) |

Primul rând e cazul comun. Un wordmark scris în fontul brandului tău se exportă ca SVG, unde fiecare literă e un traseu conturat, nu un pixel, așa că rămâne clar la dimensiunea unei cărți de vizită și la dimensiunea unui wrap de clădire, din același fișier.

![A hairline wide-tracked wordmark reading Aurora, the kind of pure vector artwork the SVG row of the table is about](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-wordmark-vector)

## Dimensiune și unități de tipar

Implicit, exporturile folosesc dimensiunea nativă în pixeli a tool-ului. Unde un tool expune **dimensiuni**, poți seta lățime × înălțime și o **unitate**:

- **px** (implicit) - pixeli exacți.
- **mm · cm · in · pt · pc** - dimensiuni fizice/de tipar. Cu o unitate fizică setezi și **DPI** (implicit **300** pentru tipar); motorul convertește corect pentru fiecare format - **PDF** devine o pagină reală la acea dimensiune, **raster** se randează la numărul corect de pixeli pentru DPI (și încorporează rezoluția), **SVG** păstrează unitatea fizică cu un viewBox în px.

Pentru un raster de rezoluție mai mare, introdu o lățime/înălțime mai mare, sau alege o unitate fizică și crește DPI-ul (pixeli = dimensiune × DPI). Nu există un comutator de scalare dintr-un clic.

Exemplu: lățime `210`, înălțime `297`, unitate `mm` → o pagină A4.

![The dimensions row set to 210 by 297 mm, with the DPI field revealed because the unit is physical](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Cadre statice dintr-o compoziție cronometrată

O **compoziție cronometrată** - o cronologie [Sequence](/info/using.html#timeline-sequence) în Design, sau orice planșă condusă de o cronologie - este ceva în mișcare, așa că o exportare statică trebuie să răspundă la întrebarea „care moment?”. Regula este cea la care te-ai aștepta: **cadrul de la capul de redare**. Poziționează capul de redare unde vrei imaginea și exportă; ce vezi este ce iese.

Când vrei mai mult de un moment, câmpul **Frames** apare lângă dimensiunea de ieșire (doar pentru o compoziție cronometrată, și doar pentru un format static - PNG, JPG, WebP, SVG sau PDF). Lasă-l la `1` pentru cadrul de la playhead. Ridică-l și obții atâtea cadre statice, eșantionate la intervale egale de-a lungul întregii secvențe:

- **Raster și SVG** revin ca un singur **zip** - `<name>-01.png`, `-02.png` și așa mai departe.
- **PDF** revine ca un **document unic cu atâtea pagini**.

Util pentru un storyboard, o foaie de miniaturi, o foaie de contact pentru revizuire sau un carusel social decupat direct dintr-un montaj video.

Eșantionarea se face la **mijlocul** fiecărui interval, nu la margini, pentru că prima clipă a unei secvențe e adesea o tranziție de intrare care încă nu s-a stins, iar ultima e starea de după ce fiecare clip s-a încheiat - eșantionarea la capete ar irosi două dintre cadrele tale pe unele aproape goale. Numărul e limitat la **64** (o foaie de contact e făcută să fie citită de un om), iar orice e introdus fără sens în câmp revine implicit la `1` în loc să eșueze exportul. Fiecare cadru e un export static obișnuit, așa că Content Credentials, imprint-ul, unitățile fizice și DPI se comportă exact ca la un export unic.

Câmpul **Frames** este modul de a obține o foaie astăzi. Motorul rezervă un parametru URL `cuts` corespunzător, dar niciun shell nu-l citește încă dintr-un link, așa că un link partajat se redeschide mereu la cadrul de la playhead - vezi [URL Mode](/info/url-mode.html#contact-sheets-cuts).

## PDF multi-pagină

Unele instrumente construiesc un **document PDF cu mai multe pagini** în loc de o singură lucrare grafică - o copertă, conținut care curge pe câte pagini are nevoie și o pagină din spate, toate într-un singur fișier (vezi instrumentul *Booklet*). Fiecare pagină este o **pagină PDF reală**, dimensionată la caseta acelei pagini, astfel încât cititorii și tipografiile primesc pagini reale, nu o singură imagine lungă.

- **Pagini din conținut.** Adaugi blocuri de text și imagini; paginile noi se creează automat pe măsură ce blocurile se umplu, și poți forța orice bloc să înceapă o pagină nouă.
- **Dimensiuni de pagină reale.** Alege A4, US Letter sau A5 (portret - layout-ul pe două coloane e construit pentru asta) - fiecare pagină, și PDF-ul exportat, se randează la exact acea dimensiune.

PDF-urile cu mai multe pagini sunt documente RGB și nu poartă marcaje de tăiere/sângerare - acestea aparțin traseului **Print PDF** de mai sus, cu o singură pagină. Ele poartă totuși aceleași **metadate PDF/X-4** ca orice export PDF (casete de pagină, XMP, ID de document, un intent de ieșire sRGB cu profil încorporat) și oferă **Content Credentials** (mai jos) - pe instrumentul *Booklet* opțiunea este preselectată.

## Realizarea mai multor lucruri deodată

Lolly are trei moduri distincte de a lucra la volum, și ele rezolvă probleme diferite - editarea în lot e o capabilitate de prim rang a platformei, nu ceva ce fiecare tool reinventează:

- <!--i:document--> **Un design × un tabel de rânduri → un document multi-pagină.** Tool-urile cu o intrare `table` (precum *Battlecards*) transformă automat fiecare rând într-o pagină - lipești un tabel din foaia ta de calcul, obții un PDF de mărimea unui deck. Editorul tău real de loturi rămâne foaia de calcul: repari zece rânduri acolo, lipești din nou. Tool-ul în sine nu gestionează niciodată paginile.
- <!--i:layers--> **Un design × un fișier de date → multe fișiere separate.** Grila de loturi `/pro` ia un CSV și randează un export *per rând* - ecusoane cu nume, certificate, câte un fișier fiecare.
- <!--i:sliders--> **Multe active diferite, editate unul lângă altul.** *Multi-edit* deschide mai multe sesiuni salvate într-o singură vizualizare pentru retușuri coordonate pe designuri distincte.

Regulă practică: rânduri ale aceluiași design care aparțin într-**un document** → un tool condus de tabel; rânduri care trebuie livrate ca **fișiere separate** → `/pro`; **designuri diferite** care au nevoie de aceeași ajustare → multi-edit. (O opțiune de randare "combine media" planificată va face legătura între primele două - concatenând exporturi de același format într-un singur PDF, un singur video sau o foaie de contact pentru verificare.)

## PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart și Diagrams pot exporta un **set de diapozitive PowerPoint** - un diapozitiv per pagină. Ideea nu este o captură de ecran perfectă pixel cu pixel; este să dai unui coleg un set de diapozitive pe care chiar poate **să îl editeze și să extragă resurse din el**. Așa că fiecare pagină este descompusă în obiecte native:

- <!--i:font--> **Textul** devine casete de text PowerPoint reale, **editabile** - cu dimensiunea fontului, culoarea, grosimea, cursivele și alinierea din layout - ca să poți corecta o greșeală de tipar sau restiliza direct în PowerPoint.
- <!--i:pentool--> **Vectorii** (logo-uri, iconițe, marca SUSE) sunt încorporați ca **imagini SVG reale** - rămân clare la orice dimensiune, iar PowerPoint poate chiar să aplice *Convert to Shape* pe ele.
- <!--i:photos--> **Imaginile** vin la rezoluția lor nativă ca imagini proprii, extractibile (o imagine hero decupată cu `cover` păstrează imaginea completă din spatele decupajului, ca s-o poți reîncadra), cu orice tratament aplicat pe imagine (filtre, blend-uri) fixat fidel.
- <!--i:layers--> **Fundalurile, chenarele și liniile** devin forme reale de dreptunghi/linie.

![Panoul de export cu PowerPoint selectat: un diapozitiv per pagină, text și forme păstrate editabile](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Layout-ul este aproximativ prin design - obiectivul este **conținut** fidel și reutilizabil, nu o captură de ecran blocată. Tot ce walker-ul nu poate exprima nativ (o regiune complexă filtrată sau mascată) este încorporat ca imagine, ca să nu se piardă nimic. Un deck are o singură dimensiune de slide, preluată din prima pagină.

PowerPoint este de asemenea o cale **de intrare**. Plasează un `.pptx` pe orice suprafață de încărcare și alege diapozitivele dorite - fiecare devine o resursă de plasat, tratat sau pe care poți construi mai departe. **Markdown Slides** scrie un set de diapozitive nou din Markdown (și oferă un șablon `.pptx` cu identitate de brand), iar utilitarul **Rebrand** rebranduiește un set de diapozitive existent pe loc - paleta temei, culorile și fonturile codificate direct - fără să atingă graficele, SmartArt sau animațiile, returnând un `.pptx`. Vezi [Import a design → Decks and documents](/info/design-import.html#decks-and-documents).

## Penpot

Orice instrument care poate exporta SVG poate exporta și un **fișier Penpot** (`.penpot`) - documentul, gata de continuat editarea în Penpot, nu doar de privit.

- <!--i:layout--> Din **Design**, fiecare cadru devine un **board** Penpot, fiecare casetă de pe el se transferă ca formă proprie editabilă - dreptunghi, elipsă, text, imagine sau traseu - iar rezultatul ajunge ca o **componentă** reutilizabilă în panoul Assets, gata de tras din nou afară.
- <!--i:pentool--> Dintr-un instrument al cărui randare este **geometrie simplă** - instrumentele vectoriale precum QR Code, Street Map, Wordmark și Palette Lab - fiecare traseu, dreptunghi, rând de text și gradient se transferă la fel, ca formă proprie editabilă.
- <!--i:font--> Dintr-un instrument care își așază randarea în **HTML**, **textul rămâne text** - un obiect de text Penpot editabil per rând, nu un contur și nu o imagine plată. O lucrare grafică pentru care Penpot nu are un construct - o ilustrație complexă, un canvas live - se transportă pe cont propriu ca imagine, astfel încât textul și casetele din jurul ei nu sunt niciodată aplatizate. Un întreg layout pe care Penpot nu îl poate separa fidel poate totuși ajunge ca o singură imagine la fidelitate completă, așa că nimic nu se pierde vreodată.
- <!--i:palette--> O culoare sau un font pe care o formă îl **moștenește dintr-un token de brand** rămâne **legat** de acel token în fișier: schimbă tokenul în panoul Tokens al Penpot și fiecare formă care îl moștenește se repictează împreună, în timp ce o culoare literală, unică, rămâne exact acolo unde este. Culorile și tipografiile brandului ajung și ele în panoul **Assets**, iar întregul set de tokenuri de design în panoul **Tokens** - același set de tokenuri DTCG pe care îl folosește paleta proprie a Lolly. De acolo Penpot își păstrează propria copie: o modificare făcută în panoul lui Tokens revine în brand prin [importul din Brand Studio](/info/design-import.html), nu de la sine.

| Ce ai făcut | În Penpot |
|---|---|
| Text | Obiecte de text editabile - corectezi o greșeală sau restilizezi |
| Forme, trasee, gradienturi, imagini | Propriile lor forme vectoriale editabile |
| O culoare sau un font dintr-un token de brand | O legătură live la token - editezi tokenul, fiecare formă care îl moștenește urmează |
| Întregul design | O componentă reutilizabilă în panoul Assets |
| O ilustrație complexă sau un canvas live | Încorporată pe cont propriu ca imagine, conținutul editabil din jurul ei rămâne neatins |

![Panoul de export cu Penpot selectat: fișierul .penpot, și Send to Penpot lângă butonul de descărcare](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Ca să îl deschizi, pornește Penpot, alege un proiect și selectează **Import**. Autentificat în Penpot din panoul de export, **Send to Penpot** face acest pas pentru tine - alegi un proiect acolo, iar fișierul ajunge direct în el.

## SCORM (pachete de curs)

Un set de diapozitive Design poate pleca ca **pachet SCORM** - arhiva zip pe care o importă un sistem de management al învățării, fie că este Moodle, Canvas, Blackboard sau un LMS corporativ. Alege **SCORM (LMS)** în selectorul de format, iar exportul scrie:

- <!--i:layout--> **Diapozitivele**, o imagine per planșă, ca vector acolo unde planșa permite și ca pixeli doar unde nu permite.
- <!--i:play--> **Filmul narat**, cu pista lui de subtitrări - notițele vorbitorului citite de o voce pe dispozitiv, exact așa cum le redă [Presenting](/info/create/using.html#presenting).
- <!--i:file--> **O pagină de lansare** care parcurge diapozitivele, redă filmul și raportează finalizarea înapoi la LMS prin mediul de execuție SCORM 1.2, versiunea pe care o acceptă orice LMS.
- <!--i:font--> Fonturile folosite de setul de diapozitive, astfel încât pagina de lansare se randează la fel offline.

![Panoul de export pe un set de diapozitive Design cu SCORM (LMS) selectat](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Nimic din pachet nu comunică spre exterior: sunt fișiere într-o arhivă zip, iar acesta rulează în interiorul LMS-ului fără bundler, fără CDN și fără cont. Aplicațiile web și desktop îl construiesc; CLI-ul nu, pentru că fotografierea planșelor și codarea filmului au nevoie de browser.

## DXF (fișiere de tăiere)

Instrumentele vectoriale (Brand Lockup, QR Code, Street Map, Wayfinding Signage, Pose Geeko, variantele de logo, Diagram Builder) pot exporta în **DXF** - formatul de schimb AutoCAD R12 pe care îl citesc mașinile de tăiat laser, plotterele de vinil și software-ul CNC/CAD. Geometria este scrisă ca **căi de contur în milimetri** (curbele sunt aplatizate cu o toleranță fină), textul este transformat în căi de contur, iar culoarea se mapează la cel mai apropiat AutoCAD Color Index (care de obicei controlează instrumentul/operația pe o mașină de tăiat). DXF este doar grafică de linie - o regiune fotografică sau filtrată nu are o formă de cale de tăiere și este eliminată (Lolly avertizează), așa că folosește SVG/PDF când trebuie să păstrezi conținut raster.

Street Map este cazul cel mai clar: întregul design este deja format din trasee, așa că fiecare drum și canal devine o cale de tăiere, fără nimic de eliminat.

::: showcase
![Un render Street Map al Parisului în cerneală pe crem - artă pur lineară, așa că fiecare traseu supraviețuiește drumului până la un plotter de tăiere](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Derulează, iar camera se retrage prin geometria efectivă: șapte căi, fără niciun pixel nicăieri, fiecare traseu clar ca un fir de păr la orice zoom. Acesta e exact fișierul citit de un plotter de tăiere.
:::

## SVG animat

Uneltele de mișcare (Animated Ad, Lottie Ad) pot exporta **SVG animat** - o animație *vectorială* de sine stătătoare. Spre deosebire de GIF/APNG/WebP (care eșantionează fiecare cadru în pixeli), un SVG animat stivuiește instantanee vectoriale cu keyframe-uri CSS încorporate, deci **se scalează la orice dimensiune fără codec și fără runtime extern** - rulează într-un tab de browser sau într-un `<img>`. Textul rămâne conturat, ca să se randeze oriunde. Împarte controalele de **Durată** / rată de cadre cu celelalte formate animate și (fiind mai greu per cadru decât un bitmap) folosește o rată de cadre implicită mai mică.

## Transparență

Uneltele care o suportă oferă un comutator de **fundal transparent** (de ex. *No BG*). Transparența este păstrată de PNG, WebP, AVIF, SVG (static și animat), APNG și WebP animat. JPG și PDF sunt mereu opace, iar TIFF se aplatizează pe alb (pe negru pe calea HDR - vezi mai jos).

## Spații de culoare

Două întrebări diferite, bine de ținut separat: ce spații de culoare poate Lolly să **citească și în care poate gândi**, și pe care le **scrie**.

**Citire.** Oriunde e scrisă o culoare - foaia de stil a unei unelte, vopseaua unui SVG importat, valoarea unui token de design, o umbră sau un gradient în interiorul unei prescurtări CSS - Lolly citește întregul vocabular **CSS Color 4**: `#hex`, `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, culorile numite CSS și `color()` în spațiile predefinite - `srgb`, `srgb-linear`, `display-p3`, `a98-rgb`, `prophoto-rgb`, `rec2020`, `xyz-d50`, `xyz-d65` - inclusiv componente scrise ca cuvântul-cheie `none`. Un singur parser face asta pentru întreaga platformă, deci browserul și fiecare walker de export sunt de acord asupra sensului unui șir de culoare.

Asta contează mai mult decât pare, pentru că un browser rezolvă CSS modern în CSS modern. Scrie `color-mix(in oklab, …)` și Chrome calculează `oklab(…)`; folosește un token de brand stocat ca `oklch()` și aceea e valoarea literală pe care o vede walker-ul de export. Culorile în aceste forme sunt citite corect, nu eliminate - ceea ce făcea un walker care înțelegea doar `rgb()`, exportând text colorat cu brandul ca negru, pierzând panouri nuanțate și linii de tabel și citind `oklch(0.7 0.1 200) 0px 2px 4px` ca un offset de umbră de 0.7 pe 0.1.

**Raționament.** Matematica culorii se întâmplă perceptual, nu pe canale brute. Derivarea paletei, rampele, armoniile și contrastul rulează în **OKLCH/OKLab**, iar o culoare din afara gamutului este adusă în interval prin propriul algoritm de mapare a gamutului al CSS Color 4 - reducere de crominanță cu o verificare de distanță perceptuală - în loc de tăierea canalelor, astfel încât o culoare vie se stabilizează la cea mai apropiată culoare pe care ai accepta-o de fapt, în loc de una aplatizată. Gradientele interpolează într-un spațiu pe care îl alegi (OKLab implicit, sau `oklch`, `lab`, `lch`, `srgb`, `srgb-linear`, `hsl`, cu o direcție de deplasare a nuanței pentru cele polare), iar amestecarea este **premultiplicată**, astfel încât o estompare spre transparență păstrează culoarea corectă în loc să se întunece spre negru pe parcurs. Un singur interpolator deservește atât previzualizarea, cât și walker-ele de export - ceea ce a oprit un gradient conic să fie amestecat într-un fel pe ecran și altfel în fișierul exportat.

**Scriere.** Ieșirea este deliberat mai îngustă decât intrarea, pentru că un fișier trebuie să fie lizibil de orice îl deschide, iar un spațiu este *declarat* la ieșire doar când numerele au fost efectiv convertite în el. Formatele de ecran și web sunt scrise ca **sRGB** și etichetate ca atare; formatele de tipar sunt scrise ca **CMYK** față de o condiție de tipar denumită (mai jos); iar calea HDR este **Rec.2100 PQ** (mai sus). O culoare cu gamă largă care ajunge la un export este mapată în sRGB, nu etichetată greșit - purtarea `color(display-p3 …)` mai departe într-un fișier vectorial este o extensie planificată, nu ceva ce exporturile de azi pretind că fac. Un gradient creat în OKLab este *copt* în puncte sRGB simple la ieșire, cu puncte suplimentare inserate doar unde sRGB ar diverge vizibil de curba perceptuală, pentru că un `<linearGradient>` SVG și o umbrire axială PDF nu au niciun setaj de spațiu de interpolare care să poarte intenția. O singură valoare autorizată, trei renderere, fără derivă.

## Profiluri de culoare

Ca să se reproducă fidel culorile în aplicații cu gestionare a culorii (tipografii, Photoshop, browsere), exporturile sunt **etichetate cu un profil de culoare**:

- **PNG / JPG** poartă un profil ICC **sRGB** încorporat - spațiul de culoare în care este de fapt randată previzualizarea - deci nimic nu rămâne de ghicit. (Doar etichetare; pixelii nu sunt recodificați.)
- **Print PDF (CMYK)** declară o **condiție de tipar** țintă în *OutputIntent* (implicit *Coated FOGRA39*), spunând unui RIP/tipografii cum sunt gândite să fie citite cernelurile CMYK. Nuanțele de brand cu valori de cerneală măsurate sunt convertite exact; celelalte culori folosesc o conversie standard a dispozitivului. Acea declarație este un *nume*: niciun profil CMYK nu vine cu Lolly, iar PDF/X-4 vrea profilul încorporat, deci o condiție denumită scrie output intent-ul fără să pretindă conformitate PDF/X-4. Încarcă un profil CMYK propriu și alege rândul său **Embed** în controlul Colour profile, iar acesta este încorporat ca *DestOutputProfile* al fișierului - moment în care PDF-ul poate fi cu adevărat PDF/X-4 și pretinde asta ori de câte ori restul fișierului permite. Trei lucruri rețin pretenția păstrând totuși output intent-ul (un RIP tot mai vrea asta): grafica RGB pe care trecerea CMYK n-a putut-o converti, textul de credit `prov` din marginea de probă (desenat cu un font standard care nu este încorporat, iar X-4 nu face excepție pentru acestea) și o parolă **Strong**, pentru că X-4 interzice criptarea. Condiția pe care o declară este apoi citită de pe acel profil: un nume înregistrat unde profilul dovedește unul, `Custom` sub numele propriu al profilului unde nu dovedește, deci fișierul nu poate niciodată să numească o condiție de tipar purtând în același timp măsurătorile alteia.
- **Print TIFF (CMYK)** scrie pixeli **DeviceCMYK** neetichetați și înregistrează aceeași condiție de tipar ca proveniență în metadatele TIFF (*ImageDescription*) în loc să încorporeze un profil. Același control Colour-profile pilotează ambele formate CMYK - un TIFF nu poate încorpora deloc un profil de tipar, deci un rând **Embed** înregistrează acolo doar numele acelui profil și nimic altceva.
- **TIFF (RGB)** este fratele sRGB simplu, necomprimat - un raster fără pierderi la DPI-ul ales pentru arhivare sau un roundtrip într-un editor, cu proveniența înregistrată în aceleași metadate TIFF. Orice transparență este aplatizată pe alb (acest profil nu poartă alfa). La fel ca TIFF-ul CMYK, e doar pentru desktop, pentru că browserele nu pot previzualiza un TIFF, iar descărcările mobile ajung într-un impas.
- **SVG**, **EMF**, **EPS** și **DXF** sunt vectori independenți de rezoluție și de profil, fără profil încorporat - culorile SVG sunt sRGB simplu, cele ale EMF și EPS sunt RGB de dispozitiv (iar **EPS (CMYK)** scrie DeviceCMYK naiv) și **DXF** poartă cel mai apropiat AutoCAD Color Index. (SVG, EPS și DXF, ca și PDF, conturează orice text în căi vectoriale, deci rezultatul se randează chiar și acolo unde fontul nu e instalat. EMF în schimb păstrează textul VIU implicit - înregistrări reale de text de metafișier care rămân selectabile și editabile în Office și Google Slides, revenind la contururi doar pentru pasajele pe care formatul nu le poate exprima; opțiunea „Outline fonts” din panoul de export forțează căi peste tot.) **SVG** reproduce și `box-shadow` CSS din HTML - fiecare umbră exterioară este pictată în spatele casetei, cu offset/spread și estompare gaussiană potrivite browserului, iar umbrele interioare sunt pictate în interior în același fel.

Asta e automat - niciun setaj de reglat. Miniaturile și previzualizările sar peste etichetă ca să rămână mici. Un singur profil *este* o alegere, pentru că schimbă pixelii, nu doar îi etichetează - vezi **HDR** mai jos.

## HDR (culori luminoase)

Exporturile obișnuite sunt sRGB: albul este alb, iar o culoare de brand saturată este la fel de luminoasă ca albul normal al ecranului. Pe un afișaj capabil de HDR mai există mult spațiu deasupra acestuia, iar cardul **HDR** din panoul de export îl folosește - culorile brandului tău și textul alb sunt împinse spre luminozitatea de vârf ca să *strălucească* cu adevărat, în timp ce zonele întunecate rămân întunecate și dau strălucirii contrastul ei.

![Cardul HDR din panoul de export, activat, cu discurile White / Reach / Dark lift / Focus dezvăluite sub el](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formate.** Formatele raster cu un loc unde să poarte semnalul: **PNG**, **JPG**, **AVIF** și **TIFF**. (Nu WebP - este pe 8 biți, fără o cale de decodare HDR funcțională, așa că un WebP PQ ar arăta pur și simplu întunecat. Vectorii și PDF nu au niciun model HDR.)
- **Dezactivat implicit**, spre deosebire de etichetarea de culoare - modifică pixelii, deci este opțional. Bifează căsuța, sau adaugă `hdr=1` într-un link de partajare.
- **Ce se scrie de fapt.** Pixelii sunt recodați în **Rec.2100 PQ** - primare BT.2020 cu curba de transfer SMPTE ST 2084 (PQ) - iar containerul poartă semnalul corespunzător, astfel încât o aplicație cu gestionare a culorii știe să îi citească așa: un **profil ICC v4 generat cu etichetă `cicp`** (JPG, TIFF), un **fragment `cICP`** (PNG) sau o casetă `colr` rescrisă (AVIF). Amplificarea este condiționată de **luminozitatea perceptuală (OKLab)**, așa că tonurile medii și peste ele urcă spre vârf, iar cele întunecate sunt calmate în loc să fie arse, și este păstrătoare de nuanță - un verde de brand devine mai luminos, nu mentolat.
- **Cadranele.** Patru, dezvăluite când căsuța este activată: **White** (plafonul de luminozitate de vârf, 400-2000 nits), **Reach** (cât de jos se răspândește strălucirea printre tonuri), **Dark lift** (cât se luminează întunecimile - `0` le păstrează întunecate) și **Focus** (cât de multă bogăție de culoare păstrează amplificarea). Ele călătoresc în același parametru ca o valoare reglată compactă - `hdr=1600-60-0-50` înseamnă White 1600, Reach 60, Dark lift 0, Focus 50 - astfel încât un aspect reglat este reproductibil din link.
- **Unde îl vei vedea.** Vizualizatoare cu gestionare a culorii pe un afișaj HDR: Preview / Quick Look / Safari pe dispozitive Apple, Chrome pe un monitor HDR. Pe un ecran SDR obișnuit fișierul tot arată ca o imagine normală.
- **De știut înainte să îl livrezi.** Multe platforme **recodează** ce încarci și elimină semnalul HDR - rețele sociale, aplicații de mesagerie, unele CMS-uri - ceea ce poate lăsa imaginea arătând întunecată sau spălăcită. Folosește HDR acolo unde controlezi destinația (un site pe care îl construiești, un perete video, un set de diapozitive pe un panou luminos), nu ca implicit pentru orice.
- **Transparență.** PNG și AVIF își păstrează canalul alpha; JPG este opac ca întotdeauna. Traseul **TIFF** se aplatizează pe **negru**, nu pe alb ca traseul SDR - în PQ, albul este codul de 10.000 de nits, așa că aplatizarea pe el ar înconjura fiecare margine cu un halou orbitor.
- **Aceiași octeți din terminal.** `--hdr=1` cu `--export=png` sau `--export=jpg` scrie PNG-ul Rec.2100 PQ pe 16 biți și JPEG-ul cu gain-map ISO 21496-1 și pe [CLI](/info/cli.html), din aceleași motoare de codare ale engine-ului, nu dintr-un browser - astfel un instrument nativ `<svg>` produce un fișier HDR fără niciun Chromium pe traseu, iar PNG-ul este identic la nivel de octet cu cel al shell-ului web. AVIF și TIFF rămân deocamdată exporturi din shell-ul web.

## Video

Uneltele animate exportă mișcarea ca **MP4**, **WebM** sau **GIF** - și, acolo unde e oferit, **APNG**, **WebP animat** sau **SVG animat** vectorial (mai sus). Ce container video vezi depinde de browserul tău - selectorul arată doar ce poate efectiv înregistra:

| Browser | Arată |
|---|---|
| Safari / iOS | **MP4** |
| Firefox | **WebM** |
| Chrome / Edge 126+ / Android | **MP4 și WebM** |
| Chrome mai vechi | **WebM** |

GIF funcționează peste tot (excelent pentru chat/e-mail; mai mare și cu mai puține culori decât videoul). Uneltele animate expun și **Wait** (secunde cât să se așeze animația înainte de înregistrare) și **Duration** (durata clipului).

> Un link partajat `?format=…` care cere un container pe care browserul tău nu poate să-l înregistreze revine grațios la celălalt și denumește fișierul în consecință.

**Sunet.** Exporturile video nu sunt tăcute. O unealtă poate pune un **fundal muzical** sub clip - un asset audio din catalog, în buclă sau tăiat la durata clipului, cu fade-in/out, volum și ducking automat sub sunetul propriu al imaginilor - iar uneltele de înregistrare duc sunetul live al propriilor imagini direct în fișier. **MP4** și **WebM** păstrează pista mixată; GIF și formatele de imagine animată (APNG, WebP animat, SVG animat) sunt tăcute prin natura lor.

## Audio

Unele unelte exportă **audio de sine stătător**, nu doar ca pistă video. **Voice Recorder** captează o înregistrare de la microfon cu un indicator de nivel live și îndrumare blândă, apoi o salvează ca **MP3** (implicit, transcodat în browserul tău) sau în containerul său nativ - **M4A** (AAC), **OGG** sau **WebM** (Opus), oricare a înregistrat browserul tău. Ca și restul, codificarea se întâmplă pe dispozitivul tău - nimic nu este încărcat.

Audio-ul pe care îl *aduci* este la fel de larg. Selectorul de assets acceptă **MP3**, **WAV**, **OGG**/**Opus**, **M4A**/**AAC** și **FLAC** (păstrate byte cu byte și decodate pe dispozitiv), **MIDI** (`.mid` - convertit la import într-o pistă sintetizată minusculă, pe dispozitiv) și **module tracker** - **MOD**, **XM**, **IT**, **S3M**, **STM**, **MTM** (decodate pe dispozitiv de un player încorporat, câțiva kiloocteți de date de melodie). Oricare dintre acestea poate deveni **fundalul muzical** sub un export video, sau poate reda în playerul ambiental al Neurospicy Mode.

Audio-ul *face parte* din pipeline-ul `format=` / `--export=` de mai jos: `wav`, `mp3`, `m4a` și `opus` sunt id-uri de format obișnuite, deci un export doar-audio e la fel de ușor de partajat și scriptat ca un PNG. Ce iese este doar sunetul, fără imagine.

## Proveniență și filigran

Acolo unde formatul o suportă, exporturile poartă **metadate de proveniență** - software, sursă, numele uneltei și linia ta de credit din profil - încorporate nativ (PNG iTXt, JPEG EXIF, PDF info, `<metadata>` SVG, comentariu GIF). E doar despre autor; nimic nu este încărcat. Uneltele **Experimental** aplică suplimentar un filigran vizibil, aplicat de host, deci nu poate fi eliminat editând unealta.

**Lolly Imprint.** Exporturile raster poartă și propriul **filigran invizibil de pixeli** al Lolly - *Lolly Imprint* - **activ implicit**, la fel ca Content Credentials. Acolo unde credențialul și metadatele de proveniență călătoresc *alături de* pixeli și se pierd la o resalvare, o captură de ecran sau o eliminare de metadate, Imprint-ul trăiește *în* pixeli și supraviețuiește recompresiei - deci o copie a imaginii poate fi recunoscută mai târziu ca fiind făcută cu Lolly. E un indiciu durabil, nu o garanție criptografică, și este doar-prezență (nu poartă date personale). Se regăsește în **PNG, JPG, WebP, AVIF, TIFF și BMP**, și în rastere randate de Lolly compuse într-un **PDF sau PPTX** - niciodată într-o imagine pe care *tu* ai încorporat-o, doar în ce randează Lolly însuși. Debifează cardul **Lolly Imprint** din panoul de export ca să-l omiți, sau pasează `imprint=0` într-un link partajat. (Supraviețuirea AVIF la recodificare încă nu e calibrată; detecția PDF/PPTX acoperă rasterele Lolly încorporate.) [/verify](/verify) îl detectează pe dispozitiv - vezi [Content Credentials Identity](/info/content-credentials-identity.html#the-lolly-imprint).

**Credențialul durabil.** Un al doilea marcaj, mai greu, stă alături de Imprint: **Durable credential**, care folosește un model neural pe dispozitiv (format TrustMark) ca să scrie id-ul Lolly *în* pixeli, astfel încât legătura „făcut cu Lolly” să supraviețuiască unei eliminări de metadate, unei recodificări și unei recitiri de către unelte compatibile TrustMark, la fel ca ale Lolly însuși. Este **dezactivat implicit** - spre deosebire de Imprint-ul pur-JavaScript, costă o trecere neurală per export plus o descărcare de model unică, deci e un opt-in deliberat, nu o taxă tăcută. Doar raster (**PNG, JPG, WebP, AVIF, TIFF**), bifat în panoul de export sau pasat ca `durable=1` într-un link partajat. Pe aplicațiile desktop și mobile cardul este ascuns complet, nu arătat ca un no-op, pentru că nu există o origine de la care să preia modelul offline.

**Protecția conținutului.** În panoul de export, *Password protect*, **C2PA Credentials**, **Lolly Imprint** și **Durable credential** se pliază într-un singur grup **Content protection**, colapsat și adaptat formatului, deci proveniența și opțiunile de protecție ale unui fișier stau într-un singur loc - grupul arată doar cardurile care se aplică formatului ales, și se ascunde complet când niciuna nu se aplică. Marcajele de tipar sunt în mod deliberat *excluse* din el: sunt geometrie de producție de tipar, nu protecție, deci **Print marks & bleed** - măsura de bleed în milimetri plus Crop, Registration, Bleed, Colour bars și Stamp details - își păstrează propriul card de nivel superior pe formatele de tipar.

![Grupul Content protection deschis la un export PNG, arătând doar cardurile care i se aplică](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

**Înainte să exporți (preflight de tipar).** Activează **Print preflight** (`export-preflight`) în feature flag-urile Profilului tău - este **dezactivat implicit**, deci un utilizator individual care exportă un PNG pentru un mesaj de chat nu e niciodată luat prin surprindere de constatări de prepress, iar un plan de control al unei implementări ([lolly.work](https://lolly.work)) îl poate activa implicit pentru membrii săi - și un card **Before you export** apare la baza panoului, chiar deasupra butoanelor, ori de câte ori regulile de tipar au ceva adevărat de spus despre lucrare: format, dimensiune și bleed, apoi zonele de trim și bleed, acoperirea cu cerneală, numărul de plăci și numărul de pagini, cu un verdict alături de titlul său. Stă sub fiecare setare pentru că este o afirmație *despre* acele setări, nu încă una dintre ele - și nu blochează niciodată un export. Îți spune ce urmează să vadă o tipografie.

**Cost, calculat din grila ta de tarife.** Sub preflight - ultimul dintre toate, tot deasupra butoanelor - stă un card care transformă aceleași numărători în bani, și numai din prețuri pe care cineva i le-a dat. Citește tot ce a numărat trecerea de preflight, indiferent dacă respectivul card e activat sau nu, și are nevoie ca două lucruri să fie adevărate: lucrarea are ceva ce o listă de prețuri poate să evalueze (plăci, coli, suprafață, pagini, rânduri de variante sau fișiere de ieșire - deci un simplu PNG de logo nu-l arată niciodată), **și** este prezentă o **grilă de tarife**. O grilă de tarife este o listă de prețuri JSON de la tipografia ta. O compilare implicită nu poartă niciuna și nu are niciun mod din aplicație de a încărca una: sosește fie ca asset de catalog livrat de o implementare, fie prin extensia opțională de grilă de tarife pe care un self-hoster sau un plan de control o activează. Fără o grilă de tarife, nu se arată nimic - nici un prompt, nici un tabel gol.

Regula pe care se construiește totul este că **nu inventează niciodată bani**. Fiecare cifră este un tarif pe care l-ai furnizat înmulțit cu o cantitate pe care Lolly a numărat-o - `4 plăci × 35,00 €` - iar totalul își numește propria sursă în aceeași propoziție cu cifra: emitentul pe care-l numește grila, și data la care spune grila că sunt de la aceste tarife. Nu există monedă implicită, niciun substituent și niciun zero care să țină locul unui preț lipsă. Ce spune fișierul despre el însuși rămâne vorbire raportată: *„Fișierul spune: … Lolly nu a verificat asta.”*

Iar când nu poate calcula onest, tabelul de lucru **dispare** în loc să se degradeze într-o cifră estompată sau completată la întâmplare:

- Rândurile pe care grila nu le prețuiește înseamnă **niciun total deloc** - doar un titlu care spune câte dintre ele sunt neprețuite. O sumă parțială nu e un răspuns mai mic, e unul greșit.
- O cantitate care e un plafon, nu o numărătoare exactă, poartă **„up to”** mai departe în subtotalul ei, deci o limită nu e niciodată transformată în cifră fixă.
- Tarifele expirate față de data lor de valabilitate arată **doar numărători**, până apeși *Use these rates anyway* - iar apoi data de expirare merge alături de cifră, deci un total expirat nu poate fi citit ca unul curent.
- Deschisă printr-un **link**, suma rămâne ascunsă până o ceri pe acest dispozitiv. Nici cardul, nici acea dezvăluire nu călătoresc vreodată într-un URL - același motiv pentru care CLI-ul primește `--rate-card=<file.json>` ca un flag de fișier local și niciodată ca parametru de link.

Cardul este interfață, niciodată conținut: este eliminat din fiecare etapă de export, deci nu poate mișca niciun pixel din fișierul pe care-l descarci. Și este aritmetică, nu o ofertă - doar tipografia ta îți poate da una.

**Randări compuse.** Când o unealtă încorporează ieșirea altei unelte (de ex. un *Event Name Badge* care încorporează un *QR Code*), randarea imbricată este inclusă inline în exportul părintelui - rămâne un **vector adevărat** în SVG și PDF și se rasterizează clar în PNG/JPG/WebP. Copilul încorporat este un intermediar: nu primește *niciun* filigran și *nicio* proveniență proprie; doar asset-ul părinte finit le primește. (Compunerea acoperă SVG și formatele raster; HTML/MD/TXT nu pot fi compuse.)

## Protecție prin parolă

Două tipuri independente de blocare, ambele complet pe dispozitiv.

**PDF open-password** - cardul *Password protect* din panoul de export oferă două niveluri:

![Cardul Password protect extins la un export PDF, cu câmpul pentru parolă și cele două niveluri de blocare](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

- **Standard** - o blocare de bază pe 40 de biți (RC4). Se deschide în *orice* aplicație PDF și - fiind un descurajator ușor, nu o protecție reală - poate circula într-un link de partajare (text simplu, intenționat). Doar `pdf` RGB.
- **Strong** - AES-256 (PDF 2.0). Parola sa este introdusă la export și **nu** este pusă niciodată într-un link; se deschide doar în aplicații PDF mai noi (Acrobat / Preview ~2018 și ulterior), iar aplicațiile mai vechi pot raporta fișierul ca fiind deteriorat. Strong se aplică și **PDF-urilor Print / CMYK** și **fiecărui PDF dintr-un zip de lot** (dialogul de confirmare al lotului colectează parola). Deoarece PDF/X-4 interzice criptarea, un PDF Print blocat cu Strong își păstrează CMYK-ul, marcajele și output-intent-ul, dar renunță la afirmația de conformitate PDF/X-4.

Oricare dintre niveluri se exclude reciproc cu Content Credentials (un PDF criptat nu poate primi acreditarea).

**Descărcări blocate (zip întreg + apărare în profunzime)** - un export **ZIP** (formatul *ZIP* din panoul de export, care grupează mai multe formate ale unui instrument), o descărcare de **folder** (Projects → Download) sau **grila de lot** poate bloca întregul zip cu o singură parolă, la două niveluri:

- **Standard** - **ZipCrypto** tradițional: se deschide în *orice* instrument de dezarhivare, inclusiv funcția de extragere integrată din Windows Explorer, dar este slab (un descurajator). Parola sa poate circula într-un link de partajare `?password=`.
- **Strong** - **AES-256** (WinZip AE-2): puternic, dar **nu** se deschide cu funcția de extragere integrată din Windows Explorer - destinatarul are nevoie de 7-Zip / WinZip / Keka / macOS. Introdusă la export, nu este pusă niciodată într-un link.

Același card *Password protect* din panoul de export controlează atât blocările PDF, cât și cele ZIP, reformulându-se pentru formatul ales. Aceeași parolă protejează **fiecare** membru - imagini, SVG, orice, inclusiv PDF-uri (doar containerul zip poate proteja fișierele care nu sunt PDF, care nu au propria lor blocare). Și este **apărare în profunzime**: orice PDF dinăuntru este *de asemenea* blocat individual cu AES-256 folosind aceeași parolă, astfel încât un PDF rămâne blocat chiar și după dezarhivare. Solicitarea apare când începi descărcarea; o parolă goală înseamnă nicio blocare.

**Linkuri de partajare protejate cu parolă** - orice link de partajare poate fi criptat astfel încât deschiderea lui să ceară destinatarului o parolă. Întreaga stare a linkului este criptată AES-256 sub o cheie derivată din parolă (PBKDF2); circulă doar textul cifrat, astfel încât **parola nu se află niciodată în link**, iar decriptarea are loc **în browserul destinatarului** - serverul care servește linkul vede doar textul cifrat din URL, niciodată parola și niciodată designul decriptat. Activează-l în dialogul **Share**. Un link criptat poate fi *deschis* doar în Lolly (nu poate fi încorporat ca imagine, deoarece acea cale nu poate solicita parola). Vezi [URL Mode → Encrypted links](/info/url-mode.html).

## Content Credentials (C2PA)

Exporturile pot purta **Content Credentials** - un manifest [C2PA](https://c2pa.org) semnat, încorporat în fișier, care înregistrează, într-un mod care evidențiază orice modificare, faptul că fișierul a fost creat cu Lolly și nu a fost alterat de atunci. Este versiunea bazată pe standarde a metadatelor de proveniență de mai sus: o afirmație criptografică (ce a creat fișierul, când, de cine și unde) legată de un hash al octeților fișierului, astfel încât orice editare ulterioară poate fi detectată de un vizualizator compatibil C2PA. Standardul este gestionat de [Content Authenticity Initiative](https://contentauthenticity.org) (Adobe, BBC, Microsoft, Nikon și altele), astfel încât acreditările pe care Lolly le scrie sunt aceleași pe care camerele foto, redacțiile și suitele creative le adoptă.

![Cardul C2PA Credentials, bifat implicit, cu durata de viață a acreditării alături](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Formate.** Fiecare container cu încorporare C2PA: **PDF** (atât RGB, cât și Print), **PNG / PNG animat**, **JPG**, **GIF**, **SVG**, **TIFF** (RGB și Print), **WebP** (static și animat), **AVIF**, **MP4**, **WebM** și containerele audio **MP3**, **WAV**, **M4A** și **OGG/Opus** - astfel încât un clip vocal înregistrat sau sintetizat poartă aceeași acreditare ca o imagine. Un pachet **ZIP** ștampilează individual fiecare membru compatibil, iar de aici își primește acreditarea și un **SVG animat** (dedesubt este un document SVG obișnuit; un export direct de SVG animat nu are propriul card). MP4, AVIF și M4A folosesc legarea BMFF din specificație, iar MP3 maparea sa ID3v2, astfel încât `c2patool` și alte vizualizatoare compatibile C2PA le pot verifica; **WebM** și **OGG/Opus** nu au încă o mapare C2PA standardizată, așa că Lolly poartă manifestul ca atașament Matroska, respectiv ca un câmp OpusTags, pe care propriul verificator al Lolly (și CLI-ul) le verifică. (`ico`, `eps`, `emf`, `dxf`, `bmp`, `pptx`, formatele Office și formatele text/date nu au container C2PA.)
- **Activ implicit.** Cardul **C2PA Credentials** din panoul de export este preselectat pentru aproape orice instrument - debifează-l pentru a omite acreditarea la un singur export (sau transmite `c2pa=off` într-un link de partajare). Un instrument poate renunța complet în manifestul său.
- **Ce înregistrează.** Instrumentul și aplicația care au creat fișierul, momentul semnării, suprafața de export (familia motorului de browser + familia sistemului de operare - în mod deliberat aproximativ, niciodată o amprentă) și - doar când *Profile → Use my details* este activat - numele și emailul tău ca autor al lucrării.
- **Ce văd destinatarii.** Instrumentele de inspectare a Content Credentials (aplicații Adobe, `c2patool`, contentcredentials.org/verify) vor citi manifestul și vor afișa afirmația. Deoarece Lolly semnează cu o cheie generată **pe dispozitivul tău** - nu un certificat dintr-o listă de încredere - vizualizatoarele raportează acreditarea ca *neverificată*. Structura și evidențierea alterării sunt reale; identitatea semnatarului pur și simplu nu este garantată de o autoritate. Pentru a îmbunătăți asta, poți înregistra o **identitate verificată** (Profile → Content Credentials): un certificat de scurtă durată de la Lolly CA leagă emailul tău de exporturile tale, în timp ce cheia de semnare tot nu părăsește niciodată dispozitivul tău - vezi [Content Credentials Identity](/info/content-credentials-identity.html).
- **Verificarea unui fișier.** Lolly își verifică și propriile acreditări: plasează orice fișier pe [/verify](/verify) (sau rulează `lolly validate <file>` în CLI) pentru un raport pe dispozitiv - având ca titlu dacă fișierul a fost cu adevărat creat cu Lolly și nemodificat de atunci. Vizualizarea web Verify citește mult dincolo de acreditare: semnalează **conținut generat de AI**, detectează **Lolly Imprint**, verifică semnăturile **SEAL** și (opțional) filigranele de pixeli ale terților și scoate la iveală **date ascunse** - totul pe dispozitiv, fără nimic încărcat. Vezi [Content Credentials Identity → Beyond the credential](/info/content-credentials-identity.html#beyond-the-credential-what-else-verify-shows).
- **Confidențialitate.** Totul se întâmplă pe dispozitivul tău: cheia de semnare este creată pentru export și nu părăsește niciodată browserul, nimic nu este încărcat, iar afirmația conține doar ceea ce metadatele de proveniență poartă deja. Utilitarele de confidențialitate (transformări pe dispozitiv ale *propriilor tale* fișiere) nu adaugă niciodată acreditări, iar *Strip Hidden Data* va elimina un manifest C2PA la fel ca orice alte metadate încorporate.
- **Interacțiuni.** Pentru PDF-uri, Content Credentials și **protecția prin parolă** (oricare dintre niveluri - vezi mai sus) se exclud reciproc (un PDF criptat nu poate primi atașamentul de acreditare). Acreditarea este adăugată ca pas final peste octeții finali - după ștampilarea DPI/EXIF/profil de culoare, metadatele PDF/X și marcajele de tipar.

## Pe telefon

Comenzile de export se află în spatele butonului flotant **Render**, care deschide foaia **Export** - aceleași formate, dimensiune, copiere, descărcare și partajare, dimensionate pentru atingere.

## Referință formate

Fiecare id pe care gazda îl poate reda, grupat. Acestea sunt și valorile pentru parametrul URL `format=` și flag-ul CLI `--export=` - vezi [URL Mode](/info/url-mode.html) și [CLI](/info/cli.html). Un instrument oferă doar subsetul declarat de autorul său, astfel încât selectorul este întotdeauna mai scurt decât această listă.

| Tip | ID-uri |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vector | `svg` · `svgz` (SVG gzip) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (fișier de tăiere) |
| Pagină și document | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `scorm` (pachet de curs SCORM, o arhivă zip) · `penpot` (fișier de design Penpot) · `docx` (Word) · `odt` (OpenDocument Text) |
| Mișcare | `gif` · `apng` (PNG animat) · `webp-anim` (WebP animat) · `svg-anim` (SVG animat) · `webm` · `mp4` |
| Audio | `wav` · `mp3` · `m4a` · `opus` |
| Text și date | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `css` · `scss` · `gpl` (paletă GIMP) |
| Pachet | `zip` |

Câteva id-uri suplimentare provin din **hook-ul de export propriu al instrumentului**, nu din calea de randare comună: `ase` (Adobe Swatch Exchange, din Palette Lab), `exr` și `hdr` (rasterele cu gamă dinamică ridicată ale Darkroom) și `ttf` / `otf` / `woff` (Font Convert). Acestea aleg un format în același mod - selectorul, `format=`, `--export=` - doar că octeții sunt construiți de instrument. Font Convert este singura excepție: transformă un fișier font pe care *tu* îl furnizezi, așa că nu există nimic de redat pentru un URL simplu.
