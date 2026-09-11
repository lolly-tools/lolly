# Come si confronta Lolly

Cosa fa Lolly che gli strumenti creativi di oggi non fanno, e cosa lascia deliberatamente a loro.

Per la versione strumento per strumento, una pagina ciascuna per Canva, Adobe, Figma, le API di rendering e i convertitori online, vedi [Lolly a confronto, strumento per strumento](/info/compare.html). Ogni pagina indica cosa fa meglio l'altro strumento e cosa fa Lolly al suo posto.

> **Stato pilota:** Lolly è un prototipo in pilota chiuso, non un prodotto finito, e la sua sicurezza è attualmente sottoposta al rigoroso irrobustimento infrastrutturale di SUSE, in preparazione alla scala enterprise. La pagina [Adozione e governance](/info/adoption-governance.html#status) copre lo stato attuale.

## Gli strumenti di oggi

Ogni anello sotto misura quanto completamente una classe di prodotto offre una capacità **così come distribuita oggi** - non come pubblicizzata - con ogni classe valutata sul suo miglior rappresentante. Lolly è valutato con lo stesso coltello: prende l'unico anello rosso della tabella, per la maturità. Apri il nome di una riga per il ragionamento dietro i suoi punteggi. Le colonne sono ordinate per la riga Completezza complessiva in alto - la media delle righe valutate, con la riga della spesa esclusa.

::: figure positioning-comparison
Completezza delle capacità tra gli strumenti creativi odierni, ricercata ad agosto 2026. Punteggio: 0 assente, 25 livello soluzione di ripiego, 50 reale ma limitato o parziale, 75 solido con avvertenze, 100 competenza centrale.
:::

**Note sui punteggi.** I punteggi di Lolly presuppongono che le sue affermazioni pubblicate reggano, motivo per cui la maturità è il suo unico anello rosso: pilota chiuso, irrobustimento della sicurezza in corso, nulla ancora sottoposto ad audit. La ricerca ha spostato diverse celle.

Canva è valutato sul suo miglior membro della famiglia per ogni riga, poiché possiede Affinity e Cavalry (entrambi regalati a ottobre 2025). Il rendering offline e on-device ottiene 75 tramite Affinity - una suite desktop che richiede comunque un account verificato e comporta telemetria, la stessa detrazione che subisce anche Adobe - mentre la modalità offline di Canva stessa modifica solo progetti pre-sincronizzati, un solo dispositivo, finestra limitata. L'autofill ottiene 50: reale ma riservato a Enterprise, asincrono, solo testo e immagini. La generazione di massa di Figma è salita da 25 a 50 quando Buzz ha rilasciato il riempimento da foglio di calcolo (beta gratuita, agosto 2026).

Una regola governa la tabella: Full (100), sulle righe che toccano i tuoi contenuti o la tua identità, richiede una capacità utilizzabile senza account e senza precondizione cloud; le righe che descrivono il prodotto stesso (maturità, facilità d'uso) sono esenti. Costa ad Adobe sulla provenienza: il C2PA più ampio distribuito (Photoshop, Lightroom, Premiere, Firefly) firma localmente e nel cloud, ma mai senza un account e un'identità Adobe, quindi 75. Limita le API di rendering sulla generazione di massa e l'automazione per lo stesso motivo.

Il 75 di Lolly sulla provenienza riflette la firma offline on-device: architetturalmente più solida ma non sottoposta ad audit, e una chiave del dispositivo risulta non verificata nei validatori standard finché un'identità o la CA propria di un'organizzazione non la garantisce. Il 50 di Penpot arriva tramite il plugin ufficiale Lolly Export: lo stesso motore di firma, opt-in, dichiarato come proprietà di Lolly. Penpot ottiene anche l'unico anello fuori scala della tabella, 90 sul rendering on-device - canvas del browser, salvataggio sul proprio cloud sovrano (anche un laptop), esportazione privata; solo il passaggio dal server lo separa da Lolly. Cloudinary ha una colonna propria: una pipeline media (DAM, API di trasformazione, CDN), e l'unica colonna cloud che distribuisce C2PA (50, perché fl_c2pa firma alla consegna, attestando consegnato-da-Cloudinary, non creato-da-te).

La collaborazione live va nella direzione opposta: Figma stabilisce il punto di riferimento di scala (200 editor) e il P2P a coppie, air-gapped di Lolly ottiene Parziale. Il prezzo è una stima, etichettata come tale: aritmetica sui prezzi di listino con combinazioni di posti realistiche, volutamente ampia, per la scala non per il procurement. Le API di rendering ottengono 75 sui vincoli: template bloccati, nessun livello di governance del brand.

Il divario: nulla di ciò che è distribuito oggi è constraints-first e offline senza account e senza server nel percorso di rendering, e nessuno ha copiato la clausola dell'account. Lolly ora distribuisce il proprio canvas aperto - **Design**, un canvas libero a manipolazione diretta - ma colori, tipografia e asset su di esso si conformano ai globali del brand, quindi anche la disposizione libera resta constraints-first.

Ciò che Lolly ancora **non** è è una suite di design non vincolata; i designer continueranno a usare Illustrator e Figma per il lavoro su misura - e quando quel lavoro deve diventare un asset governato e riproducibile, [Importa un design](/info/design-import.html) dello strumento Design porta il file finito di Figma, Penpot, Illustrator, InDesign o PDF sul canvas come riquadri modificabili e conformati al brand.

![Il canvas libero di Design, dove i colori, i caratteri e gli asset disponibili sono quelli del brand](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&dark=1&filename=aud-open-canvas)

## Usalo per

- Generazione rapida di asset creativi operazionalizzati (riquadri evento, badge, firme, avvisi)
- Disposizione libera sul canvas aperto (Design) quando i pezzi - colori, tipografia, icone, immagini - devono restare conformi ai globali del brand
- Portare un design finito da Figma, Penpot, Illustrator, InDesign o PDF (Importa un design dello strumento Design) così da poterlo modificare, governare e rendere di nuovo in modo deterministico in ogni formato Lolly
- Flussi uno-a-molti "compila tre campi, ottieni l'asset finito" - inclusi run in blocco da un foglio di calcolo/CSV nella griglia batch `/pro` (incolla o importa righe, un asset finito per riga, scarica come zip)
- Output brandizzati ricorrenti, sempre attivi
- Casi in cui il controllo centrale dell'espressione del brand conta più della flessibilità espressiva

Deck Studio è una buona misura del limite superiore qui: un intero mazzo di slide dichiarato come dati, impaginato dal vivo sul canvas ed esportato come PowerPoint nativo e modificabile.

![Deck Studio nella vista divisa - le slide del mazzo elencate come blocchi a sinistra, il mazzo impaginato reso a destra](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## Non usarlo per

- Contenuti hero su misura o di punta (cartelloni, video importanti)
- Lavoro di campagna unico che ha davvero bisogno di un designer
- Ideazione che deve sfuggire del tutto al sistema di brand - il canvas aperto di Lolly conforma comunque colori, tipografia e asset ai globali del brand, ed è proprio questo il punto

## Innovare in modo probabilistico, scalare in modo deterministico

La maggior parte delle proposte di "AI creativa" mette il modello dal lato sbagliato di una linea antica. Amanuensi e miniaturisti avevano già stabilito dove cadesse quella linea: lavori liberamente sullo schizzo, dove tutto può essere provato e nulla è definitivo, e poi vai alla stampa, che intimorisce proprio perché si impegna. Gli schizzi erano dove nasceva l'arte. La stampa era il modo in cui viaggiava. Due strumenti, due compiti, ciascuno inventivo a modo suo, e l'opera stampata poteva essere ritenuta affidabile perché la stampa manteneva la sua promessa a ogni tiratura.

Lolly è la stampa, non lo schizzo. Porta quello che vuoi all'ideazione - un modello, un designer, un tovagliolo - ma nel momento in cui un'idea deve diventare diecimila asset, passa attraverso qualcosa che rende allo stesso modo ogni volta, a partire da input che chiunque può rileggere. È di questo che parla davvero il confronto qui sopra: non chi ha il generatore migliore, ma chi rende riproducibile il passaggio definitivo.

> Fidati del processo creativo, scala con rigore.

## Approva lo strumento, non il file

Ogni altro strumento sul mercato produce un *file* che poi deve essere controllato - un brand manager in un thread Slack, l'ufficio legale sul disclaimer, un giro di modifiche, un'altra revisione. Lolly sposta l'approvazione **un passo più a monte**. Le regole del brand - codici hex esatti, file dei font con licenza, margini di abbondanza, spaziatura - sono codificate direttamente nell'HTML e nel CSS dello strumento, quindi il template *non può* generare un asset fuori brand. È il layout stesso a farla rispettare.

Così smetti di approvare gli output e inizi ad approvare lo **strumento** che li genera. Approvalo una volta, e ogni asset che produrrà sarà pre-approvato per costruzione - nessun essere umano nel ciclo, nessun ciclo di revisione, a qualsiasi volume.

Questo è il cambiamento che il motore deterministico offre davvero: non è una versione più veloce del vecchio processo di approvazione, lo elimina. Per il team creativo è un guard-rail, non un sostituto - sei sempre tu a lanciare la palla (i dati, il copy, l'immagine) e il codice è la corsia con le protezioni che impedisce a ogni lancio di finire nella canaletta.

![L'intero lavoro del producer: digitare le parole. Il carattere, il colore e la spaziatura erano già stabiliti quando lo strumento è stato approvato](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DApproved&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-approve-the-tool)

| Approvare gli asset alla vecchia maniera | Approvare lo strumento, alla maniera Lolly |
|---|---|
| Ogni file finito viene controllato, uno alla volta | Lo strumento viene controllato una volta sola |
| Richiesta → il designer crea → revisione brand → controllo legale → modifiche → nuova revisione | Una modifica di parametro → asset finito |
| Designer, brand manager, legale e richiedente tutti coinvolti | Il producer, da solo |
| Giorni per asset | Secondi per asset |
| 10.000 asset = 10.000 cicli di revisione | 10.000 asset = zero (il template era già approvato) |

## Cosa offre in modo unico

- **Un potenziale creativo audace, reso sicuro dal contesto.** Gli strumenti possono esprimere idee di design avventurose dentro guard-rail codificati a livello di codice.

- **Automazione dei contenuti definita via software, che restituisce l'asset finale.** Input → file finale. Niente "ora salvalo dal tuo strumento di design e rielaboralo".
- **Gli strumenti compongono altri strumenti.** Uno strumento può incorporare il render di un altro strumento e restituirlo come parte di un unico asset finito, senza alcun accoppiamento di codice tra strumenti - una primitiva che nessun prodotto di open-canvas o di templating per DAM sul mercato offre.
- **Neutralità rispetto ai fornitori.** Pieno controllo su funzionalità e costi. Motore open source. Strumenti e asset sono contenuti tracciati in git, non bloccati in un database SaaS.

Il primo di questi è quello che si tende a sottovalutare. Una mappa cittadina di qualità da poster, disegnata come veri percorsi vettoriali di strade e corsi d'acqua, a partire da un menu a tendina e due campi colore che non possono uscire dal brand:

![Gli anelli di canali e la rete stradale di Amsterdam disegnati da un bordo all'altro con l'inchiostro del brand, ogni tratto posizionato dal template e non a mano](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Sovranità dei contenuti

C'è un nome per ciò a cui porta la sezione precedente: sovranità. La tua pipeline multimediale gira su hardware di tua proprietà. Il tuo brand - i token, i font, i loghi, gli strumenti che li fanno rispettare - vive in file che possiedi tu, in un sistema di controllo versione che controlli tu, non nel database di un fornitore con un pulsante di esportazione. Il rendering avviene sul dispositivo che hai davanti, quindi un asset non transita mai da terze parti per esistere, e l'intero percorso dall'input al file finito è open source e ispezionabile. Se domani ogni fornitore SaaS di design sparisse, un'installazione di Lolly non se ne accorgerebbe.

Questo conta per chiunque il cui lavoro debba sopravvivere a un abbonamento: il genitore il cui album fotografico vive su quel laptop tanto quanto l'ente pubblico la cui libreria di brand è soggetta a regole di procurement. Per le organizzazioni - enti pubblici, settori regolamentati, chiunque abbia un brand che è un asset strategico e non una decorazione - "dove vivono i nostri contenuti e chi può spegnerli" è una questione di governance, non una preferenza. Qui la sovranità è una proprietà dell'architettura, non una funzione di hosting aggiunta per conformità, e le pagine [Privacy Policy](/info/privacy.html) e [Verify It Yourself](/info/verify-yourself.html) esistono perché tu possa verificare questa affermazione invece di darla per buona.

Alla base di tutto c'è una promessa, formulata come impegno e non come funzionalità: **se viene renderizzato sul tuo dispositivo, è gratuito per sempre.** Il motore, le shell, gli strumenti, i formati - l'intero percorso creativo on-device è open source e lo resta. Questa promessa ha un meccanismo: una versione già rilasciata è concessa in licenza in modo da non poter essere ritirata, e non esiste alcun accordo con i collaboratori che possa in futuro cambiarne la licenza. L'intero confine sta in una frase sola: tutto ciò che viene renderizzato sul tuo dispositivo è gratuito e open source, per sempre; coordinare persone e macchine attraverso una rete è compito di un control plane separato, [lolly.work](https://lolly.work).
