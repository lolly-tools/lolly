# Slik bruker du Lolly

Du har Lolly åpent og vil lage noe, beholde det og sende det videre. Denne siden går gjennom den sløyfen: åpne et verktøy, endre det det lar deg endre, lagre resultatet og dele det som en lenke eller en fil.

Alt her kjører på enheten din, uten konto, og fortsetter å fungere uten nett når verktøyene og ressursene du trenger er lastet ned. Appen trenger en nettleser eller app med WebGPU for å starte; [Supported environments](/info/supported-environments.html) lister de testede.

## Finn fram

::: figure using-app-map
Startskjermen: fire faner langs toppen og linjen nederst. Et verktøy, når det er åpnet, viser kontrollene ved siden av en levende forhåndsvisning.
:::

Fire faner går langs toppen av startskjermen: **Tools**, **Utilities**, **Assets** og **Projects**. Tools er det du lager med, Utilities er arbeidsbenker for jobber som å konvertere, sjekke eller rydde opp i en fil, Assets er biblioteket ditt og Projects holder det du har lagret.

Linjen nederst har **Open**, **Settings**, et søkefelt, **Verify** og **What?**. Den vises på Tools, Utilities, Assets, Projects, Settings og veiledningene du leser i appen, og viker unna når et verktøy er åpnet. [Search](/info/search.html) når verktøyene, det lagrede arbeidet, ressursene og innstillingene dine fra det feltet. [Ask Lolly](/info/ask.html) svarer på et skrevet spørsmål med den passende delen av disse veiledningene.

Klikk på et kort for å starte noe nytt i det verktøyet. Lagret arbeid åpnes i stedet på nytt fra **Projects**.

![Et gallerikort med eksempel på navigering og handlingen + Ny](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Hvert verktøy er en delt visning: **kontroller** på den ene siden og en levende **forhåndsvisning** på den andre. Endre en kontroll, så følger forhåndsvisningen straks, og det du ser, er det som eksporteres.

![Et verktøys delte visning - kontrollstabelen til venstre, og det live grupperte stolpediagrammet det tegner til høyre](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Design** er unntaket. Det åpnes som et fritt lerret med bokser du drar, endrer størrelse på og skriver i, med sin egen toppmeny, tidslinje og presentasjonskontroller. [Design: the free canvas](/info/design.html) er veiledningen for det.

## Endre det verktøyet lar deg endre

Et verktøy viser bare inndataene som er ment å variere. Forfatteren har allerede låst fargene, layouten, skriften og logikken, så alt du lager, holder seg til reglene deres. Inndata omfatter tekst, glidere, fargevelgere, rullegardiner, datoer, bildevelgere og repeterende radgrupper, og noen ligger i sammenfoldbare deler.

![Et verktøys kontrollstabel - et tekstfelt, fargeknapper og en glidebryter, og ingenting annet, siden forfatteren låste resten](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Klikk på designet for å finne kontrollen.** Klikk på et hvilket som helst element i forhåndsvisningen, så får den tilhørende kontrollen fokus og ruller til syne. I en repeterende radgruppe folder akkurat raden du klikket på seg ut.

**Clear changes**, over kontrollene, setter hver inndata tilbake til standard.

**Valg for designsystemet.** Når designsystemet ditt tilbyr mer enn én fargevariant, et lyst og et mørkt utseende eller et annet temavalg, ligger de i en del som heter **Design system** under kontrollene. Et valg vises bare når det endrer dette verktøyet, så et filverktøy viser ingen slik del. Hver fargevariant er en prikk i sine egne farger, lys og mørk er to knapper og et hvilket som helst annet valg er en liste.

Valget tilhører dette arbeidet. Det følger med i lenken og den lagrede økten, hver farge som er knyttet til designsystemet følger det, og appens egne farger blir som de er. Design viser de samme valgene i fanen **Canvas** i Inspector. Et verktøy der fargene er selve innholdet, kan bli på den kanoniske fargevarianten, og tilbyr da ingen fargevariantprikker. [Lolly Demo in use](/info/lolly-demo-in-use.html#colourways-on-real-work) viser fargevarianter på ekte arbeid.

### Zoom og panorer forhåndsvisningen

Forhåndsvisningen viser alltid nøyaktig det som blir eksportert.

- **Zoom:** Cmd/Ctrl-rull eller klyp på en styreflate, sentrert på pekeren. På tastaturet tilpasser `0` eller `Shift+1` alt, `1` eller `Shift+0` setter 100%, og `Shift+2` tilpasser markeringen. `+` / `−` zoomer rundt pekeren når den er over scenen, ellers rundt midten.
- **Panorer:** hold **Space** og dra, eller dra med midtre museknapp. Vanlige klikk forblir frie til å klikke på deler av designet.
- **Berøring:** klyp for å zoome, dra for å panorere og dobbelttrykk for å tilpasse.
- **Zoom-HUD:** trykk og hold på Lolly-virvelen i hjørnet for å folde ut `−`, **Fit** og `+`. Et kort trykk på virvelen åpner fortsatt profilmenyen din.

I Design tar **Fit all** med tegnebrett og løse lag. Du kan zoome ut manuelt under 20% til hele siden fyller halve visningen. Den faste nedre grensen er den laveste av 5% av vanlig Fit-skala og 2% absolutt zoom.

En endring av utdatastørrelsen setter alltid visningen tilbake til en ren tilpasning.

![Zoom-HUD-en utfoldet fra virvelen i hjørnet av lerretet - minus, Fit, pluss, så bryterne for tema og lyd og grepet som flytter den](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### Angre og gjøre om

**Cmd/Ctrl-Z** går tilbake og **Cmd/Ctrl-Shift-Z** (eller **Cmd/Ctrl-Y**) går fremover. Det samme paret ligger som knappene **Undo** og **Redo** over kontrollene (i Design står de i toppmenyen), og hver blir grå når det ikke er mer å ta tilbake. En melding sier hvilken inndata hver angring gjenopprettet, med en **Redo**-knapp i meldingen.

- **Et drag er ett trinn.** Gjentatte endringer av én kontroll innen et halvt sekund slås sammen, så å dra en glider over hele området er én angring.
- **De siste 100 trinnene beholdes.** En ny redigering etter en angring tømmer fremovertrinnene.
- **I en tekstboks** tilhører Cmd/Ctrl-Z feltet, tegn for tegn. Lolly tar over for glidere, rullegardiner, farger og brytere.
- **Å velge en fil** i et filfelt er ikke et trinn, fordi disse bytene bare holdes for denne økten.

I et levende [samarbeid](/info/collaborate.html) forblir historikken din din: en endring fra den andre enheten havner aldri på stabelen din. Angring varer til du forlater verktøyet eller laster på nytt. For noe eldre beholder verktøy som lagrer mens du arbeider, tidligere versjoner under **History**; se [Go back to an earlier version](/info/find-your-work.html#go-back-to-an-earlier-version).

### Levende kamera

Effektene i **Filter**-verktøyet (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art og Glitch) viser en **Go live**-knapp der et kamera er tilgjengelig. Slå den på, så følger effekten webkameraet ditt bilde for bilde, og en bevegelseseksport tar opp resultatet som GIF, WebM eller MP4. Bildene behandles på enheten din, og kameraet frigis i det øyeblikket du stopper eller forlater verktøyet. Enhver bildevelger har også **Take a photo** for ett enkelt bilde.

## Lagre og fortsette

For å beholde arbeidet, trykk **Save**, haken ved siden av **Export** på gjengivelsespillen. Nytt arbeid havner i **My library**, arbeid du har lagret før, oppdateres der det er, og ingenting lastes ned. Eksportpanelet har den samme **Save**-knappen.

For å velge hvor det havner, trykk **Save as**, ved siden av **Download** i eksportpanelet. Under **Save to a project** lar du **My library** stå valgt eller velger et prosjekt (**＋ New project…** lager ett), og trykker deretter **Save**; **Save as a template** beholder designet som en [mal](/info/templates.html), et utgangspunkt for nye dokumenter. I Design ligger **Save as** i Lolly-menyen; på en telefon trykker du **•••**, deretter **File menu**, deretter **Save as**.

![Den todelte gjengivelsespillen: Export, med en pil opp som åpner eksportpanelet, og Save, med en hake som lagrer på stedet](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> Trykk **Save** på gjengivelsespillen, eller **Save as** for å velge et prosjekt.
- <!--i:folder--> Elementet havner i **My library**, eller i prosjektet du valgte.
- <!--i:home--> Senere trykker du **Home** øverst til venstre og åpner fanen **Projects**.
- <!--i:document--> Åpne elementet. Hver innstilling er tilbake, klar til å endres og eksporteres på nytt.
:::

Elementer får navn etter filnavnet du skrev i eksportpanelet, eller ellers etter verktøyet, som **QR Code**. En fil du får med **Download**, er en ferdig kopi; for å endre den senere, åpne det lagrede elementet i Projects.

Personlige lagringer blir på denne enheten, i nettleseren eller appen du lagret fra, med mindre du slår på [Sync](/info/sync.html). Hvis noe ikke ligger der du forventer, dekker [Find and recover your work](/info/find-your-work.html) alle tilfeller, fra en lukket fane til tømte nettleserdata.

::: details Teamprosjekter med Lolly Work (valgfritt)
Hvis [organisasjonen din bruker Lolly Work](/info/organisation.html), logg på instansen dens og åpne **Projects → Team projects** for økter som er delt med deg. Organisasjonen setter tilgang og oppbevaring, og Lolly Work-tjenesten dens lagrer disse øktene. En delt økt går inn i sin levende collab når den åpnes, hvis organisasjonen din tillater redigering i sanntid; [Working together](/info/collaborate.html#work-collabs-with-lolly-work-optional) forklarer trinnene.

Det personlige biblioteket ditt forblir adskilt. Å logge på på en annen enhet gir deg teamarbeid, mens personlige lagringer fortsatt trenger Sync eller en sikkerhetskopi for å flyttes over.
:::

## Dele arbeidet ditt

Et design går ut som en lenke eller som en fil. **Share** i eksportkontrollene åpner en dialog som tilbyr begge, og **Share link** på en lagret økt i Projects åpner den samme dialogen for den økten.

::: cols
## En lenke

- Bærer hver inndata i adressen, så lenken gjenskaper designet.
- Etterlater bilder og filer du la til fra denne enheten, veldig lang tekst og veldig store lister.
- Åpnes i hvilken som helst nettleser, så du kan bokmerke, lime inn eller committe lenken.

## En .lolly-fil

- Bærer den lagrede økten med bildene og filene på denne enheten, og kan også bære verktøyet og designsystemet.
- Holder tilbake lisensiert katalogkunst med mindre du velger å ta med filene.
- Åpnes i Lolly: dobbeltklikk på den, bruk **Open** eller slipp den på appen.
:::

### Lenken

Den ferdig kopierbare lenken ligger øverst i dialogen, med **Copy** og en **QR**-knapp som åpner QR Code-verktøyet på lenken. Under lenken har **Link options**:

- **Open in the installed app** bytter lenken til en `lolly://`-adresse for Snarveier, oppstartere og automatisering, med alle parametere uendret.
- **Shortest link** pakker et langt design inn i et kompakt token og viser besparelsen i tegn. Den lesbare formen er alltid der også.
- **Password-protect this link** krypterer lenken på enheten din med AES-256. Passordet er aldri en del av lenken.
- **Pin this tool version** legger til flagget `_v`, slik at en senere verktøyoppdatering ikke kan endre hva lenken gjengir.
- **When the recipient opens the link…** velger fullskjerm, eksportpanelet allerede utvidet, en nedlasting ved åpning (`&export`) eller en kopi til utklippstavlen (`&copy`).
- **Copy credit** kopierer en "Made with Lolly"-bildetekst med lenken, for et innlegg eller et lysbilde.

Når et verktøy har personlige felt, som navnet ditt, holder **Review personal fields** hvert felt utenfor lenken til du krysser av for det feltet. [URL mode](/info/url-mode.html) dekker alt en lenke kan bære.

**Dialogen sier hva en lenke ikke kan bære.** Et bilde eller en fil du la til fra denne enheten, en veldig lang tekstverdi og en veldig stor liste får ikke plass i en adresse. Hvert av dem telles mens lenken bygges. Hvis noe måtte utelates, lister dialogen det og viser deg til filalternativet, i stedet for å gi deg en lenke som åpnes med et bilde som mangler. En lenke som bare er lang, får en mildere merknad med tegnantallet.

**Noen verktøy gjør lenken til hele produktet.** Jump Page samler lenkene dine på én side du kan dele ut: en bio-lenke, et foredrag, en butikkfront. Ingenting hostes og ingen konto ligger bak siden, fordi siden er lenken. En besøkende får den i full bredde, én lenke per scene mens de ruller.

![Jump Page i redigeringsverktøyet: overskriftscenen øverst på siden, med lenkescenene under](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Organisasjonsstyrte lenker med Lolly Work
For deling som trenger utløp, tilbakekalling eller passord, tilbyr Lolly Work administrerte lenker til delte økter, verktøy og katalogressurser. De løses opp gjennom organisasjonens tjeneste og følger dens tilgangsregler. De er adskilt fra de selvstendige lenkene ovenfor, og å tilbakekalle en kan ikke kalle tilbake en fil noen allerede har lastet ned. [Rendering and sharing](/info/manage/sharing.html) lister lenketypene og tillatelsene.
:::

### .lolly-filen

**Download .lolly**, i delen **Editable file** i Share-dialogen, skriver det gjeldende designet som én fil. Den bærer den lagrede økten med bildene og filene på denne enheten, og vanlig katalogkunst følger også med. En utdatert eller utilgjengelig fil blir en ekstern referanse i stedet for å forsvinne. Før den lagrer, viser dialogen filens størrelse, hvor mange filer den bygger inn, hvor mange den refererer til og om verktøyet er med. Der enheten din har et delingsark, gir **Send to…** filen rett til det (AirDrop, en Android-deling).

**Download project (.lolly)**, i menyen til en mappe i **Projects**, skriver en hel mappe, slik at noen andre kan fortsette med hver økt i mappen. Batch-økter blir igjen, og merknaden sier hvor mange. **Download originals**, i samme meny, skriver en vanlig zip av hvert element som sin egen fil.

Tre ting er det opp til deg å avgjøre før en fil går ut:

- **Om navnet ditt tas med.** Navnet, e-posten og organisasjonen din skrives bare når **Use my details to create** er på i [profilen din](/info/profile.html). Når den er av, registrerer filen bare at den ble laget med Lolly, og når.
- **Om tilbakeholdt kunst tas med.** Lisensiert kunst, merkevarelåst kunst og katalogverk der lisensen aldri ble registrert, holdes utenfor som standard. Hvis designet bruker noe av det, sier dialogen hvor mye og tilbyr *Download without them* eller *Include and download*, fordi å ta dem med gir filene til den som åpner `.lolly`-filen. Filens `CREDITS.txt` lister hva som fulgte med og hva som ikke gjorde det, med årsaken; [Creative rights and credits](/info/creative-rights.html) forklarer reglene.
- **Om verktøyet tas med.** **Include the tool** pakker verktøyets egne filer, slik at designet åpnes på en enhet uten det verktøyet. Den starter avkrysset for et egendefinert verktøy, som en fork, og uten avkrysning for et verktøy den signerte katalogen lister. På et bygg uten signert katalog regnes hvert verktøy som egendefinert.

**Å åpne en.** I skrivebords- og mobilappene dobbeltklikker eller trykker du på en `.lolly`, velger **Open with Lolly** eller sender den til Lolly fra delingsarket. I nettappen trykker du **Open** eller slipper filen på Lolly. Hver rute leser filens manifest først og viser størrelsen, innholdet og hva som vil skje, før noe skrives.

Hvis filen bærer et verktøy du ikke har, viser **Trust this tool?** verktøyet og forfatteren, og sier at å åpne den kjører verktøyets egen kode på enheten din. **Trust & install** går videre. Avslår du, lagres arbeidet likevel i Projects og venter på dagen du legger til verktøyet. Et verktøy der koden leveres som en modul, kan ikke installeres på denne måten ennå, og avvises på samme måte.

::: details Hva en .lolly inneholder, og hvordan det fungerer å åpne en
`.lolly` er Lollys bundle-filetternavn, og `format` i `manifest.json` sier hva som ligger inni:

- Et **delt design** (`lolly-share`) holder én lagret økt, de innebygde filene dens og en kvittering for alt som fortsatt løses opp ved referanse. Det kan også bære verktøyet og designsystemet. Å åpne det legger til et nytt Project og overskriver aldri en økt.
- Et **delt prosjekt** (`lolly-share`, kind `project`) holder en mappe fra Projects: undermappene, hver økt i dem med sin flis og bildene som er arkivert der. Å åpne det legger til en kopi av hele mappen. Hver økt følger med som `sessions/<key>.json` med flisen sin under `thumbs/`. En Lolly fra før prosjektfiler fantes ber deg oppdatere.
- En **designsystempakke** (`lolly-brand`) holder tokens og kan holde skrifter, logoer, publiserte versjoner og beholdte ressurser. Å åpne pakken legger til et eget navngitt designsystem og gjør det systemet aktivt.
- En **arbeidsområde- eller instanspakke** er en `lolly-brand` med deklarerte verktøy, katalogressurser og eventuelt en instansadresse. Å laste en erstatter det ene arbeidsområdeoverlegget som ble lastet før, og forhåndsvisningen lister de enhetsomfattende virkningene.

En full enhetssikkerhetskopi er ikke en `.lolly`. Den forblir en `LollyTools-….zip` (format `lolly-backup`) og gjenopprettes gjennom **Settings → Storage → Import data…**. En zippet verktøymappe forblir også en `.zip`. [Data transfer](/info/data-transfer.html) er formatreferansen.

En `.lolly` er en vanlig zip. Gi den nytt navn `.zip` for å se inni: dine egne bilder ligger under `assets/uploads/`, katalogkunst under `assets/catalog/`, `manifest.json` lister hver fil, og en README sier hva filen er.

macOS, Windows, Linux, iOS og Android registrerer alle formatet, filbehandlere på skrivebordet viser det som et Lolly-dokument, og GNOME Files kan vise miniatyrbildet til en lagret økt. Å åpne fra Design System Setup anbefaler designsystemhandlingen når et delt design har en, men skjuler aldri **Open shared design**.

Et dokument som overleveres fra en annen app på iOS eller Android, er begrenset til 48 MB, fordi overleveringen kopierer bytene over appgrensen, og appen sier fra om det. **Open** inne i Lolly har ingen slik grense, så bruk det for en større bundle.

Etter at du bekrefter, pakker Lolly ut og verifiserer bundlen én gang. Ressurser går til biblioteket ditt, matchet med sjekksum slik at en fil som allerede er på enheten, gjenbrukes. Økter går til Projects med nye ID-er, så den samme filen kan åpnes to ganger; en økt der verktøyet mangler, venter der. Filer over 100 MB merkes som store, og forhåndsvisningen advarer når nettleserlagringen melder om mindre ledig plass enn filen trenger. Hver del som dekkes av integritetssjekken, kontrolleres før noe bekreftes, og en skadet kopi avvises uten at noe blir liggende igjen.
:::

En lenke og en fil overleverer begge et øyeblikksbilde. For redigering i sanntid dekker [Working together](/info/collaborate.html) private collabs mellom to enheter og valgfrie work collabs gjennom Lolly Work.

## Ressurser - biblioteket ditt

**Assets** (`#/a`) samler alt verktøyene dine kan hente fra: merkevarelogoer, bilder, lyd og bevegelse, gruppert etter type, sammen med dine egne filer. Opplastingene dine lagres på enheten din. En organisasjon som bruker Lolly Work kan også tilby en delt katalog under sine egne tilgangsregler; se [Use Lolly at your organisation](/info/organisation.html).

![Ressurser, med merkevarens fargeprøver og skrifter og dine egne opplastinger](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Ta med filene dine.** Slipp et bilde, en SVG, et lydklipp, en video, en Lottie, en PDF eller en PowerPoint-presentasjon på opplastingsområdet, eller klikk for å velge. Den dukker opp i Assets med en gang og i hvert verktøys ressursvelger. En PDF med flere sider eller en `.pptx` spør hvilke sider eller lysbilder som skal beholdes, og hver blir en SVG-ressurs. Et bilde du legger til inne i et verktøy, beholdes slik det kom i **My images**, så en Content Credential på det fortsatt verifiseres, og bare en veldig stor fil spør om den skal endres i størrelse. **Settings → Storage** viser hvor mye **My images** holder. Det er ingen grense utover enhetens lagring. For å fjerne EXIF- og GPS-data når bilder kommer inn, slå på **Strip metadata from uploads** under **Settings → Feature flags**; Content Credentials beholdes uansett.
- <!--i:star--> **Merk favorittene.** Stjernemerk en ressurs eller en merkevarefarge, så festes den øverst i hver velger.
- <!--i:folder--> **Rydd opp.** Flytt en ressurs til en annen gruppe, skjul en delt merkevareressurs du ikke bruker (**Show hidden** henter den tilbake) eller slett dine egne opplastinger. Den samme markeringslinjen som i Projects virker på et helt utvalg.
- <!--i:layers--> **Løft en video av bakgrunnen.** Åpne detaljene til en video, eller høyreklikk kortet i en ressursvelger, og velg **Remove background…**. En **On-device model** klipper et motiv ut av en travel scene; en **Colour key** fjerner en jevnt belyst bakgrunn som en grønn skjerm, med **Tolerance**, **Softness** og **Spill removal** for kanten, og trenger ingen nedlasting. **Resolution** (360, 480, 720 eller 1080p, aldri over kilden) bytter detaljer mot fart. Utklippet, en animert WebP eller PNG med ekte gjennomsiktighet, lagres ved siden av originalen, og kildens Content Credential følger med som en ingrediens. [Generated once, rendered the same](/info/ai-features.html) forklarer hvorfor dette forblir en vanlig redigering.

### Ta paletten og skriftene dine med overalt

Panelet **Swatches** i Assets viser fargene merkevaren din er laget av: merkevarefargene, fargene du la til, rampene og spekteret. Rollefargene Lolly beholder for grensesnittet (tekst, flater, kanter, fargevariantledere og kopier av en merkevarefarge under et annet navn) ligger bak et grått kort, **Show colour roles**, nederst i panelet.

Hver farge er et kort som alle andre ressurser. Klikk på en for å åpne detaljene, velg noen få for å laste ned bare dem, eller last ned hele paletten i formatet det andre verktøyet ditt leser:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** eller **CSS classes**, for et stilark eller et bygg. En farge bredere enn sRGB beholder sin brede verdi: CSS-en setter den etter hex-verdien, og JSON-en beholder hex-verdien med den brede fargen, CMYK-oppskriften og spotfargen ved siden av.
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**, for Illustrator eller Photoshop. En farge låst til en CMYK-oppskrift kommer som den CMYK-fargeprøven, en spotfarge som en navngitt spotfargeprøve og en farge bredere enn sRGB som Lab.
- <!--i:pentool--> **GIMP palette (.gpl)**, for GIMP eller Inkscape, og **SCSS variables**, begge i sRGB.

![Panelet Swatches - de fem nedlastingsknappene for paletten øverst, deretter hver merkevarefarge som en brikke som åpner detaljene dens](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

Velg farger med prikken på hvert kort: Shift-klikk en andre prikk for alt imellom, dra en boks gjennom hullene eller trykk Cmd/Ctrl+A med et kort i fokus. Linjen tilbyr **Download as…** i de samme seks formatene, **Copy hex** og **Favourite**. Før du velger format, lister menyen farger ingen format kan holde (Transparent har ingen farge i det hele tatt), hvilke formater som lagrer en bred farge som sRGB-reserveverdien (SCSS og GIMP) og hvilke som bærer CMYK- og spotverdiene (JSON og .ase). Høyreklikk et kort for de samme handlingene på én farge.

Detaljene til en farge fyller forhåndsvisningen med fargen og folder ut **Linked values** (CMYK-oppskriften eller spotfargen, enhver verdi skrevet for et bestemt rom eller en bestemt presse, og designtokenet), **Every notation** (hex, OKLCH, Display-P3 og resten, hver med en kopieringsknapp), **Plotted on a colour space**, **Tones** og **Readability**. Piltastene går gjennom paletten, **Copy link** deler selve fargen og **Open in Colour Lab** tar den videre.

Panelet **Fonts** lister merkevareskriftene dine med en **download** for hver, til å installere lokalt eller gi til et trykkeri.

## Gjør rutenettet ditt

- <!--i:star--> **Merk det du bruker som favoritt.** Høyreklikk et kort og velg **Add to favourites**, så får det en stor flis i en stripe over rutenettet. [Your favourites](/info/favourites.html) dekker stripen.
- <!--i:eyeoff--> **Skjul et verktøy du aldri bruker.** Høyreklikk et kort, eller velg flere, og velg **Hide tool**. Det forsvinner fra rutenettet og fra det som finnes når du skriver i rutenettet. En grå flis, **Show hidden tools (N)**, på slutten viser dem igjen, dempet, hver med **Unhide tool** i menyen sin. Å skjule endrer bare rutenettet ditt: verktøyet åpnes fortsatt fra en lenke eller et bokmerke.
- <!--i:clock--> **Dine verktøy først.** Når du har lagret arbeid i tre ulike verktøy, leder en rad med brikker, **Yours**, over rutenettet med favorittene og de nyeste verktøyene dine.
- <!--i:sliders--> **Legg det ut på din måte.** **View options** setter layouten (**Grid**, **Card** eller **List**), kortstørrelse og tetthet, sorteringsrekkefølgen og et kategorifilter.

![Slutten av Tools-rutenettet med skjulte verktøy vist: det dempede Wordmark-kortet, og ved siden av det den grå flisen som slo det synlig igjen, nå med teksten Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
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

**Handle på flere kort samtidig.** Kryss av for hvert korts avkrysningsboks, dra en markeringsboks over tomt område eller Shift/Cmd-klikk, så vises en linje med det den visningen tillater:

- **Tools og Utilities:** Favourite, Hide, Available offline, **View sessions** (Projects, som bare viser øktene laget med de verktøyene) og Copy link for ett enkelt kort.
- **Assets:** Favourite og Hide for et hvilket som helst utvalg. Duplicate, Download og Delete vises bare når hvert valgte element er en av dine egne opplastinger, fordi en delt designsystemressurs er en permanent kontrakt.
- **Projects:** se [Find and recover your work](/info/find-your-work.html#find-something-you-saved).

![Galleriets utvalgslinje for to verktøy, som tilbyr Tilgjengelig offline, Vis økter, Favoritt og Skjul](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
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

**View sessions** vises først når noe er valgt. Høyreklikk i stedet ett enkelt uvalgt kort, så tilbyr det **N saved sessions**, en liste over det verktøyets lagrede økter, der en sletting flytter økten til papirkurven.

## På en telefon

På en smal skjerm blir layouten én kolonne:

- **Kontrollene blir et ark** øverst med et dragegrep på nedre kant. Dra grepet for å feste det til **peek**, **half** eller **full**, eller trykk på det for å skjule og vise. Forhåndsvisningen fyller plassen under og blir i syne mens du redigerer.
- En flytende **Export**-knapp åpner eksportarket: format, størrelse, kopier, lagre og last ned på ett sted. Trykk på bakgrunnen for å lukke arket.

![Et verktøy på en telefonbred skjerm - kontrollene som et ark øverst, den genererte paletten som fyller forhåndsvisningen under og renderpillen som flyter nederst i midten](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Innstillinger, lyd og komfort

**Settings**, nederst på startskjermen, holder detaljene dine, designsystemene dine, tilgjengelighet, lagring og nedlastinger for bruk uten nett. [Settings](/info/dashboard.html) kartlegger hver fane.

- **Detaljene og portrettbildet ditt** fyller ut ethvert verktøy som er bygget for å bruke dem, som en e-postsignatur eller et navneskilt. [Profiles](/info/profile.html) dekker dem.
- **Accessibility** har fire komfortbrytere: **Reduce motion**, **Hide colourful previews**, **High contrast** og **Large text**. De endrer appen rundt arbeidet ditt, aldri et verktøylerret eller en eksport.
- **Sound** spiller milde hjelpelyder for det du gjør, og **Neurospicy Mode** spiller et rolig fokusspor. Begge er av til du slår dem på, i **Settings → Accessibility** eller profilmenyen.
- **Available offline** laster ned resten av appen, verktøyene, katalogen og veiledningene før du mister forbindelsen. Lolly er en nettapp du kan installere: bruk nettleserens installeringsknapp, eller *Add to Home Screen* på en telefon, for en fullskjermsapp som oppdaterer seg selv når du er online igjen.
- **Storage** viser hva Lolly beholder på denne enheten. [If you clear your browser data](/info/find-your-work.html#if-you-clear-your-browser-data) forklarer hva tømming fjerner, og [Privacy Policy](/info/privacy.html) lister alt appen henter eller sender.

::: note Hvis en visning ikke lastes etter en oppdatering
Et tomt panel eller en melding om "failed to fetch" rett etter en oppdatering går vanligvis over med én omlasting. Det lagrede arbeidet, øktene og designsystemene dine er urørt, fordi de ligger på enheten din. Bare et bilde du la til og aldri lagret, må kanskje legges til igjen.
:::

## Hvor du går videre

- **[Design: the free canvas](/info/design.html)**: lerretet, former, tidslinjen og å presentere en presentasjon.
- **[Batch and Multi-edit](/info/batch.html)**: mange versjoner av ett design, eller flere lagrede design redigert sammen.
- **[Export a file](/info/exporting.html)**: valg av format, størrelse, trykkenheter, gjennomsiktighet og video.
- **[Import a design](/info/design-import.html)**: ta en Figma-, Penpot-, Illustrator- eller InDesign-fil inn i Design og fortsett å redigere.
- **[Templates](/info/templates.html)**: lagrede utgangspunkt for et verktøy.
- **[Wide Colour and HDR](/info/hdr-editing.html)**: behold den opprinnelige bildepresisjonen i Design og Darkroom.
- **[Find and recover your work](/info/find-your-work.html)**: hvor alt er, og hvordan du flytter det til en annen enhet.
