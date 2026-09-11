# Přehled

![Ikona Lolly - velký zelený a bílý lízátkový bonbon](/info/icon.svg)

Tento dokument zachycuje účel, strukturu a architektonická rozhodnutí platformy Lolly. Odráží jak produktovou vizi, tak aktuální stav kódové základny.

> **Stav:** Lolly je interní prototyp v **uzavřeném pilotu, který ještě neskončil**. Engine je deterministický a vnitřně konzistentní, ale produkt je raný - SUSE je zákazník číslo jedna - a jeho kryptografie a enginy pro parsování souborů právě procházejí přísným zpevňováním infrastruktury SUSE, přípravou na podnikové měřítko (v tomhle jsme fakt dobří). Čti architekturu níže jako designový záměr v testování, ne jako hotový, certifikovaný produkt. Viz [Přijetí a řízení](/info/adoption-governance.html#status), jak je pilot veden a měřen.

> **Jak číst tuto stránku.** Nese dva druhy materiálu, v tomto pořadí. První polovina je
> **proč tohle existuje**: problém, pozicování a životní cyklus, kterým prochází jeden asset. Od
> [Celkový obraz](#the-big-picture-how-the-layers-fit) dál je to
> **jak vrstvy do sebe zapadají**: architektonický dokument pro přispěvatele, pokrývající oddělení
> engine/shell/pack, uspořádání repozitáře, cílové platformy nasazení a závazky, které omezují
> každou změnu platformy. Pokud jsi tu proto, abys měnil kódovou základnu, ne abys pochopil produkt,
> začni u celkového obrazu.
>
> Dva doprovodné dokumenty jdou dál než tato stránka. [`engine/README.md`](../engine/README.md) v
> repozitáři je mapa enginu modul po modulu, s generovanou tabulkou každého modulu a toho, co
> parsuje nebo zapisuje. [Model hrozeb a hranice důvěry](/info/threat-model.html)
> je stejná architektura čtená jako hranice důvěry, a je to správná stránka pro jakoukoli otázku o
> tom, co engine považuje za nedůvěryhodné.

---

## Proč tohle existuje

Týmy narážejí na opakující se problém: opakovatelná kreativní a obsahová práce, která je příliš predikovatelná na to, aby ospravedlnila zapojení odborníků pokaždé znovu, ale příliš citlivá na kvalitu na to, aby se předala bez mantinelů. Výsledkem je buď pomalá propustnost (úzké hrdlo specialisty), nekonzistence (lidé používají, co zrovna mají po ruce) nebo uzamčení u dodavatele (SaaS DAM, který ovládá tvé šablony).

Tahle platforma je přímá odpověď:

> **Programová tvorba kreativy a obsahu ve velkém měřítku** - generování assetů bez lidské práce, s pravidly pod centrální kontrolou, pro zaměstnance, dodavatele a partnery.

Lolly není místo, kde design systém vzniká - je to místo, kde se vyrábí. Představ si to jako prodejní automat na design: vyber si, dostaneš výsledek. Pokaždé. Engine usiluje o nejvyšší kvalitu, jakou daný formát dokáže na hardwaru před tebou vyprodukovat, a stejný engine vytvoří stejný soubor na každé platformě, na kterou se dodává.

Výsledkem je **hojnost**: každá akce má správnou signage, každé upozornění na CVE odpovídá firemnímu stylu, každý štítek se vytiskne čistě, každý e-mailový podpis je aktuální - to vše bez designového ticketu. Platforma zvládá opakující se operacionalizovanou kreativu. Záměrně to není nástroj pro zakázkovou kreativu - vlajkovou práci si stále vlastní designéři.

### Inovuj pravděpodobnostně, škáluj deterministicky

Každá debata o AI v kreativním procesu uvízne na stejné otázce: která část je práce stroje? Je to stará otázka s dávno danou odpovědí. Písaři a iluminátoři už pracovali mezi dvěma nástroji - volnou skicou, kde nic nebylo pevně dané a všechno se dalo zkoušet, a tiskařským lisem, děsivým právě proto, že se zavazoval. Skici byly tam, kde vznikalo umění. Lis byl způsob, jak se dostat ke komukoli. Nikdo ty dva nezaměňoval a oba se dál vyvíjely - nové inkousty, nová písma, nové lisy - každý se zdokonaloval v souladu s řemeslem a záměrem, kterému sloužil.

Lolly vede stejnou hranici. Zkoumej pravděpodobnostně: model, designér, hrubý nápad, prompt, který se vydá tam, kam nikdo neplánoval. Pak škáluj deterministicky - to, co se dostane k deseti tisícům výstupů, je *nástroj*, a nástroj se vykresluje pokaždé stejně ze vstupů, které si můžeš přečíst. Zkoumání zůstává svobodné, protože na tom, aby dopadlo pokaždé stejně, nic dalšího nezávisí. Výstup si získává důvěru, protože není odhadem. Dostat AI experimentování do předvídatelných, reprodukovatelných výsledků není nová disciplína; je to stejná dělba práce, díky které stálo za to důvěřovat tištěné práci už od začátku.

> Důvěřuj kreativnímu procesu, škáluj s rigorózností.

### Oproti alternativám

::: figure positioning-comparison
Úplnost schopností napříč dnešními kreativními nástroji, zkoumáno v srpnu 2026. Hodnocení: 0 chybí, 25 úroveň obcházení, 50 reálné, ale omezené nebo částečné, 75 silné s výhradami, 100 klíčová kompetence.
:::

Mezera je jasná: nic, co se dnes dodává, nedává omezení-na-prvním-místě, offline schopnost, nízkou náročnost na dovednosti a interně dostupný výstup. Lolly dokonce obsahuje otevřené plátno - **Design** - kde barvy, typografie a assety odpovídají globálním brand hodnotám, takže volné uspořádání zůstává omezení-na-prvním-místě. Co to **není**, je neomezená designová sada: designéři nadále používají Illustrator a Figma pro zakázkovou vlajkovou práci. Permutace lze sestavit tímto nástrojem.

![Každý nástroj v knihovně jako karta, seskupené podle kategorie, aby si producent jeden vybral a začal](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=aud-gallery-landscape)

**Použij ho pro:** Rychlou tvorbu operacionalizovaných kreativních assetů - dlaždice na akce, jmenovky, podpisy, CVE upozornění, QR kódy, sociální karty, štítky na zásilky, strukturované reporty.

**Nepoužívej ho pro:** Zakázkový hero obsah.

---

## Životní cyklus kampaně

Nejjasnější způsob, jak vidět, co Lolly je, není seznam funkcí - je to sledovat jeden asset, jak putuje z ruky do ruky. Sleduj jednu lokalizovanou kartu kampaně, jak prochází organizací:

1. **Kreativec nastaví pravidla.** Designér vytvoří základní šablonu v nástroji Design, natvrdo zakóduje typografii a barevné proměnné brandu. Nedělá jednu kartu - dělá zásadní práci *jednou*, aby ji už nikdy nemusel ručně lokalizovat znovu.
2. **Vývojář ji škáluje.** Tatáž šablona je zapojená do nočního pipeline přes CLI, takže nový graf nebo nová jazyková varianta vzniká automaticky - žádný designér soubor znovu neotevírá.
3. **Producent ji prostě používá.** Obchodní zástupce, offline v letadle, otevře stejný nástroj a vygeneruje dokonale on-brand prezentaci pro schůzku s klientem. Žádná designová dovednost, žádná síť, žádné čekání.

"Nový graf" ve druhém kroku je render jako tento, vytvořený z datového řetězce a hrstky parametrů, aniž by kdokoli otevřel designový soubor:

![Skládaný plošný graf s titulkem, jehož tři řady jsou v chladné paletě, s osami, legendou a titulkem rozmístěnými šablonou, a ne ručně](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Smysl není v tom, že Lolly je dobrá pro designéry *a* dobrá pro vývojáře *a* dobrá pro obchod, každého zvlášť ve vakuu. Je to **štafeta**: počáteční práci kreativce škáluje vývojář, což zase posiluje producenta. Bezproblémový zážitek pro netechnického zástupce v letadle je vůbec *možný* jen díky rigoróznosti, kterou nastavil designér a nasadil vývojář.

To je ten násobitel síly. Lolly není zásuvka samostatných nástrojů pro samostatné role - je to jeden deterministický životní cyklus assetu, kterého se dotkne každá role, a s každou rukou, kterou projde, se násobí hodnota té předchozí.

---

## Jedno schválení, deset tisíc assetů

Protože schválení žije v nástroji, ne v souboru (viz [Jak si Lolly stojí ve srovnání](/info/positioning.html)), škálování přestává být problém revizí. Schval lokalizovaný nástroj na sociální karty jednou, pak vygeneruj **10 000 assetů ve 12 jazycích** z tabulky - a ani jeden z nich nepotřebuje novou kontrolu shody od právního nebo brand oddělení, protože šablona, ze které všechny vznikly, už byla schválená.

Stejný deterministický nástroj dosahuje toho škálování třemi způsoby, všechny produkují identický, předem schválený výstup:

- <!--i:people--> **Člověk, v aplikaci.** Dávková mřížka `/pro`: vlož nebo importuj řádky, dostaneš jeden hotový asset na řádek, stáhni zip. Žádná designová dovednost, žádný tiket, žádné čekání.
- <!--i:code--> **Vývojář, z příkazové řádky.** CLI spouští *stejný* engine a *stejnou* renderovací cestu bez hlavičky, takže nástroj lze provést sekvenčně přes všech 10 000 řádků ve skriptu nebo nočním pipeline. Volání `lolly <tool> --field=…` ve smyčce je celá integrace.
- <!--i:cpu--> **Systém nebo AI agent, přes MCP.** Stejný nástroj ovládaný programaticky, se stejnou věrností a ještě větším měřítkem - protože stroj se nenudí, zatímco přicházejí tisíce souborů.

![Dávkový režim při čerstvé instalaci: jeden prázdný řádek čekající na nástroj, s celou plochou tabulky a tlačítkem Render už na místě, než dorazí jakákoli data](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

Jedna sada brand omezení, jednou pevně stanovená designérem; tři cesty ke stejnému předem schválenému výstupu - a strojová cesta škáluje nejdál ze všech, protože se nikdy neunaví, zatímco soubory přicházejí.

---

## Celkový obraz: jak zapadají vrstvy

Všechno odtud dál je architektura. Diagram je celý systém v jednom pohledu: nástroje jsou
data nahoře, engine uprostřed neví nic o žádné platformě, shelly pod ním
implementují jednu smlouvu a katalogy dodávají obsah.

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

### Struktura repozitáře

Obsah je připojen jako balíčky: `community/`, `docs/`, každý `shells/*`, oba `services/*` i `brands/suse` jsou každý svým vlastním repozitářem, checkoutnutým jako git submoduly tohoto. Rodič vlastní `engine/`, `schemas/`, `scripts/`, `tests/`, `api/`, `brands/lolly-start/` a `profiles.json`. Viz [Průvodce sestavením » Získání zdrojového kódu](/info/build-guide.html) pro příkaz checkoutu a workflow napříč repozitáři.

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

## Model doručování platformy

Platforma běží napříč několika povrchy - webová PWA, desktopová/mobilní Tauri aplikace, skriptovatelné CLI a interaktivní TUI. Všechny používají stejný engine a stejné soubory nástrojů.

### Web (PWA) - primární distribuce
Hostováno na URL spravované SUSE. Funguje offline, jakmile service worker nacachuje nástroje a assety. Tady bude platformu používat většina zaměstnanců, dodavatelů a partnerů. Účet není potřeba - stav se ukládá do IndexedDB na jednotlivém zařízení.

Webový shell je responzivní z jednoho layoutu. Na desktopu je nástroj měnitelný sidebar s ovládáním vedle náhledové plochy s trackpadovou navigací plátna (Cmd/Ctrl-kolečko nebo sevření pro přiblížení kolem kurzoru, mezerník nebo tažení prostředním tlačítkem pro posun, klávesy `0`/`1`/`+`/`−` a HUD Fit/%). Na mobilu (≤640px) se ovládání stává listem ukotveným nahoře s úchytem pro tažení, který zaklapne do peek/half/full (ťuknutí přepíná) nad statickým celoobrazovkovým náhledem, a plovoucí tlačítko **Render** otevírá ovládání **Export** ve vyskakovacím listu zdola. Dotyk získává sevření-přiblížení a tažení-posun na náhledu. Renderovací cesta a ovládání exportu jsou identické na obou - přeuspořádá se jen chrome.

![Desktopové rozdělené zobrazení - ovládání generované z manifestu vlevo, živé plátno vpravo](/t/url-shot?url=%2F%23%2Ftool%2Fchart-creator&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=aud-web-split)

Stejný nástroj na šířku telefonu, bez druhého layoutu k udržování: ovládání se stává listem nahoře, náhled zabírá celou obrazovku a pilulka renderu se nad ním vznáší.

![Audiogram na obrazovce o šířce 430 px - list ovládacích prvků nahoře, hotová čtvercová grafika dole a plovoucí pilulka renderování](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

**Dávkový režim (`/pro`).** Webový shell dodává i dávkovou mřížku ve stylu tabulky (`shells/web/src/pro/`), která vykresluje mnoho řádků najednou napříč jedním nebo více nástroji. Zvládá roundtrip CSV/TSV plus vkládání z tabulek, šablonu/formát/velikost/jednotku/dpi na řádek, boční panel editoru bloků s živým náhledem, sbalitelné exportní sloupce, lištu tagů "relevance" na řádek, přeuspořádání řádků tažením za levý úchyt, dvoukrokové potvrzení smazání, uložené dávkové relace a stažení `.zip`. Toto je povrch jeden-k-mnoha za pozicováním "hromadné generování obsahu".

### Tauri desktop / mobil
Zabalená nativní aplikace (malá stopa díky Tauri). Poskytuje plnou offline dostupnost, přístup k souborovému systému pro nástroje závislé na CLI (PDF Smasher, Font Outliner) a přístup ke kameře. Naplánováno na vylepšení nástrojů v polovině roku 2026.

### CLI
`lolly <tool-id> [--input=value ...] --output=file.png`

Uživatelé desktopu mohou vyvolat mnoho nástrojů z terminálu. CLI shell nahraje stejný engine, vytvoří jsdom DOM, spustí stejnou renderovací cestu a zapíše soubor. URL režim je transport - CLI není samostatná implementace. Tím je zaručeno, že výstupy CLI a GUI jsou identické.

```bash
lolly qr-code --url=https://suse.com --output=qr.svg
lolly quotes --quote="Ship it." --output=quote.png
lolly                        # lists available tools
lolly qr-code                # lists inputs for that tool
```

### TUI
`npm run tui`

Interaktivní protějšek CLI: celoobrazovková, na klávesnici založená terminálová aplikace (postavená na Ink) pro procházení nástrojů, vyplňování vstupů, ukládání projektů a export - to vše bez GUI. Její bridge k hostiteli **znovu používá implementaci CLI** pro formáty bez DOM (SVG/EMF/EPS/HTML + text/data) a přidává stav na disku pod `~/.lolly` plus volitelný inline náhled. Kromě toho má **vrstvu prohlížečového renderu**: omezený headless Chromium (stejný, jaký instaluje MCP server), který na vyžádání vytváří rastr/PDF/video a zachytávání živých URL - řídí sestavenou kopii webového shellu, takže je výstup identický, a spouští se jen při prvním exportu takového formátu. Takže `url-shot` (s ořezem + přebarvením + vektorovým PDF/SVG) a každý rastrový/pdf nástroj běží i v terminálu. Viz [průvodce TUI](/info/tui.html).

Ať jsi na jakémkoli povrchu, záložka Capabilities v dashboardu je úplná mapa toho, co platforma deklaruje, že umí, seskupené a čitelné, aniž bys otevřel jediný nástroj.

---

## Kategorie nástrojů

Nástroje jsou ve svém manifestu označeny `category` pro seskupení v galerii.

Řádky jsou vypsány v pořadí sekcí galerie. Sekce `utility` se v galerii vždy vykresluje **jako poslední** (po všech ostatních kategoriích, včetně budoucích) - jde o zásuvku „Offline nástroje“ přímo v zařízení.

| Kategorie | Příklady | Plánováno |
|---|---|---|
| `everyone` | QR Code Generator, Quote Card, Email Signature, Logo, Wordmark, Audiogram, Battlecards, Sequence Studio, Record | Employee Image Stationery |
| `designer` | Brand Lockup, Design, Chart, Darkroom, Filter, Pose Geeko, Multi-Page PDF | Font Outliner |
| `event` | Meeting Planner, Event Name Badge, Wayfinding Signage, Calendar ICS, Booth Studio | Event Stationery, Bulk Name Badges, Room Agenda Cards |
| `product` | - | CVE Alert, Product Release Announcement, Blog OG Image |
| `utility` | Strip Hidden Data, Text Helper, Compress PDF, Convert Image, Convert Font, Redact, Run Web Code, Screen Capture, URL Screenshot | Převodníky jednotek/formátů, další nástroje pro soukromí fungující na zařízení |

Tyto buňky jsou **příklady, ne úplný výčet**. Které nástroje existují, je vlastnost namontovaného profilu, ne této stránky: brand pack přidává vlastní nástroje a může vyloučit komunitní nástroj, který dodávat nechce. `catalog/tools/index.json` - generovaný z manifestů, a registr, který galerie skutečně čte - je autoritativní seznam; chceš-li spočítat, co profil namontuje, spočítej manifesty (`ls community/*/tool.json brands/*/tools/*/tool.json`), místo abys věřil číslu zapsanému zde. (Id nástroje přítomné ve dvou packech se namontuje jednou, z vítězného packu.)

Nástroje jsou také klasifikovány podle stavu: `official` (schváleno brandem, bez vodoznaku), `community` (externí příspěvek), `experimental` (exporty s vodoznakem). Většina knihovny je `official`; novější studia a nástroje pro záznam bývají spíš `community` nebo `experimental`, dokud se neustálí. Každá plocha zobrazuje odznak, takže čtenář ví, co si bere, ještě než to otevře - a stejně jako buňky kategorií výše se i příslušnost ke stavu mění příliš rychle na to, aby se dala vypsat zde. Přečti si to z galerie nebo z generovaného indexu.

**Design** je první nástroj postavený na režimu volného plátna `render.layout: "editor"` - plocha bez chromu s přímou manipulací, kde přetahuješ, měníš velikost, otáčíš a přichytáváš boxy textu, tvarů a obrázků a pak exportuješ stejnou renderovací cestou jako každý jiný nástroj.

**Strip Hidden Data** je první **nástroj na zařízení** (`privacy: "on-device"`): nástroj transformující obsah, který vezme soubor dodaný *tebou*, celý ho zpracuje v prohlížeči a vrátí čistou kopii - nikdy se nikam nenahrává, nikdy se neopatří vodoznakem, nerazí se do něj žádná provenience. **Text Helper** je druhý - pracovní stůl na zařízení pro každodenní úlohy typu vlož-do-webu (formátování JSON, dekódování JWT, Base64, kódování/dekódování URL, hashování SHA). **Compress PDF** je třetí - zmenšuje PDF rekompresí jeho obrázků, opět celé na zařízení. Značka a text jejího odznaku „Runs on your device - nothing is uploaded“ nyní pokrývají celou sadu transformací: Strip Hidden Data, Text Helper, Compress PDF, **Convert Image** (HEIC/TIFF/AVIF → WebP/JPG/PNG), **Convert Font**, **Redact** (zničit oblasti obrázku, SVG nebo PDF), **Prompt to Image** a **Rebrand a Deck** (přeznačkovat `.pptx` na místě), pokud ho profil namontuje. Jde o kategorii nástrojů pro soukromí, která nahrazuje předávání důvěrných souborů jednoúčelovým webům.

![Zásuvka Utilities, kde je každá karta nástroj transformující soubor, který už máš](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=aud-utilities)

> Poznámka: `category` a `status` jsou denormalizovány do `catalog/tools/index.json` (registru, který galerie čte) z jednotlivých `tool.json`. Manifest je zdroj pravdy - index je **generovaný** příkazem `npm run build:catalog` a `npm run validate:catalog` shodí CI, pokud committovaný index odchyluje od manifestů.

---

## Architektonické závazky

Tato rozhodnutí jsou pevně daná. Změna kteréhokoli z nich je zásadní podnik - utvářejí každé další rozhodnutí v kódové bázi.

### 1. Deklarativní nástroje s imperativní únikovou cestou

Nástroj je manifest (`tool.json`) + šablona (`template.html`) + volitelný `hooks.js`.

**Vstupy deklaruje manifest.** Ne šablona. Vstupy se neodvozují z tokenů Handlebars. Manifest je smlouva; šablona spotřebovává pojmenované proměnné přes `{{id}}`.

![Ovládací sada Street Map - rozbalovací nabídka měst, výběr motivu, posuvníky tloušťky a barevné spouštěče, každý z nich odvozen z řádku manifestu](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

**Hooky jsou volitelné.** Většina nástrojů je čistě deklarativní - manifest + šablona stačí. Nástroje potřebující počítané hodnoty (kódování QR, tvarování dat grafu) poskytují `hooks.js`, který vystavuje pojmenované životní funkce (`onInit`, `onInput`, `onFrame` - hook pro živý obraz z kamery po jednotlivých snímcích pro nástroje reagující na pohyb - `onLevel`, `beforeExport`, `afterExport`, `exportFile` - transformační cesta soubor-dovnitř/soubor-ven, kterou používají nástroje na zařízení jako Strip Hidden Data - a `exportStill` pro nástroj, který si spravuje vlastní hloubkový rastr). Host načítá hooky přes `new Function('host', …)` s vloženým bridge schopností do closure scope. Toto je **smlouva o přenositelnosti, ne bezpečnostní sandbox**: hooky stále běží v realmu stránky a v prohlížečovém shellu se *mohou* dostat k `window`/`fetch`/`document` - `host.*` je podporovaná, přenositelná plocha, ne vynucená hranice. Asynchronní výsledky hooků mají časový limit (`onInit` 5 s, `onInput` 2 s, `beforeExport`/`afterExport` 5 s, `exportFile`/`exportStill` 10 s) a pozdní výsledky se zahazují; utíkající *synchronní* hook nelze přerušit. Nedůvěryhodný kód hooků třetích stran proto není bezpečné spouštět, dokud nepřijde izolace ve Workeru.

Na tom záleží, protože: deklarativní nástroje mohou vytvářet i lidé bez vývojářských dovedností. Kdyby byl každý nástroj webovou aplikací, poznámka o riziku „omezené dovednosti na vytváření/údržbu pracovních šablon“ se stává trvalým hrdlem lahve.

### 2. Nástroje a assety jsou data, ne zabalený kód

Webová a Tauri aplikace načítají katalogy nástrojů a assetů ze známé URL při startu, ukládají je lokálně do cache a pracují s tím, co tam je. **Přidání nové dlaždice pro událost nebo sezónního assetu nevyžaduje vydání aplikace.**

Bajty assetu mají kontrolní součet SHA-256, aby se zabránilo otrávení CDN. `id` + `version` assetu řídí invalidaci cache.

### 3. Capability Bridge je jediné API, které nástroje vidí

Nástroje se nikdy nedotýkají DOM mimo oblast své šablony, nikdy nevolají `fetch` přímo, nikdy nečtou souborový systém. Volají verzované metody `host.*`. Kanonická definice smlouvy je `packages/core/src/host-v1.ts` - SDK pro autory nástrojů `@lolly-tools/core`, takže třetí strana může stavět proti němu bez závislosti na enginu; `engine/src/bridge/host-v1.ts` je jeho typový re-export a kód enginu/shellu z té cesty importuje beze změny:

| Bridge API | Co dělá |
|---|---|
| `host.profile` | Uživatelovo křestní jméno, e-mail, portrét, město atd. Předvyplňuje vstupy přes `bindToProfile`. |
| `host.assets` | Dotazy do katalogu, resoluce assetů, hostem poskytnuté UI pro výběr. |
| `host.state` | Ukládání / načítání slotů vstupů. IndexedDB na webu, souborový systém na Tauri, paměť na CLI. |
| `host.clipboard` | Zápis textu nebo obrázku do schránky (s náhradními variantami podle platformy). |
| `host.export` | Rasterizuje nebo serializuje cíl vykreslení. Aplikuje vodoznak u experimentálních nástrojů. |
| `host.net` | Fetch se seznamem povolených adres - dostupný jen pokud nástroj deklaroval schopnost `"network"`. (Žádný nasazený nástroj to aktuálně nepoužívá.) |

Volitelné, přídavné plochy se objeví jen tehdy, když je shell poskytne. Některé jsou **řízené schopností** - vystavené jen když nástroj deklaruje odpovídající příznak: `host.compose` (vložit vykreslení jiného nástroje - `compose`), `host.capture` (zachycení stránky pro URL Screenshot - `capture`) a `host.recorder` (záznam z mikrofonu/kamery/obrazovky pro nahrávací nástroje - `microphone` / `camera` / `screen`). Zbytek je **zjišťovaný podle funkce** - přítomný kdykoli ho shell dokáže poskytnout, přičemž nástroj si drží záložní řešení pro shelly, které nemohou.

Několik hlavních ploch pro ilustraci, co to pokrývá - [Host API](/info/host-api.html) dokumentuje každou z nich a `packages/core/src/host-v1.ts` je samotná smlouva:

| Rozhraní | Od verze | Co přidává |
|---|---|---|
| `host.tokens` | 1.0 | Designové tokeny DTCG - vlastní primitiva značky |
| `host.text` | 1.0 | Převod textu na cestu přes HarfBuzz WASM (schopnostní flag `wasm` označuje nástroje, které na tom závisí) |
| `host.media` | 1.4 | Živé snímky z kamery pohánějící hook `onFrame`. Postupné vylepšení, záměrně *ne* podmíněné flagem `camera` - takový nástroj dál funguje jako obyčejný nástroj pro statické obrázky |
| `host.color` | 1.40 | Percepční matematika barev: ΔEOK, kontrast WCAG + APCA, rampy OKLab, dělení do tříd, kategorické palety, harmonická schémata (1.60), míchání CSS Color 4 a pečení gradientů (1.68). Čisté a synchronní - shelly připojují `makeColorApi()` jádra místo toho, aby cokoli implementovaly, takže to nemůže rozjet |
| `host.images` | 1.60 | Dekódování / změna velikosti / překódování bajtů na zařízení - cesta konverze (HEIC → JPEG, komprese do WebP, zmenšení). Dodáváno ve webovém shellu jako líný fasádový modul, takže se dekodér HEIC nikdy nedostane do startovacího balíčku |
| `host.geom` | 1.64 | Přesná vektorová geometrie: booleovské operace nad cestami, offsetování, převod obrysu na výplň, snížení splajnů, zjednodušení, testování zásahů. Také čisté, synchronní a připojené z jádra (`makeGeomApi()`); chyby se *vracejí*, nikdy se nevyhazují |

Zbytek se řídí stejnými pravidly a je zdokumentován vedle nich: `pdf` (1.8) a `pptx` (1.58) pro chirurgii dokumentů na zařízení, `audio` (1.71) a `speech` (1.96) pro analýzu klipů a TTS/přepis na zařízení, `viz` (1.72) pro zástupnou smlouvu MilkDrop, `codec` (1.100) a `layers` (1.102) pro hloubkově-bitový a vrstvený bitmapový výstup, `upscale` (1.101) a `matte` (1.103) pro modely na zařízení, `raster` (1.105) pro hooky dělající vlastní pixelovou práci, `connectors` (1.106) pro exportu-bezpečné šipky a `c2pa` (1.85) pro podepisování hotových bajtů. Počet roste; pravidla ne.

Deklarovatelné schopnosti jsou: `network`, `filesystem`, `clipboard`, `camera`, `microphone`, `screen`, `ffmpeg`, `wasm`, `capture`, `compose`. (`screen`, přidané v 1.54, je záznam obrazovky přes `host.recorder` - uživatel vybere obrazovku/okno/kartu v nativním UI prohlížeče; liší se od `capture`, které rasterizuje URL, kterou si nástroj sám pojmenuje.)

Stejný nástroj běží v prohlížeči, Tauri i bezhlavém CLI, protože každý shell implementuje toto rozhraní - nástroj nikdy neví, ve kterém z nich je.

Bridge je verzovaný. Přidání metod je vedlejší (minor) verze. Odebrání nebo změna signatur je hlavní (major) navýšení verze. Až vyjde v2, v1 musí dál fungovat.

### 4. ID assetů jsou navždy

`suse/logo/primary` je smlouva. Jakmile je publikováno:
- ID se nikdy nemění, nikdy se znovu nepoužije.
- Změna bajtů → zvyš `version` v manifestu.
- Nahrazeno novým assetem → nastav `deprecated: true` a volitelně `replacedBy`.
- Existující odkazy se vždy vyřeší.

Díky tomu jsou uložené stavy nástrojů a přes URL sdílené odkazy trvanlivé napříč lety.

### 5. Režim URL je prvotřídní

Každý vstup musí být vyjádřitelný jako parametr URL:

```
lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H
```

![Tenhle odkaz sám o sobě, bez ničeho dalšího, je hotový asset](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fsuse.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Režim CLI je režim URL pod jiným přenosem - CLI shell sestaví objekt stavu URL z argv a spustí **stejný** pipeline enginu. Existuje jedna renderovací cesta. CLI se nemůže odchýlit od GUI, protože není samostatná implementace.

`url-mode.ts` obstarává obousměrný převod (parsování a serializaci). Sada **rezervovaných parametrů** se nástroji nikdy nepředává jako vstupy: ovládací prvky výstupu (`format`, `export`, `copy`, `filename`, `width`/`w`, `height`/`h`, `unit`, `dpi`), voliče tisku a provenience (`bleed`, `marks`, `profile`, `password`, `c2pa`, `imprint`, `durable`, `meta`, `hdr`, `depth`, `cuts`) a nosiče stavu (`template`, `z` - zabalený token „Nejkratší odkaz“ - a `zx`, totéž zašifrované heslem). Sada `RESERVED` v `engine/src/url-mode.ts` je autorita a je zapíchnutá testem; [URL Mode](/info/url-mode.html) dokumentuje každou z nich, včetně několika málo, které tu vypsané nejsou. Vstupy assetů v režimu URL jsou serializovány přes své `id`; runtime je před hydratací vyřeší přes `host.assets.get()`. `width`/`height` jsou hodnoty v `unit` (výchozí `px`, také `mm`/`cm`/`in`/`pt`/`pc`); u fyzické jednotky nastavuje `dpi` rastrové rozlišení. Nastavují velikost dokumentu plátna a předvyplňují panel rozměrů exportu.

Protože každý vstup cestuje v odkazu, změna parametru je jiný hotový asset. Celá tato paleta je jedna výchozí barva, harmonie a počet kroků:

![Devět kroků napříč čtyřmi odstíny, všechny vzešlé z jediné výchozí barvy neseené v odkazu](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

### 6. Ukládání jde přes bridge, ne přímo

Web shell: IndexedDB. Tauri: souborový systém. CLI: v paměti. Nástroje vidí pouze `host.state.save(slot, data)` a `host.state.load(slot)`. `localStorage` se nepoužívá - je příliš malý a neumí uchovat blob.

Uživatelé si mohou uložit více pojmenovaných edit slotů na nástroj a vrátit se ke každé relaci později. Vytváření účtu není potřeba, stav je per-device. Protože bridge je jediný švík, tento per-device stav je zároveň *přenositelný*: `shells/web/src/data-transfer.ts` čte vše zpět přes `host.profile`/`host.state`/`host.assets` do jednoho `lolly-backup` zipu, který se dá naimportovat na jakékoli jiné instalaci - offline odpověď na "přesun na nové zařízení", která nepotřebuje server (celá specifikace: `docs/data-transfer.md`). Integrace SUSE ID (synchronizace napříč zařízeními) je budoucí milník nad tímto základem.

### 7. Značky zralosti řeší riziko "schváleno značkou" už v návrhu

Každý nástroj deklaruje `status: official | community | experimental` ve svém manifestu. Galerie řadí podle statusu. Experimentální nástroje automaticky vodoznakují své exporty - vodoznak vkládá `host.export.render`, ne nástroj sám, takže ho autor neoficiálního nástroje nemůže vypnout.

Toto je strukturální odpověď na riziko vnímání, že použití jakéhokoli nástroje znamená schválení značkou. Procesní odpovědi (schvalovací fronta, gating přes SUSE ID) se vrství navrch.

### 8. Vstupy nástrojů jsou typované přes manifest, včetně assetů

Vstupy deklarují `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` a `file`. Host vykresluje obecný ovládací prvek pro každý typ z manifestu - nástroje nepíšou žádný kód pro ovládací prvky. (Předvyplnění z uživatelského profilu není typ - `bindToProfile` může nést jakýkoli vstup.) Tři z nich mají větší váhu než ostatní:

- **`asset`** (s `filter` a `allowUpload`) je most k systému globálních assetů; `allowUpload: false` je páka pro vynucení značky u věcí jako loga sponzorských dlaždic, kde jsou povoleny jen assety z knihovny. Uživatelské nahrávky používají stejný tvar `AssetRef` jako assety z knihovny, takže je nástroje zpracovávají shodně.
- **`blocks`** je opakující se skupina polí - mini-tabulka uvnitř jednoho vstupu, editovaná v bočním panelu, s typovanou/rozlišenou nabídkou přidávání a poli assetů na blok. Kliknutím na vykreslený blok na plátně se zaměří odpovídající řádek bloku. Používají ho `meeting-planner`, `chart-creator`, `event-name-badge`, `wayfinding-signage`, `color-block` a `digi-ad`.
- **`vector`** seskupuje pevnou sadu čísel (např. transformaci) do jednoho složeného ovládacího prvku; **`file`** drží uživatelův vlastní soubor jako bajty v paměti pro on-device transformační nástroje (např. `strip-data` a `compress-pdf`).

### 9. Šablony jsou bez logiky (Handlebars, ne EJS)

Handlebars byl vybrán oproti EJS záměrně:
- Bez logiky. Šablony mohou autorsky vytvářet i lidé bez vývojářského zázemí.
- Bezpečné ve výchozím stavu. `{{x}}` escapuje HTML; `{{{x}}}` je volitelné surové vykreslení.
- Žádný libovolný JS v šablonách znamená žádnou plochu pro audit XSS na každou šablonu zvlášť.

Logika žije v `hooks.js`, kde je explicitní a přezkoumatelná. Dostupné pomocné funkce Handlebars: `{{default}}`, `{{upper}}`, `{{lower}}`, `{{eq}}`, `{{markdown}}`, `{{asset ref}}`, `{{asset ref "property"}}` (plus pomocné funkce pro datové formáty `icsStamp`/`rfcText`/`csvCell` používané sesterskými šablonami `.ics`/`.vcf`/`.csv`).

### 10. Nástroje skládají nástroje

Nástroj může vložit vykreslení **jiného** nástroje bez importů mezi nástroji navzájem - skládání řeší engine, nikdy kód nástroje. Existují dvě plochy:

- **Deklarativní manifest** - `composes: [{ id, tool, inputs, format?, width?, height? }]`. Engine vykreslí pojmenovaného potomka a umístí výsledek do bezlogické šablony jako `{{asset <id>}}`. `event-name-badge` dnes skládá `qr-code` jako SVG.
- **Přenositelná embed URL** - `<img src="https://lolly.tools/tool/<id>.<ext>?<inputs>">`. Shell vykreslí tohoto potomka **lokálně** (zástupný pixel se zobrazí, dokud se lokální vykreslení nedokončí); z `lolly.tools` se nikdy nic nestahuje.

Skládat lze vykreslení jakéhokoli nástroje: potomek **SVG** zůstane skutečným vektorem, když rodič exportuje do SVG nebo PDF, a ostře se rasterizuje pro PNG; potomci **PNG/JPG/WEBP** se vkládají jako obrázky. Vyžaduje schopnost `compose`. Skládaní potomci jsou mezistupně - nikdy nejsou vodoznakováni ani opatřeni razítkem původu - a skládání elegantně degraduje: shell, který potomka neumí vykreslit, slot prostě vynechá a rodič se přesto vykreslí.

---

## Co jsme se záměrně rozhodli nedělat

- **Žádné EJS / žádné libovolné JS v šablonách.** Plocha pro XSS je nulová. Logika žije v `hooks.js`.
- **Žádný povinný asset CMS.** Jednotlivci nahrávají vlastní kreativní soubory přímo do svého katalogu v aplikaci (zobrazení [Catalogue](/info/using.html) a Brand Studio) - žádný server, žádná administrátorská konzole. Práce se předává dál jako **relace**: sdílený odkaz nese celý stav a stejná relace putuje v záloze nebo přes kolaborativní relaci. Ten, kdo řídí nasazení, pak může sdílenou relaci uzamknout jako **šablonu** - otevři odkaz, zaznamenej její hodnoty jako položku šablony v adresáři daného nástroje v brand packu a commitni - poté se objeví ve výběru nástroje "New from template" a lze na ni odkazovat přímo jako `?template=<id>`. Git je zamykacím krokem vlastníka nasazení, nikdy tvůrce. Pro *sdílený, řízený* katalog může organizace **stejným způsobem** spravovat adresář assetů a podmínit aktualizace revizí PR - dostupný model správy, ne požadavek aplikace.
- **Žádné vynucené RBAC.** Otevřená aplikace je ve výchozím stavu veřejně přístupná; riziko pro značku se řídí pomocí štítků zralosti + vodoznaků. Organizace, která chce přísnější kontrolu, si navrství vlastní autentizaci a výše popsaný katalog s revizí přes git.
- **Žádná centrální databáze.** Veškerý stav uživatele je vázaný na dané zařízení. Integrace SUSE ID je na roadmapě, ale není blokátorem spuštění.
- **Žádná sdílená cesta kódu nástrojů/enginu.** Engine je open source a stejně tak i nástroje nezávislé na značce v `community/`; brand pack jako privátní `brands/suse/` nese vlastní nástroje a katalog za vlastních podmínek. Tak či onak je oddělení vynuceno (žádné cross-importy z `engine/` do obsahu nástrojů), takže dělení zůstává čisté.

---

## Životní cyklus, od začátku do konce

Uživatel otevře `lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H`:

1. **Boot.** Web shell otevře IndexedDB, sestaví bridge schopností, synchronizuje katalogy nástrojů a assetů (nebo je offline načte z cache).
2. **Route.** URL hash → pohled `tool`, s extrahovanými parametry `qr-code` a URL.
3. **Load.** `loadTool('qr-code', fetchFile)` stáhne `tool.json`, validuje ho proti JSON Schema, stáhne `template.html`, `styles.css` a zdroj `hooks.js`.
4. **Parse URL state.** `parseUrlState` převádí parametry URL na počáteční hodnoty vstupů. Odkazy na assety (`?logo=suse/logo/primary`) se parsují jako odlehčené objekty `{ id, _unresolved: true }`.
5. **Runtime.** `createRuntime(tool, host, initialValues)` sestaví model vstupů (sloučí data profilu, výchozí hodnoty a počáteční hodnoty), rozřeší odkazy na assety přes `host.assets.get()`, načte hooky (`host` v uzávěru, ne v sandboxu), zavolá `hooks.onInit`.
6. **Render.** Shell se odebírá na runtime; při každé změně stavu dostane `{ model, hydrated }`. Vykreslí ovládací prvky vstupů z modelu a zapíše hydratovaný HTML šablony do `#tool-canvas`.
7. **Interact.** Uživatel napíše do vstupu → `runtime.setInput(id, value)` → aplikují se omezení → zavolá se `hooks.onInput` → re-hydratace → re-render. Plátno se aktualizuje živě.
8. **Export.** Uživatel klikne na Download (PNG) → `runtime.export(canvasNode, 'png')` → `host.export.render` (rasterizuje přes dom-to-image-more; SVG/PDF jdou přes vyhrazené vektorizéry procházející DOM) → blob → `host.export.download`. Rozsah formátů, do kterých se nástroj může zapojit, je široký a autoritou je enum `render.formats` ve `schemas/tool.schema.json` - rastery a plovoucí rastery, vektory a řezací soubory, tisk/CMYK, pohyb, editovatelné dokumenty (`pptx`, `docx`, `odt`), paletové a datové/textové výstupy, audio a fontové soubory. [Režim URL](/info/url-mode.html) pojmenovává každé id a to, co produkuje. Audio je v tomto enumu jako cokoli jiného (`wav`, `mp3`, `m4a`, `opus`, deklarované audiogramem a nahrávacími nástroji); odděleně, režim `render.capture` u nahrávacího nástroje řídí `host.recorder`, jehož záznam přichází jako hotový Blob v jakémkoli kontejneru, který prohlížeč nahrál. (Nástroje, které nastaví `render.export: false` - např. Color Palette, Countdown Timer, Strip Hidden Data, Text Helper, Compress PDF - skrývají ovládací prvky pro stažení/formát/rozměry.) Fyzické jednotky se převádí podle formátu přímo tady (PDF → skutečné body stránky, raster → pixely při DPI s chunkem `pHYs`). Metadata o autorství/původu (autor, nástroj, zdroj - sestavuje `engine/src/metadata.ts`) se vkládají podle formátu: PNG iTXt, JPEG EXIF, PDF info dict, SVG `<metadata>`, komentář GIF. Experimentální nástroje dostávají vodoznak vložený hostem, ne nástrojem.

![Panel exportu, který otevírá `?options`: dvojice název souboru a formát, výstupní rozměry a ovládací prvky, které zapisují soubor](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Stejný životní cyklus v Tauri. Stejný životní cyklus v CLI - jsdom poskytuje bezhlavý DOM; výstup jde do souboru nebo na stdout.

---

## Stav open source

**Kód je pod MPL-2.0.** `engine/`, `shells/*`, `services/*`, `schemas/` a `docs/` jsou open source pod **MPL-2.0** - platforma pro scaffolding nezávislá na dodavateli pro nástroje značky, kde každá dodávaná jednotka má vlastní repozitář pod [github.com/lolly-tools](https://github.com/lolly-tools).

**Obsah nástrojů se dodává jako brand packy**, každý s vlastními podmínkami (viz `NOTICE.md` daného packu). `community/` je veřejný repozitář [`lolly-tools`](https://github.com/lolly-tools/lolly-tools) a jeho nástroje nezávislé na značce jsou také pod MPL-2.0. `brands/suse/` je privátní pack `suse-lolly`: nástroje SUSE a katalog SUSE, **proprietární pro SUSE**, včetně licencované hudby PremiumBeat. `brands/lolly-start/` je prázdná startovní značka, kterou vlastní tento repozitář. Písma se dodávají uvnitř packu pod licencí **SIL Open Font License 1.1** - pack SUSE nese písma SUSE a SUSE Mono.

`tools/` a `catalog/` v kořeni repozitáře jsou *pohledy* ignorované gitem: profil je sestaví z `community/` plus aktivního brand packu, a proto každý skript a shell čte tyto dvě cesty a nikdy pack přímo.

Toto oddělení je vynucené - neexistují cross-importy z `engine/` do obsahu nástrojů - takže hranice mezi platformou a obsahem zůstává čistá.

---

## Kde končí engine a začíná host

Pokud to lze popsat čistě daty + Handlebars → **engine**.
Pokud se to dotýká DOM, souborového systému, sítě nebo jakéhokoli API prohlížeče/OS → **host**.

Hranice je záměrně ostrá. Engine je open-source část. Vše, co ví o SUSE, konkrétních platformách nebo běhových prostředích, z něj zůstává vně.

Pro další úroveň detailu [`engine/README.md`](../engine/README.md) vyjmenovává každý modul enginu a za co odpovídá, a [Model hrozeb a hranice důvěry](/info/threat-model.html) zaznamenává, kde stejná hranice zároveň funguje jako hranice důvěry.
