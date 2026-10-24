# Come si confronta Lolly

Lolly è due parti di un unico progetto open source. **Lolly** è l'engine, le app e gli strumenti per creare, modificare, convertire ed esportare sul tuo dispositivo, senza account. **Lolly Work** è il server per organizzazioni, eseguito sulla tua infrastruttura, per accesso, progetti condivisi, approvazioni e rendering sul server. Entrambi sono MPL-2.0. Questa pagina confronta la coppia con gli altri modi in cui le persone progettano, governano e producono file.

## Gli strumenti di oggi

Ogni anello valuta quanto completamente una classe di prodotti offre una capacità, con ogni classe valutata sul suo miglior rappresentante. La colonna Lolly copre insieme Lolly e Lolly Work, e ogni riga dice quale parte fornisce cosa. Apri il nome di una riga per il ragionamento dietro il suo punteggio. Le colonne sono ordinate per la riga Overall completeness in alto: la media delle righe valutate, con la riga della spesa esclusa.

::: figure positioning-comparison
Confronto delle capacità: ricerca sulla concorrenza e punteggi di agosto 2026; copertura di Lolly + Lolly Work rivista il 28 settembre 2026. Punteggio: 0 assente, 25 livello di ripiego, 50 reale ma vincolato o parziale, 75 solido con riserve, 100 competenza centrale.
:::

::: details Note sul punteggio
Funzioni disponibili e maturità di produzione sono cose separate. Lolly è rilasciato: la versione 1.0 è stata distribuita come open source il 30 agosto 2026, la sua sicurezza non ha ancora avuto un audit indipendente e le prove della sua adozione hanno pochi mesi ([Adoption & Governance](/info/adoption-governance.html#status) ha lo stato attuale). Avere il single sign-on, le approvazioni o il rendering sul server non stabilisce uno storico in produzione, quindi il punteggio di maturità lo riflette. I punteggi dei concorrenti mantengono la loro revisione datata di agosto.

Una regola governa la tabella. Il massimo dei voti (100), sulle righe che toccano i tuoi contenuti o la tua identità, richiede una capacità che puoi usare senza account e senza precondizioni cloud; le righe sul prodotto stesso, come maturità e facilità d'uso, ne sono esenti. Quella regola costa ad Adobe sulle Content Credentials: l'implementazione distribuita più ampia (Photoshop, Lightroom, Premiere, Firefly) firma in locale e nel cloud, ma mai senza un account e un'identità Adobe, quindi 75. Per lo stesso motivo limita le API di rendering su generazione di massa e automazione.

Canva è valutata sul suo miglior membro della famiglia per riga, dato che possiede Affinity e Cavalry (entrambi regalati nell'ottobre 2025). Il rendering offline e sul dispositivo ottiene 75 tramite Affinity, una suite desktop che richiede comunque un account verificato e porta telemetria, la detrazione che prende anche Adobe; la modalità offline di Canva stessa modifica solo design già sincronizzati, su un dispositivo, per una finestra limitata. Autofill ottiene 50: è reale ma riservato a Enterprise e asincrono, e compila solo testo e immagini. La generazione di massa di Figma è salita da 25 a 50 quando Buzz ha distribuito il riempimento da foglio di calcolo (una beta gratuita, agosto 2026).

Il punteggio 75 di Lolly per le Content Credentials copre la firma sul dispositivo e la firma sul server di Lolly Work con un'identità di organizzazione configurata; un verificatore deve comunque fidarsi del firmatario ([Content Credentials Identity](/info/content-credentials-identity.html)). Il 50 di Penpot arriva dal plugin di esportazione di Lolly per Penpot: la stessa firma dell'engine, opt-in e dichiarata come di Lolly. Penpot ottiene 90 sul rendering sul dispositivo: una tela del browser con una destinazione di salvataggio sul suo server, che può essere self-hosted. Cloudinary ha una colonna propria per la sua libreria di risorse, l'API di trasformazione e la CDN; la revisione di agosto ha valutato 50 la sua firma della consegna.

La collaborazione live di Lolly include collab private dirette tra due dispositivi e collab di lavoro autenticate tramite Lolly Work, con modifiche condivise, cursori e sessioni di team salvate. Il punteggio Partial riflette l'attuale installazione di lavoro a nodo singolo e la breve storia operativa, non l'assenza di modifica in team. Le stime di prezzo sono aritmetica datata sui prezzi di listino per dare la scala, non un acquisto.
:::

## Quando scegliere Lolly

::: cols
## Scegli Lolly quando

- Serve di continuo lo stesso tipo di file: tessere per eventi, badge, certificati, avvisi, schede social
- Molti file nascono da un template e da una tabella di valori, in [Batch](/info/batch.html#make-many-versions-of-one-design) o dalla CLI
- Colori, tipografia e risorse devono restare dentro il design system, anche su una tela aperta
- Un design finito in Figma, Penpot, Illustrator, InDesign o PDF deve diventare modificabile e ripetibile ([Import a design](/info/design-import.html))
- I file devono essere creati sui tuoi dispositivi o sui tuoi server

## Scegli altro quando

- Il lavoro è un ritocco fotografico dettagliato o un'illustrazione
- Stai progettando e prototipando l'interfaccia di un'applicazione
- Ti serve fin dal primo giorno una grande libreria di immagini e template
- Ti serve un servizio gestito con un lungo storico su larga scala
:::

I design importati e i design token condivisi permettono a un team di combinare Lolly con applicazioni specialistiche, mentre Lolly Work governa risorse condivise, revisione e consegna.

Un intero deck di slide mostra il tetto: in **Markdown Slides** un deck è dichiarato come dati, impaginato dal vivo ed esportato come file PowerPoint nativo e modificabile.

![Markdown Slides nella vista divisa: le slide del deck elencate come blocchi a sinistra, il deck impaginato che viene renderizzato a destra](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## Le regole vivono nello strumento

Lolly mette le regole riutilizzabili del brand nello strumento: colori, font, margini di abbondanza, spaziatura e input consentiti. Il template fissa le parti che un destinatario non deve cambiare. Lolly Work aggiunge attorno a quel template l'accesso per gruppi e le policy sugli input, con catene di approvazione per i contributi al catalogo e per la consegna.

Controllare uno strumento una volta rende più facile la produzione ripetibile, perché ogni output eredita le sue regole di layout. Testo, immagini caricate e diritti d'uso possono comunque richiedere un controllo, e Lolly Work fornisce cataloghi condivisi e passaggi di approvazione per questo. Per il team creativo lo strumento è un guardrail: porti sempre tu i dati, il testo e l'immagine, e lo strumento mantiene ogni risultato in linea con il brand.

![Tutto il lavoro di chi produce: scrivere le parole. Tipografia, colore e spaziatura sono stati decisi quando lo strumento è stato creato](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Altre tre cose distinguono questo approccio:

- **Il file finale, dagli input.** Input in entrata, file finito in uscita, senza "ora salvalo dal tuo strumento di design e rifiniscilo".
- **Gli strumenti compongono strumenti.** Uno strumento può incorporare il rendering di un altro in un unico file finito, senza alcun accoppiamento di codice tra loro.
- **Aperto fino in fondo.** L'engine è open source, e strumenti, risorse e design token sono file che puoi tenere sotto controllo di versione o gestire in Lolly Work, non righe nel database di qualcun altro.

Il design audace sopravvive ai guardrail. Questa mappa cittadina da poster è fatta di veri tracciati vettoriali di strade e acqua, da un menu a tendina e due campi colore che non si possono puntare fuori dal design system:

![Gli anelli dei canali e la rete stradale di Amsterdam disegnati da bordo a bordo con l'inchiostro del design system stesso, ogni tratto posizionato dal template e non a mano](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Innovare in modo probabilistico, scalare in modo deterministico

La maggior parte dei discorsi sulla "creatività con l'IA" mette il modello dal lato sbagliato di un'antica linea di confine. Amanuensi e miniatori hanno stabilito dove cade. Lavori libero sullo schizzo, dove tutto si può provare e nulla è definitivo. Poi vai alla stampa, che invece fissa. Gli schizzi erano il luogo dell'arte, e la stampa era il modo in cui viaggiava, e l'opera stampata poteva meritare fiducia perché la stampa manteneva la sua promessa a ogni copia.

Lolly è la stampa. Porta alle idee ciò che vuoi, un modello, un designer o un disegno abbozzato, ma nel momento in cui un'idea deve diventare molti file passa attraverso qualcosa che produce ogni volta lo stesso risultato, a partire da input che chiunque può rileggere. Il confronto qui sopra riguarda in realtà chi rende ripetibile quel passaggio definitivo.

> Fidati del processo creativo, scala con rigore.

## Gratis per sempre

**Se gira sul tuo dispositivo, è gratis per sempre.** L'engine, le shell, gli strumenti e i formati sono open source, e una versione rilasciata non può essere ritirata. Anche Lolly Work è open source. Un'organizzazione paga l'infrastruttura e la gestione che sceglie, senza alcun costo di licenza software per utente o per rendering per il self-hosting. [Domande e risposte](/info/faq.html) racconta la storia dietro la promessa.

## Dove vivono i tuoi contenuti

Il lavoro creativo di Lolly può girare su hardware che possiedi, e i suoi design token, font, loghi e strumenti sono file che puoi conservare. Con Lolly Work, progetti condivisi, risorse, policy e record di audit vivono nell'archiviazione che la tua organizzazione configura. [Fiducia](/info/trust.html) spiega perché è importante, e l'[Informativa sulla privacy](/info/privacy.html) e [Verify It Yourself](/info/verify-yourself.html) ti permettono di verificare l'affermazione anziché fidarti della nostra parola.

## Strumento per strumento

[Lolly a confronto, strumento per strumento](/info/compare.html) confronta Lolly con Canva, Adobe, Figma, Penpot, portali di brand, API di rendering e convertitori online, una pagina ciascuno, ed espone [what runs where](/info/compare.html#what-runs-where).
