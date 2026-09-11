# Exporteren & Formaten

Hoe je een afgewerkt bestand uit een tool krijgt - het juiste formaat kiezen, de uitvoergrootte instellen en wat elke optie doet. Zoals met al het andere gebeurt **exporteren op je eigen apparaat**; er wordt niets geüpload.

## Hoe exporteren werkt

De preview *is* het bestand. Wanneer je exporteert, rendert de host dat canvas naar het formaat dat je koos en geeft je een download (of zet het op je klembord). Een tool biedt alleen de formaten aan die de auteur ervan heeft opgegeven, en de kiezer verbergt elk formaat dat je browser niet kan produceren (zie [Video](#video)).

Drie paden leveren een bestand op. De meeste tools **renderen het canvas** naar het gekozen formaat. Tekst- en dataformaten (HTML, MD, TXT, JSON, CSV, ICS, VCF) worden in plaats daarvan **gegenereerd uit de inhoud van de tool**, niet gerasteriseerd vanuit het beeld. En privacytools (bijv. *Strip Hidden Data*) gebruiken een derde pad: het bestand dat *jij* kiest wordt byte-voor-byte op het apparaat getransformeerd en direct teruggegeven - geen canvas, geen watermerk en geen toegevoegde herkomstmetadata, omdat het al je eigen bestand is.

De acties in de exportbediening:

- <!--i:download--> **Download** - het bestand opslaan (de primaire actie).
- <!--i:photos--> **Kopiëren** - zet de afbeelding op je klembord om direct in Slack, e-mail of een document te plakken. Waar een browser geen afbeeldingen kan kopiëren, wordt in plaats daarvan gedownload en krijg je een melding.
- <!--i:folder--> **Opslaan** - bewaar het huidige ontwerp als een opgeslagen toolsessie in je bibliotheek.
- <!--i:link--> **Delen** - opent de **Deeldialoog**: een kopieerbare link die het ontwerp reproduceert, schakelaars bij bezoek (volledig scherm, exportpaneel, downloaden of kopiëren bij openen) en een optionele **Kortste link** die de hele status in een compact token verpakt (zie [URL-modus](/info/url-mode.html)).

(De auteur van een tool kiest welke hiervan verschijnen; de standaardset is Kopiëren, Downloaden en Opslaan.)

![Het exportpaneel - formaat, grootte en de acties Kopiëren / Downloaden / Opslaan / Delen](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Delen opent over de tool heen, met de link al opgebouwd en de schakelaars bij bezoek eronder.

### Meerdere tegelijk renderen

Eén export is één bestand, maar je kunt er **meerdere** in één keer renderen - elk geleverd als één `.zip`:

- <!--i:folder--> **Projecten → Map renderen** exporteert elke opgeslagen sessie in een map (en de submappen ervan) als één geneste zip; **Selectie renderen** doet hetzelfde voor elke meervoudige selectie; een enkele opgeslagen sessie rendert direct naar het eigen bestand. Geen Batch/Pro nodig - zie [Lolly gebruiken → Projecten](/info/using.html).
- <!--i:layers--> **Batch (Pro)** rendert een raster van invoersets - elke variant van één template tegelijk.

Een opgeslagen sessie kan ook opnieuw als toollink worden gedeeld vanuit Projecten (die reconstrueert de tool-URL vanuit de opgeslagen invoer), zodat een link hem heropent met exact dezelfde instellingen.

## Een formaat kiezen

De bestandsnaam en de formaatkiezer staan bovenaan het paneel als één paar `naam.formaat`, en de kiezer toont alleen de formaten die de auteur van deze tool heeft opgegeven.

![Het bestandsnaamveld samengevoegd met de formaatkiezer, zodat de export als één paar naam.formaat leest](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

| Je wilt… | Gebruik | Waarom |
|---|---|---|
| Scherpe logo's / artwork dat schaalt | **SVG** | Vector - oneindig schaalbaar, klein, bewerkbaar |
| Vector voor Office / Windows-apps | **EMF** | Plakt als bewerkbare vector in PowerPoint / Word; tekst blijft live en bewerkbaar, en Google Drive opent het in Google Tekeningen voor Slides |
| Vector voor print / ontwerpapps | **EPS**, of **EPS (CMYK)** | PostScript-vector voor Illustrator / drukwerkflows |
| Vector voor snij- / CAD-machines | **DXF** | Lasersnijders, vinylplotters, CNC - contourpaden in millimeters |
| Een bewerkbare presentatie | **PowerPoint** (PPTX) | Native bewerkbare tekst + vormen, met afbeeldingen en vectoren die extraheerbaar blijven |
| Een cursus die een LMS kan importeren | **SCORM** (LMS) | Een zip met het manifest, een startpagina, de slides en de ingesproken film met ondertitels - van een Design-presentatie |
| Een bewerkbaar tekstdocument | **Word** (DOCX) of **OpenDocument** (ODT) | Echte alinea's en koppen die een tekstverwerker kan blijven bewerken (Doc Studio) |
| Een foto of algemene afbeelding | **PNG** (verliesvrij) of **JPG** (kleiner) | Universele raster |
| Kleinere moderne afbeeldingen | **WebP** / **AVIF** | Betere compressie, alpha |
| Print | **PDF**, of **Print PDF** (CMYK) | Werkelijke paginagrootte; CMYK voor drukwerk |
| Printraster voor een drukpers | **Print TIFF** (CMYK) | DeviceCMYK-pixels voor een RIP |
| Geanimeerd voor het web | **GIF** | Werkt overal, grotere bestanden |
| Geanimeerd met volledige kleur + echte alpha | **APNG** | Geanimeerde PNG - geen paletbeperking, echte transparantie |
| Geanimeerd, kleinste bestand | **Animated WebP** | Volledige kleur + alpha, beter gecomprimeerd dan GIF of APNG |
| Geanimeerde vector die schaalt | **Animated SVG** | Zelfstandig; loopt in een browser of `<img>`, geen codec, elke grootte |
| Video voor social / delen | **MP4** of **WebM** | Beste kwaliteit per byte (zie hieronder) |
| Rijke tekst / e-mailhandtekening | **HTML** | Plakt opgemaakt in mailclients |
| Platte inhoud | **MD** / **TXT** | Alleen tekst |
| Een agenda-afspraak | **ICS** | Importeert in elke agenda-app |
| Een contactkaart | **VCF** | Importeert in Contacten / adresboeken |
| Gestructureerde data om opnieuw te importeren | **JSON** / **CSV** | Rondtript de inhoud van de tool |
| Een favicon | **ICO** | Site-icoon in meerdere formaten (**ZIP** bundelt meerdere formaten) |

De eerste rij is het gangbare geval. Een woordmerk gezet in je merklettertype exporteert als SVG, waarbij elke letter een omlijnd pad is in plaats van een pixel, zodat het scherp blijft op visitekaartjesformaat en op gevelgrootte vanuit hetzelfde bestand.

![Een haarlijndun, breed getrackt woordmerk met de tekst Aurora, het soort pure vectorillustratie waar de SVG-rij van de tabel over gaat](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-wordmark-vector)

## Grootte & druk-eenheden

Standaard gebruiken exports de eigen pixelgrootte van de tool. Waar een tool **afmetingen** blootgeeft, kun je breedte × hoogte en een **eenheid** instellen:

- **px** (standaard) - exacte pixels.
- **mm · cm · in · pt · pc** - fysieke/drukgroottes. Bij een fysieke eenheid stel je ook **DPI** in (standaard **300** voor print); de engine converteert per formaat correct - **PDF** wordt een ware pagina op die grootte, **raster** rendert op het juiste pixelaantal voor de DPI (en betrekt de resolutie), **SVG** behoudt de fysieke eenheid met een px-viewBox.

Voor een raster met hogere resolutie voer je een grotere breedte/hoogte in, of kies je een fysieke eenheid en verhoog je de DPI (pixels = grootte × DPI). Er is geen schakelaar voor schalen met één klik.

Voorbeeld: breedte `210`, hoogte `297`, eenheid `mm` → een A4-pagina.

![De afmetingenrij ingesteld op 210 bij 297 mm, met het DPI-veld zichtbaar omdat de eenheid fysiek is](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Stills uit een getimede compositie

Een **getimede compositie** - een [Sequence](/info/using.html#timeline-sequence)-tijdlijn in Design, of elk tijdlijngestuurd artboard - is iets bewegends, dus een stilstaande export moet antwoord geven op "welk moment?". De regel is wat je zou verwachten: **het frame bij de afspeelkop**. Zet de afspeelkop waar je de afbeelding wilt en exporteer; wat je ziet is wat eruit komt.

Wanneer je meer dan één moment wilt, verschijnt het veld **Frames** naast de uitvoergrootte (alleen bij een getimede compositie, en alleen bij een still-formaat - PNG, JPG, WebP, SVG of PDF). Laat het op `1` staan voor het playhead-frame. Verhoog het en je krijgt dat aantal stills, gesampled op gelijke intervallen over de hele sequentie:

- **Raster en SVG** komen terug als één **zip** - `<name>-01.png`, `-02.png` enzovoort.
- **PDF** komt terug als een **enkel document met evenveel pagina's**.

Handig voor een storyboard, een miniaturenblad, een contactblad voor review of een socialcarrousel geknipt direct uit een videomontage.

Sampling gebeurt op het **middelpunt** van elk interval in plaats van op de randen, omdat het eerste moment van een sequentie vaak een intro-overgang is die nog niet is ingefaded en het laatste de toestand is nadat elke clip is geëindigd - sampling op de randen zou twee van je frames verspillen aan bijna-lege beelden. Het aantal is begrensd op **64** (een contactblad is bedoeld om door een mens te worden gelezen), en alles onzinnigs dat in het veld wordt getypt valt terug op `1` in plaats van de export te laten mislukken. Elk frame is een gewone still, dus Content Credentials, het watermerk, fysieke eenheden en DPI gedragen zich precies zoals bij een enkele export.

Het veld **Frames** is de manier om vandaag een blad te krijgen. De engine reserveert een bijbehorende URL-parameter `cuts`, maar geen enkele shell leest die nog uit een link, dus een gedeelde link heropent altijd op het playhead-frame - zie [URL-modus](/info/url-mode.html#contact-sheets-cuts).

## PDF met meerdere pagina's

Sommige tools bouwen een **meerpagina-PDF-document** in plaats van één artwork - een omslag, inhoud die over zoveel pagina's stroomt als nodig is en een achterpagina, allemaal in één bestand (zie de tool *Booklet*). Elke pagina is een **echte PDF-pagina** op de grootte van het vak van die pagina, dus lezers en drukkers krijgen echte pagina's, geen ene lange afbeelding.

- **Pagina's uit inhoud.** Voeg blokken tekst en afbeeldingen toe; nieuwe pagina's worden automatisch aangemaakt zodra de blokken vol raken, en je kunt elk blok dwingen om op een nieuwe pagina te beginnen.
- **Echte paginaformaten.** Kies A4, US Letter of A5 (staand - de layout met twee kolommen is daarvoor gebouwd) - elke pagina, en de geëxporteerde PDF, wordt precies op dat formaat weergegeven.

Meerpagina-PDF's zijn RGB-documenten en dragen geen snij-/afloopmarkeringen - die horen bij het single-page **Print PDF**-pad hierboven. Ze dragen wel dezelfde **PDF/X-4-metadata** als elke PDF-export (paginavakken, XMP, document-ID, een sRGB-output-intent met ingesloten profiel), en ze bieden **Content Credentials** (hieronder) - bij de tool *Booklet* staat de optie standaard aangevinkt.

## Veel dingen tegelijk maken

Lolly heeft drie verschillende manieren om op volume te werken, en ze lossen verschillende problemen op - batchbewerking is een eersteklas mogelijkheid van het platform, geen functie die elke tool opnieuw uitvindt:

- <!--i:document--> **Eén ontwerp × een tabel met rijen → één document met meerdere pagina's.** Tools met een `table`-invoer (zoals *Battlecards*) zetten elke rij automatisch om in een pagina - plak een tabel uit je spreadsheet, krijg een PDF ter grootte van een deck. Jouw echte batcheditor blijft de spreadsheet: fix tien rijen daar, plak opnieuw. De tool zelf beheert nooit pagina's.
- <!--i:layers--> **Eén ontwerp × een gegevensbestand → veel losse bestanden.** Het `/pro`-batchraster neemt een CSV en rendert één export *per rij* - naambadges, certificaten, elk één bestand.
- <!--i:sliders--> **Veel verschillende assets, naast elkaar bewerkt.** *Multi-edit* opent meerdere opgeslagen sessies in één weergave voor gecoördineerde retouches over verschillende ontwerpen heen.

Vuistregel: rijen van hetzelfde ontwerp die in **één document** horen → een tabelgestuurde tool; rijen die als **losse bestanden** verzonden moeten worden → `/pro`; **verschillende ontwerpen** die dezelfde aanpassing nodig hebben → multi-edit. (Een geplande render-optie "media combineren" zal de eerste twee overbruggen - door exports van hetzelfde formaat samen te voegen tot één PDF, één video of een proefdrukcontactblad.)

## PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart en Diagrams kunnen een **PowerPoint-presentatie** exporteren - één slide per pagina. Het punt is geen pixelperfecte screenshot; het is om een collega een presentatie te geven die ze daadwerkelijk kunnen **bewerken en waar ze assets uit kunnen halen**. Elke pagina wordt dus ontleed in native objecten:

- <!--i:font--> **Tekst** wordt echte, **bewerkbare PowerPoint-tekstvakken** - met de lettergrootte, kleur, gewicht, cursivering en uitlijning uit de layout - zodat je een typfout kunt herstellen of kunt herstijlen in PowerPoint.
- <!--i:pentool--> **Vectoren** (logo's, iconen, het SUSE-merkteken) worden ingesloten als **echte SVG-afbeeldingen** - ze blijven scherp op elke grootte, en PowerPoint kan er zelfs *Convert to Shape* op toepassen.
- <!--i:photos--> **Afbeeldingen** komen door op hun native resolutie als hun eigen extraheerbare afbeeldingen (een `cover`-bijgesneden hero houdt de volledige afbeelding achter de bijsnede, zodat je opnieuw kunt kadreren), met elke behandeling op de afbeelding (filters, blends) getrouw ingebakken.
- <!--i:layers--> **Achtergronden, randen en lijnen** worden echte rechthoek-/lijnvormen.

![Het exportpaneel met PowerPoint gekozen: één slide per pagina, tekst en vormen blijven bewerkbaar](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

De layout is bij ontwerp benaderend - het doel is getrouwe, herbruikbare **inhoud**, geen vastgezette screenshot. Alles wat de walker niet native kan uitdrukken (een complex gefilterd of gemaskeerd gebied) wordt ingesloten als afbeelding, zodat niets verloren gaat. Een deck heeft één slideformaat, overgenomen van de eerste pagina.

PowerPoint is ook een weg **naar binnen**. Zet een `.pptx` op elk uploadoppervlak neer en kies de slides die je wilt - elke wordt een asset om te plaatsen, te bewerken of op voort te bouwen. **Markdown Slides** schrijft een nieuwe presentatie vanuit Markdown (en geeft een branded `.pptx`-sjabloon mee), en de **Rebrand**-utility geeft een bestaande presentatie ter plekke een nieuw thema - themapalet, hardgecodeerde kleuren en lettertypen - zonder de charts, SmartArt of animaties aan te raken, en levert een `.pptx` terug. Zie [Een ontwerp importeren → Presentaties en documenten](/info/design-import.html#decks-and-documents).

## Penpot

Elke tool die SVG kan exporteren, kan ook een **Penpot-bestand** (`.penpot`) exporteren - het document, klaar om in Penpot verder te bewerken in plaats van er alleen naar te kijken.

- <!--i:layout--> Vanuit **Design** wordt elk frame een Penpot-**board**, elk vak erop komt over als zijn eigen bewerkbare vorm - rechthoek, ellips, tekst, afbeelding of pad - en het resultaat komt aan als een herbruikbaar **component** in het Assets-paneel, klaar om opnieuw uit te slepen.
- <!--i:pentool--> Vanuit een tool waarvan de render **platte geometrie** is - de vectortools zoals QR Code, Street Map, Wordmark en Palette Lab - komt elk pad, elke rechthoek, tekstregel en gradiënt op dezelfde manier over, als zijn eigen bewerkbare vorm.
- <!--i:font--> Vanuit een tool die zijn render opbouwt in **HTML**, **blijft de tekst tekst** - één bewerkbaar Penpot-tekstobject per regel, geen omtrek en geen platte afbeelding. Een stuk artwork waar Penpot geen construct voor heeft - een complexe illustratie, een live canvas - gaat op zichzelf mee als afbeelding, zodat het nooit de tekst en vakken eromheen plat maakt. Een hele lay-out die Penpot niet getrouw kan scheiden, kan alsnog als één afbeelding op volle getrouwheid overkomen, dus er gaat nooit iets verloren.
- <!--i:palette--> Een kleur of lettertype dat een vorm **erft van een merktoken** blijft **gekoppeld** aan dat token in het bestand: verander het token in Penpots Tokens-paneel en elke vorm die het erft, schildert samen opnieuw, terwijl een eenmalige letterlijke kleur precies blijft waar hij is. De kleuren en typografieën van het merk komen ook in het **Assets**-paneel terecht, en de volledige set designtokens in het **Tokens**-paneel - dezelfde DTCG-tokenset die Lolly's eigen palet gebruikt. Penpot houdt vanaf daar zijn eigen kopie bij: een bewerking gemaakt in zijn Tokens-paneel komt terug in het merk via [Brand Studio's import](/info/design-import.html), niet vanzelf.

| Wat je maakte | In Penpot |
|---|---|
| Tekst | Bewerkbare tekstobjecten - typfout herstellen of herstijlen |
| Vormen, paden, gradiënten, afbeeldingen | Hun eigen bewerkbare vectorvormen |
| Een kleur of lettertype uit een merktoken | Een live tokenkoppeling - bewerk het token, elke vorm die het erft volgt |
| Het hele ontwerp | Een herbruikbaar component in het Assets-paneel |
| Een complexe illustratie of live canvas | Op zichzelf ingesloten als afbeelding, de bewerkbare inhoud eromheen ongemoeid |

![Het exportpaneel met Penpot gekozen: het .penpot-bestand, en Send to Penpot naast de download](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Om het te openen, start je Penpot, kies je een project en kies je **Import**. Ingelogd bij Penpot vanuit het exportpaneel doet **Send to Penpot** die stap voor je - kies daar een project en het bestand gaat er direct in.

## SCORM (cursuspakketten)

Een Design-presentatie kan het pand verlaten als een **SCORM-pakket** - de zip die een learning management system importeert, of dat nu Moodle, Canvas, Blackboard of een bedrijfs-LMS is. Kies **SCORM (LMS)** in de formaatkiezer en de export schrijft:

- <!--i:layout--> **De slides**, één afbeelding per artboard, als vector waar het artboard dat toelaat en als pixels alleen waar dat niet zo is.
- <!--i:play--> **De ingesproken film** met zijn ondertitelspoor - de sprekersnotities voorgelezen door een on-device stem, precies zoals [Presenting](/info/create/using.html#presenting) ze afspeelt.
- <!--i:file--> **Een startpagina** die door de slides stapt, de film afspeelt en de voltooiing terugmeldt aan het LMS via de SCORM 1.2-runtime, de versie die elk LMS accepteert.
- <!--i:font--> De lettertypen die de presentatie gebruikt, zodat de startpagina offline hetzelfde weergeeft.

![Het exportpaneel op een Design-presentatie met SCORM (LMS) gekozen](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Niets in het pakket belt naar huis: het zijn bestanden in een zip, en het draait binnen het LMS zonder bundler, zonder CDN en zonder account. De web- en desktopapps bouwen het; de CLI niet, omdat het fotograferen van de artboards en het coderen van de film de browser nodig hebben.

## DXF (snijbestanden)

Vectortools (Brand Lockup, QR Code, Street Map, Wayfinding Signage, Pose Geeko, de logo-lockups, Diagram Builder) kunnen exporteren naar **DXF** - het AutoCAD R12-uitwisselingsformaat dat lasersnijders, vinylplotters en CNC/CAD-software lezen. Geometrie wordt geschreven als **paden in millimeters** met omtrek (curven afgevlakt tot een fijne tolerantie), tekst wordt omgezet naar paden en kleur wordt gemapt naar de dichtstbijzijnde AutoCAD Color Index (die doorgaans de tool/bewerking op een snijmachine aanstuurt). DXF is alleen lijntekening - een fotografisch of gefilterd gebied heeft geen snijpadvorm en wordt weggelaten (Lolly waarschuwt), dus gebruik SVG/PDF wanneer je rastercontent moet behouden.

Street Map is het duidelijkste geval: het hele ontwerp bestaat al uit lijnen, dus elke weg en elk kanaal wordt een snijpad zonder iets om weg te laten.

::: showcase
![Een Street Map-render van Parijs in inkt op crème - pure lijnkunst, zodat elke lijn de reis naar een snijmachine overleeft](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Scroll, en de camera zoomt terug door de daadwerkelijke geometrie: zeven paden, nergens pixels, elke lijn haarlijn-scherp op elke zoom. Dat is hetzelfde bestand dat een snijmachine leest.
:::

## Geanimeerde SVG

Bewegingstools (Animated Ad, Lottie Ad) kunnen **Geanimeerde SVG** exporteren - een op zichzelf staande, *vectoriële* animatie. In tegenstelling tot GIF/APNG/WebP (die elk frame naar pixels bemonsteren), stapelt een geanimeerde SVG vectorsnapshots met ingesloten CSS-keyframes, zodat ze **op elke grootte schaalt zonder codec en zonder externe runtime** - ze loopt in een browsertab of een `<img>`. Tekst blijft omlijnd zodat het overal wordt weergegeven. Ze deelt de **Duration**/framerate-besturing van de geanimeerde formaten, en gebruikt (omdat ze per frame zwaarder is dan een bitmap) een lagere standaardframerate.

## Transparantie

Tools die het ondersteunen bieden een schakelaar voor **transparante achtergrond** (bijv. *No BG*). Transparantie wordt behouden door PNG, WebP, AVIF, SVG (statisch en geanimeerd), APNG en Animated WebP. JPG en PDF zijn altijd ondoorzichtig, en TIFF wordt platgeslagen op wit (op zwart bij het HDR-pad - zie hieronder).

## Kleurruimtes

Twee verschillende vragen, die je uit elkaar moet houden: welke kleurruimtes Lolly kan **lezen en waarin denken**, en welke het **schrijft**.

**Lezen.** Overal waar een kleur wordt geschreven - het stylesheet van een tool, de paint van een geïmporteerde SVG, de waarde van een designtoken, een schaduw of gradiënt binnen een CSS-shorthand - leest Lolly de volledige **CSS Color 4**-vocabulaire: `#hex`, `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, de benoemde CSS-kleuren en `color()` in de vooraf gedefinieerde ruimtes - `srgb`, `srgb-linear`, `display-p3`, `a98-rgb`, `prophoto-rgb`, `rec2020`, `xyz-d50`, `xyz-d65` - inclusief componenten geschreven als het `none`-sleutelwoord. Eén parser doet dit voor het hele platform, zodat de browser en elke exportwalker het eens zijn over wat een kleurstring betekent.

Dat is belangrijker dan het klinkt, omdat een browser moderne CSS omzet naar moderne CSS. Schrijf `color-mix(in oklab, …)` en Chrome berekent `oklab(…)`; gebruik een merktoken opgeslagen als `oklch()` en dat is de letterlijke waarde die de exportwalker ziet. Kleuren in die vormen worden correct gelezen in plaats van weggelaten - wat een walker die alleen `rgb()` begreep deed, waardoor merkgekleurde tekst als zwart werd geëxporteerd, getinte panelen en tabelregels verloren gingen en `oklch(0.7 0.1 200) 0px 2px 4px` werd gelezen als een schaduwverschuiving van 0.7 bij 0.1.

**Denkwerk.** Kleurwiskunde gebeurt perceptueel in plaats van in ruwe kanalen. Paletafleiding, verlopen, harmonieën en contrast draaien in **OKLCH/OKLab**, en een kleur buiten het gamut wordt binnen bereik gebracht door CSS Color 4's eigen gamut-mapping-algoritme - chromareductie met een perceptuele-afstandscontrole - in plaats van door kanalen af te knippen, zodat een felle kleur uitkomt op de dichtstbijzijnde kleur die je daadwerkelijk zou accepteren, in plaats van een afgevlakte. Verlopen interpoleren in een ruimte die je zelf kiest (standaard OKLab, of `oklch`, `lab`, `lch`, `srgb`, `srgb-linear`, `hsl`, met een tintrichting voor de polaire varianten), en menging is **premultiplied**, zodat een fade naar transparant de juiste kleur behoudt in plaats van onderweg naar zwart te verdonkeren. Eén interpolator bedient zowel de preview als de export-walkers - wat voorkwam dat een conisch verloop op het scherm anders werd gemengd dan in het geëxporteerde bestand.

**Schrijven.** De output is bewust smaller dan de input, omdat een bestand leesbaar moet zijn voor wat het ook opent, en een ruimte wordt alleen ooit *gedeclareerd* bij output wanneer de getallen daadwerkelijk ernaar zijn omgezet. Scherm- en webformaten worden geschreven als **sRGB** en als zodanig getagd; de printformaten worden geschreven als **CMYK** tegen een benoemde persconditie (hieronder); en het HDR-pad is **Rec.2100 PQ** (hierboven). Een kleur met een breed gamut die een export bereikt, wordt naar sRGB gemapt in plaats van verkeerd gelabeld - `color(display-p3 …)` doorvoeren tot in een vectorbestand is een geplande uitbreiding, geen iets dat de huidige exports beweren te doen. Een gradiënt gemaakt in OKLab wordt op weg naar buiten *gebakken* tot gewone sRGB-stops, met extra stops alleen ingevoegd waar sRGB zichtbaar zou afwijken van de perceptuele curve, omdat een SVG `<linearGradient>` en een PDF axiale shading geen instelling voor interpolatieruimte hebben om de bedoeling over te dragen. Eén geautoriseerde waarde, drie renderers, geen afwijking.

## Kleurprofielen

Zodat kleuren getrouw worden gereproduceerd in kleurbeheerde apps (drukkerijen, Photoshop, browsers), worden exports **getagd met een kleurprofiel**:

- **PNG / JPG** bevatten een ingesloten **sRGB**-ICC-profiel - de kleurruimte waarin de preview daadwerkelijk wordt gerenderd - zodat er niets te raden overblijft. (Alleen tagging; de pixels worden niet opnieuw gecodeerd.)
- **Print PDF (CMYK)** declareert een doel-**persconditie** in de *OutputIntent* (standaard *Coated FOGRA39*), die een RIP/drukkerij vertelt hoe de CMYK-inkten bedoeld zijn te worden gelezen. Merkstalen met gemeten inktwaarden worden exact omgezet; andere kleuren gebruiken een standaard apparaatconversie. Die declaratie is een *naam*: er wordt geen CMYK-profiel meegeleverd met Lolly, en PDF/X-4 wil het profiel ingesloten hebben, dus een benoemde conditie schrijft de outputintent zonder PDF/X-4-conformiteit te claimen. Laad een eigen CMYK-profiel en kies de rij **Embed** in de besturing Kleurprofiel, en het wordt ingesloten als het *DestOutputProfile* van het bestand - op dat moment kan de PDF echt PDF/X-4 zijn, en claimt dit wanneer de rest van het bestand het toelaat. Drie dingen houden de claim tegen terwijl de outputintent behouden blijft (een RIP wil die nog steeds): RGB-artwork dat de CMYK-pas niet kon omzetten, de bewijsmargetekst `prov` (getekend in een standaardlettertype dat niet is ingesloten, en X-4 maakt daar geen uitzondering voor) en een **Strong**-wachtwoord, aangezien X-4 versleuteling verbiedt. De conditie die wordt gedeclareerd, wordt dan van dat profiel afgelezen: een geregistreerde naam waar het profiel er een bewijst, `Custom` onder de eigen naam van het profiel waar dat niet zo is, zodat het bestand nooit de ene persconditie kan benoemen terwijl het de metingen van een andere bevat.
- **Print TIFF (CMYK)** schrijft ongetagde **DeviceCMYK**-pixels en registreert dezelfde persconditie als herkomst in de TIFF-metadata (*ImageDescription*) in plaats van een profiel in te sluiten. Dezelfde besturing Kleurprofiel stuurt beide CMYK-formaten aan - een TIFF kan helemaal geen persprofiel insluiten, dus een rij **Embed** registreert daar alleen de eigen naam van dat profiel.
- **TIFF (RGB)** is de gewone, ongecomprimeerde sRGB-tegenhanger - een verliesvrije raster op de gekozen DPI voor archivering of een heen-en-weer-reis met een editor, met herkomst geregistreerd in dezelfde TIFF-metadata. Elke transparantie wordt platgeslagen op wit (dit profiel bevat geen alfa). Net als de CMYK-TIFF is het alleen voor desktop, aangezien browsers geen TIFF kunnen voorvertonen en mobiele downloads doodlopen.
- **SVG**, **EMF**, **EPS** en **DXF** zijn resolutie- en profielonafhankelijke vectoren zonder ingesloten profiel - de kleuren van SVG zijn gewoon sRGB, die van EMF en EPS zijn device-RGB (en **EPS (CMYK)** schrijft naïef DeviceCMYK) en **DXF** bevat de dichtstbijzijnde AutoCAD Color Index. (SVG, EPS en DXF zetten, net als PDF, alle tekst om in vectorpaden, zodat het resultaat overal wordt weergegeven, ook als het lettertype niet is geïnstalleerd. EMF houdt tekst standaard LIVE - echte metafile-tekstrecords die selecteerbaar en bewerkbaar blijven in Office en Google Slides, en valt alleen terug op omlijningen voor teksten die het formaat niet kan uitdrukken; de optie "Outline fonts" in het exportpaneel dwingt overal paden af.) **SVG** reproduceert ook CSS `box-shadow` uit de HTML - elke buitenschaduw wordt achter het vak getekend, verschoven/verspreid en Gaussisch vervaagd om overeen te komen met de browser, en inzetschaduwen worden op dezelfde manier binnenin getekend.

Dit gaat automatisch - niets om aan te passen. Miniaturen en previews slaan de tag over om klein te blijven. Eén profiel *is* een keuze, omdat het de pixels verandert in plaats van ze alleen te labelen - zie **HDR** hieronder.

## HDR (heldere kleuren)

Gewone exports zijn sRGB: wit is wit, en een verzadigde merkkleur is net zo helder als het normale wit van het scherm. Op een HDR-geschikt scherm is daarboven veel speling, en de **HDR**-kaart in het exportpaneel gebruikt die - je merkkleuren en witte tekst worden richting piekhelderheid opgestuwd zodat ze echt *gloeien*, terwijl de donkere gebieden donker blijven en de gloed zijn contrast geven.

![De HDR-kaart in het exportpaneel, ingeschakeld, met de knoppen White / Reach / Dark lift / Focus eronder zichtbaar](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formaten.** De rasterformaten met een plek om het signaal te dragen: **PNG**, **JPG**, **AVIF** en **TIFF**. (Geen WebP - dat is 8-bit zonder werkend HDR-decodepad, dus een PQ-WebP zou er gewoon donker uitzien. Vectoren en PDF hebben helemaal geen HDR-model.)
- **Standaard uit**, anders dan kleurtagging - het verandert de pixels, dus het is opt-in. Vink de kaart aan, of geef `hdr=1` mee in een deellink.
- **Wat er daadwerkelijk wordt geschreven.** De pixels worden opnieuw gecodeerd naar **Rec.2100 PQ** - BT.2020-primairen met de SMPTE ST 2084 (PQ) transfercurve - en de container draagt het bijpassende signaal zodat een kleurbeheerde app weet dat hij ze zo moet lezen: een gegenereerd **ICC v4-profiel met een `cicp`-tag** (JPG, TIFF), een **`cICP`-chunk** (PNG) of een herschreven `colr`-box (AVIF). De versterking is gekoppeld aan **perceptuele (OKLab-)helderheid**, dus middentonen en hoger schieten naar piek en donkere tonen worden getemperd in plaats van uitgebrand, en het is kleurtoonbehoudend - een merkgroen wordt helderder, niet mintig.
- **De regelaars.** Vier, zichtbaar als de kaart aanstaat: **White** (het piekhelderheidsplafond, 400-2000 nits), **Reach** (hoe ver naar beneden in de tinten de gloed reikt), **Dark lift** (hoeveel de donkere tonen opgehelderd worden - `0` houdt ze donker) en **Focus** (hoeveel kleurrijkheid de versterking behoudt). Ze rijden mee in dezelfde parameter als een compacte afgestelde waarde - `hdr=1600-60-0-50` is White 1600, Reach 60, Dark lift 0, Focus 50 - zodat een afgestelde look reproduceerbaar is vanuit de link.
- **Waar je het zult zien.** Kleurbeheerde viewers op een HDR-scherm: Preview / Quick Look / Safari op Apple-apparaten, Chrome op een HDR-monitor. Op een gewoon SDR-scherm toont het bestand nog steeds als een normale afbeelding.
- **Weten voordat je het verstuurt.** Veel platforms **coderen opnieuw** wat je uploadt en strippen het HDR-signaal - sociale netwerken, berichten-apps, sommige CMS'en - wat de afbeelding donker of verwassen kan laten ogen. Gebruik HDR waar je de bestemming beheerst (een site die je zelf bouwt, een videowand, een presentatie op een helder paneel), niet als standaard voor alles.
- **Transparantie.** PNG en AVIF behouden hun alpha; JPG is zoals altijd ondoorzichtig. Het **TIFF**-pad platteert op **zwart**, niet op het wit van het SDR-pad - in PQ is wit de 10.000-nits-code, dus platten op wit zou elke rand omringen met een verblindende halo.
- **Dezelfde bytes vanaf de terminal.** `--hdr=1` met `--export=png` of `--export=jpg` schrijft de 16-bit Rec.2100 PQ-PNG en de ISO 21496-1 gain-map-JPEG ook op de [CLI](/info/cli.html), uit dezelfde engine-encoders in plaats van een browser - dus een `<svg>`-native tool produceert een HDR-bestand zonder ergens Chromium in het pad, en de PNG is byte-identiek aan die van de webshell. AVIF en TIFF blijven voorlopig webshell-exports.

## Video

Geanimeerde tools exporteren beweging als **MP4**, **WebM** of **GIF** - en, waar aangeboden, **APNG**, **Animated WebP** of de vectoriële **Geanimeerde SVG** (hierboven). Welke videocontainer je ziet, hangt af van je browser - de kiezer toont alleen wat hij daadwerkelijk kan opnemen:

| Browser | Toont |
|---|---|
| Safari / iOS | **MP4** |
| Firefox | **WebM** |
| Chrome / Edge 126+ / Android | **MP4 en WebM** |
| Oudere Chrome | **WebM** |

GIF werkt overal (geweldig voor chat/e-mail; groter en met minder kleuren dan video). Geanimeerde tools tonen ook **Wait** (seconden om de animatie te laten settelen voordat wordt opgenomen) en **Duration** (cliplengte).

> Een gedeelde `?format=…` link die een container aanvraagt die je browser niet netjes kan opnemen, valt automatisch terug op de andere en benoemt het bestand dienovereenkomstig.

**Geluid.** Video-exports zijn niet stil. Een tool kan een **muziekbed** onder de clip leggen - een audio-asset uit de catalogus, in lus of ingekort tot de cliplengte, met fade-in/out, volume en automatische ducking onder het eigen geluid van de beelden - en de opnametools voeren het live geluid van hun beelden rechtstreeks door naar het bestand. **MP4** en **WebM** behouden het gemixte spoor; GIF en de geanimeerde afbeeldingsformaten (APNG, Animated WebP, Animated SVG) zijn van nature stil.

## Audio

Sommige tools exporteren **audio los**, niet alleen als videospoor. De **Voice Recorder** legt een micro-opname vast met een live niveaumeter en zachte begeleiding, en slaat die op als **MP3** (de standaard, getranscodeerd in je browser) of in zijn native container - **M4A** (AAC), **OGG** of **WebM** (Opus), afhankelijk van wat je browser opnam. Zoals met al het andere gebeurt de codering op je apparaat - er wordt niets geüpload.

Audio die je *zelf aanlevert* is net zo breed. De asset-kiezer accepteert **MP3**, **WAV**, **OGG**/**Opus**, **M4A**/**AAC** en **FLAC** (byte-voor-byte behouden en on-device gedecodeerd), **MIDI** (`.mid` - bij import omgezet naar een klein on-device synthspoor) en **trackermodules** - **MOD**, **XM**, **IT**, **S3M**, **STM**, **MTM** (on-device gedecodeerd door een meegeleverde player, enkele kilobytes songdata). Elk hiervan kan het **muziekbed** onder een video-export worden, of afspelen in de ambient player van Neurospicy Mode.

Audio *maakt* deel uit van de `format=` / `--export=` pipeline hieronder: `wav`, `mp3`, `m4a` en `opus` zijn gewone format-id's, dus een audio-only export is net zo deelbaar en scriptbaar als een PNG. Wat eruit komt is alleen het geluid, geen beeld.

## Herkomst & watermerk

Waar het formaat het ondersteunt, dragen exports **herkomstmetadata** - software, bron, de naam van de tool en je profielvermelding - native ingebed (PNG iTXt, JPEG EXIF, PDF-info, SVG `<metadata>`, GIF-commentaar). Het is puur auteurschap; er wordt niets geüpload. **Experimentele** tools stempelen bovendien een zichtbaar watermerk, aangebracht door de host zodat het niet te verwijderen is door de tool te bewerken.

**De Lolly Imprint.** Rasterexports dragen ook Lolly's eigen **onzichtbare pixelwatermerk** - de *Lolly Imprint* - **standaard aan**, net als Content Credentials. Waar de credential en de herkomstmetadata *naast* de pixels meereizen en verloren gaan bij een re-save, een screenshot of het strippen van metadata, leeft de Imprint *in* de pixels en overleeft hercompressie - zodat een kopie van de afbeelding later nog als Lolly-gemaakt herkend kan worden. Het is een duurzame aanwijzing, geen cryptografische garantie, en louter aanwezigheidsgebaseerd (er zit geen persoonlijke data in). Hij zit in **PNG, JPG, WebP, AVIF, TIFF en BMP**, en in de door Lolly gerenderde rasters die in een **PDF of PPTX** zijn samengesteld - nooit in een afbeelding die *jij* hebt ingesloten, alleen in wat Lolly zelf rendert. Vink de **Lolly Imprint**-kaart in het exportpaneel uit om het over te slaan, of geef `imprint=0` mee in een deellink. (Het overleven van AVIF bij hercodering is nog niet gekalibreerd; PDF/PPTX-detectie dekt de ingesloten Lolly-rasters.) [/verify](/verify) detecteert het on-device - zie [Content Credentials Identity](/info/content-credentials-identity.html#the-lolly-imprint).

**De duurzame credential.** Naast de Imprint staat een tweede, zwaardere markering: **Durable credential**, die een on-device neuraal model (TrustMark-formaat) gebruikt om Lolly's id *in* de pixels te schrijven, zodat de "gemaakt met Lolly"-koppeling een metadatastrip, een hercodering en herlezing door TrustMark-bewuste tools én door Lolly zelf overleeft. Het staat **standaard uit** - in tegenstelling tot de pure JavaScript-Imprint kost het een neurale pas per export plus een eenmalige modeldownload, dus het is een bewuste opt-in in plaats van een stille belasting. Alleen raster (**PNG, JPG, WebP, AVIF, TIFF**), aangevinkt in het exportpaneel of meegegeven als `durable=1` in een deellink. Op de desktop- en mobiele apps is de kaart volledig verborgen in plaats van als no-op getoond, omdat er offline geen bron is om het model van op te halen.

**Contentbescherming.** In het exportpaneel vouwen *Wachtwoordbeveiliging*, **C2PA Credentials**, de **Lolly Imprint** en de **Durable credential** samen tot één ingeklapte, formaatbewuste groep **Contentbescherming**, zodat de herkomst- en beschermingsopties van een bestand op één plek staan - de groep toont alleen de kaarten die van toepassing zijn op het gekozen formaat, en verbergt zichzelf volledig als geen enkele dat is. Drukmarkeringen zitten er bewust *niet* in: het is productiegeometrie voor druk, geen bescherming, dus **Drukmarkeringen & afloop** - de afloopmaat in millimeters plus Snijlijnen, Registratie, Afloop, Kleurbalken en Stempeldetails - houdt zijn eigen kaart op het hoogste niveau bij de drukformaten.

![De groep Contentbescherming geopend op een PNG-export, met alleen de kaarten die erop van toepassing zijn](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

**Voordat je exporteert (drukpreflight).** Zet **Drukpreflight** (`export-preflight`) aan bij de featureflags van je profiel - het staat **standaard uit**, zodat iemand die een PNG voor een chatbericht exporteert nooit overvallen wordt door prepress-bevindingen, en een implementatie ([lolly.work](https://lolly.work)) het voor haar leden standaard aan kan zetten - en er verschijnt een kaart **Voordat je exporteert** onderaan het paneel, direct boven de knoppen, telkens wanneer de drukregels iets waars te melden hebben over de opdracht: formaat, formaat en afloop, dan snij- en afloopgebieden, inktdekking, plaataantallen en paginaaantal, met een oordeel naast de kop. Hij staat onder elke instelling omdat het een uitspraak *over* die instellingen is in plaats van er nóg een van - en hij blokkeert nooit een export. Hij vertelt je wat een drukkerij zo te zien krijgt.

**Kosten, berekend vanuit je tarievenkaart.** Onder preflight - helemaal onderaan, nog steeds boven de knoppen - staat een kaart die diezelfde tellingen omzet in geld, en dat altijd alleen op basis van prijzen die iemand heeft opgegeven. Hij leest wat de preflight-pas geteld heeft, of de preflight-kaart zelf nu aan staat of niet, en heeft twee dingen nodig om waar te zijn: de opdracht heeft iets dat een prijslijst überhaupt kan prijzen (platen, vellen, oppervlakte, pagina's, variantregels of outputbestanden - dus een gewone logo-PNG toont hem nooit), **en** er is een **tarievenkaart** aanwezig. Een tarievenkaart is een JSON-prijslijst van je drukker. Een standaardbuild bevat er geen en heeft geen manier in de app om er een te laden: hij komt ofwel binnen als catalogus-asset die een implementatie meelevert, of via de optionele tarievenkaart-extensie die een self-hoster of control plane aanzet. Zonder tarievenkaart wordt niets getoond - geen prompt, geen lege tabel.

De regel waar het geheel op gebouwd is, is dat **er nooit geld verzonnen wordt**. Elk cijfer is een tarief dat jij hebt aangeleverd vermenigvuldigd met een hoeveelheid die Lolly geteld heeft - `4 platen × € 35,00` - en het totaal noemt zijn eigen bron in dezelfde zin als het cijfer: de uitgever die de kaart noemt, en de datum waarvan de kaart zegt dat de tarieven zijn. Er is geen standaardvaluta, geen placeholder en geen nul die staat voor een ontbrekende prijs. Wat het bestand over zichzelf zegt, blijft weergegeven als citaat: *"Het bestand zegt: … Lolly heeft dit niet geverifieerd."*

En als het niet eerlijk kan rekenen, **verdwijnt** de werktabel in plaats van te verwateren tot een grijs gemaakt of ingevuld cijfer:

- Regels die de kaart niet prijst betekenen **helemaal geen totaal** - alleen een kop die zegt hoeveel ervan ongeprijsd zijn. Een gedeeltelijke som is geen kleiner antwoord, het is een fout antwoord.
- Een hoeveelheid die een bovengrens is in plaats van een exact aantal draagt **"tot"** door in het subtotaal, zodat een grens nooit witgewassen wordt tot een vast cijfer.
- Tarieven na hun geldig-tot-datum tonen **alleen aantallen**, totdat je op *Deze tarieven toch gebruiken* drukt - en dan reist de vervaldatum mee met het cijfer, zodat een verlopen totaal niet als actueel gelezen kan worden.
- Geopend via een **link** blijft geld verborgen totdat je erom vraagt op dit apparaat. Noch de kaart, noch die onthulling reist ooit mee in een URL - dezelfde reden waarom de CLI `--rate-card=<file.json>` als een lokale bestandsvlag neemt en nooit als linkparameter.

De kaart is chrome, nooit content: hij wordt uit elke exportfase gestript, dus hij kan geen pixel verplaatsen van het bestand dat je downloadt. En het is rekenwerk, geen offerte - alleen je drukker kan je die geven.

**Samengestelde renders.** Wanneer een tool de output van een andere tool insluit (bijv. een *Event Name Badge* die een *QR Code* insluit), wordt de geneste render ingevoegd in de export van de ouder - het blijft een **echte vector** in SVG en PDF en rasteriseert scherp in PNG/JPG/WebP. Het ingesloten kind is een tussenstap: het krijgt *geen* watermerk en *geen* eigen herkomst; alleen de afgeronde ouder-asset krijgt die. (Compositie geldt voor SVG en de rasterformaten; HTML/MD/TXT kunnen niet samengesteld worden.)

## Wachtwoordbeveiliging

Twee onafhankelijke soorten sloten, beide volledig on-device.

**PDF-openwachtwoord** - de kaart *Wachtwoordbeveiliging* in het exportpaneel biedt twee niveaus:

![De kaart Wachtwoordbeveiliging uitgeklapt op een PDF-export, met het wachtwoordveld en de twee slotniveaus](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

- **Standaard** - een eenvoudig 40-bits slot (RC4). Het opent in *elke* PDF-app, en - als lichte afschrikking, geen echte bescherming - kan het meereizen in een deellink (leesbare tekst, met opzet). Alleen RGB `pdf`.
- **Sterk** - AES-256 (PDF 2.0). Het wachtwoord wordt getypt bij export en komt **nooit** in een link; het opent alleen in nieuwere PDF-apps (Acrobat / Preview ~2018 en later), en oudere apps kunnen het bestand als beschadigd melden. Sterk geldt ook voor **Print/CMYK-PDF's** en voor **elke PDF binnen een batch-zip** (de batchbevestigingsdialoog verzamelt het wachtwoord). Omdat PDF/X-4 versleuteling verbiedt, behoudt een met Sterk vergrendelde Print-PDF zijn CMYK, markeringen en output-intent maar laat de PDF/X-4-conformiteitsclaim vallen.

Beide niveaus sluiten Content Credentials wederzijds uit (een versleutelde PDF kan de credential niet dragen).

**Vergrendelde downloads (hele zip + defense-in-depth)** - een **ZIP**-export (het ZIP-formaat van het exportpaneel, dat meerdere formaten van een tool bundelt), een **map**-download (Projecten → Downloaden) of het **batchraster** kan de hele zip met één wachtwoord vergrendelen, op twee niveaus:

- **Standaard** - traditionele **ZipCrypto**: opent in *elke* uitpaktool, inclusief de ingebouwde extractie van Windows Verkenner, maar zwak (een afschrikking). Het wachtwoord kan meereizen in een `?password=`-deellink.
- **Sterk** - **AES-256** (WinZip AE-2): sterk, maar opent **niet** in de ingebouwde extractie van Windows Verkenner - de ontvanger heeft 7-Zip / WinZip / Keka / macOS nodig. Getypt bij export, nooit in een link geplaatst.

Dezelfde kaart *Wachtwoordbeveiliging* in het exportpaneel stuurt zowel de PDF- als de ZIP-vergrendeling aan, en herformuleert zichzelf voor het gekozen formaat. Het ene wachtwoord beschermt **elk** lid - afbeeldingen, SVG, alles, PDF's inbegrepen (alleen de zip-container kan niet-PDF-bestanden beschermen, die geen eigen slot hebben). En het is **defense-in-depth**: elke PDF erin wordt *ook* individueel AES-256-vergrendeld met hetzelfde wachtwoord, zodat een PDF vergrendeld blijft ook nadat de zip is uitgepakt. De prompt verschijnt zodra je de download start; een leeg wachtwoord betekent geen slot.

**Wachtwoordbeveiligde deellinks** - elke deellink kan versleuteld worden, zodat het openen ervan de ontvanger om een wachtwoord vraagt. De hele linkstatus wordt AES-256-versleuteld onder een sleutel die uit het wachtwoord is afgeleid (PBKDF2); er reist alleen cijfertekst mee, dus het **wachtwoord staat nooit in de link** en ontsleuteling gebeurt **in de browser van de ontvanger** - de server die de link serveert, ziet alleen de cijfertekst in de URL, nooit het wachtwoord en nooit het ontsleutelde ontwerp. Zet het aan in de dialoog **Delen**. Een versleutelde link kan alleen in Lolly *geopend* worden (hij kan niet als afbeelding ingesloten worden, omdat dat pad niet kan promptén). Zie [URL-modus → Versleutelde links](/info/url-mode.html).

## Content Credentials (C2PA)

Exports kunnen **Content Credentials** dragen - een ondertekend [C2PA](https://c2pa.org)-manifest ingebed in het bestand, dat op een manipulatiebestendige manier vastlegt dat het bestand met Lolly is gemaakt en sindsdien niet is gewijzigd. Het is de standaardversie van de herkomstmetadata hierboven: een cryptografische claim (wat het bestand maakte, wanneer, door wie en waar) gebonden aan een hash van de bytes van het bestand, zodat een latere bewerking detecteerbaar is door een C2PA-bewuste viewer. De standaard wordt beheerd door het [Content Authenticity Initiative](https://contentauthenticity.org) (Adobe, BBC, Microsoft, Nikon en anderen), dus dezelfde credentials die Lolly schrijft zijn dezelfde die camera's, redacties en creatieve suites aan het overnemen zijn.

![De kaart C2PA Credentials, vooraf aangevinkt, met de levensduur van de credential ernaast](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Formaten.** Elke container met een C2PA-inbedding: **PDF** (zowel RGB als Print), **PNG / Animated PNG**, **JPG**, **GIF**, **SVG**, **TIFF** (RGB en Print), **WebP** (stilstaand en geanimeerd), **AVIF**, **MP4**, **WebM** en de audiocontainers **MP3**, **WAV**, **M4A** en **OGG/Opus** - zodat een opgenomen of gesynthetiseerde stemclip dezelfde credential meekrijgt als een afbeelding. Een **ZIP**-bundel stempelt elk ondersteund lid afzonderlijk, wat ook waar een **Animated SVG** er een oppikt (het is onderliggend een gewoon SVG-document; een directe Animated SVG-export biedt geen eigen kaart). MP4, AVIF en M4A gebruiken de BMFF-binding van de spec en MP3 zijn ID3v2-mapping, dus `c2patool` en andere C2PA-bewuste viewers verifiëren ze; **WebM** en **OGG/Opus** hebben nog geen gestandaardiseerde C2PA-mapping, dus Lolly draagt het manifest als een Matroska-bijlage respectievelijk een OpusTags-veld, wat Lolly's eigen verifier (en CLI) controleert. (`ico`, `eps`, `emf`, `dxf`, `bmp`, `pptx`, de Office-formaten en de tekst-/dataformaten hebben geen C2PA-container.)
- **Standaard aan.** De kaart **C2PA Credentials** in het exportpaneel is voor bijna elke tool vooraf geselecteerd - vink uit om de credential op één export over te slaan (of geef `c2pa=off` mee in een deellink). Een tool kan er in zijn manifest volledig voor kiezen om af te zien.
- **Wat het vastlegt.** De tool en app die het bestand maakten, het ondertekeningstijdstip, het exportoppervlak (browserengine-familie + OS-familie - opzettelijk grof, nooit een vingerafdruk) en - alleen wanneer *Profiel → Mijn gegevens gebruiken* aan staat - je naam en e-mail als auteur van het werk.
- **Wat ontvangers zien.** Tools die Content Credentials inspecteren (Adobe-apps, `c2patool`, contentcredentials.org/verify) lezen het manifest en tonen de claim. Omdat Lolly ondertekent met een sleutel die **op je apparaat** gegenereerd is - geen certificaat van een vertrouwenslijst - melden viewers het als een *ongeverifieerde* credential. De structuur en de manipulatiebestendigheid zijn echt; alleen de identiteit van de ondertekenaar wordt eenvoudigweg niet door een autoriteit gewaarborgd. Om dat op te waarderen kun je een **geverifieerde identiteit** inschrijven (Profiel → Content Credentials): een kortlevend certificaat van de Lolly CA koppelt je e-mail aan je exports terwijl de ondertekeningssleutel nog steeds nooit je apparaat verlaat - zie [Content Credentials Identity](/info/content-credentials-identity.html).
- **Een bestand controleren.** Lolly verifieert ook zijn eigen credentials: zet een bestand op [/verify](/verify) (of voer `lolly validate <file>` uit in de CLI) voor een on-device rapport - vooraan of het bestand echt met Lolly is gemaakt en sindsdien ongewijzigd is. De webweergave Verify leest veel verder dan de credential: het markeert **AI-gegenereerde content**, detecteert de **Lolly Imprint**, controleert **SEAL**-handtekeningen en (opt-in) watermerken van derden en toont **verborgen data** - alles on-device, niets geüpload. Zie [Content Credentials Identity → Voorbij de credential](/info/content-credentials-identity.html#beyond-the-credential-what-else-verify-shows).
- **Privacy.** Alles gebeurt op je apparaat: de ondertekeningssleutel wordt aangemaakt voor de export en verlaat de browser nooit, er wordt niets geüpload en de claim bevat alleen wat de herkomstmetadata al draagt. Privacyhulpmiddelen (on-device transformaties van *je eigen* bestanden) voegen nooit credentials toe, en *Verborgen data verwijderen* verwijdert een C2PA-manifest net als elke andere ingesloten metadata.
- **Interacties.** Voor PDF's sluiten Content Credentials en **wachtwoordbeveiliging** (beide niveaus - zie hierboven) elkaar wederzijds uit (een versleutelde PDF kan de credential-bijlage niet dragen). De credential wordt toegevoegd als laatste stap over de afgeronde bytes - na DPI/EXIF/kleurprofielstempeling, PDF/X-metadata en drukmarkeringen.

## Op een telefoon

De exportbediening zit achter de zwevende knop **Render**, die het **Export**-blad opent - dezelfde formaten, formaat, kopiëren, downloaden en delen, aangepast voor touch.

## Formaatoverzicht

Elk id dat de host kan renderen, gegroepeerd. Dit zijn ook de waarden voor de URL-parameter `format=` en de CLI-vlag `--export=` - zie [URL-modus](/info/url-mode.html) en [CLI](/info/cli.html). Een tool biedt alleen de subset die zijn auteur declareerde, dus de kiezer is altijd korter dan deze lijst.

| Soort | Id's |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vector | `svg` · `svgz` (gezipte SVG) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (snijbestand) |
| Pagina & document | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `scorm` (SCORM-cursuspakket, een zip) · `penpot` (Penpot-ontwerpbestand) · `docx` (Word) · `odt` (OpenDocument Text) |
| Beweging | `gif` · `apng` (Geanimeerde PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` |
| Audio | `wav` · `mp3` · `m4a` · `opus` |
| Tekst & data | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `css` · `scss` · `gpl` (GIMP-palet) |
| Bundel | `zip` |

Nog een paar id's komen van de **eigen export-hook van een tool** in plaats van het gedeelde renderpad: `ase` (Adobe Swatch Exchange, van Palette Lab), `exr` en `hdr` (Darkroom's high-dynamic-range rasters) en `ttf` / `otf` / `woff` (Font Convert). Ze kiezen een formaat op dezelfde manier - de kiezer, `format=`, `--export=` - de bytes worden alleen door de tool zelf gebouwd. Font Convert is de ene uitzondering: het transformeert een lettertypebestand dat *jij* aanlevert, dus er is niets voor een kale URL om te renderen.
