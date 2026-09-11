# Brand Studio

**Brand Studio** på `#/start` er det ene stedet du former merkevaren din - logoene, fargene, typografien, resten av tokenene og filene den holder på. Sett det opp her én gang, så følger hvert verktøy, hver side og hver eksport det *ved konstruksjon*, ikke ved gjennomgang.

Endringer forhåndsvises **live i hele appen** mens du gjør dem, slik at du kan se en farge eller en font slå inn overalt før du bekrefter den. Alt skjer på enheten: merkevarefilene og tokenene dine forlater aldri maskinen din (å velge en Google-font henter den ene familien fra Google, én gang, etter en samtykkedialog), og merkevaren reiser i én enkelt [merkevarepakke](#move-a-brand-between-devices)-fil.

> **Dette er redigeringsverktøyet. Dashbordet er speilet.** Fanen **Designsystem** på dashbordet (`#/d`) *viser* merkevaren din skrivebeskyttet; du *redigerer* den her på `#/start`. Vil du endre en farge senere, kom tilbake til Brand Studio.

## Rommene

Studioet er et sett med **rom** listet i en skinne nedover siden - ikke trinn. Ingenting er nummerert, ingenting er sperret av noe annet, og å komme til hvilket som helst av dem er like legitimt:

- **Oversikt** - navet. Hva som finnes akkurat nå, med ett blikk, med en dør inn til hvert rom.
- **Farger** - legg til farger én om gangen, tildel roller eller generer en hel palett fra én.
- **Type** - de fire skriftsnittene appen, verktøyene dine og alle eksporter leser.
- **Logoer** - merkene dine, i hver orientering og behandling.
- **Tokens** - hjørneradius, avstand, skygger og resten av systemet.
- **Filer** - bilde-, lyd- og bevegelsesfilene merkevaren din holder på.

På en telefon blir den samme listen en horisontal chip-stripe festet under toppteksten. Å bytte rom laster aldri noe på nytt - redigeringsverktøyet holder alle panelene sine montert og viser rett og slett bare det du ba om.

**Dyplenk til et rom** med `#/start?area=<key>`. Nøklene er `overview`, `color` *(merk den amerikanske stavemåten i URL-en)*, `type`, `logos`, `tokens`, `catalogue` (rommet Filer - panelnøkkelen er en permanent kontrakt, så URL-en beholder det gamle navnet) og `versions`. `?tab=` er det etablerte aliaset for det samme og løses fortsatt opp, så gamle lenker og bokmerker fortsetter å virke; alt ukjent åpner Oversikt i stedet for å ende blindt.

Festet til **bunnen av skinnen** er handlingene som hører til hele designsystemet, ikke ett rom:

- **Legg til fra …** - kildevelgeren, for å hente en merkevare inn fra en fil, en PDF, et bilde, en font eller et nettsted. Se [Hente en merkevare inn](#bring-a-brand-in) under.
- **Skuff** - kandidatene en skanning fant, men ikke har forpliktet. Den forblir skjult til en skanning faktisk beholder noe, og viser et antall når den gjør det; ingenting i den endrer merkevaren din før du trykker Legg til på den raden.
- **Eksporter** - skriver hele merkevaren som én `LollyBrand-…zip`.
- **Tokens (.json)** - selve tokens-dokumentet alene, for et repo, et byggetrinn eller et annet tokens-verktøy.
- **Versjoner** - publiser, aktiver og gjenopprett navngitte kopier av designsystemet. Skjult til det finnes noe eget å publisere (eller en `?area=versions`-lenke ber om det ved navn).

![Skinnen med studiorom - Oversikt, Farger, Type, Logoer, Tokens og Filer](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Oversikt

Oversikt er rommet du lander i, og det har to sider.

Med **ingenting satt opp ennå** tilbyr det to dører - **Start fra en fil** (designtokens, et Penpot-prosjekt, en designsystempakke eller en SVG) og **Start fra bunnen** (legg til én farge, fortsett så videre når du vil) - og en stille utgang **Utforsk verktøyene** under dem, fordi det å forlate også er et legitimt svar.

Når et designsystem finnes, viser det samme rommet **hva du har**: paletten og fargeantallet dens, skriftfamiliene i bruk, hvor mange logoplasser som er fylt, hvor mange tokens det er og rommet Filer. Hver blokk er en dør inn til rommet sitt. Det er antall her, aldri en fremdriftslinje og aldri et sluttkort - ingenting i dette studioet skyldes deg.

## Logoer

Start med å tømme mappen din av merker inn i slippsonen øverst: **«Slipp merker her, eller velg flere samtidig»** tar imot så mange filer du har, i én omgang. Hver fil leses for form og farge, og settes deretter i kø under **Venter på plass** som en chip som sier hva den tror - *«Ser ut som Horisontal primær»*, med målet den bygger på, og en **Plasser**-knapp (**Erstatt**, der plassen allerede er fylt). Der den ikke er sikker sier chipen det tydelig og tilbyr **Bytt plass** i stedet, som lister alle åtte. Ingenting plasseres før du trykker på noe.

To ting skjer rundt den køen. Et merke med overflødig tom marg får et **beskjæringstilbud** først - svar på det eller trykk Escape, så går originalfilen inn urørt. Og der et merke kan fylle en tom søsterplass, tilbyr rommet den avledede **mono**- eller **omvendt**-versjonen som sin egen chip, merket *Generert*, som forsvinner igjen hvis du fyller den plassen på en annen måte.

Under det ligger rutenettet hvert merke ender opp i - **orientering × behandling**-plasser:

- **Orienteringer:** Horisontal (ordmerke + symbol på rad) og Vertikal (stablet, for kvadratiske og høye rom).
- **Behandlinger:** Primær, Primær omvendt (for mørke bakgrunner), Mono (én farge) og Mono omvendt.

Det er åtte valgfrie plasser. Klikk en plass for å legge til en PNG, SVG, JPEG eller WebP; klikk en fylt plass for å erstatte den. Hver plass er valgfri, og alt forblir på denne enheten.

![Logomatrisen - hver orientering på tvers øverst, hver behandling som sin egen stiplede plass, alle valgfrie](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Egendefinerte merker** - legg til merker merkevaren din navngir på sin egen måte (et ikon, et emblem, en favicon) under **Egendefinerte merker**; gi det navn og velg en fil.
- **Flere identiteter** - en undermerkevare, et produkt eller et arrangement kan ha sitt eget fulle sett med logoer. Bruk **+ Legg til en logo til** og gi det navn; hovedsettet ditt heter rett og slett «Din logo».
- **Last opp en SVG, og Lolly leser fargene dens.** På en helt ny installasjon setter den stille primærfargen din fra logoen og sier fra om det. På en eksisterende merkevare tilbyr den fargen som forslag i stedet - *«Funnet i logoen: #…»* med en **Bruk som primær**-knapp ved siden av - inne i rommet Farger, der du kan ta den eller avvise den.

## Farger

![The Colours room after one colour - the two panes back, the generate offer, roles reading in three registers and the pane at one colour](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

Det rikeste rommet, i to felt. Venstre er der du jobber; høyre er din **live palett**. Dra skillelinjen mellom dem for å endre størrelse (Enter på den slår sammen paletten av veien).

![Rommet Farger - en primærfarge avleder skalaer, prøvekort med kontrastforhold og en live palett](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Legg til en farge, gi den så en jobb

**Legg til en farge** er hele den enkle veien: lim inn eller velg en farge i hvilken som helst notasjon, og den blir nøyaktig ett token. Ingenting avledes fra den, ingenting foreslås inn i den, ingenting annet kreves. Lim inn en hel *liste* med farger, og hver blir en chip du kan legge til for seg.

**Roller** er laget over toppen - hvilken farge som spiller hvilken del. Roller er valgfrie (et designsystem med tre løse farger og ingen roller er et helt godt et), enhver fargeprøve kan ta én, og kontrastavlesningen måles mot underlaget, APCA først.

### Ekspertfløyene

Fire sammenfoldede seksjoner ligger under de to. Åpne den du vil ha; hver er dyplenkbar som `#/start?area=color&focus=<wing>`:

- **Generer en startpalett** (`focus=generate`) - én farge til et helt sett med nyanser. Beskrevet under.
- **Nyansekurver** (`focus=curves`) - omform en skala punkt for punkt. Lyshet, kroma og fargetone får hver sin kurve, byttet med L / C / H, og nyansene under bakes på nytt live mens du drar.
- **Kontrast** (`focus=contrast`) - **Kontrastlås** retonerer en skala for å treffe APCA-mål mot en bakgrunn du velger, hvert trinn beholder sin egen fargetone og kroma; **Roter fargetone** dreier hele skalaen samlet rundt hjulet, hver nyanse beholder sin lyshet og kroma.
- **Trykk** (`focus=print`) - hva primærfargen blir på trykk: dens automatiske skjermverdi, eller en fastsatt CMYK-oppbygging eller en navngitt spotfarge i stedet.

### Én farge, en hel palett

Inne i **Generer en startpalett** velger du en **Primærfarge**, og Lolly regner ut en komplett palett - lyse og mørke flater, tekst, aksenter og fulle tone-/skyggeskalaer - ved hjelp av den samme perseptuelle fargematematikken (OKLCH) motoren bruker overalt. Juster avledningen:

- **Skjema** - Mono, Komplement, Analog eller Triade - bestemmer hvordan sekundærfargen forholder seg til primærfargen din.
- **Nyanser** - en glidebryter fra 3 til 20 (standard 5) styrer hvor mange trinn hver skala genererer.
- **Finjuster** (foldet) - **UI-intensitet** (Dempet / Dyp), **Kontrast** (Komfort / Høy) og **Tekst på merkevare** (Auto / Lys / Mørk).

Ingenting i denne fløyen skriver noe til merkevaren din. Det er en forhåndsvisning, live i hele appen slik at du kan vurdere den, helt til du trykker **Erstatt palett** (under).

Under primærfargen ser du live **Primær-/Nøytral-/Sekundær-/Blande**-skalaer og prøvekort for Lys og Mørk, hver med sin egen kontrastavlesning - WCAG-forholdet med APCA-tallet `Lc` ved siden av. **Klikk et trinn i Nøytral- eller Sekundær-skalaen** for å forankre den nyansen i stedet for den avledede standarden.

![De fire trinnene stablet over lyse og mørke prøvekort, hvert kort med sin egen WCAG-kontrastverdi](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Bygg paletten din (harmonigenerator)

Fortsatt i samme fløy genererer **Bygg paletten din** matchende aksentfarger fra primærfargen din. Velg en **Harmoni** - **Komplementær**, **Tilstøtende**, **Triade**, **Tetrade** eller **Analog** (som har sin egen **Aksenter**-telling, 2 til 5, og en nyanse-**Vinkel** fra 10° til 45°) - og hver kandidat kommer med et automatisk generert, lesbart navn og en **+ Legg til**-knapp. Å legge til en setter fargen rett inn i paletten din, ett trykk til ett token. *«Paletten din, i bruk»* forhåndsviser hele settet på ekte grafikk.

![Genererte aksenter, hver med en fargeprøve, et automatisk generert navn, sin hex-verdi og en Legg til-knapp](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Å ta i bruk en generert palett

**Erstatt palett** er den eneste kontrollen i denne fløyen som skriver noe, og den skriver aldri med en gang. Trykk på den, og et gjennomgangskort åpnes først, med overskriften «Erstatte paletten?», som lister opp nøyaktig hva som er i ferd med å skje: hvor mange roller beholdes slik du satte dem, hvor mange farger du selv har lagt til beholdes, hvor mange nyansekurver forankres på nytt, hvor mange trykklåser festes på nytt, hvor mange skjulte nyanser forblir skjult, hvor mange gradientstopp beholder fargen sin.

**Erstatt palett** på det kortet tar det i bruk; **Avbryt** går bort og endrer ingenting. Når det er kjørt, blir kortet til «Palett erstattet.» med en **Angre**-knapp som allerede har fokus - og et sjekkpunkt av hele designsystemet tas *før* byttet, slik at «sett det tilbake slik det var» blir en gjenoppretting i stedet for en tapt ettermiddag.

### Paletten, diagrammet og hver fargeprøve

Panelet til høyre lister opp hver farge merkevaren din har, gruppert (Primær, Nøytral, Sekundær, Spektrum, Egendefinert, Roller), og hver gruppe kan foldes sammen med sin egen **+ Legg til**. Under det folder **Fargediagram** seg ut til to visninger av de samme fargeprøvene: **Hjulet** (OKLCH-hjulet - dra en prikk for å fargelegge den om, klikk en prikk for å redigere den, eller klikk på tomt område for å slippe en ny fargeprøve) og **Fargeromskartet**, som viser hvor det visbare området faktisk slutter. `#/start?area=color&focus=chart` åpner kortet direkte, slik `?wheel` alltid har gjort.

![Palettpanelet, hver gruppe kan foldes sammen, med nedlastingspillen plassert nederst](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![OKLCH-hjulet - vinkel er nyanse, avstand ut er metning, og gråtonene følger en lyshetsskinne nedover siden](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

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

### Gradienter

Et valgfritt **Gradienter**-panel bygger blandingstokens fra paletten din for bakgrunner og aksenter. Hopp over det helt hvis merkevaren din ikke bruker gradienter. Hver gradient har en forhåndsvisning, navngitte stopp (2-8) og en vinkel. Nøkkeloppførselen: **et stopp refererer til en fargeprøve**, så fargelegg den fargeprøven om, og gradienten følger med. Interpolasjonen skjer i OKLCH for rene overganger. Slett et stopp for å korte ned forløpet.

### Ta paletten med deg

Den flytende pillen plassert nederst på palettpanelet laster ned hele paletten som **Designtokens (JSON)**, **CSS-variabler**, **CSS-klasser**, **SCSS-variabler**, en **GIMP-palett (.gpl)** eller en **Adobe Swatch Exchange (.ase)** - slik at merkevaren går rett inn i Illustrator, Figma, GIMP eller et stilark. Den ligger utenfor panelets rullefelt, så den beholder plassen sin uansett hvor langt paletten rulles. (Du kan også laste ned paletten fra [Katalog](/info/using.html)-visningen.)

## Skrift

![The compare stage open under its card, with the search row, the pinned families and the cards folded to a one-line strip](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

Rommet ledes av **fire rollekort** - de fire skriftene appen, verktøyene dine og all eksport faktisk leser. Hvert kort viser hva som tjener den rollen akkurat nå, satt i den skriften, med en linje ekte tekst under:

- **Primær** - brødtekst, knapper og alle verktøy.
- **Overskrifter** - visningsskriften for `h1`/`h2`.
- **Kode** - en fastbreddeskrift for kode og data.
- **Kursiv** - en ekte kursiv følgesvenn for uthevelse, sitater og sidebemerkninger.

Overskrifter, kode og kursiv faller hver tilbake til primærskriften til du tildeler dem, så en merkevare med én skrift trenger ingen valg her i det hele tatt. Ingenting på et kort tar noe i bruk med en gang: **Endre** (eller **Velg en skrift** på en tom rolle) åpner **sammenligningsstadiet** avgrenset til den rollen.

![Skrift-rommet - rollekortene og et levende eksempel på hver skrift i arbeid](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

### Sammenligningsstadiet

Stadiet åpnes **inline i rommet**, ikke i en dialogboks, slik at kortene du kom fra blir stående på skjermen. Søk i en Google Fonts-familie (Inter, Fraunces, Space Grotesk...) eller slipp en skriftfil, trykk **Legg til i sammenligningen**, og kandidatene stilles side om side i de samme ordene før noen av dem installeres. Escape avbryter og gir tastaturet tilbake til kortet du åpnet det fra.

Det er den ene døren inn, og det er derfor ingenting kommer inn i merkevaren din usett. Under scenen ligger de to administrasjonspanelene:

- **Skrifter på denne enheten** - hver installerte familie, rollene den tjener og en slett-knapp. **Legg til en skrift** her åpner det samme sammenligningsstadiet uten avgrensning.
- **Dine skrifter** - last opp en **TTF**, **OTF** eller **WOFF** fra din egen maskin. Det er veien for en lisensiert bedriftsskrift du allerede eier.

Uansett hvilken vei blir skriften værende på denne enheten, tegnes i appen, i verktøyene dine og i all eksport, offline for alltid, og reiser med merkevarepakken din - ingenting hentes ved rendering. Alt på Google Fonts leveres under en åpen lisens (OFL/Apache/UFL).

**Skriftroller**-panelet nederst viser et levende eksempel på hver rolle - brødtekst og grensesnitt i primærskriften, en valgfri visningsskrift for toppoverskriftene, en kursiv for uthevelse, en fastbreddeskrift for kode og data - slik at du kan se hele settet fungere sammen.

![Eksemplet for skriftroller - overskrift, brødtekst, kursiv og kode, hver satt i skriften rollen løses til, med skriftnavnet ved siden av](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

## Tokens

Resten av designsystemet, redigerbart uten å røre kode:

![Tokens-rommet - en glidebryter for hjørneradius pluss avstand, størrelse, skygger og resten av systemet](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Avrundede hjørner** - en enkelt radiusglidebryter (0-1,5rem) som kort, knapper og paneler i hele appen følger.
- **Flere tokens** - legg til og rediger **avstand**, **størrelse**, **strekbredde**, **gjennomsiktighet**, **rotasjon**, vanlige **tall** og **skygger**. Velg en type, gi den navn (*Mellomrom, Kortskygge...*) og angi verdien. Disse lagres som standard [designtokens](/info/design-tokens.html) (DTCG) og følger med merkevaren din.

## Filer

Slipp filene merkevaren din har - bortsett fra logoer - her: **vektor-**, **bilde-**, **lyd-** og **bevegelses**ressurser (video, Lottie, animert). De havner i [Katalog](/info/using.html), sortert i seksjoner og klare i hvert verktøys ressursvelger. Alt forblir på denne enheten. (Menyen kaller rommet **Filer**; URL-nøkkelen forblir `catalogue`, fordi en panelnøkkel er en permanent kontrakt.)

## Ta inn en merkevare

**Legg til fra…** nederst i menyen åpner en velger i to trinn. Det første trinnet spør hva du *har*, ikke hvilket format det er:

- **Designtokens eller en designfil** - DTCG- eller Tokens Studio-JSON, et Penpot-prosjekt, en **zip med tokensett**, en Lolly-designsystempakke eller en SVG.
- **PDF** - en presentasjon eller en retningslinjefil, lest på denne enheten for fargene, merkene og de innebygde skriftene.
- **Bilde** - et skjermbilde eller et fotografi; fargene leses på denne enheten, og ingenting lastes opp.
- **Skriftfil** - TTF, OTF eller WOFF. Åpner Skrift-rommet, hvor skriften installeres.
- **Nettsted** - én side, lest for fargene og skriften. Denne flisen vises bare på en enhet som faktisk kan lese en side, fordi en deaktivert flise som reklamerer for noe ingen kan trykke på er verre enn ingen flise i det hele tatt. Der den vises, navngir den leseren sin tydelig: hentet av appen på denne enheten, eller lest gjennom nettleserutvidelsen i en bakgrunnsfane, innlogget som deg. Å angi en URL fyller bare ut feltet på forhånd - hentingsknappen er samtykket, så en lenke noen sender deg kan aldri starte en lesing.

Velg designfil-kilden, og andre trinn er kortet nedenfor: de aksepterte formatene ledes an som ikonfliser i foretrukket rekkefølge, og hele kortet er ett sleppmål - klikk hvor som helst på det, eller dra en fil på det. Du kan også slippe en fil rett på studioet.

![Importkortet - de aksepterte formatene ledes an som ikonfliser, og hele kortet er ett sleppmål](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

Hva hver designfil gir deg:

- en **LollyBrand**-pakke (`.zip`) - installeres i ett trinn;
- en **Penpot**-eksport (`.penpot`) - henter inn designtokensene sine;
- en **Design Tokens**-fil (`.json`) - W3C DTCG;
- en **Tokens Studio**-fil (`.json`) - Tokens Studio;
- en **ren SVG** (`.svg`) - Lolly skanner fargene og lar deg velge hvilke som beholdes, der den første blir din primærfarge.

En kildeinstallasjon tar et **sjekkpunkt først**, slik at «tilbakestill til før importen» er én gjenoppretting. Og det en skanning finner går ikke rett inn: kandidater havner i **Skuffen**, hvor hver enkelt legges til med sitt eget trykk, gjennom rommet som eier den typen materiale.

`#/start?source=<kind>` åpner velgeren på en gitt kilde (`file`, `pdf`, `image`, `font`, `url`), og `?import` åpner den på den enkle listen.

## Flytt en merkevare mellom enheter

**Eksporter** nederst i menyen skriver én enkelt **`LollyBrand-…zip`** - tokensene, skriftene, logoene og temapreferansen din, med et integritetsmanifest den bekrefter når den tas inn igjen. Ved siden av skriver **Tokens (.json)** det rene designtokens-dokumentet alene: ingen skrifter, ingen logoer, bare tokensene, som er det et repo, et CI-trinn eller et annet tokensverktøy faktisk leser.

Å ta en tilbake inn er **Legg til fra… → Designtokens eller en designfil** (over), eller dra-og-slipp på studioet. Slik gir en kollega deg en merkevare, eller slik tar du en med til en annen installasjon - ingen konto, ingen sky. For å ta inn en merkevare fra kommandolinjen i stedet, se [`ingest:brand`](/info/configuration.html#brand-packs).

## Versjoner

**Versjoner** nederst på skinnen er der et designsystem slutter å være et bevegelig mål. Publiser én, og du får en **permanent, navngitt kopi** oppbevart på denne enheten: den endres aldri etterpå, så et verktøy som fester seg til den, fortsetter å tegne det samme. Panelet forblir skjult til det finnes noe eget å publisere, slik at et studio som aldri publiserer, aldri ser kontrollene.

Tre ting å vite før du trykker på noe, og panelet sier alle tre før trykket i stedet for etterpå:

- **En versjon er permanent.** Det finnes ingen slettefunksjon ennå, så panelet forteller hva som er beholdt og at det forblir beholdt, i stedet for å tilby en knapp som lyver.
- **Fjerninger leder kompatibilitetskortet.** Lagt til og endrede tokens er nyheter; en *fjernet* en er det som ødelegger et verktøy, så den nevnes først og kalles det den er.
- **Publisering kan ikke angres; gjenoppretting kan.** *Gjenopprett nyeste fra denne versjonen* er en ordinær redigering av hodet, så den havner på studioets angre-stabel, og panelet tilbyr deg **Angre** med det samme.

Du kan **Bare publisere**, eller **Publiser og gjør aktiv** - forskjellen er om verktøyene og appen følger den versjonen fra nå av eller fortsetter å følge din siste redigering. **Følg det siste igjen** setter hver redigering live i det den gjøres. `#/start?area=versions` åpner panelet direkte.

## Når merkevaren er fast

Enkelte bygg leveres med en **låst merkevare** - fargene, fontene og tokens er det alle verktøy og eksporter bruker, og det er ingenting å endre. I så fall erstattes studioet med en kort merknad som forklarer at dette bygget leveres med en fast merkevare og at redigering er avslått. Dette er bevisst: det er slik en organisasjon garanterer at alt holder seg på merke.

## Hvor du går videre

- **[Bruke Lolly](/info/using.html)** - lerretet, lagring, prosjekter og katalogen.
- **[Designtokens](/info/design-tokens.html)** - tokenmodellen merkevaren din uttrykkes i.
- **[Eksport og formater](/info/exporting.html)** - trykkeenheter, CMYK og formatene merkevaren din gjengis til.
