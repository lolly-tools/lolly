# Ask Lolly

Ask Lolly risponde a una domanda con la sezione corrispondente di queste guide, citata parola per parola, con il riferimento alla pagina e un link **Open in docs** a quella sezione. Non viene generato nulla: la risposta viene trovata e citata sul tuo dispositivo.

Sotto la sezione citata ci sono i punti dell'app che corrispondono alla domanda: uno strumento, un'utility, un progetto salvato, una risorsa del catalogo, un'impostazione o una pagina dell'app. Ogni riga serve solo a navigare. Nulla in una risposta cambia un'impostazione, apre un file o agisce per te, la stessa regola di [Lolly Search](/info/search.html).

<!--i:eti-chat-->
## Fare una domanda

Digita nel campo della domanda in fondo alla vista e premi Enter. Tutto ciò che è più breve di due caratteri viene ignorato. Le risposte si impilano sopra il campo, con la più recente in fondo.

![Ask Lolly, aperto e vuoto: il campo della domanda in fondo alla vista, con la nota che le risposte provengono dalla documentazione](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

::: note Ogni domanda è indipendente
Le domande precedenti non trasmettono alcun contesto, quindi "e il PDF?" dopo una domanda sull'esportazione viene letto come una domanda solo sul PDF. Formula ogni volta la domanda completa.
:::

La prima parola della tua domanda decide cosa compare per primo nella risposta:

| Inizi con | Cosa compare per primo |
|---|---|
| *dove*, *trova*, *apri*, *mostra*, *vai a*, *vai*, *porta*, *salta*, *naviga*, *passa* | i punti dell'app che corrispondono |
| *fai*, *crea*, *genera*, *costruisci*, *progetta*, *converti*, *ridimensiona*, *comprimi*, *rimuovi*, *elimina*, *esporta*, *renderizza*, *aggiungi* | gli strumenti che corrispondono |
| qualsiasi altra cosa - compresi *come faccio a* e *che cos'è* | la sezione della documentazione, che è l'opzione predefinita |

Entrambe le parti vengono sempre recuperate, quindi una domanda interpretata male cambia solo l'ordine della risposta.

La ricerca di corrispondenze scarta le parole comuni nelle domande (*come*, *faccio*, *io*, *il*, *mio*). Ordina le sezioni in base a quante delle altre parole coprono, poi in base a dove si trovano le corrispondenze: un titolo conta più del corpo del testo. La corrispondenza avviene per sottostringa, ignorando maiuscole e accenti, quindi un errore di battitura non viene corretto. Quando non trova corrispondenze, Ask lo dice e rimanda all'indice della documentazione.

**Better matching** è facoltativo. Dopo la prima risposta, Ask può proporre un piccolo modello per la ricerca di corrispondenze, indicando la dimensione del download. Il modello associa una domanda a una guida che usa parole diverse per la stessa cosa. Viene scaricato solo quando acconsenti, funziona su questo dispositivo e cambia solo quali sezioni compaiono per prime. La risposta usa comunque le parole della documentazione. Puoi scaricarlo anche come **Ask matching model** in **Settings → Preferences → Available offline** ([Available offline](/info/dashboard.html#available-offline)).

<!--i:eti-clipboard-->
## Cosa ricevi

Una card di risposta ha un ordine fisso:

1. **La sezione stessa**, renderizzata dalla sorgente della documentazione: paragrafi, elenchi, tabelle, codice e citazioni, con link interni all'app e a `/info` attivi. Una sezione lunga termina con **Show more**, che apre il resto sul posto. Le immagini vengono omesse e un link a un altro sito compare come testo semplice.
2. **La citazione** - *Pagina › Titolo* - e il link **Open in docs** a quella precisa sezione.
3. **More in the docs** - fino a quattro altre sezioni corrispondenti, come link.
4. **Le righe interne all'app**, sotto le stesse intestazioni di gruppo usate da Search.

Il testo completo proviene dalla copia markdown che ogni pagina della documentazione pubblica in `/info/<slug>.md`. Queste copie sono solo in inglese. In un'altra lingua, e nelle poche pagine non create da markdown, la risposta mostra invece il breve estratto dell'indice di ricerca. La citazione e il link **Open in docs** rimandano comunque alla pagina nella tua lingua.

<!--i:eti-map-pin-->
## Dove si trova

Il percorso è `#/ask`. Non ha una scheda né un riquadro nella griglia Utilities. Raggiungi la vista dalla barra di ricerca o dal suo indirizzo.

- <!--i:search--> **Dalla ricerca.** Ogni pannello dei risultati termina con una riga **Ask Lolly: *la tua ricerca***, sotto i risultati degli altri gruppi. La riga apre `#/ask?q=…` e la vista pone la domanda una volta all'apertura. Le parole arrivano in minuscolo e senza punteggiatura, quindi perfezionale nel campo della domanda se necessario.
- <!--i:link--> **Da un link.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` apre la vista con quella domanda già posta. Il frammento dopo il cancelletto imposta solo la prima domanda. Le domande che digiti in seguito ricevono risposta sul posto e non cambiano mai l'indirizzo.

La barra di ricerca si nasconde in questa vista perché il campo della domanda usa Enter. La pillola per tornare indietro ti riporta da dove sei arrivato.

Le risposte restano per questa sessione: sono ancora lì se esci e torni, e ricaricare le cancella. Non viene scritto nulla nell'archiviazione, quindi non c'è una cronologia da gestire.

<!--i:eti-download-->
## Offline

Le risposte provengono da due file statici pubblicati dal sito della documentazione: l'indice di ricerca per lingua e la copia markdown della pagina. Entrambi vengono recuperati per nome, quindi Ask funziona senza connessione una volta che sono nella cache. Leggere le guide nell'app le salva nella cache. **Guides & docs** in [Available offline](/info/dashboard.html#available-offline) scarica l'intero sito, screenshot inclusi, in un solo download.

Senza questi file la parte della risposta tratta dalla documentazione non compare e non viene mostrato alcun errore. Le righe interne all'app compaiono comunque, perché cercano corrispondenze nei dati già presenti sul dispositivo.

<!--i:eti-lock-->
## Privacy

La tua domanda non lascia mai il dispositivo. La ricerca di corrispondenze avviene localmente su file recuperati per nome, quindi ciò che hai digitato non fa parte di alcuna richiesta. Nessun server vede la tua domanda, nessun account la conserva e non resta alcuna registrazione dopo che ricarichi. L'[Informativa sulla privacy](/info/privacy.html) elenca tutto ciò che l'app recupera o invia.

---

**Pagine correlate:** [Lolly Search](/info/search.html) per la barra che inoltra le domande. [Usare Lolly](/info/using.html) per il resto dell'app. [Impostazioni di Lolly](/info/dashboard.html#available-offline) per rendere prima disponibile offline la documentazione.
