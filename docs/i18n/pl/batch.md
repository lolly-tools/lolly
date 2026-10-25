# Batch i Multi-edit

Gdy często tworzysz ten sam rodzaj pliku, pojawiają się dwa zadania. Czasem potrzebujesz wielu wersji jednego projektu: karty w kilkunastu językach albo każdego rozmiaru banera. Czasem masz kilka różnych zapisanych projektów i chcesz, by jedna zmiana dotarła do wszystkich, na przykład nowa data lub nowy nagłówek.

**Batch** wykonuje pierwsze zadanie, a **Multi-edit** drugie. Oba działają na Twoim urządzeniu i eksportują tą samą ścieżką renderowania co same narzędzia.

::: cols
## Batch

- Jeden szablon, wiele wierszy. Każdy wiersz to jeden zestaw danych wejściowych i tworzy jeden plik.
- Wypełniaj wiersze, wpisując, wklejając z arkusza kalkulacyjnego lub importując CSV.
- Bez limitu wierszy; 50 na stronie.
- Otwiera się z **Batch** w nagłówku Projects (`#/batch`).

## Multi-edit

- Od dwóch do ośmiu różnych zapisanych projektów, obok siebie jako żywe karty.
- Jeden pasek boczny edytuje wspólne dane wejściowe, a potem własne każdej karty.
- Każdy projekt zapisuje się z powrotem tam, skąd pochodzi.
- Otwiera się z **Edit together** na pasku zaznaczania Projects.
:::

## Twórz wiele wersji jednego projektu

Otwórz **Projects** i naciśnij **Batch** w jego nagłówku. Siatka zaczyna się od jednego wiersza: wybierz w nim szablon, a potem zduplikuj wiersz lub wklej dane z arkusza kalkulacyjnego. Otwarty z wnętrza folderu Batch zwraca Cię do tego folderu.

![Batch na nowej siatce: nazwa pliku i narzędzia wierszy u góry, a lista szablonów pierwszego wiersza otwarta na narzędziach do wyboru](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Wypełnij wiersze.** Wpisz w komórkę lub wklej blok prosto z Excela, Arkuszy Google albo innego arkusza kalkulacyjnego. **Import CSV** dodaje wiersze lub zastępuje batch. Gdy wklejasz do komórki zawierającej ustawienia eksportu, Lolly pyta, które dane wejściowe wypełnia każda wklejona kolumna. **Export CSV** zapisuje siatkę z powrotem. Otwórz **Columns** pod siatką, aby pokazać więcej danych wejściowych albo szerokość, wysokość, jednostkę i DPI dla wiersza.

**Ustaw wynik.** Pasek narzędzi ustawia nazwę pliku zip, **Default format**, jednostki i DPI dla każdego wiersza. Menu formatu to pogrupowana lista z panelu eksportu, pokazująca formaty oferowane przez katalog i obsługiwane przez przeglądarkę. Wiersz z własnym formatem, rozmiarem lub nazwą pliku zachowuje własne ustawienie.

**Renderuj.** **Render all** eksportuje każdy wiersz do jednego `.zip`. Najpierw zaznacz wiersze, a **Render selected**, **Export selected CSV** i **Print selected rows** działają tylko na nich; wyczyść zaznaczenie, aby znów pracować na całym batchu. **Print sheet** układa wiersze na arkuszu do druku. **Batch activity** zgłasza każdy import i renderowanie, a zwija się, by dać tabeli więcej miejsca.

**Zachowaj batch.** **Sessions** zapisuje całą siatkę jako nazwaną sesję batch, którą można później otworzyć z Projects. Sessions zawsze zapisuje każdy wiersz, niezależnie od zaznaczenia. **Folders…** w tym samym menu otwiera cały folder Projects jako wiersze, jeden na zapisaną sesję, a nazwa każdego pliku niesie ścieżkę folderu.

::: details Zaznaczanie wierszy i komórek
Zaznaczaj wiersze ich polami wyboru albo kliknij z Shift pole wyboru, aby zaznaczyć zakres. Pole wyboru w nagłówku zaznacza bieżącą stronę, a **Select all *N* rows** obejmuje też wiersze na innych stronach. Zaznaczenia zostają przy przechodzeniu między stronami. **Edit input**, **Duplicate** i **Remove** działają na zaznaczonych wierszach, a **Undo remove** przywraca wiersze usunięte jako ostatnie. Z komórki z fokusem Shift+Space zaznacza ten wiersz, a Escape czyści zaznaczenie.

Przeciągnij przez komórki, kliknij komórkę z Shift lub użyj Shift+strzałek, aby zaznaczyć prostokąt. **Copy cells** albo Ctrl+C / Command+C kopiuje wartości dla arkusza kalkulacyjnego. Ctrl+A / Command+A z komórki z fokusem zaznacza każdą widoczną kolumnę na każdej stronie; z pola wyboru wiersza ten sam skrót zaznacza każdy wiersz. Zaznaczenie komórek zostawia zaznaczone wiersze zaznaczonymi. Kliknij komórkę dwukrotnie lub naciśnij Enter, aby edytować jej tekst. Wklej prostokąt ze schowka albo wklej jedną wartość, aby wypełnić każdą zaznaczoną komórkę; puste komórki i tekst wielowierszowy zachowują swoje pozycje.
:::

### Warianty kolorystyczne i motywy na wiersz

Każdy wiersz zachowuje własne wybory motywu: jasny lub ciemny oraz colourway, gdy system projektowy je ma. Wiersz otwarty z Projects, folderu lub zapisanego batcha renderuje się w wyborach, w których zapisano jego sesję, a jego podgląd otwiera się w nich. Arkusz do druku, zduplikowany wiersz i wypełniony wiersz też je zachowują.

CSV niesie te wybory w kolumnie `_themes` po kolumnach rozmiaru, z tym samym JSON co parametr linku `_themes`, na przykład `{"":"dark","colourway":"beach"}`. Pusta komórka lub `{}` oznacza domyślne wartości systemu projektowego. Kolumna jest zapisywana tylko wtedy, gdy jakiś wiersz ma wybory, więc batch bez nich eksportuje ten sam CSV co wcześniej. Przy imporcie komórka, która nie jest prawidłowym wyborem motywu, jest wymieniana jako problem, a jej wiersz renderuje się w wartościach domyślnych. Siatka nie ma jeszcze kontrolki do zmiany wyborów wiersza, więc ustaw je w CSV lub w zapisanej sesji.

### Batch lub Render folder

Batch tworzy wiele wariantów jednego szablonu. Aby ponownie wyrenderować już zapisane sesje, zaznacz je w Projects i użyj **Render selection**, lub **Render folder** dla całego folderu; [Find and recover your work](/info/find-your-work.html#find-something-you-saved) opisuje oba.

## Edytuj razem kilka zapisanych projektów

Zaznacz od dwóch do ośmiu zapisanych sesji w **Projects** i wybierz **Edit together** na pasku zaznaczania. Otwierają się obok siebie jako żywe karty pod `#/multi?s=<slot>,<slot>…`. Każda karta jest prawdziwym renderem swojej sesji, więc to, co widzisz, zostanie wyeksportowane.

Jeden pasek boczny steruje wszystkimi:

- <!--i:sliders--> **Shared** jest na pierwszym miejscu: każde dane wejściowe, które dwie lub więcej sesji deklaruje tak samo (ten sam identyfikator, ten sam typ, te same ograniczenia, reguła, której siatka batch używa dla kolumn). Edytuj wspólną kontrolkę raz, a wartość dociera do każdej sesji deklarującej te dane wejściowe, na żywo na każdej karcie. Dwie sesje tego samego narzędzia dzielą wszystko; dwa różne narzędzia dzielą tylko wspólne dane wejściowe.
- <!--i:document--> Pod nim **jedna zwinięta karta na sesję** zawiera wszystkie własne dane wejściowe tej sesji, tak kompletne jak pasek boczny samego narzędzia, z kompaktowym blokiem eksportu: **Format**, **W** / **H**, **Unit**, **DPI** i **Download**. Ten Download najpierw zapisuje sesję, a potem renderuje plik z tą samą nazwą pliku, formatem i Content Credentials, jakie miałby z narzędzia.
- <!--i:search--> **Filter inputs…** u góry zawęża kontrolki na każdej karcie naraz, więc możesz dotrzeć do "nagłówka" w ośmiu sesjach bez przewijania.

Kliknij dowolną kartę (lub naciśnij na niej Enter), aby otworzyć kartę paska bocznego tej sesji. **Save all** zapisuje każdą sesję z powrotem w jej slocie. **Download all** najpierw zapisuje, a potem renderuje cały zestaw do jednego zip, tak jak robi to **Render selection** w Projects, z opcjonalną blokadą hasłem oferowaną po drodze.

Każda karta rysuje się w wyborach motywu własnej sesji, w tym narzędzia umieszczonego wewnątrz projektu. Karty w różnych wyglądach leżą obok siebie, podczas gdy aplikacja wokół zachowuje własne kolory, a **Save all**, pobrania, **Batch grid** i **Send to Print Sheet** zachowują wybory każdej sesji.

### Limity

- **Najwyżej osiem.** Każda karta montuje własne działające środowisko, a osiem to liczba, przy której wszystko pozostaje responsywne. Link prosi o więcej lub o sesję, która już nie istnieje, i mówi o tym, zamiast ładować się częściowo.
- **Link jest lokalny.** Wskazuje Twoje własne zapisane sloty, więc otwiera ten zestaw na tym urządzeniu. Nie jest linkiem udostępniania.
- **Dla czegoś większego** wybierz **Edit as sheet** na tym samym pasku zaznaczania. Otwiera całe zaznaczenie jako wiersze w siatce batch (`#/batch?s=…`), bez limitu rozmiaru i bez reguły tego samego narzędzia. Foldery zostają poza oboma: otwórz folder w siatce przez **Sessions → Folders…** albo wyrenderuj go przez **Render folder** w Projects.
- **Wyszukiwanie nie sięga Multi-edit.** To jedyny widok, o którym pasek wyszukiwania nie wie.

## Dokąd dalej

- **[Export a file](/info/exporting.html)**: formaty, rozmiary i ustawienia druku, których może używać każdy wiersz.
- **[Templates](/info/templates.html)**: punkty wyjścia, które dają dobry pierwszy wiersz.
- **[Find and recover your work](/info/find-your-work.html)**: Projects, foldery i renderowanie tego, co zapisałeś.
