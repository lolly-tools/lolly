# Estensione del browser

Una pagina web non può leggere i pixel di un altro sito, quindi l'app web di Lolly ha bisogno di aiuto per fare lo screenshot di una pagina. In un browser basato su Chromium (Chrome, Edge, Brave, Arc o Opera, da Chrome 111), l'estensione gratuita **Lolly URL Screenshot** offre quell'aiuto, usando la stessa acquisizione dell'app desktop. Una volta installata:

- **[URL Screenshot](/t/url-shot)** salva come file la pagina che hai composto;
- un indirizzo web incollato in uno slot immagine può diventare uno screenshot di quella pagina, con **Screenshot this page**;
- la sorgente **Website** in [Design System Setup](/info/brand-studio.html) può leggere una pagina per avviare un design system.

Approvi ogni richiesta, e l'app desktop svolge gli stessi compiti senza l'estensione.

## Prima di installare

Finché l'estensione non è installata, **URL Screenshot** si apre comunque, così puoi comporre uno scatto. Una nota in cima ai controlli dello strumento dice cosa manca.

![La nota dello strumento URL Screenshot che propone l'estensione, mostrata quando la cattura su file non ha un host su cui girare](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Ogni controllo funziona mentre aspetti: l'URL di destinazione, la profondità di scorrimento, il ritardo di assestamento, i margini di ritaglio e la ricolorazione. Solo l'acquisizione vera e propria richiede l'estensione.

![I controlli di URL Screenshot con un URL di destinazione, profondità di scroll, ritardo di stabilizzazione e margini di ritaglio, tutti utilizzabili prima che l'estensione esista](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Installazione

**Dal Chrome Web Store:** in arrivo. Una volta pubblicata l'estensione, la installi con un clic.

**Caricala tu (sviluppatori).** L'estensione si trova nel repository in `shells/chrome-extension/`. Quella cartella è la build di produzione, che funziona solo con Lolly su `https://lolly.tools`.

1. Apri `chrome://extensions`.
2. Attiva **Developer mode** (in alto a destra).
3. Fai clic su **Load unpacked** e scegli la cartella `shells/chrome-extension/`.
4. Ricarica la scheda di Lolly. Il rilevamento avviene al caricamento della pagina, quindi il prompt "Get the extension" scompare. **URL Screenshot** (in Utilities) può allora salvare le acquisizioni in un file e diventa disponibile in modalità Batch.

Per un server di sviluppo locale, esegui `pnpm run pack:chrome-extension:dev` e carica `dist/chrome-extension-dev`. Quel pacchetto accetta anche `http://localhost:5173` e ha **Development** nel nome.

## Cosa succede quando Lolly chiede

![La scheda di Lolly chiede una pagina e tu premi Approve once nella finestra di approvazione dell'estensione. Si apre una scheda in background, legge la pagina e si chiude. Poi la scheda di Lolly riceve il risultato.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly chiede.** Un piccolo script dice a Lolly che l'estensione è presente, quindi un'acquisizione o la lettura di una pagina può partire senza altra configurazione.
2. **Tu approvi.** L'estensione apre la propria finestra **Approve page request**. Mostra il sito richiedente, se vuole uno screenshot o il contenuto della pagina, e l'indirizzo della pagina. Nulla viene letto finché non premi **Approve once**. **Cancel**, o la chiusura della finestra, termina la richiesta.
3. **Chrome chiede una volta per sito.** La prima volta che approvi una richiesta per un sito, Chrome chiede anche se l'estensione può accedere a quel sito. Chrome mantiene quell'accesso una volta che lo consenti, ma ogni richiesta successiva richiede comunque il proprio **Approve once**.
4. **La pagina viene letta in una scheda in background.** L'estensione apre la pagina di destinazione in una scheda in background, la cattura tramite il DevTools Protocol (lo stesso `Page.captureScreenshot` che usa l'app desktop), chiude la scheda e consegna il risultato alla scheda di Lolly che l'aveva richiesto.

Un'approvazione copre una richiesta e scade dopo 30 secondi. Può esserci una sola richiesta in attesa o in esecuzione alla volta, e una richiesta approvata si ferma dopo 55 secondi. Se la pagina di Lolly si chiude o cambia, o la pagina di destinazione passa a un altro sito, la richiesta viene annullata.

L'acquisizione gira nel tuo browser, sulla tua rete, quindi `localhost` e i siti interni funzionano. La pagina si carica con la sessione del tuo browser, quindi una pagina in cui hai effettuato l'accesso può mostrare informazioni private nel risultato. L'acquisizione non viene caricata: l'unico traffico di rete è il tuo browser che carica la pagina che hai richiesto.

Mentre un'acquisizione è in corso potresti vedere brevemente un banner *"…started debugging this browser"* sulla scheda temporanea. È il DevTools Protocol al lavoro, e il banner scompare quando lo scatto è finito.

## Leggere un sito per Design System Setup

La sorgente **Website** in Design System Setup avvia un design system da un sito che hai già. In un browser Chromium la pagina viene letta dall'estensione. Nell'app desktop è l'app stessa a scaricare la pagina. In un browser senza estensione, il riquadro Website non viene offerto.

- **Un indirizzo, una pagina.** Dopo la tua approvazione, l'estensione apre la pagina in una scheda in background dello stesso tipo, legge il markup renderizzato, il testo dei fogli di stile e una manciata di immagini di icone e loghi, poi chiude la scheda. Non segue link né fa crawling.
- **Anche i fogli di stile ospitati altrove** (una CDN o un servizio di font) vengono scaricati, perché i colori e la tipografia della pagina vivono in essi. Le richieste tra origini diverse vanno senza i tuoi cookie; quelle della stessa origine li usano, come farebbe la pagina stessa.
- **Tutto ha un tetto**, con un limite al numero di fogli di stile e immagini e ai byte, così una pagina ostile o a metà rotta restituisce materiale parziale invece di bloccarsi.
- **Il parsing avviene sul tuo dispositivo.** I byte tornano direttamente alla scheda di Lolly che li ha richiesti, che li trasforma in colori, tipografia e loghi.

Incollare un indirizzo riempie soltanto il campo. Nulla viene letto finché non avvii la lettura e premi **Approve once**.

## Permessi

Il `manifest.json` dell'estensione dichiara quattro permessi, più un accesso ai siti che chiede un sito alla volta. Imposta `minimum_chrome_version: 111`, e la versione attuale è la 0.4.0.

| Permesso | A cosa serve | Quando viene concesso |
|---|---|---|
| `debugger` | Guida la scheda in background attraverso il DevTools Protocol, che scatta lo screenshot. | All'installazione |
| `tabs` | Apre la scheda temporanea in background e la chiude dopo, e verifica che né la pagina Lolly né la pagina di destinazione si siano spostate da quando hai approvato. | All'installazione |
| `scripting` | Esegue il lettore di una pagina all'interno del sito che hai indicato, per la sorgente Website. | All'installazione |
| `storage` | Annota l'id di una scheda che ha aperto, solo nella session storage, così la scheda si chiude comunque se il browser sospende l'estensione a metà lettura. Cancellato al prossimo avvio; nulla su di te viene conservato. | All'installazione |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Accesso ai siti, non concesso all'installazione. Quando premi **Approve once**, l'estensione chiede a Chrome l'accesso al solo sito di quella richiesta. | La prima volta che approvi una richiesta per quel sito, dopo che Chrome te lo chiede |

L'estensione legge solo la singola pagina che approvi. Non legge né invia i tuoi dati di navigazione, e nulla viene caricato.

## Risoluzione dei problemi

- **Vedi ancora "Get the extension"?** Ricarica la scheda di Lolly.
- **Non succede nulla su questo sito?** L'estensione funziona solo su `https://lolly.tools`, più `http://localhost:5173` nel pacchetto di sviluppo. Un'altra origine, come una copia self-hosted di Lolly, richiede una propria build dell'estensione che elenchi quell'origine sia in `manifest.json` sia in `policy.js`. Modificare solo il manifest non funziona.
- **Un'acquisizione fallisce?** Verifica che l'URL sia raggiungibile e inizi con `http://` o `https://`. Alcune pagine bloccano l'acquisizione automatica. Se hai premuto **Cancel**, chiuso la finestra di approvazione o aspettato più di 30 secondi, avvia di nuovo l'acquisizione.
