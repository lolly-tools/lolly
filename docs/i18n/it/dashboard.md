# Impostazioni

Settings contiene i tuoi dati, il tuo design system, l'accessibilità, lo spazio di archiviazione su questo dispositivo e i download offline. Apri **Settings** dalla barra in fondo alla schermata iniziale o dal menu del tuo avatar: si apre su **Preferences**.

| Scheda | Indirizzo | Cosa contiene |
|---|---|---|
| **Preferences** | `#/settings` | I tuoi dati, design system, aspetto, emoji, accessibilità, connessioni, spazio di archiviazione e download offline |
| **This device** | `#/settings?tab=device` | Una lettura live di questo browser e di questa macchina, più il suono e una vista in sola lettura dello spazio di archiviazione |
| **Design system** | `#/settings?tab=brand` | Il design system attivo come copertina e pagine, con una striscia di copertine per cambiare sistema |
| **Capabilities** | `#/settings?tab=caps` | Tutto ciò che Lolly può fare, sotto forma di schede ricercabili |
| **Activity & stats** | `#/settings?tab=activity` | Il catalogo, i tuoi contatori locali e il lavoro recente |

I vecchi link `#/profile` e `#/d` aprono ancora il punto giusto, fino alle singole impostazioni.

<!--i:eti-sliders-->
## Preferenze

Preferences è un'unica pagina lunga con una **barra laterale delle impostazioni**. Il campo **Search settings** sopra la barra la filtra mentre digiti. Ogni sezione ha un link della forma `#/settings?focus=<section-id>`, come `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - nome, recapiti e foto del viso e l'interruttore **Use my details to create**. [Profili](/info/profile.html) spiega come gli strumenti li usano.
- <!--i:seal--> **Content Credentials** - l'identità verificata facoltativa che firma le tue esportazioni. Vedi [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - cambia, aggiungi, nascondi o rimuovi design system. [Configurazione del design system di Lolly](/info/brand-studio.html#manage-your-design-systems) descrive ogni azione.
- <!--i:moon--> **Appearance** - il tema (Light, Dark o Brand, che colora l'app con la tua palette), **Your colourway** quando il design system ne offre più di una ([Personalizza una colourway](/info/colourways.html#make-a-colourway-your-own)) e **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - il set di emoji per il nuovo lavoro, con la licenza della grafica, e l'intensità con cui la tua palette ricolora le emoji (**Off**, **Subtle**, **Strong**, **Full**, **Mono** o **Duotone**). **Keep skin tones and flags** lascia quelle nei loro colori. Il lavoro che hai già creato conserva il suo set.
- <!--i:eyeoff--> **Accessibility** - quattro interruttori per il comfort, più Sound e Neurospicy Mode. Vedi [Accessibilità](#accessibility).
- <!--i:link--> **Connected services** - lo spazio di archiviazione che colleghi, come Dropbox, Google Drive, OneDrive, Nextcloud o S3, e **Sync across devices**. Vedi [Sincronizza i tuoi dispositivi](/info/sync.html).
- <!--i:globe--> **Trusted sites** - i siti che un box di pagina web di Lolly Design o una demo di Lolly Sandbox può contattare senza chiedere, e, dove il server lo offre, **Allow pages from any site**. L'[Informativa sulla privacy](/info/privacy.html) elenca ciò che ogni richiesta invia.
- <!--i:download--> **Your renders** - **Save my renders to my library** conserva una copia di ogni immagine, clip audio e video che scarichi in Assets, con un tag Renders.
- <!--i:database--> **Storage** - ciò che Lolly conserva su questo dispositivo e i pulsanti che cancellano o trasferiscono i tuoi dati. Vedi [Archiviazione](#storage).
- <!--i:cpu--> **Available offline** - scarica ciò che ti serve prima di perdere la connessione. Vedi [Disponibile offline](#available-offline).
- <!--i:folder--> **Hot folder** - nell'app desktop, Lolly sorveglia una cartella e importa tutto ciò che vi viene inserito, tramite lo stesso selettore del trascinamento.
- <!--i:clock--> **Your activity** - ciò che hai creato su questo dispositivo, conteggiato localmente.
- <!--i:sliders--> **Feature flags** - attiva o disattiva parti dell'app, come **Print preflight** o **Strip metadata from uploads**. **Performance UI** dà all'app un aspetto più semplice che richiede meno risorse per essere disegnato. Lolly può attivare Performance UI da solo su un dispositivo lento. La riga sotto l'interruttore indica allora quando e perché, con **Allow again** ([come decide](/info/configuration.html#curating-what-people-see)).
- <!--i:server--> **Lolly instance** - da dove questa installazione ottiene i suoi strumenti e il catalogo. Vedi [Istanza di Lolly](#lolly-instance).

Le schede dei temi sono anteprime live. Un tema viene applicato appena lo scegli, solo su questo dispositivo.

![Tre schede di temi, ciascuna con un'anteprima dei propri caratteri e colori, con quella attiva contrassegnata](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Accessibilità

**Settings → Preferences → Accessibility** contiene quattro impostazioni per il comfort nell'app. Ciascuna resta disattivata finché non la attivi e nessuna interviene sulla tela di uno strumento o su un'esportazione, quindi un'app più tranquilla non sposta mai un pixel del file che invii. Ciascuna è disattivata per impostazione predefinita. Nessuna modifica la tela di uno strumento o un'esportazione.

- <!--i:pause--> **Reduce motion** disattiva transizioni, scorrimenti ed effetti decorativi dell'app.
- <!--i:photos--> **Hide colourful previews** sostituisce la grafica delle anteprime della galleria con schede di icone e testo e attenua le miniature dei progetti, che restano riconoscibili.
- <!--i:sliders--> **High contrast** rafforza bordi, testo e contorni del focus nell'app. I colori del tuo marchio e la tela restano come li hai impostati.
- <!--i:font--> **Large text** ingrandisce le etichette, i menu e il testo dei pulsanti dell'app.

**Dominant hand** (Right o Left) imposta il lato occupato dai controlli quando Lolly mostra due pannelli, su un dispositivo pieghevole o un tablet quasi quadrato. Anche **Swap sides** nell'intestazione di un pannello cambia questa impostazione.

Queste impostazioni risiedono nel tuo profilo, quindi viaggiano nell'esportazione del profilo insieme al tuo nome e alle sessioni. Una copia limitata al dispositivo le applica prima della prima visualizzazione.

La stessa scheda contiene **Sound**, suoni di supporto delicati per azioni come arrivare nella galleria, ricevere un risultato di Content Credentials o chiudere un pannello. Contiene anche **Neurospicy Mode**, una traccia tranquilla per concentrarti. Attivare Neurospicy apre un piccolo lettore nell'angolo che ti accompagna in tutta l'app. Nel lettore scegli una traccia, salti alla successiva, imposti il volume e riduci a icona o chiudi il lettore. Le tracce includono le stazioni generate da Lolly, loop ambient e ritmi, il tuo audio e stazioni radio internet, che richiedono una connessione. Entrambi sono disattivati per impostazione predefinita e la scelta viene ricordata. Disattivare Sound silenzia anche la traccia per la concentrazione. Il menu del profilo e **This device** contengono lo stesso interruttore.

Un cursore sotto l'interruttore Sound imposta di cosa sono fatti i suoni. Verso la forma tondeggiante **Bouba** diventano gocce morbide, bolle e un po' di bassi. Verso la stella appuntita **Kiki** diventano ticchettii secchi, graffi e metallo. Al centro restano i rintocchi e le note di Lolly. Se i suoni a un'estremità sono difficili da sopportare, spostati verso l'altra. Il cursore funziona mentre Sound è disattivato e rilasciarlo riproduce un breve campione.

::: details Le stazioni generate
Le stazioni generate compongono la loro musica mentre suonano, senza campioni né voci registrate. Ogni brano ha i propri strumenti, il proprio groove e la propria sequenza.

- **Lolly Sings** è una famiglia di stazioni. La Lolly Sings originale è vivace e melodica: tonalità maggiori, una parte solista in ogni brano e sfumature bossa, shuffle e chiptune. Ogni genere ha anche la propria stazione, da Sugar e K-pop a Country, Jazz, Metal e D&B.
- Le **stazioni Lofi** (Warm, Late night e Rainy) sono ritmi lo-fi senza fine.

In una stazione generata, avanti e indietro passano da un brano all'altro. Ogni brano nasce da un seed, quindi suona allo stesso modo ovunque lo condividi o lo salvi (vedi [Musica generata](/info/generated-music.html)). Sotto i controlli di riproduzione, **Mood** passa da una stazione Lofi all'altra, **Drums** esclude la batteria e **Texture** va da un suono pulito a quello di un disco polveroso. Segue una fila di pulsanti con icone. Passa il puntatore su un pulsante o tienilo premuto per vederne il nome:

- La nota musicale, **Open in the music generator**, apre il brano in `#/music`, dove puoi cambiarne gli strumenti sezione per sezione.
- Il link, **Share this tune or moment**, offre un link che riproduce lo stesso brano oppure uno che parte anche dal punto in cui ti trovi e mostra il visualizzatore con la preimpostazione e i colori attuali.
- La cartella, **Save to library**, conserva il brano nelle tue risorse.
- Il fulmine, **Light visualiser**, è un interruttore descritto sotto.

Un brano salvato compare nel gruppo della sua stazione, per tonalità e tempo. Sceglierlo riproduce di nuovo lo stesso brano, in ripetizione come qualsiasi traccia o passando al successivo in modalità avanzamento. Vengono memorizzati solo la stazione e il numero del brano, pochi byte, e la musica viene composta di nuovo mentre suona. Puoi rinominare o eliminare un brano salvato nelle tue risorse e usarlo come sottofondo musicale di un video. Lolly Demo e Lolly Start includono ciascuno sei brani salvati.

Il visualizzatore riceve ogni traccia a un livello costante, quindi una traccia sommessa muove l'immagine quanto una forte, a qualsiasi volume. Ogni genere di Lolly Sings, e un brano salvato da uno di essi, offre **Light visualiser**: semplici barre di livello che lasciano alla musica il tempo di elaborazione necessario. Light visualiser si avvia attivo sui touch screen e sui dispositivi con quattro core o meno o 4 GB di memoria o meno.
:::

Puoi usare l'interfaccia con la tastiera. I controlli personalizzati hanno etichette per i lettori di schermo. L'anteprima live di ogni strumento è un'unica immagine con un'etichetta che descrive ciò che mostra.

### Archiviazione

L'indicatore dello spazio di archiviazione mostra ogni byte conservato da questa installazione, per categoria, rispetto a quanto riporta il browser.

![L'indicatore dello spazio di archiviazione, che suddivide sessioni salvate, immagini e cache rispetto a quanto riporta effettivamente il browser](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Sotto l'indicatore:

- **Move to another device** contiene **Export my data**, **Import data…** ed **Export my data & render everything**. [Spostare il lavoro su un altro dispositivo](/info/find-your-work.html#move-your-work-to-another-device) li spiega uno per uno.
- **Clear cache** elimina i file del catalogo scaricati, che vengono scaricati di nuovo quando servono.
- **Remove automatic checkpoints older than 30 days** libera spazio in History e conserva le versioni salvate e quelle con nome.
- **Clear all my data** rimuove tutto ciò che Lolly conserva in questo browser, dopo che hai digitato una parola per confermare. [Se cancelli i dati del browser](/info/find-your-work.html#if-you-clear-your-browser-data) elenca ciò che viene eliminato.

### Disponibile offline

Lolly memorizza nella cache solo le schermate che hai visitato. **Available offline** scarica le parti che ti serviranno, con un'unica barra di avanzamento, e queste continuano a funzionare senza connessione.

- <!--i:monitor--> **App, catalogue and guides** - **The app** (ogni vista, editor e font, comprese le schermate che non hai mai aperto), il **Catalogue** (tutto, oppure **Choose by tag**) e **Guides & docs** (questa documentazione nella tua lingua, screenshot inclusi).
- <!--i:cpu--> **AI models** - ogni modello sul dispositivo ha la propria riga con la dimensione: voci per il parlato, modelli di upscaling, rimozione dello sfondo, riconoscimento del testo, scansione approfondita di Lolly Verify, credenziale durevole, modello Rewriter, modello di corrispondenza per Ask, rilevatore di testo AI e voci per il canto. Un modello oltre 50 MB è contrassegnato come **large download**.
- <!--i:wrench--> **Tools** - ogni strumento si scarica singolarmente, oppure **Download all** scarica tutti gli strumenti. Una spunta indica che è pronto per l'uso offline.

**Download everything** in alto scarica l'app, la parte del catalogo che hai scelto, le guide e tutti gli strumenti. Seleziona **Include all the AI models** per aggiungere i modelli, oppure scarica un modello dalla sua riga. Le voci per il canto si scaricano solo dalla propria riga. La policy di un'organizzazione può disattivare i download AI, e in quel caso le righe lo indicano.

I download riprendono da dove si sono fermati se li annulli o perdi la connessione. Quando torni online, si aggiornano e scaricano solo ciò che una versione ha cambiato. Se il browser non ha concesso l'archiviazione persistente, **Protect downloads** richiede quel permesso. Senza il permesso, il browser può eliminare i download quando vuole recuperare spazio.

### Istanza Lolly

**Lolly instance** indica da dove questa installazione ottiene strumenti e catalogo: l'indirizzo di un'istanza, oppure *Bundled with this app* quando tutto è incluso nella build.

- **Design-system source** mostra da dove proviene il design system fornito.
- **Instance console** apre le pagine di amministrazione di un'installazione, se disponibili.
- **Change** collega l'app desktop a un'altra istanza. Un browser non può caricare strumenti e risorse da origini diverse, quindi sul web la sezione offre invece **Open a workspace**.
- **Leave** rimuove il design system, gli strumenti e il catalogo dell'istanza. Il tuo lavoro resta. Vedi [Usare Lolly nella tua organizzazione](/info/organisation.html#leaving).
- Quando hai effettuato l'accesso a un'organizzazione, **Sign out** chiude questa sessione e **Sign out everywhere** chiude le tue sessioni su ogni dispositivo, incluso questo.

<!--i:eti-monitor-->
## Questo dispositivo

- <!--i:monitor--> **This Machine** - schermo, input, grafica, memoria, codec, backend di archiviazione e altro, letti in tempo reale da questa sessione. Non viene memorizzato né inviato nulla. Su uno schermo largo questo pannello si apre da solo e la scheda usa due colonne.
- <!--i:neurobeat--> **Sound** - i suoni dell'interfaccia e i loop Neurospicy per la concentrazione. Sound è l'unico interruttore in questa scheda che scrive qualcosa.
- <!--i:database--> **Storage** - una vista in sola lettura dell'indicatore. Cancella o trasferisci i tuoi dati in [Preferenze](#storage).

<!--i:eti-palette-->
## Design system

Il design system attivo, presentato per la consultazione. Quando questo browser contiene due o più design system, una striscia di copertine in alto li elenca. Scegline uno per renderlo attivo. **Undo** nell'avviso che segue ripristina quello precedente.

![La scheda Design system su Lolly Demo: una striscia di copertine per cambiare sistema, poi la copertina con logo, nome, nota e conteggi che aprono ogni pagina](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

La scheda si apre su una copertina nei colori del sistema, con il logo, il nome nel suo carattere display e la nota scritta dall'autore. Una riga di conteggi sulla copertina rimanda a ogni pagina:

- <!--i:palette--> **Colour** - superficie, testo, primario e secondario degli aspetti chiaro e scuro, ogni colore con nome in un chip con nome e valore esadecimale, una fascia per ogni scala di tinte e per lo spettro dei grafici, e i ruoli dei colori in una sezione richiudibile. Seleziona un valore per copiare il codice esadecimale.
- <!--i:font--> **Type** - Headings, Text, Emphasis e Code, ciascuno nel proprio carattere.
- <!--i:photos--> **Logos** - ogni file di logo sullo sfondo per cui è stato creato.
- <!--i:layers--> **Colourways** - la coppia chiara e scura di ogni colourway, quando il sistema ne ha più di una.
- <!--i:sliders--> **Tokens** - raggio, spaziatura, effetti e gradienti.
- <!--i:document--> **Print & CMYK** - i colori vincolati a un inchiostro preciso e le condizioni di stampa che un PDF CMYK può dichiarare.

Il cambio di sistema è l'unica modifica che questa scheda effettua. Modifica un design system in [Lolly Design System Setup](/info/brand-studio.html) su `#/start`, raggiungibile dalla copertina. Un sistema in sola lettura lo indica sulla copertina. I sistemi locali che crei restano modificabili. `/b` e `/brand` sono link brevi a questa scheda.

<!--i:eti-grid-->
## Funzionalità

Ogni parte della piattaforma ha una card, in dodici gruppi: Esperienze, Piattaforme & runtime, Accessibilità & lingue, Formati di esportazione, Formati di importazione, Produzione di stampa, Automazione & AI, Determinismo & riproducibilità, Brand & design system, Privacy & proprietà dei dati, Sicurezza & controllo degli accessi e Architettura (per chi sviluppa). Ogni gruppo si richiude e mostra il numero di card. Una card apre una finestra con le caratteristiche di quella funzionalità e, per circa metà delle card, lo screenshot usato in questa documentazione.

Il campo di ricerca sopra i gruppi filtra le card mentre scrivi e apre i gruppi che contengono una corrispondenza. Il campo mostra quante funzionalità cerca. Se una ricerca non trova corrispondenze, lo indica con un messaggio.

Questa scheda documenta ciò che Lolly può fare, in linea con queste guide. Non esamina la macchina che stai usando; lo fa **This device**.

<!--i:eti-gauge-->
## Attività & statistiche

Prima la build: il numero di strumenti caricati, i formati di esportazione, gli ambienti su cui gira la piattaforma e le risorse del brand nel catalogo. Un pannello **Catalogue** descrive ciò che è incluso in questa build.

Poi il tuo lavoro: **Your activity** conta ciò che hai creato su questo dispositivo. **Recent creations** e **Latest exports** sono pile che puoi sfogliare scorrendo, mostrate quando contengono qualcosa. Entrambe aprono un elemento com'era. Questi contatori restano sul dispositivo. Un'istanza facoltativa di Lolly Work conserva i propri [dati di telemetria e record di audit dell'organizzazione](/info/privacy.html#organisation-services-with-lolly-work).

<!--i:eti-link-->
## Link diretti

Ogni scheda e sezione di Settings ha un proprio link da salvare nei preferiti o incollare. [Lolly Search](/info/search.html) costruisce i risultati **Settings** dallo stesso registro di Settings, quindi rinominare una sezione non interrompe mai un risultato di ricerca.

::: details Ogni forma di link

- **Una scheda:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **Una sezione di Preferences:** `#/settings?focus=<section-id>`, come `#/settings?focus=offline-section`.
- **Una sezione precisa:** il suo id come flag senza valore, ad esempio `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` o `#/settings?cap-formats`. I vecchi link `#/settings?dash-lock` e `#/settings?dash-palette-wheel` aprono la copertina e la pagina Colour.
- **Una sezione per parola chiave:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (la pagina Colour) o `#/settings?tokens`. Due sezioni possono condividere una parola chiave: `print` appartiene sia al riferimento di stampa della scheda del brand sia al gruppo Print production, e prevale la prima nell'ordine della pagina. Usa l'id per sceglierne una.

Un link diretto passa alla scheda che contiene la destinazione e apre qualsiasi gruppo in cui la destinazione è nascosta. Poi scorre fino alla destinazione quando le sezioni sopra hanno completato il layout. Gli indirizzi dismessi `#/platform` e `#/capabilities` si aprono in Settings con i loro flag di link diretto intatti.
:::

---

**Vedi anche:** [Profili](/info/profile.html) per i tuoi dati e i contesti in cui crei. [Lolly Design System Setup](/info/brand-studio.html) per modificare ciò che mostra la scheda Design system. [Trovare e recuperare il tuo lavoro](/info/find-your-work.html) per archiviazione, backup e passaggio a un altro dispositivo.
