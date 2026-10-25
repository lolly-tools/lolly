# Lolly gebruiken

Je hebt Lolly open en wilt iets maken, bewaren en doorsturen. Deze pagina loopt die lus door: een tool openen, veranderen wat hij je laat veranderen, het resultaat opslaan en delen als link of bestand.

Alles hier draait op je apparaat, zonder account, en blijft offline werken zodra de tools en assets die je nodig hebt zijn gedownload. De app heeft een browser of app met WebGPU nodig om te starten; [Supported environments](/info/supported-environments.html) noemt de geteste.

## Wegwijs worden

::: figure using-app-map
Het startscherm: vier tabbladen bovenaan en de balk onderaan. Een tool toont, eenmaal geopend, zijn bediening naast een live voorbeeld.
:::

Vier tabbladen lopen bovenaan het startscherm: **Tools**, **Utilities**, **Assets** en **Projects**. Tools zijn waarmee je maakt, Utilities zijn werkbanken voor klussen zoals een bestand omzetten, controleren of opschonen, Assets is je bibliotheek en Projects bevat wat je opsloeg.

De balk onderaan bevat **Open**, **Settings**, een zoekveld, **Verify** en **What?**. Hij verschijnt op Tools, Utilities, Assets, Projects, Settings en de gidsen die je in de app leest, en stapt opzij zodra een tool open is. [Zoeken](/info/search.html) bereikt vanuit dat veld je tools, opgeslagen werk, assets en instellingen. [Ask Lolly](/info/ask.html) beantwoordt een getypte vraag met de passende sectie uit deze gidsen.

Klik op een kaart om iets nieuws in die tool te beginnen. Opgeslagen werk heropen je in plaats daarvan vanuit **Projects**.

![Een galerijkaart met voorbeeldnavigatie en een Nieuw-actie](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Elke tool is een gesplitste weergave: de **bediening** aan de ene kant en een live **voorbeeld** aan de andere. Wijzig een instelling en het voorbeeld volgt meteen, en wat je ziet is wat er wordt geëxporteerd.

![De gesplitste weergave van een tool - de bedieningsstack links, en de live gegroepeerde staafdiagram die hij rechts tekent](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Design** is de uitzondering. Het opent als een vrij canvas van vakken die je sleept, vergroot of verkleint en waarin je typt, met een eigen bovenbalk, tijdlijn en deckbediening. [Design: het vrije canvas](/info/design.html) is de gids ervoor.

## Wijzig wat de tool je laat wijzigen

Een tool toont alleen de invoer die bedoeld is om te variëren. De maker heeft de kleuren, lay-out, typografie en logica al vastgelegd, dus alles wat je maakt houdt zich aan zijn regels. Invoer omvat tekst, schuifregelaars, kleurkiezers, keuzelijsten, datums, afbeeldingskiezers en herhalende rijgroepen, en sommige staan in inklapbare secties.

![De stapel bedieningselementen van een tool - een tekstveld, kleurknoppen en een schuifregelaar, en verder niets: de rest heeft de maker vastgezet](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Klik op het ontwerp om de bijbehorende bediening te vinden.** Klik op een element in het voorbeeld en de bijbehorende bediening krijgt focus en scrolt in beeld. In een herhalende rijgroep klapt de rij waarop je klikte open.

**Clear changes**, boven de bediening, zet elke invoer terug naar de standaardwaarde.

**Keuzes van het design system.** Wanneer je design system meer dan één colourway biedt, een lichte en een donkere look of een andere themakeuze, staan ze in een sectie **Design system** onder de bediening. Een keuze verschijnt alleen wanneer ze deze tool verandert, dus een bestandshulpprogramma toont helemaal geen sectie. Elke colourway is een stip in zijn eigen kleuren, licht en donker zijn twee knoppen en elke andere keuze is een lijst.

De keuze hoort bij dit stuk. Ze reist mee in de link en de opgeslagen sessie, elke kleur die aan het design system is gekoppeld volgt haar en de eigen kleuren van de app blijven zoals ze zijn. Design toont dezelfde keuzes in het tabblad **Canvas** van de Inspector. Een tool waarvan de kleuren zijn inhoud zijn, kan op de canonieke colourway blijven, en biedt dan geen colourway-stippen. [Lolly Demo in gebruik](/info/lolly-demo-in-use.html#colourways-on-real-work) toont colourways op echt werk.

### Het voorbeeld zoomen en verschuiven

De voorvertoning toont altijd precies wat er geëxporteerd wordt.

- **Zoomen:** Cmd/Ctrl-scrollen of knijpen op een trackpad, gecentreerd op je aanwijzer. Op het toetsenbord past `0` of `Shift+1` alles in beeld, stelt `1` of `Shift+0` 100% in en past `Shift+2` de selectie in beeld. `+` / `−` zoomen rond de aanwijzer als die boven het werkvlak staat, en anders rond het midden.
- **Verschuiven:** houd **Space** ingedrukt en sleep, of sleep met de middelste muisknop. Gewone klikken blijven vrij om op onderdelen van het ontwerp te klikken.
- **Aanraken:** knijp om te zoomen, sleep om te verschuiven en tik tweemaal om te passen.
- **Zoom-HUD:** houd de Lolly-swirl in de hoek ingedrukt om `−`, **Fit** en `+` uit te klappen. Een korte tik op de swirl opent nog steeds je profielmenu.

In Design neemt **Fit all** de tekenborden en losse lagen mee. Je kunt handmatig onder 20% uitzoomen totdat de hele pagina de helft van de weergave vult. De vaste ondergrens is de laagste van 5% van de gewone Fit-schaal en 2% absolute zoom.

Een wijziging van het uitvoerformaat zet de weergave altijd terug naar een schone pasvorm.

![De zoom-HUD uitgeklapt vanuit de swirl in de hoek van het canvas - min, Fit, plus, dan de thema- en geluidsschakelaars en de greep waarmee je hem verplaatst](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### Ongedaan maken en opnieuw

**Cmd/Ctrl-Z** gaat een stap terug en **Cmd/Ctrl-Shift-Z** (of **Cmd/Ctrl-Y**) een stap vooruit. Hetzelfde paar staat als knoppen **Undo** en **Redo** boven de bediening (in Design staan ze in de bovenbalk), en elk wordt grijs wanneer er niets meer terug te nemen is. Een melding zegt welke invoer elke undo herstelde, met een knop **Redo** in de melding.

- **Een sleepbeweging is één stap.** Herhaalde wijzigingen aan één instelling binnen een halve seconde worden samengevoegd, dus een schuifregelaar over zijn bereik trekken is één undo.
- **De laatste 100 stappen worden bewaard.** Een nieuwe bewerking na een undo wist de voorwaartse stapel.
- **In een tekstvak** hoort Cmd/Ctrl-Z bij het veld, teken voor teken. Lolly neemt het over voor schuifregelaars, keuzelijsten, kleuren en schakelaars.
- **Een bestand kiezen** in een bestandsinvoer is geen stap, omdat die bytes alleen voor deze sessie worden bewaard.

In een live [samenwerking](/info/collaborate.html) blijft je geschiedenis van jou: een wijziging van het andere apparaat komt nooit op je stapel. Undo duurt tot je de tool verlaat of herlaadt. Voor alles wat ouder is, bewaren tools die tijdens het werk opslaan eerdere versies onder **History**; zie [Terug naar een eerdere versie](/info/find-your-work.html#go-back-to-an-earlier-version).

### Live camera

De effecten van de tool **Filter** (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art en Glitch) tonen een knop **Go live** waar een camera beschikbaar is. Zet hem aan en het effect volgt je webcam beeld voor beeld, en een bewegingsexport legt het resultaat vast als GIF, WebM of MP4. Beelden worden op je apparaat verwerkt, en de camera wordt vrijgegeven zodra je stopt of de tool verlaat. Elke afbeeldingskiezer heeft ook **Take a photo** voor één beeld.

## Opslaan & doorgaan

Om je werk te bewaren druk je op **Save**, het vinkje naast **Export** op de renderpil. Nieuw werk gaat naar **My library**, eerder opgeslagen werk wordt bijgewerkt waar het staat en er wordt niets gedownload. Het exportpaneel heeft dezelfde knop **Save**.

Om te kiezen waar het heen gaat, druk je op **Save as**, naast **Download** in het exportpaneel. Laat onder **Save to a project** **My library** geselecteerd of kies een project (**＋ New project…** maakt er een), en druk dan op **Save**; **Save as a template** bewaart het ontwerp als [sjabloon](/info/templates.html), een startpunt voor nieuwe documenten. In Design staat **Save as** in het Lolly-menu; druk op een telefoon op **•••**, dan op **File menu**, dan op **Save as**.

![De renderpil in twee helften: Export, met een pijl omhoog die het exportpaneel opent, en Save, met een vinkje dat ter plekke opslaat](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> Druk op **Save** op de renderpil, of op **Save as** om een project te kiezen.
- <!--i:folder--> Het item gaat naar **My library**, of naar het project dat je koos.
- <!--i:home--> Druk later linksboven op **Home** en open het tabblad **Projects**.
- <!--i:document--> Open het item. Elke instelling is terug, klaar om te wijzigen en opnieuw te exporteren.
:::

Items krijgen de naam van de bestandsnaam die je in het exportpaneel typte, of anders van hun tool, zoals **QR Code**. Een bestand dat je met **Download** krijgt is een afgeronde kopie; om het later te wijzigen, open je het opgeslagen item in Projects.

Persoonlijke opslagen blijven op dit apparaat, in de browser of app waarmee je opsloeg, tenzij je [Sync](/info/sync.html) aanzet. Als iets niet staat waar je het verwacht, behandelt [Je werk vinden en terughalen](/info/find-your-work.html) elk geval, van een gesloten tabblad tot gewiste browsergegevens.

::: details Teamprojecten met Lolly Work (optioneel)
Als je [organisatie Lolly Work gebruikt](/info/organisation.html), meld je dan aan bij de instantie en open **Projects → Team projects** voor sessies die met je gedeeld zijn. De organisatie stelt toegang en bewaartermijn in, en haar Lolly Work-dienst slaat die sessies op. Een gedeelde sessie sluit bij het openen aan bij zijn live collab wanneer je organisatie live bewerken toestaat; [Samenwerken](/info/collaborate.html#work-collabs-with-lolly-work-optional) legt de stappen uit.

Je persoonlijke bibliotheek blijft gescheiden. Aanmelden op een ander apparaat geeft je teamwerk, terwijl persoonlijke opslagen nog steeds Sync of een back-up nodig hebben om mee te verhuizen.
:::

## Je werk delen

Een ontwerp gaat de deur uit als link of als bestand. **Share** in de exportbediening opent een dialoog die beide biedt, en **Share link** op een opgeslagen sessie in Projects opent dezelfde dialoog voor die sessie.

::: cols
## Een link

- Draagt elke invoer in het adres, zodat de link het ontwerp reproduceert.
- Laat afbeeldingen en bestanden achter die je vanaf dit apparaat toevoegde, zeer lange tekst en zeer grote lijsten.
- Opent in elke browser, zodat je de link kunt bookmarken, plakken of committen.

## Een .lolly-bestand

- Draagt de opgeslagen sessie met de afbeeldingen en bestanden op dit apparaat, en kan ook de tool en het design system dragen.
- Houdt gelicentieerde catalogusafbeeldingen achter, tenzij je kiest de bestanden mee te nemen.
- Opent in Lolly: dubbelklik erop, gebruik **Open** of zet het op de app.
:::

### De link

De kant-en-klare link staat bovenaan de dialoog, met **Copy** en een knop **QR** die de tool QR Code opent op de link. Onder de link bevat **Link options**:

- **Open in the installed app** zet de link om naar een `lolly://`-adres voor Opdrachten, launchers en automatisering, met elke parameter ongewijzigd.
- **Shortest link** pakt een lang ontwerp in een compact token en toont de besparing in tekens. De leesbare vorm is er altijd ook.
- **Password-protect this link** versleutelt de link op je apparaat met AES-256. Het wachtwoord maakt nooit deel uit van de link.
- **Pin this tool version** voegt de vlag `_v` toe, zodat een latere toolupdate niet kan veranderen wat de link rendert.
- **When the recipient opens the link…** kiest volledig scherm, het exportpaneel al uitgeklapt, een download bij openen (`&export`) of een kopie naar het klembord (`&copy`).
- **Copy credit** kopieert een bijschrift "Made with Lolly" met de link, voor een bericht of een dia.

Wanneer een tool persoonlijke velden bevat, zoals je naam, houdt **Review personal fields** elk veld buiten de link totdat je dat veld aanvinkt. [URL-modus](/info/url-mode.html) behandelt alles wat een link kan dragen.

**De dialoog zegt wat een link niet kan dragen.** Een afbeelding of bestand dat je vanaf dit apparaat toevoegde, een zeer lange tekstwaarde en een zeer grote lijst passen niet in een adres. Elk wordt geteld terwijl de link wordt gebouwd. Als er iets moest worden weggelaten, noemt de dialoog het en wijst je naar de bestandsoptie, in plaats van je een link te geven die opent met een ontbrekende afbeelding. Een link die alleen lang is, krijgt een mildere opmerking met het aantal tekens.

**Sommige tools maken van de link het hele product.** Jump Page verzamelt je links op één pagina om uit te delen: een biolink, een talk, een etalage. Er wordt niets gehost en er zit geen account achter de pagina, omdat de pagina de link is. Een bezoeker krijgt hem op volle breedte, één link per scène terwijl hij scrolt.

![Jump Page in de editor: de kopscène boven aan de pagina, met de linkscènes eronder](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Door de organisatie beheerde links met Lolly Work
Voor delen dat een verloopdatum, intrekking of wachtwoord nodig heeft, biedt Lolly Work beheerde links naar gedeelde sessies, tools en catalogusassets. Ze worden opgelost via de dienst van de organisatie en volgen haar toegangsregels. Ze staan los van de zelfstandige links hierboven, en het intrekken van een link kan een bestand dat iemand al downloadde niet terughalen. [Rendering and sharing](/info/manage/sharing.html) noemt de linktypen en rechten.
:::

### Het .lolly-bestand

**Download .lolly**, in de sectie **Editable file** van de Share-dialoog, schrijft het huidige ontwerp als één bestand. Het draagt de opgeslagen sessie met de afbeeldingen en bestanden op dit apparaat, en gewone catalogusafbeeldingen gaan ook mee. Een verouderd of onbeschikbaar bestand blijft een externe verwijzing in plaats van te verdwijnen. Voordat het opslaat toont de dialoog de grootte van het bestand, hoeveel bestanden het insluit, hoeveel het refereert en of de tool is inbegrepen. Waar je apparaat een deelvenster heeft, geeft **Send to…** het bestand er rechtstreeks aan door (AirDrop, een Android-deelactie).

**Download project (.lolly)**, in het menu van een map in **Projects**, schrijft een hele map, zodat iemand anders verder kan met elke sessie in de map. Batchsessies blijven achter, en de melding zegt hoeveel. **Download originals**, in hetzelfde menu, schrijft een gewone zip van elk item als eigen bestand.

Drie dingen mag je zelf beslissen voordat een bestand de deur uit gaat:

- **Of je naam erin komt.** Je naam, e-mailadres en organisatie worden alleen geschreven wanneer **Use my details to create** aan staat in [je profiel](/info/profile.html). Staat het uit, dan legt het bestand alleen vast dat het met Lolly is gemaakt, en wanneer.
- **Of achtergehouden artwork erin komt.** Gelicentieerd artwork, merkvergrendeld artwork en catalogusstukken waarvan de licentie nooit is vastgelegd, blijven standaard buiten. Als het ontwerp er gebruik van maakt, zegt de dialoog hoeveel en biedt *Download without them* of *Include and download*, omdat het opnemen ervan de bestanden overhandigt aan wie het `.lolly` opent. De `CREDITS.txt` van het bestand noemt wat meereisde en wat niet, met de reden; [Creatieve rechten en vermeldingen](/info/creative-rights.html) legt de regels uit.
- **Of de tool erin komt.** **Include the tool** pakt de eigen bestanden van de tool in, zodat het ontwerp opent op een apparaat zonder die tool. Het staat standaard aangevinkt voor een aangepaste tool, zoals een fork, en uitgevinkt voor een tool die de ondertekende catalogus noemt. In een build zonder ondertekende catalogus telt elke tool als aangepast.

**Er een openen.** Dubbelklik in de desktop- en mobiele apps op een `.lolly` of tik erop, kies **Open with Lolly** of stuur het vanuit het deelvenster naar Lolly. Druk in de webapp op **Open** of zet het bestand op Lolly. Elke route leest eerst het manifest van het bestand en toont de grootte, de inhoud en wat er gaat gebeuren, voordat er iets wordt geschreven.

Als het bestand een tool bevat die je niet hebt, toont **Trust this tool?** de tool en zijn maker, en zegt dat openen de eigen code van de tool op je apparaat uitvoert. **Trust & install** gaat door. Weiger, en het werk wordt toch in Projects opgeslagen, wachtend op de dag dat je de tool toevoegt. Een tool waarvan de code als module wordt geleverd kan op deze manier nog niet worden geïnstalleerd, en wordt op dezelfde manier geweigerd.

::: details Wat een .lolly bevat en hoe het openen werkt
`.lolly` is de bundelextensie van Lolly, en het `format` in zijn `manifest.json` zegt wat erin zit:

- Een **gedeeld ontwerp** (`lolly-share`) bevat één opgeslagen sessie, de ingesloten bestanden en een bon voor alles wat nog via verwijzing wordt opgelost. Het kan ook de tool en het design system dragen. Het openen voegt een nieuw Project toe en overschrijft nooit een sessie.
- Een **gedeeld project** (`lolly-share`, soort `project`) bevat een map uit Projects: de submappen, elke sessie daarin met zijn tegel en de afbeeldingen die daar zijn opgeborgen. Het openen voegt een kopie van de hele map toe. Elke sessie reist als `sessions/<key>.json` met zijn tegel onder `thumbs/`. Een Lolly van vóór de projectbestanden vraagt je om bij te werken.
- Een **design-systempakket** (`lolly-brand`) bevat tokens en kan lettertypen, logo's, gepubliceerde versies en bewaarde bronnen bevatten. Het pakket openen voegt een apart benoemd design system toe en maakt dat systeem actief.
- Een **werkruimte- of instantiepakket** is een `lolly-brand` met aangegeven tools, catalogusassets en eventueel een instantieadres. Het laden van een pakket vervangt de ene werkruimte-overlay die eerder was geladen, en het voorbeeld noemt die effecten op het hele apparaat.

Een volledige apparaatback-up is geen `.lolly`. Het blijft een `LollyTools-….zip` (formaat `lolly-backup`) en wordt hersteld via **Settings → Storage → Import data…**. Een ingezipte toolmap blijft ook een `.zip`. [Data transfer](/info/data-transfer.html) is de formaatreferentie.

Een `.lolly` is een gewone zip. Hernoem het naar `.zip` om erin te kijken: je eigen afbeeldingen staan onder `assets/uploads/`, catalogusafbeeldingen onder `assets/catalog/`, `manifest.json` noemt elk bestand, en een README zegt wat het bestand is.

macOS, Windows, Linux, iOS en Android registreren allemaal het formaat, bestandsbeheerders op desktop tonen het als een Lolly-document en GNOME Files kan de eigen miniatuur van een opgeslagen sessie tonen. Openen vanuit Design System Setup beveelt de design-systeemactie aan wanneer een gedeeld ontwerp er een bevat, maar verbergt nooit **Open shared design**.

Een document dat vanuit een andere app op iOS of Android wordt overhandigd, is begrensd op 48 MB, omdat de overdracht de bytes over de appgrens kopieert, en de app zegt dat. **Open** binnen Lolly heeft zo'n grens niet, dus gebruik dat voor een grotere bundel.

Nadat je bevestigt, pakt Lolly de bundel eenmalig uit en verifieert hem. Assets gaan naar je bibliotheek, gekoppeld via checksum zodat een bestand dat al op het apparaat staat wordt hergebruikt. Sessies gaan met nieuwe id's naar Projects, zodat hetzelfde bestand tweemaal kan worden geopend; een sessie waarvan de tool ontbreekt, wacht daar. Bestanden boven 100 MB worden als groot aangemerkt, en het voorbeeld waarschuwt wanneer de browseropslag minder vrije ruimte meldt dan het bestand nodig heeft. Elk door integriteit gedekt onderdeel wordt gecontroleerd voordat er iets wordt vastgelegd, en een beschadigde kopie wordt geweigerd zonder dat er iets achterblijft.
:::

Een link en een bestand geven allebei een momentopname door. Voor live bewerken behandelt [Samenwerken](/info/collaborate.html) privécollabs tussen twee apparaten en optionele werkcollabs via Lolly Work.

## Assets - je bibliotheek

**Assets** (`#/a`) verzamelt alles waaruit je tools kunnen putten: merklogo's, afbeeldingen, audio en beweging, gegroepeerd per soort, samen met je eigen bestanden. Je uploads worden op je apparaat bewaard. Een organisatie die Lolly Work gebruikt kan ook een gedeelde catalogus leveren onder haar eigen toegangsregels; zie [Lolly gebruiken bij je organisatie](/info/organisation.html).

![Assets - merkassets, stalen en lettertypen, plus je eigen uploads](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Breng je bestanden binnen.** Zet een afbeelding, SVG, audioclip, video, Lottie, PDF of PowerPoint-deck op het uploadgebied, of klik om te kiezen. Het komt meteen in Assets en in de assetkiezer van elke tool. Een PDF met meerdere pagina's of een `.pptx` vraagt welke pagina's of dia's je wilt houden, en elk wordt een SVG-asset. Een afbeelding die je in een tool toevoegt, wordt bewaard zoals ze binnenkwam in **My images**, zodat een Content Credential erop nog steeds verifieert, en alleen een zeer groot bestand vraagt of het moet worden verkleind. **Settings → Storage** toont hoeveel **My images** bevat. Er is geen grens behalve de opslag van je apparaat. Om EXIF- en GPS-gegevens te wissen terwijl afbeeldingen binnenkomen, zet je **Strip metadata from uploads** aan onder **Settings → Feature flags**; Content Credentials blijven in beide gevallen behouden.
- <!--i:star--> **Maak favoriet wat je pakt.** Markeer een asset of een merkkleurstaal met een ster en hij wordt bovenaan elke kiezer vastgepind.
- <!--i:folder--> **Ruim op.** Verplaats een asset naar een andere groep, verberg een gedeelde merkasset die je niet gebruikt (**Show hidden** brengt hem terug) of verwijder je eigen uploads. Dezelfde selectiebalk als bij Projects werkt op een hele selectie.
- <!--i:layers--> **Haal een video van zijn achtergrond.** Open de details van een video, of klik met rechts op zijn kaart in een assetkiezer, en kies **Remove background…**. Een **On-device model** knipt een onderwerp uit een drukke scène; een **Colour key** verwijdert een gelijkmatig verlichte achtergrond zoals een greenscreen, met **Tolerance**, **Softness** en **Spill removal** voor de rand, en vereist geen download. **Resolution** (360, 480, 720 of 1080p, nooit boven de bron) ruilt detail voor snelheid. De uitsnede, een geanimeerde WebP of PNG met echte transparantie, wordt naast het origineel opgeslagen, en de Content Credential van de bron reist mee als ingrediënt. [Eenmaal gegenereerd, gelijk gerenderd](/info/ai-features.html) legt uit waarom dit een gewone bewerking blijft.

### Neem je palet en lettertypen overal mee naartoe

Het paneel **Swatches** in Assets toont de kleuren waaruit je merk bestaat: de merkkleuren, kleuren die je toevoegde, de verlopen en het spectrum. De rolkleuren die Lolly voor de interface bijhoudt (tekst, vlakken, randen, colourway-leads en kopieën van een merkkleur onder een andere naam) wachten achter een grijze kaart **Show colour roles** onderaan het paneel.

Elke kleur is een kaart zoals elke andere asset. Klik op een kaart om de details te openen, selecteer er een paar om alleen die te downloaden of download het hele palet in het formaat dat je andere tool leest:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** of **CSS classes**, voor een stijlblad of een build. Een kleur die breder is dan sRGB behoudt haar brede waarde: de CSS zet haar na de hex, en de JSON bewaart de hex met de brede kleur, de CMYK-opbouw en de steunkleurinkt ernaast.
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**, voor Illustrator of Photoshop. Een kleur die aan een CMYK-opbouw is vergrendeld komt aan als dat CMYK-staal, een steunkleurinkt als benoemd steunkleurstaal en een kleur breder dan sRGB als Lab.
- <!--i:pentool--> **GIMP-palet (.gpl)**, voor GIMP of Inkscape, en **SCSS variables**, beide in sRGB.

![Het paneel Swatches - de vijf downloadknoppen voor paletten bovenaan, dan elke merkkleur als chip die zijn details opent](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

Selecteer kleuren met de stip op elke kaart: Shift-klik op een tweede stip voor alles ertussen, sleep een kader door de tussenruimtes of druk op Cmd/Ctrl+A met een kaart in focus. De balk biedt **Download as…** in dezelfde zes formaten, **Copy hex** en **Favourite**. Voordat je een formaat kiest, noemt het menu elke kleur die geen enkel formaat kan bevatten (Transparent heeft helemaal geen kleur), welke formaten een brede kleur als sRGB-terugvaloptie opslaan (SCSS en GIMP) en welke de CMYK- en steunkleurwaarden dragen (JSON en .ase). Klik met rechts op een kaart voor dezelfde acties op één kleur.

De details van een kleur vullen het voorbeeld met de kleur en klappen **Linked values** uit (de CMYK-opbouw of steunkleurinkt, elke waarde die voor een bepaalde ruimte of pers is opgesteld en het designtoken), **Every notation** (hex, OKLCH, Display-P3 en de rest, elk met een kopieerknop), **Plotted on a colour space**, **Tones** en **Readability**. De pijltjestoetsen lopen door het palet, **Copy link** deelt de kleur zelf en **Open in Colour Lab** brengt haar verder.

Het paneel **Fonts** somt je merklettertypen op met een **download** voor elk, om lokaal te installeren of aan een drukker te geven.

## Maak het raster van jou

- <!--i:star--> **Maak favoriet wat je gebruikt.** Klik met rechts op een kaart en kies **Add to favourites**, en hij krijgt een grote tegel in een strook boven het raster. [Je favorieten](/info/favourites.html) behandelt de strook.
- <!--i:eyeoff--> **Verberg een tool die je nooit gebruikt.** Klik met rechts op een kaart, of selecteer er meerdere, en kies **Hide tool**. Hij valt uit het raster en uit wat typen in het raster vindt. Een grijze tegel **Show hidden tools (N)** aan het eind onthult ze weer, gedimd, elk met **Unhide tool** in zijn menu. Verbergen verandert alleen je raster: de tool opent nog steeds vanuit een link of bladwijzer.
- <!--i:clock--> **Jouw tools eerst.** Zodra je werk hebt opgeslagen in drie verschillende tools, begint een rij chips **Yours** boven het raster met je favorieten en recente tools.
- <!--i:sliders--> **Richt het in zoals jij wilt.** **View options** bepaalt de indeling (**Grid**, **Card** of **List**), kaartgrootte en dichtheid, de sortering en een categoriefilter.

![Het einde van het Tools-raster met onthulde verborgen tools: de gedimde kaart Wordmark, en ernaast de grijze tegel die hem weer in beeld bracht, nu met de tekst Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed the tile. The alt says so rather than quoting the resting
label the prose above already gives.
The recipe hides nothing itself. The lolly-demo catalog the captures pin
ships Wordmark hidden (`defaultHiddenTools` in its assets index.json), so a
fresh profile already has one hidden tool and the recipe only clicks the grey
reveal tile (`.gtile--hiddenbox`, confirmed in gallery.ts). It used to tick
the QR Code card and press the bulk bar's Hide button first; under lolly-demo
that published Wordmark dimmed and QR Code not, under a caption naming QR
Code, so the steps were dropped rather than relied on. QR Code was hidden
in that run too: the End scroll had left the pointer over its card, and a
hovered hidden card lifts its dimming (gallery.css), so it read as a normal
tool. The closing `hover:` puts the pointer back on the reveal tile, which
keeps every revealed card dimmed.
-->

**Handel meerdere kaarten tegelijk af.** Vink het selectievakje van elke kaart aan, sleep een selectiekader over lege ruimte of Shift/Cmd-klik, en er verschijnt een balk met wat die weergave toestaat:

- **Tools en Utilities:** Favourite, Hide, Available offline, **View sessions** (Projects, met alleen de sessies die met die tools zijn gemaakt) en Copy link voor één kaart.
- **Assets:** Favourite en Hide voor elke selectie. Duplicate, Download en Delete verschijnen alleen wanneer elk geselecteerd item een van je eigen uploads is, omdat een gedeelde asset van een design system een blijvend contract is.
- **Projects:** zie [Je werk vinden en terughalen](/info/find-your-work.html#find-something-you-saved).

![De selectiebalk van de galerij voor twee tools, met Available offline, View sessions, Favourite en Hide](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
<!--
SHOT NOTE (misc-bulkbar-gallery): drive targets `[data-select="qr-code"]` /
`[data-select="gradient"]` - the `.tile-check[data-select="<ref>"]` checkbox button
confirmed directly in views/gallery.ts's card markup (the same attribute
cardMarkup gives every tile), so these two clicks tick both cards without
opening either tool.

SHOT NOTE (misc-sessions-by-tool, NOT PUBLISHED): the "View sessions" result
had a recipe of its own (`/#/p?tools=qr-code,d3`, views/projects.ts's
toolsBodyHtml()), dropped here because it has no `drive=` that can
manufacture its own content - a saved session isn't a click away, it has to
already exist, and build-docs-shots.ts gives every shot a fresh
`browser.newContext()`. It would publish an empty list. Same dependency the
`projects` shot (now on find-your-work.md) carries; revisit if the pipeline gains a
storage-seeding hook.
-->

**View sessions** verschijnt pas wanneer iets is geselecteerd. Klik in plaats daarvan met rechts op één niet-geselecteerde kaart en die biedt **N saved sessions**, een lijst van de opgeslagen sessies van die tool waarbij verwijderen de sessie naar de Prullenbak verplaatst.

## Op een telefoon

Op een smal scherm wordt de indeling één kolom:

- De **bediening wordt een paneel** bovenaan met een sleepgreep op de onderrand. Sleep de greep om vast te klikken op **peek**, **half** of **full**, of tik erop om in en uit te klappen. Het voorbeeld vult de ruimte eronder en blijft in beeld terwijl je bewerkt.
- Een zwevende knop **Export** opent het exportpaneel: formaat, grootte, kopiëren, opslaan en downloaden op één plek. Tik op de achtergrond om het paneel te sluiten.

![Een tool op een schermbreedte van een telefoon - bedieningselementen als sheet bovenin, het gegenereerde palet dat de voorvertoning eronder vult en de renderpil die onderaan het midden zweeft](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Instellingen, geluid en comfort

**Settings**, onderaan het startscherm, bevat je gegevens, je design systems, toegankelijkheid, opslag en offline downloads. [Settings](/info/dashboard.html) brengt elk tabblad in kaart.

- **Je gegevens en pasfoto** vullen elke tool in die ze gebruikt, zoals een e-mailhandtekening of een badge. [Profielen](/info/profile.html) behandelt ze.
- **Toegankelijkheid** heeft vier comfortschakelaars: **Reduce motion**, **Hide colourful previews**, **High contrast** en **Large text**. Ze veranderen de app rond je werk, nooit een toolcanvas of een export.
- **Geluid** speelt zachte ondersteunende geluiden bij wat je doet, en **Neurospicy Mode** speelt een rustige focustrack. Beide staan uit totdat je ze aanzet, in **Settings → Accessibility** of het profielmenu.
- **Available offline** downloadt de rest van de app, je tools, de catalogus en de gidsen voordat je de verbinding verliest. Lolly is een webapp die je kunt installeren: gebruik de installatieknop van je browser, of *Zet op beginscherm* op een telefoon, voor een app op volledig scherm die zichzelf bijwerkt wanneer je weer online bent.
- **Storage** toont wat Lolly op dit apparaat bewaart. [Als je je browsergegevens wist](/info/find-your-work.html#if-you-clear-your-browser-data) legt uit wat wissen verwijdert, en het [Privacybeleid](/info/privacy.html) noemt alles wat de app ophaalt of verstuurt.

::: note Als een weergave na een update niet laadt
Een leeg paneel of een melding "failed to fetch" direct na een update verdwijnt meestal met één herlaadbeurt. Je opgeslagen werk, sessies en design systems blijven onaangeroerd, omdat ze op je apparaat staan. Alleen een afbeelding die je toevoegde en nooit opsloeg, moet mogelijk opnieuw worden toegevoegd.
:::

## Waar je hierna heen kunt

- **[Design: het vrije canvas](/info/design.html)**: het canvas, vormen, de tijdlijn en een deck presenteren.
- **[Batch en Multi-edit](/info/batch.html)**: veel versies van één ontwerp, of meerdere opgeslagen ontwerpen samen bewerken.
- **[Een bestand exporteren](/info/exporting.html)**: een formaat, grootte, drukeenheden, transparantie en video kiezen.
- **[Een ontwerp importeren](/info/design-import.html)**: breng een Figma-, Penpot-, Illustrator- of InDesign-bestand in Design en blijf bewerken.
- **[Sjablonen](/info/templates.html)**: opgeslagen startpunten voor een tool.
- **[Wide Colour en HDR](/info/hdr-editing.html)**: behoud de oorspronkelijke beeldprecisie in Design en Darkroom.
- **[Je werk vinden en terughalen](/info/find-your-work.html)**: waar alles staat, en hoe je het naar een ander apparaat verplaatst.
