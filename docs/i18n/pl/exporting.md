# Export a file

Coś zrobiłeś i musi to opuścić Lolly: PNG do czatu, PDF dla drukarni, prezentacja, którą współpracownik będzie dalej edytować. Naciśnij **Export**, lewą połowę pigułki **Export | Save**. Wybierz format obok nazwy pliku, a potem naciśnij **Download**. Plik powstaje na Twoim urządzeniu.

To, co widzisz na kanwie, jest tym, co zawiera plik. Menu formatów wymienia tylko to, co to narzędzie może wykonać w tej przeglądarce.

W większości zadań właściwy jest jeden z trzech formatów:

| Do czego | Wybierz | Dlaczego |
|---|---|---|
| Ekran, wiadomość lub slajd | **PNG** | Otwiera go każda aplikacja, a gdy narzędzie to oferuje, zachowuje przezroczyste tło |
| Gotowa strona lub cokolwiek drukowanego | **PDF** | Prawdziwy rozmiar strony, który drukuje się tak, jak wygląda; **Print PDF**, tam gdzie narzędzie to oferuje, to wersja CMYK do druku offsetowego |
| Grafika, która musi pozostać ostra w dowolnym rozmiarze | **SVG** | Kształty wektorowe, ostre od odznaki po baner |

::: check Sprawdź plik w rozmiarze, w jakim będzie używany
Zanim go wyślesz, otwórz go na ekranie, dla którego został przygotowany, albo wydrukuj go w rzeczywistym rozmiarze.
:::

::: details Zatwierdzenia i dostarczanie z Lolly Work (opcjonalnie)
[Organizacja, która prowadzi Lolly Work](/info/organisation.html), może nadzorować, które formaty i ustawienia eksportu widzą jej członkowie. Tam, gdzie wymagane jest zatwierdzenie, **Request approval** zastępuje **Download**. Postępuj zgodnie z polityką, którą pokazuje Twoja instancja.

Lolly Work może też dostarczyć plik do skonfigurowanych celów S3, WebDAV i HTTP, z krokami zatwierdzania, potwierdzeniami dostarczenia i zapisem audytu. Przesłanie pliku do tego przepływu wysyła go do usługi organizacji; zwykłe pobranie zostaje na Twoim urządzeniu. Osobiste cele Send i dostarczanie organizacji są konfigurowane oddzielnie.

Operatorzy konfigurują to według [organisation delivery guide](/info/work-delivery.html). Dla renderów serwerowych w kolejce i partii zobacz [CLI batch and automation](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

## Jak działa eksport

Gdy eksportujesz, kanwa narzędzia jest renderowana do wybranego formatu i oddawana jako pobranie lub umieszczana w schowku.

Pliki powstają trzema drogami. Większość narzędzi **renderuje kanwę**. Formaty tekstowe i danych (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) są **generowane z treści narzędzia**, a nie rysowane z obrazu. Utility prywatności, takie jak *Strip Hidden Data*, **przekształcają wybrany plik** na Twoim urządzeniu i zwracają go bez kanwy, znaku wodnego ani dodanych metadanych, ponieważ to już Twój własny plik.

![Trzy drogi eksportu zbiegają się w gotowy plik: renderowanie kanwy, generowanie tekstu lub danych z treści albo przekształcenie wybranego pliku na urządzeniu.](/info/diagrams/concepts/three-export-paths.svg)

Panel eksportu oferuje te akcje. Autor narzędzia wybiera, które się pojawiają; domyślny zestaw to Copy, Download i Save.

- <!--i:download--> **Download** zapisuje plik. Jeśli potem nie możesz go znaleźć, zobacz [Find a file you downloaded](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> **Copy** umieszcza obraz w schowku, gotowy do wklejenia w czacie, e-mailu lub dokumencie. Tam, gdzie przeglądarka nie potrafi kopiować obrazów, pobiera zamiast tego i mówi o tym.
- <!--i:folder--> **Save** zachowuje bieżący projekt w Projects jednym kliknięciem i nigdy nie pobiera pliku. **Save as**, obok **Download**, pyta dokąd (zobacz [Saving and continuing](/info/using.html#saving-continuing)).
- <!--i:link--> **Share** otwiera okno Share: link odtwarzający projekt, przełączniki przy odwiedzeniu (pełny ekran, panel eksportu, pobranie lub kopia przy otwarciu) i opcjonalny **Shortest link**, który pakuje cały stan w zwarty token (zobacz [URL Mode](/info/url-mode.html)).

![Panel eksportu - format, rozmiar oraz akcje Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Gdy projekt osadza render innego narzędzia, taki jak box obrazu Design zawierający link QR Code, zagnieżdżony render jest rysowany w eksporcie rodzica. Pozostaje prawdziwym wektorem w SVG i PDF i rasteryzuje się ostro w PNG, JPG i WebP. Osadzony render nie dostaje znaku wodnego ani własnej proweniencji; tylko gotowy plik. Eksporty HTML, Markdown i TXT nie mogą zawierać skomponowanego renderu.

## Wybierz format

Nazwa pliku i menu formatu znajdują się razem jako jedna para `name.format`, poniżej **Pobierz**.

![Pole nazwy pliku połączone z selektorem formatu, tak że eksport wygląda jak jedna para name.format](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Zacznij od tego, dokąd plik trafia. Każda karta wymienia formaty pasujące do tego miejsca docelowego; narzędzie pokazuje tylko te, które potrafi wykonać.

::: figure exporting-format-chooser
Sześć miejsc docelowych i formaty pasujące do każdego z nich.
:::

Wordmark złożony krojem Twojego systemu projektowego eksportuje się jako SVG z każdą literą jako obrysowaną ścieżką, więc jeden plik pozostaje ostry w rozmiarze wizytówki i w rozmiarze reklamy na budynku.

![Cienki, szeroko rozstawiony wordmark z napisem Aurora, rodzaj czystej grafiki wektorowej, o którym jest wiersz SVG w tabeli](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Każdy format i do czego służy
| Czego chcesz | Użyj | Dlaczego |
|---|---|---|
| Ostre logo lub grafika, która się skaluje | **SVG** | Wektor: skalowalny, mały i edytowalny; efekt, którego eksport wektorowy nie potrafi narysować, jest osadzany jako obraz |
| Wektor dla aplikacji Office i Windows | **EMF** | Wkleja się jako edytowalny wektor do PowerPointa i Worda, z żywym tekstem; Google Drive otwiera go w Rysunkach Google |
| Wektor dla druku i aplikacji projektowych | **EPS** lub **EPS (CMYK)** | Wektor PostScript dla Illustratora i procesów drukarskich |
| Wektor dla maszyn tnących | **DXF** | Wycinarki laserowe, plotery winylowe i CNC: ścieżki konturów w milimetrach |
| Edytowalna prezentacja | **PowerPoint** (PPTX) | Natywny edytowalny tekst i kształty, z obrazami i wektorami zachowanymi do wyodrębnienia |
| Edytowalny dokument tekstowy | **Word** (DOCX) lub **OpenDocument** (ODT) | Prawdziwe akapity i nagłówki, które edytor tekstu może dalej edytować (Doc Studio) |
| Układ dla InDesign | **InDesign IDML (static subset)** | Tekst, prostokąty, owale i obrazy, jeden rozkładówka na obszar roboczy (Design) |
| Edytowalny dokument Penpot | **Penpot** | Plansze, kształty, tekst i powiązane tokeny |
| Zdjęcie lub obraz ogólnego przeznaczenia | **PNG** (bezstratny) lub **JPG** (mniejszy) | Uniwersalny raster |
| Mniejsze nowoczesne obrazy | **WebP** lub **AVIF** | Lepsza kompresja, z przezroczystością |
| Druk | **PDF** lub **Print PDF** (CMYK) | Prawdziwy rozmiar strony; CMYK dla maszyny drukarskiej |
| Raster do druku dla maszyny | **Print TIFF** (CMYK) | Piksele DeviceCMYK dla RIP |
| Animacja dla sieci | **GIF** | Odtwarza się wszędzie; większe pliki |
| Animacja z pełnym kolorem i prawdziwą przezroczystością | **APNG** | Animowany PNG: bez limitu palety |
| Animacja, najmniejszy plik | **Animated WebP** | Pełny kolor i przezroczystość, mniejszy niż GIF lub APNG |
| Animowany wektor, który się skaluje | **Animated SVG** | Samodzielny; zapętla się w przeglądarce lub w `<img>`, w dowolnym rozmiarze (Lottie Ad) |
| Animacja, która pozostaje edytowalna | **dotLottie** | Kształty, ścieżki i zewnętrzne klucze transformacji z osi czasu Design |
| Przekazanie do Premiere | **Premiere XML + media** | Klipy z czasem i oryginalne media dla Premiere (Design) |
| Wideo do mediów społecznościowych i udostępniania | **MP4** lub **WebM** | Najlepsza jakość przy rozmiarze pliku (zobacz [Video](#video)) |
| Napisy | **SRT** lub **VTT** | Tekst z czasem dla odtwarzacza wideo (Captions, Audiogram i Record) |
| Kurs szkoleniowy | **SCORM (LMS)** | Wersjonowana witryna, pakiet SCORM lub xAPI (zobacz [SCORM](#scorm-course-packages)) |
| Tekst sformatowany lub podpis e-mail | **HTML** | Wkleja się sformatowany do klientów poczty |
| Zwykła treść | **MD** lub **TXT** | Tylko tekst |
| Wydarzenie w kalendarzu | **ICS** | Importuje się do każdej aplikacji kalendarza |
| Wizytówka kontaktowa | **VCF** | Importuje się do książek adresowych |
| Dane strukturalne do ponownego importu | **JSON** lub **CSV** | Zachowuje treść narzędzia w obie strony |
| Favicon | **ICO** | Ikona witryny w wielu rozmiarach; **ZIP** pakuje kilka formatów |
:::

### Przezroczystość

Narzędzia, które to obsługują, oferują przełącznik przezroczystego tła, taki jak **No BG**. PNG, WebP, AVIF, SVG, APNG i Animated WebP zachowują przezroczystość, a GIF zachowuje twardą krawędź. JPG i PDF są zawsze nieprzezroczyste. TIFF spłaszcza na biel albo na czerń na ścieżce HDR opisanej w [HDR](#hdr-bright-colours).

## Rozmiar i jednostki druku

Eksporty używają natywnego rozmiaru pikseli narzędzia, chyba że narzędzie oferuje **dimensions**. Wtedy ustawiasz szerokość, wysokość i **unit**:

- **px** (domyślnie) to dokładne piksele.
- **mm, cm, in, pt** i **pc** to rozmiary fizyczne. Przy jednostce fizycznej ustawiasz też **DPI** (domyślnie 300). **PDF** staje się prawdziwą stroną w tym rozmiarze, **raster** dostaje liczbę pikseli dla tego DPI i zapisuje rozdzielczość, a **SVG** zachowuje jednostkę fizyczną z viewBox w pikselach.

Dla rastra o wyższej rozdzielczości wpisz większą szerokość i wysokość albo wybierz jednostkę fizyczną i podnieś DPI (piksele = rozmiar × DPI). Szerokość `210`, wysokość `297` i jednostka `mm` dają stronę A4.

![Wiersz wymiarów ustawiony na 210 na 297 mm, z widocznym polem DPI, ponieważ jednostka jest fizyczna](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Klatki nieruchome z kompozycji czasowej

Skomponowana kompozycja z czasem, taka jak oś czasu [Sequence](/info/sequence-editor.html) w Design, się porusza, więc eksport nieruchomy musi wybrać moment: **klatkę przy głowicy odtwarzania**. Ustaw głowicę tam, gdzie chcesz obraz, i eksportuj.

Dla więcej niż jednego momentu obok rozmiaru wyjściowego pojawia się pole **Frames**. Pokazuje się tylko dla kompozycji z czasem i formatu nieruchomego (PNG, JPG, WebP, SVG lub PDF). Zostaw `1` dla klatki przy głowicy. Podnieś je, a dostaniesz tyle nieruchomych obrazów, rozłożonych równomiernie na całej sekwencji:

- PNG, JPG, WebP i SVG wracają jako jeden ZIP: `<name>-01.png`, `-02.png` i tak dalej.
- PDF wraca jako jeden dokument z taką liczbą stron.

Każdy obraz pochodzi ze środka swojego wycinka osi czasu, więc pierwsza klatka nigdy nie jest na wpół wyblakłym wejściem, a ostatnia nigdy nie jest pustym momentem po zakończeniu każdego klipu.

::: figure exporting-contact-sheet
Frames: 4 tnie sekwencję na cztery równe wycinki i bierze środek każdego.
:::

Użyj tego do storyboardu, arkusza kontaktowego do przeglądu lub karuzeli społecznościowej wyciętej z montażu wideo. Liczba jest ograniczona do 64, a wszystko inne wpisane w pole wraca do `1`. Każda klatka jest zwykłym obrazem nieruchomym, więc poświadczenia, Imprint, jednostki fizyczne i DPI zachowują się tak jak w pojedynczym eksporcie. Link eksportu, CLI i MCP proszą o ten sam arkusz przez `cuts=` (zobacz [Contact sheets](/info/url-export.html#contact-sheets)).

## Wiele plików naraz

Lolly ma trzy sposoby pracy w dużej skali, każdy do innego zadania:

::: cols
## Tabela staje się jednym dokumentem
Narzędzie z danymi wejściowymi typu tabela, takie jak **Battlecards**, zamienia każdy wiersz w stronę. Wklej tabelę z arkusza kalkulacyjnego i dostań jeden PDF. Popraw wiersze w arkuszu i wklej ponownie.
## CSV staje się jednym plikiem na wiersz
**Batch** (`#/batch`) przyjmuje CSV i renderuje jeden eksport dla każdego wiersza: identyfikatory lub certyfikaty, po jednym pliku, dostarczone w ZIP. Zobacz [Batch](/info/batch.html#make-many-versions-of-one-design).
## Kilka projektów dostaje jedną edycję
**Multi-edit** otwiera kilka zapisanych sesji obok siebie dla tej samej poprawki w różnych projektach. Zobacz [Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Z **Projects** **Render folder** eksportuje każdą zapisaną sesję w folderze i jego podfolderach jako jeden zagnieżdżony ZIP, a **Render selection** robi to samo dla dowolnego zaznaczenia wielokrotnego; jedna zapisana sesja renderuje się do własnego pliku. Zapisaną sesję można też ponownie udostępnić jako link narzędzia z Projects, który otwiera ją z tymi samymi ustawieniami.

## Pliki, które pozostają edytowalne gdzie indziej

Niektóre formaty przekazują Twoją pracę innej aplikacji jako edytowalną treść, a nie obraz.

### PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart, Diagrams, Flow Chart i Agenda eksportują prezentację PowerPoint, jeden slajd na stronę. Każda strona jest rozbierana na natywne obiekty, aby współpracownik mógł edytować prezentację i wyjmować z niej zasoby:

- <!--i:font--> **Tekst** staje się edytowalnymi polami tekstowymi PowerPoint z rozmiarem czcionki, kolorem, grubością, kursywą i wyrównaniem układu.
- <!--i:pentool--> **Wektory**, takie jak logo i ikony, są osadzane jako obrazy SVG; pozostają ostre, a PowerPoint może na nich wykonać *Convert to Shape*.
- <!--i:photos--> **Obrazy** przychodzą w natywnej rozdzielczości jako osobne obrazy. Przycięty obraz główny zachowuje pełny obraz za kadrem, a każdy filtr lub mieszanie jest wypalone.
- <!--i:layers--> **Tła, obramowania i linie** stają się kształtami prostokątów i linii.

![Panel eksportu z wybranym PowerPointem: jeden slajd na stronę, tekst i kształty pozostają edytowalne](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Układ jest przybliżony; celem jest treść do ponownego użycia. Wszystko, czego przejście po DOM nie potrafi wyrazić natywnie, jak złożony filtrowany lub maskowany obszar, jest osadzane jako obraz, aby nic nie przepadło. Prezentacja ma jeden rozmiar slajdu, wzięty z pierwszej strony.

PowerPoint to też wejście: [Rebrand a deck](/info/rebrand.html) przenosi prezentację na Twój system projektowy, a [Import a design](/info/design-import.html) otwiera ją w Design.

### Penpot

Większość narzędzi eksportujących SVG eksportuje też **plik Penpot** (`.penpot`), gotowy do dalszej edycji w Penpot.

| Co zrobiłeś | W Penpot |
|---|---|
| Tekst | Edytowalne obiekty tekstowe: popraw literówkę lub zmień styl |
| Kształty, ścieżki, gradienty i obrazy | Własne edytowalne kształty wektorowe |
| Kolor lub czcionka z tokenu systemu projektowego | Żywe powiązanie z tokenem: edytuj token, a każdy kształt, który go dziedziczy, podąża |
| Cały projekt | Komponent wielokrotnego użytku w panelu Assets |
| Złożona ilustracja lub żywa kanwa | Osadzona osobno jako obraz, a edytowalna treść wokół niej nietknięta |

Z Design każda ramka staje się planszą Penpot. Kolory i typografie systemu projektowego trafiają do panelu Assets, a jego pełny zestaw tokenów do panelu Tokens. Stamtąd Penpot trzyma własną kopię: token edytowany w Penpot wraca przez import w [Design System Setup](/info/brand-studio.html).

![Panel eksportu z wybranym Penpot: plik .penpot oraz Send to Penpot obok pobierania](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Aby otworzyć plik, uruchom Penpot, wybierz projekt i wybierz **Import**. Gdy jesteś zalogowany do Penpot z panelu eksportu, **Send to Penpot** wykonuje ten krok za Ciebie.

### Word, OpenDocument i InDesign

**Doc Studio** eksportuje **Word** (DOCX) i **OpenDocument** (ODT) z prawdziwymi akapitami i nagłówkami.

**Design** eksportuje **InDesign IDML (static subset)**: tekst, prostokąty, owale i obrazy PNG lub JPEG, jedną rozkładówkę na obszar roboczy. Obsługiwane formatowanie śródwierszowe pozostaje edytowalne, obrazy podróżują w `Links`, a współrzędne stają się punktami InDesign. Ponowne łączenie, zastępowanie czcionek i zmienione zawijanie mogą wymagać uwagi. Efekty, animacja, skomponowane artykuły i nieobsługiwana geometria zatrzymują eksport z raportem, który je wymienia. IDML nie zachowuje oryginalnego dokumentu, więc wyślij PDF dla gotowej grafiki.

### Osie czasu: dotLottie i Premiere

Z osi czasu Design **dotLottie** zapisuje animację, która pozostaje edytowalna w narzędziach Lottie; [Lottie animations](/info/sequence-editor.html#lottie-animations) wymienia, co zachowuje. **Premiere XML + media** pakuje klipy z czasem i ich oryginalne media dla Premiere; zobacz [Premiere XML exchange](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (pakiety kursów)

Eksport kursu jest wyłączony, dopóki nie włączysz **Training and courses** w Settings → Preferences → Feature flags.

Potem wybierz **Export course** z obsługiwanego narzędzia, folderu projektu lub zaznaczenia. W Design wybranie **SCORM (LMS)** i **Download** otwiera ten sam przepływ kursu. Lolly zapisuje pracę, pozwala przejrzeć zawartość i kolejność kursu, a potem otwiera moduł i jego okno eksportu.

- <!--i:layers--> Wybierz wersję dla każdego źródła: strony nieruchome, ruch jako wideo, audio lub zasób do pobrania. Dodaj tekst lekcji i alternatywy do czytania w module.
- <!--i:clock--> Obejrzyj podgląd odtwarzacza ucznia i przejrzyj opisy oraz napisy. Ruch jest dołączany jako wideo, także cicha animacja.
- <!--i:document--> Wybierz cel Website, SCORM 1.2, SCORM 2004 4th Edition lub eksperymentalny xAPI. Sprawdź zawartość i rozmiar ZIP, a potem zapisz i pobierz sprawdzoną wersję.
- <!--i:check--> Ukończenie wymaga potwierdzenia każdej wymaganej lekcji i wybrania Finish.

![Panel eksportu na pokazie Design z wybranym SCORM (LMS)](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Pakiet zawiera gotową treść i nie wymaga konta Lolly. Umieść ZIP Website na hoście HTTP(S); zaimportuj ZIP LMS bez zmian. Przetestuj miejsce docelowe, zanim udostępnisz kurs. Dla kursu zbudowanego z kilku zapisanych prac zobacz [Create a training course](/info/training-creators.html).

### DXF (pliki do cięcia)

Asset Export, Diagrams, Growth, Logo Wall, QR Code, Street Map, Wayfinding i Wordmark eksportują **DXF**, format wymiany AutoCAD R12, który czytają wycinarki laserowe, plotery winylowe i oprogramowanie CNC. Geometria jest zapisywana jako ścieżki konturów w milimetrach, tekst jest obrysowany, a kolor mapuje się na najbliższy AutoCAD Color Index, który zwykle steruje operacją maszyny. DXF to tylko grafika liniowa: obszar fotograficzny lub filtrowany nie ma ścieżki cięcia i jest pomijany z ostrzeżeniem. Użyj SVG lub PDF, aby zachować treść rastrową.

Street Map to najjaśniejszy przypadek. Cały projekt to już kreski, więc każda droga i kanał stają się ścieżką cięcia.

::: showcase
![Render Street Map przedstawiający Paryż tuszem na kremowym tle - czysta grafika liniowa, więc każda kreska przetrwa podróż do wycinarki](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Przewiń, a kamera oddala się przez rzeczywistą geometrię: siedem ścieżek, żadnych pikseli, każda kreska ostra jak włos przy dowolnym powiększeniu. To dokładnie ten sam plik, który odczytuje wycinarka.
:::

## Druk

**Print PDF** zapisuje CMYK względem nazwanych warunków druku, domyślnie **Coated FOGRA39**. Próbki marki ze zmierzonymi wartościami farb konwertują się dokładnie; inne kolory używają standardowej konwersji urządzenia. **Print TIFF** zapisuje piksele DeviceCMYK dla RIP i zapisuje te same warunki druku w metadanych TIFF. Kontrolka Colour profile steruje obydwoma; [Colour profiles](#colour-profiles) podaje szczegóły.

**Print marks & bleed** ma własną kartę w formatach druku: spad w milimetrach plus Crop, Registration, Bleed, Colour bars i Stamp details.

Niektóre narzędzia budują **wielostronicowy PDF**: okładkę, treść, która płynie na tyle stron, ile potrzebuje, i tylną stronę, jak w narzędziu *Booklet*. Każda strona jest prawdziwą pionową stroną PDF w A4, US Letter lub A5, a każdy blok możesz wymusić na nową stronę. To dokumenty RGB bez znaczników cięcia i spadu, które należą do jednostronicowego Print PDF. PDF Design może też być **Notes handout**: pionowa strona dla każdego slajdu z jego notatkami prelegenta pod spodem.

**Przed eksportem.** Karta **Before you export** na dole panelu mówi, co za chwilę zobaczy drukarnia: format, rozmiar i spad, obszary cięcia i spadu, pokrycie farbą, liczbę płyt i liczbę stron, z werdyktem obok nagłówka. Nigdy nie blokuje eksportu. Design zawsze pokazuje kartę z własnymi kontrolami, w tym reguły organizacji systemu projektowego warstwa po warstwie i sygnał pisania dla tekstu dokumentu ([Before you export](/info/design.html#before-you-export)), i dodaje te kontrole druku, gdy **Print preflight** jest włączone. W innych narzędziach włącz **Print preflight** w Settings → Preferences → Feature flags; domyślnie jest wyłączone, a wdrożenie Lolly Work może je włączyć dla swoich członków.

**Po eksporcie.** Gdy plik jest gotowy, Lolly odczytuje go z powrotem i porównuje z tym, co wybrałeś: format, rozmiar w pikselach lub stronie, długość klipu, przezroczyste tło, kolor CMYK, HDR, Content Credentials oraz hasło PDF lub ZIP. Wszystko, co się różni, jest zapisane na karcie eksportu. Każdy pomiar pochodzi z pliku, nigdy z ustawienia, a właściwość, na którą plik nie potrafi odpowiedzieć, nie jest liczona jako zgodna. Wiersz poleceń zapisuje pełne porównanie przez `--export-report` (zobacz [Render with the CLI](/info/cli-rendering.html)).

Kontrole inspektora Design i porównanie marki w Design System Setup to osobne kontrole: patrzą na projekt, a te dwie karty patrzą na plik.

::: details Koszt z cennika
Pod preflight karta kosztu zamienia te same liczby na pieniądze, używając wyłącznie cen dostarczonych przez kogoś. Czyta te liczby, nawet gdy sama karta preflight jest wyłączona. Potrzebuje dwóch rzeczy: zadania, które cennik potrafi wycenić (płyty, arkusze, powierzchnia, strony, wiersze wariantów lub pliki wynikowe, więc zwykłe logo PNG nigdy jej nie pokazuje), oraz **rate card**, cennika JSON od Twojej drukarni. Domyślna kompilacja nie ma żadnego i nie ma sposobu na wczytanie go w aplikacji. Rate card przychodzi jako zasób katalogu dostarczany przez wdrożenie albo przez opcjonalne rozszerzenie rate-card, które włącza samodzielny host lub płaszczyzna sterowania. Bez rate card nic się nie pokazuje.

Każda kwota to stawka, którą dostarczyłeś, razy ilość, którą policzyło Lolly, taka jak `4 plate × €35.00`, a suma niesie swoje źródło: wystawcę na karcie i datę, z której pochodzą stawki. Nie ma domyślnej waluty ani zastępczej ceny. To, co plik mówi o sobie, pozostaje mową zależną: *"The file says: … Lolly has not verified this."*

Gdy kwoty nie da się wyliczyć, tabela jest wycofywana zamiast wypełniana:

- Wiersze, których karta nie wycenia, oznaczają **brak sumy w ogóle**, tylko nagłówek mówiący, ile jest niewycenionych.
- Ilość będąca pułapem przenosi **"up to"** do swojej sumy częściowej.
- Stawki po dacie ważności pokazują **tylko liczby**, dopóki nie naciśniesz *Use these rates anyway*; data wygaśnięcia jedzie wtedy z kwotą.
- Otwarte przez **link**, pieniądze pozostają ukryte, dopóki nie poprosisz o nie na tym urządzeniu. CLI przyjmuje `--rate-card=<file.json>` jako plik lokalny i nigdy jako parametr linku.

Karta jest usuwana z każdego etapu eksportu, więc nigdy nie zmienia pliku. To arytmetyka, a nie wycena; wyceny może dokonać tylko Twoja drukarnia.
:::

## Ruch i dźwięk

### Wideo

Narzędzia animowane eksportują **MP4** i **WebM**. Selektor pokazuje tylko kontenery, które ta przeglądarka potrafi wykonać, a udostępniony link z `?format=`, który prosi o niemożliwy, wraca do drugiego z odpowiednią nazwą pliku. Narzędzia animowane oferują też **Start after**, które trzyma kanwę nieruchomo przez chwilę, aby animacje i czcionki się ustabilizowały przed nagrywaniem, oraz **Duration**, długość gotowego klipu. **Motion blur** (Off, Draft quality, Standard lub High, z **Shutter angle**) rozmywa szybki ruch kosztem czasu renderowania. Tam, gdzie przeglądarka to obsługuje, **Record live** nagrywa podgląd na ekranie w czasie rzeczywistym przez udostępnianie ekranu.

![Ustawienia czasu dla animowanego eksportu: Start after, Duration, Motion blur z Shutter angle oraz Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** wybiera Smaller file, Balanced lub Best quality. **Advanced** otwiera **Codec**, **Frame rate**, **Rate mode** i **Hardware acceleration**. Tam, gdzie narzędzie ma napisy, **Captions** wybiera **Embedded track** albo **Sidecar .vtt + .srt** obok wideo. Link niesie jakość, kodek, liczbę klatek, czas trwania i opóźnienie startu jako `vq`, `codec`, `fps`, `seconds` i `wait` ([URL parameters](/info/url-parameters.html)).

Eksporty wideo zachowują dźwięk. Narzędzie może położyć **music bed** pod klipem: zasób audio zapętlony lub przycięty do długości klipu, z wyciszaniem, głośnością i ducking pod własnym dźwiękiem materiału. Narzędzia nagrywające przenoszą swoje audio na żywo do pliku.

Prezentacja Design, która pozostaje prezentacją klikaną, nadal może wyjść jako wideo. **Export slides as video** w menu Present otwiera arkusz eksportu na MP4. Każdy slajd gra przez swój własny czas, albo przez Duration arkusza eksportu, gdy go nie ma, a przejście slajdów prezentacji gra między nimi jako rozpuszczenie. Sam dokument się nie zmienia.

### Animowane obrazy

**GIF** odtwarza się wszędzie i pasuje do czatu i e-maila; jest większy i ma mniej kolorów niż wideo. **APNG** i **Animated WebP** zachowują pełny kolor i przezroczystość. **Lottie Ad** eksportuje też **Animated SVG**: klatki wektorowe z osadzonymi klatkami kluczowymi CSS, więc skaluje się do dowolnego rozmiaru i zapętla w karcie przeglądarki lub w `<img>` bez kodeka. Jego tekst jest obrysowany, a domyślna liczba klatek jest niższa, ponieważ każda klatka jest cięższa niż bitmapa. Wszystkie są ciche.

### Audio

Niektóre narzędzia eksportują sam dźwięk. **Voice Recorder** przechwytuje nagranie z mikrofonu z miernikiem poziomu na żywo i zapisuje je jako **MP3**, **WAV**, **M4A (AAC)** lub **Opus (WebM)**, zakodowane na Twoim urządzeniu. `wav`, `mp3`, `m4a` i `opus` to zwykłe identyfikatory formatów, więc eksport audio jest tak samo udostępnialny i skryptowalny jak PNG.

Selektor zasobów przyjmuje szeroki zakres audio na music bed, od MP3 i FLAC po MIDI i moduły trackerów; [Formats](/info/formats.html) je wymienia. [Piosenka Rondocode](/info/rondocode.html) gra przez tyle, ile prosi jej klip.

## Kolor i HDR

Lolly czyta każdy współczesny kolor CSS, wykonuje obliczenia kolorów percepcyjnie i zapisuje każdy plik w przestrzeni, którą czytnik potrafi otworzyć: sRGB dla ekranów, CMYK dla druku i Rec.2100 PQ dla HDR. [Colour in the engine](/info/colour-engine.html) wyjaśnia jak. Dokument Design ustawiony na **Wide colour / HDR** podlega własnym zasadom, opisanym w [Wide colour and HDR editing](/info/hdr-editing.html).

### Profile kolorów

Eksporty są oznaczane profilem kolorów, aby aplikacje z zarządzaniem kolorem, takie jak drukarnie, Photoshop i przeglądarki, czytały kolory tak, jak je widziałeś. Dzieje się to automatycznie; miniatury i podglądy pomijają znacznik, by pozostać małe.

- **PNG i JPG** niosą osadzony profil ICC **sRGB**, przestrzeń, w której rysowany jest podgląd. Piksele są oznaczone, a nie ponownie kodowane.
- **Print PDF (CMYK)** deklaruje swoje warunki druku w *OutputIntent*, mówiąc drukarni, jak mają być czytane jego farby CMYK.
- **Print TIFF (CMYK)** zapisuje nieoznaczone piksele DeviceCMYK i zapisuje warunki druku w metadanych TIFF. TIFF nie może osadzić profilu druku, więc wiersz **Embed** zapisuje tylko nazwę tego profilu.
- **TIFF (RGB)** to nieskompresowany siostrzany sRGB do archiwum lub edytora w obie strony. Spłaszcza przezroczystość na biel. Oba TIFF są tylko na komputer, ponieważ przeglądarki nie potrafią podglądać TIFF.
- **SVG**, **EMF**, **EPS** i **DXF** to wektory bez osadzonego profilu: kolory SVG to sRGB, EMF i EPS używają device RGB, **EPS (CMYK)** zapisuje DeviceCMYK, a DXF używa AutoCAD Color Index. SVG, EPS i DXF obrysowują tekst do ścieżek. EMF zachowuje tekst żywy i edytowalny w Office i Prezentacjach Google, wracając do konturów tylko dla fragmentów, których format nie potrafi wyrazić; opcja **Outline fonts** w panelu eksportu wymusza ścieżki wszędzie. SVG odtwarza też cienie pól CSS, wewnętrzne i zewnętrzne.

::: details PDF/X-4 i własny profil druku
Lolly nie dostarcza żadnego profilu CMYK. Nazwane warunki druku zapisują zamierzenie wyjściowe bez deklarowania zgodności z PDF/X-4, ponieważ PDF/X-4 wymaga osadzonego profilu.

Wczytaj własny profil CMYK i wybierz jego wiersz **Embed** w kontrolce Colour profile. Jest osadzany jako *DestOutputProfile* pliku, a PDF deklaruje PDF/X-4, gdy tylko reszta pliku na to pozwala. Warunki druku, które deklaruje, są odczytywane z tego profilu: zarejestrowana nazwa tam, gdzie profil ją potwierdza, albo `Custom` pod własną nazwą profilu.

Trzy rzeczy wstrzymują deklarację, zachowując zamierzenie wyjściowe: grafika RGB, której przebieg CMYK nie mógł skonwertować, tekst kredytu marginesu proof `prov` (rysowany standardową czcionką, która nie jest osadzona) oraz hasło **Strong**, ponieważ PDF/X-4 zabrania szyfrowania. Każdy PDF niesie też metadane PDF/X-4: ramki stron, XMP, identyfikator dokumentu i zamierzenie wyjściowe sRGB z jego profilem.
:::

### HDR (jasne kolory)

To karta **HDR** panelu eksportu, która rozjaśnia zwykłą grafikę dla ekranów HDR. Zachowanie oryginałów HDR podczas edycji to inna funkcja: [Wide colour and HDR editing](/info/hdr-editing.html).

Zwykły eksport to sRGB: nasycony kolor marki jest tak jasny jak normalna biel ekranu. Wyświetlacz HDR ma zapas powyżej tego. Karta **HDR** podbija kolory marki i biały tekst w stronę szczytowej jasności, podczas gdy ciemne obszary pozostają ciemne i dają blaskowi kontrast.

![Włączona karta HDR w panelu eksportu, z odsłoniętymi pod nią pokrętłami White / Reach / Dark lift / Focus](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formaty.** PNG, JPG, AVIF i TIFF. WebP jest 8-bitowy i nie ma działającej ścieżki dekodowania HDR, a wektory i PDF nie mają modelu HDR.
- **Domyślnie wyłączone**, ponieważ zmienia piksele. Zaznacz kartę albo podaj `hdr=1` w linku udostępniania.
- **Pokrętła.** **White** (sufit szczytowej jasności, od 400 do 2000 nitów), **Reach** (jak głęboko w tony rozlewa się blask), **Dark lift** (jak bardzo rozjaśniają się ciemne; `0` zachowuje je ciemnymi) i **Focus** (ile bogactwa kolorów zachowuje podbicie). Podróżują jako jedna wartość: `hdr=1600-60-0-50` to White 1600, Reach 60, Dark lift 0 i Focus 50.
- **Co jest zapisywane.** PNG dostaje 16-bitowy Rec.2100 PQ z chunkiem `cICP`. JPG to JPEG z mapą wzmocnienia ISO 21496-1: zwykły obraz SDR plus dołączona mapa wzmocnienia. AVIF dostaje przepisane pudełko `colr`. TIFF dostaje piksele PQ z wygenerowanym profilem ICC v4 niosącym znacznik `cicp` i spłaszcza się na czerń, ponieważ biel to kod 10 000 nitów w PQ i okrążyłaby każdą krawędź aureolą. Podbicie podąża za percepcyjną jasnością (OKLab) i zachowuje odcień, więc zieleń marki staje się jaśniejsza, a nie miętowa.
- **Gdzie widać blask.** Przeglądarki zarządzające kolorem na wyświetlaczu HDR: Preview, Quick Look i Safari na urządzeniach Apple albo Chrome na monitorze HDR. Ekran SDR pokazuje normalny obraz.
- **Zanim wyślesz.** Wiele platform ponownie koduje wgrane pliki i usuwa sygnał HDR, co może zostawić obraz ciemny lub wyblakły. Używaj HDR tam, gdzie kontrolujesz miejsce docelowe, takie jak własna witryna, ściana wideo lub prezentacja na jasnym panelu.
- **Z terminala.** `--hdr=1` z `--export=png` lub `--export=jpg` zapisuje ten sam PNG i JPEG z mapą wzmocnienia w [CLI](/info/cli.html), z tych samych koderów silnika, bez przeglądarki po drodze. AVIF i TIFF pozostają na razie eksportami webowymi.

## Co podróżuje z Twoim plikiem

Gotowy plik może nieść kilka zapisów obok obrazu. Niektóre jadą obok pikseli i znikają przy ponownym zapisie lub usunięciu; dwa znaki żyją w samych pikselach.

::: figure exporting-what-travels
Gdzie żyje każdy zapis, czy jest domyślnie włączony i który parametr linku go kontroluje.
:::

Panel eksportu zwija **Licence**, **Source credits**, *Password protect*, **C2PA Credentials**, **Lolly Imprint** i **Durable credential** w jedną grupę **Content protection**, która pokazuje tylko karty, których może użyć wybrany format. Otwiera się sama, gdy link lub dokument już deklaruje licencję albo gdy źródło wymaga od Ciebie decyzji. Karta **Design system** zostaje poza grupą, widoczna przy każdym eksporcie.

![Otwarta grupa Content protection przy eksporcie PNG, pokazująca tylko pasujące do niego karty](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Proweniencja i znak wodny

Tam, gdzie format ma pola, eksporty niosą **metadane proweniencji**: oprogramowanie, źródło, nazwę narzędzia i linię podpisu z Twojego profilu, zapisane w PNG iTXt, JPEG EXIF, informacjach PDF, `<metadata>` SVG lub komentarzu GIF. Zapisuje tylko autorstwo i nic nie jest wysyłane. Narzędzia **Experimental** stemplują też widoczny znak wodny, nakładany przez hosta, aby edycja narzędzia nie mogła go usunąć.

**Lolly Imprint** to niewidoczny znak wodny w pikselach, **domyślnie włączony**. Poświadczenie i metadane podróżują obok pikseli i giną przy ponownym zapisie, zrzucie ekranu lub usunięciu metadanych. Imprint żyje w pikselach i przetrwa ponowną kompresję, więc kopię nadal można rozpoznać jako wykonaną w Lolly. To wskazówka, a nie kryptograficzna gwarancja, i nie niesie danych osobowych. Jedzie w JPEG XL, PNG, JPG, WebP, AVIF, TIFF i BMP oraz w rastrach, które Lolly renderuje do PDF lub PPTX, nigdy w obrazie, który osadziłeś. Odznacz **Lolly Imprint** albo podaj `imprint=0`, aby pominąć Imprint. Przetrwanie AVIF po ponownym kodowaniu nie jest jeszcze skalibrowane. [Verify](/verify) wykrywa go na Twoim urządzeniu; zobacz [The Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**Durable credential** zapisuje identyfikator Lolly w pikselach za pomocą modelu neuronowego na urządzeniu w formacie TrustMark, aby link "made with Lolly" przetrwał usunięcie metadanych i ponowne kodowanie i mógł być odczytany przez narzędzia obsługujące TrustMark. Jest **domyślnie wyłączone**, ponieważ kosztuje przebieg neuronowy na eksport i jednorazowe pobranie modelu. Obejmuje PNG, JPG, WebP, AVIF i TIFF; zaznacz w panelu albo podaj `durable=1`. Aplikacje komputerowe i mobilne ukrywają kartę, ponieważ nie mają źródła, z którego mogłyby pobrać model offline.

**Licence.** Wybierz, jak inni mogą używać Twojej pracy: *None (all rights reserved)* domyślnie, CC0 1.0, Public Domain Mark 1.0 lub licencja Creative Commons 4.0 (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). Nazwa licencji i link do jej deed trafiają do metadanych licencji pliku (EXIF, XMP i RIFF tam, gdzie format je ma) i jego Content Credential. Wybór jest zapisywany z dokumentem i podróżuje w linku jako `licence=`. Lolly zapisuje wybraną licencję; nie sprawdza ani nie egzekwuje warunków. Narzędzie z własnym polem licencji, takie jak Claim, zachowuje zamiast tego to pole.

### Zapis systemu projektowego

Eksport zapisuje system projektowy, który wykonał plik: jego nazwę, opublikowaną wersję, z której rysowano (gdy nie jest to wersja robocza), i [colourway](/info/colourways.html), w którym rysowano. Każdy inny wybór motywu deklarowany przez system projektowy, taki jak gęstość, jest zapisywany tak samo. Wybór jasny lub ciemny jest pomijany, ponieważ obraz już pokazuje, który użyto.

**Zapis widzisz, zanim cokolwiek zostanie napisane.** Karta **Design system**, domyślnie zaznaczona, pokazuje dokładne słowa, które plik niesie, takie jak *Records: Acme · Colourway: Beach*, i opis tak, jak zabrzmi. Nazwa systemu projektowego to to, co wpisali jego właściciele, więc karta pokazuje ją tak, jak zapisano. Odznacz kartę, aby pominąć zapis w tym eksporcie. Panel dokumentu Design wymienia te same słowa pod *Embedded in exports*.

**Opis podaje colourway obok narzędzia.** Przy zaznaczonej karcie *"Made with https://lolly.tools : Chart"* staje się *"Made with https://lolly.tools : Chart (Beach colourway)"*. Nazwa samego systemu projektowego zostaje w zapisie, a nie w opisie. Opis bez nazwy narzędzia albo taki, który narzędzie pisze z własnych danych wejściowych, pozostaje bez zmian. Narzędzie, które ignoruje colourway przez `tokenAxes`, żadnego nie zapisuje, a kredyt proof PDF (znak druku `prov`) podlega tej samej regule.

**Umiejętności marki, które prowadziły agenta.** Gdy agent wykonał pracę i wskazał [umiejętności marki](/info/brand-skills.html), które przeczytał i według których postępował, zapis wymienia też każdą umiejętność z jej rewizją, na przykład *Guided by: acme-brand 1.0*. Te słowa oznaczają, że umiejętność prowadziła pracę. Nie są kontrolą: Lolly nie testuje pracy względem umiejętności. Listę dodaje tylko własne oświadczenie agenta, co dziś oznacza argument `brandSkills` w `lolly_render` [serwera MCP](/info/mcp.html), więc praca wykonana w aplikacji lub z linku udostępniania żadnej nie niesie. Content Credential przechowuje listę jako `brandSkills`, jedną wartość JSON z id, nazwą, rewizją i skrótem SHA-256 każdej umiejętności. Pakiet XMP i metadane SVG przechowują tę samą wartość jako `lolly:BrandSkills`, PDF zapisany z zapisu zyskuje jedno słowo kluczowe na umiejętność, a opis pozostaje bez zmian. Umiejętność wewnętrzna jest zapisywana przez id, nazwę, rewizję i skrót, nigdy przez jej tekst. Te same przełączniki pomijają listę razem z resztą zapisu: karta **Design system**, `_madewith=0`, `--no-madewith` i `madeWith: false`. Gdy serwer MCP rysuje plik w przeglądarce (PDF, JPEG i inne formaty, których jego ścieżka bez przeglądarki nie potrafi zapisać), własne metadane pliku nie zawierają listy i tylko Content Credential może ją zawierać. Podaj `c2pa`, aby zachować zapis; bez poświadczenia render ostrzega, że umiejętności marki nie zostały zapisane.

**Odczytanie zapisu.** [Verify](/verify) wymienia zapis jako **Design system** w szczegółach poświadczenia pliku, a wszelkie umiejętności marki jako **Guided by**. *Recreate with these settings* otwiera ponownie narzędzie w zapisanej wersji i colourway. Link otwiera się z zapisanym systemem projektowym, gdy to urządzenie ma system o tym samym id i nazwie; w przeciwnym razie otwiera się z Twoim aktywnym systemem projektowym.

::: details Co jest zapisywane gdzie i które przebiegi pomijają zapis
| Gdzie | Co jest zapisywane |
|---|---|
| Content Credential | `designSystem` (id), `designSystemLabel`, `designVersion` i `themes` w asercji `tools.lolly.export`, każde jako zwykła wartość tekstowa; `themes` to lista JSON wyborów |
| PNG, JPEG, WebP i JXL | Te same cztery wartości jako właściwości `lolly:` pakietu XMP pliku, w przestrzeni nazw `https://lolly.tools/ns/export/1.0/` |
| SVG | Te same właściwości `lolly:` wewnątrz bloku `<metadata>` |
| PDF | Słowa kluczowe takie jak *Design system: Acme* i *Colourway: Beach* |
| Każdy format z polem opisu | Opis, z colourway obok narzędzia |

Karta pojawia się tylko wtedy, gdy jest co zapisać i format może zawierać zapis. CSV, JSON, plik kalendarza i inne formaty tekstowe lub danych nie zawierają metadanych, a EPS, EMF, DXF i BMP nie mają pola na zapis. HTML, Markdown i CSS zawierają zapis tylko w swoim Content Credential, więc dla nich karta nie pokazuje linii opisu i ukrywa się, gdy **C2PA Credentials** jest wyłączone. Pole, którego system projektowy nie podaje, zostaje poza plikiem.

Link udostępniania wyłącza zapis przez `_madewith=0` ([URL parameters](/info/url-parameters.html)); wiersz poleceń przyjmuje `--no-madewith`, `lolly_render` [serwera MCP](/info/mcp.html) przyjmuje `madeWith: false`, a panel eksportu aplikacji terminalowej ma wiersz **Design system**. Wiersz poleceń drukuje słowa, które niesie gotowy plik, na standardowym wyjściu błędów, dla renderu narzędzia i dla każdego pliku eksportowanego przez `lolly run` z zapisanej sesji Design, a render MCP drukuje je obok pliku, obydwa odczytane z pliku. PNG, który wiersz poleceń rysuje bez przeglądarki, nie niesie metadanych pliku, więc jego zapis podróżuje tylko w poświadczeniu. Utility na urządzeniu nie dodają żadnych metadanych.

Przebiegi bez karty **Design system** pomijają zapis: przebieg Batch, folder wyeksportowany z Projects i eksport kolekcji 3D, a w aplikacji terminalowej partia CSV, eksport folderu lub zaznaczenia Projects i widok render-everything. Wyeksportuj jeden plik z narzędzia, aby zapisać system projektowy.
:::

### Content Credentials (C2PA)

Eksporty mogą nieść **Content Credentials**: podpisany manifest [C2PA](https://c2pa.org), który zapisuje, co, kiedy i gdzie wykonało plik, powiązany z hashem bajtów pliku, tak aby każda późniejsza edycja była wykrywalna. Specyfikację publikuje C2PA, a Lolly zapisuje standardowe manifesty, które może sprawdzić każdy czytnik C2PA.

![Karta C2PA Credentials, zaznaczona, z czasem życia poświadczenia obok pola wyboru](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Domyślnie włączone.** Karta **C2PA Credentials** jest wstępnie zaznaczona dla niemal każdego narzędzia. Odznacz ją dla jednego eksportu lub podaj `c2pa=off` w linku. Narzędzie może zrezygnować w swoim manifeście.
- **Formaty.** PDF (RGB i Print), PNG i APNG, JPG, GIF, SVG, TIFF (RGB i Print), WebP (nieruchomy i animowany), AVIF, MP4, WebM, kontenery audio MP3, WAV, M4A, OGG/Opus i FLAC oraz HTML, Markdown i CSS. ZIP stempluje każdy obsługiwany element, i tak Animated SVG go dostaje. MP4, AVIF i M4A używają standardowego wiązania BMFF, a MP3 jego mapowania ID3v2, więc `c2patool` i inne czytniki je weryfikują. WebM i OGG/Opus nie mają jeszcze standardowego mapowania, więc Lolly niesie manifest jako załącznik Matroska i pole OpusTags, które sprawdza własny weryfikator Lolly. ICO, EPS, EMF, DXF, BMP, PPTX, formaty Office i inne formaty tekstowe i danych nie mają kontenera C2PA.
- **Co zapisuje.** Narzędzie i aplikację, które wykonały plik, czas podpisania, powłokę, która eksportowała, [system projektowy i colourway](#the-design-system-record), gdy karta **Design system** jest zaznaczona, oraz odciski aktywnych danych wejściowych. Tekst wejściowy, pola powiązane z profilem, nieaktywne kontrolki, wersje przeglądarki i szczegóły systemu operacyjnego są pomijane. Twoje imię i nazwisko oraz e-mail pojawiają się jako autor tylko wtedy, gdy **Use my details to create** jest włączone w Settings → Preferences → Your details. Źródła umieszczane przez eksport podróżują jako składniki: [wymienione dzieła](#source-credits), takie jak emoji, i [piosenki Rondocode](/info/rondocode.html#songs-in-the-credential) w eksporcie wideo lub audio.
- **Co widzą odbiorcy.** Narzędzia C2PA, takie jak aplikacje Adobe, `c2patool` i contentcredentials.org/verify, czytają manifest i pokazują deklarację. Lolly podpisuje kluczem wykonanym na Twoim urządzeniu, a nie certyfikatem z listy zaufanych, więc przeglądarki zgłaszają poświadczenie jako *unverified*: struktura i dowód manipulacji są prawdziwe, ale za podpisującego nikt nie ręczy. Aby to zmienić, zarejestruj **verified identity** w Settings → Preferences → Content Credentials; zobacz [Content Credentials Identity](/info/content-credentials-identity.html).
- **Sprawdzanie pliku.** Upuść dowolny plik na [Verify](/verify) lub uruchom `lolly validate <file>`, aby uzyskać raport na urządzeniu, który zaczyna się od tego, czy plik wykonało Lolly i czy zmienił się od tego czasu. Verify patrzy też poza poświadczenie; zobacz [What Verify checks](/info/what-verify-checks.html).
- **Prywatność.** Klucz podpisujący powstaje na czas eksportu i nigdy nie opuszcza Twojego urządzenia, a deklaracja zawiera tylko to, co niosą już metadane proweniencji. Utility prywatności, które przekształcają Twoje własne pliki, nie dodają poświadczenia, a *Strip Hidden Data* usuwa manifest C2PA jak każde inne metadane. Utility Rondocode tworzy nowe audio, więc podpisuje to, co zapisuje ([Rondocode songs](/info/rondocode.html#files-from-the-rondocode-utility)).
- **Interakcje.** PDF chroniony hasłem nie może nieść Content Credentials, na żadnym poziomie. Poświadczenie jest dodawane na końcu, na gotowych bajtach, po DPI, EXIF, profilu kolorów, metadanych PDF/X i znakach druku.

### Source credits

Eksport, który umieszcza cudzą pracę, zapisuje to źródło w poświadczeniu. Emoji narysowane z wybranego zestawu emoji to zwykły przypadek: dzieło, jego twórca, licencja, skąd pochodzą dokładne bajty i co zmieniono, wszystko podróżuje z plikiem. Tekst w narzędziu, którego szablon jest SVG, zachowuje emoji systemu, więc nic tam nie jest przypisywane. Wiersz **Source credits** mówi, czego źródła oczekują od dostarczenia, zanim pobierzesz, a po pobraniu odczytuje dostarczone bajty, zanim powie, że uznania autorstwa są w pliku. Licencja, która prosi o wybór, taka jak przekolorowany glif CC BY-SA, który zamierzasz udostępnić, dostaje kartę z opcjami; pobieranie nigdy nie jest blokowane. [Creative rights and credits](/info/creative-rights.html) zawiera sformułowania, sprawdzone licencje i to, co zostaje Twoje.

## Ochrona hasłem

Dwa rodzaje blokady, oba wykonane na Twoim urządzeniu. Karta *Password protect* panelu eksportu steruje obydwoma.

![Rozwinięta karta Password protect przy eksporcie PDF, z polem hasła i dwoma poziomami blokady](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**Hasło otwarcia PDF** ma dwa poziomy po wpisaniu hasła:

- **Weak**: 40-bitowy RC4, odstraszacz, a nie ochrona. Jego hasło może podróżować w linku udostępniania, jawnym tekstem. Tylko RGB `pdf`.
- **Strong**: AES-256 (PDF 2.0). Wpisywane przy eksporcie i nigdy nie umieszczane w linku. Dotyczy też Print PDF i każdego PDF w ZIP partii. Zablokowany Strong Print PDF zachowuje CMYK, znaki i zamierzenie wyjściowe, ale traci deklarację PDF/X-4.

**Zablokowany ZIP** obejmuje eksport ZIP, pobranie folderu z Projects lub partii, z jednym hasłem na dwóch poziomach: **Weak** (ZipCrypto, odstraszacz; może podróżować w linku `?password=`) lub **Strong** (AES-256, wpisywane przy eksporcie, nigdy w linku). Hasło chroni każdy element, a każdy PDF w środku jest też zablokowany AES-256 samodzielnie, więc pozostaje zablokowany po rozpakowaniu ZIP. Monit pojawia się, gdy zaczyna się pobieranie; puste hasło oznacza brak blokady.

**Link udostępniania chroniony hasłem** prosi odbiorcę o hasło przed otwarciem. Cały stan linku jest szyfrowany AES-256 kluczem wyprowadzonym z hasła (PBKDF2), więc podróżuje tylko szyfrogram, a odszyfrowanie dzieje się w przeglądarce odbiorcy. Serwer obsługujący link nigdy nie widzi hasła ani projektu. Włącz w oknie **Share**. Zaszyfrowany link otwiera się tylko w Lolly, nigdy jako osadzony obraz. Zobacz [URL Mode](/info/url-mode.html).

## Na telefonie

Kontrolki eksportu leżą za pływającym przyciskiem **Export**, który otwiera arkusz **Export**: te same formaty, rozmiar, kopiowanie, pobieranie i udostępnianie, w rozmiarze dla dotyku.

## Identyfikatory formatów dla linków i CLI

To wartości parametru URL `format=` i flagi CLI `--export=` (zobacz [URL parameters](/info/url-parameters.html) i [CLI](/info/cli.html)). Menu narzędzia pokazuje tylko formaty, które to narzędzie potrafi wykonać, więc jest zawsze krótsze niż ta lista.

| Rodzaj | Identyfikatory |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Wektor | `svg` · `svgz` (SVG po gzip) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (plik do cięcia) |
| Strona i dokument | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (plik projektu Penpot) · `scorm` (pakiet kursu, ZIP) |
| Ruch | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| Audio | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` |
| Tekst i dane | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `css` · `scss` · `gpl` (paleta GIMP) |
| Paczki i pakiety | `zip` · `rpm` i `tar.gz` (render zapieczętowany w pakiecie Linux) |

Kilka identyfikatorów pochodzi z własnego kodu eksportu narzędzia: `ase` (Adobe Swatch Exchange, z Palette Lab) oraz `exr` i `hdr` (rastry o wysokim zakresie dynamicznym, z Darkroom). **Convert Font** zapisuje `ttf`, `otf` i `woff` z dostarczonego pliku czcionki, więc goły link nie ma czego dla niego renderować.
