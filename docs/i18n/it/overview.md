# Architettura di Lolly

![Icona di Lolly - Grande lecca-lecca verde e bianco](/info/icon.svg)

Questa pagina è per chi modifica il codice di Lolly: come si incastrano engine, shell e pacchetti di strumenti, dove vive ciascuno nel repository e gli impegni che vincolano ogni modifica. Se vuoi sapere cosa fa Lolly e chi lo usa, leggi prima [Come funziona Lolly](/info/how-lolly-works.html).

Due pagine di approfondimento vanno più a fondo. [`engine/README.md`](../engine/README.md) è la mappa dell'engine modulo per modulo, generata dal codice. [Threat Model & Trust Boundaries](/info/threat-model.html) legge la stessa architettura come confini di fiducia, ed è la pagina per qualsiasi domanda su ciò che l'engine considera non attendibile.

## Il quadro generale

Gli strumenti sono dati in cima. L'engine al centro non sa nulla di alcuna piattaforma. Le shell in basso implementano un unico contratto, e i cataloghi forniscono il contenuto.

![Gli strumenti forniscono un manifest, un template e gli hook all'engine condiviso. Le shell web, Tauri e terminale implementano il bridge di capacità HostV1 e leggono strumenti e risorse dai cataloghi.](/info/diagrams/concepts/platform-layers.svg)

Se puoi descriverlo in puri dati e Handlebars, appartiene all'**engine**. Se tocca il DOM, il filesystem, la rete o qualsiasi API del browser o del sistema operativo, appartiene all'**host**, il lato del bridge che spetta alla shell. L'engine è open source, e nulla che conosca un brand o una piattaforma particolari entra nell'engine.

## Struttura del repository

Lolly è un unico repository. Ogni directory qui sotto è una semplice directory al suo interno, tranne `brands/suse`, un submodule git **privato** che contiene il pacchetto di strumenti e il catalogo di SUSE, che un clone pubblico non scarica. I pacchetti che una build legge sono un profilo di contenuto (`profiles.json`), risolto per processo e non commutato globalmente. [Build Guide](/info/build-guide.html) ha il comando di clone e il modo in cui si registra una modifica dentro il pacchetto privato.

| Directory | Cosa contiene |
|---|---|
| `engine/` | Il nucleo indipendente dalla piattaforma: loader, runtime, input, template, modalità URL, unità e i moduli di formato |
| `shells/` | L'app web, le app desktop e mobile Tauri, la CLI, la TUI e l'estensione del browser |
| `packages/` | L'SDK per autori di strumenti (`@lolly-tools/core`), i componenti Node condivisi delle shell e il renderer della documentazione, tra gli altri |
| `community/` | Gli strumenti indipendenti dal brand, più i pacchetti emoji condivisi |
| `brands/` | Pacchetti brand: `lolly-demo` (Lolly Demo, il design system che usa lolly.tools), `lolly-start` (il punto di partenza vuoto) e il `suse` privato |
| `services/` | I servizi opzionali MCP, certificati e Penpot, e il codice server che condividono |
| `schemas/` | JSON Schema per manifest degli strumenti, voci delle risorse e riferimenti alle risorse |
| `scripts/`, `tests/`, `docs/`, `api/` | Script di build e catalogo, la suite di test dell'engine, questa documentazione e i bundle serverless generati |

::: details I file di engine e shell che incontri per primi
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

Non esiste una directory `tools/` o `catalog/` alla radice del repository. `packages/node-shell/src/content-roots.ts` risponde a "dove vive lo strumento `<id>`" e "dove si trova il catalogo" a partire da `profiles.json`, quando richiesto. Una vera coppia `tools/` e `catalog/` viene scritta solo in un output di build, come `dist/`, un payload RPM o un'immagine container, perché un browser recupera quei due percorsi via HTTP.

## Dove gira Lolly

Ogni superficie usa lo stesso engine e gli stessi file degli strumenti.

- **L'app web.** Una progressive web app che funziona offline una volta che il suo service worker ha messo in cache strumenti e risorse. Non richiede un account; lo stato risiede in IndexedDB su ogni dispositivo. Un unico layout responsive serve desktop e telefono: su un telefono i controlli diventano un pannello e i controlli di esportazione si aprono da una pillola fluttuante.
- **Le app desktop e mobile.** Pacchetti Tauri della stessa app web, con finestre di dialogo native per i file, stato sul filesystem e pieno uso offline.
- **La CLI.** `lolly <tool-id> --input=value --output=file.png` carica lo stesso engine in un DOM headless e scrive il file. È la modalità URL su un trasporto diverso, non un'implementazione separata. Vedi [CLI](/info/cli.html).
- **La TUI.** Un'app da terminale a schermo intero, pensata per la tastiera, che riusa il bridge della CLI, conserva le sessioni salvate su disco (nella cartella propria dell'app desktop quando l'app è installata, altrimenti sotto `~/.lolly`) e avvia un browser headless circoscritto solo quando un formato ne ha bisogno. Vedi [TUI](/info/tui.html).

![La vista divisa desktop: i controlli generati dal manifest a sinistra, la tela live a destra](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

Lo stesso strumento alla larghezza di un telefono non richiede un secondo layout: i controlli diventano un pannello in alto e l'anteprima occupa lo schermo.

![Un audiogramma su uno schermo largo 430px: il pannello dei controlli sopra, l'opera quadrata finita sotto e la pillola di esportazione fluttuante](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

L'app web include anche **Batch** (`#/batch`, `shells/web/src/pro/`), una griglia in stile foglio di calcolo che esegue il rendering di molte righe insieme su uno o più strumenti; [Batch e Multi-edit](/info/batch.html#make-many-versions-of-one-design) tratta Batch. **Settings → Capabilities** mappa tutto ciò che la piattaforma dichiara di saper fare.

![Batch su un'installazione nuova: una riga vuota in attesa di uno strumento, con la superficie da foglio di calcolo e il suo pulsante Render al loro posto prima che arrivi qualsiasi dato](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

## Impegni architetturali

Queste decisioni sono definitive. Cambiarne una è un'impresa di grande portata, perché danno forma a ogni altra decisione nel codice.

### 1. Strumenti dichiarativi, con una via di fuga imperativa

Uno strumento è un manifest (`tool.json`), un template (`template.html`) e un `hooks.js` facoltativo. **Il manifest dichiara gli input**, mai il template: gli input non vengono dedotti dai token Handlebars. La maggior parte degli strumenti è fatta solo di manifest e template, ed è ciò che permette ai non sviluppatori di crearli.

![Lo stack di controlli di Street Map: un menu a tendina delle città, un selettore di tema, cursori di spessore e attivatori di colore, ognuno disegnato da una riga del manifest](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

Gli strumenti che calcolano valori, come la codifica QR o la modellazione di un grafico, aggiungono hook: funzioni di ciclo di vita con nome che il runtime chiama con il bridge di capacità iniettato. Gli hook sono un contratto di portabilità, non una sandbox di sicurezza, e girano entro un budget di tempo. Gli strumenti i cui hook sono dimostrati privi di globali della pagina portano `isolate: true` e girano in un Worker. [Tool hooks](/info/tool-hooks.html) descrive il ciclo di vita e i budget, e il [Threat Model](/info/threat-model.html) dice cosa l'esecutore in-page contiene e cosa no.

### 2. Strumenti e asset sono dati, non codice pacchettizzato

Le app web e Tauri scaricano i cataloghi di strumenti e risorse all'avvio, li mettono in cache e lavorano con ciò che c'è, quindi un nuovo strumento o una nuova risorsa non richiede un rilascio dell'app. I byte delle risorse hanno un checksum SHA-256, e l'`id` e la `version` di una risorsa guidano l'invalidazione della cache.

### 3. Il bridge di capacità è l'unica API che gli strumenti vedono

Gli strumenti non toccano mai il DOM fuori dal loro template, non chiamano mai `fetch` direttamente e non leggono mai il filesystem. Chiamano metodi `host.*` versionati. La definizione canonica del contratto è `packages/core/src/host-v1.ts`, l'SDK per autori di strumenti `@lolly-tools/core`, così una terza parte può costruire su di esso senza dipendere dall'engine; `engine/src/bridge/host-v1.ts` ne riesporta i tipi.

| API richiesta | Cosa fa |
|---|---|
| `host.profile` | I dati dell'utente; precompila gli input tramite `bindToProfile` |
| `host.assets` | Query sul catalogo, risoluzione delle risorse e il selettore dell'host |
| `host.state` | Salva e carica gli slot di input: IndexedDB sul web, il filesystem in Tauri, la memoria nella CLI |
| `host.clipboard` | Scrive testo o un'immagine negli appunti, con ripieghi per piattaforma |
| `host.export` | Rasterizza o serializza il bersaglio del rendering, e il percorso di trasformazione dei file sul dispositivo |
| `host.log` | Logging a livelli verso l'host |

Ogni altra API è facoltativa e additiva: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` e molte altre. Il manifest di uno strumento elenca sotto `requires` le API facoltative che i suoi hook chiamano senza verificare, e un host che ne è privo rifiuta di montare lo strumento; gli hook rilevano le altre per feature detection. Alcune, come `recorder`, richiedono anche una capacità del dispositivo che lo strumento dichiara. `packages/core/src/host-v1/apis.ts` le elenca tutte e [Host API](/info/host-api.html) documenta ciascuna. Aggiungere un metodo è una versione minore; rimuoverne o modificarne uno è una versione maggiore, e v1 continua a funzionare quando esce v2.

### 4. Gli id delle risorse sono per sempre

`lolly/logo/primary` è un contratto. Una volta pubblicato, un id non cambia mai e non viene mai riutilizzato. Un cambio di byte incrementa la `version` nella voce della risorsa, e una sostituzione imposta `deprecated: true` e, facoltativamente, `replacedBy`, così i riferimenti esistenti si risolvono sempre. È ciò che mantiene funzionanti per anni le sessioni salvate e i link condivisi.

### 5. La URL mode è di prima classe

Ogni input è esprimibile come parametro URL, quindi un link è un file finito:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Quel link da solo, senza nient'altro, è il file finito](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Cambia un parametro e ottieni un file diverso. Quest'intera palette è un colore di partenza, un'armonia e un numero di passi:

![Nove passaggi su quattro tonalità, tutti generati dal singolo colore seme trasportato nel link](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

La CLI costruisce lo stesso stato URL dai suoi argomenti ed esegue la stessa pipeline, quindi la CLI non può divergere dall'app. `engine/src/url-mode.ts` fa il parsing e la serializzazione; un insieme di nomi riservati (`format`, `width`, `dpi`, `c2pa`, `z` e altri) non viene mai passato a uno strumento, e [Reserved URL parameters](/info/url-parameters.html) li elenca tutti. Gli input di tipo risorsa viaggiano per `id` e si risolvono tramite `host.assets.get()` prima che il template si compili.

### 6. L'archiviazione passa dal bridge

L'app web usa IndexedDB, Tauri il filesystem e la CLI la memoria. Gli strumenti vedono solo `host.state.save(slot, data)` e `host.state.load(slot)`, mai `localStorage`. Le persone possono tenere più sessioni con nome per strumento senza alcun account. Poiché il bridge è l'unica giuntura, anche quello stato è portabile: `shells/web/src/data-transfer.ts` lo rilegge in un unico file `lolly-backup` che si importa su qualsiasi altra installazione ([Data transfer](/info/data-transfer.html)), e [Sync](/info/sync.html) invia lo stesso bundle all'archiviazione scelta dalla persona.

### 7. I tag di maturità dicono cos'è uno strumento

Ogni strumento dichiara `status: official | community | experimental`. La galleria ordina per stato, e gli strumenti sperimentali applicano per impostazione predefinita una filigrana alle esportazioni: il runtime la attiva a meno che il chiamante passi `watermark: false`, e gli strumenti sul dispositivo ne sono esenti. Qualsiasi processo un team costruisca attorno al catalogo poggia su questa base.

### 8. Gli input sono tipizzati nel manifest

Un input dichiara un `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` o `file`. L'host disegna un controllo per ogni tipo, quindi gli strumenti non scrivono codice di controlli, e qualsiasi input può portare `bindToProfile`. Tre pesano di più:

- **`asset`**, con `filter` e `allowUpload`, è il ponte verso il sistema delle risorse. `allowUpload: false` limita uno slot alle risorse della libreria, e i caricamenti degli utenti condividono la forma `AssetRef` della libreria.
- **`blocks`** è un gruppo di campi ripetuto modificato in un pannello laterale, usato da Meeting Planner, Wayfinding, Diagrams e altri. Fare clic su un blocco disegnato porta il focus sulla sua riga.
- **`file`** tiene in memoria il file dell'utente per utility sul dispositivo come Strip Hidden Data e Compress, e **`vector`** raggruppa un insieme fisso di numeri in un unico controllo.

### 9. I template sono privi di logica

I template sono Handlebars, scelto perché i non sviluppatori possano scriverli: `{{x}}` fa l'escape, e `{{{x}}}` è un opt-in esplicito. La logica vive in `hooks.js`, dove è esplicita e revisionabile. Molti template usano `{{{` per markup calcolato da un hook, quindi ogni hook deve fare l'escape di ciò che consegna. Gli helper sono `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` e `media`, più `icsStamp`, `rfcText`, `csvCell` e `arrow` per i template gemelli `.ics`, `.vcf` e `.csv`. [Templates and rendering](/info/tool-rendering.html) li tratta.

### 10. I tool compongono tool

Uno strumento può incorporare il rendering di un altro strumento senza import tra strumenti; l'engine risolve la composizione. Un manifest può dichiarare `composes: [{ id, tool, inputs }]` e posizionare il figlio con `{{asset <id>}}`, e un URL di incorporamento portabile (`https://lolly.tools/tool/<id>.svg?…`) renderizza il figlio in locale, ed è così che Design inserisce un codice QR o un grafico live. Un figlio SVG resta vettoriale in un genitore SVG o PDF. I figli sono intermedi, mai con filigrana né marcati, e una shell che non può renderizzarne uno lascia lo slot vuoto mentre il genitore viene comunque renderizzato. [Composition and brand overlays](/info/tool-composition.html) ha i dettagli.

## Cosa abbiamo scelto di non fare

- **Nessun JavaScript arbitrario nei template.** La logica vive in `hooks.js`.
- **Nessun server di risorse obbligatorio.** Le persone aggiungono i propri file in Assets nell'app e passano il lavoro come sessione: un link di condivisione per input e impostazioni, un file `.lolly` quando viaggiano anche i caricamenti. Una sessione condivisa può diventare un template nel selettore di uno strumento. Un'organizzazione che vuole un catalogo governato può usare il catalogo, le approvazioni e le policy di Lolly Work, oppure gestire il pacchetto brand in git e rivedere lì le modifiche.
- **Nessun controllo di accesso forzato.** L'app aperta è pubblica per impostazione predefinita, e i tag di maturità e le filigrane portano il rischio per il brand. Accesso dell'organizzazione, ruoli e policy arrivano da Lolly Work quando un team li vuole.
- **Nessun database centrale.** Lo stato dell'utente vive su ogni dispositivo, e Sync facoltativo lo copia nell'archiviazione scelta dalla persona, mai in un database di Lolly.
- **Nessun percorso di codice condiviso tra strumenti ed engine.** L'engine e gli strumenti community sono open source, e un pacchetto brand come il `brands/suse/` privato porta i propri strumenti e il proprio catalogo con i propri termini. Nessuno strumento importa da `engine/`, così la separazione resta pulita.

## Il ciclo di vita di un render

Qualcuno apre `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`:

1. **Avvio.** L'app web apre IndexedDB, costruisce il bridge di capacità e sincronizza i cataloghi di strumenti e risorse, oppure li carica dalla cache quando è offline.
2. **Route.** Il percorso seleziona la vista dello strumento per `qr-code`, con la query come valori iniziali.
3. **Caricamento.** `loadTool` scarica `tool.json`, lo convalida rispetto allo schema e scarica template, stili e hook.
4. **Parsing del link.** `parseUrlState` trasforma i parametri in valori di input. Un riferimento a una risorsa come `?logo=lolly/logo/primary` diventa un `{ id }` non risolto.
5. **Avvio del runtime.** `createRuntime(tool, host, initialValues)` costruisce il modello degli input dai dati del profilo, dai valori predefiniti e dal link, risolve i riferimenti alle risorse, carica gli hook e chiama `onInit`.
6. **Rendering.** La shell si sottoscrive al runtime, disegna i controlli dal modello e scrive il template compilato in `#tool-canvas`.
7. **Interazione.** Digitare chiama `runtime.setInput`, che applica i vincoli, chiama `onInput`, compila di nuovo il template e ridisegna.
8. **Esportazione.** **Download** chiama `runtime.export(node, format)`, e `host.export` della shell produce il file: un raster, un vettoriale dal DOM walker, un PDF, un documento o uno degli altri formati in `schemas/tool.schema.json`. Le unità fisiche vengono convertite per formato, e i metadati e le Content Credentials vengono incorporati dove il formato può contenerli. Gli strumenti sperimentali ricevono la filigrana dall'host, non dallo strumento. [Templates and rendering](/info/tool-rendering.html) ed [Export a file](/info/exporting.html) trattano il passaggio di esportazione.

![Il pannello di esportazione che apre ?options: la coppia nome file e formato, la dimensione dell'output e i controlli che scrivono il file](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Lo stesso ciclo di vita gira in Tauri, e nella CLI con un DOM headless, dove l'output va in un file o su stdout.

## Licenze

Il codice, compresi `engine/`, `shells/`, `services/`, `schemas/` e il generatore della documentazione, è MPL-2.0, in un unico repository pubblico, [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). La prosa della documentazione è CC BY-SA 4.0. I pacchetti brand portano i propri termini nel `NOTICE.md` di ciascun pacchetto: gli strumenti community sono MPL-2.0, e il pacchetto SUSE privato è proprietario di SUSE. [About](/info/about.html) ha la nota completa sulle licenze.
