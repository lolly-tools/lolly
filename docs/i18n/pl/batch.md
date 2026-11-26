# Lolly Batch i Lolly Multi-edit

<a id="batch-and-multi-edit"></a>

**Lolly Batch** tworzy wiele wersji jednego projektu, na przykład kartę w kilkunastu językach lub baner w każdym rozmiarze. **Lolly Multi-edit** wprowadza jedną zmianę, na przykład nową datę lub nagłówek, w kilku różnych zapisanych projektach.

Oba działają na Twoim urządzeniu i eksportują przez tę samą ścieżkę renderowania co narzędzia.

::: cols
## Batch

- Jeden szablon, wiele wierszy. Każdy wiersz to jeden zestaw danych wejściowych i jeden plik wynikowy.
- Wypełnij wiersze, wpisując dane, wklejając je z arkusza kalkulacyjnego lub importując CSV.
- Bez limitu wierszy; na stronie widać 50.
- Otwiera się przez **Lolly Batch** w nagłówku Projects (`#/batch`).

<a id="multi-edit"></a>
## Lolly Multi-edit

- Od dwóch do ośmiu różnych zapisanych projektów obok siebie jako karty z podglądem na żywo.
- Jeden panel boczny pozwala edytować wspólne dane wejściowe, a potem dane każdej karty.
- Każdy projekt zapisuje się z powrotem w swoim miejscu.
- Otwiera się przez **Edit together** na pasku zaznaczenia w Projects.
:::

<!--i:eti-table-->
## Tworzenie wielu wersji jednego projektu

Otwórz widok **Projects** i naciśnij **Batch** w jego nagłówku. Siatka zaczyna się od jednego wiersza. Wybierz w nim szablon, a potem powiel wiersz lub wklej dane z arkusza kalkulacyjnego. Batch otwarte z folderu pozwala wrócić do tego folderu.

![Batch z nową siatką: nazwa pliku i narzędzia wierszy u góry oraz otwarta lista szablonów pierwszego wiersza z narzędziami do wyboru](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Wypełnij wiersze.** Wpisz dane w komórkę lub wklej blok z Excel, Google Sheets albo innego arkusza kalkulacyjnego. **Import CSV** dodaje wiersze lub zastępuje całą partię. Gdy wklejasz do komórki zawierającej ustawienia eksportu, Lolly pyta, które dane wejściowe ma wypełnić każda wklejana kolumna. **Export CSV** zapisuje siatkę do pliku. Otwórz **Columns** pod siatką, aby pokazać więcej danych wejściowych lub szerokość, wysokość, jednostkę i DPI każdego wiersza. Okienko **Fill** kolumny liczbowej, tekstowej lub wyboru ma też sekcję **Design token**, która wiąże jeden token z wierszami tej kolumny ([Powiązanie wielu dokumentów naraz](/info/token-workflows.html#link-many-documents-at-once)).

**Ustaw wynik.** Pasek narzędzi ustala nazwę pliku zip, **Default format**, jednostki i DPI dla wszystkich wierszy. Menu formatu to pogrupowana lista z panelu eksportu, obejmująca formaty oferowane przez katalog i obsługiwane przez Twoją przeglądarkę. Wiersz z własnym formatem, rozmiarem lub nazwą pliku zachowuje swoje ustawienie.

**Renderuj.** **Render all** eksportuje wszystkie wiersze do jednego pliku `.zip`. Gdy zaznaczone są wiersze, **Render selected**, **Export selected CSV** i **Print selected rows** działają tylko na nich. Wyczyść zaznaczenie, aby znów pracować na całej partii. **Print sheet** układa wiersze na arkuszu do wydruku. **Batch activity** raportuje każdy import i renderowanie, a panel można zwinąć.

**Zachowaj partię.** **Sessions** zapisuje wszystkie wiersze siatki jako nazwaną sesję partii, niezależnie od zaznaczenia. Sesję można ponownie otworzyć z Projects. **Folders…** w tym samym menu otwiera folder Projects jako wiersze, po jednym na zapisaną sesję; każda nazwa pliku zawiera ścieżkę folderu.

::: details Zaznaczanie wierszy i komórek
Zaznaczaj wiersze ich polami wyboru lub kliknij pole z klawiszem Shift, aby zaznaczyć zakres. Pole w nagłówku zaznacza bieżącą stronę, a **Select all *N* rows** obejmuje też wiersze na pozostałych stronach. Zaznaczenia pozostają, gdy przechodzisz między stronami. **Edit input**, **Duplicate** i **Remove** działają na zaznaczonych wierszach, a **Undo remove** przywraca ostatnio usunięte. Gdy fokus jest na komórce, Shift+Space zaznacza jej wiersz, a Escape czyści zaznaczenie.

Przeciągnij po komórkach, kliknij komórkę z klawiszem Shift lub użyj Shift i klawiszy strzałek, aby zaznaczyć prostokąt. **Copy cells** lub Ctrl+C / Command+C kopiuje wartości do arkusza kalkulacyjnego. Ctrl+A / Command+A przy fokusie na komórce zaznacza każdą widoczną kolumnę na każdej stronie; przy fokusie na polu wyboru wiersza ten sam skrót zaznacza wszystkie wiersze. Zaznaczanie komórek nie odznacza wierszy. Kliknij komórkę dwukrotnie lub naciśnij Enter, aby edytować jej tekst. Wklej prostokątny zakres ze schowka lub jedną wartość, aby wypełnić wszystkie zaznaczone komórki; puste komórki i tekst wielowierszowy zachowują swoje pozycje.
:::

### Warianty kolorystyczne i motywy dla każdego wiersza

Każdy wiersz zachowuje własne wybory motywu: jasny lub ciemny oraz wariant kolorystyczny, jeśli system projektowy je oferuje. Wiersz otwarty z Projects, folderu lub zapisanej partii renderuje się i wyświetla w podglądzie z wyborami zapisanymi w jego sesji. Arkusz wydruku, powielony wiersz i wypełniony wiersz zachowują je.

CSV przenosi te wybory w kolumnie `_themes` po kolumnach rozmiaru. Kolumna zawiera ten sam JSON co parametr linku `_themes`, na przykład `{"":"dark","colourway":"beach"}`. Pusta komórka lub `{}` oznacza ustawienia domyślne systemu projektowego. Kolumna jest zapisywana tylko wtedy, gdy któryś wiersz ma własne wybory. Podczas importu komórka, która nie zawiera prawidłowych wyborów motywu, jest zgłaszana jako problem, a jej wiersz renderuje się z ustawieniami domyślnymi.

::: note Ustaw wybory wiersza w CSV
Siatka nie ma jeszcze kontrolki do zmiany wyborów wiersza, więc ustaw je w CSV lub w zapisanej sesji.
:::

### Język dla każdego wiersza

Narzędzie, które drukuje własne sformułowania, takie jak Certificate, może przyjąć kolumnę `language` z krótkim kodem języka, takim jak `de`, `ja` lub `ar`. Każdy wiersz drukuje wtedy tekst i datę w tym języku. Wiersze arabskie i urdu mają układ od prawej do lewej. Pusta komórka używa języka aplikacji. Język, dla którego Lolly nie ma jeszcze tłumaczenia, daje wydruk po angielsku, łącznie z datą, więc certyfikat nigdy nie jest przetłumaczony tylko w połowie.

### Batch czy Render folder

Aby ponownie wyrenderować zapisane już sesje, zaznacz je w Projects i użyj **Render selection** lub **Render folder** dla całego folderu. [Znajdowanie i odzyskiwanie pracy](/info/find-your-work.html#find-something-you-saved) opisuje obie możliwości.

<!--i:eti-layers-->
## Wspólna edycja kilku zapisanych projektów

Zaznacz od dwóch do ośmiu zapisanych sesji w **Projects** i wybierz **Edit together** z paska zaznaczenia. Otworzą się obok siebie jako karty z podglądem na żywo pod `#/multi?s=<slot>,<slot>…`. Każda karta to rzeczywisty render swojej sesji i pokazuje, co zostanie wyeksportowane.

Jeden panel boczny steruje wszystkimi:

- <!--i:sliders--> Najpierw jest **Shared**: wszystkie dane wejściowe, które co najmniej dwie sesje deklarują w ten sam sposób (ten sam identyfikator, typ i ograniczenia, według tej samej reguły, której siatka partii używa dla swoich kolumn). Zmiana wspólnej kontrolki dociera do każdej sesji deklarującej te dane wejściowe, na żywo na każdej karcie. Dwie sesje tego samego narzędzia mają wszystko wspólne; dwa różne narzędzia mają wspólne tylko te same dane wejściowe. Menu **Input actions** karty Shared wiąże token projektowy w każdej sesji deklarującej dane wejściowe.
- <!--i:document--> Pod kartą Shared **jedna zwinięta karta na sesję** zawiera wszystkie dane wejściowe tej sesji, tak jak w panelu bocznym samego narzędzia, z kompaktowym blokiem eksportu: **Format**, **W** / **H**, **Unit**, **DPI** i **Download**. To Download najpierw zapisuje sesję, a potem renderuje plik z taką samą nazwą, formatem i Content Credentials jak przy eksporcie z narzędzia.
- <!--i:search--> **Filter inputs…** u góry zawęża kontrolki na wszystkich kartach jednocześnie.

Kliknij dowolną kartę (lub naciśnij na niej Enter), aby otworzyć kartę tej sesji w panelu bocznym. **Save all** zapisuje każdą sesję z powrotem w jej własnym miejscu. **Download all** najpierw zapisuje, a potem renderuje zestaw do jednego pliku zip, tak jak **Render selection** w Projects, i oferuje opcjonalną blokadę hasłem.

Każda karta rysuje się zgodnie z wyborami motywu swojej sesji, także narzędzie umieszczone wewnątrz projektu. Aplikacja wokół kart zachowuje własne kolory. **Save all**, pobrania, **Batch grid** i **Send to Print Sheet** zachowują wybory każdej sesji.

### Ograniczenia

- **Najwyżej osiem.** Każda karta uruchamia własne środowisko na żywo, a osiem kart zachowuje płynność działania. Link wskazujący więcej sesji lub sesję, która już nie istnieje, informuje o tym i nie ładuje zestawu częściowo.
- **Link jest lokalny.** Wskazuje Twoje zapisane miejsca i ponownie otwiera ten zestaw na tym urządzeniu. To nie jest link do udostępniania.
- **Przy większej liczbie** wybierz **Edit as sheet** na tym samym pasku zaznaczenia. Otwiera zaznaczone sesje jako wiersze w siatce partii (`#/batch?s=…`), bez limitu rozmiaru i wymogu tego samego narzędzia. Foldery nie są objęte żadną z tych opcji: otwórz folder w siatce przez **Sessions → Folders…** lub wyrenderuj go przez **Render folder** w Projects.
- **Wyszukiwanie nie obejmuje Lolly Multi-edit.** To jedyny widok, którego nie obejmuje pasek wyszukiwania.

<!--i:eti-map-pin-->
## Co dalej

- **[Eksport pliku](/info/exporting.html)**: formaty, rozmiary i ustawienia druku dostępne dla każdego wiersza.
- **[Szablony](/info/templates.html)**: punkty wyjścia, które sprawdzają się jako pierwszy wiersz.
- **[Znajdowanie i odzyskiwanie pracy](/info/find-your-work.html)**: Projects, foldery i renderowanie zapisanej pracy.
