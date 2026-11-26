# Lolly Design System Setup

<a id="design-system-setup"></a>

**Lolly Design System Setup**, på `#/start`, har logoen, fargene og skriftene dine. Alle verktøy, sider og eksporter tegnes med dem.

Slipp inn en logo, så leser Lolly fargene. Velg en skrift, eller slipp inn skriftfilen bedriften din har lisens til. Hver endring vises i hele appen med en gang. Logoen, skriftene og tokenene dine blir på denne enheten. Bare valg av en Google Font kontakter nettet: Lolly spør først og henter deretter skriftfamilien én gang.

Gi designsystemet et navn og trykk **Export** for å få én `.lolly`-fil. Behold filen, åpne den på en annen enhet eller gi den til en kollega. [Lolly-innstillinger](/info/dashboard.html#design-system) viser det aktive systemet skrivebeskyttet; forsiden lenker tilbake hit for redigering.

<!--i:eti-clock-->
## Gjør det til ditt på fem minutter

::: timeline
- <!--i:upload--> **Slipp logoen din** på slippområdet i **Logos**. Lolly leser formen og fargene.
- <!--i:palette--> **Bruk disse fargene.** Logoens hovedfarge blir primærfargen din, og en mørk nøytral farge fra logoen blir tekstfargen.
- <!--i:font--> **Velg en skrift** i **Type**: en Google Font eller en skriftfil du eier.
- <!--i:pentool--> **Gi systemet et navn.** Den første redigeringen lager et eget designsystem, og Lolly spør én gang om navnet.
- <!--i:download--> **Export** skriver hele systemet som én `LollyBrand-….lolly`-fil.
:::

Linjen øverst i studioet viser designsystemets navn som et redigerbart felt. **Enter** beholder et nytt navn, og **Escape** setter det gamle tilbake. Når den første redigeringen spør **What is this design system called?**, fyller Lolly inn ordene fra logoen din, hvis logoen inneholder dem. **Save name** beholder navnet; **Not now** beholder en plassholder til du skriver et navn i linjen. Navnet merker systemet i Settings og når du bytter, og er navnet på filen **Export** skriver.

<!--i:eti-grid-->
## Rommene

Studioet er et sett med rom uten fast rekkefølge. Ingen rom er avhengige av et annet. På en datamaskin ligger rommene i én stripe under linjen. På en telefon flyttes de til en linje langs nederkanten, med det åpne rommet rullet til syne. Palettpanelet og skuffen åpnes over den linjen, og linjen flytter seg unna mens du skriver. Med et tastatur har stripen ett Tab-stopp, og piltastene, Home og End flytter mellom rom.

![Studioets linje og rom: Board, Colours, Type, Logos, Tokens, Files, Sound, Rules og Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Rom | Hva du gjør der | Lenkenøkkel |
|---|---|---|
| **Board** | Se hva systemet inneholder, med en dør inn til hvert rom | `overview` |
| **Colours** | Legg til farger, gi dem roller, bygg nyanser og en palett | `color` |
| **Type** | Velg de fire skriftene som appen, verktøyene og hver eksport bruker | `type` |
| **Logos** | Plasser logoene dine i alle orienteringer og utførelser | `logos` |
| **Tokens** | Hjørner, avstand, skygger og alle andre navngitte verdier | `tokens` |
| **Files** | Bilde-, lyd- og bevegelsesfilene merkevaren din beholder | `catalogue` |
| **Sound** | Form lydidentitet, musikk for ulike bruksområder og forholdet til stemmen | `sound` |
| **Rules** | Reglene merkevaren din bruker, kontrollert på virkelige eksempler | `usage` |
| **Skills** | Merkevarens skriftlige standarder for mennesker og agenter, til lesing og nedlasting | `skills` |

Lenk til et rom med `#/start?area=<key>`. Romnøklene er permanente, så Files beholder `catalogue`, Board beholder `overview` og Rules beholder `usage`. `?tab=` fungerer fortsatt som et eldre alias. En ukjent nøkkel åpner Board.

**Linjen** har handlinger for hele systemet. **Add from…** henter inn en merkevare ([Hent inn en merkevare](#bring-a-brand-in)). **Tray** holder det en skanning fant som du ikke har lagt til ennå. **Export** skriver systemet som én fil. **More** inneholder **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions & publishing**, **Restore brand settings** og **Design systems**, som åpner listen i Settings der du bytter ([Behold og flytt designsystemet ditt](#keep-and-move-your-design-system)). Hver handling vises når den har noe å behandle. På en telefon flyttes **Add from…** inn i **More**, og **Export** vises som ikon.

Så lenge designsystemet er det som fulgte med appen, begynner linjen med **Make it yours**, en meny med **Find a look**, **Add from…** og **Pick a colour**. Når systemet er ditt eget, tar **Export** den plassen igjen.

<!--i:eti-clipboard-->
## Oversikt

Når ingenting er valgt ennå, tilbyr Board fire måter å starte på. **Start from a reference** åpner kildevelgeren for en logo, et skjermbilde, en nettside eller en designfil. **Pick a colour**, **Choose a face** og **Add a logo** åpner de tilhørende kontrollene. Å åpne en av dem skriver ingenting. Under dem tilbyr **Find a look** ferdige farger og skrifter du kan prøve, og **Explore the tools** er der fra starten.

Når noe er ditt eget, viser Board det du har, med antall av dine egne elementer først. Colours oppgir antall farger, med en dempet `· N starter` for de medfølgende. Stripen viser fargene dine, deretter en tynn strek og så de nedtonede startfargene. Colourways viser hver fargevariant som en liten flis i hovedfargen. Type viser hver rolle og setter hver familie i sin egen skrift (*Inter for headings*, med *Starter for the rest* på linjen under). Logos sier hvor mange plasser som er fylt (eller **Not set**), Tokens viser hjørneradiusen og Files sier **Nothing yet** mens biblioteket er tomt. Hver blokk åpner rommet sitt.

Et redigerbart designsystem som fulgte med appen, for eksempel Lolly Demo, viser fargene, fargevariantene, skriftene og logoene på Board fra starten, med en **Came with this app**-etikett ved siden av overskriften. Over dem tilbyr **Start here** valgene **Find a look**, **Add from…** og **Pick a colour**.

### Startinnhold og ditt eget

I hvert rom merker **Starter** alt som fulgte med appen og som ingen har valgt. En ny installasjon har ingen farge, bare én nøytral skala fra blekk til papir, slik at overflater, tekst og tynne streker kan gjengis før noen velger.

::: cols
## Startinnhold

- Fulgte med appen: de nøytrale fargene fra blekk til papir, startskriftene, standard hjørneradius.
- Dempet, med en **Starter**-etikett og uten fargetoning.
- Regnes ikke som dine farger. De nøytrale fargene ligger i **Tokens** som **Neutrals · starter · 9**, og **Open** viser dem i Colours som én sammenfoldet gruppe (`#/start?area=color&group=neutral`).
- En rolle som bruker en startfarge, viser *"Starter Paper stands in"*, med **Choose…** på velgeren.

## Ditt eget

- Valgt eller installert av deg.
- Full styrke, og et fargetonet kort der du har installert en skrift.
- Telles på Board og i Tokens.
- En rolle som følger en annen, viser **↳ follows Primary**.
:::

Medfølgende materiale har aldri en stiplet kant. En stiplet kant betyr et slippområde.

<!--i:eti-shapes-->
## Logoer

Slippområdet øverst, **"Drop marks here, or choose several at once"**, tar imot så mange filer du har. Lolly leser formen og fargen i hver fil. Filen venter deretter under **Waiting for a slot** som en brikke som sier hva den ligner på, for eksempel *"Looks like the Horizontal primary"*, med målingen som ble brukt og en **Place**-knapp (**Replace** der plassen er fylt). Der Lolly er usikker, sier brikken fra og tilbyr **Change slot**, som viser alle åtte. Ingenting plasseres før du trykker på en knapp.

En logo med overflødig tom marg får først et tilbud om beskjæring. Svar på tilbudet, eller trykk Escape for å plassere originalen urørt. Der en logo kan fylle en tom beslektet plass, tilbyr rommet den avledede **mono**- eller **reverse**-versjonen som en brikke merket *Generated*.

Hver logo plasseres i et rutenett med åtte valgfrie plasser, én per **orientering** og **utførelse**:

- **Orienteringer:** Horizontal (ordmerke og symbol på en rad) og Vertical (stablet, for kvadratiske og høye flater).
- **Utførelser:** Primary, Primary reverse (for mørke bakgrunner), Mono (én farge) og Mono reverse.

En gruppe uten logoer foldes sammen til én linje; åpne gruppen for å se plassene. Klikk på en plass for å legge til en PNG, SVG, JPEG eller WebP, eller klikk på en fylt plass for å erstatte logoen. En tom plass tar også imot en fil du slipper. Horisontale logoer ligger i brede fliser og vertikale i kvadrater, hver på overflaten den er laget for, med fri plass tilsvarende en fjerdedel av høyden. Alt blir på denne enheten.

![Logoplassene med Horizontal og Vertical åpnet: hver utførelse har sin egen plass, og alle plassene er valgfrie](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&system=new-design-system&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails.be-logo-group--fold%3Anot%28.be-logo-group--custom%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** er logoer merkevaren din har sitt eget navn på, for eksempel et ikon, et våpenskjold eller et favicon.
- **Flere identiteter.** Et undermerke, produkt eller arrangement kan ha sitt eget komplette sett: trykk **+ Add another logo** og gi settet et navn. Hovedsettet ditt er "Your logo". [Merkevarearkitekturer](/info/brand-architectures.html) viser når du skal bruke en logoidentitet.
- **Lolly leser logoens farger.** Et kort under slippområdet, og øverst i Colours, viser logoens farger og spør **Which is the main colour?**. Den sterkeste fargen er valgt, aldri det hvite som logoen ble eksportert på. **Use these colours** legger dem til i paletten og gjør hovedfargen til primærfargen din. Når logoen har en mørk nøytral farge som er lesbar på papir, blir den tekstfargen. **Not now** lar dem ligge i Tray. På en helt ny installasjon tar Lolly i bruk det mest sannsynlige svaret med en gang, og kortet tilbyr **Undo** eller en annen hovedfarge. En SVG gir nøyaktige farger; en PNG, JPEG eller WebP gir fargene som dekker en vesentlig del av logoen.

<!--i:eti-palette-->
## Farger

Rommet vokser med designsystemet. Det første besøket ber om ett valg; flere kontroller vises etter hvert som paletten vokser.

### Den første fargen

Et system uten egne farger viser de nøytrale startfargene i sin egen åpne gruppe. Øverst i rommet er et stiplet felt for innliming og slipp: én stor brikke og ett felt. Slipp et bilde eller en liste med farger hvor som helst i feltet, så leser Lolly fargene.

- **Brikken er velgeren.** **Pick a colour** åpner studioets OKLCH-kort, med innholdet i feltet som utgangspunkt. Kortet viser fargens navn og heksadesimalverdi først. Fargerommene, hjulet, de fire dreiekontrollene og alfa ligger under **Fine-tune**, og **Cancel** og **Add colour** ligger nederst. Ingenting når systemet før du trykker **Add colour**.
- **Feltet tar imot alle skrivemåter**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` eller et fargenavn. En innlimt liste blir en rad med brikker du kan legge til én om gangen eller med **Add all**.
- **To andre veier inn.** **Pick a colour from the screen** bruker pipetten der nettleseren har en, og **Take colours from an image** leser et skjermbilde eller foto på denne enheten.
- **Add er aldri deaktivert.** Med et tomt felt åpner den velgeren; tekst den ikke kan lese, får en linje under feltet som sier fra.

Den første fargen din blir **primærfargen**. En brikke bekrefter endringen, for eksempel *"Primary is now Vivid Violet"*, med **Fine-tune** for å justere fargen.


### Etter hvert som paletten vokser

Fargene dine ligger ved siden av en **In context**-forhåndsvisning på en bred skjerm og over forhåndsvisningen på en mindre. Forhåndsvisningen viser en plakat, et diagram eller et grensesnittkort i paletten din. Startfargene har sin egen gruppe, som foldes sammen når systemet har egne farger. Feltet for innliming og slipp blir én kompakt rad. Toppen av rommet har ingen eksport; bruk **Export** på linjen eller Tokens-rommet.

![Colours-rommet i Lolly Demo: rollebrikkene og feltet for innliming og slipp øverst, deretter paletten i sammenfoldbare grupper, hver farge med navn og heksadesimalverdi](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![Colours-rommet i Lolly Demo etter at én farge er lagt til: Colour roles-tabellen, deretter den nye fargens brikke med Use as Lead? og Fine-tune, ved siden av en levende forhåndsvisning av komposisjonen](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Fargeroller: hva fargene heter

Designsystemet gir fargene sine navn og sier hva hver av dem er til, og Lolly leser begge deler. **Colour roles** ligger øverst i Colours-rommet. **In context** viser hver endring med en gang.

![Colour roles-tabellen for Wefthouse, en oppdiktet tekstilmerkevare, med merkets egne ord: fargevariantbrikkene Indigo, Madder og Weld, deretter Main, Accent, Supporting og Tertiary, hver med sin lyse og mørke farge, lest som hovedfargen, partnerfargen og bare etter navn, og Background, Text, Quiet text og Hairlines oppført under tabellen som bruksområdene ingen rolle fyller](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=wefthouse&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

Tabellen har fire kolonner. På en telefon blir hver rad et kort med lyst og mørkt side om side:

| Kolonne | Hva den inneholder |
|---|---|
| **Role** | Designsystemets eget ord, som du kan redigere direkte, og en linje som sier hva fargen er til |
| **Light** og **Dark** | Fargen i det utseendet for den valgte fargevarianten, med navn eller verdi og kontrasten |
| **Lolly reads this as** | Hva et verktøy gjør med rollen, med Lollys egne ord |

**Slik tolker Lolly en rolle.** Hver tolkning tar én rolle. Når du velger en tolkning en annen rolle har, flyttes tolkningen til denne rollen. Lolly utleder aldri mening fra et ord.

| Tolkning | Hva den styrer |
|---|---|
| **Lead colour** | Store former, knapper, fargen et verktøy bruker som hovedfarge |
| **Partner colour** | Den andre fargen et verktøy bruker |
| **Background** | Ligger bak alt annet |
| **Text** | Overskrifter og brødtekst |
| **Quiet text** | Bildetekster og liten skrift |
| **Hairlines** | Linjer, rammer og skillelinjer |
| **By name only** | Ingen verktøy velger rollen på egen hånd. Den tilbys i alle fargefelt og i Design, der et valg forblir koblet, slik at det følger fargevarianten |

En tolkning ingen rolle fyller, beholder designsystemets definisjon, og rommet lister disse tolkningene under tabellen. En rolle som har samme id som selve tolkningen, for eksempel en rolle kalt Primary, er den tolkningen og kan ikke flyttes.

**I et diagram.** Paletten **Design system - colour roles first** i Lolly Chart gir seriene designsystemets fargeroller i systemets egen rekkefølge, deretter resten av paletten. En rolle tolket som bakgrunn, tekst, dempet tekst eller tynne linjer utelates, fordi diagrammet tegner bakgrunnen og teksten i disse fargene. Ingenting endres før du velger den paletten. Et designsystem uten fargeroller viser paletten som **Design system - ordered**.

**Verdier.** Trykk på en verdi for å velge rollens farge for det utseendet og den valgte fargevarianten. **Same as light** lar den mørke verdien følge den lyse til du velger en mørk farge. **Aa**-brikken viser teksten Lolly velger å plassere på fargen. Linjen under verdien sier hvor lesbar teksten er i hvert utseende: **Text reads well**, **Large text only** eller **Hard to read as text**. Vurderingen gjelder bare tekst på fargen; fargen kan fortsatt fungere for former og store flater. En rolle som bare brukes ved navn, viser de samme ordene uten varselfargen, fordi ingen verktøy plasserer tekst på den rollen på egen hånd. Verktøytipset og velgeren viser tallene, APCA først og WCAG etterpå. **Own text colour** markerer en verdi der filen oppgir tekstfargen; den tekstfargen beholdes. **Copied** markerer en verdi fra en annen fargevariant eller fra partnerfargen som ingen har valgt ennå; **Keep this colour** i velgeren fastsetter verdien.

**Utgangspunkter.** Et designsystem uten egne roller viser de gjeldende ordene: Primary, Secondary, Surface og Text. Ingenting skrives før du endrer en av dem. **+ Add a role** foreslår **Primary, Secondary** eller **Main, Accent, Supporting, Tertiary**, eller tar imot ordene du skriver, og viser tolkningen hvert ord ville fått. De to første ordene blir hovedfargen og partnerfargen. Verktøyene fortsetter å tegne med de samme fargene. I et system med én hovedfarge får den første fargevarianten denne fargens navn.

**Gi nytt navn, endre rekkefølge, fjerne.** Et nytt navn endrer bare ordet; alt som bruker rollen, fortsetter å fungere. Dra en rolle etter håndtaket, eller trykk Space på håndtaket, bruk piltastene og trykk Space for å slippe. **Remove** sier hva som fortsatt bruker rollen. Når verktøy tolker rollen, lar **Remove and keep those colours** hver tolkning beholde sin gjeldende farge. En intern regel, en veiledningsgruppe, et verktøyfelt eller et annet token som bruker rollen, holder på rollen til den bruken endres. Et lagret Design-dokument kan også bruke en rolle ved navn, og Lolly kan ikke se det fra tokenfilen. Et slikt dokument melder at fargen ikke kan slås opp.

::: details Roller i en håndskrevet tokenfil
**En håndskrevet fil.** Farger i en tokenfil som ingen rolle erklærer, listes under **In this file, with no role yet**, hver med et felt for et ord og **Make a role**. De fortsetter å fungere ved navn uansett. Et token med sifre i navnet kan ikke være en rolle; det blir i filen og fortsetter å fungere via stien sin. Hvis en post i filen ikke består valideringen, vises tabellen uten kontroller og sier hvorfor.
:::

**Resten av rommet bruker de samme ordene.** Brikkene, fargeprøvens **Use as**-rad og palettens **Colour roles**-gruppe bruker alle designsystemets ord. Flisen til en fargerolle åpner verdien. Eksporterte filer registrerer ikke noe nytt om roller; fargene i en gjengivelse endres fordi tokenene ble endret.

**Hvor ordene går.** Ordene og beskrivelsene følger med designsystemet. Agenter leser dem i designbriefen, `lolly://tokens` og en merkevaresides `AGENTS.md`. Terminalen viser dem i `lolly system status`. En merkevareside lister dem i `brand.json` og måler et kontrastpar for hver rolle. DTCG- og Tokens Studio-filer beholder alt, `DESIGN.md` beholder ordene og tolkningene, og et PowerPoint-tema beholder bare merkevarens rekkefølge. [Fargeroller i andre formater](/info/design-tokens.html#colour-roles-in-other-formats) har hele listen. Ord siteres alltid som designsystemets data, aldri tolket som instruksjoner.

**Hvor en farge velges.** Hvert fargefelt i et verktøy og i Lolly Design lister designsystemets roller først, i systemets egen rekkefølge, med hvert ord og formålet det har. **Aa** ved siden av en rolle velger fargen som ligger på den rollen. De andre fargene følger under **Other colours**, uten fargevariantens egne kopier, fargene som ligger oppå andre farger og tolkninger en rolle allerede fyller. Et valg forblir koblet til rollen og følger fargevarianten. Feltet viser ordet i alle fargevarianter, og Settings og Tokens bruker også ordet. Et designsystem uten roller beholder rutenettet med fargeprøver.

### Hver farge et verktøy leser

Med **Colour roles** lukket starter rommet med brikker for de første valgene. Hver brikke viser rollens farge og navn. I et system uten egne ord er disse **Primary**, **Secondary**, **Surface** og **Text**. Trykk på en brikke for å velge fargen fra palettens fargeprøver. **Every colour a tool reads**, nederst i **Colour roles**, har hele stripen.

Stripen viser de sju fargene et verktøy kan lese: Primary, Secondary, Surface, Text, Muted, Edge og On primary, med designsystemets egne ord der det har dem. Hver spiller samme rolle i alle verktøy og eksporter. Ingen må være angitt, og enhver farge kan fylle en av dem. Tre fritt valgte farger gir et godt system. Avlesningen sier hvor lesbar teksten er mot bakgrunnen, med APCA først. Hver rad viser din egen farge med full styrke, en startfarge som brukes i stedet, eller **↳ follows Primary**.

On primary avledes fra primærfargen, er merket **Derived** og har ingen velger. Bryteren **Light** og **Dark** ved siden av On primary, og den ved siden av **In context**, velger hvilket utseende stripen, paletten og forhåndsvisningen viser.

Appens egen aksentfarge følger designsystemet som standard, gjennom innstillingen **Interface follows the design system** i **Settings → Appearance**. Med innstillingen av forblir appens grensesnitt nøytralt. Verktøy, lerreter og eksporter følger designsystemet uansett.

**Fargevarianter.** Et designsystem kan ha flere hovedfarger, valgt for hvert arbeid. Raden **Colourways** øverst i **Colour roles** viser én brikke per fargevariant, med **Default** på den kanoniske. **+ Add** starter en ny fargevariant fra en palettfarge. Velg en brikke, så viser tabellen, stripen, paletten og forhåndsvisningene den fargevarianten. Du kan gi den valgte fargevarianten nytt navn, duplisere den, fjerne den eller gjøre den til standard. I et system med fargevarianter trenger hver variant sin egen primær- og sekundærfarge, og sin egen bakgrunnsfarge når fargevariantene farger bakgrunnen. Disse rollene forblir angitt i redigeringsverktøyet for fargeprøver. [Legg til fargevarianter i et designsystem](/info/colourways.html#add-colourways-to-a-design-system) har trinnene og tokenformatet, og [Lolly Demo i bruk](/info/lolly-demo-in-use.html#colourways-on-real-work) viser fargevarianter på ekte arbeid. Hver person kan velge en fargevariant som sin egen i **Settings → Appearance** ([Gjør en fargevariant til din egen](/info/colourways.html#make-a-colourway-your-own)).

### Finn flere farger

Tre verktøy bygger på primærfargen din. De to første gir bare forslag; det tredje erstatter paletten.

::: cols
## Utforsk nyanser & harmonier

Velg en **Starting colour**, en **Scheme** (Mono, Complement, Analogous eller Triad) og hvor mange **Shades** (3 til 20, standard 5). **Fine-tune** angir intensitet i grensesnittet, kontrast og tekst på merkevarefargen. Klikk på en nyanse for å legge den til, eller **Add 5 shades** for en gruppe. Fargene og rollene dine beholdes.

## Finn farger som passer sammen

Velg en **Harmony**: Complementary, Adjacent, Triad, Tetrad eller Analogous (med **Accents** fra 2 til 5 og en **Angle** fra 10° til 45°). Hvert forslag har et generert navn og **+ Add**, ett trykk per farge.

## Bygg hele paletten på nytt

Erstatter paletten ut fra én startfarge, etter en gjennomgang av hva som endres og hva som beholdes.
:::

Alle tre bruker den samme perseptuelle fargematematikken (OKLCH) som motoren. I **Explore shades & harmonies** viser radene **Primary**, **Neutral** og **Secondary** de foreslåtte nyansene, og **Theme preview** viser lyse og mørke eksempler med kontrastmålingene.

![Tre foreslåtte nyansegrupper, med egne kontroller for å legge til hver nyanse og en separat Theme preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Genererte aksentfarger, hver med en fargeprøve, et automatisk generert navn, sin heksadesimale verdi og en Add-knapp](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Ta i bruk en generert palett

Åpne **Rebuild the whole palette…** og trykk **Preview full rebuild**. Gjennomgangen teller hvor mange roller som blir slik du tilordnet dem, hvor mange av dine egne farger som beholdes og hvor mange nyansekurver, trykklåser, skjulte nyanser og gradientstopp som forankres på nytt eller beholdes. **Apply rebuilt palette** tar endringen i bruk; **Cancel** endrer ingenting. Etterpå tilbyr kortet **Undo**, som allerede har fokus, og kontrollpunktet som ble tatt før byttet, gjenoppretter hele systemet.

Et system med fargevarianter beholder alle variantene når paletten bygges på nytt. Den kanoniske fargevarianten følger den nye startfargen, og alle andre fargevarianter beholder sine egne farger, navn, rekkefølge og innstillinger. Gjennomgangen viser hvilken fargevariant som følger med og hvilke som beholder fargene sine. Lolly bygger ikke et system på nytt hvis det koder fargevariantene på en måte Lolly ikke kan redigere; kortet sier hvorfor, og ingenting endres.

### Ekspertdelene

Fire sammenfoldede deler ligger under forhåndsvisningen og rollene. Hver åpnes med `#/start?area=color&focus=<name>`:

- **Explore shades & harmonies** (`focus=generate`).
- **Shade curves** (`focus=curves`) endrer en nyanseskala punkt for punkt, med separate kurver for lyshet, kroma og fargetone (L / C / H), og nyansene tegnes på nytt mens du drar.
- **Contrast** (`focus=contrast`): **Contrast-lock** justerer tonene i en nyanseskala for å nå APCA-mål mot en bakgrunn du velger, og **Rotate hue** dreier hele skalaen rundt fargehjulet.
- **Print** (`focus=print`) angir hva primærfargen blir på trykk: den automatiske verdien, en låst CMYK-blanding eller en navngitt spotfarge.

### Paletten og hver fargeprøve

Paletten lister fargene dine i sammenfoldbare grupper, hver med sin egen **+ Add**. Du kan opprette grupper og gi dem nye navn. En rolle lager aldri en ekstra flis; flisen en rolle peker på, viser rollens navn, for eksempel **Primary**. **Colour chart** under flisene viser de samme fargene på OKLCH-hjulet **Wheel** (dra et punkt for å endre farge, klikk på et tomt område for å legge til en fargeprøve) og i **Gamut**-diagrammet, som viser hvor området av visbare farger slutter. `#/start?area=color&focus=chart` åpner diagrammet.

![Palettpanelet, der alle grupper kan foldes sammen](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![OKLCH-hjulet - vinkelen er fargetonen, avstanden utover er kroma, og gråtonene følger en lyshetsskala langs siden](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Klikk på en fargeprøve for å åpne redigeringsverktøyet:

- **Rename** gir fargeprøven nytt navn.
- **Angi fargen** med OKLCH-glidere, eller i **Hex**, **HSL**, **RGB** eller **CMYK**. Verdifeltet leser og skriver i det aktive fargerommet. CMYK her angir skjermfargen ved konvertering; for å låse nøyaktige trykkfarger, bruk **Print substitutes**.
- **Stored as** velger hvordan fargeprøven lagres: **LCH** (standarden, perseptuell og med stort fargerom), Hex, RGB eller HSL.
- **Use as** gir fargeprøven en rolle, med designsystemets egne ord der det har dem. Trykk på en fremhevet rolle igjen for å fjerne rollen.
- **Print substitutes** (sammenfoldet): lås **CMYK** fra **Auto** til nøyaktige trykkfargeverdier, eller angi en **Spot colour** med et **Name** (for eksempel `PANTONE 186 C`), en valgfri **Book** og en **Finish** for folie, preging, nedpreging, spotlakk, soft touch eller utstansing, falsing eller perforering. Trykkeriet bruker disse låsene når du eksporterer en CMYK PDF eller TIFF; se [Fargeprofiler](/info/exporting.html#colour-profiles). En spotfarge trykkes på sin egen plate i en Print PDF; for å trykke alle spotfarger som prosessfarger i én eksport, se [Spotfarger som prosessfarger](/info/exporting.html#spot-inks-as-process).
- **In other spaces** (sammenfoldet): en verdi per fargerom, avledet eller angitt av deg, og en verdi du har angitt, har forrang ved eksport.

**Å slette en fargeprøve** er trygt. Avledede nyanser og temaroller skjules, så ingenting som leser dem, slutter å fungere. Farger du har lagt til, fjernes.

::: details Arbeide med mange fargeprøver
Som standard viser en fargeprøve fargen, navnet og den heksadesimale verdien. Select viser avkrysningsboksen og draghåndtaket til hver fargeprøve på alle skjermer, og en flis med tastaturfokus viser også håndtaket. Dra et håndtak for å endre rekkefølgen i en gruppe, eller gi håndtaket fokus, trykk Space, bruk piltastene og trykk Space igjen for å slippe; Escape avbryter. På en telefon viser paletten fire farger per rad. For å flytte farger mellom grupper bruker du **Group**-kontrollen i redigeringsverktøyet, eller velger flere og bruker **Move to**.

Markering trenger ingen egen bryter: linjen og avkrysningsboksene vises med den første valgte flisen og forsvinner med den siste.

- **Dra på et tomt område** for å tegne et rektangel; hver flis det berører, blir med i utvalget, på tvers av grupper. En sammenfoldet del legger ikke til noe.
- **Shift-klikk** velger et område i leserekkefølge, **Cmd/Ctrl-klikk** slår valget av én flis av eller på, og et vanlig klikk åpner redigeringsverktøyet.
- Hver gruppeoverskrift har **Select all**, og **Cmd-A** med fokus på en flis velger alle dine egne farger, aldri en startfarge.
- Rutenettet har ett tabulatorstopp: piltastene flytter, Shift-piltastene utvider, Space slår valg av eller på, Delete fjerner og Escape tømmer utvalget. For å finjustere en kanal trykker du først `l`, `c` eller `h`.
- På en berøringsskjerm trykker og holder du på en flis for å starte et utvalg, og trykker deretter for å legge til.

Linjen viser **{n} selected**, deretter **Move to**, **Give a role** (hver farge får neste rolle etter tur), **Download** (utvalget i et av de seks palettformatene), **Duplicate** (en kopi av hver, plassert etter originalen), **Copy values** og **Delete**. Én kopi åpnes i redigeringsverktøyet; flere forblir valgt. Ett Cmd/Ctrl-Z angrer en massehandling.
:::

### Gradienter

Det valgfrie **Gradients**-panelet bygger blandingstokener fra paletten. Hver gradient har en forhåndsvisning, 2 til 8 navngitte stopp og en vinkel. Et stopp peker på en fargeprøve, så endrer du fargeprøven, følger gradienten med. Blandingene skjer i OKLCH.

Palettnedlastingene (designtokener, CSS, SCSS, GIMP og Adobe Swatch Exchange) ligger øverst i paletten. [Ta med paletten og skriftene dine hvor som helst](/info/using.html#take-your-palette-and-fonts-anywhere) beskriver hvert format.

<!--i:eti-type-->
## Typografi

Uten en egen skrift viser rommet ett kort: **Primary**, satt i lesestørrelse med sin gjeldende skrift, med en **Starter**-etikett, en **Choose for Primary**-knapp og linjen *"Ingenting installeres før du velger en."* Overskrifter, kode og kursiv følger primærskriften til du velger egne; **Choose them separately** viser kortene deres.

![Type-rommet uten valgt skrift ennå - ett kort i lesestørrelse, en Starter-etikett på kortet og én fylt Choose for Primary-knapp](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Velg én skrift, så utvides rommet til fire rollekort, Fonts-listen og en levende skriftprøve:

- **Primary**: brødtekst, knapper og alle verktøy.
- **Headings**: tittelskriften for `h1` og `h2`.
- **Code**: en skrift med fast bredde for kode og data.
- **Italic**: en ekte kursiv for utheving, sitater og innskudd.

Et kort er bare farget der du har installert den skriften. Knappen viser rollen: **Change Headings** på en egen skrift og **Choose for Headings** alle andre steder. Eksempellinjen brytes. Ingenting på et kort tar en endring i bruk; knappen åpner sammenligningsvisningen for den rollen.

![De fire rollekortene vises - hvert satt i skriften som brukes for rollen, med en Starter-etikett der ingen har valgt en, og Italic som følger primærskriften](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Sammenligningsvisningen

Visningen åpnes under kortet du trykket på. Kortene foldes sammen til en stripe på én linje, slik at visningen får plass på telefonens første skjermbilde. Escape avbryter og flytter fokus tilbake til kortet.

1. Trykk **Choose for** og rollen på kortet.
2. Skriv inn navnet på en skriftfamilie og trykk **Preview**, eller trykk på en av de seks **Pinned**-familiene under feltet.
3. Trykk **Use this face**.

![Sammenligningsvisningen åpen under kortet sitt, med søkeraden, de festede skriftfamiliene og kortene foldet sammen til en stripe på én linje](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**Samtykke innhentes én gang.** Første gang en forhåndsvisning kontakter Google Fonts, forklarer en dialog: *Google får vite skriftfamiliens navn og IP-adressen din. Filen lagres deretter på denne enheten og brukes uten nett. Dette er det eneste trinnet i studioet som kontakter en tredjepart.* **Fetch from Google** fortsetter, og valget huskes. **Cancel** lar kortet vise *"Ikke hentet. Ingenting ble sendt til Google."*, med sin egen **Fetch from Google**.

**Slipp en skriftfil på visningen** (TTF, OTF eller WOFF) for å forhåndsvise en lisensiert skrifttype du eier. Uansett blir skriften på denne enheten, gjengis uten nett i appen, verktøyene og alle eksporter, og følger med i designsystemfilen. Alt på Google Fonts leveres under en åpen lisens (OFL, Apache eller UFL).

### Skrifter på denne enheten

Panelet **Fonts** lister alle skriftene på denne enheten og rollen de fyller. Skrifter du har lagt til, kommer først, under **In the design system**, hver med sine roller og en sletteknapp. Startskriftene følger i én nedtonet, sammenfoldet rad. **Add a face** åpner sammenligningsvisningen for en hvilken som helst rolle. **Type roles**-panelet viser en levende skriftprøve for hver rolle med skriftfamilien og tilstanden, for eksempel *Inter* eller *Inter · follows Primary*.

<!--i:eti-tag-->
## Tokener

Tokener er de navngitte verdiene bak designsystemet: farger, skrifttyper, logoer, hjørner og avstand. Verktøy leser dem ved navn, så en endring her når alle verktøy med én gang.

![Tokens-rommet: toppen med et eksempel fra systemet og filhandlingene, fliser som teller hver type token, deretter fargeparene med kontrastmålingene](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Toppen** gir et eksempel fra ditt eget system (*Primary er Spearmint, #033633*) og filhandlingene: **Download** (systemet som designtokener, eller paletten i fem andre formater), **Copy CSS** og **Add from…** for å lese inn en JSON-fil igjen.
- **Fliser** teller hver type token og hopper til delen: Colours, Type, Logos, Shape and spacing, More og All tokens. En del som bare inneholder det som fulgte med det tomme startsystemet, har en **Starter**-etikett; et system som fulgte med appen, teller sitt eget materiale uten etiketten. På en telefon fordeles flisene på to rader med tre i hver.
- **Colours** starter med parene verktøyene setter sammen (tekst på bakgrunn, tekst på primærfarge, dempet tekst på bakgrunn) med en APCA-avlesning i lyst og mørkt utseende, og markerer **Weak contrast** der et par ikke strekker til. Deretter følger hver fargegruppe: en nyanseskala som én rad med brikker, andre farger med verdien og referansen verktøyene bruker, for eksempel `{color.brand.spearmint}`. Trykk på en referanse for å kopiere den. **Edit in Colours** åpner en gruppe i Colours-rommet. I et designsystem med [fargeroller](#colour-roles-what-the-colours-are-called) kommer **Colour roles** først, med hver rolle én gang i systemets egne ord og rekkefølge. En rolle beholder en farge for hver fargevariant og hvert utseende. Disse fargene listes med rollen, ikke som separate farger; endre dem i Colour roles-tabellen.
- **Type** og **Logos** lister skriften for hver rolle og hver logoplass, med **Edit in Type** og **Edit in Logos** når du har dine egne.
- **Shape and spacing** inneholder **Rounded corners** (`shape.radius`) og **Spacing rhythm** (`space.base`). Hver viser *Lolly default* til du flytter glideren og *Yours* etterpå, lagres med én gang og kan angres.
- **More tokens** legger til avstand, størrelse, strekbredde, ugjennomsiktighet, rotasjon, vanlige tall og skygger, lagret som standard [designtokener](/info/design-tokens.html).
- **App appearance (advanced)** lister fargene, størrelsene og skyggene Lollys egne skjermer bruker, og **Inspect every token (advanced)** søker i og redigerer enhver lagret verdi og viser først hver endring for gjennomgang. Der listes verdiene til en fargerolle i hver fargevariant sammen med rollen: velg rollens token for å se én rad per fargevariant, lyst og mørkt ved siden av hverandre. Tellelinjen sier hvor mange verdier rollene har. Et skrivebeskyttet designsystem viser den samme listen.

En tom del tilbyr **Pick a colour**, **Choose a face** eller **Add a logo**.

<!--i:eti-images-->
## Filer

Slipp filene merkevaren din bruker, bortsett fra logoer: **vektor**-, **bilde**-, **lyd**- og **bevegelsesfiler** (video, Lottie og animasjoner). De vises i [Assets](/info/using.html#assets-your-library), sortert i deler, og i ressursvelgeren i alle verktøy. De blir på denne enheten.

## Lyd

**Sound** velges ved å lytte. Rommet åpnes med tre startlyder, **Calm**, **Steady** og **Bright**, hver som et kort i sjangerens farger med en avspillingsknapp. Spill av en for å høre et kort utdrag; starter du en annen, stopper den første. **Choose** gjør den lyden til lyden for alle bruksområder. Det fjerde kortet, **Mixed**, gir hvert bruksområde sin egen lyd: Calm for Explain, Steady for Demonstrate og Bright for Play. Avspillingsknappen spiller de tre etter tur. Ingenting lagres før du velger **Save sound**. Lyden blir da en del av dette designsystemet, med et kontrollpunkt i den samme historikken som de andre rommene bruker. Et designsystem uten lyd fortsetter å fungere som før.

Et bruksområde er en situasjon lyden spilles i: **Explain**, **Demonstrate** og **Play** til å begynne med. Hvert bruksområde er en brikke med sin egen avspillingsknapp. **Music** eller **With narration** over brikkene angir om en brikke spiller musikken alene eller under en stemme. Bruksområdet du velger, viser formålet og musikken med enkle ord, for eksempel "Varm · 84 bpm · Rhodes, rullende bass, støvete trommesett". Hvert bruksområde får den valgte lydens sjanger, tempo og instrumenter (eller sine egne med Mixed). Hvert bruksområde beholder sin egen melodi og balanse: Explain lar melodien vike for stemmen, og Play lar melodien lede. Når du bytter mellom Mixed og én enkelt lyd, beholdes begge. Et bruksområde du har lagt til selv, beholder lyden det har under Mixed. Designsystemet registrerer hva du valgte. **Add a use** legger til et bruksområde og lar deg skrive navnet direkte. **Make main** velger bruksområdet som spilles når ingenting annet er angitt. **Another tune** spiller en ny komposisjon med de samme innstillingene.

**Edit in the music generator** åpner [musikkgeneratoren](/info/generated-music.html#the-music-generator) med innstillingene for det bruksområdet, med en linje øverst som sier hvem sin lyd du redigerer. **Save to this use** tar innstillingene tilbake til rommet; **Cancel** går tilbake uten endringer. Ulagrede valg i rommet venter mens du er borte. Hvis noen lagrer lyden i en annen fane i mellomtiden, beholdes den nyere lagringen, og redigeringen din utelates.

**Voice** velger en stemme for bruksområdet, talehastigheten og hvor høyt musikken spilles under stemmen; **Hear the voice with the music** spiller begge. Under **More** ligger senkingen mens stemmen snakker, ordene du vil prøve (de blir i rommet), uttalenotater (ett per linje, som skrevet = uttalt) og notater om stemmen. Forhåndsvisninger bruker den lokale talemodellen og samme miksing som en sekvenseksport. En forhåndsvisning toner ut; den har ingen komponert avslutning.

**Notes and signature** inneholder hva du skal lytte etter i et bruksområde og en lydsignatur: en fast åpning eller avslutning lagret som en egen lydfil. Plasser signaturen i sekvensen din; generert musikk inkluderer aldri signaturen. Et krav denne versjonen av Lolly ikke kan sjekke, stopper ny musikk for det bruksområdet.

**Details** inneholder merkevarens karakter (hvordan lyden skal oppleves, hva som forblir likt og hva som skal unngås) og lyttevurderingen. **Record a listening review** lagrer vurdererens navn, datoen og notatene deres sammen med den lagrede versjonen av lyden. Enhver endring gjør lyden til et utkast igjen. En vurdering dekker den versjonen, ikke alle låter som lages fra lyden senere: lytt til hvert nytt stykke før det sendes ut.

**Make a music project** åpner bruksområdet i musikkgeneratoren som et prosjekt som beholder bruksområdet, lydversjonen og de nøyaktige innstillingene. **New tune** der lager en ny komposisjon og beholder lyden. Hvis du endrer innstillingene, går **Put the sound back** tilbake til lyden, og **Keep as my own** fortsetter med en uavhengig låt. Før du velger, kan prosjektet ikke lagres eller lastes ned som laget fra lyden. Delingslenker inneholder bare musikkinnstillingene. Prosjektet og en lagret låt beholder også lydens notater, som holdes utenfor delingslenker og lydfilens offentlige autentisitetsopplysninger. Behold et gjengitt opptak når den nøyaktige lyden må bevares gjennom fremtidige versjoner av generatoren.

<!--i:eti-checklist-->
## Regler

**Rules** angir hva folk kan endre, hva som forblir fast og hva Lolly kan sjekke.

![Rules i Lolly Demo: fire interne regler, hver merket Checked in Design og Required eller Advisory, deretter Try your design system in use med eksemplene klare til gjengivelse](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** lister reglene dine. **Add rule** (eller **Add your first rule**) åpner et kort skjema:

- et **Rule name** med dine egne ord, for eksempel *Beacon-aksentfarger*;
- **Check**: **Colour choices**, **Font choices**, **Fixed artwork** eller **Text length**, med merkevarerollen den bruker, under ditt eget navn på rollen;
- **Example** den gjelder for (Poster, Title slide, Content slide eller Lolly Chart), **Mode** og om den er **Required** eller **Advisory**;
- **Reviewed by**, deretter **Save draft** eller **Approve & save**.

Godkjenning registrerer din egen beslutning på denne enheten. Godkjente obligatoriske regler begrenser den gjenbrukbare plakaten, og sjekkene dekker bare eksempel-PNG-ene; de endrer ingen andre verktøy.

Regler i et designsystems tokenfil, som godkjente fargepar, skriftvekt og justering eller en logo per bakgrunn, listes her som **Checked in Design**. Lolly Design sjekker dem lag for lag i eksportpanelets **Before you export**-kort, og `lolly check` gjør det samme for et lagret Lolly Design-dokument ([Før du eksporterer](/info/design.html#before-you-export)). En regel denne utgaven ikke har en sjekk for, beholdes som den ble levert og merkes **Unchecked**.

Lolly Demo har fire godkjente interne regler. Overskrifter settes aldri med bare store bokstaver: den regelen er obligatorisk, så `lolly check` rapporterer en overskrift med bare store bokstaver som en feil. De tre andre er veiledende. Brødtekst er venstrejustert. Primærlogoer plasseres på lyse bakgrunner og negative logoer på mørke. Stiplede linjer betyr slipp her.

**Try your design system in use** gjengir fire eksempler fra den gjeldende revisjonen med **Render & check examples**. Velg en **Mode** og **Try your own text** for overskriften, støtteteksten og lysbildeteksten. Hvert eksempel rapporterer hva som ble målt, med **See checks & sources** og **Download check report**. **Make reusable poster** laster ned en `.lolly` som har sin faste layout og godkjente inndatavalg. Eksemplene er lokale: å kjøre en sjekk publiserer og godkjenner ingenting.

En utgave som leveres med en fast merkevare, viser de samme reglene og eksemplene skrivebeskyttet, under *This brand is set*.

<!--i:eti-graduation-cap-->
## Ferdigheter

**Skills** lister det aktive designsystemets [merkevareferdigheter](/info/brand-skills.html): merkevarens skriftlige standarder, én per fagområde, for mennesker og KI-agenter. Hver rad viser fagområdet, merkevarens egen status (**Draft** eller **Approved**), om ferdigheten er offentlig eller intern og revisjonen. Velg en rad for å lese ferdigheten med dekningen, som sammenligner linjene i ferdigheten med tokenene dine: hva Lolly sjekker, hva som er i konflikt, hva som samsvarer og hva som bare er veiledning.

**Download skill (.zip)** skriver ferdigheten som en Agent Skills-mappe for et agentverktøy, med kataloglenker som peker til denne Lolly-instansen. **Copy as one file** legger den samme teksten på utklippstavlen for et chattevindu. Et designsystem uten egne ferdigheter lister et grunnlag som Lolly skriver fra tokenene og de interne reglene hver gang grunnlaget leses. Rommet leser ferdigheter og redigerer dem aldri.

<!--i:eti-upload-->
## Importer en merkevare

**Add from…** i linjen åpner en velger som spør hva du har, ikke hvilket format det er:

- **Design tokens or a design file**: DTCG- eller Tokens Studio-JSON, et Penpot-prosjekt, en zip med tokensett, en Lolly-designsystempakke, en SVG, en `DESIGN.md` eller en merkevaresidemappe.
- **PDF**: en presentasjon eller en fil med retningslinjer, som leses på denne enheten for å hente farger, logoer og innebygde skrifttyper.
- **Logo or screenshot**: et bilde blir til en foreslått palett, lest på denne enheten. Den leser farger, ikke skrifttypen eller layouten.
- **Saved web page**: én HTML-fil og CSS-filene dens, eller innlimt HTML eller CSS, opptil 20 filer og 2 MB. Bare teksten du oppgir, leses: lenkede ressurser hentes ikke og skript kjøres ikke.
- **Font file**: TTF, OTF eller WOFF. Åpner Type-rommet, der skriften installeres.
- **Website**: én side som leses for å hente farger og typografi. Denne flisen vises bare på en enhet som kan lese en side, og sier hvilken leser den bruker: appen på denne enheten, eller nettleserutvidelsen i en bakgrunnsfane, logget inn som deg. Å skrive inn en URL fyller bare ut feltet; å trykke på hent er samtykket.

Velg designfil som kilde, så lister det neste kortet de godtatte formatene som ikonfliser. Hele kortet er ett slippområde. Du kan også slippe en fil på studioet.

![Importkortet - de godtatte formatene vises først som ikonfliser, og hele kortet er ett slippområde](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- En **Lolly-designsystempakke** (`.lolly`, eller en eldre `.zip`) installeres i ett trinn.
- En **Penpot**-eksport (`.penpot`) tar med sine designtokener.
- En **Design Tokens**-fil (W3C DTCG) eller **Tokens Studio**-fil (`.json`) tar med sine tokener. En beskrivelse som ber en leser om å ignorere instruksjoner, hevder å gi tillatelser eller ber om å kjøre kode, utelates, og importen sier hvor den lå.
- En **vanlig SVG** skannes etter farger du kan velge blant, og den første blir primærfargen din.
- En **`DESIGN.md`** (`.md`) går til **Try these colours** med tokenene slik de er skrevet. Prosaen kan beholdes som et utkast til en merkevareferdighet, og kortet markerer linjer som ber en leser om å ignorere instruksjoner, hevder å gi tillatelser eller ber om å kjøre kode. Agenter og merkevaresider ser ikke et utkast før du trykker **Keep this skill** i Skills-rommet, og en beholdt ferdighet forblir intern.
- En **merkevaresidemappe**, valgt som mappe, sluppet eller pakket som zip, går til den samme gjennomgangen. Hver fil sjekkes mot mappens `brand.json`; én fil som ikke stemmer, gjør at hele mappen avvises. Importen legger til tokenene. Logoer og skrifter blir i mappen.

::: warning Instruksjonssjekken leser linje for linje
Sjekken som utelater instruksjoner i beskrivelsene i en tokenfil, leser linje for linje og fanger ikke opp andre formuleringer. Les en fil fra noen du ikke kjenner før du tar tokenene i bruk.
:::

Lolly leser en merkevareside fra filer du oppgir. Den henter ikke innhold fra adressen til et annet nettsted.

### En fil med egne fargeord

En tokenfil eller en `DESIGN.md` kan bruke egne ord for fargene, som hovedfarge, aksentfarge, støttefarge og tertiærfarge. Når Lolly finner slike ord, lister gjennomgangen hvert ord før noe tas i bruk: ordet, fargen i hvert utseende, tokenet det kom fra og Lollys foreslåtte tolkning. Lolly foreslår tolkninger ut fra ordene alene, mot en kort liste, uten modell. Et ord utenfor listen kommer inn som merkevarens eget, **By name only**. Du kan gi ethvert ord nytt navn, si hva det er til, gi det en annen tolkning eller fjerne avkrysningen for å beholde det som en navngitt farge.

**Install with these roles** skriver rollene; **Install without roles** installerer filen slik den kom. En fil uten slike ord hopper over dette trinnet. En fil som oppgir sine egne roller, for eksempel en Lolly har skrevet, viser dem slik de er skrevet og installerer dem uendret; du kan redigere dem senere i Colours-rommet. Terminalen har ingen gjennomgang: `lolly system import` beholder en oppgitt post og lar ord i andre filer forbli navngitte farger.

### Gå gjennom en referanse

En logo, et skjermbilde, et nettsted eller en lagret side åpner **Try these colours**: et eksempel i de foreslåtte fargene, en **Main colour** du kan endre og et navn på et nytt system. En boks sier hva som skjer når du tar dem i bruk: det **erstatter** de aktive tokeninnstillingene med den genererte paletten og standardstilene, **beholder** skriftene og bibliotekfilene dine, og det forrige systemet kan **gjenopprettes**. **Apply suggested settings** tar et kontrollpunkt og tar deretter i bruk den lyse og den mørke paletten. **Restore brand settings** kan hente tilbake de gamle innstillingene. **Change reference** velger en annen kilde.

::: details Hva som leses fra en referanse, og rapporten om designkontekst
**Palette, source details and individual choices** viser hva som ble lest, eventuelle skriftnavn som ble funnet og kontrasten i forhåndsvisningen. Skriftnavn er bare forslag; du installerer en skrift i Type. Kildedetaljene kan omfatte typografi, mellomrom, utfylling og hjørneverdier der de er observert, ellers merket **Not observed**. En lagret side eller en direkte nettstedslesing rapporterer erklærte stiler, som siden kanskje ikke bruker. Nettleserutvidelsen kan rapportere målte stiler fra et utvalg synlige elementer. Dette er observasjoner: ingenting installeres, og avstanden fra kilden erstatter aldri din egen. **Choose individual items in the tray** beholder enkeltelementer. **Download design context** lagrer en JSON-rapport med observasjoner, foreslåtte tokener og kildeinformasjon (med en SHA-256 av eventuell oppgitt HTML eller CSS). Rapporten inneholder ingen rå sidetekst og er ikke en signert Content Credential.
:::

Importer av PDF-er og designfiler beholder sine egne kontroller for gjennomgang. Elementer i **Tray** endrer ingenting før du legger dem til i rommet som eier den typen materiale. `#/start?source=<kind>` åpner velgeren på en kilde (`file`, `pdf`, `image`, `font`, `url`, `page`), og `?import` åpner den enkle listen.

### Finn og sammenlign et utseende

Åpne **Find a look** fra Board eller fra designsystemlisten i Settings. Bla gjennom systemer lagret på denne enheten og noen gjenbrukbare Lolly-eksempler, og søk etter navn, fargeetikett eller oppgitt skrift. **Closest to my current palette** sorterer etter målt fargelikhet, med samsvarende skrifter som avgjør ved likhet; det er ingen kvalitetsscore.

Klikk på et utseende for å forhåndsvise det i kontekst; forhåndsvisning endrer ingenting. **Use this look** på et kort tar det utseendet i bruk. Et lagret system blir det aktive, noe som ikke redigerer noe. Fargene i et eksempel legges inn i det åpne designsystemet etter det vanlige kontrollpunktet. Systemets logoer, skrifter og alt annet eksempelet ikke definerer, forblir som det er. **Compare looks** legger til en avkrysningsboks på hvert kort: velg to for å sammenligne dem side ved side. **Restore brand settings** gjenoppretter det forrige utseendet. Lagrede systemer har redigerbare **Search tags** under **Details and design context**. Eksemplene er originale Lolly-fargeoppskrifter, uten en skrapet samling og uten konto.

![Lolly sammenligner Sunroom og Orchard side ved side før du tar et av fargesystemene i bruk.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

<!--i:eti-package-->
## Behold og flytt designsystemet ditt

### Flytt en merkevare mellom enheter

**Export** skriver én **`LollyBrand-….lolly`**-fil: tokenene, skriftene, logoene og temapreferansen din, med et integritetsmanifest som sjekkes ved import. Nettversjoner før 1.0.7 ga filen endelsen `.zip`, og Lolly godtar fortsatt den skrivemåten. **Tokens (.json)** skriver det rene designtokendokumentet, uten skrifter eller logoer, for et kodelager, et byggetrinn eller et annet tokenverktøy.

For å hente et tilbake bruker du **Add from… → Design tokens or a design file**, eller slipper filen på studioet. Slik gir en kollega deg en merkevare, eller du tar med en til en annen installasjon, uten konto og uten sky. [Arbeide med partnere](/info/partners.html) dekker hva annet du skal sende når personen som mottar merkevaren din, jobber for en annen organisasjon. For å importere en merkevare fra kommandolinjen, se [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** pakker skriftene du har lagt til, i en installerbar RPM. Hvis du har lastet opp noen av dem selv, ber Lolly deg først bekrefte at du har lov til å distribuere dem videre.

### Gjenopprett tidligere innstillinger

Åpne **More** i linjen, velg **Restore brand settings**, velg et datert kontrollpunkt og trykk **Restore**. Dette gjenoppretter farger, typografiinnstillinger og andre tokener for den aktive merkevaren; skrift- og bildefiler forblir som de er. Lolly lagrer først de gjeldende innstillingene dine som **Before restore**, slik at du kan reversere en gjenoppretting selv etter å ha lukket nettleseren. De siste 20 kontrollpunktene beholdes på denne enheten. En redigering gjort mens studioet viser **Saving…**, overlever en omlasting, og et kort tilbyr å gjenopprette endringer som ikke ble ferdig lagret.

### Versjoner

En publisert versjon er en **permanent, navngitt kopi** lagret på denne enheten. Den endres aldri, så et verktøy eller en lenke som låser til den (med `designv`), fortsetter å tegne det samme. Et system med noe av ditt eget lister **Versions & publishing** i linjens **More**-meny; etter din første publisering blir **Versions** et av rommene. `#/start?area=versions` åpner Versions.

::: warning En publisert versjon er permanent
Det finnes ingen sletting ennå, og panelet sier det. Publisering kan ikke angres; gjenoppretting kan. *Restore latest from this version* er en vanlig redigering, med **Undo** tilgjengelig med én gang.
:::

**Fjerninger står først på kompatibilitetskortet**, fordi et fjernet token får et verktøy til å slutte å fungere.

**Publish only** beholder en versjon uten å endre hva verktøyene følger; **Publish and make active** får verktøyene og appen til å følge den versjonen. **Follow the latest again** tar hver redigering i bruk med én gang.

### Publiser en merkevareside

En [merkevareside](/info/brand-page.html) er én adresse for mennesker og agenter: en side med logoer, farger, typografi og eksempler, med de samme opplysningene i tilhørende filer. **Publish a brand page**, under Versions & publishing, viser den levende siden og, ved siden av siden:

- **Goes public**: hver fil, gruppert, med størrelse.
- **Held back**: hva som ble utelatt og hvorfor. En logo uten registrert lisens holdes utenfor til du krysser av ved logoens navn. En skriftfil trenger en registrert lisens som tillater videreformidling, og siden viser en skriftprøve som omriss når filen holdes utenfor. Interne merkevareferdigheter vises aldri.
- **What was checked**: fargepar per fargevariant og modus, og de interne reglene. Dette er målinger, ikke en dom.
- **In your words**: en brukserklæring og en kontakt. Siden viser det du skriver, og Lolly legger ikke til noen lisens eller juridisk påstand. En bryter slår av linjen "Made with Lolly" i bunnteksten.
- **On exports**: en bryter som [registrerer sidens adresse i eksportene fra dette designsystemet](/info/brand-page.html#lead-back-from-your-files). Bryteren er av til du slår den på, krever en `https`-adresse og følger ikke med en pakke eller en kopi. Et låst designsystem viser ikke bryteren, fordi den ansvarlige bestemmer.

**Download folder** lagrer mappen som en ZIP du kan publisere der du vil. Ingenting blir offentlig før du publiserer mappen. I en terminal skriver `lolly system publish --out=<dir>` den samme mappen. En instans som leverer merkevaresider, tilbyr også **Publish to** sin adresse: ett uttrykkelig trykk, gjennom instansens godkjenningskjede når den har en. Et administrert designsystem publiserer bare når den ansvarlige tillater det.

### Koble til en agent

**Connect an agent**, på samme sted, gir deg tekst å lime inn og sier hva hvert alternativ kan gjøre:

- **`AGENTS.md`** i et prosjekt: agenter leser systemets navn og regler. Det tegner ingenting og trenger ingen server.
- **Lolly's public server**: tegner med Lolly Demo, uansett hvilket system du har åpent her. Den trenger ingen nøkkel.
- **Your instance**: tegner med systemene instansen har, og leser et tjenestetoken fra en miljøvariabel. Arket oppgir variabelens navn og viser aldri et token.

Når ingen driftet server tegner med systemet ditt, sier arket det.

<!--i:eti-layers-->
## Administrer designsystemene dine

Åpne **Settings → Preferences → Design systems** for å bytte, legge til eller fjerne systemer. **Open** velger et system og åpner det her; **Make a new one** oppretter et lokalt system og åpner det med navnefeltet klart. Ett system er aktivt om gangen, for hele enheten. [Merkevarearkitekturer](/info/brand-architectures.html) hjelper deg å avgjøre når en merkevare trenger sitt eget designsystem.

**Hvor et system kommer fra.** Systemet som leveres av katalogen til en installasjon, er merket **Came with this app**, eller **From this instance** i en app som er koblet til en instans. Utvid **Catalogue source** for å se hvem som leverer det, tokenressursen og navnerommet og kjent versjon eller kontrollsum; hvis en oppdatering mislykkes, merkes mellomlagret materiale.

**Administrerte systemer er skrivebeskyttet.** Et system er merket **Managed by this instance** (eller **Managed by this app** i skrivebordsappen uten instans) når katalogen låser systemet. Du kan bruke og laste ned et administrert system. Når du åpner et her, vises en merknad om skrivebeskyttelse med **Make an editable copy** og **Switch**, deretter fargerollene og tokenene uten redigeringskontroller. Dine egne lokale systemer forblir redigerbare, selv når det administrerte kom først. En utgave med én fast merkevare åpner Lolly Design System Setup på *This brand is set*, med merkevarens tokener og bruksregler tilgjengelige for lesing.

**Alle andre medfølgende systemer kan du** skjule, redigere og tilbakestille, også Lolly Demo og Lolly Starter på lolly.tools. Når du redigerer et, beholdes navnet og raden merkes **Edited here**. **Reset to original** i menyen forkaster endringene som er gjort på denne enheten. Det tomme startsystemet er unntaket: den første endringen der starter ditt eget designsystem, og Lolly spør én gang etter navnet. [Lolly Demo i bruk](/info/lolly-demo-in-use.html#switch-to-your-own) viser hva ditt eget system erstatter.

### Fjerne et designsystem

Velg **Remove** fra menyen til et system; bekreftelsen sier hvilket system som blir aktivt etterpå. Lagrede økter, opplastinger og materiale som er delt med et annet system, beholdes.

Å fjerne et medfølgende system skjuler bare systemet: katalogressursene beholdes, **Bring back** viser det igjen og det kommer tilbake av seg selv hvis du fjerner alt annet. Å fjerne en importert eller redigert kopi fjerner ikke det medfølgende systemet, logoene eller skriftene. Hvis kopien var aktiv, blir det medfølgende systemet aktivt igjen. Å fjerne en aktiv kopi fra en server fjerner bare den kopiens tilkobling; en separat valgt instans forblir valgt.

::: details Endre et designsystem en server leverer
Å endre hva en server leverer, er en administratoroppgave: driftsansvarlig endrer kildekatalogen og ruller ut på nytt, eller en Lolly Work-administrator gjennomgår og tar i bruk en serverendring. Redigeringer her forblir lokale, med ett unntak. På en Lolly Work-instans som gir deg `brand.edit`, tilbyr et administrert system også **Edit for** den instansen, som åpner en redigeringskopi. **Send to** den instansen i **Versions** sender fargene, fargevariantene, fargerollene og merkevaresidens adresse tilbake. [Rediger denne instansen fra studioet](/info/work-design-system-administration.html#edit-this-instance-from-the-studio) dekker hva en redigering kan endre og hvordan instansen leverer endringen. Se [Fjerne et designsystem fra katalogen](/info/configuration.html#removing-a-catalogue-design-system) og [Konfigurasjon](/info/configuration.html#supplied-and-local-design-systems).
:::

<!--i:eti-code-->
## Bruk designkontekst utenfor appen

**Download design context** lagrer tokendokumentet, oppslåtte fargeverdier, oppgitte skriftfamilier, ressurs-id-er, kildedokumentasjon der den er registrert, dekning og uttrykkelige regler, uten skriftfiler og uten bevis på eierskap. Kommandolinjen leser filen uten server: `lolly system import` gjør den til terminalens designsystem, og `lolly system check` sjekker Lolly Design-inndata mot den lagrede konteksten. [Ta med designsystemet ditt](/info/cli.html#bring-your-design-system) dekker importen, og [Hvilket designsystem en kommando bruker](/info/cli-decks.html#which-design-system-a-command-uses) dekker sjekken. En MCP-klient leser den samme briefen fra `lolly://design-context` ([MCP Server](/info/mcp.html)).

<!--i:eti-map-pin-->
## Veien videre

- **[Slik bruker du Lolly](/info/using.html)**: verktøyene, lagring, deling og Assets.
- **[Merkevarearkitekturer](/info/brand-architectures.html)**: hvordan divisjoner, produkter, støttede merkevarer, kunder og sesonger fordeles på designsystemer, fargevarianter og logoidentiteter.
- **[Arbeide med partnere](/info/partners.html)**: dele merkevaren din med en partner og arbeide i en merkevare du har fått.
- **[Merkevaresider](/info/brand-page.html)**: publiser designsystemet ditt på én adresse, som en pressepakke og en agentpakke.
- **[Design Tokens](/info/design-tokens.html)**: tokenmodellen merkevaren din er skrevet i.
- **[Eksporter en fil](/info/exporting.html)**: trykkenheter, CMYK og formatene merkevaren din gjengis i.
