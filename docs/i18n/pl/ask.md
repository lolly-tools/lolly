# Ask Lolly

Wpisz pytanie, a Ask Lolly odpowie sekcją tych przewodników, która je omawia, słowo w słowo, z podaną stroną źródłową i linkiem **Open in docs** prosto do tej sekcji. Nic nie jest generowane: odpowiedź jest odnajdywana, cytowana i opatrywana źródłem, na Twoim urządzeniu.

Pod cytowaną sekcją znajdują się miejsca w aplikacji pasujące do tego samego pytania: narzędzie, utility, zapisany projekt, zasób katalogu, ustawienie lub strona aplikacji. Każdy wiersz tylko nawiguje. Nic w odpowiedzi nie zmienia ustawienia, nie otwiera pliku ani nie działa za Ciebie, tak samo jak w [Search](/info/search.html).

## Zadawanie pytania

Wpisz w polu pytania na dole widoku i naciśnij Enter. Wszystko krótsze niż dwa znaki jest ignorowane. Odpowiedzi układają się nad polem, najnowsza na końcu, i możesz pytać dalej.

![Ask Lolly, otwarte i puste: pole pytania na dole widoku z uwagą, że odpowiedzi pochodzą z dokumentacji](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

Każde pytanie jest obsługiwane osobno: wcześniejsze pytania nie przenoszą kontekstu, więc "a co z PDF?" po pytaniu o eksport jest czytane jako pytanie o PDF i nic więcej. Za każdym razem zadaj całe pytanie.

Pierwsze słowo pytania decyduje, co otwiera odpowiedź:

| Zaczynasz od | Co jest na początku |
|---|---|
| *where*, *find*, *open*, *show*, *go to*, *goto*, *take*, *jump*, *navigate*, *switch* | pasujące miejsca w aplikacji |
| *make*, *create*, *generate*, *build*, *design*, *convert*, *resize*, *compress*, *remove*, *strip*, *export*, *render*, *add* | pasujące narzędzia |
| cokolwiek innego - w tym *how do I* i *what is* | sekcja dokumentacji, czyli ustawienie domyślne |

Obie połowy są zawsze pobierane, więc źle odczytane pytanie zmienia kolejność odpowiedzi, a nie gubi jej połowy.

Dopasowanie pomija typowe słowa pytające (*how*, *do*, *I*, *the*, *my*) i ocenia sekcję według tego, ile z pozostałych słów obejmuje, a potem według tego, gdzie pasują: nagłówek waży więcej niż tekst. Dopasowanie jest po podciągu, bez rozróżniania wielkości liter i akcentów, więc literówka nie jest poprawiana. Gdy nic nie pasuje, Ask mówi o tym i wskazuje indeks dokumentacji, zamiast wymyślać odpowiedź.

**Better matching** jest opcjonalne. Po pierwszej odpowiedzi Ask może zaproponować mały model dopasowania, z podanym rozmiarem pobierania, który pomaga dopasować pytanie do przewodnika używającego innych słów na to samo. Pobiera się tylko za Twoją zgodą, działa na tym urządzeniu i zmienia tylko to, które sekcje są na początku: odpowiedź to nadal własne słowa dokumentacji. Możesz go też pobrać z **Settings → Preferences → Available offline**, gdzie jest wymieniony jako **Ask matching model** ([Available offline](/info/dashboard.html#available-offline)).

## Co wraca

Karta odpowiedzi jest składana w stałej kolejności:

1. **Sama sekcja**, wyrenderowana ze źródła dokumentacji - akapity, listy, tabele, kod i cytaty, z działającymi linkami do aplikacji i `/info`. Długa sekcja jest ucinana przyciskiem **Show more**, który rozwija ją na miejscu. Obrazy są pomijane, a link do innej witryny jest renderowany jako zwykły tekst, a nie kotwica.
2. **Cytowanie** - *Page › Heading* - i link **Open in docs** do dokładnie tej sekcji.
3. **More in the docs** - do czterech innych pasujących sekcji, jako linki.
4. **Wiersze w aplikacji**, pod tymi samymi nagłówkami grup co w Search.

Pełny tekst pochodzi z bliźniaka w czystym markdown, który każda strona dokumentacji publikuje pod `/info/<slug>.md`, a te bliźniaki są tylko po angielsku. W innym języku - oraz na kilku stronach niebudowanych z markdown - odpowiedź cofa się do krótkiego fragmentu z indeksu wyszukiwania zamiast całej sekcji. Cytowanie i link **Open in docs** są w obu przypadkach, wskazując stronę w Twoim języku.

## Gdzie jest

Trasa to `#/ask`. Nie ma karty ani kafla w siatce Utilities; wejść można przez pasek wyszukiwania i sam adres.

- <!--i:search--> **Z wyszukiwania.** Każdy panel wyników ma wiersz **Ask Lolly: *your query*** na samym dole, pod konkretnymi trafieniami innych grup. Przekazuje pytanie jako `#/ask?q=…`, a widok zadaje pytanie raz po wejściu. Przekazane słowa przychodzą małymi literami i bez interpunkcji, więc w razie potrzeby popraw je w polu pytania.
- <!--i:link--> **Z linku.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` otwiera widok z już zadanym pytaniem. Hash jest tylko ziarnem wejścia: pytania wpisane później są obsługiwane na miejscu i nigdy nie przepisują adresu.

Pasek wyszukiwania ustępuje w tym widoku, ponieważ pole pytania przyjmuje Enter, a pigułka wstecz zwraca Cię tam, skąd przyszedłeś.

Odpowiedzi na ekranie trwają przez tę sesję: nadal tam są, gdy odejdziesz i wrócisz, a przeładowanie je czyści. Nic nie jest zapisywane w pamięci, więc nie ma historii do zarządzania.

## Offline

Odpowiedzi są składane z dwóch plików statycznych, które witryna dokumentacji już publikuje: indeksu wyszukiwania dla języka i bliźniaka markdown strony. Oba są pobierane po nazwie, więc Ask działa bez połączenia, gdy są w pamięci podręcznej. Czytanie przewodników w aplikacji zapamiętuje je po drodze, a **Guides & docs** w [Available offline](/info/dashboard.html#available-offline) pobiera całą witrynę, ze zrzutami ekranu, jednym pobraniem.

Bez nich połowa odpowiedzi z dokumentacji po prostu się nie pojawia, bez błędu. Wiersze w aplikacji nadal są, ponieważ są dopasowywane do danych już na urządzeniu.

## Prywatność

Twoje pytanie nigdy nie opuszcza urządzenia. Dopasowanie działa lokalnie na plikach pobieranych po nazwie, więc to, co wpisałeś, nie jest częścią żadnego żądania; nie ma serwera, który je widzi, konta, do którego jest przypisane, ani zapisu po przeładowaniu. Zobacz [Privacy Policy](/info/privacy.html), aby poznać pełną listę tego, co aplikacja kiedykolwiek pobiera lub wysyła.

---

**Zobacz też:** [Search](/info/search.html) o pasku, który przekazuje pytania. [Using Lolly](/info/using.html) o reszcie aplikacji. [Settings](/info/dashboard.html#available-offline) o pobraniu dokumentacji offline wcześniej.
