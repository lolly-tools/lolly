# Come funziona Lolly

Uno strumento Lolly contiene le regole per un tipo di file: il layout, la tipografia, i colori e quali parti possono cambiare gli altri. Tu, un collega, uno script o un agente AI compilate i campi e ogni file segue quelle regole.

<!--i:eti-repeat-->
## Uno strumento, le tue regole, tanti file

Le regole del brand risiedono nello strumento. Configuralo una volta e ogni output avrà la stessa tipografia, gli stessi colori e la stessa spaziatura, da una singola card a un foglio di calcolo con righe in una dozzina di lingue.

![Uno strumento per wordmark con un campo compilato: tipografia, colore e spaziatura sono stati stabiliti alla creazione dello strumento](/info/shots/aud-rules-in-the-tool.svg)

Chi crea il centesimo file deve solo digitare le parole. Tu decidi come viene controllato il lavoro e chi lo controlla. Lolly riduce ciò che c'è da verificare e velocizza la creazione del file successivo.

<!--i:eti-users-->
## Chi lavora con uno strumento

Tre ruoli di un'organizzazione lavorano su una card per una campagna.

![Un designer stabilisce le regole una volta in uno strumento; uno sviluppatore lo esegue da uno script e chiunque può compilarne i campi; entrambi producono file finiti](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **Un designer stabilisce le regole.** Impagina la card in Lolly Design con la tipografia e i colori del brand, poi sceglie quali campi lasciare aperti. Lo fa una volta sola, così nessuno deve più localizzare la card a mano.
- <!--i:code--> **Uno sviluppatore usa lo strumento su larga scala.** Lo stesso strumento viene eseguito in uno script notturno tramite la riga di comando. Un grafico aggiornato o una versione in un'altra lingua arriva senza che nessuno riapra il design.
- <!--i:people--> **Chiunque lo compila.** Un commerciale in aereo, senza rete né formazione nel design, apre lo strumento e crea la card per la riunione di domani.
:::

Il grafico aggiornato dello sviluppatore è un rendering come questo, creato da una stringa di dati e poche impostazioni:

![Un grafico ad aree impilate con un titolo, le tre serie in fasce dai colori freddi e assi, legenda e titolo posizionati dal template anziché a mano](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Il minuto che basta al commerciale dipende dalle regole del designer e dallo script dello sviluppatore. Ogni ruolo lavora con lo stesso strumento.

<!--i:eti-train-->
## Quattro percorsi per ottenere un file

Ogni percorso esegue lo stesso motore sullo stesso strumento, quindi il file prodotto da uno script corrisponde a quello che vedi in anteprima nell'app.

![I parametri URL e gli argomenti della riga di comando diventano lo stesso modello di input, eseguito attraverso un unico runtime condiviso e un ponte di esportazione](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **Nell'app, uno alla volta.** Apri uno strumento, compila i campi e premi **Export**. [Crea il tuo primo file](/info/make-something.html) ti guida nella creazione.
- <!--i:layers--> **Nell'app, tanti insieme.** [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) prende una tabella incollata o importata e renderizza un file finito per ogni riga.
- <!--i:cpu--> **Da uno script o un agente AI.** La [CLI](/info/cli.html) esegue uno strumento senza interfaccia grafica e il [server MCP](/info/mcp.html) permette a un agente di trovare ed eseguire strumenti. Anche il link a uno strumento contiene i suoi input, quindi un link è una richiesta completa.
- <!--i:server--> **Tramite il server della tua organizzazione.** [Lolly Work](/info/organisation.html) esegue il rendering sul server secondo le regole di accesso e di uso degli strumenti della tua organizzazione, conserva i processi che può riprendere e mantiene l'output per il download o la consegna approvata.

Il percorso che un processo può usare dipende dai formati dello strumento e dalle capacità dell'host. Alcuni formati richiedono un browser, quindi la riga di comando li passa a un livello browser. [Rendering con la CLI](/info/cli-rendering.html) elenca dove viene renderizzato ogni formato.

<!--i:eti-monitor-->
## Cosa viene eseguito e dove

Creazione, modifica ed esportazione avvengono sul tuo dispositivo, senza account. Una funzione che richiede un server, come Sync o l'invio di un file a un servizio collegato, si connette solo quando la usi. Con Lolly Work, i progetti condivisi, la modifica live in team, le approvazioni e i processi sul server usano il server della tua organizzazione. [Cosa viene eseguito e dove](/info/compare.html#what-runs-where) mette a confronto le due parti.

<!--i:eti-graduation-cap-->
## Prossime letture

- [Crea il tuo primo file](/info/make-something.html), per provare subito.
- [Inizia](/info/quickstart.html), per inserire il tuo design system.
- [Automatizza](/info/builders.html), per la riga di comando, i link e gli agenti.
- [Architettura di Lolly](/info/overview.html), per chi contribuisce: il motore, le interfacce e le regole che li tengono insieme.
