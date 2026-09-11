# Il Brand Studio

Il **Brand Studio** in `#/start` è l'unico posto dove modelli il tuo brand - i suoi loghi, colori, tipografia, il resto dei tuoi token e i file che conserva. Impostalo qui una volta e ogni strumento, pagina ed esportazione lo segue *per costruzione*, non per revisione.

Le modifiche vengono mostrate in anteprima **dal vivo in tutta l'app** man mano che le apporti, così puoi vedere un colore o un font atterrare ovunque prima di confermarlo. È tutto sul dispositivo: i tuoi file e token di brand non lasciano mai il tuo computer (scegliere un Google Font recupera quella singola famiglia da Google, una volta, dopo una finestra di consenso), e il brand viaggia in un unico file [brand pack](#move-a-brand-between-devices).

> **Questo è l'editor. La dashboard è lo specchio.** La scheda **Sistema di design** nella Dashboard (`#/d`) *mostra* il tuo brand in sola lettura; tu lo *modifichi* qui, in `#/start`. Se vuoi cambiare un colore più avanti, torna al Brand Studio.

## Le stanze

Lo studio è un insieme di **stanze** elencate in una barra laterale - non passaggi. Nulla è numerato, nulla è vincolato ad altro e arrivare in una qualsiasi di esse è legittimo:

- **Panoramica** - lo snodo. Cosa esiste in questo momento, a colpo d'occhio, con una porta verso ogni stanza.
- **Colori** - aggiungi colori uno alla volta, assegna ruoli o genera un'intera palette a partire da uno solo.
- **Tipografia** - i quattro caratteri che l'app, i tuoi strumenti e ogni esportazione leggono.
- **Loghi** - i tuoi marchi, in ogni orientamento e trattamento.
- **Token** - raggio degli angoli, spaziatura, ombre e il resto del sistema.
- **File** - i file immagine, audio e movimento che il tuo brand conserva.

Su telefono lo stesso elenco diventa una striscia orizzontale di chip fissata sotto l'intestazione. Cambiare stanza non ricarica mai nulla - l'editor mantiene tutti i suoi pannelli montati e mostra semplicemente quello richiesto.

**Collega direttamente una stanza** con `#/start?area=<key>`. Le chiavi sono `overview`, `color` *(nota l'ortografia americana nell'URL)*, `type`, `logos`, `tokens`, `catalogue` (la stanza File - la chiave del pannello è un contratto permanente, quindi l'URL mantiene il vecchio nome) e `versions`. `?tab=` è l'alias di lunga data per la stessa cosa e continua a funzionare, così i vecchi link e segnalibri restano validi; qualsiasi cosa non riconosciuta apre Panoramica invece di finire in un vicolo cieco.

Fissate al **piede della barra laterale** ci sono le azioni che appartengono all'intero sistema di design piuttosto che a una singola stanza:

- **Aggiungi da…** - il selettore di sorgente, per portare un brand da un file, un PDF, un'immagine, un font o un sito web. Vedi [Portare un brand](#bring-a-brand-in) più sotto.
- **Vassoio** - i candidati che una scansione ha trovato ma non ha ancora confermato. Resta nascosto finché una scansione non conserva effettivamente qualcosa, e mostra un conteggio quando lo fa; nulla al suo interno cambia il tuo brand finché non premi Aggiungi su quella riga.
- **Esporta** - scrive l'intero brand come un unico `LollyBrand-…zip`.
- **Token (.json)** - il documento dei design token puro e semplice, per un repository, un passaggio di build o un altro strumento per token.
- **Versioni** - pubblica, attiva e ripristina copie con nome del sistema di design. Nascosto finché non c'è qualcosa di tuo da pubblicare (o un link `?area=versions` lo richiede per nome).

![La barra laterale delle stanze dello studio - Panoramica, Colori, Tipografia, Loghi, Token e File](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Panoramica

Panoramica è la stanza in cui arrivi, e ha due facce.

Con **nulla ancora impostato** offre due porte - **Parti da un file** (design token, un progetto Penpot, un pacchetto di sistema di design o un SVG) e **Parti da zero** (aggiungi un colore, poi continua quando vuoi) - e una discreta uscita **Esplora gli strumenti** sotto di esse, perché anche andarsene è una risposta legittima.

Una volta che un sistema di design esiste, la stessa stanza mostra **cosa hai**: la palette e il suo numero di colori, le famiglie tipografiche in vigore, quanti slot per loghi sono riempiti, quanti token ci sono e la stanza File. Ogni blocco è una porta verso la sua stanza. Qui ci sono conteggi, mai una barra di avanzamento e mai una scheda di completamento - niente in questo studio è dovuto.

## Loghi

Inizia svuotando la tua cartella di marchi nella zona di rilascio in alto: **"Rilascia i marchi qui, o scegline diversi in una volta"** accetta tutti i file che hai in un solo passaggio. Ogni file viene letto per la sua forma e il suo inchiostro, poi messo in coda sotto **In attesa di uno slot** come un chip che dice cosa pensa - *"Sembra l'Orizzontale primario"*, con la misurazione su cui si è basato, e un pulsante **Posiziona** (**Sostituisci**, dove quello slot è già occupato). Dove non è sicuro, il chip lo dice chiaramente e offre invece **Cambia slot**, che li elenca tutti e otto. Nulla viene posizionato finché non premi qualcosa.

Intorno a quella coda accadono due cose. Un marchio con margine vuoto in eccesso riceve prima un'**offerta di ritaglio** - rispondi o premi Escape e il file originale entra intatto. E dove un marchio può fornire uno slot fratello vuoto, la stanza offre la versione derivata **monocromatica** o **inversa** come proprio chip, contrassegnato *Generato*, che scompare di nuovo se riempi quello slot in un altro modo.

Sotto si trova la griglia in cui finisce ogni marchio - slot **orientamento × trattamento**:

- **Orientamenti:** Orizzontale (logotipo + simbolo in riga) e Verticale (impilato, per spazi quadrati e alti).
- **Trattamenti:** Primario, Primario inverso (per sfondi scuri), Monocromatico (un colore) e Monocromatico inverso.

Sono otto slot opzionali. Clicca su uno slot per aggiungere un PNG, SVG, JPEG o WebP; clicca su uno slot pieno per sostituirlo. Ogni slot è opzionale e tutto resta su questo dispositivo.

![La matrice dei loghi - ogni orientamento in alto, ogni trattamento come proprio slot tratteggiato, tutti opzionali](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Marchi personalizzati** - aggiungi marchi che il tuo brand chiama a modo suo (un'icona, uno stemma, una favicon) sotto **Marchi personalizzati**; assegnagli un nome e scegli un file.
- **Più identità** - un sub-brand, un prodotto o un evento può avere il proprio set completo di loghi. Usa **+ Aggiungi un altro logo** e assegnagli un nome; il tuo set principale è semplicemente "Il tuo logo".
- **Carica un SVG e Lolly ne legge i colori.** Su un'installazione nuova imposta silenziosamente il tuo colore primario dal logo e lo segnala. Su un brand esistente offre invece il colore come suggerimento - *"Trovato nel logo: #…"* con un pulsante **Usa come primario** accanto - nella stanza Colori, dove puoi accettarlo o ignorarlo.

## Colori

![The Colours room after one colour - the two panes back, the generate offer, roles reading in three registers and the pane at one colour](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

La stanza più ricca, in due riquadri. Il sinistro è dove lavori; il destro è la tua **palette dal vivo**. Trascina il divisore tra i due per ridimensionare (Invio su di esso richiude la palette fuori dai piedi).

![La stanza Colori - un colore primario deriva rampe, schede campione con rapporti di contrasto e una palette dal vivo](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Aggiungi un colore, poi assegnagli un compito

**Aggiungi un colore** è tutto il percorso semplice: incolla o scegli un colore in qualsiasi notazione e diventa esattamente un token. Nulla viene derivato da esso, nulla viene suggerito al suo interno, nient'altro viene richiesto. Incolla un'intera *lista* di colori e ognuno diventa un chip che puoi aggiungere per conto suo.

**Ruoli** è il livello sopra - quale colore svolge quale parte. I ruoli sono opzionali (un sistema di design con tre colori sciolti e nessun ruolo è perfettamente valido), qualsiasi campione può assumerne uno e la lettura del contrasto è misurata rispetto alla superficie, prima con APCA.

### Le ali per esperti

Quattro sezioni ripiegate si trovano sotto queste due. Apri quella che vuoi; ognuna è collegabile direttamente come `#/start?area=color&focus=<wing>`:

- **Genera una palette di partenza** (`focus=generate`) - un colore in un set completo di sfumature. Descritto sotto.
- **Curve di sfumatura** (`focus=curves`) - rimodella una rampa punto per punto. Luminosità, cromaticità e tonalità hanno ciascuna la propria curva, selezionabile con L / C / H, e le sfumature sotto si ricalcolano dal vivo mentre trascini.
- **Contrasto** (`focus=contrast`) - **Blocco contrasto** ritona una rampa per raggiungere obiettivi APCA rispetto a uno sfondo che scegli, ogni passo mantenendo la propria tonalità e cromaticità; **Ruota tonalità** gira l'intera rampa in blocco attorno alla ruota, ogni sfumatura mantenendo la propria luminosità e cromaticità.
- **Stampa** (`focus=print`) - cosa diventa il primario in stampa: il suo valore schermo automatico, oppure una build CMYK fissata o un inchiostro spot con nome.

### Un colore, un'intera palette

Dentro **Genera una palette di partenza**, scegli un **Colore primario** e Lolly calcola una palette completa - superfici chiare e scure, testo, accenti e rampe complete di tinte/sfumature - usando la stessa matematica del colore percettivo (OKLCH) che il motore usa ovunque. Regola la derivazione:

- **Schema** - Mono, Complementare, Analogo o Triade - imposta come il colore secondario si relaziona al tuo primario.
- **Sfumature** - un cursore da 3 a 20 (predefinito 5) controlla quanti passaggi genera ogni rampa.
- **Ottimizzazione** (ripiegata) - **Intensità UI** (Attenuata / Profonda), **Contrasto** (Comfort / Alto) e **Testo sul brand** (Auto / Chiaro / Scuro).

Niente in questa ala scrive nulla sul tuo brand. È un'anteprima, dal vivo in tutta l'app così puoi valutarla, fino a quando non premi **Sostituisci palette** (sotto).

Sotto il primario vedrai le rampe dal vivo **Primario / Neutro / Secondario / Miscela** e le schede campione Chiara e Scura, ognuna con la propria lettura di contrasto - il rapporto WCAG con la cifra APCA `Lc` accanto. **Clicca un passaggio nella rampa Neutro o Secondario** per ancorare quella sfumatura invece del valore derivato predefinito.

![I quattro ramp impilati sopra le card campione chiare e scure, ognuna con il proprio rapporto di contrasto WCAG](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Build your palette (generatore di armonie)

Sempre in questa sezione, **Build your palette** genera colori di accento abbinati al tuo primario. Scegli un'**Armonia** - **Complementare**, **Adiacente**, **Triade**, **Tetrade** o **Analoga** (che porta con sé un proprio numero di **Accenti**, da 2 a 5, e un **Angolo** di tonalità da 10° a 45°) - e ogni candidato arriva con un nome leggibile generato automaticamente e un pulsante **+ Add**. Aggiungerne uno inserisce subito quel colore nella tua palette, una pressione per un token. *"La tua palette, applicata"* mostra in anteprima l'intero set su grafiche reali.

![Accenti generati, ciascuno con uno swatch, un nome generato automaticamente, il suo hex e un pulsante Add](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Confermare una palette generata

**Replace palette** è l'unico controllo di questa sezione che scrive qualcosa, e non lo fa mai subito. Premilo e si apre prima una card di revisione, intitolata **"Sostituire la palette?"**, che elenca esattamente cosa sta per succedere: quanti ruoli restano come li hai assegnati, quanti colori aggiunti da te vengono mantenuti, quante curve di sfumatura vengono riancorate, quanti blocchi di stampa vengono ripinnati, quante sfumature nascoste restano nascoste, quanti stop del gradiente mantengono il loro colore.

**Replace palette** su quella card la conferma; **Cancel** annulla senza cambiare nulla. Una volta eseguita, la card diventa **"Palette sostituita."** con un singolo **Undo** già selezionato - e prima dello scambio viene creato un checkpoint dell'intero design system, così "rimettere tutto com'era" è un ripristino e non un pomeriggio perso.

### La palette, il grafico e ogni swatch

Il pannello a destra elenca ogni colore che il tuo brand possiede, raggruppato (Primario, Neutro, Secondario, Spettro, Personalizzato, Ruoli), ogni gruppo richiudibile con il proprio **+ Add**. Sotto, **Colour chart** si apre su due viste degli stessi swatch: la **Wheel** (la ruota OKLCH - trascina un punto per ricolorarlo, clicca un punto per modificarlo o clicca uno spazio vuoto per aggiungere un nuovo swatch) e il grafico **Gamut**, che mostra dove termina davvero l'intervallo visualizzabile. `#/start?area=color&focus=chart` apre direttamente la card, come fa sempre `?wheel`.

![Il pannello della palette, ogni gruppo richiudibile, con la pillola di download posizionata sul bordo inferiore](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![La ruota OKLCH - l'angolo è la tonalità, la distanza dal centro è la crominanza e i grigi scorrono lungo un binario di luminosità sul lato](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

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

### Gradients

Un pannello opzionale **Gradients** costruisce token di sfumatura dalla tua palette per sfondi e accenti. Saltalo del tutto se il tuo brand non usa sfumature. Ogni gradiente ha un'anteprima, stop nominati (2-8) e un angolo. Il comportamento chiave: **uno stop fa riferimento a uno swatch**, quindi ricolorare quello swatch fa seguire il gradiente. L'interpolazione avviene in OKLCH per sfumature pulite. Elimina uno stop per accorciare la sequenza.

### Portare la palette altrove

La pillola flottante posizionata sul bordo inferiore del pannello della palette scarica l'intera palette come **Design tokens (JSON)**, **CSS variables**, **CSS classes**, **SCSS variables**, una **GIMP palette (.gpl)** o un **Adobe Swatch Exchange (.ase)** - così il brand entra direttamente in Illustrator, Figma, GIMP o in un foglio di stile. Si trova fuori dallo scroller del pannello, quindi mantiene il suo posto indipendentemente da quanto scorri la palette. (Puoi anche scaricare la palette dalla vista [Catalogue](/info/using.html).)

## Type

![The compare stage open under its card, with the search row, the pinned families and the cards folded to a one-line strip](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

La sezione si apre con **quattro card di ruolo** - i quattro caratteri che l'app, i tuoi strumenti e ogni esportazione leggono davvero. Ogni card mostra cosa serve quel ruolo in questo momento, impostato in quel carattere, con una riga di testo reale sotto:

- **Primary** - testo del corpo, pulsanti e ogni strumento.
- **Headings** - il carattere di visualizzazione per `h1`/`h2`.
- **Code** - un carattere monospazio per codice e dati.
- **Italic** - un vero corsivo di accompagnamento per enfasi, citazioni e inserti.

Headings, code e italic ricadono ciascuno sul primario finché non li assegni, quindi un brand a un solo font non richiede nessuna decisione qui. Nulla in una card conferma alcunché: **Change** (o **Choose a face** su un ruolo vuoto) apre il **palco di confronto** ristretto a quel ruolo.

![La sezione Type - le card di ruolo e un campione dal vivo di ogni carattere al lavoro](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

### Il palco di confronto

Il palco si apre **all'interno della sezione**, non in una finestra di dialogo, quindi le card da cui sei partito restano a schermo. Cerca una famiglia di Google Fonts (Inter, Fraunces, Space Grotesk...) o trascina un file di font, premi **Add to the comparison** e i candidati si affiancano nelle stesse parole prima che uno qualsiasi venga installato. Escape annulla e restituisce la tastiera alla card da cui l'hai aperto.

Questa è l'unica porta d'ingresso, motivo per cui niente entra nel tuo marchio senza essere visto. Sotto il palco si trovano i due pannelli di gestione:

- **Fonts on this device** - ogni famiglia installata, i ruoli che serve e un'eliminazione. **Add a face** qui apre lo stesso palco di confronto senza restrizioni.
- **Your fonts** - carica un **TTF**, **OTF** o **WOFF** dal tuo computer. È il percorso per un carattere aziendale con licenza che possiedi già.

In entrambi i casi il carattere resta su questo dispositivo, viene renderizzato nell'app, nei tuoi strumenti e in ogni esportazione, offline per sempre, e viaggia nel tuo pacchetto brand - nulla viene recuperato al momento del rendering. Tutto ciò che è su Google Fonts è distribuito con una licenza open (OFL/Apache/UFL).

Il pannello **Type roles** in fondo mostra un campione dal vivo di ogni ruolo - corpo e interfaccia nel primario, un carattere di visualizzazione opzionale per i titoli principali, un corsivo per l'enfasi, un mono per codice e dati - così puoi vedere l'intero set funzionare insieme.

![Il campione di Type roles - titolo, corpo, corsivo e codice, ciascuno impostato nel carattere a cui quel ruolo si risolve, con il nome del carattere accanto](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

## Tokens

Il resto del design system, modificabile senza toccare il codice:

![La sezione Tokens - uno slider per il raggio degli angoli più spaziatura, dimensionamento, ombre e il resto del sistema](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Rounded corners** - un unico slider del raggio (0-1.5rem) che le card, i pulsanti e i pannelli in tutta l'app seguono.
- **More tokens** - aggiungi e modifica **spaziatura**, **dimensionamento**, **spessore del tratto**, **opacità**, **rotazione**, semplici **numeri** e **ombre**. Scegli un tipo, dagli un nome (*Gutter, Card shadow...*) e imposta il suo valore. Sono salvati come [design token](/info/design-tokens.html) standard (DTCG) e viaggiano con il tuo brand.

## Files

Rilascia qui i file che il tuo brand conserva - a parte i loghi -: risorse **vettoriali**, **immagine**, **audio** e **motion** (video, Lottie, animate). Finiscono nel tuo [Catalogue](/info/using.html), ordinati in sezioni e pronti nel selettore risorse di ogni strumento. Tutto resta su questo dispositivo. (Il pannello laterale chiama la sezione **Files**; la chiave URL resta `catalogue`, perché la chiave di un pannello è un contratto permanente.)

## Importare un brand

**Add from…** in fondo al pannello laterale apre un selettore a due fasi. La prima fase chiede cosa *hai*, non che formato sia:

- **Design tokens or a design file** - JSON DTCG o Tokens Studio, un progetto Penpot, uno **zip di token set**, un pacchetto design system Lolly o un SVG.
- **PDF** - un deck o un file di linee guida, letto su questo dispositivo per i suoi colori, i suoi segni di stampa e i caratteri incorporati.
- **Image** - uno screenshot o una foto; i suoi colori vengono letti su questo dispositivo e nulla viene caricato.
- **Font file** - TTF, OTF o WOFF. Apre la sezione Type, dove il carattere si installa.
- **Website** - una pagina, letta per i suoi colori e caratteri. Questa tessera compare solo su un dispositivo in grado di leggere davvero una pagina, perché una tessera disabilitata che pubblicizza qualcosa che nessuno può premere è peggio di nessuna tessera. Dove compare, indica chiaramente il suo lettore: recuperata dall'app su questo dispositivo, oppure letta tramite l'estensione del browser in una scheda in background, con la tua sessione attiva. Indicare un URL serve solo a *precompilare* il campo - il pulsante di recupero è il consenso, quindi un link che qualcuno ti manda non può mai avviare una lettura.

Scegli la fonte come file di design e la seconda fase è la card qui sotto: i formati accettati compaiono come tessere con icona in ordine di preferenza, e l'intera card è un'unica area di rilascio - clicca in qualsiasi punto o trascina un file su di essa. Puoi anche rilasciare un file direttamente sullo studio.

![La card di importazione - i formati accettati compaiono come tessere con icona, e l'intera card è un'unica area di rilascio](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

Cosa ti offre ciascun file di design:

- un pacchetto **LollyBrand** (`.zip`) - si installa in un solo passaggio;
- un'esportazione **Penpot** (`.penpot`) - importa i suoi design token;
- un file **Design Tokens** (`.json`) - W3C DTCG;
- un file **Tokens Studio** (`.json`) - Tokens Studio;
- un **SVG semplice** (`.svg`) - Lolly analizza i suoi colori e ti permette di scegliere quali mantenere, il primo diventa il tuo colore primario.

Un'installazione da sorgente crea prima un **checkpoint**, quindi "torna a prima dell'importazione" è un solo ripristino. E ciò che una scansione trova non entra direttamente: i candidati finiscono nel **Tray**, dove ognuno viene aggiunto con una pressione propria, attraverso la sezione a cui appartiene quel tipo di materiale.

`#/start?source=<kind>` apre il selettore su una data sorgente (`file`, `pdf`, `image`, `font`, `url`), e `?import` lo apre sull'elenco semplice.

## Spostare un brand tra dispositivi

**Export** in fondo al pannello laterale scrive un unico **`LollyBrand-…zip`** - i tuoi token, i caratteri, i loghi e la preferenza del tema, con un manifest di integrità che viene verificato al reimport. Accanto, **Tokens (.json)** scrive da solo il documento dei design token puro: nessun carattere, nessun logo, solo i token, che è ciò che un repo, uno step CI o un altro strumento di token legge davvero.

Riportarne uno indietro è **Add from… → Design tokens or a design file** (sopra), oppure un trascina-e-rilascia sullo studio. È così che un collega ti passa un brand, o come ne porti uno su una seconda installazione - niente account, niente cloud. Per importare un brand da riga di comando, vedi [`ingest:brand`](/info/configuration.html#brand-packs).

## Versioni

**Versioni**, in fondo alla barra, è dove un design system smette di essere un bersaglio mobile. Pubblicane una e ottieni una **copia permanente e con nome** conservata su questo dispositivo: non cambia mai più dopo, quindi uno strumento che la fissa continua a disegnare la stessa cosa. Il pannello resta nascosto finché non c'è qualcosa di tuo da pubblicare, quindi uno studio che non pubblica mai non vede mai i controlli.

Tre cose da sapere prima di premere qualsiasi cosa, e il pannello le dice tutte e tre prima della pressione, non dopo:

- **Una versione è permanente.** Non c'è ancora l'eliminazione, quindi il pannello dichiara cosa è stato conservato e che resta conservato, invece di offrire un pulsante che mentirebbe.
- **Le rimozioni guidano la scheda di compatibilità.** I token aggiunti e modificati sono novità; uno *rimosso* è ciò che rompe uno strumento, quindi viene nominato per primo e chiamato per quello che è.
- **La pubblicazione non si può annullare; il ripristino sì.** *Ripristina l'ultima versione da questa versione* è una modifica ordinaria alla testa, quindi finisce sulla pila di annullamento dello studio e il pannello ti offre subito il pulsante **Annulla**.

Puoi **Pubblicare soltanto**, oppure **Pubblicare e rendere attiva** - la differenza è se da quel momento gli strumenti e l'app seguono quella versione oppure continuano a seguire la tua ultima modifica. **Segui di nuovo l'ultima** rende ogni modifica live nel momento in cui viene fatta. `#/start?area=versions` apre il pannello direttamente.

## Quando il brand è fisso

Alcune build spediscono con un **brand bloccato** - i suoi colori, i font e i token sono quelli che ogni strumento ed export usano, e non c'è nulla da cambiare. In quel caso lo studio viene sostituito da una breve nota che spiega che questa build spedisce con un brand fisso e la modifica è disattivata. È deliberato: è così che un'organizzazione garantisce che tutto resti on-brand.

## Dove andare adesso

- **[Usare Lolly](/info/using.html)** - la canvas, il salvataggio, i progetti e il catalogo.
- **[Design Tokens](/info/design-tokens.html)** - il modello di token in cui è espresso il tuo brand.
- **[Esportazione e formati](/info/exporting.html)** - unità di stampa, CMYK e i formati in cui il tuo brand viene renderizzato.
