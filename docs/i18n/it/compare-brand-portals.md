# Lolly e i portali di brand

_Ultima verifica: 28 settembre 2026._

Se la tua organizzazione conserva le risorse approvate in Bynder, Frontify, Marq o Brandfolder, questa pagina confronta ciò con Lolly più Lolly Work: come le persone trovano le risorse del brand e come ne ricavano nuovi file.

## Cosa fa meglio un portale consolidato

I portali consolidati offrono hosting gestito, assistenza e ampi flussi di gestione delle risorse. Per esempio, il [DAM enterprise di Frontify](https://www.frontify.com/en/solution/enterprise-digital-asset-management) combina ricerca delle risorse, controlli di accesso, flussi di approvazione e distribuzione. Lo stack di Lolly è più giovane e le sue catene di approvazione sono sequenziali, non flussi di lavoro con ramificazioni arbitrarie. [Work status and roadmap](/info/work-status.html) registra i suoi limiti di installazione.

## Dove si sovrappongono

Entrambi coprono risorse approvate, template bloccati, controllo degli accessi, revisione e distribuzione. Lolly crea i file: template, design token e input consentiti definiscono cosa qualcuno può cambiare, e il rendering può restare sul suo dispositivo. Lolly Work aggiunge identità, archiviazione condivisa, policy, approvazioni e reportistica su un'infrastruttura che l'organizzazione controlla.

![Il design system attivo in Settings, mostrato come copertina e pagine: i colori, la tipografia e i loghi con cui disegna ogni strumento](/info/shots/dashboard-brand.svg)

## Cosa offrono Lolly e Lolly Work

| Esigenza | Lolly + Lolly Work |
|---|---|
| Accesso e provisioning | Single sign-on OIDC, più provider di identità, provisioning utenti SCIM 2.0 e appartenenza ai gruppi, e disattivazione degli account che revoca le sessioni esistenti. Un provider di identità solo SAML può collegarsi tramite un bridge OIDC come Keycloak. |
| Template approvati | Lolly definisce gli input modificabili del template; Lolly Work applica visibilità per gruppo e policy sugli input che bloccano valori, limitano le scelte o nascondono controlli. |
| Libreria di risorse condivisa | Caricamenti di proprietà dell'istanza, raccolte, metadati personalizzati e cataloghi con controllo degli accessi, più connettori che leggono librerie DAM e di archiviazione esistenti. |
| Revisione | Passaggi di approvazione ordinati, gruppi di approvatori idonei, regole di quorum e separazione dei compiti; la revisione può governare i contributi al catalogo e la consegna alle destinazioni dell'organizzazione. |
| Cronologia e disponibilità delle risorse | Versioni e rollback per le risorse di proprietà dell'istanza, conservazione e blocchi, disponibilità programmata, scadenza e revoca. I provider collegati mantengono la propria cronologia di origine. |
| Licenze e crediti | Lolly registra la licenza di ogni fonte che un file usa e prepara i crediti dovuti; [Creative rights and credits](/info/creative-rights.html) spiega cosa registra e dove vengono scritti i crediti. Non libera i diritti. |
| Reportistica | Conteggi di uso e download delle risorse, attività di strumenti ed esportazioni, dashboard e un audit trail. L'attribuzione dell'uso segue la policy di telemetria dell'installazione; l'impostazione di attribuzione predefinita richiede il consenso. |
| Distribuzione | Link con scadenza e revocabili, raccolte condivise, accesso per ospiti e consegna a destinazioni configurate dell'organizzazione. |

[Catalog and content](/info/work-catalog.html), [Approvals](/info/work-approvals.html) e [Policy and governance](/info/work-governance.html) descrivono queste funzioni e la loro configurazione.

## Tenere il tuo portale esistente

Un DAM esistente può restare la fonte di verità. I connettori di catalogo di Lolly Work rendono le sue risorse approvate disponibili in Lolly, dove le persone creano nuovi file secondo le regole dell'organizzazione. È una scelta di integrazione; la libreria e le approvazioni proprie di Lolly ci sono quando l'organizzazione vuole gestirle da sé. [What runs where](/info/compare.html#what-runs-where) elenca i limiti che ogni confronto condivide.

Vedi [How Lolly compares](/info/positioning.html) per il confronto delle capacità. I nomi dei fornitori identificano i prodotti confrontati; Lolly non è affiliata ad essi.
