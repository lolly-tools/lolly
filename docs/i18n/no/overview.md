# Lollys arkitektur

![Lolly-ikon - stor grønn og hvit kjærlighet på pinne](/info/icon.svg)

Denne siden er for deg som endrer Lollys kode: hvordan motoren, skallene og verktøypakkene passer sammen, hvor de ligger i kodelageret og føringene som gjelder for hver endring. Les først [Slik fungerer Lolly](/info/how-lolly-works.html) for å lære hva Lolly gjør og hvem som bruker Lolly.

[`engine/README.md`](https://github.com/lolly-tools/lolly/blob/main/engine/README.md) kartlegger motoren modul for modul og genereres fra koden. [Trusselmodell & tillitsgrenser](/info/threat-model.html) beskriver den samme arkitekturen som tillitsgrenser og sier hva motoren behandler som ikke-klarert.

<!--i:eti-layers-->
## Det store bildet

Verktøyene er data øverst. Motoren i midten vet ingenting om noen plattform. Skallene nederst implementerer én kontrakt, og katalogene leverer innholdet.

![Verktøyene leverer et manifest, en mal og hooks til den delte motoren. Web-, Tauri- og terminalskall implementerer funksjonalitetsbroen HostV1 og leser verktøy og ressurser fra kataloger.](/info/diagrams/concepts/platform-layers.svg)

Alt du kan beskrive med rene data og Handlebars, hører hjemme i **motoren**. Alt som berører DOM, filsystemet, nettverket eller et API i nettleseren eller operativsystemet, hører hjemme i **verten**, skallets side av broen. Motoren har åpen kildekode. Ingenting som kjenner til en bestemt merkevare, går inn i motoren.

<!--i:eti-folder-shared-->
## Kodelagerets struktur

Lolly er ett kodelager. Hver mappe nedenfor er en vanlig mappe, unntatt `brands/suse`: en **privat** git-undermodul med SUSE-verktøypakken og katalogen, som en offentlig klone ikke henter. En innholdsprofil (`profiles.json`) bestemmer hvilke pakker en byggversjon leser. Hver prosess finner sin egen profil, og det finnes ingen global bryter. [Byggeveiledningen](/info/build-guide.html) har klonekommandoen og forklarer hvordan du sjekker inn en endring i den private pakken.

| Mappe | Innhold |
|---|---|
| `engine/` | Den plattformuavhengige kjernen: innlaster, kjøretidsmiljø, inndata, maler, URL-modus, enheter og formatmodulene |
| `shells/` | Nettappen, Tauri-appene for datamaskin og mobil, CLI, TUI og nettleserutvidelsen |
| `packages/` | SDK-et for verktøyforfattere (`@lolly-tools/core`), de delte delene av Node-skallet og dokumentasjonsgjengiveren, blant annet |
| `community/` | De merkevareuavhengige verktøyene, pluss de delte emojipakkene |
| `brands/` | Merkevarepakker: `lolly-demo` (Lolly Demo, designsystemet lolly.tools bruker), `lolly-start` (det tomme utgangspunktet) og den private `suse` |
| `services/` | De valgfrie MCP-, sertifikat- og Penpot-tjenestene og serverkoden de deler |
| `schemas/` | JSON Schema for verktøymanifester, ressursoppføringer og ressursreferanser |
| `scripts/`, `tests/`, `docs/`, `api/` | Bygge- og katalogskript, motorens testsamling, denne dokumentasjonen og de genererte serverløse pakkene |

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

::: note Det finnes ingen `tools/`- eller `catalog/`-mappe i roten av kodelageret
`packages/node-shell/src/content-roots.ts` svarer på «hvor ligger verktøyet `<id>`» og «hvor er katalogen» ut fra `profiles.json`. Et faktisk par med `tools/` og `catalog/` skrives bare til et byggeresultat, som `dist/`, innholdet i en RPM-pakke eller et containerbilde, fordi en nettleser henter disse to stiene over HTTP.
:::

<!--i:eti-monitor-->
## Hvor Lolly kjører

Alle grensesnitt bruker den samme motoren og de samme verktøyfilene.

- **Nettappen.** En progressiv nettapp. Den fungerer uten nett når service workeren har mellomlagret verktøyene og ressursene. Den trenger ingen konto, og tilstanden lagres i IndexedDB på hver enhet. Én responsiv layout brukes på datamaskin og telefon. På en telefon blir kontrollene til et panel, og eksportkontrollene åpnes fra en flytende pille.
- **Appene for datamaskin og mobil.** Tauri-pakker av den samme nettappen, med plattformens egne fildialoger, tilstand i filsystemet og full bruk uten nett.
- **CLI.** `lolly <tool-id> --input=value --output=file.png` laster den samme motoren i en DOM uten grafisk grensesnitt og skriver filen. Det er URL-modus over en annen transport. Se [CLI](/info/cli.html).
- **TUI.** En terminalapp i fullskjerm, laget for tastaturbruk. Den gjenbruker broen til CLI og lagrer økter på disk: i skrivebordsappens mappe når appen er installert, ellers under `~/.lolly`. Den starter bare en avgrenset nettleser uten grafisk grensesnitt når et format trenger en. Se [TUI](/info/tui.html).

![Den delte visningen på datamaskin: kontroller generert fra manifestet til venstre, det levende lerretet til høyre](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

Ved telefonbredde ligger kontrollpanelet øverst, og forhåndsvisningen fyller skjermen.

![Et audiogram på en 430px bred skjerm: kontrollpanelet over, den ferdige kvadratiske grafikken under og den flytende eksportpillen](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dzzfxm%3A7%3Alofi%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

Nettappen leveres også med **Batch** (`#/batch`, `shells/web/src/pro/`), et regnearklignende rutenett som gjengir mange rader samtidig på tvers av ett eller flere verktøy. Se [Batch og Lolly Multi-edit](/info/batch.html#make-many-versions-of-one-design). **Settings → Capabilities** lister alt plattformen oppgir at den kan gjøre.

![Batch i en ny installasjon: én tom rad venter på et verktøy, med regnearkflaten og Render-knappen på plass før det kommer data](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

<!--i:eti-lock-->
## Arkitektoniske føringer

Disse beslutningene er fastlagt. Alle andre beslutninger i kodebasen avhenger av dem, så å endre en av dem er et stort arbeid.

### 1. Deklarative verktøy, med en imperativ utvei

Et verktøy består av et manifest (`tool.json`), en mal (`template.html`) og eventuelt `hooks.js`. **Manifestet deklarerer inndataene**. Inndata utledes aldri fra malens Handlebars-tokener. De fleste verktøy består bare av et manifest og en mal, så også de som ikke er utviklere, kan lage dem.

![Kontrollstabelen i Street Map: en rullegardin for by, en temavelger, glidere for strektykkelse og fargeknapper, alle hentet fra en linje i manifestet](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

Verktøy som beregner verdier, som QR-koding eller utforming av diagrammer, legger til hooks: navngitte livssyklusfunksjoner som kjøretidsmiljøet kaller med funksjonalitetsbroen injisert. Hooks er en kontrakt for flyttbarhet, ikke en sikkerhetssandkasse. De kjører innenfor et tidsbudsjett. Verktøy med hooks som er bekreftet frie for sidens globale variabler, har `isolate: true` og kjører i en Worker. [Verktøyhooks](/info/tool-hooks.html) beskriver livssyklusen og budsjettene. [Trusselmodellen](/info/threat-model.html) sier hva kjøremekanismen i siden isolerer og ikke isolerer.

### 2. Verktøy og ressurser er data, ikke kode i apppakken

Nettappen og Tauri-appene henter verktøy- og ressurskatalogene ved oppstart, mellomlagrer dem og arbeider med det som er mellomlagret. Et nytt verktøy eller en ny ressurs krever ingen ny appversjon. Ressursbytene kontrolleres med SHA-256-sjekksummer. En ressurs sin `id` og `version` styrer ugyldiggjøring av mellomlageret.

### 3. Funksjonalitetsbroen er det eneste API-et verktøyene ser

Verktøy berører aldri DOM utenfor sin egen mal, kaller aldri `fetch` direkte og leser aldri filsystemet. De kaller versjonerte `host.*`-metoder. Kontrakten er definert i `packages/core/src/host-v1.ts`, i SDK-et for verktøyforfattere, `@lolly-tools/core`. En tredjepart kan bygge mot SDK-et uten å være avhengig av motoren. `engine/src/bridge/host-v1.ts` eksporterer typene videre.

| Påkrevd API | Hva det gjør |
|---|---|
| `host.profile` | Brukerens opplysninger; forhåndsutfyller inndata gjennom `bindToProfile` |
| `host.assets` | Katalogspørringer, oppslag av ressurser og vertens velger |
| `host.state` | Lagrer og laster inndataplasser: IndexedDB på nettet, filsystemet i Tauri, minnet i CLI |
| `host.clipboard` | Skriver tekst eller et bilde til utklippstavlen, med plattformtilpassede reserveløsninger |
| `host.export` | Rasteriserer eller serialiserer gjengivelsesmålet og håndterer filtransformasjon på enheten |
| `host.log` | Logging til verten med loggnivåer |

Alle andre API-er er valgfrie tillegg: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` og mange flere. Manifestets `requires` lister de valgfrie API-ene som hooks kaller uten å sjekke først. En vert som mangler ett av dem, nekter å montere verktøyet. Hooks sjekker om resten av funksjonene finnes. Noen få, som `recorder`, trenger også en enhetsfunksjon som verktøyet deklarerer. `packages/core/src/host-v1/apis.ts` lister dem alle, og [Host API](/info/host-api.html) dokumenterer hvert av dem. Å legge til en metode gir en ny underversjon. Å fjerne eller endre en gir en ny hovedversjon, og v1 fortsetter å fungere når v2 lanseres.

### 4. Ressurs-ID-er varer evig

`lolly/logo/primary` er en kontrakt. Når en ID er publisert, endres den aldri og gjenbrukes aldri. En endring i bytene øker `version` i ressursoppføringen. Ved erstatning settes `deprecated: true` og eventuelt `replacedBy`. Eksisterende referanser kan alltid slås opp, så lagrede økter og delte lenker fortsetter å fungere i årevis.

### 5. URL-modus er fullt integrert

Alle inndata kan uttrykkes som URL-parametere, så en lenke er en ferdig fil:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Denne lenken alene, uten noe annet i den, er den ferdige filen](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Endre en parameter, så får du en annen fil. Denne paletten består av én utgangsfarge, en harmoni og et antall trinn:

![Ni trinn over fire fargetoner, alle laget fra den ene utgangsfargen i lenken](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

CLI bygger den samme URL-tilstanden fra argumentene sine og kjører den samme behandlingskjeden, så CLI kan ikke avvike fra appen. `engine/src/url-mode.ts` tolker og serialiserer URL-tilstanden. Reserverte navn (`format`, `width`, `dpi`, `c2pa`, `z` og andre) sendes aldri til et verktøy. [Reserverte URL-parametere](/info/url-parameters.html) lister dem alle. Ressursinndata overføres med `id` og slås opp gjennom `host.assets.get()` før malen fylles ut.

### 6. Lagring går gjennom broen

Nettappen bruker IndexedDB, Tauri bruker filsystemet og CLI bruker minnet. Verktøy ser bare `host.state.save(slot, data)` og `host.state.load(slot)`, aldri `localStorage`. Du kan beholde flere navngitte økter per verktøy uten konto. Fordi broen er det eneste koblingspunktet, kan tilstanden også flyttes. `shells/web/src/data-transfer.ts` eksporterer tilstanden som én `lolly-backup`-fil som kan importeres i enhver annen installasjon ([Dataoverføring](/info/data-transfer.html)). [Sync](/info/sync.html) sender den samme pakken til lagringsplassen du velger.

### 7. Modenhetsmerker sier hva et verktøy er

Hvert verktøy deklarerer `status: official | community | experimental`. Galleriet sorterer etter status. Eksperimentelle verktøy vannmerker eksportene som standard: kjøretidsmiljøet slår på vannmerket med mindre den som kaller, sender `watermark: false`. Verktøy for behandling på enheten er unntatt. Et teams egen katalogprosess bygger videre på disse merkene.

### 8. Inndata får typer i manifestet

En inndata deklarerer en `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` eller `file`. Verten gjengir en kontroll for hver type, så verktøyene trenger ingen kode for kontroller. Alle inndata kan ha `bindToProfile`. Tre typer er viktigst:

- **`asset`**, med `filter` og `allowUpload`, er broen til ressurssystemet. `allowUpload: false` begrenser en plass til ressurser fra biblioteket. Brukeropplastinger har samme `AssetRef`-struktur som biblioteket.
- **`blocks`** er en repeterende feltgruppe som redigeres i et sidepanel, brukt av Meeting Planner, Wayfinding, Diagrams og andre. Et klikk på en gjengitt blokk gir den tilhørende raden fokus.
- **`file`** holder brukerens egen fil i minnet for filverktøy på enheten, som Lolly Strip Hidden Data og Compress, og **`vector`** grupperer et fast sett med tall i én kontroll.

### 9. Maler er uten logikk

Maler bruker Handlebars, så også de som ikke er utviklere, kan skrive dem. `{{x}}` escaper innholdet, og `{{{x}}}` er et uttrykkelig valg om å la være. Logikken ligger i `hooks.js`, der den kan gjennomgås. Mange maler bruker `{{{` for markup som en hook har beregnet, så hver hook må escape det den leverer. Hjelpefunksjonene er `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` og `media`, pluss `icsStamp`, `rfcText`, `csvCell` og `arrow` for tilhørende `.ics`-, `.vcf`- og `.csv`-maler. [Maler og gjengivelse](/info/tool-rendering.html) dekker dem.

### 10. Verktøy setter sammen verktøy

Et verktøy kan bygge inn gjengivelsen til et annet verktøy uten importer mellom verktøyene. Motoren håndterer sammensetningen. Et manifest kan deklarere `composes: [{ id, tool, inputs }]` og plassere barnet med `{{asset <id>}}`. En flyttbar innbyggings-URL (`https://lolly.tools/tool/<id>.svg?…`) gjengir barnet lokalt; Lolly Design plasserer en levende QR-kode eller et diagram på denne måten. Et SVG-barn forblir vektor i en SVG- eller PDF-forelder. Barna er mellomresultater og får aldri vannmerke eller stempel. Et skall som ikke kan gjengi et barn, lar plassen stå tom, og forelderen gjengis likevel. [Sammensetning og merkevareoverlegg](/info/tool-composition.html) har detaljene.

<!--i:eti-scissors-->
## Hva vi valgte bort

- **Ingen vilkårlig JavaScript i maler.** Logikken ligger i `hooks.js`.
- **Ingen obligatorisk ressursserver.** Du legger til egne filer i Assets i appen og sender arbeid videre som en økt: en delingslenke for inndata og innstillinger, en `.lolly`-fil når opplastinger også skal følge med. En delt økt kan bli en mal i verktøyets velger. En organisasjon som ønsker en styrt katalog, kan bruke Lolly Works katalog, godkjenninger og policyer, eller forvalte merkevarepakken i git og gjennomgå endringer der.
- **Ingen tvungen tilgangskontroll.** Den åpne appen er offentlig som standard. Modenhetsmerker og vannmerker formidler merkevarerisikoen. Organisasjonspålogging, roller og policy kommer fra Lolly Work når et team ønsker det.
- **Ingen sentral database.** Brukertilstanden ligger på hver enhet, og valgfri Sync kopierer den til lagringsplassen brukeren velger, aldri til en Lolly-database.
- **Ingen delt kodebane mellom verktøyene og motoren.** Motoren og fellesskapets verktøy har åpen kildekode. En merkevarepakke som den private `brands/suse/` har egne verktøy og egen katalog under egne vilkår. Ingen verktøy importerer fra `engine/`, så skillet forblir tydelig.

<!--i:eti-refresh-->
## Livssyklusen til én gjengivelse

Noen åpner `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`:

1. **Oppstart.** Nettappen åpner IndexedDB, bygger funksjonalitetsbroen og synkroniserer verktøy- og ressurskatalogene, eller laster dem fra mellomlageret uten nett.
2. **Ruting.** Stien velger verktøyvisningen for `qr-code`, med spørringen som startverdier.
3. **Innlasting.** `loadTool` henter `tool.json`, validerer det mot skjemaet og henter malen, stilene og hooks.
4. **Tolk lenken.** `parseUrlState` gjør parameterne om til inndataverdier. En ressursreferanse som `?logo=lolly/logo/primary` blir til en uavklart `{ id }`.
5. **Start kjøretidsmiljøet.** `createRuntime(tool, host, initialValues)` bygger inndatamodellen fra profildata, standardverdier og lenken, slår opp ressursreferanser, laster hooks og kaller `onInit`.
6. **Gjengivelse.** Skallet abonnerer på kjøretidsmiljøet, tegner kontrollene fra modellen og skriver den utfylte malen inn i `#tool-canvas`.
7. **Samhandling.** Skriving kaller `runtime.setInput`, som håndhever begrensninger, kaller `onInput`, fyller ut malen på nytt og tegner på nytt.
8. **Eksport.** **Download** kaller `runtime.export(node, format)`, og skallets `host.export` lager filen: et rasterbilde, en vektor fra DOM-gjennomgangen, en PDF, et dokument eller et av de andre formatene i `schemas/tool.schema.json`. Fysiske enheter konverteres per format. Metadata og Content Credentials bygges inn der formatet støtter dem. Eksperimentelle verktøy får vannmerket sitt fra verten, ikke fra verktøyet. [Maler og gjengivelse](/info/tool-rendering.html) og [Eksporter en fil](/info/exporting.html) dekker eksporttrinnet.

![Eksportpanelet som ?options åpner: filnavnet og formatet, utdatastørrelsen og kontrollene som skriver filen](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Den samme livssyklusen kjører i Tauri og i CLI med en DOM uten grafisk grensesnitt, der resultatet går til en fil eller stdout.

<!--i:eti-stamp-->
## Lisenser

Koden, inkludert `engine/`, `shells/`, `services/`, `schemas/` og dokumentasjonsgeneratoren, er lisensiert under MPL-2.0 og ligger i ett offentlig kodelager, [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). Dokumentasjonsteksten er lisensiert under CC BY-SA 4.0. Merkevarepakker har egne vilkår i pakkens `NOTICE.md`: fellesskapets verktøy er lisensiert under MPL-2.0, og den private SUSE-pakken tilhører SUSE og har en proprietær lisens. [Om](/info/about.html) har den fullstendige lisensmerknaden.
