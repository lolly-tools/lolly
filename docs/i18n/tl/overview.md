# Arkitektura ng Lolly

![Icon ng Lolly - Malaking berde at puting lollipop candy](/info/icon.svg)

Ang pahinang ito ay para sa mga taong nagbabago ng code ng Lolly: kung paano nagkakasya ang engine, ang mga shell at ang mga tool pack, kung saan nakatira ang bawat isa sa repository, at ang mga pangakong naglilimita sa bawat pagbabago. Kung gusto mong malaman kung ano ang ginagawa ng Lolly at sino ang gumagamit nito, basahin muna ang [Paano gumagana ang Lolly](/info/how-lolly-works.html).

May dalawang kasama pa na mas malalim ang tinatalakay. Ang [`engine/README.md`](../engine/README.md) ay mapa ng engine, module por module, na binuo mula sa code. Binabasa ng [Threat Model & Trust Boundaries](/info/threat-model.html) ang parehong arkitektura bilang mga trust boundary, at iyon ang page para sa anumang tanong tungkol sa kung ano ang itinuturing ng engine na hindi pinagkakatiwalaan.

## Ang kabuuang larawan

Data ang mga tool sa itaas. Walang alam ang engine sa gitna tungkol sa anumang platform. Ang mga shell sa ibaba ay nagpapatupad ng iisang kontrata, at ang mga catalog ang nagbibigay ng nilalaman.

![Nagbibigay ang mga tool ng manifest, template at hooks sa shared na engine. Ang mga web, Tauri at terminal shell ay nagpapatupad ng HostV1 capability bridge at nagbabasa ng mga tool at asset mula sa mga catalog.](/info/diagrams/concepts/platform-layers.svg)

Kung mailalarawan mo ito sa purong data at Handlebars, nabibilang ito sa **engine**. Kung ito ay humahawak sa DOM, filesystem, network o anumang browser o operating-system API, nabibilang ito sa **host**, ang panig ng shell sa bridge. Open source ang engine, at walang bagay na may alam sa partikular na brand o platform ang napupunta sa engine.

## Layout ng repository

Isang repository ang Lolly. Ang bawat directory sa ibaba ay payak na directory dito, maliban sa `brands/suse`, isang **pribadong** git submodule na may hawak ng SUSE tool pack at catalog, na hindi kinukuha ng pampublikong clone. Ang content profile (`profiles.json`) ang nagpapasya kung aling mga pack ang binabasa ng build, nareresolba bawat process sa halip na inililipat nang global. Nasa [Build Guide](/info/build-guide.html) ang clone command at kung paano kino-commit ang pagbabago sa loob ng pribadong pack.

| Directory | Ano ang hawak nito |
|---|---|
| `engine/` | Ang platform-agnostic na core: loader, runtime, mga input, template, URL mode, mga unit at ang mga format module |
| `shells/` | Ang web app, ang mga Tauri desktop at mobile app, ang CLI, ang TUI at ang browser extension |
| `packages/` | Ang tool-author SDK (`@lolly-tools/core`), ang shared na Node shell piece at ang docs renderer, bukod sa iba |
| `community/` | Ang mga brand-agnostic na tool, kasama ang shared na emoji pack |
| `brands/` | Mga brand pack: `lolly-demo` (Lolly Demo, ang design system na pinapatakbo ng lolly.tools), `lolly-start` (ang blangkong panimula) at ang pribadong `suse` |
| `services/` | Ang mga opsyonal na MCP, certificate at Penpot service, at ang server code na pinagsasaluhan nila |
| `schemas/` | JSON Schema para sa mga tool manifest, asset entry at asset reference |
| `scripts/`, `tests/`, `docs/`, `api/` | Mga build at catalog script, ang engine test suite, ang mga docs na ito at ang mga generated na serverless bundle |

::: details Ang mga file ng engine at shell na unang makakaharap mo
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

Walang `tools/` o `catalog/` directory sa repository root. Sinasagot ng `packages/node-shell/src/content-roots.ts` ang "saan nakatira ang tool na `<id>`" at "nasaan ang catalog" mula sa `profiles.json` kapag hiniling. Ang tunay na pares ng `tools/` at `catalog/` ay isinusulat lang sa build output, tulad ng `dist/`, RPM payload o container image, dahil kinukuha ng browser ang dalawang path na iyon sa HTTP.

## Kung saan tumatakbo ang Lolly

Ginagamit ng bawat surface ang parehong engine at parehong mga tool file.

- **Ang web app.** Isang progressive web app na gumagana offline kapag na-cache na ng service worker nito ang mga tool at asset. Hindi nito kailangan ng account; nasa IndexedDB ng bawat device ang state. Isang responsive na layout ang naglilingkod sa desktop at phone: sa phone, nagiging sheet ang mga kontrol at bumubukas ang mga export control mula sa lumulutang na pill.
- **Ang mga desktop at mobile app.** Mga Tauri package ng parehong web app, na may native na file dialog, filesystem state at buong offline na paggamit.
- **Ang CLI.** Ang `lolly <tool-id> --input=value --output=file.png` ay naglo-load ng parehong engine sa headless na DOM at isinusulat ang file. Ito ay URL mode sa ibang transport, hindi hiwalay na implementasyon. Tingnan ang [CLI](/info/cli.html).
- **Ang TUI.** Isang full-screen, keyboard-first na terminal app na gumagamit muli sa bridge ng CLI, nag-iingat ng mga naka-save na session sa disk (sa sariling folder ng desktop app kapag naka-install ang app, kung hindi ay sa ilalim ng `~/.lolly`) at nagsisimula lang ng scoped headless browser kapag kailangan ito ng isang format. Tingnan ang [TUI](/info/tui.html).

![Ang desktop split view: mga kontrol na binuo mula sa manifest sa kaliwa, ang live canvas sa kanan](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

Ang parehong tool sa lapad ng phone ay hindi nangangailangan ng ikalawang layout: nagiging sheet sa itaas ang mga kontrol at hawak ng preview ang screen.

![Isang audiogram sa 430px-ang-lapad na screen: ang controls sheet sa itaas, ang tapos na parisukat na artwork sa ibaba at ang lumulutang na export pill](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

Kasama rin sa web app ang **Batch** (`#/batch`, `shells/web/src/pro/`), isang spreadsheet-style na grid na nagre-render ng maraming row nang sabay sa isa o maraming tool; sinasaklaw ng [Batch at Multi-edit](/info/batch.html#make-many-versions-of-one-design) ang Batch. Ang **Settings → Capabilities** ay nagmamapa ng lahat ng idineklara ng platform na kaya nitong gawin.

![Ang Batch sa bagong install: isang walang laman na row na naghihintay ng tool, na nakalagay na ang spreadsheet surface at ang Render button bago pa dumating ang anumang data](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

## Mga arkitekturang komitment

Pinal na ang mga desisyong ito. Ang pagbabago sa alinman sa mga ito ay malaking gawain, dahil humuhubog ang mga ito sa bawat ibang desisyon sa codebase.

### 1. Deklaratibong mga tool, na may imperatibong escape hatch

Ang tool ay manifest (`tool.json`), template (`template.html`) at opsyonal na `hooks.js`. **Dineklara ng manifest ang mga input**, hindi kailanman ng template: ang mga input ay hindi hinuhuli mula sa mga Handlebars token. Karamihan ng tool ay manifest at template lang, kaya nakakapagsulat ng mga ito ang mga hindi developer.

![Ang control stack ng Street Map: city dropdown, theme select, mga weight slider at colour trigger, bawat isa ay iginuhit mula sa isang linya ng manifest](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

Ang mga tool na nagko-compute ng value, tulad ng QR encoding o chart shaping, ay nagdaragdag ng hooks: mga pinangalanang lifecycle function na tinatawag ng runtime kasama ang capability bridge na naka-inject. Ang mga hook ay portability contract, hindi security sandbox, at tumatakbo sila sa loob ng time budget. Ang mga tool na ang hooks ay napatunayang walang page global ay may dalang `isolate: true` at tumatakbo sa Worker. Nasa [Tool hooks](/info/tool-hooks.html) ang lifecycle at mga budget, at sinasabi ng [Threat Model](/info/threat-model.html) kung ano ang nasasaklaw at hindi nasasaklaw ng in-page executor.

### 2. Ang mga tool at asset ay data, hindi bundled code

Kinukuha ng web at Tauri app ang mga tool at asset catalog sa boot, ica-cache ang mga ito at gumagana sa anumang nandoon, kaya hindi nangangailangan ng app release ang bagong tool o asset. Ang mga byte ng asset ay may SHA-256 checksum, at ang `id` at `version` ng asset ang nagtutulak ng cache invalidation.

### 3. Ang capability bridge lang ang API na nakikita ng mga tool

Hindi kailanman humahawak ang mga tool sa DOM sa labas ng template nila, hindi kailanman direktang tumatawag ng `fetch` at hindi kailanman nagbabasa ng filesystem. Tumatawag sila ng mga versioned na `host.*` method. Ang canonical na kahulugan ng kontrata ay `packages/core/src/host-v1.ts`, ang tool-author SDK na `@lolly-tools/core`, kaya makakabuo ang third party laban dito nang hindi umaasa sa engine; ang `engine/src/bridge/host-v1.ts` ay nagre-re-export ng mga type nito.

| Kinakailangang API | Ano ang ginagawa nito |
|---|---|
| `host.profile` | Ang mga detalye ng user; pre-fill ng mga input sa pamamagitan ng `bindToProfile` |
| `host.assets` | Mga catalog query, asset resolution at ang picker ng host |
| `host.state` | I-save at i-load ang mga input slot: IndexedDB sa web, ang filesystem sa Tauri, memory sa CLI |
| `host.clipboard` | Magsulat ng text o larawan sa clipboard, na may platform fallback |
| `host.export` | I-rasterise o i-serialise ang render target, at ang on-device na file transform path |
| `host.log` | May-antas na logging papunta sa host |

Opsyonal at additive ang bawat ibang API: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` at marami pa. Inililista ng manifest ng tool sa ilalim ng `requires` ang mga opsyonal na API na tinatawag ng hooks nito nang hindi nagche-check muna, at ang host na kulang ng isa ay tumatangging i-mount ang tool; ang hooks ang nagfe-feature-detect sa iba. Ang ilan, tulad ng `recorder`, ay nangangailangan din ng device capability na dineklara ng tool. Inililista ng `packages/core/src/host-v1/apis.ts` ang lahat at dinodokumento ng [Host API](/info/host-api.html) ang bawat isa. Ang pagdaragdag ng method ay minor version; ang pag-alis o pagbabago ng isa ay major version, at patuloy na gumagana ang v1 kapag lumabas ang v2.

### 4. Habambuhay ang mga asset id

Ang `lolly/logo/primary` ay kontrata. Kapag nailathala, hindi na nagbabago ang id at hindi na ginagamit muli. Ang pagbabago ng byte ay nagpapataas ng `version` sa asset entry, at ang kapalit ay nagtatakda ng `deprecated: true` at, opsyonal, `replacedBy`, para laging nareresolba ang mga umiiral na reference. Iyon ang nagpapanatili sa mga naka-save na session at shared link na gumagana sa loob ng maraming taon.

### 5. Ang URL mode ay first-class

Bawat input ay maipapahayag bilang URL parameter, kaya ang link ay tapos na file:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Ang link na iyon nang mag-isa, na walang ibang laman, ay ang tapos na file](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Baguhin ang parameter at iba na ang file. Ang buong palette na ito ay isang seed colour, isang harmony at bilang ng hakbang:

![Siyam na hakbang sa apat na kulay, lahat ay nagmula sa iisang seed color na dala ng link](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

Binubuo ng CLI ang parehong URL state mula sa mga argument nito at pinapatakbo ang parehong pipeline, kaya hindi maaaring lumihis ang CLI sa app. Ang `engine/src/url-mode.ts` ang nagpa-parse at nagse-serialise; ang hanay ng mga reserved na pangalan (`format`, `width`, `dpi`, `c2pa`, `z` at iba pa) ay hindi kailanman ipinapasa sa tool, at inililista ng [Mga reserved na URL parameter](/info/url-parameters.html) ang lahat ng mga ito. Ang mga asset input ay sumasama ayon sa `id` at nareresolba sa pamamagitan ng `host.assets.get()` bago punan ang template.

### 6. Dumadaan sa bridge ang storage

Gumagamit ang web app ng IndexedDB, ang Tauri ng filesystem at ang CLI ng memory. Ang nakikita lang ng mga tool ay `host.state.save(slot, data)` at `host.state.load(slot)`, hindi kailanman `localStorage`. Makakapag-iingat ang mga tao ng ilang pinangalanang session bawat tool nang walang account. Dahil ang bridge ang tanging tahi, portable din ang state na iyon: binabasa ito pabalik ng `shells/web/src/data-transfer.ts` sa isang `lolly-backup` file na naii-import sa anumang ibang install ([Data transfer](/info/data-transfer.html)), at ipinapadala ng [Sync](/info/sync.html) ang parehong bundle sa storage na pinili ng tao.

### 7. Sinasabi ng maturity tags kung ano ang isang tool

Bawat tool ay nagdedeklara ng `status: official | community | experimental`. Inaayos ng gallery ang pagkakasunod ayon sa status, at ang mga experimental na tool ay nagwa-watermark ng mga export nila bilang default: ino-on ng runtime ang watermark maliban kung magpasa ang caller ng `watermark: false`, at exempted ang mga on-device na tool. Anumang proseso na ilagay ng team sa paligid ng catalog ay nasa ibabaw nito.

### 8. May uri ang mga input sa manifest

Dineklara ng input ang isang `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` o `file`. Nagre-render ang host ng kontrol bawat uri, kaya walang isinusulat na control code ang mga tool, at ang anumang input ay puwedeng may `bindToProfile`. Tatlo ang pinakamabigat:

- Ang **`asset`**, na may `filter` at `allowUpload`, ang tulay papunta sa asset system. Nililimitahan ng `allowUpload: false` ang slot sa mga asset ng library, at ang mga upload ng user ay may parehong `AssetRef` na hugis ng library.
- Ang **`blocks`** ay umuulit na field group na ine-edit sa side panel, ginagamit ng Meeting Planner, Wayfinding, Diagrams at iba pa. Ang pag-click sa na-render na block ay nagfo-focus sa row nito.
- Ang **`file`** ay may hawak ng sariling file ng user sa memory para sa mga on-device utility tulad ng Strip Hidden Data at Compress, at ang **`vector`** ay nagpapangkat ng nakapirming hanay ng mga numero sa isang kontrol.

### 9. Walang logic ang mga template

Handlebars ang mga template, pinili para makapagsulat ang mga hindi developer: nag-e-escape ang `{{x}}`, at tahasang opt-in ang `{{{x}}}`. Nasa `hooks.js` ang logic, kung saan tahasan ito at nasusuri. Maraming template ang gumagamit ng `{{{` para sa markup na kinompyut ng hook, kaya dapat mag-escape ang bawat hook ng ibinibigay nito. Ang mga helper ay `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` at `media`, kasama ang `icsStamp`, `rfcText`, `csvCell` at `arrow` para sa mga katabing `.ics`, `.vcf` at `.csv` template. Sinasaklaw ng [Templates at rendering](/info/tool-rendering.html) ang mga ito.

### 10. Pinagsasama-sama ng mga tool ang mga tool

Ang tool ay maaaring mag-embed ng render ng ibang tool nang walang tool-to-tool na import; ang engine ang nagreresolba ng komposisyon. Maaaring magdeklara ang manifest ng `composes: [{ id, tool, inputs }]` at ilagay ang child gamit ang `{{asset <id>}}`, at ang portable na embed URL (`https://lolly.tools/tool/<id>.svg?…`) ay nagre-render ng child nang lokal, at ganito naglalagay ang Design ng live na QR code o chart. Ang SVG child ay nananatiling vector sa SVG o PDF na parent. Ang mga child ay intermediate, hindi kailanman nilalagyan ng watermark o selyo, at ang shell na hindi makapag-render nito ay iniiwang walang laman ang slot habang nagre-render pa rin ang parent. Nasa [Composition at brand overlays](/info/tool-composition.html) ang mga detalye.

## Ang pinili naming hindi gawin

- **Walang arbitraryong JavaScript sa mga template.** Nasa `hooks.js` ang logic.
- **Walang sapilitang asset server.** Nagdaragdag ang mga tao ng sarili nilang file sa Assets sa app at ipinapasa ang gawa bilang session: share link para sa mga input at setting, `.lolly` file kapag kasama ang mga upload. Ang shared na session ay maaaring maging template sa chooser ng tool. Ang organisasyong gustong magkaroon ng governed na catalog ay puwedeng gumamit ng catalogue, mga approval at policy ng Lolly Work, o pamahalaan ang brand pack sa git at mag-review ng mga pagbabago doon.
- **Walang sapilitang access control.** Pampubliko bilang default ang bukas na app, at ang mga maturity tag at watermark ang may dala ng panganib sa brand. Ang organisation sign-in, mga papel at policy ay galing sa Lolly Work kapag gusto ito ng team.
- **Walang sentral na database.** Nasa bawat device ang user state, at ang opsyonal na Sync ay kinokopya ito sa storage na pinili ng tao, hindi kailanman sa Lolly database.
- **Walang shared na code path sa pagitan ng mga tool at engine.** Open source ang engine at ang mga community tool, at ang brand pack tulad ng pribadong `brands/suse/` ay may sarili nitong mga tool at catalog sa ilalim ng sarili nitong mga tuntunin. Walang tool na nag-i-import mula sa `engine/`, kaya nananatiling malinis ang paghahati.

## Ang lifecycle ng isang render

May nagbubukas ng `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`:

1. **Boot.** Binubuksan ng web app ang IndexedDB, binubuo ang capability bridge at sini-sync ang mga tool at asset catalog, o nilo-load ang mga ito mula sa cache kapag offline.
2. **Route.** Pinipili ng path ang tool view para sa `qr-code`, na ang query ang mga paunang value nito.
3. **Load.** Kinukuha ng `loadTool` ang `tool.json`, vina-validate ito laban sa schema at kinukuha ang template, styles at hooks.
4. **I-parse ang link.** Ginagawang input value ng `parseUrlState` ang mga parameter. Ang asset reference tulad ng `?logo=lolly/logo/primary` ay nagiging hindi pa nareresolbang `{ id }`.
5. **Simulan ang runtime.** Binubuo ng `createRuntime(tool, host, initialValues)` ang input model mula sa profile data, mga default at link, nireresolba ang mga asset reference, nilo-load ang hooks at tinatawag ang `onInit`.
6. **I-render.** Nagsa-subscribe ang shell sa runtime, iginuguhit ang mga kontrol mula sa model at isinusulat ang napunang template sa `#tool-canvas`.
7. **Makipag-ugnayan.** Ang pagta-type ay tumatawag ng `runtime.setInput`, na naglalapat ng mga constraint, tumatawag ng `onInput`, pinupunan muli ang template at iginuguhit muli.
8. **I-export.** Tinatawag ng **Download** ang `runtime.export(node, format)`, at ang `host.export` ng shell ang gumagawa ng file: raster, vector mula sa DOM walker, PDF, dokumento o isa sa ibang format sa `schemas/tool.schema.json`. Kino-convert ang mga pisikal na unit bawat format, at ine-embed ang metadata at Content Credentials kung kaya ng format na hawakan ang mga ito. Ang mga experimental na tool ay nakakakuha ng watermark mula sa host, hindi sa tool. Sinasaklaw ng [Templates at rendering](/info/tool-rendering.html) at [Mag-export ng file](/info/exporting.html) ang hakbang ng export.

![Ang export panel na binubuksan ng ?options: ang pares ng filename at format, ang laki ng output at ang mga kontrol na nagsusulat ng file](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Tumatakbo ang parehong lifecycle sa Tauri, at sa CLI na may headless na DOM, kung saan napupunta ang output sa file o stdout.

## Mga lisensya

Ang code, kasama ang `engine/`, `shells/`, `services/`, `schemas/` at ang documentation generator, ay MPL-2.0, sa isang pampublikong repository, [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). Ang prosa ng dokumentasyon ay CC BY-SA 4.0. Ang mga brand pack ay may sariling mga tuntunin sa `NOTICE.md` ng bawat pack: MPL-2.0 ang mga community tool, at proprietary sa SUSE ang pribadong SUSE pack. Nasa [About](/info/about.html) ang buong tala sa paglilisensya.
