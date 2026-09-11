# Profiler - hvem du er når du skaper

En **profil** er den arbeidsidentiteten Lolly skaper *som*. Det er det lille settet med detaljer et verktøy kan hente fra, slik at du slipper å skrive dem inn på nytt hver gang - navnet ditt, kontaktdetaljer, et valgfritt portrettbilde, noen preferanser - pluss alt du samler opp mens du jobber: lagrede økter, opplastede bilder og den lokale aktivitetstellingen.

Alt i en profil finnes **på enheten**, i nettleserens lokale database (IndexedDB i web-PWA-en, filsystemet i Tauri-appene). Det finnes ingen konto, og ingenting lastes opp. Du administrerer den under **Profil** (øverst til høyre i galleriet); verktøy *leser* den bare noensinne, og kun de spesifikke feltene de er bygget for å forhåndsutfylle.

> En profil handler om *deg* (eller hvem det nå er som skaper her). Den er distinkt fra **Platform** - merkevarens farger, fonter og globale innstillinger - og fra **Capabilities**, katalogen over hva appen kan gjøre. Se [Profile vs Platform vs Capabilities](#profile-vs-platform-vs-capabilities) helt til slutt.

## Hva som er i en profil

| Del | Hva det er |
|---|---|
| **Navn** | Fornavn og etternavn. |
| **Kontakt** | E-post og telefon. |
| **Sted** | By og land. |
| **Portrettbilde** | Et valgfritt bilde, beskåret til kvadrat og lagret som et lokalt bilde. Brukes av verktøy som e-postsignaturer, sitatkort, organisasjonskart og dynamiske oppsett. |
| **Bruk mine detaljer til å skape** | En enkelt opt-in-bryter (den viser **Using my details** når den er på). Den styrer om dine personopplysninger følger med som **proveniens** - forfatter-/kredittlinjen bakt inn i eksporterte filer - og som forfatter i **/pro**-batch-kjøringer. (Den styrer ikke forhåndsutfylling: se [How tools use your profile](#how-tools-use-your-profile).) |
| **Preferanser** | Temaet ditt (Light, Dark eller Brand - merkevaretemaet maler appen i din egen palett) og hvilke deler av appen du har slått på via **Feature flags**. |
| **Tilgjengelighet** | Fire komfortbrytere - *Reduce motion*, *Hide colourful previews*, *High contrast*, *Large text* - lagret på profilposten, så de følger med ved en profileksport. Se [Accessibility](#accessibility). |
| **Ditt arbeid** | Lagrede økter (med miniatyrbilder) - organisert i nøstede mapper i **[Projects](/info/using.html)** - biblioteket ditt **My images** og de lokale aktivitetsstatistikkene, alt knyttet til denne profilen. |

![Three theme cards, each previewing its own type and colour, with the active one flagged](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

![Profilskjermen - navn, kontakt, et valgfritt portrettbilde og preferansene dine](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

Ingenting av dette er obligatorisk. En blank profil er en helt utmerket profil; du fyller bare inn det som sparer deg for skriving.

Siden er lang, så den har sin egen **innstillingsskinne** nedover siden - Your details, Appearance, Accessibility, Lolly instance, Your activity, Storage, Available offline, Feature flags, Content Credentials - med et **Search settings**-felt over den som filtrerer listen etter hvert som du skriver. Hver seksjon er dyplenkbar som `#/profile?focus=<section-id>`, som åpner den og skroller den inn i visning (`#/profile?focus=storage-section`, `?focus=feature-flags-section`, og så videre), slik at en lenke kan peke på én innstilling i stedet for toppen av siden.

![Tre temakort, hvert forhåndsviser sin egen type og farge, med det aktive markert](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

## En profil er en kontekst, ikke bare en person

Ordet «profil» antyder én fast person, men i Lolly er det egentlig en **skapende kontekst** - *hvem du er mens du lager denne tingen*. Den konteksten kan ha tre ulike former, og Lolly håndterer alle på samme måte.

### Som enkeltperson

![The headshot control, empty until you upload a photo that then stays on this device](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

![Portrettbilde-kontrollen, tom inntil du laster opp et bilde som deretter blir værende på denne enheten](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

### Som et team

En profil trenger ikke være ett enkelt menneske. Den kan representere et **team eller en funksjon i en organisasjon**: teamets delte navn, en gruppe-innboksadresse (`events@…`), en avdeling, teamets portrettbilde eller enhetsmerke. Én person setter den opp, eksporterer den (se under), og resten av teamet laster inn samme profil - slik at alt teamet produserer bærer konsistente detaljer uten at noen må skrive dem inn på nytt. En delt kiosk eller en utsjekket demolaptop kan kjøre en enkelt teamprofil som alle bak den skaper som.

### Som en funksjon - en rolle du bærer iblant

Dette er tilfellet den rigide modellen «én person, én profil» går glipp av. Du kan være en **eventansvarlig tre dager i året** og noe helt annet resten av tiden. De tre dagene vil du ha eventdetaljer, event-innboksen, kanskje en event-undermerkevare som fyller ut merkene og skiltingen din; de andre 362 vil du ha din vanlige identitet tilbake.

I Lolly er den rollen bare **en annen profil du har for hånden** - en lagret pakke (neste seksjon) du laster inn for eventet og legger til side etterpå. Rollen er en hatt, ikke en ny konto. Ta den på når du trenger den, ta den av når du er ferdig.

## Én installasjon, én aktiv profil - men du kan ha flere

På et hvilket som helst tidspunkt har en installasjon **én aktiv profil** - detaljene et verktøy ser akkurat nå. Det finnes ingen profilbytter i appen; i stedet er hver profil en **portabel pakke** (en enkelt `.zip`, se [under](#moving-a-profile-to-a-new-device)). Det er bevisst den samme mekanismen som å flytte til en ny enhet - en profil er en fil du kan lagre, kopiere og laste inn.

![The storage meter, breaking down saved sessions, images and cache against what the browser actually reports](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

- <!--i:trash--> **Reneste bytte:** **Profile → Storage → Clear all my data**, deretter **Import** pakken for konteksten du går inn i. Nå skaper du utelukkende som den profilen.
- <!--i:layers--> **Lagdeling:** å importere *uten* å tømme først **fletter** - den importerte profilen, øktene og bildene havner oppå det som allerede er der, og erstatter alt med samme navn mens resten blir stående. Praktisk for å hente inn ett teams lagrede økter i ditt eget oppsett; ikke det du vil ha om du trenger en ren rollegrense.
- <!--i:monitor--> **Side ved side:** fordi alt er enhetsbegrenset, bærer en separat nettleserprofil, en separat brukerkonto eller en installert PWA nummer to hver sin uavhengige Lolly-profil. Kjør din personlige installasjon og kioskinstallasjonen for arrangementet samtidig, uten bytting.

Så hvis du virkelig sjonglerer flere kontekster (deg, teamet ditt, eventansvarlig-hatten), holder du på flere pakker og laster inn den du trenger:

![Lagringsmåleren, som bryter ned lagrede økter, bilder og cache mot det nettleseren faktisk rapporterer](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

> Hold én pakke per kontekst og gi filene nytt navn etter hva de er (`LollyTools-events-2026.zip`, `LollyTools-me.zip`). Filen *er* profilen.

## Tilgjengelighet

**Profile → Accessibility** har fire komfortinnstillinger for appen *rundt* arbeidet ditt. Hver er av inntil du slår den på, og ingen av dem når inn i et verktøylerret eller en eksport - en roligere app skal ikke flytte en eneste piksel i filen du leverer.

- <!--i:film--> **Reduce motion** - slår av overgangene, glidningene og de animerte fintene i appen. Verktøylerretet ditt og enhver animert eksport fortsetter å bevege seg akkurat som designet.
- <!--i:image--> **Hide colourful previews** - bytter ut galleriets forhåndsvisningsgrafikk med rolige ikon-og-tekst-kort, og demper fargen og kontrasten på prosjektminiatyrene dine slik at de forblir gjenkjennelige uten å rope. Inne i et verktøy vises alt i full farge.
- <!--i:sliders--> **High contrast** - styrker appens kantlinjer, tekst og fokusringer. Merkevarefargene dine og alt på lerretet forblir nøyaktig som du har satt dem.
- <!--i:font--> **Large text** - øker appens skriftstørrelse: etiketter, menyer og knappetekst. Kontrollene beholder sin størrelse, så bare ordene i dem blir større, og skrift inne i designene dine er urørt, så ingenting du eksporterer flyter om.

Disse lever på selve profilposten, som er hvorfor de følger med ved en profileksport og havner på neste installasjon sammen med navnet ditt og øktene dine. (Enheten beholder også et lite lokalt speil slik at innstillingen gjelder før første maling; det speilet er kun lokalt og følger ikke med.)

## Din Lolly-instans

**Profile → Lolly instance** viser hvor denne installasjonen henter verktøyene og katalogen sin fra - adressen til instansen, eller *Bundled with this app* når alt følger med i selve bygget. Der en distribusjon tilbyr det, åpner en **Instance console**-lenke dens adminflate, og **Change** / **Disconnect** peker installasjonen om eller kutter den løs.

Å peke om til en annen instans krever **skrivebordsappen**: en nettleser hindrer en side i å laste verktøy og ressurser på tvers av opphav, så på nett rapporterer seksjonen bare hvor du er og lar det bli med det.

## Tilgjengelig offline

Lolly cacher etter hvert som du går, men caching-etter-hvert-som-du-går dekker bare der du allerede har vært. **Profile → Available offline** er for turen du kan se komme: en time på flyplass-wifi før en flytur uten noen. Last ned delene du trenger, følg med på én fremdriftslinje, og alt du tok med fortsetter å virke uten forbindelsen.

Syv deler, hver med størrelsen oppgitt før du bekrefter:

- <!--i:layout--> **Appen** - hver visning, editor og font, inkludert de du ikke har åpnet ennå. Uten denne kan en skjerm du aldri besøkte online ikke lastes offline.
- <!--i:image--> **Katalog** - merkevareressurser utover det essensielle. Ta alt sammen, eller åpne *Choose by tag* og ta bare taggene du bruker.
- <!--i:book--> **Guider og dokumentasjon** - denne dokumentasjonssiden, på ditt språk, med skjermbilder inkludert.
- <!--i:cpu--> **Talestemmer** - stemmemodellene bak Script-lyd og fortelling. Lastes ned én gang, kjører deretter på enheten.
- <!--i:zap--> **Oppskaleringsmodeller** - AI-bildeoppskalererne: foto, illustrasjon/anime og ansikt.
- <!--i:layers--> **Bakgrunnsfjerning** - kutt-ut-modellene på enheten bak *Remove background*.
- <!--i:shield--> **Verify deep scan** - vannmerkeskanneren på enheten, for å sjekke Content Credentials uten forbindelse.

De fire siste er merket **stor nedlasting**, og de er bevisst individuelle opt-in-valg: **Last ned alt** øverst tar med appen, katalogomfanget du valgte, dokumentasjonen og alle verktøy i én omgang - og ikke noe annet. Talestemmer, oppskaleringsverktøyene, bakgrunnsfjerning og dypskanningen laster hver for seg bare ned når du ber om den raden ved navn - noen hundre megabyte gjemt inni én knapp ville vært uredelig.

Under delene ligger listen per verktøy: hvert verktøy lastes ned enkeltvis (haken betyr klar offline), eller **Last ned alle** tar hele listen. Nedlastinger kan gjenopptas - avbryt eller mist forbindelsen, og neste kjøring fortsetter der den stoppet og henter bare det som mangler - og de oppdaterer seg selv når du er tilbake på nett, og henter bare det en ny versjon har endret.

Hvis nettleseren ikke har gitt varig lagring, sier delen fra om det og tilbyr **Beskytt nedlastinger**, som ber om det - forskjellen mellom «lastet ned» og «lastet ned til nettleseren vil ha plassen tilbake».

## Flytte en profil til en ny enhet

![The two buttons that move a whole install: Export my data writes one zip, Import data reads it back](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Fordi en profil er helt lokal, er den eneste måten å få den inn på en blank installasjon - en ny bærbar datamaskin, en nylig tilbakestilt nettleser, en kollegas maskin, en offline-boks - å **ta med filen**. Ingen innlogging gjenoppretter den for deg, og det er hele poenget: ingenting forlot noensinne enheten din i utgangspunktet.

- <!--i:download--> **Eksporter dataene mine** laster ned én `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` - navngitt etter profilen den tilhører, med et løpenummer per dag slik at gjentatte eksporter ikke kolliderer (navnedeler utelates når profilen mangler dem). Den inneholder profilen din, hver lagrede økt (med miniatyrbilde), dine opplastede bilder - merkevaretokenene og de installerte fontene dine blir med som brukerressurser - og innstillingene dine (tema, layout, lokal aktivitetsstatistikk).
- <!--i:upload--> **Importer data …** på den andre installasjonen leser den filen tilbake inn, og du fortsetter nøyaktig der du slapp.
- <!--i:box--> **Eksporter dataene mine og render alt** skriver den samme sikkerhetskopien *pluss* en andre zip som rendrer hver lagrede økt til sin ferdige utfil, i mapper som gjenspeiler prosjektene dine. Et komplett offlinearkiv av både kildene og resultatene - og det kan bli stort og tregt med mange økter.

![De to knappene som flytter en hel installasjon: Eksporter dataene mine skriver én zip, Importer data leser den tilbake](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Pakken er en enkel, selvstendig zip-fil, så den kan reise på **en hvilken som helst** måte - USB, AirDrop, en nettverksdeling, e-post til deg selv - og målet kan være helt offline. Hver del er sjekksummert, slik at en fil som er skadet under overføring, oppdages ved import i stedet for å bli gjenopprettet halvveis ødelagt. Import **slår sammen** (profil/økt/bilde med samme navn overskrives; alt annet beholdes), så den sletter aldri et mål som allerede er i bruk.

Det som ikke følger med: katalog­mellomlageret (det laster seg ned på nytt på den nye enheten) og selve verktøyene (antas allerede å være til stede).

For den eksakte pakkestrukturen, versjonspolicyen og integritetsreglene, se **[Dataoverføring](/info/data-transfer.html)**; for gjennomgangen fra start til slutt, **[Bruke Lolly → Flytte til en annen enhet](/info/using.html#moving-to-another-device)**.

## Hvordan verktøy bruker profilen din

![The single Use my details switch, sitting beside Save Profile and off until you turn it on](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

Et verktøy *forhåndsutfyller* bare noensinne de profilfeltene det eksplisitt er bygget for å binde til:

**Opt-in-valget (proveniens).** Når du eksporterer en ressurs, kan detaljene dine valgfritt følge med som **proveniens** - en forfatter-/krediteringslinje bygget inn i filens metadata (PNG, PDF, SVG, …) - slik at en ferdig ressurs kan si hvem som lagde den. *Dette* er det **Bruk detaljene mine ved oppretting** styrer: la den stå av, og eksporten har fortsatt attribusjonen «Laget med Lolly» for verktøy/plattform, men ingen personlig forfatter-/kontaktlinje blir bygget inn. (Det samme opt-in-valget setter forfatteren på batch-kjøringer i **/pro**.) (Verktøyforfattere: se [Lage verktøy → `bindToProfile`](/info/authoring-tools.html#bindtoprofile) og [Host API → `host.profile`](/info/host-api.html#host-profile).)

![Den ene bryteren Bruk detaljene mine ved oppretting, ved siden av Lagre profil og av til du slår den på](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## Profil vs. plattform vs. funksjoner

Tre ting ligger nær hverandre i grensesnittet og er lette å forveksle:

- <!--i:people--> **Profil** - *deg* (eller teamet ditt, eller rollen du har): navn, kontakt, portrett, ditt lagrede arbeid. Personlig, enhetslokalt, flyttbart som en pakke.
- <!--i:palette--> **Plattform** - *merkevaren*: farger, fonter og globale innstillinger hvert verktøy rendrer mot. Delt og konsistent, ikke personlig.
- <!--i:sliders--> **Kapabiliteter** - *hva appen kan gjøre*: hele funksjonssettet og verktøyene som er tilgjengelige for deg.

En profil endrer hvem en ressurs er *fra*; plattformen endrer hvordan den *ser ut*; funksjoner er *hva du kan lage*.

### «Profil» betyr to andre ting andre steder - ikke denne

Ordet brukes i flere betydninger på tvers av prosjektet. Ingen av disse er den personlige profilen denne siden handler om:

- <!--i:box--> **Innholdsprofil** - en byggetidskonfigurasjon i `profiles.json` som binder et sett med verktøypakker til en merkevarekatalog (f.eks. `suse`, `lolly-start`). Det er det en operatør velger ved utrulling, og det er også det **URL-/CLI-parameteren** `profile` velger som en *fargevariant* av ved eksporttidspunktet (ICC-/CMYK-trykktilstanden - se [URL-modus](/info/url-mode.html)). Begge handler om *bygget/utdataene*, ikke om *deg*. Se [Konfigurasjon](/info/configuration.html).
- <!--i:seal--> **Identitetsprofil** - den valgfrie **verifiserte Content Credentials-identiteten** du kan registrere (et kortlevd sertifikat som knytter e-posten din til dine signerte eksporter). Det er en signeringsidentitet, atskilt fra den personlige profilens navn-/kontaktfelt, selv om **Bruk detaljene mine ved oppretting** styrer om noen av dem blir bygget inn. Se [Content Credentials-identitet](/info/content-credentials-identity.html).

![Kortet for Verifisert identitet, telefonbredde: velgeren for sertifikatets levetid og registreringssteget under - identitetsprofilen, atskilt fra de personlige detaljene dine](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## Personvern

Utenom den valgfrie identitetsregistreringen ovenfor (som sender e-posten du registrerer til sertifikattjenesten - se [Serveroverflate](/info/server-surface.html)), blir en profil aldri overført, lastet opp eller brukt til å identifisere eller spore deg - det er ingenting å samtykke til, bare denne merknaden slik at du vet hva som lagres. Fjern alt sammen når som helst med **Profil → Slett alle dataene mine**. Se [Personvernerklæringen](/info/privacy.html).
