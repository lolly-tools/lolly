# Översikt

![Lolly-ikon - Stor grön och vit klubba](/info/icon.svg)

Det här dokumentet beskriver syftet, strukturen och de arkitektoniska besluten för Lolly-plattformen. Det speglar både produktvisionen och kodbasens nuvarande tillstånd.

> **Status:** Lolly är en intern prototyp i en **sluten pilot som ännu inte är avslutad**. Motorn är deterministisk och internt konsekvent, men produkten är tidig - SUSE är kund nummer ett - och dess kryptografi- och filtolkningsmotorer genomgår för närvarande SUSE:s strikta infrastrukturhärdning inför enterprise-skala (vi är riktigt bra på det här). Läs arkitekturen nedan som designintention under test, inte en färdig, certifierad produkt. Se [Adoption & Governance](/info/adoption-governance.html#status) för hur piloten drivs och mäts.

> **Så läser du den här sidan.** Den innehåller två sorters material, i ordning. Första halvan är
> **varför det här finns**: problemet, positioneringen och livscykeln en enskild tillgång går
> igenom. Från [Helheten](#the-big-picture-how-the-layers-fit) och framåt handlar det om
> **hur lagren passar ihop**: arkitekturdokumentet för bidragsgivare, som täcker separationen mellan
> motor/skal/paket, förvarsstrukturen, leveransmålen och de åtaganden som begränsar varje
> ändring av plattformen. Om du är här för att ändra kodbasen snarare än att förstå
> produkten, börja vid helheten.
>
> Två följeslagare går djupare än den här sidan. [`engine/README.md`](../engine/README.md) i
> förvaret är kartan modul för modul över motorn, med en genererad tabell över varje modul och
> vad den tolkar eller skriver. [Hotmodell och tillitsgränser](/info/threat-model.html)
> är samma arkitektur läst som tillitsgränser, och det är rätt sida för alla frågor om
> vad motorn behandlar som opålitligt.

---

## Varför det här finns

Team stöter på ett återkommande problem: repeterbart kreativt arbete och innehållsarbete som är för förutsägbart för att motivera skickliga händer varje gång, men för kvalitetskänsligt för att lämna ifrån sig utan skyddsräcken. Resultatet blir antingen låg genomströmning (specialistflaskhals), inkonsekvens (folk som använder vad de nu råkar ha) eller leverantörsinlåsning (en SaaS-DAM som kontrollerar dina mallar).

Den här plattformen är det direkta svaret:

> **Programmatiskt kreativt innehåll i stor skala** - tillgångsgenerering utan arbetsinsats, med reglerna under central kontroll, för anställda, leverantörer och partners.

Lolly är inte platsen där ett designsystem uppfinns - det är platsen där det produceras. Tänk på det som en varuautomat för design: gör ett val, få ett resultat. Varje gång. Motorn strävar efter den högsta kvalitet varje format kan producera på hårdvaran framför dig, och samma motor skapar samma fil på varje yta den levereras till.

Resultatet är **överflöd**: varje event har korrekt skyltning, varje CVE-varning matchar husstilen, varje etikett skrivs ut rent, varje e-postsignatur är aktuell - allt utan en designbeställning. Plattformen hanterar återkommande operationaliserat kreativt arbete. Den är medvetet inte ett skräddarsytt kreativt verktyg - designers äger fortfarande flaggskeppsarbetet.

### Innovera probabilistiskt, skala deterministiskt

Varje diskussion om AI i en kreativ pipeline fastnar på samma fråga: vilken del av det här är maskinens jobb? Det är en gammal fråga med ett avgjort svar. Skrivare och illuminatörer arbetade redan mellan två instrument - den lösa skissen, där inget var fastlagt och allt kunde prövas, och tryckpressen, skrämmande just för att den band fast. Skisserna var där konsten skedde. Pressen var hur den nådde vem som helst. Ingen blandade ihop de två, och båda fortsatte att utvecklas - nya bläck, nya typsnitt, nya pressar - var och en som förbättrades i samklang med hantverket och avsikten den tjänade.

Lolly drar samma gräns. Utforska probabilistiskt: en modell, en designer, en lös idé, en prompt som hamnar någonstans ingen planerade. Skala sedan deterministiskt - det som når tio tusen utdata är ett *verktyg*, och ett verktyg renderar likadant varje gång från indata du kan läsa. Utforskandet förblir fritt eftersom inget nedströms beror på att det landar likadant två gånger. Utdatan förtjänar tillit eftersom den inte är en gissning. Att få AI-experimenterande in i förutsägbara, reproducerbara resultat är ingen ny disciplin; det är samma arbetsdelning som gjorde tryckt arbete värt att lita på från första början.

> Lita på den kreativa processen, skala med noggrannhet.

### Mot alternativen

::: figure positioning-comparison
Funktionsfullständighet över dagens kreativa verktyg, undersökt augusti 2026. Poängsättning: 0 saknas, 25 nödlösningsnivå, 50 riktigt men begränsat eller partiellt, 75 starkt med förbehåll, 100 kärnkompetens.
:::

Gapet är tydligt: inget som levereras idag ger oss constraints-first, offline-kapabel, lågtröskel, internt tillgänglig utdata. Lolly innehåller till och med en öppen duk - **Design** - där färger, typsnitt och tillgångar följer varumärkets globala inställningar, så fri arrangering förblir constraints-first. Vad den **inte** är är en obegränsad designsvit: designers fortsätter att använda Illustrator och Figma för skräddarsytt flaggskeppsarbete. Permutationer kan sättas ihop med det här verktyget.

![Varje verktyg i biblioteket som ett kort, grupperat efter kategori, så att en producent kan välja ett och komma igång](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=aud-gallery-landscape)

**Använd det för:** Snabb generering av operationaliserat kreativt innehåll - eventskyltar, namnbrickor, signaturer, CVE-varningar, QR-koder, sociala kort, godsetiketter, strukturerade rapporter.

**Använd det inte för:** Skräddarsytt hero-innehåll.

---

## En kampanjs livscykel

Det tydligaste sättet att se vad Lolly är är inte en funktionslista - det är att följa en enskild tillgång när den går från hand till hand. Följ ett lokaliserat kampanjkort genom organisationen:

1. **Den kreativa sätter reglerna.** En designer skapar basmallen i Design-verktyget och hårdkodar varumärkets typografi- och färgvariabler. De skapar inte ett kort - de gör grundarbetet *en gång* så att de aldrig behöver lokalisera det för hand igen.
2. **Utvecklaren skalar det.** Samma mall kopplas in i en nattlig pipeline via CLI:n, så att ett nytt diagram eller en ny språkvariant genereras automatiskt - ingen designer öppnar filen igen.
3. **Producenten bara använder det.** En säljare, offline på ett plan, öppnar samma verktyg och genererar en helt varumärkesenlig presentation för ett kundmöte. Ingen designkompetens, inget nätverk, ingen väntan.

Det "nya diagrammet" i steg två är en rendering som den här, framställd från en datasträng och en handfull parametrar utan att någon öppnar en designfil:

![Ett rubricerat staplat ytdiagram, dess tre serier bandade i en sval palett med axlar, förklaring och rubrik alla placerade av mallen snarare än för hand](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Poängen är inte att Lolly är bra för designers *och* bra för utvecklare *och* bra för säljare, var och en i ett vakuum. Det är ett **stafettlopp**: den kreativas första arbete skalas av utvecklaren, som i sin tur ger producenten kraft. Den enkla upplevelsen för den icke-tekniska säljaren på planet är bara *möjlig* på grund av den noggrannhet designern satte och utvecklaren driftsatte.

Det är hävstångseffekten. Lolly är inte en låda med separata verktyg för separata roller - det är en enda deterministisk tillgångslivscykel som varje roll rör vid, och varje hand den passerar genom multiplicerar värdet av den föregående.

---

## Ett godkännande, tio tusen tillgångar

Eftersom godkännandet ligger i verktyget och inte i filen (se [Hur Lolly jämför sig](/info/positioning.html)) slutar skala vara ett granskningsproblem. Godkänn ett lokaliserat socialt-kort-verktyg en gång och generera sedan **10 000 tillgångar på 12 språk** från ett kalkylark - och inte en enda av dem behöver en ny efterlevnadskontroll från juridik eller varumärke, eftersom mallen de alla kommer från redan var godkänd.

Samma deterministiska verktyg når den skalan på tre sätt, alla med identisk, förgodkänd utdata:

- <!--i:people--> **En person, i appen.** `/pro`-batchrutnätet: klistra in eller importera raderna, få en färdig tillgång per rad, ladda ner zip-filen. Ingen designkompetens, ingen beställning, ingen väntan.
- <!--i:code--> **En utvecklare, från kommandoraden.** CLI:n kör *samma* motor och *samma* renderväg headless, så verktyget kan köras i sekvens över alla 10 000 rader i ett skript eller en nattlig pipeline. Ett `lolly <tool> --field=…`-anrop i en loop är hela integrationen.
- <!--i:cpu--> **Ett system eller en AI-agent, via MCP.** Samma verktyg drivet programmatiskt, med samma fidelitet och ännu större skala - eftersom en maskin inte tröttnar medan tusentals filer rullar in.

![Satsläge på en ny installation: en tom rad som väntar på ett verktyg, med hela kalkylbladsytan och dess Rendera-knapp på plats innan någon data kommit in](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

En uppsättning varumärkesbegränsningar, fastställd en gång av en designer; tre vägar till identisk förgodkänd utdata - och maskinvägen skalar längst av alla, eftersom den aldrig tröttnar medan filerna rullar in.

---

## Helheten: hur lagren passar ihop

Allt härifrån och nedåt är arkitektur. Diagrammet är hela systemet i en vy: verktyg är
data överst, motorn i mitten vet inget om någon plattform, skalen under den
implementerar ett kontrakt, och katalogerna levererar innehållet.

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

### Förvarsstruktur

Innehåll monteras som paket: `community/`, `docs/`, varje `shells/*`, både `services/*` och `brands/suse` är var och en sitt eget förvar, utcheckat som git-submoduler av det här. Föräldern äger `engine/`, `schemas/`, `scripts/`, `tests/`, `api/`, `brands/lolly-start/` och `profiles.json`. Se [Byggguide » Hämta källkoden](/info/build-guide.html) för utcheckningskommandot och arbetsflödet mellan förvar.

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

## Plattformens leveransmodell

Plattformen körs på flera ytor - webb-PWA, Tauri desktop/mobil, det skriptbara CLI:t och det interaktiva TUI:t. Alla använder samma motor och samma verktygsfiler.

### Webb (PWA) - primär distribution
Hostad på en SUSE-kontrollerad URL. Fungerar offline när service workern har cachat verktyg och tillgångar. Det är här de flesta anställda, leverantörer och partners kommer att använda plattformen. Inget konto krävs - tillstånd lagras i IndexedDB per enhet.

Webbskalet är responsivt från en enda layout. På desktop är ett verktyg ett storleksbart kontrollsidofält bredvid en förhandsvisningsyta med trackpad-inbyggd duknavigering (Cmd/Ctrl-hjul eller nypa för att zooma kring pekaren, mellanslag- eller mittendrag för att panorera, `0`/`1`/`+`/`−`-tangenter och en Fit/%-HUD). På mobil (≤640px) blir kontrollerna en toppförankrad panel med ett draghandtag som fäster vid peek/half/full (tryck växlar) över en statisk fullskärmsförhandsvisning, och en flytande **Render**-knapp öppnar **Export**-kontrollerna i en bottenpanel-popup. Touch får nyp-zoom och dragpanorering på förhandsvisningen. Renderväg och exportkontroller är identiska mellan de båda - bara chromet flödar om.

![Delad skrivbordsvy - kontroller genererade från manifestet till vänster, den levande arbetsytan till höger](/t/url-shot?url=%2F%23%2Ftool%2Fchart-creator&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=aud-web-split)

Samma verktyg i telefonbredd, utan en andra layout att underhålla: kontrollerna blir ett ark högst upp, förhandsvisningen tar hela skärmen och rendera-knappen flyter ovanpå.

![Ett audiogram på en 430px bred skärm - kontrollarket ovanför, det färdiga kvadratiska konstverket nedanför och den svävande rendera-pillen](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

**Batchläge (`/pro`).** Webbskalet levererar också ett kalkylbladsliknande batch-rutnät (`shells/web/src/pro/`) som renderar många rader samtidigt över ett eller flera verktyg. Det hanterar CSV/TSV-tur-och-retur plus inklistring från kalkylblad, mall/format/storlek/enhet/dpi per rad, en sidopanel för blockredigering med levande förhandsvisning, hopfällbara exportkolumner, en relevanstaggrad per rad, dragreglage till vänster för radordning, tvåstegsbekräftelse för borttagning, sparade batch-sessioner och en `.zip`-nedladdning. Det här är den en-till-många-ytan bakom positioneringen "generering av innehåll i massor".

### Tauri skrivbord / mobil
Paketerad nativ app (litet fotavtryck via Tauri). Ger fullständig offlinetillgänglighet, filsystemsåtkomst för CLI-beroende verktyg (PDF Smasher, Font Outliner) och kameraåtkomst. Planerad för verktygsförbättring i mitten av 2026.

### CLI
`lolly <tool-id> [--input=value ...] --output=file.png`

Skrivbordsanvändare kan anropa många verktyg från terminalen. CLI-skalet laddar samma motor, skapar en jsdom-DOM, kör samma renderväg och skriver filen. URL-läge är transporten - CLI är inte en separat implementation. Detta garanterar att CLI- och GUI-resultat är identiska.

```bash
lolly qr-code --url=https://suse.com --output=qr.svg
lolly quotes --quote="Ship it." --output=quote.png
lolly                        # lists available tools
lolly qr-code                # lists inputs for that tool
```

### TUI
`npm run tui`

Den interaktiva motsvarigheten till CLI: en fullskärms, tangentbordsstyrd terminalapp (byggd på Ink) för att bläddra bland verktyg, fylla i indata, spara projekt och exportera - allt utan ett GUI. Dess värdbrygga **återanvänder CLI:ns implementation** för de DOM-fria formaten (SVG/EMF/EPS/HTML + text/data), och lägger till tillstånd på disk under `~/.lolly` plus en valbar inbäddad förhandsvisning. Utöver det har den en **webbläsarrendernivå**: en avgränsad huvudlös Chromium (samma som MCP-servern installerar) som producerar raster/PDF/video och fångst av levande URL:er på begäran - genom att driva en byggd kopia av webbskalet så att resultatet är identiskt, och som bara startar när du första gången exporterar ett sådant format. Så `url-shot` (med beskärning + omfärgning och vektor-PDF/SVG) och varje raster/pdf-verktyg körs också i terminalen. Se [TUI-guiden](/info/tui.html).

Oavsett vilken yta du befinner dig på är instrumentpanelens flik Capabilities den fullständiga kartan över vad plattformen deklarerar att den kan göra, grupperad och läsbar utan att öppna ett enda verktyg.

---

## Verktygskategorier

Verktyg taggas med en `category` i sitt manifest för gruppering i galleriet.

Raderna listas i galleriets sektionsordning. Sektionen `utility` renderas alltid **sist** i galleriet (efter varje annan kategori, inklusive framtida sådana) - det är lådan "Offline Utilities" på enheten.

| Kategori | Exempel | Planerat |
|---|---|---|
| `everyone` | QR Code Generator, Quote Card, Email Signature, Logo, Wordmark, Audiogram, Battlecards, Sequence Studio, Record | Employee Image Stationery |
| `designer` | Brand Lockup, Design, Chart, Darkroom, Filter, Pose Geeko, Multi-Page PDF | Font Outliner |
| `event` | Meeting Planner, Event Name Badge, Wayfinding Signage, Calendar ICS, Booth Studio | Event Stationery, Bulk Name Badges, Room Agenda Cards |
| `product` | - | CVE Alert, Product Release Announcement, Blog OG Image |
| `utility` | Strip Hidden Data, Text Helper, Compress PDF, Convert Image, Convert Font, Redact, Run Web Code, Screen Capture, URL Screenshot | Enhets-/formatkonverterare, fler integritetsverktyg på enheten |

De cellerna är **exempel, inte inventarier**. Vilka verktyg som finns är en egenskap hos profilen du monterat, inte hos den här sidan: ett varumärkespaket lägger till sina egna och kan utesluta ett community-verktyg det hellre inte levererar. `catalog/tools/index.json` - genererad från manifesten och registret som galleriet faktiskt läser - är den auktoritativa listan; för att räkna vad en profil monterar, räkna manifesten (`ls community/*/tool.json brands/*/tools/*/tool.json`) i stället för att lita på ett tal skrivet här. (Ett verktygs-id som finns i två paket monteras en gång, från det vinnande paketet.)

Verktyg klassificeras också efter status: `official` (godkänt av varumärket, ingen vattenstämpel), `community` (externt bidrag), `experimental` (vattenstämplade exporter). Största delen av biblioteket är `official`; de nyare studiorna och fångstverktygen tenderar att ligga på `community` eller `experimental` medan de sätter sig. Varje yta visar märket, så en läsare vet vad de plockar upp innan de öppnar det - och precis som kategoriellerna ovan rör sig medlemskapet per status för snabbt för att räknas upp här. Läs av det i galleriet eller det genererade indexet.

**Design** är det första verktyget byggt på det chromelösa direktmanipuleringsläget `render.layout: "editor"` - en fri arbetsyta där du drar, ändrar storlek på, roterar och snäpper fast rutor med text, former och bilder, och sedan exporterar via samma renderväg som varje annat verktyg.

**Strip Hidden Data** är det första **verktyget på enheten** (`privacy: "on-device"`): ett innehållsomvandlande verktyg som tar en fil *du* tillhandahåller, bearbetar den helt i webbläsaren och lämnar tillbaka en ren kopia - aldrig uppladdad, aldrig vattenstämplad, ingen proveniens stämplad. **Text Helper** är det andra - en bänk på enheten för vardagliga klistra-in-på-en-webbplats-uppgifter (JSON-formatering, JWT-avkodning, Base64, URL-kodning/avkodning, SHA-hashning). **Compress PDF** är det tredje - det krymper en PDF genom att komprimera om dess bilder, återigen helt på enheten. Märket och dess badgetext "Runs on your device - nothing is uploaded" täcker nu hela omvandlingsuppsättningen: Strip Hidden Data, Text Helper, Compress PDF, **Convert Image** (HEIC/TIFF/AVIF → WebP/JPG/PNG), **Convert Font**, **Redact** (förstör områden av en bild, SVG eller PDF), **Prompt to Image** och **Rebrand a Deck** (byt tema på en `.pptx` på plats) där profilen monterar det. Det här är en integritetsverktygskategori som ersätter att lämna över konfidentiella filer till webbplatser med ett enda syfte.

![Utilities-lådan, där varje kort är ett verktyg som omvandlar en fil du redan har](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=aud-utilities)

> Obs: `category` och `status` denormaliseras till `catalog/tools/index.json` (registret som galleriet läser) från varje `tool.json`. Manifestet är sanningskällan - indexet är **genererat** av `npm run build:catalog` och `npm run validate:catalog` misslyckas i CI om det incheckade indexet avviker från manifesten.

---

## Arkitektoniska åtaganden

De här besluten är fastslagna. Att ändra något av dem är ett stort företag - de formar varje annat beslut i kodbasen.

### 1. Deklarativa verktyg, med en imperativ nödutgång

Ett verktyg är ett manifest (`tool.json`) + en mall (`template.html`) + valfri `hooks.js`.

**Manifestet deklarerar indata.** Inte mallen. Indata härleds inte från Handlebars-token. Manifestet är kontraktet; mallen konsumerar namngivna variabler via `{{id}}`.

![Street Maps kontrollstack - en stadsrullgardin, ett temaval, viktreglage och färgutlösare, var och en av dem hämtad från en manifestrad](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

**Hooks är valfria.** De flesta verktyg är rent deklarativa - manifest + mall räcker. Verktyg som behöver beräknade värden (QR-kodning, formning av diagramdata) tillhandahåller `hooks.js` som exponerar namngivna livscykelfunktioner (`onInit`, `onInput`, `onFrame` - hooken per bildruta för levande kamera för rörelsereaktiva verktyg - `onLevel`, `beforeExport`, `afterExport`, `exportFile` - fil-in/fil-ut-omvandlingsvägen som används av verktyg på enheten som Strip Hidden Data - och `exportStill`, för ett verktyg som äger sin egen djupa raster). Värden laddar hooks via `new Function('host', …)` med kapabilitetsbryggan injicerad som stängningsomfång. Detta är ett **portabilitetskontrakt, inte en säkerhetssandlåda**: hooks körs fortfarande i sidans realm och *kan* nå `window`/`fetch`/`document` i ett webbläsarskal - `host.*` är den understödda, portabla ytan, inte en tvingad gräns. Asynkrona hook-resultat tidsboxas (`onInit` 5s, `onInput` 2s, `beforeExport`/`afterExport` 5s, `exportFile`/`exportStill` 10s) och sena resultat kastas; en skenande *synkron* hook kan inte avbrytas. Opålitlig tredjeparts-hook-kod är därför inte säker att köra förrän Worker-isolering levereras.

Detta spelar roll eftersom: deklarativa verktyg kan skapas av icke-utvecklare. Om varje verktyg vore en webbapp blir riskanmärkningen "begränsad kompetens för att skapa/underhålla arbetshästmallar" en permanent flaskhals.

### 2. Verktyg och tillgångar är data, inte paketerad kod

Webb- och Tauri-apparna hämtar verktygs- och tillgångskataloger från en känd URL vid uppstart, cachar dem lokalt och arbetar med det som finns där. **Att lägga till en ny händelseruta eller säsongstillgång kräver ingen appversion.**

Tillgångsbytes SHA-256-checksummeras för att förhindra CDN-förgiftning. Tillgångens `id` + `version` styr cacheogiltigförklaring.

### 3. Kapabilitetsbryggan är det enda API:et verktyg ser

Verktyg rör aldrig DOM:en utanför sitt mallområde, anropar aldrig `fetch` direkt, läser aldrig filsystemet. De anropar versionerade `host.*`-metoder. Kontraktets kanoniska definition är `packages/core/src/host-v1.ts` - verktygsförfattar-SDK:n `@lolly-tools/core`, så en tredje part kan bygga mot den utan att vara beroende av motorn; `engine/src/bridge/host-v1.ts` är en typåterexport av den, och motor-/skalkod fortsätter att importera från den sökvägen oförändrat:

| Bridge API | Vad den gör |
|---|---|
| `host.profile` | Användarens förnamn, e-post, porträttbild, stad, etc. Förifyller indata via `bindToProfile`. |
| `host.assets` | Katalogfrågor, tillgångsupplösning, värdtillhandahållet väljargränssnitt. |
| `host.state` | Spara / ladda indataplatser. IndexedDB på webben, filsystem på Tauri, minne på CLI. |
| `host.clipboard` | Skriv text eller bild till urklipp (med plattformsfallbacker). |
| `host.export` | Rastrera eller serialisera rendermålet. Applicerar vattenstämpel för experimentella verktyg. |
| `host.net` | Tillåtelselistad fetch - endast tillgänglig om verktyget deklarerat kapaciteten `"network"`. (Inget levererat verktyg använder den för närvarande.) |

Valfria, additiva ytor visas endast när ett skal tillhandahåller dem. Vissa är **kapabilitetsspärrade** - exponerade endast när verktyget deklarerar matchande flagga: `host.compose` (bädda in ett annat verktygs render - `compose`), `host.capture` (sidfångst för URL Screenshot - `capture`) och `host.recorder` (mikrofon-/kamera-/skärmfångst för inspelningsverktygen - `microphone` / `camera` / `screen`). Resten är **funktionsdetekterade** - närvarande närhelst skalet kan tillhandahålla dem, med verktyget som behåller en fallback för skal som inte kan.

En handfull flaggskeppsytor, för att visa vad det täcker - [Host API](/info/host-api.html) dokumenterar var och en, och `packages/core/src/host-v1.ts` är själva kontraktet:

| Yta | Sedan | Vad det tillför |
|---|---|---|
| `host.tokens` | 1.0 | DTCG designtoken - varumärkets egna primitiv |
| `host.text` | 1.0 | Text-till-bana via HarfBuzz WASM (funktionsflaggan `wasm` markerar verktyg som är beroende av det) |
| `host.media` | 1.4 | Livebildrutor från kameran som driver `onFrame`-kroken. Progressiv förbättring, medvetet *inte* spärrad av flaggan `camera` - ett sådant verktyg fungerar ändå som ett vanligt stillbildsverktyg |
| `host.color` | 1.40 | Perceptuell färgmatematik: ΔEOK, WCAG- + APCA-kontrast, OKLab-ramper, klassbrytningar, kategoriska paletter, harmonischeman (1.60), CSS Color 4-mixning och gradientbakning (1.68). Ren och synkron - skalen kopplar in motorns `makeColorApi()` istället för att implementera något själva, så den kan inte glida iväg |
| `host.images` | 1.60 | Avkoda / ändra storlek / omkoda bytes på enheten - konverteringsvägen (HEIC → JPEG, komprimera till WebP, nedskalning). Levereras i webbskalet som en lat fasad, så HEIC-avkodaren hamnar aldrig i startbunten |
| `host.geom` | 1.64 | Exakt vektorgeometri: booleska bansoperationer, offset, kontur-till-fyllning, spline-nedgradering, förenkling, träffdetektering. Också ren, synkron och inkopplad från motorn (`makeGeomApi()`); fel *returneras*, kastas aldrig |

Resten följer samma regler och dokumenteras tillsammans med dem: `pdf` (1.8) och `pptx` (1.58) för dokumentkirurgi på enheten, `audio` (1.71) och `speech` (1.96) för klippanalys och TTS/transkribering på enheten, `viz` (1.72) för MilkDrop-platshållarkontraktet, `codec` (1.100) och `layers` (1.102) för djupbit- och lagerbitmapsutdata, `upscale` (1.101) och `matte` (1.103) för modellerna på enheten, `raster` (1.105) för hooks som gör eget pixelarbete, `connectors` (1.106) för exportsäkra pilar och `c2pa` (1.85) för signering av färdiga bytes. Antalet växer; reglerna gör det inte.

De deklarerbara kapaciteterna är: `network`, `filesystem`, `clipboard`, `camera`, `microphone`, `screen`, `ffmpeg`, `wasm`, `capture`, `compose`. (`screen`, tillagd i 1.54, är skärmfångst via `host.recorder` - användaren väljer en skärm/ett fönster/en flik i webbläsarnativt gränssnitt; skild från `capture`, som rastrerar en URL som verktyget själv namnger.)

Samma verktyg körs i webbläsare, Tauri och huvudlös CLI eftersom varje skal implementerar det här gränssnittet - verktyget vet aldrig vilket det befinner sig i.

Bryggan är versionerad. Att lägga till metoder är en mindre version. Att ta bort eller ändra signaturer är en stor versionsuppgradering. När v2 levereras måste v1 fortsätta fungera.

### 4. Tillgångs-ID:n är för evigt

`suse/logo/primary` är ett kontrakt. Väl publicerat:
- ID:t ändras aldrig, återanvänds aldrig.
- Byteändringar → höj `version` i manifestet.
- Ersatt av en ny tillgång → sätt `deprecated: true` och valfritt `replacedBy`.
- Befintliga referenser löses alltid upp.

Detta gör sparade verktygstillstånd och URL-delade länkar hållbara över åren.

### 5. URL-läge är förstklassigt

Varje indata måste kunna uttryckas som en URL-parameter:

```
lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H
```

![Den länken för sig själv, utan något annat i den, är den färdiga tillgången](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fsuse.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

CLI-läge är URL-läge under en annan transport - CLI-skalet bygger ett URL-tillståndsobjekt från argv och kör **samma** motorpipeline. Det finns en renderväg. CLI kan inte glida isär från GUI eftersom det inte är en separat implementation.

`url-mode.ts` hanterar tur-och-retur (tolkning och serialisering). En uppsättning **reserverade parametrar** vidarebefordras aldrig till verktyget som indata: utdatakontrollerna (`format`, `export`, `copy`, `filename`, `width`/`w`, `height`/`h`, `unit`, `dpi`), tryck- och proveniensratten (`bleed`, `marks`, `profile`, `password`, `c2pa`, `imprint`, `durable`, `meta`, `hdr`, `depth`, `cuts`) och tillståndsbärarna (`template`, `z` - den packade token för "Kortaste länk" - och `zx`, samma krypterad under ett lösenord). Uppsättningen `RESERVED` i `engine/src/url-mode.ts` är auktoriteten och fastställs av ett test; [URL Mode](/info/url-mode.html) dokumenterar var och en av dem, inklusive den handfull som inte listas här. Tillgångsindata i URL-läge serialiseras med sitt `id`; körtiden löser upp dem via `host.assets.get()` före hydrering. `width`/`height` är värden i `unit` (standard `px`, även `mm`/`cm`/`in`/`pt`/`pc`); med en fysisk enhet sätter `dpi` rasterupplösningen. De sätter arbetsytans dokumentstorlek och förifyller exportdimensionspanelen.

Eftersom varje indata reser i länken är en parameterändring en annan färdig tillgång. Hela den här paletten är en fröfärg, en harmoni och ett stegantal:

![Nio steg genom fyra nyanser, alla framodlade ur samma frökulör som bärs i länken](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

### 6. Lagring går via bryggan, inte direkt

Webbskal: IndexedDB. Tauri: filsystem. CLI: i minnet. Verktyg ser bara `host.state.save(slot, data)` och `host.state.load(slot)`. `localStorage` används inte - det är för litet och kan inte lagra blobbar.

Användare kan spara flera namngivna redigeringsplatser per verktyg och återgå till varje session senare. Inget konto krävs; tillståndet är per enhet. Eftersom bryggan är den enda sömmen är det tillståndet per enhet också *portabelt*: `shells/web/src/data-transfer.ts` läser tillbaka allt via `host.profile`/`host.state`/`host.assets` till en enda `lolly-backup`-zip som importeras på vilken annan installation som helst - offlinesvaret på att "flytta till en ny enhet" som inte kräver någon server (fullständig spec: `docs/data-transfer.md`). SUSE ID-integration (synk mellan flera enheter) är en framtida milstolpe ovanpå detta.

### 7. Mognadstaggar besvarar risken för "varumärkesgodkänt" genom design

Varje verktyg deklarerar `status: official | community | experimental` i sitt manifest. Galleriet sorterar efter status. Experimentella verktyg vattenmärker sina exporter automatiskt - vattenmärket appliceras av `host.export.render`, inte av verktyget, så det kan inte väljas bort av en icke-officiell verktygsförfattare.

Detta är ett strukturellt svar på riskuppfattningen att användning av ett verktyg innebär varumärkesgodkännande. Processlösningar (en granskningskö, SUSE ID-gate) lägger sig ovanpå.

### 8. Verktygsindata typas via manifestet, inklusive tillgångar

Indata deklarerar en `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` och `file`. Värden renderar en generisk kontroll per typ utifrån manifestet - verktyg skriver noll kontrollkod. (Förifyllning från användarens profil är inte en typ - vilken indata som helst kan bära `bindToProfile`.) Tre väger tyngre än resten:

- **`asset`** (med `filter` och `allowUpload`) är bryggan till det globala tillgångssystemet; `allowUpload: false` är spaken för varumärkesefterlevnad för saker som sponsorplatta-loggor där bara biblioteksresurser tillåts. Användaruppladdningar använder samma `AssetRef`-form som biblioteksresurser, så verktyg hanterar dem identiskt.
- **`blocks`** är en upprepande fältgrupp - en minitabell inuti en enda indata, redigerad i en sidopanel, med en typad/diskriminerad läggtillmeny och tillgångsfält per block. Att klicka på ett renderat block på ytan fokuserar det blockets rad. Används av `meeting-planner`, `chart-creator`, `event-name-badge`, `wayfinding-signage`, `color-block` och `digi-ad`.
- **`vector`** grupperar en fast uppsättning tal (t.ex. en transform) till en sammansatt kontroll; **`file`** håller användarens egen fil som bytes i minnet för transformverktyg på enheten (t.ex. `strip-data` och `compress-pdf`).

### 9. Mallar är logiklösa (Handlebars, inte EJS)

Handlebars valdes framför EJS medvetet:
- Logiklöst. Mallar kan skapas av icke-utvecklare.
- Säkert som standard. `{{x}}` HTML-escapar; `{{{x}}}` är opt-in rått.
- Ingen godtycklig JS i mallar innebär ingen XSS-granskningsyta per mall.

Logik bor i `hooks.js` där den är explicit och granskningsbar. Tillgängliga Handlebars-hjälpare: `{{default}}`, `{{upper}}`, `{{lower}}`, `{{eq}}`, `{{markdown}}`, `{{asset ref}}`, `{{asset ref "property"}}` (plus dataformat-hjälpare `icsStamp`/`rfcText`/`csvCell` som används av systermallar av typen `.ics`/`.vcf`/`.csv`).

### 10. Verktyg komponerar verktyg

Ett verktyg kan bädda in **ett annat** verktygs rendering utan importer mellan verktyg - komposition löses av motorn, aldrig av verktygskod. Det finns två ytor:

- **Deklarativt manifest** - `composes: [{ id, tool, inputs, format?, width?, height? }]`. Motorn renderar det namngivna barnet och placerar resultatet i den logiklösa mallen som `{{asset <id>}}`. `event-name-badge` komponerar `qr-code` som en SVG i dag.
- **Portabel inbäddnings-URL** - `<img src="https://lolly.tools/tool/<id>.<ext>?<inputs>">`. Skalet renderar det barnet **lokalt** (en platshållarpixel visas tills den lokala renderingen är klar); inget hämtas någonsin från `lolly.tools`.

Komponera vilket verktygs rendering som helst: ett **SVG**-barn förblir en äkta vektor när föräldern exporterar till SVG eller PDF och rastreras skarpt för PNG; **PNG/JPG/WEBP**-barn bäddas in som bilder. Kräver `compose`-förmågan. Komponerade barn är mellansteg - aldrig vattenmärkta eller ursprungsstämplade - och komposition degraderar smidigt: ett skal som inte kan rendera ett barn utelämnar bara platsen och föräldern renderas ändå.

---

## Vad vi uttryckligen valde att inte göra

- **Ingen EJS / ingen godtycklig JS i mallar.** XSS-ytan är noll. Logiken finns i `hooks.js`.
- **Inget obligatoriskt CMS för tillgångar.** Enskilda tar in sina egna kreativa filer direkt i sin katalog i appen (vyn [Katalog](/info/using.html) och Brand Studio) - ingen server, ingen adminkonsol. Arbete lämnas vidare som en **session**: en delningslänk bär hela tillståndet, och samma session följer med i en säkerhetskopia eller via en samarbetssession. Den som styr driftsättningen kan sedan låsa fast en delad session som en **mall** - öppna länken, spara dess värden som en mallpost i det verktygets katalog i varumärkespaketet och commita - varefter den dyker upp i verktygets väljare "New from template" och kan djuplänkas som `?template=<id>`. Git är driftsättningsägarens låsningssteg, aldrig skaparens. För en *delad, styrd* katalog **kan** en organisation hantera tillgångskatalogen på samma sätt och grinda uppdateringar genom PR-granskning - en tillgänglig styrningsmodell, inte ett krav i appen.
- **Ingen påtvingad RBAC.** Den öppna appen är öppet tillgänglig som standard; varumärkesrisk hanteras genom mognadstaggar och vattenstämplar. En organisation som vill ha striktare kontroll lägger på sin egen autentisering och den git-granskade katalogen ovan.
- **Ingen central databas.** Allt användartillstånd är per enhet. SUSE ID-integration finns på färdplanen men är ingen lanseringsspärr.
- **Ingen delad kodväg för verktyg/motor.** Motorn är öppen källkod, och det är även de varumärkesneutrala verktygen i `community/`; ett varumärkespaket som det privata `brands/suse/` bär sina egna verktyg och sin egen katalog på egna villkor. Oavsett vilket upprätthålls separationen (inga korsimporter från `engine/` till verktygsinnehåll) så att uppdelningen förblir ren.

---

## Livscykel, från början till slut

En användare öppnar `lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H`:

1. **Uppstart.** Webbskalet öppnar IndexedDB, bygger förmågebryggan, synkar verktygs- och tillgångskatalogerna (eller laddar från cachen offline).
2. **Routning.** URL-hash → `tool`-vy, med `qr-code` och URL-parametrar extraherade.
3. **Laddning.** `loadTool('qr-code', fetchFile)` hämtar `tool.json`, validerar mot JSON-schemat, hämtar `template.html`, `styles.css` och källkoden för `hooks.js`.
4. **Tolka URL-tillstånd.** `parseUrlState` översätter URL-parametrar till initiala indatavärden. Tillgångsreferenser (`?logo=suse/logo/primary`) tolkas som lättviktiga `{ id, _unresolved: true }`-objekt.
5. **Runtime.** `createRuntime(tool, host, initialValues)` bygger indatamodellen (slår ihop profildata, standardvärden och initiala värden), löser upp tillgångsreferenser via `host.assets.get()`, laddar hooks (`host` i closure-scope, inte sandboxat), anropar `hooks.onInit`.
6. **Rendering.** Skalet prenumererar på runtime; vid varje tillståndsändring tar det emot `{ model, hydrated }`. Det renderar indatakontroller från modellen och skriver den hydrerade mall-HTML:en till `#tool-canvas`.
7. **Interaktion.** Användaren skriver i en indata → `runtime.setInput(id, value)` → begränsningar tillämpas → `hooks.onInput` anropas → omhydrering → omrendering. Ytan uppdateras live.
8. **Export.** Användaren klickar Download(PNG) → `runtime.export(canvasNode, 'png')` → `host.export.render` (rastrerar via dom-to-image-more; SVG/PDF går via dedikerade DOM-vandrande vektoriserare) → blob → `host.export.download`. Formatintervallet ett verktyg kan välja är brett, och `render.formats`-enumet i `schemas/tool.schema.json` är auktoriteten för det - rastergrafik och flyttalsrastergrafik, vektorer och skärfiler, tryck/CMYK, rörelse, redigerbara dokument (`pptx`, `docx`, `odt`), palett- och data-/textutdata, ljud- och typsnittsfiler. [URL Mode](/info/url-mode.html) namnger varje id och vad det producerar. Ljud finns i det enumet precis som allt annat (`wav`, `mp3`, `m4a`, `opus`, deklarerat av ljudanimationen och inspelningsverktygen); separat driver ett inspelningsverktygs `render.capture`-läge `host.recorder`, vars tagning kommer som en färdig Blob i vilket behållarformat webbläsaren spelade in. (Verktyg som sätter `render.export: false` - t.ex. Color Palette, Countdown Timer, Strip Hidden Data, Text Helper, Compress PDF - döljer kontrollerna för nedladdning/format/dimension.) Fysiska enheter konverteras per format här (PDF → verkliga sidpunkter, raster → pixlar vid DPI med en `pHYs`-chunk). Upphovs-/proveniensmetadata (upphovsperson, verktyg, källa - byggd av `engine/src/metadata.ts`) bäddas in per format: PNG iTXt, JPEG EXIF, PDF-infoordbok, SVG `<metadata>`, GIF-kommentar. Experimentella verktyg får ett vattenmärke infogat av värden, inte av verktyget.

![Exportpanelen som `?options` öppnar: filnamnet och formatparet, utdatastorleken och kontrollerna som skriver filen](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Samma livscykel i Tauri. Samma livscykel i CLI - jsdom tillhandahåller den huvudlösa DOM:en; utdata går till en fil eller stdout.

---

## Status för öppen källkod

**Koden är MPL-2.0.** `engine/`, `shells/*`, `services/*`, `schemas/` och `docs/` är öppen källkod under **MPL-2.0** - en leverantörsneutral ställningsplattform för varumärkesverktyg, där varje leveransbar enhet ligger i sitt eget repository under [github.com/lolly-tools](https://github.com/lolly-tools).

**Verktygsinnehåll levereras som varumärkespaket**, vart och ett med sina egna villkor (se paketets `NOTICE.md`). `community/` är det publika [`lolly-tools`](https://github.com/lolly-tools/lolly-tools)-repositoryt, och dess varumärkesneutrala verktyg är också MPL-2.0. `brands/suse/` är det privata `suse-lolly`-paketet: SUSE-verktygen och SUSE-katalogen, **proprietär för SUSE**, inklusive dess licensierade PremiumBeat-musik. `brands/lolly-start/` är det tomma startvarumärket som det här repositoryt äger. Typsnitt levereras inuti ett paket under **SIL Open Font License 1.1** - SUSE-paketet bär typsnitten SUSE och SUSE Mono.

`tools/` och `catalog/` i repots rot är gitignorerade *vyer*: en profil bygger ihop dem från `community/` plus det aktiva varumärkespaketet, vilket är varför varje skript och skal läser just dessa två sökvägar och aldrig ett paket direkt.

Uppdelningen upprätthålls - det finns inga korsimporter från `engine/` till verktygsinnehåll - så gränsen mellan plattform och innehåll förblir ren.

---

## Där motorn slutar och värden börjar

Om du kan beskriva det i ren data + Handlebars → **motor**.
Om det rör DOM, filsystem, nätverk eller något webbläsar-/OS-API → **värd**.

Gränsen är skarp med flit. Motorn är den öppna källkodsdelen. Allt som vet om SUSE, specifika plattformar eller körtidsmiljöer hålls utanför den.

För nästa detaljnivå räknar [`engine/README.md`](../engine/README.md) upp varje motormodul och vad den ansvarar för, och [Hotmodell och tillitsgränser](/info/threat-model.html) dokumenterar var samma gräns även fungerar som en tillitsgräns.
