# Architettura di Lolly

![Icona di Lolly - Un grande lecca-lecca verde e bianco](/info/icon.svg)

Questa pagina è per chi modifica il codice di Lolly: come si collegano il motore, le shell e i pacchetti di strumenti, dove si trova ciascuno nel repository e gli impegni che vincolano ogni modifica. Per sapere cosa fa Lolly e chi usa Lolly, leggi prima [Come funziona Lolly](/info/how-lolly-works.html).

[`engine/README.md`](https://github.com/lolly-tools/lolly/blob/main/engine/README.md) descrive il motore modulo per modulo ed è generato dal codice. [Modello di minaccia & confini di fiducia](/info/threat-model.html) interpreta la stessa architettura in termini di confini di fiducia e indica cosa il motore considera non attendibile.

<!--i:eti-layers-->
## Il quadro generale

In alto, gli strumenti sono dati. Al centro, il motore non conosce alcuna piattaforma. In basso, le shell implementano un unico contratto e i cataloghi forniscono i contenuti.

![Gli strumenti forniscono un manifest, un template e hook al motore condiviso. Le shell web, Tauri e terminale implementano il bridge delle funzionalità HostV1 e leggono strumenti e risorse dai cataloghi.](/info/diagrams/concepts/platform-layers.svg)

Tutto ciò che puoi descrivere con dati puri e Handlebars appartiene al **motore**. Tutto ciò che tocca il DOM, il filesystem, la rete o qualsiasi API del browser o del sistema operativo appartiene all'**host**, il lato del bridge gestito dalla shell. Il motore è open source. Nulla che conosca un marchio specifico entra nel motore.

<!--i:eti-folder-shared-->
## Struttura del repository

Lolly è un unico repository. Ogni directory qui sotto è una directory normale, tranne `brands/suse`: un sottomodulo git **privato** con il pacchetto di strumenti e il catalogo SUSE, che un clone pubblico non scarica. Un profilo dei contenuti (`profiles.json`) stabilisce quali pacchetti legge una build. Ogni processo risolve il proprio profilo e non esiste un interruttore globale. La [Guida alla build](/info/build-guide.html) contiene il comando di clonazione e spiega come registrare una modifica nel pacchetto privato.

| Directory | Cosa contiene |
|---|---|
| `engine/` | Il nucleo indipendente dalla piattaforma: caricatore, runtime, input, template, modalità URL, unità e moduli dei formati |
| `shells/` | L'app web, le app Tauri per desktop e dispositivi mobili, la CLI, la TUI e l'estensione del browser |
| `packages/` | L'SDK per gli autori di strumenti (`@lolly-tools/core`), i componenti condivisi delle shell Node e il renderer della documentazione, tra gli altri |
| `community/` | Gli strumenti indipendenti dal marchio e i pacchetti di emoji condivisi |
| `brands/` | Pacchetti dei marchi: `lolly-demo` (Lolly Demo, il design system usato da lolly.tools), `lolly-start` (la base vuota) e il pacchetto privato `suse` |
| `services/` | I servizi facoltativi MCP, certificati e Penpot e il codice server che condividono |
| `schemas/` | JSON Schema per i manifest degli strumenti, le voci delle risorse e i riferimenti alle risorse |
| `scripts/`, `tests/`, `docs/`, `api/` | Script di build e catalogo, la suite di test del motore, questa documentazione e i bundle serverless generati |

::: details I primi file del motore e delle shell che incontri
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

::: note Non esiste una directory `tools/` o `catalog/` alla radice del repository
`packages/node-shell/src/content-roots.ts` risponde a "dove si trova lo strumento `<id>`" e "dove si trova il catalogo" a partire da `profiles.json`. Una vera coppia `tools/` e `catalog/` viene scritta solo nell'output di una build, come `dist/`, il contenuto di un RPM o un'immagine container, perché un browser recupera questi due percorsi tramite HTTP.
:::

<!--i:eti-monitor-->
## Dove funziona Lolly

Ogni interfaccia usa lo stesso motore e gli stessi file degli strumenti.

- **L'app web.** Una progressive web app. Funziona offline quando il suo service worker ha memorizzato strumenti e risorse nella cache. Non richiede un account e lo stato risiede in IndexedDB su ogni dispositivo. Un unico layout responsive serve desktop e telefono. Su un telefono i controlli diventano un pannello e quelli di esportazione si aprono da una pillola mobile.
- **Le app desktop e mobili.** Pacchetti Tauri della stessa app web, con finestre di dialogo native per i file, stato nel filesystem e uso completamente offline.
- **La CLI.** `lolly <tool-id> --input=value --output=file.png` carica lo stesso motore in un DOM headless e scrive il file. È la modalità URL su un trasporto diverso. Vedi [CLI](/info/cli.html).
- **La TUI.** Un'app per terminale a schermo intero, pensata per la tastiera. Riusa il bridge della CLI e conserva le sessioni salvate su disco: nella cartella dell'app desktop quando è installata, altrimenti in `~/.lolly`. Avvia un browser headless con ambito limitato solo quando un formato ne ha bisogno. Vedi [TUI](/info/tui.html).

![La vista divisa su desktop: controlli generati dal manifest a sinistra, tela live a destra](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

Alla larghezza di un telefono, il pannello dei controlli è in alto e l'anteprima riempie lo schermo.

![Un audiogramma su uno schermo largo 430px: il pannello dei controlli sopra, la grafica quadrata finita sotto e la pillola mobile di esportazione](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dzzfxm%3A7%3Alofi%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

L'app web include anche **Batch** (`#/batch`, `shells/web/src/pro/`), una griglia simile a un foglio di calcolo che renderizza molte righe insieme, con uno o più strumenti. Vedi [Batch e Lolly Multi-edit](/info/batch.html#make-many-versions-of-one-design). **Settings → Capabilities** elenca tutto ciò che la piattaforma dichiara di poter fare.

![Batch appena installato: una riga vuota in attesa di uno strumento, con l'area del foglio di calcolo e il pulsante Render già presenti prima dell'arrivo dei dati](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

<!--i:eti-lock-->
## Impegni architetturali

Queste decisioni sono definitive. Ogni altra decisione nel codice dipende da esse, quindi cambiarne una è un intervento importante.

### 1. Strumenti dichiarativi, con la possibilità di usare codice imperativo

Uno strumento è un manifest (`tool.json`), un template (`template.html`) e un file `hooks.js` facoltativo. **Il manifest dichiara gli input**. Gli input non vengono mai dedotti dai token Handlebars del template. La maggior parte degli strumenti è composta solo da un manifest e un template, quindi può crearli anche chi non sviluppa software.

![La pila di controlli di Street Map: un menu a tendina per la città, un selettore del tema, cursori per lo spessore e selettori di colore, ciascuno ricavato da una riga del manifest](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

Gli strumenti che calcolano valori, come la codifica QR o la costruzione di grafici, aggiungono hook: funzioni del ciclo di vita con un nome, che il runtime chiama iniettando il bridge delle funzionalità. Gli hook sono un contratto di portabilità, non una sandbox di sicurezza. Vengono eseguiti entro un limite di tempo. Gli strumenti i cui hook sono verificati come privi di dipendenze dalle variabili globali della pagina dichiarano `isolate: true` e vengono eseguiti in un Worker. [Hook degli strumenti](/info/tool-hooks.html) descrive il ciclo di vita e i limiti di tempo. Il [Modello di minaccia](/info/threat-model.html) indica cosa l'esecutore nella pagina contiene e cosa no.

### 2. Strumenti e risorse sono dati, non codice incluso nel bundle

Le app web e Tauri recuperano i cataloghi di strumenti e risorse all'avvio, li memorizzano nella cache e lavorano con ciò che è nella cache. Un nuovo strumento o una nuova risorsa non richiede una nuova versione dell'app. I byte delle risorse vengono verificati con checksum SHA-256. L'`id` e la `version` di una risorsa determinano l'invalidazione della cache.

### 3. Il bridge delle funzionalità è l'unica API visibile agli strumenti

Gli strumenti non toccano mai il DOM al di fuori del proprio template, non chiamano mai `fetch` direttamente e non leggono mai il filesystem. Chiamano metodi `host.*` con versione. Il contratto è definito in `packages/core/src/host-v1.ts`, nell'SDK per gli autori di strumenti `@lolly-tools/core`. Una terza parte può sviluppare usando l'SDK senza dipendere dal motore. `engine/src/bridge/host-v1.ts` ne riesporta i tipi.

| API obbligatoria | Cosa fa |
|---|---|
| `host.profile` | I dati dell'utente; precompila gli input tramite `bindToProfile` |
| `host.assets` | Query al catalogo, risoluzione delle risorse e selettore dell'host |
| `host.state` | Salva e carica gli slot di input: IndexedDB sul web, il filesystem in Tauri, la memoria nella CLI |
| `host.clipboard` | Scrive testo o un'immagine negli appunti, con alternative per le diverse piattaforme |
| `host.export` | Rasterizza o serializza l'oggetto da renderizzare e gestisce il percorso di trasformazione dei file sul dispositivo |
| `host.log` | Logging con livelli verso l'host |

Ogni altra API è facoltativa e aggiuntiva: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` e molte altre. Il campo `requires` di un manifest elenca le API facoltative che i suoi hook chiamano senza verificarne prima la disponibilità. Un host a cui ne manca una rifiuta di montare lo strumento. Gli hook verificano la disponibilità delle altre. Alcune, come `recorder`, richiedono anche una funzionalità del dispositivo dichiarata dallo strumento. `packages/core/src/host-v1/apis.ts` le elenca tutte e [API dell'host](/info/host-api.html) le documenta una per una. Aggiungere un metodo comporta una versione minore. Rimuoverne o modificarne uno comporta una versione maggiore, e v1 continua a funzionare quando esce v2.

### 4. Gli id delle risorse sono permanenti

`lolly/logo/primary` è un contratto. Una volta pubblicato, un id non cambia mai e non viene mai riutilizzato. Una modifica ai byte incrementa `version` nella voce della risorsa. Una sostituzione imposta `deprecated: true` e, facoltativamente, `replacedBy`. I riferimenti esistenti si risolvono sempre, quindi le sessioni salvate e i link condivisi continuano a funzionare per anni.

### 5. La modalità URL è una funzionalità di primo livello

Ogni input può essere espresso come parametro URL, quindi un link è un file finito:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Quel link da solo, senza nient'altro al suo interno, è il file finito](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Cambia un parametro e ottieni un file diverso. Questa palette nasce da un colore di partenza, un'armonia e un numero di gradazioni:

![Nove gradazioni su quattro tonalità, tutte generate dall'unico colore di partenza contenuto nel link](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

La CLI costruisce lo stesso stato URL a partire dai suoi argomenti ed esegue la stessa pipeline, quindi non può divergere dall'app. `engine/src/url-mode.ts` analizza e serializza lo stato URL. I nomi riservati (`format`, `width`, `dpi`, `c2pa`, `z` e altri) non vengono mai passati a uno strumento. [Parametri URL riservati](/info/url-parameters.html) li elenca tutti. Gli input delle risorse viaggiano tramite `id` e vengono risolti con `host.assets.get()` prima che il template venga compilato.

### 6. L'archiviazione passa dal bridge

L'app web usa IndexedDB, Tauri il filesystem e la CLI la memoria. Gli strumenti vedono solo `host.state.save(slot, data)` e `host.state.load(slot)`, mai `localStorage`. Puoi conservare più sessioni con nome per ogni strumento senza un account. Poiché il bridge è l'unico punto di collegamento, anche quello stato è portabile. `shells/web/src/data-transfer.ts` esporta lo stato in un unico file `lolly-backup` importabile in qualsiasi altra installazione ([Trasferimento dei dati](/info/data-transfer.html)). [Sync](/info/sync.html) invia lo stesso pacchetto allo spazio di archiviazione che scegli.

### 7. I tag di maturità indicano cos'è uno strumento

Ogni strumento dichiara `status: official | community | experimental`. La galleria ordina gli strumenti per stato. Per impostazione predefinita, gli strumenti sperimentali applicano una filigrana alle esportazioni: il runtime la attiva a meno che il chiamante non passi `watermark: false`. Gli strumenti che operano sul dispositivo sono esenti. Il processo di catalogazione del team si aggiunge a questi tag.

### 8. Gli input hanno un tipo nel manifest

Un input dichiara un `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` o `file`. L'host renderizza un controllo per ogni tipo, quindi gli strumenti non scrivono codice per i controlli. Qualsiasi input può avere `bindToProfile`. Tre tipi sono particolarmente importanti:

- **`asset`**, con `filter` e `allowUpload`, è il ponte verso il sistema delle risorse. `allowUpload: false` limita uno slot alle risorse della libreria. I file caricati dagli utenti condividono la struttura `AssetRef` della libreria.
- **`blocks`** è un gruppo di campi ripetuti, modificato in un pannello laterale, usato da Meeting Planner, Wayfinding, Diagrams e altri. Facendo clic su un blocco renderizzato, la sua riga riceve il focus.
- **`file`** conserva in memoria il file dell'utente per le utility che operano sul dispositivo, come Lolly Strip Hidden Data e Compress, e **`vector`** raggruppa un insieme fisso di numeri in un unico controllo.

### 9. I template non contengono logica

I template sono in Handlebars, quindi può scriverli anche chi non sviluppa software. `{{x}}` esegue l'escape e `{{{x}}}` è una scelta esplicita. La logica risiede in `hooks.js`, dove può essere revisionata. Molti template usano `{{{` per markup calcolato da un hook, quindi ogni hook deve eseguire l'escape di ciò che passa al template. Gli helper sono `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` e `media`, più `icsStamp`, `rfcText`, `csvCell` e `arrow` per i template associati `.ics`, `.vcf` e `.csv`. [Template e rendering](/info/tool-rendering.html) li descrive.

### 10. Gli strumenti compongono altri strumenti

Uno strumento può incorporare il rendering di un altro strumento senza importazioni tra strumenti. Il motore risolve la composizione. Un manifest può dichiarare `composes: [{ id, tool, inputs }]` e posizionare l'elemento figlio con `{{asset <id>}}`. Un URL di incorporamento portabile (`https://lolly.tools/tool/<id>.svg?…`) renderizza l'elemento figlio localmente; Lolly Design inserisce così un codice QR o un grafico live. Un elemento figlio SVG resta vettoriale in un elemento genitore SVG o PDF. Gli elementi figli sono intermedi e non ricevono mai filigrane o attestazioni. Una shell che non può renderizzare un elemento figlio lascia lo slot vuoto e il genitore viene comunque renderizzato. [Composizione e sovrapposizioni del marchio](/info/tool-composition.html) contiene i dettagli.

<!--i:eti-scissors-->
## Cosa abbiamo scelto di non fare

- **Nessun JavaScript arbitrario nei template.** La logica risiede in `hooks.js`.
- **Nessun server obbligatorio per le risorse.** Puoi aggiungere i tuoi file ad Assets nell'app e passare il lavoro come sessione: un link di condivisione per input e impostazioni, un file `.lolly` quando viaggiano anche i file caricati. Una sessione condivisa può diventare un template nel selettore di uno strumento. Un'organizzazione che vuole un catalogo governato può usare il catalogo, le approvazioni e le policy di Lolly Work oppure gestire il pacchetto del marchio in git e revisionare lì le modifiche.
- **Nessun controllo degli accessi imposto.** L'app aperta è pubblica per impostazione predefinita. I tag di maturità e le filigrane segnalano il rischio per il marchio. L'accesso dell'organizzazione, i ruoli e le policy provengono da Lolly Work quando un team li vuole.
- **Nessun database centrale.** Lo stato dell'utente risiede su ogni dispositivo e Sync, facoltativo, lo copia nello spazio di archiviazione scelto dalla persona, mai in un database Lolly.
- **Nessun percorso di codice condiviso tra strumenti e motore.** Il motore e gli strumenti della comunità sono open source. Un pacchetto di un marchio, come quello privato `brands/suse/`, contiene i propri strumenti e il proprio catalogo alle proprie condizioni. Nessuno strumento importa da `engine/`, quindi la separazione resta netta.

<!--i:eti-refresh-->
## Il ciclo di vita di un rendering

Qualcuno apre `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`:

1. **Avvio.** L'app web apre IndexedDB, costruisce il bridge delle funzionalità e sincronizza i cataloghi di strumenti e risorse oppure li carica dalla cache quando è offline.
2. **Instradamento.** Il percorso seleziona la vista dello strumento `qr-code`, con la query come valori iniziali.
3. **Caricamento.** `loadTool` recupera `tool.json`, lo convalida rispetto allo schema e recupera il template, gli stili e gli hook.
4. **Analisi del link.** `parseUrlState` trasforma i parametri in valori di input. Un riferimento a una risorsa come `?logo=lolly/logo/primary` diventa un `{ id }` non risolto.
5. **Avvio del runtime.** `createRuntime(tool, host, initialValues)` costruisce il modello degli input dai dati del profilo, dai valori predefiniti e dal link, risolve i riferimenti alle risorse, carica gli hook e chiama `onInit`.
6. **Rendering.** La shell si sottoscrive al runtime, disegna i controlli dal modello e scrive il template compilato in `#tool-canvas`.
7. **Interazione.** La digitazione chiama `runtime.setInput`, che applica i vincoli, chiama `onInput`, compila di nuovo il template e ridisegna.
8. **Esportazione.** **Download** chiama `runtime.export(node, format)` e `host.export` della shell produce il file: un raster, un vettoriale dal DOM walker, un PDF, un documento o uno degli altri formati in `schemas/tool.schema.json`. Le unità fisiche vengono convertite in base al formato. I metadati e le Content Credentials vengono incorporati dove il formato può contenerli. Gli strumenti sperimentali ricevono la filigrana dall'host, non dallo strumento. [Template e rendering](/info/tool-rendering.html) ed [Esporta un file](/info/exporting.html) descrivono il passaggio di esportazione.

![Il pannello di esportazione aperto da ?options: la coppia nome file e formato, la dimensione dell'output e i controlli che scrivono il file](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Lo stesso ciclo di vita viene eseguito in Tauri e nella CLI con un DOM headless, dove l'output va in un file o su stdout.

<!--i:eti-stamp-->
## Licenze

Il codice, inclusi `engine/`, `shells/`, `services/`, `schemas/` e il generatore della documentazione, è sotto licenza MPL-2.0, in un unico repository pubblico, [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). I testi della documentazione sono sotto licenza CC BY-SA 4.0. I pacchetti dei marchi hanno condizioni proprie nel file `NOTICE.md` di ciascun pacchetto: gli strumenti della comunità sono sotto licenza MPL-2.0 e il pacchetto privato SUSE è proprietario di SUSE. [Informazioni](/info/about.html) contiene la nota completa sulle licenze.
