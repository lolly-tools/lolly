# Panoramica

![Icona di Lolly - Grande lecca-lecca verde e bianco](/info/icon.svg)

Questo documento riassume lo scopo, la struttura e le decisioni architetturali della piattaforma Lolly. Riflette sia la visione del prodotto sia lo stato attuale del codice.

> **Stato:** Lolly è un prototipo interno in un **pilota chiuso non ancora completato**. Il motore è deterministico e internamente coerente, ma il prodotto è agli inizi - SUSE è il cliente numero uno - e i suoi motori di crittografia e di parsing dei file sono attualmente sottoposti al rigido irrobustimento infrastrutturale di SUSE, in preparazione alla scala enterprise (in questo siamo davvero bravi). Leggi l'architettura qui sotto come intento progettuale in fase di test, non come un prodotto finito e certificato. Vedi [Adozione e Governance](/info/adoption-governance.html#status) per come viene condotto e misurato il pilota.

> **Come leggere questa pagina.** Contiene due tipi di materiale, in ordine. La prima metà spiega
> **perché esiste**: il problema, il posizionamento e il ciclo di vita che attraversa un singolo asset.
> Da [Il quadro d'insieme](#the-big-picture-how-the-layers-fit) in poi si tratta di
> **come si incastrano i livelli**: il documento di architettura per chi contribuisce, che copre la
> separazione motore/shell/pacchetto, la struttura del repository, gli obiettivi di distribuzione e gli
> impegni che vincolano ogni modifica alla piattaforma. Se sei qui per modificare il codice anziché per
> capire il prodotto, inizia dal quadro d'insieme.
>
> Due documenti complementari approfondiscono più di questa pagina. [`engine/README.md`](../engine/README.md) nel
> repository è la mappa del motore modulo per modulo, con una tabella generata di ogni modulo e
> di cosa analizza o scrive. [Modello di minaccia e confini di fiducia](/info/threat-model.html)
> è la stessa architettura letta in termini di confini di fiducia, ed è la pagina giusta per qualsiasi domanda su
> cosa il motore considera non attendibile.

---

## Perché esiste

I team affrontano un problema ricorrente: lavoro creativo e di contenuto ripetibile che è troppo prevedibile per giustificare mani esperte ogni volta, ma troppo sensibile alla qualità per essere delegato senza vincoli. Il risultato è una produttività lenta (collo di bottiglia dello specialista), incoerenza (persone che usano qualsiasi strumento hanno a disposizione) oppure dipendenza dal fornitore (un DAM SaaS che controlla i tuoi template).

Questa piattaforma è la risposta diretta:

> **Contenuti e creatività programmatici su larga scala** - generazione di asset a lavoro zero, con le regole sotto controllo centrale, per dipendenti, fornitori e partner.

Lolly non è il posto dove nasce un design system - è il posto dove viene prodotto. Pensalo come un distributore automatico per il design: fai una selezione, ottieni un risultato. Ogni volta. Il motore lavora per la massima qualità che ogni formato può produrre sull'hardware che hai davanti, e lo stesso motore crea lo stesso file su ogni piattaforma su cui viene distribuito.

Il risultato è **abbondanza**: ogni evento ha la segnaletica corretta, ogni avviso CVE rispetta lo stile della casa, ogni etichetta si stampa pulita, ogni firma email è aggiornata - tutto senza un ticket di design. La piattaforma gestisce la creatività ricorrente e operativizzata. Deliberatamente non è uno strumento creativo su misura - i designer continuano a possedere il lavoro di punta.

### Innova in modo probabilistico, scala in modo deterministico

Ogni discussione sull'IA in una pipeline creativa si arena sulla stessa domanda: quale parte di questo è compito della macchina? È una domanda antica con una risposta consolidata. Amanuensi e miniaturisti già lavoravano tra due strumenti - lo schizzo libero, dove nulla era fissato e tutto poteva essere provato, e la stampa a caratteri mobili, intimidatoria proprio perché si impegnava. Gli schizzi erano dove nasceva l'arte. La stampa era il modo in cui raggiungeva chiunque. Nessuno confondeva i due, ed entrambi continuavano a progredire - nuovi inchiostri, nuovi caratteri, nuove presse - migliorando ciascuno in armonia con l'arte e l'intento che servivano.

Lolly traccia la stessa linea. Esplora in modo probabilistico: un modello, un designer, un'idea abbozzata, un prompt che va da qualche parte che nessuno aveva pianificato. Poi scala in modo deterministico - ciò che raggiunge diecimila output è uno *strumento*, e uno strumento si renderizza allo stesso modo ogni volta a partire da input che puoi leggere. L'esplorazione resta libera perché nulla a valle dipende dal fatto che approdi due volte nello stesso modo. L'output guadagna fiducia perché non è un'ipotesi. Portare la sperimentazione con l'IA verso risultati prevedibili e riproducibili non è una disciplina nuova; è la stessa divisione del lavoro che ha reso affidabile il lavoro a stampa fin dall'inizio.

> Fidati del processo creativo, scala con rigore.

### Contro le alternative

::: figure positioning-comparison
Completezza delle capacità tra gli strumenti creativi odierni, ricercata ad agosto 2026. Punteggio: 0 assente, 25 livello soluzione di ripiego, 50 reale ma limitato o parziale, 75 solido con avvertenze, 100 competenza centrale.
:::

Il divario è evidente: nulla di ciò che è oggi disponibile offre output prima-vincoli, capace di funzionare offline, a basso livello di competenza e accessibile internamente. Lolly include persino una tela aperta - **Design** - dove colori, tipografia e asset si conformano ai globali del brand, così l'organizzazione libera resta prima-vincoli. Ciò che **non** è, è una suite di design non vincolata: i designer continuano a usare Illustrator e Figma per il lavoro di punta su misura. Le permutazioni possono essere assemblate con questo strumento.

![Ogni strumento della libreria come scheda, raggruppato per categoria, così un produttore ne sceglie uno e inizia](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=aud-gallery-landscape)

**Usalo per:** Generazione rapida di asset creativi operativizzati - riquadri per eventi, badge nominativi, firme, avvisi CVE, codici QR, card social, etichette di spedizione, report strutturati.

**Non usarlo per:** Contenuti hero su misura.

---

## Il ciclo di vita di una campagna

Il modo più chiaro per vedere cos'è Lolly non è un elenco di funzionalità - è seguire un singolo asset mentre passa di mano in mano. Osserva una card di campagna localizzata mentre attraversa l'organizzazione:

1. **Il creativo stabilisce le regole.** Un designer crea il template di base nello strumento Design, codificando la tipografia e le variabili di colore del brand. Non sta creando una sola card - sta facendo il lavoro fondamentale *una volta sola* per non doverla mai più localizzare a mano.
2. **Lo sviluppatore lo scala.** Lo stesso template viene collegato a una pipeline notturna tramite la CLI, così un nuovo grafico o una nuova variante linguistica viene generata automaticamente - nessun designer riapre il file.
3. **Il produttore semplicemente lo usa.** Un rappresentante di vendita, offline su un aereo, apre lo stesso strumento e genera un deck perfettamente in linea con il brand per un incontro con un cliente. Nessuna competenza di design, nessuna rete, nessuna attesa.

Il "nuovo grafico" del secondo passaggio è un rendering come questo, prodotto da una stringa di dati e da alcuni parametri senza che nessuno apra un file di design:

![Un grafico ad area impilata con titolo, le sue tre serie a bande in una palette fredda con assi, legenda e titolo posizionati tutti dal modello anziché a mano](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Il punto non è che Lolly sia buono per i designer *e* buono per gli sviluppatori *e* buono per le vendite, ciascuno nel vuoto. È una **staffetta**: il lavoro iniziale del creativo viene scalato dallo sviluppatore, che a sua volta abilita il produttore. L'esperienza senza sforzo per il rappresentante non tecnico sull'aereo è possibile solo grazie al rigore fissato dal designer e implementato dallo sviluppatore.

Questo è il moltiplicatore di forza. Lolly non è un cassetto di strumenti separati per ruoli separati - è un unico ciclo di vita deterministico dell'asset che ogni ruolo tocca, e ogni passaggio di mano moltiplica il valore del precedente.

---

## Un'approvazione, diecimila asset

Poiché l'approvazione risiede nello strumento e non nel file (vedi [Come si confronta Lolly](/info/positioning.html)), scalare smette di essere un problema di revisione. Approva una volta uno strumento per card social localizzate, poi genera **10.000 asset in 12 lingue** da un foglio di calcolo - e nessuno di essi richiede un nuovo controllo di conformità da parte del legale o del brand, perché il template da cui provengono tutti era già stato approvato.

Lo stesso strumento deterministico raggiunge quella scala in tre modi, tutti producendo un output identico e pre-approvato:

- <!--i:people--> **Una persona, nell'app.** La griglia batch `/pro`: incolla o importa le righe, ottieni un asset finito per riga, scarica lo zip. Nessuna competenza di design, nessun ticket, nessuna attesa.
- <!--i:code--> **Uno sviluppatore, dalla riga di comando.** La CLI esegue *lo stesso* motore e *lo stesso* percorso di rendering in modalità headless, così lo strumento può essere sequenziato su tutte le 10.000 righe in uno script o in una pipeline notturna. Una chiamata `lolly <tool> --field=…` in un ciclo è l'intera integrazione.
- <!--i:cpu--> **Un sistema o un agente IA, tramite MCP.** Lo stesso strumento azionato in modo programmatico, alla stessa fedeltà e su una scala ancora maggiore - perché una macchina non si annoia mentre arrivano migliaia di file.

![La modalità Batch su un'installazione appena fatta: una riga vuota in attesa di uno strumento, con l'intera superficie tipo foglio di calcolo e il suo pulsante Rendi già al loro posto prima che arrivino dati](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

Un insieme di vincoli di brand, fissato una volta da un designer; tre percorsi verso lo stesso output identico e pre-approvato - e il percorso macchina scala più di tutti gli altri, perché non si stanca mai mentre i file arrivano.

---

## Il quadro d'insieme: come si incastrano i livelli

Tutto da qui in poi è architettura. Il diagramma è l'intero sistema in un'unica vista: gli strumenti sono
dati in alto, il motore al centro non conosce nulla di alcuna piattaforma, le shell sotto di esso
implementano un unico contratto, e i cataloghi forniscono il contenuto.

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

### Struttura del repository

I contenuti sono montati come pacchetti: `community/`, `docs/`, ogni `shells/*`, sia `services/*` sia `brands/suse` sono ciascuno un proprio repository, estratto come sottomodulo git di questo. Il repository genitore possiede `engine/`, `schemas/`, `scripts/`, `tests/`, `api/`, `brands/lolly-start/` e `profiles.json`. Vedi [Guida alla build » Ottenere il codice sorgente](/info/build-guide.html) per il comando di checkout e il flusso di lavoro multi-repository.

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

## Modello di distribuzione della piattaforma

La piattaforma funziona su diverse superfici - PWA web, desktop/mobile Tauri, la CLI scriptabile e la TUI interattiva. Tutte usano lo stesso motore e gli stessi file degli strumenti.

### Web (PWA) - distribuzione principale
Ospitata su un URL controllato da SUSE. Funziona offline una volta che il service worker ha memorizzato nella cache strumenti e asset. È qui che la maggior parte di dipendenti, fornitori e partner userà la piattaforma. Nessun account richiesto - lo stato è memorizzato in IndexedDB per dispositivo.

La shell web è responsive a partire da un unico layout. Su desktop uno strumento è una barra laterale di controlli ridimensionabile accanto a un piano di anteprima con navigazione della tela nativa per trackpad (Cmd/Ctrl-rotellina o pizzico per zoomare intorno al cursore, trascinamento con Spazio o con il tasto centrale per spostarsi, i tasti `0`/`1`/`+`/`−` e un HUD Adatta/%). Su mobile (≤640px) i controlli diventano un foglio ancorato in alto con una maniglia trascinabile che si aggancia a sguardo/metà/pieno (il tocco commuta) sopra un'anteprima statica a schermo intero, e un pulsante flottante **Render** apre i controlli di **Esportazione** in un popup a foglio inferiore. Il tocco offre pizzico per zoomare e trascinamento per spostarsi sull'anteprima. Il percorso di rendering e i controlli di esportazione sono identici in entrambi i casi - solo l'interfaccia si riorganizza.

![La vista divisa desktop - i controlli generati dal manifest a sinistra, il canvas live a destra](/t/url-shot?url=%2F%23%2Ftool%2Fchart-creator&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=aud-web-split)

Lo stesso strumento in larghezza telefono, senza un secondo layout da mantenere: i controlli diventano un foglio in alto, l'anteprima occupa tutto lo schermo e la pillola di rendering fluttua sopra.

![Un audiogramma su uno schermo largo 430px - il foglio dei controlli sopra, l'artwork quadrato finito sotto e la pillola di rendering flottante](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

**Modalità batch (`/pro`).** La shell web include anche una griglia batch in stile foglio di calcolo (`shells/web/src/pro/`) che renderizza molte righe insieme su uno o più strumenti. Gestisce round-trip CSV/TSV più incolla da foglio di calcolo, template/formato/dimensione/unità/dpi per riga, un pannello laterale editor di blocchi con anteprima live, colonne di export comprimibili, una barra di tag "rilevanza" per riga, riordino righe con maniglia di trascinamento a sinistra, conferma di eliminazione in due passaggi, sessioni batch salvate e download in `.zip`. È la superficie uno-a-molti dietro il posizionamento "generazione di contenuti di massa".

### Tauri desktop / mobile
App nativa pacchettizzata (footprint ridotto grazie a Tauri). Offre piena disponibilità offline, accesso al filesystem per gli strumenti che dipendono dalla CLI (PDF Smasher, Font Outliner) e accesso alla fotocamera. Prevista per un potenziamento degli strumenti a metà 2026.

### CLI
`lolly <tool-id> [--input=value ...] --output=file.png`

Gli utenti desktop possono richiamare molti strumenti dal terminale. La shell CLI carica lo stesso motore, crea un DOM jsdom, esegue lo stesso percorso di rendering e scrive il file. La URL mode è il trasporto - la CLI non è un'implementazione separata. Questo garantisce che gli output di CLI e GUI siano identici.

```bash
lolly qr-code --url=https://suse.com --output=qr.svg
lolly quotes --quote="Ship it." --output=quote.png
lolly                        # lists available tools
lolly qr-code                # lists inputs for that tool
```

### TUI
`npm run tui`

La controparte interattiva della CLI: un'app da terminale a schermo intero e keyboard-first (costruita su Ink) per sfogliare gli strumenti, compilare gli input, salvare progetti ed esportare - tutto senza GUI. Il suo host bridge **riutilizza l'implementazione della CLI** per i formati DOM-free (SVG/EMF/EPS/HTML + testo/dati), e aggiunge stato su disco sotto `~/.lolly` più un'anteprima inline opzionale. Oltre a questo ha un **livello di rendering via browser**: un Chromium headless dedicato (lo stesso installato dal server MCP) che produce raster/PDF/video e cattura di URL live su richiesta - guidando una copia buildata della shell web così che l'output sia identico, e avviandosi solo al primo export di un formato del genere. Così `url-shot` (con crop + ricolorazione + PDF/SVG vettoriale) e ogni strumento raster/pdf funzionano anche nel terminale. Vedi la [guida TUI](/info/tui.html).

Su qualunque superficie ti trovi, la scheda Capabilities della dashboard è la mappa completa di ciò che la piattaforma dichiara di saper fare, raggruppata e leggibile senza aprire un solo strumento.

---

## Categorie di strumenti

Gli strumenti sono etichettati con una `category` nel loro manifest per il raggruppamento nella galleria.

Le righe sono elencate nell'ordine delle sezioni della galleria. La sezione `utility` viene sempre renderizzata **per ultima** nella galleria (dopo ogni altra categoria, incluse quelle future) - è il cassetto "Offline Utilities" on-device.

| Categoria | Esempi | Previsto |
|---|---|---|
| `everyone` | QR Code Generator, Quote Card, Email Signature, Logo, Wordmark, Audiogram, Battlecards, Sequence Studio, Record | Employee Image Stationery |
| `designer` | Brand Lockup, Design, Chart, Darkroom, Filter, Pose Geeko, Multi-Page PDF | Font Outliner |
| `event` | Meeting Planner, Event Name Badge, Wayfinding Signage, Calendar ICS, Booth Studio | Event Stationery, Bulk Name Badges, Room Agenda Cards |
| `product` | - | CVE Alert, Product Release Announcement, Blog OG Image |
| `utility` | Strip Hidden Data, Text Helper, Compress PDF, Convert Image, Convert Font, Redact, Run Web Code, Screen Capture, URL Screenshot | Unit/format converters, more on-device privacy utilities |

Quelle celle sono **esempi, non inventari**. Quali strumenti esistano è una proprietà del profilo che hai montato, non di questa pagina: un pacchetto brand aggiunge i propri, e può escludere uno strumento community che preferisce non distribuire. `catalog/tools/index.json` - generato dai manifest, ed è il registro che la galleria legge davvero - è la lista autorevole; per contare cosa monta un profilo, conta i manifest (`ls community/*/tool.json brands/*/tools/*/tool.json`) invece di fidarti di un numero scritto qui. (Un id di strumento presente in due pacchetti viene montato una sola volta, dal pacchetto vincente.)

Gli strumenti sono anche classificati per stato: `official` (approvato dal brand, senza watermark), `community` (contributo esterno), `experimental` (export con watermark). Gran parte della libreria è `official`; gli studio più recenti e gli strumenti di cattura tendono a stare su `community` o `experimental` mentre si consolidano. Ogni superficie mostra il badge, così chi legge sa cosa sta prendendo prima di aprirlo - e, come le celle delle categorie sopra, l'appartenenza per stato cambia troppo in fretta per essere elencata qui. Leggila dalla galleria o dall'indice generato.

**Design** è il primo strumento costruito sulla modalità canvas libero `render.layout: "editor"` - una superficie senza chrome a manipolazione diretta dove trascini, ridimensioni, ruoti e agganci box di testo, forme e immagini, poi esporti attraverso lo stesso percorso di rendering di ogni altro strumento.

**Strip Hidden Data** è la prima **utility on-device** (`privacy: "on-device"`): uno strumento di trasformazione dei contenuti che prende un file fornito *da te*, lo elabora interamente nel browser e restituisce una copia pulita - mai caricata, mai marcata con watermark, nessuna provenienza timbrata. **Text Helper** è il secondo - un banco di lavoro on-device per i lavori quotidiani da incollare in un sito web (formattazione JSON, decodifica JWT, Base64, codifica/decodifica URL, hashing SHA). **Compress PDF** è il terzo - riduce un PDF ricomprimendone le immagini, sempre interamente on-device. Il marcatore e il testo del badge "Runs on your device - nothing is uploaded" ora coprono l'intero insieme di trasformazioni: Strip Hidden Data, Text Helper, Compress PDF, **Convert Image** (HEIC/TIFF/AVIF → WebP/JPG/PNG), **Convert Font**, **Redact** (distrugge regioni di un'immagine, SVG o PDF), **Prompt to Image** e **Rebrand a Deck** (ri-tematizza un `.pptx` sul posto) dove il profilo lo monta. È una categoria di utility per la privacy che sostituisce la consegna di file confidenziali a siti web monofunzione.

![Il cassetto Utilities, dove ogni card è uno strumento che trasforma un file che hai già](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=aud-utilities)

> Nota: `category` e `status` sono denormalizzati in `catalog/tools/index.json` (il registro che la galleria legge) a partire da ogni `tool.json`. Il manifest è la fonte di verità - l'indice è **generato** da `npm run build:catalog` e `npm run validate:catalog` fallisce in CI se l'indice committato diverge dai manifest.

---

## Impegni architetturali

Queste decisioni sono definitive. Cambiarne una qualsiasi è un'impresa importante - condizionano ogni altra decisione nel codebase.

### 1. Strumenti dichiarativi, con una via di fuga imperativa

Uno strumento è un manifest (`tool.json`) + un template (`template.html`) + `hooks.js` opzionale.

**Il manifest dichiara gli input.** Non il template. Gli input non vengono dedotti dai token Handlebars. Il manifest è il contratto; il template consuma variabili con nome tramite `{{id}}`.

![Lo stack di controlli di Street Map - un menu a tendina città, una select tema, slider di spessore e trigger colore, ognuno tratto da una riga del manifest](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

**Gli hook sono opzionali.** La maggior parte degli strumenti è puramente dichiarativa - manifest + template bastano. Gli strumenti che richiedono valori calcolati (codifica QR, formattazione dati dei grafici) forniscono `hooks.js` che espone funzioni di ciclo di vita con nome (`onInit`, `onInput`, `onFrame` - l'hook per frame della fotocamera live per strumenti motion-reactive - `onLevel`, `beforeExport`, `afterExport`, `exportFile` - il percorso di trasformazione file-in/file-out usato dalle utility on-device come Strip Hidden Data - e `exportStill`, per uno strumento che gestisce il proprio raster profondo). L'host carica gli hook tramite `new Function('host', …)` con il capability bridge iniettato come closure scope. Questo è un **contratto di portabilità, non una sandbox di sicurezza**: gli hook girano comunque nel realm della pagina e *possono* raggiungere `window`/`fetch`/`document` in una shell browser - `host.*` è la superficie supportata e portabile, non un confine imposto. I risultati degli hook asincroni sono a tempo (`onInit` 5s, `onInput` 2s, `beforeExport`/`afterExport` 5s, `exportFile`/`exportStill` 10s) e i risultati tardivi vengono scartati; un hook *sincrono* fuori controllo non può essere prelazionato. Il codice hook di terze parti non fidato non è quindi sicuro da eseguire finché non arriverà l'isolamento tramite Worker.

Questo conta perché: gli strumenti dichiarativi possono essere scritti da non sviluppatori. Se ogni strumento fosse una web app, la nota di rischio "competenze limitate per creare/mantenere template workhorse" diventerebbe un collo di bottiglia permanente.

### 2. Strumenti e asset sono dati, non codice pacchettizzato

Le app web e Tauri recuperano i cataloghi di strumenti e asset da un URL noto all'avvio, li mettono in cache localmente e operano su ciò che c'è. **Aggiungere una nuova tile evento o un asset stagionale non richiede una release dell'app.**

I byte degli asset hanno checksum SHA-256 per prevenire il poisoning del CDN. `id` + `version` dell'asset guidano l'invalidazione della cache.

### 3. Il Capability Bridge è l'unica API che gli strumenti vedono

Gli strumenti non toccano mai il DOM al di fuori della loro area template, non chiamano mai `fetch` direttamente, non leggono mai il filesystem. Chiamano metodi `host.*` versionati. La definizione canonica del contratto è `packages/core/src/host-v1.ts` - l'SDK per autori di strumenti `@lolly-tools/core`, così una terza parte può costruirci sopra senza dipendere dal motore; `engine/src/bridge/host-v1.ts` ne è una re-esportazione di tipo, e il codice del motore/delle shell continua a importare da quel percorso senza modifiche:

| API del bridge | Cosa fa |
|---|---|
| `host.profile` | Nome, email, foto profilo, città ecc. dell'utente. Pre-compila gli input tramite `bindToProfile`. |
| `host.assets` | Query sul catalogo, risoluzione degli asset, UI di selezione fornita dall'host. |
| `host.state` | Salva / carica slot di input. IndexedDB su web, filesystem su Tauri, memoria su CLI. |
| `host.clipboard` | Scrive testo o immagine negli appunti (con fallback per piattaforma). |
| `host.export` | Rasterizza o serializza il target di rendering. Applica il watermark per gli strumenti experimental. |
| `host.net` | Fetch con allowlist - disponibile solo se lo strumento ha dichiarato la capability `"network"`. (Nessuno strumento in distribuzione la usa attualmente.) |

Le superfici opzionali e additive compaiono solo quando una shell le fornisce. Alcune sono **gated per capability** - esposte solo quando lo strumento dichiara il flag corrispondente: `host.compose` (incorpora il rendering di un altro strumento - `compose`), `host.capture` (cattura pagina per URL Screenshot - `capture`) e `host.recorder` (cattura microfono/fotocamera/schermo per gli strumenti di registrazione - `microphone` / `camera` / `screen`). Le altre sono **feature-detected** - presenti ogniqualvolta la shell può fornirle, con lo strumento che mantiene un fallback per le shell che non possono.

Una manciata di superfici principali, per mostrare cosa copre - [Host API](/info/host-api.html) documenta ognuna, e `packages/core/src/host-v1.ts` è il contratto stesso:

| Superficie | Da | Cosa aggiunge |
|---|---|---|
| `host.tokens` | 1.0 | Token di design DTCG - le primitive proprie del marchio |
| `host.text` | 1.0 | Testo-a-tracciato tramite HarfBuzz WASM (il flag di capacità `wasm` contrassegna gli strumenti che ne dipendono) |
| `host.media` | 1.4 | Fotogrammi camera dal vivo che pilotano l'hook `onFrame`. Miglioramento progressivo, deliberatamente *non* vincolato dal flag `camera` - un tale strumento funziona comunque come un normale strumento per immagini statiche |
| `host.color` | 1.40 | Matematica del colore percettiva: ΔEOK, contrasto WCAG e APCA, rampe OKLab, soglie di classe, palette categoriche, schemi di armonia (1.60), miscelazione CSS Color 4 e cottura dei gradienti (1.68). Puro e sincrono - le shell collegano il `makeColorApi()` del motore invece di implementare qualcosa, quindi non può divergere |
| `host.images` | 1.60 | Decodifica / ridimensiona / ricodifica byte sul dispositivo - il percorso di conversione (HEIC → JPEG, compressione in WebP, riduzione di scala). Distribuito nella shell web come facciata pigra, così il decodificatore HEIC non entra mai nel chunk di avvio |
| `host.geom` | 1.64 | Geometria vettoriale esatta: booleani di tracciati, offset, da contorno a riempimento, riduzione di spline, semplificazione, rilevamento delle collisioni. Anch'esso puro, sincrono e collegato dal motore (`makeGeomApi()`); i fallimenti vengono *restituiti*, mai sollevati |

Il resto segue le stesse regole ed è documentato insieme a esse: `pdf` (1.8) e `pptx` (1.58) per la chirurgia di documenti on-device, `audio` (1.71) e `speech` (1.96) per l'analisi delle clip e TTS/trascrizione on-device, `viz` (1.72) per il contratto placeholder MilkDrop, `codec` (1.100) e `layers` (1.102) per output deep-bit e bitmap a livelli, `upscale` (1.101) e `matte` (1.103) per i modelli on-device, `raster` (1.105) per hook che fanno da soli il lavoro sui pixel, `connectors` (1.106) per frecce export-safe e `c2pa` (1.85) per firmare byte finiti. Il conteggio cresce; le regole no.

Le capability dichiarabili sono: `network`, `filesystem`, `clipboard`, `camera`, `microphone`, `screen`, `ffmpeg`, `wasm`, `capture`, `compose`. (`screen`, aggiunta nella 1.54, è cattura dello schermo tramite `host.recorder` - l'utente sceglie uno schermo/finestra/scheda nella UI nativa del browser; distinta da `capture`, che rasterizza un URL indicato dallo strumento stesso.)

Lo stesso strumento gira su browser, Tauri e CLI headless perché ogni shell implementa questa interfaccia - lo strumento non sa mai in quale si trova.

Il bridge è versionato. Aggiungere metodi è una versione minor. Rimuovere o cambiare firme è un bump di versione major. Quando uscirà v2, v1 dovrà continuare a funzionare.

### 4. Gli ID degli asset sono per sempre

`suse/logo/primary` è un contratto. Una volta pubblicato:
- L'ID non cambia mai, non viene mai riutilizzato.
- Cambi ai byte → incrementa `version` nel manifest.
- Sostituito da un nuovo asset → imposta `deprecated: true` e opzionalmente `replacedBy`.
- I riferimenti esistenti si risolvono sempre.

Questo rende gli stati salvati degli strumenti e i link condivisi via URL durevoli negli anni.

### 5. La URL mode è di prima classe

Ogni input deve essere esprimibile come parametro URL:

```
lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H
```

![Quel link da solo, senza nient'altro, è l'asset finito](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fsuse.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

La modalità CLI è la URL mode sotto un trasporto diverso - la shell CLI costruisce un oggetto di stato URL a partire da argv ed esegue la **stessa** pipeline del motore. C'è un solo percorso di rendering. La CLI non può divergere dalla GUI perché non è un'implementazione separata.

`url-mode.ts` gestisce il round-trip (parsing e serializzazione). Un insieme di **parametri riservati** non viene mai inoltrato allo strumento come input: i controlli di output (`format`, `export`, `copy`, `filename`, `width`/`w`, `height`/`h`, `unit`, `dpi`), i quadranti di stampa e provenienza (`bleed`, `marks`, `profile`, `password`, `c2pa`, `imprint`, `durable`, `meta`, `hdr`, `depth`, `cuts`) e i portatori di stato (`template`, `z` - il token compattato "Shortest link" - e `zx`, lo stesso cifrato con una password). L'insieme `RESERVED` in `engine/src/url-mode.ts` è l'autorità ed è fissato da un test; [URL Mode](/info/url-mode.html) documenta ognuno di essi, inclusa la manciata non elencata qui. Gli input di tipo asset in URL mode vengono serializzati tramite il loro `id`; il runtime li risolve via `host.assets.get()` prima dell'idratazione. `width`/`height` sono valori in `unit` (predefinito `px`, anche `mm`/`cm`/`in`/`pt`/`pc`); con un'unità fisica `dpi` imposta la risoluzione raster. Impostano la dimensione del documento canvas e pre-compilano il pannello delle dimensioni di export.

Poiché ogni input viaggia nel link, un cambio di parametro è un asset finito diverso. Questa intera palette è un solo colore seme, un'armonia e un numero di passi:

![Nove passaggi su quattro tonalità, tutti generati dal singolo colore seme trasportato nel link](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

### 6. L'archiviazione passa dal bridge, non diretta

Web shell: IndexedDB. Tauri: filesystem. CLI: in memoria. I tool vedono solo `host.state.save(slot, data)` e `host.state.load(slot)`. `localStorage` non è usato - è troppo piccolo e non può contenere blob.

Gli utenti possono salvare più slot di modifica con nome per ogni tool e tornare a ogni sessione in seguito. Non è richiesta la creazione di un account; lo stato è per dispositivo. Poiché il bridge è l'unico punto di passaggio, quello stato per dispositivo è anche *portabile*: `shells/web/src/data-transfer.ts` rilegge tutto tramite `host.profile`/`host.state`/`host.assets` in un unico zip `lolly-backup` che si importa su qualsiasi altra installazione - la risposta offline a "passa a un nuovo dispositivo" che non richiede un server (specifica completa: `docs/data-transfer.md`). L'integrazione con SUSE ID (sincronizzazione multi-dispositivo) è una milestone futura costruita sopra questo.

### 7. I tag di maturità rispondono per design al rischio "approvato dal brand"

Ogni tool dichiara `status: official | community | experimental` nel proprio manifest. La galleria ordina per status. I tool sperimentali filigranano automaticamente i propri export - la filigrana è applicata da `host.export.render`, non dal tool, quindi non può essere disattivata da un autore di tool non ufficiale.

Questa è una risposta strutturale al rischio di percezione secondo cui usare un qualsiasi tool implichi approvazione del brand. Le risposte di processo (una coda di revisione, il gating via SUSE ID) si aggiungono sopra.

### 8. Gli input dei tool sono tipizzati tramite il manifest, asset inclusi

Gli input dichiarano un `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` e `file`. L'host renderizza un controllo generico per ogni tipo a partire dal manifest - i tool non scrivono codice di controllo. (Il pre-riempimento dal profilo utente non è un tipo - qualsiasi input può portare `bindToProfile`.) Tre pesano più degli altri:

- **`asset`** (con `filter` e `allowUpload`) è il ponte verso il sistema di asset globale; `allowUpload: false` è la leva di applicazione del brand per cose come i loghi delle tile di sponsorizzazione, dove sono ammessi solo asset di libreria. I caricamenti dell'utente usano la stessa forma `AssetRef` degli asset di libreria, quindi i tool li gestiscono in modo identico.
- **`blocks`** è un gruppo di campi ripetuto - una mini-tabella dentro un unico input, modificata in un pannello laterale, con un menu di aggiunta tipizzato/discriminato e campi asset per blocco. Cliccare un blocco renderizzato sul canvas mette a fuoco la riga di quel blocco. Usato da `meeting-planner`, `chart-creator`, `event-name-badge`, `wayfinding-signage`, `color-block` e `digi-ad`.
- **`vector`** raggruppa un insieme fisso di numeri (ad esempio una trasformazione) in un unico controllo composto; **`file`** contiene il file dell'utente stesso come byte in memoria per utilità di trasformazione on-device (ad esempio `strip-data` e `compress-pdf`).

### 9. I template sono senza logica (Handlebars, non EJS)

Handlebars è stato scelto rispetto a EJS deliberatamente:
- Senza logica. I template possono essere scritti da non sviluppatori.
- Sicuro per default. `{{x}}` esegue l'escape HTML; `{{{x}}}` è raw solo se esplicitamente richiesto.
- Nessun JS arbitrario nei template significa nessuna superficie di audit XSS per template.

La logica vive in `hooks.js`, dove è esplicita e revisionabile. Helper Handlebars disponibili: `{{default}}`, `{{upper}}`, `{{lower}}`, `{{eq}}`, `{{markdown}}`, `{{asset ref}}`, `{{asset ref "property"}}` (più gli helper di formato dati `icsStamp`/`rfcText`/`csvCell` usati dai template affiancati `.ics`/`.vcf`/`.csv`).

### 10. I tool compongono tool

Un tool può incorporare il render di un **altro** tool senza import tra tool - la composizione è risolta dal motore, mai dal codice del tool. Ci sono due superfici:

- **Manifest dichiarativo** - `composes: [{ id, tool, inputs, format?, width?, height? }]`. Il motore renderizza il figlio nominato e posiziona il risultato nel template senza logica come `{{asset <id>}}`. `event-name-badge` compone oggi `qr-code` come SVG.
- **URL di embed portabile** - `<img src="https://lolly.tools/tool/<id>.<ext>?<inputs>">`. La shell renderizza quel figlio **localmente** (un pixel segnaposto viene mostrato finché il render locale non si risolve); nulla viene mai recuperato da `lolly.tools`.

Componi il render di qualsiasi tool: un figlio **SVG** resta un vero vettore quando il genitore esporta in SVG o PDF e viene rasterizzato in modo nitido per PNG; i figli **PNG/JPG/WEBP** vengono incorporati come immagini. Richiede la capability `compose`. I figli composti sono intermedi - mai filigranati né marcati con provenienza - e la composizione degrada in modo controllato: una shell che non può renderizzare un figlio omette semplicemente lo slot e il genitore viene comunque renderizzato.

---

## Cosa abbiamo scelto esplicitamente di non fare

- **Niente EJS / niente JS arbitrario nei template.** La superficie XSS è zero. La logica vive in `hooks.js`.
- **Nessun CMS asset obbligatorio.** I singoli utenti importano i propri file creativi direttamente nel proprio catalogo dentro l'app (la vista [Catalogo](/info/using.html) e il Brand Studio) - nessun server, nessuna console di amministrazione. Il lavoro viene passato come **sessione**: un link di condivisione porta con sé l'intero stato, e la stessa sessione viaggia in un backup o durante una sessione di collaborazione. Chi controlla l'installazione può poi bloccare una sessione condivisa come **template** - apre il link, registra i suoi valori come voce template nella directory di quello strumento nel brand pack e fa il commit - dopodiché compare nel selettore "New from template" dello strumento ed è raggiungibile con link diretto come `?template=<id>`. Git è il passo di blocco di chi possiede l'installazione, mai del creatore. Per un catalogo *condiviso e governato*, un'organizzazione **può** gestire la directory degli asset allo stesso modo e vincolare gli aggiornamenti tramite revisione delle PR - un modello di governance disponibile, non un requisito dell'app.
- **Nessun RBAC forzato.** L'app aperta è ad accesso pubblico per impostazione predefinita; il rischio per il brand è gestito con tag di maturità e filigrane. Un'organizzazione che vuole un controllo più stretto aggiunge sopra la propria autenticazione e il catalogo con revisione git di cui sopra.
- **Nessun database centrale.** Tutto lo stato utente è per dispositivo. L'integrazione con SUSE ID è nella roadmap ma non blocca il lancio.
- **Nessun percorso di codice condiviso per strumenti/motore.** Il motore è open source, così come gli strumenti brand-agnostici in `community/`; un brand pack come il privato `brands/suse/` porta i propri strumenti e catalogo secondo i propri termini. In entrambi i casi la separazione è applicata (nessuna importazione incrociata da `engine/` verso il contenuto degli strumenti) così la divisione resta pulita.

---

## Ciclo di vita, dall'inizio alla fine

Un utente apre `lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H`:

1. **Avvio.** La web shell apre IndexedDB, costruisce il capability bridge, sincronizza i cataloghi di tool e asset (o carica dalla cache se offline).
2. **Routing.** L'hash dell'URL → vista `tool`, con `qr-code` e i parametri URL estratti.
3. **Caricamento.** `loadTool('qr-code', fetchFile)` recupera `tool.json`, lo valida contro lo JSON Schema, recupera `template.html`, `styles.css` e il sorgente `hooks.js`.
4. **Parsing dello stato URL.** `parseUrlState` traduce i parametri URL in valori di input iniziali. I riferimenti agli asset (`?logo=suse/logo/primary`) sono parsati come oggetti leggeri `{ id, _unresolved: true }`.
5. **Runtime.** `createRuntime(tool, host, initialValues)` costruisce il modello di input (unendo dati di profilo, default e valori iniziali), risolve i riferimenti agli asset tramite `host.assets.get()`, carica gli hook (`host` con scope di closure, non sandboxato), chiama `hooks.onInit`.
6. **Render.** La shell si sottoscrive al runtime; a ogni cambio di stato riceve `{ model, hydrated }`. Renderizza i controlli di input dal modello e scrive l'HTML del template idratato in `#tool-canvas`.
7. **Interazione.** L'utente digita in un input → `runtime.setInput(id, value)` → vincoli applicati → `hooks.onInput` chiamato → re-idratazione → re-render. Il canvas si aggiorna dal vivo.
8. **Export.** L'utente clicca Download(PNG) → `runtime.export(canvasNode, 'png')` → `host.export.render` (rasterizza tramite dom-to-image-more; SVG/PDF passano attraverso vettorizzatori dedicati che percorrono il DOM) → blob → `host.export.download`. La gamma di formati a cui un tool può aderire è ampia, e l'enum `render.formats` in `schemas/tool.schema.json` è l'autorità in materia - raster e float raster, vettori e file di taglio, stampa/CMYK, motion, documenti modificabili (`pptx`, `docx`, `odt`), palette e output dati/testo, file audio e font. [URL Mode](/info/url-mode.html) elenca ogni id e cosa produce. L'audio è in quell'enum come qualsiasi altra cosa (`wav`, `mp3`, `m4a`, `opus`, dichiarati dall'audiogram e dai tool di registrazione); separatamente, la modalità `render.capture` di un tool di registrazione pilota `host.recorder`, la cui ripresa arriva come un Blob finito nel contenitore in cui il browser ha registrato. (I tool che impostano `render.export: false` - ad esempio Color Palette, Countdown Timer, Strip Hidden Data, Text Helper, Compress PDF - nascondono i controlli di download/formato/dimensione.) Le unità fisiche vengono convertite per formato qui (PDF → punti pagina reali, raster → pixel a DPI con un chunk `pHYs`). I metadati di autorialità/provenienza (autore, tool, fonte - costruiti da `engine/src/metadata.ts`) sono incorporati per formato: PNG iTXt, JPEG EXIF, dizionario info PDF, `<metadata>` SVG, commento GIF. I tool sperimentali ricevono una filigrana inserita dall'host, non dal tool.

![Il pannello di export che `?options` apre: la coppia nome file e formato, la dimensione di output e i controlli che scrivono il file](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Stesso ciclo di vita in Tauri. Stesso ciclo di vita in CLI - jsdom fornisce il DOM headless; l'output va su file o su stdout.

---

## Stato open source

**Il codice è MPL-2.0.** `engine/`, `shells/*`, `services/*`, `schemas/` e `docs/` sono open source sotto **MPL-2.0** - una piattaforma di scaffolding vendor-neutral per gli strumenti di brand, con ogni unità distribuibile nel proprio repository sotto [github.com/lolly-tools](https://github.com/lolly-tools).

**Il contenuto degli strumenti viene distribuito come brand pack**, ciascuno con i propri termini (vedi il `NOTICE.md` del pack). `community/` è il repository pubblico [`lolly-tools`](https://github.com/lolly-tools/lolly-tools) e anche i suoi strumenti brand-agnostici sono MPL-2.0. `brands/suse/` è il pack privato `suse-lolly`: gli strumenti SUSE e il catalogo SUSE, **di proprietà di SUSE**, inclusa la sua musica PremiumBeat su licenza. `brands/lolly-start/` è il brand di partenza vuoto di proprietà di questo repository. I font vengono distribuiti dentro un pack sotto la **SIL Open Font License 1.1** - il pack SUSE porta i tipi di carattere SUSE e SUSE Mono.

Le cartelle `tools/` e `catalog/` alla radice del repository sono *viste* escluse da git: un profilo le assembla a partire da `community/` più il brand pack attivo, motivo per cui ogni script e shell legge questi due percorsi e mai un pack direttamente.

La separazione è applicata - non ci sono importazioni incrociate da `engine/` verso il contenuto degli strumenti - così il confine tra piattaforma e contenuto resta pulito.

---

## Dove finisce il motore e inizia l'host

Se puoi descriverlo in puri dati + Handlebars → **engine**.
Se tocca il DOM, il filesystem, la rete o una qualsiasi API browser/OS → **host**.

La linea è netta di proposito. Il motore è la parte open source. Tutto ciò che conosce SUSE, piattaforme specifiche o ambienti di runtime resta fuori.

Per il livello di dettaglio successivo, [`engine/README.md`](../engine/README.md) elenca ogni modulo del motore e di cosa è responsabile, e [Threat Model & Trust Boundaries](/info/threat-model.html) registra dove quella stessa linea funge anche da confine di fiducia.
