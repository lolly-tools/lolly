# Lolly e i portali di brand

_Ultima verifica: 28 settembre 2026._

Lolly e [lolly.work](https://lolly.work) insieme coprono i flussi di creazione e governance per cui i team usano i portali di brand: asset approvati, template bloccati, controllo degli accessi, revisione e distribuzione. Confronta questa soluzione combinata con Bynder, Frontify, Marq o Brandfolder quando scegli come le persone trovano gli asset di brand e ne creano di nuovi.

## Creazione e servizi per l'organizzazione

Il motore e le app di Lolly producono i file. Template, design token e input consentiti definiscono cosa una persona può modificare, e il rendering può restare sul suo dispositivo. Lolly autonomo non richiede un account.

lolly.work è il servizio per organizzazioni dello stesso progetto, mantenuto in un [repository separato](https://github.com/lolly-tools/lolly-work) e distribuito insieme a Lolly. Aggiunge identità, archiviazione condivisa, policy, approvazioni e reportistica. Entrambe le parti sono open source con licenza MPL-2.0. La separazione permette a un singolo utente di usare Lolly in modo indipendente e a un'organizzazione di eseguire la soluzione combinata su un'infrastruttura che controlla.

## Cosa offre la soluzione combinata

| Esigenza | Lolly + lolly.work |
|---|---|
| Accesso e provisioning | Single sign-on OIDC, più provider di identità, provisioning utenti e appartenenza ai gruppi SCIM 2.0, e disattivazione degli account che revoca le sessioni esistenti. Un provider di identità solo SAML può collegarsi tramite un bridge OIDC come Keycloak. |
| Template approvati | Lolly definisce gli input modificabili del template; lolly.work applica visibilità per gruppo e policy sugli input che bloccano i valori, limitano le scelte o nascondono i controlli. |
| Libreria di asset condivisa | Caricamenti di proprietà dell'istanza, raccolte, metadati personalizzati e cataloghi con controllo degli accessi, oltre a connettori che leggono le librerie DAM e di archiviazione esistenti. |
| Revisione | Passaggi di approvazione ordinati, gruppi di approvatori idonei, regole di quorum e separazione dei compiti; la revisione può governare le proposte di catalogo e la consegna alle destinazioni dell'organizzazione. |
| Cronologia e disponibilità degli asset | Versioni e rollback per gli asset di proprietà dell'istanza, conservazione e blocchi, disponibilità programmata, scadenza e revoca. I provider collegati mantengono la propria cronologia di origine. |
| Reportistica | Conteggi di utilizzo e download degli asset, attività di strumenti ed esportazioni, dashboard e un audit trail. L'attribuzione dell'utilizzo segue la policy di telemetria della distribuzione; l'impostazione di attribuzione predefinita richiede il consenso. |
| Distribuzione | Link con scadenza e revocabili, raccolte condivise, accesso ospite e consegna a destinazioni dell'organizzazione configurate. |

Le [guide per operatori di lolly.work](https://github.com/lolly-tools/lolly-work/tree/main/docs) descrivono queste funzionalità e la loro configurazione. Sono capacità disponibili, non funzionalità che richiedono di costruire un altro sistema attorno a Lolly.

## Scegliere un flusso di lavoro da portale

I portali consolidati offrono hosting gestito, assistenza e flussi DAM estesi. Per esempio, il [DAM enterprise di Frontify](https://www.frontify.com/en/solution/enterprise-digital-asset-management) combina scoperta degli asset, controlli di accesso, flussi di approvazione e distribuzione. Confronta l'esatto flusso di revisione e dei diritti di cui hai bisogno: Lolly fornisce controlli su metadati, accesso e disponibilità, mentre l'autorizzazione legale e gli obblighi di licenza richiedono comunque il processo di un'organizzazione. Le sue catene di approvazione sono sequenziali; non modellano flussi di lavoro con ramificazioni arbitrarie.

Lo stack di Lolly è più recente, e la [pagina di stato di lolly.work](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) registra i suoi limiti di distribuzione. In particolare, il sito pubblico lolly.work è una sandbox di valutazione. Una distribuzione duratura per un'organizzazione richiede archiviazione persistente e un operatore. Non c'è alcun costo di licenza software per utente per l'auto-hosting; infrastruttura e amministrazione hanno comunque un costo.

Un DAM esistente può anche restare la fonte di verità. I connettori di catalogo di lolly.work rendono i suoi asset approvati disponibili in Lolly, dove le persone creano nuovi file secondo le regole dell'organizzazione. È una scelta di integrazione; la libreria e le approvazioni di Lolly sono disponibili quando l'organizzazione vuole gestire quei flussi in autonomia.

Consulta [Come si confronta Lolly](/info/positioning.html) per il confronto delle capacità e [Lolly a confronto, strumento per strumento](/info/compare.html) per il resto di questa serie. I nomi dei fornitori identificano i prodotti confrontati; Lolly non è affiliata ad essi.
