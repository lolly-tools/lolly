# Verifieer het zelf

Lolly's privacy- en beveiligingspagina's doen beweringen: geen analytics, geen tracking, bestanden verlaten nooit het apparaat, één cookie in het hele systeem. Deze pagina is anders: hij vraagt je niet om dat allemaal te geloven. Het is een lijst met procedures, elk met de precieze opdracht of klikpad en de output die je zult zien. Elke bewering hier is binnen enkele minuten te weerleggen, de meeste zonder iets te installeren.

Als een controle op deze pagina niet het getoonde resultaat oplevert, is dat óf een bug óf een gebroken belofte. [Meld het](#if-a-check-fails) in beide gevallen, en we behandelen het met de ernst die een gebroken belofte verdient.

## Zie het werken, in tien seconden

Voor de procedures, eerst de opbrengst. Open [`/verify`](/#/verify) en zet er een bestand op - geen upload, geen account, geen wachten op een server. Hier controleert hij de [gegenereerde storm boven Queensland](/info/ai-stance.html) van onze AI-standpuntpagina: een Gemini-afbeelding die Lolly heeft geopend, verkleind en geëxporteerd. Elk badge hieronder is op het apparaat berekend, uit de eigen bytes van het bestand.

![Verify op een telefoonbreed scherm - de stormafbeelding, een groen Made with Lolly-oordeel en daaronder gestapeld de badges credential-intact en bytes-unchanged](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Het oordeel is niet één badge maar een klein stapeltje ervan, elk een op zichzelf staand feit:

- <!--i:lock--> **Made with Lolly** - de credential is intact *en* registreert een Lolly-export.
- <!--i:seal--> **De credential is intact** - het ondertekende C2PA-manifest wordt geparseerd en de eigen claimhandtekening ervan verifieert.
- <!--i:hash--> **De bytes zijn niet veranderd** - de hash van het bestand komt nog overeen met wat er ondertekend is. Verander één pixel en dit badge slaat om.
- <!--i:sparkle--> **GEN AI** - een machine heeft deze pixels gemaakt, en het bestand zegt dat ook. Lolly leest die bewering terug uit in plaats van hem te verbergen.

En de hele geschiedenis reist mee met het bestand. Negen stappen overleven hier - vijf die Google vastlegde tijdens het genereren en watermerken van de afbeelding, en dan vier die Lolly vastlegde tijdens het openen, markeren en converteren van de kopie op deze pagina - rechtstreeks uit de bytes teruggelezen, op je eigen apparaat, en weergegeven als tijdlijn. Dit is dezelfde afbeelding, op dezelfde manier geverifieerd, als de C2PA-tijdlijn op de [AI-standpuntpagina](/info/ai-stance.html).

![De wijzigingsgeschiedenis die Verify teruggeleest uit de stormafbeelding - vijf stappen vastgelegd door Google, dan vier door Lolly, eindigend in de WebP op deze pagina](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Niets daarvan is de vertrouwensclaim, dat is de demo. De rest van deze pagina is de vertrouwensclaim: elke badge hierboven is reproduceerbaar, en hier lees je hoe je de garanties erachter reproduceert.

## In je browser, geen tools nodig

**1. Bekijk het netwerkverkeer.** Open [lolly.tools](https://lolly.tools), open de DevTools van je browser (F12), ga naar het tabblad **Network** en gebruik een tool - typ een URL in [QR Code](/t/qr-code), wijzig kleuren, exporteer een PNG. Elk verzoek blijft op `lolly.tools`: de app shell, de eigen bestanden van de tool, catalogusassets. Geen analytics-host, geen CDN-beacon, geen fontservice, geen "foutrapportage"-endpoint. Wat je in een tool typt verschijnt in **geen enkel verzoek** - renderen gebeurt lokaal.

De eerlijke uitzonderingen - elk opt-in, door de gebruiker geïnitieerd en zichtbaar in datzelfde Network-tabblad op het moment zelf: het toevoegen van een **Google Font** in de merkeditor haalt die ene familie op bij Google, na een toestemmingsdialoog die dat precies aangeeft, eenmalig, vóór de eerste aanvraag; klikken op een **ICC-drukprofiel-preset** haalt dat profiel op bij het publieke register van ICC op color.org; het afspelen van de optionele ingebouwde **radio** streamt vanaf het station; het invoeren van een locatie in **Meeting Planner** zoekt die plek op bij de geocoderingsservice van open-meteo voor coördinaten en tijdzone, eenmalig per stad (antwoorden worden op je apparaat opgeslagen), en het invoerveld draagt die toelichting precies waar je typt; en **URL Screenshot** laadt noodzakelijkerwijs de URL die je hebt getypt - dat is zijn taak, en je ziet het gebeuren. Een tool die een netwerkcapaciteit declareert mag alleen verbinding maken met de hosts die de manifest toestaat, en dat mechanisme is fail-closed; geen enkele momenteel uitgeleverde tool declareert er een, dus het door de browser afgedwongen Content-Security-Policy is de grens die de lijst hierboven daadwerkelijk aan zijn hosts houdt. Het [privacybeleid](/info/privacy.html) bevat de canonieke tabel van dit alles; de vaste regel daarin is dat een netwerkcontact dat niet in die tabel staat, niet gebeurt.

**2. Trek de stekker eruit.** Laad de app en open een of twee tools, ga dan offline - vliegtuigmodus, of DevTools → Network → Offline. Herlaad. De galerij en elke tool die je hebt geopend blijven werken, inclusief renderen en exporteren in de formaten die je hebt gebruikt - de bestanden van een tool en de encoder van een formaat worden gecached bij het eerste gebruik, dus gebruik een tool eenmaal online voordat je hem offline test. Dit is de sterkste controle op deze pagina: software die naar huis belt overleeft het niet als het snoer wordt doorgeknipt.

**3. Tel de cookies.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. De lijst is leeg - de app plaatst geen cookies. Of plak `document.cookie` in de console: je krijgt `""`. (Het enige cookie in het hele systeem, `lolly_ca_state`, bestaat maximaal tien minuten tijdens een optionele identiteitsaanmelding - verwijderd zodra de aanmelding is voltooid - is gescopet tot `/api/ca` en is `HttpOnly`: het [privacybeleid](/info/privacy.html) beschrijft het precies.)

**4. Lees je eigen opslag.** Hetzelfde Application-paneel: alles wat Lolly bewaart is voor je ogen inspecteerbaar - een stuk of twintig gewone `localStorage`-sleutels (thema, taal, breedte van de zijbalk, geluids- en weergave-instellingen, plus een gecachte kopie van de publieke tool-catalogusindex), en je eigen documenten in IndexedDB. Elke waarde is een leesbare string of JSON - niets is versluierd, niets is gecodeerd om lezen te ontmoedigen. **Profile → Clear all my data** wist het; hetzelfde geldt voor het wissen van sitegegevens in de browser, want er is geen serverzijdige kopie die dat overleeft.

**5. Controleer of het meldcontact bestaat.** [`/.well-known/security.txt`](/.well-known/security.txt) antwoordt met een [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116)-contactblok, geen HTML-pagina.

## Vanuit een terminal

**6. Het render-endpoint antwoordt alleen met publieke data.** De ene serverfunctie die door de gebruiker getypte invoer in een URL zet - hotlink-renders - is hier live, en het [privacybeleid](/info/privacy.html) legt uit wat dat betekent voor de invoer die je in een link zet:

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

De schakelaar geldt per implementatie (`LOLLY_DISABLE_RENDER_GET=1`): op een instantie die dit instelt, levert dezelfde test `404` op - dat verschil is de vlag die werkt, geen inconsistentie.

**7. Het serveroppervlak is opsombaar.** [Server Surface](/info/server-surface.html) somt elke serverzijdige route op die bestaat, met de vaste regel dat een endpoint dat niet op die pagina staat geen deel uitmaakt van Lolly. `curl` ze; er valt verder niets te vinden.

## In de broncode

Alles hierboven zou nog steeds toneel kunnen zijn als de uitgerolde code zou afwijken van de publieke code. Controleer dus de code - de implementatie bouwt vanuit [de publieke repository](https://github.com/lolly-tools/lolly):

```bash
git clone --recurse-submodules https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Geen tracker, geen analytics-SDK, nergens.** Doorzoek de code die wordt uitgeleverd - de engine, elke shell (inclusief de browserextensie, de Tauri bridge overrides en de service worker), de serverfuncties en de tool packs - op de gebruikelijke verdachten:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

**9. Geen externe DNS-resolver.** De SEAL-check van Verify routeert lookups nooit via een DNS-over-HTTPS-provider - de webapp heeft simpelweg geen resolver:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. De certificaatservice bewaart niets.** De identiteits-CA heeft geen uitgiftelog - geen e-mail, geen tijdstempel, geen webhook van jou. Die afwezigheid is grep-baar:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

## Afgedwongen door tests, niet door beloftes

De drie broncodecontroles hierboven zijn geen eenmalige audit - ze zijn vastgepind in de testsuite, zodat ze niet stilletjes kunnen verrotten. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) laat de build falen als:

- er ergens in de uitgeleverde broncode die het scant een analytics- of trackings-SDK verschijnt - app, engine, server, extensie en tool-pack-code allemaal,
- er in die broncode een externe DNS-over-HTTPS-resolver verschijnt,
- het uitgiftelog van de CA terugkeert - in de broncode **of** in de gegenereerde serverbundel,
- het privacybeleid zijn wettelijk verplichte verklaringen verliest (aangewezen verwerkingsverantwoordelijke, rechtsgrond, recht om te klagen).

Voer ze zelf uit in de kloon (Node 22.18+; geen `npm install` nodig voor dit bestand):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

De volledige suite (`npm install && npm test`) draait er nog enkele duizenden meer, inclusief de adversariële cryptografietests beschreven in [Security & Verification](/info/security.html).

## Wat je van buitenaf niet kunt verifiëren - ronduit gezegd

Een pagina als deze verdient vertrouwen door haar eigen grenzen te benoemen:

- **Toegangslogs van de hosting.** Elke server die een verzoek beantwoordt kan dat verzoek loggen - IP, pad, tijdstempel. Je kunt niet verifiëren wat een host wel of niet bewaart, en wij ook niet, voorbij het gedocumenteerde gedrag van onze provider. Precies daarom houdt de architectuur je content volledig van de lijn: wat je apparaat nooit verlaat, kan door niemand worden gelogd.
- **Dat de implementatie deze code draait.** Je kunt verifiëren dat de broncode schoon is en dat het uitgerolde gedrag ermee overeenkomt (de controles hierboven doen beide kanten), maar attestatie op binair niveau van een webimplementatie is niet iets wat het webplatform biedt. De mitigaties zijn de publieke repository, de afgedwongen tests en de offline-controle - een geknoeide implementatie die naar huis belt faalt controle 1 en 2 onmiddellijk.
- **Toolhooks staan standaard niet in een sandbox.** De optionele logica van een tool draait beoordeeld, in het eigen realm van de pagina; elke tool op lolly.tools is first-party en wordt beoordeeld voordat hij wordt uitgeleverd. Worker-isolatie wordt nu per tool als opt-in geleverd - een tool waarvan de manifest `isolate: true` instelt draait zijn hooks off-thread - dus wat je van buitenaf niet kunt verifiëren wordt kleiner, maar het standaardpad blijft in-realm en beoordeling blijft de controle. Dit staat vermeld, niet verborgen - zie de sectie [design boundaries](/info/security.html), die dit altijd al zei.

## Als een controle faalt

Een discrepantie tussen deze pagina en waargenomen gedrag is een beveiligingsmelding, en we horen het oprecht liever wel dan niet: [fitzy+security@suse.com](mailto:fitzy+security@suse.com), de knop **Report a vulnerability** op elke [lolly-tools-repository](https://github.com/lolly-tools) of het contact in [`/.well-known/security.txt`](/.well-known/security.txt). Gecoördineerde openbaarmaking en erkenning van de melder zijn het vaste beleid - [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md) heeft de details.
