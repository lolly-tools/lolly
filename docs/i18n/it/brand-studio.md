# Design System Setup

Il tuo logo, i tuoi colori e i tuoi caratteri appartengono a un solo posto, così ogni strumento, pagina ed esportazione disegna con essi. Quel posto è **Design System Setup**, a `#/start`, e il suo slogan dice a cosa serve: *Make it yours*.

Parti da quello che hai. Trascina un logo e Lolly ne legge i colori. Scegli un carattere, o trascina il file del font di cui la tua azienda ha la licenza. Ogni modifica si vede subito in tutta l'app. Il tuo logo, i font e i token restano su questo dispositivo. Scegliere un Google Font è l'unico passaggio che si rivolge all'esterno: Lolly lo chiede prima, poi scarica la famiglia una volta.

Quando ti convince, dai un nome al design system e premi **Export**. Ottieni un unico file `.lolly` da conservare, aprire su un altro dispositivo o consegnare a un collega. [Settings](/info/dashboard.html#design-system) mostra il sistema attivo in sola lettura, e la sua copertina rimanda qui per la modifica.

## Fallo tuo in cinque minuti

::: timeline
- <!--i:upload--> **Trascina il tuo logo** sull'area di rilascio in **Logos**. Lolly ne legge la forma e i colori.
- <!--i:palette--> **Usa questi colori.** Il colore principale del logo diventa il tuo primario, e un neutro scuro del logo diventa il colore del testo.
- <!--i:font--> **Scegli un carattere** in **Type**: un Google Font, o un file di font che possiedi.
- <!--i:pentool--> **Dai un nome al sistema.** La tua prima modifica crea un design system tutto tuo, e Lolly ne chiede il nome una volta.
- <!--i:download--> **Export** scrive l'intero sistema come un unico file `LollyBrand-….lolly`.
:::

L'intestazione mostra quale design system stai **Editing**, e il suo nome è un campo che puoi cambiare in qualsiasi momento. Quando la tua prima modifica chiede **What is this design system called?**, le parole del tuo logo vengono inserite se il logo le scrive per esteso. **Save name** conserva il nome; **Not now** tiene un segnaposto finché non ne digiti uno nell'intestazione. Il nome etichetta il sistema in Settings e quando cambi, e diventa il nome del file che **Export** scrive.

## Le stanze

Lo studio è un insieme di stanze in una barra sul lato, in nessun ordine fisso: nulla è numerato e nulla aspetta altro. Su un telefono la barra diventa una striscia di chip sotto l'intestazione.

![La barra delle stanze dello studio: Overview, Colours, Type, Logos, Tokens, Files e Usage & rules](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Stanza | Cosa ci fai | Chiave del link |
|---|---|---|
| **Overview** | Vedi cosa contiene il sistema, con una porta verso ogni stanza | `overview` |
| **Colours** | Aggiungi colori, dai loro dei ruoli, costruisci sfumature e una palette | `color` |
| **Type** | Scegli i quattro caratteri che leggono l'app, gli strumenti e ogni esportazione | `type` |
| **Logos** | Colloca i tuoi marchi in ogni orientamento e trattamento | `logos` |
| **Tokens** | Angoli, spaziatura, ombre e ogni altro valore con nome | `tokens` |
| **Files** | Le immagini, l'audio e i file di animazione che il tuo brand conserva | `catalogue` |
| **Usage & rules** | Le regole che il tuo brand applica, verificate su esempi reali | `usage` |

Per rimandare a una stanza usa `#/start?area=<key>`. La stanza Files mantiene la chiave `catalogue`, perché la chiave di una stanza è un contratto permanente, e `?tab=` funziona ancora come alias più vecchio. Una chiave sconosciuta apre Overview.

Il **piede della barra** contiene le azioni per l'intero sistema anziché per una sola stanza. **Add from…** porta dentro un brand ([Portare dentro un brand](#bring-a-brand-in)), e il **Tray** contiene ciò che una scansione ha trovato e che non hai ancora aggiunto. **Export**, **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions** e **Restore brand settings** conservano e spostano il sistema ([Conserva e sposta il tuo design system](#keep-and-move-your-design-system)). Ognuna compare quando c'è qualcosa su cui agire.

## Panoramica

Quando non è ancora stato scelto nulla, Overview offre quattro modi per iniziare. **Start from a reference** apre il selettore di sorgente per un logo, uno screenshot, una pagina web o un file di design, e **Pick a colour**, **Choose a face** e **Add a logo** aprono direttamente quei controlli. Aprirne uno non scrive nulla, e **Explore the tools** c'è fin dall'inizio.

Una volta che qualcosa è tuo, Overview mostra ciò che hai, con i tuoi conteggi in testa. Colours indica il numero di colori, con un attenuato `· N starter` dove compaiono i colori ereditati; la sua striscia mette per primi i tuoi colori, poi una linea sottile, poi quelli starter sbiaditi. Type si legge per ruolo (*Inter for headings*, con *Starter for the rest* sulla riga sotto). Logos dice quanti slot sono riempiti (o **Not set**), Tokens mostra il raggio degli angoli e Files dice **Nothing yet** finché la libreria è vuota. Ogni blocco apre la sua stanza.

### Starter e tuo

**Starter** è la parola per tutto ciò che è arrivato con l'app anziché essere scelto. Un'installazione nuova non porta alcun colore, solo una rampa neutra dall'inchiostro alla carta, così superfici, testo e linee sottili possono essere disegnati prima che qualcuno decida qualcosa. La stessa parola contrassegna il materiale ereditato in ogni stanza.

::: cols
## Starter

- È arrivato con l'app: i neutri dall'inchiostro alla carta, i caratteri starter, il raggio degli angoli predefinito.
- Attenuato, con un tag **Starter** e senza tinta.
- Non contato tra i tuoi colori. I neutri risiedono in **Tokens** come **Neutrals · starter · 9**, e **Open** li mostra in Colours come un unico gruppo richiuso (`#/start?area=color&group=neutral`).
- Un ruolo basato su un colore starter dice *"Starter Paper stands in"*, con **Choose…** sul suo selettore.

## Tuo

- Scelto o installato da te.
- A piena intensità, e una scheda tinta dove hai installato un carattere.
- Contato in Overview e in Tokens.
- Un ruolo che ne segue un altro dice **↳ follows Primary** anziché ripetere il nome del primario.
:::

Il materiale ereditato non viene mai disegnato con un bordo tratteggiato, perché qui un bordo tratteggiato indica una destinazione di rilascio.

## Loghi

Svuota la tua cartella di marchi nell'area di rilascio in alto: **"Drop marks here, or choose several at once"** accetta tutti i file che hai. Ogni file viene letto per forma e inchiostro, poi attende sotto **Waiting for a slot** come un chip che dice a cosa assomiglia, per esempio *"Looks like the Horizontal primary"*, con la misura che ha usato e un pulsante **Place** (**Replace** dove lo slot è già riempito). Dove non è sicuro, il chip lo dice e offre **Change slot**, elencandoli tutti e otto. Nulla viene collocato finché non premi qualcosa.

Un marchio con margini vuoti in eccesso riceve prima un'offerta di rifilatura; rispondi, oppure premi Escape e l'originale entra intatto. Dove un marchio può riempire uno slot gemello vuoto, la stanza propone la versione derivata **mono** o **reverse** come chip contrassegnato *Generated*.

Ogni marchio finisce in una griglia di otto slot facoltativi, uno per **orientamento** e **trattamento**:

- **Orientamenti:** Horizontal (wordmark e simbolo in una riga) e Vertical (impilati, per spazi quadrati e alti).
- **Trattamenti:** Primary, Primary reverse (per sfondi scuri), Mono (un colore) e Mono reverse.

Un gruppo senza ancora marchi si richiude in una riga; aprilo per vedere i suoi slot. Fai clic su uno slot per aggiungere un PNG, SVG, JPEG o WebP, oppure fai clic su uno slot pieno per sostituire il marchio. Tutto resta su questo dispositivo.

![Gli slot dei loghi con Horizontal e Vertical aperti: ogni trattamento è uno slot a sé, e ogni slot è facoltativo](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails%3Anth-of-type%281%29%3Esummary%3Bclick%3A.be-logo-identity%3Edetails%3Anth-of-type%282%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** sono marchi che il tuo brand chiama con un nome proprio, come un'icona, uno stemma o una favicon.
- **More identities.** Un sotto-brand, un prodotto o un evento può avere un proprio set completo: **+ Add another logo** e dai un nome al set. Il tuo set principale è "Your logo". [Brand architectures](/info/brand-architectures.html) mostra quando un'identità di logo è il blocco giusto.
- **Lolly legge i colori del logo.** Una scheda sotto l'area di rilascio, e di nuovo in cima a Colours, elenca i colori del logo e chiede **Which is the main colour?**, con il colore più forte già selezionato (mai il bianco su cui è stato esportato). **Use these colours** li aggiunge alla tua palette, rende il colore principale il tuo primario e, quando il logo ha un neutro scuro che si legge sulla carta, lo rende il colore del testo. **Not now** li lascia nel Tray. Su un'installazione nuova la risposta più probabile viene applicata subito, e la scheda offre **Undo** o un altro colore principale. Un SVG dà colori esatti; un PNG, JPEG o WebP dà i colori che coprono una quota reale del marchio.

## Colori

La stanza cresce con il design system: una prima visita è una sola decisione, e il resto arriva man mano che arriva la palette.

### Il primo colore

Un sistema senza colori propri si apre su un grande chip e un campo, con una riga che dice che ruoli, sfumature e impostazioni di stampa arrivano man mano che il sistema cresce.

- **Il chip è il selettore.** Premi **Pick a colour** e si apre la scheda OKLCH dello studio, inizializzata con ciò che contiene il campo: un nome, la ruota, i quattro quadranti, l'alfa e **Stored as**, con **Cancel** e **Add colour** in fondo. Nulla raggiunge il sistema finché non premi **Add colour**.
- **Il campo accetta qualsiasi notazione**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` o il nome di un colore. Incolla un elenco e diventa una riga di chip da aggiungere uno alla volta o con **Add all**.
- **Altri due modi per entrare.** **Pick a colour from the screen** usa il contagocce dove il browser ce l'ha, e **Take colours from an image** legge uno screenshot o una foto su questo dispositivo.
- **Add non è mai disattivato.** Con il campo vuoto apre il selettore; un testo che non riesce a leggere riceve una riga sotto il campo che lo dice.

Il tuo primo colore diventa il **primary**, e un chip lo conferma, per esempio *"Primary is now Vivid Violet"*, con **Fine-tune** per regolare il colore.


### Man mano che la palette cresce

I tuoi colori stanno accanto a un'anteprima **In context** su uno schermo largo, e sopra di essa su uno più piccolo. L'anteprima mostra un poster, un grafico o una scheda di interfaccia nella tua palette. I colori starter restano nel loro gruppo richiudibile.

![La stanza Colours su Lolly Demo: la palette in gruppi richiudibili, ogni colore con il suo nome ed esadecimale, e la pillola di download in fondo](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![La stanza Colori dopo aver aggiunto un colore, con la sua palette e un'anteprima di composizione dal vivo](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Ruoli: ciò che leggono gli strumenti

I **Roles** dicono quale colore svolge ogni parte in ogni strumento ed esportazione. Sono facoltativi (tre colori sciolti e nessun ruolo sono un sistema perfettamente valido), qualsiasi colore può prenderne uno e la lettura del contrasto è misurata rispetto alla superficie, APCA per prima. Ogni riga di ruolo mostra un colore proprio a piena intensità, un colore starter che fa le veci, oppure **↳ follows Primary**.

Quando la palette ha le sfumature, la striscia mostra tutti e sette i ruoli che uno strumento può leggere: Primary, Secondary, Surface, Text, Muted, Edge e On primary. On primary è derivato dal primario, indica **Derived** e non ha selettore.

L'accento dell'app stessa segue per impostazione predefinita il design system. È l'impostazione **Interface follows the design system** in **Settings → Appearance**; disattivarla lascia neutro il chrome dell'app, mentre strumenti, tele ed esportazioni seguono comunque il design system.

**Colourway.** Un design system può contenere più colori guida, ciascuno scelto per pezzo. Lolly conserva ogni colourway, ma questa stanza non può ancora crearne una: una colourway si scrive nel file dei token. In un sistema con colourway, ogni colourway ha bisogno di un proprio primario e secondario, e di una propria superficie quando le colourway tingono lo sfondo, quindi quei ruoli restano impostati nell'editor dei campioni. [Lolly Demo in use](/info/lolly-demo-in-use.html#colourways-on-real-work) mostra le colourway su lavoro reale, e [Add colourways to a design system](/info/colourways.html#add-colourways-to-a-design-system) ha il formato.

### Trovare altri colori

Tre strumenti partono dal tuo primario. I primi due si limitano a suggerire, e il terzo sostituisce la palette dopo che hai rivisto la modifica.

::: cols
## Explore shades & harmonies

Scegli un **Starting colour**, uno **Scheme** (Mono, Complement, Analogous o Triad) e quante **Shades** (da 3 a 20, 5 per impostazione predefinita). **Fine-tune** imposta l'intensità dell'interfaccia, il contrasto e il testo sul brand. Fai clic su una sfumatura per aggiungerla, oppure **Add 5 shades** per un gruppo. I tuoi colori e ruoli restano.

## Find matching colours

Scegli una **Harmony**: Complementary, Adjacent, Triad, Tetrad o Analogous (con **Accents** da 2 a 5 e un **Angle** da 10° a 45°). Ogni candidato ha un nome generato e **+ Add**, una pressione per colore.

## Rebuild the whole palette

Sostituisce la palette a partire da un colore di partenza, dopo una revisione di ciò che cambia e ciò che resta. Prima viene creato un checkpoint, e dopo viene offerto **Undo**.
:::

Tutti e tre usano la stessa matematica percettiva del colore (OKLCH) dell'engine. In **Explore shades & harmonies**, le righe **Primary**, **Neutral** e **Secondary** mostrano le sfumature suggerite, e **Theme preview** mostra esempi chiari e scuri con le loro letture di contrasto.

![Tre gruppi di sfumature suggerite, con controlli di aggiunta individuali e un Theme preview separato](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Accenti generati, ciascuno con uno swatch, un nome generato automaticamente, il suo hex e un pulsante Aggiungi](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Confermare una palette generata

Apri **Rebuild the whole palette…** e premi **Preview full rebuild**. La revisione conta quanti ruoli restano come li hai assegnati, quanti dei tuoi colori vengono mantenuti e quante curve di sfumatura, blocchi di stampa, sfumature nascoste e stop di gradiente vengono riancorati o mantenuti. **Apply rebuilt palette** conferma; **Cancel** non cambia nulla. Poi la scheda offre **Undo** con il focus su di esso, e il checkpoint creato prima dello scambio ripristina l'intero sistema.

Un sistema con colourway le mantiene tutte durante una ricostruzione. La colourway canonica segue il nuovo colore di partenza, e ogni altra colourway mantiene i propri colori, nome, ordine e impostazioni. La revisione elenca quale colourway segue e quali mantengono i propri colori. Lolly non ricostruisce un sistema che codifica le sue colourway in un modo che non sa modificare; la scheda ne spiega il motivo e non cambia nulla.

### Le sezioni per esperti

Quattro sezioni richiuse stanno sotto l'anteprima e i ruoli. Ciascuna si apre direttamente con `#/start?area=color&focus=<name>`:

- **Explore shades & harmonies** (`focus=generate`), descritta sopra.
- **Shade curves** (`focus=curves`) rimodellano una rampa punto per punto, con curve separate di luminosità, croma e tonalità (L / C / H) e le sfumature che si ridisegnano mentre trascini.
- **Contrast** (`focus=contrast`): **Contrast-lock** ritona una rampa per raggiungere obiettivi APCA rispetto a uno sfondo che scegli, e **Rotate hue** ruota l'intera rampa lungo la ruota.
- **Print** (`focus=print`) imposta cosa diventa il primario in stampa: il suo valore automatico, una composizione CMYK fissata o un inchiostro spot con nome.

### La palette e ogni campione

La palette elenca i tuoi colori in gruppi richiudibili, ciascuno con il proprio **+ Add**. Crea e rinomina i gruppi come preferisci. Un ruolo non crea mai un secondo riquadro: un riquadro a cui punta un ruolo porta invece un piccolo segno (**P**, **S**, **Su**, **T**). **Colour chart** sotto i riquadri mostra gli stessi colori sulla **Wheel** OKLCH (trascina un punto per ricolorare, fai clic su uno spazio vuoto per aggiungere un campione) e sul grafico **Gamut**, che mostra dove finisce la gamma visualizzabile. `#/start?area=color&focus=chart` apre direttamente il grafico.

![Il pannello della palette, ogni gruppo richiudibile, con la pillola di download ancorata sul bordo inferiore](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![La ruota OKLCH - l'angolo è la tonalità, la distanza dal centro è la cromaticità e i grigi scorrono lungo un binario di luminosità sul lato](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Fai clic su un campione per aprire il suo editor:

- **Rename** il campione.
- **Set the colour** con cursori OKLCH, o in **Hex**, **HSL**, **RGB** o **CMYK**. Il campo del valore legge e scrive nello spazio attivo. Qui CMYK imposta il colore dello schermo per conversione; per fissare inchiostri esatti usa **Print substitutes**.
- **Stored as** sceglie come viene salvato il campione: **LCH** (il predefinito, percettivo e a gamma ampia), Hex, RGB o HSL.
- **Use as** assegna direttamente un ruolo al campione. Premi di nuovo un ruolo evidenziato per rimuovere il ruolo.
- **Print substitutes** (richiuso): blocca **CMYK** da **Auto** a valori di inchiostro esatti, oppure imposta un **Spot colour** con un **Name** (come `PANTONE 186 C`), un **Book** facoltativo e una **Finish** per stampa a caldo, rilievo, impressione a secco, vernice spot, soft touch o una fustella, cordonatura o perforazione. Una macchina da stampa usa questi blocchi quando esporti un PDF o un TIFF CMYK; vedi [Colour profiles](/info/exporting.html#colour-profiles).
- **In other spaces** (richiuso): un valore per ogni spazio colore, derivato o definito da te, e uno definito da te prevale all'esportazione.

**Eliminare un campione** è sicuro. Le sfumature derivate e i ruoli del tema vengono nascosti, quindi nulla di ciò che li legge si rompe, mentre i colori che hai aggiunto vengono rimossi.

::: details Lavorare con molti campioni
Ogni campione ha una maniglia di trascinamento. Trascina per riordinare all'interno di un gruppo, oppure porta il focus sulla maniglia, premi Space, usa i tasti freccia e premi di nuovo Space per rilasciare; Escape annulla. Per spostare colori tra gruppi, usa il controllo **Group** dell'editor oppure selezionane diversi e usa **Move to**.

La selezione non richiede alcuna modalità. La barra compare con il primo riquadro selezionato e se ne va con l'ultimo.

- **Trascina su uno spazio vuoto** per disegnare un rettangolo; ogni riquadro che tocca entra nella selezione, anche tra gruppi diversi. Una sezione richiusa non aggiunge nulla.
- **Shift-clic** prende un intervallo nell'ordine di lettura, **Cmd/Ctrl-clic** attiva o disattiva un riquadro, e un semplice clic apre l'editor.
- Ogni intestazione di gruppo ha **Select all**, e **Cmd-A** con un riquadro in focus prende ogni colore che possiedi, mai uno starter.
- La griglia ha un solo punto di tabulazione: le frecce si spostano, Shift+frecce estendono, Space attiva o disattiva, Delete rimuove ed Escape azzera. Per ritoccare un canale, premi prima `l`, `c` o `h`.
- Su un touch screen, tieni premuto un riquadro per avviare una selezione, poi tocca per aggiungere.

La barra riporta **{n} selected**, poi **Move to**, **Give a role** (ogni colore prende a turno il ruolo successivo), **Download** (la selezione in uno qualsiasi dei sei formati di palette), **Duplicate** (una copia di ciascuno, collocata dopo l'originale), **Copy values** e **Delete**. Una copia si apre direttamente nell'editor; più copie restano selezionate. Un solo Cmd/Ctrl-Z annulla un'intera azione di massa.
:::

### Gradients

Il pannello facoltativo **Gradients** costruisce token di sfumatura dalla palette. Ogni gradiente ha un'anteprima, da 2 a 8 stop con nome e un angolo. Uno stop punta a un campione, quindi ricolora il campione e il gradiente lo segue. Le sfumature avvengono in OKLCH.

I download della palette (design token, CSS, SCSS, GIMP e Adobe Swatch Exchange) stanno in una pillola in fondo alla palette quando ci sono le sfumature. [Take your palette and fonts anywhere](/info/using.html#take-your-palette-and-fonts-anywhere) descrive ciascun formato.

## Type

Senza un carattere proprio, la stanza è una sola scheda: **Primary**, composto a dimensione di lettura nel carattere che lo serve oggi, con un tag **Starter**, un pulsante **Choose a face** e la riga *"Nothing installs until you choose one."* Titoli, codice e corsivo seguono il primario finché non li scegli; **Choose them separately** mostra le loro schede.

![La stanza Tipografia senza ancora nessun carattere scelto - una card a dimensione di lettura, un'etichetta Starter su di essa, e uno Scegli un carattere pieno](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Scegli un carattere e la stanza si apre in quattro schede di ruolo, l'elenco Fonts e un campione live:

- **Primary**: testo corrente, pulsanti e ogni strumento.
- **Headings**: il carattere di titolo per `h1` e `h2`.
- **Code**: un carattere monospazio per codice e dati.
- **Italic**: un vero corsivo per enfasi, citazioni e incisi.

Una scheda è tinta solo dove hai installato quel carattere, e il suo pulsante dice **Change** su un carattere tuo e **Choose a face** ovunque altrove. Nulla su una scheda conferma qualcosa: il pulsante apre lo stage di confronto per quel ruolo.

![Le quattro card di ruolo rivelate - ciascuna impostata nel carattere che la serve, con un'etichetta Starter dove nessuno ne ha scelto uno e Corsivo che segue il primario](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Il palco di confronto

Lo stage si apre dentro la stanza, sotto la scheda che hai premuto, e le schede si richiudono in una striscia di una riga così lo stage compare nella prima schermata di un telefono. Escape annulla e restituisce il focus alla scheda.

1. Premi **Choose a face** sulla scheda.
2. Digita il nome di una famiglia e premi **Preview**, oppure premi una delle sei famiglie **Pinned** sotto il campo.
3. Premi **Use this face**.

![Il palco di confronto aperto sotto la sua card, con la riga di ricerca, le famiglie fissate e le card ripiegate in una striscia a una riga](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**Il consenso viene chiesto una volta.** La prima volta che un'anteprima raggiunge Google Fonts, una finestra spiega: *Google learns the family name and your IP address. The file is then kept on this device and used offline. This is the one step in the studio that reaches a third party.* **Fetch from Google** procede e viene ricordato. **Cancel** lascia la scheda con *"Not fetched. Nothing was sent to Google."*, con il proprio **Fetch from Google**.

**Trascina un file di font sullo stage** (TTF, OTF o WOFF) per vedere in anteprima un carattere con licenza che possiedi già. In entrambi i casi il carattere resta su questo dispositivo, viene reso offline nell'app, negli strumenti e in ogni esportazione, e viaggia nel file del design system. Tutto ciò che è su Google Fonts è distribuito con una licenza aperta (OFL, Apache o UFL).

### Font su questo dispositivo

Il pannello **Fonts** elenca ogni carattere presente su questo dispositivo e il ruolo che serve. I caratteri che hai aggiunto sono in testa sotto **In the design system**, ciascuno con i suoi ruoli e un'eliminazione. I caratteri starter seguono in una riga attenuata e richiusa. **Add a face** apre lo stage di confronto per qualsiasi ruolo. Il pannello **Type roles** mostra un campione live di ogni ruolo con la sua famiglia e il suo stato, come *Inter* o *Inter · follows Primary*.

## Tokens

I token sono i valori con nome dietro il design system: colori, caratteri, loghi, angoli e spaziatura. Gli strumenti li leggono per nome, quindi una modifica qui raggiunge tutti gli strumenti in una volta.

![La stanza Tokens: l'intestazione con un esempio dal sistema e le azioni sui file, riquadri che contano ogni tipo di token, poi le coppie di colori con le loro letture di contrasto](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **L'intestazione** dà un esempio dal tuo sistema (*Primary is Spearmint, #033633*) e le azioni sui file: **Download** (l'intero sistema come design token, o la palette in altri cinque formati), **Copy CSS** e **Add from…** per rileggere un file JSON.
- **I riquadri** contano ogni tipo di token e saltano alla sua sezione: Colours, Type, Logos, Shape and spacing, More e All tokens. Contano ciò che è tuo, come fa Overview. Su un telefono i riquadri scorrono lateralmente.
- **Colours** inizia con le coppie che gli strumenti mettono insieme (testo su superficie, su primario, attenuato su superficie) con una lettura APCA in chiaro e scuro, e segnala **Weak contrast** dove una coppia non basta. Poi ogni gruppo di colori: una rampa come una riga di chip, gli altri colori con il loro valore e il riferimento che usano gli strumenti, come `{color.brand.spearmint}`. Premi un riferimento per copiarlo. **Edit in Colours** apre un gruppo nella stanza Colours.
- **Type** e **Logos** elencano il carattere per ogni ruolo e ogni slot di logo, con **Edit in Type** ed **Edit in Logos** una volta che ne hai di tuoi.
- **Shape and spacing** contiene **Rounded corners** (`shape.radius`) e **Spacing rhythm** (`space.base`). Ciascuno dice *Lolly default* finché non muovi il cursore e *Yours* dopo, salva subito e si può annullare.
- **More tokens** aggiunge spaziatura, dimensioni, spessore del tratto, opacità, rotazione, numeri semplici e ombre, memorizzati come [design token](/info/design-tokens.html) standard.
- **App appearance (advanced)** elenca i colori, le dimensioni e le ombre usati dalle schermate di Lolly stesso, e **Inspect every token (advanced)** cerca e modifica qualsiasi valore memorizzato, mostrando prima ogni modifica per la revisione.

Una sezione senza nulla dentro offre il modo di colmare il vuoto: **Pick a colour**, **Choose a face** o **Add a logo**.

## Files

Trascina i file che il tuo brand conserva, esclusi i loghi: file **vector**, **image**, **audio** e **motion** (video, Lottie e animazioni). Compaiono in [Assets](/info/using.html#assets-your-library), ordinati in sezioni e pronti nel selettore di risorse di ogni strumento, e restano su questo dispositivo.

## Usage & rules

**Usage & rules** mette al lavoro le scelte del tuo brand: cosa le persone possono cambiare, cosa resta fisso e cosa Lolly può controllare.

![Usage & rules su Lolly Demo: una scheda Brand rules vuota con Add your first rule, poi Try your brand in use con i suoi esempi pronti da renderizzare](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** elenca le tue regole. **Add rule** (o **Add your first rule**) apre un breve modulo:

- un **Rule name** con parole tue, come *Beacon accents*;
- il **Check**: **Colour choices**, **Font choices**, **Fixed artwork** o **Text length**, con il ruolo del brand che usa, sotto il tuo nome per il ruolo;
- l'**Example** a cui si applica (Poster, Title slide, Content slide o Chart), la **Mode** e se è **Required** o **Advisory**;
- **Reviewed by**, poi **Save draft** o **Approve & save**.

L'approvazione registra la tua decisione su questo dispositivo. Le regole obbligatorie approvate vincolano il poster riutilizzabile, e i controlli riguardano solo i PNG di esempio; non modificano alcun altro strumento.

Le regole che un design system porta con sé nel suo file di token, come abbinamenti di colore approvati, peso e allineamento del testo o un logo per superficie, sono elencate qui come **Checked in Design**. Design le controlla livello per livello nella scheda **Before you export** del pannello di esportazione, e `lolly check` fa lo stesso per un documento Design salvato ([Before you export](/info/design.html#before-you-export)). Una regola per cui questa build non ha un controllo viene conservata così com'è stata fornita e contrassegnata **Unchecked**.

**Try your brand in use** renderizza quattro esempi dalla revisione corrente con **Render & check examples**. Scegli una **Brand mode** e **Try your own text** per il titolo, il testo di supporto e il testo delle slide. Ogni esempio riporta ciò che è stato misurato, con **See checks & sources** e **Download check report**, e **Make reusable poster** scarica un `.lolly` il cui layout fisso e le cui scelte di input approvate viaggiano con il file. Gli esempi sono locali: eseguire un controllo non pubblica né approva nulla.

Una build distribuita con un brand fisso mostra le stesse regole ed esempi in sola lettura, sotto *This brand is set*.

## Importare un brand

**Add from…** in fondo alla barra apre un selettore che chiede cosa hai, non che formato è:

- **Design tokens or a design file**: JSON DTCG o Tokens Studio, un progetto Penpot, uno zip di set di token, un pacchetto di design system Lolly o un SVG.
- **PDF**: un deck o un file di linee guida, letto su questo dispositivo per colori, marchi e caratteri incorporati.
- **Logo or screenshot**: un'immagine diventa una palette suggerita, letta su questo dispositivo. Legge i colori, non il carattere né il layout.
- **Saved web page**: un file HTML e i suoi file CSS, oppure HTML o CSS incollati, fino a 20 file e 2 MB. Viene letto solo il testo che fornisci: le risorse collegate non vengono recuperate e gli script non vengono eseguiti.
- **Font file**: TTF, OTF o WOFF. Apre la stanza Type, dove il carattere si installa.
- **Website**: una pagina, letta per colori e tipografia. Questo riquadro compare solo su un dispositivo che può leggere una pagina, e dice quale lettore usa: l'app su questo dispositivo, o l'estensione del browser in una scheda in background, con il tuo accesso. Indicare un URL riempie solo il campo; premere il recupero è il consenso.

Scegli la sorgente file di design e la scheda successiva elenca i formati accettati come riquadri con icona, con l'intera scheda come un'unica destinazione di rilascio. Puoi anche trascinare un file direttamente sullo studio.

![La card di importazione - i formati accettati compaiono come tessere con icona, e l'intera card è un'unica area di rilascio](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- Un **Lolly design-system pack** (`.lolly`, o uno `.zip` legacy) si installa in un solo passaggio.
- Un'esportazione **Penpot** (`.penpot`) porta i suoi design token.
- Un file **Design Tokens** (W3C DTCG) o **Tokens Studio** (`.json`) porta i suoi token.
- Un **plain SVG** viene scansionato per i colori tra cui scegliere, e il primo diventa il tuo primario.

### Rivedere un riferimento

Un logo, uno screenshot, un sito web o una pagina salvata apre **Try these colours**: un esempio con i colori proposti, un **Main colour** che puoi cambiare e un nome per un nuovo sistema. Un riquadro spiega cosa fa l'applicazione: **sostituisce** le impostazioni dei token attive con la palette generata e gli stili predefiniti, **mantiene** i tuoi font e i file della libreria, e il sistema precedente può essere **recuperato**. **Apply suggested settings** applica le palette chiara e scura, dopo un checkpoint, e **Restore brand settings** può riportare le vecchie impostazioni. **Change reference** sceglie un'altra sorgente.

**Palette, source details and individual choices** mostra ciò che è stato letto, gli eventuali nomi di font trovati e il contrasto dell'anteprima. I nomi dei font sono solo suggerimenti; Type resta il posto in cui si installa un carattere. I dettagli della sorgente possono includere tipografia, spazi, padding e valori degli angoli dove osservati, etichettati **Not observed** altrimenti. Una pagina salvata o una lettura nativa di un sito riporta gli stili dichiarati, che la pagina potrebbe non usare, e l'estensione del browser può riportare stili misurati da un campione di elementi visibili. Sono osservazioni: nulla viene installato, e la spaziatura della sorgente non sostituisce mai la tua. **Choose individual items in the tray** conserva singoli elementi, e **Download design context** salva un report JSON di osservazioni, token proposti e informazioni sulla sorgente (con uno SHA-256 di qualsiasi HTML o CSS fornito). Il report non contiene testo grezzo della pagina e non è una Content Credential firmata.

Le importazioni di PDF e file di design mantengono i propri controlli di revisione. Gli elementi nel **Tray** non cambiano nulla finché non li aggiungi nella stanza che possiede quel tipo di materiale. `#/start?source=<kind>` apre il selettore su una sorgente (`file`, `pdf`, `image`, `font`, `url`, `page`), e `?import` apre l'elenco semplice.

### Trovare e confrontare un look

Apri **Find a look** da Overview o dall'elenco dei design system in Settings. Sfoglia i sistemi salvati su questo dispositivo e alcuni esempi riutilizzabili di Lolly, e cerca per nome, tag di colore o font dichiarato. **Closest to my current palette** ordina per somiglianza di colore misurata, con i font corrispondenti a fare da spareggio; non è un punteggio di qualità.

Seleziona un look per rivederlo, o due per confrontarli affiancati. Selezionare non cambia nulla. **Use this saved system** passa ad esso, e **Use these colours** applica i colori di un esempio attraverso il consueto checkpoint, mantenendo i tuoi font. **Restore brand settings** recupera il look precedente. I sistemi salvati hanno **Search tags** modificabili sotto **Details and design context**. Gli esempi sono ricette di colore originali di Lolly, senza collezione copiata né account.

![Confronta Sunroom e Orchard fianco a fianco prima di applicare uno dei due sistemi di colore.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

## Conserva e sposta il tuo design system

### Spostare un brand tra dispositivi

**Export** scrive un unico file **`LollyBrand-….lolly`**: i tuoi token, font, loghi e preferenza del tema, con un manifest di integrità che viene verificato al rientro. Le release web precedenti alla 1.0.7 davano allo stesso file il nome `.zip`, e quella grafia è ancora accettata. **Tokens (.json)** scrive da solo il semplice documento di design token, senza font né loghi, per un repository, un passaggio di build o un altro strumento di token.

Per riportarne dentro uno, usa **Add from… → Design tokens or a design file**, oppure trascina il file sullo studio. È così che un collega ti consegna un brand, o che ne porti uno su una seconda installazione, senza account e senza cloud. Per portare dentro un brand dalla riga di comando, vedi [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** impacchetta i font che hai aggiunto in un RPM installabile. Se ne hai caricati alcuni tu stesso, Lolly ti chiede prima di confermare che puoi ridistribuirli.

### Ripristinare impostazioni precedenti

Scegli **Restore brand settings**, seleziona un checkpoint datato e premi **Restore**. Ripristina colori, impostazioni di tipografia e altri token per il brand attivo; i file di font e immagini restano come sono. Lolly salva prima le tue impostazioni attuali come **Before restore**, così puoi annullare un ripristino anche dopo aver chiuso il browser. Gli ultimi 20 checkpoint sono conservati su questo dispositivo.

### Versioni

Una versione pubblicata è una **copia permanente con nome** conservata su questo dispositivo. Non cambia mai, quindi uno strumento o un link che la fissa (con `designv`) continua a disegnare la stessa cosa. Un sistema con qualcosa di tuo mostra un discreto link **Versions & publishing** in fondo alla barra; dopo la tua prima pubblicazione diventa la voce **Versions**. `#/start?area=versions` la apre direttamente.

- **Una versione è permanente.** Non esiste ancora l'eliminazione, e il pannello lo dice.
- **Le rimozioni guidano la scheda di compatibilità**, perché è un token rimosso a rompere uno strumento.
- **La pubblicazione non si annulla; il ripristino sì.** *Restore latest from this version* è una normale modifica, con **Undo** offerto subito.

**Publish only** conserva una versione senza cambiare ciò che seguono gli strumenti; **Publish and make active** fa sì che strumenti e app seguano quella versione. **Follow the latest again** rende attiva ogni modifica nel momento in cui la fai.

## Gestisci i tuoi design system

Apri **Settings → Preferences → Design systems** per cambiare, aggiungere o rimuovere sistemi. **Open** seleziona un sistema e lo apre qui; **Make a new one** crea un sistema locale e lo apre con il campo del nome pronto. Un sistema alla volta è attivo, per l'intero dispositivo. [Brand architectures](/info/brand-architectures.html) aiuta a decidere quando un brand ha bisogno di un design system tutto suo.

**Da dove viene un sistema.** Il sistema fornito dal catalogo di un'installazione dice **Came with this app**, o **From this instance** in un'app collegata a una. Espandi **Catalogue source** per vedere chi lo fornisce, il suo asset di token e namespace e la sua versione o checksum noti; se un aggiornamento fallisce, il materiale in cache è etichettato.

**I sistemi gestiti sono in sola lettura.** Un sistema dice **Managed by this instance** (o **Managed by this app** nell'app desktop senza istanza) quando il suo catalogo lo blocca. Puoi usarlo e scaricarlo, e aprirlo qui mostra una nota di sola lettura con **Make an editable copy** e **Switch**. I tuoi sistemi locali restano modificabili, anche quando quello gestito è arrivato per primo. Una build con un solo brand fisso apre Design System Setup su *This brand is set*, con i token e le regole d'uso del brand da leggere.

**Ogni altro sistema fornito è tuo** da nascondere, modificare e reimpostare, compresi Lolly Demo e Lolly Starter su lolly.tools. Modificarne uno ne mantiene il nome e contrassegna la riga **Edited here**, e **Reset to original** nel suo menu scarta le modifiche fatte su questo dispositivo. Lo starter vuoto è l'eccezione: una prima modifica lì avvia un design system tutto tuo, quindi Lolly chiede una volta come chiamare il nuovo sistema. [Lolly Demo in use](/info/lolly-demo-in-use.html#switch-to-your-own) mostra cosa sostituisce il tuo sistema.

### Rimuovere un design system

Scegli **Remove** dal menu di un sistema; la conferma dice quale sistema sarà attivo dopo. Le sessioni salvate, i caricamenti e il materiale condiviso con un altro sistema restano.

Rimuovere un sistema fornito lo nasconde soltanto: le sue risorse del catalogo restano, **Bring back** lo mostra di nuovo e ritorna da solo se rimuovi tutto il resto. Rimuovere una copia importata o modificata non rimuove il sistema fornito, i suoi loghi né i suoi font, e se la copia era attiva, torna attivo il sistema fornito. Rimuovere una copia ospitata attiva cancella solo la connessione di quella copia; un'istanza scelta separatamente resta selezionata.

Cambiare ciò che un server fornisce è un compito da amministratore: il suo operatore modifica il catalogo sorgente e ridistribuisce, oppure un amministratore di Lolly Work rivede e applica una modifica del server. Le modifiche qui restano locali. Vedi [Removing a catalogue design system](/info/configuration.html#removing-a-catalogue-design-system) e [Configuration](/info/configuration.html#supplied-and-local-design-systems).

## Usare il contesto di design fuori dall'app

**Download design context** salva il documento dei token, i colori risolti, le famiglie di font dichiarate, gli id delle risorse, le prove della sorgente dove registrate, la copertura e le regole esplicite, senza file di font e senza prova di proprietà. La riga di comando legge il file senza server: `lolly system import` ne fa il design system del terminale e `lolly system check` controlla gli input di Design rispetto al contesto salvato. [Bring your design system](/info/cli.html#bring-your-design-system) tratta l'importazione e [Which design system a command uses](/info/cli-decks.html#which-design-system-a-command-uses) tratta il controllo, e un client MCP legge lo stesso brief da `lolly://design-context` ([MCP Server](/info/mcp.html)).

## Dove andare adesso

- **[Usare Lolly](/info/using.html)**: gli strumenti, il salvataggio, la condivisione e Assets.
- **[Brand architectures](/info/brand-architectures.html)**: come divisioni, prodotti, brand sostenuti, clienti e stagioni si mappano su design system, colourway e identità di logo.
- **[Design Tokens](/info/design-tokens.html)**: il modello di token in cui è scritto il tuo brand.
- **[Export a file](/info/exporting.html)**: unità di stampa, CMYK e i formati in cui viene renderizzato il tuo brand.
