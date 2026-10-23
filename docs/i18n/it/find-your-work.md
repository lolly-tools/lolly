# Trova e recupera il tuo lavoro

Manca qualcosa: un design che non hai mai salvato, un file che hai scaricato, la versione della settimana scorsa, o tutto dopo che il browser è stato svuotato. Parti dalla tabella, poi segui la sezione a cui rimanda.

Il lavoro personale resta nel browser o nell'app in cui l'hai creato, su quel dispositivo, a meno che tu non attivi [Sync](/info/sync.html). Un'organizzazione che usa Lolly Work facoltativo conserva anche **Team projects** sul proprio server, trattati più sotto.

| Cosa hai fatto | Dove guardare |
|---|---|
| Hai premuto **Salva come** o **Salva** | **Progetti** |
| Hai premuto **Scarica** | I download del tuo browser, e una copia in **Risorse** |
| Nessuna delle due, in uno [strumento che salva mentre lavori](#which-tools-save-as-you-work) | **Progetti** e **Cronologia** |
| Nessuna delle due, in uno strumento che non lo fa | Solo la scheda in cui hai lavorato, finché non la chiudi |
| L'hai eliminato nell'app | **Cestino**, in **Progetti**, **Risorse** o **Impostazioni → Spazio di archiviazione**, per 30 giorni |

::: figure find-your-work-places
Dove vive il tuo lavoro: l'archiviazione del browser contiene Projects, History e Trash; i download vanno nelle cartelle del tuo dispositivo; Sync e un file di backup sono le copie fuori dal browser.
:::

::: details Trovare il lavoro condiviso in Lolly Work (facoltativo)
Apri il Lolly della tua organizzazione e accedi, poi guarda in **Projects → Team projects**. Le sessioni condivise sono conservate da quell'istanza e compaiono in base al tuo accesso. Accedere può ripristinare l'accesso a quelle sessioni su un altro dispositivo; non ripristina la tua libreria personale né il backup del dispositivo.

In una [collab di lavoro](/info/collaborate.html#work-collabs-with-lolly-work-optional), attendi **Saved to work** prima di uscire. Se manca un progetto condiviso, verifica di essere collegato all'istanza giusta e chiedi al suo operatore informazioni su accesso o conservazione. Cancellare i dati del browser rimuove le copie locali, non la copia sul server dell'organizzazione. Vedi [Use Lolly at your organisation](/info/organisation.html).
:::

## Trova qualcosa che hai salvato

1. Premi **Home** in alto a sinistra nello strumento.
2. Apri la scheda **Progetti** in cima alla schermata iniziale (l'icona cartella su un telefono).
3. Guarda nella prima schermata. Il lavoro salvato in **La mia libreria** è lì, e ogni progetto è una cartella. Per cercare in tutte le cartelle insieme, digita in **Cerca in tutti i progetti…** in fondo alla schermata.

Un elemento prende il nome dal nome file che hai digitato nel pannello di esportazione, o dal suo strumento, come **QR Code**, se non ne hai digitato nessuno. Apri l'elemento e ogni impostazione è tornata, pronta per essere modificata ed esportata di nuovo. Per conservare così il lavoro nuovo, vedi [Saving & continuing](/info/using.html#saving-continuing).

::: note Non è in Progetti?
- Potrebbe essere nel **Cestino**: vedi [Recupera qualcosa che hai eliminato](#get-back-something-you-deleted).
- Un altro browser, una finestra privata o un altro dispositivo iniziano vuoti, a meno che tu non usi la [Sincronizzazione](/info/sync.html) o [sposti il tuo lavoro su un altro dispositivo](#move-your-work-to-another-device).
- Se hai premuto solo **Scarica**, vedi [Trova un file che hai scaricato](#find-a-file-you-downloaded).
:::

::: details Lavorare con Progetti
Puoi anche aprire **Progetti** da **Impostazioni → Spazio di archiviazione → Sessioni salvate → Organizza nei Progetti**. Funziona come un gestore di file:

![Progetti prima che si salvi qualcosa: i riquadri Nuova cartella, Nuovo asset e Modelli, l'orologio di History in alto a destra e la barra Cerca in tutti i progetti in fondo](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **Cartelle annidate.** Raggruppa le sessioni salvate in cartelle, e cartelle dentro cartelle, a qualsiasi profondità. Crea una cartella, rinominala o trascina un riquadro su un'altra cartella per spostarlo; un breadcrumb ti riporta in su. Le sessioni salvate senza cartella compaiono direttamente alla radice di **Projects**.
- <!--i:clock--> **Ordina a modo tuo.** **View options**, il pulsante a cursori in alto a destra, offre **Grid** o **List** e ordina per **Name**, **Date added**, **Last modified** (il predefinito), **Size** e, dentro una cartella, **By tool**. Le cartelle vengono sempre per prime qualunque ordinamento sia attivo - l'ordinamento ordina solo le sessioni e le cartelle all'interno del proprio gruppo.
- <!--i:document--> **Archivia il lavoro nuovo direttamente.** **New asset** apre il selettore condiviso. Scegli **Templates** per partire da un template salvato: aprilo per modificarlo, oppure usa **+ Add** per salvare subito una nuova creazione.
- <!--i:checklist--> **Selezione multipla (desktop).** Spunta la casella di un riquadro, trascina un riquadro di selezione su uno spazio vuoto oppure fai **Shift/Cmd-clic**; fai **clic destro** su un riquadro per il suo menu contestuale. La barra di selezione offre quindi **Render selection**, **Move to…**, **New folder**, **Delete** (che sposta nel Cestino), **Edit together** per da due a otto sessioni di un solo strumento, affiancate sotto una sola barra laterale, ed **Edit as sheet**, che apre una selezione di qualsiasi dimensione o mix come righe nella griglia batch.
- <!--i:download--> **Esegui il rendering di un'intera cartella o selezione.** **Render folder** esporta ogni sessione salvata in una cartella - comprese le sottocartelle - come un unico `.zip` annidato. **Render selection** fa lo stesso per qualsiasi selezione multipla, e una singola sessione viene renderizzata direttamente nel proprio file.
- <!--i:link--> **Vai dritto al lavoro salvato di uno strumento.** Spunta uno o più strumenti nella galleria Tools e scegli **View sessions** dalla barra di selezione - Projects si apre mostrando solo le sessioni create con quegli strumenti, con un **Clear** per tornare alla vista completa.
- <!--i:link--> **Condividi una sessione salvata.** Fai clic destro su una sessione (su un telefono, premi **•••** sul suo riquadro) → **Share link** per copiare un link che la riapre con le stesse impostazioni; le immagini del tuo dispositivo non viaggiano con un link (per la finestra Share completa: vedi [Sharing your work](/info/using.html#sharing-your-work)).
- <!--i:pentool--> **Rinominane o copiane una.** Fai clic destro su una sessione (su un telefono, premi **•••** sul suo riquadro) per **Rename**, **Duplicate** (una copia nella stessa cartella) e **Move to…**.

![Il popover delle opzioni di visualizzazione in Progetti: Layout con Griglia ed Elenco, e Ordina per impostato su Ultima modifica, accanto a un pulsante che inverte l'ordine](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
<!--
SHOT NOTE (misc-projects-sort): trigger button confirmed as
`.filter-fab.projects-viewopts` in views/projects.ts (openViewOpts() is bound
to `.projects-viewopts` specifically) - `.projects-viewopts` alone is the
more specific hook, so that's what drives the click. The popover it opens
(`.projects-viewmenu`, also confirmed directly in openViewOpts()) is body-
appended, not nested under the Projects root, so cropSelector finds it
regardless. "By tool" only appears inside a folder - this recipe captures at
the Projects ROOT (`url=/#/p`), so if the capture pass wants "By tool"
visible too, point url= at a real folder instead: the route is a path
segment, `/#/p/<folderId>` (confirmed in main.ts's hash router - `parts[0]
=== 'p'` reads `folderId` from `parts[1]`), not a query param. Caveat: a
folder has to already EXIST in the capture profile, which a per-shot fresh
context has none of.
The popover (views/projects-view-options.ts, checked 2026-09-26) holds a
Layout pair (Grid / List) and a Sort by menu with a reverse button; the
options inside the menu (Name, Date added, Last modified, Size, By tool) are
not visible in the closed menu, so the alt does not list them.
-->

:::

## Se hai chiuso la scheda o hai lasciato lo strumento

Ciò che torna dipende da come sei uscito e da quale strumento hai usato:

- **Hai chiuso la scheda, o sei tornato un'altra volta.** Il lavoro non salvato è perso, tranne negli [strumenti che salvano mentre lavori](#which-tools-save-as-you-work): apri quel lavoro da **Projects**.
- **Hai ricaricato la pagina nella stessa scheda.** Le tue impostazioni tornano dall'indirizzo della pagina. Negli strumenti che non salvano mentre lavori, le immagini e i file che hai aggiunto dal tuo dispositivo, e il testo su una riga più lungo di 150 caratteri, non tornano, perché l'indirizzo non li contiene.
- **Hai premuto Home, o il pulsante indietro in alto a sinistra.** Se hai modificato qualcosa dall'ultima volta che hai salvato, scaricato o copiato, una finestra **Unsaved edits** chiede se salvare prima. **Save & leave** salva il lavoro e ti porta a **Projects**, o di nuovo alla cartella del progetto da cui hai aperto il lavoro. **Leave anyway** scarta le tue modifiche: un elemento salvato torna a com'era quando l'hai salvato per ultimo, e una creazione che non hai mai salvato lascia **Projects**. **Cancel** ti tiene nello strumento.

Lolly chiede solo quando premi **Home** o il pulsante indietro in uno strumento. Chiudere la scheda, ricaricare e il pulsante Indietro del tuo browser non chiedono mai. Per essere sicuro, premi **Salva come**, oppure **Salva** nel pannello di esportazione, prima di lasciare uno strumento.

Quando il recupero automatico non è disponibile, una nota accanto ai controlli di modifica dice cosa conservare:

- In uno strumento che lavora su un file che porti tu, salva le impostazioni e conserva anche i file originali.
- In uno strumento di registrazione, o in un'utility senza azione Save, salva o scarica il risultato prima di uscire.
- Le app desktop e mobile dicono quando devi salvare a mano.
- In una collaborazione privata, la persona che ha invitato conserva il documento e la sua cronologia, comprese le modifiche dell'altra persona. Chi si è unito lavora su una copia temporanea e dovrebbe salvare una copia separata prima che la sessione finisca.

::: note Sei uscito senza salvare per sbaglio?
Negli strumenti che salvano mentre lavori, la Cronologia conserva una copia delle modifiche scartate. Apri la pagina **Cronologia**, trovale sotto **Modifiche** e premi **Apri come copia**. Negli altri strumenti le modifiche sono perse.
:::

::: details Quali strumenti salvano mentre lavori
Nell'app web, ogni strumento che crea un documento salva mentre lavori: Design, Chart, QR Code, Text, Sandbox e il resto. Questi strumenti non lo fanno:

- strumenti che lavorano su un file che porti tu, come Redact, Sign o Convert Image, perché Lolly non conserva mai una copia di quel file;
- strumenti che registrano dalla tua camera, dal microfono o dallo schermo, come Record, Screen Capture e Voice Recorder;
- uno strumento senza nulla da modificare, come Countdown.

Negli altri strumenti, la tua prima modifica archivia il lavoro in **Projects** come se avessi salvato, e le modifiche successive vengono conservate mentre lavori una volta che lo strumento ha finito di disegnare. Una creazione non salvata è ancora in Projects dopo che chiudi la scheda, e si riapre con le sue modifiche contrassegnate come non salvate.

**Leave anyway** scarta comunque quelle modifiche, e History conserva una copia delle modifiche scartate per 30 giorni. Riaprire lo strumento dalla schermata iniziale avvia una nuova creazione; apri quella precedente da Projects.

3D e Darkroom salvano mentre lavori, ma non conservano un file che carichi al loro interno, come un modello 3D o una LUT. History e **Save** conservano il nome, il tipo e la dimensione del file, non il file. Quando riapri il lavoro, una nota dice quale file era, e lo strumento funziona senza di esso finché non lo carichi di nuovo. Conserva i tuoi file originali.

Con la [Sincronizzazione](/info/sync.html) attiva, una creazione archiviata in questo modo arriva sui tuoi altri dispositivi come qualsiasi altra cosa in Progetti. Le sue versioni restano sul dispositivo su cui sono state fatte.

Se una creazione è aperta in due schede e salvi in entrambe, viene conservato l'ultimo salvataggio. Il lavoro che ha sostituito non va perso: si trova sotto **Bozze protette** nella Cronologia della creazione, con **Apri bozza come copia**.

Questo funziona solo nell'app web, non nelle app desktop o mobili, e non mentre lavori dal vivo con qualcun altro.
:::

## Trova un file che hai scaricato

In un browser, **Scarica** consegna il file al tuo browser, che lo salva nella sua cartella di download (di solito **Download**) o ti chiede dove. Lolly non sa dove sia finito il file, quindi guarda nell'elenco dei download del tuo browser.

Se non è comparso nessun file, guarda nel pannello di esportazione mentre sei ancora nello strumento. Sotto **Scarica**, una riga indica il nome del file e l'ora, con **Retry download**, e in Chrome, Edge e altri browser basati su Chromium **Save file…** per scegliere tu stesso una cartella. La riga e il suo file durano finché non lasci lo strumento, ricarichi o esporti di nuovo.

Lolly conserva anche due cose dopo ogni download:

- **Una copia del file**, in **Risorse** sotto **I tuoi caricamenti**, finché **Salva i miei render nella mia libreria** è attivo sotto **Impostazioni → I tuoi render** (**Impostazioni** è in fondo alla schermata iniziale). L'impostazione parte attiva. Un video, o un file di oltre 50 MB, chiede prima, e uno zip non viene copiato.
- **Le impostazioni che hai usato**, per i tuoi ultimi 24 download. **Esportazioni recenti**, sotto il tuo lavoro salvato in **Progetti**, riapre lo strumento con quelle impostazioni così puoi rifare il file, anche se le immagini e i file che hai aggiunto dal tuo dispositivo non sono inclusi. Lo stesso elenco è sotto **Impostazioni → Attività e statistiche → Ultime esportazioni** e nella scheda **Changes** di **History**. Questo elenco conserva le impostazioni, non i file.

::: details Nelle app desktop e mobili
- **App desktop:** **Scarica** salva direttamente in una cartella **Lolly** dentro la tua cartella **Download**, senza finestra di dialogo. La riga sotto **Scarica** indica dove è finito, come "Salvato in Downloads/Lolly", con **Mostra nella cartella**. **Open Exports Folder**, nel menu **Window** o **Exports**, apre la cartella in qualsiasi momento. Un file con lo stesso nome di uno precedente viene salvato come "nome (1)".
- **iPhone e iPad:** il file viene salvato nell'app **File**, sotto **Lolly**, e si apre il foglio di condivisione così puoi inviarlo. La riga sotto **Scarica** riporta "Salvato in File → Lolly".
- **Android:** si apre il menu di condivisione così puoi scegliere dove va il file.

Su iPhone, iPad e Android, un file nuovo sostituisce uno precedente con lo stesso nome.
:::

## Torna a una versione precedente

- **Durante questa visita:** **Annulla** torna indietro attraverso le tue ultime 100 modifiche, finché non lasci lo strumento o ricarichi. Vedi [Annulla e ripeti](/info/using.html#undo-and-redo).
- **Negli [strumenti che salvano mentre lavori](#which-tools-save-as-you-work):** le versioni precedenti di ogni creazione vengono conservate. Segui i passaggi qui sotto.
- **Tutto sul dispositivo:** con la [Sincronizzazione](/info/sync.html) attiva, **Restore an earlier copy**, sotto **Impostazioni → Servizi connessi**, recupera una delle ultime sette copie giornaliere, o la copia precedente alla tua ultima applicazione. Tutto su questo dispositivo corrisponde allora a quella copia, non solo un design.

Per aprire una versione precedente:

1. Premi **Cronologia**, il pulsante a forma di orologio accanto a **Annulla** e **Ripeti**. In Design, **Cronologia** è nella barra superiore; su un telefono, premi **•••** e poi **Cronologia**. Negli strumenti senza **Annulla**, come Text e Sandbox, **Cronologia** è accanto a **Home** in alto a sinistra.
2. Trova la versione dalla sua data e ora. Le righe **Punto di controllo automatico** vengono prese mentre lavori; le righe **Versione salvata** sono i momenti in cui hai salvato.
3. Premi **Apri come copia**. La versione si apre come una nuova creazione, e quella che avevi aperta resta com'era. La copia è in **Progetti**, con "(copy)" dopo il suo nome.

Per conservare una versione con un nome, premi **Name version**, digita un nome e premi **Keep milestone**. Le versioni con nome sono elencate nella pagina **History**, sotto **Milestones**.

::: details Il pannello History e la pagina History
Il pannello **History** elenca anche righe **Recovered work**, e **Protected drafts** conserva le tue ultime modifiche tra un checkpoint e l'altro, con **Open draft as a copy**. **Compare** e **Check assets** ti aiutano a scegliere prima di aprire una copia. Passa da **This creation** a **All history on this device** per vedere ogni creazione.

I checkpoint automatici si diradano con il tempo: uno al minuto per l'ultima ora, uno all'ora per l'ultimo giorno, uno al giorno per 30 giorni, poi uno alla settimana. Le versioni salvate e le versioni con nome vengono conservate tutte. Eliminare una creazione sposta anche le sue versioni nel **Cestino**, ed **Elimina per sempre** le rimuove.

Quando lo spazio della Cronologia si riempie, vengono rimossi per primi i checkpoint automatici più vecchi delle creazioni che non hai aperto da 30 giorni. Un salvataggio viene sempre conservato, anche in questo caso: viene scritto come il lavoro attuale, e la Cronologia indica che questo salvataggio non viene conservato come versione. **Impostazioni → Spazio di archiviazione** mostra quanto usa la Cronologia.

La pagina **History** (`#/history`) copre ogni creazione in questo browser. Per aprirla, premi il pulsante a forma di orologio in alto a destra nella schermata iniziale o in **Projects**, scegli **Saved sessions** nel menu del profilo (su un telefono, il pulsante tondo con il logo in alto a destra), oppure premi **Open app history** nel pannello History di uno strumento. Le app desktop e mobile non hanno una pagina History, quindi lì il pulsante a orologio della schermata iniziale e **Saved sessions** aprono invece **Your recent work**: le tue ultime sessioni salvate ed esportazioni, con un link a Projects.

- **Recent** elenca le tue creazioni, le più recenti per prime, con **Resume**.
- **Changes** mette i checkpoint, i download e i risultati di Convert su un'unica timeline. Un download ha **Reopen settings**.
- **Milestones** elenca le versioni con nome.

Filtra per progetto, strumento e data (dietro **Filters** su un telefono). La pagina History non ha un pulsante per eliminare; per rimuovere un elemento, usa Progetti.
:::

## Sposta il tuo lavoro su un altro dispositivo

| Per | Usa |
|---|---|
| Tenere i tuoi dispositivi allineati | **Sincronizza tra i dispositivi**, sotto **Impostazioni → Servizi connessi**: vedi [Sincronizza i tuoi dispositivi](/info/sync.html) |
| Spostare tutto in una volta | **Esporta i miei dati** e **Importa dati…**, più sotto |
| Consegnare un design o un progetto | Un file `.lolly`: **Esporta**, poi **Condividi**, poi **Download .lolly**; per un intero progetto, **Download project (.lolly)** nel menu della cartella. Premi **Apri** sull'altro dispositivo. Vedi [Il file .lolly](/info/using.html#the-lolly-file) |

Un link di condivisione porta le tue impostazioni, ma non le immagini o i file che hai aggiunto dal tuo dispositivo.

::: note L'importazione non aggiunge né elimina nulla
Le cartelle, i preferiti e i template nel file vengono aggiunti accanto a quelli già presenti sull'altro dispositivo. Quando un elemento salvato è presente su entrambi, viene mantenuta la copia salvata più di recente. I tuoi dati e le tue impostazioni su quel dispositivo restano come sono; quelli vuoti vengono compilati dal file. **Portalo su questo dispositivo**, nella Sincronizzazione, funziona allo stesso modo.
:::

Per spostare tutto in una volta:

1. Sul vecchio dispositivo, apri **Impostazioni → Spazio di archiviazione** e, sotto **Sposta su un altro dispositivo**, premi **Esporta i miei dati**. Lolly scarica un file `.zip` il cui nome inizia con `LollyTools-`.
2. Porta il file con te via USB, email a te stesso, AirDrop o una cartella condivisa.
3. Sul nuovo dispositivo, apri **Impostazioni → Spazio di archiviazione**, premi **Importa dati…**, scegli il file e premi **Importa**.

::: note Cosa resta indietro
Gli accessi, le chiavi e la passphrase di sincronizzazione restano su ogni dispositivo. L'elenco dei download recenti, i download offline e i modelli AI non viaggiano per nessuna via. La cronologia delle versioni viaggia solo in un file di **Esporta i miei dati**, non tramite la Sincronizzazione o un `.lolly`. Quando la cronologia è troppo grande per un unico file, i checkpoint automatici più vecchi vengono esclusi e la riga di esportazione indica quanti. Una copia che la Sincronizzazione conserva nel tuo storage può essere scaricata e aperta, oppure scelta in **Importa dati…**, come un file di backup; una copia cifrata chiede la tua passphrase.
:::

::: details Cosa contiene il file di backup
Il file si chiama `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (le parti del nome provengono dal tuo profilo e vengono omesse se non impostate; `<n>` è un contatore giornaliero così le esportazioni dello stesso giorno non collidono). Contiene il tuo profilo, con le tue cartelle, Cestino, template e preferiti; ogni sessione salvata con la sua miniatura; le tue immagini caricate, i font, i loghi e le copie dei tuoi download; i tuoi sistemi di design; le tue preferenze (tema, larghezza della barra laterale, statistiche di attività locali); versioni salvate e risultati di Convert; e, dall'app web, la cronologia delle versioni delle tue creazioni.

La cache del catalogo non è inclusa: si riscarica da sola sul nuovo dispositivo. Ogni parte ha un checksum, quindi un file danneggiato durante il trasferimento viene individuato all'importazione invece di essere ripristinato a metà. Le sessioni salvate si ricollegano automaticamente alle tue immagini importate. Le app web, desktop e mobile leggono lo stesso file; l'app da terminale scrive un backup più semplice tutto suo, che questo formato non legge. **Export my data & render everything** crea lo stesso file più un secondo zip con ogni sessione salvata renderizzata nel suo output. (Specifica completa del formato: [Data transfer](/info/data-transfer.html).)
:::

## Se cancelli i dati del browser

Nell'app web, Lolly conserva tutto nello storage del tuo browser per questo sito: lavoro salvato, immagini, font, sistemi di design, cronologia delle versioni e download offline. Cancellare i dati di questo sito nel tuo browser rimuove tutto questo, e Lolly non può recuperarne nulla. Ciò che resta è ciò che è già uscito dal browser: i file che hai scaricato, un file di **Esporta i miei dati**, una copia di [Sincronizzazione](/info/sync.html) e i link che hai condiviso.

::: warning Prima di cancellare i dati del browser
Premi **Esporta i miei dati** sotto **Impostazioni → Spazio di archiviazione**, e conserva il file altrove.
:::

All'avvio dell'app, Lolly chiede al browser di non cancellare la propria archiviazione quando il dispositivo resta a corto di spazio, e il browser decide. In **Settings → Available offline**, una riga che inizia con **Protected** significa che il browser ha accettato. "The browser may clear downloads if the device runs low on space" significa che non ha accettato, e **Protect downloads** lo richiede di nuovo.

Se il browser non ha accettato, può cancellare il lavoro salvato oltre ai download quando lo spazio scarseggia, quindi conserva un file **Export my data** recente.

**Impostazioni → Spazio di archiviazione** mostra quanto spazio usa ogni tipo di dato. La sua riga **Cronologia** conta i checkpoint automatici, le loro anteprime e le bozze di recupero; **Rimuovi i checkpoint automatici più vecchi di 30 giorni** libera quello spazio e conserva le versioni salvate e con nome. **Svuota cache** elimina i file di catalogo scaricati, che si riscaricano quando servono. **Cancella tutti i miei dati** ti chiede di digitare una parola, disattiva la Sincronizzazione, poi rimuove tutto ciò che Lolly conserva in questo browser: il tuo profilo e le impostazioni, le sessioni salvate con la loro cronologia e il Cestino, i caricamenti, i font e i sistemi di design, il registro dei download, i risultati di Convert, i modelli AI scaricati e le copie offline. I file che hai scaricato restano dove li hai salvati. L'app riparte poi come alla prima visita.

![La scheda dell'archiviazione su uno schermo largo quanto un telefono: ogni categoria di dati sul dispositivo indicata per nome, con il pulsante Clear all my data in fondo](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Nelle app desktop e mobili, le sessioni salvate sono file nella cartella dati propria dell'app e il resto è nello storage proprio dell'app, quindi cancellare un browser web non le tocca.

::: details Dove le app desktop e mobili conservano le sessioni salvate
Un file per sessione salvata, in una cartella `saved-state`:

- macOS: `~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows: `%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux: `~/.local/share/tools.lolly.Desktop/saved-state/`, o lo stesso percorso sotto `$XDG_DATA_HOME`
- iPhone, iPad e Android: dentro lo storage proprio dell'app, che l'app File non mostra

Le immagini, i sistemi di design e l'elenco dei download recenti restano nello storage interno dell'app, non in queste cartelle. L'app da terminale e la riga di comando leggono la stessa cartella `saved-state`: vedi [Dove vivono le sessioni salvate](/info/cli-reference.html#where-saved-sessions-live).
:::

## Recupera qualcosa che hai eliminato

Eliminare una sessione salvata, una cartella, uno dei tuoi caricamenti o uno dei tuoi font nell'app la sposta nel **Cestino** per 30 giorni, ovunque tu la elimini: **Progetti**, **Risorse**, **Impostazioni → Spazio di archiviazione** o l'elenco delle sessioni salvate di uno strumento. Una cartella va con tutto ciò che contiene, come un'unica voce, e una sessione mantiene la sua cronologia delle versioni finché resta lì. Subito dopo, un messaggio offre **Annulla**. In seguito:

1. Apri **Cestino**: il riquadro **Cestino** in **Progetti**, il pulsante **Cestino** in **Risorse → I tuoi caricamenti**, oppure la riga **Cestino** in **Impostazioni → Spazio di archiviazione**. Tutti e tre aprono lo stesso elenco.
2. Premi **Ripristina** accanto all'elemento. Torna alla sua cartella, e un font recupera i ruoli che aveva nel suo sistema di design.

**Elimina per sempre** rimuove un elemento in modo definitivo. **Svuota il cestino** chiede prima conferma, poi rimuove ogni elemento nel Cestino. Gli elementi più vecchi di 30 giorni vengono rimossi in modo definitivo.

::: warning Alcune eliminazioni sono immediate
Eliminare un sistema di design, un logo o la tua foto profilo non va nel Cestino. Anche la riga di comando e l'app da terminale eliminano all'istante.
:::

Con la [Sincronizzazione](/info/sync.html) attiva, **Restore an earlier copy** può recuperare lo stato di un giorno precedente dell'intero dispositivo, e un file di **Esporta i miei dati** recupera ciò che contiene il file.
