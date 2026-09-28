# De Brand Studio

De **Brand Studio** op `#/start` is de ene plek waar je je merk vormgeeft - zijn logo's, kleuren, typografie, de rest van je tokens en de bestanden die het bewaart. Stel het hier eenmaal in en elke tool, pagina en export volgt het *door constructie*, niet door controle.

Wijzigingen tonen een **live preview in de hele app** terwijl je ze maakt, zodat je een kleur of een lettertype overal ziet landen voordat je hem vastlegt. Het gebeurt allemaal op het apparaat: je merkbestanden en tokens verlaten je machine nooit (het kiezen van een Google Font haalt die ene familie eenmaal op bij Google, na een toestemmingsdialoog), en het merk reist mee in één [brand pack](#move-a-brand-between-devices)-bestand.

> **Dit is de editor. Het dashboard is de spiegel.** Het tabblad **Design system** op het Dashboard (`#/d`) *toont* je merk alleen-lezen; je *bewerkt* het hier op `#/start`. Als je later een kleur wilt wijzigen, kom dan terug naar de Brand Studio.

## De kamers

De studio is een set **kamers**, opgesomd in een rail aan de zijkant - geen stappen. Niets is genummerd, niets is afhankelijk van iets anders en in elke kamer aankomen is legitiem:

- **Overview** - de hub. Wat er nu bestaat, in één oogopslag, met een deur naar elke kamer.
- **Colours** - voeg kleuren één voor één toe, ken rollen toe of genereer een heel palet uit één kleur.
- **Type** - de vier lettertypen die de app, je tools en elke export gebruiken.
- **Logo's** - je merktekens, in elke oriëntatie en behandeling.
- **Tokens** - hoekradius, spatiëring, schaduwen en de rest van het systeem.
- **Bestanden** - de beeld-, audio- en bewegingsbestanden die je merk bewaart.

Op een telefoon wordt dezelfde lijst een horizontale chipstrook vastgezet onder de header. Van kamer wisselen laadt nooit iets opnieuw - de editor houdt al zijn panelen gemonteerd en toont gewoon degene die je opvroeg.

**Deep-link een room** met `#/start?area=<key>`. De keys zijn `overview`, `color` *(let op de Amerikaanse spelling in de URL)*, `type`, `logos`, `tokens`, `catalogue` (de Files-room - de panelkey is een permanent contract, dus de URL houdt de oude naam aan) en `versions`. `?tab=` is het aloude alias voor hetzelfde en werkt nog steeds, dus oude links en bookmarks blijven functioneren; alles wat niet herkend wordt opent Overview in plaats van dood te lopen.

Vastgepind aan de **onderkant van de rail** staan de acties die bij het hele designsysteem horen in plaats van bij één room:

- **Add from…** - de bronkiezer, om een merk binnen te halen uit een bestand, een PDF, een afbeelding, een lettertype of een website. Zie [Een merk binnenhalen](#bring-a-brand-in) hieronder.
- **Tray** - de kandidaten die een scan heeft gevonden maar nog niet heeft vastgelegd. Blijft verborgen tot een scan daadwerkelijk iets bewaart, en toont dan een aantal; niets erin verandert je merk totdat je op die rij op Add drukt.
- **Export** - schrijft het hele designsysteem weg als één `LollyBrand-….lolly`.
- **Tokens (.json)** - het platte design-tokensdocument los, voor een repo, een buildstap of een andere tokenstool.
- **Restore brand settings** - ga terug naar een checkpoint dat is opgeslagen vóór een import of vervanging van merkinstellingen.
- **Versions** - publiceer, activeer en herstel benoemde kopieën van het designsysteem. Verborgen tot er iets van jezelf is om te publiceren (of een `?area=versions`-link er expliciet om vraagt).

![De studio room-rail - Overview, Colours, Type, Logos, Tokens en Files](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Overview

Overview is de eerste room, en die heeft twee gezichten.

Met **nog niets gekozen** zegt het **Make it yours**. **Start from a reference** opent de bronkiezer voor een logo, screenshot, webpagina of ontwerpbestand. **Pick a colour**, **Choose a face** en **Add a logo** openen direct hun bestaande bedieningselementen. Elke route begint met een keuze; er een openen schrijft niets weg. **Explore the tools** is meteen beschikbaar.

Zodra iets van jezelf is, toont dezelfde room **wat je hebt**, met de aantallen die je gemaakt hebt voorop. Colours leest het aantal kleuren dat het designsysteem draagt, en voegt een gedempte `· N starter` toe alleen waar er geërfde kleuren te zien zijn; de strook ernaast zet eerst de kleuren die je zelf koos, dan een dunne lijn en de vervaagde starter-kleuren. Type leest per rol (*Inter voor koppen*, met *Starter voor de rest · SUSE, SUSE Mono* eronder). Logos leest hoeveel slots gevuld zijn, of **Not set**. Tokens draagt de hoekradius, gelabeld *starter* tot je hem verplaatst. Files zegt **Nothing yet** zolang de bibliotheek leeg is. Elk blok is een deur naar zijn room. Er staan hier aantallen, nooit een voortgangsbalk en nooit een afrondingskaart - niets in deze studio is verschuldigd.

## Logos

Begin door je map met merktekens leeg te maken in de dropzone bovenaan: **"Drop marks here, or choose several at once"** accepteert net zoveel bestanden als je hebt, in één keer. Elk bestand wordt gelezen op vorm en inkt, en komt dan te wachten onder **Waiting for a slot** als een chip die zegt wat hij denkt - *"Looks like the Horizontal primary"*, met de meting waarop dat gebaseerd is, en een **Place**-knop (**Replace**, als die slot al gevuld is). Waar het onzeker is, zegt de chip dat gewoon en biedt in plaats daarvan **Change slot** aan, met alle acht opties. Niets wordt geplaatst totdat je ergens op drukt.

Rond die wachtrij gebeuren twee dingen. Een merkteken met overtollige lege marge krijgt eerst een **trim offer** - beantwoord die of druk op Escape en het originele bestand gaat ongewijzigd in. En waar een merkteken een lege buurslot kan vullen, biedt de room de afgeleide **mono**- of **reverse**-versie aan als eigen chip, gemarkeerd als *Generated*, die weer verdwijnt zodra je die slot op een andere manier vult.

Daaronder staat het raster waar elk merkteken in terechtkomt - **orientation × treatment**-slots:

- **Orientations:** Horizontal (woordmerk + symbool op een rij) en Vertical (gestapeld, voor vierkante en hoge ruimtes).
- **Treatments:** Primary, Primary reverse (voor donkere achtergronden), Mono (één kleur) en Mono reverse.

Dat zijn acht optionele slots. Klik op een slot om een PNG, SVG, JPEG of WebP toe te voegen; klik op een gevulde slot om die te vervangen. Elke slot is optioneel en alles blijft op dit apparaat.

![De logo-matrix - elke orientation bovenaan, elke treatment als eigen gestippelde slot, allemaal optioneel](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** - voeg merktekens toe die je merk op zijn eigen manier benoemt (een icoon, een wapen, een favicon) onder **Custom marks**; geef het een naam en kies een bestand.
- **More identities** - een submerk, product of evenement kan zijn eigen volledige set logo's hebben. Gebruik **+ Add another logo** en geef het een naam; je hoofdset heet gewoon "Your logo".
- **Upload an SVG and Lolly reads its colours.** Bij een gloednieuwe installatie stelt Lolly stilletjes je primaire kleur in vanuit het logo en meldt dat. Bij een bestaand merk biedt het de kleur juist als suggestie aan - *"Found in the logo: #…"* met een **Use as primary**-knop ernaast - in de Colours-room, waar je hem kunt overnemen of afwijzen.

## Colours

De room groeit met het designsysteem. Niets dat je nog niet nodig had, staat op de pagina, dus een eerste bezoek is één beslissing, en de rest komt naarmate het palet groeit.

### De eerste kleur

Een designsysteem zonder eigen kleuren opent op één gecentreerde kolom: **Start with one colour**, een grote live chip, een veld, en een rustige regel die zegt dat rollen, tinten en drukinstellingen komen naarmate het systeem groeit.

- **The chip is the picker.** Druk erop en de eigen OKLCH-kaart van de studio opent op de chip, geladen met wat het veld op dat moment bevat: een naam, het wiel, de vier regelaars, alfa en **Stored as**, met **Cancel** en **Add colour** onderaan. Een regelaar slepen kleurt de chip en herschrijft het veld terwijl je bezig bent, en niets bereikt het designsysteem tot je op **Add colour** drukt.
- **The field takes any notation** - `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` of een gewone kleurnaam - en een hele *lijst* kleuren wordt een rij chips die je één voor één toevoegt.
- **Two more doors sit beside it.** Het pipet (op een browser die er een heeft) haalt een kleur van het scherm, en **From an image** leest een screenshot of foto op dit apparaat en biedt de kleuren aan die het vindt.
- **Add is never disabled.** Zonder iets leesbaars in het veld opent het de kiezer, wat meestal is wat een lege druk betekent; tekst die het niet kan interpreteren krijgt een regel onder het veld die dat meldt, in plaats van een dode knop.

De eerste kleur wordt de **primaire**, en de chip die op de toevoeging reageert, meldt dat - *"Primary is now Vivid Violet"* - met **Fine-tune** ernaast.

![De Colours-room zonder iets gekozen - één grote live chip, één veld en één regel over wat later komt](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Starter

**Starter** is het woord voor alles wat met de app is meegekomen in plaats van gekozen te zijn. Een verse installatie draagt helemaal geen kleur: wat hij heeft, is één neutrale ramp, inkt op papier, zodat oppervlakken, tekst en haarlijnen renderen voordat iemand iets heeft beslist. Die neutrale tinten zijn steigerwerk, dus ze tellen niet mee als kleuren en worden niet getekend in het paletvlak. Ze wonen in de room [Tokens](#tokens) als **Neutrals · starter · 9**, met een **Open** die ze in het Colours-vlak toont als één ingeklapte, gelabelde groep (`#/start?area=color&group=neutral`).

Hetzelfde woord loopt door elke room heen: een rol die op een starter-kleur staat, leest *"Starter Paper stands in"* en zijn kiezer biedt **Choose…**; een starter-lettertype draagt een **Starter**-label en geen kleuring; een starter-hoekradius wordt gelabeld op de Overview. Geërfd materiaal wordt hier nooit met een gestippelde rand getekend, omdat een gestippelde rand hier een droptarget betekent.

### Naarmate het palet groeit

Je kleuren blijven naast een **In context**-voorvertoning op een breed scherm en stapelen erboven op kleinere schermen. De voorvertoning kan een poster, grafiek of interfacekaart tonen met je palet. Starter-kleuren blijven in hun eigen inklapbare groep, gescheiden van de kleuren die je toevoegt.

Voeg individuele kleuren of een set tinten toe, ken hun rollen toe, en open de geavanceerde secties wanneer je ze nodig hebt. De kleurenkaart, de verlopen en de downloadbediening blijven bij het palet.

![De Colours-room na het toevoegen van één kleur, met zijn palet en een live compositievoorvertoning](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Roles - wat tools lezen

**Roles** is de laag erbovenop - welke kleur welke rol speelt. Roles zijn optioneel (een designsysteem van drie losse kleuren zonder roles is prima), elk swatch kan er een krijgen, en de contrastuitlezing wordt gemeten tegen het oppervlak, APCA eerst.

Een rij leest in een van drie registers, zodat de strook nooit een beslissing claimt die niemand heeft genomen:

- een eigen kleur die de rol vervult, op volle sterkte;
- **Starter *Paper* stands in** - gedempt, met **Choose…** op zijn kiezer;
- **↳ volgt Primair** - de rol lost op via de primaire kleur in plaats van via een eigen kleur.

Zodra het palet tinten heeft, groeit de strook naar alle zeven slots die een tool kan lezen: Primary, Secondary, Surface, Text, Muted, Edge en On primary. On primary is afgeleid van de primaire kleur, leest als **Derived** en heeft geen kiezer.

**Het eigen accent van de app is een voorkeur, geen token.** Standaard volgt de interface het designsysteem en neemt het chrome-accent de primaire kleur over. Dat is een Appearance-instelling op [je profiel](/info/profile.html) - **Interface volgt het ontwerpsysteem** - en hem uitzetten laat het chrome neutraal. Tools, canvassen en exports worden in beide gevallen niet beïnvloed, en de lettertypen en de hoekradius volgen het designsysteem, of de instelling nu aan of uit staat.

### De expertvleugels

Vier ingeklapte secties staan onder de compositievoorvertoning en de kleurrollen. Open degene die je wilt; elk is deep-linkbaar als `#/start?area=color&focus=<wing>`, wat het opent ongeacht wat de room verder toont.

- **Explore shades & harmonies** (`focus=generate`) - één kleur naar een volledige set tinten. Hieronder beschreven.
- **Shade curves** (`focus=curves`) - herschap een ramp punt voor punt. Lightness, chroma en hue krijgen elk hun eigen curve, geschakeld met L / C / H, en de tinten eronder worden live opnieuw gebakken terwijl je sleept.
- **Contrast** (`focus=contrast`) - **Contrast-lock** hertoont een ramp om APCA-doelen te halen tegen een achtergrond die je kiest, waarbij elke stap zijn eigen hue en chroma behoudt; **Rotate hue** draait de hele ramp als geheel rond het wiel, waarbij elke tint zijn lightness en chroma behoudt.
- **Print** (`focus=print`) - wat de primaire kleur wordt op de drukpers: de automatische schermwaarde, of een vastgepinde CMYK-opbouw of juist een benoemde steunkleur.

### Eén kleur, een heel palet

Kies binnen **Explore shades & harmonies** een **Starting colour**. Lolly stelt bijpassende tinten voor met dezelfde perceptuele kleurwiskunde (OKLCH) die de engine overal gebruikt. Stem de suggesties af:

- **Scheme** - Mono, Complement, Analogous of Triad - bepaalt hoe de secundaire kleur zich verhoudt tot de primaire kleur.
- **Shades** - een schuifregelaar van 3 tot 20 (standaard 5) bepaalt hoeveel stappen elke ramp genereert.
- **Fine-tune** (ingeklapt) - **UI intensity** (Muted / Deep), **Contrast** (Comfort / High) en **Text on brand** (Auto / Light / Dark).

De startkleur en de bedieningselementen wijzigen verandert alleen de suggesties. Klik op een tint om die kleur toe te voegen, of op **Add 5 shades** om een groep toe te voegen (het aantal volgt je Shades-instelling). Bestaande kleuren en rollen blijven op hun plek. Undo verwijdert de toevoeging.

De rijen **Primary**, **Neutral** en **Secondary** tonen de voorgestelde tinten. Open **Theme preview** om lichte en donkere voorbeelden en hun contrastuitlezingen te inspecteren. Kies daar een Neutral- of Secondary-stap om de voorgestelde thema-ankers aan te passen. Het hele palet herbouwen blijft een aparte, beoordeelde actie hieronder.

![Drie voorgestelde tintgroepen, met individuele toevoegknoppen en een aparte Theme preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Bouw het palet (harmoniegenerator)

Bij **Find matching colours** stelt de harmoniegenerator bijpassende accentkleuren voor op basis van de primaire kleur. Kies een **Harmony** - **Complementary**, **Adjacent**, **Triad**, **Tetrad** of **Analogous** (die zijn eigen **Accents**-aantal meebrengt, 2 tot 5, en een hue-**Angle** van 10° tot 45°) - en elke kandidaat komt met een automatisch gegenereerde, leesbare naam en een **+ Add**-knop. Eentje toevoegen zet die kleur meteen in het palet, één druk op de knop voor één token. **In context** toont je toegevoegde kleuren in voorvertoning op voorbeeldcomposities.

![Gegenereerde accenten, elk met een swatch, een automatisch gegenereerde naam, zijn hexwaarde en een Add-knop](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Een gegenereerd palet doorvoeren

Een voorgestelde kleur of tintgroep toevoegen behoudt de rest van je palet. Open voor een volledige vervanging **Rebuild the whole palette…** en druk op **Preview full rebuild**. De review legt de wijzigingen uit: hoeveel rollen blijven zoals jij ze toegewezen hebt, hoeveel kleuren die je zelf toevoegde behouden blijven, hoeveel shade curves opnieuw verankerd worden, hoeveel print locks opnieuw vastgepind worden, hoeveel verborgen tinten verborgen blijven, hoeveel gradient stops hun kleur behouden.

**Apply rebuilt palette** op die kaart voert het door; **Cancel** stapt weg en verandert niets. Zodra het is uitgevoerd, biedt de kaart **Undo** aan, al gefocust - en er wordt een checkpoint van het hele designsysteem gemaakt *voordat* de wissel plaatsvindt, zodat "zet het terug zoals het was" een herstel is in plaats van een verloren middag.

### Het palet, de chart en elke swatch

Het palet toont de kleuren van het designsysteem in inklapbare groepen, elk met een eigen **+ Add**-bediening. Maak en hernoem groepen om je werk te organiseren. Een rol maakt nooit een tweede tile: één token is één tile, en een tile waar een rol naar wijst, draagt in plaats daarvan een klein hoekmerkje (**P**, **S**, **Su**, **T**). Onder de tiles klapt **Colour chart** open naar twee weergaven van dezelfde swatches: de **Wheel** (het OKLCH-wiel - sleep een punt om hem te herkleuren, klik op een punt om hem te bewerken of klik op lege ruimte om een nieuwe swatch neer te zetten) en de **Gamut**-chart, die laat zien waar het weergeefbare bereik daadwerkelijk eindigt. `#/start?area=color&focus=chart` opent de kaart direct, net als `?wheel` altijd al deed.

![Het paletvlak, elke groep inklapbaar, met de downloadpil onderaan geparkeerd](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Het OKLCH-wiel - hoek is tint, afstand naar buiten is verzadiging en de grijstinten lopen langs een helderheidsrail aan de zijkant](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Klik op een kleurstaal om de editor ervan te openen:

- **Naam wijzigen**.
- **Stel de kleur in** - de kiezer opent met perceptuele **OKLCH**-schuifregelaars, met modi voor **Hex**, **HSL**, **RGB** en **CMYK**; het waardeveld leest *en* schrijft in welke ruimte dan ook actief is, dus je kunt een hexwaarde plakken of inktpercentages typen. Let op: het invoeren van CMYK stelt de *scherm*kleur in door conversie - om exacte inkten vast te pinnen, gebruik de afdrukvergrendeling hieronder.
- **Opgeslagen als** - kies hoe de kleurstaal wordt bewaard: **LCH** (de standaard - perceptueel, breed kleurbereik, de beste keuze om te bewerken), Hex, RGB of HSL. Overschrijf dit wanneer je een exacte legacy-hexwaarde wilt vastpinnen of een sRGB-waarde wilt matchen.
- **Gebruiken als** - geef deze kleurstaal rechtstreeks een van de merkrollen, zonder terug te gaan naar het Rollen-paneel. (De eigen tegel van een rol biedt dit niet aan - een rol kan geen rol overnemen.)
- **Afdruksubstituten** (samengevouwen) - vergrendel het afdrukgedrag van de kleur:
  - **CMYK** - zet dit van **Automatisch** naar **Vergrendeld** om de automatische sRGB-naar-CMYK-conversie te overschrijven met exacte inktwaarden (C/M/Y/K, 0-100).
  - **Steunkleur** - zet dit van **Geen** naar **Ingesteld** om de kleurstaal aan een steunkleur te vergrendelen; geef het een **Naam** (bijv. `PANTONE 186 C`), een optioneel **Boek** en een optionele **Afwerking** (Gewone inkt standaard) voor wanneer de inkt helemaal geen inkt is - een folie, een reliëf- of debosdruk, een spotlak, een soft touch of een snij-, vouw- of perforatielijn.
- **In andere ruimtes** (samengevouwen) - hetzelfde idee, breder toegepast: elke rij is een ruimte waarin deze kleurstaal kan worden uitgedrukt, ofwel afgeleid van de canonieke waarde ofwel door jou opgegeven, en een opgegeven waarde wint bij export.

Deze afdrukvergrendelingen zijn wat een drukpers gebruikt wanneer je een CMYK-PDF of TIFF exporteert - zie [Exporteren](/info/exporting.html#colour-profiles).

**Een kleurstaal verwijderen** is veilig: afgeleide verloopstappen en themarollen worden *verborgen* (de onderliggende token blijft resolveren, dus er breekt niets stroomafwaarts), terwijl kleuren die je zelf hebt toegevoegd volledig worden verwijderd.

### Werken met veel kleurstalen

Elke kleurstaal heeft een eigen sleepgreep. Sleep hem om kleuren binnen zijn groep te herordenen, of geef hem focus, druk op Spatie, gebruik de pijltjestoetsen, en druk nogmaals op Spatie om neer te zetten. Escape annuleert. De volgorde overleeft het opnieuw openen van de studio en kan ongedaan worden gemaakt. Gebruik om kleuren tussen groepen te verplaatsen de **Group**-bediening van de kleurstaal-editor, of selecteer meerdere kleuren en gebruik **Move**. Tokennamen en rolverwijzingen blijven intact.

Selectie in het paletvlak is een gebaar, geen modus. Er is geen knop om eerst in te drukken, en de balk verschijnt bij de eerste geselecteerde tile en verdwijnt bij de laatste.

- **Drag on the pane's empty space** om een rechthoek te tekenen: elke tile die hij raakt, komt bij de selectie, over groepsgrenzen heen. Een ingeklapte sectie draagt niets bij, en een sleepbeweging die nooit beweegt, wist de selectie.
- **Shift-click** neemt het bereik in leesvolgorde; **Cmd/Ctrl-click** schakelt één tile; een gewone klik opent nog steeds de editor van die tile.
- Elke groepskop draagt **Select all**, en **Cmd-A** met een tile in focus neemt elke kleur die het designsysteem bezit - nooit een starter-kleur.
- Het raster heeft één tabstop. Pijltjes lopen erdoorheen, Shift-pijltjes breiden de selectie uit, Spatie schakelt een tile, Delete verwijdert de selectie en Escape wist hem. (Pijltjes verplaatsen alleen de focus: om een kanaal bij te stellen, druk je eerst op `l`, `c` of `h`, zoals de uitlezing aangeeft.)
- Op een touchscreen is er geen rechthoek. Houd een tile ingedrukt om een selectie te starten, tik dan om toe te voegen; **Select all** per groep draagt de rest.

De balk zelf toont **{n} selected**, dan **Move to** (een bestaande groep, of een nieuwe die je in het menu benoemt), **Give a role** (elke geselecteerde kleur neemt om beurten de volgende rol aan, zodat vier tiles alle vier de rollen in één druk vullen), **Download** (de selectie in elk van de zes paletformaten), **Copy values** (één regel per kleur in zijn opgeslagen notatie) en **Delete**. Move to en Give a role verschijnen zodra het palet tinten heeft om te verplaatsen. Eén Ctrl/Cmd-Z maakt een hele bulkactie ongedaan - een verplaatsing van veertig, een rolronde, een verwijdering - en een verwijdering zegt wat hij heeft bewaard, omdat een selectie tiles bereikt die deze room niet verwijdert.

### Verlopen

Een optioneel **Gradients**-paneel bouwt mengtokens uit het palet voor achtergronden en accenten. Sla het volledig over als het designsysteem geen verlopen gebruikt. Elk verloop heeft een voorvertoning, benoemde stops (2-8) en een hoek. Het belangrijkste gedrag: **een stop verwijst naar een kleurstaal**, dus geef die kleurstaal een nieuwe kleur en het verloop volgt mee. Interpolatie gebeurt in OKLCH voor schone overgangen. Verwijder een stop om de reeks in te korten.

### Neem het palet mee

De zwevende pil onderaan het paletvenster downloadt het hele palet als **Design tokens (JSON)**, **CSS variables**, **CSS classes**, **SCSS variables**, een **GIMP palette (.gpl)** of een **Adobe Swatch Exchange (.ase)** - zodat het designsysteem direct in Illustrator, Figma, GIMP of een stylesheet terechtkomt. Hij staat buiten de scroller van het venster, dus hij houdt zijn plek hoe ver het palet ook scrollt, en hij verschijnt zodra het palet tinten heeft. (Je kunt het palet ook downloaden vanuit [Assets](/info/using.html#assets-your-library).)

## Typografie

Deze room groeit op dezelfde manier. Zonder eigen lettertype is het één kaart en één beslissing: **Primary**, gezet op leesgrootte in het lettertype dat het vandaag bedient, een **Starter**-label naast de naam, een gevulde **Choose a face** en de regel "Nothing installs until you choose one." Onder de kaart staat "Headings, code and italic follow the primary until you choose them", met **Choose them separately** die de andere drie kaarten onthult voor de rest van het bezoek.

![De Type-room zonder gekozen lettertype - één kaart op leesgrootte, een Starter-label erop, en één gevulde Choose a face](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Kies één lettertype en de room ontvouwt zich in **vier rolkaarten**, de Fonts-lijst en het live specimen. De vier lettertypen zijn degene die de app, je tools en elke export daadwerkelijk gebruiken:

- **Primair** - hoofdtekst, knoppen en elke tool.
- **Koppen** - het weergavelettertype voor `h1`/`h2`.
- **Code** - een niet-proportioneel lettertype voor code en gegevens.
- **Cursief** - een echte cursieve begeleider voor nadruk, citaten en terzijdes.

Koppen, code en cursief vallen elk terug op de primaire tot je ze toewijst, dus een merk met één lettertype hoeft hier helemaal geen keuzes te maken.

**Een kleuring betekent dat je hem gekozen hebt.** Een kaart wordt alleen gekleurd waar je dat lettertype hebt geïnstalleerd. Een starter-lettertype draagt hetzelfde **Starter**-label als de geërfde groepen van het palet, in het gedempte register en zonder kleuring, en een rol die niemand heeft gekozen, leest **↳ volgt Primair** in plaats van de naam van de primaire te herhalen alsof die was gekozen. De knop zegt **Change** op een eigen lettertype en **Choose a face** overal elders. Niets op een kaart legt iets vast: de knop opent het **vergelijkingsscherm** afgestemd op die rol.

![De vier rolkaarten onthuld - elk gezet in het lettertype dat het bedient, met een Starter-label waar niemand er een koos en Italic dat de primaire volgt](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Het vergelijkingsscherm

![Het vergelijkingsscherm open onder zijn kaart, met de zoekregel, de vastgepinde families en de kaarten ingeklapt tot een strook van één regel](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

Het scherm opent **inline in the room**, niet in een dialoogvenster, en direct onder de kaart die je indrukte. Terwijl het open staat, klappen de kaarten in tot een strook van één regel met rol en lettertype, zodat het scherm zelfs op een telefoon op het eerste scherm staat. Escape annuleert en geeft het toetsenbord terug aan de kaart van waaruit je het opende.

Een lettertype kiezen is drie drukken:

1. **Choose a face** op de kaart.
2. Typ een familienaam en druk op **Preview** - of druk op een van de zes **Pinned**-families onder het veld, één druk elk. De kaart verschijnt al ladend, met een skeletbalk waar het specimen komt te staan, in plaats van het interface-lettertype dat een lettertype vervangt dat je nog niet hebt gezien.
3. **Use this face**.

**Om toestemming wordt één keer gevraagd, bij de druk die je gaf.** De eerste keer dat een voorvertoning Google Fonts bereikt, zegt een dialoog wat er gebeurt: *Google leert de familienaam en je IP-adres. Het bestand blijft daarna op dit apparaat en wordt offline gebruikt. Dit is de enige stap in de studio die een derde partij bereikt.* **Fetch from Google** gaat door en wordt onthouden. **Cancel** laat de kaart zeggen "Not fetched. Nothing was sent to Google." met zijn eigen live **Fetch from Google**, zodat van gedachten veranderen één druk op de kaart zelf is. Geen enkele kaart toont ooit een dode knop: in welke staat hij ook is, zijn ene primaire knop zegt wat de volgende stap is.

**Sleep een lettertypebestand op het podium** en het wordt meteen in voorvertoning getoond - **TTF**, **OTF** of **WOFF** vanaf je eigen machine, wat het pad is voor een gelicentieerd bedrijfslettertype dat je al bezit. Die dropzone is de enige bestandsdeur in de room.

Hoe dan ook blijft het lettertype op dit apparaat, rendert het in de app, in de tools en in elke export, voor altijd offline, en reist het mee in het designsysteembestand - er wordt niets opgehaald tijdens het renderen. Alles op Google Fonts wordt geleverd onder een open licentie (OFL/Apache/UFL).

### Fonts op dit apparaat

Het paneel **Fonts** toont elk lettertype dat dit apparaat bevat en de rol die het vervult. Lettertypen die je toevoegde, staan voorop onder **In the design system**, elk met zijn rollen en een verwijderoptie, en degene die Primary bedient, draagt het label. De starter-lettertypen volgen daarna in één ingeklapte rij - *Starter · SUSE, SUSE Mono · serving Primary and Code until you choose* - gedempt, zonder verwijderoptie en niets om te promoveren, omdat geen van beide een beslissing is die iemand heeft genomen. **Add a face** opent hetzelfde vergelijkingsscherm, niet afgestemd op een rol.

Het paneel **Type roles** onderaan toont een live specimen van elke rol - hoofdtekst en UI in de primaire, een optioneel weergavelettertype voor de bovenste koppen, een cursief voor nadruk, een niet-proportioneel lettertype voor code en gegevens - met de familie en zijn status naast elk (*Inter*, *SUSE · starter*, *SUSE · follows Primary*), zodat de hele set in één keer te lezen is.

## Tokens

De rest van het ontwerpsysteem, te bewerken zonder code aan te raken:

![De Tokens-ruimte - een hoekstraal-schuifregelaar plus tussenruimte, formaat, schaduwen en de rest van het systeem](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Rounded corners** - één straalschuifregelaar (0-1,5rem) die kaarten, knoppen en panelen door de hele app volgen.
- **Neutrals** - de ramp inkt-op-papier waarmee een verse installatie wordt geleverd, vermeld als **Neutrals · starter · 9** met zijn negen stappen en een **Open** naar het Colours-vlak. Het is de enige plek waar de starter-neutrale tinten worden beheerd, en het label *starter* verdwijnt op het moment dat de ramp wordt gegenereerd in plaats van geërfd.
- **More tokens** - voeg **spacing**, **sizing**, **stroke width**, **opacity**, **rotation**, gewone **numbers** en **shadows** toe en bewerk ze. Kies een type, geef het een naam (*Gutter, Card shadow…*) en stel de waarde in. Deze worden opgeslagen als standaard [design tokens](/info/design-tokens.html) (DTCG) en reizen mee met het designsysteem.

## Bestanden

Zet hier de bestanden neer die je merk bijhoudt - logo's daargelaten: **vector**-, **image**-, **audio**- en **motion**-assets (video, Lottie, geanimeerd). Ze komen terecht in [Assets](/info/using.html#assets-your-library), gesorteerd in secties en beschikbaar in de assetkiezer van elke tool. Alles blijft op dit apparaat. (De rail noemt de room **Files**; de URL-sleutel blijft `catalogue`, omdat een paneelsleutel een permanent contract is.)

## Een merk binnenhalen

**Toevoegen vanuit...** onderaan de zijbalk opent een kiezer in twee fasen. De eerste fase vraagt wat je *hebt*, niet welk formaat het is:

- **Design tokens or a design file** - DTCG- of Tokens Studio-JSON, een Penpot-project, een **zip met tokensets**, een Lolly-designsysteempakket of een SVG.
- **PDF** - een presentatie of een richtlijnenbestand, op dit apparaat gelezen voor de kleuren, de merktekens en de ingesloten lettertypen.
- **Logo or screenshot** - een afbeelding wordt een voorgestelde palet, gelezen op dit apparaat. Er wordt niets geüpload. Dit leest kleuren, niet het lettertype of de lay-out in de afbeelding.
- **Saved web page** - kies één HTML-bestand en de bijbehorende CSS-bestanden, of plak HTML of CSS. Tot 20 bestanden en 2 MB in totaal. Alleen de aangeleverde tekst wordt gelezen; gekoppelde bronnen worden niet opgehaald en scripts worden niet uitgevoerd. Dit pad werkt ook zonder de extensie of desktop-app.
- **Font file** - TTF, OTF of WOFF. Opent de Type-room, waar het lettertype wordt geïnstalleerd.
- **Website** - één pagina, gelezen voor de kleuren en het lettertype. Deze tegel verschijnt alleen op een apparaat dat daadwerkelijk een pagina kan lezen, omdat een uitgeschakelde tegel die iets adverteert wat niemand kan aanklikken, erger is dan geen tegel. Waar hij wel verschijnt, zegt hij duidelijk welke lezer wordt gebruikt: opgehaald door de app op dit apparaat, of gelezen via de browserextensie in een achtergrondtabblad, ingelogd als jij. Het invullen van een URL vult het veld alleen *vooraf in* - de ophaalknop is de toestemming, dus een link die iemand je stuurt, kan nooit zelf een leesactie starten.

Kies de bron ontwerpbestand en de tweede fase is de kaart hieronder: de geaccepteerde formaten staan voorop als pictogramtegels in voorkeursvolgorde, en de hele kaart is één droptarget - klik ergens op de kaart of sleep een bestand erop. Je kunt ook een bestand direct op de studio neerzetten.

![De importkaart - de geaccepteerde formaten staan voorop als pictogramtegels, en de hele kaart is één droptarget](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

Wat elk ontwerpbestand je oplevert:

- een **Lolly-designsysteempakket** (`.lolly`; het oude `.zip` wordt nog steeds geaccepteerd) - installeert in één stap;
- een **Penpot**-export (`.penpot`) - haalt de design tokens ervan binnen;
- een **Design Tokens**-bestand (`.json`) - W3C DTCG;
- een **Tokens Studio**-bestand (`.json`) - Tokens Studio;
- een **gewone SVG** (`.svg`) - Lolly scant de kleuren erin en laat je kiezen welke je wilt behouden, waarbij de eerste je primaire kleur wordt.

Een logo/screenshot, website of opgeslagen pagina opent **Your suggested design system**. Bekijk een voorbeeld met de voorgestelde kleuren, kies indien nodig een andere **Main colour**, en geef het systeem een naam. **Use this design system** past de gegenereerde lichte en donkere paletten toe en keert terug naar Overview. Bestaande lettertypen blijven op hun plek. Dit vervangt de kleuren van het actieve systeem en andere tokeninstellingen. Een checkpoint moet eerst slagen; **Restore brand settings** herstelt de vorige instellingen.

**Source details and individual choices** toont wat er is gelezen, de gedetecteerde lettertypenamen en het tekst-/actiecontrast van de voorvertoning. Het biedt ook **Choose individual items in the tray** en **Download design context** aan. Het JSON-rapport draagt observaties, voorgestelde tokens en broninformatie; opgeslagen HTML/CSS bevat een SHA-256 van de aangeleverde tekst. Het bevat geen ruwe paginatekst en is geen ondertekende Content Credential. Lettertypenamen zijn suggesties: Type blijft de plek om lettertypen te kiezen en te installeren.

PDF- en andere ontwerpbestandsimporten behouden hun bestaande reviewbediening. Items die in de **Tray** worden bewaard, veranderen niets tot ze worden toegevoegd via de room die dat soort materiaal beheert.

`#/start?source=<kind>` opent de kiezer op een gegeven bron (`file`, `pdf`, `image`, `font`, `url`, `page`), en `?import` opent hem op de gewone lijst.

## Een merk tussen apparaten verplaatsen

**Export** onderaan de rail schrijft één enkele **`LollyBrand-….lolly`** - je tokens, lettertypen, logo's en themavoorkeur, met een integriteitsmanifest dat bij het terughalen wordt geverifieerd. Webversies vóór 1.0.7 noemden dezelfde lading `.zip`; die oude schrijfwijze wordt nog steeds geaccepteerd. Ernaast schrijft **Tokens (.json)** het gewone design-tokensdocument apart: geen lettertypen, geen logo's, alleen de tokens, wat is wat een repo, een CI-stap of een andere tokentool daadwerkelijk leest.

Er een terugbrengen doe je via **Toevoegen vanuit... → Design tokens of een ontwerpbestand** (hierboven), of door er een naar de studio te slepen. Zo geeft een collega je een merk, of breng je er een over naar een tweede installatie - geen account, geen cloud. Om een merk vanaf de command line binnen te halen, zie [`ingest:brand`](/info/configuration.html#brand-packs).

## Herstel eerdere instellingen

Kies **Restore brand settings** onderaan de rail, selecteer een gedateerd checkpoint, en druk dan op **Restore**. Dit herstelt kleuren, typografie-instellingen en andere merktokens voor het actieve merk. Lettertype- en afbeeldingsbestanden blijven zoals ze zijn.

Lolly slaat je huidige instellingen op als **Before restore** voordat het checkpoint wordt toegepast. Kies dat checkpoint om het herstel terug te draaien, ook na het sluiten en heropenen van de browser. De laatste 20 checkpoints worden op dit apparaat bewaard. Als de opslag niet gelezen kan worden of de huidige instellingen niet opgeslagen kunnen worden, meldt de dialoog het probleem zodat je het opnieuw kunt proberen.

## Versies

**Versions** onderaan de rail is waar een designsysteem stopt een bewegend doel te zijn. Publiceer er een en je krijgt een **permanente, benoemde kopie** die op dit apparaat wordt bewaard: die verandert daarna nooit meer, dus een tool die eraan vastpint blijft hetzelfde tekenen. Het paneel blijft verborgen totdat er iets van jezelf te publiceren valt, dus een studio die nooit publiceert, ziet de bediening nooit.

Drie dingen om te weten voordat je ergens op drukt, en het paneel noemt alle drie voor het drukken in plaats van erna:

- **Een versie is permanent.** Er is nog geen verwijderoptie, dus het paneel vermeldt wat er is bewaard en dat het bewaard blijft, in plaats van een knop aan te bieden die liegt.
- **Verwijderingen staan bovenaan de compatibiliteitskaart.** Toegevoegde en gewijzigde tokens zijn nieuws; een *verwijderd* token is wat een tool breekt, dus dat wordt als eerste genoemd en bij naam genoemd.
- **Publiceren kan niet ongedaan worden gemaakt; herstellen wel.** *Restore latest from this version* is een gewone bewerking op de head, dus die komt op de undo-stack van de studio terecht en het paneel biedt je meteen **Undo** aan.

Je kunt **Alleen publiceren**, of **Publiceren en actief maken** - het verschil is of tools en de app vanaf nu die versie volgen of je laatste bewerking blijven volgen. **Weer de nieuwste volgen** zet elke bewerking live zodra hij gemaakt is. `#/start?area=versions` opent het paneel direct.

## Wanneer het merk vast staat

Sommige builds leveren een **vergrendeld designsysteem**, zoals de SUSE Brand. Het openen ervan toont een alleen-lezen notitie met **Make an editable copy** en **Switch**. De oorspronkelijke kleuren, lettertypen en tokens ervan blijven intact. Je eigen lokale systemen blijven bewerkbaar, zelfs wanneer het vergrendelde systeem het eerste op het apparaat was. In Profile selecteert **Open** een systeem en opent zijn studio; **Make a new one** maakt een lokaal systeem aan en opent het op `#/start` met het naamveld in focus.

## Waar je hierna heen kunt

- **[Lolly gebruiken](/info/using.html)** - het canvas, opslaan, projecten en Assets.
- **[Design Tokens](/info/design-tokens.html)** - het tokenmodel waarin je merk wordt uitgedrukt.
- **[Exporteren & formaten](/info/exporting.html)** - druk-eenheden, CMYK en de formaten waarin je merk gerenderd wordt.


## Zoek en vergelijk een look

Open **Find a look** vanuit Overview of de lijst met designsystemen op Profile. Blader door systemen die op dit apparaat zijn opgeslagen en een paar herbruikbare Lolly-voorbeelden. Zoek op naam, kleurlabel of opgegeven lettertype. **Closest to my current palette** sorteert op gemeten kleurgelijkenis, waarbij bijpassende lettertypefamilies de doorslag geven; het is geen kwaliteitsscore.

Selecteer één look om te bekijken, of twee om te vergelijken. De bekijkknop blijft beschikbaar op een klein scherm. Een look selecteren verandert niets. **Use this saved system** schakelt door het bestaande register van designsystemen. **Use these colours** past een voorbeeld toe via de normale checkpoint- en installatieflow, met behoud van de huidige lettertypen. **Restore brand settings** kan de vorige look herstellen.

Onder **Details and design context** hebben opgeslagen systemen bewerkbare **Search tags** en een contextdownload. Voorbeelden gebruiken originele Lolly-kleurrecepten; er is geen op afstand gescrapete inspiratiecollectie of verplicht account.

![Vergelijk Sunroom en Orchard naast elkaar voordat je een van beide kleursystemen toepast.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

De vergelijking houdt beide paletten samen zichtbaar. Een look bekijken verandert niets tot je **Use these colours** of **Use this saved system** kiest.

## Lees het bronbewijs

De optionele details van de bronreview tonen typografie, tussenruimtes, opvulling en hoekwaarden waar geobserveerd. Opgeslagen HTML/CSS en native website-leesacties rapporteren declaraties, die mogelijk niet door de gerenderde pagina worden gebruikt. De browserextensie kan gemeten stijlen rapporteren uit een beperkte steekproef van zichtbare elementen, met zijn viewport en browserkleurvoorkeur. Oudere extensies werken nog met gedeclareerde stijlen. Ontbrekende velden zeggen **Not observed**.

Dit zijn observaties, geen automatische stijlinstellingen. Lettertypebestanden worden niet opgehaald of geïnstalleerd door een referentiescan, en broninstellingen voor tussenruimte vervangen niet stilzwijgend de jouwe. Aantallen beschrijven voorkomens in de steekproef, niet vertrouwen of kwaliteit.

## Controleer een compositie tegen het designsysteem

Open in Design **Export**, dan **Before you export**. De controle gebruikt dezelfde effectieve designsysteemversie als de render. Ze vergelijkt geautoreerde kleuren, tokenaliassen, lettertypekeuzes en asset-ID's van afbeeldingen. Aangepaste waarden kunnen bedoeld zijn; een afbeelding buiten de gedeclareerde merkassets is een reviewpunt, geen verboden afbeelding.

Waar een concrete kleur- of lettertypesuggestie beschikbaar is, wijzigt de knop ervan alleen die ene laag. De normale **Undo** herstelt de oorspronkelijke waarde. Vergrendelde of gewijzigde lagen worden niet overschreven door een oude suggestie. Ontbrekend bronbewijs blijft gescheiden van een match. Gerenderd contrast en tekstlay-out worden gecontroleerd door de bestaande ingebouwde controles. Verlopen, effecten, geneste toolinhoud, rechten en subjectieve kwaliteit worden niet beoordeeld door de merkvergelijking. Controles blokkeren Download niet.

## Gebruik designcontext lokaal

**Download design context** omvat het tokendocument, opgeloste kleuren, opgegeven lettertypefamilies, asset-ID's, bronbewijs waar geregistreerd, dekking en expliciete regels. Het omvat geen lettertypebestanden of eigendomsbewijs. De referentiereview omvat ook zijn voorgestelde tokens en observaties.

De CLI kan elk van beide downloads zonder server lezen:

```bash
lolly system import ./lolly-design-context.json
lolly system context --output=design-context.json
lolly system check ./design-inputs.json --file=design-context.json
```

`system check` accepteert Design-invoer met een `boxes`-array of een gecompileerd Design-document. Het rapporteert voorgestelde correcties zonder de compositie te wijzigen. Het kan geen browserlay-out of gerenderd contrast meten. De bestaande MCP-bron **lolly://design-context** ontsluit de context van het effectieve systeem via het geconfigureerde lokale MCP-proces; geen nieuwe gehoste dienst of API-sleutel nodig.
