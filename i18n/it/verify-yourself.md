# Verificalo tu stesso

Le pagine sulla privacy e sulla sicurezza di Lolly fanno delle affermazioni: nessuna analytics, nessun tracciamento, i file non lasciano mai il dispositivo, un solo cookie in tutto il sistema. Questa pagina è diversa: non ti chiede di credere a nulla di tutto ciò. È un elenco di procedure, ciascuna con il comando o il percorso di clic esatto e l'output che vedrai. Ogni affermazione qui è falsificabile in pochi minuti, la maggior parte senza installare nulla.

Se un controllo di questa pagina non produce il risultato mostrato, è un bug oppure una promessa infranta. [Segnalalo](#if-a-check-fails) in entrambi i casi, e lo tratteremo con la gravità che una promessa infranta merita.

## Guardalo funzionare, in dieci secondi

Prima delle procedure, il risultato. Apri [`/verify`](/#/verify) e trascinaci sopra un file - nessun caricamento, nessun account, nessuna attesa di un server. Ecco qui che controlla la [tempesta generata su Queensland](/info/ai-stance.html) dalla nostra pagina sulla posizione riguardo all'IA: un'immagine Gemini che Lolly ha aperto, ridimensionato ed esportato. Ogni badge qui sotto è stato calcolato sul dispositivo, a partire dai byte stessi del file.

![Verify su uno schermo largo quanto un telefono - l'immagine della tempesta, un verdetto verde Made with Lolly e i badge di credenziale intatta e byte invariati impilati sotto](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Il verdetto non è un unico badge ma un piccolo insieme di essi, ciascuno un fatto indipendente:

- <!--i:lock--> **Made with Lolly** - la credenziale è intatta *e* registra un'esportazione da Lolly.
- <!--i:seal--> **La credenziale è intatta** - il manifest C2PA firmato viene analizzato e la sua stessa firma di claim viene verificata.
- <!--i:hash--> **I byte non sono cambiati** - l'hash del file corrisponde ancora a ciò che è stato firmato. Modifica un solo pixel e questo badge si capovolge.
- <!--i:sparkle--> **GEN AI** - questi pixel li ha creati una macchina, e il file lo dichiara. Lolly riporta quella dichiarazione così com'è, invece di nasconderla.

E l'intera cronologia viaggia con il file. Nove passaggi sopravvivono qui - cinque registrati da Google mentre generava e filigranava l'immagine, poi quattro registrati da Lolly mentre apriva, marcava e convertiva la copia in questa pagina - letti direttamente dai byte, sul tuo dispositivo, e resi come una timeline. È la stessa immagine, verificata nello stesso modo, della timeline C2PA nella [pagina sulla posizione riguardo all'IA](/info/ai-stance.html).

![La cronologia delle modifiche che Verify legge dall'immagine della tempesta - cinque passaggi registrati da Google, poi quattro da Lolly, terminando nel WebP di questa pagina](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Nulla di tutto questo è però la dichiarazione di fiducia - è la dimostrazione. Il resto di questa pagina è la dichiarazione di fiducia: ogni badge qui sopra è riproducibile, ed ecco come riprodurre le garanzie che ci sono dietro.

## Nel tuo browser, senza strumenti

**1. Osserva la rete.** Apri [lolly.tools](https://lolly.tools), apri i DevTools del browser (F12), passa alla scheda **Network** e usa uno strumento - digita un URL in [QR Code](/t/qr-code), cambia i colori, esporta un PNG. Ogni richiesta resta su `lolly.tools`: il guscio dell'app, i file dello strumento, gli asset del catalogo. Nessun host di analytics, nessun beacon CDN, nessun servizio di font, nessun endpoint di "error reporting". Ciò che digiti in uno strumento non compare in **nessuna richiesta** - il rendering è locale.

Le eccezioni oneste - ognuna opt-in, avviata dall'utente e visibile nella stessa scheda Network quando accade: aggiungere un **Google Font** nell'editor del brand recupera quella singola famiglia da Google, dopo una finestra di consenso che lo dichiara esattamente, una volta, prima della prima richiesta; cliccare un **preset di profilo di stampa ICC** recupera quel profilo dal registro pubblico dell'ICC su color.org; riprodurre l'opzionale **radio** integrata trasmette in streaming dalla stazione; inserire una località in **Meeting Planner** cerca quel luogo presso il servizio di geocoding di open-meteo per coordinate e fuso orario, una volta per città (le risposte vengono salvate sul tuo dispositivo), e il campo porta quella nota proprio dove digiti; e **URL Screenshot** carica necessariamente l'URL che hai digitato - è il suo compito, e lo vedi accadere. Uno strumento che dichiara una capacità di rete può contattare solo gli host consentiti nella sua manifest, e quel meccanismo è fail-closed; nessuno strumento attualmente distribuito ne dichiara una, quindi la Content-Security-Policy applicata dal browser è il confine che di fatto limita l'elenco sopra ai suoi host. La [informativa sulla privacy](/info/privacy.html) mantiene la tabella canonica di tutto questo; la sua regola di base è che un contatto di rete non presente in quella tabella non avviene.

**2. Stacca la spina.** Carica l'app e apri uno o due strumenti, poi vai offline - modalità aereo, oppure DevTools → Network → Offline. Ricarica. La galleria e ogni strumento che hai aperto continuano a funzionare, incluso il rendering e l'esportazione nei formati che hai usato - i file di uno strumento e l'encoder di un formato vengono messi in cache al primo utilizzo, quindi usa uno strumento una volta online prima di testarlo offline. Questo è il controllo singolo più forte di questa pagina: un software che telefona a casa non sopravvive al taglio del cavo.

**3. Conta i cookie.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. L'elenco è vuoto - l'app non imposta cookie. Oppure incolla `document.cookie` nella console: ottieni `""`. (L'unico cookie in tutto il sistema, `lolly_ca_state`, vive al massimo dieci minuti durante un accesso identitario opzionale - eliminato nel momento in cui l'accesso si completa - è ambito a `/api/ca` ed è `HttpOnly`: la [informativa sulla privacy](/info/privacy.html) lo descrive con precisione.)

**4. Leggi il tuo stesso storage.** Stesso pannello Application: tutto ciò che Lolly conserva è ispezionabile davanti a te - una ventina di chiavi `localStorage` semplici (tema, lingua, larghezza della sidebar, impostazioni di suono e visualizzazione, più una copia in cache dell'indice pubblico del catalogo strumenti), e i tuoi documenti in IndexedDB. Ogni valore è una stringa o un JSON leggibile - nulla è offuscato, nulla è codificato per scoraggiarne la lettura. **Profile → Clear all my data** lo cancella; lo stesso fa la cancellazione dei dati del sito nel browser, perché non esiste una copia lato server che possa sopravvivere.

**5. Verifica che esista il contatto per la segnalazione.** [`/.well-known/security.txt`](/.well-known/security.txt) risponde con un blocco di contatto [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), non una pagina HTML.

## Da un terminale

**6. L'endpoint di rendering è disattivato su lolly.tools.** L'unica funzionalità server che metterebbe input digitati dall'utente in un URL - i render hot-link - è disabilitata qui finché il servizio non passa a un hosting di proprietà dell'organizzazione (la [informativa sulla privacy](/info/privacy.html) spiega perché):

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 404
```

L'interruttore è per-deployment (`LOLLY_DISABLE_RENDER_GET=1`): su un'istanza che lo lascia non impostato, i render hot-link sono attivi, quindi la stessa verifica lì restituisce un'immagine - quella differenza è il flag che funziona, non un'incoerenza.

**7. La superficie server è enumerabile.** [Server Surface](/info/server-surface.html) elenca ogni rotta lato server esistente, con la regola di base che un endpoint non presente in quella pagina non fa parte di Lolly. Provale con `curl`; non c'è nient'altro da trovare.

## Nel codice sorgente

Tutto quanto sopra potrebbe comunque essere teatro se il codice distribuito differisse da quello pubblico. Quindi controlla il codice - il deployment viene compilato da [il repository pubblico](https://github.com/lolly-tools/lolly):

```bash
git clone --recurse-submodules https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Nessun tracker, nessun SDK di analytics, da nessuna parte.** Cerca nel codice distribuito - il motore, ogni shell (inclusa l'estensione del browser, gli override del bridge Tauri e il service worker), le funzioni server e i pacchetti degli strumenti - i soliti sospetti:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

**9. Nessun resolver DNS di terze parti.** Il controllo SEAL di Verify non instrada mai le ricerche attraverso un provider DNS-over-HTTPS - l'app web semplicemente non ha alcun resolver:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Il servizio di certificazione non conserva nulla.** La CA identitaria non ha un registro di emissione - né la tua email, né un timestamp, né un webhook. L'assenza è verificabile con grep:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

## Applicato dai test, non dalle promesse

I tre controlli sul sorgente sopra non sono un audit una tantum - sono fissati nella suite di test, così non possono degradarsi silenziosamente. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) fa fallire la build se:

- appare qualsiasi SDK di analytics o tracking in un punto qualsiasi del sorgente distribuito che analizza - app, motore, server, estensione e codice dei pacchetti strumenti allo stesso modo,
- appare qualsiasi resolver DNS-over-HTTPS di terze parti in quel sorgente,
- il registro di emissione della CA ricompare - nel sorgente **o** nel bundle server generato,
- l'informativa sulla privacy perde le sue dichiarazioni legalmente richieste (titolare nominato, base giuridica, diritto di reclamo).

Eseguili tu stesso nel clone (Node 22.18+; non serve `npm install` per questo file):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

La suite completa (`npm install && npm test`) ne esegue diverse migliaia in più, inclusi i test crittografici avversariali descritti in [Sicurezza e verifica](/info/security.html).

## Cosa non puoi verificare dall'esterno - detto chiaramente

Una pagina come questa guadagna fiducia nominando i propri limiti:

- **Log di accesso dell'hosting.** Qualsiasi server che risponde a una richiesta può registrare la richiesta - IP, percorso, timestamp. Non puoi verificare cosa un host conserva o non conserva, e non possiamo farlo nemmeno noi oltre al comportamento documentato del nostro provider. È esattamente per questo che l'architettura tiene i tuoi contenuti completamente fuori dal cavo: ciò che non lascia mai il tuo dispositivo non può essere registrato da nessuno.
- **Che il deployment esegua questo codice.** Puoi verificare che il sorgente sia pulito e che il comportamento distribuito vi corrisponda (i controlli sopra fanno entrambe le cose), ma l'attestazione a livello binario di un deployment web non è qualcosa che la piattaforma web offre. Le mitigazioni sono il repository pubblico, i test applicati e il controllo offline - un deployment manomesso che telefona a casa fallisce immediatamente i controlli 1 e 2.
- **Gli hook degli strumenti non sono isolati in sandbox per impostazione predefinita.** La logica opzionale di uno strumento viene eseguita revisionata, nel realm stesso della pagina; ogni strumento su lolly.tools è first-party e revisionato prima della pubblicazione. L'isolamento tramite Worker è ora disponibile come opt-in per singolo strumento - uno strumento la cui manifest imposta `isolate: true` esegue i suoi hook fuori thread - quindi ciò che non puoi verificare dall'esterno si sta restringendo, ma il percorso predefinito resta in-realm e la revisione resta il controllo. Questo è dichiarato, non nascosto - vedi la sezione [confini di progettazione](/info/security.html), che lo ha sempre detto.

## Se un controllo fallisce

Una discrepanza tra questa pagina e il comportamento osservato è una segnalazione di sicurezza, e preferiamo davvero riceverla che non riceverla: [fitzy+security@suse.com](mailto:fitzy+security@suse.com), il pulsante **Report a vulnerability** su qualsiasi [repository lolly-tools](https://github.com/lolly-tools) o il contatto in [`/.well-known/security.txt`](/.well-known/security.txt). La divulgazione coordinata e il credito al segnalatore sono la politica in vigore - [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md) ne contiene i dettagli.
