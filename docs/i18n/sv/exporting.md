# Exportera och format

Så här får du ut en färdig fil från ett verktyg - att välja rätt format, ställa in utdatastorleken och vad varje alternativ gör. Precis som allt annat sker **exporten på din enhet**; inget laddas upp.

## Så fungerar export

Förhandsgranskningen *är* filen. När du exporterar renderar värden den arbetsytan till formatet du valde och ger dig en nedladdning (eller lägger den i urklipp). Ett verktyg erbjuder bara de format dess upphovsperson deklarerat, och väljaren döljer alla din webbläsare inte kan producera (se [Video](#video)).

Tre vägar ger en fil. De flesta verktyg **renderar arbetsytan** till valt format. Text- och dataformat (HTML, MD, TXT, JSON, CSV, ICS, VCF) **genereras i stället från verktygets innehåll**, inte rastreras från bilden. Och sekretessverktyg (t.ex. *Strip Hidden Data*) använder en tredje väg: filen *du* väljer omvandlas byte för byte på enheten och ges direkt tillbaka - ingen arbetsyta, ingen vattenstämpel och ingen härkomstmetadata läggs till, eftersom det redan är din egen fil.

Åtgärderna i exportkontrollerna:

- <!--i:download--> **Download** - spara filen (huvudåtgärden).
- <!--i:photos--> **Copy** - lägg bilden i urklipp för att klistra in direkt i Slack, e-post, ett dokument. Där en webbläsare inte kan kopiera bilder laddas den ner i stället och du får besked.
- <!--i:folder--> **Save** - spara den aktuella designen som en sparad verktygssession i ditt bibliotek.
- <!--i:link--> **Share** - öppnar **Share dialog**: en kopierbar länk som återskapar designen, växlar vid besök (helskärm, exportpanel, nedladdning eller kopiering vid öppning) och en valfri **Shortest link** som packar hela tillståndet i en kompakt token (se [URL Mode](/info/url-mode.html)).

(Vilka av dessa som visas väljs av verktygets upphovsperson; standarduppsättningen är Copy, Download och Save.)

![Exportpanelen - format, storlek och åtgärderna Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Share öppnas ovanpå verktyget, med länken redan byggd och växlarna vid besök under den.

### Rendera flera på en gång

En enskild export är en fil, men du kan rendera **många** i en omgång - var och en levererad som en `.zip`:

- <!--i:folder--> **Projects → Render folder** exporterar varje sparad session i en mapp (och dess undermappar) som en enda nästlad zip; **Render selection** gör detsamma för valfri flervalsmarkering; en enskild sparad session renderas direkt till sin egen fil. Inget Batch/Pro behövs - se [Använda Lolly → Projects](/info/using.html).
- <!--i:layers--> **Batch (Pro)** renderar ett rutnät av indatauppsättningar - varje variant av en mall på en gång.

En sparad session kan också delas på nytt som en verktygslänk från Projects (den återskapar verktygs-URL:en från de sparade indata), så en länk öppnar den igen med exakt samma inställningar.

## Välja ett format

Filnamnet och formatväljaren sitter högst upp i panelen som ett `name.format`-par, och väljaren listar bara de format verktygets upphovsperson deklarerat.

![Filnamnsfältet sammanfogat med formatväljaren, så att exporten läses som ett name.format-par](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

| Du vill ha… | Använd | Varför |
|---|---|---|
| Skarpa logotyper/grafik som skalar | **SVG** | Vektor - oändligt skalbar, liten, redigerbar |
| Vektor för Office/Windows-appar | **EMF** | Klistras in som redigerbar vektor i PowerPoint/Word; text förblir levande och redigerbar, och Google Drive öppnar den i Google Drawings för Slides |
| Vektor för print/designappar | **EPS**, eller **EPS (CMYK)** | PostScript-vektor för Illustrator/tryckeriflöden |
| Vektor för skärning/CAD-maskiner | **DXF** | Laserskärare, vinylplottrar, CNC - konturbanor i millimeter |
| Ett redigerbart presentationsbygge | **PowerPoint** (PPTX) | Inbyggd redigerbar text + former, med bilder och vektorer som förblir extraherbara |
| En kurs som ett LMS kan importera | **SCORM** (LMS) | En zip med manifest, en startsida, bilderna och den berättade filmen med undertexter - från ett Design-bygge |
| Ett redigerbart textdokument | **Word** (DOCX) eller **OpenDocument** (ODT) | Riktiga stycken och rubriker som ett ordbehandlingsprogram kan fortsätta redigera (Doc Studio) |
| Ett foto eller en generell bild | **PNG** (förlustfri) eller **JPG** (mindre) | Universell rasterbild |
| Mindre moderna bilder | **WebP** / **AVIF** | Bättre komprimering, alfa |
| Print | **PDF**, eller **Print PDF** (CMYK) | Verklig sidstorlek; CMYK för tryckeri |
| Rasterbild för tryckeri | **Print TIFF** (CMYK) | DeviceCMYK-pixlar för en RIP |
| Animerad för webben | **GIF** | Fungerar överallt, större filer |
| Animerad med fullfärg + riktig alfa | **APNG** | Animerad PNG - ingen paletbegränsning, äkta transparens |
| Animerad, minsta filen | **Animerad WebP** | Fullfärg + alfa, bättre komprimerad än GIF eller APNG |
| Animerad vektor som skalar | **Animerad SVG** | Fristående; loopar i en webbläsare eller `<img>`, ingen kodek, valfri storlek |
| Video för sociala medier/delning | **MP4** eller **WebM** | Bäst kvalitet per byte (se nedan) |
| Rik text/e-postsignatur | **HTML** | Klistras in formaterat i e-postklienter |
| Vanligt innehåll | **MD** / **TXT** | Endast text |
| En kalenderhändelse | **ICS** | Importeras i vilken kalenderapp som helst |
| Ett kontaktkort | **VCF** | Importeras i Kontakter/adressböcker |
| Strukturerad data att återimportera | **JSON** / **CSV** | Rundtrippar verktygets innehåll |
| En favikon | **ICO** | Webbplatsikon i flera storlekar (**ZIP** samlar flera format) |

Den första raden är det vanliga fallet. Ett ordmärke satt i ditt varumärkes typsnitt exporteras som SVG, där varje bokstav är en konturerad bana snarare än en pixel, så den förblir skarp i visitkortsstorlek och i byggnadsinslagningsstorlek från samma fil.

![Ett hårfint brett spärrat ordmärke som lyder Aurora, den typ av ren vektorkonst som SVG-raden i tabellen handlar om](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-wordmark-vector)

## Storlek och utskriftsenheter

Som standard använder exporter verktygets ursprungliga pixelstorlek. Där ett verktyg exponerar **dimensioner** kan du ställa in bredd × höjd och en **enhet**:

- **px** (standard) - exakta pixlar.
- **mm · cm · in · pt · pc** - fysiska/utskriftsstorlekar. Med en fysisk enhet ställer du även in **DPI** (standard **300** för utskrift); motorn konverterar korrekt per format - **PDF** blir en verklig sida i den storleken, **raster** renderas med rätt pixelantal för DPI:n (och bäddar in upplösningen), **SVG** behåller den fysiska enheten med en px-viewBox.

För att få ett raster med högre upplösning anger du en större bredd/höjd, eller väljer en fysisk enhet och höjer DPI:n (pixlar = storlek × DPI). Det finns ingen enkel skalningsknapp.

Exempel: bredd `210`, höjd `297`, enhet `mm` → en A4-sida.

![Dimensionsraden inställd på 210 gånger 297 mm, med DPI-fältet synligt eftersom enheten är fysisk](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Stillbilder från en tidsbaserad komposition

En **tidsstyrd komposition** - en [Sekvens](/info/using.html#timeline-sequence)-tidslinje i Design, eller vilken tidslinjestyrd rityta som helst - är något som rör sig, så en stillbildsexport måste besvara "vilket ögonblick?". Regeln är den du väntar dig: **bildrutan vid spelhuvudet**. Placera spelhuvudet där du vill ha bilden och exportera; det du ser är det som kommer ut.

När du vill ha mer än ett ögonblick visas fältet **Frames** bredvid utdatastorleken (endast för en tidsbaserad komposition, och endast för ett stillbildsformat - PNG, JPG, WebP, SVG eller PDF). Lämna det på `1` för spelhuvudets bildruta. Höj det så får du så många stillbilder samplade med jämna mellanrum över hela sekvensen:

- **Raster och SVG** returneras som en **zip** - `<name>-01.png`, `-02.png` och så vidare.
- **PDF** returneras som ett **enda dokument med lika många sidor**.

Användbart för en storyboard, ett miniatyrblad, ett kontaktark för granskning eller en karusell för sociala medier klippt direkt från en videoredigering.

Samplingen tas vid **mittpunkten** av varje intervall snarare än vid kanterna, eftersom sekvensens första ögonblick ofta är en intoningsövergång som ännu inte tonat in och det sista är tillståndet efter att varje klipp har avslutats - sampling vid ändpunkterna skulle slösa två av dina bildrutor på nästan tomma sådana. Antalet begränsas till **64** (ett kontaktark är till för att en människa ska läsa), och allt orimligt som skrivs in i fältet återgår till `1` i stället för att exporten misslyckas. Varje bildruta är en vanlig stillbild, så Content Credentials, imprinten, fysiska enheter och DPI beter sig precis som vid en enskild export.

Fältet **Frames** är sättet att få ett blad idag. Motorn reserverar en matchande `cuts`-URL-parameter, men inget skal läser den från en länk ännu, så en delad länk öppnas alltid på spelhuvudets bildruta - se [URL Mode](/info/url-mode.html#contact-sheets-cuts).

## Flersidig PDF

Vissa verktyg bygger ett **flersidigt PDF-dokument** istället för ett enda konstverk - ett omslag, innehåll som flyter över så många sidor det behöver och en baksida, allt i en fil (se verktyget *Booklet*). Varje sida är en **äkta PDF-sida** anpassad till den sidans ruta, så läsare och skrivare får riktiga sidor, inte en enda lång bild.

- **Sidor från innehåll.** Lägg till block med text och bilder; nya sidor skapas automatiskt när blocken fylls, och du kan tvinga vilket block som helst att starta en ny sida.
- **Verkliga sidstorlekar.** Välj A4, US Letter eller A5 (stående - tvåkolumnslayouten är byggd för det) - varje sida, och den exporterade PDF:en, renderas i exakt den storleken.

Flersidiga PDF-filer är RGB-dokument och har inga skär-/utfallsmärken - de hör till den enkelsidiga **Print PDF**-vägen ovan. De har samma **PDF/X-4-metadata** som varje PDF-export (sidrutor, XMP, dokument-ID, en sRGB-utdataavsikt med inbäddad profil), och de erbjuder **Content Credentials** (nedan) - i verktyget *Booklet* är alternativet förvalt.

## Skapa många saker på en gång

Lolly har tre distinkta sätt att arbeta i volym, och de löser olika uppgifter - massredigering är en förstklassig förmåga hos plattformen, inget varje verktyg återuppfinner:

- <!--i:document--> **En design × en tabell med rader → ett flersidigt dokument.** Verktyg med en `table`-indata (som *Battlecards*) omvandlar varje rad till en sida automatiskt - klistra in en tabell från ditt kalkylark, få en presentationsstor PDF. Din riktiga massredigerare förblir kalkylarket: fixa tio rader där, klistra in igen. Verktyget självt hanterar aldrig sidor.
- <!--i:layers--> **En design × en datafil → många separata filer.** `/pro`-batchrutnätet tar en CSV och renderar en export *per rad* - namnbrickor, certifikat, en fil vardera.
- <!--i:sliders--> **Många olika tillgångar, redigerade sida vid sida.** *Multi-edit* öppnar flera sparade sessioner i en vy för samordnade justeringar över olika designer.

Tumregel: rader av samma design som hör hemma i **ett dokument** → ett tabellstyrt verktyg; rader som måste levereras som **separata filer** → `/pro`; **olika designer** som behöver samma justering → multi-edit. (Ett planerat "combine media"-exportalternativ kommer att brygga de två första - att slå ihop exporter i samma format till en PDF, en video eller ett kontaktark för korrektur.)

## PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart och Diagrams kan exportera ett **PowerPoint-bygge** - en bild per sida. Poängen är inte en pixelperfekt skärmbild; det är att ge en kollega ett bygge de faktiskt kan **redigera och ta tillgångar ur**. Så varje sida delas upp i inbyggda objekt:

- <!--i:font--> **Text** blir riktiga, **redigerbara textrutor i PowerPoint** - med typsnittsstorlek, färg, vikt, kursiv stil och justering från layouten - så du kan rätta ett stavfel eller omstajla i PowerPoint.
- <!--i:pentool--> **Vektorer** (loggor, ikoner, SUSE-märket) bäddas in som **riktiga SVG-bilder** - de förblir skarpa i alla storlekar, och PowerPoint kan till och med köra *Convert to Shape* på dem.
- <!--i:photos--> **Bilder** kommer igenom i sin ursprungliga upplösning som egna extraherbara bilder (en `cover`-beskuren hero behåller hela bilden bakom beskärningen, så du kan ram-om den), med all bildbehandling (filter, blend) inbakad troget.
- <!--i:layers--> **Bakgrunder, ramar och linjer** blir riktiga rektangel-/linjeformer.

![Exportpanelen med PowerPoint valt: en bild per sida, text och former förblir redigerbara](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Layouten är avsiktligt approximativ - målet är troget, återanvändbart **innehåll**, inte en låst skärmdump. Allt som gångaren (walker) inte kan uttrycka nativt (ett komplext filtrerat eller maskerat område) bäddas in som en bild så att inget går förlorat. En presentation har en enda bildstorlek, hämtad från den första sidan.

PowerPoint är också en väg **in**. Släpp en `.pptx` på vilken uppladdningsyta som helst och välj bilderna du vill ha - var och en blir en tillgång att placera, justera eller bygga vidare på. **Markdown Slides** skriver ett nytt bygge från Markdown (och delar ut en märkesanpassad `.pptx`-mall), och verktyget **Rebrand** temar om ett befintligt bygge på plats - temapalett, hårdkodade färger och typsnitt - utan att röra dess diagram, SmartArt eller animationer, och lämnar tillbaka en `.pptx`. Se [Importera en design → Bygge och dokument](/info/design-import.html#decks-and-documents).

## Penpot

Alla verktyg som kan exportera SVG kan också exportera en **Penpot-fil** (`.penpot`) - dokumentet, klart att fortsätta redigera i Penpot i stället för att bara titta på.

- <!--i:layout--> Från **Design** blir varje bildruta en Penpot-**board**, varje box på den förs över som sin egen redigerbara form - rektangel, ellips, text, bild eller bana - och resultatet ankommer som en återanvändbar **komponent** i panelen Assets, redo att dras ut igen.
- <!--i:pentool--> Från ett verktyg vars rendering är **ren geometri** - vektorverktygen som QR Code, Street Map, Wordmark och Palette Lab - förs varje bana, rektangel, textrad och gradient över på samma sätt, som sin egen redigerbara form.
- <!--i:font--> Från ett verktyg som lägger ut sin rendering i **HTML** förblir **texten text** - ett redigerbart Penpot-textobjekt per rad, inte en kontur och inte en platt bild. Ett konstverk som Penpot saknar konstruktion för - en komplex illustration, en levande canvas - följer med som sin egen bild, så texten och boxarna runt den plattas aldrig till. En hel layout som Penpot inte kan skilja åt troget kan ändå komma över som en enda bild i full trohet, så inget faller någonsin bort.
- <!--i:palette--> En färg eller ett typsnitt som en form **ärver från en märkestoken** förblir **länkad** till den token i filen: ändra token i Penpots Tokens-panel så målas varje form som ärver den om tillsammans, medan en fristående literal färg förblir exakt där den är. Märkets färger och typografier hamnar också i panelen **Assets** och dess fullständiga uppsättning designtoken i panelen **Tokens** - samma DTCG-tokenuppsättning som Lollys egen palett använder. Penpot behåller sin egen kopia därifrån: en ändring gjord i dess Tokens-panel kommer tillbaka in i märket via [Brand Studios import](/info/design-import.html), inte av sig själv.

| Vad du gjorde | I Penpot |
|---|---|
| Text | Redigerbara textobjekt - fixa ett stavfel eller omstila |
| Former, banor, gradienter, bilder | Sina egna redigerbara vektorformer |
| En färg eller ett typsnitt från en märkestoken | En levande tokenlänk - ändra token, varje form som ärver den följer med |
| Hela designen | En återanvändbar komponent i panelen Assets |
| En komplex illustration eller levande canvas | Inbäddad för sig som en bild, det redigerbara innehållet runt den orört |

![Exportpanelen med Penpot valt: .penpot-filen, och Send to Penpot bredvid nedladdningen](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

För att öppna den, starta Penpot, välj ett projekt och välj **Import**. Inloggad i Penpot från exportpanelen gör **Send to Penpot** det steget åt dig - välj ett projekt där så går filen direkt in i det.

## SCORM (kurspaket)

Ett Design-bygge kan lämna som ett **SCORM-paket** - zipen ett lärandehanteringssystem importerar, oavsett om det är Moodle, Canvas, Blackboard eller ett företags-LMS. Välj **SCORM (LMS)** i formatväljaren så skriver exporten:

- <!--i:layout--> **Bilderna**, en bild per rityta, som vektor där rityta tillåter det och som pixlar endast där den inte gör det.
- <!--i:play--> **Den berättade filmen** med sitt textningsspår - talarnoterna lästa av en röst på enheten, precis som [Presentation](/info/create/using.html#presenting) spelar upp dem.
- <!--i:file--> **En startsida** som steppar igenom bilderna, spelar upp filmen och rapporterar färdigställande tillbaka till LMS:et via SCORM 1.2-runtimen, versionen alla LMS accepterar.
- <!--i:font--> Typsnitten bygget använder, så att startsidan renderar likadant offline.

![Exportpanelen på ett Design-bygge med SCORM (LMS) valt](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Inget i paketet ringer hem: det är filer i en zip, och det körs inuti LMS:et utan bundlare, utan CDN och utan konto. Webb- och skrivbordsapparna bygger det; CLI:t gör det inte, eftersom att fotografera ritytorna och koda filmen kräver webbläsaren.

## DXF (skärfiler)

Vektorverktyg (Brand Lockup, QR Code, Street Map, Wayfinding Signage, Pose Geeko, logotyplåsningarna, Diagram Builder) kan exportera **DXF** - AutoCAD R12-utbytesformatet som laserskärare, vinylplottrar och CNC/CAD-program läser. Geometri skrivs som konturbanor **i millimeter** (kurvor plattas ut till en fin tolerans), text konturbanas till banor och färg mappas till närmaste AutoCAD Color Index (som vanligtvis styr verktyget/operationen på en skärmaskin). DXF är enbart linjekonst - ett fotografiskt eller filtrerat område har ingen skärbaneform och tas bort (Lolly varnar), så använd SVG/PDF när du behöver behålla rasterinnehåll.

Street Map är det tydligaste exemplet: hela designen är redan streck, så varje väg och kanal blir en skärbana utan något att slänga.

::: showcase
![En Street Map-rendering av Paris i bläck på krämvitt - ren strecklinjekonst, så varje streck överlever resan till en skärmaskin](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Scrolla, och kameran dras tillbaka genom den faktiska geometrin: sju banor, inga pixlar någonstans, varje streck hårfint skarpt i alla zoomlägen. Det är samma fil som en skärmaskin läser.
:::

## Animerad SVG

Rörelseverktyg (Animated Ad, Lottie Ad) kan exportera **Animerad SVG** - en fristående, *vektorbaserad* animation. Till skillnad från GIF/APNG/WebP (som samplar varje bildruta till pixlar) staplar en animerad SVG vektorögonblicksbilder med inbäddade CSS-nyckelbilder, så den **skalar till valfri storlek utan kodek och utan extern körtidsmiljö** - den loopar i en webbläsarflik eller en `<img>`. Text förblir konturad så att den renderas överallt. Den delar de animerade formatens **Duration**-/bildfrekvenskontroller, och (eftersom den är tyngre per bildruta än en bitmapp) använder en lägre standardbildfrekvens.

## Transparens

Verktyg som stöder det erbjuder en **transparent bakgrund**-omkopplare (t.ex. *No BG*). Transparens bevaras av PNG, WebP, AVIF, SVG (stillbild och animerad), APNG och Animated WebP. JPG och PDF är alltid opaka, och TIFF plattas mot vitt (mot svart i HDR-flödet - se nedan).

## Färgrymder

Två olika frågor, värda att hålla isär: vilka färgrymder Lolly kan **läsa och tänka i**, och vilka det **skriver**.

**Läsning.** Var en färg än skrivs - ett verktygs stilmall, en importerad SVG:s paint, ett designtokens värde, en skugga eller gradient inuti en CSS-kortform - läser Lolly hela **CSS Color 4**-vokabulären: `#hex`, `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, CSS namngivna färger och `color()` i de fördefinierade rymderna - `srgb`, `srgb-linear`, `display-p3`, `a98-rgb`, `prophoto-rgb`, `rec2020`, `xyz-d50`, `xyz-d65` - inklusive komponenter skrivna som nyckelordet `none`. En parser gör detta för hela plattformen, så webbläsaren och varje exportgångare är överens om vad en färgsträng betyder.

Det spelar större roll än det låter, eftersom en webbläsare löser upp modern CSS till modern CSS. Skriv `color-mix(in oklab, …)` och Chrome beräknar `oklab(…)`; använd en varumärkestoken lagrad som `oklch()` och det är det bokstavliga värdet exportgångaren ser. Färger i de formerna läses korrekt i stället för att slängas - vilket var vad en gångare som bara förstod `rgb()` gjorde, genom att exportera varumärkesfärgad text som svart, tappa tonade paneler och tabellinjer och läsa `oklch(0.7 0.1 200) 0px 2px 4px` som en skugg-offset på 0.7 gånger 0.1.

**Tänkandet.** Färgmatematik sker perceptuellt snarare än i råa kanaler. Paletthärledning, ramper, harmonier och kontrast körs i **OKLCH/OKLab**, och en färg utanför tonomfånget förs in i intervallet av CSS Color 4:s egen algoritm för omfångsmappning - kromareducering med en perceptuell avståndskontroll - snarare än genom att klippa kanaler, så en klar färg landar på den närmaste färg du faktiskt skulle acceptera istället för en utplattad. Gradienter interpoleras i ett utrymme du väljer (OKLab som standard, eller `oklch`, `lab`, `lch`, `srgb`, `srgb-linear`, `hsl`, med en nyansriktning för de polära), och blandning är **förmultiplicerad**, så en toning till transparent behåller rätt färg istället för att mörkna mot svart på vägen. En och samma interpolator betjänar både förhandsgranskningen och exportvandrarna - vilket är det som hindrade en konisk gradient från att blandas på ett sätt på skärmen och på ett annat i den exporterade filen.

**Skrivning.** Utmatningen är avsiktligt smalare än inmatningen, eftersom en fil måste vara läsbar av det som öppnar den, och en rymd deklareras endast vid utmatning när talen faktiskt konverterades till den. Skärm- och webbformat skrivs som **sRGB** och taggas som sådana; utskriftsformaten skrivs som **CMYK** mot ett namngivet tryckvillkor (nedan); och HDR-flödet är **Rec.2100 PQ** (ovan). En bredgamut-färg som når en export mappas till sRGB i stället för att felmärkas - att föra `color(display-p3 …)` genom till en vektorfil är en planerad utökning, inte något dagens exporter påstår sig göra. En gradient författad i OKLab **bakas** till vanliga sRGB-stopp på vägen ut, med extra stopp infogade endast där sRGB skulle avvika synligt från den perceptuella kurvan, eftersom en SVG `<linearGradient>` och en PDF-axial skuggning inte har någon interpolationsrymdsinställning att bära avsikten med. Ett författat värde, tre renderare, ingen drift.

## Färgprofiler

För att färger ska återges troget i färghanterade appar (tryckerier, Photoshop, webbläsare), taggas exporter med **en färgprofil**:

- **PNG/JPG** bär en inbäddad **sRGB**-ICC-profil - den färgrymd förhandsvisningen faktiskt renderas i - så inget lämnas att gissa. (Endast taggning; pixlarna kodas inte om.)
- **Utskrifts-PDF (CMYK)** deklarerar ett mål-**tryckvillkor** i sitt *OutputIntent* (standard *Coated FOGRA39*), som talar om för en RIP/tryckeri hur dess CMYK-bläck är avsedda att läsas. Varumärkesprover med uppmätta färgvärden konverteras exakt; övriga färger använder en standardkonvertering för enheten. Den deklarationen är ett *namn*: ingen CMYK-profil medföljer Lolly, och PDF/X-4 vill ha profilen inbäddad, så ett namngivet villkor skriver output intent utan att göra anspråk på PDF/X-4-konformitet. Ladda en egen CMYK-profil och välj dess **Embed**-rad i kontrollen för färgprofil så bäddas den in som filens *DestOutputProfile* - varvid PDF:en genuint kan vara PDF/X-4, och gör anspråk på det närhelst resten av filen tillåter det. Tre saker håller tillbaka anspråket samtidigt som output intent behålls (en RIP vill fortfarande ha det): RGB-konst som CMYK-passet inte kunde konvertera, `prov`-korrekturmarginalens kredittext (ritad i ett standardtypsnitt som inte bäddas in, och X-4 gör inget undantag för dem) och ett **Strong**-lösenord, eftersom X-4 förbjuder kryptering. Villkoret det deklarerar läses sedan av från den profilen: ett registrerat namn där profilen bevisar ett, `Custom` under profilens eget namn där den inte gör det, så filen aldrig kan namnge ett tryckvillkor samtidigt som den bär ett annats mätvärden.
- **Utskrifts-TIFF (CMYK)** skriver otaggade **DeviceCMYK**-pixlar och registrerar samma tryckvillkor som proveniens i sin TIFF-metadata (*ImageDescription*) i stället för att bädda in en profil. Samma kontroll för färgprofil styr båda CMYK-formaten - en TIFF kan inte bädda in en tryckprofil alls, så en **Embed**-rad registrerar bara den profilens eget namn där.
- **TIFF (RGB)** är den enkla, okomprimerade sRGB-syskonet - en förlustfri raster vid vald DPI för arkivering eller en redigerar-tur-och-retur, med proveniens registrerad i samma TIFF-metadata. All transparens plattas mot vitt (denna profil bär ingen alfa). Liksom CMYK-TIFF:en är den endast för skrivbord, eftersom webbläsare inte kan förhandsgranska en TIFF och mobila nedladdningar dör ut.
- **SVG**, **EMF**, **EPS** och **DXF** är upplösnings- och profiloberoende vektorer utan inbäddad profil - SVG:s färger är vanlig sRGB, EMF:s och EPS:s är enhets-RGB (och **EPS (CMYK)** skriver naiv DeviceCMYK) och **DXF** bär närmaste AutoCAD Color Index. (SVG, EPS och DXF, liksom PDF, konturar all text till vektorbanor, så resultatet renderas även där typsnittet inte är installerat. EMF håller i stället text LEVANDE som standard - riktiga metafiltextposter som förblir markerbara och redigerbara i Office och Google Slides, med reservfall till konturer endast för sträckor formatet inte kan uttrycka; exportpanelens alternativ "Outline fonts" tvingar banor överallt.) **SVG** återger också CSS `box-shadow` från HTML:en - varje yttre skugga målas bakom rutan, offset/spridning och gaussisk oskärpa matchad mot webbläsaren, och inre skuggor målas inuti den på samma sätt.

Detta är automatiskt - ingen inställning att pilla med. Miniatyrer och förhandsvisningar hoppar över taggen för att hållas små. En profil *är* ett val, eftersom den ändrar pixlarna snarare än att bara märka dem - se **HDR** nedan.

## HDR (ljusa färger)

Vanliga exporter är sRGB: vitt är vitt, och en mättad varumärkesfärg är lika ljus som skärmens normala vitt. På en HDR-kapabel skärm finns mycket huvudrum ovanför det, och kortet **HDR** i exportpanelen använder det - dina varumärkesfärger och vit text lyfts mot toppljusstyrka så att de verkligen *glöder*, medan de mörka områdena förblir mörka och ger glöden dess kontrast.

![HDR-kortet i exportpanelen, påslaget, med rattarna White / Reach / Dark lift / Focus synliga under det](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Format.** Rasterformaten med en plats att bära signalen: **PNG**, **JPG**, **AVIF** och **TIFF**. (Inte WebP - den är 8-bitars utan fungerande HDR-avkodningsväg, så en PQ-WebP skulle helt enkelt se mörk ut. Vektorer och PDF har ingen HDR-modell alls.)
- **Avstängt som standard**, till skillnad från färgtaggning - det ändrar pixlarna, så det är valbart. Kryssa i kortet, eller skicka `hdr=1` i en delningslänk.
- **Vad som faktiskt skrivs.** Pixlarna kodas om till **Rec.2100 PQ** - BT.2020-primärer med SMPTE ST 2084-överföringskurvan (PQ) - och behållaren bär den matchande signalen så en färghanterad app vet att läsa dem så: en genererad **ICC v4-profil med en `cicp`-tagg** (JPG, TIFF), en **`cICP`-chunk** (PNG) eller en omskriven `colr`-box (AVIF). Höjningen är styrd av **perceptuell (OKLab) ljushet**, så medel-och-uppåt-färger slår upp mot toppen och mörka dämpas snarare än blåses ut, och den är nyansbevarande - en märkesgrön blir ljusare, inte myntgrön.
- **Reglagen.** Fyra, som visas när kortet är på: **White** (taket för toppljusstyrka, 400-2000 nits), **Reach** (hur långt ner i tonerna glöden sprids), **Dark lift** (hur mycket mörkret ljusnar - `0` håller det mörkt) och **Focus** (hur mycket färgrikedom höjningen behåller). De åker i samma parameter som ett kompakt inställt värde - `hdr=1600-60-0-50` är White 1600, Reach 60, Dark lift 0, Focus 50 - så ett inställt utseende är reproducerbart från länken.
- **Var du kommer se det.** Färghanterade visare på en HDR-skärm: Preview/Quick Look/Safari på Apple-enheter, Chrome på en HDR-monitor. På en vanlig SDR-skärm visas filen fortfarande som en normal bild.
- **Vet innan du skickar det.** Många plattformar **kodar om** det du laddar upp och strippar HDR-signalen - sociala nätverk, meddelandeappar, vissa CMS - vilket kan lämna bilden mörk eller urblekt. Använd HDR där du styr destinationen (en webbplats du bygger, en videovägg, ett bygge på en ljus skärm), inte som standard för allt.
- **Transparens.** PNG och AVIF behåller sin alfa; JPG är ogenomskinlig som alltid. **TIFF**-vägen plattas mot **svart**, inte SDR-vägens vitt - i PQ är vitt 10 000-nit-koden, så att platta mot det skulle ringa varje kant med en bländande halo.
- **Samma bytes från terminalen.** `--hdr=1` med `--export=png` eller `--export=jpg` skriver den 16-bitars Rec.2100 PQ-PNG:n och ISO 21496-1-gain-map-JPEG:en på [CLI:t](/info/cli.html) också, från samma motorkodare snarare än en webbläsare - så ett `<svg>`-native verktyg producerar en HDR-fil utan Chromium någonstans i vägen, och PNG:n är byte-identisk med webbskalets. AVIF och TIFF förblir webbskalsexporter tills vidare.

## Video

Animerade verktyg exporterar rörelse som **MP4**, **WebM** eller **GIF** - och, där det erbjuds, **APNG**, **Animated WebP** eller den vektorbaserade **Animerad SVG** (ovan). Vilken videobehållare du ser beror på din webbläsare - väljaren visar bara det den faktiskt kan spela in:

| Webbläsare | Visar |
|---|---|
| Safari/iOS | **MP4** |
| Firefox | **WebM** |
| Chrome/Edge 126+/Android | **MP4 och WebM** |
| Äldre Chrome | **WebM** |

GIF fungerar överallt (bra för chatt/e-post; större och med färre färger än video). Animerade verktyg exponerar också **Wait** (sekunder att låta animationen sätta sig innan inspelning) och **Duration** (klipplängd).

> En delad `?format=…`-länk som begär en behållare din webbläsare inte kan spela in faller elegant tillbaka till den andra och namnger filen därefter.

**Ljud.** Videoexporter är inte tysta. Ett verktyg kan lägga en **musikbädd** under klippet - en ljudtillgång från katalogen, loopad eller trimmad till klippets längd, med in-/uttoning, volym och automatisk ducking under filmningens eget ljud - och inspelningsverktygen för sin filmnings levande ljud rakt igenom till filen. **MP4** och **WebM** behåller det mixade spåret; GIF och de animerade bildformaten (APNG, Animated WebP, Animerad SVG) är tysta av naturen.

## Ljud

Vissa verktyg exporterar **ljud på egen hand**, inte bara som ett videospår. **Voice Recorder** fångar en mikrofontagning med en levande nivåmätare och mild coachning, och sparar den sedan som **MP3** (standard, omkodad i din webbläsare) eller i sin ursprungliga behållare - **M4A** (AAC), **OGG** eller **WebM** (Opus), vilken din webbläsare nu spelade in. Som med allt annat sker kodningen på din enhet - inget laddas upp.

Ljud du *tar med dig* är lika brett. Tillgångsväljaren accepterar **MP3**, **WAV**, **OGG**/**Opus**, **M4A**/**AAC** och **FLAC** (behållna byte för byte och avkodade på enheten), **MIDI** (`.mid` - konverterad vid import till ett litet on-device-syntspår) och **trackermoduler** - **MOD**, **XM**, **IT**, **S3M**, **STM**, **MTM** (avkodade på enheten av en medföljande spelare, några kilobyte låtdata). Alla dessa kan bli **musikbädden** under en videoexport, eller spelas i Neurospicy Modes ambienta spelare.

Ljud *är* en del av `format=`-/`--export=`-pipelinen nedan: `wav`, `mp3`, `m4a` och `opus` är vanliga format-id, så en ren ljudexport är lika delbar och lika skriptbar som en PNG. Det som kommer ut är enbart ljudet, ingen bild.

## Proveniens och vattenstämpel

Där formatet stöder det bär exporter **proveniensmetadata** - programvara, källa, verktygets namn och din profils kreditrad - inbäddad nativt (PNG iTXt, JPEG EXIF, PDF-info, SVG `<metadata>`, GIF-kommentar). Det är enbart upphovsmannaskap; inget laddas upp. **Experimentella** verktyg stämplar dessutom en synlig vattenstämpel, applicerad av värden så att den inte kan tas bort genom att redigera verktyget.

**The Lolly Imprint.** Rasterexporter bär också Lollys egen **osynliga pixelvattenstämpel** - *Lolly Imprint* - **påslagen som standard**, precis som Content Credentials. Där credentialet och proveniensmetadatan färdas *vid sidan av* pixlarna och går förlorade vid ett omsparande, en skärmdump eller en metadataavstripping, lever Imprinten *i* pixlarna och överlever omkomprimering - så en kopia av bilden kan fortfarande kännas igen som Lolly-gjord senare. Det är en varaktig ledtråd, inte en kryptografisk garanti, och den är endast närvaro-baserad (den bär inga personuppgifter). Den åker med i **PNG, JPG, WebP, AVIF, TIFF och BMP**, och i de Lolly-renderade rastrarna som komponeras in i en **PDF eller PPTX** - aldrig i en bild *du* bäddade in, bara i det Lolly själv renderar. Bocka ur kortet **Lolly Imprint** i exportpanelen för att hoppa över det, eller skicka `imprint=0` i en delningslänk. (AVIF:s överlevnad genom omkodning är inte kalibrerad än; PDF/PPTX-detektering täcker de inbäddade Lolly-rastrarna.) [/verify](/verify) upptäcker det på enheten - se [Content Credentials Identity](/info/content-credentials-identity.html#the-lolly-imprint).

**Det varaktiga credentialet.** En andra, tyngre markering sitter bredvid Imprinten: **Durable credential**, som använder en neural on-device-modell (TrustMark-format) för att skriva Lollys id *in i* pixlarna så att länken "gjord med Lolly" överlever en metadataavstripping, en omkodning och en omläsning av TrustMark-medvetna verktyg såväl som Lollys egna. Det är **avstängt som standard** - till skillnad från den rena JavaScript-Imprinten kostar det en neural pass per export plus en engångsmodellnedladdning, så det är ett medvetet opt-in snarare än en tyst avgift. Endast raster (**PNG, JPG, WebP, AVIF, TIFF**), ikryssad i exportpanelen eller skickad som `durable=1` i en delningslänk. På desktop- och mobilapparna döljs kortet helt i stället för att visas som en no-op, eftersom det inte finns någon ursprungskälla att hämta modellen från offline.

**Innehållsskydd.** I exportpanelen viks *Password protect*, **C2PA Credentials**, **Lolly Imprint** och **Durable credential** ihop till en enda hopfälld, formatmedveten grupp **Content protection**, så att en fils proveniens- och skyddsalternativ bor på ett ställe - gruppen visar bara de kort som gäller för det valda formatet, och döljer sig helt när inget av dem gör det. Utskriftsmärken är avsiktligt *inte* med i den: de är utskriftsproduktionsgeometri snarare än skydd, så **Print marks & bleed** - utfallsmåttet i millimeter plus Crop, Registration, Bleed, Colour bars och Stamp details - behåller sitt eget kort på toppnivå på utskriftsformaten.

![Gruppen Content protection öppnad på en PNG-export, som visar bara de kort som gäller för den](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

**Innan du exporterar (utskriftsförgranskning).** Slå på **Print preflight** (`export-preflight`) i din profils funktionsflaggor - det är **avstängt som standard**, så en enskild person som exporterar en PNG för ett chattmeddelande aldrig överraskas av prepress-fynd, och en driftsättnings kontrollplan ([lolly.work](https://lolly.work)) kan slå på det som standard för sina medlemmar - och ett kort **Before you export** dyker upp längst ner i panelen, direkt ovanför knapparna, närhelst utskriftsreglerna har något sant att säga om jobbet: format, storlek och utfall, sedan skär- och utfallsområden, färgtäckning, plåtantal och sidantal, med en dom bredvid sin rubrik. Det sitter under varje inställning eftersom det är ett påstående *om* de inställningarna snarare än ännu en av dem - och det blockerar aldrig en export. Det talar om för dig vad ett tryckeri är på väg att se.

**Kostnad, uträknad från ditt prisregister.** Under förgranskningen - sist av allt, fortfarande ovanför knapparna - sitter ett kort som förvandlar samma antal till pengar, och alltid bara utifrån priser någon gav det. Det läser vad förgranskningspasset än räknade, oavsett om förgranskningskortet självt är påslaget, och det kräver att två saker är sanna: jobbet har något en prislista alls kan prissätta (plåtar, ark, yta, sidor, variantrader eller utdatafiler - så en enkel logga-PNG visar det aldrig), **och** ett **prisregister** finns. Ett prisregister är en JSON-prislista från ditt tryckeri. En standardbuild bär inget och har inget sätt i appen att ladda ett: det anländer antingen som en katalogtillgång en driftsättning skeppar, eller genom det valfria prisregistertillägget en självhostare eller kontrollplan slår på. Utan ett prisregister visas inget - varken en uppmaning eller en tom tabell.

Regeln hela grejen är byggd kring är att den **aldrig hittar på pengar**. Varje siffra är en taxa du angav gånger en kvantitet Lolly räknade - `4 plåt × €35.00` - och totalsumman namnger sin egen källa i samma mening som siffran: utgivaren kortet namnger, och datumet kortet säger att dess taxor är från. Det finns ingen standardvaluta, ingen platshållare och ingen nolla som står in för ett saknat pris. Vad filen säger om sig själv förblir refererat tal: *"Filen säger: … Lolly har inte verifierat detta."*

Och när den inte kan räkna ärligt **försvinner** arbetstabellen i stället för att degradera till en gråad eller ifylld siffra:

- Rader kortet inte prissätter betyder **ingen totalsumma alls** - bara en rubrik som säger hur många av dem som är opriskatta. En partiell summa är inte ett mindre svar, det är ett felaktigt.
- En kvantitet som är ett tak snarare än ett exakt antal bär **"upp till"** vidare in i sin delsumma, så en gräns aldrig tvättas till en platt siffra.
- Taxor förbi sitt giltigt-till-datum visar **endast antal**, tills du trycker på *Use these rates anyway* - och då åker utgångsdatumet med siffran, så en förfallen totalsumma inte kan läsas som en aktuell.
- Öppnat via en **länk** förblir pengarna dolda tills du begär dem på den här enheten. Varken kortet eller den avslöjningen färdas någonsin i en URL - samma anledning till att CLI:n tar `--rate-card=<file.json>` som en lokal filflagga och aldrig som en länkparameter.

Kortet är chrome, aldrig innehåll: det stripas bort från varje exportsteg, så det kan inte flytta en enda pixel i filen du laddar ner. Och det är aritmetik, inte en offert - bara ditt tryckeri kan ge dig en.

**Komponerade renderingar.** När ett verktyg bäddar in ett annat verktygs utdata (t.ex. en *Event Name Badge* som bäddar in en *QR Code*), infogas den nästlade renderingen i förälderns export - den förblir en **äkta vektor** i SVG och PDF och rastreras skarpt i PNG/JPG/WebP. Det inbäddade barnet är ett mellansteg: det får *ingen* vattenstämpel och *ingen* egen proveniens; endast den färdiga föräldertillgången gör det. (Komposition täcker SVG och rasterformaten; HTML/MD/TXT kan inte komponeras.)

## Lösenordsskydd

Två oberoende typer av lås, båda helt på enheten.

**PDF-öppningslösenord** - exportpanelens kort *Password protect* erbjuder två nivåer:

![Kortet Password protect utfällt vid en PDF-export, med lösenordsfältet och de två låsnivåerna](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

- **Standard** - ett enkelt 40-bitars lås (RC4). Det öppnas i *alla* PDF-appar, och - eftersom det är ett lätt avskräckande medel, inte ett verkligt skydd - kan det följa med i en delningslänk (klartext, med avsikt). Endast RGB `pdf`.
- **Strong** - AES-256 (PDF 2.0). Lösenordet skrivs in vid export och läggs **aldrig** in i en länk; det öppnas bara i nyare PDF-appar (Acrobat/Preview ~2018 och senare), och äldre appar kan rapportera filen som skadad. Strong gäller även **Print/CMYK-PDF:er** och **varje PDF inuti en batch-zip** (bekräftelsedialogen för batchen samlar in lösenordet). Eftersom PDF/X-4 förbjuder kryptering behåller en Strong-låst Print-PDF sin CMYK, sina märken och sitt output intent, men tappar sitt PDF/X-4-konformitetskrav.

Ingen av nivåerna kan kombineras med Content Credentials (en krypterad PDF kan inte ta emot autentiseringsuppgiften).

**Låsta nedladdningar (hela zip:en + skydd i flera lager)** - en **ZIP**-export (exportpanelens *ZIP*-format, som samlar flera av ett verktygs format), en **mapp**-nedladdning (Projects → Download) eller **batch-rutnätet** kan låsa hela zip:en med ett lösenord, i två nivåer:

- **Standard** - traditionell **ZipCrypto**: öppnas i *alla* uppackningsverktyg, inklusive Windows Explorers inbyggda uppackning, men svagt (ett avskräckande medel). Lösenordet kan följa med i en delningslänk med `?password=`.
- **Strong** - **AES-256** (WinZip AE-2): starkt, men öppnas **inte** i Windows Explorers inbyggda uppackning - mottagaren behöver 7-Zip/WinZip/Keka/macOS. Skrivs in vid export, läggs aldrig in i en länk.

Samma kort *Password protect* i exportpanelen styr både PDF- och ZIP-låsen och formulerar om sig för det valda formatet. Ett och samma lösenord skyddar **alla** medlemmar - bilder, SVG, allt, PDF:er inräknat (endast zip-behållaren kan skydda filer som inte är PDF, eftersom de saknar ett eget lås). Och det är **skydd i flera lager**: varje PDF inuti blir *också* individuellt AES-256-låst med samma lösenord, så en PDF förblir låst även efter att zip:en packats upp. Prompten visas när du startar nedladdningen; ett tomt lösenord innebär inget lås.

**Lösenordsskyddade delningslänkar** - vilken delningslänk som helst kan krypteras så att den som öppnar den ombeds ange ett lösenord. Hela länktillståndet AES-256-krypteras med en nyckel som härleds från lösenordet (PBKDF2); endast chiffertext följer med, så **lösenordet finns aldrig i länken** och dekrypteringen sker **i mottagarens webbläsare** - servern som levererar länken ser bara chiffertexten i URL:en, aldrig lösenordet och aldrig den dekrypterade designen. Slå på det i dialogrutan **Share**. En krypterad länk kan bara *öppnas* i Lolly (den kan inte bäddas in som en bild, eftersom den vägen inte kan visa en prompt). Se [URL-läge → Krypterade länkar](/info/url-mode.html).

## Content Credentials (C2PA)

Exporter kan bära **Content Credentials** - ett signerat [C2PA](https://c2pa.org)-manifest inbäddat i filen som på ett manipuleringssäkert sätt registrerar att filen skapades med Lolly och inte har ändrats sedan dess. Det är standardspåret för proveniensmetadatan ovan: ett kryptografiskt påstående (vad som skapade filen, när, av vem och var) bundet till en hash av filens byte, så att varje senare redigering kan upptäckas av en C2PA-medveten visare. Standarden förvaltas av [Content Authenticity Initiative](https://contentauthenticity.org) (Adobe, BBC, Microsoft, Nikon med flera), så samma autentiseringsuppgifter som Lolly skriver är de som kameror, nyhetsredaktioner och kreativa sviter börjar använda.

![Kortet C2PA Credentials, förbockat, med autentiseringsuppgiftens livslängd bredvid](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Format.** Varje behållare med C2PA-inbäddning: **PDF** (både RGB och Print), **PNG/Animated PNG**, **JPG**, **GIF**, **SVG**, **TIFF** (RGB och Print), **WebP** (stillbild och animerad), **AVIF**, **MP4**, **WebM** samt ljudbehållarna **MP3**, **WAV**, **M4A** och **OGG/Opus** - så att ett inspelat eller syntetiserat röstklipp får samma autentiseringsuppgift som en bild. Ett **ZIP**-paket stämplar varje medlem som stöds individuellt, vilket också är där en **Animated SVG** får sin - det är ett vanligt SVG-dokument under ytan; en direkt Animated SVG-export erbjuder inget eget kort. MP4, AVIF och M4A använder specifikationens BMFF-bindning och MP3 dess ID3v2-mappning, så `c2patool` och andra C2PA-medvetna visare kan verifiera dem; **WebM** och **OGG/Opus** saknar ännu en standardiserad C2PA-mappning, så Lolly bär manifestet som en Matroska-bilaga respektive ett OpusTags-fält, vilket Lollys egen verifierare (och CLI) kontrollerar. (`ico`, `eps`, `emf`, `dxf`, `bmp`, `pptx`, Office-formaten och text-/dataformaten saknar C2PA-behållare.)
- **På som standard.** Kortet **C2PA Credentials** i exportpanelen är förvalt för nästan alla verktyg - bocka av det för att hoppa över autentiseringsuppgiften för en enskild export (eller skicka `c2pa=off` i en delningslänk). Ett verktyg kan välja bort det helt i sitt manifest.
- **Vad det registrerar.** Verktyget och appen som skapade filen, signeringstiden, exportytan (webbläsarmotorfamilj + OS-familj - medvetet grovkornigt, aldrig ett fingeravtryck) och - endast när *Profile → Use my details* är påslaget - ditt namn och din e-post som verkets upphovsperson.
- **Vad mottagare ser.** Verktyg som granskar Content Credentials (Adobe-appar, `c2patool`, contentcredentials.org/verify) läser manifestet och visar påståendet. Eftersom Lolly signerar med en nyckel som genereras **på din enhet** - inte ett certifikat från en betrodd lista - rapporterar visare den som en *overifierad* autentiseringsuppgift. Strukturen och manipuleringssäkerheten är verkliga; det är bara signerarens identitet som inte intygas av en betrodd part. För att uppgradera det kan du registrera en **verifierad identitet** (Profile → Content Credentials): ett kortlivat certifikat från Lolly CA knyter din e-post till dina exporter medan signeringsnyckeln fortfarande aldrig lämnar din enhet - se [Content Credentials Identity](/info/content-credentials-identity.html).
- **Kontrollera en fil.** Lolly verifierar även sina egna autentiseringsuppgifter: släpp valfri fil på [/verify](/verify) (eller kör `lolly validate <file>` i CLI:t) för en rapport på enheten - med rubriken om filen verkligen skapades med Lolly och är oförändrad sedan dess. Webbvyn Verify läser långt utöver autentiseringsuppgiften: den flaggar **AI-genererat innehåll**, upptäcker **Lolly Imprint**, kontrollerar **SEAL**-signaturer och (valbart) pixelvattenstämplar från tredje part samt visar **dold data** - allt på enheten, inget laddas upp. Se [Content Credentials Identity → Bortom autentiseringsuppgiften](/info/content-credentials-identity.html#beyond-the-credential-what-else-verify-shows).
- **Integritet.** Allt sker på din enhet: signeringsnyckeln skapas för exporten och lämnar aldrig webbläsaren, inget laddas upp och påståendet innehåller bara det som proveniensmetadatan redan bär. Integritetsverktyg (transformationer på enheten av *dina egna* filer) lägger aldrig till autentiseringsuppgifter, och *Strip Hidden Data* tar bort ett C2PA-manifest precis som annan inbäddad metadata.
- **Interaktioner.** För PDF:er är Content Credentials och **lösenordsskydd** (oavsett nivå - se ovan) ömsesidigt uteslutande (en krypterad PDF kan inte ta emot bilagan med autentiseringsuppgiften). Autentiseringsuppgiften läggs till som sista steg över de färdiga byten - efter DPI/EXIF/färgprofilstämpling, PDF/X-metadata och tryckmärken.

## På en telefon

Exportkontrollerna finns bakom den flytande knappen **Render**, som öppnar arket **Export** - samma format, storlek, kopiering, nedladdning och delning, anpassat för touch.

## Formatreferens

Varje id som värden kan rendera, grupperat. Dessa är också värdena för URL-parametern `format=` och CLI-flaggan `--export=` - se [URL-läge](/info/url-mode.html) och [CLI](/info/cli.html). Ett verktyg erbjuder bara den delmängd dess upphovsperson deklarerat, så väljaren är alltid kortare än den här listan.

| Typ | Id:n |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vektor | `svg` · `svgz` (gzippad SVG) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (skärfil) |
| Sida och dokument | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `scorm` (SCORM-kurspaket, en zip) · `penpot` (Penpot-designfil) · `docx` (Word) · `odt` (OpenDocument Text) |
| Rörelse | `gif` · `apng` (Animerad PNG) · `webp-anim` (Animerad WebP) · `svg-anim` (Animerad SVG) · `webm` · `mp4` |
| Ljud | `wav` · `mp3` · `m4a` · `opus` |
| Text och data | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `css` · `scss` · `gpl` (GIMP-palett) |
| Paket | `zip` |

Några ytterligare id:n kommer från ett **verktygs egen exporthook** snarare än den delade renderingsvägen: `ase` (Adobe Swatch Exchange, från Palette Lab), `exr` och `hdr` (Darkrooms rastergrafik med högt dynamiskt omfång) samt `ttf`/`otf`/`woff` (Font Convert). De väljer format på samma sätt - väljaren, `format=`, `--export=` - det är bara byten som byggs av verktyget. Font Convert är det enda undantaget: det transformerar en typsnittsfil *du* tillhandahåller, så det finns inget för en ren URL att rendera.
