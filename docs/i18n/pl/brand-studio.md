# Brand Studio

**Brand Studio** pod adresem `#/start` to jedyne miejsce, w którym kształtujesz swoją markę - jej logotypy, kolory, typografię, resztę tokenów i przechowywane pliki. Ustaw to tutaj raz, a każde narzędzie, strona i eksport będą się do tego stosować *z założenia*, a nie po weryfikacji.

Zmiany podglądasz **na żywo w całej aplikacji** w miarę ich wprowadzania, dzięki czemu widzisz, jak kolor lub czcionka wypadają wszędzie, zanim je zatwierdzisz. Wszystko dzieje się na urządzeniu: pliki i tokeny Twojej marki nigdy nie opuszczają Twojego komputera (wybranie czcionki Google pobiera tę jedną rodzinę z Google, jednorazowo, po oknie zgody), a marka podróżuje w postaci jednego pliku [brand pack](#move-a-brand-between-devices).

> **To jest edytor. Panel jest lustrem.** Zakładka **Design system** w panelu (`#/d`) *pokazuje* Twoją markę w trybie tylko do odczytu; *edytujesz* ją tutaj, w `#/start`. Jeśli chcesz później zmienić kolor, wróć do Brand Studio.

## Pokoje

Studio to zestaw **pokoi** wymienionych w pasku z boku - to nie kroki. Nic nie jest ponumerowane, nic nie jest uzależnione od niczego innego, a wejście do dowolnego z nich jest w pełni uzasadnione:

- **Overview** - centrum. Co istnieje w tej chwili, w skrócie, z drzwiami do każdego pokoju.
- **Colours** - dodawaj kolory pojedynczo, przypisuj role albo wygeneruj całą paletę z jednego koloru.
- **Type** - cztery kroje pisma, z których korzysta aplikacja, Twoje narzędzia i każdy eksport.
- **Logos** - Twoje znaki, we wszystkich orientacjach i wariantach.
- **Tokens** - promień zaokrąglenia, odstępy, cienie i reszta systemu.
- **Files** - pliki graficzne, dźwiękowe i animacje przechowywane przez Twoją markę.

Na telefonie ta sama lista zamienia się w poziomy pasek chipów przypięty pod nagłówkiem. Przełączanie pokoju nigdy niczego nie przeładowuje - edytor trzyma wszystkie panele zamontowane i po prostu pokazuje ten, o który poprosisz.

**Bezpośredni link do pokoju** przez `#/start?area=<key>`. Klucze to `overview`, `color` *(zwróć uwagę na amerykańską pisownię w adresie URL)*, `type`, `logos`, `tokens`, `catalogue` (pokój Files - klucz panelu jest trwałym kontraktem, więc adres URL zachowuje starą nazwę) oraz `versions`. `?tab=` to długoletni alias tego samego i nadal działa, więc stare linki i zakładki wciąż funkcjonują; wszystko nierozpoznane otwiera Overview zamiast prowadzić donikąd.

Przypięte do **dolnej krawędzi paska** są akcje należące do całego systemu projektowego, a nie do jednego pokoju:

- **Add from…** - selektor źródeł, do wczytania marki z pliku, PDF-a, obrazu, czcionki lub strony internetowej. Zobacz [Bring a brand in](#bring-a-brand-in) poniżej.
- **Tray** - kandydaci znalezieni przez skan, ale jeszcze niezatwierdzeni. Pozostaje ukryty, dopóki skan faktycznie czegoś nie zachowa, a wtedy pokazuje licznik; nic w nim nie zmienia Twojej marki, dopóki nie naciśniesz Add przy danym wierszu.
- **Export** - zapisuje całą markę jako jeden plik `LollyBrand-…zip`.
- **Tokens (.json)** - sam dokument tokenów projektowych, do repozytorium, kroku budowania lub innego narzędzia do tokenów.
- **Versions** - publikuj, aktywuj i przywracaj nazwane kopie systemu projektowego. Ukryte, dopóki nie ma nic własnego do opublikowania (albo link `?area=versions` nie poprosi o to po nazwie).

![Pasek pokoi studia - Overview, Colours, Type, Logos, Tokens i Files](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Overview

Overview to pokój, w którym się lądujesz, i ma dwie twarze.

Gdy **nic jeszcze nie skonfigurowano**, oferuje dwoje drzwi - **Start from a file** (tokeny projektowe, projekt Penpot, paczka systemu projektowego lub SVG) i **Start from scratch** (dodaj jeden kolor, a potem kontynuuj, kiedy zechcesz) - oraz ciche wyjście **Explore the tools** pod nimi, bo wyjście też jest uprawnioną odpowiedzią.

Gdy system projektowy już istnieje, ten sam pokój pokazuje **co masz**: paletę i liczbę kolorów, obowiązujące rodziny czcionek, liczbę wypełnionych slotów logo, liczbę tokenów oraz pokój Files. Każdy blok to drzwi do swojego pokoju. Są tu liczniki, nigdy pasek postępu i nigdy karta ukończenia - w tym studiu nic nie jest należne.

## Logos

Zacznij od opróżnienia folderu ze znakami do strefy upuszczania u góry: **„Drop marks here, or choose several at once”** przyjmuje tyle plików, ile masz, za jednym razem. Każdy plik jest analizowany pod kątem kształtu i barwy, a następnie trafia do kolejki **Waiting for a slot** jako chip informujący, co system o nim sądzi - *„Looks like the Horizontal primary”*, wraz z pomiarem, na którym się oparł, oraz przyciskiem **Place** (**Replace**, gdy dany slot jest już zajęty). Tam, gdzie system nie jest pewny, chip mówi to wprost i zamiast tego oferuje **Change slot**, listujące wszystkie osiem. Nic nie zostaje umieszczone, dopóki czegoś nie naciśniesz.

Wokół tej kolejki dzieją się dwie rzeczy. Znak z nadmiarowym pustym marginesem najpierw otrzymuje **propozycję przycięcia** - odpowiedz na nią lub naciśnij Escape, a oryginalny plik zostanie wprowadzony bez zmian. A tam, gdzie dany znak może wypełnić pusty slot bliźniaczy, pokój oferuje wyprowadzoną wersję **mono** lub **reverse** jako osobny chip, oznaczony *Generated*, który znika ponownie, jeśli wypełnisz ten slot w inny sposób.

Poniżej znajduje się siatka, w której ląduje każdy znak - sloty **orientacja × wariant**:

- **Orientacje:** Horizontal (logotyp + symbol w rzędzie) i Vertical (ułożone pionowo, do przestrzeni kwadratowych i wysokich).
- **Warianty:** Primary, Primary reverse (do ciemnych teł), Mono (jeden kolor) i Mono reverse.

To osiem opcjonalnych slotów. Kliknij slot, aby dodać PNG, SVG, JPEG lub WebP; kliknij wypełniony slot, aby go zastąpić. Każdy slot jest opcjonalny i wszystko pozostaje na tym urządzeniu.

![Macierz logo - każda orientacja u góry, każdy wariant jako osobny przerywany slot, wszystkie opcjonalne](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** - dodaj znaki, które Twoja marka nazywa po swojemu (ikonę, godło, favicon) w sekcji **Custom marks**; nadaj nazwę i wybierz plik.
- **More identities** - subm marka, produkt lub wydarzenie mogą mieć własny, pełny zestaw logotypów. Użyj **+ Add another logo** i nadaj nazwę; Twój główny zestaw to po prostu „Your logo”.
- **Upload an SVG and Lolly reads its colours.** Na zupełnie nowej instalacji Lolly po cichu ustawia Twój kolor podstawowy z logo i informuje o tym. W istniejącej marce zamiast tego oferuje ten kolor jako sugestię - *„Found in the logo: #…”* z przyciskiem **Use as primary** obok - w pokoju Colours, gdzie możesz ją przyjąć lub odrzucić.

## Colours

![The Colours room after one colour - the two panes back, the generate offer, roles reading in three registers and the pane at one colour](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

Najbogatszy pokój, w dwóch panelach. Lewy to miejsce pracy; prawy to Twoja **paleta na żywo**. Przeciągnij dzielnik między nimi, aby zmienić rozmiar (Enter na nim zwija paletę z drogi).

![Pokój Colours - kolor podstawowy wyprowadza rampy, karty próbek ze współczynnikami kontrastu i paleta na żywo](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Dodaj kolor, a potem nadaj mu rolę

**Add a colour** to cała prosta ścieżka: wklej lub wybierz kolor w dowolnej notacji, a stanie się dokładnie jednym tokenem. Nic z niego nie jest wyprowadzane, nic nie jest w niego sugerowane, nic więcej nie jest wymagane. Wklej całą *listę* kolorów, a każdy stanie się chipem, który możesz dodać osobno.

**Roles** to warstwa nałożona na wierzch - który kolor pełni jaką funkcję. Role są opcjonalne (system projektowy z trzech luźnych kolorów i bez ról jest jak najbardziej dobry), dowolna próbka może przyjąć rolę, a odczyt kontrastu jest mierzony względem tła, najpierw według APCA.

### Skrzydła dla ekspertów

Pod tymi dwoma znajdują się cztery zwinięte sekcje. Otwórz tę, której potrzebujesz; każda ma bezpośredni link jako `#/start?area=color&focus=<wing>`:

- **Generate a starter palette** (`focus=generate`) - jeden kolor przekształcony w pełny zestaw odcieni. Opisane poniżej.
- **Shade curves** (`focus=curves`) - przekształcaj rampę punkt po punkcie. Jasność, chroma i odcień mają własne krzywe, przełączane przez L / C / H, a odcienie poniżej przeliczają się na żywo podczas przeciągania.
- **Contrast** (`focus=contrast`) - **Contrast-lock** przestraja rampę tak, by osiągnąć docelowe wartości APCA względem wybranego tła, przy czym każdy krok zachowuje własny odcień i chromę; **Rotate hue** obraca całą rampę wokół koła barw, a każdy odcień zachowuje swoją jasność i chromę.
- **Print** (`focus=print`) - czym kolor podstawowy staje się na druku: jego automatyczna wartość ekranowa, przypięta konwersja CMYK albo nazwany kolor spot.

### Jeden kolor, cała paleta

W sekcji **Generate a starter palette** wybierz **Primary colour**, a Lolly wyliczy pełną paletę - jasne i ciemne powierzchnie, tekst, akcenty oraz pełne rampy odcieni i cieni - używając tej samej percepcyjnej matematyki kolorów (OKLCH), z której silnik korzysta wszędzie. Dostrój wyprowadzanie:

- **Scheme** - Mono, Complement, Analogous lub Triad - ustala, jak kolor drugorzędny odnosi się do Twojego koloru podstawowego.
- **Shades** - suwak od 3 do 20 (domyślnie 5) kontroluje, ile kroków generuje każda rampa.
- **Fine-tune** (zwinięte) - **UI intensity** (Muted / Deep), **Contrast** (Comfort / High) i **Text on brand** (Auto / Light / Dark).

Nic w tym skrzydle nie zapisuje niczego w Twojej marce. To podgląd, na żywo w całej aplikacji, żebyś mógł/mogła go ocenić, aż do momentu naciśnięcia **Replace palette** (poniżej).

Pod kolorem podstawowym zobaczysz rampy **Primary / Neutral / Secondary / Blend** na żywo oraz karty próbek Light i Dark, każda z własnym odczytem kontrastu - współczynnikiem WCAG wraz z liczbą APCA `Lc` obok. **Kliknij krok na rampie Neutral lub Secondary**, aby zakotwiczyć ten odcień zamiast domyślnego, wyprowadzonego.

![Cztery rampy ułożone nad kartami wzorcowymi w jasnym i ciemnym motywie, każda karta ze swoim współczynnikiem kontrastu WCAG](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Zbuduj swoją paletę (generator harmonii)

W tym samym skrzydle **Build your palette** generuje pasujące kolory akcentów na podstawie koloru podstawowego. Wybierz **Harmony** - **Complementary**, **Adjacent**, **Triad**, **Tetrad** lub **Analogous** (co dodaje własną liczbę **Accents**, od 2 do 5, oraz kąt odcienia **Angle** od 10° do 45°) - a każdy kandydat pojawia się z automatycznie wygenerowaną, czytelną nazwą i przyciskiem **+ Add**. Dodanie koloru od razu umieszcza go w palecie, jedno naciśnięcie na jeden token. *"Your palette, applied"* pokazuje podgląd całego zestawu na prawdziwych grafikach.

![Wygenerowane akcenty, każdy z próbką koloru, automatycznie wygenerowaną nazwą, kodem hex i przyciskiem Add](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Zatwierdzanie wygenerowanej palety

**Replace palette** to jedyny element sterujący w tym skrzydle, który cokolwiek zapisuje, i nigdy nie robi tego od razu. Po naciśnięciu najpierw otwiera się karta podglądu, zatytułowana **"Replace the palette?"**, wypisująca dokładnie, co się zaraz wydarzy: ile ról zostaje przypisanych tak jak je ustawiłeś, ile dodanych przez Ciebie kolorów zostaje zachowanych, ile krzywych odcieni zostaje ponownie zakotwiczonych, ile blokad druku zostaje ponownie przypiętych, ile ukrytych odcieni pozostaje ukrytych, ile przystanków gradientu zachowuje swój kolor.

**Replace palette** na tej karcie zatwierdza zmianę; **Cancel** wycofuje się i niczego nie zmienia. Po wykonaniu karta zmienia się w **"Palette replaced."** z od razu zaznaczonym przyciskiem **Undo** - a punkt kontrolny całego systemu projektowego jest tworzony *przed* zamianą, więc "przywróć jak było" to przywrócenie z kopii, a nie stracone popołudnie.

### Paleta, wykres i każda próbka koloru

Prawy panel wyświetla wszystkie kolory Twojej marki, pogrupowane (Primary, Neutral, Secondary, Spectrum, Custom, Roles), każda grupa zwijalna, z własnym przyciskiem **+ Add**. Poniżej **Colour chart** rozwija się w dwa widoki tych samych próbek: **Wheel** (koło OKLCH - przeciągnij kropkę, by zmienić jej kolor, kliknij kropkę, by ją edytować, lub kliknij puste miejsce, by dodać nową próbkę) oraz wykres **Gamut**, który pokazuje, gdzie faktycznie kończy się zakres możliwy do wyświetlenia. `#/start?area=color&focus=chart` otwiera tę kartę bezpośrednio, tak jak zawsze robi to `?wheel`.

![Panel palety, każda grupa zwijalna, z pigułką pobierania umieszczoną przy dolnej krawędzi](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Koło OKLCH - kąt to odcień, odległość od środka to nasycenie, a szarości poruszają się po pasku jasności z boku](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Kliknij dowolną próbkę, aby otworzyć jej edytor:

- **Rename** ją.
- **Set the colour** - selektor otwiera się na percepcyjnych suwakach **OKLCH**, z trybami **Hex**, **HSL**, **RGB** i **CMYK**; pole wartości odczytuje *i* zapisuje w aktualnie aktywnej przestrzeni, więc możesz wkleić kod hex albo wpisać procenty farb. Zauważ, że wpisanie wartości CMYK ustawia kolor *ekranowy* przez konwersję - aby przypiąć dokładne farby, użyj blokady druku poniżej.
- **Stored as** - wybierz, jak próbka jest zapisywana: **LCH** (domyślnie - percepcyjny, szeroki gamut, najlepszy wybór do edycji), Hex, RGB lub HSL. Zmień to, gdy musisz przypiąć dokładny stary kod hex albo dopasować wartość sRGB.
- **Use as** - przypisz tej próbce jedną z ról marki bezpośrednio, bez wracania do panelu Roles. (Kafelek roli sam tego nie oferuje - rola nie może przejąć roli.)
- **Print substitutes** (zwinięte) - zablokuj zachowanie koloru w druku:
  - **CMYK** - przełącz z **Auto** na **Locked**, aby zastąpić automatyczną konwersję sRGB→CMYK dokładnymi wartościami farb (C/M/Y/K, 0–100).
  - **Spot colour** - przełącz z **None** na **Set**, aby przypisać próbce kolor spotowy; nadaj mu **Name** (np. `PANTONE 186 C`), opcjonalnie **Book** i opcjonalnie **Finish** (domyślnie Ordinary ink) na wypadek, gdy farba wcale nie jest farbą - folia, wytłoczenie wypukłe lub wklęsłe, lakier wybiórczy, soft touch albo wykrojnik, bigowanie czy perforacja.
- **In other spaces** (zwinięte) - ta sama idea w szerszym ujęciu: każdy wiersz to przestrzeń, w której można wyrazić tę próbkę, albo wyprowadzona z wartości kanonicznej, albo wprowadzona przez Ciebie - a ta wprowadzona ręcznie wygrywa przy eksporcie.

Tych blokad druku używa drukarnia, gdy eksportujesz plik CMYK PDF lub TIFF - zobacz [Eksportowanie](/info/exporting.html#colour-profiles).

**Deleting a swatch** jest bezpieczne: wyprowadzone kroki rampy i role motywu zostają *ukryte* (bazowy token nadal się rozwiązuje, więc nic dalej się nie psuje), podczas gdy kolory dodane przez Ciebie są usuwane całkowicie.

### Gradienty

Opcjonalny panel **Gradients** tworzy tokeny przejść z Twojej palety dla teł i akcentów. Pomiń go całkowicie, jeśli Twoja marka nie używa gradientów. Każdy gradient ma podgląd, nazwane przystanki (2–8) i kąt. Kluczowe zachowanie: **przystanek odwołuje się do próbki koloru**, więc zmiana koloru tej próbki zmienia też gradient. Interpolacja odbywa się w OKLCH, co daje czyste przejścia. Usuń przystanek, aby skrócić przebieg.

### Zabierz paletę gdzie indziej

Pływająca pigułka umieszczona przy dolnej krawędzi panelu palety pozwala pobrać całą paletę jako **Design tokens (JSON)**, **CSS variables**, **CSS classes**, **SCSS variables**, **GIMP palette (.gpl)** lub **Adobe Swatch Exchange (.ase)** - dzięki temu marka trafia od razu do Illustratora, Figmy, GIMP-a lub arkusza stylów. Znajduje się poza obszarem przewijania panelu, więc zachowuje swoje miejsce niezależnie od tego, jak daleko przewinięta jest paleta. (Paletę można też pobrać z widoku [Catalogue](/info/using.html).)

## Typografia

![The compare stage open under its card, with the search row, the pinned families and the cards folded to a one-line strip](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

Ten pokój zaczyna się od **czterech kart ról** - czterech krojów, które faktycznie odczytuje aplikacja, Twoje narzędzia i każdy eksport. Każda karta pokazuje, co obecnie pełni daną rolę, zapisane w tym kroju, z linijką prawdziwego tekstu pod spodem:

- **Primary** - treść, przyciski i każde narzędzie.
- **Headings** - krój wyświetlnikowy dla `h1`/`h2`.
- **Code** - krój o stałej szerokości dla kodu i danych.
- **Italic** - prawdziwy kursywny towarzysz do wyróżnień, cytatów i dygresji.

Headings, code i italic domyślnie sięgają do kroju primary, dopóki ich nie przypiszesz, więc marka z jednym krojem nie wymaga tu żadnych decyzji. Żaden element na karcie niczego nie zatwierdza: **Change** (albo **Choose a face** przy pustej roli) otwiera **etap porównania** ograniczony do tej roli.

![Pokój Type - karty ról i żywy wzorzec każdego kroju w akcji](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

### Etap porównania

Etap otwiera się **w tym samym pokoju**, a nie w oknie dialogowym, więc karty, z których wyszedłeś, zostają na ekranie. Wyszukaj rodzinę Google Fonts (Inter, Fraunces, Space Grotesk…) albo upuść plik czcionki, naciśnij **Add to the comparison**, a kandydaci staną obok siebie w tych samych słowach, zanim którykolwiek się zainstaluje. Escape anuluje i oddaje klawiaturę karcie, z której go otworzono.

To jedyne drzwi wejściowe, dlatego nic nie wchodzi do Twojej marki niezauważone. Pod sceną znajdują się dwa panele zarządzania:

- **Fonts on this device** - każda zainstalowana rodzina, role, którym służy, i usuwanie. **Add a face** otwiera tu ten sam etap porównania, tym razem bez ograniczenia do roli.
- **Your fonts** - prześlij plik **TTF**, **OTF** lub **WOFF** z własnego urządzenia. To ścieżka dla licencjonowanego kroju firmowego, który już posiadasz.

Tak czy inaczej krój pozostaje na tym urządzeniu, renderuje się w aplikacji, w Twoich narzędziach i w każdym eksporcie, na zawsze działa offline i podróżuje w pakiecie marki - nic nie jest pobierane w momencie renderowania. Wszystko na Google Fonts jest udostępniane na otwartej licencji (OFL/Apache/UFL).

Panel **Type roles** na dole pokazuje żywy wzorzec każdej roli - treść i UI w kroju primary, opcjonalny krój wyświetlnikowy dla nagłówków górnych, kursywę do wyróżnień, krój mono do kodu i danych - dzięki czemu widzisz cały zestaw działający razem.

![Wzorzec Type roles - nagłówek, treść, kursywa i kod, każdy zapisany w kroju, do którego dana rola się rozwiązuje, z nazwą kroju obok](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

## Tokeny

Reszta systemu projektowego, edytowalna bez dotykania kodu:

![Pokój Tokens - suwak promienia zaokrąglenia rogów oraz odstępy, rozmiary, cienie i reszta systemu](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Rounded corners** - pojedynczy suwak promienia (0–1.5rem), za którym podążają karty, przyciski i panele w całej aplikacji.
- **More tokens** - dodawaj i edytuj **spacing**, **sizing**, **stroke width**, **opacity**, **rotation**, zwykłe **numbers** i **shadows**. Wybierz typ, nadaj mu nazwę (*Gutter, Card shadow…*) i ustaw wartość. Są one zapisywane jako standardowe [tokeny projektowe](/info/design-tokens.html) (DTCG) i podróżują razem z Twoją marką.

## Pliki

Upuść tutaj pliki, które przechowuje Twoja marka - poza logotypami: zasoby **vector**, **image**, **audio** i **motion** (wideo, Lottie, animacje). Trafiają do Twojego [Catalogue](/info/using.html), posortowane na sekcje i gotowe w selektorze zasobów każdego narzędzia. Wszystko pozostaje na tym urządzeniu. (Pasek boczny nazywa ten pokój **Files**; klucz URL pozostaje `catalogue`, ponieważ klucz panelu to trwały kontrakt.)

## Wprowadź markę

**Add from…** na dole paska bocznego otwiera dwuetapowy selektor. Pierwszy etap pyta, co *masz*, a nie w jakim jest to formacie:

- **Design tokens or a design file** - DTCG lub Tokens Studio JSON, projekt Penpot, **zip zestawów tokenów**, pakiet systemu projektowego Lolly lub SVG.
- **PDF** - prezentacja lub plik wytycznych, odczytywany na tym urządzeniu pod kątem kolorów, znaków i osadzonych krojów.
- **Image** - zrzut ekranu lub zdjęcie; jego kolory są odczytywane na tym urządzeniu i nic nie jest przesyłane.
- **Font file** - TTF, OTF lub WOFF. Otwiera pokój Type, w którym krój się instaluje.
- **Website** - jedna strona, odczytywana pod kątem kolorów i typografii. Ten kafelek pojawia się tylko na urządzeniu, które rzeczywiście potrafi odczytać stronę, bo wyłączony kafelek reklamujący coś, czego nikt nie może nacisnąć, jest gorszy niż brak kafelka. Tam, gdzie się pojawia, jasno nazywa swój sposób odczytu: pobrane przez aplikację na tym urządzeniu albo odczytane przez rozszerzenie przeglądarki w tle, jako zalogowany użytkownik. Podanie adresu URL tylko *wypełnia wstępnie* pole - przycisk pobrania jest zgodą, więc link przysłany przez kogoś innego nigdy sam nie rozpocznie odczytu.

Wybierz źródło pliku projektowego, a drugim etapem jest karta poniżej: akceptowane formaty prowadzą jako kafelki z ikonami w kolejności preferencji, a cała karta jest jednym obszarem upuszczania - kliknij w dowolne miejsce na niej albo przeciągnij na nią plik. Plik możesz też upuścić bezpośrednio na studio.

![Karta importu - akceptowane formaty prowadzą jako kafelki z ikonami, a cała karta jest jednym obszarem upuszczania](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

Co daje Ci każdy plik projektowy:

- pakiet **LollyBrand** (`.zip`) - instaluje się w jednym kroku;
- eksport **Penpot** (`.penpot`) - wciąga jego tokeny projektowe;
- plik **Design Tokens** (`.json`) - W3C DTCG;
- plik **Tokens Studio** (`.json`) - Tokens Studio;
- **zwykły SVG** (`.svg`) - Lolly skanuje jego kolory i pozwala wybrać, które zachować, przy czym pierwszy staje się Twoim kolorem primary.

Instalacja ze źródła najpierw tworzy **punkt kontrolny**, więc "cofnij do stanu sprzed importu" to jedno przywrócenie. A to, co znajdzie skan, nie trafia od razu do systemu: kandydaci lądują w **Tray**, gdzie każdy jest dodawany osobnym naciśnięciem, przez pokój odpowiedzialny za dany rodzaj materiału.

`#/start?source=<kind>` otwiera selektor na danym źródle (`file`, `pdf`, `image`, `font`, `url`), a `?import` otwiera go na zwykłej liście.

## Przenoszenie marki między urządzeniami

**Export** na dole paska bocznego zapisuje pojedynczy plik **`LollyBrand-…zip`** - Twoje tokeny, czcionki, logotypy i preferencję motywu, wraz z manifestem integralności, który jest weryfikowany przy ponownym wczytaniu. Obok, **Tokens (.json)** zapisuje sam dokument z tokenami projektowymi: bez czcionek, bez logotypów, tylko tokeny - to właśnie odczytuje repozytorium, krok CI albo inne narzędzie do tokenów.

Wczytanie marki z powrotem to **Add from… → Design tokens or a design file** (powyżej) albo przeciągnięcie i upuszczenie na studio. Tak kolega przekazuje Ci markę albo Ty przenosisz ją do drugiej instalacji - bez konta, bez chmury. Aby zamiast tego wprowadzić markę z wiersza poleceń, zobacz [`ingest:brand`](/info/configuration.html#brand-packs).

## Wersje

**Versions** u dołu paska to miejsce, w którym system projektowy przestaje być ruchomym celem. Opublikuj jedną i otrzymasz **trwałą, nazwaną kopię** przechowywaną na tym urządzeniu: później już się nie zmienia, więc narzędzie, które ją przypina, wciąż rysuje to samo. Panel pozostaje ukryty, dopóki nie ma niczego własnego do opublikowania, więc studio, które nigdy nie publikuje, nigdy nie widzi tych elementów sterujących.

Trzy rzeczy, które warto wiedzieć, zanim cokolwiek naciśniesz - i panel mówi o wszystkich trzech przed naciśnięciem, a nie po nim:

- **Wersja jest trwała.** Nie ma jeszcze usuwania, więc panel stwierdza, co zostało zachowane i że pozostaje zachowane, zamiast oferować przycisk, który kłamie.
- **Usunięcia prowadzą kartę zgodności.** Dodane i zmienione tokeny to nowości; ten *usunięty* jest tym, co psuje narzędzie, więc jest wymieniany jako pierwszy i nazywany po imieniu.
- **Publikacji nie można cofnąć; przywrócenia można.** *Restore latest from this version* to zwykła edycja głowy, więc trafia na stos cofania studia, a panel od razu oferuje Ci **Undo**.

Możesz **Publish only** albo **Publish and make active** - różnica polega na tym, czy narzędzia i aplikacja zaczynają odtąd podążać za tą wersją, czy nadal podążają za twoją najnowszą edycją. **Follow the latest again** sprawia, że każda edycja staje się aktywna w chwili jej wprowadzenia. `#/start?area=versions` otwiera panel bezpośrednio.

## Gdy marka jest ustalona na stałe

Niektóre kompilacje są dostarczane z **zablokowaną marką** - jej kolory, czcionki i tokeny są tym, czego używa każde narzędzie i każdy eksport, i nie ma nic do zmiany. W takim przypadku studio zastępuje krótka notatka wyjaśniająca, że ta kompilacja ma ustaloną markę, a edycja jest wyłączona. To celowe: w ten sposób organizacja gwarantuje, że wszystko pozostaje zgodne z marką.

## Dokąd dalej

- **[Using Lolly](/info/using.html)** - płótno, zapisywanie, projekty i katalog.
- **[Design Tokens](/info/design-tokens.html)** - model tokenów, w którym wyrażona jest twoja marka.
- **[Exporting & formats](/info/exporting.html)** - jednostki druku, CMYK i formaty, w których renderowana jest twoja marka.
