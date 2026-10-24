# Design: la tela libera

Design è lo strumento per i layout che nessun template copre: un poster da zero, un deck di slide, un pezzo animato con una colonna sonora. Invece di un modulo di controlli, hai una tela di box che trascini, ridimensioni, ruoti e in cui scrivi. Esporta attraverso lo stesso percorso di rendering di ogni altro strumento, quindi ciò che vedi sulla tela è il file che ottieni.

Questa pagina percorre la tela dal primo box a un deck finito: la finestra, la modellazione dei box, il disegno di forme tue, l'inserimento di scene 3D e altri strumenti, l'aggiunta del tempo, il controllo del risultato e la presentazione del deck finito. [Usare Lolly](/info/using.html) tratta ciò che Design condivide con ogni strumento, come il salvataggio e la condivisione.

![La tela libera di Design - l'artboard con il pasteboard circostante](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

## La finestra di Design

La **barra superiore** inizia con **Home**, il **File menu** e il nome del documento (fai clic sul nome per rinominare il documento). Al centro ci sono **Undo**, **Redo**, **History**, i controlli di zoom (con **Fit all** e **Fit artboard**) e gli interruttori per **Timeline**, **Navigator** e **Inspector**. A destra si trovano **Share**, **Present** e **Export**. Su un telefono, i pulsanti meno usati passano in **More actions**.

La **barra degli strumenti** sul lato contiene il menu Lolly e gli strumenti con cui disegni: **Pointer**, **Add a box**, **Pen**, **Edit points**, **Line**, poi i pulsanti Timeline, Artboards e Auto-arrange.

![La barra degli strumenti del canvas libero: una maniglia di trascinamento, il menu Lolly, poi Pointer, Add a box, Pen, Edit points, Line, Timeline, Artboards e Auto-arrange](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

La tela funziona come il banco di lavoro di un designer attorno all'artboard:

- **Parcheggia i box fuori dall'artboard.** Trascina un box oltre il bordo del riquadro e resta visibile e selezionabile. Tutto ciò che sta fuori dal riquadro è sbiadito, e il riquadro mantiene la sua ombra per indicare dove inizia il file.
- **Si esporta solo l'artboard.** Tutto ciò che sta fuori dal riquadro, o la parte di un box che sporge dal bordo, viene tagliato dall'output sia nei formati raster sia in quelli vettoriali.
- **Riduci lo zoom oltre Fit** per vedere tutto ciò che hai parcheggiato.
- **Ridimensiona l'artboard** cambiando la dimensione di esportazione. I box mantengono le loro posizioni, così puoi reinquadrare un layout attorno a contenuti esistenti.

![La fase di modifica: l'artboard al centro, la barra degli strumenti a sinistra e l'HUD dello zoom nell'angolo](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&chrome=1&dark=1&filename=seq-studio-stage)

### Il Navigator e l'Inspector

Il **Navigator** elenca ogni artboard (con l'intestazione **Artboards**, o **Slides** in un deck) come un gruppo comprimibile dei suoi **Layers**. Seleziona il nome di un'artboard per saltarci, espandila per selezionare o riordinare i suoi livelli e usa i tasti freccia per muoverti nell'elenco; Sinistra torna all'intestazione dell'artboard. **Pages** raggruppa le artboard in pagine con nome, e scegliere una pagina cambia solo quali artboard mostra l'editor.

L'**Inspector** mette per primi i controlli di testo o immagine dell'oggetto selezionato. I chip di opzione coprono le scelte rapide, e **Advanced** contiene i dettagli di stile. Su un telefono l'Inspector si apre come pannello da **More actions**; Escape o Indietro chiude il pannello e mantiene la selezione.

![La sezione Document dell'Inspector: le schede Selection e Canvas, poi Dimensions e Style & look](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

## Ridimensiona, scala e ruota

Seleziona un oggetto, poi trascina una maniglia per cambiarne la dimensione, oppure trascina la maniglia rotonda sotto la selezione per ruotarlo. Un trascinamento di dimensione funziona in una di due modalità:

- **Resize**, quella predefinita, cambia solo il box. Il testo si ridispone sulla nuova dimensione, mentre corpo del font, spessore del tratto, raggio degli angoli ed effetti restano com'erano.
- **Scale** ingrandisce o riduce l'intero oggetto con il suo contenuto: corpo del font, tratto, raggio degli angoli, ombra, sfocatura, padding e spaziatura cambiano tutti della stessa quantità.

Premi `K` per attivare o disattivare Scale. Senza tastiera, scegli **Scale mode** nel menu Lolly, oppure tieni premuto il pulsante **Pointer** sulla barra (o fai clic destro sul pulsante) e scegli **Scale**; su un touch screen anche la barra dell'oggetto ha un interruttore Scale. Mentre Scale è attivo, il pulsante Pointer mostra l'icona Scale e ogni maniglia ha un punto al centro. `V` o **Escape** torna a Resize e mantiene la selezione. Ogni documento si apre con Scale disattivato, così nessuno scala i tratti per sbaglio.

**Scala con un numero.** Con Scale attivo, o con più oggetti selezionati, fai clic sull'indicatore nella barra dell'oggetto per aprire il popover **Scale**. Digita una percentuale, una larghezza o un'altezza, scegli il punto che resta fermo sulla griglia 3 x 3 e scegli **Apply**. Ogni scala è un unico passaggio di annullamento.

**Più oggetti.** Una selezione di più oggetti ha maniglie sui lati oltre che sugli angoli. Finché ogni oggetto è dritto o ruotato di quarti di giro interi, e la selezione non contiene gruppi né cerchi, trascinare un angolo cambia liberamente larghezza e altezza. Altrimenti la selezione mantiene le proporzioni e l'indicatore aggiunge **Proportional**. Mentre trascini, una piccola etichetta mostra la dimensione, o la percentuale in modalità Scale.

**Capovolgi una selezione.** Fai clic destro e scegli **Flip horizontal** o **Flip vertical**, oppure premi `Shift+H` o `Shift+V` (Shift, perché una `V` semplice è il Pointer). Lo specchio è una vera trasformazione, quindi l'SVG, il PDF e il PNG esportati mantengono il capovolgimento.

**I tasti che tieni premuti durante un trascinamento** hanno effetto nel momento in cui li premi o li rilasci; li elenca anche il foglio delle scorciatoie (`?`).

| Tieni premuto | Ridimensionare o scalare | Ruotare | Spostare |
|---|---|---|---|
| **Shift** | Mantiene le proporzioni (Scale lo fa sempre) | Ruota a passi di 15 gradi | Nessun cambiamento |
| **Alt** (Option) | Lavora dal centro | Ruota liberamente | Disattiva aggancio e griglia |
| **Cmd/Ctrl** | Disattiva aggancio e griglia | Ruota liberamente | Disattiva aggancio e griglia |

Senza tasti premuti, una rotazione viene attratta verso i 15 gradi più vicini quando arriva entro 4 gradi da essi. Le artboard non ruotano, quindi non hanno una maniglia di rotazione.

::: details Maniglie, zone di presa e tocco
**Afferra ovunque lungo un bordo.** Ogni lato di una selezione è una striscia di ridimensionamento lungo tutta la sua lunghezza, e con un mouse o una penna c'è una zona di rotazione appena fuori da ogni angolo. Il puntatore mostra cosa farà un trascinamento. Una pressione in una striscia o in una zona diventa un ridimensionamento o una rotazione solo quando inizi a trascinare, quindi un semplice clic seleziona come prima. Un oggetto bloccato non ha maniglie, strisce né zone.

**Gli oggetti piccoli restano spostabili.** Su un oggetto largo 25 pixel dello schermo o meno, le maniglie centrali si nascondono e le altre si spostano leggermente fuori dal contorno, quindi una pressione sull'oggetto lo sposta. A 10 pixel o meno scompaiono anche le maniglie d'angolo, e una linea sottile mantiene una maniglia a ciascuna estremità. Una pressione appena a lato di una linea sottile o di un oggetto minuscolo, lontano dalle sue maniglie, sposta l'oggetto.

**Ampie aree di presa.** Su un touch screen ogni zona d'angolo è un quarto della larghezza e dell'altezza della selezione sullo schermo, tra 24 e 44 pixel, e ogni zona laterale copre il tratto tra due angoli. Quando la selezione è troppo piccola per questo, le zone si spostano fuori dal contorno. La zona sotto il puntatore o il dito è ombreggiata. Per ottenere le stesse zone con un mouse o una penna, attiva **Large grab areas** nel menu Lolly; l'impostazione resta su questo dispositivo.

**Due dita su una selezione.** Su un touch screen, appoggia due dita su un oggetto selezionato: pizzica per scalare, ruota per girare o muovi entrambe le dita per trasportare la selezione, il tutto come un unico passaggio di annullamento. Con Scale attivo, un pizzico scala anche il contenuto; con Scale disattivo, ridimensiona in proporzione. Una rotazione si aggancia ai 15 gradi più vicini quando ci si avvicina, e uno spostamento a due dita non si aggancia mai. Il primo dito deve cadere sulla selezione e il secondo deve seguire rapidamente, sulla selezione o appena fuori dal suo bordo. Due dita altrove fanno zoom e spostamento della vista, così come due dita su una selezione che contiene un'artboard o un oggetto bloccato, copre gran parte della vista o supera il suo bordo.
:::

## Disegna le tue forme

Box, cerchi e riquadri arrotondati coprono la maggior parte dei layout. Per ogni altra forma, disegnala: il pulsante **Pen** della barra (o `P`) ti porta in modalità disegno. Tre tasti singoli passano da una modalità all'altra: `V` per il Pointer, `P` per la Pen e `N` per **Edit points**. Il Pointer è sempre la via d'uscita.

- **Fai clic** per posizionare un punto. Con il tipo di curva predefinito, **fai clic e trascina** per estrarre le maniglie del punto e creare una curva; tieni premuto **Alt** mentre fai clic per un angolo netto. (Con gli altri tipi di curva ogni punto è un angolo e il trascinamento non fa nulla.)
- I punti si agganciano all'artboard e agli altri box mentre li posizioni. Alt sopprime la griglia mentre disegni, e sia la griglia sia i bordi mentre trascini un punto in seguito.
- **Fai clic sul primo punto** per chiudere la forma. Altrimenti premi **Enter**, fai doppio clic o cambia strumento, e il disegno viene mantenuto.
- **Escape** funziona un passo alla volta: la prima pressione abbandona il disegno, la seconda lascia la penna.
- **Delete** durante il disegno elimina l'ultimo punto.

Il risultato è un normale box. Sposta, ridimensiona, ruota, raggruppa, allinea, riordina, riempi, ombreggia o sfuma il tracciato come qualsiasi altro box. Il primo tracciato prende il riempimento e il tratto che il tuo brand assegna a un tracciato, e ogni nuovo tracciato successivo prende ciò che hai usato per ultimo. In uno strumento il cui brand non imposta nulla per i tracciati, un nuovo tracciato viene tracciato nel colore con cui hai disegnato, così la forma non è mai invisibile.

**Modifica di nuovo i punti.** Fai doppio clic sulla forma, oppure usa **Edit points** nella barra dell'oggetto. Trascina un punto per spostarlo, trascina una maniglia per reindirizzare la curva, fai clic sulla curva per inserire un punto oppure trascina un riquadro attorno a più punti e premi Delete. Un tracciato mantiene sempre almeno due punti.

Il **tipo di spline** decide che tipo di curva passa per i tuoi punti:

| Tipo | Cosa fa |
|---|---|
| **Smooth (auto)** | Quello predefinito. Calcola da solo le lunghezze delle maniglie, quindi i semplici clic danno una curva morbida. Una maniglia che imposti fissa la direzione, e la curva resta padrona della lunghezza. |
| **Bezier handles** | La penna classica: controlli ogni maniglia, e inserire un punto non sposta mai la curva. |
| **Through the points** | Passa esattamente per ogni punto, senza maniglie. |
| **B-spline** | Scorre vicino ai punti anziché attraverso di essi, per una linea più morbida. |
| **Straight lines** | Una polilinea. |

Passare un tracciato esistente a un tipo che calcola da solo le maniglie chiede prima conferma, perché le lunghezze delle maniglie che hai impostato non si possono recuperare; passare a **Bezier handles** è sempre senza perdita. A metà disegno il cambio si applica subito, e le maniglie che avevi estratto vengono scartate.

Ogni punto porta anche una regola di continuità, mostrata dalla sua forma: quadrato per **Corner** (le maniglie si muovono indipendentemente), tondo per **Smooth** (le maniglie restano allineate) e tondo con un anello per **Symmetric** (allineate e di uguale lunghezza). Imposta la regola per i punti selezionati e la curva la segue subito.

![Due tracciati a penna renderizzati direttamente da un link: una curva a S con il solo tratto e una macchia chiusa e riempita](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

Un tracciato disegnato viaggia in un link di condivisione come qualsiasi altro box e viene renderizzato allo stesso modo dalla riga di comando.

## Combina forme

Seleziona due o più forme, fai clic destro sulla tela (tocco con due dita su touch) e scegli:

- **Union** le unisce in un'unica forma con il colore di quella più in alto.
- **Subtract** ritaglia dalla forma in basso tutto ciò che sta sopra.
- **Intersect** mantiene solo la sovrapposizione.
- **Exclude** mantiene tutto tranne la sovrapposizione.

Altre tre operazioni agiscono su una singola forma. **Outline stroke…** trasforma un tratto in un contorno pieno dello stesso spessore. **Offset path…** espande il contorno verso l'esterno o, con un numero negativo, lo restringe verso l'interno. **Simplify** ricostruisce un tracciato con meno segmenti mantenendo lo stesso contorno.

![Una mezzaluna e un anello con un vero foro, entrambi prodotti da Subtract](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D%26w%3D1080%26h%3D1080&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&filename=path-ops-boolean-result)

Il risultato è un nuovo tracciato che puoi continuare a modificare con la penna, memorizzato come semplici curve di Bezier, quindi il tipo di spline originale non viene mantenuto. I fori sono veri fori: il controllo **Fill rule** nel pannello del tratto decide se i contorni sovrapposti si riempiono (*non-zero*) o si bucano (*even-odd*). Le operazioni rifiutano piuttosto che distruggere: se chiedi di intersecare due forme che non si sovrappongono, non cambia nulla. I box di testo e di immagine non hanno un contorno, quindi vengono lasciati stare.

## Scene 3D e strumenti dentro un design

Un box può contenere più di un'immagine. Entrambi i tipi qui sotto conservano una ricetta anziché un'immagine renderizzata, quindi si ridisegnano alla dimensione e nel momento che il documento richiede, e un aggiornamento della sorgente raggiunge ogni design che la usa.

### Scene 3D

Scegli **3D scene** dal menu di aggiunta della barra e trascina un riquadro: 3D Studio si apre sul nuovo box, e ciò che imposti lì torna sulla tela. In seguito, **Edit in 3D Studio** nella sezione **3D scene** dell'Inspector riapre lo studio. [Place a scene in Design](/info/3d-studio.html#place-a-scene-in-design) tratta poster, timeline, esportazione e condivisione.

### Strumenti dentro un design

Scegli **Image** dal menu di aggiunta della barra, trascina un riquadro e scegli uno strumento nella scheda **Tools** del selettore. Lo strumento riempie il riquadro con i suoi valori predefiniti, e l'Inspector si apre su una sezione **Tool** con i controlli propri di quello strumento. Cambia un campo e il box si aggiorna un attimo dopo, come un unico passaggio di annullamento. **Image fit** e **Image position** funzionano come per qualsiasi immagine, e **Replace with another tool or image** sostituisce il contenuto del box.

**Gli strumenti in movimento** si riproducono dentro il box: un'illustrazione in loop continua a ripetersi sulla tela, segue il cursore di riproduzione una volta aperta la timeline ed esporta fotogramma per fotogramma in GIF, MP4 o WebM. Quando lo strumento dichiara la durata di un loop, il box riceve una clip esattamente di quella lunghezza, così un video contiene loop interi. Una clip a cui hai cambiato i tempi mantiene i tuoi tempi, e disattivare il movimento dello strumento fa tornare il box un'immagine fissa.

## Timeline (Sequence)

**Sequence** è la timeline di Design: aggiunge il tempo alla tela. Ogni box può iniziare in un momento, durare una certa lunghezza e animarsi in entrata e in uscita, e la timeline agganciata sotto l'artboard è dove li disponi. Parti dal template **Video** di Design e una breve sequenza è già pronta: due schede di testo temporizzate sulla riga della sequenza e un tappeto musicale procedurale sotto di esse, così puoi vedere come funziona la timeline prima di cambiare qualcosa.

![La timeline di Sequence: il transport, il righello, una corsia di overlay, la riga di sequenza magnetica con le sue clip e i chip di giunzione, e la striscia Sempre attivo](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

Ci sono due tipi di riga:

- La **riga della sequenza** è magnetica. Le clip stanno una dopo l'altra, trascinarne una riordina la sequenza ed eliminarne una chiude il vuoto. È la spina dorsale.
- Le **corsie di overlay** sono libere. Un terzo inferiore, un logo o una didascalia fluttua sopra la spina dorsale al proprio tempo, ciascuno nella propria corsia.
- Sotto di esse, **Always on** contiene i box senza tempi, presenti per tutta la durata. Il `+` su un chip ne sposta uno su una corsia; **Make always on** lo rimanda indietro.

Aprire la timeline le dà la tastiera, quindi Space e i tasti freccia guidano il cursore di riproduzione. Una composizione che ha già dei tempi apre la timeline da sola.

**Modifica.** Trascina il centro di una clip per spostarla, trascina vicino a una delle due estremità per rifilarla e premi **Split at playhead** (o `S`) per tagliarla in due. Split richiede una clip con una **Length** reale e il cursore di riproduzione un po' all'interno di essa, quindi una clip senza fine come il tappeto musicale non può essere divisa. **Snap to edges** è attivo per impostazione predefinita e aggancia ai bordi delle clip, al cursore di riproduzione e ai secondi interi; tieni premuto Alt per trascinare senza agganciare. Ogni trascinamento è un passaggio di annullamento, e l'anteprima durante il trascinamento usa la stessa aritmetica del risultato.

Seleziona una clip e l'inspector offre le stesse modifiche come numeri: **Length**, **Trim in** (a che punto della sorgente inizia la clip), **Speed** da ×0.25 a ×4, **Animate in** e **Animate out** con le relative durate e **Mute clip**. Una clip sulla riga magnetica non ha il campo **Start**, perché l'ordine lo gestisce la riga.

Le **transizioni** sono preset: Fade, Pop, Grow, Rise, Drop, i quattro Slide, Zoom in e out, Tilt, Swoop, Spin, Drift o **Cut (no animation)**. Le distanze scalano con l'oggetto, quindi uno stesso preset funziona bene su una scheda a pieno riquadro e su un piccolo badge. Tra due clip della riga della sequenza, un **seam chip** sceglie **Cut** o **Crossfade**; aprilo di nuovo per impostare la **Length (ms)** e premi **Done**. In una dissolvenza incrociata, la prima clip prosegue oltre il taglio e sfuma in uscita mentre la successiva sfuma in entrata, allo stesso modo nell'anteprima e nel file.

**Suono.** Una clip **Audio** vive sulla timeline come qualsiasi altra clip, con forma d'onda, rifilatura e muto. Il tappeto musicale generato del template Video viene sintetizzato al momento dell'esportazione, quindi la sua barra resta semplice e silenziosa finché non esegui il rendering. Premi il microfono per **registrare una voce fuori campo** direttamente sulla timeline, con un conto alla rovescia e un indicatore di livello; la ripresa viene salvata come tua risorsa nella posizione del cursore di riproduzione. Il pulsante della camera accanto al microfono **registra un video** allo stesso modo, ritagliato sull'artboard mentre registra, così un collega può aggiungere una clip da un link condiviso. Seleziona una clip con audio e la sua striscia si apre sotto la timeline per volume, pan, EQ, intonazione, normalizzazione ed effetti come **Voice cleanup**; [Sound](/info/sequence-editor.html#sound) nella guida all'editor di sequenze descrive la striscia. **Audio track** nel pannello di esportazione è separato: un tappeto sotto l'intera clip, con dissolvenza e ducking.

![La timeline con la clip musicale selezionata: la sua striscia corre lungo il fondo con Velocità, Dissolvenze, Volume, Pan, EQ, Intonazione, Normalizza volume e lo slot Effetto](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fbx%3Dt1%252Ctext%252C200%252C140%252C1500%252C220%252C0%252Crect%252C16%252C%252C100%252C%252Ccontain%252Cnormal%252CVoiceover%252520session%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252Cseq%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1%252C%252Cfalse%252C%252C60%252C%252C%252C1%257Ea1%252Caudio%252C200%252C500%252C400%252C80%252C0%252Crect%252C16%252C%252C100%252Clolly%25252Floops%25252F3-am-echoes%252Ccontain%252Cnormal%252C%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252C%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1.3%252C%252Cfalse%252C%252C60%252C%252C%252C1%26_sel%3Da1&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px%21important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip&drive=click%3Abutton%3Ahas-text%28%22Inspector%22%29)

**Rendering.** Un'esportazione di animazione disegna, decodifica e codifica ogni fotogramma a un istante esatto, quindi il file non dipende dal fatto che la tua macchina tenga il passo, e MP4 e WebM non hanno un limite pratico di fotogrammi. La lunghezza della timeline imposta la durata a meno che tu non ne digiti una, e le Content Credentials vengono apposte come in qualsiasi altra esportazione. Un'esportazione di immagine fissa dà il fotogramma al cursore di riproduzione, o un provino a contatto dal campo **Frames**; vedi [Stills from a timed composition](/info/exporting.html#stills-from-a-timed-composition). Una sequenza è limitata a un'ora. GIF e PNG animato tengono ogni fotogramma in memoria, quindi si adattano a clip brevi. **Record live** è nascosto qui perché il rendering fotogramma per fotogramma è il percorso migliore.

**Fotogrammi chiave, profondità e una camera.** Una transizione anima una clip quando arriva e quando se ne va. Per posizionare un box all'interno di una clip (farlo scivolare, sfumare, sfocare, sollevarlo dalla pagina e farlo riposare di nuovo), seleziona la clip e premi **+Keyframe**: il rombo negli strumenti della timeline, il rombo nella barra dell'oggetto sulla tela oppure **Shift+K** con la timeline in focus. La posizione del cursore di riproduzione decide quale posa scrive la tua prossima modifica. Gli stessi fotogrammi chiave danno a una composizione temporizzata una camera che avanza, fa una panoramica e sposta la messa a fuoco. [Animating](/info/animating.html) è la guida completa, e [The sequence editor](/info/sequence-editor.html) tratta selezione, onion skin, divisione, rifilatura e marcatori.

## Prima di esportare

Design controlla il tuo documento prima che tu invii il file. La scheda **Before you export**, nella sezione **Document** dell'Inspector e di nuovo nel pannello di esportazione, legge la struttura dei livelli salvata, poi esamina la tela assestata per cercare testo tagliato e contrasto di colore piatto. Chiede allo stesso registro dei font usato dal tracciamento in contorni di SVG e PDF se ogni porzione di testo dispone di byte del font che si possono incorporare. Gli sfondi di immagine e gradiente sono elencati come controlli visivi invece di ricevere un punteggio di contrasto inventato.

### Controllare una composizione rispetto al design system

La scheda del pannello di esportazione confronta anche la composizione con il tuo design system, alla stessa versione del design system che usa il rendering. Esamina colori definiti, alias di token, scelte di font e id di risorse immagine. Un valore personalizzato può essere intenzionale, e un'immagine fuori dalle risorse dichiarate del brand è un elemento da rivedere, non un'immagine vietata.

Dove esiste un suggerimento concreto di colore o font, il suo pulsante cambia quel solo livello, e **Undo** ripristina l'originale. I livelli bloccati o modificati nel frattempo non vengono mai sovrascritti da un vecchio suggerimento. Gradienti, effetti, contenuto annidato di strumenti, diritti e qualità soggettiva sono fuori da questo confronto, e nessun controllo blocca Download.

### Regole di stile e segnale di scrittura

La scheda del pannello di esportazione controlla anche le regole di stile che il tuo design system porta con sé, come peso e allineamento del testo, abbinamenti di colore approvati o un logo per superficie, livello per livello. Ogni rilievo è un avviso con il nome del livello sopra la regola. Una regola per cui questa build non ha un controllo è elencata come non controllata, mai come rispettata. [Usage & rules](/info/brand-studio.html#usage-rules) elenca le regole, e `lolly check` applica le stesse a un documento salvato.

La stessa scheda mostra il segnale di scrittura per il testo che il documento disegna: la sua fascia (nessuno, debole, notevole o forte), poi la frase di Verify con il punteggio su 100 e fino a tre frasi segnalate, ciascuna con il livello che le contiene. **Open the text in Verify** porta quel testo a [Verify](/#/verify) per la lettura completa; [AI evidence in Verify](/info/verify-ai-evidence.html) spiega cosa pesa il punteggio. Il punteggio è un segnale, non un verdetto: conta schemi comuni nella scrittura generata e non può dire chi ha scritto le parole. I livelli nascosti sono esclusi da entrambi i controlli, e la scheda dice quanti sono.

I rilievi sulle regole di stile e un segnale di scrittura forte contano nel totale "to fix" della scheda, così sono facili da trovare. Informano e non bloccano mai: Download resta disponibile, e non c'è nulla da ignorare né da registrare come eccezione. Un agente che lavora nel documento aperto riceve lo stesso report tramite i suoi strumenti del sito ([Agents in an open document](/info/open-document-agents.html)).

I controlli di stampa (abbondanza, risoluzione, copertura d'inchiostro e conteggio delle lastre) si aggiungono alla stessa scheda quando attivi **Settings → Feature flags → Print preflight**. In altri strumenti quel flag è ciò che fa comparire la scheda; [Export a file](/info/exporting.html) descrive i controlli di stampa.

## Presentare

Un documento Design composto da artboard è già un deck. Premi **Present** nella barra superiore e ogni artboard diventa una slide a schermo intero, nell'ordine in cui le artboard stanno sulla tela. Il pulsante riporta **Preview** finché il **Design outcome** del documento non è **Slides**. Il deck gira su una copia delle artboard renderizzate, quindi uscire ti riporta esattamente dove eri.

La freccia accanto a **Present** apre **Present from this slide**, **Speaker view**, **Present with camera**, **Narrate**, **Auto-advance slides**, **Loop the deck (kiosk)** ed **Export slides as video**.

| Tasto | Cosa fa |
|---|---|
| **Space**, `→`, **Page Down** | Passo o slide successivo (o clic sulla striscia al bordo destro) |
| `←`, **Page Up** | Indietro (o clic sulla striscia al bordo sinistro) |
| **Home**, **End** | Prima o ultima slide |
| `O` | Panoramica: ogni artboard nella disposizione della tua tela; fai clic su una per aprirla |
| `S` | Vista relatore: slide corrente, slide successiva, note e un orologio in una seconda finestra |
| `B` | Schermo nero; qualsiasi tasto riporta la slide |
| `F` | Torna a schermo intero |
| `K` | Metti in pausa o riavvia un deck kiosk |
| **Escape** | Toglie uno strato: dalla panoramica al deck, dal deck all'editor |

Una piccola barra di controllo compare in dissolvenza quando muovi il puntatore e si nasconde di nuovo quando smetti. Se il browser blocca il pop-up del relatore, la vista relatore si apre come pannello sopra il deck. Le note appartengono a ciascuna artboard e non compaiono mai sulla slide.

- **Passaggi di rivelazione.** Fai clic destro su un box e scegli **Reveal at step 1**, **2** o **3** invece di **Always visible**, e il box aspetta finché non avanzi fino al suo passaggio. I box che condividono un numero arrivano insieme.
- **Kiosk.** Dai a un'artboard una **Length** e il deck resta lì per quel tempo, poi avanza dietro una sottile barra di avanzamento. Aggiungi `kiosk` al link e il deck ricomincia alla fine, per le insegne.
- **Pile di sotto-slide.** Fai clic destro su un'artboard e scegli **Stack under the previous slide** per renderla un passaggio di quella slide. La panoramica mostra una sola scheda e la riga **Stack** dell'inspector indica a quale slide appartiene l'artboard.
- **Morph.** Quando due slide consecutive contengono un box con lo stesso nome **Morph match** (per esempio `hero`), la transizione sposta, ridimensiona e ricolora quel box invece di fare uno stacco. Una transizione **Morph** applicata a tutto il deck fa lo stesso per ogni coppia abbinata.
- **Narrazione.** Le **Speaker notes** di ogni artboard possono essere lette ad alta voce. Nella sezione **Document** dell'Inspector scegli una **Voice**, facoltativamente una seconda voce con cui fare **Blend with**, la **Speed** e un **Lead-in** e una **Tail** in millisecondi; **Show captions when presenting** mostra le parole mentre vengono pronunciate. La voce gira sul tuo dispositivo, e le stesse note diventano la colonna sonora di un'esportazione video, l'audio delle slide in un'esportazione PowerPoint e il filmato narrato in un [pacchetto SCORM](/info/create/exporting.html#scorm-course-packages).

Anche il deck è un link. `?present` apre direttamente al suo interno e `s=` sceglie la slide (una posizione, un id di artboard o `id.step` per un passaggio di costruzione), e l'indirizzo ti segue, quindi ciò che invii è la slide su cui ti trovi. [Reserved URL parameters](/info/url-parameters.html#what-happens-on-open) li documenta.

**Present with camera** posiziona la tua camera, un logo e una didascalia con il nome sopra le slide, con controlli privati e scene salvate; vedi [Presenting with camera](/info/presenting.html). Un box **Web page** può usare il telecomando durante un intervento quando attivi **Make interactive** nel suo inspector: al passaggio **Focus on click**, Su e Giù controllano la pagina mentre Avanti prosegue il deck. [Live pages that take the clicker](/info/interactive-pages.html) tratta stili del focus, punti di arresto dello scorrimento e approvazione del sito.

## Dove andare adesso

- **[Testo in Design](/info/text-composition.html)**: modificare il testo sulla tela, far scorrere articoli attraverso i riquadri e tipografia.
- **[Animating](/info/animating.html)**: fotogrammi chiave, profondità, la camera di scena e i Lift layer.
- **[Import a design](/info/design-import.html)**: apri un file Figma, Penpot, Illustrator o InDesign come box modificabili.
- **[Share a design with rules](/info/create-a-tool.html)**: trasforma un documento Design in uno strumento con i soli input che scegli.
- **[Export a file](/info/exporting.html)**: formati, dimensioni, unità di stampa e video.
