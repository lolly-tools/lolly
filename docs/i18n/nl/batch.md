# Lolly Batch en Lolly Multi-edit

<a id="batch-and-multi-edit"></a>

**Lolly Batch** maakt veel versies van één ontwerp, zoals een kaart in twaalf talen of elk formaat van een banner. **Lolly Multi-edit** voert één wijziging door, zoals een nieuwe datum of kop, in meerdere verschillende opgeslagen ontwerpen.

Beide draaien op je apparaat en exporteren via hetzelfde renderpad als de tools.

::: cols
## Batch

- Eén sjabloon, veel rijen. Elke rij is één set invoerwaarden en maakt één bestand.
- Vul de rijen door te typen, uit een spreadsheet te plakken of een CSV te importeren.
- Geen limiet op het aantal rijen; er worden er 50 per pagina getoond.
- Opent via **Lolly Batch** in de kop van Projects (`#/batch`).

<a id="multi-edit"></a>
## Lolly Multi-edit

- Twee tot acht verschillende opgeslagen ontwerpen, naast elkaar als live kaarten.
- Eén zijbalk bewerkt de gedeelde invoer en daarna de eigen invoer van elke kaart.
- Elk ontwerp wordt weer opgeslagen waar het vandaan kwam.
- Opent via **Edit together** in de selectiebalk van Projects.
:::

<!--i:eti-table-->
## Veel versies van één ontwerp maken

Open de weergave **Projects** en druk op **Batch** in de kop. Het raster begint met één rij. Kies een sjabloon in die rij en dupliceer de rij of plak gegevens uit een spreadsheet. Als je Batch vanuit een map opent, brengt het je terug naar die map.

![Batch met een nieuw raster: de bestandsnaam en de rijtools bovenaan, en de sjabloonlijst van de eerste rij geopend op de tools die je kunt kiezen](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Vul de rijen.** Typ in een cel of plak een blok uit Excel, Google Sheets of een andere spreadsheet. **Import CSV** voegt rijen toe of vervangt de batch. Wanneer je plakt in een cel met exportinstellingen, vraagt Lolly welke invoer elke geplakte kolom vult. **Export CSV** schrijft het raster weg. Open **Columns** onder het raster om meer invoer te tonen, of breedte, hoogte, eenheid en DPI per rij. De popover **Fill** van een getal-, tekst- of keuzekolom heeft ook een sectie **Design token** die één token koppelt aan alle rijen van de kolom ([Veel documenten tegelijk koppelen](/info/token-workflows.html#link-many-documents-at-once)).

**Stel de uitvoer in.** De toolbalk stelt de bestandsnaam van de zip, het **Default format**, de eenheden en DPI in voor elke rij. Het formaatmenu is de gegroepeerde lijst uit het exportpaneel met de formaten die de catalogus biedt en je browser ondersteunt. Een rij met een eigen formaat, grootte of bestandsnaam behoudt de eigen instelling.

**Renderen.** **Render all** exporteert elke rij naar één `.zip`. Met geselecteerde rijen werken **Render selected**, **Export selected CSV** en **Print selected rows** alleen op die rijen. Wis de selectie om weer met de hele batch te werken. **Print sheet** plaatst de rijen op een afdrukbaar blad. **Batch activity** meldt elke import en render en is inklapbaar.

**Bewaar de batch.** **Sessions** slaat elke rij van het raster op als een benoemde batchsessie, ongeacht wat geselecteerd is. De sessie opent opnieuw vanuit Projects. **Folders…** in hetzelfde menu opent een Projects-map als rijen, één per opgeslagen sessie; elke bestandsnaam bevat het mappad.

::: details Rijen en cellen selecteren
Selecteer rijen met hun selectievakjes of klik met Shift op een selectievakje voor een bereik. Het selectievakje in de kop selecteert de huidige pagina en **Select all *N* rows** neemt ook de rijen op andere pagina's mee. Selecties blijven behouden wanneer je tussen pagina's wisselt. **Edit input**, **Duplicate** en **Remove** werken op de geselecteerde rijen en **Undo remove** herstelt de laatst verwijderde rijen. Vanuit een cel met focus selecteert Shift+Space die rij en wist Escape de selectie.

Sleep over cellen, klik met Shift op een cel of gebruik Shift+pijltjestoetsen om een rechthoek te selecteren. **Copy cells**, of Ctrl+C / Command+C, kopieert de waarden voor een spreadsheet. Ctrl+A / Command+A vanuit een cel met focus selecteert elke zichtbare kolom op elke pagina; vanuit een selectievakje van een rij selecteert dezelfde sneltoets elke rij. Cellen selecteren laat aangevinkte rijen aangevinkt. Dubbelklik op een cel of druk op Enter om de tekst te bewerken. Plak een rechthoek vanaf het klembord of plak één waarde om elke geselecteerde cel te vullen; lege cellen en tekst met meerdere regels behouden hun posities.
:::

### Colourways en thema's per rij

Elke rij houdt zijn eigen themakeuzes: licht of donker en een colourway wanneer het design system die heeft. Een rij die vanuit Projects, een map of een opgeslagen batch is geopend, rendert en toont een voorbeeld met de keuzes waarmee de sessie is opgeslagen. Het afdrukblad, een gedupliceerde rij en een gevulde rij behouden ze.

Een CSV bevat de keuzes in een kolom `_themes` na de groottekolommen. De kolom bevat dezelfde JSON als de linkparameter `_themes`, bijvoorbeeld `{"":"dark","colourway":"beach"}`. Een lege cel, of `{}`, betekent de standaardwaarden van het design system. De kolom wordt alleen geschreven wanneer er een rij met keuzes is. Bij import wordt een cel zonder geldige themakeuzes als probleem vermeld en rendert de bijbehorende rij met de standaardwaarden.

::: note Stel de keuzes van een rij in de CSV in
Het raster heeft nog geen bediening om de keuzes van een rij te wijzigen, dus stel ze in de CSV of in de opgeslagen sessie in.
:::

### Een taal voor elke rij

Een tool die zijn eigen tekst afdrukt, zoals Certificate, kan een kolom `language` gebruiken met een korte taalcode zoals `de`, `ja` of `ar`. Elke rij drukt de tekst en datum dan in die taal af. Arabische en Urdu-rijen worden van rechts naar links opgemaakt. Een lege cel volgt de taal van de app. Een taal waarvoor Lolly nog geen vertaling heeft, wordt in het Engels afgedrukt, inclusief de datum, zodat een certificaat nooit half vertaald is.

### Batch of Render folder

Om sessies die je al hebt opgeslagen opnieuw te renderen, selecteer je ze in Projects en gebruik je **Render selection**, of **Render folder** voor een hele map. [Je werk vinden en herstellen](/info/find-your-work.html#find-something-you-saved) behandelt beide.

<!--i:eti-layers-->
## Meerdere opgeslagen ontwerpen samen bewerken

Vink twee tot acht opgeslagen sessies aan in **Projects** en kies **Edit together** in de selectiebalk. Ze openen naast elkaar als live kaarten op `#/multi?s=<slot>,<slot>…`. Elke kaart is een echte render van de sessie en toont wat er geëxporteerd wordt.

Eén zijbalk stuurt ze allemaal aan:

- <!--i:sliders--> **Shared** komt eerst: elke invoer die twee of meer sessies op dezelfde manier declareren (dezelfde id, hetzelfde type en dezelfde beperkingen, de regel die het batchraster voor zijn kolommen gebruikt). Een wijziging aan een gedeeld bedieningselement bereikt elke sessie die de invoer declareert, live op elke kaart. Twee sessies van dezelfde tool delen alles; twee verschillende tools delen alleen hun gemeenschappelijke invoer. Het menu **Input actions** van de Shared-kaart koppelt een design token in elke sessie die de invoer declareert.
- <!--i:document--> Onder de Shared-kaart bevat **één ingeklapte kaart per sessie** alle eigen invoer van die sessie, zoals in de zijbalk van de tool zelf, met een compact exportblok: **Format**, **W** / **H**, **Unit**, **DPI** en **Download**. Die Download slaat de sessie eerst op en rendert dan het bestand met dezelfde bestandsnaam, hetzelfde formaat en dezelfde Content Credentials als vanuit de tool.
- <!--i:search--> **Filter inputs…** bovenaan beperkt de getoonde bediening op alle kaarten tegelijk.

Klik op een kaart (of druk op Enter op de kaart) om de zijbalkkaart van die sessie te openen. **Save all** schrijft elke sessie terug naar zijn eigen slot. **Download all** slaat eerst op en rendert de set dan naar één zip, zoals **Render selection** in Projects, en biedt de optionele wachtwoordvergrendeling.

Elke kaart tekent met de themakeuzes van de eigen sessie, inclusief een tool die in het ontwerp is geplaatst. De app rond de kaarten behoudt zijn eigen kleuren. **Save all**, de downloads, **Batch grid** en **Send to Print Sheet** behouden de keuzes van elke sessie.

### Beperkingen

- **Maximaal acht.** Elke kaart laadt zijn eigen live runtime en acht kaarten blijven vlot reageren. Een link die om meer vraagt, of om een sessie die niet meer bestaat, meldt dat en laadt niet gedeeltelijk.
- **De link is lokaal.** Hij noemt je eigen opgeslagen slots en heropent die set op dit apparaat. Het is geen deellink.
- **Voor grotere aantallen** kies je **Edit as sheet** in dezelfde selectiebalk. De selectie opent als rijen in het batchraster (`#/batch?s=…`), zonder groottelimiet en zonder de eis dat alles dezelfde tool gebruikt. Mappen blijven buiten beide: open een map in het raster met **Sessions → Folders…** of render een map met **Render folder** in Projects.
- **Zoeken bereikt Lolly Multi-edit niet.** Het is de enige weergave die de zoekbalk niet doorzoekt.

<!--i:eti-map-pin-->
## Waar je verder kunt

- **[Een bestand exporteren](/info/exporting.html)**: de formaten, afmetingen en drukwerkinstellingen die elke rij kan gebruiken.
- **[Sjablonen](/info/templates.html)**: uitgangspunten die een goede eerste rij opleveren.
- **[Je werk vinden en herstellen](/info/find-your-work.html)**: Projects, mappen en renderen wat je hebt opgeslagen.
