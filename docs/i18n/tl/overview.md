# Arkitektura ng Lolly

![Lolly Icon - Malaking berde at puting lollipop na kendi](/info/icon.svg)

Para ang pahinang ito sa mga nagbabago ng code ng Lolly: kung paano magkakaugnay ang engine, mga shell at mga tool pack, kung saan naroon ang bawat isa sa repository at ang mga prinsipyong nagtatakda ng hangganan ng bawat pagbabago. Para malaman kung ano ang ginagawa ng Lolly at sino ang gumagamit nito, basahin muna ang [Paano gumagana ang Lolly](/info/how-lolly-works.html).

Inilalatag ng [`engine/README.md`](https://github.com/lolly-tools/lolly/blob/main/engine/README.md) ang engine ayon sa bawat module at binubuo ito mula sa code. Tinitingnan ng [Modelo ng Banta & Mga Hangganan ng Tiwala](/info/threat-model.html) ang parehong arkitektura bilang mga hangganan ng tiwala at sinasabi kung ano ang itinuturing ng engine na hindi mapagkakatiwalaan.

<!--i:eti-layers-->
## Ang kabuuang larawan

Data ang mga tool sa itaas. Walang alam tungkol sa anumang platform ang engine sa gitna. Iisang kontrata ang ipinapatupad ng mga shell sa ibaba, at ang mga catalog ang nagbibigay ng nilalaman.

![Nagbibigay ang mga tool ng manifest, template at mga hook sa pinagsasaluhang engine. Ipinapatupad ng mga web, Tauri at terminal shell ang HostV1 capability bridge at binabasa ang mga tool at asset mula sa mga catalog.](/info/diagrams/concepts/platform-layers.svg)

Anumang mailalarawan mo gamit ang purong data at Handlebars ay para sa **engine**. Anumang gumagamit ng DOM, filesystem, network o anumang browser o operating-system API ay para sa **host**, ang panig ng shell sa bridge. Open source ang engine. Walang anumang may kaalaman tungkol sa partikular na brand ang inilalagay sa engine.

<!--i:eti-folder-shared-->
## Ayos ng repository

Iisang repository ang Lolly. Karaniwang directory ang bawat directory sa ibaba, maliban sa `brands/suse`: isang **pribadong** git submodule na may SUSE tool pack at catalog, na hindi kinukuha ng pampublikong clone. Itinatakda ng content profile (`profiles.json`) kung aling mga pack ang binabasa ng build. Tinutukoy ng bawat proseso ang sarili nitong profile, at walang pangkalahatang switch. Nasa [Gabay sa Build](/info/build-guide.html) ang clone command at kung paano mag-commit ng pagbabago sa loob ng pribadong pack.

| Directory | Laman nito |
|---|---|
| `engine/` | Ang core na hindi nakadepende sa platform: loader, runtime, mga input, template, URL mode, unit at format module |
| `shells/` | Ang web app, mga Tauri desktop at mobile app, CLI, TUI at browser extension |
| `packages/` | Ang SDK ng may-akda ng tool (`@lolly-tools/core`), mga pinagsasaluhang bahagi ng Node shell at docs renderer, bukod sa iba pa |
| `community/` | Ang mga tool na walang partikular na brand, kasama ang mga pinagsasaluhang emoji pack |
| `brands/` | Mga brand pack: `lolly-demo` (Lolly Demo, ang design system na ginagamit ng lolly.tools), `lolly-start` (ang blangkong panimula) at ang pribadong `suse` |
| `services/` | Ang mga opsyonal na serbisyo ng MCP, certificate at Penpot, at ang server code na pinagsasaluhan nila |
| `schemas/` | JSON Schema para sa mga tool manifest, asset entry at asset reference |
| `scripts/`, `tests/`, `docs/`, `api/` | Mga build at catalog script, test suite ng engine, mga dokumentong ito at mga binuong serverless bundle |

::: details Mga file ng engine at shell na una mong makikita
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

::: note Walang `tools/` o `catalog/` directory sa root ng repository
Sinasagot ng `packages/node-shell/src/content-roots.ts` ang "saan naroon ang tool na `<id>`" at "saan naroon ang catalog" mula sa `profiles.json`. Isinusulat lang ang tunay na pares ng `tools/` at `catalog/` sa build output, tulad ng `dist/`, RPM payload o container image, dahil kinukuha ng browser ang dalawang path na iyon sa HTTP.
:::

<!--i:eti-monitor-->
## Saan tumatakbo ang Lolly

Parehong engine at mga file ng tool ang ginagamit ng bawat interface.

- **Ang web app.** Isang progressive web app. Gumagana ito offline kapag na-cache na ng service worker nito ang mga tool at asset. Hindi nito kailangan ng account, at nasa IndexedDB sa bawat device ang state. Iisang responsive na layout ang ginagamit sa desktop at phone. Sa phone, nagiging sheet ang mga kontrol at bumubukas ang mga kontrol sa export mula sa lumulutang na pill.
- **Ang mga desktop at mobile app.** Mga Tauri package ng parehong web app, na may mga native na file dialog, state sa filesystem at buong paggamit offline.
- **Ang CLI.** Nilo-load ng `lolly <tool-id> --input=value --output=file.png` ang parehong engine sa headless DOM at isinusulat ang file. URL mode ito sa ibang transport. Tingnan ang [CLI](/info/cli.html).
- **Ang TUI.** Isang full-screen na terminal app na pangunahing ginagamit sa keyboard. Ginagamit nito ang bridge ng CLI at pinananatili sa disk ang mga naka-save na session: sa folder ng desktop app kapag naka-install ang app, kung hindi ay sa `~/.lolly`. Nagsisimula lang ito ng headless browser na limitado ang saklaw kapag kailangan ito ng format. Tingnan ang [TUI](/info/tui.html).

![Ang split view sa desktop: mga kontrol na binuo mula sa manifest sa kaliwa, ang live na canvas sa kanan](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

Sa lapad ng phone, nasa itaas ang sheet ng mga kontrol at pinupuno ng preview ang screen.

![Isang audiogram sa screen na 430px ang lapad: ang sheet ng mga kontrol sa itaas, ang tapos na parisukat na artwork sa ibaba at ang lumulutang na export pill](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dzzfxm%3A7%3Alofi%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

Kasama rin sa web app ang **Batch** (`#/batch`, `shells/web/src/pro/`), isang grid na parang spreadsheet na sabay-sabay na nagre-render ng maraming row sa isa o maraming tool. Tingnan ang [Batch at Lolly Multi-edit](/info/batch.html#make-many-versions-of-one-design). Inililista ng **Settings → Capabilities** ang lahat ng idinedeklara ng platform na kaya nitong gawin.

![Batch sa bagong install: isang walang lamang row na naghihintay ng tool, na may spreadsheet interface at Render button bago pa dumating ang anumang data](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

<!--i:eti-lock-->
## Mga prinsipyong sinusunod ng arkitektura

Napagpasyahan na ang mga ito. Nakadepende sa mga ito ang bawat ibang desisyon sa codebase, kaya malaking gawain ang baguhin ang isa.

### 1. Mga declarative na tool, na may opsyon para sa imperative na code

Ang tool ay isang manifest (`tool.json`), isang template (`template.html`) at opsyonal na `hooks.js`. **Ang manifest ang nagdedeklara ng mga input**. Hindi kailanman hinuhulaan ang mga input mula sa mga Handlebars token ng template. Manifest at template lang ang karamihan ng tool, kaya puwedeng gumawa ng mga ito kahit hindi developer.

![Ang control stack ng Street Map: isang city dropdown, theme select, mga weight slider at colour trigger, bawat isa ay mula sa isang linya ng manifest](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

Nagdaragdag ng mga hook ang mga tool na nagkakalkula ng value, tulad ng QR encoding o paghubog ng chart: mga pinangalanang lifecycle function na tinatawag ng runtime na may naka-inject na capability bridge. Kontrata para sa portability ang mga hook, hindi security sandbox. Tumatakbo ang mga ito sa loob ng nakalaang oras. May `isolate: true` ang mga tool na napatunayang walang page global ang mga hook at tumatakbo ang mga ito sa Worker. Nasa [Mga tool hook](/info/tool-hooks.html) ang lifecycle at mga nakalaang oras. Sinasabi ng [Modelo ng Banta](/info/threat-model.html) kung ano ang kayang pigilan at hindi kayang pigilan ng in-page executor.

### 2. Data ang mga tool at asset, hindi naka-bundle na code

Kinukuha ng mga web at Tauri app ang mga catalog ng tool at asset sa pagsisimula, kina-cache ang mga ito at ginagamit ang naka-cache. Hindi kailangan ng app release para sa bagong tool o asset. Sinusuri gamit ang SHA-256 checksum ang mga byte ng asset. Ang `id` at `version` ng asset ang batayan ng pag-invalidate ng cache.

### 3. Ang capability bridge lang ang API na nakikita ng mga tool

Hindi kailanman ginagamit ng mga tool ang DOM sa labas ng template nila, direktang tumatawag ng `fetch` o nagbabasa ng filesystem. Tumatawag sila ng mga may-bersyong `host.*` method. Nakadefine ang kontrata sa `packages/core/src/host-v1.ts`, sa SDK ng may-akda ng tool na `@lolly-tools/core`. Puwedeng bumuo ang third party gamit ang SDK nang hindi nakadepende sa engine. Muling ine-export ng `engine/src/bridge/host-v1.ts` ang mga type nito.

| Kinakailangang API | Ginagawa nito |
|---|---|
| `host.profile` | Ang mga detalye ng user; paunang pinupunan ang mga input gamit ang `bindToProfile` |
| `host.assets` | Mga catalog query, pagtukoy ng asset at picker ng host |
| `host.state` | Mag-save at mag-load ng mga input slot: IndexedDB sa web, filesystem sa Tauri, memory sa CLI |
| `host.clipboard` | Magsulat ng text o larawan sa clipboard, na may mga fallback para sa platform |
| `host.export` | I-rasterise o i-serialise ang render target, at ang path para sa pagbabago ng file sa device |
| `host.log` | Pag-log sa host ayon sa antas |

Opsyonal at dagdag lang ang bawat ibang API: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` at marami pa. Inililista ng `requires` ng manifest ang mga opsyonal na API na tinatawag ng mga hook nito nang hindi muna nagsusuri. Tumatangging i-mount ang tool ang host na kulang ng isa. Sinusuri ng mga hook kung available ang iba. Kailangan din ng ilan, tulad ng `recorder`, ng kakayahan ng device na idinedeklara ng tool. Inililista silang lahat ng `packages/core/src/host-v1/apis.ts` at idinodokumento ng [Host API](/info/host-api.html) ang bawat isa. Minor version ang pagdaragdag ng method. Major version ang pag-alis o pagbabago ng isa, at patuloy na gumagana ang v1 kapag inilabas ang v2.

### 4. Permanente ang mga asset id

Kontrata ang `lolly/logo/primary`. Kapag nailathala na, hindi kailanman nagbabago o muling ginagamit ang id. Pinapataas ng pagbabago sa byte ang `version` sa asset entry. Itinatakda ng pagpapalit ang `deprecated: true` at, kung gusto, ang `replacedBy`. Laging natutukoy ang mga umiiral na reference, kaya patuloy na gumagana nang maraming taon ang mga naka-save na session at ibinahaging link.

### 5. Ganap na sinusuportahan ang URL mode

Maipapahayag bilang URL parameter ang bawat input, kaya ang link ay isang tapos na file:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Ang link na iyon lang, na walang ibang laman, ang tapos na file](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Baguhin ang parameter at makakakuha ka ng ibang file. Ang palette na ito ay isang seed colour, isang harmony at bilang ng hakbang:

![Siyam na hakbang sa apat na hue, lahat ay mula sa iisang seed colour na nasa link](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

Binubuo ng CLI ang parehong URL state mula sa mga argument nito at pinapatakbo ang parehong pipeline, kaya hindi puwedeng lumihis ang CLI sa app. Pina-parse at sine-serialise ng `engine/src/url-mode.ts` ang URL state. Hindi kailanman ipinapasa sa tool ang mga nakareserbang pangalan (`format`, `width`, `dpi`, `c2pa`, `z` at iba pa). Inililista silang lahat ng [Mga nakareserbang URL parameter](/info/url-parameters.html). Sumasama ang mga asset input bilang `id` at tinutukoy gamit ang `host.assets.get()` bago punan ang template.

### 6. Dumadaan sa bridge ang storage

IndexedDB ang ginagamit ng web app, filesystem ng Tauri at memory ng CLI. `host.state.save(slot, data)` at `host.state.load(slot)` lang ang nakikita ng mga tool, hindi kailanman ang `localStorage`. Puwedeng magtago ang mga tao ng ilang pinangalanang session bawat tool nang walang account. Dahil bridge lang ang dugtungan, puwede ring ilipat ang state na iyon. Ine-export ng `shells/web/src/data-transfer.ts` ang state bilang iisang `lolly-backup` file na puwedeng i-import sa anumang ibang install ([Paglipat ng data](/info/data-transfer.html)). Ipinapadala ng [Sync](/info/sync.html) ang parehong bundle sa storage na pinipili ng tao.

### 7. Sinasabi ng mga maturity tag kung ano ang tool

Nagdedeklara ang bawat tool ng `status: official | community | experimental`. Nagso-sort ang gallery ayon sa status. May watermark bilang default ang mga export ng experimental na tool: ino-on ng runtime ang watermark maliban kung magpasa ang tumatawag ng `watermark: false`. Hindi kasama rito ang mga on-device na tool. May sarili pang proseso ng catalog ang team bukod sa mga tag na ito.

### 8. Itinatakda sa manifest ang type ng mga input

Nagdedeklara ang input ng `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` o `file`. Nagre-render ang host ng kontrol para sa bawat type, kaya walang isinusulat na code para sa kontrol ang mga tool. Puwedeng magkaroon ng `bindToProfile` ang anumang input. Tatlong type ang pinakamahalaga:

- Ang **`asset`**, na may `filter` at `allowUpload`, ang bridge sa asset system. Nililimitahan ng `allowUpload: false` ang slot sa mga asset ng library. Pareho ang `AssetRef` na istruktura ng mga upload ng user at ng library.
- Ang **`blocks`** ay umuulit na grupo ng mga field na ine-edit sa side panel, na ginagamit ng Meeting Planner, Wayfinding, Diagrams at iba pa. Kapag nag-click ng naka-render na block, nagkakaroon ng focus ang row nito.
- Hawak ng **`file`** ang sariling file ng user sa memory para sa mga on-device na utility tulad ng Lolly Strip Hidden Data at Compress, at pinagsasama ng **`vector`** ang nakapirming set ng mga numero sa iisang kontrol.

### 9. Walang logic ang mga template

Handlebars ang mga template, kaya puwedeng sumulat ng mga ito kahit hindi developer. Nag-e-escape ang `{{x}}`, at tahasang pagpayag ang `{{{x}}}`. Nasa `hooks.js` ang logic, kung saan puwede itong i-review. Maraming template ang gumagamit ng `{{{` para sa markup na kinalkula ng hook, kaya dapat i-escape ng bawat hook ang ipinapasa nito. Ang mga helper ay `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` at `media`, kasama ang `icsStamp`, `rfcText`, `csvCell` at `arrow` para sa mga kasamang `.ics`, `.vcf` at `.csv` template. Sinasaklaw sila ng [Mga template at pag-render](/info/tool-rendering.html).

### 10. Pinagsasama ng mga tool ang ibang tool

Puwedeng mag-embed ang tool ng render ng ibang tool nang walang mga import sa pagitan ng mga tool. Ang engine ang nag-aayos ng komposisyon. Puwedeng magdeklara ang manifest ng `composes: [{ id, tool, inputs }]` at ilagay ang child gamit ang `{{asset <id>}}`. Lokal na nire-render ng portable na embed URL (`https://lolly.tools/tool/<id>.svg?…`) ang child; ganito naglalagay ang Lolly Design ng live na QR code o chart. Nananatiling vector ang SVG child sa SVG o PDF parent. Mga intermediate lang ang mga child at hindi kailanman nilalagyan ng watermark o stamp. Iniiwang walang laman ng shell na hindi kayang mag-render ng child ang slot, at nagre-render pa rin ang parent. Nasa [Komposisyon at mga brand overlay](/info/tool-composition.html) ang mga detalye.

<!--i:eti-scissors-->
## Ang mga pinili naming hindi gawin

- **Walang arbitraryong JavaScript sa mga template.** Nasa `hooks.js` ang logic.
- **Walang sapilitang asset server.** Nagdaragdag ang mga tao ng sarili nilang file sa Assets sa app at ipinapasa ang gawa bilang session: share link para sa mga input at setting, `.lolly` file kapag kasama rin ang mga upload. Puwedeng maging template sa chooser ng tool ang ibinahaging session. Ang organisasyong gusto ng pinamamahalaang catalog ay puwedeng gumamit ng catalog, mga approval at policy ng Lolly Work, o mamahala ng brand pack sa git at mag-review ng mga pagbabago roon.
- **Walang sapilitang kontrol sa access.** Pampubliko bilang default ang bukas na app. Ang mga maturity tag at watermark ang nagsasaad ng panganib sa brand. Mula sa Lolly Work ang sign-in ng organisasyon, mga role at policy kapag gusto ng team ang mga ito.
- **Walang sentral na database.** Nasa bawat device ang state ng user, at kinokopya ito ng opsyonal na Sync sa storage na pinipili ng tao, hindi kailanman sa database ng Lolly.
- **Walang pinagsasaluhang code path ang mga tool at engine.** Open source ang engine at mga community tool. May sariling mga tool at catalog sa ilalim ng sarili nitong mga tuntunin ang brand pack tulad ng pribadong `brands/suse/`. Walang tool na nag-i-import mula sa `engine/`, kaya nananatiling malinaw ang paghihiwalay.

<!--i:eti-refresh-->
## Ang lifecycle ng isang render

May nagbubukas ng `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`:

1. **Pagsisimula.** Binubuksan ng web app ang IndexedDB, binubuo ang capability bridge at sini-sync ang mga catalog ng tool at asset, o nilo-load ang mga ito mula sa cache kapag offline.
2. **Pag-route.** Pinipili ng path ang tool view para sa `qr-code`, na may query bilang mga panimulang value nito.
3. **Pag-load.** Kinukuha ng `loadTool` ang `tool.json`, bina-validate ito ayon sa schema at kinukuha ang template, mga style at hook.
4. **Pag-parse ng link.** Ginagawang mga input value ng `parseUrlState` ang mga parameter. Ang asset reference tulad ng `?logo=lolly/logo/primary` ay nagiging hindi pa natutukoy na `{ id }`.
5. **Pagsisimula ng runtime.** Binubuo ng `createRuntime(tool, host, initialValues)` ang input model mula sa data ng profile, mga default at link, tinutukoy ang mga asset reference, nilo-load ang mga hook at tinatawag ang `onInit`.
6. **Pag-render.** Nagsu-subscribe ang shell sa runtime, iginuguhit ang mga kontrol mula sa model at isinusulat ang napunang template sa `#tool-canvas`.
7. **Pakikipag-ugnayan.** Tinatawag ng pag-type ang `runtime.setInput`, na nagpapatupad ng mga limitasyon, tumatawag ng `onInput`, muling pumupuno sa template at muling gumuguhit.
8. **Pag-export.** Tinatawag ng **Download** ang `runtime.export(node, format)`, at ginagawa ng `host.export` ng shell ang file: isang raster, vector mula sa DOM walker, PDF, dokumento o isa sa ibang format sa `schemas/tool.schema.json`. Kino-convert ang mga pisikal na unit ayon sa format. Ine-embed ang metadata at Content Credentials kung kayang hawakan ng format ang mga ito. Mula sa host ang watermark ng mga experimental na tool, hindi sa tool. Sinasaklaw ng [Mga template at pag-render](/info/tool-rendering.html) at [Mag-export ng file](/info/exporting.html) ang hakbang ng pag-export.

![Ang export panel na binubuksan ng ?options: ang pares ng filename at format, laki ng output at mga kontrol na nagsusulat ng file](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Tumatakbo ang parehong lifecycle sa Tauri at sa CLI na may headless DOM, kung saan napupunta ang output sa file o stdout.

<!--i:eti-stamp-->
## Mga lisensya

MPL-2.0 ang code, kasama ang `engine/`, `shells/`, `services/`, `schemas/` at documentation generator, sa iisang pampublikong repository na [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). CC BY-SA 4.0 ang prosa ng dokumentasyon. May sariling mga tuntunin ang mga brand pack sa `NOTICE.md` ng bawat pack: MPL-2.0 ang mga community tool, at pag-aari ng SUSE ang pribadong SUSE pack. Nasa [Tungkol](/info/about.html) ang buong tala tungkol sa lisensya.
