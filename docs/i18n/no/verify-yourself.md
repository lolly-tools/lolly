# Verifiser det selv

Hvert løfte på dette nettstedet kan sjekkes, uten konto. De fleste kontroller trenger bare en nettleser; resten trenger en terminal og en kopi av kildekoden. Hvis en kontroll nedenfor ikke gir resultatet som vises, er det en feil eller et brutt løfte, og vi vil høre om det: se [If a check fails](#if-a-check-fails).

Start med den raskeste: slipp en fil på Verify. Gå deretter lenger: følg nettverket mens du bruker et verktøy, trekk ut kontakten og fortsett å arbeide, tell informasjonskapslene og les kildekoden.

Disse kontrollene dekker Lolly alene. Hvis organisasjonen din kjører Lolly Work, legger det til pålogging, delt innhold, konfigurert telemetri og revisjonsposter; sjekk disse mot [Server Surface](/info/server-surface.html) og [organisasjonsdelen av personvernerklæringen](/info/privacy.html#organisation-services-with-lolly-work).

## Se det fungere, på ti sekunder

Åpne [`/verify`](/#/verify) og slipp en fil på siden. Det er ingen opplasting, ingen konto og ingen venting på en server. Her sjekker den [generated Queensland storm](/info/ai-stance.html) fra Our AI Stance: et bilde Gemini genererte, som Lolly åpnet, merket og konverterte. Hvert merke ble regnet ut på enheten, fra filens egne bytes.

![Verify på en telefonbredde-skjerm - uværsbildet, en grønn Made with Lolly-dom og merkene for intakt legitimasjon og uendrede bytes stablet under den](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Dommen er en liten haug med merker, hvert et uavhengig faktum:

- <!--i:lock--> **Made with Lolly**: credentialen er intakt *og* registrerer en Lolly-eksport.
- <!--i:seal--> **The credential is intact**: det signerte C2PA-manifestet tolkes og dets egen påstandssignatur verifiseres.
- <!--i:hash--> **The bytes have not changed**: filens hash samsvarer fortsatt med det som ble signert. Endre én piksel, så snur dette merket.
- <!--i:sparkle--> **GEN AI**: en maskin laget disse pikslene, og filen sier det. Lolly leser den erklæringen tilbake i stedet for å skjule faktum.

Hele historikken følger med filen. Ni trinn overlever her: fem Google registrerte da det genererte og vannmerket bildet, og deretter fire Lolly registrerte da det åpnet, merket og konverterte kopien på denne siden. Verify leser dem rett ut av bytene og tegner dem som en tidslinje.

![Endringshistorikken Verify leser ut av uværsbildet - fem steg registrert av Google, deretter fire av Lolly, som ender i WebP-en på denne siden](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Det er demoen. Kontrollene nedenfor er garantiene under den, og hver av dem kan gjentas. [Content Credentials](/info/content-credentials-identity.html) forklarer hver dom.

## I nettleseren din, ingen verktøy nødvendig

::: timeline
- <!--i:globe--> **1. Følg nettverket.** Åpne [lolly.tools](https://lolly.tools), åpne nettleserens DevTools (F12), bytt til **Network** og bruk et verktøy: skriv en nettadresse inn i [QR Code](/t/qr-code), endre farger, eksporter en PNG. Hver forespørsel blir på `lolly.tools`: appskallet, verktøyets egne filer og katalogressurser. Det er ingen analysevert, ingen CDN-signal, ingen skrifttjeneste og ingen endepunkt for feilrapportering. Det du skriver i et verktøy, vises i **ingen forespørsel i det hele tatt**, fordi gjengivelsen er lokal.
- <!--i:eyeoff--> **2. Trekk ut kontakten.** Last appen og åpne et verktøy eller to, gå deretter offline (flymodus, eller DevTools → Network → Offline) og last på nytt. Galleriet og hvert verktøy du åpnet, fortsetter å fungere, inkludert gjengivelse og eksport i formatene du brukte. Et verktøys filer og et formats koder bufres første gang du bruker dem, så bruk et verktøy én gang online før du tester det offline. Dette er den sterkeste enkeltkontrollen på denne siden: programvare som ringer hjem, overlever ikke at ledningen kuttes.
- <!--i:check--> **3. Tell informasjonskapslene.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Listen er tom: appen setter ingen informasjonskapsler. Lim `document.cookie` inn i konsollen, så får du `""`. Den valgfrie CA-registreringen setter en kortlevd `HttpOnly`-informasjonskapsel, `lolly_ca_state`, avgrenset til `/api/ca`, som `document.cookie` ikke kan vise. En Lolly Work-instans bruker sine egne påloggingsinformasjonskapsler; sammenlign dem med [Privacy](/info/privacy.html#organisation-services-with-lolly-work).
- <!--i:layers--> **4. Les din egen lagring.** I det samme panelet ligger alt Lolly beholder foran deg: et par dusin vanlige `localStorage`-nøkler (tema, språk, sidefeltbredde, lyd- og visningsinnstillinger, og en bufret kopi av den offentlige verktøykatalogindeksen) og dine egne dokumenter i IndexedDB. Hver verdi er en lesbar streng eller JSON, uten noe tilslørt. Å tømme nettstedsdata fjerner disse lokale postene, men ikke en Sync-sikkerhetskopi eller poster holdt av en Lolly Work-instans. **Settings → Storage → Clear all my data** gjør det samme fra inne i appen, og du kan se lagrene og bufferne tømmes.
- <!--i:lock--> **5. Sjekk at kontakten for ansvarlig varsling finnes.** [`/.well-known/security.txt`](/.well-known/security.txt) svarer med en [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116)-kontaktblokk, ikke en HTML-side.
:::

::: details Hva annet du kan se i Network-fanen
Noen funksjoner når nettverket bare når du bruker dem, og hver er synlig i den samme fanen:

- å legge til en **Google Font** i Design System Setup henter den ene familien fra Google, etter en samtykkedialog som sier det, én gang, før den første hentingen;
- å klikke på en **ICC press-profile preset** henter den profilen fra ICCs offentlige register på color.org;
- å spille den valgfrie innebygde **radioen** strømmer fra stasjonen;
- å skrive inn et sted i **Meeting Planner** slår opp stedet hos open-meteos geokodingtjeneste for koordinatene og tidssonen, én gang per by (svarene lagres på enheten din), og feltet sier det der du skriver;
- **URL Screenshot** laster adressen du skrev, fordi det er jobben, og du ser det skje.

Et verktøy som deklarerer en nettverkskapabilitet, kan bare hente fra vertene manifestet tillater, og den kontrollen svikter trygt. Ingen verktøy som leveres i dag, deklarerer en, så den nettleserhåndhevede Content-Security-Policy er det som holder listen ovenfor til vertene sine. [Privacy policy](/info/privacy.html) har den kanoniske tabellen over alle disse, inkludert trafikk på administrerte instanser som policyoppdateringer og aktivert rapportering.
:::

## Fra en terminal

**6. Gjengivelsesendepunktet svarer bare med offentlige data.** Den ene serverfunksjonen som legger skrevne inndata inn i en URL, hot-link-gjengivelser, er live her. [Privacy policy](/info/privacy.html) sier hva det betyr for inndataene du legger i en lenke.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Hver installasjon velger selv (`LOLLY_DISABLE_RENDER_GET=1`): på en instans som setter den, returnerer den samme sonden `404`. Den forskjellen er innstillingen i arbeid, ikke en inkonsistens.

**7. Sjekk tjenestene installasjonen din slår på.** [Server Surface](/info/server-surface.html) lister de valgfrie tjenestene og lenker til de detaljerte referansene deres. For Lolly Work, ta med dets autentiserte API-er, samarbeidstilkobling, lagring og konfigurerte leverandører. En sonde mot den offentlige lolly.tools tester ikke en privat organisasjonsinstans.

Hvis du kjører din egen instans, har [Delivery deployment](/info/deploy-delivery.html) utgivelseskontrollene for den: modellintegritet, kantsonden og eksempellisten dens, visningsvarianter, den private nedlastingsgatewayen og den signerte katalogen i en nettleser.


## I kildekoden

Alt det ovenstående kan fortsatt være teater hvis den utrullede koden avvek fra den offentlige koden. Så sjekk koden. Installasjonen bygges fra [det offentlige repositoriet](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Ingen sporer og ingen analyse-SDK, noe sted.** Søk i koden som leveres (motoren, hvert skall inkludert nettleserutvidelsen, Tauri-bro-overstyringene og tjenestearbeideren, serverfunksjonene og verktøypakkene) etter de vanlige mistenkte:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

Dette søket ser etter tredjeparts sporings-SDK-er. Det viser ikke fravær av førsteparts bruksrapportering: Lolly Work støtter organisasjonstelemetri og en separat revisjonslogg, med egen policy og egne tester.

**9. Ingen tredjeparts DNS-løser.** Verifys SEAL-sjekk sender aldri et oppslag gjennom en DNS-over-HTTPS-leverandør, fordi appen ikke har noen løser:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Sertifikattjenesten fører ingen utstedelseslogg.** Identitets-CA-en fører ingen logg over hva den utstedte og ingen oversikt over identiteter: ingen stdout-linje, ingen webhook, ingen sertifikatlagring. Fraværet kan søkes etter:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

CA-en beholder kortlevd arbeidstilstand: hastighetsbegrensningsspann holder hashede IP- og e-postnøkler i vinduet sitt, og en administrert installasjons opptakslagring holder en nøklet identifikator og et forespørselssammendrag i høyst ti minutter. [Content Credentials engineering](/info/content-credentials-engineering.html#protocol) har detaljene.

## Håndhevet av tester

Kildekontrollene ovenfor er ikke en engangsrevisjon: de er festet i testsuiten, så de ikke stille kan råtne. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) sjekker en lengre liste med sporernavn enn søket ovenfor og får bygget til å svikte hvis:

- noen analyse- eller sporings-SDK dukker opp hvor som helst i den leverte kildekoden den skanner, på tvers av app-, motor-, server-, utvidelses- og verktøypakkekode;
- noen tredjeparts DNS-over-HTTPS-løser dukker opp i den kilden;
- CA-utstedelsesloggen kommer tilbake, i kilden **eller** den genererte serverbundlen;
- personvernerklæringen mister sine lovpålagte erklæringer (navngitt behandlingsansvarlig, rettslig grunnlag, rett til å klage).

Kjør dem selv i klonen (Node 22.18 eller nyere; denne filen trenger ingen `pnpm install`):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Hele testsuiten (`pnpm install && pnpm test`) kjører flere tusen til, inkludert de adversarielle kryptografitestene beskrevet i [Sikkerhet og verifisering](/info/security.html).

## Hva du ikke kan verifisere utenfra

- **Tilgangslogger hos hostingtjenesten.** Enhver server som svarer på en forespørsel, kan logge den: IP-adresse, sti og tid. En ekstern sonde kan ikke fastslå hvor lenge logger beholdes. Driftsansvarlig styrer logging, rotasjon og eksporter, og må oppgi disse valgene. Lokal gjengivelse holder vanlige redigeringer på enheten din; valgfri servergjengivelse og delte arbeidsområdetjenester har de separate dataflytene personvernerklæringen beskriver.
- **At installasjonen kjører denne koden.** Du kan sjekke at kilden er ren og at den utrullede oppførselen samsvarer med den, og kontrollene ovenfor gjør begge deler. Attestering på binærnivå av en nettinstallasjon er ikke noe nettplattformen tilbyr. Avbøtingene er det offentlige repositoriet, de håndhevede testene og kontrollen uten nett: en manipulert installasjon som ringer hjem, svikter kontroll 1 og 2 umiddelbart.
- **Verktøyhooks.** Et innebygd verktøys valgfrie logikk er gjennomgått i stedet for sandkasset: den kjører på siden med mindre verktøyet velger en Worker. Hvert verktøy på lolly.tools er førsteparts og gjennomgått før det leveres. [Threat Model](/info/threat-model.html#trust-boundaries) beskriver hvor hooks kjører og hva som begrenser dem.

## Hvis en sjekk feiler

En forskjell mellom denne siden og det du observerer, er en sikkerhetsrapport. Send den gjennom de private kanalene på [Security & Verification](/info/security.html#reporting-a-vulnerability). Vi praktiserer koordinert avsløring og krediterer de som rapporterer.
