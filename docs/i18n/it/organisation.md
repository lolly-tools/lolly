# Usa Lolly nella tua organizzazione

La tua organizzazione può gestire il proprio Lolly: la stessa app, con gli strumenti e i design system che ha scelto. Questa pagina mostra come raggiungerlo, accedere e cosa cambia una volta fatto.

::: note Cosa ti serve dalla tua organizzazione
L'indirizzo web del suo Lolly, oppure un file di configurazione `.lolly` creato dalla tua organizzazione. lolly.tools da solo non si connette a nessuna organizzazione.
:::

## In un browser

Apri l'indirizzo che ti ha dato la tua organizzazione. Se la pagina ti chiede di accedere, premi **Sign in** e segui la pagina di accesso che si apre. Dopo funziona come qualsiasi Lolly, con gli strumenti e i design system della tua organizzazione.

Puoi anche partire da lolly.tools: apri **Settings**, nella scheda **Lolly instance** premi **Open a workspace**, inserisci l'indirizzo e premi **Open this instance**. Il browser va all'indirizzo della tua organizzazione, perché un browser non può caricare da lolly.tools gli strumenti di un altro Lolly.

![La scheda Lolly instance nelle Impostazioni, dove apri l'area di lavoro della tua organizzazione o cambi da dove l'app prende i suoi strumenti](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

## Nell'app desktop o mobile

L'app parte con i suoi strumenti inclusi. Per collegarti, apri **Settings** e premi **Change** nella scheda **Lolly instance**. Il foglio chiede **Where should Lolly get its tools?**

1. Scegli **Connettiti a un'istanza di Lolly**.
2. Inserisci l'indirizzo web della tua organizzazione e premi **Verifica e connetti**.
3. Premi **Usa questa istanza**. La schermata successiva, **Importa i tuoi dati (facoltativo)**, riporta il lavoro salvato da un backup di Lolly; premi **Salta** se non ne hai.
4. Accedi se l'app lo chiede.

Gli strumenti di un'istanza connessa vengono eseguiti con la stessa fiducia di quelli propri dell'app, quindi connettiti solo a un'istanza di cui ti fidi. La tua organizzazione può anche inviarti un file di configurazione `.lolly` che connette l'app al posto tuo.

Per cambiare più tardi, usa di nuovo **Change**, oppure **Leave** nella stessa scheda.

### Accedere con un codice

Nelle app desktop e mobile, la schermata di accesso offre anche un breve codice, quando il Lolly della tua organizzazione supporta l'accesso con codice. Premi **Open sign-in in browser**, accedi e approva il codice lì. Oppure apri l'indirizzo che mostra su un telefono o computer in cui hai già effettuato l'accesso, e inserisci il codice. Il codice dura circa dieci minuti.

## Cosa cambia lì

- **Alcuni controlli sono impostati per te.** Un controllo che la tua organizzazione governa mostra **Managed by** e il nome dell'organizzazione, oppure **Managed by your organisation**. Un controllo fisso non si può cambiare, un menu può offrire solo alcune delle sue scelte e una riga che inizia con **Set by** può indicare quale regola si applica e perché. Alcuni controlli non vengono mostrati affatto.
- **Alcuni design system sono bloccati.** Un design system fornito dalla tua organizzazione mostra un lucchetto e resta in sola lettura. Per provare delle modifiche, crea una copia modificabile in **Settings → Preferences → Design systems**.
- **Sono elencati solo i suoi strumenti.** Uno strumento che la tua organizzazione non offre non viene mostrato affatto.
- **Progetti condivisi.** Se la tua organizzazione condivide progetti con te, **Projects** mostra un riquadro **Team projects**. Queste sessioni risiedono sul server dell'organizzazione. Aprine una per lavorarci, oppure avvia una [collab di lavoro](/info/collaborate.html#work-collabs-with-lolly-work-optional) da **Share** quando disponibile.
- **Alcune esportazioni possono richiedere approvazione.** Dove la tua organizzazione richiede un'approvazione, **Request approval** prende il posto di **Download**, e uno strumento può offrire meno formati.

### Cosa resta dove

::: cols
## Su questo dispositivo

- I tuoi salvataggi, a meno che tu non attivi [Sync](/info/sync.html)
- I design system che hai creato tu
- Tutto ciò che crei e scarichi

## Sul server della tua organizzazione

- La tua identità di accesso e le informazioni sul dispositivo
- Progetti di team, sessioni condivise e modifiche live in una collab di lavoro
- Le risorse che carichi nella libreria condivisa
- Richieste di approvazione e consegne approvate
- Eventi d'uso, dove la tua organizzazione li attiva
:::

[Privacy](/info/privacy.html#organisation-services-with-lolly-work) elenca cosa conserva il server e chi controlla quei dati.

## Cosa aggiunge Lolly Work

Il server della tua organizzazione esegue **Lolly Work**, il software per organizzazioni dello stesso progetto open source. L'app non richiede né un account di lavoro né Lolly Work quando la usi da solo.

::: details Cosa può aggiungere Lolly Work
La tua organizzazione ospita [Lolly Work](https://github.com/lolly-tools/lolly-work) accanto a Lolly e sceglie quali funzioni attivare:

- **Accesso e permessi.** Single sign-on dell'organizzazione, permessi basati su gruppi e campi di profilo gestiti. Gli amministratori possono effettuare il provisioning e la disattivazione degli account tramite SCIM.
- **Lavoro condiviso.** Progetti di team, sessioni condivise e [collab di lavoro](/info/collaborate.html#work-collabs-with-lolly-work-optional), con modifica live attraverso il server dell'organizzazione.
- **Una libreria di risorse condivisa.** Risorse caricate, raccolte e librerie collegate, con regole di accesso, versioni e revisione.
- **Revisione e consegna.** Passaggi di approvazione, link gestiti con scadenza o revoca e consegna verso le destinazioni che l'organizzazione consente.
- **Amministrazione.** Report d'uso secondo la policy di telemetria dell'istanza, più un record di audit delle azioni governate.

Se stai configurando il servizio, parti da [Deployment](/info/deployment.html#organisation-services-with-lolly-work). La demo pubblica su [lolly.work](https://lolly.work) è una sandbox; per il lavoro che devi conservare usa l'indirizzo della tua organizzazione.
:::

## Uscire

**Leave**, nella scheda **Lolly instance** in **Settings**, rimuove il design system, gli strumenti e il catalogo della tua organizzazione. Il tuo lavoro resta. Tutto ciò che hai creato con i suoi strumenti non si aprirà più finché non ti ricolleghi.

Tutto ciò che hai salvato presso l'organizzazione resta all'organizzazione, secondo le sue policy di accesso e conservazione. Uscire o cancellare questo dispositivo non elimina quella copia sul server. In un browser all'indirizzo della tua organizzazione non c'è nulla da lasciare: apri invece un indirizzo diverso.

## A chi chiedere

Cosa raggiunge il server della tua organizzazione, chi può vedere i suoi progetti condivisi e quali impostazioni sono fisse sono decisioni della tua organizzazione. Chiedi a chi gestisce il Lolly della tua organizzazione. [Privacy](/info/privacy.html) copre cosa fa Lolly stesso con i tuoi dati.
