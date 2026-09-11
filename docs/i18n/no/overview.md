# Oversikt

![Lolly-ikon - Stor grønn og hvit slikkepinne](/info/icon.svg)

Dette dokumentet fanger opp formålet, strukturen og de arkitektoniske avgjørelsene for Lolly-plattformen. Det gjenspeiler både produktvisjonen og den nåværende tilstanden til kodebasen.

> **Status:** Lolly er en intern prototype i en **lukket pilot som ikke er fullført**. Motoren er deterministisk og internt konsistent, men produktet er tidlig - SUSE er kunde nummer én - og kryptografi- og filtolkningsmotorene gjennomgår for tiden SUSEs strenge infrastrukturherding, i forberedelse til virksomhetsskala (vi er veldig gode på dette). Les arkitekturen nedenfor som designintensjon under test, ikke et ferdig, sertifisert produkt. Se [Adoption & Governance](/info/adoption-governance.html#status) for hvordan piloten drives og måles.

> **Hvordan lese denne siden.** Den inneholder to typer materiale, i rekkefølge. Den første halvdelen er
> **hvorfor dette finnes**: problemet, posisjoneringen og livssyklusen en enkelt ressurs beveger seg
> gjennom. Fra [Det store bildet](#the-big-picture-how-the-layers-fit) og utover er det
> **hvordan lagene passer sammen**: arkitekturdokumentet for bidragsytere, som dekker engine/shell/pack-
> separasjonen, repository-oppsettet, leveringsmålene og forpliktelsene som begrenser hver
> endring av plattformen. Hvis du er her for å endre kodebasen fremfor å forstå
> produktet, start ved det store bildet.
>
> To følgesvenner går dypere enn denne siden gjør. [`engine/README.md`](../engine/README.md) i
> repositoryet er modul-for-modul-kartet over motoren, med en generert tabell over hver modul og
> hva den tolker eller skriver. [Threat Model & Trust Boundaries](/info/threat-model.html)
> er den samme arkitekturen lest som tillitsgrenser, og det er den rette siden for ethvert spørsmål om
> hva motoren behandler som ikke tiltrodd.

---

## Hvorfor dette finnes

Team møter et tilbakevendende problem: repeterbart kreativt og innholdsmessig arbeid som er for forutsigbart til å rettferdiggjøre kyndige hender hver gang, men for kvalitetsfølsomt til å overlates uten sikkerhetsnett. Resultatet er enten lav gjennomstrømning (spesialistflaskehals), inkonsistens (folk som bruker det verktøyet de har for hånden) eller leverandørlåsing (en SaaS-DAM som kontrollerer malene dine).

Denne plattformen er det direkte svaret:

> **Programmatisk kreativt innhold i stor skala** - ressursgenerering uten arbeidsinnsats, med reglene under sentral kontroll, for ansatte, leverandører og partnere.

Lolly er ikke stedet et designsystem blir oppfunnet - det er stedet det blir produsert. Tenk på det som en salgsautomat for design: gjør et valg, få et resultat. Hver gang. Motoren jobber for den høyeste kvaliteten hvert format kan produsere på maskinvaren foran deg, og den samme motoren lager den samme filen på hver flate den leveres til.

Resultatet er **overflod**: hvert arrangement har korrekt skilting, hvert CVE-varsel matcher husstilen, hver etikett skrives ut rent, hver e-postsignatur er oppdatert - alt uten en designsak. Plattformen håndterer tilbakevendende, operasjonalisert kreativt arbeid. Det er bevisst ikke et skreddersydd kreativt verktøy - designere eier fortsatt flaggskipsarbeidet.

### Innoverer probabilistisk, skalerer deterministisk

Enhver diskusjon om KI i en kreativ pipeline stanser opp ved det samme spørsmålet: hvilken del av dette er maskinens jobb? Det er et gammelt spørsmål med et avklart svar. Skrivere og illuminatorer arbeidet allerede mellom to instrumenter - den løse skissen, der ingenting var fastlagt og alt kunne prøves, og trykkpressen, skremmende nettopp fordi den forpliktet. Skissene var der kunsten skjedde. Pressen var hvordan den nådde noen. Ingen forvekslet de to, og begge fortsatte å utvikle seg - ny blekk, nye typesnitt, nye presser - hver forbedring i harmoni med håndverket og intensjonen den tjente.

Lolly trekker den samme linjen. Utforsk probabilistisk: en modell, en designer, en løs idé, en prompt som havner et sted ingen planla. Skaler så deterministisk - det som når ti tusen outputs er et *verktøy*, og et verktøy rendrer på samme måte hver gang ut fra input du kan lese. Utforskningen forblir fri fordi ingenting nedstrøms er avhengig av at den lander likt to ganger. Resultatet fortjener tillit fordi det ikke er en gjetning. Å få KI-eksperimentering inn i forutsigbare, reproduserbare resultater er ikke en ny disiplin; det er den samme arbeidsdelingen som gjorde trykt arbeid verdt å stole på i utgangspunktet.

> Stol på den kreative prosessen, skaler med presisjon.

### Sammenlignet med alternativene

::: figure positioning-comparison
Funksjonsfullstendighet på tvers av dagens kreative verktøy, undersøkt august 2026. Poengsetting: 0 fraværende, 25 omvei-nivå, 50 reell, men avgrenset eller delvis, 75 sterk med forbehold, 100 kjernekompetanse.
:::

Gapet er tydelig: ingenting som leveres i dag gir oss begrensningsstyrt, offline-kapabel, lavterskel, internt tilgjengelig output. Lolly inkluderer til og med et åpent lerret - **Design** - der farger, typografi og ressurser følger merkevarens globale innstillinger, slik at fri utforming forblir begrensningsstyrt. Det den **ikke** er, er en ubegrenset designpakke: designere fortsetter å bruke Illustrator og Figma til skreddersydd flaggskipsarbeid. Permutasjoner kan settes sammen med dette verktøyet.

![Hvert verktøy i biblioteket som et kort, gruppert etter kategori, slik at en produsent velger ett og starter](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=aud-gallery-landscape)

**Bruk det til:** Rask generering av operasjonaliserte kreative ressurser - arrangementsflis, navneskilt, signaturer, CVE-varsler, QR-koder, sosiale kort, forsendelsesetiketter, strukturerte rapporter.

**Ikke bruk det til:** Skreddersydd hero-innhold.

---

## Livssyklusen til en kampanje

Den klareste måten å se hva Lolly er, er ikke en funksjonsliste - det er å følge én enkelt ressurs mens den går fra hånd til hånd. Se hvordan ett lokalisert kampanjekort beveger seg gjennom organisasjonen:

1. **Den kreative setter reglene.** En designer lager basmalen i Design-verktøyet, og hardkoder merkevarens typografi- og fargevariabler. De lager ikke ett kort - de gjør grunnarbeidet *én gang* slik at de aldri trenger å håndlokalisere det igjen.
2. **Utvikleren skalerer det.** Den samme malen kobles inn i en nattlig pipeline gjennom CLI-en, slik at et nytt diagram eller en ny språkvariant genereres automatisk - ingen designer åpner filen på nytt.
3. **Produsenten bruker det bare.** En selger, offline på et fly, åpner det samme verktøyet og genererer en perfekt merkevaretro presentasjon til et kundemøte. Ingen designkompetanse, ingen nettverk, ingen venting.

Det "nye diagrammet" i trinn to er en rendring som denne, produsert fra en datastreng og en håndfull parametere uten at noen åpner en designfil:

![Et stablet arealdiagram med tittel, der de tre seriene er farget i en kjølig palett, med akser, tegnforklaring og tittel plassert av malen i stedet for for hånd](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Poenget er ikke at Lolly er bra for designere *og* bra for utviklere *og* bra for salg, hver for seg i et vakuum. Det er et **stafettløp**: den kreatives innledende arbeid skaleres av utvikleren, som igjen setter produsenten i stand. Den friksjonsfrie opplevelsen for den ikke-tekniske selgeren på flyet er bare *mulig* på grunn av presisjonen designeren fastsatte og utvikleren tok i bruk.

Det er kraftmultiplikatoren. Lolly er ikke en skuff med separate verktøy for separate roller - det er én deterministisk ressurslivssyklus som hver rolle berører, og hver hånd den går gjennom multipliserer verdien av den forrige.

---

## Én godkjenning, ti tusen ressurser

Fordi godkjenningen ligger i verktøyet og ikke i filen (se [Hvordan Lolly sammenlignes](/info/positioning.html)), slutter skala å være et gjennomgangsproblem. Godkjenn et lokalisert verktøy for sosiale kort én gang, generer deretter **10 000 ressurser på 12 språk** fra et regneark - og ikke én av dem trenger en ny compliance-sjekk fra jus eller merkevare, fordi malen de alle kommer fra allerede var godkjent.

Det samme deterministiske verktøyet når den skalaen på tre måter, alle med identisk, forhåndsgodkjent output:

- <!--i:people--> **En person, i appen.** `/pro`-batchrutenettet: lim inn eller importer radene, få én ferdig ressurs per rad, last ned zip-en. Ingen designkompetanse, ingen sak, ingen venting.
- <!--i:code--> **En utvikler, fra kommandolinjen.** CLI-en kjører *samme* motor og *samme* rendringsvei uten grensesnitt, slik at verktøyet kan kjøres i sekvens over alle 10 000 radene i et skript eller en nattlig pipeline. Et `lolly <tool> --field=…`-kall i en løkke er hele integrasjonen.
- <!--i:cpu--> **Et system eller en KI-agent, over MCP.** Det samme verktøyet betjent programmatisk, med samme troskap og enda større skala - fordi en maskin ikke blir lei mens tusenvis av filer ruller inn.

![Batch-modus på en fersk installasjon: én tom rad som venter på et verktøy, med hele regnearkflaten og Rendre-knappen på plass før noen data ankommer](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

Ett sett merkevarebegrensninger, fastsatt én gang av en designer; tre veier til den identiske, forhåndsgodkjente outputen - og maskinveien skalerer lengst av alle, fordi den aldri blir sliten mens filene ruller inn.

---

## Det store bildet: hvordan lagene passer sammen

Alt herfra og nedover er arkitektur. Diagrammet er hele systemet i én visning: verktøy er
data øverst, motoren i midten vet ingenting om noen plattform, skallene under den
implementerer én kontrakt, og katalogene leverer innholdet.

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

### Repository-oppsett

Innhold monteres som pakker: `community/`, `docs/`, hver `shells/*`, både `services/*` og `brands/suse` er hver sitt eget repository, sjekket ut som git-submoduler av dette. Foreldrerepositoryet eier `engine/`, `schemas/`, `scripts/`, `tests/`, `api/`, `brands/lolly-start/` og `profiles.json`. Se [Build Guide » Getting the source](/info/build-guide.html) for utsjekkingskommandoen og arbeidsflyten på tvers av repositorier.

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

## Leveringsmodell for plattformen

Plattformen kjører på tvers av flere overflater - web-PWA, Tauri desktop/mobil, den skriptbare CLI-en og den interaktive TUI-en. Alle bruker den samme motoren og de samme verktøyfilene.

### Web (PWA) - primær distribusjon
Hostet på en SUSE-kontrollert URL. Fungerer offline når service worker har mellomlagret verktøy og ressurser. Dette er der de fleste ansatte, leverandører og partnere vil bruke plattformen. Ingen konto kreves - tilstand lagres i IndexedDB per enhet.

Web-skallet er responsivt fra ett enkelt oppsett. På desktop er et verktøy et størrelsesjusterbart kontrollsidefelt ved siden av en forhåndsvisningsscene med trackpad-native lerretsnavigasjon (Cmd/Ctrl-hjul eller knip for å zoome rundt markøren, Mellomrom- eller midtre-dra for å panorere, `0`/`1`/`+`/`−`-taster og en Fit/%-HUD). På mobil (≤640px) blir kontrollene et toppforankret ark med et draghåndtak som smetter mellom peek/halv/full (tap veksler) over en statisk fullskjerms forhåndsvisning, og en flytende **Render**-knapp åpner **Export**-kontrollene i en bunnark-popup. Berøring gir knip-zoom og dra-panorering på forhåndsvisningen. Rendringsveien og eksportkontrollene er identiske på tvers av begge - bare rammen flyter om.

![Delt visning på desktop - kontroller generert fra manifestet til venstre, det levende lerretet til høyre](/t/url-shot?url=%2F%23%2Ftool%2Fchart-creator&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=aud-web-split)

Samme verktøy i telefonbredde, uten et andre layout å vedlikeholde: kontrollene blir et ark øverst, forhåndsvisningen fyller hele skjermen og render-pillen flyter over den.

![Et audiogram på en 430px bred skjerm - kontrollarket over, det ferdige kvadratiske kunstverket under og den flytende rendre-pillen](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

**Batch-modus (`/pro`).** Web-skallet leverer også et regnearklignende batch-rutenett (`shells/web/src/pro/`) som rendrer mange rader på én gang på tvers av ett eller flere verktøy. Det håndterer CSV/TSV-rundtur pluss innliming fra regneark, per-rad mal/format/størrelse/enhet/dpi, et sidepanel for blokk-redigering med levende forhåndsvisning, sammenleggbare eksportkolonner, en per-rad "relevans"-tagglinje, dra-håndtak for radomorganisering til venstre, to-trinns slettebekreftelse, lagrede batch-økter og nedlasting som `.zip`. Dette er en-til-mange-flaten bak posisjoneringen "masseproduksjon av innhold".

### Tauri desktop / mobil
Pakket, native app (lite fotavtrykk via Tauri). Gir full offline-tilgjengelighet, filsystemtilgang for CLI-avhengige verktøy (PDF Smasher, Font Outliner) og kameratilgang. Planlagt for verktøyforbedring midt i 2026.

### CLI
`lolly <tool-id> [--input=value ...] --output=file.png`

Desktop-brukere kan starte mange verktøy fra terminalen. CLI-skallet laster samme motor, oppretter et jsdom-DOM, kjører samme render-sti og skriver filen. URL-modus er transportmekanismen - CLI er ikke en separat implementasjon. Dette garanterer at CLI- og GUI-utdata er identiske.

```bash
lolly qr-code --url=https://suse.com --output=qr.svg
lolly quotes --quote="Ship it." --output=quote.png
lolly                        # lists available tools
lolly qr-code                # lists inputs for that tool
```

### TUI
`npm run tui`

Det interaktive motstykket til CLI: en fullskjerms, tastaturstyrt terminal-app (bygget på Ink) for å bla i verktøy, fylle ut inndata, lagre prosjekter og eksportere - alt uten en GUI. Vertsbroen dens **gjenbruker CLI-ens implementasjon** for de DOM-frie formatene (SVG/EMF/EPS/HTML + tekst/data), og legger til tilstand på disk under `~/.lolly` pluss en valgfri innebygd forhåndsvisning. Utover det har den et **nettleser-rendringsnivå**: en avgrenset, hodeløs Chromium (den samme som MCP-serveren installerer) som produserer raster/PDF/video og fanging av levende URL-er på forespørsel - ved å drive en bygget kopi av web-skallet slik at utdata blir identisk, og som først starter når du eksporterer et slikt format for første gang. Dermed kjører `url-shot` (med beskjæring + omfarging + vektor-PDF/SVG) og hvert raster/pdf-verktøy også i terminalen. Se [TUI-guiden](/info/tui.html).

Uansett hvilken flate du er på, er dashbordets Capabilities-fane det fullstendige kartet over hva plattformen erklærer at den kan gjøre, gruppert og lesbart uten å åpne et eneste verktøy.

---

## Verktøykategorier

Verktøy merkes med en `category` i manifestet for gruppering i galleriet.

Radene listes i galleriets seksjonsrekkefølge. `utility`-seksjonen rendres alltid **sist** i galleriet (etter alle andre kategorier, inkludert fremtidige) - det er skuffen "Offline-verktøy" på enheten.

| Kategori | Eksempler | Planlagt |
|---|---|---|
| `everyone` | QR Code Generator, Quote Card, Email Signature, Logo, Wordmark, Audiogram, Battlecards, Sequence Studio, Record | Employee Image Stationery |
| `designer` | Brand Lockup, Design, Chart, Darkroom, Filter, Pose Geeko, Multi-Page PDF | Font Outliner |
| `event` | Meeting Planner, Event Name Badge, Wayfinding Signage, Calendar ICS, Booth Studio | Event Stationery, Bulk Name Badges, Room Agenda Cards |
| `product` | - | CVE Alert, Product Release Announcement, Blog OG Image |
| `utility` | Strip Hidden Data, Text Helper, Compress PDF, Convert Image, Convert Font, Redact, Run Web Code, Screen Capture, URL Screenshot | Enhets-/formatkonvertere, flere personvernverktøy på enheten |

Disse cellene er **eksempler, ikke inventarlister**. Hvilke verktøy som finnes, er en egenskap ved profilen du har montert, ikke ved denne siden: en merkevarepakke legger til sine egne, og kan utelate et fellesverktøy den heller ikke vil levere. `catalog/tools/index.json` - generert fra manifestene, og registeret galleriet faktisk leser - er den autoritative listen; for å telle hva en profil monterer, tell manifestene (`ls community/*/tool.json brands/*/tools/*/tool.json`) i stedet for å stole på et tall skrevet ned her. (En verktøy-id som finnes i to pakker, monteres kun én gang, fra den vinnende pakken.)

Verktøy klassifiseres også etter status: `official` (godkjent av merkevaren, ingen vannmerke), `community` (eksternt bidrag), `experimental` (eksporter med vannmerke). Mesteparten av biblioteket er `official`; de nyere studioene og fangstverktøyene ligger gjerne på `community` eller `experimental` mens de modnes. Hver flate viser merket, slik at leseren vet hva de tar med seg før de åpner det - og, som kategoricellene over, beveger status-medlemskapet seg for raskt til å listes opp her. Les det av galleriet eller det genererte indekset.

**Design** er det første verktøyet bygget på det frie lerret-modusen `render.layout: "editor"` - en kromfri, direktemanipulasjonsflate der du drar, endrer størrelse på, roterer og fester bokser med tekst, former og bilder, og deretter eksporterer gjennom samme render-sti som alle andre verktøy.

**Strip Hidden Data** er det første **verktøyet på enheten** (`privacy: "on-device"`): et innholdstransformasjonsverktøy som tar en fil *du* selv oppgir, behandler den helt i nettleseren og leverer tilbake en ren kopi - aldri lastet opp, aldri vannmerket, ingen proveniens stemplet. **Text Helper** er det andre - en on-device-arbeidsbenk for hverdagslige lim-inn-i-en-nettside-jobber (JSON-formatering, JWT-dekoding, Base64, URL-koding/dekoding, SHA-hashing). **Compress PDF** er det tredje - det krymper en PDF ved å rekomprimere bildene, igjen helt på enheten. Markøren og merketeksten "Kjøres på din enhet - ingenting lastes opp" dekker nå hele transformasjonssettet: Strip Hidden Data, Text Helper, Compress PDF, **Convert Image** (HEIC/TIFF/AVIF → WebP/JPG/PNG), **Convert Font**, **Redact** (ødelegg områder i et bilde, SVG eller PDF), **Prompt to Image** og **Rebrand a Deck** (omtem et `.pptx`-dokument på stedet) der profilen monterer det. Dette er en personvern-verktøykategori som erstatter det å overlevere konfidensielle filer til enkeltformåls-nettsteder.

![Verktøyskuffen, der hvert kort er et verktøy som transformerer en fil du allerede har](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=aud-utilities)

> Merk: `category` og `status` denormaliseres inn i `catalog/tools/index.json` (registeret galleriet leser) fra hver `tool.json`. Manifestet er sannhetskilden - indeksen er **generert** av `npm run build:catalog`, og `npm run validate:catalog` feiler i CI hvis den innsjekkede indeksen avviker fra manifestene.

---

## Arkitektoniske forpliktelser

Disse beslutningene er avgjort. Å endre noen av dem er et stort foretak - de former alle andre beslutninger i kodebasen.

### 1. Deklarative verktøy, med en imperativ nødutgang

Et verktøy er et manifest (`tool.json`) + en mal (`template.html`) + valgfri `hooks.js`.

**Manifestet erklærer inndata.** Ikke malen. Inndata utledes ikke fra Handlebars-tokener. Manifestet er kontrakten; malen bruker navngitte variabler via `{{id}}`.

![Street Maps kontrollstabel - en byvelger, et temavalg, vektglidere og fargeutløsere, hver eneste én hentet fra en manifestlinje](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

**Hooks er valgfrie.** De fleste verktøy er rent deklarative - manifest + mal er nok. Verktøy som trenger beregnede verdier (QR-koding, formforming av diagramdata) leverer `hooks.js` som eksponerer navngitte livssyklusfunksjoner (`onInit`, `onInput`, `onFrame` - per-bilde-hooken for kamera i sanntid for bevegelsesreaktive verktøy - `onLevel`, `beforeExport`, `afterExport`, `exportFile` - fil-inn/fil-ut-transformasjonsstien brukt av on-device-verktøy som Strip Hidden Data - og `exportStill`, for et verktøy som eier sin egen dype rasterisering). Verten laster hooks via `new Function('host', …)` med kapabilitetsbroen injisert som lukkeromfang (closure scope). Dette er en **portabilitetskontrakt, ikke en sikkerhets-sandkasse**: hooks kjører fortsatt i sideomfanget og *kan* nå `window`/`fetch`/`document` i et nettleserskall - `host.*` er den støttede, portable overflaten, ikke en håndhevet grense. Asynkrone hook-resultater er tidsbegrensede (`onInit` 5s, `onInput` 2s, `beforeExport`/`afterExport` 5s, `exportFile`/`exportStill` 10s), og sene resultater forkastes; en løpsk *synkron* hook kan ikke avbrytes. Ubetrodd tredjeparts hook-kode er derfor ikke trygg å kjøre før Worker-isolasjon er levert.

Dette betyr noe fordi: deklarative verktøy kan lages av ikke-utviklere. Hvis hvert verktøy var en webapp, ville risikoen "begrenset kompetanse til å lage/vedlikeholde arbeidshest-maler" bli en permanent flaskehals.

### 2. Verktøy og ressurser er data, ikke pakket kode

Web- og Tauri-appene henter verktøy- og ressurskataloger fra en kjent URL ved oppstart, mellomlagrer dem lokalt og opererer på det som finnes der. **Å legge til en ny arrangementsflis eller sesongbasert ressurs krever ikke en app-utgivelse.**

Ressursbyte sjekksummeres med SHA-256 for å hindre CDN-forgiftning. Ressursens `id` + `version` driver mellomlagringsinvalidering.

### 3. Kapabilitetsbroen er den eneste API-en verktøy ser

Verktøy rører aldri DOM-en utenfor sitt malområde, kaller aldri `fetch` direkte, leser aldri filsystemet. De kaller versjonerte `host.*`-metoder. Kontraktens kanoniske definisjon er `packages/core/src/host-v1.ts` - SDK-en for verktøyforfattere, `@lolly-tools/core`, slik at en tredjepart kan bygge mot den uten å være avhengig av motoren; `engine/src/bridge/host-v1.ts` er en type-reeksport av den, og motor-/skallkode fortsetter å importere fra den stien uendret:

| Bro-API | Hva den gjør |
|---|---|
| `host.profile` | Brukerens fornavn, e-post, portrettbilde, by, osv. Forhåndsutfyller inndata via `bindToProfile`. |
| `host.assets` | Katalogspørringer, ressursoppløsning, vertlevert velger-UI. |
| `host.state` | Lagre / laste inndataplasser. IndexedDB på web, filsystem på Tauri, minne på CLI. |
| `host.clipboard` | Skriv tekst eller bilde til utklippstavlen (med plattformreserveløsninger). |
| `host.export` | Rasteriser eller serialiser rendermålet. Bruker vannmerke for eksperimentelle verktøy. |
| `host.net` | Fetch med tillatelsesliste - kun tilgjengelig hvis verktøyet har erklært kapabiliteten `"network"`. (Ingen verktøy i produksjon bruker den for øyeblikket.) |

Valgfrie, additive overflater vises kun når et skall leverer dem. Noen er **kapabilitetsstyrte** - eksponert kun når verktøyet erklærer det matchende flagget: `host.compose` (bygg inn et annet verktøys render - `compose`), `host.capture` (sidefangst for URL Screenshot - `capture`) og `host.recorder` (mikrofon-/kamera-/skjermfangst for opptaksverktøyene - `microphone` / `camera` / `screen`). Resten er **funksjonsdetekterte** - til stede når skallet kan levere dem, med en reserveløsning i verktøyet for skall som ikke kan.

Et lite utvalg toppoverflater, for å vise hva den dekker - [Host API](/info/host-api.html) dokumenterer hver eneste én, og `packages/core/src/host-v1.ts` er selve kontrakten:

| Grensesnitt | Siden | Hva det legger til |
|---|---|---|
| `host.tokens` | 1.0 | DTCG-designtokens - merkevarens egne primitiver |
| `host.text` | 1.0 | Tekst-til-bane via HarfBuzz WASM (funksjonsflagget `wasm` markerer verktøy som er avhengige av den) |
| `host.media` | 1.4 | Direktekamerabilder som driver `onFrame`-kroken. Progressiv forbedring, bevisst *ikke* sperret av `camera`-flagget - et slikt verktøy fungerer fortsatt som et vanlig stillbildeverktøy |
| `host.color` | 1.40 | Perseptuell fargematematikk: ΔEOK, WCAG + APCA-kontrast, OKLab-overganger, klassebrytninger, kategoriske paletter, harmoniskjemaer (1.60), CSS Color 4-blanding og gradientbaking (1.68). Ren og synkron - skallene kobler til motorens `makeColorApi()` i stedet for å implementere noe selv, så den kan ikke gli fra hverandre |
| `host.images` | 1.60 | Dekode / endre størrelse / omkode bytes på enheten - konverteringsveien (HEIC → JPEG, komprimer til WebP, nedskaler). Levert i nettskallet som en lat fasade, slik at HEIC-dekoderen aldri havner i oppstartsbiten |
| `host.geom` | 1.64 | Eksakt vektorgeometri: baneboolske operasjoner, forskyvning, strøk-til-fyll, splinereduksjon, forenkling, trefftesting. Også ren, synkron og koblet til fra motoren (`makeGeomApi()`); feil *returneres*, aldri kastes |

Resten følger de samme reglene og er dokumentert sammen med dem: `pdf` (1.8) og `pptx` (1.58) for dokumentkirurgi på enheten, `audio` (1.71) og `speech` (1.96) for klippanalyse og TTS/transkripsjon på enheten, `viz` (1.72) for MilkDrop-plassholderkontrakten, `codec` (1.100) og `layers` (1.102) for dyp bitdybde og lagdelt bitmap-utdata, `upscale` (1.101) og `matte` (1.103) for modellene på enheten, `raster` (1.105) for hooks som gjør sitt eget pikselarbeid, `connectors` (1.106) for eksportsikre piler og `c2pa` (1.85) for signering av ferdige byte. Antallet vokser; reglene gjør det ikke.

De erklærbare kapabilitetene er: `network`, `filesystem`, `clipboard`, `camera`, `microphone`, `screen`, `ffmpeg`, `wasm`, `capture`, `compose`. (`screen`, lagt til i 1.54, er skjermfangst via `host.recorder` - brukeren velger en skjerm/vindu/fane i nettleserens egen UI; skilt fra `capture`, som rasteriserer en URL verktøyet selv oppgir.)

Det samme verktøyet kjører i nettleser, Tauri og hodeløs CLI fordi hvert skall implementerer dette grensesnittet - verktøyet vet aldri hvilket det er i.

Broen er versjonert. Å legge til metoder er en mindre versjon. Å fjerne eller endre signaturer er en hovedversjonsoppgradering. Når v2 lanseres, må v1 fortsette å fungere.

### 4. Ressurs-ID-er er for alltid

`suse/logo/primary` er en kontrakt. Når den er publisert:
- ID-en endres aldri, gjenbrukes aldri.
- Byteendringer → øk `version` i manifestet.
- Erstattet av en ny ressurs → sett `deprecated: true` og eventuelt `replacedBy`.
- Eksisterende referanser løses alltid opp.

Dette gjør lagrede verktøytilstander og URL-delte lenker holdbare på tvers av år.

### 5. URL-modus er førsteklasses

Hver inndata må kunne uttrykkes som en URL-parameter:

```
lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H
```

![Den lenken alene, uten noe annet i seg, er det ferdige verket](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fsuse.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

CLI-modus er URL-modus under en annen transportmekanisme - CLI-skallet bygger et URL-tilstandsobjekt fra argv og kjører **samme** motor-pipeline. Det finnes én render-sti. CLI kan ikke avvike fra GUI fordi det ikke er en separat implementasjon.

`url-mode.ts` håndterer rundturen (parsing og serialisering). Et sett med **reserverte parametere** videresendes aldri til verktøyet som inndata: utdatakontrollene (`format`, `export`, `copy`, `filename`, `width`/`w`, `height`/`h`, `unit`, `dpi`), trykk- og proveniensbryterne (`bleed`, `marks`, `profile`, `password`, `c2pa`, `imprint`, `durable`, `meta`, `hdr`, `depth`, `cuts`) og tilstandsbærerne (`template`, `z` - det pakkede tokenet for "Korteste lenke" - og `zx`, det samme kryptert med et passord). Settet `RESERVED` i `engine/src/url-mode.ts` er autoriteten og er sikret av en test; [URL-modus](/info/url-mode.html) dokumenterer hver eneste én av dem, inkludert de få som ikke er listet her. Ressurs-inndata i URL-modus serialiseres ved sin `id`; runtimen løser dem opp via `host.assets.get()` før hydrering. `width`/`height` er verdier i `unit` (standard `px`, også `mm`/`cm`/`in`/`pt`/`pc`); med en fysisk enhet setter `dpi` rasteroppløsningen. De setter lerretets dokumentstørrelse og forhåndsutfyller eksportdimensjonspanelet.

Fordi hver inndata følger med i lenken, gir en parameterendring et annet ferdig verk. Denne hele paletten er én utgangsfarge, en harmoni og et trinnantall:

![Ni trinn over fire fargenyanser, alle vokst fra den samme frøfargen som ligger i lenken](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

### 6. Lagring går gjennom broen, ikke direkte

Web-shell: IndexedDB. Tauri: filsystem. CLI: i minnet. Verktøy ser bare `host.state.save(slot, data)` og `host.state.load(slot)`. `localStorage` brukes ikke - det er for lite og kan ikke lagre blober.

Brukere kan lagre flere navngitte redigeringsplasser per verktøy og komme tilbake til hver økt senere. Ingen kontoopprettelse kreves; tilstanden er per enhet. Fordi broen er den eneste skjøten, er denne per-enhet-tilstanden også *portabel*: `shells/web/src/data-transfer.ts` leser alt tilbake gjennom `host.profile`/`host.state`/`host.assets` til en enkelt `lolly-backup`-zip som kan importeres på enhver annen installasjon - det frakoblede svaret på "flytt til en ny enhet" som ikke trenger en server (full spesifikasjon: `docs/data-transfer.md`). SUSE ID-integrasjon (synkronisering på tvers av enheter) er en fremtidig milepæl oppå dette.

### 7. Modenhetsmerker svarer på "merkevare-godkjent"-risikoen ved design

Hvert verktøy erklærer `status: official | community | experimental` i manifestet sitt. Galleriet sorterer etter status. Eksperimentelle verktøy vannmerker eksportene sine automatisk - vannmerket påføres av `host.export.render`, ikke av verktøyet, så det kan ikke velges bort av en ikke-offisiell verktøyforfatter.

Dette er et strukturelt svar på oppfatningsrisikoen at bruk av et hvilket som helst verktøy antyder merkevaregodkjenning. Prosessvar (en gjennomgangskø, SUSE ID-sperring) legges oppå dette.

### 8. Verktøyinndata er typet via manifestet, inkludert ressurser

Inndata erklærer en `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` og `file`. Verten rendrer en generisk kontroll per type ut fra manifestet - verktøy skriver null kontrollkode. (Forhåndsutfylling fra brukerens profil er ikke en type - enhver inndata kan bære `bindToProfile`.) Tre veier tyngre enn resten:

- **`asset`** (med `filter` og `allowUpload`) er broen til det globale ressurssystemet; `allowUpload: false` er håndtaket for merkevarehåndhevelse til ting som logoer på sponsorflis, der bare biblioteksressurser er tillatt. Brukeropplastinger bruker samme `AssetRef`-form som biblioteksressurser, så verktøy håndterer dem identisk.
- **`blocks`** er en gjentakende feltgruppe - en minitabell inne i én inndata, redigert i et sidepanel, med en typet/diskriminert legg-til-meny og ressursfelt per blokk. Å klikke på en rendret blokk på lerretet fokuserer den blokkens rad. Brukt av `meeting-planner`, `chart-creator`, `event-name-badge`, `wayfinding-signage`, `color-block` og `digi-ad`.
- **`vector`** grupperer et fast sett med tall (f.eks. en transform) til én sammensatt kontroll; **`file`** holder brukerens egen fil som bytes i minnet for on-device transformasjonsverktøy (f.eks. `strip-data` og `compress-pdf`).

### 9. Maler er logikkfrie (Handlebars, ikke EJS)

Handlebars ble valgt fremfor EJS med hensikt:
- Logikkfritt. Maler kan lages av ikke-utviklere.
- Trygt som standard. `{{x}}` HTML-escaper; `{{{x}}}` er valgfritt rått.
- Ingen vilkårlig JS i maler betyr ingen XSS-revisjonsflate per mal.

Logikk bor i `hooks.js`, der den er eksplisitt og gjennomgåelig. Tilgjengelige Handlebars-hjelpere: `{{default}}`, `{{upper}}`, `{{lower}}`, `{{eq}}`, `{{markdown}}`, `{{asset ref}}`, `{{asset ref "property"}}` (pluss dataformat-hjelperne `icsStamp`/`rfcText`/`csvCell` brukt av søster-malene `.ics`/`.vcf`/`.csv`).

### 10. Verktøy komponerer verktøy

Et verktøy kan bygge inn **et annet** verktøys rendering uten verktøy-til-verktøy-importer - komponering løses av motoren, aldri av verktøykode. Det finnes to flater:

- **Deklarativt manifest** - `composes: [{ id, tool, inputs, format?, width?, height? }]`. Motoren rendrer det navngitte barnet og plasserer resultatet i den logikkfrie malen som `{{asset <id>}}`. `event-name-badge` komponerer `qr-code` som en SVG i dag.
- **Portabel innbyggingsURL** - `<img src="https://lolly.tools/tool/<id>.<ext>?<inputs>">`. Skallet rendrer det barnet **lokalt** (en plassholderpiksel vises til den lokale renderingen er ferdig); ingenting hentes noensinne fra `lolly.tools`.

Komponer renderingen av et hvilket som helst verktøy: et **SVG**-barn forblir en ekte vektor når forelderen eksporterer til SVG eller PDF, og rastreres skarpt for PNG; **PNG/JPG/WEBP**-barn bygges inn som bilder. Krever `compose`-egenskapen. Komponerte barn er mellomtrinn - aldri vannmerket eller proveniens-stemplet - og komponering degraderer gradvis: et skall som ikke kan rendre et barn, hopper bare over plassen, og forelderen rendrer likevel.

---

## Hva vi eksplisitt valgte å ikke gjøre

- **Ingen EJS / ingen vilkårlig JS i maler.** XSS-overflaten er null. Logikk lever i `hooks.js`.
- **Ingen obligatorisk ressurs-CMS.** Enkeltpersoner tar sine egne kreative filer rett inn i katalogen sin i appen (visningen [Katalog](/info/using.html) og Brand Studio) - ingen server, ingen adminkonsoll. Arbeid gis videre som en **økt**: en delingslenke bærer hele tilstanden, og den samme økten reiser i en sikkerhetskopi eller over en samarbeidsøkt. Den som kontrollerer utrullingen, kan da låse en delt økt som en **mal** - åpne lenken, registrer verdiene som en maloppføring i det verktøyets mappe i merkevarepakken og commit - hvoretter den vises i verktøyets «New from template»-velger og kan dyplenkes som `?template=<id>`. Git er utrullingseierens låsesteg, aldri skaperens. For en *delt, styrt* katalog **kan** en organisasjon administrere ressursmappen på samme måte og styre oppdateringer gjennom PR-gjennomgang - en tilgjengelig styringsmodell, ikke et krav fra appen.
- **Ingen tvungen RBAC.** Den åpne appen er offentlig tilgjengelig som standard; merkevarerisiko håndteres med modenhetsmerker + vannmerker. En organisasjon som vil ha strammere kontroll, legger sin egen autentisering og den git-gjennomgåtte katalogen ovenfor på toppen.
- **Ingen sentral database.** All brukertilstand er per enhet. SUSE ID-integrasjon er på veikartet, men ikke en lanseringssperre.
- **Ingen delt kodesti for verktøy/motor.** Motoren er åpen kildekode, og det er også de merkevareuavhengige verktøyene i `community/`; en merkevarepakke som den private `brands/suse/` bærer sine egne verktøy og katalog på egne vilkår. Uansett håndheves adskillelsen (ingen kryssimporter fra `engine/` inn i verktøyinnhold), slik at delingen forblir ren.

---

## Livssyklus, fra ende til ende

En bruker åpner `lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H`:

1. **Oppstart.** Web-shell åpner IndexedDB, konstruerer egenskapsbroen, synkroniserer verktøy- og ressurskatalogene (eller laster fra buffer ved frakobling).
2. **Rute.** URL-hash → `tool`-visning, med `qr-code` og URL-parametere hentet ut.
3. **Last.** `loadTool('qr-code', fetchFile)` henter `tool.json`, validerer mot JSON Schema, henter `template.html`, `styles.css` og `hooks.js`-kildekode.
4. **Tolk URL-tilstand.** `parseUrlState` oversetter URL-parametere til initielle inndataverdier. Ressursreferanser (`?logo=suse/logo/primary`) tolkes som lettvekts `{ id, _unresolved: true }`-objekter.
5. **Kjøretid.** `createRuntime(tool, host, initialValues)` bygger inndatamodellen (slår sammen profildata, standardverdier og initielle verdier), løser ressursreferanser via `host.assets.get()`, laster hooks (closure-scopet `host`, ikke sandkassert), kaller `hooks.onInit`.
6. **Rendring.** Skallet abonnerer på kjøretiden; ved hver tilstandsendring mottar det `{ model, hydrated }`. Det rendrer inndatakontroller fra modellen og skriver den hydrerte mal-HTML-en inn i `#tool-canvas`.
7. **Interaksjon.** Brukeren skriver i en inndata → `runtime.setInput(id, value)` → begrensninger anvendes → `hooks.onInput` kalles → re-hydrering → re-rendring. Lerretet oppdateres live.
8. **Eksport.** Brukeren klikker Download(PNG) → `runtime.export(canvasNode, 'png')` → `host.export.render` (rastrerer via dom-to-image-more; SVG/PDF går gjennom dedikerte DOM-vandrende vektoriserere) → blob → `host.export.download`. Formatspekteret et verktøy kan velge inn i er bredt, og `render.formats`-enumen i `schemas/tool.schema.json` er autoriteten på det - rastere og flytende rastere, vektorer og kuttfiler, trykk/CMYK, bevegelse, redigerbare dokumenter (`pptx`, `docx`, `odt`), palett- og data-/tekstutdata, lyd- og skriftfiler. [URL Mode](/info/url-mode.html) navngir hver id og hva den produserer. Lyd er i den enumen som alt annet (`wav`, `mp3`, `m4a`, `opus`, erklært av audiogrammet og opptaksverktøyene); separat driver et opptaksverktøys `render.capture`-modus `host.recorder`, hvis opptak ankommer som en ferdig Blob i hva enn beholder nettleseren tok opp i. (Verktøy som setter `render.export: false` - f.eks. Color Palette, Countdown Timer, Strip Hidden Data, Text Helper, Compress PDF - skjuler kontrollene for nedlasting/format/dimensjon.) Fysiske enheter konverteres per format her (PDF → ekte sidepunkter, raster → piksler ved DPI med en `pHYs`-blokk). Forfatterskaps-/proveniens-metadata (forfatter, verktøy, kilde - bygget av `engine/src/metadata.ts`) bygges inn per format: PNG iTXt, JPEG EXIF, PDF info-dict, SVG `<metadata>`, GIF-kommentar. Eksperimentelle verktøy får et vannmerke satt inn av verten, ikke av verktøyet.

![Eksportpanelet som `?options` åpner: filnavn- og formatparet, utdatastørrelsen og kontrollene som skriver filen](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Samme livssyklus i Tauri. Samme livssyklus i CLI - jsdom leverer den hodeløse DOM-en; utdata går til en fil eller stdout.

---

## Status for åpen kildekode

**Kode er MPL-2.0.** `engine/`, `shells/*`, `services/*`, `schemas/` og `docs/` er åpen kildekode under **MPL-2.0** - en leverandørnøytral stillasplattform for merkevareverktøy, hvor hver leverbare enhet ligger i sitt eget repositorium under [github.com/lolly-tools](https://github.com/lolly-tools).

**Verktøyinnhold leveres som merkevarepakker**, hver med sine egne vilkår (se pakkens `NOTICE.md`). `community/` er det offentlige [`lolly-tools`](https://github.com/lolly-tools/lolly-tools)-repositoriet, og de merkevareuavhengige verktøyene der er også MPL-2.0. `brands/suse/` er den private `suse-lolly`-pakken: SUSE-verktøyene og SUSE-katalogen, **proprietær for SUSE**, inkludert dens lisensierte PremiumBeat-musikk. `brands/lolly-start/` er den blanke startmerkevaren dette repositoriet eier. Skrifter leveres inne i en pakke under **SIL Open Font License 1.1** - SUSE-pakken bærer skrifttypene SUSE og SUSE Mono.

`tools/` og `catalog/` i repositoriets rot er gitignorerte *visninger*: en profil setter dem sammen fra `community/` pluss den aktive merkevarepakken, og det er derfor hvert skript og skall leser disse to stiene og aldri en pakke direkte.

Delingen håndheves - det finnes ingen kryssimporter fra `engine/` inn i verktøyinnhold - slik at grensen mellom plattform og innhold forblir ren.

---

## Der motoren slutter og verten begynner

Hvis du kan beskrive det i ren data + Handlebars → **motor**.
Hvis det berører DOM-en, filsystemet, nettverket eller et hvilket som helst nettleser-/OS-API → **vert**.

Grensen er skarp med hensikt. Motoren er den åpne kildekode-delen. Alt som vet om SUSE, spesifikke plattformer eller kjøretidsmiljøer holdes utenfor den.

For neste detaljnivå lister [`engine/README.md`](../engine/README.md) opp hver motormodul og hva den har ansvar for, og [Threat Model & Trust Boundaries](/info/threat-model.html) dokumenterer hvor den samme grensen også fungerer som en tillitsgrense.
