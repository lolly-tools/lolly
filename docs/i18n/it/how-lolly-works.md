# Come funziona Lolly

Uno strumento Lolly contiene le regole per un tipo di file: il layout, la tipografia, i colori e quali parti altre persone possono modificare. Tu, un collega, uno script o un agente di IA compilate i campi, e ogni file esce giusto. Questa pagina mostra chi fa cosa e i quattro percorsi da uno strumento a un file finito.

## Uno strumento, le tue regole, molti file

Le regole del brand vivono nello strumento, non in ogni file che produce. Imposta bene lo strumento una volta e ogni output eredita la stessa tipografia, lo stesso colore e la stessa spaziatura, che si tratti di una sola scheda o di un foglio di calcolo di righe in una dozzina di lingue.

![Uno strumento wordmark con un campo compilato: tipografia, colore e spaziatura sono stati decisi quando lo strumento è stato creato](/info/shots/aud-rules-in-the-tool.svg)

Chi crea il centesimo file scrive soltanto le parole. Come controlli il lavoro, e chi lo controlla, resta una tua decisione. Lolly rende più piccola la cosa da controllare e più rapido il file successivo.

## Chi mette mano a uno strumento

Segui una scheda di campagna attraverso un'organizzazione e compaiono tre paia di mani. Ognuna costruisce sulla precedente.

![Un designer imposta le regole una volta in uno strumento; uno sviluppatore lo esegue da uno script e chiunque può compilarne i campi; entrambi producono file finiti](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **Un designer imposta le regole.** Imposta la scheda in Design con la tipografia e i colori del brand, poi sceglie quali campi restano aperti. Lo fa una volta sola, così nessuno localizza più la scheda a mano.
- <!--i:code--> **Uno sviluppatore scala lo strumento.** Lo stesso strumento gira in uno script notturno dalla riga di comando, così arriva un grafico aggiornato o una nuova versione linguistica senza che nessuno riapra il design.
- <!--i:people--> **Chiunque lo compila.** Un commerciale in aereo, senza rete e senza formazione di design, apre lo strumento e crea la scheda per la riunione di domani.
:::

Il grafico aggiornato nel passaggio dello sviluppatore è un rendering come questo, creato da una stringa di dati e da qualche impostazione, senza che nessuno apra un file di design:

![Un grafico ad area impilata con titolo, le cui tre serie sono a fasce in una palette fredda, con assi, legenda e titolo tutti posizionati dal template e non a mano](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Il minuto facile del commerciale è possibile solo grazie alla cura del designer e allo script dello sviluppatore. Ogni ruolo lavora con lo stesso strumento, invece di un prodotto separato ciascuno.

## Quattro percorsi verso un file

Ogni percorso esegue lo stesso engine sullo stesso strumento, quindi il file prodotto da uno script corrisponde a quello che vedi in anteprima nell'app.

![I parametri URL e gli argomenti da riga di comando diventano lo stesso modello di input, eseguito attraverso un unico runtime e un unico bridge di esportazione](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **Nell'app, uno alla volta.** Apri uno strumento, compila i campi e premi **Export**. [Crea il tuo primo file](/info/make-something.html) ti guida a farne uno.
- <!--i:layers--> **Nell'app, molti insieme.** [Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) prende una tabella incollata o importata e produce un file finito per ogni riga.
- <!--i:cpu--> **Da uno script o da un agente di IA.** La [CLI](/info/cli.html) esegue uno strumento in modalità headless e il [server MCP](/info/mcp.html) permette a un agente di scoprire ed eseguire gli strumenti. Anche il link a uno strumento porta i suoi input, quindi un link è una richiesta completa.
- <!--i:server--> **Tramite il server della tua organizzazione.** [Lolly Work](/info/organisation.html) renderizza sul server con l'accesso e la policy degli strumenti della tua organizzazione, mantiene lavori che può riprendere e conserva l'output per il download o per una consegna approvata.

Quale percorso può usare un lavoro dipende dai formati dello strumento e da ciò che l'host sa fare: alcuni formati richiedono un browser, quindi la riga di comando li passa a un livello browser. [Render with the CLI](/info/cli-rendering.html) elenca quali formati vengono renderizzati dove.

## Cosa gira dove

Creare, modificare ed esportare avviene sul tuo dispositivo, senza account. Una funzione che richiede un server, come Sync o l'invio di un file a un servizio collegato, si connette solo quando la usi. Con Lolly Work, i progetti condivisi, la modifica live in team, le approvazioni e i lavori sul server usano il server della tua organizzazione. [What runs where](/info/compare.html#what-runs-where) mette le due parti a confronto.

## Da leggere dopo

- [Crea il tuo primo file](/info/make-something.html), per provare subito.
- [Inizia](/info/quickstart.html), per inserire il tuo design system.
- [Automatizza](/info/builders.html), per riga di comando, link e agenti.
- [Architettura di Lolly](/info/overview.html), per chi contribuisce: l'engine, le shell e le regole che li tengono insieme.
