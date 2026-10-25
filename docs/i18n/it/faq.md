# Domande e risposte

Domande frequenti, rese come fisarmonica in `/info/start/faq.html`.

**Come si aggiorna:** ogni titolo `##` qui sotto è una domanda; tutto ciò che si trova sotto
di esso (fino al `##` successivo) è la risposta. Le risposte usano lo stesso markdown leggero
del resto del sito - separa i paragrafi con una riga vuota. Aggiungi, rimuovi o riordina
le domande qui e riesegui `pnpm run build:info` (o `pnpm run dev:web`).
Tutto ciò che precede il primo `##` (questo titolo e queste note) viene ignorato dalla build.

L'ordine è quello di chi comincia: prima il tranello, poi i tuoi file, poi come ottenere
e far funzionare Lolly, poi le organizzazioni, poi come è stato fatto. L'ancora di ogni domanda
è costruita dalla domanda inglese nella stessa posizione, quindi una traduzione mantiene
l'ordine inglese.

## Perché è gratis? Dov'è l'inghippo?

**Abbiamo creato Lolly per noi.** SUSE aveva bisogno di migliaia di file in linea con il brand, creati senza affidare nulla a servizi esterni. Così abbiamo costruito uno strumento che fa tutto sul dispositivo, e l'abbiamo rilasciato come open source, come tutto ciò che facciamo. Continuiamo a mantenerlo perché lo usiamo ogni giorno. **Non c'è alcun obbligo:** tutto ciò che trovi qui funziona con noi o senza di noi.

Quella linea è tracciata nella licenza, non in una promessa: tutto ciò che gira in locale è gratuito, per sempre. Una versione rilasciata è concessa in licenza in modo da non poter essere ritirata, e non esiste alcun accordo con i contributori che possa cambiare la licenza al lavoro di qualcuno.

## Quanto sta tenendo privato SUSE? (ovvero: quando arriva la fregatura)

L'engine, le shell, gli schemi e gli strumenti indipendenti dal brand sono open source. I marchi di SUSE e gli strumenti con il suo brand sono la parte che resta privata, ed è già separata. L'istanza pubblica su [lolly.tools](https://lolly.tools) esegue [Lolly Demo](/info/lolly-demo.html), il design system di Lolly stesso.

Nulla qui poggia su una promessa: ogni versione rilasciata resta open source, e l'unica cosa trattenuta è il marchio. Quando nel 2023 un'altra azienda ha chiuso i sorgenti enterprise di Linux, SUSE ha cofondato [OpenELA](https://openela.org) per mantenere aperto quel codice, la stessa posizione che questo progetto eredita.

Piena trasparenza: SUSE *sta* costruendo strumenti interni per collegare Lolly ai propri sistemi IT. È la configurazione interna di SUSE, non una divisione tra sviluppo pubblico e privato. Lolly punta inoltre a essere compilato tramite [Open Build Service](https://openbuildservice.org/), con artefatti sicuri della supply chain forniti dalla [SUSE Application Collection](https://apps.rancher.io/applications).

## Perché il nome "Lolly Tools"?

**Lolly** perché la libertà è dolce, e perché in Australia, Nuova Zelanda e Gran Bretagna una lolly è una caramella.

**Tools** perché un attrezzo resta fermo finché non lo prendi in mano. Non gira quando non lo stai usando e non ti osserva mentre lo usi.

## Perché è tutto verde?

lolly.tools si apre in [Lolly Demo](/info/lolly-demo.html), il design system di esempio di Lolly, e il suo colore guida è il verde. È un esempio, non una regola. Passa a **Lolly Starter**, un design system vuoto, o al tuo in [Settings → Design systems](/#/settings?focus=design-systems-section).

## Posso usare il mio brand?

Sì. **Design System Setup** (`#/start`) costruisce un design system da un colore, da un file di design token o da un design finito, e da quel momento ogni strumento disegna con il tuo design system. [Start](/info/quickstart.html#put-your-brand-in) descrive i tre percorsi.

Un design system fornito dalla tua organizzazione o dalla tua build è gestito: mostra un lucchetto e resta in sola lettura, e puoi creare una copia modificabile per cambiarlo.

## Dov'è la cosa che ho fatto ieri?

Se hai premuto **Save as** o **Save**, è in **Projects**, nella schermata iniziale, nel browser o nell'app da cui hai salvato. Se hai premuto solo **Download**, il file si trova dove il tuo browser o sistema salva i download, e di solito una copia è in **Assets**. Anche gli strumenti che [salvano mentre lavori](/info/find-your-work.html#which-tools-save-as-you-work) conservano il lavoro non salvato in **Projects**. [Find and recover your work](/info/find-your-work.html) tratta ogni caso.

## Ho chiuso la scheda. Il mio lavoro è perso?

Il lavoro salvato resta in **Progetti**. Il lavoro non salvato va perso, tranne negli strumenti che salvano mentre lavori, che lo conservano anch'essi in **Progetti**. La prossima volta, premi **Salva come** prima di uscire. Vedi [Se hai chiuso la scheda o hai lasciato lo strumento](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## Posso condividere il mio lavoro come file invece che come link?

Sì. Quando un link non può portare tutto, come le tue foto o un testo lungo, la finestra Share dice cosa andrebbe perso e offre invece un file **.lolly**: un unico file che contiene il design, le immagini che usa e, se lo scegli, lo strumento stesso.

Decidi tu quanto viaggia. Il tuo nome e i tuoi dati entrano solo se il tuo profilo lo consente, e la grafica con licenza viene trattenuta a meno che tu non scelga di includerla. A chi apre un file che porta uno strumento viene chiesto se si fida dello strumento prima che possa girare. Vedi [Sharing your work](/info/using.html#sharing-your-work).

## A cosa servono i dati del mio profilo?

I tuoi dati in **Settings** precompilano gli strumenti che li chiedono, come un nome su un badge. Restano su questo dispositivo. Se attivi anche l'opt-in, i dati che scegli vengono sigillati in ciò che crei, indicandoti come fonte. Nulla viene incluso a meno che tu non scelga di includere i tuoi dati.

La condivisione e Sync inviano solo il contenuto che scegli. Su un'istanza Lolly Work di un'organizzazione, anche le sessioni condivise e il lavoro governato vanno a quel server. Vedi [Privacy](/info/privacy.html).

## Come ottengo le app mobile o desktop?

Scaricali da [Install Lolly](/info/install.html). La pagina elenca ogni build per macOS, Windows, Linux e Android, e mostra come verificare il file scaricato. iPhone e iPad ottengono **Lolly Tools** dall'App Store; [la sezione su iPhone e iPad](/info/install.html#iphone-and-ipad) ha il link.

Chiunque può anche compilare e distribuire la propria copia dell'app, con gli strumenti e le impostazioni di cui il suo pubblico ha bisogno. La [Build Guide](/info/build-guide.html) mostra come.

## Lolly dice che richiede WebGPU. Cosa posso fare?

L'app web disegna con WebGPU, una funzione grafica dei browser attuali, e la verifica prima di aprire uno strumento. Prova questi passaggi in ordine:

1. Aggiorna il browser alla versione corrente.
2. Attiva l'accelerazione grafica o hardware nelle impostazioni del browser, poi riavvia il browser.
3. Prova un browser che è stato testato: [Supported environments](/info/supported-environments.html) li elenca.
4. Su Mac, iPhone o iPad, [installa invece l'app](/info/install.html).

## Lolly può modificare e renderizzare i miei file Figma, Penpot, Illustrator o InDesign?

Sì. Apri **Design** e fai clic su **Import a design**: accetta un **.fig** nativo di Figma (Save local copy), un'esportazione **.penpot** di Penpot, un **.ai** o **.pdf** di Illustrator, un **.idml** di InDesign (File → Export → InDesign Markup) o **qualsiasi SVG**. Non servono account, plugin né la licenza di un'app di design.

![La tela aperta di Design - Importa un design si trova nel menu Lolly della barra degli strumenti](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

I livelli arrivano come box modificabili: il testo resta riscrivibile, le forme restano forme e le immagini entrano nella tua libreria. Salvalo, e **Share with rules** può trasformare il layout in uno strumento che chiunque abbia Lolly può ricompilare. Vedi [Import a design](/info/design-import.html).

## Due persone possono lavorare sullo stesso design senza internet?

Sì. Una persona condivide un invito, come link, codice QR o codice breve, e l'altra lo accetta. Entrambi i dispositivi tengono quindi la stessa sessione live, con presenza e anelli di focus inclusi. Funziona su qualsiasi rete condivisa, anche un hotspot del telefono in uno scantinato, perché non c'è alcun server in mezzo. Vedi [Working together](/info/collaborate.html). Per colleghi su reti diverse, l'istanza Lolly Work di un'organizzazione offre collab di lavoro autenticate.

## Cosa sono i feature flag?

I feature flag attivano o disattivano parti di Lolly. Nell'uso standalone scegli tu le tue impostazioni personali. Un'organizzazione che usa Lolly Work può impostare valori predefiniti o nascondere certi interruttori secondo la propria policy, e i controlli gestiti sono etichettati. Vedi [Use Lolly at your organisation](/info/organisation.html).

![Feature flag personali nell'app standalone; la policy dell'organizzazione può governare alcuni interruttori](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Cosa distingue le utilità dagli strumenti?

Un'utility svolge un compito rapido su un file che hai già, come comprimere un PDF, convertire una foto o eliminare dati nascosti, e molte girano sul tuo dispositivo senza caricare nulla. Esistono perché i compiti che di solito si affidano a un sito qualunque restino dentro Lolly. Comprimere un contratto, convertire foto di vacanza con la posizione ancora dentro o incollare un token in un formattatore online non dovrebbe significare consegnare il file a un sito con conservazione, giurisdizione e modello di business sconosciuti. [Utilities](/info/utilities.html) le elenca, e [The trade we never agreed to](/info/status-quo.html) racconta la storia dietro di esse.

![La vista Utilities: Strip Hidden Data, Compress PDF, Convert Image e gli altri lavori sul dispositivo, tutti in un unico posto](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## La nostra organizzazione può usare SSO, progetti condivisi e approvazioni?

Sì, con **Lolly Work**, il server per organizzazioni dello stesso progetto open source. Gira separatamente e aggiunge il single sign-on tramite il tuo provider di identità, il provisioning SCIM, i permessi di gruppo, progetti e risorse condivisi, collab di lavoro live, approvazioni e record di audit. L'app di tutti i giorni funziona comunque da sola.

[Use Lolly at your organisation](/info/organisation.html) tratta l'accesso e il modo di trovare il lavoro condiviso, e [Deployment](/info/deployment.html#organisation-services-with-lolly-work) tratta la configurazione. I contenuti condivisi e i record dell'organizzazione seguono le policy di privacy e conservazione di quell'istanza.

## Quali ostacoli potrei aspettarmi adottando Lolly?

Per lo più cambia il lato di chi produce, più che la tecnologia. Un team che vuole un insieme governato di strumenti ha bisogno di qualcuno che crei il suo design system e i primi template, anche se chiunque può iniziare a creare i propri strumenti in Design fin dal primo giorno, senza bisogno di git. E i processi esistenti continuano a funzionare anche quando il loro output è fuori brand, quindi convertire bene un output visibile, con prima e dopo affiancati, convince più in fretta di un piano.

[Adoption & Governance](/info/adoption-governance.html) tratta l'onboarding per ruolo, come misurare un pilota e che aspetto può avere un processo di governance.

## Lolly è stato "vibe coded"?

Lolly è stato sviluppato con codice scritto con l'aiuto dell'IA, scoperta assistita dall'IA e, in molti punti, contenuti assistiti dall'IA, usando un mix di modelli e fornitori, compresi quelli delle aziende di frontiera del public cloud. Un essere umano ha creato l'architettura, curato il codice con intenzione e guidato artisticamente l'esperienza.

Un advisory di gravità alta o critica nelle dipendenze di Lolly blocca la CI. Un advisory che non si può ancora correggere viene trattenuto solo come eccezione approvata con una motivazione scritta. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) elenca ogni eccezione attualmente in vigore, e le [note di rilascio](https://github.com/lolly-tools/lolly/releases) elencano quelle che ogni rilascio porta con sé. SECURITY.md spiega anche come segnalare una vulnerabilità.

I controlli nella build rifiutano inoltre formulazioni che sembrano scritte da una macchina nei commenti del codice, nell'app e in questi documenti, per mantenere il testo semplice per ogni lettore. Un effetto collaterale è che un rilevatore potrebbe faticare di più a stabilire quale testo abbia scritto un modello. Non era nostra intenzione provocarlo.

Soprattutto, Lolly poggia sulle spalle di decenni di lavoro open source di esperti di tutto il mondo.

**Informativa sull'IA generativa:**

- **Codice scritto da LLM:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (questo elenco può ampliarsi)
- **Scoperta con LLM:** Gemini 3.1, Fable, Codex Astra
- **Documentazione:** Sonnet 5
- **Librerie open source:** i rispettivi autori, indicati nell'SBOM, nei commenti e nelle intestazioni dei file

Questo elenco non include i modelli integrati in Lolly.

**Contributi umani:**
- **Ideazione, revisione e feedback:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, la Penpot Community, Tim Hildred (elenco non esaustivo)
- **Architettura, direzione artistica e addetto alla pulizia dello slop:** Andy Fitzsimon

## Dove sono finiti gli strumenti a marchio SUSE?

Vivono in un repository separato e privato. Un clone pubblico non scarica affatto il pacchetto brand di SUSE, quindi una build ottenuta da esso usa il profilo neutro `lolly-start`, a meno che tu ne scelga un altro: gli strumenti community indipendenti dal brand più un brand vuoto che compili con il tuo. [lolly.tools](https://lolly.tools) è compilato con il profilo `lolly-demo` e si apre in [Lolly Demo](/info/lolly-demo.html), il design system di Lolly stesso. SUSE gestisce una propria istanza per proteggere i suoi marchi.

## Che gusto ha quel logo Lolly?

Alcuni dicono Lime, altri dicono Menta e a volte Mela, Lolly porta la dolcezza, il gusto lo crei tu!
