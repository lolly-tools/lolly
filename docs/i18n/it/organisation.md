# Usa Lolly nella tua organizzazione

La tua organizzazione può gestire il proprio Lolly: la stessa app, con gli strumenti e i design system che ha scelto. Scopri come raggiungerlo, accedere e cosa cambia.

Per pianificare la configurazione dell'organizzazione, [Usa Lolly con il tuo DAM esistente](/info/use-with-dam.html) spiega come mantenere una libreria approvata mentre le persone creano contenuti in Lolly. [Sovranità dei contenuti](/info/content-sovereignty.html) descrive il controllo più ampio su creazione, governance, archiviazione e portabilità.

::: note Cosa ti serve dalla tua organizzazione
L'indirizzo web del suo Lolly o un file di configurazione `.lolly` creato dall'organizzazione. lolly.tools da solo non si connette a un'organizzazione.
:::

<!--i:eti-globe-->
## In un browser

Apri l'indirizzo che ti ha dato la tua organizzazione. Se la pagina ti chiede di accedere, premi **Sign in** e segui la pagina di accesso che si apre. Poi Lolly funziona come al solito, con gli strumenti e i design system della tua organizzazione.

Puoi anche partire da lolly.tools: apri la vista **Settings** e, sulla card **Lolly instance**, premi **Open a workspace**, inserisci l'indirizzo e premi **Open this instance**. Il browser passa all'indirizzo della tua organizzazione, perché non può caricare gli strumenti di un altro Lolly da lolly.tools.

![La card Lolly instance in Settings, dove apri l'area di lavoro della tua organizzazione o cambi la fonte da cui l'app ottiene i suoi strumenti](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

<!--i:eti-monitor-->
## Nell'app desktop o mobile

L'app si avvia con gli strumenti inclusi. Per connetterti, apri la vista **Settings** e premi **Change** sulla card **Lolly instance**. Il pannello chiede **Where should Lolly get its tools?**

1. Scegli **Connect to a Lolly instance**.
2. Inserisci l'indirizzo web della tua organizzazione e premi **Check & connect**.
3. Premi **Use this instance**. La schermata successiva, **Import your data (optional)**, trasferisce il lavoro salvato da un backup di Lolly. Premi **Skip** se non ne hai uno.
4. Accedi se l'app lo chiede.

Gli strumenti di un'istanza collegata vengono eseguiti con lo stesso livello di fiducia di quelli dell'app, quindi connettiti solo a un'istanza di cui ti fidi. La tua organizzazione può invece inviarti un file di configurazione `.lolly` che connette l'app per te.

Per cambiare in seguito, usa di nuovo **Change** o **Leave** sulla stessa card.

### Accedere con un codice

Nelle app desktop e mobile, la schermata di accesso offre anche un codice breve quando il Lolly della tua organizzazione supporta l'accesso con codice. Premi **Open sign-in in browser**, accedi e approva il codice lì. Oppure apri l'indirizzo mostrato sullo schermo su un telefono o un computer dove hai già effettuato l'accesso e inserisci il codice. Il codice dura circa dieci minuti.

<!--i:eti-sliders-->
## Cosa cambia lì

- **Alcuni controlli sono impostati per te.** Un controllo gestito dalla tua organizzazione mostra **Managed by** e il nome dell'organizzazione, oppure **Managed by your organisation**. Un controllo fisso non può essere cambiato e un menu può offrire solo alcune delle sue opzioni. Alcuni controlli sono nascosti. La console della tua organizzazione registra quale regola ha fissato un controllo e perché. Chiedi a chi gestisce il Lolly della tua organizzazione.
- **Alcuni design system sono bloccati.** Un design system fornito dalla tua organizzazione mostra un lucchetto e resta di sola lettura. Per provare delle modifiche, crea una copia modificabile in **Settings → Preferences → Design systems**.
- **Sono elencati solo i suoi strumenti.** Uno strumento che la tua organizzazione non offre non viene mostrato.
- **Progetti condivisi.** Se la tua organizzazione condivide progetti con te, **Projects** mostra un riquadro **Team projects**. Queste sessioni risiedono sul server dell'organizzazione. Aprine una per lavorarci o avvia una [collaborazione di lavoro](/info/collaborate.html#collabs-through-lolly-work-optional) da **Share**, quando disponibile.
- **Alcune esportazioni possono richiedere un'approvazione.** Dove la tua organizzazione richiede l'approvazione, **Request approval** prende il posto di **Download** e uno strumento può offrire meno formati.
- **La schermata iniziale può aprirsi sui template.** Se la tua organizzazione pubblica template per te, come potrebbe fare per un'azienda partner, la schermata iniziale si apre su quelli anziché sul messaggio di benvenuto della prima visita. Ogni template è una card, con **Your copy** per continuare e **New version** quando il template cambia. Vedi [Template per i partner](/info/work-partner-templates.html).

### Cosa resta e dove

::: cols
## Su questo dispositivo

- I tuoi salvataggi, a meno che non attivi [Sync](/info/sync.html)
- I design system che hai creato tu
- Tutto ciò che crei e scarichi

## Sul server della tua organizzazione

- La tua identità di accesso e le informazioni sul dispositivo
- I progetti del team, le sessioni condivise e le modifiche live in una collaborazione di lavoro
- Le risorse che carichi nella libreria condivisa
- Le richieste di approvazione e le consegne approvate
- Un registro dei tuoi accessi e di ciò che fai lì
:::

Con un'area di lavoro collegata, la riga sulla privacy nella prima schermata dell'app dice la stessa cosa. Le app di Lolly non inviano eventi di utilizzo all'area di lavoro. [Privacy](/info/privacy.html#organisation-services-with-lolly-work) elenca ciò che il server conserva e chi controlla quei dati.

<!--i:eti-building-->
## Cosa aggiunge Lolly Work

Sul server della tua organizzazione viene eseguito **Lolly Work**, il software per le organizzazioni dello stesso progetto open source. L'app non richiede né un account di lavoro né Lolly Work quando la usi per conto tuo.

::: details Cosa può aggiungere Lolly Work
La tua organizzazione ospita [Lolly Work](https://github.com/lolly-tools/lolly-work) accanto a Lolly e sceglie quali funzioni attivare:

- **Accesso e autorizzazioni.** Single sign-on dell'organizzazione, permessi basati sui gruppi e campi del profilo gestiti. Gli amministratori possono creare e disattivare account tramite SCIM.
- **Lavoro condiviso.** Progetti del team, sessioni condivise e [collaborazioni di lavoro](/info/collaborate.html#collabs-through-lolly-work-optional), con modifica live tramite il server dell'organizzazione.
- **Una libreria di risorse condivisa.** Risorse caricate, raccolte e librerie collegate, con regole di accesso, versioni e revisione.
- **Revisione e consegna.** Passaggi di approvazione, link gestiti con scadenza o revoca e consegna a destinazioni consentite dall'organizzazione.
- **Amministrazione.** Un record di audit delle azioni soggette a regole e report sull'utilizzo secondo la policy di telemetria dell'istanza per i client che inviano eventi di utilizzo. Le app di Lolly oggi non ne inviano.
:::

Per configurare il servizio, parti da [Distribuzione](/info/deployment.html#organisation-services-with-lolly-work). La demo pubblica su [lolly.work](https://lolly.work) è un ambiente di prova. Usa l'indirizzo della tua organizzazione per il lavoro che devi conservare.

<!--i:eti-palette-->
## Il brand di un'altra organizzazione

Un partner, un cliente o uno sponsor può inviarti il proprio brand come file di design system (`.lolly`) invece di un indirizzo. Aprire quel file non connette l'app a nulla. Il file aggiunge il suo design system accanto al tuo su questo dispositivo. Un file di configurazione della tua organizzazione connette l'app al Lolly dell'organizzazione. Prima che cambi qualcosa, l'anteprima mostra cosa farà l'apertura di un file. [Lavorare con i partner](/info/partners.html) tratta entrambi i lati del lavoro con il brand di un'altra organizzazione.

<!--i:eti-unlink-->
## Uscire

**Leave**, sulla card **Lolly instance** in **Settings**, rimuove il design system, gli strumenti e il catalogo della tua organizzazione. Il tuo lavoro resta. Tutto ciò che hai creato con i suoi strumenti non si aprirà più finché non ti riconnetti. Dove il Lolly della tua organizzazione lo offre, **Sign out everywhere** sulla stessa card termina le tue sessioni su ogni dispositivo, compreso questo.

Tutto ciò che hai salvato nell'organizzazione resta all'organizzazione, secondo le sue policy di accesso e conservazione. Uscire o cancellare i dati di questo dispositivo non elimina quella copia sul server. In un browser all'indirizzo della tua organizzazione non c'è nulla da cui uscire: apri invece un indirizzo diverso.

<!--i:eti-help-->
## A chi chiedere

Cosa raggiunge il server della tua organizzazione, chi può vedere i suoi progetti condivisi e quali impostazioni sono fisse sono decisioni della tua organizzazione. Chiedi a chi gestisce il Lolly della tua organizzazione. [Privacy](/info/privacy.html) spiega cosa fa Lolly con i tuoi dati.
