# Pangkalahatang-ideya

![Icon ng Lolly - Malaking berde at puting lollipop candy](/info/icon.svg)

Nakukuha ng dokumentong ito ang layunin, istruktura at mga desisyon sa arkitektura para sa Lolly platform. Ipinapakita nito kapwa ang pananaw ng produkto at ang kasalukuyang estado ng codebase.

> **Status:** Ang Lolly ay isang internal na prototype sa isang **closed pilot na hindi pa nakumpleto**. Deterministic at internally consistent ang engine, ngunit maaga pa ang produkto - si SUSE ang customer number one - at ang mga cryptography at file-parsing engine nito ay kasalukuyang sumasailalim sa mahigpit na infrastructure hardening ng SUSE, bilang paghahanda para sa enterprise scale (talagang magaling kami dito). Basahin ang arkitektura sa ibaba bilang design intent na nasa ilalim ng pagsubok, hindi isang tapos at certified na produkto. Tingnan ang [Adoption & Governance](/info/adoption-governance.html#status) para sa kung paano pinapatakbo at sinusukat ang pilot.

> **Paano basahin ang pahinang ito.** May dalang dalawang uri ng materyal ito, ayon sa pagkakasunod-sunod. Ang unang kalahati ay
> **bakit ito umiiral**: ang problema, ang positioning at ang lifecycle na tinatahak ng isang solong asset
> mula simula hanggang katapusan. Mula sa [The big picture](#the-big-picture-how-the-layers-fit) pasulong, ito ay
> **kung paano magkakasya ang mga layer**: ang architecture document para sa mga contributor, sumasaklaw sa paghihiwalay ng engine/shell/pack, ang repository layout, ang mga delivery target at ang mga commitment na naghihigpit sa bawat
> pagbabago sa platform. Kung nandito ka para baguhin ang codebase sa halip na unawain ang
> produkto, magsimula sa big picture.
>
> May dalawang kasamang dokumento na mas malalim kaysa sa pahinang ito. Ang [`engine/README.md`](../engine/README.md) sa
> repository ay ang module-by-module na mapa ng engine, may generated na table ng bawat module at
> kung ano ang pinaparse o isinusulat nito. Ang [Threat Model & Trust Boundaries](/info/threat-model.html)
> ay ang parehong arkitektura na binasa bilang trust boundaries, at ito ang tamang pahina para sa anumang tanong tungkol sa
> kung ano ang itinuturing na untrusted ng engine.

---

## Bakit ito umiiral

Kinakaharap ng mga team ang isang paulit-ulit na problema: paulit-ulit na gawaing creative at content na masyadong predictable para bigyang-katwiran ang paggamit ng bihasang kamay sa bawat pagkakataon, ngunit masyadong sensitibo sa kalidad para ipaubaya nang walang guardrails. Ang resulta ay maaaring mabagal na throughput (specialist bottleneck), kawalan ng pagkakapare-pareho (mga taong gumagamit ng kahit anong tool na meron sila) o vendor lock-in (isang SaaS DAM na kumokontrol sa iyong mga template).

Ang platform na ito ang direktang sagot:

> **Programmatic na creative at content sa malaking sukat** - zero-labor na paglikha ng asset, may mga panuntunang nasa ilalim ng sentral na kontrol, para sa mga empleyado, vendor at partner.

Hindi sa Lolly nililikha ang isang design system - dito ito ginagawa. Isipin mo itong parang vending machine para sa disenyo: pumili, kumuha ng resulta. Sa tuwina. Ginagawa ng engine ang pinakamataas na kalidad na kayang gawin ng bawat format sa hardware na nasa harap mo, at ang parehong engine ang gumagawa ng parehong file sa bawat surface na pinagpapadalhan nito.

Ang resulta ay **kasaganaan**: may tamang signage ang bawat event, tumutugma sa house style ang bawat CVE alert, malinis na naka-print ang bawat label, napapanahon ang bawat email signature - lahat nang walang design ticket. Hinahawakan ng platform ang paulit-ulit at operationalized na creative work. Sadyang hindi ito isang bespoke creative tool - pag-aari pa rin ng mga designer ang flagship work.

### Mag-innovate nang probabilistically, mag-scale nang deterministically

Ang bawat argumento tungkol sa AI sa isang creative pipeline ay natitigil sa parehong tanong: aling bahagi nito ang trabaho ng makina? Ito ay isang lumang tanong na may nasagot nang sagot. Matagal nang gumagawa ang mga scribe at illuminator sa pagitan ng dalawang instrumento - ang maluwag na sketch, kung saan wala pang naayos at kahit ano ay puwedeng subukan, at ang printing press, nakakatakot mismo dahil ito ay nagko-commit. Sa mga sketch nangyari ang sining. Sa press ito umabot sa sinuman. Walang nagkalito sa dalawa, at pareho pa ring umunlad ang mga ito - bagong tinta, bagong uri ng titik, bagong press - bawat isa ay umuunlad nang naaayon sa craft at sa hangaring pinaglingkuran nito.

Iginuguhit ng Lolly ang parehong linya. Mag-explore nang probabilistically: isang model, isang designer, isang magaspang na ideya, isang prompt na pupunta sa isang lugar na walang nagplano. Pagkatapos mag-scale nang deterministically - ang bagay na umaabot sa sampung libong output ay isang *tool*, at ang isang tool ay nagre-render sa parehong paraan sa bawat pagkakataon mula sa mga input na mababasa mo. Nananatiling malaya ang exploration dahil walang downstream na umaasa na dumapo ito sa parehong paraan nang dalawang beses. Nakakakuha ng tiwala ang output dahil hindi ito hula. Ang pagdadala sa AI experimentation tungo sa predictable at reproducible na mga resulta ay hindi bagong disiplina; ito ang parehong dibisyon ng trabaho na nagpahalaga sa printed work na pagkakatiwalaan sa unang lugar.

> Pagkatiwalaan ang creative process, mag-scale nang may rigor.

### Laban sa mga alternatibo

::: figure positioning-comparison
Kumpletuhan ng kakayahan sa mga creative tool ngayon, sinaliksik noong Agosto 2026. Scoring: 0 wala, 25 workaround-grade, 50 tunay ngunit gated o partial, 75 malakas may mga caveat, 100 core competency.
:::

Malinaw ang gap: walang ipinapadala ngayon na nagbibigay sa atin ng constraints-first, offline-capable, low-skill, internally accessible na output. Kasama pa nga sa Lolly ang isang bukas na canvas - **Design** - kung saan sumusunod ang mga kulay, uri ng titik at asset sa brand globals, kaya nananatiling constraints-first ang malayang pag-aayos. Ang **hindi** nito ay isang unconstrained na design suite: patuloy na gumagamit ang mga designer ng Illustrator at Figma para sa bespoke na flagship work. Puwedeng buuin ang mga permutation gamit ang tool na ito.

![Bawat tool sa library bilang isang card, pinangkat ayon sa kategorya, para makapili at makapagsimula agad ang isang producer](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=aud-gallery-landscape)

**Gamitin ito para sa:** Mabilis na paglikha ng operationalized na creative assets - event tiles, name badges, signatures, CVE alerts, QR codes, social cards, consignment labels, structured reports.

**Huwag gamitin ito para sa:** Bespoke hero content.

---

## Ang lifecycle ng isang campaign

Ang pinakamalinaw na paraan para makita kung ano ang Lolly ay hindi isang feature list - ito ay ang pagsubaybay sa isang solong asset habang ito ay dumadaan sa magkakaibang kamay. Panoorin ang paggalaw ng isang localized na campaign card sa buong organisasyon:

1. **Itinatakda ng creative ang mga panuntunan.** Isang designer ang gumagawa ng base template sa Design tool, hard-coding ang typography at color variables ng brand. Hindi sila gumagawa ng isang card - ginagawa nila ang foundational work nang *minsan* para hindi na nila kailanganing i-hand-localize ito ulit.
2. **Ini-scale ito ng developer.** Ikinakabit ang parehong template sa isang nightly pipeline sa pamamagitan ng CLI, kaya awtomatikong nabubuo ang isang sariwang chart o isang bagong language variant - hindi na kailangang buksan ulit ng designer ang file.
3. **Basta na lang ginagamit ito ng producer.** Isang sales rep, offline habang nasa eroplano, ay nagbubukas ng parehong tool at bumubuo ng isang perpektong on-brand na deck para sa isang client meeting. Walang design skill, walang network, walang hintayan.

Ang "sariwang chart" sa hakbang dalawa ay isang render tulad nito, ginawa mula sa isang data string at ilang parameter nang walang sinumang nagbukas ng design file:

![Isang stacked area chart na may pamagat, ang tatlong series nito ay may banda sa isang malamig na palette, kasama ang axes, legend, at pamagat na inilagay lahat ng template sa halip na manu-mano](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Hindi ang punto ay mahusay ang Lolly para sa mga designer *at* mahusay para sa mga developer *at* mahusay para sa sales, bawat isa nang nag-iisa. Isa itong **relay race**: ang paunang gawa ng creative ay ini-scale ng developer, na sa gilid nito ay nagbibigay-kapangyarihan sa producer. Ang walang-pagod na karanasan para sa non-technical na rep sa eroplano ay *posible* lamang dahil sa rigor na itinakda ng designer at na-deploy ng developer.

Iyan ang force multiplier. Hindi ang Lolly ay isang drawer ng magkakahiwalay na tool para sa magkakahiwalay na tungkulin - ito ay isang deterministic na asset lifecycle na hinihipo ng bawat tungkulin, at pinararami ng bawat kamay na dinadaanan nito ang halaga ng nauna.

---

## Isang approval, sampung libong asset

Dahil naninirahan ang approval sa tool at hindi sa file (tingnan ang [How Lolly compares](/info/positioning.html)), hindi na naging problema sa review ang scale. I-approve nang minsan ang isang localized na social-card tool, pagkatapos bumuo ng **10,000 asset sa 12 wika** mula sa isang spreadsheet - at wala isa man sa mga ito ang nangangailangan ng sariwang compliance check mula sa legal o brand, dahil naaprubahan na ang template na pinagmulan nilang lahat.

Naaabot ng parehong deterministic na tool ang sukat na iyon sa tatlong paraan, na lahat ay gumagawa ng magkatulad, pre-approved na output:

- <!--i:people--> **Isang tao, sa loob ng app.** Ang `/pro` batch grid: i-paste o i-import ang mga row, kumuha ng isang natapos na asset kada row, i-download ang zip. Walang design skill, walang ticket, walang hintayan.
- <!--i:code--> **Isang developer, mula sa command line.** Pinapatakbo ng CLI ang *parehong* engine at *parehong* render path nang headless, kaya puwedeng i-sequence ang tool sa lahat ng 10,000 row sa isang script o isang nightly pipeline. Ang isang `lolly <tool> --field=…` na tawag sa isang loop ang buong integration.
- <!--i:cpu--> **Isang system o isang AI agent, sa MCP.** Ang parehong tool na pinapatakbo nang programmatic, sa parehong fidelity at mas malaking sukat pa - dahil hindi mababagot ang isang makina habang dumaraan ang libu-libong file.

![Batch mode sa isang bagong install: isang walang laman na row na naghihintay ng isang tool, kasama ang buong spreadsheet surface at ang Render button nito na nasa lugar na bago pa man may dumating na data](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

Isang set ng brand constraints, itinakda nang minsan ng isang designer; tatlong ruta patungo sa magkatulad na pre-approved na output - at ang ruta ng makina ang pinaka-umaabot sa sukat, dahil hindi ito napapagod habang dumaraan ang mga file.

---

## Ang malaking larawan: kung paano magkakasya ang mga layer

Ang lahat mula rito pababa ay arkitektura. Ang diagram ay ang buong sistema sa isang tanawin: ang mga tool ay
data sa itaas, walang alam ang engine sa gitna tungkol sa anumang platform, ang mga shell sa ilalim nito
ay nagpapatupad ng isang kontrata, at ang mga catalog ang naghahatid ng content.

```
                ┌─────────────────────────────────────────────┐
                │              Tools (data, not code)         │
                │   tool.json + template.html + hooks.js?     │
                └─────────────────────────────────────────────┘
                                    ▲
                                    │ talks to via Capability Bridge v1
                                    ▼
                ┌─────────────────────────────────────────────┐
                │                  Engine                     │
                │   loader · validator · runtime · template   │
                │   inputs · url-mode                         │
                │   PLATFORM AGNOSTIC. Knows nothing of DOM,  │
                │   filesystem, or You.                       │
                └─────────────────────────────────────────────┘
                                    ▲
                                    │ implements HostV1
                                    ▼
        ┌──────────────┬──────────────┬──────────────┬──────────────┐
        │  Web Shell   │ Tauri Desktop│ Tauri Mobile │  CLI Shell   │
        │   (PWA)      │              │              │              │
        └──────────────┴──────────────┴──────────────┴──────────────┘
                                    ▲
                                    │ fetches from
                                    ▼
                ┌─────────────────────────────────────────────┐
                │              Catalogs                       │
                │   catalog/tools/index.json + tool dirs      │
                │   catalog/assets/index.json + asset files   │
                └─────────────────────────────────────────────┘
```

### Repository layout

Naka-mount ang content bilang mga pack: `community/`, `docs/`, bawat `shells/*`, kapwa ang `services/*` at `brands/suse` ay bawat isa'y sariling repository, na naka-checkout bilang git submodules ng isang ito. Pag-aari ng parent ang `engine/`, `schemas/`, `scripts/`, `tests/`, `api/`, `brands/lolly-start/` at `profiles.json`. Tingnan ang [Build Guide » Getting the source](/info/build-guide.html) para sa checkout command at ang cross-repo workflow.

```
lolly/
├── engine/           # Platform-agnostic core. Open source (MPL-2.0).
│   └── src/
│       ├── index.ts          # public surface - loader, runtime, template, inputs, url-mode
│       ├── loader.ts         # fetches and validates tool files
│       ├── runtime.ts        # orchestrates the 5-step lifecycle
│       ├── template.ts       # Handlebars hydration + annotateTemplate
│       ├── inputs.ts         # manifest → runtime input model
│       ├── url-mode.ts       # URL ↔ input state round-trip
│       ├── validate.ts       # JSON Schema validation of manifests
│       ├── compose.ts        # resolve nested tool renders (composes)
│       ├── embed.ts          # parse portable lolly.tools embed URLs
│       └── bridge/
│           └── host-v1.ts    # type re-export of the @lolly-tools/core contract
│
├── shells/
│   ├── web/          # PWA - hosted online; primary distribution
│   │   └── src/
│   │       ├── main.ts           # boot, routing
│   │       ├── theme.ts          # theme apply/persist (FOUC prevention)
│   │       ├── bridge/           # web implementations of HostV1 APIs
│   │       │   ├── index.ts      # compose all bridge pieces
│   │       │   ├── db.ts         # IndexedDB setup
│   │       │   ├── state.ts      # host.state - saved edits
│   │       │   ├── profile.ts    # host.profile - user details
│   │       │   ├── assets.ts     # host.assets - catalog + user uploads
│   │       │   ├── clipboard.ts  # host.clipboard
│   │       │   ├── export.ts     # host.export - rasterise/serialize
│   │       │   ├── net.ts        # host.net - allowlisted fetch
│   │       │   └── media.ts      # host.media - live camera frames (onFrame)
│   │       ├── catalog/
│   │       │   └── sync.ts       # boot-time catalog sync + offline cache
│   │       ├── styles/           # app-wide CSS (app.css, picker.css, tokens.css)
│   │       └── views/
│   │           ├── gallery.ts    # tool library listing + saved-state cards
│   │           ├── tool.ts       # mounts one tool (inputs + canvas + actions)
│   │           ├── picker.ts     # asset picker UI (invoked by host.assets)
│   │           ├── profile.ts    # user details editor
│   │           ├── projects.ts   # /p - folders of saved sessions (nested; folder/selection export)
│   │           └── free-canvas.ts # free-canvas editor overlay for render.layout:"editor" tools
│   │
│   ├── cli/          # Node.js CLI - same engine, headless jsdom
│   │   ├── bin/lolly.ts
│   │   └── src/
│   │       ├── run.ts    # loadTool → createRuntime → export → write file
│   │       └── bridge.ts # CLI implementation of HostV1
│   │
│   ├── tui/          # Interactive terminal shell (Ink) - reuses the CLI bridge
│   │   └── src/
│   │       ├── main.tsx  # full-screen app: Gallery / Projects / Profile / ToolView
│   │       └── bridge.ts # CLI bridge + on-disk state under ~/.lolly
│   │
│   ├── tauri-desktop/ # downloadable desktop app
│   └── tauri-mobile/  # iOS/Android app
│
├── tools/            # profile VIEW (gitignored) - data, not code. Merged from packs:
│                     #   community/ (public, brand-agnostic, MPL) + brands/<active>/tools (brand-owned).
│                     #   A SELECTION follows - the mounted set depends on the profile.
│   ├── qr-code/
│   ├── quotes/
│   ├── email-signature/
│   ├── snippet/
│   ├── countdown-timer/
│   ├── color-palette/
│   ├── color-block/           # typed/heterogeneous blocks (addMenu discriminator)
│   ├── dynamic-layout/
│   ├── tool-logo/         # "Logo" - auto-switching brand logo
│   ├── street-map/        # offline vector city-block maps
│   ├── url-shot/          # "URL Screenshot" (capture capability)
│   ├── strip-data/        # on-device metadata strip - JPEG/PNG/SVG/PDF (file in → clean file out)
│   ├── compress-pdf/      # on-device PDF compressor - recompresses images (file in → smaller file out)
│   ├── brand-lockup/      # "Brand Lockup" - SUSE logo lockups; HarfBuzz text-to-path (wasm)
│   ├── chart-creator/     # SVG charts from structured data
│   ├── filter/            # photo effects in one tool - halftone/scanline/posterize/voronoi (vector), duotone/pixel-stretch/imperfections (raster)
│   ├── meeting-planner/   # global timezone meeting scheduler
│   ├── calendar-ics/      # event → .ics calendar file plus a card
│   ├── digi-ad/           # "Animated Ad" - looping banner from scenes
│   ├── event-name-badge/  # conference badges - composes qr-code as an SVG
│   ├── wayfinding-signage/ # event signage; directions blocks auto-fit label text
│   ├── text-helper/       # on-device text workbench (format/decode/hash/de-identify)
│   ├── design/     # "Design" - freeform WYSIWYG editor canvas (render.layout: editor)
│   ├── multi-page-pdf/    # multi-page PDF document - cover, flowing content blocks, back page
│   ├── diagram-builder/   # org / layercake / process / cycle / pyramid diagrams
│   ├── logo-wall/         # many logos → auto-packed grid
│   ├── logo-lockup-partner/ # SUSE + partner co-brand lockup
│   ├── icon/          # favicon .ico / png / svg from text + colours
│   ├── lottie-digi-ad/    # animated Lottie ad banners
│   └── pose-geeko/        # pose the SUSE Geeko mascot - print-ready stills
│
├── catalog/
│   ├── tools/index.json        # tool registry
│   └── assets/
│       ├── index.json          # asset registry
│       └── suse/...            # logo, palette, etc.
│
├── schemas/          # JSON Schema for tool.json, asset entries, AssetRef
├── scripts/          # build-catalog-index.ts, checksum-assets.ts, validate-catalog.ts
├── tests/            # engine tests
└── docs/             # this file + authoring guides + positioning
```

---

## Modelo ng paghahatid ng platform

Tumatakbo ang platform sa ilang surface - web PWA, Tauri desktop/mobile, ang scriptable CLI at ang interactive TUI. Ginagamit ng lahat ng ito ang parehong engine at ang parehong tool files.

### Web (PWA) - primary na distribution
Hosted sa isang SUSE-controlled na URL. Gumagana offline kapag na-cache na ng service worker ang mga tool at asset. Dito gagamitin ng karamihan sa mga empleyado, vendor at partner ang platform. Walang kailangang account - naka-store ang state sa IndexedDB kada device.

Responsive ang web shell mula sa isang layout. Sa desktop, ang isang tool ay isang resizable na controls sidebar sa tabi ng isang preview stage na may trackpad-native canvas navigation (Cmd/Ctrl-wheel o pinch para mag-zoom sa paligid ng cursor, Space- o middle-drag para mag-pan, mga `0`/`1`/`+`/`−` key at isang Fit/% HUD). Sa mobile (≤640px), nagiging isang top-anchored na sheet ang mga control na may drag grip na sumasnap ng peek/half/full (tumo-toggle ang tap) sa ibabaw ng isang static na full-screen preview, at nagbubukas ang isang lumulutang na **Render** button ng mga **Export** control sa isang bottom-sheet popup. Nakukuha ng touch ang pinch-zoom at drag-pan sa preview. Magkatulad ang render path at ang mga export control sa dalawa - ang chrome lamang ang nag-reflow.

![Ang desktop split view - mga kontrol na ginawa mula sa manifest sa kaliwa, ang live canvas sa kanan](/t/url-shot?url=%2F%23%2Ftool%2Fchart-creator&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=aud-web-split)

Ang parehong tool sa phone width, walang pangalawang layout na dapat pagtuunan: nagiging isang sheet ang mga kontrol sa itaas, kinukuha ng preview ang buong screen at lumulutang ang render pill sa ibabaw nito.

![Isang audiogram sa isang 430px-wide na screen - ang controls sheet sa itaas, ang tapos na square artwork sa ibaba, at ang floating render pill](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

**Batch mode (`/pro`).** Ang web shell ay nagbibigay din ng spreadsheet-style na batch grid (`shells/web/src/pro/`) na nagre-render ng maraming row nang sabay-sabay sa isa o maraming tool. May CSV/TSV round-trip ito kasama ang spreadsheet paste, per-row na template/format/size/unit/dpi, isang blocks-editor side panel na may live preview, mga collapsible export column, isang per-row na "relevance" tag bar, left drag-handle row reorder, two-step delete confirm, mga naka-save na batch session at isang `.zip` download. Ito ang one-to-many surface sa likod ng "mass content generation" positioning.

### Tauri desktop / mobile
Packaged native app (maliit ang footprint sa pamamagitan ng Tauri). Nagbibigay ng buong offline availability, filesystem access para sa mga CLI-dependent na tool (PDF Smasher, Font Outliner) at camera access. Naka-iskedyul para sa mid-2026 na tooling enhancement.

### CLI
`lolly <tool-id> [--input=value ...] --output=file.png`

Puwedeng tawagin ng mga desktop user ang maraming tool mula sa terminal. Ini-load ng CLI shell ang parehong engine, gumagawa ng jsdom DOM, tumatakbo sa parehong render path at isinusulat ang file. Ang URL mode ang transport - hindi ito hiwalay na implementasyon ang CLI. Ito ang siyang nagbibigay-garantiya na magkapareho ang output ng CLI at GUI.

```bash
lolly qr-code --url=https://suse.com --output=qr.svg
lolly quotes --quote="Ship it." --output=quote.png
lolly                        # lists available tools
lolly qr-code                # lists inputs for that tool
```

### TUI
`npm run tui`

Ang interactive na katapat ng CLI: isang full-screen, keyboard-first na terminal app (binuo sa Ink) para mag-browse ng mga tool, punan ang mga input, mag-save ng mga project at mag-export - lahat nang walang GUI. Ang host bridge nito ay **muling gumagamit ng implementasyon ng CLI** para sa mga DOM-free na format (SVG/EMF/EPS/HTML + text/data), at nagdadagdag ng on-disk na state sa ilalim ng `~/.lolly` kasama ang opt-in inline preview. Bukod pa rito, mayroon itong **browser render tier**: isang scoped headless Chromium (ang parehong isa na in-install ng MCP server) na gumagawa ng raster/PDF/video at live-URL capture kapag kailangan - pinapatakbo ang isang built copy ng web shell para magkapareho ang output, at nagsisimula lang kapag una mong ini-export ang ganitong format. Kaya't tumatakbo rin sa terminal ang `url-shot` (kasama ang crop + recolor + vector PDF/SVG) at bawat raster/pdf tool. Tingnan ang [TUI guide](/info/tui.html).

Kahit saang surface ka naroroon, ang Capabilities tab ng dashboard ang buong mapa ng lahat ng kaya gawin ng platform ayon sa deklara nito, nakagrupo at madaling basahin nang hindi na kailangang buksan ang isang tool.

---

## Mga kategorya ng tool

Ang mga tool ay may tag na `category` sa kanilang manifest para sa gallery grouping.

Nakalista ang mga row ayon sa pagkakasunod-sunod ng gallery section. Ang `utility` section ay palaging nire-render nang **huli** sa gallery (pagkatapos ng bawat ibang kategorya, kasama ang mga susunod pa) - ito ang on-device na "Offline Utilities" drawer.

| Kategorya | Mga Halimbawa | Nakaplano |
|---|---|---|
| `everyone` | QR Code Generator, Quote Card, Email Signature, Logo, Wordmark, Audiogram, Battlecards, Sequence Studio, Record | Employee Image Stationery |
| `designer` | Brand Lockup, Design, Chart, Darkroom, Filter, Pose Geeko, Multi-Page PDF | Font Outliner |
| `event` | Meeting Planner, Event Name Badge, Wayfinding Signage, Calendar ICS, Booth Studio | Event Stationery, Bulk Name Badges, Room Agenda Cards |
| `product` | - | CVE Alert, Product Release Announcement, Blog OG Image |
| `utility` | Strip Hidden Data, Text Helper, Compress PDF, Convert Image, Convert Font, Redact, Run Web Code, Screen Capture, URL Screenshot | Unit/format converters, more on-device privacy utilities |

Ang mga cell na iyon ay **mga halimbawa lang, hindi imbentaryo**. Ang kung anong mga tool ang umiiral ay katangian ng profile na na-mount mo, hindi ng pahinang ito: nagdaragdag ang isang brand pack ng sarili nitong mga tool, at puwede rin nitong ibukod ang isang community tool na ayaw nitong i-ship. Ang `catalog/tools/index.json` - na ginawa mula sa mga manifest, at siyang registry na aktwal na binabasa ng gallery - ang authoritative na listahan; para bilangin kung ano ang na-mount ng isang profile, bilangin ang mga manifest (`ls community/*/tool.json brands/*/tools/*/tool.json`) sa halip na paniwalaan ang isang bilang na nakasulat dito. (Ang isang tool id na nasa dalawang pack ay minamount nang isang beses lang, mula sa nagwaging pack.)

Ang mga tool ay klasipikado rin ayon sa status: `official` (aprubado ng brand, walang watermark), `community` (external na kontribusyon), `experimental` (may watermark ang mga export). Karamihan sa library ay `official`; ang mas bagong mga studio at ang mga capture tool ay madalas na nasa `community` o `experimental` habang naaayos pa ang mga ito. Ipinapakita ng bawat surface ang badge, kaya alam ng reader kung ano ang kinukuha nila bago pa nila ito buksan - at, tulad ng mga category cell sa itaas, masyadong mabilis magbago ang per-status na membership para ienumerate dito. Basahin ito sa gallery o sa generated index.

Ang **Design** ang unang tool na binuo sa `render.layout: "editor"` na free-canvas mode - isang chromeless, direct-manipulation na surface kung saan idi-drag, ire-resize, iikot at isnap mo ang mga box ng text, hugis at larawan, pagkatapos ay i-export sa pamamagitan ng parehong render path gaya ng bawat ibang tool.

Ang **Strip Hidden Data** ang unang **on-device na utility** (`privacy: "on-device"`): isang content-transform tool na kumukuha ng file na *ibinigay mo*, prinoproseso ito nang buo sa browser at ibinabalik ang malinis na kopya - kailanman hindi ina-upload, kailanman hindi nilalagyan ng watermark, walang provenance na naka-stamp. Ang **Text Helper** ang pangalawa - isang on-device na workbench para sa pang-araw-araw na paste-into-a-website na trabaho (JSON format, JWT decode, Base64, URL encode/decode, SHA hashing). Ang **Compress PDF** ang pangatlo - pinapaliit nito ang isang PDF sa pamamagitan ng pag-recompress ng mga larawan nito, muli nang buo sa on-device. Sinasaklaw na ngayon ng marker at ng badge text nitong "Runs on your device - nothing is uploaded" ang buong hanay ng transform: Strip Hidden Data, Text Helper, Compress PDF, **Convert Image** (HEIC/TIFF/AVIF → WebP/JPG/PNG), **Convert Font**, **Redact** (sirain ang mga rehiyon ng isang larawan, SVG o PDF), **Prompt to Image** at **Rebrand a Deck** (baguhin ang tema ng isang `.pptx` sa lugar nito) kung saan minamount ito ng profile. Ito ay isang privacy-utility na kategorya na pumapalit sa pagbibigay ng mga kumpidensyal na file sa mga single-purpose na website.

![Ang Utilities drawer, kung saan bawat card ay isang tool na nagtatransform ng file na mayroon ka na](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=aud-utilities)

> Tandaan: ang `category` at `status` ay denormalized sa `catalog/tools/index.json` (ang registry na binabasa ng gallery) mula sa bawat `tool.json`. Ang manifest ang source of truth - ang index ay **ginawa** ng `npm run build:catalog` at nabibigo ang `npm run validate:catalog` sa CI kung magkaiba ang committed na index sa mga manifest.

---

## Mga arkitekturang komitment

Napagpasyahan na ang mga desisyong ito. Ang pagbabago sa alinman sa mga ito ay isang malaking gawain - hinuhubog nila ang bawat ibang desisyon sa codebase.

### 1. Deklaratibong mga tool, na may imperatibong escape hatch

Ang isang tool ay isang manifest (`tool.json`) + isang template (`template.html`) + opsyonal na `hooks.js`.

**Idineklara ng manifest ang mga input.** Hindi ang template. Ang mga input ay hindi hinuhulaan mula sa mga Handlebars token. Ang manifest ang kontrata; ginagamit ng template ang mga pinangalanang variable sa pamamagitan ng `{{id}}`.

![Control stack ng Street Map - isang city dropdown, isang theme select, mga weight slider at mga colour trigger, bawat isa sa mga ito ay iginuhit mula sa isang linya ng manifest](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

**Opsyonal ang mga hook.** Karamihan sa mga tool ay puro deklaratibo - sapat na ang manifest + template. Ang mga tool na nangangailangan ng mga computed value (QR encoding, chart data shaping) ay nagbibigay ng `hooks.js` na naglalantad ng mga pinangalanang lifecycle function (`onInit`, `onInput`, `onFrame` - ang per-frame na live-camera hook para sa mga motion-reactive na tool - `onLevel`, `beforeExport`, `afterExport`, `exportFile` - ang file-in/file-out na transform path na ginagamit ng mga on-device na utility tulad ng Strip Hidden Data - at `exportStill`, para sa isang tool na may sariling deep raster). Ini-load ng host ang mga hook sa pamamagitan ng `new Function('host', …)` na may na-inject na capability bridge bilang closure scope. Ito ay isang **portability contract, hindi security sandbox**: tumatakbo pa rin ang mga hook sa page realm at *kaya* nilang ma-access ang `window`/`fetch`/`document` sa isang browser shell - ang `host.*` ang suportado, portable na surface, hindi ito isang ipinatutupad na hangganan. Naka-time-box ang mga asynchronous na resulta ng hook (`onInit` 5s, `onInput` 2s, `beforeExport`/`afterExport` 5s, `exportFile`/`exportStill` 10s) at itinatapon ang mga huling resulta; hindi mapipigilan ang isang tumatakbong *synchronous* na hook na tumagal nang husto. Kaya't hindi pa ligtas na patakbuhin ang untrusted na third-party hook code hanggang mailunsad ang Worker isolation.

Mahalaga ito dahil: puwedeng likhain ng mga hindi developer ang mga deklaratibong tool. Kung bawat tool ay isang web app, ang risk note na "limited skills to create/maintain workhorse templates" ay nagiging permanenteng bottleneck.

### 2. Ang mga tool at asset ay data, hindi bundled code

Kinukuha ng web at Tauri app ang mga tool at asset catalog mula sa isang kilalang URL sa boot, ina-cache ito nang lokal at gumagana sa kung anuman ang naroroon. **Ang pagdadagdag ng bagong event tile o seasonal na asset ay hindi nangangailangan ng app release.**

Ang mga byte ng asset ay may SHA-256 checksum para maiwasan ang CDN poisoning. Ang `id` + `version` ng asset ang nagdadala ng cache invalidation.

### 3. Ang Capability Bridge lang ang API na nakikita ng mga tool

Hindi kailanman hinihipo ng mga tool ang DOM sa labas ng template area nila, hindi kailanman direktang tumatawag ng `fetch`, hindi kailanman bumabasa ng filesystem. Tumatawag sila ng mga versioned na `host.*` method. Ang canonical na kahulugan ng kontrata ay `packages/core/src/host-v1.ts` - ang tool-author SDK na `@lolly-tools/core`, para makagawa ang isang third party laban dito nang hindi umaasa sa engine; ang `engine/src/bridge/host-v1.ts` ay isang type re-export nito, at patuloy na nag-i-import mula sa path na iyon ang engine/shell code nang walang pagbabago:

| Bridge API | Ano ang Ginagawa |
|---|---|
| `host.profile` | Firstname, email, headshot, city, atbp. ng user. Nagpu-pre-fill ng mga input sa pamamagitan ng `bindToProfile`. |
| `host.assets` | Mga catalog query, asset resolution, host-provided na picker UI. |
| `host.state` | Mag-save / mag-load ng mga input slot. IndexedDB sa web, filesystem sa Tauri, memory sa CLI. |
| `host.clipboard` | Magsulat ng text o larawan sa clipboard (na may mga platform fallback). |
| `host.export` | I-rasterize o i-serialize ang render target. Naglalapat ng watermark para sa mga experimental na tool. |
| `host.net` | Allowlisted na fetch - available lang kung idineklara ng tool ang `"network"` capability. (Walang shipping tool sa kasalukuyan na gumagamit nito.) |

Lumalabas lang ang mga opsyonal, additive na surface kapag ibinibigay ito ng isang shell. Ang ilan ay **capability-gated** - ipinapakita lang kapag idineklara ng tool ang katugmang flag: `host.compose` (i-embed ang render ng ibang tool - `compose`), `host.capture` (page capture para sa URL Screenshot - `capture`) at `host.recorder` (mic/camera/display capture para sa mga recording tool - `microphone` / `camera` / `screen`). Ang iba ay **feature-detected** - naroroon kapag kaya itong ibigay ng shell, na may fallback na pinapanatili ng tool para sa mga shell na hindi kaya.

Ilang headline na surface, para ipakita kung ano ang saklaw nito - dokumentado ang bawat isa sa [Host API](/info/host-api.html), at ang `packages/core/src/host-v1.ts` mismo ang kontrata:

| Surface | Simula Bersyon | Ano ang idinaragdag nito |
|---|---|---|
| `host.tokens` | 1.0 | DTCG design token - ang sariling primitives ng brand |
| `host.text` | 1.0 | Text-to-path sa pamamagitan ng HarfBuzz WASM (minamarkahan ng `wasm` capability flag ang mga tool na umaasa dito) |
| `host.media` | 1.4 | Live na camera frame na nagpapatakbo sa `onFrame` hook. Progressive enhancement, sinasadyang *hindi* naka-gate sa `camera` flag - gumagana pa rin ang ganitong tool bilang isang ordinaryong still-image na tool |
| `host.color` | 1.40 | Perceptual na matematika ng kulay: ΔEOK, WCAG + APCA contrast, OKLab ramp, class-break, categorical na palette, harmony scheme (1.60), CSS Color 4 mixing, at gradient baking (1.68). Pure at synchronous - ikinakabit ng mga shell ang `makeColorApi()` ng engine sa halip na mag-implement ng kahit ano, kaya hindi ito puwedeng mag-drift |
| `host.images` | 1.60 | Pag-decode / pag-resize / pag-re-encode ng byte sa device - ang convert path (HEIC → JPEG, i-compress sa WebP, i-downscale). Ipinapadala sa web shell bilang isang lazy facade, kaya ang HEIC decoder ay hindi kailanman pumapasok sa boot chunk |
| `host.geom` | 1.64 | Eksaktong vector geometry: path boolean, offsetting, stroke-to-fill, spline lowering, simplification, hit testing. Pure rin, synchronous, at ikinakabit mula sa engine (`makeGeomApi()`); ang mga failure ay *ibinabalik*, hindi kailanman ini-throw |

Sinusunod ng iba ang parehong mga tuntunin at nakadokumento kasama ang mga ito: `pdf` (1.8) at `pptx` (1.58) para sa on-device na document surgery, `audio` (1.71) at `speech` (1.96) para sa clip analysis at on-device na TTS/transcription, `viz` (1.72) para sa MilkDrop placeholder contract, `codec` (1.100) at `layers` (1.102) para sa deep-bit at layered-bitmap na output, `upscale` (1.101) at `matte` (1.103) para sa mga on-device na modelo, `raster` (1.105) para sa mga hook na gumagawa ng sarili nilang pixel work, `connectors` (1.106) para sa export-safe na mga arrow at `c2pa` (1.85) para sa pag-sign ng natapos na bytes. Lumalaki ang bilang; hindi ang mga tuntunin.

Ang mga deklarableng capability ay: `network`, `filesystem`, `clipboard`, `camera`, `microphone`, `screen`, `ffmpeg`, `wasm`, `capture`, `compose`. (`screen`, idinagdag noong 1.54, ay display capture sa pamamagitan ng `host.recorder` - pinipili ng user ang isang screen/window/tab sa browser-native UI; iba ito sa `capture`, na nagra-rasterize ng isang URL na pinangalanan mismo ng tool.)

Tumatakbo ang parehong tool sa browser, Tauri at headless CLI dahil ini-implement ng bawat shell ang interface na ito - hindi kailanman alam ng tool kung saan ito nasa loob.

Ang bridge ay versioned. Ang pagdadagdag ng mga method ay isang minor version. Ang pag-alis o pagbabago ng mga signature ay isang major version bump. Kapag lumunsad ang v2, dapat gumana pa rin ang v1.

### 4. Ang mga Asset ID ay panghabambuhay

Ang `suse/logo/primary` ay isang kontrata. Kapag na-publish na:
- Hindi kailanman nagbabago ang ID, hindi kailanman nire-reuse.
- Mga pagbabago sa byte → i-bump ang `version` sa manifest.
- Pinalitan ng bagong asset → itakda ang `deprecated: true` at opsyonal na `replacedBy`.
- Palaging naresolba ang mga umiiral na reference.

Ginagawa nitong matibay ang mga naka-save na tool state at URL-shared na link sa loob ng maraming taon.

### 5. Ang URL mode ay first-class

Ang bawat input ay dapat maipahayag bilang isang URL parameter:

```
lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H
```

![Ang link na iyon nang mag-isa, na walang iba pang laman, ang natapos na asset](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fsuse.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Ang CLI mode ay URL mode sa ibang transport - ang CLI shell ay bumubuo ng URL-state object mula sa argv at pinapatakbo ang **parehong** engine pipeline. Iisa lang ang render path. Hindi puwedeng mag-drift ang CLI mula sa GUI dahil hindi ito hiwalay na implementasyon.

Hinahawakan ng `url-mode.ts` ang round-trip (parse at serialize). Ang isang set ng **reserved params** ay hindi kailanman ipinapasa sa tool bilang mga input: ang mga output control (`format`, `export`, `copy`, `filename`, `width`/`w`, `height`/`h`, `unit`, `dpi`), ang print at provenance dial (`bleed`, `marks`, `profile`, `password`, `c2pa`, `imprint`, `durable`, `meta`, `hdr`, `depth`, `cuts`) at ang mga state carrier (`template`, `z` - ang "Shortest link" na packed token - at `zx`, ang parehong na-encrypt gamit ang isang password). Ang `RESERVED` na set sa `engine/src/url-mode.ts` ang awtoridad at naka-pin ng isang test; dokumentado ng [URL Mode](/info/url-mode.html) ang bawat isa sa mga ito, kasama ang ilang hindi nakalista dito. Ang mga asset input sa URL mode ay naka-serialize ayon sa kanilang `id`; nire-resolba ito ng runtime sa pamamagitan ng `host.assets.get()` bago mag-hydrate. Ang `width`/`height` ay mga value sa `unit` (default na `px`, pati na rin ang `mm`/`cm`/`in`/`pt`/`pc`); sa isang physical unit, itinatakda ng `dpi` ang raster resolution. Itinatakda nila ang canvas document size at pina-pre-fill ang export dimensions panel.

Dahil bumibiyahe sa link ang bawat input, ang pagbabago ng isang parameter ay ibang natapos na asset. Ang buong palette na ito ay isang seed colour, isang harmony at isang step count:

![Siyam na hakbang sa apat na kulay, lahat ay nagmula sa iisang seed color na dala ng link](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

### 6. Dumadaan ang storage sa bridge, hindi direkta

Web shell: IndexedDB. Tauri: filesystem. CLI: in-memory. Ang tanging nakikita ng mga tool ay `host.state.save(slot, data)` at `host.state.load(slot)`. Hindi ginagamit ang `localStorage` - masyado itong maliit at hindi kayang maghawak ng mga blob.

Maaaring mag-save ang mga user ng maramihang pinangalanang edit slot bawat tool at bumalik sa bawat session sa ibang pagkakataon. Hindi kailangan ng paggawa ng account; per-device ang state. Dahil ang bridge lang ang tanging seam, ang per-device state na iyon ay *portable* din: binabasa ng `shells/web/src/data-transfer.ts` ang lahat pabalik sa pamamagitan ng `host.profile`/`host.state`/`host.assets` papunta sa iisang `lolly-backup` zip na nag-i-import sa kahit anong ibang install - ang offline na sagot sa "lumipat sa bagong device" na hindi nangangailangan ng server (buong spec: `docs/data-transfer.md`). Ang SUSE ID integration (multi-device sync) ay isang milestone sa hinaharap sa ibabaw nito.

### 7. Sinasagot ng maturity tags ang panganib na "naaprubahan ng brand" sa pamamagitan ng disenyo

Idinideklara ng bawat tool ang `status: official | community | experimental` sa manifest nito. Inaayos ng gallery ayon sa status. Awtomatikong nilalagyan ng watermark ang mga export ng experimental na tool - inilalapat ang watermark ng `host.export.render`, hindi ng tool, kaya hindi ito maaaring i-opt out ng isang non-official na tool author.

Isa itong structural na sagot sa panganib ng perception na ang paggamit ng kahit anong tool ay nangangahulugan ng aprubasyon ng brand. Nagdaragdag sa ibabaw nito ang mga process na sagot (review queue, SUSE ID gating).

### 8. Naka-type ang mga input ng tool sa pamamagitan ng manifest, kasama ang mga asset

Idinideklara ng mga input ang `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` at `file`. Nagre-render ang host ng generic na control kada type mula sa manifest - walang isinusulat na control code ang mga tool. (Ang pre-filling mula sa profile ng user ay hindi isang type - kahit anong input ay maaaring magdala ng `bindToProfile`.) Tatlo ang mas mabigat kaysa sa iba:

- **`asset`** (na may `filter` at `allowUpload`) ang bridge patungo sa global na asset system; ang `allowUpload: false` ang brand-enforceability lever para sa mga bagay tulad ng sponsorship-tile logo kung saan library assets lang ang pinapayagan. Gumagamit ang user uploads ng parehong `AssetRef` shape gaya ng library assets, kaya pantay ang pagtrato sa kanila ng mga tool.
- **`blocks`** ay isang paulit-ulit na field-group - isang mini-table sa loob ng isang input, ineedit sa isang side panel, na may typed/discriminated na add menu at per-block asset fields. Ang pag-click sa isang na-render na block sa canvas ay nagti-focus sa row ng block na iyon. Ginagamit ng `meeting-planner`, `chart-creator`, `event-name-badge`, `wayfinding-signage`, `color-block` at `digi-ad`.
- **`vector`** ay pinagsasama-sama ang isang fixed na set ng mga numero (hal. isang transform) sa isang compound control; hinahawakan naman ng **`file`** ang sariling file ng user bilang bytes sa memory para sa on-device transform utilities (hal. `strip-data` at `compress-pdf`).

### 9. Walang logic ang mga template (Handlebars, hindi EJS)

Sinadya ang pagpili ng Handlebars kaysa EJS:
- Walang logic. Maaaring gawin ang mga template ng mga hindi developer.
- Ligtas bilang default. Ang `{{x}}` ay nag-HTML-escape; ang `{{{x}}}` ay opt-in raw.
- Ang kawalan ng arbitrary JS sa mga template ay nangangahulugan ng kawalan ng XSS audit surface kada template.

Nasa `hooks.js` ang logic kung saan ito explicit at maaaring i-review. Available na Handlebars helpers: `{{default}}`, `{{upper}}`, `{{lower}}`, `{{eq}}`, `{{markdown}}`, `{{asset ref}}`, `{{asset ref "property"}}` (kasama ang data-format helpers na `icsStamp`/`rfcText`/`csvCell` na ginagamit ng kapatid na `.ics`/`.vcf`/`.csv` na mga template).

### 10. Pinagsasama-sama ng mga tool ang mga tool

Maaaring mag-embed ang isang tool ng render ng **ibang** tool nang walang tool-to-tool imports - nire-resolve ang composition ng engine, hindi kailanman ng tool code. May dalawang surface:

- **Declarative manifest** - `composes: [{ id, tool, inputs, format?, width?, height? }]`. Nire-render ng engine ang napangalanang child at inilalagay ang resulta sa walang-logic na template bilang `{{asset <id>}}`. Sa ngayon, pinagsasama ng `event-name-badge` ang `qr-code` bilang SVG.
- **Portable embed URL** - `<img src="https://lolly.tools/tool/<id>.<ext>?<inputs>">`. Nire-render ng shell ang child na iyon **nang lokal** (may lumalabas na placeholder pixel hanggang ma-resolve ang lokal na render); walang kahit anong kinukuha mula sa `lolly.tools`.

Pinagsasama ang render ng kahit anong tool: nananatiling tunay na vector ang isang **SVG** na child kapag nag-export ang parent sa SVG o PDF at malinaw na nagra-rasterize para sa PNG; nag-e-embed ang mga **PNG/JPG/WEBP** na child bilang mga imahe. Nangangailangan ng `compose` capability. Ang mga composed na child ay mga intermediate - hindi kailanman nilalagyan ng watermark o provenance stamp - at gracefully na bumababa ang composition: ang isang shell na hindi kayang mag-render ng isang child ay basta na lang tatanggalin ang slot at magre-render pa rin ang parent.

---

## Ang sinadya naming hindi gawin

- **Walang EJS / walang arbitrary JS sa mga template.** Zero ang XSS surface. Nakatira ang logic sa `hooks.js`.
- **Walang sapilitang asset CMS.** Ini-ingest ng mga indibidwal ang sarili nilang creative files nang diretso sa kanilang catalogue sa loob ng app (ang [Catalogue](/info/using.html) view at ang Brand Studio) - walang server, walang admin console. Iniaabot ang trabaho bilang isang **session**: dala ng isang share link ang buong state, at ang parehong session ay naglalakbay sa isang backup o sa isang collab session. Maaari tuloy i-lock ng sinumang kumokontrol sa deployment ang isang shared session bilang isang **template** - buksan ang link, itala ang mga value nito bilang isang template entry sa directory ng tool na iyon sa brand pack at i-commit - pagkatapos noon ay lalabas ito sa "New from template" chooser ng tool at magiging deep-linkable bilang `?template=<id>`. Ang Git ang locking step ng may-ari ng deployment, hindi kailanman sa creator. Para sa isang catalog na *ibinabahagi, pinamamahalaan*, **maaaring** pamahalaan ng isang organisasyon ang asset directory sa parehong paraan at i-gate ang mga update sa pamamagitan ng PR review - isang available na governance model, hindi isang requirement ng app.
- **Walang sapilitang RBAC.** Public-access bilang default ang open app; pinamamahalaan ang brand risk sa pamamagitan ng maturity tags + watermarks. Ang isang organisasyong gustong mas mahigpit na kontrol ay maglalapat ng sarili nitong auth at ng git-reviewed na catalog sa itaas.
- **Walang sentral na database.** Per-device ang lahat ng user state. Nasa roadmap ang SUSE ID integration pero hindi ito blocker para sa launch.
- **Walang shared na tools/engine code path.** Open source ang engine at gayundin ang mga brand-agnostic na tool sa `community/`; ang isang brand pack tulad ng pribadong `brands/suse/` ay may dalang sariling mga tool at catalog sa ilalim ng sarili nitong mga tuntunin. Sa magkabilang paraan, ipinapatupad ang paghihiwalay (walang cross-imports mula sa `engine/` tungo sa tool content) para manatiling malinis ang split.

---

## Lifecycle, mula simula hanggang katapusan

Binubuksan ng isang user ang `lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H`:

1. **Boot.** Binubuksan ng web shell ang IndexedDB, binubuo ang capability bridge, sina-sync ang tool at asset catalogs (o naglo-load mula sa cache kapag offline).
2. **Route.** URL hash → `tool` view, na kinukuha ang `qr-code` at ang mga URL param.
3. **Load.** Kinukuha ng `loadTool('qr-code', fetchFile)` ang `tool.json`, vinavalidate ito laban sa JSON Schema, kinukuha ang `template.html`, `styles.css` at ang source ng `hooks.js`.
4. **Parse URL state.** Isinasalin ng `parseUrlState` ang mga URL param sa initial na input values. Ang mga asset ref (`?logo=suse/logo/primary`) ay pinapa-parse bilang lightweight na `{ id, _unresolved: true }` na mga object.
5. **Runtime.** Binubuo ng `createRuntime(tool, host, initialValues)` ang input model (pinagsasama ang profile data, defaults at initial values), rine-resolve ang mga asset ref sa pamamagitan ng `host.assets.get()`, nilo-load ang hooks (closure-scoped `host`, hindi sandboxed), tinatawag ang `hooks.onInit`.
6. **Render.** Nag-su-subscribe ang shell sa runtime; sa bawat pagbabago ng state, tinatanggap nito ang `{ model, hydrated }`. Nire-render nito ang mga input control mula sa model at isinusulat ang hydrated na template HTML papunta sa `#tool-canvas`.
7. **Interact.** Nagta-type ang user sa isang input → `runtime.setInput(id, value)` → inilalapat ang mga constraint → tinatawag ang `hooks.onInput` → re-hydrate → re-render. Nagu-update nang live ang canvas.
8. **Export.** Ini-click ng user ang Download(PNG) → `runtime.export(canvasNode, 'png')` → `host.export.render` (nagra-rasterize sa pamamagitan ng dom-to-image-more; dumadaan ang SVG/PDF sa dedicated na DOM-walking vectorisers) → blob → `host.export.download`. Malawak ang saklaw ng format na maaaring pumili ang isang tool, at ang `render.formats` enum sa `schemas/tool.schema.json` ang awtoridad dito - mga raster at float raster, mga vector at cut file, print/CMYK, motion, editable na dokumento (`pptx`, `docx`, `odt`), palette at data/text output, audio at font file. Pinapangalanan ng [URL Mode](/info/url-mode.html) ang bawat id at kung ano ang ginagawa nito. Nasa enum na iyon ang audio tulad ng iba (`wav`, `mp3`, `m4a`, `opus`, idinideklara ng audiogram at ng mga recording tool); hiwalay dito, dinadala ng `render.capture` mode ng isang recording tool ang `host.recorder`, kung saan dumarating ang take bilang isang natapos na Blob sa kahit anong container na nirekord ng browser. (Ang mga tool na nagtakda ng `render.export: false` - hal. Color Palette, Countdown Timer, Strip Hidden Data, Text Helper, Compress PDF - ay itinatago ang mga control ng download/format/dimension.) Kino-convert dito ang mga physical unit kada format (PDF → tunay na page points, raster → pixels sa DPI na may `pHYs` chunk). Ini-embed kada format ang authorship/provenance metadata (author, tool, source - binuo ng `engine/src/metadata.ts`): PNG iTXt, JPEG EXIF, PDF info dict, SVG `<metadata>`, GIF comment. Nilalagyan ng watermark ang mga experimental na tool na inilalagay ng host, hindi ng tool.

![Ang export panel na binubuksan ng `?options`: ang pares ng filename at format, ang laki ng output at ang mga control na sumusulat ng file](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Parehong lifecycle sa Tauri. Parehong lifecycle sa CLI - ang jsdom ang nagbibigay ng headless DOM; napupunta ang output sa isang file o stdout.

---

## Katayuan ng open source

**MPL-2.0 ang Code.** Ang `engine/`, `shells/*`, `services/*`, `schemas/` at `docs/` ay open source sa ilalim ng **MPL-2.0** - isang vendor-neutral na scaffolding platform para sa brand tooling, na may bawat shippable unit sa sarili nitong repository sa ilalim ng [github.com/lolly-tools](https://github.com/lolly-tools).

**Naipapadala ang tool content bilang mga brand pack**, bawat isa may sariling mga tuntunin (tingnan ang `NOTICE.md` ng pack). Ang `community/` ay ang pampublikong [`lolly-tools`](https://github.com/lolly-tools/lolly-tools) repository at MPL-2.0 din ang mga brand-agnostic na tool nito. Ang `brands/suse/` ay ang pribadong `suse-lolly` pack: ang mga tool ng SUSE at ang catalog ng SUSE, **pag-aari lamang ng SUSE**, kasama ang lisensyadong musika nitong PremiumBeat. Ang `brands/lolly-start/` ay ang blangkong starter brand na pag-aari ng repository na ito. Naipapadala ang mga font sa loob ng isang pack sa ilalim ng **SIL Open Font License 1.1** - dala ng SUSE pack ang mga typeface na SUSE at SUSE Mono.

Ang `tools/` at `catalog/` sa repo-root ay mga gitignored na *view*: binubuo sila ng isang profile mula sa `community/` kasama ang aktibong brand pack, kaya bawat script at shell ay bumabasa sa dalawang path na iyon at hindi kailanman diretso sa isang pack.

Ipinapatupad ang paghihiwalay - walang cross-imports mula sa `engine/` tungo sa tool content - kaya nananatiling malinis ang hangganan ng platform/content.

---

## Kung saan nagtatapos ang engine at nagsisimula ang host

Kung maaari mong ilarawan ito sa pure data + Handlebars → **engine**.
Kung dinadaanan nito ang DOM, filesystem, network o kahit anong browser/OS API → **host**.

Sinadya ang kalinawan ng linyang ito. Ang engine ang open-source na bahagi. Lahat ng may alam tungkol sa SUSE, tiyak na mga platform o runtime environment ay nananatiling wala rito.

Para sa susunod na antas ng detalye, itinatala ng [`engine/README.md`](../engine/README.md) ang bawat engine module at kung ano ang responsibilidad nito, at itinatala naman ng [Threat Model & Trust Boundaries](/info/threat-model.html) kung saan ang parehong linya ay nagsisilbi ring trust boundary.
