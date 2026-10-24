# Använda Lolly

Du har Lolly öppet och vill göra något, behålla det och skicka vidare det. Den här sidan går igenom den loopen: öppna ett verktyg, ändra det verktyget låter dig ändra, spara resultatet och dela det som en länk eller en fil.

Allt här körs på din enhet, utan konto, och fortsätter fungera offline när verktygen och tillgångarna du behöver är nedladdade. Appen behöver en webbläsare eller app med WebGPU för att starta; [Supported environments](/info/supported-environments.html) listar de testade.

## Hitta runt

::: figure using-app-map
Startskärmen: fyra flikar längs toppen och fältet längst ner. Ett verktyg, när det är öppet, visar sina kontroller bredvid en levande förhandsvisning.
:::

Fyra flikar löper längs toppen av startskärmen: **Tools**, **Utilities**, **Assets** och **Projects**. Tools är det du gör med, Utilities är arbetsbänkar för jobb som att konvertera, kontrollera eller städa en fil, Assets är ditt bibliotek och Projects håller det du sparat.

Fältet längst ner har **Open**, **Settings**, ett sökfält, **Verify** och **What?**. Det visas på Tools, Utilities, Assets, Projects, Settings och guiderna du läser i appen, och viker undan när ett verktyg är öppet. [Sök](/info/search.html) når dina verktyg, sparade arbete, tillgångar och inställningar från det fältet. [Fråga Lolly](/info/ask.html) svarar på en skriven fråga med motsvarande avsnitt ur de här guiderna.

Klicka på ett kort för att starta något nytt i det verktyget. Sparat arbete öppnas i stället igen från **Projects**.

![Ett gallerikort med exempel på navigering och åtgärden + Ny](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Varje verktyg är en delad vy: **kontroller** på ena sidan och en levande **förhandsvisning** på den andra. Ändra en kontroll så följer förhandsvisningen direkt, och det du ser är det som exporteras.

![Ett verktygs delade vy - kontrollstapeln till vänster, och det levande grupperade stapeldiagrammet det ritar till höger](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Design** är undantaget. Det öppnas som en fri yta av rutor som du drar, ändrar storlek på och skriver i, med egen översta list, tidslinje och presentationskontroller. [Design: den fria ytan](/info/design.html) är dess guide.

## Ändra det verktyget låter dig ändra

Ett verktyg visar bara de indata som är avsedda att variera. Dess upphovsperson har redan fastställt färger, layout, typografi och logik, så allt du gör följer deras regler. Indata inkluderar text, reglage, färgväljare, rullgardinsmenyer, datum, bildväljare och upprepade radgrupper, och vissa ligger i hopfällbara avsnitt.

![Ett verktygs kontrollstapel - ett textfält, färgväljare och ett reglage och inget annat som upphovspersonen valde att låsa](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Klicka på designen för att hitta dess kontroll.** Klicka på ett element i förhandsvisningen så får motsvarande kontroll fokus och rullas fram. I en upprepad radgrupp fälls exakt den rad du klickade på ut.

**Clear changes**, ovanför kontrollerna, återställer varje indata till standardvärdet.

**Val för designsystemet.** När ditt designsystem erbjuder fler än en färgvariant, ett ljust och ett mörkt utseende eller ett annat temaval, finns de i ett avsnitt **Design system** under kontrollerna. Ett val visas bara när det ändrar det här verktyget, så ett filverktyg visar inget avsnitt alls. Varje färgvariant är en prick i sina egna färger, ljust och mörkt är två knappar och varje annat val är en lista.

Valet hör till det här stycket. Det följer med i länken och den sparade sessionen, varje färg som är kopplad till designsystemet följer det och appens egna färger förblir som de är. Design visar samma val i fliken **Canvas** i Inspector. Ett verktyg vars färger är dess innehåll kan stanna på den kanoniska färgvarianten, och erbjuder då inga färgvariantsprickar. [Lolly Demo i bruk](/info/lolly-demo-in-use.html#colourways-on-real-work) visar färgvarianter på verkligt arbete.

### Zooma och panorera förhandsvisningen

Förhandsvisningen visar alltid exakt det som kommer att exporteras.

- **Zoom:** Cmd/Ctrl-scroll eller nyp på ett styrplatta, centrerat på pekaren. På tangentbordet anpassar `0` till fönstret, `1` är 100 % och `+` / `−` zoomar.
- **Panorera:** håll ned **Space** och dra, eller dra med mittenknappen på musen. Vanliga klick förblir lediga för att klicka på delar av designen.
- **Touch:** nyp för att zooma, dra för att panorera och dubbeltryck för att anpassa.
- **Zoom-HUD:** tryck och håll på Lolly-snurran i hörnet för att veckla ut `−`, **Fit** och `+`. Ett kort tryck på snurran öppnar fortfarande din profilmeny.

En ändring av utdatastorleken knäpper alltid tillbaka vyn till en ren anpassning.

![Zoom-HUD:en utvecklad från snurran i hörnet av ytan - minus, Fit, plus, sedan växlarna för tema och ljud och greppet som flyttar den](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### Ångra och gör om

**Cmd/Ctrl-Z** går bakåt ett steg och **Cmd/Ctrl-Shift-Z** (eller **Cmd/Ctrl-Y**) går framåt. Samma par finns som knapparna **Undo** och **Redo** ovanför kontrollerna (i Design finns de i översta listen), och var och en blir grå när det inte finns något kvar att ta tillbaka. Ett meddelande säger vilken indata varje ångra återställde, med en **Redo**-knapp i meddelandet.

- **Ett drag är ett steg.** Upprepade ändringar av en kontroll inom en halv sekund slås ihop, så att dra ett reglage över hela dess omfång är en enda ångra.
- **De senaste 100 stegen sparas.** En ny ändring efter en ångra rensar framåtstacken.
- **I en textruta** tillhör Cmd/Ctrl-Z fältet, tecken för tecken. Lolly tar över för reglage, rullgardinsmenyer, färger och omkopplare.
- **Att välja en fil** i ett filfält är inte ett steg, eftersom de byten bara hålls för den här sessionen.

I en levande [collab](/info/collaborate.html) förblir din historik din: en ändring från den andra enheten hamnar aldrig på din stack. Ångra varar tills du lämnar verktyget eller laddar om. För allt äldre behåller verktyg som sparar medan du arbetar tidigare versioner under **History**; se [Gå tillbaka till en tidigare version](/info/find-your-work.html#go-back-to-an-earlier-version).

### Levande kamera

Effekterna i verktyget **Filter** (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art och Glitch) visar en knapp **Go live** där en kamera finns. Slå på den så följer effekten din webbkamera bildruta för bildruta, och en rörelseexport spelar in resultatet som en GIF, WebM eller MP4. Bildrutor bearbetas på din enhet, och kameran släpps i samma ögonblick som du stoppar eller lämnar verktyget. Varje bildväljare har också **Take a photo** för en enda bildruta.

## Spara och fortsätta

För att behålla ditt arbete trycker du på **Save**, bocken bredvid **Export** på renderpillret. Nytt arbete hamnar i **My library**, arbete du sparat tidigare uppdateras där det är och inget laddas ner. Exportpanelen har samma **Save**-knapp.

För att välja vart det går trycker du på **Save as**, bredvid **Download** i exportpanelen. Under **Save to a project** låter du **My library** vara vald eller väljer ett projekt (**＋ New project…** gör ett), och trycker sedan på **Save**; **Save as a template** behåller designen som en [mall](/info/templates.html), en startpunkt för nya dokument. I Design finns **Save as** i Lolly-menyn; på en telefon trycker du på **•••**, sedan **File menu** och sedan **Save as**.

![Renderpillret i två halvor: Export, med en uppåtpil som öppnar exportpanelen, och Save, med en bock som sparar på plats](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> Tryck på **Save** på renderpillret, eller **Save as** för att välja ett projekt.
- <!--i:folder--> Objektet hamnar i **My library**, eller i projektet du valde.
- <!--i:home--> Senare trycker du på **Home** uppe till vänster och öppnar fliken **Projects**.
- <!--i:document--> Öppna objektet. Varje inställning är tillbaka, redo att ändras och exporteras igen.
:::

Objekt får namn efter filnamnet du skrev i exportpanelen, annars efter sitt verktyg, som **QR Code**. En fil du får med **Download** är en färdig kopia; för att ändra den senare öppnar du det sparade objektet i Projects.

Personliga sparade filer stannar på den här enheten, i webbläsaren eller appen du sparade från, om du inte slår på [Sync](/info/sync.html). Om något inte finns där du väntar dig tar [Hitta och återställ ditt arbete](/info/find-your-work.html) upp alla fall, från en stängd flik till rensad webbläsardata.

::: details Teamprojekt med Lolly Work (valfritt)
Om din [organisation använder Lolly Work](/info/organisation.html) loggar du in på dess instans och öppnar **Projects → Team projects** för sessioner som delas med dig. Organisationen sätter åtkomst och lagring, och dess Lolly Work-tjänst lagrar de sessionerna. En delad session går med i sin levande collab när den öppnas, om din organisation tillåter redigering i realtid; [Arbeta tillsammans](/info/collaborate.html#work-collabs-with-lolly-work-optional) förklarar stegen.

Ditt personliga bibliotek förblir separat. Att logga in på en annan enhet ger dig teamarbete, medan personliga sparade filer fortfarande behöver Sync eller en säkerhetskopia för att flyttas över.
:::

## Dela ditt arbete

En design går ut som en länk eller som en fil. **Share** i exportkontrollerna öppnar en dialog som erbjuder båda, och **Share link** på en sparad session i Projects öppnar samma dialog för den sessionen.

::: cols
## En länk

- Bär varje indata i adressen, så länken återskapar designen.
- Lämnar efter sig bilder och filer som du lagt till från den här enheten, mycket lång text och mycket stora listor.
- Öppnas i vilken webbläsare som helst, så du kan bokmärka, klistra in eller checka in länken.

## En .lolly-fil

- Bär den sparade sessionen med bilderna och filerna på den här enheten, och kan bära verktyget och designsystemet också.
- Håller tillbaka licensierad katalogkonst om du inte väljer att ta med filerna.
- Öppnas i Lolly: dubbelklicka på den, använd **Open** eller släpp den på appen.
:::

### Länken

Länken som är redo att kopieras ligger överst i dialogen, med **Copy** och en **QR**-knapp som öppnar verktyget QR Code med länken. Under länken finns **Link options**, som innehåller:

- **Open in the installed app** byter länken till en `lolly://`-adress för Genvägar, startprogram och automatisering, med varje parameter oförändrad.
- **Shortest link** packar en lång design i en kompakt token och visar besparingen i tecken. Den läsbara formen finns alltid också.
- **Password-protect this link** krypterar länken på din enhet med AES-256. Lösenordet är aldrig en del av länken.
- **Pin this tool version** lägger till flaggan `_v`, så att en senare verktygsuppdatering inte kan ändra vad länken renderar.
- **When the recipient opens the link…** väljer helskärm, exportpanelen redan utvecklad, en nedladdning vid öppning (`&export`) eller en kopia till urklipp (`&copy`).
- **Copy credit** kopierar en "Made with Lolly"-text med länken, för ett inlägg eller en bild.

När ett verktyg håller personliga fält, som ditt namn, håller **Review personal fields** varje fält utanför länken tills du kryssar i det fältet. [URL-läge](/info/url-mode.html) går igenom allt en länk kan bära.

**Dialogen säger vad en länk inte kan bära.** En bild eller fil som du lagt till från den här enheten, ett mycket långt textvärde och en mycket stor lista ryms inte i en adress. Var och en räknas när länken byggs. Om något måste släppas listar dialogen det och pekar dig mot filalternativet, i stället för att ge dig en länk som öppnas med en bild som saknas. En länk som bara är lång får en mildare notis med sitt teckenantal.

**Vissa verktyg gör länken till hela produkten.** Jump Page samlar dina länkar på en sida att dela ut: en länk i bion, ett föredrag, en butiksfront. Inget hostas och inget konto ligger bakom sidan, eftersom sidan är länken. En besökare får den i full bredd, en länk per scen när hen rullar.

![Jump Page i redigeraren: rubrikscenen överst på sidan, med länkscenerna under](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Länkar som hanteras av organisationen med Lolly Work
För delning som behöver ett utgångsdatum, återkallelse eller ett lösenord erbjuder Lolly Work hanterade länkar till delade sessioner, verktyg och katalogtillgångar. De löses via organisationens tjänst och följer dess åtkomstregler. De är separata från de fristående länkarna ovan, och att återkalla en kan inte ta tillbaka en fil som någon redan laddat ner. [Rendering and sharing](/info/manage/sharing.html) listar länktyperna och behörigheterna.
:::

### .lolly-filen

**Download .lolly**, i avsnittet **Editable file** i Share-dialogen, skriver den aktuella designen som en fil. Den bär den sparade sessionen med bilderna och filerna på den här enheten, och vanlig katalogkonst följer också med. En föråldrad eller otillgänglig fil förblir en extern referens i stället för att försvinna. Innan den sparas visar dialogen filens storlek, hur många filer den bäddar in, hur många den refererar till och om verktyget ingår. Där din enhet har ett delningsblad lämnar **Send to…** filen direkt dit (AirDrop, en Android-delning).

**Download project (.lolly)**, i en mapps meny i **Projects**, skriver en hel mapp, så att någon annan kan fortsätta med varje session i mappen. Batch-sessioner lämnas kvar, och notisen anger hur många. **Download originals**, i samma meny, skriver en vanlig zip med varje objekt som en egen fil.

Tre saker är dina att avgöra innan en fil går iväg:

- **Om ditt namn tas med.** Ditt namn, din e-post och din organisation skrivs bara när **Use my details to create** är på i [din profil](/info/profile.html). Med den av registrerar filen bara att den gjorts med Lolly, och när.
- **Om tillbakahållen konst tas med.** Licensierad konst, varumärkeslåst konst och katalogverk vars licens aldrig registrerats lämnas utanför som standard. Om designen använder något sådant anger dialogen hur många och erbjuder *Download without them* eller *Include and download*, eftersom att ta med dem lämnar filerna till den som öppnar `.lolly`. Filens `CREDITS.txt` listar vad som följde med och vad som inte gjorde det, med skälet; [Kreativa rättigheter och krediter](/info/creative-rights.html) förklarar reglerna.
- **Om verktyget tas med.** **Include the tool** packar verktygets egna filer, så att designen öppnas på en enhet utan det verktyget. Den börjar ikryssad för ett anpassat verktyg, som en fork, och inte ikryssad för ett verktyg som den signerade katalogen listar. I ett bygge utan signerad katalog räknas varje verktyg som anpassat.

**Att öppna en.** I dator- och mobilapparna dubbelklickar eller trycker du på en `.lolly`, väljer **Open with Lolly** eller skickar den till Lolly från delningsbladet. I webbappen trycker du på **Open** eller släpper filen på Lolly. Varje väg läser filens manifest först och visar dess storlek, innehåll och vad som kommer att hända, innan något skrivs.

Om filen bär ett verktyg som du inte har visar **Trust this tool?** verktyget och dess upphovsperson, och säger att öppnandet kör verktygets egen kod på din enhet. **Trust & install** går vidare. Avböjer du sparas arbetet ändå i Projects, och väntar på den dag du lägger till verktyget. Ett verktyg vars kod levereras som en modul kan ännu inte installeras på det här sättet, och avvisas på samma sätt.

::: details Vad en .lolly innehåller, och hur det går till att öppna en
`.lolly` är Lollys paketändelse, och `format` i dess `manifest.json` säger vad som finns inuti:

- En **delad design** (`lolly-share`) håller en sparad session, dess inbäddade filer och ett kvitto för allt som fortfarande löses via referens. Den kan också bära verktyget och designsystemet. Att öppna den lägger till ett nytt Project och skriver aldrig över en session.
- Ett **delat projekt** (`lolly-share`, sort `project`) håller en mapp från Projects: dess undermappar, varje session i dem med sin ruta och bilderna som arkiverats där. Att öppna det lägger till en kopia av hela mappen. Varje session färdas som `sessions/<key>.json` med sin ruta under `thumbs/`. En Lolly från före projektfiler fanns ber dig uppdatera.
- Ett **designsystempaket** (`lolly-brand`) håller tokens och kan hålla typsnitt, logotyper, publicerade versioner och bevarade resurser. Att öppna paketet lägger till ett separat namngivet designsystem och gör det systemet aktivt.
- Ett **arbetsyte- eller instanspaket** är ett `lolly-brand` med deklarerade verktyg, katalogtillgångar och eventuellt en instansadress. Att läsa in ett ersätter det enda arbetsytelager som lästs in tidigare, och förhandsvisningen listar de enhetsomfattande effekterna.

En fullständig enhetssäkerhetskopia är inte en `.lolly`. Den förblir en `LollyTools-….zip` (format `lolly-backup`) och återställs via **Settings → Storage → Import data…**. En zippad verktygsmapp förblir också en `.zip`. [Dataöverföring](/info/data-transfer.html) är formatreferensen.

En `.lolly` är en vanlig zip. Döp om den till `.zip` för att titta inuti: dina egna bilder ligger under `assets/uploads/`, katalogkonst under `assets/catalog/`, `manifest.json` listar varje fil, och en README säger vad filen är.

macOS, Windows, Linux, iOS och Android registrerar alla formatet, filhanterare på datorn visar det som ett Lolly-dokument och GNOME Files kan visa en sparad sessions egen miniatyr. Att öppna från Design System Setup rekommenderar designsystemsåtgärden när en delad design bär ett, men döljer aldrig **Open shared design**.

Ett dokument som lämnas över från en annan app på iOS eller Android begränsas till 48 MB, eftersom överlämningen kopierar dess byte över appgränsen, och appen säger det. **Open** inne i Lolly har ingen sådan gräns, så använd det för ett större paket.

När du bekräftat packar Lolly upp och verifierar paketet en gång. Tillgångar går till ditt bibliotek, matchade via kontrollsumma så att en fil som redan finns på enheten återanvänds. Sessioner går till Projects med nya id:n, så att samma fil kan öppnas två gånger; en session vars verktyg saknas väntar där. Filer över 100 MB flaggas som stora, och förhandsvisningen varnar när webbläsarlagringen rapporterar mindre ledigt utrymme än filen behöver. Varje integritetsskyddad del kontrolleras innan något bekräftas, och en skadad kopia avvisas utan att något lämnas kvar.
:::

En länk och en fil lämnar båda över en ögonblicksbild. För redigering i realtid beskriver [Arbeta tillsammans](/info/collaborate.html) privata collabs mellan två enheter och valfria arbetscollabs via Lolly Work.

## Tillgångar - ditt bibliotek

**Assets** (`#/a`) samlar allt dina verktyg kan använda: varumärkets logotyper, bilder, ljud och rörelse, grupperat efter sort, tillsammans med dina egna filer. Dina uppladdningar lagras på din enhet. En organisation som använder Lolly Work kan också tillhandahålla en delad katalog under sina egna åtkomstregler; se [Använd Lolly i din organisation](/info/organisation.html).

![Tillgångar, med varumärkets färgrutor och typsnitt samt dina egna uppladdningar](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Ta in dina filer.** Släpp en bild, SVG, ljudklipp, video, Lottie, PDF eller PowerPoint-presentation på uppladdningsytan, eller klicka för att välja. Den dyker upp i Assets direkt och i varje verktygs tillgångsväljare. En PDF med flera sidor eller en `.pptx` frågar vilka sidor eller bilder som ska behållas, och var och en blir en SVG-tillgång. En bild som du lägger till inne i ett verktyg behålls som den kom, i **My images**, så att ett Content Credential på den fortfarande verifieras, och bara en mycket stor fil frågar om den ska ändra storlek. **Settings → Storage** visar hur mycket **My images** håller. Det finns ingen gräns utöver din enhets lagring. För att rensa EXIF- och GPS-data när bilder kommer in slår du på **Strip metadata from uploads** under **Settings → Feature flags**; Content Credentials behålls i båda fallen.
- <!--i:star--> **Favoritmarkera det du tar till.** Stjärnmärk en tillgång eller en varumärkesfärg så fästs den överst i varje väljare.
- <!--i:folder--> **Städa upp.** Flytta en tillgång till en annan grupp, dölj en delad varumärkestillgång du inte använder (**Show hidden** tar tillbaka den) eller radera dina egna uppladdningar. Samma urvalsfält som i Projects verkar på ett helt urval.
- <!--i:layers--> **Lyft en video från sin bakgrund.** Öppna en videos detaljer, eller högerklicka på dess kort i en tillgångsväljare, och välj **Remove background…**. En **On-device model** klipper ut ett motiv ur en rörig scen; en **Colour key** tar bort en jämnt belyst bakgrund som en grön skärm, med **Tolerance**, **Softness** och **Spill removal** för kanten, och kräver ingen nedladdning. **Resolution** (360, 480, 720 eller 1080p, aldrig över källan) byter detaljer mot hastighet. Urklippet, en animerad WebP eller PNG med verklig transparens, sparas bredvid originalet, och källans Content Credential följer med som ingrediens. [Generated once, rendered the same](/info/ai-features.html) förklarar varför det här förblir en vanlig redigering.

### Ta med din palett och dina typsnitt vart som helst

Panelen **Swatches** i Assets visar färgerna ditt varumärke består av: dess varumärkesfärger, färger du lagt till, dess ramper och dess spektrum. De rollfärger som Lolly håller för gränssnittet (text, ytor, kanter, färgvariantens ledfärger och kopior av en varumärkesfärg under ett annat namn) väntar bakom ett grått kort **Show colour roles** längst ner i panelen.

Varje färg är ett kort som vilken tillgång som helst. Klicka på en för att öppna dess detaljer, markera några för att ladda ner bara dem eller ladda ner hela paletten i det format som ditt andra verktyg läser:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** eller **CSS classes**, för en formatmall eller ett bygge. En färg bredare än sRGB behåller sitt breda värde: CSS sätter det efter hexvärdet, och JSON behåller hexvärdet med den breda färgen, CMYK-bygget och accentfärgen bredvid.
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**, för Illustrator eller Photoshop. En färg låst till ett CMYK-bygge kommer som just det CMYK-färgprovet, en accentfärg som ett namngivet accentprov och en färg bredare än sRGB som Lab.
- <!--i:pentool--> **GIMP palette (.gpl)**, för GIMP eller Inkscape, och **SCSS variables**, båda i sRGB.

![Panelen Swatches - de fem nedladdningsknapparna för paletten längs toppen, sedan varje varumärkesfärg som ett chip som öppnar dess detaljer](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

Markera färger med pricken på varje kort: Shift-klicka en andra prick för allt däremellan, dra en ruta genom mellanrummen eller tryck Cmd/Ctrl+A med ett kort i fokus. Fältet erbjuder **Download as…** i samma sex format, **Copy hex** och **Favourite**. Innan du väljer ett format listar menyn alla färger som inget format kan hålla (Transparent har ingen färg alls), vilka format som sparar en bred färg som dess sRGB-reserv (SCSS och GIMP) och vilka som bär CMYK- och accentvärdena (JSON och .ase). Högerklicka på ett kort för samma åtgärder på en färg.

En färgs detaljer fyller förhandsvisningen med färgen och fäller ut **Linked values** (dess CMYK-bygge eller accentfärg, varje värde som skrivits för ett visst rum eller en viss press och dess designtoken), **Every notation** (hex, OKLCH, Display-P3 och resten, var och en med en kopieringsknapp), **Plotted on a colour space**, **Tones** och **Readability**. Piltangenterna stegar genom paletten, **Copy link** delar själva färgen och **Open in Colour Lab** tar den vidare.

Panelen **Fonts** listar dina varumärkestypsnitt med en **download** för varje, att installera lokalt eller lämna till ett tryckeri.

## Gör rutnätet till ditt

- <!--i:star--> **Favoritmarkera det du använder.** Högerklicka på ett kort och välj **Add to favourites**, så får det en stor ruta i ett band ovanför rutnätet. [Dina favoriter](/info/favourites.html) beskriver bandet.
- <!--i:eyeoff--> **Dölj ett verktyg du aldrig använder.** Högerklicka på ett kort, eller markera flera, och välj **Hide tool**. Det försvinner från rutnätet och från det som sökning i rutnätet hittar. En grå ruta **Show hidden tools (N)** i slutet visar dem igen, nedtonade, var och en med **Unhide tool** i sin meny. Att dölja ändrar bara ditt rutnät: verktyget öppnas fortfarande från en länk eller ett bokmärke.
- <!--i:clock--> **Dina verktyg, först.** När du har sparat arbete i tre olika verktyg leder en rad **Yours** med chips ovanför rutnätet med dina favoriter och senaste verktyg.
- <!--i:sliders--> **Lägg ut det på ditt sätt.** **View options** anger layouten (**Grid**, **Card** eller **List**), kortstorlek och täthet, sorteringsordning och ett kategorifilter.

![Slutet av verktygsrutnätet med dolda verktyg visade: det nedtonade kortet Wordmark, och bredvid det den grå rutan som växlade tillbaka dem i vyn, som nu lyder Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
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

**Åtgärda flera kort på en gång.** Kryssa i varje korts ruta, dra en markeringsruta över tom yta eller Shift/Cmd-klicka, så visas ett fält med det som den vyn tillåter:

- **Tools och Utilities:** Favourite, Hide, Available offline, **View sessions** (Projects, som bara visar sessionerna gjorda med de verktygen) och Copy link för ett enda kort.
- **Assets:** Favourite och Hide för vilket urval som helst. Duplicate, Download och Delete visas bara när varje markerat objekt är en av dina egna uppladdningar, eftersom en delad tillgång i ett designsystem är ett permanent kontrakt.
- **Projects:** se [Hitta och återställ ditt arbete](/info/find-your-work.html#find-something-you-saved).

![Galleriets urvalsfält för två verktyg, som erbjuder Tillgänglig offline, Visa sessioner, Favorit och Dölj](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
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

**View sessions** visas först när något är markerat. Högerklicka i stället på ett enskilt omarkerat kort så erbjuder det **N saved sessions**, en lista över det verktygets sparade sessioner där en radering flyttar sessionen till Papperskorgen.

## På en telefon

På en smal skärm blir layouten en kolumn:

- **Kontrollerna blir ett blad** överst med ett draggrepp på nedre kanten. Dra greppet för att snäppa till **peek**, **half** eller **full**, eller tryck på det för att fälla ihop och ut. Förhandsvisningen fyller utrymmet under och stannar i bild medan du redigerar.
- En flytande knapp **Export** öppnar exportbladet: format, storlek, kopiera, spara och ladda ner på ett ställe. Tryck på bakgrunden för att stänga bladet.

![Ett verktyg på en telefonbred skärm - kontrollerna som ett ark högst upp, den genererade paletten som fyller förhandsvisningen nedanför och renderingsknappen som svävar nedtill i mitten](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Inställningar, ljud och komfort

**Settings**, längst ner på startskärmen, håller dina uppgifter, dina designsystem, tillgänglighet, lagring och offlinenedladdningar. [Settings](/info/dashboard.html) kartlägger varje flik.

- **Dina uppgifter och ditt porträtt** fyller i alla verktyg som byggts för att använda dem, som en e-postsignatur eller en namnbricka. [Profiler](/info/profile.html) beskriver dem.
- **Tillgänglighet** har fyra komfortreglage: **Reduce motion**, **Hide colourful previews**, **High contrast** och **Large text**. De ändrar appen runt ditt arbete, aldrig en verktygsyta eller en export.
- **Sound** spelar milda hjälpljud för det du gör, och **Neurospicy Mode** spelar ett lugnt fokusspår. Båda är av tills du slår på dem, i **Settings → Accessibility** eller profilmenyn.
- **Available offline** laddar ner resten av appen, dina verktyg, katalogen och guiderna innan du förlorar anslutningen. Lolly är en webbapp som du kan installera: använd webbläsarens installationsknapp, eller *Add to Home Screen* på en telefon, för en helskärmsapp som uppdaterar sig själv när du är online igen.
- **Storage** visar vad Lolly behåller på den här enheten. [Om du rensar webbläsardata](/info/find-your-work.html#if-you-clear-your-browser-data) förklarar vad rensningen tar bort, och [integritetspolicyn](/info/privacy.html) listar allt appen hämtar eller skickar.

::: note Om en vy inte laddas efter en uppdatering
En tom panel eller ett meddelande "failed to fetch" strax efter en uppdatering försvinner oftast med en omladdning. Ditt sparade arbete, dina sessioner och designsystem är orörda, eftersom de lagras på din enhet. Bara en bild som du lade till och aldrig sparade kan behöva läggas till igen.
:::

## Vart du ska gå härnäst

- **[Design: den fria ytan](/info/design.html)**: ytan, former, tidslinjen och att presentera en presentation.
- **[Batch och Multi-edit](/info/batch.html)**: många versioner av en design, eller flera sparade designer som redigeras tillsammans.
- **[Exportera en fil](/info/exporting.html)**: att välja format, storlek, tryckenheter, transparens och video.
- **[Importera en design](/info/design-import.html)**: ta in en Figma-, Penpot-, Illustrator- eller InDesign-fil i Design och fortsätt redigera.
- **[Mallar](/info/templates.html)**: sparade startpunkter för ett verktyg.
- **[Wide Colour och HDR](/info/hdr-editing.html)**: behåll bildens ursprungliga precision i Design och Darkroom.
- **[Hitta och återställ ditt arbete](/info/find-your-work.html)**: var allt finns, och hur du flyttar det till en annan enhet.
