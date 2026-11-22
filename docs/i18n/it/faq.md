# Domande & risposte

Domande frequenti, renderizzate come sezioni a fisarmonica in `/info/start/faq.html`.

**Come aggiornare:** ogni titolo `##` qui sotto è una domanda. Tutto ciò che segue il titolo,
fino al `##` successivo, è la risposta. Le risposte usano il markdown leggero del sito:
separa i paragrafi con una riga vuota. Aggiungi, rimuovi o riordina le domande qui e
riesegui `pnpm run build:info` (o `pnpm run dev:web`).
La build ignora tutto ciò che precede il primo `##` (questo titolo e queste note).

L'ordine è quello di chi inizia: prima cosa c'è sotto, poi i tuoi file, poi come ottenere
e avviare Lolly, poi le organizzazioni, poi come è stato realizzato. L'ancora di ogni domanda
viene creata dalla domanda inglese nella stessa posizione, quindi una traduzione mantiene
l'ordine inglese.

## Perché è gratuito? Cosa c'è sotto?

**Abbiamo creato Lolly per noi.** SUSE aveva bisogno di migliaia di file in linea con il brand, creati senza consegnare nulla a servizi esterni. Così abbiamo costruito uno strumento che fa tutto sul dispositivo e lo abbiamo rilasciato come open source, come tutto il resto che creiamo. Continuiamo a mantenerlo perché lo usiamo ogni giorno. **Non c'è alcun obbligo:** tutto qui funziona con o senza di noi.

Quel confine è fissato dalla licenza, non da una promessa: tutto ciò che viene eseguito localmente è gratuito, per sempre. La licenza di una versione rilasciata impedisce che venga ritirata. Nessun accordo con i contributori potrebbe cambiare la licenza del lavoro di alcun autore.

## Quanto tiene privato SUSE? (ovvero quando cambieranno le carte in tavola)

Il motore, le shell, gli schemi e gli strumenti indipendenti dal brand sono open source. I marchi e gli strumenti con il brand di SUSE restano privati e sono già separati. L'istanza pubblica su [lolly.tools](https://lolly.tools) usa [Lolly Demo](/info/lolly-demo.html), il design system di Lolly.

Nulla qui si basa su una promessa: ogni versione rilasciata resta open source. Quando un'altra azienda ha chiuso i sorgenti del suo Linux enterprise nel 2023, SUSE ha cofondato [OpenELA](https://openela.org) per mantenere aperto quel codice. Questo progetto eredita quella posizione.

SUSE *sta* creando strumenti interni per collegare Lolly ai propri sistemi IT. È la configurazione interna di SUSE, non una divisione tra sviluppo pubblico e privato. Lolly punta anche a essere compilato tramite [Open Build Service](https://openbuildservice.org/), con artefatti di una filiera software sicura distribuiti dalla [SUSE Application Collection](https://apps.rancher.io/applications).

## Perché il nome "Lolly Tools"?

**Lolly** perché la libertà è dolce e perché in Australia, Nuova Zelanda e Gran Bretagna una lolly è una caramella.

**Tools** perché uno strumento resta fermo finché non lo prendi in mano. Non viene eseguito quando non lo usi e non ti osserva mentre lo usi.

## Perché è tutto verde?

lolly.tools si apre in [Lolly Demo](/info/lolly-demo.html), il design system di esempio di Lolly, il cui colore principale è il verde. Passa a **Lolly Starter**, un design system vuoto, o al tuo in [Settings → Design systems](/#/settings?focus=design-systems-section).

## Posso usare il mio brand?

Sì. **Lolly Design System Setup** (`#/start`) crea un design system da un colore, da un file di design token o da un design finito. Ogni strumento disegna poi con il tuo design system. [Inizia](/info/quickstart.html#put-your-brand-in) illustra i tre percorsi.

Un design system fornito dalla tua organizzazione o dalla tua build è gestito. Mostra un lucchetto e resta in sola lettura. Per modificarlo, creane una copia modificabile.

## Dov'è quello che ho creato ieri?

Se hai premuto **Save as** o **Save**, il tuo lavoro è in **Projects** nella schermata iniziale, nel browser o nell'app da cui hai salvato. Se hai premuto solo **Download**, il file è nei download del browser o del sistema e di solito una copia è in **Assets**. Gli strumenti che [salvano mentre lavori](/info/find-your-work.html#which-tools-save-as-you-work) conservano anche il lavoro non salvato in **Projects**. [Trova e recupera il tuo lavoro](/info/find-your-work.html) tratta tutti i casi.

## Ho chiuso la scheda. Ho perso il mio lavoro?

Il lavoro salvato è ancora in **Projects**. Quello non salvato è perso, tranne negli strumenti che salvano mentre lavori, che lo conservano anch'essi in **Projects**. La prossima volta premi **Save as** prima di uscire. Vedi [Se hai chiuso la scheda o lasciato lo strumento](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## Posso condividere il mio lavoro come file invece che come link?

Sì. Quando un link non può contenere tutto, come le tue foto o un testo lungo, la finestra Share indica cosa mancherebbe e propone un file **.lolly**. Quel singolo file contiene il design, le immagini che usa e, se lo scegli, lo strumento.

Decidi tu cosa viaggia. Il tuo nome e i tuoi dati vengono inclusi solo se hai dato il consenso nel profilo. La grafica soggetta a licenza viene esclusa, a meno che tu non scelga di includerla. A chi apre un file che contiene uno strumento viene chiesto se si fida dello strumento prima che possa essere eseguito. Vedi [Condividere il tuo lavoro](/info/using.html#sharing-your-work).

## A cosa servono i dati del mio profilo?

I tuoi dati in **Settings** precompilano gli strumenti che li richiedono, come un nome su un badge. Restano su questo dispositivo. Nulla entra in ciò che crei, a meno che tu non attivi il consenso. A quel punto i dati che scegli vengono sigillati nel risultato e ti indicano come fonte.

Condivisione e Sync inviano solo i contenuti che scegli. Su un'istanza Lolly Work di un'organizzazione, anche le sessioni condivise e il lavoro soggetto a governance vengono inviati a quel server. Vedi [Privacy](/info/privacy.html).

## Come ottengo le app per dispositivi mobili o desktop?

Scaricale da [Installa Lolly](/info/install.html). La pagina elenca ogni build per macOS, Windows, Linux e Android e mostra come verificare il file scaricato. Su iPhone e iPad, **Lolly Tools** si scarica dall'App Store. [La sezione iPhone e iPad](/info/install.html#iphone-and-ipad) contiene il link.

Chiunque può anche compilare e distribuire la propria copia dell'app, con gli strumenti e le impostazioni di cui il suo pubblico ha bisogno. La [Guida alla build](/info/build-guide.html) mostra come fare.

## Lolly dice che richiede WebGPU. Cosa posso fare?

L'app web disegna con WebGPU, una funzionalità grafica dei browser attuali, e verifica la presenza di WebGPU prima di aprire uno strumento. Prova questi passaggi in ordine:

1. Aggiorna il browser alla versione corrente.
2. Attiva l'accelerazione grafica o hardware nelle impostazioni del browser, poi riavvialo.
3. Prova un browser testato: [Ambienti supportati](/info/supported-environments.html) li elenca.
4. Su un Mac, iPhone o iPad, [installa invece l'app](/info/install.html).

## Lolly può modificare e renderizzare i miei file Figma, Penpot, Illustrator o InDesign?

Sì. Apri lo strumento **Design** e fai clic su **Import a design**: accetta un **.fig** nativo di Figma (Save local copy), un'esportazione **.penpot** di Penpot, un **.ai** o **.pdf** di Illustrator, un **.idml** o **.indd** di InDesign, un documento Affinity, un **.psd** di Photoshop, un **.pptx** di PowerPoint, un **.dxf** CAD o **qualsiasi SVG** ([tutti i formati che legge](/info/design-import.html#what-comes-in-from-each-app)). Non servono account, plugin o licenze di app di design.

![La tela aperta di Lolly Design - Import a design si trova nel menu Lolly della barra degli strumenti](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

I livelli arrivano come box modificabili. Il testo si può ancora riscrivere, le forme restano forme e le immagini entrano nella tua libreria. Una volta salvato il layout, **Share with rules** può trasformarlo in uno strumento che chiunque abbia Lolly può compilare di nuovo. Vedi [Importa un design](/info/design-import.html).

## Due persone possono lavorare allo stesso design senza internet?

Sì. Una persona condivide un invito (un link, un codice QR o un codice breve) e l'altra accetta. Entrambi i dispositivi mantengono poi la stessa sessione live, con indicatori di presenza e anelli di focus. Funziona su qualsiasi rete condivisa, compreso l'hotspot di un telefono, perché non c'è un server in mezzo. Vedi [Lavorare insieme](/info/collaborate.html). Per colleghi su reti diverse, l'istanza Lolly Work di un'organizzazione offre collaborazioni di lavoro autenticate.

## Cosa sono i feature flag?

I feature flag attivano o disattivano parti di Lolly. Nell'uso autonomo scegli le tue impostazioni personali. Un'organizzazione che usa Lolly Work può impostare valori predefiniti o nascondere determinati interruttori in base alla propria policy, e i controlli gestiti sono contrassegnati. Vedi [Usa Lolly nella tua organizzazione](/info/organisation.html).

![Feature flag personali nell'app autonoma; la policy dell'organizzazione può governare determinati interruttori](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Cosa distingue le utility dagli strumenti?

Un'utility esegue un compito rapido su un file che hai già, come comprimere un PDF, convertire una foto o rimuovere dati nascosti. Molte funzionano sul tuo dispositivo senza caricare nulla. Le utility mantengono dentro Lolly i compiti che di solito le persone affidano a un sito web qualsiasi. Comprimere un contratto, convertire foto delle vacanze con la posizione ancora al loro interno o incollare un token in un formattatore online non dovrebbe significare consegnare il file a un sito di cui non conosci conservazione dei dati, giurisdizione e modello di business. [Lolly Utilities](/info/utilities.html) le elenca e [Lo scambio a cui non abbiamo mai acconsentito](/info/status-quo.html) racconta la storia che c'è dietro.

![La vista Utilities: Lolly Strip Hidden Data, Compress PDF, Convert Image e gli altri compiti eseguiti sul dispositivo, tutti in un unico posto](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## La nostra organizzazione può usare SSO, progetti condivisi e approvazioni?

Sì, con **Lolly Work**, il server per le organizzazioni dello stesso progetto open source. Funziona separatamente e aggiunge single sign-on tramite il tuo provider di identità, provisioning SCIM, permessi di gruppo, progetti e risorse condivisi, collaborazioni di lavoro live, approvazioni e record di audit. L'app di tutti i giorni continua a funzionare da sola.

[Usa Lolly nella tua organizzazione](/info/organisation.html) tratta l'accesso e la ricerca del lavoro condiviso. [Distribuzione](/info/deployment.html#organisation-services-with-lolly-work) tratta la configurazione di Lolly Work. I contenuti condivisi e i record dell'organizzazione seguono le policy di privacy e conservazione di quell'istanza.

## Quali ostacoli posso aspettarmi nell'adottare Lolly?

Soprattutto cambiamenti nel modo in cui un team produce lavoro, non nella tecnologia. Un team che vuole un insieme di strumenti soggetto a governance ha bisogno di qualcuno che crei il suo design system e i primi template. Chiunque può comunque creare i propri strumenti in Lolly Design fin dal primo giorno, senza bisogno di git. I processi esistenti continuano a funzionare anche quando il loro output non è in linea con il brand. Convertire bene un risultato visibile, con il prima e il dopo affiancati, convince più rapidamente di un piano.

[Adozione & Governance](/info/adoption-governance.html) tratta l'inserimento in base al ruolo, come misurare un progetto pilota e come può essere strutturato un processo di governance.

## Lolly è stato creato con il "vibe coding"?

Lolly è stato sviluppato con programmazione assistita dall'AI, ricerca assistita dall'AI e, in molti punti, contenuti assistiti dall'AI, usando un insieme di modelli e fornitori, compresi quelli di aziende del cloud pubblico che sviluppano modelli di frontiera. Una persona ha creato l'architettura, curato il codice con scelte deliberate e diretto artisticamente l'esperienza.

Un avviso di sicurezza di gravità alta o critica nelle dipendenze di Lolly blocca la CI. Un avviso che non può ancora essere risolto viene sospeso solo come eccezione approvata con una motivazione scritta. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) elenca tutte le eccezioni attualmente in vigore e le [note di rilascio](https://github.com/lolly-tools/lolly/releases) elencano quelle presenti in ogni versione. SECURITY.md indica anche come segnalare una vulnerabilità.

I controlli nella build rifiutano anche formulazioni che sembrano generate da una macchina nei commenti al codice, nell'app e in questa documentazione, per mantenere il testo semplice per ogni lettore. Un effetto collaterale è che un rilevatore potrebbe avere più difficoltà a distinguere quale testo è stato scritto da un modello. Non era un nostro obiettivo.

Soprattutto, Lolly si fonda su decenni di lavoro open source di esperti di tutto il mondo.

**Dichiarazione sull'AI generativa:**

- **Codice scritto da LLM:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (questo elenco potrebbe ampliarsi)
- **Ricerca con LLM:** Gemini 3.1, Fable, Codex Astra
- **Documentazione:** Sonnet 5
- **Librerie open source:** I rispettivi autori, indicati nella SBOM, nei commenti e nelle intestazioni dei file

Questo elenco non include i modelli integrati nel codice di Lolly.

**Contributi umani:**
- **Ideazione, revisione e feedback:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, la Penpot Community, Tim Hildred (elenco non esaustivo)
- **Architettura, direzione artistica & pulizia dei contenuti scadenti:** Andy Fitzsimon

## Dove sono finiti gli strumenti con il marchio SUSE?

Si trovano in un repository privato separato. Un clone pubblico non scarica il pacchetto del marchio SUSE, quindi una build creata da quel clone usa il profilo neutro `lolly-start`, a meno che tu non ne scelga un altro. Quel profilo contiene gli strumenti della comunità indipendenti dal marchio e un marchio vuoto da completare con il tuo. [lolly.tools](https://lolly.tools) è compilato con il profilo `lolly-demo` e si apre in [Lolly Demo](/info/lolly-demo.html), il design system di Lolly. SUSE gestisce una propria istanza per proteggere i suoi marchi.

## Che gusto ha il logo di Lolly?

C'è chi dice lime, chi menta e a volte mela. Lolly ci mette la dolcezza, tu crei il gusto.

## Cosa intende Lolly per sovranità dei contenuti?

Il controllo su come i tuoi contenuti vengono creati, governati, archiviati e trasferiti tra i sistemi che scegli. Lolly supporta la produzione locale, il lavoro modificabile e gli strumenti portabili. Lolly Work aggiunge servizi condivisi controllati dall'organizzazione. Le licenze delle fonti, le dipendenze disponibili e i flussi di dati del processo di lavoro restano rilevanti. [Cos'è la sovranità dei contenuti?](/info/content-sovereignty.html) spiega ogni forma di controllo e i suoi limiti.

## Possiamo mantenere il DAM che usiamo già?

Sì. Un DAM supportato può restare la fonte ufficiale mentre Lolly Work collega risorse selezionate agli strumenti di Lolly. L'accesso alla fonte, le modifiche consentite, i diritti d'uso e l'approvazione dell'output finale sono decisioni separate. [Usare Lolly con il DAM che usi già](/info/use-with-dam.html) spiega questa configurazione, e [l'esperienza di SUSE con Brandfolder](/info/suse-brandfolder.html) documenta un uso riuscito durante l'adozione.
