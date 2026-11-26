# Lolly e le API di rendering

_Ultima verifica: 5 novembre 2026._

Se generi immagini da template tramite un'API, questa pagina spiega cosa cambia quando esegui quella produzione sul tuo dispositivo, in CI o su un server che controlli. [Passa da un'API di rendering ospitata](/info/work-move-from-render-api.html) indica i passaggi.

<!--i:eti-award-->
## Cosa fanno meglio le API di rendering ospitate

[Bannerbear](https://www.bannerbear.com/) e [Placid](https://placid.app/) sono servizi gestiti: invii una richiesta e qualcun altro gestisce i server.

- **Nulla da gestire.** Nessun server, database, archiviazione, aggiornamento o pianificazione della capacità.
- **Un editor di template ospitato** con template pronti da adattare.
- **Più tipi di output da un'unica API.** Entrambi pubblicano endpoint per video e PDF e Bannerbear documenta anche output animati, WebP e AVIF, screenshot e rimozione dello sfondo tramite AI.
- **Le loro integrazioni e la loro assistenza.**

Se è questa la soluzione che cerchi, quei servizi sono una scelta valida.

<!--i:eti-home-->
## Cosa ti offre l'hosting autonomo

- **I tuoi contenuti restano sui tuoi sistemi.** Input, risorse e output risiedono sull'infrastruttura che hai scelto. Il rendering su un dispositivo o in CI non richiede alcun servizio.
- **Le regole risiedono nello strumento.** Colori, caratteri, loghi e input bloccati provengono dal tuo [design system](/info/brand-studio.html), quindi chi effettua la chiamata può cambiare solo ciò che permetti. [Lolly Work](/info/compare.html#what-runs-where) applica la visibilità degli strumenti e le policy sugli input a ogni richiesta.
- **Lo stesso strumento ovunque.** Uno strumento renderizza dagli stessi input su un portatile, in un job CI o su un server. Le persone possono modificare lo stesso strumento nell'app.
- **Record in tuo possesso.** [Ricevute di rendering](/info/work-renders.html#evidence-and-identity), un registro di audit e Content Credentials dove configuri un'identità di firma.
- **Open source e senza costi a consumo.** Esegui il codice e paghi solo la tua infrastruttura.

Ti assumi il lavoro che quei servizi svolgono per te. Un server duraturo richiede un database persistente e un'archiviazione per gli output. Gli strumenti che richiedono un browser hanno bisogno del worker Chromium. [Installare Lolly Work](/info/work-install.html) descrive entrambi gli aspetti.

<!--i:eti-table-->
## Le attività a confronto

| Attività | API di rendering ospitata | Lolly |
|---|---|---|
| Compilare un template con dati | Richiesta API che indica un template e i suoi livelli | [URL](/info/url-mode.html), [CLI](/info/cli.html) o [API del server](/info/work-automation-api.html) che indica uno strumento e i suoi input |
| Molti file da una tabella | Batch e raccolte | [Batch](/info/batch.html) sul tuo dispositivo o [batch di rendering](/info/work-renders.html#batches-with-durable-rows) su un server |
| Attendere o interrogare periodicamente per un risultato | Polling o un'opzione sincrona | Rendering persistenti che interroghi periodicamente o un rendering immediato |
| Chiamare un webhook al termine | Sì | [Callback firmati](/info/work-renders.html) verso origini che autorizzi |
| URL di immagine dinamico | Sì | [Link di condivisione e URL `/render`](/info/url-mode.html) |
| Modificare un template | Editor ospitato | [Design](/info/using.html), sul tuo dispositivo |
| Agenti | Entrambi pubblicano un server MCP | [MCP](/info/mcp.html), con un endpoint dell'organizzazione soggetto alla policy di un token su Lolly Work |

I tipi di output di Lolly sono elencati in [Esportazione](/info/exporting.html). Su un server Work oggi i rendering persistenti creano SVG, PNG, JPG e PDF e [il video resta sul dispositivo, nella CLI e in MCP](/info/work-renders.html#production-still-checks-and-permitted-repairs).

<!--i:eti-folder-move-->
## Cosa viene trasferito e cosa no

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Le tue richieste | L'API di migrazione di Work accetta la stessa struttura | Lo stesso | Lo stesso |
| I tuoi template | **Import** come documenti modificabili, tranne i tipi di livello senza uno schema confermato | Solo nomi dei campi e un'anteprima. Ricostruisci ogni template | Solo nomi dei campi e un'anteprima. Ricostruisci ogni template |
| URL dinamici esistenti | Non supportati | Non supportati | Gli URL firmati continuano a funzionare dopo un cambio di host, con il tuo vecchio token privato |
| Webhook | I webhook registrati non sono supportati | `webhook_url` funziona | `webhook_success` funziona |
| Output WebP e AVIF | Rifiutati per nome | Non offerti | WebP rifiutato per nome |
| Animazioni, video, raccolte, screenshot | Non disponibili nell'API di migrazione | Non disponibili nell'API di migrazione | Non disponibili nell'API di migrazione |

::: note Realizzato a partire dalla documentazione pubblica
Questo è stato realizzato a partire dalla documentazione pubblica di ogni fornitore e non è stato eseguito su un account reale. Se hai un account, [la guida alla migrazione](/info/work-move-from-render-api.html#check-it-on-your-own-account) contiene una breve lista di verifica.
:::

Puoi trasferire un template e lasciare gli altri dove sono. [Lasciare Lolly](/info/work-move-from-render-api.html#leave-lolly-too) è altrettanto libero: gli strumenti sono semplici file e la CLI li renderizza senza server.

<!--i:eti-building-->
## Chi gestisce il servizio

Con Lolly, una persona renderizza localmente oppure un team esegue Lolly Work sulla propria infrastruttura. Un job sul server invia a quell'istanza i propri input e le risorse necessarie. Il percorso sul dispositivo non lo fa.

Bannerbear e Placid sono marchi dei rispettivi proprietari. Questa pagina descrive dove i prodotti si sovrappongono, sulla base della loro documentazione pubblica, e non è affiliata a nessuno dei due.
