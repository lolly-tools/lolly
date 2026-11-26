# Lolly Design System Setup

<a id="design-system-setup"></a>

**Lolly Design System Setup**, op `#/start`, bevat je logo, kleuren en lettertypen. Elke tool, pagina en export tekent ermee.

Sleep er een logo in en Lolly leest de kleuren. Kies een lettertype of sleep het lettertypebestand waarvoor je bedrijf een licentie heeft erin. Elke wijziging is meteen in de hele app te zien. Je logo, lettertypen en tokens blijven op dit apparaat. Alleen het kiezen van een Google Font maakt een externe verbinding: Lolly vraagt eerst om toestemming en haalt de familie daarna eenmalig op.

Geef het design system een naam en druk op **Export** om één `.lolly`-bestand te krijgen. Bewaar het bestand, open het op een ander apparaat of geef het aan een collega. [Lolly Settings](/info/dashboard.html#design-system) toont het actieve systeem als alleen-lezen; de omslag linkt hierheen terug om het te bewerken.

<!--i:eti-clock-->
## Maak het in vijf minuten van jou

::: timeline
- <!--i:upload--> **Sleep je logo** op het neerzetgebied in **Logos**. Lolly leest de vorm en de kleuren.
- <!--i:palette--> **Gebruik deze kleuren.** De hoofdkleur van het logo wordt je primaire kleur en een donkere neutrale kleur uit het logo wordt je tekstkleur.
- <!--i:font--> **Kies een lettertype** in **Type**: een Google Font of een lettertypebestand dat je bezit.
- <!--i:pentool--> **Geef het systeem een naam.** Je eerste bewerking maakt een eigen design system en Lolly vraagt eenmalig naar de naam.
- <!--i:download--> **Export** schrijft het hele systeem als één bestand `LollyBrand-….lolly`.
:::

De balk bovenaan de studio toont de naam van het design system als bewerkbaar veld. **Enter** bewaart een nieuwe naam en **Escape** zet de oude terug. Als je eerste bewerking vraagt **What is this design system called?**, vult Lolly de woorden uit je logo in, als die erin staan. **Save name** bewaart de naam; **Not now** behoudt een tijdelijke naam totdat je er een in de balk typt. De naam duidt het systeem aan in Settings en bij het wisselen, en is de naam van het bestand dat **Export** schrijft.

<!--i:eti-grid-->
## De ruimtes

De studio bestaat uit ruimtes zonder vaste volgorde. Geen ruimte wacht op een andere. Op een desktop staan de ruimtes in één strook onder de balk. Op een telefoon verhuizen ze naar een balk langs de onderrand, waarbij de geopende ruimte in beeld wordt gescrold. Het paletpaneel en de tray komen boven die balk uit en de balk schuift opzij terwijl je typt. Met een toetsenbord bereik je de strook met één tabstop en ga je met de pijltjestoetsen, Home en End van ruimte naar ruimte.

![De balk van de studio en de ruimtes: Board, Colours, Type, Logos, Tokens, Files, Sound, Rules en Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Ruimte | Wat je er doet | Linksleutel |
|---|---|---|
| **Board** | Bekijk wat het systeem bevat, met toegang tot elke ruimte | `overview` |
| **Colours** | Voeg kleuren toe, geef ze rollen, maak tinten en een palet | `color` |
| **Type** | Kies de vier lettertypen die de app, de tools en elke export gebruiken | `type` |
| **Logos** | Plaats je beeldmerken in elke oriëntatie en uitvoering | `logos` |
| **Tokens** | Hoeken, tussenruimte, schaduwen en elke andere benoemde waarde | `tokens` |
| **Files** | De afbeeldingen, audio- en animatiebestanden die je merk bewaart | `catalogue` |
| **Sound** | Geef vorm aan de geluidsidentiteit, muziek voor verschillende toepassingen en de relatie met de stem | `sound` |
| **Rules** | De regels die je merk toepast, getoetst aan echte voorbeelden | `usage` |
| **Skills** | De schriftelijke normen van het merk voor mensen en agents, om te lezen en te downloaden | `skills` |

Link naar een ruimte met `#/start?area=<key>`. Ruimtesleutels zijn permanent, dus Files houdt `catalogue`, Board houdt `overview` en Rules houdt `usage`. `?tab=` werkt nog steeds als oudere alias. Een onbekende sleutel opent Board.

De **balk** bevat acties voor het hele systeem. **Add from…** haalt een merk binnen ([Een merk binnenhalen](#bring-a-brand-in)). De **Tray** bevat wat een scan heeft gevonden en je nog niet hebt toegevoegd. **Export** schrijft het systeem als één bestand. **More** bevat **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions & publishing**, **Restore brand settings** en **Design systems**, dat de lijst in Settings opent waarmee je wisselt ([Je design system bewaren en verplaatsen](#keep-and-move-your-design-system)). Elke actie verschijnt zodra er iets is waarop ze kan werken. Op een telefoon verhuist **Add from…** naar **More** en verschijnt **Export** als pictogram.

Zolang het design system nog het systeem is dat bij de app werd geleverd, begint de balk met **Make it yours**, een menu met **Find a look**, **Add from…** en **Pick a colour**. Zodra het systeem van jou is, neemt **Export** die plaats weer in.

<!--i:eti-clipboard-->
## Board

Als je nog niets hebt gekozen, biedt Board vier manieren om te beginnen. **Start from a reference** opent de bronkiezer voor een logo, schermafbeelding, webpagina of ontwerpbestand. **Pick a colour**, **Choose a face** en **Add a logo** openen de bijbehorende bediening. Er een openen slaat niets op. Daaronder biedt **Find a look** kant-en-klare kleuren en lettertypen om te proberen, en **Explore the tools** is er vanaf het begin.

Zodra er iets van jou is, toont Board wat je hebt, met je eigen aantallen eerst. Colours geeft het aantal kleuren, met een gedempt `· N starter` voor overgenomen kleuren. De strook toont je kleuren, daarna een haarlijn en dan de vervaagde startkleuren. Colourways toont elke colourway als een kleine tegel in de hoofdkleur. Type vermeldt elke rol en zet elke familie in het eigen lettertype (*Inter voor koppen*, met *Starter voor de rest* op de regel eronder). Logos geeft aan hoeveel plaatsen zijn gevuld (of **Not set**), Tokens toont de hoekradius en Files toont **Nothing yet** zolang de bibliotheek leeg is. Elk blok opent de bijbehorende ruimte.

Een bewerkbaar design system dat bij de app werd geleverd, zoals Lolly Demo, toont vanaf het begin zijn kleuren, colourways, lettertypen en beeldmerken op Board, met een label **Came with this app** naast de kop. Daarboven biedt **Start here** de opties **Find a look**, **Add from…** en **Pick a colour**.

### Starter en van jou

In elke ruimte markeert **Starter** alles wat bij de app werd geleverd en door niemand is gekozen. Een nieuwe installatie bevat geen kleur, alleen één neutrale reeks van inkt tot papier, zodat achtergronden, tekst en haarlijnen kunnen worden gerenderd voordat iemand iets kiest.

::: cols
## Starter

- Meegeleverd met de app: de neutrale kleuren van inkt tot papier, de startlettertypen en de standaardhoekradius.
- Gedempt, met een label **Starter** en zonder tint.
- Niet meegeteld als je eigen kleuren. De neutrale kleuren staan in **Tokens** als **Neutrals · starter · 9**, en **Open** toont ze in Colours als één ingeklapte groep (`#/start?area=color&group=neutral`).
- Een rol die een startkleur gebruikt toont *"Starter Paper valt in"*, met **Choose…** op de kiezer.

## Van jou

- Door jou gekozen of geïnstalleerd.
- Volledig zichtbaar, met een getinte kaart waar je een lettertype hebt geïnstalleerd.
- Meegeteld op Board en in Tokens.
- Een rol die een andere volgt toont **↳ follows Primary**.
:::

Overgenomen materiaal heeft nooit een onderbroken rand. Een onderbroken rand geeft een neerzetgebied aan.

<!--i:eti-shapes-->
## Logos

Het neerzetgebied bovenaan, **"Drop marks here, or choose several at once"**, accepteert zoveel bestanden als je hebt. Lolly leest de vorm en de inkt van elk bestand. Het bestand wacht daarna onder **Waiting for a slot** als een chip die aangeeft waarop het lijkt, zoals *"Lijkt op de Horizontal primary"*, met de gebruikte meting en een knop **Place** (**Replace** als de plaats al gevuld is). Als Lolly het niet zeker weet, geeft de chip dat aan en biedt **Change slot**, met alle acht plaatsen in een lijst. Er wordt niets geplaatst totdat je op een knop drukt.

Een beeldmerk met overtollige lege marge krijgt eerst een voorstel om het bij te snijden. Beantwoord het voorstel of druk op Escape om het origineel ongewijzigd te plaatsen. Als een beeldmerk een lege verwante plaats kan vullen, biedt de ruimte de afgeleide **mono**- of **reverse**-versie als een chip met het label *Generated*.

Elk beeldmerk komt in een raster van acht optionele plaatsen, één per **oriëntatie** en **uitvoering**:

- **Oriëntaties:** Horizontal (woordmerk en symbool naast elkaar) en Vertical (gestapeld, voor vierkante en hoge ruimtes).
- **Uitvoeringen:** Primary, Primary reverse (voor donkere achtergronden), Mono (één kleur) en Mono reverse.

Een groep zonder beeldmerken klapt in tot één regel; open de groep om de plaatsen te zien. Klik op een plaats om een PNG, SVG, JPEG of WebP toe te voegen, of klik op een gevulde plaats om het beeldmerk te vervangen. Je kunt ook een bestand op een lege plaats slepen. Horizontale beeldmerken staan in brede tegels en verticale in vierkanten, elk op de achtergrond waarvoor het is gemaakt, met witruimte van een kwart van de hoogte. Alles blijft op dit apparaat.

![De plaatsen voor logo's met Horizontal en Vertical geopend: elke uitvoering heeft een eigen plaats en elke plaats is optioneel](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&system=new-design-system&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails.be-logo-group--fold%3Anot%28.be-logo-group--custom%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** zijn beeldmerken waarvoor je merk een eigen naam gebruikt, zoals een pictogram, een wapenschild of een favicon.
- **Meer identiteiten.** Een submerk, product of evenement kan een eigen volledige set hebben: druk op **+ Add another logo** en geef de set een naam. Je hoofdset heet "Your logo". [Merkarchitecturen](/info/brand-architectures.html) laat zien wanneer je een logo-identiteit gebruikt.
- **Lolly leest de kleuren van het logo.** Een kaart onder het neerzetgebied en bovenaan Colours vermeldt de kleuren van het logo en vraagt **Which is the main colour?**. De sterkste kleur wordt geselecteerd, nooit het wit waarop het logo is geëxporteerd. **Use these colours** voegt ze toe aan je palet en maakt de hoofdkleur je primaire kleur. Als het logo een donkere neutrale kleur bevat die op papier goed leesbaar is, wordt die neutrale kleur de tekstkleur. **Not now** laat ze in de Tray staan. Bij een volledig nieuwe installatie past Lolly het waarschijnlijkste antwoord meteen toe en biedt de kaart **Undo** of een andere hoofdkleur. Een SVG levert exacte kleuren; een PNG, JPEG of WebP levert de kleuren die een aanzienlijk deel van het beeldmerk beslaan.

<!--i:eti-palette-->
## Colours

De ruimte groeit mee met het design system. Een eerste bezoek vraagt om één keuze; er verschijnt meer bediening naarmate het palet groeit.

### De eerste kleur

Een systeem zonder eigen kleuren toont de neutrale startkleuren in een eigen open groep. Bovenaan de ruimte staat een plak- en neerzetveld met een onderbroken rand: één grote chip en één veld. Sleep een afbeelding of een lijst met kleuren naar een willekeurige plek op het veld en Lolly leest de kleuren.

- **De chip is de kiezer.** **Pick a colour** opent de OKLCH-kaart van de studio, ingevuld met de inhoud van het veld. De kaart toont eerst de naam en de hexwaarde van de kleur. De kleurruimtes, het wiel, de vier draaiknoppen en alfa staan onder **Fine-tune**, en **Cancel** en **Add colour** staan onderaan. Er komt niets in het systeem totdat je op **Add colour** drukt.
- **Het veld accepteert elke notatie**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` of een kleurnaam. Een geplakte lijst wordt een rij chips die je één voor één of met **Add all** kunt toevoegen.
- **Nog twee manieren.** **Pick a colour from the screen** gebruikt de pipet als de browser die heeft, en **Take colours from an image** leest een schermafbeelding of foto op dit apparaat.
- **Add is nooit uitgeschakeld.** Als het veld leeg is, opent het de kiezer; bij tekst die het niet kan lezen verschijnt daaronder een regel die dat aangeeft.

Je eerste kleur wordt de **primaire kleur**. Een chip bevestigt de wijziging, zoals *"Primary is nu Vivid Violet"*, met **Fine-tune** om de kleur aan te passen.


### Naarmate het palet groeit

Je kleuren staan op een breed scherm naast een voorbeeld **In context** en op een kleiner scherm erboven. Het voorbeeld toont een poster, diagram of interfacekaart in je palet. Startkleuren hebben een eigen groep, die inklapt zodra het systeem eigen kleuren heeft. Het plak- en neerzetveld wordt één compacte rij. Bovenaan de ruimte staat geen export; gebruik **Export** in de balk of de ruimte Tokens.

![De ruimte Colours bij Lolly Demo: de rolchips en het plak- en neerzetveld bovenaan, dan het palet in inklapbare groepen, elke kleur met naam en hexwaarde](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![De ruimte Colours bij Lolly Demo na het toevoegen van één kleur: de tabel Colour roles, dan de chip van de nieuwe kleur met Use as Lead? en Fine-tune, naast een live voorbeeld van een compositie](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Kleurrollen: hoe de kleuren heten

Het design system geeft de kleuren namen en zegt waar elke kleur voor dient. Lolly leest beide. **Colour roles** staat bovenaan de ruimte Colours. **In context** toont elke wijziging meteen.

![De tabel Colour roles bij Wefthouse, een fictief textielmerk, in de eigen woorden van het merk: de colourway-chips Indigo, Madder en Weld, dan Main, Accent, Supporting en Tertiary, elk met een lichte en donkere kleur, gelezen als hoofdkleur, partnerkleur en alleen op naam, en Background, Text, Quiet text en Hairlines onder de tabel als de toepassingen die geen rol invult](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=wefthouse&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

De tabel heeft vier kolommen. Op een telefoon wordt elke rij een kaart met licht en donker naast elkaar:

| Kolom | Wat erin staat |
|---|---|
| **Role** | Het eigen woord van het design system, dat je direct kunt bewerken, en een regel die aangeeft waar de kleur voor dient |
| **Light** en **Dark** | De kleur in die look voor de gekozen colourway, met de naam of waarde en het contrast |
| **Lolly reads this as** | Wat een tool met de rol doet, in Lolly's eigen woorden |

**Hoe Lolly een rol interpreteert.** Elke interpretatie hoort bij één rol. Als je een interpretatie kiest die een andere rol heeft, verhuist die interpretatie naar deze rol. Lolly leidt nooit betekenis af uit een woord.

| Interpretatie | Wat eruit volgt |
|---|---|
| **Lead colour** | Grote vormen, knoppen, de kleur die een tool als hoofdkleur gebruikt |
| **Partner colour** | De tweede kleur die een tool gebruikt |
| **Background** | Ligt achter al het andere |
| **Text** | Koppen en lopende tekst |
| **Quiet text** | Bijschriften en kleine lettertjes |
| **Hairlines** | Lijnen, randen en scheidingslijnen |
| **By name only** | Geen enkele tool kiest de rol vanzelf. Ze wordt aangeboden in elk kleurveld en in Design, waar een keuze gekoppeld blijft en dus de colourway volgt |

Een interpretatie die geen rol invult, behoudt de definitie van het design system. De ruimte vermeldt die interpretaties onder de tabel. Een rol met dezelfde id als een interpretatie, zoals een rol met de naam Primary, is die interpretatie en kan niet worden verplaatst.

**In een diagram.** Het palet **Design system - colour roles first** van Lolly Chart geeft de reeksen de kleurrollen van het design system in de eigen volgorde, gevolgd door de rest van het palet. Een rol die als achtergrond, tekst, ingetogen tekst of haarlijnen wordt geïnterpreteerd, wordt overgeslagen omdat het diagram zijn achtergrond en woorden in die kleuren tekent. Er verandert niets totdat je dat palet kiest. Een design system zonder kleurrollen tekent het palet als **Design system - ordered**.

**Waarden.** Druk op een waarde om de kleur van die rol te kiezen voor die look en de gekozen colourway. **Same as light** laat de donkere waarde de lichte volgen totdat je een donkere kleur kiest. De chip **Aa** toont de tekst die Lolly kiest om op de kleur te zetten. De regel onder de waarde zegt hoe die tekst in elke look leesbaar is: **Text reads well**, **Large text only** of **Hard to read as text**. De beoordeling gaat alleen over tekst op de kleur; de kleur kan nog steeds werken voor vormen en grote vlakken. Een rol die alleen op naam wordt geïnterpreteerd, toont dezelfde woorden zonder de waarschuwingskleur, omdat geen enkele tool vanzelf tekst op die rol zet. De tooltip en de kiezer tonen de cijfers, eerst APCA en dan WCAG. **Own text colour** markeert een waarde waarvan het bestand de tekstkleur opgeeft; die tekstkleur blijft behouden. **Copied** markeert een waarde uit een andere colourway of van de partnerkleur die nog niemand heeft gekozen; **Keep this colour** in de kiezer legt de waarde vast.

**Uitgangspunten.** Een design system zonder eigen rollen toont de huidige woorden: Primary, Secondary, Surface en Text. Er wordt niets vastgelegd totdat je er een wijzigt. **+ Add a role** stelt **Primary, Secondary** of **Main, Accent, Supporting, Tertiary** voor, of accepteert woorden die je zelf typt, en toont welke interpretatie elk woord zou krijgen. De eerste twee woorden worden de hoofdkleur en de partnerkleur. Tools blijven dezelfde kleuren tekenen. Bij een systeem met één hoofdkleur krijgt de eerste colourway de naam van die kleur.

**Hernoemen, herordenen, verwijderen.** Hernoemen verandert alleen het woord; alles wat de rol gebruikt, blijft werken. Sleep een rol aan zijn greep, of druk op Space op de greep, gebruik de pijltjestoetsen en druk op Space om los te laten. **Remove** vermeldt wat de rol nog gebruikt. Wanneer tools de rol lezen, laat **Remove and keep those colours** elke interpretatie zijn huidige kleur behouden. Een huisstijlregel, een hulplijnengroep, een toolveld of een ander token dat de rol gebruikt, houdt de rol vast totdat dat gebruik verandert. Een opgeslagen Design-document kan een rol ook op naam gebruiken, en Lolly kan dat niet zien in het tokenbestand. Zo'n document meldt dat de kleur niet kon worden bepaald.

::: details Rollen in een handgeschreven tokenbestand
**Een handgeschreven bestand.** Kleuren in een tokenbestand die door geen enkele rol zijn gedeclareerd, staan onder **In this file, with no role yet**, elk met een veld voor een woord en **Make a role**. Ze blijven in beide gevallen op naam werken. Een token met cijfers in zijn naam kan geen rol zijn; het blijft in het bestand en blijft via zijn pad werken. Als een record in het bestand niet valideert, verschijnt de tabel zonder bediening en vermeldt ze waarom.
:::

**De rest van de ruimte gebruikt dezelfde woorden.** De chips, de rij **Use as** van het kleurstaal en de groep **Colour roles** van het palet gebruiken allemaal de woorden van het design system. De tegel van een kleurrol opent zijn waarde. Geëxporteerde bestanden leggen niets nieuws vast over rollen; de kleuren van een render veranderen doordat de tokens zijn veranderd.

**Waar de woorden terechtkomen.** De woorden en beschrijvingen reizen mee met het design system. Agents lezen ze in de ontwerpbriefing, `lolly://tokens` en de `AGENTS.md` van een merkpagina. De terminal toont ze in `lolly system status`. Een merkpagina vermeldt ze in `brand.json` en meet voor elke rol een contrastpaar. DTCG- en Tokens Studio-bestanden bewaren alles, `DESIGN.md` bewaart de woorden en de interpretaties en een PowerPoint-thema bewaart alleen de volgorde van het merk. [Kleurrollen in andere formaten](/info/design-tokens.html#colour-roles-in-other-formats) bevat de volledige lijst. Woorden worden altijd aangehaald als gegevens van het design system en nooit als instructies gelezen.

**Waar je een kleur kiest.** Elk kleurveld in een tool en in Lolly Design vermeldt eerst de rollen van het design system, in de eigen volgorde, met elk woord en zijn doel. **Aa** naast een rol kiest de kleur die op die rol staat. De andere kleuren volgen onder **Other colours**, zonder de eigen kopieën van een colourway, de on-kleuren en interpretaties die al door een rol worden ingevuld. Een keuze blijft gekoppeld aan de rol en volgt de colourway. Het veld toont het woord in elke colourway, en Settings en Tokens gebruiken het woord ook. Een design system zonder rollen behoudt zijn raster met kleurstalen.

### Elke kleur die een tool leest

Als **Colour roles** gesloten is, begint de ruimte met chips voor de eerste keuzes. Elke chip toont de kleur van de rol en zijn naam. Bij een systeem zonder eigen woorden zijn dat **Primary**, **Secondary**, **Surface** en **Text**. Druk op een chip om de kleur te kiezen uit de kleurstalen van het palet. **Every colour a tool reads**, onderaan **Colour roles**, bevat de volledige strook.

De strook toont de zeven kleuren die een tool kan lezen: Primary, Secondary, Surface, Text, Muted, Edge en On primary, in de eigen woorden van het design system waar die bestaan. Elke kleur speelt dezelfde rol in elke tool en export. Geen enkele hoeft te worden ingesteld en elke kleur kan een rol invullen. Drie losse kleuren vormen een goed systeem. De uitlezing zegt hoe tekst leesbaar is op de achtergrond, met APCA eerst. Elke rij toont je eigen kleur op volle sterkte, een vervangende startkleur of **↳ follows Primary**.

On primary wordt afgeleid van de primaire kleur, toont **Derived** en heeft geen kiezer. De schakelaar **Light** en **Dark** naast On primary, en die naast **In context**, kiezen welke look de strook, het palet en het voorbeeld tonen.

De eigen accentkleur van de app volgt standaard het design system, via de instelling **Interface follows the design system** in **Settings → Appearance**. Als de instelling uitstaat, blijft de interface van de app neutraal. Tools, canvassen en exports volgen het design system in beide gevallen.

**Colourways.** Een design system kan meerdere hoofdkleuren bevatten, die je per stuk kiest. De rij **Colourways** bovenaan **Colour roles** toont één chip per colourway, met **Default** op de canonieke colourway. **+ Add** begint een nieuwe colourway vanuit een paletkleur. Kies een chip en de tabel, de strook, het palet en de voorbeelden tonen die colourway. Je kunt de gekozen colourway hernoemen, dupliceren, verwijderen of als standaard instellen. Bij een systeem met colourways heeft elke colourway een eigen primaire en secundaire kleur nodig, en een eigen achtergrondkleur wanneer de colourways de achtergrond tinten. Die rollen blijven ingesteld in de kleurstaaleditor. [Colourways toevoegen aan een design system](/info/colourways.html#add-colourways-to-a-design-system) bevat de stappen en het tokenformaat, en [Lolly Demo in gebruik](/info/lolly-demo-in-use.html#colourways-on-real-work) toont colourways op echt werk. Iedereen kan een colourway als eigen colourway kiezen in **Settings → Appearance** ([Een colourway kiezen voor jezelf](/info/colourways.html#make-a-colourway-your-own)).

### Meer kleuren vinden

Drie tools bouwen voort op je primaire kleur. De eerste twee doen alleen suggesties; de derde vervangt het palet.

::: cols
## Tinten & harmonieën verkennen

Kies een **Starting colour**, een **Scheme** (Mono, Complement, Analogous of Triad) en het aantal **Shades** (3 tot 20, standaard 5). **Fine-tune** stelt de UI-intensiteit, het contrast en de tekst op de merkkleur in. Klik op een tint om die toe te voegen, of op **Add 5 shades** voor een groep. Je kleuren en rollen blijven behouden.

## Bijpassende kleuren vinden

Kies een **Harmony**: Complementary, Adjacent, Triad, Tetrad of Analogous (met **Accents** van 2 tot 5 en een **Angle** van 10° tot 45°). Elke kandidaat heeft een gegenereerde naam en **+ Add**, één druk per kleur.

## Het hele palet opnieuw opbouwen

Vervangt het palet vanuit één startkleur, na een overzicht van wat verandert en wat blijft.
:::

Alle drie gebruiken dezelfde perceptuele kleurberekeningen (OKLCH) als de engine. In **Explore shades & harmonies** tonen de rijen **Primary**, **Neutral** en **Secondary** de voorgestelde tinten, en **Theme preview** toont lichte en donkere voorbeelden met hun contrastmetingen.

![Drie voorgestelde tintgroepen, met bediening om ze afzonderlijk toe te voegen en een apart Theme preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Gegenereerde accenten, elk met een kleurstaal, een automatisch gegenereerde naam, de hexwaarde en een knop Add](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Een gegenereerd palet vastleggen

Open **Rebuild the whole palette…** en druk op **Preview full rebuild**. Het overzicht telt hoeveel rollen blijven zoals je ze hebt toegewezen, hoeveel van je eigen kleuren behouden blijven en hoeveel tintcurven, drukwerkvergrendelingen, verborgen tinten en kleurverloopstops opnieuw worden verankerd of behouden. **Apply rebuilt palette** legt vast; **Cancel** verandert niets. Daarna biedt de kaart **Undo**, dat al focus heeft. Het controlepunt dat vóór de wissel is gemaakt, herstelt het hele systeem.

Een systeem met colourways behoudt elke colourway wanneer je het palet opnieuw opbouwt. De canonieke colourway volgt de nieuwe startkleur en elke andere colourway behoudt zijn eigen kleuren, naam, volgorde en instellingen. Het overzicht vermeldt welke colourway volgt en welke hun kleuren behouden. Lolly bouwt een systeem niet opnieuw op als de colourways zijn gecodeerd op een manier die het niet kan bewerken; de kaart zegt waarom en er verandert niets.

### De secties voor experts

Onder het voorbeeld en de rollen staan vier ingeklapte secties. Elke sectie opent met `#/start?area=color&focus=<name>`:

- **Explore shades & harmonies** (`focus=generate`).
- **Shade curves** (`focus=curves`) verandert een tintreeks punt voor punt, met afzonderlijke curven voor lichtheid, chroma en tint (L / C / H). De tinten worden tijdens het slepen opnieuw getekend.
- **Contrast** (`focus=contrast`): **Contrast-lock** past de toonwaarden van een tintreeks aan om APCA-doelen te halen tegen een achtergrond die je kiest, en **Rotate hue** draait de hele tintreeks rond de kleurencirkel.
- **Print** (`focus=print`) stelt in wat de primaire kleur op de drukpers wordt: de automatische waarde, een vastgezette CMYK-opbouw of een benoemde steunkleur.

### Het palet en elk kleurstaal

Het palet vermeldt je kleuren in inklapbare groepen, elk met een eigen **+ Add**. Je kunt groepen maken en hernoemen. Een rol maakt nooit een tweede tegel; de tegel waarnaar een rol verwijst, toont de naam van de rol, zoals **Primary**. **Colour chart** onder de tegels toont dezelfde kleuren op de OKLCH-**Wheel** (sleep een stip om de kleur te wijzigen, klik op lege ruimte om een kleurstaal toe te voegen) en het diagram **Gamut**, dat toont waar het weergeefbare bereik eindigt. `#/start?area=color&focus=chart` opent het diagram.

![Het paletpaneel, met elke groep inklapbaar](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![De OKLCH-kleurencirkel - de hoek is de tint, de afstand naar buiten is chroma en de grijstinten staan op een lichtheidsschaal langs de zijkant](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Klik op een kleurstaal om de editor te openen:

- **Rename** hernoemt het kleurstaal.
- **Stel de kleur in** met OKLCH-schuifregelaars, of in **Hex**, **HSL**, **RGB** of **CMYK**. Het waardeveld leest en schrijft in de actieve kleurruimte. CMYK stelt hier de schermkleur in via conversie; gebruik **Print substitutes** om exacte inkten vast te zetten.
- **Stored as** kiest hoe het kleurstaal wordt opgeslagen: **LCH** (de standaard, perceptueel en met een breed kleurbereik), Hex, RGB of HSL.
- **Use as** geeft het kleurstaal een rol, in de eigen woorden van het design system waar die bestaan. Druk opnieuw op een gemarkeerde rol om de rol te wissen.
- **Print substitutes** (ingeklapt): zet **CMYK** vast van **Auto** naar exacte inktwaarden, of stel een **Spot colour** in met een **Name** (zoals `PANTONE 186 C`), een optioneel **Book** en een **Finish** voor folie, verhoogd reliëf, verdiept reliëf, plaatselijke lak, soft touch of een stanslijn, rillijn of perforatie. Een drukpers gebruikt deze vergrendelingen wanneer je een CMYK PDF of TIFF exporteert; zie [Kleurprofielen](/info/exporting.html#colour-profiles). Een steunkleur wordt op een eigen plaat gedrukt in een Print PDF; zie [Steunkleuren als proceskleuren](/info/exporting.html#spot-inks-as-process) om elke steunkleur voor één export als proceskleur te drukken.
- **In other spaces** (ingeklapt): een waarde per kleurruimte, afgeleid of door jou ingevoerd. Een zelf ingevoerde waarde heeft voorrang bij het exporteren.

**Een kleurstaal verwijderen** is veilig. Afgeleide tinten en themarollen worden verborgen, zodat niets dat ze leest stukgaat. Kleuren die je hebt toegevoegd, worden verwijderd.

::: details Werken met veel kleurstalen
Een kleurstaal toont in rust zijn kleur, naam en hexwaarde. Select toont op elk scherm het selectievakje en de sleepgreep van elk kleurstaal, en een tegel met toetsenbordfocus toont ook zijn greep. Sleep een greep om binnen een groep te herordenen, of geef de greep focus, druk op Space, gebruik de pijltjestoetsen en druk opnieuw op Space om los te laten; Escape annuleert. Op een telefoon toont het palet vier kleuren per rij. Gebruik de bediening **Group** in de editor om kleuren tussen groepen te verplaatsen, of selecteer er meerdere en gebruik **Move to**.

Selecteren heeft geen aparte schakelaar nodig: de balk en de selectievakjes verschijnen bij de eerste geselecteerde tegel en verdwijnen bij de laatste.

- **Sleep over lege ruimte** om een rechthoek te tekenen; elke tegel die hij raakt, komt bij de selectie, ook in andere groepen. Een ingeklapte sectie voegt niets toe.
- **Shift-klik** selecteert een bereik in leesvolgorde, **Cmd/Ctrl-klik** wisselt de selectie van één tegel en een gewone klik opent de editor.
- Elke groepskop heeft **Select all**, en **Cmd-A** met focus op een tegel selecteert elke eigen kleur, nooit een startkleur.
- Het raster heeft één tabstop: pijltjes verplaatsen, Shift-pijltjes breiden uit, Space wisselt de selectie, Delete verwijdert en Escape wist de selectie. Druk eerst op `l`, `c` of `h` om een kanaal stapsgewijs aan te passen.
- Houd op een aanraakscherm een tegel ingedrukt om een selectie te starten en tik daarna om toe te voegen.

De balk toont **{n} selected**, gevolgd door **Move to**, **Give a role** (elke kleur krijgt om de beurt de volgende rol), **Download** (de selectie in een van de zes paletformaten), **Duplicate** (een kopie van elk, geplaatst na het origineel), **Copy values** en **Delete**. Eén kopie opent in de editor; meerdere blijven geselecteerd. Eén Cmd/Ctrl-Z maakt een bulkactie ongedaan.
:::

### Kleurverlopen

Het optionele paneel **Gradients** bouwt mengtokens op uit het palet. Elk kleurverloop heeft een voorbeeld, 2 tot 8 benoemde stops en een hoek. Een stop verwijst naar een kleurstaal, dus als je de kleur van het staal wijzigt, volgt het kleurverloop. Mengen gebeurt in OKLCH.

De paletdownloads (design tokens, CSS, SCSS, GIMP en Adobe Swatch Exchange) staan bovenaan het palet. [Neem je palet en lettertypen overal mee naartoe](/info/using.html#take-your-palette-and-fonts-anywhere) beschrijft elk formaat.

<!--i:eti-type-->
## Typografie

Zonder eigen lettertype toont de ruimte één kaart: **Primary**, gezet op leesgrootte in het huidige lettertype, met een label **Starter**, een knop **Choose for Primary** en de regel *"Er wordt niets geïnstalleerd totdat je er een kiest."* Koppen, code en cursief volgen het primaire lettertype totdat je ze kiest; **Choose them separately** toont hun kaarten.

![De ruimte Type zonder gekozen lettertype - één kaart op leesgrootte, met een label Starter en één ingekleurde Choose for Primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Kies één lettertype en de ruimte klapt uit tot vier rolkaarten, de lijst Fonts en een live letterproef:

- **Primary**: lopende tekst, knoppen en elke tool.
- **Headings**: het displaylettertype voor `h1` en `h2`.
- **Code**: een lettertype met vaste tekenbreedte voor code en gegevens.
- **Italic**: een echte cursief voor nadruk, citaten en terzijdes.

Een kaart is alleen getint waar je dat lettertype hebt geïnstalleerd. De knop toont de rol: **Change Headings** bij een eigen lettertype en **Choose for Headings** overal elders. De voorbeeldregel loopt door op de volgende regel. Niets op een kaart legt een wijziging vast; de knop opent de vergelijkingsweergave voor die rol.

![De vier rolkaarten uitgeklapt - elk gezet in het bijbehorende lettertype, met een label Starter waar niemand er een koos en Italic dat het primaire lettertype volgt](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### De vergelijkingsweergave

De weergave opent onder de kaart waarop je drukte. De kaarten klappen in tot een strook van één regel, zodat de weergave op het eerste scherm van een telefoon past. Escape annuleert en zet de focus terug op de kaart.

1. Druk op **Choose for** en de rol op de kaart.
2. Typ een familienaam en druk op **Preview**, of druk op een van de zes **Pinned** families onder het veld.
3. Druk op **Use this face**.

![De vergelijkingsweergave geopend onder de kaart, met de zoekrij, de vastgezette families en de kaarten ingeklapt tot een strook van één regel](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**Toestemming wordt één keer gevraagd.** De eerste keer dat een voorbeeld Google Fonts benadert, legt een dialoog uit: *Google krijgt de familienaam en je IP-adres te zien. Het bestand wordt daarna op dit apparaat bewaard en offline gebruikt. Dit is de enige stap in de studio die een derde partij benadert.* **Fetch from Google** gaat door en wordt onthouden. **Cancel** laat de kaart *"Niet opgehaald. Er is niets naar Google verstuurd."* tonen, met een eigen **Fetch from Google**.

**Sleep een lettertypebestand naar de vergelijkingsweergave** (TTF, OTF of WOFF) om een voorbeeld te bekijken van een lettertype waarvoor je een licentie hebt. In beide gevallen blijft het lettertype op dit apparaat, rendert het offline in de app, de tools en elke export, en reist het mee in het bestand van het design system. Alles op Google Fonts wordt geleverd onder een open licentie (OFL, Apache of UFL).

### Lettertypen op dit apparaat

Het paneel **Fonts** vermeldt elk lettertype op dit apparaat en de rol die het vervult. Lettertypen die je hebt toegevoegd staan vooraan, onder **In the design system**, elk met zijn rollen en een verwijderknop. De startlettertypen volgen in één gedempte, ingeklapte rij. **Add a face** opent de vergelijkingsweergave voor elke rol. Het paneel **Type roles** toont een live letterproef van elke rol met de familie en status, zoals *Inter* of *Inter · volgt Primary*.

<!--i:eti-tag-->
## Tokens

Tokens zijn de benoemde waarden achter het design system: kleuren, lettertypen, logo's, hoeken en tussenruimte. Tools lezen ze op naam, dus een wijziging hier bereikt elke tool tegelijk.

![De ruimte Tokens: bovenaan een voorbeeld uit het systeem en de bestandsacties, tegels die elk type token tellen, gevolgd door de kleurparen met hun contrastmetingen](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **De kop** geeft een voorbeeld uit je eigen systeem (*Primary is Spearmint, #033633*) en de bestandsacties: **Download** (het systeem als design tokens, of het palet in vijf andere formaten), **Copy CSS** en **Add from…** om een JSON-bestand weer in te lezen.
- **Tegels** tellen elk type token en springen naar de bijbehorende sectie: Colours, Type, Logos, Shape and spacing, More en All tokens. Een sectie met alleen wat bij het lege startsysteem hoort, draagt een label **Starter**; een systeem dat met de app is meegeleverd telt zijn eigen materiaal zonder het label. Op een telefoon staan de tegels in twee rijen van drie.
- **Colours** begint met de paren die tools samen gebruiken (tekst op achtergrond, op primaire kleur, gedempt op achtergrond) met een APCA-meting in licht en donker, en markeert **Weak contrast** waar een paar tekortschiet. Daarna volgt elke kleurgroep: een tintreeks als één rij chips, andere kleuren met hun waarde en de verwijzing die tools gebruiken, zoals `{color.brand.spearmint}`. Druk op een verwijzing om die te kopiëren. **Edit in Colours** opent een groep in de ruimte Colours. Bij een design system met [kleurrollen](#colour-roles-what-the-colours-are-called) komt **Colour roles** eerst, met elke rol één keer in de eigen woorden en volgorde van het systeem. Een rol bewaart een kleur voor elke colourway en look. Die kleuren staan bij de rol, niet als afzonderlijke kleuren; wijzig ze in de tabel Colour roles.
- **Type** en **Logos** vermelden het lettertype voor elke rol en elke logopositie, met **Edit in Type** en **Edit in Logos** zodra je eigen materiaal hebt.
- **Shape and spacing** bevat **Rounded corners** (`shape.radius`) en **Spacing rhythm** (`space.base`). Elk toont *Lolly default* totdat je de schuifregelaar verplaatst en daarna *Yours*, slaat direct op en kan ongedaan worden gemaakt.
- **More tokens** voegt tussenruimte, afmetingen, lijndikte, dekking, rotatie, gewone getallen en schaduwen toe, opgeslagen als standaard [design tokens](/info/design-tokens.html).
- **App appearance (advanced)** vermeldt de kleuren, afmetingen en schaduwen die Lolly's eigen schermen gebruiken, en **Inspect every token (advanced)** doorzoekt en bewerkt elke opgeslagen waarde en toont elke wijziging eerst ter beoordeling. Daar staan de waarden van een kleurrol in elke colourway bij de rol: kies het token van de rol om één rij per colourway te zien, met licht en donker naast elkaar. De telregel zegt hoeveel waarden de rollen bevatten. Een alleen-lezen design system toont dezelfde lijst.

Een lege sectie biedt **Pick a colour**, **Choose a face** of **Add a logo**.

<!--i:eti-images-->
## Bestanden

Sleep de bestanden die je merk bewaart, naast logo's: **vector**-, **afbeeldings**-, **audio**- en **bewegingsbestanden** (video, Lottie en animaties). Ze verschijnen in [Assets](/info/using.html#assets-your-library), gesorteerd in secties, en in de assetkiezer van elke tool. Ze blijven op dit apparaat.

## Geluid

**Sound** kies je door te luisteren. De ruimte opent met drie startgeluiden, **Calm**, **Steady** en **Bright**, elk een kaart in de kleuren van zijn genre met een afspeelknop. Speel er een af om een kort fragment te horen; als je een ander start, stopt het eerste. **Choose** maakt dat geluid het geluid voor elk gebruik. De vierde kaart, **Mixed**, geeft elk gebruik een eigen geluid: Calm voor Explain, Steady voor Demonstrate en Bright voor Play. De afspeelknop speelt de drie na elkaar af. Er wordt niets opgeslagen totdat je **Save sound** kiest. Het geluid wordt dan onderdeel van dit design system, met een controlepunt in dezelfde geschiedenis die de andere ruimtes gebruiken. Een design system zonder geluid blijft werken zoals voorheen.

Een gebruik is een moment waarop het geluid speelt: om te beginnen **Explain**, **Demonstrate** en **Play**. Elk gebruik is een chip met een eigen afspeelknop. **Music** of **With narration** boven de chips stelt in of een chip alleen de muziek speelt of onder een stem. Het gebruik dat je kiest, toont zijn doel en muziek in gewone woorden, bijvoorbeeld "Warm · 84 bpm · Rhodes, rollende bas, stoffige drums". Elk gebruik neemt het genre, het tempo en de instrumenten van het gekozen geluid over (of, bij Mixed, zijn eigen). Elk gebruik behoudt zijn eigen melodie en balans: Explain houdt de melodie uit de weg van een stem en Play laat de melodie vooropstaan. Wisselen tussen Mixed en één geluid behoudt beide. Een gebruik dat je zelf hebt toegevoegd, behoudt onder Mixed zijn huidige geluid. Het design system legt vast welke je koos. **Add a use** voegt er een toe en laat je ter plekke de naam typen. **Make main** kiest het gebruik dat wordt afgespeeld wanneer er niets anders wordt gevraagd. **Another tune** speelt een nieuwe compositie met dezelfde instellingen.

**Edit in the music generator** opent de [muziekgenerator](/info/generated-music.html#the-music-generator) met de instellingen van dat gebruik, met bovenaan een regel die zegt wiens geluid je bewerkt. **Save to this use** brengt de instellingen terug naar de ruimte; **Cancel** keert terug zonder wijzigingen. Niet-opgeslagen keuzes in de ruimte blijven wachten terwijl je weg bent. Als iemand ondertussen het geluid in een ander tabblad opslaat, blijft die nieuwere versie gelden en wordt je bewerking niet meegenomen.

**Voice** kiest een stem voor het gebruik, de spreeksnelheid en hoe luid de muziek onder de stem klinkt; **Hear the voice with the music** speelt beide af. Onder **More** staan de volumedaling tijdens het spreken, de woorden om te proberen (die blijven in de ruimte), uitspraaknotities (één per regel, als geschreven = gesproken) en notities over de stem. Voorbeelden gebruiken het lokale spraakmodel en dezelfde mix als een sequentie-export. Een voorbeeld wordt uitgefade; het is geen gecomponeerd einde.

**Notes and signature** bevat waar je bij een gebruik op moet letten tijdens het luisteren en een geluidssignatuur: een vast begin of einde dat als eigen audiobestand wordt bewaard. Plaats de signatuur in je sequentie; gegenereerde muziek bevat nooit de signatuur. Een vereiste die deze versie van Lolly niet kan controleren, blokkeert nieuwe muziek voor dat gebruik.

**Details** bevat het karakter van het merk (hoe het geluid moet aanvoelen, wat hetzelfde blijft en wat je moet vermijden) en de luisterbeoordeling. **Record a listening review** bewaart de naam van de beoordelaar, de datum en de notities bij de opgeslagen versie van het geluid. Elke wijziging maakt het geluid opnieuw een concept. Een beoordeling geldt voor die versie, niet voor elke melodie die later met het geluid wordt gemaakt: luister naar elk nieuw stuk voordat het wordt uitgebracht.

**Make a music project** opent het gebruik in de muziekgenerator als een project dat het gebruik, de versie van het geluid en de exacte instellingen bewaart. **New tune** maakt daar een nieuwe compositie en behoudt het geluid. Als je de instellingen wijzigt, zet **Put the sound back** het geluid terug en gaat **Keep as my own** verder met een onafhankelijke melodie. Totdat je kiest, kan het project niet worden opgeslagen of gedownload als gemaakt met het geluid. Deellinks bevatten alleen de muziekinstellingen. Het project en een opgeslagen melodie bewaren ook de notities bij het geluid. Die blijven buiten deellinks en de openbare herkomstgegevens van het audiobestand. Bewaar een gerenderde opname wanneer de exacte audio toekomstige versies van de generator moet overleven.

<!--i:eti-checklist-->
## Regels

**Rules** stelt in wat mensen kunnen wijzigen, wat vaststaat en wat Lolly kan controleren.

![Rules in Lolly Demo: vier huisstijlregels, elk gemarkeerd als Checked in Design en Required of Advisory, gevolgd door Try your design system in use met voorbeelden klaar om te renderen](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** vermeldt je regels. **Add rule** (of **Add your first rule**) opent een kort formulier:

- een **Rule name** in je eigen woorden, zoals *Beacon-accenten*;
- de **Check**: **Colour choices**, **Font choices**, **Fixed artwork** of **Text length**, met de merkrol die wordt gebruikt, onder je eigen naam voor die rol;
- het **Example** waarop de regel van toepassing is (Poster, Title slide, Content slide of Lolly Chart), de **Mode** en of de regel **Required** of **Advisory** is;
- **Reviewed by**, gevolgd door **Save draft** of **Approve & save**.

Goedkeuring legt je eigen beslissing vast op dit apparaat. Goedgekeurde verplichte regels beperken de herbruikbare poster en controles gelden alleen voor de voorbeeld-PNG's; ze veranderen geen andere tool.

Regels in het tokenbestand van een design system, zoals goedgekeurde kleurcombinaties, tekstgewicht en uitlijning of een logo per achtergrond, staan hier vermeld als **Checked in Design**. Lolly Design controleert ze laag voor laag in de kaart **Before you export** van het exportpaneel, en `lolly check` doet hetzelfde voor een opgeslagen Lolly Design-document ([Voordat je exporteert](/info/design.html#before-you-export)). Een regel waarvoor deze build geen controle heeft, wordt bewaard zoals aangeleverd en gemarkeerd als **Unchecked**.

Lolly Demo bevat vier goedgekeurde huisstijlregels. Koppen worden nooit in hoofdletters gezet: die regel is verplicht, dus `lolly check` meldt een kop in hoofdletters als fout. De andere drie zijn adviezen. Lopende tekst is links uitgelijnd. Primaire beeldmerken staan op lichte achtergronden en diapositieve beeldmerken op donkere. Onderbroken lijnen betekenen hier neerzetten.

**Try your design system in use** rendert vier voorbeelden uit de huidige revisie met **Render & check examples**. Kies een **Mode** en **Try your own text** voor de kop, ondersteunende tekst en diatekst. Elk voorbeeld meldt wat er is gemeten, met **See checks & sources** en **Download check report**. **Make reusable poster** downloadt een `.lolly` met de vaste lay-out en goedgekeurde invoerkeuzes. Voorbeelden zijn lokaal: een controle uitvoeren publiceert en keurt niets goed.

Een build die met een vast merk wordt geleverd, toont dezelfde regels en voorbeelden als alleen-lezen, onder *This brand is set*.

<!--i:eti-graduation-cap-->
## Skills

**Skills** vermeldt de [merkskills](/info/brand-skills.html) van het actieve design system: de geschreven normen van het merk, één per discipline, voor mensen en AI-agents. Elke rij vermeldt de discipline, de eigen status van het merk (**Draft** of **Approved**), of de skill openbaar of intern is en de revisie. Kies een rij om de skill te lezen met de dekking, die de regels van de skill vergelijkt met je tokens: wat Lolly controleert, wat botst, wat overeenkomt en wat alleen richtlijnen zijn.

**Download skill (.zip)** schrijft de skill als een Agent Skills-map voor een agenttool, met cataloguslinks die naar deze Lolly verwijzen. **Copy as one file** zet dezelfde tekst op het klembord voor een chatvenster. Een design system zonder eigen skills vermeldt een basisversie die Lolly telkens bij het lezen schrijft op basis van zijn tokens en huisstijlregels. De ruimte leest skills en bewerkt ze nooit.

<!--i:eti-upload-->
## Een merk importeren

**Add from…** in de balk opent een kiezer die vraagt wat je hebt, niet in welk formaat:

- **Design tokens or a design file**: DTCG- of Tokens Studio-JSON, een Penpot-project, een zip met tokensets, een Lolly-pakket met een design system, een SVG, een `DESIGN.md` of een map met een merkpagina.
- **PDF**: een deck of een bestand met richtlijnen, dat op dit apparaat wordt gelezen op kleuren, beeldmerken en ingesloten lettertypen.
- **Logo or screenshot**: een afbeelding wordt een voorgesteld palet, gelezen op dit apparaat. Het leest kleuren, niet het lettertype of de lay-out.
- **Saved web page**: één HTML-bestand en de bijbehorende CSS-bestanden, of geplakte HTML of CSS, tot 20 bestanden en 2 MB. Alleen de tekst die je aanlevert wordt gelezen: gekoppelde bronnen worden niet opgehaald en scripts worden niet uitgevoerd.
- **Font file**: TTF, OTF of WOFF. Opent de ruimte Type, waar het lettertype wordt geïnstalleerd.
- **Website**: één pagina, gelezen op kleuren en typografie. Deze tegel verschijnt alleen op een apparaat dat een pagina kan lezen en vermeldt welke lezer wordt gebruikt: de app op dit apparaat of de browserextensie in een achtergrondtabblad, aangemeld als jij. Een URL typen vult alleen het veld in; drukken op ophalen geeft toestemming.

Kies de bron voor ontwerpbestanden en de volgende kaart vermeldt de ondersteunde formaten als tegels met pictogrammen. De kaart is één neerzetgebied. Je kunt een bestand ook naar de studio slepen.

![De importkaart - de ondersteunde formaten staan vooraan als tegels met pictogrammen en de hele kaart is één neerzetgebied](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- Een **Lolly-pakket met een design system** (`.lolly`, of een oudere `.zip`) wordt in één stap geïnstalleerd.
- Een **Penpot**-export (`.penpot`) brengt zijn design tokens mee.
- Een **Design Tokens**-bestand (W3C DTCG) of **Tokens Studio**-bestand (`.json`) brengt zijn tokens mee. Een beschrijving die een lezer vraagt instructies te negeren, rechten claimt of vraagt code uit te voeren, wordt weggelaten en de import vermeldt waar die stond.
- Een **gewone SVG** wordt gescand op kleuren waaruit je kiest. De eerste wordt je primaire kleur.
- Een **`DESIGN.md`** (`.md`) gaat naar **Try these colours** met zijn tokens zoals geschreven. De tekst kan als conceptmerkskill worden bewaard en de kaart markeert regels die een lezer vragen instructies te negeren, rechten te claimen of code uit te voeren. Agents en merkpagina's zien een concept pas wanneer je op **Keep this skill** drukt in de ruimte Skills, en een bewaarde skill blijft intern.
- Een **map met een merkpagina**, gekozen als map, neergezet of gezipt, gaat naar dezelfde beoordeling. Elk bestand wordt gecontroleerd aan de hand van de `brand.json` van de map; één bestand dat niet overeenkomt, leidt tot weigering van de hele map. De import voegt de tokens toe. Logo's en lettertypen blijven in de map.

::: warning De instructiecontrole leest regel voor regel
De controle die instructies uit beschrijvingen in een tokenbestand weglaat, leest regel voor regel en mist andere formuleringen. Lees een bestand van iemand die je niet kent voordat je de tokens toepast.
:::

Lolly leest een merkpagina uit bestanden die je aanlevert. Het haalt geen adres van een andere site op.

### Een bestand met eigen kleurwoorden

Een tokenbestand of een `DESIGN.md` kan eigen woorden voor zijn kleuren gebruiken, zoals main, accent, supporting en tertiary. Wanneer Lolly zulke woorden vindt, vermeldt het overzicht elk woord voordat er iets wordt toegepast: het woord, de kleur in elke look, het token waaruit het kwam en de interpretatie die Lolly voorstelt. Lolly stelt interpretaties voor op basis van alleen de woorden, aan de hand van een korte lijst, zonder model. Een woord dat niet op de lijst staat, komt binnen als een eigen woord van het merk, **By name only**. Je kunt elk woord hernoemen, aangeven waarvoor het dient, een andere interpretatie geven of het vinkje uitzetten om het als benoemde kleur te behouden.

**Install with these roles** schrijft de rollen; **Install without roles** installeert het bestand zoals het is aangeleverd. Een bestand zonder zulke woorden slaat deze stap over. Een bestand dat zijn eigen rollen vermeldt, zoals een bestand dat Lolly schreef, toont ze zoals geschreven en installeert ze ongewijzigd; je kunt ze later bewerken in de ruimte Colours. De terminal heeft geen beoordeling: `lolly system import` bewaart een opgegeven record en laat de woorden van andere bestanden als benoemde kleuren staan.

### Een referentie beoordelen

Een logo, screenshot, website of opgeslagen pagina opent **Try these colours**: een voorbeeld in de voorgestelde kleuren, een **Main colour** die je kunt wijzigen en een naam voor een nieuw systeem. Een vak zegt wat toepassen doet: het **vervangt** de actieve tokeninstellingen door het gegenereerde palet en de standaardstijlen, **behoudt** je lettertypen en bibliotheekbestanden en het vorige systeem kan worden **hersteld**. **Apply suggested settings** maakt een controlepunt en past daarna het lichte en donkere palet toe. **Restore brand settings** kan de oude instellingen terugbrengen. **Change reference** kiest een andere bron.

::: details Wat een referentie leest en het ontwerpcontextrapport
**Palette, source details and individual choices** toont wat is gelezen, eventuele gevonden lettertypenamen en het contrast van het voorbeeld. Lettertypenamen zijn alleen suggesties; je installeert een lettertype in Type. De brongegevens kunnen typografie, tussenruimtes, opvulling en hoekwaarden bevatten waar die zijn waargenomen, anders gemarkeerd als **Not observed**. Een opgeslagen pagina of een website die door de native app wordt gelezen, rapporteert gedeclareerde stijlen, die de pagina mogelijk niet gebruikt. De browserextensie kan gemeten stijlen rapporteren op basis van een steekproef van zichtbare elementen. Dit zijn waarnemingen: er wordt niets geïnstalleerd en tussenruimte uit de bron vervangt nooit je eigen tussenruimte. **Choose individual items in the tray** bewaart afzonderlijke items. **Download design context** slaat een JSON-rapport op met waarnemingen, voorgestelde tokens en broninformatie (met een SHA-256 van aangeleverde HTML of CSS). Het rapport bevat geen ruwe paginatekst en is geen ondertekende Content Credential.
:::

Imports van PDF's en ontwerpbestanden behouden hun eigen beoordelingsbediening. Items in de **Tray** veranderen niets totdat je ze toevoegt in de ruimte die dat type materiaal beheert. `#/start?source=<kind>` opent de kiezer op een bron (`file`, `pdf`, `image`, `font`, `url`, `page`) en `?import` opent de gewone lijst.

### Een look vinden en vergelijken

Open **Find a look** vanuit het Board of vanuit de lijst met design systems in Settings. Blader door systemen die op dit apparaat zijn opgeslagen en enkele herbruikbare Lolly-voorbeelden, en zoek op naam, kleurtag of gedeclareerd lettertype. **Closest to my current palette** sorteert op gemeten kleurgelijkenis, waarbij overeenkomende lettertypen bij gelijke scores de doorslag geven; het is geen kwaliteitsscore.

Klik op een look om een voorbeeld in context te bekijken; een voorbeeld bekijken verandert niets. **Use this look** op een kaart past die look toe. Een opgeslagen systeem wordt het actieve systeem, wat niets bewerkt. De kleuren van een voorbeeld gaan na het gebruikelijke controlepunt naar het geopende design system. De logo's, lettertypen en al het andere dat het voorbeeld niet definieert, blijven zoals ze zijn. **Compare looks** voegt aan elke kaart een selectievakje toe: kies er twee om naast elkaar te vergelijken. **Restore brand settings** herstelt de vorige look. Opgeslagen systemen hebben bewerkbare **Search tags** onder **Details and design context**. De voorbeelden zijn originele kleurrecepten van Lolly, zonder een gescrapete collectie en zonder account.

![Lolly vergelijkt Sunroom en Orchard naast elkaar voordat je een van beide kleursystemen toepast.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

<!--i:eti-package-->
## Je design system bewaren en verplaatsen

### Een merk tussen apparaten verplaatsen

**Export** schrijft één **`LollyBrand-….lolly`**-bestand: je tokens, lettertypen, logo's en themavoorkeur, met een integriteitsmanifest dat bij het importeren wordt gecontroleerd. Webversies vóór 1.0.7 noemden het bestand `.zip`, en Lolly accepteert die schrijfwijze nog steeds. **Tokens (.json)** schrijft het gewone document met design tokens, zonder lettertypen of logo's, voor een repository, een buildstap of een andere tokentool.

Gebruik **Add from… → Design tokens or a design file** om er een terug te importeren, of sleep het bestand naar de studio. Zo geeft een collega je een merk of neem je er een mee naar een tweede installatie, zonder account en zonder cloud. [Werken met partners](/info/partners.html) behandelt wat je nog meer moet meesturen wanneer de ontvanger van je merk voor een andere organisatie werkt. Zie [`ingest:brand`](/info/configuration.html#brand-packs) om een merk via de opdrachtregel te importeren.

**Fonts for Linux (.rpm)** verpakt de lettertypen die je hebt toegevoegd in een installeerbare RPM. Als je er zelf hebt geüpload, vraagt Lolly je eerst te bevestigen dat je ze opnieuw mag verspreiden.

### Eerdere instellingen herstellen

Open **More** in de balk, kies **Restore brand settings**, selecteer een gedateerd controlepunt en druk op **Restore**. Dit herstelt kleuren, typografie-instellingen en andere tokens voor het actieve merk; lettertype- en afbeeldingsbestanden blijven zoals ze zijn. Lolly slaat je huidige instellingen eerst op als **Before restore**, zodat je een herstelactie kunt terugdraaien, zelfs nadat je de browser hebt gesloten. De laatste 20 controlepunten worden op dit apparaat bewaard. Een bewerking die je maakt terwijl de studio **Saving…** toont, overleeft een herlaadactie, en een kaart biedt aan om wijzigingen te herstellen die niet volledig waren opgeslagen.

### Versies

Een gepubliceerde versie is een **permanente, benoemde kopie** die op dit apparaat wordt bewaard. Ze verandert nooit, dus een tool of link die haar vastzet (met `designv`) blijft hetzelfde tekenen. Een systeem met eigen materiaal vermeldt **Versions & publishing** in het menu **More** van de balk; na je eerste publicatie verschijnt **Versions** bij de ruimtes. `#/start?area=versions` opent Versions.

::: warning Een gepubliceerde versie is permanent
Verwijderen kan nog niet en het paneel vermeldt dat. Publiceren kan niet ongedaan worden gemaakt; herstellen wel. *Restore latest from this version* is een gewone bewerking, waarbij **Undo** meteen wordt aangeboden.
:::

**Verwijderingen staan bovenaan de compatibiliteitskaart**, omdat een verwijderd token een tool stukmaakt.

**Publish only** bewaart een versie zonder te veranderen wat tools volgen; **Publish and make active** laat tools en de app die versie volgen. **Follow the latest again** maakt elke bewerking direct actief.

### Een merkpagina publiceren

Een [merkpagina](/info/brand-page.html) is één adres voor mensen en agents: een pagina met logo's, kleuren, typografie en voorbeelden, met dezelfde feiten in bijbehorende bestanden. **Publish a brand page**, onder Versions & publishing, toont de live pagina en daarnaast:

- **Goes public**: elk bestand, gegroepeerd, met de grootte.
- **Held back**: wat is weggelaten en waarom. Een logo zonder vastgelegde licentie blijft weg totdat je de naam van het logo aanvinkt. Een lettertypebestand heeft een vastgelegde licentie nodig die verspreiding toestaat, en de pagina toont een letterproef in contouren wanneer het bestand wordt weggelaten. Interne merkskills verschijnen nooit.
- **What was checked**: kleurparen per colourway en modus, en de huisstijlregels. Dit zijn metingen, geen oordeel.
- **In your words**: een gebruiksverklaring en een contactpersoon. De pagina toont wat je schrijft en Lolly voegt geen licentie of juridische claim toe. Een schakelaar zet de regel "Made with Lolly" in de voettekst uit.
- **On exports**: een schakelaar die [het adres van de pagina vastlegt in de exports van dit design system](/info/brand-page.html#lead-back-from-your-files). De schakelaar staat uit totdat je hem aanzet, vereist een `https`-adres en reist niet mee met een pakket of kopie. Een vergrendeld design system toont de schakelaar niet, omdat de beheerder beslist.

**Download folder** slaat de map op als ZIP zodat je die kunt hosten waar je wilt. Er wordt niets openbaar totdat je de map host. In een terminal schrijft `lolly system publish --out=<dir>` dezelfde map. Een instantie die merkpagina's aanbiedt, biedt ook **Publish to** naar haar adres: één uitdrukkelijke druk, via de goedkeuringsketen van de instantie als die er is. Een beheerd design system publiceert alleen wanneer de beheerder dat toestaat.

### Een agent verbinden

**Connect an agent**, op dezelfde plek, geeft je tekst om te plakken en zegt wat elke optie kan:

- **`AGENTS.md`** in een project: agents lezen de namen en regels van het systeem. Het tekent niets en heeft geen server nodig.
- **De openbare server van Lolly**: tekent met Lolly Demo, ongeacht welk systeem je hier open hebt. Er is geen sleutel nodig.
- **Je instantie**: tekent met de systemen die de instantie bevat en leest een servicetoken uit een omgevingsvariabele. Het paneel geeft de naam van de variabele en toont nooit een token.

Wanneer geen gehoste server met je systeem tekent, vermeldt het paneel dat.

<!--i:eti-layers-->
## Je design systems beheren

Open **Settings → Preferences → Design systems** om systemen te wisselen, toe te voegen of te verwijderen. **Open** selecteert een systeem en opent het hier; **Make a new one** maakt een lokaal systeem en opent het met het naamveld klaar voor invoer. Er is steeds één systeem actief, voor het hele apparaat. [Merkarchitecturen](/info/brand-architectures.html) helpt bepalen wanneer een merk een eigen design system nodig heeft.

**Waar een systeem vandaan komt.** Het systeem dat de catalogus van een implementatie levert, toont **Came with this app**, of **From this instance** in een app die met een instantie is verbonden. Klap **Catalogue source** uit om te zien wie het levert, wat de tokenasset en naamruimte zijn en welke versie of controlesom bekend is; als verversen mislukt, wordt materiaal uit de cache gemarkeerd.

**Beheerde systemen zijn alleen-lezen.** Een systeem toont **Managed by this instance** (of **Managed by this app** in de desktopapp zonder instantie) wanneer de catalogus het systeem vergrendelt. Je kunt een beheerd systeem gebruiken en downloaden. Als je er hier een opent, zie je een melding dat het alleen-lezen is met **Make an editable copy** en **Switch**, gevolgd door de kleurrollen en tokens zonder bewerkingsbediening. Je eigen lokale systemen blijven bewerkbaar, ook wanneer het beheerde systeem er eerst was. Een build met één vast merk opent Lolly Design System Setup op *This brand is set*, met de tokens en gebruiksregels van het merk om te lezen.

**Elk ander meegeleverd systeem is van jou** om te verbergen, te bewerken en te resetten, inclusief Lolly Demo en Lolly Starter op lolly.tools. Een bewerking behoudt de naam en markeert de rij als **Edited here**. **Reset to original** in het menu verwijdert de wijzigingen die op dit apparaat zijn gemaakt. Het lege startsysteem is de uitzondering: een eerste wijziging daar begint een eigen design system, en Lolly vraagt één keer om de naam. [Lolly Demo in gebruik](/info/lolly-demo-in-use.html#switch-to-your-own) toont wat je eigen systeem vervangt.

### Een design system verwijderen

Kies **Remove** in het menu van een systeem; de bevestiging zegt welk systeem daarna actief zal zijn. Opgeslagen sessies, uploads en materiaal dat met een ander systeem wordt gedeeld, blijven behouden.

Een meegeleverd systeem verwijderen verbergt het alleen: de catalogusassets blijven, **Bring back** toont het opnieuw en het keert vanzelf terug als je al het andere verwijdert. Een geïmporteerde of bewerkte kopie verwijderen, verwijdert het meegeleverde systeem, zijn logo's of zijn lettertypen niet. Als de kopie actief was, wordt het meegeleverde systeem weer actief. Een actieve gehoste kopie verwijderen, wist alleen de verbinding van die kopie; een afzonderlijk gekozen instantie blijft geselecteerd.

::: details Een design system wijzigen dat een server levert
Wijzigen wat een server levert, is een beheerderstaak: de operator wijzigt de broncatalogus en implementeert opnieuw, of een Lolly Work-beheerder beoordeelt een serverwijziging en past die toe. Bewerkingen hier blijven lokaal, met één uitzondering. Op een Lolly Work-instantie die je `brand.edit` geeft, biedt een beheerd systeem ook **Edit for** die instantie, wat een bewerkingskopie opent. **Send to** die instantie in **Versions** stuurt de kleuren, colourways, kleurrollen en het adres van de merkpagina terug. [Deze instantie bewerken vanuit de studio](/info/work-design-system-administration.html#edit-this-instance-from-the-studio) behandelt wat een bewerking kan wijzigen en hoe de instantie de wijziging aanbiedt. Zie [Een design system uit de catalogus verwijderen](/info/configuration.html#removing-a-catalogue-design-system) en [Configuratie](/info/configuration.html#supplied-and-local-design-systems).
:::

<!--i:eti-code-->
## Ontwerpcontext buiten de app gebruiken

**Download design context** slaat het tokendocument, de bepaalde kleuren, gedeclareerde lettertypefamilies, asset-id's, bronbewijs waar vastgelegd, dekking en expliciete regels op, zonder lettertypebestanden en zonder eigendomsbewijs. De opdrachtregel leest het bestand zonder server: `lolly system import` maakt het tot het design system van de terminal en `lolly system check` controleert Lolly Design-invoer aan de hand van de opgeslagen context. [Je design system meenemen](/info/cli.html#bring-your-design-system) behandelt de import en [Welk design system een opdracht gebruikt](/info/cli-decks.html#which-design-system-a-command-uses) behandelt de controle. Een MCP-client leest dezelfde briefing uit `lolly://design-context` ([MCP Server](/info/mcp.html)).

<!--i:eti-map-pin-->
## Waar je verder kunt

- **[Lolly gebruiken](/info/using.html)**: de tools, opslaan, delen en Assets.
- **[Merkarchitecturen](/info/brand-architectures.html)**: hoe divisies, producten, merken met een afzendermerk, klanten en seizoenen zich verhouden tot design systems, colourways en logo-identiteiten.
- **[Werken met partners](/info/partners.html)**: je merk delen met een partner en werken in een merk dat je hebt gekregen.
- **[Merkpagina's](/info/brand-page.html)**: publiceer je design system op één adres, als perskit en agentkit.
- **[Design Tokens](/info/design-tokens.html)**: het tokenmodel waarin je merk is geschreven.
- **[Een bestand exporteren](/info/exporting.html)**: drukeenheden, CMYK en de formaten waarin je merk rendert.
