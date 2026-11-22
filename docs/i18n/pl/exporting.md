# Wyeksportuj plik

Naciśnij **Export**, lewą połowę pigułki **Export | Save**, wybierz format obok nazwy pliku i naciśnij **Download**. Plik jest tworzony na Twoim urządzeniu.

Plik zawiera to, co widzisz na kanwie. Menu formatów pokazuje tylko to, co dane narzędzie może utworzyć w tej przeglądarce.

Większość zadań wymaga jednego z trzech formatów:

| Przeznaczenie | Wybierz | Powód |
|---|---|---|
| Ekran, wiadomość lub slajd | **PNG** | Każda aplikacja go otwiera, a przezroczyste tło zostaje zachowane, jeśli narzędzie je oferuje |
| Gotowa strona lub coś do druku | **PDF** | Rzeczywisty rozmiar strony, która drukuje się zgodnie z podglądem; **Print PDF**, jeśli narzędzie go oferuje, to wersja CMYK dla maszyny drukarskiej |
| Grafika, która musi być ostra w każdym rozmiarze | **SVG** | Kształty wektorowe |

::: check Sprawdź plik w docelowym rozmiarze
Przed wysłaniem pliku otwórz go na ekranie, dla którego powstał, lub wydrukuj w rzeczywistym rozmiarze.
:::

::: details Zatwierdzanie i dostarczanie w Lolly Work (opcjonalnie)
[Organizacja korzystająca z Lolly Work](/info/organisation.html) może wybrać formaty i ustawienia eksportu widoczne dla jej członków. Gdy wymagane jest zatwierdzenie, **Request approval** pojawia się zamiast **Download**. Stosuj politykę widoczną w Twojej instancji.

Lolly Work może też dostarczać plik do skonfigurowanych miejsc docelowych S3, WebDAV i HTTP, z etapami zatwierdzania, potwierdzeniami dostarczenia i zapisem audytu. Takie dostarczenie wysyła plik do usługi organizacji. Zwykłe pobieranie pozostaje na Twoim urządzeniu. Osobiste miejsca docelowe Send i dostarczanie organizacji konfiguruje się osobno.

Operatorzy konfigurują tę funkcję według [przewodnika dostarczania w organizacji](/info/work-delivery.html). Renderowanie na serwerze z kolejką i zadaniami wsadowymi opisuje [Przetwarzanie wsadowe i automatyzacja w CLI](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

<!--i:eti-cpu-->
## Jak działa eksport

Plik powstaje na trzy sposoby. Większość narzędzi **renderuje kanwę**. Formaty tekstowe i danych (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) są **generowane z zawartości narzędzia**. Narzędzia prywatności, takie jak *Lolly Strip Hidden Data*, **przekształcają wybrany plik** na Twoim urządzeniu. Wynik nie zawiera kanwy, znaku wodnego ani dodanych metadanych.

![Trzy sposoby eksportu prowadzą do gotowego pliku: renderowanie kanwy, generowanie tekstu lub danych z zawartości albo przekształcenie wybranego pliku na urządzeniu.](/info/diagrams/concepts/three-export-paths.svg)

Autor narzędzia wybiera akcje dostępne w panelu eksportu. Domyślny zestaw to Copy, Download i Save.

- <!--i:download--> **Download** zapisuje plik. Jeśli później nie możesz go odnaleźć, zobacz [Znajdź pobrany plik](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> **Copy** umieszcza obraz w schowku. Gdy przeglądarka nie potrafi kopiować obrazów, Copy pobiera plik i Cię o tym informuje.
- <!--i:folder--> **Save** zachowuje bieżący projekt w Projects i nigdy nie pobiera pliku. **Save as** obok **Download** pyta o miejsce (zobacz [Zapisywanie i wznawianie](/info/using.html#saving-continuing)).
- <!--i:link--> **Share** otwiera okno Share: link odtwarzający projekt, przełączniki działania przy odwiedzeniu (pełny ekran, panel eksportu, pobranie lub skopiowanie przy otwarciu) i opcjonalny **Shortest link**, który pakuje stan w zwarty token (zobacz [Tryb URL](/info/url-mode.html)).

**Send to**, karta w panelu eksportu, wysyła plik do podłączonej usługi. Po wysłaniu do Google Drive, Nextcloud, zasobnika S3, Dropbox lub OneDrive **Create a share link** może utworzyć tam link bez ponownego przesyłania. Sekcja **Share through your cloud** w oknie Share wysyła plik `.lolly` i tworzy do niego link w jednym kroku. Panel linku pokazuje, kto może go otworzyć, gdzie znajduje się plik i kiedy link wygasa. **Links you've shared** w oknie Share pozwala zatrzymać udostępnianie. Linki Nextcloud mogą mieć hasło i datę wygaśnięcia. Linki S3 działają od 1 do 7 dni i nie można ich wcześniej unieważnić. Lolly nie przechowuje na serwerze kopii pliku ani tokenu logowania. [Prywatność](/info/privacy.html#every-network-request-the-app-can-make) wymienia, co otrzymuje każda usługa.

![Panel eksportu - format, rozmiar i akcje Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Gdy projekt osadza render innego narzędzia, na przykład boks obrazu Lolly Design zawierający link QR Code, eksport projektu nadrzędnego rysuje zagnieżdżony render. Pozostaje on wektorem w SVG i PDF, a w PNG, JPG i WebP jest rasteryzowany. Osadzony render nie otrzymuje własnego znaku wodnego ani proweniencji; otrzymuje je tylko gotowy plik. Eksporty HTML, Markdown i TXT nie mogą zawierać złożonego renderu.

<!--i:eti-file-->
## Wybierz format

Nazwa pliku i menu formatów tworzą jedną parę `name.format` pod **Download**.

![Pole nazwy pliku połączone z selektorem formatu, dzięki czemu eksport jest widoczny jako jedna para name.format](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Zacznij od miejsca docelowego pliku. Każda karta podaje formaty odpowiednie dla tego miejsca.

::: figure exporting-format-chooser
Sześć miejsc docelowych i odpowiednie dla nich formaty.
:::

Wordmark złożony krojem z Twojego systemu projektowego eksportuje się do SVG, w którym każda litera jest ścieżką konturu. Plik pozostaje ostry w każdym rozmiarze.

Tekst w innym języku zależy od dostępnych czcionek. Jeśli czcionka w Twoim systemie projektowym zawiera dane litery, SVG i PDF rysują je jako kontury, z właściwym kształtowaniem i kolejnością czytania, także w wierszach od prawej do lewej. Jeśli żadna ich nie zawiera, Lolly używa [czcionki zastępczej](/info/fallback-fonts.html), a karta eksportu ją wskazuje. Tekst, którego nie obsługuje żadna czcionka zastępcza, pozostaje w SVG żywym tekstem, rysowanym czcionkami przeglądarki odbiorcy. W PDF, EPS lub WMF oraz w EMF z włączonym **Outline fonts** ten tekst staje się obrazami. Słowa wyglądają tak samo jak na stronie, lecz nie można ich zaznaczyć ani wyszukać. Karta eksportu wymienia te pisma. Dodaj czcionkę z tymi literami, aby zachować je w postaci tekstu wektorowego.

![Wordmark Aurora z bardzo cienkimi literami i szerokimi odstępami, przykład czystej grafiki wektorowej opisanej w wierszu SVG tabeli](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Wszystkie formaty i ich zastosowania
| Potrzebujesz | Użyj | Powód |
|---|---|---|
| Ostrych logo lub skalowalnej grafiki | **SVG** | Wektor: skalowalny, niewielki i edytowalny; efekt niemożliwy do narysowania przez eksport wektorowy jest osadzany jako obraz |
| Wektora do aplikacji Office i Windows | **EMF** | Wkleja się do PowerPoint i Word jako edytowalny wektor z żywym tekstem; Google Drive otwiera go w Google Drawings |
| Wektora do druku i aplikacji projektowych | **EPS** lub **EPS (CMYK)** | Wektor PostScript do Illustrator i procesów drukarskich |
| Wektora do maszyn tnących | **DXF** | Wycinarki laserowe, plotery winylowe i CNC: kontury jako ścieżki w milimetrach |
| Edytowalnej prezentacji | **PowerPoint** (PPTX) | Edytowalne natywne teksty i kształty oraz obrazy i wektory, które można wyodrębnić |
| Edytowalnego dokumentu tekstowego | **Word** (DOCX) lub **OpenDocument** (ODT) | Akapity i nagłówki do dalszej edycji w edytorze tekstu (Lolly Doc Studio) |
| Układu do InDesign | **InDesign IDML (static subset)** | Tekst, prostokąty, owale i obrazy, po jednej rozkładówce na obszar roboczy (Lolly Design) |
| Edytowalnego dokumentu Penpot | **Penpot** | Plansze, kształty, tekst oraz powiązane tokeny |
| Zdjęcia lub obrazu ogólnego przeznaczenia | **PNG** (bezstratny) lub **JPG** (mniejszy) | Uniwersalny format rastrowy |
| Mniejszych obrazów w nowoczesnym formacie | **WebP** lub **AVIF** | Lepsza kompresja z zachowaniem przezroczystości |
| Druku | **PDF** lub **Print PDF** (CMYK) | Rzeczywisty rozmiar strony; CMYK do druku na maszynie |
| Rastra do druku na maszynie | **Print TIFF** (CMYK) | Piksele w DeviceCMYK dla RIP |
| Animacji do internetu | **GIF** | Działa wszędzie; większy rozmiar plików |
| Animacji z pełnym kolorem i rzeczywistą przezroczystością | **APNG** | Animowany PNG bez ograniczenia palety |
| Animacji w najmniejszym pliku | **Animated WebP** | Pełny kolor i przezroczystość w pliku mniejszym niż GIF lub APNG |
| Skalowalnej animacji wektorowej | **Animated SVG** | Samodzielny plik; zapętla się w przeglądarce lub `<img>` w każdym rozmiarze (Lottie Ad) |
| Animacji do dalszej edycji | **dotLottie** | Kształty, ścieżki i zewnętrzne klatki kluczowe transformacji z osi czasu Lolly Design |
| Przekazania do Premiere | **Premiere XML + media** | Klipy z określonym czasem i oryginalne media do Premiere (Lolly Design) |
| Wideo do mediów społecznościowych i udostępniania | **MP4** lub **WebM** | Najlepsza jakość w stosunku do rozmiaru pliku (zobacz [Wideo](#video)) |
| Napisów | **SRT** lub **VTT** | Tekst z czasem wyświetlania do odtwarzacza wideo (Captions, Audiogram i Record) |
| Napisów do emisji | **TTML** lub **SCC** | Tekst z czasem wyświetlania IMSC1.1 lub napisy pop-on CEA-608 (Captions; zobacz [Napisy do emisji](#broadcast-captions)) |
| Kursu szkoleniowego | **SCORM (LMS)** | Wersjonowana strona internetowa, pakiet SCORM lub xAPI (zobacz [SCORM](#scorm-course-packages)) |
| Tekstu formatowanego lub podpisu e-mail | **HTML** | Wkleja się do klientów poczty z formatowaniem |
| Animacji odtwarzanej w przeglądarce | **HTML** | Odtwarzacz w jednym pliku, z osi czasu Lolly Design lub Snippet (zobacz [Wideo](#video)) |
| Samej treści | **MD** lub **TXT** | Wyłącznie tekst |
| Wydarzenia w kalendarzu | **ICS** | Można zaimportować do każdej aplikacji kalendarza |
| Wizytówki kontaktu | **VCF** | Można zaimportować do książek adresowych |
| Danych strukturalnych do ponownego importu | **JSON** lub **CSV** | Zachowuje zawartość narzędzia do eksportu i ponownego importu |
| Ikony witryny | **ICO** | Ikona witryny w wielu rozmiarach; **ZIP** zawiera kilka formatów |
:::

### Przezroczystość

Narzędzia, które ją obsługują, oferują przełącznik przezroczystego tła, taki jak **No BG**. PNG, WebP, AVIF, SVG, APNG i Animated WebP zachowują przezroczystość, a GIF zachowuje ostrą krawędź. JPG i PDF są zawsze nieprzezroczyste. TIFF jest spłaszczany na bieli lub na czerni przy eksporcie [HDR](#hdr-bright-colours).

<!--i:eti-crop-->
## Rozmiar i jednostki druku

Eksporty używają natywnego rozmiaru narzędzia w pikselach, chyba że narzędzie oferuje **wymiary**. Wtedy ustawiasz szerokość, wysokość i **jednostkę**:

- **px** (domyślna) oznacza dokładną liczbę pikseli.
- **mm, cm, in, pt** i **pc** to wymiary fizyczne. Przy jednostce fizycznej ustawiasz też **DPI** (domyślnie 300). **PDF** staje się rzeczywistą stroną w tym rozmiarze. **Raster** otrzymuje liczbę pikseli dla danego DPI i zapisuje rozdzielczość. **SVG** zachowuje jednostkę fizyczną z viewBox w pikselach.

Aby uzyskać raster o wyższej rozdzielczości, wpisz większą szerokość i wysokość lub wybierz jednostkę fizyczną i zwiększ DPI (piksele = rozmiar × DPI). Szerokość `210`, wysokość `297` i jednostka `mm` tworzą stronę A4.

![Wiersz wymiarów ustawiony na 210 na 297 mm, z polem DPI widocznym dzięki wybraniu jednostki fizycznej](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

<!--i:eti-images-->
## Obrazy statyczne z kompozycji czasowej

Z kompozycji czasowej, takiej jak oś czasu [Sequence](/info/sequence-editor.html) w Lolly Design, eksport obrazu statycznego pobiera **klatkę pod głowicą odtwarzania**. Ustaw głowicę w wybranym miejscu i wyeksportuj obraz.

Aby uzyskać więcej niż jeden moment, użyj pola **Frames** obok rozmiaru wyjściowego. Pojawia się tylko dla kompozycji czasowej i formatu statycznego (PNG, JPG, WebP, SVG lub PDF). `1` daje klatkę pod głowicą. Większa liczba daje tyle obrazów statycznych, równomiernie rozmieszczonych w sekwencji:

- PNG, JPG, WebP i SVG są zwracane w jednym ZIP: `<name>-01.png`, `-02.png` i tak dalej.
- PDF jest zwracany jako jeden dokument z tyloma stronami.

Każdy obraz pochodzi ze środka swojego odcinka osi czasu, więc pierwszy nigdy nie jest częściowo widocznym wejściem, a ostatni pustą chwilą po zakończeniu klipów.

::: figure exporting-contact-sheet
Frames: 4 dzieli sekwencję na cztery równe odcinki i pobiera środek każdego z nich.
:::

Użyj Frames do scenorysu, stykówki do przeglądu lub karuzeli do mediów społecznościowych wyciętej ze zmontowanego wideo. Limit wynosi 64. Każda inna wartość wpisana w pole przywraca `1`. Każda klatka jest zwykłym obrazem statycznym, więc poświadczenia, Imprint, jednostki fizyczne i DPI działają tak jak przy pojedynczym eksporcie. Link eksportu, CLI i MCP zamawiają tę samą stykówkę przez `cuts=` (zobacz [Stykówki](/info/url-export.html#contact-sheets)).

<!--i:eti-copy-->
## Wiele plików naraz

Lolly oferuje trzy sposoby pracy na większą skalę:

::: cols
## Tabela staje się jednym dokumentem
Narzędzie zaprojektowane do dzielenia tabeli wejściowej na strony zamienia każdy wiersz w stronę. Wklej tabelę z arkusza kalkulacyjnego, aby otrzymać jeden PDF. Aby poprawić wiersze, edytuj arkusz i wklej ponownie. Narzędziem referencyjnym jest Battlecards. Znajduje się w otwartym folderze `community` i nie jest wymienione na lolly.tools.
## CSV staje się osobnym plikiem dla każdego wiersza
**Batch** (`#/batch`) przyjmuje CSV i renderuje jeden eksport dla każdego wiersza, na przykład identyfikatory lub certyfikaty, dostarczane w ZIP. Zobacz [Lolly Batch](/info/batch.html#make-many-versions-of-one-design).
## Kilka projektów otrzymuje tę samą zmianę
**Lolly Multi-edit** otwiera kilka zapisanych sesji obok siebie, aby w każdej wprowadzić tę samą zmianę. Zobacz [Lolly Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Narzędzie z kilkoma stronami, takie jak Booklet, Print Sheet, Lolly Doc Studio lub Lolly Markdown Slides, eksportuje PNG, JPG, WebP, SVG i inne formaty pojedynczego obrazu jako osobny plik dla każdej strony, w ZIP, gdy stron jest kilka. Print Sheet zachowuje cały arkusz i znaczniki cięcia przy wybranym DPI.

W **Projects** akcja **Render folder** eksportuje każdą zapisaną sesję z folderu i jego podfolderów do jednego ZIP z zachowaniem struktury folderów. **Render selection** robi to samo dla wielu zaznaczonych elementów. Każda zapisana sesja renderuje się do własnego pliku. Projects może też ponownie udostępnić zapisaną sesję jako link narzędzia, który otwiera ją z tymi samymi ustawieniami.

<!--i:eti-pen-->
## Pliki, które pozostają edytowalne w innych aplikacjach

Niektóre formaty przekazują Twoją pracę do innej aplikacji jako edytowalną zawartość zamiast obrazu.

### PowerPoint (PPTX)

Lolly Design, Lolly Markdown Slides, Booklet, Lolly Doc Studio, Lolly Chart, Diagrams, Flow Chart i Agenda eksportują prezentację PowerPoint, po jednym slajdzie na stronę. Każda strona jest dzielona na natywne obiekty, które współpracownik może edytować i wyodrębniać:

- <!--i:font--> **Tekst** staje się edytowalnymi polami tekstowymi PowerPoint z rozmiarem czcionki, kolorem, grubością, kursywą i wyrównaniem z układu. Prezentacja Lolly Design ustawia krój marki dla każdego fragmentu tekstu, nawet bez wzorca slajdów.
- <!--i:pentool--> **Wektory**, takie jak logo i ikony, są osadzane jako obrazy SVG, a PowerPoint może wykonać na nich *Convert to Shape*.
- <!--i:photos--> **Obrazy** są przenoszone jako osobne obrazy w natywnej rozdzielczości. Przycięty obraz główny zachowuje pełny obraz poza kadrem. Każdy filtr lub tryb mieszania obrazu jest utrwalany.
- <!--i:layers--> **Tła, obramowania i linie oddzielające** stają się kształtami prostokątów i linii. Koła, elipsy i pigułki z Lolly Design pozostają natywnymi, edytowalnymi kształtami.

![Panel eksportu z wybranym PowerPoint: jeden slajd na stronę, tekst i kształty pozostają edytowalne](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Układ jest przybliżony. Wszystko, czego mechanizm przechodzenia po elementach nie potrafi wyrazić natywnie, na przykład złożony obszar z filtrem lub maską, jest osadzane jako obraz. Prezentacja ma jeden rozmiar slajdu, pobrany z pierwszej strony.

PowerPoint służy też do importu: [Dostosuj prezentację do marki](/info/rebrand.html) przenosi prezentację do Twojego systemu projektowego, a [Importuj projekt](/info/design-import.html) otwiera ją w Lolly Design.

### Penpot

Większość narzędzi eksportujących SVG eksportuje też **plik Penpot** (`.penpot`).

| Co powstało | W Penpot |
|---|---|
| Tekst | Edytowalne obiekty tekstowe |
| Kształty, ścieżki, gradienty i obrazy | Edytowalne kształty wektorowe |
| Kolor lub czcionka z tokenu systemu projektowego | Aktywne powiązanie z tokenem: edytuj token, a każdy kształt, który go dziedziczy, się zmieni |
| Cały projekt | Komponent wielokrotnego użytku w panelu Assets |
| Złożona ilustracja lub kanwa na żywo | Osadzony obraz; zawartość wokół niego pozostaje edytowalna |

W eksporcie z Lolly Design każda ramka staje się planszą Penpot. Kolory i typografia systemu projektowego trafiają do panelu Assets, a cały zestaw tokenów do panelu Tokens. Penpot zachowuje własną kopię. Token edytowany w Penpot wraca przez import w [Lolly Design System Setup](/info/brand-studio.html).

![Panel eksportu z wybranym Penpot: plik .penpot i Send to Penpot obok pobierania](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Aby otworzyć plik, uruchom Penpot, wybierz projekt i **Import**. Jeśli zalogujesz się do Penpot z panelu eksportu, **Send to Penpot** zaimportuje plik za Ciebie.

### Word, OpenDocument i InDesign

**Lolly Doc Studio** eksportuje **Word** (DOCX) i **OpenDocument** (ODT) z edytowalnymi akapitami i nagłówkami. Plik Word ustawia czcionki i kolor tekstu marki przez style dokumentu, zachowuje wybrany rozmiar strony i dodaje PNG obok logo SVG dla aplikacji, które nie potrafią rysować SVG.

**Lolly Design** eksportuje **InDesign IDML (static subset)**: tekst, prostokąty, owale i obrazy PNG lub JPEG, po jednej rozkładówce na obszar roboczy. Obsługiwane formatowanie wewnątrz tekstu pozostaje edytowalne, obrazy są dołączane w `Links`, a współrzędne stają się punktami InDesign. Ponowne łączenie plików, podmiana czcionek i zmienione zawijanie tekstu mogą wymagać uwagi. Efekty, animacja, złożone wątki tekstowe i nieobsługiwana geometria zatrzymują eksport z raportem, który je wymienia. IDML nie zachowuje oryginalnego dokumentu. Gotową grafikę wysyłaj jako PDF.

### Osie czasu: dotLottie i Premiere

Z osi czasu Lolly Design **dotLottie** zapisuje animację, która pozostaje edytowalna w narzędziach Lottie; [Animacje Lottie](/info/sequence-editor.html#lottie-animations) wymienia, co zachowuje. **Premiere XML + media** pakuje klipy z określonym czasem i ich oryginalne media do Premiere; zobacz [Wymiana Premiere XML](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (pakiety kursów)

Eksport kursów jest wyłączony, dopóki nie włączysz **Training and courses** w Settings → Preferences → Feature flags.

Następnie wybierz **Export course** w obsługiwanym narzędziu, folderze projektu lub zaznaczeniu. W Lolly Design wybranie **SCORM (LMS)** i **Download** otwiera ten sam proces tworzenia kursu. Lolly zapisuje pracę, pokazuje zawartość i kolejność kursu do sprawdzenia, a następnie otwiera moduł i jego okno eksportu.

- <!--i:layers--> Wybierz sposób przedstawienia każdego źródła: statyczne strony, ruch jako wideo, dźwięk lub zasób do pobrania. Dodaj w module tekst lekcji i alternatywne wersje do czytania.
- <!--i:clock--> Obejrzyj podgląd odtwarzacza dla uczestnika i sprawdź opisy oraz napisy. Ruch, także niema animacja, jest dołączany jako wideo.
- <!--i:document--> Wybierz Website, SCORM 1.2, SCORM 2004 4th Edition lub eksperymentalny cel xAPI. Sprawdź zawartość i rozmiar ZIP, a następnie zapisz i pobierz sprawdzoną wersję.
- <!--i:check--> Ukończenie wymaga potwierdzenia każdej wymaganej lekcji i wybrania Finish.

![Panel eksportu prezentacji Lolly Design z wybranym SCORM (LMS)](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Pakiet zawiera gotową treść i nie wymaga konta Lolly. Umieść ZIP Website na hoście HTTP(S); zaimportuj ZIP LMS bez zmian. Przetestuj miejsce docelowe, zanim udostępnisz kurs. Kurs z kilku zapisanych prac opisuje [Tworzenie kursu szkoleniowego](/info/training-creators.html).

### Napisy do emisji

Narzędzie Captions może też eksportować **TTML** i **SCC**. Oba są zapisywane z tej samej listy napisów co pliki SRT i VTT, więc słowa i czasy są zgodne.

- **TTML** to IMSC1.1 Text Profile, z czasami zegarowymi na osi czasu mediów i jednym obszarem pośrodku u dołu. Nie zawiera koloru, czcionki ani pozycji poszczególnych napisów, ponieważ napisy Lolly przechowują tylko początek, koniec i tekst.
- **SCC** zawiera napisy pop-on CEA-608 na kanale 1 przy 29,97 klatki na sekundę z kodem czasowym drop-frame. Obsługuje podstawowe znaki północnoamerykańskie oraz znaki specjalne i rozszerzone. Jeśli napis zawiera znak spoza tego zestawu, eksport zatrzymuje się i wskazuje ten znak. Każdy napis jest zawijany do 32 kolumn i najwyżej 15 wierszy. Napis, którego nie można załadować przed czasem rozpoczęcia, jest opóźniany o kilka klatek.
- Napisy roll-up i paint-on nie są zapisywane.

::: note SCC nie został sprawdzony w narzędziu emisyjnym
Nie został też wypróbowany na dekoderze sprzętowym. Przed dostarczeniem przetestuj plik we własnym procesie produkcyjnym.
:::

### DXF (pliki do cięcia)

Lolly Asset Export, Diagrams, Growth, Lolly Logo Wall, QR Code, Street Map, Wayfinding i Wordmark eksportują **DXF**, format wymiany AutoCAD R12 odczytywany przez wycinarki laserowe, plotery winylowe i oprogramowanie CNC. Geometria jest zapisywana jako ścieżki konturów w milimetrach, a tekst jest zamieniany na kontury. Kolor jest mapowany na najbliższy AutoCAD Color Index, który zwykle steruje pracą wycinarki. DXF zawiera tylko grafikę liniową: obszar fotograficzny lub z filtrem nie ma ścieżki cięcia i jest pomijany z ostrzeżeniem. Użyj SVG lub PDF, aby zachować zawartość rastrową. Tekst, którego nie obsługuje żadna czcionka, nawet [czcionka zastępcza](/info/fallback-fonts.html), zatrzymuje eksport z komunikatem cytującym ten tekst.

Projekt Street Map składa się wyłącznie z obrysów, więc każda droga i kanał stają się ścieżką cięcia.

::: showcase
![Render Paryża w Street Map w kolorze tuszu na kremowym tle - czysta grafika liniowa, więc każdy obrys zostaje zachowany przy przekazaniu do wycinarki](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Przewiń, a kamera oddali się przez geometrię: siedem ścieżek i ani jednego piksela. Wycinarka odczytuje ten sam plik.
:::

<!--i:eti-stamp-->
## Druk

**Print PDF** zapisuje CMYK dla nazwanych warunków druku, domyślnie **Coated FOGRA39**. Próbki kolorów marki ze zmierzonymi wartościami farb zachowują te wartości. Inne kolory są konwertowane przez profil druku: domyślnie własny profil Coated FOGRA39 Lolly lub Twój profil po wybraniu jego wiersza **Embed**. Szarości i czerń pozostają wyłącznie na czarnej formie drukowej, więc mały tekst nie może mieć błędów pasowania. FOGRA51, SWOP i GRACoL używają standardowej konwersji urządzenia. Czarny tekst jest też nadrukowywany na kolorze pod nim, więc drobne przesunięcie na maszynie nie zostawia białej obwódki wokół liter. **Print TIFF** zapisuje piksele DeviceCMYK dla RIP. Kontrolka Colour profile steruje oboma formatami ([Profile kolorów](#colour-profiles)). Print TIFF i **EPS (CMYK)** rozdzielają kolory przez ten sam profil druku co Print PDF.

**Print marks & bleed** ma własną kartę w formatach druku: spad w milimetrach oraz Crop, Registration, Bleed, Colour bars i Stamp details. Stamp details drukuje na marginesie datę, narzędzie i Twoje imię i nazwisko. Imię i nazwisko lub nazwa narzędzia zawierające znaki, których brakuje w czcionce marginesu, takie jak znaki arabskie, chińskie, cyrylica lub emoji, są rysowane jako obraz w tej samej szarości. Karta eksportu wymienia te pisma.

Niektóre narzędzia, takie jak *Booklet*, tworzą **wielostronicowy PDF**: okładkę, treść płynącą na tyle stron, ile potrzebuje, i stronę tylną. Każda strona jest rzeczywistą pionową stroną PDF w A4, US Letter lub A5. Możesz wymusić rozpoczęcie dowolnego bloku na nowej stronie. Są to dokumenty RGB bez znaczników cięcia lub spadu; te znaczniki należą do jednostronicowego Print PDF. PDF z Lolly Design może być też **Notes handout**: pionową stroną dla każdego slajdu z notatkami prelegenta pod nim.

**Przed eksportem.** Karta **Before you export** u dołu panelu pokazuje to, co zobaczy drukarnia: format, rozmiar i spad, obszary przycięcia i spadu, pokrycie farbą, liczbę form drukowych i stron, z oceną obok nagłówka. Karta nigdy nie blokuje eksportu. Lolly Design zawsze pokazuje kartę z własnymi kontrolami, w tym zasadami organizacji z systemu projektowego sprawdzanymi warstwa po warstwie i wskaźnikiem jakości pisania dla tekstu dokumentu ([Przed eksportem](/info/design.html#before-you-export)). Lolly Design dodaje te kontrole druku, gdy włączone jest **Print preflight**. W innych narzędziach włącz **Print preflight** w Settings → Preferences → Feature flags. Domyślnie jest wyłączone, a wdrożenie Lolly Work może włączyć je dla swoich członków.

**Po eksporcie.** Lolly ponownie odczytuje gotowy plik i porównuje go z Twoimi wyborami: format, rozmiar w pikselach lub rozmiar strony, długość klipu, przezroczyste tło, kolor CMYK, HDR, Content Credentials i hasło PDF lub ZIP. Każda różnica jest zapisywana na karcie eksportu. Każdy pomiar pochodzi z pliku, nigdy z ustawienia. Właściwość, której nie można ustalić na podstawie pliku, nie jest uznawana za zgodną. Wiersz poleceń zapisuje pełne porównanie przez `--export-report` (zobacz [Renderowanie przez CLI](/info/cli-rendering.html)).

::: details Kontrole dostępności PDF z wiersza poleceń
**Kontrole dostępności PDF.** Dla PDF wiersz poleceń wymienia też 32 kontrole dostępności w pliku `--export-report`, w `pdfAccessibility`. Każda kontrola ma identyfikator, prosty opis, wynik i miejsce w pliku, w którym znaleziono problem:

- **Passed**: kontrola sprawdziła dany element i nie znalazła błędów.
- **Failed**: kontrola znalazła problem. Podane są numery stron lub znaczniki.
- **Not applicable**: plik nie zawierał elementów danego rodzaju do sprawdzenia, na przykład przy kontroli tabel w pliku bez tabel. Nie mówi to nic o pliku.
- **Needs a person**: sześciu kontroli nie może ocenić program (kolejność czytania, kontrast kolorów, miganie, skrypty, limity czasu i powtarzające się linki).

Lista nie jest oceną końcową. Nie stwierdza, że PDF spełnia PDF/UA ani że osoby korzystające z technologii wspomagających mogą go używać. Człowiek nadal musi sprawdzić plik czytnikiem ekranu. Własne pliki PDF Lolly obecnie nie przechodzą kontroli znaczników, ponieważ eksportery jeszcze ich nie zapisują. Kontrola odczytuje plik na Twoim urządzeniu i niczego nie zmienia. Pliki wymagające hasła są oznaczane jako niesprawdzone, a nie jako sprawdzone pomyślnie. Aby sprawdzić otrzymany PDF, upuść go w [Lolly Strip Hidden Data](/info/utilities.html), które pokazuje tę samą listę w **PDF accessibility checks**.
:::

Kontrole Inspectora w Lolly Design i porównanie marki w Lolly Design System Setup sprawdzają projekt. Te dwie karty sprawdzają plik.

::: details Koszt na podstawie cennika
Pod kontrolą przed drukiem karta kosztów przelicza te same liczby na pieniądze, nawet gdy karta kontroli przed drukiem jest wyłączona. Potrzebuje dwóch rzeczy: zadania, które da się wycenić według cennika (formy drukowe, arkusze, powierzchnia, strony, wiersze wariantów lub pliki wyjściowe, więc przy zwykłym logo PNG karta nigdy się nie pojawia), i **cennika**, czyli listy cen w JSON od Twojej drukarni. Domyślna kompilacja nie zawiera cennika i nie ma w aplikacji sposobu na jego wczytanie. Cennik trafia do niej jako zasób katalogowy dostarczany z wdrożeniem lub przez opcjonalne rozszerzenie cennika włączane przez administratora własnej instancji lub warstwę sterowania. Bez cennika nic się nie wyświetla.

Każda kwota to podana przez Ciebie stawka pomnożona przez ilość policzoną przez Lolly, na przykład `4 plate × €35.00`. Suma pokazuje swoje źródło: wystawcę cennika i datę stawek. Nie ma domyślnej waluty ani zastępczej ceny. To, co plik mówi o sobie, pozostaje przytoczoną informacją: *„Plik podaje: … Lolly tego nie zweryfikowało.”*

Gdy kwoty nie można obliczyć, tabela jest usuwana zamiast wypełniana:

- Pozycje bez ceny w cenniku oznaczają **całkowity brak sumy**, a jedynie nagłówek z liczbą niewycenionych pozycji.
- Ilość będąca górną granicą przenosi **„do”** do swojej sumy częściowej.
- Stawki po terminie ważności pokazują **tylko ilości**, dopóki nie naciśniesz *Use these rates anyway*; data wygaśnięcia pozostaje wtedy przy kwocie.
- Przy otwarciu przez **link** kwoty pozostają ukryte, dopóki nie poprosisz o nie na tym urządzeniu. CLI przyjmuje `--rate-card=<file.json>` jako lokalny plik, nigdy jako parametr linku.

Karta jest usuwana z każdego etapu eksportu i nigdy nie zmienia pliku. To obliczenie, nie oferta cenowa. Ofertę może przedstawić tylko Twoja drukarnia.
:::

<!--i:eti-film-->
## Ruch i dźwięk

### Wideo

Narzędzia animowane eksportują **MP4** i **WebM**. Udostępniony link `?format=`, który żąda kontenera niemożliwego do utworzenia w tej przeglądarce, używa drugiego formatu z odpowiednią nazwą pliku. **Start after** utrzymuje kanwę nieruchomo, aby animacje i czcionki ustabilizowały się przed nagrywaniem. **Duration** ustawia długość gotowego klipu. **Motion blur** (Off, Draft quality, Standard lub High, z **Shutter angle**) rozmywa szybki ruch i spowalnia renderowanie. Jeśli przeglądarka to obsługuje, **Record live** nagrywa podgląd z ekranu w czasie rzeczywistym przez udostępnianie ekranu.

![Ustawienia czasu dla eksportu animacji: Start after, Duration, Motion blur z Shutter angle i Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** pozwala wybrać Smaller file, Balanced lub Best quality. **Advanced** otwiera **Codec**, **Frame rate**, **Rate mode** i **Hardware acceleration**. Jeśli narzędzie ma napisy, **Captions** pozwala wybrać **Embedded track** lub **Sidecar .vtt + .srt** obok wideo. Link zawiera jakość, kodek, liczbę klatek na sekundę, czas trwania i opóźnienie rozpoczęcia jako `vq`, `codec`, `fps`, `seconds` i `wait` ([Parametry URL](/info/url-parameters.html)).

Eksporty wideo zachowują dźwięk. Narzędzie może dodać **podkład muzyczny** pod klip: zasób audio zapętlony lub przycięty do długości klipu, z płynnym narastaniem i wyciszaniem, głośnością i automatycznym ściszaniem pod własnym dźwiękiem materiału. Narzędzia nagrywające przenoszą do pliku dźwięk rejestrowany na żywo.

Prezentacja Lolly Design przełączana kliknięciami może być też eksportowana jako wideo. **Export slides as video** w menu Present otwiera panel eksportu z MP4. Każdy slajd jest odtwarzany przez własny czas wyświetlania lub przez Duration z panelu eksportu, jeśli nie ma własnego czasu. Przejście prezentacji jest odtwarzane między slajdami jako przenikanie. Dokument się nie zmienia.

**HTML** z dokumentu Lolly Design z osią czasu lub ze Snippet to odtwarzacz w jednym pliku: kontrolki odtwarzania, przewijania i dźwięku nad animacją, z osadzonymi obsługiwanymi czcionkami, obrazami i dźwiękiem. Plik odtwarza się offline. Film Lolly Design ze scenami dodaje menu swoich scen. Sekwencji zawierającej wideo, Lottie lub klip 3D nie można jeszcze wyeksportować jako HTML; wyeksportuj ją jako wideo.

### Animowane obrazy

**GIF** odtwarza się wszędzie i nadaje się do czatu i e-maili; jest większy i ma mniej kolorów niż wideo. **APNG** i **Animated WebP** zachowują pełny kolor i przezroczystość. **Lottie Ad** eksportuje też **Animated SVG**: klatki wektorowe z osadzonymi klatkami kluczowymi CSS, które skalują się do dowolnego rozmiaru i zapętlają w karcie przeglądarki lub `<img>` bez kodeka. Tekst jest zamieniany na kontury. Domyślna liczba klatek na sekundę jest niższa, ponieważ każda klatka zajmuje więcej miejsca niż bitmapa. Wszystkie te formaty są bez dźwięku.

### Dźwięk

Niektóre narzędzia eksportują sam dźwięk. **Lolly Voice Recorder** nagrywa ujęcie z mikrofonu z miernikiem poziomu na żywo i zapisuje je jako **MP3**, **WAV**, **M4A (AAC)** lub **Opus (WebM)**, kodowane na Twoim urządzeniu. `wav`, `mp3`, `m4a` i `opus` to zwykłe identyfikatory formatów, więc eksport audio można udostępniać i obsługiwać skryptami tak samo jak PNG.

Selektor zasobów przyjmuje wiele formatów audio na podkład muzyczny, od MP3 i FLAC po MIDI i moduły trackerów; wymienia je strona [Formaty](/info/formats.html). [Utwór Lolly Rondocode](/info/rondocode.html) jest odtwarzany przez czas określony w jego klipie.

<!--i:eti-palette-->
## Kolor i HDR

Lolly odczytuje każdy nowoczesny kolor CSS, wykonuje obliczenia kolorów w sposób percepcyjny i zapisuje każdy plik w przestrzeni obsługiwanej przez odbiorcę: sRGB na ekrany, CMYK do druku i Rec.2100 PQ dla HDR ([Kolor w silniku](/info/colour-engine.html)). Dokument Lolly Design ustawiony na **Wide colour / HDR** ma własne zasady: zobacz [Edycja szerokiej gamy kolorów i HDR](/info/hdr-editing.html).

### Profile kolorów

Eksporty są oznaczane profilem kolorów, więc aplikacje zarządzające kolorem, takie jak oprogramowanie drukarni, Photoshop i przeglądarki, odczytują kolory tak, jak je widzisz. Miniatury i podglądy pomijają profil, aby pozostać małe.

- **PNG i JPG** zawierają osadzony profil ICC **sRGB**, czyli przestrzeń, w której rysowany jest podgląd. Piksele są oznaczane, a nie ponownie kodowane.
- **Print PDF (CMYK)** deklaruje warunki druku w swoim *OutputIntent*, informując drukarnię, jak należy interpretować farby CMYK.
- **Print TIFF (CMYK)** zapisuje nieoznaczone piksele DeviceCMYK i warunki druku w metadanych TIFF. TIFF nie może osadzić profilu druku, więc wiersz **Embed** zapisuje tylko nazwę tego profilu.
- **TIFF (RGB)** to nieskompresowana wersja sRGB do archiwum lub edycji i ponownego importu. Oba formaty TIFF są dostępne tylko na komputerach, ponieważ przeglądarki nie mogą wyświetlać podglądu TIFF.
- **SVG**, **EMF**, **EPS** i **DXF** to wektory bez osadzonego profilu: kolory SVG są w sRGB, EMF i EPS używają RGB urządzenia, **EPS (CMYK)** zapisuje DeviceCMYK, a DXF używa AutoCAD Color Index. SVG, EPS i DXF zamieniają tekst na ścieżki konturów. EMF zachowuje żywy, edytowalny tekst w Office i Google Slides, a na kontury zamienia tylko fragmenty, których format nie może wyrazić. Opcja **Outline fonts** w panelu eksportu wymusza ścieżki wszędzie, tak jak `_text=outline` w linku i `--text=outline` w wierszu poleceń. SVG odtwarza też wewnętrzne i zewnętrzne cienie boksów CSS.

::: details PDF/X-4 i własny profil druku
Lolly dostarcza jeden profil CMYK, dopasowany do danych charakteryzacyjnych FOGRA39 organizacji Fogra i udostępniony na CC0, i konwertuje przez niego kolory dla domyślnych warunków druku. Profil nie jest osadzany, ponieważ ma wersję ICC 4.3, a PDF/X-4 akceptuje wersje do 4.2. Nazwane warunki druku zapisują więc warunki wyjściowe bez deklarowania zgodności z PDF/X-4.

Wczytaj własny profil CMYK i wybierz jego wiersz **Embed** w kontrolce Colour profile. Zostaje osadzony jako *DestOutputProfile* pliku, a PDF deklaruje PDF/X-4, jeśli pozostała zawartość pliku na to pozwala. Deklarowane warunki druku są odczytywane z tego profilu: zarejestrowana nazwa, gdy profil ją potwierdza, lub `Custom` pod własną nazwą profilu.

Trzy rzeczy uniemożliwiają tę deklarację, zachowując warunki wyjściowe: grafika RGB, której etap CMYK nie zdołał skonwertować, tekst informacji o autorstwie na marginesie wydruku próbnego `prov` (rysowany standardową czcionką, która nie jest osadzona) i hasło **Strong**, ponieważ PDF/X-4 zabrania szyfrowania. Każdy PDF zawiera też metadane PDF/X-4: pola strony, XMP, identyfikator dokumentu i warunki wyjściowe sRGB z profilem.
:::

### Farby dodatkowe jako procesowe

System projektowy może przypisać kolorowi farbę dodatkową, na przykład kolor Pantone lub HLC. **Print PDF** drukuje wtedy ten kolor na osobnej płycie. Lolly Demo przypisuje farbę dodatkową każdemu kolorowi poza bielami Sugar i Daylight oraz czernią Void. Print PDF utworzony w Lolly Demo drukuje większość kolorów na płytach farb dodatkowych, a czerń na płycie czerni.

Aby uzyskać zwykły plik czterokolorowy, zaznacz **Print spot inks as process** na karcie Profile w panelu eksportu. Każda farba dodatkowa jest wtedy drukowana przy użyciu cyjanu, magenty, żółci i czerni, według składowych CMYK przypisanych temu kolorowi przez system projektowy. Kolor bez własnych składowych podlega konwersji według profilu maszyny drukarskiej, jak każdy inny kolor w projekcie. Plik ma wtedy tylko cztery płyty procesowe. Ta opcja jest domyślnie wyłączona. Panel pokazuje to pole tylko dla **Print PDF** i tylko wtedy, gdy system projektowy przypisuje kolorowi farbę dodatkową.

Wykończenie nie jest farbą. Folia, tłoczenie wypukłe, tłoczenie wklęsłe, lakier wybiórczy, soft touch, wykrawanie, bigowanie i perforacja zachowują własne nazwane płyty przy zaznaczonym polu, ponieważ druk wykończenia w kolorach procesowych umieściłby jego czarną maskę na stronie.

Karta **Before you export** i `lolly preflight` zliczają płyty, które będzie zawierał plik. Przy zaznaczonym polu zliczają cztery płyty procesowe i ewentualne płyty wykończeń oraz informują, że farby dodatkowe są drukowane jako procesowe i nie dodają płyt. Przy niezaznaczonym polu zliczają do jednej płyty dodatkowej na każdą farbę dodatkową przypisaną przez system projektowy. Cennik wycenia te liczby, więc nigdy nie wycenia płyty dodatkowej, której nie będzie w pliku.

Formaty **Print TIFF** i **EPS (CMYK)** nie mają nazwanych płyt, więc drukują każdą farbę jako procesową niezależnie od tej opcji. Dla tych dwóch formatów karta i `lolly preflight` zliczają cztery płyty procesowe i nigdy nie uwzględniają płyty dodatkowej ani płyty wykończenia. Wykończenie trafia do nich jako czarna maska na płycie czerni, a karta zgłasza to jako błąd.

Link żąda tego samego pliku przez `_spots=process`, wiersz poleceń przez `--spots=process`, [serwer MCP](/info/mcp.html) przez `spots: "process"`, a aplikacja terminalowa przez wiersz **Spot inks**. Informacja o tym wyborze nie trafia do pliku: zmieniają się tylko farby.

### HDR (jasne kolory)

Karta **HDR** w panelu eksportu rozjaśnia zwykłe projekty na potrzeby ekranów HDR. Aby zachować oryginały HDR podczas edycji, zobacz [Edycja w szerokiej gamie kolorów i HDR](/info/hdr-editing.html).

Zwykły eksport używa sRGB: nasycony kolor marki jest tak jasny jak standardowa biel ekranu. Wyświetlacz HDR może świecić jaśniej. Karta **HDR** wzmacnia kolory marki i biały tekst w kierunku szczytowej jasności. Ciemne obszary pozostają ciemne.

![Włączona karta HDR w panelu eksportu, z widocznymi pod nią pokrętłami White / Reach / Dark lift / Focus](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formaty.** PNG, JPG, AVIF i TIFF. WebP jest 8-bitowy i nie ma działającej ścieżki dekodowania HDR, a formaty wektorowe i PDF nie mają modelu HDR.
- **Domyślnie wyłączone**, ponieważ zmienia piksele. Zaznacz kartę lub przekaż `hdr=1` w linku udostępniania.
- **Pokrętła.** **White** (górna granica szczytowej jasności, od 400 do 2000 nitów), **Reach** (jak daleko w ciemniejsze tony sięga poświata), **Dark lift** (jak bardzo rozjaśniają się ciemne tony; `0` pozostawia je ciemne) i **Focus** (ile nasycenia kolorów zachowuje wzmocnienie). Są przekazywane jako jedna wartość: `hdr=1600-60-0-50` oznacza White 1600, Reach 60, Dark lift 0 i Focus 50.
- **Co jest zapisywane.** PNG otrzymuje 16-bitowe Rec.2100 PQ z blokiem `cICP`. JPG to JPEG z mapą wzmocnienia zgodny z ISO 21496-1: zwykły obraz SDR z dołączoną mapą wzmocnienia. AVIF otrzymuje przepisany blok `colr`. TIFF otrzymuje piksele PQ z wygenerowanym profilem ICC v4 zawierającym znacznik `cicp`. TIFF jest spłaszczany na czarnym tle, ponieważ biel w PQ odpowiada kodowi 10 000 nitów i tworzyłaby poświatę wokół każdej krawędzi. Wzmocnienie podąża za jasnością percepcyjną (OKLab) i zachowuje odcień, więc zieleń marki staje się jaśniejsza, a nie miętowa.
- **Gdzie widać poświatę.** W przeglądarkach obrazów z zarządzaniem kolorem na wyświetlaczu HDR: Preview, Quick Look i Safari na urządzeniach Apple lub Chrome na monitorze HDR. Ekran SDR pokazuje zwykły obraz.
- **Z terminala.** `--hdr=1` z `--export=png` lub `--export=jpg` zapisuje ten sam PNG i JPEG z mapą wzmocnienia w [CLI](/info/cli.html), używając tych samych koderów silnika, bez przeglądarki. AVIF i TIFF są na razie dostępne tylko w eksporcie z aplikacji webowej.

::: warning Wiele platform usuwa sygnał HDR
Platforma, która ponownie koduje przesyłane pliki, może sprawić, że obraz będzie ciemny lub wyblakły. Używaj HDR tam, gdzie kontrolujesz miejsce docelowe, na przykład na własnej stronie, ścianie wideo lub w prezentacji na jasnym panelu.
:::

<!--i:eti-badge-check-->
## Co trafia do Twojego pliku

Gotowy plik może zawierać kilka zapisów. Niektóre znajdują się obok pikseli i znikają po ponownym zapisaniu pliku, zrobieniu zrzutu ekranu lub usunięciu metadanych. Dwa znaczniki są zapisane w pikselach.

::: figure exporting-what-travels
Gdzie znajduje się każdy zapis, czy jest domyślnie włączony i który parametr linku nim steruje.
:::

Panel eksportu umieszcza **Licence**, **Source credits**, **Password**, **C2PA Credentials**, **Lolly Imprint** i **Durable credential** w jednej grupie **Content protection**, która pokazuje tylko karty dostępne dla wybranego formatu. Grupa otwiera się sama, gdy link lub dokument już deklaruje licencję albo gdy źródło wymaga Twojej decyzji. Karta **Design system** pozostaje poza grupą, widoczna przy każdym eksporcie.

![Otwarta grupa Content protection przy eksporcie PNG, pokazująca tylko odpowiednie dla niego karty](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Proweniencja & znak wodny

Tam, gdzie format ma odpowiednie pola, eksporty zawierają **metadane proweniencji**: oprogramowanie, źródło, nazwę narzędzia i informację o autorze z Twojego profilu, zapisane w PNG iTXt, JPEG EXIF, informacjach PDF, SVG `<metadata>` lub komentarzu GIF. Rejestrują one tylko autorstwo. Nic nie jest przesyłane. Narzędzia **Experimental** dodają też widoczny znak wodny. Znak wodny nakłada host, więc edycja narzędzia nie pozwala go usunąć.

**Lolly Imprint** to niewidoczny pikselowy znak wodny, **domyślnie włączony**. Wytrzymuje ponowną kompresję, więc kopię nadal można rozpoznać jako utworzoną w Lolly. To wskazówka, nie gwarancja kryptograficzna, i nie zawiera danych osobowych. Jest zapisywany w JPEG XL, PNG, JPG, WebP, AVIF, TIFF i BMP oraz w obrazach rastrowych, które Lolly renderuje do PDF lub PPTX, nigdy w osadzonym przez Ciebie obrazie. Odznacz **Lolly Imprint** lub przekaż `imprint=0`, aby pominąć Imprint. Odporność AVIF na ponowne kodowanie nie została jeszcze skalibrowana. [Lolly Verify](/#/verify) wykrywa Imprint na Twoim urządzeniu; zobacz [Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**Durable credential** zapisuje identyfikator Lolly w pikselach za pomocą lokalnego modelu neuronowego w formacie TrustMark, dzięki czemu powiązanie „utworzono w Lolly” przetrwa usunięcie metadanych i ponowne kodowanie, a narzędzia obsługujące TrustMark mogą je odczytać. Jest **domyślnie wyłączone**, ponieważ wymaga przebiegu modelu neuronowego przy każdym eksporcie i jednorazowego pobrania modelu. Obejmuje PNG, JPG, WebP, AVIF i TIFF. Zaznacz je w panelu lub przekaż `durable=1`. Aplikacje komputerowe i mobilne ukrywają tę kartę, ponieważ w trybie offline nie mają źródła, z którego mogłyby pobrać model.

**Licence.** Wybierz, jak inni mogą korzystać z Twojej pracy: domyślnie *None (all rights reserved)*, CC0 1.0, Public Domain Mark 1.0 lub licencja Creative Commons 4.0 (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). Nazwa licencji i link do jej przystępnego podsumowania trafiają do metadanych licencji pliku (EXIF, XMP i RIFF, jeśli format je obsługuje) i jego poświadczenia Content Credential. Wybór zapisuje się z dokumentem i jest przekazywany w linku jako `licence=`. Lolly zapisuje wybraną przez Ciebie licencję. Lolly nie sprawdza ani nie egzekwuje jej warunków. Narzędzie z własnym polem licencji, takie jak Claim, zachowuje zamiast tego własne pole.

### Zapis systemu projektowego

Eksport zapisuje system projektowy, w którym powstał plik: jego nazwę, opublikowaną wersję, z której go narysowano (jeśli nie jest to wersja robocza) i [wariant kolorystyczny](/info/colourways.html), w którym go narysowano. Każdy inny wybór motywu zadeklarowany przez system projektowy, na przykład gęstość, jest zapisywany w ten sam sposób. Wybór jasnego lub ciemnego wyglądu jest pomijany, ponieważ sam obraz już pokazuje, którego użyto.

**Widzisz zapis, zanim cokolwiek zostanie zapisane.** Domyślnie zaznaczona karta **Design system** pokazuje dokładnie te słowa, które będzie zawierał plik, na przykład *Records: Acme · Colourway: Beach*, oraz opis. Nazwa systemu projektowego to tekst wpisany przez jego właścicieli, a karta pokazuje ją w tej postaci. Odznacz kartę, aby pominąć zapis w tym eksporcie. Panel dokumentu Lolly Design pokazuje te same słowa w sekcji *Embedded in exports*.

**Opis podaje wariant kolorystyczny obok narzędzia.** Przy zaznaczonej karcie *„Utworzono w https://lolly.tools : Chart”* zmienia się w *„Utworzono w https://lolly.tools : Chart (wariant kolorystyczny Beach)”*. Nazwa samego systemu projektowego pozostaje w zapisie, nie w opisie. Opis bez nazwy narzędzia lub opis tworzony przez narzędzie na podstawie własnych danych wejściowych pozostaje bez zmian. Narzędzie, które ignoruje warianty kolorystyczne przez `tokenAxes`, nie zapisuje żadnego, a informacja o autorstwie na wydruku próbnym PDF (znacznik drukarski `prov`) podlega tej samej regule.

::: details Umiejętności marki, strony marki i firmy partnerskie w zapisie
**Umiejętności marki, którymi kierował się agent.** Gdy agent stworzył pracę i wskazał [umiejętności marki](/info/brand-skills.html), które przeczytał i zastosował, zapis wymienia też każdą umiejętność wraz z jej rewizją, na przykład *Guided by: acme-brand 1.0*. Te słowa oznaczają, że umiejętność ukierunkowała pracę. Lolly nie sprawdza zgodności pracy z umiejętnością. Lista jest dodawana tylko na podstawie deklaracji samego agenta. Obecnie służy do tego argument `brandSkills` w `lolly_render` [serwera MCP](/info/mcp.html), więc praca utworzona w aplikacji lub z linku udostępniania nie zawiera takiej listy. Poświadczenie Content Credential przechowuje listę jako `brandSkills`, jedną wartość JSON z identyfikatorem, nazwą, rewizją i skrótem SHA-256 każdej umiejętności. Pakiet XMP i metadane SVG przechowują tę samą wartość jako `lolly:BrandSkills`. PDF utworzony na podstawie zapisu otrzymuje jedno słowo kluczowe na umiejętność. Opis pozostaje bez zmian. Treść wewnętrznej umiejętności nigdy nie jest zapisywana. Te same przełączniki pomijają listę wraz z resztą zapisu: karta **Design system**, `_madewith=0`, `--no-madewith` i `madeWith: false`. Gdy serwer MCP rysuje plik w przeglądarce (PDF, JPEG i inne formaty, których nie potrafi zapisać ścieżka działająca bez przeglądarki), metadane samego pliku nie zawierają listy. Tylko poświadczenie Content Credential może ją wtedy przechować. Przekaż `c2pa`, aby zachować zapis. Bez poświadczenia renderowanie ostrzega, że umiejętności marki nie zostały zapisane.

**Strona marki, gdy jej wydawca wyrazi zgodę.** Wydawca systemu projektowego może zdecydować o zapisywaniu adresu jego [strony marki](/info/brand-page.html#lead-back-from-your-files) w eksportach. To ustawienie jest oddzielne dla każdego systemu projektowego i domyślnie wyłączone. Karta dodaje wtedy adres do tego samego wiersza, na przykład *Records: Acme · Colourway: Beach · Brand page: https://acme.example/brand/acme/*. Odznaczenie karty usuwa adres wraz z resztą. Zapis zawiera adres i żadnych innych informacji o stronie. Nic innego w pliku się nie zmienia. System projektowy bez adresu zapisuje taki sam plik jak wcześniej.

**Adres nie jest przekazywany z pakietem.** Zapis w podpisanym pliku jest odczytywany jako deklaracja podpisującego. Adres nie może włączać się sam dla kogoś, kto go nie wybrał, a pakiet nie może kierować cudzych plików na wybraną przez siebie stronę. Pakiet `.lolly`, kopia lub fork systemu projektowego, **Try these colours**, przywrócona kopia zapasowa i plik tokenów przekazany do jednego uruchomienia zawsze trafiają z wyłączonym ustawieniem. Możesz sam je włączyć, wpisując adres. Jedynym wyjątkiem jest zarządzany system projektowy: zachowuje adres ustawiony przez zarządzającego w tokenach źródłowych. Szczegóły znajdziesz w [Odsyłaniu z Twoich plików](/info/brand-page.html#lead-back-from-your-files).

**Firma partnerska w programie partnerskim Lolly Work.** Praca utworzona dla firmy partnerskiej zapisuje firmę i jej program w tym samym wierszu, na przykład *Records: Acme · Colourway: Beach · Partner: Northwind IT (Resellers, EMEA)*, wraz z rewizją danych firmy w pliku. Zapis nie zawiera osoby, danych kontaktowych, adresu ani waluty. Po dołączeniu zestawu partnerskiego firmy wiersz dodaje rewizję zestawu, na przykład *, rewizja zestawu 2*, a poświadczenie przechowuje identyfikator i rewizję zestawu, nigdy jego kolory ani reguły. Odznaczenie karty usuwa partnera wraz z resztą zapisu. PDF otrzymuje słowo kluczowe *Partner: Northwind IT*, a [Lolly Verify](/info/what-verify-checks.html#partner) pokazuje zapis jako **Partner** ([Zapis partnera w plikach](/info/manage/partner-programmes.html#the-partner-record-in-files)).
:::

**Odczytywanie zapisu.** [Lolly Verify](/#/verify) pokazuje zapis jako **Design system** w szczegółach poświadczenia pliku, a ewentualne umiejętności marki jako **Guided by**. Strona marki pojawia się osobno, jako [adres zapisany przez podpisującego](/info/what-verify-checks.html#brand-page). *Recreate with these settings* otwiera narzędzie ponownie w zapisanej wersji i wariancie kolorystycznym. Link otwiera się z zapisanym systemem projektowym, jeśli na urządzeniu jest system o tym samym identyfikatorze i nazwie; w przeciwnym razie otwiera się z aktywnym systemem projektowym.

::: details Co i gdzie jest zapisywane oraz które uruchomienia pomijają zapis
| Gdzie | Co jest zapisywane |
|---|---|
| Content Credential | `designSystem` (identyfikator), `designSystemLabel`, `designVersion` i `themes` w deklaracji `tools.lolly.export`, każde jako zwykła wartość tekstowa; `themes` to lista wyborów w JSON. `brandPage`, gdy wydawca wyraził zgodę |
| PNG, JPEG, WebP i JXL | Te same wartości jako właściwości `lolly:` pakietu XMP pliku, w przestrzeni nazw `https://lolly.tools/ns/export/1.0/`. `lolly:BrandPage`, gdy wydawca wyraził zgodę |
| SVG | Te same właściwości `lolly:` wewnątrz bloku `<metadata>` |
| PDF | Słowa kluczowe, takie jak *Design system: Acme*, *Colourway: Beach* i, gdy wydawca wyraził zgodę, *Brand page: https://acme.example/brand/acme/* |
| Każdy format z polem opisu | Opis z wariantem kolorystycznym obok narzędzia |

Karta pojawia się tylko wtedy, gdy jest co zapisać i format może przechować zapis. CSV, JSON, plik kalendarza i inne formaty tekstowe lub danych nie przechowują metadanych, a EPS, EMF, DXF i BMP nie mają pola na ten zapis. HTML, Markdown i CSS przechowują zapis tylko w swoim poświadczeniu Content Credential, więc dla nich karta nie pokazuje wiersza opisu i znika, gdy **C2PA Credentials** jest wyłączone. Pole, którego system projektowy nie podaje, nie trafia do pliku.

Link udostępniania wyłącza zapis przez `_madewith=0` ([Parametry URL](/info/url-parameters.html)). Wiersz poleceń przyjmuje `--no-madewith`, `lolly_render` [serwera MCP](/info/mcp.html) przyjmuje `madeWith: false`, a panel eksportu aplikacji terminalowej ma wiersz **Design system**. Wiersz poleceń wypisuje słowa zawarte w gotowym pliku na standardowym wyjściu błędów, zarówno przy renderowaniu narzędzia, jak i dla każdego pliku eksportowanego przez `lolly run` z zapisanej sesji Lolly Design. Renderowanie MCP wypisuje te słowa obok pliku. Oba odczytują je z pliku. PNG rysowany przez wiersz poleceń bez przeglądarki nie zawiera metadanych pliku, więc jego zapis znajduje się tylko w poświadczeniu. Narzędzia pomocnicze działające na urządzeniu nie dodają metadanych.

Uruchomienia bez karty **Design system** pomijają zapis: zadanie Lolly Batch, folder eksportowany z Projects i eksport kolekcji 3D, a w aplikacji terminalowej partia CSV, eksport folderu lub zaznaczenia z Projects i widok renderowania wszystkiego. Wyeksportuj pojedynczy plik z narzędzia, aby zapisać system projektowy.
:::

### Content Credentials (C2PA)

Eksporty mogą zawierać **Content Credentials**: podpisany manifest [C2PA](https://c2pa.org), który zapisuje, co utworzyło plik, kiedy i gdzie, i jest powiązany ze skrótem bajtów pliku, dzięki czemu można wykryć każdą późniejszą zmianę. Lolly zapisuje standardowe manifesty, które może sprawdzić każdy czytnik C2PA.

![Zaznaczona karta C2PA Credentials z okresem ważności poświadczenia obok pola wyboru](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Domyślnie włączone.** Karta **C2PA Credentials** jest zaznaczona dla niemal każdego narzędzia. Odznacz ją dla jednego eksportu lub przekaż `c2pa=off` w linku. Plik nie będzie wtedy zawierał poświadczenia, a SVG, który osadza bezpośrednio grafikę z poświadczeniem, na przykład logo z katalogu, straci też poświadczenie tej grafiki. Lolly Imprint i pozostałe metadane pliku pozostają. Narzędzie może zrezygnować z poświadczeń w swoim manifeście.
- **Formaty.** PDF (RGB i Print), PNG i APNG, JPG, GIF, SVG i SVGZ, TIFF (RGB i Print), WebP (statyczny i animowany), AVIF, MP4, WebM, HTML, Markdown, CSS i kontenery audio MP3, WAV, M4A, OGG/Opus i FLAC. ZIP oznacza każdy obsługiwany plik wewnątrz, dzięki czemu Animated SVG otrzymuje poświadczenie. MP4, AVIF i M4A używają standardowego powiązania BMFF, a MP3 mapowania ID3v2, więc `c2patool` i inne czytniki je weryfikują. WebM i OGG/Opus nie mają jeszcze standardowego mapowania, więc Lolly przechowuje manifest jako załącznik Matroska i pole OpusTags, które sprawdza własny weryfikator Lolly. SVGZ to skompresowany SVG. Specyfikacja C2PA nie definiuje postaci skompresowanej, więc poświadczenie jest zapisywane w SVG przed kompresją. Weryfikator Lolly odczytuje plik bez zmian; `c2patool` odczytuje to samo poświadczenie po rozpakowaniu pliku (`gunzip`). ICO, EPS, EMF, DXF, BMP, PPTX, formaty Office i pozostałe formaty tekstowe i danych nie mają kontenera C2PA.
- **Co zapisuje.** Narzędzie i aplikację, które utworzyły plik, czas podpisania i powłokę, która wyeksportowała plik. Dla strony Lolly Design wyeksportowanej jako obraz, SVG lub PDF: renderer, który narysował stronę (`route` w deklaracji `tools.lolly.export`: `gpu` dla renderera stron GPU, `operations` dla operacji rysowania zapisanych jako wektory, `compatibility` dla własnego renderera przeglądarki) i wersję tego renderera (`renderer`: recepturę GPU, `design-draw-v` i jego wersję lub `dom-to-image` i `dom-walker`). [System projektowy i wariant kolorystyczny](#the-design-system-record), gdy karta **Design system** jest zaznaczona. Aktywne ustawienia: wybory z menu, liczby, przełączniki i kolory w ich rzeczywistej postaci, a wszystko, co wpisano (tytuły, nazwy, notatki, linki i daty), tylko jako odcisk, więc słowa nie trafiają do pliku. Pola powiązane z profilem, nieaktywne kontrolki, wersje przeglądarki i szczegóły systemu operacyjnego są pomijane. Twoje imię i nazwisko oraz e-mail pojawiają się jako dane autora tylko wtedy, gdy **Use my details to create** jest włączone w Settings → Preferences → Your details. Źródła umieszczane w eksporcie są przekazywane jako składniki. Każdy obraz na stronie, który ma własne poświadczenie Content Credential, jest zapisywany jako składnik strony wraz z tym poświadczeniem i zadeklarowanym w nim typem źródła AI. Dotyczy to PNG, JPEG, WebP, AVIF, TIFF, SVG i PDF oraz GIF, APNG, animowanego WebP, MP4 i WebM, gdy obraz jest rysowany w co najmniej jednej klatce eksportowanego zakresu. Pojedynczy obraz zmieniany przez narzędzie takie jak Darkroom, Filter lub Asset Export jest zamiast tego zapisywany jako plik nadrzędny, najpierw otwarty, a następnie uzupełniony o działania narzędzia na obrazie. Inne składniki to [utwory z oznaczeniem autorstwa](#source-credits), takie jak emoji, [utwory Lolly Rondocode](/info/rondocode.html#songs-in-the-credential) w eksporcie wideo lub audio oraz [zapisane melodie](/info/generated-music.html#what-a-track-records) w eksporcie wideo lub audio. Każda zapisana melodia ma nazwę, licencję, jeśli melodia ją zapisuje, SHA-256 receptury, wersję silnika i oznaczenie mediów algorytmicznych. Twórca zapisanej melodii (nazwa profilu, z którą ją zapisano) jest dodawany tylko wtedy, gdy **Use my details to create** jest włączone, tak jak Twoje własne imię i nazwisko. Tylko wtedy panel eksportu pokazuje twórcę przed eksportem.
- **Zatwierdzenie, jeśli zostało zapisane.** Plik zatwierdzony przez [Lolly Work](/info/work-approvals.html#review-an-exported-file) może zawierać drugi, podpisany zapis obejmujący to poświadczenie: identyfikator zatwierdzenia, datę decyzji i skrót sprawdzonego pliku. Nie zawiera nazwisk, e-maili, grup, komentarzy ani nazw łańcuchów. Jest domyślnie zaznaczony w oknie żądania i można go odznaczyć dla jednego żądania lub wyłączyć dla instancji. Zapisuje, że podpisujący zadeklarował decyzję. Nie stwierdza, że praca spełnia jakikolwiek standard.
- **O co poproszono, dla pliku utworzonego na podstawie [intencji](/info/visual-intent.html#what-goes-in-the-file).** Cel, powierzchnię docelową, narzędzie, język, wersje reguł i słownictwa oraz skrót intencji. Okazja, odbiorcy, region i prompt są tylko odciskami, chyba że osoba lub agent uruchamiający renderowanie poprosi o zapisanie treści promptu. Tylko renderowanie rozpoczęte od intencji zawiera ten zapis. Uruchomienie informuje, co zapisało, a zapis można pominąć.
- **Co widzą odbiorcy.** Narzędzia C2PA, takie jak aplikacje Adobe, `c2patool` i contentcredentials.org/verify, odczytują manifest i pokazują deklarację. Lolly podpisuje kluczem utworzonym na Twoim urządzeniu, nie certyfikatem z listy zaufania, więc przeglądarki zgłaszają *niezweryfikowane* poświadczenie. Struktura i mechanizm wykrywania zmian są prawidłowe, ale nikt nie ręczy za podpisującego. Aby to zmienić, zarejestruj **zweryfikowaną tożsamość** w Settings → Preferences → Content Credentials; zobacz [Tożsamość Content Credentials](/info/content-credentials-identity.html).
- **Sprawdzanie pliku.** Upuść dowolny plik w [Lolly Verify](/#/verify) lub uruchom `lolly validate <file>`, aby uzyskać na urządzeniu raport, który zaczyna od tego, czy Lolly utworzyło plik i czy od tego czasu został zmieniony. Lolly Verify sprawdza też informacje poza poświadczeniem; zobacz [Co sprawdza Lolly Verify](/info/what-verify-checks.html).
- **Prywatność.** Klucz podpisujący jest tworzony na potrzeby eksportu i nigdy nie opuszcza Twojego urządzenia. Deklaracja zawiera tylko to, co już zawierają metadane proweniencji. Narzędzia pomocnicze do ochrony prywatności, które przekształcają Twoje pliki, nie dodają poświadczenia, a *Lolly Strip Hidden Data* usuwa manifest C2PA jak każde inne metadane. Narzędzie pomocnicze Rondocode tworzy nowe audio, więc podpisuje to, co zapisuje ([Utwory Lolly Rondocode](/info/rondocode.html#files-from-the-rondocode-utility)). Generator muzyki podpisuje każdy pobierany plik WAV lub M4A. Poświadczenie zapisuje, że utwór stworzył generator muzyki Lolly, oraz licencję, której podlega muzyka, CC BY 4.0, wraz z oznaczeniem autorstwa ([Co zapisuje utwór](/info/generated-music.html#what-a-track-records)).
- **Zależności.** PDF chroniony hasłem nie może zawierać Content Credentials na żadnym z dwóch poziomów. Poświadczenie jest dodawane na końcu, do gotowych bajtów, po DPI, EXIF, profilu koloru, metadanych PDF/X i znacznikach drukarskich.

### Oznaczenia autorstwa źródeł

Eksport, który umieszcza cudzą pracę, zapisuje to źródło w poświadczeniu. Częstym przypadkiem jest emoji z wybranego zestawu emoji: praca, jej twórca, licencja, pochodzenie dokładnych bajtów i wprowadzone zmiany są przekazywane razem z plikiem. Tekst w narzędziu, którego szablonem jest SVG, zachowuje emoji systemu, więc nie zapisuje się tam autorstwa. Przed pobraniem wiersz **Source credits** informuje, czego źródła wymagają przy dostarczaniu pliku. Po pobraniu wiersz ponownie odczytuje dostarczone bajty, zanim stwierdzi, że oznaczenia autorstwa są w pliku. Licencja wymagająca Twojego wyboru, na przykład przy zmienionym kolorze glifu CC BY-SA, który zamierzasz udostępnić, otrzymuje kartę z opcjami. Pobieranie nigdy nie jest blokowane. [Prawa twórców i oznaczenia autorstwa](/info/creative-rights.html) opisuje treść komunikatów, sprawdzone licencje i to, co pozostaje Twoje.

<!--i:eti-lock-->
## Ochrona hasłem

Lolly tworzy dwa rodzaje blokad, oba na Twoim urządzeniu. Karta **Password** w panelu eksportu ustawia oba.

![Rozwinięta karta Password przy eksporcie PDF, z polem hasła i dwoma poziomami blokady](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**Hasło otwarcia PDF** ma dwa poziomy po wpisaniu hasła:

- **Weak**: 40-bitowy RC4, dla RGB `pdf` bez znaczników drukarskich ani spadów i haseł zawierających tylko znaki ASCII. Hasło z innymi znakami przełącza na Strong, ponieważ czytniki nie potrafią otworzyć pliku zablokowanego w ten sposób na tym poziomie. Liczą się tylko pierwsze 32 znaki.
- **Strong**: AES-256 (PDF 2.0). Dotyczy też Print PDF i każdego PDF wewnątrz ZIP z plikami partii. Print PDF z blokadą Strong zachowuje CMYK, znaczniki i docelowy profil wyjściowy, ale traci deklarację zgodności z PDF/X-4.

::: warning Weak zniechęca, ale nie chroni
Używaj **Strong** dla poufnych plików.
:::

**Zablokowany ZIP** obejmuje eksport ZIP, pobieranie folderu z Projects lub partię, z jednym hasłem na dwóch poziomach: **Weak** (ZipCrypto, środek odstraszający) lub **Strong** (AES-256). Hasło chroni każdy plik wewnątrz. Każdy PDF w środku jest też osobno blokowany za pomocą AES-256, więc pozostaje zablokowany po rozpakowaniu ZIP. Monit pojawia się po rozpoczęciu pobierania. Puste hasło oznacza brak blokady.

**Wpisane hasło nie trafia do linków na żadnym z dwóch poziomów.** Jeśli plik dociera przez link `?password=`, Lolly odczytuje wartość i natychmiast usuwa ją z adresu. Link żądający blokady, której format pliku nie obsługuje, nie zapisuje pliku i podaje przyczynę (zobacz [`password`](/info/url-parameters.html)).

**Link udostępniania chroniony hasłem** prosi odbiorcę o hasło przed otwarciem. Stan linku jest szyfrowany przez AES-256 kluczem wyprowadzonym z hasła (PBKDF2). Przesyłany jest tylko szyfrogram, a odszyfrowanie odbywa się w przeglądarce odbiorcy. Serwer obsługujący link nigdy nie widzi hasła ani projektu. Włącz tę opcję w oknie **Share**. Zaszyfrowany link otwiera się tylko w Lolly, nigdy jako osadzony obraz. Zobacz [Tryb URL](/info/url-mode.html).

<!--i:eti-monitor-->
## Na telefonie

Kontrolki eksportu znajdują się pod pływającym przyciskiem **Export**, który otwiera panel **Export**: te same formaty, rozmiar, kopiowanie, pobieranie i udostępnianie, dostosowane do obsługi dotykowej.

<!--i:eti-code-->
## Identyfikatory formatów dla linków i CLI

To wartości parametru URL `format=` i flagi CLI `--export=` (zobacz [Parametry URL](/info/url-parameters.html) i [CLI](/info/cli.html)). Menu narzędzia pokazuje tylko formaty, które to narzędzie potrafi utworzyć.

| Rodzaj | Identyfikatory |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Wektor | `svg` · `svgz` (SVG skompresowany gzip) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (plik do cięcia) |
| Strona i dokument | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (plik projektu Penpot) · `scorm` (pakiet kursu, ZIP) |
| Ruch | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| Audio | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` · `mid` (nuty MIDI z Lolly Rondocode) |
| Tekst i dane | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `ttml` · `scc` · `css` · `scss` · `gpl` (paleta GIMP) |
| Zestawy i pakiety | `zip` · `rpm` i `tar.gz` (render zapieczętowany w pakiecie Linux) |

Kilka identyfikatorów pochodzi z własnego kodu eksportu narzędzia: `ase` (Adobe Swatch Exchange, z Lolly Palette Lab) oraz `exr` i `hdr` (rastry o wysokim zakresie dynamiki, z Lolly Darkroom). **Convert Font** zapisuje `ttf`, `otf` i `woff` z dostarczonego przez Ciebie pliku czcionki, więc sam link nie daje narzędziu nic do renderowania.
