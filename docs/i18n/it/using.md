# Usare Lolly

Una guida pratica per *usare* davvero l'app - aprire uno strumento, lavorare sul canvas, esportare, salvare e condividere. Tutto qui gira **sul tuo dispositivo**: nessun account, nessun caricamento, nessuna connessione a internet dopo il primo caricamento.

> Sei nuovo qui? La [Guida rapida](/info/quickstart.html) ti fa creare qualcosa in pochi minuti, e [Lolly per gli operatori](/info/operators.html) copre l'installazione e la distribuzione dell'app; questa pagina riguarda come guidarla una volta aperta.

## Aprire uno strumento

La schermata iniziale è la **galleria** - tutti gli strumenti, raggruppati per categoria. Fai clic su una card per aprire lo strumento; se ci hai già lavorato, un pulsante **Continua** riprende la tua sessione più recente. Usa il campo di ricerca per filtrare per nome - oppure la [Ricerca](/info/search.html) dalla barra in fondo alle sei schermate di elenco (la galleria, Utility, Progetti, il Catalogo, la Dashboard e il Profilo), che raggiunge il tuo lavoro salvato, il catalogo e le tue impostazioni oltre agli strumenti. Dentro uno strumento la barra si fa da parte per lasciare spazio ai comandi dello strumento.

![La galleria degli strumenti - ogni strumento come card, raggruppati per categoria](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&filename=gallery&try=1)

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

![La tela libera di Design - l'artboard con il pasteboard circostante](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

**Capovolgi una selezione.** Clicca con il tasto destro su un riquadro qualsiasi e scegli **Capovolgi orizzontalmente** o **Capovolgi verticalmente** per specchiarlo sul posto, oppure premi `Shift+H` / `Shift+V` da tastiera - Shift, perché una `V` semplice è lo strumento Puntatore. Ogni riquadro selezionato si specchia sul proprio asse in un unico passaggio di annullamento, e lo specchiamento è una trasformazione vera, quindi rimane nell'SVG, nel PDF e nel PNG esportati e non solo sulla tela.

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

## Timeline (Sequence Studio)

![The timeline with the music clip selected: its strip runs along the bottom with Speed, Fades, Volume, Pan, EQ, Pitch, Normalize volume and the Effect slot](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dvideo%26_sel%3Dbed&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px!important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip)

**Sequence Studio** aggiunge il *tempo* al canvas libero. Ogni riquadro può iniziare in un momento preciso, durare per una certa lunghezza e animarsi in entrata e in uscita, e una timeline agganciata sotto l'area di disegno è dove li disponi. Aprilo e c'è già una sequenza in riproduzione - una card di titolo, una clip, una card finale, un lower-third e un tappeto musicale - così il modello è visibile prima ancora che tu cambi qualcosa.

![La timeline di Sequence Studio: il transport, il righello, una corsia di overlay, la riga di sequenza magnetica con le sue clip e chip di giunzione e la striscia Always on](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

Ci sono due tipi di riga, e la differenza è tutta l'idea:

- La **riga di sequenza** è *magnetica*. Le clip stanno una dopo l'altra senza spazi vuoti, e trascinarne una riordina la successione invece di lasciare un buco. Elimina una clip e le altre si richiudono. Questa è la tua spina dorsale.
- Le **corsie di sovrapposizione** sono libere. Un lower-third, un logo, una didascalia - qualsiasi cosa fluttui sopra la spina dorsale con un tempo tutto suo - ottiene la propria corsia e il proprio inizio.
- Sotto di esse, **Sempre attivo** raccoglie i riquadri senza alcuna temporizzazione: scenografia che è semplicemente presente per tutta la durata. Il `+` su un elemento lo promuove su una corsia; **Rendi sempre attivo** lo rimanda indietro.

![Il piano di lavoro: la tavola da disegno in primo piano al centro, la barra strumenti a sinistra e l'HUD dello zoom nell'angolo](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-stage)

Aprire la timeline le assegna la tastiera, così Spazio e i tasti freccia guidano la testina invece della pagina - e poiché si apre da sola su una composizione che ha già una temporizzazione, questo vale dal momento in cui Sequence Studio si carica.

> **[L'editor di sequenza](/info/sequence-editor.html)** approfondisce le quattro cose che decidono se il montaggio nel tempo risulta prevedibile: quale clip modifica un clic sul canvas, i fantasmi in onion-skin delle clip vicine, l'ambito della divisione e l'Unione che annulla un taglio e il ritaglio (comprese le scorciatoie da tastiera). Premi `?` con la timeline attiva per il foglio delle scorciatoie.

**Montaggio.** Trascina il centro di una clip per spostarla o riordinarla, trascina a pochi pixel da uno dei due estremi per ritagliarla e premi **Dividi alla testina** (o `S`) per tagliare una clip in due. La divisione richiede una clip con una **Lunghezza** reale e la testina un po' all'interno, quindi una clip senza fine definita (il tappeto musicale, per dirne una) non si può dividere. **Aggancia ai bordi** è attivo per impostazione predefinita e si aggancia ai bordi delle clip, alla testina e ai secondi interi, con Alt per ignorarlo. Ogni trascinamento è un unico passo di annullamento, e l'anteprima del trascinamento fa gli stessi calcoli della conferma, quindi quello che vedi mentre trascini è quello che ottieni.

Seleziona una clip e l'ispettore ti offre le stesse modifiche sotto forma di numeri: **Lunghezza**, **Taglia inizio** (quanto dentro la sorgente comincia), **Velocità** come una serie di moltiplicatori fissi da ×0,25 a ×4, **Anima in entrata** / **Anima in uscita** con le loro durate e **Disattiva audio clip**. Una clip sulla riga magnetica non ha un campo **Inizio**, ed è voluto - l'ordine appartiene alla riga, quindi la sposti trascinandola.

**Le transizioni** sono preset, non fotogrammi chiave: Dissolvenza, Pop, Crescita, Salita, Caduta, i quattro Scorrimenti, Zoom avanti e indietro, Inclinazione, Planata, Rotazione, Deriva o **Taglio (nessuna animazione)**. Le distanze si adattano all'oggetto, quindi lo stesso preset funziona bene sia su una card a tutto schermo sia su un piccolo badge. Tra due clip adiacenti sulla riga di sequenza c'è un **pulsante di giunzione**: fai clic e scegli **Taglio** o **Dissolvenza incrociata**, che si applica subito e si chiude. Riapri lo stesso pulsante per cambiare la **Lunghezza (ms)** e premi **Fatto**. Una dissolvenza incrociata viene memorizzata come una dissolvenza in uscita di una clip e una in entrata della successiva, e l'esportazione ricava da quella coppia la dissolvenza vera e propria - ecco perché una dissolvenza incrociata sembra due dissolvenze nell'anteprima e un vero passaggio di consegne nel file.

**Suono.** Aggiungi una clip **Audio** e vive sulla timeline come qualsiasi altra clip: forma d'onda, ritaglio, silenziamento. (Il tappeto generato incluso nella sessione predefinita è l'unica eccezione - viene sintetizzato al momento dell'esportazione, quindi la sua barra resta piatta e silenziosa finché non renderizzi.) Premi il microfono per **registrare una voce fuori campo** direttamente sulla timeline, con un conto alla rovescia e un misuratore di livello, e la ripresa viene salvata come tuo asset nel punto in cui hai iniziato. Premi la fotocamera accanto per **registrare un video** allo stesso modo: la ripresa viene ritagliata alla dimensione di esportazione dell'artboard mentre registra, così il piccolo riquadro con la tua immagine mostra esattamente ciò che finisce nella sequenza alla testina, a piena inquadratura - il modo per raccogliere la clip di un collega da un link condiviso. Musica, dialoghi e la colonna sonora di una clip finiscono tutti nel mix esportato. (La **traccia audio** del pannello di esportazione è un'altra cosa: un unico tappeto steso sotto l'intera clip, con dissolvenza e ducking. Le due convivono.)

**Renderizzarla.** Un'esportazione in movimento è un **composito deterministico**, non una registrazione dello schermo - ogni fotogramma viene decodificato, disegnato e codificato a un istante esatto, quindi il file non dipende dalla capacità della tua macchina di stare al passo, e non c'è un limite pratico di fotogrammi su MP4 o WebM. La durata la stabilisce la lunghezza della timeline, a meno che tu non ne digiti una. Le Content Credentials vengono apposte come in ogni altra esportazione. Un'esportazione statica ti dà il fotogramma alla testina, oppure un intero provino a contatto dal campo **Fotogrammi** accanto alla dimensione di output - vedi [Esportazione](/info/exporting.html#stills-from-a-timed-composition).

Qualche limite da tenere a mente: una sequenza è limitata a un'ora, GIF e PNG animato mettono in buffer i propri fotogrammi e quindi restano brevi, l'audio è silenzioso su una clip la cui velocità non è ×1 (non c'è ancora il time-stretching) e **Registra dal vivo** è nascosto qui perché il compositore è la strada migliore.

**Oltre i preset: fotogrammi chiave, profondità e una camera.** Una transizione anima una clip al suo arrivo e alla sua uscita. Per posare un riquadro *all'interno* di una clip - farlo scorrere, dissolverlo, sfocarlo, sollevarlo dalla pagina e riassestarlo - aggiungi fotogrammi chiave: seleziona la clip, premi **+Fotogramma chiave** (il rombo nel gruppo di strumenti della timeline, il rombo nella barra oggetto della tela, oppure `K`), e la posizione della testina di riproduzione decide quale posa scrive la tua prossima modifica. Lo stesso sistema di fotogrammi chiave dà a ogni composizione temporizzata una **camera** che si avvicina, panoramica e mette a fuoco, e trasforma un SVG piatto in una pila di livelli tra cui puoi volare. **[Animare](/info/animating.html)** è la guida completa.

Lo strumento Design ha la stessa timeline, così puoi temporizzare un layout senza passare a un altro strumento, ed esporta anche il movimento.

## Presentare

![The inspector's Document section: Voice, Blend with, Speed, Lead-in, Tail and Show captions when presenting](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

Un documento Design fatto di **aree di disegno** è già una presentazione. Apri il **menu Lolly** sulla barra degli strumenti e scegli **Presenta** - l'ultima voce - e ogni area di disegno diventa una slide a schermo intero, nell'ordine in cui le aree di disegno stanno sul canvas. La presentazione gira su una copia delle aree di disegno renderizzate, quindi l'editor sottostante non viene mai toccato e uscendo torni esattamente dov'eri.

- **Avanza** con **Space**, `→`, **Page Down** o un clic sulla striscia sul bordo destro dello schermo; torna indietro con `←`, **Page Up** o la striscia sul bordo sinistro. **Home** e **End** saltano alla prima e all'ultima slide. Una piccola barra di controlli sfuma in vista ogni volta che muovi il puntatore e si nasconde di nuovo quando ti fermi.
- **Overview** (`O` o il pulsante griglia) dispone tutti gli artboard in una sola volta, nella disposizione che hai dato loro sulla tela; clicca su uno per aprirlo.
- **Passi di rivelazione.** Fai clic destro su un riquadro e scegli **Reveal at step 1**, **2** o **3** invece del predefinito **Always visible**. Quel riquadro allora attende finché non avanzi al suo passo, così una slide può arrivare a pezzi; i riquadri che condividono un numero arrivano insieme.
- **Speaker view** (`S`) apre una seconda finestra con la slide corrente, quella successiva, le tue note per quella slide e un orologio in corso. Se il browser blocca il pop-up, ripiega su un pannello sopra la presentazione. Le note sono impostate per artboard e non compaiono mai sulla slide stessa.
- `B` mantiene uno schermo nero (qualsiasi tasto riporta la slide), `F` torna a schermo intero e **Escape** toglie un livello alla volta: dalla panoramica torna alla presentazione, dalla presentazione torna all'editor.
- **Kiosk.** Assegna a un artboard una **Length** e la presentazione si ferma lì per quella durata, poi avanza da sola dietro una sottile barra di avanzamento; `K` (o il pulsante di pausa, che compare solo una volta che qualcosa ha una durata) la ferma e la riavvia. Aggiungi `kiosk` al link e la presentazione ricomincia dall'inizio una volta arrivata alla fine, il che è ciò che la rende segnaletica digitale.

La presentazione è anche un link. `?present` la apre direttamente, `s=` indica la slide - una posizione, l'id di un'area di disegno o `id.step` per un passo di costruzione - e l'indirizzo si aggiorna mentre ti sposti, così quello che invii è la slide su cui sei. Per gli autori di strumenti: quei parametri sono documentati nella pagina [Modalità URL](/info/url-mode.html#reserved-parameters).

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

## I tuoi dati e la tua foto

**Profilo** (in alto a destra nella galleria) contiene il tuo nome, i tuoi dati di contatto e una **foto** opzionale. Gli strumenti che richiedono quei campi li precompilano automaticamente - impostali una volta e la tua firma email, i lockup e i badge si completano da soli. Puoi comunque sovrascrivere qualsiasi campo per singola sessione. Attiva **Usa i miei dati per creare** così i tuoi dati viaggiano come autore su ciò che esporti.

La tua foto e i tuoi dati vivono **solo su questo dispositivo**. Un profilo può essere più di te soltanto - un team o un ruolo che indossi di tanto in tanto. Consulta **[Profili](/info/profile.html)** per il quadro completo, incluso come mantenerne più di uno.

## Salvare e continuare

Fai clic su **Salva** per memorizzare gli input attuali come sessione per quello strumento. Puoi mantenere più sessioni con nome per ogni strumento; il pulsante **Continua** di ogni strumento riapre la più recente, e il **pulsante cronologia** (in alto a destra, accanto al tuo profilo) elenca ogni sessione salvata di tutti gli strumenti. Le sessioni sono locali al dispositivo. Per organizzarle, apri **Progetti** (più sotto).

![La pillola di rendering divisa in due - una freccia in su che apre il pannello di esportazione, e un segno di spunta che salva la sessione sul posto](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

## Progetti

**Progetti** - aprilo dalla scheda **Progetti** accanto a **Strumenti**, oppure da **Profilo → Archiviazione → Organizza in Progetti** - è la casa di tutto quello che hai salvato, e funziona come un gestore di file:

![Progetti - sessioni salvate organizzate in cartelle annidabili](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)

- <!--i:folder--> **Cartelle annidabili.** Raggruppa le sessioni salvate in cartelle, e cartelle dentro altre cartelle, quanto in profondità vuoi. Crea una cartella, rinominala o trascina un riquadro su un'altra cartella per spostarlo; un breadcrumb ti riporta indietro. Una cartella **Senza categoria**, sempre presente, contiene tutto ciò che non è ancora stato archiviato.
- <!--i:clock--> **Ordina come vuoi tu.** **Visualizza e ordina** offre **Nome**, **Data di aggiunta**, **Ultima modifica** (il predefinito) e, dentro una cartella, **Per strumento**. Le cartelle vengono sempre prima, qualunque sia l'ordinamento attivo - l'ordinamento dispone solo le sessioni e le cartelle all'interno del proprio gruppo.
- <!--i:document--> **Archivia subito il nuovo lavoro.** **Nuovo asset** ("Inizia una nuova creazione" alla radice, "Aggiungi a *cartella*" dentro una cartella) apre uno strumento e archivia automaticamente il suo primo salvataggio in quella cartella.
- <!--i:checklist--> **Selezione multipla (desktop).** Spunta la casella di un riquadro, trascina un rettangolo di selezione sullo spazio vuoto oppure usa **Shift/Cmd-clic**; fai **clic destro** su un riquadro per il suo menu contestuale. Poi agisci sull'intera selezione in una volta sola - lo stesso gesto e la stessa barra di azioni flottante funzionano nella galleria Strumenti, in Utility, nel Catalogo e in Progetti, non solo qui.
- <!--i:download--> **Renderizza un'intera cartella o selezione.** **Renderizza cartella** esporta ogni sessione salvata in una cartella - incluse le sue sottocartelle - come un unico `.zip` annidato. **Renderizza selezione** fa lo stesso per qualsiasi selezione multipla, e una singola sessione si renderizza direttamente nel proprio file. Non serve Batch/Pro.
- <!--i:link--> **Vai dritto al lavoro salvato di uno strumento.** Spunta uno o più strumenti nella galleria Strumenti e scegli **Vedi sessioni** dalla barra di selezione - Progetti si apre mostrando solo le sessioni create con quegli strumenti, con un **Cancella** per tornare alla vista completa.
- <!--i:link--> **Condividi una sessione salvata.** Fai clic destro su una sessione → **Condividi link** per copiare un link che la riapre con esattamente gli stessi input (la finestra di dialogo Condividi completa - vedi sotto).

![Il popover View and sort aperto in Progetti, con una riga per il tema, una scelta di View tra Preview o List e Name, Date added e Last modified sotto Sort](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
<!--
SHOT NOTE (misc-projects-sort): trigger button confirmed as
`.filter-fab.projects-viewopts` in views/projects.ts (openViewOpts() is bound
to `.projects-viewopts` specifically) - `.projects-viewopts` alone is the
more specific hook, so that's what drives the click. The popover it opens
(`.projects-viewmenu`, also confirmed directly in openViewOpts()) is body-
appended, not nested under the Projects root, so cropSelector finds it
regardless. "By tool" only appears inside a folder - this recipe captures at
the Projects ROOT (`url=/#/p`), so if the capture pass wants "By tool"
visible too, point url= at a real folder instead: the route is a path
segment, `/#/p/<folderId>` (confirmed in main.ts's hash router - `parts[0]
=== 'p'` reads `folderId` from `parts[1]`), not a query param. Caveat: a
folder has to already EXIST in the capture profile, which a per-shot fresh
context has none of.
Also: the popover is not sort-only. openViewOpts() writes a theme segment, a
"View" pair (Preview / List) and a sound segment around the Sort rows, so the
alt text names them - do not re-caption this as "the sort menu".
-->

**Quello che offre la barra di selezione** cambia un po' da vista a vista, perché non ogni azione ha senso ovunque:

- **Strumenti / Utility:** Preferito (o Rimuovi dai preferiti), Nascondi (o Mostra), Disponibile offline (o Rimuovi da offline), **Vedi sessioni** (il salto descritto sopra) e Copia link quando è selezionata esattamente una card.
- **Catalogo:** Preferito e Nascondi si applicano a qualsiasi selezione; Duplica, Scarica ed Elimina compaiono solo quando ogni elemento selezionato è un tuo caricamento - un asset condiviso del design system è un contratto permanente, quindi quei tre restano fuori portata anche in blocco.
- **Progetti:** **Renderizza selezione**, **Sposta in…**, **Nuova cartella**, **Elimina**, **Modifica insieme** quando la selezione è tra due e otto sessioni di un singolo strumento (le apre affiancate sotto un'unica barra laterale combinata) e **Modifica come foglio**, che apre invece l'intera selezione come righe nella griglia batch. Quest'ultima **non ha limiti di dimensione** e non le importa se le sessioni vengono dallo stesso strumento, quindi è la via di fuga quando una selezione è più grande o più eterogenea del due-a-otto di Modifica insieme.

> Una trappola di etichette: **Vedi sessioni** esiste solo quando qualcosa è *selezionato*. Il clic destro su una singola card non selezionata offre invece **N sessioni salvate**, che apre la finestra di cronologia di quello strumento invece di portarti in Progetti.

![Due card di strumenti selezionate nella galleria Strumenti, con la barra di selezione flottante che mostra 2 selezionati e offre Disponibile offline, Visualizza sessioni, Preferito e Nascondi](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery)
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
`projects` shot above already carries; revisit if the pipeline gains a
storage-seeding hook.
-->


## Condividere il tuo lavoro

Un design esce in uno di due modi: come link o come file. La finestra di dialogo Condividi offre entrambi. Aprila con **Condividi** nei controlli di esportazione; **Condividi link** su una sessione salvata in Progetti apre la stessa finestra per quella sessione.

### Il link

Ogni input viene catturato nell'URL della pagina, quindi un link *è* il design. In cima alla finestra c'è il link pronto da copiare, con sotto due sezioni compresse.

- **Opzioni del link** contiene **Link più corto** (un design grande produce un URL lungo, quindi questo comprime l'intero stato in un token compatto e ti mostra il risparmio in caratteri; la forma leggibile resta comunque sempre disponibile), **Proteggi questo link con password** (AES-256 sull'intero link, con la password che non ci finisce mai dentro) e **Fissa questa versione dello strumento** - il flag `_v`, che inchioda il link alla versione dello strumento che stai guardando, così un aggiornamento successivo non può cambiare ciò che renderizza.
- **Comportamento del link** è cosa succede quando il destinatario lo apre: schermo intero, il pannello di esportazione già espanso, download all'apertura con `&export` o copia negli appunti con `&copy`.

Incolla il link a un collega, salvalo nei preferiti o mettilo in un commit. (Dettagli completi: [Modalità URL](/info/url-mode.html).)

**Alcuni strumenti fanno del link l'intero prodotto.** Jump Page riunisce i tuoi link in un'unica pagina da distribuire - un link bio, un intervento a una conferenza, una vetrina. Non c'è niente da ospitare e nessun account dietro: la pagina è il link, quindi si apre tanto velocemente quanto l'URL viaggia. Nell'editor vedi la pagina finita accanto ai campi; chi apre il link la riceve a tutta larghezza, una scena per link man mano che scorre.

![Jump Page nell'editor - il titolo, tre scene di link ciascuna con la propria tinta, e un piè di pagina Made with Lolly, disposti come un'unica pagina sulla tela](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

**La finestra di dialogo dice cosa un link non può portare con sé.** Tre cose non stanno in un URL: un'immagine o un file che hai aggiunto da questo dispositivo, un valore di testo molto lungo o un elenco molto grande. Ognuna viene conteggiata mentre il link viene costruito. Se qualcosa è dovuto restare fuori, la finestra lo dice e ti indirizza al file qui sotto, invece di consegnarti un link che si apre senza l'immagine. Un link semplicemente *lungo* riceve una nota più leggera con il suo conteggio di caratteri, dato che la compressione può ancora salvare la lunghezza.

### Il file .lolly

**Scarica .lolly**, nella finestra di dialogo Condividi dello strumento in cui stai lavorando, scrive lo stesso design come file. Porta con sé la sessione salvata insieme alle immagini e ai file che hai aggiunto dal tuo dispositivo. Anche le opere del catalogo a cui il design attinge viaggiano dentro, così il file si apre completo su una macchina che non ha mai visto il tuo brand. Dove il tuo dispositivo ha un menu di condivisione, **Invia a…** passa quel file direttamente a esso (AirDrop, una condivisione Android) invece di salvarlo su disco.

Un `.lolly` è un normale zip. Rinominalo `.zip` e aprilo: le tue immagini sono sotto `assets/uploads/` e le opere del catalogo sotto `assets/catalog/`, ciascuna con il suo nome e la sua estensione reali, `manifest.json` le elenca tutte e un README in cima dice cos'è il file.

Tre cose spetta a te deciderle prima che parta:

- **Se il tuo nome viene incluso.** Il tuo nome, la tua email e la tua organizzazione vengono scritti nel file solo quando **Use my details to create** è attivo nel tuo profilo. Con questa opzione disattivata, il file registra solo che è stato creato con Lolly e quando - niente su di te.
- **Se l'immagine sotto licenza viene inclusa.** Gli asset con licenza e vincolati al brand vengono trattenuti per impostazione predefinita. Se il design ne usa qualcuno, la finestra di dialogo indica quanti sono e offre due pulsanti - *Download without them* o *Include and download* - perché includerli consegna i file veri e propri a chiunque apra il `.lolly`.
- **Se lo strumento viene incluso.** **Include the tool** impacchetta i file dello strumento stesso insieme al design, così si apre su un dispositivo che non ha quello strumento. Arriva selezionata per uno strumento personalizzato - un fork o uno strumento di brand privato che il destinatario probabilmente non ha - e deselezionata per uno strumento elencato nel catalogo firmato, poiché la sua copia proviene dalla stessa fonte. (Su una build senza catalogo firmato, ogni strumento conta come personalizzato e la casella parte selezionata.)

**Aprirne uno.** Trascina un `.lolly` sull'app: gli asset vanno nella tua libreria, la sessione va in Progetti e lo strumento si apre su di essa. Niente di tuo viene sovrascritto: la sessione arriva come un nuovo slot salvato, mentre un asset già presente su questo dispositivo viene riconosciuto tramite checksum e riutilizzato anziché duplicato. Ogni parte viene verificata rispetto ai checksum propri del file all'importazione, così una copia danneggiata durante il trasferimento viene rifiutata anziché importata a metà.

Se il file porta uno strumento che non hai, Lolly chiede prima che quello strumento possa girare: **Ti fidi di questo strumento?** ne indica il nome e l'autore e dice chiaramente che aprirlo esegue il codice dello strumento sul tuo dispositivo, con **Fidati e installa** come via per procedere. Rifiuta e il lavoro condiviso viene comunque salvato nei tuoi progetti, in attesa del giorno in cui aggiungerai lo strumento. (Un tipo di strumento non si può ancora caricare da fuori - quello il cui codice arriva come modulo - e viene respinto allo stesso modo.)

Un link e un file consegnano entrambi un'istantanea. Per lavorare sulla stessa sessione *nello stesso momento* insieme a qualcun altro - due dispositivi, nessun server, nessuna connessione a internet se siete sulla stessa rete - vedi [Lavorare insieme](/info/collaborate.html).

## Camera dal vivo (strumenti reattivi al movimento)

Ogni **Filtro** foto - Halftone, Scanline, Posterize, Voronoi cells, Colour treatment, Pixel stretch e Imperfections - mostra un pulsante **Vai in diretta** dove è disponibile una fotocamera. Attivalo e l'effetto segue la tua webcam fotogramma per fotogramma, così reagisce al movimento; puoi registrare il risultato in GIF, WebM o MP4. I fotogrammi vengono letti ed elaborati **sul tuo dispositivo** e non lo lasciano mai, e la fotocamera viene rilasciata nel momento in cui fermi o lasci lo strumento. (Anche qualsiasi selettore di immagini ha **Scatta una foto** per catturare un singolo fotogramma come immagine sul dispositivo.)

## Le mie immagini

Quando uno strumento ti permette di aggiungere un'immagine dal tuo dispositivo, questa viene conservata esattamente come è arrivata - così una Content Credential che porta con sé si verifica ancora - e salvata nella tua libreria personale **Le mie immagini** (sotto **Profilo → Archiviazione**). Solo un file davvero enorme chiede se tenerlo o ridimensionarlo. Riutilizzala in qualsiasi strumento. Per ripulire EXIF/GPS mentre le immagini entrano, attiva **Rimuovi i metadati dai file caricati** nel tuo profilo. Non c'è un tetto: la libreria è interamente locale ed è limitata solo dallo spazio del tuo dispositivo - gestisci o elimina le immagini da lì.

## Il Catalogo - la tua libreria di asset

Il **Catalogo** (`#/c`, oppure il segmento **Catalogo** dello switch Progetti · Strumenti · Utility · Catalogo in cima a ogni vista di elenco) raccoglie tutto ciò a cui i tuoi strumenti possono attingere - loghi di brand, immagini, audio e animazioni, raggruppati per tipo - ed è anche dove vivono i **tuoi file creativi**. Nessun server, nessuna console di amministrazione, nessuna pull request: è tutto sul tuo dispositivo.

![Il Catalogo - asset di brand, campioni e font, più i tuoi caricamenti](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=catalogue)

- <!--i:upload--> **Porta dentro i tuoi file.** Trascina qualsiasi immagine, SVG, clip audio, video, Lottie, PDF o presentazione PowerPoint nell'area di caricamento - o fai clic per scegliere - e arriva subito nel tuo catalogo, pronto nel selettore di asset di ogni strumento. Un PDF multipagina o un file `.pptx` chiede quali pagine o diapositive mantenere - ognuna diventa un asset SVG. Importa quanto vuoi; non esce mai dal tuo dispositivo.
- <!--i:star--> **Metti tra i preferiti ciò che usi spesso.** ★ un asset (o un colore del marchio) e viene fissato in cima a ogni selettore, così il tuo logo o colore abituale è a un clic di distanza.
- <!--i:folder--> **Metti in ordine.** Ricategorizza un asset in un altro gruppo, nascondi un asset di marchio condiviso che non usi (con **Mostra nascosti** per recuperarlo) o elimina direttamente i tuoi caricamenti. Lo stesso gesto di selezione multipla e la stessa barra di azione flottante di Progetti funzionano anche qui, quindi tutto questo si può fare su un'intera selezione alla volta.
- <!--i:layers--> **Stacca un video dal suo sfondo.** Apri i dettagli di un video o fai clic destro sulla sua card in un qualsiasi selettore di asset, e scegli **Rimuovi sfondo…** per salvare un'alternativa trasparente - un WebP o PNG animato con canale alfa reale. Scegli un **Metodo**: un **Modello sul dispositivo** ritaglia un soggetto da una scena affollata, oppure una **Chiave colore** ritaglia uno sfondo uniforme e ben illuminato come uno schermo verde o una parete semplice, con **Tolleranza**, **Morbidezza** e **Rimozione della sbavatura** per regolare il bordo. La chiave colore non richiede alcun download di modello né rete, quindi **Rimuovi sfondo** è disponibile su qualsiasi video ed è spesso più pulita su riprese nitide. Un controllo di **Risoluzione** (360, 480, 720 o 1080p, mai oltre la sorgente) scambia dettaglio con un file più piccolo e veloce. Viene eseguita come attività in background sul tuo dispositivo. Il ritaglio finito viene salvato accanto all'originale come proprio asset, e il Content Credential del video sorgente viaggia insieme come ingrediente. (Vedi [Generato una volta, renderizzato allo stesso modo](/info/ai-features.html) per capire perché rimuovere uno sfondo resta una semplice modifica.)

### Porta la tua palette e i tuoi font ovunque

Il pannello **Campioni** del Catalogo fa più che mostrare - fai clic su un colore per copiarlo, oppure **scarica l'intera palette del brand** nel formato che parla il tuo altro strumento:

- <!--i:code--> **Design token (JSON)**, **variabili CSS** o **classi CSS** - inserisci il brand direttamente in un foglio di stile o in una build;
- <!--i:palette--> **Adobe Swatch Exchange (.ase)** - caricalo in Illustrator o Photoshop;
- <!--i:pentool--> **Palette GIMP (.gpl)** - per GIMP o Inkscape.

![Il pannello Swatches - i cinque pulsanti di download della palette in alto, poi ogni colore del brand come chip copiabile](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

Il pannello **Font** elenca i caratteri del tuo brand con un **download** accanto a ciascuno, per installarli localmente o consegnarli a una tipografia. (La stanza Colori del [Brand Studio](/info/brand-studio.html) offre lo stesso download della palette.)

Gli asset sono una metà del percorso aperto e fai-da-te; l'altra è **creare i tuoi strumenti** - il canvas libero (Design, descritto sopra) ti permette di costruirne uno visivamente, senza scrivere codice.

## Suoni e accessibilità

Lolly punta a essere comodo da usare per tutti. L'interfaccia è navigabile da tastiera, i controlli personalizzati hanno etichette appropriate per gli screen reader e l'anteprima dal vivo di ogni strumento è esposta come una singola immagine etichettata che descrive cosa sta creando.

Un delicato strato di **suoni assistivi** conferma quello che fai - l'arrivo nella galleria, una verifica delle Content Credentials valida o non valida, la chiusura di un pannello, il cambio di un filtro. È **disattivato per impostazione predefinita**: attiva **Suono** ovunque compaia l'interruttore (il popover delle opzioni di ogni vista, oppure **Profilo**), e la scelta viene ricordata.

Quattro impostazioni di comfort facoltative stanno sotto **Profilo → Accessibilità**: **Riduci il movimento** (elimina le transizioni e i fronzoli dell'app), **Nascondi le anteprime colorate** (card della galleria pacate, con sole icone e testo, e miniature dei progetti più tranquille), **Contrasto elevato** (bordi, testo e anelli di focus più marcati) e **Testo grande** (caratteri dell'app più grandi - etichette, menu, testo dei pulsanti). Tutte e quattro calmano l'app *attorno* al tuo lavoro: non entrano mai nel canvas di uno strumento e non cambiano un pixel di ciò che esporti, e ciascuna è disattivata finché non la attivi tu. Dettagli completi in [Il tuo profilo → Accessibilità](/info/profile.html#accessibility).

Accanto all'interruttore Suono c'è la **Modalità Neurospicy** - una traccia di sottofondo opzionale e rilassante per la concentrazione, che suona piano mentre lavori. Attivarla apre un piccolo **dock del player** nell'angolo in basso che ti segue in tutta l'app; da lì puoi cercare e scegliere una traccia, saltare avanti e indietro, regolare il volume e ridurre a icona o chiudere il player. L'elenco delle tracce copre alcune categorie - brani procedurali *Lolly Sings*, loop e beat ambientali, i tuoi audio caricati e una manciata di stazioni **radio** internet dal vivo (queste richiedono una connessione; tutto il resto suona offline). È **disattivata per impostazione predefinita** e, come il Suono, viene ricordata tra sessioni e dispositivi. Disattivare il Suono silenzia anche la traccia di concentrazione.

## Archiviazione e privacy

Tutto viene memorizzato nel database locale del tuo browser (IndexedDB): il tuo profilo, le sessioni salvate, le immagini caricate e una cache dei contenuti del catalogo scaricati. **Profilo → Archiviazione** mostra l'utilizzo e ti permette di:

- <!--i:box--> **Svuota cache** - elimina i contenuti del catalogo scaricati (si risincronizzano al prossimo caricamento).
- <!--i:trash--> **Cancella tutti i miei dati** - elimina profilo, sessioni e immagini. *Non può essere annullato.*

![La card dello spazio di archiviazione su uno schermo largo come un telefono: ogni categoria di dati sul dispositivo nominata, con il pulsante Clear all my data in fondo](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Nessuno di questi dati locali viene trasmesso da nessuna parte - nessuna telemetria, nessun rendering nel cloud. L'elenco completo di ciò che l'app scarica o invia si trova nell'[Informativa sulla privacy](/info/privacy.html), e [Superficie server](/info/server-surface.html) inventaria i componenti server facoltativi.

## Passare a un altro dispositivo

Poiché tutto vive sul tuo dispositivo, **Profilo → Archiviazione → Passa a un altro dispositivo** ti permette di portare tutto su una seconda installazione - senza account, senza cloud:

- <!--i:download--> **Esporta i miei dati** scarica un unico `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (le parti del nome provengono dal tuo profilo e vengono omesse se non impostate; `<n>` è un contatore giornaliero così le esportazioni fatte lo stesso giorno non entrano in conflitto) contenente il tuo profilo, ogni sessione salvata (con la sua miniatura), le tue immagini caricate e le tue preferenze (tema, larghezza della barra laterale, statistiche di attività locale).
- <!--i:upload--> **Importa dati…** sull'altra installazione rilegge quel file. **Unisce**: qualsiasi elemento con lo stesso nome (il tuo profilo, uno slot di sessione, un'immagine) viene sostituito dalla copia importata; tutto il resto su quel dispositivo viene mantenuto. Le sessioni salvate si ricollegano automaticamente alle tue immagini importate.

La cache del catalogo non è inclusa - si riscarica da sola sul nuovo dispositivo. Il pacchetto è uno zip semplice (`manifest.json` + `profile.json` + `sessions.json` + `assets.json` + `assets/blobs/…` + `prefs.json`, id di formato `lolly-backup`), quindi sopravvive intatto a email, USB o AirDrop ed è lo stesso formato che ogni shell legge. Ogni parte ha un checksum, così un file danneggiato durante il trasferimento viene rilevato all'importazione invece di essere ripristinato a metà. (Specifica completa del formato: [Trasferimento dati](/info/data-transfer.html).)

## Importare un design (Figma, Penpot, Illustrator, InDesign)

Puoi portare un design esistente in Lolly e continuare a lavorarci: apri **Design**, fai clic su **Importa un design** nella barra degli strumenti del canvas e scegli un **.fig** o SVG di Figma, un **.penpot** di Penpot, un **.ai** / **.pdf** di Illustrator o un **.idml** di InDesign. I livelli diventano riquadri modificabili sul canvas libero - il testo resta riscrivibile, le immagini finiscono in **Le mie immagini** e la tipografia e i colori si conformano alle variabili globali di brand - poi il risultato si salva, si condivide e si renderizza come qualsiasi altra sessione. L'analisi avviene interamente sul tuo dispositivo. Dettagli completi: **[Importare un design](/info/design-import.html)**.

## Esportare

Consulta **[Esportazione e formati](/info/exporting.html)** per la storia completa - scegliere un formato, la dimensione di output e le unità di stampa, la trasparenza, il video e copia/condivisione. In breve: scegli un formato, imposta la dimensione se ti serve e **Scarica** (oppure **Copia** negli appunti).

## Modalità Batch (Pro)

Per gli utenti avanzati, **Batch** (collegato dalla galleria, protetto dietro il feature flag Pro, attivo per impostazione predefinita) renderizza molte varianti insieme - una griglia dove ogni riga è un insieme di input, esportati tutti insieme. Ideale per localizzare una card in una dozzina di lingue o generare ogni variante di dimensione in un solo passaggio. Compila le righe digitando, incollando direttamente da un foglio di calcolo o importando un CSV (puoi anche esportarne uno), e imposta formato, dimensione e nome del file di output per ogni riga. Salva un'intera griglia come **sessione batch** con nome che si riapre dalla galleria, e scarica ogni riga come un unico `.zip`.

![La barra degli strumenti Batch - nome dello zip, unità, DPI e il formato che ogni riga eredita, con Sessioni e Rendi a destra](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.pro-toolbar&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

Batch serve per generare **molte varianti di un template** in una volta sola. Per rirenderizzare sessioni che hai **già salvato**, usa **Progetti → Renderizza cartella / Renderizza selezione** (più sopra) - non serve Pro.

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

Lolly è una PWA. Dopo il primo caricamento funziona **offline** - installala dalla barra degli indirizzi del tuo browser (o *Aggiungi alla schermata Home* su mobile) per un'esperienza a schermo intero, simile a un'app. Si aggiorna da sola quando torni online.

Sugli aggiornamenti: se una vista non si carica subito dopo un aggiornamento (un pannello vuoto, un "failed to fetch" nell'angolo), ricarica la pagina una volta - l'app recupera la nuova versione senza problemi e il tuo lavoro, le sessioni e il marchio restano intatti. Salva tutto sul tuo dispositivo, non nella pagina.
