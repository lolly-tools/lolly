# Lolly e Penpot

_Ultima verifica: 28 settembre 2026._

Lolly e Penpot offrono entrambi strumenti di design open source, design token condivisi e collaborazione in tempo reale. Lolly combina la creazione sul dispositivo con [lolly.work](https://lolly.work), il suo servizio per organizzazioni distribuito separatamente.

## Basi di design condivise

I [design token di Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) usano il formato DTCG, che anche Lolly legge. Colori, tipografia e altri valori dei token possono essere condivisi tra i due flussi di lavoro. [Importa un design](/info/design-import.html) di Lolly apre un'esportazione `.penpot` come layout modificabile.

Il plugin Lolly Export per Penpot è mantenuto da Lolly. Usa il motore di Lolly per le C2PA Content Credentials opt-in sul dispositivo. Integrità della firma e fiducia nel firmatario sono cose distinte: un verificatore ha bisogno di un'identità di cui si fida, come descritto in [Identità di Content Credentials](/info/content-credentials-identity.html).

## Flussi di lavoro di design e di team

[Penpot](https://penpot.app/) offre interface design, componenti, layout flessibili, prototipi interattivi e ispezione per sviluppatori. Propone distribuzioni ospitate e self-hosted, con [opzioni di installazione Docker e Kubernetes](https://help.penpot.app/technical-guide/getting-started/).

La tela Design di Lolly crea asset modificabili e può trasformare un layout in uno [strumento con regole](/info/create-a-tool.html). Lo stesso strumento esegue il rendering nel browser, nell'app desktop o nella CLI e può generare varianti a partire da dati. Per il lavoro di squadra, Lolly offre sia [collab private](/info/collaborate.html) dirette tra due dispositivi sia collab di lavoro tramite lolly.work, con modifiche condivise, cursori e sessioni di team salvate.

## Come differiscono le distribuzioni

Lolly autonomo esegue rendering e firma sul dispositivo, senza account né server. lolly.work aggiunge SSO, provisioning SCIM, cataloghi e progetti condivisi, ruoli, approvazioni, registri di audit e rendering lato server. Entrambi i repository sono open source con licenza MPL-2.0 e possono essere gestiti dall'organizzazione. Il lavoro condiviso usa l'istanza configurata; la creazione locale resta disponibile in modo indipendente.

La scelta dipende dal lavoro: il flusso di interface design e prototipazione di Penpot, la produzione ripetibile di asset di Lolly, o una combinazione che usa token condivisi e design importati. La collaborazione di lavoro di Lolly gira attualmente su un singolo nodo server, e il suo [stato di distribuzione](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) dovrebbe far parte della valutazione di un'organizzazione.

Penpot è un marchio del suo proprietario. Il plugin sopra citato è di Lolly. Consulta [Come si confronta Lolly](/info/positioning.html) e la [panoramica della soluzione combinata](/info/compare.html) per il confronto più ampio.
