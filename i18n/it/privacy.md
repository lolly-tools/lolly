# Informativa sulla privacy

*Ultimo aggiornamento: 11 agosto 2026*

> **La versione breve.** I documenti, le immagini, i video e i file che crei in Lolly restano
> sul tuo dispositivo. Non ci sono account per l'uso ordinario, nessun cookie dell'app
> stessa e nessuna analitica o tracciamento in nessun punto del codice - non "non usiamo
> i dati", ma proprio assenti dal codice sorgente. Esiste un elenco breve e completo
> di eccezioni in cui il software comunica con una rete, e ognuna
> di esse è descritta qui sotto nel dettaglio: cosa esce, verso chi e quando. L'unica
> eccezione che coinvolge qualcosa di personale è un accesso che devi avviare
> tu stesso, in modo esplicito. Se non è in questo documento, non succede.

## Cosa copre questa informativa

Lolly è un software open-source - un motore, diversi shell applicativi (web, desktop,
mobile, CLI) e un'estensione del browser - che chiunque può eseguire. Questa informativa ha due
parti:

- <!--i:code--> **Il software stesso**: cosa fa e cosa non fa con i tuoi dati, ovunque venga
  eseguito. È una proprietà del codice, quindi vale per ogni installazione di Lolly,
  la nostra o quella di chiunque altro.
- <!--i:server--> **lolly.tools**, l'installazione di riferimento gestita da SUSE: le scelte specifiche
  fatte nell'esecuzione dei suoi componenti server-side opzionali (cosa viene registrato, per quanto tempo, da
  chi).

Se stai usando un'istanza Lolly self-hosted o enterprise, il comportamento del software
descritto sotto si applica comunque, ma l'*operatore* di quell'istanza - non SUSE - è
responsabile per tutto ciò che è server-side: il loro endpoint di rendering, il loro server MCP,
la loro autorità di certificazione per Content Credentials, se ne gestiscono una. Chiedi a loro la
loro informativa. Vedi [Adozione e governance](/info/adoption-governance.html) per
cosa comporta gestire Lolly.

## L'app: cosa resta sul tuo dispositivo

Gli shell web, desktop e mobile di Lolly eseguono l'intero motore di rendering lato client.
Aprire uno strumento, compilare gli input, visualizzare l'anteprima ed esportare avviene tutto sul tuo
dispositivo - nessun server è coinvolto, e l'app funziona offline una volta caricata.

**L'app non imposta cookie.** Per funzionare, mantiene una piccola quantità di dati **solo
sul tuo dispositivo**, mai trasmessi:

- <!--i:sliders--> **Preferenze dell'interfaccia** - tema, lingua, impostazioni audio, dimensionamento
  della barra laterale/zoom, scelte di ordinamento e visualizzazione, quali suggerimenti di onboarding hai visto - in
  `localStorage`, così sono disponibili prima che l'app abbia finito l'avvio.
- <!--i:download--> **Una cache offline del catalogo strumenti e delle anteprime degli asset**, così la galleria
  funziona senza connessione.
- <!--i:hash--> **Contatori d'uso locali** per le statistiche della tua scheda profilo (quante esportazioni, quali
  strumenti) - un piccolo blob limitato in `localStorage`, mai letto da noi, mai inviato
  da nessuna parte.
- <!--i:folder--> **I tuoi documenti, sessioni salvate, asset e font caricati** - archiviati in
  IndexedDB sul tuo dispositivo, mai caricati, mai letti da nessuno tranne te.

Nulla di tutto ciò viene condiviso, venduto o usato per identificarti o tracciarti. Non c'è nulla
a cui acconsentire, perché non avviene alcuna raccolta - solo questo avviso, così sai
cosa viene conservato e dove. Cancella tutto in qualsiasi momento con **Profilo → Cancella tutti
i miei dati**, oppure cancellando l'archiviazione del sito nel tuo browser. (Secondo la Direttiva
ePrivacy Art. 5(3), l'archiviazione strettamente necessaria per il servizio richiesto
non richiede consenso - solo trasparenza, che è esattamente ciò che sono questo documento e
l'avviso nell'app.)

![La sezione archiviazione della pagina profilo su uno schermo largo quanto un telefono: ogni categoria di dati sul dispositivo è nominata, con il pulsante Cancella tutti i miei dati proprio accanto](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Il tuo backup personale di questi dati - il pacchetto `lolly-backup` prodotto da **Esporta i
miei dati e rendi tutto** - è un file che conservi e controlli tu. Non tocca mai i nostri
server a meno che tu non scelga di inviarlo da qualche parte tu stesso. Vedi [Trasferimento
dati](/info/data-transfer.html).

## Strumenti sul dispositivo

Alcuni strumenti - **Strip Hidden Data**, **Compress PDF** e altri con il badge
**"Runs on your device"** - operano su un file che fornisci tu. Il file viene letto
in memoria nel tuo browser, trasformato localmente e restituito come download.
Non viene mai caricato, perché non c'è alcun server nel percorso a cui caricarlo.
Questi strumenti funzionano offline, e il loro output non porta alcun watermark o metadato
nostro - lo scopo della maggior parte di essi è rimuovere e proteggere i dati, non aggiungere rischi.

![Il badge che questi strumenti portano: Runs on your device - niente viene caricato](/t/url-shot?url=%2F%23%2Ftool%2Fstrip-data&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=.on-device-badge&dark=1&filename=pv-ondevice-badge)

## Quando l'app comunica con una rete, in dettaglio

La tabella sotto è l'elenco completo di tutto ciò che l'app recupera o invia su una
rete. Se non è qui, l'app non lo fa.

| Cosa | Cosa lascia effettivamente il tuo dispositivo | Quando (l'azione che lo attiva) | Se un operatore lo blocca |
|---|---|---|---|
| Sincronizzazione del catalogo strumenti | Niente di personale - una richiesta per l'indice pubblico di strumenti e asset di Lolly, verso l'origine stessa dell'app | All'avvio, poi memorizzata in cache offline | L'app funziona con il proprio set di strumenti in cache. Smette solo di scoprire nuovi strumenti |
| Uno strumento che richiede dati in tempo reale | Qualsiasi cosa quello specifico strumento richieda, verso l'host indicato nella propria descrizione. Oggi si tratta solo della ricerca città nello strumento Meeting Planner, che interroga `geocoding-api.open-meteo.com` per trasformare un nome di città in coordinate e fuso orario - nessun account, nessuna chiave e nessun identificatore oltre alla richiesta stessa. Il campo lo indica proprio dove digiti, e ogni risposta viene salvata sul tuo dispositivo così una città viene cercata una sola volta | Solo mentre usi quello strumento, e solo dopo aver inserito una località | Quella singola ricerca fallisce. Puoi comunque digitare le coordinate a mano, e nient'altro viene interessato |
| Google Fonts | Il nome della famiglia di font scelta e il tuo indirizzo IP, verso i server font di Google (`fonts.googleapis.com` per il foglio di stile, `fonts.gstatic.com` per il file del font) | Solo se aggiungi un Google Font nell'editor del brand, **e solo dopo averlo accettato in una finestra di dialogo che dice esattamente questo** - un recupero una tantum per famiglia, poi risiede sul tuo dispositivo e viene usato offline | Il selettore Google Fonts fallisce in modo sicuro. Carica invece un file di font |
| Send to Google Drive | Il singolo file che hai scelto di inviare, verso l'API Drive di Google (`www.googleapis.com`), dopo un accesso Google che completi nella finestra popup di Google stessa. L'accesso di Lolly è limitato ai file che ha creato (l'ambito `drive.file` - non può mai leggere il resto del tuo Drive), e il token di accesso viene mantenuto in memoria per la sessione, mai salvato | Solo quando premi "Send to Google Drive" su un'esportazione EMF, e solo nelle build in cui l'operatore ha configurato un client id Google - senza il quale il pulsante non esiste | Il pulsante non compare mai. Scarica il file e caricalo tu stesso su Drive |
| Send to Dropbox | Il singolo file che hai scelto di inviare, verso l'API di Dropbox (`api.dropboxapi.com` per l'accesso e i metadati, `content.dropboxapi.com` per il file stesso), dopo un accesso Dropbox che completi nella finestra di Dropbox stessa. L'accesso di Lolly è limitato alla cartella dell'app (può vedere solo `Apps/` e la propria cartella al suo interno - mai il resto del tuo Dropbox), il link "Open" che ti mostra è un link privato a breve scadenza (non viene creata alcuna condivisione pubblica), e un token di aggiornamento viene salvato solo se selezioni "stay connected" | Solo quando premi "Send to Dropbox" su un file, e solo nelle build in cui l'operatore ha configurato un client id Dropbox - senza il quale il pulsante non esiste | Il pulsante non compare mai. Scarica il file e caricalo tu stesso su Dropbox |
| Send to OneDrive | Il singolo file che hai scelto di inviare, verso i servizi di identità e Graph di Microsoft (`login.microsoftonline.com` per l'accesso, `graph.microsoft.com` per il caricamento; un file di grandi dimensioni viene caricato a blocchi verso un indirizzo di caricamento di proprietà Microsoft su `api.onedrive.com`, `*.up.1drv.com` o `*.sharepoint.com`), dopo un accesso Microsoft che completi nella finestra di Microsoft stessa. L'accesso di Lolly è limitato alla propria cartella sotto `Apps/` (non può mai leggere il resto del tuo OneDrive) più il tuo nome visualizzato per l'etichetta dell'account, e un token di aggiornamento viene salvato solo se selezioni "stay connected" | Solo quando premi "Send to OneDrive" su un file, e solo nelle build in cui l'operatore ha configurato un client id Microsoft - senza il quale il pulsante non esiste | Il pulsante non compare mai. Scarica il file e caricalo tu stesso su OneDrive |
| Send to LinkedIn | Il singolo file che hai scelto di inviare, più il suo nome come testo del post, verso LinkedIn (`www.linkedin.com` per l'accesso, `api.linkedin.com` per il caricamento e il post), dopo un accesso LinkedIn che completi nel tuo stesso browser. Il post va sul tuo stesso feed come post pubblico a tuo nome. Lolly può pubblicare a tuo nome e leggere il tuo nome per l'etichetta dell'account, nient'altro sul tuo LinkedIn, e l'accesso viene mantenuto su questo dispositivo solo se selezioni "stay connected" - i token di LinkedIn durano 60 giorni e non possono essere rinnovati silenziosamente, quindi decadono da soli | Solo quando premi "Send to LinkedIn" su un file, solo nelle app desktop, e solo nelle build in cui è configurata un'app LinkedIn - senza la quale il pulsante non esiste | Niente da bloccare nell'app web: questo esiste solo nelle **app desktop**, quindi quei due host sono deliberatamente ASSENTI dalla Content-Security-Policy dell'app web qui sotto. Nelle app desktop, rimuovi l'app LinkedIn configurata e il pulsante non compare più |
| Profili di stampa ICC | Niente di personale - una richiesta per un profilo standard di condizione di stampa, verso il registro pubblico dell'ICC (`registry.color.org`, `www.color.org`) | Solo se clicchi un preset ICC nel gestore dei profili di stampa - un recupero una tantum per profilo, poi risiede sul tuo dispositivo | I preset ICC falliscono. Fornisci invece il tuo profilo `.icc` |
| Radio via Internet | Niente di personale - una richiesta di playlist e uno stream audio, verso la stazione (`api.somafm.com` e il server icecast che indica, `*.somafm.com`) | Solo mentre riproduci la radio integrata opzionale nel lettore audio | La radio fallisce. Ogni altra funzione audio continua a funzionare |
| Un URL che chiedi a uno strumento di catturare | Una richiesta all'esatto indirizzo web che digiti, dallo strumento di cattura schermata URL. Qualunque sia quell'indirizzo. Questo host non è nella policy qui sotto, perché lo scegli tu al momento dell'uso | Solo quando inserisci un URL in quello strumento e avvii la cattura | Un operatore non può inserirlo in una lista consentita per host. Per rimuoverlo, rimuovi lo strumento |
| Verifica firma SEAL | **Niente.** L'app web non ha alcun resolver DNS - vedi sotto | Mai | Niente da bloccare |
| Modelli AI on-device | Niente di personale - un download una tantum del file del modello dall'host dei modelli di Lolly (`lolli.li`), poi memorizzato in cache sul tuo dispositivo; nessun account, nessun identificatore, solo la richiesta e il tuo IP | Solo quando usi una funzione che richiede un modello (scansione approfondita di Verify, upscale immagine, voce e simili) | Quella funzione attende il download; tutto il resto continua a funzionare |
| Istanza remota | Qualsiasi cosa restituisca l'istanza che nomini, tramite la stessa sincronizzazione del catalogo descritta sopra - più un tag di versione sulle richieste che le invii (tipo di shell e versione del motore, la stessa informazione che porta uno user agent), così il suo operatore può vedere quali versioni di Lolly sono in circolazione. Su un'istanza gestita, mentre hai effettuato l'accesso, quel tag porta anche un id di installazione per dispositivo così l'elenco dispositivi dell'operatore può distinguere questa installazione. Viaggia solo sulle richieste che il tuo uso normale genera già - non c'è alcun timer e niente telefona a casa - e lasciare l'istanza elimina l'id, così un dispositivo che si riconnette in seguito ne presenta uno nuovo. Scegli tu l'host al momento dell'uso, quindi non è nella policy qui sotto | Solo se punti esplicitamente la shell verso un'altra installazione di Lolly | Il cambio istanza fallisce. La tua istanza locale non viene interessata |

Ogni host fisso in quella tabella è anche l'elenco completo consentito nella
Content-Security-Policy dell'app, che il browser applica. Quindi l'elenco non è solo una
descrizione di ciò che il codice fa oggi, è il confine a cui il browser vincola l'app: un
cambiamento futuro che provasse a contattare un altro host verrebbe bloccato, non permesso
silenziosamente. Una riga è l'eccezione deliberata, e la sua stessa cella lo dice: Send to
LinkedIn esiste solo nelle app desktop, quindi la policy dell'app web non nomina nessuno dei
suoi due host - l'app web non potrebbe raggiungerli anche se il suo codice ci provasse.
Altre due righe non hanno un host fisso, perché sei tu a scegliere
l'indirizzo al momento dell'uso: un URL che chiedi a uno strumento di catturare, e un'istanza
remota verso cui punti la shell. Nessuna delle due è nella policy, e ciascuna avviene solo
quando digiti un indirizzo e agisci su di esso. Un'installazione che non vuole nessuna delle
opzionali (un'istanza aziendale con i propri font, ad esempio) rimuove quegli
host dalla propria policy e le funzioni falliscono in modo sicuro invece di contattare l'esterno.

Nessuna di queste invia i tuoi documenti, progetti, sessioni o file caricati da nessuna parte.
Esistono per portare cose *verso* il tuo dispositivo (strumenti, font, modelli), mai per inviare
cose *da* esso, con le eccezioni nominate esplicitamente nelle sezioni sottostanti.

**Una nota su cosa abbiamo rimosso.** Verify può controllare le firme SEAL, uno schema in cui
la chiave di firma di un file viene pubblicata nel DNS. I browser non possono fare query DNS, quindi qualsiasi
implementazione web deve instradare la ricerca attraverso un resolver DNS-over-HTTPS di terze parti
- il che mostrerebbe a quell'operatore il dominio controllato più il tuo indirizzo IP. Un tempo usavamo
quello di Cloudflare. **Non lo facciamo più, e non c'è un sostituto**: l'app web ora
non passa alcun resolver, quindi la verifica SEAL qui non genera zero richieste di rete. I file il
cui record SEAL porta la chiave inline continuano a verificarsi completamente offline. I file la cui chiave risiede
nel DNS mostrano "nessun resolver di chiavi" invece, e puoi verificarli nell'app desktop o a riga di
comando, che risolvono il DNS nativamente attraverso la tua stessa macchina senza terze parti
coinvolte.

![La schermata Verify: un'area di rilascio e nient'altro - il file viene controllato dove già si trova, senza caricamento e senza account](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop) Puoi verificarlo tu stesso: controlli greppabili per questa e ogni
altra affermazione in questa pagina, con i comandi esatti e l'output atteso, si trovano su
[Verify It Yourself](/info/verify-yourself.html).

## URL di rendering incorporabili

> **Attivo su lolly.tools.** Ogni
> URL `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>` viene effettivamente
> renderizzato, e gli input viaggiano in quello stesso URL. La sezione sottostante
> spiega cosa significa questo per te, e un operatore può disattivare la
> funzionalità sulla propria istanza.

L'app stessa resta interamente sul tuo dispositivo. Separatamente, un operatore può abilitare
gli **URL di rendering incorporabili** - `/tool/<tool-id>.<ext>?<inputs>` - così un
link Lolly condiviso può apparire come un'immagine live in un README, un wiki o una dashboard. Recuperarne uno
chiede al server di renderizzare **dati pubblici di strumenti e catalogo** con gli input
scritti nell'URL.

- <!--i:usercheck--> **Nessun account, nessun cookie, nessuno stato.** L'endpoint è anonimo, e non
  viene letto nulla sul tuo dispositivo. I tuoi documenti, sessioni e caricamenti non escono mai dal tuo
  browser - non possono comparire in questi link in alcun modo.
- <!--i:document--> **Ma l'URL stesso viene registrato.** La stringa di query di un URL fa parte della riga di
  richiesta, quindi compare nei normali log di accesso della piattaforma di hosting, proprio come
  qualsiasi percorso richiesto. Se gli input di un link contengono il nome o l'email di qualcuno -
  un badge nominativo, una firma email - **quel testo finisce in quei log**, e nessuna
  formulazione della policy lo cambia. Quindi un URL hot-link è il posto sbagliato per dati
  personali: dagli solo ciò che metteresti su una pagina pubblica.
- <!--i:globe--> **Gli input sono comunque pubblici per costruzione** - sono ciò che chi ha creato
  il link ha digitato nell'URL, leggibile da chiunque raggiunga il link. Non inserire
  informazioni riservate in un link condiviso. Lolly offre la cifratura dei link per i contenuti sensibili.
- <!--i:eyeoff--> Le risposte vengono **memorizzate in cache e limitate nella velocità** come qualsiasi immagine pubblica, e contrassegnate
  come `noindex` così i motori di ricerca non indicizzano i tuoi render.

Fai self-hosting di Lolly e non vuoi una superficie di rendering pubblica? Imposta
`LOLLY_DISABLE_RENDER_GET=1` e ognuno
di questi URL restituisce 404.

## Il server MCP (opzionale, per agenti AI)

Lolly può anche essere raggiunto da un agente AI tramite il Model Context Protocol - un
endpoint gestito da un operatore (lolly.tools ne gestisce uno; chiunque può fare self-hosting del proprio,
anche completamente air-gapped). Condivide la postura senza account del percorso di rendering,
più tre strumenti che necessariamente gestiscono i byte dei file:

- <!--i:cpu--> **`lolly_transform`** (esegue uno strumento sul dispositivo lato server, per conto
  dell'agente chiamante), **`lolly_verify`** (controlla i Content Credentials) e **`lolly_redact`**
  (oscura regioni di un'immagine o di un PDF) accettano tutti
  i byte di un file dal chiamante. Vengono elaborati **in processo, in memoria**,
  e il risultato viene restituito in quella stessa chiamata - il file non viene mai scritto su
  disco e mai conservato una volta completata la richiesta.
- <!--i:checklist--> Ogni altro strumento - `lolly_render`, `lolly_build_url`, `lolly_list_tools`,
  `lolly_describe_tool` - funziona solo da parametri (testo, numeri, colori,
  URL, id di asset del catalogo), gli stessi input che accetta un URL di rendering incorporabile.
- <!--i:lock--> L'accesso è o un token condiviso che l'operatore rilascia ai client di cui si fida, oppure
  OAuth 2.1 stateless: token firmati a breve durata verificati contro un segreto
  condiviso, nulla archiviato lato server e il token stesso non viene mai scritto in un
  log o in un URL di rendering.

## Identità Content Credentials (un accesso che devi avviare tu stesso)

Lolly può sigillare una **Content Credential** crittografica nelle tue esportazioni così chiunque
può verificare, offline, che un file è inalterato da quando ha lasciato Lolly. Questo è
**attivo per impostazione predefinita e completamente locale** - la chiave di firma viene generata sul tuo dispositivo
e la firma stessa avviene offline. Senza iscrizione quella chiave è usa e getta:
una nuova coppia di chiavi generata per ogni esportazione e scartata con essa. Una volta iscritto, la
chiave diventa duratura e viene generata **non estraibile** - nemmeno il codice di Lolly
può leggerla, può solo chiederle di firmare. In entrambi i casi non lascia mai il tuo
dispositivo. Questa sezione copre l'unico passaggio *opzionale* in aggiunta a questo:
iscrivere un'identità verificata, così le tue esportazioni dicono "Verified - signed by
\<your email\>" invece di una chiave anonima. **Se salti l'iscrizione, nulla in
questa sezione ti riguarda, e nessun dato personale lascia mai il tuo dispositivo.**

![La scheda identità verificata nella pagina profilo, larghezza telefono: il selettore della durata del certificato e il passaggio di iscrizione sottostante, dormiente finché non lo avvii tu stesso](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Se ti iscrivi, ecco esattamente cosa succede:

1. **Scegli un metodo di accesso** - GitHub, Google, SUSE (id.suse.com) o un
   link inviato via email. Per i tre provider OIDC, vieni reindirizzato alla pagina di
   accesso di quel provider, governata dalla loro informativa sulla privacy, non dalla nostra.
   Il servizio certificati di Lolly riceve indietro solo un indirizzo email verificato e
   il nome del provider. Per il link via email, l'indirizzo che digiti viene passato a
   **Resend**, un'API email transazionale, solo per consegnare quel singolo link.
2. **Un cookie a breve durata protegge il reindirizzamento.** Questo è l'unico cookie che l'intero
   sistema Lolly imposta: `lolly_ca_state`, `HttpOnly`, con ambito `/api/ca`,
   in scadenza entro dieci minuti. Contiene un valore casuale, non un identificativo
   di tracciamento, ed esiste solo per impedire che il reindirizzamento OAuth venga falsificato. Viene
   cancellato appena l'accesso si completa.
3. **Il tuo indirizzo IP viene usato, brevemente, per prevenire abusi** degli endpoint
   di accesso (così uno script non può spammare una casella di posta o esaurire la quota email) - tenuto
   solo in memoria del server, per una finestra scorrevole di circa un minuto, mai scritto
   in un log o conservato in alcun modo.
4. **Il servizio certificati emette un certificato a breve durata** (7, 30, 90 o 365
   giorni, a tua scelta, limitato dalla policy dell'operatore) che lega la tua email verificata
   alla metà pubblica della coppia di chiavi generata sul tuo dispositivo. La metà privata
   non lascia mai il tuo browser.
5. **Nulla dell'emissione viene registrato.** Il servizio certificati non mantiene alcun log di
   emissione: non la tua email, non il provider, non un numero di serie, non un
   timestamp. Nessun database, nessuna riga di log, nessun webhook. Il tuo indirizzo email esiste nella
   richiesta solo abbastanza a lungo da essere scritto nel certificato che il tuo stesso
   dispositivo riceve, e poi è sparito completamente dal nostro lato.
6. **Dopo di ciò, la firma torna ad essere offline** per tutta la durata del certificato.
   Esportare un file non contatta mai il servizio certificati - solo l'iscrizione lo faceva.

**Il compromesso, detto chiaramente.** Una versione precedente di questo servizio registrava effettivamente ogni
emissione, così che un certificato mal rilasciato o compromesso potesse essere tracciato. L'abbiamo
rimosso, perché quel log era l'unico punto in tutto Lolly dove dati
personali venivano depositati su un server, e preferiamo non conservarli piuttosto che conservarli con cura. Ciò che rinunciamo è la tracciabilità lato server: se un certificato viene
usato in modo improprio non possiamo risalire a chi lo ha ottenuto. I certificati sono a breve durata per
progettazione - da 7 a 365 giorni, a tua scelta, limitato dall'operatore - e scadono da
soli, che è la mitigazione su cui facciamo affidamento invece. I self-hoster i cui
obblighi richiedono un log di audit possono aggiungerne uno, e diventare i titolari di quel
dato facendolo.

## L'estensione del browser

L'estensione del browser **Lolly URL Screenshot** non raccoglie, archivia o
trasmette alcun dato personale. Nessun analytics, nessun tracciamento, nessun server remoto.

**Cosa fa.** Quando chiedi all'app web di Lolly di catturare uno screenshot di un URL, l'
estensione apre quella pagina in una scheda in background temporanea, la cattura nel tuo
browser usando il DevTools Protocol, restituisce l'immagine all'app e chiude
la scheda. Tutto avviene localmente, sul tuo stesso dispositivo e sulla tua rete.

**Dati.**

- <!--i:shieldcheck--> **Non raccogliamo nulla.** L'estensione non ha server e non effettua alcuna
  richiesta di rete propria.
- <!--i:photos--> **Le immagini catturate** vanno direttamente all'app Lolly nello stesso browser - mai
  caricate dall'estensione.
- <!--i:link--> **Gli URL che catturi** sono usati solo per caricare quella singola pagina per quello singolo
  screenshot. Non vengono registrati né condivisi.

**Permessi.**

- <!--i:wrench--> **`debugger`** - per catturare la pagina renderizzata tramite il DevTools Protocol (lo
  stesso meccanismo usato dall'app desktop di Lolly).
- <!--i:monitor--> **`tabs`** - per aprire e chiudere la scheda temporanea in cui la pagina viene caricata.
- <!--i:globe--> **Accesso agli host (`<all_urls>`)** - perché la pagina che scegli di catturare può essere
  su qualsiasi sito. Chrome mostra questo al momento dell'installazione come un avviso di permesso
  ampio. L'estensione visita sempre e solo l'URL che le fornisci.

Nessuno di questi viene usato per leggere, monitorare o trasmettere la tua navigazione oltre
quella singola cattura richiesta.

## Log di infrastruttura

Come qualsiasi sito web, i server dietro lolly.tools - e dietro qualsiasi installazione
di Lolly - generano log di accesso web-server standard ogni volta che una richiesta li raggiunge:
indirizzo IP, percorso richiesto, timestamp, user agent. Questo è comportamento di hosting di base, non
qualcosa che Lolly aggiunge, e non contiene mai il
contenuto dei tuoi documenti, perché quelli non raggiungono mai un server. L'unica
eccezione deliberata è un file che consegni esplicitamente a una chiamata MCP
`lolly_transform`, `lolly_verify` o `lolly_redact`, che viene elaborato in memoria e mai
scritto su disco o in un log, come descritto sopra.

**Il codice di Lolly non scrive nulla in quei log.** Il server MCP non contiene alcuna
istruzione di logging. Il servizio certificati emette esattamente due righe, entrambe
in caso di fallimento ed entrambe deliberatamente ripulite: un codice di stato di invio fallito senza
indirizzo del destinatario, e un messaggio di errore senza stack trace o URL (uno stack potrebbe
portare un token di iscrizione). Tutto il resto nel log appartiene alla piattaforma di hosting,
non a noi.

Per lolly.tools, l'hosting è Vercel e la conservazione dei log di accesso segue le
impostazioni predefinite della piattaforma Vercel per il nostro piano. Non configuriamo alcun log drain, nessuna
esportazione dei log a lungo termine e nessun prodotto di analytics o monitoraggio in aggiunta. Non conserviamo alcuna copia di questi
log noi stessi, il che significa anche che non abbiamo modo di cercarli per te - vedi
[I tuoi diritti](#your-rights).

## Basi giuridiche, conservazione e destinatari

Quasi nulla qui richiede una base giuridica, perché quasi nulla viene trattato. Per
completezza, l'elenco completo:

| Trattamento | Base giuridica (GDPR Art. 6) | Conservato per |
|---|---|---|
| Tutto ciò che sta sul tuo dispositivo (documenti, preferenze, cache, contatori) | **Non è affatto un nostro trattamento** - non ci raggiunge mai. La memorizzazione sul tuo dispositivo è strettamente necessaria per il servizio che hai richiesto (ePrivacy Art. 5(3)), quindi non richiede consenso | Finché non lo elimini |
| Il tuo indirizzo email durante l'iscrizione a Content Credentials | **Art. 6(1)(b)**, esecuzione di un servizio da te esplicitamente richiesto | Non conservato. Presente in memoria solo per la durata della richiesta |
| Il tuo indirizzo IP sugli endpoint di accesso, per il rate limiting | **Art. 6(1)(f)**, il nostro legittimo interesse a prevenire l'abuso di un servizio gratuito e della quota email di terzi. Riteniamo che questo superi un test di bilanciamento perché resta solo in memoria, non viene mai scritto e viene scartato entro circa un minuto | ~1 minuto, in memoria del server, mai persistito |
| Log di accesso dell'hosting (IP, percorso, timestamp, user agent) | **Art. 6(1)(f)**, il nostro legittimo interesse alla sicurezza del servizio, alla prevenzione degli abusi e alla diagnosi dei guasti | Il default della piattaforma di Vercel per il nostro piano. Non aggiungiamo alcuna estrazione o esportazione |

**Destinatari.** Le categorie di destinatari sono: il nostro fornitore di hosting (Vercel
Inc.) e - solo se usi l'opzione di accesso via email - un fornitore di email
transazionali (Resend). Se accedi con GitHub, Google o SUSE (id.suse.com), interagisci
direttamente con quel fornitore secondo la sua privacy policy. Ci comunicano un
indirizzo email verificato e nient'altro. Non condividiamo dati personali con nessun
altro, e non vendiamo dati, non facciamo pubblicità né profilazione degli utenti.

**Trasferimenti fuori dallo SEE.** Vercel e Resend sono aziende statunitensi. Il compute
delle funzioni per lolly.tools è fissato sulla regione di Vercel a Francoforte (`fra1`),
quindi l'elaborazione avviene nell'UE, ma essendo fornitori con sede negli USA possono
comunque accedere ai dati come responsabili del trattamento dagli USA. Questi trasferimenti
si basano sulle Clausole Contrattuali Standard della Commissione Europea e/o sul
EU-US Data Privacy Framework, come indicato nell'accordo di trattamento dati di ciascun
fornitore. Poiché i dati personali che raggiungono ciascun fornitore sono così limitati -
un indirizzo email trasmesso per inviare un messaggio, e i normali log di accesso -
l'esposizione è corrispondentemente ridotta.

**Processo decisionale automatizzato.** Nessuno. Non c'è profilazione né alcuna decisione
automatizzata che produca effetti giuridici o similmente significativi (Art. 22).

## Privacy dei minori

Lolly non raccoglie consapevolmente informazioni personali da nessuno, di nessuna età,
nel normale uso dell'app - non c'è nulla da raccogliere. L'unico punto in cui vengono
mai raccolte informazioni personali (un indirizzo email) è l'iscrizione a Content
Credentials, descritta sopra, che non è rivolta né destinata ai minori.

## I tuoi diritti

Poiché quasi tutto ciò che Lolly tocca è memorizzato solo sul tuo dispositivo, la
maggior parte di ciò che la normativa sulla protezione dei dati chiama "i tuoi diritti" -
accesso, correzione, cancellazione, portabilità - sono cose che puoi già fare da solo,
istantaneamente, senza chiedere a nessuno: i tuoi dati vivono nello storage del tuo
browser, in una forma che puoi ispezionare, esportare (**Export my data & render
everything**, sopra) o eliminare (**Profile → Clear all my data**).

Formalmente, ai sensi degli Articoli 15-22 del GDPR hai il diritto di **accedere** ai
tuoi dati personali, di **rettificarli**, di **cancellarli**, di **limitare** o
**opporti** al loro trattamento (compresa l'opposizione a tutto ciò che basiamo su
legittimi interessi), alla **portabilità dei dati** e - dove il trattamento si basa
sul consenso - di **revocare quel consenso in qualsiasi momento**, senza pregiudicare
la liceità di quanto avvenuto prima della revoca.

Ecco la posizione onesta sull'esercizio di questi diritti nei nostri confronti.
Poiché non teniamo più un registro delle emissioni, **non deteniamo alcun dato
personale su di te che possiamo consultare, correggere, esportare o eliminare.**
Se ci scrivi per chiedere cosa abbiamo su di te, la risposta sincera è nulla, e
te lo diremo. L'unica categoria che esiste è costituita dai log di accesso
dell'hosting associati a un indirizzo IP, detenuti dal nostro fornitore di
hosting secondo i suoi default di conservazione. Non abbiamo alcuno strumento
per cercarli o eliminarli selettivamente, e te lo diremo piuttosto che fingere
il contrario. Tutto ciò che è realmente *tuo* è sul tuo dispositivo, dove puoi
già leggerlo, esportarlo e distruggerlo senza chiedere il permesso a nessuno.

**Hai il diritto di presentare reclamo.** Se ritieni che abbiamo gestito i tuoi
dati in modo scorretto, puoi presentare un reclamo a un'autorità di controllo
per la protezione dei dati - nell'UE, l'autorità del tuo paese di residenza, di
lavoro o dove ritieni sia avvenuta la violazione (Art. 77). La nostra autorità
di controllo capofila è il *Bayerisches Landesamt für Datenschutzaufsicht*
(BayLDA) ad Ansbach, Germania. Non serve contattarci prima, anche se ci
piacerebbe avere l'occasione di correggere il problema.

Non vendiamo dati. Non ne abbiamo da vendere.

## Modifiche a questa policy

La data in cima cambia ogni volta che questo documento cambia. Una modifica che
altera cosa esce dal tuo dispositivo o cosa viene conservato ottiene una propria
riga qui, non una modifica silenziosa - se vuoi vedere cosa è cambiato, chiedi
(sotto) o confronta con la [fonte pubblica](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md).

## Chi è responsabile e come contattarci

Il **titolare del trattamento** per lolly.tools è:

> SUSE Software Solutions Germany GmbH
> Frankenstraße 146
> 90461 Nürnberg
> Germania

SUSE ha nominato un **Responsabile della Protezione dei Dati**, raggiungibile a
[privacy@suse.com](mailto:privacy@suse.com). Usa questo indirizzo per qualsiasi
richiesta formale ai sensi di "I tuoi diritti" sopra.

Per qualsiasi cosa riguardo Lolly stesso - come funziona, perché una cosa è
fatta in un certo modo o una correzione a questo documento - contatta **Andy
Fitzsimon**, [fitzy@suse.com](mailto:fitzy@suse.com).

Per un'istanza Lolly self-hosted o enterprise, contatta invece chi la gestisce:
l'operatore è il titolare del trattamento per il proprio deployment. SUSE e il
progetto open source Lolly non detengono dati per i deployment che non gestiscono.
