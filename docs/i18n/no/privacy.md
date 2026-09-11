# Personvernerklæring

*Sist oppdatert: 11. august 2026*

> **Kortversjonen.** Dokumentene, bildene, videoene og filene du lager i Lolly, blir
> på enheten din. Det finnes ingen kontoer for vanlig bruk, ingen infokapsler fra selve
> appen og ingen analyse eller sporing noe sted i kildekoden - ikke "vi bruker ikke
> dataene", men faktisk fraværende fra kildekoden. En kort, fullstendig liste over
> unntak finnes der hvor programvaren i det hele tatt kommuniserer med et nettverk, og
> hvert av dem er beskrevet i detalj under: hva som sendes ut, til hvem og når. Det
> eneste unntaket som involverer noe personlig, er en innlogging du selv må starte
> eksplisitt. Står det ikke i dette dokumentet, skjer det ikke.

## Hva denne erklæringen dekker

Lolly er programvare med åpen kildekode - en motor, flere app-skall (web, desktop,
mobil, CLI) og en nettleserutvidelse - som hvem som helst kan kjøre. Denne erklæringen har to
deler:

- <!--i:code--> **Selve programvaren**: hva den gjør og ikke gjør med dataene dine, uansett hvor den
  kjører. Dette er en egenskap ved koden, så det gjelder for enhver Lolly-utrulling,
  vår eller andres.
- <!--i:server--> **lolly.tools**, referanseutrullingen SUSE drifter: de spesifikke valgene
  som er tatt for de valgfrie server-side delene (hva som logges, hvor lenge, av
  hvem).

Hvis du bruker en selvhostet eller enterprise-instans av Lolly, gjelder programvareatferden
nedenfor fortsatt, men *operatøren* av den instansen - ikke SUSE - er
ansvarlig for alt som er server-side: deres render-endepunkt, deres MCP-server,
deres sertifiseringsinstans for Content Credentials, hvis de drifter en. Spør dem om
deres egen erklæring. Se [Adoption & Governance](/info/adoption-governance.html) for
hva det innebærer å drifte Lolly.

## Appen: hva som blir på enheten din

Lollys web-, desktop- og mobilskall kjører hele render-motoren klientsidig.
Å åpne et verktøy, fylle inn data, forhåndsvise og eksportere skjer alt på
enheten din - ingen server er involvert, og appen fungerer offline når den først er lastet.

**Appen setter ingen informasjonskapsler.** For å fungere lagrer den en liten mengde data **kun
på enheten din**, aldri overført:

- <!--i:sliders--> **Grensesnittinnstillinger** - tema, språk, lydinnstillinger, størrelse på
  sidepanel/zoom, sorterings- og visningsvalg, hvilke onboarding-tips du har sett - i
  `localStorage`, slik at de er tilgjengelige før appen er ferdig med å starte opp.
- <!--i:download--> **En offline-buffer av verktøykatalogen og ressursforhåndsvisninger**, slik at galleriet
  fungerer uten tilkobling.
- <!--i:hash--> **Lokale bruksmålere** for statistikken på profilkortet ditt (hvor mange eksporter, hvilke
  verktøy) - en liten avgrenset blob i `localStorage`, aldri lest av oss, aldri sendt
  noe sted.
- <!--i:folder--> **Dine egne dokumenter, lagrede økter, opplastede ressurser og skrifter** - lagret i
  IndexedDB på enheten din, aldri lastet opp, aldri lest av noen andre enn deg.

Ingenting av dette deles, selges eller brukes til å identifisere eller spore deg. Det er ingenting
å samtykke til, fordi det ikke foregår noen innsamling - kun dette varselet, slik at du
vet hva som lagres og hvor. Slett alt sammen når som helst med **Profile → Clear all
my data**, eller ved å tømme nettstedets lagring i nettleseren din. (I henhold til ePrivacy-
direktivet Art. 5(3) krever lagring som er strengt nødvendig for tjenesten du ba
om, ikke samtykke - bare åpenhet, som er hva dette dokumentet og
varselet i appen begge er.)

![Lagringsdelen på profilsiden på en telefonbred skjerm: hver kategori av data på enheten er navngitt, med Clear all my data-knappen rett ved siden av](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Din egen sikkerhetskopi av disse dataene - `lolly-backup`-pakken som lages av **Export my
data & render everything** - er en fil du beholder og kontrollerer selv. Den berører aldri våre
servere med mindre du selv velger å sende den et sted. Se [Data
Transfer](/info/data-transfer.html).

## Verktøy som kjører på enheten

Enkelte verktøy - **Strip Hidden Data**, **Compress PDF** og andre som bærer
merket **"Runs on your device"** - jobber med en fil du gir dem. Filen leses
inn i minnet i nettleseren din, transformeres lokalt og tilbys tilbake som en nedlasting.
Den lastes aldri opp, fordi det ikke finnes noen server i veien å laste den opp til.
Disse verktøyene fungerer offline, og resultatet deres bærer verken vannmerke eller metadata fra
oss - poenget med de fleste av dem er å fjerne & beskytte data, ikke legge til risiko.

![Merket disse verktøyene bærer: Runs on your device - ingenting lastes opp](/t/url-shot?url=%2F%23%2Ftool%2Fstrip-data&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=.on-device-badge&dark=1&filename=pv-ondevice-badge)

## Når appen snakker med et nettverk, i sin helhet

Tabellen nedenfor er den komplette listen over alt appen henter eller sender over et
nettverk. Hvis det ikke står her, gjør ikke appen det.

| Hva | Hva som faktisk forlater enheten din | Når (handlingen som utløser det) | Hvis en operatør blokkerer det |
|---|---|---|---|
| Synkronisering av verktøykatalogen | Ingenting personlig - en forespørsel om Lollys egen offentlige verktøy- og ressursindeks, til appens egen opprinnelse | Ved oppstart, deretter bufret for bruk offline | Appen kjører på det bufrede verktøysettet sitt. Den slutter bare å oppdage nye verktøy |
| Et verktøy som trenger sanntidsdata | Det den spesifikke verktøyet ber om, til verten som er nevnt i sin egen beskrivelse. I dag er dette bare bysøket i Meeting Planner-verktøyet, som spør `geocoding-api.open-meteo.com` om å gjøre et bynavn om til koordinater og en tidssone - ingen konto, ingen nøkkel og ingen identifikator utover selve forespørselen. Inndatafeltet sier dette rett der du skriver, og hvert svar lagres på enheten din slik at en by bare slås opp én gang | Bare mens du bruker det verktøyet, og bare når du oppgir et sted | Det ene oppslaget mislykkes. Du kan fortsatt skrive inn koordinater for hånd, og ingenting annet påvirkes |
| Google Fonts | Navnet på den valgte skriftfamilien og IP-adressen din, til Googles skriftservere (`fonts.googleapis.com` for stilarket, `fonts.gstatic.com` for skriftfilen) | Bare hvis du legger til en Google Font i merkevareredigeringen, **og bare etter at du godtar det i en dialogboks som sier nøyaktig dette** - én henting per familie, deretter ligger den på enheten din og brukes offline | Google Fonts-velgeren feiler lukket. Last opp en skriftfil i stedet |
| Send to Google Drive | Den ene filen du valgte å sende, til Googles Drive-API (`www.googleapis.com`), etter en Google-innlogging du fullfører i Googles eget popup-vindu. Lollys tilgang er begrenset til filer den selv har opprettet (omfanget `drive.file` - den kan aldri lese resten av Driven din), og innloggingstoken holdes i minnet for økten, aldri lagret | Bare når du trykker på «Send to Google Drive» på en EMF-eksport, og bare i versjoner der operatøren har konfigurert en Google-klient-ID - uten en finnes ikke knappen | Knappen vises aldri. Last ned filen og last den opp til Drive selv |
| Send to Dropbox | Den ene filen du valgte å sende, til Dropboxs API (`api.dropboxapi.com` for innlogging og metadata, `content.dropboxapi.com` for selve filen), etter en Dropbox-innlogging du fullfører i Dropboxs eget vindu. Lollys tilgang er begrenset til appmappen (den kan bare noensinne se `Apps/` og sin egen mappe der - aldri resten av Dropboxen din), «Open»-lenken den viser deg er en kortvarig privat lenke (ingen offentlig deling opprettes), og et fornyingstoken lagres bare hvis du krysser av for «stay connected» | Bare når du trykker på «Send to Dropbox» på en fil, og bare i versjoner der operatøren har konfigurert en Dropbox-klient-ID - uten en finnes ikke knappen | Knappen vises aldri. Last ned filen og last den opp til Dropbox selv |
| Send to OneDrive | Den ene filen du valgte å sende, til Microsofts identitets- og Graph-tjenester (`login.microsoftonline.com` for innlogging, `graph.microsoft.com` for opplastingen; en stor fil lastes opp i biter til en Microsoft-eid opplastingsadresse på `api.onedrive.com`, `*.up.1drv.com` eller `*.sharepoint.com`), etter en Microsoft-innlogging du fullfører i Microsofts eget vindu. Lollys tilgang er begrenset til sin egen mappe under `Apps/` (den kan aldri lese resten av OneDriven din) pluss visningsnavnet ditt til kontoetiketten, og et fornyingstoken lagres bare hvis du krysser av for «stay connected» | Bare når du trykker på «Send to OneDrive» på en fil, og bare i versjoner der operatøren har konfigurert en Microsoft-klient-ID - uten en finnes ikke knappen | Knappen vises aldri. Last ned filen og last den opp til OneDrive selv |
| Send to LinkedIn | Den ene filen du valgte å sende, pluss navnet på den som teksten i innlegget, til LinkedIn (`www.linkedin.com` for innloggingen, `api.linkedin.com` for opplastingen og innlegget), etter en LinkedIn-innlogging du fullfører i din egen nettleser. Innlegget går til din egen feed som et offentlig innlegg under navnet ditt. Lolly kan publisere som deg og lese navnet ditt til kontoetiketten, ingenting annet på LinkedIn-en din, og innloggingen beholdes på denne enheten bare hvis du krysser av for «stay connected» - LinkedIns tokener varer i 60 dager og kan ikke fornyes stille, så den utløper av seg selv | Bare når du trykker på «Send to LinkedIn» på en fil, bare i skrivebordsappene, og bare i versjoner der en LinkedIn-app er konfigurert - uten en finnes ikke knappen | Ingenting å blokkere i nettappen: dette finnes **bare i skrivebordsappene**, så disse to vertene er bevisst IKKE i nettappens Content-Security-Policy nedenfor. I skrivebordsappene, fjern den konfigurerte LinkedIn-appen, så vises knappen aldri |
| ICC-trykkprofiler | Ingenting personlig - en forespørsel om en standard trykkforholdsprofil, til ICCs offentlige register (`registry.color.org`, `www.color.org`) | Bare hvis du klikker på en ICC-forhåndsinnstilling i trykkprofilbehandleren - én henting per profil, deretter ligger den på enheten din | ICC-forhåndsinnstillinger feiler. Oppgi din egen `.icc`-profil i stedet |
| Internettradio | Ingenting personlig - en spillelisteforespørsel og en lydstrøm, til stasjonen (`api.somafm.com` og icecast-serveren den navngir, `*.somafm.com`) | Bare mens du spiller den valgfrie innebygde radioen i lydspilleren | Radioen feiler. Alle andre lydfunksjoner fungerer fortsatt |
| En URL du ber et verktøy fange opp | En forespørsel til den nøyaktige nettadressen du skriver inn, fra URL-skjermbilde-verktøyet. Uansett hvilken adresse det er. Denne verten er ikke i policyen nedenfor, fordi du velger den i bruksøyeblikket | Bare når du skriver inn en URL i det verktøyet og starter opptaket | En operatør kan ikke sette denne verten på en tillatelsesliste. For å fjerne det, fjern verktøyet |
| SEAL-signatursjekk | **Ingenting.** Nettappen har ingen DNS-oppløser i det hele tatt - se nedenfor | Aldri | Ingenting å blokkere |
| KI-modeller på enheten | Ingenting personlig - én nedlasting av en modellfil fra Lollys modellvert (`lolli.li`), deretter bufret på enheten din; ingen konto, ingen identifikator, bare forespørselen og IP-en din | Bare når du bruker en funksjon som trenger en modell (Verify dypskanning, oppskalering av bilder, tale og lignende) | Den funksjonen venter på nedlastingen; alt annet fungerer fortsatt |
| Ekstern instans | Det den instansen du navngir sender tilbake, over den samme katalogsynkroniseringen som er beskrevet ovenfor - pluss en versjonsetikett på forespørsler til den (shell-type og motorversjon, den samme informasjonen en brukeragent bærer), slik at operatøren dens kan se hvilke Lolly-versjoner som er i bruk. På en administrert instans, mens du er innlogget, bærer den etiketten også en per-enhet installasjons-ID slik at operatørens enhetsliste kan skille denne installasjonen fra andre. Den følger bare med forespørsler bruken din allerede gjør - det finnes ingen tidtaker og ingenting ringer hjem - og hvis du forlater instansen, slettes ID-en, slik at en enhet som kobler til igjen senere, presenterer en ny en | Bare hvis du eksplisitt peker skallet mot en annen Lolly-utrulling | Instansbytte feiler. Din lokale instans påvirkes ikke |

Hver faste vert i den tabellen er også hele tillatelseslisten i appens Content-Security-Policy, som nettleseren håndhever. Så listen er ikke bare en beskrivelse av hva koden gjør i dag, den er grensen nettleseren holder appen til: en fremtidig endring som forsøkte å kontakte en annen vert, ville blitt blokkert, ikke stille tillatt. Én rad er det bevisste unntaket, og cellen sier det selv: Send to LinkedIn finnes bare i skrivebordsappene, så nettappens policy nevner ingen av dens verter - nettappen kunne ikke nå dem selv om koden dens forsøkte. To rader til har ingen fast vert, fordi du velger adressen i bruksøyeblikket: en URL du ber et verktøy fange opp, og en ekstern instans du peker skallet mot. Ingen av dem er i policyen, og hver skjer bare når du skriver inn en adresse og handler på den. En utrulling som ikke vil ha noen av de valgfrie (en bedriftsinstans med sine egne skrifter, for eksempel) fjerner de vertene fra policyen sin, og funksjonene feiler lukket i stedet for å nå ut.

Ingen av disse sender dokumentene, prosjektene, øktene eller opplastede filene dine noe sted.
De finnes for å bringe ting *til* enheten din (verktøy, skrifter, modeller), aldri for å sende
ting *fra* den, med unntakene som er nevnt eksplisitt i avsnittene nedenfor.

**En merknad om hva vi fjernet.** Verify kan sjekke SEAL-signaturer, en ordning der en
fils signeringsnøkkel publiseres i DNS. Nettlesere kan ikke gjøre DNS-oppslag, så enhver
nettleserimplementasjon må rute oppslaget gjennom en tredjeparts DNS-over-HTTPS-
resolver - som ville vise den operatøren domenet som sjekkes, pluss IP-
adressen din. Vi pleide å bruke Cloudflares. **Det gjør vi ikke lenger, og det finnes ingen
erstatning**: webappen sender nå ingen resolver i det hele tatt, så SEAL-verifisering
her gjør null nettverksforespørsler. Filer der SEAL-posten bærer nøkkelen sin inline
verifiseres fortsatt helt offline. Filer der nøkkelen ligger i DNS, rapporterer "no key
resolver" i stedet, og du kan sjekke dem i desktop- eller kommandolinje-appen,
som løser DNS nativt gjennom din egen maskin uten at noen tredjepart
er involvert.

![Verify-skjermen: et droppmål og ingenting annet - filen sjekkes der den allerede er, uten opplasting og uten konto](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop) Du kan bekrefte dette selv: greppbare sjekker for denne og hver
annen påstand på denne siden, med de nøyaktige kommandoene og forventet resultat, finnes på
[Verify It Yourself](/info/verify-yourself.html).

## Hot-linkede render-URL-er

> **Aktiv på lolly.tools.** Hver
> `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>`-URL rendres for ekte, og
> inndataene følger med i URL-en. Avsnittet nedenfor beskriver hva det betyr
> for deg, og en operatør kan slå funksjonen av på sin egen instans.

Selve appen blir utelukkende på enheten din. Separat kan en operatør slå på
**hot-link render-URL-er** - `/tool/<tool-id>.<ext>?<inputs>` - slik at en delt Lolly-
lenke kan vises som et levende bilde i en README, en wiki eller et dashbord. Å hente en
ber serveren om å rendre **offentlig verktøy- og katalogdata** med inndataene
skrevet inn i URL-en.

- <!--i:usercheck--> **Ingen kontoer, ingen infokapsler, ingen tilstand.** Endepunktet er anonymt, og ingenting
  på enheten din leses. Dokumentene, øktene og opplastingene dine forlater aldri
  nettleseren din - de kan ikke dukke opp i disse lenkene i det hele tatt.
- <!--i:document--> **Men selve URL-en registreres.** En URLs spørrestreng er en del av forespørselslinjen,
  så den dukker opp i vertsplattformens ordinære tilgangslogger på samme måte som
  hver forespurte sti gjør. Hvis en lenkes inndata inneholder noens navn eller e-post -
  et navneskilt, en e-postsignatur - **ligger den teksten i de loggene**, og ingen
  mengde policytekst endrer det. Så en hot-link-URL er feil sted for
  personopplysninger: gi den bare det du ville lagt på en offentlig side.
- <!--i:globe--> **Inndataene er offentlige av natur** uansett - de er akkurat det lenkens
  forfatter skrev inn i URL-en, lesbart for alle lenken når. Ikke legg
  hemmeligheter i en delt lenke. Lolly tilbyr lenkekryptering for sensitivt innhold.
- <!--i:eyeoff--> Svar er **mellomlagret og rategrenset** som ethvert offentlig bilde, og merket
  `noindex` slik at søkemotorer ikke indekserer rendringene dine.

Selvhoster du Lolly og ikke vil ha en offentlig render-flate? Sett
`LOLLY_DISABLE_RENDER_GET=1`, og hver
eneste av disse URL-ene returnerer 404.

## MCP-serveren (valgfritt, for AI-agenter)

Lolly kan også nås av en AI-agent over Model Context Protocol - et
operatørdrevet endepunkt (lolly.tools drifter ett; hvem som helst kan selvhoste sitt eget,
inkludert fullstendig luftgapet). Det deler render-banens ingen-kontoer-holdning,
pluss tre verktøy som nødvendigvis håndterer filbytes:

- <!--i:cpu--> **`lolly_transform`** (kjør et verktøy som normalt kjører på enheten, server-side, på vegne av
  den kallende agenten), **`lolly_verify`** (sjekk Content Credentials) og **`lolly_redact`**
  (sladd ut områder av et bilde eller en PDF) godtar alle
  bytene til en fil fra den som kaller. De behandles **in-process, i minnet**,
  og resultatet returneres i det samme kallet - filen skrives aldri til
  disk og lagres aldri etter at forespørselen er fullført.
- <!--i:checklist--> Alle andre verktøy - `lolly_render`, `lolly_build_url`, `lolly_list_tools`,
  `lolly_describe_tool` - fungerer kun ut fra parametere (tekst, tall, farger,
  URL-er, katalog-ressurs-id-er), de samme inndataene en hot-link render-URL tar.
- <!--i:lock--> Tilgang er enten et delt token operatøren utsteder til klienter de stoler på, eller
  tilstandsløs OAuth 2.1: kortvarige signerte tokener verifisert mot en delt
  hemmelighet, ingenting lagret server-side, og selve tokenet skrives aldri til en
  logg eller en render-URL.

## Content Credentials-identitet (en innlogging du selv må starte)

Lolly kan forsegle en kryptografisk **Content Credential** i eksportene dine, slik at hvem som helst
kan verifisere, offline, at en fil er uendret siden den forlot Lolly. Det er
**på som standard og helt lokalt** - signeringsnøkkelen genereres på enheten din
og selve signeringen skjer offline. Uten registrering er den nøkkelen engangs:
et nytt nøkkelpar preges for hver eksport og forkastes sammen med den. Når du registrerer deg, blir
nøkkelen en varig en og genereres **ikke-uttrekkbar** - ikke engang Lollys
egen kode kan lese den, kun be den om å signere. Uansett forlater den aldri
enheten din. Dette avsnittet dekker det ene *valgfrie* steget på toppen av dette:
å registrere en verifisert identitet, slik at eksportene dine sier "Verified - signed by
\<your email\>" i stedet for en anonym nøkkel. **Hvis du hopper over registreringen, gjelder ingenting i
dette avsnittet for deg, og ingen personopplysninger forlater noensinne enheten din.**

![Verified identity-kortet på profilsiden, telefonbredde: velgeren for sertifikatets levetid og registreringssteget under det, sovende inntil du selv starter det](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Hvis du registrerer deg, er dette nøyaktig hva som skjer:

1. **Du velger en innloggingsmetode** - GitHub, Google, SUSE (id.suse.com) eller en
   e-postet lenke. For de tre OIDC-leverandørene blir du omdirigert til den
   leverandørens egen innloggingsside, underlagt deres personvernerklæring, ikke vår.
   Lollys sertifikattjeneste mottar kun en verifisert e-postadresse og
   leverandørens navn tilbake. For e-postlenken sendes adressen du skriver, til
   **Resend**, et transaksjonelt e-post-API, utelukkende for å levere den ene lenken.
2. **En kortvarig informasjonskapsel beskytter omdirigeringen.** Dette er den ene informasjonskapselen
   hele Lolly-systemet setter: `lolly_ca_state`, `HttpOnly`, avgrenset til `/api/ca`,
   utløper innen ti minutter. Den bærer en tilfeldig verdi, ikke en spor-
   identifikator, og finnes kun for å hindre at OAuth-omdirigeringen forfalskes. Den
   fjernes så snart innloggingen er fullført.
3. **IP-adressen din brukes, kortvarig, for å forhindre misbruk** av innloggings-
   endepunktene (slik at ett skript ikke kan spamme en innboks eller tømme e-postkvoten) - holdt
   kun i serverminnet, i et glidende vindu på rundt ett minutt, aldri skrevet
   til en logg eller lagret noe sted.
4. **Sertifikattjenesten utsteder et kortvarig sertifikat** (7, 30, 90 eller 365
   dager, ditt valg, begrenset av operatørens policy) som binder den verifiserte
   e-posten din til den offentlige halvdelen av nøkkelparet generert på enheten din. Den private
   halvdelen forlater aldri nettleseren din.
5. **Ingenting om utstedelsen registreres.** Sertifikattjenesten fører ingen
   utstedelseslogg: ikke e-posten din, ikke leverandøren, ikke et serienummer, ikke et
   tidsstempel. Ingen database, ingen loggelinje, ingen webhook. E-postadressen din finnes i
   forespørselen kun lenge nok til å bli skrevet inn i sertifikatet enheten din
   mottar, og deretter er den helt borte fra vår side.
6. **Etter det er signering offline igjen** for hele sertifikatets levetid.
   Å eksportere en fil kontakter aldri sertifikattjenesten - det gjorde bare registreringen.

**Avveiningen, sagt rett ut.** En tidligere versjon av denne tjenesten loggførte hver
utstedelse, slik at et feilutstedt eller kompromittert sertifikat kunne spores. Vi
fjernet det, fordi den loggen var det eneste stedet i hele Lolly der personopplysninger
kom til hvile på en server, og vi vil heller ikke holde dem enn å holde dem
forsiktig. Det vi gir opp er server-side sporbarhet: hvis et sertifikat
misbrukes, kan vi ikke slå opp hvem som fikk det. Sertifikater er kortvarige av
design - 7 til 365 dager, ditt valg, begrenset av operatøren - og utløper av seg
selv, noe som er avbøtningen vi baserer oss på i stedet. Selvhostere hvis egne
forpliktelser krever en revisjonslogg, kan legge til én, og blir dermed
behandlingsansvarlig for de dataene.

## Nettleserutvidelsen

Nettleserutvidelsen **Lolly URL Screenshot** samler ikke inn, lagrer eller
overfører noen personopplysninger. Ingen analyse, ingen sporing, ingen ekstern server.

**Hva den gjør.** Når du ber Lolly-webappen om å ta skjermbilde av en URL, åpner
utvidelsen den siden i en midlertidig bakgrunnsfane, fanger den i nettleseren din
ved hjelp av DevTools Protocol, gir bildet tilbake til appen og lukker
fanen. Alt skjer lokalt, på din egen enhet og ditt eget nettverk.

**Data.**

- <!--i:shieldcheck--> **Vi samler ikke inn noe.** Utvidelsen har ingen servere og gjør ingen nettverks-
  forespørsler på egen hånd.
- <!--i:photos--> **Bilder som fanges** går rett til Lolly-appen i samme nettleser - blir aldri
  lastet opp av utvidelsen.
- <!--i:link--> **URL-ene du fanger** brukes kun til å laste den ene siden for det ene
  skjermbildet. De blir ikke logget eller delt.

**Tillatelser.**

- <!--i:wrench--> **`debugger`** - for å fange den rendrede siden via DevTools Protocol (den
  samme mekanismen Lolly desktop-appen bruker).
- <!--i:monitor--> **`tabs`** - for å åpne og lukke den midlertidige fanen siden lastes i.
- <!--i:globe--> **Vertstilgang (`<all_urls>`)** - fordi siden du velger å fange, kan være
  på hvilket som helst nettsted. Chrome viser dette ved installasjon som en bred tillatelses-
  advarsel. Utvidelsen besøker aldri noe annet enn URL-en du gir den.

Ingen av disse brukes til å lese, overvåke eller overføre nettleseraktiviteten din utover den
ene forespurte fangsten.

## Infrastrukturlogger

Som ethvert nettsted genererer serverne bak lolly.tools - og bak enhver Lolly-
utrulling - standard tilgangslogger for webserver når en forespørsel i det hele tatt når
dem: IP-adresse, forespurt bane, tidsstempel, brukeragent. Det er grunnleggende
vertsatferd, ikke noe Lolly legger til på toppen, og det inneholder aldri
innholdet i dokumentene dine, fordi de aldri når en server i utgangspunktet. Det
ene bevisste unntaket er en fil du eksplisitt gir til et MCP-kall
`lolly_transform`, `lolly_verify` eller `lolly_redact`, som behandles i minnet og aldri
skrives til disk eller en logg, som beskrevet ovenfor.

**Lollys egen kode skriver ingenting til de loggene.** MCP-serveren inneholder ingen
loggeuttrykk i det hele tatt. Sertifikattjenesten skriver ut nøyaktig to linjer, begge
ved feil og begge bevisst strippet: en statuskode for sendefeil uten
mottakeradresse, og en feilmelding uten stack-spor eller URL (et stack-spor kunne
bære et registreringstoken). Alt annet i loggen tilhører vertsplattformen,
ikke oss.

For lolly.tools er vertsleverandøren Vercel, og oppbevaring av tilgangslogger følger Vercels egne
plattformstandarder for vårt abonnement. Vi konfigurerer ingen loggavløp, ingen langtids-
logg-eksport og ingen analyse- eller overvåkingsprodukt på toppen. Vi beholder ingen kopi av disse
loggene selv, noe som også betyr at vi ikke har noen måte å søke i dem for deg - se
[Dine rettigheter](#your-rights).

## Rettslig grunnlag, lagringstid og mottakere

Nesten ingenting her trenger et rettslig grunnlag, fordi nesten ingenting behandles. For
fullstendighetens skyld, hele listen:

| Behandling | Rettslig grunnlag (GDPR art. 6) | Lagres i |
|---|---|---|
| Alt på enheten din (dokumenter, innstillinger, buffer, tellere) | **Ikke vår behandling i det hele tatt** - det når aldri oss. Lagring på enheten din er strengt nødvendig for tjenesten du har bedt om (ePrivacy art. 5(3)), så det krever ikke samtykke | Til du sletter det |
| E-postadressen din under registrering av Content Credentials | **Art. 6(1)(b)**, oppfyllelse av en tjeneste du eksplisitt har bedt om | Lagres ikke. Ligger i minnet kun så lenge forespørselen varer |
| IP-adressen din på innloggingsendepunktene, for hastighetsbegrensning | **Art. 6(1)(f)**, vår berettigede interesse i å forhindre misbruk av en gratis tjeneste og av en tredjeparts e-postkvote. Vi mener dette består en interesseavveining fordi det kun ligger i minnet, aldri skrives ned og forkastes innen omtrent ett minutt | ~1 minutt, i serverminne, aldri lagret permanent |
| Tilgangslogger for hosting (IP, sti, tidsstempel, brukeragent) | **Art. 6(1)(f)**, vår berettigede interesse i tjenestesikkerhet, misbruksforebygging og feilsøking | Vercels plattformstandard for vår plan. Vi legger ikke til noen ekstra uttrekk eller eksport |

**Mottakere.** Kategoriene av mottakere er: vår hostingleverandør (Vercel
Inc.), og - kun hvis du bruker innlogging via e-post - en transaksjonell
e-postleverandør (Resend). Hvis du logger inn med GitHub, Google eller SUSE (id.suse.com),
samhandler du direkte med den leverandøren under deres egen personvernerklæring. De
oppgir en verifisert e-postadresse til oss og ingenting annet. Vi deler ikke personopplysninger med noen
andre, og vi selger ikke data, driver ikke reklame eller profilerer brukere.

**Overføringer utenfor EØS.** Vercel og Resend er amerikanske selskaper. Funksjonsberegning
for lolly.tools er festet til Vercels Frankfurt-region (`fra1`), slik at
behandlingen skjer i EU, men som USA-baserte leverandører kan de likevel
få tilgang til data som databehandlere fra USA. Disse overføringene bygger på EU-kommisjonens
standard personvernbestemmelser og/eller EU-US Data Privacy
Framework, som fastsatt i hver leverandørs databehandleravtale. Fordi
personopplysningene som når hver av leverandørene er så begrensede - en e-postadresse videresendt
for å sende én melding, og ordinære tilgangslogger - er eksponeringen
tilsvarende liten.

**Automatisert beslutningstaking.** Ingen. Det er ingen profilering og ingen automatisert
beslutning som gir rettsvirkning eller tilsvarende betydelig effekt (art. 22).

## Barns personvern

Lolly samler ikke bevisst inn personopplysninger fra noen, uansett alder, i
vanlig bruk av appen - det er ingenting å samle inn. Det ene stedet
personopplysninger (en e-postadresse) noensinne samles inn er ved registrering av Content Credentials,
beskrevet ovenfor, som ikke er rettet mot eller ment for barn.

## Dine rettigheter

Fordi nesten alt Lolly berører kun lagres på din egen enhet, er det meste av
det personvernlovgivningen kaller «dine rettigheter» - innsyn, retting, sletting,
dataportabilitet - noe du allerede kan gjøre selv, umiddelbart, uten å spørre
noen: dataene dine ligger i nettleserens lagring, i en form du kan inspisere,
eksportere (**Export my data & render everything**, ovenfor) eller slette (**Profile → Clear all
my data**).

Formelt sett har du i henhold til GDPR artikkel 15-22 rett til **innsyn** i dine
personopplysninger, til å **rette** dem, til å **slette** dem, til å **begrense** eller **protestere
mot** behandlingen av dem (inkludert å protestere mot alt vi baserer på berettiget
interesse), til **dataportabilitet** og - der behandlingen bygger på samtykke - til å
**trekke tilbake samtykket når som helst**, uten at det påvirker lovligheten av det
som skjedde før du trakk det tilbake.

Her er den ærlige situasjonen når det gjelder å utøve dem overfor oss. Siden vi ikke lenger
fører en utstedelseslogg, **har vi ingen personopplysninger om deg som vi kan slå opp,
rette, eksportere eller slette.** Hvis du skriver og spør hva vi har om deg, er det
sanne svaret ingenting, og det vil vi si. Den eneste kategorien som i det hele tatt finnes er
tilgangslogger for hosting koblet til en IP-adresse, holdt av vår hostingleverandør
under deres standard lagringstid. Vi har ingen mulighet til å søke i eller selektivt
slette dem, og det vil vi fortelle deg fremfor å late som noe annet. Alt som faktisk er
*ditt* ligger på din egen enhet, hvor du allerede kan lese, eksportere
og slette det uten å spørre noen om lov.

**Du har rett til å klage.** Hvis du mener vi har behandlet dataene dine
feil, kan du sende en klage til en tilsynsmyndighet for personvern
- i EU, myndigheten i landet der du bor, arbeider
eller der du mener overtredelsen skjedde (art. 77). Vår ledende tilsynsmyndighet er
*Bayerisches Landesamt für Datenschutzaufsicht* (BayLDA) i
Ansbach, Tyskland. Du trenger ikke kontakte oss først, selv om vi gjerne vil ha
sjansen til å rette det opp.

Vi selger ikke data. Vi har ingen å selge.

## Endringer i denne erklæringen

Datoen øverst endres hver gang dette dokumentet gjør det. En endring som påvirker
hva som forlater enheten din eller hva som lagres, får sin egen linje her, ikke en stille
redigering - hvis du vil se hva som er endret, spør (nedenfor) eller sammenlign med
[den offentlige kildekoden](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md).

## Hvem er ansvarlig, og hvordan nå oss

**Behandlingsansvarlig** for lolly.tools er:

> SUSE Software Solutions Germany GmbH
> Frankenstraße 146
> 90461 Nürnberg
> Tyskland

SUSE har utnevnt et **personvernombud**, som kan nås på
[privacy@suse.com](mailto:privacy@suse.com). Bruk den adressen for enhver formell
forespørsel under «Dine rettigheter» ovenfor.

For alt om Lolly selv - hvordan det fungerer, hvorfor noe er som det er eller
en rettelse til dette dokumentet - kontakt **Andy Fitzsimon**,
[fitzy@suse.com](mailto:fitzy@suse.com).

For en selvhostet eller enterprise Lolly-instans, kontakt den som drifter den
istedenfor: operatøren er behandlingsansvarlig for sin egen driftssetting. SUSE og
Lolly-open source-prosjektet lagrer ingen data for driftssettinger de ikke selv driver.
