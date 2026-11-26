# Znajdowanie i odzyskiwanie pracy

Znajdź projekt, którego nigdy nie zapisałeś, pobrany plik, wersję z zeszłego tygodnia lub swoją pracę po wyczyszczeniu przeglądarki. Zacznij od tabeli.

Osobista praca pozostaje w przeglądarce lub aplikacji, w której powstała, na tym urządzeniu, chyba że włączysz [Sync](/info/sync.html). Organizacja korzystająca z opcjonalnego Lolly Work przechowuje też **Team projects** na swoim serwerze.

| Co zrobiłeś | Gdzie szukać |
|---|---|
| Nacisnąłeś **Save as** lub **Save** | **Projects** |
| Nacisnąłeś **Download** | Pobrane pliki przeglądarki i kopia w **Assets** |
| Żadnej z tych czynności, w [narzędziu, które zapisuje w trakcie pracy](#which-tools-save-as-you-work) | **Projects** i **History** |
| Żadnej z tych czynności, w narzędziu, które tego nie robi | Tylko karta, w której pracowałeś, dopóki jej nie zamkniesz |
| Usunąłeś element w aplikacji | **Trash** w **Projects**, **Assets** lub **Settings → Storage**, przez 30 dni |

::: figure find-your-work-places
Gdzie jest Twoja praca: pamięć przeglądarki przechowuje Projects, History i Trash; pobrane pliki trafiają do folderów urządzenia; Sync i plik kopii zapasowej to kopie poza przeglądarką.
:::

::: details Znajdowanie wspólnej pracy w Lolly Work (opcjonalnie)
Otwórz Lolly swojej organizacji, zaloguj się i zajrzyj do **Projects → Team projects**. Ta instancja przechowuje wspólne sesje i pokazuje te, do których masz dostęp. Zalogowanie się na innym urządzeniu może przywrócić dostęp do tych sesji. Logowanie nie przywraca Twojej osobistej biblioteki ani kopii zapasowej urządzenia.

W ramach [współpracy przez Lolly Work](/info/collaborate.html#collabs-through-lolly-work-optional) przed wyjściem poczekaj na **Saved to work**. Jeśli brakuje wspólnego projektu, sprawdź, czy jesteś połączony z właściwą instancją i zapytaj jej operatora o dostęp lub okres przechowywania. Wyczyszczenie danych przeglądarki usuwa kopie lokalne, ale nie kopię na serwerze organizacji. Zobacz [Korzystanie z Lolly w organizacji](/info/organisation.html).
:::

<!--i:eti-search-->
## Znajdź coś, co zapisałeś

1. Naciśnij **Home** w lewym górnym rogu narzędzia.
2. Otwórz kartę **Projects** u góry ekranu głównego (ikonę folderu na telefonie).
3. Wszystko, co zapisałeś w **My library**, jest na pierwszym ekranie. Każdy projekt to folder. Aby przeszukać wszystkie foldery, wpisz tekst w **Search all projects…** u dołu ekranu.

Element przyjmuje nazwę pliku wpisaną w panelu eksportu. Jeśli jej nie podasz, przyjmuje nazwę narzędzia, na przykład **QR Code**. Otwarcie elementu przywraca wszystkie ustawienia. Aby zapisać nową pracę, zobacz [Zapisywanie i wznawianie](/info/using.html#saving-continuing).

::: note Nie ma w Projects?
- Może być w **Trash**: zobacz [Odzyskaj coś, co usunąłeś](#get-back-something-you-deleted).
- Inna przeglądarka, okno prywatne lub inne urządzenie zaczyna od pustego stanu, chyba że używasz [Sync](/info/sync.html) lub [przeniesiesz swoją pracę](#move-your-work-to-another-device).
- Jeśli nacisnąłeś tylko **Download**, zobacz [Znajdź pobrany plik](#find-a-file-you-downloaded).
:::

::: details Praca z Projects
Widok **Projects** możesz też otworzyć z **Settings → Storage → Saved sessions → Organise in Projects**. Działa jak menedżer plików:

![Projects przed zapisaniem czegokolwiek: kafelki New folder, New asset i Templates, zegar History w prawym górnym rogu i pasek Search all projects u dołu](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **Zagnieżdżone foldery.** Umieszczaj zapisane sesje w folderach, a foldery w innych folderach, na dowolną głębokość. Utwórz folder lub zmień jego nazwę albo przeciągnij kafelek na folder, aby go przenieść. Ścieżka nawigacji pozwala wrócić wyżej. Sesje zapisane bez folderu znajdują się w katalogu głównym **Projects**.
- <!--i:clock--> **Sortuj po swojemu.** **View options**, przycisk z suwakami w prawym górnym rogu, oferuje **Grid** lub **List** oraz sortowanie według **Name**, **Date added**, **Last modified** (domyślnie), **Size**, a wewnątrz folderu także **By tool**. Foldery są zawsze pierwsze. Sesje i foldery są sortowane osobno w swoich grupach.
- <!--i:document--> **Zapisuj nową pracę od razu na miejscu.** **New asset** otwiera wspólny selektor. Wybierz **Templates**, aby zacząć od zapisanego szablonu. Otwórz szablon do edycji lub naciśnij **+ Add**, aby od razu zapisać nową pracę.
- <!--i:checklist--> **Zaznaczanie wielu elementów (komputer).** Zaznacz pole wyboru na kafelku, przeciągnij prostokąt zaznaczenia po pustym miejscu lub użyj **Shift/Cmd-click**. Aby otworzyć menu kontekstowe kafelka, **kliknij go prawym przyciskiem**. Pasek zaznaczenia oferuje **Render selection**, **Move to…**, **New folder** i **Delete** (do Trash). **Edit together** otwiera od dwóch do ośmiu sesji pojedynczych narzędzi obok siebie ze wspólnym panelem bocznym. **Edit as sheet** otwiera zaznaczenie o dowolnej wielkości i składzie jako wiersze w siatce przetwarzania wsadowego.
- <!--i:download--> **Renderuj cały folder lub zaznaczenie.** **Render folder** eksportuje każdą zapisaną sesję z folderu i jego podfolderów jako jeden `.zip` z zachowaniem struktury folderów. **Render selection** robi to samo dla wielu zaznaczonych elementów. Pojedyncza sesja jest renderowana do osobnego pliku.
- <!--i:link--> **Przejdź wprost do zapisanej pracy danego narzędzia.** Zaznacz jedno lub więcej narzędzi w galerii Tools i wybierz **View sessions** z paska zaznaczenia. Projects pokazuje wtedy tylko sesje utworzone tymi narzędziami. **Clear** przywraca pełny widok.
- <!--i:link--> **Udostępnij zapisaną sesję.** Kliknij sesję prawym przyciskiem (na telefonie naciśnij **•••** na jej kafelku) i wybierz **Share link**. Link otwiera sesję z tymi samymi ustawieniami. Obrazy z Twojego urządzenia nie są przesyłane z linkiem. Pełne okno Share opisuje [Udostępnianie pracy](/info/using.html#sharing-your-work).
- <!--i:pentool--> **Zmień nazwę lub utwórz kopię.** To samo menu ma **Rename**, **Duplicate** (kopia w tym samym folderze) i **Move to…**.

![Okienko View options w Projects: Layout z Grid i List oraz Sort by ustawione na Last modified, obok przycisku odwracającego kolejność](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
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

<!--i:eti-refresh-->
## Jeśli zamknąłeś kartę lub opuściłeś narzędzie

To, co wróci, zależy od sposobu wyjścia i od narzędzia:

- **Zamknąłeś kartę lub wróciłeś innym razem.** Niezapisana praca przepada, z wyjątkiem [narzędzi, które zapisują w trakcie pracy](#which-tools-save-as-you-work). Otwórz tę pracę z **Projects**.
- **Przeładowałeś stronę w tej samej karcie.** Ustawienia wracają z adresu strony. W narzędziach, które nie zapisują w trakcie pracy, adres nie przechowuje obrazów i plików z Twojego urządzenia ani tekstu jednowierszowego dłuższego niż 150 znaków, więc te elementy nie wracają.
- **Nacisnąłeś Home lub przycisk wstecz w lewym górnym rogu.** Jeśli coś zmieniłeś od ostatniego zapisu, pobrania lub skopiowania, okno **Unsaved edits** pyta, czy najpierw zapisać. **Save & leave** zapisuje pracę i przenosi Cię do **Projects** lub z powrotem do folderu projektu, z którego ją otworzyłeś. **Leave anyway** odrzuca Twoje zmiany. Zapisany element wraca do ostatniego zapisu, a praca, której nigdy nie zapisałeś, znika z **Projects**. **Cancel** pozostawia Cię w narzędziu.

::: warning Zamknięcie karty nie pyta o potwierdzenie
Zamknięcie karty, przeładowanie i przycisk Wstecz przeglądarki nigdy nie pytają. Dla pewności przed opuszczeniem narzędzia naciśnij **Save as** lub **Save** w panelu eksportu.
:::

Gdy automatyczne odzyskiwanie jest niedostępne, notatka obok kontrolek edycji mówi, co zachować:

- W narzędziu pracującym na dostarczonym przez Ciebie pliku zapisz ustawienia i zachowaj też oryginalne pliki.
- W narzędziu do nagrywania lub narzędziu pomocniczym bez akcji Save zapisz lub pobierz wynik przed wyjściem.
- Aplikacje komputerowe i mobilne informują, kiedy musisz zapisać ręcznie.
- W prywatnej współpracy osoba zapraszająca przechowuje dokument i jego historię, w tym zmiany drugiej osoby. Osoba, która dołączyła, pracuje na tymczasowej kopii i powinna zapisać osobną kopię przed końcem sesji.

::: note Opuściłeś narzędzie bez zapisywania przez pomyłkę?
W narzędziach, które zapisują w trakcie pracy, History przechowuje kopię odrzuconych zmian przez 30 dni. Otwórz stronę **History**, znajdź je w **Changes** i naciśnij **Open as a copy**. W innych narzędziach zmiany przepadają.
:::

::: details Które narzędzia zapisują w trakcie pracy
W aplikacji internetowej każde narzędzie tworzące dokument zapisuje w trakcie pracy, na przykład Lolly Design, Lolly Chart, QR Code, Text i Lolly Sandbox. Nie robią tego:

- narzędzia pracujące na dostarczonym przez Ciebie pliku, takie jak Redact, Sign lub Convert Image, ponieważ Lolly nigdy nie przechowuje kopii tego pliku;
- narzędzia nagrywające z kamery, mikrofonu lub ekranu, takie jak Record, Lolly Screen Capture i Lolly Voice Recorder;
- narzędzie, w którym nie ma nic do zmiany, takie jak Countdown.

W pozostałych narzędziach pierwsza zmiana umieszcza pracę w **Projects**, tak jakbyś ją zapisał. Kolejne zmiany są zachowywane, gdy narzędzie skończy rysować. Niezapisana praca pozostaje w Projects po zamknięciu karty i otwiera się ponownie ze zmianami oznaczonymi jako niezapisane.

**Leave anyway** nadal odrzuca te zmiany. Ponowne otwarcie narzędzia z ekranu głównego rozpoczyna nową pracę; wcześniejszą otwórz z Projects.

3D i Lolly Darkroom zapisują w trakcie pracy, ale nie przechowują wczytanego do nich pliku, takiego jak model 3D lub LUT. History i **Save** zachowują nazwę, typ i rozmiar pliku, ale nie sam plik. Po ponownym otwarciu pracy notatka wskazuje, o który plik chodzi, a narzędzie działa bez niego, dopóki go ponownie nie wczytasz. Zachowaj oryginalne pliki.

Przy włączonym [Sync](/info/sync.html) praca zapisana w ten sposób trafia na Twoje pozostałe urządzenia. Jej wersje pozostają na urządzeniu, na którym powstały.

Jeśli praca jest otwarta w dwóch kartach i zapiszesz ją w obu, zachowany zostanie ostatni zapis. Zastąpiona praca znajduje się w **Protected drafts** w jej History, z opcją **Open draft as a copy**.

Działa to tylko w aplikacji internetowej, nie w aplikacjach komputerowych ani mobilnych i nie podczas współpracy na żywo z inną osobą.
:::

<!--i:eti-download-->
## Znajdź pobrany plik

W przeglądarce **Download** przekazuje plik przeglądarce. Przeglądarka zapisuje go w folderze pobranych plików (zwykle **Downloads**) lub pyta o miejsce. Lolly nie otrzymuje informacji, dokąd trafił plik, więc zajrzyj na listę pobranych plików przeglądarki.

Jeśli plik się nie pojawił, zajrzyj do panelu eksportu, gdy nadal jesteś w narzędziu. Pod **Download** wiersz pokazuje nazwę pliku i czas oraz **Retry download**. W Chrome, Edge i innych przeglądarkach Chromium wiersz oferuje też **Save file…**, aby wybrać folder. Wiersz i jego plik pozostają do opuszczenia narzędzia, przeładowania lub kolejnego eksportu.

Po każdym pobraniu Lolly zachowuje też dwie rzeczy:

- **Kopię pliku** w **Assets**, w sekcji **Your uploads**, gdy **Save my renders to my library** jest włączone w **Settings → Your renders** (**Settings** jest u dołu ekranu głównego). To ustawienie jest domyślnie włączone. Wideo lub plik powyżej 50 MB najpierw wymaga potwierdzenia, a zip nie jest kopiowany.
- **Użyte ustawienia** dla ostatnich 24 pobrań. **Recent exports**, poniżej zapisanej pracy w **Projects**, otwiera ponownie narzędzie z tymi ustawieniami. Nie obejmuje to obrazów i plików dodanych z Twojego urządzenia. Ta sama lista jest w **Settings → Activity & stats → Latest exports** i na karcie **Changes** w **History**.

::: details W aplikacjach komputerowych i mobilnych
- **Aplikacja komputerowa:** **Download** zapisuje w folderze **Lolly** wewnątrz folderu **Downloads**, bez okna dialogowego. Wiersz pod **Download** pokazuje, dokąd trafił plik, na przykład „Zapisano w Downloads/Lolly”, z opcją **Show in folder**. **Open Exports Folder** w menu **Window** lub **Exports** otwiera ten folder w dowolnym momencie. Plik o takiej samej nazwie jak wcześniejszy jest zapisywany jako „name (1)”.
- **iPhone i iPad:** plik jest zapisywany w aplikacji **Files**, w **Lolly**, a panel udostępniania się otwiera. Wiersz pod **Download** pokazuje „Zapisano w Files → Lolly”.
- **Android:** otwiera się menu udostępniania. Wybierz, dokąd trafi plik.

Na iPhone, iPad i Android nowy plik zastępuje wcześniejszy plik o tej samej nazwie.
:::

<!--i:eti-history-->
## Wróć do wcześniejszej wersji

- **Podczas tej wizyty:** **Undo** cofa ostatnie 100 zmian, dopóki nie opuścisz narzędzia lub nie przeładujesz strony. Zobacz [Cofanie i ponawianie](/info/using.html#undo-and-redo).
- **W [narzędziach, które zapisują w trakcie pracy](#which-tools-save-as-you-work):** wcześniejsze wersje każdej pracy są zachowywane.
- **Wszystko na urządzeniu:** przy włączonym [Sync](/info/sync.html) opcja **Restore an earlier copy** w **Settings → Connected services** przywraca jedną z ostatnich siedmiu kopii dziennych lub kopię sprzed ostatniego zastosowania. Wszystko na tym urządzeniu odpowiada wtedy tej kopii.

Aby otworzyć wcześniejszą wersję:

1. Naciśnij **History**, przycisk z zegarem obok **Undo** i **Redo**. W Lolly Design **History** jest na górnym pasku. Na telefonie naciśnij **•••**, a potem **History**. W narzędziach bez **Undo**, takich jak Text i Lolly Sandbox, **History** jest obok **Home** w lewym górnym rogu.
2. Znajdź wersję według daty i godziny. Wiersze **Automatic checkpoint** powstają w trakcie pracy; wiersze **Saved version** odpowiadają momentom, w których zapisałeś pracę.
3. Naciśnij **Open as a copy**. Wersja otwiera się jako nowa praca, a wcześniej otwarta pozostaje bez zmian. Kopia jest w **Projects**, z „(copy)” po nazwie.

Aby zachować wersję pod nazwą, naciśnij **Name version**, wpisz nazwę i naciśnij **Keep milestone**. Nazwane wersje są wymienione na stronie **History**, w sekcji **Milestones**.

::: details Panel History i strona History
Panel **History** zawiera też wiersze **Recovered work**, a **Protected drafts** przechowuje ostatnie zmiany między punktami kontrolnymi, z opcją **Open draft as a copy**. **Lolly Compare** i **Check assets** pomagają wybrać przed otwarciem kopii. Przełącz **This creation** na **All history on this device**, aby zobaczyć wszystkie prace.

Z czasem pozostaje mniej automatycznych punktów kontrolnych: jeden na minutę z ostatniej godziny, jeden na godzinę z ostatniej doby, jeden dziennie przez 30 dni, a potem jeden tygodniowo. Wszystkie zapisane i nazwane wersje są zachowywane. Usunięcie pracy przenosi też jej wersje do **Trash**, a **Delete forever** je usuwa.

Gdy miejsce na History się zapełni, najpierw usuwane są najstarsze automatyczne punkty kontrolne prac, których nie otwierałeś od 30 dni. Nawet wtedy zapis jest zawsze zachowywany. Zostaje zapisany jako bieżąca praca, a History informuje, że ten zapis nie został zachowany jako wersja. **Settings → Storage** pokazuje, ile miejsca zajmuje History.

Strona **History** (`#/history`) obejmuje wszystkie prace w tej przeglądarce. Aby ją otworzyć, naciśnij przycisk z zegarem w prawym górnym rogu ekranu głównego lub **Projects**, wybierz **Saved sessions** w menu profilu (na telefonie okrągły przycisk z logo w prawym górnym rogu) lub naciśnij **Open app history** w panelu History narzędzia. Aplikacje komputerowe i mobilne nie mają strony History. Tam przycisk z zegarem na ekranie głównym i **Saved sessions** otwierają **Your recent work**: ostatnio zapisane sesje i eksporty, z linkiem do Projects.

- **Recent** pokazuje Twoje prace, od najnowszych, z opcją **Resume**.
- **Changes** umieszcza punkty kontrolne, pobrania i wyniki Convert na jednej osi czasu. Pobranie ma opcję **Reopen settings**.
- **Milestones** wymienia nazwane wersje.

Każda praca to kafelek z jej obrazem. **Grid** lub **List** przełącza układ. Filtruj według projektu, narzędzia i daty (na telefonie pod **Filters**). Menu kafelka (prawy przycisk myszy lub długie naciśnięcie) oferuje **Resume**, **Versions**, **Show in Projects** i **Move to Trash**. Aby usunąć kilka prac, zaznacz je i wybierz **Move to Trash**, które oferuje Undo.
:::

<!--i:eti-folder-move-->
## Przenieś swoją pracę na inne urządzenie

| Cel | Użyj |
|---|---|
| Synchronizowanie urządzeń | **Sync across devices** w **Settings → Connected services**: zobacz [Synchronizacja urządzeń](/info/sync.html) |
| Jednorazowe przeniesienie wszystkiego | **Export my data** i **Import data…**, poniżej |
| Przekazanie jednego projektu graficznego lub jednego projektu | Plik `.lolly`: **Export**, potem **Share**, potem **Download .lolly**; dla całego projektu **Download project (.lolly)** w menu folderu. Naciśnij **Open** na drugim urządzeniu. Zobacz [Plik .lolly](/info/using.html#the-lolly-file) |

Link udostępniania przenosi ustawienia, ale nie obrazy ani pliki dodane z Twojego urządzenia.

::: note Importowanie dodaje i niczego nie usuwa
Foldery, ulubione i szablony z pliku są dodawane do tych, które są już na drugim urządzeniu. Gdy zapisany element jest na obu, zachowywana jest kopia zapisana później. Twoje dane i ustawienia na tym urządzeniu pozostają bez zmian. Puste pola są uzupełniane z pliku. **Bring it to this device** w Sync działa tak samo.
:::

Aby jednorazowo przenieść wszystko:

1. Na starym urządzeniu otwórz **Settings → Storage** i w sekcji **Move to another device** naciśnij **Export my data**. Lolly pobiera jeden plik `.zip`, którego nazwa zaczyna się od `LollyTools-`.
2. Przenieś plik przez USB, e-mail do siebie, AirDrop lub folder współdzielony.
3. Na nowym urządzeniu otwórz **Settings → Storage**, naciśnij **Import data…**, wybierz plik i naciśnij **Import**.

::: note Co pozostaje na urządzeniu
Dane logowania, klucze i hasło synchronizacji pozostają na każdym urządzeniu. Lista ostatnich pobrań, zasoby pobrane do pracy offline i modele AI nie są przenoszone żadną metodą. Historia wersji jest przenoszona tylko w pliku **Export my data**, nie przez Sync ani `.lolly`. Gdy historia jest za duża na jeden plik, najstarsze automatyczne punkty kontrolne są pomijane, a wiersz eksportu podaje ich liczbę. Możesz pobrać i otworzyć kopię, którą Sync przechowuje w Twojej pamięci, lub wybrać ją w **Import data…**, jak plik kopii zapasowej. Zaszyfrowana kopia wymaga podania hasła.
:::

::: details Co zawiera plik kopii zapasowej
Plik ma nazwę `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`. Części nazwy pochodzą z Twojego profilu i są pomijane, jeśli ich nie ustawiono. `<n>` zlicza eksporty wykonane tego samego dnia. Plik zawiera Twój profil wraz z folderami, Trash, szablonami i ulubionymi; każdą zapisaną sesję z miniaturą; przesłane obrazy, czcionki, logo i kopie pobranych plików; systemy projektowe; preferencje (motyw, szerokość panelu bocznego, lokalne statystyki aktywności); zapisane wersje i wyniki Convert oraz, z aplikacji internetowej, historię wersji Twoich prac.

Pamięć podręczna katalogu nie jest dołączana. Nowe urządzenie pobiera ją ponownie. Każda część ma sumę kontrolną, więc import wykrywa plik uszkodzony podczas przesyłania. Zapisane sesje ponownie łączą się z zaimportowanymi obrazami. Aplikacje internetowe, komputerowe i mobilne odczytują ten sam plik. Aplikacja terminalowa zapisuje własną, prostszą kopię zapasową, której ten format nie odczytuje. **Export my data & render everything** tworzy ten sam plik i drugi zip z każdą zapisaną sesją wyrenderowaną do formatu wyjściowego. Pełny format opisuje [Przenoszenie danych](/info/data-transfer.html).
:::

<!--i:eti-globe-->
## Jeśli wyczyścisz dane przeglądarki

W aplikacji internetowej Lolly przechowuje wszystko w pamięci przeglądarki dla tej witryny: zapisaną pracę, obrazy, czcionki, systemy projektowe, historię wersji i zasoby pobrane do pracy offline. Wyczyszczenie danych tej witryny w przeglądarce usuwa to wszystko i Lolly nie może niczego przywrócić. Pozostaje to, co już opuściło przeglądarkę: pobrane pliki, plik **Export my data**, kopia [Sync](/info/sync.html) i udostępnione linki.

::: warning Zanim wyczyścisz dane przeglądarki
Naciśnij **Export my data** w **Settings → Storage** i zachowaj plik w innym miejscu.
:::

Przy uruchamianiu aplikacji Lolly prosi przeglądarkę, aby nie czyściła jego pamięci, gdy na urządzeniu brakuje miejsca, a przeglądarka podejmuje decyzję. W **Settings → Available offline** wiersz zaczynający się od **Protected** oznacza, że przeglądarka się zgodziła. „Przeglądarka może usunąć pobrane zasoby, jeśli na urządzeniu zabraknie miejsca” oznacza, że się nie zgodziła, a **Protect downloads** ponawia prośbę.

Jeśli przeglądarka się nie zgodziła, przy braku miejsca może usunąć zarówno zapisaną pracę, jak i pobrane zasoby, więc zachowaj aktualny plik **Export my data**.

**Settings → Storage** pokazuje, ile miejsca zajmuje każdy rodzaj danych. Wiersz **History** zlicza automatyczne punkty kontrolne, ich podglądy i wersje robocze do odzyskania. **Remove automatic checkpoints older than 30 days** zwalnia to miejsce i zachowuje zapisane oraz nazwane wersje. **Clear cache** usuwa pobrane pliki katalogu, które pobiorą się ponownie w razie potrzeby. **Clear all my data** prosi o wpisanie słowa, wyłącza Sync, a potem usuwa wszystko, co Lolly przechowuje w tej przeglądarce: profil i ustawienia, zapisane sesje z historią i Trash, przesłane pliki, czcionki i systemy projektowe, dziennik pobrań, wyniki Convert, pobrane modele AI i kopie offline. Pobrane przez Ciebie pliki zostają tam, gdzie je zapisałeś. Aplikacja uruchamia się potem jak przy pierwszej wizycie.

![Karta pamięci na ekranie o szerokości telefonu: nazwane wszystkie kategorie danych na urządzeniu, z przyciskiem Clear all my data u dołu](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

W aplikacjach komputerowych i mobilnych zapisane sesje są plikami we własnym folderze danych aplikacji, a wszystko inne znajduje się w jej własnej pamięci. Wyczyszczenie przeglądarki internetowej ich nie narusza.

::: details Gdzie aplikacje komputerowe i mobilne przechowują zapisane sesje
Jeden plik na zapisaną sesję, w folderze `saved-state`:

- macOS: `~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows: `%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux: `~/.local/share/tools.lolly.Desktop/saved-state/` lub ta sama ścieżka w `$XDG_DATA_HOME`
- iPhone, iPad i Android: we własnej pamięci aplikacji, której aplikacja Files nie pokazuje

Obrazy, systemy projektowe i lista ostatnich pobrań pozostają w wewnętrznej pamięci aplikacji, nie w tych folderach. Aplikacja terminalowa i wiersz poleceń odczytują ten sam folder `saved-state`: zobacz [Gdzie są przechowywane zapisane sesje](/info/cli-reference.html#where-saved-sessions-live).
:::

<!--i:eti-trash-->
## Odzyskaj coś, co usunąłeś

Usunięcie w aplikacji zapisanej sesji, folderu, jednego z przesłanych plików lub jednej z Twoich czcionek przenosi ten element do **Trash** na 30 dni, niezależnie od tego, gdzie go usuniesz: w **Projects**, **Assets**, **Settings → Storage** lub na liście zapisanych sesji narzędzia. Folder z całą zawartością trafia do Trash jako jeden wpis. Sesja zachowuje historię wersji w Trash. Zaraz po usunięciu komunikat oferuje **Undo**. Później:

1. Otwórz **Trash**: kafelek **Trash** w **Projects**, przycisk **Trash** w **Assets → Your uploads** lub wiersz **Trash** w **Settings → Storage**. Wszystkie trzy otwierają tę samą listę.
2. Naciśnij **Restore** obok elementu. Wraca on do swojego folderu, a czcionka odzyskuje role, które miała w swoim systemie projektowym.

**Delete forever** usuwa jeden element na stałe. **Empty Trash** najpierw pyta o potwierdzenie, a potem usuwa wszystkie elementy z Trash. Elementy starsze niż 30 dni są usuwane na stałe.

::: warning Niektóre elementy są usuwane natychmiast
Usunięty system projektowy, logo lub zdjęcie profilowe nie trafia do Trash. Wiersz poleceń i aplikacja terminalowa również usuwają od razu.
:::

Przy włączonym [Sync](/info/sync.html) **Restore an earlier copy** może przywrócić stan całego urządzenia z wcześniejszego dnia, a plik **Export my data** przywraca to, co zawiera.
