# Verifiser det selv

Lollys personvern- og sikkerhetssider kommer med påstander: ingen analyse, ingen sporing, filer forlater aldri enheten, én informasjonskapsel i hele systemet. Denne siden er annerledes: den ber deg ikke tro på noe av det. Det er en liste over prosedyrer, hver med den eksakte kommandoen eller klikkveien og resultatet du vil se. Hver påstand her er falsifiserbar på minutter, de fleste uten å installere noe.

Hvis en sjekk på denne siden ikke gir resultatet som vises, er det enten en feil eller et brutt løfte. [Meld det](#if-a-check-fails) uansett, så behandler vi det med den alvorlighetsgraden et brutt løfte fortjener.

## Se det fungere, på ti sekunder

Før prosedyrene, gevinsten. Åpne [`/verify`](/#/verify) og slipp en fil på den - ingen opplasting, ingen konto, ingen venting på en server. Her sjekker den det [genererte Queensland-uværet](/info/ai-stance.html) fra vår AI-holdning-side: et Gemini-bilde Lolly åpnet, endret størrelse på og eksporterte. Hvert merke under ble beregnet på enheten, ut fra filens egne bytes.

![Verify på en telefonbredde-skjerm - uværsbildet, en grønn Made with Lolly-dom og merkene for intakt legitimasjon og uendrede bytes stablet under den](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Dommen er ikke ett merke, men en liten haug av dem, hver et uavhengig faktum:

- <!--i:lock--> **Made with Lolly** - legitimasjonen er intakt *og* registrerer en Lolly-eksport.
- <!--i:seal--> **Legitimasjonen er intakt** - den signerte C2PA-manifesten parses og dens egen kravsignatur verifiseres.
- <!--i:hash--> **Bytene har ikke endret seg** - filens hash stemmer fortsatt med det som ble signert. Endre én piksel og dette merket snur.
- <!--i:sparkle--> **GEN AI** - en maskin laget disse pikslene, og filen sier det. Lolly leser den påstanden rett ut i stedet for å skjule den.

Og hele historikken følger med filen. Ni steg overlever her - fem Google registrerte mens den genererte og vannmerket bildet, deretter fire Lolly registrerte mens den åpnet, merket og konverterte kopien på denne siden - lest rett ut av bytene, på din enhet, og gjengitt som en tidslinje. Dette er samme bilde, verifisert på samme måte, som C2PA-tidslinjen på [AI-holdning-siden](/info/ai-stance.html).

![Endringshistorikken Verify leser ut av uværsbildet - fem steg registrert av Google, deretter fire av Lolly, som ender i WebP-en på denne siden](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Ingenting av dette er tillitspåstanden, likevel - det er demoen. Resten av denne siden er tillitspåstanden: hvert merke ovenfor er reproduserbart, og her er hvordan du reproduserer garantiene bak dem.

## I nettleseren din, ingen verktøy nødvendig

**1. Se på nettverket.** Åpne [lolly.tools](https://lolly.tools), åpne nettleserens DevTools (F12), bytt til fanen **Network** og bruk et verktøy - skriv inn en URL i [QR Code](/t/qr-code), endre farger, eksporter en PNG. Hver forespørsel blir værende på `lolly.tools`: app-skallet, verktøyets egne filer, katalogressurser. Ingen analysevert, ingen CDN-beacon, ingen fonttjeneste, ingen «feilrapporterings»-endepunkt. Det du skriver inn i et verktøy dukker opp i **ingen forespørsel i det hele tatt** - rendring skjer lokalt.

De ærlige unntakene - alle er opt-in, brukerinitiert og synlige i samme Network-fane når det skjer: å legge til en **Google Font** i merkeredigeringen henter den ene fontfamilien fra Google, etter en samtykkedialog som forteller nøyaktig dette, én gang, før den første forespørselen; å klikke på en **ICC-trykkprofil**-forhåndsinnstilling henter den profilen fra ICCs offentlige register på color.org; å spille av den valgfrie innebygde **radioen** strømmer fra stasjonen; å skrive inn et sted i **Meeting Planner** slår opp stedet hos open-meteos geokodingstjeneste for koordinater og tidssone, én gang per by (svarene lagres på enheten din), og inndatafeltet bærer den opplysningen rett der du skriver; og **URL Screenshot** laster nødvendigvis inn URL-en du skrev inn - det er jobben dens, og du ser det skje. Et verktøy som erklærer en nettverkskapabilitet kan kun hente fra vertene manifestet dets tillater, og denne mekanismen er fail-closed; ingen verktøy som leveres i dag erklærer en slik kapabilitet, så den nettleserhåndhevede Content-Security-Policy-en er grensen som faktisk holder listen ovenfor til sine verter. [Personvernerklæringen](/info/privacy.html) har den kanoniske tabellen over alle disse; dens faste regel er at en nettverkskontakt som ikke står i den tabellen, ikke skjer.

**2. Trekk ut kontakten.** Last inn appen og åpne ett eller to verktøy, gå deretter offline - flymodus, eller DevTools → Network → Offline. Last inn på nytt. Galleriet og hvert verktøy du har åpnet fortsetter å fungere, inkludert rendring og eksport i formatene du har brukt - et verktøys filer og et formats koder blir bufret første gang du bruker dem, så kjør et verktøy én gang online før du tester det offline. Dette er den sterkeste enkeltsjekken på denne siden: programvare som ringer hjem, overlever ikke at ledningen blir kuttet.

**3. Tell informasjonskapslene.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Listen er tom - appen setter ingen informasjonskapsler. Eller lim inn `document.cookie` i konsollen: du får `""`. (Den ene informasjonskapselen i hele systemet, `lolly_ca_state`, lever i høyst ti minutter under en valgfri identitetsinnlogging - slettet i det øyeblikket innloggingen fullføres - er avgrenset til `/api/ca` og er `HttpOnly`: [personvernerklæringen](/info/privacy.html) beskriver den presist.)

**4. Les din egen lagring.** Samme Application-panel: alt Lolly oppbevarer kan inspiseres foran deg - et par dusin enkle `localStorage`-nøkler (tema, språk, sidefeltbredde, lyd- og visningsinnstillinger, pluss en bufret kopi av den offentlige verktøykatalog-indeksen), og dine egne dokumenter i IndexedDB. Hver verdi er en lesbar streng eller JSON - ingenting er obfuskert, ingenting er kodet for å hindre lesing. **Profile → Clear all my data** fjerner det; det gjør også å slette nettstedsdata i nettleseren, fordi det ikke finnes noen serverside-kopi som overlever det.

**5. Sjekk at varslingskontakten finnes.** [`/.well-known/security.txt`](/.well-known/security.txt) svarer med en [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116)-kontaktblokk, ikke en HTML-side.

## Fra en terminal

**6. Rendringsendepunktet svarer bare med offentlige data.** Den ene serverfunksjonen som legger brukerinntastede data inn i en URL - hot-link-rendringer - er aktiv her, og [personvernerklæringen](/info/privacy.html) forklarer hva det betyr for inndataene du legger i en lenke:

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Bryteren er per utrulling (`LOLLY_DISABLE_RENDER_GET=1`): på en instans som setter den, returnerer den samme testen `404` - denne forskjellen er flagget som virker, ikke en inkonsistens.

**7. Serveroverflaten kan telles opp.** [Server Surface](/info/server-surface.html) lister hver serverside-rute som finnes, med den faste regelen at et endepunkt som ikke står på den siden, ikke er en del av Lolly. `curl` dem; det finnes ikke noe annet å finne.

## I kildekoden

Alt ovenfor kunne fortsatt vært skuespill hvis den utrullede koden var forskjellig fra den offentlige koden. Så sjekk koden - utrullingen bygges fra [det offentlige repositoriet](https://github.com/lolly-tools/lolly):

```bash
git clone --recurse-submodules https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Ingen sporer, ingen analyse-SDK, noe sted.** Søk i koden som leveres - motoren, hvert skall (inkludert nettleserutvidelsen, Tauri-broovertakelsene og service workeren), serverfunksjonene og verktøypakkene - etter de vanlige mistenkte:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

**9. Ingen tredjeparts DNS-oppslagstjener.** Verifys SEAL-sjekk ruter aldri oppslag gjennom en DNS-over-HTTPS-leverandør - webappen har rett og slett ingen oppslagstjener:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Sertifikattjenesten beholder ingenting.** Identitets-CA-en har ingen utstedelseslogg - ikke e-posten din, ikke et tidsstempel, ikke en webhook. Fraværet kan søkes opp med grep:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

## Håndhevet av tester, ikke løfter

De tre kildekodesjekkene ovenfor er ikke en engangsrevisjon - de er festet i testsuiten, så de ikke kan råtne stille. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) feiler bygget hvis:

- en analyse- eller sporings-SDK dukker opp hvor som helst i den leverte kildekoden den skanner - app, motor, server, utvidelse og verktøypakke-kode likt,
- en tredjeparts DNS-over-HTTPS-oppslagstjener dukker opp i den kildekoden,
- CA-utstedelsesloggen kommer tilbake - i kildekoden **eller** den genererte serverbunten,
- personvernerklæringen mister sine lovpålagte utsagn (navngitt behandlingsansvarlig, rettslig grunnlag, klagerett).

Kjør dem selv i klonen (Node 22.18+; ingen `npm install` nødvendig for denne filen):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Den fullstendige suiten (`npm install && npm test`) kjører flere tusen til, inkludert de adversarielle kryptografitestene beskrevet i [Sikkerhet og verifisering](/info/security.html).

## Det du ikke kan verifisere utenfra - sagt rett ut

En side som dette bygger tillit ved å navngi sine egne begrensninger:

- **Hostingens tilgangslogger.** Enhver server som svarer på en forespørsel kan logge forespørselen - IP, sti, tidsstempel. Du kan ikke verifisere hva en vert beholder eller ikke beholder, og det kan heller ikke vi, utover leverandørens dokumenterte oppførsel. Det er nettopp derfor arkitekturen holder innholdet ditt helt av kabelen: det som aldri forlater enheten din, kan ikke logges av noen.
- **At utrullingen kjører denne koden.** Du kan verifisere at kildekoden er ren og at den utrullede oppførselen samsvarer med den (sjekkene ovenfor dekker begge endene), men attestering på binærnivå av en webutrulling er ikke noe webplattformen tilbyr. Mottiltakene er det offentlige repositoriet, de håndhevede testene og offline-sjekken - en manipulert utrulling som ringer hjem, feiler sjekk 1 og 2 umiddelbart.
- **Verktøykroker er ikke sandkassebasert som standard.** Et verktøys valgfrie logikk kjører gjennomgått, i sidens eget realm; hvert verktøy på lolly.tools er førstepart og gjennomgått før det leveres. Worker-isolasjon leveres nå som en per-verktøy opt-in - et verktøy hvis manifest setter `isolate: true` kjører i stedet krokene sine utenfor tråden - så det du ikke kan verifisere utenfra blir stadig snevrere, men standardveien er fortsatt in-realm og gjennomgang er fortsatt kontrollen. Dette er uttalt, ikke skjult - se [designgrenser](/info/security.html)-delen, som alltid har sagt dette.

## Hvis en sjekk feiler

Et avvik mellom denne siden og observert oppførsel er en sikkerhetsrapport, og vi vil oppriktig heller høre om det enn ikke: [fitzy+security@suse.com](mailto:fitzy+security@suse.com), knappen **Report a vulnerability** på et hvilket som helst [lolly-tools-repositorium](https://github.com/lolly-tools) eller kontakten i [`/.well-known/security.txt`](/.well-known/security.txt). Koordinert varsling og kreditering av rapportøren er den faste policyen - [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md) har detaljene.
