# Profili

Imposta una volta nome, recapiti e foto del viso e ogni strumento progettato per usarli li inserisce, per esempio una firma email, un badge o una scheda relatore. Questo insieme di dati è il tuo **profilo** e risiede sul tuo dispositivo.

Il tuo profilo contiene anche sessioni salvate, immagini caricate e il conteggio locale delle tue attività. Gestiscilo in **Settings → Preferences**. Gli strumenti leggono solo i campi che sono stati progettati per precompilare. L'uso autonomo non richiede un account. Sync facoltativo, condivisione e servizi dell'organizzazione hanno ciascuno i propri flussi di dati.

<!--i:eti-user-check-->
## Cosa contiene un profilo

| Parte | Cos'è |
|---|---|
| **Name** | Nome e cognome. |
| **Contact** | Email e telefono. |
| **Location** | Città e paese. |
| **Headshot** | Una foto facoltativa, ritagliata in un quadrato e conservata come immagine locale, per strumenti come firme email, schede con citazioni e organigrammi. |
| **Use my details to create** | Un interruttore da attivare volontariamente che mostra **Using my details** quando è attivo. Decide se i tuoi dati accompagnano i file esportati e le esecuzioni di Lolly Batch come attribuzione d'autore; vedi [Come gli strumenti usano il tuo profilo](#how-tools-use-your-profile). |
| **Preferences** | Il tuo tema, la tua colourway in ogni design system, le impostazioni di accessibilità e le parti dell'app che hai attivato in **Feature flags**. |
| **Your work** | Le sessioni salvate con le loro miniature, organizzate in [Lolly Projects](/info/find-your-work.html), le immagini caricate e le statistiche locali sulle tue attività. |

Nessuno di questi dati è obbligatorio e un profilo vuoto funziona.

![Settings sulla scheda Preferences: la barra laterale delle impostazioni e Your details con l'interruttore Use my details to create e i campi per nome, recapiti e posizione](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

[Lolly Settings](/info/dashboard.html) descrive il resto di Preferences, dall'aspetto e le emoji allo spazio di archiviazione e ai download offline.

<!--i:eti-users-->
## Tu, un team o un ruolo

In Lolly un profilo rappresenta chi sei mentre crei qualcosa: te stesso, un team o un ruolo. Lolly gestisce tutti e tre allo stesso modo.

::: cols
## Come te stesso

L'impostazione predefinita: nome, email e foto del viso. La tua firma, il badge e la composizione grafica per la conferenza si compilano a partire da questi dati.

## Come team

Il nome condiviso del team, una casella di posta di gruppo come `events@…`, un reparto e il marchio del team. Una persona configura il profilo ed esporta un file. Tutti gli altri caricano lo stesso profilo, così i file del team riportano gli stessi dati. Un chiosco condiviso o un portatile dimostrativo può usare un unico profilo di team.

## Come ruolo

Chi gestisce un evento ha bisogno della casella di posta e del sottomarchio dell'evento su badge e segnaletica tre giorni all'anno, poi torna alla propria identità abituale. Conserva il ruolo come file di profilo salvato, carica il file per l'evento e mettilo da parte dopo.
:::

![Il controllo della foto del viso, vuoto finché non carichi una foto che resta poi su questo dispositivo](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot&css=.profile-details-main%7Bdisplay%3Anone%7D)

::: details Profili in un'organizzazione che usa Lolly Work
Quando accedi al [Lolly di un'organizzazione](/info/organisation.html), Lolly Work può fornire campi del profilo verificati dal suo provider di identità e bloccare campi o preferenze secondo le policy dell'organizzazione. Un campo gestito è contrassegnato nell'app.

Quell'accesso controlla anche l'accesso a progetti e risorse condivisi. Un file di profilo di team è un file locale. Non concede l'appartenenza all'organizzazione e non sostituisce un account di lavoro. **Use my details to create** controlla l'attribuzione nelle tue esportazioni, non l'accesso all'organizzazione o i record di audit. Vedi [Privacy](/info/privacy.html#organisation-services-with-lolly-work).
:::

<!--i:eti-copy-->
## Conservane diversi, usane uno

Un'installazione ha un solo profilo attivo alla volta, senza un selettore nell'app. Ogni profilo è un file portabile, lo stesso file di backup che trasferisce il tuo lavoro su un nuovo dispositivo. Per cambiare contesto:

::: timeline
- <!--i:download--> **Export my data** in **Settings → Storage → Move to another device** salva il profilo corrente in un unico `.zip`.
- <!--i:trash--> **Clear all my data** svuota questa installazione.
- <!--i:upload--> **Import data…** carica il file di profilo per il contesto in cui stai entrando.
:::

::: note Importare senza prima cancellare unisce i dati
Le sessioni e le immagini importate vengono aggiunte. Quando esistono entrambe le copie, viene conservata quella salvata più di recente. Cartelle, preferiti e template vengono aggiunti accanto ai tuoi. I tuoi dati personali restano, tranne i campi vuoti, che prendono i valori del file. Un'unione è adatta a importare le sessioni di un team nella tua configurazione, ma non a una separazione netta tra ruoli.
:::

Per usare due contesti contemporaneamente, usa un profilo del browser, un account utente o una copia installata dell'app web separati. Ciascuno ha il proprio profilo Lolly.

![I due pulsanti che trasferiscono un'intera installazione: Export my data scrive un unico zip, Import data lo rilegge](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

::: note Conserva un file per ogni contesto
Assegna a ogni file un nome che lo descriva, come `LollyTools-events-2026.zip` e `LollyTools-me.zip`. Il file è il profilo.
:::

[Spostare il lavoro su un altro dispositivo](/info/find-your-work.html#move-your-work-to-another-device) descrive cosa contiene il file, cosa resta sul dispositivo e gli altri modi per trasferire i dati, incluso Sync.

<!--i:eti-pen-->
## Come gli strumenti usano il tuo profilo

**Precompilazione.** L'autore di uno strumento indica che un input attinge al tuo profilo (`bindToProfile: "firstname"`, `"email"`, `"headshot"` e così via). Quando lo strumento si apre, quell'input viene compilato dal tuo profilo. Puoi sostituire il valore per una sessione senza modificare il profilo, a meno che una policy dell'organizzazione non blocchi l'input. La precompilazione avviene localmente, sia che **Use my details** sia attivo sia che non lo sia.

**Attribuzione.** Quando esporti, i tuoi dati possono accompagnare il file come attribuzione d'autore nei metadati (PNG, PDF, SVG e altri). **Use my details to create** controlla questa attribuzione e l'autore nelle esecuzioni di Lolly Batch. Con l'interruttore disattivato, l'esportazione indica comunque che è stata creata con Lolly, ma non contiene dati personali sull'autore o una riga di contatto.

Autori di strumenti: vedi [`bindToProfile`](/info/tool-inputs.html#bindtoprofile) e [`host.profile`](/info/host-api.html#host-profile).

![L'unico interruttore Use my details to create, indicato come facoltativo e disattivato finché non lo attivi](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Duse-details&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

<!--i:eti-layers-->
## Profilo, design system e funzionalità

Tre cose sono vicine in Settings ed è facile confonderle:

- <!--i:people--> **Profile** - tu, il tuo team o il ruolo che ricopri: nome, recapiti, foto del viso e lavoro salvato. Personale, conservato sul dispositivo e portabile come file.
- <!--i:palette--> **Design system** - il marchio: colori, font e impostazioni con cui ogni strumento renderizza. Condiviso, non personale; vedi [Configurazione del design system di Lolly](/info/brand-studio.html).
- <!--i:sliders--> **Capabilities** - cosa può fare l'app: le funzionalità e gli strumenti a tua disposizione.

La parola ha altri tre significati in Lolly. Un **profilo dei contenuti** è un'impostazione di build che sceglie quali strumenti e catalogo include un deployment; il [Glossario](/info/glossary.html) definisce il termine. Il parametro di link `profile` sceglie un profilo colore per un'esportazione, come una condizione di stampa CMYK; vedi [Parametri URL riservati](/info/url-parameters.html#print). Un'**identità verificata** è il certificato di firma facoltativo che collega la tua email alle esportazioni firmate. È separato da questi dati, ma **Use my details to create** decide se incorporare gli uni o l'altro; vedi [Content Credentials](/info/content-credentials-identity.html).

![La scheda Verified identity, alla larghezza di un telefono: il selettore della durata del certificato e il passaggio di registrazione sotto - il profilo di identità, separato dai tuoi dati personali](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

<!--i:eti-lock-->
## Privacy

Il tuo profilo personale è archiviato localmente. I tuoi dati possono viaggiare in un backup o in una copia Sync, nei contenuti che condividi o esporti e durante la registrazione facoltativa a Content Credentials. In un'istanza di Lolly Work, accesso, lavoro condiviso, policy di telemetria e record di audit sono separati da questo profilo locale. **Settings → Preferences → Clear all my data** cancella i dati da questo dispositivo; non elimina le copie conservate dal tuo fornitore di archiviazione o dall'organizzazione. Vedi l'[Informativa sulla privacy](/info/privacy.html).
