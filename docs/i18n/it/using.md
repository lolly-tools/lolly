# Usare Lolly

Hai Lolly aperto e vuoi creare qualcosa, conservarlo e inviarlo. Questa pagina percorre quel ciclo: apri uno strumento, cambia ciò che ti lascia cambiare, salva il risultato e condividilo come link o come file.

Tutto qui gira sul tuo dispositivo, senza account, e continua a funzionare offline una volta scaricati gli strumenti e le risorse che ti servono. Per avviarsi, l'app richiede un browser o un'app con WebGPU; [Supported environments](/info/supported-environments.html) elenca quelli testati.

## Orientarsi

::: figure using-app-map
La schermata iniziale: quattro schede in alto e la barra in basso. Uno strumento, una volta aperto, mostra i suoi controlli accanto a un'anteprima live.
:::

In alto nella schermata iniziale corrono quattro schede: **Tools**, **Utilities**, **Assets** e **Projects**. Gli strumenti sono ciò con cui crei, le Utility sono banchi di lavoro per compiti come convertire, controllare o ripulire un file, Assets è la tua libreria e Projects contiene ciò che hai salvato.

La barra in basso contiene **Open**, **Settings**, un campo di ricerca, **Verify** e **What?**. Compare in Tools, Utilities, Assets, Projects, Settings e nelle guide che leggi nell'app, e si fa da parte quando uno strumento è aperto. [Search](/info/search.html) raggiunge da quel campo i tuoi strumenti, il lavoro salvato, le risorse e le impostazioni. [Ask Lolly](/info/ask.html) risponde a una domanda scritta con la sezione corrispondente di queste guide.

Fai clic su una scheda per iniziare qualcosa di nuovo in quello strumento. Il lavoro salvato si riapre invece da **Projects**.

![Una card della galleria con navigazione di esempio e un'azione Nuovo](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Ogni strumento è una vista divisa: i **controlli** da un lato e un'**anteprima** live dall'altro. Cambia un controllo e l'anteprima lo segue subito, e ciò che vedi è ciò che viene esportato.

![La vista divisa di uno strumento - la pila di controlli a sinistra, e il grafico a barre raggruppate in tempo reale che disegna a destra](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Design** è l'eccezione. Si apre come tela libera di box che trascini, ridimensioni e in cui scrivi, con una propria barra superiore, una timeline e controlli per i deck. [Design: the free canvas](/info/design.html) è la sua guida.

## Cambia ciò che lo strumento ti lascia cambiare

Uno strumento mostra solo gli input pensati per variare. Il suo autore ha già fissato colori, layout, tipografia e logica, quindi tutto ciò che crei rispetta le sue regole. Gli input includono testo, cursori, selettori di colore, menu a tendina, date, selettori di immagini e gruppi di righe ripetute, e alcuni stanno in sezioni richiudibili.

![La colonna dei controlli di uno strumento - un campo di testo, i selettori di colore e uno slider e nient'altro, perché il resto l'autore ha scelto di bloccarlo](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Fai clic sul design per trovare il suo controllo.** Fai clic su qualsiasi elemento dell'anteprima e il controllo corrispondente riceve il focus e scorre in vista. In un gruppo di righe ripetute si apre la riga esatta su cui hai fatto clic.

**Clear changes**, sopra i controlli, riporta ogni input al suo valore predefinito.

**Scelte del design system.** Quando il tuo design system offre più di una colourway, un aspetto chiaro e uno scuro o un'altra scelta di tema, una sezione **Design system** sotto i controlli le contiene. Una scelta compare solo quando cambia questo strumento, quindi un'utility per file non mostra alcuna sezione. Ogni colourway è un punto nei propri colori, chiaro e scuro sono due pulsanti e ogni altra scelta è un elenco.

La scelta appartiene a questo pezzo. Viaggia nel link e nella sessione salvata, ogni colore collegato al design system la segue e i colori dell'app stessa restano invariati. Design mostra le stesse scelte nella scheda **Canvas** dell'Inspector. Uno strumento i cui colori sono il suo contenuto può restare sulla colourway canonica, e allora non offre punti di colourway. [Lolly Demo in use](/info/lolly-demo-in-use.html#colourways-on-real-work) mostra le colourway su lavoro reale.

### Zoom e spostamento dell'anteprima

L'anteprima mostra sempre esattamente ciò che verrà esportato.

- **Zoom:** Cmd/Ctrl + scorrimento o pizzico su un trackpad, centrato sul puntatore. Da tastiera, `0` adatta alla finestra, `1` è 100% e `+` / `−` fanno zoom.
- **Spostamento:** tieni premuto **Space** e trascina, oppure trascina con il tasto centrale del mouse. I semplici clic restano liberi per fare clic sulle parti del design.
- **Tocco:** pizzica per fare zoom, trascina per spostare e tocca due volte per adattare.
- **HUD dello zoom:** tieni premuta la spirale di Lolly nell'angolo per aprire `−`, **Fit** e `+`. Un tocco breve sulla spirale apre comunque il menu del tuo profilo.

Un cambio di dimensione dell'output riporta sempre la vista a un adattamento pulito.

![L'HUD dello zoom aperto dalla spirale nell'angolo della tela - meno, Fit, più, poi gli interruttori di tema e suono e la maniglia che lo sposta](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### Annulla e ripeti

**Cmd/Ctrl-Z** torna indietro e **Cmd/Ctrl-Shift-Z** (o **Cmd/Ctrl-Y**) va avanti. La stessa coppia è presente come pulsanti **Undo** e **Redo** sopra i controlli (in Design sono nella barra superiore), e ciascuno si disattiva quando non c'è più nulla da annullare. Un messaggio indica quale input ogni annullamento ha ripristinato, con un pulsante **Redo** nel messaggio.

- **Un trascinamento è un solo passaggio.** Modifiche ripetute a un controllo entro mezzo secondo si fondono, quindi trascinare un cursore lungo tutto il suo intervallo è un unico annullamento.
- **Vengono conservati gli ultimi 100 passaggi.** Una nuova modifica dopo un annullamento svuota la pila in avanti.
- **In una casella di testo**, Cmd/Ctrl-Z appartiene al campo, carattere per carattere. Lolly interviene per cursori, menu a tendina, colori e interruttori.
- **Scegliere un file** in un campo file non è un passaggio, perché quei byte vengono tenuti solo per questa sessione.

In una [collaborazione](/info/collaborate.html) live la tua cronologia resta tua: una modifica dell'altro dispositivo non finisce mai nella tua pila. L'annullamento dura finché non lasci lo strumento o ricarichi. Per qualcosa di più vecchio, gli strumenti che salvano mentre lavori conservano le versioni precedenti in **History**; vedi [Go back to an earlier version](/info/find-your-work.html#go-back-to-an-earlier-version).

### Camera live

Gli effetti dello strumento **Filter** (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art e Glitch) mostrano un pulsante **Go live** dove è disponibile una camera. Attivalo e l'effetto segue la tua webcam fotogramma per fotogramma, e un'esportazione di animazione registra il risultato come GIF, WebM o MP4. I fotogrammi vengono elaborati sul tuo dispositivo e la camera viene rilasciata nel momento in cui ti fermi o lasci lo strumento. Ogni selettore di immagini ha anche **Take a photo** per un singolo fotogramma.

## Salvare e continuare

Per conservare il lavoro, premi **Save**, la spunta accanto a **Export** sulla pillola di rendering. Il lavoro nuovo va in **My library**, quello salvato in precedenza viene aggiornato dov'è e non viene scaricato nulla. Il pannello di esportazione ha lo stesso pulsante **Save**.

Per scegliere dove va, premi **Save as**, accanto a **Download** nel pannello di esportazione. In **Save to a project**, lascia selezionato **My library** o scegli un progetto (**＋ New project…** ne crea uno), poi premi **Save**; **Save as a template** conserva il design come [template](/info/templates.html), un punto di partenza per nuovi documenti. In Design, **Save as** è nel menu Lolly; su un telefono premi **•••**, poi **File menu**, poi **Save as**.

![La pillola di rendering in due metà: Export, con una freccia in su che apre il pannello di esportazione, e Save, con una spunta che salva sul posto](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> Premi **Save** sulla pillola di rendering, oppure **Save as** per scegliere un progetto.
- <!--i:folder--> L'elemento va in **My library**, o nel progetto che hai scelto.
- <!--i:home--> Più tardi, premi **Home** in alto a sinistra e apri la scheda **Projects**.
- <!--i:document--> Apri l'elemento. Ogni impostazione è tornata, pronta per essere modificata ed esportata di nuovo.
:::

Gli elementi prendono il nome dal nome file che hai digitato nel pannello di esportazione, o altrimenti dal loro strumento, come **QR Code**. Un file ottenuto con **Download** è una copia finita; per modificarlo più tardi, apri l'elemento salvato in Projects.

I salvataggi personali restano su questo dispositivo, nel browser o nell'app da cui hai salvato, a meno che tu non attivi [Sync](/info/sync.html). Se qualcosa non è dove te lo aspetti, [Find and recover your work](/info/find-your-work.html) tratta ogni caso, da una scheda chiusa ai dati del browser cancellati.

::: details Progetti di team con Lolly Work (facoltativo)
Se la tua [organizzazione usa Lolly Work](/info/organisation.html), accedi alla sua istanza e apri **Projects → Team projects** per le sessioni condivise con te. L'organizzazione imposta accesso e conservazione, e il suo servizio Lolly Work conserva quelle sessioni. Una sessione condivisa entra nella sua collab live all'apertura quando la tua organizzazione consente la modifica live; [Working together](/info/collaborate.html#work-collabs-with-lolly-work-optional) spiega i passaggi.

La tua libreria personale resta separata. Accedere su un altro dispositivo ti dà il lavoro di team, mentre i salvataggi personali richiedono comunque Sync o un backup per spostarsi.
:::

## Condividere il tuo lavoro

Un design esce come link o come file. **Share** nei controlli di esportazione apre una finestra che offre entrambi, e **Share link** su una sessione salvata in Projects apre la stessa finestra per quella sessione.

::: cols
## Un link

- Porta ogni input nell'indirizzo, quindi il link riproduce il design.
- Lascia fuori le immagini e i file aggiunti da questo dispositivo, i testi molto lunghi e gli elenchi molto grandi.
- Si apre in qualsiasi browser, quindi puoi aggiungerlo ai preferiti, incollarlo o inserirlo in un commit.

## Un file .lolly

- Porta la sessione salvata con le immagini e i file presenti su questo dispositivo, e può portare anche lo strumento e il design system.
- Trattiene la grafica del catalogo con licenza, a meno che tu non scelga di includere i file.
- Si apre in Lolly: fai doppio clic, usa **Open** o trascinalo sull'app.
:::

### Il link

Il link pronto da copiare si trova in cima alla finestra, con **Copy** e un pulsante **QR** che apre lo strumento QR Code sul link. Sotto il link, **Link options** contiene:

- **Open in the installed app** trasforma il link in un indirizzo `lolly://` per Comandi rapidi, launcher e automazioni, con ogni parametro invariato.
- **Shortest link** comprime un design lungo in un token compatto e mostra il risparmio in caratteri. È sempre disponibile anche la forma leggibile.
- **Password-protect this link** cifra il link sul tuo dispositivo con AES-256. La password non fa mai parte del link.
- **Pin this tool version** aggiunge il flag `_v`, così un aggiornamento successivo dello strumento non può cambiare ciò che il link renderizza.
- **When the recipient opens the link…** sceglie schermo intero, il pannello di esportazione già espanso, un download all'apertura (`&export`) o una copia negli appunti (`&copy`).
- **Copy credit** copia una didascalia "Made with Lolly" insieme al link, per un post o una slide.

Quando uno strumento contiene campi personali, come il tuo nome, **Review personal fields** tiene ciascuno fuori dal link finché non spunti quel campo. [URL mode](/info/url-mode.html) tratta tutto ciò che un link può portare.

**La finestra dice cosa un link non può portare.** Un'immagine o un file aggiunti da questo dispositivo, un valore di testo molto lungo e un elenco molto grande non entrano in un indirizzo. Ognuno viene contato mentre il link viene costruito. Se qualcosa ha dovuto essere scartato, la finestra lo elenca e ti indirizza all'opzione file, invece di consegnarti un link che si apre con un'immagine mancante. Un link che è solo lungo riceve una nota più lieve con il numero di caratteri.

**Alcuni strumenti fanno del link l'intero prodotto.** Jump Page raccoglie i tuoi link in un'unica pagina da distribuire: un link in bio, un intervento, una vetrina. Nulla è ospitato e dietro la pagina non c'è alcun account, perché la pagina è il link. Un visitatore la vede a tutta larghezza, un link per scena mentre scorre.

![Jump Page nell'editor: la scena del titolo nella parte superiore della pagina, con le scene dei link sotto](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Link gestiti dall'organizzazione con Lolly Work
Per una condivisione che richiede scadenza, revoca o password, Lolly Work offre link gestiti a sessioni condivise, strumenti e risorse del catalogo. Si risolvono attraverso il servizio dell'organizzazione e seguono le sue regole di accesso. Sono separati dai link autonomi descritti sopra, e revocarne uno non può richiamare un file che qualcuno ha già scaricato. [Rendering and sharing](/info/manage/sharing.html) elenca i tipi di link e i permessi.
:::

### Il file .lolly

**Download .lolly**, nella sezione **Editable file** della finestra Share, scrive il design corrente come un unico file. Porta la sessione salvata con le immagini e i file presenti su questo dispositivo, e con esso viaggia anche la normale grafica del catalogo. Un file obsoleto o non disponibile resta un riferimento esterno invece di sparire. Prima di salvare, la finestra mostra la dimensione del file, quanti file incorpora, quanti ne referenzia e se lo strumento è incluso. Dove il tuo dispositivo ha un foglio di condivisione, **Send to…** gli passa direttamente il file (AirDrop, una condivisione Android).

**Download project (.lolly)**, nel menu di una cartella in **Projects**, scrive un'intera cartella, così qualcun altro può proseguire con ogni sessione della cartella. Le sessioni batch restano escluse, e l'avviso dice quante. **Download originals**, nello stesso menu, scrive uno zip semplice di ogni elemento come file a sé.

Tre cose spetta a te decidere prima che un file parta:

- **Se il tuo nome è incluso.** Il tuo nome, l'email e l'organizzazione vengono scritti solo quando **Use my details to create** è attivo nel [tuo profilo](/info/profile.html). Se è disattivato, il file registra solo che è stato creato con Lolly, e quando.
- **Se la grafica trattenuta è inclusa.** La grafica con licenza, quella bloccata dal brand e le opere del catalogo la cui licenza non è mai stata registrata restano fuori per impostazione predefinita. Se il design ne usa qualcuna, la finestra dice quante e offre *Download without them* o *Include and download*, perché includerle consegna i file a chiunque apra il `.lolly`. Il `CREDITS.txt` del file elenca cosa è stato incluso e cosa no, con il motivo; [Creative rights and credits](/info/creative-rights.html) spiega le regole.
- **Se lo strumento è incluso.** **Include the tool** impacchetta i file dello strumento stesso, così il design si apre su un dispositivo che non ha quello strumento. Parte spuntato per uno strumento personalizzato, come un fork, e non spuntato per uno strumento che il catalogo firmato elenca. In una build senza catalogo firmato, ogni strumento conta come personalizzato.

**Aprirne uno.** Nelle app desktop e mobile, fai doppio clic o tocca un `.lolly`, scegli **Open with Lolly** o invialo a Lolly dal foglio di condivisione. Nell'app web, premi **Open** o trascina il file su Lolly. Ogni percorso legge prima il manifest del file e ne mostra dimensione, contenuto e cosa succederà, prima che venga scritto qualsiasi cosa.

Se il file porta uno strumento che non hai, **Trust this tool?** mostra lo strumento e il suo autore, e dice che aprirlo esegue sul tuo dispositivo il codice dello strumento stesso. **Trust & install** procede. Se rifiuti, il lavoro viene comunque salvato in Projects, in attesa del giorno in cui aggiungerai lo strumento. Uno strumento il cui codice è distribuito come modulo non può ancora essere installato in questo modo e viene respinto allo stesso modo.

::: details Cosa contiene un .lolly e come funziona l'apertura
`.lolly` è l'estensione dei bundle di Lolly, e il `format` nel suo `manifest.json` dice cosa contiene:

- Un **design condiviso** (`lolly-share`) contiene una sessione salvata, i suoi file incorporati e una ricevuta per tutto ciò che si risolve ancora per riferimento. Può portare anche lo strumento e il design system. Aprirlo aggiunge un nuovo Project e non sovrascrive mai una sessione.
- Un **progetto condiviso** (`lolly-share`, tipo `project`) contiene una cartella di Projects: le sue sottocartelle, ogni sessione al loro interno con la sua miniatura e le immagini archiviate lì. Aprirlo aggiunge una copia dell'intera cartella. Ogni sessione viaggia come `sessions/<key>.json` con la sua miniatura in `thumbs/`. Un Lolly precedente ai file di progetto ti chiede di aggiornarti.
- Un **pacchetto di design system** (`lolly-brand`) contiene token e può contenere font, loghi, versioni pubblicate e risorse conservate. Aprire il pacchetto aggiunge un design system separato con nome e lo rende attivo.
- Un **pacchetto di workspace o istanza** è un `lolly-brand` con strumenti dichiarati, risorse del catalogo e, facoltativamente, un indirizzo di istanza. Caricarne uno sostituisce l'unico overlay di workspace caricato prima, e l'anteprima elenca quegli effetti a livello di dispositivo.

Un backup completo del dispositivo non è un `.lolly`. Resta un `LollyTools-….zip` (formato `lolly-backup`) e si ripristina da **Settings → Storage → Import data…**. Anche una cartella di strumento compressa resta un `.zip`. [Data transfer](/info/data-transfer.html) è il riferimento del formato.

Un `.lolly` è un normale zip. Rinominalo `.zip` per guardarci dentro: le tue immagini sono in `assets/uploads/`, la grafica del catalogo in `assets/catalog/`, `manifest.json` elenca ogni file e un README dice cos'è il file.

macOS, Windows, Linux, iOS e Android registrano tutti il formato, i file manager desktop lo mostrano come documento Lolly e GNOME Files può mostrare la miniatura propria di una sessione salvata. L'apertura da Design System Setup consiglia l'azione per il design system quando un design condiviso ne porta uno, ma non nasconde mai **Open shared design**.

Un documento passato da un'altra app su iOS o Android è limitato a 48 MB, perché il passaggio copia i suoi byte oltre il confine dell'app, e l'app lo dice. **Open** dentro Lolly non ha questo limite, quindi usalo per un bundle più grande.

Dopo la tua conferma, Lolly decomprime e verifica il bundle una sola volta. Le risorse vanno nella tua libreria, abbinate tramite checksum così un file già presente sul dispositivo viene riutilizzato. Le sessioni vanno in Projects con nuovi id, quindi lo stesso file può essere aperto due volte; una sessione il cui strumento manca resta lì in attesa. I file oltre 100 MB vengono segnalati come grandi, e l'anteprima avvisa quando l'archiviazione del browser segnala meno spazio libero di quello che serve al file. Ogni parte coperta da controllo di integrità viene verificata prima che qualsiasi cosa venga confermata, e una copia danneggiata viene rifiutata senza lasciare nulla.
:::

Un link e un file consegnano entrambi un'istantanea. Per la modifica live, [Working together](/info/collaborate.html) tratta le collab private tra due dispositivi e le collab di lavoro facoltative tramite Lolly Work.

## Risorse - la tua libreria

**Assets** (`#/a`) raccoglie tutto ciò che i tuoi strumenti possono usare: loghi del brand, immagini, audio e animazioni, raggruppati per tipo, insieme ai tuoi file. I tuoi caricamenti sono conservati sul tuo dispositivo. Un'organizzazione che usa Lolly Work può anche fornire un catalogo condiviso con le proprie regole di accesso; vedi [Use Lolly at your organisation](/info/organisation.html).

![Risorse, con i campioni e i font del brand, e i tuoi caricamenti](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Porta i tuoi file.** Trascina un'immagine, un SVG, una clip audio, un video, un Lottie, un PDF o un deck PowerPoint sull'area di caricamento, oppure fai clic per scegliere. Arriva subito in Assets e nel selettore di risorse di ogni strumento. Un PDF di più pagine o un `.pptx` chiede quali pagine o slide tenere, e ognuna diventa una risorsa SVG. Un'immagine che aggiungi dentro uno strumento viene conservata com'è arrivata in **My images**, quindi una Content Credential su di essa continua a verificarsi, e solo un file molto grande chiede se ridimensionarlo. **Settings → Storage** mostra quanto contiene **My images**. Non c'è alcun limite oltre allo spazio del tuo dispositivo. Per eliminare i dati EXIF e GPS man mano che le immagini entrano, attiva **Strip metadata from uploads** in **Settings → Feature flags**; le Content Credentials vengono conservate in ogni caso.
- <!--i:star--> **Preferisci ciò che usi.** Metti una stella a una risorsa o a un campione di colore del brand e si fissa in cima a ogni selettore.
- <!--i:folder--> **Riordina.** Sposta una risorsa in un altro gruppo, nascondi una risorsa condivisa del brand che non usi (**Show hidden** la riporta) o elimina i tuoi caricamenti. La stessa barra di selezione di Projects agisce su un'intera selezione.
- <!--i:layers--> **Stacca un video dal suo sfondo.** Apri i dettagli di un video, o fai clic destro sulla sua scheda in un selettore di risorse, e scegli **Remove background…**. Un **On-device model** ritaglia un soggetto da una scena complessa; un **Colour key** rimuove uno sfondo uniformemente illuminato come un green screen, con **Tolerance**, **Softness** e **Spill removal** per il bordo, e non richiede alcun download. **Resolution** (360, 480, 720 o 1080p, mai oltre la sorgente) scambia dettaglio con velocità. Il ritaglio, un WebP animato o un PNG con vera trasparenza, viene salvato accanto all'originale, e la Content Credential della sorgente viaggia con lui come ingrediente. [Generated once, rendered the same](/info/ai-features.html) spiega perché resta una semplice modifica.

### Porta la tua palette e i tuoi font ovunque

Il pannello **Swatches** in Assets mostra i colori di cui è fatto il tuo brand: i suoi colori di brand, i colori che hai aggiunto, le sue rampe e il suo spettro. I colori di ruolo che Lolly tiene per l'interfaccia (testo, superfici, bordi, colori guida delle colourway e copie di un colore del brand con un altro nome) restano dietro una scheda grigia **Show colour roles** in fondo al pannello.

Ogni colore è una scheda come qualsiasi altra risorsa. Fai clic su uno per aprirne i dettagli, selezionane alcuni per scaricare solo quelli, oppure scarica l'intera palette nel formato che legge il tuo altro strumento:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** o **CSS classes**, per un foglio di stile o una build. Un colore più ampio di sRGB mantiene il suo valore ampio: il CSS lo imposta dopo l'esadecimale, e il JSON mantiene l'esadecimale insieme al colore ampio, alla composizione CMYK e all'inchiostro spot.
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**, per Illustrator o Photoshop. Un colore bloccato su una composizione CMYK arriva come quel campione CMYK, un inchiostro spot come campione spot con nome e un colore più ampio di sRGB come Lab.
- <!--i:pentool--> **Palette GIMP (.gpl)**, per GIMP o Inkscape, e **SCSS variables**, entrambi in sRGB.

![Il pannello Swatches - i cinque pulsanti di download della palette in alto, poi ogni colore del brand come chip che apre i suoi dettagli](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

Seleziona i colori con il punto su ogni scheda: Shift-clic su un secondo punto per tutto ciò che sta in mezzo, trascina un riquadro tra gli spazi oppure premi Cmd/Ctrl+A con una scheda in focus. La barra offre **Download as…** negli stessi sei formati, **Copy hex** e **Favourite**. Prima di scegliere un formato, il menu elenca ogni colore che nessun formato può contenere (Transparent non ha alcun colore), quali formati salvano un colore ampio come il suo ripiego sRGB (SCSS e GIMP) e quali portano i valori CMYK e spot (JSON e .ase). Fai clic destro su una scheda per le stesse azioni su un solo colore.

I dettagli di un colore riempiono l'anteprima con il colore e aprono **Linked values** (la sua composizione CMYK o l'inchiostro spot, qualsiasi valore definito per un particolare spazio o macchina da stampa e il suo design token), **Every notation** (esadecimale, OKLCH, Display-P3 e il resto, ciascuno con un pulsante di copia), **Plotted on a colour space**, **Tones** e **Readability**. I tasti freccia scorrono la palette, **Copy link** condivide il colore stesso e **Open in Colour Lab** lo porta oltre.

Il pannello **Fonts** elenca le famiglie del tuo brand con un **download** per ciascuna, da installare in locale o consegnare a una tipografia.

## Rendi la griglia tua

- <!--i:star--> **Preferisci ciò che usi.** Fai clic destro su una scheda e scegli **Add to favourites**, e ottiene un riquadro grande in una striscia sopra la griglia. [Your favourites](/info/favourites.html) tratta la striscia.
- <!--i:eyeoff--> **Nascondi uno strumento che non usi mai.** Fai clic destro su una scheda, o selezionane diverse, e scegli **Hide tool**. Esce dalla griglia e da ciò che trova la digitazione nella griglia. Un riquadro grigio **Show hidden tools (N)** alla fine li mostra di nuovo, attenuati, ciascuno con **Unhide tool** nel suo menu. Nascondere cambia solo la tua griglia: lo strumento si apre ancora da un link o da un segnalibro.
- <!--i:clock--> **I tuoi strumenti, per primi.** Una volta che hai lavoro salvato in tre strumenti diversi, una riga **Yours** di chip sopra la griglia parte con i tuoi preferiti e gli strumenti recenti.
- <!--i:sliders--> **Disponila a modo tuo.** **View options** imposta il layout (**Grid**, **Card** o **List**), dimensione e densità delle schede, l'ordinamento e un filtro per categoria.

![La fine della griglia Tools con gli strumenti nascosti mostrati: la scheda Wordmark attenuata e, accanto, il riquadro grigio che li ha rimessi in vista, che ora riporta Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
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

**Agisci su più schede insieme.** Spunta la casella di ogni scheda, trascina un riquadro di selezione su uno spazio vuoto oppure fai Shift/Cmd-clic, e compare una barra con ciò che quella vista consente:

- **Tools e Utilities:** Favourite, Hide, Available offline, **View sessions** (Projects, che mostra solo le sessioni create con quegli strumenti) e Copy link per una singola scheda.
- **Assets:** Favourite e Hide per qualsiasi selezione. Duplicate, Download e Delete compaiono solo quando ogni elemento selezionato è un tuo caricamento, perché una risorsa condivisa del design system è un contratto permanente.
- **Projects:** vedi [Find and recover your work](/info/find-your-work.html#find-something-you-saved).

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

**View sessions** compare solo quando qualcosa è selezionato. Se invece fai clic destro su una singola scheda non selezionata, offre **N saved sessions**, un elenco delle sessioni salvate di quello strumento in cui un'eliminazione sposta la sessione nel Cestino.

## Su telefono

Su uno schermo stretto il layout diventa a una colonna:

- I **controlli diventano un pannello** in alto, con una maniglia di trascinamento sul bordo inferiore. Trascina la maniglia per agganciarlo a **peek**, **half** o **full**, oppure toccala per comprimere ed espandere. L'anteprima occupa lo spazio sotto e resta in vista mentre modifichi.
- Un pulsante **Export** fluttuante apre il pannello di esportazione: formato, dimensione, copia, salvataggio e download in un unico posto. Tocca lo sfondo per chiudere il pannello.

![Uno strumento su uno schermo largo come un telefono - i controlli come foglio in alto, la palette generata che riempie l'anteprima sotto e la pillola di rendering che fluttua in basso al centro](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Impostazioni, suono e comfort

**Settings**, in fondo alla schermata iniziale, contiene i tuoi dati, i tuoi design system, l'accessibilità, l'archiviazione e i download offline. [Settings](/info/dashboard.html) mappa ogni scheda.

- **I tuoi dati e la tua foto** compilano qualsiasi strumento pensato per usarli, come una firma email o un badge. [Profiles](/info/profile.html) li descrive.
- **Accessibility** ha quattro interruttori di comfort: **Reduce motion**, **Hide colourful previews**, **High contrast** e **Large text**. Cambiano l'app attorno al tuo lavoro, mai la tela di uno strumento né un'esportazione.
- **Sound** riproduce lievi suoni di assistenza per ciò che fai, e **Neurospicy Mode** riproduce una traccia calma per concentrarsi. Entrambi sono disattivati finché non li attivi, in **Settings → Accessibility** o nel menu del profilo.
- **Available offline** scarica il resto dell'app, i tuoi strumenti, il catalogo e le guide prima che tu perda la connessione. Lolly è un'app web che puoi installare: usa il pulsante di installazione del browser, o *Add to Home Screen* su un telefono, per ottenere un'app a schermo intero che si aggiorna da sola quando torni online.
- **Storage** mostra cosa Lolly conserva su questo dispositivo. [If you clear your browser data](/info/find-your-work.html#if-you-clear-your-browser-data) spiega cosa rimuove la cancellazione, e l'[Informativa sulla privacy](/info/privacy.html) elenca tutto ciò che l'app scarica o invia.

::: note Se una vista non si carica dopo un aggiornamento
Un pannello vuoto o un messaggio "failed to fetch" subito dopo un aggiornamento di solito si risolve con un solo ricaricamento. Il lavoro salvato, le sessioni e i design system non vengono toccati, perché sono conservati sul tuo dispositivo. Solo un'immagine che hai aggiunto e mai salvato potrebbe dover essere aggiunta di nuovo.
:::

## Dove andare adesso

- **[Design: la tela libera](/info/design.html)**: la tela, le forme, la timeline e la presentazione di un deck.
- **[Batch e Multi-edit](/info/batch.html)**: molte versioni di un design, o più design salvati modificati insieme.
- **[Esporta un file](/info/exporting.html)**: scegliere formato, dimensione, unità di stampa, trasparenza e video.
- **[Import a design](/info/design-import.html)**: porta un file Figma, Penpot, Illustrator o InDesign in Design e continua a modificarlo.
- **[Template](/info/templates.html)**: punti di partenza salvati per uno strumento.
- **[Wide Colour e HDR](/info/hdr-editing.html)**: mantieni la precisione originale delle immagini in Design e Darkroom.
- **[Find and recover your work](/info/find-your-work.html)**: dove si trova tutto e come spostarlo su un altro dispositivo.
