# Eksport og formater

Hvordan få en ferdig fil ut av et verktøy - velge riktig format, angi utdatastørrelse og hva hvert alternativ gjør. Som alt annet **skjer eksporten på din enhet**; ingenting lastes opp.

## Slik fungerer eksport

Forhåndsvisningen *er* filen. Når du eksporterer, gjengir verten det lerretet til formatet du valgte, og gir deg en nedlasting (eller legger den på utklippstavlen din). Et verktøy tilbyr bare formatene forfatteren har erklært, og velgeren skjuler alle nettleseren din ikke kan produsere (se [Video](#video)).

Tre veier gir en fil. De fleste verktøy **gjengir lerretet** til det valgte formatet. Tekst- og dataformater (HTML, MD, TXT, JSON, CSV, ICS, VCF) blir i stedet **generert fra verktøyets innhold**, ikke rasterisert fra bildet. Og personvernverktøy (f.eks. *Strip Hidden Data*) bruker en tredje vei: filen *du* velger, transformeres byte for byte på enheten og gis rett tilbake - ikke noe lerret, ikke noe vannmerke og ingen opphavsmetadata lagt til, fordi det allerede er din egen fil.

Handlingene i eksportkontrollene:

- <!--i:download--> **Last ned** - lagre filen (hovedhandlingen).
- <!--i:photos--> **Kopier** - legg bildet på utklippstavlen for å lime det rett inn i Slack, e-post, et dokument. Der en nettleser ikke kan kopiere bilder, laster den ned i stedet og sier fra.
- <!--i:folder--> **Lagre** - behold gjeldende design som en lagret verktøyøkt i biblioteket ditt.
- <!--i:link--> **Del** - åpner **Del-dialogen**: en kopierbar lenke som gjenskaper designet, brytere for besøk (fullskjerm, eksportpanel, nedlasting eller kopiering ved åpning) og en valgfri **Kortest lenke** som pakker hele tilstanden inn i et kompakt token (se [URL-modus](/info/url-mode.html)).

(Verktøyets forfatter velger hvilke av disse som vises; standardsettet er Kopier, Last ned og Lagre.)

![Eksportpanelet - format, størrelse og handlingene Kopier / Last ned / Lagre / Del](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Del åpner over verktøyet, med lenken allerede bygget og bryterne for besøk under den.

### Gjengi flere samtidig

En enkelt eksport er én fil, men du kan gjengi **mange** i én omgang - hver levert som én `.zip`:

- <!--i:folder--> **Prosjekter → Gjengi mappe** eksporterer hver lagret økt i en mappe (og undermappene dens) som én nøstet zip; **Gjengi utvalg** gjør det samme for et hvilket som helst flervalg; en enkelt lagret økt gjengis rett til sin egen fil. Ingen Batch/Pro nødvendig - se [Bruke Lolly → Prosjekter](/info/using.html).
- <!--i:layers--> **Batch (Pro)** gjengir et rutenett av inndatasett - hver variant av én mal på én gang.

En lagret økt kan også deles på nytt som en verktøylenke fra Prosjekter (den gjenoppbygger verktøy-URL-en fra de lagrede inndataene), så en lenke åpner den igjen med nøyaktig samme innstillinger.

## Velge et format

Filnavnet og formatvelgeren ligger øverst i panelet som ett `navn.format`-par, og velgeren lister bare formatene dette verktøyets forfatter har erklært.

![Filnavnfeltet sammenkoblet med formatvelgeren, slik at eksporten leses som ett navn.format-par](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

| Du vil ha… | Bruk | Hvorfor |
|---|---|---|
| Skarpe logoer / grafikk som skalerer | **SVG** | Vektor - uendelig skalerbar, liten, redigerbar |
| Vektor for Office / Windows-apper | **EMF** | Limes inn som redigerbar vektor i PowerPoint / Word; teksten forblir levende og redigerbar, og Google Drive åpner den i Google Drawings for Slides |
| Vektor for trykk / designapper | **EPS**, eller **EPS (CMYK)** | PostScript-vektor for Illustrator / trykkeriarbeidsflyt |
| Vektor for kutte- / CAD-maskiner | **DXF** | Laserkuttere, vinylplottere, CNC - konturbaner i millimeter |
| Et redigerbart presentasjonssett | **PowerPoint** (PPTX) | Nativ redigerbar tekst + former, med bilder og vektorer som forblir uttrekkbare |
| Et kurs som et LMS kan importere | **SCORM** (LMS) | En zip med manifestet, en oppstartsside, lysbildene og filmen med fortellerstemme og teksting - fra et Design-sett |
| Et redigerbart tekstdokument | **Word** (DOCX) eller **OpenDocument** (ODT) | Ekte avsnitt og overskrifter som et tekstbehandlingsprogram kan fortsette å redigere (Doc Studio) |
| Et foto eller bilde til generell bruk | **PNG** (tapsfritt) eller **JPG** (mindre) | Universelt rasterformat |
| Mindre moderne bilder | **WebP** / **AVIF** | Bedre komprimering, alfa |
| Trykk | **PDF**, eller **Print PDF** (CMYK) | Ekte sidestørrelse; CMYK for trykkeri |
| Rasterfil for trykkeri | **Print TIFF** (CMYK) | DeviceCMYK-piksler for en RIP |
| Animert for nettet | **GIF** | Fungerer overalt, større filer |
| Animert med fullfarge + ekte alfa | **APNG** | Animert PNG - ingen palettbegrensning, ekte gjennomsiktighet |
| Animert, minste fil | **Animated WebP** | Fullfarge + alfa, bedre komprimert enn GIF eller APNG |
| Animert vektor som skalerer | **Animated SVG** | Selvstendig; løkker i en nettleser eller `<img>`, ingen kodek, enhver størrelse |
| Video for sosiale medier / deling | **MP4** eller **WebM** | Best kvalitet per byte (se nedenfor) |
| Rik tekst / e-postsignatur | **HTML** | Limes inn formatert i e-postklienter |
| Rent innhold | **MD** / **TXT** | Kun tekst |
| En kalenderhendelse | **ICS** | Importeres til alle kalenderapper |
| Et kontaktkort | **VCF** | Importeres til Kontakter / adressebøker |
| Strukturerte data for gjenimport | **JSON** / **CSV** | Ruter verktøyets innhold frem og tilbake |
| Et favicon | **ICO** | Nettstedikon i flere størrelser (**ZIP** samler flere formater) |

Den første raden er standardtilfellet. Et ordmerke satt i merkevarens font eksporteres som SVG, der hver bokstav er en konturert bane i stedet for en piksel, så det forblir skarpt i visittkortstørrelse og i byggveggstørrelse fra samme fil.

![Et tynt, bredsporet ordmerke med teksten Aurora, den typen rene vektorillustrasjoner SVG-raden i tabellen handler om](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-wordmark-vector)

## Størrelse og trykkeenheter

Som standard bruker eksporter verktøyets naturlige pikselstørrelse. Der et verktøy tilbyr **dimensjoner**, kan du angi bredde × høyde og en **enhet**:

- **px** (standard) - eksakte piksler.
- **mm · cm · in · pt · pc** - fysiske / trykte størrelser. Med en fysisk enhet angir du også **DPI** (standard **300** for trykk); motoren konverterer riktig per format - **PDF** blir en ekte side i den størrelsen, **raster** gjengis med riktig pikselantall for DPI-en (og innebygger oppløsningen), **SVG** beholder den fysiske enheten med en px-viewBox.

For å få en høyere oppløst raster, angi en større bredde/høyde, eller velg en fysisk enhet og øk DPI-en (piksler = størrelse × DPI). Det finnes ingen ett-klikks skaleringsbryter.

Eksempel: bredde `210`, høyde `297`, enhet `mm` → en A4-side.

![Dimensjonsraden satt til 210 ganger 297 mm, med DPI-feltet synlig fordi enheten er fysisk](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Stillbilder fra en tidsstyrt komposisjon

En **tidsstyrt komposisjon** - en [Sequence](/info/using.html#timeline-sequence)-tidslinje i Design, eller ethvert tidslinjestyrt tegnebrett - er noe som beveger seg, så en stillbildeeksport må svare på «hvilket øyeblikk?». Regelen er som forventet: **bildet ved avspillingshodet**. Plasser avspillingshodet der du vil ha bildet og eksporter; det du ser er det du får.

Når du vil ha mer enn ett øyeblikk, vises **Bilder**-feltet ved siden av utdatastørrelsen (bare for en tidsstyrt komposisjon, og bare for et stillbildeformat - PNG, JPG, WebP, SVG eller PDF). La det stå på `1` for avspillingshoderammen. Øk det, og du får det antallet stillbilder samplet med jevne mellomrom gjennom hele sekvensen:

- **Raster og SVG** kommer tilbake som én **zip** - `<name>-01.png`, `-02.png` og så videre.
- **PDF** kommer tilbake som ett **enkelt dokument med like mange sider**.

Nyttig for en storyboard, et miniatyrbildeark, et kontaktark for gjennomgang eller en karusell for sosiale medier klippet rett fra en videoredigering.

Samplingen tas ved **midtpunktet** av hvert intervall i stedet for ved kantene, fordi det første øyeblikket i en sekvens ofte er en inntoningsovergang som ikke har blitt synlig ennå, og det siste er tilstanden etter at hver klipp er avsluttet - sampling ved endepunktene ville brukt to av bildene dine på nesten tomme. Antallet er begrenset til **64** (et kontaktark er til for at et menneske skal lese det), og alt som ikke gir mening skrevet inn i feltet, faller tilbake til `1` i stedet for å feile eksporten. Hvert bilde er et vanlig stillbilde, så Content Credentials, avtrykket, fysiske enheter og DPI oppfører seg akkurat som for en enkelt eksport.

**Bilder**-feltet er måten å få et ark på i dag. Motoren reserverer en tilsvarende `cuts`-URL-parameter, men intet skall leser den fra en lenke ennå, så en delt lenke åpner alltid på avspillingshoderammen - se [URL-modus](/info/url-mode.html#contact-sheets-cuts).

## Flersidig PDF

Noen verktøy bygger et **flersidig PDF-dokument** i stedet for et enkelt verk - et forsideark, innhold som flyter over så mange sider det trenger, og et bakre ark, alt i én fil (se verktøyet *Booklet*). Hver side er en **ekte PDF-side** tilpasset den sidens boks, så lesere og skrivere får ekte sider, ikke ett langt bilde.

- **Sider fra innhold.** Legg til blokker med tekst og bilder; nye sider opprettes automatisk etter hvert som blokkene fylles, og du kan tvinge en hvilken som helst blokk til å starte en ny side.
- **Ekte sidestørrelser.** Velg A4, US Letter eller A5 (liggende - to-kolonneoppsettet er bygd for det) - hver side, og den eksporterte PDF-en, gjengis i nøyaktig den størrelsen.

Flersidige PDF-er er RGB-dokumenter og har ikke skjære-/utfallsmerker - de hører til den ensidige **Print PDF**-løsningen ovenfor. De har derimot de samme **PDF/X-4-metadataene** som all PDF-eksport (sideboks, XMP, dokument-ID, en sRGB-utdataintensjon med innebygd profil), og de tilbyr **Content Credentials** (nedenfor) - på verktøyet *Booklet* kommer alternativet forhåndsvalgt.

## Lage mange ting samtidig

Lolly har tre distinkte måter å jobbe i volum på, og de løser ulike oppgaver - batchredigering er en fullverdig egenskap ved plattformen, ikke noe hvert verktøy finner opp på nytt:

- <!--i:document--> **Ett design × en tabell med rader → ett flersidig dokument.** Verktøy med en `table`-inndata (som *Battlecards*) gjør hver rad om til en side automatisk - lim inn en tabell fra regnearket ditt, få en PDF i heftestørrelse. Din egentlige batchredigerer forblir regnearket: rett ti rader der, lim inn igjen. Verktøyet selv håndterer aldri sider.
- <!--i:layers--> **Ett design × en datafil → mange separate filer.** `/pro`-batchrutenettet tar en CSV og gjengir én eksport *per rad* - navneskilt, sertifikater, én fil hver.
- <!--i:sliders--> **Mange forskjellige ressurser, redigert side om side.** *Multi-edit* åpner flere lagrede økter i én visning for koordinerte finpussinger på tvers av ulike design.

Tommelfingerregel: rader av samme design som hører hjemme i **ett dokument** → et tabelldrevet verktøy; rader som må leveres som **separate filer** → `/pro`; **ulike design** som trenger samme justering → multi-edit. (Et planlagt «kombiner media»-eksportalternativ vil bygge bro over de to første - slå sammen eksporter i samme format til én PDF, én video eller et kontrollkontaktark.)

## PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart og Diagrams kan eksportere et **PowerPoint-sett** - ett lysbilde per side. Poenget er ikke et pikselperfekt skjermbilde; det er å gi en kollega et sett de faktisk kan **redigere og hente elementer ut av**. Derfor blir hver side dekomponert til native objekter:

- <!--i:font--> **Tekst** blir til ekte, **redigerbare PowerPoint-tekstbokser** - med skriftstørrelse, farge, vekt, kursiv og justering fra layouten - slik at du kan rette en skrivefeil eller omstilere i PowerPoint.
- <!--i:pentool--> **Vektorer** (logoer, ikoner, SUSE-merket) legges inn som **ekte SVG-bilder** - de holder seg skarpe i alle størrelser, og PowerPoint kan til og med *Convert to Shape* på dem.
- <!--i:photos--> **Bilder** kommer inn i sin native oppløsning som egne uttrekkbare bilder (et `cover`-beskåret hero-bilde beholder hele bildet bak beskjæringen, slik at du kan omramme det), med all behandling på bildet (filtre, blandinger) bakt inn trofast.
- <!--i:layers--> **Bakgrunner, kanter og linjer** blir til ekte rektangel-/linjeformer.

![Eksportpanelet med PowerPoint valgt: ett lysbilde per side, tekst og former forblir redigerbare](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Layouten er tilnærmet med vilje - målet er trofast, gjenbrukbart **innhold**, ikke et låst skjermbilde. Alt walkeren ikke kan uttrykke naturlig (et komplekst filtrert eller maskert område) legges inn som et bilde slik at ingenting går tapt. En presentasjon har én lysbildestørrelse, hentet fra første side.

PowerPoint er også en vei **inn**. Slipp en `.pptx` på hvilken som helst opplastingsflate og velg lysbildene du vil ha - hvert av dem blir et element du kan plassere, redigere eller bygge videre på. **Markdown Slides** skriver et nytt sett fra Markdown (og gir deg en merkevaretilpasset `.pptx`-mal), og verktøyet **Rebrand** temasetter et eksisterende sett på nytt der det ligger - temapalett, hardkodede farger og skrifter - uten å røre diagrammene, SmartArt eller animasjonene, og leverer tilbake en `.pptx`. Se [Importer et design → Sett og dokumenter](/info/design-import.html#decks-and-documents).

## Penpot

Ethvert verktøy som kan eksportere SVG, kan også eksportere en **Penpot-fil** (`.penpot`) - dokumentet, klart til å fortsette å redigere i Penpot i stedet for bare å se på.

- <!--i:layout--> Fra **Design** blir hver ramme til et Penpot-**board**, hver boks på den overføres som sin egen redigerbare form - rektangel, ellipse, tekst, bilde eller bane - og resultatet kommer som en gjenbrukbar **komponent** i Assets-panelet, klar til å dras ut igjen.
- <!--i:pentool--> Fra et verktøy der resultatet er **ren geometri** - vektorverktøyene som QR Code, Street Map, Wordmark og Palette Lab - overføres hver bane, hvert rektangel, hver tekstlinje og hver gradient på samme måte, som sin egen redigerbare form.
- <!--i:font--> Fra et verktøy som legger ut resultatet i **HTML**, **forblir teksten tekst** - ett redigerbart Penpot-tekstobjekt per linje, ikke en kontur og ikke et flatt bilde. Et element Penpot ikke har noen konstruksjon for - en kompleks illustrasjon, et levende lerret - blir med som et eget bilde, slik at det aldri flater ut teksten og boksene rundt det. Et helt oppsett Penpot ikke kan skille ut trofast, kan likevel komme over som ett bilde i full kvalitet, så ingenting går noensinne tapt.
- <!--i:palette--> En farge eller skrift en form **arver fra et merkevaretoken** forblir **koblet** til det tokenet i filen: endre tokenet i Penpots Tokens-panel, og hver form som arver det, males på nytt samtidig, mens en engangsfarge blir stående nøyaktig der den er. Merkevarens farger og typografier havner også i **Assets**-panelet, og hele designtokensettet i **Tokens**-panelet - det samme DTCG-tokensettet Lollys egen palett bruker. Penpot beholder sin egen kopi derfra: en endring gjort i dets Tokens-panel kommer tilbake til merkevaren gjennom [Brand Studios import](/info/design-import.html), ikke av seg selv.

| Hva du laget | I Penpot |
|---|---|
| Tekst | Redigerbare tekstobjekter - rett en skrivefeil eller endre stil |
| Former, baner, gradienter, bilder | Sine egne redigerbare vektorformer |
| En farge eller skrift fra et merkevaretoken | En levende tokenkobling - endre tokenet, hver form som arver det følger med |
| Hele designet | En gjenbrukbar komponent i Assets-panelet |
| En kompleks illustrasjon eller et levende lerret | Bygget inn som sitt eget bilde, det redigerbare innholdet rundt urørt |

![Eksportpanelet med Penpot valgt: .penpot-filen, og Send to Penpot ved siden av nedlastingen](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

For å åpne den, start Penpot, velg et prosjekt og velg **Import**. Når du er logget inn på Penpot fra eksportpanelet, gjør **Send to Penpot** dette trinnet for deg - velg et prosjekt der, så går filen rett inn i det.

## SCORM (kurspakker)

Et Design-sett kan forlate appen som en **SCORM-pakke** - zip-filen et læringsstyringssystem importerer, enten det er Moodle, Canvas, Blackboard eller et bedrifts-LMS. Velg **SCORM (LMS)** i formatvelgeren, så skriver eksporten:

- <!--i:layout--> **Lysbildene**, ett bilde per tegnebrett, som vektor der tegnebrettet tillater det og som piksler bare der det ikke gjør det.
- <!--i:play--> **Filmen med fortellerstemme** og tekstingssporet - talenotatene lest av en stemme på enheten, akkurat slik [Presenting](/info/create/using.html#presenting) spiller dem av.
- <!--i:file--> **En oppstartsside** som går gjennom lysbildene, spiller av filmen og rapporterer fullføring tilbake til LMS-et gjennom SCORM 1.2-kjøretiden, versjonen alle LMS-er godtar.
- <!--i:font--> Skriftene settet bruker, slik at oppstartssiden gjengis likt offline.

![Eksportpanelet på et Design-sett med SCORM (LMS) valgt](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Ingenting i pakken ringer hjem: det er filer i en zip, og den kjører inne i LMS-et uten bundler, uten CDN og uten konto. Web- og skrivebordsappene bygger den; CLI-en gjør det ikke, fordi det å fotografere tegnebrettene og kode filmen krever nettleseren.

## DXF (kuttfiler)

Vektorverktøy (Brand Lockup, QR Code, Street Map, Wayfinding Signage, Pose Geeko, logolåsene, Diagram Builder) kan eksportere **DXF** - AutoCAD R12-utvekslingsformatet som laserkuttere, vinylplottere og CNC-/CAD-programvare leser. Geometri skrives som omriss-**baner i millimeter** (kurver flatet ut til en fin toleranse), tekst omrisses til baner, og farge kartlegges til nærmeste AutoCAD Color Index (som typisk styrer verktøyet/operasjonen på en kutter). DXF er kun strektegning - et fotografisk eller filtrert område har ingen kuttbaneform og blir droppet (Lolly varsler), så bruk SVG/PDF når du trenger å beholde rasterinnhold.

Street Map er det klareste tilfellet: hele designet er allerede streker, så hver vei og kanal blir en kuttbane uten noe å droppe.

::: showcase
![Et Street Map-render av Paris i blekk på krem - ren strektegning, så hver strek overlever turen til en kutter](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Skroll, og kameraet trekker seg tilbake gjennom selve geometrien: sju baner, ingen piksler noe sted, hver strek hårfin-skarp i alle zoomnivåer. Det er samme fil en kutter leser.
:::

## Animert SVG

Bevegelsesverktøy (Animated Ad, Lottie Ad) kan eksportere **Animert SVG** - en selvstendig, *vektor*-animasjon. I motsetning til GIF/APNG/WebP (som samplinger hver ramme til piksler), stabler en animert SVG vektorøyeblikksbilder med innebygde CSS-nøkkelrammer, slik at den **skalerer til enhver størrelse uten kodek og uten ekstern kjøretid** - den løkker i en nettleserfane eller en `<img>`. Tekst forblir konturlagt slik at den rendres overalt. Den deler de animerte formatenes **Duration**-/bildefrekvenskontroller, og (siden den er tyngre per bilderute enn en bitmap) bruker en lavere standard bildefrekvens.

## Gjennomsiktighet

Verktøy som støtter det tilbyr en **gjennomsiktig bakgrunn**-bryter (f.eks. *No BG*). Gjennomsiktighet bevares av PNG, WebP, AVIF, SVG (stillbilde og animert), APNG og Animated WebP. JPG og PDF er alltid ugjennomsiktige, og TIFF flates ut mot hvitt (mot svart på HDR-banen - se nedenfor).

## Fargerom

To ulike spørsmål, verdt å holde fra hverandre: hvilke fargerom Lolly kan **lese og tenke i**, og hvilke den **skriver**.

**Lesing.** Der enn en farge er skrevet - en verktøystilark, en importert SVGs maling, en design-tokens verdi, en skygge eller gradient inne i en CSS-stenografi - leser Lolly hele **CSS Color 4**-vokabularet: `#hex`, `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, CSS' navngitte farger og `color()` i de forhåndsdefinerte rommene - `srgb`, `srgb-linear`, `display-p3`, `a98-rgb`, `prophoto-rgb`, `rec2020`, `xyz-d50`, `xyz-d65` - inkludert komponenter skrevet som nøkkelordet `none`. Én parser gjør dette for hele plattformen, slik at nettleseren og hver eksportwalker er enige om hva en fargestreng betyr.

Det betyr mer enn det høres ut som, fordi en nettleser løser moderne CSS til moderne CSS. Skriv `color-mix(in oklab, …)` og Chrome beregner `oklab(…)`; bruk et merkevaretoken lagret som `oklch()`, og det er den bokstavelige verdien eksportwalkeren ser. Farger i de formene leses korrekt i stedet for å droppes - som er hva en walker som bare forsto `rgb()` gjorde, ved å eksportere merkevarefarget tekst som svart, miste tonede paneler og tabellinjer, og lese `oklch(0.7 0.1 200) 0px 2px 4px` som en skyggeforskyvning på 0.7 ganger 0.1.

**Tankegang.** Fargematematikk skjer perseptuelt i stedet for i rå kanaler. Palettutledning, overganger, harmonier og kontrast kjører i **OKLCH/OKLab**, og en farge utenfor fargeomfanget bringes inn i området av CSS Color 4s egen fargeomfangs-kartleggingsalgoritme - kroma-reduksjon med en perseptuell avstandssjekk - i stedet for ved å klippe kanaler, slik at en sterk farge lander på den nærmeste fargen du faktisk ville akseptert, i stedet for en flatet ut en. Gradienter interpoleres i et rom du velger (OKLab som standard, eller `oklch`, `lab`, `lch`, `srgb`, `srgb-linear`, `hsl`, med en fargetone-reiseretning for de polare), og blanding er **forhåndsmultiplisert**, slik at en toning til gjennomsiktig beholder riktig farge i stedet for å mørkne mot svart underveis. Én interpolator betjener både forhåndsvisningen og eksportvandrerne - noe som er det som stoppet en konisk gradient fra å bli blandet på én måte på skjermen og en annen i den eksporterte filen.

**Skriving.** Utdataene er bevisst smalere enn inndataene, fordi en fil må være lesbar av hva enn som åpner den, og et rom blir bare *erklært* i utdata når tallene faktisk ble konvertert til det. Skjerm- og webformater skrives som **sRGB** og merkes deretter; utskriftsformatene skrives som **CMYK** mot en navngitt trykktilstand (nedenfor); og HDR-banen er **Rec.2100 PQ** (ovenfor). En bredfarget farge som når en eksport, kartlegges inn i sRGB heller enn feilmerkes - å føre `color(display-p3 …)` gjennom til en vektorfil er en planlagt utvidelse, ikke noe dagens eksporter hevder å gjøre. En gradient laget i OKLab er *bakt* til vanlige sRGB-stopp på vei ut, med ekstra stopp satt inn bare der sRGB synlig ville avvike fra den perseptuelle kurven, fordi en SVG `<linearGradient>` og en PDF-aksial skyggelegging ikke har noen interpolasjonsromsinnstilling til å bære intensjonen. Én laget verdi, tre rendrere, ingen avdrift.

## Fargeprofiler

Slik at farger gjengis trofast i fargestyrte apper (trykkerier, Photoshop, nettlesere), merkes eksporter med en **fargeprofil**:

- **PNG / JPG** bærer en innebygd **sRGB**-ICC-profil - fargerommet forhåndsvisningen faktisk rendres i - slik at ingenting blir overlatt til gjetning. (Kun merking; pikslene omkodes ikke.)
- **Utskrifts-PDF (CMYK)** erklærer en mål-**trykktilstand** i sin *OutputIntent* (standard *Coated FOGRA39*), som forteller en RIP/et trykkeri hvordan dens CMYK-blekk er ment å leses. Merkevaresvatcher med målte blekkverdier konverteres eksakt; andre farger bruker en standard enhetskonvertering. Den erklæringen er et *navn*: ingen CMYK-profil følger med Lolly, og PDF/X-4 vil ha profilen innebygd, så en navngitt tilstand skriver output intent uten å hevde PDF/X-4-samsvar. Last inn din egen CMYK-profil og velg dens **Embed**-rad i fargeprofil-kontrollen, så bygges den inn som filens *DestOutputProfile* - da kan PDF-en genuint være PDF/X-4, og hevder det når resten av filen tillater det. Tre ting holder tilbake påstanden mens outputintenten beholdes (en RIP vil fortsatt ha den): RGB-kunstverk CMYK-passet ikke kunne konvertere, `prov`-korrekturmargkredittteksten (tegnet i en standardskrift som ikke bygges inn, og X-4 gjør ingen unntak for dem) og et **Strong**-passord, siden X-4 forbyr kryptering. Tilstanden den erklærer leses så av fra den profilen: et registrert navn der profilen beviser ett, `Custom` under profilens eget navn der den ikke gjør det, slik at filen aldri kan navngi én trykktilstand mens den bærer en annens målinger.
- **Utskrifts-TIFF (CMYK)** skriver umerkede **DeviceCMYK**-piksler og registrerer samme trykktilstand som proveniens i sin TIFF-metadata (*ImageDescription*) i stedet for å bygge inn en profil. Den samme fargeprofil-kontrollen styrer begge CMYK-formatene - en TIFF kan ikke bygge inn en trykkprofil i det hele tatt, så en **Embed**-rad registrerer bare den profilens eget navn der.
- **TIFF (RGB)** er den enkle, ukomprimerte sRGB-søsteren - en tapsfri raster ved valgt DPI for arkivering eller en redigeringsrundtur, med proveniens registrert i samme TIFF-metadata. Eventuell gjennomsiktighet flates ut mot hvitt (denne profilen bærer ingen alfa). Som CMYK-TIFF-en er den kun for skrivebord, siden nettlesere ikke kan forhåndsvise en TIFF og mobilnedlastinger stopper opp.
- **SVG**, **EMF**, **EPS** og **DXF** er oppløsnings- og profiluavhengige vektorer uten innebygd profil - SVGs farger er vanlig sRGB, EMFs og EPSs er enhets-RGB (og **EPS (CMYK)** skriver naiv DeviceCMYK) og **DXF** bærer nærmeste AutoCAD Color Index. (SVG, EPS og DXF konturlegger, som PDF, all tekst til vektorbaner, slik at resultatet rendres selv der skriften ikke er installert. EMF holder i stedet tekst LEVENDE som standard - ekte metafil-tekstposter som forblir valgbare og redigerbare i Office og Google Slides, med fallback til konturer bare for tekstløp formatet ikke kan uttrykke; eksportpanelets «Outline fonts»-valg tvinger baner overalt.) **SVG** gjenskaper også CSS `box-shadow` fra HTML-en - hver ytre skygge males bak boksen, forskjøvet/spredt og gaussisk uskarplagt for å matche nettleseren, og innfelte skygger males inni den på samme måte.

Dette er automatisk - ingen innstilling å justere. Miniatyrbilder og forhåndsvisninger hopper over merket for å holde seg små. Én profil *er* et valg, fordi den endrer pikslene i stedet for bare å merke dem - se **HDR** nedenfor.

## HDR (lyse farger)

Vanlige eksporter er sRGB: hvitt er hvitt, og en metet merkevarefarge er like lys som skjermens vanlige hvitt. På en HDR-kapabel skjerm er det mye takhøyde over det, og **HDR**-kortet i eksportpanelet bruker det - merkevarefargene dine og hvit tekst løftes mot toppbrightheit slik at de virkelig *gløder*, mens de mørke områdene forblir mørke og gir gløden dens kontrast.

![HDR-kortet i eksportpanelet, slått på, med Hvit/Rekkevidde/Mørk løft/Fokus-hjulene avslørt under det](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formater.** Rasterformatene med plass til å bære signalet: **PNG**, **JPG**, **AVIF** og **TIFF**. (Ikke WebP - det er 8-bit uten en fungerende HDR-dekodevei, så en PQ-WebP ville rett og slett sett mørk ut. Vektorer og PDF har ingen HDR-modell i det hele tatt.)
- **Av som standard**, i motsetning til fargemerking - det endrer pikslene, så det er noe du selv velger på. Kryss av kortet, eller send `hdr=1` i en delingslenke.
- **Hva som faktisk skrives.** Pikslene kodes om til **Rec.2100 PQ** - BT.2020-primærfarger med SMPTE ST 2084 (PQ)-overføringskurven - og beholderen bærer det matchende signalet slik at en fargestyrt app vet å lese dem slik: en generert **ICC v4-profil med en `cicp`-tag** (JPG, TIFF), en **`cICP`-blokk** (PNG) eller en omskrevet `colr`-boks (AVIF). Løftet styres av **persepsjonell (OKLab) lyshet**, så farger fra midtparti og oppover skytes mot toppen mens mørke farger dempes i stedet for å blåses ut, og det er fargetonebevarende - en merkevaregrønn blir lysere, ikke myntegrønn.
- **Rattene.** Fire, synlige når kortet er på: **White** (taket for toppens lysstyrke, 400-2000 nits), **Reach** (hvor langt ned i tonene glansen sprer seg), **Dark lift** (hvor mye de mørke tonene lysner - `0` holder dem mørke) og **Focus** (hvor mye fargerikdom løftet beholder). De ligger i samme parameter som en kompakt justert verdi - `hdr=1600-60-0-50` er White 1600, Reach 60, Dark lift 0, Focus 50 - slik at et justert utseende kan gjenskapes fra lenken.
- **Hvor du vil se det.** Fargestyrte visningsprogrammer på en HDR-skjerm: Preview / Quick Look / Safari på Apple-enheter, Chrome på en HDR-skjerm. På en vanlig SDR-skjerm vises filen fortsatt som et normalt bilde.
- **Vit dette før du sender det ut.** Mange plattformer **koder om** det du laster opp og fjerner HDR-signalet - sosiale nettverk, meldingsapper, enkelte CMS-er - noe som kan gjøre at bildet ser mørkt eller utvasket ut. Bruk HDR der du kontrollerer målet (et nettsted du bygger, en videovegg, et sett på et lyssterkt panel), ikke som standard for alt.
- **Gjennomsiktighet.** PNG og AVIF beholder alfaen sin; JPG er ugjennomsiktig som alltid. **TIFF**-løypen flater ut mot **svart**, ikke SDR-løypens hvitt - i PQ er hvitt koden for 10 000 nits, så å flate ut mot det ville ringet hver kant med en blendende glorie.
- **De samme bytene fra terminalen.** `--hdr=1` sammen med `--export=png` eller `--export=jpg` skriver den 16-bit Rec.2100 PQ-PNG-en og ISO 21496-1-gain-map-JPEG-en på [CLI](/info/cli.html) også, fra de samme motorkoderne i stedet for en nettleser - så et `<svg>`-nativt verktøy produserer en HDR-fil uten Chromium noe sted i løypen, og PNG-en er byte-identisk med nettskallets. AVIF og TIFF forblir nettskall-eksporter foreløpig.

## Video

Animerte verktøy eksporterer bevegelse som **MP4**, **WebM** eller **GIF** - og, der tilbudt, **APNG**, **Animated WebP** eller vektor-**Animert SVG** (ovenfor). Hvilken videobeholder du ser avhenger av nettleseren din - velgeren viser bare det den faktisk kan ta opp:

| Nettleser | Viser |
|---|---|
| Safari / iOS | **MP4** |
| Firefox | **WebM** |
| Chrome / Edge 126+ / Android | **MP4 og WebM** |
| Eldre Chrome | **WebM** |

GIF fungerer overalt (flott for chat/e-post; større og med lavere fargeantall enn video). Animerte verktøy eksponerer også **Wait** (sekunder til animasjonen får sette seg før opptak) og **Duration** (klipplengde).

> En delt `?format=…`-lenke som ber om en beholder nettleseren din ikke kan ta opp, faller elegant tilbake til den andre og navngir filen deretter.

**Lyd.** Videoeksporter er ikke stille. Et verktøy kan legge en **musikkbunn** under klippet - en lydressurs fra katalogen, løkket eller trimmet til klippets lengde, med inn-/utfading, volum og automatisk ducking under opptakets egen lyd - og opptaksverktøyene fører opptakets levende lyd rett gjennom til filen. **MP4** og **WebM** beholder det mikserede sporet; GIF og de animerte bildeformatene (APNG, Animated WebP, Animert SVG) er stille av natur.

## Lyd

Noen verktøy eksporterer **lyd alene**, ikke bare som et videospor. **Voice Recorder** fanger et mikrofonopptak med en levende nivåmåler og forsiktig veiledning, og lagrer det så som **MP3** (standard, omkodet i nettleseren din) eller i sin native beholder - **M4A** (AAC), **OGG** eller **WebM** (Opus), avhengig av hva nettleseren din tok opp. Som med alt annet skjer omkodingen på enheten din - ingenting lastes opp.

Lyd du *tar med inn* er like bredt. Ressursvelgeren aksepterer **MP3**, **WAV**, **OGG**/**Opus**, **M4A**/**AAC** og **FLAC** (beholdt byte-for-byte og dekodet på enheten), **MIDI** (`.mid` - konvertert ved import til et lite synth-spor på enheten) og **trackermoduler** - **MOD**, **XM**, **IT**, **S3M**, **STM**, **MTM** (dekodet på enheten av en medfølgende spiller, noen kilobyte med sangdata). Alle disse kan bli **musikkbunnen** under en videoeksport, eller spilles i Neurospicy Modes ambiente spiller.

Lyd *er* en del av `format=`-/`--export=`-pipelinen nedenfor: `wav`, `mp3`, `m4a` og `opus` er vanlige format-id-er, så en kun-lyd-eksport er like delbar og like skriptbar som en PNG. Det som kommer ut er lyden alene, uten bilde.

## Proveniens og vannmerke

Der formatet støtter det, bærer eksporter **proveniensmetadata** - programvare, kilde, verktøyets navn og din profilkredittlinje - innebygd naturlig (PNG iTXt, JPEG EXIF, PDF-info, SVG `<metadata>`, GIF-kommentar). Det er kun forfatterskap; ingenting lastes opp. **Eksperimentelle** verktøy stempler i tillegg et synlig vannmerke, påført av verten slik at det ikke kan fjernes ved å redigere verktøyet.

**The Lolly Imprint.** Rastereksporter bærer også Lollys eget **usynlige pikselvannmerke** - *Lolly Imprint* - **på som standard**, akkurat som Content Credentials. Der credentialen og proveniensmetadataen reiser *ved siden av* pikslene og går tapt ved en ny lagring, et skjermbilde eller en metadatafjerning, lever Imprint *i* pikslene og overlever rekomprimering - slik at en kopi av bildet fortsatt kan gjenkjennes som Lolly-laget senere. Det er et varig hint, ikke en kryptografisk garanti, og det er kun-tilstedeværelse (det bærer ingen personopplysninger). Det følger med i **PNG, JPG, WebP, AVIF, TIFF og BMP**, og i de Lolly-rendrede rasterne komponert inn i en **PDF eller PPTX** - aldri i et bilde *du* la inn, bare i det Lolly selv rendrer. Fjern haken i **Lolly Imprint**-kortet i eksportpanelet for å hoppe over det, eller send `imprint=0` i en delingslenke. (AVIF-overlevelse gjennom rekoding er ikke kalibrert ennå; PDF/PPTX-deteksjon dekker de innebygde Lolly-rasterne.) [/verify](/verify) oppdager det på enheten - se [Content Credentials Identity](/info/content-credentials-identity.html#the-lolly-imprint).

**Den varige credentialen.** Et andre, tyngre merke sitter ved siden av Imprint: **Durable credential**, som bruker en nevral modell på enheten (TrustMark-format) til å skrive Lollys id *inn i* pikslene slik at «laget med Lolly»-lenken overlever en metadatafjerning, en rekoding og gjenlesing av TrustMark-kjente verktøy så vel som Lollys egne. Den er **av som standard** - i motsetning til den rene JavaScript-Imprinten koster den en nevral passering per eksport pluss en engangs modellnedlasting, så det er en bevisst opt-in heller enn en stille avgift. Kun raster (**PNG, JPG, WebP, AVIF, TIFF**), avkrysset i eksportpanelet eller sendt som `durable=1` i en delingslenke. På skrivebords- og mobilappene er kortet helt skjult i stedet for vist som en no-op, fordi det ikke finnes noen opprinnelse å hente modellen fra offline.

**Innholdsbeskyttelse.** I eksportpanelet foldes *Password protect*, **C2PA Credentials**, **Lolly Imprint** og **Durable credential** sammen til én kollapset, formatbevisst **Content protection**-gruppe, slik at en fils proveniens- og beskyttelsesvalg lever på ett sted - gruppen viser bare kortene som gjelder for det valgte formatet, og skjuler seg helt når ingen av dem gjør det. Trykkmerker er bevisst *ikke* i den: de er trykkproduksjonsgeometri heller enn beskyttelse, så **Print marks & bleed** - utfallsmålet i millimeter pluss Crop, Registration, Bleed, Colour bars og Stamp details - beholder sitt eget toppnivåkort på utskriftsformatene.

![Content protection-gruppen åpnet på en PNG-eksport, som viser bare kortene som gjelder for den](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

**Før du eksporterer (utskrifts-preflight).** Slå på **Print preflight** (`export-preflight`) i profilens funksjonsflagg - den er **av som standard**, slik at en enkeltperson som eksporterer en PNG for en chatmelding, aldri overraskes av førtrykkfunn, og en installasjons kontrollplan ([lolly.work](https://lolly.work)) kan sette den på som standard for sine medlemmer - og et **Before you export**-kort dukker opp nederst i panelet, rett over knappene, når utskriftsreglene har noe sant å si om jobben: format, størrelse og utfall, deretter beskjærings- og utfallsområder, blekkdekning, plateantall og sideantall, med en dom ved siden av overskriften. Det sitter under hver innstilling fordi det er en uttalelse *om* de innstillingene heller enn enda en av dem - og det blokkerer aldri en eksport. Det forteller deg hva et trykkeri er i ferd med å se.

**Kostnad, regnet ut fra din prisliste.** Under preflight - sist av alt, fortsatt over knappene - sitter et kort som gjør de samme tellingene om til penger, og bare noensinne fra priser noen har gitt det. Det leser hva enn preflight-passeringen talte, uansett om preflight-kortet selv er slått på eller ikke, og det trenger to ting som må stemme: jobben har noe en prisliste i det hele tatt kan prise (plater, ark, areal, sider, variantrader eller utdatafiler - slik at en enkel logo-PNG aldri viser det), **og** en **rate card** er til stede. En rate card er en JSON-prisliste fra trykkeriet ditt. En standardbygging har ingen og har ingen måte i appen å laste en inn: den ankommer enten som en katalogressurs en installasjon leverer, eller gjennom den valgfrie rate-card-utvidelsen en selvverter eller kontrollplan slår på. Uten en rate card vises ingenting - ikke en spørring, ikke en tom tabell.

Regelen hele greia er bygget rundt er at **den finner aldri opp penger**. Hvert tall er en sats du oppga ganger en mengde Lolly talte - `4 plater × 35,00 €` - og totalen navngir sin egen kilde i samme setning som tallet: utstederen kortet navngir, og datoen kortet sier satsene er fra. Det finnes ingen standardvaluta, ingen plassholder og ingen null som står inne for en manglende pris. Det filen sier om seg selv forblir referert tale: *«Filen sier: … Lolly har ikke bekreftet dette.»*

Og når den ikke kan beregne ærlig, **forsvinner** arbeidstabellen heller enn å degradere til et gråtonet eller utfylt tall:

- Linjer kortet ikke priser betyr **ingen total i det hele tatt** - bare en overskrift som sier hvor mange av dem som er upriset. En delsum er ikke et mindre svar, det er et feil ett.
- En mengde som er et tak heller enn et eksakt antall bærer **«opptil»** gjennom til sin delsum, slik at en grense aldri hvitvaskes til et flatt tall.
- Satser forbi sin gyldig-til-dato viser **kun antall**, inntil du trykker *Use these rates anyway* - og da rir utløpsdatoen med tallet, slik at en utløpt total ikke kan leses som en aktuell.
- Åpnet gjennom en **lenke**, forblir penger skjult inntil du ber om dem på denne enheten. Verken kortet eller den avsløringen reiser noensinne i en URL - samme grunn som CLI-en tar `--rate-card=<file.json>` som et lokalt filflagg og aldri som en lenkeparameter.

Kortet er chrome, aldri innhold: det strippes fra hvert eksporttrinn, slik at det ikke kan flytte en piksel av filen du laster ned. Og det er aritmetikk, ikke et tilbud - bare trykkeriet ditt kan gi deg ett.

**Komponerte rendringer.** Når et verktøy legger inn et annet verktøys utdata (f.eks. en *Event Name Badge* som legger inn en *QR Code*), innlemmes den nøstede rendringen i foreldrens eksport - den forblir en **ekte vektor** i SVG og PDF og rastreres skarpt i PNG/JPG/WebP. Det innebygde barnet er en mellomting: det får *ingen* vannmerke og *ingen* egen proveniens; bare den ferdige foreldreressursen får det. (Komponering dekker SVG og rasterformatene; HTML/MD/TXT kan ikke komponeres.)

## Passordbeskyttelse

To uavhengige typer lås, begge helt on-device.

**PDF-åpningspassord** - eksportpanelets *Password protect*-kort tilbyr to nivåer:

![Password protect-kortet utvidet på en PDF-eksport, med passordfeltet og de to låsnivåene](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

- **Standard** - en enkel 40-bits lås (RC4). Den åpnes i *enhver* PDF-app, og - siden den er et lett hinder, ikke reell beskyttelse - kan den følge med i en delingslenke (klartekst, med hensikt). Kun RGB `pdf`.
- **Strong** - AES-256 (PDF 2.0). Passordet skrives inn ved eksport og legges **aldri** i en lenke; det åpnes kun i nyere PDF-apper (Acrobat / Preview ~2018 og senere), og eldre apper kan melde at filen er skadet. Strong gjelder også **Print / CMYK-PDF-er** og **hver PDF inne i en batch-zip** (batch-bekreftelsesdialogen samler inn passordet). Fordi PDF/X-4 forbyr kryptering, beholder en Strong-låst Print-PDF sin CMYK, sine merker og output-intent, men mister PDF/X-4-samsvarserklæringen.

Begge nivåene er gjensidig utelukkende med Content Credentials (en kryptert PDF kan ikke få credentialen).

**Låste nedlastinger (hele zip-en + defense-in-depth)** - en **ZIP**-eksport (eksportpanelets *ZIP*-format, som samler flere av et verktøys formater), en **mappe**-nedlasting (Projects → Download) eller **batch-rutenettet** kan låse hele zip-en med ett passord, på to nivåer:

- **Standard** - tradisjonell **ZipCrypto**: åpnes i *ethvert* utpakkingsverktøy, inkludert Windows Explorers innebygde utpakking, men svak (et hinder). Passordet kan følge med i en `?password=`-delingslenke.
- **Strong** - **AES-256** (WinZip AE-2): sterk, men åpnes **ikke** i Windows Explorers innebygde utpakking - mottakeren trenger 7-Zip / WinZip / Keka / macOS. Skrives inn ved eksport, legges aldri i en lenke.

Det samme *Password protect*-kortet i eksportpanelet styrer både PDF- og ZIP-låsene, og ordlegger seg om etter valgt format. Det ene passordet beskytter **alle** medlemmer - bilder, SVG, alt, PDF-er inkludert (kun zip-beholderen kan beskytte filer som ikke er PDF, som ikke har noen egen lås). Og det er **defense-in-depth**: enhver PDF inni er *også* individuelt AES-256-låst med samme passord, så en PDF forblir låst selv etter at zip-en er pakket ut. Ledeteksten vises når du starter nedlastingen; et tomt passord betyr ingen lås.

**Passordbeskyttede delingslenker** - enhver delingslenke kan krypteres slik at det å åpne den ber mottakeren om et passord. Hele lenketilstanden er AES-256-kryptert under en nøkkel utledet fra passordet (PBKDF2); kun chiffertekst reiser, så **passordet er aldri i lenken**, og dekryptering skjer **i mottakerens nettleser** - serveren som betjener lenken ser kun chifferteksten i URL-en, aldri passordet og aldri det dekrypterte designet. Slå det på i **Share**-dialogen. En kryptert lenke kan kun *åpnes* i Lolly (den kan ikke bygges inn som et bilde, siden den veien ikke kan spørre om passord). Se [URL Mode → Encrypted links](/info/url-mode.html).

## Content Credentials (C2PA)

Eksporter kan bære **Content Credentials** - en signert [C2PA](https://c2pa.org)-manifest bygget inn i filen som på en manipulasjonssikker måte registrerer at filen ble laget med Lolly og ikke er endret siden. Det er den standardiserte versjonen av opprinnelsesmetadataen ovenfor: en kryptografisk påstand (hva som lagde filen, når, av hvem og hvor) bundet til en hash av filens bytes, slik at enhver senere endring kan oppdages av en C2PA-bevisst fremviser. Standarden forvaltes av [Content Authenticity Initiative](https://contentauthenticity.org) (Adobe, BBC, Microsoft, Nikon med flere), så de samme credentialene Lolly skriver, er dem kameraer, nyhetsredaksjoner og kreative programpakker tar i bruk.

![C2PA Credentials-kortet, forhåndsavkrysset, med credentialens levetid ved siden av](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Formater.** Enhver beholder med C2PA-innbygging: **PDF** (både RGB og Print), **PNG / Animated PNG**, **JPG**, **GIF**, **SVG**, **TIFF** (RGB og Print), **WebP** (stillbilde og animert), **AVIF**, **MP4**, **WebM** og lydbeholderne **MP3**, **WAV**, **M4A** og **OGG/Opus** - så en innspilt eller syntetisert stemmeklipp følges av samme credential som et bilde. En **ZIP**-pakke stempler hvert støttet medlem individuelt, som også er hvor en **Animated SVG** får sin (den er en vanlig SVG-dokument under panseret; en direkte Animated SVG-eksport tilbyr ikke noe eget kort). MP4, AVIF og M4A bruker spesifikasjonens BMFF-binding og MP3 dens ID3v2-mapping, så `c2patool` og andre C2PA-bevisste fremvisere kan verifisere dem; **WebM** og **OGG/Opus** har ennå ingen standardisert C2PA-mapping, så Lolly bærer manifestet som henholdsvis et Matroska-vedlegg og et OpusTags-felt, som Lollys egen verifisering (og CLI) sjekker. (`ico`, `eps`, `emf`, `dxf`, `bmp`, `pptx`, Office-formatene og tekst-/dataformatene har ingen C2PA-beholder.)
- **På som standard.** **C2PA Credentials**-kortet i eksportpanelet er forhåndsvalgt for nesten alle verktøy - fjern haken for å hoppe over credentialen på en enkelt eksport (eller send `c2pa=off` i en delingslenke). Et verktøy kan velge bort dette helt i manifestet sitt.
- **Hva som registreres.** Verktøyet og appen som lagde filen, signeringstidspunktet, eksportflaten (nettlesermotorfamilie + OS-familie - grovkornet med hensikt, aldri et fingeravtrykk) og - kun når *Profile → Use my details* er på - navnet og e-posten din som verkets opphavsperson.
- **Hva mottakere ser.** Verktøy for inspeksjon av content credentials (Adobe-apper, `c2patool`, contentcredentials.org/verify) vil lese manifestet og vise påstanden. Fordi Lolly signerer med en nøkkel generert **på din enhet** - ikke et sertifikat fra en tillitsliste - rapporterer fremvisere den som en *uverifisert* credential. Strukturen og manipulasjonssikkerheten er reell; det er kun signør-identiteten som ikke bekreftes av en autoritet. For å oppgradere det kan du registrere en **verifisert identitet** (Profile → Content Credentials): et kortlevd sertifikat fra Lolly CA knytter e-posten din til eksportene dine mens signeringsnøkkelen fortsatt aldri forlater enheten din - se [Content Credentials Identity](/info/content-credentials-identity.html).
- **Sjekke en fil.** Lolly verifiserer også sine egne credentials: slipp en fil på [/verify](/verify) (eller kjør `lolly validate <file>` i CLI-en) for en on-device-rapport - med overskriften om filen genuint ble laget med Lolly og er uendret siden. Web Verify-visningen leser langt utover credentialen: den flagger **AI-generert innhold**, oppdager **Lolly Imprint**, sjekker **SEAL**-signaturer og (opt-in) tredjeparts pikselvannmerker, og avdekker **skjulte data** - alt on-device, ingenting lastes opp. Se [Content Credentials Identity → Beyond the credential](/info/content-credentials-identity.html#beyond-the-credential-what-else-verify-shows).
- **Personvern.** Alt skjer på enheten din: signeringsnøkkelen lages for eksporten og forlater aldri nettleseren, ingenting lastes opp, og påstanden inneholder kun det opprinnelsesmetadataen allerede bærer. Personvernverktøy (on-device-transformasjoner av *dine egne* filer) legger aldri til credentials, og *Strip Hidden Data* fjerner en C2PA-manifest som all annen innebygd metadata.
- **Samspill.** For PDF-er er Content Credentials og **passordbeskyttelse** (begge nivåer - se ovenfor) gjensidig utelukkende (en kryptert PDF kan ikke få credential-vedlegget). Credentialen legges til som siste steg over de ferdige bytene - etter DPI-/EXIF-/fargeprofilstempling, PDF/X-metadata og trykkmerker.

## På en telefon

Eksportkontrollene ligger bak den flytende **Render**-knappen, som åpner **Export**-arket - samme formater, størrelse, kopiering, nedlasting og deling, tilpasset berøring.

## Formatreferanse

Hver id verten kan rendre, gruppert. Dette er også verdiene for URL-parameteren `format=` og CLI-flagget `--export=` - se [URL Mode](/info/url-mode.html) og [CLI](/info/cli.html). Et verktøy tilbyr kun undermengden forfatteren erklærte, så velgeren er alltid kortere enn denne listen.

| Type | Id-er |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vektor | `svg` · `svgz` (gzippet SVG) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (kuttfil) |
| Side og dokument | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `scorm` (SCORM-kurspakke, en zip) · `penpot` (Penpot-designfil) · `docx` (Word) · `odt` (OpenDocument Text) |
| Bevegelse | `gif` · `apng` (Animert PNG) · `webp-anim` (Animert WebP) · `svg-anim` (Animert SVG) · `webm` · `mp4` |
| Lyd | `wav` · `mp3` · `m4a` · `opus` |
| Tekst og data | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `css` · `scss` · `gpl` (GIMP-palett) |
| Samlepakke | `zip` |

Noen flere id-er kommer fra et **verktøys egen eksportkrok** i stedet for den delte rendrestien: `ase` (Adobe Swatch Exchange, fra Palette Lab), `exr` og `hdr` (Darkrooms high dynamic range-rastre) og `ttf` / `otf` / `woff` (Font Convert). De velger et format på samme måte - velgeren, `format=`, `--export=` - bytene bygges bare av verktøyet. Font Convert er det ene unntaket: det transformerer en fontfil *du* leverer, så det er ingenting for en ren URL å rendre.
