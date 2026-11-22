# Usare Lolly

Apri uno strumento, modifica ciò che permette di cambiare, salva il risultato e condividilo come link o file.

Tutto viene eseguito sul tuo dispositivo senza account e funziona offline dopo aver scaricato gli strumenti e le risorse che ti servono. Per avviarsi, l'app ha bisogno di un browser o un'app con WebGPU. [Ambienti supportati](/info/supported-environments.html) elenca quelli testati.

**Il ciclo**, in quattro passaggi:

::: steps
- <!--i:eti-home--> **[Apri uno strumento](#find-your-way-around)** Fai clic su una card nella schermata iniziale. I controlli sono accanto a un'anteprima live.
- <!--i:eti-sliders--> **[Cambia gli input](#change-what-the-tool-lets-you-change)** Solo gli input lasciati aperti dall'autore. Fai clic sul design per trovare il suo controllo.
- <!--i:eti-folder-plus--> **[Salva il tuo lavoro](#saving-continuing)** **Save** lo conserva in My library e Projects lo riapre.
- <!--i:eti-link--> **[Condividi il design](#sharing-your-work)** Un link che contiene ogni input o un file `.lolly`.
:::

<!--i:eti-home-->
## Orientarsi

::: figure using-app-map
La schermata iniziale ha quattro schede in alto e una barra in basso. Uno strumento aperto mostra i controlli accanto a un'anteprima live.
:::

In cima alla schermata iniziale ci sono quattro schede: **Tools**, **Utilities**, **Assets** e **Projects**. Tools contiene gli strumenti con cui crei. Utilities converte, controlla o ripulisce un file. Assets è la tua libreria. Projects contiene ciò che hai salvato.

La barra in basso contiene **Open**, **Settings**, un campo di ricerca, una scorciatoia **Verify** per Lolly Verify e **Docs**, che apre queste guide. La barra compare in Tools, Utilities, Assets, Projects, Settings e nelle guide dentro l'app e si nasconde quando apri uno strumento. [Lolly Search](/info/search.html) trova strumenti, lavoro salvato, risorse e impostazioni da quel campo. [Ask Lolly](/info/ask.html) risponde a una domanda scritta con la sezione pertinente di queste guide.

Fai clic su una card per iniziare un nuovo lavoro con quello strumento. Il lavoro salvato si riapre da **Projects**. Alla prima visita, una fascia di benvenuto in cima alla galleria offre un'azione per iniziare: **Start making** con Lolly Demo o **Make it yours** per configurare il tuo design system.

![Una card della galleria con navigazione di esempio e un'azione New](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Ogni strumento ha una vista divisa: i **controlli** da una parte e un'**anteprima** live dall'altra. L'anteprima si aggiorna quando modifichi un controllo e ciò che vedi è ciò che esporti.

![La vista divisa di uno strumento - la colonna dei controlli a sinistra e il grafico a barre raggruppate disegnato live a destra](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Lolly Design** fa eccezione: una tela libera con box che trascini, ridimensioni e in cui scrivi, con una sua barra superiore, una timeline e controlli per i deck. La sua guida è [Lolly Design: la tela libera](/info/design.html).

<!--i:eti-sliders-->
## Modifica ciò che lo strumento permette di cambiare

Uno strumento mostra solo gli input che possono variare. L'autore ha fissato colori, layout, tipografia e logica, quindi il tuo lavoro rispetta le sue regole. Gli input comprendono testo, cursori, selettori di colore, menu a tendina, date, selettori di immagini e gruppi di righe ripetute. Alcuni si trovano in sezioni richiudibili.

![La colonna dei controlli di uno strumento - un campo di testo, selettori di colore e un cursore, senza gli elementi che l'autore ha scelto di bloccare](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Fai clic sul design per trovare il suo controllo.** Fai clic su un elemento dell'anteprima e il relativo controllo scorre in vista e riceve il focus. In un gruppo di righe ripetute si espande la riga su cui hai fatto clic.

**Clear changes**, sopra i controlli, ripristina il valore predefinito di ogni input.

**Scelte del design system.** Se il tuo design system offre più colourway, un aspetto chiaro e uno scuro o un'altra scelta di tema, le trovi nella sezione **Design system** sotto i controlli. Una scelta compare solo se ha effetto su questo strumento, quindi un'utility per file non mostra la sezione. Ogni colourway è un punto con i suoi colori, chiaro e scuro sono due pulsanti e ogni altra scelta è un elenco.

La scelta vale per questo lavoro. Viaggia nel link e nella sessione salvata. Ogni colore collegato al design system segue la scelta e i colori dell'app restano gli stessi. Lolly Design offre le stesse scelte nella scheda **Canvas** dell'Inspector. Uno strumento i cui colori costituiscono il contenuto può restare sulla colourway canonica e in quel caso non mostra punti di colourway. [Lolly Demo in uso](/info/lolly-demo-in-use.html#colourways-on-real-work) mostra le colourway su lavori reali. Per usare una colourway nell'app e per ogni nuovo lavoro, sceglila in **Settings → Appearance** ([Fai tua una colourway](/info/colourways.html#make-a-colourway-your-own)).

### Zoom e spostamento dell'anteprima

- **Zoom:** Cmd/Ctrl + scorrimento o pizzico sul trackpad, centrato sul puntatore. Con la tastiera, `0` o `Shift+1` adatta tutto, `1` o `Shift+0` imposta il 100% e `Shift+2` adatta la selezione. `+` / `−` fanno zoom attorno al puntatore se è sull'area di lavoro, altrimenti attorno al centro.
- **Spostamento:** tieni premuto **Space** e trascina, oppure trascina con il pulsante centrale del mouse. I clic semplici restano disponibili per fare clic sulle parti del design.
- **Tocco:** pizzica per fare zoom, trascina per spostare e tocca due volte per adattare.
- **HUD dello zoom:** tieni premuta la spirale di Lolly nell'angolo per mostrare `−`, **Fit** e `+`. Un tocco breve sulla spirale continua ad aprire il menu del profilo.

In Lolly Design, **Fit all** comprende artboard e livelli liberi. Lo zoom manuale può scendere sotto il 20% finché la pagina riempie metà della vista. Il limite minimo è il più basso tra il 5% della scala Fit normale e il 2% di zoom assoluto.

Cambiare la dimensione dell'output riadatta sempre la vista al contenuto.

![L'HUD dello zoom aperto dalla spirale nell'angolo della tela - meno, Fit, più, poi gli interruttori del tema e del suono e la maniglia per spostarlo](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### Annulla e ripeti

**Cmd/Ctrl-Z** torna indietro di un passaggio e **Cmd/Ctrl-Shift-Z** (o **Cmd/Ctrl-Y**) va avanti di un passaggio. I pulsanti **Undo** e **Redo** sono sopra i controlli o nella barra superiore di Lolly Design. Ogni pulsante diventa grigio quando non ha più passaggi disponibili. Un messaggio indica quale input è stato ripristinato da ogni annullamento, con un pulsante **Redo**.

- **Un trascinamento è un passaggio.** Modifiche ripetute allo stesso controllo entro mezzo secondo vengono unite in un solo passaggio.
- **Si conservano gli ultimi 100 passaggi.** Una nuova modifica dopo un annullamento svuota la pila dei passaggi successivi.
- **In una casella di testo**, Cmd/Ctrl-Z agisce sul campo, carattere per carattere. Lolly interviene per cursori, menu a tendina, colori e interruttori.
- **Scegliere un file** in un campo file non costituisce un passaggio, perché quei byte vengono conservati solo per questa sessione.

In una [collaborazione](/info/collaborate.html) live, le modifiche dell'altro dispositivo non entrano mai nella tua pila di annullamento. Puoi annullare finché non esci dallo strumento o ricarichi. Per le modifiche più vecchie, gli strumenti che salvano durante il lavoro conservano le versioni precedenti in **History** ([Torna a una versione precedente](/info/find-your-work.html#go-back-to-an-earlier-version)).

### Camera live

Gli effetti dello strumento **Filter** (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art e Glitch) offrono il pulsante **Go live** quando è disponibile una camera. Attivalo per applicare l'effetto alla webcam, fotogramma per fotogramma. L'esportazione di un'animazione registra il risultato in formato GIF, WebM o MP4. I fotogrammi vengono elaborati sul tuo dispositivo. La camera viene rilasciata appena interrompi la ripresa o esci dallo strumento. Ogni selettore di immagini offre anche **Take a photo** per acquisire un solo fotogramma.

<!--i:eti-folder-plus-->
## Salvare & continuare

Per conservare il tuo lavoro, premi **Save**, la spunta sulla pillola di rendering accanto a **Export**. I nuovi lavori vengono salvati in **My library**, quelli già salvati vengono aggiornati nella loro posizione e non viene scaricato alcun file. Lo stesso pulsante **Save** è disponibile nel pannello di esportazione.

Per scegliere la destinazione, premi **Save as**, accanto a **Download** nel pannello di esportazione. Sotto **Save to a project**, lascia selezionato **My library** oppure scegli un progetto (**＋ New project…** ne crea uno), poi premi **Save**. **Save as a template** salva il design come [template](/info/templates.html), un punto di partenza per nuovi documenti. In Lolly Design trovi **Save as** nel menu Lolly. Su un telefono, premi **•••**, poi **File menu**, poi **Save as**.

![La pillola di rendering in due metà: Export, con una freccia verso l'alto che apre il pannello di esportazione, e Save, con una spunta che salva nella posizione attuale](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> Premi **Save** sulla pillola di rendering, oppure **Save as** per scegliere un progetto.
- <!--i:folder--> L'elemento viene salvato in **My library** o nel progetto che hai scelto.
- <!--i:home--> In seguito, premi **Home** in alto a sinistra e apri la scheda **Projects**.
- <!--i:document--> Apri l'elemento. Ritrovi tutte le impostazioni, pronte da modificare per esportare di nuovo.
:::

Gli elementi prendono il nome del file che hai digitato nel pannello di esportazione oppure il nome dello strumento, come **QR Code**. Il file ottenuto con **Download** è una copia finita. Per modificarlo in seguito, apri l'elemento salvato in Projects.

::: note I salvataggi restano su questo dispositivo
I salvataggi personali restano su questo dispositivo, nel browser o nell'app da cui li hai salvati, a meno che non attivi [Sync](/info/sync.html).
:::

Se qualcosa non è dove te lo aspetti, [Trova e recupera il tuo lavoro](/info/find-your-work.html) tratta tutti i casi, da una scheda chiusa alla cancellazione dei dati del browser.

::: details Progetti del team con Lolly Work (facoltativo)
Se la tua [organizzazione usa Lolly Work](/info/organisation.html), accedi alla sua istanza e apri **Projects → Team projects** per trovare le sessioni condivise con te. L'organizzazione stabilisce accesso e conservazione, e il suo servizio Lolly Work memorizza quelle sessioni. Quando la tua organizzazione consente la modifica live, una sessione condivisa si collega alla propria collaborazione live all'apertura. [Lavorare insieme](/info/collaborate.html#collabs-through-lolly-work-optional) descrive i passaggi.

La tua libreria personale resta separata. Accedendo da un altro dispositivo trovi il lavoro del team. Per trasferire i salvataggi personali serve comunque Sync o un backup.
:::

<!--i:eti-link-->
## Condividere il tuo lavoro

Condividi un design come link o come file. **Share** nei controlli di esportazione apre una finestra che offre entrambe le opzioni. **Share link** su una sessione salvata in Projects apre la stessa finestra per quella sessione. Dopo aver inviato un file a Google Drive, Nextcloud, un bucket S3, Dropbox o OneDrive, la finestra può anche creare un link tramite quel servizio ([Esporta un file](/info/exporting.html#how-export-works)).

::: cols
## Un link

- Contiene ogni input nell'indirizzo, così il link riproduce il design.
- Esclude immagini e file aggiunti da questo dispositivo, testi molto lunghi ed elenchi molto grandi.
- Si apre in qualsiasi browser, quindi puoi salvare il link tra i preferiti, incollarlo o includerlo in un commit.

## Un file .lolly

- Contiene la sessione salvata con le immagini e i file presenti su questo dispositivo, e può includere anche lo strumento e il design system.
- Esclude la grafica del catalogo soggetta a licenza, a meno che tu non scelga di includere i file.
- Si apre in Lolly: fai doppio clic, usa **Open** o trascinalo sull'app.
:::

### Il link

Il link si trova in cima alla finestra, con **Copy** e un pulsante **QR** che apre il link nello strumento QR Code. Sotto il link, **Link options** contiene:

- **Open in the installed app** converte il link in un indirizzo `lolly://` per Shortcuts, launcher e automazioni, mantenendo invariati tutti i parametri.
- **Shortest link** comprime un design lungo in un token compatto e indica quanti caratteri risparmia. La forma leggibile resta disponibile.
- **Password-protect this link** cifra il link sul tuo dispositivo con AES-256. La password non fa mai parte del link.
- **Pin this tool version** aggiunge il flag `_v`, così un successivo aggiornamento dello strumento non può cambiare ciò che il link renderizza.
- **When the recipient opens the link…** sceglie tra schermo intero, pannello di esportazione già espanso, download all'apertura (`&export`) o copia negli appunti (`&copy`).
- **Copy credit** copia la didascalia "Made with Lolly" insieme al link, per un post o una slide.

Quando uno strumento contiene campi personali, come il tuo nome, **Review personal fields** esclude ciascuno dal link finché non lo selezioni. [Modalità URL](/info/url-mode.html) descrive tutto ciò che un link può contenere.

**La finestra indica cosa un link non può contenere.** Mentre costruisce il link, Lolly conta tutto ciò che non entra in un indirizzo. Se qualcosa è stato escluso, la finestra lo elenca e ti indirizza all'opzione file. Un link soltanto lungo riceve una nota meno marcata con il numero di caratteri.

**Alcuni strumenti fanno del link l'intero prodotto.** Jump Page raccoglie i tuoi link in un'unica pagina da distribuire: un link in bio, una presentazione o una vetrina. La pagina è il link, quindi non ci sono contenuti ospitati su un server né un account dietro la pagina. Chi la visita vede la pagina a tutta larghezza, con un link per scena mentre scorre.

![Jump Page nell'editor: la scena del titolo in cima alla pagina, con le scene dei link sotto](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Link gestiti dall'organizzazione con Lolly Work
Per le condivisioni che richiedono una scadenza, una revoca o una password, Lolly Work offre link gestiti a sessioni condivise, strumenti e risorse del catalogo. Vengono risolti tramite il servizio dell'organizzazione e seguono le sue regole di accesso. Sono separati dai link autonomi descritti sopra. Revocarne uno non può ritirare un file già scaricato da qualcuno. [Rendering e condivisione](/info/manage/sharing.html) elenca i tipi di link e le autorizzazioni.
:::

### Il file .lolly

**Download .lolly**, nella sezione **Editable file** della finestra Share, scrive il design corrente in un unico file. La normale grafica del catalogo viene inclusa insieme alle immagini e ai file di questo dispositivo. Un file obsoleto o non disponibile resta come riferimento esterno. Prima di salvare, la finestra mostra la dimensione del file, quanti file incorpora, quanti richiama tramite riferimenti e se lo strumento è incluso. Se il tuo dispositivo dispone di un pannello di condivisione, **Send to…** gli passa il file (AirDrop, condivisione Android).

**Download project (.lolly)**, nel menu di una cartella in **Projects**, scrive un'intera cartella, così un'altra persona può continuare a lavorare su tutte le sessioni che contiene. Le sessioni batch sono escluse e l'avviso ne indica il numero. **Download originals**, nello stesso menu, scrive un semplice zip con ogni elemento in un file separato.

Prima che il file venga inviato, decidi tre cose:

- **Se includere il tuo nome.** Nome, email e organizzazione vengono scritti solo quando **Use my details to create** è attivo nel [tuo profilo](/info/profile.html). Se è disattivato, il file registra soltanto che è stato creato con Lolly e quando.
- **Se includere la grafica esclusa.** La grafica soggetta a licenza e quella vincolata al brand sono escluse per impostazione predefinita, così come un'opera del catalogo la cui licenza registrata non è ancora leggibile da Lolly. Se il design ne usa, la finestra ne indica il numero e offre *Download without them* o *Include and download*. Includerle consegna i file a chiunque apra il `.lolly`. Le opere del catalogo senza informazioni registrate sui diritti vengono incluse e la finestra le elenca singolarmente, così puoi controllarle prima dell'invio. Il `CREDITS.txt` del file elenca cosa è stato incluso e cosa no, con il motivo. [Diritti creativi e crediti](/info/creative-rights.html) spiega le regole.
- **Se includere lo strumento.** **Include the tool** incorpora i file dello strumento, così il design si apre anche su un dispositivo che non lo ha. L'opzione è già selezionata per uno strumento personalizzato, come un fork, e deselezionata per uno strumento presente nel catalogo firmato. In una build senza catalogo firmato, ogni strumento è considerato personalizzato.

**Aprire un file.** Nelle app desktop e mobile, fai doppio clic o tocca un `.lolly`, scegli **Open with Lolly** oppure invialo a Lolly dal pannello di condivisione. Nell'app web, premi **Open** o trascina il file su Lolly. In tutti i casi viene prima letto il manifest del file e vengono mostrati dimensione, contenuto e operazioni previste, prima di scrivere qualsiasi cosa.

::: warning Installare uno strumento ne esegue il codice
Se il file contiene uno strumento che non hai, **Trust this tool?** mostra lo strumento e il suo autore e indica che aprirlo ne esegue il codice sul tuo dispositivo. **Trust & install** procede con l'operazione.
:::

Se rifiuti, il lavoro viene comunque salvato in Projects e resta in attesa che tu aggiunga lo strumento. Uno strumento il cui codice è distribuito come modulo non può ancora essere installato in questo modo e viene rifiutato allo stesso modo.

::: details Cosa contiene un .lolly e come funziona la sua apertura
`.lolly` è l'estensione dei pacchetti di Lolly e il `format` nel suo `manifest.json` indica cosa contiene:

- Un **design condiviso** (`lolly-share`) contiene una sessione salvata, i file incorporati e una ricevuta per tutto ciò che viene ancora risolto tramite riferimento. Può contenere anche lo strumento e il design system. Aprirlo aggiunge un nuovo Project e non sovrascrive mai una sessione.
- Un **progetto condiviso** (`lolly-share`, tipo `project`) contiene una cartella di Projects: le sue sottocartelle, tutte le sessioni al loro interno con la rispettiva miniatura e le immagini archiviate lì. Aprirlo aggiunge una copia della cartella. Ogni sessione è inclusa come `sessions/<key>.json`, con la miniatura sotto `thumbs/`. Una versione di Lolly precedente all'introduzione dei file di progetto ti chiede di aggiornare.
- Un **pacchetto di design system** (`lolly-brand`) contiene token e può contenere font, loghi, versioni pubblicate e risorse conservate. Aprire il pacchetto aggiunge un design system separato con un nome e lo rende attivo.
- Un **pacchetto di spazio di lavoro o istanza** è un `lolly-brand` con strumenti dichiarati, risorse del catalogo ed eventualmente l'indirizzo di un'istanza. Caricarne uno sostituisce l'unico overlay dello spazio di lavoro caricato in precedenza e l'anteprima elenca gli effetti che si applicano all'intero dispositivo.

Un backup completo del dispositivo non è un `.lolly`. Rimane un `LollyTools-….zip` (formato `lolly-backup`) e si ripristina tramite **Settings → Storage → Import data…**. Anche una cartella di strumento compressa resta un `.zip`. [Trasferimento dei dati](/info/data-transfer.html) è il riferimento per i formati.

Un `.lolly` è un normale zip. Rinominalo `.zip` per guardarci dentro. Le tue immagini si trovano in `assets/uploads/` e la grafica del catalogo in `assets/catalog/`. `manifest.json` elenca ogni file e un README descrive il file.

macOS, Windows, Linux, iOS e Android registrano tutti il formato. I gestori di file desktop mostrano il file come documento Lolly e GNOME Files può mostrare la miniatura della sessione salvata. L'apertura da Lolly Design System Setup consiglia l'azione per il design system quando un design condiviso ne contiene uno, ma non nasconde mai **Open shared design**.

Su iOS o Android, un documento ricevuto da un'altra app ha un limite di 48 MB e l'app lo indica. Il trasferimento copia i byte da un'app all'altra. **Open** all'interno di Lolly non ha questo limite, quindi usalo per un pacchetto più grande.

Dopo la conferma, Lolly decomprime e verifica il pacchetto una sola volta. Le risorse vanno nella tua libreria e vengono confrontate tramite checksum, così un file già sul dispositivo viene riutilizzato. Le sessioni vanno in Projects con nuovi id, quindi lo stesso file può essere aperto due volte. Una sessione il cui strumento manca resta lì in attesa. I file sopra i 100 MB vengono segnalati come grandi e l'anteprima avvisa se l'archiviazione del browser segnala meno spazio libero di quanto serva al file. Ogni parte coperta dalla verifica di integrità viene controllata prima di confermare qualsiasi scrittura e una copia danneggiata viene rifiutata senza lasciare residui.
:::

Sia un link sia un file consegnano un'istantanea. Per la modifica live, [Lavorare insieme](/info/collaborate.html) tratta le collaborazioni private tra due dispositivi e le collaborazioni di lavoro facoltative tramite Lolly Work.

<!--i:eti-images-->
## Assets - la tua libreria

**Lolly Assets** (`#/a`) contiene ciò che i tuoi strumenti possono usare: loghi del brand, immagini, audio e animazioni, raggruppati per tipo, e i tuoi file. I file che carichi sono memorizzati sul tuo dispositivo. Un'organizzazione che usa Lolly Work può anche fornire un catalogo condiviso con le proprie regole di accesso ([Usa Lolly nella tua organizzazione](/info/organisation.html)).

![Assets, con i campioni di colore e i font del brand e i tuoi caricamenti](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Importa i tuoi file.** Trascina un'immagine, un SVG, una clip audio, un video, un Lottie, un PDF o un deck PowerPoint sull'area di caricamento, oppure fai clic per scegliere. Il file compare subito in Assets e nel selettore di risorse di ogni strumento. Un PDF multipagina o un `.pptx` chiede quali pagine o slide conservare e ognuna diventa una risorsa SVG. Un'immagine aggiunta all'interno di uno strumento viene conservata senza modifiche in **My images**, così un'eventuale Content Credential continua a essere verificabile. Solo un file molto grande chiede se ridimensionarlo. **Settings → Storage** mostra quanto spazio occupa **My images**. Non ci sono limiti oltre allo spazio disponibile sul dispositivo. Per rimuovere i dati EXIF e GPS al caricamento, attiva **Strip metadata from uploads** in **Settings → Feature flags**. Le Content Credentials vengono conservate in entrambi i casi.
- <!--i:star--> **Aggiungi ai preferiti ciò che usi spesso.** Assegna una stella a una risorsa o a un campione di colore del brand per fissarlo in cima a ogni selettore.
- <!--i:folder--> **Fai ordine.** Sposta una risorsa in un altro gruppo, nascondi una risorsa condivisa del brand che non usi (**Show hidden** la mostra di nuovo) oppure elimina i tuoi caricamenti. La stessa barra di selezione di Projects agisce su tutta la selezione.
- <!--i:layers--> **Separa un video dallo sfondo.** Apri i dettagli di un video oppure fai clic destro sulla sua card in un selettore di risorse e scegli **Remove background…**. Un **On-device model** scontorna un soggetto da una scena complessa. Un **Colour key** rimuove uno sfondo illuminato in modo uniforme, come un green screen, e non richiede download. **Tolerance**, **Softness** e **Spill removal** regolano il bordo. **Resolution** (360, 480, 720 o 1080p, mai oltre la sorgente) bilancia dettaglio e velocità. Il risultato scontornato è un WebP o PNG animato con trasparenza, salvato accanto all'originale. La Content Credential della sorgente accompagna il risultato come ingrediente. [Generato una volta, renderizzato allo stesso modo](/info/ai-features.html) spiega perché resta una semplice modifica.

### Porta la tua palette e i tuoi font ovunque

Il pannello **Swatches** in Assets mostra i colori del tuo brand: i colori del brand, quelli che hai aggiunto, le rampe e lo spettro. I colori di ruolo che Lolly riserva all'interfaccia (testo, superfici, bordi, colori principali delle colourway e copie di un colore del brand sotto un altro nome) si trovano dietro una card grigia **Show colour roles** in fondo al pannello.

Ogni colore è una card come qualsiasi altra risorsa. Fai clic su un colore per aprirne i dettagli, selezionane alcuni per scaricarli oppure scarica l'intera palette nel formato letto dall'altro strumento che usi:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** o **CSS classes**, per un foglio di stile o una build. Un colore con gamut più ampio di sRGB conserva il suo valore esteso: il CSS lo imposta dopo il valore esadecimale e il JSON conserva il valore esadecimale insieme al colore esteso, alla composizione CMYK e all'inchiostro a tinta piatta.
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**, per Illustrator o Photoshop. Un colore vincolato a una composizione CMYK arriva come campione CMYK, un inchiostro a tinta piatta come campione a tinta piatta con nome e un colore con gamut più ampio di sRGB come Lab.
- <!--i:pentool--> **GIMP palette (.gpl)**, per GIMP o Inkscape, e **SCSS variables**, entrambi in sRGB.

![Il pannello Swatches - i cinque pulsanti per scaricare la palette in alto, poi ogni colore del brand come chip che apre i suoi dettagli](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

::: details Selezionare più colori o aprire i dettagli di un colore
Seleziona i colori con il punto su ogni card: fai Shift-clic su un secondo punto per selezionare tutto ciò che sta in mezzo, trascina un riquadro negli spazi vuoti oppure premi Cmd/Ctrl+A quando una card ha il focus. La barra offre **Download as…** negli stessi sei formati, **Copy hex** e **Favourite**. Prima che tu scelga un formato, il menu elenca i colori che nessun formato può contenere (Transparent non ha un colore), i formati che salvano un colore esteso usando il valore sRGB di riserva (SCSS e GIMP) e quelli che conservano i valori CMYK e a tinta piatta (JSON e .ase). Fai clic destro su una card per le stesse azioni su un solo colore.

I dettagli di un colore riempiono l'anteprima con quel colore e mostrano le sezioni espandibili **Linked values** (la sua composizione CMYK o l'inchiostro a tinta piatta, gli eventuali valori definiti per uno spazio o una macchina da stampa specifici e il suo design token), **Every notation** (esadecimale, OKLCH, Display-P3 e le altre, ciascuna con un pulsante di copia), **Plotted on a colour space**, **Tones** e **Readability**. I tasti freccia scorrono la palette, **Copy link** condivide il colore e **Open in Colour Lab** lo apre per continuare a lavorarci.
:::

Il pannello **Fonts** elenca i caratteri del tuo brand, ciascuno con un **download** per installarlo localmente o consegnarlo a una tipografia.

<!--i:eti-grid-->
## Personalizza la griglia

- <!--i:star--> **Aggiungi ai preferiti ciò che usi.** Fai clic destro su una card e scegli **Add to favourites**. Lo strumento ottiene una grande tessera in una striscia sopra la griglia. [I tuoi preferiti](/info/favourites.html) descrive la striscia.
- <!--i:eyeoff--> **Nascondi uno strumento che non usi mai.** Fai clic destro su una card, oppure selezionane diverse, e scegli **Hide tool**. Scompare dalla griglia e dai risultati ottenuti digitando nella griglia. Lo strumento lascia la griglia e non viene più trovato quando digiti nella griglia. Una tessera grigia **Show hidden tools (N)** in fondo mostra di nuovo gli strumenti nascosti, attenuati, ciascuno con **Unhide tool** nel proprio menu. Nascondere cambia solo la tua griglia: lo strumento si apre ancora da un link o da un preferito del browser.
- <!--i:clock--> **Prima i tuoi strumenti.** Dopo aver salvato lavori in tre strumenti diversi, una riga **Yours** di chip sopra la griglia mette in testa i preferiti e gli strumenti recenti.
- <!--i:sliders--> **Scegli la disposizione.** **View options** imposta il layout (**Grid**, **Card** o **List**), dimensione e densità delle card, ordine di visualizzazione e filtro per categoria.

![Il fondo della griglia Tools con gli strumenti nascosti rivelati: la card Wordmark attenuata e, accanto, la tessera grigia che l'ha resa di nuovo visibile e che ora mostra Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed the tile. The alt says so rather than quoting the resting
label the prose above already gives.
The recipe hides nothing itself. The lolly-demo catalog the captures pin
ships Wordmark hidden (`defaultHiddenTools` in its assets index.json), so a
fresh profile already has one hidden tool and the recipe only clicks the grey
reveal tile (`.gtile--hiddenbox`, confirmed in gallery.ts). It used to tick
the QR Code card and press the bulk bar's Hide button first; under lolly-demo
that published Wordmark dimmed and QR Code not, under a caption naming QR
Code, so the steps were dropped rather than relied on. QR Code was hidden
in that run too: the End scroll had left the pointer over its card, and a
hovered hidden card lifts its dimming (gallery.css), so it read as a normal
tool. The closing `hover:` puts the pointer back on the reveal tile, which
keeps every revealed card dimmed.
-->

**Agisci su più card insieme.** Seleziona la casella di ogni card, trascina un riquadro di selezione nello spazio vuoto oppure fai Shift/Cmd-clic e compare una barra con le azioni consentite dalla vista:

- **Tools e Utilities:** Favourite, Hide, Available offline, **View sessions** (Projects, con solo le sessioni create con quegli strumenti) e Copy link per una singola card.
- **Assets:** Favourite e Hide per qualsiasi selezione. Duplicate, Download e Delete compaiono solo se tutti gli elementi selezionati sono tuoi caricamenti, perché una risorsa condivisa del design system è un contratto permanente.
- **Projects:** vedi [Trova e recupera il tuo lavoro](/info/find-your-work.html#find-something-you-saved).

![La barra di selezione della galleria per due strumenti, con Available offline, View sessions, Favourite e Hide](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
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

**View sessions** compare solo quando qualcosa è selezionato. Fai clic destro su una singola card non selezionata per **N saved sessions**: un elenco delle sessioni salvate di quello strumento, in cui l'eliminazione sposta la sessione nel Trash.

<!--i:eti-layers-->
## Su un telefono

Su uno schermo stretto il layout passa a una sola colonna:

- I **controlli diventano un pannello** in alto con una maniglia sul bordo inferiore. Trascinala per passare a **vista ridotta**, **metà schermo** o **schermo intero**, oppure toccala per comprimere ed espandere. L'anteprima riempie lo spazio sottostante e resta visibile mentre modifichi.
- Un pulsante **Export** flottante apre il pannello di esportazione: formato, dimensione, copia, salvataggio e download. Tocca lo sfondo per chiudere il pannello.

![Uno strumento su uno schermo largo quanto un telefono - i controlli in un pannello in alto, la palette generata che riempie l'anteprima sotto e la pillola di rendering flottante in basso al centro](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

<!--i:eti-copy-->
## Pieghevoli e iPhone Duo

Su un pieghevole, un iPhone Duo o un touch screen quasi quadrato, Lolly dispone lo strumento in due pannelli:

- **Controlli da un lato, tela dall'altro.** I controlli si trovano lontano dalla mano con cui disegni. Scegli **Dominant hand** in **Settings → Accessibility** oppure premi **Swap sides** in cima ai controlli. In una lingua da destra a sinistra i lati si invertono.
- **Il divisore è la cerniera.** Quando il dispositivo segnala la piega, i pannelli si incontrano lì, così nessun controllo o elemento grafico si trova sulla piega. Su uno schermo continuo, trascina il divisore a un terzo, metà o due terzi della larghezza. Lolly ricorda la scelta per ogni vista su questo dispositivo.
- **Sul tavolo.** Con il dispositivo aperto a metà e la piega trasversale allo schermo, la tela occupa la metà superiore e i controlli si trovano sotto la piega. Durante una presentazione, la slide è in alto, con le tue note, la slide successiva e **Back** e **Next** sotto. In Sequence, l'anteprima è in alto e la timeline sotto.
- **Lolly Design, Design System Setup e Assets.** In Lolly Design, l'Inspector, i livelli e il pannello di esportazione sono schede accanto alla tela. Gli strumenti si dispongono lungo il bordo esterno della tela, sotto la mano con cui disegni. Quando non c'è spazio per tutti, la colonna scorre e una sfumatura con una freccia indica in quale direzione si trovano gli altri. Sul tavolo, gli strumenti si dispongono lungo il bordo inferiore della tela. Lolly Design System Setup mantiene la Board da un lato e la stanza che apri dall'altro. In Assets, i dettagli di una risorsa si aprono accanto alla libreria, così il tocco successivo mostra la risorsa seguente nello stesso posto.
- **Niente sulla piega.** Quando viene segnalata una piega, le finestre di dialogo si aprono sulla pagina con i controlli. Lo stesso vale per la casella di ricerca in fondo alla schermata iniziale e i suoi risultati. Su uno schermo piatto restano al centro.
- **Piegare non fa perdere nulla.** Piegare, aprire o ruotare il dispositivo conserva il documento, la selezione, lo zoom e il campo in cui stavi scrivendo, con il cursore al suo posto.

Lo schermo esterno di un pieghevole mantiene il layout per telefono descritto sopra, così come una finestra di Lolly in una metà di uno schermo diviso.

<!--i:eti-smile-->
## Impostazioni, suono e comfort

**Settings**, in fondo alla schermata iniziale, contiene i tuoi dati, i tuoi design system, l'accessibilità, l'archiviazione e i download offline. [Lolly Settings](/info/dashboard.html) descrive tutte le schede.

- **I tuoi dati e la foto del profilo** compilano gli strumenti predisposti a usarli, come una firma email o un badge. [Profili](/info/profile.html) li descrive.
- **Accessibility** ha quattro interruttori per il comfort: **Reduce motion**, **Hide colourful previews**, **High contrast** e **Large text**. Modificano l'app attorno al tuo lavoro, mai la tela di uno strumento o un'esportazione. Accanto, **Dominant hand** sceglie il lato dei controlli nella vista a due pannelli.
- **Sound** riproduce suoni delicati che accompagnano le tue azioni e **Neurospicy Mode** riproduce una traccia tranquilla per concentrarti. Entrambi restano disattivati finché non li attivi in **Settings → Accessibility** o nel menu del profilo. Il cursore **Sound shape** sotto l'interruttore Sound sposta i suoni da gocce morbide e rotonde (Bouba) a ticchettii e graffi secchi (Kiki), con i rintocchi di Lolly al centro. Le tracce di Neurospicy includono le stazioni generate da Lolly: **Lolly Sings** e i suoi generi e tre **Lofi stations**. Le stazioni creano musica senza fine durante la riproduzione. Ciascuna ha controlli per batteria e texture (e atmosfera, su Lofi), un link per condividere il brano che ascolti e un pulsante che lo salva nelle tue risorse. [Musica generata](/info/generated-music.html) spiega come viene creato un brano. **Music generator** sotto Utilities (`#/music`) ti permette di modellarne uno.
- **Available offline** scarica il resto dell'app, i tuoi strumenti, il catalogo e le guide prima che tu perda la connessione. Per installare Lolly come app web, usa il pulsante di installazione del browser oppure *Add to Home Screen* su un telefono. L'app installata funziona a schermo intero e si aggiorna da sola quando torni online.
- **Performance UI**, in **Settings → Feature flags**, dà all'app un aspetto più semplice che richiede meno risorse per essere disegnato. Le tele degli strumenti e le esportazioni restano uguali. Su un dispositivo lento, Lolly attiva questo aspetto da sé e spiega perché, con **Undo** e **Keep** ([Performance UI](/info/configuration.html#curating-what-people-see)).
- **Storage** mostra ciò che Lolly conserva su questo dispositivo. [Se cancelli i dati del browser](/info/find-your-work.html#if-you-clear-your-browser-data) spiega cosa viene rimosso e l'[Informativa sulla privacy](/info/privacy.html) elenca tutto ciò che l'app recupera o invia.

::: note Se una vista non si carica dopo un aggiornamento
Un pannello vuoto o un messaggio "failed to fetch" subito dopo un aggiornamento di solito si risolve ricaricando una volta. Lavori salvati, sessioni e design system restano intatti perché sono memorizzati sul tuo dispositivo. Potresti dover aggiungere di nuovo soltanto un'immagine inserita e mai salvata.
:::

<!--i:eti-map-pin-->
## Dove proseguire

- **[Lolly Design: la tela libera](/info/design.html)**: la tela, le forme, la timeline e la presentazione di un deck.
- **[Batch e Lolly Multi-edit](/info/batch.html)**: molte versioni di un design o più design salvati modificati insieme.
- **[Esporta un file](/info/exporting.html)**: scegliere formato, dimensione, unità di stampa, trasparenza e video.
- **[Importa un design](/info/design-import.html)**: importa un file Figma, Penpot, Illustrator, InDesign, Affinity o DXF in Lolly Design e continua a modificarlo.
- **[Template](/info/templates.html)**: punti di partenza salvati per uno strumento.
- **[Gamut esteso e HDR](/info/hdr-editing.html)**: conserva la precisione originale delle immagini in Lolly Design e Lolly Darkroom.
- **[Trova e recupera il tuo lavoro](/info/find-your-work.html)**: dove si trova ogni cosa e come trasferirla a un altro dispositivo.
