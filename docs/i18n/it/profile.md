# Profili

Imposta una volta nome, dati di contatto e foto, e ogni strumento pensato per usarli li compila per te: una firma email, un badge, una scheda di relatore. Quel piccolo record è il tuo **profilo**, e vive sul tuo dispositivo.

Il tuo profilo contiene anche ciò che accumuli mentre lavori: sessioni salvate, immagini caricate e il tuo conteggio locale di attività. Lo gestisci in **Settings → Preferences**; gli strumenti leggono solo i campi che sono stati pensati per precompilare. L'uso standalone non richiede un account, e Sync facoltativo, condivisione e servizi dell'organizzazione hanno ciascuno i propri flussi di dati, descritti più sotto.

## Cosa c'è in un profilo

| Parte | Cos'è |
|---|---|
| **Name** | Nome e cognome. |
| **Contact** | Email e telefono. |
| **Location** | Città e paese. |
| **Headshot** | Una foto facoltativa, ritagliata in un quadrato e conservata come immagine locale, per strumenti come firme email, schede di citazione e organigrammi. |
| **Use my details to create** | Un interruttore opt-in (diventa **Using my details** una volta attivo). Decide se i tuoi dati viaggiano come credito d'autore nei file esportati e nelle esecuzioni Batch. Non influisce sulla precompilazione; vedi [Come gli strumenti usano il tuo profilo](#how-tools-use-your-profile). |
| **Preferences** | Il tuo tema, le impostazioni di accessibilità e quali parti dell'app hai attivato in **Feature flags**. |
| **Your work** | Sessioni salvate con le loro miniature, organizzate in [Projects](/info/find-your-work.html), le tue immagini caricate e le tue statistiche locali di attività. |

Nulla è obbligatorio. Un profilo vuoto funziona; compila solo ciò che ti risparmia la digitazione.

![Settings nella scheda Preferences: la barra delle impostazioni e Your details con l'interruttore Use my details to create e i campi di nome, contatto e posizione](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

[Settings](/info/dashboard.html) mappa tutto il resto sotto Preferences, dall'aspetto e dalle emoji all'archiviazione e ai download offline.

## Tu, un team o un ruolo

La parola "profilo" suggerisce una persona fissa. In Lolly è più vicina a un contesto di creazione: chi sei mentre crei questa cosa. Può assumere tre forme, e Lolly le gestisce tutte allo stesso modo.

::: cols
## Come te stesso

Quella predefinita. Il tuo nome, la tua email, la tua foto. Impostala una volta e la tua firma, il tuo badge e il tuo lockup per le conferenze si compilano da soli.

## Come team

Il nome condiviso di un team, una casella di gruppo come `events@…`, un reparto e il marchio del team. Una persona lo imposta e lo esporta, e tutti gli altri caricano lo stesso profilo, così i file del team portano dati coerenti. Un chiosco condiviso o un portatile di demo può usare un solo profilo di team.

## Come ruolo

Un event manager tre giorni all'anno vuole la casella dell'evento e il sotto-brand dell'evento su badge e segnaletica, poi riavere la sua identità abituale. Conserva quel ruolo come file di profilo salvato, caricalo per l'evento e mettilo da parte dopo.
:::

![Il controllo della foto profilo, vuoto finché non carichi una foto che poi resta su questo dispositivo](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot&css=.profile-details-main%7Bdisplay%3Anone%7D)

::: details Profili in un'organizzazione che usa Lolly Work
Quando accedi al [Lolly di un'organizzazione](/info/organisation.html), Lolly Work può fornire campi di profilo verificati dal suo provider di identità e fissare campi o preferenze secondo la policy dell'organizzazione. Un campo gestito è etichettato nell'app.

Quell'accesso controlla anche l'accesso a progetti e risorse condivisi. Un file di profilo di team resta un file locale: non concede l'appartenenza all'organizzazione né sostituisce un account di lavoro. **Use my details to create** controlla il credito nelle tue esportazioni, non l'accesso né i record di audit dell'organizzazione. Vedi [Privacy](/info/privacy.html#organisation-services-with-lolly-work).
:::

## Tienine più di uno, usane uno

Un'installazione ha un solo profilo attivo alla volta, e nell'app non c'è un selettore. Ogni profilo è invece un file portabile, lo stesso file di backup che useresti per passare a un nuovo dispositivo. Per passare a un altro contesto:

::: timeline
- <!--i:download--> **Export my data** in **Settings → Storage → Move to another device** salva il profilo corrente come un unico `.zip`.
- <!--i:trash--> **Clear all my data** svuota questa installazione.
- <!--i:upload--> **Import data…** carica il file di profilo del contesto in cui stai entrando.
:::

Importare senza prima cancellare **unisce** invece. Le sessioni e le immagini importate vengono aggiunte; dove esistono entrambe le copie, viene mantenuta quella salvata più di recente. Cartelle, preferiti e template vengono aggiunti accanto ai tuoi, e i tuoi dati restano, tranne i campi vuoti, che prendono i valori del file. Va bene per portare le sessioni di un team nella tua configurazione, ma non per una separazione netta tra ruoli.

Per due contesti contemporaneamente, usa un profilo browser separato, un account utente separato o una seconda copia installata dell'app web: ciascuno porta il proprio profilo Lolly indipendente.

![I due pulsanti che spostano un'intera installazione: Export my data scrive uno zip, Import data lo rilegge](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> Tieni un file per contesto e dai a ciascuno il nome di ciò che è, come `LollyTools-events-2026.zip` e `LollyTools-me.zip`. Il file è il profilo.

[Move your work to another device](/info/find-your-work.html#move-your-work-to-another-device) tratta cosa contiene il file, cosa resta indietro e gli altri modi per spostare il lavoro, compreso Sync.

## Come gli strumenti usano il tuo profilo

**Precompilazione.** L'autore di uno strumento segna un input come ricavato dal tuo profilo (`bindToProfile: "firstname"`, `"email"`, `"headshot"` e così via). Quando lo strumento si apre, quell'input si compila dal tuo profilo, e puoi sovrascriverlo per una sola sessione senza cambiare il profilo, a meno che una policy dell'organizzazione blocchi l'input. La precompilazione è una comodità locale e avviene che **Use my details** sia attivo o no.

**Credito.** Quando esporti, i tuoi dati possono viaggiare come credito d'autore nei metadati del file (PNG, PDF, SVG e altri), così un file finito può dire chi ha fatto il lavoro. **Use my details to create** lo governa, insieme all'autore nelle esecuzioni Batch. Se è disattivato, l'esportazione dice comunque che è stata creata con Lolly e non porta alcuna riga personale di autore o contatto.

Autori di strumenti: vedi [`bindToProfile`](/info/tool-inputs.html#bindtoprofile) e [`host.profile`](/info/host-api.html#host-profile).

![L'unico interruttore Use my details to create, contrassegnato come opt-in e disattivato finché non lo attivi](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Duse-details&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## Profilo, design system e capacità

Tre cose stanno vicine in Settings e si confondono facilmente:

- <!--i:people--> **Profile** - tu, il tuo team o il ruolo in cui sei: nome, contatto, foto e lavoro salvato. Personale, conservato sul dispositivo e portabile come file.
- <!--i:palette--> **Design system** - il brand: colori, font e impostazioni con cui ogni strumento fa il rendering. Condiviso e coerente più che personale; vedi [Design System Setup](/info/brand-studio.html).
- <!--i:sliders--> **Capabilities** - ciò che l'app sa fare: le funzioni e gli strumenti a tua disposizione.

Un profilo cambia da chi è un file; il design system cambia come appare il file; le capacità sono ciò che puoi creare.

La parola ha altri tre significati in Lolly. Un **content profile** è un'impostazione di build che sceglie quali strumenti e quale catalogo distribuisce un'installazione; il [Glossary](/info/glossary.html) definisce il termine. Il parametro di link `profile` sceglie un profilo colore per un'esportazione, come una condizione di stampa CMYK; vedi [Reserved URL parameters](/info/url-parameters.html#print). Una **verified identity** è il certificato di firma facoltativo che lega la tua email alle esportazioni firmate, separato da questi dati, anche se **Use my details to create** governa se viene incorporato l'uno o l'altro; vedi [Content Credentials](/info/content-credentials-identity.html).

![La scheda Identità verificata, larghezza telefono: il selettore della durata del certificato e il passaggio di registrazione sotto di esso - il profilo identità, separato dai tuoi dati personali](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## Privacy

Il tuo profilo personale è conservato in locale. I tuoi dati possono viaggiare in un backup o in una copia di Sync, nei contenuti che condividi o esporti e durante l'iscrizione facoltativa a Content Credentials. Su un'istanza Lolly Work, accesso, lavoro condiviso, policy di telemetria e record di audit sono separati da questo profilo locale. **Settings → Preferences → Clear all my data** cancella questo dispositivo; non cancella le copie conservate dal tuo provider di archiviazione o dalla tua organizzazione. Vedi l'[Informativa sulla privacy](/info/privacy.html).
