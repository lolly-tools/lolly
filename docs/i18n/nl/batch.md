# Batch en Multi-edit

Zodra je vaak hetzelfde soort bestand maakt, komen twee klussen naar boven. Soms heb je veel versies van één ontwerp nodig: een kaart in een tiental talen, of elk formaat van een banner. Soms heb je meerdere verschillende opgeslagen ontwerpen en wil je dat één wijziging ze allemaal bereikt, zoals een nieuwe datum of een nieuwe kop.

**Batch** doet de eerste klus en **Multi-edit** de tweede. Beide draaien op je apparaat en exporteren via hetzelfde renderpad als de tools zelf.

::: cols
## Batch

- Eén sjabloon, veel rijen. Elke rij is één set invoer en maakt één bestand.
- Vul de rijen door te typen, te plakken uit een spreadsheet of een CSV te importeren.
- Geen grens aan rijen; 50 per pagina getoond.
- Opent via **Batch** in de kop van Projects (`#/batch`).

## Multi-edit

- Twee tot acht verschillende opgeslagen ontwerpen, naast elkaar als live kaarten.
- Eén zijbalk bewerkt de invoer die ze delen, daarna die van elke kaart zelf.
- Elk ontwerp wordt teruggeschreven naar waar het vandaan kwam.
- Opent via **Edit together** in de selectiebalk van Projects.
:::

## Maak veel versies van één ontwerp

Open **Projects** en druk in de kop op **Batch**. Het raster begint met één rij: kies daarin een sjabloon, en dupliceer dan de rij of plak gegevens uit je spreadsheet. Als Batch vanuit een map wordt geopend, brengt het je terug naar die map.

![Batch op een nieuw raster: de bestandsnaam en de rijtools bovenaan, en de sjabloonlijst van de eerste rij open op de tools die je kunt kiezen](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Vul de rijen.** Typ in een cel of plak een blok rechtstreeks uit Excel, Google Sheets of een andere spreadsheet. **Import CSV** voegt rijen toe of vervangt de batch. Wanneer je plakt in een cel die exportinstellingen bevat, vraagt Lolly welke invoer elke geplakte kolom vult. **Export CSV** schrijft het raster terug. Open **Columns** onder het raster om meer invoer te tonen, of breedte, hoogte, eenheid en DPI per rij.

**Stel de uitvoer in.** De werkbalk stelt de bestandsnaam van de zip, het **Default format**, de eenheden en DPI in voor elke rij. Het formaatmenu is de gegroepeerde lijst van het exportpaneel en toont de formaten die de catalogus biedt en je browser ondersteunt. Een rij met een eigen formaat, grootte of bestandsnaam behoudt haar eigen instelling.

**Render.** **Render all** exporteert elke rij naar één `.zip`. Selecteer eerst rijen, en **Render selected**, **Export selected CSV** en **Print selected rows** werken alleen op die; wis de selectie om weer op de hele batch te werken. **Print sheet** legt de rijen uit op een afdrukbaar vel. **Batch activity** meldt elke import en render, en klapt weg om de tabel meer ruimte te geven.

**Bewaar de batch.** **Sessions** slaat het hele raster op als benoemde batchsessie, die later opnieuw opent vanuit Projects. Sessions slaat altijd elke rij op, wat er ook is geselecteerd. **Folders…** in hetzelfde menu opent een hele Projects-map als rijen, één per opgeslagen sessie, waarbij elke bestandsnaam het mappad draagt.

::: details Rijen en cellen selecteren
Selecteer rijen met hun selectievakjes, of Shift-klik op een selectievakje voor een bereik. Het selectievakje in de kop selecteert de huidige pagina, en **Select all *N* rows** neemt ook de rijen op andere pagina's. Selecties blijven staan terwijl je tussen pagina's wisselt. **Edit input**, **Duplicate** en **Remove** werken op de geselecteerde rijen, en **Undo remove** herstelt de laatst verwijderde rijen. Vanuit een cel in focus selecteert Shift+Space die rij en wist Escape de selectie.

Sleep over cellen, Shift-klik op een cel of gebruik Shift+pijltjestoetsen om een rechthoek te selecteren. **Copy cells**, of Ctrl+C / Command+C, kopieert de waarden voor een spreadsheet. Ctrl+A / Command+A vanuit een cel in focus selecteert elke zichtbare kolom op elke pagina; vanuit een rijselectievakje selecteert dezelfde sneltoets elke rij. Cellen selecteren laat aangevinkte rijen aangevinkt. Dubbelklik op een cel of druk op Enter om de tekst te bewerken. Plak een rechthoek van het klembord, of plak één waarde om elke geselecteerde cel te vullen; lege cellen en tekst met meerdere regels behouden hun positie.
:::

### Colourways en thema's per rij

Elke rij behoudt haar eigen themakeuzes: licht of donker, en een colourway wanneer het design system ze heeft. Een rij die vanuit Projects, een map of een opgeslagen batch wordt geopend, rendert in de keuzes waarin haar sessie is opgeslagen, en haar voorbeeld opent daarin. Het afdrukvel, een gedupliceerde rij en een gevulde rij behouden ze allemaal.

Een CSV draagt de keuzes in een kolom `_themes` na de formaatkolommen, met dezelfde JSON als de linkparameter `_themes`, bijvoorbeeld `{"":"dark","colourway":"beach"}`. Een lege cel, of `{}`, betekent de standaardwaarden van het design system. De kolom wordt alleen geschreven wanneer een rij keuzes heeft, dus een batch zonder keuzes exporteert dezelfde CSV als eerder. Bij import wordt een cel die geen geldige themakeuzes is als probleem vermeld en rendert haar rij in de standaardwaarden. Het raster heeft nog geen bediening om de keuzes van een rij te wijzigen, dus stel ze in de CSV of in de opgeslagen sessie in.

### Batch, of Render folder

Batch maakt veel varianten van één sjabloon. Om sessies opnieuw te renderen die je al hebt opgeslagen, selecteer je ze in Projects en gebruik je **Render selection**, of **Render folder** voor een hele map; [Je werk vinden en terughalen](/info/find-your-work.html#find-something-you-saved) behandelt beide.

## Bewerk meerdere opgeslagen ontwerpen samen

Vink tussen twee en acht opgeslagen sessies aan in **Projects** en kies **Edit together** in de selectiebalk. Ze openen naast elkaar als live kaarten op `#/multi?s=<slot>,<slot>…`. Elke kaart is een echte render van haar sessie, dus wat je ziet is wat er wordt geëxporteerd.

Eén zijbalk stuurt ze allemaal aan:

- <!--i:sliders--> **Shared** komt eerst: elke invoer die twee of meer van de sessies op dezelfde manier declareren (zelfde id, zelfde type, zelfde beperkingen, de regel die het batchraster voor zijn kolommen gebruikt). Bewerk een gedeelde bediening één keer en de waarde bereikt elke sessie die de invoer declareert, live op elke kaart. Twee sessies van dezelfde tool delen alles; twee verschillende tools delen alleen de invoer die ze gemeen hebben.
- <!--i:document--> Eronder bevat **één ingeklapte kaart per sessie** alle eigen invoer van die sessie, zo volledig als de eigen zijbalk van de tool, met een compact exportblok: **Format**, **W** / **H**, **Unit**, **DPI** en **Download**. Die Download slaat eerst de sessie op en rendert dan het bestand met dezelfde bestandsnaam, hetzelfde formaat en dezelfde Content Credentials als vanuit de tool.
- <!--i:search--> **Filter inputs…** bovenaan beperkt de bediening op elke kaart tegelijk, zodat je "de kop" in acht sessies kunt bereiken zonder te scrollen.

Klik op een kaart (of druk er Enter op) om de zijbalkkaart van die sessie te openen. **Save all** schrijft elke sessie terug naar haar eigen slot. **Download all** slaat eerst op en rendert dan de hele set naar één zip, op dezelfde manier als **Render selection** in Projects, met onderweg de optionele wachtwoordvergrendeling.

Elke kaart tekent in de themakeuzes van haar eigen sessie, ook een tool die in het ontwerp is geplaatst. Kaarten in verschillende looks staan naast elkaar terwijl de app eromheen haar eigen kleuren behoudt, en **Save all**, de downloads, **Batch grid** en **Send to Print Sheet** behouden de keuzes van elke sessie.

### Grenzen

- **Maximaal acht.** Elke kaart laadt zijn eigen live runtime, en acht is het aantal dat responsief blijft. Een link die om meer vraagt, of om een sessie die niet meer bestaat, zegt dat in plaats van half te laden.
- **De link is lokaal.** Hij noemt je eigen opgeslagen slots, dus hij heropent die set op dit apparaat. Het is geen deellink.
- **Voor iets groters** kies je **Edit as sheet** in dezelfde selectiebalk. Het opent de hele selectie als rijen in het batchraster (`#/batch?s=…`), zonder groottegrens en zonder regel dat het dezelfde tool moet zijn. Mappen blijven buiten beide: open een map in het raster met **Sessions → Folders…**, of render er een met **Render folder** in Projects.
- **Zoeken bereikt Multi-edit niet.** Het is de ene weergave die de zoekbalk niet kent.

## Waar je hierna heen kunt

- **[Een bestand exporteren](/info/exporting.html)**: de formaten, groottes en afdrukinstellingen die elke rij kan gebruiken.
- **[Sjablonen](/info/templates.html)**: startpunten die een goede eerste rij vormen.
- **[Je werk vinden en terughalen](/info/find-your-work.html)**: Projects, mappen en wat je opsloeg renderen.
