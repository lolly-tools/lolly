# Lolly Design System Setup

<a id="design-system-setup"></a>

**Lolly Design System Setup**, su `#/start`, contiene il tuo logo, i colori e i caratteri. Ogni strumento, pagina ed esportazione li usa per disegnare.

Trascina un logo e Lolly ne legge i colori. Scegli un carattere, oppure trascina il file del font di cui la tua azienda ha la licenza. Ogni modifica appare subito in tutta l'app. Logo, font e token restano su questo dispositivo. Solo la scelta di un Google Font contatta l'esterno: Lolly chiede prima conferma, poi scarica la famiglia una volta.

Dai un nome al design system e premi **Export** per ottenere un unico file `.lolly`. Conserva il file, aprilo su un altro dispositivo o passalo a un collega. [Lolly Settings](/info/dashboard.html#design-system) mostra il sistema attivo in sola lettura; la sua copertina rimanda qui per modificarlo.

<!--i:eti-clock-->
## Fallo tuo in cinque minuti

::: timeline
- <!--i:upload--> **Trascina il tuo logo** nell'area di rilascio in **Logos**. Lolly ne legge la forma e i colori.
- <!--i:palette--> **Usa questi colori.** Il colore principale del logo diventa il tuo primario e un neutro scuro del logo diventa il colore del testo.
- <!--i:font--> **Scegli un carattere** in **Type**: un Google Font o un file di font che possiedi.
- <!--i:pentool--> **Dai un nome al sistema.** La prima modifica crea un design system tutto tuo e Lolly ne chiede il nome una volta.
- <!--i:download--> **Export** scrive l'intero sistema in un unico file `LollyBrand-….lolly`.
:::

La barra in alto nello studio mostra il nome del design system come campo modificabile. **Enter** conserva un nuovo nome e **Escape** ripristina quello precedente. Quando la prima modifica chiede **What is this design system called?**, Lolly inserisce le parole del logo, se il logo le riporta. **Save name** conserva il nome; **Not now** mantiene un segnaposto finché non ne digiti uno nella barra. Il nome identifica il sistema in Settings e quando cambi sistema, ed è il nome del file scritto da **Export**.

<!--i:eti-grid-->
## Le stanze

Lo studio è un insieme di stanze senza un ordine fisso. Nessuna stanza dipende da un'altra. Su un desktop le stanze si trovano in un'unica striscia sotto la barra. Su un telefono si spostano in una barra lungo il bordo inferiore, che scorre per mostrare la stanza aperta. Il pannello della palette e il vassoio si aprono sopra quella barra, e la barra si sposta mentre scrivi. Con una tastiera, Tab raggiunge la striscia una volta, e i tasti freccia, Home e End permettono di passare tra le stanze.

![La barra dello studio e le sue stanze: Board, Colours, Type, Logos, Tokens, Files, Sound, Rules e Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Stanza | Cosa ci fai | Chiave del link |
|---|---|---|
| **Board** | Vedi cosa contiene il sistema, con un accesso a ogni stanza | `overview` |
| **Colours** | Aggiungi colori, assegna loro ruoli, costruisci tonalità e una palette | `color` |
| **Type** | Scegli i quattro caratteri che l'app, gli strumenti e ogni esportazione leggono | `type` |
| **Logos** | Inserisci i tuoi marchi in ogni orientamento e trattamento | `logos` |
| **Tokens** | Angoli, spaziatura, ombre e ogni altro valore con nome | `tokens` |
| **Files** | I file di immagini, audio e animazione che il tuo brand conserva | `catalogue` |
| **Sound** | Definisci l'identità sonora, la musica per usi diversi e il rapporto con la voce | `sound` |
| **Rules** | Le regole applicate dal tuo brand, verificate su esempi reali | `usage` |
| **Skills** | Gli standard scritti del brand per persone e agenti, da leggere e scaricare | `skills` |

Crea un link a una stanza con `#/start?area=<key>`. Le chiavi delle stanze sono permanenti, quindi Files mantiene `catalogue`, Board mantiene `overview` e Rules mantiene `usage`. `?tab=` funziona ancora come alias precedente. Una chiave sconosciuta apre Board.

La **barra** contiene le azioni per l'intero sistema. **Add from…** importa un brand ([Importare un brand](#bring-a-brand-in)). Il **Tray** contiene ciò che una scansione ha trovato e che non hai ancora aggiunto. **Export** scrive il sistema in un unico file. **More** contiene **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions & publishing**, **Restore brand settings** e **Design systems**, che apre l'elenco in Settings da cui cambi sistema ([Conservare e spostare il tuo design system](#keep-and-move-your-design-system)). Ogni azione appare quando ha qualcosa su cui agire. Su un telefono, **Add from…** si sposta in **More** e **Export** appare come icona.

Finché il design system è quello fornito con l'app, la barra inizia con **Make it yours**, un menu con **Find a look**, **Add from…** e **Pick a colour**. Quando il sistema è tuo, **Export** riprende quel posto.

<!--i:eti-clipboard-->
## Board

Quando non hai ancora scelto nulla, Board offre quattro modi per iniziare. **Start from a reference** apre il selettore della sorgente per un logo, uno screenshot, una pagina web o un file di design. **Pick a colour**, **Choose a face** e **Add a logo** aprono i relativi controlli. Aprirne uno non scrive nulla. Sotto, **Find a look** offre colori e caratteri già pronti da provare, ed **Explore the tools** è presente fin dall'inizio.

Quando qualcosa è tuo, Board mostra ciò che hai, partendo dai tuoi conteggi. Colours indica il numero di colori, con un `· N starter` attenuato per quelli ereditati. La sua striscia mostra i tuoi colori, poi una linea sottile, poi i colori iniziali sbiaditi. Colourways mostra ogni colourway come un piccolo riquadro nel suo colore principale. Type elenca ogni ruolo e mostra ogni famiglia nel proprio carattere (*Inter per i titoli*, con *Starter per il resto* nella riga sotto). Logos indica quante posizioni sono occupate (oppure **Not set**), Tokens mostra il raggio degli angoli e Files indica **Nothing yet** finché la libreria è vuota. Ogni blocco apre la propria stanza.

Un design system modificabile fornito con l'app, come Lolly Demo, mostra fin dall'inizio colori, colourway, caratteri e marchi in Board, con un'etichetta **Came with this app** accanto al titolo. Sopra, **Start here** offre **Find a look**, **Add from…** e **Pick a colour**.

### Materiale iniziale e tuo

In ogni stanza, **Starter** contrassegna tutto ciò che è stato fornito con l'app e che nessuno ha scelto. Una nuova installazione non contiene colori, ma solo una scala neutra dall'inchiostro alla carta, così superfici, testo e linee sottili possono essere renderizzati prima che qualcuno scelga.

::: cols
## Materiale iniziale

- Fornito con l'app: i neutri dall'inchiostro alla carta, i caratteri iniziali, il raggio degli angoli predefinito.
- Attenuato, con un'etichetta **Starter** e senza tinta.
- Non conteggiato tra i tuoi colori. I neutri si trovano in **Tokens** come **Neutrals · starter · 9**, e **Open** li mostra in Colours come un unico gruppo chiuso (`#/start?area=color&group=neutral`).
- Un ruolo che usa un colore iniziale riporta *"Starter Paper fa da sostituto"*, con **Choose…** nel suo selettore.

## Materiale tuo

- Scelto o installato da te.
- Pienamente visibile, con una card colorata dove hai installato un carattere.
- Conteggiato in Board e in Tokens.
- Un ruolo che ne segue un altro riporta **↳ follows Primary**.
:::

Il materiale ereditato non ha mai un bordo tratteggiato. Un bordo tratteggiato indica un'area di rilascio.

<!--i:eti-shapes-->
## Loghi

L'area di rilascio in alto, **"Drop marks here, or choose several at once"**, accetta tutti i file che hai. Lolly legge la forma e l'inchiostro di ogni file. Il file resta poi in attesa sotto **Waiting for a slot** come chip che indica a cosa assomiglia, ad esempio *"Sembra il logo Horizontal primary"*, con la misura usata e un pulsante **Place** (**Replace** se la posizione è occupata). Quando Lolly è incerto, il chip lo indica e offre **Change slot**, elencando tutte e otto le posizioni. Non viene inserito nulla finché non premi un pulsante.

Un marchio con margine vuoto in eccesso riceve prima una proposta di ritaglio. Rispondi alla proposta, oppure premi Escape per inserire l'originale intatto. Quando un marchio può riempire un'altra posizione vuota dello stesso gruppo, la stanza offre la versione derivata **mono** o **reverse** come chip contrassegnato *Generated*.

Ogni marchio va in una griglia di otto posizioni facoltative, una per **orientamento** e **trattamento**:

- **Orientamenti:** Horizontal (wordmark e simbolo affiancati) e Vertical (sovrapposti, per spazi quadrati e alti).
- **Trattamenti:** Primary, Primary reverse (per sfondi scuri), Mono (un colore) e Mono reverse.

Un gruppo senza marchi si richiude in una riga; apri il gruppo per vedere le sue posizioni. Fai clic su una posizione per aggiungere un PNG, SVG, JPEG o WebP, oppure su una posizione occupata per sostituire il marchio. Una posizione vuota accetta anche un file trascinato. I marchi orizzontali si trovano in riquadri larghi e quelli verticali in quadrati, ciascuno sulla superficie per cui è stato creato, con uno spazio libero pari a un quarto della sua altezza. Tutto resta su questo dispositivo.

![Le posizioni dei loghi con Horizontal e Vertical aperti: ogni trattamento ha una propria posizione e ogni posizione è facoltativa](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&system=new-design-system&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails.be-logo-group--fold%3Anot%28.be-logo-group--custom%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** sono marchi che il tuo brand chiama con un nome proprio, come un'icona, uno stemma o una favicon.
- **Altre identità.** Un sotto-brand, prodotto o evento può avere un proprio set completo: premi **+ Add another logo** e dai un nome al set. Il set principale è "Your logo". [Architetture di brand](/info/brand-architectures.html) mostra quando usare un'identità del logo.
- **Lolly legge i colori del logo.** Una card sotto l'area di rilascio, e in alto in Colours, elenca i colori del logo e chiede **Which is the main colour?**. Viene selezionato il colore più forte, mai il bianco su cui è stato esportato il logo. **Use these colours** li aggiunge alla palette e rende il colore principale il tuo primario. Quando il logo ha un neutro scuro leggibile sulla carta, quel neutro diventa il colore del testo. **Not now** li lascia nel Tray. Su un'installazione appena creata, Lolly applica subito la risposta più probabile, e la card offre **Undo** o un altro colore principale. Un SVG fornisce colori esatti; un PNG, JPEG o WebP fornisce i colori che coprono una parte significativa del marchio.

<!--i:eti-palette-->
## Colori

La stanza cresce con il design system. La prima visita richiede una sola decisione; altri controlli appaiono man mano che la palette cresce.

### Il primo colore

Un sistema senza colori propri mostra i neutri iniziali nel loro gruppo aperto. In alto nella stanza c'è un campo tratteggiato in cui incollare o trascinare: un chip grande e un campo. Trascina un'immagine o un elenco di colori in qualsiasi punto del campo e Lolly legge i colori.

- **Il chip è il selettore.** **Pick a colour** apre la card OKLCH dello studio, inizializzata con il contenuto del campo. La card mostra prima il nome e il codice esadecimale del colore. Gli spazi colore, la ruota, le quattro manopole e alfa sono sotto **Fine-tune**, e **Cancel** e **Add colour** sono in basso. Nulla entra nel sistema finché non premi **Add colour**.
- **Il campo accetta qualsiasi notazione**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` o un nome di colore. Un elenco incollato diventa una fila di chip da aggiungere uno alla volta o con **Add all**.
- **Altri due modi per iniziare.** **Pick a colour from the screen** usa il contagocce quando il browser lo offre, e **Take colours from an image** legge uno screenshot o una foto su questo dispositivo.
- **Add non è mai disattivato.** Se il campo è vuoto, apre il selettore; se non riesce a leggere il testo, una riga sotto il campo lo segnala.

Il primo colore diventa il **primario**. Un chip conferma la modifica, ad esempio *"Il primario ora è Vivid Violet"*, con **Fine-tune** per regolare il colore.


### Man mano che la palette cresce

Su uno schermo largo i tuoi colori si trovano accanto a un'anteprima **In context**, e su uno più piccolo sopra l'anteprima. L'anteprima mostra un poster, un grafico o una card di interfaccia nella tua palette. I colori iniziali hanno un proprio gruppo, che si richiude quando il sistema ha colori propri. Il campo in cui incollare o trascinare diventa una riga compatta. L'intestazione della stanza non ha un comando di esportazione; usa **Export** nella barra o la stanza Tokens.

![La stanza Colours su Lolly Demo: i chip dei ruoli e il campo in cui incollare o trascinare in alto, poi la palette in gruppi richiudibili, ogni colore con nome e codice esadecimale](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![La stanza Colours su Lolly Demo dopo l'aggiunta di un colore: la tabella Colour roles, poi il chip del nuovo colore con Use as Lead? e Fine-tune, accanto a un'anteprima live della composizione](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Ruoli dei colori: come si chiamano i colori

Il design system dà un nome ai suoi colori e indica a cosa serve ciascuno, e Lolly legge entrambe le cose. **Colour roles** si trova in cima alla stanza Colours. **In context** mostra ogni modifica subito.

![La tabella Colour roles di Wefthouse, un brand tessile inventato, con i suoi termini: i chip delle colourway Indigo, Madder e Weld, poi Main, Accent, Supporting e Tertiary, ciascuno con il proprio colore chiaro e scuro, interpretati come colore principale, colore abbinato e solo per nome, e Background, Text, Quiet text e Hairlines elencati sotto la tabella come interpretazioni a cui non corrisponde alcun ruolo](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=wefthouse&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

La tabella ha quattro colonne. Su un telefono ogni riga diventa una card con chiaro e scuro affiancati:

| Colonna | Cosa contiene |
|---|---|
| **Role** | Il termine del design system, che puoi modificare sul posto, e una riga che indica a cosa serve il colore |
| **Light** e **Dark** | Il colore in quell'aspetto per la colourway scelta, con il suo nome o valore e il suo contrasto |
| **Lolly reads this as** | Cosa fa uno strumento con il ruolo, nei termini di Lolly |

**Come Lolly interpreta un ruolo.** Ogni interpretazione accetta un solo ruolo. Scegliere un'interpretazione già assegnata a un altro ruolo la sposta su questo. Lolly non deduce mai il significato da una parola.

| Interpretazione | Cosa ne deriva |
|---|---|
| **Lead colour** | Forme grandi, pulsanti, il colore principale di uno strumento |
| **Partner colour** | Il secondo colore a cui ricorre uno strumento |
| **Background** | Sta dietro a tutto il resto |
| **Text** | Titoli e corpo del testo |
| **Quiet text** | Didascalie e testo piccolo |
| **Hairlines** | Filetti, bordi e divisori |
| **By name only** | Nessuno strumento sceglie il ruolo da solo. È disponibile in ogni campo colore e in Design, dove la scelta resta collegata, quindi segue la colourway |

Un'interpretazione non coperta da alcun ruolo mantiene la definizione del design system, e la stanza elenca queste interpretazioni sotto la tabella. Un ruolo che condivide l'id di un'interpretazione, come un ruolo chiamato Primary, coincide con quell'interpretazione e non può essere spostato.

**In un grafico.** La palette **Design system - colour roles first** di Lolly Chart assegna alle serie i ruoli cromatici del design system nel loro ordine, poi il resto della palette. Un ruolo interpretato come sfondo, testo, testo secondario o filetti viene escluso, perché il grafico usa quei colori per lo sfondo e le parole. Non cambia nulla finché non scegli quella palette. Un design system senza ruoli cromatici disegna la palette come **Design system - ordered**.

**Valori.** Premi un valore per scegliere il colore del ruolo per quell'aspetto e per la colourway scelta. **Same as light** fa seguire al valore scuro quello chiaro finché non scegli un colore scuro. Il chip **Aa** mostra il testo che Lolly sceglie di mettere sul colore. La riga sotto il valore indica la leggibilità di quel testo in ciascun aspetto: **Text reads well**, **Large text only** o **Hard to read as text**. La valutazione riguarda solo il testo sul colore; il colore può comunque funzionare per forme e aree grandi. Un ruolo interpretato solo per nome mostra le stesse parole senza il colore di avviso, perché nessuno strumento mette da solo del testo su quel ruolo. Il tooltip e il selettore mostrano i valori numerici, prima APCA e poi WCAG. **Own text colour** contrassegna un valore il cui file dichiara il colore del testo; quel colore resta. **Copied** contrassegna un valore preso da un'altra colourway o dal colore di accompagnamento che nessuno ha ancora scelto; **Keep this colour** nel selettore conferma il valore.

**Punti di partenza.** Un design system senza ruoli propri mostra le parole attuali: Primary, Secondary, Surface e Text. Non viene scritto nulla finché non ne cambi una. **+ Add a role** suggerisce **Primary, Secondary** o **Main, Accent, Supporting, Tertiary**, oppure accetta le parole che digiti, e mostra l'interpretazione che ciascuna riceverebbe. Le prime due parole diventano il colore principale e quello di accompagnamento. Gli strumenti continuano a disegnare gli stessi colori. In un sistema con un solo colore principale, la prima colourway prende il nome di quel colore.

**Rinominare, riordinare, rimuovere.** Rinominare cambia solo la parola; tutto ciò che usa il ruolo continua a funzionare. Trascina un ruolo dalla sua maniglia, oppure premi Space sulla maniglia, usa i tasti freccia e premi Space per rilasciarlo. **Remove** indica cosa usa ancora il ruolo. Quando gli strumenti interpretano il ruolo, **Remove and keep those colours** lascia a ogni interpretazione il colore attuale. Una regola dell'organizzazione, un gruppo di guide, un campo di uno strumento o un altro token che usa il ruolo ne impedisce la rimozione finché quell'uso non cambia. Anche un documento Design salvato può usare un ruolo per nome, e Lolly non può rilevarlo dal file dei token. Un documento simile segnala il colore come non risolto.

::: details Ruoli in un file di token scritto a mano
**Un file scritto a mano.** I colori di un file di token che nessun ruolo dichiara sono elencati sotto **In this file, with no role yet**, ciascuno con un campo per una parola e **Make a role**. Continuano comunque a funzionare per nome. Un token con cifre nel nome non può essere un ruolo; resta nel file e continua a funzionare tramite il suo percorso. Se un record del file non supera la convalida, la tabella appare senza controlli e ne indica il motivo.
:::

**Il resto della stanza usa le stesse parole.** I chip, la riga **Use as** del campione e il gruppo **Colour roles** della palette usano tutti le parole del design system. La tessera di un ruolo cromatico apre il suo valore. I file esportati non registrano nulla di nuovo sui ruoli; i colori di un rendering cambiano perché sono cambiati i token.

**Dove vanno le parole.** Le parole e le descrizioni viaggiano con il design system. Gli agenti le leggono nel brief di design, in `lolly://tokens` e nell'`AGENTS.md` di una pagina del brand. Il terminale le mostra in `lolly system status`. Una pagina del brand le elenca in `brand.json` e misura il contrasto di una coppia per ogni ruolo. I file DTCG e Tokens Studio conservano tutto, `DESIGN.md` conserva le parole e le interpretazioni e un tema PowerPoint conserva solo l'ordine del brand. [Ruoli cromatici in altri formati](/info/design-tokens.html#colour-roles-in-other-formats) contiene l'elenco completo. Le parole sono sempre riportate come dati del design system, mai lette come istruzioni.

**Dove si sceglie un colore.** Ogni campo colore di uno strumento e di Lolly Design elenca prima i ruoli del design system, nel loro ordine, con ogni parola e il suo scopo. **Aa** accanto a un ruolo sceglie il colore che si sovrappone a quel ruolo. Gli altri colori seguono sotto **Other colours**, senza le copie proprie di una colourway, i colori da sovrapporre e le interpretazioni già coperte da un ruolo. La scelta resta collegata al ruolo e segue la colourway. Il campo mostra la parola in ogni colourway, e anche Settings e Tokens la usano. Un design system senza ruoli mantiene la sua griglia di campioni.

### Ogni colore letto da uno strumento

Con **Colour roles** chiuso, la stanza presenta prima i chip per le prime decisioni. Ogni chip mostra il colore del ruolo e il suo nome. In un sistema senza parole proprie sono **Primary**, **Secondary**, **Surface** e **Text**. Premi un chip per sceglierne il colore dai campioni della palette. **Every colour a tool reads**, in fondo a **Colour roles**, contiene la striscia completa.

La striscia mostra i sette colori che uno strumento può leggere: Primary, Secondary, Surface, Text, Muted, Edge e On primary, con le parole proprie del design system quando ne ha. Ognuno svolge la stessa funzione in ogni strumento ed esportazione. Nessuno deve essere impostato, e qualsiasi colore può coprire uno di questi ruoli. Tre colori indipendenti bastano per un buon sistema. L'indicatore mostra la leggibilità del testo sulla superficie, prima con APCA. Ogni riga mostra il tuo colore alla piena intensità, un colore iniziale che lo sostituisce o **↳ follows Primary**.

On primary deriva dal colore primario, riporta **Derived** e non ha un selettore. L'interruttore **Light** e **Dark** accanto a On primary, e quello accanto a **In context**, scelgono quale aspetto mostrano la striscia, la palette e l'anteprima.

Il colore di accento dell'app segue il design system per impostazione predefinita, tramite l'impostazione **Interface follows the design system** in **Settings → Appearance**. Con l'impostazione disattivata, l'interfaccia dell'app resta neutra. Strumenti, tele ed esportazioni seguono comunque il design system.

**Colourway.** Un design system può contenere più colori principali, scelti per ogni pezzo. La riga **Colourways** in cima a **Colour roles** mostra un chip per colourway, con **Default** su quella canonica. **+ Add** avvia una nuova colourway da un colore della palette. Scegli un chip e la tabella, la striscia, la palette e le anteprime mostrano quella colourway. Puoi rinominare, duplicare, rimuovere o impostare come predefinita la colourway scelta. In un sistema con colourway, ogni colourway ha bisogno di un colore primario e di uno secondario propri, e di una superficie propria quando le colourway tingono lo sfondo. Questi ruoli restano impostati nell'editor del campione. [Aggiungere colourway a un design system](/info/colourways.html#add-colourways-to-a-design-system) contiene i passaggi e il formato dei token, e [Lolly Demo in uso](/info/lolly-demo-in-use.html#colourways-on-real-work) mostra le colourway su lavoro reale. Ogni persona può scegliere una colourway come propria in **Settings → Appearance** ([Scegliere una colourway personale](/info/colourways.html#make-a-colourway-your-own)).

### Trova altri colori

Tre strumenti partono dal tuo colore primario. I primi due danno solo suggerimenti; il terzo sostituisce la palette.

::: cols
## Esplora tonalità & armonie

Scegli un **Starting colour**, uno **Scheme** (Mono, Complement, Analogous o Triad) e quante **Shades** (da 3 a 20, 5 per impostazione predefinita). **Fine-tune** imposta l'intensità dell'interfaccia, il contrasto e il testo sul colore del brand. Fai clic su una tonalità per aggiungerla, oppure su **Add 5 shades** per un gruppo. I tuoi colori e ruoli restano.

## Trova colori abbinati

Scegli un'**Harmony**: Complementary, Adjacent, Triad, Tetrad o Analogous (con **Accents** da 2 a 5 e un **Angle** da 10° a 45°). Ogni proposta ha un nome generato e **+ Add**, una pressione per colore.

## Ricostruisci l'intera palette

Sostituisce la palette a partire da un colore iniziale, dopo una verifica di ciò che cambia e ciò che resta.
:::

Tutti e tre usano gli stessi calcoli percettivi del colore (OKLCH) del motore. In **Explore shades & harmonies**, le righe **Primary**, **Neutral** e **Secondary** mostrano le tonalità suggerite, e **Theme preview** mostra esempi chiari e scuri con le relative misure di contrasto.

![Tre gruppi di tonalità suggerite, con controlli per aggiungerle singolarmente e un'anteprima Theme preview separata](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Colori di accento generati, ciascuno con un campione, un nome generato automaticamente, il suo valore esadecimale e un pulsante Add](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Applicare una palette generata

Apri **Rebuild the whole palette…** e premi **Preview full rebuild**. La verifica conta quanti ruoli restano come li hai assegnati, quanti dei tuoi colori vengono conservati e quante curve di tonalità, vincoli di stampa, tonalità nascoste e punti di sfumatura vengono ricollegati o conservati. **Apply rebuilt palette** applica; **Cancel** non cambia nulla. Dopo, la scheda offre **Undo**, già con il focus, e il checkpoint creato prima della sostituzione ripristina l'intero sistema.

Un sistema con colourway conserva ogni colourway durante una ricostruzione. La colourway canonica segue il nuovo colore iniziale, e ogni altra colourway mantiene i propri colori, nome, ordine e impostazioni. La verifica elenca quale colourway segue il nuovo colore e quali mantengono i propri colori. Lolly non ricostruisce un sistema che codifica le colourway in un modo che non può modificare; la scheda ne indica il motivo e non cambia nulla.

### Le sezioni per esperti

Quattro sezioni richiuse si trovano sotto l'anteprima e i ruoli. Ciascuna si apre con `#/start?area=color&focus=<name>`:

- **Explore shades & harmonies** (`focus=generate`).
- **Shade curves** (`focus=curves`) rimodella una scala punto per punto, con curve separate di luminosità, croma e tinta (L / C / H) e le tonalità che si ridisegnano mentre trascini.
- **Contrast** (`focus=contrast`): **Contrast-lock** modifica i toni di una scala per raggiungere gli obiettivi APCA su uno sfondo che scegli, e **Rotate hue** ruota l'intera scala attorno alla ruota.
- **Print** (`focus=print`) imposta ciò che il colore primario diventa in stampa: il suo valore automatico, una composizione CMYK fissata o un inchiostro a tinta piatta con nome.

### La palette e ogni campione

La palette elenca i tuoi colori in gruppi richiudibili, ciascuno con il proprio **+ Add**. Puoi creare e rinominare i gruppi. Un ruolo non crea mai una seconda tessera; la tessera a cui punta un ruolo mostra il nome del ruolo, come **Primary**. **Colour chart** sotto le tessere mostra gli stessi colori sulla **Wheel** OKLCH (trascina un punto per cambiare colore, fai clic su uno spazio vuoto per aggiungere un campione) e sul grafico **Gamut**, che mostra dove finisce l'intervallo visualizzabile. `#/start?area=color&focus=chart` apre il grafico.

![Il pannello della palette, con ogni gruppo richiudibile](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![La ruota OKLCH - l'angolo è la tinta, la distanza dal centro è il croma e i grigi seguono una scala di luminosità sul lato](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Fai clic su un campione per aprire il suo editor:

- **Rename** rinomina il campione.
- **Imposta il colore** con i cursori OKLCH, oppure in **Hex**, **HSL**, **RGB** o **CMYK**. Il campo del valore legge e scrive nello spazio attivo. Qui CMYK imposta il colore a schermo tramite conversione; per fissare inchiostri esatti, usa **Print substitutes**.
- **Stored as** sceglie come viene salvato il campione: **LCH** (predefinito, percettivo e ad ampia gamma), Hex, RGB o HSL.
- **Use as** assegna un ruolo al campione, con le parole proprie del design system quando ne ha. Premi di nuovo un ruolo evidenziato per cancellare l'assegnazione.
- **Print substitutes** (richiuso): blocca **CMYK** passando da **Auto** a valori di inchiostro esatti, oppure imposta uno **Spot colour** con un **Name** (come `PANTONE 186 C`), un **Book** facoltativo e un **Finish** per lamina, rilievo, incavo, vernice selettiva, soft touch o fustellatura, cordonatura o perforazione. Una macchina da stampa usa questi vincoli quando esporti un PDF o TIFF CMYK; vedi [Profili colore](/info/exporting.html#colour-profiles). Un inchiostro a tinta piatta viene stampato su una lastra propria in un Print PDF; per stampare tutti gli inchiostri a tinta piatta in quadricromia in una singola esportazione, vedi [Inchiostri a tinta piatta in quadricromia](/info/exporting.html#spot-inks-as-process).
- **In other spaces** (richiuso): un valore per spazio colore, derivato o definito da te, e quello definito da te ha la precedenza nell'esportazione.

**Eliminare un campione** è sicuro. Le tonalità derivate e i ruoli del tema vengono nascosti, quindi nulla che li legge smette di funzionare. I colori che hai aggiunto vengono rimossi.

::: details Lavorare con molti campioni
Quando non lo usi, un campione mostra colore, nome e valore esadecimale. Select mostra la casella di selezione e la maniglia di trascinamento di ogni campione su qualsiasi schermo, e anche una tessera con il focus da tastiera mostra la propria maniglia. Trascina una maniglia per riordinare all'interno di un gruppo, oppure porta il focus sulla maniglia, premi Space, usa i tasti freccia e premi di nuovo Space per rilasciare; Escape annulla. Su un telefono la palette mostra quattro colori per riga. Per spostare i colori tra i gruppi, usa il controllo **Group** dell'editor oppure selezionane più di uno e usa **Move to**.

La selezione non richiede un interruttore separato: la barra e le caselle di selezione compaiono con la prima tessera selezionata e scompaiono con l'ultima.

- **Trascina su uno spazio vuoto** per disegnare un rettangolo; ogni tessera che tocca entra nella selezione, anche tra gruppi diversi. Una sezione richiusa non aggiunge nulla.
- **Shift-clic** seleziona un intervallo nell'ordine di lettura, **Cmd/Ctrl-clic** attiva o disattiva la selezione di una tessera e un semplice clic apre l'editor.
- Ogni intestazione di gruppo ha **Select all**, e **Cmd-A** con il focus su una tessera seleziona tutti i colori tuoi, mai quelli iniziali.
- La griglia ha un solo punto di accesso con Tab: le frecce spostano, Shift-frecce estende, Space attiva o disattiva la selezione, Delete rimuove ed Escape cancella la selezione. Per modificare un canale a piccoli passi, premi prima `l`, `c` o `h`.
- Su un touch screen, tieni premuta una tessera per iniziare una selezione, poi tocca per aggiungere.

La barra riporta **{n} selected**, poi **Move to**, **Give a role** (ogni colore prende a turno il ruolo successivo), **Download** (la selezione in uno dei sei formati di palette), **Duplicate** (una copia di ciascuno, collocata dopo l'originale), **Copy values** e **Delete**. Una sola copia si apre nell'editor; più copie restano selezionate. Un solo Cmd/Ctrl-Z annulla un'azione collettiva.
:::

### Sfumature

Il pannello facoltativo **Gradients** crea token di sfumatura dalla palette. Ogni sfumatura ha un'anteprima, da 2 a 8 punti con nome e un angolo. Un punto rimanda a un campione, quindi cambia il colore del campione e la sfumatura lo segue. Le sfumature sono calcolate in OKLCH.

I download della palette (design token, CSS, SCSS, GIMP e Adobe Swatch Exchange) si trovano nell'intestazione della palette. [Porta la tua palette e i tuoi font ovunque](/info/using.html#take-your-palette-and-fonts-anywhere) descrive ogni formato.

<!--i:eti-type-->
## Tipografia

Senza un carattere proprio, la stanza mostra una sola scheda: **Primary**, composta nel carattere attuale a una dimensione adatta alla lettura, con un'etichetta **Starter**, un pulsante **Choose for Primary** e la riga *"Non viene installato nulla finché non ne scegli uno."* Titoli, codice e corsivo seguono il carattere primario finché non li scegli; **Choose them separately** mostra le loro schede.

![La stanza Type senza alcun carattere ancora scelto - una scheda a una dimensione adatta alla lettura, un'etichetta Starter e un solo pulsante pieno Choose for Primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Scegli un carattere e la stanza si espande in quattro schede dei ruoli, l'elenco Fonts e un campione live:

- **Primary**: corpo del testo, pulsanti e ogni strumento.
- **Headings**: il carattere da titolazione per `h1` e `h2`.
- **Code**: un carattere monospaziato per codice e dati.
- **Italic**: un vero corsivo per enfasi, citazioni e incisi.

Una scheda è colorata solo dove hai installato quel carattere. Il suo pulsante mostra il ruolo: **Change Headings** per un carattere tuo e **Choose for Headings** altrove. La riga di esempio va a capo. Nulla su una scheda applica una modifica; il pulsante apre l'area di confronto per quel ruolo.

![Le quattro schede dei ruoli visibili - ciascuna composta nel carattere che la serve, con un'etichetta Starter dove nessuno ne ha scelto uno e Italic che segue il primario](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### L'area di confronto

L'area si apre sotto la scheda che hai premuto. Le schede si richiudono in una striscia di una riga, così l'area è visibile nella prima schermata di un telefono. Escape annulla e riporta il focus sulla scheda.

1. Premi **Choose for** seguito dal ruolo sulla scheda.
2. Digita il nome di una famiglia e premi **Preview**, oppure premi una delle sei famiglie **Pinned** sotto il campo.
3. Premi **Use this face**.

![L'area di confronto aperta sotto la sua scheda, con la riga di ricerca, le famiglie fissate e le schede richiuse in una striscia di una riga](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**Il consenso viene chiesto una sola volta.** La prima volta che un'anteprima contatta Google Fonts, una finestra spiega: *Google riceve il nome della famiglia e il tuo indirizzo IP. Il file viene poi conservato su questo dispositivo e usato offline. Questo è l'unico passaggio nello studio che contatta una terza parte.* **Fetch from Google** procede e la scelta viene ricordata. **Cancel** lascia sulla scheda il messaggio *"Non scaricato. Non è stato inviato nulla a Google."*, con un proprio **Fetch from Google**.

**Trascina un file di font sull'area** (TTF, OTF o WOFF) per vedere in anteprima un carattere di cui possiedi la licenza. In entrambi i casi il carattere resta su questo dispositivo, viene renderizzato offline nell'app, negli strumenti e in ogni esportazione e viaggia nel file del design system. Tutto ciò che è su Google Fonts viene distribuito con una licenza aperta (OFL, Apache o UFL).

### Font su questo dispositivo

Il pannello **Fonts** elenca ogni carattere su questo dispositivo e il ruolo che svolge. I caratteri che hai aggiunto vengono prima, sotto **In the design system**, ciascuno con i suoi ruoli e un comando per eliminarlo. I caratteri iniziali seguono in un'unica riga attenuata e richiusa. **Add a face** apre l'area di confronto per qualsiasi ruolo. Il pannello **Type roles** mostra un campione live di ogni ruolo con la sua famiglia e il suo stato, come *Inter* o *Inter · segue Primary*.

<!--i:eti-tag-->
## Token

I token sono i valori con nome alla base del design system: colori, caratteri, loghi, angoli e spaziature. Gli strumenti li leggono per nome, quindi una modifica qui raggiunge subito ogni strumento.

![La stanza Tokens: l'intestazione con un esempio dal sistema e le azioni sui file, le tessere con il conteggio di ogni tipo di token, poi le coppie di colori con le relative misure di contrasto](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **L'intestazione** offre un esempio dal tuo sistema (*Primary è Spearmint, #033633*) e le azioni sui file: **Download** (il sistema come design token, oppure la palette in altri cinque formati), **Copy CSS** e **Add from…** per leggere di nuovo un file JSON.
- **Le tessere** contano ogni tipo di token e portano alla relativa sezione: Colours, Type, Logos, Shape and spacing, More e All tokens. Una sezione che contiene solo ciò che era incluso nel modello iniziale vuoto porta un'etichetta **Starter**; un sistema fornito con l'app conta il proprio materiale senza etichetta. Su un telefono le tessere si dispongono su due righe da tre.
- **Colours** inizia con le coppie che gli strumenti abbinano (testo su superficie, su primario, attenuato su superficie), con una misura APCA nell'aspetto chiaro e scuro, e segnala **Weak contrast** quando una coppia non raggiunge la soglia. Poi ogni gruppo di colori: una scala come singola riga di chip, gli altri colori con il loro valore e il riferimento che gli strumenti usano, come `{color.brand.spearmint}`. Premi un riferimento per copiarlo. **Edit in Colours** apre un gruppo nella stanza Colours. In un design system con [ruoli cromatici](#colour-roles-what-the-colours-are-called), **Colour roles** viene prima, con ogni ruolo una sola volta nelle parole e nell'ordine del sistema. Un ruolo conserva un colore per ogni colourway e aspetto. Quei colori sono elencati con il ruolo, non come colori separati; modificali nella tabella Colour roles.
- **Type** e **Logos** elencano il carattere per ogni ruolo e ogni posizione di logo, con **Edit in Type** e **Edit in Logos** una volta che ne hai di tuoi.
- **Shape and spacing** contiene **Rounded corners** (`shape.radius`) e **Spacing rhythm** (`space.base`). Ciascuno riporta *Lolly default* finché non sposti il cursore e *Yours* dopo, salva subito e può essere annullato.
- **More tokens** aggiunge spaziature, dimensioni, spessore del tratto, opacità, rotazione, numeri semplici e ombre, memorizzati come [design token](/info/design-tokens.html) standard.
- **App appearance (advanced)** elenca i colori, le dimensioni e le ombre usati dalle schermate di Lolly, e **Inspect every token (advanced)** cerca e modifica qualsiasi valore memorizzato e mostra prima ogni modifica per la verifica. Lì i valori di un ruolo cromatico in ogni colourway sono elencati con il ruolo: scegli il token del ruolo per vedere una riga per colourway, con chiaro e scuro affiancati. La riga del conteggio indica quanti valori contengono i ruoli. Un design system di sola lettura mostra lo stesso elenco.

Una sezione vuota offre **Pick a colour**, **Choose a face** o **Add a logo**.

<!--i:eti-images-->
## File

Trascina i file del tuo brand, a parte i loghi: file **vettoriali**, **immagine**, **audio** e **animati** (video, Lottie e animazioni). Compaiono in [Assets](/info/using.html#assets-your-library), ordinati in sezioni, e nel selettore di risorse di ogni strumento. Restano su questo dispositivo.

## Suono

**Sound** si sceglie ascoltando. La stanza si apre su tre suoni iniziali, **Calm**, **Steady** e **Bright**, ciascuno in una scheda nei colori del proprio genere con un pulsante di riproduzione. Riproducine uno per ascoltare un breve estratto; avviarne un altro ferma il primo. **Choose** rende quel suono il suono di ogni uso. La quarta scheda, **Mixed**, dà a ogni uso il suo suono: Calm per Explain, Steady per Demonstrate e Bright per Play. Il suo pulsante di riproduzione li fa ascoltare tutti e tre a turno. Non viene salvato nulla finché non scegli **Save sound**. Il suono diventa poi parte di questo design system, con un checkpoint nella stessa cronologia usata dalle altre stanze. Un design system senza un suono continua a funzionare come prima.

Un uso è un momento in cui il suono viene riprodotto: **Explain**, **Demonstrate** e **Play** per iniziare. Ogni uso è un chip con il proprio pulsante di riproduzione. **Music** o **With narration** sopra i chip imposta se un chip riproduce solo la musica o la musica sotto una voce. L'uso che scegli mostra il suo scopo e la sua musica in parole semplici, per esempio "Caldo · 84 bpm · Rhodes, basso scorrevole, batteria dal suono polveroso". Ogni uso adotta il genere, il tempo e gli strumenti del suono scelto (oppure, con Mixed, i propri). Ogni uso mantiene la propria melodia e il proprio bilanciamento: Explain fa sì che la melodia lasci spazio alla voce, e Play lascia che la melodia guidi. Passare da Mixed a un singolo suono e viceversa conserva entrambi. Un uso che hai aggiunto tu mantiene il suono che ha in Mixed. Il design system registra quale hai scelto. **Add a use** ne aggiunge uno e ti lascia digitare il nome sul posto. **Make main** sceglie l'uso riprodotto quando non viene richiesto altro. **Another tune** riproduce una nuova composizione con le stesse impostazioni.

**Edit in the music generator** apre il [generatore musicale](/info/generated-music.html#the-music-generator) sulle impostazioni di quell'uso, con una riga in alto che indica di chi è il suono che stai modificando. **Save to this use** riporta le impostazioni nella stanza; **Cancel** torna indietro senza cambiare nulla. Le scelte non salvate nella stanza restano in attesa mentre sei altrove. Se nel frattempo qualcuno salva il suono in un'altra scheda, prevale il salvataggio più recente e la tua modifica viene esclusa.

**Voice** sceglie una voce per l'uso, la velocità del parlato e il volume della musica sotto la voce; **Hear the voice with the music** riproduce entrambi. Sotto **More** si trovano l'attenuazione mentre la voce parla, le parole da provare (restano nella stanza), le note di pronuncia (una per riga, nella forma scritto = pronunciato) e le note sulla voce. Le anteprime usano il modello vocale locale e lo stesso missaggio di un'esportazione di sequenza. Un'anteprima sfuma alla fine; non è un finale composto.

**Notes and signature** contiene ciò a cui prestare attenzione nell'ascolto di un uso e una firma sonora: un'apertura o una chiusura fissa conservata in un file audio separato. Inserisci la firma nella tua sequenza; la musica generata non include mai la firma. Un requisito che questa versione di Lolly non può verificare blocca la nuova musica per quell'uso.

**Details** contiene il carattere del brand (quale sensazione dovrebbe dare il suono, cosa resta uguale e cosa evitare) e la revisione d'ascolto. **Record a listening review** conserva il nome del revisore, la data e le sue note associate alla versione salvata del suono. Qualsiasi modifica riporta il suono allo stato di bozza. Una revisione copre quella versione, non ogni brano creato in seguito a partire dal suono: ascolta ogni nuovo pezzo prima di distribuirlo.

**Make a music project** apre l'uso nel generatore musicale come progetto che conserva l'uso, la versione del suono e le impostazioni esatte. Lì **New tune** crea una nuova composizione e mantiene il suono. Se cambi le impostazioni, **Put the sound back** ripristina il suono e **Keep as my own** prosegue con un brano indipendente. Finché non scegli, il progetto non può essere salvato o scaricato come creato da quel suono. I link di condivisione contengono solo le impostazioni musicali. Il progetto e un brano salvato conservano anche le note del suono, che restano fuori dai link di condivisione e dalle credenziali pubbliche del file audio. Conserva una registrazione renderizzata quando l'audio esatto deve restare invariato nelle versioni future del generatore.

<!--i:eti-checklist-->
## Regole

**Rules** imposta cosa le persone possono cambiare, cosa resta fisso e cosa Lolly può verificare.

![Rules in Lolly Demo: quattro regole dell'organizzazione, ciascuna contrassegnata Checked in Design e Required o Advisory, poi Try your design system in use con i suoi esempi pronti per il rendering](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** elenca le tue regole. **Add rule** (o **Add your first rule**) apre un breve modulo:

- un **Rule name** con parole tue, come *Accenti Beacon*;
- il **Check**: **Colour choices**, **Font choices**, **Fixed artwork** o **Text length**, con il ruolo del brand che usa, sotto il nome che hai dato al ruolo;
- l'**Example** a cui si applica (Poster, Title slide, Content slide o Lolly Chart), il **Mode** e se è **Required** o **Advisory**;
- **Reviewed by**, poi **Save draft** o **Approve & save**.

L'approvazione registra la tua decisione su questo dispositivo. Le regole obbligatorie approvate vincolano il poster riutilizzabile, e le verifiche coprono solo i PNG di esempio; non cambiano nessun altro strumento.

Le regole nel file dei token di un design system, come abbinamenti di colori approvati, peso e allineamento del testo o un logo per superficie, sono elencate qui come **Checked in Design**. Lolly Design le verifica livello per livello nella scheda **Before you export** del pannello di esportazione, e `lolly check` fa lo stesso per un documento Lolly Design salvato ([Prima di esportare](/info/design.html#before-you-export)). Una regola per cui questa build non ha un controllo viene conservata come fornita e contrassegnata **Unchecked**.

Lolly Demo include quattro regole approvate dell'organizzazione. I titoli non sono mai tutti in maiuscolo: quella regola è obbligatoria, quindi `lolly check` segnala un titolo in maiuscolo come errore. Le altre tre sono indicative. Il corpo del testo è allineato a sinistra. I marchi primari stanno su superfici chiare e quelli in negativo su superfici scure. Le linee tratteggiate indicano dove rilasciare.

**Try your design system in use** renderizza quattro esempi dalla revisione attuale con **Render & check examples**. Scegli un **Mode** e **Try your own text** per il titolo, il testo di supporto e il testo della slide. Ogni esempio riporta ciò che è stato misurato, con **See checks & sources** e **Download check report**. **Make reusable poster** scarica un `.lolly` con il suo layout fisso e le scelte di input approvate. Gli esempi sono locali: eseguire una verifica non pubblica né approva nulla.

Una build distribuita con un brand fisso mostra le stesse regole e gli stessi esempi in sola lettura, sotto *This brand is set*.

<!--i:eti-graduation-cap-->
## Skill

**Skills** elenca le [skill del brand](/info/brand-skills.html) del design system attivo: gli standard scritti del brand, uno per disciplina, per persone e agenti AI. Ogni riga indica la disciplina, lo stato assegnato dal brand (**Draft** o **Approved**), se la skill è pubblica o interna e la sua revisione. Scegli una riga per leggere la skill con la sua copertura, che confronta le righe della skill con i tuoi token: cosa Lolly verifica, cosa è in conflitto, cosa è coerente e cosa è solo una linea guida.

**Download skill (.zip)** scrive la skill come cartella Agent Skills per uno strumento per agenti, con link di catalogo che puntano a questo Lolly. **Copy as one file** mette lo stesso testo negli appunti per una finestra di chat. Un design system senza skill proprie elenca una base che Lolly scrive dai suoi token e dalle regole dell'organizzazione ogni volta che la base viene letta. La stanza legge le skill e non le modifica mai.

<!--i:eti-upload-->
## Importa un brand

**Add from…** nella barra apre un selettore che chiede cosa hai, non in che formato è:

- **Design tokens or a design file**: JSON DTCG o Tokens Studio, un progetto Penpot, uno zip di set di token, un pacchetto di design system Lolly, un SVG, un `DESIGN.md` o una cartella di pagina del brand.
- **PDF**: un deck o un file di linee guida, letto su questo dispositivo per ricavarne colori, marchi e caratteri incorporati.
- **Logo or screenshot**: un'immagine diventa una palette suggerita, letta su questo dispositivo. Legge i colori, non il carattere o il layout.
- **Saved web page**: un file HTML e i suoi file CSS, oppure HTML o CSS incollato, fino a 20 file e 2 MB. Viene letto solo il testo che fornisci: le risorse collegate non vengono scaricate e gli script non vengono eseguiti.
- **Font file**: TTF, OTF o WOFF. Apre la stanza Type, dove viene installato il carattere.
- **Website**: una pagina, letta per ricavarne colori e tipografia. Questa tessera compare solo su un dispositivo che può leggere una pagina e indica quale lettore usa: l'app su questo dispositivo, oppure l'estensione del browser in una scheda in background, con il tuo accesso. Digitare un URL compila solo il campo; premere il comando di recupero dà il consenso.

Scegli la sorgente del file di design e la scheda successiva elenca i formati accettati come tessere con icone. La scheda è un'unica area di rilascio. Puoi anche trascinare un file sullo studio.

![La scheda di importazione - i formati accettati compaiono per primi come tessere con icone e l'intera scheda è un'unica area di rilascio](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- Un **pacchetto di design system Lolly** (`.lolly`, o un vecchio `.zip`) si installa in un solo passaggio.
- Un'esportazione **Penpot** (`.penpot`) importa i suoi design token.
- Un file **Design Tokens** (W3C DTCG) o **Tokens Studio** (`.json`) importa i suoi token. Una descrizione che chiede a un lettore di ignorare istruzioni, rivendica permessi o chiede di eseguire codice viene esclusa, e l'importazione indica dove si trovava.
- Un **semplice SVG** viene analizzato per ricavarne i colori tra cui scegli, e il primo diventa il tuo primario.
- Un **`DESIGN.md`** (`.md`) passa a **Try these colours** con i suoi token così come sono scritti. Il suo testo può essere conservato come bozza di skill del brand, e la scheda segnala le righe che chiedono a un lettore di ignorare istruzioni, rivendicano permessi o chiedono di eseguire codice. Gli agenti e le pagine del brand non vedono una bozza finché non premi **Keep this skill** nella stanza Skills, e una skill conservata resta interna.
- Una **cartella di pagina del brand**, scelta come cartella, trascinata o compressa in zip, passa alla stessa verifica. Ogni file viene verificato rispetto al `brand.json` della cartella; basta un file che non corrisponde per rifiutare l'intera cartella. L'importazione aggiunge i token. Loghi e font restano nella cartella.

::: warning Il controllo delle istruzioni legge riga per riga
Il controllo che esclude le istruzioni nelle descrizioni di un file di token legge riga per riga e non rileva altre formulazioni. Leggi un file ricevuto da qualcuno che non conosci prima di applicare i token.
:::

Lolly legge una pagina del brand dai file che fornisci. Non recupera l'indirizzo di un altro sito.

### Un file con parole proprie per i colori

Un file di token o un `DESIGN.md` può usare parole proprie per i colori, come main, accent, supporting e tertiary. Quando Lolly trova queste parole, la verifica elenca ogni parola prima che venga applicato qualcosa: la parola, il suo colore in ogni aspetto, il token da cui proviene e l'interpretazione suggerita da Lolly. Lolly suggerisce interpretazioni dalle sole parole, confrontandole con un breve elenco, senza un modello. Una parola fuori elenco viene importata come propria del brand, **By name only**. Puoi rinominare qualsiasi parola, dire a cosa serve, darle un'altra interpretazione o deselezionarla per conservarla come colore con nome.

**Install with these roles** scrive i ruoli; **Install without roles** installa il file come è arrivato. Un file senza queste parole salta questo passaggio. Un file che dichiara i propri ruoli, come uno scritto da Lolly, li mostra come sono scritti e li installa invariati; puoi modificarli in seguito nella stanza Colours. Il terminale non ha una verifica preliminare: `lolly system import` conserva un record dichiarato e lascia le parole degli altri file come colori con nome.

### Verifica un riferimento

Un logo, uno screenshot, un sito o una pagina salvata apre **Try these colours**: un esempio nei colori proposti, un **Main colour** che puoi cambiare e un nome per un nuovo sistema. Un riquadro spiega cosa succede applicando le impostazioni: **sostituisce** le impostazioni dei token attive con la palette generata e gli stili predefiniti, **conserva** i tuoi font e i file della libreria e il sistema precedente può essere **recuperato**. **Apply suggested settings** crea un checkpoint, poi applica le palette chiara e scura. **Restore brand settings** può ripristinare le vecchie impostazioni. **Change reference** sceglie un'altra sorgente.

::: details Cosa viene letto da un riferimento e il report del contesto di design
**Palette, source details and individual choices** mostra ciò che è stato letto, i nomi dei font trovati e il contrasto dell'anteprima. I nomi dei font sono solo suggerimenti; installi un carattere in Type. I dettagli della sorgente possono includere tipografia, intervalli, padding e valori degli angoli dove osservati, altrimenti contrassegnati **Not observed**. Una pagina salvata o la lettura nativa di un sito riporta gli stili dichiarati, che la pagina potrebbe non usare. L'estensione del browser può riportare stili misurati su un campione di elementi visibili. Sono osservazioni: non viene installato nulla e la spaziatura della sorgente non sostituisce mai la tua. **Choose individual items in the tray** conserva singoli elementi. **Download design context** salva un report JSON di osservazioni, token proposti e informazioni sulla sorgente (con uno SHA-256 di qualsiasi HTML o CSS fornito). Il report non contiene il testo grezzo della pagina e non è una Content Credential firmata.
:::

Le importazioni di PDF e file di design mantengono i propri controlli di verifica. Gli elementi nel **Tray** non cambiano nulla finché non li aggiungi nella stanza che gestisce quel tipo di materiale. `#/start?source=<kind>` apre il selettore su una sorgente (`file`, `pdf`, `image`, `font`, `url`, `page`), e `?import` apre l'elenco semplice.

### Trova e confronta un aspetto

Apri **Find a look** dal Board o dall'elenco dei design system in Settings. Sfoglia i sistemi salvati su questo dispositivo e alcuni esempi Lolly riutilizzabili, e cerca per nome, etichetta di colore o font dichiarato. **Closest to my current palette** ordina per somiglianza cromatica misurata, con i font corrispondenti che risolvono le parità; non è un punteggio di qualità.

Fai clic su un aspetto per vederlo in anteprima nel contesto; l'anteprima non cambia nulla. **Use this look** su una scheda applica quell'aspetto. Un sistema salvato diventa quello attivo, senza modificare nulla. I colori di un esempio entrano nel design system aperto dopo il consueto checkpoint. I loghi, i font del sistema e tutto ciò che l'esempio non definisce restano come sono. **Compare looks** aggiunge una casella di selezione a ogni scheda: scegline due per confrontarli affiancati. **Restore brand settings** recupera l'aspetto precedente. I sistemi salvati hanno **Search tags** modificabili sotto **Details and design context**. Gli esempi sono ricette cromatiche originali di Lolly, senza raccolte ottenute tramite scraping e senza account.

![Lolly: confronto affiancato di Sunroom e Orchard prima di applicare uno dei due sistemi cromatici.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

<!--i:eti-package-->
## Conserva e trasferisci il tuo design system

### Trasferisci un brand tra dispositivi

**Export** scrive un unico file **`LollyBrand-….lolly`**: i tuoi token, font, loghi e la preferenza del tema, con un manifest di integrità verificato durante l'importazione. Le versioni web precedenti alla 1.0.7 davano al file l'estensione `.zip`, e Lolly accetta ancora quella forma. **Tokens (.json)** scrive il semplice documento dei design token, senza font o loghi, per un repository, un passaggio di build o un altro strumento per token.

Per reimportarne uno, usa **Add from… → Design tokens or a design file**, oppure trascina il file sullo studio. È così che un collega ti passa un brand o tu lo porti a una seconda installazione, senza account e senza cloud. [Lavorare con i partner](/info/partners.html) spiega cos'altro inviare quando chi riceve il tuo brand lavora per un'altra organizzazione. Per importare un brand dalla riga di comando, vedi [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** impacchetta i font che hai aggiunto in un RPM installabile. Se ne hai caricati alcuni tu, Lolly ti chiede prima di confermare che puoi ridistribuirli.

### Ripristina impostazioni precedenti

Apri **More** nella barra, scegli **Restore brand settings**, seleziona un checkpoint datato e premi **Restore**. Questo ripristina colori, impostazioni tipografiche e altri token del brand attivo; i file di font e immagini restano come sono. Lolly salva prima le impostazioni attuali come **Before restore**, così puoi annullare un ripristino anche dopo aver chiuso il browser. Gli ultimi 20 checkpoint vengono conservati su questo dispositivo. Una modifica fatta mentre lo studio mostra **Saving…** sopravvive a un ricaricamento, e una scheda offre di ripristinare le modifiche il cui salvataggio non è stato completato.

### Versioni

Una versione pubblicata è una **copia permanente con nome** conservata su questo dispositivo. Non cambia mai, quindi uno strumento o un link che la fissa (con `designv`) continua a disegnare la stessa cosa. Un sistema con qualcosa di tuo elenca **Versions & publishing** nel menu **More** della barra; dopo la prima pubblicazione **Versions** si aggiunge alle stanze. `#/start?area=versions` apre Versions.

::: warning Una versione pubblicata è permanente
Non c'è ancora un comando di eliminazione, e il pannello lo dice. La pubblicazione non può essere annullata; il ripristino sì. *Restore latest from this version* è una normale modifica, con **Undo** offerto subito.
:::

**Le rimozioni compaiono per prime nella scheda di compatibilità**, perché un token rimosso interrompe il funzionamento di uno strumento.

**Publish only** conserva una versione senza cambiare ciò che gli strumenti seguono; **Publish and make active** fa seguire quella versione agli strumenti e all'app. **Follow the latest again** rende subito effettiva ogni modifica.

### Pubblica una pagina del brand

Una [pagina del brand](/info/brand-page.html) è un unico indirizzo per persone e agenti: una pagina di loghi, colori, tipografia ed esempi, con gli stessi dati nei file allegati. **Publish a brand page**, sotto Versions & publishing, mostra la pagina live e, accanto alla pagina:

- **Goes public**: ogni file, raggruppato, con la sua dimensione.
- **Held back**: cosa è rimasto fuori e perché. Un logo senza licenza registrata resta fuori finché non spunti il nome del logo. Un file di font richiede una licenza registrata che ne consenta la ridistribuzione, e la pagina mostra un campione convertito in contorni quando il file resta fuori. Le skill interne del brand non compaiono mai.
- **What was checked**: coppie di colori per colourway e modalità, e le regole dell'organizzazione. Sono misure, non un verdetto.
- **In your words**: una dichiarazione d'uso e un contatto. La pagina riporta ciò che scrivi e Lolly non aggiunge licenze o dichiarazioni legali. Un interruttore disattiva la riga "Made with Lolly" nel piè di pagina.
- **On exports**: un interruttore che [registra l'indirizzo della pagina nelle esportazioni di questo design system](/info/brand-page.html#lead-back-from-your-files). L'interruttore resta disattivato finché non lo attivi, richiede un indirizzo `https` e non viaggia con un pacchetto o una copia. Un design system bloccato non mostra l'interruttore, perché decide chi lo gestisce.

**Download folder** salva la cartella come ZIP perché tu possa ospitarla dove scegli. Nulla diventa pubblico finché non ospiti la cartella. In un terminale, `lolly system publish --out=<dir>` scrive la stessa cartella. Un'istanza che serve pagine del brand offre anche **Publish to** il proprio indirizzo: una pressione esplicita, attraverso la catena di approvazione dell'istanza quando ne ha una. Un design system gestito pubblica solo quando chi lo gestisce lo consente.

### Collega un agente

**Connect an agent**, nello stesso punto, ti dà un testo da incollare e indica cosa può fare ogni opzione:

- **`AGENTS.md`** in un progetto: gli agenti leggono i nomi e le regole del sistema. Non disegna nulla e non richiede un server.
- **Lolly's public server**: disegna con Lolly Demo, qualunque sia il sistema che hai aperto qui. Non richiede una chiave.
- **Your instance**: disegna con i sistemi presenti nell'istanza e legge un token di servizio da una variabile d'ambiente. Il pannello indica il nome della variabile e non mostra mai un token.

Quando nessun server ospitato disegna con il tuo sistema, il pannello lo dice.

<!--i:eti-layers-->
## Gestisci i tuoi design system

Apri **Settings → Preferences → Design systems** per cambiare, aggiungere o rimuovere sistemi. **Open** seleziona un sistema e lo apre qui; **Make a new one** crea un sistema locale e lo apre con il campo del nome pronto. Un solo sistema è attivo alla volta, per l'intero dispositivo. [Architetture di brand](/info/brand-architectures.html) aiuta a decidere quando un brand ha bisogno di un design system proprio.

**Da dove proviene un sistema.** Il sistema fornito dal catalogo di un'installazione riporta **Came with this app**, oppure **From this instance** in un'app collegata a un'istanza. Espandi **Catalogue source** per vedere chi lo fornisce, la sua risorsa di token e il namespace e la versione o il checksum noti; se un aggiornamento fallisce, il materiale nella cache viene contrassegnato.

**I sistemi gestiti sono di sola lettura.** Un sistema riporta **Managed by this instance** (o **Managed by this app** nell'app desktop senza un'istanza) quando il suo catalogo blocca il sistema. Puoi usare e scaricare un sistema gestito. Aprirne uno qui mostra una nota di sola lettura con **Make an editable copy** e **Switch**, poi i suoi ruoli cromatici e token senza controlli di modifica. I tuoi sistemi locali restano modificabili, anche quando quello gestito è arrivato prima. Una build con un solo brand fisso apre Lolly Design System Setup su *This brand is set*, con i token e le regole d'uso del brand da leggere.

**Ogni altro sistema fornito è tuo** da nascondere, modificare e reimpostare, inclusi Lolly Demo e Lolly Starter su lolly.tools. Modificarne uno mantiene il suo nome e contrassegna la riga **Edited here**. **Reset to original** nel suo menu scarta le modifiche fatte su questo dispositivo. Il modello iniziale vuoto è l'eccezione: la prima modifica avvia un design system tuo, e Lolly ne chiede il nome una sola volta. [Lolly Demo in uso](/info/lolly-demo-in-use.html#switch-to-your-own) mostra cosa sostituisce il tuo sistema.

### Rimuovere un design system

Scegli **Remove** dal menu di un sistema; la conferma indica quale sistema sarà attivo dopo. Sessioni salvate, caricamenti e materiale condiviso con un altro sistema restano.

Rimuovere un sistema fornito lo nasconde soltanto: le sue risorse di catalogo restano, **Bring back** lo mostra di nuovo e torna da solo se rimuovi tutto il resto. Rimuovere una copia importata o modificata non rimuove il sistema fornito, i suoi loghi o i suoi font. Se la copia era attiva, il sistema fornito torna attivo. Rimuovere una copia ospitata attiva cancella solo la connessione di quella copia; un'istanza scelta separatamente resta selezionata.

::: details Modificare un design system fornito da un server
Cambiare ciò che un server fornisce è un compito da amministratore: il suo operatore cambia il catalogo sorgente e ridistribuisce, oppure un amministratore di Lolly Work verifica e applica una modifica al server. Le modifiche qui restano locali, con un'eccezione. In un'istanza Lolly Work che ti concede `brand.edit`, un sistema gestito offre anche **Edit for** quell'istanza, che apre una copia modificabile. **Send to** quell'istanza in **Versions** rimanda i suoi colori, colourway, ruoli cromatici e l'indirizzo della pagina del brand. [Modificare questa istanza dallo studio](/info/work-design-system-administration.html#edit-this-instance-from-the-studio) spiega cosa può cambiare una modifica e come l'istanza la rende disponibile. Vedi [Rimuovere un design system dal catalogo](/info/configuration.html#removing-a-catalogue-design-system) e [Configurazione](/info/configuration.html#supplied-and-local-design-systems).
:::

<!--i:eti-code-->
## Usa il contesto di design fuori dall'app

**Download design context** salva il documento dei token, i colori risolti, le famiglie di font dichiarate, gli id delle risorse, le evidenze della sorgente dove registrate, la copertura e le regole esplicite, senza file di font né prove di proprietà. La riga di comando legge il file senza server: `lolly system import` lo rende il design system del terminale e `lolly system check` verifica gli input di Lolly Design rispetto al contesto salvato. [Porta il tuo design system](/info/cli.html#bring-your-design-system) tratta l'importazione e [Quale design system usa un comando](/info/cli-decks.html#which-design-system-a-command-uses) tratta la verifica. Un client MCP legge lo stesso brief da `lolly://design-context` ([Server MCP](/info/mcp.html)).

<!--i:eti-map-pin-->
## Dove proseguire

- **[Usare Lolly](/info/using.html)**: gli strumenti, il salvataggio, la condivisione e Assets.
- **[Architetture di brand](/info/brand-architectures.html)**: come divisioni, prodotti, brand garantiti, clienti e stagioni si associano a design system, colourway e identità dei loghi.
- **[Lavorare con i partner](/info/partners.html)**: condividere il tuo brand con un partner e lavorare in un brand che ti è stato fornito.
- **[Pagine del brand](/info/brand-page.html)**: pubblica il tuo design system a un unico indirizzo, come kit per la stampa e kit per gli agenti.
- **[Design Tokens](/info/design-tokens.html)**: il modello di token in cui è scritto il tuo brand.
- **[Esporta un file](/info/exporting.html)**: unità di stampa, CMYK e i formati in cui viene renderizzato il tuo brand.
