# Lolly e Adobe

_Ultima verifica: 28 settembre 2026._

Lolly gestisce modifica e conversione di immagini, impaginazione, produzione di brand ripetibile, output di stampa e Content Credentials. [lolly.work](https://lolly.work) aggiunge a quel flusso creativo identità dell'organizzazione, asset condivisi, approvazioni e produzione automatizzata lato server.

## Dove si sovrappongono

Entrambi supportano attività come ridimensionare immagini, comporre layout ed esportare formati professionali. Lolly supporta output PDF/X, CMYK e raster ad alta profondità di bit, con [funzionalità specifiche per formato](/info/formats.html). Le sue utilità sul dispositivo convertono e puliscono i file senza caricarli.

Le applicazioni specialistiche di Adobe coprono flussi creativi estesi. [Photoshop](https://www.adobe.com/products/photoshop.html), per esempio, offre strumenti dettagliati di fotoritocco, selezione, mascheratura e compositing. Confronta le operazioni di modifica richieste dal tuo lavoro con gli strumenti di Lolly; un asset di brand ricorrente e un ritocco complesso possono avere requisiti diversi.

## Creazione e servizi per l'organizzazione

Lolly autonomo funziona senza un account Adobe né un account Lolly, usando lo stesso motore nel browser, nell'app desktop e nella CLI. Template e design token rendono gli output ripetibili, e [Condividi con regole](/info/create-a-tool.html) trasforma un design in uno strumento che altre persone possono compilare.

lolly.work è un servizio separato all'interno del progetto Lolly, open source con licenza MPL-2.0 come le app creative. Fornisce SSO, SCIM, cataloghi e progetti condivisi, approvazioni, policy di accesso, registri di audit e rendering lato server. Un'organizzazione può eseguire entrambe le parti in proprio e collegare le librerie di asset esistenti. La creazione locale resta sul dispositivo; il lavoro condiviso e i job lato server usano i servizi configurati.

## Content Credentials e identità

Lolly può firmare sul dispositivo le esportazioni supportate, con Content Credentials abilitate dall'utente. Una chiave generata dal dispositivo dimostra l'integrità della firma del file; un verificatore deve comunque fidarsi del firmatario prima di mostrare un'identità verificata. Un'organizzazione può usare una propria autorità di certificazione e distribuirne la radice ai propri verificatori. lolly.work supporta anche la firma lato server con un certificato e una chiave dell'organizzazione configurati.

Così sia la firma personale sia la firma organizzativa sono disponibili all'interno della soluzione Lolly. Consulta [Identità di Content Credentials](/info/content-credentials-identity.html), la [guida alla firma di lolly.work](https://github.com/lolly-tools/lolly-work/blob/main/docs/c2pa.md) e la [panoramica della soluzione combinata](/info/compare.html). Le utilità di trasformazione sul dispositivo non aggiungono filigrane Lolly né metadati di provenienza.

Adobe, Photoshop e Creative Cloud sono marchi di Adobe. Questa pagina descrive dove le soluzioni si sovrappongono e non è affiliata ad Adobe.
