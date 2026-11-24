# Ask Lolly

Ask Lolly răspunde la o întrebare cu secțiunea potrivită din aceste ghiduri, citată cuvânt cu cuvânt, cu pagina ei indicată și un link **Open in docs** către acea secțiune. Nu se generează nimic: răspunsul este găsit și citat pe dispozitivul tău.

Sub secțiunea citată sunt locurile din aplicație care corespund întrebării: un instrument, un utilitar, un proiect salvat, o resursă din catalog, o setare sau o pagină a aplicației. Fiecare rând doar navighează. Nimic dintr-un răspuns nu schimbă o setare, nu deschide un fișier și nu acționează pentru tine, aceeași regulă ca în [Lolly Search](/info/search.html).

<!--i:eti-chat-->
## Pune o întrebare

Tastează în câmpul de întrebare de la baza vederii și apasă Enter. Orice text mai scurt de două caractere este ignorat. Răspunsurile se adună deasupra câmpului, cel mai nou fiind ultimul.

![Ask Lolly, deschis și gol: câmpul de întrebare de la baza vederii, cu nota că răspunsurile vin din documentație](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

::: note Fiecare întrebare este de sine stătătoare
Întrebările anterioare nu transmit context mai departe, deci „dar PDF?” după o întrebare despre export este citită doar ca o întrebare despre PDF. Pune întrebarea completă de fiecare dată.
:::

Primul cuvânt al întrebării tale stabilește ce apare întâi în răspuns:

| Începi cu | Ce apare întâi |
|---|---|
| *where*, *find*, *open*, *show*, *go to*, *goto*, *take*, *jump*, *navigate*, *switch* | locurile din aplicație care corespund |
| *make*, *create*, *generate*, *build*, *design*, *convert*, *resize*, *compress*, *remove*, *strip*, *export*, *render*, *add* | instrumentele care corespund |
| orice altceva - inclusiv *how do I* și *what is* | secțiunea din documentație, care este opțiunea implicită |

Ambele jumătăți sunt întotdeauna preluate, deci o întrebare interpretată greșit schimbă doar ordinea răspunsului.

Potrivirea elimină cuvintele frecvente din întrebări (*how*, *do*, *I*, *the*, *my*). Clasează o secțiune după câte dintre celelalte cuvinte ale tale acoperă, apoi după locul unde s-au potrivit: un titlu contează mai mult decât textul de bază. Potrivirea se face după subșir, ignorând majusculele și accentele, deci o greșeală de tastare nu este corectată. Când nu se potrivește nimic, Ask spune asta și indică indexul documentației.

**Better matching** este opțional. După primul răspuns, Ask poate oferi un model mic de potrivire, cu dimensiunea descărcării. Modelul potrivește o întrebare cu un ghid care folosește alte cuvinte pentru același lucru. Se descarcă doar când accepți, rulează pe acest dispozitiv și schimbă doar secțiunile care apar primele. Răspunsul rămâne formulat în cuvintele documentației. Îl poți descărca și ca **Ask matching model** din **Settings → Preferences → Available offline** ([Disponibil offline](/info/dashboard.html#available-offline)).

<!--i:eti-clipboard-->
## Ce primești

Un card de răspuns are o ordine fixă:

1. **Secțiunea în sine**, randată din sursa documentației: paragrafe, liste, tabele, cod și citate, cu linkuri funcționale în aplicație și către `/info`. O secțiune lungă se termină cu **Show more**, care deschide restul în același loc. Imaginile sunt omise, iar un link către alt site apare ca text simplu.
2. **Referința** - *Pagină › Titlu* - și linkul **Open in docs** către acea secțiune exactă.
3. **More in the docs** - cel mult alte patru secțiuni potrivite, ca linkuri.
4. **Rândurile din aplicație**, sub aceleași titluri de grup folosite de Search.

Textul complet vine din versiunea Markdown pe care fiecare pagină de documentație o publică la `/info/<slug>.md`. Aceste versiuni sunt doar în engleză. În altă limbă și pe puținele pagini care nu sunt construite din Markdown, răspunsul arată în schimb extrasul scurt din indexul de căutare. Referința și linkul **Open in docs** duc în continuare la pagina în limba ta.

<!--i:eti-map-pin-->
## Unde se află

Ruta este `#/ask`. Nu are filă și nici card în grila Utilities. Ajungi la vedere din bara de căutare sau prin adresa ei.

- <!--i:search--> **Din căutare.** Fiecare panou de rezultate se termină cu un rând **Ask Lolly: *interogarea ta***, sub rezultatele celorlalte grupuri. Rândul deschide `#/ask?q=…`, iar vederea pune întrebarea o singură dată la deschidere. Cuvintele ajung cu litere mici, fără punctuație, deci ajustează-le în câmpul de întrebare dacă ai nevoie.
- <!--i:link--> **Dintr-un link.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` deschide vederea cu acea întrebare deja pusă. Fragmentul hash stabilește doar prima întrebare. Întrebările pe care le tastezi după aceea primesc răspuns în același loc și nu schimbă niciodată adresa.

Bara de căutare se ascunde în această vedere, pentru că tasta Enter este folosită de câmpul de întrebare. Pastila de întoarcere te readuce de unde ai venit.

Răspunsurile rămân pentru această sesiune: sunt tot acolo dacă pleci și revii, iar o reîncărcare le șterge. Nu se scrie nimic în stocare, deci nu există istoric de gestionat.

<!--i:eti-download-->
## Offline

Răspunsurile vin din două fișiere statice publicate de site-ul documentației: indexul de căutare pentru fiecare limbă și versiunea Markdown a paginii. Ambele sunt preluate după nume, deci Ask funcționează fără conexiune după ce sunt în cache. Citirea ghidurilor în aplicație le pune în cache. **Guides & docs** din [Disponibil offline](/info/dashboard.html#available-offline) preia întregul site, inclusiv capturile de ecran, într-o singură descărcare.

Fără aceste fișiere, jumătatea de documentație a răspunsului nu apare și nu se afișează nicio eroare. Rândurile din aplicație apar în continuare, pentru că se potrivesc cu date deja aflate pe dispozitiv.

<!--i:eti-lock-->
## Confidențialitate

Întrebarea ta nu părăsește niciodată dispozitivul. Potrivirea rulează local pe fișiere preluate după nume, deci ce ai tastat nu face parte din nicio cerere. Niciun server nu îți vede întrebarea, niciun cont nu o deține și nicio înregistrare nu rămâne după reîncărcare. [Politica de confidențialitate](/info/privacy.html) listează tot ce preia sau trimite aplicația.

---

**Vezi și:** [Lolly Search](/info/search.html) pentru bara care transmite întrebările. [Folosirea Lolly](/info/using.html) pentru restul aplicației. [Lolly Settings](/info/dashboard.html#available-offline) pentru a face mai întâi documentația disponibilă offline.
