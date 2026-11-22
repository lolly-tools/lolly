# Använda Lolly

Öppna ett verktyg, gör de ändringar det tillåter, spara resultatet och dela det via en länk eller som en fil.

Allt körs på din enhet utan konto och fungerar offline när de verktyg och tillgångar du behöver har laddats ner. För att starta kräver appen en webbläsare eller app med WebGPU. [Miljöer som stöds](/info/supported-environments.html) listar de testade alternativen.

**Loopen**, i fyra steg:

::: steps
- <!--i:eti-home--> **[Öppna ett verktyg](#find-your-way-around)** Klicka på ett kort på startskärmen. Kontrollerna finns bredvid en levande förhandsvisning.
- <!--i:eti-sliders--> **[Ändra indata](#change-what-the-tool-lets-you-change)** Bara de indata som upphovspersonen har lämnat öppna. Klicka på designen för att hitta dess kontroll.
- <!--i:eti-folder-plus--> **[Spara ditt arbete](#saving-continuing)** **Save** sparar det i My library, och Projects tar fram det igen.
- <!--i:eti-link--> **[Dela designen](#sharing-your-work)** En länk med alla indata, eller en enda `.lolly`-fil.
:::

<!--i:eti-home-->
## Hitta runt

::: figure using-app-map
Startskärmen har fyra flikar överst och ett fält längst ner. När ett verktyg är öppet visas dess kontroller bredvid en levande förhandsvisning.
:::

Överst på startskärmen finns fyra flikar: **Tools**, **Utilities**, **Assets** och **Projects**. I Tools skapar du. Utilities konverterar, kontrollerar eller städar upp en fil. Assets är ditt bibliotek. Projects innehåller det du har sparat.

I fältet längst ner finns **Open**, **Settings**, ett sökfält, en **Verify**-genväg till Lolly Verify och **Docs**, som öppnar de här guiderna. Fältet visas i Tools, Utilities, Assets, Projects, Settings och guiderna i appen och döljs när ett verktyg öppnas. [Lolly Search](/info/search.html) hittar dina verktyg, sparat arbete, tillgångar och inställningar via sökfältet. [Fråga Lolly](/info/ask.html) besvarar en skriven fråga med det avsnitt i guiderna som matchar.

Klicka på ett kort för att börja ett nytt arbete i verktyget. Öppna sparat arbete igen via **Projects**. Vid första besöket erbjuder en hälsningsrad överst i galleriet en åtgärd för att komma igång: **Start making** under Lolly Demo, eller **Make it yours** för att ställa in ditt eget designsystem.

![Ett kort i galleriet med navigering mellan exempel och åtgärden Ny](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Alla verktyg har en delad vy med **kontroller** på ena sidan och en levande **förhandsvisning** på den andra. När du ändrar en kontroll uppdateras förhandsvisningen, och det som visas är det som exporteras.

![Ett verktyg i delad vy - kontrollerna staplade till vänster och det levande grupperade stapeldiagrammet som verktyget ritar till höger](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Lolly Design** är undantaget: en fri yta med rutor som du drar, ändrar storlek på och skriver i, med egen översta list, tidslinje och kontroller för presentationer. Guiden heter [Lolly Design: den fria ytan](/info/design.html).

<!--i:eti-sliders-->
## Ändra det verktyget låter dig ändra

Ett verktyg visar enbart de indata som ska kunna variera. Upphovspersonen har bestämt färgerna, layouten, typografin och logiken, så ditt arbete följer reglerna. Indata omfattar text, reglage, färgväljare, rullgardinsmenyer, datum, bildväljare och upprepade radgrupper. En del finns i hopfällbara avsnitt.

![Kontrollerna i ett verktyg - ett textfält, färgväljare och ett reglage, utan något annat som upphovspersonen valt att låsa](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Hitta kontrollen genom att klicka på designen.** Klicka på ett element i förhandsvisningen så rullas dess kontroll fram och får fokus. I en upprepad radgrupp öppnas den rad du klickade på.

**Clear changes**, ovanför kontrollerna, återställer alla indata till sina standardvärden.

**Val för designsystemet.** Om ditt designsystem erbjuder flera färgvarianter, ett ljust och ett mörkt utseende eller andra temaval finns de under kontrollerna i avsnittet **Design system**. Ett val visas bara om det påverkar verktyget, så ett filverktyg visar inget sådant avsnitt. Färgvarianterna visas som prickar i sina respektive färger, ljust och mörkt som två knappar och övriga val som listor.

Valet gäller det här arbetet. Det följer med länken och den sparade sessionen. Alla färger som är kopplade till designsystemet följer valet, medan appens egna färger är oförändrade. I Lolly Design finns samma val på fliken **Canvas** i Inspector. Ett verktyg där färgerna utgör innehållet kan behålla den kanoniska färgvarianten och visar då inga färgvariantsprickar. [Lolly Demo i bruk](/info/lolly-demo-in-use.html#colourways-on-real-work) visar färgvarianter i verkligt arbete. Välj en färgvariant i **Settings → Appearance** för att använda den i appen och för varje nytt arbete ([Gör en färgvariant till din egen](/info/colourways.html#make-a-colourway-your-own)).

### Zooma och panorera förhandsvisningen

- **Zoom:** Cmd/Ctrl-rulla eller nyp på en styrplatta, med pekaren som mittpunkt. Med tangentbordet anpassar `0` eller `Shift+1` allt till vyn, `1` eller `Shift+0` ger 100 % och `Shift+2` anpassar markeringen. `+` / `−` zoomar runt pekaren när den är över scenen och annars runt mitten.
- **Panorera:** håll ned **Space** och dra, eller dra med musens mittenknapp. Vanliga klick kan fortfarande användas för att klicka på delar av designen.
- **Touch:** nyp för att zooma, dra för att panorera och dubbeltryck för att anpassa till vyn.
- **Zoom-HUD:** håll Lolly-snurran i hörnet intryckt för att fälla ut `−`, **Fit** och `+`. Ett kort tryck på snurran öppnar fortfarande profilmenyn.

I Lolly Design omfattar **Fit all** både ritytor och lösa lager. Med manuell zoom kan du gå under 20 % tills sidan fyller halva vyn. Den absoluta gränsen är det lägsta av 5 % av den vanliga Fit-skalan och 2 % absolut zoom.

När du ändrar utdatastorleken återgår vyn alltid till en anpassning.

![Zoom-HUD:en utfälld från snurran i ytans hörn - minus, Fit, plus, sedan tema- och ljudväxlarna och greppet för att flytta den](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### Ångra och gör om

**Cmd/Ctrl-Z** tar ett steg bakåt och **Cmd/Ctrl-Shift-Z** (eller **Cmd/Ctrl-Y**) tar ett steg framåt. Knapparna **Undo** och **Redo** finns ovanför kontrollerna, eller i översta listen i Lolly Design. En knapp blir grå när inga steg återstår. Ett meddelande anger vilka indata varje ångring återställde och har en **Redo**-knapp.

- **Ett drag är ett steg.** Flera ändringar av samma kontroll inom en halv sekund slås ihop till ett steg.
- **De senaste 100 stegen behålls.** En ny ändring efter en ångring tömmer framåtstacken.
- **I en textruta** hanterar fältet Cmd/Ctrl-Z, tecken för tecken. Lolly tar över för reglage, rullgardinsmenyer, färger och omkopplare.
- **Att välja en fil** i ett filfält räknas inte som ett steg, eftersom dess byte bara sparas under den här sessionen.

I en [collab](/info/collaborate.html) i realtid hamnar ändringar från den andra enheten aldrig på din ångrastack. Ångra fungerar tills du lämnar verktyget eller laddar om. För äldre ändringar sparar verktyg som sparar medan du arbetar tidigare versioner under **History** ([Gå tillbaka till en tidigare version](/info/find-your-work.html#go-back-to-an-earlier-version)).

### Levande kamera

Effekterna i verktyget **Filter** (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art och Glitch) har en **Go live**-knapp när en kamera är tillgänglig. Slå på den så följer effekten webbkameran bildruta för bildruta. En rörelseexport spelar in resultatet som GIF, WebM eller MP4. Bildrutorna bearbetas på din enhet. Kameran frigörs så snart du stoppar eller lämnar verktyget. Alla bildväljare har också **Take a photo** för en enstaka bildruta.

<!--i:eti-folder-plus-->
## Spara & fortsätta

Spara arbetet med **Save**, bocken intill **Export** på renderpillret. Nya arbeten läggs i **My library**, tidigare sparade arbeten uppdateras på sin plats och inget laddas ner. Samma **Save**-knapp finns i exportpanelen.

Välj var arbetet ska sparas med **Save as** intill **Download** i exportpanelen. Under **Save to a project** behåller du **My library** som val eller väljer ett projekt (**＋ New project…** skapar ett), och trycker sedan på **Save**. **Save as a template** sparar designen som en [mall](/info/templates.html), en utgångspunkt för nya dokument. I Lolly Design hittar du **Save as** i Lolly-menyn. På en telefon trycker du på **•••**, sedan **File menu** och därefter **Save as**.

![Renderpillrets två halvor: Export med en uppåtpil som öppnar exportpanelen och Save med en bock som sparar på samma plats](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> Tryck på **Save** på renderpillret eller på **Save as** för att välja ett projekt.
- <!--i:folder--> Objektet hamnar i **My library** eller i projektet du valde.
- <!--i:home--> Tryck senare på **Home** uppe till vänster och öppna fliken **Projects**.
- <!--i:document--> Öppna objektet. Alla inställningar är tillbaka, redo att ändras och exporteras igen.
:::

Objekten får filnamnet du skrev i exportpanelen eller annars verktygets namn, till exempel **QR Code**. En fil från **Download** är en färdig kopia. Om du vill ändra den senare öppnar du det sparade objektet i Projects.

::: note Sparat arbete stannar på den här enheten
Det du sparar privat stannar på den här enheten, i webbläsaren eller appen du sparade från, om du inte slår på [Sync](/info/sync.html).
:::

Om något inte finns där du väntar dig beskriver [Hitta och återställ ditt arbete](/info/find-your-work.html) alla fall, från en stängd flik till rensade webbläsardata.

::: details Teamprojekt med Lolly Work (valfritt)
Om din [organisation använder Lolly Work](/info/organisation.html) loggar du in på dess instans och öppnar **Projects → Team projects** för sessioner som har delats med dig. Organisationen bestämmer åtkomst och lagringstid, och dess Lolly Work-tjänst lagrar sessionerna. När organisationen tillåter liveredigering ansluter en delad session till sin live-collab när den öppnas. [Arbeta tillsammans](/info/collaborate.html#collabs-through-lolly-work-optional) beskriver stegen.

Ditt personliga bibliotek hålls separat. När du loggar in på en annan enhet får du tillgång till teamets arbete. För att flytta personligt sparat arbete behövs fortfarande Sync eller en säkerhetskopia.
:::

<!--i:eti-link-->
## Dela ditt arbete

Dela en design som länk eller fil. **Share** bland exportkontrollerna öppnar en dialog med båda alternativen. **Share link** på en sparad session i Projects öppnar samma dialog för den sessionen. När du har skickat en fil till Google Drive, Nextcloud, en S3-bucket, Dropbox eller OneDrive kan dialogen även skapa en länk via den tjänsten ([Exportera en fil](/info/exporting.html#how-export-works)).

::: cols
## En länk

- Tar med alla indata i adressen, så länken återskapar designen.
- Utelämnar bilder och filer som du lagt till från den här enheten, mycket lång text och mycket stora listor.
- Öppnas i vilken webbläsare som helst, så du kan bokmärka, klistra in eller versionshantera länken.

## En .lolly-fil

- Tar med den sparade sessionen med bilderna och filerna på den här enheten och kan även ta med verktyget och designsystemet.
- Utelämnar licensierad kataloggrafik om du inte väljer att inkludera filerna.
- Öppnas i Lolly: dubbelklicka på den, använd **Open** eller släpp den på appen.
:::

### Länken

Länken finns överst i dialogen, med **Copy** och en **QR**-knapp som öppnar länken i verktyget QR Code. Under länken finns **Link options** med följande:

- **Open in the installed app** gör om länken till en `lolly://`-adress för Shortcuts, startprogram och automatisering, med alla parametrar oförändrade.
- **Shortest link** packar en lång design i en kompakt token och visar hur många tecken som sparas. Den läsbara formen finns kvar.
- **Password-protect this link** krypterar länken på din enhet med AES-256. Lösenordet ingår aldrig i länken.
- **Pin this tool version** lägger till flaggan `_v`, så att en senare verktygsuppdatering inte kan ändra vad länken renderar.
- **When the recipient opens the link…** väljer helskärm, redan utfälld exportpanel, nedladdning vid öppning (`&export`) eller kopiering till urklipp (`&copy`).
- **Copy credit** kopierar texten "Skapad med Lolly" med länken, för ett inlägg eller en presentationsbild.

När ett verktyg har personliga fält, till exempel ditt namn, håller **Review personal fields** varje fält utanför länken tills du markerar det. [URL-läge](/info/url-mode.html) beskriver allt en länk kan innehålla.

**Dialogen talar om vad en länk inte kan innehålla.** När Lolly bygger länken räknar den allt som inte ryms i en adress. Om något utelämnats listar dialogen det och hänvisar till filalternativet. En länk som bara är lång får en mildare notis med antalet tecken.

**Vissa verktyg gör länken till hela produkten.** Jump Page samlar dina länkar på en sida att dela: en profillänk, ett föredrag eller ett skyltfönster. Sidan är länken, så inget lagras på en server och inget konto ligger bakom sidan. Besökaren ser sidan i full bredd, med en länk per scen när de rullar.

![Jump Page i redigeraren: rubrikscenen överst på sidan med länkscenerna under](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Organisationshanterade länkar med Lolly Work
För delning som kräver ett utgångsdatum, återkallelse eller ett lösenord erbjuder Lolly Work hanterade länkar till delade sessioner, verktyg och katalogtillgångar. De löses upp via organisationens tjänst och följer dess åtkomstregler. De är separata från de fristående länkarna ovan. Att återkalla en länk kan inte ta tillbaka en fil som någon redan har laddat ner. [Rendering och delning](/info/manage/sharing.html) listar länktyperna och behörigheterna.
:::

### .lolly-filen

**Download .lolly** i Share-dialogens avsnitt **Editable file** skriver den aktuella designen till en enda fil. Vanlig kataloggrafik följer med tillsammans med bilderna och filerna från den här enheten. En inaktuell eller otillgänglig fil finns kvar som extern referens. Innan du sparar visar dialogen filens storlek, hur många filer den bäddar in, hur många den refererar till och om verktyget ingår. Om enheten har en delningspanel lämnar **Send to…** över filen till den (AirDrop, delning i Android).

**Download project (.lolly)** i en mapps meny i **Projects** skriver en hel mapp, så att någon annan kan fortsätta med alla sessioner i den. Batchsessioner utelämnas och meddelandet anger hur många. **Download originals** i samma meny skriver en vanlig zip där varje objekt är en egen fil.

Innan filen skickas bestämmer du tre saker:

- **Om ditt namn ska följa med.** Namn, e-postadress och organisation skrivs bara när **Use my details to create** är på i [din profil](/info/profile.html). När det är av registrerar filen bara att den skapades med Lolly och när.
- **Om utelämnad grafik ska följa med.** Licensierad och varumärkeslåst grafik utelämnas som standard, liksom katalogverk vars registrerade licens Lolly ännu inte kan läsa. Om designen använder sådana anger dialogen hur många och erbjuder *Download without them* eller *Include and download*. Om du inkluderar dem får den som öppnar `.lolly`-filen tillgång till filerna. Katalogverk utan registrerad rättighetsinformation följer med, och dialogen listar vart och ett så att du kan kontrollera innan du skickar. Filens `CREDITS.txt` listar vad som följde med och vad som utelämnades, med orsaken. [Kreativa rättigheter och erkännanden](/info/creative-rights.html) förklarar reglerna.
- **Om verktyget ska följa med.** **Include the tool** packar verktygets egna filer, så att designen kan öppnas på en enhet som saknar verktyget. Alternativet är förvalt för anpassade verktyg, till exempel en fork, och inte förvalt för verktyg som finns i den signerade katalogen. I en version utan signerad katalog räknas alla verktyg som anpassade.

**Öppna en fil.** I dator- och mobilapparna dubbelklickar eller trycker du på en `.lolly`, väljer **Open with Lolly** eller skickar den till Lolly från delningspanelen. I webbappen trycker du på **Open** eller släpper filen på Lolly. Alla sätten läser först filens manifest och visar storlek, innehåll och vad som kommer att hända innan något skrivs.

::: warning Att installera ett verktyg kör dess kod
Om filen innehåller ett verktyg du inte har visar **Trust this tool?** verktyget och dess upphovsperson, och anger att verktygets egen kod körs på din enhet när du öppnar det. **Trust & install** går vidare.
:::

Om du tackar nej sparas arbetet ändå i Projects och väntar tills du lägger till verktyget. Ett verktyg vars kod levereras som en modul kan ännu inte installeras på det här sättet och avvisas på samma sätt.

::: details Vad en .lolly innehåller och hur den öppnas
`.lolly` är Lollys filändelse för paket, och `format` i dess `manifest.json` anger vad det innehåller:

- En **delad design** (`lolly-share`) innehåller en sparad session, dess inbäddade filer och ett kvitto för allt som fortfarande hämtas via referenser. Den kan även innehålla verktyget och designsystemet. När den öppnas läggs ett nytt projekt till och ingen session skrivs över.
- Ett **delat projekt** (`lolly-share`, typ `project`) innehåller en mapp från Projects: dess undermappar, alla sessioner i dem med sina miniatyrer och bilderna som lagrats där. När det öppnas läggs en kopia av mappen till. Varje session följer med som `sessions/<key>.json` med sin miniatyr under `thumbs/`. En version av Lolly från innan projektfiler fanns ber dig att uppdatera.
- Ett **designsystempaket** (`lolly-brand`) innehåller tokens och kan innehålla typsnitt, logotyper, publicerade versioner och bevarade resurser. När paketet öppnas läggs ett separat namngivet designsystem till och aktiveras.
- Ett **arbetsyte- eller instanspaket** är en `lolly-brand` med deklarerade verktyg, katalogtillgångar och eventuellt en instansadress. När ett sådant läses in ersätter det det enda tidigare inlästa arbetsytelagret, och förhandsvisningen listar dessa effekter som gäller hela enheten.

En fullständig säkerhetskopia av enheten är ingen `.lolly`. Den är fortfarande en `LollyTools-….zip` (format `lolly-backup`) och återställs via **Settings → Storage → Import data…**. En zippad verktygsmapp förblir också en `.zip`. [Dataöverföring](/info/data-transfer.html) är formatreferensen.

En `.lolly` är en vanlig zip. Byt namn på den till `.zip` för att titta inuti. Dina egna bilder ligger under `assets/uploads/` och kataloggrafik under `assets/catalog/`. `manifest.json` listar alla filer, och en README beskriver vad filen är.

macOS, Windows, Linux, iOS och Android registrerar alla formatet. Datorns filhanterare visar filen som ett Lolly-dokument, och GNOME Files kan visa en sparad sessions egen miniatyrbild. Om en delad design innehåller ett designsystem rekommenderas designsystemåtgärden när den öppnas från Lolly Design System Setup, men **Open shared design** döljs aldrig.

På iOS och Android är dokument som lämnas över från en annan app begränsade till 48 MB, vilket appen talar om. Överlämningen kopierar filens byte över appgränsen. **Open** inuti Lolly har ingen sådan gräns, så använd det för större paket.

När du har bekräftat packar Lolly upp och verifierar paketet en gång. Tillgångar läggs i ditt bibliotek och matchas med kontrollsummor så att filer som redan finns på enheten återanvänds. Sessioner läggs i Projects med nya id:n, så samma fil kan öppnas två gånger. En session vars verktyg saknas väntar där. Filer över 100 MB markeras som stora, och förhandsvisningen varnar om webbläsarlagringen rapporterar mindre ledigt utrymme än filen kräver. Varje del som omfattas av integritetskontrollen kontrolleras innan något sparas, och en skadad kopia avvisas utan att något lämnas kvar.
:::

Både länkar och filer lämnar över en ögonblicksbild. För liveredigering beskriver [Arbeta tillsammans](/info/collaborate.html) privata collabs mellan två enheter och valfria arbetscollabs via Lolly Work.

<!--i:eti-images-->
## Tillgångar - ditt bibliotek

**Lolly Assets** (`#/a`) har det dina verktyg kan använda: varumärkeslogotyper, bilder, ljud och rörelse, grupperade efter typ, samt dina egna filer. Dina uppladdningar lagras på din enhet. En organisation som använder Lolly Work kan också tillhandahålla en delad katalog med sina egna åtkomstregler ([Använd Lolly i din organisation](/info/organisation.html)).

![Assets med varumärkets färgrutor och typsnitt samt dina egna uppladdningar](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Lägg till dina filer.** Släpp en bild, SVG, ett ljudklipp, en video, Lottie, PDF eller PowerPoint-presentation på uppladdningsområdet, eller klicka för att välja. Filen visas direkt i Assets och i alla verktygs tillgångsväljare. För en flersidig PDF eller en `.pptx` får du välja vilka sidor eller presentationsbilder som ska behållas, och var och en blir en SVG-tillgång. Bilder som du lägger till i ett verktyg sparas oförändrade i **My images**, så en Content Credential på bilden kan fortfarande verifieras. Bara mycket stora filer ger en fråga om att ändra storleken. **Settings → Storage** visar hur mycket **My images** innehåller. Det finns ingen annan gräns än enhetens lagringsutrymme. Slå på **Strip metadata from uploads** under **Settings → Feature flags** för att ta bort EXIF- och GPS-data vid uppladdning. Content Credentials behålls i båda fallen.
- <!--i:star--> **Favoritmarkera det du använder ofta.** Stjärnmarkera en tillgång eller en varumärkesfärgruta så fästs den överst i alla väljare.
- <!--i:folder--> **Håll ordning.** Flytta en tillgång till en annan grupp, dölj en delad varumärkestillgång som du inte använder (**Show hidden** tar fram den igen) eller radera dina egna uppladdningar. Samma markeringsfält som i Projects fungerar för en hel markering.
- <!--i:layers--> **Frilägg en video från bakgrunden.** Öppna videons detaljer eller högerklicka på dess kort i en tillgångsväljare och välj **Remove background…**. En **On-device model** frilägger ett motiv i en rörig scen. En **Colour key** tar bort en jämnt belyst bakgrund, till exempel en grönskärm, och kräver ingen nedladdning. **Tolerance**, **Softness** och **Spill removal** justerar kanten. **Resolution** (360, 480, 720 eller 1080p, aldrig över källans upplösning) väger detaljrikedom mot hastighet. Det frilagda resultatet är en animerad WebP eller PNG med transparens, som sparas bredvid originalet. Källans Content Credential följer med resultatet som en ingrediens. [Genererad en gång, renderad likadant](/info/ai-features.html) förklarar varför detta förblir en vanlig redigering.

### Ta med din palett och dina typsnitt överallt

Panelen **Swatches** i Assets visar varumärkets färger: dess varumärkesfärger, färger du lagt till, dess färgskalor och dess spektrum. Rollfärgerna som Lolly använder för gränssnittet (text, ytor, kanter, färgvarianternas huvudfärger och kopior av en varumärkesfärg under ett annat namn) finns bakom ett grått **Show colour roles**-kort längst ner i panelen.

Varje färg är ett kort precis som andra tillgångar. Klicka på en färg för att öppna dess detaljer, markera några för att ladda ner dem eller ladda ner hela paletten i ett format som ditt andra verktyg kan läsa:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** eller **CSS classes**, för en stilmall eller ett bygge. En färg utanför sRGB behåller sitt utökade värde: CSS placerar det efter hexvärdet, och JSON behåller hexvärdet tillsammans med den utökade färgen, CMYK-sammansättningen och dekorfärgen.
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**, för Illustrator eller Photoshop. En färg som är låst till en CMYK-sammansättning kommer som den CMYK-färgrutan, en dekorfärg som en namngiven dekorfärgruta och en färg utanför sRGB som Lab.
- <!--i:pentool--> **GIMP palette (.gpl)**, för GIMP eller Inkscape, och **SCSS variables**, båda i sRGB.

![Panelen Swatches - de fem knapparna för palettnedladdning överst, sedan varje varumärkesfärg som ett chips som öppnar dess detaljer](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

::: details Markera flera färger eller öppna en färgs detaljer
Markera färger med pricken på varje kort: Skift-klicka på en andra prick för att markera allt däremellan, dra en ruta genom mellanrummen eller tryck på Cmd/Ctrl+A när ett kort har fokus. Fältet erbjuder **Download as…** i samma sex format, **Copy hex** och **Favourite**. Innan du väljer format listar menyn färger som inget format kan innehålla (Transparent har ingen färg), vilka format som sparar en utökad färg som dess sRGB-reservvärde (SCSS och GIMP) och vilka som tar med CMYK- och dekorfärgsvärdena (JSON och .ase). Högerklicka på ett kort för samma åtgärder på en enda färg.

En färgs detaljer fyller förhandsvisningen med färgen och fäller ut **Linked values** (dess CMYK-sammansättning eller dekorfärg, värden skapade för en viss färgrymd eller tryckpress och dess designtoken), **Every notation** (hex, OKLCH, Display-P3 och resten, var och en med en kopieringsknapp), **Plotted on a colour space**, **Tones** och **Readability**. Piltangenterna stegar genom paletten, **Copy link** delar färgen och **Open in Colour Lab** öppnar färgen för fortsatt arbete.
:::

Panelen **Fonts** listar varumärkets typsnitt med **download** för vart och ett, för lokal installation eller överlämning till ett tryckeri.

<!--i:eti-grid-->
## Anpassa rutnätet

- <!--i:star--> **Favoritmarkera det du använder.** Högerklicka på ett kort och välj **Add to favourites**. Verktyget får en stor ruta i en remsa ovanför rutnätet. [Dina favoriter](/info/favourites.html) beskriver remsan.
- <!--i:eyeoff--> **Dölj verktyg du aldrig använder.** Högerklicka på ett kort eller markera flera och välj **Hide tool**. Det försvinner från rutnätet och från träffarna när du skriver i rutnätet. Verktyget lämnar rutnätet och ger inte längre någon träff när du skriver i rutnätet. En grå **Show hidden tools (N)**-ruta i slutet visar dolda verktyg igen, nedtonade och med **Unhide tool** i varje meny. Döljandet ändrar bara ditt rutnät: verktyget kan fortfarande öppnas från en länk eller ett bokmärke.
- <!--i:clock--> **Dina verktyg först.** När du har sparat arbete i tre olika verktyg visas en **Yours**-rad med chips ovanför rutnätet, med dina favoriter och senaste verktyg först.
- <!--i:sliders--> **Ordna vyn som du vill.** **View options** anger layout (**Grid**, **Card** eller **List**), kortstorlek och täthet, sorteringsordning och kategorifilter.

![Slutet av Tools-rutnätet med dolda verktyg framtagna: det nedtonade Wordmark-kortet och bredvid det den grå rutan som gjorde det synligt igen, nu med texten Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
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

**Hantera flera kort samtidigt.** Kryssa i varje korts kryssruta, dra en markeringsruta över ett tomt område eller Skift/Cmd-klicka så visas ett fält med det som vyn tillåter:

- **Tools och Utilities:** Favourite, Hide, Available offline, **View sessions** (Projects, som bara visar sessioner skapade med de verktygen) och Copy link för ett enstaka kort.
- **Assets:** Favourite och Hide för alla markeringar. Duplicate, Download och Delete visas bara när alla markerade objekt är dina egna uppladdningar, eftersom en delad designsystemtillgång är ett permanent kontrakt.
- **Projects:** se [Hitta och återställ ditt arbete](/info/find-your-work.html#find-something-you-saved).

![Galleriets markeringsfält för två verktyg, med Available offline, View sessions, Favourite och Hide](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
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

**View sessions** visas bara när något är markerat. Högerklicka på ett enstaka omarkerat kort för **N saved sessions**: en lista över verktygets sparade sessioner, där radering flyttar sessionen till papperskorgen.

<!--i:eti-layers-->
## På en telefon

På en smal skärm får layouten en enda kolumn:

- **Kontrollerna blir en panel** överst med ett draghandtag på nederkanten. Dra handtaget för att fästa panelen i **infällt läge**, **halvskärmsläge** eller **helskärmsläge**, eller tryck på det för att fälla ihop och ut. Förhandsvisningen fyller utrymmet nedanför och förblir synlig medan du redigerar.
- En flytande **Export**-knapp öppnar exportpanelen: format, storlek, kopiera, spara och ladda ner. Tryck på bakgrunden för att stänga panelen.

![Ett verktyg på en skärm med telefonbredd - kontroller i en panel överst, den genererade paletten i förhandsvisningen nedanför och renderpillret flytande längst ner i mitten](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

<!--i:eti-copy-->
## Vikbara enheter och iPhone Duo

På en vikbar enhet, en iPhone Duo eller en nästan kvadratisk pekskärm delar Lolly upp verktyget i två paneler:

- **Kontroller på ena sidan, ytan på den andra.** Kontrollerna placeras bort från handen du ritar med. Välj **Dominant hand** i **Settings → Accessibility** eller tryck på **Swap sides** överst bland kontrollerna. I språk som skrivs från höger till vänster spegelvänds sidorna.
- **Avdelaren är gångjärnet.** När enheten rapporterar sin vikning möts panelerna vid vecket, så att inga kontroller eller någon grafik hamnar där. På en sammanhängande skärm kan du dra avdelaren till en tredjedel, hälften eller två tredjedelar av bredden. Lolly kommer ihåg ditt val för varje vy på den här enheten.
- **På bordet.** Med enheten halvöppen och vecket tvärs över skärmen tar ytan den övre halvan och kontrollerna hamnar under vecket. När du presenterar visas presentationsbilden överst, med dina anteckningar, nästa bild samt **Back** och **Next** nedanför. I Sequence finns förhandsvisningen överst och tidslinjen nedanför.
- **Lolly Design, Design System Setup och Assets.** I Lolly Design finns Inspector, lagren och exportpanelen som flikar bredvid ytan. Verktygen står längs ytans ytterkant, under handen du ritar med. När verktygen inte ryms går kolumnen att rulla, och en toning med en pil visar åt vilket håll resten finns. På bordet löper verktygen längs ytans nederkant. Lolly Design System Setup har Board på ena sidan och rummet du öppnar på den andra. I Assets öppnas tillgångens detaljer bredvid biblioteket, så nästa tryck visar nästa tillgång på samma plats.
- **Inget i vecket.** När en vikning rapporteras öppnas dialoger på sidan med kontrollerna. Det gör även sökfältet längst ner på startskärmen och dess resultat. På en platt skärm ligger de kvar i mitten.
- **Inget går förlorat när du viker.** När du viker ihop, viker ut eller vrider enheten behålls dokumentet, markeringen, zoomen och fältet du skrev i, med markören på plats.

En vikbar enhets yttre skärm behåller telefonlayouten ovan. Detsamma gäller ett Lolly-fönster i ena halvan av en delad skärm.

<!--i:eti-smile-->
## Inställningar, ljud och komfort

**Settings** längst ner på startskärmen innehåller dina uppgifter, dina designsystem, tillgänglighet, lagring och offlinenedladdningar. [Lolly-inställningar](/info/dashboard.html) går igenom alla flikar.

- **Dina uppgifter och ditt porträtt** fylls i automatiskt i verktyg som är byggda för att använda dem, till exempel en e-postsignatur eller en namnbricka. [Profiler](/info/profile.html) beskriver dem.
- **Accessibility** har fyra komfortomkopplare: **Reduce motion**, **Hide colourful previews**, **High contrast** och **Large text**. De ändrar appen runt ditt arbete, aldrig ett verktygs yta eller en export. Bredvid dem väljer **Dominant hand** vilken sida kontrollerna hamnar på i två paneler.
- **Sound** spelar mjuka hjälpljud för dina åtgärder och **Neurospicy Mode** spelar ett lugnt spår för fokus. Båda är av tills du slår på dem i **Settings → Accessibility** eller profilmenyn. Reglaget **Sound shape** under Sound-omkopplaren ändrar ljuden från mjuka, runda droppar (Bouba) till torra tick och skrap (Kiki), med Lollys klanger i mitten. Spåren i Neurospicy omfattar Lollys genererade stationer: **Lolly Sings** och dess genrer samt tre **Lofi stations**. Stationerna skapar oändlig musik medan de spelar. Var och en har kontroller för trummor och textur (och stämning i Lofi), en länk för att dela melodin du hör och en knapp som sparar melodin bland dina tillgångar. [Genererad musik](/info/generated-music.html) förklarar hur en melodi skapas. **Music generator** under Utilities (`#/music`) låter dig forma en själv.
- **Available offline** laddar ner resten av appen, dina verktyg, katalogen och guiderna innan anslutningen försvinner. Installera Lolly som webbapp med webbläsarens installationsknapp eller *Add to Home Screen* på en telefon. Den installerade appen körs i helskärm och uppdateras automatiskt när du är online igen.
- **Performance UI** under **Settings → Feature flags** ger appen ett enklare utseende som kräver mindre resurser att rita. Verktygens ytor och exporter förblir desamma. På en långsam enhet slår Lolly på utseendet automatiskt och berättar varför, med **Undo** och **Keep** ([Performance UI](/info/configuration.html#curating-what-people-see)).
- **Storage** visar vad Lolly lagrar på den här enheten. [Om du rensar webbläsardata](/info/find-your-work.html#if-you-clear-your-browser-data) förklarar vad som tas bort vid rensning, och [integritetspolicyn](/info/privacy.html) listar allt appen hämtar eller skickar.

::: note Om en vy inte laddas efter en uppdatering
En tom panel eller meddelandet "failed to fetch" direkt efter en uppdatering brukar försvinna när du laddar om en gång. Sparat arbete, sessioner och designsystem påverkas inte eftersom de lagras på din enhet. Bara en bild som du lagt till utan att någonsin spara kan behöva läggas till igen.
:::

<!--i:eti-map-pin-->
## Gå vidare

- **[Lolly Design: den fria ytan](/info/design.html)**: ytan, former, tidslinjen och att visa en presentation.
- **[Batch och Lolly Multi-edit](/info/batch.html)**: många versioner av en design eller gemensam redigering av flera sparade designer.
- **[Exportera en fil](/info/exporting.html)**: välja format, storlek, tryckenheter, transparens och video.
- **[Importera en design](/info/design-import.html)**: ta in en fil från Figma, Penpot, Illustrator, InDesign, Affinity eller DXF i Lolly Design och fortsätt redigera.
- **[Mallar](/info/templates.html)**: sparade utgångspunkter för ett verktyg.
- **[Utökat färgomfång och HDR](/info/hdr-editing.html)**: behåll bildens ursprungliga precision i Lolly Design och Lolly Darkroom.
- **[Hitta och återställ ditt arbete](/info/find-your-work.html)**: var allt finns och hur du flyttar det till en annan enhet.
