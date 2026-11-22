# Ask Lolly

Ask Lolly odpowiada na pytanie pasującą sekcją tych przewodników, cytowaną słowo w słowo, ze wskazaniem strony źródłowej i linkiem **Open in docs** do tej sekcji. Nic nie jest generowane: odpowiedź jest znajdowana i cytowana na Twoim urządzeniu.

Pod cytowaną sekcją znajdują się miejsca w aplikacji pasujące do pytania: narzędzie, utility, zapisany projekt, zasób z katalogu, ustawienie lub strona aplikacji. Każdy wiersz służy wyłącznie do nawigacji. Nic w odpowiedzi nie zmienia ustawień, nie otwiera plików ani nie działa za Ciebie, według tej samej zasady co [Lolly Search](/info/search.html).

<!--i:eti-chat-->
## Zadawanie pytania

Wpisz pytanie w polu u dołu widoku i naciśnij Enter. Tekst krótszy niż dwa znaki jest ignorowany. Odpowiedzi układają się nad polem, najnowsze na końcu.

![Ask Lolly, otwarte i puste: pole pytania u dołu widoku z informacją, że odpowiedzi pochodzą z dokumentacji](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

::: note Każde pytanie jest niezależne
Wcześniejsze pytania nie przekazują kontekstu dalej, więc „a co z PDF?” po pytaniu o eksport jest odczytywane wyłącznie jako pytanie o PDF. Za każdym razem zadawaj pełne pytanie.
:::

Pierwsze słowo pytania decyduje, co pojawi się na początku odpowiedzi:

| Początek pytania | Co pojawia się najpierw |
|---|---|
| *where*, *find*, *open*, *show*, *go to*, *goto*, *take*, *jump*, *navigate*, *switch* | pasujące miejsca w aplikacji |
| *make*, *create*, *generate*, *build*, *design*, *convert*, *resize*, *compress*, *remove*, *strip*, *export*, *render*, *add* | pasujące narzędzia |
| cokolwiek innego - w tym *how do I* i *what is* | sekcja dokumentacji, czyli opcja domyślna |

Obie części są zawsze pobierane, więc błędne odczytanie pytania zmienia tylko kolejność odpowiedzi.

Dopasowywanie pomija typowe słowa z pytań (*how*, *do*, *I*, *the*, *my*). Szereguje sekcje według liczby pozostałych słów pytania, które zawierają, a potem według miejsca dopasowania: nagłówek liczy się bardziej niż treść. Dopasowywanie działa na fragmentach ciągów znaków, bez rozróżniania wielkości liter i znaków diakrytycznych, więc nie poprawia literówek. Gdy nic nie pasuje, Ask informuje o tym i kieruje do indeksu dokumentacji.

**Better matching** jest opcjonalne. Po pierwszej odpowiedzi Ask może zaproponować mały model dopasowywania, podając rozmiar pobierania. Model dopasowuje pytanie do przewodnika, który opisuje to samo innymi słowami. Pobiera się tylko za Twoją zgodą, działa na tym urządzeniu i zmienia jedynie kolejność sekcji. Odpowiedź nadal składa się z własnych słów dokumentacji. Możesz też pobrać go jako **Ask matching model** w **Settings → Preferences → Available offline** ([Dostępne offline](/info/dashboard.html#available-offline)).

<!--i:eti-clipboard-->
## Co zawiera odpowiedź

Karta odpowiedzi ma stałą kolejność:

1. **Sama sekcja**, wyrenderowana ze źródła dokumentacji: akapity, listy, tabele, kod i cytaty, z działającymi linkami wewnątrz aplikacji i do `/info`. Długą sekcję kończy **Show more**, które rozwija resztę w tym samym miejscu. Obrazy są pomijane, a link do innej witryny jest pokazywany jako zwykły tekst.
2. **Wskazanie źródła** - *Strona › Nagłówek* - i link **Open in docs** do dokładnie tej sekcji.
3. **More in the docs** - linki do maksymalnie czterech innych pasujących sekcji.
4. **Wiersze miejsc w aplikacji**, pod tymi samymi nagłówkami grup, których używa Search.

Pełny tekst pochodzi z kopii Markdown, którą każda strona dokumentacji publikuje pod `/info/<slug>.md`. Te kopie są tylko po angielsku. W innym języku i na kilku stronach, które nie powstają z Markdown, odpowiedź pokazuje zamiast tego krótki fragment z indeksu wyszukiwania. Wskazanie źródła i link **Open in docs** nadal prowadzą do strony w Twoim języku.

<!--i:eti-map-pin-->
## Gdzie się znajduje

Ścieżka to `#/ask`. Nie ma karty ani kafelka w siatce Utilities. Do widoku trafisz z paska wyszukiwania lub przez jego adres.

- <!--i:search--> **Z wyszukiwania.** Każdy panel wyników kończy się wierszem **Ask Lolly: *Twoje zapytanie*** pod wynikami pozostałych grup. Wiersz otwiera `#/ask?q=…`, a widok zadaje pytanie raz po otwarciu. Słowa trafiają tam małymi literami, bez interpunkcji, więc w razie potrzeby dopracuj je w polu pytania.
- <!--i:link--> **Z linku.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` otwiera widok z już zadanym pytaniem. Fragment adresu po znaku # ustawia tylko pierwsze pytanie. Pytania wpisane później otrzymują odpowiedzi w tym samym miejscu i nigdy nie zmieniają adresu.

Pasek wyszukiwania jest ukryty w tym widoku, ponieważ Enter obsługuje pole pytania. Pigułka powrotu przenosi Cię do miejsca, z którego przyszedłeś.

Odpowiedzi pozostają na czas tej sesji: nadal tam są, jeśli wyjdziesz i wrócisz, a przeładowanie je usuwa. Nic nie jest zapisywane w pamięci trwałej, więc nie ma historii do zarządzania.

<!--i:eti-download-->
## Offline

Odpowiedzi pochodzą z dwóch statycznych plików publikowanych przez witrynę dokumentacji: indeksu wyszukiwania dla danego języka i kopii Markdown strony. Oba są pobierane według nazwy, więc Ask działa bez połączenia, gdy trafią do pamięci podręcznej. Czytanie przewodników w aplikacji zapisuje je w pamięci podręcznej. **Guides & docs** w sekcji [Dostępne offline](/info/dashboard.html#available-offline) pobiera całą witrynę, łącznie ze zrzutami ekranu, za jednym razem.

Bez tych plików część odpowiedzi z dokumentacji nie pojawia się i nie jest wyświetlany błąd. Wiersze miejsc w aplikacji nadal się pojawiają, ponieważ dopasowują się do danych już obecnych na urządzeniu.

<!--i:eti-lock-->
## Prywatność

Twoje pytanie nigdy nie opuszcza urządzenia. Dopasowywanie działa lokalnie na plikach pobieranych według nazwy, więc wpisany tekst nie jest częścią żadnego żądania. Żaden serwer nie widzi Twojego pytania, żadne konto go nie przechowuje, a po przeładowaniu nie pozostaje żaden zapis. [Polityka prywatności](/info/privacy.html) wymienia wszystko, co aplikacja pobiera lub wysyła.

---

**Powiązane:** [Lolly Search](/info/search.html) opisuje pasek przekazujący pytania. [Korzystanie z Lolly](/info/using.html) opisuje resztę aplikacji. [Ustawienia Lolly](/info/dashboard.html#available-offline) opisują wcześniejsze pobranie dokumentacji do użytku offline.
