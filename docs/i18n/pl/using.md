# Korzystanie z Lolly

Otwórz narzędzie, zmień dostępne ustawienia, zapisz wynik i udostępnij go linkiem lub jako plik.

Wszystko działa na Twoim urządzeniu bez konta, również offline po pobraniu potrzebnych narzędzi i zasobów. Do uruchomienia potrzebna jest przeglądarka lub aplikacja z WebGPU. [Obsługiwane środowiska](/info/supported-environments.html) wymieniają te przetestowane.

**Cykl pracy** w czterech krokach:

::: steps
- <!--i:eti-home--> **[Otwórz narzędzie](#find-your-way-around)** Kliknij kartę na ekranie głównym. Obok podglądu na żywo są kontrolki.
- <!--i:eti-sliders--> **[Zmień dane wejściowe](#change-what-the-tool-lets-you-change)** Tylko te, które autor pozostawił dostępne. Kliknij projekt, aby znaleźć jego kontrolkę.
- <!--i:eti-folder-plus--> **[Zapisz pracę](#saving-continuing)** **Save** zachowuje ją w My library, a Projects pozwala ją ponownie otworzyć.
- <!--i:eti-link--> **[Udostępnij projekt](#sharing-your-work)** Link zawierający wszystkie dane wejściowe lub jeden plik `.lolly`.
:::

<!--i:eti-home-->
## Zorientuj się w aplikacji

::: figure using-app-map
Ekran główny ma cztery karty u góry i pasek u dołu. W otwartym narzędziu kontrolki są obok podglądu na żywo.
:::

U góry ekranu głównego są cztery karty: **Tools**, **Utilities**, **Assets** i **Projects**. Tools służą do tworzenia. Utilities konwertują, sprawdzają lub porządkują plik. Assets to Twoja biblioteka. Projects przechowuje zapisane prace.

Na dolnym pasku są **Open**, **Settings**, pole wyszukiwania, skrót **Verify** do Lolly Verify oraz **Docs**, które otwiera te przewodniki. Pasek jest widoczny w Tools, Utilities, Assets, Projects, Settings i przewodnikach w aplikacji, a znika po otwarciu narzędzia. [Lolly Search](/info/search.html) wyszukuje z tego pola Twoje narzędzia, zapisane prace, zasoby i ustawienia. [Ask Lolly](/info/ask.html) odpowiada na wpisane pytanie pasującą sekcją tych przewodników.

Kliknij kartę, aby rozpocząć nową pracę w danym narzędziu. Zapisane prace otwierasz ponownie w **Projects**. Przy pierwszej wizycie pas powitalny u góry galerii oferuje jedną akcję na początek: **Start making** w Lolly Demo lub **Make it yours**, aby skonfigurować własny system projektowy.

![Karta galerii z nawigacją po przykładach i akcją New](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Każde narzędzie ma widok podzielony: **kontrolki** z jednej strony i **podgląd** na żywo z drugiej. Podgląd aktualizuje się przy zmianie kontrolki, a eksport zawiera to, co widzisz.

![Widok podzielony narzędzia - stos kontrolek po lewej i rysowany na żywo grupowany wykres słupkowy po prawej](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Lolly Design** jest wyjątkiem: to swobodna kanwa boksów, które przeciągasz, zmieniasz im rozmiar i wpisujesz w nie tekst, z osobnym górnym paskiem, osią czasu i kontrolkami prezentacji. Jego przewodnikiem jest [Lolly Design: swobodna kanwa](/info/design.html).

<!--i:eti-sliders-->
## Zmieniaj to, na co pozwala narzędzie

Narzędzie pokazuje tylko dane wejściowe przeznaczone do zmiany. Autor ustalił kolory, układ, typografię i logikę, więc Twoja praca jest zgodna z jego regułami. Dane wejściowe obejmują tekst, suwaki, selektory kolorów, listy rozwijane, daty, selektory obrazów i powtarzalne grupy wierszy. Niektóre znajdują się w zwijanych sekcjach.

![Stos kontrolek narzędzia - pole tekstowe, przyciski kolorów i suwak, bez pozostałych elementów, które autor postanowił zablokować](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Kliknij projekt, aby znaleźć jego kontrolkę.** Kliknięcie elementu w podglądzie przewija widok do jego kontrolki i ustawia na niej fokus. W powtarzalnej grupie wierszy rozwija się kliknięty wiersz.

**Clear changes** nad kontrolkami przywraca domyślne wartości wszystkich danych wejściowych.

**Wybory systemu projektowego.** Jeśli system projektowy oferuje kilka wariantów kolorystycznych, jasny i ciemny wygląd lub inne opcje motywu, znajdziesz je w sekcji **Design system** pod kontrolkami. Opcja pojawia się tylko wtedy, gdy wpływa na dane narzędzie, więc narzędzie do plików nie pokazuje tej sekcji. Każdy wariant kolorystyczny to kropka w jego kolorach, jasny i ciemny wygląd to dwa przyciski, a pozostałe opcje mają postać listy.

Wybór dotyczy tej pracy. Jest zapisany w linku i zachowanej sesji. Każdy kolor powiązany z systemem projektowym dostosowuje się do wyboru, a kolory samej aplikacji pozostają bez zmian. Lolly Design udostępnia te same opcje na karcie **Canvas** w Inspectorze. Narzędzie, którego kolory są jego treścią, może pozostać przy kanonicznym wariancie kolorystycznym i nie pokazywać wtedy kropek wariantów. [Lolly Demo w użyciu](/info/lolly-demo-in-use.html#colourways-on-real-work) pokazuje warianty kolorystyczne w prawdziwych pracach. Aby użyć jednego wariantu w aplikacji i każdej nowej pracy, wybierz go w **Settings → Appearance** ([Dostosuj wariant kolorystyczny do siebie](/info/colourways.html#make-a-colourway-your-own)).

### Powiększaj i przesuwaj podgląd

- **Powiększanie:** Cmd/Ctrl i przewijanie lub szczypnięcie na gładziku, względem wskaźnika. Z klawiatury `0` lub `Shift+1` dopasowuje wszystko, `1` lub `Shift+0` ustawia 100%, a `Shift+2` dopasowuje zaznaczenie. `+` / `−` zmieniają powiększenie wokół wskaźnika, gdy jest nad sceną, a w innym przypadku wokół środka.
- **Przesuwanie:** przytrzymaj **Space** i przeciągnij lub przeciągnij środkowym przyciskiem myszy. Zwykłe kliknięcia nadal służą do klikania części projektu.
- **Dotyk:** szczypnij, aby powiększyć, przeciągnij, aby przesunąć i stuknij dwukrotnie, aby dopasować.
- **HUD powiększenia:** przytrzymaj wir Lolly w rogu, aby rozwinąć `−`, **Fit** i `+`. Krótkie stuknięcie wiru nadal otwiera menu Twojego profilu.

W Lolly Design **Fit all** uwzględnia obszary robocze i luźne warstwy. Ręczne oddalanie może zejść poniżej 20%, aż strona wypełni połowę widoku. Dolna granica to mniejsza z dwóch wartości: 5% zwykłej skali Fit lub 2% powiększenia bezwzględnego.

Zmiana rozmiaru wyjściowego zawsze ponownie dopasowuje widok.

![HUD powiększenia rozwinięty z wiru w rogu kanwy - minus, Fit, plus, następnie przełączniki motywu i dźwięku oraz uchwyt do przesuwania](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### Cofaj i ponawiaj

**Cmd/Ctrl-Z** cofa krok, a **Cmd/Ctrl-Shift-Z** (lub **Cmd/Ctrl-Y**) przywraca go. Przyciski **Undo** i **Redo** są nad kontrolkami lub na górnym pasku w Lolly Design. Przycisk szarzeje, gdy nie ma już dostępnego kroku. Komunikat wskazuje, które dane wejściowe przywróciło cofnięcie, i zawiera przycisk **Redo**.

- **Przeciągnięcie to jeden krok.** Powtarzające się zmiany jednej kontrolki w ciągu pół sekundy łączą się w jeden krok.
- **Zachowywanych jest ostatnich 100 kroków.** Nowa zmiana po cofnięciu czyści stos ponawiania.
- **W polu tekstowym** Cmd/Ctrl-Z działa w tym polu, znak po znaku. Lolly obsługuje cofanie dla suwaków, list rozwijanych, kolorów i przełączników.
- **Wybór pliku** w polu pliku nie jest krokiem, ponieważ jego bajty są przechowywane tylko w tej sesji.

Podczas [współpracy](/info/collaborate.html) na żywo zmiana z drugiego urządzenia nigdy nie trafia na Twój stos cofania. Cofanie jest dostępne do opuszczenia narzędzia lub przeładowania. Starsze wersje w narzędziach zapisujących w trakcie pracy znajdziesz w **History** ([Wróć do wcześniejszej wersji](/info/find-your-work.html#go-back-to-an-earlier-version)).

### Kamera na żywo

Efekty narzędzia **Filter** (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art i Glitch) pokazują przycisk **Go live**, gdy dostępna jest kamera. Włącz go, a efekt będzie przetwarzać obraz z kamery internetowej klatka po klatce. Eksport animacji zapisuje wynik jako GIF, WebM lub MP4. Klatki są przetwarzane na Twoim urządzeniu. Kamera jest zwalniana, gdy tylko zatrzymasz działanie lub opuścisz narzędzie. Każdy selektor obrazu ma też opcję **Take a photo** do zrobienia pojedynczego zdjęcia.

<!--i:eti-folder-plus-->
## Zapisywanie i wznawianie

Aby zachować pracę, naciśnij **Save**, znacznik wyboru obok **Export** na pigułce renderowania. Nowa praca trafia do **My library**, wcześniej zapisana praca jest aktualizowana w tym samym miejscu i nic się nie pobiera. Ten sam przycisk **Save** jest też w panelu eksportu.

Aby wybrać miejsce zapisu, naciśnij **Save as** obok **Download** w panelu eksportu. W sekcji **Save to a project** pozostaw zaznaczone **My library** lub wybierz projekt (**＋ New project…** tworzy nowy), a potem naciśnij **Save**. Opcja **Save as a template** zapisuje projekt jako [szablon](/info/templates.html), punkt wyjścia dla nowych dokumentów. W Lolly Design opcja **Save as** jest w menu Lolly. Na telefonie naciśnij **•••**, potem **File menu**, a następnie **Save as**.

![Dwuczęściowa pigułka renderowania: Export ze strzałką w górę otwierającą panel eksportu oraz Save ze znacznikiem wyboru zapisującym w tym samym miejscu](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> Naciśnij **Save** na pigułce renderowania lub **Save as**, aby wybrać projekt.
- <!--i:folder--> Element trafia do **My library** lub do wybranego projektu.
- <!--i:home--> Później naciśnij **Home** w lewym górnym rogu i otwórz kartę **Projects**.
- <!--i:document--> Otwórz element. Wszystkie ustawienia są przywrócone, gotowe do zmiany i ponownego eksportu.
:::

Elementy otrzymują nazwę pliku wpisaną w panelu eksportu lub nazwę narzędzia, na przykład **QR Code**. Plik z **Download** to gotowa kopia. Aby później go zmienić, otwórz zapisany element w Projects.

::: note Zapisy pozostają na tym urządzeniu
Osobiste zapisy pozostają na tym urządzeniu, w przeglądarce lub aplikacji, z której je zapisano, chyba że włączysz [Sync](/info/sync.html).
:::

Jeśli czegoś nie ma w spodziewanym miejscu, [Znajdowanie i odzyskiwanie pracy](/info/find-your-work.html) opisuje każdy przypadek, od zamkniętej karty po wyczyszczone dane przeglądarki.

::: details Projekty zespołowe w Lolly Work (opcjonalnie)
Jeśli Twoja [organizacja korzysta z Lolly Work](/info/organisation.html), zaloguj się do jej instancji i otwórz **Projects → Team projects**, aby zobaczyć udostępnione Ci sesje. Organizacja ustala zasady dostępu i przechowywania, a jej usługa Lolly Work przechowuje te sesje. Gdy organizacja zezwala na edycję na żywo, otwarcie udostępnionej sesji dołącza Cię do trwającej w niej współpracy. [Wspólna praca](/info/collaborate.html#collabs-through-lolly-work-optional) opisuje kolejne kroki.

Twoja osobista biblioteka pozostaje oddzielna. Zalogowanie się na innym urządzeniu daje dostęp do pracy zespołowej. Przeniesienie osobistych zapisów nadal wymaga Sync lub kopii zapasowej.
:::

<!--i:eti-link-->
## Udostępnianie pracy

Udostępnij projekt jako link lub plik. Przycisk **Share** w kontrolkach eksportu otwiera okno z obiema opcjami. Opcja **Share link** przy zapisanej sesji w Projects otwiera to samo okno dla tej sesji. Po wysłaniu pliku do Google Drive, Nextcloud, zasobnika S3, Dropbox lub OneDrive okno może też utworzyć link za pośrednictwem tej usługi ([Eksport pliku](/info/exporting.html#how-export-works)).

::: cols
## Link

- Zawiera wszystkie dane wejściowe w adresie, więc link odtwarza projekt.
- Pomija obrazy i pliki dodane z tego urządzenia, bardzo długi tekst i bardzo duże listy.
- Otwiera się w dowolnej przeglądarce, więc możesz dodać link do zakładek, wkleić go lub zapisać w repozytorium.

## Plik .lolly

- Zawiera zapisaną sesję wraz z obrazami i plikami z tego urządzenia, a także może zawierać narzędzie i system projektowy.
- Pomija licencjonowane grafiki z katalogu, chyba że zdecydujesz się dołączyć ich pliki.
- Otwiera się w Lolly: kliknij go dwukrotnie, użyj **Open** lub upuść go na aplikację.
:::

### Link

Link znajduje się u góry okna, obok przycisków **Copy** i **QR**. Ten drugi otwiera narzędzie QR Code z tym linkiem. Pod linkiem sekcja **Link options** zawiera:

- **Open in the installed app** zmienia link na adres `lolly://` do użycia w Shortcuts, programach uruchamiających i automatyzacji, zachowując wszystkie parametry.
- **Shortest link** pakuje długi projekt w zwięzły token i pokazuje, o ile znaków go skrócono. Czytelna postać pozostaje dostępna.
- **Password-protect this link** szyfruje link na Twoim urządzeniu za pomocą AES-256. Hasło nigdy nie jest częścią linku.
- **Pin this tool version** dodaje flagę `_v`, aby późniejsza aktualizacja narzędzia nie zmieniła tego, co renderuje link.
- **When the recipient opens the link…** pozwala wybrać pełny ekran, rozwinięty panel eksportu, pobranie przy otwarciu (`&export`) lub skopiowanie do schowka (`&copy`).
- **Copy credit** kopiuje podpis „Utworzono w Lolly” z linkiem, do wpisu lub slajdu.

Gdy narzędzie zawiera pola z danymi osobowymi, takimi jak imię i nazwisko, **Review personal fields** pomija każde z nich w linku, dopóki go nie zaznaczysz. [Tryb URL](/info/url-mode.html) opisuje wszystko, co może zawierać link.

**Okno informuje, czego link nie może zawierać.** Tworząc link, Lolly zlicza wszystko, co nie mieści się w adresie. Jeśli coś pominięto, okno wymienia pominięte elementy i wskazuje opcję pliku. Link, który jest jedynie długi, otrzymuje łagodniejszą uwagę z liczbą znaków.

**W niektórych narzędziach link jest całym produktem.** Jump Page zbiera Twoje linki na jednej stronie do udostępniania: jako link w biogramie, prezentację lub witrynę sklepu. Strona jest linkiem, więc nie wymaga hostingu ani konta. Odwiedzający widzi stronę na pełną szerokość, po jednym linku na scenę podczas przewijania.

![Jump Page w edytorze: scena z nagłówkiem u góry strony i sceny z linkami poniżej](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Linki zarządzane przez organizację w Lolly Work
Gdy udostępnianie wymaga terminu wygaśnięcia, możliwości unieważnienia lub hasła, Lolly Work oferuje zarządzane linki do udostępnionych sesji, narzędzi i zasobów katalogu. Działają przez usługę organizacji i podlegają jej zasadom dostępu. Są oddzielne od samodzielnych linków opisanych powyżej. Unieważnienie linku nie odbierze pliku, który ktoś już pobrał. [Renderowanie i udostępnianie](/info/manage/sharing.html) wymienia typy linków i uprawnienia.
:::

### Plik .lolly

**Download .lolly** w sekcji **Editable file** okna Share zapisuje bieżący projekt jako jeden plik. Zwykłe grafiki z katalogu trafiają do niego wraz z obrazami i plikami z tego urządzenia. Nieaktualny lub niedostępny plik pozostaje jako odwołanie zewnętrzne. Przed zapisem okno pokazuje rozmiar pliku, liczbę osadzonych plików, liczbę odwołań do plików oraz informację, czy dołączono narzędzie. Jeśli urządzenie ma systemowy panel udostępniania, **Send to…** przekazuje do niego plik (AirDrop, udostępnianie w Androidzie).

**Download project (.lolly)** w menu folderu w **Projects** zapisuje cały folder, aby ktoś inny mógł kontynuować pracę z każdą sesją w tym folderze. Sesje wsadowe są pomijane, a komunikat podaje ich liczbę. **Download originals** w tym samym menu zapisuje zwykłe archiwum zip, w którym każdy element jest osobnym plikiem.

Przed wysłaniem pliku decydujesz o trzech rzeczach:

- **Czy dołączyć Twoje dane.** Imię i nazwisko, e-mail i organizacja są zapisywane tylko wtedy, gdy w [Twoim profilu](/info/profile.html) włączone jest **Use my details to create**. Gdy ta opcja jest wyłączona, plik zapisuje jedynie informację, że powstał w Lolly i kiedy.
- **Czy dołączyć pomijane grafiki.** Licencjonowane grafiki i grafiki z blokadą marki są domyślnie pomijane, podobnie jak prace z katalogu, których zapisanej licencji Lolly nie potrafi jeszcze odczytać. Jeśli projekt ich używa, okno podaje ich liczbę i oferuje *Download without them* lub *Include and download*. Dołączenie ich udostępnia pliki każdemu, kto otworzy `.lolly`. Praca z katalogu bez zapisanych informacji o prawach jest dołączana, a okno wymienia każdą z nich, aby można ją było sprawdzić przed wysłaniem. Plik `CREDITS.txt` wymienia dołączone i pominięte elementy wraz z przyczyną. [Prawa do twórczości i informacje o autorstwie](/info/creative-rights.html) wyjaśnia zasady.
- **Czy dołączyć narzędzie.** **Include the tool** pakuje pliki samego narzędzia, dzięki czemu projekt otworzy się na urządzeniu bez tego narzędzia. Opcja jest domyślnie zaznaczona dla niestandardowego narzędzia, takiego jak fork, i niezaznaczona dla narzędzia z podpisanego katalogu. W kompilacji bez podpisanego katalogu każde narzędzie jest uznawane za niestandardowe.

**Otwieranie pliku.** W aplikacjach na komputery i urządzenia mobilne kliknij dwukrotnie lub dotknij pliku `.lolly`, wybierz **Open with Lolly** lub wyślij go do Lolly z systemowego panelu udostępniania. W aplikacji internetowej naciśnij **Open** lub upuść plik na Lolly. Każda z tych metod najpierw odczytuje manifest pliku i pokazuje jego rozmiar, zawartość i planowane działania, zanim cokolwiek zostanie zapisane.

::: warning Instalacja narzędzia uruchamia jego kod
Jeśli plik zawiera narzędzie, którego nie masz, okno **Trust this tool?** pokazuje narzędzie i jego autora oraz informuje, że otwarcie uruchomi kod narzędzia na Twoim urządzeniu. **Trust & install** zatwierdza tę czynność.
:::

Jeśli odmówisz, praca i tak zostanie zapisana w Projects i poczeka, aż dodasz narzędzie. Narzędzia, którego kod jest dostarczany jako moduł, nie można jeszcze zainstalować w ten sposób i jest ono odrzucane tak samo.

::: details Co zawiera plik .lolly i jak działa jego otwieranie
`.lolly` to rozszerzenie pakietów Lolly, a pole `format` w pliku `manifest.json` określa zawartość:

- **Udostępniony projekt graficzny** (`lolly-share`) zawiera jedną zapisaną sesję, osadzone w niej pliki i potwierdzenie dla wszystkiego, co nadal jest dostępne przez odwołanie. Może też zawierać narzędzie i system projektowy. Otwarcie dodaje nowy projekt i nigdy nie nadpisuje sesji.
- **Udostępniony projekt** (`lolly-share`, rodzaj `project`) zawiera folder z Projects: jego podfoldery, każdą sesję w nich wraz z jej kafelkiem i zapisane tam obrazy. Otwarcie dodaje kopię folderu. Każda sesja jest przenoszona jako `sessions/<key>.json`, a jej kafelek znajduje się w `thumbs/`. Wersja Lolly sprzed wprowadzenia plików projektów prosi o aktualizację.
- **Pakiet systemu projektowego** (`lolly-brand`) zawiera tokeny i może zawierać czcionki, logo, opublikowane wersje i zachowane zasoby. Otwarcie pakietu dodaje oddzielny, nazwany system projektowy i go aktywuje.
- **Pakiet przestrzeni roboczej lub instancji** to `lolly-brand` z zadeklarowanymi narzędziami, zasobami katalogu i opcjonalnym adresem instancji. Wczytanie zastępuje jedyną wcześniej wczytaną nakładkę przestrzeni roboczej, a podgląd wymienia te skutki dla całego urządzenia.

Pełna kopia zapasowa urządzenia nie jest plikiem `.lolly`. Pozostaje plikiem `LollyTools-….zip` (format `lolly-backup`) i jest przywracana przez **Settings → Storage → Import data…**. Spakowany folder narzędzia również pozostaje plikiem `.zip`. [Przenoszenie danych](/info/data-transfer.html) opisuje formaty.

Plik `.lolly` to zwykłe archiwum zip. Zmień rozszerzenie na `.zip`, aby zajrzeć do środka. Twoje obrazy znajdują się w `assets/uploads/`, a grafiki z katalogu w `assets/catalog/`. Plik `manifest.json` wymienia wszystkie pliki, a README wyjaśnia, czym jest ten plik.

macOS, Windows, Linux, iOS i Android rejestrują ten format. Menedżery plików na komputerach pokazują go jako dokument Lolly, a GNOME Files może wyświetlać własną miniaturę zapisanej sesji. Otwarcie w Lolly Design System Setup zaleca działanie dotyczące systemu projektowego, jeśli udostępniony projekt go zawiera, ale nigdy nie ukrywa **Open shared design**.

W iOS i Androidzie dokument przekazywany z innej aplikacji ma limit 48 MB, o czym aplikacja informuje. Przekazanie kopiuje jego bajty między aplikacjami. **Open** wewnątrz Lolly nie ma takiego limitu, więc użyj tej opcji dla większego pakietu.

Po zatwierdzeniu Lolly jednorazowo rozpakowuje i weryfikuje pakiet. Zasoby trafiają do Twojej biblioteki i są dopasowywane według sumy kontrolnej, więc plik obecny już na urządzeniu jest używany ponownie. Sesje trafiają do Projects z nowymi identyfikatorami, dzięki czemu ten sam plik można otworzyć dwa razy. Sesja, której narzędzia brakuje, czeka tam na nie. Pliki powyżej 100 MB są oznaczane jako duże, a podgląd ostrzega, gdy pamięć przeglądarki zgłasza mniej wolnego miejsca, niż potrzeba na plik. Każda część objęta kontrolą integralności jest sprawdzana przed zatwierdzeniem jakichkolwiek zmian, a uszkodzona kopia jest odrzucana bez pozostawiania śladów.
:::

Zarówno link, jak i plik przekazują stan z chwili zapisu. Jeśli potrzebujesz edycji na żywo, [Wspólna praca](/info/collaborate.html) opisuje prywatną współpracę między dwoma urządzeniami i opcjonalną współpracę służbową przez Lolly Work.

<!--i:eti-images-->
## Zasoby - Twoja biblioteka

**Lolly Assets** (`#/a`) zawiera to, z czego mogą korzystać Twoje narzędzia: logo marki, obrazy, dźwięk i animacje pogrupowane według rodzaju oraz Twoje własne pliki. Dodane przez Ciebie pliki są przechowywane na Twoim urządzeniu. Organizacja korzystająca z Lolly Work może też udostępnić wspólny katalog na własnych zasadach dostępu ([Korzystanie z Lolly w organizacji](/info/organisation.html)).

![Assets z próbkami kolorów i czcionkami marki oraz Twoimi plikami](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Dodaj swoje pliki.** Upuść obraz, SVG, klip audio, wideo, Lottie, PDF lub prezentację PowerPoint na obszar dodawania plików albo kliknij, aby wybrać. Plik od razu pojawia się w Assets i selektorze zasobów każdego narzędzia. Wielostronicowy PDF lub `.pptx` pyta, które strony lub slajdy zachować, a każdy z nich staje się zasobem SVG. Obraz dodany w narzędziu jest zachowywany bez zmian w **My images**, więc jego Content Credential nadal przechodzi weryfikację. Tylko bardzo duży plik wywołuje pytanie o zmianę rozmiaru. **Settings → Storage** pokazuje, ile miejsca zajmuje **My images**. Jedynym limitem jest pamięć urządzenia. Aby usuwać dane EXIF i GPS podczas dodawania, włącz **Strip metadata from uploads** w **Settings → Feature flags**. Content Credentials są zachowywane w obu przypadkach.
- <!--i:star--> **Oznacz ulubione zasoby.** Dodaj gwiazdkę do zasobu lub próbki koloru marki, aby przypiąć je u góry każdego selektora.
- <!--i:folder--> **Uporządkuj zasoby.** Przenieś zasób do innej grupy, ukryj nieużywany wspólny zasób marki (**Show hidden** przywraca jego widoczność) lub usuń własne pliki. Ten sam pasek zaznaczenia co w Projects działa na całym zaznaczeniu.
- <!--i:layers--> **Usuń tło z wideo.** Otwórz szczegóły wideo lub kliknij jego kartę prawym przyciskiem w selektorze zasobów i wybierz **Remove background…**. **On-device model** wycina obiekt ze sceny z wieloma szczegółami. **Colour key** usuwa równomiernie oświetlone tło, takie jak zielony ekran, i nie wymaga pobierania. **Tolerance**, **Softness** i **Spill removal** dostosowują krawędź. **Resolution** (360, 480, 720 lub 1080p, nigdy powyżej rozdzielczości źródła) pozwala wybrać między szczegółowością a szybkością. Wycięty obraz to animowany WebP lub PNG z przezroczystością, zapisany obok oryginału. Content Credential źródła jest dołączany do wyciętego obrazu jako składnik. [Wygenerowane raz, renderowane tak samo](/info/ai-features.html) wyjaśnia, dlaczego to nadal zwykła edycja.

### Zabierz paletę i czcionki ze sobą

Panel **Swatches** w Assets pokazuje kolory Twojej marki: kolory firmowe, dodane przez Ciebie kolory, skale tonalne i widmo. Kolory ról, które Lolly rezerwuje dla interfejsu (tekst, powierzchnie, krawędzie, główne kolory wariantów kolorystycznych i kopie koloru marki pod inną nazwą), kryją się pod szarą kartą **Show colour roles** na dole panelu.

Każdy kolor ma kartę jak każdy inny zasób. Kliknij ją, aby otworzyć szczegóły, zaznacz kilka kolorów, aby pobrać wybrane, lub pobierz całą paletę w formacie odczytywanym przez inne narzędzie:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** lub **CSS classes**, do arkusza stylów lub kompilacji. Kolor spoza gamutu sRGB zachowuje wartość w szerszej przestrzeni: CSS ustawia ją po wartości szesnastkowej, a JSON zachowuje wartość szesnastkową wraz z kolorem w szerszej przestrzeni, składowymi CMYK i farbą dodatkową.
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**, do Illustrator lub Photoshop. Kolor przypisany do określonych składowych CMYK trafia tam jako próbka CMYK, farba dodatkowa jako nazwana próbka koloru dodatkowego, a kolor spoza sRGB jako Lab.
- <!--i:pentool--> **GIMP palette (.gpl)**, do GIMP lub Inkscape, oraz **SCSS variables**, oba w sRGB.

![Panel Swatches - pięć przycisków pobierania palety u góry, a pod nimi każdy kolor marki jako element otwierający jego szczegóły](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

::: details Zaznacz kilka kolorów lub otwórz szczegóły jednego
Zaznaczaj kolory za pomocą kropki na każdej karcie: kliknij drugą kropkę z Shift, aby zaznaczyć wszystko pomiędzy, przeciągnij prostokąt przez odstępy lub naciśnij Cmd/Ctrl+A, gdy karta ma fokus. Pasek oferuje **Download as…** w tych samych sześciu formatach, **Copy hex** i **Favourite**. Zanim wybierzesz format, menu wymienia kolory, których nie może zapisać żaden format (Transparent nie ma koloru), formaty zapisujące kolor o szerokim gamucie jako jego odpowiednik sRGB (SCSS i GIMP) oraz formaty zachowujące wartości CMYK i kolorów dodatkowych (JSON i .ase). Kliknij kartę prawym przyciskiem, aby wykonać te same działania na jednym kolorze.

Szczegóły koloru wypełniają podgląd tym kolorem i rozwijają sekcje **Linked values** (składowe CMYK lub farba dodatkowa, wartości przygotowane dla określonej przestrzeni lub maszyny drukarskiej oraz token projektowy), **Every notation** (hex, OKLCH, Display-P3 i pozostałe, każda z przyciskiem kopiowania), **Plotted on a colour space**, **Tones** i **Readability**. Klawisze strzałek przechodzą po palecie, **Copy link** udostępnia kolor, a **Open in Colour Lab** otwiera go do dalszej pracy.
:::

Panel **Fonts** wymienia kroje pisma Twojej marki, każdy z opcją **download**, aby zainstalować je lokalnie lub przekazać drukarni.

<!--i:eti-grid-->
## Dostosuj siatkę do siebie

- <!--i:star--> **Dodaj używane narzędzia do ulubionych.** Kliknij kartę prawym przyciskiem i wybierz **Add to favourites**. Narzędzie otrzyma duży kafelek w pasku nad siatką. [Twoje ulubione](/info/favourites.html) opisuje ten pasek.
- <!--i:eyeoff--> **Ukryj narzędzie, którego nie używasz.** Kliknij kartę prawym przyciskiem lub zaznacz kilka i wybierz **Hide tool**. Znika ono z siatki i wyników wyszukiwania podczas pisania w siatce. Narzędzie opuszcza siatkę i nie jest już znajdowane podczas pisania w niej. Szary kafelek **Show hidden tools (N)** na końcu ponownie pokazuje ukryte narzędzia, przygaszone, każde z opcją **Unhide tool** w menu. Ukrycie zmienia tylko Twoją siatkę: narzędzie nadal otwiera się z linku lub zakładki.
- <!--i:clock--> **Twoje narzędzia jako pierwsze.** Gdy zapiszesz pracę w trzech różnych narzędziach, wiersz **Yours** nad siatką pokaże skróty najpierw do ulubionych, a potem do ostatnio używanych narzędzi.
- <!--i:sliders--> **Ułóż po swojemu.** **View options** ustawia układ (**Grid**, **Card** lub **List**), rozmiar i gęstość kart, kolejność sortowania i filtr kategorii.

![Koniec siatki Tools po pokazaniu ukrytych narzędzi: przygaszona karta Wordmark, a obok szary kafelek, który przywrócił jej widoczność i teraz ma napis Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed the tile. The alt says so rather than quoting the resting
label the prose above already gives.
The recipe hides nothing itself. The lolly-demo catalog the captures pin
ships Wordmark hidden (`defaultHiddenTools` in its assets index.json), so a
fresh profile already has one hidden tool and the recipe only clicks the grey
reveal tile (`.gtile--hiddenbox`, confirmed in gallery.ts). It used to tick
the QR Code card and press the bulk bar's Hide button first; under lolly-demo
that published Wordmark dimmed and QR Code not, under a caption naming QR
Code, so the steps were dropped rather than relied on. QR Code was hidden
in that run too: the End scroll had left the pointer over its card, and a
hovered hidden card lifts its dimming (gallery.css), so it read as a normal
tool. The closing `hover:` puts the pointer back on the reveal tile, which
keeps every revealed card dimmed.
-->

**Działaj na kilku kartach naraz.** Zaznacz pole wyboru każdej karty, przeciągnij prostokąt zaznaczenia przez pustą przestrzeń lub kliknij z Shift/Cmd, a pojawi się pasek działań dostępnych w danym widoku:

- **Tools i Utilities:** Favourite, Hide, Available offline, **View sessions** (Projects pokazujące tylko sesje utworzone tymi narzędziami) oraz Copy link dla pojedynczej karty.
- **Assets:** Favourite i Hide dla dowolnego zaznaczenia. Duplicate, Download i Delete pojawiają się tylko wtedy, gdy wszystkie zaznaczone elementy są Twoimi własnymi plikami, ponieważ wspólny zasób systemu projektowego stanowi trwały kontrakt.
- **Projects:** zobacz [Znajdowanie i odzyskiwanie pracy](/info/find-your-work.html#find-something-you-saved).

![Pasek zaznaczenia galerii dla dwóch narzędzi z opcjami Available offline, View sessions, Favourite i Hide](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
<!--
SHOT NOTE (misc-bulkbar-gallery): drive targets `[data-select="qr-code"]` /
`[data-select="gradient"]` - the `.tile-check[data-select="<ref>"]` checkbox button
confirmed directly in views/gallery.ts's card markup (the same attribute
cardMarkup gives every tile), so these two clicks tick both cards without
opening either tool.

SHOT NOTE (misc-sessions-by-tool, NOT PUBLISHED): the "View sessions" result
had a recipe of its own (`/#/p?tools=qr-code,d3`, views/projects.ts's
toolsBodyHtml()), dropped here because it has no `drive=` that can
manufacture its own content - a saved session isn't a click away, it has to
already exist, and build-docs-shots.ts gives every shot a fresh
`browser.newContext()`. It would publish an empty list. Same dependency the
`projects` shot (now on find-your-work.md) carries; revisit if the pipeline gains a
storage-seeding hook.
-->

**View sessions** pojawia się tylko wtedy, gdy coś jest zaznaczone. Kliknij prawym przyciskiem pojedynczą niezaznaczoną kartę, aby otworzyć **N saved sessions**: listę zapisanych sesji tego narzędzia, na której usunięcie przenosi sesję do kosza.

<!--i:eti-layers-->
## Na telefonie

Na wąskim ekranie układ zmienia się w jedną kolumnę:

- **Kontrolki tworzą panel** u góry z uchwytem do przeciągania na dolnej krawędzi. Przeciągnij uchwyt, aby ustawić panel w pozycji **peek**, **half** lub **full**, albo dotknij go, aby zwinąć lub rozwinąć panel. Podgląd wypełnia przestrzeń poniżej i pozostaje widoczny podczas edycji.
- Pływający przycisk **Export** otwiera panel eksportu: format, rozmiar, kopiowanie, zapis i pobieranie. Dotknij tła, aby zamknąć panel.

![Narzędzie na ekranie o szerokości telefonu - kontrolki w panelu u góry, wygenerowana paleta wypełniająca podgląd poniżej i pływająca pigułka renderowania na środku u dołu](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

<!--i:eti-copy-->
## Urządzenia składane i iPhone Duo

Na urządzeniu składanym, iPhone Duo lub niemal kwadratowym ekranie dotykowym Lolly dzieli narzędzie na dwa panele:

- **Kontrolki po jednej stronie, kanwa po drugiej.** Kontrolki są po przeciwnej stronie niż ręka, którą rysujesz. Wybierz **Dominant hand** w **Settings → Accessibility** lub naciśnij **Swap sides** u góry kontrolek. W języku pisanym od prawej do lewej strony zamieniają się miejscami.
- **Zawias wyznacza podział.** Gdy urządzenie zgłasza miejsce zgięcia, panele stykają się wzdłuż niego, więc żadna kontrolka ani grafika nie leży na zgięciu. Na ciągłym ekranie przeciągnij separator na jedną trzecią, połowę lub dwie trzecie szerokości. Lolly zapamiętuje Twój wybór dla każdego widoku na tym urządzeniu.
- **Na stole.** Gdy urządzenie jest otwarte do połowy, a zgięcie biegnie w poprzek ekranu, kanwa zajmuje górną połowę, a kontrolki znajdują się poniżej zgięcia. Podczas prezentacji slajd jest u góry, a notatki, następny slajd oraz **Back** i **Next** poniżej. W Sequence podgląd jest u góry, a oś czasu na dole.
- **Lolly Design, Design System Setup i Assets.** W Lolly Design Inspector, warstwy i panel eksportu są kartami obok kanwy. Narzędzia znajdują się wzdłuż zewnętrznej krawędzi kanwy, pod ręką, którą rysujesz. Gdy się nie mieszczą, kolumnę można przewijać, a przygaszenie ze strzałką wskazuje, w którą stronę są pozostałe. Na stole narzędzia biegną wzdłuż dolnej krawędzi kanwy. Lolly Design System Setup utrzymuje Board po jednej stronie, a otwarty pokój po drugiej. W Assets szczegóły zasobu otwierają się obok biblioteki, więc kolejne dotknięcie pokazuje następny zasób w tym samym miejscu.
- **Nic na zgięciu.** Gdy urządzenie zgłasza zgięcie, okno dialogowe otwiera się po stronie z kontrolkami. Tak samo pole wyszukiwania u dołu ekranu głównego i jego wyniki. Na płaskim ekranie pozostają pośrodku.
- **Składanie niczego nie traci.** Złożenie, rozłożenie lub obrócenie urządzenia zachowuje dokument, zaznaczenie, powiększenie i pole, w którym piszesz, wraz z pozycją kursora.

Zewnętrzny ekran urządzenia składanego zachowuje opisany wyżej układ telefonu, podobnie jak okno Lolly zajmujące połowę podzielonego ekranu.

<!--i:eti-smile-->
## Ustawienia, dźwięk i wygoda

**Settings** u dołu ekranu głównego zawiera Twoje dane, systemy projektowe, ułatwienia dostępu, pamięć i pobieranie do pracy offline. [Ustawienia Lolly](/info/dashboard.html) opisują każdą kartę.

- **Twoje dane i zdjęcie portretowe** uzupełniają każde narzędzie, które z nich korzysta, takie jak podpis e-mail lub identyfikator. [Profile](/info/profile.html) opisują je dokładniej.
- **Accessibility** zawiera cztery przełączniki wygody: **Reduce motion**, **Hide colourful previews**, **High contrast** i **Large text**. Zmieniają aplikację wokół Twojej pracy, nigdy kanwę narzędzia ani eksport. Obok nich **Dominant hand** wybiera stronę kontrolek w układzie z dwoma panelami.
- **Sound** odtwarza delikatne dźwięki pomocnicze przy wykonywaniu działań, a **Neurospicy Mode** odtwarza spokojną ścieżkę ułatwiającą skupienie. Obie opcje są wyłączone, dopóki nie włączysz ich w **Settings → Accessibility** lub menu profilu. Suwak **Sound shape** pod przełącznikiem Sound zmienia dźwięki od miękkich, obłych kropli (Bouba) po suche tyknięcia i szuranie (Kiki), z dzwonkami Lolly pośrodku. Ścieżki Neurospicy obejmują generowane stacje Lolly: **Lolly Sings** i jego gatunki oraz trzy **Lofi stations**. Stacje tworzą niekończącą się muzykę podczas odtwarzania. Każda ma kontrolki perkusji i faktury dźwięku (oraz nastroju w Lofi), link do udostępniania słuchanej melodii i przycisk zapisujący ją w zasobach. [Generowana muzyka](/info/generated-music.html) wyjaśnia, jak powstaje melodia. **Music generator** w Utilities (`#/music`) pozwala ją kształtować.
- **Available offline** pobiera resztę aplikacji, Twoje narzędzia, katalog i przewodniki, zanim utracisz połączenie. Aby zainstalować Lolly jako aplikację internetową, użyj przycisku instalacji w przeglądarce lub *Add to Home Screen* na telefonie. Zainstalowana aplikacja działa na pełnym ekranie i aktualizuje się po odzyskaniu połączenia.
- **Performance UI** w **Settings → Feature flags** nadaje aplikacji prostszy wygląd, którego rysowanie wymaga mniej zasobów. Kanwy narzędzi i eksporty pozostają takie same. Na wolnym urządzeniu Lolly samodzielnie włącza ten wygląd i wyjaśnia dlaczego, z opcjami **Undo** i **Keep** ([Performance UI](/info/configuration.html#curating-what-people-see)).
- **Storage** pokazuje, co Lolly przechowuje na tym urządzeniu. [Jeśli wyczyścisz dane przeglądarki](/info/find-your-work.html#if-you-clear-your-browser-data) wyjaśnia, co zostaje usunięte, a [Polityka prywatności](/info/privacy.html) wymienia wszystko, co aplikacja pobiera lub wysyła.

::: note Jeśli widok nie ładuje się po aktualizacji
Pusty panel lub komunikat „failed to fetch” tuż po aktualizacji zwykle znika po jednym przeładowaniu. Zapisana praca, sesje i systemy projektowe pozostają nienaruszone, ponieważ są przechowywane na Twoim urządzeniu. Jedynie obraz dodany, ale nigdy niezapisany, może wymagać ponownego dodania.
:::

<!--i:eti-map-pin-->
## Co dalej

- **[Lolly Design: swobodna kanwa](/info/design.html)**: kanwa, kształty, oś czasu i prezentowanie slajdów.
- **[Przetwarzanie wsadowe i Lolly Multi-edit](/info/batch.html)**: wiele wersji jednego projektu lub kilka zapisanych projektów edytowanych razem.
- **[Eksport pliku](/info/exporting.html)**: wybór formatu, rozmiaru, jednostek druku, przezroczystości i wideo.
- **[Import projektu](/info/design-import.html)**: przenieś plik Figma, Penpot, Illustrator, InDesign, Affinity lub DXF do Lolly Design i kontynuuj edycję.
- **[Szablony](/info/templates.html)**: zapisane punkty wyjścia do pracy z narzędziem.
- **[Szeroki gamut kolorów i HDR](/info/hdr-editing.html)**: zachowaj pierwotną precyzję obrazu w Lolly Design i Lolly Darkroom.
- **[Znajdowanie i odzyskiwanie pracy](/info/find-your-work.html)**: gdzie wszystko się znajduje i jak przenieść to na inne urządzenie.
