# Eksporter en fil

Du har laget noe, og det må ut av Lolly: en PNG til en chat, en PDF til trykkeriet, en presentasjon en kollega vil fortsette å redigere. Trykk **Export**, venstre halvdel av pillen **Export | Save**. Velg et format ved siden av filnavnet, og trykk deretter **Download**. Filen lages på enheten din.

Det du ser på lerretet, er det filen inneholder. Formatmenyen lister bare det dette verktøyet kan lage i denne nettleseren.

For de fleste jobber er ett av tre formater riktig:

| For | Velg | Fordi |
|---|---|---|
| En skjerm, en melding eller et lysbilde | **PNG** | Alle apper åpner den, og den beholder en transparent bakgrunn når verktøyet tilbyr det |
| En ferdig side, eller alt som skal trykkes | **PDF** | En ekte sidestørrelse som skrives ut slik den ser ut; **Print PDF**, der et verktøy tilbyr det, er CMYK-versjonen for et trykkeri |
| Grafikk som må forbli skarp i alle størrelser | **SVG** | Vektorformer, skarpe fra et merke til en banner |

::: check Sjekk filen i størrelsen den skal brukes
Før du sender den, åpne den på skjermen den ble laget for, eller skriv den ut i sin virkelige størrelse.
:::

::: details Godkjenninger og levering med Lolly Work (valgfritt)
En [organisasjon som kjører Lolly Work](/info/organisation.html) kan styre hvilke formater og eksportinnstillinger medlemmene ser. Der godkjenning kreves, tar **Request approval** plassen til **Download**. Følg policyen instansen din viser.

Lolly Work kan også levere en fil til konfigurerte S3-, WebDAV- og HTTP-destinasjoner, med godkjenningstrinn, leveringskvitteringer og en revisjonspost. Å sende inn en fil til den arbeidsflyten sender den til organisasjonens tjeneste; en vanlig nedlasting blir på enheten din. Personlige Send-destinasjoner og organisasjonslevering konfigureres separat.

Driftsansvarlige setter dette opp med [organisation delivery guide](/info/work-delivery.html). For køede servergjengivelser og batcher, se [CLI batch and automation](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

## Slik fungerer eksport

Når du eksporterer, gjengis verktøyets lerret til formatet du valgte og gis til deg som en nedlasting, eller legges på utklippstavlen.

Tre veier gir en fil. De fleste verktøy **gjengir lerretet**. Tekst- og dataformater (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) **genereres fra verktøyets innhold** i stedet for å tegnes fra bildet. Personverntjenester som *Strip Hidden Data* **transformerer filen du valgte**, på enheten din, og gir den tilbake uten lerret, vannmerke eller lagt til metadata, fordi det allerede er din egen fil.

![Tre eksportveier møtes i en ferdig fil: gjengi lerretet, generer tekst eller data fra innhold, eller transformer en valgt fil på enheten.](/info/diagrams/concepts/three-export-paths.svg)

Eksportpanelet tilbyr disse handlingene. Et verktøys forfatter velger hvilke som vises; standardsettet er Copy, Download og Save.

- <!--i:download--> **Download** lagrer filen. Hvis du ikke finner den etterpå, se [Find a file you downloaded](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> **Copy** legger bildet på utklippstavlen, klart til å limes inn i en chat, en e-post eller et dokument. Der en nettleser ikke kan kopiere bilder, laster den ned i stedet og sier fra.
- <!--i:folder--> **Save** beholder gjeldende design i Projects med ett klikk og laster aldri ned en fil. **Save as**, ved siden av **Download**, spør hvor (se [Saving and continuing](/info/using.html#saving-continuing)).
- <!--i:link--> **Share** åpner Share-dialogen: en lenke som gjenskaper designet, bryterne for åpning (fullskjerm, eksportpanel, nedlasting eller kopiering ved åpning) og en valgfri **Shortest link** som pakker hele tilstanden inn i et kompakt token (se [URL Mode](/info/url-mode.html)).

![Eksportpanelet - format, størrelse og handlingene Kopier / Last ned / Lagre / Del](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Når et design bygger inn gjengivelsen til et annet verktøy, som en Design-bildeboks som holder en QR Code-lenke, tegnes den nestede gjengivelsen inn i forelderens eksport. Den forblir ekte vektor i SVG og PDF og rasteriseres skarpt i PNG, JPG og WebP. Den innebygde gjengivelsen får ikke vannmerke og ingen egen proveniens; bare den ferdige filen får det. Eksporter til HTML, Markdown og TXT kan ikke holde en sammensatt gjengivelse.

## Velg et format

Filnavnet og formatmenyen sitter sammen som ett `name.format`-par, under **Last ned**.

![Filnavnfeltet sammenkoblet med formatvelgeren, slik at eksporten leses som ett navn.format-par](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Start fra der filen skal. Hvert kort lister formatene som passer den destinasjonen; et verktøy viser bare de det kan lage.

::: figure exporting-format-chooser
Seks destinasjoner og formatene som passer hver av dem.
:::

Et ordmerke satt i designsystemets skrift eksporteres som SVG med hver bokstav som en omrisset bane, så én fil forblir skarp i visittkortstørrelse og i størrelse til å dekke en bygning.

![Et hårtynt ordmerke med vid sporing som leses Aurora, den typen ren vektorgrafikk SVG-raden i tabellen handler om](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Alle formater og hva de er til
| Du vil ha | Bruk | Hvorfor |
|---|---|---|
| Skarpe logoer eller grafikk som skalerer | **SVG** | Vektor: skalerbar, liten og redigerbar; en effekt vektoreksporten ikke kan tegne, bygges inn som et bilde |
| Vektor for Office- og Windows-apper | **EMF** | Limes inn som redigerbar vektor i PowerPoint og Word, med levende tekst; Google Drive åpner den i Google Drawings |
| Vektor for trykk og designapper | **EPS**, eller **EPS (CMYK)** | PostScript-vektor for Illustrator og trykkeriarbeidsflyter |
| Vektor for skjæremaskiner | **DXF** | Laserskjærere, vinylplottere og CNC: konturbaner i millimeter |
| En redigerbar presentasjon | **PowerPoint** (PPTX) | Innebygd redigerbar tekst og former, med bilder og vektorer som kan hentes ut |
| Et redigerbart tekstdokument | **Word** (DOCX) eller **OpenDocument** (ODT) | Ekte avsnitt og overskrifter et tekstbehandlingsprogram kan fortsette å redigere (Doc Studio) |
| En layout for InDesign | **InDesign IDML (static subset)** | Tekst, rektangler, ovaler og bilder, ett oppslag per tegnebrett (Design) |
| Et redigerbart Penpot-dokument | **Penpot** | Tavler, former, tekst og koblede tokener |
| Et foto eller et generelt bilde | **PNG** (tapsfri) eller **JPG** (mindre) | Universelt raster |
| Mindre moderne bilder | **WebP** eller **AVIF** | Bedre komprimering, med gjennomsiktighet |
| Trykk | **PDF**, eller **Print PDF** (CMYK) | Ekte sidestørrelse; CMYK for et trykkeri |
| Rasterutskrift for et trykkeri | **Print TIFF** (CMYK) | DeviceCMYK-piksler for en RIP |
| Animert for nettet | **GIF** | Spilles overalt; større filer |
| Animert med full farge og ekte gjennomsiktighet | **APNG** | Animert PNG: ingen palettgrense |
| Animert, minste fil | **Animated WebP** | Full farge og gjennomsiktighet, mindre enn GIF eller APNG |
| Animert vektor som skalerer | **Animated SVG** | Selvstendig; looper i en nettleser eller en `<img>`, i hvilken som helst størrelse (Lottie Ad) |
| En animasjon som forblir redigerbar | **dotLottie** | Former, baner og ytre transformasjonsnøkler fra Designs tidslinje |
| En Premiere-overlevering | **Premiere XML + media** | Tidsbestemte klipp og originalmedier for Premiere (Design) |
| Video for sosiale medier og deling | **MP4** eller **WebM** | Best kvalitet for filstørrelsen (se [Video](#video)) |
| Undertekster | **SRT** eller **VTT** | Tidsbestemt tekst for en videospiller (Captions, Audiogram og Record) |
| Et opplæringskurs | **SCORM (LMS)** | En versjonert nettside, SCORM- eller xAPI-pakke (se [SCORM](#scorm-course-packages)) |
| Rik tekst eller en e-postsignatur | **HTML** | Limes inn formatert i e-postklienter |
| Ren tekst | **MD** eller **TXT** | Bare tekst |
| En kalenderhendelse | **ICS** | Importeres i enhver kalenderapp |
| Et kontaktkort | **VCF** | Importeres i adressebøker |
| Strukturerte data som skal importeres på nytt | **JSON** eller **CSV** | Rundtur for verktøyets innhold |
| Et favicon | **ICO** | Ikon for nettsted i flere størrelser; **ZIP** samler flere formater |
:::

### Gjennomsiktighet

Verktøy som støtter det, tilbyr en bryter for gjennomsiktig bakgrunn, som **No BG**. PNG, WebP, AVIF, SVG, APNG og Animated WebP beholder gjennomsiktighet, og GIF beholder en hard kant. JPG og PDF er alltid ugjennomsiktige. TIFF flates ut på hvitt, eller på svart på HDR-veien beskrevet under [HDR](#hdr-bright-colours).

## Størrelse og trykkenheter

Eksporter bruker verktøyets opprinnelige pikselstørrelse med mindre verktøyet tilbyr **dimensions**. Da setter du bredde, høyde og en **unit**:

- **px** (standarden) er eksakte piksler.
- **mm, cm, in, pt** og **pc** er fysiske størrelser. Med en fysisk enhet setter du også **DPI** (300 som standard). En **PDF** blir en ekte side i den størrelsen, et **raster** får pikselantallet for den DPI-en og registrerer oppløsningen, og en **SVG** beholder den fysiske enheten med en piksel-viewBox.

For et raster med høyere oppløsning, skriv inn en større bredde og høyde, eller velg en fysisk enhet og øk DPI-en (piksler = størrelse × DPI). Bredde `210`, høyde `297` og enhet `mm` gir en A4-side.

![Dimensjonsraden satt til 210 ganger 297 mm, med DPI-feltet synlig fordi enheten er fysisk](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Stillbilder fra en tidsstyrt komposisjon

En tidsbestemt komposisjon, som en [Sequence](/info/sequence-editor.html)-tidslinje i Design, beveger seg, så en stillbildeeksport må velge et øyeblikk: **bildet ved avspillingshodet**. Parker avspillingshodet der du vil ha bildet og eksporter.

For mer enn ett øyeblikk dukker feltet **Frames** opp ved siden av utdatastørrelsen. Det vises bare for en tidsbestemt komposisjon og et stillbildeformat (PNG, JPG, WebP, SVG eller PDF). La det stå på `1` for avspillingshodets bilde. Øk det, så får du så mange stillbilder, jevnt fordelt over hele sekvensen:

- PNG, JPG, WebP og SVG kommer tilbake som én ZIP: `<name>-01.png`, `-02.png` og så videre.
- PDF kommer tilbake som ett dokument med så mange sider.

Hvert stillbilde kommer fra midten av sin del av tidslinjen, så det første bildet er aldri en halvt tonet inngang og det siste er aldri det tomme øyeblikket etter at hvert klipp har tatt slutt.

::: figure exporting-contact-sheet
Frames: 4 skjærer sekvensen i fire like deler og tar midten av hver.
:::

Bruk det for et storyboard, et gjennomgangskontaktark eller en sosial karusell klippet fra en videoredigering. Antallet er begrenset til 64, og alt annet som skrives i feltet, faller tilbake til `1`. Hvert bilde er et vanlig stillbilde, så credentials, Imprint, fysiske enheter og DPI oppfører seg som for én eksport. En eksportlenke, CLI-et og MCP ber om det samme arket med `cuts=` (se [Contact sheets](/info/url-export.html#contact-sheets)).

## Mange filer samtidig

Lolly har tre måter å arbeide i volum på, hver for en ulik jobb:

::: cols
## En tabell blir ett dokument
Et verktøy med en tabellinndata, som **Battlecards**, gjør hver rad til en side. Lim inn en tabell fra regnearket og få én PDF. Rett opp rader i regnearket og lim inn på nytt.
## En CSV blir én fil per rad
**Batch** (`#/batch`) tar en CSV og gjengir én eksport for hver rad: navneskilt eller sertifikater, én fil hver, levert i en ZIP. Se [Batch](/info/batch.html#make-many-versions-of-one-design).
## Flere design får én redigering
**Multi-edit** åpner flere lagrede økter side om side for den samme finjusteringen på tvers av ulike design. Se [Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Fra **Projects** eksporterer **Render folder** hver lagrede økt i en mappe og undermappene som én nestet ZIP, og **Render selection** gjør det samme for ethvert flervalg; én lagret økt gjengis til sin egen fil. En lagret økt kan også deles på nytt som en verktøylenke fra Projects, som åpner den igjen med de samme innstillingene.

## Filer som forblir redigerbare andre steder

Noen formater overleverer arbeidet ditt til et annet program som redigerbart innhold i stedet for et bilde.

### PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart, Diagrams, Flow Chart og Agenda eksporterer en PowerPoint-presentasjon, ett lysbilde per side. Hver side tas fra hverandre i innebygde objekter, så en kollega kan redigere presentasjonen og ta ressurser ut av den:

- <!--i:font--> **Text** blir redigerbare PowerPoint-tekstbokser med layoutens skriftstørrelse, farge, vekt, kursiv og justering.
- <!--i:pentool--> **Vectors** som logoer og ikoner bygges inn som SVG-bilder; de forblir skarpe, og PowerPoint kan *Convert to Shape* på dem.
- <!--i:photos--> **Images** kommer gjennom i opprinnelig oppløsning som egne bilder. Et beskåret heltebilde beholder hele bildet bak beskjæringen, og ethvert filter eller blanding på det er bakt inn.
- <!--i:layers--> **Backgrounds, borders and rules** blir rektangel- og linjeformer.

![Eksportpanelet med PowerPoint valgt: ett lysbilde per side, tekst og former forblir redigerbare](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Layouten er omtrentlig; målet er gjenbrukbart innhold. Alt vandreren ikke kan uttrykke innebygd, som en kompleks filtrert eller maskert region, bygges inn som et bilde så ingenting går tapt. En presentasjon har én lysbildestørrelse, hentet fra den første siden.

PowerPoint er også en vei inn: [Rebrand a deck](/info/rebrand.html) flytter en presentasjon over på designsystemet ditt, og [Import a design](/info/design-import.html) åpner en i Design.

### Penpot

De fleste verktøy som eksporterer SVG, eksporterer også en **Penpot file** (`.penpot`), klar til å redigeres videre i Penpot.

| Det du lagde | I Penpot |
|---|---|
| Tekst | Redigerbare tekstobjekter: rett en skrivefeil eller gi ny stil |
| Former, baner, gradienter og bilder | Egne redigerbare vektorformer |
| En farge eller skrift fra et designsystemtoken | En levende tokenkobling: rediger tokenet, så følger hver form som arver det |
| Hele designet | En gjenbrukbar komponent i panelet Assets |
| En kompleks illustrasjon eller et levende lerret | Bygd inn for seg som et bilde, med det redigerbare innholdet rundt urørt |

Fra Design blir hvert bilde en Penpot-tavle. Designsystemets farger og typografier havner i panelet Assets og det fulle tokensettet i panelet Tokens. Penpot beholder sin egen kopi derfra: et token redigert i Penpot kommer tilbake gjennom importen i [Design System Setup](/info/brand-studio.html).

![Eksportpanelet med Penpot valgt: .penpot-filen, og Send to Penpot ved siden av nedlastingen](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

For å åpne filen, start Penpot, velg et prosjekt og velg **Import**. Pålogget Penpot fra eksportpanelet gjør **Send to Penpot** det trinnet for deg.

### Word, OpenDocument og InDesign

**Doc Studio** eksporterer **Word** (DOCX) og **OpenDocument** (ODT) med ekte avsnitt og overskrifter.

**Design** eksporterer **InDesign IDML (static subset)**: tekst, rektangler, ovaler og PNG- eller JPEG-bilder, ett oppslag per tegnebrett. Støttet innebygd formatering forblir redigerbar, bilder reiser i `Links` og koordinater blir InDesign-punkter. Relinking, skrifterstatning og endret tekstbryting kan kreve oppmerksomhet. Effekter, animasjon, sammensatte artikler og ikke-støttet geometri stopper eksporten med en rapport som lister dem. IDML bevarer ikke originaldokumentet, så send PDF for ferdig grafikk.

### Tidslinjer: dotLottie og Premiere

Fra Designs tidslinje skriver **dotLottie** en animasjon som forblir redigerbar i Lottie-verktøy; [Lottie animations](/info/sequence-editor.html#lottie-animations) lister hva den beholder. **Premiere XML + media** pakker tidsbestemte klipp og originalmediene deres for Premiere; se [Premiere XML exchange](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (kurspakker)

Kurseksport er av til du slår på **Training and courses** under Settings → Preferences → Feature flags.

Velg deretter **Export course** fra et støttet verktøy, en prosjektmappe eller et utvalg. I Design åpner valg av **SCORM (LMS)** og **Download** den samme kursarbeidsflyten. Lolly lagrer arbeidet, lar deg gjennomgå kursinnholdet og rekkefølgen, og åpner deretter modulen og eksportdialogen.

- <!--i:layers--> Velg en gjengivelse for hver kilde: stillesider, bevegelse som video, lyd eller en nedlastbar ressurs. Legg til leksjonstekst og lesealternativer i modulen.
- <!--i:clock--> Forhåndsvis deltakerspilleren og gjennomgå beskrivelser og undertekster. Bevegelse tas med som video, også stille animasjon.
- <!--i:document--> Velg Website, SCORM 1.2, SCORM 2004 4th Edition eller et eksperimentelt xAPI-mål. Sjekk innholdet og ZIP-størrelsen, lagre deretter og last ned den kontrollerte versjonen.
- <!--i:check--> Fullføring krever at hver påkrevde leksjon bekreftes og at Finish velges.

![Eksportpanelet på et Design-sett med SCORM (LMS) valgt](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Pakken holder det ferdige innholdet og trenger ingen Lolly-konto. Legg en Website-ZIP på en HTTP(S)-vert; importer en LMS-ZIP uendret. Test destinasjonen før du deler kurset. For et kurs bygget fra flere lagrede skapelser, se [Create a training course](/info/training-creators.html).

### DXF (skjærefiler)

Asset Export, Diagrams, Growth, Logo Wall, QR Code, Street Map, Wayfinding og Wordmark eksporterer **DXF**, AutoCAD R12-utvekslingsformatet som laserskjærere, vinylplottere og CNC-programvare leser. Geometri skrives som konturbaner i millimeter, tekst omrisses og farger tilordnes nærmeste AutoCAD Color Index, som vanligvis styrer skjæremaskinens operasjon. DXF er bare strektegning: en fotografisk eller filtrert region har ingen skjærebane og droppes, med en advarsel. Bruk SVG eller PDF for å beholde rasterinnhold.

Street Map er det klareste tilfellet. Hele designet er allerede streker, så hver vei og hver kanal blir en skjærebane.

::: showcase
![Et Street Map-render av Paris i blekk på krem - ren strektegning, så hver strek overlever turen til en kutter](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Skroll, og kameraet trekker seg tilbake gjennom selve geometrien: sju baner, ingen piksler noe sted, hver strek hårfin-skarp i alle zoomnivåer. Det er samme fil en kutter leser.
:::

## Trykk

**Print PDF** skriver CMYK mot en navngitt trykkbetingelse, **Coated FOGRA39** som standard. Merkevarefargeprøver med målte blekkverdier konverteres eksakt; andre farger bruker en standard enhetskonvertering. **Print TIFF** skriver DeviceCMYK-piksler for en RIP og registrerer den samme trykkbetingelsen i TIFF-metadataene. Kontrollen Colour profile styrer begge; [Colour profiles](#colour-profiles) har detaljene.

**Print marks & bleed** har sitt eget kort på trykkformatene: utfallet i millimeter pluss Crop, Registration, Bleed, Colour bars og Stamp details.

Noen verktøy bygger en **multi-page PDF**: et omslag, innhold som flyter over på så mange sider det trenger og en bakside, som i verktøyet *Booklet*. Hver side er en ekte stående PDF-side i A4, US Letter eller A5, og du kan tvinge hvilken som helst blokk over på en ny side. Dette er RGB-dokumenter uten beskjæringsmerker eller utfall, som hører til den enkeltsidede Print PDF. En Design-PDF kan også være en **Notes handout**: en stående side for hvert lysbilde med talernotatene under.

**Before you export.** Et kort **Before you export** nederst i panelet sier hva et trykkeri er i ferd med å se: format, størrelse og utfall, beskjærings- og utfallsområder, fargedekning, antall plater og sideantall, med en dom ved siden av overskriften. Det blokkerer aldri en eksport. Design viser alltid kortet med sine egne kontroller, inkludert designsystemets interne regler lag for lag og skrivesignalet for dokumentets tekst ([Before you export](/info/design.html#before-you-export)), og legger til disse trykkontrollene når **Print preflight** er på. I andre verktøy, slå på **Print preflight** under Settings → Preferences → Feature flags; den er av som standard, og en Lolly Work-installasjon kan slå den på for medlemmene sine.

**After you export.** Når filen er klar, leser Lolly den tilbake og sammenligner den med det du valgte: format, piksel- eller sidestørrelse, klipplengde, en gjennomsiktig bakgrunn, CMYK-farge, HDR, Content Credentials og et PDF- eller ZIP-passord. Alt som avviker, skrives på eksportkortet. Hver måling kommer fra filen, aldri fra innstillingen, og en egenskap filen ikke kan svare på, regnes ikke som et samsvar. Kommandolinjen skriver hele sammenligningen med `--export-report` (se [Render with the CLI](/info/cli-rendering.html)).

Designs inspektørkontroller og merkevaresammenligningen i Design System Setup er separate kontroller: de ser på designet, mens disse to kortene ser på filen.

::: details Kostnad fra et prisark
Under preflight gjør et kostnadskort de samme tallene om til penger, med bare priser noen har oppgitt. Det leser disse tallene selv når selve preflight-kortet er av. Det trenger to ting: en jobb en prisliste kan prise (plater, ark, areal, sider, variantrader eller utdatafiler, så en vanlig logo-PNG viser det aldri) og et **rate card**, en JSON-prisliste fra trykkeriet ditt. Et standardbygg har ingen og har ingen måte å laste et inn i appen. Et rate card kommer som en katalogressurs en installasjon leverer, eller gjennom den valgfrie rate card-utvidelsen en selvhoster eller kontrollplan slår på. Uten rate card vises ingenting.

Hvert tall er en sats du oppga ganger en mengde Lolly telte, som `4 plate × €35.00`, og totalen bærer kilden sin: utstederen på kortet og datoen satsene er fra. Det er ingen standardvaluta og ingen plassholderpris. Det filen sier om seg selv, forblir gjengitt tale: *"The file says: … Lolly has not verified this."*

Når et tall ikke kan regnes ut, trekkes tabellen tilbake i stedet for å fylles ut:

- Linjer kortet ikke priser, betyr **ingen total i det hele tatt**, bare en overskrift som sier hvor mange som er uten pris.
- En mengde som er et tak, bærer **"up to"** inn i delsummen sin.
- Satser forbi gyldig-til-datoen viser **kun antall** til du trykker *Use these rates anyway*; utløpsdatoen følger da med tallet.
- Åpnet gjennom en **lenke** forblir penger skjult til du ber om dem på denne enheten. CLI-et tar `--rate-card=<file.json>` som en lokal fil og aldri som en lenkeparameter.

Kortet fjernes fra hvert eksporttrinn, så det endrer aldri filen. Det er aritmetikk, ikke et tilbud; bare trykkeriet ditt kan gi et tilbud.
:::

## Bevegelse og lyd

### Video

Animerte verktøy eksporterer **MP4** og **WebM**. Velgeren viser bare containerne denne nettleseren kan lage, og en delt `?format=`-lenke som ber om en den ikke kan lage, faller tilbake til den andre, med et tilsvarende filnavn. Animerte verktøy tilbyr også **Start after**, som holder lerretet stille et øyeblikk slik at animasjoner og skrifter setter seg før opptak, og **Duration**, lengden på det ferdige klippet. **Motion blur** (Off, Draft quality, Standard eller High, med en **Shutter angle**) gjør rask bevegelse uskarp på bekostning av gjengivelsestid. Der nettleseren støtter det, tar **Record live** opp forhåndsvisningen på skjermen i sanntid gjennom en skjermdeling i stedet.

![Tidsinnstillingene for en animert eksport: Start after, Duration, Motion blur med Shutter angle, og Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** velger Smaller file, Balanced eller Best quality. **Advanced** åpner **Codec**, **Frame rate**, **Rate mode** og **Hardware acceleration**. Der et verktøy har undertekster, velger **Captions** et **Embedded track** eller en **Sidecar .vtt + .srt** ved siden av videoen. En lenke bærer kvaliteten, kodeken, bildefrekvensen, varigheten og startforsinkelsen som `vq`, `codec`, `fps`, `seconds` og `wait` ([URL parameters](/info/url-parameters.html)).

Videoeksporter beholder lyden sin. Et verktøy kan legge et **music bed** under klippet: en lydressurs sløyfet eller beskåret til klipplengden, med fades, volum og ducking under opptakets egen lyd. Opptaksverktøyene bærer sin levende lyd gjennom til filen.

En Design-presentasjon som forblir en klikkpresentasjon, kan likevel gå ut som en video. **Export slides as video** i Present-menyen åpner eksportarket på MP4. Hvert lysbilde spilles for sin egen varighet, eller for eksportarkets Duration når det ikke har noen, og presentasjonens lysbildeovergang spilles mellom dem som en oppløsning. Selve dokumentet endres ikke.

### Animerte bilder

**GIF** spilles overalt og passer for chat og e-post; den er større og har færre farger enn video. **APNG** og **Animated WebP** beholder full farge og gjennomsiktighet. **Lottie Ad** eksporterer også **Animated SVG**: vektorbilder med innebygde CSS-nøkkelbilder, så den skalerer til enhver størrelse og looper i en nettleserfane eller en `<img>` uten kodek. Teksten omrisses, og den bruker en lavere standard bildefrekvens fordi hvert bilde er tyngre enn et punktgrafikkbilde. Alle disse er stille.

### Lyd

Noen verktøy eksporterer lyd for seg. **Voice Recorder** tar opp et mikrofonopptak med en levende nivåmåler og lagrer det som **MP3**, **WAV**, **M4A (AAC)** eller **Opus (WebM)**, kodet på enheten din. `wav`, `mp3`, `m4a` og `opus` er vanlige format-ID-er, så en lydeksport kan deles og skriptes like lett som en PNG.

Ressursvelgeren godtar et bredt utvalg lyd for et musikkteppe, fra MP3 og FLAC til MIDI og trackermoduler; [Formats](/info/formats.html) lister dem. En [Rondocode song](/info/rondocode.html) spilles i den lengden klippet ber om.

## Farge og HDR

Lolly leser hver moderne CSS-farge, gjør fargematematikken perseptuelt og skriver hver fil i et rom en leser kan åpne: sRGB for skjermer, CMYK for trykk og Rec.2100 PQ for HDR. [Colour in the engine](/info/colour-engine.html) forklarer hvordan. Et Design-dokument satt til **Wide colour / HDR** følger sine egne regler, beskrevet i [Wide colour and HDR editing](/info/hdr-editing.html).

### Fargeprofiler

Eksporter merkes med en fargeprofil, slik at fargestyrte apper som trykkerier, Photoshop og nettlesere leser fargene slik du så dem. Dette skjer automatisk; miniatyrbilder og forhåndsvisninger hopper over merkingen for å holde seg små.

- **PNG og JPG** bærer en innebygd **sRGB** ICC-profil, rommet forhåndsvisningen tegnes i. Pikslene merkes, ikke kodes på nytt.
- **Print PDF (CMYK)** deklarerer trykkbetingelsen sin i *OutputIntent*, og forteller et trykkeri hvordan CMYK-fargene er ment å leses.
- **Print TIFF (CMYK)** skriver umerkede DeviceCMYK-piksler og registrerer trykkbetingelsen i TIFF-metadataene. En TIFF kan ikke bygge inn en trykkprofil, så en **Embed**-rad registrerer bare profilens navn.
- **TIFF (RGB)** er den ukomprimerte sRGB-søsteren for arkiv eller en runde i et redigeringsprogram. Den flater ut gjennomsiktighet på hvitt. Begge TIFF-ene er bare for skrivebord, fordi nettlesere ikke kan forhåndsvise en TIFF.
- **SVG**, **EMF**, **EPS** og **DXF** er vektorer uten innebygd profil: SVGs farger er sRGB, EMF og EPS bruker enhets-RGB, **EPS (CMYK)** skriver DeviceCMYK og DXF bruker AutoCAD Color Index. SVG, EPS og DXF omrisser tekst til baner. EMF holder tekst levende og redigerbar i Office og Google Slides, og faller bare tilbake til konturer for kjøringer formatet ikke kan uttrykke; valget **Outline fonts** i eksportpanelet tvinger baner overalt. SVG gjengir også CSS-bokseskygger, inni og utenfor.

::: details PDF/X-4 og din egen trykkprofil
Ingen CMYK-profil følger med Lolly. En navngitt trykkbetingelse skriver output intent uten å påstå PDF/X-4-samsvar, fordi PDF/X-4 vil ha profilen innebygd.

Last en CMYK-profil av din egen og velg **Embed**-raden i kontrollen Colour profile. Den bygges inn som filens *DestOutputProfile*, og PDF-en påstår PDF/X-4 så snart resten av filen tillater det. Trykkbetingelsen den deklarerer, leses av den profilen: et registrert navn der profilen beviser ett, eller `Custom` under profilens eget navn.

Tre ting holder påstanden tilbake mens de beholder output intent: RGB-grafikk CMYK-trinnet ikke kunne konvertere, kredittteksten `prov` for korrekturmargen (tegnet i en standardskrift som ikke er innebygd) og et **Strong** passord, siden PDF/X-4 forbyr kryptering. Hver PDF bærer også PDF/X-4-metadata: sideboksene, XMP, en dokument-ID og en sRGB output intent med profilen sin.
:::

### HDR (sterke farger)

Dette er eksportpanelets **HDR**-kort, som lyser opp vanlig grafikk for HDR-skjermer. Å beholde HDR-originaler gjennom redigering er en annen funksjon: [Wide colour and HDR editing](/info/hdr-editing.html).

En vanlig eksport er sRGB: en mettet merkevarefarge er like lys som skjermens vanlige hvitt. En HDR-skjerm har rom over det. **HDR**-kortet løfter merkevarefargene og den hvite teksten mot toppluminans, mens mørke områder forblir mørke og gir gløden sin kontrast.

![HDR-kortet i eksportpanelet, slått på, med Hvit/Rekkevidde/Mørk løft/Fokus-hjulene avslørt under det](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formater.** PNG, JPG, AVIF og TIFF. WebP er 8-bit uten fungerende HDR-dekodingsvei, og vektorer og PDF har ingen HDR-modell.
- **Av som standard**, fordi det endrer pikslene. Kryss av for kortet, eller send `hdr=1` i en delingslenke.
- **Dialene.** **White** (taket for toppluminans, 400 til 2000 nits), **Reach** (hvor langt ned i tonene gløden sprer seg), **Dark lift** (hvor mye mørke toner lysnes; `0` holder dem mørke) og **Focus** (hvor mye fargerikdom løftet beholder). De reiser som én verdi: `hdr=1600-60-0-50` er White 1600, Reach 60, Dark lift 0 og Focus 50.
- **Hva som skrives.** PNG får 16-bit Rec.2100 PQ med en `cICP`-chunk. JPG er en ISO 21496-1 gain-map-JPEG: et vanlig SDR-bilde pluss et vedlagt gain map. AVIF får en omskrevet `colr`-boks. TIFF får PQ-piksler med en generert ICC v4-profil som bærer en `cicp`-tag, og flates ut på svart, fordi hvitt er 10 000-nits-koden i PQ og ville gitt hver kant en glorie. Løftet følger perseptuell (OKLab) lyshet og beholder fargetonen, så en merkevaregrønn blir lysere, ikke mintfarget.
- **Hvor gløden vises.** Fargestyrte visere på en HDR-skjerm: Preview, Quick Look og Safari på Apple-enheter, eller Chrome på en HDR-skjerm. En SDR-skjerm viser et vanlig bilde.
- **Før du leverer.** Mange plattformer koder opplastinger på nytt og fjerner HDR-signalet, noe som kan gjøre bildet mørkt eller utvasket. Bruk HDR der du kontrollerer destinasjonen, som ditt eget nettsted, en videovegg eller en presentasjon på et lyst panel.
- **Fra terminalen.** `--hdr=1` med `--export=png` eller `--export=jpg` skriver den samme PNG-en og gain-map-JPEG-en på [CLI](/info/cli.html), fra de samme motorkoderne, uten nettleser på veien. AVIF og TIFF forblir nett-eksporter foreløpig.

## Hva som følger med filen din

En ferdig fil kan bære flere poster ved siden av bildet. Noen ligger ved siden av pikslene og forsvinner når filen lagres på nytt eller strippes; to merker lever i selve pikslene.

::: figure exporting-what-travels
Hvor hver post ligger, om den er på som standard og hvilken lenkeparameter som styrer hver av dem.
:::

Eksportpanelet folder **Licence**, **Source credits**, *Password protect*, **C2PA Credentials**, **Lolly Imprint** og **Durable credential** sammen i én **Content protection**-gruppe som bare viser kortene det valgte formatet kan bruke. Den åpner seg selv når en lenke eller et dokument allerede deklarerer en lisens, eller når en kilde trenger en avgjørelse fra deg. Kortet **Design system** blir utenfor gruppen, i syne på hver eksport.

![Content protection-gruppen åpnet på en PNG-eksport, som viser bare kortene som gjelder for den](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Proveniens og vannmerke

Der formatet har feltene, bærer eksporter **provenance metadata**: programvaren, kilden, verktøyets navn og profilkredittlinjen din, skrevet inn i PNG iTXt, JPEG EXIF, PDF-info, SVG `<metadata>` eller en GIF-kommentar. Den registrerer bare opphavet, og ingenting lastes opp. **Experimental**-verktøy stempler også et synlig vannmerke, påført av verten slik at redigering av verktøyet ikke kan fjerne merket.

**The Lolly Imprint** er et usynlig pikselvannmerke, **på som standard**. Credentialen og metadataene reiser ved siden av pikslene og går tapt ved en ny lagring, et skjermbilde eller en metadatastripping. Imprint lever i pikslene og overlever rekomprimering, så en kopi fortsatt kan gjenkjennes som laget med Lolly. Det er et hint, ikke en kryptografisk garanti, og det bærer ingen personopplysninger. Det følger med i JPEG XL, PNG, JPG, WebP, AVIF, TIFF og BMP, og i rasterne Lolly gjengir inn i en PDF eller PPTX, aldri i et bilde du bygde inn. Fjern avkrysningen for **Lolly Imprint** eller send `imprint=0` for å utelate Imprint. At AVIF overlever ny koding, er ikke kalibrert ennå. [Verify](/verify) oppdager det på enheten din; se [The Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**The Durable credential** skriver Lollys id inn i pikslene med en nevral modell på enheten i TrustMark-formatet, slik at lenken "made with Lolly" overlever en metadatastripping og en ny koding og kan leses av TrustMark-kompatible verktøy. Den er **av som standard**, fordi den koster et nevralt pass per eksport og en engangsnedlasting av modellen. Den dekker PNG, JPG, WebP, AVIF og TIFF; kryss av for den i panelet eller send `durable=1`. Skrivebords- og mobilappene skjuler kortet, fordi de ikke har noen opprinnelse å hente modellen fra uten nett.

**Licence.** Velg hvordan andre kan bruke arbeidet ditt: *None (all rights reserved)* som standard, CC0 1.0, Public Domain Mark 1.0 eller en Creative Commons 4.0-lisens (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). Lisensnavnet og en lenke til lisensteksten går inn i filens lisensmetadata (EXIF, XMP og RIFF der formatet har dem) og Content Credential. Valget lagres med dokumentet og følger med i en lenke som `licence=`. Lolly skriver lisensen du valgte; den sjekker eller håndhever ikke vilkårene. Et verktøy med sitt eget lisensfelt, som Claim, beholder det feltet i stedet.

### Designsystemposten

En eksport registrerer designsystemet som laget filen: navnet, den publiserte versjonen det ble tegnet fra (når det ikke er arbeidsversjonen) og [fargevarianten](/info/colourways.html) det ble tegnet i. Ethvert annet temavalg et designsystem deklarerer, som en tetthet, registreres på samme måte. Valget av lys eller mørk utelates, fordi bildet allerede viser hvilket som ble brukt.

**Du ser posten før noe skrives.** Kortet **Design system**, avkrysset som standard, viser de nøyaktige ordene filen vil bære, som *Records: Acme · Colourway: Beach*, og beskrivelsen slik den vil lese. Et designsystems navn er det eierne skrev, så kortet viser det slik det er skrevet. Fjern avkrysningen for å utelate posten fra den eksporten. Design-dokumentpanelet lister de samme ordene under *Embedded in exports*.

**Beskrivelsen gir fargevarianten ved siden av verktøyet.** Med kortet avkrysset blir *"Made with https://lolly.tools : Chart"* til *"Made with https://lolly.tools : Chart (Beach colourway)"*. Designsystemets eget navn blir i posten, ikke i beskrivelsen. En beskrivelse uten verktøynavn, eller en et verktøy skriver fra sine egne inndata, lades urørt. Et verktøy som ignorerer fargevarianter gjennom `tokenAxes`, registrerer ingen, og PDF-korrekturkreditten (trykkmerket `prov`) følger samme regel.

**Merkevareferdigheter som veiledet en agent.** Når en agent laget arbeidet og navnga [brand skills](/info/brand-skills.html) den leste og fulgte, lister posten også hver ferdighet med revisjonen sin, som *Guided by: acme-brand 1.0*. Ordene betyr at ferdigheten veiledet arbeidet. De er ikke en kontroll: Lolly tester ikke arbeidet mot en ferdighet. Bare agentens egen erklæring legger til listen, som i dag betyr `brandSkills`-argumentet til `lolly_render` i [MCP server](/info/mcp.html), så et arbeid laget i appen eller fra en delingslenke bærer ingen. Content Credential holder listen som `brandSkills`, én JSON-verdi med hver ferdighets id, navn, revisjon og SHA-256-hash. XMP-pakken og SVG-metadataene holder den samme verdien som `lolly:BrandSkills`, en PDF skrevet fra posten får ett nøkkelord per ferdighet og beskrivelsen blir som den var. En intern ferdighet registreres med id, navn, revisjon og hash, aldri med teksten sin. De samme bryterne utelater listen sammen med resten av posten: kortet **Design system**, `_madewith=0`, `--no-madewith` og `madeWith: false`. Når MCP-serveren tegner filen i en nettleser (en PDF, en JPEG og de andre formatene den nettleserfrie veien ikke kan skrive), holder filens egne metadata ingen liste og bare en Content Credential kan holde en. Send `c2pa` for å beholde posten; uten en credential advarer gjengivelsen om at merkevareferdighetene ikke ble registrert.

**Å lese posten tilbake.** [Verify](/verify) lister posten som **Design system** i en fils credential-detaljer og eventuelle merkevareferdigheter som **Guided by**. *Recreate with these settings* åpner verktøyet igjen i den registrerte versjonen og fargevarianten. Lenken åpner med det registrerte designsystemet når denne enheten har ett med samme id og navn; ellers åpner den med ditt aktive designsystem.

::: details Hva som skrives hvor, og hvilke kjøringer som utelater posten
| Hvor | Hva som skrives |
|---|---|
| Content Credential | `designSystem` (id-en), `designSystemLabel`, `designVersion` og `themes` i påstanden `tools.lolly.export`, hver en ren tekstverdi; `themes` er en JSON-liste over valgene |
| PNG, JPEG, WebP og JXL | De samme fire verdiene som `lolly:`-egenskaper i filens XMP-pakke, i navneområdet `https://lolly.tools/ns/export/1.0/` |
| SVG | De samme `lolly:`-egenskapene inne i blokken `<metadata>` |
| PDF | Nøkkelord som *Design system: Acme* og *Colourway: Beach* |
| Hvert format med et beskrivelsesfelt | Beskrivelsen, med fargevarianten ved siden av verktøyet |

Kortet vises bare når det er noe å registrere og formatet kan holde posten. CSV, JSON, en kalenderfil og andre tekst- eller dataformater holder ingen metadata, og EPS, EMF, DXF og BMP har ikke noe felt for posten. HTML, Markdown og CSS holder posten bare i Content Credential, så for dem viser kortet ingen beskrivelseslinje og skjules mens **C2PA Credentials** er av. Et felt designsystemet ikke gir, blir utenfor filen.

En delingslenke slår posten av med `_madewith=0` ([URL parameters](/info/url-parameters.html)); kommandolinjen tar `--no-madewith`, `lolly_render` i [MCP server](/info/mcp.html) tar `madeWith: false`, og eksportpanelet i terminalappen har en **Design system**-rad. Kommandolinjen skriver ordene en ferdig fil bærer til standard feil, for en verktøygjengivelse og for hver fil `lolly run` eksporterer fra en lagret Design-økt, og en MCP-gjengivelse skriver dem ved siden av filen, begge lest tilbake fra filen. En PNG kommandolinjen tegner uten nettleser, bærer ingen filmetadata, så posten reiser bare i credentialen. Verktøy på enheten legger ikke til noen metadata i det hele tatt.

Kjøringer uten **Design system**-kort utelater posten: en Batch-kjøring, en mappe eksportert fra Projects og en 3D-samlingseksport, og i terminalappen en CSV-batch, en Projects-mappe- eller utvalgseksport og visningen render-everything. Eksporter én fil fra verktøyet for å registrere designsystemet.
:::

### Content Credentials (C2PA)

Eksporter kan bære **Content Credentials**: et signert [C2PA](https://c2pa.org)-manifest som registrerer hva som laget filen, når og hvor, bundet til en hash av filens bytes slik at enhver senere redigering kan oppdages. Spesifikasjonen publiseres av C2PA, og Lolly skriver standardmanifester som enhver C2PA-leser kan inspisere.

![Kortet C2PA Credentials, avkrysset, med credentialens levetid ved siden av avkrysningsboksen](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **På som standard.** Kortet **C2PA Credentials** er forhåndsvalgt for nesten hvert verktøy. Fjern avkrysningen for én eksport, eller send `c2pa=off` i en lenke. Et verktøy kan velge det bort i manifestet sitt.
- **Formater.** PDF (RGB og Print), PNG og APNG, JPG, GIF, SVG, TIFF (RGB og Print), WebP (stillbilde og animert), AVIF, MP4, WebM, lydcontainerne MP3, WAV, M4A, OGG/Opus og FLAC, og HTML, Markdown og CSS. En ZIP stempler hvert støttede medlem, og slik får en Animated SVG en. MP4, AVIF og M4A bruker standard BMFF-binding og MP3 sin ID3v2-tilordning, så `c2patool` og andre lesere verifiserer dem. WebM og OGG/Opus har ingen standardtilordning ennå, så Lolly bærer manifestet som et Matroska-vedlegg og et OpusTags-felt, som Lollys egen verifiserer sjekker. ICO, EPS, EMF, DXF, BMP, PPTX, Office-formatene og de andre tekst- og dataformatene har ingen C2PA-container.
- **Hva den registrerer.** Verktøyet og appen som laget filen, signeringstidspunktet, skallet som eksporterte den, [designsystemet og fargevarianten](#the-design-system-record) mens kortet **Design system** er avkrysset, og fingeravtrykk av aktive inndata. Inndatatekst, profilbundne felt, inaktive kontroller, nettleserversjoner og operativsystemdetaljer utelates. Navnet og e-posten din vises som forfatter bare når **Use my details to create** er på under Settings → Preferences → Your details. Kilder en eksport plasserer, reiser som ingredienser: [credited works](#source-credits) som emoji, og [Rondocode songs](/info/rondocode.html#songs-in-the-credential) i en video- eller lydeksport.
- **Hva mottakere ser.** C2PA-verktøy som Adobe-apper, `c2patool` og contentcredentials.org/verify leser manifestet og viser påstanden. Lolly signerer med en nøkkel laget på enheten din, ikke et sertifikat fra en tillitsliste, så visere rapporterer en *unverified* credential: strukturen og manipulasjonsbeviset er ekte, men signereren er ikke garantert. For å endre det, registrer en **verified identity** under Settings → Preferences → Content Credentials; se [Content Credentials Identity](/info/content-credentials-identity.html).
- **Å sjekke en fil.** Slipp en hvilken som helst fil på [Verify](/verify), eller kjør `lolly validate <file>`, for en rapport på enheten som starter med om Lolly laget filen og om den er endret siden. Verify ser også utover credentialen; se [What Verify checks](/info/what-verify-checks.html).
- **Personvern.** Signeringsnøkkelen lages for eksporten og forlater aldri enheten din, og påstanden holder bare det proveniensmetadataene allerede bærer. Personverntjenester som transformerer dine egne filer, legger ikke til noen credential, og *Strip Hidden Data* fjerner et C2PA-manifest som alle andre metadata. Rondocode-utilityen lager ny lyd, så den signerer det den skriver ([Rondocode songs](/info/rondocode.html#files-from-the-rondocode-utility)).
- **Samspill.** En passordbeskyttet PDF kan ikke bære Content Credentials, på noe nivå. Credentialen legges til sist, over de ferdige bytene, etter DPI, EXIF, fargeprofil, PDF/X-metadata og trykkmerker.

### Source credits

En eksport som plasserer noen andres verk, registrerer den kilden i credentialen. En emoji tegnet fra det valgte emoji-settet er hverdagstilfellet: verket, skaperen, lisensen, hvor de eksakte bytene kom fra og hva som ble endret følger alle med filen. Tekst i et verktøy hvis mal er en SVG beholder systemets egne emoji, så ingenting krediteres der. Raden **Source credits** sier hva kildene ber om for leveringen før du laster ned, og etter nedlastingen leser den de leverte bytene tilbake før den sier at kredittene er i filen. En lisens som ber deg velge, som en omfarget CC BY-SA-glyf du er i ferd med å dele, får et kort med alternativene; nedlastingen blokkeres aldri. [Creative rights and credits](/info/creative-rights.html) har formuleringene, de gjennomgåtte lisensene og det som forblir ditt.

## Passordbeskyttelse

To slags lås, begge laget på enheten din. Kortet *Password protect* i eksportpanelet styrer begge.

![Password protect-kortet utvidet på en PDF-eksport, med passordfeltet og de to låsnivåene](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**Et PDF-åpningspassord** har to nivåer når du skriver et passord:

- **Weak**: 40-bit RC4, en avskrekking snarere enn beskyttelse. Passordet kan reise i en delingslenke, i klartekst. Bare RGB `pdf`.
- **Strong**: AES-256 (PDF 2.0). Skrives ved eksport og legges aldri i en lenke. Det gjelder også Print PDF-er og hver PDF i en batch-ZIP. En Strong-låst Print PDF beholder CMYK, merkene og output intent, men mister PDF/X-4-påstanden.

**En låst ZIP** dekker en ZIP-eksport, en mappenedlasting fra Projects eller en batch, med ett passord på to nivåer: **Weak** (ZipCrypto, en avskrekking; det kan reise i en `?password=`-lenke) eller **Strong** (AES-256, skrives ved eksport, aldri i en lenke). Passordet beskytter hvert medlem, og enhver PDF inni er også låst med AES-256 for seg, så den forblir låst etter at ZIP-en er pakket ut. Ledeteksten vises når nedlastingen starter; et tomt passord betyr ingen lås.

**En passordbeskyttet delingslenke** ber mottakeren om et passord før den åpnes. Hele lenketilstanden krypteres med AES-256 under en nøkkel utledet fra passordet (PBKDF2), så bare chiffertekst reiser og dekrypteringen skjer i mottakerens nettleser. Serveren som serverer lenken, ser aldri passordet eller designet. Slå det på i **Share**-dialogen. En kryptert lenke åpnes bare i Lolly, aldri som et innebygd bilde. Se [URL Mode](/info/url-mode.html).

## På en telefon

Eksportkontrollene ligger bak den flytende **Export**-knappen, som åpner **Export**-arket: de samme formatene, størrelsen, kopiering, nedlasting og deling, tilpasset for berøring.

## Format-ID-er for lenker og CLI-et

Dette er verdiene for URL-parameteren `format=` og CLI-flagget `--export=` (se [URL parameters](/info/url-parameters.html) og [CLI](/info/cli.html)). Et verktøys meny viser bare formatene det verktøyet kan lage, så den er alltid kortere enn denne listen.

| Type | ID-er |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vektor | `svg` · `svgz` (gzippet SVG) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (skjærefil) |
| Side og dokument | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (Penpot-designfil) · `scorm` (kurspakke, en ZIP) |
| Bevegelse | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| Lyd | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` |
| Tekst og data | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `css` · `scss` · `gpl` (GIMP-palett) |
| Bundler og pakker | `zip` · `rpm` og `tar.gz` (gjengivelsen forseglet i en Linux-pakke) |

Noen få ID-er kommer fra et verktøys egen eksportkode: `ase` (Adobe Swatch Exchange, fra Palette Lab) og `exr` og `hdr` (rastere med høyt dynamisk område, fra Darkroom). **Convert Font** skriver `ttf`, `otf` og `woff` fra en skriftfil du oppgir, så en bar lenke har ingenting å gjengi for den.
