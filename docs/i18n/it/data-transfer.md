# Trasferimento dei dati: il bundle `lolly-backup`

Un bundle di backup trasferisce la libreria personale che Lolly conserva sul dispositivo: esportalo da un'installazione, porta il file con te (USB, AirDrop, email a te stesso o una condivisione di rete) e importalo in un'altra. Esportazione e importazione non richiedono server e la destinazione può essere offline.

Questa è la specifica del formato per chi sviluppa shell, strumenti o script per i backup. Per trasferire il tuo lavoro, leggi [Sposta il tuo lavoro su un altro dispositivo](/info/find-your-work.html#move-your-work-to-another-device).

![I due pulsanti che trasferiscono un'intera installazione: Export my data scrive un unico zip, Import data lo rilegge](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

::: note Ambito
Un bundle contiene *dati utente*, non strumenti del catalogo. Gli strumenti e le risorse del catalogo si sincronizzano separatamente e si presume che siano presenti nella destinazione, nel peggiore dei casi a una versione superiore. Gli strumenti creati da un utente viaggiano all'interno di `profile.json`. L'importazione non installa né aggiorna mai uno strumento del catalogo.
:::

<!--i:eti-badge-check-->
## Obiettivi

- <!--i:box--> **Un formato, tutte le shell.** L'app web, le app desktop e mobile e le shell future condividono lo stesso contenitore e gli stessi schemi delle parti. Le parti facoltative dipendono dalle capacità di ogni shell e quelle non supportate vengono segnalate. Ogni bridge di funzionalità fornisce il proprio adattatore di archiviazione.
- <!--i:shieldcheck--> **Resiste al trasferimento.** Un bundle danneggiato o troncato durante il trasferimento genera un errore all'importazione e non viene mai ripristinato a metà.
- <!--i:clock--> **Dura oltre questa versione.** Un'app meno recente importa le parti di un bundle più recente che riconosce. Un formato incompatibile viene rifiutato senza problemi.
- <!--i:check--> **Unione sicura.** L'importazione in un'installazione già in uso non cancella mai nulla che non fosse nel bundle.

<!--i:eti-package-->
## Il contenitore

Un bundle è un normale `.zip`. Resta intatto con qualsiasi mezzo di trasporto e qualsiasi strumento di decompressione può esaminarne il contenuto.

Il download prende il nome dal suo proprietario: `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, per esempio `LollyTools-Ada-Lovelace-2026-06-26-1.zip`. Nome e cognome provengono dal profilo e vengono esclusi quando non sono impostati: senza profilo si ottiene `LollyTools-2026-06-26-1.zip` e con il solo nome `LollyTools-Ada-2026-06-26-1.zip`. Ogni nome diventa un token adatto ai nomi di file (lettere e cifre Unicode mantenute, spazi e punteggiatura rimossi, al massimo 32 caratteri). `<n>` è una sequenza per giorno e per dispositivo, quindi le esportazioni ripetute nello stesso giorno non entrano in conflitto e restano in ordine. `backupFilename()` in `data-transfer.ts` costruisce il nome. Il nome non cambia il contenuto dello zip.

| Percorso | Obbligatorio | Contenuto |
|---|---|---|
| `manifest.json` | sì | Id del formato, versioni, conteggi e integrità per ogni parte. Un lettore legge prima questo file. |
| `profile.json` | quando impostato | Il record `me` dell'utente: nome, contatto, riferimento alla foto del viso e flag, più cartelle, Trash, schemi di progetto, template dell'utente e strumenti creati dall'utente, preferiti, strumenti nascosti, lingua e scelta delle emoji. Letto tramite `host.profile`. |
| `sessions.json` | sì | Ogni sessione salvata: slot, id e versione dello strumento, etichetta, miniatura (URL di dati) e dati di input completi. Letto tramite `host.state`. |
| `assets.json` | sì | Metadati di ogni risorsa caricata (immagini, font, token del brand, loghi, copie salvate dei download), ciascuna con un riferimento ai propri byte in `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | per risorsa | I byte grezzi della risorsa, archiviati senza compressione perché la maggior parte è già in formati compressi. L'estensione è solo estetica; fa fede il tipo MIME in `assets.json`. |
| `assets/blobs/<n>.c2pa` | quando presente | Content Credentials estratte come byte binari esatti, referenziate da `_credentialFile` nel record della risorsa. Non sono chiavi di firma del dispositivo. |
| `design-systems.json` | quando presente | I design system creati o aggiunti in questa installazione, come `{ active, records }`. Vedi [Regole di importazione](#import-rules). |
| `file-history.json` | facoltativo | Istantanee delle risorse con versioni, rapporti delle operazioni sui file completate e manifesti completi dei batch, con una propria versione. Fornito dall'adattatore di backup interno `fileHistory` della shell. |
| `revision-history.json` | facoltativo, backup manuali | ID stabili delle creazioni, checkpoint conservati, miniature e bozze di recupero a rotazione. Fornito da `host.state.history.backup` dove supportato. |
| `file-history/versions/` | per istantanea | Byte precedenti delle risorse e credenziali estratte, indipendentemente dal fatto che la risorsa corrente esista ancora. |
| `file-history/results/` | per operazione completata | Byte esatti dell'output. Nessun file originale selezionato per la conversione viene conservato o incluso. |
| `prefs.json` | sì | Preferenze locali dell'utente: `theme`, `sidebarWidth` e il conteggio delle attività `ct-metrics`. |
| `lolly.txt` | sì | Un riepilogo leggibile del bundle (conteggi, profilo, nome del file) per chi apre lo zip senza Lolly. Rigenerato a ogni esportazione e riconosciuto all'importazione, quindi non conta mai come parte ignorata. Viene scritto dopo la mappa di integrità, quindi la mappa non copre questo file. |

::: details Come l'esportazione scrive lo zip
L'esportazione scrive lo zip una parte alla volta (`shells/web/src/lib/zip-stream.ts`). I file caricati, i risultati salvati e le versioni salvate delle risorse vengono letti in blocchi da 4 MiB, mai per intero. I risultati e le versioni salvati vengono prima verificati rispetto al loro SHA-256 registrato. Ogni file viene poi letto per calcolarne il checksum e il digest di integrità e lo zip fa riferimento al file nella sua posizione.

Nulla viene ricodificato. Ogni parte mantiene i propri byte esatti e il proprio digest, quindi un file con Content Credentials conserva i byte coperti dalla sua firma. A parità di parti e ora, lo zip è identico a quello prodotto dal precedente writer in memoria, tranne che un file di cronologia oltre 16 MiB viene compresso a blocchi. `tests/backup-streaming.test.ts` lo verifica rispetto a digest di riferimento registrati.

Su una libreria sintetica da 192 MiB, misurata in Node, il completamento del backup ha richiesto circa 125-150 MiB oltre alla libreria, contro circa 850 MiB del writer in memoria (`node scripts/bench-backup-finalise.ts`). L'importazione legge ancora l'intero zip in memoria.
:::

<!--i:eti-file-->
## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 3,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3, "assetVersions": 1, "fileOperations": 1 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.bin": "sha256-…",
    "file-history.json": "sha256-…",
    "file-history/versions/0.bin": "sha256-…",
    "file-history/results/0.bin": "sha256-…",
    "prefs.json": "sha256-…"
  }
}
```

| Campo | Significato |
|---|---|
| `format` | Sempre `lolly-backup`. Un file senza questo campo viene rifiutato perché "non è un backup Lolly". |
| `formatVersion` | La struttura con cui questo bundle è stato **scritto**. Incrementato a ogni modifica dell'insieme delle parti o delle loro strutture. I lettori **non** usano questo campo per decidere se importare. |
| `minReader` | La versione minima del lettore che può importare questo bundle **in sicurezza**. È il campo su cui i lettori basano la decisione di importare. |
| `app` | Id dell'app che lo ha prodotto, per la diagnostica. |
| `exportedAt` | Data e ora ISO di creazione del bundle. |
| `counts` | Cosa ha inserito il writer, per la visualizzazione e i controlli di coerenza. |
| `integrity` | Facoltativo. Associa ogni parte tranne `manifest.json` a un digest `sha256-<base64>` in stile SRI dei suoi byte **non compressi**. |

<!--i:eti-tag-->
## Policy delle versioni

Due numeri di versione permettono al formato di crescere senza lasciare indietro le installazioni meno recenti.

![Una modifica al formato del bundle è additiva, e i vecchi lettori possono ignorarla, oppure incompatibile, e un'importazione errata corrompe i dati. Una modifica additiva incrementa formatVersion e mantiene minReader; una incompatibile incrementa formatVersion e aumenta minReader. Un lettore importa quando minReader è al massimo pari alla propria versione.](/info/diagrams/concepts/backup-version-gate.svg)

- Un lettore importa un bundle quando `manifest.minReader` è al massimo pari alla propria versione. Lo rifiuta, con "richiede una versione più recente dell'app", solo quando il bundle richiede un lettore più recente.
- Una modifica **additiva**, come una nuova parte facoltativa o un nuovo campo facoltativo del manifesto, incrementa `formatVersion` e lascia invariato `minReader`. Le app meno recenti importano comunque ogni parte che riconoscono e quelle che non riconoscono vengono segnalate come ignorate, senza essere scartate in silenzio.
- Una modifica **incompatibile**, in cui l'importazione errata di una parte corrompe i dati o una parte facoltativa diventa obbligatoria, aumenta `minReader`. Le app meno recenti rifiutano quindi l'importazione senza problemi anziché importare qualcosa che non possono gestire. Le app meno recenti rifiutano quindi il bundle senza problemi.
- Se un bundle futuro imposta `formatVersion` ma esclude `minReader`, i lettori tornano a basare la decisione su `formatVersion` e trattano la modifica come incompatibile.

::: note Regola pratica per gli autori
Se ogni lettore esistente continuerebbe a funzionare correttamente ignorando la tua aggiunta, la modifica è additiva: incrementa `formatVersion` e lascia invariato `minReader`. Altrimenti aumenta `minReader`.
:::

<!--i:eti-shield-check-->
## Integrità

Quando `manifest.integrity` è presente, un lettore verifica lo SHA-256 di ogni parte elencata **prima di scrivere qualsiasi dato**. Una mancata corrispondenza ("verifica di integrità non riuscita") o una parte mancante ("incompleto") interrompe l'importazione, quindi non c'è ripristino parziale. Questo rileva i danni del trasferimento: un AirDrop troncato, un gateway email che ha ricodificato l'allegato, un settore USB danneggiato.

L'integrità è gestita al meglio delle possibilità. Viene scritta solo dove Web Crypto è disponibile (ogni contesto browser sicuro e Node moderno) e verificata solo quando sono presenti sia la mappa sia Web Crypto. Un bundle senza mappa, come uno precedente all'introduzione dell'integrità, viene importato senza modifiche: "impossibile verificare" non equivale mai a "corrotto".

Il manifesto non elenca né se stesso né il `lolly.txt` rigenerato.

<!--i:eti-download-->
## Regole di importazione

Un'importazione viene eseguita in una di due modalità.

- **Merge** è ciò che fanno **Import data…** e la prima adesione alla sincronizzazione, **Bring it to this device**. I dati nella destinazione restano e nulla al di fuori del bundle viene toccato.
- **Replace** è ciò che la sincronizzazione dei dispositivi usa per mantenerli allineati. Prende il record del profilo, le preferenze, le sessioni, le immagini e la scelta del design system attivo della copia sincronizzata. Rimuove solo gli elementi che un altro dispositivo ha eliminato dall'ultima sincronizzazione. Il ripristino di una copia precedente salva prima il dispositivo, poi lo rende uguale a quella copia e rimuove tutto ciò che la copia non contiene. [Sincronizza i tuoi dispositivi](/info/sync.html) descrive ciò che vede una persona.

Un'unione tratta ogni tipo di dati così:

| Dati | Già presenti nella destinazione | Solo nel bundle |
|---|---|---|
| Sessioni (per slot) e immagini caricate (per id) | Viene conservata la copia salvata più di recente, quindi un backup più vecchio non sovrascrive mai il lavoro più recente. Con orari uguali o sconosciuti resta la copia della destinazione. | Aggiunti |
| Cartelle | Vengono mantenuti il nome e la cartella genitore della destinazione e la cartella acquisisce gli elementi del bundle che le mancano. Una sessione archiviata in una cartella della destinazione resta lì. | Aggiunte |
| Preferiti (strumenti, risorse del catalogo ed elementi di Projects) | Combinati | Aggiunti |
| Template, template di Projects e strumenti dell'utente (per id) | Viene conservato il record della destinazione. | Aggiunti |
| Voci di Trash | Viene conservata la voce della destinazione. | Aggiunte, così un elemento ripristinabile in una delle due installazioni resta tale. Una voce la cui cartella è di nuovo in uso nella destinazione, o il cui slot di Trash è già usato dalla destinazione, viene esclusa. |
| Altri campi del profilo (nome, recapiti, lingua, flag delle funzionalità, strumenti nascosti e altre impostazioni) | Viene conservato il valore della destinazione. | Acquisiti dove il campo della destinazione è vuoto |
| Preferenze (`prefs.json`) | Viene conservato il valore della destinazione. | Scritte dove la destinazione non ne ha |
| Design system (per id) | Il record del bundle sostituisce quello della destinazione. | Aggiunti. La scelta attiva del bundle si applica solo quando la destinazione non ha un proprio design system. |
| Cronologia delle creazioni | La copia salvata più di recente resta quella corrente e l'altra viene conservata come bozza protetta. | Aggiunta |

**Le sessioni salvate si ricollegano automaticamente alle loro immagini.** I riferimenti alle risorse vengono conservati per id. Il bridge li risolve di nuovo dopo il ripristino delle immagini, perché gli URL `blob:` non sopravvivono a un ricaricamento.

**I record della cronologia non cambiano mai dopo essere stati scritti.** Un'importazione ripetuta delle versioni delle risorse e degli ID delle operazioni non aggiunge nulla e un ID che identifica già byte o una cronologia diversi viene rifiutato, non sovrascritto. Reimportare una risorsa corrente identica mantiene la sua versione e una risorsa corrente modificata deve avere una versione diversa.

**La cronologia delle creazioni ha qualche regola in più.** Una creazione il cui slot è usato dalla destinazione per un'altra creazione viene aggiunta come creazione separata e una creazione nel Trash della destinazione resta lì. Un id di checkpoint che identifica un contenuto diverso nella destinazione mantiene quello della destinazione. Un archivio che non supera i propri controlli interrompe l'importazione prima di qualsiasi modifica a profilo, sessioni, risorse o preferenze e un'importazione ripetuta identica non occupa altro spazio.

**Il riepilogo riporta cosa è successo.** Ogni importazione restituisce `profile`, `sessions`, `userAssets`, `prefs`, `skipped` e `failedAssets`.

- `failedAssets` conta le risorse caricate che non è stato possibile ripristinare, per esempio perché lo spazio sul dispositivo è esaurito.
- `skipped` conta le parti di un writer più recente che questa build non ha riconosciuto. L'app mostra il conteggio ("… · N elementi più recenti ignorati").
- Con la cronologia dei file, il riepilogo aggiunge `assetVersions`, `fileOperations`, `fileBatches` e `failedHistory`. L'esaurimento dello spazio o un conflitto di ID immutabili può causare un ripristino parziale e l'app invita allora la persona a conservare il backup di origine.
- Con la cronologia delle creazioni, aggiunge `revisions` e `recoveryDrafts`, contando solo ciò che questa importazione ha aggiunto, e `added`, `kept`, `replaced`, `copies` e `hidden` per indicare come è stata unita ogni creazione. `skippedCheckpoints` conta i checkpoint il cui id identifica un contenuto diverso nella destinazione e `historyLeftOut` conta i checkpoint e le bozze meno recenti che non sono rientrati nello spazio per la cronologia del dispositivo.
- Un'importazione in modalità sostituzione aggiunge `removed` e `failedRemovals`.

Il ripristino non è un'unica transazione tra gli archivi di profili, sessioni, risorse e cronologia. La sincronizzazione cloud **non** fa avanzare la revisione applicata dopo un ripristino parziale o non supportato, quindi la copia resta disponibile per riprovare.

<!--i:eti-unlink-->
## Cosa non viene trasferito

- **Cache del catalogo** (metadati e blob delle risorse scaricati, indice degli strumenti), che la destinazione risincronizza.
- **Strumenti e risorse del catalogo**, di cui si presume la presenza nella destinazione. I token del brand, i font e i loghi aggiunti dall'utente sono risorse utente e vengono trasferiti.
- **URL `blob:` e URL di oggetti**, che il bridge rigenera al caricamento.
- **Originali delle conversioni, lease di esecuzione attivi e segreti di accesso o firma locali alla macchina.** Non fanno parte della cronologia portabile. Un risultato salvato è una copia. Non significa che sia stato fatto un backup della sorgente originale.
- **Contatore della sequenza di esportazione**, il contatore giornaliero per i nomi dei download in `localStorage` (`lolly-export-seq`). È escluso da `PREF_KEYS`, quindi non viene mai trasferito in un pacchetto.

L'indicatore dello spazio di archiviazione mostra la stessa suddivisione. Saved sessions, My images e File results & versions entrano in un pacchetto. La cache delle risorse, le anteprime degli strumenti e gli elementi fissati per l'uso offline possono essere ricostruiti e restano sul dispositivo.

![L'indicatore dello spazio di archiviazione suddivide i dati di questo dispositivo in categorie con nome, con Saved sessions e My images conteggiati separatamente da Asset cache, qui su una nuova installazione dove tutte le categorie sono ancora vuote](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

<!--i:eti-building-->
## Dati dell'organizzazione con Lolly Work

Questo pacchetto fa il backup della libreria personale del dispositivo. Un pacchetto non è un backup di un'istanza di **Lolly Work**. Account dell'organizzazione, policy di accesso, progetti condivisi, versioni del catalogo, approvazioni, processi di rendering e record di audit sono conservati da quel servizio. Riconnettiti e accedi per riottenere l'accesso al lavoro condiviso. Importare un pacchetto personale non concede quell'accesso.

Gli operatori fanno il backup, conservano e cancellano i dati del server seguendo le guide di Lolly Work: [Backup e ripristino](/info/work-operations.html#backup-and-restore) e [Archiviazione e ciclo di vita dei dati di Lolly Work](/info/work-data-lifecycle.html). Cancellare o esportare i dati di un dispositivo non esegue nessuna di queste operazioni sul server.

<!--i:eti-monitor-->
## Tra le shell

`data-transfer.ts` legge e scrive solo attraverso il bridge delle capacità (`host.profile`, `host.state`, `host.assets`) e le preferenze condivise in `localStorage`. Lo stesso modulo legge e scrive l'involucro comune sul web e nelle app desktop e mobili, su IndexedDB o su archiviazione nel filesystem. Le parti facoltative della cronologia compaiono solo dove il loro adattatore è disponibile. L'importazione segnala come saltata una parte non supportata. La suite headless verifica le parti comuni con un bridge in memoria e le transazioni della cronologia hanno anche test in un browser reale.

Due shell restano fuori da questa garanzia:

- La **CLI a esecuzione singola** non ha nulla da trasferire: il suo stato è in memoria e dura una sola invocazione.
- La **TUI** conserva lo stato in `~/.lolly` (sessioni, cartelle, profilo). La sua vista Profile scrive un proprio archivio di backup più semplice: `saved-state/<slot>.json` per ogni sessione più `profile.json` e `folders.json`, senza manifest, senza `formatVersion` o `minReader` e senza mappa di integrità. Un lettore di questo formato rifiuta quell'archivio come "non è un backup di Lolly", anche se i nomi sono simili (`lolly-backup-<stamp>.zip`). L'unificazione dei due è una lacuna nota.

<!--i:eti-clock-->
## Non ancora portabile

Nuovi tipi di dati portabili potranno essere aggiunti in seguito come parti aggiuntive (un nuovo `formatVersion`, lo stesso `minReader`). I design system vengono già trasferiti così, come `design-systems.json` insieme alle loro risorse utente.

Due nomi sono riservati a dati che non vengono ancora trasferiti:

- **`tokens.json`** conterrebbe un documento di design token [W3C DTCG](https://tr.designtokens.org/format/) con i suoi gruppi, set e temi, il formato che [Penpot importa ed esporta](https://help.penpot.app/user-guide/design-systems/design-tokens/). I token del brand dell'utente vengono già trasferiti come risorsa `user/tokens/brand` in `assets.json` e i token di un design system vengono trasferiti con il suo record.
- **`penpot/`** è riservato a un file Penpot acquisito, o al sottoinsieme rilevante per Lolly, reso disponibile come strumento.

<!--i:eti-history-->
## Parti della cronologia

Le due parti della cronologia sono facoltative e hanno versioni proprie.

::: details Cronologia delle creazioni (v3)
I backup manuali da un'installazione web con cronologia delle creazioni includono `revision-history.json`, con il proprio schema `{ version: 1, documents, revisions, recoveries }`. Contiene gli ID conservati, le istantanee canoniche degli input, i marcatori di versione, le anteprime raster e le bozze separate dei processi di scrittura. L'adattatore della cronologia acquisisce le sessioni correnti e le loro revisioni di testa in un'unica transazione di lettura e `sessions.json` usa le stesse istantanee correnti per i lettori meno recenti.

Il ripristino controlla SHA-256 e conteggi dei byte del payload, unicità delle identità, relazioni tra documenti e revisioni di testa, ascendenza, timestamp, tipi di anteprime e limiti prima di salvare l'archivio in un'unica transazione. I riferimenti ai genitori compattati possono mancare. Il lavoro corrente esistente non viene mai sostituito senza segnalarlo: quando una creazione è presente su entrambi i lati, il lato non mantenuto come corrente diventa una bozza protetta.

L'archivio ha un limite di trasferimento di 384 MiB. I limiti di archiviazione vengono applicati senza troncare i checkpoint conservati. L'esportazione scrive `revision-history.json` e `sessions.json` a blocchi, con gli stessi byte prodotti da un singolo `JSON.stringify`, quindi il testo del file non viene mai tenuto interamente in memoria. Un file di cronologia che supererebbe il limite viene scartato nel momento in cui lo supera e da quel punto viene solo conteggiato. L'archivio viene poi ricreato senza i suoi checkpoint automatici più vecchi e il riepilogo dell'esportazione li conta come `checkpointsLeftOut`, oppure l'archivio viene rifiutato.

Una shell senza questa capacità ripristina le sessioni ordinarie e segnala come saltata la parte della cronologia. La cronologia su filesystem nativo resta non supportata finché il suo adattatore non fornisce transazioni persistenti della cronologia. Gli ospiti di una collaborazione privata non hanno una cronologia persistente né un archivio di recupero.

La sincronizzazione delle istantanee personali esclude la cronologia delle creazioni. Applicare un'istantanea a un documento locale con cronologia conserva il suo stato di lavoro precedente come bozza di recupero separata e invalida il token di scrittura di qualsiasi editor aperto. I suoi checkpoint immutabili restano sul dispositivo. Questo protegge la cronologia locale durante la sostituzione con un'istantanea. Non unisce le cronologie concorrenti dei dispositivi.

I riferimenti storici alle risorse vengono conservati, mentre il rendering continua a risolvere le risorse attraverso la libreria esistente nella destinazione. Questo archivio non garantisce ancora gli esatti byte delle vecchie risorse o i vecchi rendering degli strumenti. I byte delle versioni delle risorse e dei risultati dei file vengono trasferiti nella propria parte del backup.
:::

::: details Versioni salvate e risultati dei file (v2)
La parte facoltativa della cronologia contiene `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }` e i lettori accettano anche la precedente struttura history-v1 senza batch. Ogni istantanea fornisce l'ID stabile della risorsa e la versione esatta, l'ora del salvataggio, la lunghezza in byte e lo SHA-256 esadecimale, più un record della risorsa i cui `_file` e `_credentialFile` facoltativo puntano a parti binarie. Le operazioni contengono i dati del file originale, la richiesta, il report, i timestamp e l'eventuale `_file` del risultato. I nomi dei backend di archiviazione, gli handle OPFS e i lease di esecuzione non vengono trasferiti. I lettori che conoscono solo history v1 rifiutano la nuova versione della cronologia prima dell'importazione, così l'appartenenza ai batch non viene mai persa senza segnalarlo.

I manifest dei batch registrano ogni sorgente selezionata prima dell'elaborazione, compresi i file mai letti, gli elementi annullati, le mancate prenotazioni di spazio per i risultati e il lavoro interrotto. Ogni elemento ha un ID operazione stabile, un riferimento alla sorgente e i suoi dati, il nome richiesto per l'output e il report finale. Una sorgente non letta ha dati dichiarati, non un digest inventato. L'importazione convalida l'identità degli elementi e la coerenza con ogni report di operazione trasferito. I report di Lolly Batch restano disponibili quando i singoli risultati sono stati rimossi, ma una ricevuta non significa che i byte del suo output siano ancora archiviati.

- **Prima la convalida.** Ogni record della cronologia noto, report e file referenziato viene convalidato prima di qualsiasi scrittura per l'importazione di profili o risorse. Byte mancanti e SHA-256 non corrispondenti causano un errore anche quando l'involucro non ha una mappa di integrità. Le credenziali estratte restano array di byte, comprese le importazioni da processi di scrittura meno recenti che le serializzavano come oggetti con chiavi numeriche.
- **Lavoro in corso.** Le operazioni in corso diventano record interrotti nel backup, con un report di errore e senza risultato. Il ripristino non riavvia mai il lavoro in background né importa un lease attivo. Riprovare significa selezionare di nuovo il file originale, verificato rispetto al suo SHA-256 registrato quando disponibile.
- **Archiviazione.** I risultati ripristinati salvano insieme byte e metadati in IndexedDB. I nuovi risultati ordinari usano OPFS dove disponibile, con IndexedDB come ripiego. Un'operazione attiva esistente non viene mai sostituita da un'importazione.
- **Limiti del backup.** L'esportazione scrive questi byte nell'archivio in streaming, ma il ripristino decomprime ancora un intero backup in memoria, quindi i limiti restano: **256 MiB di payload della cronologia**, **4 MiB di metadati della cronologia**, al massimo **100 operazioni**, **100 batch** e **2.000 istantanee**. L'esportazione rifiuta esplicitamente una cronologia troppo grande o incompleta e non la esclude mai senza segnalarlo. Scarica le versioni e i risultati importanti uno per uno prima di rimuovere le copie locali più vecchie. Questi limiti non sono una garanzia misurata del picco di memoria sui telefoni.
- **Budget locali.** La cronologia locale dei risultati ha un budget di 512 MiB e un limite di 100 record. Le istantanee delle risorse hanno un budget separato di 512 MiB e al massimo 20 versioni storiche per risorsa, e i byte delle credenziali estratte contano in quel budget. Il ripristino rispetta questi limiti e non elimina mai dati utente esistenti senza segnalarlo.
- **Metadati dei batch.** I metadati locali dei batch hanno un budget separato di 4 MiB, al massimo 100 manifest e 20 elementi per batch. Gli elementi in attesa riservano capacità per i metadati, con un limite di 32 KiB per il report di ogni elemento. È un budget logico, non una garanzia di spazio su disco del browser: un effettivo errore di quota viene mostrato e il report in memoria resta scaricabile. Riprovare un elemento di un batch crea un nuovo batch senza sovrascrivere il vecchio report. Rimuovere un record di batch non rimuove i byte dei singoli risultati o le risorse della libreria.
- **Risultati nella libreria.** I risultati convertiti possono essere aggiunti alla libreria senza normalizzazione o ricodifica, con gli hash della sorgente e dell'output e la relazione con l'operazione allegati. Aggiunte ripetute riusano una copia invariata e una copia modificata non viene mai sovrascritta. Le immagini raster possono avviare un nuovo documento di Lolly Design, che usa l'ID corrente della risorsa nella libreria. Imporre il vincolo a versioni esatte nell'intero runtime di Lolly Design e nel percorso URL è un lavoro separato. I risultati SVG, HTML, PDF e ZIP vengono conservati come risorse file opache, senza essere promossi a contenuti interattivi o vettoriali attendibili.
- **Dove si vede.** **Convert → Recent file operations** mostra l'uso della cronologia, i report, i download e il gestore delle versioni, che trova anche le versioni precedenti delle risorse eliminate dalla libreria. Ripristinare un'istantanea crea una nuova versione corrente e conserva l'istantanea selezionata. **Settings → Preferences → Storage** conta risultati e versioni separatamente dalle cache eliminabili.
- **Pulizia.** La pulizia esplicita dei file temporanei rimuove solo i byte appartenenti alle operazioni e privi di riferimenti. I record correnti proteggono i loro file e i file OPFS recenti hanno un periodo di tolleranza di un'ora. I risultati salvati e le istantanee delle risorse non vengono cancellati automaticamente.

I lettori meno recenti accettano ancora l'involucro v2 (`minReader: 1`) e ripristinano le parti che conoscono, contando le parti della cronologia non supportate come saltate. Il recupero completo della cronologia richiede una shell con l'adattatore `fileHistory`, un punto di integrazione interno alla shell, non una capacità `HostV1` esposta agli strumenti. Il ripristino reale tra due dispositivi è coperto dalla verifica di accettazione locale in Chromium. Il recupero nelle app desktop, iOS e Android installate deve ancora superare separatamente i test di accettazione.
:::

<!--i:eti-code-->
## Riferimenti

- Modulo: `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION`; la funzione che assegna i nomi `backupFilename()` è interna).
- Test del contratto: `tests/data-transfer.test.ts`, che copre esportazione e reimportazione, unione, integrità, compatibilità con versioni successive e controllo di versione del lettore.
- Test dei contratti della cronologia: `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts` e `tests/file-result-library.test.ts`. Test di accettazione nel browser: `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts` e `tests/file-result-reuse.browser.test.ts`.
- Interfaccia del bridge usata: `host.profile`, `host.state` e `host.assets`; vedi [Host API](/info/host-api.html).
