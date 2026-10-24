# Lollys arkitektur

![Lolly-ikon - Stor grön och vit klubba](/info/icon.svg)

Den här sidan är för dem som ändrar Lollys kod: hur motorn, skalen och verktygspaketen passar ihop, var var och en finns i arkivet och de åtaganden som begränsar varje ändring. Om du vill veta vad Lolly gör och vem som använder det, läs [Så fungerar Lolly](/info/how-lolly-works.html) först.

Två följeslagare går djupare. [`engine/README.md`](../engine/README.md) är modul-för-modul-kartan över motorn, genererad från koden. [Threat Model & Trust Boundaries](/info/threat-model.html) läser samma arkitektur som förtroendegränser, och är sidan för varje fråga om vad motorn behandlar som opålitligt.

## Helhetsbilden

Verktyg är data överst. Motorn i mitten vet ingenting om någon plattform. Skalen längst ner implementerar ett kontrakt, och katalogerna levererar innehållet.

![Verktyg levererar ett manifest, en mall och hooks till den delade motorn. Webb-, Tauri- och terminalskal implementerar capability bridge HostV1 och läser verktyg och tillgångar från kataloger.](/info/diagrams/concepts/platform-layers.svg)

Om du kan beskriva det i ren data och Handlebars hör det hemma i **motorn**. Om det rör DOM, filsystemet, nätverket eller något webbläsar- eller operativsystems-API hör det hemma i **värden**, skalets sida av bryggan. Motorn har öppen källkod, och inget som känner till ett visst varumärke eller en viss plattform hamnar i motorn.

## Arkivets uppbyggnad

Lolly är ett arkiv. Varje katalog nedan är en vanlig katalog i det, utom `brands/suse`, en **privat** git-submodul som håller SUSE:s verktygspaket och katalog, som en publik klon inte hämtar. Vilka paket ett bygge läser är en innehållsprofil (`profiles.json`), som löses per process i stället för att växlas globalt. [Build Guide](/info/build-guide.html) har klonkommandot och hur en ändring inne i det privata paketet checkas in.

| Katalog | Vad den innehåller |
|---|---|
| `engine/` | Den plattformsoberoende kärnan: laddare, körmiljö, indata, mallar, URL-läge, enheter och formatmodulerna |
| `shells/` | Webbappen, Tauri-dator- och mobilapparna, CLI, TUI och webbläsartillägget |
| `packages/` | SDK för verktygsutvecklare (`@lolly-tools/core`), de delade Node-skaldelarna och dokumentationsrenderaren, bland annat |
| `community/` | De varumärkesoberoende verktygen, plus de delade emojipaketen |
| `brands/` | Varumärkespaket: `lolly-demo` (Lolly Demo, designsystemet lolly.tools kör), `lolly-start` (det tomma startpaketet) och det privata `suse` |
| `services/` | De valfria MCP-, certifikat- och Penpot-tjänsterna, och serverkoden de delar |
| `schemas/` | JSON Schema för verktygsmanifest, tillgångsposter och tillgångsreferenser |
| `scripts/`, `tests/`, `docs/`, `api/` | Bygg- och katalogskript, motorns testsvit, de här dokumenten och de genererade serverlösa paketen |

::: details Motor- och skalfilerna du möter först
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

Det finns ingen `tools/`- eller `catalog/`-katalog i arkivets rot. `packages/node-shell/src/content-roots.ts` svarar på "var finns verktyget `<id>`" och "var finns katalogen" utifrån `profiles.json` när det frågas. Ett riktigt `tools/`- och `catalog/`-par skrivs bara i en byggutdata, som `dist/`, en RPM-nyttolast eller en containerbild, eftersom en webbläsare hämtar de två sökvägarna över HTTP.

## Var Lolly körs

Varje yta använder samma motor och samma verktygsfiler.

- **Webbappen.** En progressiv webbapp som fungerar offline när dess service worker har cachat verktygen och tillgångarna. Den behöver inget konto; tillstånd lever i IndexedDB på varje enhet. En responsiv layout tjänar dator och telefon: på en telefon blir kontrollerna ett blad och exportkontrollerna öppnas från en flytande pill.
- **Dator- och mobilapparna.** Tauri-paket av samma webbapp, med inbyggda fildialoger, filsystemstillstånd och full offlineanvändning.
- **CLI.** `lolly <tool-id> --input=value --output=file.png` laddar samma motor i en DOM utan gränssnitt och skriver filen. Det är URL-läge över en annan transport, inte en separat implementation. Se [CLI](/info/cli.html).
- **TUI.** En helskärmsapp för terminalen med tangentbordet i första hand som återanvänder CLI:s brygga, behåller sparade sessioner på disk (i datorappens egen mapp när appen är installerad, annars under `~/.lolly`) och startar en avgränsad webbläsare utan gränssnitt bara när ett format behöver en. Se [TUI](/info/tui.html).

![Datorns delade vy: kontroller genererade från manifestet till vänster, den levande ytan till höger](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

Samma verktyg i telefonbredd behöver ingen annan layout: kontrollerna blir ett blad överst och förhandsvisningen håller skärmen.

![Ett audiogram på en 430 px bred skärm: kontrollbladet ovanför, det färdiga kvadratiska verket under och den flytande exportpillen](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

Webbappen levereras också med **Batch** (`#/batch`, `shells/web/src/pro/`), ett rutnät i kalkylbladsstil som renderar många rader på en gång över ett eller många verktyg; [Batch och Multi-edit](/info/batch.html#make-many-versions-of-one-design) beskriver Batch. **Settings → Capabilities** kartlägger allt plattformen deklarerar att den kan göra.

![Batch på en ny installation: en tom rad som väntar på ett verktyg, med kalkylbladsytan och dess Render-knapp på plats innan några data kommer](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

## Arkitektoniska åtaganden

De här besluten är avgjorda. Att ändra något av dem är ett stort åtagande, eftersom de formar varje annat beslut i kodbasen.

### 1. Deklarativa verktyg, med en imperativ nödutgång

Ett verktyg är ett manifest (`tool.json`), en mall (`template.html`) och valfria `hooks.js`. **Manifestet deklarerar indata**, aldrig mallen: indata härleds inte från Handlebars-token. De flesta verktyg är bara manifest och mall, vilket är det som låter icke-utvecklare skriva dem.

![Street Maps kontrollstack: en stadsrullgardin, ett temaval, vikt-reglage och färgutlösare, var och en ritad från en manifestrad](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

Verktyg som beräknar värden, som QR-kodning eller diagramformning, lägger till hooks: namngivna livscykelfunktioner som körmiljön anropar med capability bridge injicerad. Hooks är ett portabilitetskontrakt, inte en säkerhetssandlåda, och de körs inom en tidsbudget. Verktyg vars hooks bevisats fria från sidans globaler bär `isolate: true` och körs i en Worker. [Tool hooks](/info/tool-hooks.html) har livscykeln och budgetarna, och [Threat Model](/info/threat-model.html) säger vad den sidinterna exekutorn rymmer och inte rymmer.

### 2. Verktyg och tillgångar är data, inte paketerad kod

Webb- och Tauri-apparna hämtar verktygs- och tillgångskatalogerna vid start, cachar dem och arbetar med det som finns, så ett nytt verktyg eller en ny tillgång behöver ingen appversion. Tillgångsbyte kontrollsummeras med SHA-256, och en tillgångs `id` och `version` styr cacheinvalidering.

### 3. Capability bridge är det enda API som verktyg ser

Verktyg rör aldrig DOM utanför sin mall, anropar aldrig `fetch` direkt och läser aldrig filsystemet. De anropar versionshanterade `host.*`-metoder. Kontraktets kanoniska definition är `packages/core/src/host-v1.ts`, SDK:n för verktygsutvecklare `@lolly-tools/core`, så att en tredje part kan bygga mot den utan att bero på motorn; `engine/src/bridge/host-v1.ts` återexporterar dess typer.

| Obligatoriskt API | Vad det gör |
|---|---|
| `host.profile` | Användarens uppgifter; fyller i indata via `bindToProfile` |
| `host.assets` | Katalogfrågor, tillgångsupplösning och värdens väljare |
| `host.state` | Spara och läsa in indataplatser: IndexedDB på webben, filsystemet i Tauri, minnet i CLI |
| `host.clipboard` | Skriva text eller en bild till urklipp, med plattformsreserver |
| `host.export` | Rastrera eller serialisera renderingsmålet, och filtransformvägen på enheten |
| `host.log` | Nivåindelad loggning till värden |

Varje annat API är valfritt och additivt: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` och många fler. Ett verktygs manifest listar under `requires` de valfria API:er som dess hooks anropar utan att kontrollera först, och en värd som saknar ett vägrar montera verktyget; hooks funktionsupptäcker resten. Några, som `recorder`, behöver också en enhetsförmåga som verktyget deklarerar. `packages/core/src/host-v1/apis.ts` listar dem alla och [Host API](/info/host-api.html) dokumenterar var och en. Att lägga till en metod är en minorversion; att ta bort eller ändra en är en majorversion, och v1 fortsätter fungera när v2 släpps.

### 4. Tillgångs-id:n är för evigt

`lolly/logo/primary` är ett kontrakt. När det väl publicerats ändras ett id aldrig och återanvänds aldrig. En bytändring höjer `version` i tillgångsposten, och en ersättning sätter `deprecated: true` och, valfritt, `replacedBy`, så att befintliga referenser alltid löses. Det är det som håller sparade sessioner och delade länkar fungerande i åratal.

### 5. URL-läge är förstklassigt

Varje indata kan uttryckas som en URL-parameter, så en länk är en färdig fil:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Den länken ensam, med inget annat i den, är den färdiga filen](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Ändra en parameter så har du en annan fil. Hela den här paletten är en fröfärg, en harmoni och ett antal steg:

![Nio steg genom fyra nyanser, alla framodlade ur samma frökulör som bärs i länken](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

CLI bygger samma URL-tillstånd från sina argument och kör samma pipeline, så CLI kan inte glida ifrån appen. `engine/src/url-mode.ts` tolkar och serialiserar; en uppsättning reserverade namn (`format`, `width`, `dpi`, `c2pa`, `z` med flera) skickas aldrig till ett verktyg, och [Reserved URL parameters](/info/url-parameters.html) listar dem alla. Tillgångsindata färdas via `id` och löses genom `host.assets.get()` innan mallen fylls.

### 6. Lagring går genom bryggan

Webbappen använder IndexedDB, Tauri filsystemet och CLI minnet. Verktyg ser bara `host.state.save(slot, data)` och `host.state.load(slot)`, aldrig `localStorage`. Man kan behålla flera namngivna sessioner per verktyg utan konto. Eftersom bryggan är den enda skarven är det tillståndet också portabelt: `shells/web/src/data-transfer.ts` läser ut det igen i en `lolly-backup`-fil som importeras på vilken annan installation som helst ([Dataöverföring](/info/data-transfer.html)), och [Sync](/info/sync.html) skickar samma paket till lagring som personen väljer.

### 7. Mognadstaggar säger vad ett verktyg är

Varje verktyg deklarerar `status: official | community | experimental`. Galleriet sorterar efter status, och experimentella verktyg vattenstämplar sina exporter som standard: körmiljön slår på vattenstämpeln om inte anroparen skickar `watermark: false`, och verktyg på enheten är undantagna. Vilken process ett team än lägger kring katalogen ligger ovanpå detta.

### 8. Indata är typade i manifestet

En indata deklarerar en `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` eller `file`. Värden ritar en kontroll per typ, så verktyg skriver ingen kontrollkod, och varje indata kan bära `bindToProfile`. Tre väger tyngst:

- **`asset`**, med `filter` och `allowUpload`, är bryggan till tillgångssystemet. `allowUpload: false` begränsar en plats till biblioteksbilder, och användaruppladdningar delar bibliotekets `AssetRef`-form.
- **`blocks`** är en upprepad fältgrupp som redigeras i en sidopanel, använd av Meeting Planner, Wayfinding, Diagrams med flera. Att klicka på ett renderat block fokuserar dess rad.
- **`file`** håller användarens egen fil i minnet för verktyg på enheten som Strip Hidden Data och Compress, och **`vector`** grupperar en fast uppsättning tal i en kontroll.

### 9. Mallar är logikfria

Mallar är Handlebars, valt så att icke-utvecklare kan skriva dem: `{{x}}` escapar, och `{{{x}}}` är ett uttryckligt val. Logik finns i `hooks.js`, där den är explicit och granskningsbar. Många mallar använder `{{{` för markup som en hook beräknat, så varje hook måste escapa det den lämnar över. Hjälparna är `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` och `media`, plus `icsStamp`, `rfcText`, `csvCell` och `arrow` för syskonmallar för `.ics`, `.vcf` och `.csv`. [Templates and rendering](/info/tool-rendering.html) beskriver dem.

### 10. Verktyg komponerar verktyg

Ett verktyg kan bädda in ett annat verktygs rendering utan importer mellan verktyg; motorn löser kompositionen. Ett manifest kan deklarera `composes: [{ id, tool, inputs }]` och placera barnet med `{{asset <id>}}`, och en portabel inbäddnings-URL (`https://lolly.tools/tool/<id>.svg?…`) renderar barnet lokalt, vilket är hur Design placerar en levande QR-kod eller ett diagram. Ett SVG-barn förblir vektor i en SVG- eller PDF-förälder. Barn är mellanled, aldrig vattenstämplade eller stämplade, och ett skal som inte kan rendera ett lämnar platsen tom medan föräldern ändå renderas. [Composition and brand overlays](/info/tool-composition.html) har detaljerna.

## Vad vi valde att inte göra

- **Ingen godtycklig JavaScript i mallar.** Logik finns i `hooks.js`.
- **Ingen obligatorisk tillgångsserver.** Man lägger till egna filer i Assets i appen och för arbetet vidare som en session: en delningslänk för indata och inställningar, en `.lolly`-fil när uppladdningar följer med. En delad session kan bli en mall i ett verktygs väljare. En organisation som vill ha en styrd katalog kan använda Lolly Works katalog, godkännanden och policyer, eller hantera varumärkespaketet i git och granska ändringar där.
- **Ingen påtvingad åtkomstkontroll.** Den öppna appen är publik som standard, och mognadsetiketter och vattenstämplar bär varumärkesrisken. Organisationsinloggning, roller och policy kommer från Lolly Work när ett team vill ha dem.
- **Ingen central databas.** Användartillstånd lever på varje enhet, och valfri Sync kopierar det till lagring som personen väljer, aldrig till en Lolly-databas.
- **Ingen delad kodväg mellan verktyg och motorn.** Motorn och gemenskapsverktygen har öppen källkod, och ett varumärkespaket som det privata `brands/suse/` bär sina egna verktyg och sin egen katalog under egna villkor. Inget verktyg importerar från `engine/`, så uppdelningen förblir ren.

## Livscykeln för en rendering

Någon öppnar `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`:

1. **Start.** Webbappen öppnar IndexedDB, bygger capability bridge och synkar verktygs- och tillgångskatalogerna, eller läser in dem från cachen offline.
2. **Väg.** Sökvägen väljer verktygsvyn för `qr-code`, med frågan som dess startvärden.
3. **Läs in.** `loadTool` hämtar `tool.json`, validerar det mot schemat och hämtar mallen, stilarna och hooks.
4. **Tolka länken.** `parseUrlState` gör parametrarna till indatavärden. En tillgångsreferens som `?logo=lolly/logo/primary` blir ett olöst `{ id }`.
5. **Starta körmiljön.** `createRuntime(tool, host, initialValues)` bygger indatamodellen från profildata, standardvärden och länken, löser tillgångsreferenser, läser in hooks och anropar `onInit`.
6. **Rendera.** Skalet prenumererar på körmiljön, ritar kontrollerna från modellen och skriver den ifyllda mallen i `#tool-canvas`.
7. **Interagera.** Att skriva anropar `runtime.setInput`, som tillämpar begränsningar, anropar `onInput`, fyller mallen igen och ritar om.
8. **Exportera.** **Download** anropar `runtime.export(node, format)`, och skalets `host.export` producerar filen: en raster, en vektor från DOM-vandraren, en PDF, ett dokument eller ett av de andra formaten i `schemas/tool.schema.json`. Fysiska enheter konverteras per format, och metadata och Content Credentials bäddas in där formatet kan hålla dem. Experimentella verktyg får sin vattenstämpel från värden, inte verktyget. [Templates and rendering](/info/tool-rendering.html) och [Exportera en fil](/info/exporting.html) beskriver exportsteget.

![Exportpanelen som ?options öppnar: filnamns- och formatparet, utdatastorleken och kontrollerna som skriver filen](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Samma livscykel körs i Tauri, och i CLI med en DOM utan gränssnitt, där utdatan går till en fil eller stdout.

## Licenser

Kod, inklusive `engine/`, `shells/`, `services/`, `schemas/` och dokumentationsgeneratorn, är MPL-2.0, i ett publikt arkiv, [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). Dokumentationstext är CC BY-SA 4.0. Varumärkespaket bär egna villkor i varje pakets `NOTICE.md`: gemenskapsverktygen är MPL-2.0, och det privata SUSE-paketet är proprietärt för SUSE. [About](/info/about.html) har hela licensnotisen.
