# Esportazione e formati

Come ottenere un file finito da uno strumento - scegliere il formato giusto, impostare la dimensione di output e cosa fa ciascuna opzione. Come tutto il resto, **l'esportazione avviene sul tuo dispositivo**; niente viene caricato.

## Come funziona l'esportazione

L'anteprima *è* il file. Quando esporti, l'host renderizza quella canvas nel formato scelto e ti consegna un download (o lo mette negli appunti). Uno strumento offre solo i formati dichiarati dal suo autore, e il selettore nasconde quelli che il tuo browser non può produrre (vedi [Video](#video)).

Tre percorsi producono un file. La maggior parte degli strumenti **renderizza la canvas** nel formato scelto. I formati di testo e dati (HTML, MD, TXT, JSON, CSV, ICS, VCF) sono invece **generati dal contenuto dello strumento**, non rasterizzati dall'immagine. E le utility per la privacy (es. *Strip Hidden Data*) usano un terzo percorso: il file che *tu* scegli viene trasformato byte per byte sul dispositivo e restituito direttamente - nessuna canvas, nessuna filigrana e nessun metadato di provenienza aggiunto, perché è già un tuo file.

Le azioni nei controlli di esportazione:

- <!--i:download--> **Scarica** - salva il file (l'azione principale).
- <!--i:photos--> **Copia** - metti l'immagine negli appunti per incollarla direttamente in Slack, email, un documento. Dove un browser non può copiare immagini, scarica invece e te lo comunica.
- <!--i:folder--> **Salva** - conserva il progetto corrente come sessione strumento salvata nella tua libreria.
- <!--i:link--> **Condividi** - apre la **finestra di condivisione**: un link copiabile che riproduce il progetto, toggle all'apertura (schermo intero, pannello di esportazione, download o copia all'apertura) e un **Link più breve** opzionale che comprime l'intero stato in un token compatto (vedi [URL Mode](/info/url-mode.html)).

(L'autore di uno strumento sceglie quali di queste appaiono; il set predefinito è Copia, Scarica e Salva.)

![Il pannello di esportazione - formato, dimensione e le azioni Copia / Scarica / Salva / Condividi](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Condividi si apre sopra lo strumento, con il link già costruito e i toggle all'apertura sotto.

### Renderizzare molti alla volta

Una singola esportazione è un file, ma puoi renderizzarne **molti** in un solo passaggio - ciascuno consegnato come un unico `.zip`:

- <!--i:folder--> **Progetti → Renderizza cartella** esporta ogni sessione salvata in una cartella (e le sue sottocartelle) come un unico zip annidato; **Renderizza selezione** fa lo stesso per qualsiasi selezione multipla; una singola sessione salvata viene renderizzata direttamente nel proprio file. Non serve Batch/Pro - vedi [Usare Lolly → Progetti](/info/using.html).
- <!--i:layers--> **Batch (Pro)** renderizza una griglia di set di input - ogni variante di un template in una volta sola.

Una sessione salvata può anche essere ricondivisa come link a uno strumento da Progetti (ricostruisce l'URL dello strumento a partire dagli input salvati), così un link lo riapre con esattamente le stesse impostazioni.

## Scegliere un formato

Il campo del nome file e il selettore di formato si trovano in cima al pannello come un'unica coppia `nome.formato`, e il selettore elenca solo i formati dichiarati dall'autore di questo strumento.

![Il campo del nome file fuso con il selettore di formato, così l'esportazione si legge come un'unica coppia nome.formato](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

| Vuoi… | Usa | Perché |
|---|---|---|
| Loghi/illustrazioni nitidi che si ridimensionano | **SVG** | Vettoriale - scalabile all'infinito, leggero, modificabile |
| Vettoriale per app Office / Windows | **EMF** | Si incolla come vettore modificabile in PowerPoint / Word; il testo resta vivo e modificabile, e Google Drive lo apre in Google Drawings per Slides |
| Vettoriale per stampa / app di design | **EPS**, oppure **EPS (CMYK)** | Vettoriale PostScript per Illustrator / flussi di lavoro tipografici |
| Vettoriale per taglio / macchine CAD | **DXF** | Taglierine laser, plotter da taglio, CNC - tracciati in millimetri |
| Una presentazione modificabile | **PowerPoint** (PPTX) | Testo e forme native modificabili, con immagini e vettori estraibili |
| Un corso importabile da un LMS | **SCORM** (LMS) | Uno zip con il manifest, una pagina di avvio, le diapositive e il filmato narrato con sottotitoli - da una presentazione Design |
| Un documento di testo modificabile | **Word** (DOCX) o **OpenDocument** (ODT) | Paragrafi e titoli reali che un elaboratore di testo può continuare a modificare (Doc Studio) |
| Una foto o un'immagine generica | **PNG** (senza perdita) o **JPG** (più leggero) | Raster universale |
| Immagini moderne più leggere | **WebP** / **AVIF** | Compressione migliore, alpha |
| Stampa | **PDF**, oppure **Print PDF** (CMYK) | Formato pagina reale; CMYK per la stampa |
| Raster di stampa per tipografia | **Print TIFF** (CMYK) | Pixel DeviceCMYK per un RIP |
| Animato per il web | **GIF** | Funziona ovunque, file più grandi |
| Animato a colori pieni con alpha reale | **APNG** | PNG animato - nessun limite di palette, trasparenza vera |
| Animato, file più piccolo | **WebP animato** | Colori pieni e alpha, compresso meglio di GIF o APNG |
| Vettoriale animato che si ridimensiona | **SVG animato** | Autonomo; va in loop in un browser o in `<img>`, nessun codec, qualsiasi dimensione |
| Video per social / condivisione | **MP4** o **WebM** | Miglior qualità per byte (vedi sotto) |
| Testo ricco / firma email | **HTML** | Si incolla formattato nei client di posta |
| Contenuto semplice | **MD** / **TXT** | Solo testo |
| Un evento di calendario | **ICS** | Si importa in qualsiasi app di calendario |
| Un biglietto da visita digitale | **VCF** | Si importa in Contatti / rubriche |
| Dati strutturati da reimportare | **JSON** / **CSV** | Ripropone il contenuto dello strumento |
| Un favicon | **ICO** | Icona multi-dimensione per il sito (**ZIP** raggruppa più formati) |

La prima riga è il caso comune. Un wordmark composto nel carattere del tuo brand viene esportato come SVG, dove ogni lettera è un percorso delineato anziché un pixel, così resta nitido sia alla dimensione di un biglietto da visita sia a quella di un rivestimento per edificio, dallo stesso file.

![Un wordmark hairline dalla spaziatura ampia che recita Aurora, il tipo di puro artwork vettoriale a cui si riferisce la riga SVG della tabella](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-wordmark-vector)

## Dimensione e unità di stampa

Per impostazione predefinita le esportazioni usano la dimensione in pixel nativa dello strumento. Dove uno strumento espone le **dimensioni**, puoi impostare larghezza × altezza e un'**unità**:

- **px** (predefinita) - pixel esatti.
- **mm · cm · in · pt · pc** - dimensioni fisiche/di stampa. Con un'unità fisica imposti anche il **DPI** (predefinito **300** per la stampa); il motore converte correttamente per ogni formato - il **PDF** diventa una pagina reale a quella dimensione, il **raster** viene renderizzato al numero di pixel corretto per il DPI (e incorpora la risoluzione), l'**SVG** mantiene l'unità fisica con un viewBox in px.

Per ottenere un raster a risoluzione più alta, inserisci una larghezza/altezza maggiore, oppure scegli un'unità fisica e alza il DPI (pixel = dimensione × DPI). Non esiste un toggle di scala a un clic.

Esempio: larghezza `210`, altezza `297`, unità `mm` → una pagina A4.

![La riga delle dimensioni impostata a 210 per 297 mm, con il campo DPI rivelato perché l'unità è fisica](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Fermi immagine da una composizione temporizzata

Una **composizione temporizzata** - una timeline [Sequence](/info/using.html#timeline-sequence) in Design, o qualsiasi tavola guidata da una timeline - è qualcosa in movimento, quindi un'esportazione statica deve rispondere a "quale momento?". La regola è quella che ti aspetti: **il fotogramma alla testina di riproduzione**. Posiziona la testina dove vuoi l'immagine ed esporta; quello che vedi è quello che ottieni.

Quando vuoi più di un istante, il campo **Fotogrammi** appare accanto alla dimensione di output (solo per una composizione temporizzata, e solo per un formato statico - PNG, JPG, WebP, SVG o PDF). Lascialo a `1` per il fotogramma al playhead. Alzalo e ottieni altrettanti fermi immagine campionati a intervalli uguali lungo l'intera sequenza:

- **Raster e SVG** tornano come un unico **zip** - `<name>-01.png`, `-02.png` e così via.
- **PDF** torna come un **singolo documento con quel numero di pagine**.

Utile per uno storyboard, un foglio di miniature, un contact sheet per la revisione o un carosello social ricavato direttamente da un montaggio video.

Il campionamento viene fatto al **punto medio** di ogni intervallo anziché ai bordi, perché il primo istante di una sequenza è spesso una transizione in entrata non ancora dissolta e l'ultimo è lo stato dopo che ogni clip è terminata - il campionamento agli estremi sprecherebbe due dei tuoi fotogrammi su immagini quasi vuote. Il conteggio è limitato a **64** (un contact sheet è fatto perché una persona lo legga), e qualsiasi valore insensato digitato nel campo torna a `1` invece di far fallire l'esportazione. Ogni fotogramma è un fermo immagine ordinario, quindi Content Credentials, l'imprint, le unità fisiche e il DPI si comportano esattamente come in una singola esportazione.

Il campo **Fotogrammi** è oggi il modo per ottenere un foglio. Il motore riserva un parametro URL `cuts` corrispondente, ma nessuna shell lo legge ancora da un link, quindi un link condiviso si riapre sempre sul fotogramma al playhead - vedi [URL Mode](/info/url-mode.html#contact-sheets-cuts).

## PDF multipagina

Alcuni strumenti costruiscono un **documento PDF multipagina** invece di un singolo elaborato - una copertina, un contenuto che scorre su quante pagine servono e una quarta di copertina, tutto in un unico file (vedi lo strumento *Booklet*). Ogni pagina è una **vera pagina PDF** dimensionata sul riquadro di quella pagina, così lettori e stampanti ottengono pagine reali, non un'unica immagine lunga.

- **Pagine dal contenuto.** Aggiungi blocchi di testo e immagini; nuove pagine vengono create automaticamente man mano che i blocchi si riempiono, e puoi forzare qualsiasi blocco a iniziare una nuova pagina.
- **Dimensioni di pagina reali.** Scegli A4, US Letter o A5 (verticale - il layout a due colonne è costruito per questo) - ogni pagina, e il PDF esportato, viene renderizzato esattamente a quella dimensione.

I PDF multipagina sono documenti RGB e non portano crocini di taglio/abbondanza - quelli appartengono al percorso **Print PDF** a pagina singola descritto sopra. Portano però gli stessi **metadati PDF/X-4** di ogni esportazione PDF (riquadri di pagina, XMP, ID documento, un output intent sRGB con profilo incorporato), e offrono **Content Credentials** (sotto) - sullo strumento *Booklet* l'opzione è preselezionata.

## Creare molte cose alla volta

Lolly ha tre modi distinti di lavorare in volume, e risolvono compiti diversi - la modifica in batch è una capacità di prima classe della piattaforma, non qualcosa che ogni strumento reinventa:

- <!--i:document--> **Un progetto × una tabella di righe → un unico documento multipagina.** Gli strumenti con un input `table` (come *Battlecards*) trasformano automaticamente ogni riga in una pagina - incolla una tabella dal tuo foglio di calcolo, ottieni un PDF dimensionato come un deck. Il tuo vero editor batch resta il foglio di calcolo: correggi dieci righe lì, incolla di nuovo. Lo strumento in sé non gestisce mai le pagine.
- <!--i:layers--> **Un progetto × un file di dati → molti file separati.** La griglia batch di `/pro` prende un CSV e renderizza un'esportazione *per riga* - badge nominativi, certificati, un file ciascuno.
- <!--i:sliders--> **Molti asset diversi, modificati fianco a fianco.** *Multi-edit* apre più sessioni salvate in un'unica vista per ritocchi coordinati su progetti distinti.

Regola pratica: righe dello stesso progetto che appartengono a **un unico documento** → uno strumento guidato da tabella; righe che devono uscire come **file separati** → `/pro`; **progetti diversi** che richiedono la stessa modifica → multi-edit. (Un'opzione di rendering "combina media" pianificata farà da ponte tra le prime due - concatenando esportazioni dello stesso formato in un unico PDF, un unico video o un contact sheet di verifica.)

## PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart e Diagrams possono esportare una **presentazione PowerPoint** - una diapositiva per pagina. Il punto non è uno screenshot pixel-perfect; è consegnare a un collega una presentazione che possa davvero **modificare ed estrarne gli elaborati**. Così ogni pagina viene scomposta in oggetti nativi:

- <!--i:font--> Il **testo** diventa una vera **casella di testo PowerPoint modificabile** - con dimensione del carattere, colore, peso, corsivo e allineamento presi dal layout - così puoi correggere un refuso o restilizzare direttamente in PowerPoint.
- <!--i:pentool--> I **vettori** (loghi, icone, il marchio SUSE) sono incorporati come **vere immagini SVG** - restano nitidi a qualsiasi dimensione, e PowerPoint può persino applicarvi *Convert to Shape*.
- <!--i:photos--> Le **immagini** arrivano alla loro risoluzione nativa come immagini estraibili a sé stanti (un'immagine hero ritagliata con `cover` mantiene l'immagine completa dietro il ritaglio, così puoi reinquadrarla), con ogni trattamento applicato sull'immagine (filtri, blend) integrato fedelmente.
- <!--i:layers--> **Sfondi, bordi e righe** diventano vere forme rettangolo/linea.

![Il pannello di esportazione con PowerPoint selezionato: una diapositiva per pagina, testo e forme rimangono modificabili](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Il layout è approssimativo per progetto - l'obiettivo è un **contenuto** fedele e riutilizzabile, non uno screenshot bloccato. Tutto ciò che il walker non riesce a esprimere in modo nativo (una regione complessa filtrata o mascherata) viene incorporato come immagine, così non si perde nulla. Un deck ha un'unica dimensione di slide, presa dalla prima pagina.

PowerPoint è anche una via **in entrata**. Trascina un file `.pptx` su qualsiasi superficie di caricamento e scegli le diapositive che vuoi - ognuna diventa un elaborato da posizionare, correggere o su cui costruire. **Markdown Slides** scrive una presentazione nuova a partire da Markdown (e fornisce un modello `.pptx` a marchio), e l'utility **Rebrand** ritematizza sul posto una presentazione esistente - palette del tema, colori e font codificati manualmente - senza toccarne grafici, SmartArt o animazioni, restituendo un file `.pptx`. Vedi [Importare un design → Presentazioni e documenti](/info/design-import.html#decks-and-documents).

## Penpot

Qualsiasi strumento che può esportare SVG può esportare anche un **file Penpot** (`.penpot`) - il documento, pronto per continuare a essere modificato in Penpot e non solo osservato.

- <!--i:layout--> Da **Design**, ogni frame diventa una **board** Penpot, ogni riquadro al suo interno passa come una propria forma modificabile - rettangolo, ellisse, testo, immagine o tracciato - e il risultato arriva come **componente** riutilizzabile nel pannello Assets, pronto per essere trascinato di nuovo fuori.
- <!--i:pentool--> Da uno strumento il cui rendering è **geometria pura** - gli strumenti vettoriali come QR Code, Street Map, Wordmark e Palette Lab - ogni tracciato, rettangolo, riga di testo e gradiente passa allo stesso modo, come propria forma modificabile.
- <!--i:font--> Da uno strumento che compone il suo rendering in **HTML**, **il testo resta testo** - un oggetto testo Penpot modificabile per riga, non un contorno e non un'immagine piatta. Un elaborato per cui Penpot non ha un costrutto - un'illustrazione complessa, un canvas dal vivo - viaggia a parte come immagine, così non appiattisce mai il testo e i riquadri intorno. Un intero layout che Penpot non può separare fedelmente può comunque passare come un'unica immagine a piena fedeltà, così non va mai perso nulla.
- <!--i:palette--> Un colore o un font che una forma **eredita da un token del brand** resta **collegato** a quel token nel file: cambia il token nel pannello Tokens di Penpot e ogni forma che lo eredita si ridipinge insieme, mentre un colore letterale isolato resta esattamente dov'è. I colori e le tipografie del brand arrivano anche nel pannello **Assets** e l'intero set di design token nel pannello **Tokens** - lo stesso set di token DTCG usato dalla palette di Lolly. Da lì Penpot mantiene una propria copia: una modifica fatta nel suo pannello Tokens torna nel brand tramite [l'importazione di Brand Studio](/info/design-import.html), non da sola.

| Cosa hai creato | In Penpot |
|---|---|
| Testo | Oggetti testo modificabili - correggi un refuso o restili |
| Forme, tracciati, gradienti, immagini | Proprie forme vettoriali modificabili |
| Un colore o un font da un token del brand | Un collegamento a token attivo - modifica il token, ogni forma che lo eredita segue |
| L'intero design | Un componente riutilizzabile nel pannello Assets |
| Un'illustrazione complessa o un canvas dal vivo | Incorporato a parte come immagine, il contenuto modificabile intorno resta intatto |

![Il pannello di esportazione con Penpot selezionato: il file .penpot, e Send to Penpot accanto al download](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Per aprirlo, avvia Penpot, scegli un progetto e seleziona **Import**. Se hai effettuato l'accesso a Penpot dal pannello di esportazione, **Send to Penpot** fa questo passaggio al posto tuo - scegli lì un progetto e il file finisce direttamente al suo interno.

## SCORM (pacchetti corso)

Una presentazione Design può uscire come **pacchetto SCORM** - lo zip che un learning management system importa, sia esso Moodle, Canvas, Blackboard o un LMS aziendale. Scegli **SCORM (LMS)** nel selettore di formato e l'esportazione scrive:

- <!--i:layout--> **Le diapositive**, un'immagine per tavola, in vettoriale dove la tavola lo consente e in pixel solo dove non lo consente.
- <!--i:play--> **Il filmato narrato** con la sua traccia di sottotitoli - le note del relatore lette da una voce on-device, esattamente come le riproduce [Presenting](/info/create/using.html#presenting).
- <!--i:file--> **Una pagina di avvio** che scorre le diapositive, riproduce il filmato e riporta il completamento all'LMS tramite il runtime SCORM 1.2, la versione accettata da ogni LMS.
- <!--i:font--> I font usati dalla presentazione, così la pagina di avvio si presenta uguale offline.

![Il pannello di esportazione su una presentazione Design con SCORM (LMS) selezionato](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Niente nel pacchetto contatta l'esterno: sono file in uno zip, e gira dentro l'LMS senza bundler, senza CDN e senza account. Le app web e desktop lo costruiscono; la CLI no, perché fotografare le tavole e codificare il filmato richiedono il browser.

## DXF (file di taglio)

Gli strumenti vettoriali (Brand Lockup, QR Code, Street Map, Wayfinding Signage, Pose Geeko, i lockup di logo, Diagram Builder) possono esportare in **DXF** - il formato di interscambio AutoCAD R12 che leggono i tagliacarte laser, i plotter da vinile e i software CNC/CAD. La geometria viene scritta come **tracciati di contorno in millimetri** (curve appiattite con una tolleranza fine), il testo viene convertito in tracciati e il colore viene mappato sull'AutoCAD Color Index più vicino (che di solito pilota lo strumento o l'operazione su un plotter da taglio). DXF è solo line-art - una zona fotografica o filtrata non ha una forma di tracciato di taglio e viene scartata (Lolly avvisa), quindi usa SVG/PDF quando devi mantenere contenuto raster.

Street Map è il caso più chiaro: l'intero design è già fatto di tratti, quindi ogni strada e canale diventa un percorso di taglio senza nulla da scartare.

::: showcase
![Un render Street Map di Parigi in inchiostro su crema - pura line art, quindi ogni tratto sopravvive al passaggio verso una tagliatrice](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Scorrendo, la telecamera si allontana attraverso la geometria vera e propria: sette percorsi, nessun pixel da nessuna parte, ogni tratto nitido come un capello a qualsiasi zoom. È lo stesso file che legge una tagliatrice.
:::

## SVG animato

Gli strumenti di motion (Animated Ad, Lottie Ad) possono esportare in **SVG animato** - un'animazione *vettoriale* autonoma. A differenza di GIF/APNG/WebP (che campionano ogni frame in pixel), un SVG animato impila istantanee vettoriali con keyframe CSS incorporati, quindi **si scala a qualsiasi dimensione senza codec e senza runtime esterno** - va in loop in una scheda del browser o in un `<img>`. Il testo resta trasformato in contorni così viene renderizzato ovunque. Condivide i controlli **Duration**/frame rate dei formati animati e (essendo più pesante per fotogramma di un bitmap) usa un frame rate predefinito più basso.

## Trasparenza

Gli strumenti che la supportano offrono un interruttore per lo **sfondo trasparente** (es. *No BG*). La trasparenza è preservata da PNG, WebP, AVIF, SVG (statico e animato), APNG e Animated WebP. JPG e PDF sono sempre opachi, e TIFF appiattisce su bianco (su nero nel percorso HDR - vedi sotto).

## Spazi colore

Due domande diverse, che vale la pena tenere separate: quali spazi colore Lolly sa **leggere e in cui sa ragionare**, e quali **scrive**.

**Lettura.** Ovunque un colore venga scritto - il foglio di stile di uno strumento, il paint di un SVG importato, il valore di un design token, un'ombra o un gradiente dentro una shorthand CSS - Lolly legge l'intero vocabolario **CSS Color 4**: `#hex`, `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, i colori con nome CSS e `color()` negli spazi predefiniti - `srgb`, `srgb-linear`, `display-p3`, `a98-rgb`, `prophoto-rgb`, `rec2020`, `xyz-d50`, `xyz-d65` - inclusi i componenti scritti come parola chiave `none`. Un unico parser lo fa per l'intera piattaforma, così il browser e ogni walker di esportazione concordano su cosa significhi una stringa di colore.

Questo conta più di quanto sembri, perché un browser risolve il CSS moderno in CSS moderno. Scrivi `color-mix(in oklab, …)` e Chrome calcola `oklab(…)`; usa un token di brand memorizzato come `oklch()` e quello è il valore letterale che vede il walker di esportazione. I colori in queste forme vengono letti correttamente invece di essere scartati - cosa che faceva un walker che capiva solo `rgb()`, esportando testo colorato di brand come nero, perdendo pannelli con tinta e righe di tabella e leggendo `oklch(0.7 0.1 200) 0px 2px 4px` come uno spostamento d'ombra di 0.7 per 0.1.

**Modo di pensare.** La matematica del colore avviene in modo percettivo anziché su canali grezzi. La derivazione della palette, le rampe, le armonie e il contrasto girano in **OKLCH/OKLab**, e un colore fuori gamut viene riportato nell'intervallo dall'algoritmo di mappatura del gamut proprio di CSS Color 4 - riduzione della crominanza con un controllo di distanza percettiva - anziché ritagliando i canali, così un colore vivido si assesta sul colore più vicino che accetteresti davvero invece che su uno appiattito. I gradienti interpolano in uno spazio che scegli (OKLab per impostazione predefinita, oppure `oklch`, `lab`, `lch`, `srgb`, `srgb-linear`, `hsl`, con una direzione di percorso della tonalità per quelli polari), e la miscelazione è **premoltiplicata**, così una dissolvenza verso il trasparente mantiene il colore giusto invece di scurirsi verso il nero lungo il percorso. Un unico interpolatore serve sia l'anteprima sia i walker di esportazione - ed è proprio questo che ha impedito a un gradiente conico di essere miscelato in un modo sullo schermo e in un altro nel file esportato.

**Scrittura.** L'output è deliberatamente più ristretto dell'input, perché un file deve essere leggibile da qualunque cosa lo apra, e uno spazio viene *dichiarato* in output solo quando i numeri sono stati davvero convertiti in esso. I formati per schermo e web vengono scritti in **sRGB** e taggati come tali; i formati di stampa vengono scritti in **CMYK** rispetto a una condizione di stampa nominata (sotto); e il percorso HDR è **Rec.2100 PQ** (sopra). Un colore a gamut ampio che raggiunge un'esportazione viene mappato in sRGB anziché etichettato male - portare `color(display-p3 …)` fino a un file vettoriale è un'estensione pianificata, non qualcosa che le esportazioni odierne pretendono di fare. Un gradiente creato in OKLab viene *precotto* in stop sRGB semplici in uscita, con stop extra inseriti solo dove sRGB divergerebbe visibilmente dalla curva percettiva, perché un `<linearGradient>` SVG e uno shading assiale PDF non hanno un'impostazione di spazio di interpolazione per portare l'intento. Un valore creato, tre renderer, nessuna deriva.

## Profili colore

Affinché i colori si riproducano fedelmente nelle app con gestione del colore (tipografie, Photoshop, browser), le esportazioni sono **taggate con un profilo colore**:

- **PNG / JPG** portano un profilo ICC **sRGB** incorporato - lo spazio colore in cui l'anteprima viene effettivamente renderizzata - così non c'è nulla da indovinare. (Solo tagging; i pixel non vengono ricodificati.)
- Il **PDF di stampa (CMYK)** dichiara una **condizione di stampa** target nel proprio *OutputIntent* (predefinita *Coated FOGRA39*), indicando a un RIP/tipografia come vanno lette le sue inchiostrature CMYK. I campioni di brand con valori di inchiostro misurati vengono convertiti esattamente; gli altri colori usano una conversione dispositivo standard. Quella dichiarazione è un *nome*: nessun profilo CMYK viene fornito con Lolly, e PDF/X-4 vuole il profilo incorporato, quindi una condizione nominata scrive l'output intent senza dichiarare conformità PDF/X-4. Carica un tuo profilo CMYK e scegli la sua riga **Embed** nel controllo Profilo colore, e viene incorporato come *DestOutputProfile* del file - a quel punto il PDF può essere davvero PDF/X-4, e lo dichiara ogni volta che il resto del file lo consente. Tre cose sospendono la dichiarazione mantenendo l'output intent (un RIP lo vuole comunque): artwork RGB che il passaggio CMYK non è riuscito a convertire, il testo di credito margine-prova `prov` (disegnato in un font standard non incorporato, e X-4 non fa eccezioni per questi) e una password **Strong**, poiché X-4 vieta la crittografia. La condizione dichiarata viene quindi letta da quel profilo: un nome registrato dove il profilo ne prova uno, `Custom` sotto il nome proprio del profilo dove non lo fa, così il file non può mai nominare una condizione di stampa mentre porta le misurazioni di un'altra.
- Il **TIFF di stampa (CMYK)** scrive pixel **DeviceCMYK** non taggati e registra la stessa condizione di stampa come provenienza nei suoi metadati TIFF (*ImageDescription*) anziché incorporare un profilo. Lo stesso controllo Profilo colore pilota entrambi i formati CMYK - un TIFF non può incorporare affatto un profilo di stampa, quindi una riga **Embed** vi registra solo il nome di quel profilo e nient'altro.
- **TIFF (RGB)** è il sibling sRGB semplice e non compresso - un raster senza perdita alla DPI scelta per archiviazione o un round-trip con un editor, con la provenienza registrata negli stessi metadati TIFF. Qualsiasi trasparenza viene appiattita su bianco (questo profilo non porta alpha). Come il TIFF CMYK è solo desktop, poiché i browser non possono anteprimare un TIFF e i download mobili si bloccano.
- **SVG**, **EMF**, **EPS** e **DXF** sono vettori indipendenti da risoluzione e profilo, senza profilo incorporato - i colori dell'SVG sono sRGB semplice, quelli di EMF ed EPS sono device RGB (e **EPS (CMYK)** scrive DeviceCMYK ingenuo) e **DXF** porta l'AutoCAD Color Index più vicino. (SVG, EPS e DXF, come il PDF, trasformano in contorni vettoriali qualsiasi testo, così il risultato viene renderizzato anche dove il font non è installato. EMF invece mantiene il testo VIVO per default - veri record di testo del metafile che restano selezionabili e modificabili in Office e Google Slides, ricadendo sui contorni solo per le porzioni che il formato non riesce a esprimere; l'opzione "Outline fonts" del pannello di esportazione forza i contorni ovunque.) **SVG** riproduce anche `box-shadow` CSS dall'HTML - ogni ombra esterna è dipinta dietro il riquadro, con offset/spread e sfocatura gaussiana corrispondenti al browser, e le ombre interne sono dipinte al suo interno allo stesso modo.

Questo è automatico - nessuna impostazione da regolare. Anteprime e miniature saltano il tag per restare leggere. Un profilo *è* una scelta, perché cambia i pixel invece di limitarsi a etichettarli - vedi **HDR** sotto.

## HDR (colori luminosi)

Le esportazioni ordinarie sono sRGB: il bianco è bianco, e un colore di brand saturo è luminoso quanto il bianco normale dello schermo. Su un display con capacità HDR c'è molto margine sopra quello, e la scheda **HDR** nel pannello di esportazione lo usa - i tuoi colori di brand e il testo bianco vengono spinti verso la luminosità di picco così brillano davvero, mentre le aree scure restano scure e danno al bagliore il suo contrasto.

![La scheda HDR nel pannello di esportazione, attivata, con le manopole White / Reach / Dark lift / Focus rivelate sotto](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formati.** I formati raster con uno spazio dove portare il segnale: **PNG**, **JPG**, **AVIF** e **TIFF**. (Non WebP - è a 8 bit senza un percorso di decodifica HDR funzionante, quindi un WebP PQ risulterebbe semplicemente scuro. Vettori e PDF non hanno alcun modello HDR.)
- **Disattivato di default**, a differenza della marcatura colore - modifica i pixel, quindi è opt-in. Spunta la scheda, oppure passa `hdr=1` in un link di condivisione.
- **Cosa viene effettivamente scritto.** I pixel vengono ricodificati in **Rec.2100 PQ** - primari BT.2020 con la curva di trasferimento SMPTE ST 2084 (PQ) - e il contenitore porta il segnale corrispondente così un'app color-managed sa che deve leggerli in quel modo: un **profilo ICC v4 con tag `cicp`** generato (JPG, TIFF), un **chunk `cICP`** (PNG) o un box `colr` riscritto (AVIF). Il potenziamento è vincolato alla **luminosità percettiva (OKLab)**, così i colori medio-alti spingono verso il picco e quelli scuri vengono attenuati anziché bruciati, ed è conservativo rispetto alla tinta - un verde di brand diventa più luminoso, non menta.
- **Le manopole.** Quattro, rivelate quando la scheda è attiva: **White** (il tetto di luminosità di picco, 400-2000 nit), **Reach** (fino a che punto verso i toni bassi si diffonde il bagliore), **Dark lift** (quanto si schiariscono gli scuri - `0` li mantiene scuri) e **Focus** (quanta ricchezza cromatica mantiene il potenziamento). Viaggiano nello stesso parametro come un valore compatto già regolato - `hdr=1600-60-0-50` è White 1600, Reach 60, Dark lift 0, Focus 50 - così un look regolato è riproducibile dal link.
- **Dove lo vedrai.** Visualizzatori color-managed su un display HDR: Preview / Quick Look / Safari su dispositivi Apple, Chrome su un monitor HDR. Su uno schermo SDR ordinario il file appare comunque come un'immagine normale.
- **Da sapere prima di pubblicarlo.** Molte piattaforme **ricodificano** ciò che carichi e rimuovono il segnale HDR - social network, app di messaggistica, alcuni CMS - il che può far apparire l'immagine scura o slavata. Usa l'HDR dove controlli la destinazione (un sito che costruisci tu, un video wall, una presentazione su un pannello luminoso), non come impostazione predefinita per tutto.
- **Trasparenza.** PNG e AVIF mantengono il proprio alpha; JPG è opaco come sempre. Il percorso **TIFF** appiattisce su **nero**, non sul bianco del percorso SDR - in PQ il bianco è il codice a 10.000 nit, quindi appiattire su di esso circonderebbe ogni bordo con un alone accecante.
- **Gli stessi byte dal terminale.** `--hdr=1` con `--export=png` o `--export=jpg` scrive il PNG Rec.2100 PQ a 16 bit e il JPEG con gain-map ISO 21496-1 anche sulla [CLI](/info/cli.html), dagli stessi encoder del motore anziché da un browser - così uno strumento nativo `<svg>` produce un file HDR senza alcun Chromium nel percorso, e il PNG è identico byte per byte a quello della shell web. AVIF e TIFF restano per ora esportazioni della sola shell web.

## Video

Gli strumenti animati esportano il movimento come **MP4**, **WebM** o **GIF** - e, dove offerto, **APNG**, **Animated WebP** o l'**SVG animato** vettoriale (sopra). Quale contenitore video vedi dipende dal tuo browser - il selettore mostra solo ciò che è effettivamente in grado di registrare:

| Browser | Mostra |
|---|---|
| Safari / iOS | **MP4** |
| Firefox | **WebM** |
| Chrome / Edge 126+ / Android | **MP4 e WebM** |
| Chrome più vecchio | **WebM** |

Il GIF funziona ovunque (ottimo per chat/email; più grande e con meno colori del video). Gli strumenti animati espongono anche **Wait** (secondi per lasciare che l'animazione si stabilizzi prima della registrazione) e **Duration** (durata della clip).

> Un link condiviso `?format=…` che richiede un contenitore che il tuo browser non può registrare ricade con eleganza sull'altro e nomina il file di conseguenza.

**Audio.** Le esportazioni video non sono mute. Uno strumento può stendere un **letto musicale** sotto la clip - una risorsa audio dal catalogo, in loop o tagliata alla durata della clip, con fade-in/out, volume e ducking automatico sotto il suono proprio del filmato - e gli strumenti di registrazione portano l'audio live del loro filmato direttamente nel file. **MP4** e **WebM** mantengono la traccia mixata; GIF e i formati immagine animati (APNG, Animated WebP, Animated SVG) sono muti per natura.

## Audio

Alcuni strumenti esportano **audio da solo**, non solo come traccia video. **Voice Recorder** cattura una presa dal microfono con un misuratore di livello dal vivo e un coaching gentile, poi la salva come **MP3** (predefinito, transcodificato nel tuo browser) o nel suo contenitore nativo - **M4A** (AAC), **OGG** o **WebM** (Opus), a seconda di cosa ha registrato il tuo browser. Come per tutto il resto, la codifica avviene sul tuo dispositivo - non viene caricato nulla.

L'audio che *importi* è altrettanto ampio. Il selettore risorse accetta **MP3**, **WAV**, **OGG**/**Opus**, **M4A**/**AAC** e **FLAC** (mantenuti byte per byte e decodificati sul dispositivo), **MIDI** (`.mid` - convertito all'importazione in una piccola traccia sintetizzata sul dispositivo) e **moduli tracker** - **MOD**, **XM**, **IT**, **S3M**, **STM**, **MTM** (decodificati sul dispositivo da un player integrato, pochi kilobyte di dati del brano). Ognuno di questi può diventare il **letto musicale** sotto un'esportazione video, o suonare nel player ambientale della Neurospicy Mode.

L'audio *fa parte* della pipeline `format=` / `--export=` sotto: `wav`, `mp3`, `m4a` e `opus` sono normali id di formato, quindi un'esportazione solo audio è condivisibile e scriptabile quanto un PNG. Ciò che esce è solo il suono, nessuna immagine.

## Provenienza e watermark

Dove il formato lo supporta, le esportazioni portano **metadati di provenienza** - software, origine, il nome dello strumento e la tua riga di credito profilo - incorporati in modo nativo (PNG iTXt, JPEG EXIF, info PDF, `<metadata>` SVG, commento GIF). È solo attribuzione di autorialità; non viene caricato nulla. Gli strumenti **sperimentali** applicano inoltre un watermark visibile, apposto dall'host, così non può essere rimosso modificando lo strumento.

**L'Imprint di Lolly.** Le esportazioni raster portano anche il **watermark a pixel invisibile** proprio di Lolly - l'*Imprint di Lolly* - **attivo per default**, proprio come le Content Credentials. Mentre la credenziale e i metadati di provenienza viaggiano *accanto* ai pixel e si perdono con un ri-salvataggio, uno screenshot o una rimozione dei metadati, l'Imprint vive *nei* pixel e sopravvive alla ricompressione - così una copia dell'immagine può essere riconosciuta in seguito come fatta con Lolly. È un indizio duraturo, non una garanzia crittografica, ed è solo di presenza (non porta alcun dato personale). Viaggia in **PNG, JPG, WebP, AVIF, TIFF e BMP**, e nei raster renderizzati da Lolly composti in un **PDF o PPTX** - mai in un'immagine incorporata da *te*, solo in ciò che Lolly stesso renderizza. Deseleziona la scheda **Lolly Imprint** nel pannello di esportazione per saltarlo, oppure passa `imprint=0` in un link di condivisione. (La sopravvivenza dell'AVIF attraverso la ricodifica non è ancora calibrata; il rilevamento PDF/PPTX copre i raster Lolly incorporati.) [/verify](/verify) lo rileva sul dispositivo - vedi [Content Credentials Identity](/info/content-credentials-identity.html#the-lolly-imprint).

**La credenziale durevole.** Un secondo marchio, più pesante, si affianca all'Imprint: **Durable credential**, che usa un modello neurale sul dispositivo (formato TrustMark) per scrivere l'id di Lolly *nei* pixel così il legame "fatto con Lolly" sopravvive a una rimozione dei metadati, una ricodifica e una nuova lettura da parte di strumenti compatibili con TrustMark oltre che di Lolly stesso. È **disattivato per default** - a differenza dell'Imprint puro JavaScript, costa un passaggio neurale per esportazione più un download del modello una tantum, quindi è un opt-in deliberato e non una tassa silenziosa. Solo raster (**PNG, JPG, WebP, AVIF, TIFF**), spuntato nel pannello di esportazione o passato come `durable=1` in un link di condivisione. Nelle app desktop e mobile la scheda è nascosta del tutto anziché mostrata come no-op, perché non c'è un'origine da cui recuperare il modello offline.

**Protezione del contenuto.** Nel pannello di esportazione, *Password protect*, **C2PA Credentials**, il **Lolly Imprint** e la **Durable credential** si ripiegano in un unico gruppo **Content protection** collassato e sensibile al formato, così le opzioni di provenienza e protezione di un file vivono in un unico posto - il gruppo mostra solo le schede che si applicano al formato scelto, e si nasconde interamente quando nessuna di esse si applica. I segni di stampa non ne fanno deliberatamente parte: sono geometria di produzione di stampa e non protezione, quindi **Print marks & bleed** - la misura del bleed in millimetri più Crop, Registration, Bleed, Colour bars e Stamp details - mantiene la propria scheda di primo livello sui formati di stampa.

![Il gruppo Content protection aperto su un'esportazione PNG, che mostra solo le schede che si applicano ad essa](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

**Prima di esportare (print preflight).** Attiva **Print preflight** (`export-preflight`) nei feature flag del tuo Profilo - è **disattivato per default**, così chi esporta un PNG per un messaggio di chat non viene mai assalito da riscontri di prestampa, e un deployment con piano di controllo ([lolly.work](https://lolly.work)) può attivarlo per default per i suoi membri - e una scheda **Before you export** appare in fondo al pannello, subito sopra i pulsanti, ogni volta che le regole di stampa hanno qualcosa di vero da dire sul lavoro: formato, dimensione e bleed, poi aree di trim e bleed, copertura di inchiostro, conteggio lastre e conteggio pagine, con un verdetto accanto al suo titolo. Sta sotto ogni impostazione perché è un'affermazione *su* quelle impostazioni piuttosto che un'altra di esse - e non blocca mai un'esportazione. Ti dice cosa sta per vedere una tipografia.

**Costo, calcolato dal tuo listino prezzi.** Sotto il preflight - per ultima, ancora sopra i pulsanti - c'è una scheda che trasforma quegli stessi conteggi in denaro, e solo mai da prezzi che qualcuno le ha fornito. Legge tutto ciò che il passaggio di preflight ha contato, indipendentemente dal fatto che la scheda di preflight stessa sia attivata, e ha bisogno che due cose siano vere: il lavoro ha qualcosa che un listino prezzi può effettivamente quotare (lastre, fogli, area, pagine, righe di varianti o file di output - così un semplice logo PNG non la mostra mai), **e** è presente un **listino prezzi**. Un listino prezzi è un elenco prezzi JSON dalla tua tipografia. Una build predefinita non ne porta nessuno e non ha modo in-app di caricarne uno: arriva o come risorsa di catalogo che un deployment fornisce, o tramite l'estensione opzionale del listino prezzi che un self-hoster o un piano di controllo attiva. Senza un listino prezzi, non viene mostrato nulla - né un prompt, né una tabella vuota.

La regola su cui è costruito tutto questo è che **non inventa mai denaro**. Ogni cifra è una tariffa che hai fornito tu moltiplicata per una quantità che Lolly ha contato - `4 lastre × €35,00` - e il totale nomina la propria fonte nella stessa frase della cifra: l'emittente che il listino nomina, e la data in cui il listino dice che le sue tariffe sono valide. Non c'è valuta predefinita, nessun segnaposto e nessuno zero che sostituisca un prezzo mancante. Ciò che il file dice di sé stesso resta discorso riportato: *"Il file dice: … Lolly non lo ha verificato."*

E quando non può calcolare in modo onesto, la tabella di lavoro **scompare** anziché degradarsi in una cifra ingrigita o compilata:

- Le righe che il listino non prezza significano **nessun totale del tutto** - solo un titolo che dice quante di esse non sono prezzate. Una somma parziale non è una risposta più piccola, è una risposta sbagliata.
- Una quantità che è un tetto anziché un conteggio esatto porta **"up to"** fino nel suo subtotale, così un limite non viene mai riciclato in una cifra piatta.
- Le tariffe oltre la loro data di validità mostrano **solo conteggi**, finché non premi *Use these rates anyway* - e poi la data di scadenza viaggia insieme alla cifra, così un totale scaduto non può essere letto come uno attuale.
- Aperto tramite un **link**, il denaro resta nascosto finché non lo richiedi su questo dispositivo. Né la scheda né quella rivelazione viaggiano mai in un URL - lo stesso motivo per cui la CLI accetta `--rate-card=<file.json>` come flag di file locale e mai come parametro di link.

La scheda è chrome, mai contenuto: viene rimossa da ogni stadio di esportazione, quindi non può spostare un pixel del file che scarichi. Ed è aritmetica, non un preventivo - solo la tua tipografia può dartene uno.

**Render composti.** Quando uno strumento incorpora l'output di un altro strumento (es. un *Event Name Badge* che incorpora un *QR Code*), il render annidato viene inserito nell'esportazione del genitore - resta un **vero vettore** in SVG e PDF e viene rasterizzato in modo nitido in PNG/JPG/WebP. Il figlio incorporato è un intermedio: non riceve *nessun* watermark e *nessuna* provenienza propria; solo l'asset finito del genitore le riceve. (La composizione copre SVG e i formati raster; HTML/MD/TXT non possono essere composti.)

## Protezione con password

Due tipi di blocco indipendenti, entrambi interamente sul dispositivo.

**Password di apertura PDF** - la card *Proteggi con password* del pannello di esportazione offre due livelli:

![La card Proteggi con password espansa su un'esportazione PDF, con il campo password e i due livelli di blocco](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

- **Standard** - un blocco di base a 40 bit (RC4). Si apre in *qualsiasi* app PDF e - essendo un deterrente leggero, non una protezione reale - può viaggiare in un link di condivisione (in chiaro, di proposito). Solo `pdf` RGB.
- **Forte** - AES-256 (PDF 2.0). La password viene digitata al momento dell'esportazione e **non** viene mai inserita in un link; si apre solo nelle app PDF più recenti (Acrobat / Preview ~2018 in poi), e le app più vecchie potrebbero segnalare il file come danneggiato. Forte si applica anche ai **PDF Stampa / CMYK** e a **ogni PDF dentro uno zip batch** (la finestra di conferma del batch raccoglie la password). Poiché PDF/X-4 vieta la crittografia, un PDF Stampa bloccato con Forte mantiene il suo CMYK, i marchi di stampa e l'output intent ma perde la dichiarazione di conformità PDF/X-4.

Entrambi i livelli sono reciprocamente esclusivi con Content Credentials (un PDF crittografato non può ricevere la credenziale).

**Download bloccati (intero zip + difesa in profondità)** - un'esportazione **ZIP** (il formato *ZIP* del pannello di esportazione, che raggruppa più formati di uno strumento), un download **cartella** (Progetti → Scarica) o la **griglia batch** possono bloccare l'intero zip con una password, a due livelli:

- **Standard** - il tradizionale **ZipCrypto**: si apre in *qualsiasi* strumento di estrazione, incluso quello integrato di Windows Explorer, ma è debole (un deterrente). La sua password può viaggiare in un link di condivisione `?password=`.
- **Forte** - **AES-256** (WinZip AE-2): forte, ma **non** si apre con l'estrazione integrata di Windows Explorer - il destinatario ha bisogno di 7-Zip / WinZip / Keka / macOS. Digitata al momento dell'esportazione, mai inserita in un link.

La stessa card *Proteggi con password* nel pannello di esportazione gestisce sia i blocchi PDF sia quelli ZIP, riformulandosi in base al formato scelto. Un'unica password protegge **ogni** membro - immagini, SVG, tutto, PDF inclusi (solo il contenitore zip può proteggere i file non PDF, che non hanno un blocco proprio). Ed è **difesa in profondità**: qualsiasi PDF all'interno viene *anche* bloccato individualmente con AES-256 usando la stessa password, così un PDF resta bloccato anche dopo l'estrazione dallo zip. Il prompt appare quando avvii il download; una password vuota significa nessun blocco.

**Link di condivisione protetti da password** - qualsiasi link di condivisione può essere crittografato in modo che aprirlo richieda una password al destinatario. L'intero stato del link è crittografato con AES-256 sotto una chiave derivata dalla password (PBKDF2); viaggia solo il testo cifrato, quindi la **password non è mai nel link** e la decrittazione avviene **nel browser del destinatario** - il server che serve il link vede solo il testo cifrato nell'URL, mai la password né il design decifrato. Attivalo nella finestra **Condividi**. Un link crittografato può essere *aperto* solo in Lolly (non può essere incorporato come immagine, perché quel percorso non può chiedere la password). Vedi [URL Mode → Link crittografati](/info/url-mode.html).

## Content Credentials (C2PA)

Le esportazioni possono portare **Content Credentials** - un manifest [C2PA](https://c2pa.org) firmato incorporato nel file, che registra, in modo inviolabile, che il file è stato creato con Lolly e non è stato alterato da allora. È la versione basata su standard dei metadati di provenienza descritti sopra: un'asserzione crittografica (cosa ha creato il file, quando, da chi e dove) legata a un hash dei byte del file, così qualsiasi modifica successiva è rilevabile da un visualizzatore compatibile con C2PA. Lo standard è governato dalla [Content Authenticity Initiative](https://contentauthenticity.org) (Adobe, BBC, Microsoft, Nikon e altri), quindi le stesse credenziali che Lolly scrive sono quelle che fotocamere, redazioni e suite creative stanno adottando.

![La card C2PA Credentials, già selezionata, con la durata della credenziale accanto](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Formati.** Ogni contenitore con incorporamento C2PA: **PDF** (sia RGB che Stampa), **PNG / Animated PNG**, **JPG**, **GIF**, **SVG**, **TIFF** (RGB e Stampa), **WebP** (statico e animato), **AVIF**, **MP4**, **WebM** e i contenitori audio **MP3**, **WAV**, **M4A** e **OGG/Opus** - così una clip vocale registrata o sintetizzata viaggia con la stessa credenziale di un'immagine. Un bundle **ZIP** marca ogni membro supportato singolarmente, ed è anche lì che un **SVG animato** ne riceve una (è di base un normale documento SVG; un'esportazione diretta come SVG animato non offre una propria card). MP4, AVIF e M4A usano il binding BMFF della specifica e MP3 la sua mappatura ID3v2, così `c2patool` e altri visualizzatori compatibili con C2PA li verificano; **WebM** e **OGG/Opus** non hanno ancora una mappatura C2PA standardizzata, quindi Lolly porta il manifest come allegato Matroska e come campo OpusTags rispettivamente, che il verificatore di Lolly (e la CLI) controllano. (`ico`, `eps`, `emf`, `dxf`, `bmp`, `pptx`, i formati Office e i formati testo/dati non hanno un contenitore C2PA.)
- **Attivo per impostazione predefinita.** La card **C2PA Credentials** nel pannello di esportazione è preselezionata per quasi tutti gli strumenti - deselezionala per saltare la credenziale su una singola esportazione (oppure passa `c2pa=off` in un link di condivisione). Uno strumento può disattivarla del tutto nel proprio manifest.
- **Cosa registra.** Lo strumento e l'app che hanno creato il file, l'orario della firma, la superficie di esportazione (famiglia del motore browser + famiglia del sistema operativo - volutamente grezza, mai un'impronta identificativa) e - solo quando *Profilo → Usa i miei dati* è attivo - il tuo nome e la tua email come autore del lavoro.
- **Cosa vedono i destinatari.** Gli strumenti di ispezione delle content credentials (app Adobe, `c2patool`, contentcredentials.org/verify) leggeranno il manifest e mostreranno l'asserzione. Poiché Lolly firma con una chiave generata **sul tuo dispositivo** - non un certificato da un elenco di fiducia - i visualizzatori la segnalano come credenziale *non verificata*. La struttura e l'inviolabilità sono reali; è solo l'identità del firmatario a non essere garantita da un'autorità. Per aggiornare questo aspetto, puoi registrare un'**identità verificata** (Profilo → Content Credentials): un certificato a breve durata dalla CA di Lolly lega la tua email alle tue esportazioni mentre la chiave di firma non lascia mai il tuo dispositivo - vedi [Content Credentials Identity](/info/content-credentials-identity.html).
- **Verificare un file.** Lolly verifica anche le proprie credenziali: trascina un qualsiasi file su [/verify](/verify) (oppure esegui `lolly validate <file>` nella CLI) per un rapporto sul dispositivo - che indica in primo luogo se il file è stato effettivamente creato con Lolly e non modificato da allora. La vista Verify sul web va ben oltre la credenziale: segnala i **contenuti generati dall'IA**, rileva l'**Imprint di Lolly**, controlla le firme **SEAL** e (opzionale) i watermark a pixel di terze parti e mostra i **dati nascosti** - tutto sul dispositivo, nulla viene caricato. Vedi [Content Credentials Identity → Oltre la credenziale](/info/content-credentials-identity.html#beyond-the-credential-what-else-verify-shows).
- **Privacy.** Tutto avviene sul tuo dispositivo: la chiave di firma viene creata per l'esportazione e non lascia mai il browser, nulla viene caricato e l'asserzione contiene solo ciò che i metadati di provenienza già trasportano. Le utility per la privacy (trasformazioni sul dispositivo dei *tuoi* file) non aggiungono mai credenziali, e *Rimuovi dati nascosti* rimuoverà un manifest C2PA come qualsiasi altro metadato incorporato.
- **Interazioni.** Per i PDF, Content Credentials e la **protezione con password** (a entrambi i livelli - vedi sopra) sono reciprocamente esclusive (un PDF crittografato non può ricevere l'allegato della credenziale). La credenziale viene aggiunta come passo finale sui byte completati - dopo la marcatura DPI/EXIF/profilo colore, i metadati PDF/X e i marchi di stampa.

## Su telefono

I controlli di esportazione si trovano dietro il pulsante flottante **Render**, che apre il foglio **Esporta** - stessi formati, dimensioni, copia, download e condivisione, dimensionati per il tocco.

## Riferimento formati

Ogni id che l'host può rendere, raggruppato. Questi sono anche i valori per il parametro URL `format=` e il flag CLI `--export=` - vedi [URL Mode](/info/url-mode.html) e [CLI](/info/cli.html). Uno strumento offre solo il sottoinsieme dichiarato dal suo autore, quindi il selettore è sempre più corto di questo elenco.

| Tipo | Id |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `tiff` (TIFF RGB) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vettoriale | `svg` · `svgz` (SVG compresso gzip) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (file di taglio) |
| Pagina e documento | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `scorm` (pacchetto corso SCORM, uno zip) · `penpot` (file di design Penpot) · `docx` (Word) · `odt` (OpenDocument Text) |
| Movimento | `gif` · `apng` (PNG animato) · `webp-anim` (WebP animato) · `svg-anim` (SVG animato) · `webm` · `mp4` |
| Audio | `wav` · `mp3` · `m4a` · `opus` |
| Testo e dati | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `css` · `scss` · `gpl` (palette GIMP) |
| Pacchetto | `zip` |

Alcuni id in più provengono dall'**hook di esportazione proprio di uno strumento** anziché dal percorso di rendering condiviso: `ase` (Adobe Swatch Exchange, da Palette Lab), `exr` e `hdr` (i raster ad alta gamma dinamica di Darkroom) e `ttf` / `otf` / `woff` (Font Convert). Scelgono un formato allo stesso modo - il selettore, `format=`, `--export=` - i byte vengono semplicemente costruiti dallo strumento. Font Convert è l'unica eccezione: trasforma un file di font che *tu* fornisci, quindi non c'è nulla che un URL nudo possa rendere.
