# Eksporter en fil

Trykk **Export**, venstre halvdel av **Export | Save**-pillen, velg et format ved siden av filnavnet og trykk **Download**. Filen opprettes på enheten din.

Filen inneholder det du ser på lerretet. Formatmenyen viser bare det dette verktøyet kan lage i denne nettleseren.

De fleste jobber trenger ett av tre formater:

| Til | Velg | Fordi |
|---|---|---|
| En skjerm, en melding eller et lysbilde | **PNG** | Alle apper kan åpne den, og den beholder en transparent bakgrunn når verktøyet tilbyr det |
| En ferdig side eller noe som skal trykkes | **PDF** | En faktisk sidestørrelse som ser lik ut på trykk; **Print PDF**, der et verktøy tilbyr det, er CMYK-versjonen for trykking |
| Grafikk som må være skarp i alle størrelser | **SVG** | Vektorformer |

::: check Sjekk filen i størrelsen den skal brukes i
Før du sender filen, åpner du den på skjermen den ble laget for eller skriver den ut i faktisk størrelse.
:::

::: details Godkjenning og levering med Lolly Work (valgfritt)
En [organisasjon som bruker Lolly Work](/info/organisation.html) kan velge hvilke formater og eksportinnstillinger medlemmene ser. Der det kreves godkjenning, erstatter **Request approval** knappen **Download**. Følg policyen som vises i instansen din.

Lolly Work kan også levere en fil til konfigurerte S3-, WebDAV- og HTTP-destinasjoner, med godkjenningstrinn, leveringskvitteringer og en revisjonspost. Leveringen sender filen til organisasjonens tjeneste. En vanlig nedlasting blir på enheten din. Personlige Send-destinasjoner og organisasjonens levering konfigureres hver for seg.

Driftsansvarlige setter opp dette med [veiledningen for organisasjonslevering](/info/work-delivery.html). For servergjengivelser og batcher i kø, se [CLI-batcher og automatisering](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

<!--i:eti-cpu-->
## Slik fungerer eksport

Tre fremgangsmåter gir en fil. De fleste verktøy **gjengir lerretet**. Tekst- og dataformater (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) **genereres fra verktøyets innhold**. Personvernverktøy som *Lolly Strip Hidden Data* **transformerer filen du valgte** på enheten din. Resultatet har ikke noe lerret, vannmerke eller tilføyde metadata.

![Tre eksportveier samles i en ferdig fil: gjengi lerretet, generer tekst eller data fra innholdet, eller transformer en valgt fil på enheten.](/info/diagrams/concepts/three-export-paths.svg)

Verktøyets forfatter velger hvilke handlinger eksportpanelet tilbyr. Standardsettet er Copy, Download og Save.

- <!--i:download--> **Download** lagrer filen. Hvis du ikke finner den etterpå, se [Finn en fil du har lastet ned](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> **Copy** legger bildet på utklippstavlen. Når en nettleser ikke kan kopiere bilder, laster Copy ned filen i stedet og gir beskjed.
- <!--i:folder--> **Save** beholder det gjeldende designet i Projects og laster aldri ned en fil. **Save as**, ved siden av **Download**, spør hvor (se [Lagre og fortsette](/info/using.html#saving-continuing)).
- <!--i:link--> **Share** åpner Share-dialogen: en lenke som gjenskaper designet, bryterne for hva som skjer ved åpning (fullskjerm, eksportpanel, nedlasting eller kopiering ved åpning) og en valgfri **Shortest link** som pakker tilstanden i et kompakt token (se [URL-modus](/info/url-mode.html)).

**Send to**, et kort i eksportpanelet, sender filen til en tjeneste du har koblet til. Etter sending til Google Drive, Nextcloud, en S3-bøtte, Dropbox eller OneDrive kan **Create a share link** lage en lenke der uten en ny opplasting. Delen **Share through your cloud** i Share-dialogen sender en `.lolly`-fil og lager lenken i ett trinn. Lenkepanelet viser hvem som kan åpne lenken, hvor filen ligger og når lenken utløper. **Links you've shared** i Share-dialogen lar deg avslutte delingen. Nextcloud-lenker kan ha passord og utløpsdato. S3-lenker varer i 1 til 7 dager og kan ikke stoppes før tiden. Lolly beholder ingen kopi av filen og ingen innloggingstoken på en server. [Personvern](/info/privacy.html#every-network-request-the-app-can-make) lister hva hver tjeneste mottar.

![Eksportpanelet - format, størrelse og handlingene Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Når et design bygger inn et annet verktøys gjengivelse, for eksempel en bildeboks i Lolly Design med en QR Code-lenke, tegnes den nestede gjengivelsen i eksporten av det overordnede designet. Den forblir vektor i SVG og PDF og rasteriseres i PNG, JPG og WebP. Den innebygde gjengivelsen får ikke eget vannmerke eller egen proveniens; bare den ferdige filen får det. Eksporter til HTML, Markdown og TXT kan ikke inneholde en sammensatt gjengivelse.

<!--i:eti-file-->
## Velg et format

Filnavnet og formatmenyen står sammen som ett `name.format`-par under **Download**.

![Filnavnfeltet er koblet til formatvelgeren, slik at eksporten fremstår som ett name.format-par](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Ta utgangspunkt i hvor filen skal brukes. Hvert kort lister formatene som passer til destinasjonen.

::: figure exporting-format-chooser
Seks destinasjoner med formatene som passer til hver av dem.
:::

Et ordmerke satt med designsystemets skrift eksporteres som SVG der hver bokstav er en omrissbane. Filen holder seg skarp i alle størrelser.

Tekst på et annet språk avhenger av skriftene du har. Når en skrift i designsystemet har bokstavene, tegner SVG og PDF dem som omriss, formet og i leserekkefølge, også linjer fra høyre mot venstre. Når ingen har dem, bruker Lolly en [reserveskrift](/info/fallback-fonts.html), og eksportkortet viser den skriften. Tekst som ingen reserveskrift dekker, forblir levende tekst i en SVG, tegnet med seerens egne skrifter. I en PDF, EPS eller WMF, og i en EMF med **Outline fonts** på, blir teksten til bilder. Ordene ser ut som på siden, men kan ikke markeres eller søkes i. Eksportkortet lister disse skriftsystemene. Legg til en skrift med disse bokstavene for å beholde dem som vektortekst.

![Et hårtynt ordmerke med vid sporing som sier Aurora, den typen ren vektorgrafikk SVG-raden i tabellen gjelder](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Alle formater og hva de brukes til
| Du vil ha | Bruk | Hvorfor |
|---|---|---|
| Skarpe logoer eller grafikk som skalerer | **SVG** | Vektor: skalerbar, liten og redigerbar; en effekt som vektoreksporten ikke kan tegne, legges inn som et bilde |
| Vektor for Office- og Windows-apper | **EMF** | Limes inn som redigerbar vektor i PowerPoint og Word, med levende tekst; Google Drive åpner filen i Google Drawings |
| Vektor for trykk og designapper | **EPS**, eller **EPS (CMYK)** | PostScript-vektor til Illustrator og arbeidsflyter for trykk |
| Vektor for skjæremaskiner | **DXF** | Laserskjærere, vinylplottere og CNC: konturbaner i millimeter |
| En redigerbar lysbildepresentasjon | **PowerPoint** (PPTX) | Tekst og former som kan redigeres direkte, med bilder og vektorer som fortsatt kan hentes ut |
| Et redigerbart tekstdokument | **Word** (DOCX) eller **OpenDocument** (ODT) | Avsnitt og overskrifter som kan redigeres videre i et tekstbehandlingsprogram (Lolly Doc Studio) |
| En layout for InDesign | **InDesign IDML (static subset)** | Tekst, rektangler, ovaler og bilder, med ett oppslag per tegnebrett (Lolly Design) |
| Et redigerbart Penpot-dokument | **Penpot** | Tavler, former, tekst og koblede tokener |
| Et foto eller et bilde til generell bruk | **PNG** (tapsfri) eller **JPG** (mindre) | Universelt rasterformat |
| Mindre moderne bilder | **WebP** eller **AVIF** | Bedre komprimering med gjennomsiktighet |
| Trykk | **PDF**, eller **Print PDF** (CMYK) | Faktisk sidestørrelse; CMYK til trykking |
| Raster for et trykkeri | **Print TIFF** (CMYK) | DeviceCMYK-piksler til en RIP |
| Animasjon for nettet | **GIF** | Spilles av overalt; større filer |
| Animasjon med full farge og ekte gjennomsiktighet | **APNG** | Animert PNG uten palettgrense |
| Animasjon med minst mulig fil | **Animated WebP** | Full farge og gjennomsiktighet, mindre enn GIF og APNG |
| Animert vektor som skalerer | **Animated SVG** | Selvstendig; går i sløyfe i en nettleser eller en `<img>`, i alle størrelser (Lottie Ad) |
| En animasjon som fortsatt kan redigeres | **dotLottie** | Former, baner og ytre transformasjonsnøkler fra tidslinjen i Lolly Design |
| Overlevering til Premiere | **Premiere XML + media** | Tidsbestemte klipp og originalmedier til Premiere (Lolly Design) |
| Video til sosiale medier og deling | **MP4** eller **WebM** | Best kvalitet i forhold til filstørrelsen (se [Video](#video)) |
| Undertekster | **SRT** eller **VTT** | Tidsbestemt tekst til en videospiller (Captions, Audiogram og Record) |
| Kringkastingsundertekster | **TTML** eller **SCC** | IMSC1.1-tidsbestemt tekst eller CEA-608-pop-on-undertekster (Captions; se [Kringkastingsundertekster](#broadcast-captions)) |
| Et opplæringskurs | **SCORM (LMS)** | Et versjonert nettsted, en SCORM-pakke eller en xAPI-pakke (se [SCORM](#scorm-course-packages)) |
| Rik tekst eller en e-postsignatur | **HTML** | Limes inn med formatering i e-postklienter |
| En animasjon som spilles i en nettleser | **HTML** | En avspiller i én fil, fra tidslinjen i Lolly Design eller Snippet (se [Video](#video)) |
| Rent innhold | **MD** eller **TXT** | Bare tekst |
| En kalenderhendelse | **ICS** | Kan importeres i alle kalenderapper |
| Et kontaktkort | **VCF** | Kan importeres i adressebøker |
| Strukturerte data til gjenimport | **JSON** eller **CSV** | Lar verktøyets innhold eksporteres og importeres igjen |
| Et favorittikon | **ICO** | Nettstedsikon i flere størrelser; **ZIP** samler flere formater |
:::

### Gjennomsiktighet

Verktøy som støtter det, har en bryter for transparent bakgrunn, for eksempel **No BG**. PNG, WebP, AVIF, SVG, APNG og Animated WebP bevarer gjennomsiktighet, og GIF beholder en skarp kant. JPG og PDF er alltid ugjennomsiktige. TIFF flates ut mot hvitt, eller mot svart ved [HDR](#hdr-bright-colours).

<!--i:eti-crop-->
## Størrelse og trykkenheter

Eksporter bruker verktøyets opprinnelige pikselstørrelse med mindre verktøyet tilbyr **dimensjoner**. Da angir du bredde, høyde og en **enhet**:

- **px** (standard) er nøyaktige piksler.
- **mm, cm, in, pt** og **pc** er fysiske størrelser. Med en fysisk enhet angir du også **DPI** (300 som standard). En **PDF** blir en ekte side i den størrelsen. Et **rasterbilde** får pikselantallet for den DPI-verdien og registrerer oppløsningen. En **SVG** beholder den fysiske enheten med en viewBox i piksler.

For et rasterbilde med høyere oppløsning skriver du inn større bredde og høyde, eller velger en fysisk enhet og øker DPI (piksler = størrelse × DPI). Bredde `210`, høyde `297` og enhet `mm` gir en A4-side.

![Dimensjonsraden satt til 210 ganger 297 mm, med DPI-feltet synlig fordi enheten er fysisk](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

<!--i:eti-images-->
## Stillbilder fra en tidsbestemt komposisjon

Fra en tidsbestemt komposisjon, for eksempel en [Sequence](/info/sequence-editor.html)-tidslinje i Lolly Design, tar en stillbildeeksport **bildet ved avspillingshodet**. Plasser avspillingshodet der du vil ha bildet og eksporter.

For flere øyeblikk bruker du **Frames**-feltet ved siden av utdatastørrelsen. Det vises bare for en tidsbestemt komposisjon og et stillbildeformat (PNG, JPG, WebP, SVG eller PDF). `1` gir bildet ved avspillingshodet. Et høyere tall gir så mange stillbilder, jevnt fordelt over sekvensen:

- PNG, JPG, WebP og SVG leveres som én ZIP: `<name>-01.png`, `-02.png` og så videre.
- PDF leveres som ett dokument med tilsvarende antall sider.

Hvert stillbilde hentes fra midten av sin del av tidslinjen, slik at det første aldri viser en halvveis inntoning og det siste aldri viser det tomme øyeblikket etter at klippene er slutt.

::: figure exporting-contact-sheet
Frames: 4 deler sekvensen i fire like deler og henter midten av hver.
:::

Bruk Frames til et storyboard, et kontaktark for gjennomgang eller en karusell for sosiale medier hentet fra en videoredigering. Antallet er begrenset til 64. Alt annet som skrives i feltet, faller tilbake til `1`. Hvert bilde er et vanlig stillbilde, så innholdsattester, Imprint, fysiske enheter og DPI fungerer som ved én eksport. En eksportlenke, CLI og MCP ber om det samme arket med `cuts=` (se [Kontaktark](/info/url-export.html#contact-sheets)).

<!--i:eti-copy-->
## Mange filer samtidig

Lolly har tre måter å arbeide med store mengder på:

::: cols
## En tabell blir ett dokument
Et verktøy laget for å paginere tabellinndata gjør hver rad til en side. Lim inn en tabell fra regnearket ditt for å få én PDF. For å rette rader redigerer du regnearket og limer inn på nytt. Battlecards er referanseverktøyet. Det ligger i mappen `community` med åpen kildekode og er ikke oppført på lolly.tools.
## En CSV blir én fil per rad
**Batch** (`#/batch`) tar imot en CSV og gjengir én eksport per rad, for eksempel navneskilt eller diplomer, levert i en ZIP. Se [Lolly Batch](/info/batch.html#make-many-versions-of-one-design).
## Flere design får én redigering
**Lolly Multi-edit** åpner flere lagrede økter side om side for å gjøre den samme endringen i hver. Se [Lolly Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Et verktøy med flere sider, som Booklet, Print Sheet, Lolly Doc Studio eller Lolly Markdown Slides, eksporterer PNG, JPG, WebP, SVG og de andre formatene for enkeltbilder som én fil per side, i en ZIP når det er flere. Print Sheet beholder hele arket og skjæremerkene ved valgt DPI.

Fra **Projects** eksporterer **Render folder** hver lagrede økt i en mappe og undermappene som én ZIP med mappestruktur. **Render selection** gjør det samme for et flervalg. Én lagret økt gjengis til sin egen fil. Projects kan også dele en lagret økt på nytt som en verktøylenke som åpner økten med de samme innstillingene.

<!--i:eti-pen-->
## Filer som kan redigeres videre andre steder

Noen formater overfører arbeidet ditt til et annet program som redigerbart innhold i stedet for et bilde.

### PowerPoint (PPTX)

Lolly Design, Lolly Markdown Slides, Booklet, Lolly Doc Studio, Lolly Chart, Diagrams, Flow Chart og Agenda eksporterer en PowerPoint-presentasjon med ett lysbilde per side. Hver side deles opp i programmets egne objekter som en kollega kan redigere og hente ut:

- <!--i:font--> **Tekst** blir redigerbare tekstbokser i PowerPoint med layoutens skriftstørrelse, farge, vekt, kursiv og justering. En Lolly Design-presentasjon angir merkevarens skrifttype for hvert tekstsegment, selv uten en lysbildemal.
- <!--i:pentool--> **Vektorer** som logoer og ikoner bygges inn som SVG-bilder, og PowerPoint kan bruke *Convert to Shape* på dem.
- <!--i:photos--> **Bilder** overføres som separate bilder i opprinnelig oppløsning. Et beskåret hovedbilde beholder hele bildet bak beskjæringen. Alle filtre eller blandinger på et bilde bakes inn.
- <!--i:layers--> **Bakgrunner, kantlinjer og skillelinjer** blir rektangel- og linjeformer. Sirkler, ellipser og piller fra Lolly Design forblir programmets egne redigerbare former.

![Eksportpanelet med PowerPoint valgt: ett lysbilde per side, tekst og former beholdes redigerbare](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Layouten er omtrentlig. Alt gjennomgangsmotoren ikke kan uttrykke med programmets egne objekter, som et komplekst filtrert eller maskert område, bygges inn som et bilde. En presentasjon har én lysbildestørrelse, hentet fra den første siden.

PowerPoint er også en vei inn: [Gi en presentasjon ny profil](/info/rebrand.html) flytter en presentasjon over til designsystemet ditt, og [Importer et design](/info/design-import.html) åpner en i Lolly Design.

### Penpot

De fleste verktøy som eksporterer SVG, eksporterer også en **Penpot-fil** (`.penpot`).

| Hva du laget | I Penpot |
|---|---|
| Tekst | Redigerbare tekstobjekter |
| Former, baner, gradienter og bilder | Redigerbare vektorformer |
| En farge eller skrift fra et designsystemtoken | En levende tokenkobling: rediger tokenet, så følger hver form som arver det |
| Hele designet | En gjenbrukbar komponent i Assets-panelet |
| En kompleks illustrasjon eller et levende lerret | Et innebygd bilde; innholdet rundt er fortsatt redigerbart |

Fra Lolly Design blir hver ramme en Penpot-tavle. Designsystemets farger og typografier legges i Assets-panelet og hele tokensettet i Tokens-panelet. Penpot beholder sin egen kopi. Et token redigert i Penpot kommer tilbake gjennom importen i [Lolly Design System Setup](/info/brand-studio.html).

![Eksportpanelet med Penpot valgt: .penpot-filen og Send to Penpot ved siden av nedlastingen](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

For å åpne filen starter du Penpot, velger et prosjekt og deretter **Import**. Hvis du logger inn på Penpot fra eksportpanelet, importerer **Send to Penpot** filen for deg.

### Word, OpenDocument og InDesign

**Lolly Doc Studio** eksporterer **Word** (DOCX) og **OpenDocument** (ODT) med redigerbare avsnitt og overskrifter. Word-filen angir merkevarens skrifter og tekstfarge gjennom dokumentets stiler, følger sidestørrelsen du velger og legger til en PNG ved siden av en SVG-logo for apper som ikke kan tegne SVG.

**Lolly Design** eksporterer **InDesign IDML (static subset)**: tekst, rektangler, ovaler og PNG- eller JPEG-bilder, ett oppslag per tegnebrett. Støttet formatering inne i teksten forblir redigerbar, bilder følger med i `Links` og koordinater blir InDesign-punkter. Det kan bli nødvendig å se over nye koblinger, skrifterstatning og endret tekstbryting. Effekter, animasjon, sammensatte tekstforløp og geometri som ikke støttes, stopper eksporten med en rapport som lister dem. IDML bevarer ikke originaldokumentet. Send PDF for ferdig grafikk.

### Tidslinjer: dotLottie og Premiere

Fra tidslinjen i Lolly Design skriver **dotLottie** en animasjon som fortsatt kan redigeres i Lottie-verktøy; [Lottie-animasjoner](/info/sequence-editor.html#lottie-animations) lister hva som bevares. **Premiere XML + media** pakker tidsbestemte klipp og originalmediene deres for Premiere; se [Premiere XML-utveksling](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (kurspakker)

Kurseksport er av til du slår på **Training and courses** under Settings → Preferences → Feature flags.

Velg deretter **Export course** fra et støttet verktøy, en prosjektmappe eller et utvalg. I Lolly Design åpner **SCORM (LMS)** og **Download** den samme kursarbeidsflyten. Lolly lagrer arbeidet, viser kursinnholdet og rekkefølgen for gjennomgang og åpner deretter modulen og eksportdialogen.

- <!--i:layers--> Velg en gjengivelse for hver kilde: stillbildesider, bevegelse som video, lyd eller en nedlastbar ressurs. Legg til leksjonstekst og lesealternativer i modulen.
- <!--i:clock--> Forhåndsvis kursavspilleren og gå gjennom beskrivelser og undertekster. Bevegelse, også lydløs animasjon, tas med som video.
- <!--i:document--> Velg Website, SCORM 1.2, SCORM 2004 4th Edition eller et eksperimentelt xAPI-mål. Sjekk innholdet og ZIP-størrelsen, og lagre og last deretter ned den kontrollerte versjonen.
- <!--i:check--> Fullføring krever at du bekrefter hver obligatoriske leksjon og velger Finish.

![Eksportpanelet på en Lolly Design-presentasjon med SCORM (LMS) valgt](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Pakken inneholder det ferdige innholdet og trenger ingen Lolly-konto. Legg en Website-ZIP på en HTTP(S)-vert; importer en LMS-ZIP uendret. Test destinasjonen før du deler kurset. For et kurs bygget av flere lagrede arbeider, se [Lag et opplæringskurs](/info/training-creators.html).

### Kringkastingsundertekster

Captions-verktøyet kan også eksportere **TTML** og **SCC**. Begge skrives fra den samme listen over tidsbestemte tekstsegmenter som SRT- og VTT-filene, så ordene og tidene samsvarer.

- **TTML** er IMSC1.1 Text Profile, med klokketider i medietid og ett område nederst i midten. Det inneholder ikke farge, skrift eller posisjon per undertekst, fordi Lollys undertekster bare inneholder start, slutt og tekst.
- **SCC** inneholder CEA-608-pop-on-undertekster på kanal 1 ved 29,97 bilder per sekund med drop-frame-tidskode. Det støtter de grunnleggende nordamerikanske tegnene samt spesialtegnene og de utvidede tegnene. Hvis en undertekst har et tegn som ikke finnes i settet, stopper eksporten og oppgir hvilket tegn. Hver undertekst brytes til 32 kolonner og høyst 15 rader. En undertekst som ikke kan lastes før starttidspunktet, forsinkes med noen bilder.
- Roll-up- og paint-on-undertekster skrives ikke.

::: note SCC er ikke sjekket i et kringkastingsverktøy
Det er heller ikke prøvd på en maskinvaredekoder. Test en fil i din egen behandlingskjede før levering.
:::

### DXF (skjærefiler)

Lolly Asset Export, Diagrams, Growth, Lolly Logo Wall, QR Code, Street Map, Wayfinding og Wordmark eksporterer **DXF**, AutoCAD R12-utvekslingsformatet som laserskjærere, vinylplottere og CNC-programvare leser. Geometri skrives som konturbaner i millimeter, og tekst gjøres om til omriss. Farge tilordnes nærmeste AutoCAD Color Index, som vanligvis styrer skjæremaskinens operasjon. DXF inneholder bare strekgrafikk: et fotografisk eller filtrert område har ingen skjærebane og utelates med en advarsel. Bruk SVG eller PDF for å beholde rasterinnhold. Tekst som ingen skrift dekker, heller ikke en [reserveskrift](/info/fallback-fonts.html), stopper eksporten med en melding som siterer teksten.

Et Street Map-design består bare av streker, så hver vei og kanal blir en skjærebane.

::: showcase
![En Street Map-gjengivelse av Paris i blekk på kremfarget bakgrunn - ren strekgrafikk, så hver strek bevares på veien til en skjæremaskin](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Rull, så trekker kameraet seg tilbake gjennom geometrien: sju baner og ingen piksler. En skjæremaskin leser den samme filen.
:::

<!--i:eti-stamp-->
## Trykk

**Print PDF** skriver CMYK etter en navngitt trykkbetingelse, **Coated FOGRA39** som standard. Merkevarens fargeprøver med målte blekkverdier beholder disse verdiene. Andre farger konverteres gjennom en trykkprofil: Lollys egen Coated FOGRA39-profil som standard, eller din egen profil når du velger profilens **Embed**-rad. Gråtoner og svart blir bare på svartplaten, så liten tekst ikke kan få passerfeil. FOGRA51, SWOP og GRACoL bruker en standard enhetskonvertering. Svart tekst overtrykker også fargen under, slik at en litt feiljustert trykkpresse ikke etterlater en hvit kant rundt bokstavene. **Print TIFF** skriver DeviceCMYK-piksler til en RIP. Colour profile-kontrollen styrer begge ([Fargeprofiler](#colour-profiles)). Print TIFF og **EPS (CMYK)** separerer fargene gjennom samme trykkprofil som Print PDF.

**Print marks & bleed** har et eget kort for trykkformatene: utfall i millimeter samt Crop, Registration, Bleed, Colour bars og Stamp details. Stamp details skriver datoen, verktøyet og navnet ditt i margen. Et navn eller verktøynavn med bokstaver som margskriften mangler, som arabisk, kinesisk, kyrillisk eller en emoji, tegnes som et bilde i samme gråfarge. Eksportkortet lister disse skriftsystemene.

Noen verktøy, som *Booklet*, bygger en **PDF med flere sider**: en forside, innhold som flyter over så mange sider som trengs og en bakside. Hver side er en ekte stående PDF-side i A4, US Letter eller A5. Du kan tvinge en hvilken som helst blokk over på en ny side. Dette er RGB-dokumenter uten skjære- eller utfallsmerker; disse merkene hører til Print PDF med én side. En Lolly Design-PDF kan også være et **Notes handout**: en stående side for hvert lysbilde med foredragsnotatene under.

**Før du eksporterer.** Et **Before you export**-kort nederst i panelet viser hva et trykkeri vil se: format, størrelse og utfall, beskjærings- og utfallsområder, fargedekning, antall plater og sideantall, med en vurdering ved siden av overskriften. Kortet blokkerer aldri en eksport. Lolly Design viser alltid kortet med sine egne sjekker, inkludert designsystemets merkevareregler lag for lag og skrivesignalet for dokumentets tekst ([Før du eksporterer](/info/design.html#before-you-export)). Lolly Design legger til disse trykksjekkene når **Print preflight** er på. I andre verktøy slår du på **Print preflight** under Settings → Preferences → Feature flags. Det er av som standard, og en Lolly Work-instans kan slå det på for medlemmene sine.

**Etter at du har eksportert.** Lolly leser den ferdige filen tilbake og sammenligner den med det du valgte: format, piksel- eller sidestørrelse, klipplengde, transparent bakgrunn, CMYK-farge, HDR, Content Credentials og et PDF- eller ZIP-passord. Alt som avviker, skrives på eksportkortet. Hver måling kommer fra filen, aldri fra innstillingen. En egenskap filen ikke kan gi svar om, regnes ikke som et samsvar. Kommandolinjen skriver hele sammenligningen med `--export-report` (se [Gjengi med CLI](/info/cli-rendering.html)).

::: details Tilgjengelighetssjekker for PDF fra kommandolinjen
**Tilgjengelighetssjekker for PDF.** For en PDF lister kommandolinjen også 32 tilgjengelighetssjekker i `--export-report`-filen, under `pdfAccessibility`. Hver sjekk har en ID, en enkel beskrivelse, et utfall og hvor i filen den fant et problem:

- **Passed**: sjekken undersøkte noe og fant ingen feil.
- **Failed**: sjekken fant et problem. Sidetallene eller taggene er oppført.
- **Not applicable**: filen hadde ikke noe av den typen å undersøke, for eksempel tabellsjekker i en fil uten tabeller. Dette sier ingenting om filen.
- **Needs a person**: seks sjekker kan ikke vurderes av et program (leserekkefølge, fargekontrast, blinking, skript, tidsgrenser og gjentatte lenker).

Listen er ingen endelig vurdering. Den sier ikke at en PDF oppfyller PDF/UA eller at personer som bruker hjelpemiddelteknologi, kan bruke PDF-en. En person må fortsatt sjekke filen med en skjermleser. Lollys egne PDF-er består ikke taggsjekkene i dag, fordi eksportfunksjonene ennå ikke skriver tagger. Sjekken leser filen på enheten din og endrer ingenting. Filer som krever passord, oppføres som ikke sjekket, ikke bestått. For å sjekke en PDF du har fått tilsendt, slipper du den i [Lolly Strip Hidden Data](/info/utilities.html), som viser den samme listen under **PDF accessibility checks**.
:::

Sjekkene i Inspector i Lolly Design og merkevaresammenligningen i Lolly Design System Setup undersøker designet. Disse to kortene undersøker filen.

::: details Kostnad fra en prisliste
Under forhåndskontrollen gjør et kostnadskort de samme tallene om til penger, selv når forhåndskontrollkortet er av. Det trenger to ting: en jobb en prisliste kan prise (plater, ark, areal, sider, variantrader eller utdatafiler, så en enkel logo-PNG viser aldri kortet) og en **prisliste**, en JSON-prisliste fra trykkeriet ditt. En standardversjon inneholder ingen prisliste og har ingen måte å laste inn en på i appen. En prisliste kommer som en katalogressurs levert med en instans, eller gjennom den valgfrie prislisteutvidelsen som en selvdrifter eller et kontrollplan slår på. Uten en prisliste vises ingenting.

Hvert beløp er en pris du har oppgitt, ganget med en mengde Lolly har telt, for eksempel `4 plate × €35.00`. Totalen viser kilden: utstederen i prislisten og datoen for prisene. Det finnes ingen standardvaluta og ingen plassholderpris. Det filen sier om seg selv, forblir gjengitte utsagn: *«Filen sier: … Lolly har ikke bekreftet dette.»*

Når et beløp ikke kan beregnes, trekkes tabellen tilbake i stedet for å fylles ut:

- Linjer som prislisten ikke priser, betyr **ingen total i det hele tatt**, bare en overskrift som sier hvor mange som mangler pris.
- En mengde som er en øvre grense, tar med **«opptil»** i delbeløpet.
- Priser som har passert gyldighetsdatoen, viser **bare antall** til du trykker *Use these rates anyway*; utløpsdatoen blir da stående ved beløpet.
- Ved åpning gjennom en **lenke** forblir beløp skjult til du ber om dem på denne enheten. CLI tar imot `--rate-card=<file.json>` som en lokal fil og aldri som en lenkeparameter.

Kortet fjernes fra hvert eksporttrinn og endrer aldri filen. Det er en beregning, ikke et pristilbud. Bare trykkeriet ditt kan gi et pristilbud.
:::

<!--i:eti-film-->
## Bevegelse og lyd

### Video

Animerte verktøy eksporterer **MP4** og **WebM**. En delt `?format=`-lenke som ber om et beholderformat denne nettleseren ikke kan lage, faller tilbake til den andre, med et tilsvarende filnavn. **Start after** holder lerretet stille slik at animasjoner og skrifter stabiliseres før opptak. **Duration** angir lengden på det ferdige klippet. **Motion blur** (Off, Draft quality, Standard eller High, med en **Shutter angle**) gjør raske bevegelser uskarpe og gjengivelsen tregere. Der nettleseren støtter det, tar **Record live** opp forhåndsvisningen på skjermen i sanntid gjennom skjermdeling.

![Tidsinnstillingene for en animert eksport: Start after, Duration, Motion blur med Shutter angle og Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** velger Smaller file, Balanced eller Best quality. **Advanced** åpner **Codec**, **Frame rate**, **Rate mode** og **Hardware acceleration**. Der et verktøy har undertekster, velger **Captions** et **Embedded track** eller en **Sidecar .vtt + .srt** ved siden av videoen. En lenke tar med kvalitet, kodek, bildefrekvens, varighet og startforsinkelse som `vq`, `codec`, `fps`, `seconds` og `wait` ([URL-parametere](/info/url-parameters.html)).

Videoeksporter beholder lyden. Et verktøy kan legge **bakgrunnsmusikk** under klippet: en lydressurs som gjentas eller trimmes til klipplengden, med inn- og uttoning, volum og demping under opptakets egen lyd. Opptaksverktøyene tar med direktelyden i filen.

En klikkstyrt Lolly Design-presentasjon kan også eksporteres som video. **Export slides as video** i Present-menyen åpner eksportpanelet med MP4. Hvert lysbilde spilles av i sin egen visningstid, eller i eksportpanelets Duration når det ikke har noen. Presentasjonens lysbildeovergang spilles mellom lysbildene som en overtoning. Dokumentet endres ikke.

**HTML** fra et tidsbestemt Lolly Design-dokument, eller fra Snippet, er en avspiller i én fil: kontroller for avspilling, spoling og lyd over animasjonen, med støttede skrifter, bilder og lyd innebygd. Filen spilles av uten nett. En Lolly Design-film med scener legger til en meny over scenene. En sekvens med et video-, Lottie- eller 3D-klipp kan ennå ikke eksporteres som HTML; eksporter sekvensen som video.

### Animerte bilder

**GIF** spilles av overalt og passer til chat og e-post; det er større og har færre farger enn video. **APNG** og **Animated WebP** bevarer full farge og gjennomsiktighet. **Lottie Ad** eksporterer også **Animated SVG**: vektorbilder med innebygde CSS-nøkkelbilder som skalerer til alle størrelser og går i sløyfe i en nettleserfane eller en `<img>` uten kodek. Teksten gjøres om til omriss. Standard bildefrekvens er lavere fordi hvert bilde er tyngre enn et punktgrafikkbilde. Alle disse er lydløse.

### Lyd

Noen verktøy eksporterer lyd alene. **Lolly Voice Recorder** tar opp fra en mikrofon med en nivåmåler i sanntid og lagrer opptaket som **MP3**, **WAV**, **M4A (AAC)** eller **Opus (WebM)**, kodet på enheten din. `wav`, `mp3`, `m4a` og `opus` er vanlige format-ID-er, så en lydeksport er like enkel å dele og styre med skript som en PNG.

Ressursvelgeren godtar mange lydformater for bakgrunnsmusikk, fra MP3 og FLAC til MIDI og trackermoduler; [Formater](/info/formats.html) lister dem. En [Lolly Rondocode-sang](/info/rondocode.html) spilles av med varigheten klippet ber om.

<!--i:eti-palette-->
## Farge og HDR

Lolly leser alle moderne CSS-farger, beregner farger ut fra hvordan de oppfattes og skriver hver fil i et fargerom en leser kan åpne: sRGB for skjermer, CMYK for trykk og Rec.2100 PQ for HDR ([Farge i motoren](/info/colour-engine.html)). Et Lolly Design-dokument satt til **Wide colour / HDR** følger sine egne regler: se [Redigering med stort fargerom og HDR](/info/hdr-editing.html).

### Fargeprofiler

Eksporter merkes med en fargeprofil, slik at apper med fargestyring, som trykkerienes apper, Photoshop og nettlesere, leser fargene slik du så dem. Miniatyrbilder og forhåndsvisninger utelater merkingen for å holde filene små.

- **PNG og JPG** har en innebygd **sRGB**-ICC-profil, fargerommet forhåndsvisningen tegnes i. Pikslene merkes, de kodes ikke på nytt.
- **Print PDF (CMYK)** oppgir trykkbetingelsen i sin *OutputIntent*, som forteller trykkeriet hvordan CMYK-fargene er ment å leses.
- **Print TIFF (CMYK)** skriver umerkede DeviceCMYK-piksler og registrerer trykkbetingelsen i TIFF-metadataene. En TIFF kan ikke bygge inn en trykkprofil, så en **Embed**-rad registrerer bare profilens navn.
- **TIFF (RGB)** er den ukomprimerte sRGB-versjonen for arkivering eller videre redigering og tilbakeføring. Begge TIFF-variantene er bare tilgjengelige på datamaskin, fordi nettlesere ikke kan forhåndsvise en TIFF.
- **SVG**, **EMF**, **EPS** og **DXF** er vektorer uten innebygd profil: SVG-fargene er sRGB, EMF og EPS bruker enhets-RGB, **EPS (CMYK)** skriver DeviceCMYK og DXF bruker AutoCAD Color Index. SVG, EPS og DXF gjør tekst om til konturbaner. EMF beholder tekst levende og redigerbar i Office og Google Slides og gjør bare segmentene formatet ikke kan uttrykke, om til omriss. Eksportpanelets **Outline fonts**-valg tvinger frem baner overalt, som `_text=outline` i en lenke og `--text=outline` på kommandolinjen. SVG gjenskaper også CSS-boksskygger, både indre og ytre.

::: details PDF/X-4 og din egen trykkprofil
Lolly leveres med én CMYK-profil, tilpasset Fogras FOGRA39-karakteriseringsdata og utgitt under CC0, og konverterer farger gjennom den for standard trykkbetingelse. Profilen bygges ikke inn, fordi den er ICC-versjon 4.3 og PDF/X-4 godtar versjoner til og med 4.2. En navngitt trykkbetingelse skriver derfor utdatabetingelsen uten å hevde samsvar med PDF/X-4.

Last inn din egen CMYK-profil og velg profilens **Embed**-rad i Colour profile-kontrollen. Den bygges inn som filens *DestOutputProfile*, og PDF-en oppgir samsvar med PDF/X-4 når resten av filen tillater det. Trykkbetingelsen som oppgis, leses fra profilen: et registrert navn når profilen dokumenterer et slikt, eller `Custom` under profilens eget navn.

Tre ting hindrer samsvarspåstanden mens utdatabetingelsen beholdes: RGB-grafikk CMYK-trinnet ikke klarte å konvertere, krediteringsteksten `prov` i korrekturmargen (tegnet med en standardskrift som ikke er innebygd) og et **Strong**-passord, siden PDF/X-4 forbyr kryptering. Hver PDF inneholder også PDF/X-4-metadata: sidebokser, XMP, en dokument-ID og en sRGB-utdatabetingelse med tilhørende profil.
:::

### Spesialfarger som prosessfarger

Et designsystem kan gi en farge en spesialfarge, for eksempel en Pantone- eller HLC-farge. **Print PDF** trykker da fargen på en egen plate. Lolly Demo gir hver farge en spesialfarge unntatt de hvite fargene Sugar og Daylight og den svarte fargen Void. En Print PDF laget i Lolly Demo trykker de fleste fargene på spesialfargeplater og svart på den svarte platen.

For en vanlig firefargefil merker du av for **Print spot inks as process** på Profile-kortet i eksportpanelet. Hver spesialfarge trykkes da med cyan, magenta, gult og svart, med CMYK-blandingen designsystemet gir fargen. En farge uten egen blanding bruker trykkprofilens konvertering, som alle andre farger i grafikken. Filen har da bare de fire prosessfargeplatene. Valget er av som standard. Panelet viser avkrysningsboksen bare for **Print PDF**, og bare når designsystemet gir en farge en spesialfarge.

Etterbehandling er ikke trykkfarge. Folie, preging, nedpreging, punktlakk, soft touch, stansing, rilling og perforering beholder sine egne navngitte plater når boksen er merket av, fordi etterbehandling trykt som prosessfarger ville legge den svarte masken på siden.

Kortet **Before you export** og `lolly preflight` teller platene filen vil ha. Når boksen er merket av, teller de de fire prosessfargeplatene og eventuelle etterbehandlingsplater og sier at spesialfargene trykkes som prosessfarger og ikke legger til plater. Når boksen ikke er merket av, teller de opptil én spesialfargeplate for hver spesialfarge designsystemet gir. En prisliste priser disse antallene, så den priser aldri en spesialfargeplate filen ikke vil ha.

**Print TIFF** og **EPS (CMYK)** har ingen navngitte plater, så de trykker alle trykkfarger som prosessfarger uansett dette valget. For disse to formatene teller kortet og `lolly preflight` de fire prosessfargeplatene og aldri en spesialfarge- eller etterbehandlingsplate. Etterbehandling legges inn som sin svarte maske på den svarte platen, og kortet rapporterer dette som en feil.

En lenke ber om den samme filen med `_spots=process`, kommandolinjen med `--spots=process`, [MCP-serveren](/info/mcp.html) med `spots: "process"` og terminalappen med raden **Spot inks**. Ingenting om valget skrives inn i filen: bare trykkfargene endres.

### HDR (lyssterke farger)

Kortet **HDR** i eksportpanelet gjør vanlig grafikk lysere for HDR-skjermer. For å bevare HDR-originaler gjennom redigeringen, se [Utvidet fargerom og HDR-redigering](/info/hdr-editing.html).

En vanlig eksport er sRGB: en mettet profilfarge er like lys som skjermens vanlige hvitfarge. En HDR-skjerm kan lyse sterkere. Kortet **HDR** løfter profilfargene og hvit tekst mot maksimal lysstyrke. Mørke områder forblir mørke.

![HDR-kortet i eksportpanelet, slått på, med kontrollene White / Reach / Dark lift / Focus synlige under det](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formater.** PNG, JPG, AVIF og TIFF. WebP er 8-bit uten en fungerende måte å dekode HDR på, og vektorer og PDF har ingen HDR-modell.
- **Av som standard**, fordi det endrer pikslene. Merk av på kortet, eller send `hdr=1` i en delingslenke.
- **Kontrollene.** **White** (taket for maksimal lysstyrke, 400 til 2000 nits), **Reach** (hvor langt ned i tonene gløden sprer seg), **Dark lift** (hvor mye de mørke tonene lysnes; `0` holder dem mørke) og **Focus** (hvor mye fargemetning løftet bevarer). De følger med som én verdi: `hdr=1600-60-0-50` er White 1600, Reach 60, Dark lift 0 og Focus 50.
- **Det som skrives.** PNG får 16-bit Rec.2100 PQ med en `cICP`-blokk. JPG er en ISO 21496-1 JPEG med forsterkningskart: et vanlig SDR-bilde med et vedlagt forsterkningskart. AVIF får en omskrevet `colr`-boks. TIFF får PQ-piksler med en generert ICC v4-profil som inneholder en `cicp`-tagg. TIFF flates ut mot svart, fordi hvitt er koden for 10 000 nits i PQ og ville lagt en lys rand rundt hver kant. Løftet følger perseptuell lyshet (OKLab) og beholder fargetonen, så en grønn profilfarge blir lysere, ikke mintgrønn.
- **Der gløden vises.** Fargestyrte visningsprogrammer på en HDR-skjerm: Preview, Quick Look og Safari på Apple-enheter, eller Chrome på en HDR-skjerm. En SDR-skjerm viser et vanlig bilde.
- **Fra terminalen.** `--hdr=1` med `--export=png` eller `--export=jpg` skriver den samme PNG-filen og JPEG-filen med forsterkningskart via [CLI](/info/cli.html) med de samme koderne i motoren, uten nettleser. AVIF og TIFF kan foreløpig bare eksporteres fra nettappen.

::: warning Mange plattformer fjerner HDR-signalet
En plattform som koder opplastinger på nytt, kan gjøre bildet mørkt eller utvasket. Bruk HDR der du styrer destinasjonen, som på ditt eget nettsted, en videovegg eller en presentasjon på en lyssterk skjerm.
:::

<!--i:eti-badge-check-->
## Hva som følger med filen din

En ferdig fil kan ha flere oppføringer. Noen ligger ved siden av pikslene og forsvinner når filen lagres på nytt, tas skjermbilde av eller renses. To merker ligger i pikslene.

::: figure exporting-what-travels
Hvor hver oppføring ligger, om den er på som standard og hvilken lenkeparameter som styrer hver av dem.
:::

Eksportpanelet samler **Licence**, **Source credits**, **Password**, **C2PA Credentials**, **Lolly Imprint** og **Durable credential** i én **Content protection**-gruppe som bare viser kortene det valgte formatet kan bruke. Gruppen åpnes av seg selv når en lenke eller et dokument allerede oppgir en lisens, eller når en kilde krever en avgjørelse fra deg. Kortet **Design system** blir utenfor gruppen, synlig ved hver eksport.

![Content protection-gruppen åpnet for en PNG-eksport, med bare kortene som gjelder for den](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Proveniens & vannmerke

Der formatet har feltene, inneholder eksporter **proveniensmetadata**: programvaren, kilden, verktøyets navn og krediteringslinjen fra profilen din, skrevet inn i PNG iTXt, JPEG EXIF, PDF-info, SVG `<metadata>` eller en GIF-kommentar. De registrerer bare opphav. Ingenting lastes opp. **Experimental**-verktøy setter også et synlig vannmerke. Vertsprogrammet legger på vannmerket, så redigering av verktøyet kan ikke fjerne merket.

**Lolly Imprint** er et usynlig pikselvannmerke, **på som standard**. Det overlever rekomprimering, så en kopi kan fortsatt gjenkjennes som laget med Lolly. Det er et hint, ikke en kryptografisk garanti, og det inneholder ingen personopplysninger. Det skrives i JPEG XL, PNG, JPG, WebP, AVIF, TIFF og BMP, og i rasterbildene Lolly gjengir i en PDF eller PPTX, aldri i et bilde du har bygget inn. Fjern avmerkingen for **Lolly Imprint** eller send `imprint=0` for å utelate Imprint. Hvor godt AVIF overlever ny koding, er ennå ikke kalibrert. [Lolly Verify](/#/verify) oppdager Imprint på enheten din; se [Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**Durable credential** skriver Lollys id inn i pikslene med en nevral modell på enheten i TrustMark-formatet, slik at koblingen «laget med Lolly» overlever fjerning av metadata og ny koding og kan leses av verktøy som støtter TrustMark. Det er **av som standard**, fordi det krever én kjøring av den nevrale modellen per eksport og en engangsnedlasting av modellen. Det dekker PNG, JPG, WebP, AVIF og TIFF. Merk av i panelet eller send `durable=1`. Skrivebords- og mobilappene skjuler kortet, fordi de ikke har noen opprinnelsesadresse å hente modellen fra uten nett.

**Licence.** Velg hvordan andre kan bruke arbeidet ditt: *None (all rights reserved)* som standard, CC0 1.0, Public Domain Mark 1.0 eller en Creative Commons 4.0-lisens (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). Lisensnavnet og en lenke til lisenssammendraget legges i filens lisensmetadata (EXIF, XMP og RIFF der formatet har dem) og dens Content Credential. Valget lagres med dokumentet og følger med i en lenke som `licence=`. Lolly skriver lisensen du valgte. Lolly kontrollerer eller håndhever ikke vilkårene. Et verktøy med sitt eget lisensfelt, som Claim, beholder det feltet i stedet.

### Oppføringen om designsystemet

En eksport registrerer designsystemet som laget filen: navnet, den publiserte versjonen den ble tegnet fra (når det ikke er arbeidsversjonen) og [fargevarianten](/info/colourways.html) den ble tegnet i. Alle andre temavalg et designsystem oppgir, som en tetthet, registreres på samme måte. Valget mellom lyst og mørkt utelates, fordi bildet allerede viser hva som ble brukt.

**Du ser oppføringen før noe skrives.** Kortet **Design system**, merket av som standard, viser de nøyaktige ordene filen vil inneholde, som *Registrerer: Acme · Fargevariant: Beach*, og beskrivelsen. Et designsystems navn er det eierne skrev inn, og kortet viser navnet slik det er skrevet. Fjern avmerkingen på kortet for å utelate oppføringen fra den eksporten. Dokumentpanelet i Lolly Design viser de samme ordene under *Embedded in exports*.

**Beskrivelsen oppgir fargevarianten ved siden av verktøyet.** Når kortet er merket av, blir *"Laget med https://lolly.tools : Chart"* til *"Laget med https://lolly.tools : Chart (fargevarianten Beach)"*. Designsystemets eget navn blir i oppføringen, ikke beskrivelsen. En beskrivelse uten verktøynavn, eller en som et verktøy skriver fra sine egne inndata, forblir uendret. Et verktøy som ignorerer fargevarianter gjennom `tokenAxes`, registrerer ingen, og krediteringen på PDF-korrektur (`prov`-trykkmerket) følger samme regel.

::: details Merkevareferdigheter, merkevaresider og partnerbedrifter i oppføringen
**Merkevareferdigheter som veiledet en agent.** Når en agent laget arbeidet og navnga [merkevareferdighetene](/info/brand-skills.html) den leste og fulgte, lister oppføringen også hver ferdighet med revisjonen, som *Veiledet av: acme-brand 1.0*. Ordene betyr at ferdigheten veiledet arbeidet. Lolly tester ikke arbeidet mot en ferdighet. Bare agentens egen opplysning legger til listen. I dag er dette argumentet `brandSkills` til [MCP-serverens](/info/mcp.html) `lolly_render`, så arbeid laget i appen eller fra en delingslenke inneholder ingen. Content Credential inneholder listen som `brandSkills`, én JSON-verdi med hver ferdighets id, navn, revisjon og SHA-256-hash. XMP-pakken og SVG-metadataene inneholder samme verdi som `lolly:BrandSkills`. En PDF skrevet fra oppføringen får ett nøkkelord per ferdighet. Beskrivelsen er uendret. Teksten til en intern ferdighet registreres aldri. De samme bryterne utelater listen sammen med resten av oppføringen: kortet **Design system**, `_madewith=0`, `--no-madewith` og `madeWith: false`. Når MCP-serveren tegner filen i en nettleser (en PDF, en JPEG og de andre formatene den nettleserfrie metoden ikke kan skrive), inneholder filens egne metadata ingen liste. Bare en Content Credential kan inneholde listen der. Send `c2pa` for å beholde oppføringen. Uten en attest advarer gjengivelsen om at merkevareferdighetene ikke ble registrert.

**Merkevaresiden, når utgiveren velger det.** Utgiveren av et designsystem kan velge å registrere adressen til [merkevaresiden](/info/brand-page.html#lead-back-from-your-files) sin i eksporter. Innstillingen gjelder per designsystem og er av som standard. Kortet legger da adressen til på samme linje, som *Registrerer: Acme · Fargevariant: Beach · Merkevareside: https://acme.example/brand/acme/*. Når du fjerner avmerkingen på kortet, fjernes adressen sammen med resten. Oppføringen inneholder adressen og ingenting annet om siden. Ingenting annet i filen endres. Et designsystem uten adresse skriver samme fil som før.

**Adressen følger ikke med en pakke.** En oppføring i en signert fil leses som signatarens egen. En adresse må ikke slå seg på av seg selv for noen som ikke valgte den adressen, og en pakke må ikke kunne peke andres filer til en side den selv velger. En `.lolly`-pakke, en kopi eller forgrening av et designsystem, **Try these colours**, en gjenopprettet sikkerhetskopi og en tokenfil gitt for én kjøring kommer alle med innstillingen av. Du kan slå på innstillingen selv, med en adresse du skriver inn. Et administrert designsystem er det eneste unntaket: det beholder adressen administratoren satte i kildetokenene. [Led tilbake fra filene dine](/info/brand-page.html#lead-back-from-your-files) har detaljene.

**Partnerbedriften, i et partnerprogram i Lolly Work.** Et arbeid laget for en partnerbedrift registrerer bedriften og programmet på samme linje, som *Registrerer: Acme · Fargevariant: Beach · Partner: Northwind IT (Forhandlere, EMEA)*, med revisjonen av bedriftsopplysningene i filen. Oppføringen inneholder ingen person, kontaktopplysninger, adresse eller valuta. Når bedriftens partnerpakke er vedlagt, legger linjen til pakkens revisjon, som *, pakkerevisjon 2*, og attesten inneholder pakkens id og revisjon, aldri fargene eller reglene. Når du fjerner avmerkingen på kortet, fjernes partneren sammen med resten av oppføringen. En PDF får nøkkelordet *Partner: Northwind IT*, og [Lolly Verify](/info/what-verify-checks.html#partner) viser oppføringen som **Partner** ([Partneroppføringen i filer](/info/manage/partner-programmes.html#the-partner-record-in-files)).
:::

**Lese oppføringen tilbake.** [Lolly Verify](/#/verify) viser oppføringen som **Design system** i filens attestdetaljer og eventuelle merkevareferdigheter som **Guided by**. En merkevareside vises for seg selv, som [signatarens registrering av en adresse](/info/what-verify-checks.html#brand-page). *Recreate with these settings* åpner verktøyet på nytt med den registrerte versjonen og fargevarianten. Lenken åpnes med det registrerte designsystemet når denne enheten har et med samme id og navn; ellers åpnes den med ditt aktive designsystem.

::: details Hva som skrives hvor, og hvilke kjøringer som utelater oppføringen
| Hvor | Hva som skrives |
|---|---|
| Content Credential | `designSystem` (id-en), `designSystemLabel`, `designVersion` og `themes` i påstanden `tools.lolly.export`, hver som en ren tekstverdi; `themes` er en JSON-liste over valgene. `brandPage` når utgiveren har valgt det |
| PNG, JPEG, WebP og JXL | De samme verdiene som `lolly:`-egenskaper i filens XMP-pakke, i navnerommet `https://lolly.tools/ns/export/1.0/`. `lolly:BrandPage` når utgiveren har valgt det |
| SVG | De samme `lolly:`-egenskapene i `<metadata>`-blokken |
| PDF | Nøkkelord som *Designsystem: Acme*, *Fargevariant: Beach* og, når utgiveren har valgt det, *Merkevareside: https://acme.example/brand/acme/* |
| Alle formater med et beskrivelsesfelt | Beskrivelsen, med fargevarianten ved siden av verktøyet |

Kortet vises bare når det er noe å registrere og formatet kan inneholde oppføringen. CSV, JSON, en kalenderfil og andre tekst- eller dataformater inneholder ingen metadata, og EPS, EMF, DXF og BMP har ikke noe felt for oppføringen. HTML, Markdown og CSS inneholder oppføringen bare i sin Content Credential, så for dem viser kortet ingen beskrivelseslinje og skjules når **C2PA Credentials** er av. Et felt designsystemet ikke oppgir, holdes utenfor filen.

En delingslenke slår av oppføringen med `_madewith=0` ([URL-parametere](/info/url-parameters.html)). Kommandolinjen tar `--no-madewith`, [MCP-serverens](/info/mcp.html) `lolly_render` tar `madeWith: false`, og eksportpanelet i terminalappen har en **Design system**-rad. Kommandolinjen skriver ordene en ferdig fil inneholder til standard feilutdata, for en verktøygjengivelse og for hver fil `lolly run` eksporterer fra en lagret Lolly Design-økt. En MCP-gjengivelse skriver ordene ved siden av filen. Begge leser ordene tilbake fra filen. En PNG kommandolinjen tegner uten nettleser, inneholder ingen filmetadata, så oppføringen følger bare med i attesten. Verktøy som kjører på enheten, legger ikke til metadata.

Kjøringer uten **Design system**-kort utelater oppføringen: en Lolly Batch-kjøring, en mappe eksportert fra Projects og en eksport av en 3D-samling, og i terminalappen en CSV-batch, en eksport av en Projects-mappe eller et utvalg og visningen for å gjengi alt. Eksporter én fil fra verktøyet for å registrere designsystemet.
:::

### Content Credentials (C2PA)

Eksporter kan inneholde **Content Credentials**: et signert [C2PA](https://c2pa.org)-manifest som registrerer hva som laget filen, når og hvor, knyttet til en hash av filens byte slik at enhver senere redigering kan oppdages. Lolly skriver standardmanifester som enhver C2PA-leser kan undersøke.

![Kortet C2PA Credentials, merket av, med attestens levetid ved siden av avkrysningsboksen](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **På som standard.** Kortet **C2PA Credentials** er merket av for nesten alle verktøy. Fjern avmerkingen for én eksport, eller send `c2pa=off` i en lenke. Filen har da ingen attest, og en SVG som bygger inn grafikk med attest, som en logo fra katalogen, mister også grafikkens attest. Lolly Imprint og filens øvrige metadata blir værende. Et verktøy kan velge det bort i manifestet sitt.
- **Formater.** PDF (RGB og Print), PNG og APNG, JPG, GIF, SVG og SVGZ, TIFF (RGB og Print), WebP (stillbilder og animert), AVIF, MP4, WebM, HTML, Markdown, CSS og lydbeholderne MP3, WAV, M4A, OGG/Opus og FLAC. En ZIP stempler hver fil som støttes, og det er slik en Animated SVG får en attest. MP4, AVIF og M4A bruker standard BMFF-binding og MP3 sin ID3v2-tilordning, så `c2patool` og andre lesere verifiserer dem. WebM og OGG/Opus har ingen standardtilordning ennå, så Lolly legger manifestet ved som et Matroska-vedlegg og et OpusTags-felt, som Lollys egen verifikator kontrollerer. En SVGZ er en komprimert SVG. C2PA-spesifikasjonen definerer ingen komprimert form, så attesten skrives inn i SVG-en før komprimering. Lollys verifikator leser filen som den er; `c2patool` leser den samme attesten når filen er pakket ut (`gunzip`). ICO, EPS, EMF, DXF, BMP, PPTX, Office-formatene og de andre tekst- og dataformatene har ingen C2PA-beholder.
- **Hva den registrerer.** Verktøyet og appen som laget filen, signeringstidspunktet og appskallet som eksporterte filen. For en Lolly Design-side eksportert som et bilde, SVG eller PDF: gjengiveren som tegnet siden (`route` i påstanden `tools.lolly.export`: `gpu` for GPU-sidegjengiveren, `operations` for tegneoperasjonene skrevet som vektorer, `compatibility` for nettleserens egen gjengiver) og versjonen av gjengiveren (`renderer`: GPU-oppskriften, `design-draw-v` og versjonen, eller `dom-to-image` og `dom-walker`). [Designsystemet og fargevarianten](#the-design-system-record) mens kortet **Design system** er merket av. De aktive innstillingene: menyvalg, tall, brytere og farger som de er, og alt som er skrevet inn (titler, navn, notater, lenker og datoer) bare som et fingeravtrykk, så ordene ikke er i filen. Profilbundne felt, inaktive kontroller, nettleserversjoner og detaljer om operativsystemet utelates. Navnet og e-postadressen din vises som opphavsperson bare når **Use my details to create** er på under Settings → Preferences → Your details. Kilder en eksport plasserer, følger med som bestanddeler. Hvert bilde på siden som har sin egen Content Credential, registreres som en komponent av siden, med attesten og eventuell AI-kildetype den oppgir. Dette gjelder i PNG, JPEG, WebP, AVIF, TIFF, SVG eller PDF, og i GIF, APNG, animert WebP, MP4 eller WebM når bildet tegnes i minst ett bilde i det eksporterte tidsområdet. Det ene bildet et verktøy som Darkroom, Filter eller Asset Export endrer, registreres i stedet som filens forelder, åpnet først og fulgt av det verktøyet gjorde med bildet. Andre bestanddeler er [krediterte verk](#source-credits) som emoji, [Lolly Rondocode-sanger](/info/rondocode.html#songs-in-the-credential) i en video- eller lydeksport og [lagrede melodier](/info/generated-music.html#what-a-track-records) i en video- eller lydeksport. Hver lagrede melodi har navn, lisens når melodien registrerer en, SHA-256 for oppskriften, motorversjonen og algoritmiske medier. Opphavspersonen til en lagret melodi (profilnavnet den ble lagret med) legges bare til mens **Use my details to create** er på, som ditt eget navn. Bare da viser eksportpanelet opphavspersonen før du eksporterer.
- **En godkjenning, når en ble registrert.** En fil godkjent gjennom [Lolly Work](/info/work-approvals.html#review-an-exported-file) kan inneholde en ekstra, signert oppføring over denne attesten: godkjennings-id-en, datoen for avgjørelsen og hashen til den vurderte filen. Den har ingen navn, e-postadresser, grupper, kommentarer eller kjedenavn. Den er merket av som standard i forespørselsdialogen og kan fjernes for én forespørsel eller slås av for en instans. Den registrerer at en signatar oppga en avgjørelse. Den sier ikke at arbeidet oppfyller noen standard.
- **Hva den ble bedt om å gjøre, for en fil laget fra en [intensjon](/info/visual-intent.html#what-goes-in-the-file).** Formålet, flaten, verktøyet, språket, versjonene av reglene og ordforrådet og intensjonens hash. Anledning, målgruppe, region og instruksjonen er bare fingeravtrykk, med mindre personen eller agenten som kjører gjengivelsen, ber om å registrere ordene i instruksjonen. Bare en gjengivelse som startet fra en intensjon, inneholder denne oppføringen. Kjøringen sier hva den registrerte, og oppføringen kan utelates.
- **Hva mottakere ser.** C2PA-verktøy som Adobe-apper, `c2patool` og contentcredentials.org/verify leser manifestet og viser påstanden. Lolly signerer med en nøkkel laget på enheten din, ikke et sertifikat fra en tillitsliste, så visningsprogrammer rapporterer en *uverifisert* attest. Strukturen og beviset på endringer er gyldige, men ingen går god for signataren. For å endre dette registrerer du en **verifisert identitet** under Settings → Preferences → Content Credentials; se [Content Credentials-identitet](/info/content-credentials-identity.html).
- **Kontrollere en fil.** Slipp en fil på [Lolly Verify](/#/verify), eller kjør `lolly validate <file>`, for en rapport på enheten som først viser om Lolly laget filen og om den har blitt endret siden. Lolly Verify ser også utover attesten; se [Hva Lolly Verify kontrollerer](/info/what-verify-checks.html).
- **Personvern.** Signeringsnøkkelen lages for eksporten og forlater aldri enheten din. Påstanden inneholder bare det proveniensmetadataene allerede inneholder. Personvernverktøy som transformerer dine egne filer, legger ikke til noen attest, og *Lolly Strip Hidden Data* fjerner et C2PA-manifest som alle andre metadata. Rondocode-verktøyet lager ny lyd, så det signerer det det skriver ([Lolly Rondocode-sanger](/info/rondocode.html#files-from-the-rondocode-utility)). Musikkgeneratoren signerer hver WAV- eller M4A-nedlasting. Attesten registrerer at Lollys musikkgenerator laget sporet og lisensen musikken er underlagt, CC BY 4.0, med krediteringen ([Hva et spor registrerer](/info/generated-music.html#what-a-track-records)).
- **Samspill.** En passordbeskyttet PDF kan ikke inneholde Content Credentials, på noen av nivåene. Attesten legges til sist, over de ferdige bytene, etter DPI, EXIF, fargeprofil, PDF/X-metadata og trykkmerker.

### Kildekreditering

En eksport som plasserer andres arbeid, registrerer kilden i attesten. Det vanlige tilfellet er en emoji fra det valgte emojisettet: verket, skaperen, lisensen, hvor de nøyaktige bytene kom fra og hva som ble endret følger alt med filen. Tekst i et verktøy med en SVG-mal beholder systemets egne emoji, så ingenting krediteres der. Før du laster ned, sier raden **Source credits** hvilke krav kildene stiller til leveransen. Etter nedlastingen leser raden de leverte bytene tilbake før den sier at krediteringene er i filen. En lisens som ber deg velge, som en omfarget CC BY-SA-glyf du skal til å dele, får et kort med alternativene. Nedlastingen blokkeres aldri. [Kreative rettigheter og kreditering](/info/creative-rights.html) har ordlyden, de gjennomgåtte lisensene og det som forblir ditt.

<!--i:eti-lock-->
## Passordbeskyttelse

Lolly lager to typer lås, begge på enheten din. Kortet **Password** i eksportpanelet angir begge.

![Password-kortet utvidet for en PDF-eksport, med passordfeltet og de to låsenivåene](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**Et passord for å åpne en PDF** har to nivåer når du har skrevet inn et passord:

- **Weak**: 40-bit RC4, for RGB `pdf` uten trykkmerker eller utfallende trykk og med rene ASCII-passord. Et passord med andre tegn går over til Strong, fordi lesere ikke kan åpne en fil låst slik på dette nivået. Bare de første 32 tegnene teller.
- **Strong**: AES-256 (PDF 2.0). Det gjelder også for Print PDF-er og for hver PDF i en batch-ZIP. En Print PDF låst med Strong beholder CMYK, merker og utdataprofil, men fjerner PDF/X-4-påstanden.

::: warning Weak er en hindring, ikke beskyttelse
Bruk **Strong** for en konfidensiell fil.
:::

**En låst ZIP** dekker en ZIP-eksport, en mappenedlasting fra Projects eller en batch, med ett passord på to nivåer: **Weak** (ZipCrypto, en hindring) eller **Strong** (AES-256). Passordet beskytter hver fil. Alle PDF-er inni låses også hver for seg med AES-256, så PDF-en forblir låst etter at ZIP-en er pakket ut. Spørsmålet vises når nedlastingen starter. Et tomt passord betyr ingen lås.

**Et innskrevet passord holdes utenfor lenker på begge nivåer.** Hvis en fil kommer gjennom en `?password=`-lenke, leser Lolly verdien og fjerner den fra adressen med en gang. En lenke som ber om en lås filen ikke kan ha, skriver ingen fil og sier hvorfor (se [`password`](/info/url-parameters.html)).

**En passordbeskyttet delingslenke** ber mottakeren om et passord før den åpnes. Lenketilstanden krypteres med AES-256 med en nøkkel avledet fra passordet (PBKDF2). Bare chiffertekst sendes, og dekrypteringen skjer i mottakerens nettleser. Serveren som leverer lenken, ser aldri passordet eller designet. Slå det på i dialogen **Share**. En kryptert lenke åpnes bare i Lolly, aldri som et innebygd bilde. Se [URL-modus](/info/url-mode.html).

<!--i:eti-monitor-->
## På en telefon

Eksportkontrollene ligger bak den flytende **Export**-knappen, som åpner **Export**-panelet: de samme formatene, størrelse, kopiering, nedlasting og deling, tilpasset berøring.

<!--i:eti-code-->
## Format-id-er for lenker og CLI

Dette er verdiene for URL-parameteren `format=` og CLI-flagget `--export=` (se [URL-parametere](/info/url-parameters.html) og [CLI](/info/cli.html)). Menyen til et verktøy viser bare formatene verktøyet kan lage.

| Type | Id-er |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vektor | `svg` · `svgz` (gzip-komprimert SVG) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (skjærefil) |
| Side og dokument | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (Penpot-designfil) · `scorm` (kurspakke, en ZIP) |
| Bevegelse | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| Lyd | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` · `mid` (MIDI-noter, fra Lolly Rondocode) |
| Tekst og data | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `ttml` · `scc` · `css` · `scss` · `gpl` (GIMP-palett) |
| Samlepakker og pakker | `zip` · `rpm` og `tar.gz` (gjengivelsen forseglet i en Linux-pakke) |

Noen id-er kommer fra verktøyets egen eksportkode: `ase` (Adobe Swatch Exchange, fra Lolly Palette Lab) og `exr` og `hdr` (rasterbilder med høyt dynamisk område, fra Lolly Darkroom). **Convert Font** skriver `ttf`, `otf` og `woff` fra en skriftfil du oppgir, så en lenke alene gir ikke verktøyet noe å gjengi.
