# Een bestand exporteren

Druk op **Export**, de linkerhelft van de pil **Export | Save**, kies een formaat naast de bestandsnaam en druk op **Download**. Het bestand wordt op je apparaat gemaakt.

Het bestand bevat wat je op het canvas ziet. Het formaatmenu toont alleen wat deze tool in deze browser kan maken.

Voor de meeste klussen heb je een van drie formaten nodig:

| Voor | Kies | Waarom |
|---|---|---|
| Een scherm, een bericht of een dia | **PNG** | Elke app opent het en het behoudt een transparante achtergrond wanneer de tool die biedt |
| Een afgewerkte pagina of iets dat gedrukt wordt | **PDF** | Een echt paginaformaat dat afdrukt zoals het eruitziet; **Print PDF**, waar een tool dat biedt, is de CMYK-versie voor een drukpers |
| Artwork dat op elk formaat scherp moet blijven | **SVG** | Vectorvormen |

::: check Controleer het bestand op het formaat waarin het gebruikt wordt
Open het bestand voordat je het verstuurt op het scherm waarvoor het gemaakt is of druk het af op het echte formaat.
:::

::: details Goedkeuringen en bezorging met Lolly Work (optioneel)
Een [organisatie die Lolly Work draait](/info/organisation.html) kan kiezen welke formaten en exportinstellingen haar leden zien. Waar goedkeuring vereist is, vervangt **Request approval** **Download**. Volg het beleid dat je instantie toont.

Lolly Work kan een bestand ook bezorgen bij geconfigureerde S3-, WebDAV- en HTTP-bestemmingen, met goedkeuringsstappen, bezorgbewijzen en een auditrecord. Die bezorging stuurt het bestand naar de dienst van de organisatie. Een gewone download blijft op je apparaat. Persoonlijke Send-bestemmingen en organisatiebezorging worden apart geconfigureerd.

Beheerders stellen dit in met de [bezorggids voor organisaties](/info/work-delivery.html). Voor server-renders en batches in de wachtrij, zie [CLI-batches en automatisering](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

<!--i:eti-cpu-->
## Hoe exporteren werkt

Drie paden leveren een bestand op. De meeste tools **renderen het canvas**. Tekst- en gegevensformaten (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) worden **gegenereerd uit de inhoud van de tool**. Privacyhulpprogramma's zoals *Lolly Strip Hidden Data* **transformeren het bestand dat je koos** op je apparaat. Het resultaat heeft geen canvas, watermerk of toegevoegde metadata.

![Drie exportpaden komen samen in een afgerond bestand: het canvas renderen, tekst of gegevens uit inhoud genereren of een gekozen bestand op het apparaat transformeren.](/info/diagrams/concepts/three-export-paths.svg)

De maker van een tool kiest welke acties het exportpaneel biedt. De standaardset is Copy, Download en Save.

- <!--i:download--> **Download** slaat het bestand op. Als je het daarna niet kunt vinden, zie [Een gedownload bestand vinden](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> **Copy** zet de afbeelding op je klembord. Waar een browser geen afbeeldingen kan kopiëren, downloadt Copy het bestand en meldt dat.
- <!--i:folder--> **Save** bewaart het huidige ontwerp in Projects en downloadt nooit een bestand. **Save as**, naast **Download**, vraagt waar (zie [Opslaan en doorgaan](/info/using.html#saving-continuing)).
- <!--i:link--> **Share** opent de Share-dialoog: een link die het ontwerp reproduceert, de schakelaars voor bij bezoek (volledig scherm, exportpaneel, downloaden of kopiëren bij openen) en een optionele **Shortest link** die de status in een compact token verpakt (zie [URL-modus](/info/url-mode.html)).

**Send to**, een kaart in het exportpaneel, stuurt het bestand naar een dienst die je hebt verbonden. Na verzending naar Google Drive, Nextcloud, een S3-bucket, Dropbox of OneDrive kan **Create a share link** daar een link maken zonder een tweede upload. De sectie **Share through your cloud** in de Share-dialoog verstuurt een `.lolly`-bestand en maakt de link in één stap. Het linkpaneel toont wie de link kan openen, waar het bestand staat en wanneer de link verloopt. Met **Links you've shared** in de Share-dialoog kun je stoppen met delen. Nextcloud-links kunnen een wachtwoord en een vervaldatum hebben. S3-links zijn 1 tot 7 dagen geldig en kunnen niet eerder worden ingetrokken. Lolly bewaart geen kopie van het bestand en geen aanmeldtoken op een server. [Privacy](/info/privacy.html#every-network-request-the-app-can-make) vermeldt wat elke dienst ontvangt.

![Het exportpaneel - formaat, grootte en de acties Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Wanneer een ontwerp de render van een andere tool insluit, zoals een Lolly Design-afbeeldingsvak met een QR Code-link, tekent de export van het bovenliggende ontwerp de geneste render. Die blijft vector in SVG en PDF en wordt gerasterd in PNG, JPG en WebP. De ingesloten render krijgt geen eigen watermerk of herkomst; alleen het afgeronde bestand krijgt die. Exports naar HTML, Markdown en TXT kunnen geen samengestelde render bevatten.

<!--i:eti-file-->
## Kies een formaat

De bestandsnaam en het formaatmenu staan samen als één paar `name.format`, onder **Download**.

![Het bestandsnaamveld samengevoegd met de formaatkiezer, zodat de export als één paar name.format leest](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Begin bij waar het bestand heen gaat. Elke kaart noemt de formaten die bij die bestemming passen.

::: figure exporting-format-chooser
Zes bestemmingen en de formaten die bij elk passen.
:::

Een woordmerk in het lettertype van je design system exporteert als SVG met elke letter als contourpad. Het bestand blijft op elk formaat scherp.

Tekst in een andere taal hangt af van de lettertypen die je hebt. Wanneer een lettertype in je design system de letters bevat, tekenen SVG en PDF ze als contouren, gevormd en in leesvolgorde, ook in regels van rechts naar links. Wanneer geen enkel lettertype ze bevat, gebruikt Lolly een [reservelettertype](/info/fallback-fonts.html) en toont de exportkaart dat lettertype. Tekst die geen enkel reservelettertype dekt, blijft live tekst in een SVG, getekend met de eigen lettertypen van de viewer. In een PDF, EPS of WMF, en in een EMF met **Outline fonts** aan, wordt die tekst omgezet in afbeeldingen. Die woorden zien eruit zoals op de pagina, maar kunnen niet worden geselecteerd of doorzocht. De exportkaart vermeldt die schriften. Voeg een lettertype met die letters toe om ze als vectortekst te behouden.

![Een haarfijn woordmerk met wijde letterspatiëring dat Aurora leest, het soort zuiver vectorartwork waar de SVG-rij van de tabel over gaat](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Elk formaat en waar het voor dient
| Je wilt | Gebruik | Waarom |
|---|---|---|
| Scherpe logo's of artwork dat schaalt | **SVG** | Vector: schaalbaar, klein en bewerkbaar; een effect dat de vectorexport niet kan tekenen wordt als afbeelding ingesloten |
| Vector voor Office- en Windows-apps | **EMF** | Plakt als bewerkbare vector in PowerPoint en Word, met live tekst; Google Drive opent het in Google Drawings |
| Vector voor druk- en ontwerpapps | **EPS**, of **EPS (CMYK)** | PostScript-vector voor Illustrator en persworkflows |
| Vector voor snijmachines | **DXF** | Lasersnijders, vinylplotters en CNC: contourpaden in millimeters |
| Een bewerkbaar diadeck | **PowerPoint** (PPTX) | Native bewerkbare tekst en vormen, met afbeeldingen en vectoren die extraheerbaar blijven |
| Een bewerkbaar tekstdocument | **Word** (DOCX) of **OpenDocument** (ODT) | Alinea's en koppen die een tekstverwerker kan blijven bewerken (Lolly Doc Studio) |
| Een lay-out voor InDesign | **InDesign IDML (static subset)** | Tekst, rechthoeken, ovalen en afbeeldingen, één spread per tekenbord (Lolly Design) |
| Een bewerkbaar Penpot-document | **Penpot** | Boards, vormen, tekst en gekoppelde tokens |
| Een foto of algemeen bruikbare afbeelding | **PNG** (verliesvrij) of **JPG** (kleiner) | Universeel raster |
| Kleinere moderne afbeeldingen | **WebP** of **AVIF** | Betere compressie, met transparantie |
| Drukwerk | **PDF**, of **Print PDF** (CMYK) | Echt paginaformaat; CMYK voor een drukpers |
| Drukraster voor een pers | **Print TIFF** (CMYK) | DeviceCMYK-pixels voor een RIP |
| Animatie voor het web | **GIF** | Speelt overal af; grotere bestanden |
| Animatie met volle kleur en echte transparantie | **APNG** | Geanimeerde PNG: geen paletbeperking |
| Animatie met het kleinste bestand | **Animated WebP** | Volle kleur en transparantie, kleiner dan GIF of APNG |
| Geanimeerde vector die schaalt | **Animated SVG** | Zelfstandig; speelt herhaaldelijk af in een browser of een `<img>`, op elk formaat (Lottie Ad) |
| Een animatie die bewerkbaar blijft | **dotLottie** | Vormen, paden en keyframes voor buitenste transformaties uit de tijdlijn van Lolly Design |
| Een overdracht naar Premiere | **Premiere XML + media** | Getimede clips en oorspronkelijke media voor Premiere (Lolly Design) |
| Video voor sociale media en delen | **MP4** of **WebM** | Beste kwaliteit voor de bestandsgrootte (zie [Video](#video)) |
| Ondertitels | **SRT** of **VTT** | Getimede tekst voor een videospeler (Captions, Audiogram en Record) |
| Ondertitels voor uitzendingen | **TTML** of **SCC** | IMSC1.1-getimede tekst of CEA-608-pop-on-ondertitels (Captions; zie [Ondertitels voor uitzendingen](#broadcast-captions)) |
| Een training | **SCORM (LMS)** | Een website-, SCORM- of xAPI-pakket met versienummer (zie [SCORM](#scorm-course-packages)) |
| Opgemaakte tekst of een e-mailhandtekening | **HTML** | Plakt met opmaak in e-mailclients |
| Een animatie die in een browser afspeelt | **HTML** | Een speler in één bestand, uit de tijdlijn van Lolly Design of Snippet (zie [Video](#video)) |
| Onopgemaakte inhoud | **MD** of **TXT** | Alleen tekst |
| Een agenda-afspraak | **ICS** | Importeert in elke agenda-app |
| Een contactkaart | **VCF** | Importeert in adresboeken |
| Gestructureerde gegevens om opnieuw te importeren | **JSON** of **CSV** | Exporteert de inhoud van de tool om die weer te kunnen importeren |
| Een favicon | **ICO** | Sitepictogram in meerdere formaten; **ZIP** bundelt verschillende formaten |
:::

### Transparantie

Tools die het ondersteunen, bieden een schakelaar voor een transparante achtergrond, zoals **No BG**. PNG, WebP, AVIF, SVG, APNG en Animated WebP behouden transparantie, en GIF behoudt een harde rand. JPG en PDF zijn altijd ondoorzichtig. TIFF voegt de lagen samen op wit, of op zwart bij het [HDR](#hdr-bright-colours)-pad.

<!--i:eti-crop-->
## Afmetingen en drukeenheden

Exports gebruiken het oorspronkelijke pixelformaat van de tool, tenzij de tool **afmetingen** biedt. Dan stel je breedte, hoogte en een **eenheid** in:

- **px** (de standaard) is een exact aantal pixels.
- **mm, cm, in, pt** en **pc** zijn fysieke maten. Met een fysieke eenheid stel je ook **DPI** in (standaard 300). Een **PDF** wordt een echte pagina van dat formaat. Een **raster** krijgt het aantal pixels voor die DPI en legt de resolutie vast. Een **SVG** behoudt de fysieke eenheid met een viewBox in pixels.

Voer voor een raster met een hogere resolutie een grotere breedte en hoogte in, of kies een fysieke eenheid en verhoog de DPI (pixels = afmeting × DPI). Breedte `210`, hoogte `297` en eenheid `mm` maken een A4-pagina.

![De rij met afmetingen ingesteld op 210 bij 297 mm, met het DPI-veld zichtbaar omdat de eenheid fysiek is](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

<!--i:eti-images-->
## Stilstaande beelden uit een getimede compositie

Bij een getimede compositie, zoals een [Sequence](/info/sequence-editor.html)-tijdlijn in Lolly Design, neemt een export van een stilstaand beeld **het frame bij de afspeelkop**. Zet de afspeelkop waar je de afbeelding wilt nemen en exporteer.

Gebruik voor meer dan één moment het veld **Frames** naast het uitvoerformaat. Het verschijnt alleen bij een getimede compositie en een formaat voor stilstaande beelden (PNG, JPG, WebP, SVG of PDF). `1` geeft het frame bij de afspeelkop. Een hoger getal geeft dat aantal stilstaande beelden, gelijkmatig over de sequentie verspreid:

- PNG, JPG, WebP en SVG worden geleverd als één ZIP: `<name>-01.png`, `-02.png` enzovoort.
- PDF wordt geleverd als één document met dat aantal pagina's.

Elk stilstaand beeld komt uit het midden van zijn deel van de tijdlijn, zodat het eerste nooit een half ingefade binnenkomst is en het laatste nooit het lege moment nadat de clips eindigen.

::: figure exporting-contact-sheet
Frames: 4 verdeelt de sequentie in vier gelijke delen en neemt het midden van elk deel.
:::

Gebruik Frames voor een storyboard, een contactblad ter beoordeling of een carrousel voor sociale media uit een videomontage. Het aantal is begrensd op 64. Elke andere invoer in het veld valt terug op `1`. Elk frame is een gewoon stilstaand beeld, dus credentials, de Imprint, fysieke eenheden en DPI werken zoals bij één export. Een exportlink, de CLI en MCP vragen hetzelfde blad aan met `cuts=` (zie [Contactbladen](/info/url-export.html#contact-sheets)).

<!--i:eti-copy-->
## Veel bestanden tegelijk

Lolly biedt drie manieren om grote hoeveelheden werk te verwerken:

::: cols
## Een tabel wordt één document
Een tool die is gebouwd om tabelinvoer over pagina's te verdelen, maakt van elke rij een pagina. Plak een tabel uit je spreadsheet om één PDF te krijgen. Bewerk de spreadsheet en plak opnieuw om rijen te corrigeren. Battlecards is de referentietool. Die staat in de opensourcemap `community` en wordt niet vermeld op lolly.tools.
## Een CSV wordt één bestand per rij
**Batch** (`#/batch`) neemt een CSV en rendert één export per rij, zoals naambadges of certificaten, geleverd in een ZIP. Zie [Lolly Batch](/info/batch.html#make-many-versions-of-one-design).
## Meerdere ontwerpen krijgen één bewerking
**Lolly Multi-edit** opent meerdere opgeslagen sessies naast elkaar om in elk dezelfde wijziging aan te brengen. Zie [Lolly Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Een tool met meerdere pagina's, zoals Booklet, Print Sheet, Lolly Doc Studio of Lolly Markdown Slides, exporteert PNG, JPG, WebP, SVG en de andere formaten voor één afbeelding als één bestand per pagina, in een ZIP als er meerdere zijn. Print Sheet behoudt het volledige vel en de snijtekens bij de gekozen DPI.

Vanuit **Projects** exporteert **Render folder** elke opgeslagen sessie in een map en de submappen als één ZIP met geneste mappen. **Render selection** doet hetzelfde voor een meervoudige selectie. Eén opgeslagen sessie wordt naar een eigen bestand gerenderd. Projects kan een opgeslagen sessie ook opnieuw delen als een toollink die de sessie met dezelfde instellingen heropent.

<!--i:eti-pen-->
## Bestanden die elders bewerkbaar blijven

Sommige formaten dragen je werk als bewerkbare inhoud over aan een andere toepassing in plaats van als afbeelding.

### PowerPoint (PPTX)

Lolly Design, Lolly Markdown Slides, Booklet, Lolly Doc Studio, Lolly Chart, Diagrams, Flow Chart en Agenda exporteren een PowerPoint-deck, één dia per pagina. Elke pagina wordt opgesplitst in native objecten die een collega kan bewerken en extraheren:

- <!--i:font--> **Tekst** wordt bewerkbare PowerPoint-tekstvakken met de lettergrootte, kleur, dikte, cursivering en uitlijning van de lay-out. Een Lolly Design-deck stelt het merklettertype in voor elk tekstsegment, ook zonder diamodel.
- <!--i:pentool--> **Vectoren** zoals logo's en pictogrammen worden ingesloten als SVG-afbeeldingen, waarop PowerPoint *Convert to Shape* kan toepassen.
- <!--i:photos--> **Afbeeldingen** komen over als aparte afbeeldingen op hun oorspronkelijke resolutie. Een bijgesneden hoofdafbeelding behoudt de volledige afbeelding achter de uitsnede. Elk filter of elke overvloeimodus op een afbeelding wordt erin verwerkt.
- <!--i:layers--> **Achtergronden, randen en scheidingslijnen** worden rechthoeken en lijnen. Cirkels, ellipsen en pilvormen uit Lolly Design blijven native, bewerkbare vormen.

![Het exportpaneel met PowerPoint geselecteerd: één dia per pagina, tekst en vormen blijven bewerkbaar](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

De lay-out is bij benadering. Alles wat de walker niet in native objecten kan uitdrukken, zoals een complex gefilterd of gemaskeerd gebied, wordt als afbeelding ingesloten. Een deck heeft één diaformaat, overgenomen van de eerste pagina.

PowerPoint is ook een manier om werk binnen te halen: [Een deck naar je huisstijl omzetten](/info/rebrand.html) zet een deck over naar je design system en [Een ontwerp importeren](/info/design-import.html) opent er een in Lolly Design.

### Penpot

De meeste tools die SVG exporteren, exporteren ook een **Penpot-bestand** (`.penpot`).

| Wat je hebt gemaakt | In Penpot |
|---|---|
| Tekst | Bewerkbare tekstobjecten |
| Vormen, paden, verlopen en afbeeldingen | Bewerkbare vectorvormen |
| Een kleur of lettertype uit een design-systemtoken | Een live tokenkoppeling: bewerk het token en elke vorm die het overneemt volgt |
| Het hele ontwerp | Een herbruikbare component in het paneel Assets |
| Een complexe illustratie of een live canvas | Een ingesloten afbeelding; de inhoud eromheen blijft bewerkbaar |

Vanuit Lolly Design wordt elk kader een Penpot-board. De kleuren en typografieën van het design system gaan naar het paneel Assets en de volledige tokenset naar het paneel Tokens. Penpot bewaart een eigen kopie. Een token dat in Penpot is bewerkt, komt terug via de import in [Lolly Design System Setup](/info/brand-studio.html).

![Het exportpaneel met Penpot geselecteerd: het .penpot-bestand en Send to Penpot naast de download](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Start Penpot, kies een project en kies **Import** om het bestand te openen. Als je je vanuit het exportpaneel aanmeldt bij Penpot, importeert **Send to Penpot** het bestand voor je.

### Word, OpenDocument en InDesign

**Lolly Doc Studio** exporteert **Word** (DOCX) en **OpenDocument** (ODT) met bewerkbare alinea's en koppen. Het Word-bestand stelt de lettertypen en tekstkleur van het merk in via de documentstijlen, volgt het paginaformaat dat je kiest en voegt een PNG naast een SVG-logo toe voor apps die geen SVG kunnen tekenen.

**Lolly Design** exporteert **InDesign IDML (static subset)**: tekst, rechthoeken, ovalen en PNG- of JPEG-afbeeldingen, één spread per tekenbord. Ondersteunde inline-opmaak blijft bewerkbaar, afbeeldingen gaan mee in `Links` en coördinaten worden InDesign-punten. Opnieuw koppelen, lettertypevervanging en gewijzigde regelafbreking kunnen aandacht vragen. Effecten, animatie, samengestelde tekststromen en niet-ondersteunde geometrie stoppen de export met een rapport dat ze opsomt. IDML behoudt het oorspronkelijke document niet. Verstuur PDF voor afgewerkt artwork.

### Tijdlijnen: dotLottie en Premiere

Vanuit de tijdlijn van Lolly Design schrijft **dotLottie** een animatie die bewerkbaar blijft in Lottie-tools; [Lottie-animaties](/info/sequence-editor.html#lottie-animations) vermeldt wat behouden blijft. **Premiere XML + media** bundelt getimede clips en hun oorspronkelijke media voor Premiere; zie [Premiere XML-uitwisseling](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (cursuspakketten)

Cursusexport staat uit totdat je **Training and courses** aanzet onder Settings → Preferences → Feature flags.

Kies daarna **Export course** vanuit een ondersteunde tool, een projectmap of een selectie. In Lolly Design openen **SCORM (LMS)** en **Download** dezelfde cursusworkflow. Lolly slaat het werk op, toont de cursusinhoud en volgorde ter beoordeling en opent vervolgens de module en de bijbehorende exportdialoog.

- <!--i:layers--> Kies een weergavevorm voor elke bron: stilstaande pagina's, beweging als video, audio of een downloadbaar bestand. Voeg lestekst en leesalternatieven toe in de module.
- <!--i:clock--> Bekijk het voorbeeld van de speler voor cursisten en controleer beschrijvingen en ondertitels. Beweging, inclusief animatie zonder geluid, wordt als video opgenomen.
- <!--i:document--> Kies Website, SCORM 1.2, SCORM 2004 4th Edition of een experimenteel xAPI-doelformaat. Controleer de inhoud en de ZIP-grootte, sla de gecontroleerde versie op en download die.
- <!--i:check--> Voor voltooiing moet je elke verplichte les bevestigen en Finish kiezen.

![Het exportpaneel van een Lolly Design-deck met SCORM (LMS) geselecteerd](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Het pakket bevat de afgeronde inhoud en heeft geen Lolly-account nodig. Plaats een Website-ZIP op een HTTP(S)-host; importeer een LMS-ZIP ongewijzigd. Test de bestemming voordat je de cursus deelt. Voor een cursus die is opgebouwd uit meerdere opgeslagen creaties, zie [Een training maken](/info/training-creators.html).

### Ondertitels voor uitzendingen

De tool Captions kan ook **TTML** en **SCC** exporteren. Beide worden geschreven vanuit dezelfde cuelijst als de SRT- en VTT-bestanden, zodat de woorden en tijden overeenkomen.

- **TTML** is het IMSC1.1 Text Profile, met kloktijden op basis van mediatijd en één gebied middenonder. Het bevat geen kleur, lettertype of positie per ondertitel, omdat de ondertitels van Lolly alleen een begin, een einde en tekst bevatten.
- **SCC** bevat CEA-608-pop-on-ondertitels op kanaal 1 bij 29,97 frames per seconde met drop-frame-tijdcode. Het ondersteunt de Noord-Amerikaanse basistekens plus de speciale en uitgebreide tekens. Als een ondertitel een teken bevat dat niet in de set zit, stopt de export en meldt welk teken het is. Elke ondertitel wordt afgebroken op 32 kolommen en maximaal 15 rijen. Een ondertitel die niet vóór de begintijd kan worden geladen, wordt enkele frames vertraagd.
- Roll-up- en paint-on-ondertitels worden niet geschreven.

::: note SCC is niet gecontroleerd in een uitzendtool
Het is ook niet getest op een hardwaredecoder. Test een bestand in je eigen verwerkingsketen voordat je het aanlevert.
:::

### DXF (snijbestanden)

Lolly Asset Export, Diagrams, Growth, Lolly Logo Wall, QR Code, Street Map, Wayfinding en Wordmark exporteren **DXF**, het AutoCAD R12-uitwisselingsformaat dat lasersnijders, vinylplotters en CNC-software lezen. Geometrie wordt geschreven als contourpaden in millimeters en tekst wordt omgezet naar contouren. Kleur wordt gekoppeld aan de dichtstbijzijnde AutoCAD Color Index, die meestal de werking van de snijmachine aanstuurt. DXF bevat alleen lijntekeningen: een fotografisch of gefilterd gebied heeft geen snijpad en wordt met een waarschuwing weggelaten. Gebruik SVG of PDF om rasterinhoud te behouden. Tekst die door geen enkel lettertype wordt gedekt, ook niet door een [reservelettertype](/info/fallback-fonts.html), stopt de export met een bericht dat de tekst citeert.

Een Street Map-ontwerp bestaat volledig uit lijnen, dus elke weg en elk kanaal wordt een snijpad.

::: showcase
![Een Street Map-render van Parijs in inkt op crème - een zuivere lijntekening, zodat elke lijn behouden blijft bij de overdracht naar een snijmachine](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Scrol en de camera trekt terug door de geometrie: zeven paden en geen pixels. Een snijmachine leest hetzelfde bestand.
:::

<!--i:eti-stamp-->
## Drukwerk

**Print PDF** schrijft CMYK voor een benoemde drukconditie, standaard **Coated FOGRA39**. Merkkleurstalen met gemeten inktwaarden behouden die waarden. Andere kleuren worden omgezet via een drukprofiel: standaard het eigen Coated FOGRA39-profiel van Lolly, of je eigen profiel wanneer je de bijbehorende rij **Embed** kiest. Grijstinten en zwart blijven uitsluitend op de zwarte plaat, zodat kleine tekst geen pasfouten kan krijgen. FOGRA51, SWOP en GRACoL gebruiken een standaard apparaatconversie. Zwarte tekst wordt ook over de onderliggende kleur gedrukt, zodat een licht verkeerd uitgelijnde pers geen witte rand rond de letters achterlaat. **Print TIFF** schrijft DeviceCMYK-pixels voor een RIP. De bediening Colour profile stuurt beide aan ([Kleurprofielen](#colour-profiles)). Print TIFF en **EPS (CMYK)** scheiden kleuren via hetzelfde drukprofiel als Print PDF.

**Print marks & bleed** heeft een eigen kaart bij de drukformaten: de afloop in millimeters plus Crop, Registration, Bleed, Colour bars en Stamp details. Stamp details drukt de datum, de tool en je naam in de marge af. Een naam of toolnaam in tekens die het margelettertype mist, zoals Arabisch, Chinees, Cyrillisch of een emoji, wordt als afbeelding in dezelfde grijstint getekend. De exportkaart vermeldt die schriften.

Sommige tools, zoals *Booklet*, maken een **PDF met meerdere pagina's**: een omslag, inhoud die doorloopt over zoveel pagina's als nodig en een achterpagina. Elke pagina is een echte staande PDF-pagina in A4, US Letter of A5. Je kunt elk blok op een nieuwe pagina laten beginnen. Dit zijn RGB-documenten zonder snij- of aflooptekens; die tekens horen bij de Print PDF met één pagina. Een Lolly Design-PDF kan ook een **Notes handout** zijn: een staande pagina voor elke dia met de sprekersnotities eronder.

**Voordat je exporteert.** Een kaart **Before you export** onderaan het paneel toont wat een drukkerij zal zien: formaat, afmetingen en afloop, snij- en afloopgebieden, inktdekking, aantal platen en aantal pagina's, met een oordeel naast de kop. De kaart blokkeert nooit een export. Lolly Design toont de kaart altijd met eigen controles, waaronder de huisstijlregels van het design system per laag en het schrijfsignaal voor de tekst van het document ([Voordat je exporteert](/info/design.html#before-you-export)). Lolly Design voegt deze drukcontroles toe wanneer **Print preflight** aan staat. Zet in andere tools **Print preflight** aan onder Settings → Preferences → Feature flags. Het staat standaard uit en een Lolly Work-installatie kan het aanzetten voor haar leden.

**Nadat je exporteert.** Lolly leest het afgeronde bestand terug en vergelijkt het met wat je hebt gekozen: formaat, pixel- of pagina-afmetingen, cliplengte, een transparante achtergrond, CMYK-kleur, HDR, Content Credentials en een PDF- of ZIP-wachtwoord. Elke afwijking wordt op de exportkaart vermeld. Elke meting komt uit het bestand, nooit uit de instelling. Een eigenschap waarover het bestand geen uitsluitsel geeft, telt niet als een overeenkomst. De opdrachtregel schrijft de volledige vergelijking met `--export-report` (zie [Renderen met de CLI](/info/cli-rendering.html)).

::: details PDF-toegankelijkheidscontroles vanaf de opdrachtregel
**PDF-toegankelijkheidscontroles.** Voor een PDF vermeldt de opdrachtregel ook 32 toegankelijkheidscontroles in het bestand `--export-report`, onder `pdfAccessibility`. Elke controle heeft een id, een eenvoudige beschrijving, een uitkomst en de plek in het bestand waar een probleem is gevonden:

- **Passed**: de controle heeft iets onderzocht en geen probleem gevonden.
- **Failed**: de controle heeft een probleem gevonden. De paginanummers of tags worden vermeld.
- **Not applicable**: het bestand bevatte niets van dat type om te onderzoeken, zoals tabelcontroles in een bestand zonder tabellen. Dit zegt niets over het bestand.
- **Needs a person**: zes controles kunnen niet door een programma worden beoordeeld (leesvolgorde, kleurcontrast, flitsen, scripts, tijdslimieten en herhaalde links).

De lijst is geen oordeel. Ze zegt niet dat een PDF aan PDF/UA voldoet of dat mensen die ondersteunende technologie gebruiken de PDF kunnen gebruiken. Iemand moet het bestand nog steeds met een schermlezer controleren. De eigen PDF's van Lolly slagen op dit moment niet voor de tagcontroles, omdat de exporters nog geen tags schrijven. De controle leest het bestand op je apparaat en verandert niets. Bestanden die een wachtwoord nodig hebben, worden als niet gecontroleerd aangeduid, niet als geslaagd. Sleep een PDF die je hebt ontvangen naar [Lolly Strip Hidden Data](/info/utilities.html) om die te controleren. Daar verschijnt dezelfde lijst onder **PDF accessibility checks**.
:::

De controles van de Inspector in Lolly Design en de merkvergelijking in Lolly Design System Setup kijken naar het ontwerp. Deze twee kaarten kijken naar het bestand.

::: details Kosten op basis van een tarievenkaart
Onder de preflight zet een kostenkaart dezelfde aantallen om in geld, ook als de preflightkaart uit staat. Daarvoor zijn twee dingen nodig: een opdracht die met een prijslijst kan worden geprijsd (platen, vellen, oppervlakte, pagina's, variantrijen of uitvoerbestanden, dus een gewone logo-PNG toont de kaart nooit) en een **tarievenkaart**, een JSON-prijslijst van je drukker. Een standaardbuild bevat geen tarievenkaart en biedt in de app geen manier om er een te laden. Een tarievenkaart komt als catalogusasset die een installatie meelevert, of via de optionele uitbreiding voor tarievenkaarten die een zelfhoster of beheerplatform aanzet. Zonder tarievenkaart wordt niets getoond.

Elk bedrag is een tarief dat je hebt aangeleverd maal een hoeveelheid die Lolly heeft geteld, zoals `4 plate × €35.00`. Het totaal toont de bron: de uitgever op de kaart en de datum van de tarieven. Er is geen standaardvaluta en geen voorlopige prijs. Wat het bestand over zichzelf zegt, blijft een weergave van wat het vermeldt: *"Het bestand zegt: … Lolly heeft dit niet geverifieerd."*

Wanneer een bedrag niet kan worden berekend, wordt de tabel weggelaten in plaats van ingevuld:

- Regels waarvoor de kaart geen prijs geeft, betekenen **helemaal geen totaal**, alleen een kop die vermeldt hoeveel regels ongeprijsd zijn.
- Een hoeveelheid die een bovengrens is, krijgt **"maximaal"** mee in het subtotaal.
- Tarieven waarvan de geldigheidsdatum is verstreken, tonen **alleen aantallen** totdat je op *Use these rates anyway* drukt; de vervaldatum blijft daarna bij het bedrag staan.
- Bij openen via een **link** blijven bedragen verborgen totdat je er op dit apparaat om vraagt. De CLI accepteert `--rate-card=<file.json>` als lokaal bestand en nooit als linkparameter.

De kaart wordt uit elke exportfase verwijderd en verandert het bestand nooit. Het is een berekening, geen offerte. Alleen je drukker kan een offerte geven.
:::

<!--i:eti-film-->
## Beweging en geluid

### Video

Geanimeerde tools exporteren **MP4** en **WebM**. Een gedeelde `?format=`-link die om een container vraagt die deze browser niet kan maken, valt terug op de andere, met een bijpassende bestandsnaam. **Start after** houdt het canvas stil zodat animaties en lettertypen gereed zijn voordat de opname begint. **Duration** stelt de lengte van de afgeronde clip in. **Motion blur** (Off, Draft quality, Standard of High, met een **Shutter angle**) vervaagt snelle beweging en vertraagt het renderen. Waar de browser het ondersteunt, neemt **Record live** het voorbeeld op het scherm in realtime op via schermdeling.

![De tijdsinstellingen voor een geanimeerde export: Start after, Duration, Motion blur met de bijbehorende Shutter angle en Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** biedt de keuze uit Smaller file, Balanced of Best quality. **Advanced** opent **Codec**, **Frame rate**, **Rate mode** en **Hardware acceleration**. Waar een tool ondertitels heeft, kies je met **Captions** een **Embedded track** of een **Sidecar .vtt + .srt** naast de video. Een link bevat de kwaliteit, codec, framesnelheid, duur en startvertraging als `vq`, `codec`, `fps`, `seconds` en `wait` ([URL-parameters](/info/url-parameters.html)).

Video-exports behouden hun geluid. Een tool kan **achtergrondmuziek** onder de clip leggen: een audioasset die wordt herhaald of ingekort tot de cliplengte, met fades, volume en automatische demping onder het eigen geluid van het beeldmateriaal. De opnametools nemen hun live audio mee in het bestand.

Een klikdeck van Lolly Design kan ook als video worden geëxporteerd. **Export slides as video** in het menu Present opent het exportblad op MP4. Elke dia speelt gedurende de eigen weergaveduur, of gedurende de Duration van het exportblad als de dia geen eigen duur heeft. De diaovergang van het deck speelt tussen dia's af als een overvloeier. Het document verandert niet.

**HTML** uit een getimed Lolly Design-document of uit Snippet is een speler in één bestand: bediening voor afspelen, zoeken en geluid boven de animatie, met de ondersteunde lettertypen, afbeeldingen en het geluid ingesloten. Het bestand speelt offline af. Een Lolly Design-film met scènes voegt een menu met de scènes toe. Een sequentie met een video-, Lottie- of 3D-clip kan nog niet als HTML worden geëxporteerd; exporteer de sequentie als video.

### Geanimeerde afbeeldingen

**GIF** speelt overal af en is geschikt voor chat en e-mail; het is groter en heeft minder kleuren dan video. **APNG** en **Animated WebP** behouden volle kleur en transparantie. **Lottie Ad** exporteert ook **Animated SVG**: vectorframes met ingesloten CSS-keyframes die naar elk formaat schalen en herhaaldelijk afspelen in een browsertabblad of een `<img>` zonder codec. De tekst wordt omgezet naar contouren. Het gebruikt een lagere standaardframesnelheid omdat elk frame zwaarder is dan een bitmap. Deze formaten hebben allemaal geen geluid.

### Audio

Sommige tools exporteren geluid afzonderlijk. **Lolly Voice Recorder** maakt een microfoonopname met een live niveaumeter en slaat die op als **MP3**, **WAV**, **M4A (AAC)** of **Opus (WebM)**, gecodeerd op je apparaat. `wav`, `mp3`, `m4a` en `opus` zijn gewone formaat-ids, dus een audio-export is net zo makkelijk te delen en via scripts aan te sturen als een PNG.

De assetkiezer accepteert veel audioformaten voor achtergrondmuziek, van MP3 en FLAC tot MIDI en trackermodules; [Formaten](/info/formats.html) vermeldt ze. Een [Lolly Rondocode-nummer](/info/rondocode.html) speelt af met de lengte die de clip vraagt.

<!--i:eti-palette-->
## Kleur en HDR

Lolly leest elke moderne CSS-kleur, berekent kleuren op basis van waarneming en schrijft elk bestand in een kleurruimte die een lezer kan openen: sRGB voor schermen, CMYK voor drukwerk en Rec.2100 PQ voor HDR ([Kleur in de engine](/info/colour-engine.html)). Een Lolly Design-document dat is ingesteld op **Wide colour / HDR** volgt eigen regels: zie [Bewerken met een ruim kleurbereik en HDR](/info/hdr-editing.html).

### Kleurprofielen

Exports krijgen een kleurprofiel, zodat apps met kleurbeheer, zoals die van drukkerijen, Photoshop en browsers, de kleuren lezen zoals jij ze zag. Miniaturen en voorbeelden laten het profiel weg om klein te blijven.

- **PNG en JPG** bevatten een ingesloten **sRGB**-ICC-profiel, de kleurruimte waarin het voorbeeld wordt getekend. De pixels krijgen een profiel, ze worden niet opnieuw gecodeerd.
- **Print PDF (CMYK)** vermeldt de drukconditie in de *OutputIntent*, zodat een drukkerij weet hoe de CMYK-inkten moeten worden geïnterpreteerd.
- **Print TIFF (CMYK)** schrijft DeviceCMYK-pixels zonder profiel en legt de drukconditie vast in de TIFF-metadata. Een TIFF kan geen drukprofiel insluiten, dus een rij **Embed** legt alleen de naam van dat profiel vast.
- **TIFF (RGB)** is de ongecomprimeerde sRGB-versie voor archivering of een bewerkingsronde in een editor. Beide TIFF-formaten zijn alleen voor desktop, omdat browsers geen voorbeeld van een TIFF kunnen tonen.
- **SVG**, **EMF**, **EPS** en **DXF** zijn vectoren zonder ingesloten profiel: SVG-kleuren zijn sRGB, EMF en EPS gebruiken apparaat-RGB, **EPS (CMYK)** schrijft DeviceCMYK en DXF gebruikt de AutoCAD Color Index. SVG, EPS en DXF zetten tekst om naar contourpaden. EMF houdt tekst live en bewerkbaar in Office en Google Slides en zet alleen de tekstsegmenten die het formaat niet kan weergeven om naar contouren. De optie **Outline fonts** in het exportpaneel dwingt overal paden af, net als `_text=outline` in een link en `--text=outline` op de opdrachtregel. SVG reproduceert ook CSS-vakschaduwen, binnen en buiten.

::: details PDF/X-4 en je eigen drukprofiel
Lolly levert één CMYK-profiel mee, afgestemd op de FOGRA39-karakteriseringsgegevens van Fogra en uitgebracht onder CC0, en zet daarmee kleuren om voor de standaarddrukconditie. Het profiel wordt niet ingesloten, omdat het ICC-versie 4.3 is en PDF/X-4 versies tot en met 4.2 accepteert. Een benoemde drukconditie schrijft daarom de output intent zonder overeenstemming met PDF/X-4 te claimen.

Laad een eigen CMYK-profiel en kies de bijbehorende rij **Embed** in de bediening Colour profile. Het wordt ingesloten als de *DestOutputProfile* van het bestand en de PDF claimt PDF/X-4 wanneer de rest van het bestand dat toestaat. De opgegeven drukconditie wordt uit dat profiel gelezen: een geregistreerde naam waar het profiel die aantoont, of `Custom` onder de eigen naam van het profiel.

Drie dingen verhinderen de claim, terwijl de output intent behouden blijft: RGB-artwork dat de CMYK-stap niet kon omzetten, de naamsvermelding in de proefmarge met `prov` (getekend in een standaardlettertype dat niet is ingesloten) en een **Strong**-wachtwoord, omdat PDF/X-4 versleuteling verbiedt. Elke PDF bevat ook PDF/X-4-metadata: paginakaders, XMP, een document-ID en een sRGB-output intent met het bijbehorende profiel.
:::

### Steunkleuren als proceskleuren

Een design system kan een kleur een steunkleurinkt geven, zoals een Pantone- of HLC-kleur. De **Print PDF** drukt die kleur dan op een eigen plaat. Lolly Demo geeft elke kleur een steunkleurinkt, behalve de witte kleuren Sugar en Daylight en de zwarte kleur Void. Een Print PDF die in Lolly Demo is gemaakt, drukt de meeste kleuren op steunkleurplaten en zwart op de zwarte plaat.

Vink voor een gewoon vierkleurenbestand **Print spot inks as process** aan op de kaart Profile in het exportpaneel. Elke steunkleurinkt wordt dan gedrukt met cyaan, magenta, geel en zwart, volgens de CMYK-opbouw die het design system aan die kleur geeft. Een kleur zonder eigen opbouw gebruikt de conversie van het drukprofiel, net als elke andere kleur in het artwork. Het bestand heeft dan alleen de vier proceskleurplaten. De keuze staat standaard uit. Het paneel toont het selectievakje alleen voor **Print PDF**, en alleen wanneer het design system een kleur een steunkleurinkt geeft.

Een afwerking is geen inkt. Folie, hoogreliëf, diepreliëf, spotlak, soft touch, stansen, rillen en perforatie behouden hun eigen benoemde platen wanneer het vakje is aangevinkt, omdat een afwerking in proceskleuren haar zwarte masker op de pagina zou zetten.

De kaart **Before you export** en `lolly preflight` tellen de platen die het bestand zal hebben. Als het vakje is aangevinkt, tellen ze de vier proceskleurplaten en eventuele afwerkingsplaten en melden ze dat de steunkleurinkten als proceskleuren worden gedrukt en geen platen toevoegen. Als het vakje uit staat, tellen ze maximaal één steunkleurplaat voor elke steunkleurinkt die het design system geeft. Een tarievenkaart berekent de prijs op basis van die aantallen, zodat er nooit een steunkleurplaat wordt berekend die het bestand niet zal hebben.

De **Print TIFF** en **EPS (CMYK)** hebben geen benoemde platen, dus ze drukken elke inkt als proceskleur, ongeacht de keuze. Voor die twee formaten tellen de kaart en `lolly preflight` de vier proceskleurplaten en nooit een steunkleur- of afwerkingsplaat. Een afwerking komt erin terecht als haar zwarte masker op de zwarte plaat, en de kaart meldt dat als een fout.

Een link vraagt hetzelfde bestand aan met `_spots=process`, de opdrachtregel met `--spots=process`, de [MCP-server](/info/mcp.html) met `spots: "process"` en de terminalapp met de rij **Spot inks**. Er wordt niets over de keuze in het bestand opgenomen: alleen de inkten veranderen.

### HDR (heldere kleuren)

De kaart **HDR** in het exportpaneel maakt gewoon artwork helderder voor HDR-schermen. Zie [Breed kleurbereik en HDR-bewerking](/info/hdr-editing.html) om HDR-originelen tijdens het bewerken te behouden.

Een gewone export is sRGB: een verzadigde merkkleur is even helder als het normale wit van het scherm. Een HDR-scherm kan helderder worden. De kaart **HDR** versterkt je merkkleuren en witte tekst richting de piekhelderheid. Donkere delen blijven donker.

![De HDR-kaart in het exportpaneel, ingeschakeld, met de draaiknoppen White / Reach / Dark lift / Focus eronder zichtbaar](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formaten.** PNG, JPG, AVIF en TIFF. WebP is 8-bit zonder werkend HDR-decodeerpad, en vectoren en PDF hebben geen HDR-model.
- **Standaard uit**, omdat het de pixels verandert. Vink de kaart aan of geef `hdr=1` mee in een deellink.
- **De draaiknoppen.** **White** (het plafond voor piekhelderheid, 400 tot 2000 nits), **Reach** (hoe ver de gloed zich naar de donkere tinten verspreidt), **Dark lift** (hoeveel helderder de donkere tinten worden; `0` houdt ze donker) en **Focus** (hoeveel kleurintensiteit de versterking behoudt). Ze worden als één waarde doorgegeven: `hdr=1600-60-0-50` is White 1600, Reach 60, Dark lift 0 en Focus 50.
- **Wat er wordt geschreven.** PNG krijgt 16-bit Rec.2100 PQ met een `cICP`-chunk. JPG is een ISO 21496-1 gain-map JPEG: een gewone SDR-afbeelding met een toegevoegde gain map. AVIF krijgt een herschreven `colr`-box. TIFF krijgt PQ-pixels met een gegenereerd ICC v4-profiel met een `cicp`-tag. TIFF wordt op een zwarte achtergrond afgevlakt, omdat wit in PQ de code voor 10.000 nits is en een halo rond elke rand zou geven. De versterking volgt de perceptuele (OKLab) lichtheid en behoudt de tint, zodat een merkgroen helderder wordt zonder mintgroen te worden.
- **Waar de gloed zichtbaar is.** Viewers met kleurbeheer op een HDR-scherm: Preview, Quick Look en Safari op Apple-apparaten of Chrome op een HDR-monitor. Een SDR-scherm toont een normale afbeelding.
- **Vanuit de terminal.** `--hdr=1` met `--export=png` of `--export=jpg` schrijft op de [CLI](/info/cli.html) dezelfde PNG en gain-map JPEG met dezelfde encoders van de engine, zonder browser. AVIF en TIFF zijn voorlopig alleen webexports.

::: warning Veel platforms verwijderen het HDR-signaal
Een platform dat uploads opnieuw codeert, kan de afbeelding donker of flets maken. Gebruik HDR waar je de bestemming beheert, zoals je eigen site, een videowall of een deck op een helder scherm.
:::

<!--i:eti-badge-check-->
## Wat er met je bestand meereist

Een afgerond bestand kan meerdere registraties bevatten. Sommige staan naast de pixels en verdwijnen wanneer het bestand opnieuw wordt opgeslagen, als schermafbeelding wordt vastgelegd of van metadata wordt ontdaan. Twee markeringen zitten in de pixels.

::: figure exporting-what-travels
Waar elke registratie zit, of ze standaard aan staat en welke linkparameter haar aanstuurt.
:::

Het exportpaneel plaatst **Licence**, **Source credits**, **Password**, **C2PA Credentials**, de **Lolly Imprint** en de **Durable credential** in één groep **Content protection** die alleen de kaarten toont die het gekozen formaat kan gebruiken. De groep opent vanzelf wanneer een link of document al een licentie opgeeft of wanneer een bron je beslissing nodig heeft. De kaart **Design system** blijft buiten de groep, zichtbaar bij elke export.

![De groep Content protection geopend bij een PNG-export, met alleen de kaarten die daarvoor gelden](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Herkomst & watermerk

Waar het formaat de velden heeft, bevatten exports **herkomstmetadata**: de software, de bron, de naam van de tool en de naamsvermelding uit je profiel, geschreven in PNG iTXt, JPEG EXIF, PDF-info, SVG `<metadata>` of een GIF-commentaar. Het legt alleen het auteurschap vast. Er wordt niets geüpload. **Experimental** tools plaatsen ook een zichtbaar watermerk. De host past het watermerk toe, dus door de tool te bewerken kun je de markering niet verwijderen.

**De Lolly Imprint** is een onzichtbaar pixelwatermerk dat **standaard aan staat**. Het overleeft hercompressie, zodat een kopie nog steeds herkenbaar is als gemaakt met Lolly. Het is een aanwijzing, geen cryptografische garantie, en het bevat geen persoonsgegevens. Het wordt geschreven in JPEG XL, PNG, JPG, WebP, AVIF, TIFF en BMP en in de rasterafbeeldingen die Lolly in een PDF of PPTX rendert, nooit in een afbeelding die je hebt ingesloten. Vink **Lolly Imprint** uit of geef `imprint=0` mee om de Imprint weg te laten. Hoe goed het opnieuw coderen van AVIF wordt doorstaan, is nog niet gekalibreerd. [Lolly Verify](/#/verify) detecteert de Imprint op je apparaat; zie [De Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**De Durable credential** schrijft de id van Lolly in de pixels met een neuraal model op het apparaat in het TrustMark-formaat, zodat de koppeling "gemaakt met Lolly" het verwijderen van metadata en opnieuw coderen overleeft en kan worden gelezen door tools die TrustMark ondersteunen. Hij staat **standaard uit**, omdat hij per export een neurale verwerking en een eenmalige modeldownload kost. Hij werkt voor PNG, JPG, WebP, AVIF en TIFF. Vink hem aan in het paneel of geef `durable=1` mee. De desktop- en mobiele apps verbergen de kaart, omdat ze offline geen origin hebben om het model van op te halen.

**Licence.** Kies hoe anderen je werk mogen gebruiken: standaard *None (all rights reserved)*, CC0 1.0, de Public Domain Mark 1.0 of een Creative Commons 4.0-licentie (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). De licentienaam en een link naar de licentiesamenvatting komen in de licentiemetadata van het bestand (EXIF, XMP en RIFF waar het formaat die heeft) en in zijn Content Credential. De keuze wordt met het document opgeslagen en reist mee in een link als `licence=`. Lolly schrijft de licentie die je koos. Lolly controleert de voorwaarden niet en dwingt ze niet af. Een tool met een eigen licentieveld, zoals Claim, behoudt dat veld.

### De registratie van het design system

Een export legt vast welk design system het bestand heeft gemaakt: de naam, de gepubliceerde versie waaruit het is getekend (wanneer dat niet de werkversie is) en de [colourway](/info/colourways.html) waarin het is getekend. Elke andere themakeuze die een design system opgeeft, zoals een dichtheid, wordt op dezelfde manier vastgelegd. De keuze voor licht of donker wordt weggelaten, omdat de afbeelding al laat zien welke is gebruikt.

**Je ziet de registratie voordat er iets wordt geschreven.** De kaart **Design system**, standaard aangevinkt, toont de exacte woorden die het bestand zal bevatten, zoals *Registratie: Acme · Colourway: Beach*, en de beschrijving. De naam van een design system is wat de eigenaren hebben getypt, en de kaart toont de naam zoals die is geschreven. Vink de kaart uit om de registratie uit die export weg te laten. Het documentpaneel van Lolly Design vermeldt dezelfde woorden onder *Embedded in exports*.

**De beschrijving vermeldt de colourway naast de tool.** Als de kaart is aangevinkt, wordt *"Gemaakt met https://lolly.tools : Chart"* gewijzigd in *"Gemaakt met https://lolly.tools : Chart (colourway Beach)"*. De eigen naam van het design system blijft in de registratie, niet in de beschrijving. Een beschrijving zonder toolnaam, of een die een tool vanuit zijn eigen invoer schrijft, blijft ongewijzigd. Een tool die colourways negeert via `tokenAxes` legt er geen vast, en de naamsvermelding op de PDF-proef (de drukmarkering `prov`) volgt dezelfde regel.

::: details Merkskills, merkpagina's en partnerbedrijven in de registratie
**Merkskills die een agent hebben geleid.** Wanneer een agent het werk heeft gemaakt en de [merkskills](/info/brand-skills.html) heeft genoemd die hij heeft gelezen en gevolgd, vermeldt de registratie ook elke skill met zijn revisie, zoals *Geleid door: acme-brand 1.0*. De woorden betekenen dat de skill het werk heeft geleid. Lolly toetst het werk niet aan een skill. Alleen de eigen verklaring van de agent voegt de lijst toe. Momenteel is dat het argument `brandSkills` van `lolly_render` van de [MCP-server](/info/mcp.html), dus werk dat in de app of vanuit een deellink is gemaakt, bevat er geen. De Content Credential bevat de lijst als `brandSkills`, één JSON-waarde met de id, naam, revisie en SHA-256-hash van elke skill. Het XMP-pakket en de SVG-metadata bevatten dezelfde waarde als `lolly:BrandSkills`. Een PDF die vanuit de registratie wordt geschreven, krijgt één trefwoord per skill. De beschrijving blijft ongewijzigd. De tekst van een interne skill wordt nooit vastgelegd. Dezelfde schakelaars laten de lijst weg met de rest van de registratie: de kaart **Design system**, `_madewith=0`, `--no-madewith` en `madeWith: false`. Wanneer de MCP-server het bestand in een browser tekent (een PDF, een JPEG en de andere formaten die het browserloze pad niet kan schrijven), bevatten de eigen metadata van het bestand geen lijst. Alleen een Content Credential kan daar de lijst bevatten. Geef `c2pa` mee om de registratie te behouden. Zonder credential waarschuwt de render dat de merkskills niet zijn vastgelegd.

**De merkpagina, wanneer de uitgever ervoor kiest.** De uitgever van een design system kan ervoor kiezen het adres van zijn [merkpagina](/info/brand-page.html#lead-back-from-your-files) vast te leggen in exports. De instelling geldt per design system en staat standaard uit. De kaart voegt het adres dan toe aan dezelfde regel, zoals *Registratie: Acme · Colourway: Beach · Merkpagina: https://acme.example/brand/acme/*. Als je de kaart uitvinkt, wordt het adres met de rest verwijderd. De registratie bevat het adres en niets anders over de pagina. Verder verandert er niets in het bestand. Een design system zonder adres schrijft hetzelfde bestand als voorheen.

**Het adres reist niet mee met een pakket.** Een registratie in een ondertekend bestand wordt gelezen als die van de ondertekenaar zelf. Een adres mag zichzelf niet inschakelen voor iemand die dat adres niet heeft gekozen, en een pakket mag bestanden van anderen niet kunnen laten verwijzen naar een pagina van zijn keuze. Een `.lolly`-pakket, een kopie of fork van een design system, **Try these colours**, een herstelde back-up en een tokenbestand dat voor één uitvoering wordt aangeleverd, komen allemaal aan met de instelling uit. Je kunt de instelling zelf aanzetten, met een adres dat je typt. Een beheerd design system is de enige uitzondering: het behoudt het adres dat zijn beheerder in de brontokens heeft ingesteld. [Terugleiden vanuit je bestanden](/info/brand-page.html#lead-back-from-your-files) geeft de details.

**Het partnerbedrijf, in een partnerprogramma van Lolly Work.** Werk dat voor een partnerbedrijf is gemaakt, legt het bedrijf en zijn programma vast op dezelfde regel, zoals *Registratie: Acme · Colourway: Beach · Partner: Northwind IT (Resellers, EMEA)*, met de revisie van de bedrijfsgegevens in het bestand. De registratie bevat geen persoon, contactgegevens, adres of valuta. Als de partnerkit van het bedrijf is gekoppeld, voegt de regel de revisie van de kit toe, zoals *, kitrevisie 2*, en bevat de credential de id en revisie van de kit, nooit de kleuren of regels. Als je de kaart uitvinkt, wordt de partner met de rest van de registratie verwijderd. Een PDF krijgt het trefwoord *Partner: Northwind IT*, en [Lolly Verify](/info/what-verify-checks.html#partner) toont de registratie als **Partner** ([De partnerregistratie in bestanden](/info/manage/partner-programmes.html#the-partner-record-in-files)).
:::

**De registratie teruglezen.** [Lolly Verify](/#/verify) vermeldt de registratie als **Design system** in de credentialdetails van een bestand en eventuele merkskills als **Guided by**. Een merkpagina verschijnt apart, als [het door de ondertekenaar vastgelegde adres](/info/what-verify-checks.html#brand-page). *Recreate with these settings* heropent de tool in de vastgelegde versie en colourway. De link opent met het vastgelegde design system wanneer dit apparaat er een met dezelfde id en naam bevat; anders opent hij met je actieve design system.

::: details Wat waar wordt geschreven en welke uitvoeringen de registratie weglaten
| Waar | Wat er wordt geschreven |
|---|---|
| Content Credential | `designSystem` (de id), `designSystemLabel`, `designVersion` en `themes` in de assertie `tools.lolly.export`, elk een tekstwaarde; `themes` is een JSON-lijst van de keuzes. `brandPage` wanneer de uitgever ervoor heeft gekozen |
| PNG, JPEG, WebP en JXL | Dezelfde waarden als `lolly:`-eigenschappen van het XMP-pakket van het bestand, in de namespace `https://lolly.tools/ns/export/1.0/`. `lolly:BrandPage` wanneer de uitgever ervoor heeft gekozen |
| SVG | Dezelfde `lolly:`-eigenschappen binnen het blok `<metadata>` |
| PDF | Trefwoorden zoals *Design system: Acme*, *Colourway: Beach* en, wanneer de uitgever ervoor heeft gekozen, *Merkpagina: https://acme.example/brand/acme/* |
| Elk formaat met een beschrijvingsveld | De beschrijving, met de colourway naast de tool |

De kaart verschijnt alleen wanneer er iets vast te leggen is en het formaat de registratie kan bevatten. CSV, JSON, een agendabestand en andere tekst- of gegevensformaten bevatten geen metadata, en EPS, EMF, DXF en BMP hebben geen veld voor de registratie. HTML, Markdown en CSS bevatten de registratie alleen in hun Content Credential, dus toont de kaart daarvoor geen beschrijvingsregel en is ze verborgen zolang **C2PA Credentials** uit staat. Een veld dat het design system niet geeft, blijft uit het bestand.

Een deellink zet de registratie uit met `_madewith=0` ([URL-parameters](/info/url-parameters.html)). De opdrachtregel accepteert `--no-madewith`, `lolly_render` van de [MCP-server](/info/mcp.html) accepteert `madeWith: false` en het exportpaneel van de terminalapp heeft een rij **Design system**. De opdrachtregel schrijft de woorden die een afgerond bestand bevat naar de standaardfoutuitvoer, voor een toolrender en voor elk bestand dat `lolly run` vanuit een opgeslagen Lolly Design-sessie exporteert. Een MCP-render toont de woorden naast het bestand. Beide lezen de woorden terug uit het bestand. Een PNG die de opdrachtregel zonder browser tekent, bevat geen bestandsmetadata, dus reist de registratie alleen in de credential mee. Hulpprogramma's op het apparaat voegen geen metadata toe.

Uitvoeringen zonder kaart **Design system** laten de registratie weg: een uitvoering van Lolly Batch, een map die vanuit Projects wordt geëxporteerd en een export van een 3D-collectie, en in de terminalapp een CSV-batch, een export van een Projects-map of -selectie en de weergave die alles rendert. Exporteer één bestand vanuit de tool om het design system vast te leggen.
:::

### Content Credentials (C2PA)

Exports kunnen **Content Credentials** bevatten: een ondertekend [C2PA](https://c2pa.org)-manifest dat vastlegt wat het bestand heeft gemaakt, wanneer en waar, gekoppeld aan een hash van de bytes van het bestand zodat elke latere bewerking detecteerbaar is. Lolly schrijft standaardmanifesten die elke C2PA-lezer kan inspecteren.

![De kaart C2PA Credentials, aangevinkt, met de geldigheidsduur van de credential naast het selectievakje](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Standaard aan.** De kaart **C2PA Credentials** is bij vrijwel elke tool aangevinkt. Vink haar uit voor één export of geef `c2pa=off` mee in een link. Het bestand heeft dan geen credential, en een SVG die artwork met een credential inline insluit, zoals een logo uit de catalogus, verliest ook de credential van dat artwork. De Lolly Imprint en de overige metadata van het bestand blijven behouden. Een tool kan dit in zijn manifest uitschakelen.
- **Formaten.** PDF (RGB en Print), PNG en APNG, JPG, GIF, SVG en SVGZ, TIFF (RGB en Print), WebP (stilstaand en geanimeerd), AVIF, MP4, WebM, HTML, Markdown, CSS en de audiocontainers MP3, WAV, M4A, OGG/Opus en FLAC. Een ZIP voorziet elk ondersteund bestand van een credential; zo krijgt een Animated SVG een credential. MP4, AVIF en M4A gebruiken de standaard BMFF-binding en MP3 zijn ID3v2-mapping, zodat `c2patool` en andere lezers ze verifiëren. WebM en OGG/Opus hebben nog geen standaardmapping, dus neemt Lolly het manifest op als een Matroska-bijlage en een OpusTags-veld, die de eigen verifier van Lolly controleert. Een SVGZ is een gecomprimeerde SVG. De C2PA-specificatie definieert geen gecomprimeerde vorm, dus wordt de credential vóór compressie in de SVG geschreven. De verifier van Lolly leest het bestand zoals het is; `c2patool` leest dezelfde credential zodra het bestand is uitgepakt (`gunzip`). ICO, EPS, EMF, DXF, BMP, PPTX, de Office-formaten en de andere tekst- en gegevensformaten hebben geen C2PA-container.
- **Wat het vastlegt.** De tool en app die het bestand hebben gemaakt, het tijdstip van ondertekening en de shell die het bestand heeft geëxporteerd. Voor een Lolly Design-pagina die als afbeelding, SVG of PDF is geëxporteerd: de renderer die de pagina heeft getekend (`route` in de assertie `tools.lolly.export`: `gpu` voor de GPU-paginarenderer, `operations` voor de tekenbewerkingen die als vectoren zijn geschreven, `compatibility` voor de eigen renderer van de browser) en de versie van die renderer (`renderer`: het GPU-recept, `design-draw-v` en zijn versie of `dom-to-image` en `dom-walker`). Het [design system en de colourway](#the-design-system-record) zolang de kaart **Design system** is aangevinkt. De actieve instellingen: menukeuzes, getallen, schakelaars en kleuren zoals ze zijn, en alles wat is getypt (titels, namen, notities, links en datums) alleen als vingerafdruk, zodat de woorden niet in het bestand staan. Profielgebonden velden, inactieve bedieningselementen, browserversies en details van het besturingssysteem worden weggelaten. Je naam en e-mailadres verschijnen alleen als auteur wanneer **Use my details to create** aan staat onder Settings → Preferences → Your details. Bronnen die een export plaatst, reizen mee als ingrediënten. Elke afbeelding op de pagina die een eigen Content Credential bevat, wordt vastgelegd als onderdeel van de pagina, met die credential en elk AI-brontype dat erin wordt opgegeven. Dit geldt in een PNG, JPEG, WebP, AVIF, TIFF, SVG of PDF en in een GIF, APNG, geanimeerde WebP, MP4 of WebM wanneer de afbeelding in minstens één frame van het geëxporteerde bereik wordt getekend. De ene afbeelding die een tool zoals Darkroom, Filter of Asset Export verandert, wordt in plaats daarvan vastgelegd als het bovenliggende bestand, eerst geopend en gevolgd door wat de tool met de afbeelding heeft gedaan. Andere ingrediënten zijn [werken met bronvermelding](#source-credits) zoals emoji, [Lolly Rondocode-nummers](/info/rondocode.html#songs-in-the-credential) in een video- of audio-export en [opgeslagen melodieën](/info/generated-music.html#what-a-track-records) in een video- of audio-export. Elke opgeslagen melodie bevat zijn naam, de licentie wanneer de melodie die vastlegt, de SHA-256 van het recept, de versie van de engine en de aanduiding algoritmische media. De maker van een opgeslagen melodie (de profielnaam waarmee deze is opgeslagen) wordt alleen toegevoegd zolang **Use my details to create** aan staat, net als je eigen naam. Alleen dan toont het exportpaneel de maker voordat je exporteert.
- **Een goedkeuring, wanneer die is vastgelegd.** Een bestand dat via [Lolly Work](/info/work-approvals.html#review-an-exported-file) is goedgekeurd, kan een tweede, ondertekende registratie over deze credential bevatten: de goedkeurings-id, de datum van de beslissing en de digest van het beoordeelde bestand. Die bevat geen namen, e-mailadressen, groepen, opmerkingen of ketennamen. De optie is standaard aangevinkt in het aanvraagvenster en kan voor één aanvraag worden uitgevinkt of voor een instantie worden uitgezet. Ze legt vast dat een ondertekenaar een beslissing heeft verklaard. Ze zegt niet dat het werk aan een norm voldoet.
- **Wat er is gevraagd, voor een bestand dat vanuit een [intentie](/info/visual-intent.html#what-goes-in-the-file) is gemaakt.** Het doel, het medium, de tool, de taal, de versies van regels en woordenschat en de digest van de intentie. Gelegenheid, doelgroep, regio en de prompt zijn alleen vingerafdrukken, tenzij de persoon of agent die de render uitvoert, vraagt de woorden van de prompt vast te leggen. Alleen een render die vanuit een intentie is gestart, bevat deze registratie. De uitvoering meldt wat ze heeft vastgelegd, en de registratie kan worden weggelaten.
- **Wat ontvangers zien.** C2PA-tools zoals Adobe-apps, `c2patool` en contentcredentials.org/verify lezen het manifest en tonen de claim. Lolly ondertekent met een sleutel die op je apparaat is gemaakt, niet met een certificaat uit een vertrouwenslijst, dus melden viewers een *ongeverifieerde* credential. De structuur en de detectie van wijzigingen zijn geldig, maar niemand staat in voor de ondertekenaar. Registreer een **geverifieerde identiteit** onder Settings → Preferences → Content Credentials om dat te veranderen; zie [Content Credentials-identiteit](/info/content-credentials-identity.html).
- **Een bestand controleren.** Sleep een bestand naar [Lolly Verify](/#/verify) of voer `lolly validate <file>` uit voor een rapport op je apparaat dat begint met de vraag of Lolly het bestand heeft gemaakt en of het sindsdien is veranderd. Lolly Verify kijkt ook verder dan de credential; zie [Wat Lolly Verify controleert](/info/what-verify-checks.html).
- **Privacy.** De ondertekeningssleutel wordt voor de export gemaakt en verlaat je apparaat nooit. De claim bevat alleen wat de herkomstmetadata al bevatten. Privacyhulpprogramma's die je eigen bestanden transformeren, voegen geen credential toe, en *Lolly Strip Hidden Data* verwijdert een C2PA-manifest zoals alle andere metadata. Het hulpprogramma Rondocode maakt nieuwe audio en ondertekent daarom wat het schrijft ([Lolly Rondocode-nummers](/info/rondocode.html#files-from-the-rondocode-utility)). De muziekgenerator ondertekent elke WAV- of M4A-download. De credential legt vast dat de muziekgenerator van Lolly het nummer heeft gemaakt en onder welke licentie de muziek valt, CC BY 4.0, met de bijbehorende naamsvermelding ([Wat een nummer vastlegt](/info/generated-music.html#what-a-track-records)).
- **Wisselwerkingen.** Een met een wachtwoord beveiligde PDF kan op geen van beide niveaus Content Credentials bevatten. De credential wordt als laatste toegevoegd, over de afgeronde bytes, na DPI, EXIF, kleurprofiel, PDF/X-metadata en drukmarkeringen.

### Bronvermeldingen

Een export die werk van iemand anders plaatst, legt die bron vast in de credential. Het gebruikelijke geval is een emoji uit de gekozen emojiset: het werk, de maker, de licentie, waar de exacte bytes vandaan kwamen en wat er veranderde, reizen allemaal met het bestand mee. Tekst in een tool waarvan het sjabloon een SVG is, behoudt de eigen emoji van het systeem, dus wordt daar geen bron vermeld. Voordat je downloadt, geeft de rij **Source credits** aan wat de bronnen van de levering vragen. Na het downloaden leest de rij de geleverde bytes terug voordat ze meldt dat de bronvermeldingen in het bestand staan. Een licentie die je laat kiezen, zoals een opnieuw ingekleurde CC BY-SA-glyph die je gaat delen, krijgt een kaart met de opties. De download wordt nooit geblokkeerd. [Creatieve rechten en bronvermeldingen](/info/creative-rights.html) bevat de formuleringen, de beoordeelde licenties en wat van jou blijft.

<!--i:eti-lock-->
## Wachtwoordbeveiliging

Lolly maakt twee soorten vergrendeling, beide op je apparaat. De kaart **Password** in het exportpaneel stelt beide in.

![De kaart Password uitgeklapt bij een PDF-export, met het wachtwoordveld en de twee vergrendelingsniveaus](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**Een wachtwoord om een PDF te openen** heeft twee niveaus zodra je een wachtwoord typt:

- **Weak**: 40-bit RC4, voor RGB `pdf` zonder drukmarkeringen of afloop en met gewone ASCII-wachtwoorden. Een wachtwoord met andere tekens schakelt over naar Strong, omdat lezers een bestand dat op dat niveau zo is vergrendeld niet kunnen openen. Alleen de eerste 32 tekens tellen.
- **Strong**: AES-256 (PDF 2.0). Dit geldt ook voor Print PDF's en voor elke PDF in een batch-ZIP. Een met Strong vergrendelde Print PDF behoudt zijn CMYK, markeringen en output intent, maar laat de PDF/X-4-claim vervallen.

::: warning Weak schrikt af, maar biedt geen bescherming
Gebruik **Strong** voor een vertrouwelijk bestand.
:::

**Een vergrendelde ZIP** omvat een ZIP-export, een mapdownload vanuit Projects of een batch, met één wachtwoord op twee niveaus: **Weak** (ZipCrypto, een afschrikmiddel) of **Strong** (AES-256). Het wachtwoord beschermt elk bestand erin. Elke PDF daarin wordt ook afzonderlijk met AES-256 vergrendeld, zodat de PDF vergrendeld blijft nadat de ZIP is uitgepakt. De vraag verschijnt wanneer de download begint. Een leeg wachtwoord betekent geen vergrendeling.

**Een getypt wachtwoord blijft op beide niveaus uit links.** Als een bestand via een `?password=`-link binnenkomt, leest Lolly de waarde en verwijdert die meteen uit het adres. Een link die om een vergrendeling vraagt die het bestand niet kan bevatten, schrijft geen bestand en zegt waarom (zie [`password`](/info/url-parameters.html)).

**Een met een wachtwoord afgeschermde deellink** vraagt de ontvanger om een wachtwoord voordat hij opent. De status in de link is versleuteld met AES-256 onder een sleutel die uit het wachtwoord is afgeleid (PBKDF2). Alleen versleutelde tekst reist mee, en ontsleuteling gebeurt in de browser van de ontvanger. De server die de link aanbiedt, ziet nooit het wachtwoord of het ontwerp. Zet dit aan in het dialoogvenster **Share**. Een versleutelde link opent alleen in Lolly, nooit als ingesloten afbeelding. Zie [URL Mode](/info/url-mode.html).

<!--i:eti-monitor-->
## Op een telefoon

De exportbediening zit achter de zwevende knop **Export**, die het paneel **Export** opent: dezelfde formaten, grootte en acties voor kopiëren, downloaden en delen, met afmetingen voor aanraakbediening.

<!--i:eti-code-->
## Formaat-id's voor links en de CLI

Dit zijn de waarden voor de URL-parameter `format=` en de CLI-vlag `--export=` (zie [URL-parameters](/info/url-parameters.html) en [CLI](/info/cli.html)). Het menu van een tool toont alleen de formaten die die tool kan maken.

| Soort | Id's |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vector | `svg` · `svgz` (met gzip gecomprimeerde SVG) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (snijbestand) |
| Pagina en document | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (Penpot-ontwerpbestand) · `scorm` (cursuspakket, een ZIP) |
| Beweging | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| Audio | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` · `mid` (MIDI-noten, uit Lolly Rondocode) |
| Tekst en gegevens | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `ttml` · `scc` · `css` · `scss` · `gpl` (GIMP-palet) |
| Bundels en pakketten | `zip` · `rpm` en `tar.gz` (de render verpakt in een Linux-pakket) |

Een paar id's komen uit de eigen exportcode van een tool: `ase` (Adobe Swatch Exchange, uit Lolly Palette Lab) en `exr` en `hdr` (rasters met een hoog dynamisch bereik, uit Lolly Darkroom). **Convert Font** schrijft `ttf`, `otf` en `woff` vanuit een lettertypebestand dat je aanlevert, dus geeft een kale link de tool niets om te renderen.
