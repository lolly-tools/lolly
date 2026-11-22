# Verifiser selv

Alle løfter på dette nettstedet kan sjekkes, uten konto. De fleste sjekker trenger bare en nettleser; resten trenger en terminal og en kopi av kildekoden. Hvis en sjekk nedenfor ikke gir resultatet som vises, er det en feil eller et brutt løfte, og vi vil vite om det: se [Hvis en sjekk mislykkes](#if-a-check-fails).

Disse sjekkene dekker Lolly alene. Hvis organisasjonen din kjører Lolly Work, legger det til innlogging, delt innhold, konfigurert telemetri og revisjonsposter; sjekk disse mot [Serverflaten](/info/server-surface.html) og [organisasjonsdelen av personvernerklæringen](/info/privacy.html#organisation-services-with-lolly-work).

<!--i:eti-clock-->
## Se det fungere på ti sekunder

Åpne [`/verify`](/#/verify) og slipp en fil på siden. Ingen opplasting, ingen konto og ingen venting på en server. Her sjekker den [den genererte stormen i Queensland](/info/ai-stance.html) fra Vårt syn på AI: et bilde Gemini genererte, som Lolly åpnet, merket og konverterte. Hvert merke ble beregnet på enheten, fra filens egne byte.

![Lolly Verify på en skjerm med telefonbredde - stormbildet, en grønn Made with Lolly-vurdering og merkene for intakte legitimasjonsdata og uendrede byte stablet under](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Vurderingen er en liten stabel med merker, hvert av dem et uavhengig faktum:

- <!--i:lock--> **Made with Lolly**: legitimasjonsdataene er intakte *og* registrerer en Lolly-eksport.
- <!--i:seal--> **The credential is intact**: det signerte C2PA-manifestet kan tolkes, og signaturen til dets egen påstand verifiseres.
- <!--i:hash--> **The bytes have not changed**: filens hash samsvarer fortsatt med det som ble signert. Endre én piksel, så snur dette merket.
- <!--i:sparkle--> **GEN AI**: en maskin laget disse pikslene, og filen sier det. Lolly leser erklæringen ut igjen i stedet for å skjule det.

Hele historikken følger med filen. Ni trinn er bevart her: fem Google registrerte da det genererte og vannmerket bildet, så fire Lolly registrerte da det åpnet, merket og konverterte kopien på denne siden. Lolly Verify leser dem rett ut av bytene og tegner dem som en tidslinje.

![Endringshistorikken Lolly Verify leser ut igjen fra stormbildet - fem trinn registrert av Google, så fire av Lolly, med WebP-en på denne siden til slutt](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Sjekkene nedenfor er garantiene bak denne demonstrasjonen, og hver av dem kan gjentas. [Content Credentials](/info/content-credentials-identity.html) forklarer hver vurdering.

<!--i:eti-globe-->
## I nettleseren, uten verktøy

::: timeline
- <!--i:globe--> **1. Følg med på nettverket.** Åpne [lolly.tools](https://lolly.tools), åpne nettleserens DevTools (F12), bytt til **Network** og bruk et verktøy: skriv en nettadresse i [Lolly QR Code](/t/qr-code), endre farger, eksporter en PNG. Hver forespørsel går til `lolly.tools`: appskallet, verktøyets egne filer og katalogressurser. Det finnes ingen analysevert, intet CDN-sporingssignal, ingen skrifttjeneste og intet endepunkt for feilrapportering. Det du skriver i et verktøy, vises **ikke i noen forespørsel**, fordi gjengivelsen skjer lokalt.
- <!--i:eyeoff--> **2. Trekk ut kontakten.** Last inn appen og åpne et verktøy eller to, gå så uten nett (flymodus, eller DevTools → Network → Offline) og last på nytt. Galleriet og hvert verktøy du åpnet, fortsetter å fungere, også gjengivelse og eksport i formatene du brukte. Verktøyets filer og formatets koder bufres første gang du bruker dem, så bruk et verktøy én gang på nettet før du tester det uten nett. Dette er den sterkeste enkeltsjekken på siden: programvare som ringer hjem, overlever ikke at ledningen kuttes.
- <!--i:check--> **3. Tell informasjonskapslene.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Listen er tom: appen setter ingen informasjonskapsler. Lim inn `document.cookie` i konsollen, så får du `""`. Den valgfrie CA-registreringen setter en kortvarig `HttpOnly`-informasjonskapsel, `lolly_ca_state`, avgrenset til `/api/ca`, som `document.cookie` ikke kan vise. En Lolly Work-instans bruker sine egne innloggingskapsler; sammenlign dem med [Personvern](/info/privacy.html#organisation-services-with-lolly-work).
- <!--i:layers--> **4. Les din egen lagring.** I samme panel ligger alt Lolly beholder, foran deg: et par dusin vanlige `localStorage`-nøkler (tema, språk, sidefeltbredde, lyd- og visningsinnstillinger og en bufret kopi av den offentlige verktøykatalogindeksen) og dine egne dokumenter i IndexedDB. Hver verdi er en lesbar streng eller JSON, uten noe tilslørt. Tømming av nettstedsdata fjerner disse lokale postene, men ikke en Sync-sikkerhetskopi eller poster lagret av en Lolly Work-instans. **Settings → Storage → Clear all my data** gjør det samme fra appen, og du kan se lagrene og bufferne tømmes.
- <!--i:lock--> **5. Sjekk at kontakten for sårbarhetsrapportering finnes.** [`/.well-known/security.txt`](/.well-known/security.txt) svarer med en [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116)-kontaktblokk, ikke en HTML-side.
:::

::: details Hva annet du kan se i Network-fanen
Noen funksjoner bruker bare nettverket når du bruker dem, og hver av dem er synlig i samme fane:

- å legge til en **Google Font** i Lolly Design System Setup henter den ene skriftfamilien fra Google, etter en samtykkedialog som sier fra om det, én gang, før første henting;
- å klikke på en **forhåndsinnstilt ICC-trykkprofil** henter profilen fra ICCs offentlige register på color.org;
- å spille av den valgfrie innebygde **radioen** strømmer fra stasjonen;
- å oppgi et sted i **Meeting Planner** slår opp stedet hos geokodingstjenesten til open-meteo for å finne koordinater og tidssone, én gang per by (svarene lagres på enheten din), og feltet sier fra der du skriver;
- **Lolly URL Screenshot** laster adressen du skrev inn, og du ser det skje.

Et verktøy som erklærer en nettverkskapabilitet, kan bare hente fra verter manifestet tillater, og sjekken blokkerer ved feil. Ingen verktøy som leveres i dag, erklærer en slik kapabilitet, så Content-Security-Policy som nettleseren håndhever, begrenser listen ovenfor til sine verter. [Personvernerklæringen](/info/privacy.html) har den autoritative tabellen over alle disse, inkludert trafikk fra administrerte instanser, som policyoppdateringer og aktivert rapportering.
:::

<!--i:eti-code-->
## Fra en terminal

**6. Gjengivelsesendepunktet svarer bare med offentlige data.** Den ene serverfunksjonen som legger skrevne inndata i en URL, gjengivelse via direktelenker, er aktiv her. [Personvernerklæringen](/info/privacy.html) sier hva det betyr for inndataene du legger i en lenke.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Hver installasjon velger (`LOLLY_DISABLE_RENDER_GET=1`): på en instans som setter variabelen, returnerer samme probe `404`. Forskjellen viser at innstillingen virker, ikke at noe er inkonsekvent.

**7. Sjekk tjenestene installasjonen din aktiverer.** [Serverflaten](/info/server-surface.html) lister de valgfrie tjenestene og lenker til detaljerte referanser. For Lolly Work tar du med de autentiserte API-ene, samarbeidstilkoblingen, lagringen og konfigurerte leverandører. En probe mot offentlige lolly.tools tester ikke en privat organisasjonsinstans.

Hvis du kjører din egen instans, har [Leveringsinstallasjon](/info/deploy-delivery.html) utgivelsessjekkene: modellintegritet, edge-proben og eksempellisten dens, visningsversjoner, den private nedlastingsporten og den signerte katalogen i en nettleser.


<!--i:eti-search-->
## I kildekoden

Alt ovenfor kunne fortsatt vært et skuespill hvis koden i drift var forskjellig fra den offentlige koden. Så sjekk koden. Installasjonen bygges fra [det offentlige kodelageret](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Ingen sporere og ingen analyse-SDK-er, noe sted.** Søk i koden som leveres (motoren, alle skall inkludert nettleserutvidelsen, Tauri-broens overstyringer og service workeren, serverfunksjonene og verktøypakkene) etter de vanlige mistenkte:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

Denne skanningen ser etter tredjeparts sporings-SDK-er. Den viser ikke fravær av førsteparts bruksrapportering: Lolly Work støtter organisasjonstelemetri og en separat revisjonslogg, med egen policy og egne tester.

**9. Ingen tredjeparts DNS-resolver.** SEAL-sjekken i Lolly Verify sender aldri et oppslag gjennom en DNS-over-HTTPS-leverandør, fordi appen ikke har noen resolver:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Sertifikattjenesten fører ingen utstedelseslogg.** Identitets-CA-en fører ingen logg over det den har utstedt og ingen oversikt over identiteter: ingen stdout-linje, ingen webhook, intet sertifikatlager. Du kan søke etter fraværet:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

CA-en beholder kortvarig arbeidstilstand: bøtter for frekvensbegrensning lagrer hashede IP- og e-postnøkler i tidsvinduet sitt, og opptakslageret til en administrert installasjon beholder en nøkkelbasert identifikator og forespørselshash i høyst ti minutter. [Teknikken bak Content Credentials](/info/content-credentials-engineering.html#protocol) har detaljene.

<!--i:eti-flask-->
## Håndhevet av tester

Kildekodesjekkene ovenfor er ingen engangsrevisjon: de er fastlagt i testsamlingen, så de ikke kan forfalle i det stille. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) sjekker en lengre liste over sporernavn enn skanningen ovenfor og lar byggingen feile hvis:

- en analyse- eller sporings-SDK dukker opp noe sted i den leverte kildekoden den skanner, på tvers av kode for app, motor, server, utvidelse og verktøypakker;
- en tredjeparts DNS-over-HTTPS-resolver dukker opp i den kildekoden;
- CA-ens utstedelseslogg kommer tilbake, i kildekoden **eller** den genererte serverpakken;
- personvernerklæringen mister sine lovpålagte opplysninger (navngitt behandlingsansvarlig, rettslig grunnlag, rett til å klage).

Kjør dem selv i den klonede kopien (Node 22.18 eller nyere; denne filen trenger ikke `pnpm install`):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Hele testsamlingen (`pnpm install && pnpm test`) kjører flere tusen til, inkludert kryptografitestene mot angrep som er beskrevet i [Sikkerhet & verifisering](/info/security.html).

<!--i:eti-eye-off-->
## Hva du ikke kan verifisere utenfra

- **Tilgangslogger hos verten.** Alle servere kan logge forespørslene de svarer på: IP-adresse, bane og tidspunkt. En ekstern probe kan ikke fastslå hvor lenge logger beholdes. Driftsansvarlig styrer logging, rotasjon og eksport og må opplyse om disse valgene. Lokal gjengivelse holder vanlige redigeringer på enheten din; valgfri servergjengivelse og delte arbeidsområdetjenester har de separate dataflytene personvernerklæringen beskriver.
- **At installasjonen kjører denne koden.** Du kan sjekke at kildekoden er ren og at atferden i drift samsvarer med kildekoden, og sjekkene ovenfor gjør begge deler. Nettplattformen tilbyr ikke attestering på binærnivå av en nettinstallasjon. Risikoreduserende tiltak er det offentlige kodelageret, de pålagte testene og sjekken uten nett: en manipulert installasjon som ringer hjem, feiler sjekk 1 og 2 med én gang.
- **Verktøyhooks.** Den valgfrie logikken til et innebygd verktøy gjennomgås i stedet for å isoleres i en sandkasse: den kjører i siden med mindre verktøyet velger en Worker. Alle verktøy på lolly.tools er førstepartsverktøy og gjennomgås før de leveres. [Trusselmodellen](/info/threat-model.html#trust-boundaries) beskriver hvor hooks kjører og hva som begrenser dem.

<!--i:eti-warning-->
## Hvis en sjekk mislykkes

Et avvik mellom denne siden og det du observerer, er en sikkerhetsrapport. Send den gjennom de private kanalene på [Sikkerhet & verifisering](/info/security.html#reporting-a-vulnerability). Vi praktiserer koordinert offentliggjøring og krediterer dem som rapporterer.
