# Verifica tu stesso

Ogni promessa su questo sito può essere verificata, senza account. La maggior parte dei controlli richiede solo un browser; gli altri richiedono un terminale e una copia del codice sorgente. Se uno dei controlli qui sotto non dà il risultato mostrato, è un bug o una promessa non mantenuta e vogliamo saperlo: vedi [Se un controllo fallisce](#if-a-check-fails).

Questi controlli riguardano Lolly da solo. Se la tua organizzazione usa Lolly Work, questo aggiunge accesso con autenticazione, contenuti condivisi, telemetria configurata e record di audit; confrontali con [Superficie del server](/info/server-surface.html) e con la [sezione dell'informativa sulla privacy dedicata all'organizzazione](/info/privacy.html#organisation-services-with-lolly-work).

<!--i:eti-clock-->
## Guardalo funzionare, in dieci secondi

Apri [`/verify`](/#/verify) e trascina un file sulla pagina. Non c'è caricamento su un server, né account né attesa di un server. Qui verifica la [tempesta generata nel Queensland](/info/ai-stance.html) dalla pagina La nostra posizione sull'AI: un'immagine generata da Gemini, che Lolly ha aperto, contrassegnato e convertito. Ogni badge è stato determinato sul dispositivo, dai byte del file stesso.

![Lolly Verify su uno schermo largo quanto un telefono - l'immagine della tempesta, un verdetto verde Made with Lolly e i badge della credenziale intatta e dei byte invariati impilati sotto](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Il verdetto è un piccolo insieme di badge, ciascuno un fatto indipendente:

- <!--i:lock--> **Made with Lolly**: la credenziale è intatta *e* registra un'esportazione di Lolly.
- <!--i:seal--> **The credential is intact**: il manifest C2PA firmato viene analizzato correttamente e la firma della sua dichiarazione viene verificata.
- <!--i:hash--> **The bytes have not changed**: l'hash del file corrisponde ancora a ciò che è stato firmato. Modifica un pixel e questo badge cambia.
- <!--i:sparkle--> **GEN AI**: una macchina ha creato questi pixel e il file lo dichiara. Lolly legge quella dichiarazione dal file invece di nascondere il fatto.

L'intera cronologia viaggia con il file. Qui restano nove passaggi: cinque registrati da Google mentre generava l'immagine e vi applicava una filigrana, poi quattro registrati da Lolly mentre apriva, contrassegnava e convertiva la copia su questa pagina. Lolly Verify li legge direttamente dai byte e li disegna come una timeline.

![La cronologia delle modifiche che Lolly Verify legge dall'immagine della tempesta - cinque passaggi registrati da Google, poi quattro da Lolly, fino al WebP su questa pagina](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

I controlli qui sotto sono le garanzie alla base di quella demo e ciascuno è riproducibile. [Content Credentials](/info/content-credentials-identity.html) spiega ogni verdetto.

<!--i:eti-globe-->
## Nel tuo browser, senza bisogno di strumenti

::: timeline
- <!--i:globe--> **1. Osserva la rete.** Apri [lolly.tools](https://lolly.tools), apri i DevTools del browser (F12), passa a **Network** e usa uno strumento: digita un indirizzo web in [Lolly QR Code](/t/qr-code), cambia i colori, esporta un PNG. Ogni richiesta va a `lolly.tools`: la shell dell'app, i file dello strumento e le risorse del catalogo. Non c'è un host per l'analisi, né un beacon CDN, un servizio di font o un endpoint per la segnalazione degli errori. Ciò che digiti in uno strumento non compare in **nessuna richiesta**, perché il rendering è locale.
- <!--i:eyeoff--> **2. Stacca la spina.** Carica l'app e apri uno o due strumenti, poi passa offline (modalità aereo o DevTools → Network → Offline) e ricarica. La galleria e ogni strumento che hai aperto continuano a funzionare, compresi rendering ed esportazione nei formati che hai usato. I file di uno strumento e il codificatore di un formato vengono memorizzati nella cache al primo utilizzo, quindi usa uno strumento una volta online prima di provarlo offline. È il singolo controllo più forte di questa pagina: un software che comunica con un server remoto non resiste quando gli si taglia il cavo.
- <!--i:check--> **3. Conta i cookie.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. L'elenco è vuoto: l'app non imposta cookie. Incolla `document.cookie` nella console e ottieni `""`. L'iscrizione facoltativa alla CA imposta un cookie `HttpOnly` di breve durata, `lolly_ca_state`, limitato a `/api/ca`, che `document.cookie` non può mostrare. Un'istanza di Lolly Work usa i propri cookie di accesso; confrontali con [Privacy](/info/privacy.html#organisation-services-with-lolly-work).
- <!--i:layers--> **4. Leggi la tua archiviazione.** Nello stesso pannello hai davanti tutto ciò che Lolly conserva: un paio di dozzine di semplici chiavi di `localStorage` (tema, lingua, larghezza della barra laterale, impostazioni audio e di visualizzazione e una copia in cache dell'indice pubblico del catalogo degli strumenti) e i tuoi documenti in IndexedDB. Ogni valore è una stringa leggibile o JSON, senza nulla di offuscato. Cancellare i dati del sito rimuove questi record locali, ma non un backup di Sync o i record archiviati da un'istanza di Lolly Work. **Settings → Storage → Clear all my data** fa lo stesso dall'interno dell'app e puoi osservare gli archivi e le cache svuotarsi.
- <!--i:lock--> **5. Verifica che esista il contatto per la segnalazione delle vulnerabilità.** [`/.well-known/security.txt`](/.well-known/security.txt) risponde con un blocco di contatto [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), non con una pagina HTML.
:::

::: details Cos'altro potresti vedere nella scheda Network
Alcune funzioni accedono alla rete solo quando le usi e ciascuna è visibile nella stessa scheda:

- aggiungere un **Google Font** in Lolly Design System Setup recupera da Google solo quella famiglia, dopo una finestra di consenso che lo dichiara, una sola volta, prima del primo recupero;
- fare clic su un **preset di profilo ICC per la stampa** recupera quel profilo dal registro pubblico dell'ICC su color.org;
- ascoltare la **radio** integrata facoltativa riproduce lo streaming dell'emittente;
- inserire una località in **Meeting Planner** la cerca nel servizio di geocodifica di open-meteo per trovarne coordinate e fuso orario, una volta per città (le risposte vengono salvate sul tuo dispositivo), e il campo lo indica dove digiti;
- **Lolly URL Screenshot** carica l'indirizzo che hai digitato e puoi osservarlo.

Uno strumento che dichiara una capacità di rete può recuperare dati solo dagli host consentiti dal suo manifest e quel controllo blocca l'accesso in caso di errore. Nessuno strumento distribuito oggi ne dichiara una, quindi la Content-Security-Policy applicata dal browser limita l'elenco qui sopra ai relativi host. L'[informativa sulla privacy](/info/privacy.html) contiene la tabella canonica di tutti questi elementi, compreso il traffico delle istanze gestite, come gli aggiornamenti delle policy e le segnalazioni abilitate.
:::

<!--i:eti-code-->
## Da un terminale

**6. L'endpoint di rendering risponde solo con dati pubblici.** L'unica funzione del server che inserisce gli input digitati in un URL, i rendering tramite hot-link, è attiva qui. L'[informativa sulla privacy](/info/privacy.html) spiega cosa significa per gli input che inserisci in un link.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Ogni deployment sceglie (`LOLLY_DISABLE_RENDER_GET=1`): su un'istanza che imposta la variabile, la stessa verifica restituisce `404`. Quella differenza indica che l'impostazione funziona, non è un'incoerenza.

**7. Controlla i servizi abilitati dal tuo deployment.** [Superficie del server](/info/server-surface.html) elenca i servizi facoltativi e rimanda ai loro riferimenti dettagliati. Per Lolly Work, includi le sue API autenticate, la connessione di collaborazione, l'archiviazione e i fornitori configurati. Una verifica del sito pubblico lolly.tools non testa un'istanza privata dell'organizzazione.

Se gestisci una tua istanza, [Deployment della consegna](/info/deploy-delivery.html) contiene i controlli per il rilascio: integrità del modello, verifica dell'edge e relativo elenco di campioni, versioni per la visualizzazione, gateway privato per i download e catalogo firmato in un browser.


<!--i:eti-search-->
## Nel codice sorgente

Tutto quanto sopra potrebbe ancora essere una messinscena se il codice distribuito fosse diverso da quello pubblico. Quindi controlla il codice. Il deployment viene compilato dal [repository pubblico](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Nessun tracker e nessun SDK di analisi, da nessuna parte.** Cerca i soliti sospetti nel codice distribuito (il motore, ogni shell compresa l'estensione del browser, gli override del bridge Tauri e il service worker, le funzioni del server e i pacchetti di strumenti):

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

Questa scansione cerca SDK di tracciamento di terze parti. Non dimostra l'assenza di report sull'uso raccolti direttamente: Lolly Work supporta la telemetria dell'organizzazione e un registro di audit separato, con policy e test propri.

**9. Nessun resolver DNS di terze parti.** Il controllo SEAL di Lolly Verify non invia mai una richiesta di risoluzione tramite un fornitore DNS-over-HTTPS, perché l'app non ha un resolver:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Il servizio dei certificati non conserva un registro delle emissioni.** La CA di identità non conserva un registro di ciò che ha emesso né un inventario delle identità: nessuna riga su stdout, nessun webhook, nessun archivio di certificati. Puoi cercarne l'assenza:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

La CA conserva uno stato di lavoro di breve durata: i bucket di limitazione delle richieste memorizzano le chiavi IP ed email sotto forma di hash per la durata della loro finestra e l'archivio di ammissione di un deployment gestito conserva un identificatore ottenuto con una chiave e un digest della richiesta per al massimo dieci minuti. [Ingegneria di Content Credentials](/info/content-credentials-engineering.html#protocol) contiene i dettagli.

<!--i:eti-flask-->
## Garantito dai test

I controlli sul codice sorgente qui sopra non sono un audit una tantum: sono fissati nella suite di test, così non possono degradarsi senza che si noti. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) controlla un elenco di nomi di tracker più lungo della scansione qui sopra e fa fallire la build se:

- un qualsiasi SDK di analisi o tracciamento compare in qualunque punto del codice sorgente distribuito che esamina, nel codice dell'app, del motore, del server, dell'estensione e dei pacchetti di strumenti;
- un qualsiasi resolver DNS-over-HTTPS di terze parti compare in quel codice sorgente;
- il registro delle emissioni della CA ricompare, nel codice sorgente **o** nel bundle del server generato;
- l'informativa sulla privacy perde le dichiarazioni richieste per legge (titolare del trattamento identificato, base giuridica, diritto di reclamo).

Eseguili tu stesso nel clone (Node 22.18 o successivo; questo file non richiede `pnpm install`):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

La suite completa (`pnpm install && pnpm test`) ne esegue diverse altre migliaia, compresi i test crittografici avversariali descritti in [Sicurezza & verifica](/info/security.html).

<!--i:eti-eye-off-->
## Cosa non puoi verificare dall'esterno

- **Log di accesso dell'hosting.** Qualsiasi server può registrare le richieste a cui risponde: indirizzo IP, percorso e ora. Una verifica esterna non può stabilire per quanto tempo vengano conservati i log. L'operatore controlla registrazione, rotazione ed esportazioni e deve dichiarare quelle scelte. Il rendering locale mantiene le normali modifiche sul tuo dispositivo; il rendering facoltativo sul server e i servizi dello spazio di lavoro condiviso hanno i flussi di dati separati descritti nell'informativa sulla privacy.
- **Che il deployment esegua questo codice.** Puoi verificare che il codice sorgente sia pulito e che il comportamento del deployment corrisponda al sorgente, e i controlli qui sopra fanno entrambe le cose. La piattaforma web non offre un'attestazione a livello binario di un deployment web. Le misure di mitigazione sono il repository pubblico, i test obbligatori e il controllo offline: un deployment manomesso che comunica con un server remoto fallisce subito i controlli 1 e 2.
- **Hook degli strumenti.** La logica facoltativa di uno strumento integrato viene revisionata anziché isolata in una sandbox: viene eseguita nella pagina, a meno che lo strumento non scelga un Worker. Ogni strumento su lolly.tools è sviluppato dal progetto e revisionato prima del rilascio. Il [Modello di minaccia](/info/threat-model.html#trust-boundaries) indica dove vengono eseguiti gli hook e cosa li limita.

<!--i:eti-warning-->
## Se un controllo fallisce

Una differenza tra questa pagina e ciò che osservi è una segnalazione di sicurezza. Inviala attraverso i canali privati in [Sicurezza & verifica](/info/security.html#reporting-a-vulnerability). Pratichiamo la divulgazione coordinata e riconosciamo il contributo di chi segnala.
