# De Brand Studio

De **Brand Studio** op `#/start` is de ene plek waar je je merk vormgeeft - zijn logo's, kleuren, typografie, de rest van je tokens en de bestanden die het bewaart. Stel het hier eenmaal in en elke tool, pagina en export volgt het *door constructie*, niet door controle.

Wijzigingen tonen een **live preview in de hele app** terwijl je ze maakt, zodat je een kleur of een lettertype overal ziet landen voordat je hem vastlegt. Het gebeurt allemaal op het apparaat: je merkbestanden en tokens verlaten je machine nooit (het kiezen van een Google Font haalt die ene familie eenmaal op bij Google, na een toestemmingsdialoog), en het merk reist mee in één [brand pack](#move-a-brand-between-devices)-bestand.

> **Dit is de editor. Het dashboard is de spiegel.** Het tabblad **Design system** op het Dashboard (`#/d`) *toont* je merk alleen-lezen; je *bewerkt* het hier op `#/start`. Als je later een kleur wilt wijzigen, kom dan terug naar de Brand Studio.

## De kamers

De studio is een set **kamers**, opgesomd in een rail aan de zijkant - geen stappen. Niets is genummerd, niets is afhankelijk van iets anders en in elke kamer aankomen is legitiem:

- **Overzicht** - de hub. Wat er nu bestaat, in één oogopslag, met een deur naar elke kamer.
- **Kleuren** - voeg kleuren één voor één toe, ken rollen toe of genereer een heel palet uit één kleur.
- **Type** - de vier lettertypen die de app, je tools en elke export gebruiken.
- **Logo's** - je merktekens, in elke oriëntatie en behandeling.
- **Tokens** - hoekradius, spatiëring, schaduwen en de rest van het systeem.
- **Bestanden** - de beeld-, audio- en bewegingsbestanden die je merk bewaart.

Op een telefoon wordt dezelfde lijst een horizontale chipstrook vastgezet onder de header. Van kamer wisselen laadt nooit iets opnieuw - de editor houdt al zijn panelen gemonteerd en toont gewoon degene die je opvroeg.

**Deep-link een room** met `#/start?area=<key>`. De keys zijn `overview`, `color` *(let op de Amerikaanse spelling in de URL)*, `type`, `logos`, `tokens`, `catalogue` (de Files-room - de panelkey is een permanent contract, dus de URL houdt de oude naam aan) en `versions`. `?tab=` is het aloude alias voor hetzelfde en werkt nog steeds, dus oude links en bookmarks blijven functioneren; alles wat niet herkend wordt opent Overview in plaats van dood te lopen.

Vastgepind aan de **onderkant van de rail** staan de acties die bij het hele designsysteem horen in plaats van bij één room:

- **Add from…** - de bronkiezer, om een merk binnen te halen uit een bestand, een PDF, een afbeelding, een lettertype of een website. Zie [Een merk binnenhalen](#bring-a-brand-in) hieronder.
- **Tray** - de kandidaten die een scan heeft gevonden maar nog niet heeft vastgelegd. Blijft verborgen tot een scan daadwerkelijk iets bewaart, en toont dan een aantal; niets erin verandert je merk totdat je op die rij op Add drukt.
- **Export** - schrijft het hele merk weg als één `LollyBrand-…zip`.
- **Tokens (.json)** - het platte design-tokensdocument los, voor een repo, een buildstap of een andere tokenstool.
- **Versions** - publiceer, activeer en herstel benoemde kopieën van het designsysteem. Verborgen tot er iets van jezelf is om te publiceren (of een `?area=versions`-link er expliciet om vraagt).

![De studio room-rail - Overview, Colours, Type, Logos, Tokens en Files](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Overview

Overview is de room waar je terechtkomt, en die heeft twee gezichten.

Met **nog niets ingesteld** biedt het twee deuren - **Start from a file** (design tokens, een Penpot-project, een design system pack of een SVG) en **Start from scratch** (voeg één kleur toe en ga verder wanneer je wilt) - plus een rustige **Explore the tools**-uitgang eronder, want weggaan is ook een legitiem antwoord.

Zodra er een designsysteem bestaat, toont dezelfde room **wat je hebt**: het palet en het aantal kleuren, de geldende lettertypefamilies, hoeveel logo-slots gevuld zijn, hoeveel tokens er zijn en de Files-room. Elk blok is een deur naar zijn room. Er staan hier aantallen, nooit een voortgangsbalk en nooit een afrondingskaart - niets in deze studio is verschuldigd.

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

![The Colours room after one colour - the two panes back, the generate offer, roles reading in three registers and the pane at one colour](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

De rijkste room, in twee vlakken. Links werk je; rechts staat je **live palette**. Sleep de scheiding ertussen om te herschalen (Enter erop klapt het palet uit de weg).

![De Colours-room - een primaire kleur leidt ramps af, specimenkaarten met contrastratio's en een live palet](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Voeg een kleur toe en geef hem een taak

**Add a colour** is het hele eenvoudige pad: plak of kies een kleur in elke notatie en hij wordt precies één token. Er wordt niets van afgeleid, niets in gesuggereerd, niets anders geëist. Plak een hele *lijst* kleuren en elke kleur wordt een chip die je apart kunt toevoegen.

**Roles** is de laag erbovenop - welke kleur welke rol speelt. Roles zijn optioneel (een designsysteem van drie losse kleuren zonder roles is prima), elk swatch kan er een krijgen, en de contrastuitlezing wordt gemeten tegen het oppervlak, APCA eerst.

### De expertvleugels

Vier ingeklapte secties staan onder die twee. Open degene die je wilt; elk is deep-linkbaar als `#/start?area=color&focus=<wing>`:

- **Generate a starter palette** (`focus=generate`) - één kleur naar een volledige set tinten. Hieronder beschreven.
- **Shade curves** (`focus=curves`) - herschap een ramp punt voor punt. Lightness, chroma en hue krijgen elk hun eigen curve, geschakeld met L / C / H, en de tinten eronder worden live opnieuw gebakken terwijl je sleept.
- **Contrast** (`focus=contrast`) - **Contrast-lock** hertoont een ramp om APCA-doelen te halen tegen een achtergrond die je kiest, waarbij elke stap zijn eigen hue en chroma behoudt; **Rotate hue** draait de hele ramp als geheel rond het wiel, waarbij elke tint zijn lightness en chroma behoudt.
- **Print** (`focus=print`) - wat de primaire kleur wordt op de drukpers: de automatische schermwaarde, of een vastgepinde CMYK-opbouw of juist een benoemde steunkleur.

### Eén kleur, een heel palet

Binnen **Generate a starter palette** kies je een **Primary colour** en werkt Lolly een compleet palet uit - lichte en donkere oppervlakken, tekst, accenten en volledige tint/shade-ramps - met dezelfde perceptuele kleurwiskunde (OKLCH) die de engine overal gebruikt. Stem de afleiding af:

- **Scheme** - Mono, Complement, Analogous of Triad - bepaalt hoe de secundaire kleur zich verhoudt tot je primaire kleur.
- **Shades** - een schuifregelaar van 3 tot 20 (standaard 5) bepaalt hoeveel stappen elke ramp genereert.
- **Fine-tune** (ingeklapt) - **UI intensity** (Muted / Deep), **Contrast** (Comfort / High) en **Text on brand** (Auto / Light / Dark).

Niets in deze vleugel schrijft iets naar je merk. Het is een voorvertoning, live door de hele app zodat je hem kunt beoordelen, tot je op **Replace palette** drukt (hieronder).

Onder de primaire kleur zie je live **Primary / Neutral / Secondary / Blend**-ramps en Light- en Dark-specimenkaarten, elk met een eigen contrastuitlezing - de WCAG-ratio met het APCA `Lc`-cijfer ernaast. **Klik op een stap in de Neutral- of Secondary-ramp** om die tint te verankeren in plaats van de afgeleide standaardwaarde.

![De vier ramps gestapeld boven light- en dark-specimenkaarten, elke kaart met een eigen WCAG-contrastratio](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Bouw je palet (harmoniegenerator)

Nog in dezelfde vleugel genereert **Build your palette** bijpassende accentkleuren uit je primaire kleur. Kies een **Harmony** - **Complementary**, **Adjacent**, **Triad**, **Tetrad** of **Analogous** (die zijn eigen **Accents**-aantal meebrengt, 2 tot 5, en een hue-**Angle** van 10° tot 45°) - en elke kandidaat komt met een automatisch gegenereerde, leesbare naam en een **+ Add**-knop. Eentje toevoegen zet die kleur meteen in je palet, één druk op de knop voor één token. *"Your palette, applied"* toont een voorvertoning van de hele set op echte graphics.

![Gegenereerde accenten, elk met een swatch, een automatisch gegenereerde naam, zijn hexwaarde en een Add-knop](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Een gegenereerd palet doorvoeren

**Replace palette** is de enige control in deze vleugel die iets wegschrijft, en dat gebeurt nooit meteen. Druk erop en er opent eerst een reviewkaart, met als kop **"Replace the palette?"**, die precies opsomt wat er staat te gebeuren: hoeveel roles blijven zoals jij ze toegewezen hebt, hoeveel kleuren die je zelf toevoegde behouden blijven, hoeveel shade curves opnieuw verankerd worden, hoeveel print locks opnieuw vastgepind worden, hoeveel verborgen tinten verborgen blijven, hoeveel gradient stops hun kleur behouden.

**Replace palette** op die kaart voert het door; **Cancel** stapt weg en verandert niets. Zodra het is uitgevoerd, wordt de kaart **"Palette replaced."** met een reeds gefocuste **Undo** - en er wordt een checkpoint van het hele designsysteem gemaakt *voordat* de wissel plaatsvindt, zodat "zet het terug zoals het was" een herstel is in plaats van een verloren middag.

### Het palet, de chart en elke swatch

Het rechtervlak toont elke kleur die je merk heeft, gegroepeerd (Primary, Neutral, Secondary, Spectrum, Custom, Roles), elke groep inklapbaar met een eigen **+ Add**. Daaronder klapt **Colour chart** open naar twee weergaven van dezelfde swatches: de **Wheel** (het OKLCH-wiel - sleep een punt om hem te herkleuren, klik op een punt om hem te bewerken of klik op lege ruimte om een nieuwe swatch neer te zetten) en de **Gamut**-chart, die laat zien waar het weergeefbare bereik daadwerkelijk eindigt. `#/start?area=color&focus=chart` opent de kaart direct, net als `?wheel` altijd al deed.

![Het paletvlak, elke groep inklapbaar, met de downloadpil onderaan geparkeerd](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Het OKLCH-wiel - hoek is tint, afstand naar buiten is verzadiging en de grijstinten lopen langs een helderheidsrail aan de zijkant](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

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

### Verlopen

Een optioneel **Verlopen**-paneel bouwt mengtokens uit je palet voor achtergronden en accenten. Sla dit volledig over als je merk geen verlopen gebruikt. Elk verloop heeft een voorbeeld, benoemde stops (2-8) en een hoek. Het belangrijkste gedrag: **een stop verwijst naar een kleurstaal**, dus geef die kleurstaal een nieuwe kleur en het verloop volgt mee. Interpolatie gebeurt in OKLCH voor schone overgangen. Verwijder een stop om de reeks in te korten.

### Neem het palet mee

De zwevende pil onderaan het paletvenster downloadt het hele palet als **Design tokens (JSON)**, **CSS-variabelen**, **CSS-klassen**, **SCSS-variabelen**, een **GIMP-palet (.gpl)** of een **Adobe Swatch Exchange (.ase)** - zodat het merk direct in Illustrator, Figma, GIMP of een stylesheet terechtkomt. Hij staat buiten de scroller van het venster, dus hij houdt zijn plek hoe ver het palet ook scrollt. (Je kunt het palet ook downloaden vanuit de weergave [Catalogus](/info/using.html).)

## Typografie

![The compare stage open under its card, with the search row, the pinned families and the cards folded to a one-line strip](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

De ruimte begint met **vier rolkaarten** - de vier lettertypes die de app, je tools en elke export daadwerkelijk gebruiken. Elke kaart toont wat die rol nu vervult, ingesteld in dat lettertype, met een regel echte tekst eronder:

- **Primair** - hoofdtekst, knoppen en elke tool.
- **Koppen** - het weergavelettertype voor `h1`/`h2`.
- **Code** - een niet-proportioneel lettertype voor code en gegevens.
- **Cursief** - een echte cursieve begeleider voor nadruk, citaten en terzijdes.

Koppen, code en cursief vallen elk terug op het primaire lettertype totdat je ze toewijst, dus een merk met één lettertype hoeft hier helemaal geen keuzes te maken. Niets op een kaart legt iets vast: **Wijzigen** (of **Kies een lettertype** bij een lege rol) opent het **vergelijkingsscherm** afgestemd op die rol.

![De Typografie-ruimte - de rolkaarten en een live specimen van elk lettertype in actie](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

### Het vergelijkingsscherm

Het scherm opent **inline in de ruimte**, niet in een dialoogvenster, zodat de kaarten waar je vandaan kwam op het scherm blijven staan. Zoek een Google Fonts-familie (Inter, Fraunces, Space Grotesk...) of sleep een lettertypebestand erop, druk op **Toevoegen aan de vergelijking** en de kandidaten staan naast elkaar in dezelfde woorden voordat een van hen wordt geïnstalleerd. Escape annuleert en geeft het toetsenbord terug aan de kaart van waaruit je het opende.

Dat is de ene deur naar binnen, en dat is waarom niets ongezien je merk binnenkomt. Onder het podium bevinden zich de twee beheerpanelen:

- **Lettertypen op dit apparaat** - elke geïnstalleerde familie, de rollen die ze vervult en een verwijderknop. **Een lettertype toevoegen** opent hier hetzelfde vergelijkingsscherm, niet afgestemd op een rol.
- **Jouw lettertypen** - upload een **TTF**, **OTF** of **WOFF** vanaf je eigen machine. Dat is het pad voor een gelicentieerd bedrijfslettertype dat je al bezit.

Hoe dan ook blijft het lettertype op dit apparaat, wordt het weergegeven in de app, in je tools en in elke export, voor altijd offline, en reist het mee in je merkpakket - er wordt niets opgehaald tijdens het renderen. Alles op Google Fonts wordt geleverd onder een open licentie (OFL/Apache/UFL).

Het paneel **Typografierollen** onderaan toont een live specimen van elke rol - hoofdtekst en UI in het primaire lettertype, een optioneel weergavelettertype voor de bovenste koppen, een cursief voor nadruk, een niet-proportioneel lettertype voor code en gegevens - zodat je de hele set samen ziet werken.

![Het specimen van de Typografierollen - kop, hoofdtekst, cursief en code, elk ingesteld in het lettertype waar die rol naar resolveert, met de naam van het lettertype ernaast](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

## Tokens

De rest van het ontwerpsysteem, te bewerken zonder code aan te raken:

![De Tokens-ruimte - een hoekstraal-schuifregelaar plus tussenruimte, formaat, schaduwen en de rest van het systeem](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Afgeronde hoeken** - één straalschuifregelaar (0-1,5rem) die kaarten, knoppen en panelen door de hele app volgen.
- **Meer tokens** - voeg **tussenruimte**, **formaat**, **lijndikte**, **dekking**, **rotatie**, gewone **getallen** en **schaduwen** toe en bewerk ze. Kies een type, geef het een naam (*Gutter, Kaartschaduw...*) en stel de waarde in. Deze worden opgeslagen als standaard [design tokens](/info/design-tokens.html) (DTCG) en reizen mee met je merk.

## Bestanden

Zet hier de bestanden neer die je merk bijhoudt - logo's daargelaten - **vector**-, **afbeeldings**-, **audio**- en **bewegings**bestanden (video, Lottie, geanimeerd). Ze komen terecht in je [Catalogus](/info/using.html), gesorteerd in secties en beschikbaar in de assetkiezer van elke tool. Alles blijft op dit apparaat. (De zijbalk noemt de ruimte **Bestanden**; de URL-sleutel blijft `catalogue`, omdat een paneelsleutel een permanent contract is.)

## Een merk binnenhalen

**Toevoegen vanuit...** onderaan de zijbalk opent een kiezer in twee fasen. De eerste fase vraagt wat je *hebt*, niet welk formaat het is:

- **Design tokens of een ontwerpbestand** - DTCG- of Tokens Studio-JSON, een Penpot-project, een **zip met tokensets**, een Lolly-ontwerpsysteempakket of een SVG.
- **PDF** - een presentatie of een richtlijnenbestand, op dit apparaat gelezen voor de kleuren, de merktekens en de ingesloten lettertypen.
- **Afbeelding** - een schermafbeelding of een foto; de kleuren worden op dit apparaat gelezen en er wordt niets geüpload.
- **Lettertypebestand** - TTF, OTF of WOFF. Opent de Typografie-ruimte, waar het lettertype wordt geïnstalleerd.
- **Website** - één pagina, gelezen voor de kleuren en typografie. Deze tegel verschijnt alleen op een apparaat dat daadwerkelijk een pagina kan lezen, omdat een uitgeschakelde tegel die iets adverteert wat niemand kan aanklikken erger is dan geen tegel. Waar hij wel verschijnt, noemt hij zijn lezer duidelijk: opgehaald door de app op dit apparaat, of gelezen via de browserextensie in een achtergrondtabblad, ingelogd als jij. Het invullen van een URL vult het veld alleen *vooraf in* - de ophaalknop is de toestemming, dus een link die iemand je stuurt kan nooit zelf een leesactie starten.

Kies de bron ontwerpbestand en de tweede fase is de kaart hieronder: de geaccepteerde formaten staan voorop als pictogramtegels in voorkeursvolgorde, en de hele kaart is één droptarget - klik ergens op de kaart of sleep een bestand erop. Je kunt ook een bestand direct op de studio neerzetten.

![De importkaart - de geaccepteerde formaten staan voorop als pictogramtegels, en de hele kaart is één droptarget](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

Wat elk ontwerpbestand je oplevert:

- een **LollyBrand**-pakket (`.zip`) - installeert in één stap;
- een **Penpot**-export (`.penpot`) - haalt de design tokens ervan binnen;
- een **Design Tokens**-bestand (`.json`) - W3C DTCG;
- een **Tokens Studio**-bestand (`.json`) - Tokens Studio;
- een **gewone SVG** (`.svg`) - Lolly scant de kleuren erin en laat je kiezen welke je wilt behouden, waarbij de eerste je primaire kleur wordt.

Een installatie vanuit een bron maakt eerst een **checkpoint**, zodat "terug naar voor de import" één herstelactie is. En wat een scan vindt, gaat niet meteen erin: kandidaten komen in de **Tray** terecht, waar elk apart wordt toegevoegd met een eigen druk op de knop, via de ruimte die dat soort materiaal beheert.

`#/start?source=<kind>` opent de kiezer op een gegeven bron (`file`, `pdf`, `image`, `font`, `url`), en `?import` opent hem op de gewone lijst.

## Een merk tussen apparaten verplaatsen

**Exporteren** onderaan de zijbalk schrijft één enkele **`LollyBrand-…zip`** - je tokens, lettertypen, logo's en themavoorkeur, met een integriteitsmanifest dat bij het terughalen wordt geverifieerd. Ernaast schrijft **Tokens (.json)** het gewone design-tokensdocument apart: geen lettertypen, geen logo's, alleen de tokens, wat is wat een repo, een CI-stap of een andere tokentool daadwerkelijk leest.

Er een terugbrengen doe je via **Toevoegen vanuit... → Design tokens of een ontwerpbestand** (hierboven), of door er een naar de studio te slepen. Zo geeft een collega je een merk, of breng je er een over naar een tweede installatie - geen account, geen cloud. Om een merk vanaf de command line binnen te halen, zie [`ingest:brand`](/info/configuration.html#brand-packs).

## Versies

**Versions** onderaan de rail is waar een designsysteem stopt een bewegend doel te zijn. Publiceer er een en je krijgt een **permanente, benoemde kopie** die op dit apparaat wordt bewaard: die verandert daarna nooit meer, dus een tool die eraan vastpint blijft hetzelfde tekenen. Het paneel blijft verborgen totdat er iets van jezelf te publiceren valt, dus een studio die nooit publiceert, ziet de bediening nooit.

Drie dingen om te weten voordat je ergens op drukt, en het paneel noemt alle drie voor het drukken in plaats van erna:

- **Een versie is permanent.** Er is nog geen verwijderoptie, dus het paneel vermeldt wat er is bewaard en dat het bewaard blijft, in plaats van een knop aan te bieden die liegt.
- **Verwijderingen staan bovenaan de compatibiliteitskaart.** Toegevoegde en gewijzigde tokens zijn nieuws; een *verwijderd* token is wat een tool breekt, dus dat wordt als eerste genoemd en bij naam genoemd.
- **Publiceren kan niet ongedaan worden gemaakt; herstellen wel.** *Restore latest from this version* is een gewone bewerking op de head, dus die komt op de undo-stack van de studio terecht en het paneel biedt je meteen **Undo** aan.

Je kunt **Alleen publiceren**, of **Publiceren en actief maken** - het verschil is of tools en de app vanaf nu die versie volgen of je laatste bewerking blijven volgen. **Weer de nieuwste volgen** zet elke bewerking live zodra hij gemaakt is. `#/start?area=versions` opent het paneel direct.

## Wanneer het merk vast staat

Sommige builds leveren een **vastgezet merk** - de kleuren, lettertypen en tokens ervan zijn wat elke tool en export gebruikt, en er valt niets te wijzigen. In dat geval wordt de studio vervangen door een korte notitie die uitlegt dat deze build met een vast merk komt en bewerken uitgeschakeld is. Dit is opzettelijk: zo garandeert een organisatie dat alles on-brand blijft.

## Waar je hierna heen kunt

- **[Lolly gebruiken](/info/using.html)** - het canvas, opslaan, projecten en de catalogus.
- **[Design Tokens](/info/design-tokens.html)** - het tokenmodel waarin je merk wordt uitgedrukt.
- **[Exporteren & formaten](/info/exporting.html)** - druk-eenheden, CMYK en de formaten waarin je merk gerenderd wordt.
