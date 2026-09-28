# Il Brand Studio

Il **Brand Studio** in `#/start` è l'unico posto dove modelli il tuo brand - i suoi loghi, colori, tipografia, il resto dei tuoi token e i file che conserva. Impostalo qui una volta e ogni strumento, pagina ed esportazione lo segue *per costruzione*, non per revisione.

Le modifiche vengono mostrate in anteprima **dal vivo in tutta l'app** man mano che le apporti, così puoi vedere un colore o un font atterrare ovunque prima di confermarlo. È tutto sul dispositivo: i tuoi file e token di brand non lasciano mai il tuo computer (scegliere un Google Font recupera quella singola famiglia da Google, una volta, dopo una finestra di consenso), e il brand viaggia in un unico file [brand pack](#move-a-brand-between-devices).

> **Questo è l'editor. La dashboard è lo specchio.** La scheda **Sistema di design** nella Dashboard (`#/d`) *mostra* il tuo brand in sola lettura; tu lo *modifichi* qui, in `#/start`. Se vuoi cambiare un colore più avanti, torna al Brand Studio.

## Le stanze

Lo studio è un insieme di **stanze** elencate in una barra laterale - non passaggi. Nulla è numerato, nulla è vincolato ad altro e arrivare in una qualsiasi di esse è legittimo:

- **Panoramica** - lo snodo. Cosa esiste in questo momento, a colpo d'occhio, con una porta verso ogni stanza.
- **Colori** - aggiungi colori uno alla volta, assegna ruoli o genera un'intera palette a partire da uno solo.
- **Tipografia** - i quattro caratteri che l'app, gli strumenti e ogni esportazione leggono.
- **Loghi** - i tuoi marchi, in ogni orientamento e trattamento.
- **Token** - raggio degli angoli, spaziatura, ombre e il resto del sistema.
- **File** - i file immagine, audio e movimento che il tuo brand conserva.

Su telefono lo stesso elenco diventa una striscia orizzontale di chip fissata sotto l'intestazione. Cambiare stanza non ricarica mai nulla - l'editor mantiene tutti i suoi pannelli montati e mostra semplicemente quello richiesto.

**Collega direttamente una stanza** con `#/start?area=<key>`. Le chiavi sono `overview`, `color` *(nota l'ortografia americana nell'URL)*, `type`, `logos`, `tokens`, `catalogue` (la stanza File - la chiave del pannello è un contratto permanente, quindi l'URL mantiene il vecchio nome) e `versions`. `?tab=` è l'alias di lunga data per la stessa cosa e continua a funzionare, così i vecchi link e segnalibri restano validi; qualsiasi cosa non riconosciuta apre Panoramica invece di finire in un vicolo cieco.

Fissate al **piede della barra laterale** ci sono le azioni che appartengono all'intero sistema di design piuttosto che a una singola stanza:

- **Aggiungi da…** - il selettore di sorgente, per portare un brand da un file, un PDF, un'immagine, un font o un sito web. Vedi [Portare un brand](#bring-a-brand-in) più sotto.
- **Vassoio** - i candidati che una scansione ha trovato ma non ha ancora confermato. Resta nascosto finché una scansione non conserva effettivamente qualcosa, e mostra un conteggio quando lo fa; nulla al suo interno cambia il tuo brand finché non premi Aggiungi su quella riga.
- **Esporta** - scrive l'intero sistema di design come un unico `LollyBrand-….lolly`.
- **Token (.json)** - il documento dei design token puro e semplice, per un repository, un passaggio di build o un altro strumento per token.
- **Ripristina impostazioni del brand** - torna a un checkpoint salvato prima di un'importazione o una sostituzione delle impostazioni del brand.
- **Versioni** - pubblica, attiva e ripristina copie con nome del sistema di design. Nascosto finché non c'è qualcosa di tuo da pubblicare (o un link `?area=versions` lo richiede per nome).

![La barra laterale delle stanze dello studio - Panoramica, Colori, Tipografia, Loghi, Token e File](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Panoramica

Panoramica è la prima stanza, e ha due facce.

Con **ancora nulla scelto** dice **Rendilo tuo**. **Inizia da un riferimento** apre il selettore di sorgente per un logo, uno screenshot, una pagina web o un file di design. **Scegli un colore**, **Scegli un carattere** e **Aggiungi un logo** aprono direttamente i loro controlli esistenti. Ogni percorso inizia con una scelta; aprirne uno non scrive nulla. **Esplora gli strumenti** è disponibile subito.

Non appena qualcosa è tuo, la stessa stanza mostra **cosa hai**, con i conteggi che hai fatto in primo piano. Colori indica il numero di colori che il sistema di design porta, e aggiunge un discreto `· N starter` solo dove sono in mostra colori ereditati; la striscia accanto mette prima i colori che hai scelto tu, poi una linea sottile e quelli starter sbiaditi. Tipografia si legge per ruolo (*Inter per i titoli*, con *Starter per il resto · SUSE, SUSE Mono* sotto). Loghi indica quanti slot sono riempiti, o **Non impostato**. Token porta il raggio degli angoli, etichettato come *starter* finché non lo sposti. File dice **Niente ancora** mentre la libreria è vuota. Ogni blocco è una porta verso la sua stanza. Qui ci sono conteggi, mai una barra di avanzamento e mai una scheda di completamento - niente in questo studio è dovuto.

## Loghi

Inizia svuotando la tua cartella di marchi nella zona di rilascio in alto: **"Rilascia i marchi qui, o scegline diversi in una volta"** accetta tutti i file che hai in un solo passaggio. Ogni file viene letto per la sua forma e il suo inchiostro, poi messo in coda sotto **In attesa di uno slot** come un chip che dice cosa pensa - *"Sembra l'Orizzontale primario"*, con la misurazione su cui si è basato, e un pulsante **Posiziona** (**Sostituisci**, dove quello slot è già occupato). Dove non è sicuro, il chip lo dice chiaramente e offre invece **Cambia slot**, che li elenca tutti e otto. Nulla viene posizionato finché non premi qualcosa.

Intorno a quella coda accadono due cose. Un marchio con margine vuoto in eccesso riceve prima un'**offerta di ritaglio** - rispondi o premi Escape e il file originale entra intatto. E dove un marchio può fornire uno slot fratello vuoto, la stanza offre la versione derivata **monocromatica** o **inversa** come proprio chip, contrassegnato *Generato*, che scompare di nuovo se riempi quello slot in un altro modo.

Sotto si trova la griglia in cui finisce ogni marchio - slot **orientamento × trattamento**:

- **Orientamenti:** Orizzontale (logotipo + simbolo in riga) e Verticale (impilato, per spazi quadrati e alti).
- **Trattamenti:** Primario, Primario inverso (per sfondi scuri), Monocromatico (un colore) e Monocromatico inverso.

Sono otto slot opzionali. Clicca su uno slot per aggiungere un PNG, SVG, JPEG o WebP; clicca su uno slot pieno per sostituirlo. Ogni slot è opzionale e tutto resta su questo dispositivo.

![La matrice dei loghi - ogni orientamento in alto, ogni trattamento come proprio slot tratteggiato, tutti opzionali](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Segni personalizzati** - aggiungi marchi che il tuo brand chiama a modo suo (un'icona, uno stemma, una favicon) sotto **Segni personalizzati**; assegnagli un nome e scegli un file.
- **Più identità** - un sub-brand, un prodotto o un evento può avere il proprio set completo di loghi. Usa **+ Aggiungi un altro logo** e assegnagli un nome; il tuo set principale è semplicemente "Il tuo logo".
- **Carica un SVG e Lolly ne legge i colori.** Su un'installazione nuova di zecca imposta silenziosamente il tuo colore primario dal logo e lo segnala. Su un brand esistente offre invece il colore come suggerimento - *"Trovato nel logo: #…"* con un pulsante **Usa come primario** accanto - nella stanza Colori, dove puoi accettarlo o ignorarlo.

## Colori

La stanza cresce insieme al sistema di design. Nulla di ciò che non ti serve ancora è nella pagina, così una prima visita è una sola decisione e il resto arriva man mano che arriva la palette.

### Il primo colore

Un sistema di design senza colori propri si apre su un'unica colonna centrata: **Inizia con un colore**, un grande chip dal vivo, un campo e una riga discreta che dice che ruoli, sfumature e impostazioni di stampa arrivano man mano che il sistema cresce.

- **Il chip è il selettore.** Premilo e si apre la card OKLCH dello studio sul chip, precompilata con qualsiasi cosa contenga il campo: un nome, la ruota, i quattro quadranti, l'alfa e **Salvato come**, con **Annulla** e **Aggiungi colore** in fondo. Trascinare un quadrante colora il chip e riscrive il campo mentre lo fai, e nulla raggiunge il sistema di design finché non premi **Aggiungi colore**.
- **Il campo accetta qualsiasi notazione** - `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` o un nome di colore semplice - e un'intera *lista* di colori diventa una riga di chip che aggiungi uno alla volta.
- **Ci sono altre due porte accanto.** Il contagocce (su un browser che ne ha uno) preleva un colore dallo schermo, e **Da un'immagine** legge uno screenshot o una foto su questo dispositivo e offre i colori che trova.
- **Aggiungi non è mai disattivato.** Con nulla di leggibile nel campo, apre il selettore, che è ciò che di solito significa una pressione a vuoto; un testo che non riesce ad analizzare riceve una riga sotto il campo che lo dice, invece di un pulsante morto.

Il primo colore diventa il **primario**, e il chip che risponde all'aggiunta lo dice - *"Primario è ora Vivid Violet"* - con **Regolazione fine** accanto.

![La stanza Colori senza ancora nulla scelto - un grande chip dal vivo, un campo e una riga su cosa arriva dopo](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Starter

**Starter** è la parola per tutto ciò che è arrivato con l'app invece di essere stato scelto. Un'installazione nuova non porta alcun colore: quello che ha è un'unica rampa neutra, inchiostro su carta, così superfici, testo e linee sottili si renderizzano prima che chiunque abbia deciso qualcosa. Quei neutri sono impalcatura, quindi non vengono contati come colori e non vengono disegnati nel pannello della palette. Vivono nella stanza [Token](#tokens) come **Neutri · starter · 9**, con un **Apri** che li mostra nel pannello Colori come un unico gruppo richiuso ed etichettato (`#/start?area=color&group=neutral`).

La stessa parola ricorre in ogni stanza: un ruolo che si appoggia su un colore starter si legge *"Paper iniziale come sostituto"* e il suo selettore offre **Scegli…**; un carattere starter porta un'etichetta **Starter** e nessuna tinta; un raggio degli angoli starter è etichettato nella Panoramica. Il materiale ereditato non viene mai disegnato con un bordo tratteggiato, perché qui un bordo tratteggiato significa una zona di rilascio.

### Man mano che la palette cresce

I tuoi colori restano accanto a un'anteprima **In context** su uno schermo largo e si impilano sopra di essa su schermi più piccoli. L'anteprima può mostrare un poster, un grafico o una card d'interfaccia usando la tua palette. I colori starter restano nel proprio gruppo richiudibile, separato dai colori che aggiungi.

Aggiungi colori individuali o un set di sfumature, assegna i loro ruoli, e apri le sezioni avanzate quando ti servono. Il grafico dei colori, i gradienti e i controlli di download restano con la palette.

![La stanza Colori dopo aver aggiunto un colore, con la sua palette e un'anteprima di composizione dal vivo](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Ruoli - cosa leggono gli strumenti

**Ruoli** è il livello sopra gli swatch: quale colore interpreta ogni parte in ogni strumento ed esportazione. I ruoli sono opzionali (un sistema di design con tre colori sciolti e nessun ruolo è perfettamente valido), qualsiasi swatch può assumerne uno e la lettura del contrasto è misurata rispetto alla superficie, prima con APCA.

Una riga si legge in uno di tre registri, così la striscia non afferma mai una decisione che nessuno ha preso:

- un colore proprio che serve il ruolo, a piena intensità;
- **_Paper_ iniziale come sostituto** - attenuato, con **Scegli…** nel suo selettore;
- **↳ segue Primario** - il ruolo si risolve tramite il primario invece che con un colore proprio.

Non appena la palette ha sfumature, la striscia cresce fino a tutti e sette gli slot che uno strumento può leggere: Primario, Secondaria, Superficie, Testo, Attenuato, Bordo e Su primario. Su primario è derivato dal primario, si legge come **Derivato** e non porta un selettore.

**L'accento proprio dell'app è una preferenza, non un token.** Per impostazione predefinita l'interfaccia segue il design system e l'accento dell'interfaccia prende il colore primario. Questa è un'impostazione di Aspetto su [il tuo profilo](/info/profile.html) - **L'interfaccia segue il design system** - e disattivarla lascia l'interfaccia neutra. Strumenti, canvas ed esportazioni non ne risentono in nessun caso, e i font e il raggio degli angoli seguono il design system sia che l'impostazione sia attiva sia che non lo sia.

### Le ali per esperti

Quattro sezioni ripiegate si trovano sotto l'anteprima di composizione e i ruoli colore. Apri quella che vuoi; ognuna è collegabile direttamente come `#/start?area=color&focus=<wing>`, che la apre indipendentemente da cosa la stanza stia mostrando in quel momento:

- **Explore shades & harmonies** (`focus=generate`) - un colore in un set completo di sfumature. Descritto sotto.
- **Curve delle tonalità** (`focus=curves`) - rimodella una rampa punto per punto. Luminosità, cromaticità e tonalità hanno ciascuna la propria curva, selezionabile con L / C / H, e le sfumature sotto si ricalcolano dal vivo mentre trascini.
- **Contrasto** (`focus=contrast`) - **Blocco contrasto** ritona una rampa per raggiungere obiettivi APCA rispetto a uno sfondo che scegli, ogni passo mantenendo la propria tonalità e cromaticità; **Ruota tonalità** gira l'intera rampa in blocco attorno alla ruota, ogni sfumatura mantenendo la propria luminosità e cromaticità.
- **Stampa** (`focus=print`) - cosa diventa il primario in stampa: il suo valore schermo automatico, oppure una build CMYK fissata o un inchiostro spot con nome.

### Un colore, un'intera palette

Dentro **Explore shades & harmonies**, scegli un **Starting colour**. Lolly suggerisce sfumature abbinate usando la stessa matematica del colore percettivo (OKLCH) che il motore usa altrove. Regola i suggerimenti:

- **Schema** - Mono, Complementare, Analoghi o Triade - imposta come il colore secondario si relaziona al primario.
- **Sfumature** - un cursore da 3 a 20 (predefinito 5) controlla quanti passaggi genera ogni rampa.
- **Regolazione fine** (ripiegata) - **Intensità dell'interfaccia** (Attenuato / Profondo), **Contrasto** (Comoda / Alto) e **Testo sul brand** (Auto / Chiaro / Scuro).

Cambiare il colore di partenza e i controlli cambia solo i suggerimenti. Clicca su una sfumatura per aggiungere quel colore, oppure su **Aggiungi 5 sfumature** per aggiungere un gruppo (il numero segue la tua impostazione Sfumature). I colori e i ruoli esistenti restano al loro posto. Annulla rimuove l'aggiunta.

Le righe **Primario**, **Neutro** e **Secondaria** mostrano le sfumature suggerite. Apri **Theme preview** per ispezionare esempi chiari e scuri e le loro letture di contrasto. Scegli lì un passaggio Neutro o Secondaria per regolare gli ancoraggi di tema proposti. Ricostruire l'intera palette resta un'azione separata e verificata, più sotto.

![Tre gruppi di sfumature suggerite, con controlli di aggiunta individuali e un Theme preview separato](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Costruisci la palette (generatore di armonie)

In **Find matching colours**, il generatore di armonie suggerisce colori accento abbinati al primario. Scegli un'**Armonia** - **Complementare**, **Adiacente**, **Triade**, **Tetrade** o **Analoga** (che porta con sé un proprio numero di **Accenti**, da 2 a 5, e un **Angolo** di tonalità da 10° a 45°) - e ogni candidato arriva con un nome leggibile generato automaticamente e un pulsante **+ Aggiungi**. Aggiungerne uno inserisce subito quel colore nella palette, una pressione per un token. **In context** mostra in anteprima i tuoi colori aggiunti su composizioni di esempio.

![Accenti generati, ciascuno con uno swatch, un nome generato automaticamente, il suo hex e un pulsante Aggiungi](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Confermare una palette generata

Aggiungere un colore suggerito o un gruppo di sfumature conserva il resto della tua palette. Per una sostituzione completa, apri **Rebuild the whole palette…** e premi **Preview full rebuild**. La revisione spiega le modifiche: quanti ruoli restano come li hai assegnati, quanti colori aggiunti da te vengono mantenuti, quante curve di sfumatura vengono riancorate, quanti blocchi di stampa vengono ripinnati, quante sfumature nascoste restano nascoste, quanti stop del gradiente mantengono il loro colore.

**Apply rebuilt palette** su quella card la conferma; **Annulla** si ritira e non cambia nulla. Una volta eseguita, la card offre **Annulla** già con il focus su di esso - e viene creato un checkpoint dell'intero sistema di design *prima* dello scambio, così "rimetterlo com'era" è un ripristino e non un pomeriggio perso.

### La palette, il grafico e ogni swatch

La palette elenca i colori del sistema di design in gruppi richiudibili, ognuno con il proprio controllo **+ Aggiungi**. Crea e rinomina gruppi per organizzare il tuo lavoro. Un ruolo non crea mai una seconda tile: un token è una tile, e una tile a cui punta un ruolo porta invece un piccolo segno d'angolo (**P**, **S**, **Su**, **T**). Sotto le tile, **Grafico dei colori** si apre su due viste degli stessi swatch: la **Ruota** (la ruota OKLCH - trascina un punto per ricolorarlo, clicca un punto per modificarlo o clicca uno spazio vuoto per aggiungere un nuovo swatch) e il grafico **Gamut**, che mostra dove termina davvero l'intervallo visualizzabile. `#/start?area=color&focus=chart` apre direttamente la card, come fa sempre `?wheel`.

![Il pannello della palette, ogni gruppo richiudibile, con la pillola di download ancorata sul bordo inferiore](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![La ruota OKLCH - l'angolo è la tonalità, la distanza dal centro è la cromaticità e i grigi scorrono lungo un binario di luminosità sul lato](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Clicca su qualsiasi swatch per aprirne l'editor:

- **Rename** - rinominalo.
- **Set the colour** - il selettore si apre su slider percettivi **OKLCH**, con modalità **Hex**, **HSL**, **RGB** e **CMYK**; il campo valore legge *e* scrive nello spazio attivo, così puoi incollare un hex o digitare percentuali di inchiostro. Nota che inserire un CMYK imposta il colore *a schermo* per conversione - per fissare inchiostri esatti, usa il blocco di stampa qui sotto.
- **Stored as** - scegli come viene salvato lo swatch: **LCH** (il predefinito - percettivo, gamma ampia, la scelta migliore per modificare), Hex, RGB o HSL. Sostituiscilo quando devi fissare un hex legacy esatto o abbinare un valore sRGB.
- **Use as** - assegna direttamente a questo swatch uno dei ruoli del brand, senza tornare al pannello Roles. (La tessera di un ruolo non lo offre - un ruolo non può assumere un ruolo.)
- **Print substitutes** (richiuso) - blocca il comportamento di stampa del colore:
  - **CMYK** - passa da **Auto** a **Locked** per sovrascrivere la conversione automatica sRGB→CMYK con valori di inchiostro esatti (C/M/Y/K, 0-100).
  - **Spot colour** - passa da **None** a **Set** per bloccare lo swatch su un colore spot; assegna un **Name** (es. `PANTONE 186 C`), un **Book** opzionale e un **Finish** opzionale (Ordinary ink di default) per quando l'inchiostro non è affatto un inchiostro - una lamina, un rilievo o un'incisione, una vernice spot, un soft touch o una fustella, una cordonatura o una perforazione.
- **In other spaces** (richiuso) - la stessa idea ampliata: ogni riga è uno spazio in cui questo swatch può essere espresso, derivato dal valore canonico oppure definito da te, e uno definito da te vince in esportazione.

Questi blocchi di stampa sono ciò che una tipografia usa quando esporti un PDF o TIFF CMYK - vedi [Esportazione](/info/exporting.html#colour-profiles).

**Deleting a swatch** è sicuro: i passaggi di rampa derivati e i ruoli del tema vengono *nascosti* (il token sottostante continua a risolversi, quindi nulla a valle si rompe), mentre i colori che hai aggiunto tu vengono rimossi del tutto.

### Lavorare con molti swatch

Ogni swatch ha una propria maniglia di trascinamento. Trascinala per riordinare i colori all'interno del suo gruppo, oppure mettila a fuoco, premi Spazio, usa i tasti freccia, e premi di nuovo Spazio per rilasciarla. Escape annulla. L'ordine sopravvive alla riapertura dello studio e può essere annullato. Per spostare colori tra gruppi, usa il controllo **Raggruppa** dell'editor degli swatch o seleziona più colori e usa **Sposta**. I nomi dei token e i riferimenti ai ruoli restano intatti.

La selezione nel pannello della palette è un gesto, non una modalità. Non c'è nessun pulsante da premere prima, e la barra arriva con la prima tile selezionata e se ne va con l'ultima.

- **Trascina sullo spazio vuoto del pannello** per disegnare un rettangolo: ogni tile che tocca si unisce alla selezione, oltre i confini dei gruppi. Una sezione richiusa non contribuisce con nulla, e un trascinamento che non si muove mai cancella la selezione.
- **Shift-click** prende l'intervallo in ordine di lettura; **Cmd/Ctrl-click** attiva o disattiva una tile; un click semplice apre comunque l'editor di quella tile.
- Ogni intestazione di gruppo porta **Seleziona tutto**, e **Cmd-A** con una tile a fuoco prende ogni colore che il sistema di design possiede - mai uno starter.
- La griglia ha un'unica tab stop. Le frecce la percorrono, Shift-frecce estendono la selezione, Spazio attiva o disattiva una tile, Canc rimuove la selezione ed Escape la cancella. (Le frecce spostano solo il focus: per regolare un canale, premi prima `l`, `c` o `h`, come indica la lettura.)
- Su uno schermo touch non c'è rettangolo. Tieni premuta una tile per avviare una selezione, poi tocca per aggiungere; **Seleziona tutto** per gruppo si occupa del resto.

La barra stessa dice **{n} selezionati**, poi **Sposta in** (un gruppo esistente, o uno nuovo che nomini dentro il menu), **Assegna un ruolo** (ogni colore selezionato prende il ruolo successivo a turno, così quattro tile riempiono tutti e quattro i ruoli in una sola pressione), **Scarica** (la selezione in uno qualsiasi dei sei formati di palette), **Copia valori** (una riga per colore nella sua notazione salvata) e **Elimina**. Sposta in e Assegna un ruolo compaiono non appena la palette ha sfumature da spostare. Un solo Ctrl/Cmd-Z annulla un'intera azione massiva - uno spostamento di quaranta, un giro di ruoli, un'eliminazione - e un'eliminazione dice cosa ha mantenuto, perché una selezione raggiunge tile che questa stanza non rimuove.

### Gradients

Un pannello opzionale **Gradienti** costruisce token di sfumatura dalla palette per sfondi e accenti. Saltalo del tutto se il sistema di design non usa gradienti. Ogni gradiente ha un'anteprima, stop con nome (2-8) e un angolo. Il comportamento chiave: **uno stop fa riferimento a uno swatch**, quindi ricolorare quello swatch fa seguire il gradiente. L'interpolazione avviene in OKLCH per sfumature pulite. Elimina uno stop per accorciare la sequenza.

### Portare la palette altrove

La pillola flottante ancorata sul bordo inferiore del pannello della palette scarica l'intera palette come **Token di design (JSON)**, **variabili CSS**, **classi CSS**, **variabili SCSS**, una **palette GIMP (.gpl)** o un **Adobe Swatch Exchange (.ase)** - così il sistema di design entra direttamente in Illustrator, Figma, GIMP o in un foglio di stile. Si trova fuori dallo scroller del pannello, quindi mantiene il suo posto indipendentemente da quanto scorre la palette, e appare non appena la palette ha sfumature. (Puoi anche scaricare la palette dalla vista [Risorse](/info/using.html#assets-your-library).)

## Type

Questa stanza cresce allo stesso modo. Senza un proprio carattere è una sola card e una sola decisione: **Primario**, impostato a dimensione di lettura nel carattere che lo serve oggi, un'etichetta **Starter** accanto al nome, uno **Scegli un carattere** pieno e la riga "Niente si installa finché non ne scegli uno." Sotto la card si trova "Titoli, codice e corsivo seguono il primario finché non li scegli", con **Scegli separatamente** che rivela le altre tre card per il resto della visita.

![La stanza Tipografia senza ancora nessun carattere scelto - una card a dimensione di lettura, un'etichetta Starter su di essa, e uno Scegli un carattere pieno](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Scegli un carattere e la stanza si apre in **quattro card di ruolo**, l'elenco Font e il campione dal vivo. I quattro caratteri sono quelli che l'app, gli strumenti e ogni esportazione leggono davvero:

- **Primary** - testo del corpo, pulsanti e ogni strumento.
- **Headings** - il carattere di visualizzazione per `h1`/`h2`.
- **Code** - un carattere monospazio per codice e dati.
- **Italic** - un vero corsivo di accompagnamento per enfasi, citazioni e inserti.

Titoli, codice e corsivo ricadono ciascuno sul primario finché non li assegni, quindi un sistema di design a un solo carattere non ha bisogno di nessuna decisione qui.

**Una tinta significa che l'hai scelta tu.** Una card è tinteggiata solo dove hai installato quel carattere. Un carattere starter porta la stessa etichetta **Starter** che portano i gruppi ereditati della palette, nel registro attenuato e senza tinta, e un ruolo che nessuno ha scelto si legge **↳ segue Primario** invece di ripetere il nome del primario come se fosse stato scelto. Il pulsante dice **Cambia** su un carattere tuo e **Scegli un carattere** ovunque altro. Nulla in una card conferma alcunché: il pulsante apre il **palco di confronto** ristretto a quel ruolo.

![Le quattro card di ruolo rivelate - ciascuna impostata nel carattere che la serve, con un'etichetta Starter dove nessuno ne ha scelto uno e Corsivo che segue il primario](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Il palco di confronto

![Il palco di confronto aperto sotto la sua card, con la riga di ricerca, le famiglie fissate e le card ripiegate in una striscia a una riga](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

Il palco si apre **all'interno della stanza**, non in una finestra di dialogo, e direttamente sotto la card che hai premuto. Mentre è aperto le card si ripiegano in una striscia a una riga di ruolo e carattere, così il palco è sulla prima schermata anche su un telefono. Escape annulla e restituisce la tastiera alla card da cui l'hai aperto.

Scegliere un carattere sono tre pressioni:

1. **Scegli un carattere** sulla card.
2. Digita un nome di famiglia e premi **Anteprima** - oppure premi una delle sei famiglie **Fissate** sotto il campo, una pressione ciascuna. La card appare già in caricamento, con una barra scheletro dove sarà il campione al posto del carattere dell'interfaccia che fa da sostituto per un carattere che non hai ancora visto.
3. **Usa questo carattere**.

**Il consenso viene chiesto una sola volta, alla pressione che hai fatto.** La prima volta che un'anteprima raggiunge Google Fonts, una finestra di dialogo dice cosa succede: *Google conosce il nome della famiglia e il tuo indirizzo IP. Il file viene poi conservato su questo dispositivo e usato offline. Questo è l'unico passaggio dello studio che raggiunge terze parti.* **Scarica da Google** procede e viene ricordato. **Annulla** lascia la card con scritto "Non scaricato. Niente è stato inviato a Google." con il proprio **Scarica da Google** dal vivo, così cambiare idea è una sola pressione sulla card stessa. Nessuna card mostra mai un pulsante morto: qualunque sia il suo stato, il suo unico pulsante primario dice qual è il passo successivo.

**Trascina un file di font sul palco** e viene visualizzato in anteprima all'istante - **TTF**, **OTF** o **WOFF** dal tuo computer, che è il percorso per un carattere aziendale con licenza che possiedi già. Quella zona di rilascio è l'unica porta per i file nella stanza.

In entrambi i casi il carattere resta su questo dispositivo, viene renderizzato nell'app, negli strumenti e in ogni esportazione, offline per sempre, e viaggia nel file del sistema di design - nulla viene recuperato al momento del rendering. Tutto ciò che è su Google Fonts è distribuito con una licenza open (OFL/Apache/UFL).

### Font su questo dispositivo

Il pannello **Font** elenca ogni carattere che questo dispositivo possiede e il ruolo che serve. I caratteri che hai aggiunto guidano sotto **Nel design system**, ciascuno con i suoi ruoli e un'eliminazione, e quello che serve Primario porta il badge. I caratteri starter seguono in un'unica riga richiusa - *Starter · SUSE, SUSE Mono · al servizio di Primario e Codice finché non scegli* - attenuati, senza eliminazione e senza nulla da promuovere, perché nessuna delle due è una decisione che qualcuno ha preso. **Aggiungi un carattere** apre lo stesso palco di confronto senza restrizioni.

Il pannello **Ruoli tipografici** in fondo mostra un campione dal vivo di ogni ruolo - corpo e UI nel primario, un carattere di visualizzazione opzionale per i titoli superiori, un corsivo per l'enfasi, un mono per codice e dati - con la famiglia e il suo stato accanto a ciascuno (*Inter*, *SUSE · starter*, *SUSE · segue Primario*), così l'intero insieme si può leggere in una volta.

## Tokens

Il resto del design system, modificabile senza toccare il codice:

![La stanza Token - uno slider per il raggio degli angoli più spaziatura, dimensioni, ombre e il resto del sistema](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Angoli arrotondati** - un unico slider del raggio (0-1.5rem) che card, pulsanti e pannelli in tutta l'app seguono.
- **Neutri** - la rampa inchiostro-su-carta con cui arriva un'installazione nuova, elencata come **Neutri · starter · 9** con i suoi nove passaggi e un **Apri** verso il pannello Colori. È l'unico posto in cui i neutri starter vengono gestiti, e l'etichetta *starter* sparisce nel momento in cui la rampa viene generata invece che ereditata.
- **Altri token** - aggiungi e modifica **spaziatura**, **dimensioni**, **spessore del tratto**, **opacità**, **rotazione**, semplici **numeri** e **ombre**. Scegli un tipo, dagli un nome (*Gutter, Ombra della card…*) e imposta il suo valore. Sono salvati come [design token](/info/design-tokens.html) standard (DTCG) e viaggiano con il sistema di design.

## Files

Rilascia qui i file che il tuo brand conserva - a parte i loghi -: risorse **vettoriali**, di **immagine**, **audio** e di **movimento** (video, Lottie, animate). Finiscono in [Risorse](/info/using.html#assets-your-library), ordinati in sezioni e pronti nel selettore risorse di ogni strumento. Tutto resta su questo dispositivo. (Il pannello laterale chiama la stanza **File**; la chiave URL resta `catalogue`, perché la chiave di un pannello è un contratto permanente.)

## Importare un brand

**Add from…** in fondo al pannello laterale apre un selettore a due fasi. La prima fase chiede cosa *hai*, non che formato sia:

- **Token di design o un file di design** - JSON DTCG o Tokens Studio, un progetto Penpot, uno **zip di set di token**, un pacchetto sistema di design Lolly o un SVG.
- **PDF** - un deck o un file di linee guida, letto su questo dispositivo per i suoi colori, i suoi segni di stampa e i caratteri incorporati.
- **Logo o screenshot** - un'immagine diventa una palette suggerita, letta su questo dispositivo. Nulla viene caricato. Questo legge i colori, non il carattere o il layout nell'immagine.
- **Pagina web salvata** - scegli un file HTML e i suoi file CSS, oppure incolla HTML o CSS. Fino a 20 file e 2 MB in totale. Viene letto solo il testo fornito; le risorse collegate non vengono recuperate e gli script non vengono eseguiti. Questo percorso funziona anche senza l'estensione o l'app desktop.
- **File font** - TTF, OTF o WOFF. Apre la stanza Tipografia, dove il carattere si installa.
- **Sito web** - una pagina, letta per i suoi colori e caratteri. Questa tile compare solo su un dispositivo in grado di leggere davvero una pagina, perché una tile disabilitata che pubblicizza qualcosa che nessuno può premere è peggio di nessuna tile. Dove compare, indica chiaramente quale lettore viene usato: recuperata dall'app su questo dispositivo, oppure letta tramite l'estensione del browser in una scheda in background, con la tua sessione attiva. Indicare un URL serve solo a *precompilare* il campo - il pulsante di recupero è il consenso, quindi un link che qualcuno ti manda non può mai avviare una lettura.

Scegli la fonte come file di design e la seconda fase è la card qui sotto: i formati accettati compaiono come tessere con icona in ordine di preferenza, e l'intera card è un'unica area di rilascio - clicca in qualsiasi punto o trascina un file su di essa. Puoi anche rilasciare un file direttamente sullo studio.

![La card di importazione - i formati accettati compaiono come tessere con icona, e l'intera card è un'unica area di rilascio](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

Cosa ti offre ciascun file di design:

- un **pacchetto sistema di design Lolly** (`.lolly`; il vecchio `.zip` è ancora accettato) - si installa in un solo passaggio;
- un'esportazione **Penpot** (`.penpot`) - importa i suoi design token;
- un file **Design Tokens** (`.json`) - W3C DTCG;
- un file **Tokens Studio** (`.json`) - Tokens Studio;
- un **SVG semplice** (`.svg`) - Lolly analizza i suoi colori e ti permette di scegliere quali mantenere, il primo diventa il tuo colore primario.

Un logo/screenshot, sito web o pagina salvata apre **Il tuo sistema di design suggerito**. Guarda un esempio con i colori proposti, scegli un **Colore principale** diverso se serve, e assegna un nome al sistema. **Usa questo sistema di design** applica le palette chiare e scure generate e torna a Panoramica. I font esistenti restano al loro posto. Questo sostituisce i colori del sistema attivo e le altre impostazioni dei token. Un checkpoint deve riuscire prima; **Ripristina impostazioni del brand** recupera le impostazioni precedenti.

**Dettagli della fonte e scelte individuali** mostra cosa è stato letto, i nomi dei font rilevati e il contrasto testo/azione dell'anteprima. Offre anche **Scegli elementi individuali nella lista** e **Scarica contesto del design**. Il report JSON porta osservazioni, token proposti e informazioni sulla fonte; l'HTML/CSS salvato include uno SHA-256 del testo fornito. Non contiene testo grezzo della pagina e non è una Content Credential firmata. I nomi dei font sono suggerimenti: Tipografia resta il posto dove scegliere e installare i font.

Le importazioni di PDF e altri file di design mantengono i loro controlli di revisione esistenti. Gli elementi conservati nel **Vassoio** non cambiano nulla finché non vengono aggiunti attraverso la stanza a cui appartiene quel tipo di materiale.

`#/start?source=<kind>` apre il selettore su una data sorgente (`file`, `pdf`, `image`, `font`, `url`, `page`), e `?import` lo apre sull'elenco semplice.

## Spostare un brand tra dispositivi

**Esporta** al piede del pannello laterale scrive un unico **`LollyBrand-….lolly`** - i tuoi token, font, loghi e preferenza del tema, con un manifest di integrità che viene verificato al reimport. Le versioni web precedenti alla 1.0.7 chiamavano lo stesso payload `.zip`; quella grafia legacy è ancora accettata. Accanto, **Token (.json)** scrive da solo il documento dei design token: nessun font, nessun logo, solo i token, che è ciò che un repo, uno step CI o un altro strumento di token legge davvero.

Riportarne uno indietro è **Add from… → Design tokens or a design file** (sopra), oppure un trascina-e-rilascia sullo studio. È così che un collega ti passa un brand, o come ne porti uno su una seconda installazione - niente account, niente cloud. Per importare un brand da riga di comando, vedi [`ingest:brand`](/info/configuration.html#brand-packs).

## Ripristina impostazioni precedenti

Scegli **Ripristina impostazioni del brand** al piede del pannello laterale, seleziona un checkpoint datato, poi premi **Ripristina**. Questo ripristina i colori, le impostazioni tipografiche e altri token di brand per il brand attivo. I file di font e immagini restano come sono.

Lolly salva le tue impostazioni attuali come **Before restore** prima di applicare il checkpoint. Scegli quel checkpoint per invertire il ripristino, anche dopo aver chiuso e riaperto il browser. Gli ultimi 20 checkpoint vengono conservati su questo dispositivo. Se lo storage non può essere letto o le impostazioni attuali non possono essere salvate, la finestra di dialogo segnala il problema così puoi riprovare.

## Versioni

**Versioni**, in fondo alla barra, è dove un design system smette di essere un bersaglio mobile. Pubblicane una e ottieni una **copia permanente e con nome** conservata su questo dispositivo: non cambia mai più dopo, quindi uno strumento che la fissa continua a disegnare la stessa cosa. Il pannello resta nascosto finché non c'è qualcosa di tuo da pubblicare, quindi uno studio che non pubblica mai non vede mai i controlli.

Tre cose da sapere prima di premere qualsiasi cosa, e il pannello le dice tutte e tre prima della pressione, non dopo:

- **Una versione è permanente.** Non c'è ancora l'eliminazione, quindi il pannello dichiara cosa è stato conservato e che resta conservato, invece di offrire un pulsante che mentirebbe.
- **Le rimozioni guidano la scheda di compatibilità.** I token aggiunti e modificati sono novità; uno *rimosso* è ciò che rompe uno strumento, quindi viene nominato per primo e chiamato per quello che è.
- **La pubblicazione non si può annullare; il ripristino sì.** *Ripristina l'ultima versione da questa versione* è una modifica ordinaria alla testa, quindi finisce sulla pila di annullamento dello studio e il pannello ti offre subito il pulsante **Annulla**.

Puoi **Pubblicare soltanto**, oppure **Pubblicare e rendere attiva** - la differenza è se da quel momento gli strumenti e l'app seguono quella versione oppure continuano a seguire la tua ultima modifica. **Segui di nuovo l'ultima** rende ogni modifica live nel momento in cui viene fatta. `#/start?area=versions` apre il pannello direttamente.

## Quando il brand è fisso

Alcune build spediscono con un **sistema di design bloccato**, come il Brand SUSE. Aprirlo mostra una nota di sola lettura con **Make an editable copy** e **Switch**. I suoi colori, font e token originali restano intatti. I tuoi sistemi locali restano modificabili, anche quando il sistema bloccato era il primo sul dispositivo. In Profilo, **Apri** seleziona un sistema e apre il suo studio; **Make a new one** crea un sistema locale e lo apre su `#/start` con il campo del nome a fuoco.

## Dove andare adesso

- **[Usare Lolly](/info/using.html)** - il canvas, il salvataggio, i progetti e Risorse.
- **[Design Tokens](/info/design-tokens.html)** - il modello di token in cui è espresso il tuo brand.
- **[Esportazione e formati](/info/exporting.html)** - unità di stampa, CMYK e i formati in cui il tuo brand viene renderizzato.


## Trova e confronta un look

Apri **Trova un look** da Panoramica o dall'elenco dei sistemi di design su Profilo. Sfoglia i sistemi salvati su questo dispositivo e alcuni esempi riutilizzabili di Lolly. Cerca per nome, tag colore o font dichiarato. **Più vicina alla mia palette attuale** ordina per somiglianza di colore misurata, con le famiglie di font corrispondenti a rompere la parità; non è un punteggio di qualità.

Seleziona un look per rivederlo, o due per confrontarli. Il pulsante di revisione resta disponibile su uno schermo piccolo. Selezionare un look non cambia nulla. **Usa questo sistema salvato** passa attraverso il registro esistente dei sistemi di design. **Usa questi colori** applica un esempio attraverso il normale flusso di checkpoint e installazione, mantenendo i font attuali. **Ripristina impostazioni del brand** può recuperare il look precedente.

Sotto **Dettagli e contesto del design**, i sistemi salvati hanno **Cerca tag** modificabili e un download del contesto. Gli esempi usano ricette di colore originali di Lolly; non c'è nessuna raccolta di ispirazione raccolta da remoto né è richiesto un account.

![Confronta Sunroom e Orchard fianco a fianco prima di applicare uno dei due sistemi di colore.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

Il confronto mantiene entrambe le palette visibili insieme. Rivedere un look non cambia nulla finché non scegli **Usa questi colori** o **Usa questo sistema salvato**.

## Leggi le prove sulla fonte

I dettagli opzionali della revisione della fonte mostrano tipografia, spazi, padding e valori d'angolo dove osservati. L'HTML/CSS salvato e le letture native dei siti web riportano dichiarazioni, che la pagina renderizzata potrebbe non usare. L'estensione del browser può riportare stili misurati da un campione limitato di elementi visibili, con il suo viewport e la sua preferenza di colore del browser. Le estensioni più vecchie funzionano ancora con stili dichiarati. I campi mancanti dicono **Non osservato**.

Queste sono osservazioni, non impostazioni di stile automatiche. Una scansione di riferimento non recupera né installa file di font, e la spaziatura della fonte non sostituisce la tua in silenzio. I conteggi descrivono le occorrenze nel campione, non affidabilità o qualità.

## Verifica una composizione rispetto al sistema di design

In Design, apri **Esporta**, poi **Prima di esportare**. Il controllo usa la stessa versione effettiva del sistema di design del render. Confronta i colori creati, gli alias dei token, le scelte dei font e gli ID delle risorse immagine. I valori personalizzati possono essere intenzionali; un'immagine al di fuori delle risorse di brand dichiarate è un elemento da rivedere, non un'immagine vietata.

Dove è disponibile un suggerimento concreto di colore o font, il suo pulsante cambia quel singolo livello. Il normale **Annulla** ripristina il valore originale. I livelli bloccati o modificati non vengono sovrascritti da un vecchio suggerimento. Le prove sulla fonte mancanti restano separate da una corrispondenza. Il contrasto renderizzato e il layout del testo vengono verificati dai controlli già integrati. Gradienti, effetti, contenuto di strumenti annidati, diritti e qualità soggettiva non vengono valutati dal confronto di brand. I controlli non bloccano Scarica.

## Usa il contesto del design in locale

**Scarica contesto del design** include il documento dei token, i colori risolti, le famiglie di font dichiarate, gli ID delle risorse, le prove sulla fonte dove registrate, la copertura e le regole esplicite. Non include file di font né prova di proprietà. La revisione di riferimento include anche i suoi token proposti e le sue osservazioni.

La CLI può leggere entrambi i download senza un server:

```bash
lolly system import ./lolly-design-context.json
lolly system context --output=design-context.json
lolly system check ./design-inputs.json --file=design-context.json
```

`system check` accetta input di Design con un array `boxes` o un documento Design compilato. Segnala le correzioni proposte senza modificare la composizione. Non può misurare il layout del browser o il contrasto renderizzato. La risorsa MCP esistente **lolly://design-context** espone il contesto del sistema effettivo attraverso il processo MCP locale configurato; non serve nessun nuovo servizio ospitato né chiave API.
