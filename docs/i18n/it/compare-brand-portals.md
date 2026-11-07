# Lolly e i portali di brand

_Posizionamento aggiornato: 31 ottobre 2026. Esempio di funzionalità di un fornitore verificato: 28 settembre 2026._

Se la tua organizzazione conserva le risorse approvate in Bynder, Frontify, Marq o Brandfolder, questa pagina confronta ciò con Lolly più Lolly Work: come le persone trovano le risorse del brand e come ne ricavano nuovi file.

## Tenere il tuo portale esistente

Un DAM esistente può restare la fonte di riferimento. I connettori di catalogo di Lolly Work rendono disponibile in Lolly una parte selezionata della sua libreria, dove le persone creano nuovi file secondo le regole dell'organizzazione. I vincoli di origine supportati dal DAM e le regole di esposizione di Lolly Work governano l'accesso; la revisione dell'output finale è una decisione separata.

[Use Lolly with your existing DAM](/info/use-with-dam.html) spiega responsabilità e limiti. [SUSE's Brandfolder experience](/info/suse-brandfolder.html) registra un'integrazione riuscita che ha sostenuto la gestione del cambiamento per gli amministratori prima di una migrazione pianificata. Mantenere la fonte collegata resta una scelta supportata.

Lo scopo di Lolly è la [sovranità sui contenuti](/info/content-sovereignty.html), incluso il controllo sulla produzione e la libertà di scegliere i sistemi. La sua libreria e le sue approvazioni sostengono le organizzazioni che scelgono di gestire da sé queste funzionalità. [Lolly for DAM vendors and implementation partners](/info/dam-partners.html) descrive come il flusso collegato possa aggiungere valore a un sistema di riferimento esistente.

## Cosa fa meglio un portale consolidato

I portali consolidati offrono hosting gestito, assistenza e ampi flussi di gestione delle risorse. Per esempio, il [DAM enterprise di Frontify](https://www.frontify.com/en/solution/enterprise-digital-asset-management) combina ricerca delle risorse, controlli di accesso, flussi di approvazione e distribuzione. Lo stack di Lolly è più giovane e le sue catene di approvazione sono sequenziali, non flussi di lavoro con ramificazioni arbitrarie. [Lolly Work status and roadmap](/info/work-status.html) registra i suoi limiti di installazione.

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
| Una pagina del brand pubblica | Lolly scrive una [pagina del brand](/info/brand-page.html) statica, da Lolly Design System Setup o dalla riga di comando: loghi, colori, tipografia, regole ed esempi per le persone, con token, `DESIGN.md` e skill per gli agenti. La cartella la ospiti tu, oppure un amministratore attiva l'[hosting della pagina del brand](/info/work-design-system-administration.html#host-a-brand-page) in Lolly Work, disattivato per impostazione predefinita. |

[Catalog and content](/info/work-catalog.html), [Approvals](/info/work-approvals.html) e [Policy and governance](/info/work-governance.html) descrivono queste funzioni e la loro configurazione.

## Valutare il flusso combinato

Usa [la sequenza di produzione della scheda evento](/info/dam-production.html) per verificare con la tua libreria l'accesso alle fonti, le modifiche consentite, la revisione dell'output e la consegna. [What runs where](/info/compare.html#what-runs-where) elenca i limiti che ogni confronto condivide. Un collegamento a una fonte non stabilisce di per sé una partnership con il fornitore né una qualifica per ogni tenant.

Vedi [How Lolly compares](/info/positioning.html) per il confronto delle capacità. I nomi dei fornitori identificano i prodotti confrontati; Lolly non è affiliata ad essi.
