# Lolly e Figma

_Ultima verifica: 28 settembre 2026._

Lolly supporta design, modifica in tempo reale e produzione di asset riutilizzabili. [lolly.work](https://lolly.work) aggiunge i servizi per l'organizzazione attorno a questo lavoro: identità, progetti condivisi, controlli di accesso e approvazioni.

## Dove si sovrappongono

Entrambi permettono di disporre testo, forme e immagini su una tela e di lavorare con altre persone. [Importa un design](/info/design-import.html) di Lolly legge i file Figma come layout modificabili. Anche Figma copre la produzione di brand basata su template: [Figma Buzz](https://help.figma.com/hc/en-us/articles/31271566667543-Guide-to-Figma-Buzz) crea asset a partire da template e li compila da file CSV o XLSX.

Lolly trasforma un design in uno [strumento riutilizzabile con regole](/info/create-a-tool.html). Quello strumento funziona nel browser o nella CLI e accetta input da un URL, da uno script o dalla griglia batch. Lo stesso template supporta sia una persona che modifica un singolo asset sia un team che produce molte varianti.

## Collaborazione e product design

[Figma Design](https://www.figma.com/design/) riunisce interface design, componenti, prototipi interattivi e handoff agli sviluppatori. Il suo flusso di product design consolidato e il suo ecosistema sono rilevanti quando un team deve progettare e specificare un'applicazione completa.

Lolly offre due tipi di collaborazione in tempo reale. Una [collab privata](/info/collaborate.html) collega direttamente due dispositivi, senza account e senza bisogno di internet su una rete condivisa. Una collab di lavoro usa lolly.work per l'accesso autenticato, le modifiche condivise, i cursori in tempo reale e le sessioni di team salvate. La collaborazione di lavoro è implementata sia nel client Lolly sia nel server lolly.work; la sua attuale distribuzione a nodo singolo non stabilisce una parità con la scala operativa di Figma.

## Distribuzione e produzione

Le app creative di Lolly e lolly.work sono parti distribuite separatamente dello stesso progetto open source. Lolly autonomo può eseguire il rendering offline senza un account. lolly.work fornisce SSO, SCIM, cataloghi condivisi, permessi di progetto, approvazioni, registri di audit e rendering lato server su un'infrastruttura controllata dall'organizzazione.

Le sessioni di team e le modifiche delle collab di lavoro raggiungono quell'istanza; i rendering locali possono restare sul dispositivo. Le Content Credentials sono facoltative per le esportazioni supportate, e la firma lato server usa un'identità dell'organizzazione configurata. Consulta la [panoramica della soluzione combinata](/info/compare.html) per la separazione e [Identità di Content Credentials](/info/content-credentials-identity.html) per come un verificatore si fida del firmatario.

Figma è un marchio del suo proprietario. Questa pagina descrive dove le due soluzioni si sovrappongono e non è affiliata a Figma.
