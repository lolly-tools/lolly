# Lolly Batch e Lolly Multi-edit

<a id="batch-and-multi-edit"></a>

**Lolly Batch** crea molte versioni di un design, come una card in una dozzina di lingue o tutte le dimensioni di un banner. **Lolly Multi-edit** applica una modifica, come una nuova data o un titolo, a più design salvati diversi.

Entrambi vengono eseguiti sul tuo dispositivo ed esportano attraverso lo stesso percorso di rendering degli strumenti.

::: cols
## Batch

- Un template, molte righe. Ogni riga è un insieme di input e crea un file.
- Compila le righe digitando, incollando da un foglio di calcolo o importando un CSV.
- Nessun limite di righe; ne vengono mostrate 50 per pagina.
- Si apre da **Lolly Batch** nell'intestazione di Projects (`#/batch`).

<a id="multi-edit"></a>
## Lolly Multi-edit

- Da due a otto design salvati diversi, affiancati come card live.
- Una barra laterale modifica gli input comuni, poi quelli di ogni card.
- Ogni design viene salvato nella posizione da cui proviene.
- Si apre da **Edit together** nella barra di selezione di Projects.
:::

<!--i:eti-table-->
## Crea molte versioni di un design

Apri la vista **Projects** e premi **Batch** nella sua intestazione. La griglia parte con una riga. Scegli un template in quella riga, poi duplicala o incolla dati da un foglio di calcolo. Se aperto dall'interno di una cartella, Batch ti riporta a quella cartella.

![Batch su una nuova griglia: il nome del file e gli strumenti per le righe in alto, e l'elenco dei template della prima riga aperto sugli strumenti che puoi scegliere](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Compila le righe.** Digita in una cella o incolla un blocco da Excel, Google Sheets o un altro foglio di calcolo. **Import CSV** aggiunge righe o sostituisce il batch. Quando incolli in una cella che contiene impostazioni di esportazione, Lolly chiede quale input compilare con ogni colonna incollata. **Export CSV** esporta la griglia. Apri **Columns** sotto la griglia per mostrare altri input o larghezza, altezza, unità e DPI per riga. Il popover **Fill** di una colonna numerica, di testo o di scelta ha anche una sezione **Design token** che collega un token alle righe della colonna ([Collega molti documenti contemporaneamente](/info/token-workflows.html#link-many-documents-at-once)).

**Imposta l'output.** La barra degli strumenti imposta il nome del file zip, il **Default format**, le unità e i DPI per ogni riga. Il menu dei formati è l'elenco raggruppato del pannello di esportazione con i formati offerti dal catalogo e supportati dal tuo browser. Una riga con un proprio formato, dimensione o nome file mantiene la sua impostazione.

**Renderizza.** **Render all** esporta ogni riga in un unico `.zip`. Quando ci sono righe selezionate, **Render selected**, **Export selected CSV** e **Print selected rows** agiscono solo su quelle righe. Cancella la selezione per lavorare di nuovo sull'intero batch. **Print sheet** dispone le righe su un foglio stampabile. **Batch activity** riporta ogni importazione e rendering e può essere richiuso.

**Conserva il batch.** **Sessions** salva ogni riga della griglia come sessione batch con un nome, qualunque sia la selezione. La sessione si riapre da Projects. **Folders…** nello stesso menu apre una cartella di Projects come righe, una per sessione salvata; ogni nome file include il percorso della sua cartella.

::: details Selezionare righe e celle
Seleziona le righe con le loro caselle di spunta, oppure fai clic su una casella tenendo premuto Shift per selezionare un intervallo. La casella nell'intestazione seleziona la pagina corrente e **Select all *N* rows** include anche le righe delle altre pagine. Le selezioni restano mentre passi da una pagina all'altra. **Edit input**, **Duplicate** e **Remove** agiscono sulle righe selezionate e **Undo remove** ripristina le ultime righe rimosse. Da una cella con il focus, Shift+Space seleziona quella riga ed Escape cancella la selezione.

Trascina sulle celle, fai clic su una cella tenendo premuto Shift o usa Shift+tasti freccia per selezionare un rettangolo. **Copy cells**, o Ctrl+C / Command+C, copia i valori per un foglio di calcolo. Ctrl+A / Command+A da una cella con il focus seleziona ogni colonna visibile su ogni pagina; da una casella di spunta di riga, la stessa scorciatoia seleziona ogni riga. Selezionare celle lascia selezionate le righe già spuntate. Fai doppio clic su una cella o premi Enter per modificarne il testo. Incolla un rettangolo dagli appunti, oppure incolla un solo valore per riempire ogni cella selezionata; le celle vuote e il testo su più righe mantengono le loro posizioni.
:::

### Colourway e temi per riga

Ogni riga mantiene le proprie scelte di tema: chiaro o scuro e una colourway quando il design system ne offre. Una riga aperta da Projects, da una cartella o da un batch salvato viene renderizzata e mostrata in anteprima con le scelte con cui è stata salvata la sessione. Il foglio di stampa, una riga duplicata e una riga riempita le mantengono.

Un CSV contiene le scelte in una colonna `_themes` dopo le colonne delle dimensioni. La colonna ha lo stesso JSON del parametro di link `_themes`, per esempio `{"":"dark","colourway":"beach"}`. Una cella vuota, o `{}`, indica le impostazioni predefinite del design system. La colonna viene scritta solo quando qualche riga ha delle scelte. All'importazione, una cella che non contiene scelte di tema valide viene elencata come problema e la sua riga viene renderizzata con le impostazioni predefinite.

::: note Imposta le scelte di una riga nel CSV
La griglia non ha ancora un controllo per cambiare le scelte di una riga, quindi impostale nel CSV o nella sessione salvata.
:::

### Una lingua per ogni riga

Uno strumento che stampa il proprio testo, come Certificate, può accettare una colonna `language` con un codice lingua breve come `de`, `ja` o `ar`. Ogni riga stampa quindi il testo e la data in quella lingua. Le righe in arabo e urdu sono disposte da destra a sinistra. Una cella vuota segue la lingua dell'app. Una lingua per cui Lolly non ha ancora una traduzione viene stampata in inglese, data inclusa, così un certificato non è mai tradotto a metà.

### Batch o Render folder

Per renderizzare di nuovo sessioni già salvate, selezionale in Projects e usa **Render selection**, oppure **Render folder** per un'intera cartella. [Trova e recupera il tuo lavoro](/info/find-your-work.html#find-something-you-saved) tratta entrambe le opzioni.

<!--i:eti-layers-->
## Modifica insieme più design salvati

Spunta da due a otto sessioni salvate in **Projects** e scegli **Edit together** dalla barra di selezione. Si aprono affiancate come card live in `#/multi?s=<slot>,<slot>…`. Ogni card è un vero rendering della sua sessione e mostra ciò che verrà esportato.

Una barra laterale le controlla tutte:

- <!--i:sliders--> **Shared** viene prima: ogni input che due o più sessioni dichiarano allo stesso modo (stesso id, tipo e vincoli, la regola che la griglia batch usa per le sue colonne). Una modifica a un controllo condiviso raggiunge ogni sessione che dichiara l'input, in tempo reale su ogni card. Due sessioni dello stesso strumento condividono tutto; due strumenti diversi condividono solo gli input comuni. Il menu **Input actions** della card Shared collega un design token in ogni sessione che dichiara l'input.
- <!--i:document--> Sotto la card Shared, **una card richiusa per sessione** contiene tutti gli input di quella sessione, come nella barra laterale dello strumento, con un blocco di esportazione compatto: **Format**, **W** / **H**, **Unit**, **DPI** e **Download**. Quel Download salva prima la sessione, poi renderizza il file con lo stesso nome file, formato e Content Credentials che avrebbe dallo strumento.
- <!--i:search--> **Filter inputs…** in alto filtra i controlli su tutte le card contemporaneamente.

Fai clic su una card (o premi Enter sulla card) per aprire la card di quella sessione nella barra laterale. **Save all** salva ogni sessione nel proprio slot. **Download all** salva prima, poi renderizza l'insieme in un unico zip, come fa **Render selection** in Projects, e offre il blocco con password facoltativo.

Ogni card viene disegnata con le scelte di tema della propria sessione, compreso uno strumento inserito nel design. L'app attorno alle card mantiene i propri colori. **Save all**, i download, **Batch grid** e **Send to Print Sheet** mantengono le scelte di ogni sessione.

### Limiti

- **Al massimo otto.** Ogni card carica il proprio runtime live e otto card restano reattive. Un link che ne richiede di più, o che richiede una sessione che non esiste più, lo segnala e non esegue un caricamento parziale.
- **Il link è locale.** Indica i tuoi slot salvati e riapre quell'insieme su questo dispositivo. Non è un link di condivisione.
- **Per insiemi più grandi,** scegli **Edit as sheet** nella stessa barra di selezione. Apre la selezione come righe nella griglia batch (`#/batch?s=…`), senza limiti di dimensione e senza l'obbligo di usare lo stesso strumento. Le cartelle restano escluse da entrambe le modalità: apri una cartella nella griglia con **Sessions → Folders…**, oppure renderizzane una con **Render folder** in Projects.
- **Search non raggiunge Lolly Multi-edit.** È l'unica vista non coperta dalla barra di ricerca.

<!--i:eti-map-pin-->
## Dove proseguire

- **[Esporta un file](/info/exporting.html)**: i formati, le dimensioni e le impostazioni di stampa che ogni riga può usare.
- **[Template](/info/templates.html)**: punti di partenza adatti per la prima riga.
- **[Trova e recupera il tuo lavoro](/info/find-your-work.html)**: Projects, cartelle e rendering di ciò che hai salvato.
