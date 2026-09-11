# Korzystanie z Lolly

Praktyczny przewodnik po *korzystaniu* z aplikacji - otwieraniu narzędzia, pracy na kanwie, eksporcie, zapisie i udostępnianiu. Wszystko tutaj działa **na twoim urządzeniu**: bez konta, bez wysyłania plików, bez internetu po pierwszym załadowaniu.

> Dopiero zaczynasz? [Szybki start](/info/quickstart.html) pozwoli ci tworzyć w kilka minut, a [Lolly dla operatorów](/info/operators.html) opisuje instalację i wdrożenie aplikacji; ta strona jest o tym, jak ją obsługiwać, gdy już działa.

## Otwieranie narzędzia

Ekran startowy to **galeria** - wszystkie narzędzia pogrupowane według kategorii. Kliknij kartę, aby otworzyć narzędzie; jeśli już wcześniej nad nim pracowałeś, przycisk **Continue** wznawia twoją ostatnią sesję. Użyj pola wyszukiwania, aby filtrować po nazwie - albo skorzystaj z [wyszukiwarki](/info/search.html) na pasku u dołu sześciu ekranów list (galeria, Utilities, Projects, Catalogue, Dashboard i Profile), która sięga do twoich zapisanych prac, katalogu i ustawień, nie tylko do narzędzi. Wewnątrz narzędzia pasek ustępuje miejsca własnym elementom narzędzia.

![Galeria narzędzi - każde narzędzie jako karta, pogrupowane według kategorii](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&filename=gallery&try=1)

Każde narzędzie to widok dzielony: **kontrolki** po jednej stronie, żywy **podgląd** (kanwa) po drugiej. Zmień dowolną kontrolkę, a podgląd zaktualizuje się natychmiast.

![Widok podzielony narzędzia - stos elementów sterujących po lewej i rysowany na żywo wykres słupkowy grupowany po prawej](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

> Kilka narzędzi (jak **Design**) otwiera się zamiast tego jako **wolna kanwa** - powierzchnia bez zbędnej obudowy, na której przeciągasz, skalujesz, obracasz i przyciągasz do siebie pola tekstu, kształty i obrazy, a dwuklik pozwala edytować tekst na miejscu. Eksportuje się tą samą ścieżką renderowania co każde inne narzędzie, więc kanwa *jest* plikiem. Zobacz [Wolna kanwa](#the-free-canvas-design) poniżej.

Dwa sposoby, by ułożyć samą siatkę tak, jak chcesz:

- <!--i:star--> **Oznacz gwiazdką to, czego używasz.** ★ przy karcie daje jej własny duży kafelek w pasku nad siatką - zobacz [Twoje ulubione](/info/favourites.html).
- <!--i:eyeoff--> **Ukryj narzędzie, z którego nigdy nie korzystasz.** Kliknij kartę prawym przyciskiem (albo zaznacz kilka i użyj paska zaznaczenia) → **Hide tool**. Znika z siatki i z tego, co znajduje pisanie w siatce; szary kafelek **Show hidden tools (N)** na samym końcu pokazuje je ponownie, przygaszone, każde z **Unhide tool** we własnym menu. Ukrywanie dotyczy tylko twojej siatki - narzędzie nadal otwiera się z zapisanego linku lub zakładki i dla wszystkich innych zostaje dokładnie tam, gdzie było.

![Koniec siatki Tools z odkrytymi ukrytymi narzędziami: przygaszona karta QR Code Generator, a obok niej szary kafelek, który przywrócił ją do widoku, teraz z napisem Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-bulk%3D%22hide%22%5D%3Bwait%3A300%3Bclick%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed it. The alt says so rather than quoting the resting
label the prose above already gives.
There is no standalone per-card "hide" button
(unlike the always-visible fav/pin corner icons) - Hide only exists inside a
tile's right-click menu or the bulk bar, both confirmed in views/gallery.ts.
The recipe goes the bulk-bar route since it needs no `|right` context-menu
step: tick the card (`[data-select="qr-code"]`, the same checkbox hook the
selection bullet under Projects uses), click the bar's Hide button
(`[data-bulk="hide"]` - the literal `data-bulk` value bulkBarHtml() writes,
confirmed in lib/bulk-bar.ts), then click the grey reveal tile
(`.gtile--hiddenbox`, confirmed in gallery.ts).
-->

### Ask Lolly

Kiedy wolisz zapytać, niż szukać, **Ask Lolly** (`#/ask`) przyjmuje wpisane pytanie i zwraca pasujący fragment tej dokumentacji **dosłownie** - własnymi słowami przewodników, nie jako streszczenie ani wygenerowany tekst - z podaniem strony, z której pochodzi, i linkiem **Open in docs** obok. Pod odpowiedzią leżą miejsca w aplikacji pasujące do tego samego pytania: narzędzie, ustawienie, zapisany projekt - każde jako przycisk, który po prostu tam przenosi.

Zapis rozmowy to pamięć sesji: zadaj pytanie uzupełniające, a wątek narasta w miarę pracy, ale po przeładowaniu zaczyna się od nowa. Wyniki wyszukiwania mają na dole wiersz **Ask Lolly: *twoje zapytanie*** - pod konkretnymi trafieniami z pozostałych grup - który przekazuje pytanie dalej, więc możesz zacząć na pasku, a skończyć tutaj.

## Kanwa (podgląd)

Podgląd zawsze pokazuje dokładnie to, co zostanie wyeksportowane.

**Komputer**

- **Powiększenie:** Cmd/Ctrl-scroll albo szczypnięcie na gładziku - zoom centruje się na wskaźniku.
- **Przesuwanie:** przytrzymaj **spację** i przeciągnij albo przeciągnij **środkowym przyciskiem myszy**. (Zwykłe kliknięcia pozostają wolne do klikania w elementy projektu.)
- **Klawiatura:** `0` = dopasuj do okna · `1` = 100% · `+` / `−` = powiększenie.
- **Zoom HUD:** mała kontrolka `−  NN%  +  Fit` w rogu. Kliknij procent, aby przełączać Fit ↔ 100%.

![Zoom HUD w rogu kanwy - minus, aktualny procent, plus, Fit, a dalej przełączniki motywu i dźwięku](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

**Dotyk**

- **Szczypnij**, aby powiększyć, **przeciągnij**, aby przesunąć, **stuknij dwukrotnie**, aby wrócić do dopasowania.

**Kliknij, by przejść do kontrolki:** kliknij dowolny element projektu, a odpowiadające mu pole na pasku bocznym dostanie fokus i przewinie się do widoku - w powtarzalnej grupie wierszy rozwinie dokładnie ten wiersz, który kliknąłeś, więc edycja tego, co widzisz, jest o jedno stuknięcie.

Zmiana wymiarów zawsze przywraca widok do czystego dopasowania.

### Wolna kanwa (Design)

Narzędzia z wolną kanwą dodają powierzchnię roboczą *wokół* obszaru roboczego, jak stół montażowy projektanta:

- **Odkładanie poza kanwę.** Przeciągnij pole za krawędź ramki, a pozostanie w pełni **widoczne i zaznaczalne** - odłóż elementy na bok, kiedy układasz kompozycję, i wciągnij je z powrotem. Wszystko poza ramką jest **delikatnie przygaszone**, więc obszar eksportu widać od razu, a ramka zachowuje cień, który znaczy dokładnie, gdzie zaczyna się plik.
- **Eksportuje się tylko ramka.** Wyeksportowany plik jest ograniczony obszarem roboczym - wszystko, co zostało poza nim (albo część pola wystająca za krawędź), zostaje po prostu przycięte, tak samo w formatach rastrowych jak i wektorowych.
- **Oddal poniżej Fit** (aż do 20%), aby zobaczyć cały stół montażowy, gdy odłożyłeś rzeczy daleko poza ramkę.
- **Skalowalny obszar roboczy.** Zmiana wymiarów eksportu zmienia rozmiar ramki w miejscu; pola zachowują pozycje, więc możesz przekadrować układ wokół istniejącej treści.

![Wolne płótno Design - artboard wraz z otaczającym go stołem roboczym](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

**Odbij zaznaczenie.** Kliknij prawym przyciskiem dowolny box i wybierz **Flip horizontal** lub **Flip vertical**, by odbić go w miejscu, albo naciśnij `Shift+H` / `Shift+V` na klawiaturze - Shift, ponieważ samo `V` to narzędzie Pointer. Każdy zaznaczony box odbija się względem własnej osi w jednym kroku cofania, a odbicie jest prawdziwą transformacją, więc zachowuje się w wyeksportowanym SVG, PDF i PNG, a nie tylko na płótnie.

### Rysowanie własnych kształtów (pióro)

Prostokąty, koła i zaokrąglone ramki wystarczają do większości układów. Kiedy potrzebujesz kształtu spoza tej listy, narysuj go: przycisk **Pen** na listwie (albo klawisz `P`) włącza tryb rysowania. Trzy pojedyncze klawisze przełączają tryby - **`V`** wraca do wskaźnika, **`P`** włącza pióro, **`N`** narzędzie węzłów (**Edit points**) - a wskaźnik jest zawsze wyjściem z tego, w czym akurat jesteś.

![Listwa narzędzi wolnej kanwy: uchwyt do przeciągania, menu Lolly, dalej Pointer, Add a box, Pen, Edit points, Line, Timeline, Artboards i Auto-arrange](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

- **Kliknij**, aby postawić punkt. Przy domyślnym typie krzywej **kliknięcie z przeciągnięciem** wyciąga uchwyty tego punktu - tak rysuje się krzywą zamiast narożnika - a przytrzymanie **Alt** przy kliknięciu daje ostry narożnik. (Przy pozostałych typach krzywych każdy postawiony punkt jest narożnikiem, a przeciągnięcie nic nie robi; zobacz **Spline type** poniżej.)
- Punkty przyciągają się do obszaru roboczego i do twoich innych pól w trakcie stawiania, rysując te same prowadnice co zwykłe przeciąganie. Alt wyłącza siatkę podczas rysowania, a przy późniejszym przeciąganiu punktu - siatkę i krawędzie.
- **Kliknij pierwszy punkt**, aby zamknąć kontur i zakończyć jednym ruchem. Inaczej naciśnij **Enter**, kliknij dwukrotnie albo po prostu zmień narzędzie - rysunek zostaje zachowany, nie wyrzucony.
- **Escape** działa stopniowo: pierwsze naciśnięcie porzuca rysunek i nic nie zapisuje, drugie wychodzi z pióra.
- **Delete** w trakcie rysowania usuwa ostatnio postawiony punkt.

Wynikiem jest zwykłe pole na kanwie. Przesuwaj je, skaluj, obracaj, grupuj, wyrównuj, zmieniaj kolejność, nadaj mu wypełnienie, gradient, cień albo przezroczystość - ścieżka zachowuje się jak każde inne pole i żadna z tych kontrolek nie traktuje jej inaczej.

Powstaje też od razu pomalowana. Pierwsza narysowana ścieżka dostaje wypełnienie i obrys, jakie twoja marka przewiduje dla ścieżki, a każda kolejna przejmuje **to, czego użyłeś ostatnio** - ustaw wypełnienie raz i rysuj dalej, zamiast przekolorowywać każdy kształt. (W narzędziu, którego marka nic nie mówi o ścieżkach, narysowana ścieżka dostaje obrys w kolorze, w którym widziałeś ją podczas rysowania, więc nigdy nie jest niewidoczna.)

**Ponowna edycja punktów.** Kliknij kształt dwukrotnie (albo użyj **Edit points** na pasku obiektu), a punkty wrócą. Przeciągnij punkt, aby go przesunąć, przeciągnij uchwyt, aby zmienić jego kierunek, kliknij w dowolnym miejscu krzywej, aby wstawić punkt, zaznacz grupę punktów gumką i naciśnij Delete, aby usunąć zaznaczone. Ścieżka zawsze zachowuje co najmniej dwa punkty, więc nie da się jej przypadkiem skasować do zera.

**Spline type** decyduje, jaka krzywa przechodzi przez twoje punkty, i to jest wybór, który warto rozumieć:

| Typ | Co robi |
|---|---|
| **Smooth (auto)** | Domyślny. Sam wylicza długości uchwytów, więc zwykłe klik-klik-klik daje naprawdę gładką krzywą bez mocowania się z uchwytami. Jeśli ustawisz uchwyt, przypina on *kierunek*, a długość pozostaje w gestii krzywej. |
| **Bezier handles** | Klasyczne pióro. Uchwyty są punktami kontrolnymi, a wstawienie punktu nigdy nie rusza krzywej. |
| **Through the points** | Przechodzi dokładnie przez każdy postawiony punkt, bez uchwytów. |
| **B-spline** | Płynie w pobliżu punktów, a nie przez nie, dając miększy kształt. |
| **Straight lines** | Łamana. |

Przełączenie istniejącej ścieżki na typ, który sam wylicza uchwyty, najpierw pyta o zgodę, bo ustawionych przez ciebie długości uchwytów nie da się odzyskać - przełączenie na **Bezier handles** jest zawsze bezstratne. W trakcie rysowania nie ma pytania: zmiana od razu obejmuje szkic, a wyciągnięte już uchwyty przepadają razem z nią. Przy typach, które same zarządzają uchwytami, wstawienie punktu minimalnie zmienia kształt krzywej; przy **Bezier handles** nie.

Każdy punkt ma też regułę ciągłości, widoczną po jego kształcie na kanwie - kwadrat to **Corner** (uchwyty poruszają się niezależnie), koło to **Smooth** (uchwyty zostają w jednej linii), koło z obwódką to **Symmetric** (w jednej linii i równej długości). Ustaw ją dla dowolnych zaznaczonych punktów, a krzywa natychmiast się do niej dostosuje.

![Dwie ścieżki pióra wyrenderowane wprost z linku: obrysowana krzywa S i zamknięta wypełniona plama](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

Narysowana ścieżka podróżuje w linku jak wszystko inne, więc narysowany kształt otworzy się z linku do udostępniania i wyrenderuje identycznie z CLI. Nic w niej nie zależy od edytora.

### Łączenie kształtów (operacje na ścieżkach)

Zaznacz dwa kształty lub więcej, kliknij kanwę **prawym przyciskiem** (na dotyku stuknięcie dwoma palcami), a menu zaproponuje operacje, jakich oczekujesz od programu do rysowania:

- **Union** scala je w jeden kształt, zachowując kolory tego wierzchniego.
- **Subtract** odejmuje wszystko powyżej od kształtu spodniego.
- **Intersect** zostawia tylko część wspólną.
- **Exclude** zostawia wszystko poza częścią wspólną.

Trzy kolejne działają na pojedynczym kształcie: **Outline stroke…** zamienia obrys w wypełniony kształt o tym samym zarysie (przydatne, gdy chcesz zachować grubość dokładnie taką, jak narysowana), **Offset path…** rozszerza sylwetkę na zewnątrz albo, przy liczbie ujemnej, ściąga ją do środka, a **Simplify** odbudowuje ścieżkę z mniejszej liczby segmentów przy tym samym kształcie.

![Półksiężyc i pierścień z prawdziwym otworem, oba powstałe przez Subtract](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=path-ops-boolean-result)

Wynikiem jest nowa ścieżka, którą dalej edytujesz piórem. Otwory są prawdziwymi otworami - kontrolka **Fill rule** w panelu obrysu decyduje, czy nakładające się kontury wypełniają się (*non-zero*), czy przebijają na wylot (*even-odd*).

Dwie rzeczy, których te operacje celowo nie robią. **Odmawiają, zamiast niszczyć**: poproś o część wspólną dwóch kształtów, które się nie nakładają, a dostaniesz informację, że nie ma czego zachować, i nic się nie zmieni. A pola tekstowe i obrazy nie mają zarysu, na którym można pracować, więc zostają nietknięte, zamiast być przybliżane własną ramką. Połączony wynik zapisuje się jako zwykłe krzywe Beziera, tak samo jak w programie do rysowania - pierwotny typ krzywej nie przetrwa operacji.

## Oś czasu (Sequence Studio)

![The timeline with the music clip selected: its strip runs along the bottom with Speed, Fades, Volume, Pan, EQ, Pitch, Normalize volume and the Effect slot](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dvideo%26_sel%3Dbed&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px!important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip)

**Sequence Studio** dodaje wolnej kanwie *czas*. Każde pole może zaczynać się w danym momencie, trwać przez określony czas i animować się na wejściu i wyjściu, a układasz je na osi czasu zadokowanej pod obszarem roboczym. Po otwarciu sekwencja już się odtwarza - plansza tytułowa, klip, plansza końcowa, belka dolna i podkład muzyczny - więc model widać, zanim cokolwiek zmienisz.

![Oś czasu Sequence Studio: pasek transportu, linijka, ścieżka nakładki, magnetyczny rząd sekwencji z klipami i znacznikami złączeń oraz pasek Always on](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

Są dwa rodzaje wierszy i cała idea leży w tej różnicy:

- **Wiersz sekwencji** jest *magnetyczny*. Klipy leżą bez przerw, jeden za drugim, a przeciągnięcie jednego zmienia kolejność, zamiast zostawiać dziurę. Usuń klip, a reszta się zewrze. To twój kręgosłup.
- **Ścieżki nakładek** są swobodne. Belka dolna, logo, napis - wszystko, co unosi się nad kręgosłupem we własnym czasie - dostaje własną ścieżkę i własny start.
- Pod nimi **Always on** zbiera pola bez żadnego czasu: sceneria, która jest po prostu obecna przez cały czas. `+` na znaczniku przenosi jedno z nich na ścieżkę; **Make always on** odsyła je z powrotem.

![Scena edycji: artboard na pierwszym planie i na środku, pasek narzędzi po lewej oraz HUD powiększenia w rogu](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-stage)

Otwarcie osi czasu przekazuje jej klawiaturę, więc spacja i strzałki sterują głowicą, a nie stroną - a ponieważ oś otwiera się sama przy kompozycji, która ma już czasy, dzieje się tak od chwili wczytania Sequence Studio.

> **[Edytor sekwencji](/info/sequence-editor.html)** wchodzi głębiej w cztery rzeczy, które decydują o tym, czy montaż w czasie jest przewidywalny: który klip edytuje kliknięcie na kanwie, przezroczyste duchy sąsiednich klipów, zakres podziału i Join, który cofa cięcie, oraz przycinanie (razem ze skrótami klawiszowymi). Naciśnij `?` przy aktywnej osi czasu, aby zobaczyć ściągę ze skrótami.

**Montaż.** Przeciągnij środek klipu, aby go przesunąć lub zmienić kolejność, przeciągnij w odległości kilku pikseli od któregoś końca, aby go przyciąć, i naciśnij **Split at playhead** (albo `S`), aby przeciąć klip na dwa. Podział wymaga klipu z realną wartością **Length** i głowicy kawałek w jego wnętrzu, więc klipu bez końca (na przykład podkładu muzycznego) nie da się podzielić. **Snap to edges** jest domyślnie włączone i przyciąga do krawędzi klipów, głowicy i pełnych sekund, a Alt to wyłącza. Każde przeciągnięcie to jeden krok cofania, a podgląd przeciągania liczy dokładnie to samo co zatwierdzenie, więc to, co widzisz w trakcie, jest tym, co dostajesz.

Zaznacz klip, a inspektor da ci te same zmiany w postaci liczb: **Length**, **Trim in** (jak głęboko w materiale źródłowym się zaczyna), **Speed** jako zestaw stałych mnożników od ×0.25 do ×4, **Animate in** / **Animate out** wraz z ich długościami oraz **Mute clip**. Klip w wierszu magnetycznym celowo nie ma pola **Start** - to wiersz decyduje o kolejności, więc przesuwasz go przeciąganiem.

**Przejścia** to gotowe ustawienia, nie klatki kluczowe: Fade, Pop, Grow, Rise, Drop, cztery warianty Slide, Zoom in i out, Tilt, Swoop, Spin, Drift albo **Cut (no animation)**. Odległości skalują się z obiektem, więc to samo ustawienie działa tak samo dobrze na pełnoekranowej planszy i na małej plakietce. Między dwoma sąsiednimi klipami w wierszu sekwencji jest **znacznik styku**: kliknij go i wybierz **Cut** albo **Crossfade** - zmiana działa od razu i znacznik się zamyka. Otwórz go ponownie, aby zmienić **Length (ms)**, i naciśnij **Done**. Przenikanie zapisuje się jako wyjście jednego klipu i wejście następnego, a eksport wyprowadza z tej pary faktyczne przenikanie - dlatego w podglądzie wygląda ono jak dwa zanikania, a w pliku jak prawdziwe przekazanie.

**Dźwięk.** Dodaj klip **Audio**, a znajdzie się na osi czasu jak każdy inny klip: przebieg fali, przycinanie, wyciszenie. (Wyjątkiem jest generowany podkład, z którym przychodzi domyślna sesja - powstaje dopiero przy eksporcie, więc jego pasek pozostaje pusty i cichy aż do renderu.) Naciśnij mikrofon, aby **nagrać lektora** wprost na oś czasu, z odliczaniem i miernikiem poziomu; nagranie zapisuje się jako twój własny zasób w miejscu, w którym zacząłeś. Naciśnij obok niego kamerę, aby w ten sam sposób **nagrać wideo**: ujęcie jest przycinane do rozmiaru eksportu obszaru roboczego w trakcie nagrywania, więc mały podgląd własny pokazuje dokładnie to, co trafia do sekwencji przy głowicy, pełną klatką - w ten sposób zbierasz klip współpracownika z udostępnionego linku. Muzyka, dialogi i własna ścieżka dźwiękowa klipu trafiają do wyeksportowanego miksu. (**Audio track** w panelu eksportu to co innego: jeden podkład położony pod całym materiałem, z zanikaniem i ściszaniem. Oba działają obok siebie.)

**Render.** Eksport ruchu to **deterministyczna kompozycja**, nie nagranie ekranu - każda klatka jest dekodowana, rysowana i kodowana w dokładnym czasie, więc plik nie zależy od tego, czy twój komputer nadąża, i nie ma praktycznego limitu klatek w MP4 ani WebM. Czas trwania wynika z długości samej osi czasu, chyba że wpiszesz własny. Content Credentials są stemplowane tak samo jak przy każdym innym eksporcie. Eksport nieruchomy daje ci klatkę spod głowicy albo całą stykówkę z pola **Frames** obok rozmiaru wyjściowego - zobacz [Eksport](/info/exporting.html#stills-from-a-timed-composition).

Kilka ograniczeń, o których warto pamiętać: sekwencja jest ograniczona do godziny, GIF i animowany PNG buforują klatki, więc pozostają krótkie, dźwięk milczy w klipie o prędkości innej niż ×1 (nie ma jeszcze rozciągania w czasie), a **Record live** jest tu ukryte, bo kompozytor to lepsza droga.

**Poza gotowymi ustawieniami: klatki kluczowe, głębia i kamera.** Przejście animuje klip w chwili, gdy się pojawia i znika. Aby ustawić pozę elementu *wewnątrz* klipu - przesunąć go, rozjaśnić, rozmyć, unieść nad stronę i osadzić z powrotem - dodaj klatki kluczowe: zaznacz klip, naciśnij **+Keyframe** (romb w klastrze narzędzi na osi czasu, romb na pasku obiektu na płótnie lub `K`), a pozycja wskaźnika odtwarzania decyduje o tym, jaką pozę zapisze Twoja następna edycja. Ten sam system klatek kluczowych daje każdej kompozycji czasowej **kamerę**, która najeżdża, panoramuje i zmienia ostrość, zamieniając jeden płaski SVG w stos warstw, między którymi możesz przelatywać. **[Animacja](/info/animating.html)** to pełny przewodnik.

Narzędzie Design ma tę samą oś czasu, więc możesz nadać układowi czas bez przechodzenia do innego narzędzia - i ono też eksportuje ruch.

## Prezentowanie

![The inspector's Document section: Voice, Blend with, Speed, Lead-in, Tail and Show captions when presenting](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

Dokument Design złożony z **obszarów roboczych** jest już prezentacją. Otwórz **menu Lolly** na listwie narzędzi i wybierz **Present** - ostatni wiersz - a każdy obszar roboczy stanie się slajdem na pełnym ekranie, w kolejności, w jakiej obszary leżą na kanwie. Prezentacja działa na kopii wyrenderowanych obszarów, więc edytor pod spodem pozostaje nietknięty, a wyjście przywraca cię dokładnie tam, gdzie byłeś.

- **Przejdź dalej** za pomocą **Space**, `→`, **Page Down** lub kliknięcia paska przy prawej krawędzi ekranu; wróć za pomocą `←`, **Page Up** lub paska przy lewej krawędzi. **Home** i **End** przenoszą do pierwszego i ostatniego slajdu. Mały pasek elementów sterujących pojawia się za każdym razem, gdy poruszysz kursorem, i chowa się z powrotem, gdy przestaniesz.
- **Przegląd** (`O` lub przycisk siatki) rozkłada od razu wszystkie artboardy w układzie, jaki nadałeś im na płótnie; kliknij jeden, by go otworzyć.
- **Kroki odsłaniania.** Kliknij pole prawym przyciskiem myszy i wybierz **Reveal at step 1**, **2** lub **3** zamiast domyślnego **Always visible**. To pole czeka wtedy, aż przejdziesz do jego kroku, więc slajd może pojawiać się w częściach; pola dzielące ten sam numer pojawiają się razem.
- **Widok prelegenta** (`S`) otwiera drugie okno z bieżącym slajdem, tym, który jest następny, twoimi notatkami do tego slajdu i działającym zegarem. Jeśli przeglądarka zablokuje wyskakujące okno, funkcja spada do panelu nad prezentacją. Notatki są ustawiane per artboard i nigdy nie pojawiają się na samym slajdzie.
- `B` utrzymuje czarny ekran (dowolny klawisz przywraca slajd), `F` wraca do trybu pełnoekranowego, a **Escape** zdejmuje jedną warstwę na raz: przegląd wraca do prezentacji, prezentacja wraca do edytora.
- **Kiosk.** Nadaj artboardowi wartość **Length**, a prezentacja zatrzyma się na nim na tyle czasu, po czym sama przejdzie dalej za cienkim paskiem postępu; `K` (lub przycisk pauzy, który pojawia się dopiero, gdy coś ma ustawioną długość) zatrzymuje to i wznawia. Dodaj `kiosk` do linku, a prezentacja zapętli się na końcu, co czyni z niej ekran w trybie kiosku (signage).

Prezentacja jest też linkiem. `?present` otwiera ją od razu, `s=` wskazuje slajd - pozycję, identyfikator obszaru roboczego albo `id.step` dla kroku odsłaniania - a adres aktualizuje się przy każdym przejściu, więc wysyłasz dokładnie ten slajd, na którym jesteś. Autorzy narzędzi: te parametry są opisane na stronie [URL Mode](/info/url-mode.html#reserved-parameters).

## Na telefonie

Na wąskich ekranach układ przechodzi w jedną kolumnę:

- **Kontrolki stają się arkuszem** u góry, z **uchwytem** przy dolnej krawędzi. Przeciągnij uchwyt, aby zmienić rozmiar - arkusz przyciąga się do **peek / half / full** - albo **stuknij** uchwyt, aby przełączać zwinięty ↔ rozwinięty. Podgląd wypełnia miejsce poniżej i pozostaje widoczny podczas edycji.
- Pływający przycisk **Export** otwiera arkusz eksportu - wszystkie kontrolki formatu, rozmiaru, kopiowania, zapisu i pobierania w jednym miejscu. Zamkniesz go, stukając w tło.

![Narzędzie na ekranie o szerokości telefonu - kontrolki jako arkusz u góry, wygenerowana paleta wypełniająca podgląd poniżej i pigułka renderu unosząca się na dole pośrodku](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Kontrolki (pola)

Narzędzia udostępniają tylko te pola, które mają się zmieniać - cała reszta (kolory, układ, typografia, logika) jest zablokowana przez autora narzędzia, więc cokolwiek zrobisz, spełnia ustalone przez niego zasady. Pola to między innymi tekst, suwaki, próbniki kolorów, listy rozwijane, daty, wybór obrazów i powtarzalne grupy wierszy. Część z nich jest zebrana w zwijanych sekcjach.

![Stos kontrolek narzędzia - pole tekstowe, przyciski kolorów i suwak, i nic poza tym, co autor postanowił zablokować](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Reset:** *Clear changes* przywraca wszystkim polom wartości domyślne.

### Cofanie i ponawianie

**Cmd/Ctrl-Z** cofa, a **Cmd/Ctrl-Shift-Z** (albo **Cmd/Ctrl-Y**) idzie z powrotem do przodu. Ta sama para siedzi jako przyciski **Undo** i **Redo** w rzędzie nad kontrolkami - na wolnej kanwie są zamiast tego na listwie narzędzi - i każdy z nich szarzeje, kiedy nie ma już czego cofać. Każdy krok mówi, czym był: cofnij kolor, a krótki komunikat nazwie pole, które właśnie przywrócił, z przyciskiem **Redo** w środku na drogę powrotną.

- **Przeciągnięcie to jeden krok.** Powtarzane zmiany tej samej kontrolki w ciągu pół sekundy łączą się w jedną, więc przeciągnięcie suwaka przez cały zakres to jedno cofnięcie, a nie dwieście.
- **Zachowywanych jest ostatnie 100 kroków** - starsze wypadają z końca. Nowa zmiana po cofnięciu czyści stos zmian do przodu, tak jak wszędzie indziej.
- **Kiedy kursor stoi w polu tekstowym**, Cmd/Ctrl-Z należy do samego pola, znak po znaku. Lolly przejmuje sterowanie przy kontrolkach, które nie mają własnego sensownego cofania: suwakach, listach rozwijanych, kolorach i przełącznikach.
- **Wybranie pliku** w polu **file** nie jest krokiem - te bajty są trzymane tylko na czas sesji, więc nie byłoby czego przywracać.

W trakcie [współpracy](/info/collaborate.html) na żywo historia pozostaje wyłącznie Twoja. Zmiana napływająca z innego urządzenia nigdy nie trafia na Twój stos, więc cofnięcie może cofnąć tylko to, co zrobiłeś sam.

## Twoje dane i zdjęcie profilowe

**Profile** (prawy górny róg galerii) przechowuje twoje imię i nazwisko, dane kontaktowe oraz opcjonalne **zdjęcie profilowe**. Narzędzia, które pytają o te pola, wypełniają je automatycznie - ustaw je raz, a twoja stopka mailowa, lockupy i identyfikatory uzupełnią się same. Każde pole nadal możesz nadpisać w ramach sesji. Włącz **Use my details to create**, aby twoje dane szły dalej jako dane autora tego, co eksportujesz.

Twoje zdjęcie i dane żyją **wyłącznie na tym urządzeniu**. Profil to nie musi być tylko ty - może być zespołem albo rolą, w którą od czasu do czasu wchodzisz. Pełny obraz, łącznie z prowadzeniem kilku profili, znajdziesz w **[Profilach](/info/profile.html)**.

## Zapisywanie i wznawianie

Kliknij **Save**, aby zapisać bieżące wartości pól jako sesję tego narzędzia. Możesz trzymać wiele nazwanych sesji na narzędzie; przycisk **Continue** w każdym narzędziu otwiera najnowszą, a **przycisk historii** (prawy górny róg, obok profilu) wypisuje wszystkie zapisane sesje ze wszystkich narzędzi. Sesje są lokalne dla urządzenia. Aby je uporządkować, otwórz **Projects** (poniżej).

![Dwudzielna pigułka renderu - strzałka w górę otwierająca panel eksportu i ptaszek zapisujący sesję na miejscu](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

## Projects

**Projects** - otworzysz je z zakładki **Projects** obok **Tools** albo z **Profile → Storage → Organise in Projects** - to dom dla wszystkiego, co zapisałeś, i działa jak menedżer plików:

![Projects - zapisane sesje uporządkowane w zagnieżdżalnych folderach](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)

- <!--i:folder--> **Foldery, które się zagnieżdżają.** Grupuj zapisane sesje w foldery, a foldery w innych folderach, tak głęboko, jak chcesz. Utwórz folder, zmień jego nazwę albo przeciągnij kafelek na inny folder, aby go przenieść; ścieżka nawigacji prowadzi z powrotem w górę. Zawsze obecny folder **Uncategorised** trzyma wszystko, co nie zostało jeszcze uporządkowane.
- <!--i:clock--> **Sortuj po swojemu.** **View & sort** oferuje **Name**, **Date added**, **Last modified** (domyślnie), a wewnątrz folderu także **By tool**. Foldery zawsze idą pierwsze, niezależnie od aktywnego sortowania - sortowanie porządkuje tylko sesje i foldery w obrębie ich własnej grupy.
- <!--i:document--> **Odkładaj nowe prace od razu na miejsce.** **New asset** ("Start a fresh creation" w katalogu głównym, "Add to *folder*" wewnątrz folderu) otwiera narzędzie i automatycznie odkłada jego pierwszy zapis do tego folderu.
- <!--i:checklist--> **Zaznaczanie wielokrotne (komputer).** Zaznacz pole wyboru kafelka, przeciągnij ramkę zaznaczenia po pustym miejscu albo użyj **Shift/Cmd-klik**; **prawy przycisk** na kafelku otwiera jego menu kontekstowe. Potem działasz na całym zaznaczeniu naraz - ten sam gest i ten sam pływający pasek akcji działają w galerii Tools, w Utilities, w Catalogue i w Projects, nie tylko tutaj.
- <!--i:download--> **Renderuj cały folder albo zaznaczenie.** **Render folder** eksportuje każdą zapisaną sesję z folderu - razem z podfolderami - jako jeden zagnieżdżony `.zip`. **Render selection** robi to samo dla dowolnego zaznaczenia wielokrotnego, a pojedyncza sesja renderuje się wprost do własnego pliku. Bez Batch/Pro.
- <!--i:link--> **Przejdź prosto do zapisanych prac narzędzia.** Zaznacz jedno lub więcej narzędzi w galerii Tools i wybierz **View sessions** z paska zaznaczenia - Projects otworzy się, pokazując tylko sesje zrobione tymi narzędziami, z przyciskiem **Clear** wracającym do pełnego widoku.
- <!--i:link--> **Udostępnij zapisaną sesję.** Kliknij sesję prawym przyciskiem → **Share link**, aby skopiować link, który otwiera ją z dokładnie tymi samymi wartościami pól (pełne okno Share - zobacz niżej).

![Otwarte okienko View and sort w Projects, z wierszem motywu, wyborem View pomiędzy Preview a List oraz Name, Date added i Last modified pod Sort](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
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
Also: the popover is not sort-only. openViewOpts() writes a theme segment, a
"View" pair (Preview / List) and a sound segment around the Sort rows, so the
alt text names them - do not re-caption this as "the sort menu".
-->

**To, co oferuje pasek zaznaczenia**, różni się nieco w zależności od widoku, bo nie każda akcja ma wszędzie sens:

- **Tools / Utilities:** Favourite (albo Unfavourite), Hide (albo Unhide), Available offline (albo Remove from offline), **View sessions** (opisane wyżej przejście) oraz Copy link, gdy zaznaczona jest dokładnie jedna karta.
- **Catalogue:** Favourite i Hide działają na dowolnym zaznaczeniu; Duplicate, Download i Delete pojawiają się dopiero wtedy, gdy każdy zaznaczony element jest twoim własnym wgranym plikiem - współdzielony zasób systemu projektowego to trwałe zobowiązanie, więc te trzy akcje nie dotyczą go nawet przy operacjach zbiorczych.
- **Projects:** **Render selection**, **Move to…**, **New folder**, **Delete**, **Edit together**, gdy zaznaczenie liczy od dwóch do ośmiu sesji z jednego narzędzia (otwiera je obok siebie pod jednym wspólnym paskiem bocznym), oraz **Edit as sheet**, które zamiast tego otwiera całe zaznaczenie jako wiersze w siatce wsadowej. To drugie **nie ma limitu rozmiaru** i nie zważa na to, czy sesje pochodzą z tego samego narzędzia, więc jest wyjściem awaryjnym, gdy zaznaczenie jest większe lub bardziej mieszane niż dwa-do-ośmiu w Edit together.

> Jedna pułapka nazewnicza: **View sessions** istnieje dopiero wtedy, gdy coś jest *zaznaczone*. Kliknięcie prawym przyciskiem pojedynczej niezaznaczonej karty daje zamiast tego **N saved sessions**, co otwiera własne okno historii tego narzędzia, a nie przenosi do Projects.

![Dwie zaznaczone karty narzędzi w galerii Tools, z pływającym paskiem zaznaczenia pokazującym 2 selected i oferującym Available offline, View sessions, Favourite oraz Hide](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery)
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
`projects` shot above already carries; revisit if the pipeline gains a
storage-seeding hook.
-->


## Udostępnianie swojej pracy

Projekt wychodzi na dwa sposoby: jako link albo jako plik. Okno Share oferuje oba. Otwórz je przyciskiem **Share** w kontrolkach eksportu; **Share link** na zapisanej sesji w Projects otwiera to samo okno dla tej sesji.

### Link

Każde pole jest zapisane w adresie URL strony, więc link *jest* projektem. Na górze okna leży gotowy do skopiowania link, a pod nim dwie zwinięte sekcje.

- **Link options** mieści **Shortest link** (duży projekt daje długi adres URL, więc ta opcja pakuje cały stan w zwarty token i pokazuje oszczędność w znakach; czytelna forma zawsze pozostaje dostępna), **Password-protect this link** (AES-256 na całym linku, hasło nigdy w nim nie siedzi) oraz **Pin this tool version** - flagę `_v`, która przypina link do oglądanej właśnie wersji narzędzia, żeby późniejsza aktualizacja nie zmieniła tego, co się renderuje.
- **Link behaviour** to, co dzieje się, gdy odbiorca otworzy link: pełny ekran, rozwinięty od razu panel eksportu, pobieranie przy otwarciu przez `&export` albo kopiowanie do schowka przez `&copy`.

Wklej link koledze, dodaj go do zakładek albo wrzuć do repozytorium. (Pełne szczegóły: [URL Mode](/info/url-mode.html).)

**Niektóre narzędzia sprawiają, że link jest całym produktem.** Jump Page zbiera Twoje linki na jednej stronie do rozdawania - link biograficzny, prelekcja konferencyjna, witryna sklepowa. Nie ma nic do hostowania i nie stoi za tym żadne konto: strona to link, więc otwiera się tak szybko, jak podróżuje adres URL. W edytorze widzisz gotową stronę obok pól; osoba odwiedzająca, która otworzy link, dostaje ją na pełną szerokość, jeden link na scenę w miarę przewijania.

![Jump Page w edytorze - nagłówek, trzy sceny linków, każda z własnym tłem, oraz stopka Made with Lolly, ułożone jako jedna strona na płótnie](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

**Okno mówi, czego link nie uniesie.** Trzy rzeczy nie mieszczą się w adresie URL: obraz albo plik dodany z tego urządzenia, bardzo długa wartość tekstowa i bardzo duża lista. Każda z nich jest liczona przy budowaniu linku. Jeśli coś trzeba było pominąć, okno nazywa to i kieruje cię do pliku opisanego niżej, zamiast wręczać ci link, który otworzy się bez obrazka. Link, który jest po prostu *długi*, dostaje łagodniejszą uwagę z liczbą znaków, bo długość wciąż da się uratować pakowaniem.

### Plik .lolly

**Download .lolly** w oknie Share narzędzia, w którym pracujesz, zapisuje ten sam projekt jako plik. Niesie zapisaną sesję razem z obrazami i plikami dodanymi z twojego urządzenia. Grafika z katalogu, z której korzysta projekt, jedzie w środku razem z nim, więc plik otwiera się kompletny na komputerze, który nigdy nie widział twojej marki. Jeśli twoje urządzenie ma systemowy arkusz udostępniania, **Send to…** przekazuje ten plik prosto do niego (AirDrop, udostępnianie w Androidzie), zamiast zapisywać go na dysku.

`.lolly` to zwykły zip. Zmień rozszerzenie na `.zip` i otwórz: twoje własne obrazy są w `assets/uploads/`, a grafika z katalogu w `assets/catalog/`, każda z prawdziwą nazwą i rozszerzeniem, `manifest.json` wypisuje je wszystkie, a README na górze mówi, czym jest ten plik.

Trzy rzeczy zależą od ciebie, zanim plik wyjdzie:

- **Czy twoje imię i nazwisko trafi do pliku.** Twoje imię i nazwisko, e-mail i organizacja są zapisywane w pliku tylko wtedy, gdy w profilu włączona jest opcja **Use my details to create**. Gdy jest wyłączona, plik zapisuje jedynie, że powstał w Lolly i kiedy - nic o tobie.
- **Czy trafi do niego licencjonowana grafika.** Zasoby licencjonowane i zablokowane do marki są domyślnie wstrzymywane. Jeśli projekt z nich korzysta, okno dialogowe pokazuje ich liczbę i oferuje dwa przyciski - *Download without them* lub *Include and download* - ponieważ dołączenie ich przekazuje rzeczywiste pliki każdemu, kto otworzy `.lolly`.
- **Czy dołączone zostanie narzędzie.** **Include the tool** pakuje własne pliki narzędzia razem z projektem, dzięki czemu otwiera się on na urządzeniu, które nie ma tego narzędzia. Opcja jest domyślnie zaznaczona dla narzędzia niestandardowego - forka lub prywatnego narzędzia marki, którego odbiorca prawdopodobnie nie ma - a odznaczona dla narzędzia z podpisanego katalogu, bo jego kopia pochodzi z tego samego źródła. (W kompilacji bez podpisanego katalogu każde narzędzie liczy się jako niestandardowe, a pole startuje zaznaczone.)

**Otwieranie pliku.** Upuść plik `.lolly` na aplikację: zasoby trafiają do Twojej biblioteki, sesja trafia do Projects, a narzędzie otwiera się na niej. Nic Twojego nie zostaje nadpisane: sesja pojawia się jako nowy zapisany slot, a zasób już obecny na tym urządzeniu jest dopasowywany po sumie kontrolnej i ponownie wykorzystywany zamiast duplikowany. Każda część jest sprawdzana względem własnych sum kontrolnych pliku podczas importu, więc kopia uszkodzona w transporcie zostaje odrzucona zamiast zaimportowana połowicznie.

Jeśli plik niesie narzędzie, którego nie masz, Lolly pyta, zanim to narzędzie będzie mogło działać: **Trust this tool?** nazywa je i jego autora oraz mówi wprost, że otwarcie uruchomi kod tego narzędzia na twoim urządzeniu, a **Trust & install** jest drogą dalej. Odmów, a udostępniona praca i tak zapisze się w twoich projektach i poczeka tam do dnia, w którym dodasz narzędzie. (Jednego rodzaju narzędzia nie da się jeszcze doinstalować z boku - takiego, którego kod przychodzi jako moduł - i jest ono odprawiane tak samo.)

I link, i plik przekazują migawkę. Aby pracować nad tą samą sesją *w tym samym czasie* co ktoś inny - dwa urządzenia, bez serwera, bez internetu, jeśli jesteście w jednej sieci - zobacz [Praca razem](/info/collaborate.html).

## Kamera na żywo (narzędzia reagujące na ruch)

Każdy **Filter** do zdjęć - Halftone, Scanline, Posterize, Voronoi cells, Colour treatment, Pixel stretch i Imperfections - pokazuje przycisk **Go live** tam, gdzie dostępna jest kamera. Włącz go, a efekt śledzi obraz z kamery klatka po klatce, więc reaguje na ruch; wynik możesz nagrać do GIF, WebM albo MP4. Klatki są odczytywane i przetwarzane **na twoim urządzeniu** i nigdy go nie opuszczają, a kamera zostaje zwolniona w chwili, gdy zatrzymasz podgląd albo wyjdziesz z narzędzia. (Każdy wybór obrazu ma też **Take a photo**, aby złapać pojedynczą klatkę jako obraz na urządzeniu.)

## My images

Kiedy narzędzie pozwala dodać obraz z twojego urządzenia, jest on zachowywany dokładnie w takiej postaci, w jakiej przyszedł - więc Content Credential na nim nadal się weryfikuje - i zapisywany w twojej osobistej bibliotece **My images** (w **Profile → Storage**). Tylko naprawdę wielki plik pyta, czy go zachować, czy zmniejszyć. Używaj go ponownie w dowolnym narzędziu. Aby czyścić EXIF/GPS przy wczytywaniu obrazów, włącz w profilu **Strip metadata from uploads**. Nie ma limitu: biblioteka jest w całości lokalna i ograniczona tylko pamięcią twojego urządzenia - tam też zarządzasz obrazami i je usuwasz.

## Catalogue - twoja biblioteka zasobów

**Catalogue** (`#/c` albo segment **Catalog** przełącznika Projects · Tools · Utilities · Catalog na górze każdego widoku listy) zbiera wszystko, z czego mogą korzystać twoje narzędzia - logotypy marki, obrazy, dźwięk i animacje, pogrupowane według rodzaju - i tu też mieszkają twoje **własne pliki twórcze**. Bez serwera, bez konsoli administracyjnej, bez pull requestów: wszystko jest na twoim urządzeniu.

![Catalogue - zasoby marki, próbki kolorów i kroje pisma, a do tego twoje własne wgrane pliki](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=catalogue)

- <!--i:upload--> **Wprowadź swoje pliki.** Przeciągnij dowolny obraz, plik SVG, klip audio, wideo, Lottie, PDF lub prezentację PowerPoint na obszar przesyłania - albo kliknij, aby wybrać - a trafi natychmiast do Twojego katalogu, gotowy w selektorze zasobów każdego narzędzia. Wielostronicowy PDF lub plik `.pptx` pyta, które strony lub slajdy zachować - każdy staje się osobnym zasobem SVG. Wprowadzaj tyle, ile chcesz; to nigdy nie opuszcza Twojego urządzenia.
- <!--i:star--> **Oznacz gwiazdką to, po co sięgasz.** Oznacz gwiazdką ★ zasób (lub próbkę koloru marki), a przypnie się on na górze każdego selektora, więc Twoje ulubione logo czy kolor są o jedno kliknięcie.
- <!--i:folder--> **Zrób porządek.** Przekategoryzuj zasób do innej grupy, ukryj współdzielony zasób marki, którego nie używasz (z opcją **Show hidden**, aby go przywrócić) albo całkowicie usuń własne przesłane pliki. Ten sam gest wielokrotnego zaznaczania i pływający pasek akcji co w Projects działają też tutaj, więc każdą z tych czynności można wykonać na całym zaznaczeniu naraz.
- <!--i:layers--> **Zdejmij tło z wideo.** Otwórz szczegóły wideo lub kliknij prawym przyciskiem jego kartę w dowolnym selektorze zasobów i wybierz **Remove background…**, aby zapisać przezroczystą alternatywę - animowany WebP lub PNG z prawdziwym kanałem alfa. Wybierz **Method**: **On-device model** wycina obiekt z ruchliwej sceny, a **Colour key** wykrywa równomiernie oświetlone, jednolite tło, takie jak green screen czy zwykła ściana, z regulacją krawędzi przez **Tolerance**, **Softness** i **Spill removal**. Klucz kolorystyczny nie wymaga pobierania modelu ani sieci, więc **Remove background** jest dostępne dla każdego wideo i często daje czystszy wynik na uporządkowanym materiale. Ustawienie **Resolution** (360, 480, 720 lub 1080p, nigdy powyżej źródła) zamienia szczegółowość na mniejszy, szybszy plik. Działa jako zadanie w tle na Twoim urządzeniu. Gotowy wycięty materiał jest zapisywany obok oryginału jako osobny zasób, a Content Credential źródłowego wideo dołącza do niego jako składnik. (Zobacz [Wygenerowane raz, renderowane tak samo](/info/ai-features.html), dlaczego usuwanie tła pozostaje zwykłą edycją.)

### Zabierz swoją paletę i kroje pisma wszędzie

Panel **Swatches** w Catalogue nie tylko wyświetla - kliknij kolor, aby go skopiować, albo **pobierz całą paletę marki** w formacie, którym mówi twój drugi program:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** albo **CSS classes** - wrzuć markę wprost do arkusza stylów lub builda;
- <!--i:palette--> **Adobe Swatch Exchange (.ase)** - wczytaj do Illustratora albo Photoshopa;
- <!--i:pentool--> **GIMP palette (.gpl)** - dla GIMP-a albo Inkscape'a.

![Panel Swatches - pięć przycisków pobierania palety na górze, a pod nimi każdy kolor marki jako kopiowalny żeton](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

Panel **Fonts** wypisuje kroje pisma twojej marki, każdy z **pobieraniem** obok, do instalacji lokalnie albo przekazania drukarni. (Pokój Colours w [Brand Studio](/info/brand-studio.html) oferuje to samo pobieranie palety.)

Zasoby to jedna połowa otwartej ścieżki zrób-to-sam; druga to **tworzenie własnych narzędzi** - wolna kanwa (opisany wyżej Design) pozwala zbudować takie narzędzie wizualnie, bez pisania kodu.

## Dźwięk i dostępność

Lolly ma być wygodna w użyciu dla każdego. Interfejs obsługuje się z klawiatury, własne kontrolki mają poprawne etykiety dla czytników ekranu, a podgląd na żywo każdego narzędzia jest wystawiony jako jeden opisany obraz mówiący, co powstaje.

Delikatna warstwa **dźwięków pomocniczych** potwierdza to, co robisz - wejście do galerii, poprawny albo niepoprawny wynik sprawdzenia Content Credentials, zamknięcie panelu, przełączenie filtra. Jest **domyślnie wyłączona**: włącz **Sound** wszędzie tam, gdzie pojawia się ten przełącznik (okienko opcji każdego widoku albo **Profile**), a wybór zostanie zapamiętany.

Cztery opcjonalne ustawienia komfortu mieszkają w **Profile → Accessibility**: **Reduce motion** (usuwa przejścia i ozdobniki aplikacji), **Hide colourful previews** (spokojne karty galerii z ikoną i tekstem oraz stonowane miniatury projektów), **High contrast** (mocniejsze obramowania, tekst i obwódki fokusu) i **Large text** (większy krój aplikacji - etykiety, menu, tekst przycisków). Wszystkie cztery uspokajają aplikację *wokół* twojej pracy: nigdy nie sięgają do kanwy narzędzia ani nie zmieniają ani jednego piksela tego, co eksportujesz, i każde jest wyłączone, dopóki go nie włączysz. Pełny opis w [Twój profil → Accessibility](/info/profile.html#accessibility).

Obok przełącznika Sound jest **Neurospicy Mode** - opcjonalna, kojąca ścieżka w tle, która cicho gra podczas pracy. Włączenie jej otwiera mały **dok odtwarzacza** w dolnym rogu, który towarzyszy ci w całej aplikacji; z niego wyszukasz i wybierzesz utwór, przeskoczysz do przodu i do tyłu, ustawisz głośność oraz zminimalizujesz lub zamkniesz odtwarzacz. Lista utworów obejmuje kilka kategorii - proceduralne melodie *Lolly Sings*, ambientowe pętle i bity, twoje własne wgrane nagrania oraz garść internetowych stacji **radiowych** na żywo (te wymagają połączenia; cała reszta gra offline). Jest **domyślnie wyłączony** i, tak jak Sound, zapamiętywany między sesjami i urządzeniami. Wyłączenie Sound wycisza także ścieżkę do skupienia.

## Pamięć i prywatność

Wszystko jest przechowywane w lokalnej bazie danych twojej przeglądarki (IndexedDB): twój profil, zapisane sesje, wgrane obrazy i pamięć podręczna pobranej zawartości katalogu. **Profile → Storage** pokazuje zużycie i pozwala ci:

- <!--i:box--> **Clear cache** - usunąć pobraną zawartość katalogu (zsynchronizuje się ponownie przy następnym wczytaniu).
- <!--i:trash--> **Clear all my data** - skasować profil, sesje i obrazy. *Nie da się tego cofnąć.*

![Karta pamięci na ekranie o szerokości telefonu: nazwana każda kategoria danych na urządzeniu, a na dole przycisk Clear all my data](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Żadne z tych lokalnych danych nigdzie nie są przesyłane - bez telemetrii, bez renderowania w chmurze. Pełna lista tego, co aplikacja kiedykolwiek pobiera lub wysyła, jest w [Polityce prywatności](/info/privacy.html), a [Server Surface](/info/server-surface.html) spisuje opcjonalne komponenty serwerowe.

## Przenoszenie na inne urządzenie

Ponieważ wszystko żyje na twoim urządzeniu, **Profile → Storage → Move to another device** pozwala przenieść całość do drugiej instalacji - bez konta, bez chmury:

- <!--i:download--> **Export my data** pobiera jeden plik `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (części nazwy pochodzą z twojego profilu i są pomijane, gdy nie są ustawione; `<n>` to licznik dzienny, żeby eksporty z tego samego dnia się nie zderzały) zawierający twój profil, każdą zapisaną sesję (razem z miniaturą), twoje wgrane obrazy i twoje preferencje (motyw, szerokość paska bocznego, lokalne statystyki aktywności).
- <!--i:upload--> **Import data…** w drugiej instalacji wczytuje ten plik z powrotem. Działa przez **scalanie**: wszystko o tej samej nazwie (twój profil, miejsce sesji, obraz) zostaje zastąpione kopią z importu; cała reszta na tym urządzeniu zostaje zachowana. Zapisane sesje same podpinają się z powrotem do zaimportowanych obrazów.

Pamięć podręczna katalogu nie jest dołączana - pobiera się sama na nowym urządzeniu. Paczka to zwykły zip (`manifest.json` + `profile.json` + `sessions.json` + `assets.json` + `assets/blobs/…` + `prefs.json`, identyfikator formatu `lolly-backup`), więc przetrwa w całości pocztę, pendrive'a albo AirDrop i jest tym samym formatem, który czyta każda powłoka. Każda część ma sumę kontrolną, więc plik uszkodzony w transporcie zostaje wychwycony przy imporcie, a nie przywrócony w połowie zepsuty. (Pełna specyfikacja formatu: [Data Transfer](/info/data-transfer.html).)

## Importowanie projektu (Figma, Penpot, Illustrator, InDesign)

Możesz wnieść istniejący projekt do Lolly i pracować nad nim dalej: otwórz **Design**, kliknij **Import a design** na pasku narzędzi kanwy i wybierz **.fig** lub SVG z Figmy, **.penpot** z Penpota, **.ai** / **.pdf** z Illustratora albo **.idml** z InDesign. Warstwy stają się edytowalnymi polami na wolnej kanwie - tekst nadal da się przepisać, obrazy lądują w **My images**, a typografia i kolory dostosowują się do globalnych ustawień marki - a wynik zapisuje się, udostępnia i renderuje jak każda inna sesja. Parsowanie odbywa się w całości na twoim urządzeniu. Pełny opis: **[Import projektu](/info/design-import.html)**.

## Eksport

Pełną historię znajdziesz w **[Eksport i formaty](/info/exporting.html)** - wybór formatu, rozmiar wyjściowy i jednostki druku, przezroczystość, wideo oraz kopiowanie i udostępnianie. W skrócie: wybierz format, ustaw rozmiar, jeśli trzeba, i kliknij **Download** (albo **Copy** do schowka).

## Tryb Batch (Pro)

Dla zaawansowanych użytkowników **Batch** (link z galerii, za flagą funkcji Pro, domyślnie włączoną) renderuje wiele wariantów naraz - siatka, w której każdy wiersz to zestaw wartości pól eksportowanych razem. Idealne do lokalizacji karty na kilkanaście języków albo wygenerowania wszystkich wariantów rozmiaru w jednym przebiegu. Wiersze wypełnisz pisaniem, wklejeniem wprost z arkusza kalkulacyjnego albo importem CSV (możesz też wyeksportować taki plik z powrotem), a format, rozmiar i nazwę pliku wyjściowego ustawisz osobno dla każdego wiersza. Zapisz całą siatkę jako nazwaną **sesję wsadową**, która otwiera się z galerii, i pobierz wszystkie wiersze jako jeden `.zip`.

![Pasek narzędzi trybu wsadowego - nazwa archiwum zip, jednostki, DPI oraz format dziedziczony przez każdy wiersz, z Sessions i Render po prawej](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.pro-toolbar&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

Batch służy do generowania **wielu wariantów jednego szablonu** naraz. Aby ponownie wyrenderować sesje, które **już zapisałeś**, użyj **Projects → Render folder / Render selection** (powyżej) - Pro nie jest potrzebne.

## Edycja obok siebie (Multi-edit)

Batch to wiele wariantów *jednego* projektu. **Multi-edit** to druga połowa tego zadania: kilka **różnych** zapisanych projektów otwartych naraz, więc jedna zmiana stosuje się do wszystkich. Zaznacz od **dwóch do ośmiu** zapisanych sesji w **Projects** i wybierz **Edit together** z paska zaznaczenia; otwierają się jako żywe karty obok siebie pod adresem `#/multi?s=<slot>,<slot>…`. Każda karta to prawdziwy render danej sesji, a nie zapisana miniatura, więc to, co widzisz, jest tym, co zostanie wyeksportowane.

Wszystkim steruje jeden pasek boczny:

- <!--i:sliders--> Na czele stoi **Shared** - każde pole, które co najmniej dwie z zaznaczonych sesji deklarują *tak samo* (to samo id, ten sam typ, te same ograniczenia - ta sama reguła scalania, której siatka wsadowa używa dla swoich kolumn). Zmień wspólną kontrolkę raz, a wartość rozejdzie się do każdej sesji, która ją deklaruje, na żywo na każdej karcie. Dwie sesje tego samego narzędzia dzielą wszystko; dwa różne narzędzia dzielą to, co akurat mają wspólnego, i nic poza tym.
- <!--i:document--> Pod nim **jedna zwinięta karta na sesję** ze wszystkimi własnymi polami tej sesji, w tej samej jakości co pasek boczny samego narzędzia - okna wyboru zasobów, powtarzalne grupy wierszy, pola koloru - plus zwarty blok eksportu: **Format**, **W** / **H**, **Unit**, **DPI** i własny **Download**. To pobieranie najpierw zapisuje sesję, a potem renderuje ją zwykłą ścieżką eksportu sesji, więc plik niesie tę samą nazwę, format i Content Credentials, co prosto z narzędzia.
- <!--i:search--> **Filter inputs…** na górze zawęża kontrolki na *wszystkich* kartach naraz - i tak właśnie docierasz do "nagłówka" w ośmiu sesjach bez przewijania za nim.

Kliknij dowolną kanwę (albo naciśnij na niej Enter), a karta tej sesji na pasku bocznym otworzy się i przewinie do widoku. **Save all** zapisuje każdą sesję z powrotem do jej własnego miejsca. **Download all** najpierw zapisuje, a potem renderuje cały zestaw tym samym potokiem co **Render selection** w Projects - jeden zip, z opcjonalną blokadą hasłem proponowaną po drodze.

Dwa uczciwie postawione ograniczenia. Limit od dwóch do ośmiu jest prawdziwy: każda karta uruchamia własne żywe środowisko, a to jest liczba, przy której wszystko pozostaje responsywne - link proszący o więcej (albo o sesję, która już nie istnieje) mówi to wprost, zamiast wczytywać się do połowy. I link nazywa *twoje* zapisane miejsca, więc otwiera ten zestaw na tym urządzeniu; to nie jest link do udostępniania.

Kiedy zaznaczenie liczy więcej niż osiem elementów, miesza narzędzia albo obejmuje obrazy oprócz sesji, wyjściem awaryjnym jest **Edit as sheet** na tym samym pasku zaznaczenia: otwiera całe zaznaczenie jako **wiersze w siatce wsadowej** (`#/pro?s=…`), bez limitu rozmiaru i bez zasady jednego narzędzia. Foldery są poza obydwoma - mają własną ścieżkę otwierania w siatce. ([Wyszukiwarka](/info/search.html) jest jedyną rzeczą, która tu jeszcze nie sięga: Multi-edit to jedyny widok, o którym pasek wyszukiwania nie wie.)

## Tryb offline i instalacja

Lolly to PWA. Po pierwszym wczytaniu działa **offline** - zainstaluj ją z paska adresu przeglądarki (albo przez *Add to Home Screen* na telefonie), aby korzystać z niej jak z aplikacji, na pełnym ekranie. Aktualizuje się sama, kiedy wrócisz online.

O aktualizacjach: jeśli widok kiedykolwiek nie wczyta się zaraz po niej (pusty panel, \"failed to fetch\" w rogu), przeładuj stronę raz - aplikacja czysto przechodzi na nową wersję, a Twoja praca, sesje i marka pozostają nienaruszone. Wszystko przechowuje na Twoim urządzeniu, nie na stronie.
