# Lolly e le API di rendering

_Ultima verifica: 28 settembre 2026._

Lolly genera asset da template e dati sul tuo dispositivo, in CI o tramite l'API lato server di [lolly.work](https://lolly.work). La soluzione combinata copre il rendering automatizzato oltre a identità, policy e consegna attorno ai job di produzione di un'organizzazione.

## Dove si sovrappongono

[Bannerbear](https://www.bannerbear.com/) e [Placid](https://placid.app/) generano immagini e altri contenuti multimediali da template tramite API e integrazioni. Lolly usa lo stesso approccio di template più input, con la [modalità URL](/info/url-mode.html), la [CLI](/info/cli.html), una griglia batch e endpoint lato server come modi per inviare il lavoro.

## Cosa offre lolly.work

lolly.work è il servizio per organizzazioni del progetto Lolly, distribuito separatamente. Esegue il motore di Lolly dietro un'API, applica visibilità degli strumenti e policy sugli input, e serve i file renderizzati e i link di condivisione firmati. Il suo [servizio di rendering recuperabile](https://github.com/lolly-tools/lolly-work/blob/main/docs/renders.md) supporta job singoli e batch, invio idempotente, stato, tentativi ripetuti limitati, annullamento e output conservati. Il lavoro interrotto può riprendere dopo il riavvio del server quando è configurata l'archiviazione persistente.

Il server usa un percorso di rendering SVG/PNG veloce e un worker Chromium opzionale per gli strumenti che richiedono un browser. L'automazione si autentica con token di servizio, e l'output completato può essere inviato tramite la [consegna governata](https://github.com/lolly-tools/lolly-work/blob/main/docs/delivery.md) alle destinazioni dell'organizzazione. Un'identità di firma configurata abilita la firma C2PA sugli output lato server supportati.

## Chi gestisce il servizio

Bannerbear e Placid propongono il rendering come servizi gestiti, con la propria infrastruttura e le proprie integrazioni. Con Lolly, un singolo utente può eseguire il rendering in locale oppure un team può gestire lolly.work sulla propria infrastruttura. Entrambi i repository di Lolly sono open source con licenza MPL-2.0; l'auto-hosting non ha costi di licenza software per rendering, mentre calcolo, archiviazione e operatività restano costi da pianificare.

Il sito pubblico lolly.work è una sandbox di valutazione, non un impegno di hosting in produzione. Un servizio duraturo richiede un database persistente e archiviazione degli output; gli strumenti che dipendono dal browser richiedono il worker Chromium. La [guida all'installazione](https://github.com/lolly-tools/lolly-work/blob/main/docs/install.md) e la [pagina di stato](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) descrivono questi requisiti e i limiti attuali.

Il rendering locale e in CI resta disponibile senza il servizio per organizzazioni. Inviare un job lato server manda i suoi input e gli asset necessari a quell'istanza; ciò è distinto dal percorso sul dispositivo. Consulta la [panoramica della soluzione combinata](/info/compare.html).

Bannerbear e Placid sono marchi dei rispettivi proprietari. Questa pagina descrive dove le soluzioni si sovrappongono e non è affiliata a nessuna delle due.
