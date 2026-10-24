# Lolly e le API di rendering

_Ultima verifica: 28 settembre 2026._

Se oggi generi immagini da template tramite un'API, questa pagina dice come Lolly svolge lo stesso compito sul tuo dispositivo, in CI o sul tuo server.

## Cosa fanno meglio le API di rendering ospitate

[Bannerbear](https://www.bannerbear.com/) e [Placid](https://placid.app/) confezionano il rendering come servizi gestiti, con infrastruttura, integrazioni e assistenza proprie. Invii una richiesta e i server li gestisce qualcun altro.

## Dove si sovrappongono

Entrambi trasformano un template più degli input in media. Lolly prende gli input da un [link](/info/url-mode.html), dalla [CLI](/info/cli.html), da una griglia batch o da un endpoint del server.

## Come Lolly svolge il compito in comune

Lo stesso strumento esegue il rendering su un portatile, in un job di CI o su un server, dagli stessi input. Il rendering locale e in CI non richiede alcun servizio.

![Impostazioni di esportazione Batch: nome del file, formato predefinito, unità, DPI e numero di righe da renderizzare](/info/shots/use-batch-toolbar.svg)

Su un server, [Lolly Work](/info/compare.html#what-runs-where) esegue l'engine di Lolly dietro un'API e applica visibilità degli strumenti e policy sugli input. Il suo [servizio di rendering recuperabile](/info/work-renders.html) supporta lavori singoli e batch, invio idempotente, stato, tentativi limitati, annullamento e output conservati, e il lavoro interrotto riprende dopo un riavvio quando è configurata l'archiviazione persistente.

Il server ha un percorso rapido per SVG e PNG e un worker Chromium facoltativo per gli strumenti che richiedono un browser. L'automazione accede con token di servizio, l'output finito può passare per la [consegna approvata](/info/work-delivery.html) verso destinazioni dell'organizzazione, e un'identità di firma configurata aggiunge Content Credentials all'output supportato.

## Chi gestisce il servizio

Con Lolly, una persona esegue il rendering in locale, oppure un team usa Lolly Work sulla propria infrastruttura. Inviare un lavoro al server manda i suoi input e le risorse necessarie a quell'istanza, il che è diverso dal percorso sul dispositivo. Un servizio durevole richiede un database persistente e archiviazione dell'output, e gli strumenti che dipendono dal browser richiedono il worker Chromium; [Install Lolly Work](/info/work-install.html) descrive entrambi.

Bannerbear e Placid sono marchi dei rispettivi titolari. Questa pagina descrive dove i prodotti si sovrappongono e non è affiliata a nessuno dei due.
