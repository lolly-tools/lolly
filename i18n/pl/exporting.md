# Eksportowanie i formaty

Jak wydobyć gotowy plik z narzędzia - wybór właściwego formatu, ustawienie rozmiaru wyjściowego i działanie poszczególnych opcji. Podobnie jak wszystko inne, **eksport odbywa się na twoim urządzeniu**; nic nie jest przesyłane.

## Jak działa eksport

Podgląd *jest* plikiem. Podczas eksportu host renderuje to płótno do wybranego formatu i przekazuje ci plik do pobrania (albo umieszcza go w schowku). Narzędzie oferuje tylko formaty zadeklarowane przez jego autora, a selektor ukrywa te, których twoja przeglądarka nie potrafi wytworzyć (zobacz [Wideo](#video)).

Plik może powstać na trzy sposoby. Większość narzędzi **renderuje płótno** do wybranego formatu. Formaty tekstowe i danych (HTML, MD, TXT, JSON, CSV, ICS, VCF) są zamiast tego **generowane z treści narzędzia**, a nie rasteryzowane z obrazu. Narzędzia prywatności (np. *Strip Hidden Data*) korzystają z trzeciej ścieżki: plik, który *ty* wybierzesz, jest przekształcany bajt po bajcie na urządzeniu i zwracany od razu - bez płótna, bez znaku wodnego i bez dodawania metadanych pochodzenia, bo to już jest twój własny plik.

Akcje dostępne w sterowaniu eksportem:

- <!--i:download--> **Download** - zapisz plik (akcja podstawowa).
- <!--i:photos--> **Copy** - umieść obraz w schowku, aby wkleić go bezpośrednio w Slacku, e-mailu czy dokumencie. Tam, gdzie przeglądarka nie potrafi kopiować obrazów, zamiast tego pobiera plik i informuje o tym.
- <!--i:folder--> **Save** - zachowaj bieżący projekt jako zapisaną sesję narzędzia w swojej bibliotece.
- <!--i:link--> **Share** - otwiera **okno Share**: kopiowalny link odtwarzający projekt, przełączniki uruchamiane przy wejściu (pełny ekran, panel eksportu, pobieranie lub kopiowanie po otwarciu) oraz opcjonalny **Shortest link**, który pakuje cały stan w kompaktowy token (zobacz [Tryb URL](/info/url-mode.html)).

(Autor narzędzia decyduje, które z nich się pojawiają; domyślny zestaw to Copy, Download i Save.)

![Panel eksportu - format, rozmiar oraz akcje Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Share otwiera się nad narzędziem, z gotowym już linkiem i przełącznikami uruchamianymi przy wejściu poniżej.

### Renderowanie wielu naraz

Pojedynczy eksport to jeden plik, ale możesz wyrenderować **wiele** za jednym razem - każdy dostarczany jako jeden plik `.zip`:

- <!--i:folder--> **Projects → Render folder** eksportuje każdą zapisaną sesję w folderze (i jego podfolderach) jako jeden zagnieżdżony zip; **Render selection** robi to samo dla dowolnego zaznaczenia wielu elementów; pojedyncza zapisana sesja renderuje się bezpośrednio do własnego pliku. Nie jest potrzebny Batch/Pro - zobacz [Using Lolly → Projects](/info/using.html).
- <!--i:layers--> **Batch (Pro)** renderuje siatkę zestawów danych wejściowych - wszystkie warianty jednego szablonu naraz.

Zapisaną sesję można też ponownie udostępnić jako link do narzędzia z poziomu Projects (odtwarza on adres URL narzędzia na podstawie zapisanych danych wejściowych), więc link otwiera ją ponownie z dokładnie tymi samymi ustawieniami.

## Wybór formatu

Nazwa pliku i selektor formatu znajdują się na górze panelu jako jedna para `name.format`, a selektor zawiera tylko formaty zadeklarowane przez autora tego narzędzia.

![Pole nazwy pliku połączone z selektorem formatu, tak że eksport wygląda jak jedna para name.format](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

| Chcesz… | Użyj | Dlaczego |
|---|---|---|
| Ostre logo / grafikę, która się skaluje | **SVG** | Wektor - nieskończenie skalowalny, mały, edytowalny |
| Wektor dla aplikacji Office / Windows | **EMF** | Wkleja się jako edytowalny wektor do PowerPointa / Worda; tekst pozostaje aktywny i edytowalny, a Dysk Google otwiera go w Google Rysunki dla Prezentacji |
| Wektor do druku / aplikacji projektowych | **EPS** lub **EPS (CMYK)** | Wektor PostScript dla Illustratora / procesów przygotowania do druku |
| Wektor do maszyn tnących / CAD | **DXF** | Plotery laserowe, plotery winylowe, CNC - ścieżki konturowe w milimetrach |
| Edytowalna prezentacja | **PowerPoint** (PPTX) | Natywny edytowalny tekst i kształty, z obrazami i wektorami, które można wyodrębnić |
| Kurs, który zaimportuje LMS | **SCORM** (LMS) | Plik zip z manifestem, stroną startową, slajdami i filmem z narracją oraz napisami - z prezentacji Design |
| Edytowalny dokument tekstowy | **Word** (DOCX) lub **OpenDocument** (ODT) | Prawdziwe akapity i nagłówki, które edytor tekstu może dalej edytować (Doc Studio) |
| Zdjęcie lub obraz ogólnego przeznaczenia | **PNG** (bezstratny) lub **JPG** (mniejszy) | Uniwersalny raster |
| Mniejsze nowoczesne obrazy | **WebP** / **AVIF** | Lepsza kompresja, kanał alfa |
| Druk | **PDF** lub **Print PDF** (CMYK) | Rzeczywisty rozmiar strony; CMYK do druku offsetowego |
| Raster do druku offsetowego | **Print TIFF** (CMYK) | Piksele DeviceCMYK dla RIP-a |
| Animacja do sieci | **GIF** | Działa wszędzie, większe pliki |
| Animacja w pełnym kolorze + prawdziwa przezroczystość | **APNG** | Animowany PNG - bez ograniczenia palety, prawdziwa przezroczystość |
| Animacja, najmniejszy plik | **Animowany WebP** | Pełny kolor + alfa, lepiej skompresowany niż GIF czy APNG |
| Skalowalna animacja wektorowa | **Animowany SVG** | Samodzielny; zapętla się w przeglądarce lub `<img>`, bez kodeka, w dowolnym rozmiarze |
| Wideo do social mediów / udostępniania | **MP4** lub **WebM** | Najlepsza jakość na bajt (patrz niżej) |
| Tekst sformatowany / podpis e-mail | **HTML** | Wkleja się sformatowany do klientów poczty |
| Zwykła treść | **MD** / **TXT** | Tylko tekst |
| Wydarzenie w kalendarzu | **ICS** | Importuje się do dowolnej aplikacji kalendarza |
| Wizytówka kontaktu | **VCF** | Importuje się do Kontaktów / książek adresowych |
| Dane strukturalne do ponownego zaimportowania | **JSON** / **CSV** | Odtwarza zawartość narzędzia w pełnym cyklu |
| Favikona | **ICO** | Ikona strony w wielu rozmiarach (**ZIP** łączy kilka formatów) |

Pierwszy wiersz to najczęstszy przypadek. Wordmark złożony krojem twojej marki eksportuje się jako SVG, gdzie każda litera jest konturową ścieżką, a nie pikselem, więc pozostaje ostry zarówno w rozmiarze wizytówki, jak i oklejenia budynku - z tego samego pliku.

![Cienki, szeroko trackowany wordmark z napisem Aurora - rodzaj czystej grafiki wektorowej, o której mówi wiersz SVG w tabeli](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-wordmark-vector)

## Rozmiar i jednostki druku

Domyślnie eksporty używają natywnego rozmiaru piksela narzędzia. Tam, gdzie narzędzie udostępnia **wymiary**, możesz ustawić szerokość × wysokość oraz **jednostkę**:

- **px** (domyślnie) - dokładne piksele.
- **mm · cm · in · pt · pc** - rozmiary fizyczne/druku. Przy jednostce fizycznej ustawiasz też **DPI** (domyślnie **300** dla druku); silnik konwertuje poprawnie w zależności od formatu - **PDF** staje się prawdziwą stroną w tym rozmiarze, **raster** renderuje się z odpowiednią liczbą pikseli dla danego DPI (i osadza rozdzielczość), **SVG** zachowuje jednostkę fizyczną z viewBoxem w px.

Aby uzyskać raster o wyższej rozdzielczości, wpisz większą szerokość/wysokość albo wybierz jednostkę fizyczną i zwiększ DPI (piksele = rozmiar × DPI). Nie ma jednoprzyciskowego przełącznika skali.

Przykład: szerokość `210`, wysokość `297`, jednostka `mm` → strona A4.

![Wiersz wymiarów ustawiony na 210 na 297 mm, z widocznym polem DPI, ponieważ jednostka jest fizyczna](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Klatki nieruchome z kompozycji czasowej

**Kompozycja czasowa** - oś czasu [Sequence](/info/using.html#timeline-sequence) w Design lub dowolny artboard sterowany osią czasu - jest rzeczą ruchomą, więc eksport statyczny musi odpowiedzieć na pytanie „który moment?". Zasada jest taka, jakiej można się spodziewać: **klatka w miejscu głowicy odtwarzania**. Ustaw głowicę odtwarzania w miejscu, które ma się znaleźć na obrazie, i eksportuj; to, co widzisz, jest tym, co otrzymasz.

Gdy chcesz więcej niż jeden moment, obok rozmiaru wyjściowego pojawia się pole **Frames** (tylko dla kompozycji czasowej i tylko dla formatu statycznego - PNG, JPG, WebP, SVG lub PDF). Zostaw je na `1`, aby otrzymać klatkę z głowicy odtwarzania. Zwiększ je, a otrzymasz tyle klatek nieruchomych, próbkowanych w równych odstępach na przestrzeni całej sekwencji:

- **Raster i SVG** wracają jako jeden **zip** - `<name>-01.png`, `-02.png` i tak dalej.
- **PDF** wraca jako **jeden dokument z taką liczbą stron**.

Przydatne do storyboardu, arkusza miniatur, kontaktówki do przeglądu albo karuzeli social media wyciętej bezpośrednio z montażu wideo.

Próbkowanie odbywa się w **punkcie środkowym** każdego przedziału, a nie na jego krańcach, ponieważ pierwsza chwila sekwencji to często przejście wejściowe, które jeszcze się nie pojawiło, a ostatnia to stan po zakończeniu wszystkich klipów - próbkowanie krańcowe zmarnowałoby dwie z twoich klatek na niemal puste. Liczba jest ograniczona do **64** (kontaktówka jest po to, by człowiek mógł ją odczytać), a wszystko bezsensowne wpisane w to pole cofa się do `1` zamiast powodować niepowodzenie eksportu. Każda klatka jest zwykłą klatką nieruchomą, więc Content Credentials, imprint, jednostki fizyczne i DPI zachowują się dokładnie tak samo jak przy pojedynczym eksporcie.

Pole **Frames** to dziś sposób na uzyskanie arkusza. Silnik rezerwuje odpowiadający mu parametr URL `cuts`, ale żadna powłoka nie odczytuje go jeszcze z linku, więc udostępniony link zawsze otwiera się ponownie na klatce głowicy odtwarzania - zobacz [Tryb URL](/info/url-mode.html#contact-sheets-cuts).

## Wielostronicowy PDF

Niektóre narzędzia tworzą **wielostronicowy dokument PDF** zamiast pojedynczej grafiki - okładkę, treść, która przepływa na tyle stron, ile potrzebuje, oraz tylną stronę, wszystko w jednym pliku (zobacz narzędzie *Booklet*). Każda strona jest **prawdziwą stroną PDF** o rozmiarze dopasowanym do jej ramki, dzięki czemu czytelnicy i drukarki otrzymują prawdziwe strony, a nie jeden długi obraz.

- **Strony z treści.** Dodawaj bloki tekstu i obrazów; nowe strony powstają automatycznie w miarę zapełniania bloków, a każdy blok możesz wymusić na rozpoczęciu nowej strony.
- **Prawdziwe rozmiary stron.** Wybierz A4, US Letter lub A5 (pionowo - układ dwukolumnowy jest do niego zaprojektowany) - każda strona i wyeksportowany PDF renderują się dokładnie w tym rozmiarze.

Wielostronicowe PDF-y to dokumenty RGB i nie zawierają znaczników cięcia/spadu - te należą do opisanej wyżej ścieżki jednostronicowego **Print PDF**. Zawierają jednak te same **metadane PDF/X-4** co każdy eksport PDF (ramki stron, XMP, identyfikator dokumentu, intencja wyjściowa sRGB z osadzonym profilem), a także oferują **Content Credentials** (poniżej) - w narzędziu *Booklet* ta opcja jest domyślnie zaznaczona.

## Tworzenie wielu rzeczy naraz

Lolly ma trzy odrębne sposoby pracy na dużą skalę, rozwiązujące różne zadania - edycja wsadowa jest pełnoprawną funkcją platformy, a nie czymś, co każde narzędzie wymyśla na nowo:

- <!--i:document--> **Jeden projekt × tabela wierszy → jeden wielostronicowy dokument.** Narzędzia z polem wejściowym `table` (jak *Battlecards*) automatycznie zamieniają każdy wiersz w stronę - wklej tabelę z arkusza kalkulacyjnego, otrzymaj PDF wielkości prezentacji. Twoim prawdziwym edytorem wsadowym pozostaje arkusz kalkulacyjny: popraw tam dziesięć wierszy, wklej ponownie. Samo narzędzie nigdy nie zarządza stronami.
- <!--i:layers--> **Jeden projekt × plik danych → wiele osobnych plików.** Siatka wsadowa `/pro` przyjmuje plik CSV i renderuje jeden eksport *na wiersz* - identyfikatory imienne, certyfikaty, po jednym pliku każdy.
- <!--i:sliders--> **Wiele różnych zasobów, edytowanych obok siebie.** *Multi-edit* otwiera kilka zapisanych sesji w jednym widoku, umożliwiając skoordynowane poprawki w różnych projektach.

Zasada praktyczna: wiersze tego samego projektu, które powinny trafić do **jednego dokumentu** → narzędzie oparte na tabeli; wiersze, które muszą zostać dostarczone jako **osobne pliki** → `/pro`; **różne projekty**, wymagające tej samej poprawki → multi-edit. (Planowana opcja renderowania „combine media” połączy te dwa pierwsze przypadki - łącząc eksporty w tym samym formacie w jeden PDF, jeden film albo kontaktówkę do korekty.)

## PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart i Diagrams potrafią wyeksportować **prezentację PowerPoint** - jeden slajd na stronę. Nie chodzi o zrzut ekranu piksel w piksel; chodzi o to, by przekazać koledze prezentację, którą naprawdę można **edytować i z której można wyciągać zasoby**. Dlatego każda strona jest rozkładana na natywne obiekty:

- <!--i:font--> **Tekst** staje się prawdziwymi, **edytowalnymi polami tekstowymi PowerPoint** - z rozmiarem czcionki, kolorem, grubością, kursywą i wyrównaniem z układu - dzięki czemu możesz poprawić literówkę lub zmienić styl w PowerPoincie.
- <!--i:pentool--> **Wektory** (logotypy, ikony, znak SUSE) są osadzane jako **prawdziwe obrazy SVG** - pozostają ostre w każdym rozmiarze, a PowerPoint może na nich nawet wykonać *Convert to Shape*.
- <!--i:photos--> **Obrazy** trafiają w natywnej rozdzielczości jako własne, wyodrębnialne obrazki (baner przycięty w trybie `cover` zachowuje pełny obraz pod przycięciem, więc możesz go przekadrować), z wiernie zapieczonym każdym efektem na obrazie (filtry, tryby mieszania).
- <!--i:layers--> **Tła, obramowania i linie** stają się prawdziwymi kształtami prostokąt/linia.

![Panel eksportu z wybranym PowerPointem: jeden slajd na stronę, tekst i kształty pozostają edytowalne](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Układ jest celowo przybliżony - celem jest wierna, wielokrotnego użytku **treść**, a nie zablokowany zrzut ekranu. Wszystko, czego walker nie potrafi wyrazić natywnie (złożony obszar z filtrem lub maską), jest osadzane jako obraz, żeby nic nie zostało utracone. Prezentacja ma jeden rozmiar slajdu, pobrany z pierwszej strony.

PowerPoint to też sposób na **import**. Upuść plik `.pptx` na dowolnej powierzchni wczytywania i wybierz slajdy, które chcesz - każdy z nich staje się zasobem, który można umieścić, poprawić kolorystycznie lub rozbudować. **Markdown Slides** tworzy nową prezentację z Markdown (i udostępnia markowy szablon `.pptx`), a narzędzie **Rebrand** przestylizowuje istniejącą prezentację na miejscu - paletę motywu, twardo zakodowane kolory i czcionki - nie dotykając jej wykresów, SmartArt ani animacji, i zwraca plik `.pptx`. Zobacz [Importowanie projektu → Prezentacje i dokumenty](/info/design-import.html#decks-and-documents).

## Penpot

Każde narzędzie, które potrafi wyeksportować SVG, może też wyeksportować **plik Penpot** (`.penpot`) - dokument gotowy do dalszej edycji w Penpot, a nie tylko do oglądania.

- <!--i:layout--> Z **Design** każda ramka staje się w Penpot **planszą** (board), a każdy znajdujący się na niej box przechodzi jako własny edytowalny kształt - prostokąt, elipsa, tekst, obraz lub ścieżka - a całość trafia jako gotowy do ponownego użycia **komponent** w panelu Assets, gotowy do przeciągnięcia w dowolne miejsce.
- <!--i:pentool--> Z narzędzia, którego renderowanie to **czysta geometria** - narzędzia wektorowe takie jak QR Code, Street Map, Wordmark i Palette Lab - każda ścieżka, prostokąt, fragment tekstu i gradient przechodzi tak samo, jako własny edytowalny kształt.
- <!--i:font--> Z narzędzia, które układa swoje renderowanie w **HTML**, **tekst pozostaje tekstem** - jeden edytowalny obiekt tekstowy Penpot na wiersz, a nie kontur ani płaski obraz. Element grafiki, dla którego Penpot nie ma odpowiedniej konstrukcji - złożona ilustracja, żywe płótno (canvas) - jedzie osobno jako obraz, dzięki czemu nigdy nie spłaszcza wokół siebie tekstu i boxów. Cały układ, którego Penpot nie potrafi wiernie rozdzielić, i tak może zostać przekazany jako jeden obraz w pełnej wierności, więc nic nigdy nie ginie.
- <!--i:palette--> Kolor lub czcionka, które kształt **dziedziczy z tokenu marki**, pozostają **powiązane** z tym tokenem w pliku: zmień token w panelu Tokens w Penpot, a każdy kształt, który go dziedziczy, przemaluje się razem z nim, podczas gdy jednorazowy, dosłowny kolor pozostaje dokładnie taki, jaki był. Kolory i typografie marki trafiają też do panelu **Assets**, a jej pełny zestaw tokenów projektowych - do panelu **Tokens** - jest to ten sam zestaw tokenów DTCG, którego używa własna paleta Lolly. Penpot trzyma od tego momentu własną kopię: edycja wykonana w jego panelu Tokens wraca do marki przez [import Brand Studio](/info/design-import.html), a nie sama z siebie.

| Co stworzono | W Penpot |
|---|---|
| Tekst | Edytowalne obiekty tekstowe - popraw literówkę lub zmień styl |
| Kształty, ścieżki, gradienty, obrazy | Własne edytowalne kształty wektorowe |
| Kolor lub czcionka z tokenu marki | Żywe powiązanie z tokenem - edytuj token, a podąży za nim każdy dziedziczący go kształt |
| Cały projekt | Gotowy do ponownego użycia komponent w panelu Assets |
| Złożona ilustracja lub żywe płótno | Osadzone osobno jako obraz, edytowalna zawartość wokół pozostaje nietknięta |

![Panel eksportu z wybranym Penpot: plik .penpot oraz Send to Penpot obok pobierania](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Aby go otworzyć, uruchom Penpot, wybierz projekt i kliknij **Import**. Po zalogowaniu do Penpot z poziomu panelu eksportu opcja **Send to Penpot** robi to za ciebie - wybierz tam projekt, a plik trafi od razu do niego.

## SCORM (pakiety kursów)

Prezentacja Design może zostać wyeksportowana jako **pakiet SCORM** - plik zip, który zaimportuje system LMS, niezależnie od tego, czy jest to Moodle, Canvas, Blackboard czy firmowy LMS. Wybierz **SCORM (LMS)** w selektorze formatu, a eksport zapisze:

- <!--i:layout--> **Slajdy**, jeden obraz na artboard, jako wektor tam, gdzie artboard na to pozwala, i jako piksele tylko tam, gdzie nie pozwala.
- <!--i:play--> **Film z narracją** wraz ze ścieżką napisów - notatki prelegenta odczytane głosem generowanym na urządzeniu, dokładnie tak, jak odtwarza je [Presenting](/info/create/using.html#presenting).
- <!--i:file--> **Stronę startową**, która przechodzi przez slajdy, odtwarza film i zgłasza ukończenie z powrotem do LMS przez środowisko SCORM 1.2 - wersję akceptowaną przez każdy LMS.
- <!--i:font--> Czcionki używane w prezentacji, dzięki czemu strona startowa renderuje się tak samo offline.

![Panel eksportu na prezentacji Design z wybranym SCORM (LMS)](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Nic w tym pakiecie nie łączy się z żadnym serwerem: to pliki w zipie, które działają wewnątrz LMS bez bundlera, bez CDN i bez konta. Buduje go aplikacja webowa i desktopowa; CLI tego nie robi, ponieważ sfotografowanie artboardów i zakodowanie filmu wymaga przeglądarki.

## DXF (pliki do cięcia)

Narzędzia wektorowe (Brand Lockup, QR Code, Street Map, Wayfinding Signage, Pose Geeko, warianty logo, Diagram Builder) mogą eksportować do **DXF** - formatu wymiany AutoCAD R12, który odczytują plotery laserowe, plotery winylowe i oprogramowanie CNC/CAD. Geometria jest zapisywana jako **ścieżki konturu w milimetrach** (krzywe spłaszczone z dużą dokładnością), tekst jest zamieniany na ścieżki konturowe, a kolor jest mapowany na najbliższy indeks kolorów AutoCAD (który zwykle steruje narzędziem/operacją na ploterze tnącym). DXF to wyłącznie grafika liniowa - obszar fotograficzny lub filtrowany nie ma formy ścieżki cięcia i zostaje pominięty (Lolly ostrzega), więc gdy trzeba zachować treść rastrową, użyj SVG/PDF.

Street Map to najbardziej oczywisty przypadek: cały projekt to już same kontury, więc każda droga i każdy kanał stają się ścieżką do cięcia i nic nie trzeba pomijać.

::: showcase
![Render Street Map przedstawiający Paryż tuszem na kremowym tle - czysta grafika liniowa, więc każda kreska przetrwa podróż do wycinarki](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Przewiń, a kamera oddala się przez rzeczywistą geometrię: siedem ścieżek, żadnych pikseli, każda kreska ostra jak włos przy dowolnym powiększeniu. To dokładnie ten sam plik, który odczytuje wycinarka.
:::

## Animowany SVG

Narzędzia animacji (Animated Ad, Lottie Ad) mogą eksportować **Animowany SVG** - samodzielną animację *wektorową*. W przeciwieństwie do GIF/APNG/WebP (które próbkują każdą klatkę do pikseli), animowany SVG układa migawki wektorowe z osadzonymi klatkami kluczowymi CSS, dzięki czemu **skaluje się do dowolnego rozmiaru bez kodeka i bez zewnętrznego środowiska uruchomieniowego** - zapętla się w karcie przeglądarki lub w `<img>`. Tekst pozostaje zamieniony na ścieżki konturowe, więc renderuje się wszędzie. Współdzieli z formatami animowanymi ustawienia **Duration** / liczby klatek na sekundę, i (będąc cięższy na klatkę niż bitmapa) używa niższej domyślnej liczby klatek.

## Przezroczystość

Narzędzia, które to obsługują, oferują przełącznik **przezroczystego tła** (np. *No BG*). Przezroczystość zachowują PNG, WebP, AVIF, SVG (statyczny i animowany), APNG oraz Animated WebP. JPG i PDF są zawsze nieprzezroczyste, a TIFF spłaszcza na biało (na czarno w ścieżce HDR - patrz niżej).

## Przestrzenie barw

Dwie różne kwestie, warto je rozdzielać: w jakich przestrzeniach barw Lolly potrafi **czytać i myśleć**, oraz w jakich **zapisuje**.

**Odczyt.** Wszędzie tam, gdzie zapisany jest kolor - w arkuszu stylów narzędzia, w wypełnieniu zaimportowanego SVG, w wartości tokenu projektowego, w cieniu lub gradiencie wewnątrz skrótu CSS - Lolly odczytuje pełne słownictwo **CSS Color 4**: `#hex`, `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, nazwane kolory CSS oraz `color()` w predefiniowanych przestrzeniach - `srgb`, `srgb-linear`, `display-p3`, `a98-rgb`, `prophoto-rgb`, `rec2020`, `xyz-d50`, `xyz-d65` - w tym składowe zapisane jako słowo kluczowe `none`. Jeden parser robi to dla całej platformy, więc przeglądarka i każdy walker eksportu zgadzają się co do znaczenia zapisu koloru.

To ważniejsze, niż się wydaje, bo przeglądarka rozwiązuje nowoczesny CSS do nowoczesnego CSS. Zapisz `color-mix(in oklab, …)`, a Chrome obliczy `oklab(…)`; użyj tokenu marki zapisanego jako `oklch()`, a to jest dosłowna wartość, którą widzi walker eksportu. Kolory w tych formach są odczytywane poprawnie, a nie pomijane - a właśnie to robił walker, który rozumiał tylko `rgb()`: eksportował tekst w kolorze marki jako czarny, tracił zabarwione panele i linie tabel oraz odczytywał `oklch(0.7 0.1 200) 0px 2px 4px` jako przesunięcie cienia o 0.7 na 0.1.

**Sposób myślenia.** Matematyka koloru działa percepcyjnie, a nie na surowych kanałach. Wyprowadzanie palety, rampy, harmonie i kontrast działają w przestrzeni **OKLCH/OKLab**, a kolor spoza gamutu jest sprowadzany w zakres przez własny algorytm mapowania gamutu CSS Color 4 - redukcję chromy z kontrolą odległości percepcyjnej - a nie przez przycinanie kanałów, więc żywy kolor osiada na najbliższym kolorze, który faktycznie zaakceptowałbyś, zamiast na spłaszczonym. Gradienty interpolują w wybranej przez Ciebie przestrzeni (domyślnie OKLab, albo `oklch`, `lab`, `lch`, `srgb`, `srgb-linear`, `hsl`, z kierunkiem przejścia odcienia dla tych biegunowych), a mieszanie jest **premultiplikowane**, więc przejście do przezroczystości zachowuje właściwy kolor zamiast ciemnieć w stronę czerni po drodze. Jeden interpolator obsługuje zarówno podgląd, jak i chodniki eksportu - to właśnie to powstrzymało gradient stożkowy przed mieszaniem się w jeden sposób na ekranie i w inny w wyeksportowanym pliku.

**Zapis.** Wynik jest celowo węższy niż wejście, ponieważ plik musi być czytelny dla tego, co go otwiera, a przestrzeń jest *deklarowana* na wyjściu tylko wtedy, gdy liczby zostały do niej rzeczywiście przeliczone. Formaty ekranowe i internetowe są zapisywane jako **sRGB** i tak oznaczane; formaty drukowe są zapisywane jako **CMYK** względem nazwanego warunku druku (poniżej); a ścieżka HDR to **Rec.2100 PQ** (powyżej). Kolor o szerokim gamucie, który trafia do eksportu, jest mapowany do sRGB, a nie błędnie oznaczany - przeniesienie `color(display-p3 …)` bezpośrednio do pliku wektorowego jest planowanym rozszerzeniem, a nie czymś, co dzisiejsze eksporty deklarują. Gradient stworzony w OKLab jest na wyjściu *zapiekany* do zwykłych przystanków sRGB, z dodatkowymi przystankami wstawianymi tylko tam, gdzie sRGB widocznie odbiegałby od krzywej percepcyjnej, ponieważ SVG `<linearGradient>` i osiowe cieniowanie PDF nie mają ustawienia przestrzeni interpolacji, które przeniosłoby ten zamysł. Jedna autorska wartość, trzy renderery, żadnego rozjazdu.

## Profile barw

Aby kolory odwzorowywały się wiernie w aplikacjach zarządzających kolorem (drukarniach, Photoshopie, przeglądarkach), eksporty są **oznaczane profilem barw**:

- **PNG / JPG** zawierają osadzony profil ICC **sRGB** - przestrzeń barw, w której podgląd jest faktycznie renderowany - więc nic nie trzeba zgadywać. (Tylko oznaczenie; piksele nie są ponownie kodowane.)
- **PDF do druku (CMYK)** deklaruje docelowy **warunek druku** w swoim *OutputIntent* (domyślnie *Coated FOGRA39*), informując RIP/drukarnię, jak mają być odczytywane jej farby CMYK. Próbki koloru marki ze zmierzonymi wartościami farb są przeliczane dokładnie; pozostałe kolory używają standardowej konwersji urządzeniowej. Ta deklaracja to *nazwa*: żaden profil CMYK nie jest dołączony do Lolly, a PDF/X-4 wymaga osadzonego profilu, więc nazwany warunek zapisuje intencję wyjścia bez twierdzenia o zgodności z PDF/X-4. Wczytaj własny profil CMYK i wybierz jego wiersz **Embed** w ustawieniu Colour profile, a zostanie on osadzony jako *DestOutputProfile* pliku - i wtedy PDF może być naprawdę PDF/X-4, i deklaruje to, ilekroć reszta pliku na to pozwala. Trzy rzeczy wstrzymują tę deklarację, zachowując przy tym output intent (RIP nadal go potrzebuje): grafika RGB, której przebieg CMYK nie zdołał przeliczyć, tekst z podpisem marginesu `prov` (rysowany standardową czcionką, która nie jest osadzana, a X-4 nie robi dla tego wyjątku) oraz hasło **Strong**, ponieważ X-4 zabrania szyfrowania. Deklarowany warunek jest wtedy odczytywany z tego profilu: zarejestrowana nazwa tam, gdzie profil taką udowadnia, `Custom` pod własną nazwą profilu tam, gdzie nie - dzięki czemu plik nigdy nie może nazywać jednego warunku druku, niosąc pomiary innego.
- **TIFF do druku (CMYK)** zapisuje nieoznaczone piksele **DeviceCMYK** i zapisuje ten sam warunek druku jako pochodzenie w metadanych TIFF (*ImageDescription*), zamiast osadzać profil. To samo ustawienie Colour profile steruje obydwoma formatami CMYK - TIFF w ogóle nie może osadzić profilu druku, więc wiersz **Embed** zapisuje tam wyłącznie nazwę tego profilu i nic więcej.
- **TIFF (RGB)** to zwykły, nieskompresowany odpowiednik sRGB - bezstratny raster w wybranym DPI do archiwizacji lub do wymiany z edytorem w obie strony, z pochodzeniem zapisanym w tych samych metadanych TIFF. Wszelka przezroczystość jest spłaszczana na biało (ten profil nie niesie kanału alfa). Podobnie jak TIFF CMYK, jest dostępny tylko na komputerze, bo przeglądarki nie potrafią wyświetlić podglądu TIFF, a pobieranie na urządzeniu mobilnym kończy się ślepym zaułkiem.
- **SVG**, **EMF**, **EPS** i **DXF** to wektory niezależne od rozdzielczości i profilu, bez osadzonego profilu - kolory SVG to zwykłe sRGB, EMF i EPS używają urządzeniowego RGB (a **EPS (CMYK)** zapisuje naiwny DeviceCMYK), a **DXF** niesie najbliższy AutoCAD Color Index. (SVG, EPS i DXF, podobnie jak PDF, zamieniają każdy tekst na wektorowe ścieżki konturowe, więc wynik renderuje się nawet tam, gdzie czcionka nie jest zainstalowana. EMF natomiast domyślnie zachowuje tekst NA ŻYWO - prawdziwe zapisy tekstu metaplikowego, które pozostają zaznaczalne i edytowalne w Office i Google Slides, przechodząc na ścieżki konturowe tylko dla fragmentów, których format nie potrafi wyrazić; opcja "Outline fonts" w panelu eksportu wymusza ścieżki wszędzie.) **SVG** odtwarza też CSS `box-shadow` z HTML-a - każdy cień zewnętrzny jest rysowany za polem, z przesunięciem/rozpiętością i rozmyciem gaussowskim dopasowanym do przeglądarki, a cienie wewnętrzne są rysowane wewnątrz w ten sam sposób.

To dzieje się automatycznie - nie ma tu żadnego ustawienia do majstrowania. Miniatury i podglądy pomijają tag, żeby pozostać małe. Jeden profil *jest* wyborem, bo zmienia piksele, a nie tylko je oznacza - zobacz **HDR** poniżej.

## HDR (jasne kolory)

Zwykłe eksporty są w sRGB: biel jest bielą, a nasycony kolor marki jest tak jasny, jak normalna biel ekranu. Na ekranie obsługującym HDR jest ponad to dużo dodatkowej przestrzeni jasności, a karta **HDR** w panelu eksportu z niej korzysta - kolory Twojej marki i biały tekst są podbijane w stronę szczytowej jasności, więc naprawdę *świecą*, podczas gdy ciemne obszary pozostają ciemne i nadają blaskowi kontrast.

![Włączona karta HDR w panelu eksportu, z odsłoniętymi pod nią pokrętłami White / Reach / Dark lift / Focus](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formaty.** Formaty rastrowe z miejscem na przeniesienie sygnału: **PNG**, **JPG**, **AVIF** i **TIFF**. (Nie WebP - jest 8-bitowy i nie ma działającej ścieżki dekodowania HDR, więc PQ WebP po prostu wyglądałby ciemno. Wektory i PDF w ogóle nie mają modelu HDR.)
- **Domyślnie wyłączone**, w przeciwieństwie do tagowania kolorów - zmienia piksele, więc jest opcją opt-in. Zaznacz kartę albo przekaż `hdr=1` w linku udostępniania.
- **Co naprawdę jest zapisywane.** Piksele są przekodowywane do **Rec.2100 PQ** - podstawowe kolory BT.2020 z krzywą przejścia SMPTE ST 2084 (PQ) - a kontener niesie odpowiedni sygnał, dzięki czemu aplikacja z zarządzaniem kolorem wie, jak je odczytać: wygenerowany **profil ICC v4 z tagiem `cicp`** (JPG, TIFF), fragment **`cICP`** (PNG) lub przepisany box `colr` (AVIF). Wzmocnienie jest sterowane **percepcyjną jasnością (OKLab)**, więc kolory od średnich w górę osiągają szczyt, a ciemne są łagodzone, a nie prześwietlane, i zachowuje odcień - zielony marki staje się jaśniejszy, a nie miętowy.
- **Suwaki.** Cztery, odsłaniane po włączeniu karty: **White** (sufit szczytowej jasności, 400–2000 nitów), **Reach** (jak daleko w dół tonów sięga poświata), **Dark lift** (o ile rozjaśniają się ciemne partie - `0` zachowuje je ciemnymi) oraz **Focus** (ile bogactwa koloru zachowuje wzmocnienie). Jadą w tym samym parametrze co zwarta, dostrojona wartość - `hdr=1600-60-0-50` to White 1600, Reach 60, Dark lift 0, Focus 50 - dzięki czemu dostrojony wygląd da się odtworzyć z linku.
- **Gdzie to zobaczysz.** W przeglądarkach z zarządzaniem kolorem na wyświetlaczu HDR: Preview / Quick Look / Safari na urządzeniach Apple, Chrome na monitorze HDR. Na zwykłym ekranie SDR plik nadal wygląda jak zwykły obraz.
- **Co warto wiedzieć przed wysyłką.** Wiele platform **przekodowuje** to, co przesyłasz, i usuwa sygnał HDR - sieci społecznościowe, komunikatory, niektóre CMS-y - co może sprawić, że obraz będzie wyglądał na ciemny lub wypłowiały. Używaj HDR tam, gdzie kontrolujesz miejsce docelowe (własna strona, ściana wideo, prezentacja na jasnym panelu), a nie jako domyślnej opcji dla wszystkiego.
- **Przezroczystość.** PNG i AVIF zachowują swój kanał alfa; JPG jak zawsze jest nieprzezroczysty. Ścieżka **TIFF** spłaszcza się do **czerni**, a nie do bieli jak ścieżka SDR - w PQ biel to kod 10 000 nitów, więc spłaszczenie do niej otoczyłoby każdą krawędź oślepiającą poświatą.
- **Te same bajty z terminala.** `--hdr=1` razem z `--export=png` lub `--export=jpg` zapisuje 16-bitowy PNG Rec.2100 PQ i JPEG z mapą wzmocnienia ISO 21496-1 także w [CLI](/info/cli.html), z tych samych koderów silnika, a nie z przeglądarki - dzięki czemu natywne narzędzie `<svg>` tworzy plik HDR bez udziału Chromium na żadnym etapie, a PNG jest identyczny co do bajtu z wersją z powłoki webowej. AVIF i TIFF na razie pozostają eksportami tylko z powłoki webowej.

## Wideo

Narzędzia animacji eksportują ruch jako **MP4**, **WebM** lub **GIF** - a tam, gdzie to oferowane, także **APNG**, **Animated WebP** lub wektorowy **Animowany SVG** (powyżej). To, który kontener wideo zobaczysz, zależy od Twojej przeglądarki - selektor pokazuje tylko to, co faktycznie potrafi nagrać:

| Przeglądarka | Pokazuje |
|---|---|
| Safari / iOS | **MP4** |
| Firefox | **WebM** |
| Chrome / Edge 126+ / Android | **MP4 i WebM** |
| Starszy Chrome | **WebM** |

GIF działa wszędzie (świetny do czatu/e-maila; większy i o mniejszej liczbie kolorów niż wideo). Narzędzia animacji udostępniają też **Wait** (sekundy na ustabilizowanie animacji przed nagraniem) i **Duration** (długość klipu).

> Udostępniony link `?format=…`, który żąda kontenera, którego Twoja przeglądarka nie potrafi nagrać, płynnie przechodzi na inny i odpowiednio nazywa plik.

**Dźwięk.** Eksporty wideo nie są nieme. Narzędzie może podłożyć **podkład muzyczny** pod klip - zasób audio z katalogu, zapętlony lub przycięty do długości klipu, z narastaniem/wyciszaniem, głośnością i automatycznym duckingiem pod własnym dźwiękiem materiału - a narzędzia nagrywające przenoszą na żywo dźwięk swojego materiału wprost do pliku. **MP4** i **WebM** zachowują zmiksowaną ścieżkę; GIF i animowane formaty obrazu (APNG, Animated WebP, Animowany SVG) są nieme z natury.

## Dźwięk

Niektóre narzędzia eksportują **dźwięk samodzielnie**, nie tylko jako ścieżkę wideo. **Voice Recorder** rejestruje nagranie z mikrofonu z miernikiem poziomu na żywo i delikatnym wskazywaniem, a następnie zapisuje je jako **MP3** (domyślnie, przekodowany w Twojej przeglądarce) lub w natywnym kontenerze - **M4A** (AAC), **OGG** lub **WebM** (Opus), zależnie od tego, co nagrała Twoja przeglądarka. Podobnie jak wszystko inne, kodowanie odbywa się na Twoim urządzeniu - nic nie jest przesyłane.

Dźwięk, który *wprowadzasz sam*, jest równie zróżnicowany. Selektor zasobów akceptuje **MP3**, **WAV**, **OGG**/**Opus**, **M4A**/**AAC** i **FLAC** (zachowywane bajt w bajt i dekodowane na urządzeniu), **MIDI** (`.mid` - przy imporcie konwertowany na niewielką ścieżkę syntezatora na urządzeniu) oraz **moduły trackerowe** - **MOD**, **XM**, **IT**, **S3M**, **STM**, **MTM** (dekodowane na urządzeniu przez dołączony odtwarzacz, zaledwie kilka kilobajtów danych utworu). Każdy z nich może stać się **podkładem muzycznym** pod eksportem wideo albo grać w ambientowym odtwarzaczu Neurospicy Mode.

Dźwięk *jest* częścią poniższego potoku `format=` / `--export=`: `wav`, `mp3`, `m4a` i `opus` to zwykłe identyfikatory formatów, więc eksport samego dźwięku jest tak samo łatwy do udostępnienia i skryptowania jak PNG. To, co wychodzi, to sam dźwięk, bez obrazu.

## Pochodzenie i znak wodny

Tam, gdzie format to obsługuje, eksporty niosą **metadane pochodzenia** - oprogramowanie, źródło, nazwę narzędzia i linię autorstwa z Twojego profilu - osadzone natywnie (PNG iTXt, JPEG EXIF, PDF info, SVG `<metadata>`, komentarz GIF). To wyłącznie autorstwo; nic nie jest przesyłane. Narzędzia **eksperymentalne** dodatkowo odciskają widoczny znak wodny, nakładany przez host, więc nie da się go usunąć przez edycję narzędzia.

**Lolly Imprint.** Eksporty rastrowe niosą też własny **niewidzialny znak wodny w pikselach** Lolly - *Lolly Imprint* - **domyślnie włączony**, tak jak Content Credentials. Podczas gdy poświadczenie i metadane pochodzenia podróżują *obok* pikseli i giną przy ponownym zapisie, zrzucie ekranu czy usunięciu metadanych, Imprint żyje *w* pikselach i przetrwa ponowną kompresję - więc kopię obrazu można później nadal rozpoznać jako stworzoną w Lolly. To trwała wskazówka, nie kryptograficzna gwarancja, i jest wyłącznie obecnością (nie niesie żadnych danych osobowych). Jeździ w **PNG, JPG, WebP, AVIF, TIFF i BMP**, oraz w rastrach renderowanych przez Lolly, złożonych w **PDF lub PPTX** - nigdy w obrazie, który osadziłeś *Ty*, tylko w tym, co Lolly sama renderuje. Odznacz kartę **Lolly Imprint** w panelu eksportu, żeby go pominąć, albo przekaż `imprint=0` w linku udostępniania. (Przetrwanie w AVIF przy ponownym kodowaniu nie jest jeszcze skalibrowane; wykrywanie w PDF/PPTX obejmuje osadzone rastry Lolly.) [/verify](/verify) wykrywa go na urządzeniu - zobacz [Tożsamość Content Credentials](/info/content-credentials-identity.html#the-lolly-imprint).

**Trwałe poświadczenie.** Obok Imprint znajduje się drugi, cięższy znak: **Durable credential**, który używa modelu neuronowego działającego na urządzeniu (format TrustMark), żeby zapisać identyfikator Lolly *w* pikselach, tak by powiązanie "stworzone w Lolly" przetrwało usunięcie metadanych, ponowne kodowanie i ponowny odczyt zarówno przez narzędzia rozumiejące TrustMark, jak i przez samą Lolly. Jest **domyślnie wyłączone** - w przeciwieństwie do czysto JavaScriptowego Imprint kosztuje przebieg neuronowy na każdy eksport plus jednorazowe pobranie modelu, więc to celowy opt-in, a nie cicha danina. Tylko raster (**PNG, JPG, WebP, AVIF, TIFF**), zaznaczane w panelu eksportu albo przekazywane jako `durable=1` w linku udostępniania. W aplikacjach desktopowej i mobilnej karta jest całkowicie ukryta, zamiast pokazywana jako nic nierobiąca, bo nie ma skąd offline pobrać modelu.

**Content protection.** W panelu eksportu *Password protect*, **C2PA Credentials**, **Lolly Imprint** i **Durable credential** łączą się w jedną zwiniętą, świadomą formatu grupę **Content protection**, dzięki czemu opcje pochodzenia i ochrony pliku żyją w jednym miejscu - grupa pokazuje tylko karty pasujące do wybranego formatu i chowa się całkowicie, gdy żadna nie pasuje. Znaki drukarskie celowo nie są w tej grupie: to geometria produkcji drukarskiej, a nie ochrona, więc **Print marks & bleed** - miara spadu w milimetrach plus Crop, Registration, Bleed, Colour bars i Stamp details - zachowuje własną kartę najwyższego poziomu na formatach drukowych.

![Otwarta grupa Content protection przy eksporcie PNG, pokazująca tylko pasujące do niego karty](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

**Zanim wyeksportujesz (print preflight).** Włącz **Print preflight** (`export-preflight`) we flagach funkcji swojego profilu - jest **domyślnie wyłączony**, więc osoba eksportująca PNG do wiadomości na czacie nigdy nie zostaje zaskoczona ustaleniami przedprzygotowania do druku, a płaszczyzna sterowania wdrożenia ([lolly.work](https://lolly.work)) może domyślnie włączyć go swoim członkom - i karta **Before you export** pojawia się u dołu panelu, tuż nad przyciskami, ilekroć reguły druku mają coś prawdziwego do powiedzenia o zleceniu: format, rozmiar i spad, potem obszary przycięcia i spadu, pokrycie farbą, liczby płyt i liczbę stron, z werdyktem obok nagłówka. Znajduje się pod każdym ustawieniem, bo jest stwierdzeniem *o* tych ustawieniach, a nie kolejnym z nich - i nigdy nie blokuje eksportu. Mówi Ci, co za chwilę zobaczy drukarnia.

**Koszt, wyliczony z Twojego cennika.** Poniżej preflightu - na samym końcu, wciąż nad przyciskami - znajduje się karta, która zamienia te same liczby na pieniądze, i to zawsze tylko z cen, które ktoś jej podał. Odczytuje wszystko, co policzył przebieg preflightu, niezależnie od tego, czy sama karta preflightu jest włączona, i wymaga, żeby prawdziwe były dwie rzeczy: zlecenie ma coś, co cennik w ogóle potrafi wycenić (płyty, arkusze, powierzchnię, strony, wiersze wariantów lub pliki wyjściowe - więc zwykły PNG z logo nigdy jej nie pokazuje), **oraz** obecny jest **cennik**. Cennik to lista cen w formacie JSON od Twojej drukarni. Domyślna kompilacja nie zawiera żadnego i nie ma w aplikacji sposobu, by go wczytać: pojawia się albo jako zasób katalogowy dostarczony przez wdrożenie, albo przez opcjonalne rozszerzenie cennika włączane przez self-hostera lub płaszczyznę sterowania. Bez cennika nic się nie pokazuje - ani monit, ani pusta tabela.

Reguła, wokół której zbudowana jest cała ta funkcja, brzmi: **nigdy nie zmyśla pieniędzy**. Każda liczba to stawka, którą podałeś, razy ilość policzona przez Lolly - `4 plate × €35.00` - a suma podaje swoje źródło w tym samym zdaniu co liczba: wystawcę wskazanego przez cennik oraz datę, z której - jak twierdzi cennik - pochodzą jego stawki. Nie ma domyślnej waluty, żadnego symbolu zastępczego ani zera stojącego za brakującą ceną. To, co plik mówi o sobie samym, zostaje mową zależną: *"Plik podaje: … Lolly tego nie zweryfikowała"*.

A kiedy nie może policzyć uczciwie, robocza tabela **znika**, zamiast degradować się do wyszarzonej lub uzupełnionej na siłę liczby:

- Pozycje, których cennik nie wycenia, oznaczają **brak sumy w ogóle** - jest tylko nagłówek mówiący, ile z nich jest niewycenionych. Cząstkowa suma nie jest mniejszą odpowiedzią, jest błędną.
- Ilość będąca sufitem, a nie dokładną liczbą, niesie **"up to"** aż do sumy częściowej, więc granica nigdy nie jest wybielana do postaci płaskiej liczby.
- Stawki po dacie ważności pokazują **tylko liczby**, dopóki nie naciśniesz *Use these rates anyway* - a wtedy data wygaśnięcia jedzie razem z liczbą, więc przeterminowanej sumy nie da się odczytać jako aktualnej.
- Otwarte przez **link**, pieniądze pozostają ukryte, dopóki nie poprosisz o nie na tym urządzeniu. Ani karta, ani to odsłonięcie nigdy nie podróżują w adresie URL - z tego samego powodu CLI przyjmuje `--rate-card=<file.json>` jako flagę pliku lokalnego, a nigdy jako parametr linku.

Karta to interfejs, nigdy treść: jest usuwana z każdego etapu eksportu, więc nie może przesunąć ani jednego piksela pliku, który pobierasz. I to arytmetyka, nie wycena - wycenę może dać Ci tylko Twoja drukarnia.

**Renderowanie złożone.** Gdy narzędzie osadza wynik innego narzędzia (np. *Event Name Badge* osadzający *QR Code*), zagnieżdżony render jest wstawiany bezpośrednio w eksport nadrzędny - pozostaje **prawdziwym wektorem** w SVG i PDF, a w PNG/JPG/WebP rasteryzuje się ostro. Osadzony element podrzędny jest pośrednikiem: nie dostaje *żadnego* znaku wodnego ani *żadnego* własnego pochodzenia; ma je tylko gotowy zasób nadrzędny. (Kompozycja obejmuje SVG i formaty rastrowe; HTML/MD/TXT nie można komponować.)

## Ochrona hasłem

Dwa niezależne rodzaje blokady, obie całkowicie na urządzeniu.

**Hasło otwarcia PDF** - karta *Password protect* w panelu eksportu oferuje dwa poziomy:

![Rozwinięta karta Password protect przy eksporcie PDF, z polem hasła i dwoma poziomami blokady](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

- **Standard** - podstawowa blokada 40-bitowa (RC4). Otwiera się w *dowolnej* aplikacji PDF i - jako lekki środek odstraszający, a nie prawdziwa ochrona - może być przesyłana w linku udostępniania (jawnym tekstem, celowo). Tylko RGB `pdf`.
- **Strong** - AES-256 (PDF 2.0). Hasło wpisuje się przy eksporcie i **nigdy** nie trafia do linku; otwiera się tylko w nowszych aplikacjach PDF (Acrobat / Preview od ok. 2018), a starsze aplikacje mogą zgłosić uszkodzenie pliku. Strong dotyczy też **PDF-ów Print / CMYK** oraz **każdego PDF-u w zbiorczym zipie** (okno potwierdzenia zbiorczego eksportu zbiera hasło). Ponieważ PDF/X-4 zabrania szyfrowania, zablokowany trybem Strong PDF Print zachowuje CMYK, znaczniki i output intent, ale traci deklarację zgodności PDF/X-4.

Żaden z poziomów nie jest kompatybilny z Content Credentials (zaszyfrowany PDF nie może otrzymać poświadczenia).

**Zablokowane pobrania (cały zip + ochrona wielowarstwowa)** - eksport **ZIP** (format *ZIP* w panelu eksportu, który łączy kilka formatów narzędzia), pobranie **folderu** (Projekty → Pobierz) lub **siatka zbiorcza** mogą zablokować cały zip jednym hasłem, na dwóch poziomach:

- **Standard** - tradycyjny **ZipCrypto**: otwiera się w *dowolnym* narzędziu do rozpakowywania, w tym we wbudowanym rozpakowywaniu Eksploratora Windows, ale jest słaby (środek odstraszający). Jego hasło może być przesyłane w linku udostępniania `?password=`.
- **Strong** - **AES-256** (WinZip AE-2): silny, ale **nie** otwiera się we wbudowanym rozpakowywaniu Eksploratora Windows - odbiorca potrzebuje 7-Zip / WinZip / Keka / macOS. Wpisywane przy eksporcie, nigdy nie trafia do linku.

Ta sama karta *Password protect* w panelu eksportu obsługuje blokady zarówno PDF, jak i ZIP, zmieniając treść w zależności od wybranego formatu. Jedno hasło chroni **wszystkie** elementy - obrazy, SVG, wszystko, łącznie z PDF-ami (tylko kontener zip może chronić pliki inne niż PDF, które nie mają własnej blokady). To też **ochrona wielowarstwowa**: każdy PDF w środku jest *dodatkowo* indywidualnie zablokowany AES-256 tym samym hasłem, więc PDF pozostaje zablokowany nawet po rozpakowaniu zipa. Monit pojawia się przy rozpoczęciu pobierania; puste hasło oznacza brak blokady.

**Linki udostępniania chronione hasłem** - każdy link udostępniania można zaszyfrować, tak aby jego otwarcie wymagało od odbiorcy podania hasła. Cały stan linku jest szyfrowany AES-256 kluczem wyprowadzonym z hasła (PBKDF2); przesyłany jest tylko szyfrogram, więc **hasło nigdy nie znajduje się w linku**, a odszyfrowanie odbywa się **w przeglądarce odbiorcy** - serwer obsługujący link widzi w adresie URL tylko szyfrogram, nigdy hasła ani odszyfrowanego projektu. Włącz to w oknie **Share**. Zaszyfrowany link można wyłącznie *otworzyć* w Lolly (nie da się go osadzić jako obraz, bo ta ścieżka nie może wyświetlić monitu). Zobacz [URL Mode → Encrypted links](/info/url-mode.html).

## Content Credentials (C2PA)

Eksporty mogą nieść **Content Credentials** - podpisany manifest [C2PA](https://c2pa.org) osadzony w pliku, który w sposób odporny na manipulację odnotowuje, że plik powstał w Lolly i nie został od tego czasu zmieniony. To wersja standardowa metadanych pochodzenia opisanych wyżej: kryptograficzne oświadczenie (co utworzyło plik, kiedy, przez kogo i gdzie) powiązane z hashem bajtów pliku, dzięki czemu każda późniejsza edycja jest wykrywalna przez przeglądarkę obsługującą C2PA. Standard jest rozwijany przez [Content Authenticity Initiative](https://contentauthenticity.org) (Adobe, BBC, Microsoft, Nikon i inni), więc te same poświadczenia, które zapisuje Lolly, są przyjmowane przez aparaty, redakcje i pakiety kreatywne.

![Karta C2PA Credentials, domyślnie zaznaczona, z okresem ważności poświadczenia obok](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Formaty.** Każdy kontener z osadzeniem C2PA: **PDF** (RGB i Print), **PNG / Animated PNG**, **JPG**, **GIF**, **SVG**, **TIFF** (RGB i Print), **WebP** (statyczny i animowany), **AVIF**, **MP4**, **WebM** oraz kontenery audio **MP3**, **WAV**, **M4A** i **OGG/Opus** - dzięki temu nagrany lub zsyntetyzowany klip głosowy niesie takie samo poświadczenie jak obraz. Paczka **ZIP** stempluje osobno każdy obsługiwany element, co jest też sposobem, w jaki poświadczenie otrzymuje **Animated SVG** (pod spodem to zwykły dokument SVG; bezpośredni eksport Animated SVG nie ma własnej karty). MP4, AVIF i M4A używają wiązania BMFF ze specyfikacji, a MP3 mapowania ID3v2, więc `c2patool` i inne przeglądarki obsługujące C2PA je weryfikują; **WebM** i **OGG/Opus** nie mają jeszcze ustandaryzowanego mapowania C2PA, więc Lolly przenosi manifest odpowiednio jako załącznik Matroska i pole OpusTags, co sprawdza własny weryfikator Lolly (i CLI). (`ico`, `eps`, `emf`, `dxf`, `bmp`, `pptx`, formaty Office oraz formaty tekstowe/danych nie mają kontenera C2PA.)
- **Domyślnie włączone.** Karta **C2PA Credentials** w panelu eksportu jest domyślnie zaznaczona dla niemal każdego narzędzia - odznacz ją, by pominąć poświadczenie w pojedynczym eksporcie (albo przekaż `c2pa=off` w linku udostępniania). Narzędzie może całkowicie z tego zrezygnować w swoim manifeście.
- **Co jest zapisywane.** Narzędzie i aplikacja, które utworzyły plik, czas podpisania, powierzchnia eksportu (rodzina silnika przeglądarki + rodzina systemu operacyjnego - celowo ogólne, nigdy odcisk palca urządzenia) oraz - tylko gdy włączona jest opcja *Profile → Use my details* - twoje imię, nazwisko i e-mail jako autora pracy.
- **Co widzą odbiorcy.** Narzędzia do sprawdzania Content Credentials (aplikacje Adobe, `c2patool`, contentcredentials.org/verify) odczytają manifest i pokażą oświadczenie. Ponieważ Lolly podpisuje kluczem wygenerowanym **na twoim urządzeniu** - a nie certyfikatem z listy zaufania - przeglądarki zgłaszają je jako poświadczenie *niezweryfikowane*. Struktura i odporność na manipulację są prawdziwe; po prostu tożsamość podpisującego nie jest poręczona przez żaden urząd. Aby to zmienić, możesz zarejestrować **zweryfikowaną tożsamość** (Profile → Content Credentials): krótkotrwały certyfikat z Lolly CA wiąże twój e-mail z twoimi eksportami, podczas gdy klucz podpisujący nadal nigdy nie opuszcza twojego urządzenia - zobacz [Content Credentials Identity](/info/content-credentials-identity.html).
- **Sprawdzanie pliku.** Lolly weryfikuje też własne poświadczenia: upuść dowolny plik na [/verify](/verify) (albo uruchom `lolly validate <file>` w CLI), aby otrzymać raport wykonany na urządzeniu - z nagłówkiem informującym, czy plik rzeczywiście powstał w Lolly i czy nie został od tego czasu zmieniony. Widok Verify w przeglądarce sprawdza dużo więcej niż samo poświadczenie: wykrywa **treści wygenerowane przez AI**, wykrywa **Lolly Imprint**, sprawdza podpisy **SEAL** oraz (opcjonalnie) zewnętrzne znaki wodne pikselowe i ujawnia **ukryte dane** - wszystko na urządzeniu, bez przesyłania czegokolwiek. Zobacz [Content Credentials Identity → Beyond the credential](/info/content-credentials-identity.html#beyond-the-credential-what-else-verify-shows).
- **Prywatność.** Wszystko dzieje się na twoim urządzeniu: klucz podpisujący jest tworzony na potrzeby eksportu i nigdy nie opuszcza przeglądarki, nic nie jest przesyłane, a oświadczenie zawiera tylko to, co już niosą metadane pochodzenia. Narzędzia prywatności (przekształcenia *twoich własnych* plików na urządzeniu) nigdy nie dodają poświadczeń, a *Strip Hidden Data* usunie manifest C2PA tak samo jak każde inne osadzone metadane.
- **Interakcje.** W przypadku PDF-ów Content Credentials i **ochrona hasłem** (żaden z poziomów - patrz wyżej) wzajemnie się wykluczają (zaszyfrowany PDF nie może otrzymać załącznika z poświadczeniem). Poświadczenie jest dodawane jako ostatni krok nad gotowymi bajtami - po stemplowaniu DPI/EXIF/profilu koloru, metadanych PDF/X i znaczników drukarskich.

## Na telefonie

Kontrolki eksportu znajdują się za pływającym przyciskiem **Render**, który otwiera arkusz **Export** - te same formaty, rozmiar, kopiowanie, pobieranie i udostępnianie, dostosowane do dotyku.

## Formaty - skrót

Każdy identyfikator, jaki potrafi wyrenderować host, pogrupowany. To także wartości parametru URL `format=` oraz flagi CLI `--export=` - zobacz [URL Mode](/info/url-mode.html) i [CLI](/info/cli.html). Narzędzie oferuje tylko podzbiór zadeklarowany przez autora, więc selektor jest zawsze krótszy niż ta lista.

| Rodzaj | Identyfikatory |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Wektor | `svg` · `svgz` (SVG spakowany gzip) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (plik do cięcia) |
| Strona i dokument | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `scorm` (pakiet kursu SCORM, zip) · `penpot` (plik projektu Penpot) · `docx` (Word) · `odt` (OpenDocument Text) |
| Ruch | `gif` · `apng` (Animowany PNG) · `webp-anim` (Animowany WebP) · `svg-anim` (Animowany SVG) · `webm` · `mp4` |
| Audio | `wav` · `mp3` · `m4a` · `opus` |
| Tekst i dane | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `css` · `scss` · `gpl` (paleta GIMP) |
| Pakiet | `zip` |

Kilka kolejnych identyfikatorów pochodzi z **własnego haka eksportu narzędzia**, a nie ze wspólnej ścieżki renderowania: `ase` (Adobe Swatch Exchange, z Palette Lab), `exr` i `hdr` (rastry HDR z Darkroom) oraz `ttf` / `otf` / `woff` (Font Convert). Format wybiera się tak samo - selektor, `format=`, `--export=` - po prostu bajty buduje narzędzie. Font Convert jest jedynym wyjątkiem: przekształca plik czcionki, który dostarczasz *ty*, więc dla samego adresu URL nie ma nic do wyrenderowania.
