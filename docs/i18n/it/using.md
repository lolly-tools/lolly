# Usare Lolly

Una guida pratica per *usare* davvero l'app - aprire uno strumento, lavorare sul canvas, esportare, salvare e condividere. Tutto qui gira **sul tuo dispositivo**: nessun account, nessun caricamento, e nessuna connessione a internet necessaria per le schermate che hai già aperto.

> Sei nuovo qui? La [Guida rapida](/info/quickstart.html) ti fa creare qualcosa in pochi minuti, e [Lolly per gli operatori](/info/operators.html) copre l'installazione e la distribuzione dell'app; questa pagina riguarda come guidarla una volta aperta.

## Aprire uno strumento

La schermata iniziale è la **galleria** - tutti gli strumenti, raggruppati per categoria. Fai clic su una card per iniziare qualcosa di nuovo in quello strumento; [il lavoro salvato](#saving-continuing) si riapre da **Progetti**. Usa il campo di ricerca per filtrare per nome - oppure la [Ricerca](/info/search.html) dalla barra in fondo alle sei schermate di elenco (la galleria, Utility, Progetti, Risorse, la Dashboard e Impostazioni), che raggiunge il tuo lavoro salvato, le tue risorse e le tue impostazioni oltre agli strumenti. Dentro uno strumento la barra si fa da parte per lasciare spazio ai comandi dello strumento.

![Una card della galleria con navigazione di esempio e un'azione Nuovo](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Ogni strumento è una vista divisa: i **controlli** da un lato, un'**anteprima** dal vivo (il canvas) dall'altro. Cambia un controllo qualsiasi e l'anteprima si aggiorna all'istante.

![La vista divisa di uno strumento - la pila di controlli a sinistra, e il grafico a barre raggruppate in tempo reale che disegna a destra](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

> Alcuni strumenti (come **Design**) si aprono invece come **canvas libero** - una superficie priva di cornice, a manipolazione diretta, dove trascini, ridimensioni, ruoti e agganci riquadri di testo, forme e immagini e fai doppio clic per modificare il testo sul posto. Esporta attraverso lo stesso percorso di rendering di ogni altro strumento, quindi il canvas *è* il file. Consulta [Il canvas libero](#the-free-canvas-design) più sotto.

Due modi per plasmare la griglia e renderla quella che vuoi tu:

- <!--i:star--> **Metti una stella su ciò che usi.** Aggiungi una ★ a una card e ottiene un riquadro tutto suo in una striscia sopra la griglia - vedi [I tuoi preferiti](/info/favourites.html).
- <!--i:eyeoff--> **Nascondi uno strumento che non usi mai.** Fai clic destro su una card (oppure selezionane diverse e usa la barra di selezione) → **Nascondi strumento**. Sparisce dalla griglia, e da ciò che trovi digitando nella griglia; un riquadro grigio **Mostra strumenti nascosti (N)** proprio in fondo li rivela di nuovo, attenuati, ciascuno con **Mostra strumento** nel proprio menu. Nascondere riguarda solo la tua griglia - lo strumento si apre comunque da un link salvato o da un preferito, e per tutti gli altri resta esattamente dov'era.

![La fine della griglia Tools con gli strumenti nascosti rivelati: la card attenuata di QR Code Generator, e accanto il riquadro grigio che l'ha riportata in vista, che ora recita Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-bulk%3D%22hide%22%5D%3Bwait%3A300%3Bclick%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed it. The alt says so rather than quoting the resting
label the prose above already gives.
There is no standalone per-card "hide" button
(unlike the always-visible fav/pin corner icons) - Hide only exists inside a
tile's right-click menu or the bulk bar, both confirmed in views/gallery.ts.
The recipe goes the bulk-bar route since it needs no `|right` context-menu
step: tick the card (`[data-select="qr-code"]`, the same checkbox hook the
selection bullet under Projects uses), click the bar's Hide button
(`[data-bulk="hide"]` - the literal `data-bulk` value bulkBarHtml() writes,
confirmed in lib/bulk-bar.ts), then click the grey reveal tile
(`.gtile--hiddenbox`, confirmed in gallery.ts).
-->

Per agire su più card contemporaneamente, spunta la casella di ogni card, trascina un riquadro di selezione sullo spazio vuoto oppure usa **Shift/Cmd-click**, e appare una barra di selezione flottante. **Quello che offre la barra di selezione** cambia un po' da vista a vista, perché non ogni azione ha senso ovunque:

- **Strumenti / Utility:** Preferito (o Rimuovi dai preferiti), Nascondi (o Mostra), Disponibile offline (o Rimuovi dall'offline), **Visualizza sessioni** (apre Progetti mostrando solo le sessioni create con quegli strumenti) e Copia link quando è selezionata esattamente una card.
- **Risorse:** Preferito e Nascondi si applicano a qualsiasi selezione; Duplica, Scarica ed Elimina compaiono solo quando ogni elemento selezionato è un tuo caricamento - un asset condiviso del sistema di design è un contratto permanente, quindi questi tre restano disattivati anche in blocco.
- **Progetti:** vedi [Trova e recupera il tuo lavoro](/info/find-your-work.html#find-something-you-saved).

> Una trappola di etichette: **Visualizza sessioni** esiste solo quando qualcosa è *selezionato*. Il clic destro su una singola card non selezionata offre invece **N sessioni salvate**, che apre un elenco delle sessioni salvate di quello strumento, dove l'eliminazione è permanente, invece di portarti in Progetti.

![La barra di selezione della galleria per due strumenti, con Disponibile offline, Visualizza sessioni, Preferito e Nascondi](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
<!--
SHOT NOTE (misc-bulkbar-gallery): drive targets `[data-select="qr-code"]` /
`[data-select="gradient"]` - the `.tile-check[data-select="<ref>"]` checkbox button
confirmed directly in views/gallery.ts's card markup (the same attribute
cardMarkup gives every tile), so these two clicks tick both cards without
opening either tool.

SHOT NOTE (misc-sessions-by-tool, NOT PUBLISHED): the "View sessions" result
had a recipe of its own (`/#/p?tools=qr-code,d3`, views/projects.ts's
toolsBodyHtml()), dropped here because it has no `drive=` that can
manufacture its own content - a saved session isn't a click away, it has to
already exist, and build-docs-shots.ts gives every shot a fresh
`browser.newContext()`. It would publish an empty list. Same dependency the
`projects` shot (now on find-your-work.md) carries; revisit if the pipeline gains a
storage-seeding hook.
-->

### Chiedi a Lolly

Quando preferisci chiedere invece di cercare, **Chiedi a Lolly** (`#/ask`) prende una domanda scritta e restituisce **alla lettera** la sezione corrispondente di questa documentazione - le parole stesse delle guide, non un riassunto e non una generazione - citando la pagina da cui proviene e con accanto un link **Apri nella documentazione**. Sotto la risposta ci sono i punti dell'app che corrispondono alla stessa domanda: uno strumento, un'impostazione, un progetto salvato, ognuno come un pulsante che ti porta semplicemente lì.

La trascrizione è memoria di sessione: fai una domanda di approfondimento e il filo si costruisce mentre procedi, poi ricarica la pagina e riparte da zero. I risultati di ricerca portano in fondo una riga **Chiedi a Lolly: *la tua domanda*** - sotto i risultati concreti trovati dagli altri gruppi - che passa la domanda direttamente, così puoi iniziare nella barra e finire qui.

## Il canvas (anteprima)

L'anteprima mostra sempre esattamente ciò che verrà esportato.

**Desktop**

- **Zoom:** scorri con Cmd/Ctrl, oppure pizzica sul trackpad - lo zoom si centra sul puntatore.
- **Spostamento (pan):** tieni premuto **Spazio** e trascina, oppure trascina con il **pulsante centrale del mouse**. (I clic semplici restano liberi per cliccare sulle parti del design.)
- **Tastiera:** `0` = adatta alla finestra · `1` = 100% · `+` / `−` = zoom.
- **HUD dello zoom:** il piccolo controllo `−  NN%  +  Fit` nell'angolo. Fai clic sulla percentuale per alternare tra Adatta ↔ 100%.

![L'HUD dello zoom nell'angolo del canvas - meno, la percentuale dal vivo, più, Fit, poi gli interruttori di tema e audio](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

**Tocco**

- **Pizzica** per lo zoom, **trascina** per spostarti, **tocca due volte** per tornare all'adattamento.

**Clic per saltare a un controllo:** fai clic su un elemento qualsiasi del design e l'input corrispondente nella barra laterale riceve il focus e scorre fino a essere visibile - per un gruppo di righe ripetibili apre esattamente la riga su cui hai cliccato, così modificare ciò che vedi è a un tocco di distanza.

Un cambio di dimensione riporta sempre la vista a un adattamento pulito.

### Il canvas libero (Design)

Gli strumenti a canvas libero aggiungono una superficie di lavoro *intorno* all'area di disegno, come il tavolo di montaggio di un designer:

- **Preparazione fuori canvas.** Trascina un riquadro oltre il bordo della cornice e resta completamente **visibile e selezionabile** - parcheggia gli elementi di lato mentre organizzi la composizione, poi trascinali di nuovo dentro. Tutto ciò che si trova fuori dalla cornice viene **sfumato dolcemente**, così l'area di esportazione si distingue sempre a colpo d'occhio, e la cornice mantiene la sua ombra per segnare esattamente dove inizia il file.
- **Solo la cornice viene esportata.** Il file esportato è delimitato dall'area di disegno - qualsiasi cosa resti fuori (o la parte di un riquadro che sporge oltre il bordo) viene semplicemente ritagliata dall'output, sia nei formati raster sia in quelli vettoriali.
- **Rimpicciolisci oltre Adatta** (fino al 20%) per vedere l'intero tavolo di montaggio quando hai preparato elementi molto fuori dalla cornice.
- **Area di disegno ridimensionabile.** Cambiare le dimensioni di esportazione ridimensiona la cornice sul posto; i riquadri mantengono le loro posizioni, così puoi reinquadrare un layout intorno al contenuto esistente.
- **Prima di esportare.** La sezione Documento dell'ispettore controlla la struttura dei livelli salvata, poi legge il canvas assestato per individuare testo tagliato e contrasto di colore piatto. Chiede anche allo stesso registro di font usato dal tracciamento contorni SVG/PDF se ogni riga di testo ha byte di font incorporabili; gli sfondi a immagine e a gradiente vengono segnalati come controlli visivi invece di ricevere un punteggio di contrasto inventato.

![La tela libera di Design - l'artboard con il pasteboard circostante](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

**Capovolgi una selezione.** Clicca con il tasto destro su un riquadro qualsiasi e scegli **Capovolgi orizzontalmente** o **Capovolgi verticalmente** per specchiarlo sul posto, oppure premi `Shift+H` / `Shift+V` da tastiera - Shift, perché una `V` semplice è lo strumento Puntatore. Ogni riquadro selezionato si specchia sul proprio asse in un unico passaggio di annullamento, e lo specchiamento è una trasformazione vera, quindi rimane nell'SVG, nel PDF e nel PNG esportati e non solo sulla tela.

### Livelli e Ispettore

In **Livelli**, ogni area di disegno è un gruppo genitore comprimibile. Seleziona il suo nome per saltare lì, espandi i suoi livelli e seleziona o riordina gli oggetti all'interno di quell'area di disegno. Passa a **Pagine** per le miniature e l'ordine delle pagine. Le frecce spostano lungo l'elenco dei livelli; Sinistra torna all'intestazione dell'area di disegno.

L'**Ispettore** mette prima i controlli di testo o immagine per l'oggetto selezionato. Usa i chip delle opzioni per scelte rapide ed espandi **Advanced** per i dettagli di stile. Su telefono, apri **Ispettore** da **Altre azioni**. I controlli si aprono in un foglio; Escape o Indietro lo chiude mantenendo la selezione.

### Disegnare le tue forme (la penna)

Riquadri, cerchi e cornici arrotondate coprono la maggior parte dei layout. Quando ti serve una forma che non è in quell'elenco, disegnala: il pulsante **Penna** della barra (o il tasto `P`) ti mette in modalità disegno. Tre tasti singoli spostano tra le modalità - **`V`** torna al Puntatore, **`P`** per la Penna, **`N`** per lo strumento nodi (**Modifica punti**) - e il Puntatore è sempre la via d'uscita da qualunque modalità tu sia.

![La barra degli strumenti del canvas libero: una maniglia di trascinamento, il menu Lolly, poi Pointer, Add a box, Pen, Edit points, Line, Timeline, Artboards e Auto-arrange](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

- **Fai clic** per posizionare un punto. Con il tipo di curva predefinito, **fai clic e trascina** per estrarre le maniglie di quel punto, ed è così che disegni una curva invece di un angolo - tieni premuto **Alt** mentre fai clic per ottenere invece un angolo netto. (Con gli altri tipi di curva ogni punto posizionato è un angolo e il trascinamento non fa nulla; vedi **Tipo di spline** più sotto.)
- I punti si agganciano all'area di disegno e agli altri riquadri mentre li posizioni, tracciando le stesse guide di un normale trascinamento. Alt sopprime la griglia mentre disegni, e sia la griglia sia i bordi mentre poi trascini un punto.
- **Fai clic sul primo punto** per chiudere il tracciato e finire in una sola mossa. Altrimenti premi **Invio**, fai doppio clic o cambia semplicemente strumento - il disegno viene mantenuto, non buttato via.
- **Esc** agisce un gradino alla volta: la prima pressione abbandona il disegno e non scrive nulla, la seconda esce dalla penna.
- **Canc** mentre disegni elimina l'ultimo punto che hai posizionato.

Il risultato è un normale riquadro sul canvas. Spostalo, ridimensionalo, ruotalo, raggruppalo, allinealo, riordinalo, dagli un riempimento, un gradiente, un'ombra o un'opacità - un tracciato si comporta come ogni altro riquadro, e nessuno di quei controlli lo tratta in modo diverso.

Arriva anche già colorato. Il primo tracciato che disegni prende il riempimento e il tratto che il tuo brand assegna a un tracciato, e da lì in poi ogni nuovo tracciato prende **quello che hai usato per ultimo** - imposta un riempimento una volta e continua a disegnare, invece di ricolorare ogni forma. (In uno strumento il cui brand non dice nulla sui tracciati, un tracciato disegnato prende il tratto del colore con cui l'hai visto disegnare, così non è mai invisibile.)

**Modificare di nuovo i punti.** Fai doppio clic sulla forma (o usa **Modifica punti** sulla barra dell'oggetto) e i punti ricompaiono. Trascina un punto per spostarlo, trascina una maniglia per riorientarla, fai clic in un punto qualsiasi della curva per inserire un punto, seleziona con un rettangolo un gruppo di punti e premi Canc per rimuovere quelli selezionati. Un tracciato mantiene sempre almeno due punti, quindi non puoi cancellarlo per sbaglio fino a farlo sparire.

Il **Tipo di spline** decide che genere di curva passa per i tuoi punti, ed è la scelta che vale la pena capire:

| Tipo | Cosa fa |
|---|---|
| **Fluido (auto)** | L'impostazione predefinita. Calcola da sé la lunghezza delle maniglie, così un semplice clic-clic-clic dà una curva davvero fluida senza dover armeggiare con le maniglie. Se imposti una maniglia, questa fissa la *direzione* e la curva mantiene il controllo della lunghezza. |
| **Maniglie Bezier** | La penna classica. Le maniglie sono i punti di controllo, e inserire un punto non sposta mai la curva. |
| **Attraverso i punti** | Passa esattamente per ogni punto che hai posizionato, senza maniglie. |
| **B-spline** | Scorre vicino ai punti invece che attraverso di essi, per una forma più morbida. |
| **Linee rette** | Una polilinea. |

Passare un tracciato esistente a un tipo che calcola da sé le maniglie chiede prima conferma, perché le lunghezze delle maniglie che hai impostato non si possono recuperare - passare a **Maniglie Bezier** è sempre senza perdite. Durante il disegno non c'è nessuna richiesta: il cambio si applica direttamente alla bozza, e le maniglie che avevi già estratto se ne vanno con esso. Nei tipi che controllano le proprie maniglie, inserire un punto modifica leggermente la curva; con **Maniglie Bezier** no.

Ogni punto porta anche una regola di continuità, mostrata dalla sua forma sul canvas - quadrato per **Angolo** (le maniglie si muovono in modo indipendente), tondo per **Fluido** (le maniglie restano allineate), tondo con un anello per **Simmetrico** (allineate e di uguale lunghezza). Impostala per i punti selezionati e la curva la rispetta immediatamente.

![Due tracciati a penna renderizzati direttamente da un link: una curva a S con il solo tratto e una macchia chiusa e riempita](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

Un tracciato disegnato viaggia nel link come tutto il resto, quindi una forma che disegni si riapre da un link di condivisione e si renderizza in modo identico dalla CLI. Nulla di esso dipende dall'editor.

### Combinare le forme (operazioni sui tracciati)

Seleziona due o più forme, fai **clic destro** sul canvas (tocco con due dita su touch) e il menu offre le operazioni che ti aspetti da un programma di disegno:

- **Unione** le fonde in un'unica forma, mantenendo il colore di quella più in alto.
- **Sottrai** ritaglia dalla forma in basso tutto ciò che sta sopra.
- **Interseca** mantiene solo la sovrapposizione.
- **Escludi** mantiene tutto tranne la sovrapposizione.

Altre tre agiscono su una forma singola: **Contorno tratto…** trasforma un tratto in una forma riempita dello stesso contorno (utile quando vuoi mantenere uno spessore esattamente com'è stato disegnato), **Offset tracciato…** allarga la silhouette verso l'esterno o, con un numero negativo, la restringe verso l'interno e **Semplifica** ricostruisce un tracciato con meno segmenti a parità di forma.

![Una mezzaluna e un anello con un buco vero, entrambi prodotti da Sottrai](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=path-ops-boolean-result)

Il risultato è un nuovo tracciato che puoi continuare a modificare con la penna. I buchi sono buchi veri - un controllo **Regola di riempimento** nel pannello del tratto decide se i contorni sovrapposti si riempiono (*non-zero*) o bucano (*even-odd*).

Due cose che queste operazioni deliberatamente non fanno. **Rifiutano invece di distruggere**: chiedi di intersecare due forme che non si sovrappongono e ti viene detto che non c'è nulla da mantenere, e nulla cambia. E i riquadri di testo e immagine non hanno un contorno su cui lavorare, quindi vengono lasciati stare invece di essere approssimati dalla loro cornice. Un risultato combinato viene memorizzato come semplici curve Bezier, che è quello che fa anche un programma di disegno - il tipo di spline originale non sopravvive all'operazione.

### Scene 3D

Scegli **Scena 3D** dal menu di aggiunta sulla barra degli strumenti e trascina una cornice: 3D Studio si apre subito sul nuovo riquadro, e quello che imposti lì torna sul canvas. In ogni altro senso un riquadro di scena è un riquadro normale. Spostalo, ridimensionalo, ruotalo, dagli un'ombra, mettilo su una diapositiva o sulla timeline, e si comporta come tutti gli altri.

**Un riquadro di scena conserva la ricetta, non un'immagine.** Un riquadro immagine contiene un file già renderizzato; un riquadro di scena contiene un'unica impostazione, la scena stessa, scritta come la query di link propria di 3D Studio, con ogni valore ancora al predefinito dello studio omesso. Ecco perché una scena pesa circa cento byte invece dei pochi kilobyte che costa una ricetta intera, perché la stessa stringa funziona sia in un link di condivisione sia nella porta dell'editor, e perché un nuovo controllo dello studio non richiede alcuna modifica in Design. È anche il motivo per cui il riquadro si ri-renderizza alla dimensione e nel momento richiesti dal documento, invece di essere ingrandito a partire da un'immagine presa in precedenza. Le immagini che una scena usa restano asset e viaggiano per id, quindi un caricamento dentro una scena finisce in un file `.lolly` insieme al resto del documento.

**Modificala nello studio.** Seleziona il riquadro e l'Ispettore mostra una sezione **Scena 3D**: una riga che indica di cosa è fatta la scena, una seconda che indica il suo studio di illuminazione una volta che ne hai scelto uno, e un pulsante, **Modifica in 3D Studio**. Il pulsante apre lo studio sulla scena di quel riquadro con tutti i controlli che ha lo strumento. Applica, e la scena modificata viene riscritta come un unico passaggio, così un annulla riporta il riquadro alla scena da cui sei partito; chiudi lo studio senza applicare e nulla cambia. Tutto il resto del riquadro - la sua posizione sull'area di disegno, quanto è grande, la sua ombra, quando arriva su una diapositiva - resta nelle sezioni che ha sempre usato. Un riquadro di scena non porta un'immagine propria né una didascalia: la sua immagine viene dallo studio, e anche le sue parole si impostano lì.

**Una scena dal vivo, un poster su ogni altro riquadro.** Ogni riquadro 3D in un documento mostra un poster: un'immagine ferma della scena, disegnata fuori schermo attraverso il pool di rendering condiviso, alla dimensione occupata dal riquadro. Un documento con venti scene costa un solo contesto di disegno, non venti. Seleziona un riquadro di scena e diventa l'unica scena dal vivo del documento; deselezionalo e il fotogramma che era a schermo diventa il suo poster, così nulla salta. Solo una scena è dal vivo alla volta, e selezionare due riquadri di scena insieme lascia entrambi come poster. In questa versione la scena dal vivo serve per guardare, non per orbitare: cambia una scena tramite **Modifica in 3D Studio**. Un dispositivo che non può aprire un contesto grafico in virgola mobile mantiene il poster e spiega perché dentro il riquadro invece di mostrare un rettangolo vuoto, e il resto del documento non ne risente. Aprire un documento Design senza alcun riquadro 3D non carica alcun codice 3D.

**Sulla timeline**, un riquadro di scena segue la testina come una clip video: il suo inizio, il taglio d'inizio e la velocità muovono la scena lungo la propria animazione, e la durata della scena è quella impostata in 3D Studio, quindi accorciare un riquadro mostra meno scena invece di velocizzarla. Solo il riquadro di scena selezionato è dal vivo; ogni altro è un'immagine ferma, e un'immagine ferma non si può scorrere.

**In un'esportazione**, ogni scena viene disegnata di nuovo alla dimensione richiesta dal file, tramite lo stesso renderer usato dallo studio. Un video renderizza un fotogramma per scena a ogni momento; un PNG, SVG o PDF incorpora un'immagine per riquadro alla dimensione in pixel propria del riquadro. Niente viene fotografato dallo schermo, quindi un'esportazione non dipende da quale riquadro avevi selezionato. Una scena che non si può disegnare fa fallire l'esportazione e ti dice perché, con le parole stesse dello studio.

**Condividere una scena costruita sopra un tuo caricamento.** Un link di condivisione di un documento Design porta con sé, dentro una scena così com'è, un id di caricamento locale al dispositivo, mentre un riquadro immagine lo azzera. Quindi una scena la cui grafica o il cui modello è un file che hai caricato mostra il predefinito dello studio per quell'immagine sul dispositivo di un'altra persona, a meno che il documento non viaggi come file `.lolly`, che porta con sé i byte.

## Timeline (Sequence)

**Sequence** è la timeline di Design: aggiunge il *tempo* al canvas libero. Ogni riquadro può iniziare in un momento preciso, durare per una certa lunghezza e animarsi in entrata e in uscita, e una timeline agganciata sotto l'area di disegno è dove li disponi. Aprila e c'è già una sequenza in riproduzione - una card di titolo, una clip, una card finale, un lower-third e un tappeto musicale - così il modello è visibile prima ancora che tu cambi qualcosa.

![La timeline di Sequence: il transport, il righello, una corsia di overlay, la riga di sequenza magnetica con le sue clip e i chip di giunzione, e la striscia Sempre attivo](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

Ci sono due tipi di riga, e la differenza è tutta l'idea:

- La **riga di sequenza** è *magnetica*. Le clip stanno una dopo l'altra senza spazi vuoti, e trascinarne una riordina la successione invece di lasciare un buco. Elimina una clip e le altre si richiudono. Questa è la tua spina dorsale.
- Le **corsie di sovrapposizione** sono libere. Un lower-third, un logo, una didascalia - qualsiasi cosa fluttui sopra la spina dorsale con un tempo tutto suo - ottiene la propria corsia e il proprio inizio.
- Sotto di esse, **Sempre attivo** raccoglie i riquadri senza alcuna temporizzazione: scenografia che è semplicemente presente per tutta la durata. Il `+` su un elemento lo promuove su una corsia; **Rendi sempre attivo** lo rimanda indietro.

![Il piano di lavoro: la tavola da disegno in primo piano al centro, la barra strumenti a sinistra e l'HUD dello zoom nell'angolo](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-stage)

Aprire la timeline le assegna la tastiera, così Spazio e i tasti freccia guidano la testina invece della pagina - e poiché si apre da sola su una composizione che ha già una temporizzazione, questo vale dal momento in cui Sequence si carica.

> **[L'editor di sequenza](/info/sequence-editor.html)** approfondisce le quattro cose che decidono se il montaggio nel tempo risulta prevedibile: quale clip modifica un clic sul canvas, i fantasmi in onion-skin delle clip vicine, l'ambito della divisione e l'Unione che annulla un taglio e il ritaglio (comprese le scorciatoie da tastiera). Premi `?` con la timeline attiva per il foglio delle scorciatoie.

**Montaggio.** Trascina il centro di una clip per spostarla o riordinarla, trascina a pochi pixel da uno dei due estremi per ritagliarla e premi **Dividi alla testina** (o `S`) per tagliare una clip in due. La divisione richiede una clip con una **Lunghezza** reale e la testina un po' all'interno, quindi una clip senza fine definita (il tappeto musicale, per dirne una) non si può dividere. **Aggancia ai bordi** è attivo per impostazione predefinita e si aggancia ai bordi delle clip, alla testina e ai secondi interi, con Alt per ignorarlo. Ogni trascinamento è un unico passo di annullamento, e l'anteprima del trascinamento fa gli stessi calcoli della conferma, quindi quello che vedi mentre trascini è quello che ottieni.

Seleziona una clip e l'ispettore ti offre le stesse modifiche sotto forma di numeri: **Lunghezza**, **Taglia inizio** (quanto dentro la sorgente comincia), **Velocità** come una serie di moltiplicatori fissi da ×0,25 a ×4, **Anima in entrata** / **Anima in uscita** con le loro durate e **Disattiva audio clip**. Una clip sulla riga magnetica non ha un campo **Inizio**, ed è voluto - l'ordine appartiene alla riga, quindi la sposti trascinandola.

**Le transizioni** sono preset, non fotogrammi chiave: Dissolvenza, Pop, Crescita, Salita, Caduta, i quattro Scorrimenti, Zoom avanti e indietro, Inclinazione, Planata, Rotazione, Deriva o **Taglio (nessuna animazione)**. Le distanze si adattano all'oggetto, quindi lo stesso preset funziona bene sia su una card a tutto schermo sia su un piccolo badge. Tra due clip adiacenti sulla riga di sequenza c'è un **pulsante di giunzione**: fai clic e scegli **Taglio** o **Dissolvenza incrociata**, che si applica subito e si chiude. Riapri lo stesso pulsante per cambiare la **Lunghezza (ms)** e premi **Fatto**. Una dissolvenza incrociata viene memorizzata come una dissolvenza in uscita di una clip e una in entrata della successiva, e la dissolvenza vera e propria viene ricavata da quella coppia: la prima clip continua a essere riprodotta oltre il taglio e sfuma in uscita, mentre la successiva sfuma in entrata sotto di essa. L'anteprima e il file seguono la stessa regola, quindi quello che vedi alla giunzione è quello che esporti.

**Suono.** Aggiungi una clip **Audio** e vive sulla timeline come qualsiasi altra clip: forma d'onda, ritaglio, silenziamento. (Il tappeto generato incluso nella sessione predefinita è l'unica eccezione - viene sintetizzato al momento dell'esportazione, quindi la sua barra resta piatta e silenziosa finché non renderizzi.) Premi il microfono per **registrare una voce fuori campo** direttamente sulla timeline, con un conto alla rovescia e un misuratore di livello, e la ripresa viene salvata come tuo asset nel punto in cui hai iniziato. Premi la fotocamera accanto per **registrare un video** allo stesso modo: la ripresa viene ritagliata alla dimensione di esportazione dell'artboard mentre registra, così il piccolo riquadro con la tua immagine mostra esattamente ciò che finisce nella sequenza alla testina, a piena inquadratura - il modo per raccogliere la clip di un collega da un link condiviso. Musica, dialoghi e la colonna sonora di una clip finiscono tutti nel mix esportato. (La **traccia audio** del pannello di esportazione è un'altra cosa: un unico tappeto steso sotto l'intera clip, con dissolvenza e ducking. Le due convivono.)

**La striscia audio.** Seleziona qualsiasi clip che porta suono e si apre una striscia compatta sotto la timeline: un fader di **Volume**, **Pan** per la posizione stereo, un **EQ** a tre bande (**Basso**, **Medi**, **Alto**), un controllo di **Intonazione** che trasporta in semitoni mantenendo il carattere della voce, e **Normalizza volume**, che porta la clip alla sonorità di trasmissione (BS.1770) così una nota vocale bassa e una traccia alta restano a livello. Dove si incontrano due clip, **Dissolvenza incrociata** fonde la giunzione invece di tagliare. Uno slot **Effetto** esegue un'elaborazione sul dispositivo sulla clip - **Pulizia vocale** toglie il rumore d'ambiente e il sibilo da una registrazione. Anche i cambi di velocità mantengono l'intonazione: una clip rallentata o accelerata viene stirata nel tempo, non suona come uno scoiattolo. A ogni missaggio l'esportazione abbassa la musica sotto il parlato man mano che questo va e viene e mantiene l'intero programma sotto un limitatore di picco reale, così nulla clippa in uscita; una forma d'onda che avrebbe clippato viene disegnata con un avviso nel punto in cui accade.

![La timeline con la clip musicale selezionata: la sua striscia corre lungo il fondo con Velocità, Dissolvenze, Volume, Pan, EQ, Intonazione, Normalizza volume e lo slot Effetto](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fbx%3Dt1%252Ctext%252C200%252C140%252C1500%252C220%252C0%252Crect%252C16%252C%252C100%252C%252Ccontain%252Cnormal%252CVoiceover%252520session%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252Cseq%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1%252C%252Cfalse%252C%252C60%252C%252C%252C1%257Ea1%252Caudio%252C200%252C500%252C400%252C80%252C0%252Crect%252C16%252C%252C100%252Clolly%25252Floops%25252F3-am-echoes%252Ccontain%252Cnormal%252C%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252C%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1.3%252C%252Cfalse%252C%252C60%252C%252C%252C1%26_sel%3Da1&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px%21important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip&drive=click%3Abutton%3Ahas-text%28%22Inspector%22%29)

**Renderizzarla.** Un'esportazione in movimento è un **composito deterministico**, non una registrazione dello schermo - ogni fotogramma viene decodificato, disegnato e codificato a un istante esatto, quindi il file non dipende dalla capacità della tua macchina di stare al passo, e non c'è un limite pratico di fotogrammi su MP4 o WebM. La durata la stabilisce la lunghezza della timeline, a meno che tu non ne digiti una. Le Content Credentials vengono apposte come in ogni altra esportazione. Un'esportazione statica ti dà il fotogramma alla testina, oppure un intero provino a contatto dal campo **Fotogrammi** accanto alla dimensione di output - vedi [Esportazione](/info/exporting.html#stills-from-a-timed-composition).

Qualche limite da tenere a mente: una sequenza è limitata a un'ora, GIF e PNG animato mettono in buffer i propri fotogrammi e quindi restano brevi, una clip riprodotta più velocemente o più lentamente mantiene la propria intonazione (la striscia audio la stira nel tempo, e un controllo di **Intonazione** trasporta in semitoni mantenendo il carattere della voce) e **Registra dal vivo** è nascosto qui perché il compositore è la strada migliore.

**Oltre i preset: fotogrammi chiave, profondità e una camera.** Una transizione anima una clip al suo arrivo e alla sua uscita. Per posare un riquadro *all'interno* di una clip - farlo scorrere, dissolverlo, sfocarlo, sollevarlo dalla pagina e riassestarlo - aggiungi fotogrammi chiave: seleziona la clip, premi **+Fotogramma chiave** (il rombo nel gruppo di strumenti della timeline, il rombo nella barra oggetto della tela, oppure `K`), e la posizione della testina di riproduzione decide quale posa scrive la tua prossima modifica. Lo stesso sistema di fotogrammi chiave dà a ogni composizione temporizzata una **camera** che si avvicina, panoramica e mette a fuoco, e trasforma un SVG piatto in una pila di livelli tra cui puoi volare. **[Animare](/info/animating.html)** è la guida completa.

Lo strumento Design ha la stessa timeline, così puoi temporizzare un layout senza passare a un altro strumento, ed esporta anche il movimento.

## Presentare

Per posizionare la tua fotocamera, un logo e una didascalia con il tuo nome sopra l'immagine del pubblico, usa **Present with camera**. I suoi controlli privati, le scene salvate, i passaggi di condivisione e registrazione sono trattati in [Presentare con la fotocamera](/info/presenting.html). I normali controlli del deck qui sotto restano disponibili tramite **Presenta**.

Un documento Design fatto di **aree di disegno** è già una presentazione. Apri il **menu Lolly** sulla barra degli strumenti e scegli **Presenta** - l'ultima voce - e ogni area di disegno diventa una slide a schermo intero, nell'ordine in cui le aree di disegno stanno sul canvas. La presentazione gira su una copia delle aree di disegno renderizzate, quindi l'editor sottostante non viene mai toccato e uscendo torni esattamente dov'eri.

- **Avanza** con **Space**, `→`, **Page Down** o un clic sulla striscia sul bordo destro dello schermo; torna indietro con `←`, **Page Up** o la striscia sul bordo sinistro. **Home** e **End** saltano alla prima e all'ultima slide. Una piccola barra di controlli sfuma in vista ogni volta che muovi il puntatore e si nasconde di nuovo quando ti fermi.
- **Overview** (`O` o il pulsante griglia) dispone tutti gli artboard in una sola volta, nella disposizione che hai dato loro sulla tela; clicca su uno per aprirlo.
- **Passi di rivelazione.** Fai clic destro su un riquadro e scegli **Reveal at step 1**, **2** o **3** invece del predefinito **Always visible**. Quel riquadro allora attende finché non avanzi al suo passo, così una slide può arrivare a pezzi; i riquadri che condividono un numero arrivano insieme.
- **Speaker view** (`S`) apre una seconda finestra con la slide corrente, quella successiva, le tue note per quella slide e un orologio in corso. Se il browser blocca il pop-up, ripiega su un pannello sopra la presentazione. Le note sono impostate per artboard e non compaiono mai sulla slide stessa.
- `B` mantiene uno schermo nero (qualsiasi tasto riporta la slide), `F` torna a schermo intero e **Escape** toglie un livello alla volta: dalla panoramica torna alla presentazione, dalla presentazione torna all'editor.
- **Kiosk.** Assegna a un artboard una **Length** e la presentazione si ferma lì per quella durata, poi avanza da sola dietro una sottile barra di avanzamento; `K` (o il pulsante di pausa, che compare solo una volta che qualcosa ha una durata) la ferma e la riavvia. Aggiungi `kiosk` al link e la presentazione ricomincia dall'inizio una volta arrivata alla fine, il che è ciò che la rende segnaletica digitale.

- **Pile di sotto-diapositive.** Fai clic destro su un'area di disegno e scegli **Impila sotto la diapositiva precedente** e diventa un passaggio di quella diapositiva invece di una diapositiva a sé: la panoramica mostra una sola card, la presentazione attraversa la pila in ordine, e la riga **Pila** dell'ispettore dice a quale diapositiva appartiene.
- **Morph.** Quando due diapositive consecutive portano entrambe un riquadro con lo stesso nome di **Abbinamento Morphing** (clic destro su un riquadro, oppure la riga **Abbinamento Morphing** dell'ispettore - `hero`, per esempio), la transizione sposta quel riquadro da dov'era a dov'è, ridimensionandolo e ricolorandolo lungo il percorso, invece di tagliare. Una transizione **Morph** per l'intera presentazione fa lo stesso per ogni coppia abbinata.
- **Narrazione.** Le **Note del relatore** di ogni area di disegno possono essere lette ad alta voce. Nella sezione **Documento** dell'ispettore scegli una **Voce**, facoltativamente una seconda voce da **Fondi con**, la **Velocità** di lettura, e un **Attacco** e una **Coda** in millisecondi intorno a ogni diapositiva; attiva **Mostra sottotitoli durante la presentazione** e le parole compaiono mentre vengono pronunciate. La voce viene eseguita sul tuo dispositivo. Le stesse note diventano il filmato in un'esportazione video, l'audio reale delle diapositive in un'esportazione PowerPoint, e il filmato narrato dentro un [pacchetto SCORM](/info/create/exporting.html#scorm-course-packages).

![La sezione Documento dell'ispettore: Voce, Fondi con, Velocità, Attacco, Coda e Mostra sottotitoli durante la presentazione](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

La presentazione è anche un link. `?present` la apre direttamente, `s=` sceglie la diapositiva - una posizione, l'id di un'area di disegno o `id.step` per un passo di costruzione - e l'indirizzo si aggiorna mentre ti sposti, così quello che invii è la diapositiva su cui sei. Per gli autori di strumenti: quei parametri sono documentati nella pagina [Modalità URL](/info/url-parameters.html#reserved-parameters).

## Su telefono

Su schermi stretti il layout si riorganizza su una colonna:

- I **controlli diventano un foglio** in alto con una **maniglia di trascinamento** sul bordo inferiore. Trascina la maniglia per ridimensionarlo - si aggancia a **intravisto / metà / pieno** - oppure **tocca** la maniglia per alternare tra compresso ↔ espanso. L'anteprima riempie lo spazio sottostante e resta visibile mentre modifichi.
- Un pulsante flottante **Esporta** apre il foglio di esportazione - tutti i controlli di formato, dimensione, copia, salvataggio e download in un unico posto. Chiudilo toccando lo sfondo.

![Uno strumento su uno schermo largo come un telefono - i controlli come foglio in alto, la palette generata che riempie l'anteprima sotto e la pillola di rendering che fluttua in basso al centro](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Controlli (input)

Gli strumenti espongono solo gli input pensati per variare - tutto il resto (colori, layout, tipografia, logica) è bloccato dall'autore dello strumento, così qualsiasi cosa tu crei rispetta le regole che ha stabilito. Gli input includono testo, slider, selettori di colore, menu a tendina, date, selettori di immagini e gruppi di righe ripetibili. Alcuni sono raggruppati in sezioni comprimibili.

![La colonna dei controlli di uno strumento - un campo di testo, i selettori di colore e uno slider e nient'altro, perché il resto l'autore ha scelto di bloccarlo](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Reset:** *Annulla modifiche* riporta ogni input ai suoi valori predefiniti.

### Annulla e ripeti

**Cmd/Ctrl-Z** torna indietro di un passo e **Cmd/Ctrl-Shift-Z** (o **Cmd/Ctrl-Y**) va di nuovo avanti. La stessa coppia si trova come pulsanti **Annulla** e **Ripeti** nella riga sopra i controlli - sul canvas libero stanno invece sulla barra degli strumenti - e ciascuno si disattiva quando non c'è più nulla da recuperare. Ogni passo dice cos'era: annulla un colore e un piccolo messaggio nomina l'input appena ripristinato, con dentro un pulsante **Ripeti** per tornare indietro.

- **Un trascinamento è un solo passo.** Le modifiche ripetute allo stesso controllo entro mezzo secondo si fondono, così tirare uno slider per tutta la sua corsa è un unico annullamento invece di duecento.
- **Vengono conservati gli ultimi 100 passi** - i più vecchi cadono dal fondo. Fare una nuova modifica dopo aver annullato svuota la pila in avanti, come succede ovunque.
- **Mentre il cursore è dentro un campo di testo**, Cmd/Ctrl-Z appartiene al campo stesso, carattere per carattere. Lolly prende il comando per i controlli che non hanno un annullamento proprio utile: slider, menu a tendina, colori e interruttori.
- **Scegliere un file** in un input **file** non è un passo - quei byte sono tenuti solo per la sessione, quindi non ci sarebbe nulla da rimettere a posto.

In una [collaborazione](/info/collaborate.html) dal vivo, la cronologia resta solo tua. Una modifica proveniente dall'altro dispositivo non finisce mai sulla tua pila, quindi annulla può recuperare solo qualcosa che hai fatto tu.

L'annulla arriva indietro solo fino all'inizio di questa visita; nove strumenti conservano anche le versioni precedenti sotto **Cronologia**, accanto ad **Annulla** (vedi [Torna a una versione precedente](/info/find-your-work.html#go-back-to-an-earlier-version)).

## I tuoi dati e la tua foto

**Impostazioni** (in alto a destra nella galleria, che mostra il tuo nome una volta impostato) contiene il tuo nome, i tuoi dati di contatto e una **foto** opzionale. Gli strumenti che richiedono quei campi li precompilano automaticamente - impostali una volta e la tua firma email, i lockup e i badge si completano da soli. Puoi comunque sovrascrivere qualsiasi campo per singola sessione. Attiva **Usa i miei dati per creare** così i tuoi dati viaggiano come autore su ciò che esporti.

La tua foto e i tuoi dati vivono **solo su questo dispositivo**. Un profilo può essere più di te soltanto - un team o un ruolo che indossi di tanto in tanto. Consulta **[Profili](/info/profile.html)** per il quadro completo, incluso come mantenerne più di uno.

## Salvare e continuare

Per conservare il tuo lavoro, premi **Salva come**, il segno di spunta accanto a **Esporta**. In **Save to a project**, lascia selezionata **La mia libreria** o scegli un progetto (**＋ Nuovo progetto…** ne crea uno), poi premi **Salva**. Salvare di nuovo aggiorna lo stesso elemento invece di crearne una copia. In Design, **Salva come** si trova nel menu sotto il logo Lolly; su telefono, premi **•••**, poi **Menu file**, poi **Salva come**.

Il pulsante **Salva** nel pannello di esportazione fa la stessa cosa con un clic e non scarica mai un file: il lavoro nuovo va in La mia libreria, e il lavoro che avevi già salvato viene aggiornato dove si trova.

Per tornare più tardi, premi **Home** in alto a sinistra, poi apri la scheda **Progetti** (un'icona a forma di cartella su telefono). I salvataggi in La mia libreria si trovano nella sua prima schermata; un progetto lì è una cartella. Gli elementi prendono il nome del file che hai digitato nel pannello di esportazione, oppure quello del loro strumento, come **QR Code**. Aprine uno e ogni impostazione è lì, pronta da modificare ed esportare di nuovo.

Il lavoro salvato resta su questo dispositivo, nel browser o nell'app da cui l'hai salvato, a meno che tu non attivi la [Sincronizzazione](/info/sync.html). Un file che ottieni con **Scarica** è una copia finita; per modificarlo più tardi, apri l'elemento salvato in Progetti. Se qualcosa non è dove te lo aspetti, vedi [Trova e recupera il tuo lavoro](/info/find-your-work.html).

![La pillola di rendering divisa in due metà - una freccia verso l'alto che apre il pannello di esportazione, e un segno di spunta etichettato Salva come che apre il foglio di salvataggio](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

## Progetti

**Progetti**, la scheda **Progetti** in cima alla schermata iniziale, contiene tutto ciò che hai salvato, nelle cartelle che crei. Trovare, ordinare e cercare il tuo lavoro lì, e ripristinare un elemento dal **Cestino**, sono trattati in [Trova e recupera il tuo lavoro](/info/find-your-work.html#find-something-you-saved).


## Condividere il tuo lavoro

Un design esce in uno di due modi: come link o come file. La finestra di dialogo Condividi offre entrambi. Aprila con **Condividi** nei controlli di esportazione; **Condividi link** su una sessione salvata in Progetti apre la stessa finestra per quella sessione.

### Il link

Ogni input viene catturato nell'URL della pagina, quindi un link *è* il design. In cima alla finestra c'è il link pronto da copiare, con sotto due sezioni compresse.

- **Link options** contiene **Open in the installed app** (cambia il campo in un URI `lolly://` per Shortcuts, launcher e automazioni, con ogni parametro invariato), **Shortest link** (un design grande produce un URL lungo, quindi questo comprime l'intero stato in un token compatto e ti mostra il risparmio in caratteri; la forma leggibile resta comunque sempre disponibile), **Password-protect this link** (AES-256 sull'intero link, con la password che non ci finisce mai dentro) e **Pin this tool version** - il flag `_v`, che inchioda il link alla versione dello strumento che stai guardando, così un aggiornamento successivo non può cambiare ciò che renderizza.
- **Link behaviour** è cosa succede quando il destinatario lo apre: schermo intero, il pannello di esportazione già espanso, download all'apertura con `&export` o copia negli appunti con `&copy`.

Incolla il link a un collega, salvalo nei preferiti o mettilo in un commit. (Dettagli completi: [Modalità URL](/info/url-mode.html).)

**Alcuni strumenti fanno del link l'intero prodotto.** Jump Page riunisce i tuoi link in un'unica pagina da distribuire - un link bio, un intervento a una conferenza, una vetrina. Non c'è niente da ospitare e nessun account dietro: la pagina è il link, quindi si apre tanto velocemente quanto l'URL viaggia. Nell'editor vedi la pagina finita accanto ai campi; chi apre il link la riceve a tutta larghezza, una scena per link man mano che scorre.

![Jump Page nell'editor - il titolo, tre scene di link ciascuna con la propria tinta, e un piè di pagina Made with Lolly, disposti come un'unica pagina sulla tela](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

**La finestra di dialogo dice cosa un link non può portare con sé.** Tre cose non stanno in un URL: un'immagine o un file che hai aggiunto da questo dispositivo, un valore di testo molto lungo o un elenco molto grande. Ognuna viene conteggiata mentre il link viene costruito. Se qualcosa è dovuto restare fuori, la finestra lo dice e ti indirizza al file qui sotto, invece di consegnarti un link che si apre senza l'immagine. Un link semplicemente *lungo* riceve una nota più leggera con il suo conteggio di caratteri, dato che la compressione può ancora salvare la lunghezza.

### Il file .lolly

`.lolly` è l'estensione del pacchetto portatile di Lolly, non una promessa che ogni file contenga la stessa cosa. Il `format` in `manifest.json` è l'autorità. L'app legge prima quel piccolo manifesto e mostra dimensione, contenuto e azione prima di scrivere qualsiasi cosa:

- Un **design condiviso** (`lolly-share`) contiene una sessione salvata di uno strumento, i suoi file incorporati e una ricevuta per tutto ciò che si risolve ancora per riferimento. Può anche portare con sé lo strumento e il sistema di design usati per crearlo. Aprirlo aggiunge un nuovo Progetto; non sovrascrive mai una sessione esistente.
- Un **progetto condiviso** (`lolly-share` con il tipo `project`) contiene una cartella da Progetti: le sue sottocartelle, ogni sessione salvata archiviata al loro interno, la miniatura di ciascuna sessione e le immagini archiviate lì. Aprirlo aggiunge una copia dell'intera cartella a Progetti; nulla di già presente viene sostituito. Un Lolly precedente all'esistenza dei file di progetto non può leggerne uno e chiede di aggiornare.
- Un **pacchetto di sistema di design** (`lolly-brand`) contiene token e può contenere font, loghi, versioni pubblicate e risorse trattenute. Aprirlo lo aggiunge come sistema di design a sé, con un proprio nome, e poi passa a esso; i sistemi già presenti sul dispositivo restano.
- Uno **spazio di lavoro del brand / pacchetto istanza** è un `lolly-brand` con strumenti dichiarati, asset di catalogo e, facoltativamente, un indirizzo di istanza. Il controllo preliminare elenca questi effetti a livello di dispositivo perché caricarlo sostituisce l'unica sovrapposizione di spazio di lavoro caricata in precedenza.

Un **backup completo del dispositivo o del profilo non è un `.lolly`**. Resta un `LollyTools-….zip` con formato `lolly-backup`, e si ripristina solo tramite **Impostazioni → Spazio di archiviazione**. Anche una semplice cartella di uno strumento compressa resta `.zip`. In altre parole, i pacchetti di sessione e di sistema di design possiedono `.lolly`; i flussi di backup e di archivio sciolto no.

**Download .lolly**, nella finestra di dialogo Condividi dello strumento in cui stai lavorando, scrive il design attuale come pacchetto di design condiviso. Porta con sé la sessione salvata insieme alle immagini e ai file disponibili su questo dispositivo. Viaggia anche l'opera del catalogo ordinaria. L'opera con licenza viene trattenuta a meno che tu non la includa esplicitamente, e un file obsoleto o non disponibile resta un riferimento esterno invece di sparire. La ricevuta preparata mostra la dimensione reale del `.lolly`, il conteggio dei file incorporati, il conteggio dei riferimenti esterni e se lo strumento è incluso. Dove il tuo dispositivo ha un menu di condivisione, **Invia a…** passa quel file direttamente a esso (AirDrop, una condivisione Android) invece di salvarlo su disco.

**Download project (.lolly)**, nel menu di una cartella dentro **Progetti**, scrive quella cartella come progetto condiviso, così qualcun altro può aprirla e continuare con ogni sessione che contiene. Ogni sessione viaggia come parte a sé (`sessions/<key>.json`, con la sua miniatura sotto `thumbs/`), l'albero delle cartelle è elencato in `manifest.json`, e i caricamenti e le opere di catalogo viaggiano secondo le stesse regole di un singolo design condiviso. Le sessioni batch non sono sessioni di uno strumento e restano indietro; l'avviso dice quante. **Scarica gli originali**, accanto ad essa, resta invariato: un semplice zip di ogni elemento come proprio file.

Un `.lolly` è un normale zip. Rinominalo `.zip` e aprilo: le tue immagini sono sotto `assets/uploads/` e le opere del catalogo sotto `assets/catalog/`, ciascuna con il suo nome e la sua estensione reali, `manifest.json` le elenca tutte e un README in cima dice cos'è il file.

Tre cose spetta a te deciderle prima che parta:

- **Se il tuo nome viene incluso.** Il tuo nome, la tua email e la tua organizzazione vengono scritti nel file solo quando **Use my details to create** è attivo nel tuo profilo. Con questa opzione disattivata, il file registra solo che è stato creato con Lolly e quando - niente su di te.
- **Se l'immagine sotto licenza viene inclusa.** Gli asset con licenza e vincolati al brand vengono trattenuti per impostazione predefinita. Se il design ne usa qualcuno, la finestra di dialogo indica quanti sono e offre due pulsanti - *Download without them* o *Include and download* - perché includerli consegna i file veri e propri a chiunque apra il `.lolly`.
- **Se lo strumento viene incluso.** **Include the tool** impacchetta i file dello strumento stesso insieme al design, così si apre su un dispositivo che non ha quello strumento. Arriva selezionata per uno strumento personalizzato - un fork o uno strumento di brand privato che il destinatario probabilmente non ha - e deselezionata per uno strumento elencato nel catalogo firmato, poiché la sua copia proviene dalla stessa fonte. (Su una build senza catalogo firmato, ogni strumento conta come personalizzato e la casella parte selezionata.)

**Aprirne uno.** Su un'app desktop o mobile installata, fai doppio clic o tocca un `.lolly`, scegli **Open with Lolly**, oppure invialo a Lolly dal menu di condivisione di sistema. macOS, Windows, Linux, iOS e Android registrano tutti il formato; i gestori file desktop lo mostrano come un documento Lolly (e GNOME Files può mostrare la miniatura propria di una sessione salvata). Nell'app web, usa **Apri** oppure trascina il file su Lolly. Ogni porta usa lo stesso controllo preliminare basato prima di tutto sul manifesto. Aprire da Brand Studio consiglia l'azione di sistema di design quando un design condiviso ne porta uno, ma non rietichetta mai il file né nasconde **Open shared design**.

Un documento iOS o Android consegnato da un'altra app è limitato a 48 MB, perché il passaggio nativo deve copiare i suoi byte oltre il confine tra le app. L'app mobile lo dice invece di ignorare in silenzio un file troppo grande. **Apri** dentro Lolly non usa quel passaggio; è la strada da provare per un pacchetto più grande.

Dopo la conferma, il lettore selezionato decomprime e verifica il pacchetto una sola volta. Gli asset di un design condiviso vanno nella tua libreria, la sua sessione va in Progetti e il suo strumento si apre quando disponibile. Le sessioni di un progetto condiviso vanno in Progetti sotto una nuova copia delle sue cartelle, con nuovi id così lo stesso file può essere aperto due volte, e la cartella si apre; una sessione il cui strumento manca su questo dispositivo attende lì. Un asset già presente sul dispositivo viene abbinato tramite checksum e riutilizzato. Un pacchetto di sistema di design viene memorizzato nel proprio namespace prima che l'app passi a esso. I file oltre i 100 MB sono segnalati come grandi, e il controllo preliminare avvisa quando lo spazio di archiviazione del browser indica meno spazio libero di quello richiesto dal payload dichiarato. Ogni parte coperta da integrità viene verificata prima che l'operazione venga confermata; una copia danneggiata viene rifiutata e la destinazione appena creata viene ripristinata.

Se il file porta uno strumento che non hai, Lolly chiede prima che quello strumento possa girare: **Ti fidi di questo strumento?** ne indica il nome e l'autore e dice chiaramente che aprirlo esegue il codice dello strumento sul tuo dispositivo, con **Fidati e installa** come via per procedere. Rifiuta e il lavoro condiviso viene comunque salvato nei tuoi progetti, in attesa del giorno in cui aggiungerai lo strumento. (Un tipo di strumento non si può ancora caricare da fuori - quello il cui codice arriva come modulo - e viene respinto allo stesso modo.)

Un link e un file consegnano entrambi un'istantanea. Per lavorare sulla stessa sessione *nello stesso momento* insieme a qualcun altro - due dispositivi, nessun server, nessuna connessione a internet se siete sulla stessa rete - vedi [Lavorare insieme](/info/collaborate.html).

## Camera dal vivo (strumenti reattivi al movimento)

Ogni **Filtro** foto - Halftone, Scanline, Posterize, Voronoi cells, Colour treatment, Pixel stretch e Imperfections - mostra un pulsante **Vai in diretta** dove è disponibile una fotocamera. Attivalo e l'effetto segue la tua webcam fotogramma per fotogramma, così reagisce al movimento; puoi registrare il risultato in GIF, WebM o MP4. I fotogrammi vengono letti ed elaborati **sul tuo dispositivo** e non lo lasciano mai, e la fotocamera viene rilasciata nel momento in cui fermi o lasci lo strumento. (Anche qualsiasi selettore di immagini ha **Scatta una foto** per catturare un singolo fotogramma come immagine sul dispositivo.)

## Le mie immagini

Quando uno strumento ti permette di aggiungere un'immagine dal tuo dispositivo, questa viene conservata esattamente come è arrivata - così una Content Credential che porta con sé si verifica ancora - e salvata nella tua libreria personale **Le mie immagini** (sotto **Impostazioni → Spazio di archiviazione**). Solo un file davvero enorme chiede se tenerlo o ridimensionarlo. Riutilizzala in qualsiasi strumento. Per ripulire EXIF/GPS mentre le immagini entrano, attiva **Rimuovi i metadati dai file caricati** nel tuo profilo. Non c'è un tetto: la libreria è interamente locale ed è limitata solo dallo spazio del tuo dispositivo - gestisci o elimina le immagini da lì.

## Risorse - la tua libreria

**Risorse** (`#/a`, oppure il segmento **Risorse** dello switch Strumenti · Utility · Risorse · Progetti in cima a ogni vista di elenco) raccoglie tutto ciò a cui i tuoi strumenti possono attingere - loghi di brand, immagini, audio e animazioni, raggruppati per tipo - ed è anche dove vivono i **tuoi file creativi**. Nessun server, nessuna console di amministrazione, nessuna pull request: è tutto sul tuo dispositivo.

![Risorse, con i campioni e i font del brand, e i tuoi caricamenti](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Porta dentro i tuoi file.** Trascina qualsiasi immagine, SVG, clip audio, video, Lottie, PDF o presentazione PowerPoint nell'area di caricamento - o fai clic per scegliere - e arriva subito in Risorse, pronto nel selettore di asset di ogni strumento. Un PDF multipagina o un file `.pptx` chiede quali pagine o diapositive mantenere - ognuna diventa un asset SVG. Importa quanto vuoi; non esce mai dal tuo dispositivo.
- <!--i:star--> **Metti tra i preferiti ciò che usi spesso.** ★ un asset (o un colore del marchio) e viene fissato in cima a ogni selettore, così il tuo logo o colore abituale è a un clic di distanza.
- <!--i:folder--> **Metti in ordine.** Ricategorizza un asset in un altro gruppo, nascondi un asset di marchio condiviso che non usi (con **Mostra nascosti** per recuperarlo) o elimina direttamente i tuoi caricamenti. Lo stesso gesto di selezione multipla e la stessa barra di azione flottante di Progetti funzionano anche qui, quindi tutto questo si può fare su un'intera selezione alla volta.
- <!--i:layers--> **Stacca un video dal suo sfondo.** Apri i dettagli di un video o fai clic destro sulla sua card in un qualsiasi selettore di asset, e scegli **Rimuovi sfondo…** per salvare un'alternativa trasparente - un WebP o PNG animato con canale alfa reale. Scegli un **Metodo**: un **Modello sul dispositivo** ritaglia un soggetto da una scena affollata, oppure una **Chiave colore** ritaglia uno sfondo uniforme e ben illuminato come uno schermo verde o una parete semplice, con **Tolleranza**, **Morbidezza** e **Rimozione della sbavatura** per regolare il bordo. La chiave colore non richiede alcun download di modello né rete, quindi **Rimuovi sfondo** è disponibile su qualsiasi video ed è spesso più pulita su riprese nitide. Un controllo di **Risoluzione** (360, 480, 720 o 1080p, mai oltre la sorgente) scambia dettaglio con un file più piccolo e veloce. Viene eseguita come attività in background sul tuo dispositivo. Il ritaglio finito viene salvato accanto all'originale come proprio asset, e il Content Credential del video sorgente viaggia insieme come ingrediente. (Vedi [Generato una volta, renderizzato allo stesso modo](/info/ai-features.html) per capire perché rimuovere uno sfondo resta una semplice modifica.)

### Porta la tua palette e i tuoi font ovunque

Il pannello **Campioni** di Risorse fa più che mostrare - fai clic su un colore per copiarlo, oppure **scarica l'intera palette del brand** nel formato che parla il tuo altro strumento:

- <!--i:code--> **Design token (JSON)**, **variabili CSS** o **classi CSS** - inserisci il brand direttamente in un foglio di stile o in una build;
- <!--i:palette--> **Adobe Swatch Exchange (.ase)** - caricalo in Illustrator o Photoshop;
- <!--i:pentool--> **Palette GIMP (.gpl)** - per GIMP o Inkscape.

![Il pannello Campioni - i cinque pulsanti di download della palette in alto, poi ogni colore del brand come chip copiabile](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

Il pannello **Font** elenca i caratteri del tuo brand con un **download** accanto a ciascuno, per installarli localmente o consegnarli a una tipografia. (La stanza Colori del [Brand Studio](/info/brand-studio.html) offre lo stesso download della palette.)

Gli asset sono una metà del percorso aperto e fai-da-te; l'altra è **creare i tuoi strumenti** - il canvas libero (Design, descritto sopra) ti permette di costruirne uno visivamente, senza scrivere codice.

## Suoni e accessibilità

Lolly punta a essere comodo da usare per tutti. L'interfaccia è navigabile da tastiera, i controlli personalizzati hanno etichette appropriate per gli screen reader e l'anteprima dal vivo di ogni strumento è esposta come una singola immagine etichettata che descrive cosa sta creando.

Un delicato strato di **suoni assistivi** conferma quello che fai - l'arrivo nella galleria, una verifica delle Content Credentials valida o non valida, la chiusura di un pannello, il cambio di un filtro. È **disattivato per impostazione predefinita**: attiva **Suono** ovunque compaia l'interruttore (il popover delle opzioni di ogni vista, oppure **Impostazioni**), e la scelta viene ricordata.

Quattro impostazioni di comfort facoltative stanno sotto **Impostazioni → Accessibilità**: **Riduci il movimento** (elimina le transizioni e i fronzoli dell'app), **Nascondi le anteprime colorate** (card della galleria pacate, con sole icone e testo, e miniature dei progetti più tranquille), **Contrasto elevato** (bordi, testo e anelli di focus più marcati) e **Testo grande** (caratteri dell'app più grandi - etichette, menu, testo dei pulsanti). Tutte e quattro calmano l'app *attorno* al tuo lavoro: non entrano mai nel canvas di uno strumento e non cambiano un pixel di ciò che esporti, e ciascuna è disattivata finché non la attivi tu. Dettagli completi in [Il tuo profilo → Accessibilità](/info/profile.html#accessibility).

Accanto all'interruttore Suono c'è la **Modalità Neurospicy** - una traccia di sottofondo opzionale e rilassante per la concentrazione, che suona piano mentre lavori. Attivarla apre un piccolo **dock del player** nell'angolo in basso che ti segue in tutta l'app; da lì puoi cercare e scegliere una traccia, saltare avanti e indietro, regolare il volume e ridurre a icona o chiudere il player. L'elenco delle tracce copre alcune categorie - brani procedurali *Lolly Sings*, loop e beat ambientali, i tuoi audio caricati e una manciata di stazioni **radio** internet dal vivo (queste richiedono una connessione; tutto il resto suona offline). È **disattivata per impostazione predefinita** e, come il Suono, viene ricordata tra sessioni e dispositivi. Disattivare il Suono silenzia anche la traccia di concentrazione.

## Archiviazione e privacy

Lolly conserva il tuo lavoro sul tuo dispositivo: nello storage proprio di questo browser nell'app web, e nello storage proprio dell'app nelle app desktop e mobili. Cosa viene conservato, cosa rimuove **Cancella tutti i miei dati** e cosa porta con sé la cancellazione dei dati del browser sono in [Trova e recupera il tuo lavoro](/info/find-your-work.html#if-you-clear-your-browser-data); l'[Informativa sulla privacy](/info/privacy.html) elenca tutto ciò che l'app scarica o invia, e [Superficie server](/info/server-surface.html) i componenti server facoltativi.

## Passare a un altro dispositivo

Per portare il tuo lavoro su un secondo computer o telefono, usa la Sincronizzazione, un file di backup o un file `.lolly`. [Sposta il tuo lavoro su un altro dispositivo](/info/find-your-work.html#move-your-work-to-another-device) confronta i tre e illustra **Esporta i miei dati** e **Importa dati…**.

## Importare un design (Figma, Penpot, Illustrator, InDesign)

Puoi portare un design esistente in Lolly e continuare a lavorarci: apri **Design**, fai clic su **Importa un design** nella barra degli strumenti del canvas e scegli un **.fig** o SVG di Figma, un **.penpot** di Penpot, un **.ai** / **.pdf** di Illustrator o un **.idml** di InDesign. I livelli diventano riquadri modificabili sul canvas libero - il testo resta riscrivibile, le immagini finiscono in **Le mie immagini** e la tipografia e i colori si conformano alle variabili globali di brand - poi il risultato si salva, si condivide e si renderizza come qualsiasi altra sessione. L'analisi avviene interamente sul tuo dispositivo. Dettagli completi: **[Importare un design](/info/design-import.html)**.

## Esportare

Consulta **[Esportazione e formati](/info/exporting.html)** per la storia completa - scegliere un formato, la dimensione di output e le unità di stampa, la trasparenza, il video e copia/condivisione. In breve: scegli un formato, imposta la dimensione se ti serve e **Scarica** (oppure **Copia** negli appunti).

## Modalità Batch (Pro)

Per gli utenti avanzati, **Batch** (collegato dalla galleria, protetto dietro il feature flag Pro, attivo per impostazione predefinita) renderizza molte varianti insieme - una griglia dove ogni riga è un insieme di input, esportati tutti insieme. Ideale per localizzare una card in una dozzina di lingue o generare ogni variante di dimensione in un solo passaggio. Compila le righe digitando, incollando direttamente da un foglio di calcolo o importando un CSV (puoi anche esportarne uno), e imposta formato, dimensione e nome del file di output per ogni riga. Salva un'intera griglia come **sessione batch** con nome che si riapre dalla galleria, e scarica ogni riga come un unico `.zip`.

![La barra degli strumenti Batch - nome dello zip, unità, DPI e il formato che ogni riga eredita, con Sessioni e Rendi a destra](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.pro-toolbar&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

Batch serve per generare **molte varianti di un template** in una volta sola. Per rirenderizzare sessioni che hai **già salvato**, usa **Progetti → Renderizza cartella / Renderizza selezione** (vedi [Trova e recupera il tuo lavoro](/info/find-your-work.html#find-something-you-saved)) - non serve Pro.

## Modificare affiancato (Multi-edit)

Batch sono molte varianti di *un solo* design. **Multi-Edit** è l'altra metà del lavoro: più design salvati **diversi** aperti contemporaneamente, così una modifica si applica a tutti loro. Seleziona tra **due e otto** sessioni salvate in **Progetti** e scegli **Modifica insieme** dalla barra di selezione; si aprono come card dal vivo affiancate su `#/multi?s=<slot>,<slot>…`. Ogni card è un render reale di quella sessione, non una miniatura salvata, quindi ciò che vedi è ciò che verrà esportato.

Un'unica barra laterale guida il tutto:

- <!--i:sliders--> In testa ci sono i **Condivisi** - ogni input che due o più delle sessioni selezionate dichiarano nello *stesso modo* (stesso id, stesso tipo, stessi vincoli - la stessa regola di fusione che la griglia batch usa sulle sue colonne). Modifica un controllo condiviso una volta e il valore si propaga a ogni sessione che lo dichiara, dal vivo su ogni card. Due sessioni dello stesso strumento condividono tutto; due strumenti diversi condividono quello che hanno in comune, e nient'altro.
- <!--i:document--> Sotto, **una card compressa per sessione** con tutti gli input propri di quella sessione, con la stessa fedeltà della barra laterale dello strumento - selettori di asset, gruppi di righe ripetibili, campi di colore - più un blocco di esportazione compatto: **Formato**, **W** / **H**, **Unità**, **DPI** e il proprio **Scarica**. Quel pulsante Scarica salva prima la sessione e poi la renderizza attraverso il consueto percorso di esportazione della sessione, così il file porta lo stesso nome, formato e Content Credentials che avrebbe direttamente dallo strumento.
- <!--i:search--> **Filtra i campi…** in cima restringe i controlli su *tutte* le card in una volta - ed è così che arrivi al "titolo" in otto sessioni senza doverlo cercare scorrendo.

Fai clic su un canvas qualsiasi (o premi Invio su di esso) e la card di quella sessione nella barra laterale si apre e scorre fino a essere visibile. **Salva tutto** riscrive ogni sessione nel proprio slot. **Scarica tutto** salva prima, poi renderizza l'intero gruppo attraverso la stessa pipeline di **Renderizza selezione** di Progetti - un solo zip, con il blocco con password facoltativo offerto lungo la strada.

Due limiti dichiarati apertamente. Il tetto da due a otto è reale: ogni card monta il proprio runtime dal vivo, e quello è il numero che resta reattivo - un link che ne chiede di più (o che chiede una sessione che non esiste più) lo dice invece di caricarsi a metà. E il link nomina i *tuoi* slot salvati, quindi riapre quel gruppo su questo dispositivo; non è un link di condivisione.

Quando la selezione è più grande di otto, mescola strumenti o comprende immagini oltre alle sessioni, la via di fuga è **Modifica come foglio** nella stessa barra di selezione: apre l'intera selezione come **righe nella griglia batch** (`#/pro?s=…`), senza limiti di dimensione e senza la regola dello stesso strumento. Le cartelle restano fuori da entrambe - hanno un proprio percorso di apertura nella griglia. ([Ricerca](/info/search.html) è l'unica cosa che qui ancora non arriva: Multi-edit è l'unica vista che la barra di ricerca non conosce.)

## Offline e installazione

Lolly è una PWA. Continua a funzionare **offline** nelle schermate che hai già aperto, e **L'app**, sotto **Impostazioni → Disponibile offline**, scarica il resto - installala dalla barra degli indirizzi del tuo browser (o *Aggiungi alla schermata Home* su mobile) per un'esperienza a schermo intero, simile a un'app. Si aggiorna da sola quando torni online.

Sugli aggiornamenti: se una vista non si carica subito dopo un aggiornamento (un pannello vuoto, un "failed to fetch" nell'angolo), ricarica la pagina una volta - l'app recupera la nuova versione senza problemi e il tuo lavoro salvato, le sessioni e il marchio restano intatti; solo un'immagine che hai aggiunto e mai salvato potrebbe dover essere aggiunta di nuovo. Salva tutto sul tuo dispositivo, non nella pagina.

Design e Darkroom possono mantenere la precisione originale dell'immagine con l'editing **Wide colour / HDR**, incluso il video di Sequence. I campioni di brand possono portare valori sRGB e P3 separati. Vedi [Editing colore ampio e HDR](/info/hdr-editing.html) per le scelte di output e i limiti attuali.
