# Verificalo tu stesso

Ogni promessa di questo sito può essere verificata, senza account. La maggior parte dei controlli richiede solo un browser; gli altri richiedono un terminale e una copia del sorgente. Se un controllo qui sotto non dà il risultato indicato, è un bug o una promessa non mantenuta, e vogliamo saperlo: vedi [If a check fails](#if-a-check-fails).

Parti dal più rapido: trascina un file su Verify. Poi vai oltre: osserva la rete mentre usi uno strumento, stacca la spina e continua a lavorare, conta i cookie e leggi il sorgente.

Questi controlli riguardano Lolly da solo. Se la tua organizzazione usa Lolly Work, esso aggiunge accesso, contenuti condivisi, telemetria configurata e record di audit; verificali rispetto a [Server Surface](/info/server-surface.html) e alla [sezione sull'organizzazione dell'informativa sulla privacy](/info/privacy.html#organisation-services-with-lolly-work).

## Guardalo funzionare, in dieci secondi

Apri [`/verify`](/#/verify) e trascina un file sulla pagina. Nessun caricamento, nessun account e nessuna attesa di un server. Qui controlla la [tempesta del Queensland generata](/info/ai-stance.html) da Our AI Stance: un'immagine generata da Gemini, che Lolly ha aperto, marcato e convertito. Ogni badge è stato calcolato sul dispositivo, dai byte del file stesso.

![Verify su uno schermo largo quanto un telefono - l'immagine della tempesta, un verdetto verde Made with Lolly e i badge di credenziale intatta e byte invariati impilati sotto](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Il verdetto è un piccolo mucchio di badge, ciascuno un fatto indipendente:

- <!--i:lock--> **Made with Lolly**: la credenziale è intatta *e* registra un'esportazione di Lolly.
- <!--i:seal--> **The credential is intact**: il manifest C2PA firmato viene letto e la firma della sua stessa dichiarazione si verifica.
- <!--i:hash--> **The bytes have not changed**: l'hash del file corrisponde ancora a ciò che è stato firmato. Altera un pixel e questo badge cambia.
- <!--i:sparkle--> **GEN AI**: una macchina ha creato questi pixel, e il file lo dice. Lolly rilegge quella dichiarazione anziché nascondere il fatto.

L'intera storia viaggia con il file. Qui sopravvivono nove passaggi: cinque che Google ha registrato mentre generava e marchiava l'immagine, poi quattro che Lolly ha registrato mentre apriva, marcava e convertiva la copia su questa pagina. Verify li legge direttamente dai byte e li disegna come una timeline.

![La cronologia delle modifiche che Verify legge dall'immagine della tempesta - cinque passaggi registrati da Google, poi quattro da Lolly, terminando nel WebP di questa pagina](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Questa è la demo. I controlli che seguono sono le garanzie sottostanti, e ciascuno è riproducibile. [Content Credentials](/info/content-credentials-identity.html) spiega ogni verdetto.

## Nel tuo browser, senza strumenti

::: timeline
- <!--i:globe--> **1. Osserva la rete.** Apri [lolly.tools](https://lolly.tools), apri i DevTools del tuo browser (F12), passa a **Network** e usa uno strumento: digita un indirizzo web in [QR Code](/t/qr-code), cambia i colori, esporta un PNG. Ogni richiesta resta su `lolly.tools`: la shell dell'app, i file propri dello strumento e le risorse del catalogo. Non c'è alcun host di analytics, nessun beacon di CDN, nessun servizio di font e nessun endpoint di segnalazione errori. Ciò che digiti in uno strumento non compare in **nessuna richiesta**, perché il rendering è locale.
- <!--i:eyeoff--> **2. Stacca la spina.** Carica l'app e apri uno o due strumenti, poi vai offline (modalità aereo, oppure DevTools → Network → Offline) e ricarica. La galleria e ogni strumento che hai aperto continuano a funzionare, compresi rendering ed esportazione nei formati che hai usato. I file di uno strumento e l'encoder di un formato vengono messi in cache la prima volta che li usi, quindi usa uno strumento una volta online prima di provarlo offline. È il controllo singolo più forte di questa pagina: il software che telefona a casa non sopravvive al taglio del cavo.
- <!--i:check--> **3. Conta i cookie.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. L'elenco è vuoto: l'app non imposta cookie. Incolla `document.cookie` nella console e ottieni `""`. L'iscrizione facoltativa alla CA imposta un cookie `HttpOnly` di breve durata, `lolly_ca_state`, limitato a `/api/ca`, che `document.cookie` non può mostrare. Un'istanza Lolly Work usa propri cookie di accesso; confrontali con [Privacy](/info/privacy.html#organisation-services-with-lolly-work).
- <!--i:layers--> **4. Leggi la tua archiviazione.** Nello stesso pannello, tutto ciò che Lolly conserva è davanti a te: un paio di dozzine di semplici chiavi `localStorage` (tema, lingua, larghezza della barra laterale, impostazioni di suono e vista, e una copia in cache dell'indice pubblico del catalogo degli strumenti) e i tuoi documenti in IndexedDB. Ogni valore è una stringa o un JSON leggibile, senza nulla di offuscato. Cancellare i dati del sito rimuove questi record locali, ma non un backup di Sync né i record conservati da un'istanza Lolly Work. **Settings → Storage → Clear all my data** fa lo stesso dall'interno dell'app, e puoi guardare gli archivi e le cache svuotarsi.
- <!--i:lock--> **5. Verifica che il contatto per le segnalazioni esista.** [`/.well-known/security.txt`](/.well-known/security.txt) risponde con un blocco di contatto [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), non con una pagina HTML.
:::

::: details Cos'altro puoi vedere nella scheda Network
Alcune funzioni raggiungono la rete solo quando le usi, e ciascuna è visibile nella stessa scheda:

- aggiungere un **Google Font** in Design System Setup scarica quella famiglia da Google, dopo una finestra di consenso che lo dice, una volta, prima del primo recupero;
- fare clic su un **preset di profilo di stampa ICC** scarica quel profilo dal registro pubblico dell'ICC su color.org;
- riprodurre la **radio** integrata facoltativa trasmette in streaming dalla stazione;
- inserire un luogo in **Meeting Planner** lo cerca nel servizio di geocodifica di open-meteo per coordinate e fuso orario, una volta per città (le risposte sono salvate sul tuo dispositivo), e il campo lo dice dove digiti;
- **URL Screenshot** carica l'indirizzo che hai digitato, perché è il suo compito, e lo vedi accadere.

Uno strumento che dichiara una capacità di rete può scaricare solo dagli host che il suo manifest ammette in allowlist, e quel controllo fallisce in modo sicuro. Nessuno strumento distribuito oggi ne dichiara una, quindi è la Content-Security-Policy applicata dal browser a tenere l'elenco sopra ai suoi host. L'[informativa sulla privacy](/info/privacy.html) conserva la tabella canonica di tutti questi, compreso il traffico dell'istanza gestita come gli aggiornamenti di policy e i report abilitati.
:::

## Da un terminale

**6. L'endpoint di rendering risponde solo con dati pubblici.** L'unica funzione server che mette input digitati in un URL, i rendering hot-link, è attiva qui. L'[informativa sulla privacy](/info/privacy.html) dice cosa significa per gli input che inserisci in un link.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Ogni installazione sceglie (`LOLLY_DISABLE_RENDER_GET=1`): su un'istanza che lo imposta, la stessa sonda restituisce `404`. Quella differenza è l'impostazione al lavoro, non un'incoerenza.

**7. Verifica i servizi che la tua installazione abilita.** [Server Surface](/info/server-surface.html) elenca i servizi facoltativi e rimanda ai loro riferimenti dettagliati. Per Lolly Work, includi le sue API autenticate, la connessione di collaborazione, l'archiviazione e i provider configurati. Una sonda del lolly.tools pubblico non verifica un'istanza privata di un'organizzazione.

Se gestisci una tua istanza, [Delivery deployment](/info/deploy-delivery.html) contiene i controlli di rilascio per essa: integrità dei modelli, la sonda dell'edge e il suo elenco di esempio, le versioni di visualizzazione, il gateway di download privato e il catalogo firmato in un browser.


## Nel codice sorgente

Tutto quanto sopra potrebbe comunque essere teatro se il codice distribuito differisse da quello pubblico. Quindi controlla il codice. L'installazione viene compilata dal [repository pubblico](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Nessun tracker e nessun SDK di analytics, da nessuna parte.** Cerca nel codice distribuito (l'engine, ogni shell compresa l'estensione del browser, gli override del bridge Tauri e il service worker, le funzioni server e i pacchetti di strumenti) i soliti sospetti:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

Questa scansione cerca SDK di tracciamento di terze parti. Non dimostra l'assenza di report d'uso di prima parte: Lolly Work supporta la telemetria dell'organizzazione e un log di audit separato, con policy e test propri.

**9. Nessun resolver DNS di terze parti.** Il controllo SEAL di Verify non invia mai una ricerca attraverso un provider DNS-over-HTTPS, perché l'app non ha un resolver:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Il servizio di certificati non conserva alcun log di emissione.** La CA di identità non conserva alcun log di ciò che ha emesso né alcun inventario di identità: nessuna riga su stdout, nessun webhook, nessun archivio di certificati. L'assenza si può cercare:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

La CA conserva invece uno stato di lavoro di breve durata: i bucket del rate limit contengono chiavi di IP ed email con hash per la loro finestra, e l'archivio di ammissione di un'installazione gestita conserva un identificativo con chiave e un digest della richiesta per al massimo dieci minuti. [Content Credentials engineering](/info/content-credentials-engineering.html#protocol) ha i dettagli.

## Imposto dai test

I controlli sul sorgente qui sopra non sono un audit una tantum: sono fissati nella suite di test, quindi non possono marcire in silenzio. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) controlla un elenco più lungo di nomi di tracker rispetto alla scansione sopra e fa fallire la build se:

- qualsiasi SDK di analytics o tracciamento compare in un punto qualsiasi del sorgente distribuito che scansiona, tra codice di app, engine, server, estensione e pacchetti di strumenti;
- qualsiasi resolver DNS-over-HTTPS di terze parti compare in quel sorgente;
- il log di emissione della CA ritorna, nel sorgente **o** nel bundle del server generato;
- l'informativa sulla privacy perde le sue dichiarazioni obbligatorie per legge (titolare indicato, base giuridica, diritto di reclamo).

Eseguili tu stesso nel clone (Node 22.18 o successivo; questo file non richiede `pnpm install`):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

La suite completa (`pnpm install && pnpm test`) ne esegue diverse migliaia in più, inclusi i test crittografici avversariali descritti in [Security & Verification](/info/security.html).

## Cosa non puoi verificare dall'esterno

- **I log di accesso dell'hosting.** Qualsiasi server che risponde a una richiesta può registrarla: indirizzo IP, percorso e ora. Una sonda esterna non può stabilire per quanto tempo i log vengono conservati. L'operatore controlla registrazione, rotazione ed esportazioni, e deve dichiarare queste scelte. Il rendering locale mantiene le modifiche ordinarie sul tuo dispositivo; il rendering facoltativo sul server e i servizi di area di lavoro condivisa hanno i flussi di dati separati descritti dall'informativa sulla privacy.
- **Che l'installazione esegua questo codice.** Puoi verificare che il sorgente sia pulito e che il comportamento distribuito gli corrisponda, e i controlli sopra fanno entrambe le cose. L'attestazione a livello di binario di un'installazione web non è qualcosa che la piattaforma web offre. Le mitigazioni sono il repository pubblico, i test imposti e il controllo offline: un'installazione manomessa che telefona a casa fallisce subito i controlli 1 e 2.
- **Gli hook degli strumenti.** La logica facoltativa di uno strumento integrato è rivista anziché isolata in sandbox: gira nella pagina, a meno che lo strumento scelga un Worker. Ogni strumento su lolly.tools è di prima parte e rivisto prima della distribuzione. Il [Threat Model](/info/threat-model.html#trust-boundaries) espone dove girano gli hook e cosa li limita.

## Se un controllo fallisce

Una differenza tra questa pagina e ciò che osservi è una segnalazione di sicurezza. Inviala attraverso i canali privati su [Security & Verification](/info/security.html#reporting-a-vulnerability). Pratichiamo la divulgazione coordinata e citiamo chi segnala.
