# Design System Setup

Logoen, fargene og skriftene dine hører hjemme på ett sted, så hvert verktøy, hver side og hver eksport tegner med dem. Det stedet er **Design System Setup**, på `#/start`, og slagordet sier hva det er for: *Make it yours*.

Start med det du har. Slipp inn en logo, så leser Lolly fargene dens. Velg en skrift, eller slipp inn skriftfilen bedriften din har lisens på. Hver endring vises over hele appen med en gang. Logoen, skriftene og tokenene dine blir på denne enheten. Å velge en Google Font er det ene trinnet som rekker ut: Lolly spør først, og henter deretter familien én gang.

Når det ser riktig ut, gi designsystemet et navn og trykk **Export**. Du får én `.lolly`-fil å beholde, åpne på en annen enhet eller gi til en kollega. [Settings](/info/dashboard.html#design-system) viser det aktive systemet skrivebeskyttet, og omslaget lenker tilbake hit for redigering.

## Gjør det til ditt på fem minutter

::: timeline
- <!--i:upload--> **Slipp logoen din** på slippsonen i **Logos**. Lolly leser formen og fargene dens.
- <!--i:palette--> **Bruk disse fargene.** Logoens hovedfarge blir primærfargen din, og en mørk nøytral fra logoen blir tekstfargen din.
- <!--i:font--> **Velg en skrift** i **Type**: en Google Font, eller en skriftfil du eier.
- <!--i:pentool--> **Gi systemet et navn.** Den første redigeringen din lager et eget designsystem, og Lolly spør én gang om navnet.
- <!--i:download--> **Export** skriver hele systemet som én `LollyBrand-….lolly`-fil.
:::

Toppen viser hvilket designsystem du **Editing**, og navnet er et felt du kan endre når som helst. Når den første redigeringen din spør **What is this design system called?**, fylles ordene fra logoen din inn hvis logoen staver dem ut. **Save name** beholder navnet; **Not now** beholder en plassholder til du skriver inn et i toppen. Navnet merker systemet i Settings og når du bytter, og det blir navnet på filen **Export** skriver.

## Rommene

Studioet er et sett rom i en liste nedover siden, uten fast rekkefølge: ingenting er nummerert og ingenting venter på noe annet. På en telefon blir listen en stripe av brikker under toppen.

![Romlisten i studioet: Overview, Colours, Type, Logos, Tokens, Files og Usage & rules](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Rom | Hva du gjør der | Lenkenøkkel |
|---|---|---|
| **Overview** | Se hva systemet holder, med en dør inn til hvert rom | `overview` |
| **Colours** | Legg til farger, gi dem roller, bygg nyanser og en palett | `color` |
| **Type** | Velg de fire skriftene appen, verktøyene og hver eksport leser | `type` |
| **Logos** | Plasser merkene dine i hver retning og behandling | `logos` |
| **Tokens** | Hjørner, avstand, skygger og alle andre navngitte verdier | `tokens` |
| **Files** | Bilde-, lyd- og bevegelsesfilene merkevaren din beholder | `catalogue` |
| **Usage & rules** | Reglene merkevaren din bruker, kontrollert på ekte eksempler | `usage` |

Lenk til et rom med `#/start?area=<key>`. Rommet Files beholder nøkkelen `catalogue`, fordi en romnøkkel er en permanent kontrakt, og `?tab=` fungerer fortsatt som et eldre alias. En ukjent nøkkel åpner Overview.

**Bunnen av listen** holder handlingene for hele systemet i stedet for ett rom. **Add from…** henter inn en merkevare ([Bring a brand in](#bring-a-brand-in)), og **Tray** holder det en skanning fant som du ikke har lagt til ennå. **Export**, **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions** og **Restore brand settings** beholder og flytter systemet ([Keep and move your design system](#keep-and-move-your-design-system)). Hver vises når det er noe for den å virke på.

## Oversikt

Når ingenting er valgt ennå, tilbyr Overview fire måter å starte på. **Start from a reference** åpner kildevelgeren for en logo, et skjermbilde, en nettside eller en designfil, og **Pick a colour**, **Choose a face** og **Add a logo** åpner disse kontrollene direkte. Å åpne en skriver ingenting, og **Explore the tools** er der fra starten.

Når noe er ditt eget, viser Overview hva du har, med dine egne tall først. Colours oppgir antall farger, med en dempet `· N starter` der arvede farger vises; stripen setter fargene dine først, deretter en hårstrek, deretter de bleke starterfargene. Type leses etter rolle (*Inter for headings*, med *Starter for the rest* på linjen under). Logos sier hvor mange plasser som er fylt (eller **Not set**), Tokens viser hjørneradiusen og Files sier **Nothing yet** mens biblioteket er tomt. Hver blokk åpner rommet sitt.

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
- Regnet med på Overview og i Tokens.
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

![Logoplassene med Horizontal og Vertical åpnet: hver behandling er en egen plass, og hver plass er valgfri](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails%3Anth-of-type%281%29%3Esummary%3Bclick%3A.be-logo-identity%3Edetails%3Anth-of-type%282%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** er merker merkevaren din kaller ved eget navn, som et ikon, et våpenskjold eller et favicon.
- **Flere identiteter.** En underbrand, et produkt eller et arrangement kan ha sitt eget fulle sett: **+ Add another logo** og gi settet et navn. Hovedsettet ditt er "Your logo". [Brand architectures](/info/brand-architectures.html) viser når en logoidentitet er den riktige blokken.
- **Lolly leser logoens farger.** Et kort under slippsonen, og igjen øverst i Colours, lister logoens farger og spør **Which is the main colour?**, med den sterkeste fargen allerede valgt (aldri det hvite den ble eksportert på). **Use these colours** legger dem til i paletten din, gjør hovedfargen til primærfargen din og, når logoen har en mørk nøytral som leses på papir, gjør den til tekstfargen. **Not now** lar dem ligge i Tray. På en splitt ny installasjon brukes det mest sannsynlige svaret med en gang, og kortet tilbyr **Undo** eller en annen hovedfarge. En SVG gir eksakte farger; en PNG, JPEG eller WebP gir fargene som dekker en reell andel av merket.

## Farger

Rommet vokser med designsystemet: et første besøk er én beslutning, og resten kommer etter hvert som paletten gjør det.

### Den første fargen

Et system uten egne farger åpner på én stor brikke og ett felt, med en linje som sier at roller, nyanser og trykkinnstillinger kommer etter hvert som systemet vokser.

- **Brikken er velgeren.** Trykk **Pick a colour**, så åpnes studioets OKLCH-kort, forhåndsutfylt med det feltet holder: et navn, hjulet, de fire skalaene, alfa og **Stored as**, med **Cancel** og **Add colour** nederst. Ingenting når systemet før du trykker **Add colour**.
- **Feltet tar hvilken som helst notasjon**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` eller et fargenavn. Lim inn en liste, så blir den en rad med brikker å legge til én om gangen eller med **Add all**.
- **To veier til.** **Pick a colour from the screen** bruker pipetten der nettleseren har en, og **Take colours from an image** leser et skjermbilde eller et bilde på denne enheten.
- **Add er aldri deaktivert.** Med ingenting i feltet åpner den velgeren; tekst den ikke kan lese, får en linje under feltet som sier det.

Den første fargen din blir **primary**, og en brikke bekrefter det, som *"Primary is now Vivid Violet"*, med **Fine-tune** for å justere fargen.


### Etter hvert som paletten vokser

Fargene dine ligger ved siden av en **In context**-forhåndsvisning på en bred skjerm, og over den på en mindre. Forhåndsvisningen viser en plakat, et diagram eller et grensesnittkort i paletten din. Starterfargene blir i sin egen sammenfoldbare gruppe.

![Rommet Colours på Lolly Demo: paletten i sammenfoldbare grupper, hver farge med navn og hex, og nedlastingspillen nederst](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![Farger-rommet etter at én farge er lagt til, med paletten sin og en levende komposisjonsforhåndsvisning](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Roller: det verktøy leser

**Roles** sier hvilken farge som spiller hver del i hvert verktøy og hver eksport. De er valgfrie (tre løse farger og ingen roller er et helt utmerket system), enhver farge kan ta en, og kontrastavlesningen måles mot flaten, APCA først. Hver rolle-rad viser en egen farge i full styrke, en starterfarge som står inne, eller **↳ follows Primary**.

Når paletten har nyanser, viser stripen alle de sju rollene et verktøy kan lese: Primary, Secondary, Surface, Text, Muted, Edge og On primary. On primary utledes fra primærfargen, leses **Derived** og har ingen velger.

Appens egen aksent følger designsystemet som standard. Det er innstillingen **Interface follows the design system** i **Settings → Appearance**; å slå innstillingen av lar appens ramme være nøytral, mens verktøy, lerreter og eksporter følger designsystemet uansett.

**Colourways.** Et designsystem kan holde flere hovedfarger, hver valgt per arbeid. Lolly beholder hver fargevariant, men dette rommet kan ikke forfatte en ennå: en fargevariant skrives i tokenfilen. På et system med fargevarianter trenger hver fargevariant sin egen primær- og sekundærfarge, og sin egen flate når fargevariantene tonet bakgrunnen, så disse rollene forblir satt i fargeprøveredigeringsprogrammet. [Lolly Demo in use](/info/lolly-demo-in-use.html#colourways-on-real-work) viser fargevarianter på ekte arbeid, og [Add colourways to a design system](/info/colourways.html#add-colourways-to-a-design-system) har formatet.

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

Paletten lister fargene dine i sammenfoldbare grupper, hver med sin egen **+ Add**. Lag og gi nytt navn til grupper som du vil. En rolle lager aldri en ny flis: en flis en rolle peker på, bærer et lite merke i stedet (**P**, **S**, **Su**, **T**). **Colour chart** under flisene viser de samme fargene på OKLCH-**Wheel** (dra en prikk for å farge på nytt, klikk på tomt område for å legge til en fargeprøve) og **Gamut**-diagrammet, som viser hvor det visbare området slutter. `#/start?area=color&focus=chart` åpner diagrammet direkte.

![Palettpanelet, hver gruppe sammenleggbar, med nedlastingspillen parkert langs nedre kant](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![OKLCH-hjulet - vinkelen er valør, avstanden ut er kroma, og gråtonene følger en lyshetsskinne nedover siden](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Klikk på en fargeprøve for å åpne redigeringsprogrammet:

- **Rename** fargeprøven.
- **Set the colour** på OKLCH-glidere, eller i **Hex**, **HSL**, **RGB** eller **CMYK**. Verdifeltet leser og skriver i det aktive rommet. CMYK her setter skjermfargen ved konvertering; for å feste eksakte blekkfarger, bruk **Print substitutes**.
- **Stored as** velger hvordan fargeprøven lagres: **LCH** (standarden, perseptuell og bredt fargerom), Hex, RGB eller HSL.
- **Use as** gir fargeprøven en rolle direkte. Trykk på en uthevet rolle igjen for å fjerne rollen.
- **Print substitutes** (sammenfoldet): lås **CMYK** fra **Auto** til eksakte blekkverdier, eller sett en **Spot colour** med et **Name** (som `PANTONE 186 C`), en valgfri **Book** og en **Finish** for folie, preging, blindpreging, spotlakk, soft touch eller en stans, falsing eller perforering. Et trykkeri bruker disse låsene når du eksporterer en CMYK-PDF eller TIFF; se [Colour profiles](/info/exporting.html#colour-profiles).
- **In other spaces** (sammenfoldet): en verdi per fargerom, utledet eller skrevet av deg, og en skrevet vinner ved eksport.

**Å slette en fargeprøve** er trygt. Utledede nyanser og temaroller skjules, så ingenting som leser dem, går i stykker, mens farger du la til, fjernes.

::: details Å arbeide med mange fargeprøver
Hver fargeprøve har et dragehåndtak. Dra for å omorganisere innenfor en gruppe, eller sett fokus på håndtaket, trykk Space, bruk piltastene og trykk Space igjen for å slippe; Escape avbryter. For å flytte farger mellom grupper, bruk redigeringsprogrammets **Group**-kontroll eller velg flere og bruk **Move to**.

Utvalg trenger ingen modus. Linjen vises med den første valgte flisen og forsvinner med den siste.

- **Dra på tomt område** for å tegne et rektangel; hver flis det berører, blir med i utvalget, på tvers av grupper. En sammenfoldet del legger ikke til noe.
- **Shift-klikk** tar et område i leserekkefølge, **Cmd/Ctrl-klikk** veksler én flis, og et vanlig klikk åpner redigeringsprogrammet.
- Hver gruppeoverskrift har **Select all**, og **Cmd-A** med en flis i fokus tar hver farge du eier, aldri en starterfarge.
- Rutenettet har ett tabulatorstopp: piler flytter, Shift-piler utvider, Space veksler, Delete fjerner og Escape tømmer. For å dytte en kanal, trykk `l`, `c` eller `h` først.
- På en berøringsskjerm trykker og holder du en flis for å starte et utvalg, og trykker deretter for å legge til.

Linjen leses **{n} selected**, deretter **Move to**, **Give a role** (hver farge tar neste rolle i tur), **Download** (utvalget i et av de seks palettformatene), **Duplicate** (en kopi av hver, plassert etter originalen), **Copy values** og **Delete**. Én kopi åpnes rett i redigeringsprogrammet; flere forblir valgt. Ett Cmd/Ctrl-Z angrer en hel massehandling.
:::

### Gradienter

Det valgfrie panelet **Gradients** bygger blandingstokener fra paletten. Hver gradient har en forhåndsvisning, 2 til 8 navngitte stopp og en vinkel. Et stopp peker på en fargeprøve, så farg fargeprøven på nytt, og gradienten følger. Blandinger kjører i OKLCH.

Palettnedlastingene (designtokens, CSS, SCSS, GIMP og Adobe Swatch Exchange) ligger i en pille nederst i paletten når det finnes nyanser. [Take your palette and fonts anywhere](/info/using.html#take-your-palette-and-fonts-anywhere) beskriver hvert format.

## Skrift

Uten en egen skrift er rommet ett kort: **Primary**, satt i lesestørrelse i skriften som tjener det i dag, med et **Starter**-merke, en **Choose a face**-knapp og linjen *"Nothing installs until you choose one."* Headings, code og italic følger primærskriften til du velger dem; **Choose them separately** viser kortene deres.

![Typografi-rommet med ingen skrift valgt ennå - ett kort i lesestørrelse, en Start-tagg på det og en fylt Velg en skrifttype](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Velg én skrift, så åpner rommet seg til fire rollekort, Fonts-listen og et levende prøveeksempel:

- **Primary**: brødtekst, knapper og hvert verktøy.
- **Headings**: visningsskriften for `h1` og `h2`.
- **Code**: en skrift med fast bredde for kode og data.
- **Italic**: en ekte kursiv for utheving, sitater og sidebemerkninger.

Et kort er bare tonet der du installerte den skriften, og knappen sier **Change** på en skrift du eier selv og **Choose a face** overalt ellers. Ingenting på et kort bekrefter noe: knappen åpner sammenligningsscenen for den rollen.

![De fire rollekortene avdekket - hvert satt i skriften som betjener det, med en Start-tagg der ingen har valgt en, og Italic som følger primærfargen](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Sammenligningsstadiet

Scenen åpnes inne i rommet, under kortet du trykket på, og kortene folder seg til en enlinjes stripe slik at scenen vises på en telefons første skjerm. Escape avbryter og returnerer fokus til kortet.

1. Trykk **Choose a face** på kortet.
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
- **Tiles** teller hver type token og hopper til delen: Colours, Type, Logos, Shape and spacing, More og All tokens. De teller det som er ditt eget, slik Overview gjør. På en telefon ruller flisene sideveis.
- **Colours** starter med parene verktøy setter sammen (tekst på flate, på primær, dempet på flate) med en APCA-avlesning i lys og mørk, og flagger **Weak contrast** der et par kommer til kort. Deretter hver fargegruppe: en ramp som én rad med brikker, andre farger med verdien sin og referansen verktøy bruker, som `{color.brand.spearmint}`. Trykk på en referanse for å kopiere referansen. **Edit in Colours** åpner en gruppe i rommet Colours.
- **Type** og **Logos** lister skriften for hver rolle og hver logoplass, med **Edit in Type** og **Edit in Logos** når du har dine egne.
- **Shape and spacing** har **Rounded corners** (`shape.radius`) og **Spacing rhythm** (`space.base`). Hver leses *Lolly default* til du flytter glideren og *Yours* etterpå, lagrer med en gang og kan angres.
- **More tokens** legger til avstand, størrelse, strektykkelse, opasitet, rotasjon, rene tall og skygger, lagret som standard [designtokens](/info/design-tokens.html).
- **App appearance (advanced)** lister fargene, størrelsene og skyggene Lollys egne skjermer bruker, og **Inspect every token (advanced)** søker i og redigerer hvilken som helst lagret verdi, og viser hver endring til gjennomgang først.

En del uten innhold tilbyr veien for å fylle hullet: **Pick a colour**, **Choose a face** eller **Add a logo**.

## Filer

Slipp filene merkevaren din beholder, bortsett fra logoer: **vector**-, **image**-, **audio**- og **motion**-filer (video, Lottie og animasjoner). De vises i [Assets](/info/using.html#assets-your-library), sortert i deler og klare i hvert verktøys ressursvelger, og de blir på denne enheten.

## Usage & rules

**Usage & rules** setter merkevarens valg i arbeid: hva folk kan endre, hva som er fast og hva Lolly kan sjekke.

![Usage & rules på Lolly Demo: et tomt kort Brand rules med Add your first rule, deretter Try your brand in use med eksemplene klare til å gjengis](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** lister reglene dine. **Add rule** (eller **Add your first rule**) åpner et kort skjema:

- et **Rule name** med dine egne ord, som *Beacon accents*;
- **Check**: **Colour choices**, **Font choices**, **Fixed artwork** eller **Text length**, med merkevarerollen den bruker, under ditt eget navn for rollen;
- **Example** den gjelder for (Poster, Title slide, Content slide eller Chart), **Mode** og om den er **Required** eller **Advisory**;
- **Reviewed by**, deretter **Save draft** eller **Approve & save**.

Godkjenning registrerer din egen avgjørelse på denne enheten. Godkjente påkrevde regler begrenser den gjenbrukbare plakaten, og kontrollene dekker bare eksempel-PNG-ene; de endrer ingen andre verktøy.

Regler et designsystem har med seg i tokenfilen sin, som godkjente fargepar, tekstvekt og justering eller en logo per flate, listes her som **Checked in Design**. Design sjekker dem lag for lag i kortet **Before you export** i eksportpanelet, og `lolly check` gjør det samme for et lagret Design-dokument ([Before you export](/info/design.html#before-you-export)). En regel dette bygget ikke har noen kontroll for, beholdes som levert og merkes **Unchecked**.

**Try your brand in use** gjengir fire eksempler fra gjeldende revisjon med **Render & check examples**. Velg en **Brand mode** og **Try your own text** for overskriften, støtteteksten og lysbildeteksten. Hvert eksempel rapporterer hva som ble målt, med **See checks & sources** og **Download check report**, og **Make reusable poster** laster ned en `.lolly` der den faste layouten og de godkjente inndatavalgene følger med filen. Eksemplene er lokale: ingenting publiseres eller godkjennes ved å kjøre en kontroll.

Et bygg som leveres med en fast merkevare, viser de samme reglene og eksemplene skrivebeskyttet, under *This brand is set*.

## Ta inn en merkevare

**Add from…** nederst i listen åpner en velger som spør hva du har, ikke hvilket format det er:

- **Design tokens or a design file**: DTCG- eller Tokens Studio-JSON, et Penpot-prosjekt, en zip med tokensett, en Lolly-designsystempakke eller en SVG.
- **PDF**: en presentasjon eller en retningslinjefil, lest på denne enheten for farger, merker og innebygde skrifter.
- **Logo or screenshot**: et bilde blir en foreslått palett, lest på denne enheten. Den leser farger, ikke skriften eller layouten.
- **Saved web page**: én HTML-fil og dens CSS-filer, eller innlimt HTML eller CSS, opptil 20 filer og 2 MB. Bare teksten du oppgir, leses: lenkede ressurser hentes ikke og skript kjører ikke.
- **Font file**: TTF, OTF eller WOFF. Åpner rommet Type, der skriften installeres.
- **Website**: én side, lest for farger og skrift. Denne flisen vises bare på en enhet som kan lese en side, og sier hvilken leser den bruker: appen på denne enheten, eller nettleserutvidelsen i en bakgrunnsfane, pålogget som deg. Å oppgi en URL fyller bare ut feltet; å trykke hent er samtykket.

Velg designfilkilden, så lister neste kort de godkjente formatene som ikonfliser, med hele kortet som ett slippmål. Du kan også slippe en fil rett på studioet.

![Importkortet - de aksepterte formatene ledes an som ikonfliser, og hele kortet er ett sleppmål](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- En **Lolly design-system pack** (`.lolly`, eller en eldre `.zip`) installeres i ett trinn.
- En **Penpot**-eksport (`.penpot`) tar med designtokenene sine.
- En **Design Tokens**- (W3C DTCG) eller **Tokens Studio**-fil (`.json`) tar med tokenene sine.
- En **plain SVG** skannes for farger du velger blant, og den første blir primærfargen din.

### Gjennomgå en referanse

En logo, et skjermbilde, et nettsted eller en lagret side åpner **Try these colours**: et eksempel i de foreslåtte fargene, en **Main colour** du kan endre og et navn for et nytt system. En boks staver ut hva bruk innebærer: den **replaces** de aktive tokeninnstillingene med den genererte paletten og standardstilene, **keeps** skriftene og bibliotekfilene dine og det forrige systemet kan **recovered**. **Apply suggested settings** bruker de lyse og mørke palettene, etter et sjekkpunkt, og **Restore brand settings** kan hente de gamle innstillingene tilbake. **Change reference** velger en annen kilde.

**Palette, source details and individual choices** viser hva som ble lest, eventuelle skriftnavn som ble funnet og forhåndsvisningens kontrast. Skriftnavn er bare forslag; Type er fortsatt der du installerer en skrift. Kildedetaljene kan omfatte typografi, mellomrom, utfylling og hjørneverdier der de ble observert, merket **Not observed** ellers. En lagret side eller en innebygd nettstedsavlesning rapporterer deklarerte stiler, som siden kanskje ikke bruker, og nettleserutvidelsen kan rapportere målte stiler fra et utvalg synlige elementer. Dette er observasjoner: ingenting installeres, og kildens avstander erstatter aldri dine egne. **Choose individual items in the tray** beholder enkeltelementer, og **Download design context** lagrer en JSON-rapport over observasjoner, foreslåtte tokener og kildeinformasjon (med en SHA-256 av eventuell oppgitt HTML eller CSS). Rapporten har ingen rå sidetekst og er ikke en signert Content Credential.

PDF- og designfilimporter beholder sine egne gjennomgangskontroller. Elementer i **Tray** endrer ingenting før du legger dem til i rommet som eier den typen materiale. `#/start?source=<kind>` åpner velgeren på en kilde (`file`, `pdf`, `image`, `font`, `url`, `page`), og `?import` åpner den rene listen.

### Finn og sammenlign et utseende

Åpne **Find a look** fra Overview eller fra designsystemlisten i Settings. Bla gjennom systemer lagret på denne enheten og noen få gjenbrukbare Lolly-eksempler, og søk på navn, fargemerke eller deklarert skrift. **Closest to my current palette** sorterer etter målt fargelikhet, med samsvarende skrifter som avgjør uavgjort; det er ikke en kvalitetsscore.

Velg ett utseende for å gjennomgå det, eller to for å sammenligne side om side. Å velge endrer ingenting. **Use this saved system** bytter til det, og **Use these colours** bruker et eksempels farger gjennom det vanlige sjekkpunktet, og beholder skriftene dine. **Restore brand settings** henter det forrige utseendet tilbake. Lagrede systemer har redigerbare **Search tags** under **Details and design context**. Eksemplene er originale Lolly-fargeoppskrifter, uten noen skrapt samling og uten konto.

![Sammenlign Sunroom og Orchard side om side før du tar i bruk noen av fargesystemene.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

## Behold og flytt designsystemet ditt

### Flytt en merkevare mellom enheter

**Export** skriver én **`LollyBrand-….lolly`**-fil: tokenene, skriftene, logoene og temainnstillingen din, med et integritetsmanifest som kontrolleres på vei inn igjen. Nettutgivelser før 1.0.7 ga den samme filen navnet `.zip`, og den skrivemåten godtas fortsatt. **Tokens (.json)** skriver det rene designtoken-dokumentet alene, uten skrifter eller logoer, for et repositorium, et byggetrinn eller et annet tokenverktøy.

For å hente en tilbake, bruk **Add from… → Design tokens or a design file**, eller slipp filen på studioet. Slik gir en kollega deg en merkevare, eller slik tar du en med til en andre installasjon, uten konto og uten sky. For å hente inn en merkevare fra kommandolinjen, se [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** pakker skriftene du la til i en installerbar RPM. Hvis du lastet opp noen av dem selv, ber Lolly deg først bekrefte at du har lov til å videredistribuere dem.

### Gjenopprett tidligere innstillinger

Velg **Restore brand settings**, velg et datert sjekkpunkt og trykk **Restore**. Det gjenoppretter farger, skriftinnstillinger og andre tokener for den aktive merkevaren; skrift- og bildefiler blir som de er. Lolly lagrer de gjeldende innstillingene dine som **Before restore** først, så du kan reversere en gjenoppretting selv etter at du har lukket nettleseren. De siste 20 sjekkpunktene beholdes på denne enheten.

### Versjoner

En publisert versjon er en **permanent, navngitt kopi** beholdt på denne enheten. Den endres aldri, så et verktøy eller en lenke som fester den (med `designv`) fortsetter å tegne det samme. Et system med noe av ditt eget viser en stille lenke **Versions & publishing** nederst i listen; etter den første publiseringen blir den oppføringen **Versions**. `#/start?area=versions` åpner den direkte.

- **En versjon er permanent.** Det finnes ingen sletting ennå, og panelet sier det.
- **Fjerninger leder kompatibilitetskortet**, fordi et fjernet token er det som ødelegger et verktøy.
- **Publisering kan ikke angres; gjenoppretting kan.** *Restore latest from this version* er en vanlig redigering, med **Undo** tilbudt med en gang.

**Publish only** beholder en versjon uten å endre hva verktøy følger; **Publish and make active** får verktøy og appen til å følge den versjonen. **Follow the latest again** setter hver redigering live i det øyeblikket du gjør den.

## Administrer designsystemene dine

Åpne **Settings → Preferences → Design systems** for å bytte, legge til eller fjerne systemer. **Open** velger et system og åpner det her; **Make a new one** oppretter et lokalt system og åpner det med navnefeltet klart. Ett system er aktivt om gangen, for hele enheten. [Brand architectures](/info/brand-architectures.html) hjelper deg å avgjøre når en merkevare trenger et eget designsystem.

**Hvor et system kommer fra.** Systemet en installasjons katalog leverer, leses **Came with this app**, eller **From this instance** i en app koblet til en. Utvid **Catalogue source** for å se hvem som leverer det, tokenressursen og navneområdet og den kjente versjonen eller sjekksummen; hvis en oppdatering svikter, er bufret materiale merket.

**Administrerte systemer er skrivebeskyttet.** Et system leses **Managed by this instance** (eller **Managed by this app** i skrivebordsappen uten instans) når katalogen låser systemet. Du kan bruke og laste det ned, og å åpne det her viser en skrivebeskyttet merknad med **Make an editable copy** og **Switch**. Dine egne lokale systemer forblir redigerbare, selv når det administrerte kom først. Et bygg med én fast merkevare åpner Design System Setup på *This brand is set*, med merkevarens tokener og bruksregler å lese.

**Hvert annet levert system er ditt** å skjule, redigere og tilbakestille, inkludert Lolly Demo og Lolly Starter på lolly.tools. Å redigere ett beholder navnet og merker raden **Edited here**, og **Reset to original** i menyen forkaster endringene gjort på denne enheten. Det blanke utgangspunktet er unntaket: en første endring der starter et eget designsystem, så Lolly spør én gang hva det nye systemet skal hete. [Lolly Demo in use](/info/lolly-demo-in-use.html#switch-to-your-own) viser hva ditt eget system erstatter.

### Å fjerne et designsystem

Velg **Remove** fra et systems meny; bekreftelsen sier hvilket system som blir aktivt etterpå. Lagrede økter, opplastinger og materiale delt med et annet system blir.

Å fjerne et levert system skjuler det bare: katalogressursene blir, **Bring back** viser det igjen, og det kommer tilbake av seg selv hvis du fjerner alt annet. Å fjerne en importert eller redigert kopi fjerner ikke det leverte systemet, logoene eller skriftene dets, og hvis kopien var aktiv, blir det leverte systemet aktivt igjen. Å fjerne en aktiv vertsbasert kopi tømmer bare den kopiens tilkobling; en separat valgt instans forblir valgt.

Å endre hva en server leverer er en administratoroppgave: driftsansvarlig endrer kildekatalogen og ruller ut på nytt, eller en Lolly Work-administrator gjennomgår og bruker en serverendring. Redigeringer her blir lokale. Se [Removing a catalogue design system](/info/configuration.html#removing-a-catalogue-design-system) og [Configuration](/info/configuration.html#supplied-and-local-design-systems).

## Bruk designkontekst utenfor appen

**Download design context** lagrer tokendokumentet, løste farger, deklarerte skriftfamilier, ressurs-ID-er, kildebevis der det er registrert, dekning og eksplisitte regler, uten skriftfiler og uten bevis på eierskap. Kommandolinjen leser filen uten server: `lolly system import` gjør den til terminalens designsystem og `lolly system check` sjekker Design-inndata mot den lagrede konteksten. [Bring your design system](/info/cli.html#bring-your-design-system) dekker importen og [Which design system a command uses](/info/cli-decks.html#which-design-system-a-command-uses) dekker sjekken, og en MCP-klient leser den samme oppsummeringen fra `lolly://design-context` ([MCP Server](/info/mcp.html)).

## Hvor du går videre

- **[Using Lolly](/info/using.html)**: verktøyene, lagring, deling og Assets.
- **[Brand architectures](/info/brand-architectures.html)**: hvordan divisjoner, produkter, støttede merkevarer, kunder og sesonger tilordnes designsystemer, fargevarianter og logoidentiteter.
- **[Design Tokens](/info/design-tokens.html)**: tokenmodellen merkevaren din er skrevet i.
- **[Export a file](/info/exporting.html)**: trykkenheter, CMYK og formatene merkevaren din gjengis til.
