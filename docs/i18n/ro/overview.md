# Prezentare generală

![Pictogramă Lolly - Acadea mare, verde și albă](/info/icon.svg)

Acest document surprinde scopul, structura și deciziile arhitecturale pentru platforma Lolly. Reflectă atât viziunea produsului, cât și starea actuală a codului sursă.

> **Status:** Lolly este un prototip intern aflat într-un **pilot închis, care nu s-a încheiat încă**. Motorul este determinist și consecvent intern, dar produsul este într-o etapă timpurie - SUSE este clientul numărul unu - iar motoarele sale de criptografie și analiză de fișiere trec în prezent prin întărirea strictă de infrastructură a SUSE, pregătindu-se pentru scară enterprise (suntem chiar buni la asta). Citește arhitectura de mai jos ca intenție de design aflată în testare, nu ca produs finit și certificat. Vezi [Adopție și guvernanță](/info/adoption-governance.html#status) pentru cum e condus și măsurat pilotul.

> **Cum se citește această pagină.** Conține două tipuri de material, în ordine. Prima jumătate este
> **de ce există**: problema, poziționarea și ciclul de viață prin care trece un singur activ. De la
> [Imaginea de ansamblu](#the-big-picture-how-the-layers-fit) încolo este
> **cum se îmbină straturile**: documentul de arhitectură pentru contributori, care acoperă separarea
> engine/shell/pack, structura repository-ului, țintele de livrare și angajamentele care limitează fiecare
> modificare a platformei. Dacă ești aici ca să schimbi codul, nu ca să înțelegi
> produsul, începe de la imaginea de ansamblu.
>
> Există două documente însoțitoare care merg mai în profunzime decât această pagină. [`engine/README.md`](../engine/README.md) din
> repository este harta modul-cu-modul a motorului, cu un tabel generat al fiecărui modul și
> ce anume analizează sau scrie. [Modelul amenințărilor și limite de încredere](/info/threat-model.html)
> este aceeași arhitectură citită ca limite de încredere, și e pagina potrivită pentru orice întrebare despre
> ce tratează motorul drept neîncrezut.

---

## De ce există

Echipele se confruntă cu o problemă recurentă: muncă creativă și de conținut repetabilă, prea predictibilă pentru a justifica mâini specializate de fiecare dată, dar prea sensibilă la calitate pentru a fi delegată fără garanții. Rezultatul este fie un flux lent (blocaj cauzat de specialist), fie inconsecvență (oamenii folosesc orice unealtă au la îndemână), fie dependență de furnizor (un DAM SaaS care îți controlează șabloanele).

Această platformă este răspunsul direct:

> **Creativitate și conținut programatice la scară** - generare de active fără muncă manuală, cu regulile sub control central, pentru angajați, furnizori și parteneri.

Lolly nu este locul unde se inventează un sistem de design - este locul unde acesta se produce. Gândește-te la el ca la un automat de vending pentru design: faci o alegere, obții un rezultat. De fiecare dată. Motorul (engine) urmărește cea mai bună calitate pe care fiecare format o poate produce pe hardware-ul din fața ta, iar același motor produce același fișier pe fiecare platformă către care este livrat.

Rezultatul este **abundența**: fiecare eveniment are semnalistica corectă, fiecare alertă CVE se potrivește cu stilul casei, fiecare etichetă se tipărește curat, fiecare semnătură de e-mail este actuală - totul fără un tichet de design. Platforma se ocupă de creativitatea operaționalizată recurentă. Deliberat nu este o unealtă creativă la comandă - designerii continuă să dețină munca de vârf.

### Inovează probabilistic, scalează determinist

Fiecare dezbatere despre AI într-un flux creativ se blochează la aceeași întrebare: care parte din asta e treaba mașinii? E o întrebare veche, cu un răspuns stabilit deja. Copiștii și miniaturiștii lucrau deja între două instrumente - schița liberă, unde nimic nu era fix și totul putea fi încercat, și tiparul, intimidant tocmai pentru că se angaja definitiv. Schițele erau locul unde se întâmpla arta. Tiparul era felul în care ajungea la oricine. Nimeni nu confunda cele două, și amândouă au continuat să avanseze - cerneluri noi, fonturi noi, prese noi - fiecare evoluând în armonie cu meșteșugul și intenția pe care o slujea.

Lolly trasează aceeași linie. Explorează probabilistic: un model, un designer, o idee brută, un prompt care merge undeva neplanificat de nimeni. Apoi scalează determinist - lucrul care ajunge la zece mii de rezultate este o *unealtă*, iar o unealtă se randează la fel de fiecare dată din intrări pe care le poți citi. Explorarea rămâne liberă pentru că nimic din aval nu depinde ca ea să iasă identic de două ori. Rezultatul câștigă încredere pentru că nu e o presupunere. A aduce experimentarea AI la rezultate predictibile și reproductibile nu e o disciplină nouă; e aceeași diviziune a muncii care a făcut ca lucrarea tipărită să merite încredere de la bun început.

> Ai încredere în procesul creativ, scalează cu rigoare.

### Față de alternative

::: figure positioning-comparison
Completitudinea capacităților în uneltele creative de azi, cercetate în august 2026. Punctaj: 0 absent, 25 la nivel de soluție ocolitoare, 50 real dar restricționat sau parțial, 75 puternic cu rezerve, 100 competență de bază.
:::

Decalajul este clar: nimic disponibil azi nu ne oferă output constraints-first, capabil offline, cu abilități minime, accesibil intern. Lolly include chiar și un canvas deschis - **Design** - unde culorile, tipografia și activele se conformează variabilelor globale de brand, deci aranjarea liberă rămâne constraints-first. Ce **nu** este e o suită de design nerestricționată: designerii continuă să folosească Illustrator și Figma pentru munca de vârf la comandă. Permutările pot fi asamblate cu această unealtă.

![Fiecare unealtă din bibliotecă ca un card, grupată pe categorii, ca un producător să aleagă una și să înceapă](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=aud-gallery-landscape)

**Folosește-o pentru:** Generarea rapidă de active creative operaționalizate - plăcuțe de eveniment, ecusoane cu nume, semnături, alerte CVE, coduri QR, carduri sociale, etichete de expediere, rapoarte structurate.

**Nu o folosi pentru:** Conținut principal la comandă.

---

## Ciclul de viață al unei campanii

Cel mai clar mod de a vedea ce este Lolly nu e o listă de funcții - e să urmărești un singur activ pe măsură ce trece din mână în mână. Urmărește cum un card de campanie localizat se mișcă prin organizație:

1. **Echipa creativă stabilește regulile.** Un designer creează șablonul de bază în unealta Design, codificând direct tipografia și variabilele de culoare ale brandului. Nu fac un singur card - fac munca fundamentală *o dată*, ca să nu mai trebuiască vreodată să o localizeze manual din nou.
2. **Dezvoltatorul o scalează.** Același șablon este conectat într-un pipeline nocturn prin CLI, astfel încât o diagramă nouă sau o variantă de limbă nouă este generată automat - fără ca vreun designer să redeschidă fișierul.
3. **Producătorul doar îl folosește.** Un reprezentant de vânzări, offline într-un avion, deschide aceeași unealtă și generează o prezentare perfect pe brand pentru o întâlnire cu un client. Fără abilități de design, fără rețea, fără așteptare.

„Diagrama nouă” din pasul doi este o randare precum aceasta, produsă dintr-un șir de date și câțiva parametri, fără ca nimeni să deschidă un fișier de design:

![Un grafic de arie stivuit cu titlu, ale cărui trei serii sunt colorate într-o paletă rece, cu axe, legendă și titlu plasate toate de șablon, nu manual](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Ideea nu este că Lolly e bun pentru designeri *și* bun pentru dezvoltatori *și* bun pentru vânzări, fiecare izolat. Este o **cursă de ștafetă**: munca inițială a celui din echipa creativă este scalată de dezvoltator, care la rândul lui capacitează producătorul. Experiența fără efort pentru reprezentantul netehnic din avion este posibilă *doar* datorită rigorii stabilite de designer și implementate de dezvoltator.

Acesta este multiplicatorul de forță. Lolly nu e un sertar de unelte separate pentru roluri separate - e un singur ciclu de viață determinist al activelor, pe care fiecare rol îl atinge, iar fiecare mână prin care trece multiplică valoarea celei anterioare.

---

## O aprobare, zece mii de active

Pentru că aprobarea trăiește în unealtă, nu în fișier (vezi [Cum se compară Lolly](/info/positioning.html)), scara încetează să mai fie o problemă de revizuire. Aprobă o dată o unealtă de card social localizat, apoi generează **10.000 de active în 12 limbi** dintr-un tabel - și niciunul nu are nevoie de o verificare nouă de conformitate din partea juridicului sau a brandului, pentru că șablonul din care provin toate era deja aprobat.

Aceeași unealtă determinist atinge acea scară în trei moduri, toate producând un rezultat identic, pre-aprobat:

- <!--i:people--> **O persoană, în aplicație.** Grila batch `/pro`: lipește sau importă rândurile, obții câte un activ finit per rând, descarcă arhiva zip. Fără abilități de design, fără tichet, fără așteptare.
- <!--i:code--> **Un dezvoltator, din linia de comandă.** CLI rulează *același* motor și *aceeași* cale de randare fără interfață grafică, astfel încât unealta poate fi secvențiată peste toate cele 10.000 de rânduri într-un script sau un pipeline nocturn. Un apel `lolly <tool> --field=…` într-o buclă e toată integrarea.
- <!--i:cpu--> **Un sistem sau un agent AI, prin MCP.** Aceeași unealtă operată programatic, la aceeași fidelitate și la o scară chiar mai mare - pentru că o mașină nu se plictisește în timp ce mii de fișiere continuă să sosească.

![Modul Batch la o instalare nouă: un rând gol care așteaptă un instrument, cu întreaga suprafață a foii de calcul și butonul ei Render deja la locul lor, înainte de sosirea oricăror date](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

Un singur set de constrângeri de brand, fixat o dată de un designer; trei rute către rezultatul identic pre-aprobat - iar ruta automată scalează cel mai departe dintre toate, pentru că nu obosește niciodată cât timp fișierele continuă să sosească.

---

## Imaginea de ansamblu: cum se îmbină straturile

Tot ce urmează de aici încolo este arhitectură. Diagrama este întregul sistem dintr-o singură privire: uneltele sunt
date în vârf, motorul din mijloc nu știe nimic despre nicio platformă, shell-urile de dedesubt
implementează un singur contract, iar catalogurile furnizează conținutul.

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

### Structura repository-ului

Conținutul este montat ca pachete: `community/`, `docs/`, fiecare `shells/*`, ambele `services/*` și `brands/suse` sunt fiecare propriul repository, extrase ca submodule git ale acestuia. Repository-ul părinte deține `engine/`, `schemas/`, `scripts/`, `tests/`, `api/`, `brands/lolly-start/` și `profiles.json`. Vezi [Ghidul de build » Obținerea sursei](/info/build-guide.html) pentru comanda de checkout și fluxul de lucru între repository-uri.

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

## Modelul de livrare al platformei

Platforma rulează pe mai multe suprafețe - web PWA, desktop/mobil Tauri, CLI-ul scriptabil și TUI-ul interactiv. Toate folosesc același motor și aceleași fișiere de unealtă.

### Web (PWA) - distribuție principală
Găzduit la un URL controlat de SUSE. Funcționează offline odată ce service worker-ul a memorat în cache uneltele și activele. Aici vor folosi platforma cei mai mulți angajați, furnizori și parteneri. Nu e necesar niciun cont - starea este stocată în IndexedDB per dispozitiv.

Shell-ul web este responsive dintr-un singur layout. Pe desktop, o unealtă este o bară laterală de comenzi redimensionabilă, alături de o scenă de previzualizare cu navigare nativă pe canvas prin trackpad (Cmd/Ctrl+rotiță sau pinch pentru zoom în jurul cursorului, Space sau drag cu clic din mijloc pentru pan, tastele `0`/`1`/`+`/`−` și un HUD Fit/%). Pe mobil (≤640px) comenzile devin o foaie ancorată sus, cu un mâner de tragere care se fixează pe peek/half/full (atingerea comută) peste o previzualizare statică pe tot ecranul, iar un buton **Render** plutitor deschide comenzile **Export** într-un popup tip bottom-sheet. Atingerea primește pinch-zoom și drag-pan pe previzualizare. Calea de randare și comenzile de export sunt identice pe ambele - doar interfața se reorganizează.

![Vizualizarea split pe desktop - controale generate din manifest în stânga, canvasul live în dreapta](/t/url-shot?url=%2F%23%2Ftool%2Fchart-creator&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=aud-web-split)

Același instrument la lățime de telefon, fără un al doilea layout de întreținut: controalele devin o foaie (sheet) în partea de sus, previzualizarea ocupă tot ecranul, iar pastila de randare plutește deasupra.

![O audiogramă pe un ecran lat de 430 px - fișa de comenzi deasupra, grafica pătrată finalizată dedesubt și pastila plutitoare de randare](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

**Modul batch (`/pro`).** Shell-ul web include și o grilă batch în stil foaie de calcul (`shells/web/src/pro/`) care randează multe rânduri deodată, pe unul sau mai multe instrumente. Face round-trip CSV/TSV plus lipire din foaia de calcul, template/format/dimensiune/unitate/dpi per rând, un panou lateral editor de blocuri cu previzualizare live, coloane de export pliabile, o bară de etichete "relevanță" per rând, reordonare de rânduri prin mâner de tragere în stânga, confirmare de ștergere în doi pași, sesiuni batch salvate și descărcare `.zip`. Aceasta este suprafața one-to-many din spatele poziționării "generare de conținut în masă".

### Tauri desktop / mobil
Aplicație nativă împachetată (amprentă redusă via Tauri). Oferă disponibilitate offline completă, acces la sistemul de fișiere pentru instrumentele dependente de CLI (PDF Smasher, Font Outliner) și acces la cameră. Programată pentru îmbunătățiri ale tooling-ului la mijlocul lui 2026.

### CLI
`lolly <tool-id> [--input=value ...] --output=file.png`

Utilizatorii de desktop pot invoca multe instrumente din terminal. Shell-ul CLI încarcă același engine, creează un DOM jsdom, rulează aceeași cale de randare și scrie fișierul. Modul URL este transportul - CLI nu este o implementare separată. Asta garantează că ieșirile CLI și GUI sunt identice.

```bash
lolly qr-code --url=https://suse.com --output=qr.svg
lolly quotes --quote="Ship it." --output=quote.png
lolly                        # lists available tools
lolly qr-code                # lists inputs for that tool
```

### TUI
`npm run tui`

Contrapartea interactivă a CLI-ului: o aplicație de terminal pe tot ecranul, orientată pe tastatură (construită pe Ink) pentru a răsfoi instrumente, a completa intrări, a salva proiecte și a exporta - totul fără GUI. Bridge-ul său de host **reutilizează implementarea CLI-ului** pentru formatele fără DOM (SVG/EMF/EPS/HTML + text/date) și adaugă stare pe disc sub `~/.lolly` plus o previzualizare inline opțională. Dincolo de asta, are un **nivel de randare în browser**: un Chromium headless delimitat (același pe care îl instalează serverul MCP) care produce raster/PDF/video și captură de URL live la cerere - conducând o copie construită a shell-ului web, astfel încât ieșirea este identică, și pornind doar când exporți pentru prima dată un astfel de format. Așadar `url-shot` (cu decupare + recolorare + PDF/SVG vectorial) și fiecare instrument raster/pdf rulează și în terminal. Vezi [ghidul TUI](/info/tui.html).

Indiferent pe ce suprafață te afli, tab-ul Capabilities al dashboard-ului este harta completă a ceea ce platforma declară că poate face, grupată și lizibilă fără a deschide vreun instrument.

---

## Categorii de instrumente

Instrumentele sunt etichetate cu o `category` în manifestul lor pentru gruparea în galerie.

Rândurile sunt listate în ordinea secțiunilor din galerie. Secțiunea `utility` se randează întotdeauna **ultima** în galerie (după fiecare altă categorie, inclusiv cele viitoare) - este sertarul on-device "Offline Utilities".

| Categorie | Exemple | Planificat |
|---|---|---|
| `everyone` | QR Code Generator, Quote Card, Email Signature, Logo, Wordmark, Audiogram, Battlecards, Sequence Studio, Record | Employee Image Stationery |
| `designer` | Brand Lockup, Design, Chart, Darkroom, Filter, Pose Geeko, Multi-Page PDF | Font Outliner |
| `event` | Meeting Planner, Event Name Badge, Wayfinding Signage, Calendar ICS, Booth Studio | Event Stationery, Bulk Name Badges, Room Agenda Cards |
| `product` | - | CVE Alert, Product Release Announcement, Blog OG Image |
| `utility` | Strip Hidden Data, Text Helper, Compress PDF, Convert Image, Convert Font, Redact, Run Web Code, Screen Capture, URL Screenshot | Convertoare de unități/formate, mai multe utilitare de confidențialitate pe dispozitiv |

Acele celule sunt **exemple, nu inventare**. Ce instrumente există este o proprietate a profilului pe care l-ai montat, nu a acestei pagini: un pachet de brand își adaugă propriile instrumente și poate exclude un instrument din community pe care preferă să nu-l livreze. `catalog/tools/index.json` - generat din manifeste, și registrul pe care galeria îl citește efectiv - este lista autoritară; pentru a număra ce montează un profil, numără manifestele (`ls community/*/tool.json brands/*/tools/*/tool.json`) în loc să te bazezi pe un număr scris aici. (Un id de instrument prezent în două pachete se montează o singură dată, din pachetul câștigător.)

Instrumentele sunt clasificate și după status: `official` (aprobat de brand, fără watermark), `community` (contribuție externă), `experimental` (exporturi cu watermark). Cea mai mare parte a bibliotecii este `official`; studiourile mai noi și instrumentele de captură tind să stea la `community` sau `experimental` cât timp se stabilizează. Fiecare suprafață arată insigna, astfel încât cititorul știe ce preia înainte de a-l deschide - și, la fel ca celulele de categorie de mai sus, apartenența per-status se schimbă prea repede pentru a fi enumerată aici. Citește-o din galerie sau din indexul generat.

**Design** este primul instrument construit pe modul de canvas liber `render.layout: "editor"` - o suprafață fără chrome, de manipulare directă, unde tragi, redimensionezi, rotești și aliniezi cutii de text, forme și imagini, apoi exporți prin aceeași cale de randare ca orice alt instrument.

**Strip Hidden Data** este primul **utilitar on-device** (`privacy: "on-device"`): un instrument de transformare a conținutului care preia un fișier furnizat de *tine*, îl procesează integral în browser și returnează o copie curată - niciodată încărcat, niciodată cu watermark, fără ștampilă de proveniență. **Text Helper** este al doilea - un banc de lucru on-device pentru sarcinile obișnuite de tip "lipește-în-un-site" (formatare JSON, decodare JWT, Base64, encode/decode URL, hashing SHA). **Compress PDF** este al treilea - micșorează un PDF recomprimându-i imaginile, tot integral on-device. Marcajul și textul insignei sale "Runs on your device - nothing is uploaded" acoperă acum întregul set de transformare: Strip Hidden Data, Text Helper, Compress PDF, **Convert Image** (HEIC/TIFF/AVIF → WebP/JPG/PNG), **Convert Font**, **Redact** (distruge regiuni dintr-o imagine, SVG sau PDF), **Prompt to Image** și **Rebrand a Deck** (retematizează un `.pptx` pe loc) unde profilul îl montează. Aceasta este o categorie de utilitare pentru confidențialitate care înlocuiește predarea fișierelor confidențiale către site-uri cu scop unic.

![Sertarul Utilities, unde fiecare card este un instrument care transformă un fișier pe care îl ai deja](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=aud-utilities)

> Notă: `category` și `status` sunt denormalizate în `catalog/tools/index.json` (registrul pe care galeria îl citește) din fiecare `tool.json`. Manifestul este sursa de adevăr - indexul este **generat** de `npm run build:catalog`, iar `npm run validate:catalog` face CI să eșueze dacă indexul din commit se abate de la manifeste.

---

## Angajamente arhitecturale

Aceste decizii sunt stabilite. Schimbarea oricăreia dintre ele este un demers major - ele modelează fiecare altă decizie din codebase.

### 1. Instrumente declarative, cu o portiță de scăpare imperativă

Un instrument este un manifest (`tool.json`) + un template (`template.html`) + opțional `hooks.js`.

**Manifestul declară intrările.** Nu template-ul. Intrările nu sunt deduse din token-urile Handlebars. Manifestul este contractul; template-ul consumă variabile numite prin `{{id}}`.

![Stiva de controale a Street Map - un dropdown de oraș, un select de temă, cursoare de grosime și declanșatoare de culoare, fiecare dintre ele extras dintr-o linie din manifest](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

**Hook-urile sunt opționale.** Majoritatea instrumentelor sunt pur declarative - manifest + template este suficient. Instrumentele care au nevoie de valori calculate (codificare QR, modelarea datelor pentru grafice) furnizează `hooks.js` care expune funcții de ciclu de viață numite (`onInit`, `onInput`, `onFrame` - hook-ul per-cadru pentru camera live, pentru instrumentele reactive la mișcare - `onLevel`, `beforeExport`, `afterExport`, `exportFile` - calea de transformare fișier-in/fișier-out folosită de utilitarele on-device precum Strip Hidden Data - și `exportStill`, pentru un instrument care își deține propriul raster de adâncime). Host-ul încarcă hook-urile prin `new Function('host', …)`, cu bridge-ul de capabilități injectat ca domeniu de vizibilitate (closure). Acesta este un **contract de portabilitate, nu un sandbox de securitate**: hook-urile rulează în continuare în realmul paginii și *pot* accesa `window`/`fetch`/`document` într-un shell de browser - `host.*` este suprafața susținută, portabilă, nu o graniță impusă. Rezultatele hook-urilor asincrone sunt limitate în timp (`onInit` 5s, `onInput` 2s, `beforeExport`/`afterExport` 5s, `exportFile`/`exportStill` 10s), iar rezultatele întârziate sunt aruncate; un hook *sincron* scăpat de sub control nu poate fi întrerupt. Codul de hook nesigur, terț, nu este deci sigur de rulat până când izolarea prin Worker nu este livrată.

Asta contează pentru că: instrumentele declarative pot fi create de persoane care nu sunt dezvoltatori. Dacă fiecare instrument ar fi o aplicație web, nota de risc "competențe limitate pentru a crea/întreține template-uri de bază" devine un blocaj permanent.

### 2. Instrumentele și activele sunt date, nu cod împachetat

Aplicațiile web și Tauri preiau cataloagele de instrumente și active de la o adresă URL cunoscută la pornire, le pun în cache local și operează pe ce se află acolo. **Adăugarea unei noi plăci de eveniment sau a unui activ sezonier nu necesită o versiune nouă a aplicației.**

Byte-ii activelor sunt verificați prin checksum SHA-256 pentru a preveni otrăvirea CDN-ului. `id`-ul + `version`-ul activului determină invalidarea cache-ului.

### 3. Capability Bridge este singurul API pe care îl văd instrumentele

Instrumentele nu ating niciodată DOM-ul în afara zonei lor de template, nu apelează niciodată `fetch` direct, nu citesc niciodată sistemul de fișiere. Ele apelează metode `host.*` versionate. Definiția canonică a contractului este `packages/core/src/host-v1.ts` - SDK-ul pentru autori de instrumente `@lolly-tools/core`, astfel încât o terță parte poate construi pe baza lui fără să depindă de engine; `engine/src/bridge/host-v1.ts` este un re-export de tip al acestuia, iar codul din engine/shell continuă să importe din acea cale neschimbat:

| Bridge API | Ce face |
|---|---|
| `host.profile` | Prenumele, emailul, fotografia, orașul etc. utilizatorului. Precompletează intrările prin `bindToProfile`. |
| `host.assets` | Interogări în catalog, rezolvare de active, UI de selecție furnizat de host. |
| `host.state` | Salvează / încarcă sloturi de intrare. IndexedDB pe web, sistem de fișiere pe Tauri, memorie pe CLI. |
| `host.clipboard` | Scrie text sau imagine în clipboard (cu alternative specifice platformei). |
| `host.export` | Rasterizează sau serializează ținta de randare. Aplică watermark pentru instrumentele experimentale. |
| `host.net` | Fetch pe listă albă - disponibil doar dacă instrumentul a declarat capabilitatea `"network"`. (Niciun instrument livrat nu o folosește momentan.) |

Suprafețele opționale, aditive apar doar când un shell le furnizează. Unele sunt **condiționate de capabilitate** - expuse doar când instrumentul declară flag-ul corespunzător: `host.compose` (încorporează randarea altui instrument - `compose`), `host.capture` (captură de pagină pentru URL Screenshot - `capture`) și `host.recorder` (captură de microfon/cameră/ecran pentru instrumentele de înregistrare - `microphone` / `camera` / `screen`). Restul sunt **detectate după funcționalitate** - prezente ori de câte ori shell-ul le poate furniza, instrumentul păstrând o alternativă pentru shell-urile care nu pot.

Câteva suprafețe principale, ca să arate ce acoperă - [Host API](/info/host-api.html) le documentează pe fiecare, iar `packages/core/src/host-v1.ts` este chiar contractul:

| Interfață | Din versiunea | Ce adaugă |
|---|---|---|
| `host.tokens` | 1.0 | Tokenuri de design DTCG - primitivele proprii ale brandului |
| `host.text` | 1.0 | Conversie text-în-cale via HarfBuzz WASM (flagul de capabilitate `wasm` marchează instrumentele care depind de el) |
| `host.media` | 1.4 | Cadre live de la cameră care alimentează hook-ul `onFrame`. Îmbunătățire progresivă, în mod deliberat *ne*condiționată de flagul `camera` - un astfel de instrument funcționează în continuare ca un instrument obișnuit pentru imagini statice |
| `host.color` | 1.40 | Matematică perceptuală a culorii: ΔEOK, contrast WCAG + APCA, rampe OKLab, praguri de clasă, palete categoriale, scheme de armonie (1.60), amestecare CSS Color 4 și coacerea gradientelor (1.68). Pur și sincron - shell-urile atașează `makeColorApi()` al motorului în loc să implementeze ceva, astfel încât nu poate devia |
| `host.images` | 1.60 | Decodare / redimensionare / recodare de bytes pe dispozitiv - calea de conversie (HEIC → JPEG, comprimare în WebP, micșorare). Livrat în shell-ul web ca o fațadă leneșă, astfel încât decodorul HEIC nu ajunge niciodată în pachetul de pornire |
| `host.geom` | 1.64 | Geometrie vectorială exactă: operații booleene pe căi, offsetare, conversie contur-în-umplere, coborâre de spline-uri, simplificare, testare de coliziune. De asemenea pur, sincron și atașat din motor (`makeGeomApi()`); erorile sunt *returnate*, niciodată aruncate |

Restul urmează aceleași reguli și sunt documentate alături de ele: `pdf` (1.8) și `pptx` (1.58) pentru chirurgie de documente on-device, `audio` (1.71) și `speech` (1.96) pentru analiza clipurilor și TTS/transcriere on-device, `viz` (1.72) pentru contractul placeholder MilkDrop, `codec` (1.100) și `layers` (1.102) pentru ieșire bitmap pe biți adânci și stratificată, `upscale` (1.101) și `matte` (1.103) pentru modelele on-device, `raster` (1.105) pentru hook-uri care își fac propria muncă de pixeli, `connectors` (1.106) pentru săgeți sigure la export și `c2pa` (1.85) pentru semnarea byte-ilor finali. Numărul crește; regulile nu.

Capabilitățile declarabile sunt: `network`, `filesystem`, `clipboard`, `camera`, `microphone`, `screen`, `ffmpeg`, `wasm`, `capture`, `compose`. (`screen`, adăugată în 1.54, este captură de ecran prin `host.recorder` - utilizatorul alege un ecran/fereastră/tab în UI-ul nativ al browserului; diferită de `capture`, care rasterizează un URL numit chiar de instrument.)

Același instrument rulează în browser, Tauri și CLI headless pentru că fiecare shell implementează această interfață - instrumentul nu știe niciodată în care se află.

Bridge-ul este versionat. Adăugarea de metode este o versiune minoră. Eliminarea sau schimbarea semnăturilor este o creștere de versiune majoră. Când v2 apare, v1 trebuie să continue să funcționeze.

### 4. ID-urile activelor sunt pentru totdeauna

`suse/logo/primary` este un contract. Odată publicat:
- ID-ul nu se schimbă niciodată, nu este reutilizat niciodată.
- Modificări de byte-i → crește `version` în manifest.
- Înlocuit de un activ nou → setează `deprecated: true` și, opțional, `replacedBy`.
- Referințele existente se rezolvă întotdeauna.

Asta face ca stările de instrumente salvate și link-urile partajate prin URL să fie durabile de-a lungul anilor.

### 5. Modul URL este de prim rang

Fiecare intrare trebuie să poată fi exprimată ca parametru URL:

```
lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H
```

![Acel link, de unul singur, fără nimic altceva în el, este activul finalizat](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fsuse.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Modul CLI este modul URL sub un transport diferit - shell-ul CLI construiește un obiect de stare URL din argv și rulează **aceeași** conductă (pipeline) de engine. Există o singură cale de randare. CLI nu poate devia de la GUI pentru că nu este o implementare separată.

`url-mode.ts` gestionează round-trip-ul (parsare și serializare). Un set de **parametri rezervați** nu este niciodată transmis instrumentului ca intrări: controalele de ieșire (`format`, `export`, `copy`, `filename`, `width`/`w`, `height`/`h`, `unit`, `dpi`), butoanele de tipar și de proveniență (`bleed`, `marks`, `profile`, `password`, `c2pa`, `imprint`, `durable`, `meta`, `hdr`, `depth`, `cuts`) și purtătorii de stare (`template`, `z` - token-ul compactat "Shortest link" - și `zx`, la fel, dar criptat cu o parolă). Setul `RESERVED` din `engine/src/url-mode.ts` este autoritatea și este fixat printr-un test; [URL Mode](/info/url-mode.html) le documentează pe fiecare, inclusiv câteva neenumerate aici. Intrările de tip activ în modul URL sunt serializate prin `id`-ul lor; runtime-ul le rezolvă prin `host.assets.get()` înainte de hidratare. `width`/`height` sunt valori în `unit` (implicit `px`, de asemenea `mm`/`cm`/`in`/`pt`/`pc`); cu o unitate fizică, `dpi` stabilește rezoluția raster. Ele setează dimensiunea documentului canvas și precompletează panoul de dimensiuni de export.

Pentru că fiecare intrare călătorește în link, o schimbare de parametru înseamnă un alt activ finalizat. Toată această paletă este o culoare sămânță, o armonie și un număr de pași:

![Nouă pași pe patru nuanțe, toate crescute din culoarea-sămânță unică transportată în link](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

### 6. Stocarea trece prin bridge, nu direct

Web shell: IndexedDB. Tauri: sistem de fișiere. CLI: în memorie. Uneltele văd doar `host.state.save(slot, data)` și `host.state.load(slot)`. `localStorage` nu este folosit - este prea mic și nu poate stoca bloburi.

Utilizatorii pot salva mai multe sloturi de editare denumite per unealtă și pot reveni la fiecare sesiune ulterior. Nu este necesară crearea unui cont; starea este per dispozitiv. Deoarece bridge-ul este singura cusătură, această stare per dispozitiv este și *portabilă*: `shells/web/src/data-transfer.ts` citește totul înapoi prin `host.profile`/`host.state`/`host.assets` într-un singur zip `lolly-backup` care se importă pe orice altă instalare - răspunsul offline la "mutare pe un dispozitiv nou" care nu necesită server (specificație completă: `docs/data-transfer.md`). Integrarea SUSE ID (sincronizare multi-dispozitiv) este un obiectiv viitor peste această bază.

### 7. Etichetele de maturitate răspund prin design riscului de "aprobare de brand"

Fiecare unealtă declară `status: official | community | experimental` în manifestul ei. Galeria sortează după status. Uneltele experimentale filigranează automat exporturile - filigranul este aplicat de `host.export.render`, nu de unealtă, deci nu poate fi dezactivat de un autor de unelte neoficial.

Acesta este un răspuns structural la riscul de percepție conform căruia folosirea oricărei unelte implică aprobarea brandului. Răspunsurile de proces (o coadă de revizuire, restricționarea prin SUSE ID) se adaugă deasupra.

### 8. Intrările uneltei sunt tipizate prin manifest, inclusiv activele

Intrările declară un `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` și `file`. Host-ul randează un control generic per tip din manifest - uneltele nu scriu deloc cod pentru control. (Preumplerea din profilul utilizatorului nu este un tip - orice intrare poate purta `bindToProfile`.) Trei cântăresc mai mult decât restul:

- **`asset`** (cu `filter` și `allowUpload`) este puntea către sistemul global de active; `allowUpload: false` este pârghia de impunere a brandului pentru lucruri precum siglele de sponsorizare pe plăcuțe, unde sunt permise doar activele din bibliotecă. Încărcările utilizatorului folosesc aceeași formă `AssetRef` ca activele din bibliotecă, deci uneltele le gestionează identic.
- **`blocks`** este un grup de câmpuri repetitiv - un mini-tabel în interiorul unei singure intrări, editat într-un panou lateral, cu un meniu de adăugare tipizat/discriminat și câmpuri de active per bloc. Un clic pe un bloc randat pe canvas focalizează rândul acelui bloc. Folosit de `meeting-planner`, `chart-creator`, `event-name-badge`, `wayfinding-signage`, `color-block` și `digi-ad`.
- **`vector`** grupează un set fix de numere (de ex. o transformare) într-un singur control compus; **`file`** păstrează fișierul propriu al utilizatorului ca bytes în memorie pentru utilitare de transformare pe dispozitiv (de ex. `strip-data` și `compress-pdf`).

### 9. Șabloanele sunt fără logică (Handlebars, nu EJS)

Handlebars a fost ales în locul EJS în mod deliberat:
- Fără logică. Șabloanele pot fi create de non-dezvoltatori.
- Sigur în mod implicit. `{{x}}` face escape HTML; `{{{x}}}` este brut, doar prin alegere explicită.
- Fără JS arbitrar în șabloane înseamnă fără suprafață de audit XSS per șablon.

Logica trăiește în `hooks.js`, unde este explicită și revizuibilă. Helperi Handlebars disponibili: `{{default}}`, `{{upper}}`, `{{lower}}`, `{{eq}}`, `{{markdown}}`, `{{asset ref}}`, `{{asset ref "property"}}` (plus helperi de format de date `icsStamp`/`rfcText`/`csvCell` folosiți de șabloanele surori `.ics`/`.vcf`/`.csv`).

### 10. Uneltele compun unelte

O unealtă poate încorpora randarea unei **alte** unelte fără importuri unealtă-la-unealtă - compunerea este rezolvată de engine, niciodată de codul uneltei. Există două suprafețe:

- **Manifest declarativ** - `composes: [{ id, tool, inputs, format?, width?, height? }]`. Engine-ul randează copilul numit și plasează rezultatul în șablonul fără logică ca `{{asset <id>}}`. `event-name-badge` compune astăzi `qr-code` ca SVG.
- **URL de încorporare portabil** - `<img src="https://lolly.tools/tool/<id>.<ext>?<inputs>">`. Shell-ul randează acel copil **local** (un pixel substituent apare până când randarea locală se rezolvă); nimic nu este preluat vreodată de la `lolly.tools`.

Compune randarea oricărei unelte: un copil **SVG** rămâne un vector adevărat atunci când părintele exportă în SVG sau PDF și se rasterizează clar pentru PNG; copiii **PNG/JPG/WEBP** se încorporează ca imagini. Necesită capacitatea `compose`. Copiii compuși sunt intermediari - niciodată filigranați sau ștampilați cu proveniență - iar compunerea degradează controlat: un shell care nu poate randa un copil pur și simplu omite slotul, iar părintele tot se randează.

---

## Ce am ales în mod explicit să nu facem

- **Fără EJS / fără JS arbitrar în șabloane.** Suprafața XSS este zero. Logica trăiește în `hooks.js`.
- **Fără CMS de resurse obligatoriu.** Persoanele își introduc propriile fișiere creative direct în catalogul lor, în aplicație (vizualizarea [Catalog](/info/using.html) și Brand Studio) - fără server, fără consolă de administrare. Lucrarea se predă mai departe ca o **sesiune**: un link de partajare poartă întreaga stare, iar aceeași sesiune călătorește într-un backup sau printr-o sesiune de colaborare. Cine controlează deployment-ul poate apoi bloca o sesiune partajată ca **șablon** - deschide linkul, înregistrează valorile sale ca intrare de șablon în directorul acelui instrument din pachetul de brand și fă commit - după care apare în selectorul "New from template" al instrumentului și poate fi accesat direct ca `?template=<id>`. Git este pasul de blocare al deținătorului deployment-ului, niciodată al creatorului. Pentru un catalog *partajat, guvernat*, o organizație **poate** gestiona directorul de resurse în același mod și poate condiționa actualizările printr-o revizuire de PR - un model de guvernanță disponibil, nu o cerință a aplicației.
- **Fără RBAC forțat.** Aplicația deschisă este cu acces public implicit; riscul de brand este gestionat prin etichete de maturitate + filigrane. O organizație care vrea un control mai strict adaugă un strat cu propria autentificare și catalogul revizuit prin git de mai sus.
- **Fără bază de date centrală.** Toată starea utilizatorului este per dispozitiv. Integrarea SUSE ID este pe foaia de parcurs, dar nu este un blocaj pentru lansare.
- **Fără cale de cod comună pentru instrumente/engine.** Engine-ul este open source, la fel și instrumentele agnostice de brand din `community/`; un pachet de brand precum cel privat `brands/suse/` poartă propriile instrumente și catalog sub propriii termeni. În ambele cazuri, separarea este impusă (fără importuri încrucișate din `engine/` în conținutul instrumentelor), astfel încât divizarea rămâne curată.

---

## Ciclul de viață, de la un capăt la altul

Un utilizator deschide `lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H`:

1. **Pornire.** Shell-ul web deschide IndexedDB, construiește bridge-ul de capabilități, sincronizează cataloagele de unelte și active (sau încarcă din cache atunci când e offline).
2. **Rutare.** Hash-ul URL → vizualizarea `tool`, cu `qr-code` și parametrii URL extrași.
3. **Încărcare.** `loadTool('qr-code', fetchFile)` preia `tool.json`, validează față de JSON Schema, preia `template.html`, `styles.css` și sursa `hooks.js`.
4. **Analiza stării din URL.** `parseUrlState` traduce parametrii URL în valori inițiale de intrare. Referințele de active (`?logo=suse/logo/primary`) sunt analizate ca obiecte ușoare `{ id, _unresolved: true }`.
5. **Runtime.** `createRuntime(tool, host, initialValues)` construiește modelul de intrări (îmbinând datele de profil, valorile implicite și valorile inițiale), rezolvă referințele de active prin `host.assets.get()`, încarcă hook-urile (`host` cu scop de closure, nu izolat în sandbox), apelează `hooks.onInit`.
6. **Randare.** Shell-ul se abonează la runtime; la fiecare schimbare de stare primește `{ model, hydrated }`. Randează controalele de intrare din model și scrie HTML-ul șablonului hidratat în `#tool-canvas`.
7. **Interacțiune.** Utilizatorul tastează într-o intrare → `runtime.setInput(id, value)` → se aplică constrângerile → se apelează `hooks.onInput` → rehidratare → rerandare. Canvasul se actualizează live.
8. **Export.** Utilizatorul dă clic pe Download(PNG) → `runtime.export(canvasNode, 'png')` → `host.export.render` (rasterizează via dom-to-image-more; SVG/PDF trec prin vectorizatoare dedicate care parcurg DOM-ul) → blob → `host.export.download`. Gama de formate în care o unealtă se poate înscrie este largă, iar enumerarea `render.formats` din `schemas/tool.schema.json` este autoritatea în materie - rastere și rastere în virgulă mobilă, vectori și fișiere de decupaj, print/CMYK, mișcare, documente editabile (`pptx`, `docx`, `odt`), paletă și ieșiri de date/text, fișiere audio și de fonturi. [URL Mode](/info/url-mode.html) numește fiecare id și ce produce. Audio se află în acea enumerare ca oricare altceva (`wav`, `mp3`, `m4a`, `opus`, declarate de audiogramă și de uneltele de înregistrare); separat, modul `render.capture` al unei unelte de înregistrare conduce `host.recorder`, a cărui înregistrare sosește ca un Blob finalizat în orice container a înregistrat browserul. (Uneltele care setează `render.export: false` - de ex. Color Palette, Countdown Timer, Strip Hidden Data, Text Helper, Compress PDF - ascund controalele de descărcare/format/dimensiune.) Unitățile fizice sunt convertite per format aici (PDF → puncte de pagină reale, raster → pixeli la DPI cu un chunk `pHYs`). Metadatele de autor/proveniență (autor, unealtă, sursă - construite de `engine/src/metadata.ts`) sunt încorporate per format: PNG iTXt, JPEG EXIF, dicționar de informații PDF, SVG `<metadata>`, comentariu GIF. Uneltele experimentale primesc un filigran inserat de host, nu de unealtă.

![Panoul de export pe care `?options` îl deschide: perechea nume fișier și format, dimensiunea de ieșire și controalele care scriu fișierul](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Același ciclu de viață în Tauri. Același ciclu de viață în CLI - jsdom oferă DOM-ul headless; ieșirea merge într-un fișier sau la stdout.

---

## Statutul open-source

**Codul este MPL-2.0.** `engine/`, `shells/*`, `services/*`, `schemas/` și `docs/` sunt open source sub **MPL-2.0** - o platformă de schelărie (scaffolding) neutră din punct de vedere al furnizorului pentru instrumentele de brand, fiecare unitate livrabilă având propriul repository sub [github.com/lolly-tools](https://github.com/lolly-tools).

**Conținutul instrumentelor este livrat ca pachete de brand**, fiecare cu propriii termeni (vezi `NOTICE.md` al pachetului). `community/` este repository-ul public [`lolly-tools`](https://github.com/lolly-tools/lolly-tools), iar instrumentele sale agnostice de brand sunt tot MPL-2.0. `brands/suse/` este pachetul privat `suse-lolly`: instrumentele SUSE și catalogul SUSE, **proprietate SUSE**, inclusiv muzica sa licențiată PremiumBeat. `brands/lolly-start/` este brandul de pornire gol, deținut de acest repository. Fonturile sunt livrate în interiorul unui pachet sub **SIL Open Font License 1.1** - pachetul SUSE poartă fonturile SUSE și SUSE Mono.

`tools/` și `catalog/` din rădăcina repository-ului sunt *vizualizări* ignorate de git: un profil le asamblează din `community/` plus pachetul de brand activ, motiv pentru care fiecare script și shell citește aceste două căi și niciodată un pachet direct.

Separarea este impusă - nu există importuri încrucișate din `engine/` în conținutul instrumentelor - astfel încât granița dintre platformă și conținut rămâne curată.

---

## Unde se termină engine-ul și unde începe host-ul

Dacă poate fi descris în date pure + Handlebars → **engine**.
Dacă atinge DOM-ul, sistemul de fișiere, rețeaua sau orice API de browser/OS → **host**.

Linia este trasă tranșant, intenționat. Engine-ul este partea open-source. Tot ce cunoaște SUSE, platforme specifice sau medii de runtime rămâne în afara lui.

Pentru următorul nivel de detaliu, [`engine/README.md`](../engine/README.md) enumeră fiecare modul al engine-ului și de ce este responsabil, iar [Threat Model & Trust Boundaries](/info/threat-model.html) consemnează unde aceeași linie funcționează și ca graniță de încredere.
