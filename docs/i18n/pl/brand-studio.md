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
- **Export** - zapisuje całą markę jako jeden plik `LollyBrand-….lolly`.
- **Tokens (.json)** - sam dokument tokenów projektowych, do repozytorium, kroku budowania lub innego narzędzia do tokenów.
- **Restore brand settings** - wróć do punktu kontrolnego zapisanego przed importem albo zastąpieniem ustawień marki.
- **Versions** - publikuj, aktywuj i przywracaj nazwane kopie systemu projektowego. Ukryte, dopóki nie ma nic własnego do opublikowania (albo link `?area=versions` nie poprosi o to po nazwie).

![Pasek pokoi studia - Overview, Colours, Type, Logos, Tokens i Files](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Overview

Overview to pierwszy pokój, i ma dwie twarze.

Przy **nic jeszcze nie wybrano** pokój pisze **Dostosuj do siebie**. **Zacznij od materiału referencyjnego** otwiera selektor źródeł dla logo, zrzutu ekranu, strony internetowej albo pliku projektowego. **Wybierz kolor**, **Wybierz krój** i **Dodaj logo** otwierają wprost swoje istniejące elementy sterujące. Każda ścieżka zaczyna się od wyboru; samo otwarcie niczego nie zapisuje. **Poznaj narzędzia** jest dostępne od razu.

Gdy cokolwiek jest już Twoje, ten sam pokój pokazuje **co masz**, z Twoimi licznikami na czele. Colours podaje liczbę kolorów, które niesie system projektowy, i dodaje przygaszone `· N starter` tylko tam, gdzie widać odziedziczone kolory; pasek obok układa najpierw kolory, które wybrałeś Ty, potem cienką linię i wyblakłe startowe. Type czyta według roli (*Inter dla nagłówków*, z *Starter dla reszty · SUSE, SUSE Mono* pod spodem). Logos podaje, ile slotów jest wypełnionych, albo **Nie ustawiono**. Tokens niesie promień zaokrąglenia, oznaczony jako *starter*, dopóki go nie przesuniesz. Files mówi **Jeszcze nic**, dopóki biblioteka jest pusta. Każdy blok to drzwi do swojego pokoju. Są tu liczniki, nigdy pasek postępu i nigdy karta ukończenia - w tym studiu nic nie jest należne.

## Logos

Zacznij od opróżnienia folderu ze znakami do strefy upuszczania u góry: **„Drop marks here, or choose several at once”** przyjmuje tyle plików, ile masz, za jednym razem. Każdy plik jest analizowany pod kątem kształtu i barwy, a następnie trafia do kolejki **Waiting for a slot** jako chip informujący, co system o nim sądzi - *„Looks like the Horizontal primary”*, wraz z pomiarem, na którym się oparł, oraz przyciskiem **Place** (**Replace**, gdy dany slot jest już zajęty). Tam, gdzie system nie jest pewny, chip mówi to wprost i zamiast tego oferuje **Change slot**, listujące wszystkie osiem. Nic nie zostaje umieszczone, dopóki czegoś nie naciśniesz.

Wokół tej kolejki dzieją się dwie rzeczy. Znak z nadmiarowym pustym marginesem najpierw otrzymuje **propozycję przycięcia** - odpowiedz na nią lub naciśnij Escape, a oryginalny plik zostanie wprowadzony bez zmian. A tam, gdzie dany znak może wypełnić pusty slot bliźniaczy, pokój oferuje wyprowadzoną wersję **mono** lub **reverse** jako osobny chip, oznaczony *Generated*, który znika ponownie, jeśli wypełnisz ten slot w inny sposób.

Poniżej znajduje się siatka, w której ląduje każdy znak - sloty **orientacja × wariant**:

- **Orientacje:** Horizontal (logotyp + symbol w rzędzie) i Vertical (ułożone pionowo, do przestrzeni kwadratowych i wysokich).
- **Warianty:** Primary, Primary reverse (do ciemnych teł), Mono (jeden kolor) i Mono reverse.

To osiem opcjonalnych slotów. Kliknij slot, aby dodać PNG, SVG, JPEG lub WebP; kliknij wypełniony slot, aby go zastąpić. Każdy slot jest opcjonalny i wszystko pozostaje na tym urządzeniu.

![Macierz logo - każda orientacja u góry, każdy wariant jako osobny przerywany slot, wszystkie opcjonalne](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** - dodaj znaki, które Twoja marka nazywa po swojemu (ikonę, godło, favicon) w sekcji **Custom marks**; nadaj nazwę i wybierz plik.
- **More identities** - submarka, produkt lub wydarzenie mogą mieć własny, pełny zestaw logotypów. Użyj **+ Dodaj kolejne logo** i nadaj nazwę; Twój główny zestaw to po prostu "Your logo".
- **Upload an SVG and Lolly reads its colours.** Na zupełnie nowej instalacji Lolly po cichu ustawia Twój kolor podstawowy z logo i informuje o tym. W istniejącej marce zamiast tego oferuje ten kolor jako sugestię - *"Found in the logo: #…"* z przyciskiem **Użyj jako główny** obok - w pokoju Colours, gdzie możesz ją przyjąć lub odrzucić.

## Colours

Pokój rośnie razem z systemem projektowym. Na stronie nie ma niczego, czego jeszcze nie potrzebowałeś, więc pierwsza wizyta to jedna decyzja, a reszta przychodzi wraz z paletą.

### Pierwszy kolor

System projektowy bez własnych kolorów otwiera się na jednej wyśrodkowanej kolumnie: **Zacznij od jednego koloru**, duży żywy chip, pole i cicha linijka mówiąca, że role, odcienie i ustawienia druku pojawią się w miarę rozwoju systemu.

- **Chip to selektor koloru.** Naciśnij go, a na chipie otwiera się własna karta OKLCH studia, wypełniona wstępnie tym, co trzyma pole: nazwa, koło, cztery pokrętła, alfa i **Zapisane jako**, z **Anuluj** i **Dodaj kolor** na dole. Przeciąganie pokrętła maluje chip i przepisuje pole na bieżąco, a nic nie trafia do systemu projektowego, dopóki nie naciśniesz **Dodaj kolor**.
- **Pole przyjmuje dowolną notację** - `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` albo zwykłą nazwę koloru - a cała *lista* kolorów staje się rzędem chipów, które dodajesz jeden po drugim.
- **Obok są jeszcze dwoje drzwi.** Zakraplacz (na przeglądarce, która go ma) pobiera kolor z ekranu, a **Z obrazu** odczytuje zrzut ekranu albo zdjęcie na tym urządzeniu i oferuje znalezione w nim kolory.
- **Add nigdy nie jest wyłączony.** Gdy w polu nie ma nic czytelnego, otwiera selektor koloru, co zwykle oznacza puste naciśnięcie; tekst, którego nie potrafi rozpoznać, dostaje pod polem linijkę mówiącą o tym, zamiast martwego przycisku.

Pierwszy kolor staje się **podstawowym**, a chip, który odpowiada na dodanie, mówi o tym - *"Primary is now Vivid Violet"* - z **Dostrój** obok.

![Pokój Colours z niczym jeszcze niewybranym - jeden duży żywy chip, jedno pole i jedna linijka o tym, co pojawi się później](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Starter

**Starter** to słowo na wszystko, co przyszło z aplikacją, zamiast zostać wybrane. Świeża instalacja nie niesie żadnego koloru: ma tylko jedną neutralną rampę, atrament na papierze, dzięki czemu powierzchnie, tekst i cienkie linie renderują się, zanim ktokolwiek cokolwiek zdecyduje. Te neutralne są rusztowaniem, więc nie są liczone jako kolory i nie są rysowane w panelu palety. Mieszkają w pokoju [Tokens](#tokens) jako **Neutralne · startowe · 9**, z **Otwórz**, które pokazuje je w panelu Colours jako jedną zwiniętą, oznaczoną grupę (`#/start?area=color&group=neutral`).

To samo słowo przewija się przez każdy pokój: rola stojąca na startowym kolorze brzmi *"Starter Paper stands in"*, a jej selektor oferuje **Wybierz…**; startowy krój nosi znacznik **Starter** i żadnego zabarwienia; startowy promień zaokrąglenia jest oznaczony na Overview. Odziedziczony materiał nigdy nie jest rysowany przerywaną ramką, bo przerywana ramka oznacza tu miejsce upuszczenia.

### W miarę jak paleta rośnie

Twoje kolory zostają obok podglądu **In context** na szerokim ekranie, a na mniejszych ekranach układają się nad nim. Podgląd może pokazać plakat, wykres albo kartę interfejsu z użyciem Twojej palety. Startowe kolory zostają we własnej zwijalnej grupie, oddzielonej od kolorów, które dodajesz.

Dodawaj pojedyncze kolory albo zestaw odcieni, przypisuj im role i otwieraj zaawansowane sekcje, kiedy ich potrzebujesz. Wykres kolorów, gradienty i elementy sterujące pobierania zostają przy palecie.

![Pokój Colours po dodaniu jednego koloru, z jego paletą i żywym podglądem kompozycji](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Role - co odczytują narzędzia

**Role** to warstwa nałożona na próbki: który kolor pełni jaką część w każdym narzędziu i eksporcie. Role są opcjonalne (system projektowy z trzech luźnych kolorów i bez ról jest jak najbardziej dobry), dowolna próbka może przyjąć rolę, a odczyt kontrastu jest mierzony względem tła, najpierw według APCA.

Wiersz odczytuje się w jednym z trzech rejestrów, więc pasek nigdy nie twierdzi, że zapadła decyzja, której nikt nie podjął:

- własny kolor pełniący rolę, w pełnej sile;
- **Starter *Paper* zastępuje** - przygaszony, z **Wybierz…** na swoim selektorze;
- **↳ podąża za Podstawowym** - rola rozwiązuje się przez podstawowy kolor, zamiast mieć własny.

Gdy paleta ma już odcienie, pasek rozrasta się do wszystkich siedmiu slotów, które narzędzie potrafi odczytać: Primary, Secondary, Surface, Text, Muted, Edge i On primary. On primary jest wyprowadzony z podstawowego koloru, czyta się jako **Wyprowadzony** i nie ma własnego selektora.

**Własny akcent aplikacji jest preferencją, nie tokenem.** Domyślnie interfejs stosuje się do systemu projektowego, a akcent chrome przejmuje kolor podstawowy. To ustawienie Wyglądu na [Twoim profilu](/info/profile.html) - **Interfejs stosuje się do systemu projektowego** - a wyłączenie go zostawia chrome neutralny. Narzędzia, płótna i eksporty nie są tym dotknięte w żadnym wypadku, a fonty i promień zaokrąglenia stosują się do systemu projektowego niezależnie od tego, czy ustawienie jest włączone czy wyłączone.

### Skrzydła dla ekspertów

Pod podglądem kompozycji i rolami kolorów znajdują się cztery zwinięte sekcje. Otwórz tę, której potrzebujesz; każda ma bezpośredni link jako `#/start?area=color&focus=<wing>`, który ją otwiera bez względu na to, co pokój akurat pokazuje:

- **Explore shades & harmonies** (`focus=generate`) - jeden kolor przekształcony w pełny zestaw odcieni. Opisane poniżej.
- **Shade curves** (`focus=curves`) - przekształcaj rampę punkt po punkcie. Jasność, chroma i odcień mają własne krzywe, przełączane przez L / C / H, a odcienie poniżej przeliczają się na żywo podczas przeciągania.
- **Contrast** (`focus=contrast`) - **Blokada kontrastu** przestraja rampę tak, by osiągnąć docelowe wartości APCA względem wybranego tła, przy czym każdy krok zachowuje własny odcień i chromę; **Obróć odcień** obraca całą rampę wokół koła barw, a każdy odcień zachowuje swoją jasność i chromę.
- **Print** (`focus=print`) - czym kolor podstawowy staje się na druku: jego automatyczna wartość ekranowa, przypięta konwersja CMYK albo nazwany kolor spot.

### Jeden kolor, cała paleta

Wewnątrz **Explore shades & harmonies** wybierz **Starting colour**. Lolly sugeruje pasujące odcienie, używając tej samej percepcyjnej matematyki kolorów (OKLCH), z której silnik korzysta gdzie indziej. Dostrój sugestie:

- **Scheme** - Mono, Complement, Analogous lub Triad - ustala, jak kolor drugorzędny odnosi się do koloru podstawowego.
- **Shades** - suwak od 3 do 20 (domyślnie 5) kontroluje, ile kroków generuje każda rampa.
- **Fine-tune** (zwinięte) - **UI intensity** (Muted / Deep), **Contrast** (Comfort / High) i **Text on brand** (Auto / Light / Dark).

Zmiana koloru początkowego i elementów sterujących zmienia tylko sugestie. Kliknij odcień, aby dodać ten kolor, albo **Dodaj 5 odcieni**, aby dodać całą grupę (liczba zależy od Twojego ustawienia Shades). Istniejące kolory i role zostają na miejscu. **Wycofaj** usuwa dodanie.

Wiersze **Primary**, **Neutral** i **Secondary** pokazują sugerowane odcienie. Otwórz **Theme preview**, aby sprawdzić jasne i ciemne przykłady oraz ich odczyty kontrastu. Wybierz tam krok Neutral albo Secondary, aby dostosować proponowane kotwice motywu. Przebudowa całej palety pozostaje osobną, sprawdzaną czynnością poniżej.

![Trzy sugerowane grupy odcieni, z osobnymi elementami sterującymi dodawania i osobnym Theme preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Zbuduj swoją paletę (generator harmonii)

W **Find matching colours** generator harmonii sugeruje pasujące kolory akcentów na podstawie koloru podstawowego. Wybierz **Harmony** - **Complementary**, **Adjacent**, **Triad**, **Tetrad** lub **Analogous** (co dodaje własną liczbę **Accents**, od 2 do 5, oraz kąt odcienia **Angle** od 10° do 45°) - a każdy kandydat pojawia się z automatycznie wygenerowaną, czytelną nazwą i przyciskiem **+ Dodaj**. Dodanie koloru od razu umieszcza go w palecie, jedno naciśnięcie na jeden token. **In context** pokazuje podgląd Twoich dodanych kolorów na przykładowych kompozycjach.

![Wygenerowane akcenty, każdy z próbką koloru, automatycznie wygenerowaną nazwą, kodem hex i przyciskiem Add](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Zatwierdzanie wygenerowanej palety

Dodanie sugerowanego koloru albo grupy odcieni zachowuje resztę Twojej palety. Aby zastąpić ją całkowicie, otwórz **Rebuild the whole palette…** i naciśnij **Preview full rebuild**. Podgląd wyjaśnia zmiany: ile ról zostaje przypisanych tak, jak je ustawiłeś, ile dodanych przez Ciebie kolorów zostaje zachowanych, ile krzywych odcieni zostaje ponownie zakotwiczonych, ile blokad druku zostaje ponownie przypiętych, ile ukrytych odcieni pozostaje ukrytych, ile przystanków gradientu zachowuje swój kolor.

**Apply rebuilt palette** na tej karcie zatwierdza zmianę; **Anuluj** wycofuje się i niczego nie zmienia. Po wykonaniu karta oferuje **Wycofaj**, od razu zaznaczone - a punkt kontrolny całego systemu projektowego jest tworzony *przed* zamianą, więc "przywróć jak było" to przywrócenie z kopii, a nie stracone popołudnie.

### Paleta, wykres i każda próbka koloru

Paleta wymienia kolory systemu projektowego w zwijalnych grupach, każda z własnym elementem **+ Add**. Twórz i zmieniaj nazwy grup, aby zorganizować swoją pracę. Rola nigdy nie tworzy drugiego kafelka: jeden token to jeden kafelek, a kafelek, na który wskazuje rola, nosi zamiast tego mały znacznik w rogu (**P**, **S**, **Su**, **T**). Pod kafelkami **Colour chart** rozwija się w dwa widoki tych samych próbek: **Wheel** (koło OKLCH - przeciągnij kropkę, by zmienić jej kolor, kliknij kropkę, by ją edytować, lub kliknij puste miejsce, by dodać nową próbkę) oraz wykres **Gamut**, który pokazuje, gdzie faktycznie kończy się zakres możliwy do wyświetlenia. `#/start?area=color&focus=chart` otwiera tę kartę bezpośrednio, tak jak zawsze robi to `?wheel`.

![Panel palety, każda grupa zwijalna, z pigułką pobierania umieszczoną przy dolnej krawędzi](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Koło OKLCH - kąt to odcień, odległość od środka to nasycenie, a szarości poruszają się po pasku jasności z boku](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

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

### Praca z wieloma próbkami

Każda próbka ma osobny uchwyt do przeciągania. Przeciągnij go, aby zmienić kolejność kolorów w obrębie grupy, albo zaznacz go, naciśnij spację, użyj strzałek i naciśnij spację ponownie, aby upuścić. Escape anuluje. Kolejność przetrwa ponowne otwarcie studia i można ją cofnąć. Aby przenieść kolory między grupami, użyj elementu **Group** w edytorze próbki albo zaznacz kilka kolorów i użyj **Move**. Nazwy tokenów i odwołania do ról pozostają nienaruszone.

Zaznaczanie w panelu palety to gest, nie tryb. Nie ma przycisku, który trzeba nacisnąć jako pierwszy, a pasek pojawia się wraz z pierwszym zaznaczonym kafelkiem i znika wraz z ostatnim.

- **Przeciągnij po pustym miejscu panelu**, aby narysować prostokąt: każdy kafelek, którego dotknie, dołącza do zaznaczenia, niezależnie od granic grup. Zwinięta sekcja nie wnosi nic, a przeciągnięcie, które nigdzie się nie porusza, czyści zaznaczenie.
- **Shift-klik** bierze zakres w kolejności czytania; **Cmd/Ctrl-klik** przełącza jeden kafelek; zwykłe kliknięcie nadal otwiera edytor tego kafelka.
- Każdy nagłówek grupy nosi **Select all**, a **Cmd-A** z zaznaczonym kafelkiem bierze każdy kolor należący do systemu projektowego - nigdy startowy.
- Siatka ma jeden przystanek tabulacji. Strzałki ją przemierzają, Shift-strzałki rozszerzają zaznaczenie, spacja przełącza kafelek, Delete usuwa zaznaczenie, a Escape je czyści. (Strzałki tylko przesuwają fokus: aby dostroić kanał, naciśnij najpierw `l`, `c` albo `h`, zgodnie z odczytem.)
- Na ekranie dotykowym nie ma prostokąta. Naciśnij i przytrzymaj kafelek, aby rozpocząć zaznaczanie, potem stukaj, aby dodawać; **Select all** dla danej grupy niesie resztę.

Sam pasek pokazuje **Wybrano {n}**, potem **Przenieś do** (istniejącej grupy albo nowej, którą nazwiesz w menu), **Nadaj rolę** (każdy zaznaczony kolor po kolei przejmuje następną rolę, więc cztery kafelki wypełniają wszystkie cztery role jednym naciśnięciem), **Pobierz** (zaznaczenie w dowolnym z sześciu formatów palety), **Kopiuj wartości** (jedna linijka na kolor w jego zapisanej notacji) i **Usuń**. Przenieś do i Nadaj rolę pojawiają się, gdy paleta ma już odcienie do przenoszenia. Jedno Ctrl/Cmd-Z cofa całą zbiorczą akcję - przeniesienie czterdziestu, przejście przez role, usunięcie - a usunięcie mówi, co zachowało, ponieważ zaznaczenie obejmuje też kafelki, których ten pokój nie usuwa.

### Gradienty

Opcjonalny panel **Gradients** tworzy tokeny przejść z Twojej palety dla teł i akcentów. Pomiń go całkowicie, jeśli Twoja marka nie używa gradientów. Każdy gradient ma podgląd, nazwane przystanki (2–8) i kąt. Kluczowe zachowanie: **przystanek odwołuje się do próbki koloru**, więc zmiana koloru tej próbki zmienia też gradient. Interpolacja odbywa się w OKLCH, co daje czyste przejścia. Usuń przystanek, aby skrócić przebieg.

### Zabierz paletę gdzie indziej

Pływająca pigułka umieszczona przy dolnej krawędzi panelu palety pozwala pobrać całą paletę jako **Design tokens (JSON)**, **CSS variables**, **CSS classes**, **SCSS variables**, **GIMP palette (.gpl)** lub **Adobe Swatch Exchange (.ase)** - dzięki temu marka trafia od razu do Illustratora, Figmy, GIMP-a lub arkusza stylów. Znajduje się poza obszarem przewijania panelu, więc zachowuje swoje miejsce niezależnie od tego, jak daleko przewinięta jest paleta, i pojawia się, gdy paleta ma już odcienie. (Paletę można też pobrać z [Zasobów](/info/using.html#assets-your-library).)

## Typografia

Ten pokój rośnie w ten sam sposób. Bez własnego kroju to jedna karta i jedna decyzja: **Primary**, ustawiony w rozmiarze czytelnym w kroju, który obsługuje go dzisiaj, znacznik **Starter** obok nazwy, wypełnione **Wybierz krój** i linijka "Nothing installs until you choose one." Pod kartą znajduje się "Headings, code and italic follow the primary until you choose them", z **Wybierz je osobno**, które na resztę wizyty odsłania pozostałe trzy karty.

![Pokój Type z jeszcze niewybranym krojem - jedna karta w rozmiarze czytelnym, ze znacznikiem Starter, i jedno wypełnione Choose a face](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Wybierz jeden krój, a pokój otwiera się w **cztery karty ról**, listę Fonts i żywy wzorzec. Te cztery kroje to te, które faktycznie odczytuje aplikacja, Twoje narzędzia i każdy eksport:

- **Primary** - treść, przyciski i każde narzędzie.
- **Headings** - krój wyświetlnikowy dla `h1`/`h2`.
- **Code** - krój o stałej szerokości dla kodu i danych.
- **Italic** - prawdziwy kursywny towarzysz do wyróżnień, cytatów i dygresji.

Headings, code i italic domyślnie sięgają do kroju primary, dopóki ich nie przypiszesz, więc system projektowy z jednym krojem nie wymaga tu żadnych decyzji.

**Zabarwienie oznacza, że go wybrałeś.** Karta jest zabarwiona tylko tam, gdzie zainstalowałeś dany krój. Startowy krój nosi ten sam znacznik **Starter**, jaki noszą odziedziczone grupy palety, w przygaszonym rejestrze i bez zabarwienia, a rola, której nikt nie wybrał, brzmi **↳ podąża za Podstawowym**, zamiast powtarzać nazwę podstawowego, jakby została wybrana. Przycisk mówi **Change** na Twoim własnym kroju i **Choose a face** wszędzie indziej. Nic na karcie niczego nie zatwierdza: przycisk otwiera **etap porównania** ograniczony do tej roli.

![Odsłonięte cztery karty ról - każda złożona w kroju, który ją obsługuje, ze znacznikiem Starter tam, gdzie nikt nie wybrał, i Italic podążającym za primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Etap porównania

![Etap porównania otwarty pod swoją kartą, z wierszem wyszukiwania, przypiętymi rodzinami i kartami zwiniętymi do jednowierszowego paska](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

Etap otwiera się **w tym samym pokoju**, a nie w oknie dialogowym, i wprost pod kartą, którą nacisnąłeś. Gdy jest otwarty, karty zwijają się do jednowierszowego paska roli i kroju, więc etap jest na pierwszym ekranie nawet na telefonie. Escape anuluje i oddaje klawiaturę karcie, z której go otworzono.

Wybór kroju to trzy naciśnięcia:

1. **Choose a face** na karcie.
2. Wpisz nazwę rodziny i naciśnij **Podgląd** - albo naciśnij jedną z sześciu **przypiętych** rodzin pod polem, jedno naciśnięcie na każdą. Karta pojawia się już jakby się ładowała, ze szkieletowym paskiem tam, gdzie będzie wzorzec, zamiast kroju interfejsu zastępującego krój, którego jeszcze nie widziałeś.
3. **Użyj tego kroju**.

**Zgoda jest pytana raz, przy naciśnięciu, które wykonałeś.** Gdy podgląd po raz pierwszy sięga do Google Fonts, okno mówi, co się stanie: *Google poznaje nazwę rodziny i Twój adres IP. Plik zostaje potem na tym urządzeniu i jest używany offline. To jedyny krok w studiu, który sięga do strony trzeciej.* **Pobierz z Google** kontynuuje i zostaje zapamiętane. **Anuluj** zostawia kartę mówiącą "Not fetched. Nothing was sent to Google." z własnym, żywym **Pobierz z Google**, więc zmiana zdania to jedno naciśnięcie na samej karcie. Żadna karta nigdy nie pokazuje martwego przycisku: w jakimkolwiek jest stanie, jej jeden główny przycisk mówi, jaki jest następny krok.

**Upuść plik czcionki na etapie** i od razu widać podgląd - **TTF**, **OTF** albo **WOFF** z własnego urządzenia, co jest ścieżką dla licencjonowanego kroju firmowego, który już posiadasz. Ta strefa upuszczania to jedyne drzwi dla pliku w tym pokoju.

Tak czy inaczej krój pozostaje na tym urządzeniu, renderuje się w aplikacji, w Twoich narzędziach i w każdym eksporcie, na zawsze działa offline i podróżuje w pliku systemu projektowego - nic nie jest pobierane w momencie renderowania. Wszystko na Google Fonts jest udostępniane na otwartej licencji (OFL/Apache/UFL).

### Fonty na tym urządzeniu

Panel **Fonts** wymienia każdy krój, który ma to urządzenie, i rolę, której służy. Kroje, które dodałeś, prowadzą pod **In the design system**, każdy ze swoimi rolami i usuwaniem, a ten, który obsługuje Primary, nosi odznakę. Startowe kroje następują w jednym zwiniętym wierszu - *Starter · SUSE, SUSE Mono · obsługuje Primary i Code, dopóki nie wybierzesz* - przygaszone, bez usuwania i bez niczego do awansowania, bo żadne z nich nie jest decyzją, którą ktokolwiek podjął. **Add a face** otwiera ten sam etap porównania, tym razem bez ograniczenia.

Panel **Type roles** na dole pokazuje żywy wzorzec każdej roli - treść i UI w kroju primary, opcjonalny krój wyświetlnikowy dla nagłówków górnych, kursywę do wyróżnień, krój mono do kodu i danych - z rodziną i jej stanem obok każdej (*Inter*, *SUSE · starter*, *SUSE · podąża za Primary*), dzięki czemu widać cały zestaw naraz.

## Tokeny

Reszta systemu projektowego, edytowalna bez dotykania kodu:

![Pokój Tokens - suwak promienia zaokrąglenia rogów oraz odstępy, rozmiary, cienie i reszta systemu](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Zaokrąglone rogi** - pojedynczy suwak promienia (0–1.5rem), za którym podążają karty, przyciski i panele w całej aplikacji.
- **Neutralne** - rampa atramentu na papierze, z którą dostarczana jest świeża instalacja, wymieniona jako **Neutralne · startowe · 9** z jej dziewięcioma krokami i **Otwórz** do panelu Colours. To jedyne miejsce, w którym zarządza się startowymi neutralnymi kolorami, a znacznik *starter* znika w chwili, gdy rampa jest wygenerowana, a nie odziedziczona.
- **More tokens** - dodawaj i edytuj **spacing**, **sizing**, **stroke width**, **opacity**, **rotation**, zwykłe **numbers** i **shadows**. Wybierz typ, nadaj mu nazwę (*Gutter, Card shadow…*) i ustaw wartość. Są one zapisywane jako standardowe [tokeny projektowe](/info/design-tokens.html) (DTCG) i podróżują razem z Twoją marką.

## Pliki

Upuść tutaj pliki, które przechowuje Twoja marka - poza logotypami: zasoby **vector**, **image**, **audio** i **motion** (wideo, Lottie, animacje). Trafiają do [Zasobów](/info/using.html#assets-your-library), posortowane na sekcje i gotowe w selektorze zasobów każdego narzędzia. Wszystko pozostaje na tym urządzeniu. (Pasek boczny nazywa ten pokój **Files**; klucz URL pozostaje `catalogue`, ponieważ klucz panelu to trwały kontrakt.)

## Wprowadź markę

**Add from…** na dole paska bocznego otwiera dwuetapowy selektor. Pierwszy etap pyta, co *masz*, a nie w jakim jest to formacie:

- **Design tokens or a design file** - DTCG lub Tokens Studio JSON, projekt Penpot, **zip zestawów tokenów**, pakiet systemu projektowego Lolly lub SVG.
- **PDF** - prezentacja lub plik wytycznych, odczytywany na tym urządzeniu pod kątem kolorów, znaków i osadzonych krojów.
- **Logo or screenshot** - obraz staje się sugerowaną paletą, odczytywaną na tym urządzeniu. Nic nie jest przesyłane. To odczytuje kolory, nie krój ani układ na obrazie.
- **Saved web page** - wybierz jeden plik HTML i jego pliki CSS, albo wklej HTML lub CSS. Do 20 plików i 2 MB łącznie. Odczytywany jest tylko dostarczony tekst; powiązane zasoby nie są pobierane, a skrypty się nie uruchamiają. Ta ścieżka działa też bez rozszerzenia albo aplikacji desktopowej.
- **Font file** - TTF, OTF lub WOFF. Otwiera pokój Type, w którym krój się instaluje.
- **Website** - jedna strona, odczytywana pod kątem kolorów i typografii. Ten kafelek pojawia się tylko na urządzeniu, które rzeczywiście potrafi odczytać stronę, bo wyłączony kafelek reklamujący coś, czego nikt nie może nacisnąć, jest gorszy niż brak kafelka. Tam, gdzie się pojawia, jasno mówi, którego czytnika używa: pobrane przez aplikację na tym urządzeniu albo odczytane przez rozszerzenie przeglądarki w tle, jako zalogowany użytkownik. Podanie adresu URL tylko *wypełnia wstępnie* pole - przycisk pobrania jest zgodą, więc link przysłany przez kogoś innego nigdy sam nie rozpocznie odczytu.

Wybierz źródło pliku projektowego, a drugim etapem jest karta poniżej: akceptowane formaty prowadzą jako kafelki z ikonami w kolejności preferencji, a cała karta jest jednym obszarem upuszczania - kliknij w dowolne miejsce na niej albo przeciągnij na nią plik. Plik możesz też upuścić bezpośrednio na studio.

![Karta importu - akceptowane formaty prowadzą jako kafelki z ikonami, a cała karta jest jednym obszarem upuszczania](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

Co daje Ci każdy plik projektowy:

- pakiet **systemu projektowego Lolly** (`.lolly`; starszy `.zip` jest nadal akceptowany) - instaluje się w jednym kroku;
- eksport **Penpot** (`.penpot`) - wciąga jego tokeny projektowe;
- plik **Design Tokens** (`.json`) - W3C DTCG;
- plik **Tokens Studio** (`.json`) - Tokens Studio;
- **zwykły SVG** (`.svg`) - Lolly skanuje jego kolory i pozwala wybrać, które zachować, przy czym pierwszy staje się Twoim kolorem primary.

Logo/zrzut ekranu, strona internetowa albo zapisana strona otwiera **Sugerowany system projektowy**. Zobacz przykład z zaproponowanymi kolorami, wybierz inny **Główny kolor**, jeśli trzeba, i nadaj systemowi nazwę. **Użyj tego systemu projektowego** stosuje wygenerowane jasne i ciemne palety i wraca do Overview. Istniejące fonty zostają na miejscu. To zastępuje kolory aktywnego systemu i inne ustawienia tokenów. Punkt kontrolny musi się najpierw powieść; **Przywróć ustawienia marki** przywraca poprzednie ustawienia.

**Source details and individual choices** pokazuje, co zostało odczytane, wykryte nazwy fontów i kontrast tekstu/akcji w podglądzie. Oferuje też **Wybierz poszczególne elementy z listy** i **Pobierz kontekst projektowy**. Raport JSON niesie obserwacje, proponowane tokeny i informacje o źródle; zapisane HTML/CSS zawiera SHA-256 dostarczonego tekstu. Nie zawiera surowego tekstu strony i nie jest podpisanym Content Credential. Nazwy fontów to sugestie: Type pozostaje miejscem, w którym wybiera się i instaluje fonty.

Import PDF i innych plików projektowych zachowuje swoje dotychczasowe elementy kontrolne. Elementy przechowywane w **Tray** niczego nie zmieniają, dopóki nie zostaną dodane przez pokój odpowiedzialny za dany rodzaj materiału.

`#/start?source=<kind>` otwiera selektor na danym źródle (`file`, `pdf`, `image`, `font`, `url`, `page`), a `?import` otwiera go na zwykłej liście.

## Przenoszenie marki między urządzeniami

**Export** na dole paska zapisuje pojedynczy plik **`LollyBrand-….lolly`** - Twoje tokeny, czcionki, logotypy i preferencję motywu, wraz z manifestem integralności, który jest weryfikowany przy ponownym wczytaniu. Wydania webowe sprzed 1.0.7 nazywały ten sam ładunek `.zip`; ten starszy zapis jest nadal akceptowany. Obok, **Tokens (.json)** zapisuje sam dokument z tokenami projektowymi: bez czcionek, bez logotypów, tylko tokeny - to właśnie odczytuje repozytorium, krok CI albo inne narzędzie do tokenów.

Wczytanie marki z powrotem to **Add from… → Design tokens or a design file** (powyżej) albo przeciągnięcie i upuszczenie na studio. Tak kolega przekazuje Ci markę albo Ty przenosisz ją do drugiej instalacji - bez konta, bez chmury. Aby zamiast tego wprowadzić markę z wiersza poleceń, zobacz [`ingest:brand`](/info/configuration.html#brand-packs).

## Przywróć wcześniejsze ustawienia

Wybierz **Przywróć ustawienia marki** na dole paska, wybierz datowany punkt kontrolny, a potem naciśnij **Przywróć**. Przywraca kolory, ustawienia typografii i inne tokeny marki dla aktywnej marki. Pliki czcionek i obrazów zostają, jakie są.

Lolly zapisuje Twoje bieżące ustawienia jako **Before restore**, zanim zastosuje punkt kontrolny. Wybierz ten punkt kontrolny, aby cofnąć przywrócenie, także po zamknięciu i ponownym otwarciu przeglądarki. Ostatnie 20 punktów kontrolnych jest przechowywanych na tym urządzeniu. Jeśli pamięci nie da się odczytać albo bieżących ustawień nie da się zapisać, okno zgłasza problem, abyś mógł spróbować ponownie.

## Wersje

**Versions** u dołu paska to miejsce, w którym system projektowy przestaje być ruchomym celem. Opublikuj jedną i otrzymasz **trwałą, nazwaną kopię** przechowywaną na tym urządzeniu: później już się nie zmienia, więc narzędzie, które ją przypina, wciąż rysuje to samo. Panel pozostaje ukryty, dopóki nie ma niczego własnego do opublikowania, więc studio, które nigdy nie publikuje, nigdy nie widzi tych elementów sterujących.

Trzy rzeczy, które warto wiedzieć, zanim cokolwiek naciśniesz - i panel mówi o wszystkich trzech przed naciśnięciem, a nie po nim:

- **Wersja jest trwała.** Nie ma jeszcze usuwania, więc panel stwierdza, co zostało zachowane i że pozostaje zachowane, zamiast oferować przycisk, który kłamie.
- **Usunięcia prowadzą kartę zgodności.** Dodane i zmienione tokeny to nowości; ten *usunięty* jest tym, co psuje narzędzie, więc jest wymieniany jako pierwszy i nazywany po imieniu.
- **Publikacji nie można cofnąć; przywrócenia można.** *Restore latest from this version* to zwykła edycja głowy, więc trafia na stos cofania studia, a panel od razu oferuje Ci **Undo**.

Możesz **Publish only** albo **Publish and make active** - różnica polega na tym, czy narzędzia i aplikacja zaczynają odtąd podążać za tą wersją, czy nadal podążają za twoją najnowszą edycją. **Follow the latest again** sprawia, że każda edycja staje się aktywna w chwili jej wprowadzenia. `#/start?area=versions` otwiera panel bezpośrednio.

## Gdy marka jest ustalona na stałe

Niektóre kompilacje dostarczają **zablokowany system projektowy**, taki jak SUSE Brand. Jego otwarcie pokazuje notatkę tylko do odczytu z **Make an editable copy** i **Switch**. Jego oryginalne kolory, fonty i tokeny zostają nienaruszone. Twoje własne lokalne systemy pozostają edytowalne, nawet gdy zablokowany system był pierwszym na urządzeniu. W Profile **Otwórz** wybiera system i otwiera jego studio; **Make a new one** tworzy lokalny system i otwiera go w `#/start` z zaznaczonym polem nazwy.

## Dokąd dalej

- **[Using Lolly](/info/using.html)** - płótno, zapisywanie, projekty i Zasoby.
- **[Design Tokens](/info/design-tokens.html)** - model tokenów, w którym wyrażona jest twoja marka.
- **[Exporting & formats](/info/exporting.html)** - jednostki druku, CMYK i formaty, w których renderowana jest twoja marka.


## Znajdź i porównaj wygląd

Otwórz **Znajdź styl** z Overview albo listy systemów projektowych w Profile. Przeglądaj systemy zapisane na tym urządzeniu i kilka gotowych do ponownego użycia przykładów Lolly. Szukaj po nazwie, etykiecie koloru albo zadeklarowanym foncie. **Najbliższa mojej obecnej palecie** sortuje według zmierzonego podobieństwa kolorów, a pasujące rodziny fontów rozstrzygają remisy; to nie jest ocena jakości.

Zaznacz jeden wygląd, aby go sprawdzić, albo dwa, aby porównać. Przycisk podglądu pozostaje dostępny na małym ekranie. Zaznaczenie wyglądu niczego nie zmienia. **Use this saved system** przełącza przez istniejący rejestr systemów projektowych. **Użyj tych kolorów** stosuje przykład przez zwykły proces punktu kontrolnego i instalacji, zachowując bieżące fonty. **Przywróć ustawienia marki** może przywrócić poprzedni wygląd.

Pod **Szczegóły i kontekst projektowy** zapisane systemy mają edytowalne **Szukaj etykiet** i pobieranie kontekstu. Przykłady używają oryginalnych receptur kolorów Lolly; nie ma żadnej zdalnie zebranej kolekcji inspiracji ani wymaganego konta.

![Porównaj Sunroom i Orchard obok siebie, zanim zastosujesz którykolwiek z systemów kolorów.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

Porównanie utrzymuje obie palety widoczne razem. Podgląd wyglądu niczego nie zmienia, dopóki nie wybierzesz **Użyj tych kolorów** albo **Use this saved system**.

## Odczytaj dowody źródłowe

Opcjonalne szczegóły przeglądu źródła pokazują typografię, odstępy, wypełnienie i wartości rogów tam, gdzie zostały zaobserwowane. Zapisane HTML/CSS i natywne odczyty strony internetowej zgłaszają deklaracje, których renderowana strona może nie używać. Rozszerzenie przeglądarki może zgłaszać zmierzone style z ograniczonej próbki widocznych elementów, wraz z jego viewportem i preferencją koloru przeglądarki. Starsze rozszerzenia nadal działają z deklarowanymi stylami. Brakujące pola mówią **Nie obserwowano**.

To są obserwacje, nie automatyczne ustawienia stylu. Pliki czcionek nie są pobierane ani instalowane przez skan referencyjny, a odstępy ze źródła po cichu nie zastępują Twoich własnych. Liczby opisują wystąpienia w próbce, nie pewność ani jakość.

## Sprawdź kompozycję względem systemu projektowego

W Design otwórz **Export**, potem **Przed eksportem**. Kontrola używa tej samej obowiązującej wersji systemu projektowego co render. Porównuje autorskie kolory, aliasy tokenów, wybory fontów i ID zasobów obrazów. Niestandardowe wartości mogą być zamierzone; obraz spoza zadeklarowanych zasobów marki to pozycja do przeglądu, nie zabroniony obraz.

Tam, gdzie dostępna jest konkretna sugestia koloru albo fontu, jej przycisk zmienia tylko tę jedną warstwę. Zwykłe **Wycofaj** przywraca oryginalną wartość. Zablokowane albo zmienione warstwy nie są nadpisywane przez starą sugestię. Brakujący dowód źródłowy pozostaje oddzielony od dopasowania. Renderowany kontrast i układ tekstu sprawdzają istniejące zamontowane kontrole. Gradienty, efekty, zagnieżdżona zawartość narzędzia, prawa i subiektywna jakość nie są oceniane przez porównanie marki. Kontrole nie blokują **Pobierz**.

## Użyj kontekstu projektowego lokalnie

**Pobierz kontekst projektowy** zawiera dokument tokenów, rozwiązane kolory, zadeklarowane rodziny fontów, ID zasobów, dowód źródłowy tam, gdzie jest zapisany, pokrycie i jawne reguły. Nie zawiera plików czcionek ani dowodu własności. Przegląd referencyjny zawiera też swoje proponowane tokeny i obserwacje.

CLI potrafi odczytać dowolne z tych pobrań bez serwera:

```bash
lolly system import ./lolly-design-context.json
lolly system context --output=design-context.json
lolly system check ./design-inputs.json --file=design-context.json
```

`system check` przyjmuje wejścia Design z tablicą `boxes` albo skompilowanym dokumentem Design. Zgłasza proponowane poprawki bez modyfikowania kompozycji. Nie potrafi zmierzyć układu przeglądarki ani renderowanego kontrastu. Istniejący zasób MCP **lolly://design-context** udostępnia kontekst obowiązującego systemu przez skonfigurowany lokalny proces MCP; nie jest potrzebna żadna nowa hostowana usługa ani klucz API.
