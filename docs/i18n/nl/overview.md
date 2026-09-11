# Overzicht

![Lolly-icoon - Grote groen-witte lollipop-snoep](/info/icon.svg)

Dit document legt het doel, de structuur en de architectuurbeslissingen voor het Lolly-platform vast. Het weerspiegelt zowel de productvisie als de huidige staat van de codebase.

> **Status:** Lolly is een intern prototype in een **gesloten pilot die nog niet is afgerond**. De engine is deterministisch en intern consistent, maar het product is vroeg - SUSE is klant nummer één - en de cryptografie- en bestandsparse-engines ondergaan momenteel SUSE's strikte infrastructuurhardening, ter voorbereiding op enterprise-schaal (daar zijn we echt goed in). Lees de architectuur hieronder als ontwerpintentie onder test, niet als een afgerond, gecertificeerd product. Zie [Adoptie & Governance](/info/adoption-governance.html#status) voor hoe de pilot wordt uitgevoerd en gemeten.

> **Hoe je deze pagina leest.** Ze bevat twee soorten materiaal, in volgorde. De eerste helft gaat over
> **waarom dit bestaat**: het probleem, de positionering en de levenscyclus die één asset doorloopt.
> Vanaf [Het grote plaatje](#the-big-picture-how-the-layers-fit) gaat het over
> **hoe de lagen passen**: het architectuurdocument voor bijdragers, dat de engine/shell/pack-scheiding,
> de repository-indeling, de leverdoelen en de toezeggingen behandelt die elke wijziging aan het platform
> beperken. Als je hier bent om de codebase te wijzigen in plaats van het product te begrijpen,
> begin dan bij het grote plaatje.
>
> Twee begeleidende documenten gaan dieper dan deze pagina. [`engine/README.md`](../engine/README.md) in de
> repository is de module-voor-module kaart van de engine, met een gegenereerde tabel van elke module en
> wat die parset of schrijft. [Threat Model & Trust Boundaries](/info/threat-model.html)
> is dezelfde architectuur gelezen als trust boundaries, en het is de juiste pagina voor elke vraag over
> wat de engine als niet-vertrouwd beschouwt.

---

## Waarom dit bestaat

Teams staan voor een terugkerend probleem: herhaalbaar creatief en content-werk dat te voorspelbaar is om steeds vaardige handen in te zetten, maar te kwaliteitsgevoelig om zonder vangrails uit te besteden. Het resultaat is óf trage doorvoer (specialistenknelpunt), óf inconsistentie (mensen die gebruiken wat ze bij de hand hebben), óf vendor lock-in (een SaaS-DAM die je templates beheerst).

Dit platform is het directe antwoord:

> **Programmatisch creatief en content op schaal** - asset-generatie zonder arbeid, met de regels centraal onder controle, voor medewerkers, leveranciers en partners.

Lolly is niet waar een design system wordt bedacht - het is waar het wordt geproduceerd. Zie het als een verkoopautomaat voor ontwerp: maak een keuze, krijg een resultaat. Elke keer. De engine streeft naar de hoogste kwaliteit die elk formaat kan leveren op de hardware die voor je staat, en dezelfde engine maakt hetzelfde bestand op elk platform waarop hij wordt uitgebracht.

Het resultaat is **overvloed**: elk evenement heeft correcte bewegwijzering, elke CVE-melding past bij de huisstijl, elk label print schoon, elke e-mailhandtekening is actueel - allemaal zonder ontwerpticket. Het platform behandelt terugkerend, geoperationaliseerd creatief werk. Het is bewust geen tool voor maatwerkcreativiteit - ontwerpers blijven eigenaar van het vlaggenschipwerk.

### Innoveer probabilistisch, schaal deterministisch

Elke discussie over AI in een creatieve pipeline loopt vast op dezelfde vraag: welk deel is het werk van de machine? Het is een oude vraag met een uitgemaakt antwoord. Schrijvers en verluchters werkten al met twee instrumenten - de losse schets, waarin niets vaststond en alles geprobeerd kon worden, en de drukpers, intimiderend juist omdat ze zich vastlegde. De schetsen waren waar de kunst gebeurde. De pers was hoe die bij iedereen terechtkwam. Niemand verwarde de twee, en beide bleven zich ontwikkelen - nieuwe inkten, nieuwe lettertypen, nieuwe persen - elk verbeterend in harmonie met het vakmanschap en de intentie die het diende.

Lolly trekt dezelfde lijn. Verken probabilistisch: een model, een ontwerper, een ruw idee, een prompt die ergens uitkomt dat niemand gepland had. Schaal daarna deterministisch - het ding dat tienduizend outputs bereikt is een *tool*, en een tool rendert elke keer op dezelfde manier vanuit inputs die je kunt lezen. De verkenning blijft vrij omdat niets stroomafwaarts ervan afhangt dat het twee keer hetzelfde uitpakt. De output verdient vertrouwen omdat het geen gok is. AI-experimenten omzetten in voorspelbare, reproduceerbare resultaten is geen nieuwe discipline; het is dezelfde arbeidsverdeling die gedrukt werk in de eerste plaats betrouwbaar maakte.

> Vertrouw het creatieve proces, schaal met precisie.

### Tegenover de alternatieven

::: figure positioning-comparison
Volledigheid van functionaliteit bij de creatieve tools van vandaag, onderzocht in augustus 2026. Score: 0 afwezig, 25 workaround-niveau, 50 echt maar beperkt of gedeeltelijk, 75 sterk met kanttekeningen, 100 kerncompetentie.
:::

De kloof is duidelijk: niets dat vandaag geleverd wordt, biedt output die constraints-first, offline-geschikt, laagdrempelig en intern toegankelijk is. Lolly bevat zelfs een open canvas - **Design** - waarin kleuren, typografie en assets zich houden aan de merk-globals, zodat vrije opmaak constraints-first blijft. Wat het **niet** is, is een onbeperkte ontwerpsuite: ontwerpers blijven Illustrator en Figma gebruiken voor maatwerk-vlaggenschipwerk. Permutaties kunnen met deze tool worden samengesteld.

![Elke tool in de bibliotheek als kaart, gegroepeerd per categorie, zodat een producer er een kiest en begint](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=aud-gallery-landscape)

**Gebruik het voor:** Snelle generatie van geoperationaliseerde creatieve assets - eventtegels, naambadges, handtekeningen, CVE-meldingen, QR-codes, socialcards, zendingslabels, gestructureerde rapporten.

**Gebruik het niet voor:** Maatwerk hero-content.

---

## De levenscyclus van een campagne

De duidelijkste manier om te zien wat Lolly is, is geen functielijst - het is één asset volgen terwijl die van hand tot hand gaat. Bekijk hoe één gelokaliseerde campagnekaart door de organisatie beweegt:

1. **De ontwerper stelt de regels op.** Een ontwerper maakt de basissjabloon in de Design-tool en legt de typografie- en kleurvariabelen van het merk vast. Ze maken niet één kaart - ze doen het fundamentele werk *één keer*, zodat ze het nooit meer handmatig hoeven te lokaliseren.
2. **De developer schaalt het.** Diezelfde sjabloon wordt via de CLI in een nachtelijke pipeline aangesloten, zodat een nieuwe grafiek of een nieuwe taalversie automatisch wordt gegenereerd - niemand hoeft het bestand opnieuw te openen.
3. **De producer gebruikt het gewoon.** Een verkoper, offline in een vliegtuig, opent dezelfde tool en genereert een volledig on-brand presentatie voor een klantafspraak. Geen ontwerpvaardigheid, geen netwerk, geen wachttijd.

De "nieuwe grafiek" in stap twee is een render zoals deze, gegenereerd uit een datastring en een handvol parameters zonder dat iemand een ontwerpbestand opent:

![Een gestapeld vlakdiagram met titel, waarvan de drie reeksen zijn gebandeerd in een koel palet, met assen, legenda en titel allemaal geplaatst door het sjabloon in plaats van met de hand](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Het punt is niet dat Lolly goed is voor ontwerpers *en* goed voor developers *en* goed voor sales, elk op zichzelf. Het is een **estafette**: het aanvankelijke werk van de ontwerper wordt door de developer geschaald, wat op zijn beurt de producer versterkt. De moeiteloze ervaring voor de niet-technische verkoper in het vliegtuig is alleen *mogelijk* dankzij de precisie die de ontwerper vastlegde en de developer implementeerde.

Dat is de krachtvermenigvuldiger. Lolly is geen lade met losse tools voor losse rollen - het is één deterministische asset-levenscyclus die elke rol aanraakt, en elke hand waar hij doorheen gaat vermenigvuldigt de waarde van de vorige.

---

## Eén goedkeuring, tienduizend assets

Omdat de goedkeuring in de tool zit en niet in het bestand (zie [Hoe Lolly zich verhoudt](/info/positioning.html)), stopt schaal een reviewprobleem te zijn. Keur een gelokaliseerde socialcard-tool één keer goed, genereer daarna **10.000 assets in 12 talen** vanuit een spreadsheet - en niet één ervan heeft een nieuwe compliancecheck van juridische zaken of merk nodig, omdat de sjabloon waar ze allemaal uit komen al was goedgekeurd.

Dezelfde deterministische tool bereikt die schaal op drie manieren, allemaal met identieke, vooraf goedgekeurde output:

- <!--i:people--> **Een persoon, in de app.** Het `/pro`-batchraster: plak of importeer de rijen, krijg één afgeronde asset per rij, download de zip. Geen ontwerpvaardigheid, geen ticket, geen wachttijd.
- <!--i:code--> **Een developer, vanaf de command line.** De CLI draait *dezelfde* engine en *hetzelfde* renderpad headless, zodat de tool over alle 10.000 rijen kan worden doorlopen in een script of een nachtelijke pipeline. Een `lolly <tool> --field=…`-aanroep in een lus is de hele integratie.
- <!--i:cpu--> **Een systeem of een AI-agent, via MCP.** Dezelfde tool programmatisch bediend, met dezelfde nauwkeurigheid en zelfs grotere schaal - omdat een machine zich niet verveelt terwijl duizenden bestanden binnenkomen.

![Batch-modus bij een verse installatie: één lege rij die op een tool wacht, met het volledige spreadsheetoppervlak en de Render-knop al aanwezig voordat er data binnenkomt](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

Eén set merkregels, eenmalig vastgelegd door een ontwerper; drie routes naar dezelfde vooraf goedgekeurde output - en de machineroute schaalt het verst van alle drie, omdat ze nooit moe wordt terwijl de bestanden binnenkomen.

---

## Het grote plaatje: hoe de lagen samenkomen

Alles vanaf hier is architectuur. Het diagram is het hele systeem in één beeld: tools zijn
data bovenaan, de engine in het midden weet niets van welk platform dan ook, de shells eronder
implementeren één contract, en de catalogi leveren de content.

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

### Repository-indeling

Content wordt gemount als packs: `community/`, `docs/`, elke `shells/*`, zowel `services/*` als `brands/suse` zijn elk hun eigen repository, uitgecheckt als git-submodules van deze. De parent bezit `engine/`, `schemas/`, `scripts/`, `tests/`, `api/`, `brands/lolly-start/` en `profiles.json`. Zie [Build Guide » De broncode ophalen](/info/build-guide.html) voor het checkout-commando en de cross-repo workflow.

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

## Platformleveringsmodel

Het platform draait op meerdere oppervlakken - web-PWA, Tauri desktop/mobiel, de scriptbare CLI en de interactieve TUI. Ze gebruiken allemaal dezelfde engine en dezelfde toolbestanden.

### Web (PWA) - primaire distributie
Gehost op een door SUSE beheerde URL. Werkt offline zodra de service worker tools en assets heeft gecachet. Dit is waar de meeste medewerkers, leveranciers en partners het platform zullen gebruiken. Geen account vereist - status wordt per apparaat opgeslagen in IndexedDB.

De webshell is responsive vanuit één layout. Op desktop is een tool een resizable bedieningszijbalk naast een previewvenster met trackpad-eigen canvasnavigatie (Cmd/Ctrl-scroll of pinch om rond de cursor te zoomen, Space- of middelklik-slepen om te pannen, `0`/`1`/`+`/`−`-toetsen en een Fit/%-HUD). Op mobiel (≤640px) worden de bedieningselementen een bovenaan verankerd sheet met een sleepgreep die peek/half/full vastklikt (tikken schakelt), boven een statische fullscreen preview, en een zwevende **Render**-knop opent de **Export**-bediening in een bottom-sheet popup. Touch krijgt pinch-zoom en sleep-pan op de preview. Het renderpad en de exportbediening zijn identiek in beide gevallen - alleen de chrome herschikt zich.

![De desktop-splitview - bediening gegenereerd uit het manifest links, het live canvas rechts](/t/url-shot?url=%2F%23%2Ftool%2Fchart-creator&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=aud-web-split)

Dezelfde tool op telefoonbreedte, zonder tweede layout om te onderhouden: de bediening wordt een sheet bovenaan, de preview vult het hele scherm en de renderpil zweeft eroverheen.

![Een audiogram op een 430px-breed scherm - het bedieningsblad erboven, de afgewerkte vierkante artwork eronder en de zwevende renderpil](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

**Batchmodus (`/pro`).** De webshell levert ook een spreadsheet-achtig batchraster (`shells/web/src/pro/`) dat veel rijen tegelijk rendert over één of meerdere tools. Het doet CSV/TSV-round-trip plus spreadsheet-plakken, per-rij sjabloon/formaat/afmeting/eenheid/dpi, een blocks-editor zijpaneel met live preview, inklapbare exportkolommen, een per-rij "relevantie"-tagbalk, links een sleepgreep om rijen te herschikken, tweestaps verwijderbevestiging, opgeslagen batchsessies en een `.zip`-download. Dit is het one-to-many oppervlak achter de "massale contentgeneratie"-positionering.

### Tauri desktop / mobiel
Verpakte native app (kleine footprint via Tauri). Biedt volledige offline beschikbaarheid, bestandssysteemtoegang voor CLI-afhankelijke tools (PDF Smasher, Font Outliner) en cameratoegang. Gepland voor tooling-verbetering medio 2026.

### CLI
`lolly <tool-id> [--input=value ...] --output=file.png`

Desktopgebruikers kunnen veel tools vanaf de terminal aanroepen. De CLI-shell laadt dezelfde engine, maakt een jsdom-DOM aan, doorloopt hetzelfde renderpad en schrijft het bestand. URL-modus is het transport - CLI is geen aparte implementatie. Dit garandeert dat CLI- en GUI-output identiek zijn.

```bash
lolly qr-code --url=https://suse.com --output=qr.svg
lolly quotes --quote="Ship it." --output=quote.png
lolly                        # lists available tools
lolly qr-code                # lists inputs for that tool
```

### TUI
`npm run tui`

De interactieve tegenhanger van de CLI: een fullscreen, toetsenbord-eerst terminalapp (gebouwd op Ink) om tools te bladeren, invoer in te vullen, projecten op te slaan en te exporteren - allemaal zonder GUI. De hostbridge **hergebruikt de implementatie van de CLI** voor de DOM-vrije formaten (SVG/EMF/EPS/HTML + tekst/data), en voegt op-schijf status toe onder `~/.lolly` plus een opt-in inline preview. Daarnaast heeft het een **browser-rendertier**: een scoped headless Chromium (dezelfde die de MCP-server installeert) die raster/PDF/video en live-URL-capture op aanvraag produceert - waarbij een gebouwde kopie van de webshell wordt aangestuurd zodat de output identiek is, en die alleen start wanneer je zo'n formaat voor het eerst exporteert. Zo draaien `url-shot` (met bijsnijden + herkleuren + vector-PDF/SVG) en elke raster/pdf-tool ook in de terminal. Zie de [TUI-gids](/info/tui.html).

Op welk oppervlak je ook zit, het tabblad Capabilities van het dashboard is de volledige kaart van wat het platform verklaart te kunnen, gegroepeerd en leesbaar zonder ook maar één tool te openen.

---

## Toolcategorieën

Tools worden in hun manifest getagd met een `category` voor groepering in de gallery.

Rijen staan in de volgorde van de gallerysecties. De sectie `utility` wordt altijd als **laatste** in de gallery weergegeven (na elke andere categorie, ook toekomstige) - dit is de on-device lade "Offline Utilities".

| Categorie | Voorbeelden | Gepland |
|---|---|---|
| `everyone` | QR Code Generator, Quote Card, Email Signature, Logo, Wordmark, Audiogram, Battlecards, Sequence Studio, Record | Employee Image Stationery |
| `designer` | Brand Lockup, Design, Chart, Darkroom, Filter, Pose Geeko, Multi-Page PDF | Font Outliner |
| `event` | Meeting Planner, Event Name Badge, Wayfinding Signage, Calendar ICS, Booth Studio | Event Stationery, Bulk Name Badges, Room Agenda Cards |
| `product` | - | CVE Alert, Product Release Announcement, Blog OG Image |
| `utility` | Strip Hidden Data, Text Helper, Compress PDF, Convert Image, Convert Font, Redact, Run Web Code, Screen Capture, URL Screenshot | Unit/format converters, more on-device privacy utilities |

Die cellen zijn **voorbeelden, geen inventarissen**. Welke tools bestaan is een eigenschap van het profiel dat je hebt gemount, niet van deze pagina: een brandpack voegt zijn eigen tools toe en kan een communitytool uitsluiten die het liever niet meelevert. `catalog/tools/index.json` - gegenereerd uit de manifests, en het register dat de gallery daadwerkelijk leest - is de gezaghebbende lijst; om te tellen wat een profiel mount, tel je de manifests (`ls community/*/tool.json brands/*/tools/*/tool.json`) in plaats van te vertrouwen op een getal dat hier is opgeschreven. (Een tool-id dat in twee packs voorkomt, wordt eenmaal gemount, vanuit het winnende pack.)

Tools worden ook geclassificeerd naar status: `official` (goedgekeurd door het merk, geen watermerk), `community` (externe bijdrage), `experimental` (exports met watermerk). Het grootste deel van de bibliotheek is `official`; de nieuwere studio's en de capture-tools staan doorgaans op `community` of `experimental` terwijl ze zich settelen. Elk oppervlak toont de badge, zodat een lezer weet wat hij oppikt voordat hij het opent - en, net als de categoriecellen hierboven, verandert het lidmaatschap per status te snel om hier op te sommen. Lees het af van de gallery of de gegenereerde index.

**Design** is de eerste tool die is gebouwd op de vrije-canvasmodus `render.layout: "editor"` - een chromeloos oppervlak voor directe manipulatie waarop je vakken met tekst, vormen en afbeeldingen sleept, formaat wijzigt, roteert en uitlijnt, om vervolgens via hetzelfde renderpad als elke andere tool te exporteren.

**Strip Hidden Data** is de eerste **on-device utility** (`privacy: "on-device"`): een content-transformatietool die een bestand verwerkt dat *jij* aanlevert, volledig in de browser, en een schone kopie teruggeeft - nooit geüpload, nooit voorzien van watermerk, geen herkomst gestempeld. **Text Helper** is de tweede - een on-device werkbank voor alledaagse plak-in-een-website-klussen (JSON-opmaak, JWT-decodering, Base64, URL-encoderen/decoderen, SHA-hashing). **Compress PDF** is de derde - deze verkleint een PDF door de afbeeldingen erin opnieuw te comprimeren, ook weer volledig on-device. De marker en de bijbehorende badgetekst "Runs on your device - nothing is uploaded" dekken nu de hele transformatieset: Strip Hidden Data, Text Helper, Compress PDF, **Convert Image** (HEIC/TIFF/AVIF → WebP/JPG/PNG), **Convert Font**, **Redact** (delen van een afbeelding, SVG of PDF vernietigen), **Prompt to Image** en **Rebrand a Deck** (een `.pptx` ter plekke van thema wisselen) waar het profiel die meelevert. Dit is een privacy-utilitycategorie die de noodzaak vervangt om vertrouwelijke bestanden aan single-purpose websites toe te vertrouwen.

![De Utilities-lade, waarin elke kaart een tool is die een bestand transformeert dat je al hebt](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=aud-utilities)

> Opmerking: `category` en `status` worden vanuit elke `tool.json` gedenormaliseerd naar `catalog/tools/index.json` (het register dat de gallery leest). Het manifest is de bron van waarheid - de index wordt **gegenereerd** door `npm run build:catalog` en `npm run validate:catalog` laat CI falen als de vastgelegde index afwijkt van de manifests.

---

## Architecturale toezeggingen

Deze beslissingen staan vast. Elke wijziging hierin is een grote onderneming - ze bepalen elke andere beslissing in de codebase.

### 1. Declaratieve tools, met een imperatief ontsnappingsluik

Een tool is een manifest (`tool.json`) + een template (`template.html`) + optionele `hooks.js`.

**Het manifest declareert de inputs.** Niet het template. Inputs worden niet afgeleid uit Handlebars-tokens. Het manifest is het contract; het template gebruikt benoemde variabelen via `{{id}}`.

![De controlestack van Street Map - een stad-dropdown, een themaselector, dikte-sliders en kleurtriggers, elk daarvan afkomstig uit een manifestregel](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

**Hooks zijn optioneel.** De meeste tools zijn zuiver declaratief - manifest + template is genoeg. Tools die berekende waarden nodig hebben (QR-codering, vormgeving van chartdata) leveren `hooks.js` met benoemde levenscyclusfuncties (`onInit`, `onInput`, `onFrame` - de per-frame live-camerahook voor bewegingsreactieve tools - `onLevel`, `beforeExport`, `afterExport`, `exportFile` - het file-in/file-out-transformatiepad dat on-device utilities zoals Strip Hidden Data gebruiken - en `exportStill`, voor een tool die zijn eigen deep raster beheert). De host laadt hooks via `new Function('host', …)` waarbij de capability bridge als closure-scope wordt geïnjecteerd. Dit is een **portabiliteitscontract, geen beveiligingssandbox**: hooks draaien nog steeds in het page realm en *kunnen* in een browsershell bij `window`/`fetch`/`document` - `host.*` is het ondersteunde, portable oppervlak, geen afgedwongen grens. Asynchrone hookresultaten zijn tijdgebonden (`onInit` 5s, `onInput` 2s, `beforeExport`/`afterExport` 5s, `exportFile`/`exportStill` 10s) en late resultaten worden verworpen; een op hol geslagen *synchrone* hook kan niet worden onderbroken. Onvertrouwde hookcode van derden is daarom niet veilig om uit te voeren totdat Worker-isolatie er is.

Dit is van belang omdat: declaratieve tools door niet-ontwikkelaars kunnen worden geschreven. Als elke tool een webapp zou zijn, wordt de risico-opmerking "beperkte vaardigheden om workhorse-templates te maken/onderhouden" een permanent knelpunt.

### 2. Tools en assets zijn data, geen gebundelde code

De web- en Tauri-apps halen tool- en assetcatalogi bij het opstarten op van een bekende URL, cachen ze lokaal en werken met wat daar staat. **Het toevoegen van een nieuwe eventtegel of seizoensasset vereist geen app-release.**

Assetbytes krijgen een SHA-256-checksum om CDN-poisoning te voorkomen. Asset-`id` + `version` stuurt cache-invalidatie aan.

### 3. De Capability Bridge is de enige API die tools zien

Tools raken nooit de DOM buiten hun templategebied aan, roepen nooit rechtstreeks `fetch` aan en lezen nooit het bestandssysteem. Ze roepen geversioneerde `host.*`-methoden aan. De canonieke definitie van het contract is `packages/core/src/host-v1.ts` - de tool-author-SDK `@lolly-tools/core`, zodat een derde partij ertegen kan bouwen zonder van de engine af te hangen; `engine/src/bridge/host-v1.ts` is daar een type-re-export van, en engine-/shellcode blijft ongewijzigd vanaf dat pad importeren:

| Bridge-API | Wat het doet |
|---|---|
| `host.profile` | Voornaam, e-mail, pasfoto, stad enz. van de gebruiker. Vult inputs vooraf in via `bindToProfile`. |
| `host.assets` | Catalogusquery's, asset-resolutie, door de host geleverde picker-UI. |
| `host.state` | Input-slots opslaan/laden. IndexedDB op web, bestandssysteem op Tauri, geheugen op CLI. |
| `host.clipboard` | Tekst of afbeelding naar het klembord schrijven (met platformfallbacks). |
| `host.export` | Het renderdoel rasteriseren of serialiseren. Past een watermerk toe voor experimentele tools. |
| `host.net` | Fetch met allowlist - alleen beschikbaar als de tool de capability `"network"` heeft gedeclareerd. (Geen enkele geleverde tool gebruikt dit momenteel.) |

Optionele, additieve oppervlakken verschijnen alleen wanneer een shell ze levert. Sommige zijn **capability-gated** - alleen beschikbaar wanneer de tool de bijbehorende flag declareert: `host.compose` (de render van een andere tool insluiten - `compose`), `host.capture` (paginacapture voor URL Screenshot - `capture`) en `host.recorder` (mic-/camera-/schermcapture voor de opnametools - `microphone` / `camera` / `screen`). De rest is **feature-detected** - aanwezig zodra de shell ze kan leveren, waarbij de tool een fallback behoudt voor shells die dat niet kunnen.

Een handvol kernoppervlakken, om te laten zien wat het bestrijkt - [Host API](/info/host-api.html) documenteert ze allemaal, en `packages/core/src/host-v1.ts` is het contract zelf:

| Surface | Sinds | Wat het toevoegt |
|---|---|---|
| `host.tokens` | 1.0 | DTCG-designtokens - de eigen primitieven van het merk |
| `host.text` | 1.0 | Tekst-naar-pad via HarfBuzz WASM (de capability-vlag `wasm` markeert tools die hierop leunen) |
| `host.media` | 1.4 | Live cameraframes die de hook `onFrame` aansturen. Progressieve verbetering, bewust *niet* afgeschermd door de vlag `camera` - zo'n tool werkt nog steeds als een gewone stilstaande-beeldtool |
| `host.color` | 1.40 | Perceptuele kleurwiskunde: ΔEOK, WCAG- + APCA-contrast, OKLab-verlopen, klassegrenzen, categorische paletten, harmonieschema's (1.60), CSS Color 4-menging en gradient-baking (1.68). Zuiver en synchroon - shells koppelen de `makeColorApi()` van de engine in plaats van zelf iets te implementeren, zodat het niet kan afwijken |
| `host.images` | 1.60 | Bytes op het apparaat decoderen / herschalen / hercoderen - het convert-pad (HEIC → JPEG, comprimeren naar WebP, verkleinen). In de webshell geleverd als een lazy facade, zodat de HEIC-decoder nooit in de bootchunk terechtkomt |
| `host.geom` | 1.64 | Exacte vectorgeometrie: padbooleans, offsetting, stroke-naar-fill, splineverlaging, vereenvoudiging, hittesten. Ook zuiver, synchroon en gekoppeld vanuit de engine (`makeGeomApi()`); fouten worden *geretourneerd*, nooit gethrowd |

De rest volgt dezelfde regels en is er samen mee gedocumenteerd: `pdf` (1.8) en `pptx` (1.58) voor on-device documentchirurgie, `audio` (1.71) en `speech` (1.96) voor clipanalyse en on-device TTS/transcriptie, `viz` (1.72) voor het MilkDrop-placeholdercontract, `codec` (1.100) en `layers` (1.102) voor deep-bit- en layered-bitmap-output, `upscale` (1.101) en `matte` (1.103) voor de on-device modellen, `raster` (1.105) voor hooks die hun eigen pixelwerk doen, `connectors` (1.106) voor exportveilige pijlen en `c2pa` (1.85) voor het ondertekenen van afgeronde bytes. Het aantal groeit; de regels niet.

De declareerbare capabilities zijn: `network`, `filesystem`, `clipboard`, `camera`, `microphone`, `screen`, `ffmpeg`, `wasm`, `capture`, `compose`. (`screen`, toegevoegd in 1.54, is schermcapture via `host.recorder` - de gebruiker kiest een scherm/venster/tabblad in de browsereigen UI; dit is anders dan `capture`, dat een URL rasteriseert die de tool zelf noemt.)

Dezelfde tool draait in browser, Tauri en headless CLI omdat elke shell deze interface implementeert - de tool weet nooit in welke hij zit.

De bridge is geversioneerd. Het toevoegen van methoden is een minor version. Het verwijderen of wijzigen van signatures is een major version bump. Wanneer v2 uitkomt, moet v1 blijven werken.

### 4. Asset-ID's zijn voor altijd

`suse/logo/primary` is een contract. Eenmaal gepubliceerd:
- De ID verandert nooit, wordt nooit hergebruikt.
- Bytewijzigingen → verhoog `version` in het manifest.
- Vervangen door een nieuwe asset → zet `deprecated: true` en optioneel `replacedBy`.
- Bestaande referenties worden altijd opgelost.

Dit maakt opgeslagen tool-states en via URL gedeelde links jarenlang duurzaam.

### 5. URL-modus is first-class

Elke input moet uitdrukbaar zijn als een URL-parameter:

```
lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H
```

![Die link op zichzelf, zonder iets anders erin, is de afgeronde asset](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fsuse.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

CLI-modus is URL-modus onder een ander transport - de CLI-shell bouwt een URL-state-object op uit argv en draait **dezelfde** engine-pipeline. Er is één renderpad. De CLI kan niet afwijken van de GUI omdat het geen aparte implementatie is.

`url-mode.ts` verzorgt de round-trip (parsen en serialiseren). Een set **gereserveerde parameters** wordt nooit als inputs aan de tool doorgegeven: de outputbedieningen (`format`, `export`, `copy`, `filename`, `width`/`w`, `height`/`h`, `unit`, `dpi`), de print- en herkomstknoppen (`bleed`, `marks`, `profile`, `password`, `c2pa`, `imprint`, `durable`, `meta`, `hdr`, `depth`, `cuts`) en de state-dragers (`template`, `z` - het gepakte token voor "Shortest link" - en `zx`, hetzelfde maar versleuteld met een wachtwoord). De set `RESERVED` in `engine/src/url-mode.ts` is gezaghebbend en wordt door een test vastgepind; [URL Mode](/info/url-mode.html) documenteert ze allemaal, inclusief de handvol die hier niet staat vermeld. Asset-inputs in URL-modus worden geserialiseerd via hun `id`; de runtime lost ze op via `host.assets.get()` voordat hydratie plaatsvindt. `width`/`height` zijn waarden in `unit` (standaard `px`, ook `mm`/`cm`/`in`/`pt`/`pc`); bij een fysieke eenheid stelt `dpi` de rasterresolutie in. Ze bepalen het canvasdocumentformaat en vullen het exportafmetingenpaneel vooraf in.

Omdat elke input meereist in de link, is een parameterwijziging een andere afgeronde asset. Dit hele palet is één basiskleur, een harmonie en een stapaantal:

![Negen stappen over vier kleurtinten, allemaal gegroeid uit de ene zaadkleur in de link](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

### 6. Opslag loopt via de bridge, niet rechtstreeks

Web shell: IndexedDB. Tauri: bestandssysteem. CLI: in-memory. Tools zien alleen `host.state.save(slot, data)` en `host.state.load(slot)`. `localStorage` wordt niet gebruikt - het is te klein en kan geen blobs bevatten.

Gebruikers kunnen meerdere benoemde bewerkingsslots per tool opslaan en later terugkeren naar elke sessie. Een account aanmaken is niet nodig; de status is per apparaat. Omdat de bridge de enige naad is, is die per-apparaat status ook *overdraagbaar*: `shells/web/src/data-transfer.ts` leest alles terug via `host.profile`/`host.state`/`host.assets` in één `lolly-backup`-zip die op elke andere installatie te importeren is - het offline antwoord op "verhuis naar een nieuw apparaat" zonder server (volledige specificatie: `docs/data-transfer.md`). SUSE ID-integratie (synchronisatie tussen meerdere apparaten) is een toekomstige mijlpaal hierbovenop.

### 7. Volwassenheidslabels beantwoorden het "door het merk goedgekeurd"-risico structureel

Elke tool declareert `status: official | community | experimental` in zijn manifest. De galerij sorteert op status. Experimentele tools voorzien hun exports automatisch van een watermerk - het watermerk wordt toegepast door `host.export.render`, niet door de tool, dus een niet-officiële tool-auteur kan er niet voor uitschakelen.

Dit is een structureel antwoord op het perceptierisico dat het gebruik van welke tool dan ook merkgoedkeuring impliceert. Procesantwoorden (een reviewwachtrij, SUSE ID-gating) komen daar bovenop.

### 8. Tool-invoer is getypeerd via het manifest, inclusief assets

Invoervelden declareren een `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` en `file`. De host rendert een generieke besturing per type vanuit het manifest - tools schrijven nul regels besturingscode. (Vooraf invullen vanuit het profiel van de gebruiker is geen type - elke invoer kan `bindToProfile` dragen.) Drie wegen zwaarder dan de rest:

- **`asset`** (met `filter` en `allowUpload`) is de brug naar het globale assetsysteem; `allowUpload: false` is de hendel voor merkhandhaving voor dingen zoals sponsortegellogo's waar alleen bibliotheekassets toegestaan zijn. Gebruikersuploads gebruiken dezelfde `AssetRef`-vorm als bibliotheekassets, dus tools behandelen ze identiek.
- **`blocks`** is een herhalende veldgroep - een minitabel binnen één invoerveld, bewerkt in een zijpaneel, met een getypeerd/onderscheiden toevoegmenu en assetvelden per blok. Klikken op een gerenderd blok op het canvas focust de rij van dat blok. Gebruikt door `meeting-planner`, `chart-creator`, `event-name-badge`, `wayfinding-signage`, `color-block` en `digi-ad`.
- **`vector`** groepeert een vaste set getallen (bijvoorbeeld een transform) in één samengestelde besturing; **`file`** houdt het eigen bestand van de gebruiker als bytes in het geheugen voor on-device transformatie-utilities (bijvoorbeeld `strip-data` en `compress-pdf`).

### 9. Templates zijn logicaloos (Handlebars, geen EJS)

Handlebars is bewust boven EJS gekozen:
- Logicaloos. Templates kunnen door niet-developers worden opgesteld.
- Standaard veilig. `{{x}}` escapet HTML; `{{{x}}}` is optioneel rauw.
- Geen willekeurige JS in templates betekent geen XSS-auditoppervlak per template.

Logica leeft in `hooks.js`, waar die expliciet en beoordeelbaar is. Beschikbare Handlebars-helpers: `{{default}}`, `{{upper}}`, `{{lower}}`, `{{eq}}`, `{{markdown}}`, `{{asset ref}}`, `{{asset ref "property"}}` (plus dataformaathelpers `icsStamp`/`rfcText`/`csvCell` gebruikt door de bijbehorende `.ics`/`.vcf`/`.csv`-templates).

### 10. Tools stellen tools samen

Een tool kan de render van een **andere** tool embedden zonder tool-naar-tool imports - samenstelling wordt opgelost door de engine, nooit door tool-code. Er zijn twee oppervlakken:

- **Declaratief manifest** - `composes: [{ id, tool, inputs, format?, width?, height? }]`. De engine rendert het genoemde kind en plaatst het resultaat in de logicaloze template als `{{asset <id>}}`. `event-name-badge` stelt vandaag `qr-code` samen als SVG.
- **Overdraagbare embed-URL** - `<img src="https://lolly.tools/tool/<id>.<ext>?<inputs>">`. De shell rendert dat kind **lokaal** (een placeholderpixel toont zich tot de lokale render klaar is); er wordt nooit iets opgehaald bij `lolly.tools`.

Stel de render van elke tool samen: een **SVG**-kind blijft een echte vector wanneer het bovenliggende item naar SVG of PDF exporteert en rasteriseert scherp voor PNG; **PNG/JPG/WEBP**-kinderen worden als afbeeldingen ingesloten. Vereist de `compose`-capability. Samengestelde kinderen zijn tussenproducten - nooit voorzien van watermerk of herkomststempel - en samenstelling degradeert gracieus: een shell die een kind niet kan renderen laat de slot gewoon weg en het bovenliggende item rendert alsnog.

---

## Wat we expliciet niet deden

- **Geen EJS / geen willekeurige JS in templates.** Het XSS-oppervlak is nul. Logica leeft in `hooks.js`.
- **Geen verplicht asset-CMS.** Individuen nemen hun eigen creatieve bestanden rechtstreeks in de app op in hun catalogus (de [Catalogus](/info/using.html)-weergave en de Brand Studio) - geen server, geen beheerconsole. Werk wordt overgedragen als een **sessie**: een share-link draagt de hele status mee, en dezelfde sessie reist mee in een back-up of via een collab-sessie. Wie de implementatie beheert, kan een gedeelde sessie vervolgens vastzetten als een **template** - open de link, leg de waarden ervan vast als een template-item in de map van die tool in het merkpakket en commit - waarna het verschijnt in de "New from template"-kiezer van de tool en deep-linkbaar is als `?template=<id>`. Git is de vastzetstap van de implementatie-eigenaar, nooit die van de maker. Voor een *gedeelde, governed* catalogus **kan** een organisatie de asset-map op dezelfde manier beheren en updates laten verlopen via PR-review - een beschikbaar governancemodel, geen vereiste van de app.
- **Geen verplichte RBAC.** De open app is standaard publiek toegankelijk; merkrisico wordt beheerd met maturity tags + watermerken. Een organisatie die strakkere controle wil, legt daar zijn eigen auth en de hierboven beschreven git-gereviewde catalogus overheen.
- **Geen centrale database.** Alle gebruikersstatus is per apparaat. SUSE ID-integratie staat op de roadmap, maar is geen lanceervereiste.
- **Geen gedeelde tools/engine-codepath.** De engine is open source, net als de merkneutrale tools in `community/`; een merkpakket zoals het private `brands/suse/` bevat zijn eigen tools en catalogus onder zijn eigen voorwaarden. Hoe dan ook wordt de scheiding afgedwongen (geen cross-imports vanuit `engine/` naar toolcontent), zodat de splitsing schoon blijft.

---

## Levenscyclus, van begin tot eind

Een gebruiker opent `lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H`:

1. **Boot.** De web shell opent IndexedDB, bouwt de capability-bridge, synchroniseert de tool- en assetcatalogi (of laadt vanuit cache bij offline gebruik).
2. **Route.** URL-hash → `tool`-weergave, met `qr-code` en URL-parameters geëxtraheerd.
3. **Laden.** `loadTool('qr-code', fetchFile)` haalt `tool.json` op, valideert tegen het JSON Schema, haalt `template.html`, `styles.css` en de `hooks.js`-broncode op.
4. **URL-status parsen.** `parseUrlState` vertaalt URL-parameters naar initiële invoerwaarden. Asset-referenties (`?logo=suse/logo/primary`) worden geparst als lichtgewicht `{ id, _unresolved: true }`-objecten.
5. **Runtime.** `createRuntime(tool, host, initialValues)` bouwt het invoermodel (profielgegevens, standaardwaarden en initiële waarden samenvoegend), lost asset-referenties op via `host.assets.get()`, laadt hooks (closure-scoped `host`, niet gesandboxt), roept `hooks.onInit` aan.
6. **Render.** De shell abonneert zich op de runtime; bij elke statuswijziging ontvangt ze `{ model, hydrated }`. Ze rendert invoerbesturingen vanuit het model en schrijft de gehydrateerde template-HTML naar `#tool-canvas`.
7. **Interactie.** De gebruiker typt in een invoerveld → `runtime.setInput(id, value)` → beperkingen toegepast → `hooks.onInput` aangeroepen → opnieuw hydrateren → opnieuw renderen. Het canvas werkt live bij.
8. **Export.** De gebruiker klikt op Download(PNG) → `runtime.export(canvasNode, 'png')` → `host.export.render` (rasteriseert via dom-to-image-more; SVG/PDF gaan via toegewijde DOM-doorlopende vectoriseerders) → blob → `host.export.download`. Het formaatbereik waarvoor een tool kan kiezen is breed, en de `render.formats`-enum in `schemas/tool.schema.json` is daarvoor het gezag - rasters en float-rasters, vectoren en snijbestanden, print/CMYK, beweging, bewerkbare documenten (`pptx`, `docx`, `odt`), palet- en data/tekstuitvoer, audio- en lettertypebestanden. [URL-modus](/info/url-mode.html) noemt elke id en wat die produceert. Audio staat in die enum net als al het andere (`wav`, `mp3`, `m4a`, `opus`, gedeclareerd door de audiogram en de opnametools); apart daarvan stuurt de `render.capture`-modus van een opnametool `host.recorder` aan, waarvan de opname als een afgeronde Blob binnenkomt in welke container de browser ook opnam. (Tools die `render.export: false` instellen - bijvoorbeeld Color Palette, Countdown Timer, Strip Hidden Data, Text Helper, Compress PDF - verbergen de download-/formaat-/afmetingsbesturingen.) Fysieke eenheden worden hier per formaat omgezet (PDF → echte paginapunten, raster → pixels op DPI met een `pHYs`-chunk). Auteurschap/herkomstmetadata (auteur, tool, bron - gebouwd door `engine/src/metadata.ts`) wordt per formaat ingesloten: PNG iTXt, JPEG EXIF, PDF-infowoordenboek, SVG `<metadata>`, GIF-commentaar. Experimentele tools krijgen een watermerk ingevoegd door de host, niet door de tool.

![Het exportpaneel dat `?options` opent: het bestandsnaam- en formaatpaar, de uitvoergrootte en de besturingen die het bestand schrijven](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Zelfde levenscyclus in Tauri. Zelfde levenscyclus in CLI - jsdom levert de headless DOM; de uitvoer gaat naar een bestand of stdout.

---

## Opensourcestatus

**Code is MPL-2.0.** `engine/`, `shells/*`, `services/*`, `schemas/` en `docs/` zijn open source onder **MPL-2.0** - een leveranciersneutraal scaffoldingplatform voor merktooling, waarbij elke uitleverbare eenheid in zijn eigen repository staat onder [github.com/lolly-tools](https://github.com/lolly-tools).

**Toolcontent wordt uitgeleverd als merkpakketten**, elk met eigen voorwaarden (zie het `NOTICE.md`-bestand van het pakket). `community/` is de publieke [`lolly-tools`](https://github.com/lolly-tools/lolly-tools)-repository en de merkneutrale tools daarin zijn ook MPL-2.0. `brands/suse/` is het private `suse-lolly`-pakket: de SUSE-tools en de SUSE-catalogus, **eigendom van SUSE**, inclusief de gelicentieerde PremiumBeat-muziek. `brands/lolly-start/` is het lege startmerk dat deze repository bezit. Fonts worden binnen een pakket uitgeleverd onder de **SIL Open Font License 1.1** - het SUSE-pakket bevat de SUSE- en SUSE Mono-lettertypes.

De `tools/` en `catalog/` in de repo-root zijn gitignored *views*: een profiel stelt ze samen uit `community/` plus het actieve merkpakket, en daarom lezen elk script en elke shell die twee paden en nooit een pakket rechtstreeks.

De scheiding wordt afgedwongen - er zijn geen cross-imports vanuit `engine/` naar toolcontent - zodat de grens tussen platform en content schoon blijft.

---

## Waar de engine eindigt en de host begint

Als je het kunt beschrijven in pure data + Handlebars → **engine**.
Als het de DOM, het bestandssysteem, het netwerk of een browser-/OS-API raakt → **host**.

De lijn is bewust scherp. De engine is het opensource-deel. Alles wat iets weet over SUSE, specifieke platforms of runtime-omgevingen blijft eruit.

Voor het volgende detailniveau somt [`engine/README.md`](../engine/README.md) elke enginemodule op en waar die verantwoordelijk voor is, en [Dreigingsmodel & vertrouwensgrenzen](/info/threat-model.html) legt vast waar diezelfde lijn tevens een vertrouwensgrens is.
