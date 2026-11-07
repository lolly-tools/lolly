# Lolly Design System Setup

<a id="design-system-setup"></a>

Je logo, kleuren en lettertypen horen op één plek, zodat elke tool, pagina en export ermee tekent. Die plek is **Lolly Design System Setup**, op `#/start`.

Begin met wat je hebt. Zet een logo erin en Lolly leest de kleuren ervan. Kies een lettertype, of zet het fontbestand erin waarvoor je bedrijf een licentie heeft. Elke wijziging is meteen in de hele app te zien. Je logo, lettertypen en tokens blijven op dit apparaat. Een Google Font kiezen is de ene stap die naar buiten reikt: Lolly vraagt eerst en haalt de familie dan één keer op.

Wanneer het er goed uitziet, geef je het design system een naam en druk je op **Export**. Je krijgt één `.lolly`-bestand om te bewaren, op een ander apparaat te openen of aan een collega te geven. [Lolly Settings](/info/dashboard.html#design-system) toont het actieve systeem alleen-lezen, en het omslag linkt hierheen om te bewerken.

## Maak het in vijf minuten van jou

::: timeline
- <!--i:upload--> **Zet je logo** op de neerzetzone in **Logos**. Lolly leest de vorm en de kleuren ervan.
- <!--i:palette--> **Gebruik deze kleuren.** De hoofdkleur van het logo wordt je primaire kleur, en een donkere neutrale kleur uit het logo wordt je tekstkleur.
- <!--i:font--> **Kies een lettertype** in **Type**: een Google Font, of een fontbestand dat je bezit.
- <!--i:pentool--> **Geef het systeem een naam.** Je eerste bewerking maakt een eigen design system, en Lolly vraagt één keer om de naam.
- <!--i:download--> **Export** schrijft het hele systeem als één bestand `LollyBrand-….lolly`.
:::

De balk bovenaan de studio toont de naam van het design system, en de naam is een veld dat je op elk moment kunt wijzigen: **Enter** bewaart een nieuwe naam en **Escape** zet de oude terug. Wanneer je eerste bewerking vraagt **What is this design system called?**, worden de woorden uit je logo ingevuld als het logo ze uitschrijft. **Save name** bewaart de naam; **Not now** houdt een tijdelijke naam totdat je er in de balk een typt. De naam labelt het systeem in Settings en wanneer je wisselt, en wordt de naam van het bestand dat **Export** schrijft.

## De kamers

De studio is een set kamers in geen vaste volgorde: niets is genummerd en niets wacht op iets anders. Op een desktop staan de kamers in één strook onder de balk. Op een telefoon verhuizen ze naar een balk langs de onderrand, waar een duim erbij kan, met de geopende kamer in beeld gescrold; het palettenblad en de tray komen boven die balk uit, en de balk gaat opzij terwijl je typt. Met een toetsenbord bereikt Tab de strook één keer, en de pijltjestoetsen, Home en End gaan van kamer naar kamer.

![De balk van de studio en zijn kamers: Board, Colours, Type, Logos, Tokens, Files, Rules en Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Kamer | Wat je daar doet | Linksleutel |
|---|---|---|
| **Board** | Zien wat het systeem bevat, met een deur naar elke kamer | `overview` |
| **Colours** | Kleuren toevoegen, ze rollen geven, tinten en een palet bouwen | `color` |
| **Type** | De vier lettertypen kiezen die de app, de tools en elke export lezen | `type` |
| **Logos** | Je merktekens plaatsen in elke oriëntatie en behandeling | `logos` |
| **Tokens** | Hoeken, tussenruimte, schaduwen en elke andere benoemde waarde | `tokens` |
| **Files** | De afbeeldingen, audio- en bewegingsbestanden die je merk bewaart | `catalogue` |
| **Rules** | De regels die je merk toepast, gecontroleerd op echte voorbeelden | `usage` |
| **Skills** | De geschreven standaarden van het merk voor mensen en agents, om te lezen en te downloaden | `skills` |

Link naar een kamer met `#/start?area=<key>`. De kamer Files behoudt de sleutel `catalogue`, Board behoudt `overview` en Rules behoudt `usage`, omdat een kamersleutel een blijvend contract is, en `?tab=` werkt nog als oudere alias. Een onbekende sleutel opent Board.

De **balk** bevat de acties voor het hele systeem in plaats van voor één kamer. **Add from…** haalt een merk binnen ([Een merk binnenhalen](#bring-a-brand-in)), en de **Tray** bevat wat een scan vond dat je nog niet hebt toegevoegd. **Export** schrijft het systeem als één bestand, en **More** bevat **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions & publishing**, **Restore brand settings** en **Design systems**, dat de lijst in Settings opent waar je wisselt ([Je design system bewaren en verplaatsen](#keep-and-move-your-design-system)). Elk verschijnt zodra er iets is waarop het kan werken. Op een telefoon verhuist **Add from…** naar **More** en toont **Export** zich als icoon.

## Board

Zolang nog niets is gekozen, biedt Board vier manieren om te beginnen. **Start from a reference** opent de bronkiezer voor een logo, screenshot, webpagina of ontwerpbestand, en **Pick a colour**, **Choose a face** en **Add a logo** openen die bediening rechtstreeks. Een ervan openen schrijft niets, en **Explore the tools** is er vanaf het begin.

Zodra iets van jou is, toont Board wat je hebt, met je eigen aantallen voorop. Colours geeft het aantal kleuren, met een gedempte `· N starter` waar overgenomen kleuren zichtbaar zijn; de strook zet je kleuren eerst, dan een haarlijn, dan de verbleekte starterkleuren. Colourways toont elke colourway als een klein tegeltje in de hoofdkleur. Type leest per rol en zet elke familie in zijn eigen lettertype (*Inter for headings*, met *Starter for the rest* op de regel eronder). Logos zegt hoeveel slots zijn gevuld (of **Not set**), Tokens toont de hoekradius en Files zegt **Nothing yet** zolang de bibliotheek leeg is. Elk blok opent zijn kamer.

Een design system dat met de app is meegeleverd en kan worden bewerkt, zoals Lolly Demo, heeft dat alles vanaf het begin: Board toont de kleuren, colourways, lettertypen en merktekens, met een tag **Came with this app** naast de kop.

### Starter en van jou

**Starter** is het woord voor alles wat met de app meekwam in plaats van gekozen te zijn. Een verse installatie bevat helemaal geen kleur, alleen één neutraal verloop van inkt naar papier, zodat vlakken, tekst en haarlijnen kunnen renderen voordat iemand iets beslist. Hetzelfde woord markeert overgenomen materiaal in elke kamer.

::: cols
## Starter

- Kwam met de app mee: de neutrale tinten van inkt naar papier, de starterlettertypen, de standaardhoekradius.
- Gedempt, met een tag **Starter** en zonder tint.
- Niet meegeteld als jouw kleuren. De neutrale tinten staan in **Tokens** als **Neutrals · starter · 9**, en **Open** toont ze in Colours als één ingeklapte groep (`#/start?area=color&group=neutral`).
- Een rol die op een starterkleur staat leest *"Starter Paper stands in"*, met **Choose…** op zijn kiezer.

## Van jou

- Door jou gekozen of geïnstalleerd.
- Op volle sterkte, en een getinte kaart waar je een lettertype installeerde.
- Meegeteld op Board en in Tokens.
- Een rol die een andere volgt leest **↳ follows Primary** in plaats van de naam van de primaire te herhalen.
:::

Overgenomen materiaal wordt nooit met een gestippelde rand getekend, omdat een gestippelde rand hier een neerzetdoel betekent.

## Logos

Leeg je map met merktekens in de neerzetzone bovenaan: **"Drop marks here, or choose several at once"** neemt zoveel bestanden als je hebt. Elk bestand wordt gelezen op zijn vorm en inkt, en wacht dan onder **Waiting for a slot** als een chip die zegt hoe het eruitziet, zoals *"Looks like the Horizontal primary"*, met de meting die ervoor is gebruikt en een knop **Place** (**Replace** waar het slot gevuld is). Waar het onzeker is, zegt de chip dat en biedt **Change slot**, met alle acht. Er wordt niets geplaatst totdat je ergens op drukt.

Een merkteken met overtollige lege marge krijgt eerst een trimaanbod; beantwoord het of druk op Escape en het origineel gaat onaangeroerd erin. Waar een merkteken een leeg verwant slot kan vullen, biedt de kamer de afgeleide **mono**- of **reverse**-versie aan als chip met het label *Generated*.

Elk merkteken belandt in een raster van acht optionele slots, één per **oriëntatie** en **behandeling**:

- **Oriëntaties:** Horizontal (woordmerk en symbool in een rij) en Vertical (gestapeld, voor vierkante en hoge ruimtes).
- **Behandelingen:** Primary, Primary reverse (voor donkere achtergronden), Mono (één kleur) en Mono reverse.

Een groep zonder merktekens klapt in tot één regel; open haar om haar slots te zien. Klik op een slot om een PNG, SVG, JPEG of WebP toe te voegen, of klik op een gevuld slot om het merkteken te vervangen. Alles blijft op dit apparaat.

![De logoslots met Horizontal en Vertical geopend: elke behandeling is een eigen slot, en elk slot is optioneel](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&system=new-design-system&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails.be-logo-group--fold%3Anot%28.be-logo-group--custom%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** zijn merktekens die je merk bij een eigen naam noemt, zoals een pictogram, een wapen of een favicon.
- **More identities.** Een submerk, product of evenement kan een eigen volledige set hebben: **+ Add another logo** en geef de set een naam. Je hoofdset heet "Your logo". [Merkarchitecturen](/info/brand-architectures.html) laat zien wanneer een logo-identiteit het juiste bouwblok is.
- **Lolly leest de kleuren van het logo.** Een kaart onder de neerzetzone, en opnieuw bovenaan Colours, noemt de kleuren van het logo en vraagt **Which is the main colour?**, met de sterkste kleur al geselecteerd (nooit het wit waarop het is geëxporteerd). **Use these colours** voegt ze toe aan je palet, maakt de hoofdkleur je primaire kleur en, wanneer het logo een donkere neutrale kleur heeft die op papier leest, maakt die de tekstkleur. **Not now** laat ze in de Tray. Op een gloednieuwe installatie wordt het meest waarschijnlijke antwoord meteen toegepast, en de kaart biedt **Undo** of een andere hoofdkleur. Een SVG geeft exacte kleuren; een PNG, JPEG of WebP geeft de kleuren die een echt deel van het merkteken beslaan.

## Colours

De kamer groeit met het design system: een eerste bezoek is één beslissing, en de rest komt mee met het palet.

### De eerste kleur

Een systeem zonder eigen kleuren toont de neutrale kleuren van de starter, open in hun eigen groep, en bovenaan de kamer een gestippeld veld om te plakken en neer te zetten: één grote chip en één veld. Zet een afbeelding of een lijst kleuren ergens op het veld neer, en Lolly leest de kleuren uit wat je hebt neergezet.

- **De chip is de kiezer.** Druk op **Pick a colour** en de OKLCH-kaart van de studio opent, gevuld met wat het veld bevat: eerst de naam en hex van de kleur, met de kleurruimtes, het wiel, de vier draaiknoppen en alfa onder **Fine-tune**, en **Cancel** en **Add colour** onderaan. Er komt niets in het systeem voordat je op **Add colour** drukt.
- **Het veld neemt elke notatie aan**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` of een kleurnaam. Plak een lijst en die wordt een rij chips die je een voor een toevoegt of met **Add all**.
- **Twee andere manieren om kleuren binnen te halen.** **Pick a colour from the screen** gebruikt de pipet waar de browser er een heeft, en **Take colours from an image** leest een screenshot of foto op dit apparaat.
- **Add is nooit uitgeschakeld.** Met een leeg veld opent het de kiezer; tekst die het niet kan lezen krijgt onder het veld een regel die dat zegt.

Je eerste kleur wordt de **primary**, en een chip bevestigt het, zoals *"Primary is now Vivid Violet"*, met **Fine-tune** om de kleur bij te stellen.


### Naarmate het palet groeit

Je kleuren staan naast een voorbeeld **In context** op een breed scherm, en erboven op een kleiner scherm. Het voorbeeld toont een poster, grafiek of interfacekaart in je palet. Starterkleuren blijven in hun eigen opvouwbare groep, die inklapt zodra het systeem eigen kleuren heeft, en het veld om te plakken en neer te zetten wordt één compacte rij. Export zit in de **Export** van de balk en in de kamer Tokens, dus de kop van de kamer heeft er geen.

![De kamer Colours op Lolly Demo: het palet in ingeklapte groepen, elke kleur met naam en hex, en de palet-download in de kop](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![De kamer Colours op Lolly Demo na het toevoegen van één kleur: de tabel Colour roles, daarna de chip van de nieuwe kleur met Use as Lead? en Fine-tune, naast een live compositievoorbeeld](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Colour roles: what the colours are called

Het design system zegt hoe zijn kleuren heten en waar elke kleur voor dient, en Lolly leest dat. **Colour roles** staat bovenaan de kamer Colours. Op een breed scherm deelt **In context** de weergave, dus een wijziging verschijnt op de poster, de grafiek en de interfacekaart terwijl je haar maakt.

![De tabel Colour roles op Wefthouse, een verzonnen textielmerk, in eigen woorden: de colourway-chips Indigo, Madder en Weld, daarna Main, Accent, Supporting en Tertiary, elk met zijn lichte en donkere kleur, gelezen als de hoofdkleur, de partnerkleur en alleen op naam, en Background, Text, Quiet text en Hairlines onder de tabel vermeld als de lezingen die geen rol invult](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=wefthouse&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

De tabel heeft vier kolommen, en op een telefoon wordt elke rij een kaart die licht en donker naast elkaar houdt:

| Kolom | Wat erin staat |
|---|---|
| **Role** | Het eigen woord van het design system, dat je ter plekke kunt bewerken, en een regel die zegt waar de kleur voor dient |
| **Light** en **Dark** | De kleur in die look voor de gekozen colourway, met naam of waarde, en het contrast |
| **Lolly reads this as** | Wat een tool met de rol doet, in Lolly's eigen woorden |

**Hoe Lolly een rol leest.** Elke lezing hoort bij één rol, dus een lezing kiezen die een andere rol heeft, verplaatst die lezing hierheen. Lolly leest nooit betekenis uit een woord.

| Lezing | Wat eruit volgt |
|---|---|
| **Lead colour** | Grote vormen, knoppen, de kleur waarmee een tool leidt |
| **Partner colour** | De tweede kleur waar een tool naar grijpt |
| **Background** | Ligt achter al het andere |
| **Text** | Koppen en lopende tekst |
| **Quiet text** | Bijschriften en kleine letters |
| **Hairlines** | Lijnen, randen en scheidingen |
| **By name only** | Geen enkele tool kiest de rol uit zichzelf. Hij wordt aangeboden in elk kleurveld en in Design, waar een keuze gekoppeld blijft, dus hij volgt de colourway |

Een lezing die geen rol invult, blijft zoals het design system haar definieert, en de kamer somt die onder de tabel op. Een rol met hetzelfde id als een lezing, zoals een rol die Primary heet, is die lezing en kan niet worden verplaatst.

**Waarden.** Druk op een waarde om voor die rol, in die look, in de gekozen colourway een kleur te kiezen. **Same as light** laat de donkere waarde de lichte volgen totdat je een eigen kleur kiest. De chip **Aa** toont de tekst die Lolly kiest om op de kleur te staan, en de regel onder de waarde zegt per look hoe die tekst leest: **Text reads well**, **Large text only** of **Hard to read as text**. Dat gaat over tekst op de kleur en zegt niets tegen de kleur zelf, die nog steeds kan werken voor vormen en grote vlakken. Een rol die alleen op naam wordt gelezen, toont dezelfde woorden zonder de waarschuwingskleur, omdat geen enkele tool uit zichzelf tekst erop zet. De cijfers achter de woorden, APCA eerst en WCAG daarna, staan in de tooltip en in de kiezer. **Own text colour** markeert een waarde waarvan het bestand de tekstkleur vastlegt, die blijft staan. **Copied** markeert een waarde die uit een andere colourway of uit de partnerkleur komt en die nog niemand heeft gekozen; **Keep this colour** in de kiezer legt de waarde vast.

**Beginpunten.** Een design system zonder eigen rollen toont de woorden van nu: Primary, Secondary, Surface en Text. Er wordt niets geschreven totdat je er een wijzigt. **+ Add a role** biedt **Primary, Secondary** of **Main, Accent, Supporting, Tertiary** als suggesties, of woorden die je zelf typt, met de lezing die elk zou krijgen. De eerste twee woorden worden de hoofdkleur en de partnerkleur. Tools blijven dezelfde kleuren tekenen, en op een systeem met één hoofdkleur is de eerste colourway naar die kleur genoemd.

**Hernoemen, herordenen, verwijderen.** Een hernoeming wijzigt alleen het woord, dus alles wat de rol gebruikt blijft werken. Sleep een rol aan zijn handvat, of druk op Spatie op het handvat, gebruik de pijltjestoetsen en druk op Spatie om neer te zetten. **Remove** zegt wat de rol nog gebruikt. Wanneer tools hem lezen, laat **Remove and keep those colours** elke lezing met de kleur die ze nu tekent. Een huisregel, een hulplijngroep, een toolveld of een ander token dat de rol gebruikt, houdt hem vast totdat dat gebruik verandert. Een opgeslagen Design-document kan een rol ook op naam gebruiken, en Lolly kan dat niet zien in het tokenbestand: een document dat dat doet, meldt de kleur als onopgelost.

**Een met de hand geschreven bestand.** Kleuren die een tokenbestand bevat en die geen rol declareert, staan onder **In this file, with no role yet**, elk met een veld voor een woord en **Make a role**. Ze blijven hoe dan ook op naam werken. Een token met cijfers in zijn naam kan geen rol zijn, dus het blijft in het bestand staan en blijft via zijn pad werken. Een record in het bestand dat niet valideert, toont de tabel zonder bediening en zegt waarom.

**De rest van de kamer spreekt dezelfde woorden.** De chips, de rij **Use as** van het staal en de groep **Colour roles** van het palet gebruiken allemaal de woorden van het design system, en de tegel van een kleurrol opent zijn waarde. Geëxporteerde bestanden leggen niets nieuws over rollen vast: de kleuren in een render veranderen omdat de tokens veranderden.

**Waar de woorden naartoe gaan.** De woorden en beschrijvingen reizen mee met het design system. Agents lezen ze in de designbrief, `lolly://tokens` en de `AGENTS.md` van een merkpagina, de terminal toont ze in `lolly system status`, en een merkpagina somt ze op in `brand.json` en meet voor elke rol een contrastpaar. Elk exportformaat bewaart wat het kwijt kan: DTCG- en Tokens Studio-bestanden bewaren alles, `DESIGN.md` bewaart de woorden en de lezingen, en een PowerPoint-thema bewaart alleen de volgorde van het merk. [Colour roles in other formats](/info/design-tokens.html#colour-roles-in-other-formats) geeft de volledige lijst. Woorden worden altijd geciteerd als gegevens van het design system en nooit als instructies gelezen.

**Waar een kleur wordt gekozen.** Elk kleurveld in een tool en in Lolly Design begint met de rollen van het design system, in zijn eigen volgorde, met elk woord en waar de kleur voor dient in beeld. **Aa** naast een rol kiest de kleur die op die rol staat. De rest volgt onder **Other colours**, zonder de eigen kopieën van een colourway, de on-kleuren en elke lezing die een rol al invult. Een keuze blijft aan de rol gekoppeld en volgt de colourway, het veld blijft het woord tonen welke colourway ook is gekozen, en Settings en Tokens gebruiken het woord ook. Een design system zonder rollen houdt het raster van stalen dat het altijd had.

### Elke kleur die een tool leest

Met **Colour roles** dicht leiden de eerste beslissingen de kamer als chips, elk met de kleur die de rol speelt en zijn naam. Op een systeem zonder eigen woorden zijn dat **Primary**, **Secondary**, **Surface** en **Text**. Druk op een chip om zijn kleur te kiezen uit de eigen stalen van het palet. **Every colour a tool reads**, onderaan **Colour roles**, heeft de volledige strook.

De strook toont de zeven kleuren die een tool kan lezen: Primary, Secondary, Surface, Text, Muted, Edge en On primary, in de woorden van het design system waar het die heeft. Elke kleur speelt in elke tool en export hetzelfde deel. Geen enkele hoeft ingesteld te zijn (drie losse kleuren vormen een prima systeem), elke kleur kan er een invullen en de uitlezing zegt hoe tekst leest, gemeten tegen het oppervlak, APCA eerst. Elke rij toont een eigen kleur op volle sterkte, een starterkleur die inspringt, of **↳ follows Primary**.

On primary is afgeleid van de primary, leest **Derived** en heeft geen kiezer. De schakelaar **Light** en **Dark** ernaast, en die naast **In context**, bepalen welke look de strook, het palet en het voorbeeld tonen.

Het eigen accent van de app volgt standaard het design system. Dat is de instelling **Interface follows the design system** in **Settings → Appearance**; de instelling uitzetten laat de chrome van de app neutraal, terwijl tools, canvassen en exports in beide gevallen het design system volgen.

**Colourways.** Een design system kan meerdere hoofdkleuren hebben, elk per stuk te kiezen. De rij **Colourways** bovenaan **Colour roles** toont één chip per colourway, met **Default** op de canonieke. **+ Add** start een nieuwe colourway vanuit een van de kleuren van het palet. Kies een chip, en de tabel, de strook, het palet en de voorbeelden tonen die colourway; de gekozen colourway kan worden hernoemd, gedupliceerd, de standaard worden gemaakt of worden verwijderd. Op een systeem met colourways heeft elke colourway een eigen primary en secondary nodig, en een eigen surface wanneer de colourways de achtergrond tinten, dus die rollen blijven ingesteld in de staalbewerker. [Add colourways to a design system](/info/colourways.html#add-colourways-to-a-design-system) geeft de stappen en het tokenformaat, en [Lolly Demo in use](/info/lolly-demo-in-use.html#colourways-on-real-work) toont colourways op echt werk.

### Meer kleuren vinden

Drie tools bouwen voort op je primary. De eerste twee doen alleen suggesties, en de derde vervangt het palet nadat je de wijziging hebt bekeken.

::: cols
## Explore shades & harmonies

Kies een **Starting colour**, een **Scheme** (Mono, Complement, Analogous of Triad) en hoeveel **Shades** (3 tot 20, standaard 5). **Fine-tune** stelt de UI-intensiteit, het contrast en tekst op merk in. Klik op een tint om hem toe te voegen, of **Add 5 shades** voor een groep. Je kleuren en rollen blijven.

## Find matching colours

Kies een **Harmony**: Complementary, Adjacent, Triad, Tetrad of Analogous (met **Accents** van 2 tot 5 en een **Angle** van 10° tot 45°). Elke kandidaat heeft een gegenereerde naam en **+ Add**, één druk per kleur.

## Rebuild the whole palette

Vervangt het palet vanuit één beginkleur, na een overzicht van wat verandert en wat blijft. Eerst wordt een checkpoint gemaakt, en daarna wordt **Undo** aangeboden.
:::

Alle drie gebruiken dezelfde perceptuele kleurwiskunde (OKLCH) als de engine. In **Explore shades & harmonies** tonen de rijen **Primary**, **Neutral** en **Secondary** de voorgestelde tinten, en **Theme preview** toont lichte en donkere voorbeelden met hun contrastwaarden.

![Drie voorgestelde tintgroepen, met individuele toevoegknoppen en een aparte Theme preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Gegenereerde accenten, elk met een swatch, een automatisch gegenereerde naam, zijn hexwaarde en een Add-knop](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Een gegenereerd palet doorvoeren

Open **Rebuild the whole palette…** en druk op **Preview full rebuild**. Het overzicht telt hoeveel rollen blijven zoals je ze toewees, hoeveel van je eigen kleuren worden behouden en hoeveel tintcurves, drukvergrendelingen, verborgen tinten en verloopstops opnieuw worden verankerd of behouden. **Apply rebuilt palette** legt vast; **Cancel** verandert niets. Daarna biedt de kaart **Undo** met focus erop, en het checkpoint van vóór de wissel herstelt het hele systeem.

Een systeem met colourways behoudt elke colourway tijdens een herbouw. De canonieke colourway volgt de nieuwe beginkleur, en elke andere colourway behoudt haar eigen kleuren, naam, volgorde en instellingen. Het overzicht noemt welke colourway volgt en welke hun kleuren behouden. Lolly herbouwt geen systeem dat zijn colourways codeert op een manier die het niet kan bewerken; de kaart zegt waarom, en er verandert niets.

### De expertsecties

Vier ingeklapte secties staan onder het voorbeeld en de rollen. Elk opent rechtstreeks met `#/start?area=color&focus=<name>`:

- **Explore shades & harmonies** (`focus=generate`), hierboven beschreven.
- **Shade curves** (`focus=curves`) vormen een verloop punt voor punt om, met aparte curves voor helderheid, chroma en tint (L / C / H) en de tinten die opnieuw tekenen terwijl je sleept.
- **Contrast** (`focus=contrast`): **Contrast-lock** toont een verloop opnieuw om APCA-doelen te halen tegen een achtergrond die je kiest, en **Rotate hue** draait het hele verloop rond het wiel.
- **Print** (`focus=print`) bepaalt wat de primary op de pers wordt: zijn automatische waarde, een vastgepinde CMYK-opbouw of een benoemde steunkleurinkt.

### Het palet en elke swatch

Het palet toont je kleuren in opvouwbare groepen, elk met een eigen **+ Add**. Maak en hernoem groepen zoals je wilt. Een rol maakt nooit een tweede tegel: een tegel waar een rol naar wijst, draagt in plaats daarvan de naam van de rol, zoals **Primary**. **Colour chart** onder de tegels toont dezelfde kleuren op het OKLCH-**Wheel** (sleep een stip om te herkleuren, klik op lege ruimte om een staal toe te voegen) en de **Gamut**-grafiek, die toont waar het weergeefbare bereik ophoudt. `#/start?area=color&focus=chart` opent de grafiek rechtstreeks.

![Het paletvlak, elke groep inklapbaar, met de palet-download in de kop](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Het OKLCH-wiel - hoek is tint, afstand naar buiten is verzadiging en de grijstinten lopen langs een helderheidsrail aan de zijkant](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Klik op een swatch om zijn editor te openen:

- **Rename** het staal.
- **Set the colour** met OKLCH-schuifregelaars, of in **Hex**, **HSL**, **RGB** of **CMYK**. Het waardeveld leest en schrijft in de actieve ruimte. CMYK stelt hier de schermkleur in door conversie; gebruik **Print substitutes** om exacte inkten vast te leggen.
- **Stored as** kiest hoe het staal wordt bewaard: **LCH** (de standaard, perceptueel en wide-gamut), Hex, RGB of HSL.
- **Use as** geeft het staal rechtstreeks een rol, in de woorden van het design system waar het die heeft. Druk nogmaals op een gemarkeerde rol om de rol te wissen.
- **Print substitutes** (ingeklapt): zet **CMYK** van **Auto** op exacte inktwaarden, of stel een **Spot colour** in met een **Name** (zoals `PANTONE 186 C`), een optioneel **Book** en een **Finish** voor folie, reliëf, blindreliëf, spotlak, soft touch of een stans-, kerf- of perforatielijn. Een drukker gebruikt deze vastlegging wanneer je een CMYK-PDF of TIFF exporteert; zie [Colour profiles](/info/exporting.html#colour-profiles).
- **In other spaces** (ingeklapt): een waarde per kleurruimte, afgeleid of door jou geschreven, en een door jou geschreven waarde wint bij export.

**Een swatch verwijderen** is veilig. Afgeleide tinten en themarollen worden verborgen, zodat niets dat ze leest breekt, terwijl kleuren die je toevoegde worden verwijderd.

::: details Werken met veel swatches
Elke swatch heeft een sleepgreep. Sleep om te herordenen binnen een groep, of geef de greep focus, druk op Space, gebruik de pijltjestoetsen en druk nogmaals op Space om neer te zetten; Escape annuleert. Op een telefoon toont het palet vier kleuren per rij en verschijnen de grepen in de modus Select, in plaats van als rij onder elke kleur. Om kleuren tussen groepen te verplaatsen gebruik je de bediening **Group** van de editor of selecteer je er meerdere en gebruik je **Move to**.

Selecteren heeft geen aparte schakelaar nodig. De balk en de selectievakjes verschijnen met de eerste geselecteerde tegel en verdwijnen met de laatste.

- **Sleep over lege ruimte** om een rechthoek te tekenen; elke tegel die hij raakt komt in de selectie, over groepen heen. Een ingeklapte sectie voegt niets toe.
- **Shift-klik** neemt een bereik in leesvolgorde, **Cmd/Ctrl-klik** schakelt één tegel om, en een gewone klik opent de editor.
- Elke groepskop heeft **Select all**, en **Cmd-A** met een tegel in focus neemt elke kleur die je bezit, nooit een starterkleur.
- Het raster heeft één tabstop: pijlen verplaatsen, Shift-pijlen breiden uit, Space schakelt om, Delete verwijdert en Escape wist. Om een kanaal bij te stellen druk je eerst op `l`, `c` of `h`.
- Houd op een aanraakscherm een tegel ingedrukt om een selectie te starten, tik dan om toe te voegen.

De balk leest **{n} selected**, dan **Move to**, **Give a role** (elke kleur krijgt om de beurt de volgende rol), **Download** (de selectie in elk van de zes paletformaten), **Duplicate** (een kopie van elk, na het origineel geplaatst), **Copy values** en **Delete**. Eén kopie opent direct in de editor; meerdere blijven geselecteerd. Eén Cmd/Ctrl-Z maakt een hele bulkactie ongedaan.
:::

### Verlopen

Het optionele paneel **Gradients** bouwt mengtokens uit het palet. Elk verloop heeft een voorbeeld, 2 tot 8 benoemde stops en een hoek. Een stop wijst naar een swatch, dus herkleur de swatch en het verloop volgt. Mengingen lopen in OKLCH.

De palet-downloads (designtokens, CSS, SCSS, GIMP en Adobe Swatch Exchange) staan in de kop van het palet, naast de titel. [Neem je palet en lettertypen overal mee](/info/using.html#take-your-palette-and-fonts-anywhere) beschrijft elk formaat.

## Typografie

Zonder eigen lettertype is de kamer één kaart: **Primary**, gezet op leesgrootte in het lettertype dat het vandaag levert, met een tag **Starter**, een knop **Choose for Primary** en de regel *"Nothing installs until you choose one."* Headings, code en cursief volgen de primary totdat je ze kiest; **Choose them separately** toont hun kaarten.

![De Type-room zonder gekozen lettertype - één kaart op leesgrootte, een Starter-label erop, en één gevulde Choose for Primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Kies één lettertype en de kamer opent in vier rolkaarten, de lijst Fonts en een live specimen:

- **Primary**: lopende tekst, knoppen en elke tool.
- **Headings**: het displaylettertype voor `h1` en `h2`.
- **Code**: een monospace-lettertype voor code en gegevens.
- **Italic**: een echte cursief voor nadruk, citaten en zijsprongen.

Een kaart is alleen getint waar je dat lettertype installeerde. Zijn knop zegt voor welke rol hij is: **Change Headings** bij een eigen lettertype en **Choose for Headings** overal elders. De voorbeeldregel breekt om in plaats van af te kappen. Niets op een kaart legt iets vast: de knop opent het vergelijkingspodium voor die rol.

![De vier rolkaarten onthuld - elk gezet in het lettertype dat het bedient, met een Starter-label waar niemand er een koos en Italic dat de primaire volgt](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Het vergelijkingsscherm

Het podium opent binnen de kamer, onder de kaart waarop je drukte, en de kaarten klappen in tot een strook van één regel zodat het podium op het eerste scherm van een telefoon past. Escape annuleert en geeft de focus terug aan de kaart.

1. Druk op **Choose for** en de rol op de kaart.
2. Typ een familienaam en druk op **Preview**, of druk op een van de zes **Pinned**-families onder het veld.
3. Druk op **Use this face**.

![Het vergelijkingsscherm open onder zijn kaart, met de zoekregel, de vastgepinde families en de kaarten ingeklapt tot een strook van één regel](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**Toestemming wordt één keer gevraagd.** De eerste keer dat een voorbeeld Google Fonts bereikt, legt een dialoog uit: *Google learns the family name and your IP address. The file is then kept on this device and used offline. This is the one step in the studio that reaches a third party.* **Fetch from Google** gaat door en wordt onthouden. **Cancel** laat de kaart lezen *"Not fetched. Nothing was sent to Google."*, met een eigen **Fetch from Google**.

**Zet een fontbestand op het podium** (TTF, OTF of WOFF) om een gelicentieerd lettertype te bekijken dat je al bezit. In beide gevallen blijft het lettertype op dit apparaat, rendert het offline in de app, de tools en elke export, en reist het mee in het bestand van het design system. Alles op Google Fonts wordt geleverd onder een open licentie (OFL, Apache of UFL).

### Fonts op dit apparaat

Het paneel **Fonts** somt elk lettertype op dit apparaat op en de rol die het vervult. Lettertypen die je toevoegde staan voorop onder **In the design system**, elk met zijn rollen en een verwijderknop. De starterlettertypen volgen in één gedempte, ingeklapte rij. **Add a face** opent het vergelijkingspodium voor elke rol. Het paneel **Type roles** toont een live specimen van elke rol met zijn familie en status, zoals *Inter* of *Inter · follows Primary*.

## Tokens

Tokens zijn de benoemde waarden achter het design system: kleuren, lettertypen, logo's, hoeken en tussenruimte. Tools lezen ze bij naam, dus een wijziging hier bereikt elke tool tegelijk.

![De kamer Tokens: de kop met een voorbeeld uit het systeem en de bestandsacties, tegels die elke soort token tellen, dan de kleurparen met hun contrastuitlezingen](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **De kop** geeft een voorbeeld uit je eigen systeem (*Primary is Spearmint, #033633*) en de bestandsacties: **Download** (het hele systeem als designtokens, of het palet in vijf andere formaten), **Copy CSS** en **Add from…** om een JSON-bestand terug in te lezen.
- **Tegels** tellen elke soort token en springen naar de sectie: Colours, Type, Logos, Shape and spacing, More en All tokens. Ze tellen wat elke sectie bevat; een sectie met alleen wat bij de lege starter hoorde draagt een tag **Starter**, en een systeem dat met de app is meegeleverd telt zijn eigen materiaal zonder tag. Op een telefoon lopen de tegels over twee rijen van drie.
- **Colours** begint met de paren die tools samen zetten (tekst op vlak, op primary, gedempt op vlak) met een APCA-uitlezing in licht en donker, en markeert **Weak contrast** waar een paar tekortschiet. Dan elke kleurgroep: een verloop als één rij chips, andere kleuren met hun waarde en de verwijzing die tools gebruiken, zoals `{color.brand.spearmint}`. Druk op een verwijzing om de verwijzing te kopiëren. **Edit in Colours** opent een groep in de kamer Colours. Bij een designsysteem met [kleurrollen](#colour-roles-what-the-colours-are-called) staat **Colour roles** vooraan, met elke rol één keer in de eigen woorden en volgorde van het systeem. Een rol bewaart een kleur voor elke kleurvariant en look, en die kleuren blijven bij de rol in plaats van als eigen kleuren te verschijnen: wijzig ze in de tabel Colour roles.
- **Type** en **Logos** noemen het lettertype voor elke rol en elk logoslot, met **Edit in Type** en **Edit in Logos** zodra je een eigen hebt.
- **Shape and spacing** bevat **Rounded corners** (`shape.radius`) en **Spacing rhythm** (`space.base`). Elk leest *Lolly default* totdat je de schuifregelaar verplaatst en *Yours* daarna, slaat meteen op en kan ongedaan worden gemaakt.
- **More tokens** voegt spacing, sizing, lijndikte, dekking, rotatie, gewone getallen en schaduwen toe, opgeslagen als standaard [designtokens](/info/design-tokens.html).
- **App appearance (advanced)** somt de kleuren, formaten en schaduwen op die de eigen schermen van Lolly gebruiken, en **Inspect every token (advanced)** doorzoekt en bewerkt elke opgeslagen waarde, waarbij elke wijziging eerst ter review wordt getoond. Daar staan de waarden van een kleurrol in elke kleurvariant bij de rol: kies het token van de rol om één rij per kleurvariant te zien, licht en donker naast elkaar, en de telregel zegt hoeveel waarden de rollen bevatten. Een alleen-lezen designsysteem toont dezelfde lijst.

Een sectie waar niets in staat biedt de manier om de leemte te vullen: **Pick a colour**, **Choose a face** of **Add a logo**.

## Bestanden

Zet de bestanden die je merk bewaart erin, behalve logo's: **vector**-, **image**-, **audio**- en **motion**-bestanden (video, Lottie en animaties). Ze verschijnen in [Assets](/info/using.html#assets-your-library), gesorteerd in secties en klaar in de assetkiezer van elke tool, en ze blijven op dit apparaat.

## Rules

**Rules** zet de keuzes van je merk aan het werk: wat mensen kunnen wijzigen, wat vast blijft en wat Lolly kan controleren.

![Rules op Lolly Demo: vier huisregels, elk gemarkeerd als Checked in Lolly Design en Required of Advisory, daarna Try your design system in use met zijn voorbeelden klaar om te renderen](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** somt je regels op. **Add rule** (of **Add your first rule**) opent een kort formulier:

- een **Rule name** in je eigen woorden, zoals *Beacon accents*;
- de **Check**: **Colour choices**, **Font choices**, **Fixed artwork** of **Text length**, met de merkrol die hij gebruikt, onder je eigen naam voor de rol;
- het **Example** waarop hij van toepassing is (Poster, Title slide, Content slide of Lolly Chart), de **Mode** en of hij **Required** of **Advisory** is;
- **Reviewed by**, dan **Save draft** of **Approve & save**.

Goedkeuring legt je eigen beslissing vast op dit apparaat. Goedgekeurde vereiste regels beperken de herbruikbare poster, en controles dekken alleen de PNG-voorbeelden; ze wijzigen geen enkele andere tool.

Regels die een design system in zijn tokenbestand meebrengt, zoals goedgekeurde kleurparen, tekstgewicht en uitlijning of een logo per oppervlak, staan hier als **Checked in Lolly Design**. Lolly Design controleert ze laag voor laag in de kaart **Before you export** van het exportpaneel, en `lolly check` doet hetzelfde voor een opgeslagen Lolly Design-document ([Before you export](/info/design.html#before-you-export)). Een regel waarvoor deze build geen controle heeft, blijft zoals aangeleverd bewaard en wordt gemarkeerd als **Unchecked**.

Lolly Demo brengt vier goedgekeurde huisregels mee. Koppen staan nooit in hoofdletters: die regel is verplicht, dus `lolly check` meldt een kop in hoofdletters als fout. De andere drie zijn adviserend. Lopende tekst is links uitgelijnd. Primaire merktekens staan op lichte oppervlakken en omgekeerde op donkere. Gestippelde lijnen betekenen: zet hier neer.

**Try your design system in use** rendert vier voorbeelden uit de huidige revisie met **Render & check examples**. Kies een **Mode** en **Try your own text** voor de kop, de ondersteunende tekst en de dia-tekst. Elk voorbeeld meldt wat is gemeten, met **See checks & sources** en **Download check report**, en **Make reusable poster** downloadt een `.lolly` waarvan de vaste lay-out en de goedgekeurde invoerkeuzes met het bestand meereizen. Voorbeelden zijn lokaal: door een controle uit te voeren wordt niets gepubliceerd of goedgekeurd.

Een build die met een vast merk wordt geleverd, toont dezelfde regels en voorbeelden alleen-lezen, onder *This brand is set*.

## Skills

**Skills** toont de [merkskills](/info/brand-skills.html) van het actieve design system: de geschreven standaarden van het merk, één per discipline, voor mensen en AI-agents. Elke rij geeft de discipline, de eigen status van het merk (**Concept** of **Goedgekeurd**), of de skill openbaar of intern is en zijn revisie. Kies een rij om de skill te lezen naast zijn dekking, die de regels van de skill afzet tegen je tokens: wat Lolly controleert, wat botst, wat overeenkomt en wat alleen richtlijn is.

**Skill downloaden (.zip)** schrijft de skill als een Agent Skills-map voor een agent-tool, met cataloguslinks die naar deze Lolly wijzen, en **Als één bestand kopiëren** zet dezelfde tekst op het klembord voor een chatvenster. Een design system zonder eigen skills toont een basislijn die Lolly uit zijn tokens en huisregels schrijft telkens wanneer de basislijn wordt gelezen. De kamer leest skills en bewerkt ze nooit.

## Een merk binnenhalen

**Add from…** in de balk opent een kiezer die vraagt wat je hebt, niet welk formaat het is:

- **Design tokens or a design file**: DTCG- of Tokens Studio-JSON, een Penpot-project, een zip met tokensets, een Lolly design-systempakket, een SVG, een `DESIGN.md` of een map met een merkpagina.
- **PDF**: een deck of een richtlijnenbestand, op dit apparaat gelezen voor zijn kleuren, merktekens en ingebedde lettertypen.
- **Logo or screenshot**: een afbeelding wordt een voorgesteld palet, op dit apparaat gelezen. Het leest kleuren, niet het lettertype of de lay-out.
- **Saved web page**: één HTML-bestand en zijn CSS-bestanden, of geplakte HTML of CSS, tot 20 bestanden en 2 MB. Alleen de tekst die je aanlevert wordt gelezen: gekoppelde bronnen worden niet opgehaald en scripts draaien niet.
- **Font file**: TTF, OTF of WOFF. Opent de kamer Type, waar het lettertype wordt geïnstalleerd.
- **Website**: één pagina, gelezen voor zijn kleuren en lettertype. Deze tegel verschijnt alleen op een apparaat dat een pagina kan lezen, en zegt welke lezer hij gebruikt: de app op dit apparaat, of de browserextensie in een achtergrondtabblad, aangemeld als jij. Een URL invullen vult alleen het veld in; op ophalen drukken is de toestemming.

Kies de bron voor ontwerpbestanden en de volgende kaart toont de geaccepteerde formaten als pictogramtegels, waarbij de hele kaart één neerzetdoel is. Je kunt ook een bestand rechtstreeks op de studio zetten.

![De importkaart - de geaccepteerde formaten staan voorop als pictogramtegels, en de hele kaart is één droptarget](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- Een **Lolly design-systempakket** (`.lolly`, of een oudere `.zip`) installeert in één stap.
- Een **Penpot**-export (`.penpot`) brengt zijn designtokens mee.
- Een **Design Tokens**-bestand (W3C DTCG) of **Tokens Studio**-bestand (`.json`) brengt zijn tokens mee. Een beschrijving die een lezer vraagt instructies te negeren, rechten claimt of vraagt code uit te voeren, wordt weggelaten, en de import zegt waar ze stond. Dit is een controle regel voor regel en mist andere formuleringen, dus lees een bestand van iemand die je niet kent voordat je de tokens toepast.
- Een **gewone SVG** wordt gescand op kleuren waaruit je kiest, waarvan de eerste je primaire kleur wordt.
- Een **`DESIGN.md`** (`.md`) gaat naar **Try these colours** met zijn tokens zoals geschreven. De proza ervan kan worden bewaard als conceptmerkvaardigheid, en de kaart markeert regels die een lezer vragen instructies te negeren, rechten te claimen of code uit te voeren. Agents en merkpagina's zien geen concept totdat je op **Keep this skill** drukt in de kamer Skills, en een bewaarde vaardigheid blijft intern.
- Een **map met een merkpagina**, gekozen als map, neergezet of gezipt, gaat naar dezelfde beoordeling. Elk bestand wordt gecontroleerd tegen het `brand.json` van de map, en een bestand dat niet past, weigert de hele map. Het voegt de tokens toe. Logo's en lettertypen blijven in de map.

Lolly leest een merkpagina uit bestanden die je aanlevert. Het haalt het adres van een andere site niet op.

### A file with its own colour words

Een tokenbestand of een `DESIGN.md` kan eigen woorden voor zijn kleuren gebruiken, zoals main, accent, supporting en tertiary. Wanneer Lolly zulke woorden vindt, somt de beoordeling elk ervan op voordat iets wordt toegepast: het woord, zijn kleur in elke look, het token waar het vandaan komt en als wat Lolly het zou lezen. Lolly stelt die lezingen voor op basis van alleen de woorden, tegen een korte lijst, en gebruikt geen model. Een woord buiten de lijst komt binnen als eigen woord van het merk, **By name only**. Hernoem elk woord, zeg waar het voor dient, lees het als iets anders, of haal het vinkje weg om het als benoemde kleur te laten staan.

**Install with these roles** schrijft ze, en **Install without roles** installeert het bestand precies zoals het kwam. Een bestand zonder zulke woorden toont geen nieuwe stap. Een bestand dat zijn eigen rollen vermeldt, zoals een door Lolly geschreven bestand, toont ze zoals geschreven en installeert ze ongewijzigd, en je kunt ze daarna bewerken in de kamer Colours. De terminal heeft geen beoordeling, dus `lolly system import` houdt een vermeld record vast en laat de woorden van andere bestanden als benoemde kleuren staan.

### Een referentie beoordelen

Een logo, screenshot, website of opgeslagen pagina opent **Try these colours**: een voorbeeld in de voorgestelde kleuren, een **Main colour** die je kunt wijzigen en een naam voor een nieuw systeem. Een kader schrijft uit wat toepassen doet: het **vervangt** de actieve tokeninstellingen door het gegenereerde palet en de standaardstijlen, **behoudt** je lettertypen en bibliotheekbestanden en het vorige systeem kan worden **hersteld**. **Apply suggested settings** past de lichte en donkere paletten toe, na een checkpoint, en **Restore brand settings** kan de oude instellingen terugbrengen. **Change reference** kiest een andere bron.

**Palette, source details and individual choices** toont wat er is gelezen, eventuele gevonden lettertypenamen en het contrast van het voorbeeld. Lettertypenamen zijn alleen suggesties; Type is nog steeds waar je een lettertype installeert. De brondetails kunnen typografie, tussenruimtes, opvulling en hoekwaarden bevatten waar die zijn waargenomen, anders gelabeld **Not observed**. Een opgeslagen pagina of een native websitelezing meldt gedeclareerde stijlen, die de pagina mogelijk niet gebruikt, en de browserextensie kan gemeten stijlen melden uit een steekproef van zichtbare elementen. Dit zijn waarnemingen: er wordt niets geïnstalleerd, en bronspacing vervangt nooit je eigen. **Choose individual items in the tray** behoudt losse items, en **Download design context** slaat een JSON-rapport op met waarnemingen, voorgestelde tokens en broninformatie (met een SHA-256 van aangeleverde HTML of CSS). Het rapport bevat geen ruwe paginatekst en is geen ondertekende Content Credential.

Imports van PDF en ontwerpbestanden houden hun eigen reviewbediening. Items in de **Tray** veranderen niets totdat je ze toevoegt in de kamer die dat soort materiaal bezit. `#/start?source=<kind>` opent de kiezer op een bron (`file`, `pdf`, `image`, `font`, `url`, `page`), en `?import` opent de gewone lijst.

### Een look vinden en vergelijken

Open **Find a look** vanuit Board of vanuit de lijst met design systems in Settings. Blader door systemen die op dit apparaat zijn opgeslagen en een paar herbruikbare Lolly-voorbeelden, en zoek op naam, kleurtag of gedeclareerd lettertype. **Closest to my current palette** sorteert op gemeten kleurgelijkenis, waarbij passende lettertypen gelijke standen beslissen; het is geen kwaliteitsscore.

Klik op een look om hem in context te bekijken. Bekijken wijzigt niets. De **Use this look** van elke kaart gebruikt die look. Een opgeslagen systeem wordt het actieve, wat niets bewerkt. De kleuren van een voorbeeld gaan via het gebruikelijke checkpoint naar het geopende design system, waarvan de logo's, lettertypen en alles wat het voorbeeld niet definieert blijven zoals ze zijn. **Compare looks** voegt een selectievakje aan elke kaart toe, zodat je er twee kunt kiezen en naast elkaar vergelijken. **Restore brand settings** herstelt de vorige look. Opgeslagen systemen hebben bewerkbare **Search tags** onder **Details and design context**. De voorbeelden zijn originele Lolly-kleurrecepten, zonder verzamelde collectie en zonder account.

![Vergelijk Sunroom en Orchard naast elkaar voordat je een van beide kleursystemen toepast.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

## Je design system bewaren en verplaatsen

### Een merk tussen apparaten verplaatsen

**Export** schrijft één bestand **`LollyBrand-….lolly`**: je tokens, lettertypen, logo's en themavoorkeur, met een integriteitsmanifest dat bij het terugbrengen wordt gecontroleerd. Webreleases vóór 1.0.7 noemden hetzelfde bestand `.zip`, en die schrijfwijze wordt nog geaccepteerd. **Tokens (.json)** schrijft het gewone designtokensdocument op zichzelf, zonder lettertypen of logo's, voor een repository, een buildstap of een andere tokentool.

Om er een terug te brengen gebruik je **Add from… → Design tokens or a design file**, of zet je het bestand op de studio. Zo geeft een collega je een merk, of neem je er een mee naar een tweede installatie, zonder account en zonder cloud. [Samenwerken met partners](/info/partners.html) beschrijft wat je nog meer meestuurt als de ontvanger van je merk voor een andere organisatie werkt. Om een merk vanaf de opdrachtregel binnen te halen, zie [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** pakt de lettertypen die je toevoegde in een installeerbare RPM. Als je er zelf een aantal uploadde, vraagt Lolly je eerst te bevestigen dat je ze mag herdistribueren.

### Eerdere instellingen herstellen

Open **More** in de balk, kies **Restore brand settings**, selecteer een gedateerd checkpoint en druk op **Restore**. Het herstelt kleuren, lettertype-instellingen en andere tokens voor het actieve merk; lettertype- en afbeeldingsbestanden blijven zoals ze zijn. Lolly slaat je huidige instellingen eerst op als **Before restore**, zodat je een herstel kunt terugdraaien, zelfs na het sluiten van de browser. De laatste 20 checkpoints worden op dit apparaat bewaard.

### Versies

Een gepubliceerde versie is een **permanente, benoemde kopie** die op dit apparaat wordt bewaard. Ze verandert nooit, dus een tool of link die haar vastpint (met `designv`) blijft hetzelfde tekenen. Een systeem met iets van jezelf vermeldt **Versions & publishing** in het menu **More** van de balk; na je eerste publicatie komt **Versions** erbij bij de kamers. `#/start?area=versions` opent hem direct.

- **Een versie is permanent.** Verwijderen kan nog niet, en het paneel zegt dat.
- **Verwijderingen staan voorop in de compatibiliteitskaart**, omdat een verwijderd token is wat een tool breekt.
- **Publiceren kan niet ongedaan worden gemaakt; herstellen wel.** *Restore latest from this version* is een gewone bewerking, met direct **Undo** aangeboden.

**Publish only** bewaart een versie zonder te veranderen wat tools volgen; **Publish and make active** laat tools en de app die versie volgen. **Follow the latest again** zet elke bewerking live op het moment dat je haar maakt.

### Publish a brand page

Een [merkpagina](/info/brand-page.html) is één adres voor mensen en voor agents: een pagina die de logo's, kleuren, lettertypen en voorbeelden toont, met dezelfde feiten in bestanden naast de pagina. **Publish a brand page**, onder Versions & publishing, toont de live pagina en, naast de pagina:

- **Goes public**: elk bestand, gegroepeerd, met zijn grootte.
- **Held back**: wat erbuiten bleef, en waarom. Een logo zonder vastgelegde licentie blijft erbuiten totdat je de naam van het logo aanvinkt. Een lettertypebestand heeft een vastgelegde licentie nodig die doorgeven toestaat, en de pagina toont een omlijnd specimen wanneer het bestand erbuiten blijft. Interne merkvaardigheden verschijnen nooit.
- **What was checked**: kleurparen per colourway en modus, en de huisregels. Dit zijn metingen, geen oordeel.
- **In your words**: een gebruiksverklaring en een contactpersoon. De pagina drukt af wat je schrijft en Lolly voegt geen licentie of juridische claim toe. Een schakelaar zet de regel "Made with Lolly" in de voettekst uit.
- **On exports**: een schakelaar die [het adres van de pagina vastlegt in de exports van dit design system](/info/brand-page.html#lead-back-from-your-files). Hij staat uit totdat je hem aanzet, hij heeft een `https`-adres nodig, en hij reist niet mee met een pakket of een kopie. Een vergrendeld design system toont de schakelaar niet, omdat zijn beheerder beslist.

**Download folder** slaat de map op als ZIP om te hosten waar je wilt, en er wordt niets openbaar totdat je dat doet. In een terminal schrijft `lolly system publish --out=<dir>` dezelfde map. Een instantie die merkpagina's serveert, biedt ook **Publish to** zijn adres, wat één expliciete druk is en door zijn goedkeuringsketen gaat wanneer die er is. Een beheerd design system publiceert alleen wanneer zijn beheerder dat toestaat.

### Connect an agent

**Connect an agent**, op dezelfde plek, geeft je tekst om te plakken en zegt wat elke optie kan:

- **`AGENTS.md`** in een project: agents lezen de namen en regels van het systeem. Het tekent niets en heeft geen server nodig.
- **Lolly's publieke server**: tekent met Lolly Demo, welk systeem je hier ook open hebt. Het heeft geen sleutel nodig.
- **Je instantie**: tekent met de systemen die de instantie bevat, en leest een servicetoken uit een omgevingsvariabele. Het blad geeft de naam van de variabele en toont nooit een token.

Wanneer geen gehoste server met jouw systeem tekent, zegt het blad dat.

## Je design systems beheren

Open **Settings → Preferences → Design systems** om systemen te wisselen, toe te voegen of te verwijderen. **Open** selecteert een systeem en opent het hier; **Make a new one** maakt een lokaal systeem en opent het met zijn naamveld klaar. Eén systeem is tegelijk actief, voor het hele apparaat. [Merkarchitecturen](/info/brand-architectures.html) helpt beslissen wanneer een merk een eigen design system nodig heeft.

**Waar een systeem vandaan komt.** Het systeem dat de catalogus van een implementatie levert, leest **Came with this app**, of **From this instance** in een app die met een instantie is verbonden. Klap **Catalogue source** uit om te zien wie het levert, zijn tokensasset en namespace en zijn bekende versie of checksum; als een verversing mislukt, wordt materiaal uit de cache gelabeld.

**Beheerde systemen zijn alleen-lezen.** Een systeem leest **Managed by this instance** (of **Managed by this app** in de desktop-app zonder instantie) wanneer zijn catalogus het systeem vergrendelt. Je kunt het gebruiken en downloaden, en het hier openen toont een alleen-lezennotitie met **Make an editable copy** en **Switch**, daarna zijn kleurrollen en tokens zonder bewerkbediening. Je eigen lokale systemen blijven bewerkbaar, ook wanneer het beheerde eerst kwam. Een build met één vast merk opent Lolly Design System Setup op *This brand is set*, met de tokens en gebruiksregels van het merk om te lezen.

**Elk ander geleverd systeem is van jou** om te verbergen, te bewerken en te resetten, inclusief Lolly Demo en Lolly Starter op lolly.tools. Er een bewerken behoudt zijn naam en markeert de rij **Edited here**, en **Reset to original** in zijn menu gooit de wijzigingen weg die op dit apparaat zijn gemaakt. De lege starter is de uitzondering: een eerste wijziging daar begint een eigen design system, dus Lolly vraagt één keer hoe het nieuwe systeem moet heten. [Lolly Demo in gebruik](/info/lolly-demo-in-use.html#switch-to-your-own) toont wat je eigen systeem vervangt.

### Een design system verwijderen

Kies **Remove** in het menu van een systeem; de bevestiging zegt welk systeem daarna actief is. Opgeslagen sessies, uploads en materiaal dat met een ander systeem wordt gedeeld, blijven.

Een geleverd systeem verwijderen verbergt het alleen: zijn catalogusassets blijven, **Bring back** toont het weer en het keert vanzelf terug als je al het andere verwijdert. Een geïmporteerde of bewerkte kopie verwijderen verwijdert het geleverde systeem, zijn logo's of zijn lettertypen niet, en als de kopie actief was, wordt het geleverde systeem weer actief. Een actieve gehoste kopie verwijderen wist alleen de verbinding van die kopie; een apart gekozen instantie blijft geselecteerd.

Wijzigen wat een server aanlevert is een taak voor een beheerder: de operator wijzigt de broncatalogus en implementeert opnieuw, of een Lolly Work-beheerder beoordeelt en past een serverwijziging toe. Bewerkingen hier blijven lokaal, met één uitzondering: op een Lolly Work-instantie die jou `brand.edit` toekent, biedt een beheerd systeem ook **Edit for** die instantie, wat een bewerkingskopie opent, en **Send to** die instantie in **Versions** stuurt zijn kleuren, colourways, kleurrollen en merkpagina-adres terug. [Edit this instance from the studio](/info/work-design-system-administration.html#edit-this-instance-from-the-studio) behandelt wat een bewerking kan wijzigen en hoe de instantie de wijziging serveert. Zie [Removing a catalogue design system](/info/configuration.html#removing-a-catalogue-design-system) en [Configuration](/info/configuration.html#supplied-and-local-design-systems).

## Designcontext buiten de app gebruiken

**Download design context** slaat het tokendocument op, de opgeloste kleuren, gedeclareerde lettertypefamilies, asset-id's, bronbewijs waar vastgelegd, dekking en expliciete regels, zonder lettertypebestanden en zonder bewijs van eigendom. De opdrachtregel leest het bestand zonder server: `lolly system import` maakt het het design system van de terminal en `lolly system check` controleert Lolly Design-invoer tegen de opgeslagen context. [Bring your design system](/info/cli.html#bring-your-design-system) behandelt de import en [Which design system a command uses](/info/cli-decks.html#which-design-system-a-command-uses) behandelt de controle, en een MCP-client leest dezelfde brief uit `lolly://design-context` ([MCP Server](/info/mcp.html)).

## Waar je hierna heen kunt

- **[Lolly gebruiken](/info/using.html)**: de tools, opslaan, delen en Assets.
- **[Merkarchitecturen](/info/brand-architectures.html)**: hoe divisies, producten, gesteunde merken, klanten en seizoenen aansluiten op design systems, colourways en logo-identiteiten.
- **[Werken met partners](/info/partners.html)**: je merk delen met een partner, en werken in een merk dat je hebt gekregen.
- **[Merkpagina's](/info/brand-page.html)**: publiceer je design system op één adres, als perskit en als agentkit.
- **[Design Tokens](/info/design-tokens.html)**: het tokenmodel waarin je merk is geschreven.
- **[Een bestand exporteren](/info/exporting.html)**: drukeenheden, CMYK en de formaten waarin je merk rendert.
