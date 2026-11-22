# Hitta och återställ ditt arbete

Hitta en design du aldrig sparade, en fil du laddade ner, förra veckans version eller ditt arbete efter att webbläsaren rensats. Börja med tabellen.

Personligt arbete stannar i webbläsaren eller appen där du skapade det, på den enheten, om du inte slår på [Sync](/info/sync.html). En organisation som använder det valfria Lolly Work har också **Team projects** på sin server.

| Vad du gjorde | Var du ska leta |
|---|---|
| Tryckte på **Save as** eller **Save** | **Projects** |
| Tryckte på **Download** | Webbläsarens nedladdningar och en kopia i **Assets** |
| Ingetdera, i ett [verktyg som sparar medan du arbetar](#which-tools-save-as-you-work) | **Projects** och **History** |
| Ingetdera, i ett verktyg som inte gör det | Bara fliken du arbetade i, tills du stänger den |
| Raderade det i appen | **Trash**, i **Projects**, **Assets** eller **Settings → Storage**, i 30 dagar |

::: figure find-your-work-places
Här finns ditt arbete: webbläsarens egen lagring innehåller Projects, History och Trash; nedladdningar hamnar i enhetens mappar; Sync och en säkerhetskopieringsfil är kopiorna utanför webbläsaren.
:::

::: details Hitta delat arbete i Lolly Work (valfritt)
Öppna organisationens Lolly, logga in och titta i **Projects → Team projects**. Den instansen har delade sessioner och visar dem du har åtkomst till. Att logga in på en annan enhet kan återställa åtkomsten till de sessionerna. Inloggning återställer inte ditt personliga bibliotek eller enhetens säkerhetskopia.

I en [arbetscollab](/info/collaborate.html#collabs-through-lolly-work-optional) ska du vänta på **Saved to work** innan du lämnar. Om ett delat projekt saknas, kontrollera att du är ansluten till rätt instans och fråga dess operatör om åtkomst eller lagringstid. Att rensa webbläsardata tar bort lokala kopior, inte organisationens serverkopia. Se [Använd Lolly i din organisation](/info/organisation.html).
:::

<!--i:eti-search-->
## Hitta något du sparat

1. Tryck på **Home** längst upp till vänster i verktyget.
2. Öppna fliken **Projects** högst upp på startskärmen (mappikonen på en telefon).
3. Allt du sparat i **My library** finns på den första skärmen. Varje projekt är en mapp. För att söka i alla mappar skriver du i **Search all projects…** längst ner på skärmen.

Ett objekt får det filnamn du skrev i exportpanelen. Utan filnamn får det verktygets namn, till exempel **QR Code**. När du öppnar objektet återställs alla inställningar. För att spara nytt arbete, se [Spara & fortsätta](/info/using.html#saving-continuing).

::: note Finns det inte i Projects?
- Det kan finnas i **Trash**: se [Få tillbaka något du raderat](#get-back-something-you-deleted).
- En annan webbläsare, ett privat fönster eller en annan enhet börjar tom, om du inte använder [Sync](/info/sync.html) eller [flyttar ditt arbete](#move-your-work-to-another-device).
- Om du bara tryckte på **Download**, se [Hitta en fil du laddade ner](#find-a-file-you-downloaded).
:::

::: details Arbeta med Projects
Du kan också öppna vyn **Projects** från **Settings → Storage → Saved sessions → Organise in Projects**. Den fungerar som en filhanterare:

![Projects innan något har sparats: rutorna New folder, New asset och Templates, History-klockan längst upp till höger och fältet Search all projects längst ner](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **Mappar i mappar.** Lägg sparade sessioner i mappar och mappar i andra mappar, på hur många nivåer som helst. Skapa eller byt namn på en mapp, eller dra en ruta till en mapp för att flytta den. En länkstig tar dig tillbaka uppåt. Sessioner som sparats utan mapp finns i roten av **Projects**.
- <!--i:clock--> **Sortera på ditt sätt.** **View options**, knappen med reglage längst upp till höger, erbjuder **Grid** eller **List** och sortering efter **Name**, **Date added**, **Last modified** (standard), **Size** och, inne i en mapp, **By tool**. Mappar kommer alltid först. Sessioner och mappar sorteras inom sina respektive grupper.
- <!--i:document--> **Lägg in nytt arbete direkt.** **New asset** öppnar den gemensamma väljaren. Välj **Templates** för att börja från en sparad mall. Öppna mallen för att redigera, eller tryck på **+ Add** för att spara en ny skapelse direkt.
- <!--i:checklist--> **Markera flera (dator).** Markera en rutas kryssruta, dra en markeringsruta över en tom yta eller **Shift/Cmd-klicka**. För en rutas snabbmeny, **högerklicka** på rutan. Markeringsfältet erbjuder **Render selection**, **Move to…**, **New folder** och **Delete** (till Trash). Dess **Edit together** öppnar två till åtta sessioner med ett verktyg vardera sida vid sida med ett gemensamt sidofält. **Edit as sheet** öppnar en markering av valfri storlek eller blandning som rader i batchrutnätet.
- <!--i:download--> **Rendera en hel mapp eller markering.** **Render folder** exporterar alla sparade sessioner i en mapp och dess undermappar som en enda `.zip` med mappstrukturen bevarad. **Render selection** gör samma sak för en markering med flera objekt. En enskild session renderas till en egen fil.
- <!--i:link--> **Gå direkt till ett verktygs sparade arbete.** Markera ett eller flera verktyg i galleriet Tools och välj **View sessions** i markeringsfältet. Projects visar då bara sessioner som skapats med de verktygen. **Clear** återställer hela vyn.
- <!--i:link--> **Dela en sparad session.** Högerklicka på en session (på en telefon trycker du på **•••** på dess ruta) och välj **Share link**. Länken öppnar sessionen igen med samma inställningar. Bilder från din enhet följer inte med en länk. För hela Share-dialogen, se [Dela ditt arbete](/info/using.html#sharing-your-work).
- <!--i:pentool--> **Byt namn eller kopiera.** Samma meny har **Rename**, **Duplicate** (en kopia i samma mapp) och **Move to…**.

![Popover-rutan View options i Projects: Layout med Grid och List samt Sort by inställt på Last modified, bredvid en knapp som vänder ordningen](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
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
## Om du stängde fliken eller lämnade verktyget

Vad som kommer tillbaka beror på hur du lämnade och vilket verktyg du använde:

- **Du stängde fliken eller kom tillbaka vid ett annat tillfälle.** Osparat arbete är borta, utom i de [verktyg som sparar medan du arbetar](#which-tools-save-as-you-work). Öppna det arbetet från **Projects**.
- **Du laddade om sidan i samma flik.** Dina inställningar återställs från sidans adress. I verktyg som inte sparar medan du arbetar innehåller adressen inte bilder och filer från din enhet eller enradig text som är längre än 150 tecken, så dessa kommer inte tillbaka.
- **Du tryckte på Home eller bakåtknappen längst upp till vänster.** Om du ändrat något sedan du senast sparade, laddade ner eller kopierade frågar dialogen **Unsaved edits** om du vill spara först. **Save & leave** sparar arbetet och tar dig till **Projects**, eller tillbaka till projektmappen du öppnade arbetet från. **Leave anyway** kastar dina ändringar. Ett sparat objekt återgår till senast sparade version, och en skapelse du aldrig sparat tas bort från **Projects**. **Cancel** håller dig kvar i verktyget.

::: warning Att stänga fliken ger ingen fråga först
Att stänga fliken, ladda om eller använda webbläsarens egen bakåtknapp ger aldrig någon fråga. För att vara säker, tryck på **Save as** eller **Save** i exportpanelen innan du lämnar ett verktyg.
:::

När automatisk återställning inte är tillgänglig anger en anteckning bredvid redigeringskontrollerna vad du ska behålla:

- I ett verktyg som arbetar med en fil du tar med ska du spara inställningarna och även behålla originalfilerna.
- I ett inspelningsverktyg eller ett hjälpverktyg utan Save-åtgärd ska du spara eller ladda ner resultatet innan du lämnar.
- Skrivbords- och mobilapparna talar om när du behöver spara manuellt.
- I ett privat samarbete behåller den som bjöd in dokumentet och dess historik, även den andra personens ändringar. Den som anslöt arbetar med en tillfällig kopia och bör spara en separat kopia innan sessionen avslutas.

::: note Lämnade du utan att spara av misstag?
I verktyg som sparar medan du arbetar behåller History en kopia av de kastade ändringarna i 30 dagar. Öppna sidan **History**, hitta dem under **Changes** och tryck på **Open as a copy**. I andra verktyg är ändringarna borta.
:::

::: details Vilka verktyg sparar medan du arbetar
I webbappen sparar alla verktyg som skapar dokument medan du arbetar, till exempel Lolly Design, Lolly Chart, QR Code, Text och Lolly Sandbox. De här verktygen gör det inte:

- verktyg som arbetar med en fil du tar med, till exempel Redact, Sign eller Convert Image, eftersom Lolly aldrig behåller en kopia av den filen;
- verktyg som spelar in från din kamera, mikrofon eller skärm, till exempel Record, Lolly Screen Capture och Lolly Voice Recorder;
- verktyg som inte har något att ändra, till exempel Countdown.

I de andra verktygen läggs arbetet i **Projects** vid din första ändring, som om du hade sparat. Senare ändringar sparas när verktyget har ritat klart. En osparad skapelse finns kvar i Projects efter att du stängt fliken och öppnas igen med ändringarna markerade som osparade.

**Leave anyway** kastar fortfarande de ändringarna. Att öppna verktyget igen från startskärmen startar en ny skapelse; öppna den tidigare från Projects.

3D och Lolly Darkroom sparar medan du arbetar, men behåller inte en fil du läser in i dem, till exempel en 3D-modell eller en LUT. History och **Save** behåller filens namn, typ och storlek, inte själva filen. När du öppnar arbetet igen anger en anteckning vilken fil det var, och verktyget arbetar utan filen tills du läser in den igen. Behåll dina originalfiler.

Med [Sync](/info/sync.html) på skickas en skapelse som lagts in så här till dina andra enheter. Dess versioner stannar på enheten där de skapades.

Om en skapelse är öppen i två flikar och du sparar i båda behålls den senaste sparningen. Det ersatta arbetet finns under **Protected drafts** i skapelsens History, med **Open draft as a copy**.

Det här fungerar bara i webbappen, inte i skrivbords- eller mobilapparna och inte medan du arbetar live med någon annan.
:::

<!--i:eti-download-->
## Hitta en fil du laddade ner

I en webbläsare lämnar **Download** filen till webbläsaren. Webbläsaren sparar filen i sin nedladdningsmapp (vanligtvis **Downloads**) eller frågar dig var. Lolly får inte veta var filen hamnade, så titta i webbläsarens lista över nedladdningar.

Om ingen fil dök upp, titta i exportpanelen medan du fortfarande är i verktyget. Under **Download** visar en rad filnamnet och tiden, med **Retry download**. I Chrome, Edge och andra Chromium-webbläsare erbjuder raden också **Save file…** för att välja en mapp. Raden och dess fil finns kvar tills du lämnar verktyget, laddar om eller exporterar igen.

Lolly behåller också två saker efter varje nedladdning:

- **En kopia av filen**, i **Assets** under **Your uploads**, medan **Save my renders to my library** är på under **Settings → Your renders** (**Settings** finns längst ner på startskärmen). Inställningen är på från början. En video eller en fil över 50 MB ger en fråga först, och en zip kopieras inte.
- **Inställningarna du använde**, för dina senaste 24 nedladdningar. **Recent exports**, under ditt sparade arbete i **Projects**, öppnar verktyget igen med de inställningarna. Bilder och filer du lade till från din enhet ingår inte. Samma lista finns under **Settings → Activity & stats → Latest exports** och på fliken **Changes** i **History**.

::: details I skrivbords- och mobilapparna
- **Skrivbordsappen:** **Download** sparar i en **Lolly**-mapp inuti mappen **Downloads**, utan dialog. Raden under **Download** anger var filen hamnade, till exempel "Saved to Downloads/Lolly", med **Show in folder**. **Open Exports Folder**, i menyn **Window** eller **Exports**, öppnar mappen när som helst. En fil med samma namn som en tidigare sparas som "name (1)".
- **iPhone och iPad:** filen sparas i appen **Files**, under **Lolly**, och delningspanelen öppnas. Raden under **Download** visar "Saved to Files → Lolly".
- **Android:** delningsmenyn öppnas. Välj var filen ska hamna.

På iPhone, iPad och Android ersätter en ny fil en tidigare fil med samma namn.
:::

<!--i:eti-history-->
## Gå tillbaka till en tidigare version

- **Under det här besöket:** **Undo** går bakåt genom dina senaste 100 ändringar, tills du lämnar verktyget eller laddar om. Se [Ångra och gör om](/info/using.html#undo-and-redo).
- **I [verktyg som sparar medan du arbetar](#which-tools-save-as-you-work):** tidigare versioner av varje skapelse behålls.
- **Allt på enheten:** med [Sync](/info/sync.html) på återställer **Restore an earlier copy**, under **Settings → Connected services**, en av de senaste sju dagliga kopiorna eller kopian från innan du senast tillämpade en kopia. Allt på den här enheten stämmer då överens med den kopian.

Så öppnar du en tidigare version:

1. Tryck på **History**, klockknappen bredvid **Undo** och **Redo**. I Lolly Design finns **History** i översta listen. På en telefon trycker du på **•••** och sedan **History**. I verktyg utan **Undo**, till exempel Text och Lolly Sandbox, finns **History** bredvid **Home** längst upp till vänster.
2. Hitta versionen med hjälp av datum och tid. Raderna **Automatic checkpoint** tas medan du arbetar; raderna **Saved version** är de tillfällen då du sparade.
3. Tryck på **Open as a copy**. Versionen öppnas som en ny skapelse, och den du hade öppen förblir som den var. Kopian finns i **Projects**, med "(copy)" efter namnet.

För att behålla en version med ett namn trycker du på **Name version**, skriver ett namn och trycker på **Keep milestone**. Namngivna versioner listas på sidan **History**, under **Milestones**.

::: details Panelen History och sidan History
Panelen **History** listar också rader med **Recovered work**, och **Protected drafts** innehåller dina senaste ändringar mellan kontrollpunkterna, med **Open draft as a copy**. **Lolly Compare** och **Check assets** hjälper dig att välja innan du öppnar en kopia. Byt från **This creation** till **All history on this device** för att se alla skapelser.

Automatiska kontrollpunkter glesas ut med tiden: en per minut under den senaste timmen, en per timme under det senaste dygnet, en per dag i 30 dagar och sedan en per vecka. Alla sparade och namngivna versioner behålls. När du raderar en skapelse flyttas även dess versioner till **Trash**, och **Delete forever** tar bort dem.

När lagringsutrymmet för History blir fullt tas de äldsta automatiska kontrollpunkterna för skapelser som du inte öppnat på 30 dagar bort först. Även då behålls alltid en sparning. Den skrivs som det aktuella arbetet, och History anger att sparningen inte behålls som en version. **Settings → Storage** visar hur mycket utrymme History använder.

Sidan **History** (`#/history`) omfattar alla skapelser i den här webbläsaren. För att öppna sidan trycker du på klockknappen längst upp till höger på startskärmen eller i **Projects**, väljer **Saved sessions** i profilmenyn (på en telefon, den runda logotypknappen längst upp till höger) eller trycker på **Open app history** i ett verktygs History-panel. Skrivbords- och mobilapparna har ingen History-sida. Där öppnar startskärmens klockknapp och **Saved sessions** i stället **Your recent work**: dina senast sparade sessioner och exporter, med en länk till Projects.

- **Recent** listar dina skapelser, nyast först, med **Resume**.
- **Changes** samlar kontrollpunkter, nedladdningar och Convert-resultat på en tidslinje. En nedladdning har **Reopen settings**.
- **Milestones** listar namngivna versioner.

Varje skapelse är en ruta med sin bild. **Grid** eller **List** byter layout. Filtrera efter projekt, verktyg och datum (bakom **Filters** på en telefon). En rutas meny (högerklicka eller tryck länge) erbjuder **Resume**, **Versions**, **Show in Projects** och **Move to Trash**. För att ta bort flera markerar du dem och väljer **Move to Trash**, som erbjuder Undo.
:::

<!--i:eti-folder-move-->
## Flytta ditt arbete till en annan enhet

| För att | Använd |
|---|---|
| Hålla dina enheter synkroniserade | **Sync across devices**, under **Settings → Connected services**: se [Synkronisera dina enheter](/info/sync.html) |
| Flytta allt en gång | **Export my data** och **Import data…**, nedan |
| Lämna över en design eller ett projekt | En `.lolly`-fil: **Export**, sedan **Share**, sedan **Download .lolly**; för ett helt projekt, **Download project (.lolly)** i mappens meny. Tryck på **Open** på den andra enheten. Se [.lolly-filen](/info/using.html#the-lolly-file) |

En delningslänk innehåller dina inställningar, men inte bilder eller filer du lade till från din enhet.

::: note Import lägger till utan att radera något
Mappar, favoriter och mallar i filen läggs till dem som redan finns på den andra enheten. När ett sparat objekt finns på båda behålls den senast sparade kopian. Dina uppgifter och inställningar på den enheten förblir som de är. Tomma värden fylls i från filen. **Bring it to this device** i Sync fungerar på samma sätt.
:::

Så flyttar du allt en gång:

1. På den gamla enheten öppnar du **Settings → Storage** och trycker på **Export my data** under **Move to another device**. Lolly laddar ner en `.zip`-fil vars namn börjar med `LollyTools-`.
2. För över filen via USB, mejl till dig själv, AirDrop eller en delad mapp.
3. På den nya enheten öppnar du **Settings → Storage**, trycker på **Import data…**, väljer filen och trycker på **Import**.

::: note Det här stannar kvar
Inloggningar, nycklar och lösenfrasen för synkronisering stannar på varje enhet. Listan över senaste nedladdningar, offlinenedladdningar och AI-modeller följer inte med via någon metod. Versionshistoriken följer bara med i en **Export my data**-fil, inte via Sync eller en `.lolly`. När historiken är för stor för en fil utelämnas de äldsta automatiska kontrollpunkterna, och exportraden anger hur många. Du kan ladda ner och öppna en kopia som Sync håller i din lagring, eller välja kopian i **Import data…**, som en säkerhetskopieringsfil. En krypterad kopia ber om din lösenfras.
:::

::: details Vad säkerhetskopieringsfilen innehåller
Filen heter `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`. Namndelarna kommer från din profil och utelämnas om de inte är angivna. `<n>` räknar exporterna som gjorts samma dag. Den innehåller din profil med dina mappar, Trash, mallar och favoriter; varje sparad session med sin miniatyrbild; dina uppladdade bilder, typsnitt, logotyper och kopiorna av dina nedladdningar; dina designsystem; dina inställningar (tema, sidofältsbredd, lokal aktivitetsstatistik); sparade versioner och resultat från Convert; och, från webbappen, versionshistoriken för dina skapelser.

Katalogcachen ingår inte. Den nya enheten laddar ner cachen igen. Varje del har en kontrollsumma, så importen upptäcker en fil som skadats under överföringen. Sparade sessioner länkas om till dina importerade bilder. Webb-, skrivbords- och mobilapparna läser samma fil. Terminalappen skriver en egen enklare säkerhetskopia som det här formatet inte läser. **Export my data & render everything** skapar samma fil plus en andra zip med varje sparad session renderad till sin utdata. Det fullständiga formatet finns i [Dataöverföring](/info/data-transfer.html).
:::

<!--i:eti-globe-->
## Om du rensar webbläsarens data

I webbappen håller Lolly allt i webbläsarens lagring för den här webbplatsen: sparat arbete, bilder, typsnitt, designsystem, versionshistorik och offlinenedladdningar. Att rensa webbplatsens data i webbläsaren tar bort allt detta, och Lolly kan inte återställa något av det. Det som finns kvar är det som redan lämnat webbläsaren: filer du laddat ner, en **Export my data**-fil, en [Sync](/info/sync.html)-kopia och länkar du delat.

::: warning Innan du rensar webbläsarens data
Tryck på **Export my data** under **Settings → Storage** och förvara filen någon annanstans.
:::

När appen startar ber Lolly webbläsaren att inte rensa dess lagring när enheten får ont om utrymme, och webbläsaren bestämmer. Under **Settings → Available offline** betyder en rad som börjar med **Protected** att webbläsaren gick med på det. "The browser may clear downloads if the device runs low on space" betyder att den inte gjorde det, och **Protect downloads** frågar igen.

Om webbläsaren inte gick med på det kan den rensa både sparat arbete och nedladdningar när utrymmet blir knappt, så behåll en aktuell **Export my data**-fil.

**Settings → Storage** visar hur mycket utrymme varje typ av data använder. Raden **History** räknar automatiska kontrollpunkter, deras förhandsvisningar och återställningsutkast. **Remove automatic checkpoints older than 30 days** frigör det utrymmet och behåller sparade och namngivna versioner. **Clear cache** tar bort nedladdade katalogfiler, som laddas ner igen när de behövs. **Clear all my data** ber dig skriva ett ord, stänger av Sync och tar sedan bort allt Lolly håller i den här webbläsaren: din profil och dina inställningar, sparade sessioner med deras historik och Trash, uppladdningar, typsnitt och designsystem, nedladdningsloggen, Convert-resultat, nedladdade AI-modeller och offlinekopior. Filer du laddat ner finns kvar där du sparade dem. Appen startar sedan som vid ett första besök.

![Lagringskortet på en skärm med telefonbredd: varje kategori av data på enheten namngiven, med knappen Clear all my data längst ner](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

I skrivbords- och mobilapparna är sparade sessioner filer i appens egen datamapp, och allt annat finns i appens egen lagring. Att rensa en webbläsare påverkar inte dessa.

::: details Var skrivbords- och mobilapparna håller sparade sessioner
En fil per sparad session, i en `saved-state`-mapp:

- macOS: `~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows: `%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux: `~/.local/share/tools.lolly.Desktop/saved-state/`, eller samma sökväg under `$XDG_DATA_HOME`
- iPhone, iPad och Android: i appens egen lagring, som appen Files inte visar

Bilder, designsystem och listan över senaste nedladdningar finns i appens interna lagring, inte i de här mapparna. Terminalappen och kommandoraden läser samma `saved-state`-mapp: se [Var sparade sessioner finns](/info/cli-reference.html#where-saved-sessions-live).
:::

<!--i:eti-trash-->
## Få tillbaka något du raderat

När du raderar en sparad session, en mapp, en av dina uppladdningar eller ett av dina typsnitt i appen flyttas det till **Trash** i 30 dagar, oavsett var du raderar det: **Projects**, **Assets**, **Settings → Storage** eller ett verktygs lista över sparade sessioner. En mapp och allt i den hamnar i Trash som en enda post. En session behåller sin versionshistorik i Trash. Direkt efter att du raderat erbjuder ett meddelande **Undo**. Senare:

1. Öppna **Trash**: rutan **Trash** i **Projects**, knappen **Trash** i **Assets → Your uploads** eller raden **Trash** i **Settings → Storage**. Alla tre öppnar samma lista.
2. Tryck på **Restore** bredvid objektet. Det återgår till sin mapp, och ett typsnitt får tillbaka de roller det hade i sitt designsystem.

**Delete forever** tar bort ett objekt för gott. **Empty Trash** frågar först och tar sedan bort alla objekt i Trash. Objekt som är äldre än 30 dagar tas bort för gott.

::: warning Vissa raderingar sker direkt
Ett designsystem, en logotyp eller din profilbild hamnar inte i Trash när du raderar dem. Kommandoraden och terminalappen raderar också direkt.
:::

Med [Sync](/info/sync.html) på kan **Restore an earlier copy** återställa hela enhetens tillstånd från en tidigare dag, och en **Export my data**-fil återställer det som filen innehåller.
