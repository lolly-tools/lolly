# Controleer het zelf

Elke belofte op deze site kun je controleren, zonder account. Voor de meeste controles heb je alleen een browser nodig; voor de rest een terminal en een kopie van de broncode. Als een controle hieronder niet het getoonde resultaat oplevert, is dat een bug of een gebroken belofte, en willen we dat weten: zie [Als een controle mislukt](#if-a-check-fails).

Deze controles gelden voor Lolly op zichzelf. Als je organisatie Lolly Work draait, voegt dat aanmelden, gedeelde inhoud, geconfigureerde telemetrie en auditrecords toe; controleer die aan de hand van [Serveroppervlak](/info/server-surface.html) en het [organisatiegedeelte van het privacybeleid](/info/privacy.html#organisation-services-with-lolly-work).

<!--i:eti-clock-->
## Zie het werken, in tien seconden

Open [`/verify`](/#/verify) en sleep een bestand op de pagina. Er is geen upload, geen account en geen wachttijd voor een server. Hier controleert het de [gegenereerde storm in Queensland](/info/ai-stance.html) uit Ons standpunt over AI: een afbeelding die Gemini genereerde en die Lolly opende, markeerde en converteerde. Elke badge is op het apparaat bepaald, uit de eigen bytes van het bestand.

![Lolly Verify op een scherm met telefoonbreedte - de stormafbeelding, een groen oordeel Made with Lolly en daaronder de badges voor intacte credentials en ongewijzigde bytes](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Het oordeel is een kleine stapel badges, elk een onafhankelijk feit:

- <!--i:lock--> **Made with Lolly**: de credential is intact *en* legt een Lolly-export vast.
- <!--i:seal--> **The credential is intact**: het ondertekende C2PA-manifest kan worden geparst en de eigen claimhandtekening is geldig.
- <!--i:hash--> **The bytes have not changed**: de hash van het bestand komt nog steeds overeen met wat is ondertekend. Verander één pixel en deze badge verandert.
- <!--i:sparkle--> **GEN AI**: een machine heeft deze pixels gemaakt, en het bestand zegt dat. Lolly leest die verklaring terug in plaats van het feit te verbergen.

De hele geschiedenis gaat mee met het bestand. Hier blijven negen stappen bewaard: vijf die Google vastlegde bij het genereren en watermerken van de afbeelding, daarna vier die Lolly vastlegde bij het openen, markeren en converteren van de kopie op deze pagina. Lolly Verify leest ze rechtstreeks uit de bytes en tekent ze als tijdlijn.

![De wijzigingsgeschiedenis die Lolly Verify terugleest uit de stormafbeelding - vijf stappen vastgelegd door Google, daarna vier door Lolly, eindigend in de WebP op deze pagina](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

De controles hieronder zijn de garanties achter die demo, en elk ervan is reproduceerbaar. [Content Credentials](/info/content-credentials-identity.html) legt elk oordeel uit.

<!--i:eti-globe-->
## In je browser, zonder extra tools

::: timeline
- <!--i:globe--> **1. Bekijk het netwerk.** Open [lolly.tools](https://lolly.tools), open de DevTools van je browser (F12), ga naar **Network** en gebruik een tool: typ een webadres in [Lolly QR Code](/t/qr-code), verander kleuren, exporteer een PNG. Elk verzoek gaat naar `lolly.tools`: de appshell, de eigen bestanden van de tool en catalogusassets. Er is geen analysehost, geen CDN-baken, geen lettertypedienst en geen endpoint voor foutrapportage. Wat je in een tool typt verschijnt in **geen enkel verzoek**, omdat het renderen lokaal gebeurt.
- <!--i:eyeoff--> **2. Trek de stekker eruit.** Laad de app en open een paar tools, ga dan offline (vliegtuigmodus of DevTools → Network → Offline) en herlaad. De galerij en elke tool die je hebt geopend blijven werken, inclusief renderen en exporteren in de formaten die je hebt gebruikt. De bestanden van een tool en de encoder van een formaat worden de eerste keer dat je ze gebruikt gecachet, dus gebruik een tool één keer online voordat je hem offline test. Dit is de sterkste afzonderlijke controle op deze pagina: software die naar huis belt blijft niet werken als de verbinding wordt verbroken.
- <!--i:check--> **3. Tel de cookies.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. De lijst is leeg: de app plaatst geen cookies. Plak `document.cookie` in de console en je krijgt `""`. De optionele CA-inschrijving plaatst een kortlevende `HttpOnly`-cookie, `lolly_ca_state`, beperkt tot `/api/ca`, die `document.cookie` niet kan tonen. Een Lolly Work-instantie gebruikt eigen aanmeldcookies; vergelijk die met [Privacy](/info/privacy.html#organisation-services-with-lolly-work).
- <!--i:layers--> **4. Lees je eigen opslag.** In hetzelfde paneel zie je alles wat Lolly bewaart: een paar dozijn gewone `localStorage`-sleutels (thema, taal, zijbalkbreedte, geluids- en weergave-instellingen en een gecachete kopie van de openbare toolcatalogusindex) en je eigen documenten in IndexedDB. Elke waarde is een leesbare string of JSON, zonder verhulling. Sitegegevens wissen verwijdert deze lokale records, maar geen Sync-back-up of records die door een Lolly Work-instantie worden bewaard. **Settings → Storage → Clear all my data** doet hetzelfde vanuit de app, en je kunt zien hoe de opslag en caches leeg raken.
- <!--i:lock--> **5. Controleer of het meldcontact bestaat.** [`/.well-known/security.txt`](/.well-known/security.txt) antwoordt met een [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116)-contactblok, geen HTML-pagina.
:::

::: details Wat je verder kunt zien op het tabblad Network
Sommige functies gebruiken het netwerk alleen wanneer je ze gebruikt, en ze zijn allemaal zichtbaar op hetzelfde tabblad:

- een **Google Font** toevoegen in Lolly Design System Setup haalt die ene familie op bij Google, na een toestemmingsdialoog die dat vermeldt, eenmalig vóór het eerste ophalen;
- klikken op een **voorkeuze voor een ICC-drukprofiel** haalt dat profiel op uit het openbare register van het ICC op color.org;
- de optionele ingebouwde **radio** afspelen streamt vanaf de zender;
- een locatie invoeren in **Meeting Planner** zoekt die plaats op via de geocodingdienst van open-meteo voor de coördinaten en tijdzone, één keer per stad (antwoorden worden op je apparaat opgeslagen), en het veld vermeldt dat waar je typt;
- **Lolly URL Screenshot** laadt het adres dat je hebt getypt, en je ziet het gebeuren.

Een tool die een netwerkmogelijkheid declareert mag alleen ophalen van hosts die het manifest toestaat, en die controle blokkeert bij een fout. Geen enkele tool die nu wordt geleverd declareert er een, dus het door de browser afgedwongen Content-Security-Policy beperkt de bovenstaande lijst tot zijn hosts. Het [privacybeleid](/info/privacy.html) bevat de canonieke tabel van al deze verbindingen, inclusief verkeer van beheerde instanties zoals beleidsvernieuwingen en ingeschakelde rapportage.
:::

<!--i:eti-code-->
## Vanuit een terminal

**6. Het renderendpoint antwoordt alleen met openbare gegevens.** De ene serverfunctie die getypte invoer in een URL zet, hotlinkrenders, is hier actief. Het [privacybeleid](/info/privacy.html) legt uit wat dat betekent voor de invoer die je in een link zet.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Elke deployment kiest (`LOLLY_DISABLE_RENDER_GET=1`): op een instantie die de variabele instelt, geeft dezelfde probe `404` terug. Dat verschil betekent dat de instelling werkt, geen inconsistentie.

**7. Controleer de diensten die je deployment inschakelt.** [Serveroppervlak](/info/server-surface.html) somt de optionele diensten op en linkt naar hun gedetailleerde naslag. Neem voor Lolly Work ook de geauthenticeerde API's, samenwerkingsverbinding, opslag en geconfigureerde providers mee. Een probe op het openbare lolly.tools test geen privé-instantie van een organisatie.

Als je een eigen instantie draait, bevat [Deployment voor bezorging](/info/deploy-delivery.html) de releasecontroles: modelintegriteit, de edge-probe en de bijbehorende steekproeflijst, weergaveversies, de privégateway voor downloads en de ondertekende catalogus in een browser.


<!--i:eti-search-->
## In de broncode

Alles hierboven kan nog steeds schijn zijn als de gedeployde code afwijkt van de openbare code. Controleer dus de code. De deployment wordt gebouwd vanuit [de openbare repository](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Nergens een tracker of analyse-SDK.** Doorzoek de meegeleverde code (de engine, elke shell inclusief de browserextensie, de overrides van de Tauri-bridge en de service worker, de serverfuncties en de toolpakketten) op de gebruikelijke verdachten:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

Deze scan zoekt naar tracking-SDK's van derden. Hij toont niet aan dat eigen gebruiksrapportage ontbreekt: Lolly Work ondersteunt organisatietelemetrie en een afzonderlijk auditlog, met eigen beleid en tests.

**9. Geen DNS-resolver van derden.** De SEAL-controle van Lolly Verify verstuurt nooit een zoekopdracht via een DNS-over-HTTPS-provider, omdat de app geen resolver heeft:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. De certificaatdienst houdt geen uitgiftelog bij.** De identiteits-CA houdt geen log bij van wat ze uitgeeft en geen inventaris van identiteiten: geen stdout-regel, geen webhook, geen certificaatopslag. Je kunt op die afwezigheid zoeken:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

De CA bewaart wel een kortlevende werktoestand: buckets voor verzoeklimieten bewaren gehashte IP- en e-mailsleutels gedurende hun tijdvenster, en de toelatingsopslag van een beheerde deployment bewaart een op een sleutel gebaseerde identificatie en een verzoekdigest maximaal tien minuten. [Content Credentials-techniek](/info/content-credentials-engineering.html#protocol) bevat de details.

<!--i:eti-flask-->
## Afgedwongen door tests

De broncodecontroles hierboven zijn geen eenmalige audit: ze zijn vastgelegd in de testsuite, zodat ze niet ongemerkt kunnen verouderen. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) controleert een langere lijst met trackernamen dan de scan hierboven en laat de build mislukken als:

- er ergens een analyse- of tracking-SDK voorkomt in de meegeleverde broncode die wordt gescand, in code van de app, engine, server, extensie en toolpakketten;
- er een DNS-over-HTTPS-resolver van derden in die broncode voorkomt;
- het CA-uitgiftelog terugkomt, in de broncode **of** de gegenereerde serverbundel;
- het privacybeleid zijn wettelijk verplichte verklaringen verliest (benoemde verwerkingsverantwoordelijke, rechtsgrond, klachtrecht).

Voer ze zelf uit in de kloon (Node 22.18 of later; dit bestand heeft geen `pnpm install` nodig):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

De volledige suite (`pnpm install && pnpm test`) voert er nog enkele duizenden uit, waaronder de cryptografietests met aanvalsscenario's beschreven in [Beveiliging & verificatie](/info/security.html).

<!--i:eti-eye-off-->
## Wat je niet van buitenaf kunt controleren

- **Toegangslogs van de hosting.** Elke server kan de verzoeken loggen die hij beantwoordt: IP-adres, pad en tijdstip. Een externe probe kan niet vaststellen hoelang logs worden bewaard. De beheerder bepaalt logging, rotatie en exports en moet die keuzes bekendmaken. Lokaal renderen houdt gewone bewerkingen op je apparaat; optioneel renderen op de server en diensten voor gedeelde werkruimtes hebben de afzonderlijke gegevensstromen die het privacybeleid beschrijft.
- **Dat de deployment deze code draait.** Je kunt controleren of de broncode schoon is en of het gedeployde gedrag overeenkomt met de broncode, en de controles hierboven doen beide. Het webplatform biedt geen attestatie op binair niveau van een webdeployment. De maatregelen zijn de openbare repository, de afgedwongen tests en de offlinecontrole: een gemanipuleerde deployment die naar huis belt faalt meteen bij controles 1 en 2.
- **Toolhooks.** De optionele logica van een ingebouwde tool wordt beoordeeld in plaats van in een sandbox geplaatst: ze draait in de pagina tenzij de tool voor een Worker kiest. Elke tool op lolly.tools is een eigen product en wordt vóór de release beoordeeld. Het [Dreigingsmodel](/info/threat-model.html#trust-boundaries) beschrijft waar hooks draaien en wat ze begrenst.

<!--i:eti-warning-->
## Als een controle mislukt

Een verschil tussen deze pagina en wat je waarneemt is een beveiligingsmelding. Stuur die via de privékanalen op [Beveiliging & verificatie](/info/security.html#reporting-a-vulnerability). We werken met gecoördineerde openbaarmaking en vermelden melders.
