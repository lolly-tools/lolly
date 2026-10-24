# Exportera en fil

Du har gjort något och det behöver lämna Lolly: en PNG för en chatt, en PDF för tryckeriet, en presentation som en kollega fortsätter redigera. Tryck på **Export**, den vänstra halvan av pillret **Export | Save**. Välj ett format bredvid filnamnet och tryck sedan på **Download**. Filen görs på din enhet.

Det du ser på ytan är vad filen innehåller. Formatmenyn listar bara det det här verktyget kan göra i den här webbläsaren.

För de flesta jobb är ett av tre format rätt:

| För | Välj | Eftersom |
|---|---|---|
| En skärm, ett meddelande eller en presentationsbild | **PNG** | Alla appar öppnar den, och den behåller en transparent bakgrund när verktyget erbjuder det |
| En färdig sida, eller allt som ska tryckas | **PDF** | En verklig sidstorlek som skrivs ut precis som den ser ut; **Print PDF**, där ett verktyg erbjuder det, är CMYK-versionen för ett tryckeri |
| Konstverk som måste förbli skarpt i alla storlekar | **SVG** | Vektorformer, skarpa från en bricka till en banderoll |

::: check Kontrollera filen i den storlek den ska användas
Innan du skickar den, öppna den på skärmen den gjordes för, eller skriv ut den i sin verkliga storlek.
:::

::: details Godkännanden och leverans med Lolly Work (valfritt)
En [organisation som kör Lolly Work](/info/organisation.html) kan styra vilka format och exportinställningar dess medlemmar ser. Där godkännande krävs tar **Request approval** platsen för **Download**. Följ policyn din instans visar.

Lolly Work kan också leverera en fil till konfigurerade S3-, WebDAV- och HTTP-destinationer, med godkännandesteg, leveranskvitton och en granskningspost. Att skicka in en fil för det arbetsflödet skickar den till organisationens tjänst; en vanlig nedladdning stannar på din enhet. Personliga Send-destinationer och organisationsleverans konfigureras separat.

Operatörer sätter upp detta med [organisationens leveransguide](/info/work-delivery.html). För köade serverrenderingar och batchar, se [CLI batch and automation](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

## Så fungerar export

När du exporterar renderas verktygets yta till formatet du valde och lämnas till dig som en nedladdning, eller läggs i ditt urklipp.

Tre vägar ger en fil. De flesta verktyg **renderar ytan**. Text- och dataformat (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) **genereras från verktygets innehåll** i stället för att ritas från bilden. Integritetsverktyg som *Strip Hidden Data* **omvandlar filen du valde**, på din enhet, och lämnar tillbaka den utan yta, vattenstämpel eller tillagda metadata, eftersom den redan är din egen fil.

![Tre exportvägar leder till en färdig fil: rendera ytan, generera text eller data från innehåll, eller omvandla en vald fil på enheten.](/info/diagrams/concepts/three-export-paths.svg)

Exportpanelen erbjuder de här åtgärderna. Ett verktygs upphovsperson väljer vilka som visas; standarduppsättningen är Copy, Download och Save.

- <!--i:download--> **Download** sparar filen. Om du inte hittar den efteråt, se [Hitta en fil du laddade ner](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> **Copy** lägger bilden i ditt urklipp, redo att klistras in i en chatt, ett mejl eller ett dokument. Där en webbläsare inte kan kopiera bilder laddar den ner i stället och säger det.
- <!--i:folder--> **Save** behåller den aktuella designen i Projects med ett klick och laddar aldrig ner en fil. **Save as**, bredvid **Download**, frågar vart (se [Spara och fortsätta](/info/using.html#saving-continuing)).
- <!--i:link--> **Share** öppnar dialogen Share: en länk som återskapar designen, växlarna vid besök (helskärm, exportpanel, nedladdning eller kopiering vid öppning) och en valfri **Shortest link** som packar hela tillståndet i en kompakt token (se [URL-läge](/info/url-mode.html)).

![Exportpanelen - format, storlek och åtgärderna Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

När en design bäddar in ett annat verktygs rendering, till exempel en Design-bildruta med en QR Code-länk, ritas den nästlade renderingen in i förälderns export. Den förblir äkta vektor i SVG och PDF och rastreras skarpt i PNG, JPG och WebP. Den inbäddade renderingen får ingen vattenstämpel och ingen proveniens av egen; bara den färdiga filen får det. HTML-, Markdown- och TXT-exporter kan inte hålla en sammansatt rendering.

## Välj ett format

Filnamnet och formatmenyn sitter tillsammans som ett `name.format`-par, under **Ladda ner**.

![Filnamnsfältet sammanfogat med formatväljaren, så att exporten läses som ett name.format-par](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Börja från dit filen ska. Varje kort listar formaten som passar den destinationen; ett verktyg visar bara dem det kan göra.

::: figure exporting-format-chooser
Sex destinationer och formaten som passar var och en.
:::

Ett ordmärke satt i ditt designsystems typsnitt exporteras som SVG med varje bokstav som en konturad bana, så att en fil förblir skarp i visitkortsstorlek och i byggnadsstorlek.

![Ett hårfint ordmärke med vid teckenglesning som lyder Aurora, den sorts rena vektorgrafik som SVG-raden i tabellen handlar om](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Varje format och vad det är till för
| Du vill ha | Använd | Varför |
|---|---|---|
| Skarpa logotyper eller grafik som skalar | **SVG** | Vektor: skalbar, liten och redigerbar; en effekt som vektorexporten inte kan rita bäddas in som en bild |
| Vektor för Office och Windows-appar | **EMF** | Klistras in som redigerbar vektor i PowerPoint och Word, med levande text; Google Drive öppnar den i Google Drawings |
| Vektor för tryck och designappar | **EPS**, eller **EPS (CMYK)** | PostScript-vektor för Illustrator och tryckflöden |
| Vektor för skärmaskiner | **DXF** | Laserskärare, vinylplotters och CNC: konturbanor i millimeter |
| En redigerbar presentation | **PowerPoint** (PPTX) | Inbyggd redigerbar text och inbyggda former, med bilder och vektorer som går att plocka ut |
| Ett redigerbart textdokument | **Word** (DOCX) eller **OpenDocument** (ODT) | Riktiga stycken och rubriker som en ordbehandlare kan fortsätta redigera (Doc Studio) |
| En layout för InDesign | **InDesign IDML (static subset)** | Text, rektanglar, ovaler och bilder, ett uppslag per rityta (Design) |
| Ett redigerbart Penpot-dokument | **Penpot** | Tavlor, former, text och länkade tokens |
| Ett foto eller en allmän bild | **PNG** (förlustfri) eller **JPG** (mindre) | Universell raster |
| Mindre moderna bilder | **WebP** eller **AVIF** | Bättre komprimering, med transparens |
| Tryck | **PDF**, eller **Print PDF** (CMYK) | Verklig sidstorlek; CMYK för ett tryckeri |
| Tryckraster för ett tryckeri | **Print TIFF** (CMYK) | DeviceCMYK-pixlar för en RIP |
| Animerad för webben | **GIF** | Spelas överallt; större filer |
| Animerad med full färg och verklig transparens | **APNG** | Animerad PNG: ingen palettbegränsning |
| Animerad, minsta filen | **Animated WebP** | Full färg och transparens, mindre än GIF eller APNG |
| Animerad vektor som skalar | **Animated SVG** | Självständig; loopar i en webbläsare eller en `<img>`, i valfri storlek (Lottie Ad) |
| En animation som förblir redigerbar | **dotLottie** | Former, banor och yttre transformationsnycklar från Designs tidslinje |
| En överlämning till Premiere | **Premiere XML + media** | Tidsatta klipp och originalmedia för Premiere (Design) |
| Video för sociala medier och delning | **MP4** eller **WebM** | Bästa kvalitet för filstorleken (se [Video](#video)) |
| Undertexter | **SRT** eller **VTT** | Tidsatt text för en videospelare (Captions, Audiogram och Record) |
| En utbildningskurs | **SCORM (LMS)** | En versionshanterad webbplats, SCORM- eller xAPI-paket (se [SCORM](#scorm-course-packages)) |
| Formaterad text eller en e-postsignatur | **HTML** | Klistras in formaterat i e-postklienter |
| Ren text | **MD** eller **TXT** | Bara text |
| En kalenderhändelse | **ICS** | Importeras i vilken kalenderapp som helst |
| Ett kontaktkort | **VCF** | Importeras i adressböcker |
| Strukturerad data att importera igen | **JSON** eller **CSV** | Tur och retur av verktygets innehåll |
| En favicon | **ICO** | Webbplatsikon i flera storlekar; **ZIP** paketerar flera format |
:::

### Transparens

Verktyg som stöder det erbjuder en växel för transparent bakgrund, som **No BG**. PNG, WebP, AVIF, SVG, APNG och Animated WebP behåller transparens, och GIF behåller en hård kant. JPG och PDF är alltid ogenomskinliga. TIFF plattas till på vitt, eller på svart på HDR-vägen som beskrivs under [HDR](#hdr-bright-colours).

## Storlek och tryckenheter

Exporter använder verktygets ursprungliga pixelstorlek om inte verktyget erbjuder **dimensions**. Då anger du bredd, höjd och en **unit**:

- **px** (standard) är exakta pixlar.
- **mm, cm, in, pt** och **pc** är fysiska storlekar. Med en fysisk enhet anger du också **DPI** (300 som standard). En **PDF** blir en verklig sida i den storleken, en **raster** får pixelantalet för den DPI:n och registrerar upplösningen, och en **SVG** behåller den fysiska enheten med en pixel-viewBox.

För en raster med högre upplösning anger du en större bredd och höjd, eller väljer en fysisk enhet och höjer DPI (pixlar = storlek × DPI). Bredd `210`, höjd `297` och enhet `mm` ger en A4-sida.

![Dimensionsraden inställd på 210 gånger 297 mm, med DPI-fältet synligt eftersom enheten är fysisk](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Stillbilder från en tidsbaserad komposition

En tidsatt komposition, som en [Sequence](/info/sequence-editor.html)-tidslinje i Design, rör sig, så en stillbildsexport måste välja ett ögonblick: **bildrutan vid spelhuvudet**. Parkera spelhuvudet där du vill ha bilden och exportera.

För mer än ett ögonblick visas fältet **Frames** bredvid utdatastorleken. Det visas bara för en tidsatt komposition och ett stillbildsformat (PNG, JPG, WebP, SVG eller PDF). Låt det vara `1` för bildrutan vid spelhuvudet. Höj det så får du så många stillbilder, jämnt fördelade över hela sekvensen:

- PNG, JPG, WebP och SVG kommer tillbaka som en ZIP: `<name>-01.png`, `-02.png` och så vidare.
- PDF kommer tillbaka som ett dokument med så många sidor.

Varje stillbild kommer från mitten av sin del av tidslinjen, så den första bildrutan är aldrig ett halvtonat intåg och den sista är aldrig det tomma ögonblicket efter att varje klipp tagit slut.

::: figure exporting-contact-sheet
Frames: 4 skär sekvensen i fyra lika delar och tar mitten av var och en.
:::

Använd det för en storyboard, ett granskningskontaktark eller en social karusell klippt från en videoredigering. Antalet begränsas till 64, och allt annat som skrivs i fältet faller tillbaka till `1`. Varje bildruta är en vanlig stillbild, så credentials, Imprint, fysiska enheter och DPI beter sig som för en export. En exportlänk, CLI och MCP ber om samma ark med `cuts=` (se [Kontaktark](/info/url-export.html#contact-sheets)).

## Många filer på en gång

Lolly har tre sätt att arbeta i volym, vart och ett för ett annat jobb:

::: cols
## En tabell blir ett dokument
Ett verktyg med en tabellindata, som **Battlecards**, gör varje rad till en sida. Klistra in en tabell från ditt kalkylblad och få en PDF. Rätta rader i kalkylbladet och klistra in igen.
## En CSV blir en fil per rad
**Batch** (`#/batch`) tar en CSV och renderar en export för varje rad: namnbrickor eller certifikat, en fil var, levererade i en ZIP. Se [Batch](/info/batch.html#make-many-versions-of-one-design).
## Flera designer får en redigering
**Multi-edit** öppnar flera sparade sessioner sida vid sida för samma justering över olika designer. Se [Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Från **Projects** exporterar **Render folder** varje sparad session i en mapp och dess undermappar som en nästlad ZIP, och **Render selection** gör detsamma för vilket flerval som helst; en sparad session renderas till sin egen fil. En sparad session kan också delas igen som en verktygslänk från Projects, som öppnar den igen med samma inställningar.

## Filer som förblir redigerbara på andra ställen

Vissa format lämnar ditt arbete till ett annat program som redigerbart innehåll snarare än en bild.

### PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart, Diagrams, Flow Chart och Agenda exporterar en PowerPoint-presentation, en bild per sida. Varje sida tas isär i inbyggda objekt, så en kollega kan redigera presentationen och plocka ut tillgångar ur den:

- <!--i:font--> **Text** blir redigerbara PowerPoint-textrutor med layoutens teckenstorlek, färg, vikt, kursiv och justering.
- <!--i:pentool--> **Vektorer** som logotyper och ikoner bäddas in som SVG-bilder; de förblir skarpa, och PowerPoint kan *Convert to Shape* på dem.
- <!--i:photos--> **Bilder** kommer med i originalupplösning som egna bilder. En beskuren huvudbild behåller hela bilden bakom beskärningen, och varje filter eller blandning på den bränns in.
- <!--i:layers--> **Bakgrunder, kanter och linjer** blir rektangel- och linjeformer.

![Exportpanelen med PowerPoint valt: en bild per sida, text och former förblir redigerbara](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Layouten är ungefärlig; målet är återanvändbart innehåll. Allt vandraren inte kan uttrycka inbyggt, som en komplex filtrerad eller maskad region, bäddas in som en bild så att inget går förlorat. En presentation har en bildstorlek, tagen från den första sidan.

PowerPoint är också en väg in: [Rebrand a deck](/info/rebrand.html) flyttar en presentation till ditt designsystem, och [Importera en design](/info/design-import.html) öppnar en i Design.

### Penpot

De flesta verktyg som exporterar SVG exporterar också en **Penpot-fil** (`.penpot`), redo att fortsätta redigeras i Penpot.

| Vad du gjorde | I Penpot |
|---|---|
| Text | Redigerbara textobjekt: rätta ett stavfel eller ändra stilen |
| Former, banor, gradienter och bilder | Egna redigerbara vektorformer |
| En färg eller ett typsnitt från en designsystemtoken | En levande tokenlänk: redigera token så följer varje form som ärver den |
| Hela designen | En återanvändbar komponent i panelen Assets |
| En komplex illustration eller levande yta | Inbäddad för sig som en bild, med det redigerbara innehållet runt den orört |

Från Design blir varje ram en Penpot-tavla. Designsystemets färger och typografier hamnar i panelen Assets och dess fullständiga tokenuppsättning i panelen Tokens. Penpot behåller sin egen kopia därifrån: en token som redigerats i Penpot kommer tillbaka genom importen i [Design System Setup](/info/brand-studio.html).

![Exportpanelen med Penpot valt: .penpot-filen, och Send to Penpot bredvid nedladdningen](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

För att öppna filen startar du Penpot, väljer ett projekt och väljer **Import**. Inloggad på Penpot från exportpanelen gör **Send to Penpot** det steget åt dig.

### Word, OpenDocument och InDesign

**Doc Studio** exporterar **Word** (DOCX) och **OpenDocument** (ODT) med riktiga stycken och rubriker.

**Design** exporterar **InDesign IDML (static subset)**: text, rektanglar, ovaler och PNG- eller JPEG-bilder, ett uppslag per rityta. Inline-formatering som stöds förblir redigerbar, bilder färdas i `Links` och koordinater blir InDesign-punkter. Omlänkning, typsnittsersättning och ändrad radbrytning kan behöva uppmärksamhet. Effekter, animation, sammansatta berättelser och geometri som inte stöds stoppar exporten med en rapport som listar dem. IDML bevarar inte originaldokumentet, så skicka PDF för färdig grafik.

### Tidslinjer: dotLottie och Premiere

Från Designs tidslinje skriver **dotLottie** en animation som förblir redigerbar i Lottie-verktyg; [Lottie-animationer](/info/sequence-editor.html#lottie-animations) listar vad den behåller. **Premiere XML + media** paketerar tidsatta klipp och deras originalmedia för Premiere; se [Premiere XML-utbyte](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (kurspaket)

Kursexport är av tills du slår på **Training and courses** under Settings → Preferences → Feature flags.

Välj sedan **Export course** från ett verktyg som stöds, en projektmapp eller ett urval. I Design öppnar valet **SCORM (LMS)** och **Download** samma kursarbetsflöde. Lolly sparar arbetet, låter dig granska kursinnehållet och ordningen och öppnar sedan modulen och dess exportdialog.

- <!--i:layers--> Välj en rendering för varje källa: stillbildssidor, rörelse som video, ljud eller en nedladdningsbar resurs. Lägg till lektionstext och läsalternativ i modulen.
- <!--i:clock--> Förhandsgranska elevspelaren och granska beskrivningar och undertexter. Rörelse ingår som video, även tyst animation.
- <!--i:document--> Välj Website, SCORM 1.2, SCORM 2004 4th Edition eller ett experimentellt xAPI-mål. Kontrollera innehållet och ZIP-storleken, spara sedan och ladda ner den kontrollerade versionen.
- <!--i:check--> Slutförande kräver att varje obligatorisk lektion bekräftas och att Finish väljs.

![Exportpanelen på ett Design-bygge med SCORM (LMS) valt](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Paketet håller sitt färdiga innehåll och behöver inget Lolly-konto. Lägg en Website-ZIP på en HTTP(S)-värd; importera en LMS-ZIP oförändrad. Testa destinationen innan du delar kursen. För en kurs byggd av flera sparade skapelser, se [Skapa en utbildningskurs](/info/training-creators.html).

### DXF (skärfiler)

Asset Export, Diagrams, Growth, Logo Wall, QR Code, Street Map, Wayfinding och Wordmark exporterar **DXF**, AutoCAD R12-utbytesformatet som laserskärare, vinylplotters och CNC-programvara läser. Geometri skrivs som konturbanor i millimeter, text konturas och färg avbildas på närmaste AutoCAD Color Index, som oftast styr skärarens operation. DXF är bara linjegrafik: en fotografisk eller filtrerad region har ingen skärbana och släpps, med en varning. Använd SVG eller PDF för att behålla rasterinnehåll.

Street Map är det tydligaste fallet. Hela designen är redan linjer, så varje väg och kanal blir en skärbana.

::: showcase
![En Street Map-rendering av Paris i bläck på krämvitt - ren strecklinjekonst, så varje streck överlever resan till en skärmaskin](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Scrolla, och kameran dras tillbaka genom den faktiska geometrin: sju banor, inga pixlar någonstans, varje streck hårfint skarpt i alla zoomlägen. Det är samma fil som en skärmaskin läser.
:::

## Tryck

**Print PDF** skriver CMYK mot ett namngivet tryckförhållande, **Coated FOGRA39** som standard. Varumärkesfärgprov med uppmätta färgvärden konverteras exakt; andra färger använder en vanlig enhetskonvertering. **Print TIFF** skriver DeviceCMYK-pixlar för en RIP och registrerar samma tryckförhållande i sina TIFF-metadata. Kontrollen Colour profile styr båda; [Färgprofiler](#colour-profiles) har detaljerna.

**Print marks & bleed** har ett eget kort på tryckformaten: utfallet i millimeter plus Crop, Registration, Bleed, Colour bars och Stamp details.

Vissa verktyg bygger en **PDF med flera sidor**: ett omslag, innehåll som flyter över så många sidor det behöver och en baksida, som i verktyget *Booklet*. Varje sida är en verklig stående PDF-sida i A4, US Letter eller A5, och du kan tvinga vilket block som helst till en ny sida. Det här är RGB-dokument utan skär- eller utfallsmärken, som hör till den enkelsidiga Print PDF. En Design-PDF kan också vara ett **Notes handout**: en stående sida för varje bild med dess talaranteckningar under.

**Innan du exporterar.** Ett kort **Before you export** längst ner i panelen säger vad ett tryckeri är på väg att se: format, storlek och utfall, beskärnings- och utfallsytor, färgtäckning, antal plåtar och sidantal, med ett utlåtande bredvid rubriken. Det blockerar aldrig en export. Design visar alltid kortet med sina egna kontroller, inklusive designsystemets organisationsregler lager för lager och skrivsignalen för dokumentets text ([Innan du exporterar](/info/design.html#before-you-export)), och lägger till de här tryckkontrollerna när **Print preflight** är på. I andra verktyg slår du på **Print preflight** under Settings → Preferences → Feature flags; den är av som standard, och en Lolly Work-installation kan slå på den för sina medlemmar.

**Efter att du exporterat.** När filen är klar läser Lolly tillbaka den och jämför den med det du valde: format, pixel- eller sidstorlek, klipplängd, en transparent bakgrund, CMYK-färg, HDR, Content Credentials och ett PDF- eller ZIP-lösenord. Allt som skiljer sig skrivs på exportkortet. Varje mätning kommer från filen, aldrig från inställningen, och en egenskap som filen inte kan svara på räknas inte som en matchning. Kommandoraden skriver hela jämförelsen med `--export-report` (se [Rendera med CLI](/info/cli-rendering.html)).

Designinspektörens kontroller och varumärkesjämförelsen i Design System Setup är separata kontroller: de tittar på designen, medan de här två korten tittar på filen.

::: details Kostnad från ett prisunderlag
Under preflight gör ett kostnadskort samma antal till pengar, med bara priser som någon tillhandahållit. Det läser de antalen även när själva preflight-kortet är av. Det behöver två saker: ett jobb som en prislista kan prissätta (plåtar, ark, yta, sidor, variantrader eller utdatafiler, så en vanlig logotyp-PNG visar det aldrig) och ett **rate card**, en JSON-prislista från ditt tryckeri. Ett standardbygge bär inget och har inget sätt att läsa in ett i appen. Ett rate card kommer som en katalogtillgång som en installation levererar, eller genom det valfria rate card-tillägget som en egen driftare eller ett kontrollplan slår på. Utan rate card visas ingenting.

Varje belopp är en taxa du tillhandahållit gånger en mängd Lolly räknat, som `4 plate × €35.00`, och totalen bär sin källa: utfärdaren på kortet och datumet dess taxor gäller från. Det finns ingen standardvaluta och inget platshållarpris. Det filen säger om sig själv förblir återgivet tal: *"The file says: … Lolly has not verified this."*

När ett belopp inte kan räknas ut dras tabellen tillbaka i stället för att fyllas i:

- Rader som kortet inte prissätter betyder **ingen total alls**, bara en rubrik som säger hur många som är oprissatta.
- En mängd som är ett tak för med sig **"up to"** vidare till sin delsumma.
- Taxor efter sitt giltighetsdatum visar **bara antal** tills du trycker *Use these rates anyway*; utgångsdatumet följer då med beloppet.
- Öppnat via en **länk** förblir pengar dolda tills du ber om dem på den här enheten. CLI tar `--rate-card=<file.json>` som en lokal fil och aldrig som en länkparameter.

Kortet tas bort från varje exportsteg, så det ändrar aldrig filen. Det är aritmetik, inte en offert; bara ditt tryckeri kan offerera.
:::

## Rörelse och ljud

### Video

Animerade verktyg exporterar **MP4** och **WebM**. Väljaren visar bara de containrar den här webbläsaren kan göra, och en delad `?format=`-länk som ber om en den inte kan göra faller tillbaka på den andra, med ett matchande filnamn. Animerade verktyg erbjuder också **Start after**, som håller ytan stilla en stund så att animationer och typsnitt hinner sätta sig före inspelning, och **Duration**, längden på det färdiga klippet. **Motion blur** (Off, Draft quality, Standard eller High, med en **Shutter angle**) gör snabb rörelse oskarp på bekostnad av renderingstid. Där webbläsaren stöder det spelar **Record live** in förhandsvisningen på skärmen i realtid genom en skärmdelning i stället.

![Tidsinställningarna för en animerad export: Start after, Duration, Motion blur med sin Shutter angle och Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** väljer Smaller file, Balanced eller Best quality. **Advanced** öppnar **Codec**, **Frame rate**, **Rate mode** och **Hardware acceleration**. Där ett verktyg har undertexter väljer **Captions** ett **Embedded track** eller en **Sidecar .vtt + .srt** bredvid videon. En länk bär kvalitet, kodek, bildfrekvens, varaktighet och startfördröjning som `vq`, `codec`, `fps`, `seconds` och `wait` ([URL-parametrar](/info/url-parameters.html)).

Videoexporter behåller sitt ljud. Ett verktyg kan lägga en **musikbädd** under klippet: en ljudtillgång som loopas eller trimmas till klipplängden, med tonar, volym och dämpning under materialets eget ljud. Inspelningsverktygen för sitt levande ljud vidare till filen.

En Design-presentation som förblir en klickpresentation kan ändå lämna som en video. **Export slides as video** i menyn Present öppnar exportbladet på MP4. Varje bild spelas under sin egen vistelsetid, eller exportbladets Duration när den saknar en, och presentationens bildövergång spelas mellan dem som en toning. Själva dokumentet ändras inte.

### Animerade bilder

**GIF** spelas överallt och passar chatt och e-post; den är större och har färre färger än video. **APNG** och **Animated WebP** behåller full färg och transparens. **Lottie Ad** exporterar också **Animated SVG**: vektorbildrutor med inbäddade CSS-nyckelbilder, så den skalar till vilken storlek som helst och loopar i en webbläsarflik eller en `<img>` utan kodek. Dess text konturas, och den använder en lägre standardbildfrekvens eftersom varje bildruta är tyngre än en bitmapp. Alla dessa är tysta.

### Ljud

Vissa verktyg exporterar ljud för sig. **Voice Recorder** fångar en mikrofontagning med en levande nivåmätare och sparar den som **MP3**, **WAV**, **M4A (AAC)** eller **Opus (WebM)**, kodad på din enhet. `wav`, `mp3`, `m4a` och `opus` är vanliga format-id:n, så en ljudexport är lika delbar och skriptbar som en PNG.

Tillgångsväljaren tar emot ett brett utbud av ljud för en musikbädd, från MP3 och FLAC till MIDI och trackermoduler; [Formats](/info/formats.html) listar dem. En [Rondocode-sång](/info/rondocode.html) spelas i den längd dess klipp ber om.

## Färg och HDR

Lolly läser varje modern CSS-färg, gör sin färgmatematik perceptuellt och skriver varje fil i ett rum som en läsare kan öppna: sRGB för skärmar, CMYK för tryck och Rec.2100 PQ för HDR. [Färg i motorn](/info/colour-engine.html) förklarar hur. Ett Design-dokument inställt på **Wide colour / HDR** följer sina egna regler, beskrivna i [Wide colour och HDR-redigering](/info/hdr-editing.html).

### Färgprofiler

Exporter taggas med en färgprofil, så att färghanterade program som tryckerier, Photoshop och webbläsare läser färgerna som du såg dem. Det sker automatiskt; miniatyrer och förhandsvisningar hoppar över taggen för att förbli små.

- **PNG och JPG** bär en inbäddad **sRGB** ICC-profil, rummet förhandsvisningen ritas i. Pixlarna taggas, kodas inte om.
- **Print PDF (CMYK)** deklarerar sitt tryckförhållande i sin *OutputIntent*, och talar om för ett tryckeri hur dess CMYK-färger är tänkta att läsas.
- **Print TIFF (CMYK)** skriver otaggade DeviceCMYK-pixlar och registrerar tryckförhållandet i sina TIFF-metadata. En TIFF kan inte bädda in en tryckprofil, så en **Embed**-rad registrerar bara den profilens namn.
- **TIFF (RGB)** är den okomprimerade sRGB-varianten för arkiv eller en tur och retur i en redigerare. Den plattar till transparens på vitt. Båda TIFF-varianterna är bara för datorn, eftersom webbläsare inte kan förhandsvisa en TIFF.
- **SVG**, **EMF**, **EPS** och **DXF** är vektorer utan inbäddad profil: SVG:s färger är sRGB, EMF och EPS använder enhets-RGB, **EPS (CMYK)** skriver DeviceCMYK och DXF använder AutoCAD Color Index. SVG, EPS och DXF konturar text till banor. EMF behåller text levande och redigerbar i Office och Google Slides, och faller bara tillbaka på konturer för textavsnitt formatet inte kan uttrycka; exportpanelens alternativ **Outline fonts** tvingar banor överallt. SVG återger också CSS-rutskuggor, inåt och utåt.

::: details PDF/X-4 och din egen tryckprofil
Ingen CMYK-profil levereras med Lolly. Ett namngivet tryckförhållande skriver utdataavsikten utan att påstå PDF/X-4-överensstämmelse, eftersom PDF/X-4 vill ha profilen inbäddad.

Läs in en egen CMYK-profil och välj dess **Embed**-rad i kontrollen Colour profile. Den bäddas in som filens *DestOutputProfile*, och PDF:en påstår PDF/X-4 så länge resten av filen tillåter det. Tryckförhållandet den deklarerar läses av från den profilen: ett registrerat namn där profilen bevisar ett, eller `Custom` under profilens eget namn.

Tre saker håller tillbaka påståendet men behåller utdataavsikten: RGB-grafik som CMYK-passet inte kunde konvertera, krediteringstexten `prov` för korrekturmarginal (ritad i ett standardtypsnitt som inte bäddas in) och ett **Strong**-lösenord, eftersom PDF/X-4 förbjuder kryptering. Varje PDF bär också PDF/X-4-metadata: sidrutor, XMP, ett dokument-id och en sRGB-utdataavsikt med sin profil.
:::

### HDR (starka färger)

Det här är exportpanelens kort **HDR**, som ljusar upp vanlig grafik för HDR-skärmar. Att behålla HDR-original genom redigering är en annan funktion: [Wide colour och HDR-redigering](/info/hdr-editing.html).

En vanlig export är sRGB: en mättad varumärkesfärg är lika ljus som skärmens normala vitt. En HDR-skärm har marginal över det. Kortet **HDR** förstärker dina varumärkesfärger och vit text mot toppljusstyrka, medan mörka ytor förblir mörka och ger glöden sin kontrast.

![HDR-kortet i exportpanelen, påslaget, med rattarna White / Reach / Dark lift / Focus synliga under det](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Format.** PNG, JPG, AVIF och TIFF. WebP är 8 bitar utan fungerande HDR-avkodningsväg, och vektorer och PDF har ingen HDR-modell.
- **Av som standard**, eftersom det ändrar pixlarna. Kryssa i kortet, eller skicka `hdr=1` i en delningslänk.
- **Rattarna.** **White** (taket för toppljusstyrka, 400 till 2000 nits), **Reach** (hur långt ned bland tonerna glöden sprider sig), **Dark lift** (hur mycket de mörka ytorna ljusnar; `0` håller dem mörka) och **Focus** (hur mycket färgrikedom förstärkningen behåller). De färdas som ett värde: `hdr=1600-60-0-50` är White 1600, Reach 60, Dark lift 0 och Focus 50.
- **Vad som skrivs.** PNG får 16-bitars Rec.2100 PQ med en `cICP`-del. JPG är en ISO 21496-1 gain-map-JPEG: en vanlig SDR-bild plus en tillagd gain map. AVIF får en omskriven `colr`-ruta. TIFF får PQ-pixlar med en genererad ICC v4-profil som bär en `cicp`-tagg, och plattas till på svart, eftersom vitt är 10 000-nits-koden i PQ och skulle ge varje kant en gloria. Förstärkningen följer perceptuell (OKLab) ljushet och behåller nyansen, så ett varumärkesgrönt blir ljusare, inte mintigt.
- **Var glöden syns.** Färghanterade visare på en HDR-skärm: Preview, Quick Look och Safari på Apple-enheter, eller Chrome på en HDR-bildskärm. En SDR-skärm visar en normal bild.
- **Innan du levererar.** Många plattformar kodar om uppladdningar och tar bort HDR-signalen, vilket kan lämna bilden mörk eller urvattnad. Använd HDR där du styr destinationen, som din egen webbplats, en videovägg eller en presentation på en ljus panel.
- **Från terminalen.** `--hdr=1` med `--export=png` eller `--export=jpg` skriver samma PNG och gain-map-JPEG i [CLI](/info/cli.html), från samma motorkodare, utan någon webbläsare på vägen. AVIF och TIFF förblir webbexporter tills vidare.

## Vad som följer med din fil

En färdig fil kan bära flera poster vid sidan av bilden. Vissa färdas bredvid pixlarna och försvinner när filen sparas om eller rensas; två märken lever i själva pixlarna.

::: figure exporting-what-travels
Var varje post finns, om den är på som standard och vilken länkparameter som styr var och en.
:::

Exportpanelen viker **Licence**, **Source credits**, *Password protect*, **C2PA Credentials**, **Lolly Imprint** och **Durable credential** i en grupp **Content protection** som bara visar korten det valda formatet kan använda. Den öppnas av sig själv när en länk eller ett dokument redan deklarerar en licens, eller när en källa behöver ett beslut av dig. Kortet **Design system** står utanför gruppen, i sikte på varje export.

![Gruppen Content protection öppnad på en PNG-export, som visar bara de kort som gäller för den](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Proveniens och vattenstämpel

Där formatet har fälten bär exporter **proveniensmetadata**: programvaran, källan, verktygets namn och din profils kreditrad, skrivna i PNG iTXt, JPEG EXIF, PDF-info, SVG `<metadata>` eller en GIF-kommentar. Den registrerar bara upphovsuppgifter, och inget laddas upp. **Experimental**-verktyg stämplar också en synlig vattenstämpel, som läggs på av värden så att redigering av verktyget inte kan ta bort märket.

**Lolly Imprint** är en osynlig pixelvattenstämpel, **på som standard**. Credentialen och metadata färdas bredvid pixlarna och går förlorade vid en ny sparning, en skärmbild eller en metadatarensning. Imprint lever i pixlarna och överlever omkomprimering, så att en kopia ändå kan kännas igen som gjord i Lolly. Det är en antydan snarare än en kryptografisk garanti, och det bär inga personuppgifter. Den följer med i JPEG XL, PNG, JPG, WebP, AVIF, TIFF och BMP, och i rastren Lolly renderar in i en PDF eller PPTX, aldrig i en bild du bäddat in. Avmarkera **Lolly Imprint** eller skicka `imprint=0` för att lämna Imprint utanför. Hur AVIF klarar omkodning är ännu inte kalibrerat. [Verify](/verify) upptäcker den på din enhet; se [Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**Durable credential** skriver Lollys id i pixlarna med en neural modell på enheten i TrustMark-formatet, så att länken "made with Lolly" överlever en metadatarensning och en omkodning och kan läsas av TrustMark-medvetna verktyg. Den är **av som standard**, eftersom den kostar ett neuralt pass per export och en engångsnedladdning av modellen. Den täcker PNG, JPG, WebP, AVIF och TIFF; kryssa i den i panelen eller skicka `durable=1`. Dator- och mobilapparna döljer kortet, eftersom de saknar ursprung att hämta modellen från offline.

**Licence.** Välj hur andra får använda ditt arbete: *None (all rights reserved)* som standard, CC0 1.0, Public Domain Mark 1.0, eller en Creative Commons 4.0-licens (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). Licensnamnet och en länk till dess deed går in i filens licensmetadata (EXIF, XMP och RIFF där formatet har dem) och dess Content Credential. Valet sparas med dokumentet och färdas i en länk som `licence=`. Lolly skriver licensen du valde; det kontrollerar eller upprätthåller inte villkoren. Ett verktyg med ett eget licensfält, som Claim, behåller det fältet i stället.

### Designsystemsposten

En export registrerar designsystemet som gjorde filen: dess namn, den publicerade version det ritades från (när det inte är arbetsversionen) och den [färgvariant](/info/colourways.html) det ritades i. Varje annat temaval som ett designsystem deklarerar, som en täthet, registreras på samma sätt. Valet ljust eller mörkt utelämnas, eftersom bilden redan visar vilket som användes.

**Du ser posten innan något skrivs.** Kortet **Design system**, ikryssat som standard, visar de exakta orden filen kommer att bära, som *Records: Acme · Colourway: Beach*, och beskrivningen så som den kommer att lyda. Ett designsystems namn är vad dess ägare skrev, så kortet visar det som skrivet. Avmarkera kortet för att lämna posten utanför den exporten. Designs dokumentpanel listar samma ord under *Embedded in exports*.

**Beskrivningen anger färgvarianten bredvid verktyget.** Med kortet ikryssat blir *"Made with https://lolly.tools : Chart"* till *"Made with https://lolly.tools : Chart (Beach colourway)"*. Designsystemets eget namn stannar i posten, inte i beskrivningen. En beskrivning utan verktygsnamn, eller en som ett verktyg skriver från sina egna indata, lämnas som den är. Ett verktyg som ignorerar färgvarianter genom `tokenAxes` registrerar ingen, och PDF-korrekturkrediten (tryckmärket `prov`) följer samma regel.

**Varumärkesfärdigheter som vägledde en agent.** När en agent gjorde stycket och angav vilka [varumärkesfärdigheter](/info/brand-skills.html) den läste och följde, listar posten också varje färdighet med sin revision, som *Guided by: acme-brand 1.0*. Orden betyder att färdigheten vägledde arbetet. De är ingen kontroll: Lolly testar inte stycket mot en färdighet. Bara agentens eget uttalande lägger till listan, vilket i dag betyder argumentet `brandSkills` till `lolly_render` i [MCP-servern](/info/mcp.html), så ett stycke som gjorts i appen eller från en delningslänk bär ingen. Content Credential håller listan som `brandSkills`, ett JSON-värde med varje färdighets id, namn, revision och SHA-256-hash. XMP-paketet och SVG-metadata håller samma värde som `lolly:BrandSkills`, en PDF skriven från posten får ett nyckelord per färdighet och beskrivningen förblir som den var. En intern färdighet registreras med sitt id, namn, revision och hash, aldrig med sin text. Samma reglage utelämnar listan tillsammans med resten av posten: kortet **Design system**, `_madewith=0`, `--no-madewith` och `madeWith: false`. När MCP-servern ritar filen i en webbläsare (en PDF, en JPEG och de andra format dess webbläsarfria väg inte kan skriva) håller filens egna metadata ingen lista och bara ett Content Credential kan hålla en. Skicka `c2pa` för att behålla posten; utan en credential varnar renderingen för att varumärkesfärdigheterna inte registrerades.

**Att läsa tillbaka posten.** [Verify](/verify) listar posten som **Design system** i en fils credentialdetaljer och eventuella varumärkesfärdigheter som **Guided by**. *Recreate with these settings* öppnar verktyget igen i den registrerade versionen och färgvarianten. Länken öppnas med det registrerade designsystemet när den här enheten har ett med samma id och namn; annars öppnas den med ditt aktiva designsystem.

::: details Vad som skrivs var, och vilka körningar som utelämnar posten
| Var | Vad som skrivs |
|---|---|
| Content Credential | `designSystem` (id:t), `designSystemLabel`, `designVersion` och `themes` i påståendet `tools.lolly.export`, var och en ett vanligt textvärde; `themes` är en JSON-lista över valen |
| PNG, JPEG, WebP och JXL | De fyra värdena som `lolly:`-egenskaper i filens XMP-paket, i namnrymden `https://lolly.tools/ns/export/1.0/` |
| SVG | De `lolly:`-egenskaperna inuti blocket `<metadata>` |
| PDF | Nyckelord som *Design system: Acme* och *Colourway: Beach* |
| Varje format med ett beskrivningsfält | Beskrivningen, med färgvarianten bredvid verktyget |

Kortet visas bara när det finns något att registrera och formatet kan hålla posten. CSV, JSON, en kalenderfil och andra text- eller dataformat håller inga metadata, och EPS, EMF, DXF och BMP saknar fält för posten. HTML, Markdown och CSS håller posten bara i sitt Content Credential, så för dem visar kortet ingen beskrivningsrad och döljs medan **C2PA Credentials** är av. Ett fält som designsystemet inte ger hålls utanför filen.

En delningslänk stänger av posten med `_madewith=0` ([URL-parametrar](/info/url-parameters.html)); kommandoraden tar `--no-madewith`, `lolly_render` i [MCP-servern](/info/mcp.html) tar `madeWith: false`, och terminalappens exportpanel har en rad **Design system**. Kommandoraden skriver ut orden en färdig fil bär på standard error, för en verktygsrendering och för varje fil som `lolly run` exporterar från en sparad Design-session, och en MCP-rendering skriver ut dem bredvid filen, båda avlästa från filen. En PNG som kommandoraden ritar utan webbläsare bär inga filmetadata, så dess post färdas i credentialen ensam. Verktyg på enheten lägger inte till några metadata alls.

Körningar utan kort **Design system** utelämnar posten: en Batch-körning, en mapp exporterad från Projects och en 3D-samlingsexport, och i terminalappen en CSV-batch, en export av en Projects-mapp eller ett urval och vyn render-everything. Exportera en fil från verktyget för att registrera designsystemet.
:::

### Content Credentials (C2PA)

Exporter kan bära **Content Credentials**: ett signerat [C2PA](https://c2pa.org)-manifest som registrerar vad som gjorde filen, när och var, bundet till en hash av filens byte så att varje senare ändring går att upptäcka. Specifikationen publiceras av C2PA, och Lolly skriver standardmanifest som vilken C2PA-läsare som helst kan granska.

![Kortet C2PA Credentials, ikryssat, med credentialens livslängd bredvid kryssrutan](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **På som standard.** Kortet **C2PA Credentials** är förvalt för nästan varje verktyg. Avmarkera det för en export, eller skicka `c2pa=off` i en länk. Ett verktyg kan välja bort det i sitt manifest.
- **Format.** PDF (RGB och Print), PNG och APNG, JPG, GIF, SVG, TIFF (RGB och Print), WebP (stillbild och animerad), AVIF, MP4, WebM, ljudbehållarna MP3, WAV, M4A, OGG/Opus och FLAC, samt HTML, Markdown och CSS. En ZIP stämplar varje medlem som stöds, vilket är hur en Animated SVG får en. MP4, AVIF och M4A använder standardbindningen BMFF och MP3 sin ID3v2-mappning, så `c2patool` och andra läsare verifierar dem. WebM och OGG/Opus har ännu ingen standardmappning, så Lolly bär manifestet som en Matroska-bilaga och ett OpusTags-fält, som Lollys egen verifierare kontrollerar. ICO, EPS, EMF, DXF, BMP, PPTX, Office-formaten och de andra text- och dataformaten har ingen C2PA-behållare.
- **Vad den registrerar.** Verktyget och appen som gjorde filen, signeringstiden, skalet som exporterade den, [designsystemet och färgvarianten](#the-design-system-record) medan kortet **Design system** är ikryssat, och fingeravtryck av aktiva indata. Indatatext, profilbundna fält, inaktiva kontroller, webbläsarversioner och operativsystemsdetaljer utelämnas. Ditt namn och din e-post visas som upphovsperson bara när **Use my details to create** är på under Settings → Preferences → Your details. Källor som en export placerar färdas som ingredienser: [krediterade verk](#source-credits) som emoji, och [Rondocode-sånger](/info/rondocode.html#songs-in-the-credential) i en video- eller ljudexport.
- **Vad mottagare ser.** C2PA-verktyg som Adobe-appar, `c2patool` och contentcredentials.org/verify läser manifestet och visar påståendet. Lolly signerar med en nyckel gjord på din enhet, inte ett certifikat från en förtroendelista, så visare rapporterar en *unverified* credential: strukturen och manipuleringsskyddet är verkliga, signeraren är inte garanterad. För att ändra det registrerar du en **verified identity** under Settings → Preferences → Content Credentials; se [Content Credentials Identity](/info/content-credentials-identity.html).
- **Att kontrollera en fil.** Släpp vilken fil som helst på [Verify](/verify), eller kör `lolly validate <file>`, för en rapport på enheten som leder med om Lolly gjorde filen och om den har ändrats sedan dess. Verify tittar också bortom credentialen; se [What Verify checks](/info/what-verify-checks.html).
- **Integritet.** Signeringsnyckeln görs för exporten och lämnar aldrig din enhet, och påståendet håller bara det proveniensmetadata redan bär. Integritetsverktyg som omvandlar dina egna filer lägger inte till någon credential, och *Strip Hidden Data* tar bort ett C2PA-manifest som alla andra metadata. Verktyget Rondocode gör nytt ljud, så det signerar det det skriver ([Rondocode-sånger](/info/rondocode.html#files-from-the-rondocode-utility)).
- **Samspel.** En lösenordsskyddad PDF kan inte bära Content Credentials, på någon nivå. Credentialen läggs till sist, över de färdiga byten, efter DPI, EXIF, färgprofil, PDF/X-metadata och tryckmärken.

### Källkrediter

En export som placerar någon annans verk registrerar den källan i credentialen. En emoji ritad från den valda emojiuppsättningen är det vardagliga fallet: verket, dess upphovsperson, licensen, varifrån de exakta byten kom och vad som ändrades följer alla med filen. Text i ett verktyg vars mall är en SVG behåller systemets egen emoji, så inget krediteras där. Raden **Source credits** säger vad källorna ber om vid leveransen innan du laddar ner, och efter nedladdningen läser den tillbaka de levererade byten innan den säger att krediterna finns i filen. En licens som ber dig välja, som en omfärgad CC BY-SA-glyf du är på väg att dela, får ett kort med alternativen; nedladdningen blockeras aldrig. [Kreativa rättigheter och krediter](/info/creative-rights.html) har formuleringarna, de granskade licenserna och vad som förblir ditt.

## Lösenordsskydd

Två sorters lås, båda gjorda på din enhet. Exportpanelens kort *Password protect* styr båda.

![Kortet Password protect utfällt vid en PDF-export, med lösenordsfältet och de två låsnivåerna](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**Ett PDF-öppningslösenord** har två nivåer när du skriver ett lösenord:

- **Weak**: 40-bitars RC4, ett avskräckande medel snarare än skydd. Dess lösenord kan färdas i en delningslänk, i klartext. Bara RGB-`pdf`.
- **Strong**: AES-256 (PDF 2.0). Skrivs vid export och läggs aldrig i en länk. Det gäller också Print PDF och varje PDF inuti en batch-ZIP. En Print PDF låst med Strong behåller sin CMYK, sina märken och sin utdataavsikt men tappar PDF/X-4-påståendet.

**En låst ZIP** täcker en ZIP-export, en mappnedladdning från Projects eller en batch, med ett lösenord på två nivåer: **Weak** (ZipCrypto, ett avskräckande medel; det kan färdas i en `?password=`-länk) eller **Strong** (AES-256, skrivs vid export, aldrig i en länk). Lösenordet skyddar varje medlem, och varje PDF inuti låses också med AES-256 på egen hand, så den förblir låst efter att ZIP:en packats upp. Frågan visas när nedladdningen startar; ett tomt lösenord betyder inget lås.

**En lösenordsskyddad delningslänk** ber mottagaren om ett lösenord innan den öppnas. Hela länkens tillstånd krypteras med AES-256 under en nyckel härledd från lösenordet (PBKDF2), så bara chiffertext färdas och dekrypteringen sker i mottagarens webbläsare. Servern som levererar länken ser aldrig lösenordet eller designen. Slå på det i dialogen **Share**. En krypterad länk öppnas bara i Lolly, aldrig som en inbäddad bild. Se [URL-läge](/info/url-mode.html).

## På en telefon

Exportkontrollerna sitter bakom den flytande knappen **Export**, som öppnar bladet **Export**: samma format, storlek, kopiera, ladda ner och dela, anpassade för touch.

## Format-id:n för länkar och CLI

Det här är värdena för URL-parametern `format=` och CLI-flaggan `--export=` (se [URL-parametrar](/info/url-parameters.html) och [CLI](/info/cli.html)). Ett verktygs meny visar bara de format verktyget kan göra, så den är alltid kortare än den här listan.

| Sort | Id:n |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vektor | `svg` · `svgz` (gzippad SVG) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (skärfil) |
| Sida och dokument | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (Penpot-designfil) · `scorm` (kurspaket, en ZIP) |
| Rörelse | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| Ljud | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` |
| Text och data | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `css` · `scss` · `gpl` (GIMP-palett) |
| Paket och bundlar | `zip` · `rpm` och `tar.gz` (renderingen förseglad i ett Linux-paket) |

Några id:n kommer från ett verktygs egen exportkod: `ase` (Adobe Swatch Exchange, från Palette Lab) och `exr` och `hdr` (rastrer med högt dynamiskt omfång, från Darkroom). **Convert Font** skriver `ttf`, `otf` och `woff` från en typsnittsfil du tillhandahåller, så en bar länk har inget för den att rendera.
