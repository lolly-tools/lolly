# Impostazioni

Settings è il posto in cui cambi come Lolly funziona per te: i tuoi dati, il design system che usi, l'accessibilità, ciò che è archiviato su questo dispositivo e ciò che è pronto offline. Aprilo con **Settings** nella barra in fondo alla schermata iniziale, o dal menu del tuo avatar. Si apre su **Preferences**, con altre quattro schede accanto.

| Scheda | Indirizzo | Cosa contiene |
|---|---|---|
| **Preferences** | `#/settings` | I tuoi dati, i design system, l'aspetto, le emoji, l'accessibilità, le connessioni, l'archiviazione e i download offline |
| **This device** | `#/settings?tab=device` | Una lettura live di questo browser e di questa macchina, più il suono e una vista di sola lettura dell'archiviazione |
| **Design system** | `#/settings?tab=brand` | Il design system attivo come copertina e pagine, con una striscia di copertine per cambiare sistema |
| **Capabilities** | `#/settings?tab=caps` | Tutto ciò che Lolly sa fare, come schede ricercabili |
| **Activity & stats** | `#/settings?tab=activity` | Il catalogo, i tuoi contatori locali e il lavoro recente |

Ogni scheda ha un proprio indirizzo, e i vecchi link `#/profile` e `#/d` aprono ancora il posto giusto, fino alle singole impostazioni.

## Preferences

Preferences è una lunga pagina con una **settings rail** sul lato e un campo **Search settings** sopra la barra che la filtra mentre scrivi. Ogni sezione si apre direttamente da un link nella forma `#/settings?focus=<section-id>`, per esempio `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - il tuo nome, i dati di contatto e la foto, e l'interruttore **Use my details to create**. [Profiles](/info/profile.html) spiega come li usano gli strumenti.
- <!--i:seal--> **Content Credentials** - l'identità verificata facoltativa che firma le tue esportazioni. Vedi [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - cambia, aggiungi, nascondi o rimuovi design system. [Design System Setup](/info/brand-studio.html#manage-your-design-systems) tratta ogni azione.
- <!--i:moon--> **Appearance** - il tema (Light, Dark o Brand, che colora l'app con la tua palette) e **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - il set da cui vengono disegnate le tue emoji quando inizi qualcosa di nuovo, con la sua licenza dell'artwork, e quanto fortemente la tua palette le ricolora (**Off**, **Subtle**, **Strong**, **Full**, **Mono** o **Duotone**). **Keep skin tones and flags** le lascia nei loro colori. Il lavoro che hai già fatto mantiene il set con cui è stato creato.
- <!--i:eyeoff--> **Accessibility** - quattro interruttori di comfort, più Sound e Neurospicy Mode. Vedi [Accessibilità](#accessibility).
- <!--i:link--> **Connected services** - l'archiviazione che colleghi, come Dropbox, Google Drive, OneDrive, Nextcloud o S3, e **Sync across devices**. Vedi [Sync your devices](/info/sync.html).
- <!--i:globe--> **Trusted sites** - i siti che un box pagina web di Design o una demo Sandbox può contattare senza chiedere e, dove il server lo offre, **Allow pages from any site**. L'[Informativa sulla privacy](/info/privacy.html) elenca cosa invia ogni richiesta.
- <!--i:download--> **Your renders** - **Save my renders to my library** conserva in Assets, con il tag Renders, una copia di ogni immagine, clip audio e video che scarichi.
- <!--i:database--> **Storage** - ciò che Lolly conserva su questo dispositivo e i pulsanti che cancellano o portano via i tuoi dati. Vedi [Archiviazione](#storage).
- <!--i:cpu--> **Available offline** - scarica ciò che ti serve prima di perdere la connessione. Vedi [Available offline](#available-offline).
- <!--i:folder--> **Hot folder** - nell'app desktop, osserva una cartella e porta in Lolly tutto ciò che vi viene lasciato, attraverso lo stesso selettore del trascinamento.
- <!--i:clock--> **Your activity** - ciò che hai creato su questo dispositivo, contato in locale.
- <!--i:sliders--> **Feature flags** - attiva o disattiva parti dell'app, come **Print preflight** o **Strip metadata from uploads**.
- <!--i:server--> **Lolly instance** - da dove questa installazione prende strumenti e catalogo. Vedi [Lolly instance](#lolly-instance).

Le schede dei temi sono anteprime live e si applicano nel momento in cui ne scegli una, solo su questo dispositivo.

![Tre card tema, ciascuna con l'anteprima del proprio tipo e colore, con quella attiva segnalata](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Accessibilità

**Settings → Preferences → Accessibility** contiene quattro impostazioni di comfort per l'app attorno al tuo lavoro. Ognuna è disattivata finché non la attivi, e nessuna raggiunge l'interno della tela di uno strumento né di un'esportazione, quindi un'app più calma non sposta mai un pixel del file che consegni.

- <!--i:pause--> **Reduce motion** disattiva le transizioni, gli scorrimenti e gli abbellimenti dell'app. La tua tela e qualsiasi esportazione animata continuano a muoversi come progettato.
- <!--i:photos--> **Hide colourful previews** sostituisce l'artwork di anteprima della galleria con schede calme di icona e testo, e attenua le miniature dei progetti così restano riconoscibili senza gridare.
- <!--i:sliders--> **High contrast** rafforza i bordi, il testo e gli anelli di focus dell'app. I colori del tuo brand e la tela restano come li hai impostati.
- <!--i:font--> **Large text** ingrandisce le etichette, i menu e il testo dei pulsanti dell'app. La tipografia dentro i tuoi design non viene toccata, quindi nulla di ciò che esporti si riposiziona.

Queste impostazioni risiedono nel tuo profilo, quindi viaggiano in un'esportazione del profilo e arrivano alla prossima installazione con il tuo nome e le tue sessioni. Una piccola copia solo per il dispositivo le applica prima del primo disegno.

La stessa scheda contiene **Sound**, uno strato leggero di suoni di assistenza per ciò che fai (l'arrivo nella galleria, un risultato di Content Credentials, la chiusura di un pannello), e **Neurospicy Mode**, una traccia calma per concentrarsi. Attivare Neurospicy apre un piccolo player nell'angolo che ti segue in tutta l'app. Lì scegli una traccia, salti, imposti il volume e riduci a icona o chiudi il player. Le tracce includono melodie procedurali *Lolly Sings*, loop ambient e beat, il tuo audio e stazioni radio via internet, che richiedono una connessione. Entrambi sono disattivati per impostazione predefinita e ricordati, e disattivare Sound silenzia anche la traccia di concentrazione. Il menu del profilo e **This device** portano lo stesso interruttore.

L'interfaccia è navigabile da tastiera, i controlli personalizzati portano etichette per gli screen reader e l'anteprima live di ogni strumento è esposta come un'unica immagine etichettata che descrive ciò che mostra.

### Archiviazione

Il misuratore dell'archiviazione rende conto di ogni byte che questa installazione contiene, categoria per categoria, rispetto a ciò che riporta il browser.

![Il misuratore dell'archiviazione, che scompone sessioni salvate, immagini e cache rispetto a ciò che il browser riporta davvero](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Sotto il misuratore:

- **Move to another device** contiene **Export my data**, **Import data…** ed **Export my data & render everything**. [Move your work to another device](/info/find-your-work.html#move-your-work-to-another-device) li descrive passo per passo.
- **Clear cache** elimina i file del catalogo scaricati, che vengono scaricati di nuovo quando servono.
- **Remove automatic checkpoints older than 30 days** libera spazio in History e mantiene le versioni salvate e con nome.
- **Clear all my data** rimuove tutto ciò che Lolly conserva in questo browser, dopo che digiti una parola per confermare. [If you clear your browser data](/info/find-your-work.html#if-you-clear-your-browser-data) elenca cosa viene eliminato.

### Available offline

Lolly mette in cache le schermate mentre le visiti, il che copre solo i posti in cui sei già stato. **Available offline** serve per il viaggio che vedi arrivare: scarica le parti che ti serviranno e guarda una sola barra di avanzamento, e tutto ciò che hai preso continua a funzionare senza connessione.

- <!--i:monitor--> **App, catalogue and guides** - **The app** (ogni vista, editor e font, comprese le schermate che non hai mai aperto), il **Catalogue** (tutto, oppure **Choose by tag**) e **Guides & docs** (questa documentazione nella tua lingua, screenshot compresi).
- <!--i:cpu--> **AI models** - ogni modello sul dispositivo su una propria riga con la sua dimensione: Speech voices, Upscaling models, Background removal, Text recognition, Verify deep scan, Durable credential, Rewriter model, Ask matching model, AI text detector e Singing voices. Un modello sopra i 50 MB è contrassegnato **large download**.
- <!--i:wrench--> **Tools** - ogni strumento si scarica da solo, oppure **Download all** prende tutti gli strumenti. Una spunta significa pronto offline.

**Download everything** in alto scarica l'app, l'ambito del catalogo che hai scelto, le guide e tutti gli strumenti. Spunta **Include all the AI models** per aggiungere i modelli, oppure scarica un modello dalla sua riga; le voci cantate si scaricano sempre e solo dalla loro riga. La policy di un'organizzazione può disattivare i download dell'IA, e le righe te lo dicono.

I download riprendono da dove si erano fermati se annulli o perdi la connessione, e si aggiornano da soli quando torni online, scaricando solo ciò che un rilascio ha cambiato. Se il browser non ha concesso l'archiviazione persistente, **Protect downloads** la richiede: la differenza tra "scaricato" e "scaricato finché il browser non rivuole lo spazio".

### Lolly instance

**Lolly instance** indica da dove questa installazione prende strumenti e catalogo: l'indirizzo di un'istanza, oppure *Bundled with this app* quando tutto è incluso nella build.

- **Design-system source** mostra da dove proviene il design system fornito.
- **Instance console** apre le pagine di amministrazione di un'installazione, dove le offre.
- **Change** punta l'app desktop a un'altra istanza. Un browser non può caricare strumenti e risorse tra origini diverse, quindi sul web la sezione offre invece **Open a workspace**.
- **Leave** rimuove il design system, gli strumenti e il catalogo dell'istanza, e il tuo lavoro resta. Vedi [Use Lolly at your organisation](/info/organisation.html#leaving).
- Quando hai effettuato l'accesso a un'organizzazione, **Sign out** termina questa sessione e **Sign out everywhere** termina le tue sessioni su ogni dispositivo, questo compreso.

## Questo dispositivo

- <!--i:monitor--> **This Machine** - schermo, input, grafica, memoria, codec, backend di archiviazione e altro, letti dal vivo da questa sessione. Nulla viene conservato e nulla viene inviato. Si apre da solo su uno schermo largo, dove la scheda si dispone su due colonne.
- <!--i:neurobeat--> **Sound** - i suoni dell'interfaccia e i loop di concentrazione Neurospicy, l'unico interruttore di questa scheda che scrive qualcosa.
- <!--i:database--> **Storage** - una vista di sola lettura del misuratore in [Preferences](#storage), che è il posto in cui cancelli o porti via i tuoi dati.

## Design system

Il design system attivo, presentato per essere letto. Quando questo browser contiene due o più design system, una striscia di piccole copertine in alto li elenca: sceglierne una la rende attiva, e **Undo** nell'avviso che segue rimette quella precedente.

![La scheda Design system su Lolly Demo: una striscia di copertine per cambiare sistema, poi la copertina con il suo logo, il nome, la nota e i conteggi che aprono ogni pagina](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

La scheda si apre su una copertina dipinta con i colori del sistema stesso, con il suo logo, il suo nome nel suo carattere di titolo e la nota scritta dal suo autore. Una riga di conteggi sulla copertina rimanda a ogni pagina:

- <!--i:palette--> **Colour** - superficie, testo, primario e secondario degli aspetti chiaro e scuro, ogni colore con nome come chip con nome ed esadecimale, una fascia per ogni rampa di tinte e lo spettro dei grafici, e i ruoli dei colori in una sezione richiudibile. Seleziona un valore per copiare l'esadecimale.
- <!--i:font--> **Type** - Headings, Text, Emphasis e Code, ciascuno composto nel proprio carattere.
- <!--i:photos--> **Logos** - ogni file di logo sullo sfondo per cui è stato creato.
- <!--i:layers--> **Colourways** - la coppia chiaro e scuro di ogni colourway, quando il sistema ne ha più di una.
- <!--i:sliders--> **Tokens** - raggio, spaziatura, effetti e gradienti.
- <!--i:document--> **Print & CMYK** - i colori bloccati su un inchiostro esatto e le condizioni di stampa che un PDF CMYK può dichiarare.

Cambiare sistema è l'unica modifica che questa scheda fa. Modifichi un design system in [Design System Setup](/info/brand-studio.html) a `#/start`, a cui rimanda la copertina. Un sistema in sola lettura lo dice sulla sua copertina; i sistemi locali che crei restano modificabili. `/b` e `/brand` sono scorciatoie dirette a questa scheda.

## Capabilities

Ogni parte della piattaforma è descritta in una scheda, in dodici gruppi: Experiences, Platforms & runtimes, Accessibility & languages, Export formats, Import formats, Print production, Automation & AI, Determinism & reproducibility, Brand & design system, Privacy & data ownership, Security & access control e Architecture (for builders). Ogni gruppo si richiude e mostra il numero delle sue schede. Una scheda si apre in una finestra con le funzioni di quella capacità e, per circa la metà, lo screenshot usato da questa documentazione.

Il campo di ricerca sopra i gruppi filtra le schede mentre scrivi e apre i gruppi che contengono ancora una corrispondenza. Dice in quante capacità sta cercando, e una query senza corrispondenze lo dice a parole.

Questa scheda è documentazione scritta di ciò che Lolly sa fare, mantenuta allineata con queste guide. Non sonda la macchina su cui sei; lo fa **This device**.

## Activity & stats

Prima la build: quanti strumenti sono caricati, quanti formati di esportazione esistono, su quante superfici gira la piattaforma e quante risorse del brand porta il catalogo, con un pannello **Catalogue** che scompone ciò che viene distribuito in questa build.

Poi il tuo lato: **Your activity** conta ciò che hai creato su questo dispositivo, e **Recent creations** e **Latest exports** sono pile che puoi scorrere, ciascuna visibile appena c'è qualcosa da mostrare. Entrambe aprono un elemento com'era. Questi contatori restano sul dispositivo; un'istanza Lolly Work facoltativa conserva i propri [record di telemetria e di audit dell'organizzazione](/info/privacy.html#organisation-services-with-lolly-work).

## Link diretti

Ogni scheda e sezione di Settings ha un proprio link, che puoi salvare nei preferiti o incollare. [Search](/info/search.html) punta i suoi risultati **Settings** allo stesso registro da cui Settings si disegna, così una sezione non può essere rinominata alle spalle di un risultato di ricerca.

::: details Ogni forma di link

- **Una scheda:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **Una sezione di Preferences:** `#/settings?focus=<section-id>`, come `#/settings?focus=offline-section`.
- **Una sezione, esattamente:** il suo id come flag semplice, come `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` o `#/settings?cap-formats`. I vecchi link `#/settings?dash-lock` e `#/settings?dash-palette-wheel` aprono la copertina e la pagina Colour.
- **Una sezione per parola chiave:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (la pagina Colour) o `#/settings?tokens`. Le parole chiave possono essere condivise: `print` appartiene sia al riferimento di stampa della scheda brand sia al gruppo Print production, e vince la prima nell'ordine della pagina. Usa l'id quando importa quale.

Un link diretto passa alla scheda che possiede la destinazione, apre l'eventuale gruppo in cui è richiusa, poi scorre fino ad essa, attendendo un attimo mentre le sezioni sopra finiscono di disporsi. Gli indirizzi dismessi `#/platform` e `#/capabilities` confluiscono in Settings con i loro flag di link diretto intatti.
:::

---

**Correlati:** [Profiles](/info/profile.html) per i tuoi dati e i contesti in cui crei. [Design System Setup](/info/brand-studio.html) per modificare ciò che mostra la scheda Design system. [Find and recover your work](/info/find-your-work.html) per archiviazione, backup e cambio di dispositivo.
