# Trasferimento dati - il bundle `lolly-backup`

Tutto ciò che un utente Lolly accumula vive **sul suo dispositivo** - nessun account, nessun cloud. Il bundle di trasferimento dati è come quel valore si sposta: esportalo su un'installazione, porta il file con qualsiasi mezzo (USB, AirDrop, email a te stesso, una condivisione di rete) e importalo su un'altra. Il file *è* il trasporto. La destinazione può essere offline o online. Non fa differenza, perché nulla parla mai con un server.

![I due pulsanti che spostano un'intera installazione: Esporta i miei dati scrive uno zip, Importa dati lo rilegge](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=%23storage-section%20.storage-subsection&dark=1&filename=pd-transfer-controls)

Questa pagina è la specifica del formato. Per la guida passo passo pensata per l'utente finale vedi [Trova e recupera il tuo lavoro → Sposta il tuo lavoro su un altro dispositivo](/info/find-your-work.html#move-your-work-to-another-device). L'implementazione è in [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts), e [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) fissa il contratto di andata e ritorno.

> **Ambito.** Un bundle trasporta *dati utente*, non strumenti di catalogo. Strumenti e asset di catalogo sono sincronizzati separatamente e si presume siano già presenti sulla destinazione (nel peggiore dei casi in una versione più recente); gli strumenti che l'utente ha creato da sé viaggiano dentro `profile.json`. L'importazione non installa né aggiorna mai uno strumento di catalogo.

## Obiettivi

- <!--i:box--> **Un formato, ogni shell.** La PWA web, le app desktop/mobile Tauri e le shell future condividono la stessa busta e gli stessi schemi delle parti supportate. Le parti opzionali dipendono dalle capacità di ogni shell; le parti non supportate vengono segnalate. Ogni bridge delle funzionalità fornisce il proprio adattatore di storage.
- <!--i:shieldcheck--> **Sopravvive al viaggio.** Un bundle danneggiato o troncato durante il trasporto fallisce in modo evidente all'importazione, mai un ripristino parziale.
- <!--i:clock--> **Sopravvive a questa versione.** Un'app più vecchia può comunque importare le parti riconosciute di un bundle più recente. Un formato realmente incompatibile viene rifiutato in modo pulito.
- <!--i:check--> **Sicuro da unire.** Importare su un'installazione già in uso non cancella mai nulla che non era nel bundle.

## La busta

Un bundle è un semplice `.zip`. Il download prende il nome della persona a cui appartiene - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (ad esempio `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - così una cartella Download piena di backup resta leggibile. Le parti nome e cognome provengono dal profilo e vengono omesse se non impostate. Senza profilo si ottiene `LollyTools-2026-06-26-1.zip`, e con il solo nome si ottiene `LollyTools-Ada-2026-06-26-1.zip`. Ogni parte viene sanificata in un token sicuro per i nomi file (lettere/cifre Unicode mantenute, spazi/punteggiatura rimossi, limite di 32 caratteri). `<n>` è una sequenza giornaliera per dispositivo, così esportazioni ripetute nello stesso giorno non collidono e restano in ordine. `backupFilename()` in [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) costruisce il nome. Il contenuto dello zip è identico indipendentemente dal nome. All'interno:

| Percorso | Obbligatorio | Contenuto |
|---|---|---|
| `manifest.json` | sì | Id del formato, versioni, conteggi e integrità per parte. La prima cosa che un lettore controlla. |
| `profile.json` | quando impostato | L'intero record `me` dell'utente: nome, contatto, riferimento alla foto e flag, più cartelle, Cestino, blueprint di progetto, template utente e strumenti creati dall'utente, preferiti, strumenti nascosti, lingua e scelta emoji. Letto tramite `host.profile`. |
| `sessions.json` | sì | Ogni sessione salvata: slot, id/versione dello strumento, etichetta, miniatura (data-URL) e dati di input completi. Letto tramite `host.state`. |
| `assets.json` | sì | Metadati per ogni asset caricato (immagini, font, token di brand, loghi, copie salvate dei download), ciascuno che punta ai suoi byte sotto `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | per asset | I byte grezzi dell'asset (file immagine e font). Memorizzati non compressi (formati già compressi). L'estensione è cosmetica. Il MIME in `assets.json` è quello autorevole. |
| `assets/blobs/<n>.c2pa` | quando presente | Content Credentials estratte come byte binari esatti, referenziate da `_credentialFile` nel record dell'asset. Non sono chiavi di firma del dispositivo. |
| `design-systems.json` | quando presente | I sistemi di design creati o aggiunti su questa installazione, come `{ active, records }`. Uniti per id all'importazione; la scelta attiva del bundle si applica solo quando la destinazione non ha un proprio sistema di design. |
| `file-history.json` | opzionale | Snapshot degli asset con versione, report finali delle operazioni sui file e manifest di batch completi. La parte di cronologia ha una propria versione; fornita dall'adattatore di backup interno `fileHistory` della shell. |
| `revision-history.json` | opzionale, backup manuali | Id di creazione stabili, checkpoint conservati, miniature e bozze di recupero continue. Fornito da `host.state.history.backup` dove supportato. |
| `file-history/versions/` | per snapshot | Byte precedenti dell'asset e credenziali estratte, indipendentemente dal fatto che l'asset attuale esista ancora. |
| `file-history/results/` | per operazione completata | Byte di output esatti. Nessun file originale selezionato per la conversione viene conservato o incluso. |
| `prefs.json` | sì | Preferenze locali di proprietà dell'utente: `theme`, `sidebarWidth` e il conteggio attività `ct-metrics`. |
| `lolly.txt` | sì | Un riepilogo leggibile del bundle (conteggi, profilo, nome file) per chiunque apra lo zip senza Lolly. Rigenerato a ogni esportazione e riconosciuto all'importazione, quindi non conta mai come parte saltata. È scritto *dopo* la mappa di integrità, quindi ne resta fuori. |

Il bundle è di proposito un semplice zip: sopravvive intatto a qualsiasi trasporto, e qualsiasi strumento di estrazione può ispezionarlo.

`profile.json` è la parte più piccola e la prima che un lettore vede nell'app: i dati che un produttore compila una volta, più l'opt-in che permette agli strumenti di usarli.

![Il modulo dei dettagli del profilo che diventa profile.json - nome, contatto, foto e l'opt-in accanto](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

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
| `format` | Sempre `lolly-backup`. Un file senza questo campo viene rifiutato come "non un backup Lolly". |
| `formatVersion` | Il layout con cui questo bundle è stato **scritto**. Incrementato a ogni modifica dell'insieme o della forma delle parti. I lettori **non** si basano su questo campo. |
| `minReader` | La versione minima del lettore richiesta per importare questo bundle **in sicurezza**. È il campo su cui i lettori si basano. |
| `app` | Id dell'app che ha prodotto il bundle, per la diagnostica. |
| `exportedAt` | Timestamp ISO di creazione del bundle. |
| `counts` | Cosa lo scrittore ha inserito, per la visualizzazione e il controllo di coerenza. |
| `integrity` | Opzionale. Mappa ogni parte tranne `manifest.json` a un digest in stile SRI `sha256-<base64>` dei suoi byte **non compressi**. |

## Politica di versione (compatibilità in avanti)

La separazione tra `formatVersion` e `minReader` è ciò che permette al formato di crescere senza abbandonare le installazioni più vecchie:

- Un lettore importa un bundle quando `manifest.minReader ≤` la propria versione del lettore. Rifiuta (con "richiede una versione più recente dell'app") solo quando il bundle richiede esplicitamente un lettore più recente.
- Una modifica **additiva** - una nuova parte *opzionale*, o un nuovo campo opzionale del manifest - incrementa `formatVersion` ma lascia invariato `minReader`. Le app più vecchie continuano a importare ogni parte che riconoscono. Le parti che non riconoscono vengono saltate (vedi sotto), non scartate silenziosamente.
- Una modifica **incompatibile** - una in cui un'importazione errata di una parte corrompe i dati, o in cui una parte precedentemente opzionale diventa obbligatoria - fa salire `minReader`. Le app più vecchie allora rifiutano in modo pulito invece di importare qualcosa che non sanno gestire.
- Se un bundle futuro imposta `formatVersion` ma omette `minReader`, i lettori per prudenza ripiegano sul basarsi su `formatVersion` (trattando la modifica come incompatibile).

> **Regola pratica per gli autori:** se ogni lettore esistente si comporterebbe comunque correttamente ignorando la tua aggiunta, è additiva - incrementa `formatVersion`, lascia `minReader`. Altrimenti alza `minReader`.

## Integrità

Quando `manifest.integrity` è presente, un lettore verifica lo SHA-256 di ogni parte elencata **prima di scrivere qualsiasi cosa**. Una mancata corrispondenza ("non ha superato il controllo di integrità") o una parte mancante ("incompleto") interrompe l'intera importazione - non esiste un ripristino parziale. Questo intercetta la corruzione che un trasporto di file può introdurre (un AirDrop troncato, un gateway email che ha ricodificato l'allegato, un settore USB difettoso).

L'integrità è best-effort per progettazione: viene scritta solo dove Web Crypto è disponibile (ogni contesto browser sicuro e Node moderno), e verificata solo quando sia la mappa sia Web Crypto sono presenti. Un bundle senza la mappa - per esempio uno precedente all'esistenza dell'integrità - viene importato senza modifiche. "Impossibile verificare" non viene mai trattato come "corrotto".

Il manifest non elenca né se stesso né il README `lolly.txt` rigenerato. I digest coprono le parti di cui il manifest si fa garante.

## Semantica di importazione

L'importazione è **unione con sovrascrittura**, mai sostituzione totale:

- I dati esistenti sulla destinazione restano al loro posto.
- Qualsiasi chiave in collisione - il profilo, uno slot di sessione, un id di immagine caricata - viene sostituita dalla copia importata.
- Il profilo è un unico record, quindi viene sostituito per intero: le cartelle, il Cestino, i template, i preferiti e gli strumenti nascosti della destinazione diventano quelli del bundle. Una sessione che la destinazione aveva ma il bundle no viene conservata, non archiviata, al livello superiore di Progetti.
- Le versioni storiche degli asset e gli id delle operazioni sono eccezioni immutabili: un'importazione ripetuta è idempotente, e un id che nomina già byte/cronologia diversi viene rifiutato, non sovrascritto. Reimportare un asset attuale identico ne conserva la versione. Un asset attuale modificato deve avere una versione diversa.
- Anche la cronologia delle creazioni è un'eccezione: un'identità di documento o revisione attuale in conflitto interrompe il proprio ripristino prima delle modifiche a profilo, asset o preferenze. Un'importazione ripetuta identica non aggiunge storage. Ripristina un archivio in conflitto su un'installazione separata per ispezionare e copiare le sue creazioni.
- Nulla che non era nel bundle viene toccato. Una sessione presente sulla destinazione ma non nel bundle sopravvive all'importazione.

Le sessioni salvate si ricollegano automaticamente alle proprie immagini: i riferimenti agli asset sono mantenuti tramite id, e il bridge li ririsolve dopo che le immagini caricate sono state ripristinate (deve farlo comunque, perché gli URL `blob:` non sopravvivono a un ricaricamento).

Il riepilogo dell'importazione riporta `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`. `failedAssets` conta gli asset caricati che non è stato possibile ripristinare (per esempio archiviazione del dispositivo piena). È distinto da `skipped`, che conta le parti provenienti da uno scrittore più recente e compatibile in avanti che questa build non ha riconosciuto. L'interfaccia mostra `skipped` ("… · N elementi più recenti saltati"), così il ripristino è onesto su cosa ha lasciato indietro.

Quando la cronologia dei file è presente, il riepilogo porta anche `assetVersions`, `fileOperations` e `failedHistory`. L'esaurimento dello storage o i conflitti di id immutabile possono causare un ripristino parziale; l'interfaccia dice all'utente di conservare il backup originale. La sincronizzazione cloud **non** fa avanzare la propria revisione applicata dopo un ripristino parziale o non supportato, così lo snapshot resta disponibile per un nuovo tentativo. Il ripristino non è un'unica transazione attraverso tutti gli store di profilo/sessione/asset/cronologia.

## Cronologia delle creazioni (v3)

I backup manuali da un host web con capacità di cronologia includono `revision-history.json` con il proprio schema `{ version: 1, documents, revisions, recoveries }`. Porta gli id conservati, le istantanee canoniche degli input, i timbri di versione, le anteprime raster e bozze separate dell'autore. L'adattatore della cronologia cattura le sessioni attuali e le loro head in un'unica transazione di lettura; `sessions.json` usa quelle stesse istantanee attuali per i lettori più vecchi.

Il ripristino controlla lo SHA-256 e il conteggio dei byte del payload, le identità univoche, le relazioni documento/head, l'ascendenza, i timestamp, i tipi di anteprima e i limiti prima di confermare l'archivio in un'unica transazione. I riferimenti al genitore compattati possono essere assenti. Il lavoro attuale esistente deve corrispondere al documento importato; i conflitti vengono rifiutati anziché sostituirlo silenziosamente. Il limite di trasferimento di 384 MiB dell'archivio viene controllato esplicitamente, e i limiti di storage vengono applicati senza troncare i checkpoint conservati. Il backup complessivo usa ancora un'implementazione ZIP in memoria e non è un archivio in streaming.

Il riepilogo aggiunge `revisions` e `recoveryDrafts`. Una shell priva di questa capacità ripristina le sessioni normali e riporta la parte di cronologia come saltata. La cronologia del filesystem nativo resta non supportata finché il suo adattatore non fornisce transazioni di cronologia durevoli. Lo stato ospite P2P non ha cronologia durevole né archivio di recupero.

La sincronizzazione degli snapshot personali esclude esplicitamente la cronologia delle creazioni. Applicare uno snapshot a un documento locale con cronologia ne conserva lo stato di lavoro precedente come bozza di recupero separata e invalida il token di scrittura di qualsiasi editor aperto. I suoi checkpoint immutabili restano sul dispositivo. Questo protegge la cronologia locale durante la sostituzione dello snapshot; non unisce le cronologie concorrenti di più dispositivi.

I riferimenti storici agli asset vengono conservati, mentre il rendering continua a risolvere gli asset tramite la libreria esistente della destinazione. Questo archivio non garantisce ancora i byte esatti degli asset vecchi né i render vecchi degli strumenti. I byte di versione asset e di risultato file continuano a viaggiare tramite la loro parte di backup separata esistente.

## Versioni salvate e risultati file (v2)

La parte opzionale di cronologia contiene `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`; i lettori accettano anche la forma precedente history-v1 senza batch. Ogni snapshot identifica l'id stabile dell'asset e la versione esatta, il suo orario di salvataggio, la lunghezza in byte e lo SHA-256 esadecimale, più un record asset il cui `_file` ed eventuale `_credentialFile` puntano a parti binarie. Le operazioni portano i dati originali del file, la richiesta, il report, i timestamp e un `_file` di risultato opzionale; i nomi dei backend di storage, gli handle OPFS e le lease di esecuzione non viaggiano. I lettori più vecchi solo history-v1 rifiutano la nuova versione di cronologia prima di importare, invece di scartare silenziosamente l'appartenenza a un batch.

I manifest di batch registrano ogni sorgente selezionata prima dell'elaborazione, inclusi i file mai letti, i membri annullati, i fallimenti nel riservare spazio per il risultato e il lavoro interrotto. Ogni membro ha un id di operazione stabile, un riferimento/dati della sorgente, un nome di output richiesto e un report finale. Una sorgente non letta ha dati dichiarati, non un digest inventato. L'importazione convalida l'identità del membro e la coerenza con qualsiasi report di operazione portato con sé. I report di batch restano disponibili quando i singoli risultati sono stati rimossi esplicitamente, ma una ricevuta non implica che i suoi byte di output siano ancora memorizzati.

- Ogni record di cronologia, report e file referenziato noto viene convalidato prima di qualsiasi scrittura di importazione di profilo o asset. I byte mancanti e gli SHA-256 non corrispondenti falliscono anche se la busta non ha una mappa di integrità. Le credenziali estratte restano array di byte, incluse le importazioni da scrittori più vecchi che le avevano serializzate in JSON come oggetti a chiave numerica.
- Le operazioni in corso diventano record interrotti nel backup, con un report di fallimento esplicativo e nessun risultato. Il ripristino non riavvia mai il lavoro in background né importa una lease attiva. Riprovare richiede di selezionare il file originale, verificato rispetto al suo SHA-256 registrato quando disponibile.
- I risultati ripristinati confermano i loro byte e metadati insieme in IndexedDB. I nuovi risultati normali usano OPFS dove disponibile, con un fallback su IndexedDB. Un'operazione attiva esistente non viene mai sostituita da un'importazione.
- L'assemblaggio dello ZIP di cronologia è ancora in memoria: il limite attuale è **256 MiB di payload di cronologia**, **4 MiB di metadati di cronologia**, al massimo **100 operazioni**, **100 batch** e **2.000 snapshot**. L'esportazione rifiuta esplicitamente una cronologia troppo grande o incompleta; non la omette mai silenziosamente. Scarica singolarmente le versioni/i risultati importanti prima di rimuovere copie locali più vecchie. Questi limiti non sono una garanzia misurata di picco di memoria per i telefoni.
- La cronologia dei risultati locale ha un budget di 512 MiB e un tetto di 100 record. Gli snapshot degli asset hanno un budget separato di 512 MiB e al massimo 20 versioni storiche per asset; i byte delle credenziali estratte contano ai fini di quel budget di snapshot. Il ripristino rispetta questi limiti e non sfratta mai silenziosamente dati utente esistenti.
- I metadati di batch locali hanno un budget separato di 4 MiB, al massimo 100 manifest e 20 membri per batch. I membri in sospeso riservano capacità di metadati, con un tetto di 32 KiB di report per membro. Questo è un budget logico, non una garanzia di spazio su disco del browser; un vero fallimento di quota viene segnalato e il report in memoria resta scaricabile. Riprovare un membro di batch crea un nuovo batch senza sovrascrivere il vecchio report. Rimuovere un record di batch non rimuove i byte di risultato individuali né gli asset di libreria.
- I risultati convertiti possono essere aggiunti esplicitamente alla libreria senza normalizzazione o ricodifica. Gli hash di origine/output e la relazione con l'operazione accompagnano l'asset. Aggiunte ripetute riutilizzano una copia invariata; una copia modificata non viene mai sovrascritta. Le immagini raster possono avviare un nuovo documento Design. Quel documento usa l'id asset attuale della libreria: applicare vincoli di versione esatti in tutto il runtime e il percorso URL di Design resta lavoro separato. I risultati SVG/HTML/PDF/ZIP vengono conservati come asset file opachi da questo passaggio, non promossi a contenuto interattivo/vettoriale attendibile.
- **Convert → Recent file operations** mostra l'utilizzo della cronologia, i report, i download e il gestore delle versioni. Il gestore trova anche versioni precedenti di asset di libreria eliminati. Ripristinare uno snapshot crea una nuova versione attuale mantenendo intatto lo snapshot selezionato. **Impostazioni → Spazio di archiviazione** conteggia risultati e versioni separatamente dalle cache eliminabili.
- La pulizia esplicita dei file temporanei rimuove solo byte di proprietà di un'operazione e non referenziati. I record attuali proteggono i propri file; i file OPFS recenti hanno un periodo di grazia di un'ora. I risultati salvati e gli snapshot degli asset non vengono cancellati automaticamente.

I lettori più vecchi accettano ancora la busta v2 (`minReader: 1`) e ripristinano le parti conosciute, contando le parti di cronologia non supportate come saltate. Il recupero completo della cronologia richiede una shell con l'adattatore `fileHistory`; questa è una cucitura interna alla shell, non una nuova capacità `HostV1` rivolta agli strumenti. Il ripristino reale tra due dispositivi è coperto dal gate locale Chromium; l'accettazione del recupero installato su Tauri/iOS/Android resta separata.

## Cosa non viaggia

- **Cache del catalogo** (metadati e blob degli asset scaricati, l'indice degli strumenti) - risincronizzati gratuitamente sulla destinazione.
- **Strumenti e asset di catalogo** - fuori ambito, e si presume già presenti sulla destinazione. I token di brand, i font e i loghi aggiunti dall'utente sono asset utente, quindi viaggiano.
- **URL `blob:` / object URL** - rigenerati dal bridge al caricamento.
- **Gli originali di conversione, le lease di esecuzione dal vivo e i segreti di accesso/firma locali alla macchina** - non sono payload di cronologia portabile. Un risultato salvato è una copia, non una promessa che la sorgente originale sia stata salvata.
- **Il contatore di sequenza di esportazione** - il contatore locale di denominazione dei download per giorno (chiave `localStorage` `lolly-export-seq`) è una comodità locale di denominazione. È tenuto fuori da `PREF_KEYS`, quindi non viaggia mai in un bundle.

Il misuratore di archiviazione elenca la stessa suddivisione. Le sessioni salvate, Le mie immagini e i risultati e le versioni dei file viaggiano in un bundle. La cache degli asset, le anteprime degli strumenti e i pin offline sotto di esse sono tutti riderivabili, quindi restano indietro.

![Il misuratore di archiviazione che suddivide i dati di questo dispositivo in categorie con nome, con Sessioni salvate e Le mie immagini tracciate separatamente dalla Cache asset, qui su un'installazione appena fatta dove ogni categoria è ancora vuota](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=.store-manages%2C.storage-subsection%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&walker=1&dark=1&filename=ce-storage-categories)

## Garanzia tra shell

`data-transfer.ts` legge e scrive esclusivamente tramite il capability bridge (`host.profile`, `host.state`, `host.assets`) e le preferenze condivise di `localStorage`. Lo stesso modulo legge e scrive la busta comune sul web e su Tauri, tramite IndexedDB o storage del filesystem. Le parti opzionali di cronologia compaiono solo dove è disponibile l'adattatore corrispondente; una parte non supportata viene riportata come saltata all'importazione. La suite headless esercita le parti comuni contro un bridge in memoria, mentre le transazioni di cronologia hanno anche test su browser reale.

Due shell restano fuori da questa garanzia, per motivi diversi:

- La **CLI one-shot** non ha nulla da conservare - il suo stato è in memoria ed effimero per ogni invocazione.
- La **TUI** persiste effettivamente lo stato (`~/.lolly`: sessioni, cartelle, profilo) e la sua vista Profilo può farne il backup, ma scrive un archivio *più semplice*, tutto suo: `saved-state/<slot>.json` per sessione più `profile.json` e `folders.json`, senza manifest, senza `formatVersion`/`minReader` e senza mappa di integrità. **Non** è importabile in questo formato - un lettore lo respinge come "not a Lolly backup" - e crea confusione perché usa un nome simile (`lolly-backup-<stamp>.zip`). Unificare i due è una lacuna nota.

## Punti di estensione riservati

L'involucro è un manifest più un insieme di parti nominate, per design, così che nuovi tipi di dati portabili possano appoggiarsi su di esso in futuro **senza una modifica incompatibile**. Si inseriscono come parti additive (nuovo `formatVersion`, stesso `minReader`), e il lettore odierno salta ciò che non riconosce. Non sono ancora implementati. I nomi sono riservati qui affinché il formato resti coerente quando verranno introdotti.

- **`tokens.json` - design token.** Un documento di design token [W3C DTCG](https://tr.designtokens.org/format/) (il formato che [Penpot importa ed esporta](https://help.penpot.app/user-guide/design-systems/design-tokens/) - token con `$value`/`$type`/`$description`, organizzati in gruppi, set e temi). Un set di token nel bundle permette a un utente di spostare i propri elementi primitivi di brand tra installazioni insieme alle sessioni. (I token di brand di un utente viaggiano già oggi come asset `user/tokens/brand` in `assets.json`; questa parte porterebbe un intero documento DTCG con i suoi set e temi.) Nel lungo periodo, un set di token ingerito diventerà una sorgente di prima classe rispetto a cui strumenti e asset di palette si risolveranno.
- **`penpot/` - file Penpot ingeriti.** Una directory riservata per un file Penpot (o il suo sottoinsieme estratto, rilevante per Lolly) importato ed esposto *come strumento*. Il bundle porterà con sé la definizione ingerita, così viaggia insieme al resto dei dati dell'utente.

Qualsiasi cosa al di fuori di questi nomi riservati e delle parti sopra elencate è, per un lettore, una parte sconosciuta: lasciata intatta e conteggiata in `skipped`.

## Riferimento

- Modulo: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - il nominatore `backupFilename()` è interno).
- Test di contratto: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - casi di round-trip, merge, integrità, compatibilità futura e blocco del lettore.
- Test di contratto della cronologia: [`tests/file-history-backup.test.ts`](../tests/file-history-backup.test.ts), [`tests/file-batch-history.test.ts`](../tests/file-batch-history.test.ts) e [`tests/file-result-library.test.ts`](../tests/file-result-library.test.ts). Accettazione browser: [`tests/file-history.browser.test.ts`](../tests/file-history.browser.test.ts), [`tests/file-batch-history.browser.test.ts`](../tests/file-batch-history.browser.test.ts) e [`tests/file-result-reuse.browser.test.ts`](../tests/file-result-reuse.browser.test.ts).
- Superficie del bridge usata: `host.profile`, `host.state`, `host.assets` - vedi [Host API](/info/host-api.html).
