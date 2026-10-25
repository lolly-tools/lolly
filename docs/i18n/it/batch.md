# Batch e Multi-edit

Quando crei spesso lo stesso tipo di file emergono due compiti. A volte servono molte versioni di un design: una scheda in una dozzina di lingue, o ogni misura di un banner. A volte hai diversi design salvati e vuoi che una modifica li raggiunga tutti, come una nuova data o un nuovo titolo.

**Batch** svolge il primo compito e **Multi-edit** il secondo. Entrambi girano sul tuo dispositivo ed esportano attraverso lo stesso percorso di rendering degli strumenti stessi.

::: cols
## Batch

- Un template, molte righe. Ogni riga è un insieme di input e produce un file.
- Compila le righe digitando, incollando da un foglio di calcolo o importando un CSV.
- Nessun limite di righe; ne vengono mostrate 50 per pagina.
- Si apre da **Batch** nell'intestazione di Projects (`#/batch`).

## Multi-edit

- Da due a otto design salvati diversi, affiancati come schede live.
- Una sola barra laterale modifica gli input che condividono, poi quelli propri di ogni scheda.
- Ogni design viene salvato di nuovo nel posto da cui proviene.
- Si apre da **Edit together** nella barra di selezione di Projects.
:::

## Crea molte versioni di un design

Apri **Projects** e premi **Batch** nella sua intestazione. La griglia parte con una riga: scegli un template al suo interno, poi duplica la riga o incolla dati dal tuo foglio di calcolo. Se aperto dall'interno di una cartella, Batch ti riporta a quella cartella.

![Batch su una griglia nuova: il nome del file e gli strumenti di riga in alto, e l'elenco dei template della prima riga aperto sugli strumenti che puoi scegliere](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Compila le righe.** Digita in una cella o incolla un blocco direttamente da Excel, Google Sheets o un altro foglio di calcolo. **Import CSV** aggiunge righe o sostituisce il batch. Quando incolli in una cella che contiene impostazioni di esportazione, Lolly chiede quale input riempie ogni colonna incollata. **Export CSV** riscrive la griglia in uscita. Apri **Columns** sotto la griglia per mostrare più input, oppure larghezza, altezza, unità e DPI per riga.

**Imposta l'output.** La barra degli strumenti imposta il nome file dello zip, il **Default format**, le unità e i DPI per ogni riga. Il menu dei formati è l'elenco raggruppato del pannello di esportazione, che mostra i formati offerti dal catalogo e supportati dal tuo browser. Una riga con un proprio formato, dimensione o nome file mantiene la propria impostazione.

**Rendering.** **Render all** esporta ogni riga in un unico `.zip`. Seleziona prima delle righe e **Render selected**, **Export selected CSV** e **Print selected rows** agiscono solo su quelle; azzera la selezione per tornare a lavorare sull'intero batch. **Print sheet** dispone le righe su un foglio stampabile. **Batch activity** riporta ogni importazione e rendering, e si richiude per lasciare più spazio alla tabella.

**Conserva il batch.** **Sessions** salva l'intera griglia come sessione batch con nome, che si riapre più tardi da Projects. Sessions salva sempre ogni riga, qualunque sia la selezione. **Folders…** nello stesso menu apre un'intera cartella di Projects come righe, una per sessione salvata, con ogni nome file che riporta il percorso della cartella.

::: details Selezionare righe e celle
Seleziona le righe con le loro caselle di controllo, oppure fai Shift-clic su una casella per un intervallo. La casella dell'intestazione seleziona la pagina corrente, e **Select all *N* rows** prende anche le righe delle altre pagine. Le selezioni restano mentre ti sposti tra le pagine. **Edit input**, **Duplicate** e **Remove** agiscono sulle righe selezionate, e **Undo remove** ripristina le righe rimosse per ultime. Da una cella in focus, Shift+Space seleziona quella riga e Escape azzera la selezione.

Trascina attraverso le celle, fai Shift-clic su una cella o usa Shift+frecce per selezionare un rettangolo. **Copy cells**, o Ctrl+C / Command+C, copia i valori per un foglio di calcolo. Ctrl+A / Command+A da una cella in focus seleziona ogni colonna visibile su ogni pagina; da una casella di riga, la stessa scorciatoia seleziona ogni riga. Selezionare celle lascia spuntate le righe già spuntate. Fai doppio clic su una cella o premi Invio per modificarne il testo. Incolla un rettangolo dagli appunti, oppure incolla un solo valore per riempire ogni cella selezionata; le celle vuote e il testo su più righe mantengono le loro posizioni.
:::

### Colourway e temi per riga

Ogni riga conserva le proprie scelte di tema: chiaro o scuro, e una colourway quando il design system ne ha. Una riga aperta da Projects, da una cartella o da un batch salvato viene renderizzata con le scelte in cui è stata salvata la sua sessione, e la sua anteprima si apre con quelle. Le mantengono anche il foglio di stampa, una riga duplicata e una riga riempita.

Un CSV porta le scelte in una colonna `_themes` dopo le colonne di dimensione, con lo stesso JSON del parametro di link `_themes`, per esempio `{"":"dark","colourway":"beach"}`. Una cella vuota, o `{}`, indica i valori predefiniti del design system. La colonna viene scritta solo quando qualche riga ha delle scelte, quindi un batch senza scelte esporta lo stesso CSV di prima. All'importazione, una cella che non contiene scelte di tema valide viene elencata come problema e la sua riga viene renderizzata con i valori predefiniti. La griglia non ha ancora un controllo per cambiare le scelte di una riga, quindi impostale nel CSV o nella sessione salvata.

### Batch, oppure Render folder

Batch crea molte varianti di un template. Per rieseguire il rendering di sessioni già salvate, selezionale in Projects e usa **Render selection**, oppure **Render folder** per un'intera cartella; [Find and recover your work](/info/find-your-work.html#find-something-you-saved) tratta entrambi.

## Modifica insieme più design salvati

Spunta da due a otto sessioni salvate in **Projects** e scegli **Edit together** dalla barra di selezione. Si aprono affiancate come schede live in `#/multi?s=<slot>,<slot>…`. Ogni scheda è un vero rendering della sua sessione, quindi ciò che vedi è ciò che verrà esportato.

Una sola barra laterale le guida tutte:

- <!--i:sliders--> **Shared** viene per prima: ogni input che due o più sessioni dichiarano allo stesso modo (stesso id, stesso tipo, stessi vincoli, la regola che la griglia batch usa per le sue colonne). Modifica un controllo condiviso una volta e il valore raggiunge ogni sessione che dichiara quell'input, dal vivo su ogni scheda. Due sessioni dello stesso strumento condividono tutto; due strumenti diversi condividono solo gli input che hanno in comune.
- <!--i:document--> Sotto, **una scheda richiudibile per sessione** contiene tutti gli input propri di quella sessione, completi come la barra laterale dello strumento stesso, con un blocco di esportazione compatto: **Format**, **W** / **H**, **Unit**, **DPI** e **Download**. Quel Download salva prima la sessione, poi esegue il rendering del file con lo stesso nome file, formato e Content Credentials che avrebbe dallo strumento.
- <!--i:search--> **Filter inputs…** in alto restringe i controlli su tutte le schede insieme, così puoi raggiungere "il titolo" in otto sessioni senza scorrere.

Fai clic su una scheda qualsiasi (o premi Invio su di essa) per aprire la scheda della barra laterale di quella sessione. **Save all** riscrive ogni sessione nel proprio slot. **Download all** salva prima, poi esegue il rendering dell'intero insieme in un unico zip, come fa **Render selection** in Projects, con il blocco con password facoltativo offerto lungo il percorso.

Ogni scheda si disegna con le scelte di tema della propria sessione, compreso uno strumento collocato dentro il design. Schede con aspetti diversi stanno affiancate mentre l'app attorno mantiene i propri colori, e **Save all**, i download, **Batch grid** e **Send to Print Sheet** conservano le scelte di ogni sessione.

### Limiti

- **Otto al massimo.** Ogni scheda monta un proprio runtime live, e otto è il numero che resta reattivo. Un link che ne chiede di più, o una sessione che non esiste più, lo dice invece di caricarsi a metà.
- **Il link è locale.** Indica i tuoi slot salvati, quindi riapre quell'insieme su questo dispositivo. Non è un link di condivisione.
- **Per qualcosa di più grande,** scegli **Edit as sheet** nella stessa barra di selezione. Apre l'intera selezione come righe nella griglia batch (`#/batch?s=…`), senza limite di dimensione e senza la regola dello stesso strumento. Le cartelle restano fuori da entrambi: apri una cartella nella griglia con **Sessions → Folders…**, oppure eseguine il rendering con **Render folder** in Projects.
- **La ricerca non raggiunge Multi-edit.** È l'unica vista che la barra di ricerca non conosce.

## Dove andare adesso

- **[Export a file](/info/exporting.html)**: i formati, le dimensioni e le impostazioni di stampa che ogni riga può usare.
- **[Template](/info/templates.html)**: punti di partenza che fanno una buona prima riga.
- **[Find and recover your work](/info/find-your-work.html)**: Projects, cartelle e rendering di ciò che hai salvato.
