# Brand Studio

**Brand Studio** på `#/start` er det ene stedet du former merkevaren din - logoene, fargene, typografien, resten av tokenene og filene den holder på. Sett det opp her én gang, så følger hvert verktøy, hver side og hver eksport det *ved konstruksjon*, ikke ved gjennomgang.

Endringer forhåndsvises **live i hele appen** mens du gjør dem, slik at du kan se en farge eller en font slå inn overalt før du bekrefter den. Alt skjer på enheten: merkevarefilene og tokenene dine forlater aldri maskinen din (å velge en Google-font henter den ene familien fra Google, én gang, etter en samtykkedialog), og merkevaren reiser i én enkelt [merkevarepakke](#move-a-brand-between-devices)-fil.

> **Dette er redigeringsverktøyet. Dashbordet er speilet.** Fanen **Designsystem** på dashbordet (`#/d`) *viser* merkevaren din skrivebeskyttet; du *redigerer* den her på `#/start`. Vil du endre en farge senere, kom tilbake til Brand Studio.

## Rommene

Studioet er et sett med **rom** listet i en skinne nedover siden - ikke trinn. Ingenting er nummerert, ingenting er sperret av noe annet, og å komme til hvilket som helst av dem er like legitimt:

- **Oversikt** - navet. Det som finnes akkurat nå, med et blikk, med en dør inn til hvert rom.
- **Farger** - legg til farger én om gangen, tildel roller eller generer en hel palett fra én.
- **Typografi** - de fire skriftene appen, verktøyene og hver eksport leser.
- **Logoer** - merkene dine, i hver retning og variant.
- **Tokens** - hjørneradius, spacing, shadows og resten av systemet.
- **Filer** - bilde-, lyd- og bevegelsesfilene merkevaren din har.

På en telefon blir den samme listen en horisontal chip-stripe festet under toppteksten. Å bytte rom laster aldri noe på nytt - redigeringsverktøyet holder alle panelene sine montert og viser rett og slett bare det du ba om.

**Dyplenk til et rom** med `#/start?area=<key>`. Nøklene er `overview`, `color` *(merk den amerikanske stavemåten i URL-en)*, `type`, `logos`, `tokens`, `catalogue` (rommet Filer - panelnøkkelen er en permanent kontrakt, så URL-en beholder det gamle navnet) og `versions`. `?tab=` er det etablerte aliaset for det samme og løses fortsatt opp, så gamle lenker og bokmerker fortsetter å virke; alt ukjent åpner Oversikt i stedet for å ende blindt.

Festet til **bunnen av skinnen** er handlingene som hører til hele designsystemet, ikke ett rom:

- **Legg til fra…** - kildevelgeren, for å hente inn en merkevare fra en fil, en PDF, et bilde, en skrift eller et nettsted. Se [Hent inn en merkevare](#bring-a-brand-in) under.
- **Skuff** - kandidatene et søk har funnet, men ikke tatt i bruk ennå. Den er skjult til et søk faktisk beholder noe, og bærer da et antall; ingenting i den endrer merkevaren din før du trykker Add på den raden.
- **Eksporter** - skriver hele designsystemet som én `LollyBrand-….lolly`.
- **Tokens (.json)** - det rene design-tokens-dokumentet for seg selv, for et repo, et byggetrinn eller et annet tokens-verktøy.
- **Restore brand settings** - gå tilbake til et kontrollpunkt lagret før en import eller en erstatning av merkevareinnstillinger.
- **Versjoner** - publiser, aktiver og gjenopprett navngitte kopier av designsystemet. Skjult til det finnes noe eget å publisere (eller en `?area=versions`-lenke ber om det ved navn).

![Studioets romrekke - Oversikt, Farger, Typografi, Logoer, Tokens og Filer](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Oversikt

Oversikt er det første rommet, og det har to ansikter.

Med **ingenting valgt ennå** sier det **Gjør den til din**. **Start from a reference** åpner kildevelgeren for en logo, et skjermbilde, en nettside eller en designfil. **Velg en farge**, **Velg en skrifttype** og **Legg til en logo** åpner sine eksisterende kontroller direkte. Hver vei starter med et valg; å åpne én skriver ingenting. **Utforsk verktøyene** er tilgjengelig med én gang.

Så snart noe er ditt eget, viser det samme rommet **hva du har**, med antallene du har laget i front. Farger leser av antall farger designsystemet bærer, og legger til et dempet `· N starter` bare der det finnes arvede farger å vise; stripen ved siden av setter dine egne valgte farger først, så en hårlinje og de falmede startfargene. Typografi leser etter rolle (*Inter for overskrifter*, med *Start for resten · SUSE, SUSE Mono* under). Logoer leser av hvor mange plasser som er fylt, eller **Ikke angitt**. Tokens bærer hjørneradiusen, tagget *start* til du flytter den. Filer sier **Ingenting ennå** mens biblioteket er tomt. Hver blokk er en dør inn til rommet sitt. Det finnes antall her, aldri en fremdriftsindikator og aldri et sluttkort - ingenting i dette studioet skylder noen noe.

## Logoer

Start med å tømme mappen din av merker inn i slippsonen øverst: **«Slipp merker her, eller velg flere samtidig»** tar imot så mange filer du har, i én omgang. Hver fil leses for form og farge, og settes deretter i kø under **Venter på plass** som en chip som sier hva den tror - *«Ser ut som Horisontal primær»*, med målet den bygger på, og en **Plasser**-knapp (**Erstatt**, der plassen allerede er fylt). Der den ikke er sikker sier chipen det tydelig og tilbyr **Bytt plass** i stedet, som lister alle åtte. Ingenting plasseres før du trykker på noe.

To ting skjer rundt den køen. Et merke med overflødig tom marg får et **beskjæringstilbud** først - svar på det eller trykk Escape, så går originalfilen inn urørt. Og der et merke kan fylle en tom søsterplass, tilbyr rommet den avledede **mono**- eller **omvendt**-versjonen som sin egen chip, merket *Generert*, som forsvinner igjen hvis du fyller den plassen på en annen måte.

Under det ligger rutenettet hvert merke ender opp i - **orientering × behandling**-plasser:

- **Orienteringer:** Horisontal (ordmerke + symbol på rad) og Vertikal (stablet, for kvadratiske og høye rom).
- **Behandlinger:** Primær, Primær omvendt (for mørke bakgrunner), Mono (én farge) og Mono omvendt.

Det er åtte valgfrie plasser. Klikk en plass for å legge til en PNG, SVG, JPEG eller WebP; klikk en fylt plass for å erstatte den. Hver plass er valgfri, og alt forblir på denne enheten.

![Logomatrisen - hver orientering på tvers øverst, hver behandling som sin egen stiplede plass, alle valgfrie](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Tilpassede merker** - legg til merker merkevaren din kaller ved sitt eget navn (et ikon, et emblem, en favicon) under **Tilpassede merker**; gi det navn og velg en fil.
- **Flere identiteter** - en undermerkevare, et produkt eller et event kan ha sitt eget fullstendige sett med logoer. Bruk **+ Add another logo** og gi den navn; hovedsettet ditt heter rett og slett «Your logo».
- **Last opp en SVG, så leser Lolly fargene dens.** På en helt ny installasjon setter den stille primærfargen din fra logoen og sier det. På en eksisterende merkevare tilbyr den i stedet fargen som et forslag - *«Funnet i logoen: #…»* med en **Bruk som primær**-knapp ved siden av - borte i Farger-rommet, der du kan ta den eller avvise den.

## Farger

Rommet vokser med designsystemet. Ingenting du ikke har trengt ennå, er på siden, så et første besøk er ett valg, og resten kommer i takt med paletten.

### Den første fargen

Et designsystem uten egne farger åpnes i én sentrert kolonne: **Start with one colour**, en stor levende fargeprøve, et felt, og en stille linje som sier at roller, nyanser og trykkinnstillinger kommer etter hvert som systemet vokser.

- **Fargeprøven er velgeren.** Trykk på den, så åpnes studioets eget OKLCH-kort på fargeprøven, forhåndsutfylt med det feltet inneholder: et navn, hjulet, de fire skivene, alfa og **Lagret som**, med **Avbryt** og **Legg til farge** nederst. Å dra en skive maler fargeprøven og skriver om feltet mens du gjør det, og ingenting når designsystemet før du trykker **Legg til farge**.
- **Feltet tar imot enhver notasjon** - `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` eller et vanlig fargenavn - og en hel *liste* med farger blir en rad fargeprøver du legger til én om gangen.
- **To dører til ligger ved siden av.** Fargeplukkeren (i en nettleser som har en) henter en farge fra skjermen, og **Fra et bilde** leser et skjermbilde eller et foto på denne enheten og tilbyr fargene den finner.
- **Legg til er aldri deaktivert.** Med ingenting lesbart i feltet åpner den velgeren, som er det et tomt trykk vanligvis betyr; tekst den ikke kan tolke, får en linje under feltet som sier det, i stedet for en død knapp.

Den første fargen blir **primærfargen**, og fargeprøven som svarer på tilføyelsen sier det - *«Primærfargen er nå Vivid Violet»* - med **Finjuster** ved siden av.

![Farger-rommet med ingenting valgt ennå - én stor levende fargeprøve, ett felt og én linje om hva som kommer senere](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Start

**Start** er ordet for alt som fulgte med appen i stedet for å bli valgt. En helt ny installasjon bærer ingen farge i det hele tatt: det den har, er én nøytral rampe, blekk gjennom papir, slik at flater, tekst og hårlinjer rendres før noen har bestemt noe. De nøytrale fargene er stillas, så de telles ikke som farger og tegnes ikke i palettpanelet. De bor i [Tokens](#tokens)-rommet som **Neutrals · starter · 9**, med en **Åpne** som viser dem i Farger-panelet som én sammenslått, tagget gruppe (`#/start?area=color&group=neutral`).

Det samme ordet går igjen i hvert rom: en rolle som hviler på en startfarge, leser *«Start-Paper står inn»*, og velgeren dens tilbyr **Velg…**; en startskrift bærer en **Start**-tagg og ingen toning; en start-hjørneradius er tagget på Oversikt. Arvet materiale tegnes aldri med en stiplet kant, for en stiplet kant betyr et slippmål her.

### Etter hvert som paletten vokser

Fargene dine ligger ved siden av en **In context**-forhåndsvisning på en bred skjerm og stables over den på mindre skjermer. Forhåndsvisningen kan vise en plakat, et diagram eller et grensesnittkort som bruker paletten din. Startfarger blir i sin egen sammenleggbare gruppe, atskilt fra farger du legger til.

Legg til enkeltfarger eller et sett med nyanser, tildel rollene deres, og åpne de avanserte avsnittene når du trenger dem. Fargediagrammet, gradientene og nedlastingskontrollene blir værende med paletten.

![Farger-rommet etter at én farge er lagt til, med paletten sin og en levende komposisjonsforhåndsvisning](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Roller - det verktøyene leser

**Roller** er laget over fargeprøvene: hvilken farge som spiller hver del i hvert verktøy og hver eksport. Roller er valgfrie (et designsystem med tre løse farger og ingen roller er fullt godtakbart), enhver fargeprøve kan ta en, og kontrastavlesningen måles mot flaten, APCA først.

En rad leses i ett av tre registre, så stripen aldri påstår et valg ingen har tatt:

- en egen farge som fyller rollen, i full styrke;
- **Start-*Paper* fyller inn** - dempet, med **Velg…** i velgeren sin;
- **↳ følger Primær** - rollen løses gjennom primærfargen i stedet for til en egen farge.

Så snart paletten har nyanser, vokser stripen til alle sju plassene et verktøy kan lese: Primær, Sekundær, Overflate, Tekst, Dempet, Kant og På primærfargen. På primærfargen avledes fra primærfargen, leses som **Avledet** og har ingen velger.

**Appens egen aksentfarge er en preferanse, ikke en token.** Som standard følger grensesnittet designsystemet, og chrome-aksenten tar primærfargen. Det er en Utseende-innstilling på [profilen din](/info/profile.html) - **Grensesnittet følger designsystemet** - og å slå den av lar chrome være nøytralt. Verktøy, arbeidsflater og eksporter påvirkes ikke uansett, og fontene og hjørneradiusen følger designsystemet enten innstillingen er på eller av.

### Ekspertfløyene

Fire sammenleggbare avsnitt ligger under komposisjonsforhåndsvisningen og fargerollene. Åpne det du vil; hvert av dem er dyplenkbart som `#/start?area=color&focus=<wing>`, som åpner det uansett hva rommet ellers viser:

- **Explore shades & harmonies** (`focus=generate`) - én farge til et helt sett med nyanser. Beskrevet under.
- **Nyansekurver** (`focus=curves`) - form om en rampe punkt for punkt. Lyshet, kroma og valør får hver sin kurve, byttes med L / C / H, og nyansene under bakes om live mens du drar.
- **Kontrast** (`focus=contrast`) - **Kontrastlås** tonar om en rampe for å treffe APCA-mål mot en bakgrunn du velger, hvert trinn beholder sin egen valør og kroma; **Drei valør** dreier hele rampen rundt hjulet, hver nyanse beholder lysheten og kromaen sin.
- **Print** (`focus=print`) - hva primærfargen blir i trykk: den automatiske skjermverdien, eller et fastsatt CMYK-bygg eller en navngitt spotfarge i stedet.

### Én farge, en hel palett

Inni **Explore shades & harmonies**, velg en **Startfarge**. Lolly foreslår matchende nyanser med den samme perseptuelle fargematematikken (OKLCH) motoren bruker andre steder. Finjuster forslagene:

- **Skjema** - Mono, Komplement, Analog eller Triade - bestemmer hvordan sekundærfargen forholder seg til primærfargen.
- **Nyanser** - en glidebryter fra 3 til 20 (standard 5) styrer hvor mange trinn hver rampe genererer.
- **Finjuster** (sammenslått) - **UI-intensitet** (Dempet / Dyp), **Kontrast** (Komfort / Høy) og **Tekst på merkevare** (Auto / Lys / Mørk).

Å endre startfargen og kontrollene endrer bare forslagene. Klikk på en nyanse for å legge til den fargen, eller **Add 5 shades** for å legge til en gruppe (antallet følger Nyanser-innstillingen din). Eksisterende farger og roller blir liggende. Angre fjerner tilføyelsen.

Radene **Primær**, **Neutral** og **Sekundær** viser de foreslåtte nyansene. Åpne **Theme preview** for å inspisere lyse og mørke eksempler og kontrastverdiene deres. Velg et Neutral- eller Sekundær-trinn der for å justere de foreslåtte temaankrene. Å bygge om hele paletten forblir en egen, gjennomgått handling under.

![Tre foreslåtte nyansegrupper, med individuelle legg-til-kontroller og en egen Theme preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Bygg paletten (harmonigenerator)

I **Find matching colours** foreslår harmonigeneratoren matchende aksentfarger ut fra primærfargen. Velg en **Harmoni** - **Komplementær**, **Tilstøtende**, **Triade**, **Tetrade** eller **Analog** (som har sitt eget **Aksenter**-antall, 2 til 5, og en valør-**Vinkel** fra 10° til 45°) - og hver kandidat kommer med et automatgenerert, lesbart navn og en **+ Add**-knapp. Å legge til én setter den fargen i paletten med én gang, ett trykk til én token. **In context** forhåndsviser de tilføyde fargene dine på eksempelkomposisjoner.

![Genererte aksenter, hver med en fargeprøve, et automatgenerert navn, heksfargekoden sin og en Add-knapp](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Å ta i bruk en generert palett

Å legge til en foreslått farge eller nyansegruppe beholder resten av paletten din. For en fullstendig utskifting, åpne **Rebuild the whole palette…** og trykk **Preview full rebuild**. Gjennomgangen forklarer endringene: hvor mange roller som blir som du tildelte dem, hvor mange farger du selv la til som beholdes, hvor mange nyansekurver som forankres på nytt, hvor mange trykklåser som festes på nytt, hvor mange skjulte nyanser som forblir skjult, hvor mange gradientstopp som beholder fargen sin.

**Apply rebuilt palette** på det kortet fullfører den; **Avbryt** går bort og endrer ingenting. Når den har kjørt, tilbyr kortet **Angre** med fokus allerede på den - og et kontrollpunkt av hele designsystemet tas *før* byttet, så «sett det tilbake slik det var» blir en gjenoppretting i stedet for en tapt ettermiddag.

### Paletten, diagrammet og hver fargeprøve

Paletten lister designsystemets farger i sammenleggbare grupper, hver med sin egen **+ Add**-kontroll. Opprett og gi grupper nytt navn for å organisere arbeidet ditt. En rolle lager aldri en ekstra flis: én token er én flis, og en flis en rolle peker på, bærer i stedet et lite hjørnemerke (**P**, **S**, **Su**, **T**). Under flisene slår **Fargediagram** opp to visninger av de samme fargeprøvene: **Hjul** (OKLCH-hjulet - dra en prikk for å omfarge den, klikk en prikk for å redigere den, eller klikk tomt rom for å slippe en ny fargeprøve) og **Fargeomfang**-diagrammet, som viser hvor det viselige området faktisk slutter. `#/start?area=color&focus=chart` åpner kortet direkte, slik `?wheel` alltid har gjort.

![Palettpanelet, hver gruppe sammenleggbar, med nedlastingspillen parkert langs nedre kant](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![OKLCH-hjulet - vinkelen er valør, avstanden ut er kroma, og gråtonene følger en lyshetsskinne nedover siden](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Klikk på en fargeprøve for å åpne redigeringsverktøyet:

- **Gi den nytt navn**.
- **Sett fargen** - velgeren åpnes med perseptuelle **OKLCH**-glidebrytere, med moduser for **Hex**, **HSL**, **RGB** og **CMYK**; verdifeltet leser *og* skriver i det aktive fargerommet, så du kan lime inn en hex-verdi eller skrive inn blekkprosenter. Merk at å angi CMYK setter *skjerm*fargen ved konvertering - for å feste eksakte blekk, bruk trykklåsen nedenfor.
- **Lagres som** - velg hvordan fargeprøven lagres: **LCH** (standard - perseptuell, vidt fargerom, det beste valget for redigering), Hex, RGB eller HSL. Overstyr dette når du trenger å feste en eksakt eldre hex-verdi eller matche en sRGB-verdi.
- **Bruk som** - gi denne fargeprøven en av merkevarens roller direkte, uten å gå tilbake til Roller-panelet. (En rolles eget kort tilbyr det ikke - en rolle kan ikke ta en rolle.)
- **Trykksubstitutter** (foldet) - lås fargens trykkoppførsel:
  - **CMYK** - bytt fra **Auto** til **Låst** for å overstyre den automatiske sRGB→CMYK-konverteringen med eksakte blekkverdier (C/M/Y/K, 0-100).
  - **Flerfarge (spot)** - bytt fra **Ingen** til **Angitt** for å låse fargeprøven til en spotfarge; gi den et **Navn** (f.eks. `PANTONE 186 C`), en valgfri **Bok** og en valgfri **Finish** (Vanlig blekk som standard) for når blekket ikke er blekk i det hele tatt - en folie, en preging opphøyd eller nedsenket, en spotlakk, en myk overflate eller et stansesnitt, en falselinje eller perforering.
- **I andre fargerom** (foldet) - samme idé utvidet: hver rad er et fargerom denne fargeprøven kan uttrykkes i, enten avledet fra den kanoniske verdien eller angitt av deg, og en angitt verdi vinner ved eksport.

Disse trykklåsene er det et trykkeri bruker når du eksporterer en CMYK-PDF eller -TIFF - se [Eksportering](/info/exporting.html#colour-profiles).

**Å slette en fargeprøve** er trygt: avledede trinn i fargeskalaen og temaroller blir *skjult* (det underliggende tokenet fortsetter å løses opp, så ingenting lenger nede går i stykker), mens farger du selv har lagt til fjernes helt.

### Å jobbe med mange fargeprøver

Hver fargeprøve har et eget draghåndtak. Dra det for å endre rekkefølgen på farger innenfor gruppen, eller fokuser det, trykk Mellomrom, bruk piltastene, og trykk Mellomrom igjen for å slippe. Escape avbryter. Rekkefølgen overlever at studioet åpnes på nytt, og kan angres. For å flytte farger mellom grupper, bruk fargeprøve-redigeringens **Group**-kontroll, eller merk flere farger og bruk **Flytt**. Tokennavn og rollereferanser forblir intakte.

Utvalg i palettpanelet er en bevegelse, ikke en modus. Det finnes ingen knapp å trykke på først, og linjen dukker opp med den første merkede flisen og forsvinner med den siste.

- **Dra på panelets tomme flate** for å tegne et rektangel: hver flis det berører, blir med i utvalget, på tvers av gruppegrenser. Et sammenslått avsnitt bidrar med ingenting, og en dragning som aldri beveger seg, tømmer utvalget.
- **Shift-klikk** tar området i leserekkefølge; **Cmd/Ctrl-klikk** slår av og på én flis; et vanlig klikk åpner fortsatt den flisens redigering.
- Hver gruppeoverskrift bærer **Velg alle**, og **Cmd-A** med en flis i fokus tar hver farge designsystemet eier - aldri en startfarge.
- Rutenettet har ett tabbstopp. Piler beveger seg gjennom det, Shift-piler utvider utvalget, Mellomrom slår av og på en flis, Delete fjerner utvalget, og Escape tømmer det. (Piler flytter bare fokus: for å dytte en kanal, trykk `l`, `c` eller `h` først, slik avlesningen sier.)
- På en berøringsskjerm finnes det ikke noe rektangel. Trykk og hold en flis for å starte et utvalg, trykk så for å legge til; **Velg alle** per gruppe tar resten.

Selve linjen leser **{n} selected**, deretter **Flytt til** (en eksisterende gruppe, eller en ny du gir navn i menyen), **Gi en rolle** (hver merkede farge tar neste rolle etter tur, så fire fliser fyller alle fire rollene i ett trykk), **Last ned** (utvalget i hvilket som helst av de seks palettformatene), **Kopier verdier** (én linje per farge i sin lagrede notasjon) og **Slett**. Flytt til og Gi en rolle dukker opp så snart paletten har nyanser å flytte rundt på. Én Ctrl/Cmd-Z angrer en hel masseoperasjon - en flytting av førti, en rollerunde, en sletting - og en sletting sier hva den beholdt, fordi et utvalg når fliser dette rommet ikke fjerner.

### Gradienter

Et valgfritt **Gradienter**-panel bygger blandingstokens fra paletten for bakgrunner og aksenter. Hopp helt over det hvis designsystemet ikke bruker gradienter. Hver gradient har en forhåndsvisning, navngitte stopp (2–8) og en vinkel. Nøkkelatferden: **et stopp refererer til en fargeprøve**, så omfarg den fargeprøven, og gradienten følger med. Interpoleringen kjører i OKLCH for rene overganger. Slett et stopp for å korte ned forløpet.

### Ta paletten med deg

Den flytende pillen parkert langs nedre kant av palettpanelet laster ned hele paletten som **Designtokens (JSON)**, **CSS-variabler**, **CSS-klasser**, **SCSS-variabler**, en **GIMP-palett (.gpl)** eller en **Adobe Swatch Exchange (.ase)** - slik at designsystemet går rett inn i Illustrator, Figma, GIMP eller et stilark. Den sitter utenfor panelets rullefelt, så den beholder plassen sin uansett hvor langt paletten rulles, og den dukker opp så snart paletten har nyanser. (Du kan også laste ned paletten fra [Ressurser](/info/using.html#assets-your-library).)

## Skrift

Dette rommet vokser på samme måte. Uten en egen skrift er det ett kort og ett valg: **Primary**, satt i lesestørrelse i skriften som betjener det i dag, en **Start**-tagg ved siden av navnet, en fylt **Velg en skrifttype** og linjen *«Ingenting installeres før du velger en.»* Under kortet ligger *«Overskrifter, kode og kursiv følger primærfargen til du velger dem»*, med **Choose them separately** som avdekker de tre andre kortene for resten av besøket.

![Typografi-rommet med ingen skrift valgt ennå - ett kort i lesestørrelse, en Start-tagg på det og en fylt Velg en skrifttype](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Velg én skrift, så åpner rommet seg til **fire rollekort**, Fonts-listen og det levende eksemplet. De fire skriftene er de appen, verktøyene og hver eksport faktisk leser:

- **Primær** - brødtekst, knapper og alle verktøy.
- **Overskrifter** - visningsskriften for `h1`/`h2`.
- **Kode** - en fastbreddeskrift for kode og data.
- **Kursiv** - en ekte kursiv følgesvenn for uthevelse, sitater og sidebemerkninger.

Overskrifter, kode og kursiv faller alle tilbake på primærfargen til du tildeler dem, så et designsystem med én skrift trenger ingen valg her i det hele tatt.

**En toning betyr at du valgte den.** Et kort er tonet bare der du installerte den skriften. En startskrift bærer den samme **Start**-taggen som palettens arvede grupper bærer, i det dempede registeret og uten toning, og en rolle ingen har valgt, leser **↳ follows Primary** i stedet for å gjenta primærfargens navn som om den var valgt. Knappen sier **Endre** på en egen skrift og **Velg en skrifttype** ellers overalt. Ingenting på et kort forplikter noe: knappen åpner **sammenligningsflaten** avgrenset til den rollen.

![De fire rollekortene avdekket - hvert satt i skriften som betjener det, med en Start-tagg der ingen har valgt en, og Italic som følger primærfargen](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Sammenligningsstadiet

![Sammenligningsflaten åpen under kortet sitt, med søkeraden, de festede familiene og kortene sammenslått til en enlinjes stripe](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

Flaten åpnes **innebygd i rommet**, ikke i en dialog, og rett under kortet du trykte på. Mens den er oppe, slås kortene sammen til en enlinjes stripe med rolle og skrift, slik at flaten er på første skjerm selv på en telefon. Escape avbryter og gir tastaturet tilbake til kortet du åpnet den fra.

Å velge en skrift er tre trykk:

1. **Choose a face** på kortet.
2. Skriv et familienavn og trykk **Forhåndsvisning** - eller trykk på en av de seks **Festet**-familiene under feltet, ett trykk hver. Kortet vises allerede under lasting, med en skjelettlinje der eksemplet vil være, i stedet for at grensesnittskriften står inn for en skrift du ikke har sett ennå.
3. **Bruk denne snittet**.

**Samtykke spørres én gang, ved trykket du gjorde.** Første gang en forhåndsvisning når Google Fonts, sier en dialog hva som skjer: *Google lærer familienavnet og IP-adressen din. Filen holdes deretter på denne enheten og brukes offline. Dette er det ene trinnet i studioet som når en tredjepart.* **Hent fra Google** går videre og huskes. **Avbryt** lar kortet stå med *«Ikke hentet. Ingenting ble sendt til Google.»* med sin egen levende **Hent fra Google**, så å ombestemme seg er ett trykk på selve kortet. Ingen kort viser noensinne en død knapp: uansett hvilken tilstand det er i, sier den ene primærknappen dens hva neste steg er.

**Slipp en skriftfil på flaten**, så forhåndsvises den med én gang - **TTF**, **OTF** eller **WOFF** fra din egen maskin, som er veien for en lisensiert bedriftsskrift du allerede eier. Den slippsonen er den eneste fildøren i rommet.

Uansett vei blir skriften på denne enheten, rendres i appen, i verktøyene og i hver eksport, offline for alltid, og følger med i designsystemfilen - ingenting hentes ved rendring. Alt på Google Fonts leveres under en åpen lisens (OFL/Apache/UFL).

### Skrifter på denne enheten

Panelet **Fonts** lister hver skrift denne enheten har, og rollen den betjener. Skrifter du har lagt til, ligger øverst under **In the design system**, hver med rollene sine og en slett, og den som betjener Primary bærer merket. Startskriftene følger i én sammenslått rad - *Start · SUSE, SUSE Mono · betjener Primary og Code til du velger* - dempet, uten slett og ingenting å forfremme, fordi ingen av delene er et valg noen har tatt. **Legg til en skrift** åpner den samme sammenligningsflaten uten avgrensning.

Panelet **Type roles** nederst viser et levende eksempel på hver rolle - brødtekst og UI i primærfargen, en valgfri display-skrift for de øverste overskriftene, en kursiv for utheving, en mono for kode og data - med familien og tilstanden dens ved siden av hver (*Inter*, *SUSE · starter*, *SUSE · follows Primary*), slik at hele settet kan leses på én gang.

## Tokens

Resten av designsystemet, redigerbart uten å røre kode:

![Tokens-rommet - en glidebryter for hjørneradius pluss spacing, sizing, shadows og resten av systemet](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Runde hjørner** - én enkelt radiusglidebryter (0–1,5rem) som kort, knapper og paneler i hele appen følger.
- **Neutrals** - blekk-gjennom-papir-rampen en ny installasjon leveres med, listet som **Neutrals · starter · 9** med sine ni trinn og en **Åpne** inn i Farger-panelet. Det er det ene stedet startnøytralene forvaltes, og *starter*-taggen forsvinner i det øyeblikket rampen genereres i stedet for arves.
- **Flere token** - legg til og rediger **spacing**, **sizing**, **stroke width**, **opacity**, **rotation**, vanlige **numbers** og **shadows**. Velg en type, gi den navn (*Gutter, Card shadow…*) og angi verdien. Disse lagres som vanlige [designtokens](/info/design-tokens.html) (DTCG) og følger med designsystemet.

## Filer

Slipp filene merkevaren din har - bortsett fra logoer - her: **vektor-**, **bilde-**, **lyd-** og **bevegelses**-ressurser (video, Lottie, animert). De havner i [Ressurser](/info/using.html#assets-your-library), sortert i seksjoner og klare i hvert verktøys ressursvelger. Alt blir på denne enheten. (Raden merker rommet **Filer**; URL-nøkkelen forblir `catalogue`, fordi en panelnøkkel er en permanent kontrakt.)

## Ta inn en merkevare

**Legg til fra…** nederst i menyen åpner en velger i to trinn. Det første trinnet spør hva du *har*, ikke hvilket format det er:

- **Designtokens eller en designfil** - DTCG- eller Tokens Studio-JSON, et Penpot-prosjekt, en **zip med tokensett**, en Lolly-designsystempakke eller en SVG.
- **PDF** - et sett eller en retningslinjefil, lest på denne enheten for fargene, merkene og de innebygde skriftene.
- **Logo eller skjermbilde** - et bilde blir en foreslått palett, lest på denne enheten. Ingenting lastes opp. Dette leser farger, ikke skriften eller layouten i bildet.
- **Lagret nettside** - velg én HTML-fil og CSS-filene dens, eller lim inn HTML eller CSS. Opptil 20 filer og 2 MB totalt. Bare den oppgitte teksten leses; lenkede ressurser hentes ikke, og skript kjøres ikke. Denne veien fungerer også uten utvidelsen eller skrivebordsappen.
- **Skriftfil** - TTF, OTF eller WOFF. Åpner Typografi-rommet, der skriften installeres.
- **Nettsted** - én side, lest for fargene og typografien. Denne flisen vises bare på en enhet som faktisk kan lese en side, fordi en deaktivert flis som annonserer noe ingen kan trykke på, er verre enn ingen flis i det hele tatt. Der den vises, sier den tydelig hvilken leser som brukes: hentet av appen på denne enheten, eller lest gjennom nettleserutvidelsen i en bakgrunnsfane, innlogget som deg. Å oppgi en URL bare *forhåndsutfyller* feltet - hente-knappen er samtykket, så en lenke noen sender deg, kan aldri starte en lesing.

Velg designfil-kilden, og andre trinn er kortet nedenfor: de aksepterte formatene ledes an som ikonfliser i foretrukket rekkefølge, og hele kortet er ett sleppmål - klikk hvor som helst på det, eller dra en fil på det. Du kan også slippe en fil rett på studioet.

![Importkortet - de aksepterte formatene ledes an som ikonfliser, og hele kortet er ett sleppmål](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

Hva hver designfil gir deg:

- en **Lolly-designsystempakke** (`.lolly`; eldre `.zip` godtas fortsatt) - installeres i ett trinn;
- en **Penpot**-eksport (`.penpot`) - henter inn designtokens sine;
- en **Design Tokens**-fil (`.json`) - W3C DTCG;
- en **Tokens Studio**-fil (`.json`) - Tokens Studio;
- en **ren SVG** (`.svg`) - Lolly skanner fargene dens og lar deg velge hvilke som skal beholdes, den første blir primærfargen din.

En logo/et skjermbilde, nettsted eller lagret side åpner **Your suggested design system**. Se et eksempel med de foreslåtte fargene, velg en annen **Main colour** om nødvendig, og gi systemet navn. **Use this design system** tar i bruk de genererte lyse og mørke palettene og går tilbake til Oversikt. Eksisterende skrifter blir som de er. Dette erstatter fargene og andre tokeninnstillinger til det aktive systemet. Et kontrollpunkt må lykkes først; **Restore brand settings** gjenoppretter de tidligere innstillingene.

**Source details and individual choices** viser hva som ble lest, oppdagede skriftnavn og forhåndsvisningens tekst-/handlingskontrast. Den tilbyr også **Choose individual items in the tray** og **Download design context**. JSON-rapporten bærer observasjoner, foreslåtte tokens og kildeinformasjon; lagret HTML/CSS inkluderer en SHA-256 av den oppgitte teksten. Den inneholder ingen rå sidetekst og er ikke en signert Content Credential. Skriftnavn er forslag: Typografi forblir stedet for å velge og installere skrifter.

PDF- og andre designfilimporter beholder sine eksisterende gjennomgangskontroller. Elementer lagret i **Skuff** endrer ingenting før de legges til gjennom rommet som eier den typen materiale.

`#/start?source=<kind>` åpner velgeren på en gitt kilde (`file`, `pdf`, `image`, `font`, `url`, `page`), og `?import` åpner den på den vanlige listen.

## Flytt en merkevare mellom enheter

**Eksporter** nederst på raden skriver én enkelt **`LollyBrand-….lolly`** - tokensene, skriftene, logoene og temapreferansen din, med et integritetsmanifest den verifiserer på veien tilbake inn. Nettversjoner før 1.0.7 kalte den samme nyttelasten `.zip`; den eldre stavemåten godtas fortsatt. Ved siden av, **Tokens (.json)** skriver det rene design-tokens-dokumentet for seg selv: ingen skrifter, ingen logoer, bare tokens, som er det et repo, et CI-trinn eller et annet tokens-verktøy faktisk leser.

Å ta en tilbake inn er **Legg til fra… → Designtokens eller en designfil** (over), eller dra-og-slipp på studioet. Slik gir en kollega deg en merkevare, eller slik tar du en med til en annen installasjon - ingen konto, ingen sky. For å ta inn en merkevare fra kommandolinjen i stedet, se [`ingest:brand`](/info/configuration.html#brand-packs).

## Gjenopprett tidligere innstillinger

Velg **Restore brand settings** nederst på raden, velg et datert kontrollpunkt, og trykk deretter **Gjenopprett**. Det gjenoppretter farger, skriftinnstillinger og andre merkevaretokens for den aktive merkevaren. Skrift- og bildefiler blir som de er.

Lolly lagrer de gjeldende innstillingene dine som **Before restore** før kontrollpunktet tas i bruk. Velg det kontrollpunktet for å reversere gjenopprettingen, også etter at nettleseren er lukket og åpnet igjen. De siste 20 kontrollpunktene beholdes på denne enheten. Hvis lagringen ikke kan leses eller de gjeldende innstillingene ikke kan lagres, rapporterer dialogen problemet slik at du kan prøve igjen.

## Versjoner

**Versjoner** nederst på skinnen er der et designsystem slutter å være et bevegelig mål. Publiser én, og du får en **permanent, navngitt kopi** oppbevart på denne enheten: den endres aldri etterpå, så et verktøy som fester seg til den, fortsetter å tegne det samme. Panelet forblir skjult til det finnes noe eget å publisere, slik at et studio som aldri publiserer, aldri ser kontrollene.

Tre ting å vite før du trykker på noe, og panelet sier alle tre før trykket i stedet for etterpå:

- **En versjon er permanent.** Det finnes ingen slettefunksjon ennå, så panelet forteller hva som er beholdt og at det forblir beholdt, i stedet for å tilby en knapp som lyver.
- **Fjerninger leder kompatibilitetskortet.** Lagt til og endrede tokens er nyheter; en *fjernet* en er det som ødelegger et verktøy, så den nevnes først og kalles det den er.
- **Publisering kan ikke angres; gjenoppretting kan.** *Gjenopprett nyeste fra denne versjonen* er en ordinær redigering av hodet, så den havner på studioets angre-stabel, og panelet tilbyr deg **Angre** med det samme.

Du kan **Bare publisere**, eller **Publiser og gjør aktiv** - forskjellen er om verktøyene og appen følger den versjonen fra nå av eller fortsetter å følge din siste redigering. **Følg det siste igjen** setter hver redigering live i det den gjøres. `#/start?area=versions` åpner panelet direkte.

## Når merkevaren er fast

Enkelte bygg leveres med et **låst designsystem**, som SUSE Brand. Å åpne det viser en skrivebeskyttet merknad med **Make an editable copy** og **Switch**. De opprinnelige fargene, skriftene og tokensene dets forblir intakte. Dine egne lokale systemer forblir redigerbare, selv når det låste systemet var det første på enheten. I Profile velger **Åpne** et system og åpner studioet dets; **Make a new one** lager et lokalt system og åpner det på `#/start` med navnefeltet i fokus.

## Hvor du går videre

- **[Bruke Lolly](/info/using.html)** - lerretet, lagring, prosjekter og Ressurser.
- **[Designtokens](/info/design-tokens.html)** - tokenmodellen merkevaren din uttrykkes i.
- **[Eksport og formater](/info/exporting.html)** - trykkeenheter, CMYK og formatene merkevaren din gjengis til.


## Finn og sammenlign en stil

Åpne **Find a look** fra Oversikt eller listen over designsystemer på Profile. Bla gjennom systemer lagret på denne enheten og noen gjenbrukbare Lolly-eksempler. Søk etter navn, fargetagg eller angitt skrift. **Closest to my current palette** sorterer etter målt fargelikhet, med matchende skriftfamilier som avgjør uavgjort; det er ingen kvalitetsvurdering.

Velg én stil for å gjennomgå den, eller to for å sammenligne. Gjennomgangsknappen forblir tilgjengelig på en liten skjerm. Å velge en stil endrer ingenting. **Use this saved system** bytter gjennom det eksisterende designsystemregisteret. **Use these colours** tar i bruk et eksempel gjennom den vanlige kontrollpunkt- og installasjonsflyten, og beholder de gjeldende skriftene. **Restore brand settings** kan gjenopprette den forrige stilen.

Under **Details and design context** har lagrede systemer redigerbare **Search tags** og en konteksnedlasting. Eksemplene bruker Lollys egne fargeoppskrifter; det finnes ingen eksternt skrapet inspirasjonssamling eller noe krav om konto.

![Sammenlign Sunroom og Orchard side om side før du tar i bruk noen av fargesystemene.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

Sammenligningen holder begge palettene synlige sammen. Å gjennomgå en stil endrer ingenting før du velger **Use these colours** eller **Use this saved system**.

## Les kildebevis

Kildegjennomgangens valgfrie detaljer viser typografi, mellomrom, polstring og hjørneverdier der de er observert. Lagret HTML/CSS og native nettstedslesinger rapporterer deklarasjoner, som kanskje ikke brukes av den rendrede siden. Nettleserutvidelsen kan rapportere målte stiler fra et avgrenset utvalg av synlige elementer, med visningsvinduet og nettleserens fargepreferanse. Eldre utvidelser fungerer fortsatt med deklarerte stiler. Manglende felt sier **Not observed**.

Dette er observasjoner, ikke automatiske stilinnstillinger. Skriftfiler hentes eller installeres ikke av et referansesøk, og kildens mellomrom erstatter aldri dine egne i stillhet. Antallene beskriver forekomster i utvalget, ikke pålitelighet eller kvalitet.

## Kontroller en komposisjon mot designsystemet

I Design, åpne **Eksporter**, deretter **Before you export**. Kontrollen bruker den samme effektive designsystemversjonen som gjengivelsen. Den sammenligner angitte farger, tokenalias, skriftvalg og bilderessurs-ID-er. Egendefinerte verdier kan være tilsiktet; et bilde utenfor de angitte merkevareressursene er et gjennomgangspunkt, ikke et forbudt bilde.

Der et konkret farge- eller skriftforslag er tilgjengelig, endrer knappen bare det ene laget. Vanlig **Angre** gjenoppretter den opprinnelige verdien. Låste eller endrede lag overskrives ikke av et gammelt forslag. Manglende kildebevis holdes atskilt fra et treff. Rendret kontrast og tekstlayout kontrolleres av de eksisterende innebygde kontrollene. Gradienter, effekter, innebygd verktøyinnhold, rettigheter og subjektiv kvalitet vurderes ikke av merkevaresammenligningen. Kontrollene blokkerer ikke Last ned.

## Bruk designkontekst lokalt

**Download design context** inkluderer tokendokumentet, oppløste farger, angitte skriftfamilier, ressurs-ID-er, kildebevis der registrert, dekning og eksplisitte regler. Den inkluderer ikke skriftfiler eller eierskapsbevis. Referansegjennomgangen inkluderer også sine foreslåtte tokens og observasjoner.

CLI-et kan lese begge nedlastingene uten en server:

```bash
lolly system import ./lolly-design-context.json
lolly system context --output=design-context.json
lolly system check ./design-inputs.json --file=design-context.json
```

`system check` godtar Design-inndata med et `boxes`-array eller et kompilert Design-dokument. Den rapporterer foreslåtte fikser uten å endre komposisjonen. Den kan ikke måle nettleserlayout eller rendret kontrast. Den eksisterende MCP-ressursen **lolly://design-context** eksponerer det effektive systemets kontekst gjennom den konfigurerte lokale MCP-prosessen; ingen ny vertstjeneste eller API-nøkkel trengs.
