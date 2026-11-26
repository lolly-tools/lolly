# Trovare e recuperare il tuo lavoro

Trova un design che non hai mai salvato, un file che hai scaricato, la versione della settimana scorsa o il tuo lavoro dopo la cancellazione dei dati del browser. Parti dalla tabella.

Il lavoro personale resta nel browser o nell'app in cui l'hai creato, su quel dispositivo, a meno che tu non attivi [Sync](/info/sync.html). Un'organizzazione che usa Lolly Work, facoltativo, conserva anche i **Team projects** sul proprio server.

| Cosa hai fatto | Dove cercare |
|---|---|
| Hai premuto **Save as** o **Save** | **Projects** |
| Hai premuto **Download** | I download del browser e una copia in **Assets** |
| Nessuna delle due cose, in uno [strumento che salva mentre lavori](#which-tools-save-as-you-work) | **Projects** e **History** |
| Nessuna delle due cose, in uno strumento che non lo fa | Solo la scheda in cui hai lavorato, finché non la chiudi |
| L'hai eliminato nell'app | **Trash**, in **Projects**, **Assets** o **Settings → Storage**, per 30 giorni |

::: figure find-your-work-places
Dove si trova il tuo lavoro: l'archiviazione del browser contiene Projects, History e Trash; i download vanno nelle cartelle del dispositivo; Sync e un file di backup sono le copie esterne al browser.
:::

::: details Trovare il lavoro condiviso in Lolly Work (facoltativo)
Apri Lolly della tua organizzazione, accedi e cerca in **Projects → Team projects**. Quell'istanza contiene sessioni condivise e mostra quelle a cui hai accesso. Accedere su un altro dispositivo può ripristinare l'accesso a quelle sessioni. L'accesso non ripristina la tua libreria personale né il backup del dispositivo.

In una [collaborazione di lavoro](/info/collaborate.html#collabs-through-lolly-work-optional), aspetta **Saved to work** prima di uscire. Se manca un progetto condiviso, verifica di essere connesso all'istanza giusta e chiedi al suo operatore informazioni sull'accesso o sulla conservazione. Cancellare i dati del browser rimuove le copie locali, non la copia sul server dell'organizzazione. Vedi [Usare Lolly nella tua organizzazione](/info/organisation.html).
:::

<!--i:eti-search-->
## Trova qualcosa che hai salvato

1. Premi **Home** in alto a sinistra nello strumento.
2. Apri la scheda **Projects** in alto nella schermata iniziale (l'icona della cartella su un telefono).
3. Tutto ciò che hai salvato in **My library** è nella prima schermata. Ogni progetto è una cartella. Per cercare in tutte le cartelle, scrivi in **Search all projects…** in fondo alla schermata.

Un elemento prende il nome del file che hai digitato nel pannello di esportazione. Senza un nome file, prende il nome del suo strumento, ad esempio **QR Code**. Aprire l'elemento ripristina ogni impostazione. Per salvare un nuovo lavoro, vedi [Salvare & continuare](/info/using.html#saving-continuing).

::: note Non è in Projects?
- Potrebbe essere in **Trash**: vedi [Recupera qualcosa che hai eliminato](#get-back-something-you-deleted).
- Un altro browser, una finestra privata o un altro dispositivo partono vuoti, a meno che tu non usi [Sync](/info/sync.html) o [trasferisca il tuo lavoro](#move-your-work-to-another-device).
- Se hai premuto solo **Download**, vedi [Trova un file che hai scaricato](#find-a-file-you-downloaded).
:::

::: details Lavorare con Projects
Puoi anche aprire la vista **Projects** da **Settings → Storage → Saved sessions → Organise in Projects**. Funziona come un gestore di file:

![Projects prima che venga salvato qualcosa: i riquadri New folder, New asset e Templates, l'orologio di History in alto a destra e la barra Search all projects in basso](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **Cartelle annidate.** Metti le sessioni salvate in cartelle e le cartelle dentro altre cartelle, senza limiti di profondità. Crea o rinomina una cartella, oppure trascina un riquadro su una cartella per spostarlo. Un percorso di navigazione ti riporta ai livelli superiori. Le sessioni salvate senza cartella sono nella radice di **Projects**.
- <!--i:clock--> **Ordina come preferisci.** **View options**, il pulsante con i cursori in alto a destra, offre **Grid** o **List** e ordina per **Name**, **Date added**, **Last modified** (predefinito), **Size** e, dentro una cartella, **By tool**. Le cartelle vengono sempre prima. Sessioni e cartelle sono ordinate ciascuna nel proprio gruppo.
- <!--i:document--> **Archivia subito il nuovo lavoro.** **New asset** apre il selettore condiviso. Scegli **Templates** per partire da un template salvato. Apri il template per modificarlo, oppure premi **+ Add** per salvare subito una nuova creazione.
- <!--i:checklist--> **Selezione multipla (desktop).** Spunta la casella di un riquadro, trascina un rettangolo di selezione sullo spazio vuoto o fai **Shift/Cmd-clic**. Per il menu contestuale di un riquadro, fai **clic destro** sul riquadro. La barra di selezione offre **Render selection**, **Move to…**, **New folder** e **Delete** (in Trash). Il suo **Edit together** apre da due a otto sessioni di singoli strumenti affiancate sotto un'unica barra laterale. **Edit as sheet** apre una selezione di qualsiasi dimensione o composizione come righe nella griglia batch.
- <!--i:download--> **Renderizza un'intera cartella o selezione.** **Render folder** esporta ogni sessione salvata in una cartella e nelle sue sottocartelle come un unico `.zip` con la stessa struttura. **Render selection** fa lo stesso per una selezione multipla. Una singola sessione viene renderizzata nel proprio file.
- <!--i:link--> **Vai direttamente al lavoro salvato di uno strumento.** Seleziona uno o più strumenti nella galleria Tools e scegli **View sessions** dalla barra di selezione. Projects mostra quindi solo le sessioni create con quegli strumenti. **Clear** ripristina la vista completa.
- <!--i:link--> **Condividi una sessione salvata.** Fai clic destro su una sessione (su un telefono, premi **•••** sul suo riquadro) e scegli **Share link**. Il link riapre la sessione con le stesse impostazioni. Le immagini dal tuo dispositivo non viaggiano con un link. Per la finestra Share completa, vedi [Condividere il tuo lavoro](/info/using.html#sharing-your-work).
- <!--i:pentool--> **Rinomina o copia una sessione.** Lo stesso menu ha **Rename**, **Duplicate** (una copia nella stessa cartella) e **Move to…**.

![Il popover View options in Projects: Layout con Grid e List, e Sort by impostato su Last modified, accanto a un pulsante che inverte l'ordine](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
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

<!--i:eti-refresh-->
## Se hai chiuso la scheda o lasciato lo strumento

Ciò che viene ripristinato dipende da come sei uscito e dallo strumento:

- **Hai chiuso la scheda o sei tornato in un altro momento.** Il lavoro non salvato è perso, tranne negli [strumenti che salvano mentre lavori](#which-tools-save-as-you-work). Apri quel lavoro da **Projects**.
- **Hai ricaricato la pagina nella stessa scheda.** Le tue impostazioni vengono ripristinate dall'indirizzo della pagina. Negli strumenti che non salvano mentre lavori, l'indirizzo non contiene immagini e file dal tuo dispositivo né testo su una sola riga più lungo di 150 caratteri, quindi questi non vengono ripristinati.
- **Hai premuto Home o il pulsante Indietro in alto a sinistra.** Se hai cambiato qualcosa dall'ultimo salvataggio, download o copia, una finestra **Unsaved edits** chiede se vuoi prima salvare. **Save & leave** salva il lavoro e ti porta in **Projects**, oppure nella cartella del progetto da cui hai aperto il lavoro. **Leave anyway** scarta le modifiche. Un elemento salvato torna all'ultimo salvataggio e una creazione mai salvata viene rimossa da **Projects**. **Cancel** ti mantiene nello strumento.

::: warning La chiusura della scheda non chiede conferma
Chiudere la scheda, ricaricare e usare il pulsante Indietro del browser non richiedono mai conferma. Per sicurezza, premi **Save as**, oppure **Save** nel pannello di esportazione, prima di lasciare uno strumento.
:::

Quando il recupero automatico non è disponibile, una nota accanto ai controlli di modifica indica cosa conservare:

- In uno strumento che lavora su un file che fornisci tu, salva le impostazioni e conserva anche i file originali.
- In uno strumento di registrazione, o in un'utility senza azione Save, salva o scarica il risultato prima di uscire.
- Le app desktop e mobile indicano quando devi salvare manualmente.
- In una collaborazione privata, chi ha invitato conserva il documento e la sua cronologia, incluse le modifiche dell'altra persona. Chi si è unito lavora su una copia temporanea e dovrebbe salvare una copia separata prima che la sessione finisca.

::: note Sei uscito senza salvare per sbaglio?
Negli strumenti che salvano mentre lavori, History conserva una copia delle modifiche scartate per 30 giorni. Apri la pagina **History**, trovale in **Changes** e premi **Open as a copy**. Negli altri strumenti le modifiche sono perse.
:::

::: details Quali strumenti salvano mentre lavori
Nell'app web, ogni strumento che crea un documento salva mentre lavori, ad esempio Lolly Design, Lolly Chart, QR Code, Text e Lolly Sandbox. Questi strumenti non lo fanno:

- gli strumenti che lavorano su un file che fornisci tu, come Redact, Sign o Convert Image, perché Lolly non conserva mai una copia di quel file;
- gli strumenti che registrano da camera, microfono o schermo, come Record, Lolly Screen Capture e Lolly Voice Recorder;
- uno strumento senza nulla da modificare, come Countdown.

Negli altri strumenti, la prima modifica archivia il lavoro in **Projects** come se avessi salvato. Le modifiche successive vengono conservate quando lo strumento ha finito di disegnare. Una creazione non salvata resta in Projects dopo che chiudi la scheda e si riapre con le modifiche contrassegnate come non salvate.

**Leave anyway** scarta comunque quelle modifiche. Aprire di nuovo lo strumento dalla schermata iniziale avvia una nuova creazione; apri quella precedente da Projects.

3D e Lolly Darkroom salvano mentre lavori, ma non conservano un file che carichi al loro interno, ad esempio un modello 3D o una LUT. History e **Save** conservano nome, tipo e dimensione del file, non il file. Quando riapri il lavoro, una nota indica quale file, e lo strumento funziona senza di esso finché non lo carichi di nuovo. Conserva i file originali.

Con [Sync](/info/sync.html) attivo, una creazione archiviata in questo modo arriva sugli altri tuoi dispositivi. Le sue versioni restano sul dispositivo dove sono state create.

Se una creazione è aperta in due schede e salvi in entrambe, viene conservato l'ultimo salvataggio. Il lavoro sostituito si trova in **Protected drafts** nella History della creazione, con **Open draft as a copy**.

Funziona solo nell'app web, non nelle app desktop o mobile, né mentre lavori in tempo reale con qualcun altro.
:::

<!--i:eti-download-->
## Trova un file che hai scaricato

In un browser, **Download** passa il file al browser. Il browser salva il file nella sua cartella dei download (di solito **Downloads**) o ti chiede dove. Lolly non riceve informazioni su dove sia finito il file, quindi cerca nell'elenco dei download del browser.

Se non è apparso alcun file, guarda nel pannello di esportazione mentre sei ancora nello strumento. Sotto **Download**, una riga indica il nome del file e l'ora, con **Retry download**. In Chrome, Edge e altri browser Chromium, la riga offre anche **Save file…** per scegliere una cartella. La riga e il suo file restano finché non lasci lo strumento, ricarichi o esporti di nuovo.

Lolly conserva anche due cose dopo ogni download:

- **Una copia del file**, in **Assets** sotto **Your uploads**, mentre **Save my renders to my library** è attivo in **Settings → Your renders** (**Settings** è in fondo alla schermata iniziale). L'impostazione è attiva all'inizio. Un video o un file oltre 50 MB richiede prima conferma, e uno zip non viene copiato.
- **Le impostazioni che hai usato**, per gli ultimi 24 download. **Recent exports**, sotto il lavoro salvato in **Projects**, riapre lo strumento con quelle impostazioni. Immagini e file aggiunti dal tuo dispositivo non sono inclusi. Lo stesso elenco si trova in **Settings → Activity & stats → Latest exports** e nella scheda **Changes** di **History**.

::: details Nelle app desktop e mobile
- **App desktop:** **Download** salva in una cartella **Lolly** dentro la cartella **Downloads**, senza finestra di dialogo. La riga sotto **Download** indica dove è finito il file, ad esempio "Salvato in Downloads/Lolly", con **Show in folder**. **Open Exports Folder**, nel menu **Window** o **Exports**, apre la cartella in qualsiasi momento. Un file con lo stesso nome di uno precedente viene salvato come "name (1)".
- **iPhone e iPad:** il file viene salvato nell'app **Files**, sotto **Lolly**, e si apre il pannello di condivisione. La riga sotto **Download** riporta "Salvato in Files → Lolly".
- **Android:** si apre il menu di condivisione. Scegli dove va il file.

Su iPhone, iPad e Android, un nuovo file sostituisce quello precedente con lo stesso nome.
:::

<!--i:eti-history-->
## Torna a una versione precedente

- **Durante questa visita:** **Undo** torna indietro nelle ultime 100 modifiche, finché non lasci lo strumento o ricarichi. Vedi [Annulla e ripeti](/info/using.html#undo-and-redo).
- **Negli [strumenti che salvano mentre lavori](#which-tools-save-as-you-work):** vengono conservate le versioni precedenti di ogni creazione.
- **Tutto sul dispositivo:** con [Sync](/info/sync.html) attivo, **Restore an earlier copy**, in **Settings → Connected services**, ripristina una delle ultime sette copie giornaliere o la copia precedente all'ultima applicazione. Tutto su questo dispositivo corrisponde quindi a quella copia.

Per aprire una versione precedente:

1. Premi **History**, il pulsante con l'orologio accanto a **Undo** e **Redo**. In Lolly Design, **History** è nella barra superiore. Su un telefono, premi **•••** e poi **History**. Negli strumenti senza **Undo**, come Text e Lolly Sandbox, **History** è accanto a **Home** in alto a sinistra.
2. Trova la versione per data e ora. Le righe **Automatic checkpoint** vengono create mentre lavori; le righe **Saved version** corrispondono ai momenti in cui hai salvato.
3. Premi **Open as a copy**. La versione si apre come nuova creazione e quella che avevi aperto resta com'era. La copia è in **Projects**, con "(copia)" dopo il nome.

Per conservare una versione con un nome, premi **Name version**, digita un nome e premi **Keep milestone**. Le versioni con nome sono elencate nella pagina **History**, sotto **Milestones**.

::: details Il pannello History e la pagina History
Il pannello **History** elenca anche le righe **Recovered work**, e **Protected drafts** contiene le ultime modifiche tra un checkpoint e l'altro, con **Open draft as a copy**. **Lolly Compare** e **Check assets** ti aiutano a scegliere prima di aprire una copia. Passa da **This creation** a **All history on this device** per vedere ogni creazione.

I checkpoint automatici si diradano con il tempo: uno al minuto per l'ultima ora, uno all'ora per l'ultimo giorno, uno al giorno per 30 giorni, poi uno alla settimana. Tutte le versioni salvate e con nome vengono conservate. Eliminare una creazione sposta anche le sue versioni in **Trash**, e **Delete forever** le rimuove.

Quando lo spazio di archiviazione di History si riempie, vengono rimossi per primi i checkpoint automatici più vecchi delle creazioni che non apri da 30 giorni. Anche in quel caso, un salvataggio viene sempre conservato. Viene scritto come lavoro corrente, e History indica che questo salvataggio non è conservato come versione. **Settings → Storage** mostra quanto spazio usa History.

La pagina **History** (`#/history`) comprende ogni creazione in questo browser. Per aprire la pagina, premi il pulsante con l'orologio in alto a destra nella schermata iniziale o in **Projects**, scegli **Saved sessions** nel menu del profilo (su un telefono, il pulsante rotondo con il logo in alto a destra) oppure premi **Open app history** nel pannello History di uno strumento. Le app desktop e mobile non hanno una pagina History. Lì, il pulsante con l'orologio nella schermata iniziale e **Saved sessions** aprono **Your recent work**: le ultime sessioni salvate ed esportazioni, con un link a Projects.

- **Recent** elenca le tue creazioni, dalla più recente, con **Resume**.
- **Changes** riunisce checkpoint, download e risultati di Convert in un'unica timeline. Un download ha **Reopen settings**.
- **Milestones** elenca le versioni con nome.

Ogni creazione è un riquadro con la sua immagine. **Grid** o **List** cambia il layout. Filtra per progetto, strumento e data (dentro **Filters** su un telefono). Il menu di un riquadro (clic destro o pressione prolungata) offre **Resume**, **Versions**, **Show in Projects** e **Move to Trash**. Per rimuoverne diversi, selezionali e scegli **Move to Trash**, che offre Undo.
:::

<!--i:eti-folder-move-->
## Sposta il tuo lavoro su un altro dispositivo

| Per | Usa |
|---|---|
| Mantenere sincronizzati i tuoi dispositivi | **Sync across devices**, in **Settings → Connected services**: vedi [Sincronizza i tuoi dispositivi](/info/sync.html) |
| Spostare tutto una volta | **Export my data** e **Import data…**, sotto |
| Consegnare un design o un progetto | Un file `.lolly`: **Export**, poi **Share**, poi **Download .lolly**; per un intero progetto, **Download project (.lolly)** nel menu della cartella. Premi **Open** sull'altro dispositivo. Vedi [Il file .lolly](/info/using.html#the-lolly-file) |

Un link di condivisione porta con sé le tue impostazioni, ma non le immagini o i file aggiunti dal tuo dispositivo.

::: note L'importazione aggiunge e non elimina nulla
Le cartelle, i preferiti e i template nel file si aggiungono a quelli già presenti sull'altro dispositivo. Quando un elemento salvato è su entrambi, viene conservata la copia salvata più di recente. I tuoi dati e le impostazioni su quel dispositivo restano come sono. Quelli vuoti vengono compilati dal file. **Bring it to this device**, in Sync, funziona allo stesso modo.
:::

Per spostare tutto una volta:

1. Sul vecchio dispositivo, apri **Settings → Storage** e, sotto **Move to another device**, premi **Export my data**. Lolly scarica un file `.zip` il cui nome inizia con `LollyTools-`.
2. Trasferisci il file tramite USB, un'email a te stesso, AirDrop o una cartella condivisa.
3. Sul nuovo dispositivo, apri **Settings → Storage**, premi **Import data…**, scegli il file e premi **Import**.

::: note Cosa resta sul dispositivo
Accessi, chiavi e passphrase di sincronizzazione restano su ciascun dispositivo. L'elenco dei download recenti, i download offline e i modelli AI non vengono trasferiti in alcun modo. La cronologia delle versioni viaggia solo in un file **Export my data**, non tramite Sync o un `.lolly`. Quando la cronologia è troppo grande per un solo file, i checkpoint automatici più vecchi vengono esclusi e la riga di esportazione indica quanti. Puoi scaricare e aprire una copia che Sync conserva nel tuo spazio di archiviazione, oppure scegliere la copia in **Import data…**, come un file di backup. Una copia crittografata richiede la tua passphrase.
:::

::: details Cosa contiene il file di backup
Il file si chiama `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`. Le parti del nome provengono dal tuo profilo e vengono omesse se non sono impostate. `<n>` conta le esportazioni effettuate nello stesso giorno. Contiene il tuo profilo, con cartelle, Trash, template e preferiti; ogni sessione salvata con la sua miniatura; le immagini caricate, i font, i loghi e le copie dei download; i design system; le preferenze (tema, larghezza della barra laterale, statistiche di attività locali); le versioni salvate e i risultati di Convert; e, dall'app web, la cronologia delle versioni delle tue creazioni.

La cache del catalogo non è inclusa. Il nuovo dispositivo scarica di nuovo la cache. Ogni parte ha una somma di controllo, così l'importazione rileva un file danneggiato durante il trasferimento. Le sessioni salvate si ricollegano alle immagini importate. Le app web, desktop e mobile leggono lo stesso file. L'app da terminale scrive un proprio backup più semplice, che questo formato non legge. **Export my data & render everything** crea lo stesso file più un secondo zip con ogni sessione salvata renderizzata nel suo output. Il formato completo è descritto in [Trasferimento dei dati](/info/data-transfer.html).
:::

<!--i:eti-globe-->
## Se cancelli i dati del browser

Nell'app web, Lolly conserva tutto nello spazio di archiviazione del browser per questo sito: lavoro salvato, immagini, font, design system, cronologia delle versioni e download offline. Cancellare i dati di questo sito nel browser rimuove tutto, e Lolly non può recuperare nulla. Resta ciò che è già uscito dal browser: i file scaricati, un file **Export my data**, una copia di [Sync](/info/sync.html) e i link che hai condiviso.

::: warning Prima di cancellare i dati del browser
Premi **Export my data** in **Settings → Storage** e conserva il file altrove.
:::

Quando l'app si avvia, Lolly chiede al browser di non cancellare il proprio spazio di archiviazione quando il dispositivo ha poco spazio, e il browser decide. In **Settings → Available offline**, una riga che inizia con **Protected** significa che il browser ha accettato. "Il browser potrebbe cancellare i download se il dispositivo ha poco spazio" significa che non ha accettato, e **Protect downloads** ripete la richiesta.

Se il browser non ha accettato, potrebbe cancellare il lavoro salvato oltre ai download quando lo spazio scarseggia, quindi conserva un file **Export my data** recente.

**Settings → Storage** mostra quanto spazio usa ogni tipo di dato. La riga **History** conta i checkpoint automatici, le loro anteprime e le bozze di recupero. **Remove automatic checkpoints older than 30 days** libera quello spazio e conserva le versioni salvate e con nome. **Clear cache** elimina i file del catalogo scaricati, che vengono scaricati di nuovo quando servono. **Clear all my data** ti chiede di digitare una parola, disattiva Sync, poi rimuove tutto ciò che Lolly conserva in questo browser: profilo e impostazioni, sessioni salvate con la loro cronologia e Trash, caricamenti, font e design system, registro dei download, risultati di Convert, modelli AI scaricati e copie offline. I file scaricati restano dove li hai salvati. L'app si avvia quindi come alla prima visita.

![La card di archiviazione su uno schermo largo quanto un telefono: ogni categoria di dati sul dispositivo ha un nome, con il pulsante Clear all my data in basso](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Nelle app desktop e mobile, le sessioni salvate sono file nella cartella dati dell'app, e tutto il resto è nello spazio di archiviazione dell'app. Cancellare i dati di un browser web non li tocca.

::: details Dove le app desktop e mobile conservano le sessioni salvate
Un file per ogni sessione salvata, in una cartella `saved-state`:

- macOS: `~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows: `%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux: `~/.local/share/tools.lolly.Desktop/saved-state/`, oppure lo stesso percorso sotto `$XDG_DATA_HOME`
- iPhone, iPad e Android: nello spazio di archiviazione dell'app, che l'app Files non mostra

Immagini, design system ed elenco dei download recenti restano nello spazio di archiviazione interno dell'app, non in queste cartelle. L'app da terminale e la riga di comando leggono la stessa cartella `saved-state`: vedi [Dove si trovano le sessioni salvate](/info/cli-reference.html#where-saved-sessions-live).
:::

<!--i:eti-trash-->
## Recupera qualcosa che hai eliminato

Eliminare nell'app una sessione salvata, una cartella, uno dei tuoi caricamenti o uno dei tuoi font lo sposta in **Trash** per 30 giorni, ovunque tu lo elimini: **Projects**, **Assets**, **Settings → Storage** o l'elenco delle sessioni salvate di uno strumento. Una cartella e tutto il suo contenuto vanno in Trash come un'unica voce. Una sessione conserva la cronologia delle versioni in Trash. Subito dopo l'eliminazione, un messaggio offre **Undo**. Più tardi:

1. Apri **Trash**: il riquadro **Trash** in **Projects**, il pulsante **Trash** in **Assets → Your uploads** o la riga **Trash** in **Settings → Storage**. Tutti e tre aprono lo stesso elenco.
2. Premi **Restore** accanto all'elemento. Torna nella sua cartella, e un font riacquista i ruoli che aveva nel suo design system.

**Delete forever** rimuove un elemento definitivamente. **Empty Trash** chiede prima conferma, poi rimuove ogni elemento in Trash. Gli elementi più vecchi di 30 giorni vengono rimossi definitivamente.

::: warning Alcune eliminazioni sono immediate
Eliminare un design system, un logo o la foto del profilo non li sposta in Trash. Anche la riga di comando e l'app da terminale eliminano subito.
:::

Con [Sync](/info/sync.html) attivo, **Restore an earlier copy** può ripristinare lo stato dell'intero dispositivo di un giorno precedente, e un file **Export my data** ripristina ciò che contiene.
