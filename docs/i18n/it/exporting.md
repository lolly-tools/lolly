# Esporta un file

Hai creato qualcosa e deve uscire da Lolly: un PNG per una chat, un PDF per la tipografia, un deck che un collega continuerà a modificare. Premi **Export**, la metà sinistra della pillola **Export | Save**. Scegli un formato accanto al nome del file, poi premi **Download**. Il file viene creato sul tuo dispositivo.

Ciò che vedi sulla tela è ciò che il file contiene. Il menu dei formati elenca solo ciò che questo strumento può creare in questo browser.

Per la maggior parte dei lavori, uno di tre formati è quello giusto:

| Per | Scegli | Perché |
|---|---|---|
| Uno schermo, un messaggio o una slide | **PNG** | Ogni app lo apre, e mantiene lo sfondo trasparente quando lo strumento lo offre |
| Una pagina finita, o qualsiasi cosa stampata | **PDF** | Una dimensione di pagina reale che stampa come appare; **Print PDF**, dove uno strumento lo offre, è la versione CMYK per la tipografia |
| Artwork che deve restare nitida a qualsiasi dimensione | **SVG** | Forme vettoriali, nitide da un badge a un banner |

::: check Controlla il file alla dimensione in cui verrà usato
Prima di inviarlo, aprilo sullo schermo per cui è stato creato, oppure stampalo alla sua dimensione reale.
:::

::: details Approvazioni e consegna con Lolly Work (facoltativo)
Un'[organizzazione che usa Lolly Work](/info/organisation.html) può governare quali formati e impostazioni di esportazione vedono i suoi membri. Dove è richiesta l'approvazione, **Request approval** prende il posto di **Download**. Segui la policy mostrata dalla tua istanza.

Lolly Work può anche consegnare un file a destinazioni S3, WebDAV e HTTP configurate, con passaggi di approvazione, ricevute di consegna e un record di audit. Inviare un file a quel flusso di lavoro lo manda al servizio dell'organizzazione; un normale download resta sul tuo dispositivo. Le destinazioni Send personali e la consegna dell'organizzazione sono configurate separatamente.

Gli operatori la configurano con la [guida alla consegna dell'organizzazione](/info/work-delivery.html). Per rendering e batch in coda sul server, vedi [CLI batch and automation](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

## Come funziona l'esportazione

Quando esporti, la tela dello strumento viene renderizzata nel formato che hai scelto e consegnata come download, oppure messa negli appunti.

Tre percorsi producono un file. La maggior parte degli strumenti **renderizza la tela**. I formati di testo e dati (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) vengono **generati dal contenuto dello strumento** anziché disegnati dall'immagine. Le utility per la privacy come *Strip Hidden Data* **trasformano il file che hai scelto**, sul tuo dispositivo, e lo restituiscono senza tela, filigrana né metadati aggiunti, perché è già un tuo file.

![Tre percorsi di esportazione convergono su un file finito: renderizzare la tela, generare testo o dati dal contenuto, o trasformare sul dispositivo un file scelto.](/info/diagrams/concepts/three-export-paths.svg)

Il pannello di esportazione offre queste azioni. L'autore di uno strumento sceglie quali compaiono; l'insieme predefinito è Copy, Download e Save.

- <!--i:download--> **Download** salva il file. Se poi non lo trovi, vedi [Find a file you downloaded](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> **Copy** mette l'immagine negli appunti, pronta da incollare in una chat, una email o un documento. Dove un browser non può copiare immagini, scarica invece e te lo dice.
- <!--i:folder--> **Save** conserva il design corrente in Projects con un clic e non scarica mai un file. **Save as**, accanto a **Download**, chiede dove (vedi [Saving and continuing](/info/using.html#saving-continuing)).
- <!--i:link--> **Share** apre la finestra Share: un link che riproduce il design, gli interruttori all'apertura (schermo intero, pannello di esportazione, download o copia all'apertura) e un **Shortest link** facoltativo che comprime l'intero stato in un token compatto (vedi [URL Mode](/info/url-mode.html)).

![Il pannello di esportazione - formato, dimensione e le azioni Copia / Scarica / Salva / Condividi](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Quando un design incorpora il rendering di un altro strumento, come un box immagine di Design che contiene un link QR Code, il rendering annidato viene disegnato nell'esportazione del genitore. Resta vero vettoriale in SVG e PDF e viene rasterizzato in modo nitido in PNG, JPG e WebP. Il rendering incorporato non riceve filigrana né provenienza propria; le riceve solo il file finito. Le esportazioni HTML, Markdown e TXT non possono contenere un rendering composto.

## Scegli un formato

Il nome del file e il menu del formato stanno insieme come un'unica coppia `name.format`, sotto **Scarica**.

![Il campo del nome file fuso con il selettore di formato, così l'esportazione si legge come un'unica coppia nome.formato](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Parti da dove va il file. Ogni scheda elenca i formati adatti a quella destinazione; uno strumento mostra solo quelli che può creare.

::: figure exporting-format-chooser
Sei destinazioni e i formati adatti a ciascuna.
:::

Un wordmark composto nel carattere del tuo design system si esporta come SVG con ogni lettera come tracciato in contorni, quindi un unico file resta nitido sia alla dimensione di un biglietto da visita sia a quella di un rivestimento di edificio.

![Un wordmark sottile e molto spaziato che dice Aurora, il tipo di grafica vettoriale pura di cui parla la riga SVG della tabella](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Ogni formato e a cosa serve
| Ti serve | Usa | Perché |
|---|---|---|
| Loghi o grafica nitidi che scalano | **SVG** | Vettoriale: scalabile, leggero e modificabile; un effetto che l'esportazione vettoriale non sa disegnare viene incorporato come immagine |
| Vettoriale per Office e app Windows | **EMF** | Si incolla come vettoriale modificabile in PowerPoint e Word, con testo vivo; Google Drive lo apre in Google Drawings |
| Vettoriale per stampa e app di design | **EPS**, o **EPS (CMYK)** | Vettoriale PostScript per Illustrator e flussi di stampa |
| Vettoriale per macchine da taglio | **DXF** | Taglierine laser, plotter per vinile e CNC: tracciati di contorno in millimetri |
| Un deck di slide modificabile | **PowerPoint** (PPTX) | Testo e forme nativi modificabili, con immagini e vettori che restano estraibili |
| Un documento di testo modificabile | **Word** (DOCX) o **OpenDocument** (ODT) | Veri paragrafi e titoli che un elaboratore di testi può continuare a modificare (Doc Studio) |
| Un layout per InDesign | **InDesign IDML (static subset)** | Testo, rettangoli, ovali e immagini, una pagina doppia per artboard (Design) |
| Un documento Penpot modificabile | **Penpot** | Board, forme, testo e token collegati |
| Una foto o un'immagine generica | **PNG** (senza perdita) o **JPG** (più leggero) | Raster universale |
| Immagini moderne più leggere | **WebP** o **AVIF** | Migliore compressione, con trasparenza |
| Stampa | **PDF**, o **Print PDF** (CMYK) | Dimensione reale della pagina; CMYK per una macchina da stampa |
| Raster di stampa per una macchina | **Print TIFF** (CMYK) | Pixel DeviceCMYK per un RIP |
| Animato per il web | **GIF** | Si riproduce ovunque; file più grandi |
| Animato con colore pieno e vera trasparenza | **APNG** | PNG animato: nessun limite di palette |
| Animato, file più piccolo | **Animated WebP** | Colore pieno e trasparenza, più piccolo di GIF o APNG |
| Vettoriale animato che scala | **Animated SVG** | Autonomo; va in loop in un browser o in un `<img>`, a qualsiasi dimensione (Lottie Ad) |
| Un'animazione che resta modificabile | **dotLottie** | Forme, tracciati e chiavi di trasformazione esterne dalla timeline di Design |
| Un passaggio a Premiere | **Premiere XML + media** | Clip temporizzate e media originali per Premiere (Design) |
| Video per social e condivisione | **MP4** o **WebM** | La migliore qualità per la dimensione del file (vedi [Video](#video)) |
| Sottotitoli | **SRT** o **VTT** | Testo temporizzato per un lettore video (Captions, Audiogram e Record) |
| Un corso di formazione | **SCORM (LMS)** | Un sito versionato, un pacchetto SCORM o xAPI (vedi [SCORM](#scorm-course-packages)) |
| Testo ricco o una firma email | **HTML** | Si incolla formattato nei client di posta |
| Contenuto semplice | **MD** o **TXT** | Solo testo |
| Un evento di calendario | **ICS** | Si importa in qualsiasi app di calendario |
| Una scheda contatto | **VCF** | Si importa nelle rubriche |
| Dati strutturati da reimportare | **JSON** o **CSV** | Round-trip del contenuto dello strumento |
| Una favicon | **ICO** | Icona del sito multi-dimensione; **ZIP** raggruppa più formati |
:::

### Trasparenza

Gli strumenti che la supportano offrono un interruttore per lo sfondo trasparente, come **No BG**. PNG, WebP, AVIF, SVG, APNG e Animated WebP mantengono la trasparenza, e GIF mantiene un bordo netto. JPG e PDF sono sempre opachi. TIFF viene appiattito sul bianco, o sul nero nel percorso HDR descritto in [HDR](#hdr-bright-colours).

## Dimensione e unità di stampa

Le esportazioni usano la dimensione in pixel nativa dello strumento a meno che lo strumento offra le **dimensions**. Allora imposti larghezza, altezza e una **unit**:

- **px** (il predefinito) sono pixel esatti.
- **mm, cm, in, pt** e **pc** sono dimensioni fisiche. Con un'unità fisica imposti anche i **DPI** (300 per impostazione predefinita). Un **PDF** diventa una vera pagina a quella dimensione, un **raster** ottiene il numero di pixel per quei DPI e ne registra la risoluzione, e un **SVG** mantiene l'unità fisica con un viewBox in pixel.

Per un raster a risoluzione più alta, inserisci una larghezza e un'altezza maggiori, oppure scegli un'unità fisica e aumenta i DPI (pixel = dimensione × DPI). Larghezza `210`, altezza `297` e unità `mm` danno una pagina A4.

![La riga delle dimensioni impostata a 210 per 297 mm, con il campo DPI rivelato perché l'unità è fisica](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Fermi immagine da una composizione temporizzata

Una composizione temporizzata, come una timeline [Sequence](/info/sequence-editor.html) in Design, si muove, quindi un'esportazione di immagine fissa deve scegliere un momento: **il fotogramma al cursore di riproduzione**. Posiziona il cursore dove vuoi l'immagine ed esporta.

Per più di un momento, il campo **Frames** compare accanto alla dimensione di output. Si mostra solo per una composizione temporizzata e un formato di immagine fissa (PNG, JPG, WebP, SVG o PDF). Lascialo a `1` per il fotogramma del cursore. Aumentalo e ottieni quel numero di immagini fisse, distribuite uniformemente su tutta la sequenza:

- PNG, JPG, WebP e SVG tornano come un unico ZIP: `<name>-01.png`, `-02.png` e così via.
- PDF torna come un unico documento con quel numero di pagine.

Ogni immagine viene dal centro della sua porzione di timeline, quindi il primo fotogramma non è mai un ingresso a metà dissolvenza e l'ultimo non è mai il momento vuoto dopo che ogni clip è finita.

::: figure exporting-contact-sheet
Frames: 4 taglia la sequenza in quattro porzioni uguali e prende il centro di ciascuna.
:::

Usalo per uno storyboard, un provino a contatto di revisione o un carosello social ricavato da un montaggio video. Il conteggio è limitato a 64, e qualsiasi altra cosa digitata nel campo ripiega su `1`. Ogni fotogramma è un normale fermo immagine, quindi credenziali, Imprint, unità fisiche e DPI si comportano come per una singola esportazione. Un link di esportazione, la CLI e MCP chiedono lo stesso provino con `cuts=` (vedi [Contact sheets](/info/url-export.html#contact-sheets)).

## Molti file insieme

Lolly ha tre modi di lavorare in volume, ciascuno per un compito diverso:

::: cols
## Una tabella diventa un documento
Uno strumento con un input a tabella, come **Battlecards**, trasforma ogni riga in una pagina. Incolla una tabella dal tuo foglio di calcolo e ottieni un PDF. Correggi le righe nel foglio di calcolo e incolla di nuovo.
## Un CSV diventa un file per riga
**Batch** (`#/batch`) prende un CSV ed esegue il rendering di un'esportazione per ogni riga: badge nominativi o certificati, un file ciascuno, consegnati in uno ZIP. Vedi [Batch](/info/batch.html#make-many-versions-of-one-design).
## Più design ricevono una modifica
**Multi-edit** apre più sessioni salvate affiancate per lo stesso ritocco su design diversi. Vedi [Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Da **Projects**, **Render folder** esporta ogni sessione salvata in una cartella e nelle sue sottocartelle come un unico ZIP annidato, e **Render selection** fa lo stesso per qualsiasi selezione multipla; una singola sessione salvata viene renderizzata nel proprio file. Una sessione salvata può anche essere condivisa di nuovo come link a uno strumento da Projects, che la riapre con le stesse impostazioni.

## File che restano modificabili altrove

Alcuni formati consegnano il tuo lavoro a un'altra applicazione come contenuto modificabile anziché come immagine.

### PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart, Diagrams, Flow Chart e Agenda esportano un deck PowerPoint, una slide per pagina. Ogni pagina viene scomposta in oggetti nativi, così un collega può modificare il deck e ricavarne risorse:

- <!--i:font--> Il **testo** diventa caselle di testo PowerPoint modificabili con corpo, colore, peso, corsivo e allineamento del layout.
- <!--i:pentool--> I **vettori** come loghi e icone sono incorporati come immagini SVG; restano nitidi, e PowerPoint può applicarvi *Convert to Shape*.
- <!--i:photos--> Le **immagini** arrivano alla risoluzione nativa come immagini a sé. Una hero ritagliata mantiene l'immagine intera dietro il ritaglio, e qualsiasi filtro o fusione su di essa è incorporato.
- <!--i:layers--> **Sfondi, bordi e filetti** diventano forme rettangolari e linee.

![Il pannello di esportazione con PowerPoint selezionato: una diapositiva per pagina, testo e forme rimangono modificabili](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Il layout è approssimato; lo scopo è contenuto riutilizzabile. Tutto ciò che il walker non sa esprimere in modo nativo, come una regione complessa filtrata o mascherata, viene incorporato come immagine così nulla va perso. Un deck ha un'unica dimensione di slide, presa dalla prima pagina.

PowerPoint è anche una via d'ingresso: [Rebrand a deck](/info/rebrand.html) porta un deck sul tuo design system, e [Import a design](/info/design-import.html) ne apre uno in Design.

### Penpot

La maggior parte degli strumenti che esportano SVG esporta anche un **file Penpot** (`.penpot`), pronto per continuare a essere modificato in Penpot.

| Cosa hai creato | In Penpot |
|---|---|
| Testo | Oggetti di testo modificabili: correggi un refuso o cambia stile |
| Forme, tracciati, gradienti e immagini | Forme vettoriali modificabili a sé |
| Un colore o un font da un token del design system | Un collegamento vivo al token: modifica il token e ogni forma che lo eredita lo segue |
| L'intero design | Un componente riutilizzabile nel pannello Assets |
| Un'illustrazione complessa o una tela live | Incorporata a sé come immagine, con il contenuto modificabile attorno intatto |

Da Design, ogni riquadro diventa una board di Penpot. I colori e le tipografie del design system arrivano nel pannello Assets e il suo insieme completo di token nel pannello Tokens. Da lì Penpot tiene una propria copia: un token modificato in Penpot ritorna attraverso l'importazione in [Design System Setup](/info/brand-studio.html).

![Il pannello di esportazione con Penpot selezionato: il file .penpot, e Send to Penpot accanto al download](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Per aprire il file, avvia Penpot, scegli un progetto e seleziona **Import**. Con l'accesso a Penpot effettuato dal pannello di esportazione, **Send to Penpot** fa questo passaggio per te.

### Word, OpenDocument e InDesign

**Doc Studio** esporta **Word** (DOCX) e **OpenDocument** (ODT) con veri paragrafi e titoli.

**Design** esporta **InDesign IDML (static subset)**: testo, rettangoli, ovali e immagini PNG o JPEG, una pagina doppia per artboard. La formattazione inline supportata resta modificabile, le immagini viaggiano in `Links` e le coordinate diventano punti InDesign. Ricollegamento, sostituzione dei font e variazioni dell'a capo possono richiedere attenzione. Effetti, animazione, storie composte e geometria non supportata fermano l'esportazione con un report che li elenca. IDML non conserva il documento originale, quindi invia un PDF per l'opera finita.

### Timeline: dotLottie e Premiere

Dalla timeline di Design, **dotLottie** scrive un'animazione che resta modificabile negli strumenti Lottie; [Lottie animations](/info/sequence-editor.html#lottie-animations) elenca ciò che conserva. **Premiere XML + media** impacchetta le clip temporizzate e i loro media originali per Premiere; vedi [Premiere XML exchange](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (pacchetti di corsi)

L'esportazione di corsi è disattivata finché non attivi **Training and courses** in Settings → Preferences → Feature flags.

Poi scegli **Export course** da uno strumento supportato, da una cartella di progetto o da una selezione. In Design, scegliere **SCORM (LMS)** e **Download** apre lo stesso flusso di lavoro del corso. Lolly salva il lavoro, ti lascia rivedere il contenuto e l'ordine del corso, poi apre il modulo e la sua finestra di esportazione.

- <!--i:layers--> Scegli una resa per ogni sorgente: pagine fisse, animazione come video, audio o una risorsa scaricabile. Aggiungi nel modulo il testo delle lezioni e le alternative di lettura.
- <!--i:clock--> Visualizza in anteprima il player del discente e rivedi descrizioni e sottotitoli. L'animazione è inclusa come video, anche quella senza audio.
- <!--i:document--> Scegli Website, SCORM 1.2, SCORM 2004 4th Edition o una destinazione xAPI sperimentale. Controlla il contenuto e la dimensione dello ZIP, poi salva e scarica la versione controllata.
- <!--i:check--> Il completamento richiede di confermare ogni lezione obbligatoria e di scegliere Finish.

![Il pannello di esportazione su una presentazione Design con SCORM (LMS) selezionato](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Il pacchetto contiene il suo contenuto finito e non richiede un account Lolly. Metti uno ZIP Website su un host HTTP(S); importa uno ZIP LMS senza modifiche. Prova la destinazione prima di condividere il corso. Per un corso costruito da più creazioni salvate, vedi [Create a training course](/info/training-creators.html).

### DXF (file di taglio)

Asset Export, Diagrams, Growth, Logo Wall, QR Code, Street Map, Wayfinding e Wordmark esportano **DXF**, il formato di interscambio AutoCAD R12 che leggono taglierine laser, plotter per vinile e software CNC. La geometria viene scritta come tracciati di contorno in millimetri, il testo viene convertito in contorni e il colore viene mappato sul più vicino AutoCAD Color Index, che di solito guida l'operazione della taglierina. DXF è solo line art: una regione fotografica o filtrata non ha un tracciato di taglio e viene scartata, con un avviso. Usa SVG o PDF per conservare il contenuto raster.

Street Map è il caso più chiaro. L'intero design è già fatto di tratti, quindi ogni strada e ogni canale diventa un tracciato di taglio.

::: showcase
![Un render Street Map di Parigi in inchiostro su crema - pura line art, quindi ogni tratto sopravvive al passaggio verso una tagliatrice](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Scorrendo, la telecamera si allontana attraverso la geometria vera e propria: sette percorsi, nessun pixel da nessuna parte, ogni tratto nitido come un capello a qualsiasi zoom. È lo stesso file che legge una tagliatrice.
:::

## Stampa

**Print PDF** scrive CMYK rispetto a una condizione di stampa con nome, **Coated FOGRA39** per impostazione predefinita. I campioni del brand con valori di inchiostro misurati convertono esattamente; gli altri colori usano una conversione standard del dispositivo. **Print TIFF** scrive pixel DeviceCMYK per un RIP e registra la stessa condizione di stampa nei suoi metadati TIFF. Il controllo Colour profile guida entrambi; [Colour profiles](#colour-profiles) ha i dettagli.

**Print marks & bleed** ha una propria scheda sui formati di stampa: l'abbondanza in millimetri più Crop, Registration, Bleed, Colour bars e Stamp details.

Alcuni strumenti creano un **PDF a più pagine**: una copertina, un contenuto che scorre su tutte le pagine che servono e una quarta di copertina, come nello strumento *Booklet*. Ogni pagina è una vera pagina PDF verticale in A4, US Letter o A5, e puoi forzare qualsiasi blocco su una nuova pagina. Sono documenti RGB senza crocini né segni di abbondanza, che appartengono al Print PDF a pagina singola. Un PDF di Design può anche essere un **Notes handout**: una pagina verticale per ogni slide con le sue note del relatore sotto.

**Prima di esportare.** Una scheda **Before you export** in fondo al pannello dice cosa sta per vedere una tipografia: formato, dimensione e abbondanza, aree di taglio e abbondanza, copertura d'inchiostro, conteggio delle lastre e numero di pagine, con un verdetto accanto al titolo. Non blocca mai un'esportazione. Design mostra sempre la scheda con i propri controlli, comprese le regole di stile del design system livello per livello e il segnale di scrittura per il testo del documento ([Before you export](/info/design.html#before-you-export)), e aggiunge questi controlli di stampa quando **Print preflight** è attivo. Negli altri strumenti, attiva **Print preflight** in Settings → Preferences → Feature flags; è disattivato per impostazione predefinita, e un'installazione di Lolly Work può attivarlo per i suoi membri.

**Dopo l'esportazione.** Una volta che il file è pronto, Lolly lo rilegge e lo confronta con ciò che hai scelto: formato, dimensione in pixel o pagina, durata della clip, sfondo trasparente, colore CMYK, HDR, Content Credentials e una password per PDF o ZIP. Tutto ciò che differisce viene scritto nella scheda di esportazione. Ogni misura viene dal file, mai dall'impostazione, e una proprietà a cui il file non sa rispondere non viene contata come corrispondenza. La riga di comando scrive il confronto completo con `--export-report` (vedi [Render with the CLI](/info/cli-rendering.html)).

I controlli dell'inspector di Design e il confronto con il brand in Design System Setup sono controlli distinti: guardano il design, mentre queste due schede guardano il file.

::: details Costo da un listino
Sotto il preflight, una scheda dei costi trasforma gli stessi conteggi in denaro, usando solo prezzi forniti da qualcuno. Legge quei conteggi anche quando la scheda di preflight stessa è disattivata. Servono due cose: un lavoro che un listino sa prezzare (lastre, fogli, area, pagine, righe di variante o file di output, quindi un semplice PNG di logo non la mostra mai) e un **rate card**, un listino prezzi JSON della tua tipografia. Una build predefinita non ne contiene e non ha un modo nell'app per caricarne uno. Un rate card arriva come risorsa del catalogo distribuita da un'installazione, oppure tramite l'estensione facoltativa dei rate card che un self-hoster o un control plane attiva. Senza rate card, non viene mostrato nulla.

Ogni cifra è una tariffa che hai fornito moltiplicata per una quantità contata da Lolly, come `4 plate × €35.00`, e il totale riporta la sua fonte: l'emittente sulla scheda e la data a cui risalgono le tariffe. Non c'è alcuna valuta predefinita né prezzo segnaposto. Ciò che il file dice di sé resta discorso riportato: *"The file says: … Lolly has not verified this."*

Quando una cifra non si può calcolare, la tabella viene ritirata anziché riempita:

- Le righe che la scheda non prezza significano **nessun totale**, solo un titolo che dice quante non sono prezzate.
- Una quantità che è un tetto porta **"up to"** nel suo subtotale.
- Le tariffe oltre la data di validità mostrano **solo i conteggi** finché non premi *Use these rates anyway*; la data di scadenza viaggia poi con la cifra.
- Aperto tramite un **link**, il denaro resta nascosto finché non lo chiedi su questo dispositivo. La CLI accetta `--rate-card=<file.json>` come file locale e mai come parametro di link.

La scheda viene rimossa da ogni stage di esportazione, quindi non cambia mai il file. È aritmetica, non un preventivo; solo la tua tipografia può fare un preventivo.
:::

## Movimento e suono

### Video

Gli strumenti animati esportano **MP4** e **WebM**. Il selettore mostra solo i contenitori che questo browser può creare, e un link condiviso con `?format=` che ne chiede uno che non può creare ripiega sull'altro, con un nome file coerente. Gli strumenti animati offrono anche **Start after**, che tiene ferma la tela per un attimo così animazioni e font si assestano prima della registrazione, e **Duration**, la durata della clip finita. **Motion blur** (Off, Draft quality, Standard o High, con uno **Shutter angle**) sfoca i movimenti rapidi al costo di tempo di rendering. Dove il browser lo supporta, **Record live** registra in tempo reale l'anteprima a schermo tramite una condivisione dello schermo.

![Le impostazioni di tempo per un'esportazione animata: Start after, Duration, Motion blur con il suo Shutter angle e Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** sceglie Smaller file, Balanced o Best quality. **Advanced** apre **Codec**, **Frame rate**, **Rate mode** e **Hardware acceleration**. Dove uno strumento ha i sottotitoli, **Captions** sceglie una **Embedded track** o un **Sidecar .vtt + .srt** accanto al video. Un link porta qualità, codec, frame rate, durata e ritardo di avvio come `vq`, `codec`, `fps`, `seconds` e `wait` ([URL parameters](/info/url-parameters.html)).

Le esportazioni video mantengono il loro suono. Uno strumento può stendere un **music bed** sotto la clip: una risorsa audio ripetuta o tagliata alla durata della clip, con dissolvenze, volume e ducking sotto il suono del filmato stesso. Gli strumenti di registrazione portano nel file il proprio audio dal vivo.

Un deck di Design che resta un deck a clic può comunque uscire come video. **Export slides as video** nel menu Present apre il pannello di esportazione su MP4. Ogni slide si riproduce per la propria permanenza, o per la Duration del pannello quando non ne ha, e la transizione tra slide del deck si riproduce tra di esse come dissolvenza. Il documento stesso non cambia.

### Immagini animate

**GIF** si riproduce ovunque e si adatta a chat ed email; è più grande e ha meno colori di un video. **APNG** e **Animated WebP** mantengono colore pieno e trasparenza. **Lottie Ad** esporta anche **Animated SVG**: fotogrammi vettoriali con keyframe CSS incorporati, quindi scala a qualsiasi dimensione e va in loop in una scheda del browser o in un `<img>` senza codec. Il suo testo è convertito in contorni, e usa un frame rate predefinito più basso perché ogni fotogramma è più pesante di una bitmap. Tutti questi sono senza audio.

### Audio

Alcuni strumenti esportano il suono da solo. **Voice Recorder** cattura una ripresa dal microfono con un indicatore di livello live e la salva come **MP3**, **WAV**, **M4A (AAC)** o **Opus (WebM)**, codificata sul tuo dispositivo. `wav`, `mp3`, `m4a` e `opus` sono normali id di formato, quindi un'esportazione audio è condivisibile e automatizzabile come un PNG.

Il selettore di risorse accetta un'ampia gamma di audio per un music bed, da MP3 e FLAC a MIDI e moduli tracker; [Formats](/info/formats.html) li elenca. Una [canzone Rondocode](/info/rondocode.html) si riproduce alla durata che la sua clip richiede.

## Colore e HDR

Lolly legge ogni colore CSS moderno, fa i suoi calcoli sul colore in modo percettivo e scrive ogni file in uno spazio che un lettore può aprire: sRGB per gli schermi, CMYK per la stampa e Rec.2100 PQ per l'HDR. [Colour in the engine](/info/colour-engine.html) spiega come. Un documento Design impostato su **Wide colour / HDR** segue regole proprie, descritte in [Wide colour and HDR editing](/info/hdr-editing.html).

### Profili colore

Le esportazioni sono contrassegnate con un profilo colore, così le app con gestione del colore come tipografie, Photoshop e browser leggono i colori come li hai visti. Succede automaticamente; miniature e anteprime saltano il tag per restare leggere.

- **PNG e JPG** portano un profilo ICC **sRGB** incorporato, lo spazio in cui viene disegnata l'anteprima. I pixel sono etichettati, non ricodificati.
- **Print PDF (CMYK)** dichiara la sua condizione di stampa nel proprio *OutputIntent*, dicendo a una tipografia come vanno letti i suoi inchiostri CMYK.
- **Print TIFF (CMYK)** scrive pixel DeviceCMYK senza tag e registra la condizione di stampa nei suoi metadati TIFF. Un TIFF non può incorporare un profilo di stampa, quindi una riga **Embed** registra solo il nome di quel profilo.
- **TIFF (RGB)** è il gemello sRGB non compresso per archivio o per un giro di andata e ritorno con un editor. Appiattisce la trasparenza sul bianco. Entrambi i TIFF sono solo desktop, perché i browser non possono mostrare in anteprima un TIFF.
- **SVG**, **EMF**, **EPS** e **DXF** sono vettoriali senza profilo incorporato: i colori SVG sono sRGB, EMF ed EPS usano RGB di dispositivo, **EPS (CMYK)** scrive DeviceCMYK e DXF usa l'AutoCAD Color Index. SVG, EPS e DXF convertono il testo in tracciati. EMF mantiene il testo vivo e modificabile in Office e Google Slides, ripiegando sui contorni solo per le porzioni che il formato non sa esprimere; l'opzione **Outline fonts** del pannello di esportazione forza i tracciati ovunque. SVG riproduce anche le ombre dei box CSS, interne ed esterne.

::: details PDF/X-4 e il tuo profilo di stampa
Con Lolly non viene distribuito alcun profilo CMYK. Una condizione di stampa con nome scrive l'output intent senza dichiarare la conformità a PDF/X-4, perché PDF/X-4 richiede il profilo incorporato.

Carica un profilo CMYK tuo e scegli la sua riga **Embed** nel controllo Colour profile. Viene incorporato come *DestOutputProfile* del file, e il PDF dichiara PDF/X-4 ogni volta che il resto del file lo consente. La condizione di stampa che dichiara è letta da quel profilo: un nome registrato dove il profilo ne dimostra uno, oppure `Custom` sotto il nome del profilo stesso.

Tre cose trattengono la dichiarazione pur mantenendo l'output intent: grafica RGB che il passaggio CMYK non ha saputo convertire, il testo di credito del margine di prova `prov` (disegnato in un carattere standard non incorporato) e una password **Strong**, dato che PDF/X-4 vieta la cifratura. Ogni PDF porta anche metadati PDF/X-4: box di pagina, XMP, un ID del documento e un output intent sRGB con il suo profilo.
:::

### HDR (colori brillanti)

Questa è la scheda **HDR** del pannello di esportazione, che rende più luminosa la grafica ordinaria per gli schermi HDR. Mantenere gli originali HDR durante la modifica è una funzione diversa: [Wide colour and HDR editing](/info/hdr-editing.html).

Un'esportazione ordinaria è sRGB: un colore saturo del brand è luminoso quanto il bianco normale dello schermo. Un display HDR ha margine sopra di esso. La scheda **HDR** potenzia i colori del tuo brand e il testo bianco verso la luminosità di picco, mentre le aree scure restano scure e danno contrasto al bagliore.

![La scheda HDR nel pannello di esportazione, attivata, con le manopole White / Reach / Dark lift / Focus rivelate sotto](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formati.** PNG, JPG, AVIF e TIFF. WebP è a 8 bit senza un percorso di decodifica HDR funzionante, e vettoriali e PDF non hanno un modello HDR.
- **Disattivato per impostazione predefinita**, perché cambia i pixel. Spunta la scheda, oppure passa `hdr=1` in un link di condivisione.
- **I quadranti.** **White** (il tetto della luminosità di picco, da 400 a 2000 nit), **Reach** (quanto in basso nei toni si estende il bagliore), **Dark lift** (quanto si illuminano gli scuri; `0` li mantiene scuri) e **Focus** (quanta ricchezza di colore conserva il potenziamento). Viaggiano come un unico valore: `hdr=1600-60-0-50` è White 1600, Reach 60, Dark lift 0 e Focus 50.
- **Cosa viene scritto.** PNG ottiene Rec.2100 PQ a 16 bit con un chunk `cICP`. JPG è un JPEG con gain map ISO 21496-1: una normale immagine SDR più una gain map aggiunta. AVIF ottiene un box `colr` riscritto. TIFF ottiene pixel PQ con un profilo ICC v4 generato che porta un tag `cicp`, e appiattisce sul nero, perché il bianco è il codice da 10.000 nit in PQ e farebbe un alone attorno a ogni bordo. Il potenziamento segue la luminosità percettiva (OKLab) e mantiene la tonalità, quindi un verde del brand diventa più luminoso, non mentolato.
- **Dove si vede il bagliore.** Visualizzatori con gestione del colore su un display HDR: Anteprima, Quick Look e Safari sui dispositivi Apple, o Chrome su un monitor HDR. Uno schermo SDR mostra un'immagine normale.
- **Prima di pubblicare.** Molte piattaforme ricodificano i caricamenti e tolgono il segnale HDR, il che può lasciare l'immagine scura o slavata. Usa l'HDR dove controlli la destinazione, come il tuo sito, un video wall o un deck su un pannello luminoso.
- **Dal terminale.** `--hdr=1` con `--export=png` o `--export=jpg` scrive lo stesso PNG e lo stesso JPEG con gain map sulla [CLI](/info/cli.html), con gli stessi encoder dell'engine, senza browser nel percorso. AVIF e TIFF per ora restano esportazioni web.

## Cosa viaggia con il tuo file

Un file finito può portare diversi record accanto all'immagine. Alcuni viaggiano accanto ai pixel e spariscono quando il file viene risalvato o ripulito; due marchi vivono nei pixel stessi.

::: figure exporting-what-travels
Dove vive ciascun record, se è attivo per impostazione predefinita e quale parametro di link controlla ciascuno.
:::

Il pannello di esportazione raggruppa **Licence**, **Source credits**, *Password protect*, **C2PA Credentials**, il **Lolly Imprint** e la **Durable credential** in un unico gruppo **Content protection** che mostra solo le schede che il formato scelto può usare. Si apre da solo quando un link o un documento dichiara già una licenza, o quando una fonte richiede una tua decisione. La scheda **Design system** resta fuori dal gruppo, in vista a ogni esportazione.

![Il gruppo Content protection aperto su un'esportazione PNG, che mostra solo le schede che si applicano ad essa](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Provenienza e filigrana

Dove il formato ha i campi, le esportazioni portano **metadati di provenienza**: il software, la fonte, il nome dello strumento e la riga di credito del tuo profilo, scritti in iTXt di PNG, EXIF di JPEG, info di PDF, `<metadata>` di SVG o commento di GIF. Registra solo la paternità, e nulla viene caricato. Gli strumenti **Experimental** applicano anche una filigrana visibile, applicata dall'host così che modificare lo strumento non possa rimuovere il segno.

**Il Lolly Imprint** è una filigrana invisibile nei pixel, **attiva per impostazione predefinita**. La credenziale e i metadati viaggiano accanto ai pixel e si perdono con un nuovo salvataggio, uno screenshot o una rimozione dei metadati. L'Imprint vive nei pixel e sopravvive alla ricompressione, quindi una copia può ancora essere riconosciuta come creata con Lolly. È un indizio e non una garanzia crittografica, e non contiene dati personali. Viaggia in JPEG XL, PNG, JPG, WebP, AVIF, TIFF e BMP, e nei raster che Lolly renderizza in un PDF o PPTX, mai in un'immagine che hai incorporato tu. Deseleziona **Lolly Imprint** o passa `imprint=0` per omettere l'Imprint. La sopravvivenza di AVIF alla ricodifica non è ancora calibrata. [Verify](/verify) lo rileva sul tuo dispositivo; vedi [The Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**La Durable credential** scrive l'id di Lolly nei pixel con un modello neurale sul dispositivo nel formato TrustMark, così il link "made with Lolly" sopravvive a una rimozione dei metadati e a una ricodifica e può essere letto da strumenti compatibili con TrustMark. È **disattivata per impostazione predefinita**, perché costa un passaggio neurale per esportazione e un download unico del modello. Copre PNG, JPG, WebP, AVIF e TIFF; spuntala nel pannello o passa `durable=1`. Le app desktop e mobile nascondono la scheda, perché offline non hanno un'origine da cui scaricare il modello.

**Licence.** Scegli come altri possono usare il tuo lavoro: *None (all rights reserved)* per impostazione predefinita, CC0 1.0, il Public Domain Mark 1.0, o una licenza Creative Commons 4.0 (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). Il nome della licenza e un link al suo deed vanno nei metadati di licenza del file (EXIF, XMP e RIFF dove il formato li ha) e nella sua Content Credential. La scelta viene salvata con il documento e viaggia in un link come `licence=`. Lolly scrive la licenza che hai scelto; non ne controlla né ne fa rispettare i termini. Uno strumento con un proprio campo licenza, come Claim, mantiene invece quel campo.

### Il record del design system

Un'esportazione registra il design system che ha creato il file: il suo nome, la versione pubblicata da cui è stato disegnato (quando non è la versione di lavoro) e la [colourway](/info/colourways.html) in cui è stato disegnato. Qualsiasi altra scelta di tema dichiarata da un design system, come una densità, viene registrata allo stesso modo. La scelta chiaro o scuro è omessa, perché l'immagine mostra già quale è stata usata.

**Vedi il record prima che venga scritto qualsiasi cosa.** La scheda **Design system**, spuntata per impostazione predefinita, mostra le parole esatte che il file porterà, come *Records: Acme · Colourway: Beach*, e la descrizione così come si leggerà. Il nome di un design system è ciò che i suoi proprietari hanno digitato, quindi la scheda lo mostra così com'è scritto. Deseleziona la scheda per omettere il record da quell'esportazione. Il pannello del documento di Design elenca le stesse parole sotto *Embedded in exports*.

**La descrizione indica la colourway accanto allo strumento.** Con la scheda spuntata, *"Made with https://lolly.tools : Chart"* diventa *"Made with https://lolly.tools : Chart (Beach colourway)"*. Il nome del design system resta nel record, non nella descrizione. Una descrizione senza nome di strumento, o una che uno strumento scrive dai propri input, resta com'è. Uno strumento che ignora le colourway tramite `tokenAxes` non ne registra alcuna, e il credito di prova del PDF (il segno di stampa `prov`) segue la stessa regola.

**Brand skill che hanno guidato un agente.** Quando un agente ha creato il pezzo e ha dichiarato i [brand skill](/info/brand-skills.html) che ha letto e seguito, il record elenca anche ogni skill con la sua revisione, come *Guided by: acme-brand 1.0*. Le parole significano che lo skill ha guidato il lavoro. Non sono un controllo: Lolly non verifica il pezzo rispetto a uno skill. Solo la dichiarazione dell'agente aggiunge l'elenco, il che oggi significa l'argomento `brandSkills` di `lolly_render` del [server MCP](/info/mcp.html), quindi un pezzo creato nell'app o da un link di condivisione non ne porta. La Content Credential contiene l'elenco come `brandSkills`, un unico valore JSON con id, nome, revisione e hash SHA-256 di ogni skill. Il pacchetto XMP e i metadati SVG contengono lo stesso valore come `lolly:BrandSkills`, un PDF scritto dal record ottiene una parola chiave per skill e la descrizione resta com'era. Uno skill interno è registrato con id, nome, revisione e hash, mai con il suo testo. Gli stessi interruttori omettono l'elenco insieme al resto del record: la scheda **Design system**, `_madewith=0`, `--no-madewith` e `madeWith: false`. Quando il server MCP disegna il file in un browser (un PDF, un JPEG e gli altri formati che il suo percorso senza browser non sa scrivere), i metadati del file stesso non contengono l'elenco e solo una Content Credential può contenerlo. Passa `c2pa` per mantenere il record; senza una credenziale il rendering avvisa che i brand skill non sono stati registrati.

**Rileggere il record.** [Verify](/verify) elenca il record come **Design system** nei dettagli della credenziale di un file e gli eventuali brand skill come **Guided by**. *Recreate with these settings* riapre lo strumento nella versione e nella colourway registrate. Il link si apre con il design system registrato quando questo dispositivo ne contiene uno con lo stesso id e nome; altrimenti si apre con il tuo design system attivo.

::: details Cosa viene scritto dove, e quali esecuzioni omettono il record
| Dove | Cosa viene scritto |
|---|---|
| Content Credential | `designSystem` (l'id), `designSystemLabel`, `designVersion` e `themes` nell'asserzione `tools.lolly.export`, ciascuno un semplice valore di testo; `themes` è un elenco JSON delle scelte |
| PNG, JPEG, WebP e JXL | Gli stessi quattro valori come proprietà `lolly:` del pacchetto XMP del file, nel namespace `https://lolly.tools/ns/export/1.0/` |
| SVG | Le stesse proprietà `lolly:` dentro il blocco `<metadata>` |
| PDF | Parole chiave come *Design system: Acme* e *Colourway: Beach* |
| Ogni formato con un campo descrizione | La descrizione, con la colourway accanto allo strumento |

La scheda compare solo quando c'è qualcosa da registrare e il formato può contenere il record. CSV, JSON, un file di calendario e altri formati di testo o dati non contengono metadati, ed EPS, EMF, DXF e BMP non hanno un campo per il record. HTML, Markdown e CSS contengono il record solo nella loro Content Credential, quindi per loro la scheda non mostra alcuna riga di descrizione e si nasconde mentre **C2PA Credentials** è disattivato. Un campo che il design system non fornisce resta fuori dal file.

Un link di condivisione disattiva il record con `_madewith=0` ([URL parameters](/info/url-parameters.html)); la riga di comando accetta `--no-madewith`, `lolly_render` del [server MCP](/info/mcp.html) accetta `madeWith: false`, e il pannello di esportazione dell'app da terminale ha una riga **Design system**. La riga di comando stampa su standard error le parole che un file finito porta, per il rendering di uno strumento e per ogni file che `lolly run` esporta da una sessione Design salvata, e un rendering MCP le stampa accanto al file, entrambe lette dal file. Un PNG che la riga di comando disegna senza browser non porta metadati di file, quindi il suo record viaggia solo nella credenziale. Le utility sul dispositivo non aggiungono alcun metadato.

Le esecuzioni senza una scheda **Design system** omettono il record: un'esecuzione Batch, una cartella esportata da Projects e un'esportazione di una raccolta 3D, e nell'app da terminale un batch CSV, un'esportazione di cartella o selezione di Projects e la vista render-everything. Esporta un file dallo strumento per registrare il design system.
:::

### Content Credentials (C2PA)

Le esportazioni possono portare **Content Credentials**: un manifest [C2PA](https://c2pa.org) firmato che registra cosa ha creato il file, quando e dove, legato a un hash dei byte del file così che qualsiasi modifica successiva sia rilevabile. La specifica è pubblicata dal C2PA, e Lolly scrive manifest standard che qualsiasi lettore C2PA può ispezionare.

![La scheda C2PA Credentials, spuntata, con la durata della credenziale accanto alla casella](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Attiva per impostazione predefinita.** La scheda **C2PA Credentials** è preselezionata per quasi ogni strumento. Deselezionala per un'esportazione, oppure passa `c2pa=off` in un link. Uno strumento può rifiutarla nel suo manifest.
- **Formati.** PDF (RGB e Print), PNG e APNG, JPG, GIF, SVG, TIFF (RGB e Print), WebP (fisso e animato), AVIF, MP4, WebM, i contenitori audio MP3, WAV, M4A, OGG/Opus e FLAC, e HTML, Markdown e CSS. Uno ZIP appone il marchio a ogni membro supportato, ed è così che un Animated SVG ne ottiene una. MP4, AVIF e M4A usano il binding BMFF standard e MP3 la sua mappatura ID3v2, quindi `c2patool` e altri lettori li verificano. WebM e OGG/Opus non hanno ancora una mappatura standard, quindi Lolly porta il manifest come allegato Matroska e come campo OpusTags, che il verificatore di Lolly stesso controlla. ICO, EPS, EMF, DXF, BMP, PPTX, i formati Office e gli altri formati di testo e dati non hanno un contenitore C2PA.
- **Cosa registra.** Lo strumento e l'app che hanno creato il file, l'ora di firma, la shell che lo ha esportato, il [design system e la colourway](#the-design-system-record) finché la scheda **Design system** è spuntata, e le impronte degli input attivi. Il testo degli input, i campi legati al profilo, i controlli inattivi, le versioni del browser e i dettagli del sistema operativo sono omessi. Il tuo nome e la tua email compaiono come autore solo quando **Use my details to create** è attivo in Settings → Preferences → Your details. Le fonti che un'esportazione inserisce viaggiano come ingredienti: [opere accreditate](#source-credits) come le emoji, e [canzoni Rondocode](/info/rondocode.html#songs-in-the-credential) in un'esportazione video o audio.
- **Cosa vedono i destinatari.** Strumenti C2PA come le app Adobe, `c2patool` e contentcredentials.org/verify leggono il manifest e mostrano la dichiarazione. Lolly firma con una chiave creata sul tuo dispositivo, non con un certificato di una trust list, quindi i visualizzatori riportano una credenziale *unverified*: la struttura e l'evidenza di manomissione sono reali, il firmatario non è garantito. Per cambiare questo, iscrivi una **verified identity** in Settings → Preferences → Content Credentials; vedi [Content Credentials Identity](/info/content-credentials-identity.html).
- **Controllare un file.** Trascina qualsiasi file su [Verify](/verify), oppure esegui `lolly validate <file>`, per un report sul dispositivo che parte da se il file è stato creato da Lolly e se è cambiato da allora. Verify guarda anche oltre la credenziale; vedi [What Verify checks](/info/what-verify-checks.html).
- **Privacy.** La chiave di firma viene creata per l'esportazione e non lascia mai il tuo dispositivo, e la dichiarazione contiene solo ciò che i metadati di provenienza già portano. Le utility per la privacy che trasformano i tuoi file non aggiungono alcuna credenziale, e *Strip Hidden Data* rimuove un manifest C2PA come qualsiasi altro metadato. L'utility Rondocode crea nuovo audio, quindi firma ciò che scrive ([Rondocode songs](/info/rondocode.html#files-from-the-rondocode-utility)).
- **Interazioni.** Un PDF protetto da password non può portare Content Credentials, a nessuno dei due livelli. La credenziale viene aggiunta per ultima, sopra i byte finiti, dopo DPI, EXIF, profilo colore, metadati PDF/X e segni di stampa.

### Source credits

Un'esportazione che include il lavoro di qualcun altro registra quella fonte nella credenziale. Un'emoji disegnata dal set di emoji scelto è il caso quotidiano: l'opera, il suo creatore, la licenza, la provenienza dei byte esatti e ciò che è cambiato viaggiano tutti con il file. Il testo in uno strumento il cui template è un SVG mantiene le emoji del sistema, quindi lì non viene accreditato nulla. La riga **Source credits** dice cosa chiedono le fonti per la consegna prima che tu scarichi, e dopo il download rilegge i byte consegnati prima di dire che i crediti sono nel file. Una licenza che chiede di scegliere, come un glifo CC BY-SA ricolorato che stai per condividere, ottiene una scheda con le opzioni; il download non viene mai bloccato. [Creative rights and credits](/info/creative-rights.html) ha la formulazione, le licenze riviste e ciò che resta tuo.

## Protezione con password

Due tipi di blocco, entrambi creati sul tuo dispositivo. La scheda *Password protect* del pannello di esportazione li guida entrambi.

![La card Proteggi con password espansa su un'esportazione PDF, con il campo password e i due livelli di blocco](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**Una password di apertura per PDF** ha due livelli una volta digitata una password:

- **Weak**: RC4 a 40 bit, un deterrente più che una protezione. La sua password può viaggiare in un link di condivisione, in chiaro. Solo `pdf` RGB.
- **Strong**: AES-256 (PDF 2.0). Digitata all'esportazione e mai messa in un link. Si applica anche ai Print PDF e a ogni PDF dentro uno ZIP batch. Un Print PDF bloccato con Strong mantiene CMYK, segni e output intent ma perde la dichiarazione PDF/X-4.

**Uno ZIP bloccato** riguarda un'esportazione ZIP, un download di cartella da Projects o un batch, con una password a due livelli: **Weak** (ZipCrypto, un deterrente; può viaggiare in un link `?password=`) o **Strong** (AES-256, digitata all'esportazione, mai in un link). La password protegge ogni membro, e ogni PDF all'interno è bloccato anche con AES-256 a sé, così resta bloccato dopo che lo ZIP è stato estratto. La richiesta compare all'avvio del download; una password vuota significa nessun blocco.

**Un link di condivisione protetto da password** chiede al destinatario una password prima di aprirsi. L'intero stato del link è cifrato con AES-256 sotto una chiave derivata dalla password (PBKDF2), quindi viaggia solo testo cifrato e la decifratura avviene nel browser del destinatario. Il server che serve il link non vede mai la password né il design. Attivalo nella finestra **Share**. Un link cifrato si apre solo in Lolly, mai come immagine incorporata. Vedi [URL Mode](/info/url-mode.html).

## Su telefono

I controlli di esportazione stanno dietro il pulsante fluttuante **Export**, che apre il pannello **Export**: gli stessi formati, dimensione, copia, download e condivisione, dimensionati per il tocco.

## Id di formato per link e CLI

Questi sono i valori per il parametro URL `format=` e il flag CLI `--export=` (vedi [URL parameters](/info/url-parameters.html) e [CLI](/info/cli.html)). Il menu di uno strumento mostra solo i formati che quello strumento può creare, quindi è sempre più corto di questo elenco.

| Tipo | Id |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (TIFF RGB) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vettoriale | `svg` · `svgz` (SVG compresso con gzip) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (file di taglio) |
| Pagina e documento | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (file di design Penpot) · `scorm` (pacchetto di corso, uno ZIP) |
| Animazione | `gif` · `apng` (PNG animato) · `webp-anim` (WebP animato) · `svg-anim` (SVG animato) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| Audio | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` |
| Testo e dati | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `css` · `scss` · `gpl` (palette GIMP) |
| Bundle e pacchetti | `zip` · `rpm` e `tar.gz` (il rendering sigillato in un pacchetto Linux) |

Alcuni id vengono dal codice di esportazione di uno strumento: `ase` (Adobe Swatch Exchange, da Palette Lab) ed `exr` e `hdr` (raster ad alta gamma dinamica, da Darkroom). **Convert Font** scrive `ttf`, `otf` e `woff` da un file di font che fornisci, quindi un link nudo non ha nulla da renderizzare per esso.
