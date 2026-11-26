# Slik bruker du Lolly

Åpne et verktøy, endre det du får endre, lagre resultatet og del det som en lenke eller fil.

Alt kjøres på enheten din uten konto og fungerer uten nett når verktøyene og ressursene du trenger, er lastet ned. Appen trenger en nettleser eller app med WebGPU for å starte. [Støttede miljøer](/info/supported-environments.html) lister dem som er testet.

**Arbeidsgangen**, i fire trinn:

::: steps
- <!--i:eti-home--> **[Åpne et verktøy](#find-your-way-around)** Klikk på et kort på startskjermen. Kontrollene ligger ved siden av en levende forhåndsvisning.
- <!--i:eti-sliders--> **[Endre inndataene](#change-what-the-tool-lets-you-change)** Bare inndataene forfatteren lot være åpne. Klikk på designet for å finne kontrollen.
- <!--i:eti-folder-plus--> **[Lagre arbeidet ditt](#saving-continuing)** **Save** beholder det i My library, og Projects henter det fram igjen.
- <!--i:eti-link--> **[Del designet](#sharing-your-work)** En lenke som inneholder alle inndata, eller én `.lolly`-fil.
:::

<!--i:eti-home-->
## Finn fram

::: figure using-app-map
Startskjermen har fire faner øverst og en linje nederst. Et åpent verktøy viser kontrollene ved siden av en levende forhåndsvisning.
:::

Øverst på startskjermen ligger fire faner: **Tools**, **Utilities**, **Assets** og **Projects**. Tools er det du lager med. Utilities konverterer, kontrollerer eller rydder opp i en fil. Assets er biblioteket ditt. Projects inneholder det du har lagret.

Linjen nederst inneholder **Open**, **Settings**, et søkefelt, en **Verify**-snarvei til Lolly Verify og **Docs**, som åpner disse veiledningene. Linjen vises i Tools, Utilities, Assets, Projects, Settings og veiledningene i appen, og skjules når et verktøy er åpent. [Lolly Search](/info/search.html) finner verktøyene, det lagrede arbeidet, ressursene og innstillingene dine fra dette feltet. [Ask Lolly](/info/ask.html) besvarer et skrevet spørsmål med den tilsvarende delen av disse veiledningene.

Klikk på et kort for å begynne på nytt arbeid i det verktøyet. Lagret arbeid åpnes igjen fra **Projects**. Ved første besøk tilbyr et velkomstfelt øverst i galleriet én handling for å komme i gang: **Start making** under Lolly Demo, eller **Make it yours** for å sette opp ditt eget designsystem.

![Et gallerikort med eksempelnavigering og en New-handling](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Hvert verktøy har en delt visning: **kontroller** på den ene siden og en levende **forhåndsvisning** på den andre. Forhåndsvisningen oppdateres når du endrer en kontroll, og det du ser, er det som eksporteres.

![Et verktøys delte visning - kontrollstabelen til venstre og det levende grupperte stolpediagrammet den tegner til høyre](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Lolly Design** er unntaket: et fritt lerret med bokser du drar, endrer størrelsen på og skriver i, med egen toppmeny, tidslinje og presentasjonskontroller. [Lolly Design: det frie lerretet](/info/design.html) er veiledningen til det.

<!--i:eti-sliders-->
## Endre det verktøyet lar deg endre

Et verktøy viser bare inndataene som er ment å variere. Forfatteren har bestemt fargene, layouten, skriften og logikken, slik at arbeidet ditt følger reglene deres. Inndataene omfatter tekst, glidere, fargevelgere, rullegardiner, datoer, bildevelgere og repeterende radgrupper. Noen ligger i deler som kan foldes sammen.

![Et verktøys kontrollstabel - et tekstfelt, fargeknapper og en glider, og ingenting annet forfatteren valgte å låse](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Klikk på designet for å finne kontrollen.** Klikk på et element i forhåndsvisningen, så ruller kontrollen inn i visningen og får fokus. I en repeterende radgruppe åpnes raden du klikket på.

**Clear changes**, over kontrollene, tilbakestiller alle inndata til standardverdiene.

**Valg for designsystemet.** Når designsystemet tilbyr flere fargevarianter, et lyst og et mørkt utseende eller et annet temavalg, finner du dem i en del kalt **Design system** under kontrollene. Et valg vises bare hvis det endrer dette verktøyet, så et filverktøy viser ingen slik del. Hver fargevariant vises som en prikk i sine egne farger, lyst og mørkt som to knapper og andre valg som en liste.

Valget gjelder dette arbeidet. Det følger lenken og den lagrede økten. Alle farger som er knyttet til designsystemet, følger valget, og appens egne farger forblir uendret. Lolly Design viser de samme valgene i **Canvas**-fanen i Inspector. Et verktøy der fargene utgjør innholdet, kan beholde den kanoniske fargevarianten og viser da ingen fargevariantprikker. [Lolly Demo i bruk](/info/lolly-demo-in-use.html#colourways-on-real-work) viser fargevarianter på ekte arbeid. For å bruke én fargevariant i appen og for hvert nytt arbeid velger du den i **Settings → Appearance** ([Gjør en fargevariant til din egen](/info/colourways.html#make-a-colourway-your-own)).

### Zoom og panorer forhåndsvisningen

- **Zoom:** bruk Cmd/Ctrl-rull eller klyp på en styreflate, sentrert rundt pekeren. Med tastaturet tilpasser `0` eller `Shift+1` alt, `1` eller `Shift+0` gir 100% og `Shift+2` tilpasser utvalget. `+` / `−` zoomer rundt pekeren når den er over scenen, ellers rundt midten.
- **Panorer:** hold **Space** inne og dra, eller dra med midtre museknapp. Vanlige klikk er fortsatt tilgjengelige for å klikke på deler av designet.
- **Berøring:** klyp for å zoome, dra for å panorere og dobbelttrykk for å tilpasse.
- **Zoom-HUD:** hold inne Lolly-virvelen i hjørnet for å folde ut `−`, **Fit** og `+`. Et kort trykk på virvelen åpner fortsatt profilmenyen.

I Lolly Design omfatter **Fit all** tegnebrett og løse lag. Manuell zoom kan gå under 20% til siden fyller halve visningen. Den absolutte nedre grensen er den laveste av 5% av vanlig Fit-skala og 2% absolutt zoom.

Endrer du utdatastørrelsen, går visningen alltid tilbake til å være tilpasset.

![Zoom-HUD-en foldet ut fra virvelen i lerretets hjørne - minus, Fit, pluss, deretter tema- og lydbryterne og grepet som flytter den](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### Angre og gjøre om

**Cmd/Ctrl-Z** går ett trinn tilbake og **Cmd/Ctrl-Shift-Z** (eller **Cmd/Ctrl-Y**) ett trinn framover. Knappene **Undo** og **Redo** ligger over kontrollene, eller i toppmenyen i Lolly Design. Hver knapp blir grå når den ikke har flere trinn igjen. En melding forteller hvilken inndata hver angring gjenopprettet, med en **Redo**-knapp.

- **Et drag er ett trinn.** Gjentatte endringer av samme kontroll innen et halvt sekund slås sammen til ett trinn.
- **De siste 100 trinnene beholdes.** En ny endring etter en angring tømmer stabelen med trinn framover.
- **I en tekstboks** tilhører Cmd/Ctrl-Z feltet, tegn for tegn. Lolly overtar for glidere, rullegardiner, farger og brytere.
- **Å velge en fil** i et filfelt er ikke et trinn, fordi disse bytene bare beholdes i denne økten.

I et levende [samarbeid](/info/collaborate.html) legges en endring fra den andre enheten aldri på angrestabelen din. Angring er tilgjengelig til du forlater verktøyet eller laster på nytt. For eldre endringer beholder verktøy som lagrer underveis, tidligere versjoner under **History** ([Gå tilbake til en tidligere versjon](/info/find-your-work.html#go-back-to-an-earlier-version)).

### Levende kamera

Effektene i **Filter**-verktøyet (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art og Glitch) viser en **Go live**-knapp når et kamera er tilgjengelig. Slå den på, så følger effekten webkameraet ditt bilde for bilde. En bevegelseseksport tar opp resultatet som GIF, WebM eller MP4. Bildene behandles på enheten din. Kameraet frigis så snart du stopper eller forlater verktøyet. Alle bildevelgere har også **Take a photo** for ett enkelt bilde.

<!--i:eti-folder-plus-->
## Lagre & fortsette

For å beholde arbeidet trykker du på **Save**, haken ved siden av **Export** på gjengivelsespillen. Nytt arbeid legges i **My library**, tidligere lagret arbeid oppdateres der det ligger og ingenting lastes ned. Du finner den samme **Save**-knappen i eksportpanelet.

For å velge hvor arbeidet lagres, trykker du på **Save as** ved siden av **Download** i eksportpanelet. Under **Save to a project** lar du **My library** være valgt eller velger et prosjekt (**＋ New project…** oppretter et), og trykker så på **Save**. **Save as a template** lagrer designet som en [mal](/info/templates.html), et utgangspunkt for nye dokumenter. I Lolly Design finner du **Save as** i Lolly-menyen. På telefon trykker du på **•••**, så **File menu** og deretter **Save as**.

![Den todelte gjengivelsespillen: Export med en oppoverpil som åpner eksportpanelet, og Save med en hake som lagrer på stedet](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> Trykk på **Save** på gjengivelsespillen, eller **Save as** for å velge et prosjekt.
- <!--i:folder--> Elementet legges i **My library** eller i prosjektet du valgte.
- <!--i:home--> Senere trykker du på **Home** øverst til venstre og åpner fanen **Projects**.
- <!--i:document--> Åpne elementet. Alle innstillingene er tilbake, klare til å endres og eksporteres på nytt.
:::

Elementer får filnavnet du skrev i eksportpanelet, eller navnet på verktøyet, for eksempel **QR Code**. En fil fra **Download** er en ferdig kopi. For å endre den senere åpner du det lagrede elementet i Projects.

::: note Lagret arbeid blir på denne enheten
Personlig lagret arbeid blir på denne enheten, i nettleseren eller appen du lagret fra, med mindre du slår på [Sync](/info/sync.html).
:::

Hvis noe ikke er der du forventer, dekker [Finn og gjenopprett arbeidet ditt](/info/find-your-work.html) alle tilfeller, fra en lukket fane til slettede nettleserdata.

::: details Teamprosjekter med Lolly Work (valgfritt)
Hvis [organisasjonen din bruker Lolly Work](/info/organisation.html), logger du på instansen deres og åpner **Projects → Team projects** for å finne økter som er delt med deg. Organisasjonen bestemmer tilgang og oppbevaring, og Lolly Work-tjenesten deres lagrer disse øktene. Når organisasjonen tillater redigering i sanntid, kobles en delt økt til det levende samarbeidet når den åpnes. [Arbeid sammen](/info/collaborate.html#collabs-through-lolly-work-optional) forklarer trinnene.

Det personlige biblioteket ditt holdes atskilt. Når du logger på en annen enhet, får du tilgang til teamets arbeid. Personlig lagret arbeid trenger fortsatt Sync eller en sikkerhetskopi for å flyttes over.
:::

<!--i:eti-link-->
## Del arbeidet ditt

Del et design som en lenke eller en fil. **Share** i eksportkontrollene åpner en dialog som tilbyr begge deler. **Share link** på en lagret økt i Projects åpner samme dialog for den økten. Når du har sendt en fil til Google Drive, Nextcloud, en S3-bøtte, Dropbox eller OneDrive, kan dialogen også lage en lenke gjennom den tjenesten ([Eksporter en fil](/info/exporting.html#how-export-works)).

::: cols
## En lenke

- Har med alle inndata i adressen, slik at lenken gjenskaper designet.
- Utelater bilder og filer du har lagt til fra denne enheten, svært lang tekst og svært store lister.
- Åpnes i alle nettlesere, så du kan bokmerke, lime inn eller sjekke inn lenken i versjonskontroll.

## En .lolly-fil

- Har med den lagrede økten med bildene og filene på denne enheten, og kan også ha med verktøyet og designsystemet.
- Holder tilbake lisensiert kataloggrafikk med mindre du velger å inkludere filene.
- Åpnes i Lolly: dobbeltklikk på den, bruk **Open** eller slipp den på appen.
:::

### Lenken

Lenken står øverst i dialogen, med **Copy** og en **QR**-knapp som åpner QR Code-verktøyet med lenken. Under lenken inneholder **Link options** disse valgene:

- **Open in the installed app** gjør lenken om til en `lolly://`-adresse for Shortcuts, startprogrammer og automatisering, med alle parametere uendret.
- **Shortest link** pakker et langt design i et kompakt token og viser hvor mange tegn du sparer. Den lesbare formen er fortsatt tilgjengelig.
- **Password-protect this link** krypterer lenken på enheten din med AES-256. Passordet er aldri en del av lenken.
- **Pin this tool version** legger til flagget `_v`, slik at en senere verktøyoppdatering ikke kan endre det lenken gjengir.
- **When the recipient opens the link…** velger fullskjerm, eksportpanelet ferdig utfoldet, nedlasting ved åpning (`&export`) eller kopiering til utklippstavlen (`&copy`).
- **Copy credit** kopierer teksten «Laget med Lolly» med lenken, til et innlegg eller et lysbilde.

Når et verktøy har personlige felt, for eksempel navnet ditt, holder **Review personal fields** hvert felt utenfor lenken til du krysser av for det. [URL-modus](/info/url-mode.html) dekker alt en lenke kan inneholde.

**Dialogen sier hva en lenke ikke kan inneholde.** Lolly teller alt som ikke får plass i en adresse mens lenken bygges. Hvis noe ble utelatt, viser dialogen hva det var og viser til filalternativet. En lenke som bare er lang, får en mildere merknad med antall tegn.

**Noen verktøy gjør lenken til hele produktet.** Jump Page samler lenkene dine på én side du kan dele: en biolenke, et foredrag eller en butikkfront. Siden er lenken, så ingenting driftes på en server og ingen konto ligger bak siden. Besøkende ser siden i full bredde, med én lenke per scene mens de ruller.

![Jump Page i redigeringsprogrammet: overskriftsscenen øverst på siden, med lenkescenene under](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Lenker administrert av organisasjonen med Lolly Work
For deling som krever utløpsdato, tilbakekalling eller passord, tilbyr Lolly Work administrerte lenker til delte økter, verktøy og katalogressurser. De åpnes via organisasjonens tjeneste og følger tilgangsreglene deres. De er atskilt fra de selvstendige lenkene ovenfor. Å tilbakekalle en lenke kan ikke hente tilbake en fil noen allerede har lastet ned. [Gjengivelse og deling](/info/manage/sharing.html) lister lenketypene og tillatelsene.
:::

### .lolly-filen

**Download .lolly**, i delen **Editable file** i Share-dialogen, skriver det gjeldende designet som én fil. Vanlig kataloggrafikk følger med sammen med bildene og filene fra denne enheten. En utdatert eller utilgjengelig fil beholdes som en ekstern referanse. Før lagring viser dialogen filstørrelsen, hvor mange filer som bygges inn, hvor mange den refererer til og om verktøyet er inkludert. Hvis enheten har et delingspanel, sender **Send to…** filen dit (AirDrop, Android-deling).

**Download project (.lolly)**, i menyen til en mappe i **Projects**, skriver en hel mappe, slik at noen andre kan fortsette med alle øktene i mappen. Batchøkter utelates, og meldingen sier hvor mange. **Download originals**, i samme meny, skriver en vanlig zip der hvert element er en egen fil.

Før filen sendes, bestemmer du tre ting:

- **Om navnet ditt skal være med.** Navn, e-post og organisasjon skrives bare når **Use my details to create** er på i [profilen din](/info/profile.html). Når valget er av, registrerer filen bare at den ble laget med Lolly, og når.
- **Om tilbakeholdt grafikk skal være med.** Lisensiert grafikk og grafikk som er låst til en merkevare utelates som standard, og det samme gjelder katalogverk med en registrert lisens som Lolly ennå ikke kan lese. Hvis designet bruker slike, sier dialogen hvor mange og tilbyr *Download without them* eller *Include and download*. Inkluderer du dem, får alle som åpner `.lolly`-filen tilgang til filene. Et katalogverk uten registrerte rettighetsopplysninger følger med, og dialogen lister hvert av dem slik at du kan sjekke før du sender. Filens `CREDITS.txt` lister hva som fulgte med og hva som ble utelatt, med begrunnelsen. [Opphavsrett og kreditering](/info/creative-rights.html) forklarer reglene.
- **Om verktøyet skal være med.** **Include the tool** pakker verktøyets egne filer, slik at designet åpnes på en enhet uten det verktøyet. Valget er avkrysset som standard for et tilpasset verktøy, for eksempel en forgrening, og ikke avkrysset for et verktøy i den signerte katalogen. I en byggversjon uten signert katalog regnes alle verktøy som tilpassede.

**Åpne en fil.** I skrivebords- og mobilappene dobbeltklikker eller trykker du på en `.lolly`, velger **Open with Lolly** eller sender den til Lolly fra delingspanelet. I nettappen trykker du på **Open** eller slipper filen på Lolly. Alle metodene leser først filens manifest og viser størrelsen, innholdet og hva som vil skje, før noe skrives.

::: warning Installasjon av et verktøy kjører koden det inneholder
Hvis filen inneholder et verktøy du ikke har, viser **Trust this tool?** verktøyet og forfatteren og sier at åpning kjører verktøyets egen kode på enheten din. **Trust & install** fortsetter.
:::

Hvis du avslår, lagres arbeidet likevel i Projects og venter til du legger til verktøyet. Et verktøy der koden leveres som en modul, kan ennå ikke installeres på denne måten og avvises på samme måte.

::: details Hva en .lolly inneholder, og hvordan den åpnes
`.lolly` er Lollys filendelse for pakker, og `format` i `manifest.json` angir hva pakken inneholder:

- Et **delt design** (`lolly-share`) inneholder én lagret økt, de innebygde filene og en kvittering for alt som fortsatt hentes via referanse. Det kan også inneholde verktøyet og designsystemet. Når du åpner det, legges et nytt prosjekt til, og en eksisterende økt overskrives aldri.
- Et **delt prosjekt** (`lolly-share`, type `project`) inneholder en mappe fra Projects: undermappene, alle øktene i dem med tilhørende fliser og bildene som er lagret der. Når du åpner det, legges en kopi av mappen til. Hver økt følger med som `sessions/<key>.json` med flisen under `thumbs/`. En Lolly-versjon fra før prosjektfiler fantes, ber deg oppdatere.
- En **designsystempakke** (`lolly-brand`) inneholder tokener og kan inneholde skrifter, logoer, publiserte versjoner og beholdte ressurser. Åpning av pakken legger til et eget navngitt designsystem og gjør det aktivt.
- En **arbeidsområde- eller instanspakke** er en `lolly-brand` med oppgitte verktøy, katalogressurser og eventuelt en instansadresse. Når du laster inn en slik pakke, erstattes det ene arbeidsområdeoverlegget som var lastet inn fra før, og forhåndsvisningen lister virkningene for hele enheten.

En full sikkerhetskopi av enheten er ikke en `.lolly`. Den forblir en `LollyTools-….zip` (format `lolly-backup`) og gjenopprettes gjennom **Settings → Storage → Import data…**. En zippet verktøymappe forblir også en `.zip`. [Dataoverføring](/info/data-transfer.html) er formatreferansen.

En `.lolly` er en vanlig zip. Gi den filendelsen `.zip` for å se innholdet. Dine egne bilder ligger under `assets/uploads/` og kataloggrafikk under `assets/catalog/`. `manifest.json` lister alle filene, og en README beskriver hva filen er.

macOS, Windows, Linux, iOS og Android registrerer alle formatet. Filbehandlere på skrivebordet viser filen som et Lolly-dokument, og GNOME Files kan vise den lagrede øktens eget miniatyrbilde. Når du åpner fra Lolly Design System Setup, anbefales designsystemhandlingen hvis et delt design inneholder et designsystem, men **Open shared design** skjules aldri.

På iOS og Android er dokumenter som overføres fra en annen app begrenset til 48 MB, og appen sier fra om det. Overføringen kopierer bytene på tvers av appgrensen. **Open** inne i Lolly har ingen slik grense, så bruk det for en større pakke.

Etter at du har bekreftet, pakker Lolly ut og verifiserer pakken én gang. Ressursene legges i biblioteket ditt og sammenlignes ved hjelp av sjekksum, slik at filer som allerede finnes på enheten gjenbrukes. Økter legges i Projects med nye id-er, slik at samme fil kan åpnes to ganger. En økt som mangler verktøyet sitt, venter der. Filer over 100 MB merkes som store, og forhåndsvisningen varsler når nettleserlagringen rapporterer mindre ledig plass enn filen trenger. Alle deler som omfattes av integritetskontrollen sjekkes før noe lagres permanent, og en skadet kopi avvises uten at noe blir liggende igjen.
:::

Både en lenke og en fil overfører et øyeblikksbilde. For redigering i sanntid dekker [Arbeid sammen](/info/collaborate.html) private samarbeid mellom to enheter og valgfrie arbeidssamarbeid gjennom Lolly Work.

<!--i:eti-images-->
## Ressurser - biblioteket ditt

**Lolly Assets** (`#/a`) inneholder det verktøyene dine kan bruke: merkevarelogoer, bilder, lyd og bevegelse, gruppert etter type, og dine egne filer. Opplastingene dine lagres på enheten din. En organisasjon som bruker Lolly Work kan også tilby en delt katalog under sine egne tilgangsregler ([Bruk Lolly i organisasjonen din](/info/organisation.html)).

![Assets, med merkevarens fargeprøver og skrifter og dine egne opplastinger](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Legg til filene dine.** Slipp et bilde, SVG, lydklipp, video, Lottie, PDF eller en PowerPoint-presentasjon på opplastingsområdet, eller klikk for å velge. Filen vises med én gang i Assets og i ressursvelgeren til hvert verktøy. En PDF med flere sider eller en `.pptx` spør hvilke sider eller lysbilder du vil beholde, og hver av dem blir en SVG-ressurs. Et bilde du legger til inne i et verktøy beholdes uendret i **My images**, slik at en Content Credential på bildet fortsatt kan verifiseres. Bare en svært stor fil utløser spørsmål om størrelsen skal endres. **Settings → Storage** viser hvor mye **My images** inneholder. Det finnes ingen annen grense enn lagringsplassen på enheten din. For å fjerne EXIF- og GPS-data ved opplasting slår du på **Strip metadata from uploads** under **Settings → Feature flags**. Content Credentials beholdes uansett.
- <!--i:star--> **Favorittmerk det du bruker ofte.** Stjernemerk en ressurs eller en fargeprøve fra merkevaren, så festes den øverst i alle velgere.
- <!--i:folder--> **Rydd opp.** Flytt en ressurs til en annen gruppe, skjul en delt merkevareressurs du ikke bruker (**Show hidden** viser den igjen) eller slett dine egne opplastinger. Den samme markeringslinjen som i Projects virker på hele utvalget.
- <!--i:layers--> **Fjern bakgrunnen fra en video.** Åpne detaljene for en video, eller høyreklikk på kortet i en ressursvelger, og velg **Remove background…**. En **On-device model** klipper ut motivet fra en travel scene. En **Colour key** fjerner en jevnt belyst bakgrunn, som en grønnskjerm, og krever ingen nedlasting. **Tolerance**, **Softness** og **Spill removal** finjusterer kanten. **Resolution** (360, 480, 720 eller 1080p, aldri høyere enn kilden) avveier detaljnivå mot hastighet. Det utklipte resultatet er en animert WebP eller PNG med gjennomsiktighet, lagret ved siden av originalen. Kildens Content Credential følger med resultatet som en bestanddel. [Generert én gang, gjengitt likt](/info/ai-features.html) forklarer hvorfor dette fortsatt er en vanlig redigering.

### Ta med paletten og skriftene overalt

Panelet **Swatches** i Assets viser merkevarens farger: merkevarefargene, farger du har lagt til, fargeskalaene og spekteret. Rollefargene Lolly bruker i grensesnittet (tekst, flater, kanter, hovedfarger i fargevarianter og kopier av en merkevarefarge under et annet navn) ligger bak et grått **Show colour roles**-kort nederst i panelet.

Hver farge er et kort, som alle andre ressurser. Klikk på et for å åpne detaljene, velg noen for å laste ned disse eller last ned hele paletten i formatet det andre verktøyet ditt leser:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** eller **CSS classes**, til et stilark eller en byggprosess. En farge med større fargerom enn sRGB beholder den utvidede verdien: CSS setter den etter heksadesimalverdien, og JSON beholder heksadesimalverdien sammen med den utvidede fargen, CMYK-sammensetningen og spesialfargen.
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**, til Illustrator eller Photoshop. En farge låst til en CMYK-sammensetning kommer inn som den CMYK-fargeprøven, en spesialfarge som en navngitt spesialfargeprøve og en farge utenfor sRGB som Lab.
- <!--i:pentool--> **GIMP palette (.gpl)**, til GIMP eller Inkscape, og **SCSS variables**, begge i sRGB.

![Swatches-panelet - de fem knappene for palettnedlasting øverst, deretter hver merkevarefarge som en brikke som åpner fargens detaljer](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

::: details Velg flere farger, eller åpne detaljene for én farge
Velg farger med prikken på hvert kort: Shift-klikk på en annen prikk for å velge alt imellom, dra en boks gjennom mellomrommene eller trykk Cmd/Ctrl+A med et kort i fokus. Linjen tilbyr **Download as…** i de samme seks formatene, **Copy hex** og **Favourite**. Før du velger et format, lister menyen eventuelle farger ingen formater kan inneholde (Transparent har ingen farge), hvilke formater som lagrer en utvidet farge som sRGB-reserveverdien (SCSS og GIMP) og hvilke som tar med CMYK- og spesialfargeverdiene (JSON og .ase). Høyreklikk på et kort for de samme handlingene på én farge.

Detaljene for en farge fyller forhåndsvisningen med fargen og folder ut **Linked values** (CMYK-sammensetningen eller spesialfargen, eventuelle verdier laget for et bestemt fargerom eller en trykkpresse og designtokenet), **Every notation** (heksadesimal, OKLCH, Display-P3 og resten, hver med en kopieringsknapp), **Plotted on a colour space**, **Tones** og **Readability**. Piltastene går gjennom paletten, **Copy link** deler fargen og **Open in Colour Lab** åpner fargen for videre arbeid.
:::

Panelet **Fonts** lister merkevarens skrifter med **download** for hver, slik at du kan installere dem lokalt eller gi dem til et trykkeri.

<!--i:eti-grid-->
## Tilpass rutenettet

- <!--i:star--> **Favorittmerk det du bruker.** Høyreklikk på et kort og velg **Add to favourites**. Verktøyet får en stor flis i en stripe over rutenettet. [Favorittene dine](/info/favourites.html) dekker stripen.
- <!--i:eyeoff--> **Skjul et verktøy du aldri bruker.** Høyreklikk på et kort, eller velg flere, og velg **Hide tool**. Det forsvinner fra rutenettet og fra resultatene når du skriver i rutenettet. Verktøyet fjernes fra rutenettet og gir ikke lenger treff når du skriver i det. En grå **Show hidden tools (N)**-flis til slutt viser skjulte verktøy igjen, nedtonet og med **Unhide tool** i hver meny. Skjuling endrer bare ditt rutenett: verktøyet kan fortsatt åpnes fra en lenke eller et bokmerke.
- <!--i:clock--> **Dine verktøy først.** Når du har lagret arbeid i tre forskjellige verktøy, viser en **Yours**-rad med brikker over rutenettet favorittene og de siste verktøyene dine først.
- <!--i:sliders--> **Ordne det slik du vil.** **View options** angir layouten (**Grid**, **Card** eller **List**), kortstørrelse og tetthet, sorteringsrekkefølgen og et kategorifilter.

![Slutten av Tools-rutenettet med skjulte verktøy vist: det nedtonede Wordmark-kortet og den grå flisen ved siden av som viste det igjen, nå med teksten Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
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

**Utfør handlinger på flere kort samtidig.** Kryss av i avkrysningsboksen på hvert kort, dra en markeringsboks over et tomt område eller Shift/Cmd-klikk, så vises en linje med det visningen tillater:

- **Tools og Utilities:** Favourite, Hide, Available offline, **View sessions** (Projects, med bare øktene laget med disse verktøyene) og Copy link for ett enkelt kort.
- **Assets:** Favourite og Hide for alle utvalg. Duplicate, Download og Delete vises bare når alle valgte elementer er dine egne opplastinger, fordi en delt designsystemressurs er en varig kontrakt.
- **Projects:** se [Finn og gjenopprett arbeidet ditt](/info/find-your-work.html#find-something-you-saved).

![Markeringslinjen i galleriet for to verktøy, med Available offline, View sessions, Favourite og Hide](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
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

**View sessions** vises bare når noe er valgt. Høyreklikk på ett kort som ikke er valgt, for **N saved sessions**: en liste over verktøyets lagrede økter, der sletting flytter en økt til papirkurven.

<!--i:eti-layers-->
## På telefon

På en smal skjerm får layouten én kolonne:

- **Kontrollene blir et panel** øverst med et draghåndtak langs underkanten. Dra håndtaket for å feste panelet i **minimal**, **halv** eller **full** høyde, eller trykk på det for å folde sammen og ut. Forhåndsvisningen fyller plassen under og forblir synlig mens du redigerer.
- En flytende **Export**-knapp åpner eksportpanelet: format, størrelse, kopiering, lagring og nedlasting. Trykk på bakgrunnen for å lukke panelet.

![Et verktøy på en skjerm med telefonbredde - kontrollene som et panel øverst, den genererte paletten i forhåndsvisningen under og gjengivelsespillen flytende nederst i midten](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

<!--i:eti-copy-->
## Brettbare enheter og iPhone Duo

På en brettbar enhet, en iPhone Duo eller en nesten kvadratisk berøringsskjerm deler Lolly verktøyet i to paneler:

- **Kontroller på den ene siden, lerretet på den andre.** Kontrollene plasseres unna hånden du tegner med. Velg **Dominant hand** i **Settings → Accessibility**, eller trykk på **Swap sides** øverst i kontrollene. På språk som går fra høyre mot venstre, speilvendes sidene.
- **Skillelinjen følger hengselet.** Når enheten oppgir hvor bretten er, møtes panelene der, slik at ingen kontroller eller grafikk ligger over bretten. På en sammenhengende skjerm kan du dra skillelinjen til en tredjedel, halvparten eller to tredjedeler av bredden. Lolly husker valget for hver visning på denne enheten.
- **På bordet.** Når enheten er halvåpen med bretten på tvers av skjermen, fyller lerretet øvre halvdel og kontrollene ligger under bretten. Når du presenterer, vises lysbildet øverst, med notatene dine, neste lysbilde og **Back** og **Next** under. I Sequence vises forhåndsvisningen øverst og tidslinjen under.
- **Lolly Design, Design System Setup og Assets.** I Lolly Design ligger Inspector, lagene og eksportpanelet i faner ved siden av lerretet. Verktøyene står langs ytterkanten av lerretet, under tegnehånden din. Når verktøyene ikke får plass, kan kolonnen rulles, og en nedtoning med en pil viser hvor resten er. På bordet ligger verktøyene langs underkanten av lerretet. Lolly Design System Setup har Board på den ene siden og rommet du åpner på den andre. I Assets åpnes detaljene for en ressurs ved siden av biblioteket, slik at neste trykk viser neste ressurs på samme sted.
- **Ingenting på bretten.** Når en brett er registrert, åpnes dialoger på siden med kontrollene. Det samme gjelder søkefeltet nederst på startskjermen og resultatene. På en flat skjerm blir de i midten.
- **Ingenting går tapt når du bretter.** Når du bretter, folder ut eller snur enheten, beholdes dokumentet, utvalget, zoomen og feltet du skrev i, med markøren på plass.

Ytterskjermen på en brettbar enhet beholder telefonlayouten ovenfor, og det samme gjør et Lolly-vindu i den ene halvdelen av en delt skjerm.

<!--i:eti-smile-->
## Innstillinger, lyd og komfort

**Settings**, nederst på startskjermen, inneholder opplysningene dine, designsystemene dine, tilgjengelighet, lagring og nedlasting for bruk uten nett. [Lolly-innstillinger](/info/dashboard.html) gir en oversikt over alle fanene.

- **Opplysningene og portrettbildet ditt** fylles inn i verktøy som er laget for å bruke dem, for eksempel en e-postsignatur eller et navneskilt. [Profiler](/info/profile.html) dekker dem.
- **Accessibility** har fire brytere for komfort: **Reduce motion**, **Hide colourful previews**, **High contrast** og **Large text**. De endrer appen rundt arbeidet ditt, aldri lerretet i et verktøy eller en eksport. Ved siden av velger **Dominant hand** hvilken side kontrollene skal ligge på i en visning med to paneler.
- **Sound** spiller dempede støttelyder for handlingene dine, og **Neurospicy Mode** spiller et rolig lydspor for konsentrasjon. Begge er av til du slår dem på i **Settings → Accessibility** eller profilmenyen. Glidebryteren **Sound shape** under Sound-bryteren endrer lydene fra myke, runde dråper (Bouba) til tørre tikk og skrapelyder (Kiki), med Lollys klokkespill i midten. Sporene i Neurospicy omfatter Lollys genererte stasjoner: **Lolly Sings** med sjangrene sine og tre **Lofi stations**. Stasjonene lager uendelig musikk mens de spiller. Hver har kontroller for trommer og tekstur (og stemning på Lofi), en lenke for å dele melodien du hører og en knapp som lagrer melodien i ressursene dine. [Generert musikk](/info/generated-music.html) forklarer hvordan en melodi lages. **Music generator** under Utilities (`#/music`) lar deg forme en.
- **Available offline** laster ned resten av appen, verktøyene dine, katalogen og veiledningene før du mister forbindelsen. For å installere Lolly som en nettapp bruker du nettleserens installasjonsknapp, eller *Add to Home Screen* på telefon. Den installerte appen kjører i fullskjerm og oppdaterer seg selv når du er på nett igjen.
- **Performance UI**, under **Settings → Feature flags**, gir appen et enklere utseende som krever mindre å tegne. Lerretene i verktøyene og eksportene forblir de samme. På en treg enhet slår Lolly på dette utseendet selv og sier hvorfor, med **Undo** og **Keep** ([Performance UI](/info/configuration.html#curating-what-people-see)).
- **Storage** viser hva Lolly lagrer på denne enheten. [Hvis du sletter nettleserdataene dine](/info/find-your-work.html#if-you-clear-your-browser-data) forklarer hva som fjernes ved sletting, og [personvernerklæringen](/info/privacy.html) lister alt appen henter eller sender.

::: note Hvis en visning ikke lastes inn etter en oppdatering
Et tomt panel eller meldingen «failed to fetch» rett etter en oppdatering forsvinner vanligvis når du laster inn på nytt én gang. Lagret arbeid, økter og designsystemer berøres ikke, fordi de lagres på enheten din. Bare et bilde du har lagt til uten å lagre, kan måtte legges til igjen.
:::

<!--i:eti-map-pin-->
## Veien videre

- **[Lolly Design: det frie lerretet](/info/design.html)**: lerretet, former, tidslinjen og det å vise en presentasjon.
- **[Batch og Lolly Multi-edit](/info/batch.html)**: mange versjoner av ett design, eller flere lagrede design som redigeres sammen.
- **[Eksporter en fil](/info/exporting.html)**: valg av format, størrelse, måleenheter for trykk, gjennomsiktighet og video.
- **[Importer et design](/info/design-import.html)**: hent en Figma-, Penpot-, Illustrator-, InDesign-, Affinity- eller DXF-fil inn i Lolly Design og fortsett å redigere.
- **[Maler](/info/templates.html)**: lagrede utgangspunkt for et verktøy.
- **[Utvidet fargerom og HDR](/info/hdr-editing.html)**: behold originalbildets presisjon i Lolly Design og Lolly Darkroom.
- **[Finn og gjenopprett arbeidet ditt](/info/find-your-work.html)**: hvor alt er, og hvordan du flytter det til en annen enhet.
