# De architectuur van Lolly

![Lolly-pictogram - Grote groene en witte lolly](/info/icon.svg)

Deze pagina is voor mensen die de code van Lolly aanpassen: hoe de engine, de shells en de toolpakketten samenhangen, waar ze in de repository staan en welke uitgangspunten elke wijziging begrenzen. Lees eerst [Hoe Lolly werkt](/info/how-lolly-works.html) om te leren wat Lolly doet en wie Lolly gebruikt.

[`engine/README.md`](https://github.com/lolly-tools/lolly/blob/main/engine/README.md) brengt de engine module voor module in kaart en wordt uit de code gegenereerd. [Dreigingsmodel & vertrouwensgrenzen](/info/threat-model.html) bekijkt dezelfde architectuur vanuit vertrouwensgrenzen en beschrijft wat de engine als onvertrouwd behandelt.

<!--i:eti-layers-->
## Het totaalbeeld

Bovenaan zijn tools gegevens. De engine in het midden weet niets van welk platform dan ook. De shells onderaan implementeren één contract en de catalogi leveren de inhoud.

![Tools leveren een manifest, sjabloon en hooks aan de gedeelde engine. Web-, Tauri- en terminalshells implementeren de HostV1-brug voor functionaliteit en lezen tools en assets uit catalogi.](/info/diagrams/concepts/platform-layers.svg)

Alles wat je in pure gegevens en Handlebars kunt beschrijven, hoort in de **engine**. Alles wat de DOM, het bestandssysteem, het netwerk of een browser- of besturingssysteem-API aanspreekt, hoort in de **host**, de kant van de brug die bij de shell hoort. De engine is open source. Niets dat een specifiek merk kent, komt in de engine.

<!--i:eti-folder-shared-->
## Indeling van de repository

Lolly is één repository. Elke map hieronder is een gewone map, behalve `brands/suse`: een **private** git-submodule met het SUSE-toolpakket en de catalogus, die een publieke kloon niet ophaalt. Een inhoudsprofiel (`profiles.json`) bepaalt welke pakketten een build leest. Elk proces bepaalt zijn eigen profiel en er is geen globale schakelaar. De [Buildgids](/info/build-guide.html) bevat het klooncommando en legt uit hoe je een wijziging binnen het private pakket commit.

| Map | Inhoud |
|---|---|
| `engine/` | De platformonafhankelijke kern: loader, runtime, invoer, sjablonen, URL-modus, eenheden en de formaatmodules |
| `shells/` | De webapp, de Tauri-desktop- en mobiele apps, de CLI, de TUI en de browserextensie |
| `packages/` | Onder andere de SDK voor toolmakers (`@lolly-tools/core`), de gedeelde onderdelen van de Node-shell en de documentatierenderer |
| `community/` | De merkonafhankelijke tools en de gedeelde emojipakketten |
| `brands/` | Merkpakketten: `lolly-demo` (Lolly Demo, het design system waarop lolly.tools draait), `lolly-start` (het lege startpunt) en het private `suse` |
| `services/` | De optionele MCP-, certificaat- en Penpot-diensten en de servercode die ze delen |
| `schemas/` | JSON Schema voor toolmanifesten, assetvermeldingen en assetverwijzingen |
| `scripts/`, `tests/`, `docs/`, `api/` | Build- en catalogusscripts, de testsuite van de engine, deze documentatie en de gegenereerde serverlessbundels |

::: details De engine- en shellbestanden die je als eerste tegenkomt
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

::: note Er is geen map `tools/` of `catalog/` in de hoofdmap van de repository
`packages/node-shell/src/content-roots.ts` beantwoordt "waar staat tool `<id>`" en "waar is de catalogus" aan de hand van `profiles.json`. Een echt paar `tools/` en `catalog/` wordt alleen naar build-uitvoer geschreven, zoals `dist/`, een RPM-payload of een containerimage, omdat een browser die twee paden via HTTP ophaalt.
:::

<!--i:eti-monitor-->
## Waar Lolly draait

Elke interface gebruikt dezelfde engine en dezelfde toolbestanden.

- **De webapp.** Een progressieve webapp. Hij werkt offline zodra zijn serviceworker de tools en assets heeft gecachet. Er is geen account nodig en de status staat op elk apparaat in IndexedDB. Eén responsieve lay-out bedient desktop en telefoon. Op een telefoon wordt de bediening een paneel en opent de exportbediening vanuit een zwevende pil.
- **De desktop- en mobiele apps.** Tauri-pakketten van dezelfde webapp, met native bestandsdialogen, status in het bestandssysteem en volledig offline gebruik.
- **De CLI.** `lolly <tool-id> --input=value --output=file.png` laadt dezelfde engine in een headless DOM en schrijft het bestand. Het is URL-modus via een ander transport. Zie [CLI](/info/cli.html).
- **De TUI.** Een terminalapp op volledig scherm, primair bedoeld voor toetsenbordbediening. Hij hergebruikt de brug van de CLI en bewaart opgeslagen sessies op schijf: in de map van de desktopapp als die is geïnstalleerd, anders onder `~/.lolly`. Hij start alleen een headless browser met beperkte scope wanneer een formaat er een nodig heeft. Zie [TUI](/info/tui.html).

![De gesplitste desktopweergave: links bediening gegenereerd uit het manifest, rechts het live canvas](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

Op telefoonbreedte staat het bedieningspaneel bovenaan en vult het voorbeeld het scherm.

![Een audiogram op een scherm van 430px breed: het bedieningspaneel bovenaan, het afgewerkte vierkante ontwerp eronder en de zwevende exportpil](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dzzfxm%3A7%3Alofi%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

De webapp bevat ook **Batch** (`#/batch`, `shells/web/src/pro/`), een raster in spreadsheetstijl dat veel rijen tegelijk rendert met één of meerdere tools. Zie [Batch en Lolly Multi-edit](/info/batch.html#make-many-versions-of-one-design). **Settings → Capabilities** somt alles op wat het platform aangeeft te kunnen.

![Batch op een nieuwe installatie: één lege rij wacht op een tool, met het spreadsheetoppervlak en de knop Render al op hun plek voordat er gegevens zijn](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

<!--i:eti-lock-->
## Architectuurprincipes

Deze beslissingen staan vast. Elke andere beslissing in de codebase hangt ervan af, dus er één wijzigen is een grote onderneming.

### 1. Declaratieve tools, met een imperatieve uitweg

Een tool bestaat uit een manifest (`tool.json`), een sjabloon (`template.html`) en optioneel `hooks.js`. **Het manifest declareert de invoer**. Invoer wordt nooit afgeleid van de Handlebars-tokens van het sjabloon. De meeste tools bestaan alleen uit een manifest en een sjabloon, zodat ook niet-ontwikkelaars ze kunnen maken.

![De bedieningsstack van Street Map: een keuzelijst voor de stad, een themakeuze, schuifregelaars voor lijndikte en kleurknoppen, elk afkomstig uit een regel in het manifest](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

Tools die waarden berekenen, zoals QR-codering of het vormgeven van diagrammen, voegen hooks toe: benoemde levenscyclusfuncties die de runtime aanroept met de brug voor functionaliteit geïnjecteerd. Hooks zijn een portabiliteitscontract, geen beveiligingssandbox. Ze draaien binnen een tijdsbudget. Tools waarvan bewezen is dat hun hooks geen globale paginavariabelen gebruiken, hebben `isolate: true` en draaien in een Worker. [Toolhooks](/info/tool-hooks.html) beschrijft de levenscyclus en de budgetten. Het [Dreigingsmodel](/info/threat-model.html) beschrijft wat de executor in de pagina wel en niet afschermt.

### 2. Tools en assets zijn gegevens, geen gebundelde code

De web- en Tauri-apps halen bij het opstarten de tool- en assetcatalogi op, cachen ze en werken met wat gecachet is. Een nieuwe tool of asset vereist geen apprelease. Assetbytes worden gecontroleerd met SHA-256-checksums. De `id` en `version` van een asset bepalen wanneer de cache ongeldig wordt.

### 3. De brug voor functionaliteit is de enige API die tools zien

Tools raken de DOM buiten hun sjabloon nooit aan, roepen `fetch` nooit direct aan en lezen het bestandssysteem nooit. Ze roepen `host.*`-methoden met versienummers aan. Het contract is gedefinieerd in `packages/core/src/host-v1.ts`, in de SDK voor toolmakers `@lolly-tools/core`. Een derde partij kan op de SDK bouwen zonder afhankelijk te zijn van de engine. `engine/src/bridge/host-v1.ts` exporteert de typen ervan opnieuw.

| Vereiste API | Wat die doet |
|---|---|
| `host.profile` | De gegevens van de gebruiker; vult invoer vooraf in via `bindToProfile` |
| `host.assets` | Catalogusquery's, het opzoeken van assets en de kiezer van de host |
| `host.state` | Invoerslots opslaan en laden: IndexedDB op het web, het bestandssysteem in Tauri, geheugen in de CLI |
| `host.clipboard` | Tekst of een afbeelding naar het klembord schrijven, met terugvalopties per platform |
| `host.export` | Het renderdoel rasteren of serialiseren en het pad voor bestandstransformatie op het apparaat |
| `host.log` | Logregistratie met niveaus naar de host |

Elke andere API is optioneel en aanvullend: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` en nog veel meer. In `requires` van een manifest staan de optionele API's die de hooks aanroepen zonder eerst te controleren. Een host die er één mist, weigert de tool te laden. Voor de rest controleren hooks of de functionaliteit beschikbaar is. Een paar, zoals `recorder`, vereisen ook een apparaatfunctie die de tool declareert. `packages/core/src/host-v1/apis.ts` somt ze allemaal op en [Host-API](/info/host-api.html) documenteert ze elk afzonderlijk. Een methode toevoegen betekent een minorversie. Een methode verwijderen of wijzigen betekent een majorversie en v1 blijft werken wanneer v2 verschijnt.

### 4. Asset-id's blijven voor altijd

`lolly/logo/primary` is een contract. Eenmaal gepubliceerd verandert een id nooit en wordt het nooit hergebruikt. Een wijziging van de bytes verhoogt `version` in de assetvermelding. Bij vervanging worden `deprecated: true` en optioneel `replacedBy` ingesteld. Bestaande verwijzingen blijven altijd werken, zodat opgeslagen sessies en gedeelde links jarenlang blijven werken.

### 5. URL-modus is volwaardig

Elke invoer kan als URL-parameter worden uitgedrukt, dus een link is een afgerond bestand:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Die link alleen, zonder iets anders erin, is het afgeronde bestand](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Wijzig een parameter en je krijgt een ander bestand. Dit palet bestaat uit één basiskleur, een harmonie en een aantal stappen:

![Negen stappen over vier tinten, allemaal ontstaan uit de ene basiskleur in de link](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

De CLI bouwt dezelfde URL-status op uit zijn argumenten en voert dezelfde pijplijn uit, zodat de CLI niet van de app kan afwijken. `engine/src/url-mode.ts` parseert en serialiseert de URL-status. Gereserveerde namen (`format`, `width`, `dpi`, `c2pa`, `z` en andere) worden nooit aan een tool doorgegeven. [Gereserveerde URL-parameters](/info/url-parameters.html) somt ze allemaal op. Assetinvoer reist mee via `id` en wordt via `host.assets.get()` opgezocht voordat het sjabloon wordt ingevuld.

### 6. Opslag verloopt via de brug

De webapp gebruikt IndexedDB, Tauri het bestandssysteem en de CLI het geheugen. Tools zien alleen `host.state.save(slot, data)` en `host.state.load(slot)`, nooit `localStorage`. Mensen kunnen zonder account meerdere benoemde sessies per tool bewaren. Omdat de brug het enige koppelvlak is, is die status ook overdraagbaar. `shells/web/src/data-transfer.ts` exporteert de status als één `lolly-backup`-bestand dat in elke andere installatie kan worden geïmporteerd ([Gegevensoverdracht](/info/data-transfer.html)). [Sync](/info/sync.html) stuurt dezelfde bundel naar opslag die de persoon kiest.

### 7. Volwassenheidslabels geven aan wat een tool is

Elke tool declareert `status: official | community | experimental`. De galerij sorteert op status. Experimentele tools voorzien hun exports standaard van een watermerk: de runtime zet het watermerk aan tenzij de aanroeper `watermark: false` meegeeft. Tools die op het apparaat werken zijn vrijgesteld. Het eigen catalogusproces van een team bouwt voort op deze labels.

### 8. Invoer krijgt een type in het manifest

Een invoer declareert een `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` of `file`. De host rendert een bedieningselement voor elk type, zodat tools geen bedieningscode schrijven. Elke invoer kan `bindToProfile` bevatten. Drie typen zijn het belangrijkst:

- **`asset`**, met `filter` en `allowUpload`, is de brug naar het assetsysteem. `allowUpload: false` beperkt een slot tot assets uit de bibliotheek. Uploads van gebruikers hebben dezelfde `AssetRef`-structuur als de bibliotheek.
- **`blocks`** is een herhalende veldgroep die in een zijpaneel wordt bewerkt en door onder andere Meeting Planner, Wayfinding en Diagrams wordt gebruikt. Klikken op een gerenderd blok geeft de bijbehorende rij focus.
- **`file`** bewaart het eigen bestand van de gebruiker in het geheugen voor hulpprogramma's op het apparaat, zoals Lolly Strip Hidden Data en Compress, en **`vector`** groepeert een vaste reeks getallen in één bedieningselement.

### 9. Sjablonen bevatten geen logica

Sjablonen gebruiken Handlebars, zodat niet-ontwikkelaars ze kunnen schrijven. `{{x}}` escapet en `{{{x}}}` is een expliciete opt-in. Logica staat in `hooks.js`, waar die kan worden beoordeeld. Veel sjablonen gebruiken `{{{` voor markup die een hook heeft berekend, dus elke hook moet escapen wat die doorgeeft. De helpers zijn `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` en `media`, plus `icsStamp`, `rfcText`, `csvCell` en `arrow` voor bijbehorende `.ics`-, `.vcf`- en `.csv`-sjablonen. [Sjablonen en renderen](/info/tool-rendering.html) behandelt ze.

### 10. Tools combineren tools

Een tool kan de render van een andere tool insluiten zonder imports tussen tools. De engine handelt de compositie af. Een manifest kan `composes: [{ id, tool, inputs }]` declareren en het onderliggende onderdeel plaatsen met `{{asset <id>}}`. Een overdraagbare insluit-URL (`https://lolly.tools/tool/<id>.svg?…`) rendert het onderdeel lokaal; Lolly Design plaatst zo een live QR-code of diagram. Een ingesloten SVG blijft vector in een bovenliggende SVG of PDF. Ingesloten onderdelen zijn tussenresultaten en krijgen nooit een watermerk of stempel. Een shell die een onderdeel niet kan renderen, laat het slot leeg en de bovenliggende tool rendert nog steeds. [Compositie en merkoverlays](/info/tool-composition.html) geeft de details.

<!--i:eti-scissors-->
## Wat we bewust niet doen

- **Geen willekeurige JavaScript in sjablonen.** Logica staat in `hooks.js`.
- **Geen verplichte assetserver.** Mensen voegen hun eigen bestanden toe aan Assets in de app en geven werk door als sessie: een deellink voor invoer en instellingen, een `.lolly`-bestand wanneer uploads ook meegaan. Een gedeelde sessie kan een sjabloon worden in de kiezer van een tool. Een organisatie die een beheerde catalogus wil, kan de catalogus, goedkeuringen en het beleid van Lolly Work gebruiken of het merkpakket in git beheren en wijzigingen daar beoordelen.
- **Geen verplichte toegangscontrole.** De open app is standaard openbaar. Volwassenheidslabels en watermerken dragen het merkrisico. Aanmelding bij de organisatie, rollen en beleid komen van Lolly Work wanneer een team die wil.
- **Geen centrale database.** De gebruikersstatus staat op elk apparaat en optionele Sync kopieert die naar opslag die de persoon kiest, nooit naar een Lolly-database.
- **Geen gedeeld codepad tussen tools en de engine.** De engine en de communitytools zijn open source. Een merkpakket zoals het private `brands/suse/` bevat zijn eigen tools en catalogus onder zijn eigen voorwaarden. Geen enkele tool importeert uit `engine/`, zodat de scheiding helder blijft.

<!--i:eti-refresh-->
## De levenscyclus van één render

Iemand opent `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`:

1. **Opstarten.** De webapp opent IndexedDB, bouwt de brug voor functionaliteit en synchroniseert de tool- en assetcatalogi of laadt ze offline uit de cache.
2. **Routeren.** Het pad selecteert de toolweergave voor `qr-code`, met de query als beginwaarden.
3. **Laden.** `loadTool` haalt `tool.json` op, valideert het tegen het schema en haalt het sjabloon, de stijlen en de hooks op.
4. **De link parseren.** `parseUrlState` zet de parameters om in invoerwaarden. Een assetverwijzing zoals `?logo=lolly/logo/primary` wordt een nog niet opgeloste `{ id }`.
5. **De runtime starten.** `createRuntime(tool, host, initialValues)` bouwt het invoermodel op uit profielgegevens, standaardwaarden en de link, zoekt assetverwijzingen op, laadt de hooks en roept `onInit` aan.
6. **Renderen.** De shell abonneert zich op de runtime, tekent de bediening vanuit het model en schrijft het ingevulde sjabloon naar `#tool-canvas`.
7. **Interactie.** Typen roept `runtime.setInput` aan, dat beperkingen toepast, `onInput` aanroept, het sjabloon opnieuw invult en opnieuw tekent.
8. **Exporteren.** **Download** roept `runtime.export(node, format)` aan en `host.export` van de shell maakt het bestand: een raster, een vector uit de DOM-walker, een PDF, een document of een van de andere formaten in `schemas/tool.schema.json`. Fysieke eenheden worden per formaat omgerekend. Metadata en Content Credentials worden ingesloten waar het formaat die kan bevatten. Experimentele tools krijgen hun watermerk van de host, niet van de tool. [Sjablonen en renderen](/info/tool-rendering.html) en [Een bestand exporteren](/info/exporting.html) behandelen de exportstap.

![Het exportpaneel dat ?options opent: het paar bestandsnaam en formaat, het uitvoerformaat en de bediening die het bestand schrijft](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Dezelfde levenscyclus draait in Tauri en in de CLI met een headless DOM, waar de uitvoer naar een bestand of stdout gaat.

<!--i:eti-stamp-->
## Licenties

Code, inclusief `engine/`, `shells/`, `services/`, `schemas/` en de documentatiegenerator, valt onder MPL-2.0 en staat in één publieke repository, [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). Documentatietekst valt onder CC BY-SA 4.0. Merkpakketten hebben hun eigen voorwaarden in de `NOTICE.md` van elk pakket: de communitytools vallen onder MPL-2.0 en het private SUSE-pakket is propriëtaire software van SUSE. [Over](/info/about.html) bevat de volledige licentietoelichting.
