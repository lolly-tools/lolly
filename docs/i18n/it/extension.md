# Estensione del browser

L'estensione **Lolly URL Screenshot** permette all'app web di fare uno screenshot di qualsiasi pagina web dall'interno del tuo browser. Senza di essa, catturare un URL richiede l'app desktop - una pagina del browser non può leggere i pixel di un altro sito da sola. L'estensione può farlo, usando la stessa cattura che usa l'app desktop.

Fa un altro lavoro allo stesso modo: leggere un'unica pagina che tu nomini, così Brand Studio può estrarre un marchio da un sito web live. Entrambi sono trattati qui sotto.

Funziona su browser basati su Chromium: **Chrome, Edge, Brave, Arc, Opera** - Chrome 111 o più recente.

Finché non è installata, **URL Screenshot** si apre comunque per permetterti di comporre uno scatto, e una nota in cima ai controlli dello strumento indica cosa manca.

![La nota dello strumento URL Screenshot che propone l'estensione, mostrata quando la cattura su file non ha un host su cui girare](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Ogni controllo è attivo mentre aspetti: l'URL di destinazione, la profondità di scroll, il ritardo di stabilizzazione, i margini di ritaglio e la ricolorazione. Solo la cattura vera e propria richiede un host.

![I controlli di URL Screenshot con un URL di destinazione, profondità di scroll, ritardo di stabilizzazione e margini di ritaglio, tutti utilizzabili prima che l'estensione esista](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Installazione

### Dal Chrome Web Store

*In arrivo.* Una volta pubblicata la installerai con un clic, poi ricaricherai Lolly.

### Caricala tu stesso (sviluppatori)

L'estensione si trova nel repo in `shells/chrome-extension/`.

1. Apri `chrome://extensions`.
2. Attiva **Modalità sviluppatore** (in alto a destra).
3. Clicca su **Carica estensione non pacchettizzata** e scegli la cartella `shells/chrome-extension/`.
4. Ricarica Lolly - **URL Screenshot** ora funziona nel browser.

## Come funziona

- Un piccolo script segnala a Lolly che l'estensione è presente, così lo strumento **URL Screenshot** si attiva automaticamente - nessuna configurazione.
- Quando esegui il rendering, l'estensione apre la pagina di destinazione in una scheda in background, la cattura tramite il DevTools Protocol (lo stesso `Page.captureScreenshot` usato dall'app desktop), poi chiude la scheda e restituisce l'immagine.
- Gira interamente nel tuo browser, sulla tua rete - quindi catturare `localhost` o un sito interno funziona. La cattura in sé non viene mai caricata da nessuna parte; l'unico traffico di rete è il tuo stesso browser che carica la pagina che hai chiesto di fotografare.

Mentre una cattura è in corso potresti vedere brevemente un banner *"…started debugging this browser"* sulla scheda temporanea. È il DevTools Protocol al lavoro; scompare da solo quando lo scatto è terminato.

## Leggere un sito per Brand Studio

La sorgente **Website** in Brand Studio avvia un brand a partire da un sito che già possiedi. Su Chromium è l'estensione a leggerlo; sull'app desktop lo stesso compito lo svolge un fetch nativo, e su un browser semplice senza estensione il riquadro non viene proposto affatto.

Cosa succede quando lo premi:

- Un indirizzo, una pagina. L'estensione la apre nello stesso tipo di scheda in background, legge il markup renderizzato, il testo dei fogli di stile e una manciata di icone e loghi, poi chiude la scheda. Non segue i link e non fa crawling.
- Anche i fogli di stile e i font ospitati altrove (una CDN, un servizio di font) vengono recuperati, perché colori e tipografia della pagina risiedono lì. Le richieste cross-origin vanno senza i tuoi cookie; quelle same-origin li usano, esattamente come farebbe la pagina stessa.
- Tutto ha un limite - un numero massimo di fogli, immagini e byte - così una pagina ostile o mezza rotta restituisce materiale parziale invece di bloccarsi.
- I byte tornano direttamente alla scheda Lolly che li ha richiesti. L'analisi in colori, tipografia e loghi avviene sul tuo dispositivo; niente viene caricato.

Nulla viene letto finché non premi. Incollare un indirizzo si limita a compilare il campo.

## Dopo l'installazione

Ricarica la scheda Lolly. Il messaggio "Get the extension" scompare e **URL Screenshot** diventa disponibile nella galleria e in modalità Batch.

## Permessi

Il suo `manifest.json` dichiara quattro permessi più l'accesso agli host:

- `debugger` - guida la scheda in background attraverso il DevTools Protocol. È ciò che scatta lo screenshot.
- `tabs` - apre la scheda temporanea in background e la richiude dopo.
- `scripting` - esegue il lettore a pagina singola all'interno del sito che hai indicato, per la sorgente Website di Brand Studio.
- `storage` - annota l'id di una scheda che ha aperto, solo nella session storage, così la scheda viene comunque chiusa se il browser sospende l'estensione a metà lettura. Viene azzerata al riavvio successivo; nulla su di te viene conservato.
- `host_permissions: ["<all_urls>"]` - accesso host a *tutti* i siti, perché puoi puntarla verso qualsiasi URL tu scelga. Chrome mostra questo, al momento dell'installazione, come un avviso generico "leggi e modifica tutti i tuoi dati su tutti i siti web".

Nonostante quell'avviso, legge solo la singola pagina che le chiedi di catturare o importare, e non legge né trasmette i tuoi dati di navigazione - niente viene caricato da nessuna parte.

Il manifest imposta anche `minimum_chrome_version: 111`. La versione attuale è 0.2.1.

## Risoluzione dei problemi

- **Vedi ancora "Get the extension"?** Ricarica la scheda Lolly - il rilevamento avviene al caricamento della pagina.
- **Non succede nulla su questo sito?** L'estensione si attiva solo sulle origini proprie di Lolly. Stai eseguendo una build personalizzata su un altro dominio? Aggiungilo a `content_scripts.matches` nel `manifest.json` dell'estensione.
- **Una cattura fallisce?** Controlla che l'URL sia raggiungibile e inizi con `http://` o `https://`. Alcune pagine bloccano attivamente la cattura automatizzata.
