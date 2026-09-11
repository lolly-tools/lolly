# Profili - chi sei quando crei

Un **profilo** è l'identità operativa con cui Lolly crea. È il piccolo insieme di dettagli da cui uno strumento può attingere così non li riscrivi ogni volta - il tuo nome, i contatti, una foto opzionale, alcune preferenze - più tutto ciò che accumuli lavorando: sessioni salvate, immagini caricate e il conteggio dell'attività locale.

Tutto quello che c'è in un profilo vive **sul dispositivo**, nel database locale del browser (IndexedDB sulla PWA web, il filesystem sulle app Tauri). Non c'è nessun account e niente viene caricato. Lo gestisci sotto **Profilo** (in alto a destra nella galleria); gli strumenti lo *leggono* soltanto, e solo i campi specifici per cui sono stati costruiti per la precompilazione.

> Un profilo riguarda *te* (o chiunque stia creando qui). È distinto dalla **Platform** - i colori, i font e le impostazioni globali del brand - e dalle **Capabilities**, il catalogo di ciò che l'app può fare. Vedi [Profile vs Platform vs Capabilities](#profile-vs-platform-vs-capabilities) alla fine.

## Cosa c'è in un profilo

| Parte | Cos'è |
|---|---|
| **Nome** | Nome e cognome. |
| **Contatto** | Email e telefono. |
| **Posizione** | Città e paese. |
| **Foto profilo** | Una foto opzionale, ritagliata a quadrato e conservata come immagine locale. Usata da strumenti come firme email, quote card, organigrammi e layout dinamici. |
| **Usa i miei dati per creare** | Un unico interruttore opt-in (mostra **Sto usando i miei dati** una volta attivo). Controlla se i tuoi dati personali accompagnano i file come **provenienza** - la riga autore/credito incorporata nei file esportati - e come autore nelle esecuzioni batch su **/pro**. (Non condiziona il pre-riempimento: vedi [Come gli strumenti usano il tuo profilo](#how-tools-use-your-profile).) |
| **Preferenze** | Il tuo tema (Chiaro, Scuro o Brand - il tema brand colora l'app con la tua stessa palette) e quali parti dell'app hai abilitato tramite i **Feature flag**. |
| **Accessibilità** | Quattro interruttori di comfort - *Riduci animazioni*, *Nascondi anteprime colorate*, *Alto contrasto*, *Testo grande* - conservati nel record del profilo, così viaggiano in un'esportazione del profilo. Vedi [Accessibilità](#accessibility). |
| **Il tuo lavoro** | Sessioni salvate (con miniature) - organizzate in cartelle annidate in **[Progetti](/info/using.html)** - la tua libreria **Le mie immagini** e le statistiche di attività locale, tutte associate a questo profilo. |

![Three theme cards, each previewing its own type and colour, with the active one flagged](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

![La schermata Profilo - nome, contatto, una foto opzionale e le tue preferenze](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

Niente di tutto questo è obbligatorio. Un profilo vuoto è un profilo perfettamente valido; compili solo quello che ti risparmia di scrivere.

La pagina è lunga, quindi porta con sé una **barra impostazioni** laterale - I tuoi dati, Aspetto, Accessibilità, Istanza Lolly, La tua attività, Archiviazione, Disponibile offline, Feature flag, Content Credentials - con un campo **Cerca impostazioni** sopra che filtra l'elenco mentre digiti. Ogni sezione è collegabile in profondità come `#/profile?focus=<section-id>`, che la apre e la scorre in vista (`#/profile?focus=storage-section`, `?focus=feature-flags-section`, e così via), così un link può puntare a una singola impostazione anziché all'inizio della pagina.

![Tre card tema, ciascuna con l'anteprima del proprio tipo e colore, con quella attiva segnalata](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

## Un profilo è un contesto, non solo una persona

La parola "profilo" suggerisce una persona fissa unica, ma in Lolly è in realtà un **contesto di creazione** - *chi sei mentre crei questa cosa*. Quel contesto può assumere tre forme diverse, e Lolly le gestisce tutte allo stesso modo.

### Come individuo

![The headshot control, empty until you upload a photo that then stays on this device](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

![Il controllo della foto profilo, vuoto finché non carichi una foto che poi resta su questo dispositivo](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

### Come team

Un profilo non deve per forza essere una singola persona. Può rappresentare un **team o una funzione all'interno di un'organizzazione**: il nome condiviso del team, un indirizzo di posta di gruppo (`events@…`), un reparto, la foto del team o il marchio dell'unità. Una persona lo configura, lo esporta (vedi sotto) e il resto del team carica lo stesso profilo - così tutto ciò che il team produce porta dettagli coerenti senza che nessuno li reinserisca. Un chiosco condiviso o un laptop demo dato in prestito possono usare un unico profilo di team con cui chiunque vi si trovi davanti crea.

### Come funzione - un ruolo che indossi ogni tanto

Questo è il caso che il modello rigido "una persona, un profilo" non contempla. Potresti essere un **event manager per tre giorni l'anno** e qualcosa di completamente diverso per il resto del tempo. In quei tre giorni vuoi i dati dell'evento, la casella di posta dell'evento, magari una sottomarca dell'evento per compilare i tuoi badge e la tua segnaletica; negli altri 362 vuoi indietro la tua identità normale.

In Lolly, quel ruolo è semplicemente **un altro profilo che tieni a portata di mano** - un pacchetto salvato (sezione successiva) che carichi per l'evento e metti da parte dopo. Il ruolo è un cappello, non un nuovo account. Indossalo quando ti serve, toglilo quando hai finito.

## Un'installazione, un profilo attivo - puoi conservarne molti

In ogni momento un'installazione ha **un profilo attivo** - i dettagli che uno strumento vede in quel momento. Non c'è un selettore di profili in-app; ogni profilo è invece un **pacchetto portabile** (un singolo `.zip`, vedi [sotto](#moving-a-profile-to-a-new-device)). È deliberatamente lo stesso meccanismo del trasferimento a un nuovo dispositivo - un profilo è un file che puoi salvare, copiare e caricare.

![The storage meter, breaking down saved sessions, images and cache against what the browser actually reports](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

- <!--i:trash--> **Cambio più pulito:** **Profilo → Archiviazione → Cancella tutti i miei dati**, poi **Importa** il pacchetto per il contesto in cui stai entrando. Ora stai creando esclusivamente come quel profilo.
- <!--i:layers--> **Sovrapposizione:** importare *senza* cancellare prima **unisce** - il profilo, le sessioni e le immagini importati si sovrappongono a ciò che è già presente, sostituendo tutto ciò che ha lo stesso nome e lasciando il resto. Utile per portare le sessioni salvate di un team nella tua configurazione; non ciò che vuoi se hai bisogno di un confine di ruolo netto.
- <!--i:monitor--> **Fianco a fianco:** poiché tutto è associato al dispositivo, un profilo browser separato, un account utente separato o una seconda PWA installata portano ciascuno un proprio profilo Lolly indipendente. Esegui la tua installazione personale e quella del chiosco evento contemporaneamente, senza dover cambiare.

Quindi se gestisci davvero più contesti contemporaneamente (tu, il tuo team, il cappello da event manager), conservi più pacchetti e carichi quello che ti serve:

![Il misuratore di archiviazione, che scompone sessioni salvate, immagini e cache rispetto a ciò che il browser effettivamente riporta](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

> Conserva un pacchetto per ogni contesto e rinomina i file per quello che sono (`LollyTools-events-2026.zip`, `LollyTools-me.zip`). Il file *è* il profilo.

## Accessibilità

**Profilo → Accessibilità** contiene quattro impostazioni di comfort per l'app *attorno* al tuo lavoro. Ognuna è disattivata finché non la attivi, e nessuna raggiunge l'interno di una canvas dello strumento o un'esportazione - un'app più calma non deve spostare un pixel del file che spedisci.

- <!--i:film--> **Riduci animazioni** - disattiva le transizioni, gli scorrimenti e i fronzoli animati dell'app. La tua canvas dello strumento e qualsiasi esportazione animata continuano a muoversi esattamente come progettato.
- <!--i:image--> **Nascondi anteprime colorate** - sostituisce le immagini di anteprima della galleria con card calme di icona e testo, e riduce il colore e il contrasto delle miniature dei tuoi progetti così restano riconoscibili senza gridare. All'interno di uno strumento tutto viene mostrato a colori pieni.
- <!--i:sliders--> **Alto contrasto** - rafforza i bordi, il testo e gli anelli di focus dell'app. I colori del tuo brand e tutto ciò che è sulla canvas restano esattamente come li hai impostati.
- <!--i:font--> **Testo grande** - ingrandisce i caratteri dell'app: etichette, menu e testo dei pulsanti. I controlli mantengono la loro dimensione, quindi solo le parole al loro interno diventano più grandi, e il testo all'interno dei tuoi progetti resta intoccato, così nulla di ciò che esporti si riadatta.

Questi risiedono sul record del profilo stesso, motivo per cui viaggiano in un'esportazione del profilo e arrivano sulla prossima installazione insieme al tuo nome e alle tue sessioni. (Il dispositivo mantiene anche un piccolo specchio locale così l'impostazione si applica prima del primo rendering; quello specchio è solo del dispositivo e non viaggia.)

## La tua istanza Lolly

**Profilo → Istanza Lolly** indica da dove questa installazione ottiene i suoi strumenti e il suo catalogo - l'indirizzo dell'istanza, oppure *Incluso in questa app* quando tutto è distribuito dentro la build. Dove un deployment ne offre una, un link **Console dell'istanza** apre la sua superficie di amministrazione, e **Cambia** / **Disconnetti** ripuntano l'installazione o la staccano.

Ripuntare verso un'altra istanza richiede l'**app desktop**: un browser blocca a una pagina il caricamento di strumenti e asset tra origini diverse, quindi sul web la sezione riporta dove ti trovi e si ferma lì.

## Disponibile offline

Lolly fa cache man mano che procedi, ma la cache man mano che procedi copre solo dove sei già stato. **Profilo → Disponibile offline** è per il viaggio che vedi arrivare: un'ora di wifi aeroportuale prima di un volo che non ne avrà. Scarica le parti che ti serviranno, guarda una sola barra di avanzamento, e tutto ciò che hai preso continua a funzionare anche senza connessione.

Sette parti, ciascuna con la propria dimensione indicata prima di procedere:

- <!--i:layout--> **L'app** - ogni vista, editor e font, incluse quelle che non hai ancora aperto. Senza questo, una schermata mai visitata online non può caricarsi offline.
- <!--i:image--> **Catalogo** - asset del brand oltre agli essenziali. Prendili tutti, oppure apri *Scegli per tag* e prendi solo i tag che usi.
- <!--i:book--> **Guide e documentazione** - questo sito di documentazione, nella tua lingua, screenshot inclusi.
- <!--i:cpu--> **Voci vocali** - i modelli vocali dietro l'audio Script e la narrazione. Scaricati una volta, poi girano sul dispositivo.
- <!--i:zap--> **Modelli di upscaling** - gli upscaler IA per immagini: foto, illustrazione/anime e volto.
- <!--i:layers--> **Rimozione sfondo** - i modelli di ritaglio sul dispositivo dietro *Rimuovi sfondo*.
- <!--i:shield--> **Scansione approfondita di Verify** - lo scanner di filigrana sul dispositivo, per verificare le Content Credentials lontano da una connessione.

Gli ultimi quattro sono contrassegnati come **download grande** e sono deliberatamente opt-in individuali: **Scarica tutto** in alto prende l'app, l'ambito di catalogo che hai scelto, i documenti e tutti gli strumenti in un solo passaggio, e nient'altro. Le voci vocali, gli upscaler, la rimozione dello sfondo e la scansione approfondita si scaricano solo quando richiedi quella riga per nome - qualche centinaio di megabyte nascosti dentro un solo pulsante sarebbe disonesto.

Sotto le sezioni si trova l'elenco per strumento: ogni strumento si scarica singolarmente (il segno di spunta indica che è pronto offline), oppure **Scarica tutto** li prende tutti in blocco. I download sono riprendibili - annulla o perdi la connessione e l'esecuzione successiva riprende da dove si era interrotta, recuperando solo ciò che manca - e si aggiornano da soli quando torni online, prelevando solo ciò che una nuova versione ha cambiato.

Se il browser non ha concesso l'archiviazione persistente, la sezione lo segnala e offre **Proteggi i download**, che la richiede - la differenza tra "scaricato" e "scaricato finché il browser non vuole riprendersi lo spazio".

## Spostare un profilo su un nuovo dispositivo

![The two buttons that move a whole install: Export my data writes one zip, Import data reads it back](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Poiché un profilo è interamente locale, l'unico modo per portarlo su un'installazione vuota - un nuovo laptop, un browser appena resettato, il computer di un collega, una macchina offline - è **portare il file con te**. Nessun login lo ripristina al posto tuo, ed è proprio questo il punto: niente è mai uscito dal tuo dispositivo, per cominciare.

- <!--i:download--> **Esporta i miei dati** scarica un file `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` - denominato in base al profilo a cui appartiene, con un numero di sequenza giornaliero perché esportazioni ripetute non collidano (le parti del nome vengono omesse quando il profilo non le ha). Contiene il tuo profilo, ogni sessione salvata (con la sua miniatura), le tue immagini caricate - i tuoi token di brand e i font installati viaggiano insieme come risorse utente - e le tue preferenze (tema, layout, statistiche di attività locali).
- <!--i:upload--> **Importa dati…** sull'altra installazione rilegge quel file e riprendi esattamente da dove avevi lasciato.
- <!--i:box--> **Esporta i miei dati e rendi tutto** scrive lo stesso backup *più* un secondo zip che rende ogni sessione salvata nel suo file di output finito, in cartelle che rispecchiano i tuoi Progetti. Un archivio offline completo sia delle sorgenti che dei risultati - e può essere grande e lento con molte sessioni.

![I due pulsanti che spostano un'intera installazione: Esporta i miei dati scrive uno zip, Importa dati lo rilegge](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Il pacchetto è uno zip semplice e autonomo, quindi viaggia con **qualsiasi** mezzo - USB, AirDrop, una condivisione di rete, un'email a te stesso - e la destinazione può essere completamente offline. Ogni parte ha un checksum, così un file danneggiato durante il trasferimento viene rilevato all'importazione invece di essere ripristinato a metà. L'importazione **unisce** (profilo/sessione/immagine con lo stesso nome vengono sovrascritti; tutto il resto viene mantenuto), quindi non cancella mai una destinazione già in uso.

Quello che non viaggia: la cache del catalogo (si riscarica da sola sul nuovo dispositivo) e gli strumenti stessi (si presume siano già presenti).

Per il layout esatto del pacchetto, la politica delle versioni e le regole di integrità, vedi **[Trasferimento dati](/info/data-transfer.html)**; per la procedura completa passo passo, **[Usare Lolly → Passare a un altro dispositivo](/info/using.html#moving-to-another-device)**.

## Come gli strumenti usano il tuo profilo

![The single Use my details switch, sitting beside Save Profile and off until you turn it on](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

Uno strumento *precompila* solo i campi del profilo per cui è stato esplicitamente costruito per associarsi:

**L'opt-in (provenienza).** Quando esporti una risorsa, i tuoi dati opzionalmente viaggiano insieme come **provenienza** - una riga di autore/credito incorporata nei metadati del file (PNG, PDF, SVG, …) - così una risorsa finita può dire chi l'ha creata. *Questo* è ciò che governa **Usa i miei dati per creare**: lascialo disattivato e l'esportazione porterà comunque l'attribuzione strumento/piattaforma "Made with Lolly", ma nessuna riga personale di autore/contatto viene incorporata. (Lo stesso opt-in imposta l'autore sulle esecuzioni batch di **/pro**.) (Autori di strumenti: vedi [Creare strumenti → `bindToProfile`](/info/authoring-tools.html#bindtoprofile) e [Host API → `host.profile`](/info/host-api.html#host-profile).)

![L'unico interruttore Usa i miei dati per creare, accanto a Salva profilo e disattivato finché non lo attivi](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## Profilo contro Piattaforma contro Capacità

Tre elementi si trovano vicini nell'interfaccia e sono facili da confondere:

- <!--i:people--> **Profilo** - *tu* (o il tuo team, o il ruolo che ricopri): nome, contatto, foto, il tuo lavoro salvato. Personale, locale al dispositivo, portabile come pacchetto.
- <!--i:palette--> **Piattaforma** - il *brand*: colori, font e impostazioni globali su cui ogni strumento renderizza. Condiviso e coerente, non personale.
- <!--i:sliders--> **Capacità** - *cosa può fare l'app*: l'intero set di funzionalità e gli strumenti a tua disposizione.

Un profilo cambia da chi *proviene* un asset; la piattaforma cambia il suo *aspetto*; le capacità sono *cosa puoi creare*.

### "Profilo" significa altre due cose altrove - non questa

La parola è sovraccarica di significati in tutto il progetto. Nessuno dei due è il profilo personale di cui parla questa pagina:

- <!--i:box--> **Profilo di contenuto** - una configurazione a tempo di build in `profiles.json` che lega un insieme di pacchetti di strumenti a un catalogo di brand (ad es. `suse`, `lolly-start`). È ciò che un operatore sceglie al momento del deployment, ed è anche ciò che il **parametro URL/CLI** `profile` seleziona come variante di *colore* al momento dell'esportazione (la condizione di stampa ICC/CMYK - vedi [Modalità URL](/info/url-mode.html)). Entrambi riguardano il *build/output*, non *te*. Vedi [Configurazione](/info/configuration.html).
- <!--i:seal--> **Profilo identità** - l'identità **Content Credentials verificata** opzionale che puoi registrare (un certificato a breve termine che lega la tua email alle tue esportazioni firmate). Si tratta di un'identità di firma, separata dai campi nome/contatto del profilo personale, anche se **Usa i miei dati per creare** governa se l'uno o l'altro viene incorporato. Vedi [Content Credentials Identity](/info/content-credentials-identity.html).

![La scheda Identità verificata, larghezza telefono: il selettore della durata del certificato e il passaggio di registrazione sotto di esso - il profilo identità, separato dai tuoi dati personali](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## Privacy

A parte la registrazione dell'identità opzionale descritta sopra (che invia l'email che registri al servizio di certificazione - vedi [Superficie server](/info/server-surface.html)), un profilo non viene mai trasmesso, caricato o usato per identificarti o tracciarti - non c'è nulla a cui acconsentire, solo questo avviso perché tu sappia cosa viene conservato. Cancella tutto in qualsiasi momento con **Profilo → Cancella tutti i miei dati**. Vedi la [Informativa sulla privacy](/info/privacy.html).
