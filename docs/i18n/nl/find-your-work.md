# Je werk terugvinden en herstellen

Vind een ontwerp dat je nooit hebt opgeslagen, een bestand dat je hebt gedownload, de versie van vorige week of je werk nadat de browser is gewist. Begin bij de tabel.

Persoonlijk werk blijft in de browser of app waarin je het maakte, op dat apparaat, tenzij je [Sync](/info/sync.html) inschakelt. Een organisatie die het optionele Lolly Work gebruikt, bewaart ook **Team projects** op haar server.

| Wat je deed | Waar je moet kijken |
|---|---|
| Op **Save as** of **Save** gedrukt | **Projects** |
| Op **Download** gedrukt | De downloads van je browser en een kopie in **Assets** |
| Geen van beide, in een [tool die tijdens het werk opslaat](#which-tools-save-as-you-work) | **Projects** en **History** |
| Geen van beide, in een tool die dat niet doet | Alleen het tabblad waarin je werkte, totdat je het sluit |
| In de app verwijderd | **Trash**, in **Projects**, **Assets** of **Settings → Storage**, gedurende 30 dagen |

::: figure find-your-work-places
Waar je werk staat: de eigen opslag van de browser bevat Projects, History en Trash; downloads gaan naar de mappen op je apparaat; Sync en een back-upbestand zijn de kopieën buiten de browser.
:::

::: details Gedeeld werk vinden in Lolly Work (optioneel)
Open de Lolly van je organisatie, meld je aan en kijk in **Projects → Team projects**. Die instantie bevat gedeelde sessies en toont degene waartoe je toegang hebt. Aanmelden op een ander apparaat kan de toegang tot die sessies herstellen. Aanmelden herstelt je persoonlijke bibliotheek of de back-up van je apparaat niet.

Wacht in een [werksamenwerking](/info/collaborate.html#collabs-through-lolly-work-optional) op **Saved to work** voordat je weggaat. Als een gedeeld project ontbreekt, controleer dan of je met de juiste instantie bent verbonden en vraag de beheerder naar toegang of bewaartermijnen. Browsergegevens wissen verwijdert lokale kopieën, niet de serverkopie van de organisatie. Zie [Lolly gebruiken bij je organisatie](/info/organisation.html).
:::

<!--i:eti-search-->
## Iets terugvinden dat je hebt opgeslagen

1. Druk op **Home** linksboven in de tool.
2. Open het tabblad **Projects** bovenaan het startscherm (het mappictogram op een telefoon).
3. Alles wat je in **My library** hebt opgeslagen staat op het eerste scherm. Elk project is een map. Typ in **Search all projects…** onderaan het scherm om alle mappen te doorzoeken.

Een item krijgt de bestandsnaam die je in het exportpaneel hebt getypt. Zonder bestandsnaam krijgt het de naam van de tool, zoals **QR Code**. Het item openen brengt elke instelling terug. Zie [Opslaan & doorgaan](/info/using.html#saving-continuing) om nieuw werk op te slaan.

::: note Niet in Projects?
- Het staat misschien in **Trash**: zie [Iets terughalen dat je hebt verwijderd](#get-back-something-you-deleted).
- Een andere browser, een privévenster of een ander apparaat begint leeg, tenzij je [Sync](/info/sync.html) gebruikt of [je werk verplaatst](#move-your-work-to-another-device).
- Als je alleen op **Download** hebt gedrukt, zie [Een gedownload bestand vinden](#find-a-file-you-downloaded).
:::

::: details Werken met Projects
Je kunt de weergave **Projects** ook openen vanuit **Settings → Storage → Saved sessions → Organise in Projects**. Het werkt als een bestandsbeheerder:

![Projects voordat er iets is opgeslagen: de tegels New folder, New asset en Templates, de History-klok rechtsboven en de balk Search all projects onderaan](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **Mappen in mappen.** Zet opgeslagen sessies in mappen en mappen in andere mappen, zo diep als je wilt. Maak een map of hernoem er een, of sleep een tegel op een map om de tegel te verplaatsen. Een kruimelpad brengt je weer omhoog. Sessies die zonder map zijn opgeslagen staan in de hoofdmap van **Projects**.
- <!--i:clock--> **Sorteer op je eigen manier.** **View options**, de knop met schuifregelaars rechtsboven, biedt **Grid** of **List** en sorteert op **Name**, **Date added**, **Last modified** (de standaard), **Size** en, binnen een map, **By tool**. Mappen komen altijd eerst. Sessies en mappen worden elk binnen hun eigen groep gesorteerd.
- <!--i:document--> **Berg nieuw werk meteen op.** **New asset** opent de gedeelde kiezer. Kies **Templates** om vanuit een opgeslagen sjabloon te beginnen. Open het sjabloon om het te bewerken, of druk op **+ Add** om een nieuwe creatie meteen op te slaan.
- <!--i:checklist--> **Meerdere selecteren (desktop).** Vink het selectievakje van een tegel aan, sleep een selectiekader over lege ruimte of gebruik **Shift/Cmd-klik**. Voor het contextmenu van een tegel **klik je met rechts** op de tegel. De selectiebalk biedt **Render selection**, **Move to…**, **New folder** en **Delete** (naar Trash). **Edit together** opent twee tot acht sessies van elk één tool naast elkaar met één zijbalk. **Edit as sheet** opent een selectie van elke grootte of samenstelling als rijen in het batchraster.
- <!--i:download--> **Render een hele map of selectie.** **Render folder** exporteert elke opgeslagen sessie in een map en de onderliggende mappen als één geneste `.zip`. **Render selection** doet hetzelfde voor een meervoudige selectie. Eén sessie wordt naar een eigen bestand gerenderd.
- <!--i:link--> **Ga direct naar het opgeslagen werk van een tool.** Vink een of meer tools aan in de Tools-galerij en kies **View sessions** in de selectiebalk. Projects toont dan alleen de sessies die met die tools zijn gemaakt. **Clear** brengt de volledige weergave terug.
- <!--i:link--> **Deel een opgeslagen sessie.** Klik met rechts op een sessie (druk op een telefoon op **•••** op de tegel) en kies **Share link**. De link heropent de sessie met dezelfde instellingen. Afbeeldingen van je apparaat gaan niet mee met een link. Zie [Je werk delen](/info/using.html#sharing-your-work) voor de volledige Share-dialoog.
- <!--i:pentool--> **Hernoem of kopieer een sessie.** Hetzelfde menu bevat **Rename**, **Duplicate** (een kopie in dezelfde map) en **Move to…**.

![De popover View options in Projects: Layout met Grid en List, en Sort by ingesteld op Last modified, naast een knop die de volgorde omkeert](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
<!--
SHOT NOTE (misc-projects-sort): trigger button confirmed as
`.filter-fab.projects-viewopts` in views/projects.ts (openViewOpts() is bound
to `.projects-viewopts` specifically) - `.projects-viewopts` alone is the
more specific hook, so that's what drives the click. The popover it opens
(`.projects-viewmenu`, also confirmed directly in openViewOpts()) is body-
appended, not nested under the Projects root, so cropSelector finds it
regardless. "By tool" only appears inside a folder - this recipe captures at
the Projects ROOT (`url=/#/p`), so if the capture pass wants "By tool"
visible too, point url= at a real folder instead: the route is a path
segment, `/#/p/<folderId>` (confirmed in main.ts's hash router - `parts[0]
=== 'p'` reads `folderId` from `parts[1]`), not a query param. Caveat: a
folder has to already EXIST in the capture profile, which a per-shot fresh
context has none of.
The popover (views/projects-view-options.ts, checked 2026-09-26) holds a
Layout pair (Grid / List) and a Sort by menu with a reverse button; the
options inside the menu (Name, Date added, Last modified, Size, By tool) are
not visible in the closed menu, so the alt does not list them.
-->

:::

<!--i:eti-refresh-->
## Als je het tabblad hebt gesloten of de tool hebt verlaten

Wat terugkomt hangt af van hoe je wegging en van de tool:

- **Je hebt het tabblad gesloten of kwam later terug.** Niet-opgeslagen werk is weg, behalve in de [tools die tijdens het werk opslaan](#which-tools-save-as-you-work). Open dat werk vanuit **Projects**.
- **Je hebt de pagina in hetzelfde tabblad herladen.** Je instellingen komen terug vanuit het pagina-adres. In tools die niet tijdens het werk opslaan bevat het adres geen afbeeldingen en bestanden van je apparaat of tekst op één regel van meer dan 150 tekens, dus die komen niet terug.
- **Je hebt op Home of op de terugknop linksboven gedrukt.** Als je iets hebt gewijzigd sinds je voor het laatst hebt opgeslagen, gedownload of gekopieerd, vraagt een dialoog **Unsaved edits** of je eerst wilt opslaan. **Save & leave** slaat het werk op en brengt je naar **Projects**, of terug naar de projectmap van waaruit je het werk opende. **Leave anyway** verwijdert je wijzigingen. Een opgeslagen item gaat terug naar de laatst opgeslagen versie en een creatie die je nooit hebt opgeslagen verdwijnt uit **Projects**. **Cancel** houdt je in de tool.

::: warning Het tabblad sluiten vraagt niet eerst om bevestiging
Het tabblad sluiten, herladen en de eigen terugknop van je browser vragen nooit om bevestiging. Druk voor de zekerheid op **Save as** of op **Save** in het exportpaneel voordat je een tool verlaat.
:::

Als automatisch herstel niet beschikbaar is, geeft een notitie naast de bewerkingsbediening aan wat je moet bewaren:

- Sla in een tool die werkt met een bestand dat je zelf aanlevert je instellingen op en bewaar ook de oorspronkelijke bestanden.
- Sla in een opnametool of een hulpprogramma zonder Save-actie het resultaat op of download het voordat je weggaat.
- De desktop- en mobiele apps geven aan wanneer je handmatig moet opslaan.
- In een privésamenwerking bewaart degene die de uitnodiging stuurde het document en de geschiedenis, inclusief de wijzigingen van de ander. Degene die deelnam werkt met een tijdelijke kopie en moet een aparte kopie opslaan voordat de sessie eindigt.

::: note Per ongeluk weggegaan zonder op te slaan?
In tools die tijdens het werk opslaan bewaart History 30 dagen lang een kopie van de verworpen wijzigingen. Open de pagina **History**, zoek ze onder **Changes** en druk op **Open as a copy**. In andere tools zijn de wijzigingen weg.
:::

::: details Welke tools tijdens het werk opslaan
In de webapp slaat elke tool die een document maakt tijdens het werk op, zoals Lolly Design, Lolly Chart, QR Code, Text en Lolly Sandbox. Deze tools doen dat niet:

- tools die werken met een bestand dat je zelf aanlevert, zoals Redact, Sign of Convert Image, omdat Lolly nooit een kopie van dat bestand bewaart;
- tools die opnemen vanaf je camera, microfoon of scherm, zoals Record, Lolly Screen Capture en Lolly Voice Recorder;
- een tool waarin niets te wijzigen is, zoals Countdown.

In de andere tools plaatst je eerste wijziging het werk in **Projects**, alsof je het had opgeslagen. Latere wijzigingen worden bewaard zodra de tool klaar is met tekenen. Een niet-opgeslagen creatie blijft in Projects nadat je het tabblad sluit en heropent met de wijzigingen als niet-opgeslagen gemarkeerd.

**Leave anyway** verwijdert die wijzigingen nog steeds. De tool opnieuw openen vanuit het startscherm begint een nieuwe creatie; open de eerdere vanuit Projects.

3D en Lolly Darkroom slaan tijdens het werk op, maar bewaren geen bestand dat je erin laadt, zoals een 3D-model of een LUT. History en **Save** bewaren de naam, het type en de grootte van het bestand, niet het bestand zelf. Als je het werk opnieuw opent, vermeldt een notitie welk bestand het was en werkt de tool zonder het bestand totdat je dat bestand opnieuw laadt. Bewaar je oorspronkelijke bestanden.

Met [Sync](/info/sync.html) ingeschakeld gaat een creatie die zo is opgeslagen naar je andere apparaten. De versies blijven op het apparaat waar ze zijn gemaakt.

Als een creatie in twee tabbladen openstaat en je in beide opslaat, blijft de laatste opgeslagen versie bewaard. Het vervangen werk staat onder **Protected drafts** in de History van de creatie, met **Open draft as a copy**.

Dit werkt alleen in de webapp, niet in de desktop- of mobiele apps en niet terwijl je live met iemand anders werkt.
:::

<!--i:eti-download-->
## Een gedownload bestand vinden

In een browser geeft **Download** het bestand aan je browser. De browser slaat het bestand op in zijn downloadmap (meestal **Downloads**) of vraagt je waar. Lolly krijgt niet te horen waar het bestand naartoe ging, dus kijk in de downloadlijst van je browser.

Als er geen bestand verscheen, kijk dan in het exportpaneel terwijl je nog in de tool bent. Onder **Download** staat een regel met de bestandsnaam en het tijdstip, met **Retry download**. In Chrome, Edge en andere Chromium-browsers biedt de regel ook **Save file…** om een map te kiezen. De regel en het bijbehorende bestand blijven beschikbaar totdat je de tool verlaat, herlaadt of opnieuw exporteert.

Lolly bewaart na elke download ook twee dingen:

- **Een kopie van het bestand**, in **Assets** onder **Your uploads**, zolang **Save my renders to my library** aanstaat onder **Settings → Your renders** (**Settings** staat onderaan het startscherm). De instelling staat standaard aan. Een video of een bestand van meer dan 50 MB vraagt eerst om bevestiging. Een zip wordt niet gekopieerd.
- **De instellingen die je gebruikte**, voor je laatste 24 downloads. **Recent exports**, onder je opgeslagen werk in **Projects**, heropent de tool met die instellingen. Afbeeldingen en bestanden die je vanaf je apparaat hebt toegevoegd zitten er niet bij. Dezelfde lijst staat onder **Settings → Activity & stats → Latest exports** en op het tabblad **Changes** van **History**.

::: details In de desktop- en mobiele apps
- **Desktopapp:** **Download** slaat op in een map **Lolly** binnen je map **Downloads**, zonder dialoog. De regel onder **Download** geeft aan waar het bestand naartoe ging, zoals "Opgeslagen in Downloads/Lolly", met **Show in folder**. **Open Exports Folder**, in het menu **Window** of **Exports**, opent de map op elk moment. Een bestand met dezelfde naam als een eerder bestand wordt opgeslagen als "name (1)".
- **iPhone en iPad:** het bestand wordt opgeslagen in de app **Files**, onder **Lolly**, en het deelpaneel opent. De regel onder **Download** luidt "Opgeslagen in Files → Lolly".
- **Android:** het deelmenu opent. Kies waar het bestand naartoe gaat.

Op iPhone, iPad en Android vervangt een nieuw bestand een eerder bestand met dezelfde naam.
:::

<!--i:eti-history-->
## Terug naar een eerdere versie

- **Tijdens dit bezoek:** **Undo** gaat terug door je laatste 100 wijzigingen, totdat je de tool verlaat of herlaadt. Zie [Ongedaan maken en opnieuw](/info/using.html#undo-and-redo).
- **In [tools die tijdens het werk opslaan](#which-tools-save-as-you-work):** eerdere versies van elke creatie blijven bewaard.
- **Alles op het apparaat:** met [Sync](/info/sync.html) ingeschakeld brengt **Restore an earlier copy**, onder **Settings → Connected services**, een van de laatste zeven dagelijkse kopieën terug of de kopie van vóór de laatste keer dat je er een toepaste. Alles op dit apparaat komt dan overeen met die kopie.

Zo open je een eerdere versie:

1. Druk op **History**, de klokknop naast **Undo** en **Redo**. In Lolly Design staat **History** in de bovenbalk. Druk op een telefoon op **•••** en daarna op **History**. In tools zonder **Undo**, zoals Text en Lolly Sandbox, staat **History** naast **Home** linksboven.
2. Zoek de versie op datum en tijd. Rijen met **Automatic checkpoint** worden tijdens het werk vastgelegd; rijen met **Saved version** zijn de momenten waarop je opsloeg.
3. Druk op **Open as a copy**. De versie opent als een nieuwe creatie en de creatie die je open had blijft zoals die was. De kopie staat in **Projects**, met "(copy)" achter de naam.

Druk op **Name version**, typ een naam en druk op **Keep milestone** om een versie onder een naam te bewaren. Benoemde versies staan op de pagina **History**, onder **Milestones**.

::: details Het History-paneel en de History-pagina
Het paneel **History** vermeldt ook rijen met **Recovered work**, en **Protected drafts** bevat je laatste wijzigingen tussen controlepunten, met **Open draft as a copy**. **Lolly Compare** en **Check assets** helpen je kiezen voordat je een kopie opent. Schakel **This creation** naar **All history on this device** om elke creatie te zien.

Automatische controlepunten worden minder dicht bewaard naarmate ze ouder worden: één per minuut voor het laatste uur, één per uur voor de laatste dag, één per dag gedurende 30 dagen en daarna één per week. Alle opgeslagen en benoemde versies blijven bewaard. Een creatie verwijderen verplaatst ook de versies naar **Trash**, en **Delete forever** verwijdert ze.

Als de opslag voor History vol raakt, worden eerst de oudste automatische controlepunten verwijderd van creaties die je 30 dagen niet hebt geopend. Ook dan blijft wat je opslaat altijd bewaard. Het wordt als het huidige werk opgeslagen en History geeft aan dat deze opslag niet als versie wordt bewaard. **Settings → Storage** toont hoeveel ruimte History gebruikt.

De pagina **History** (`#/history`) omvat elke creatie in deze browser. Druk om de pagina te openen op de klokknop rechtsboven op het startscherm of in **Projects**, kies **Saved sessions** in het profielmenu (op een telefoon de ronde logoknop rechtsboven) of druk op **Open app history** in het History-paneel van een tool. De desktop- en mobiele apps hebben geen History-pagina. Daar openen de klokknop op het startscherm en **Saved sessions** de weergave **Your recent work**: je laatst opgeslagen sessies en exports, met een link naar Projects.

- **Recent** toont je creaties, de nieuwste eerst, met **Resume**.
- **Changes** zet controlepunten, downloads en resultaten van Convert op één tijdlijn. Een download heeft **Reopen settings**.
- **Milestones** toont benoemde versies.

Elke creatie is een tegel met een afbeelding. **Grid** of **List** wisselt de lay-out. Filter op project, tool en datum (achter **Filters** op een telefoon). Het menu van een tegel (rechts klikken of lang indrukken) biedt **Resume**, **Versions**, **Show in Projects** en **Move to Trash**. Selecteer er meerdere en kies **Move to Trash** om ze te verwijderen. Daarbij wordt Undo aangeboden.
:::

<!--i:eti-folder-move-->
## Je werk naar een ander apparaat verplaatsen

| Om | Gebruik |
|---|---|
| Je apparaten gelijk te houden | **Sync across devices**, onder **Settings → Connected services**: zie [Je apparaten synchroniseren](/info/sync.html) |
| Alles eenmalig te verplaatsen | **Export my data** en **Import data…**, hieronder |
| Eén ontwerp of één project over te dragen | Een `.lolly`-bestand: **Export**, dan **Share**, dan **Download .lolly**; voor een heel project **Download project (.lolly)** in het menu van de map. Druk op **Open** op het andere apparaat. Zie [Het .lolly-bestand](/info/using.html#the-lolly-file) |

Een deellink bevat je instellingen, maar geen afbeeldingen of bestanden die je vanaf je apparaat hebt toegevoegd.

::: note Importeren voegt toe en verwijdert niets
Mappen, favorieten en sjablonen in het bestand worden toegevoegd aan wat al op het andere apparaat staat. Als een opgeslagen item op beide staat, blijft de meest recent opgeslagen kopie bewaard. Je gegevens en instellingen op dat apparaat blijven zoals ze zijn. Lege waarden worden vanuit het bestand ingevuld. **Bring it to this device**, in Sync, werkt op dezelfde manier.
:::

Zo verplaats je alles eenmalig:

1. Open op het oude apparaat **Settings → Storage** en druk onder **Move to another device** op **Export my data**. Lolly downloadt één `.zip`-bestand waarvan de naam begint met `LollyTools-`.
2. Zet het bestand over via USB, een e-mail aan jezelf, AirDrop of een gedeelde map.
3. Open op het nieuwe apparaat **Settings → Storage**, druk op **Import data…**, kies het bestand en druk op **Import**.

::: note Wat achterblijft
Aanmeldingen, sleutels en de synchronisatiewachtzin blijven op elk apparaat. De lijst met recente downloads, offline downloads en AI-modellen gaan via geen enkele route mee. Versiegeschiedenis gaat alleen mee in een **Export my data**-bestand, niet via Sync of een `.lolly`. Als de geschiedenis te groot is voor één bestand, worden de oudste automatische controlepunten weggelaten en geeft de exportregel aan hoeveel. Je kunt een kopie die Sync in je opslag bewaart downloaden en openen, of de kopie kiezen in **Import data…**, net als een back-upbestand. Een versleutelde kopie vraagt om je wachtzin.
:::

::: details Wat het back-upbestand bevat
Het bestand heet `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`. De naamdelen komen uit je profiel en worden weggelaten als ze niet zijn ingevuld. `<n>` telt de exports van dezelfde dag. Het bevat je profiel, met je mappen, Trash, sjablonen en favorieten; elke opgeslagen sessie met de miniatuur; je geüploade afbeeldingen, lettertypen, logo's en de kopieën van je downloads; je design systems; je voorkeuren (thema, zijbalkbreedte, lokale activiteitsstatistieken); opgeslagen versies en resultaten van Convert; en vanuit de webapp de versiegeschiedenis van je creaties.

De cataloguscache zit er niet bij. Het nieuwe apparaat downloadt de cache opnieuw. Elk onderdeel heeft een controlesom, zodat de import een bestand herkent dat onderweg is beschadigd. Opgeslagen sessies worden opnieuw aan je geïmporteerde afbeeldingen gekoppeld. De web-, desktop- en mobiele apps lezen hetzelfde bestand. De terminalapp maakt een eigen, eenvoudigere back-up die dit formaat niet leest. **Export my data & render everything** maakt hetzelfde bestand plus een tweede zip met elke opgeslagen sessie gerenderd naar de bijbehorende uitvoer. Het volledige formaat staat in [Gegevensoverdracht](/info/data-transfer.html).
:::

<!--i:eti-globe-->
## Als je je browsergegevens wist

In de webapp bewaart Lolly alles in de opslag van je browser voor deze site: opgeslagen werk, afbeeldingen, lettertypen, design systems, versiegeschiedenis en offline downloads. De gegevens van deze site in je browser wissen verwijdert dat allemaal en Lolly kan er niets van terughalen. Wat overblijft is wat de browser al heeft verlaten: bestanden die je hebt gedownload, een **Export my data**-bestand, een [Sync](/info/sync.html)-kopie en links die je hebt gedeeld.

::: warning Voordat je browsergegevens wist
Druk op **Export my data** onder **Settings → Storage** en bewaar het bestand ergens anders.
:::

Als de app start, vraagt Lolly de browser zijn opslag niet te wissen wanneer het apparaat weinig ruimte over heeft. De browser beslist. Onder **Settings → Available offline** betekent een regel die begint met **Protected** dat de browser akkoord is gegaan. "De browser kan downloads wissen als het apparaat weinig ruimte over heeft" betekent dat hij niet akkoord is gegaan, en **Protect downloads** vraagt het opnieuw.

Als de browser niet akkoord is gegaan, kan hij zowel opgeslagen werk als downloads wissen wanneer er weinig ruimte over is. Bewaar daarom een recent **Export my data**-bestand.

**Settings → Storage** toont hoeveel ruimte elk soort gegevens gebruikt. De rij **History** telt automatische controlepunten, hun voorbeelden en herstelconcepten. **Remove automatic checkpoints older than 30 days** maakt die ruimte vrij en behoudt opgeslagen en benoemde versies. **Clear cache** verwijdert gedownloade catalogusbestanden, die opnieuw worden gedownload wanneer ze nodig zijn. **Clear all my data** vraagt je een woord te typen, schakelt Sync uit en verwijdert vervolgens alles wat Lolly in deze browser bewaart: je profiel en instellingen, opgeslagen sessies met hun geschiedenis en de Trash, uploads, lettertypen en design systems, het downloadlogboek, resultaten van Convert, gedownloade AI-modellen en offline kopieën. Bestanden die je hebt gedownload blijven waar je ze hebt opgeslagen. De app start daarna alsof het je eerste bezoek is.

![De opslagkaart op een scherm zo breed als een telefoon: elke categorie gegevens op het apparaat benoemd, met de knop Clear all my data onderaan](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

In de desktop- en mobiele apps zijn opgeslagen sessies bestanden in de eigen gegevensmap van de app. Al het andere staat in de eigen opslag van de app. Een webbrowser wissen heeft hier geen invloed op.

::: details Waar de desktop- en mobiele apps opgeslagen sessies bewaren
Eén bestand per opgeslagen sessie, in een map `saved-state`:

- macOS: `~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows: `%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux: `~/.local/share/tools.lolly.Desktop/saved-state/`, of hetzelfde pad onder `$XDG_DATA_HOME`
- iPhone, iPad en Android: in de eigen opslag van de app, die de app Files niet toont

Afbeeldingen, design systems en de lijst met recente downloads blijven in de interne opslag van de app, niet in deze mappen. De terminalapp en de opdrachtregel lezen dezelfde map `saved-state`: zie [Waar opgeslagen sessies staan](/info/cli-reference.html#where-saved-sessions-live).
:::

<!--i:eti-trash-->
## Iets terughalen dat je hebt verwijderd

Als je een opgeslagen sessie, een map, een van je uploads of een van je lettertypen in de app verwijdert, gaat het 30 dagen naar **Trash**, waar je het ook verwijdert: **Projects**, **Assets**, **Settings → Storage** of de lijst met opgeslagen sessies van een tool. Een map en alles daarin gaan als één item naar Trash. Een sessie behoudt haar versiegeschiedenis in Trash. Meteen na het verwijderen biedt een melding **Undo**. Later:

1. Open **Trash**: de tegel **Trash** in **Projects**, de knop **Trash** in **Assets → Your uploads** of de rij **Trash** in **Settings → Storage**. Alle drie openen dezelfde lijst.
2. Druk op **Restore** naast het item. Het gaat terug naar zijn map en een lettertype krijgt de rollen terug die het in zijn design system had.

**Delete forever** verwijdert één item voorgoed. **Empty Trash** vraagt eerst om bevestiging en verwijdert daarna elk item in Trash. Items ouder dan 30 dagen worden voorgoed verwijderd.

::: warning Sommige verwijderingen zijn direct
Een verwijderd design system, logo of verwijderde profielfoto gaat niet naar Trash. De opdrachtregel en de terminalapp verwijderen ook meteen.
:::

Met [Sync](/info/sync.html) ingeschakeld kan **Restore an earlier copy** het hele apparaat terugbrengen naar de staat van een eerdere dag. Een **Export my data**-bestand brengt terug wat het bestand bevat.
