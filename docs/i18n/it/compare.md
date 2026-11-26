# Lolly a confronto, strumento per strumento

Queste pagine spiegano se Lolly sostituisce un altro prodotto, lo affianca o non è adatto al tuo lavoro. Ogni pagina inizia da ciò che l'altro prodotto fa meglio.

_Ultima verifica: 28 settembre 2026._

<!--i:eti-grid-->
## Confronta per prodotto

- [Lolly e Canva](/info/compare-canva.html) - template, design quotidiano e produzione condivisa per il brand.
- [Lolly e Adobe](/info/compare-adobe.html) - modifica, conversione, output professionale e Content Credentials.
- [Lolly e Figma](/info/compare-figma.html) - design, collaborazione live e produzione di risorse riutilizzabili.
- [Lolly e Penpot](/info/compare-penpot.html) - design open source, token condivisi e lavoro dell'organizzazione.
- [Lolly e i portali del brand](/info/compare-brand-portals.html) - librerie approvate, template bloccati, identità, revisione e reportistica.
- [Lolly e le API di rendering](/info/compare-render-apis.html) - generazione automatizzata sul tuo dispositivo, in CI o sul tuo server e [come migrare](/info/work-move-from-render-api.html) da Bannerbear o Placid.
- [Lolly e i convertitori di file online](/info/compare-converters.html) - conversione di formati sul tuo dispositivo.

[Lolly a confronto](/info/positioning.html) offre una vista funzionalità per funzionalità. Ogni confronto è datato. Un'affermazione che non corrisponde più a uno dei due prodotti va corretta.

<!--i:eti-map-pin-->
## Cosa viene eseguito e dove

Ogni confronto riguarda due parti di un unico progetto open source. **Lolly** è il motore, le app e gli strumenti. **Lolly Work** è il server dell'organizzazione, mantenuto nel [repository lolly-work](https://github.com/lolly-tools/lolly-work). Entrambi sono MPL-2.0 e l'organizzazione decide quali servizi di Lolly Work attivare.

::: cols
## Sul tuo dispositivo: Lolly

- Nessun account per l'uso autonomo
- Creazione, modifica, conversione ed esportazione
- Funziona offline una volta salvati gli strumenti e le risorse necessari
- Content Credentials firmate sul dispositivo
- Collaborazioni private tra due dispositivi, senza server

## Sul server della tua organizzazione: Lolly Work

- Single sign-on, provisioning SCIM, ruoli e policy
- Cataloghi condivisi, progetti di team e collaborazioni di lavoro
- Approvazioni, report sull'utilizzo e record di audit
- Rendering sul server, job recuperabili e consegna approvata
- Firma sul server con l'identità dell'organizzazione
:::

L'uso autonomo mantiene i file sul dispositivo. Scegliere progetti condivisi, una collaborazione di lavoro, un rendering sul server o una consegna invia al server della tua organizzazione i dati necessari a quella funzione.

<!--i:eti-info-->
## I presupposti di ogni confronto

Questi limiti si applicano a ogni pagina di questa serie:

- **Le collaborazioni di Lolly Work oggi funzionano su un unico nodo server.** La loro scala e la loro storia operativa differiscono da quelle dei prodotti ospitati consolidati da tempo. [Stato e roadmap di Lolly Work](/info/work-status.html) riporta i limiti attuali.
- **Il sito [lolly.work](https://lolly.work) è un ambiente di prova dimostrativo.** Un'installazione duratura per un'organizzazione richiede archiviazione persistente e un operatore. [Installare Lolly Work](/info/work-install.html) tratta entrambi gli aspetti.
- **Non c'è alcun costo di licenza software per utente** per Lolly o per un'istanza di Lolly Work ospitata autonomamente. Hosting, archiviazione e gestione hanno comunque un costo.
- **Una firma non equivale a un firmatario attendibile.** Uno strumento di verifica mostra il firmatario come attendibile solo quando considera attendibile il certificato che ha firmato il file. [Identità di Content Credentials](/info/content-credentials-identity.html) spiega come.
