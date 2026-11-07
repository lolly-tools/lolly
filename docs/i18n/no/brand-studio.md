# Lolly Design System Setup

<a id="design-system-setup"></a>

Logoen, fargene og skriftene dine hører hjemme på ett sted, så hvert verktøy, hver side og hver eksport tegner med dem. Det stedet er **Lolly Design System Setup**, på `#/start`.

Start med det du har. Slipp inn en logo, så leser Lolly fargene dens. Velg en skrift, eller slipp inn skriftfilen bedriften din har lisens på. Hver endring vises over hele appen med en gang. Logoen, skriftene og tokenene dine blir på denne enheten. Å velge en Google Font er det ene trinnet som rekker ut: Lolly spør først, og henter deretter familien én gang.

Når det ser riktig ut, gi designsystemet et navn og trykk **Eksporter**. Du får én `.lolly`-fil å beholde, åpne på en annen enhet eller gi til en kollega. [Lolly Settings](/info/dashboard.html#design-system) viser det aktive systemet skrivebeskyttet, og omslaget lenker tilbake hit for redigering.

## Gjør det til ditt på fem minutter

::: timeline
- <!--i:upload--> **Slipp logoen din** på slippsonen i **Logos**. Lolly leser formen og fargene dens.
- <!--i:palette--> **Bruk disse fargene.** Logoens hovedfarge blir primærfargen din, og en mørk nøytral fra logoen blir tekstfargen din.
- <!--i:font--> **Velg en skrift** i **Type**: en Google Font, eller en skriftfil du eier.
- <!--i:pentool--> **Gi systemet et navn.** Den første redigeringen din lager et eget designsystem, og Lolly spør én gang om navnet.
- <!--i:download--> **Export** skriver hele systemet som én `LollyBrand-….lolly`-fil.
:::

Linjen øverst i studioet viser navnet på designsystemet, og navnet er et felt du kan endre når som helst: **Enter** beholder et nytt navn og **Escape** setter det gamle tilbake. Når den første redigeringen din spør **What is this design system called?**, fylles ordene fra logoen din inn hvis logoen staver dem ut. **Save name** beholder navnet; **Not now** beholder en plassholder til du skriver inn et i linjen. Navnet merker systemet i Settings og når du bytter, og det blir navnet på filen **Export** skriver.

## Rommene

Studioet er et sett rom uten fast rekkefølge: ingenting er nummerert og ingenting venter på noe annet. På en pc ligger rommene i én stripe under linjen. På en telefon flytter de seg til en linje langs nedre kant, der tommelen når dem, med det åpne rommet rullet til syne; palettarket og Tray stiger opp over den linjen, og linjen viker mens du skriver. Med tastatur når Tab stripen én gang, og piltastene, Home og End flytter fra rom til rom.

![Studioets linje og rommene: Board, Colours, Type, Logos, Tokens, Files, Rules og Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Rom | Hva du gjør der | Lenkenøkkel |
|---|---|---|
| **Board** | Se hva systemet holder, med en dør inn til hvert rom | `overview` |
| **Colours** | Legg til farger, gi dem roller, bygg nyanser og en palett | `color` |
| **Type** | Velg de fire skriftene appen, verktøyene og hver eksport leser | `type` |
| **Logos** | Plasser merkene dine i hver retning og behandling | `logos` |
| **Tokens** | Hjørner, avstand, skygger og alle andre navngitte verdier | `tokens` |
| **Files** | Bilde-, lyd- og bevegelsesfilene merkevaren din beholder | `catalogue` |
| **Rules** | Reglene merkevaren din bruker, kontrollert på ekte eksempler | `usage` |
| **Skills** | Merkevarens skrevne standarder for folk og agenter, til å lese og laste ned | `skills` |

Lenk til et rom med `#/start?area=<key>`. Rommet Files beholder nøkkelen `catalogue`, Board beholder `overview` og Rules beholder `usage`, fordi en romnøkkel er en permanent kontrakt, og `?tab=` fungerer fortsatt som et eldre alias. En ukjent nøkkel åpner Board.

**Linjen** holder handlingene for hele systemet i stedet for ett rom. **Add from…** henter inn en merkevare ([Bring a brand in](#bring-a-brand-in)), og **Tray** holder det en skanning fant som du ikke har lagt til ennå. **Export** skriver systemet som én fil, og **More** holder **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions & publishing**, **Restore brand settings** og **Design systems**, som åpner listen i Settings der du bytter ([Keep and move your design system](#keep-and-move-your-design-system)). Hver vises når det er noe for den å virke på. På en telefon flytter **Add from…** inn i **More**, og **Export** vises som ikonet sitt.

## Board

Når ingenting er valgt ennå, tilbyr Board fire måter å starte på. **Start from a reference** åpner kildevelgeren for en logo, et skjermbilde, en nettside eller en designfil, og **Pick a colour**, **Choose a face** og **Add a logo** åpner disse kontrollene direkte. Å åpne en skriver ingenting, og **Explore the tools** er der fra starten.

Når noe er ditt eget, viser Board hva du har, med dine egne tall først. Colours oppgir antall farger, med en dempet `· N starter` der arvede farger vises; stripen setter fargene dine først, deretter en hårstrek, deretter de bleke starterfargene. Colourways viser hver colourway som en liten flis i hovedfargen. Type leses etter rolle og setter hver familie i sin egen skrift (*Inter for headings*, med *Starter for the rest* på linjen under). Logos sier hvor mange plasser som er fylt (eller **Not set**), Tokens viser hjørneradiusen og Files sier **Nothing yet** mens biblioteket er tomt. Hver blokk åpner rommet sitt.

Et designsystem som fulgte med appen og kan redigeres, som Lolly Demo, har alt dette fra starten: Board viser fargene, colourways, skriftene og merkene, med en **Came with this app**-tagg ved siden av overskriften.

### Starter og ditt eget

**Starter** er ordet for alt som fulgte med appen i stedet for å være valgt. En ny installasjon bærer ingen farge i det hele tatt, bare én nøytral ramp fra blekk til papir, slik at flater, tekst og hårstreker kan gjengis før noen har bestemt noe. Det samme ordet markerer arvet materiale i hvert rom.

::: cols
## Starter

- Fulgte med appen: nøytralene fra blekk til papir, starterskriftene, standard hjørneradius.
- Dempet, med et **Starter**-merke og uten tone.
- Ikke regnet som fargene dine. Nøytralene ligger i **Tokens** som **Neutrals · starter · 9**, og **Open** viser dem i Colours som én foldet gruppe (`#/start?area=color&group=neutral`).
- En rolle som står på en starterfarge, leses *"Starter Paper stands in"*, med **Choose…** på velgeren sin.

## Ditt eget

- Valgt eller installert av deg.
- Full styrke, og et tonet kort der du installerte en skrift.
- Regnet med på Board og i Tokens.
- En rolle som følger en annen, leses **↳ follows Primary** i stedet for å gjenta primærfargens navn.
:::

Arvet materiale tegnes aldri med en stiplet kant, fordi en stiplet kant her betyr et slippmål.

## Logoer

Tøm mappen med merker i slippsonen øverst: **"Drop marks here, or choose several at once"** tar så mange filer du har. Hver fil leses for formen og blekket sitt, og venter deretter under **Waiting for a slot** som en brikke som sier hva den ligner, som *"Looks like the Horizontal primary"*, med målingen den brukte og en **Place**-knapp (**Replace** der plassen er fylt). Der den er usikker, sier brikken det og tilbyr **Change slot**, som lister alle åtte. Ingenting plasseres før du trykker på noe.

Et merke med overskytende tom marg får først et tilbud om beskjæring; svar på det eller trykk Escape, så går originalen inn urørt. Der et merke kan fylle en tom søskenplass, tilbyr rommet den utledede **mono**- eller **reverse**-versjonen som en brikke merket *Generated*.

Hvert merke havner i et rutenett med åtte valgfrie plasser, én per **orientation** og **treatment**:

- **Orienteringer:** Horizontal (ordmerke og symbol på en rad) og Vertical (stablet, for kvadratiske og høye flater).
- **Behandlinger:** Primary, Primary reverse (for mørke bakgrunner), Mono (én farge) og Mono reverse.

En gruppe uten merker ennå folder seg til én linje; åpne den for å se plassene. Klikk på en plass for å legge til en PNG, SVG, JPEG eller WebP, eller klikk på en fylt plass for å erstatte merket. Alt blir på denne enheten.

![Logoplassene med Horizontal og Vertical åpnet: hver behandling er en egen plass, og hver plass er valgfri](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&system=new-design-system&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails.be-logo-group--fold%3Anot%28.be-logo-group--custom%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** er merker merkevaren din kaller ved eget navn, som et ikon, et våpenskjold eller et favicon.
- **Flere identiteter.** En underbrand, et produkt eller et arrangement kan ha sitt eget fulle sett: **+ Add another logo** og gi settet et navn. Hovedsettet ditt er "Your logo". [Brand architectures](/info/brand-architectures.html) viser når en logoidentitet er den riktige blokken.
- **Lolly leser logoens farger.** Et kort under slippsonen, og igjen øverst i Colours, lister logoens farger og spør **Which is the main colour?**, med den sterkeste fargen allerede valgt (aldri det hvite den ble eksportert på). **Use these colours** legger dem til i paletten din, gjør hovedfargen til primærfargen din og, når logoen har en mørk nøytral som leses på papir, gjør den til tekstfargen. **Not now** lar dem ligge i Tray. På en splitt ny installasjon brukes det mest sannsynlige svaret med en gang, og kortet tilbyr **Undo** eller en annen hovedfarge. En SVG gir eksakte farger; en PNG, JPEG eller WebP gir fargene som dekker en reell andel av merket.

## Farger

Rommet vokser med designsystemet: et første besøk er én beslutning, og resten kommer etter hvert som paletten gjør det.

### Den første fargen

Et system uten egne farger viser starterens nøytrale farger, åpne i sin egen gruppe, og øverst i rommet et stiplet lim-og-slipp-felt: én stor brikke og ett felt. Slipp et bilde eller en liste med farger hvor som helst på feltet, så leser Lolly fargene fra det du slapp.

- **Brikken er velgeren.** Trykk **Velg en farge**, så åpnes studioets OKLCH-kort, forhåndsutfylt med det feltet holder: først fargens navn og hex, med fargerommene, hjulet, de fire skalaene og alfa under **Finjuster**, og **Avbryt** og **Legg til farge** nederst. Ingenting når systemet før du trykker **Legg til farge**.
- **Feltet tar hvilken som helst notasjon**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` eller et fargenavn. Lim inn en liste, så blir den en rad med brikker å legge til én om gangen eller med **Legg til alle**.
- **To veier til.** **Velg en farge fra skjermen** bruker pipetten der nettleseren har en, og **Hent farger fra et bilde** leser et skjermbilde eller et bilde på denne enheten.
- **Legg til er aldri deaktivert.** Med ingenting i feltet åpner den velgeren; tekst den ikke kan lese, får en linje under feltet som sier det.

Den første fargen din blir **primary**, og en brikke bekrefter det, som *"Primary is now Vivid Violet"*, med **Fine-tune** for å justere fargen.


### Etter hvert som paletten vokser

Fargene dine ligger ved siden av en **I sammenheng**-forhåndsvisning på en bred skjerm, og over den på en mindre. Forhåndsvisningen viser en plakat, et diagram eller et grensesnittkort i paletten din. Starterfargene blir i sin egen sammenfoldbare gruppe, som folder seg sammen når systemet har egne farger, og lim-og-slipp-feltet blir én kompakt rad. Eksport ligger i **Eksporter** i linjen og i rommet Tokens, så rommets hode har ingen.

![Rommet Colours på Lolly Demo: paletten i sammenfoldbare grupper, hver farge med navn og hex, og palettnedlastingen i hodet](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![Rommet Farger på Lolly Demo etter at én farge er lagt til: tabellen Fargeroller, så den nye fargens brikke med Bruke som Hovedfarge? og Finjuster, ved siden av en levende komposisjonsforhåndsvisning](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Fargeroller: hva fargene kalles

Designsystemet sier hva fargene kalles og hva hver av dem er til for, og Lolly leser det. **Fargeroller** ligger øverst i rommet Farger. På en bred skjerm deler **I sammenheng** visningen, så en endring vises på plakaten, diagrammet og grensesnittkortet mens du gjør den.

![Tabellen Fargeroller på Wefthouse, et oppdiktet tekstilmerke, med egne ord: fargevariantbrikkene Indigo, Madder og Weld, så Main, Accent, Supporting og Tertiary, hver med sin lyse og mørke farge, lest som hovedfargen, partnerfargen og bare ved navn, og Bakgrunn, Tekst, Dempet tekst og Hårlinjer oppført under tabellen som lesningene ingen rolle fyller](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=wefthouse&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

Tabellen har fire kolonner, og på en telefon blir hver rad et kort som holder lys og mørk side ved side:

| Kolonne | Hva den holder |
|---|---|
| **Rolle** | Designsystemets eget ord, som du kan redigere på stedet, og en linje som sier hva fargen er til for |
| **Lys** og **Mørk** | Fargen i det utseendet for den valgte fargevarianten, med navn eller verdi, og kontrasten |
| **Lolly leser dette som** | Hva et verktøy gjør med rollen, med Lollys egne ord |

**Hvordan Lolly leser en rolle.** Hver lesning tar én rolle, så hvis du velger en lesning en annen rolle holder, flyttes den lesningen hit. Lolly leser aldri mening ut av et ord.

| Lesning | Hva som følger av den |
|---|---|
| **Hovedfarge** | Store former, knapper, fargen et verktøy leder med |
| **Partnerfarge** | Den andre fargen et verktøy griper til |
| **Bakgrunn** | Ligger bak alt annet |
| **Tekst** | Overskrifter og brødtekst |
| **Dempet tekst** | Bildetekster og liten skrift |
| **Hårlinjer** | Linjer, kanter og skillelinjer |
| **Bare ved navn** | Ingen verktøy velger rollen av seg selv. Den tilbys i hvert fargefelt og i Design, der et valg forblir koblet, så det følger fargevarianten |

En lesning ingen rolle fyller, blir som designsystemet definerer den, og rommet lister dem under tabellen. En rolle som deler id med en lesning, for eksempel en rolle som heter Primary, er den lesningen og kan ikke flyttes.

**Verdier.** Trykk på en verdi for å velge en farge for den rollen, i det utseendet, i den valgte fargevarianten. **Samme som lys** får den mørke verdien til å følge den lyse til du velger en egen farge. Brikken **Aa** viser teksten Lolly velger å legge oppå fargen, og linjen under verdien sier hvordan den teksten leses, per utseende: **Teksten er lett å lese**, **Bare stor tekst** eller **Vanskelig å lese som tekst**. Det gjelder tekst på fargen og sier ingenting mot selve fargen, som fortsatt kan fungere til former og store flater. En rolle som leses bare ved navn, viser de samme ordene uten advarselsfargen, fordi ingen verktøy legger tekst på den av seg selv. Tallene bak ordene, APCA først og WCAG sist, står i verktøytipset og i velgeren. **Egen tekstfarge** merker en verdi der filen oppgir tekstfargen, som blir stående. **Kopiert** merker en verdi som kom fra en annen fargevariant eller fra partnerfargen og som ingen har valgt ennå; **Behold denne fargen** i velgeren avgjør verdien.

**Utgangspunkter.** Et designsystem uten egne roller viser dagens ord: Primary, Secondary, Surface og Text. Ingenting skrives før du endrer en. **+ Legg til en rolle** tilbyr **Primary, Secondary** eller **Main, Accent, Supporting, Tertiary** som forslag, eller hvilke ord du skriver selv, med lesningen hvert ord ville få. De to første ordene blir hovedfargen og partnerfargen. Verktøy tegner fortsatt de samme fargene, og i et system med én hovedfarge er den første fargevarianten oppkalt etter den fargen.

**Gi nytt navn, endre rekkefølge, fjerne.** Et nytt navn endrer bare ordet, så alt som bruker rollen fortsetter å virke. Dra en rolle i håndtaket, eller trykk Mellomrom på håndtaket, bruk piltastene og trykk Mellomrom for å slippe. **Fjern** sier hva som fortsatt bruker rollen. Når verktøy leser den, lar **Fjern og behold disse fargene** hver lesning beholde fargen den tegner med nå. En intern regel, en veiledningsgruppe, et verktøyfelt eller et annet token som bruker rollen, holder den til bruken endres. Et lagret Design-dokument kan også bruke en rolle ved navn, og Lolly kan ikke se det fra token-filen: et dokument som gjør det, rapporterer fargen som uløst.

**En håndskrevet fil.** Farger en token-fil holder som ingen rolle deklarerer, står oppført under **I denne filen, uten rolle ennå**, hver med et felt for et ord og **Lag en rolle**. De fortsetter å virke ved navn uansett. Et token med sifre i navnet kan ikke være en rolle, så det blir i filen og virker fortsatt via banen sin. En post i filen som ikke validerer, viser tabellen uten kontroller og sier hvorfor.

**Resten av rommet bruker de samme ordene.** Brikkene, fargeprøvens rad **Bruk som** og paletens gruppe **Fargeroller** bruker alle designsystemets ord, og flisen til en fargerolle åpner verdien sin. Eksporterte filer registrerer ikke noe nytt om roller: fargene i en gjengivelse endres fordi tokenene endret seg.

**Hvor ordene går.** Ordene og beskrivelsene følger med designsystemet. Agenter leser dem i designbriefen, `lolly://tokens` og en merkevaresides `AGENTS.md`, terminalen viser dem i `lolly system status`, og en merkevareside lister dem i `brand.json` og måler et kontrastpar for hver rolle. Hvert eksportformat beholder det det har plass til: DTCG- og Tokens Studio-filer beholder alt, `DESIGN.md` beholder ordene og lesningene, og et PowerPoint-tema beholder bare merkevarens rekkefølge. [Colour roles in other formats](/info/design-tokens.html#colour-roles-in-other-formats) har hele listen. Ord siteres alltid som designsystemets data og leses aldri som instruksjoner.

**Hvor en farge velges.** Hvert fargefelt i et verktøy og i Lolly Design leder med designsystemets roller, i sin egen rekkefølge, med hvert ord og hva fargen er til for synlig. **Aa** ved siden av en rolle velger fargen som ligger på den rollen. Resten følger under **Andre farger**, uten en fargevariants egne kopier, på-fargene og enhver lesning en rolle allerede fyller. Et valg forblir koblet til rollen og følger fargevarianten, feltet fortsetter å vise ordet uansett hvilken fargevariant som er valgt, og Innstillinger og Tokens bruker også ordet. Et designsystem uten roller beholder rutenettet av fargeprøver det alltid har hatt.

### Hver farge et verktøy leser

Med **Fargeroller** lukket leder de første valgene rommet som brikker, hver med fargen som spiller rollen og navnet. I et system uten egne ord er disse **Primary**, **Secondary**, **Surface** og **Text**. Trykk på en brikke for å velge fargen fra paletens egne fargeprøver. **Hver farge et verktøy leser**, nederst i **Fargeroller**, har hele stripen.

Stripen viser de sju fargene et verktøy kan lese: Primary, Secondary, Surface, Text, Muted, Edge og On primary, med designsystemets egne ord der det har noen. Hver av dem spiller samme del i hvert verktøy og hver eksport. Ingen av dem må settes (tre løse farger utgjør et godt system), enhver farge kan fylle én, og avlesningen sier hvordan tekst leses, målt mot flaten, APCA først. Hver rad viser en egen farge i full styrke, en starterfarge som står inne, eller **↳ følger Primær**.

On primary utledes fra primærfargen, leses **Avledet** og har ingen velger. Bryteren **Lys** og **Mørk** ved siden av, og den ved siden av **I sammenheng**, velger hvilket utseende stripen, paletten og forhåndsvisningen viser.

Appens egen aksent følger designsystemet som standard. Det er innstillingen **Interface follows the design system** i **Settings → Appearance**; å slå innstillingen av lar appens ramme være nøytral, mens verktøy, lerreter og eksporter følger designsystemet uansett.

**Fargevarianter.** Et designsystem kan holde flere hovedfarger, hver valgt per arbeid. Raden **Fargevarianter** øverst i **Fargeroller** viser én brikke per fargevariant, med **Standard** på den kanoniske. **+ Legg til** starter en ny fargevariant fra en av palettens farger. Velg en brikke, så viser tabellen, stripen, paletten og forhåndsvisningene den fargevarianten; den valgte fargevarianten kan gis nytt navn, dupliseres, gjøres til standard eller fjernes. I et system med fargevarianter trenger hver fargevariant sin egen primær- og sekundærfarge, og sin egen flate når fargevariantene tonet bakgrunnen, så disse rollene forblir satt i fargeprøveredigereren. [Add colourways to a design system](/info/colourways.html#add-colourways-to-a-design-system) har trinnene og tokenformatet, og [Lolly Demo in use](/info/lolly-demo-in-use.html#colourways-on-real-work) viser fargevarianter på ekte arbeid.

### Finn flere farger

Tre verktøy bygger på primærfargen din. De to første foreslår bare, og det tredje erstatter paletten etter at du har gjennomgått endringen.

::: cols
## Explore shades & harmonies

Velg en **Starting colour**, et **Scheme** (Mono, Complement, Analogous eller Triad) og hvor mange **Shades** (3 til 20, standard 5). **Fine-tune** setter UI-intensitet, kontrast og tekst på merkevare. Klikk på en nyanse for å legge den til, eller **Add 5 shades** for en gruppe. Fargene og rollene dine blir.

## Find matching colours

Velg en **Harmony**: Complementary, Adjacent, Triad, Tetrad eller Analogous (med **Accents** fra 2 til 5 og en **Angle** fra 10° til 45°). Hver kandidat har et generert navn og **+ Add**, ett trykk per farge.

## Rebuild the whole palette

Erstatter paletten fra én startfarge, etter en gjennomgang av hva som endres og hva som blir. Et sjekkpunkt tas først, og **Undo** tilbys etterpå.
:::

Alle tre bruker den samme perseptuelle fargematematikken (OKLCH) som motoren. I **Explore shades & harmonies** viser radene **Primary**, **Neutral** og **Secondary** de foreslåtte nyansene, og **Theme preview** viser lyse og mørke eksempler med kontrastavlesningene sine.

![Tre foreslåtte nyansegrupper, med individuelle legg-til-kontroller og en egen Theme preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Genererte aksenter, hver med en fargeprøve, et automatgenerert navn, heksfargekoden sin og en Add-knapp](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Å ta i bruk en generert palett

Åpne **Rebuild the whole palette…** og trykk **Preview full rebuild**. Gjennomgangen teller hvor mange roller som blir som du tildelte dem, hvor mange av dine egne farger som beholdes og hvor mange nyansekurver, trykklåser, skjulte nyanser og gradientstopp som forankres på nytt eller beholdes. **Apply rebuilt palette** bekrefter; **Cancel** endrer ingenting. Etterpå tilbyr kortet **Undo** med fokus på det, og sjekkpunktet tatt før byttet gjenoppretter hele systemet.

Et system med fargevarianter beholder hver fargevariant gjennom en gjenoppbygging. Den kanoniske fargevarianten følger den nye startfargen, og hver annen fargevariant beholder sine egne farger, sitt navn, sin rekkefølge og sine innstillinger. Gjennomgangen lister hvilken fargevariant som følger og hvilke som beholder fargene sine. Lolly bygger ikke om et system som koder fargevariantene sine på en måte det ikke kan redigere; kortet sier hvorfor, og ingenting endres.

### Ekspertdelene

Fire sammenfoldede deler ligger under forhåndsvisningen og rollene. Hver åpnes direkte med `#/start?area=color&focus=<name>`:

- **Explore shades & harmonies** (`focus=generate`), beskrevet ovenfor.
- **Shade curves** (`focus=curves`) former en ramp punkt for punkt, med separate kurver for lyshet, kromatisk intensitet og fargetone (L / C / H) og nyansene tegnes om mens du drar.
- **Contrast** (`focus=contrast`): **Contrast-lock** toner en ramp om for å treffe APCA-mål mot en bakgrunn du velger, og **Rotate hue** dreier hele rampen rundt hjulet.
- **Print** (`focus=print`) setter hva primærfargen blir på trykk: dens automatiske verdi, en festet CMYK-oppskrift eller en navngitt spotfarge.

### Paletten og hver fargeprøve

Paletten lister fargene dine i sammenfoldbare grupper, hver med sin egen **+ Legg til**. Lag og gi nytt navn til grupper som du vil. En rolle lager aldri en andre flis: en flis en rolle peker på, bærer rollens navn i stedet, for eksempel **Primær**. **Fargediagram** under flisene viser de samme fargene på OKLCH-**hjulet** (dra en prikk for å farge på nytt, klikk på tom plass for å legge til en fargeprøve) og **Fargeomfang**-diagrammet, som viser hvor det visbare området slutter. `#/start?area=color&focus=chart` åpner diagrammet direkte.

![Palettpanelet, hver gruppe sammenleggbar, med palettnedlastingen i hodet](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![OKLCH-hjulet - vinkelen er valør, avstanden ut er kroma, og gråtonene følger en lyshetsskinne nedover siden](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Klikk på en fargeprøve for å åpne redigeringsprogrammet:

- **Gi nytt navn** til fargeprøven.
- **Sett fargen** på OKLCH-skalaer, eller i **Hex**, **HSL**, **RGB** eller **CMYK**. Verdifeltet leser og skriver i det aktive rommet. CMYK her setter skjermfargen ved konvertering; for å låse eksakte trykkfarger, bruk **Trykkerstatninger**.
- **Lagret som** velger hvordan fargeprøven lagres: **LCH** (standard, perseptuell og vidgamut), Hex, RGB eller HSL.
- **Bruk som** gir fargeprøven en rolle direkte, med designsystemets egne ord der det har noen. Trykk på en uthevet rolle igjen for å fjerne rollen.
- **Trykkerstatninger** (foldet): lås **CMYK** fra **Auto** til eksakte trykkfargeverdier, eller sett en **Spotfarge** med et **Navn** (som `PANTONE 186 C`), en valgfri **Book** og en **Overflatebehandling** for folie, preging, blindpreging, punktlakk, soft touch eller en stans, falsing eller perforering. Et trykkeri bruker disse låsene når du eksporterer en CMYK-PDF eller TIFF; se [Colour profiles](/info/exporting.html#colour-profiles).
- **I andre rom** (foldet): en verdi per fargerom, utledet eller skrevet av deg, og en skrevet verdi vinner ved eksport.

**Å slette en fargeprøve** er trygt. Utledede nyanser og temaroller skjules, så ingenting som leser dem, går i stykker, mens farger du la til, fjernes.

::: details Å arbeide med mange fargeprøver
Hver fargeprøve har et dragehåndtak. Dra for å omorganisere innenfor en gruppe, eller sett fokus på håndtaket, trykk Space, bruk piltastene og trykk Space igjen for å slippe; Escape avbryter. På en telefon viser paletten fire farger per rad, og håndtakene vises i Select-modus, i stedet for som en rad under hver farge. For å flytte farger mellom grupper, bruk redigeringsprogrammets **Group**-kontroll eller velg flere og bruk **Move to**.

Utvalg trenger ingen egen bryter. Linjen og avkrysningsboksene vises med den første valgte flisen og forsvinner med den siste.

- **Dra på tomt område** for å tegne et rektangel; hver flis det berører, blir med i utvalget, på tvers av grupper. En sammenfoldet del legger ikke til noe.
- **Shift-klikk** tar et område i leserekkefølge, **Cmd/Ctrl-klikk** veksler én flis, og et vanlig klikk åpner redigeringsprogrammet.
- Hver gruppeoverskrift har **Select all**, og **Cmd-A** med en flis i fokus tar hver farge du eier, aldri en starterfarge.
- Rutenettet har ett tabulatorstopp: piler flytter, Shift-piler utvider, Space veksler, Delete fjerner og Escape tømmer. For å dytte en kanal, trykk `l`, `c` eller `h` først.
- På en berøringsskjerm trykker og holder du en flis for å starte et utvalg, og trykker deretter for å legge til.

Linjen leses **{n} selected**, deretter **Move to**, **Give a role** (hver farge tar neste rolle i tur), **Download** (utvalget i et av de seks palettformatene), **Duplicate** (en kopi av hver, plassert etter originalen), **Copy values** og **Delete**. Én kopi åpnes rett i redigeringsprogrammet; flere forblir valgt. Ett Cmd/Ctrl-Z angrer en hel massehandling.
:::

### Gradienter

Det valgfrie panelet **Gradients** bygger blandingstokener fra paletten. Hver gradient har en forhåndsvisning, 2 til 8 navngitte stopp og en vinkel. Et stopp peker på en fargeprøve, så farg fargeprøven på nytt, og gradienten følger. Blandinger kjører i OKLCH.

Palettnedlastingene (designtokens, CSS, SCSS, GIMP og Adobe Swatch Exchange) ligger i hodet på paletten, ved siden av overskriften. [Take your palette and fonts anywhere](/info/using.html#take-your-palette-and-fonts-anywhere) beskriver hvert format.

## Skrift

Uten en egen skrift er rommet ett kort: **Primary**, satt i lesestørrelse i skriften som tjener det i dag, med et **Starter**-merke, en **Choose for Primary**-knapp og linjen *"Nothing installs until you choose one."* Headings, code og italic følger primærskriften til du velger dem; **Choose them separately** viser kortene deres.

![Typografi-rommet med ingen skrift valgt ennå - ett kort i lesestørrelse, en Start-tagg på det og en fylt Choose for Primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Velg én skrift, så åpner rommet seg til fire rollekort, Fonts-listen og et levende prøveeksempel:

- **Primary**: brødtekst, knapper og hvert verktøy.
- **Headings**: visningsskriften for `h1` og `h2`.
- **Code**: en skrift med fast bredde for kode og data.
- **Italic**: en ekte kursiv for utheving, sitater og sidebemerkninger.

Et kort er bare tonet der du installerte den skriften. Knappen sier hvilken rolle den gjelder: **Change Headings** på en skrift du eier selv og **Choose for Headings** overalt ellers. Prøvelinjen brytes i stedet for å kuttes. Ingenting på et kort bekrefter noe: knappen åpner sammenligningsscenen for den rollen.

![De fire rollekortene avdekket - hvert satt i skriften som betjener det, med en Start-tagg der ingen har valgt en, og Italic som følger primærfargen](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Sammenligningsstadiet

Scenen åpnes inne i rommet, under kortet du trykket på, og kortene folder seg til en enlinjes stripe slik at scenen vises på en telefons første skjerm. Escape avbryter og returnerer fokus til kortet.

1. Trykk **Choose for** og rollen på kortet.
2. Skriv et familienavn og trykk **Preview**, eller trykk på en av de seks **Pinned**-familiene under feltet.
3. Trykk **Use this face**.

![Sammenligningsflaten åpen under kortet sitt, med søkeraden, de festede familiene og kortene sammenslått til en enlinjes stripe](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**Samtykke spørres om én gang.** Første gang en forhåndsvisning når Google Fonts, forklarer en dialog: *Google learns the family name and your IP address. The file is then kept on this device and used offline. This is the one step in the studio that reaches a third party.* **Fetch from Google** går videre og huskes. **Cancel** lar kortet lese *"Not fetched. Nothing was sent to Google."*, med sin egen **Fetch from Google**.

**Slipp en skriftfil på scenen** (TTF, OTF eller WOFF) for å forhåndsvise en lisensiert skrift du allerede eier. Uansett blir skriften på denne enheten, gjengis uten nett i appen, verktøyene og hver eksport, og følger med i designsystemfilen. Alt på Google Fonts leveres under en åpen lisens (OFL, Apache eller UFL).

### Skrifter på denne enheten

Panelet **Fonts** lister hver skrift på denne enheten og rollen den tjener. Skrifter du la til, leder under **In the design system**, hver med sine roller og en sletting. Starterskriftene følger i én dempet, sammenfoldet rad. **Add a face** åpner sammenligningsscenen for en hvilken som helst rolle. Panelet **Type roles** viser et levende prøveeksempel av hver rolle med familie og tilstand, som *Inter* eller *Inter · follows Primary*.

## Tokens

Tokens er de navngitte verdiene bak designsystemet: farger, skrifter, logoer, hjørner og avstand. Verktøy leser dem ved navn, så en endring her når hvert verktøy samtidig.

![Rommet Tokens: toppen med et eksempel fra systemet og filhandlingene, fliser som teller hver type token, deretter fargeparene med kontrastavlesningene sine](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **The head** gir et eksempel fra ditt eget system (*Primary is Spearmint, #033633*) og filhandlingene: **Download** (hele systemet som designtokens, eller paletten i fem andre formater), **Copy CSS** og **Add from…** for å lese en JSON-fil inn igjen.
- **Tiles** teller hver type token og hopper til delen: Colours, Type, Logos, Shape and spacing, More og All tokens. De teller det hver del holder; en del som bare holder det som fulgte med den tomme startmalen, har en **Starter**-tagg, og et system som fulgte med appen teller sitt eget materiale uten tagg. På en telefon brytes flisene i to rader med tre.
- **Colours** starter med parene verktøy setter sammen (tekst på flate, på primær, dempet på flate) med en APCA-avlesning i lys og mørk, og flagger **Weak contrast** der et par kommer til kort. Deretter hver fargegruppe: en ramp som én rad med brikker, andre farger med verdien sin og referansen verktøy bruker, som `{color.brand.spearmint}`. Trykk på en referanse for å kopiere referansen. **Edit in Colours** åpner en gruppe i rommet Colours. I et designsystem med [fargeroller](#colour-roles-what-the-colours-are-called) kommer **Colour roles** først, med hver rolle én gang, med systemets egne ord og rekkefølge. En rolle har en farge for hver fargevariant og hvert utseende, og disse fargene blir hos rollen i stedet for å vises som egne farger: endre dem i tabellen Colour roles.
- **Type** og **Logos** lister skriften for hver rolle og hver logoplass, med **Edit in Type** og **Edit in Logos** når du har dine egne.
- **Shape and spacing** har **Rounded corners** (`shape.radius`) og **Spacing rhythm** (`space.base`). Hver leses *Lolly default* til du flytter glideren og *Yours* etterpå, lagrer med en gang og kan angres.
- **More tokens** legger til avstand, størrelse, strektykkelse, opasitet, rotasjon, rene tall og skygger, lagret som standard [designtokens](/info/design-tokens.html).
- **App appearance (advanced)** lister fargene, størrelsene og skyggene Lollys egne skjermer bruker, og **Inspect every token (advanced)** søker i og redigerer hvilken som helst lagret verdi, og viser hver endring til gjennomgang først. Der er verdiene til en fargerolle i hver fargevariant oppført sammen med rollen: velg rollens token for å se én rad per fargevariant, lys og mørk side om side, og tellelinjen sier hvor mange verdier rollene har. Et skrivebeskyttet designsystem viser den samme listen.

En del uten innhold tilbyr veien for å fylle hullet: **Pick a colour**, **Choose a face** eller **Add a logo**.

## Filer

Slipp filene merkevaren din beholder, bortsett fra logoer: **vector**-, **image**-, **audio**- og **motion**-filer (video, Lottie og animasjoner). De vises i [Assets](/info/using.html#assets-your-library), sortert i deler og klare i hvert verktøys ressursvelger, og de blir på denne enheten.

## Rules

**Regler** setter merkevarens valg i arbeid: hva folk kan endre, hva som er fast og hva Lolly kan sjekke.

![Regler på Lolly Demo: fire interne regler, hver merket Sjekket i Design og Obligatorisk eller Veiledende, så Prøv designsystemet ditt i bruk med eksemplene klare til å gjengis](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** lister reglene dine. **Add rule** (eller **Add your first rule**) åpner et kort skjema:

- et **Regelnavn** med dine egne ord, for eksempel *Beacon accents*;
- **Sjekken**: **Fargevalg**, **Skriftvalg**, **Fast grafikk** eller **Tekstlengde**, med merkevarerollen den bruker, under ditt eget navn på rollen;
- **Eksempelet** den gjelder for (Poster, Title slide, Content slide eller Lolly Chart), **Modus** og om den er **Obligatorisk** eller **Veiledende**;
- **Gjennomgått av**, så **Lagre utkast** eller **Godkjenn og lagre**.

Godkjenning registrerer din egen avgjørelse på denne enheten. Godkjente påkrevde regler begrenser den gjenbrukbare plakaten, og kontrollene dekker bare eksempel-PNG-ene; de endrer ingen andre verktøy.

Regler et designsystem har med seg i token-filen sin, som godkjente fargepar, tekstvekt og justering eller en logo per flate, står oppført her som **Sjekket i Design**. Lolly Design sjekker dem lag for lag i kortet **Før du eksporterer** i eksportpanelet, og `lolly check` gjør det samme for et lagret Lolly Design-dokument ([Before you export](/info/design.html#before-you-export)). En regel dette bygget ikke har noen sjekker for, beholdes som oppgitt og merkes **Ikke sjekket**.

Lolly Demo har med fire godkjente interne regler. Overskrifter settes aldri med store bokstaver: den regelen er obligatorisk, så `lolly check` rapporterer en overskrift med store bokstaver som en feil. De tre andre er veiledende. Brødtekst er venstrejustert. Primærmerker ligger på lyse flater og reverserte merker på mørke. Stiplede linjer betyr slipp her.

**Prøv designsystemet ditt i bruk** gjengir fire eksempler fra den nåværende revisjonen med **Gjengi og sjekk eksempler**. Velg en **Modus** og **Prøv din egen tekst** for overskriften, støttetekstene og lysbildeteksten. Hvert eksempel rapporterer hva som ble målt, med **Se sjekker og kilder** og **Last ned sjekkrapport**, og **Lag gjenbrukbar plakat** laster ned en `.lolly` der den faste layouten og de godkjente inndatavalgene følger med filen. Eksemplene er lokale: ingenting publiseres eller godkjennes ved å kjøre en sjekk.

Et bygg som leveres med en fast merkevare, viser de samme reglene og eksemplene skrivebeskyttet, under *This brand is set*.

## Skills

**Skills** lister det aktive designsystemets [brand skills](/info/brand-skills.html): merkevarens skrevne standarder, én per fagområde, for folk og KI-agenter. Hver rad viser fagområdet, merkevarens egen status (**Draft** eller **Approved**), om ferdigheten er offentlig eller intern, og revisjonen. Velg en rad for å lese ferdigheten ved siden av dekningen, som setter ferdighetens linjer opp mot tokenene dine: hva Lolly kontrollerer, hva som er i konflikt, hva som stemmer og hva som bare er veiledning.

**Download skill (.zip)** skriver ferdigheten som en Agent Skills-mappe for et agentverktøy, med katalogkoblinger som peker til denne Lolly, og **Copy as one file** legger den samme teksten på utklippstavlen for et chattevindu. Et designsystem uten egne ferdigheter lister en grunnlinje som Lolly skriver fra tokenene og husreglene sine hver gang grunnlinjen leses. Rommet leser ferdigheter og redigerer dem aldri.

## Ta inn en merkevare

**Legg til fra…** i linjen åpner en velger som spør hva du har, ikke hvilket format det er:

- **Designtokens eller en designfil**: DTCG- eller Tokens Studio-JSON, et Penpot-prosjekt, en zip med tokensett, en Lolly-designsystempakke, en SVG, en `DESIGN.md` eller en mappe med merkevareside.
- **PDF**: en presentasjon eller en retningslinjefil, lest på denne enheten for fargene, merkene og innebygde skrifter.
- **Logo eller skjermbilde**: et bilde blir en foreslått palett, lest på denne enheten. Det leser farger, ikke skrift eller layout.
- **Lagret nettside**: én HTML-fil og CSS-filene dens, eller limt inn HTML eller CSS, opptil 20 filer og 2 MB. Bare teksten du oppgir, leses: lenkede ressurser hentes ikke og skript kjøres ikke.
- **Skriftfil**: TTF, OTF eller WOFF. Åpner rommet Type, der skriften installeres.
- **Nettsted**: én side, lest for fargene og skriften. Denne flisen vises bare på en enhet som kan lese en side, og sier hvilken leser den bruker: appen på denne enheten, eller nettleserutvidelsen i en bakgrunnsfane, innlogget som deg. Å oppgi en URL fyller bare ut feltet; å trykke hent er samtykket.

Velg designfilkilden, så lister neste kort de godkjente formatene som ikonfliser, med hele kortet som ett slippmål. Du kan også slippe en fil rett på studioet.

![Importkortet - de aksepterte formatene ledes an som ikonfliser, og hele kortet er ett sleppmål](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- En **Lolly-designsystempakke** (`.lolly`, eller en eldre `.zip`) installeres i ett trinn.
- En **Penpot**-eksport (`.penpot`) tar med designtokenene sine.
- En **Design Tokens**- (W3C DTCG) eller **Tokens Studio**-fil (`.json`) tar med tokenene sine. En beskrivelse som ber en leser ignorere instruksjoner, hevder tillatelser eller ber om å kjøre kode, utelates, og importen sier hvor den sto. Dette er en linje-for-linje-sjekk og går glipp av annen ordlyd, så les en fil fra noen du ikke kjenner før du bruker tokenene.
- En **vanlig SVG** skannes for farger du kan velge blant, og den første blir primærfargen din.
- En **`DESIGN.md`** (`.md`) går til **Prøv disse fargene** med tokenene sine som skrevet. Prosaen kan beholdes som et utkast til en merkevareferdighet, og kortet flagger linjer som ber en leser ignorere instruksjoner, hevde tillatelser eller kjøre kode. Agenter og merkevaresider ser ikke et utkast før du trykker **Behold denne ferdigheten** i rommet Ferdigheter, og en beholdt ferdighet forblir intern.
- En **mappe med merkevareside**, valgt som mappe, sluppet eller zippet, går til den samme gjennomgangen. Hver fil sjekkes mot `brand.json` i mappen, og en som ikke samsvarer, avviser hele mappen. Den legger til tokenene. Logoer og skrifter blir i mappen.

Lolly leser en merkevareside fra filer du oppgir. Den henter ikke en annen nettsteds adresse.

### En fil med egne fargeord

En token-fil eller en `DESIGN.md` kan bruke egne ord for fargene sine, som main, accent, supporting og tertiary. Når Lolly finner slike ord, lister gjennomgangen hvert ord før noe brukes: ordet, fargen i hvert utseende, tokenet det kom fra og hva Lolly ville lese det som. Lolly foreslår disse lesningene ut fra ordene alene, mot en kort liste, og bruker ingen modell. Et ord utenfor listen kommer som merkevarens eget, **Bare ved navn**. Gi nytt navn til et ord, si hva det er til for, les det som noe annet, eller fjern avkrysningen for å la det være en navngitt farge.

**Installer med disse rollene** skriver dem, og **Installer uten roller** installerer filen nøyaktig slik den kom. En fil uten slike ord viser ikke noe nytt trinn. En fil som oppgir egne roller, for eksempel en Lolly skrev, viser dem som skrevet og installerer dem uendret, og du kan redigere dem etterpå i rommet Farger. Terminalen har ingen gjennomgang, så `lolly system import` beholder en oppgitt post og lar andre filers ord bli navngitte farger.

### Gjennomgå en referanse

En logo, et skjermbilde, et nettsted eller en lagret side åpner **Try these colours**: et eksempel i de foreslåtte fargene, en **Main colour** du kan endre og et navn for et nytt system. En boks staver ut hva bruk innebærer: den **replaces** de aktive tokeninnstillingene med den genererte paletten og standardstilene, **keeps** skriftene og bibliotekfilene dine og det forrige systemet kan **recovered**. **Apply suggested settings** bruker de lyse og mørke palettene, etter et sjekkpunkt, og **Restore brand settings** kan hente de gamle innstillingene tilbake. **Change reference** velger en annen kilde.

**Palette, source details and individual choices** viser hva som ble lest, eventuelle skriftnavn som ble funnet og forhåndsvisningens kontrast. Skriftnavn er bare forslag; Type er fortsatt der du installerer en skrift. Kildedetaljene kan omfatte typografi, mellomrom, utfylling og hjørneverdier der de ble observert, merket **Not observed** ellers. En lagret side eller en innebygd nettstedsavlesning rapporterer deklarerte stiler, som siden kanskje ikke bruker, og nettleserutvidelsen kan rapportere målte stiler fra et utvalg synlige elementer. Dette er observasjoner: ingenting installeres, og kildens avstander erstatter aldri dine egne. **Choose individual items in the tray** beholder enkeltelementer, og **Download design context** lagrer en JSON-rapport over observasjoner, foreslåtte tokener og kildeinformasjon (med en SHA-256 av eventuell oppgitt HTML eller CSS). Rapporten har ingen rå sidetekst og er ikke en signert Content Credential.

PDF- og designfilimporter beholder sine egne gjennomgangskontroller. Elementer i **Tray** endrer ingenting før du legger dem til i rommet som eier den typen materiale. `#/start?source=<kind>` åpner velgeren på en kilde (`file`, `pdf`, `image`, `font`, `url`, `page`), og `?import` åpner den rene listen.

### Finn og sammenlign et utseende

Åpne **Find a look** fra Board eller fra designsystemlisten i Settings. Bla gjennom systemer lagret på denne enheten og noen få gjenbrukbare Lolly-eksempler, og søk på navn, fargemerke eller deklarert skrift. **Closest to my current palette** sorterer etter målt fargelikhet, med samsvarende skrifter som avgjør uavgjort; det er ikke en kvalitetsscore.

Klikk på en stil for å forhåndsvise den i sammenheng. Forhåndsvisning endrer ingenting. Hvert korts **Bruk denne stilen** bruker den stilen. Et lagret system blir det aktive, noe som ikke redigerer noe. Et eksempels farger går gjennom det vanlige kontrollpunktet inn i det åpne designsystemet, hvis logoer, skrifter og alt annet eksempelet ikke definerer, blir som de er. **Sammenlign stiler** legger en avkrysningsboks på hvert kort, så du kan velge to og sammenligne dem side ved side. **Gjenopprett merkevareinnstillinger** henter tilbake den forrige stilen. Lagrede systemer har redigerbare **Søk i tagger** under **Detaljer og designkontekst**. Eksemplene er originale Lolly-fargeoppskrifter, uten skrapet samling og uten konto.

![Sammenlign Sunroom og Orchard side om side før du tar i bruk noen av fargesystemene.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

## Behold og flytt designsystemet ditt

### Flytt en merkevare mellom enheter

**Export** skriver én **`LollyBrand-….lolly`**-fil: tokenene, skriftene, logoene og temainnstillingen din, med et integritetsmanifest som kontrolleres på vei inn igjen. Nettutgivelser før 1.0.7 ga den samme filen navnet `.zip`, og den skrivemåten godtas fortsatt. **Tokens (.json)** skriver det rene designtoken-dokumentet alene, uten skrifter eller logoer, for et repositorium, et byggetrinn eller et annet tokenverktøy.

For å hente en tilbake, bruk **Add from… → Design tokens or a design file**, eller slipp filen på studioet. Slik gir en kollega deg en merkevare, eller slik tar du en med til en andre installasjon, uten konto og uten sky. [Working with partners](/info/partners.html) forklarer hva annet du bør sende når personen som mottar merkevaren din jobber for en annen organisasjon. For å hente inn en merkevare fra kommandolinjen, se [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** pakker skriftene du la til i en installerbar RPM. Hvis du lastet opp noen av dem selv, ber Lolly deg først bekrefte at du har lov til å videredistribuere dem.

### Gjenopprett tidligere innstillinger

Åpne **More** i linjen, velg **Restore brand settings**, velg et datert sjekkpunkt og trykk **Restore**. Det gjenoppretter farger, skriftinnstillinger og andre tokener for den aktive merkevaren; skrift- og bildefiler blir som de er. Lolly lagrer de gjeldende innstillingene dine som **Before restore** først, så du kan reversere en gjenoppretting selv etter at du har lukket nettleseren. De siste 20 sjekkpunktene beholdes på denne enheten.

### Versjoner

En publisert versjon er en **permanent, navngitt kopi** beholdt på denne enheten. Den endres aldri, så et verktøy eller en lenke som fester den (med `designv`) fortsetter å tegne det samme. Et system med noe av ditt eget har **Versions & publishing** i **More**-menyen i linjen; etter den første publiseringen kommer **Versions** til blant rommene. `#/start?area=versions` åpner den direkte.

- **En versjon er permanent.** Det finnes ingen sletting ennå, og panelet sier det.
- **Fjerninger leder kompatibilitetskortet**, fordi et fjernet token er det som ødelegger et verktøy.
- **Publisering kan ikke angres; gjenoppretting kan.** *Restore latest from this version* er en vanlig redigering, med **Undo** tilbudt med en gang.

**Publish only** beholder en versjon uten å endre hva verktøy følger; **Publish and make active** får verktøy og appen til å følge den versjonen. **Follow the latest again** setter hver redigering live i det øyeblikket du gjør den.

### Publiser en merkevareside

En [brand page](/info/brand-page.html) er én adresse for folk og for agenter: en side som viser logoene, fargene, skriften og eksemplene, med de samme opplysningene i filer ved siden av siden. **Publiser en merkevareside**, under Versions & publishing, viser den levende siden og, ved siden av siden:

- **Blir offentlig**: hver fil, gruppert, med størrelsen.
- **Holdt tilbake**: det som ble holdt utenfor, og hvorfor. En logo uten registrert lisens holdes utenfor til du krysser av for logoens navn. En skriftfil trenger en registrert lisens som tillater videredistribusjon, og siden viser et omriss av prøven når filen holdes utenfor. Interne merkevareferdigheter vises aldri.
- **Hva som ble sjekket**: fargepar per fargevariant og modus, og de interne reglene. Dette er målinger, ikke en dom.
- **Med dine egne ord**: en bruksuttalelse og en kontakt. Siden skriver ut det du skriver, og Lolly legger ikke til noen lisens eller juridisk påstand. En bryter slår av linjen «Made with Lolly» i bunnteksten.
- **På eksporter**: en bryter som [registrerer sidens adresse i dette designsystemets eksporter](/info/brand-page.html#lead-back-from-your-files). Den er av til du slår den på, den trenger en `https`-adresse, og den følger ikke med en pakke eller en kopi. Et låst designsystem viser ikke bryteren, fordi administratoren avgjør.

**Last ned mappe** lagrer mappen som en ZIP som du kan legge der du vil, og ingenting blir offentlig før du gjør det. I en terminal skriver `lolly system publish --out=<dir>` den samme mappen. En instans som serverer merkevaresider, tilbyr også **Publiser til** adressen sin, som er ett eksplisitt trykk, og går gjennom godkjenningskjeden sin når den har en. Et administrert designsystem publiseres bare når administratoren tillater det.

### Koble til en agent

**Koble til en agent**, på samme sted, gir deg tekst å lime inn og sier hva hvert alternativ kan gjøre:

- **`AGENTS.md`** i et prosjekt: agenter leser systemets navn og regler. Den tegner ingenting og trenger ingen server.
- **Lollys offentlige server**: tegner med Lolly Demo, uansett hvilket system du har åpent her. Den trenger ingen nøkkel.
- **Din instans**: tegner med systemene instansen holder, og leser et tjenestetoken fra en miljøvariabel. Arket oppgir variabelens navn og viser aldri et token.

Når ingen vertet server tegner med systemet ditt, sier arket det.

## Administrer designsystemene dine

Åpne **Settings → Preferences → Design systems** for å bytte, legge til eller fjerne systemer. **Open** velger et system og åpner det her; **Make a new one** oppretter et lokalt system og åpner det med navnefeltet klart. Ett system er aktivt om gangen, for hele enheten. [Brand architectures](/info/brand-architectures.html) hjelper deg å avgjøre når en merkevare trenger et eget designsystem.

**Hvor et system kommer fra.** Systemet en installasjons katalog leverer, leses **Came with this app**, eller **From this instance** i en app koblet til en. Utvid **Catalogue source** for å se hvem som leverer det, tokenressursen og navneområdet og den kjente versjonen eller sjekksummen; hvis en oppdatering svikter, er bufret materiale merket.

**Administrerte systemer er skrivebeskyttet.** Et system leses **Administrert av denne instansen** (eller **Administrert av denne appen** i skrivebordsappen uten instans) når katalogen låser systemet. Du kan bruke og laste det ned, og å åpne det her viser en skrivebeskyttet merknad med **Lag en redigerbar kopi** og **Bytt**, så fargerollene og tokenene uten redigeringskontroller. Dine egne lokale systemer forblir redigerbare, selv når det administrerte kom først. Et bygg med én fast merkevare åpner Lolly Design System Setup på *Denne merkevaren er satt*, med merkevarens tokens og bruksregler å lese.

**Hvert annet levert system er ditt** å skjule, redigere og tilbakestille, inkludert Lolly Demo og Lolly Starter på lolly.tools. Å redigere ett beholder navnet og merker raden **Edited here**, og **Reset to original** i menyen forkaster endringene gjort på denne enheten. Det blanke utgangspunktet er unntaket: en første endring der starter et eget designsystem, så Lolly spør én gang hva det nye systemet skal hete. [Lolly Demo in use](/info/lolly-demo-in-use.html#switch-to-your-own) viser hva ditt eget system erstatter.

### Å fjerne et designsystem

Velg **Remove** fra et systems meny; bekreftelsen sier hvilket system som blir aktivt etterpå. Lagrede økter, opplastinger og materiale delt med et annet system blir.

Å fjerne et levert system skjuler det bare: katalogressursene blir, **Bring back** viser det igjen, og det kommer tilbake av seg selv hvis du fjerner alt annet. Å fjerne en importert eller redigert kopi fjerner ikke det leverte systemet, logoene eller skriftene dets, og hvis kopien var aktiv, blir det leverte systemet aktivt igjen. Å fjerne en aktiv vertsbasert kopi tømmer bare den kopiens tilkobling; en separat valgt instans forblir valgt.

Å endre det en server leverer, er en administratoroppgave: operatøren endrer kildekatalogen og ruller ut på nytt, eller en Lolly Work-administrator gjennomgår og bruker en serverendring. Redigeringer her blir lokale, med ett unntak: på en Lolly Work-instans som gir deg `brand.edit`, tilbyr et administrert system også **Rediger for** den instansen, som åpner en redigeringskopi, og **Send til** den instansen i **Versjoner** sender farger, fargevarianter, fargeroller og merkevaresideadressen tilbake. [Edit this instance from the studio](/info/work-design-system-administration.html#edit-this-instance-from-the-studio) dekker hva en redigering kan endre og hvordan instansen serverer endringen. Se [Removing a catalogue design system](/info/configuration.html#removing-a-catalogue-design-system) og [Configuration](/info/configuration.html#supplied-and-local-design-systems).

## Bruk designkontekst utenfor appen

**Last ned designkontekst** lagrer tokendokumentet, løste farger, deklarerte skriftfamilier, ressurs-id-er, kildebevis der det er registrert, dekning og eksplisitte regler, uten skriftfiler og uten bevis på eierskap. Kommandolinjen leser filen uten server: `lolly system import` gjør den til terminalens designsystem og `lolly system check` sjekker Lolly Design-inndata mot den lagrede konteksten. [Bring your design system](/info/cli.html#bring-your-design-system) dekker importen og [Which design system a command uses](/info/cli-decks.html#which-design-system-a-command-uses) dekker sjekken, og en MCP-klient leser den samme briefen fra `lolly://design-context` ([MCP Server](/info/mcp.html)).

## Hvor du går videre

- **[Using Lolly](/info/using.html)**: verktøyene, lagring, deling og Ressurser.
- **[Brand architectures](/info/brand-architectures.html)**: hvordan divisjoner, produkter, støttede merkevarer, kunder og sesonger tilordnes designsystemer, fargevarianter og logoidentiteter.
- **[Working with partners](/info/partners.html)**: å dele merkevaren din med en partner, og å arbeide i en merkevare du har fått.
- **[Brand pages](/info/brand-page.html)**: publiser designsystemet ditt på én adresse, som pressesett og agentsett.
- **[Design Tokens](/info/design-tokens.html)**: tokenmodellen merkevaren din er skrevet i.
- **[Export a file](/info/exporting.html)**: trykkenheter, CMYK og formatene merkevaren din gjengis til.
