# Znajdź i odzyskaj swoją pracę

Wszystko, co tworzysz w Lolly, zostaje w przeglądarce lub aplikacji, w której to zrobiłeś, na tym urządzeniu, chyba że włączysz [Synchronizację](/info/sync.html). Zapisana praca jest w **Projektach**. Pobrany plik jest tam, gdzie umieściła go twoja przeglądarka lub system, a kopia zwykle czeka w **Zasobach**. W większości narzędzi praca, której nigdy nie zapisałeś, też jest zachowywana. Ta strona omawia każdy z tych przypadków, a także zamkniętą kartę, wyczyszczone dane przeglądarki, wcześniejsze wersje, usunięte elementy i przenoszenie na inne urządzenie.

| Co zrobiłeś | Gdzie szukać |
|---|---|
| Nacisnąłeś **Zapisz jako** albo **Zapisz** | **Projekty** |
| Nacisnąłeś **Pobierz** | Pobrane pliki twojej przeglądarki, a kopia w **Zasobach** |
| Żadne z powyższych, w [narzędziu, które zapisuje w trakcie pracy](#which-tools-save-as-you-work) | **Projekty** i **Historia** |
| Żadne z powyższych, w narzędziu, które tego nie robi | Tylko karta, w której pracowałeś, do czasu jej zamknięcia |
| Usunąłeś to w aplikacji | **Kosz**, w **Projektach**, **Zasobach** lub **Ustawienia → Pamięć**, przez 30 dni |

## Znajdź to, co zapisałeś

1. Naciśnij **Start** w lewym górnym rogu narzędzia.
2. Otwórz zakładkę **Projekty** na górze ekranu startowego (na telefonie ikona folderu).
3. Spójrz na pierwszy ekran. Jest tam praca zapisana do **Mojej biblioteki**, a każdy projekt to folder. Aby przeszukać wszystkie foldery naraz, wpisz coś w **Szukaj we wszystkich projektach…** u dołu ekranu.

Element jest nazwany od nazwy pliku, którą wpisałeś w panelu eksportu, albo od swojego narzędzia, na przykład **QR Code**, jeśli nic nie wpisałeś. Otwórz element, a każde ustawienie wraca, gotowe do zmiany i ponownego eksportu. Aby zapisywać nową pracę w ten sposób, zobacz [Zapisywanie i kontynuowanie](/info/using.html#saving-continuing).

::: note Nie ma tego w Projektach?
- Może być w **Koszu**: zobacz [Odzyskaj coś, co usunąłeś](#get-back-something-you-deleted).
- Inna przeglądarka, okno prywatne albo inne urządzenie zaczynają puste, chyba że używasz [Synchronizacji](/info/sync.html) albo [przenosisz swoją pracę](#move-your-work-to-another-device).
- Jeśli nacisnąłeś tylko **Pobierz**, zobacz [Znajdź pobrany plik](#find-a-file-you-downloaded).
:::

::: details Praca z Projektami
Projekty możesz też otworzyć z **Ustawienia → Pamięć → Zapisane sesje → Zorganizuj w Projektach**. Działają jak menedżer plików:

![Projekty, zanim cokolwiek zostanie zapisane: kafelki Nowy folder, Nowy zasób i Szablony, zegar History w prawym górnym rogu i pasek Szukaj we wszystkich projektach u dołu](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **Foldery, które się zagnieżdżają.** Grupuj zapisane sesje w foldery, a foldery w kolejne foldery, tak głęboko, jak chcesz. Utwórz folder, zmień jego nazwę albo przeciągnij kafelek na inny folder, aby go przenieść; ścieżka okruszkowa prowadzi z powrotem w górę. Sesje zapisane bez folderu pojawiają się wprost w korzeniu **Projektów**.
- <!--i:clock--> **Sortuj po swojemu.** **Opcje widoku**, przycisk z suwakami w prawym górnym rogu, oferuje **Siatkę** lub **Listę** i sortowanie według **Nazwy**, **Daty dodania**, **Ostatniej modyfikacji** (domyślnie), **Rozmiaru**, a wewnątrz folderu też **Według narzędzia**. Foldery zawsze są na początku, niezależnie od aktywnego sortowania - sortowanie porządkuje tylko sesje i foldery w obrębie własnej grupy.
- <!--i:document--> **Twórz nową pracę od razu tutaj.** **Nowy zasób** otwiera wspólny selektor. Wybierz **Szablony**, aby zacząć od zapisanego szablonu: otwórz go do edycji albo użyj **+ Dodaj**, aby od razu zapisać nową kreację.
- <!--i:checklist--> **Zaznaczanie wielokrotne (komputer).** Zaznacz pole wyboru kafelka, przeciągnij ramkę zaznaczenia po pustym miejscu albo użyj **Shift/Cmd-klik**; **prawy przycisk** na kafelku otwiera jego menu kontekstowe. Pasek zaznaczenia oferuje wtedy **Renderuj wybór**, **Przenieś do…**, **Nowy folder**, **Usuń** (co przenosi do kosza), **Edytuj razem** dla dwóch do ośmiu sesji jednego narzędzia, obok siebie pod jednym paskiem bocznym, oraz **Edytuj jako arkusz**, który otwiera zaznaczenie dowolnego rozmiaru lub mieszanki jako wiersze w siatce wsadowej.
- <!--i:download--> **Renderuj cały folder albo zaznaczenie.** **Renderuj folder** eksportuje każdą zapisaną sesję z folderu - razem z podfolderami - jako jeden zagnieżdżony plik `.zip`. **Renderuj wybór** robi to samo dla dowolnego zaznaczenia wielokrotnego, a pojedyncza sesja renderuje się wprost do własnego pliku. Bez potrzeby Batch/Pro.
- <!--i:link--> **Przejdź prosto do zapisanych prac narzędzia.** Zaznacz jedno lub więcej narzędzi w galerii Narzędzi i wybierz **Zobacz sesje** z paska zaznaczenia - Projekty otwierają się, pokazując tylko sesje zrobione tymi narzędziami, z przyciskiem **Wyczyść**, aby wrócić do pełnego widoku.
- <!--i:link--> **Udostępnij zapisaną sesję.** Kliknij sesję prawym przyciskiem (na telefonie naciśnij **•••** na jej kafelku) → **Udostępnij link**, aby skopiować link, który otwiera ją ponownie z tymi samymi ustawieniami; obrazy z twojego urządzenia nie podróżują z linkiem (pełne okno udostępniania: zobacz [Udostępnianie swojej pracy](/info/using.html#sharing-your-work)).
- <!--i:pentool--> **Zmień nazwę albo skopiuj sesję.** Kliknij sesję prawym przyciskiem (na telefonie naciśnij **•••** na jej kafelku), aby zobaczyć **Zmień nazwę**, **Duplikat** (kopię w tym samym folderze) i **Przenieś do…**.

![Wyskakujące okienko Opcje widoku w Projektach: Układ z Siatką i Listą oraz Sortuj według ustawione na Ostatnią modyfikację, obok przycisku odwracającego kolejność](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
<!--
SHOT NOTE (misc-projects-sort): trigger button confirmed as
`.filter-fab.projects-viewopts` in views/projects.ts (openViewOpts() is bound
to `.projects-viewopts` specifically) - `.projects-viewopts` alone is the
more specific hook, so that's what drives the click. The popover it opens
(`.projects-viewmenu`, also confirmed directly in openViewOpts()) is body-
appended, not nested under the Projects root, so cropSelector finds it
regardless. "By tool" only appears inside a folder - this recipe captures at
the Projects ROOT (`url=/#/p`), so if the capture pass wants "By tool"
visible too, point url= at a real folder instead: the route is a path
segment, `/#/p/<folderId>` (confirmed in main.ts's hash router - `parts[0]
=== 'p'` reads `folderId` from `parts[1]`), not a query param. Caveat: a
folder has to already EXIST in the capture profile, which a per-shot fresh
context has none of.
The popover (views/projects-view-options.ts, checked 2026-09-26) holds a
Layout pair (Grid / List) and a Sort by menu with a reverse button; the
options inside the menu (Name, Date added, Last modified, Size, By tool) are
not visible in the closed menu, so the alt does not list them.
-->

:::

## Jeśli zamknąłeś kartę albo opuściłeś narzędzie

To, co wraca, zależy od tego, jak wyszedłeś i którego narzędzia użyłeś:

- **Zamknąłeś kartę albo wróciłeś innym razem.** Niezapisana praca przepada, z wyjątkiem [narzędzi, które zapisują w trakcie pracy](#which-tools-save-as-you-work): otwórz tę pracę z **Projektów**.
- **Przeładowałeś stronę w tej samej karcie.** Twoje ustawienia wracają z adresu strony. W narzędziach, które nie zapisują w trakcie pracy, obrazy i pliki, które dodałeś z urządzenia, oraz jednowierszowy tekst dłuższy niż 150 znaków nie wracają, ponieważ adres ich nie przechowuje.
- **Nacisnąłeś Start albo przycisk wstecz w lewym górnym rogu.** Jeśli coś zmieniłeś od ostatniego zapisu, pobrania albo skopiowania, okno **Niezapisane zmiany** pyta, czy najpierw zapisać. **Zapisz i wyjdź** zapisuje pracę i przenosi cię do **Projektów** albo z powrotem do folderu projektu, z którego otworzyłeś pracę. **Wyjdź bez zapisywania** odrzuca twoje zmiany: zapisany element wraca do stanu z ostatniego zapisu, a kreacja, której nigdy nie zapisałeś, znika z **Projektów**. **Anuluj** zatrzymuje cię w narzędziu.

Lolly pyta tylko wtedy, gdy naciśniesz **Start** albo przycisk wstecz w narzędziu. Zamknięcie karty, przeładowanie i własny przycisk Wstecz przeglądarki nigdy nie pytają. Aby mieć pewność, naciśnij **Zapisz jako** albo **Zapisz** w panelu eksportu, zanim opuścisz narzędzie.

::: note Wyszedłeś bez zapisywania przez pomyłkę?
W narzędziach, które zapisują w trakcie pracy, Historia zachowuje kopię odrzuconych zmian. Otwórz stronę **Historia**, znajdź je pod **Zmiany** i naciśnij **Otwórz jako kopię**. W innych narzędziach zmiany przepadają.
:::

::: details Które narzędzia zapisują w trakcie pracy
W aplikacji webowej każde narzędzie, które tworzy dokument, zapisuje w trakcie pracy: Design, Chart, QR Code, Text, Sandbox i pozostałe. Te narzędzia nie:

- narzędzia, które pracują na pliku, który przynosisz, takie jak Redact, Sign albo Convert Image, ponieważ Lolly nigdy nie zachowuje kopii tego pliku;
- narzędzia, które nagrywają z twojej kamery, mikrofonu albo ekranu, takie jak Record, Screen Capture i Voice Recorder;
- 3D i Darkroom, które przyjmują własny plik;
- narzędzie, w którym nie ma nic do zmiany, takie jak Countdown.

W pozostałych narzędziach pierwsza zmiana umieszcza pracę w **Projektach** tak, jakbyś ją zapisał, a kolejne zmiany są zachowywane w trakcie pracy, gdy tylko narzędzie skończy rysować. Dzięki temu niezapisana kreacja nadal jest w Projektach po zamknięciu karty i otwiera się ponownie ze swoimi zmianami oznaczonymi jako niezapisane. **Wyjdź bez zapisywania** nadal je odrzuca, a Historia zachowuje kopię odrzuconych zmian przez 30 dni. Ponowne otwarcie narzędzia z ekranu startowego zaczyna nową kreację; otwórz wcześniejszą z Projektów.

Przy włączonej [Synchronizacji](/info/sync.html) kreacja założona w ten sposób trafia na twoje inne urządzenia jak wszystko inne w Projektach. Jej wersje zostają na urządzeniu, na którym powstały.

Jeśli kreacja jest otwarta w dwóch kartach i zapiszesz w obu, zachowany zostaje ostatni zapis. Praca, którą zastąpił, nie jest stracona: znajduje się w Historii kreacji pod **Chronione wersje robocze**, z **Otwórz wersję roboczą jako kopię**.

Działa to wyłącznie w aplikacji webowej, nie w aplikacjach desktopowych ani mobilnych, i nie podczas pracy na żywo z kimś innym.
:::

## Znajdź pobrany plik

W przeglądarce **Pobierz** przekazuje plik twojej przeglądarce, która zapisuje go w swoim folderze pobranych plików (zwykle **Downloads**) albo pyta, gdzie. Lolly nie wie, gdzie trafił plik, więc sprawdź listę pobranych plików w swojej przeglądarce.

Jeśli żaden plik się nie pojawił, sprawdź panel eksportu, gdy nadal jesteś w narzędziu. Pod **Pobierz** wiersz podaje nazwę pliku i czas, z przyciskiem **Retry download**, a w Chrome, Edge i innych przeglądarkach opartych na Chromium także **Save file…**, aby samemu wybrać folder. Ten wiersz i jego plik trwają, dopóki nie opuścisz narzędzia, nie przeładujesz strony albo nie wyeksportujesz ponownie.

Lolly zachowuje też dwie rzeczy po każdym pobraniu:

- **Kopia pliku**, w **Zasobach** pod **Twoje pliki**, o ile **Zapisuj moje renderowania w mojej bibliotece** jest włączone pod **Ustawienia → Twoje rendery** (**Ustawienia** są u dołu ekranu startowego). To ustawienie jest domyślnie włączone. Wideo albo plik większy niż 50 MB najpierw pyta, a zip nie jest kopiowany.
- **Ustawienia, których użyłeś**, dla twoich ostatnich 24 pobrań. **Ostatnie eksporty**, poniżej twojej zapisanej pracy w **Projektach**, otwiera ponownie narzędzie z tymi ustawieniami, abyś mógł ponownie zrobić plik, choć obrazy i pliki, które dodałeś z urządzenia, nie są uwzględnione. Ta sama lista jest pod **Ustawienia → Aktywność i statystyki → Najnowsze eksporty** oraz na karcie **Changes** w **History**. Ta lista przechowuje ustawienia, nie pliki.

::: details W aplikacjach desktopowej i mobilnych
- **Aplikacja desktopowa:** **Pobierz** zapisuje bezpośrednio do folderu **Lolly** wewnątrz twojego folderu **Downloads**, bez okna dialogowego. Linia pod **Pobierz** mówi, dokąd trafił plik, na przykład „Zapisano w Downloads/Lolly”, wraz z **Pokaż w folderze**. **Open Exports Folder**, w menu **Window** albo **Eksporty**, otwiera ten folder w dowolnej chwili. Plik o tej samej nazwie co wcześniejszy jest zapisywany jako „name (1)”.
- **iPhone i iPad:** plik jest zapisywany w aplikacji **Pliki**, w folderze **Lolly**, po czym otwiera się arkusz udostępniania, żebyś mógł przesłać go dalej. Linia pod **Pobierz** brzmi „Zapisano w Files → Lolly”.
- **Android:** otwiera się menu udostępniania, żebyś mógł wybrać, dokąd trafi plik.

Na iPhonie, iPadzie i Androidzie nowy plik zastępuje wcześniejszy o tej samej nazwie.
:::

## Wróć do wcześniejszej wersji

- **W trakcie tej wizyty:** **Wycofaj** cofa krok po kroku przez twoje ostatnie 100 zmian, dopóki nie opuścisz narzędzia albo nie przeładujesz strony. Zobacz [Cofanie i ponawianie](/info/using.html#undo-and-redo).
- **W [narzędziach, które zapisują w trakcie pracy](#which-tools-save-as-you-work):** wcześniejsze wersje każdej kreacji są zachowywane. Wykonaj kroki poniżej.
- **Wszystko na urządzeniu:** przy włączonej [Synchronizacji](/info/sync.html) **Restore an earlier copy**, pod **Ustawienia → Połączone usługi**, przywraca jedną z ostatnich siedmiu dziennych kopii albo kopię sprzed ostatniego zastosowania. Wszystko na tym urządzeniu odpowiada wtedy tej kopii, nie tylko jeden projekt.

Aby otworzyć wcześniejszą wersję:

1. Naciśnij **Historię**, przycisk zegara obok **Wycofaj** i **Powtórz**. W Design **Historia** jest na górnym pasku; na telefonie naciśnij **•••**, a potem **Historia**. W narzędziach bez **Wycofaj**, takich jak Text i Sandbox, **Historia** jest obok **Start** w lewym górnym rogu.
2. Znajdź wersję po dacie i godzinie. Wiersze **Automatyczny punkt kontrolny** są rejestrowane w trakcie pracy; wiersze **Zapisana wersja** to chwile, w których zapisałeś.
3. Naciśnij **Otwórz jako kopię**. Wersja otwiera się jako nowa kreacja, a ta, którą miałeś otwartą, zostaje bez zmian. Kopia jest w **Projektach**, z dopiskiem „(copy)” po nazwie.

Aby zachować wersję pod nazwą, naciśnij **Name version**, wpisz nazwę i naciśnij **Keep milestone**. Nazwane wersje są wymienione na stronie **History**, pod **Milestones**.

::: details Panel History i strona History
Panel **History** zawiera też wiersze **Recovered work**, a **Protected drafts** przechowuje twoje najnowsze zmiany między checkpointami, z **Open draft as a copy**. **Compare** i **Check assets** pomagają zdecydować, zanim otworzysz kopię. Przełącz **This creation** na **All history on this device**, aby zobaczyć każdą kreację.

Automatyczne punkty kontrolne rzednie z wiekiem: jeden na minutę przez ostatnią godzinę, jeden na godzinę przez ostatni dzień, jeden dziennie przez 30 dni, a potem jeden na tydzień. Zapisane wersje i nazwane wersje są zachowywane wszystkie. Usunięcie kreacji przenosi do **Kosza** też jej wersje, a **Usuń na zawsze** je usuwa.

Gdy pamięć Historii się zapełni, najpierw usuwane są najstarsze automatyczne punkty kontrolne kreacji, których nie otwierałeś od 30 dni. Zapis jest zawsze zachowywany, nawet wtedy: zapisuje się jako bieżąca praca, a Historia podaje, że ten zapis nie jest zachowywany jako wersja. **Ustawienia → Pamięć** pokazuje, ile miejsca zajmuje Historia.

Strona **History** (`#/history`, albo **Open app history** w panelu) obejmuje każdą kreację w tej przeglądarce. Na komputerze otwórz stronę z przycisku zegara w prawym górnym rogu ekranu startowego albo **Projektów**. Na telefonie przejdź do galerii narzędzi na ekranie startowym, naciśnij okrągły przycisk z logo w prawym górnym rogu i wybierz **Zapisane sesje**, co otwiera History. Z **Projektów** ten element na razie nic nie robi.

- **Ostatnie** wymienia twoje kreacje, od najnowszej, z przyciskiem **Wznów**.
- **Changes** umieszcza checkpointy, pobrania i wyniki Convert na jednej osi czasu. Pobranie ma **Reopen settings**.
- **Milestones** wymienia nazwane wersje.

Filtruj według projektu, narzędzia i daty (na telefonie pod **Filters**). Strona History nie ma przycisku usuwania; aby usunąć element, użyj Projektów.
:::

## Przenieś swoją pracę na inne urządzenie

| Co | Użyj |
|---|---|
| Utrzymać urządzenia w zgodzie | **Synchronizacja między urządzeniami**, pod **Ustawienia → Połączone usługi**: zobacz [Synchronizuj swoje urządzenia](/info/sync.html) |
| Przenieść wszystko naraz | **Eksportuj moje dane** i **Importuj dane…**, poniżej |
| Przekazać jedną pracę albo jeden projekt | Plik `.lolly`: **Eksportuj**, potem **Udostępnij**, potem **Download .lolly**; dla całego projektu **Download project (.lolly)** w menu folderu. Naciśnij **Otwórz** na drugim urządzeniu. Zobacz [Plik .lolly](/info/using.html#the-lolly-file) |

Link udostępniania niesie twoje ustawienia, ale nie obrazy ani pliki, które dodałeś z urządzenia.

::: note Import niczego nie dodaje i nie usuwa
Foldery, ulubione i szablony z pliku są dodawane obok tych, które są już na drugim urządzeniu. Gdy zapisany element jest w obu miejscach, zachowywana jest kopia zapisana później. Twoje dane i ustawienia na tym urządzeniu pozostają takie, jakie są; puste są uzupełniane z pliku. **Przenieś to na to urządzenie**, w Synchronizacji, działa tak samo.
:::

Aby przenieść wszystko naraz:

1. Na starym urządzeniu otwórz **Ustawienia → Pamięć** i pod **Przenieś na inne urządzenie** naciśnij **Eksportuj moje dane**. Lolly pobiera jeden plik `.zip`, którego nazwa zaczyna się od `LollyTools-`.
2. Przenieś plik przez USB, e-mail do siebie, AirDrop albo folder współdzielony.
3. Na nowym urządzeniu otwórz **Ustawienia → Pamięć**, naciśnij **Importuj dane…**, wybierz plik i naciśnij **Importuj**.

::: note Co zostaje na miejscu
Logowania, klucze i hasło synchronizacji zostają na każdym urządzeniu. Lista ostatnich pobrań, pobrania offline i modele AI nie podróżują żadną drogą. Historia wersji podróżuje wyłącznie w pliku **Eksportuj moje dane**, nie przez Synchronizację ani plik `.lolly`. Gdy historia jest zbyt duża na jeden plik, najstarsze automatyczne punkty kontrolne są pomijane, a wiersz eksportu podaje ile. Kopię, którą Synchronizacja przechowuje w twojej pamięci, można pobrać i otworzyć albo wybrać w **Importuj dane…**, tak jak plik kopii zapasowej; zaszyfrowana kopia poprosi o twoje hasło.
:::

::: details Co zawiera plik kopii zapasowej
Plik nazywa się `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (części nazwy pochodzą z twojego profilu i są pomijane, gdy nie są ustawione; `<n>` to licznik dzienny, żeby eksporty z tego samego dnia się nie zderzały). Zawiera twój profil, z twoimi folderami, Koszem, szablonami i ulubionymi; każdą zapisaną sesję z jej miniaturą; twoje wgrane obrazy, fonty, logotypy i kopie twoich pobrań; twoje systemy projektowe; twoje preferencje (motyw, szerokość paska bocznego, lokalne statystyki aktywności); zapisane wersje i wyniki z Convert; a z aplikacji webowej - historię wersji twoich kreacji.

Pamięć podręczna katalogu nie jest dołączana - pobiera się sama na nowym urządzeniu. Każda część ma sumę kontrolną, więc plik uszkodzony w transporcie zostaje wychwycony przy imporcie, a nie przywrócony w połowie zepsuty. Zapisane sesje same podpinają się z powrotem do zaimportowanych obrazów. Aplikacja webowa, desktopowa i mobilna czytają ten sam plik; aplikacja terminalowa zapisuje własną, prostszą kopię zapasową, której ten format nie odczytuje. **📦 Eksportuj moje dane & wyrenderuj wszystko** tworzy ten sam plik plus drugi zip, w którym każda zapisana sesja jest wyrenderowana do swojego wyniku. (Pełna specyfikacja formatu: [Transfer danych](/info/data-transfer.html).)
:::

## Jeśli wyczyścisz dane przeglądarki

W aplikacji webowej Lolly przechowuje wszystko w pamięci przeglądarki dla tej witryny: zapisaną pracę, obrazy, fonty, systemy projektowe, historię wersji i pobrania offline. Wyczyszczenie danych tej witryny w twojej przeglądarce usuwa to wszystko, a Lolly nie może niczego z tego przywrócić. Zostaje to, co już opuściło przeglądarkę: pliki, które pobrałeś, plik **Eksportuj moje dane**, kopia [Synchronizacji](/info/sync.html) i linki, które udostępniłeś.

::: warning Zanim wyczyścisz dane przeglądarki
Naciśnij **Eksportuj moje dane** pod **Ustawienia → Pamięć** i zachowaj plik gdzie indziej.
:::

Gdy aplikacja się uruchamia, Lolly prosi przeglądarkę, aby nie czyściła jej pamięci, gdy na urządzeniu zabraknie miejsca. Decyduje przeglądarka. Pod **Ustawienia → Dostępne offline** wiersz zaczynający się od **Chronione** oznacza, że przeglądarka się zgodziła; „Przeglądarka może usunąć pobrania, jeśli na urządzeniu zabraknie miejsca” oznacza, że się nie zgodziła, a **Chroń pobrane pliki** pyta ponownie. Jeśli przeglądarka się nie zgodziła, może przy braku miejsca wyczyścić zarówno zapisaną pracę, jak i pobrania, więc trzymaj aktualny plik **Eksportuj moje dane**.

**Ustawienia → Pamięć** pokazuje, ile miejsca zajmuje każdy rodzaj danych. Jej wiersz **Historia** liczy automatyczne punkty kontrolne, ich podglądy i wersje robocze odzyskiwania; **Usuń automatyczne punkty kontrolne starsze niż 30 dni** zwalnia to miejsce i zachowuje zapisane oraz nazwane wersje. **Wyczyść pamięć podręczną** usuwa pobrane pliki katalogu, które pobiorą się ponownie, gdy będą potrzebne. **Wyczyść wszystkie moje dane** prosi cię o wpisanie słowa, wyłącza Synchronizację, a potem usuwa wszystko, co Lolly przechowuje w tej przeglądarce: twój profil i ustawienia, zapisane sesje wraz z ich historią i Koszem, przesłane pliki, fonty i systemy projektowe, dziennik pobrań, wyniki Convert, pobrane modele AI i kopie offline. Pliki, które pobrałeś, zostają tam, gdzie je zapisałeś. Aplikacja uruchamia się wtedy tak, jak przy pierwszej wizycie.

![Karta pamięci na ekranie o szerokości telefonu: nazwana każda kategoria danych na urządzeniu, a na dole przycisk Clear all my data](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

W aplikacjach desktopowych i mobilnych zapisane sesje to pliki we własnym folderze danych aplikacji, a reszta jest we własnej pamięci aplikacji, więc wyczyszczenie przeglądarki internetowej ich nie dotyka.

::: details Gdzie aplikacje desktopowe i mobilne przechowują zapisane sesje
Jeden plik na zapisaną sesję, w folderze `saved-state`:

- macOS: `~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows: `%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux: `~/.local/share/tools.lolly.Desktop/saved-state/`, albo ta sama ścieżka pod `$XDG_DATA_HOME`
- iPhone, iPad i Android: wewnątrz własnej pamięci aplikacji, której nie pokazuje aplikacja Files

Obrazy, systemy projektowe i lista ostatnich pobrań zostają w wewnętrznej pamięci aplikacji, nie w tych folderach. Aplikacja terminalowa i wiersz poleceń czytają ten sam folder `saved-state`: zobacz [Gdzie mieszkają zapisane sesje](/info/cli-reference.html#where-saved-sessions-live).
:::

## Odzyskaj coś, co usunąłeś

Usunięcie zapisanej sesji, folderu, jednego z przesłanych plików albo jednej z czcionek w aplikacji przenosi go do **Kosza** na 30 dni, niezależnie od tego, gdzie to usuniesz: **Projekty**, **Zasoby**, **Ustawienia → Pamięć** albo listę zapisanych sesji narzędzia. Folder trafia tam wraz ze wszystkim, co zawiera, jako jeden wpis, a sesja zachowuje swoją historię wersji, dopóki tam jest. Zaraz potem komunikat oferuje **Wycofaj**. Później:

1. Otwórz **Kosz**: kafelek **Kosz** w **Projektach**, przycisk **Kosz** w **Zasoby → Twoje pliki**, albo wiersz **Kosz** w **Ustawienia → Pamięć**. Wszystkie trzy otwierają tę samą listę.
2. Naciśnij **Przywróć** obok elementu. Wraca on do swojego folderu, a czcionka odzyskuje role, które miała w swoim systemie projektowym.

**Usuń na zawsze** usuwa jeden element na stałe. **Opróżnij kosz** najpierw pyta, a potem usuwa każdy element z Kosza. Elementy starsze niż 30 dni są usuwane na stałe.

::: warning Niektóre usunięcia są natychmiastowe
Usunięcie systemu projektowego, logotypu albo twojego zdjęcia profilowego nie trafia do Kosza. Wiersz poleceń i aplikacja terminalowa też usuwają od razu.
:::

Przy włączonej [Synchronizacji](/info/sync.html) **Restore an earlier copy** może przywrócić stan całego urządzenia z wcześniejszego dnia, a plik **Eksportuj moje dane** przywraca to, co zawiera plik.
