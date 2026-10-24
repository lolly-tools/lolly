# Ask Lolly

Scrivi una domanda e Ask Lolly risponde con la sezione di queste guide che la tratta, parola per parola, con la pagina di provenienza citata e un link **Open in docs** diretto a quella sezione. Nulla viene generato: la risposta viene recuperata, citata e attribuita, sul tuo dispositivo.

Sotto la sezione citata compaiono i punti dell'app che corrispondono alla stessa domanda: uno strumento, un'utility, un progetto salvato, una risorsa del catalogo, un'impostazione o una pagina dell'app. Ogni riga serve solo a navigare. Nulla in una risposta cambia un'impostazione, apre un file o agisce al posto tuo, la stessa regola che segue [Search](/info/search.html).

## Fare una domanda

Scrivi nel campo della domanda in fondo alla vista e premi Invio. Tutto ciò che è più breve di due caratteri viene ignorato. Le risposte si accumulano sopra il campo, la più recente per ultima, e puoi continuare a chiedere.

![Ask Lolly, aperto e vuoto: il campo della domanda in fondo alla vista, con la nota che le risposte vengono dalla documentazione](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

Ogni domanda riceve risposta a sé: le domande precedenti non portano contesto in avanti, quindi "e per il PDF?" dopo una domanda sull'esportazione viene letto come una domanda sul PDF e nient'altro. Poni ogni volta la domanda per intero.

La prima parola della tua domanda decide cosa apre la risposta:

| Inizi con | Cosa apre |
|---|---|
| *dove*, *trova*, *apri*, *mostra*, *vai a*, *portami*, *salta*, *naviga*, *passa a* | i punti dell'app che corrispondono |
| *crea*, *genera*, *costruisci*, *disegna*, *converti*, *ridimensiona*, *comprimi*, *rimuovi*, *elimina*, *esporta*, *renderizza*, *aggiungi* | gli strumenti che corrispondono |
| qualsiasi altra cosa - compresi *come faccio* e *che cos'è* | la sezione della documentazione, che è l'impostazione predefinita |

Entrambe le metà vengono sempre recuperate, quindi una domanda letta male riordina una risposta invece di perderne metà.

La corrispondenza scarta le comuni parole interrogative (*come*, *faccio*, *io*, *il*, *mio*) e classifica una sezione in base a quante delle parole rimanenti copre, poi in base a dove sono state trovate: un titolo conta più del testo. La corrispondenza avviene per sottostringa, senza distinguere maiuscole e accenti, quindi un errore di battitura non viene corretto. Quando nulla corrisponde, Ask lo dice e rimanda all'indice della documentazione invece di inventare una risposta.

**Better matching** è facoltativo. Dopo la tua prima risposta, Ask può proporre un piccolo modello di corrispondenza, con la sua dimensione di download, che aiuta ad abbinare una domanda a una guida che usa parole diverse per la stessa cosa. Si scarica solo se accetti, gira su questo dispositivo e cambia soltanto quali sezioni si classificano per prime: la risposta resta fatta delle parole stesse della documentazione. Puoi scaricarlo anche da **Settings → Preferences → Available offline**, dove è elencato come **Ask matching model** ([Available offline](/info/dashboard.html#available-offline)).

## Cosa torna indietro

Una scheda di risposta viene assemblata in un ordine fisso:

1. **La sezione stessa**, resa dal sorgente della documentazione - paragrafi, elenchi, tabelle, codice e citazioni, con i link interni all'app e a `/info` attivi. Una sezione lunga è limitata da un **Show more** che la apre sul posto. Le immagini vengono scartate, e un link verso un altro sito viene reso come testo semplice anziché come ancora.
2. **La citazione** - *Pagina › Titolo* - e il link **Open in docs** a quella sezione esatta.
3. **More in the docs** - fino a quattro altre sezioni che corrispondevano, come link.
4. **Le righe dell'app**, sotto le stesse intestazioni di gruppo che usa Search.

Il testo completo viene dal gemello in Markdown semplice che ogni pagina della documentazione pubblica in `/info/<slug>.md`, e quei gemelli sono solo in inglese. In un'altra lingua - e nella manciata di pagine non costruite da markdown - la risposta ripiega sull'estratto breve contenuto nell'indice di ricerca invece che sull'intera sezione. La citazione e il link **Open in docs** ci sono comunque, e puntano alla pagina nella tua lingua.

## Dove si trova

La route è `#/ask`. Non ha scheda né riquadro nella griglia Utilities; si arriva dalla barra di ricerca e dall'indirizzo stesso.

- <!--i:search--> **Dalla ricerca.** Ogni pannello dei risultati porta in fondo una riga **Ask Lolly: *la tua query***, sotto gli eventuali risultati concreti trovati dagli altri gruppi. Passa la domanda come `#/ask?q=…`, e la vista pone la domanda una volta all'arrivo. Le parole passate arrivano in minuscolo e senza punteggiatura, quindi affinale nel campo della domanda se serve.
- <!--i:link--> **Da un link.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` apre la vista con quella domanda già posta. L'hash è solo il seme d'ingresso: le domande che digiti dopo ricevono risposta sul posto e non riscrivono mai l'indirizzo.

La barra di ricerca si fa da parte in questa vista, dato che il campo della domanda usa Invio, e la pillola indietro ti riporta da dove venivi.

Le risposte sullo schermo durano per questa sessione: restano se esci e torni, e un ricaricamento le cancella. Nulla viene scritto nell'archiviazione, quindi non c'è una cronologia da gestire.

## Offline

Le risposte sono assemblate a partire da due file statici che il sito della documentazione già pubblica: l'indice di ricerca per lingua e il gemello markdown della pagina. Entrambi vengono recuperati per nome, quindi Ask continua a funzionare senza connessione una volta che sono in cache. Leggere le guide nell'app li mette in cache man mano, e **Guides & docs** in [Available offline](/info/dashboard.html#available-offline) scarica l'intero sito, screenshot compresi, in un solo download.

Senza di essi la metà documentazione di una risposta semplicemente non compare, senza errori. Le righe dell'app compaiono comunque, perché vengono confrontate con dati già presenti sul dispositivo.

## Privacy

La tua domanda non lascia mai il dispositivo. La corrispondenza gira in locale su file recuperati per nome, quindi ciò che hai digitato non fa parte di nessuna richiesta; non c'è alcun server che la veda, nessun account a cui sia collegata e nessuna traccia dopo il ricaricamento. Vedi l'[Informativa sulla privacy](/info/privacy.html) per l'elenco completo di ciò che l'app scarica o invia.

---

**Correlati:** [Search](/info/search.html) per la barra che passa le domande. [Usare Lolly](/info/using.html) per il resto dell'app. [Settings](/info/dashboard.html#available-offline) per portare prima offline la documentazione.
