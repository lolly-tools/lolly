# Design: swobodna kanwa

Design to narzędzie do układów, których nie obejmuje żaden szablon: plakat od zera, zestaw slajdów, utwór ruchomy ze ścieżką dźwiękową. Zamiast formularza z kontrolkami dostajesz kanwę boksów, które przeciągasz, skalujesz, obracasz i w które wpisujesz tekst. Eksportuje przez tę samą ścieżkę renderowania co każde inne narzędzie, więc to, co widzisz na kanwie, jest plikiem, który dostajesz.

Ta strona prowadzi przez kanwę od pierwszego boksu do gotowej prezentacji: okno, kształtowanie boksów, rysowanie własnych kształtów, umieszczanie scen 3D i innych narzędzi, dodawanie czasu, sprawdzanie wyniku i prezentowanie gotowej prezentacji. [Using Lolly](/info/using.html) opisuje to, co Design dzieli z każdym narzędziem, takie jak zapisywanie i udostępnianie.

![Wolne płótno Design - artboard wraz z otaczającym go stołem roboczym](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

## Okno Design

**Górny pasek** zaczyna się od **Home**, **File menu** i nazwy dokumentu (kliknij nazwę, aby zmienić nazwę dokumentu). Środek zawiera **Undo**, **Redo**, **History**, kontrolki powiększenia (z **Fit all** i **Fit artboard**) oraz przełączniki **Timeline**, **Navigator** i **Inspector**. Po prawej są **Share**, **Present** i **Export**. Na telefonie rzadziej używane przyciski przechodzą do **More actions**.

**Szyna narzędzi** z boku zawiera menu Lolly i narzędzia do rysowania: **Pointer**, **Add a box**, **Pen**, **Edit points**, **Line**, a potem przyciski Timeline, Artboards i Auto-arrange.

![Listwa narzędzi wolnej kanwy: uchwyt do przeciągania, menu Lolly, dalej Pointer, Add a box, Pen, Edit points, Line, Timeline, Artboards i Auto-arrange](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

Kanwa działa jak stół projektanta wokół obszaru roboczego:

- **Odkładaj boksy poza obszar roboczy.** Przeciągnij boks za krawędź ramki, a pozostanie widoczny i zaznaczalny. Wszystko poza ramką jest wyblakłe, a ramka zachowuje cień, aby zaznaczyć, gdzie zaczyna się plik.
- **Eksportuje się tylko obszar roboczy.** Wszystko poza ramką lub część boksu wystająca poza krawędź jest odcinana z wyniku, zarówno w formatach rastrowych, jak i wektorowych.
- **Oddal poza Fit**, aby zobaczyć wszystko, co odłożyłeś.
- **Zmień rozmiar obszaru roboczego** przez zmianę rozmiaru eksportu. Boksy zachowują swoje pozycje, więc możesz przeramować układ wokół istniejącej zawartości.

![Scena edycji: obszar roboczy na pierwszym planie, szyna narzędzi po lewej i HUD powiększenia w rogu](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&chrome=1&dark=1&filename=seq-studio-stage)

### Navigator i Inspector

**Navigator** wymienia każdy obszar roboczy (z nagłówkiem **Artboards** lub **Slides** w prezentacji) jako zwijaną grupę jego **Layers**. Zaznacz nazwę obszaru roboczego, aby tam przeskoczyć, rozwiń go, aby zaznaczać lub zmieniać kolejność warstw, i używaj klawiszy strzałek do poruszania się po liście; Left wraca do nagłówka obszaru roboczego. **Pages** grupuje obszary robocze w nazwane strony, a wybór strony zmienia tylko to, które obszary robocze pokazuje edytor.

**Inspector** stawia na pierwszym miejscu kontrolki tekstu lub obrazu zaznaczonego obiektu. Znaczniki opcji obejmują szybkie wybory, a **Advanced** zawiera szczegóły stylizacji. Na telefonie Inspector otwiera się jako arkusz z **More actions**; Escape lub Back zamyka arkusz i zachowuje zaznaczenie.

![Sekcja Document w Inspectorze: karty Selection i Canvas, potem Dimensions i Style & look](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

## Zmiana rozmiaru, skalowanie i obracanie

Zaznacz obiekt, a potem przeciągnij uchwyt, aby zmienić jego rozmiar, lub przeciągnij okrągły uchwyt pod zaznaczeniem, aby obrócić obiekt. Przeciągnięcie rozmiaru działa w jednym z dwóch trybów:

- **Resize**, domyślny, zmienia tylko box. Tekst zawija się do nowego rozmiaru, a rozmiar czcionki, grubość obrysu, promień rogu i efekty pozostają bez zmian.
- **Scale** powiększa lub zmniejsza cały obiekt z jego zawartością: rozmiar czcionki, obrys, promień rogu, cień, rozmycie, wypełnienie i odstępy zmieniają się o tyle samo.

Naciśnij `K`, aby włączyć lub wyłączyć Scale. Bez klawiatury wybierz **Scale mode** w menu Lolly albo naciśnij i przytrzymaj przycisk **Pointer** na szynie (lub kliknij go prawym przyciskiem) i wybierz **Scale**; na ekranie dotykowym pasek obiektu też ma przełącznik Scale. Gdy Scale jest włączone, przycisk Pointer pokazuje ikonę Scale, a każdy uchwyt ma kropkę pośrodku. `V` lub **Escape** wraca do Resize i zachowuje zaznaczenie. Każdy dokument otwiera się z wyłączonym Scale, więc nikt nie skaluje obrysów przez przypadek.

**Skalowanie liczbą.** Przy włączonym Scale lub przy zaznaczeniu kilku obiektów kliknij odczyt na pasku obiektu, aby otworzyć okienko **Scale**. Wpisz procent, szerokość lub wysokość, wybierz punkt, który ma pozostać nieruchomy, na siatce 3 x 3 i wybierz **Apply**. Każde skalowanie to jeden krok cofania.

**Kilka obiektów.** Zaznaczenie kilku obiektów ma uchwyty na krawędziach i w narożnikach. Dopóki każdy obiekt jest pionowy lub obrócony o pełne ćwierć obroty, a zaznaczenie nie zawiera grupy ani koła, przeciągnięcie narożnika zmienia szerokość i wysokość swobodnie. W przeciwnym razie zaznaczenie zachowuje proporcje, a odczyt dodaje **Proportional**. Podczas przeciągania mała etykieta pokazuje rozmiar lub procent w trybie Scale.

**Odwracanie zaznaczenia.** Kliknij prawym przyciskiem i wybierz **Flip horizontal** lub **Flip vertical**, albo naciśnij `Shift+H` lub `Shift+V` (Shift, ponieważ samo `V` to Pointer). Odbicie jest prawdziwą transformacją, więc wyeksportowane SVG, PDF i PNG zachowują odwrócenie.

**Klawisze trzymane podczas przeciągania** działają w chwili ich naciśnięcia lub puszczenia; arkusz skrótów (`?`) też je wymienia.

| Przytrzymaj | Zmiana rozmiaru lub skalowanie | Obracanie | Przesuwanie |
|---|---|---|---|
| **Shift** | Zachowuje proporcje (Scale zawsze to robi) | Obraca co 15 stopni | Bez zmian |
| **Alt** (Option) | Działa od środka | Obraca swobodnie | Wyłącza przyciąganie i siatkę |
| **Cmd/Ctrl** | Wyłącza przyciąganie i siatkę | Obraca swobodnie | Wyłącza przyciąganie i siatkę |

Gdy nie trzymasz żadnego klawisza, obrót jest przyciągany do najbliższych 15 stopni, gdy zbliży się do nich na 4 stopnie. Obszary robocze się nie obracają, więc nie mają uchwytu obrotu.

::: details Uchwyty, strefy chwytania i dotyk
**Chwytaj w dowolnym miejscu krawędzi.** Każdy bok zaznaczenia jest paskiem zmiany rozmiaru na całej długości, a przy myszy lub piórku tuż za każdym rogiem jest strefa obrotu. Wskaźnik pokazuje, co zrobi przeciągnięcie. Naciśnięcie w pasku lub strefie staje się zmianą rozmiaru lub obrotem dopiero po rozpoczęciu przeciągania, więc zwykłe kliknięcie nadal zaznacza jak wcześniej. Zablokowany obiekt nie ma uchwytów, pasków ani stref.

**Małe obiekty pozostają przesuwalne.** Na obiekcie szerokim na 25 pikseli ekranu lub mniej środkowe uchwyty znikają, a pozostałe odsuwają się trochę od obrysu, więc naciśnięcie obiektu przesuwa obiekt. Przy 10 pikselach lub mniej znikają też uchwyty narożne, a cienka linia zachowuje uchwyt na każdym końcu. Naciśnięcie tuż obok cienkiej linii lub maleńkiego obiektu, z dala od uchwytów, przesuwa obiekt.

**Duże obszary chwytania.** Na ekranie dotykowym każda strefa narożna to jedna czwarta szerokości i wysokości zaznaczenia na ekranie, między 24 a 44 pikselami, a każda strefa boku obejmuje odcinek między dwoma narożnikami. Gdy zaznaczenie jest na to zbyt małe, strefy przesuwają się na zewnątrz obrysu. Strefa pod wskaźnikiem lub palcem jest zacieniona. Aby uzyskać te same strefy przy myszy lub piórku, włącz **Large grab areas** w menu Lolly; ustawienie zostaje na tym urządzeniu.

**Dwa palce na zaznaczeniu.** Na ekranie dotykowym połóż dwa palce na zaznaczonym obiekcie: szczypnij, aby skalować, skręć, aby obrócić, lub przesuń oba palce, aby przenieść zaznaczenie, wszystko jako jeden krok cofania. Przy włączonym Scale szczypnięcie skaluje też zawartość; przy wyłączonym zmienia rozmiar proporcjonalnie. Skręt przyciąga do najbliższych 15 stopni, gdy jest blisko, a ruch dwoma palcami nigdy nie przyciąga. Pierwszy palec musi wylądować na zaznaczeniu, a drugi musi szybko dołączyć, na zaznaczeniu lub tuż za jego krawędzią. Dwa palce w innym miejscu powiększają i przesuwają widok, tak samo jak dwa palce na zaznaczeniu, które zawiera obszar roboczy lub zablokowany obiekt, obejmuje większość widoku albo wykracza poza jego krawędź.
:::

## Rysuj własne kształty

Boksy, koła i zaokrąglone ramki pokrywają większość układów. Dla każdego innego kształtu narysuj go: przycisk **Pen** na szynie (lub `P`) wprowadza w tryb rysowania. Trzy pojedyncze klawisze przełączają tryby: `V` dla Pointer, `P` dla Pen i `N` dla **Edit points**. Pointer jest zawsze drogą wyjścia.

- **Kliknij**, aby umieścić punkt. Przy domyślnym typie krzywej **kliknij i przeciągnij**, aby wyciągnąć uchwyty punktu i uzyskać krzywą; przytrzymaj **Alt** podczas klikania, aby uzyskać ostry róg. (W innych typach krzywych każdy punkt jest rogiem, a przeciągnięcie nic nie robi.)
- Punkty przyciągają się do obszaru roboczego i Twoich innych boksów podczas umieszczania. Alt wyłącza siatkę podczas rysowania, a przy późniejszym przeciąganiu punktu wyłącza zarówno siatkę, jak i krawędzie.
- **Kliknij pierwszy punkt**, aby zamknąć kształt. W przeciwnym razie naciśnij **Enter**, kliknij dwukrotnie lub zmień narzędzie, a rysunek zostanie zachowany.
- **Escape** działa krok po kroku: pierwsze naciśnięcie porzuca rysunek, drugie opuszcza pióro.
- **Delete** podczas rysowania usuwa ostatni punkt.

Wynik jest zwykłym boksem. Przesuwaj, zmieniaj rozmiar, obracaj, grupuj, wyrównuj, zmieniaj kolejność, wypełniaj, cieniuj lub wyblaszczaj ścieżkę jak każdy inny box. Pierwsza ścieżka dostaje wypełnienie i obrys, które Twoja marka nadaje ścieżce, a każda następna dostaje to, czego ostatnio użyłeś. W narzędziu, w którym marka nie ustawia niczego dla ścieżek, nowa ścieżka jest obrysowana kolorem, którym rysowałeś, więc kształt nigdy nie jest niewidoczny.

**Edytuj punkty ponownie.** Kliknij kształt dwukrotnie lub użyj **Edit points** na pasku obiektu. Przeciągnij punkt, aby go przesunąć, przeciągnij uchwyt, aby zmienić kierunek krzywej, kliknij na krzywej, aby wstawić punkt, lub przeciągnij ramkę wokół kilku punktów i naciśnij Delete. Ścieżka zawsze zachowuje co najmniej dwa punkty.

**Spline type** decyduje, jaki rodzaj krzywej przechodzi przez Twoje punkty:

| Typ | Co robi |
|---|---|
| **Smooth (auto)** | Domyślny. Sam wylicza długości uchwytów, więc zwykłe kliknięcia dają gładką krzywą. Ustawiony uchwyt przypina kierunek, a długością nadal zarządza krzywa. |
| **Bezier handles** | Klasyczne pióro: kontrolujesz każdy uchwyt, a wstawienie punktu nigdy nie przesuwa krzywej. |
| **Through the points** | Przechodzi dokładnie przez każdy punkt, bez uchwytów. |
| **B-spline** | Płynie blisko punktów, a nie przez nie, dla łagodniejszej linii. |
| **Straight lines** | Linia łamana. |

Przełączenie istniejącej ścieżki na typ, który sam wylicza uchwyty, najpierw pyta, ponieważ ustawionych długości uchwytów nie da się odzyskać; przełączenie na **Bezier handles** jest zawsze bezstratne. W trakcie rysowania przełączenie działa od razu, a wszystkie wyciągnięte uchwyty są porzucane.

Każdy punkt niesie też regułę ciągłości, pokazaną jego kształtem: kwadrat dla **Corner** (uchwyty poruszają się niezależnie), koło dla **Smooth** (uchwyty pozostają w jednej linii) i koło z pierścieniem dla **Symmetric** (w jednej linii i równej długości). Ustaw regułę dla zaznaczonych punktów, a krzywa od razu za nią podąża.

![Dwie ścieżki pióra wyrenderowane wprost z linku: obrysowana krzywa S i zamknięta wypełniona plama](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

Narysowana ścieżka podróżuje w linku udostępniania jak każdy inny box i renderuje się tak samo z wiersza poleceń.

## Łączenie kształtów

Zaznacz dwa lub więcej kształtów, kliknij prawym przyciskiem kanwę (stuknięcie dwoma palcami na dotyku) i wybierz:

- **Union** scala je w jeden kształt z wypełnieniem najwyższego.
- **Subtract** odcina wszystko powyżej od dolnego kształtu.
- **Intersect** zachowuje tylko część wspólną.
- **Exclude** zachowuje wszystko poza częścią wspólną.

Trzy kolejne działają na pojedynczym kształcie. **Outline stroke…** zamienia obrys w wypełniony kontur o tej samej grubości. **Offset path…** powiększa kontur na zewnątrz lub, z liczbą ujemną, zmniejsza go do wewnątrz. **Simplify** przebudowuje ścieżkę z mniejszą liczbą segmentów przy tym samym konturze.

![Półksiężyc i pierścień z prawdziwym otworem, oba utworzone przez Subtract](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D%26w%3D1080%26h%3D1080&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&filename=path-ops-boolean-result)

Wynik to nowa ścieżka, którą możesz dalej edytować piórem, zapisana jako zwykłe krzywe Beziera, więc pierwotny typ splajnu się nie przenosi. Otwory są prawdziwymi otworami: kontrolka **Fill rule** w panelu obrysu decyduje, czy nakładające się kontury wypełniają (*non-zero*), czy przebijają (*even-odd*). Operacje odmawiają zamiast niszczyć: poproś o przecięcie dwóch kształtów, które się nie nakładają, a nic się nie zmieni. Boksy tekstu i obrazu nie mają konturu, więc są pomijane.

## Sceny 3D i narzędzia wewnątrz projektu

Box może zawierać więcej niż obraz. Oba poniższe rodzaje zachowują przepis, a nie wyrenderowany obraz, więc rysują się na nowo w dowolnym rozmiarze i momencie, o który prosi dokument, a aktualizacja źródła dociera do każdego projektu, który z niego korzysta.

### Sceny 3D

Wybierz **3D scene** z menu dodawania na szynie i przeciągnij ramkę: 3D Studio otwiera się na nowym boksie, a to, co tam ustawisz, wraca na kanwę. Potem **Edit in 3D Studio** w sekcji **3D scene** Inspectora ponownie otwiera studio. [Place a scene in Design](/info/3d-studio.html#place-a-scene-in-design) opisuje plakaty, oś czasu, eksport i udostępnianie.

### Narzędzia wewnątrz projektu

Wybierz **Image** z menu dodawania na szynie, przeciągnij ramkę i wybierz narzędzie na karcie **Tools** selektora. Narzędzie wypełnia ramkę swoimi domyślnymi wartościami, a Inspector otwiera się na sekcji **Tool** z kontrolkami tego narzędzia. Zmień pole, a box aktualizuje się chwilę później, jako jeden krok cofania. **Image fit** i **Image position** działają jak dla każdego obrazu, a **Replace with another tool or image** podmienia zawartość boksu.

**Narzędzia w ruchu** odtwarzają się wewnątrz boksu: zapętlona ilustracja nadal się zapętla na kanwie, podąża za głowicą odtwarzania, gdy oś czasu jest otwarta, i eksportuje się klatka po klatce do GIF, MP4 lub WebM. Gdy narzędzie podaje, jak długo trwa jedna pętla, box dostaje klip dokładnie tej długości, więc wideo zawiera całe pętle. Klip, któremu zmieniłeś czas, zachowuje Twoje ustawienie, a wyłączenie ruchu narzędzia zamienia box z powrotem w nieruchomy obraz.

## Oś czasu (Sekwencja)

**Sequence** to oś czasu Design: dodaje czas do kanwy. Każdy box może zaczynać się w danej chwili, trwać przez pewną długość i animować się na wejściu i wyjściu, a oś czasu zadokowana pod obszarem roboczym to miejsce, w którym je układasz. Zacznij od szablonu **Video** w Design, a krótka sekwencja jest już gotowa: dwie czasowe karty tekstowe w rzędzie sekwencji i proceduralne tło muzyczne pod nimi, więc możesz zobaczyć, jak działa oś czasu, zanim cokolwiek zmienisz.

![Oś czasu Sekwencji: pasek transportu, linijka, ścieżka nakładki, magnetyczny rząd sekwencji z klipami i znacznikami złączeń oraz pasek Always on](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

Są dwa rodzaje rzędów:

- **Rząd sekwencji** jest magnetyczny. Klipy leżą jeden za drugim, przeciągnięcie jednego zmienia kolejność ciągu, a usunięcie zamyka lukę. To jest kręgosłup.
- **Ścieżki nakładek** są swobodne. Dolna trzecia, logo lub napis unosi się nad kręgosłupem we własnym czasie, każdy na swojej ścieżce.
- Pod nimi **Always on** zawiera boksy bez czasu, obecne przez cały czas. Znak `+` na znaczniku przenosi jeden na ścieżkę; **Make always on** odsyła go z powrotem.

Otwarcie osi czasu daje jej klawiaturę, więc Space i klawisze strzałek sterują głowicą odtwarzania. Kompozycja, która ma już czasy, otwiera oś czasu sama.

**Edycja.** Przeciągnij środek klipu, aby go przesunąć, przeciągnij blisko któregoś końca, aby go przyciąć, i naciśnij **Split at playhead** (lub `S`), aby przeciąć go na dwie części. Split wymaga klipu z prawdziwą **Length** i głowicy odtwarzania trochę wewnątrz niego, więc klip bez końca, taki jak tło muzyczne, nie może być dzielony. **Snap to edges** jest domyślnie włączone i przyciąga do krawędzi klipów, głowicy i pełnych sekund; przytrzymaj Alt, aby przeciągać bez przyciągania. Każde przeciągnięcie to jeden krok cofania, a podgląd podczas przeciągania używa tej samej arytmetyki co wynik.

Zaznacz klip, a inspektor daje te same edycje jako liczby: **Length**, **Trim in** (jak daleko w źródle zaczyna się klip), **Speed** od ×0.25 do ×4, **Animate in** i **Animate out** z ich długościami oraz **Mute clip**. Klip w rzędzie magnetycznym nie ma pola **Start**, ponieważ kolejnością zarządza rząd.

**Przejścia** to ustawienia wstępne: Fade, Pop, Grow, Rise, Drop, cztery Slides, Zoom in i out, Tilt, Swoop, Spin, Drift lub **Cut (no animation)**. Odległości skalują się z obiektem, więc jedno ustawienie wygląda dobrze zarówno na karcie pełnoekranowej, jak i na małej odznace. Między dwoma klipami w rzędzie sekwencji **seam chip** wybiera **Cut** lub **Crossfade**; otwórz go ponownie, aby ustawić **Length (ms)**, i naciśnij **Done**. W crossfade pierwszy klip gra dalej za cięciem i zanika, gdy następny się pojawia, tak samo w podglądzie i w pliku.

**Dźwięk.** Klip **Audio** żyje na osi czasu jak każdy inny klip, z falą, przycinaniem i wyciszaniem. Wygenerowane tło muzyczne szablonu Video jest syntezowane w momencie eksportu, więc jego pasek pozostaje prosty i cichy do czasu renderowania. Naciśnij mikrofon, aby **nagrać lektora** prosto na oś czasu, z odliczaniem i miernikiem poziomu; ujęcie jest zapisywane jako Twój własny zasób przy głowicy. Przycisk kamery obok mikrofonu **nagrywa wideo** w ten sam sposób, kadrowane do obszaru roboczego w trakcie nagrywania, aby współpracownik mógł dodać klip z udostępnionego linku. Zaznacz dowolny klip z dźwiękiem, a jego pasek otworzy się pod osią czasu z głośnością, panoramą, EQ, wysokością tonu, normalizacją i efektami takimi jak **Voice cleanup**; [Sound](/info/sequence-editor.html#sound) w przewodniku edytora sekwencji opisuje ten pasek. **Audio track** w panelu eksportu jest oddzielne: jedno tło pod całym klipem, z wyciszaniem i ducking.

![Oś czasu z zaznaczonym klipem muzycznym: jego pasek biegnie wzdłuż dołu z Prędkością, Zanikaniem, Głośnością, Przesunięciem, EQ, Wysokością dźwięku, Normalizacją głośności i gniazdem Efekt](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fbx%3Dt1%252Ctext%252C200%252C140%252C1500%252C220%252C0%252Crect%252C16%252C%252C100%252C%252Ccontain%252Cnormal%252CVoiceover%252520session%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252Cseq%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1%252C%252Cfalse%252C%252C60%252C%252C%252C1%257Ea1%252Caudio%252C200%252C500%252C400%252C80%252C0%252Crect%252C16%252C%252C100%252Clolly%25252Floops%25252F3-am-echoes%252Ccontain%252Cnormal%252C%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252C%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1.3%252C%252Cfalse%252C%252C60%252C%252C%252C1%26_sel%3Da1&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px%21important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip&drive=click%3Abutton%3Ahas-text%28%22Inspector%22%29)

**Renderowanie.** Eksport ruchu rysuje, dekoduje i koduje każdą klatkę w dokładnie określonym czasie, więc plik nie zależy od tego, czy Twoja maszyna nadąża, a MP4 i WebM nie mają praktycznego limitu klatek. Długość osi czasu ustala czas trwania, chyba że wpiszesz własny, a Content Credentials są stemplowane jak w każdym innym eksporcie. Eksport nieruchomy daje klatkę przy głowicy lub arkusz kontaktowy z pola **Frames**; zobacz [Stills from a timed composition](/info/exporting.html#stills-from-a-timed-composition). Sekwencja jest ograniczona do jednej godziny. GIF i animowany PNG trzymają każdą klatkę w pamięci, więc nadają się do krótkich klipów. **Record live** jest tu ukryte, ponieważ renderowanie klatka po klatce to lepsza droga.

**Klatki kluczowe, głębia i kamera.** Przejście animuje klip, gdy przychodzi i odchodzi. Aby ustawić pozę boksu wewnątrz klipu (dryf, zanikanie, rozmycie, uniesienie go znad strony i opuszczenie z powrotem), zaznacz klip i naciśnij **+Keyframe**: romb w narzędziach osi czasu, romb na pasku obiektu kanwy lub **Shift+K** przy fokusie na osi czasu. Pozycja głowicy decyduje, którą pozę zapisze następna edycja. Te same klatki kluczowe dają skomponowanej kompozycji kamerę, która najeżdża, panoramuje i przeciąga ostrość. [Animating](/info/animating.html) to pełny przewodnik, a [The sequence editor](/info/sequence-editor.html) opisuje zaznaczanie, onion skin, dzielenie, przycinanie i znaczniki.

## Przed eksportem

Design sprawdza dokument, zanim wyślesz plik. Karta **Before you export** w sekcji **Document** Inspectora i ponownie w panelu eksportu czyta zapisaną strukturę warstw, a potem patrzy na ustabilizowaną kanwę pod kątem przyciętego tekstu i kontrastu płaskich kolorów. Pyta ten sam rejestr czcionek, którego używa konturowanie SVG i PDF, czy każdy fragment tekstu ma bajty czcionki, które można osadzić. Tła obrazowe i gradientowe są wymieniane jako kontrole wizualne, a nie dostają zmyślonej oceny kontrastu.

### Sprawdź kompozycję względem systemu projektowego

Karta w panelu eksportu porównuje też kompozycję z Twoim systemem projektowym, w tej samej wersji systemu projektowego, której używa renderowanie. Patrzy na zapisane kolory, aliasy tokenów, wybory czcionek i identyfikatory zasobów obrazów. Wartość niestandardowa może być zamierzona, a obraz spoza zadeklarowanych zasobów marki to punkt do przeglądu, a nie zakazany obraz.

Tam, gdzie istnieje konkretna sugestia koloru lub czcionki, jej przycisk zmienia tę jedną warstwę, a **Undo** przywraca oryginał. Zablokowane lub zmienione od tego czasu warstwy nigdy nie są nadpisywane starą sugestią. Gradienty, efekty, zagnieżdżona zawartość narzędzi, prawa i subiektywna jakość są poza tym porównaniem, a żadna kontrola nie blokuje Download.

### Reguły organizacji i sygnał pisania

Karta w panelu eksportu sprawdza też reguły organizacji, które niesie Twój system projektowy, takie jak grubość i wyrównanie tekstu, zatwierdzone zestawienia kolorów lub logo na powierzchnię, warstwa po warstwie. Każde ustalenie jest ostrzeżeniem z nazwą warstwy nad regułą. Reguła, dla której ta kompilacja nie ma sprawdzacza, jest wymieniana jako niesprawdzona, nigdy jako spełniona. [Usage & rules](/info/brand-studio.html#usage-rules) wymienia reguły, a `lolly check` stosuje te same do zapisanego dokumentu.

Ta sama karta pokazuje sygnał pisania dla tekstu rysowanego przez dokument: jego pasmo (none, weak, notable lub strong), potem własne zdanie Verify z wynikiem w skali do 100 i do trzema oznaczonymi frazami, każda z warstwą, która ją zawiera. **Open the text in Verify** zabiera ten tekst do [Verify](/#/verify) na pełny odczyt; [AI evidence in Verify](/info/verify-ai-evidence.html) wyjaśnia, co waży wynik. Wynik jest sygnałem, a nie wyrokiem: liczy wzorce częste w tekstach generowanych i nie potrafi powiedzieć, kto napisał słowa. Ukryte warstwy są pomijane w obu kontrolach, a karta podaje ile.

Ustalenia dotyczące reguł organizacji i silny sygnał pisania liczą się do sumy "to fix" na karcie, aby łatwo je znaleźć. Informują i nigdy nie blokują: Download pozostaje dostępny i nie ma niczego do odrzucenia ani zapisania jako wyjątek. Agent pracujący w otwartym dokumencie dostaje ten sam raport przez swoje narzędzia witryny ([Agents in an open document](/info/open-document-agents.html)).

Kontrole druku (spad, rozdzielczość, pokrycie farbą i liczba płyt) dołączają do tej samej karty po włączeniu **Settings → Feature flags → Print preflight**. W innych narzędziach ta flaga w ogóle pokazuje kartę; [Export a file](/info/exporting.html) opisuje kontrole druku.

## Prezentowanie

Dokument Design złożony z obszarów roboczych jest już prezentacją. Naciśnij **Present** w górnym pasku, a każdy obszar roboczy staje się pełnoekranowym slajdem, w kolejności, w jakiej leżą na kanwie. Przycisk brzmi **Preview**, dopóki **Design outcome** dokumentu nie jest ustawione na **Slides**. Prezentacja działa na kopii wyrenderowanych obszarów roboczych, więc wyjście zwraca Cię dokładnie tam, gdzie byłeś.

Strzałka obok **Present** otwiera **Present from this slide**, **Speaker view**, **Present with camera**, **Narrate**, **Auto-advance slides**, **Loop the deck (kiosk)** i **Export slides as video**.

| Klawisz | Co robi |
|---|---|
| **Space**, `→`, **Page Down** | Następny krok lub slajd (albo kliknij pasek przy prawej krawędzi) |
| `←`, **Page Up** | Wstecz (albo kliknij pasek przy lewej krawędzi) |
| **Home**, **End** | Pierwszy lub ostatni slajd |
| `O` | Przegląd: każdy obszar roboczy w układzie Twojej kanwy; kliknij jeden, aby go otworzyć |
| `S` | Widok prelegenta: bieżący slajd, następny slajd, notatki i zegar w drugim oknie |
| `B` | Czarny ekran; dowolny klawisz przywraca slajd |
| `F` | Powrót do pełnego ekranu |
| `K` | Wstrzymaj lub uruchom ponownie prezentację kiosku |
| **Escape** | Zdejmuje jedną warstwę: przegląd do prezentacji, prezentacja do edytora |

Mały pasek sterowania pojawia się, gdy ruszasz wskaźnikiem, i znika, gdy przestajesz. Jeśli przeglądarka blokuje okno widoku prelegenta, widok prelegenta otwiera się jako panel nad prezentacją. Notatki należą do każdego obszaru roboczego i nigdy nie pojawiają się na slajdzie.

- **Kroki odsłaniania.** Kliknij box prawym przyciskiem i wybierz **Reveal at step 1**, **2** lub **3** zamiast **Always visible**, a box czeka, aż przejdziesz do jego kroku. Boksy z tym samym numerem pojawiają się razem.
- **Kiosk.** Nadaj obszarowi roboczemu **Length**, a prezentacja zatrzymuje się tam na ten czas, po czym przechodzi dalej za cienkim paskiem postępu. Dodaj `kiosk` do linku, a prezentacja zapętla się na końcu, dla oznakowania cyfrowego.
- **Stosy podslajdów.** Kliknij obszar roboczy prawym przyciskiem i wybierz **Stack under the previous slide**, aby uczynić go krokiem tego slajdu. Przegląd pokazuje jedną kartę, a wiersz **Stack** w inspektorze mówi, do którego slajdu należy obszar roboczy.
- **Morph.** Gdy kolejne slajdy mają box o tej samej nazwie **Morph match** (na przykład `hero`), przejście przesuwa, skaluje i przekolorowuje ten box zamiast ciąć. Przejście **Morph** dla całej prezentacji robi to samo dla każdej dopasowanej pary.
- **Narracja.** **Speaker notes** każdego obszaru roboczego mogą być czytane na głos. W sekcji **Document** Inspectora wybierz **Voice**, opcjonalnie drugi głos do **Blend with**, **Speed** oraz **Lead-in** i **Tail** w milisekundach; **Show captions when presenting** pokazuje słowa w miarę ich wypowiadania. Głos działa na Twoim urządzeniu, a te same notatki stają się ścieżką dźwiękową eksportu wideo, dźwiękiem slajdów w eksporcie PowerPoint i narrowanym filmem w [pakiecie SCORM](/info/create/exporting.html#scorm-course-packages).

Prezentacja też jest linkiem. `?present` otwiera od razu w niej, a `s=` wybiera slajd (pozycję, identyfikator obszaru roboczego lub `id.step` dla kroku budowania), a adres podąża za Tobą, więc to, co wysyłasz, to slajd, na którym jesteś. [Reserved URL parameters](/info/url-parameters.html#what-happens-on-open) je dokumentuje.

**Present with camera** umieszcza Twoją kamerę, logo i podpis z imieniem nad slajdami, z prywatnymi kontrolkami i zapisanymi scenami; zobacz [Presenting with camera](/info/presenting.html). Box **Web page** może przejąć pilota podczas wystąpienia, gdy włączysz **Make interactive** w jego inspektorze: w kroku **Focus on click** Up i Down sterują stroną, a Next kontynuuje prezentację. [Live pages that take the clicker](/info/interactive-pages.html) opisuje style fokusu, punkty zatrzymania przewijania i zatwierdzanie witryn.

## Dokąd dalej

- **[Text in Design](/info/text-composition.html)**: edycja tekstu na kanwie, płynące artykuły przez ramki i typografia.
- **[Animating](/info/animating.html)**: klatki kluczowe, głębia, kamera sceny i warstwy Lift.
- **[Import a design](/info/design-import.html)**: otwórz plik z Figmy, Penpot, Illustratora lub InDesign jako edytowalne boksy.
- **[Share a design with rules](/info/create-a-tool.html)**: zamień dokument Design w narzędzie tylko z wybranymi danymi wejściowymi.
- **[Export a file](/info/exporting.html)**: formaty, rozmiary, jednostki druku i wideo.
