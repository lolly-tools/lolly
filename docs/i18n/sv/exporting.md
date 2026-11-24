# Exportera en fil

Tryck på **Export**, den vänstra halvan av pillret **Export | Save**, välj ett format bredvid filnamnet och tryck på **Download**. Filen skapas på din enhet.

Filen innehåller det du ser på ytan. Formatmenyn listar bara det här verktyget kan skapa i den här webbläsaren.

De flesta jobb behöver ett av tre format:

| För | Välj | Eftersom |
|---|---|---|
| En skärm, ett meddelande eller en presentationsbild | **PNG** | Alla appar öppnar den, och den behåller en transparent bakgrund när verktyget erbjuder en |
| En färdig sida eller något som ska skrivas ut | **PDF** | En verklig sidstorlek som skrivs ut som den ser ut; **Print PDF**, där ett verktyg erbjuder det, är CMYK-versionen för en tryckpress |
| Grafik som måste förbli skarp i alla storlekar | **SVG** | Vektorformer |

::: check Kontrollera filen i den storlek den ska användas
Innan du skickar filen öppnar du den på skärmen den gjordes för eller skriver ut den i sin verkliga storlek.
:::

::: details Godkännanden och leverans med Lolly Work (valfritt)
En [organisation som kör Lolly Work](/info/organisation.html) kan välja vilka format och exportinställningar dess medlemmar ser. Där godkännande krävs ersätter **Request approval** **Download**. Följ policyn som din instans visar.

Lolly Work kan också leverera en fil till konfigurerade S3-, WebDAV- och HTTP-destinationer, med godkännandesteg, leveranskvitton och en granskningspost. Den leveransen skickar filen till organisationens tjänst. En vanlig nedladdning stannar på din enhet. Personliga Send-destinationer och organisationsleverans konfigureras separat.

Operatörer ställer in detta med [guiden för organisationsleverans](/info/work-delivery.html). För köade serverrenderingar och batchar, se [Batchar och automatisering med CLI](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

<!--i:eti-cpu-->
## Så fungerar export

Tre vägar ger en fil. De flesta verktyg **renderar ytan**. Text- och dataformat (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) **genereras från verktygets innehåll**. Integritetsverktyg som *Lolly Strip Hidden Data* **omvandlar filen du valde** på din enhet. Resultatet har ingen yta, vattenstämpel eller tillagda metadata.

![Tre exportvägar leder till en färdig fil: rendera ytan, generera text eller data från innehåll eller omvandla en vald fil på enheten.](/info/diagrams/concepts/three-export-paths.svg)

Ett verktygs upphovsperson väljer vilka åtgärder exportpanelen erbjuder. Standarduppsättningen är Copy, Download och Save.

- <!--i:download--> **Download** sparar filen. Om du inte hittar den efteråt, se [Hitta en fil du laddade ner](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> **Copy** lägger bilden i ditt urklipp. När en webbläsare inte kan kopiera bilder laddar Copy ner filen i stället och meddelar dig.
- <!--i:folder--> **Save** behåller den aktuella designen i Projects och laddar aldrig ner en fil. **Save as**, bredvid **Download**, frågar vart (se [Spara och fortsätta](/info/using.html#saving-continuing)).
- <!--i:link--> **Share** öppnar dialogen Share: en länk som återskapar designen, växlarna vid besök (helskärm, exportpanel, nedladdning eller kopiering vid öppning) och en valfri **Shortest link** som packar tillståndet i en kompakt token (se [URL-läge](/info/url-mode.html)).

**Send to**, ett kort i exportpanelen, skickar filen till en tjänst du har anslutit. Efter en överföring till Google Drive, Nextcloud, en S3-bucket, Dropbox eller OneDrive kan **Create a share link** skapa en länk där utan en andra uppladdning. Avsnittet **Share through your cloud** i dialogen Share skickar en `.lolly`-fil och skapar dess länk i ett steg. Länkpanelen visar vem som kan öppna länken, var filen finns och när länken löper ut. **Links you've shared**, i dialogen Share, låter dig sluta dela. Nextcloud-länkar kan ha ett lösenord och ett utgångsdatum. S3-länkar gäller i 1 till 7 dagar och kan inte stoppas i förtid. Lolly behåller ingen kopia av filen och ingen inloggningstoken på en server. [Integritet](/info/privacy.html#every-network-request-the-app-can-make) listar vad varje tjänst tar emot.

![Exportpanelen - format, storlek och åtgärderna Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

När en design bäddar in ett annat verktygs rendering, till exempel en bildruta i Lolly Design med en QR Code-länk, ritar den överordnade exporten den nästlade renderingen. Den förblir vektor i SVG och PDF och rastreras i PNG, JPG och WebP. Den inbäddade renderingen får ingen egen vattenstämpel eller proveniens; bara den färdiga filen får det. HTML-, Markdown- och TXT-exporter kan inte innehålla en sammansatt rendering.

<!--i:eti-file-->
## Välj ett format

Filnamnet och formatmenyn sitter ihop som ett `name.format`-par under **Download**.

![Filnamnsfältet sammanfogat med formatväljaren, så att exporten visas som ett enda name.format-par](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Utgå från vart filen ska. Varje kort listar de format som passar destinationen.

::: figure exporting-format-chooser
Sex destinationer och de format som passar var och en.
:::

Ett ordmärke satt i ditt designsystems typsnitt exporteras som SVG med varje bokstav som en konturad bana. Filen förblir skarp i alla storlekar.

Text på ett annat språk beror på vilka typsnitt du har. När ett typsnitt i ditt designsystem har bokstäverna ritar SVG och PDF dem som konturer, formade och i läsordning, även rader från höger till vänster. När inget har dem använder Lolly ett [reservtypsnitt](/info/fallback-fonts.html), och exportkortet visar det typsnittet. Text som inget reservtypsnitt täcker förblir levande text i en SVG, ritad med visarens egna typsnitt. I en PDF, EPS eller WMF och i en EMF med **Outline fonts** på, blir den texten bilder. Orden ser ut som på sidan men går inte att markera eller söka. Exportkortet listar de skriftsystemen. Lägg till ett typsnitt med de bokstäverna för att behålla dem som vektortext.

![Ett hårfint ordmärke med stor teckenglesning som lyder Aurora, den sorts rena vektorgrafik som tabellens SVG-rad handlar om](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Alla format och vad de är till för
| Du vill ha | Använd | Varför |
|---|---|---|
| Skarpa logotyper eller grafik som kan skalas | **SVG** | Vektor: skalbar, liten och redigerbar; en effekt som vektorexporten inte kan rita bäddas in som en bild |
| Vektor för Office- och Windows-appar | **EMF** | Klistras in som redigerbar vektor i PowerPoint och Word, med levande text; Google Drive öppnar den i Google Drawings |
| Vektor för tryck och designappar | **EPS**, eller **EPS (CMYK)** | PostScript-vektor för Illustrator och tryckflöden |
| Vektor för skärmaskiner | **DXF** | Laserskärare, vinylplottrar och CNC: konturbanor i millimeter |
| En redigerbar presentation | **PowerPoint** (PPTX) | Inbyggd redigerbar text och inbyggda former, med bilder och vektorer som fortfarande går att extrahera |
| Ett redigerbart textdokument | **Word** (DOCX) eller **OpenDocument** (ODT) | Stycken och rubriker som en ordbehandlare kan fortsätta redigera (Lolly Doc Studio) |
| En layout för InDesign | **InDesign IDML (static subset)** | Text, rektanglar, ovaler och bilder, ett uppslag per rityta (Lolly Design) |
| Ett redigerbart Penpot-dokument | **Penpot** | Tavlor, former, text och länkade tokens |
| Ett foto eller en bild för allmänt bruk | **PNG** (förlustfri) eller **JPG** (mindre) | Universellt raster |
| Mindre moderna bilder | **WebP** eller **AVIF** | Bättre komprimering, med transparens |
| Tryck | **PDF**, eller **Print PDF** (CMYK) | Verklig sidstorlek; CMYK för en tryckpress |
| Tryckraster för en tryckpress | **Print TIFF** (CMYK) | DeviceCMYK-pixlar för en RIP |
| Animerat för webben | **GIF** | Spelas överallt; större filer |
| Animerat med full färg och verklig transparens | **APNG** | Animerad PNG: ingen palettgräns |
| Animerat, minsta filen | **Animated WebP** | Full färg och transparens, mindre än GIF eller APNG |
| Animerad vektor som kan skalas | **Animated SVG** | Självständig; loopar i en webbläsare eller en `<img>` i valfri storlek (Lottie Ad) |
| En animation som förblir redigerbar | **dotLottie** | Former, banor och yttre transformationsnycklar från Lolly Designs tidslinje |
| En överlämning till Premiere | **Premiere XML + media** | Tidsatta klipp och originalmedia för Premiere (Lolly Design) |
| Video för sociala medier och delning | **MP4** eller **WebM** | Bästa kvalitet för filstorleken (se [Video](#video)) |
| Undertexter | **SRT** eller **VTT** | Tidsatt text för en videospelare (Captions, Audiogram och Record) |
| Sändningsundertexter | **TTML** eller **SCC** | IMSC1.1-tidsatt text eller CEA-608-pop-on-undertexter (Captions; se [Sändningsundertexter](#broadcast-captions)) |
| En utbildningskurs | **SCORM (LMS)** | En versionshanterad webbplats eller ett SCORM- eller xAPI-paket (se [SCORM](#scorm-course-packages)) |
| Formaterad text eller en mejlsignatur | **HTML** | Klistras in med formatering i mejlklienter |
| En animation som spelas i en webbläsare | **HTML** | En spelare i en fil, från Lolly Designs tidslinje eller Snippet (se [Video](#video)) |
| Rent innehåll | **MD** eller **TXT** | Endast text |
| En kalenderhändelse | **ICS** | Importeras i valfri kalenderapp |
| Ett kontaktkort | **VCF** | Importeras i adressböcker |
| Strukturerade data för återimport | **JSON** eller **CSV** | Bevarar verktygets innehåll för återimport |
| En favicon | **ICO** | Webbplatsikon i flera storlekar; **ZIP** samlar flera format |
:::

### Transparens

Verktyg som stöder det har en växel för transparent bakgrund, till exempel **No BG**. PNG, WebP, AVIF, SVG, APNG och Animated WebP bevarar transparens, och GIF bevarar en skarp kant. JPG och PDF är alltid ogenomskinliga. TIFF plattar ut mot vitt, eller mot svart vid [HDR](#hdr-bright-colours).

<!--i:eti-crop-->
## Storlek och tryckenheter

Exporter använder verktygets ursprungliga pixelstorlek om verktyget inte erbjuder **mått**. Då ställer du in bredd, höjd och en **enhet**:

- **px** (standard) är exakta pixlar.
- **mm, cm, in, pt** och **pc** är fysiska storlekar. Med en fysisk enhet ställer du även in **DPI** (300 som standard). En **PDF** blir en verklig sida i den storleken. Ett **raster** får pixelantalet för det DPI-värdet och registrerar upplösningen. En **SVG** behåller den fysiska enheten med en viewBox i pixlar.

För ett raster med högre upplösning anger du en större bredd och höjd, eller väljer en fysisk enhet och höjer DPI (pixlar = storlek × DPI). Bredd `210`, höjd `297` och enheten `mm` ger en A4-sida.

![Måttraden inställd på 210 gånger 297 mm, med DPI-fältet synligt eftersom enheten är fysisk](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

<!--i:eti-images-->
## Stillbilder från en tidsatt komposition

Från en tidsatt komposition, till exempel en [Sequence](/info/sequence-editor.html)-tidslinje i Lolly Design, tar en stillbildsexport **bildrutan vid spelhuvudet**. Placera spelhuvudet där du vill ta bilden och exportera.

För fler än ett ögonblick använder du fältet **Frames** bredvid utdatastorleken. Det visas bara för en tidsatt komposition och ett stillbildsformat (PNG, JPG, WebP, SVG eller PDF). `1` ger bildrutan vid spelhuvudet. Ett högre tal ger så många stillbilder, jämnt fördelade över sekvensen:

- PNG, JPG, WebP och SVG kommer som en ZIP: `<name>-01.png`, `-02.png` och så vidare.
- PDF kommer som ett dokument med så många sidor.

Varje stillbild tas från mitten av sin del av tidslinjen, så den första är aldrig en halvintonad entré och den sista aldrig det tomma ögonblicket efter att klippen slutar.

::: figure exporting-contact-sheet
Frames: 4 delar sekvensen i fyra lika stora delar och tar mitten av varje.
:::

Använd Frames för ett bildmanus, en kontaktkarta för granskning eller en karusell för sociala medier tagen från en videoredigering. Antalet är begränsat till 64. Allt annat som skrivs i fältet återgår till `1`. Varje bildruta är en vanlig stillbild, så innehållsintyg, Imprint, fysiska enheter och DPI fungerar som för en enskild export. En exportlänk, CLI och MCP begär samma karta med `cuts=` (se [Kontaktkartor](/info/url-export.html#contact-sheets)).

<!--i:eti-copy-->
## Många filer samtidigt

Lolly har tre sätt att arbeta med stora mängder:

::: cols
## En tabell blir ett dokument
Ett verktyg byggt för att sidindela tabellindata gör varje rad till en sida. Klistra in en tabell från ditt kalkylblad för att få en PDF. För att rätta rader redigerar du kalkylbladet och klistrar in igen. Battlecards är referensverktyget. Det finns i mappen `community` med öppen källkod och listas inte på lolly.tools.
## En CSV blir en fil per rad
**Batch** (`#/batch`) tar en CSV och renderar en export för varje rad, till exempel namnbrickor eller intyg, som levereras i en ZIP. Se [Lolly Batch](/info/batch.html#make-many-versions-of-one-design).
## Flera designer får en ändring
**Lolly Multi-edit** öppnar flera sparade sessioner sida vid sida för att göra samma ändring i var och en. Se [Lolly Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Ett verktyg med flera sidor, till exempel Booklet, Print Sheet, Lolly Doc Studio eller Lolly Markdown Slides, exporterar PNG, JPG, WebP, SVG och de andra formaten för enstaka bilder som en fil per sida, i en ZIP när det finns flera. Print Sheet behåller hela arket och skärmärkena med valt DPI.

Från **Projects** exporterar **Render folder** varje sparad session i en mapp och dess undermappar som en ZIP med samma mappstruktur. **Render selection** gör samma sak för en flermarkering. En sparad session renderas till en egen fil. Projects kan också dela en sparad session igen som en verktygslänk som öppnar sessionen med samma inställningar.

<!--i:eti-pen-->
## Filer som förblir redigerbara i andra appar

Vissa format lämnar över ditt arbete till en annan app som redigerbart innehåll i stället för en bild.

### PowerPoint (PPTX)

Lolly Design, Lolly Markdown Slides, Booklet, Lolly Doc Studio, Lolly Chart, Diagrams, Flow Chart och Agenda exporterar en PowerPoint-presentation, en presentationsbild per sida. Varje sida delas upp i inbyggda objekt som en kollega kan redigera och extrahera:

- <!--i:font--> **Text** blir redigerbara textrutor i PowerPoint med layoutens teckenstorlek, färg, vikt, kursivering och justering. En Lolly Design-presentation anger varumärkets typsnitt för varje textsegment, även utan en bildbakgrund.
- <!--i:pentool--> **Vektorer** som logotyper och ikoner bäddas in som SVG-bilder, och PowerPoint kan använda *Convert to Shape* på dem.
- <!--i:photos--> **Bilder** följer med som separata bilder i ursprunglig upplösning. En beskuren huvudbild behåller hela bilden bakom beskärningen. Alla filter eller blandningseffekter på en bild bakas in.
- <!--i:layers--> **Bakgrunder, kantlinjer och linjer** blir rektangel- och linjeformer. Cirklar, ellipser och piller från Lolly Design förblir inbyggda, redigerbara former.

![Exportpanelen med PowerPoint valt: en presentationsbild per sida, med text och former som förblir redigerbara](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Layouten är ungefärlig. Allt som renderingsgenomgången inte kan uttrycka som inbyggda objekt, till exempel ett komplext filtrerat eller maskerat område, bäddas in som en bild. En presentation har en bildstorlek, hämtad från den första sidan.

PowerPoint är också en väg in: [Byt varumärke på en presentation](/info/rebrand.html) flyttar en presentation till ditt designsystem, och [Importera en design](/info/design-import.html) öppnar en i Lolly Design.

### Penpot

De flesta verktyg som exporterar SVG exporterar också en **Penpot-fil** (`.penpot`).

| Det du skapade | I Penpot |
|---|---|
| Text | Redigerbara textobjekt |
| Former, banor, övertoningar och bilder | Redigerbara vektorformer |
| En färg eller ett typsnitt från en designsystemtoken | En levande tokenlänk: redigera tokenen så följer varje form som ärver den med |
| Hela designen | En återanvändbar komponent i panelen Assets |
| En komplex illustration eller levande yta | En inbäddad bild; innehållet runt den förblir redigerbart |

Från Lolly Design blir varje ram en Penpot-tavla. Designsystemets färger och typografier hamnar i panelen Assets och hela dess tokenuppsättning i panelen Tokens. Penpot behåller en egen kopia. En token som redigerats i Penpot kommer tillbaka genom importen i [Lolly Design System Setup](/info/brand-studio.html).

![Exportpanelen med Penpot valt: .penpot-filen och Send to Penpot bredvid nedladdningen](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

För att öppna filen startar du Penpot, väljer ett projekt och väljer **Import**. Om du loggar in på Penpot från exportpanelen importerar **Send to Penpot** filen åt dig.

### Word, OpenDocument och InDesign

**Lolly Doc Studio** exporterar **Word** (DOCX) och **OpenDocument** (ODT) med redigerbara stycken och rubriker. Word-filen ställer in varumärkets typsnitt och textfärg via dokumentets formatmallar, följer sidstorleken du väljer och lägger till en PNG bredvid en SVG-logotyp för appar som inte kan rita SVG.

**Lolly Design** exporterar **InDesign IDML (static subset)**: text, rektanglar, ovaler och PNG- eller JPEG-bilder, ett uppslag per rityta. Den teckenformatering som stöds förblir redigerbar, bilder följer med i `Links` och koordinater blir InDesign-punkter. Omlänkning, typsnittsersättning och ändrad radbrytning kan behöva ses över. Effekter, animation, sammansatta textflöden och geometri som inte stöds stoppar exporten med en rapport som listar dem. IDML bevarar inte originaldokumentet. Skicka PDF för färdig grafik.

### Tidslinjer: dotLottie och Premiere

Från Lolly Designs tidslinje skriver **dotLottie** en animation som förblir redigerbar i Lottie-verktyg; [Lottie-animationer](/info/sequence-editor.html#lottie-animations) listar vad den behåller. **Premiere XML + media** paketerar tidsatta klipp och deras originalmedia för Premiere; se [Premiere XML-utbyte](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (kurspaket)

Kursexport är avstängd tills du slår på **Training and courses** under Settings → Preferences → Feature flags.

Välj sedan **Export course** från ett verktyg som stöds, en projektmapp eller en markering. I Lolly Design öppnar **SCORM (LMS)** och **Download** samma kursflöde. Lolly sparar arbetet, visar kursens innehåll och ordning för granskning och öppnar sedan modulen och dess exportdialog.

- <!--i:layers--> Välj en återgivning för varje källa: stillbildssidor, rörelse som video, ljud eller en nedladdningsbar resurs. Lägg till lektionstext och läsalternativ i modulen.
- <!--i:clock--> Förhandsvisa deltagarens spelare och granska beskrivningar och undertexter. Rörelse, inklusive tyst animation, ingår som video.
- <!--i:document--> Välj Website, SCORM 1.2, SCORM 2004 4th Edition eller ett experimentellt xAPI-mål. Kontrollera innehållet och ZIP-storleken, spara sedan och ladda ner den kontrollerade versionen.
- <!--i:check--> För att slutföra måste deltagaren bekräfta varje obligatorisk lektion och välja Finish.

![Exportpanelen i en Lolly Design-presentation med SCORM (LMS) valt](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Paketet innehåller sitt färdiga innehåll och behöver inget Lolly-konto. Lägg en Website-ZIP på en HTTP(S)-värd; importera en LMS-ZIP oförändrad. Testa destinationen innan du delar kursen. För en kurs byggd av flera sparade alster, se [Skapa en utbildningskurs](/info/training-creators.html).

### Sändningsundertexter

Verktyget Captions kan också exportera **TTML** och **SCC**. Båda skrivs från samma textremslista som SRT- och VTT-filerna, så orden och tiderna stämmer överens.

- **TTML** är IMSC1.1 Text Profile, med klocktider i mediets tidsbas och ett område längst ner i mitten. Det innehåller ingen färg, inget typsnitt och ingen position per undertext, eftersom Lollys undertexter bara innehåller en start, ett slut och text.
- **SCC** innehåller CEA-608-pop-on-undertexter på kanal 1 med 29,97 bildrutor per sekund och drop-frame-tidskod. Det stöder de grundläggande nordamerikanska tecknen samt specialtecken och utökade tecken. Om en undertext har ett tecken som inte finns i uppsättningen stoppas exporten och anger vilket tecken. Varje undertext radbryts till 32 kolumner och högst 15 rader. En undertext som inte hinner laddas före sin starttid fördröjs några bildrutor.
- Roll-up- och paint-on-undertexter skrivs inte.

::: note SCC har inte kontrollerats i ett sändningsverktyg
Det har heller inte provats på en hårdvaruavkodare. Testa en fil i ditt eget arbetsflöde före leverans.
:::

### DXF (skärfiler)

Lolly Asset Export, Diagrams, Growth, Lolly Logo Wall, QR Code, Street Map, Wayfinding och Wordmark exporterar **DXF**, utbytesformatet AutoCAD R12 som laserskärare, vinylplottrar och CNC-program läser. Geometri skrivs som konturbanor i millimeter och text omvandlas till konturer. Färg mappas till närmaste AutoCAD Color Index, som vanligtvis styr skärmaskinens funktion. DXF är enbart linjegrafik: ett fotografiskt eller filtrerat område har ingen skärbana och tas bort med en varning. Använd SVG eller PDF för att behålla rasterinnehåll. Text som inget typsnitt täcker, inte ens ett [reservtypsnitt](/info/fallback-fonts.html), stoppar exporten med ett meddelande som citerar texten.

En Street Map-design består helt av linjer, så varje väg och kanal blir en skärbana.

::: showcase
![En Street Map-rendering av Paris i bläck på gräddvitt - ren linjegrafik, så varje linje klarar vägen till en skärmaskin](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Rulla så drar sig kameran tillbaka genom geometrin: sju banor och inga pixlar. En skärmaskin läser samma fil.
:::

<!--i:eti-stamp-->
## Tryck

**Print PDF** skriver CMYK för ett namngivet tryckvillkor, **Coated FOGRA39** som standard. Varumärkets färgrutor med uppmätta tryckfärgsvärden behåller värdena. Andra färger konverteras genom en tryckprofil: Lollys egen Coated FOGRA39-profil som standard, eller din egen profil när du väljer dess **Embed**-rad. Grått och svart ligger enbart på den svarta plåten, så att liten text inte kan få misspassning. FOGRA51, SWOP och GRACoL använder en standardkonvertering för enheten. Svart text övertrycker också färgen under den, så att en något feljusterad press inte lämnar någon vit kant runt bokstäverna. **Print TIFF** skriver DeviceCMYK-pixlar för en RIP. Kontrollen Colour profile styr båda ([Färgprofiler](#colour-profiles)). Print TIFF och **EPS (CMYK)** separerar färger genom samma tryckprofil som Print PDF.

**Print marks & bleed** har ett eget kort för tryckformaten: utfall i millimeter samt Crop, Registration, Bleed, Colour bars och Stamp details. Stamp details skriver datumet, verktyget och ditt namn i marginalen. Ett namn eller verktygsnamn med tecken som marginaltypsnittet saknar, till exempel arabiska, kinesiska, kyrilliska eller en emoji, ritas som en bild i samma grå färg. Exportkortet listar de skriftsystemen.

Vissa verktyg, till exempel *Booklet*, bygger en **flersidig PDF**: ett omslag, innehåll som flödar över så många sidor det behöver och en baksida. Varje sida är en riktig stående PDF-sida i A4, US Letter eller A5. Du kan tvinga valfritt block till en ny sida. Det här är RGB-dokument utan skär- eller utfallsmärken; de märkena hör till den ensidiga Print PDF. En Lolly Design-PDF kan också vara en **Notes handout**: en stående sida för varje presentationsbild med talaranteckningarna under.

**Innan du exporterar.** Ett **Before you export**-kort längst ner i panelen visar vad ett tryckeri kommer att se: format, storlek och utfall, skär- och utfallsområden, färgtäckning, antal plåtar och sidantal, med ett omdöme bredvid rubriken. Kortet blockerar aldrig en export. Lolly Design visar alltid kortet med sina egna kontroller, däribland designsystemets organisationsregler lager för lager och skrivindikatorn för dokumentets text ([Innan du exporterar](/info/design.html#before-you-export)). Lolly Design lägger till dessa tryckkontroller när **Print preflight** är på. I andra verktyg slår du på **Print preflight** under Settings → Preferences → Feature flags. Det är av som standard, och en Lolly Work-installation kan slå på det för sina medlemmar.

**Efter att du exporterat.** Lolly läser tillbaka den färdiga filen och jämför den med det du valde: format, pixel- eller sidstorlek, klipplängd, transparent bakgrund, CMYK-färg, HDR, Content Credentials och ett PDF- eller ZIP-lösenord. Allt som skiljer sig skrivs på exportkortet. Varje mätning kommer från filen, aldrig från inställningen. En egenskap som filen inte kan ge svar på räknas inte som en matchning. Kommandoraden skriver hela jämförelsen med `--export-report` (se [Rendera med CLI](/info/cli-rendering.html)).

::: details Tillgänglighetskontroller för PDF från kommandoraden
**Tillgänglighetskontroller för PDF.** För en PDF listar kommandoraden också 32 tillgänglighetskontroller i filen `--export-report`, under `pdfAccessibility`. Varje kontroll har ett id, en enkel beskrivning, ett utfall och var i filen den hittade ett problem:

- **Passed**: kontrollen granskade något och hittade inget fel.
- **Failed**: kontrollen hittade ett problem. Dess sidnummer eller taggar listas.
- **Not applicable**: filen hade inget av det slaget att granska, till exempel tabellkontroller i en fil utan tabeller. Det säger inget om filen.
- **Needs a person**: sex kontroller kan inte bedömas av ett program (läsordning, färgkontrast, blinkningar, skript, tidsgränser och upprepade länkar).

Listan är inget omdöme. Den säger inte att en PDF uppfyller PDF/UA eller att personer som använder hjälpmedel kan använda PDF-filen. En person behöver fortfarande kontrollera filen med en skärmläsare. Lollys egna PDF-filer klarar i dag inte taggningskontrollerna, eftersom exportörerna ännu inte skriver några taggar. Kontrollen läser filen på din enhet och ändrar inget. Filer som behöver ett lösenord anges som okontrollerade, inte godkända. För att kontrollera en PDF som du har fått släpper du den i [Lolly Strip Hidden Data](/info/utilities.html), som visar samma lista under **PDF accessibility checks**.
:::

Kontrollerna i Lolly Designs Inspector och varumärkesjämförelsen i Lolly Design System Setup granskar designen. Dessa två kort granskar filen.

::: details Kostnad från en prislista
Under förkontrollen omvandlar ett kostnadskort samma antal till pengar, även när förkontrollkortet är avstängt. Det behöver två saker: ett jobb som en prislista kan prissätta (plåtar, ark, yta, sidor, variantrader eller utdatafiler, så en enkel logotyp-PNG visar aldrig kortet) och en **prislista**, en JSON-prislista från ditt tryckeri. Ett standardbygge innehåller ingen prislista och har inget sätt att ladda en i appen. En prislista kommer som en katalogtillgång som en installation levererar, eller genom det valfria prislistetillägget som den som driftar själv eller ett kontrollplan aktiverar. Utan prislista visas inget.

Varje belopp är ett pris du har angett gånger en mängd som Lolly har räknat, till exempel `4 plate × €35.00`. Summan visar sin källa: utfärdaren på prislistan och datumet för priserna. Det finns ingen standardvaluta och inget platshållarpris. Det filen säger om sig själv återges som ett påstående från filen: *”Filen säger: … Lolly har inte verifierat detta.”*

När ett belopp inte kan räknas ut döljs tabellen i stället för att fyllas i:

- Rader som prislistan inte prissätter innebär **ingen totalsumma alls**, bara en rubrik som anger hur många som saknar pris.
- En mängd som är en övre gräns får med **”upp till”** i sin delsumma.
- Priser vars giltighetsdatum har passerat visar **bara antal** tills du trycker på *Use these rates anyway*; utgångsdatumet står sedan kvar vid beloppet.
- Vid öppning via en **länk** förblir beloppen dolda tills du ber om dem på den här enheten. CLI tar `--rate-card=<file.json>` som en lokal fil och aldrig som en länkparameter.

Kortet tas bort från varje exportsteg och ändrar aldrig filen. Det är en beräkning, inte en offert. Bara ditt tryckeri kan lämna en offert.
:::

<!--i:eti-film-->
## Rörelse och ljud

### Video

Animerade verktyg exporterar **MP4** och **WebM**. En delad `?format=`-länk som begär ett behållarformat den här webbläsaren inte kan skapa använder det andra i stället, med ett matchande filnamn. **Start after** håller ytan stilla så att animationer och typsnitt hinner stabiliseras före inspelningen. **Duration** anger det färdiga klippets längd. **Motion blur** (Off, Draft quality, Standard eller High, med en **Shutter angle**) gör snabba rörelser oskarpa och renderingen långsammare. Där webbläsaren stöder det spelar **Record live** in förhandsvisningen på skärmen i realtid via skärmdelning.

![Tidsinställningarna för en animerad export: Start after, Duration, Motion blur med dess Shutter angle och Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** väljer Smaller file, Balanced eller Best quality. **Advanced** öppnar **Codec**, **Frame rate**, **Rate mode** och **Hardware acceleration**. Där ett verktyg har undertexter väljer **Captions** ett **Embedded track** eller en **Sidecar .vtt + .srt** bredvid videon. En länk innehåller kvalitet, kodek, bildfrekvens, längd och startfördröjning som `vq`, `codec`, `fps`, `seconds` och `wait` ([URL-parametrar](/info/url-parameters.html)).

Videoexporter behåller sitt ljud. Ett verktyg kan lägga en **musikbädd** under klippet: en ljudtillgång som loopas eller trimmas till klippets längd, med toningar, volym och duckning under filmens eget ljud. Inspelningsverktygen tar med sitt liveljud i filen.

En klickstyrd Lolly Design-presentation kan också exporteras som video. **Export slides as video** i menyn Present öppnar exportpanelen med MP4. Varje presentationsbild spelas under sin egen visningstid, eller under exportpanelens Duration när den saknar en egen. Presentationens bildövergång spelas mellan bilderna som en övertoning. Dokumentet ändras inte.

**HTML** från ett tidsatt Lolly Design-dokument, eller från Snippet, är en spelare i en fil: kontroller för uppspelning, spolning och ljud ovanpå animationen, med de typsnitt som stöds samt bilder och ljud inbäddade. Filen spelas offline. En Lolly Design-film med scener lägger till en meny med sina scener. En sekvens som innehåller ett video-, Lottie- eller 3D-klipp kan ännu inte exporteras som HTML; exportera sekvensen som video.

### Animerade bilder

**GIF** spelas överallt och passar chatt och mejl; det är större och har färre färger än video. **APNG** och **Animated WebP** behåller full färg och transparens. **Lottie Ad** exporterar också **Animated SVG**: vektorbildrutor med inbäddade CSS-nyckelrutor som skalas till valfri storlek och loopar i en webbläsarflik eller en `<img>` utan kodek. Texten omvandlas till konturer. Formatet använder en lägre bildfrekvens som standard eftersom varje bildruta är tyngre än en bitmapp. Alla dessa är ljudlösa.

### Ljud

Vissa verktyg exporterar ljud separat. **Lolly Voice Recorder** spelar in en mikrofontagning med en nivåmätare i realtid och sparar den som **MP3**, **WAV**, **M4A (AAC)** eller **Opus (WebM)**, kodad på din enhet. `wav`, `mp3`, `m4a` och `opus` är vanliga format-id:n, så en ljudexport kan delas och skriptstyras precis som en PNG.

Tillgångsväljaren accepterar många ljudformat för en musikbädd, från MP3 och FLAC till MIDI och trackermoduler; [Format](/info/formats.html) listar dem. En [Lolly Rondocode-låt](/info/rondocode.html) spelas under den längd som klippet begär.

<!--i:eti-palette-->
## Färg och HDR

Lolly läser varje modern CSS-färg, gör sina färgberäkningar perceptuellt och skriver varje fil i en färgrymd som en läsare kan öppna: sRGB för skärmar, CMYK för tryck och Rec.2100 PQ för HDR ([Färg i motorn](/info/colour-engine.html)). Ett Lolly Design-dokument inställt på **Wide colour / HDR** följer sina egna regler: se [Redigering med bred färgrymd och HDR](/info/hdr-editing.html).

### Färgprofiler

Exporter taggas med en färgprofil, så färghanterade appar som tryckeriernas program, Photoshop och webbläsare läser färgerna som du såg dem. Miniatyrbilder och förhandsvisningar hoppar över taggen för att hålla sig små.

- **PNG och JPG** innehåller en inbäddad **sRGB**-ICC-profil, färgrymden som förhandsvisningen ritas i. Pixlarna taggas, de kodas inte om.
- **Print PDF (CMYK)** anger sitt tryckvillkor i sin *OutputIntent*, som talar om för tryckeriet hur dess CMYK-tryckfärger ska läsas.
- **Print TIFF (CMYK)** skriver otaggade DeviceCMYK-pixlar och registrerar tryckvillkoret i sina TIFF-metadata. En TIFF kan inte bädda in en tryckprofil, så en **Embed**-rad registrerar bara profilens namn.
- **TIFF (RGB)** är den okomprimerade sRGB-versionen för arkivering eller redigering och återimport. Båda TIFF-formaten är bara för datorer, eftersom webbläsare inte kan förhandsvisa en TIFF.
- **SVG**, **EMF**, **EPS** och **DXF** är vektorer utan inbäddad profil: SVG:s färger är sRGB, EMF och EPS använder enhets-RGB, **EPS (CMYK)** skriver DeviceCMYK och DXF använder AutoCAD Color Index. SVG, EPS och DXF omvandlar text till konturbanor. EMF håller text levande och redigerbar i Office och Google Slides och konturerar bara de textsegment som formatet inte kan uttrycka. Exportpanelens alternativ **Outline fonts** tvingar fram banor överallt, som `_text=outline` i en länk och `--text=outline` på kommandoraden. SVG återger också CSS-rutskuggor, inuti och utanpå.

::: details PDF/X-4 och din egen tryckprofil
Lolly levereras med en CMYK-profil, anpassad till Fogras karakteriseringsdata för FOGRA39 och släppt under CC0, och konverterar färger genom den för standardtryckvillkoret. Profilen bäddas inte in, eftersom den är ICC-version 4.3 och PDF/X-4 accepterar versioner upp till 4.2. Ett namngivet tryckvillkor skriver därför utdatasyftet utan att hävda överensstämmelse med PDF/X-4.

Ladda en egen CMYK-profil och välj dess **Embed**-rad i kontrollen Colour profile. Den bäddas in som filens *DestOutputProfile*, och PDF-filen hävdar överensstämmelse med PDF/X-4 när resten av filen tillåter det. Tryckvillkoret den anger läses från profilen: ett registrerat namn där profilen styrker ett, eller `Custom` under profilens eget namn.

Tre saker förhindrar påståendet men behåller utdatasyftet: RGB-grafik som CMYK-genomgången inte kunde konvertera, erkännandetexten i korrekturmarginalen för `prov` (ritad med ett standardtypsnitt som inte är inbäddat) och ett **Strong**-lösenord, eftersom PDF/X-4 förbjuder kryptering. Varje PDF innehåller också PDF/X-4-metadata: sidrutor, XMP, ett dokument-id och ett sRGB-utdatasyfte med sin profil.
:::

### Dekorfärger som processfärger

Ett designsystem kan ge en färg en dekorfärg, till exempel en Pantone- eller HLC-färg. **Print PDF** trycker då den färgen på en egen plåt. Lolly Demo ger varje färg en dekorfärg utom sina vita färger, Sugar och Daylight, och sin svarta, Void. En Print PDF gjord i Lolly Demo trycker de flesta färger på dekorfärgsplåtar och svart på den svarta plåten.

För en vanlig fyrfärgsfil markerar du **Print spot inks as process** på exportpanelens Profile-kort. Varje dekorfärg trycks då med cyan, magenta, gult och svart, med den CMYK-blandning som designsystemet ger färgen. En färg utan egen blandning använder tryckprofilens konvertering, precis som alla andra färger i grafiken. Filen har då bara de fyra processfärgsplåtarna. Valet är av som standard. Panelen visar rutan bara för **Print PDF** och bara när designsystemet ger en färg en dekorfärg.

En efterbehandling är inte en tryckfärg. Foliering, prägling, nedsänkt prägling, partiell lack, soft touch, stansning, bigning och perforering behåller sina egna namngivna plåtar när rutan är markerad, eftersom en efterbehandling tryckt i processfärger skulle lägga sin svarta mask på sidan.

Kortet **Before you export** och `lolly preflight` räknar plåtarna som filen kommer att ha. När rutan är markerad räknar de de fyra processfärgsplåtarna och eventuella efterbehandlingsplåtar och anger att dekorfärgerna trycks som processfärger utan extra plåtar. När rutan är avmarkerad räknar de upp till en dekorfärgsplåt för varje dekorfärg som designsystemet anger. En prislista prissätter dessa antal, så den prissätter aldrig en dekorfärgsplåt som filen inte kommer att ha.

**Print TIFF** och **EPS (CMYK)** har inga namngivna plåtar, så de trycker varje tryckfärg som processfärg oavsett valet. För dessa två format räknar kortet och `lolly preflight` de fyra processfärgsplåtarna och aldrig någon dekorfärgs- eller efterbehandlingsplåt. En efterbehandling hamnar i dem som sin svarta mask på den svarta plåten, och kortet rapporterar det som ett fel.

En länk begär samma fil med `_spots=process`, kommandoraden med `--spots=process`, [MCP-servern](/info/mcp.html) med `spots: "process"` och terminalappen med sin rad **Spot inks**. Inget om valet skrivs in i filen: bara tryckfärgerna ändras.

### HDR (ljusstarka färger)

Exportpanelens **HDR**-kort gör vanlig grafik ljusstarkare för HDR-skärmar. För att bevara HDR-original genom redigeringen, se [Brett färgomfång och HDR-redigering](/info/hdr-editing.html).

En vanlig export är sRGB: en mättad varumärkesfärg är lika ljus som skärmens normala vitt. En HDR-skärm kan lysa starkare. **HDR**-kortet förstärker dina varumärkesfärger och vit text mot maximal ljusstyrka. Mörka områden förblir mörka.

![HDR-kortet i exportpanelen, påslaget, med reglagen White / Reach / Dark lift / Focus synliga under det](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Format.** PNG, JPG, AVIF och TIFF. WebP är 8-bitars utan fungerande HDR-avkodning, och vektorer och PDF saknar HDR-modell.
- **Av som standard**, eftersom det ändrar pixlarna. Markera kortet eller ange `hdr=1` i en delningslänk.
- **Reglagen.** **White** (taket för maximal ljusstyrka, 400 till 2000 nits), **Reach** (hur långt ned i tonerna skenet sprider sig), **Dark lift** (hur mycket de mörka tonerna ljusas upp; `0` håller dem mörka) och **Focus** (hur mycket färgrikedom förstärkningen behåller). De följer med som ett enda värde: `hdr=1600-60-0-50` är White 1600, Reach 60, Dark lift 0 och Focus 50.
- **Det som skrivs.** PNG får 16-bitars Rec.2100 PQ med ett `cICP`-block. JPG är en JPEG med förstärkningskarta enligt ISO 21496-1: en vanlig SDR-bild plus en tillagd förstärkningskarta. AVIF får en omskriven `colr`-box. TIFF får PQ-pixlar med en genererad ICC v4-profil som innehåller en `cicp`-tagg. TIFF plattas ut mot svart, eftersom vitt är koden för 10 000 nits i PQ och skulle ge en gloria runt varje kant. Förstärkningen följer perceptuell (OKLab) ljushet och behåller nyansen, så en grön varumärkesfärg blir ljusare utan att bli mintgrön.
- **Där skenet syns.** Färghanterade visare på en HDR-skärm: Preview, Quick Look och Safari på Apple-enheter eller Chrome på en HDR-skärm. En SDR-skärm visar en normal bild.
- **Från terminalen.** `--hdr=1` med `--export=png` eller `--export=jpg` skriver samma PNG och JPEG med förstärkningskarta i [CLI](/info/cli.html) med samma kodare i motorn, utan webbläsare. AVIF och TIFF finns än så länge bara som webbexporter.

::: warning Många plattformar tar bort HDR-signalen
En plattform som kodar om uppladdningar kan göra bilden mörk eller urblekt. Använd HDR där du styr destinationen, till exempel din egen webbplats, en videovägg eller en presentation på en ljusstark skärm.
:::

<!--i:eti-badge-check-->
## Det som följer med din fil

En färdig fil kan ha flera poster. Vissa ligger vid sidan av pixlarna och försvinner när filen sparas om, skärmdumpas eller rensas. Två märkningar finns i pixlarna.

::: figure exporting-what-travels
Var varje post finns, om den är på som standard och vilken länkparameter som styr den.
:::

Exportpanelen samlar **Licence**, **Source credits**, **Password**, **C2PA Credentials**, **Lolly Imprint** och **Durable credential** i en grupp, **Content protection**, som bara visar korten det valda formatet kan använda. Gruppen öppnas automatiskt när en länk eller ett dokument redan anger en licens eller när en källa kräver ett beslut från dig. Kortet **Design system** ligger kvar utanför gruppen och syns vid varje export.

![Gruppen Content protection öppnad vid en PNG-export, med bara de kort som gäller för den](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Proveniens & vattenstämpel

Där formatet har fälten innehåller exporter **proveniensmetadata**: programvaran, källan, verktygets namn och upphovsraden i din profil, skrivna i PNG iTXt, JPEG EXIF, PDF-info, SVG `<metadata>` eller en GIF-kommentar. De registrerar bara upphov. Inget laddas upp. **Experimental**-verktyg stämplar också en synlig vattenstämpel. Värden lägger på vattenstämpeln, så den går inte att ta bort genom att redigera verktyget.

**Lolly Imprint** är en osynlig pixelvattenstämpel, **på som standard**. Den överlever omkomprimering, så en kopia kan fortfarande kännas igen som gjord i Lolly. Den är en indikation, ingen kryptografisk garanti, och innehåller inga personuppgifter. Den skrivs i JPEG XL, PNG, JPG, WebP, AVIF, TIFF och BMP och i rasterbilderna som Lolly renderar in i en PDF eller PPTX, aldrig i en bild du har bäddat in. Avmarkera **Lolly Imprint** eller ange `imprint=0` för att utelämna Imprint. Hur väl den överlever omkodning i AVIF är ännu inte kalibrerat. [Lolly Verify](/#/verify) upptäcker Imprint på din enhet; se [Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**Durable credential** skriver Lollys id i pixlarna med en neural modell på enheten i TrustMark-formatet, så länken ”gjord med Lolly” överlever rensning av metadata och omkodning och kan läsas av verktyg som stöder TrustMark. Det är **av som standard**, eftersom det kräver en körning av den neurala modellen per export och en engångsnedladdning av modellen. Det omfattar PNG, JPG, WebP, AVIF och TIFF. Markera det i panelen eller ange `durable=1`. Dator- och mobilapparna döljer kortet, eftersom de saknar ett ursprung att hämta modellen från offline.

**Licence.** Välj hur andra får använda ditt arbete: *None (all rights reserved)* som standard, CC0 1.0, Public Domain Mark 1.0 eller en Creative Commons 4.0-licens (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). Licensnamnet och en länk till licenssammanfattningen skrivs i filens licensmetadata (EXIF, XMP och RIFF där formatet har dem) och dess Content Credential. Valet sparas med dokumentet och följer med i en länk som `licence=`. Lolly skriver den licens du valde. Lolly kontrollerar inte villkoren eller ser till att de följs. Ett verktyg med ett eget licensfält, till exempel Claim, behåller i stället det fältet.

### Posten om designsystemet

En export registrerar designsystemet som skapade filen: dess namn, den publicerade versionen som den ritades från (när det inte är arbetsversionen) och den [färgvariant](/info/colourways.html) den ritades i. Alla andra temaval som ett designsystem anger, till exempel täthet, registreras på samma sätt. Valet av ljust eller mörkt utelämnas, eftersom bilden redan visar vilket som användes.

**Du ser posten innan något skrivs.** Kortet **Design system**, som är markerat som standard, visar exakt den text som filen kommer att innehålla, till exempel *Records: Acme · Colourway: Beach*, samt beskrivningen. Ett designsystems namn är det som dess ägare skrev, och kortet visar namnet som det skrevs. Avmarkera kortet för att utelämna posten från den exporten. Dokumentpanelen i Lolly Design visar samma text under *Embedded in exports*.

**Beskrivningen anger färgvarianten bredvid verktyget.** När kortet är markerat blir *”Made with https://lolly.tools : Chart”* till *”Made with https://lolly.tools : Chart (Beach colourway)”*. Designsystemets eget namn ligger kvar i posten, inte i beskrivningen. En beskrivning utan verktygsnamn, eller en som ett verktyg skriver utifrån sina egna indata, ändras inte. Ett verktyg som ignorerar färgvarianter genom `tokenAxes` registrerar ingen, och upphovsraden i PDF-korrekturet (tryckmärket `prov`) följer samma regel.

::: details Varumärkesskills, varumärkessidor och partnerföretag i posten
**Varumärkesskills som vägledde en agent.** När en agent skapade arbetet och angav de [varumärkesskills](/info/brand-skills.html) den läste och följde listar posten också varje skill med dess revision, till exempel *Guided by: acme-brand 1.0*. Orden betyder att denna skill vägledde arbetet. Lolly testar inte arbetet mot en skill. Bara agentens egen uppgift lägger till listan. I dag är det argumentet `brandSkills` i [MCP-serverns](/info/mcp.html) `lolly_render`, så ett arbete som görs i appen eller från en delningslänk innehåller ingen. Content Credential innehåller listan som `brandSkills`, ett JSON-värde med varje skills id, namn, revision och SHA-256-hash. XMP-paketet och SVG-metadata innehåller samma värde som `lolly:BrandSkills`. En PDF som skrivs från posten får ett nyckelord per skill. Beskrivningen ändras inte. Texten i en intern skill registreras aldrig. Samma reglage utelämnar listan tillsammans med resten av posten: kortet **Design system**, `_madewith=0`, `--no-madewith` och `madeWith: false`. När MCP-servern ritar filen i en webbläsare (en PDF, en JPEG och de andra format som dess webbläsarfria väg inte kan skriva) innehåller filens egna metadata ingen lista. Där kan bara ett Content Credential innehålla listan. Ange `c2pa` för att behålla posten. Utan ett intyg varnar renderingen för att varumärkesskills inte registrerades.

**Varumärkessidan, när dess utgivare väljer det.** Ett designsystems utgivare kan välja att registrera adressen till sin [varumärkessida](/info/brand-page.html#lead-back-from-your-files) i exporter. Inställningen gäller per designsystem och är av som standard. Kortet lägger då till adressen på samma rad, till exempel *Records: Acme · Colourway: Beach · Brand page: https://acme.example/brand/acme/*. Om kortet avmarkeras tas adressen bort tillsammans med resten. Posten innehåller adressen och inget annat om sidan. Inget annat i filen ändras. Ett designsystem utan adress skriver samma fil som tidigare.

**Adressen följer inte med ett paket.** En post i en signerad fil uppfattas som undertecknarens egen. En adress får inte slå på sig själv för någon som inte valde den adressen, och ett paket får inte kunna peka andras filer till en sida det själv väljer. Ett `.lolly`-paket, en kopia eller förgrening av ett designsystem, **Try these colours**, en återställd säkerhetskopia och en tokenfil som används för en enda körning kommer alla med inställningen av. Du kan slå på inställningen själv, med en adress du skriver in. Ett hanterat designsystem är det enda undantaget: det behåller adressen som dess förvaltare angav i källans tokens. [Led tillbaka från dina filer](/info/brand-page.html#lead-back-from-your-files) beskriver detaljerna.

**Partnerföretaget, i ett partnerprogram i Lolly Work.** Ett arbete som görs för ett partnerföretag registrerar företaget och dess program på samma rad, till exempel *Records: Acme · Colourway: Beach · Partner: Northwind IT (Resellers, EMEA)*, med revisionen av företagets uppgifter i filen. Posten innehåller ingen person, inga kontaktuppgifter, ingen adress och ingen valuta. Med företagets partnerpaket bifogat lägger raden till paketets revision, till exempel *, kit revision 2*, och intyget innehåller paketets id och revision, aldrig dess färger eller regler. Om kortet avmarkeras tas partnern bort tillsammans med resten av posten. En PDF får nyckelordet *Partner: Northwind IT*, och [Lolly Verify](/info/what-verify-checks.html#partner) visar posten som **Partner** ([Partnerposten i filer](/info/manage/partner-programmes.html#the-partner-record-in-files)).
:::

**Läsa tillbaka posten.** [Lolly Verify](/#/verify) listar posten som **Design system** i en fils intygsdetaljer och eventuella varumärkesskills som **Guided by**. En varumärkessida visas separat som [undertecknarens registrering av en adress](/info/what-verify-checks.html#brand-page). *Recreate with these settings* öppnar verktyget igen i den registrerade versionen och färgvarianten. Länken öppnas med det registrerade designsystemet när enheten har ett med samma id och namn; annars öppnas den med ditt aktiva designsystem.

::: details Vad som skrivs var och vilka körningar som utelämnar posten
| Var | Det som skrivs |
|---|---|
| Content Credential | `designSystem` (id:t), `designSystemLabel`, `designVersion` och `themes` i utsagan `tools.lolly.export`, var och en som ett textvärde; `themes` är en JSON-lista över valen. `brandPage` när utgivaren har valt det |
| PNG, JPEG, WebP och JXL | Samma värden som `lolly:`-egenskaper i filens XMP-paket, i namnrymden `https://lolly.tools/ns/export/1.0/`. `lolly:BrandPage` när utgivaren har valt det |
| SVG | Samma `lolly:`-egenskaper i `<metadata>`-blocket |
| PDF | Nyckelord som *Design system: Acme*, *Colourway: Beach* och, när utgivaren har valt det, *Brand page: https://acme.example/brand/acme/* |
| Varje format med ett beskrivningsfält | Beskrivningen, med färgvarianten bredvid verktyget |

Kortet visas bara när det finns något att registrera och formatet kan innehålla posten. CSV, JSON, en kalenderfil och andra text- eller dataformat innehåller inga metadata, och EPS, EMF, DXF och BMP har inget fält för posten. HTML, Markdown och CSS innehåller posten bara i sitt Content Credential, så för dem visar kortet ingen beskrivningsrad och döljs när **C2PA Credentials** är av. Ett fält som designsystemet inte anger utelämnas ur filen.

En delningslänk slår av posten med `_madewith=0` ([URL-parametrar](/info/url-parameters.html)). Kommandoraden tar `--no-madewith`, [MCP-serverns](/info/mcp.html) `lolly_render` tar `madeWith: false` och terminalappens exportpanel har en rad **Design system**. Kommandoraden skriver texten som en färdig fil innehåller till standardfel, för en verktygsrendering och för varje fil som `lolly run` exporterar från en sparad Lolly Design-session. En MCP-rendering skriver texten bredvid filen. Båda läser tillbaka texten från filen. En PNG som kommandoraden ritar utan webbläsare innehåller inga filmetadata, så dess post följer bara med i intyget. Verktyg som körs på enheten lägger inte till några metadata.

Körningar utan kortet **Design system** utelämnar posten: en Lolly Batch-körning, en mapp som exporteras från Projects och en export av en 3D-samling, och i terminalappen en CSV-batch, en export av en Projects-mapp eller markering och vyn som renderar allt. Exportera en fil från verktyget för att registrera designsystemet.
:::

### Content Credentials (C2PA)

Exporter kan innehålla **Content Credentials**: ett signerat [C2PA](https://c2pa.org)-manifest som registrerar vad som skapade filen, när och var, bundet till en hash av filens byte så att varje senare ändring kan upptäckas. Lolly skriver standardmanifest som alla C2PA-läsare kan granska.

![Kortet C2PA Credentials, markerat, med intygets giltighetstid bredvid kryssrutan](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **På som standard.** Kortet **C2PA Credentials** är markerat för nästan varje verktyg. Avmarkera det för en export eller ange `c2pa=off` i en länk. Filen saknar då intyg, och en SVG som infogar grafik med intyg, till exempel en logotyp från katalogen, förlorar också grafikens intyg. Lolly Imprint och filens andra metadata finns kvar. Ett verktyg kan välja bort detta i sitt manifest.
- **Format.** PDF (RGB och Print), PNG och APNG, JPG, GIF, SVG och SVGZ, TIFF (RGB och Print), WebP (stillbild och animerad), AVIF, MP4, WebM, HTML, Markdown, CSS och ljudbehållarna MP3, WAV, M4A, OGG/Opus och FLAC. En ZIP stämplar varje fil som stöds, vilket är hur en Animated SVG får ett intyg. MP4, AVIF och M4A använder standardbindningen för BMFF och MP3 sin ID3v2-mappning, så `c2patool` och andra läsare verifierar dem. WebM och OGG/Opus har ännu ingen standardmappning, så Lolly lägger manifestet i en Matroska-bilaga och ett OpusTags-fält, som Lollys egen verifierare kontrollerar. En SVGZ är en komprimerad SVG. C2PA-specifikationen definierar ingen komprimerad form, så intyget skrivs in i SVG:n före komprimering. Lollys verifierare läser filen som den är; `c2patool` läser samma intyg när filen har packats upp (`gunzip`). ICO, EPS, EMF, DXF, BMP, PPTX, Office-formaten och de andra text- och dataformaten saknar C2PA-behållare.
- **Det som registreras.** Verktyget och appen som skapade filen, signeringstiden och skalet som exporterade filen. För en Lolly Design-sida som exporteras som bild, SVG eller PDF: renderaren som ritade sidan (`route` i utsagan `tools.lolly.export`: `gpu` för GPU-sidrenderaren, `operations` för ritoperationerna skrivna som vektorer, `compatibility` för webbläsarens egen renderare) och renderarens version (`renderer`: GPU-receptet, `design-draw-v` och dess version eller `dom-to-image` och `dom-walker`). [Designsystemet och färgvarianten](#the-design-system-record) när kortet **Design system** är markerat. De aktiva inställningarna: menyval, tal, växlar och färger som de är, och allt som skrivits in (titlar, namn, anteckningar, länkar och datum) bara som ett fingeravtryck, så att orden inte finns i filen. Profilbundna fält, inaktiva kontroller, webbläsarversioner och operativsystemsdetaljer utelämnas. Ditt namn och din e-postadress visas som upphovsperson bara när **Use my details to create** är på under Settings → Preferences → Your details. Källor som en export placerar följer med som beståndsdelar. Varje bild på sidan som har ett eget Content Credential registreras som en komponent i sidan, med det intyget och den eventuella AI-källtyp det anger. Det gäller i en PNG, JPEG, WebP, AVIF, TIFF, SVG eller PDF och i en GIF, APNG, animerad WebP, MP4 eller WebM när bilden ritas i minst en bildruta i det exporterade intervallet. Den enda bild som ett verktyg som Darkroom, Filter eller Asset Export ändrar registreras i stället som filens förälder, öppnad först och följd av vad verktyget gjorde med bilden. Andra beståndsdelar är [krediterade verk](#source-credits) som emoji, [Lolly Rondocode-låtar](/info/rondocode.html#songs-in-the-credential) i en video- eller ljudexport och [sparade melodier](/info/generated-music.html#what-a-track-records) i en video- eller ljudexport. Varje sparad melodi har sitt namn, licensen när melodin anger en, SHA-256 för sitt recept, motorversionen och algoritmiska medier. En sparad melodis skapare (profilnamnet den sparades med) läggs till bara när **Use my details to create** är på, precis som ditt eget namn. Först då visar exportpanelen skaparen innan du exporterar.
- **Ett godkännande, när ett registrerats.** En fil som godkänts genom [Lolly Work](/info/work-approvals.html#review-an-exported-file) kan innehålla en andra, signerad post över detta intyg: godkännandets id, beslutsdatumet och hashsumman för den granskade filen. Den innehåller inga namn, e-postadresser, grupper, kommentarer eller kedjenamn. Den är markerad som standard i begäransdialogen och kan avmarkeras för en begäran eller stängas av för en instans. Den registrerar att en undertecknare angav ett beslut. Den säger inte att arbetet uppfyller någon standard.
- **Vad den ombads göra, för en fil skapad från en [avsikt](/info/visual-intent.html#what-goes-in-the-file).** Syftet, ytan, verktyget, språket, regel- och vokabulärversionerna och avsiktens hashsumma. Tillfälle, målgrupp, region och prompt är bara fingeravtryck, om inte personen eller agenten som kör renderingen begär att promptens ord ska registreras. Bara en rendering som utgick från en avsikt innehåller denna post. Körningen anger vad den registrerade, och posten kan utelämnas.
- **Det mottagarna ser.** C2PA-verktyg som Adobe-appar, `c2patool` och contentcredentials.org/verify läser manifestet och visar utsagan. Lolly signerar med en nyckel skapad på din enhet, inte ett certifikat från en betrodd lista, så visare rapporterar ett *overifierat* intyg. Strukturen och skyddet som påvisar manipulering är giltiga, men ingen går i god för undertecknaren. För att ändra det registrerar du en **verifierad identitet** under Settings → Preferences → Content Credentials; se [Content Credentials-identitet](/info/content-credentials-identity.html).
- **Kontrollera en fil.** Släpp en fil på [Lolly Verify](/#/verify) eller kör `lolly validate <file>` för en rapport på enheten som börjar med om Lolly skapade filen och om den har ändrats sedan dess. Lolly Verify granskar också sådant utanför intyget; se [Det som Lolly Verify kontrollerar](/info/what-verify-checks.html).
- **Integritet.** Signeringsnyckeln skapas för exporten och lämnar aldrig din enhet. Utsagan innehåller bara det som proveniensmetadata redan innehåller. Integritetsverktyg som omvandlar dina egna filer lägger inte till något intyg, och *Lolly Strip Hidden Data* tar bort ett C2PA-manifest som alla andra metadata. Rondocode-verktyget skapar nytt ljud, så det signerar det som det skriver ([Lolly Rondocode-låtar](/info/rondocode.html#files-from-the-rondocode-utility)). Musikgeneratorn signerar varje WAV- eller M4A-nedladdning. Intyget registrerar att Lollys musikgenerator skapade spåret och musikens licens, CC BY 4.0, med dess upphovsangivelse ([Det som ett spår registrerar](/info/generated-music.html#what-a-track-records)).
- **Samspel.** En lösenordsskyddad PDF kan inte innehålla Content Credentials på någon av nivåerna. Intyget läggs till sist, över de färdiga byten, efter DPI, EXIF, färgprofil, PDF/X-metadata och tryckmärken.

### Källangivelser

En export som placerar någon annans verk registrerar den källan i intyget. Det vanligaste fallet är en emoji från den valda emojiuppsättningen: verket, dess skapare, licensen, var de exakta byten kom ifrån och vad som ändrats följer alla med filen. Text i ett verktyg vars mall är en SVG behåller systemets egna emoji, så där anges ingen upphovsperson. Innan du laddar ner anger raden **Source credits** vad källorna kräver av leveransen. Efter nedladdningen läser raden tillbaka de levererade byten innan den säger att källangivelserna finns i filen. En licens som kräver att du väljer, till exempel en omfärgad CC BY-SA-glyf som du ska dela, får ett kort med alternativen. Nedladdningen blockeras aldrig. [Kreativa rättigheter och upphovsangivelser](/info/creative-rights.html) innehåller formuleringarna, de granskade licenserna och det som förblir ditt.

<!--i:eti-lock-->
## Lösenordsskydd

Lolly skapar två slags lås, båda på din enhet. Exportpanelens **Password**-kort ställer in båda.

![Password-kortet utfällt vid en PDF-export, med lösenordsfältet och de två låsnivåerna](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**Ett lösenord för att öppna en PDF** har två nivåer när du har skrivit in ett lösenord:

- **Weak**: 40-bitars RC4, för RGB `pdf` utan tryckmärken eller utfall och med lösenord i vanlig ASCII. Ett lösenord med andra tecken går över till Strong, eftersom läsare inte kan öppna en fil låst på det sättet på denna nivå. Bara de första 32 tecknen räknas.
- **Strong**: AES-256 (PDF 2.0). Det gäller också Print PDF-filer och varje PDF i en batch-ZIP. En Print PDF låst med Strong behåller sin CMYK, sina märken och sin output intent men tar bort PDF/X-4-anspråket.

::: warning Weak är ett hinder, inget skydd
Använd **Strong** för en konfidentiell fil.
:::

**En låst ZIP** omfattar en ZIP-export, en mappnedladdning från Projects eller en batch, med ett lösenord på två nivåer: **Weak** (ZipCrypto, ett hinder) eller **Strong** (AES-256). Lösenordet skyddar varje fil. Varje PDF inuti är också låst separat med AES-256, så PDF:n förblir låst när ZIP-filen packas upp. Frågan visas när nedladdningen börjar. Ett tomt lösenord innebär inget lås.

**Ett inskrivet lösenord hålls borta från länkar på båda nivåerna.** Om en fil kommer via en `?password=`-länk läser Lolly värdet och tar genast bort det från adressen. En länk som begär ett lås som dess fil inte kan ha skriver ingen fil och anger varför (se [`password`](/info/url-parameters.html)).

**En lösenordsskyddad delningslänk** ber mottagaren om ett lösenord innan den öppnas. Länkens tillstånd krypteras med AES-256 med en nyckel som härleds från lösenordet (PBKDF2). Bara chiffertext skickas, och dekrypteringen sker i mottagarens webbläsare. Servern som levererar länken ser aldrig lösenordet eller designen. Slå på det i dialogen **Share**. En krypterad länk öppnas bara i Lolly, aldrig som en inbäddad bild. Se [URL-läge](/info/url-mode.html).

<!--i:eti-monitor-->
## På en telefon

Exportkontrollerna finns bakom den flytande knappen **Export**, som öppnar panelen **Export**: samma format, storlek, kopiering, nedladdning och delning, anpassade för touch.

<!--i:eti-code-->
## Format-id:n för länkar och CLI

Det här är värdena för URL-parametern `format=` och CLI-flaggan `--export=` (se [URL-parametrar](/info/url-parameters.html) och [CLI](/info/cli.html)). Ett verktygs meny visar bara de format som verktyget kan skapa.

| Typ | Id:n |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vektor | `svg` · `svgz` (gzip-komprimerad SVG) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (skärfil) |
| Sida och dokument | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (Penpot-designfil) · `scorm` (kurspaket, en ZIP) |
| Rörelse | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| Ljud | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` · `mid` (MIDI-noter, från Lolly Rondocode) |
| Text och data | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `ttml` · `scc` · `css` · `scss` · `gpl` (GIMP-palett) |
| Samlingar och paket | `zip` · `rpm` och `tar.gz` (renderingen förseglad i ett Linux-paket) |

Några id:n kommer från ett verktygs egen exportkod: `ase` (Adobe Swatch Exchange, från Lolly Palette Lab) och `exr` och `hdr` (rasterbilder med stort dynamiskt omfång, från Lolly Darkroom). **Convert Font** skriver `ttf`, `otf` och `woff` från en typsnittsfil som du anger, så enbart en länk ger verktyget inget att rendera.
