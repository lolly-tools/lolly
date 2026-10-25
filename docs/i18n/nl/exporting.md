# Een bestand exporteren

Je hebt iets gemaakt en het moet Lolly verlaten: een PNG voor een chat, een PDF voor de drukker, een deck dat een collega blijft bewerken. Druk op **Export**, de linkerhelft van de pil **Export | Save**. Kies naast de bestandsnaam een formaat en druk dan op **Download**. Het bestand wordt op je apparaat gemaakt.

Wat je op het canvas ziet is wat het bestand bevat. Het formaatmenu toont alleen wat deze tool in deze browser kan maken.

Voor de meeste klussen is een van drie formaten het juiste:

| Voor | Kies | Waarom |
|---|---|---|
| Een scherm, een bericht of een dia | **PNG** | Elke app opent het, en het behoudt een transparante achtergrond wanneer de tool die biedt |
| Een afgewerkte pagina, of iets dat gedrukt wordt | **PDF** | Een echte paginagrootte die afdrukt zoals hij eruitziet; **Print PDF**, waar een tool dat biedt, is de CMYK-versie voor een drukkerij |
| Werk dat op elk formaat scherp moet blijven | **SVG** | Vectorvormen, scherp van een badge tot een banner |

::: check Controleer het bestand op het formaat waarin het gebruikt wordt
Voordat je het verstuurt, open het op het scherm waarvoor het gemaakt is, of druk het af op het echte formaat.
:::

::: details Goedkeuringen en bezorging met Lolly Work (optioneel)
Een [organisatie die Lolly Work draait](/info/organisation.html) kan bepalen welke formaten en exportinstellingen haar leden zien. Waar goedkeuring vereist is, komt **Request approval** in de plaats van **Download**. Volg het beleid dat je instantie toont.

Lolly Work kan een bestand ook bezorgen bij geconfigureerde S3-, WebDAV- en HTTP-bestemmingen, met goedkeuringsstappen, bezorgbewijzen en een auditrecord. Een bestand indienen voor die workflow stuurt het naar de dienst van de organisatie; een gewone download blijft op je apparaat. Persoonlijke Send-bestemmingen en organisatiebezorging worden apart geconfigureerd.

Beheerders zetten dit op met de [bezorggids voor organisaties](/info/work-delivery.html). Voor server-renders en batches in de wachtrij, zie [CLI batch and automation](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

## Hoe exporteren werkt

Wanneer je exporteert, wordt het canvas van de tool gerenderd naar het formaat dat je koos en als download aan je overhandigd, of op je klembord gezet.

Drie paden maken een bestand. De meeste tools **renderen het canvas**. Tekst- en gegevensformaten (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) worden **gegenereerd uit de inhoud van de tool** in plaats van getekend uit het beeld. Privacyhulpprogramma's zoals *Strip Hidden Data* **transformeren het bestand dat je koos**, op je apparaat, en geven het terug zonder canvas, watermerk of toegevoegde metadata, omdat het al je eigen bestand is.

![Drie exportpaden komen samen in een afgerond bestand: het canvas renderen, tekst of gegevens uit inhoud genereren, of een gekozen bestand op het apparaat transformeren.](/info/diagrams/concepts/three-export-paths.svg)

Het exportpaneel biedt deze acties. De maker van een tool kiest welke verschijnen; de standaardset is Copy, Download en Save.

- <!--i:download--> **Download** slaat het bestand op. Als je het daarna niet kunt vinden, zie [Een gedownload bestand vinden](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> **Copy** zet de afbeelding op je klembord, klaar om te plakken in een chat, een e-mail of een document. Waar een browser geen afbeeldingen kan kopiëren, downloadt hij in plaats daarvan en zegt dat.
- <!--i:folder--> **Save** bewaart het huidige ontwerp met één klik in Projects en downloadt nooit een bestand. **Save as**, naast **Download**, vraagt waar (zie [Opslaan en doorgaan](/info/using.html#saving-continuing)).
- <!--i:link--> **Share** opent de Share-dialoog: een link die het ontwerp reproduceert, de schakelaars voor bij bezoek (volledig scherm, exportpaneel, downloaden of kopiëren bij openen) en een optionele **Shortest link** die de hele status in een compact token pakt (zie [URL Mode](/info/url-mode.html)).

![Het exportpaneel - formaat, grootte en de acties Kopiëren / Downloaden / Opslaan / Delen](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Wanneer een ontwerp de render van een andere tool insluit, zoals een Design-afbeeldingsvak met een QR Code-link, wordt de geneste render in de export van de ouder getekend. Ze blijft echte vector in SVG en PDF en rastert scherp in PNG, JPG en WebP. De ingesloten render krijgt geen watermerk en geen eigen herkomst; alleen het afgeronde bestand. Exports naar HTML, Markdown en TXT kunnen geen samengestelde render bevatten.

## Kies een formaat

De bestandsnaam en het formaatmenu staan samen als één paar `name.format`, onder **Downloaden**.

![Het bestandsnaamveld samengevoegd met de formaatkiezer, zodat de export als één paar naam.formaat leest](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Begin bij waar het bestand heen gaat. Elke kaart noemt de formaten die bij die bestemming passen; een tool toont alleen de formaten die hij kan maken.

::: figure exporting-format-chooser
Zes bestemmingen en de formaten die bij elk passen.
:::

Een woordmerk gezet in het lettertype van je design system exporteert als SVG met elke letter als omlijnd pad, zodat één bestand scherp blijft op visitekaartjesformaat en op gebouwformaat.

![Een haarfijn woordmerk met wijde letterspatiëring dat Aurora leest, het soort zuivere vectorartwork waar de SVG-rij van de tabel over gaat](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Elk formaat en waar het voor dient
| Je wilt | Gebruik | Waarom |
|---|---|---|
| Scherpe logo's of artwork dat schaalt | **SVG** | Vector: schaalbaar, klein en bewerkbaar; een effect dat de vectorexport niet kan tekenen wordt als afbeelding ingesloten |
| Vector voor Office- en Windows-apps | **EMF** | Plakt als bewerkbare vector in PowerPoint en Word, met live tekst; Google Drive opent het in Google Drawings |
| Vector voor druk- en ontwerpapps | **EPS**, of **EPS (CMYK)** | PostScript-vector voor Illustrator en persworkflows |
| Vector voor snijmachines | **DXF** | Lasersnijders, vinylplotters en CNC: omtrekpaden in millimeters |
| Een bewerkbaar diadeck | **PowerPoint** (PPTX) | Native bewerkbare tekst en vormen, met afbeeldingen en vectoren die extraheerbaar blijven |
| Een bewerkbaar tekstdocument | **Word** (DOCX) of **OpenDocument** (ODT) | Echte alinea's en koppen die een tekstverwerker kan blijven bewerken (Doc Studio) |
| Een lay-out voor InDesign | **InDesign IDML (static subset)** | Tekst, rechthoeken, ovalen en afbeeldingen, één spread per tekenbord (Design) |
| Een bewerkbaar Penpot-document | **Penpot** | Boards, vormen, tekst en gekoppelde tokens |
| Een foto of algemeen bruikbare afbeelding | **PNG** (verliesvrij) of **JPG** (kleiner) | Universeel raster |
| Kleinere moderne afbeeldingen | **WebP** of **AVIF** | Betere compressie, met transparantie |
| Drukwerk | **PDF**, of **Print PDF** (CMYK) | Echt paginaformaat; CMYK voor een pers |
| Drukraster voor een pers | **Print TIFF** (CMYK) | DeviceCMYK-pixels voor een RIP |
| Geanimeerd voor het web | **GIF** | Speelt overal; grotere bestanden |
| Geanimeerd met volle kleur en echte transparantie | **APNG** | Geanimeerde PNG: geen paletbeperking |
| Geanimeerd, kleinste bestand | **Animated WebP** | Volle kleur en transparantie, kleiner dan GIF of APNG |
| Geanimeerde vector die schaalt | **Animated SVG** | Zelfstandig; loopt in een browser of een `<img>`, op elk formaat (Lottie Ad) |
| Een animatie die bewerkbaar blijft | **dotLottie** | Vormen, paden en uiterlijke transformatiesleutels uit de tijdlijn van Design |
| Een overdracht naar Premiere | **Premiere XML + media** | Getimede clips en originele media voor Premiere (Design) |
| Video voor social media en delen | **MP4** of **WebM** | Beste kwaliteit voor de bestandsgrootte (zie [Video](#video)) |
| Ondertitels | **SRT** of **VTT** | Getimede tekst voor een videospeler (Captions, Audiogram en Record) |
| Een trainingscursus | **SCORM (LMS)** | Een versiebeheerde website, SCORM- of xAPI-pakket (zie [SCORM](#scorm-course-packages)) |
| Opgemaakte tekst of een e-mailhandtekening | **HTML** | Plakt opgemaakt in mailclients |
| Gewone inhoud | **MD** of **TXT** | Alleen tekst |
| Een agenda-afspraak | **ICS** | Importeert in elke agenda-app |
| Een contactkaart | **VCF** | Importeert in adresboeken |
| Gestructureerde gegevens om opnieuw te importeren | **JSON** of **CSV** | Round-trip van de inhoud van de tool |
| Een favicon | **ICO** | Siteicoon met meerdere formaten; **ZIP** bundelt meerdere formaten |
:::

### Transparantie

Tools die het ondersteunen bieden een schakelaar voor transparante achtergrond, zoals **No BG**. PNG, WebP, AVIF, SVG, APNG en Animated WebP behouden transparantie, en GIF behoudt een harde rand. JPG en PDF zijn altijd ondoorzichtig. TIFF vlakt af op wit, of op zwart op het HDR-pad dat onder [HDR](#hdr-bright-colours) wordt beschreven.

## Formaat en drukeenheden

Exports gebruiken het native pixelformaat van de tool, tenzij de tool **dimensies** biedt. Dan stel je breedte, hoogte en een **eenheid** in:

- **px** (de standaard) is exacte pixels.
- **mm, cm, in, pt** en **pc** zijn fysieke formaten. Met een fysieke eenheid stel je ook **DPI** in (standaard 300). Een **PDF** wordt een echte pagina op dat formaat, een **raster** krijgt het pixelaantal voor die DPI en legt de resolutie vast, en een **SVG** behoudt de fysieke eenheid met een pixel-viewBox.

Voor een raster met hogere resolutie voer je een grotere breedte en hoogte in, of kies je een fysieke eenheid en verhoog je de DPI (pixels = formaat × DPI). Breedte `210`, hoogte `297` en eenheid `mm` maken een A4-pagina.

![De afmetingenrij ingesteld op 210 bij 297 mm, met het DPI-veld zichtbaar omdat de eenheid fysiek is](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Stills uit een getimede compositie

Een getimede compositie, zoals een [Sequence](/info/sequence-editor.html)-tijdlijn in Design, beweegt, dus een stilstaande export moet een moment kiezen: **het beeld bij de afspeelkop**. Zet de afspeelkop waar je het beeld wilt en exporteer.

Voor meer dan één moment verschijnt het veld **Frames** naast het uitvoerformaat. Het toont zich alleen voor een getimede compositie en een stilstaand formaat (PNG, JPG, WebP, SVG of PDF). Laat het op `1` voor het beeld bij de afspeelkop. Verhoog het en je krijgt zoveel stills, gelijkmatig verdeeld over de hele sequentie:

- PNG, JPG, WebP en SVG komen terug als één ZIP: `<name>-01.png`, `-02.png` enzovoort.
- PDF komt terug als één document met zoveel pagina's.

Elke still komt uit het midden van zijn deel van de tijdlijn, dus het eerste beeld is nooit een half vervaagde entree en het laatste is nooit het lege moment nadat elke clip is afgelopen.

::: figure exporting-contact-sheet
Frames: 4 snijdt de sequentie in vier gelijke delen en neemt het midden van elk.
:::

Gebruik het voor een storyboard, een review-contactvel of een social carrousel uit een videomontage. Het aantal is begrensd op 64, en al het andere dat in het veld wordt getypt valt terug op `1`. Elk beeld is een gewone still, dus credentials, de Imprint, fysieke eenheden en DPI gedragen zich zoals bij één export. Een exportlink, de CLI en MCP vragen hetzelfde vel aan met `cuts=` (zie [Contactvellen](/info/url-export.html#contact-sheets)).

## Veel bestanden tegelijk

Lolly heeft drie manieren om op volume te werken, elk voor een andere klus:

::: cols
## Een tabel wordt één document
Een tool met een tabelinvoer, zoals **Battlecards**, maakt van elke rij een pagina. Plak een tabel uit je spreadsheet en krijg één PDF. Corrigeer rijen in de spreadsheet en plak opnieuw.
## Een CSV wordt één bestand per rij
**Batch** (`#/batch`) neemt een CSV en rendert een export voor elke rij: naambadges of certificaten, elk een bestand, geleverd in een ZIP. Zie [Batch](/info/batch.html#make-many-versions-of-one-design).
## Meerdere ontwerpen krijgen één bewerking
**Multi-edit** opent meerdere opgeslagen sessies naast elkaar voor dezelfde bijwerking over verschillende ontwerpen. Zie [Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Vanuit **Projects** exporteert **Render folder** elke opgeslagen sessie in een map en haar submappen als één geneste ZIP, en **Render selection** doet hetzelfde voor elke meervoudige selectie; één opgeslagen sessie rendert naar zijn eigen bestand. Een opgeslagen sessie kan vanuit Projects ook opnieuw worden gedeeld als toollink, die haar met dezelfde instellingen heropent.

## Bestanden die elders bewerkbaar blijven

Sommige formaten geven je werk aan een andere toepassing door als bewerkbare inhoud in plaats van een afbeelding.

### PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart, Diagrams, Flow Chart en Agenda exporteren een PowerPoint-deck, één dia per pagina. Elke pagina wordt uit elkaar gehaald in native objecten, zodat een collega het deck kan bewerken en assets eruit kan halen:

- <!--i:font--> **Tekst** wordt bewerkbare PowerPoint-tekstvakken met de lettergrootte, kleur, dikte, cursief en uitlijning van de lay-out.
- <!--i:pentool--> **Vectoren** zoals logo's en pictogrammen worden ingesloten als SVG-afbeeldingen; ze blijven scherp, en PowerPoint kan er *Convert to Shape* op toepassen.
- <!--i:photos--> **Afbeeldingen** komen binnen op native resolutie als eigen afbeeldingen. Een bijgesneden hero behoudt de volledige afbeelding achter de uitsnede, en elk filter of elke mengmodus erop wordt ingebakken.
- <!--i:layers--> **Achtergronden, randen en lijnen** worden rechthoek- en lijnvormen.

![Het exportpaneel met PowerPoint gekozen: één slide per pagina, tekst en vormen blijven bewerkbaar](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

De lay-out is bij benadering; het doel is herbruikbare inhoud. Alles wat de walker niet native kan uitdrukken, zoals een complex gefilterd of gemaskeerd gebied, wordt als afbeelding ingesloten zodat niets verloren gaat. Een deck heeft één diaformaat, overgenomen van de eerste pagina.

PowerPoint is ook een ingang: [Rebrand a deck](/info/rebrand.html) zet een deck over naar je design system, en [Een ontwerp importeren](/info/design-import.html) opent er een in Design.

### Penpot

De meeste tools die SVG exporteren, exporteren ook een **Penpot-bestand** (`.penpot`), klaar om in Penpot te blijven bewerken.

| Wat je maakte | In Penpot |
|---|---|
| Tekst | Bewerkbare tekstobjecten: corrigeer een typfout of geef een andere stijl |
| Vormen, paden, verlopen en afbeeldingen | Hun eigen bewerkbare vectorvormen |
| Een kleur of lettertype uit een design-systeemtoken | Een live tokenkoppeling: bewerk het token en elke vorm die het erft volgt |
| Het hele ontwerp | Een herbruikbare component in het paneel Assets |
| Een complexe illustratie of live canvas | Op zichzelf ingesloten als afbeelding, de bewerkbare inhoud eromheen onaangeroerd |

Vanuit Design wordt elk kader een Penpot-board. De kleuren en typografieën van het design system komen in het paneel Assets en de volledige tokenset in het paneel Tokens. Penpot houdt vanaf daar een eigen kopie: een token dat in Penpot is bewerkt komt terug via de import in [Design System Setup](/info/brand-studio.html).

![Het exportpaneel met Penpot gekozen: het .penpot-bestand, en Send to Penpot naast de download](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Om het bestand te openen start je Penpot, kies je een project en kies je **Import**. Als je vanuit het exportpaneel bij Penpot bent aangemeld, doet **Send to Penpot** die stap voor je.

### Word, OpenDocument en InDesign

**Doc Studio** exporteert **Word** (DOCX) en **OpenDocument** (ODT) met echte alinea's en koppen.

**Design** exporteert **InDesign IDML (static subset)**: tekst, rechthoeken, ovalen en PNG- of JPEG-afbeeldingen, één spread per tekenbord. Ondersteunde inline opmaak blijft bewerkbaar, afbeeldingen reizen in `Links` en coördinaten worden InDesign-punten. Opnieuw koppelen, lettertypevervanging en gewijzigde omloop kunnen aandacht nodig hebben. Effecten, animatie, samengestelde verhalen en niet-ondersteunde geometrie stoppen de export met een rapport dat ze noemt. IDML behoudt het oorspronkelijke document niet, dus stuur PDF voor afgerond artwork.

### Tijdlijnen: dotLottie en Premiere

Vanuit de tijdlijn van Design schrijft **dotLottie** een animatie die bewerkbaar blijft in Lottie-tools; [Lottie animations](/info/sequence-editor.html#lottie-animations) noemt wat ze behoudt. **Premiere XML + media** verpakt getimede clips en hun originele media voor Premiere; zie [Premiere XML exchange](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (cursuspakketten)

Cursusexport staat uit totdat je **Training and courses** aanzet onder Settings → Preferences → Feature flags.

Kies dan **Export course** in een ondersteunde tool, een projectmap of een selectie. In Design opent het kiezen van **SCORM (LMS)** en **Download** dezelfde cursusworkflow. Lolly slaat het werk op, laat je de cursusinhoud en -volgorde bekijken en opent dan de module en zijn exportdialoog.

- <!--i:layers--> Kies een weergave voor elke bron: stilstaande pagina's, beweging als video, audio of een downloadbare bron. Voeg lestekst en leesalternatieven toe in de module.
- <!--i:clock--> Bekijk de speler voor leerlingen en beoordeel beschrijvingen en ondertitels. Beweging wordt als video opgenomen, ook stille animatie.
- <!--i:document--> Kies Website, SCORM 1.2, SCORM 2004 4th Edition of een experimenteel xAPI-doel. Controleer de inhoud en de ZIP-grootte, sla dan de gecontroleerde versie op en download die.
- <!--i:check--> Voltooiing vereist dat elke verplichte les wordt bevestigd en Finish wordt gekozen.

![Het exportpaneel op een Design-deck met SCORM (LMS) gekozen](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Het pakket bevat zijn afgeronde inhoud en heeft geen Lolly-account nodig. Zet een Website-ZIP op een HTTP(S)-host; importeer een LMS-ZIP ongewijzigd. Test de bestemming voordat je de cursus deelt. Voor een cursus uit meerdere opgeslagen creaties, zie [Create a training course](/info/training-creators.html).

### DXF (snijbestanden)

Asset Export, Diagrams, Growth, Logo Wall, QR Code, Street Map, Wayfinding en Wordmark exporteren **DXF**, het AutoCAD R12-uitwisselingsformaat dat lasersnijders, vinylplotters en CNC-software lezen. Geometrie wordt geschreven als omtrekpaden in millimeters, tekst wordt omlijnd en kleur wordt toegewezen aan de dichtstbijzijnde AutoCAD Color Index, die meestal de bewerking van de snijder aanstuurt. DXF is alleen lijntekening: een fotografisch of gefilterd gebied heeft geen snijpad en wordt weggelaten, met een waarschuwing. Gebruik SVG of PDF om rasterinhoud te behouden.

Street Map is het duidelijkste geval. Het hele ontwerp bestaat al uit lijnen, dus elke weg en gracht wordt een snijpad.

::: showcase
![Een Street Map-render van Parijs in inkt op crème - pure lijnkunst, zodat elke lijn de reis naar een snijmachine overleeft](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Scroll, en de camera zoomt terug door de daadwerkelijke geometrie: zeven paden, nergens pixels, elke lijn haarlijn-scherp op elke zoom. Dat is hetzelfde bestand dat een snijmachine leest.
:::

## Drukwerk

**Print PDF** schrijft CMYK tegen een benoemde drukconditie, standaard **Coated FOGRA39**. Merkstalen met gemeten inktwaarden worden exact omgezet; andere kleuren gebruiken een standaard apparaatomzetting. **Print TIFF** schrijft DeviceCMYK-pixels voor een RIP en legt dezelfde drukconditie vast in zijn TIFF-metadata. De bediening Colour profile stuurt beide; [Kleurprofielen](#colour-profiles) bevat de details.

**Print marks & bleed** heeft een eigen kaart bij de drukformaten: de afloop in millimeters plus Crop, Registration, Bleed, Colour bars en Stamp details.

Sommige tools bouwen een **PDF met meerdere pagina's**: een omslag, inhoud die doorloopt over zoveel pagina's als nodig en een achterpagina, zoals in de tool *Booklet*. Elke pagina is een echte staande PDF-pagina in A4, US Letter of A5, en je kunt elk blok op een nieuwe pagina forceren. Dit zijn RGB-documenten zonder snijmerken of afloop, die bij de Print PDF van één pagina horen. Een Design-PDF kan ook een **Notes handout** zijn: een staande pagina voor elke dia met de sprekersnotities eronder.

**Voordat je exporteert.** Een kaart **Before you export** onderaan het paneel zegt wat een drukker straks gaat zien: formaat, grootte en afloop, snij- en afloopgebieden, inktdekking, aantal platen en aantal pagina's, met een oordeel naast de kop. Ze blokkeert nooit een export. Design toont de kaart altijd met zijn eigen controles, inclusief de huisstijlregels van het design system laag voor laag en het schrijfsignaal voor de tekst van het document ([Voordat je exporteert](/info/design.html#before-you-export)), en voegt deze drukcontroles toe wanneer **Print preflight** aan staat. Zet in andere tools **Print preflight** aan onder Settings → Preferences → Feature flags; het staat standaard uit, en een Lolly Work-implementatie kan het voor haar leden aanzetten.

**Nadat je exporteert.** Zodra het bestand klaar is, leest Lolly het terug en vergelijkt het met wat je koos: formaat, pixel- of paginaformaat, cliplengte, een transparante achtergrond, CMYK-kleur, HDR, Content Credentials en een PDF- of ZIP-wachtwoord. Alles wat afwijkt wordt op de exportkaart geschreven. Elke meting komt uit het bestand, nooit uit de instelling, en een eigenschap die het bestand niet kan beantwoorden telt niet als overeenkomst. De opdrachtregel schrijft de volledige vergelijking met `--export-report` (zie [Render with the CLI](/info/cli-rendering.html)).

De inspectorcontroles van Design en de merkvergelijking in Design System Setup zijn aparte controles: ze kijken naar het ontwerp, terwijl deze twee kaarten naar het bestand kijken.

::: details Kosten uit een tarievenkaart
Onder preflight zet een kostenkaart dezelfde aantallen om in geld, met alleen prijzen die iemand heeft aangeleverd. Ze leest die aantallen ook als de preflightkaart zelf uit staat. Ze heeft twee dingen nodig: een klus die een prijslijst kan prijzen (platen, vellen, oppervlak, pagina's, variantrijen of uitvoerbestanden, dus een gewone logo-PNG toont haar nooit) en een **rate card**, een JSON-prijslijst van je drukker. Een standaardbuild bevat er geen en heeft geen manier in de app om er een te laden. Een tarievenkaart komt als catalogusasset die een implementatie meelevert, of via de optionele tarievenkaartextensie die een zelfhoster of controlevlak aanzet. Zonder tarievenkaart wordt niets getoond.

Elk bedrag is een tarief dat jij aanleverde maal een hoeveelheid die Lolly telde, zoals `4 plate × €35.00`, en het totaal draagt zijn bron: de uitgever op de kaart en de datum van de tarieven. Er is geen standaardvaluta en geen plaatsvervangende prijs. Wat het bestand over zichzelf zegt, blijft indirecte rede: *"The file says: … Lolly has not verified this."*

Wanneer een bedrag niet kan worden uitgerekend, wordt de tabel ingetrokken in plaats van ingevuld:

- Regels die de kaart niet prijst betekenen **helemaal geen totaal**, alleen een kop die zegt hoeveel regels geen prijs hebben.
- Een hoeveelheid die een plafond is, neemt **"up to"** mee in haar subtotaal.
- Tarieven na hun geldig-tot-datum tonen **alleen aantallen** totdat je op *Use these rates anyway* drukt; de verloopdatum reist dan mee met het bedrag.
- Geopend via een **link** blijft geld verborgen totdat je er op dit apparaat om vraagt. De CLI neemt `--rate-card=<file.json>` aan als lokaal bestand en nooit als linkparameter.

De kaart wordt uit elke exportfase gehaald, dus ze verandert het bestand nooit. Het is rekenwerk, geen offerte; alleen je drukker kan een offerte maken.
:::

## Beweging en geluid

### Video

Geanimeerde tools exporteren **MP4** en **WebM**. De kiezer toont alleen de containers die deze browser kan maken, en een gedeelde `?format=`-link die er een vraagt die hij niet kan maken, valt terug op de andere, met een passende bestandsnaam. Geanimeerde tools bieden ook **Start after**, dat het canvas even stil houdt zodat animaties en lettertypen zich zetten voordat de opname begint, en **Duration**, de lengte van de afgeronde clip. **Motion blur** (Off, Draft quality, Standard of High, met een **Shutter angle**) vervaagt snelle beweging ten koste van rendertijd. Waar de browser het ondersteunt, neemt **Record live** het voorbeeld op het scherm in realtime op via een schermdeling.

![De timinginstellingen voor een geanimeerde export: Start after, Duration, Motion blur met zijn Shutter angle, en Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** kiest Smaller file, Balanced of Best quality. **Advanced** opent **Codec**, **Frame rate**, **Rate mode** en **Hardware acceleration**. Waar een tool ondertitels heeft, kiest **Captions** een **Embedded track** of een **Sidecar .vtt + .srt** naast de video. Een link draagt de kwaliteit, codec, framerate, duur en startvertraging als `vq`, `codec`, `fps`, `seconds` en `wait` ([URL parameters](/info/url-parameters.html)).

Video-exports behouden hun geluid. Een tool kan een **muziekbed** onder de clip leggen: een audioasset in een lus of getrimd tot de cliplengte, met fades, volume en ducking onder het eigen geluid van het beeldmateriaal. De opnametools nemen hun live audio mee naar het bestand.

Een Design-deck dat een klikdeck blijft, kan toch als video vertrekken. **Export slides as video** in het menu Present opent het exportvenster op MP4. Elke dia speelt gedurende zijn eigen verblijftijd, of gedurende de Duration van het exportvenster als hij er geen heeft, en de diaovergang van het deck speelt ertussen als een dissolve. Het document zelf verandert niet.

### Geanimeerde afbeeldingen

**GIF** speelt overal en past bij chat en e-mail; het is groter en heeft minder kleuren dan video. **APNG** en **Animated WebP** behouden volle kleur en transparantie. **Lottie Ad** exporteert ook **Animated SVG**: vectorbeelden met ingesloten CSS-keyframes, dus het schaalt naar elk formaat en loopt in een browsertabblad of een `<img>` zonder codec. De tekst is omlijnd, en het gebruikt een lagere standaardframerate omdat elk beeld zwaarder is dan een bitmap. Al deze zijn stil.

### Audio

Sommige tools exporteren geluid op zichzelf. **Voice Recorder** neemt een microfoontake op met een live niveaumeter en slaat die op als **MP3**, **WAV**, **M4A (AAC)** of **Opus (WebM)**, op je apparaat gecodeerd. `wav`, `mp3`, `m4a` en `opus` zijn gewone formaat-id's, dus een audio-export is net zo deelbaar en scriptbaar als een PNG.

De assetkiezer accepteert een breed scala aan audio voor een muziekbed, van MP3 en FLAC tot MIDI en trackermodules; [Formats](/info/formats.html) noemt ze. Een [Rondocode-nummer](/info/rondocode.html) speelt op welke lengte zijn clip ook vraagt.

## Kleur en HDR

Lolly leest elke moderne CSS-kleur, doet zijn kleurwiskunde perceptueel en schrijft elk bestand in een ruimte die een lezer kan openen: sRGB voor schermen, CMYK voor drukwerk en Rec.2100 PQ voor HDR. [Colour in the engine](/info/colour-engine.html) legt uit hoe. Een Design-document met **Wide colour / HDR** volgt zijn eigen regels, beschreven in [Wide colour and HDR editing](/info/hdr-editing.html).

### Kleurprofielen

Exports worden gelabeld met een kleurprofiel, zodat kleurbeheerde apps zoals drukkerijen, Photoshop en browsers de kleuren lezen zoals jij ze zag. Dit gebeurt automatisch; miniaturen en voorbeelden slaan het label over om klein te blijven.

- **PNG en JPG** dragen een ingesloten ICC-profiel **sRGB**, de ruimte waarin het voorbeeld wordt getekend. De pixels worden gelabeld, niet opnieuw gecodeerd.
- **Print PDF (CMYK)** verklaart zijn drukconditie in zijn *OutputIntent*, waarmee een drukker weet hoe zijn CMYK-inkten bedoeld zijn gelezen te worden.
- **Print TIFF (CMYK)** schrijft ongelabelde DeviceCMYK-pixels en legt de drukconditie vast in zijn TIFF-metadata. Een TIFF kan geen drukprofiel insluiten, dus een rij **Embed** legt alleen de naam van dat profiel vast.
- **TIFF (RGB)** is de ongecomprimeerde sRGB-tegenhanger voor archief of een round trip met een editor. Hij vlakt transparantie af op wit. Beide TIFF's zijn alleen voor desktop, omdat browsers geen TIFF kunnen tonen.
- **SVG**, **EMF**, **EPS** en **DXF** zijn vectoren zonder ingesloten profiel: de kleuren van SVG zijn sRGB, EMF en EPS gebruiken apparaat-RGB, **EPS (CMYK)** schrijft DeviceCMYK en DXF gebruikt de AutoCAD Color Index. SVG, EPS en DXF zetten tekst om in paden. EMF houdt tekst live en bewerkbaar in Office en Google Slides, en valt alleen terug op omtrekken voor stukken die het formaat niet kan uitdrukken; de optie **Outline fonts** van het exportpaneel forceert overal paden. SVG reproduceert ook CSS-boxschaduwen, binnen en buiten.

::: details PDF/X-4 en je eigen drukprofiel
Er wordt geen CMYK-profiel met Lolly meegeleverd. Een benoemde drukconditie schrijft de output intent zonder PDF/X-4-conformiteit te claimen, omdat PDF/X-4 het ingesloten profiel wil.

Laad een eigen CMYK-profiel en kies zijn rij **Embed** in de bediening Colour profile. Het wordt ingesloten als *DestOutputProfile* van het bestand, en de PDF claimt PDF/X-4 zodra de rest van het bestand dat toelaat. De drukconditie die ze verklaart wordt van dat profiel afgelezen: een geregistreerde naam waar het profiel er een bewijst, of `Custom` onder de eigen naam van het profiel.

Drie dingen houden de claim tegen terwijl de output intent blijft: RGB-artwork dat de CMYK-pass niet kon omzetten, de creditstekst van de `prov`-proefmarge (getekend in een standaardlettertype dat niet is ingesloten) en een **Strong**-wachtwoord, aangezien PDF/X-4 versleuteling verbiedt. Elke PDF bevat ook PDF/X-4-metadata: paginaboxen, XMP, een document-ID en een sRGB-output intent met zijn profiel.
:::

### HDR (heldere kleuren)

Dit is de kaart **HDR** van het exportpaneel, die gewoon artwork helderder maakt voor HDR-schermen. HDR-originelen behouden tijdens het bewerken is een andere functie: [Wide colour and HDR editing](/info/hdr-editing.html).

Een gewone export is sRGB: een verzadigde merkkleur is zo helder als het normale wit van het scherm. Een HDR-scherm heeft ruimte erboven. De kaart **HDR** versterkt je merkkleuren en witte tekst richting piekhelderheid, terwijl donkere gebieden donker blijven en de gloed zijn contrast geven.

![De HDR-kaart in het exportpaneel, ingeschakeld, met de knoppen White / Reach / Dark lift / Focus eronder zichtbaar](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formaten.** PNG, JPG, AVIF en TIFF. WebP is 8-bit zonder werkend HDR-decodepad, en vectoren en PDF hebben geen HDR-model.
- **Standaard uit**, omdat het de pixels verandert. Vink de kaart aan, of geef `hdr=1` mee in een deellink.
- **De knoppen.** **White** (het plafond van de piekhelderheid, 400 tot 2000 nits), **Reach** (hoe ver de gloed zich door de tonen verspreidt), **Dark lift** (hoeveel de donkere tonen oplichten; `0` houdt ze donker) en **Focus** (hoeveel kleurrijkdom de versterking behoudt). Ze reizen als één waarde: `hdr=1600-60-0-50` is White 1600, Reach 60, Dark lift 0 en Focus 50.
- **Wat er wordt geschreven.** PNG krijgt 16-bit Rec.2100 PQ met een `cICP`-chunk. JPG is een ISO 21496-1 gain-map-JPEG: een gewone SDR-afbeelding plus een toegevoegde gain map. AVIF krijgt een herschreven `colr`-box. TIFF krijgt PQ-pixels met een gegenereerd ICC v4-profiel met een `cicp`-tag, en vlakt af op zwart, omdat wit in PQ de code van 10.000 nits is en elke rand met een halo zou omringen. De versterking volgt perceptuele (OKLab) helderheid en behoudt de tint, dus een merkgroen wordt helderder, niet muntachtig.
- **Waar de gloed te zien is.** Kleurbeheerde viewers op een HDR-scherm: Preview, Quick Look en Safari op Apple-apparaten, of Chrome op een HDR-monitor. Een SDR-scherm toont een normale afbeelding.
- **Voordat je verstuurt.** Veel platforms coderen uploads opnieuw en strippen het HDR-signaal, waardoor de afbeelding donker of flets kan worden. Gebruik HDR waar je de bestemming beheert, zoals je eigen site, een videowand of een deck op een helder paneel.
- **Vanaf de terminal.** `--hdr=1` met `--export=png` of `--export=jpg` schrijft dezelfde PNG en gain-map-JPEG op de [CLI](/info/cli.html), met dezelfde engine-encoders, zonder browser in het pad. AVIF en TIFF blijven voorlopig webexports.

## Wat met je bestand meereist

Een afgerond bestand kan naast de afbeelding meerdere records dragen. Sommige reizen naast de pixels en verdwijnen wanneer het bestand opnieuw wordt opgeslagen of gestript; twee merktekens zitten in de pixels zelf.

::: figure exporting-what-travels
Waar elk record staat, of het standaard aan staat en welke linkparameter elk bepaalt.
:::

Het exportpaneel vouwt **Licence**, **Source credits**, *Password protect*, **C2PA Credentials**, de **Lolly Imprint** en de **Durable credential** samen in één groep **Content protection** die alleen de kaarten toont die het gekozen formaat kan gebruiken. Ze opent vanzelf wanneer een link of document al een licentie aangeeft, of wanneer een bron een beslissing van jou nodig heeft. De kaart **Design system** blijft buiten de groep, bij elke export in beeld.

![De groep Contentbescherming geopend op een PNG-export, met alleen de kaarten die erop van toepassing zijn](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Herkomst en watermerk

Waar het formaat de velden heeft, dragen exports **herkomstmetadata**: de software, de bron, de naam van de tool en de vermeldingsregel van je profiel, geschreven in PNG iTXt, JPEG EXIF, PDF-info, SVG `<metadata>` of een GIF-opmerking. Het legt alleen auteurschap vast, en er wordt niets geüpload. **Experimental** tools zetten ook een zichtbaar watermerk, aangebracht door de host zodat het bewerken van de tool het merkteken niet kan verwijderen.

**De Lolly Imprint** is een onzichtbaar pixelwatermerk, **standaard aan**. De credential en metadata reizen naast de pixels en gaan verloren bij opnieuw opslaan, een screenshot of het strippen van metadata. De Imprint zit in de pixels en overleeft hercompressie, zodat een kopie nog steeds als door Lolly gemaakt kan worden herkend. Het is een aanwijzing in plaats van een cryptografische garantie, en bevat geen persoonsgegevens. Hij zit in JPEG XL, PNG, JPG, WebP, AVIF, TIFF en BMP, en in de rasters die Lolly in een PDF of PPTX rendert, nooit in een afbeelding die je zelf insloot. Haal het vinkje bij **Lolly Imprint** weg of geef `imprint=0` mee om de Imprint weg te laten. Het overleven van AVIF bij hercodering is nog niet gekalibreerd. [Verify](/verify) detecteert hem op je apparaat; zie [De Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**De Durable credential** schrijft het id van Lolly in de pixels met een neuraal model op het apparaat in het TrustMark-formaat, zodat de link "made with Lolly" een metadatastrip en een hercodering overleeft en kan worden gelezen door TrustMark-bewuste tools. Hij staat **standaard uit**, omdat hij per export een neurale pass kost en een eenmalige modeldownload. Hij dekt PNG, JPG, WebP, AVIF en TIFF; vink hem aan in het paneel of geef `durable=1` mee. De desktop- en mobiele apps verbergen de kaart, omdat ze offline geen oorsprong hebben om het model van op te halen.

**Licence.** Kies hoe anderen je werk mogen gebruiken: standaard *None (all rights reserved)*, CC0 1.0, de Public Domain Mark 1.0, of een Creative Commons 4.0-licentie (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). De licentienaam en een link naar de deed komen in de licentiemetadata van het bestand (EXIF, XMP en RIFF waar het formaat ze heeft) en in zijn Content Credential. De keuze wordt met het document opgeslagen en reist in een link mee als `licence=`. Lolly schrijft de licentie die je koos; het controleert of handhaaft de voorwaarden niet. Een tool met een eigen licentieveld, zoals Claim, behoudt dat veld in plaats daarvan.

### Het design-systeemrecord

Een export legt het design system vast dat het bestand maakte: zijn naam, de gepubliceerde versie waaruit werd getekend (wanneer dat niet de werkversie is) en de [colourway](/info/colourways.html) waarin werd getekend. Elke andere themakeuze die een design system declareert, zoals een dichtheid, wordt op dezelfde manier vastgelegd. De keuze licht of donker blijft weg, omdat de afbeelding al toont welke is gebruikt.

**Je ziet het record voordat er iets wordt geschreven.** De kaart **Design system**, standaard aangevinkt, toont de exacte woorden die het bestand zal dragen, zoals *Records: Acme · Colourway: Beach*, en de beschrijving zoals ze zal lezen. De naam van een design system is wat de eigenaars typten, dus de kaart toont hem zoals geschreven. Haal het vinkje van de kaart weg om het record uit die export te laten. Het documentpaneel van Design noemt dezelfde woorden onder *Embedded in exports*.

**De beschrijving noemt de colourway naast de tool.** Met de kaart aangevinkt wordt *"Made with https://lolly.tools : Chart"* *"Made with https://lolly.tools : Chart (Beach colourway)"*. De eigen naam van het design system blijft in het record, niet in de beschrijving. Een beschrijving zonder toolnaam, of een die een tool uit zijn eigen inputs schrijft, blijft zoals ze is. Een tool die colourways negeert via `tokenAxes` legt er geen vast, en de PDF-proefvermelding (het drukmerk `prov`) volgt dezelfde regel.

**Merkskills die een agent begeleidden.** Wanneer een agent het stuk maakte en de [merkskills](/info/brand-skills.html) noemde die hij las en volgde, noemt het record ook elke skill met zijn revisie, zoals *Guided by: acme-brand 1.0*. De woorden betekenen dat de skill het werk begeleidde. Ze zijn geen controle: Lolly toetst het stuk niet aan een skill. Alleen de eigen verklaring van de agent voegt de lijst toe, wat vandaag het argument `brandSkills` van `lolly_render` van de [MCP-server](/info/mcp.html) betekent, dus een stuk dat in de app of via een deellink is gemaakt draagt er geen. De Content Credential bevat de lijst als `brandSkills`, één JSON-waarde met van elke skill het id, de naam, de revisie en de SHA-256-hash. Het XMP-pakket en de SVG-metadata bevatten dezelfde waarde als `lolly:BrandSkills`, een PDF die uit het record wordt geschreven krijgt één trefwoord per skill en de beschrijving blijft zoals ze was. Een interne skill wordt vastgelegd met zijn id, naam, revisie en hash, nooit met zijn tekst. Dezelfde schakelaars laten de lijst weg samen met de rest van het record: de kaart **Design system**, `_madewith=0`, `--no-madewith` en `madeWith: false`. Wanneer de MCP-server het bestand in een browser tekent (een PDF, een JPEG en de andere formaten die zijn browservrije pad niet kan schrijven), bevat de eigen metadata van het bestand geen lijst en kan alleen een Content Credential er een bevatten. Geef `c2pa` mee om het record te behouden; zonder credential waarschuwt de render dat de merkskills niet zijn vastgelegd.

**Het record teruglezen.** [Verify](/verify) noemt het record als **Design system** in de credentialdetails van een bestand en eventuele merkskills als **Guided by**. *Recreate with these settings* heropent de tool in de vastgelegde versie en colourway. De link opent met het vastgelegde design system wanneer dit apparaat er een met hetzelfde id en dezelfde naam heeft; anders opent hij met je actieve design system.

::: details Wat waar wordt geschreven, en welke runs het record weglaten
| Waar | Wat wordt geschreven |
|---|---|
| Content Credential | `designSystem` (het id), `designSystemLabel`, `designVersion` en `themes` in de assertion `tools.lolly.export`, elk een gewone tekstwaarde; `themes` is een JSON-lijst van de keuzes |
| PNG, JPEG, WebP en JXL | Dezelfde vier waarden als `lolly:`-eigenschappen van het XMP-pakket van het bestand, in de namespace `https://lolly.tools/ns/export/1.0/` |
| SVG | Dezelfde `lolly:`-eigenschappen binnen het blok `<metadata>` |
| PDF | Trefwoorden zoals *Design system: Acme* en *Colourway: Beach* |
| Elk formaat met een beschrijvingsveld | De beschrijving, met de colourway naast de tool |

De kaart verschijnt alleen wanneer er iets is om vast te leggen en het formaat het record kan bevatten. CSV, JSON, een agendabestand en andere tekst- of gegevensformaten bevatten geen metadata, en EPS, EMF, DXF en BMP hebben geen veld voor het record. HTML, Markdown en CSS bevatten het record alleen in hun Content Credential, dus voor hen toont de kaart geen beschrijvingsregel en verbergt zich zolang **C2PA Credentials** uit staat. Een veld dat het design system niet geeft, blijft buiten het bestand.

Een deellink zet het record uit met `_madewith=0` ([URL parameters](/info/url-parameters.html)); de opdrachtregel neemt `--no-madewith`, `lolly_render` van de [MCP-server](/info/mcp.html) neemt `madeWith: false`, en het exportpaneel van de terminalapp heeft een rij **Design system**. De opdrachtregel drukt de woorden die een afgerond bestand draagt af op standaardfout, voor een toolrender en voor elk bestand dat `lolly run` exporteert uit een opgeslagen Design-sessie, en een MCP-render drukt ze naast het bestand af, beide teruggelezen uit het bestand. Een PNG die de opdrachtregel zonder browser tekent draagt geen bestandsmetadata, dus het record reist alleen in de credential. Hulpprogramma's op het apparaat voegen helemaal geen metadata toe.

Runs zonder kaart **Design system** laten het record weg: een Batch-run, een map die uit Projects wordt geëxporteerd en een 3D-collectie-export, en in de terminalapp een CSV-batch, een export van een Projects-map of -selectie en de weergave render-everything. Exporteer één bestand uit de tool om het design system vast te leggen.
:::

### Content Credentials (C2PA)

Exports kunnen **Content Credentials** dragen: een ondertekend [C2PA](https://c2pa.org)-manifest dat vastlegt wat het bestand maakte, wanneer en waar, gebonden aan een hash van de bytes van het bestand zodat elke latere wijziging detecteerbaar is. De specificatie wordt gepubliceerd door de C2PA, en Lolly schrijft standaardmanifesten die elke C2PA-lezer kan inspecteren.

![De kaart C2PA Credentials, aangevinkt, met de levensduur van de credential naast het selectievakje](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Standaard aan.** De kaart **C2PA Credentials** is voor vrijwel elke tool vooraf geselecteerd. Haal het vinkje weg voor één export, of geef `c2pa=off` mee in een link. Een tool kan zich in zijn manifest afmelden.
- **Formaten.** PDF (RGB en Print), PNG en APNG, JPG, GIF, SVG, TIFF (RGB en Print), WebP (stil en geanimeerd), AVIF, MP4, WebM, de audiocontainers MP3, WAV, M4A, OGG/Opus en FLAC, en HTML, Markdown en CSS. Een ZIP zet een stempel op elk ondersteund onderdeel, zo krijgt een Animated SVG er een. MP4, AVIF en M4A gebruiken de standaard BMFF-binding en MP3 zijn ID3v2-koppeling, dus `c2patool` en andere lezers verifiëren ze. WebM en OGG/Opus hebben nog geen standaardkoppeling, dus Lolly draagt het manifest als Matroska-bijlage en een OpusTags-veld, die de eigen verificator van Lolly controleert. ICO, EPS, EMF, DXF, BMP, PPTX, de Office-formaten en de andere tekst- en gegevensformaten hebben geen C2PA-container.
- **Wat het vastlegt.** De tool en app die het bestand maakten, het ondertekeningstijdstip, de shell die het exporteerde, het [design system en de colourway](#the-design-system-record) zolang de kaart **Design system** is aangevinkt, en vingerafdrukken van actieve inputs. Invoertekst, aan het profiel gebonden velden, inactieve bediening, browserversies en gegevens van het besturingssysteem blijven weg. Je naam en e-mail verschijnen alleen als auteur wanneer **Use my details to create** aan staat onder Settings → Preferences → Your details. Bronnen die een export plaatst reizen mee als ingrediënten: [gecrediteerde werken](#source-credits) zoals emoji, en [Rondocode-nummers](/info/rondocode.html#songs-in-the-credential) in een video- of audio-export.
- **Wat ontvangers zien.** C2PA-tools zoals Adobe-apps, `c2patool` en contentcredentials.org/verify lezen het manifest en tonen de claim. Lolly ondertekent met een sleutel die op je apparaat is gemaakt, niet met een certificaat uit een vertrouwenslijst, dus viewers melden een *unverified* credential: de structuur en het bewijs van manipulatie zijn echt, voor de ondertekenaar wordt niet ingestaan. Om dat te veranderen schrijf je een **geverifieerde identiteit** in onder Settings → Preferences → Content Credentials; zie [Content Credentials Identity](/info/content-credentials-identity.html).
- **Een bestand controleren.** Zet een bestand op [Verify](/verify), of draai `lolly validate <file>`, voor een rapport op het apparaat dat begint met of Lolly het bestand maakte en of het sindsdien is gewijzigd. Verify kijkt ook voorbij de credential; zie [What Verify checks](/info/what-verify-checks.html).
- **Privacy.** De ondertekeningssleutel wordt voor de export gemaakt en verlaat je apparaat nooit, en de claim bevat alleen wat de herkomstmetadata al draagt. Privacyhulpprogramma's die je eigen bestanden transformeren voegen geen credential toe, en *Strip Hidden Data* verwijdert een C2PA-manifest zoals elke andere metadata. Het Rondocode-hulpprogramma maakt nieuwe audio, dus het ondertekent wat het schrijft ([Rondocode-nummers](/info/rondocode.html#files-from-the-rondocode-utility)).
- **Wisselwerkingen.** Een met wachtwoord beveiligde PDF kan geen Content Credentials dragen, op geen van beide niveaus. De credential wordt als laatste toegevoegd, over de afgeronde bytes, na DPI, EXIF, kleurprofiel, PDF/X-metadata en drukmerken.

### Bronvermelding

Een export die het werk van iemand anders plaatst, legt die bron vast in de credential. Een emoji getekend uit de gekozen emojiset is het alledaagse geval: het werk, zijn maker, de licentie, waar de exacte bytes vandaan kwamen en wat er veranderde reizen allemaal met het bestand mee. Tekst in een tool waarvan het sjabloon een SVG is, behoudt de eigen emoji van het systeem, dus daar wordt niets gecrediteerd. De rij **Source credits** zegt wat de bronnen van de bezorging vragen voordat je downloadt, en na de download leest ze de bezorgde bytes terug voordat ze zegt dat de vermeldingen in het bestand staan. Een licentie die vraagt om te kiezen, zoals een herkleurde CC BY-SA-glyph die je gaat delen, krijgt een kaart met de opties; de download wordt nooit geblokkeerd. [Creatieve rechten en vermeldingen](/info/creative-rights.html) bevat de formulering, de beoordeelde licenties en wat van jou blijft.

## Wachtwoordbeveiliging

Twee soorten vergrendeling, beide op je apparaat gemaakt. De kaart *Password protect* van het exportpaneel stuurt beide aan.

![De kaart Wachtwoordbeveiliging uitgeklapt op een PDF-export, met het wachtwoordveld en de twee slotniveaus](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**Een PDF-openwachtwoord** heeft twee niveaus zodra je een wachtwoord typt:

- **Weak**: 40-bit RC4, een afschrikmiddel en geen bescherming. Het wachtwoord kan in een deellink meereizen, in leesbare tekst. Alleen RGB-`pdf`.
- **Strong**: AES-256 (PDF 2.0). Bij export getypt en nooit in een link gezet. Het geldt ook voor Print PDF's en voor elke PDF in een batch-ZIP. Een met Strong vergrendelde Print PDF behoudt zijn CMYK, merken en output intent maar laat de PDF/X-4-claim vallen.

**Een vergrendelde ZIP** dekt een ZIP-export, een mapdownload uit Projects of een batch, met één wachtwoord op twee niveaus: **Weak** (ZipCrypto, een afschrikmiddel; kan in een `?password=`-link meereizen) of **Strong** (AES-256, bij export getypt, nooit in een link). Het wachtwoord beschermt elk onderdeel, en elke PDF erin is bovendien met AES-256 op zichzelf vergrendeld, zodat hij vergrendeld blijft nadat de ZIP is uitgepakt. De prompt verschijnt wanneer de download start; een leeg wachtwoord betekent geen vergrendeling.

**Een met wachtwoord afgeschermde deellink** vraagt de ontvanger om een wachtwoord voordat hij opent. De hele linkstatus wordt met AES-256 versleuteld onder een sleutel afgeleid van het wachtwoord (PBKDF2), dus alleen cijfertekst reist en het ontsleutelen gebeurt in de browser van de ontvanger. De server die de link bedient ziet het wachtwoord of het ontwerp nooit. Zet het aan in de **Share**-dialoog. Een versleutelde link opent alleen in Lolly, nooit als ingesloten afbeelding. Zie [URL Mode](/info/url-mode.html).

## Op een telefoon

De exportbediening zit achter de zwevende knop **Export**, die het venster **Export** opent: dezelfde formaten, grootte, kopiëren, downloaden en delen, op maat voor aanraking.

## Formaat-id's voor links en de CLI

Dit zijn de waarden voor de URL-parameter `format=` en de CLI-vlag `--export=` (zie [URL parameters](/info/url-parameters.html) en [CLI](/info/cli.html)). Het menu van een tool toont alleen de formaten die die tool kan maken, dus het is altijd korter dan deze lijst.

| Soort | Id's |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vector | `svg` · `svgz` (gzipped SVG) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (snijbestand) |
| Pagina en document | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (Penpot-ontwerpbestand) · `scorm` (cursuspakket, een ZIP) |
| Beweging | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| Audio | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` |
| Tekst en gegevens | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `css` · `scss` · `gpl` (GIMP-palet) |
| Bundels en pakketten | `zip` · `rpm` en `tar.gz` (de render verzegeld in een Linux-pakket) |

Een paar id's komen uit de eigen exportcode van een tool: `ase` (Adobe Swatch Exchange, uit Palette Lab) en `exr` en `hdr` (rasters met hoog dynamisch bereik, uit Darkroom). **Convert Font** schrijft `ttf`, `otf` en `woff` uit een fontbestand dat je aanlevert, dus een kale link heeft er niets voor te renderen.
