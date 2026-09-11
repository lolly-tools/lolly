# Trasferimento dati - il bundle `lolly-backup`

Tutto ciò che un utente Lolly accumula vive **sul suo dispositivo** - nessun account, nessun cloud. Il bundle di trasferimento dati è come quel valore si sposta: esportalo su un'installazione, porta il file con qualsiasi mezzo (USB, AirDrop, email a te stesso, una condivisione di rete) e importalo su un'altra. Il file *è* il trasporto. La destinazione può essere offline o online. Non fa differenza, perché nulla parla mai con un server.

![I due pulsanti che spostano un'intera installazione: Esporta i miei dati scrive uno zip, Importa dati lo rilegge](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Questa pagina è la specifica del formato. Per la guida passo passo pensata per l'utente finale vedi [Usare Lolly → Passare a un altro dispositivo](/info/using.html). L'implementazione è in [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts), e [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) fissa il contratto di andata e ritorno.

> **Ambito.** Un bundle trasporta *dati utente*, non strumenti. Strumenti e asset di catalogo sono sincronizzati separatamente e si presume siano già presenti sulla destinazione (nel peggiore dei casi in una versione più recente). L'importazione non installa né aggiorna mai uno strumento.

## Obiettivi

- <!--i:box--> **Un formato, ogni shell.** Gli stessi byte vengono prodotti e consumati dalla PWA web, dalle app desktop/mobile Tauri e da qualsiasi shell futura. Il bundle è il contratto. Il bridge delle funzionalità di ogni shell è l'adattatore per piattaforma dietro di esso.
- <!--i:shieldcheck--> **Sopravvive al viaggio.** Un bundle danneggiato o troncato durante il trasporto fallisce in modo evidente all'importazione, mai un ripristino parziale.
- <!--i:clock--> **Sopravvive a questa versione.** Un'app più vecchia può comunque importare le parti riconosciute di un bundle più recente. Un formato realmente incompatibile viene rifiutato in modo pulito.
- <!--i:check--> **Sicuro da unire.** Importare su un'installazione già in uso non cancella mai nulla che non era nel bundle.

## La busta

Un bundle è un semplice `.zip`. Il download prende il nome della persona a cui appartiene - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (ad esempio `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - così una cartella Download piena di backup resta leggibile. Le parti nome e cognome provengono dal profilo e vengono omesse se non impostate. Senza profilo si ottiene `LollyTools-2026-06-26-1.zip`, e con il solo nome si ottiene `LollyTools-Ada-2026-06-26-1.zip`. Ogni parte viene sanificata in un token sicuro per i nomi file (lettere/cifre Unicode mantenute, spazi/punteggiatura rimossi, limite di 32 caratteri). `<n>` è una sequenza giornaliera per dispositivo, così esportazioni ripetute nello stesso giorno non collidono e restano in ordine. `backupFilename()` in [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) costruisce il nome. Il contenuto dello zip è identico indipendentemente dal nome. All'interno:

| Percorso | Obbligatorio | Contenuto |
|---|---|---|
| `manifest.json` | sì | Id del formato, versioni, conteggi e integrità per parte. La prima cosa che un lettore controlla. |
| `profile.json` | quando impostato | Il record `me` dell'utente (nome, contatto, riferimento alla foto, flag). Letto tramite `host.profile`. |
| `sessions.json` | sì | Ogni sessione salvata: slot, id/versione dello strumento, etichetta, miniatura (data-URL) e dati di input completi. Letto tramite `host.state`. |
| `assets.json` | sì | Metadati per ogni asset caricato (immagini, font, token di brand), ciascuno che punta ai suoi byte sotto `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | per asset | I byte grezzi dell'asset (file immagine e font). Memorizzati non compressi (formati già compressi). L'estensione è cosmetica. Il MIME in `assets.json` è quello autorevole. |
| `prefs.json` | sì | Preferenze locali di proprietà dell'utente: `theme`, `sidebarWidth` e il conteggio attività `ct-metrics`. |
| `lolly.txt` | sì | Un riepilogo leggibile del bundle (conteggi, profilo, nome file) per chiunque apra lo zip senza Lolly. Rigenerato a ogni esportazione e riconosciuto all'importazione, quindi non conta mai come parte saltata. È scritto *dopo* la mappa di integrità, quindi ne resta fuori. |

Il bundle è di proposito un semplice zip: sopravvive intatto a qualsiasi trasporto, e qualsiasi strumento di estrazione può ispezionarlo.

`profile.json` è la parte più piccola e la prima che un lettore vede nell'app: i dati che un produttore compila una volta, più l'opt-in che permette agli strumenti di usarli.

![Il modulo dei dettagli del profilo che diventa profile.json - nome, contatto, foto e l'opt-in accanto](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 1,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.webp": "sha256-…",
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
- Nulla che non era nel bundle viene toccato. Una sessione presente sulla destinazione ma non nel bundle sopravvive all'importazione.

Le sessioni salvate si ricollegano automaticamente alle proprie immagini: i riferimenti agli asset sono mantenuti tramite id, e il bridge li ririsolve dopo che le immagini caricate sono state ripristinate (deve farlo comunque, perché gli URL `blob:` non sopravvivono a un ricaricamento).

Il riepilogo dell'importazione riporta `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`. `failedAssets` conta gli asset caricati che non è stato possibile ripristinare (per esempio archiviazione del dispositivo piena). È distinto da `skipped`, che conta le parti provenienti da uno scrittore più recente e compatibile in avanti che questa build non ha riconosciuto. L'interfaccia mostra `skipped` ("… · N elementi più recenti saltati"), così il ripristino è onesto su cosa ha lasciato indietro.

## Cosa non viaggia

- **Cache del catalogo** (metadati e blob degli asset scaricati, l'indice degli strumenti) - risincronizzati gratuitamente sulla destinazione.
- **Strumenti e asset di brand** - fuori ambito, e si presume già presenti sulla destinazione.
- **URL `blob:` / object URL** - rigenerati dal bridge al caricamento.
- **Il contatore di sequenza di esportazione** - il contatore locale di denominazione dei download per giorno (chiave `localStorage` `lolly-export-seq`) è una comodità locale di denominazione. È tenuto fuori da `PREF_KEYS`, quindi non viaggia mai in un bundle.

Il misuratore di archiviazione elenca la stessa suddivisione. Le sessioni salvate e Le mie immagini viaggiano in un bundle. La cache degli asset, le anteprime degli strumenti e i pin offline sotto di esse sono tutti riderivabili, quindi restano indietro.

![Il misuratore di archiviazione che suddivide i dati di questo dispositivo in categorie con nome, con Sessioni salvate e Le mie immagini tracciate separatamente dalla Cache asset, qui su un'installazione appena fatta dove ogni categoria è ancora vuota](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=.store-manages%2C.storage-subsection%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&walker=1&dark=1&filename=ce-storage-categories)

## Garanzia tra shell

`data-transfer.ts` legge e scrive esclusivamente attraverso il capability bridge (`host.profile`, `host.state`, `host.assets`) e le preferenze condivise in `localStorage`. Poiché il bridge è l'unico punto di contatto, lo *stesso* modulo produce un bundle identico byte per byte su ogni shell, anche se lo storage sottostante differisce - IndexedDB sul web, il filesystem su Tauri. Le shell Tauri riusano questo modulo senza modifiche. Solo la loro implementazione di `host.state` differisce. Il test headless esegue il round-trip completo su un bridge in memoria, per questo vale come rappresentante di tutte.

Due shell restano fuori da questa garanzia, per motivi diversi:

- La **CLI one-shot** non ha nulla da conservare - il suo stato è in memoria ed effimero per ogni invocazione.
- La **TUI** persiste effettivamente lo stato (`~/.lolly`: sessioni, cartelle, profilo) e la sua vista Profilo può farne il backup, ma scrive un archivio *più semplice*, tutto suo: `sessions/<slot>.json` per sessione più `profile.json` e `folders.json`, senza manifest, senza `formatVersion`/`minReader` e senza mappa di integrità. **Non** è importabile in questo formato - un lettore lo respinge come "not a Lolly backup" - e crea confusione perché usa un nome simile (`lolly-backup-<stamp>.zip`). Unificare i due è una lacuna nota.

## Punti di estensione riservati

L'involucro è un manifest più un insieme di parti nominate, per design, così che nuovi tipi di dati portabili possano appoggiarsi su di esso in futuro **senza una modifica incompatibile**. Si inseriscono come parti additive (nuovo `formatVersion`, stesso `minReader`), e il lettore odierno salta ciò che non riconosce. Sono nella [roadmap](/info/overview.html#roadmap), non ancora implementati. I nomi sono riservati qui affinché il formato resti coerente quando verranno introdotti.

- **`tokens.json` - design token.** Un documento di design token [W3C DTCG](https://tr.designtokens.org/format/) (il formato che [Penpot importa ed esporta](https://help.penpot.app/user-guide/design-systems/design-tokens/) - token con `$value`/`$type`/`$description`, organizzati in gruppi, set e temi). Un set di token nel bundle permette a un utente di spostare i propri elementi primitivi di brand tra installazioni insieme alle sessioni. Nel lungo periodo, un set di token ingerito diventerà una sorgente di prima classe rispetto a cui strumenti e asset di palette si risolveranno.
- **`penpot/` - file Penpot ingeriti.** Una directory riservata per un file Penpot (o il suo sottoinsieme estratto, rilevante per Lolly) importato ed esposto *come strumento*. Il bundle porterà con sé la definizione ingerita, così viaggia insieme al resto dei dati dell'utente.

Qualsiasi cosa al di fuori di questi nomi riservati e delle parti sopra elencate è, per un lettore, una parte sconosciuta: lasciata intatta e conteggiata in `skipped`.

## Riferimento

- Modulo: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - il nominatore `backupFilename()` è interno).
- Test di contratto: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - casi di round-trip, merge, integrità, compatibilità futura e blocco del lettore.
- Superficie del bridge usata: `host.profile`, `host.state`, `host.assets` - vedi [Host API](/info/host-api.html).
