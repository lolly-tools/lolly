# Lolly-architectuur

![Lolly-icoon - Grote groen-witte lollipop-snoep](/info/icon.svg)

Deze pagina is voor mensen die de code van Lolly wijzigen: hoe de engine, de shells en de toolpakketten in elkaar passen, waar elk in de repository staat en de afspraken die elke wijziging begrenzen. Wil je weten wat Lolly doet en wie het gebruikt, lees dan eerst [Hoe Lolly werkt](/info/how-lolly-works.html).

Twee aanvullingen gaan dieper. [`engine/README.md`](../engine/README.md) is de module-voor-module-kaart van de engine, gegenereerd uit de code. [Threat Model & Trust Boundaries](/info/threat-model.html) leest dezelfde architectuur als vertrouwensgrenzen, en is de pagina voor elke vraag over wat de engine als niet-vertrouwd behandelt.

## Het grote plaatje

Tools zijn bovenaan gegevens. De engine in het midden weet niets van enig platform. De shells onderaan implementeren één contract, en de catalogi leveren de inhoud.

![Tools leveren een manifest, sjabloon en hooks aan de gedeelde engine. Web-, Tauri- en terminalshells implementeren de HostV1-capabilitybrug en lezen tools en assets uit catalogi.](/info/diagrams/concepts/platform-layers.svg)

Als je het kunt beschrijven in pure gegevens en Handlebars, hoort het in de **engine**. Als het de DOM, het bestandssysteem, het netwerk of een browser- of besturingssysteem-API aanraakt, hoort het in de **host**, de kant van de shell van de brug. De engine is open source, en niets dat een bepaald merk of platform kent, komt in de engine.

## Repositorystructuur

Lolly is één repository. Elke map hieronder is een gewone map erin, behalve `brands/suse`, een **privé** git-submodule met het SUSE-toolpakket en de catalogus, die een openbare clone niet ophaalt. Welke pakketten een build leest is een contentprofiel (`profiles.json`), per proces opgelost in plaats van globaal omgeschakeld. [Build Guide](/info/build-guide.html) geeft de clone-opdracht en hoe een wijziging in het privépakket wordt gecommit.

| Map | Wat ze bevat |
|---|---|
| `engine/` | De platformonafhankelijke kern: loader, runtime, inputs, sjablonen, URL-modus, eenheden en de formaatmodules |
| `shells/` | De webapp, de Tauri-desktop- en mobiele apps, de CLI, de TUI en de browserextensie |
| `packages/` | De SDK voor toolmakers (`@lolly-tools/core`), de gedeelde Node-shellonderdelen en de docs-renderer, onder andere |
| `community/` | De merkonafhankelijke tools, plus de gedeelde emojipakketten |
| `brands/` | Merkpakketten: `lolly-demo` (Lolly Demo, het design system dat lolly.tools draait), `lolly-start` (het lege startpunt) en het privé-`suse` |
| `services/` | De optionele MCP-, certificaat- en Penpot-diensten, en de servercode die ze delen |
| `schemas/` | JSON Schema voor toolmanifesten, assetvermeldingen en assetverwijzingen |
| `scripts/`, `tests/`, `docs/`, `api/` | Build- en catalogusscripts, de engine-testsuite, deze docs en de gegenereerde serverless bundels |

::: details De engine- en shellbestanden die je het eerst tegenkomt
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

Er is geen `tools/`- of `catalog/`-map in de root van de repository. `packages/node-shell/src/content-roots.ts` beantwoordt "waar staat tool `<id>`" en "waar staat de catalogus" uit `profiles.json` wanneer erom gevraagd wordt. Een echt paar `tools/` en `catalog/` wordt alleen in een build-uitvoer geschreven, zoals `dist/`, een RPM-payload of een containerimage, omdat een browser die twee paden via HTTP ophaalt.

## Waar Lolly draait

Elk oppervlak gebruikt dezelfde engine en dezelfde toolbestanden.

- **De webapp.** Een progressive web app die offline werkt zodra haar service worker de tools en assets in de cache heeft. Ze heeft geen account nodig; de status staat in IndexedDB op elk apparaat. Eén responsieve lay-out bedient desktop en telefoon: op een telefoon wordt de bediening een paneel en openen de exportinstellingen vanuit een zwevende pil.
- **De desktop- en mobiele apps.** Tauri-pakketten van dezelfde webapp, met native bestandsdialogen, bestandssysteemstatus en volledig offline gebruik.
- **De CLI.** `lolly <tool-id> --input=value --output=file.png` laadt dezelfde engine in een headless DOM en schrijft het bestand. Het is URL-modus over een ander transport, geen aparte implementatie. Zie [CLI](/info/cli.html).
- **De TUI.** Een toetsenbord-eerst terminalapp op volledig scherm die de brug van de CLI hergebruikt, opgeslagen sessies op schijf bewaart (in de eigen map van de desktop-app wanneer de app is geïnstalleerd, anders onder `~/.lolly`) en alleen een afgebakende headless browser start wanneer een formaat er een nodig heeft. Zie [TUI](/info/tui.html).

![De gesplitste desktopweergave: bediening gegenereerd uit het manifest links, het live canvas rechts](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

Dezelfde tool op telefoonbreedte heeft geen tweede lay-out nodig: de bediening wordt een paneel bovenaan en het voorbeeld houdt het scherm.

![Een audiogram op een scherm van 430 px breed: het bedieningspaneel erboven, het afgeronde vierkante artwork eronder en de zwevende exportpil](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

De webapp levert ook **Batch** (`#/batch`, `shells/web/src/pro/`), een raster in spreadsheetstijl dat veel rijen tegelijk rendert over één of meerdere tools; [Batch en Multi-edit](/info/batch.html#make-many-versions-of-one-design) behandelt Batch. **Settings → Capabilities** brengt in kaart wat het platform zegt te kunnen.

![Batch bij een verse installatie: één lege rij die op een tool wacht, met het spreadsheetoppervlak en de knop Render op zijn plek voordat er gegevens komen](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

## Architecturale toezeggingen

Deze beslissingen zijn genomen. Een ervan wijzigen is een grote onderneming, omdat ze elke andere beslissing in de codebase vormgeven.

### 1. Declaratieve tools, met een imperatief ontsnappingsluik

Een tool is een manifest (`tool.json`), een sjabloon (`template.html`) en optionele `hooks.js`. **Het manifest declareert de inputs**, nooit het sjabloon: inputs worden niet afgeleid uit Handlebars-tokens. De meeste tools zijn alleen manifest en sjabloon, en daardoor kunnen niet-ontwikkelaars ze schrijven.

![De bediening van Street Map: een stadskeuzelijst, een themakeuze, gewichtsschuifregelaars en kleurtriggers, elk getekend uit een regel in het manifest](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

Tools die waarden berekenen, zoals QR-codering of grafiekvorming, voegen hooks toe: benoemde levenscyclusfuncties die de runtime aanroept met de capabilitybrug erin geïnjecteerd. Hooks zijn een portabiliteitscontract, geen beveiligingssandbox, en ze draaien binnen een tijdsbudget. Tools waarvan de hooks bewezen vrij zijn van paginaglobals dragen `isolate: true` en draaien in een Worker. [Tool hooks](/info/tool-hooks.html) bevat de levenscyclus en budgetten, en het [Threat Model](/info/threat-model.html) zegt wat de executor in de pagina wel en niet insluit.

### 2. Tools en assets zijn data, geen gebundelde code

De web- en Tauri-apps halen de tool- en assetcatalogi bij het opstarten op, zetten ze in de cache en werken met wat er is, dus een nieuwe tool of asset heeft geen app-release nodig. Assetbytes hebben een SHA-256-checksum, en de `id` en `version` van een asset sturen de ongeldigverklaring van de cache.

### 3. De capabilitybrug is de enige API die tools zien

Tools raken de DOM buiten hun sjabloon nooit aan, roepen `fetch` nooit rechtstreeks aan en lezen nooit het bestandssysteem. Ze roepen versiebeheerde `host.*`-methoden aan. De canonieke definitie van het contract is `packages/core/src/host-v1.ts`, de SDK voor toolmakers `@lolly-tools/core`, zodat een derde ertegen kan bouwen zonder van de engine afhankelijk te zijn; `engine/src/bridge/host-v1.ts` exporteert de types opnieuw.

| Vereiste API | Wat ze doet |
|---|---|
| `host.profile` | De gegevens van de gebruiker; vult inputs vooraf in via `bindToProfile` |
| `host.assets` | Catalogusquery's, assetresolutie en de kiezer van de host |
| `host.state` | Invoerslots opslaan en laden: IndexedDB op het web, het bestandssysteem in Tauri, geheugen in de CLI |
| `host.clipboard` | Tekst of een afbeelding naar het klembord schrijven, met terugvalopties per platform |
| `host.export` | Het renderdoel rasteriseren of serialiseren, en het bestandstransformatiepad op het apparaat |
| `host.log` | Gelaagde logging naar de host |

Elke andere API is optioneel en additief: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` en nog veel meer. Het manifest van een tool somt onder `requires` de optionele API's op die zijn hooks aanroepen zonder eerst te controleren, en een host die er een mist weigert de tool te laden; hooks detecteren de rest met feature detection. Een paar, zoals `recorder`, hebben ook een apparaatcapability nodig die de tool declareert. `packages/core/src/host-v1/apis.ts` somt ze allemaal op en [Host API](/info/host-api.html) documenteert elk ervan. Een methode toevoegen is een minor versie; er een verwijderen of wijzigen is een major versie, en v1 blijft werken wanneer v2 uitkomt.

### 4. Asset-id's zijn voor altijd

`lolly/logo/primary` is een contract. Eenmaal gepubliceerd verandert een id nooit en wordt nooit hergebruikt. Een bytewijziging verhoogt `version` in de assetvermelding, en een vervanging zet `deprecated: true` en eventueel `replacedBy`, zodat bestaande verwijzingen altijd worden opgelost. Daardoor blijven opgeslagen sessies en gedeelde links jarenlang werken.

### 5. URL-modus is first-class

Elke input is uit te drukken als URL-parameter, dus een link is een afgerond bestand:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Die link alleen, zonder iets anders erin, is het afgeronde bestand](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Wijzig een parameter en je hebt een ander bestand. Dit hele palet is één basiskleur, een harmonie en een aantal stappen:

![Negen stappen over vier kleurtinten, allemaal gegroeid uit de ene zaadkleur in de link](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

De CLI bouwt dezelfde URL-status uit zijn argumenten en draait dezelfde pijplijn, dus de CLI kan niet afwijken van de app. `engine/src/url-mode.ts` parst en serialiseert; een set gereserveerde namen (`format`, `width`, `dpi`, `c2pa`, `z` en andere) wordt nooit aan een tool doorgegeven, en [Reserved URL parameters](/info/url-parameters.html) somt ze allemaal op. Assetinputs reizen met hun `id` en worden opgelost via `host.assets.get()` voordat het sjabloon wordt gevuld.

### 6. Opslag loopt via de brug

De webapp gebruikt IndexedDB, Tauri het bestandssysteem en de CLI geheugen. Tools zien alleen `host.state.save(slot, data)` en `host.state.load(slot)`, nooit `localStorage`. Mensen kunnen per tool meerdere benoemde sessies bewaren zonder account. Omdat de brug de enige naad is, is die status ook overdraagbaar: `shells/web/src/data-transfer.ts` leest haar terug naar één `lolly-backup`-bestand dat op elke andere installatie kan worden geïmporteerd ([Data transfer](/info/data-transfer.html)), en [Sync](/info/sync.html) stuurt dezelfde bundel naar opslag die de persoon kiest.

### 7. Volwassenheidslabels tonen wat een tool is

Elke tool declareert `status: official | community | experimental`. De galerij sorteert op status, en experimentele tools plaatsen standaard een watermerk op hun exports: de runtime zet het watermerk aan tenzij de aanroeper `watermark: false` meegeeft, en tools op het apparaat zijn uitgezonderd. Welk proces een team ook rond de catalogus legt, het staat hier bovenop.

### 8. Inputs zijn getypeerd in het manifest

Een input declareert een `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` of `file`. De host rendert een besturingselement per type, dus tools schrijven geen besturingscode, en elke input kan `bindToProfile` dragen. Drie wegen het zwaarst:

- **`asset`**, met `filter` en `allowUpload`, is de brug naar het assetsysteem. `allowUpload: false` beperkt een slot tot bibliotheekassets, en uploads van gebruikers delen de `AssetRef`-vorm van de bibliotheek.
- **`blocks`** is een herhalende veldgroep die in een zijpaneel wordt bewerkt, gebruikt door Meeting Planner, Wayfinding, Diagrams en andere. Klikken op een gerenderd blok geeft de rij focus.
- **`file`** houdt het eigen bestand van de gebruiker in het geheugen voor hulpprogramma's op het apparaat zoals Strip Hidden Data en Compress, en **`vector`** groepeert een vaste set getallen in één besturingselement.

### 9. Sjablonen zijn logicavrij

Sjablonen zijn Handlebars, gekozen zodat niet-ontwikkelaars ze kunnen schrijven: `{{x}}` escapet, en `{{{x}}}` is een expliciete opt-in. Logica zit in `hooks.js`, waar ze expliciet en reviewbaar is. Veel sjablonen gebruiken `{{{` voor opmaak die een hook berekende, dus elke hook moet escapen wat hij doorgeeft. De helpers zijn `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` en `media`, plus `icsStamp`, `rfcText`, `csvCell` en `arrow` voor aanverwante `.ics`-, `.vcf`- en `.csv`-sjablonen. [Templates and rendering](/info/tool-rendering.html) behandelt ze.

### 10. Tools stellen tools samen

Een tool kan de render van een andere tool insluiten zonder import tussen tools; de engine lost de compositie op. Een manifest kan `composes: [{ id, tool, inputs }]` declareren en het kind plaatsen met `{{asset <id>}}`, en een draagbare embed-URL (`https://lolly.tools/tool/<id>.svg?…`) rendert het kind lokaal, zo plaatst Design een live QR-code of grafiek. Een SVG-kind blijft vector in een SVG- of PDF-ouder. Kinderen zijn tussenproducten, nooit van een watermerk of stempel voorzien, en een shell die er een niet kan renderen laat het slot leeg terwijl de ouder nog steeds rendert. [Composition and brand overlays](/info/tool-composition.html) bevat de details.

## Wat we bewust niet doen

- **Geen willekeurige JavaScript in sjablonen.** Logica zit in `hooks.js`.
- **Geen verplichte assetserver.** Mensen voegen hun eigen bestanden toe aan Assets in de app en geven werk door als sessie: een deellink voor inputs en instellingen, een `.lolly`-bestand wanneer ook uploads meereizen. Een gedeelde sessie kan een sjabloon worden in de keuzelijst van een tool. Een organisatie die een beheerde catalogus wil, kan de catalogus, goedkeuringen en het beleid van Lolly Work gebruiken, of het merkpakket in git beheren en wijzigingen daar reviewen.
- **Geen afgedwongen toegangsbeheer.** De open app is standaard openbaar, en volwassenheidstags en watermerken dragen het merkrisico. Aanmelden bij de organisatie, rollen en beleid komen van Lolly Work wanneer een team ze wil.
- **Geen centrale database.** Gebruikersstatus staat op elk apparaat, en optionele Sync kopieert die naar opslag die de persoon kiest, nooit naar een Lolly-database.
- **Geen gedeeld codepad tussen tools en de engine.** De engine en de communitytools zijn open source, en een merkpakket zoals het private `brands/suse/` draagt zijn eigen tools en catalogus onder zijn eigen voorwaarden. Geen enkele tool importeert uit `engine/`, zodat de scheiding schoon blijft.

## De levenscyclus van één render

Iemand opent `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`:

1. **Boot.** De webapp opent IndexedDB, bouwt de capabilitybrug en synchroniseert de tool- en assetcatalogi, of laadt ze uit de cache wanneer ze offline is.
2. **Route.** Het pad kiest de toolweergave voor `qr-code`, met de query als beginwaarden.
3. **Laden.** `loadTool` haalt `tool.json` op, valideert het tegen het schema en haalt het sjabloon, de stijlen en de hooks op.
4. **De link parsen.** `parseUrlState` zet de parameters om in inputwaarden. Een assetverwijzing zoals `?logo=lolly/logo/primary` wordt een onopgeloste `{ id }`.
5. **De runtime starten.** `createRuntime(tool, host, initialValues)` bouwt het inputmodel uit profielgegevens, standaardwaarden en de link, lost assetverwijzingen op, laadt de hooks en roept `onInit` aan.
6. **Renderen.** De shell abonneert zich op de runtime, tekent de besturingselementen uit het model en schrijft het gevulde sjabloon in `#tool-canvas`.
7. **Interactie.** Typen roept `runtime.setInput` aan, dat beperkingen toepast, `onInput` aanroept, het sjabloon opnieuw vult en opnieuw tekent.
8. **Exporteren.** **Download** roept `runtime.export(node, format)` aan, en `host.export` van de shell maakt het bestand: een raster, een vector uit de DOM-walker, een PDF, een document of een van de andere formaten in `schemas/tool.schema.json`. Fysieke eenheden worden per formaat omgezet, en metadata en Content Credentials worden ingesloten waar het formaat ze kan bevatten. Experimentele tools krijgen hun watermerk van de host, niet van de tool. [Templates and rendering](/info/tool-rendering.html) en [Een bestand exporteren](/info/exporting.html) behandelen de exportstap.

![Het exportpaneel dat ?options opent: het paar bestandsnaam en formaat, de uitvoergrootte en de bediening die het bestand schrijft](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Dezelfde levenscyclus draait in Tauri, en in de CLI met een headless DOM, waar de uitvoer naar een bestand of stdout gaat.

## Licenties

Code, inclusief `engine/`, `shells/`, `services/`, `schemas/` en de documentatiegenerator, is MPL-2.0, in één openbare repository, [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). Documentatieproza is CC BY-SA 4.0. Merkpakketten dragen hun eigen voorwaarden in de `NOTICE.md` van elk pakket: de communitytools zijn MPL-2.0, en het privé-SUSE-pakket is eigendom van SUSE. [About](/info/about.html) bevat de volledige licentienotitie.
