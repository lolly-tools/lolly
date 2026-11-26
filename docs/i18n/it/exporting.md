# Esporta un file

Premi **Export**, la metà sinistra della pillola **Export | Save**, scegli un formato accanto al nome del file e premi **Download**. Il file viene creato sul tuo dispositivo.

Il file contiene ciò che vedi sulla tela. Il menu dei formati elenca solo quelli che lo strumento può creare in questo browser.

Per la maggior parte dei lavori serve uno di tre formati:

| Per | Scegli | Perché |
|---|---|---|
| Uno schermo, un messaggio o una slide | **PNG** | Ogni app lo apre e conserva lo sfondo trasparente quando lo strumento lo offre |
| Una pagina finita o qualsiasi contenuto stampato | **PDF** | Una dimensione di pagina reale che in stampa corrisponde a ciò che vedi; **Print PDF**, negli strumenti che lo offrono, è la versione CMYK per la stampa tipografica |
| Grafica che deve restare nitida a qualsiasi dimensione | **SVG** | Forme vettoriali |

::: check Controlla il file alla dimensione d'uso
Prima di inviare il file, aprilo sullo schermo a cui è destinato o stampalo alla dimensione reale.
:::

::: details Approvazioni e consegna con Lolly Work (facoltativo)
Un'[organizzazione che usa Lolly Work](/info/organisation.html) può scegliere quali formati e impostazioni di esportazione vedono i suoi membri. Quando serve un'approvazione, **Request approval** sostituisce **Download**. Segui la policy che mostra la tua istanza.

Lolly Work può anche consegnare un file a destinazioni S3, WebDAV e HTTP configurate, con passaggi di approvazione, ricevute di consegna e un record di audit. Questa consegna invia il file al servizio dell'organizzazione. Un download normale resta sul tuo dispositivo. Le destinazioni Send personali e la consegna dell'organizzazione si configurano separatamente.

Gli operatori configurano questa funzione con la [guida alla consegna dell'organizzazione](/info/work-delivery.html). Per rendering e batch in coda sul server, vedi [Batch e automazione con la CLI](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

<!--i:eti-cpu-->
## Come funziona l'esportazione

Tre percorsi producono un file. La maggior parte degli strumenti **renderizza la tela**. I formati di testo e dati (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) vengono **generati dal contenuto dello strumento**. Le utility per la privacy come *Lolly Strip Hidden Data* **trasformano il file che hai scelto** sul tuo dispositivo. Il risultato non ha tela, filigrana o metadati aggiunti.

![Tre percorsi di esportazione convergono su un file finito: renderizzare la tela, generare testo o dati dal contenuto o trasformare un file scelto sul dispositivo.](/info/diagrams/concepts/three-export-paths.svg)

L'autore di uno strumento sceglie quali azioni offre il pannello di esportazione. L'insieme predefinito è Copy, Download e Save.

- <!--i:download--> **Download** salva il file. Se poi non riesci a trovarlo, vedi [Trovare un file scaricato](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> **Copy** mette l'immagine negli appunti. Se un browser non può copiare immagini, Copy scarica il file e te lo comunica.
- <!--i:folder--> **Save** conserva il design corrente in Projects e non scarica mai un file. **Save as**, accanto a **Download**, chiede dove salvarlo (vedi [Salvare e continuare](/info/using.html#saving-continuing)).
- <!--i:link--> **Share** apre la finestra Share: un link che riproduce il design, gli interruttori per le azioni all'apertura (schermo intero, pannello di esportazione, download o copia all'apertura) e un **Shortest link** facoltativo che racchiude lo stato in un token compatto (vedi [Modalità URL](/info/url-mode.html)).

**Send to**, una scheda nel pannello di esportazione, invia il file a un servizio che hai collegato. Dopo un invio a Google Drive, Nextcloud, un bucket S3, Dropbox o OneDrive, **Create a share link** può creare un link lì senza un secondo caricamento. La sezione **Share through your cloud** della finestra Share invia un file `.lolly` e ne crea il link in un solo passaggio. Il pannello del link mostra chi può aprirlo, dove si trova il file e quando scade il link. **Links you've shared**, nella finestra Share, ti permette di interrompere la condivisione. I link di Nextcloud possono avere una password e una data di scadenza. I link S3 durano da 1 a 7 giorni e non possono essere disattivati prima. Lolly non conserva copie del file né token di accesso su un server. [Privacy](/info/privacy.html#every-network-request-the-app-can-make) elenca ciò che riceve ogni servizio.

![Il pannello di esportazione - formato, dimensione e azioni Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Quando un design incorpora il rendering di un altro strumento, come un box immagine di Lolly Design che contiene un link QR Code, l'esportazione del genitore disegna il rendering annidato. Resta vettoriale in SVG e PDF e viene rasterizzato in PNG, JPG e WebP. Il rendering incorporato non riceve filigrana né provenienza propria; le riceve solo il file finito. Le esportazioni HTML, Markdown e TXT non possono contenere un rendering composto.

<!--i:eti-file-->
## Scegli un formato

Il nome del file e il menu del formato sono affiancati in un'unica coppia `name.format`, sotto **Download**.

![Il campo del nome file unito al selettore del formato, così l'esportazione appare come un'unica coppia name.format](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Parti dalla destinazione del file. Ogni scheda elenca i formati adatti a quella destinazione.

::: figure exporting-format-chooser
Sei destinazioni con i formati adatti a ciascuna.
:::

Un wordmark composto nel carattere del tuo design system viene esportato come SVG con ogni lettera convertita in un tracciato di contorno. Il file resta nitido a qualsiasi dimensione.

Il testo in un'altra lingua dipende dai font che hai. Quando un font del tuo design system contiene le lettere, SVG e PDF le disegnano come contorni, composte e nell'ordine di lettura, comprese le righe da destra a sinistra. Quando nessun font le contiene, Lolly usa un [font di riserva](/info/fallback-fonts.html) e la scheda di esportazione lo mostra. Il testo che nessun font di riserva copre resta testo live in un SVG, disegnato dai font del visualizzatore. In un PDF, EPS o WMF e in un EMF con **Outline fonts** attivo, quel testo diventa immagini. Quelle parole appaiono come nella pagina ma non si possono selezionare né cercare. La scheda di esportazione elenca quelle scritture. Aggiungi un font con quelle lettere per mantenerle come testo vettoriale.

![Un wordmark dal tratto sottilissimo e con ampia spaziatura che dice Aurora, il tipo di grafica vettoriale pura a cui si riferisce la riga SVG della tabella](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Ogni formato e il suo uso
| Ti serve | Usa | Perché |
|---|---|---|
| Loghi nitidi o grafica che scala | **SVG** | Vettoriale: scalabile, leggero e modificabile; un effetto che l'esportazione vettoriale non può disegnare viene incorporato come immagine |
| Vettoriale per Office e app Windows | **EMF** | Si incolla come vettoriale modificabile in PowerPoint e Word, con testo live; Google Drive lo apre in Google Drawings |
| Vettoriale per stampa e app di design | **EPS** o **EPS (CMYK)** | Vettoriale PostScript per Illustrator e flussi di stampa |
| Vettoriale per macchine da taglio | **DXF** | Taglierine laser, plotter per vinile e CNC: tracciati di contorno in millimetri |
| Un deck di slide modificabile | **PowerPoint** (PPTX) | Testo e forme nativi modificabili, con immagini e vettori che restano estraibili |
| Un documento di testo modificabile | **Word** (DOCX) o **OpenDocument** (ODT) | Paragrafi e titoli che un elaboratore di testi può continuare a modificare (Lolly Doc Studio) |
| Un layout per InDesign | **InDesign IDML (static subset)** | Testo, rettangoli, ovali e immagini, una pagina doppia per artboard (Lolly Design) |
| Un documento Penpot modificabile | **Penpot** | Board, forme, testo e token collegati |
| Una foto o un'immagine generica | **PNG** (senza perdita) o **JPG** (più leggero) | Raster universale |
| Immagini moderne più leggere | **WebP** o **AVIF** | Migliore compressione, con trasparenza |
| Stampa | **PDF** o **Print PDF** (CMYK) | Dimensione reale della pagina; CMYK per una macchina da stampa |
| Raster di stampa per una macchina da stampa | **Print TIFF** (CMYK) | Pixel DeviceCMYK per un RIP |
| Animazione per il web | **GIF** | Si riproduce ovunque; file più grandi |
| Animazione a colori pieni e con vera trasparenza | **APNG** | PNG animato: nessun limite di palette |
| Animazione nel file più piccolo | **Animated WebP** | Colori pieni e trasparenza, più piccolo di GIF o APNG |
| Vettoriale animato che scala | **Animated SVG** | Autonomo; si ripete in un browser o in un `<img>`, a qualsiasi dimensione (Lottie Ad) |
| Un'animazione che resta modificabile | **dotLottie** | Forme, tracciati e fotogrammi chiave delle trasformazioni esterne dalla timeline di Lolly Design |
| Una consegna per Premiere | **Premiere XML + media** | Clip temporizzate e contenuti multimediali originali per Premiere (Lolly Design) |
| Video per i social e la condivisione | **MP4** o **WebM** | La qualità migliore in rapporto alla dimensione del file (vedi [Video](#video)) |
| Sottotitoli | **SRT** o **VTT** | Testo temporizzato per un lettore video (Captions, Audiogram e Record) |
| Sottotitoli per la trasmissione televisiva | **TTML** o **SCC** | Testo temporizzato IMSC1.1 o sottotitoli pop-on CEA-608 (Captions; vedi [Sottotitoli per la trasmissione televisiva](#broadcast-captions)) |
| Un corso di formazione | **SCORM (LMS)** | Un sito web, un pacchetto SCORM o xAPI con versioni (vedi [SCORM](#scorm-course-packages)) |
| Testo formattato o una firma email | **HTML** | Si incolla formattato nei client di posta |
| Un'animazione riproducibile in un browser | **HTML** | Un lettore in un unico file, dalla timeline di Lolly Design o da Snippet (vedi [Video](#video)) |
| Contenuto semplice | **MD** o **TXT** | Solo testo |
| Un evento di calendario | **ICS** | Si importa in qualsiasi app di calendario |
| Una scheda contatto | **VCF** | Si importa nelle rubriche |
| Dati strutturati da reimportare | **JSON** o **CSV** | Consentono di esportare e reimportare il contenuto dello strumento |
| Una favicon | **ICO** | Icona del sito in più dimensioni; **ZIP** raccoglie diversi formati |
:::

### Trasparenza

Gli strumenti che lo supportano offrono un interruttore per lo sfondo trasparente, come **No BG**. PNG, WebP, AVIF, SVG, APNG e Animated WebP mantengono la trasparenza e GIF mantiene un bordo netto. JPG e PDF sono sempre opachi. TIFF appiattisce su bianco o su nero nel percorso [HDR](#hdr-bright-colours).

<!--i:eti-crop-->
## Dimensioni e unità di stampa

Le esportazioni usano la dimensione nativa dello strumento in pixel, a meno che lo strumento non offra **dimensioni**. In quel caso imposti larghezza, altezza e un'**unità**:

- **px** (il valore predefinito) indica il numero esatto di pixel.
- **mm, cm, in, pt** e **pc** sono dimensioni fisiche. Con un'unità fisica imposti anche i **DPI** (300 per impostazione predefinita). Un **PDF** diventa una pagina reale di quella dimensione. Un **raster** riceve il numero di pixel per quei DPI e registra la risoluzione. Un **SVG** mantiene l'unità fisica con un viewBox in pixel.

Per un raster a risoluzione più alta, inserisci larghezza e altezza maggiori oppure scegli un'unità fisica e aumenta i DPI (pixel = dimensione × DPI). Larghezza `210`, altezza `297` e unità `mm` creano una pagina A4.

![La riga delle dimensioni impostata su 210 per 297 mm, con il campo DPI visibile perché l'unità è fisica](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

<!--i:eti-images-->
## Immagini fisse da una composizione temporizzata

Da una composizione temporizzata, come una timeline [Sequence](/info/sequence-editor.html) in Lolly Design, l'esportazione di un'immagine fissa prende **il fotogramma in corrispondenza della testina di riproduzione**. Posiziona la testina nel punto di cui vuoi un'immagine ed esporta.

Per più momenti, usa il campo **Frames** accanto alla dimensione dell'output. Compare solo per una composizione temporizzata e un formato di immagine fissa (PNG, JPG, WebP, SVG o PDF). `1` restituisce il fotogramma alla testina. Un numero maggiore restituisce quel numero di immagini fisse, distribuite uniformemente nella sequenza:

- PNG, JPG, WebP e SVG vengono restituiti in un unico ZIP: `<name>-01.png`, `-02.png` e così via.
- PDF viene restituito come un unico documento con quel numero di pagine.

Ogni immagine fissa proviene dal centro del proprio segmento della timeline, quindi la prima non è mai un ingresso a metà dissolvenza e l'ultima non è mai il momento vuoto dopo la fine delle clip.

::: figure exporting-contact-sheet
Frames: 4 divide la sequenza in quattro segmenti uguali e prende il centro di ciascuno.
:::

Usa Frames per uno storyboard, un provino a contatto da revisionare o un carosello social ricavato da un montaggio video. Il limite è 64. Qualsiasi altro valore digitato nel campo torna a `1`. Ogni fotogramma è una normale immagine fissa, quindi credenziali, Imprint, unità fisiche e DPI si comportano come per una singola esportazione. Un link di esportazione, la CLI e MCP richiedono lo stesso provino con `cuts=` (vedi [Provini a contatto](/info/url-export.html#contact-sheets)).

<!--i:eti-copy-->
## Più file alla volta

Lolly offre tre modi per lavorare su grandi quantità:

::: cols
## Una tabella diventa un documento
Uno strumento progettato per impaginare una tabella di input trasforma ogni riga in una pagina. Incolla una tabella dal tuo foglio di calcolo per ottenere un unico PDF. Per correggere le righe, modifica il foglio di calcolo e incolla di nuovo. Battlecards è lo strumento di riferimento. Si trova nella cartella open source `community` e non è elencato su lolly.tools.
## Un CSV diventa un file per riga
**Batch** (`#/batch`) prende un CSV e renderizza un'esportazione per ogni riga, come badge con nomi o certificati, consegnati in uno ZIP. Vedi [Lolly Batch](/info/batch.html#make-many-versions-of-one-design).
## Più design ricevono la stessa modifica
**Lolly Multi-edit** apre diverse sessioni salvate affiancate per applicare la stessa modifica a ciascuna. Vedi [Lolly Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Uno strumento con più pagine, come Booklet, Print Sheet, Lolly Doc Studio o Lolly Markdown Slides, esporta PNG, JPG, WebP, SVG e gli altri formati a immagine singola come un file per pagina, in uno ZIP quando sono più di una. Print Sheet mantiene il foglio intero e i segni di taglio ai DPI scelti.

Da **Projects**, **Render folder** esporta ogni sessione salvata in una cartella e nelle sue sottocartelle in un unico ZIP con la stessa struttura. **Render selection** fa lo stesso per una selezione multipla. Una singola sessione salvata viene renderizzata nel proprio file. Projects può anche condividere di nuovo una sessione salvata come link allo strumento che riapre la sessione con le stesse impostazioni.

<!--i:eti-pen-->
## File che restano modificabili altrove

Alcuni formati passano il tuo lavoro a un'altra applicazione come contenuto modificabile anziché come immagine.

### PowerPoint (PPTX)

Lolly Design, Lolly Markdown Slides, Booklet, Lolly Doc Studio, Lolly Chart, Diagrams, Flow Chart e Agenda esportano un deck PowerPoint, una slide per pagina. Ogni pagina viene suddivisa in oggetti nativi che un collega può modificare ed estrarre:

- <!--i:font--> **Il testo** diventa caselle di testo PowerPoint modificabili con corpo del font, colore, peso, corsivo e allineamento del layout. Un deck Lolly Design imposta il carattere del brand su ogni segmento di testo, anche senza uno schema diapositiva.
- <!--i:pentool--> **I vettori**, come loghi e icone, vengono incorporati come immagini SVG, su cui PowerPoint può eseguire *Convert to Shape*.
- <!--i:photos--> **Le immagini** vengono trasferite come immagini separate alla risoluzione nativa. Un'immagine principale ritagliata conserva l'immagine intera dietro il ritaglio. Ogni filtro o fusione applicati a un'immagine diventano parte integrante dell'immagine.
- <!--i:layers--> **Sfondi, bordi e filetti** diventano forme rettangolari e linee. Cerchi, ellissi e pillole di Lolly Design restano forme native modificabili.

![Il pannello di esportazione con PowerPoint selezionato: una slide per pagina, testo e forme mantenuti modificabili](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Il layout è approssimativo. Tutto ciò che il walker non può esprimere in modo nativo, come una regione complessa con filtri o maschere, viene incorporato come immagine. Un deck ha un'unica dimensione delle slide, ricavata dalla prima pagina.

PowerPoint è anche un formato di ingresso: [Applicare un nuovo brand a un deck](/info/rebrand.html) adatta un deck al tuo design system e [Importare un design](/info/design-import.html) ne apre uno in Lolly Design.

### Penpot

La maggior parte degli strumenti che esportano SVG esporta anche un **file Penpot** (`.penpot`).

| Cosa hai creato | In Penpot |
|---|---|
| Testo | Oggetti di testo modificabili |
| Forme, tracciati, gradienti e immagini | Forme vettoriali modificabili |
| Un colore o un font da un token del design system | Un collegamento live al token: modifica il token e ogni forma che lo eredita si aggiorna |
| L'intero design | Un componente riutilizzabile nel pannello Assets |
| Un'illustrazione complessa o una tela live | Un'immagine incorporata; il contenuto attorno resta modificabile |

Da Lolly Design, ogni riquadro diventa una board Penpot. I colori e gli stili tipografici del design system vanno nel pannello Assets e l'intero insieme di token nel pannello Tokens. Penpot conserva la propria copia. Un token modificato in Penpot torna attraverso l'importazione in [Lolly Design System Setup](/info/brand-studio.html).

![Il pannello di esportazione con Penpot selezionato: il file .penpot e Send to Penpot accanto al download](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Per aprire il file, avvia Penpot, scegli un progetto e seleziona **Import**. Se accedi a Penpot dal pannello di esportazione, **Send to Penpot** importa il file per te.

### Word, OpenDocument e InDesign

**Lolly Doc Studio** esporta **Word** (DOCX) e **OpenDocument** (ODT) con paragrafi e titoli modificabili. Il file Word imposta i font del brand e il colore del testo attraverso gli stili del documento, segue la dimensione di pagina che scegli e aggiunge un PNG accanto a un logo SVG per le app che non possono disegnare SVG.

**Lolly Design** esporta **InDesign IDML (static subset)**: testo, rettangoli, ovali e immagini PNG o JPEG, una pagina doppia per artboard. La formattazione in linea supportata resta modificabile, le immagini viaggiano in `Links` e le coordinate diventano punti InDesign. Potrebbe essere necessario controllare il ripristino dei collegamenti, la sostituzione dei font e le variazioni negli a capo. Effetti, animazioni, brani di testo composti e geometrie non supportate interrompono l'esportazione con un report che li elenca. IDML non conserva il documento originale. Invia un PDF per la grafica finita.

### Timeline: dotLottie e Premiere

Dalla timeline di Lolly Design, **dotLottie** scrive un'animazione che resta modificabile negli strumenti Lottie; [Animazioni Lottie](/info/sequence-editor.html#lottie-animations) elenca ciò che mantiene. **Premiere XML + media** raccoglie in un pacchetto clip temporizzate e i loro contenuti multimediali originali per Premiere; vedi [Scambio XML con Premiere](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (pacchetti di corsi)

L'esportazione dei corsi è disattivata finché non attivi **Training and courses** in Settings → Preferences → Feature flags.

Poi scegli **Export course** da uno strumento supportato, una cartella di progetto o una selezione. In Lolly Design, scegliere **SCORM (LMS)** e **Download** apre lo stesso flusso di lavoro per i corsi. Lolly salva il lavoro, mostra il contenuto e l'ordine del corso per la revisione, poi apre il modulo e la sua finestra di esportazione.

- <!--i:layers--> Scegli una versione per ogni sorgente: pagine statiche, movimento come video, audio o una risorsa scaricabile. Aggiungi nel modulo il testo delle lezioni e le alternative da leggere.
- <!--i:clock--> Visualizza l'anteprima del lettore per i partecipanti e rivedi descrizioni e sottotitoli. Il movimento, comprese le animazioni senza audio, è incluso come video.
- <!--i:document--> Scegli Website, SCORM 1.2, SCORM 2004 4th Edition o una destinazione xAPI sperimentale. Controlla il contenuto e la dimensione dello ZIP, poi salva e scarica la versione verificata.
- <!--i:check--> Per completare il corso occorre confermare ogni lezione obbligatoria e scegliere Finish.

![Il pannello di esportazione su un deck Lolly Design con SCORM (LMS) selezionato](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Il pacchetto contiene il contenuto finito e non richiede un account Lolly. Metti uno ZIP Website su un host HTTP(S); importa uno ZIP LMS senza modificarlo. Prova la destinazione prima di condividere il corso. Per un corso costruito da più creazioni salvate, vedi [Creare un corso di formazione](/info/training-creators.html).

### Sottotitoli per la trasmissione televisiva

Lo strumento Captions può anche esportare **TTML** e **SCC**. Entrambi vengono scritti a partire dallo stesso elenco di segmenti dei file SRT e VTT, quindi parole e tempi corrispondono.

- **TTML** usa IMSC1.1 Text Profile, con tempi riferiti alla timeline del contenuto multimediale e un'unica regione in basso al centro. Non contiene colore, font o posizione per singolo sottotitolo, perché i sottotitoli di Lolly contengono solo un inizio, una fine e il testo.
- **SCC** contiene sottotitoli pop-on CEA-608 sul canale 1 a 29,97 fotogrammi al secondo con timecode drop-frame. Supporta i caratteri nordamericani di base oltre a quelli speciali ed estesi. Se un sottotitolo contiene un carattere non incluso nell'insieme, l'esportazione si interrompe e indica quale carattere. Ogni sottotitolo va a capo a 32 colonne e occupa al massimo 15 righe. Un sottotitolo che non può essere caricato prima del suo inizio viene ritardato di alcuni fotogrammi.
- I sottotitoli roll-up e paint-on non vengono scritti.

::: note SCC non è stato verificato in uno strumento per la trasmissione televisiva
Non è stato neppure provato su un decoder hardware. Prova un file nel tuo flusso di lavoro prima della consegna.
:::

### DXF (file di taglio)

Lolly Asset Export, Diagrams, Growth, Lolly Logo Wall, QR Code, Street Map, Wayfinding e Wordmark esportano **DXF**, il formato di interscambio AutoCAD R12 letto da taglierine laser, plotter per vinile e software CNC. La geometria viene scritta come tracciati di contorno in millimetri e il testo viene convertito in contorni. Il colore viene associato al valore AutoCAD Color Index più vicino, che di solito determina l'operazione della macchina da taglio. DXF contiene solo grafica al tratto: una regione fotografica o con filtri non ha un tracciato di taglio e viene esclusa con un avviso. Usa SVG o PDF per mantenere i contenuti raster. Il testo che nessun font copre, nemmeno un [font di riserva](/info/fallback-fonts.html), interrompe l'esportazione con un messaggio che riporta il testo.

Un design Street Map è composto solo da tratti, quindi ogni strada e canale diventa un tracciato di taglio.

::: showcase
![Un rendering Street Map di Parigi a inchiostro su fondo crema - pura grafica al tratto, quindi ogni tratto si conserva nel passaggio a una macchina da taglio](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Scorri e la camera si allontana attraverso la geometria: sette tracciati e nessun pixel. Una macchina da taglio legge lo stesso file.
:::

<!--i:eti-stamp-->
## Stampa

**Print PDF** scrive CMYK per una condizione di stampa denominata, **Coated FOGRA39** per impostazione predefinita. I campioni del brand con valori d'inchiostro misurati mantengono quei valori. Gli altri colori vengono convertiti attraverso un profilo di stampa: il profilo Coated FOGRA39 di Lolly per impostazione predefinita o il tuo profilo quando scegli la sua riga **Embed**. I grigi e il nero restano solo sulla lastra del nero, così il testo piccolo non può andare fuori registro. FOGRA51, SWOP e GRACoL usano una conversione standard del dispositivo. Il testo nero viene anche sovrastampato sul colore sottostante, così una macchina da stampa leggermente disallineata non lascia un bordo bianco attorno alle lettere. **Print TIFF** scrive pixel DeviceCMYK per un RIP. Il controllo Colour profile gestisce entrambi ([Profili colore](#colour-profiles)). Print TIFF ed **EPS (CMYK)** separano i colori attraverso lo stesso profilo di stampa del Print PDF.

**Print marks & bleed** ha una propria scheda nei formati di stampa: l'abbondanza in millimetri più Crop, Registration, Bleed, Colour bars e Stamp details. Stamp details stampa nel margine la data, lo strumento e il tuo nome. Un nome o nome di strumento con lettere che il font del margine non contiene, come arabo, cinese, cirillico o un'emoji, viene disegnato come immagine nello stesso grigio. La scheda di esportazione elenca quelle scritture.

Alcuni strumenti, come *Booklet*, creano un **PDF multipagina**: una copertina, contenuto che scorre su tutte le pagine necessarie e una pagina finale. Ogni pagina è una vera pagina PDF verticale in A4, US Letter o A5. Puoi forzare qualsiasi blocco su una nuova pagina. Sono documenti RGB senza segni di taglio o di abbondanza; quei segni appartengono al Print PDF a pagina singola. Un PDF di Lolly Design può anche essere un **Notes handout**: una pagina verticale per ogni slide con le note del relatore sotto.

**Prima di esportare.** Una scheda **Before you export** in fondo al pannello mostra ciò che vedrà una tipografia: formato, dimensione e abbondanza, aree di rifilo e abbondanza, copertura d'inchiostro, numero di lastre e pagine, con un giudizio accanto al titolo. La scheda non blocca mai un'esportazione. Lolly Design mostra sempre la scheda con i propri controlli, comprese le regole del brand del design system livello per livello e l'indicatore di scrittura per il testo del documento ([Prima di esportare](/info/design.html#before-you-export)). Lolly Design aggiunge questi controlli di stampa quando **Print preflight** è attivo. Negli altri strumenti, attiva **Print preflight** in Settings → Preferences → Feature flags. È disattivato per impostazione predefinita e un'installazione di Lolly Work può attivarlo per i suoi membri.

**Dopo l'esportazione.** Lolly rilegge il file finito e lo confronta con ciò che hai scelto: formato, dimensione in pixel o della pagina, durata della clip, sfondo trasparente, colore CMYK, HDR, Content Credentials e password PDF o ZIP. Ogni differenza viene scritta sulla scheda di esportazione. Ogni misura proviene dal file, mai dall'impostazione. Una proprietà a cui il file non può dare risposta non viene contata come corrispondenza. La riga di comando scrive il confronto completo con `--export-report` (vedi [Renderizzare con la CLI](/info/cli-rendering.html)).

::: details Controlli di accessibilità PDF dalla riga di comando
**Controlli di accessibilità PDF.** Per un PDF, la riga di comando elenca anche 32 controlli di accessibilità nel file `--export-report`, sotto `pdfAccessibility`. Ogni controllo ha un id, una descrizione semplice, un esito e il punto del file in cui ha trovato un problema:

- **Passed**: il controllo ha esaminato qualcosa e non ha trovato problemi.
- **Failed**: il controllo ha trovato un problema. Sono elencati i numeri di pagina o i tag interessati.
- **Not applicable**: il file non conteneva nulla di quel tipo da esaminare, come i controlli sulle tabelle in un file senza tabelle. Questo non dice nulla sul file.
- **Needs a person**: sei controlli non possono essere valutati da un programma (ordine di lettura, contrasto dei colori, lampeggiamenti, script, limiti di tempo e link ripetuti).

L'elenco non è un verdetto. Non dice che un PDF soddisfi PDF/UA o che le persone che usano tecnologie assistive possano usarlo. Una persona deve comunque controllare il file con un lettore di schermo. Oggi i PDF di Lolly non superano i controlli sui tag, perché gli esportatori non scrivono ancora tag. Il controllo legge il file sul tuo dispositivo e non modifica nulla. I file che richiedono una password sono indicati come non verificati, non come controlli superati. Per controllare un PDF che hai ricevuto, trascinalo in [Lolly Strip Hidden Data](/info/utilities.html), che mostra lo stesso elenco in **PDF accessibility checks**.
:::

I controlli dell'Inspector di Lolly Design e il confronto del brand in Lolly Design System Setup esaminano il design. Queste due schede esaminano il file.

::: details Costo da un listino prezzi
Sotto la verifica preliminare, una scheda dei costi converte gli stessi conteggi in importi, anche quando la scheda della verifica preliminare è disattivata. Servono due cose: un lavoro a cui un listino possa assegnare un prezzo (lastre, fogli, area, pagine, righe di varianti o file di output, quindi un semplice logo PNG non mostra mai la scheda) e un **listino prezzi**, un elenco di prezzi JSON del tuo stampatore. Una build predefinita non contiene listini prezzi e non offre un modo per caricarne uno nell'app. Un listino prezzi arriva come risorsa del catalogo inclusa in un'installazione o attraverso l'estensione facoltativa per i listini prezzi attivata da chi gestisce un'istanza propria o da un piano di controllo. Senza listino prezzi non viene mostrato nulla.

Ogni importo è una tariffa che hai fornito moltiplicata per una quantità contata da Lolly, come `4 plate × €35.00`. Il totale mostra la sua fonte: l'emittente del listino e la data delle tariffe. Non ci sono una valuta predefinita né prezzi segnaposto. Ciò che il file dice di sé resta una dichiarazione riportata: *"Il file dice: … Lolly non lo ha verificato."*

Quando non si può calcolare un importo, la tabella viene rimossa anziché compilata:

- Le voci a cui il listino non assegna un prezzo comportano **l'assenza di qualsiasi totale**, con solo un titolo che indica quante sono senza prezzo.
- Una quantità che rappresenta un limite massimo riporta **"fino a"** nel suo subtotale.
- Le tariffe oltre la data di validità mostrano **solo i conteggi** finché non premi *Use these rates anyway*; la data di scadenza resta poi accanto all'importo.
- Se apri tramite un **link**, gli importi restano nascosti finché non ne richiedi la visualizzazione su questo dispositivo. La CLI accetta `--rate-card=<file.json>` come file locale e mai come parametro di un link.

Il listino viene rimosso da ogni fase dell'esportazione e non modifica mai il file. È un calcolo, non un preventivo. Solo il tuo stampatore può fare un preventivo.
:::

<!--i:eti-film-->
## Movimento e suono

### Video

Gli strumenti animati esportano **MP4** e **WebM**. Un link condiviso `?format=` che richiede un contenitore che questo browser non può creare ripiega sull'altro, con un nome file corrispondente. **Start after** mantiene ferma la tela perché animazioni e font si stabilizzino prima della registrazione. **Duration** imposta la durata della clip finita. **Motion blur** (Off, Draft quality, Standard o High, con uno **Shutter angle**) sfoca i movimenti rapidi e rallenta il rendering. Dove il browser lo supporta, **Record live** registra in tempo reale l'anteprima sullo schermo attraverso una condivisione dello schermo.

![Le impostazioni dei tempi per un'esportazione animata: Start after, Duration, Motion blur con il suo Shutter angle e Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** permette di scegliere Smaller file, Balanced o Best quality. **Advanced** apre **Codec**, **Frame rate**, **Rate mode** e **Hardware acceleration**. Dove uno strumento ha sottotitoli, **Captions** permette di scegliere una **Embedded track** o un **Sidecar .vtt + .srt** accanto al video. Un link contiene qualità, codec, frequenza dei fotogrammi, durata e ritardo iniziale come `vq`, `codec`, `fps`, `seconds` e `wait` ([Parametri URL](/info/url-parameters.html)).

Le esportazioni video mantengono il loro audio. Uno strumento può aggiungere un **sottofondo musicale** alla clip: una risorsa audio ripetuta in loop o tagliata alla durata della clip, con dissolvenze, volume e attenuazione sotto l'audio originale del filmato. Gli strumenti di registrazione trasferiscono il loro audio live nel file.

Un deck Lolly Design che avanza al clic può anche essere esportato come video. **Export slides as video** nel menu Present apre il pannello di esportazione su MP4. Ogni slide viene riprodotta per il proprio tempo di permanenza o per il valore Duration del pannello di esportazione quando non ne ha uno. La transizione del deck viene riprodotta tra le slide come una dissolvenza. Il documento non cambia.

**HTML** esportato da un documento Lolly Design temporizzato o da Snippet è un lettore in un unico file: controlli di riproduzione, spostamento e audio sopra l'animazione, con i font supportati, le immagini e l'audio incorporati. Il file si riproduce offline. Un filmato Lolly Design con scene aggiunge un menu delle scene. Una sequenza che contiene una clip video, Lottie o 3D non può ancora essere esportata come HTML; esporta la sequenza come video.

### Immagini animate

**GIF** si riproduce ovunque ed è adatto a chat ed email; è più grande e ha meno colori del video. **APNG** e **Animated WebP** mantengono colori pieni e trasparenza. **Lottie Ad** esporta anche **Animated SVG**: fotogrammi vettoriali con fotogrammi chiave CSS incorporati che scalano a qualsiasi dimensione e si ripetono in una scheda del browser o in un `<img>` senza codec. Il testo viene convertito in contorni. Usa una frequenza dei fotogrammi predefinita più bassa perché ogni fotogramma è più pesante di una bitmap. Tutti questi formati sono privi di audio.

### Audio

Alcuni strumenti esportano solo l'audio. **Lolly Voice Recorder** acquisisce una registrazione dal microfono con un misuratore di livello live e la salva come **MP3**, **WAV**, **M4A (AAC)** o **Opus (WebM)**, codificati sul tuo dispositivo. `wav`, `mp3`, `m4a` e `opus` sono normali id di formato, quindi un'esportazione audio si può condividere e gestire tramite script come un PNG.

Il selettore di risorse accetta molti formati audio per un sottofondo musicale, da MP3 e FLAC a MIDI e moduli tracker; [Formati](/info/formats.html) li elenca. Un [brano Lolly Rondocode](/info/rondocode.html) viene riprodotto per la durata richiesta dalla sua clip.

<!--i:eti-palette-->
## Colore e HDR

Lolly legge tutti i colori CSS moderni, esegue i calcoli cromatici su base percettiva e scrive ogni file in uno spazio che un lettore può aprire: sRGB per gli schermi, CMYK per la stampa e Rec.2100 PQ per HDR ([Il colore nel motore](/info/colour-engine.html)). Un documento Lolly Design impostato su **Wide colour / HDR** segue le proprie regole: vedi [Modifica con gamma cromatica estesa e HDR](/info/hdr-editing.html).

### Profili colore

Le esportazioni sono contrassegnate con un profilo colore, così le app con gestione del colore, come quelle delle tipografie, Photoshop e i browser, leggono i colori come li hai visti tu. Miniature e anteprime omettono il contrassegno per restare leggere.

- **PNG e JPG** contengono un profilo ICC **sRGB** incorporato, lo spazio in cui viene disegnata l'anteprima. I pixel vengono contrassegnati, non ricodificati.
- **Print PDF (CMYK)** dichiara la condizione di stampa nel suo *OutputIntent*, indicando alla tipografia come interpretare gli inchiostri CMYK.
- **Print TIFF (CMYK)** scrive pixel DeviceCMYK senza contrassegno e registra la condizione di stampa nei metadati TIFF. Un TIFF non può incorporare un profilo di stampa, quindi una riga **Embed** registra solo il nome del profilo.
- **TIFF (RGB)** è la versione sRGB non compressa per l'archiviazione o per uno scambio con un editor. Entrambi i TIFF sono disponibili solo su desktop, perché i browser non possono mostrare l'anteprima di un TIFF.
- **SVG**, **EMF**, **EPS** e **DXF** sono vettori senza profilo incorporato: i colori di SVG sono sRGB, EMF ed EPS usano RGB del dispositivo, **EPS (CMYK)** scrive DeviceCMYK e DXF usa AutoCAD Color Index. SVG, EPS e DXF convertono il testo in tracciati di contorno. EMF mantiene il testo live e modificabile in Office e Google Slides e converte in contorni solo i segmenti che il formato non può esprimere. L'opzione **Outline fonts** del pannello di esportazione impone tracciati ovunque, come `_text=outline` in un link e `--text=outline` sulla riga di comando. SVG riproduce anche le ombre CSS dei box, interne ed esterne.

::: details PDF/X-4 e il tuo profilo di stampa
Lolly include un profilo CMYK, adattato ai dati di caratterizzazione FOGRA39 di Fogra e rilasciato sotto CC0, e lo usa per convertire i colori per la condizione di stampa predefinita. Il profilo non viene incorporato, perché è in versione ICC 4.3 e PDF/X-4 accetta versioni fino alla 4.2. Una condizione di stampa denominata scrive quindi l'intento di output senza dichiarare la conformità a PDF/X-4.

Carica un tuo profilo CMYK e scegli la sua riga **Embed** nel controllo Colour profile. Viene incorporato come *DestOutputProfile* del file e il PDF dichiara PDF/X-4 ogni volta che il resto del file lo consente. La condizione di stampa dichiarata viene letta da quel profilo: un nome registrato quando il profilo ne attesta uno o `Custom` sotto il nome del profilo stesso.

Tre elementi impediscono la dichiarazione pur mantenendo l'intento di output: la grafica RGB che il passaggio CMYK non ha potuto convertire, il testo dei crediti `prov` nel margine di prova (disegnato con un font standard non incorporato) e una password **Strong**, perché PDF/X-4 vieta la crittografia. Ogni PDF contiene anche metadati PDF/X-4: riquadri di pagina, XMP, un ID del documento e un intento di output sRGB con il suo profilo.
:::

### Tinte piatte in quadricromia

Un design system può assegnare a un colore una tinta piatta, come un colore Pantone o HLC. Il **Print PDF** stampa poi quel colore su una lastra dedicata. Lolly Demo assegna una tinta piatta a ogni colore tranne i suoi bianchi, Sugar e Daylight, e il suo nero, Void. Un Print PDF creato in Lolly Demo stampa la maggior parte dei colori su lastre per tinte piatte e il nero sulla lastra del nero.

Per un normale file in quadricromia, seleziona **Print spot inks as process** nella scheda Profile del pannello di esportazione. Ogni tinta piatta viene così stampata con ciano, magenta, giallo e nero, usando la composizione CMYK che il design system assegna a quel colore. Un colore senza una propria composizione usa la conversione del profilo di stampa, come ogni altro colore della grafica. Il file contiene così solo le quattro lastre di quadricromia. La scelta è disattivata per impostazione predefinita. Il pannello mostra la casella solo per **Print PDF** e solo quando il design system assegna a un colore una tinta piatta.

Una finitura non è un inchiostro. Lamina, rilievo, incavo, vernice selettiva, soft touch, fustellatura, cordonatura e perforazione mantengono le proprie lastre con nome quando la casella è selezionata, perché una finitura stampata in quadricromia metterebbe sulla pagina la sua maschera nera.

La scheda **Before you export** e `lolly preflight` contano le lastre che il file conterrà. Con la casella selezionata, contano le quattro lastre di quadricromia e le eventuali lastre di finitura e indicano che le tinte piatte vengono stampate in quadricromia senza aggiungere lastre. Con la casella deselezionata, contano fino a una lastra per ciascuna tinta piatta fornita dal design system. Un listino calcola il prezzo in base a questi conteggi, quindi non addebita mai una lastra per tinte piatte che il file non conterrà.

**Print TIFF** ed **EPS (CMYK)** non hanno lastre con nome, quindi stampano ogni inchiostro in quadricromia, con o senza la scelta. Per questi due formati la scheda e `lolly preflight` contano le quattro lastre di quadricromia e mai una lastra per tinte piatte o finiture. Una finitura vi entra come maschera nera sulla lastra del nero e la scheda lo segnala come errore.

Un link richiede lo stesso file con `_spots=process`, la riga di comando con `--spots=process`, il [server MCP](/info/mcp.html) con `spots: "process"` e l'app da terminale con la riga **Spot inks**. Nel file non viene registrato nulla sulla scelta: cambiano solo gli inchiostri.

### HDR (colori luminosi)

La scheda **HDR** del pannello di esportazione rende più luminosa la grafica normale per gli schermi HDR. Per preservare gli originali HDR durante la modifica, vedi [Modificare con un'ampia gamma cromatica e HDR](/info/hdr-editing.html).

Un'esportazione normale è in sRGB: un colore saturo del brand è luminoso quanto il bianco normale dello schermo. Uno schermo HDR può essere più luminoso. La scheda **HDR** aumenta la luminosità dei colori del tuo brand e del testo bianco verso il picco massimo. Le aree scure restano scure.

![La scheda HDR nel pannello di esportazione, attivata, con i controlli White / Reach / Dark lift / Focus visibili sotto](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formati.** PNG, JPG, AVIF e TIFF. WebP è a 8 bit e non ha un percorso di decodifica HDR funzionante, mentre vettori e PDF non hanno un modello HDR.
- **Disattivato per impostazione predefinita**, perché cambia i pixel. Seleziona la scheda o passa `hdr=1` in un link di condivisione.
- **I controlli.** **White** (il limite del picco di luminosità, da 400 a 2000 nit), **Reach** (fin dove si estende la luminosità nei toni più scuri), **Dark lift** (quanto si schiariscono i toni scuri; `0` li mantiene scuri) e **Focus** (quanta ricchezza cromatica conserva l'aumento). Viaggiano come un unico valore: `hdr=1600-60-0-50` corrisponde a White 1600, Reach 60, Dark lift 0 e Focus 50.
- **Cosa viene scritto.** PNG riceve Rec.2100 PQ a 16 bit con un chunk `cICP`. JPG è un JPEG con mappa di guadagno ISO 21496-1: un'immagine SDR normale con una mappa di guadagno aggiunta. AVIF riceve un box `colr` riscritto. TIFF riceve pixel PQ con un profilo ICC v4 generato che contiene un tag `cicp`. TIFF appiattisce sul nero, perché il bianco è il codice da 10.000 nit in PQ e creerebbe un alone attorno a ogni bordo. L'aumento segue la luminosità percettiva (OKLab) e mantiene la tonalità, quindi un verde del brand diventa più luminoso senza virare al verde menta.
- **Dove si vede la luminosità.** Nei visualizzatori con gestione del colore su uno schermo HDR: Preview, Quick Look e Safari sui dispositivi Apple, oppure Chrome su un monitor HDR. Uno schermo SDR mostra un'immagine normale.
- **Dal terminale.** `--hdr=1` con `--export=png` o `--export=jpg` scrive lo stesso PNG e JPEG con mappa di guadagno nella [CLI](/info/cli.html) usando gli stessi encoder del motore, senza browser. AVIF e TIFF per ora sono esportazioni solo web.

::: warning Molte piattaforme rimuovono il segnale HDR
Una piattaforma che ricodifica i file caricati può rendere l'immagine scura o sbiadita. Usa HDR dove controlli la destinazione, come il tuo sito, un videowall o un deck su uno schermo luminoso.
:::

<!--i:eti-badge-check-->
## Cosa viaggia con il tuo file

Un file finito può contenere diversi record. Alcuni sono accanto ai pixel e scompaiono quando il file viene salvato di nuovo, catturato in uno screenshot o privato dei metadati. Due marchi risiedono nei pixel.

::: figure exporting-what-travels
Dove risiede ogni record, se è attivato per impostazione predefinita e quale parametro del link lo controlla.
:::

Il pannello di esportazione riunisce **Licence**, **Source credits**, **Password**, **C2PA Credentials**, **Lolly Imprint** e **Durable credential** in un unico gruppo **Content protection** che mostra solo le schede utilizzabili dal formato scelto. Il gruppo si apre da solo quando un link o un documento dichiara già una licenza o quando una fonte richiede una tua decisione. La scheda **Design system** resta fuori dal gruppo, visibile a ogni esportazione.

![Il gruppo Content protection aperto su un'esportazione PNG, con solo le schede applicabili](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Provenienza & filigrana

Quando il formato dispone dei campi, le esportazioni contengono **metadati di provenienza**: il software, la fonte, il nome dello strumento e la riga di attribuzione del tuo profilo, scritti in PNG iTXt, JPEG EXIF, nelle informazioni PDF, in SVG `<metadata>` o in un commento GIF. Registrano solo la paternità dell'opera. Non viene caricato nulla. Gli strumenti **Experimental** applicano anche una filigrana visibile. È l'host ad applicarla, quindi modificare lo strumento non può rimuovere il marchio.

**Lolly Imprint** è una filigrana invisibile nei pixel, **attivata per impostazione predefinita**. Resiste alla ricompressione, quindi una copia può ancora essere riconosciuta come creata con Lolly. È un indizio, non una garanzia crittografica, e non contiene dati personali. Viene scritta in JPEG XL, PNG, JPG, WebP, AVIF, TIFF e BMP e nei raster che Lolly renderizza in un PDF o PPTX, mai in un'immagine che hai incorporato. Deseleziona **Lolly Imprint** o passa `imprint=0` per escludere l'Imprint. La resistenza di AVIF alla ricodifica non è ancora calibrata. [Lolly Verify](/#/verify) rileva l'Imprint sul tuo dispositivo; vedi [Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**Durable credential** scrive l'id di Lolly nei pixel con un modello neurale sul dispositivo nel formato TrustMark, così il legame "creato con Lolly" resiste alla rimozione dei metadati e alla ricodifica e può essere letto dagli strumenti compatibili con TrustMark. È **disattivata per impostazione predefinita**, perché richiede un passaggio neurale per ogni esportazione e un download del modello una tantum. Copre PNG, JPG, WebP, AVIF e TIFF. Selezionala nel pannello o passa `durable=1`. Le app desktop e mobile nascondono la scheda, perché offline non hanno un'origine da cui recuperare il modello.

**Licence.** Scegli come gli altri possono usare il tuo lavoro: *None (all rights reserved)* per impostazione predefinita, CC0 1.0, Public Domain Mark 1.0 o una licenza Creative Commons 4.0 (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). Il nome della licenza e un link al suo riepilogo entrano nei metadati di licenza del file (EXIF, XMP e RIFF dove il formato li prevede) e nella sua Content Credential. La scelta viene salvata con il documento e viaggia in un link come `licence=`. Lolly scrive la licenza che hai scelto. Lolly non verifica né fa rispettare le condizioni. Uno strumento con un proprio campo di licenza, come Claim, mantiene invece quel campo.

### Il record del design system

Un'esportazione registra il design system che ha creato il file: il suo nome, la versione pubblicata da cui è stato disegnato (quando non è la versione di lavoro) e la [colourway](/info/colourways.html) in cui è stato disegnato. Qualsiasi altra scelta di tema dichiarata da un design system, come una densità, viene registrata allo stesso modo. La scelta tra chiaro e scuro viene esclusa, perché l'immagine mostra già quale è stata usata.

**Vedi il record prima che venga scritto qualsiasi dato.** La scheda **Design system**, selezionata per impostazione predefinita, mostra le parole esatte che il file conterrà, come *Records: Acme · Colourway: Beach*, e la descrizione. Il nome di un design system è quello digitato dai suoi proprietari e la scheda lo mostra così com'è. Deseleziona la scheda per escludere il record da quell'esportazione. Il pannello del documento di Lolly Design elenca le stesse parole sotto *Embedded in exports*.

**La descrizione indica la colourway accanto allo strumento.** Con la scheda selezionata, *"Made with https://lolly.tools : Chart"* diventa *"Made with https://lolly.tools : Chart (Beach colourway)"*. Il nome del design system resta nel record, non nella descrizione. Una descrizione senza nome dello strumento, o scritta da uno strumento a partire dai propri input, resta invariata. Uno strumento che ignora le colourway tramite `tokenAxes` non ne registra nessuna e l'attribuzione della prova PDF (il segno di stampa `prov`) segue la stessa regola.

::: details Skill del brand, pagine del brand e aziende partner nel record
**Skill del brand che hanno guidato un agente.** Quando un agente ha creato il pezzo e indicato le [skill del brand](/info/brand-skills.html) che ha letto e seguito, il record elenca anche ogni skill con la sua revisione, come *Guided by: acme-brand 1.0*. Queste parole significano che la skill ha guidato il lavoro. Lolly non verifica il pezzo rispetto a una skill. Solo la dichiarazione dell'agente aggiunge l'elenco. Oggi è l'argomento `brandSkills` di `lolly_render` del [server MCP](/info/mcp.html), quindi un pezzo creato nell'app o da un link di condivisione non ne contiene. La Content Credential contiene l'elenco come `brandSkills`, un unico valore JSON con id, nome, revisione e hash SHA-256 di ogni skill. Il pacchetto XMP e i metadati SVG contengono lo stesso valore come `lolly:BrandSkills`. Un PDF scritto dal record riceve una parola chiave per skill. La descrizione resta invariata. Il testo di una skill interna non viene mai registrato. Gli stessi interruttori escludono l'elenco insieme al resto del record: la scheda **Design system**, `_madewith=0`, `--no-madewith` e `madeWith: false`. Quando il server MCP disegna il file in un browser (un PDF, un JPEG e gli altri formati che il suo percorso senza browser non può scrivere), i metadati del file non contengono alcun elenco. In quel caso solo una Content Credential può contenerlo. Passa `c2pa` per conservare il record. Senza una credenziale, il rendering avverte che le skill del brand non sono state registrate.

**La pagina del brand, quando chi la pubblica lo sceglie.** Chi pubblica un design system può scegliere di registrare l'indirizzo della sua [pagina del brand](/info/brand-page.html#lead-back-from-your-files) nelle esportazioni. L'impostazione vale per ogni design system ed è disattivata per impostazione predefinita. La scheda aggiunge allora l'indirizzo sulla stessa riga, come *Records: Acme · Colourway: Beach · Brand page: https://acme.example/brand/acme/*. Deselezionare la scheda rimuove l'indirizzo insieme al resto. Il record contiene l'indirizzo e nient'altro sulla pagina. Nel file non cambia altro. Un design system senza indirizzo scrive lo stesso file di prima.

**L'indirizzo non viaggia con un pacchetto.** Un record in un file firmato viene letto come una dichiarazione del firmatario. Un indirizzo non deve attivarsi da solo per chi non lo ha scelto e un pacchetto non deve poter indirizzare i file altrui verso una pagina di sua scelta. Un pacchetto `.lolly`, una copia o un fork di un design system, **Try these colours**, un backup ripristinato e un file di token fornito per una singola esecuzione arrivano tutti con l'impostazione disattivata. Puoi attivarla tu, con un indirizzo che digiti. Un design system gestito è l'unica eccezione: conserva l'indirizzo impostato dal suo gestore nei token sorgente. [Rimanda alla tua pagina dai tuoi file](/info/brand-page.html#lead-back-from-your-files) contiene i dettagli.

**L'azienda partner, in un programma partner di Lolly Work.** Un pezzo creato per un'azienda partner registra l'azienda e il suo programma sulla stessa riga, come *Records: Acme · Colourway: Beach · Partner: Northwind IT (Resellers, EMEA)*, con la revisione dei dati dell'azienda nel file. Il record non contiene persone, recapiti, indirizzi o valute. Con il kit partner dell'azienda allegato, la riga aggiunge la revisione del kit, come *, kit revision 2*, e la credenziale contiene l'id e la revisione del kit, mai i suoi colori o le sue regole. Deselezionare la scheda rimuove il partner insieme al resto del record. Un PDF riceve la parola chiave *Partner: Northwind IT* e [Lolly Verify](/info/what-verify-checks.html#partner) mostra il record come **Partner** ([Il record del partner nei file](/info/manage/partner-programmes.html#the-partner-record-in-files)).
:::

**Rileggere il record.** [Lolly Verify](/#/verify) elenca il record come **Design system** nei dettagli della credenziale di un file e le eventuali skill del brand come **Guided by**. Una pagina del brand compare separatamente, come [indirizzo registrato dal firmatario](/info/what-verify-checks.html#brand-page). *Recreate with these settings* riapre lo strumento nella versione e nella colourway registrate. Il link si apre con il design system registrato quando questo dispositivo ne contiene uno con lo stesso id e nome; altrimenti si apre con il tuo design system attivo.

::: details Cosa viene scritto e dove, e quali esecuzioni escludono il record
| Dove | Cosa viene scritto |
|---|---|
| Content Credential | `designSystem` (l'id), `designSystemLabel`, `designVersion` e `themes` nell'asserzione `tools.lolly.export`, ciascuno come valore di testo semplice; `themes` è un elenco JSON delle scelte. `brandPage` quando chi pubblica lo ha scelto |
| PNG, JPEG, WebP e JXL | Gli stessi valori come proprietà `lolly:` del pacchetto XMP del file, nel namespace `https://lolly.tools/ns/export/1.0/`. `lolly:BrandPage` quando chi pubblica lo ha scelto |
| SVG | Le stesse proprietà `lolly:` all'interno del blocco `<metadata>` |
| PDF | Parole chiave come *Design system: Acme*, *Colourway: Beach* e, quando chi pubblica lo ha scelto, *Brand page: https://acme.example/brand/acme/* |
| Ogni formato con un campo descrizione | La descrizione, con la colourway accanto allo strumento |

La scheda compare solo quando c'è qualcosa da registrare e il formato può contenere il record. CSV, JSON, un file di calendario e altri formati di testo o dati non contengono metadati, mentre EPS, EMF, DXF e BMP non hanno un campo per il record. HTML, Markdown e CSS contengono il record solo nella loro Content Credential, quindi per questi formati la scheda non mostra la riga della descrizione e si nasconde quando **C2PA Credentials** è disattivato. Un campo non fornito dal design system resta fuori dal file.

Un link di condivisione disattiva il record con `_madewith=0` ([Parametri URL](/info/url-parameters.html)). La riga di comando accetta `--no-madewith`, `lolly_render` del [server MCP](/info/mcp.html) accetta `madeWith: false` e il pannello di esportazione dell'app da terminale ha una riga **Design system**. La riga di comando stampa sullo standard error le parole contenute nel file finito, per il rendering di uno strumento e per ogni file che `lolly run` esporta da una sessione di Lolly Design salvata. Un rendering MCP stampa le parole accanto al file. Entrambi rileggono le parole dal file. Un PNG disegnato dalla riga di comando senza browser non contiene metadati del file, quindi il suo record viaggia solo nella credenziale. Le utility sul dispositivo non aggiungono metadati.

Le esecuzioni senza scheda **Design system** escludono il record: un'esecuzione di Lolly Batch, una cartella esportata da Projects e un'esportazione di una collezione 3D e, nell'app da terminale, un batch CSV, un'esportazione di una cartella o selezione di Projects e la vista che renderizza tutto. Esporta un file dallo strumento per registrare il design system.
:::

### Content Credentials (C2PA)

Le esportazioni possono contenere **Content Credentials**: un manifesto [C2PA](https://c2pa.org) firmato che registra cosa ha creato il file, quando e dove, legato a un hash dei byte del file in modo da rendere rilevabile qualsiasi modifica successiva. Lolly scrive manifesti standard che qualsiasi lettore C2PA può esaminare.

![La scheda C2PA Credentials, selezionata, con la durata della credenziale accanto alla casella](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Attivate per impostazione predefinita.** La scheda **C2PA Credentials** è selezionata per quasi tutti gli strumenti. Deselezionala per un'esportazione o passa `c2pa=off` in un link. Il file non avrà così alcuna credenziale e un SVG che incorpora grafica con credenziali, come un logo del catalogo, perderà anche la credenziale di quella grafica. Lolly Imprint e gli altri metadati del file restano. Uno strumento può disattivarle nel proprio manifesto.
- **Formati.** PDF (RGB e Print), PNG e APNG, JPG, GIF, SVG e SVGZ, TIFF (RGB e Print), WebP (statico e animato), AVIF, MP4, WebM, HTML, Markdown, CSS e i contenitori audio MP3, WAV, M4A, OGG/Opus e FLAC. Uno ZIP applica la credenziale a ogni file supportato al suo interno: è così che un Animated SVG riceve una credenziale. MP4, AVIF e M4A usano l'associazione BMFF standard e MP3 la sua mappatura ID3v2, quindi `c2patool` e altri lettori li verificano. WebM e OGG/Opus non hanno ancora una mappatura standard, quindi Lolly inserisce il manifesto come allegato Matroska e campo OpusTags, verificati dal verificatore di Lolly. Un SVGZ è un SVG compresso. La specifica C2PA non definisce una forma compressa, quindi la credenziale viene scritta nell'SVG prima della compressione. Il verificatore di Lolly legge il file così com'è; `c2patool` legge la stessa credenziale una volta decompresso il file (`gunzip`). ICO, EPS, EMF, DXF, BMP, PPTX, i formati Office e gli altri formati di testo e dati non hanno un contenitore C2PA.
- **Cosa registrano.** Lo strumento e l'app che hanno creato il file, l'ora della firma e la shell che ha esportato il file. Per una pagina di Lolly Design esportata come immagine, SVG o PDF, il renderer che ha disegnato la pagina (`route` nell'asserzione `tools.lolly.export`: `gpu` per il renderer GPU della pagina, `operations` per le operazioni di disegno scritte come vettori, `compatibility` per il renderer del browser) e la versione di quel renderer (`renderer`: la ricetta GPU, `design-draw-v` e la sua versione, oppure `dom-to-image` e `dom-walker`). Il [design system e la colourway](#the-design-system-record) quando la scheda **Design system** è selezionata. Le impostazioni attive: scelte dei menu, numeri, interruttori e colori così come sono, e qualsiasi testo digitato (titoli, nomi, note, link e date) solo come impronta, quindi le parole non sono nel file. I campi legati al profilo, i controlli inattivi, le versioni del browser e i dettagli del sistema operativo vengono esclusi. Il tuo nome e la tua email compaiono come autore solo quando **Use my details to create** è attivo in Settings → Preferences → Your details. Le fonti inserite da un'esportazione viaggiano come ingredienti. Ogni immagine sulla pagina che contiene una propria Content Credential viene registrata come componente della pagina, con quella credenziale e qualsiasi tipo di fonte AI che dichiara. Questo vale per PNG, JPEG, WebP, AVIF, TIFF, SVG o PDF e per GIF, APNG, WebP animato, MP4 o WebM quando l'immagine è disegnata in almeno un fotogramma dell'intervallo esportato. La singola immagine modificata da uno strumento come Darkroom, Filter o Asset Export viene invece registrata come origine del file, aperta per prima e seguita da ciò che lo strumento ha fatto all'immagine. Altri ingredienti sono le [opere attribuite](#source-credits) come le emoji, i [brani di Lolly Rondocode](/info/rondocode.html#songs-in-the-credential) in un'esportazione video o audio e le [melodie salvate](/info/generated-music.html#what-a-track-records) in un'esportazione video o audio. Ogni melodia salvata ha il suo nome, la licenza quando la melodia ne registra una, lo SHA-256 della sua ricetta, la versione del motore e l'indicazione di media algoritmico. L'autore di una melodia salvata (il nome del profilo con cui è stata salvata) viene aggiunto solo quando **Use my details to create** è attivo, come il tuo nome. Solo allora il pannello di esportazione mostra l'autore prima dell'esportazione.
- **Un'approvazione, quando ne è stata registrata una.** Un file approvato tramite [Lolly Work](/info/work-approvals.html#review-an-exported-file) può contenere un secondo record firmato sopra questa credenziale: l'id dell'approvazione, la data della decisione e il digest del file esaminato. Non contiene nomi, email, gruppi, commenti o nomi di catene. È selezionato per impostazione predefinita nella finestra di richiesta e può essere deselezionato per una richiesta o disattivato per un'istanza. Registra che un firmatario ha dichiarato una decisione. Non afferma che il lavoro soddisfi uno standard.
- **Cosa gli è stato chiesto di fare, per un file creato da un [intento](/info/visual-intent.html#what-goes-in-the-file).** Lo scopo, la superficie, lo strumento, la lingua, le versioni delle regole e del vocabolario e il digest dell'intento. Occasione, pubblico, regione e prompt sono solo impronte, a meno che la persona o l'agente che esegue quel rendering chieda di registrare le parole del prompt. Solo un rendering avviato da un intento contiene questo record. L'esecuzione indica cosa ha registrato e il record può essere escluso.
- **Cosa vedono i destinatari.** Gli strumenti C2PA come le app Adobe, `c2patool` e contentcredentials.org/verify leggono il manifesto e mostrano la dichiarazione. Lolly firma con una chiave creata sul tuo dispositivo, non con un certificato di un elenco di fiducia, quindi i visualizzatori segnalano una credenziale *non verificata*. La struttura e le prove di manomissione sono valide, ma nessuno garantisce l'identità del firmatario. Per cambiarlo, registra un'**identità verificata** in Settings → Preferences → Content Credentials; vedi [Identità per Content Credentials](/info/content-credentials-identity.html).
- **Controllare un file.** Trascina qualsiasi file su [Lolly Verify](/#/verify) o esegui `lolly validate <file>` per un rapporto sul dispositivo che indica prima di tutto se il file è stato creato da Lolly e se è cambiato da allora. Lolly Verify controlla anche oltre la credenziale; vedi [Cosa controlla Lolly Verify](/info/what-verify-checks.html).
- **Privacy.** La chiave di firma viene creata per l'esportazione e non lascia mai il tuo dispositivo. La dichiarazione contiene solo ciò che i metadati di provenienza già includono. Le utility per la privacy che trasformano i tuoi file non aggiungono credenziali e *Lolly Strip Hidden Data* rimuove un manifesto C2PA come qualsiasi altro metadato. L'utility Rondocode crea nuovo audio, quindi firma ciò che scrive ([Brani di Lolly Rondocode](/info/rondocode.html#files-from-the-rondocode-utility)). Il generatore musicale firma ogni download WAV o M4A. La credenziale registra che il generatore musicale di Lolly ha creato la traccia e la licenza della musica, CC BY 4.0, con la relativa attribuzione ([Cosa registra una traccia](/info/generated-music.html#what-a-track-records)).
- **Interazioni.** Un PDF protetto da password non può contenere Content Credentials, a nessuno dei due livelli. La credenziale viene aggiunta per ultima, sui byte finiti, dopo DPI, EXIF, profilo colore, metadati PDF/X e segni di stampa.

### Attribuzioni delle fonti

Un'esportazione che inserisce il lavoro di qualcun altro registra quella fonte nella credenziale. Il caso comune è un'emoji del set scelto: l'opera, il suo autore, la licenza, l'origine dei byte esatti e ciò che è cambiato viaggiano tutti con il file. Il testo in uno strumento il cui template è un SVG mantiene le emoji del sistema, quindi in quel caso non viene attribuito nulla. Prima del download, la riga **Source credits** indica cosa richiedono le fonti per la consegna. Dopo il download, la riga rilegge i byte consegnati prima di dichiarare che le attribuzioni sono nel file. Una licenza che ti chiede di scegliere, come per un glifo CC BY-SA ricolorato che stai per condividere, riceve una scheda con le opzioni. Il download non viene mai bloccato. [Diritti creativi e attribuzioni](/info/creative-rights.html) contiene le formulazioni, le licenze esaminate e ciò che resta tuo.

<!--i:eti-lock-->
## Protezione con password

Lolly crea due tipi di blocco, entrambi sul tuo dispositivo. La scheda **Password** del pannello di esportazione imposta entrambi.

![La scheda Password espansa su un'esportazione PDF, con il campo password e i due livelli di blocco](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**Una password di apertura del PDF** ha due livelli una volta digitata una password:

- **Weak**: RC4 a 40 bit, per `pdf` RGB senza segni di stampa né abbondanza e password solo ASCII. Una password con altri caratteri passa a Strong, perché i lettori non possono aprire un file bloccato così a questo livello. Contano solo i primi 32 caratteri.
- **Strong**: AES-256 (PDF 2.0). Si applica anche ai Print PDF e a ogni PDF in uno ZIP batch. Un Print PDF bloccato con Strong mantiene CMYK, segni e intento di output ma perde la dichiarazione PDF/X-4.

::: warning Weak è un deterrente, non una protezione
Usa **Strong** per un file riservato.
:::

**Uno ZIP bloccato** copre un'esportazione ZIP, il download di una cartella da Projects o un batch, con una password a due livelli: **Weak** (ZipCrypto, un deterrente) o **Strong** (AES-256). La password protegge ogni file contenuto. Anche ogni PDF all'interno viene bloccato singolarmente con AES-256, quindi resta bloccato dopo l'estrazione dello ZIP. La richiesta compare quando inizia il download. Una password vuota significa nessun blocco.

**Una password digitata resta fuori dai link a entrambi i livelli.** Se un file arriva tramite un link `?password=`, Lolly legge il valore e lo rimuove subito dall'indirizzo. Un link che richiede un blocco non supportato dal suo file non scrive alcun file e ne spiega il motivo (vedi [`password`](/info/url-parameters.html)).

**Un link di condivisione protetto da password** chiede al destinatario una password prima di aprirsi. Lo stato del link è cifrato con AES-256 usando una chiave derivata dalla password (PBKDF2). Viaggia solo testo cifrato e la decifratura avviene nel browser del destinatario. Il server che serve il link non vede mai la password né il design. Attivalo nella finestra **Share**. Un link cifrato si apre solo in Lolly, mai come immagine incorporata. Vedi [Modalità URL](/info/url-mode.html).

<!--i:eti-monitor-->
## Su un telefono

I controlli di esportazione si trovano dietro il pulsante mobile **Export**, che apre il pannello **Export**: gli stessi formati, dimensione, copia, download e condivisione, con dimensioni adatte al tocco.

<!--i:eti-code-->
## Id dei formati per link e CLI

Questi sono i valori del parametro URL `format=` e del flag CLI `--export=` (vedi [Parametri URL](/info/url-parameters.html) e [CLI](/info/cli.html)). Il menu di uno strumento mostra solo i formati che quello strumento può creare.

| Tipo | Id |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vettoriale | `svg` · `svgz` (SVG compresso con gzip) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (file per taglio) |
| Pagina e documento | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (file di design Penpot) · `scorm` (pacchetto di un corso, uno ZIP) |
| Animazione | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| Audio | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` · `mid` (note MIDI, da Lolly Rondocode) |
| Testo e dati | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `ttml` · `scc` · `css` · `scss` · `gpl` (palette GIMP) |
| Bundle e pacchetti | `zip` · `rpm` e `tar.gz` (il rendering racchiuso in un pacchetto Linux) |

Alcuni id provengono dal codice di esportazione dello strumento: `ase` (Adobe Swatch Exchange, da Lolly Palette Lab), `exr` e `hdr` (raster ad alta gamma dinamica, da Lolly Darkroom). **Convert Font** scrive `ttf`, `otf` e `woff` da un file di font che fornisci tu, quindi un semplice link non dà allo strumento nulla da renderizzare.
