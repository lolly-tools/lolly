# Estensione del browser

Una pagina web non può leggere i pixel di un altro sito. In un browser basato su Chromium (Chrome, Edge, Brave, Arc o Opera, a partire da Chrome 111), l'estensione gratuita **Lolly URL Screenshot** permette all'app web di Lolly di acquisire uno screenshot di una pagina con lo stesso sistema di acquisizione usato dall'app desktop. Con l'estensione installata:

- **[Lolly URL Screenshot](/t/url-shot)** salva in un file la pagina che hai composto;
- un indirizzo web incollato in uno spazio per immagini può diventare uno screenshot di quella pagina, con **Screenshot this page**;
- la sorgente **Website** in [Lolly Design System Setup](/info/brand-studio.html) può leggere una pagina per avviare un design system.

Approvi ogni richiesta e l'app desktop svolge le stesse attività senza l'estensione.

<!--i:eti-checklist-->
## Prima di installare

Senza l'estensione, **Lolly URL Screenshot** si apre comunque e puoi comporre uno scatto. Una nota in cima ai controlli dello strumento indica cosa manca.

![La nota dello strumento URL Screenshot che propone l'estensione, mostrata quando l'acquisizione su file non ha un host su cui essere eseguita](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Ogni controllo funziona senza l'estensione: l'URL di destinazione, la profondità di scorrimento, il tempo di attesa per la stabilizzazione, i margini di ritaglio e la ricolorazione. Solo l'acquisizione richiede l'estensione.

![I controlli di Lolly URL Screenshot con URL di destinazione, profondità di scorrimento, tempo di attesa per la stabilizzazione e margini di ritaglio, tutti utilizzabili prima che l'estensione sia presente](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

<!--i:eti-download-->
## Installa

**Dal Chrome Web Store:** in arrivo. Una volta pubblicata, l'estensione si installa con un clic.

**Caricala da te (sviluppatori).** Il codice sorgente dell'estensione si trova nel repository in `shells/chrome-extension/`. Il passaggio di creazione del pacchetto genera il pacchetto di produzione da quella cartella. Quel pacchetto funziona solo con Lolly su `https://lolly.tools`.

1. Esegui `pnpm run pack:chrome-extension`. Crea il pacchetto in `dist/chrome-extension/`.
2. Apri `chrome://extensions`.
3. Attiva **Developer mode** (in alto a destra).
4. Fai clic su **Load unpacked** e scegli la cartella `dist/chrome-extension/`.
5. Ricarica la scheda di Lolly. Lolly rileva l'estensione al caricamento della pagina e il messaggio "Get the extension" scompare. **Lolly URL Screenshot** (in Utilities) può quindi salvare le acquisizioni in un file e funziona in modalità Lolly Batch.

::: details Per un server di sviluppo locale o la cartella sorgente
Per un server di sviluppo locale, esegui `pnpm run pack:chrome-extension:dev` e carica invece `dist/chrome-extension-dev`. Quel pacchetto accetta anche `http://localhost:5173` e ha **Development** nel nome.

Caricare direttamente la cartella `shells/chrome-extension/` funziona anche per gli screenshot PNG. Quella cartella non contiene la scansione della pagina, che viene integrata durante la creazione del pacchetto. Un SVG da quella cartella contiene uno screenshot, non forme.
:::

<!--i:eti-user-check-->
## Cosa succede quando Lolly fa una richiesta

![La scheda di Lolly richiede una pagina e premi Approve once nella finestra di approvazione dell'estensione. Si apre una scheda in background, legge la pagina e si chiude. Poi la scheda di Lolly riceve il risultato.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly fa una richiesta.** Un piccolo script comunica a Lolly che l'estensione è presente, così un'acquisizione o la lettura di una pagina può iniziare senza altre configurazioni.
2. **Tu approvi.** L'estensione apre la propria finestra **Approve page request**. Mostra il sito richiedente, se vuole uno screenshot o il contenuto della pagina e l'indirizzo della pagina. Non viene letto nulla finché non premi **Approve once**. **Cancel**, o la chiusura della finestra, termina la richiesta.
3. **Chrome chiede una volta per sito.** La prima volta che approvi una richiesta per un sito, anche Chrome chiede se l'estensione può accedere a quel sito. Chrome conserva quell'accesso dopo che lo hai consentito, ma ogni richiesta successiva richiede comunque il proprio **Approve once**.
4. **La pagina viene letta in una scheda in background.** L'estensione apre la pagina di destinazione in una scheda in background, la acquisisce tramite DevTools Protocol (lo stesso `Page.captureScreenshot` usato dall'app desktop), chiude la scheda e restituisce il risultato alla scheda di Lolly che lo ha richiesto.

::: details Come funziona un'acquisizione SVG
Per un **SVG**, l'estensione scansiona la pagina invece di scattare una foto dello schermo. Uno script incluso nell'estensione legge il layout della pagina nella scheda in background e trasforma la pagina in forme e testo convertito in contorni. Il file resta nitido a qualsiasi dimensione e ogni parte resta modificabile. Le immagini sulla pagina restano immagini. Tutto ciò che la pagina disegna con un canvas, un video o un effetto che SVG non può esprimere viene copiato da uno screenshot dello stesso istante. Lolly confronta il risultato con quello screenshot. Quando i due differiscono troppo, l'SVG contiene invece lo screenshot.

Per convertire il testo in contorni nel carattere della pagina, l'estensione passa a Lolly i file dei font caricati dalla pagina. Chrome non conserva i byte di un font dove un'estensione possa leggerli, quindi l'estensione chiede di nuovo alla pagina ogni font. Il browser di solito risponde dalla propria cache e la policy di sicurezza della pagina si applica comunque a quella richiesta.
:::

Un'approvazione copre una richiesta e scade dopo 30 secondi. Solo una richiesta alla volta può essere in attesa o in esecuzione e una richiesta approvata si ferma dopo 55 secondi. Se la pagina di Lolly si chiude o cambia, oppure la pagina di destinazione passa a un altro sito, la richiesta viene annullata.

::: warning Le acquisizioni usano la tua sessione del browser
La pagina viene caricata con la tua sessione del browser, quindi una pagina a cui hai effettuato l'accesso può mostrare informazioni private nel risultato.
:::

L'acquisizione avviene nel tuo browser sulla tua rete, quindi `localhost` e i siti interni funzionano. L'acquisizione non viene caricata su un server. L'unico traffico di rete è quello del browser che carica la pagina richiesta e, per un SVG, i file dei font di quella pagina una seconda volta.

Durante un'acquisizione potresti vedere brevemente un banner *"…ha avviato il debug di questo browser"* nella scheda temporanea. Il banner proviene da DevTools Protocol e scompare al termine dello scatto.

<a id="reading-a-site-for-design-system-setup"></a>
<!--i:eti-globe-->
## Leggere un sito per Lolly Design System Setup

La sorgente **Website** in Lolly Design System Setup avvia un design system da un sito che hai già. In un browser Chromium l'estensione legge la pagina. Nell'app desktop, l'app recupera la pagina direttamente. In un browser senza estensione, la scheda Website non viene proposta.

- **Un indirizzo, una pagina.** Dopo la tua approvazione, l'estensione apre la pagina nello stesso tipo di scheda in background, legge il markup renderizzato, il testo dei fogli di stile e alcune immagini di icone e loghi, poi chiude la scheda. L'estensione non segue link né esplora il sito.
- **Vengono recuperati anche i fogli di stile ospitati altrove** (su una CDN o un servizio di font), perché contengono i colori e i caratteri della pagina. Le richieste cross-origin vengono inviate senza i tuoi cookie. Le richieste same-origin usano i tuoi cookie, come farebbe la pagina.
- **Tutto ha un limite**, con un tetto al numero di fogli di stile e immagini e ai byte, così una pagina ostile o parzialmente malfunzionante restituisce materiale parziale invece di bloccarsi.
- **Il parsing avviene sul tuo dispositivo.** I byte tornano direttamente alla scheda di Lolly che li ha richiesti, che li trasforma in colori, caratteri e loghi.

Incollare un indirizzo compila solo il campo. Non viene letto nulla finché non avvii la lettura e premi **Approve once**.

<!--i:eti-lock-->
## Permessi

Il `manifest.json` dell'estensione dichiara quattro permessi, più l'accesso ai siti che richiede per un sito alla volta. Imposta `minimum_chrome_version: 111` e la versione corrente è 0.5.0.

| Permesso | A cosa serve | Quando viene concesso |
|---|---|---|
| `debugger` | Controlla la scheda in background tramite DevTools Protocol, che acquisisce lo screenshot e, per un SVG, esegue la scansione della pagina. | All'installazione |
| `tabs` | Apre la scheda temporanea in background e la chiude dopo l'uso, e verifica che né la pagina di Lolly né quella di destinazione abbiano cambiato indirizzo dopo la tua approvazione. | All'installazione |
| `scripting` | Esegue il lettore di una singola pagina nel sito che hai indicato, per la sorgente Website. | All'installazione |
| `storage` | Annota l'id di una scheda che ha aperto, solo nell'archiviazione della sessione, così la scheda viene comunque chiusa se il browser sospende l'estensione durante la lettura. Cancellato all'avvio successivo; non viene memorizzato nulla su di te. | All'installazione |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Accesso al sito, non concesso all'installazione. Quando premi **Approve once**, l'estensione chiede a Chrome l'accesso al solo sito di quella richiesta. | La prima volta che approvi una richiesta per quel sito, dopo che Chrome te lo chiede |

L'estensione legge solo la pagina che approvi. Non legge né invia i tuoi dati di navigazione.

<!--i:eti-help-->
## Risoluzione dei problemi

- **Vedi ancora "Get the extension"?** Ricarica la scheda di Lolly.
- **Non succede nulla su questo sito?** L'estensione funziona solo su `https://lolly.tools`, più `http://localhost:5173` nel pacchetto di sviluppo. Un'altra origine, come una copia di Lolly ospitata in proprio, richiede una propria build dell'estensione che elenchi quell'origine sia in `manifest.json` sia in `policy.js`. Modificare solo il manifest non funziona.
- **Un'acquisizione non riesce?** Controlla che l'URL sia raggiungibile e inizi con `http://` o `https://`. Alcune pagine bloccano l'acquisizione automatizzata. Se hai premuto **Cancel**, chiuso la finestra di approvazione o atteso più di 30 secondi, riavvia l'acquisizione.
