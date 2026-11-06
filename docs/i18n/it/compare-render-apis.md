# Lolly e le API di rendering

_Ultima verifica: 5 novembre 2026._

Se oggi generi immagini da template tramite un'API, questa pagina dice cosa cambia se gestisci tu quella produzione: sul tuo dispositivo, in CI o su un server che controlli. [Move from a hosted render API](/info/work-move-from-render-api.html) spiega come fare.

## Cosa fanno meglio le API di rendering ospitate

[Bannerbear](https://www.bannerbear.com/) e [Placid](https://placid.app/) sono servizi gestiti, e questo è un vero vantaggio. Invii una richiesta e i server li gestisce qualcun altro, li tiene attivi e regge il carico.

- **Niente da gestire.** Nessun server, database, archiviazione, aggiornamento o pianificazione della capacità.
- **Un editor di template ospitato** con template pronti da adattare.
- **Più tipi di output da una sola API.** Entrambi pubblicano endpoint per video e PDF, e Bannerbear documenta anche output animato, WebP e AVIF, screenshot e rimozione dello sfondo con IA.
- **Integrazioni e assistenza proprie.**

Se è questo l'assetto che vuoi, quei servizi sono una scelta solida.

## Cosa ti dà il self-hosting

- **I tuoi contenuti restano sui tuoi sistemi.** Input, risorse e output vivono su un'infrastruttura che hai scelto tu. Il rendering su un dispositivo o in CI non richiede alcun servizio.
- **Le regole vivono nello strumento.** Colori, tipografia, loghi e input bloccati vengono dal tuo [design system](/info/brand-studio.html), quindi chi chiama può cambiare solo ciò che consenti. [Lolly Work](/info/compare.html#what-runs-where) applica a ogni richiesta la visibilità degli strumenti e le policy sugli input.
- **Lo stesso strumento ovunque.** Uno strumento esegue il rendering su un portatile, in un job di CI o su un server dagli stessi input, e le persone possono modificare lo stesso strumento nell'app.
- **Registri che custodisci tu.** [Render receipts](/info/work-renders.html#evidence-and-identity), un audit trail e Content Credentials dove configuri un'identità di firma.
- **Open source e senza contatore.** Esegui tu il codice, e paghi la tua infrastruttura.

Ti prendi in carico il lavoro che quei servizi fanno per te. Un server durevole richiede un database persistente e archiviazione dell'output, e gli strumenti che dipendono dal browser richiedono il worker Chromium. [Install Lolly Work](/info/work-install.html) descrive entrambi.

## Come si corrispondono i lavori

| Lavoro | API di rendering ospitata | Lolly |
|---|---|---|
| Compilare un template da dati | Richiesta API che indica un template e i suoi livelli | [URL](/info/url-mode.html), [CLI](/info/cli.html) o [API del server](/info/work-automation-api.html) che indicano uno strumento e i suoi input |
| Molti file da una tabella | Batch e raccolte | [Batch](/info/batch.html) sul tuo dispositivo, o [batch di rendering](/info/work-renders.html#batches-with-durable-rows) su un server |
| Attendere o interrogare un risultato | Polling, o un'opzione sincrona | Rendering durevoli che interroghi, o un rendering immediato |
| Chiamare un webhook al termine | Sì | [Callback firmati](/info/work-renders.html) verso origini che consenti |
| URL di immagine dinamico | Sì | [Link di condivisione e URL `/render`](/info/url-mode.html) |
| Modificare un template | Editor ospitato | [Design](/info/using.html), sul tuo dispositivo |
| Agenti | Entrambi pubblicano un server MCP | [MCP](/info/mcp.html), con un endpoint dell'organizzazione sotto la policy di un token su Lolly Work |

I tipi di output di Lolly stesso sono elencati in [Exporting](/info/exporting.html). Oggi su un server Work i rendering durevoli creano SVG, PNG, JPG e PDF, e [il video resta sul dispositivo, nella CLI e in MCP](/info/work-renders.html#production-still-checks-and-permitted-repairs).

## Cosa si trasferisce e cosa no

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Le tue richieste | L'API di migrazione di Work accetta la stessa forma | Uguale | Uguale |
| I tuoi template | **Import** come documenti modificabili, tranne i tipi di livello senza schema confermato | Solo nomi dei campi e un'anteprima. Ricostruisci ciascuno | Solo nomi dei campi e un'anteprima. Ricostruisci ciascuno |
| URL dinamici esistenti | Non supportati | Non supportati | Gli URL firmati continuano a funzionare dopo un cambio di host, con il tuo vecchio token privato |
| Webhook | I webhook registrati non sono supportati | `webhook_url` funziona | `webhook_success` funziona |
| Output WebP e AVIF | Rifiutato per nome | Non offerto | WebP rifiutato per nome |
| Animazioni, video, raccolte, screenshot | Non nell'API di migrazione | Non nell'API di migrazione | Non nell'API di migrazione |

Tutto questo è stato costruito dalla documentazione pubblica di ogni fornitore e non è stato eseguito su un account reale. [La guida al passaggio](/info/work-move-from-render-api.html#check-it-on-your-own-account) ha una breve lista di controllo se ne hai uno.

Passare non è un tutto o niente. Puoi spostare un solo template e lasciare gli altri dove sono, e [lasciare Lolly](/info/work-move-from-render-api.html#leave-lolly-too) resta altrettanto aperto: gli strumenti sono file semplici e la CLI li renderizza senza server.

## Chi gestisce il servizio

Con Lolly, una persona esegue il rendering in locale, oppure un team usa Lolly Work sulla propria infrastruttura. Inviare un lavoro al server manda i suoi input e le risorse necessarie a quell'istanza, il che è diverso dal percorso sul dispositivo.

Bannerbear e Placid sono marchi dei rispettivi titolari. Questa pagina descrive dove i prodotti si sovrappongono, dalla loro documentazione pubblica, e non è affiliata a nessuno dei due.
