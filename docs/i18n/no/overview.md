# Lolly-arkitektur

![Lolly-ikon - Stor grønn og hvit slikkepinne](/info/icon.svg)

Denne siden er for folk som endrer Lollys kode: hvordan motoren, skallene og verktøypakkene henger sammen, hvor hver ligger i repositoriet, og forpliktelsene som begrenser hver endring. Hvis du vil vite hva Lolly gjør og hvem som bruker det, les [How Lolly works](/info/how-lolly-works.html) først.

To følgesvenner går dypere. [`engine/README.md`](../engine/README.md) er modul-for-modul-kartet over motoren, generert fra koden. [Threat Model & Trust Boundaries](/info/threat-model.html) leser den samme arkitekturen som tillitsgrenser, og er siden for ethvert spørsmål om hva motoren behandler som ikke-klarert.

## Det store bildet

Verktøy er data øverst. Motoren i midten vet ingenting om noen plattform. Skallene nederst implementerer én kontrakt, og katalogene leverer innholdet.

![Verktøy leverer et manifest, en mal og hooks til den felles motoren. Nett-, Tauri- og terminalskall implementerer HostV1-kapabilitetsbroen og leser verktøy og ressurser fra kataloger.](/info/diagrams/concepts/platform-layers.svg)

Hvis du kan beskrive det i rene data og Handlebars, hører det hjemme i **motoren**. Hvis det berører DOM, filsystemet, nettverket eller en hvilken som helst nettleser- eller operativsystem-API, hører det hjemme i **verten**, skallets side av broen. Motoren er åpen kildekode, og ingenting som kjenner til en bestemt merkevare eller plattform går inn i motoren.

## Repositoriets oppbygning

Lolly er ett repositorium. Hver mappe nedenfor er en vanlig mappe i det, unntatt `brands/suse`, en **privat** git-submodul som holder SUSE-verktøypakken og -katalogen, og som en offentlig klone ikke henter. Hvilke pakker et bygg leser, er en innholdsprofil (`profiles.json`), løst per prosess i stedet for byttet globalt. [Build Guide](/info/build-guide.html) har klonekommandoen og hvordan en endring inne i den private pakken committes.

| Mappe | Hva den holder |
|---|---|
| `engine/` | Den plattformuavhengige kjernen: loader, kjøretid, inndata, maler, URL-modus, enheter og formatmodulene |
| `shells/` | Nettappen, Tauri-skrivebords- og mobilappene, CLI-et, TUI-et og nettleserutvidelsen |
| `packages/` | SDK-et for verktøyforfattere (`@lolly-tools/core`), de delte Node-skallbitene og dokumentgjengiveren, blant annet |
| `community/` | De merkevareuavhengige verktøyene, pluss de delte emoji-pakkene |
| `brands/` | Merkevarepakker: `lolly-demo` (Lolly Demo, designsystemet lolly.tools kjører), `lolly-start` (den blanke starteren) og den private `suse` |
| `services/` | De valgfrie MCP-, sertifikat- og Penpot-tjenestene, og serverkoden de deler |
| `schemas/` | JSON Schema for verktøymanifester, ressursoppføringer og ressursreferanser |
| `scripts/`, `tests/`, `docs/`, `api/` | Bygge- og katalogskript, motorens testsuite, disse dokumentene og de genererte serverløse bundlene |

::: details Motor- og skallfilene du møter først
```
engine/src/
  index.ts          public surface: loader, runtime, template, inputs, url-mode
  loader.ts         fetches and validates tool files
  runtime.ts        orchestrates one mounted tool, from load to export
  template.ts       Handlebars hydration and annotateTemplate
  inputs.ts         manifest to runtime input model
  url-mode.ts       URL to input state and back
  validate.ts       JSON Schema validation of manifests
  compose.ts        nested tool renders (composes)
  embed.ts          portable lolly.tools embed URLs
  bridge/host-v1.ts type re-export of the @lolly-tools/core contract

shells/web/src/
  main.ts           boot and routing
  bridge/           the web implementations of the host APIs
  catalog/sync.ts   boot-time catalog sync and offline cache
  views/            the gallery, tool, projects, free canvas and the other views
  pro/              Batch (#/batch)

shells/cli/         bin/lolly.ts (entry), src/run.ts (headless render), src/bridge.ts
shells/tui/         src/main.tsx (the full-screen app), src/bridge.ts
```
:::

Det finnes ingen `tools/`- eller `catalog/`-mappe i repositoriets rot. `packages/node-shell/src/content-roots.ts` svarer på "hvor ligger verktøy `<id>`" og "hvor er katalogen" fra `profiles.json` når det blir spurt. Et ekte par av `tools/` og `catalog/` skrives bare inn i en byggeutdata, som `dist/`, en RPM-nyttelast eller et containerbilde, fordi en nettleser henter de to stiene over HTTP.

## Hvor Lolly kjører

Hver flate bruker den samme motoren og de samme verktøyfilene.

- **Nettappen.** En progressiv nettapp som fungerer uten nett når tjenestearbeideren har bufret verktøyene og ressursene. Den trenger ingen konto; tilstanden ligger i IndexedDB på hver enhet. Én responsiv layout dekker skrivebord og telefon: på en telefon blir kontrollene et ark, og eksportkontrollene åpnes fra en flytende pille.
- **Skrivebords- og mobilappene.** Tauri-pakker av den samme nettappen, med innebygde fildialoger, filsystemtilstand og full bruk uten nett.
- **CLI-et.** `lolly <tool-id> --input=value --output=file.png` laster den samme motoren i en DOM uten grensesnitt og skriver filen. Det er URL-modus over en annen transport, ikke en separat implementasjon. Se [CLI](/info/cli.html).
- **TUI-et.** En fullskjerms, tastaturførst terminalapp som gjenbruker CLI-ets bro, beholder lagrede økter på disk (i skrivebordsappens egen mappe når appen er installert, ellers under `~/.lolly`) og starter en avgrenset nettleser uten grensesnitt bare når et format trenger en. Se [TUI](/info/tui.html).

![Delt visning på skrivebordet: kontroller generert fra manifestet til venstre, det levende lerretet til høyre](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

Det samme verktøyet i telefonbredde trenger ingen andre layout: kontrollene blir et ark øverst, og forhåndsvisningen holder skjermen.

![Et audiogram på en 430 px bred skjerm: kontrollarket over, det ferdige kvadratiske bildet under og den flytende eksportpillen](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

Nettappen leveres også med **Batch** (`#/batch`, `shells/web/src/pro/`), et regnearklignende rutenett som gjengir mange rader samtidig på tvers av ett eller flere verktøy; [Batch and Multi-edit](/info/batch.html#make-many-versions-of-one-design) dekker Batch. **Settings → Capabilities** kartlegger alt plattformen oppgir at den kan gjøre.

![Batch på en ny installasjon: én tom rad som venter på et verktøy, med regnearkflaten og Render-knappen på plass før noen data kommer](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

## Arkitektoniske forpliktelser

Disse avgjørelsene er tatt. Å endre noen av dem er en stor oppgave, fordi de former hver annen avgjørelse i kodebasen.

### 1. Deklarative verktøy, med en imperativ nødutgang

Et verktøy er et manifest (`tool.json`), en mal (`template.html`) og valgfri `hooks.js`. **Manifestet deklarerer inndataene**, aldri malen: inndata utledes ikke fra Handlebars-tokener. De fleste verktøy er bare manifest og mal, og det er det som lar ikke-utviklere forfatte dem.

![Kontrollstakken i Street Map: en byrullegardin, et temavalg, vektglidere og fargeutløsere, alle tegnet fra en manifestlinje](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

Verktøy som beregner verdier, som QR-koding eller diagramforming, legger til hooks: navngitte livssyklusfunksjoner kjøretiden kaller med kapabilitetsbroen injisert. Hooks er en portabilitetskontrakt, ikke en sikkerhetssandkasse, og de kjører innenfor et tidsbudsjett. Verktøy der hooks er bevist fri for sideglobaler, bærer `isolate: true` og kjører i en Worker. [Tool hooks](/info/tool-hooks.html) har livssyklusen og budsjettene, og [Threat Model](/info/threat-model.html) sier hva eksekutoren på siden gjør og ikke rommer.

### 2. Verktøy og ressurser er data, ikke pakket kode

Nett- og Tauri-appene henter verktøy- og ressurskatalogene ved oppstart, bufrer dem og arbeider med det som er der, så et nytt verktøy eller en ny ressurs trenger ingen apputgivelse. Ressursbytes får SHA-256-sjekksum, og en ressurs' `id` og `version` styrer ugyldiggjøring av bufferen.

### 3. Kapabilitetsbroen er den eneste API-en verktøy ser

Verktøy rører aldri DOM utenfor malen sin, kaller aldri `fetch` direkte og leser aldri filsystemet. De kaller versjonerte `host.*`-metoder. Kontraktens kanoniske definisjon er `packages/core/src/host-v1.ts`, SDK-et for verktøyforfattere `@lolly-tools/core`, så en tredjepart kan bygge mot det uten å være avhengig av motoren; `engine/src/bridge/host-v1.ts` reeksporterer typene.

| Påkrevd API | Hva den gjør |
|---|---|
| `host.profile` | Brukerens detaljer; forhåndsutfyller inndata gjennom `bindToProfile` |
| `host.assets` | Katalogspørringer, ressursoppløsning og vertens velger |
| `host.state` | Lagre og laste inndataplasser: IndexedDB på nettet, filsystemet i Tauri, minnet i CLI-et |
| `host.clipboard` | Skriv tekst eller et bilde til utklippstavlen, med plattformreserver |
| `host.export` | Rasteriser eller serialiser gjengivelsesmålet, og filtransformasjonsveien på enheten |
| `host.log` | Nivådelt logging til verten |

Hver annen API er valgfri og additiv: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` og mange flere. Et verktøys manifest lister under `requires` de valgfrie API-ene hooks kaller uten å sjekke først, og en vert som mangler en, nekter å montere verktøyet; hooks funksjonsdetekterer resten. Noen få, som `recorder`, trenger også en enhetskapabilitet verktøyet deklarerer. `packages/core/src/host-v1/apis.ts` lister dem alle, og [Host API](/info/host-api.html) dokumenterer hver enkelt. Å legge til en metode er en minorversjon; å fjerne eller endre en er en majorversjon, og v1 fortsetter å fungere når v2 kommer.

### 4. Ressurs-ID-er varer for alltid

`lolly/logo/primary` er en kontrakt. Når den er publisert, endres en id aldri og gjenbrukes aldri. En bytendring øker `version` i ressursoppføringen, og en erstatning setter `deprecated: true` og eventuelt `replacedBy`, så eksisterende referanser alltid løses opp. Det er det som holder lagrede økter og delte lenker i live i årevis.

### 5. URL-modus er førsteklasses

Hver inndata kan uttrykkes som en URL-parameter, så en lenke er en ferdig fil:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Den lenken alene, uten noe annet i seg, er den ferdige filen](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Endre en parameter, så har du en annen fil. Hele denne paletten er én frøfarge, en harmoni og et trinnantall:

![Ni trinn over fire fargenyanser, alle vokst fra den samme frøfargen som ligger i lenken](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

CLI-et bygger den samme URL-tilstanden fra argumentene sine og kjører den samme pipelinen, så CLI-et kan ikke drive bort fra appen. `engine/src/url-mode.ts` parser og serialiserer; et sett reserverte navn (`format`, `width`, `dpi`, `c2pa`, `z` og andre) sendes aldri til et verktøy, og [Reserved URL parameters](/info/url-parameters.html) lister dem alle. Ressursinndata reiser med `id` og løses opp gjennom `host.assets.get()` før malen fylles.

### 6. Lagring går gjennom broen

Nettappen bruker IndexedDB, Tauri filsystemet og CLI-et minnet. Verktøy ser bare `host.state.save(slot, data)` og `host.state.load(slot)`, aldri `localStorage`. Folk kan beholde flere navngitte økter per verktøy uten konto. Fordi broen er den eneste sømmen, er den tilstanden også portabel: `shells/web/src/data-transfer.ts` leser den ut igjen til én `lolly-backup`-fil som kan importeres på enhver annen installasjon ([Data transfer](/info/data-transfer.html)), og [Sync](/info/sync.html) sender den samme bundlen til lagring personen velger.

### 7. Modenhetsmerker sier hva et verktøy er

Hvert verktøy deklarerer `status: official | community | experimental`. Galleriet sorterer etter status, og eksperimentelle verktøy vannmerker eksportene sine som standard: kjøretiden slår vannmerket på med mindre den som kaller sender `watermark: false`, og verktøy på enheten er unntatt. Hvilken prosess et team enn legger rundt katalogen, ligger oppå dette.

### 8. Inndata er typet i manifestet

En inndata deklarerer en `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` eller `file`. Verten gjengir en kontroll per type, så verktøy skriver ingen kontrollkode, og enhver inndata kan bære `bindToProfile`. Tre veier tyngst:

- **`asset`**, med `filter` og `allowUpload`, er broen til ressurssystemet. `allowUpload: false` begrenser en plass til bibliotekressurser, og brukeropplastinger deler bibliotekets `AssetRef`-form.
- **`blocks`** er en repeterende feltgruppe redigert i et sidepanel, brukt av Meeting Planner, Wayfinding, Diagrams og andre. Å klikke på en gjengitt blokk gir raden fokus.
- **`file`** holder brukerens egen fil i minnet for verktøy på enheten som Strip Hidden Data og Compress, og **`vector`** grupperer et fast sett med tall i én kontroll.

### 9. Maler er logikkfrie

Maler er Handlebars, valgt slik at ikke-utviklere kan skrive dem: `{{x}}` escaper, og `{{{x}}}` er et eksplisitt valg. Logikk bor i `hooks.js`, der den er eksplisitt og kan gjennomgås. Mange maler bruker `{{{` for markup en hook har beregnet, så hver hook må escape det den leverer. Hjelperne er `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` og `media`, pluss `icsStamp`, `rfcText`, `csvCell` og `arrow` for søskenmaler i `.ics`, `.vcf` og `.csv`. [Templates and rendering](/info/tool-rendering.html) dekker dem.

### 10. Verktøy komponerer verktøy

Et verktøy kan bygge inn gjengivelsen til et annet verktøy uten verktøy-til-verktøy-importer; motoren løser opp sammensetningen. Et manifest kan deklarere `composes: [{ id, tool, inputs }]` og plassere barnet med `{{asset <id>}}`, og en portabel innbyggings-URL (`https://lolly.tools/tool/<id>.svg?…`) gjengir barnet lokalt, og det er slik Design plasserer en levende QR-kode eller et diagram. Et SVG-barn forblir vektor i en SVG- eller PDF-forelder. Barn er mellomprodukter, aldri vannmerket eller stemplet, og et skall som ikke kan gjengi et, lar plassen stå tom mens forelderen likevel gjengis. [Composition and brand overlays](/info/tool-composition.html) har detaljene.

## Hva vi valgte å ikke gjøre

- **Ingen vilkårlig JavaScript i maler.** Logikk bor i `hooks.js`.
- **Ingen obligatorisk ressursserver.** Folk legger til sine egne filer i Assets i appen og gir arbeid videre som en økt: en delingslenke for inndata og innstillinger, en `.lolly`-fil når opplastinger også følger med. En delt økt kan bli en mal i et verktøys velger. En organisasjon som vil ha en styrt katalog, kan bruke Lolly Works katalog, godkjenninger og policyer, eller administrere merkevarepakken i git og gjennomgå endringer der.
- **Ingen påtvunget tilgangskontroll.** Den åpne appen er offentlig som standard, og modenhetsmerker og vannmerker bærer merkevarerisikoen. Organisasjonspålogging, roller og policy kommer fra Lolly Work når et team vil ha dem.
- **Ingen sentral database.** Brukertilstand ligger på hver enhet, og valgfri Sync kopierer den til lagring personen velger, aldri til en Lolly-database.
- **Ingen delt kodevei mellom verktøy og motoren.** Motoren og fellesskapsverktøyene er åpen kildekode, og en merkevarepakke som den private `brands/suse/` bærer sine egne verktøy og sin egen katalog under sine egne vilkår. Ingen verktøy importerer fra `engine/`, så oppdelingen forblir ren.

## Livssyklusen til én gjengivelse

Noen åpner `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`:

1. **Oppstart.** Nettappen åpner IndexedDB, bygger kapabilitetsbroen og synkroniserer verktøy- og ressurskatalogene, eller laster dem fra bufferen når den er uten nett.
2. **Rute.** Stien velger verktøyvisningen for `qr-code`, med spørringen som startverdier.
3. **Last.** `loadTool` henter `tool.json`, validerer den mot skjemaet og henter malen, stilene og hooks.
4. **Tolk lenken.** `parseUrlState` gjør parameterne om til inndataverdier. En ressursreferanse som `?logo=lolly/logo/primary` blir en uløst `{ id }`.
5. **Start kjøretiden.** `createRuntime(tool, host, initialValues)` bygger inndatamodellen fra profildata, standarder og lenken, løser opp ressursreferanser, laster hooks og kaller `onInit`.
6. **Gjengi.** Skallet abonnerer på kjøretiden, tegner kontrollene fra modellen og skriver den utfylte malen inn i `#tool-canvas`.
7. **Samhandle.** Å skrive kaller `runtime.setInput`, som bruker begrensninger, kaller `onInput`, fyller malen på nytt og tegner om.
8. **Eksporter.** **Download** kaller `runtime.export(node, format)`, og skallets `host.export` lager filen: et raster, en vektor fra DOM-vandreren, en PDF, et dokument eller et av de andre formatene i `schemas/tool.schema.json`. Fysiske enheter konverteres per format, og metadata og Content Credentials bygges inn der formatet kan holde dem. Eksperimentelle verktøy får vannmerket sitt fra verten, ikke verktøyet. [Templates and rendering](/info/tool-rendering.html) og [Export a file](/info/exporting.html) dekker eksporttrinnet.

![Eksportpanelet som ?options åpner: paret med filnavn og format, utdatastørrelsen og kontrollene som skriver filen](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Den samme livssyklusen kjører i Tauri, og i CLI-et med en DOM uten grensesnitt, der utdataene går til en fil eller stdout.

## Lisenser

Kode, inkludert `engine/`, `shells/`, `services/`, `schemas/` og dokumentgeneratoren, er MPL-2.0, i ett offentlig repositorium, [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). Dokumentasjonsprosa er CC BY-SA 4.0. Merkevarepakker bærer sine egne vilkår i hver pakkes `NOTICE.md`: fellesskapsverktøyene er MPL-2.0, og den private SUSE-pakken er proprietær for SUSE. [About](/info/about.html) har hele lisensmerknaden.
