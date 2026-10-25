# Ask Lolly

Tastează o întrebare și Ask Lolly răspunde cu secțiunea acestor ghiduri care o acoperă, cuvânt cu cuvânt, cu pagina din care provine citată și un link **Open in docs** direct la acea secțiune. Nu se generează nimic: răspunsul este regăsit, citat și atribuit, pe dispozitivul tău.

Sub secțiunea citată stau locurile din aplicație care se potrivesc cu aceeași întrebare: un instrument, un utilitar, un proiect salvat, o resursă din catalog, o setare sau o pagină a aplicației. Fiecare rând doar navighează. Nimic dintr-un răspuns nu schimbă o setare, nu deschide un fișier și nu acționează în locul tău, aceeași regulă pe care o urmează [Căutarea](/info/search.html).

## Punerea unei întrebări

Tastează în câmpul de întrebare de la baza vederii și apasă Enter. Orice mai scurt de două caractere este ignorat. Răspunsurile se stivuiesc deasupra câmpului, cel mai nou ultimul, și poți continua să întrebi.

![Ask Lolly, deschis și gol: câmpul de întrebare la baza vederii, cu nota că răspunsurile vin din documentație](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

Fiecare întrebare primește răspuns separat: întrebările anterioare nu duc niciun context mai departe, deci „și PDF?” după o întrebare despre export este citit ca o întrebare despre PDF și nimic altceva. Pune întrebarea întreagă de fiecare dată.

Primul cuvânt al întrebării decide ce conduce răspunsul:

| Începi cu | Ce conduce |
|---|---|
| *where*, *find*, *open*, *show*, *go to*, *goto*, *take*, *jump*, *navigate*, *switch* | locurile din aplicație care se potrivesc |
| *make*, *create*, *generate*, *build*, *design*, *convert*, *resize*, *compress*, *remove*, *strip*, *export*, *render*, *add* | instrumentele care se potrivesc |
| orice altceva - inclusiv *how do I* și *what is* | secțiunea de documentație, care este valoarea implicită |

Ambele jumătăți sunt mereu regăsite, deci o întrebare înțeleasă greșit reordonează un răspuns, în loc să piardă jumătate din el.

Potrivirea elimină cuvintele obișnuite de întrebare (*how*, *do*, *I*, *the*, *my*) și ordonează o secțiune după câte dintre cuvintele tale rămase le acoperă, apoi după locul unde s-au potrivit: un titlu contează mai mult decât textul de corp. Potrivirea se face pe subșir, ignorând majusculele și diacriticele, deci o greșeală de tastare nu este corectată. Când nu se potrivește nimic, Ask spune asta și te trimite la indexul documentației, în loc să inventeze un răspuns.

**Better matching** este opțional. După primul tău răspuns, Ask poate oferi un mic model de potrivire, cu dimensiunea descărcării, care ajută la potrivirea unei întrebări cu un ghid ce folosește alte cuvinte pentru același lucru. Se descarcă doar când ești de acord, rulează pe acest dispozitiv și schimbă doar ce secțiuni sunt primele: răspunsul rămâne cuvintele proprii ale documentației. Îl poți descărca și din **Settings → Preferences → Available offline**, unde este listat ca **Ask matching model** ([Disponibil offline](/info/dashboard.html#available-offline)).

## Ce se întoarce

Un card de răspuns este asamblat într-o ordine fixă:

1. **Secțiunea însăși**, randată din sursa documentației - paragrafe, liste, tabele, cod și citate, cu linkurile din aplicație și `/info` funcționale. O secțiune lungă este plafonată cu un **Show more** care o deschide pe loc. Imaginile sunt omise, iar un link către alt site se randează ca text simplu, nu ca ancoră.
2. **Citarea** - *Pagină › Titlu* - și linkul **Open in docs** către exact acea secțiune.
3. **More in the docs** - până la patru alte secțiuni potrivite, ca linkuri.
4. **Rândurile din aplicație**, sub aceleași titluri de grup pe care le folosește Search.

Textul complet vine din gemenul în markdown simplu pe care îl publică fiecare pagină de documentație la `/info/<slug>.md`, iar acești gemeni sunt doar în engleză. Într-o altă limbă - și pe puținele pagini care nu sunt construite din markdown - răspunsul revine la scurtul extras păstrat în indexul de căutare, în loc de secțiunea întreagă. Citarea și linkul **Open in docs** sunt acolo oricum și indică pagina în limba ta.

## Unde se află

Ruta este `#/ask`. Nu are filă și nici tilă în grila Utilities; căile de intrare sunt bara de căutare și adresa însăși.

- <!--i:search--> **Din căutare.** Fiecare panou de rezultate poartă un rând **Ask Lolly: *interogarea ta*** chiar la bază, sub orice rezultate concrete găsite de celelalte grupuri. Predă întrebarea ca `#/ask?q=…`, iar vederea pune întrebarea o dată la sosire. Cuvintele predate sosesc cu litere mici și fără punctuație, deci rafinează-le în câmpul de întrebare dacă e nevoie.
- <!--i:link--> **Dintr-un link.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` deschide vederea cu acea întrebare deja pusă. Hash-ul este doar sămânța de intrare: întrebările tastate după aceea primesc răspuns pe loc și nu rescriu niciodată adresa.

Bara de căutare face loc în această vedere, deoarece câmpul de întrebare preia Enter, iar pastila de înapoi te readuce de unde ai venit.

Răspunsurile de pe ecran durează cât această sesiune: sunt tot acolo dacă navighezi în altă parte și te întorci, iar o reîncărcare le șterge. Nu se scrie nimic în stocare, deci nu ai istoric de gestionat.

## Offline

Răspunsurile sunt asamblate din două fișiere statice pe care site-ul de documentație le publică deja: indexul de căutare pe limbă și gemenul în markdown al paginii. Ambele sunt preluate după nume, deci Ask continuă să funcționeze fără conexiune odată ce sunt în cache. Citirea ghidurilor în aplicație le pune în cache pe parcurs, iar **Guides & docs** de la [Available offline](/info/dashboard.html#available-offline) ia tot site-ul, cu capturi de ecran cu tot, într-o singură descărcare.

Fără ele, jumătatea de documentație a unui răspuns pur și simplu nu apare, fără eroare. Rândurile din aplicație apar în continuare, pentru că sunt potrivite cu date aflate deja pe dispozitiv.

## Confidențialitate

Întrebarea ta nu părăsește niciodată dispozitivul. Potrivirea rulează local pe fișiere preluate după nume, deci ce ai tastat nu face parte din nicio cerere; nu există server care să o vadă, cont de care să fie legată și nicio înregistrare a ei după reîncărcare. Vezi [Politica de confidențialitate](/info/privacy.html) pentru lista completă a ce preia sau trimite vreodată aplicația.

---

**Related:** [Căutare](/info/search.html) pentru bara care predă întrebările. [Folosirea Lolly](/info/using.html) pentru restul aplicației. [Settings](/info/dashboard.html#available-offline) pentru a lua mai întâi documentația offline.
