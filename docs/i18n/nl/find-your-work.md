# Vind en herstel je werk

Alles wat je in Lolly maakt, blijft in de browser of app waarin je het maakte, op dat apparaat, tenzij je [Synchronisatie](/info/sync.html) aanzet. Opgeslagen werk staat in **Projecten**. Een gedownload bestand staat waar je browser of systeem het neerzette, en meestal wacht er ook een kopie in **Assets**. Bij de meeste tools wordt werk dat je nooit hebt opgeslagen ook bewaard. Deze pagina behandelt elk van deze gevallen, plus een gesloten tabblad, gewiste browsergegevens, eerdere versies, verwijderde items en verhuizen naar een ander apparaat.

| Wat je deed | Waar je moet kijken |
|---|---|
| **Opslaan als** of **Opslaan** ingedrukt | **Projecten** |
| **Downloaden** ingedrukt | De downloads van je browser, en een kopie in **Assets** |
| Geen van beide, in een [tool die opslaat terwijl je werkt](#which-tools-save-as-you-work) | **Projecten** en **Geschiedenis** |
| Geen van beide, in een andere tool | Alleen het tabblad waarin je werkte, tot je het sluit |
| In de app verwijderd | **Prullenbak**, in **Projecten**, **Assets** of **Instellingen → Opslag**, 30 dagen lang |

## Iets vinden dat je hebt opgeslagen

1. Druk op **Home**, linksboven in de tool.
2. Open het tabblad **Projecten** boven aan het startscherm (het mapicoon op een telefoon).
3. Kijk op het eerste scherm. Werk dat is opgeslagen in **Mijn bibliotheek** staat daar, en elk project is een map. Om alle mappen tegelijk te doorzoeken, typ je iets in **Zoek in alle projecten…** onder aan het scherm.

Een item krijgt de naam die je in het exportpaneel hebt getypt, of anders de naam van zijn tool, zoals **QR Code**, als je niets typte. Open het item en elke instelling is terug, klaar om te wijzigen en opnieuw te exporteren. Om nieuw werk op deze manier te bewaren, zie [Opslaan en verdergaan](/info/using.html#saving-continuing).

::: note Niet in Projecten?
- Het kan in de **Prullenbak** staan: zie [Iets terugvinden dat je hebt verwijderd](#get-back-something-you-deleted).
- Een andere browser, een privévenster of een ander apparaat begint leeg, tenzij je [Synchronisatie](/info/sync.html) gebruikt of [je werk verplaatst](#move-your-work-to-another-device).
- Als je alleen op **Downloaden** hebt gedrukt, zie [Een gedownload bestand vinden](#find-a-file-you-downloaded).
:::

::: details Werken met Projecten
Je kunt **Projecten** ook openen via **Instellingen → Opslag → Opgeslagen sessies → Organiseren in Projecten**. Het werkt als een bestandsbeheerder:

![Projecten voordat er iets is opgeslagen: de tegels Nieuwe map, Nieuw asset en Sjablonen, de History-klok rechtsboven en de balk Zoek in alle projecten onderaan](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **Mappen die nesten.** Groepeer opgeslagen sessies in mappen, en mappen in mappen, zo diep als je wilt. Maak een map, hernoem hem of sleep een tegel op een andere map om hem te verplaatsen; een broodkruimelpad brengt je terug omhoog. Sessies die zonder map zijn opgeslagen, verschijnen direct op de root van **Projecten**.
- <!--i:clock--> **Sorteer op je eigen manier.** **Weergaveopties**, de schuifknop rechtsboven, biedt **Raster** of **Lijst** en sorteert op **Naam**, **Datum toegevoegd**, **Laatst gewijzigd** (de standaard), **Grootte** en, binnen een map, **Op tool**. Mappen komen altijd eerst, ongeacht welke sortering actief is - de sortering ordent alleen de sessies en mappen binnen hun eigen groep.
- <!--i:document--> **Breng nieuw werk direct naar binnen.** **Nieuw asset** opent de gedeelde kiezer. Kies **Sjablonen** om te beginnen bij een opgeslagen sjabloon: open hem om te bewerken, of gebruik **+ Toevoegen** om meteen een nieuwe creatie op te slaan.
- <!--i:checklist--> **Meervoudige selectie (computer).** Vink het selectievakje van een tegel aan, sleep een selectiekader over lege ruimte of gebruik **Shift/Cmd-click**; klik met rechts op een tegel voor het contextmenu. De selectiebalk biedt dan **Selectie renderen**, **Verplaatsen naar…**, **Nieuwe map**, **Verwijderen** (dat verplaatst naar de prullenbak), **Samen bewerken** voor twee tot acht sessies van dezelfde tool, naast elkaar onder één zijbalk, en **Bewerken als blad**, dat een selectie van elke grootte of mix opent als rijen in het batchraster.
- <!--i:download--> **Render een hele map of selectie.** **Map renderen** exporteert elke opgeslagen sessie in een map - inclusief submappen - als één geneste `.zip`. **Selectie renderen** doet hetzelfde voor elke meervoudige selectie, en één sessie rendert rechtstreeks naar zijn eigen bestand. Geen Batch/Pro nodig.
- <!--i:link--> **Ga direct naar het opgeslagen werk van een tool.** Vink een of meer tools aan in de Tools-galerij en kies **Sessies bekijken** in de selectiebalk - Projecten opent dan met alleen de sessies die met die tools zijn gemaakt, met een **Wissen** om terug te gaan naar de volledige weergave.
- <!--i:link--> **Deel een opgeslagen sessie.** Klik met rechts op een sessie (op een telefoon, druk op **•••** op de tegel) → **Link delen** om een link te kopiëren die de sessie heropent met dezelfde instellingen; afbeeldingen van je apparaat reizen niet mee met een link (de volledige Deel-dialoog: zie [Je werk delen](/info/using.html#sharing-your-work)).
- <!--i:pentool--> **Hernoem of dupliceer een sessie.** Klik met rechts op een sessie (op een telefoon, druk op **•••** op de tegel) voor **Hernoemen**, **Dupliceren** (een kopie in dezelfde map) en **Verplaatsen naar…**.

![De popover Weergaveopties in Projecten: Layout met Raster en Lijst, en Sorteren op ingesteld op Laatst gewijzigd, naast een knop die de volgorde omdraait](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
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

## Als je het tabblad sloot of de tool verliet

Wat terugkomt, hangt af van hoe je bent vertrokken en welke tool je gebruikte:

- **Je sloot het tabblad, of kwam een andere keer terug.** Niet-opgeslagen werk is weg, behalve in de [tools die opslaan terwijl je werkt](#which-tools-save-as-you-work): open dat werk vanuit **Projecten**.
- **Je herlaadde de pagina in hetzelfde tabblad.** Je instellingen komen terug uit het paginaadres. In tools die niet opslaan terwijl je werkt, komen afbeeldingen en bestanden die je vanaf je apparaat hebt toegevoegd, en tekst van één regel langer dan 150 tekens, niet terug, omdat het adres ze niet bevat.
- **Je drukte op Home, of de terugknop linksboven.** Als je iets hebt gewijzigd sinds je voor het laatst opsloeg, downloadde of kopieerde, vraagt een dialoog **Niet-opgeslagen wijzigingen** of je eerst wilt opslaan. **Opslaan & verlaten** slaat het werk op en brengt je naar **Projecten**, of terug naar de projectmap van waaruit je het werk opende. **Verlaten zonder op te slaan** verwerpt je wijzigingen: een opgeslagen item gaat terug naar hoe je het voor het laatst opsloeg, en een nooit opgeslagen creatie verlaat **Projecten**. **Annuleer** houdt je in de tool.

Lolly vraagt het alleen als je op **Home** of de terugknop drukt in een tool. Het tabblad sluiten, herladen en de eigen Terug-knop van je browser vragen nooit. Om zeker te zijn, druk je op **Opslaan als**, of **Opslaan** in het exportpaneel, voordat je een tool verlaat.

::: note Per ongeluk verlaten zonder op te slaan?
In tools die opslaan terwijl je werkt, bewaart Geschiedenis een kopie van de verworpen bewerkingen. Open de pagina **Geschiedenis**, zoek ze onder **Changes** en druk op **Open as a copy**. In andere tools zijn de wijzigingen weg.
:::

::: details Welke tools opslaan terwijl je werkt
In de webapp slaat elke tool die een document maakt, op terwijl je werkt: Design, Chart, QR Code, Text, Sandbox en de rest. Deze tools doen dat niet:

- tools die werken op een bestand dat je zelf aanlevert, zoals Redact, Sign of Convert Image, omdat Lolly nooit een kopie van dat bestand bewaart;
- tools die opnemen via je camera, microfoon of scherm, zoals Record, Screen Capture en Voice Recorder;
- 3D en Darkroom, die een eigen bestand aannemen;
- een tool zonder iets om te wijzigen, zoals Countdown.

Bij de andere tools archiveert je eerste wijziging het werk al in **Projecten**, alsof je had opgeslagen, en latere wijzigingen worden bewaard terwijl je werkt, zodra de tool klaar is met tekenen. Een niet-opgeslagen creatie blijft dus in Projecten staan nadat je het tabblad sluit, en heropent met zijn wijzigingen als niet-opgeslagen gemarkeerd. **Verlaten zonder op te slaan** verwerpt ze toch, en Geschiedenis bewaart een kopie van de verworpen bewerkingen gedurende 30 dagen. De tool opnieuw openen vanaf het startscherm begint een nieuwe creatie; open de eerdere vanuit Projecten.

Met [Synchronisatie](/info/sync.html) aan gaat een creatie die zo is gearchiveerd naar je andere apparaten zoals al het andere in Projecten. De versies ervan blijven op het apparaat waarop ze zijn gemaakt.

Als een creatie in twee tabbladen open staat en je slaat in beide op, wordt het laatste opslaan bewaard. Het werk dat het verving, is niet verloren: het staat onder **Beschermde concepten** in de Geschiedenis van de creatie, met **Open draft as a copy**.

Dit werkt alleen in de webapp, niet in de desktop- of mobiele apps, en niet terwijl je live samenwerkt met iemand anders.
:::

## Een gedownload bestand vinden

In een browser geeft **Downloaden** het bestand door aan je browser, die het opslaat in zijn downloadmap (meestal **Downloads**) of vraagt waar. Lolly krijgt niet te horen waar het bestand is beland, dus kijk in de downloadlijst van je browser.

Als er geen bestand verscheen, kijk dan in het exportpaneel terwijl je nog in de tool bent. Onder **Downloaden** geeft een regel de bestandsnaam en de tijd, met **Retry download**, en in Chrome, Edge en andere Chromium-browsers **Save file…** om zelf een map te kiezen. De regel en zijn bestand blijven staan tot je de tool verlaat, herlaadt of opnieuw exporteert.

Lolly bewaart ook twee dingen na elke download:

- **Een kopie van het bestand**, in **Assets** onder **Je uploads**, zolang **Mijn renders opslaan in mijn bibliotheek** aanstaat onder **Instellingen → Jouw renders** (**Instellingen** staat onder aan het startscherm). De instelling staat standaard aan. Een video, of een bestand groter dan 50 MB, vraagt eerst, en een zip wordt niet gekopieerd.
- **De instellingen die je gebruikte**, voor je laatste 24 downloads. **Recente exports**, onder je opgeslagen werk in **Projecten**, heropent de tool met die instellingen zodat je het bestand opnieuw kunt maken, al worden afbeeldingen en bestanden die je vanaf je apparaat hebt toegevoegd niet meegenomen. Dezelfde lijst staat onder **Instellingen → Activiteit & statistieken → Laatste exports** en op het tabblad **Changes** van **History**. Deze lijst bewaart instellingen, niet de bestanden.

::: details In de desktop- en mobiele apps
- **Desktop-app:** **Downloaden** slaat rechtstreeks op in een map **Lolly** binnen je map **Downloads**, zonder dialoog. De regel onder **Downloaden** zegt waar het bestand is beland, zoals "Saved to Downloads/Lolly", met **Tonen in map**. **Open Exports Folder**, in het menu **Window** of **Exports**, opent de map op elk moment. Een bestand met dezelfde naam als een eerder bestand wordt opgeslagen als "naam (1)".
- **iPhone en iPad:** het bestand wordt opgeslagen in de app **Bestanden**, onder **Lolly**, en het deelvenster opent zodat je het kunt doorsturen. De regel onder **Downloaden** meldt "Saved to Files → Lolly".
- **Android:** het deelmenu opent zodat je kunt kiezen waar het bestand naartoe gaat.

Op iPhone, iPad en Android vervangt een nieuw bestand een eerder bestand met dezelfde naam.
:::

## Terug naar een eerdere versie

- **Tijdens dit bezoek:** **Undo** stapt terug door je laatste 100 wijzigingen, tot je de tool verlaat of herlaadt. Zie [Ongedaan maken en opnieuw doen](/info/using.html#undo-and-redo).
- **In [tools die opslaan terwijl je werkt](#which-tools-save-as-you-work):** eerdere versies van elke creatie worden bewaard. Volg de stappen hieronder.
- **Alles op het apparaat:** met [Synchronisatie](/info/sync.html) aan brengt **Restore an earlier copy**, onder **Instellingen → Gekoppelde diensten**, een van de laatste zeven dagelijkse kopieën terug, of de kopie van vóór je laatste toepassing. Alles op dit apparaat komt dan overeen met die kopie, niet alleen één design.

Om een eerdere versie te openen:

1. Druk op **Geschiedenis**, de klokknop naast **Undo** en **Redo**. In Design staat **Geschiedenis** in de bovenbalk; op een telefoon druk je op **•••** en dan op **Geschiedenis**. In tools zonder **Undo**, zoals Text en Sandbox, staat **Geschiedenis** naast **Home** linksboven.
2. Zoek de versie op datum en tijd. Rijen van **Automatic checkpoint** worden genomen terwijl je werkt; rijen van **Saved version** zijn de momenten waarop je hebt opgeslagen.
3. Druk op **Open as a copy**. De versie opent als een nieuwe creatie, en degene die je open had blijft zoals hij was. De kopie staat in **Projecten**, met "(copy)" na de naam.

Om een versie met een naam te bewaren, druk je op **Name version**, typ je een naam en druk je op **Keep milestone**. Genoemde versies staan op de pagina **History**, onder **Milestones**.

::: details Het History-paneel en de History-pagina
Het paneel **History** toont ook rijen van **Recovered work**, en **Protected drafts** bewaart je laatste bewerkingen tussen checkpoints, met **Open draft as a copy**. **Compare** en **Check assets** helpen je kiezen voordat je een kopie opent. Zet **This creation** op **All history on this device** om elke creatie te zien.

Automatische checkpoints worden met de tijd spaarzamer: één per minuut in het laatste uur, één per uur op de laatste dag, één per dag gedurende 30 dagen, daarna één per week. Opgeslagen versies en benoemde versies worden allemaal bewaard. Een creatie verwijderen verplaatst ook zijn versies naar de **Prullenbak**, en **Delete forever** verwijdert ze.

Wanneer de opslag van de Geschiedenis vol raakt, worden eerst de oudste automatische checkpoints verwijderd van creaties die je al 30 dagen niet hebt geopend. Een opslag wordt altijd bewaard, zelfs dan: het wordt geschreven als het huidige werk, en de Geschiedenis vermeldt dat dit opslaan niet als versie wordt bewaard. **Instellingen → Opslag** toont hoeveel de Geschiedenis gebruikt.

De pagina **History** (`#/history`, of **Open app history** in het paneel) omvat elke creatie in deze browser. Open op een computer de pagina via de klokknop rechtsboven op het startscherm of in **Projecten**. Ga op een telefoon naar de tools-galerij op het startscherm, druk op de ronde logoknop rechtsboven en kies **Saved sessions**, wat History opent. Vanuit **Projecten** doet dat item nog niets.

- **Recent** toont je creaties, nieuwste eerst, met **Resume**.
- **Changes** zet checkpoints, downloads en Convert-resultaten op één tijdlijn. Een download heeft **Reopen settings**.
- **Milestones** toont genoemde versies.

Filter op project, tool en datum (achter **Filters** op een telefoon). De History-pagina heeft geen verwijderknop; gebruik Projecten om een item te verwijderen.
:::

## Verhuis je werk naar een ander apparaat

| Om | Gebruik |
|---|---|
| Je apparaten gelijk te houden | **Synchronisatie tussen apparaten**, onder **Instellingen → Gekoppelde diensten**: zie [Synchroniseer je apparaten](/info/sync.html) |
| Alles in één keer te verplaatsen | **Exporteer mijn gegevens** en **Import data…**, hieronder |
| Eén design of één project over te dragen | Een `.lolly`-bestand: **Exporteren**, dan **Delen**, dan **Download .lolly**; voor een heel project, **Download project (.lolly)** in het menu van de map. Druk op **Open** op het andere apparaat. Zie [Het .lolly-bestand](/info/using.html#the-lolly-file) |

Een deellink draagt je instellingen mee, maar geen afbeeldingen of bestanden die je vanaf je apparaat hebt toegevoegd.

::: note Importeren voegt toe en verwijdert niets
Mappen, favorieten en sjablonen in het bestand worden toegevoegd naast die al op het andere apparaat staan. Wanneer een opgeslagen item op beide voorkomt, wordt de meest recent opgeslagen kopie bewaard. Je gegevens en instellingen op dat apparaat blijven zoals ze zijn; lege worden ingevuld vanuit het bestand. **Naar dit apparaat brengen**, in Synchronisatie, werkt op dezelfde manier.
:::

Om alles in één keer te verplaatsen:

1. Open op het oude apparaat **Instellingen → Opslag** en druk onder **Move to another device** op **Exporteer mijn gegevens**. Lolly downloadt één `.zip`-bestand waarvan de naam begint met `LollyTools-`.
2. Breng het bestand over via USB, e-mail het naar jezelf, AirDrop of een gedeelde map.
3. Open op het nieuwe apparaat **Instellingen → Opslag**, druk op **Import data…**, kies het bestand en druk op **Import**.

::: note Wat achterblijft
Inloggegevens, sleutels en de synchronisatiewachtwoordzin blijven op elk apparaat. De lijst met recente downloads, offline downloads en AI-modellen reizen langs geen enkele route mee. Versiegeschiedenis reist alleen mee in een **Exporteer mijn gegevens**-bestand, niet via Synchronisatie of een `.lolly`. Wanneer de geschiedenis te groot is voor één bestand, worden de oudste automatische checkpoints weggelaten en meldt de exportregel hoeveel. Een kopie die Synchronisatie in je opslag bewaart, kan worden gedownload en geopend, of gekozen in **Import data…**, zoals een back-upbestand; een versleutelde kopie vraagt om je wachtwoordzin.
:::

::: details Wat het back-upbestand bevat
Het bestand heet `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (de naamdelen komen uit je profiel en worden weggelaten als ze niet zijn ingesteld; `<n>` is een teller per dag zodat exports op dezelfde dag niet botsen). Het bevat je profiel, met je mappen, Prullenbak, sjablonen en favorieten; elke opgeslagen sessie met zijn miniatuur; je geüploade afbeeldingen, lettertypen, logo's en de kopieën van je downloads; je design systems; je voorkeuren (thema, breedte van de zijbalk, lokale activiteitsstatistieken); opgeslagen versies en resultaten van Convert; en, vanuit de webapp, de versiegeschiedenis van je creaties.

De catalogus-cache is niet inbegrepen - die downloadt zichzelf opnieuw op het nieuwe apparaat. Elk onderdeel heeft een checksum, zodat een bestand dat onderweg beschadigd raakt bij het importeren wordt opgemerkt in plaats van half hersteld te worden. Opgeslagen sessies koppelen zich automatisch opnieuw aan je geïmporteerde afbeeldingen. De web-, desktop- en mobiele apps lezen hetzelfde bestand; de terminal-app schrijft een eigen, eenvoudigere back-up, die dit formaat niet leest. **📦 Export my data & render everything** maakt hetzelfde bestand plus een tweede zip met elke opgeslagen sessie gerenderd naar zijn output. (Volledige formaatspecificatie: [Data Transfer](/info/data-transfer.html).)
:::

## Als je je browsergegevens wist

In de webapp bewaart Lolly alles in de opslag van je browser voor deze site: opgeslagen werk, afbeeldingen, lettertypen, design systems, versiegeschiedenis en offline downloads. Het wissen van de gegevens van deze site in je browser verwijdert dat allemaal, en Lolly kan er niets van terugbrengen. Wat overblijft, is wat de browser al heeft verlaten: bestanden die je hebt gedownload, een bestand van **Exporteer mijn gegevens**, een kopie via [Synchronisatie](/info/sync.html) en links die je hebt gedeeld.

::: warning Voordat je browsergegevens wist
Druk op **Exporteer mijn gegevens** onder **Instellingen → Opslag**, en bewaar het bestand ergens anders.
:::

Wanneer de app start, vraagt Lolly de browser om zijn opslag niet te wissen als het apparaat weinig ruimte heeft. De browser beslist. Onder **Instellingen → Offline beschikbaar** betekent een regel die begint met **Protected** dat de browser akkoord ging; "The browser may clear downloads if the device runs low on space" betekent dat hij dat niet deed, en **Protect downloads** vraagt het opnieuw. Als de browser niet akkoord ging, kan hij opgeslagen werk net zo goed als downloads wissen wanneer de ruimte opraakt, dus bewaar een recent bestand van **Exporteer mijn gegevens**.

**Instellingen → Opslag** toont hoeveel ruimte elk soort gegevens gebruikt. Zijn rij **Geschiedenis** telt automatische checkpoints, hun voorvertoningen en herstelconcepten; **Verwijder automatische checkpoints ouder dan 30 dagen** maakt die ruimte vrij en behoudt opgeslagen en benoemde versies. **Cache wissen** verwijdert gedownloade catalogusbestanden, die opnieuw downloaden wanneer nodig. **Al mijn gegevens wissen** vraagt je een woord te typen, zet Synchronisatie uit, en verwijdert dan alles wat Lolly in deze browser bewaart: je profiel en instellingen, opgeslagen sessies met hun geschiedenis en de Prullenbak, uploads, lettertypen en design systems, het downloadlogboek, Convert-resultaten, gedownloade AI-modellen en offline kopieën. Bestanden die je hebt gedownload, blijven waar je ze hebt opgeslagen. De app start daarna als bij een eerste bezoek.

![De opslagkaart op een schermbreedte van een telefoon: elke categorie gegevens op het apparaat met naam genoemd, met onderaan de knop Al mijn gegevens wissen](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

In de desktop- en mobiele apps zijn opgeslagen sessies bestanden in de eigen datamap van de app en staat de rest in de eigen opslag van de app, dus het wissen van een webbrowser raakt ze niet.

::: details Waar de desktop- en mobiele apps opgeslagen sessies bewaren
Eén bestand per opgeslagen sessie, in een map `saved-state`:

- macOS: `~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows: `%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux: `~/.local/share/tools.lolly.Desktop/saved-state/`, of hetzelfde pad onder `$XDG_DATA_HOME`
- iPhone, iPad en Android: binnen de eigen opslag van de app, die de Files-app niet toont

Afbeeldingen, design systems en de lijst met recente downloads blijven in de interne opslag van de app, niet in deze mappen. De terminal-app en de command line lezen dezelfde map `saved-state`: zie [Waar opgeslagen sessies leven](/info/cli-reference.html#where-saved-sessions-live).
:::

## Iets terugvinden dat je hebt verwijderd

Een opgeslagen sessie, een map, een van je uploads of een van je lettertypen in de app verwijderen, verplaatst het 30 dagen lang naar de **Prullenbak**, waar je het ook verwijdert: **Projecten**, **Assets**, **Instellingen → Opslag** of de lijst met opgeslagen sessies van een tool. Een map gaat met alles erin als één vermelding, en een sessie behoudt zijn versiegeschiedenis zolang hij daar staat. Direct daarna biedt een melding **Ongedaan maken** aan. Later:

1. Open **Prullenbak**: de tegel **Prullenbak** in **Projecten**, de knop **Prullenbak** in **Assets → Je uploads**, of de rij **Prullenbak** in **Instellingen → Opslag**. Alle drie openen dezelfde lijst.
2. Druk op **Herstellen** naast het item. Het gaat terug naar zijn map, en een lettertype krijgt de rollen terug die het had in zijn design system.

**Definitief verwijderen** verwijdert één item voorgoed. **Prullenbak legen** vraagt eerst bevestiging en verwijdert dan elk item in de Prullenbak. Items ouder dan 30 dagen worden definitief verwijderd.

::: warning Sommige verwijderingen zijn direct
Een design system, een logo of je profielfoto verwijderen gaat niet naar de Prullenbak. De command line en de terminal-app verwijderen ook meteen.
:::

Met [Synchronisatie](/info/sync.html) aan kan **Restore an earlier copy** de staat van een eerdere dag van het hele apparaat terugbrengen, en een bestand van **Exporteer mijn gegevens** brengt terug wat het bestand bevat.
