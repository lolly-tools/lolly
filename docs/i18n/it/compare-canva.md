# Lolly e Canva

_Ultima verifica: 28 settembre 2026._

Lolly crea grafiche in linea con il brand, post social, presentazioni e layout nel browser. Insieme a [lolly.work](https://lolly.work), supporta anche progetti condivisi, collaborazione di lavoro in tempo reale, asset approvati e policy dell'organizzazione.

## Dove si sovrappongono

Entrambi permettono di partire da un template e produrre una grafica finita senza essere un designer. Entrambi supportano flussi di lavoro di team e controlli del brand: [Canva li include nei suoi piani business](https://www.canva.com/canva-business/); Lolly separa le app creative dal servizio per organizzazioni.

Lolly funziona in modo autonomo sul tuo dispositivo, senza account. lolly.work aggiunge SSO, provisioning SCIM, ruoli, cataloghi condivisi, approvazioni e report di utilizzo quando la tua organizzazione ne ha bisogno. Fa parte del progetto Lolly, è distribuito separatamente ed è open source con licenza MPL-2.0, come Lolly stessa.

## Template e lavoro di squadra

Canva combina in un unico servizio un'ampia libreria di template e stock, app e flussi di lavoro di team ospitati. Quei contenuti già pronti e quell'esperienza gestita possono essere utili nella scelta di un punto di partenza. Vedi i [template di Canva](https://www.canva.com/templates/) e il [marketplace delle app](https://www.canva.com/apps/).

Gli strumenti di Lolly codificano le modifiche consentite e possono essere riutilizzati nel browser, nell'app desktop o nella CLI. Un design può diventare uno [strumento con regole](/info/create-a-tool.html), e lo stesso strumento può produrre molti output a partire da una tabella di valori. lolly.work gestisce accessi, lavoro condiviso e policy attorno a questi strumenti.

La modifica in tempo reale è disponibile sia con le [collab private](/info/collaborate.html), che collegano direttamente due dispositivi, sia con le collab di lavoro tramite l'istanza lolly.work di un'organizzazione. Le collab di lavoro includono modifiche condivise, cursori e sessioni di team salvate. L'attuale distribuzione lato server usa un singolo nodo di collaborazione; la sua scala e la sua storia operativa differiscono da quelle del servizio consolidato di Canva.

## Dove vive il lavoro

Lolly autonomo mantiene creazione ed esportazione sul dispositivo e può lavorare offline una volta disponibili i suoi asset. La collaborazione di lavoro, l'archiviazione di team e il rendering lato server usano i servizi configurati dall'organizzazione. Questa scelta di distribuzione è la differenza: un'organizzazione può gestire in proprio entrambe le parti di Lolly, senza costi di licenza software per utente, pagando però il proprio hosting e la propria amministrazione.

Le Content Credentials sono facoltative per le esportazioni supportate. lolly.work può firmare l'output lato server con un'identità dell'organizzazione configurata; un verificatore deve fidarsi di quell'identità prima di mostrare il firmatario come attendibile. Consulta [Identità di Content Credentials](/info/content-credentials-identity.html) e la [panoramica della soluzione combinata](/info/compare.html).

Canva è un marchio del suo proprietario. Questa pagina descrive dove le due soluzioni si sovrappongono e non è affiliata a Canva.
