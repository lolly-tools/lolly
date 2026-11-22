# Lollys arkitektur

![Lolly-ikon - stor grönvit klubba](/info/icon.svg)

Den här sidan är för dig som ändrar Lollys kod: hur motorn, skalen och verktygspaketen hänger ihop, var de finns i kodförrådet och vilka åtaganden som sätter ramarna för varje ändring. För att lära dig vad Lolly gör och vem som använder Lolly, läs först [Så fungerar Lolly](/info/how-lolly-works.html).

[`engine/README.md`](https://github.com/lolly-tools/lolly/blob/main/engine/README.md) kartlägger motorn modul för modul och genereras från koden. [Hotmodell & tillitsgränser](/info/threat-model.html) beskriver samma arkitektur utifrån tillitsgränser och anger vad motorn behandlar som opålitligt.

<!--i:eti-layers-->
## Helhetsbilden

Överst finns verktygen som data. Motorn i mitten känner inte till någon plattform. Skalen längst ner implementerar ett enda kontrakt och katalogerna tillhandahåller innehållet.

![Verktygen tillhandahåller ett manifest, en mall och hooks till den gemensamma motorn. Webb-, Tauri- och terminalskal implementerar funktionsbryggan HostV1 och läser verktyg och tillgångar från kataloger.](/info/diagrams/concepts/platform-layers.svg)

Allt du kan beskriva med rena data och Handlebars hör hemma i **motorn**. Allt som berör DOM, filsystemet, nätverket eller något API för webbläsaren eller operativsystemet hör hemma i **värden**, skalets sida av bryggan. Motorn har öppen källkod. Inget som känner till ett visst varumärke får finnas i motorn.

<!--i:eti-folder-shared-->
## Kodförrådets struktur

Lolly är ett enda kodförråd. Varje katalog nedan är en vanlig katalog, utom `brands/suse`: en **privat** git-undermodul med SUSE:s verktygspaket och katalog som en offentlig klon inte hämtar. En innehållsprofil (`profiles.json`) anger vilka paket ett bygge läser. Varje process bestämmer sin egen profil och det finns ingen global omkopplare. [Byggguide](/info/build-guide.html) har kloningskommandot och beskriver hur du checkar in en ändring i det privata paketet.

| Katalog | Vad den innehåller |
|---|---|
| `engine/` | Den plattformsoberoende kärnan: inläsare, körmiljö, indata, mallar, URL-läge, enheter och formatmodulerna |
| `shells/` | Webbappen, Tauri-apparna för dator och mobil, CLI, TUI och webbläsartillägget |
| `packages/` | SDK:t för verktygsutvecklare (`@lolly-tools/core`), de gemensamma delarna av Node-skalet och dokumentationsrenderaren, bland annat |
| `community/` | De varumärkesoberoende verktygen samt de gemensamma emojipaketen |
| `brands/` | Varumärkespaket: `lolly-demo` (Lolly Demo, designsystemet som lolly.tools använder), `lolly-start` (den tomma startpunkten) och det privata `suse` |
| `services/` | De valfria MCP-, certifikat- och Penpot-tjänsterna samt serverkoden de delar |
| `schemas/` | JSON Schema för verktygsmanifest, tillgångsposter och tillgångsreferenser |
| `scripts/`, `tests/`, `docs/`, `api/` | Bygg- och katalogskript, motorns testsvit, den här dokumentationen och de genererade serverlösa paketen |

::: details De motor- och skalfiler du möter först
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

::: note Det finns ingen `tools/`- eller `catalog/`-katalog i kodförrådets rot
`packages/node-shell/src/content-roots.ts` besvarar "var finns verktyget `<id>`" och "var finns katalogen" utifrån `profiles.json`. Ett riktigt par med `tools/` och `catalog/` skrivs bara till byggresultatet, som `dist/`, innehållet i ett RPM-paket eller en containeravbildning, eftersom en webbläsare hämtar de två sökvägarna via HTTP.
:::

<!--i:eti-monitor-->
## Var Lolly körs

Varje gränssnitt använder samma motor och samma verktygsfiler.

- **Webbappen.** En progressiv webbapp. Den fungerar offline när dess service worker har cachelagrat verktygen och tillgångarna. Den behöver inget konto och tillståndet finns i IndexedDB på varje enhet. En responsiv layout används på både dator och telefon. På en telefon blir kontrollerna en panel och exportkontrollerna öppnas från ett svävande piller.
- **Dator- och mobilapparna.** Tauri-paket med samma webbapp, med inbyggda fildialoger, tillstånd lagrat i filsystemet och fullständig offlineanvändning.
- **CLI.** `lolly <tool-id> --input=value --output=file.png` läser in samma motor i en DOM utan grafiskt gränssnitt och skriver filen. Det är URL-läge via en annan transport. Se [CLI](/info/cli.html).
- **TUI.** En terminalapp i helskärm som främst styrs med tangentbordet. Den återanvänder CLI:ts brygga och behåller sparade sessioner på disk: i datorappens mapp när appen är installerad, annars under `~/.lolly`. Den startar en avgränsad webbläsare utan grafiskt gränssnitt bara när ett format behöver en. Se [TUI](/info/tui.html).

![Den delade vyn på dator: kontroller som genererats från manifestet till vänster, den levande ytan till höger](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

Vid telefonbredd är kontrollpanelen överst och förhandsvisningen fyller skärmen.

![Ett audiogram på en 430 px bred skärm: kontrollpanelen överst, den färdiga kvadratiska grafiken nedanför och det svävande exportpillret](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dzzfxm%3A7%3Alofi%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

Webbappen innehåller också **Batch** (`#/batch`, `shells/web/src/pro/`), ett rutnät som liknar ett kalkylblad och renderar många rader samtidigt med ett eller flera verktyg. Se [Batch och Lolly Multi-edit](/info/batch.html#make-many-versions-of-one-design). **Settings → Capabilities** listar allt plattformen anger att den kan göra.

![Batch i en ny installation: en tom rad som väntar på ett verktyg, med kalkylbladsytan och knappen Render på plats innan några data har kommit in](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

<!--i:eti-lock-->
## Arkitekturens åtaganden

De här besluten är fastlagda. Alla andra beslut i kodbasen bygger på dem, så att ändra ett av dem är ett stort åtagande.

### 1. Deklarativa verktyg, med en utväg till imperativ kod

Ett verktyg är ett manifest (`tool.json`), en mall (`template.html`) och en valfri `hooks.js`. **Manifestet deklarerar indata**. Indata härleds aldrig från mallens Handlebars-tokens. De flesta verktyg består bara av ett manifest och en mall, så även den som inte är utvecklare kan skapa dem.

![Street Maps kontrollstapel: en rullgardinsmeny för stad, en temaväljare, reglage för linjebredd och färgknappar, alla hämtade från varsin rad i manifestet](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

Verktyg som beräknar värden, till exempel QR-kodning eller diagramformning, lägger till hooks: namngivna livscykelfunktioner som körmiljön anropar med funktionsbryggan injicerad. Hooks är ett kontrakt för portabilitet, inte en säkerhetssandlåda. De körs inom en tidsbudget. Verktyg vars hooks bevisligen inte använder sidans globala variabler har `isolate: true` och körs i en Worker. [Verktygshooks](/info/tool-hooks.html) beskriver livscykeln och budgetarna. [Hotmodellen](/info/threat-model.html) anger vad exekveraren på sidan begränsar och inte begränsar.

### 2. Verktyg och tillgångar är data, inte paketerad kod

Webb- och Tauri-apparna hämtar verktygs- och tillgångskatalogerna vid start, cachelagrar dem och arbetar med det som finns i cachen. Ett nytt verktyg eller en ny tillgång kräver ingen ny appversion. Tillgångarnas byte kontrolleras med SHA-256-kontrollsummor. En tillgångs `id` och `version` styr när cachen ogiltigförklaras.

### 3. Funktionsbryggan är det enda API som verktygen ser

Verktygen rör aldrig DOM utanför sin mall, anropar aldrig `fetch` direkt och läser aldrig filsystemet. De anropar versionshanterade `host.*`-metoder. Kontraktet definieras i `packages/core/src/host-v1.ts`, i SDK:t för verktygsutvecklare `@lolly-tools/core`. En tredje part kan bygga mot SDK:t utan att vara beroende av motorn. `engine/src/bridge/host-v1.ts` återexporterar dess typer.

| Obligatoriskt API | Vad det gör |
|---|---|
| `host.profile` | Användarens uppgifter; fyller i indata i förväg via `bindToProfile` |
| `host.assets` | Katalogfrågor, uppslagning av tillgångar och värdens väljare |
| `host.state` | Sparar och läser in dataplatser för indata: IndexedDB på webben, filsystemet i Tauri, minnet i CLI |
| `host.clipboard` | Skriver text eller en bild till urklipp, med reservlösningar för plattformen |
| `host.export` | Rastrerar eller serialiserar renderingsmålet samt hanterar filomvandling på enheten |
| `host.log` | Loggning med nivåer till värden |

Alla andra API:er är valfria tillägg: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` och många fler. Manifestets `requires` listar de valfria API:er som dess hooks anropar utan att kontrollera först. En värd som saknar något av dem vägrar att montera verktyget. För resten kontrollerar hooks om funktionerna finns. Några, som `recorder`, behöver också en enhetsfunktion som verktyget deklarerar. `packages/core/src/host-v1/apis.ts` listar alla och [Värd-API](/info/host-api.html) dokumenterar varje API. Att lägga till en metod ger en ny underversion. Att ta bort eller ändra en ger en ny huvudversion, och v1 fortsätter fungera när v2 släpps.

### 4. Tillgångars id:n gäller för alltid

`lolly/logo/primary` är ett kontrakt. När ett id har publicerats ändras det aldrig och återanvänds aldrig. En byteändring höjer `version` i tillgångsposten. En ersättning sätter `deprecated: true` och, valfritt, `replacedBy`. Befintliga referenser kan alltid slås upp, så sparade sessioner och delade länkar fortsätter fungera i åratal.

### 5. URL-läge har fullt stöd

Varje indata kan uttryckas som en URL-parameter, så en länk är en färdig fil:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Länken ensam, utan något annat i den, är den färdiga filen](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Ändra en parameter så får du en annan fil. Den här paletten består av en grundfärg, en harmoni och ett antal steg:

![Nio steg över fyra nyanser, alla framtagna från den enda grundfärg som följer med i länken](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

CLI:t bygger samma URL-tillstånd från sina argument och kör samma bearbetningskedja, så CLI:t kan inte avvika från appen. `engine/src/url-mode.ts` tolkar och serialiserar URL-tillståndet. Reserverade namn (`format`, `width`, `dpi`, `c2pa`, `z` med flera) skickas aldrig till ett verktyg. [Reserverade URL-parametrar](/info/url-parameters.html) listar alla. Tillgångsindata överförs med `id` och slås upp via `host.assets.get()` innan mallen fylls i.

### 6. Lagring går via bryggan

Webbappen använder IndexedDB, Tauri filsystemet och CLI:t minnet. Verktygen ser bara `host.state.save(slot, data)` och `host.state.load(slot)`, aldrig `localStorage`. Du kan behålla flera namngivna sessioner per verktyg utan konto. Eftersom bryggan är den enda gränsytan är tillståndet också portabelt. `shells/web/src/data-transfer.ts` exporterar tillståndet som en enda `lolly-backup`-fil som kan importeras i vilken annan installation som helst ([Dataöverföring](/info/data-transfer.html)). [Sync](/info/sync.html) skickar samma paket till lagring som du väljer.

### 7. Mognadsetiketter anger vad ett verktyg är

Varje verktyg deklarerar `status: official | community | experimental`. Galleriet sorterar efter status. Experimentella verktyg vattenstämplar sina exporter som standard: körmiljön slår på vattenstämpeln om inte anroparen skickar `watermark: false`. Verktyg som bearbetar filer på enheten är undantagna. Teamets egen katalogprocess bygger vidare på de här etiketterna.

### 8. Indata typbestäms i manifestet

Varje indata deklarerar en `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` eller `file`. Värden renderar en kontroll för varje typ, så verktygen skriver ingen kontrollkod. Alla indata kan ha `bindToProfile`. Tre typer är viktigast:

- **`asset`**, med `filter` och `allowUpload`, är bryggan till tillgångssystemet. `allowUpload: false` begränsar en plats till tillgångar i biblioteket. Användaruppladdningar har samma `AssetRef`-struktur som biblioteket.
- **`blocks`** är en upprepad fältgrupp som redigeras i en sidopanel och används av Meeting Planner, Wayfinding, Diagrams och andra. Att klicka på ett renderat block ger dess rad fokus.
- **`file`** håller användarens egen fil i minnet för filverktyg som Lolly Strip Hidden Data och Compress, och **`vector`** grupperar en fast uppsättning tal i en enda kontroll.

### 9. Mallar saknar logik

Mallarna använder Handlebars, så även den som inte är utvecklare kan skriva dem. `{{x}}` kodar specialtecken och `{{{x}}}` är ett uttryckligt val att avstå från det. Logiken finns i `hooks.js`, där den kan granskas. Många mallar använder `{{{` för uppmärkning som en hook har beräknat, så varje hook måste koda specialtecken i det den lämnar över. Hjälpfunktionerna är `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` och `media`, samt `icsStamp`, `rfcText`, `csvCell` och `arrow` för tillhörande `.ics`-, `.vcf`- och `.csv`-mallar. [Mallar och rendering](/info/tool-rendering.html) beskriver dem.

### 10. Verktyg sätter samman verktyg

Ett verktyg kan bädda in ett annat verktygs rendering utan importer mellan verktygen. Motorn hanterar sammansättningen. Ett manifest kan deklarera `composes: [{ id, tool, inputs }]` och placera det underordnade verktyget med `{{asset <id>}}`. En portabel inbäddnings-URL (`https://lolly.tools/tool/<id>.svg?…`) renderar det underordnade verktyget lokalt; Lolly Design placerar en levande QR-kod eller ett diagram på det sättet. En underordnad SVG förblir vektor i en överordnad SVG eller PDF. Underordnade renderingar är mellanresultat och får aldrig vattenstämpel eller stämpel. Ett skal som inte kan rendera ett underordnat verktyg lämnar platsen tom och det överordnade renderas ändå. [Sammansättning och varumärkesöverlägg](/info/tool-composition.html) har detaljerna.

<!--i:eti-scissors-->
## Vad vi valde att inte göra

- **Ingen godtycklig JavaScript i mallar.** Logiken finns i `hooks.js`.
- **Ingen obligatorisk tillgångsserver.** Du lägger till egna filer i Assets i appen och lämnar vidare arbete som en session: en delningslänk för indata och inställningar, en `.lolly`-fil när uppladdningar också följer med. En delad session kan bli en mall i ett verktygs väljare. En organisation som vill ha en styrd katalog kan använda Lolly Works katalog, godkännanden och policyer eller hantera varumärkespaketet i git och granska ändringar där.
- **Ingen påtvingad åtkomstkontroll.** Den öppna appen är offentlig som standard. Mognadsetiketter och vattenstämplar hanterar varumärkesrisken. Organisationsinloggning, roller och policy kommer från Lolly Work när ett team vill ha dem.
- **Ingen central databas.** Användartillståndet finns på varje enhet och valfri Sync kopierar det till lagring som du väljer, aldrig till en Lolly-databas.
- **Ingen gemensam kodväg mellan verktyg och motorn.** Motorn och gemenskapens verktyg har öppen källkod. Ett varumärkespaket som det privata `brands/suse/` innehåller sina egna verktyg och sin egen katalog under egna villkor. Inget verktyg importerar från `engine/`, så uppdelningen förblir tydlig.

<!--i:eti-refresh-->
## Livscykeln för en rendering

Någon öppnar `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`:

1. **Starta.** Webbappen öppnar IndexedDB, bygger funktionsbryggan och synkroniserar verktygs- och tillgångskatalogerna eller läser in dem från cachen när den är offline.
2. **Välj vy.** Sökvägen väljer verktygsvyn för `qr-code`, med frågesträngen som startvärden.
3. **Läs in.** `loadTool` hämtar `tool.json`, validerar det mot schemat och hämtar mallen, stilarna och hooks.
4. **Tolka länken.** `parseUrlState` omvandlar parametrarna till indatavärden. En tillgångsreferens som `?logo=lolly/logo/primary` blir en ännu inte uppslagen `{ id }`.
5. **Starta körmiljön.** `createRuntime(tool, host, initialValues)` bygger indatamodellen från profildata, standardvärden och länken, slår upp tillgångsreferenser, läser in hooks och anropar `onInit`.
6. **Rendera.** Skalet prenumererar på körmiljön, ritar kontrollerna från modellen och skriver den ifyllda mallen till `#tool-canvas`.
7. **Interagera.** När du skriver anropas `runtime.setInput`, som tillämpar begränsningar, anropar `onInput`, fyller i mallen igen och ritar om.
8. **Exportera.** **Download** anropar `runtime.export(node, format)` och skalets `host.export` skapar filen: ett raster, en vektor från DOM-genomgången, en PDF, ett dokument eller något av de andra formaten i `schemas/tool.schema.json`. Fysiska enheter omvandlas per format. Metadata och Content Credentials bäddas in där formatet kan innehålla dem. Experimentella verktyg får sin vattenstämpel från värden, inte verktyget. [Mallar och rendering](/info/tool-rendering.html) och [Exportera en fil](/info/exporting.html) beskriver exportsteget.

![Exportpanelen som ?options öppnar: paret filnamn och format, utdatastorleken och kontrollerna som skriver filen](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Samma livscykel körs i Tauri och i CLI:t med en DOM utan grafiskt gränssnitt, där utdatan går till en fil eller stdout.

<!--i:eti-stamp-->
## Licenser

Koden, inklusive `engine/`, `shells/`, `services/`, `schemas/` och dokumentationsgeneratorn, är licensierad under MPL-2.0 i ett enda offentligt kodförråd, [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). Dokumentationens löptext är CC BY-SA 4.0. Varumärkespaketen har egna villkor i varje pakets `NOTICE.md`: gemenskapens verktyg är MPL-2.0 och det privata SUSE-paketet är SUSE:s proprietära egendom. [Om](/info/about.html) har hela licensinformationen.
