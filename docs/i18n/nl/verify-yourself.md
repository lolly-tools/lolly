# Verifieer het zelf

Elke belofte op deze site kan worden gecontroleerd, zonder account. De meeste controles hebben alleen een browser nodig; de rest heeft een terminal en een kopie van de broncode nodig. Als een controle hieronder niet het getoonde resultaat geeft, is dat een bug of een gebroken belofte, en willen we het horen: zie [Als een controle mislukt](#if-a-check-fails).

Begin met de snelste: zet een bestand op Verify. Ga dan verder: bekijk het netwerk terwijl je een tool gebruikt, trek de stekker eruit en blijf werken, tel de cookies en lees de broncode.

Deze controles gaan over Lolly op zichzelf. Als je organisatie Lolly Work draait, voegt dat aanmelden, gedeelde inhoud, geconfigureerde telemetrie en auditrecords toe; controleer die aan de hand van [Server Surface](/info/server-surface.html) en het [organisatiegedeelte van het privacybeleid](/info/privacy.html#organisation-services-with-lolly-work).

## Zie het werken, in tien seconden

Open [`/verify`](/#/verify) en zet een bestand op de pagina. Er is geen upload, geen account en geen wachten op een server. Hier controleert het de [gegenereerde storm in Queensland](/info/ai-stance.html) uit Our AI Stance: een afbeelding die Gemini genereerde, die Lolly opende, markeerde en omzette. Elke badge is op het apparaat bepaald, uit de eigen bytes van het bestand.

![Verify op een telefoonbreed scherm - de stormafbeelding, een groen Made with Lolly-oordeel en daaronder gestapeld de badges credential-intact en bytes-unchanged](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Het oordeel is een kleine stapel badges, elk een onafhankelijk feit:

- <!--i:lock--> **Made with Lolly**: de credential is intact *en* legt een Lolly-export vast.
- <!--i:seal--> **The credential is intact**: het ondertekende C2PA-manifest parseert en zijn eigen claimhandtekening verifieert.
- <!--i:hash--> **The bytes have not changed**: de hash van het bestand komt nog overeen met wat is ondertekend. Verander één pixel en deze badge kantelt.
- <!--i:sparkle--> **GEN AI**: een machine maakte deze pixels, en het bestand zegt dat. Lolly leest die verklaring terug in plaats van het feit te verbergen.

De hele geschiedenis reist met het bestand mee. Negen stappen overleven hier: vijf die Google vastlegde terwijl het de afbeelding genereerde en van een watermerk voorzag, en dan vier die Lolly vastlegde terwijl het de kopie op deze pagina opende, markeerde en omzette. Verify leest ze rechtstreeks uit de bytes en tekent ze als tijdlijn.

![De wijzigingsgeschiedenis die Verify teruggeleest uit de stormafbeelding - vijf stappen vastgelegd door Google, dan vier door Lolly, eindigend in de WebP op deze pagina](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Dat is de demo. De controles hieronder zijn de garanties eronder, en elk is reproduceerbaar. [Content Credentials](/info/content-credentials-identity.html) legt elk oordeel uit.

## In je browser, geen tools nodig

::: timeline
- <!--i:globe--> **1. Bekijk het netwerk.** Open [lolly.tools](https://lolly.tools), open de DevTools van je browser (F12), schakel over naar **Network** en gebruik een tool: typ een webadres in [QR Code](/t/qr-code), wijzig kleuren, exporteer een PNG. Elk verzoek blijft op `lolly.tools`: de appshell, de eigen bestanden van de tool en catalogusassets. Er is geen analyticshost, geen CDN-baken, geen lettertypedienst en geen eindpunt voor foutrapportage. Wat je in een tool typt verschijnt in **helemaal geen verzoek**, omdat het renderen lokaal is.
- <!--i:eyeoff--> **2. Trek de stekker eruit.** Laad de app en open een of twee tools, ga dan offline (vliegtuigmodus, of DevTools → Network → Offline) en herlaad. De galerij en elke tool die je opende blijven werken, inclusief renderen en exporteren in de formaten die je gebruikte. De bestanden van een tool en de encoder van een formaat worden de eerste keer dat je ze gebruikt in de cache gezet, dus gebruik een tool één keer online voordat je hem offline test. Dit is de sterkste afzonderlijke controle op deze pagina: software die naar huis belt overleeft het doorknippen van haar snoer niet.
- <!--i:check--> **3. Tel de cookies.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. De lijst is leeg: de app plaatst geen cookies. Plak `document.cookie` in de console en je krijgt `""`. De optionele CA-inschrijving plaatst een kortlevende `HttpOnly`-cookie, `lolly_ca_state`, beperkt tot `/api/ca`, die `document.cookie` niet kan tonen. Een Lolly Work-instantie gebruikt haar eigen aanmeldcookies; vergelijk ze met [Privacy](/info/privacy.html#organisation-services-with-lolly-work).
- <!--i:layers--> **4. Lees je eigen opslag.** In hetzelfde paneel ligt alles wat Lolly bewaart voor je: een paar dozijn gewone `localStorage`-sleutels (thema, taal, zijbalkbreedte, geluids- en weergave-instellingen en een gecachte kopie van de openbare toolcatalogusindex) en je eigen documenten in IndexedDB. Elke waarde is een leesbare string of JSON, niets is versluierd. Sitegegevens wissen verwijdert deze lokale records, maar niet een Sync-back-up of records die een Lolly Work-instantie bewaart. **Settings → Storage → Clear all my data** doet hetzelfde vanuit de app, en je kunt de opslag en caches zien leeglopen.
- <!--i:lock--> **5. Controleer of het contact voor meldingen bestaat.** [`/.well-known/security.txt`](/.well-known/security.txt) antwoordt met een contactblok volgens [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), niet met een HTML-pagina.
:::

::: details Wat je nog meer kunt zien op het tabblad Network
Sommige functies bereiken het netwerk alleen wanneer je ze gebruikt, en elk is zichtbaar op hetzelfde tabblad:

- een **Google Font** toevoegen in Design System Setup haalt die ene familie bij Google op, na een toestemmingsdialoog die dat zegt, één keer, vóór de eerste ophaalactie;
- klikken op een **ICC-persprofielpreset** haalt dat profiel op uit het openbare register van het ICC op color.org;
- het afspelen van de optionele ingebouwde **radio** streamt vanaf het station;
- een locatie invoeren in **Meeting Planner** zoekt die plaats op bij de geocoderingsdienst van open-meteo voor de coördinaten en tijdzone, één keer per stad (antwoorden worden op je apparaat opgeslagen), en het veld zegt dat waar je typt;
- **URL Screenshot** laadt het adres dat je typte, omdat dat zijn taak is, en je ziet het gebeuren.

Een tool die een netwerkcapability declareert, mag alleen ophalen bij de hosts die zijn manifest op de toegestane lijst zet, en die controle faalt veilig. Geen enkele tool die vandaag wordt geleverd declareert er een, dus de door de browser afgedwongen Content-Security-Policy houdt de lijst hierboven bij haar hosts. Het [privacybeleid](/info/privacy.html) bevat de canonieke tabel van dit alles, inclusief verkeer van beheerde instanties zoals beleidsverversingen en ingeschakelde rapportage.
:::

## Vanuit een terminal

**6. Het renderendpoint antwoordt alleen met openbare gegevens.** De ene serverfunctie die getypte inputs in een URL zet, hotlink-renders, is hier live. Het [privacybeleid](/info/privacy.html) zegt wat dat betekent voor de inputs die je in een link zet.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Elke implementatie kiest (`LOLLY_DISABLE_RENDER_GET=1`): op een instantie die het instelt, geeft dezelfde probe `404` terug. Dat verschil is de instelling die werkt, geen inconsistentie.

**7. Controleer de diensten die je implementatie inschakelt.** [Server Surface](/info/server-surface.html) somt de optionele diensten op en linkt hun gedetailleerde referenties. Voor Lolly Work horen daar zijn geauthenticeerde API's, samenwerkingsverbinding, opslag en geconfigureerde providers bij. Een probe van de openbare lolly.tools test een private organisatie-instantie niet.

Als je een eigen instantie draait, bevat [Delivery deployment](/info/deploy-delivery.html) de releasecontroles ervoor: modelintegriteit, de edge-probe en zijn voorbeeldlijst, weergaveversies, de privédownloadgateway en de ondertekende catalogus in een browser.


## In de broncode

Dit alles kan nog steeds theater zijn als de uitgerolde code van de openbare code verschilde. Controleer dus de code. De implementatie wordt gebouwd uit [de openbare repository](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Nergens een tracker of analytics-SDK.** Doorzoek de code die wordt meegeleverd (de engine, elke shell inclusief de browserextensie, de Tauri-bridge-overrides en de service worker, de serverfuncties en de toolpakketten) op de gebruikelijke verdachten:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

Deze scan zoekt naar tracking-SDK's van derden. Ze toont de afwezigheid van eigen gebruiksrapportage niet aan: Lolly Work ondersteunt organisatietelemetrie en een apart auditlog, met eigen beleid en tests.

**9. Geen DNS-resolver van een derde.** De SEAL-controle van Verify stuurt nooit een opzoeking via een DNS-over-HTTPS-provider, omdat de app geen resolver heeft:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. De certificaatdienst houdt geen uitgifte-log bij.** De identiteits-CA houdt geen log bij van wat ze uitgaf en geen inventaris van identiteiten: geen stdout-regel, geen webhook, geen certificaatopslag. Op de afwezigheid kan worden gezocht:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

De CA houdt wel kortlevende werkstatus bij: ratelimit-buckets bevatten gehashte IP- en e-mailsleutels gedurende hun venster, en de toelatingsopslag van een beheerde implementatie bewaart hoogstens tien minuten een gesleutelde identificatie en aanvraagdigest. [Content Credentials engineering](/info/content-credentials-engineering.html#protocol) bevat de details.

## Afgedwongen door tests

De broncontroles hierboven zijn geen eenmalige audit: ze zijn vastgepind in de testsuite, zodat ze niet ongemerkt kunnen verrotten. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) controleert een langere lijst met trackernamen dan de scan hierboven en laat de build falen als:

- een analytics- of tracking-SDK ergens verschijnt in de meegeleverde broncode die het scant, over app-, engine-, server-, extensie- en toolpakketcode;
- een DNS-over-HTTPS-resolver van een derde in die broncode verschijnt;
- het uitgifte-log van de CA terugkomt, in de broncode **of** de gegenereerde serverbundel;
- het privacybeleid zijn wettelijk vereiste verklaringen verliest (benoemde verwerkingsverantwoordelijke, rechtsgrond, recht om te klagen).

Draai ze zelf in de clone (Node 22.18 of later; dit bestand heeft geen `pnpm install` nodig):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

De volledige suite (`pnpm install && pnpm test`) voert er nog enkele duizenden meer uit, waaronder de adversarial cryptografietests beschreven in [Security & Verification](/info/security.html).

## Wat je van buitenaf niet kunt verifiëren

- **Toegangslogs van de hosting.** Elke server die op een verzoek antwoordt kan het loggen: IP-adres, pad en tijd. Een probe van buitenaf kan niet vaststellen hoe lang logs worden bewaard. De beheerder bepaalt logging, rotatie en exports, en moet die keuzes bekendmaken. Lokaal renderen houdt gewone bewerkingen op je apparaat; optioneel serverrenderen en gedeelde werkruimtediensten hebben de aparte gegevensstromen die het privacybeleid beschrijft.
- **Dat de implementatie deze code draait.** Je kunt controleren of de broncode schoon is en of het uitgerolde gedrag ermee overeenkomt, en de controles hierboven doen beide. Attestatie op binair niveau van een webimplementatie biedt het webplatform niet. De mitigaties zijn de openbare repository, de afgedwongen tests en de offlinecontrole: een gemanipuleerde implementatie die naar huis belt faalt meteen bij controle 1 en 2.
- **Toolhooks.** De optionele logica van een ingebouwde tool wordt beoordeeld in plaats van in een sandbox gezet: ze draait in de pagina tenzij de tool kiest voor een Worker. Elke tool op lolly.tools is eigen werk en wordt beoordeeld voordat hij wordt uitgebracht. Het [Threat Model](/info/threat-model.html#trust-boundaries) zet uiteen waar hooks draaien en wat ze begrenst.

## Als een controle faalt

Een verschil tussen deze pagina en wat je waarneemt is een beveiligingsmelding. Stuur het via de privékanalen op [Security & Verification](/info/security.html#reporting-a-vulnerability). We hanteren gecoördineerde openbaarmaking en vermelden melders.
