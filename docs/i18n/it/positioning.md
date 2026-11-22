# Lolly a confronto

Lolly crea file coerenti con il brand sul tuo dispositivo, senza account. **Lolly Work** è il server per i team: accesso, progetti condivisi, approvazioni e rendering sul server, su macchine gestite dalla tua organizzazione. Entrambi sono open source con licenza MPL-2.0.

La maggior parte dei team mantiene gli strumenti che ha. Un'app di design fornisce i design, un DAM resta la fonte ufficiale e Lolly trasforma gli input approvati in file finiti. [Usa Lolly con il tuo DAM esistente](/info/use-with-dam.html) descrive questa combinazione. L'idea alla base della combinazione è la [sovranità sui contenuti](/info/content-sovereignty.html).

<!--i:eti-gauge-->
## Gli strumenti di oggi

Ogni anello mostra in che misura una categoria di prodotti soddisfa un'esigenza. Premi un **?** accanto a una riga per vedere le prove e il **?** accanto alla legenda per vedere come funzionano i punteggi.

::: figure positioning-comparison
Confronto delle capacità. Ricerca sui concorrenti basata sui documenti dei fornitori, da agosto al 21 novembre 2026. Lolly e Lolly Work esaminati il 21 novembre 2026. Punteggi: 0 assente, 25 soluzione alternativa, 50 reale ma con accesso limitato o parziale, 75 solida con riserve, 100 competenza centrale.
:::

::: details Fonti per i punteggi cambiati a novembre 2026
- Canva: [registro delle modifiche delle API](https://www.canva.dev/docs/apps/rest-apis/changelog/), [app di servizio](https://www.canva.dev/blog/developers/canva-service-accounts/), [guida a Brand Controls](https://www.canva.com/help/brand-control/)
- Adobe: [registro delle modifiche di InDesign API](https://developer.adobe.com/firefly-services/docs/indesign-apis/getting-started/changelog/), [prezzi di Adobe Express](https://www.adobe.com/express/pricing)
- Figma: [crediti per agenti e AI](https://help.figma.com/hc/en-us/articles/42614902212887), [server MCP](https://developers.figma.com/docs/figma-mcp-server/)
- Frontify e Bynder: [nota di rilascio di Frontify di ottobre 2026](https://news.frontify.com/163371-what-s-new-in-october-2026), [Frontify MCP](https://help.frontify.com/en/articles/14787214-frontify-mcp-beta)
- Bannerbear e Placid: [prezzi di Bannerbear](https://www.bannerbear.com/pricing/), [registro delle modifiche di Bannerbear](https://www.bannerbear.com/changelog/), [prezzi di Placid](https://placid.app/pricing)
- Penpot: [prezzi per l'hosting in proprio](https://penpot.app/pricing/self-host), [rilasci](https://github.com/penpot/penpot/releases)
- Cloudinary: [provenienza dei contenuti](https://cloudinary.com/documentation/content_provenance_and_authenticity), [prezzi](https://cloudinary.com/pricing)
:::

Funzionalità ed esperienza comprovata sono righe separate. Il primo rilascio pubblico di Lolly è stato la versione 1.0.1 il 30 agosto 2026, la sua sicurezza non è ancora stata sottoposta a un audit indipendente e le prove della sua adozione risalgono a pochi mesi fa. [Adozione & governance](/info/adoption-governance.html#status) riporta lo stato attuale.

<!--i:eti-hammer-->
## Quando scegliere Lolly

::: cols
## Scegli Lolly quando

- Serve lo stesso tipo di file più e più volte: card per eventi, badge, certificati, avvisi, card per i social
- Molti file nascono da un template e una tabella di valori, in [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) o nella CLI
- Colori, caratteri e risorse devono restare all'interno del design system, anche su una tela libera
- Un design finito di Figma, Penpot, Illustrator, InDesign, Affinity o PDF deve diventare modificabile e ripetibile ([Importa un design](/info/design-import.html))
- I file devono essere creati sui tuoi dispositivi o server

## Scegli qualcos'altro quando

- Il lavoro è fotoritocco dettagliato o illustrazione
- Stai progettando e prototipando l'interfaccia di un'applicazione
- Ti serve un'ampia libreria di contenuti stock e template pronta dal primo giorno
- Ti serve un servizio gestito con una lunga esperienza comprovata su larga scala
:::

I design importati e i design token condivisi permettono a un team di combinare Lolly con applicazioni specializzate, mentre Lolly Work governa risorse condivise, revisione e consegna.

Per i team con un DAM curato, inizia mantenendo quella libreria e i suoi amministratori. [L'esperienza di SUSE con Brandfolder](/info/suse-brandfolder.html) documenta come l'integrazione abbia sostenuto l'adozione e la gestione del cambiamento nei processi di approvazione. I fornitori di DAM e i partner di implementazione possono valutare la stessa configurazione attraverso [il flusso di lavoro per i partner](/info/dam-partners.html).

In **Lolly Markdown Slides** un intero deck viene scritto come dati, impaginato live ed esportato come file PowerPoint nativo e modificabile.

![Lolly Markdown Slides nella vista divisa: le slide del deck elencate come blocchi a sinistra, il rendering del deck impaginato a destra](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

<!--i:eti-shield-check-->
## Le regole stanno nello strumento

Lolly inserisce nello strumento regole riutilizzabili del brand: colori, font, margini di abbondanza, spaziatura e input consentiti. Il template fissa le parti che un destinatario non deve cambiare. Lolly Work aggiunge accesso per gruppi e policy sugli input attorno a quel template, con catene di approvazione per le proposte al catalogo e la consegna.

Controllare uno strumento una volta facilita la produzione ripetibile, perché ogni output eredita le sue regole di layout. Testi, immagini caricate e diritti d'uso possono ancora richiedere controlli e Lolly Work fornisce cataloghi condivisi e passaggi di approvazione per questo. Per il team creativo lo strumento è una barriera di protezione: continui a fornire i dati, il testo e l'immagine e lo strumento mantiene ogni risultato coerente con il brand.

![Tutto il lavoro di chi produce: digitare le parole. Caratteri, colore e spaziatura sono stati definiti quando è stato creato lo strumento](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Altre tre differenze:

- **Il file finale, dagli input.** Entrano gli input, esce il file finito, senza "ora salvalo dal tuo strumento di design e sistemalo".
- **Gli strumenti compongono strumenti.** Uno strumento può incorporare il rendering di un altro in un unico file finito, senza accoppiamento tra i rispettivi codici.
- **Open source.** Il motore è open source e strumenti, risorse e design token sono file che puoi tenere sotto controllo di versione o gestire in Lolly Work, non righe nel database di qualcun altro.

Il design audace sopravvive alle barriere di protezione. Questa mappa urbana da poster è composta da veri tracciati vettoriali di strade e corsi d'acqua, ottenuti da un menu a tendina e due campi colore che non possono uscire dal design system:

![Gli anelli dei canali e la rete stradale di Amsterdam disegnati da bordo a bordo con l'inchiostro del design system, ogni tratto posizionato dal template anziché a mano](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

<!--i:eti-stamp-->
## Innova in modo probabilistico, scala in modo deterministico

La maggior parte delle proposte di "creatività con l'AI" mette il modello dal lato sbagliato di un confine antico. Scribi e miniatori ne avevano già stabilito la posizione. Sul bozzetto lavori liberamente, puoi provare tutto e nulla è definitivo. Poi passi al torchio tipografico, che rende definitivo il risultato. L'arte era nei bozzetti e il torchio era il modo in cui viaggiava, e ci si poteva fidare del lavoro stampato perché il torchio manteneva la sua promessa a ogni tiratura.

Lolly è il torchio. Porta ciò che vuoi alla fase delle idee, un modello, un designer o un disegno abbozzato, ma nel momento in cui un'idea deve diventare molti file passa attraverso qualcosa che renderizza allo stesso modo ogni volta, da input che chiunque può rileggere. Il confronto qui sopra riguarda in realtà chi rende ripetibile quel passaggio al risultato definitivo.

> Fidati del processo creativo, scala con rigore.

<!--i:eti-tag-->
## Gratis per sempre

**Se viene renderizzato sul tuo dispositivo, è gratis per sempre.** Il motore, le shell, gli strumenti e i formati sono open source e una versione rilasciata non può essere ritirata. Anche Lolly Work è open source. Un'organizzazione paga per l'infrastruttura e la gestione che sceglie, senza costi di licenza software per postazione o per rendering per l'hosting in proprio. [Domande & risposte](/info/faq.html) racconta la storia dietro la promessa.

<!--i:eti-map-pin-->
## Dove risiedono i tuoi contenuti

Il lavoro creativo di Lolly può essere eseguito su hardware di tua proprietà e i suoi design token, font, loghi e strumenti sono file che puoi conservare. Con Lolly Work, progetti condivisi, risorse, policy e record di audit risiedono nell'archiviazione configurata dalla tua organizzazione. [Fiducia](/info/trust.html) spiega perché conta e l'[Informativa sulla privacy](/info/privacy.html) e [Verifica tu stesso](/info/verify-yourself.html) ti permettono di verificare l'affermazione invece di crederci sulla parola.

<!--i:eti-grid-->
## Strumento per strumento

[Lolly a confronto, strumento per strumento](/info/compare.html) confronta Lolly con Canva, Adobe, Figma, Penpot, portali del brand, API di rendering e convertitori online, una pagina per ciascuno, e indica [cosa viene eseguito dove](/info/compare.html#what-runs-where).
