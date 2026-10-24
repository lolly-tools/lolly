# Korzystanie z Lolly

Masz otwarte Lolly i chcesz coś zrobić, zachować i wysłać dalej. Ta strona prowadzi przez tę pętlę: otwórz narzędzie, zmień to, co pozwala zmienić, zapisz wynik i udostępnij go jako link lub plik.

Wszystko tutaj działa na Twoim urządzeniu, bez konta, i nadal działa offline, gdy potrzebne narzędzia i zasoby są pobrane. Aby aplikacja się uruchomiła, potrzebna jest przeglądarka lub aplikacja z WebGPU; [Supported environments](/info/supported-environments.html) wymienia przetestowane.

## Zorientuj się

::: figure using-app-map
Ekran główny: cztery karty u góry i pasek na dole. Otwarte narzędzie pokazuje swoje kontrolki obok podglądu na żywo.
:::

Cztery karty biegną wzdłuż góry ekranu głównego: **Tools**, **Utilities**, **Assets** i **Projects**. Tools to to, czym tworzysz, Utilities to stanowiska do zadań takich jak konwersja, sprawdzanie lub porządkowanie pliku, Assets to Twoja biblioteka, a Projects przechowuje to, co zapisałeś.

Pasek na dole zawiera **Open**, **Settings**, pole wyszukiwania, **Verify** i **What?**. Widać go w Tools, Utilities, Assets, Projects, Settings i w przewodnikach czytanych w aplikacji, a znika, gdy otwarte jest narzędzie. [Search](/info/search.html) z tego pola dociera do Twoich narzędzi, zapisanej pracy, zasobów i ustawień. [Ask Lolly](/info/ask.html) odpowiada na wpisane pytanie odpowiednią sekcją tych przewodników.

Kliknij kartę, aby zacząć coś nowego w tym narzędziu. Zapisana praca otwiera się ponownie z **Projects**.

![Karta galerii z przykładową nawigacją i akcją Nowy](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Każde narzędzie to widok podzielony: **kontrolki** z jednej strony i podgląd **na żywo** z drugiej. Zmień kontrolkę, a podgląd od razu podąża, a to, co widzisz, jest tym, co się eksportuje.

![Widok podzielony narzędzia - stos elementów sterujących po lewej i rysowany na żywo wykres słupkowy grupowany po prawej](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Design** jest wyjątkiem. Otwiera się jako swobodna kanwa boksów, które przeciągasz, zmieniasz im rozmiar i wpisujesz w nie tekst, z własnym górnym paskiem, osią czasu i kontrolkami prezentacji. [Design: the free canvas](/info/design.html) to jego przewodnik.

## Zmieniaj to, na co narzędzie pozwala

Narzędzie pokazuje tylko dane wejściowe, które mają się zmieniać. Jego autor już ustalił kolory, układ, typografię i logikę, więc wszystko, co zrobisz, trzyma się jego reguł. Dane wejściowe obejmują tekst, suwaki, selektory kolorów, listy rozwijane, daty, selektory obrazów i powtarzalne grupy wierszy, a niektóre są w zwijanych sekcjach.

![Stos kontrolek narzędzia - pole tekstowe, przyciski kolorów i suwak, i nic poza tym, co autor postanowił zablokować](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Kliknij projekt, aby znaleźć jego kontrolkę.** Kliknij dowolny element w podglądzie, a odpowiednia kontrolka dostanie fokus i przewinie się do widoku. W powtarzalnej grupie wierszy rozwija się dokładnie ten wiersz, który kliknąłeś.

**Clear changes** nad kontrolkami przywraca każde dane wejściowe do wartości domyślnej.

**Wybory systemu projektowego.** Gdy Twój system projektowy oferuje więcej niż jeden wariant kolorystyczny (colourway), jasny i ciemny wygląd lub inny wybór motywu, mieści je sekcja **Design system** pod kontrolkami. Wybór pojawia się tylko wtedy, gdy zmienia to narzędzie, więc narzędzie do plików nie pokazuje żadnej sekcji. Każdy colourway to kropka w jego własnych kolorach, jasny i ciemny to dwa przyciski, a każdy inny wybór to lista.

Wybór należy do tej pracy. Podróżuje w linku i zapisanej sesji, podąża za nim każdy kolor powiązany z systemem projektowym, a kolory samej aplikacji zostają bez zmian. Design pokazuje te same wybory na karcie **Canvas** w Inspectorze. Narzędzie, którego kolory są jego treścią, może pozostać przy kanonicznym colourway i wtedy nie oferuje kropek colourway. [Lolly Demo in use](/info/lolly-demo-in-use.html#colourways-on-real-work) pokazuje colourway na prawdziwej pracy.

### Powiększanie i przesuwanie podglądu

Podgląd zawsze pokazuje dokładnie to, co zostanie wyeksportowane.

- **Powiększanie:** Cmd/Ctrl i przewijanie albo szczypnięcie na gładziku, względem wskaźnika. Na klawiaturze `0` lub `Shift+1` dopasowuje wszystko, `1` lub `Shift+0` ustawia 100%, a `Shift+2` dopasowuje zaznaczenie. `+` / `−` zmieniają powiększenie względem wskaźnika, gdy znajduje się nad sceną, a w przeciwnym razie względem środka widoku.
- **Przesuwanie:** przytrzymaj **Space** i przeciągaj albo przeciągaj środkowym przyciskiem myszy. Zwykłe kliknięcia pozostają wolne do klikania części projektu.
- **Dotyk:** szczypnij, aby powiększyć, przeciągaj, aby przesuwać, i stuknij dwukrotnie, aby dopasować.
- **HUD powiększenia:** naciśnij i przytrzymaj wir Lolly w rogu, aby rozwinąć `−`, **Fit** i `+`. Krótkie stuknięcie wiru nadal otwiera menu profilu.

W Design **Fit all** obejmuje obszary robocze i luźne warstwy. Ręcznie można oddalić poniżej 20%, aż cała strona zajmie połowę widoku. Bezwzględna dolna granica to mniejsza z wartości: 5% zwykłej skali Fit i 2% powiększenia bezwzględnego.

Zmiana rozmiaru wyjściowego zawsze przywraca widok do czystego dopasowania.

![HUD powiększenia rozwinięty z wiru w rogu kanwy - minus, Fit, plus, potem przełączniki motywu i dźwięku oraz uchwyt do przesuwania](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### Cofanie i ponawianie

**Cmd/Ctrl-Z** cofa, a **Cmd/Ctrl-Shift-Z** (lub **Cmd/Ctrl-Y**) przywraca. Ta sama para jest jako przyciski **Undo** i **Redo** nad kontrolkami (w Design są w górnym pasku), a każdy szarzeje, gdy nie ma już czego cofnąć. Komunikat mówi, które dane wejściowe przywrócono przy każdym cofnięciu, z przyciskiem **Redo** w komunikacie.

- **Przeciągnięcie to jeden krok.** Powtarzane zmiany jednej kontrolki w ciągu pół sekundy łączą się, więc pociągnięcie suwaka przez cały zakres to jedno cofnięcie.
- **Ostatnie 100 kroków jest zachowywanych.** Nowa edycja po cofnięciu czyści stos do przodu.
- **W polu tekstowym** Cmd/Ctrl-Z należy do pola, znak po znaku. Lolly przejmuje suwaki, listy rozwijane, kolory i przełączniki.
- **Wybór pliku** w polu pliku nie jest krokiem, ponieważ te bajty są trzymane tylko na czas tej sesji.

W trwającej [współpracy](/info/collaborate.html) Twoja historia pozostaje Twoja: zmiana z drugiego urządzenia nigdy nie trafia na Twój stos. Cofanie trwa do opuszczenia narzędzia lub przeładowania. W przypadku starszych zmian narzędzia, które zapisują w trakcie pracy, przechowują wcześniejsze wersje w **History**; zobacz [Go back to an earlier version](/info/find-your-work.html#go-back-to-an-earlier-version).

### Kamera na żywo

Efekty narzędzia **Filter** (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art i Glitch) pokazują przycisk **Go live**, gdy dostępna jest kamera. Włącz go, a efekt podąża za kamerą internetową klatka po klatce, a eksport ruchu zapisuje wynik jako GIF, WebM lub MP4. Klatki są przetwarzane na Twoim urządzeniu, a kamera jest zwalniana w chwili, gdy przestaniesz lub opuścisz narzędzie. Każdy selektor obrazu ma też **Take a photo** dla pojedynczej klatki.

## Zapisywanie i wznawianie

Aby zachować pracę, naciśnij **Save**, ptaszek obok **Export** na pigułce renderowania. Nowa praca trafia do **My library**, praca zapisana wcześniej jest aktualizowana na miejscu i nic się nie pobiera. Panel eksportu ma ten sam przycisk **Save**.

Aby wybrać, dokąd trafi, naciśnij **Save as**, obok **Download** w panelu eksportu. W **Save to a project** zostaw wybrane **My library** albo wybierz projekt (**＋ New project…** tworzy nowy), a potem naciśnij **Save**; **Save as a template** zachowuje projekt jako [szablon](/info/templates.html), punkt wyjścia dla nowych dokumentów. W Design **Save as** jest w menu Lolly; na telefonie naciśnij **•••**, potem **File menu**, potem **Save as**.

![Dwuczęściowa pigułka renderowania: Export ze strzałką w górę, która otwiera panel eksportu, i Save z ptaszkiem, który zapisuje na miejscu](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> Naciśnij **Save** na pigułce renderowania albo **Save as**, aby wybrać projekt.
- <!--i:folder--> Element trafia do **My library** albo do wybranego projektu.
- <!--i:home--> Później naciśnij **Home** w lewym górnym rogu i otwórz kartę **Projects**.
- <!--i:document--> Otwórz element. Każde ustawienie wraca, gotowe do zmiany i ponownego eksportu.
:::

Elementy są nazywane według nazwy pliku wpisanej w panelu eksportu albo, w razie braku, według narzędzia, na przykład **QR Code**. Plik uzyskany przez **Download** to gotowa kopia; aby zmienić go później, otwórz zapisany element w Projects.

Osobiste zapisy zostają na tym urządzeniu, w przeglądarce lub aplikacji, z której zapisałeś, chyba że włączysz [Sync](/info/sync.html). Jeśli czegoś nie ma tam, gdzie oczekujesz, [Find and recover your work](/info/find-your-work.html) omawia każdy przypadek, od zamkniętej karty po wyczyszczone dane przeglądarki.

::: details Wspólne projekty z Lolly Work (opcjonalnie)
Jeśli Twoja [organizacja używa Lolly Work](/info/organisation.html), zaloguj się do jej instancji i otwórz **Projects → Team projects**, aby zobaczyć udostępnione Ci sesje. Organizacja ustala dostęp i retencję, a jej usługa Lolly Work przechowuje te sesje. Udostępniona sesja dołącza do swojego collabu na żywo przy otwarciu, gdy organizacja zezwala na edycję na żywo; [Working together](/info/collaborate.html#work-collabs-with-lolly-work-optional) wyjaśnia kroki.

Twoja osobista biblioteka pozostaje oddzielna. Zalogowanie na innym urządzeniu daje pracę zespołową, ale osobiste zapisy nadal wymagają Sync lub kopii zapasowej, by się przenieść.
:::

## Udostępnianie swojej pracy

Projekt wychodzi jako link albo plik. **Share** w kontrolkach eksportu otwiera okno z obiema opcjami, a **Share link** przy zapisanej sesji w Projects otwiera to samo okno dla tej sesji.

::: cols
## Link

- Niesie każde dane wejściowe w adresie, więc link odtwarza projekt.
- Pomija obrazy i pliki dodane z tego urządzenia, bardzo długi tekst i bardzo duże listy.
- Otwiera się w każdej przeglądarce, więc możesz dodać link do zakładek, wkleić go lub zatwierdzić w repozytorium.

## Plik .lolly

- Niesie zapisaną sesję z obrazami i plikami z tego urządzenia, a może też nieść narzędzie i system projektowy.
- Wstrzymuje licencjonowaną grafikę z katalogu, chyba że zdecydujesz się dołączyć pliki.
- Otwiera się w Lolly: kliknij dwukrotnie, użyj **Open** lub upuść na aplikację.
:::

### Link

Gotowy do skopiowania link jest na górze okna, z **Copy** i przyciskiem **QR**, który otwiera narzędzie QR Code na tym linku. Pod linkiem **Link options** zawiera:

- **Open in the installed app** przełącza link na adres `lolly://` dla Skrótów, launcherów i automatyzacji, z każdym parametrem bez zmian.
- **Shortest link** pakuje długi projekt w zwarty token i pokazuje oszczędność w znakach. Czytelna forma też zawsze jest dostępna.
- **Password-protect this link** szyfruje link na Twoim urządzeniu algorytmem AES-256. Hasło nigdy nie jest częścią linku.
- **Pin this tool version** dodaje flagę `_v`, aby późniejsza aktualizacja narzędzia nie mogła zmienić tego, co renderuje link.
- **When the recipient opens the link…** wybiera pełny ekran, już rozwinięty panel eksportu, pobranie przy otwarciu (`&export`) lub kopię do schowka (`&copy`).
- **Copy credit** kopiuje podpis "Made with Lolly" z linkiem, do wpisu lub slajdu.

Gdy narzędzie zawiera pola osobiste, takie jak Twoje imię i nazwisko, **Review personal fields** trzyma każde z nich poza linkiem, dopóki go nie zaznaczysz. [URL mode](/info/url-mode.html) omawia wszystko, co może nieść link.

**Okno mówi, czego link nie może nieść.** Obraz lub plik dodany z tego urządzenia, bardzo długa wartość tekstowa i bardzo duża lista nie mieszczą się w adresie. Każdy jest liczony podczas budowania linku. Jeśli coś trzeba było pominąć, okno to wymienia i wskazuje opcję pliku, zamiast dawać link, który otwiera się z brakującym obrazem. Link, który jest tylko długi, dostaje łagodniejszą uwagę z liczbą znaków.

**W niektórych narzędziach link jest całym produktem.** Jump Page zbiera Twoje linki na jedną stronę do rozdawania: link do bio, wystąpienie, witryna sklepu. Nic nie jest hostowane i za stroną nie stoi żadne konto, bo stroną jest link. Odwiedzający dostaje ją na pełną szerokość, po jednym linku na scenę podczas przewijania.

![Jump Page w edytorze: scena z nagłówkiem w górnej części strony, a pod nią sceny z linkami](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Linki zarządzane przez organizację z Lolly Work
Do udostępniania wymagającego wygaśnięcia, unieważnienia lub hasła Lolly Work oferuje zarządzane linki do wspólnych sesji, narzędzi i zasobów katalogu. Są rozwiązywane przez usługę organizacji i podlegają jej regułom dostępu. Są oddzielne od samodzielnych linków powyżej, a unieważnienie jednego nie cofnie pliku, który ktoś już pobrał. [Rendering and sharing](/info/manage/sharing.html) wymienia typy linków i uprawnienia.
:::

### Plik .lolly

**Download .lolly** w sekcji **Editable file** okna Share zapisuje bieżący projekt jako jeden plik. Niesie zapisaną sesję z obrazami i plikami z tego urządzenia, a zwykła grafika katalogu jedzie razem. Nieaktualny lub niedostępny plik pozostaje odwołaniem zewnętrznym, zamiast znikać. Przed zapisem okno pokazuje rozmiar pliku, ile plików osadza, ile przywołuje i czy narzędzie jest dołączone. Tam, gdzie urządzenie ma arkusz udostępniania, **Send to…** przekazuje plik prosto do niego (AirDrop, udostępnianie Androida).

**Download project (.lolly)** w menu folderu w **Projects** zapisuje cały folder, aby ktoś inny mógł kontynuować z każdą sesją w folderze. Sesje Batch zostają, a komunikat podaje ile. **Download originals** w tym samym menu zapisuje zwykły zip z każdym elementem jako osobnym plikiem.

Trzy rzeczy należą do Ciebie, zanim plik wyjdzie:

- **Czy Twoje imię i nazwisko trafi do pliku.** Imię i nazwisko, e-mail i organizacja są zapisywane tylko wtedy, gdy w [Twoim profilu](/info/profile.html) włączone jest **Use my details to create**. Gdy wyłączone, plik zapisuje tylko, że powstał w Lolly, i kiedy.
- **Czy wstrzymana grafika trafi do pliku.** Grafika licencjonowana, zablokowana przez markę i dzieła z katalogu, których licencji nigdy nie zapisano, domyślnie zostają poza plikiem. Jeśli projekt używa któregokolwiek, okno podaje ile i oferuje *Download without them* lub *Include and download*, ponieważ dołączenie ich oddaje pliki każdemu, kto otworzy `.lolly`. Plik `CREDITS.txt` wymienia, co podróżowało, a co nie, z powodem; [Creative rights and credits](/info/creative-rights.html) wyjaśnia reguły.
- **Czy narzędzie trafi do pliku.** **Include the tool** pakuje własne pliki narzędzia, aby projekt otwierał się na urządzeniu bez tego narzędzia. Domyślnie zaznaczone dla narzędzia niestandardowego, takiego jak fork, i odznaczone dla narzędzia z podpisanego katalogu. W kompilacji bez podpisanego katalogu każde narzędzie liczy się jako niestandardowe.

**Otwieranie.** W aplikacjach komputerowych i mobilnych kliknij dwukrotnie lub stuknij `.lolly`, wybierz **Open with Lolly** albo wyślij go do Lolly z arkusza udostępniania. W aplikacji internetowej naciśnij **Open** lub upuść plik na Lolly. Każda droga najpierw czyta manifest pliku i pokazuje jego rozmiar, zawartość i to, co się stanie, zanim cokolwiek zostanie zapisane.

Jeśli plik niesie narzędzie, którego nie masz, **Trust this tool?** pokazuje narzędzie i jego autora oraz mówi, że otwarcie uruchamia na Twoim urządzeniu kod tego narzędzia. **Trust & install** przechodzi dalej. Jeśli odmówisz, praca nadal zostaje zapisana w Projects i czeka na dzień, w którym dodasz narzędzie. Narzędzia, którego kod jest dostarczany jako moduł, nie można jeszcze tak zainstalować i jest odrzucane w ten sam sposób.

::: details Co zawiera .lolly i jak działa jego otwieranie
`.lolly` to rozszerzenie paczki Lolly, a `format` w jej `manifest.json` mówi, co jest w środku:

- **Udostępniony projekt** (`lolly-share`) zawiera jedną zapisaną sesję, jej osadzone pliki i potwierdzenie dla wszystkiego, co nadal jest rozwiązywane przez odwołanie. Może też nieść narzędzie i system projektowy. Otwarcie dodaje nowy Project i nigdy nie nadpisuje sesji.
- **Udostępniony folder projektów** (`lolly-share`, rodzaj `project`) zawiera folder z Projects: jego podfoldery, każdą sesję w nich z kafelkiem i zdjęcia tam złożone. Otwarcie dodaje kopię całego folderu. Każda sesja podróżuje jako `sessions/<key>.json` z kafelkiem w `thumbs/`. Lolly sprzed plików projektów prosi o aktualizację.
- **Paczka systemu projektowego** (`lolly-brand`) zawiera tokeny i może zawierać czcionki, logo, opublikowane wersje i zachowane zasoby. Otwarcie paczki dodaje osobny nazwany system projektowy i czyni go aktywnym.
- **Paczka przestrzeni roboczej lub instancji** to `lolly-brand` z zadeklarowanymi narzędziami, zasobami katalogu i opcjonalnie adresem instancji. Wczytanie jednej zastępuje pojedynczą nakładkę przestrzeni roboczej wczytaną wcześniej, a podgląd wymienia te skutki w całym urządzeniu.

Pełna kopia zapasowa urządzenia nie jest `.lolly`. Pozostaje `LollyTools-….zip` (format `lolly-backup`) i jest przywracana przez **Settings → Storage → Import data…**. Spakowany folder narzędzia także pozostaje `.zip`. [Data transfer](/info/data-transfer.html) to opis formatu.

`.lolly` to zwykły zip. Zmień nazwę na `.zip`, aby zajrzeć do środka: Twoje własne obrazy są w `assets/uploads/`, grafika katalogu w `assets/catalog/`, `manifest.json` wymienia każdy plik, a README mówi, czym jest plik.

macOS, Windows, Linux, iOS i Android rejestrują ten format, menedżery plików na komputerze pokazują go jako dokument Lolly, a GNOME Files może pokazać własną miniaturę zapisanej sesji. Otwieranie z Design System Setup poleca akcję systemu projektowego, gdy udostępniony projekt ją niesie, ale nigdy nie ukrywa **Open shared design**.

Dokument przekazany z innej aplikacji na iOS lub Androidzie ma limit 48 MB, ponieważ przekazanie kopiuje jego bajty przez granicę aplikacji, i aplikacja o tym mówi. **Open** wewnątrz Lolly nie ma takiego limitu, więc użyj go dla większej paczki.

Po potwierdzeniu Lolly rozpakowuje i weryfikuje paczkę jednorazowo. Zasoby trafiają do biblioteki, dopasowane po sumie kontrolnej, więc plik już obecny na urządzeniu jest używany ponownie. Sesje trafiają do Projects z nowymi identyfikatorami, więc ten sam plik można otworzyć dwa razy; sesja, której brakuje narzędzia, czeka tam. Pliki powyżej 100 MB są oznaczane jako duże, a podgląd ostrzega, gdy pamięć przeglądarki zgłasza mniej wolnego miejsca, niż plik potrzebuje. Każda część objęta integralnością jest sprawdzana, zanim cokolwiek zostanie zatwierdzone, a uszkodzona kopia jest odrzucana bez pozostawiania czegokolwiek.
:::

Link i plik przekazują migawkę. Do edycji na żywo [Working together](/info/collaborate.html) opisuje prywatne collaby między dwoma urządzeniami i opcjonalne collaby robocze przez Lolly Work.

## Zasoby - twoja biblioteka

**Assets** (`#/a`) zbiera wszystko, z czego mogą korzystać Twoje narzędzia: logo marki, obrazy, audio i ruch, pogrupowane według rodzaju, razem z Twoimi własnymi plikami. Twoje wgrane pliki są przechowywane na urządzeniu. Organizacja używająca Lolly Work może też dostarczyć wspólny katalog z własnymi regułami dostępu; zobacz [Use Lolly at your organisation](/info/organisation.html).

![Zasoby z próbkami i krojami pisma marki oraz twoimi własnymi przesłanymi plikami](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Wprowadź swoje pliki.** Upuść obraz, SVG, klip audio, wideo, Lottie, PDF lub prezentację PowerPoint na obszarze wgrywania albo kliknij, aby wybrać. Trafia od razu do Assets i do selektora zasobów każdego narzędzia. Wielostronicowy PDF lub `.pptx` pyta, które strony lub slajdy zachować, a każdy staje się zasobem SVG. Obraz dodany wewnątrz narzędzia jest zachowywany tak, jak przyszedł, w **My images**, więc Content Credential na nim nadal się weryfikuje, a tylko bardzo duży plik pyta, czy zmienić rozmiar. **Settings → Storage** pokazuje, ile zawiera **My images**. Nie ma limitu poza pamięcią urządzenia. Aby usuwać dane EXIF i GPS w momencie dodawania obrazów, włącz **Strip metadata from uploads** w **Settings → Feature flags**; Content Credentials są zachowywane w obu przypadkach.
- <!--i:star--> **Dodaj do ulubionych to, po co sięgasz.** Oznacz gwiazdką zasób lub próbkę marki, a przypnie się na górze każdego selektora.
- <!--i:folder--> **Porządkuj.** Przenieś zasób do innej grupy, ukryj wspólny zasób marki, którego nie używasz (**Show hidden** go przywraca) albo usuń własne wgrane pliki. Ten sam pasek zaznaczania co w Projects działa na całym zaznaczeniu.
- <!--i:layers--> **Oddziel wideo od tła.** Otwórz szczegóły wideo lub kliknij prawym przyciskiem jego kartę w selektorze zasobów i wybierz **Remove background…**. **On-device model** wycina obiekt z ruchliwej sceny; **Colour key** usuwa równomiernie oświetlone tło, takie jak green screen, z ustawieniami **Tolerance**, **Softness** i **Spill removal** dla krawędzi, i nie wymaga pobierania. **Resolution** (360, 480, 720 lub 1080p, nigdy powyżej źródła) wymienia szczegóły na szybkość. Wycięcie, animowany WebP lub PNG z prawdziwą przezroczystością, jest zapisywane obok oryginału, a Content Credential źródła jedzie jako składnik. [Generated once, rendered the same](/info/ai-features.html) wyjaśnia, dlaczego to pozostaje zwykłą edycją.

### Zabierz swoją paletę i kroje pisma wszędzie

Panel **Swatches** w Assets pokazuje kolory, z których składa się Twoja marka: kolory marki, kolory dodane przez Ciebie, jej rampy i jej spektrum. Kolory ról, które Lolly trzyma dla interfejsu (tekst, powierzchnie, krawędzie, kolory wiodące colourway i kopie koloru marki pod inną nazwą), czekają za szarą kartą **Show colour roles** na dole panelu.

Każdy kolor to karta jak każdy inny zasób. Kliknij jedną, aby otworzyć jej szczegóły, zaznacz kilka, aby pobrać tylko je, albo pobierz całą paletę w formacie, który czyta Twoje inne narzędzie:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** lub **CSS classes**, dla arkusza stylów lub kompilacji. Kolor szerszy niż sRGB zachowuje swoją szeroką wartość: CSS ustawia ją po hex, a JSON zachowuje hex razem z szerokim kolorem, kompozycją CMYK i farbą dodatkową.
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**, dla Illustratora lub Photoshopa. Kolor zablokowany na składzie CMYK przychodzi jako ta próbka CMYK, farba dodatkowa jako nazwana próbka dodatkowa, a kolor szerszy niż sRGB jako Lab.
- <!--i:pentool--> **GIMP palette (.gpl)**, dla GIMP lub Inkscape, oraz **SCSS variables**, oba w sRGB.

![Panel Swatches - pięć przycisków pobierania palety u góry, potem każdy kolor marki jako znacznik, który otwiera jego szczegóły](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

Zaznaczaj kolory kropką na każdej karcie: kliknij z Shift drugą kropkę, aby zaznaczyć wszystko pomiędzy, przeciągnij ramkę przez luki albo naciśnij Cmd/Ctrl+A z fokusem na karcie. Pasek oferuje **Download as…** w tych samych sześciu formatach, **Copy hex** i **Favourite**. Zanim wybierzesz format, menu wymienia każdy kolor, którego żaden format nie może pomieścić (Transparent nie ma w ogóle koloru), które formaty zapisują szeroki kolor jako jego zapasowy sRGB (SCSS i GIMP) i które niosą wartości CMYK i farb dodatkowych (JSON i .ase). Kliknij kartę prawym przyciskiem, aby uzyskać te same akcje dla jednego koloru.

Szczegóły koloru wypełniają podgląd tym kolorem i rozwijają **Linked values** (jego skład CMYK lub farbę dodatkową, każdą wartość stworzoną dla konkretnej przestrzeni lub maszyny drukarskiej oraz jego token projektowy), **Every notation** (hex, OKLCH, Display-P3 i resztę, każda z przyciskiem kopiowania), **Plotted on a colour space**, **Tones** i **Readability**. Klawisze strzałek przechodzą przez paletę, **Copy link** udostępnia sam kolor, a **Open in Colour Lab** prowadzi dalej.

Panel **Fonts** wymienia czcionki Twojej marki z przyciskiem **download** przy każdej, do zainstalowania lokalnie lub przekazania drukarni.

## Dopasuj siatkę do siebie

- <!--i:star--> **Dodaj do ulubionych to, czego używasz.** Kliknij kartę prawym przyciskiem i wybierz **Add to favourites**, a dostanie duży kafel w pasku nad siatką. [Your favourites](/info/favourites.html) opisuje ten pasek.
- <!--i:eyeoff--> **Ukryj narzędzie, którego nigdy nie używasz.** Kliknij kartę prawym przyciskiem lub zaznacz kilka i wybierz **Hide tool**. Znika z siatki i z tego, co znajduje wpisywanie w siatce. Szary kafel **Show hidden tools (N)** na końcu odsłania je ponownie, przyciemnione, a w menu każdego jest **Unhide tool**. Ukrywanie zmienia tylko Twoją siatkę: narzędzie nadal otwiera się z linku lub zakładki.
- <!--i:clock--> **Najpierw Twoje narzędzia.** Gdy masz zapisaną pracę w trzech różnych narzędziach, rząd znaczników **Yours** nad siatką zaczyna się od Twoich ulubionych i ostatnich narzędzi.
- <!--i:sliders--> **Ułóż po swojemu.** **View options** ustawia układ (**Grid**, **Card** lub **List**), rozmiar i gęstość kart, kolejność sortowania i filtr kategorii.

![Koniec siatki Tools z odsłoniętymi ukrytymi narzędziami: przyciemniona karta Wordmark, a obok szary kafel, który przywrócił je do widoku, teraz z napisem Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
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

**Działaj na kilku kartach naraz.** Zaznacz pole wyboru każdej karty, przeciągnij ramkę zaznaczenia przez puste miejsce albo kliknij z Shift/Cmd, a pojawi się pasek z tym, na co pozwala dany widok:

- **Tools i Utilities:** Favourite, Hide, Available offline, **View sessions** (Projects, pokazujące tylko sesje wykonane tymi narzędziami) i Copy link dla pojedynczej karty.
- **Assets:** Favourite i Hide dla dowolnego zaznaczenia. Duplicate, Download i Delete pojawiają się tylko wtedy, gdy każdy zaznaczony element jest jednym z Twoich własnych wgranych plików, ponieważ wspólny zasób systemu projektowego jest trwałym kontraktem.
- **Projects:** zobacz [Find and recover your work](/info/find-your-work.html#find-something-you-saved).

![Pasek zaznaczenia w galerii dla dwóch narzędzi, oferujący Dostępne offline, Zobacz sesje, Ulubione i Ukryj](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
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

**View sessions** pojawia się dopiero po zaznaczeniu czegoś. Kliknij prawym przyciskiem pojedynczą niezaznaczoną kartę, a zaoferuje **N saved sessions**, listę zapisanych sesji tego narzędzia, w której usunięcie przenosi sesję do Kosza.

## Na telefonie

Na wąskim ekranie układ staje się jedną kolumną:

- **Kontrolki stają się arkuszem** u góry z uchwytem do przeciągania na jego dolnej krawędzi. Przeciągnij uchwyt, aby przeskoczyć do **peek**, **half** lub **full**, albo stuknij go, aby zwinąć i rozwinąć. Podgląd wypełnia miejsce poniżej i pozostaje widoczny podczas edycji.
- Pływający przycisk **Export** otwiera arkusz eksportu: format, rozmiar, kopiowanie, zapis i pobieranie w jednym miejscu. Stuknij tło, aby zamknąć arkusz.

![Narzędzie na ekranie o szerokości telefonu - kontrolki jako arkusz u góry, wygenerowana paleta wypełniająca podgląd poniżej i pigułka renderu unosząca się na dole pośrodku](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Settings, dźwięk i komfort

**Settings** na dole ekranu głównego zawiera Twoje dane, systemy projektowe, dostępność, pamięć i pobrania offline. [Settings](/info/dashboard.html) mapuje każdą kartę.

- **Twoje dane i zdjęcie** wypełniają każde narzędzie zbudowane, by z nich korzystać, takie jak podpis e-mail lub identyfikator. [Profiles](/info/profile.html) je opisuje.
- **Dostępność** ma cztery przełączniki komfortu: **Reduce motion**, **Hide colourful previews**, **High contrast** i **Large text**. Zmieniają aplikację wokół Twojej pracy, nigdy kanwę narzędzia ani eksport.
- **Dźwięk** odtwarza delikatne dźwięki pomocnicze dla tego, co robisz, a **Neurospicy Mode** odtwarza spokojną ścieżkę skupienia. Oba są wyłączone, dopóki ich nie włączysz, w **Settings → Accessibility** lub w menu profilu.
- **Available offline** pobiera resztę aplikacji, Twoje narzędzia, katalog i przewodniki, zanim stracisz połączenie. Lolly to aplikacja internetowa, którą można zainstalować: użyj przycisku instalacji w przeglądarce lub *Add to Home Screen* na telefonie, aby mieć pełnoekranową aplikację, która sama się aktualizuje, gdy znów jesteś online.
- **Storage** pokazuje, co Lolly przechowuje na tym urządzeniu. [If you clear your browser data](/info/find-your-work.html#if-you-clear-your-browser-data) wyjaśnia, co usuwa wyczyszczenie, a [Privacy Policy](/info/privacy.html) wymienia wszystko, co aplikacja pobiera lub wysyła.

::: note Jeśli widok nie ładuje się po aktualizacji
Pusty panel lub komunikat "failed to fetch" zaraz po aktualizacji zwykle znika po jednym przeładowaniu. Twoja zapisana praca, sesje i systemy projektowe pozostają nietknięte, ponieważ są przechowywane na urządzeniu. Tylko obraz, który dodałeś i nigdy nie zapisałeś, może wymagać ponownego dodania.
:::

## Dokąd dalej

- **[Design: the free canvas](/info/design.html)**: kanwa, kształty, oś czasu i prezentowanie prezentacji.
- **[Batch and Multi-edit](/info/batch.html)**: wiele wersji jednego projektu albo kilka zapisanych projektów edytowanych razem.
- **[Export a file](/info/exporting.html)**: wybór formatu, rozmiaru, jednostek druku, przezroczystości i wideo.
- **[Import a design](/info/design-import.html)**: wprowadź plik z Figmy, Penpot, Illustratora lub InDesign do Design i edytuj dalej.
- **[Templates](/info/templates.html)**: zapisane punkty wyjścia dla narzędzia.
- **[Wide Colour and HDR](/info/hdr-editing.html)**: zachowaj oryginalną precyzję obrazu w Design i Darkroom.
- **[Find and recover your work](/info/find-your-work.html)**: gdzie jest wszystko i jak przenieść to na inne urządzenie.
