# Design System Setup

Twoje logo, kolory i kroje pisma należą w jednym miejscu, aby każde narzędzie, strona i eksport rysowały z nich. Tym miejscem jest **Design System Setup** pod `#/start`, a jego hasło mówi, do czego służy: *Make it yours*.

Zacznij od tego, co masz. Upuść logo, a Lolly odczyta jego kolory. Wybierz krój pisma albo upuść plik czcionki, którą licencjonuje Twoja firma. Każda zmiana od razu widać w całej aplikacji. Twoje logo, czcionki i tokeny zostają na tym urządzeniu. Wybór czcionki Google to jedyny krok, który sięga na zewnątrz: Lolly najpierw pyta, a potem pobiera rodzinę raz.

Gdy wygląda dobrze, nazwij system projektowy i naciśnij **Export**. Dostajesz jeden plik `.lolly` do zachowania, otwarcia na innym urządzeniu lub przekazania współpracownikowi. [Settings](/info/dashboard.html#design-system) pokazuje aktywny system tylko do odczytu, a jego okładka prowadzi tu do edycji.

## Zrób to swoje w pięć minut

::: timeline
- <!--i:upload--> **Upuść swoje logo** na strefie upuszczania w **Logos**. Lolly odczytuje jego kształt i kolory.
- <!--i:palette--> **Użyj tych kolorów.** Główny kolor logo staje się Twoim kolorem podstawowym, a ciemny neutralny z logo staje się kolorem tekstu.
- <!--i:font--> **Wybierz krój** w **Type**: czcionkę Google albo plik czcionki, który posiadasz.
- <!--i:pentool--> **Nazwij system.** Pierwsza edycja tworzy Twój własny system projektowy, a Lolly raz pyta o jego nazwę.
- <!--i:download--> **Export** zapisuje cały system jako jeden plik `LollyBrand-….lolly`.
:::

Nagłówek pokazuje, który system projektowy **Editing**, a jego nazwa jest polem, które możesz zmienić w każdej chwili. Gdy pierwsza edycja pyta **What is this design system called?**, słowa z Twojego logo są wypełnione, jeśli logo je zapisuje. **Save name** zachowuje nazwę; **Not now** zostawia zastępczą, dopóki nie wpiszesz jej w nagłówku. Nazwa opisuje system w Settings i przy przełączaniu oraz staje się nazwą pliku zapisywanego przez **Export**.

## Pokoje

Studio to zestaw pokoi na szynie z boku, w dowolnej kolejności: nic nie jest numerowane i nic nie czeka na nic innego. Na telefonie szyna staje się paskiem znaczników pod nagłówkiem.

![Szyna pokoi studia: Overview, Colours, Type, Logos, Tokens, Files i Usage & rules](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Pokój | Co tam robisz | Klucz linku |
|---|---|---|
| **Overview** | Zobacz, co zawiera system, z drzwiami do każdego pokoju | `overview` |
| **Colours** | Dodawaj kolory, nadawaj im role, buduj odcienie i paletę | `color` |
| **Type** | Wybierz cztery kroje, które czytają aplikacja, narzędzia i każdy eksport | `type` |
| **Logos** | Umieść swoje znaki w każdej orientacji i wariancie | `logos` |
| **Tokens** | Rogi, odstępy, cienie i każda inna nazwana wartość | `tokens` |
| **Files** | Obrazy, audio i pliki ruchu, które przechowuje Twoja marka | `catalogue` |
| **Usage & rules** | Reguły, które stosuje Twoja marka, sprawdzane na prawdziwych przykładach | `usage` |

Do pokoju prowadzi `#/start?area=<key>`. Pokój Files zachowuje klucz `catalogue`, ponieważ klucz pokoju to trwały kontrakt, a `?tab=` nadal działa jako starszy alias. Nieznany klucz otwiera Overview.

**Stopa szyny** zawiera akcje dla całego systemu, a nie dla jednego pokoju. **Add from…** wprowadza markę ([Bring a brand in](#bring-a-brand-in)), a **Tray** przechowuje to, co znalazło skanowanie, a czego jeszcze nie dodałeś. **Export**, **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions** i **Restore brand settings** zachowują i przenoszą system ([Keep and move your design system](#keep-and-move-your-design-system)). Każdy pojawia się, gdy jest na czym działać.

## Overview

Gdy nic jeszcze nie wybrano, Overview oferuje cztery sposoby na start. **Start from a reference** otwiera selektor źródła dla logo, zrzutu ekranu, strony internetowej lub pliku projektu, a **Pick a colour**, **Choose a face** i **Add a logo** otwierają te kontrolki bezpośrednio. Otwarcie którejś niczego nie zapisuje, a **Explore the tools** jest od początku.

Gdy cokolwiek jest Twoje, Overview pokazuje, co masz, z Twoimi własnymi liczbami na przodzie. Colours podaje liczbę kolorów, z przygaszonym `· N starter` tam, gdzie widać odziedziczone kolory; jego pasek stawia Twoje kolory pierwsze, potem cienką linię, potem wyblakłe kolory startowe. Type czyta się według ról (*Inter for headings*, z *Starter for the rest* w linii poniżej). Logos mówi, ile slotów jest wypełnionych (lub **Not set**), Tokens pokazuje promień rogu, a Files mówi **Nothing yet**, gdy biblioteka jest pusta. Każdy blok otwiera swój pokój.

### Starter i Twoje

**Starter** to słowo na wszystko, co przyszło z aplikacją, a nie zostało wybrane. Świeża instalacja nie niesie żadnego koloru, tylko jedną neutralną rampę od atramentu do papieru, aby powierzchnie, tekst i cienkie linie mogły się renderować, zanim ktokolwiek cokolwiek zdecyduje. To samo słowo oznacza odziedziczony materiał w każdym pokoju.

::: cols
## Starter

- Przyszło z aplikacją: neutralne od atramentu do papieru, kroje startowe, domyślny promień rogu.
- Przygaszone, z tagiem **Starter** i bez odcienia.
- Nie liczone jako Twoje kolory. Neutralne żyją w **Tokens** jako **Neutrals · starter · 9**, a **Open** pokazuje je w Colours jako jedną zwiniętą grupę (`#/start?area=color&group=neutral`).
- Rola oparta na kolorze startowym brzmi *"Starter Paper stands in"*, z **Choose…** w jej selektorze.

## Twoje

- Wybrane lub zainstalowane przez Ciebie.
- Pełna siła i zabarwiona karta tam, gdzie zainstalowałeś krój.
- Liczone w Overview i w Tokens.
- Rola, która podąża za inną, brzmi **↳ follows Primary**, zamiast powtarzać nazwę koloru podstawowego.
:::

Odziedziczony materiał nigdy nie jest rysowany z przerywaną ramką, ponieważ tutaj przerywana ramka oznacza cel upuszczania.

## Logos

Opróżnij folder ze znakami do strefy upuszczania u góry: **"Drop marks here, or choose several at once"** przyjmuje tyle plików, ile masz. Każdy plik jest czytany pod kątem kształtu i koloru, a potem czeka pod **Waiting for a slot** jako znacznik mówiący, jak wygląda, na przykład *"Looks like the Horizontal primary"*, z użytym pomiarem i przyciskiem **Place** (**Replace**, gdy slot jest wypełniony). Gdy nie jest pewny, znacznik tak mówi i oferuje **Change slot**, wymieniając wszystkie osiem. Nic nie jest umieszczane, dopóki czegoś nie naciśniesz.

Znak z nadmiarowym pustym marginesem dostaje najpierw propozycję przycięcia; odpowiedz na nią albo naciśnij Escape, a oryginał trafia bez zmian. Gdy znak może wypełnić pusty sąsiedni slot, pokój oferuje wyprowadzoną wersję **mono** lub **reverse** jako znacznik oznaczony *Generated*.

Każdy znak trafia do siatki ośmiu opcjonalnych slotów, po jednym na **orientację** i **wariant**:

- **Orientacje:** Horizontal (wordmark i symbol w rzędzie) i Vertical (ułożone w stos, dla kwadratowych i wysokich miejsc).
- **Warianty:** Primary, Primary reverse (dla ciemnych teł), Mono (jeden kolor) i Mono reverse.

Grupa bez znaków jest zwinięta do jednej linii; otwórz ją, aby zobaczyć sloty. Kliknij slot, aby dodać PNG, SVG, JPEG lub WebP, albo kliknij wypełniony slot, aby zastąpić znak. Wszystko zostaje na tym urządzeniu.

![Sloty logo z otwartymi Horizontal i Vertical: każdy wariant ma własny slot i każdy slot jest opcjonalny](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails%3Anth-of-type%281%29%3Esummary%3Bclick%3A.be-logo-identity%3Edetails%3Anth-of-type%282%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** to znaki, które Twoja marka nazywa własną nazwą, takie jak ikona, herb lub favicon.
- **Więcej tożsamości.** Submarka, produkt lub wydarzenie mogą mieć własny pełny zestaw: **+ Add another logo** i nadaj zestawowi nazwę. Twój główny zestaw to "Your logo". [Brand architectures](/info/brand-architectures.html) pokazuje, kiedy tożsamość logo jest właściwym klockiem.
- **Lolly odczytuje kolory logo.** Karta pod strefą upuszczania i ponownie u góry Colours wymienia kolory logo i pyta **Which is the main colour?**, z już wybranym najsilniejszym kolorem (nigdy białym, na którym logo wyeksportowano). **Use these colours** dodaje je do palety, czyni główny kolor kolorem podstawowym i, gdy logo ma ciemny neutralny czytelny na papierze, czyni go kolorem tekstu. **Not now** zostawia je w Tray. Na całkiem nowej instalacji najbardziej prawdopodobna odpowiedź jest stosowana od razu, a karta oferuje **Undo** lub inny kolor główny. SVG daje dokładne kolory; PNG, JPEG lub WebP dają kolory pokrywające realną część znaku.

## Colours

Pokój rośnie razem z systemem projektowym: pierwsza wizyta to jedna decyzja, a reszta przychodzi wraz z paletą.

### Pierwszy kolor

System bez własnych kolorów otwiera się na jednym dużym znaczniku i jednym polu, z linią mówiącą, że role, odcienie i ustawienia druku pojawią się, gdy system urośnie.

- **Znacznik jest selektorem.** Naciśnij **Pick a colour**, a otwiera się karta OKLCH studia, zasilona tym, co zawiera pole: nazwa, koło, cztery pokrętła, alfa i **Stored as**, z **Cancel** i **Add colour** na dole. Nic nie trafia do systemu, dopóki nie naciśniesz **Add colour**.
- **Pole przyjmuje dowolny zapis**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` lub nazwę koloru. Wklej listę, a stanie się rzędem znaczników do dodania pojedynczo lub przez **Add all**.
- **Dwa kolejne sposoby.** **Pick a colour from the screen** używa zakraplacza, gdy przeglądarka go ma, a **Take colours from an image** czyta zrzut ekranu lub zdjęcie na tym urządzeniu.
- **Add nigdy nie jest wyłączone.** Przy pustym polu otwiera selektor; tekst, którego nie potrafi odczytać, dostaje pod polem linię mówiącą o tym.

Twój pierwszy kolor staje się **primary**, a znacznik to potwierdza, na przykład *"Primary is now Vivid Violet"*, z **Fine-tune** do dostrojenia koloru.


### W miarę jak paleta rośnie

Twoje kolory leżą obok podglądu **In context** na szerokim ekranie i nad nim na mniejszym. Podgląd pokazuje plakat, wykres lub kartę interfejsu w Twojej palecie. Kolory startowe zostają we własnej zwijanej grupie.

![Pokój Colours w Lolly Demo: paleta w zwijanych grupach, każdy kolor z nazwą i hex, oraz pigułka pobierania na dole](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![Pokój Colours po dodaniu jednego koloru, z jego paletą i żywym podglądem kompozycji](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Role: co czytają narzędzia

**Roles** mówią, który kolor gra jaką rolę w każdym narzędziu i eksporcie. Są opcjonalne (trzy luźne kolory i brak ról to w pełni dobry system), każdy kolor może mieć jedną, a odczyt kontrastu jest mierzony względem powierzchni, najpierw APCA. Każdy wiersz roli pokazuje własny kolor w pełnej sile, zastępczy kolor startowy albo **↳ follows Primary**.

Gdy paleta ma odcienie, pasek pokazuje wszystkie siedem ról, które może czytać narzędzie: Primary, Secondary, Surface, Text, Muted, Edge i On primary. On primary jest wyprowadzony z koloru podstawowego, brzmi **Derived** i nie ma selektora.

Własny akcent aplikacji domyślnie podąża za systemem projektowym. To ustawienie **Interface follows the design system** w **Settings → Appearance**; wyłączenie go zostawia obramowanie aplikacji neutralne, a narzędzia, kanwy i eksporty podążają za systemem projektowym w obu przypadkach.

**Colourways.** System projektowy może mieć kilka kolorów wiodących, wybieranych dla każdej pracy. Lolly zachowuje każdy colourway, ale ten pokój nie potrafi jeszcze żadnego stworzyć: colourway zapisuje się w pliku tokenów. W systemie z colourway każdy colourway potrzebuje własnego koloru podstawowego i drugorzędnego, a własnej powierzchni, gdy colourway barwią tło, więc te role zostają w edytorze próbek. [Lolly Demo in use](/info/lolly-demo-in-use.html#colourways-on-real-work) pokazuje colourway na prawdziwej pracy, a [Add colourways to a design system](/info/colourways.html#add-colourways-to-a-design-system) ma format.

### Znajdź więcej kolorów

Trzy narzędzia budują na Twoim kolorze podstawowym. Pierwsze dwa tylko sugerują, a trzecie zastępuje paletę po przejrzeniu zmiany.

::: cols
## Explore shades & harmonies

Wybierz **Starting colour**, **Scheme** (Mono, Complement, Analogous lub Triad) i liczbę **Shades** (od 3 do 20, domyślnie 5). **Fine-tune** ustawia intensywność interfejsu, kontrast i tekst na marce. Kliknij odcień, aby go dodać, lub **Add 5 shades** dla grupy. Twoje kolory i role zostają.

## Find matching colours

Wybierz **Harmony**: Complementary, Adjacent, Triad, Tetrad lub Analogous (z **Accents** od 2 do 5 i **Angle** od 10° do 45°). Każdy kandydat ma wygenerowaną nazwę i **+ Add**, jedno naciśnięcie na kolor.

## Rebuild the whole palette

Zastępuje paletę z jednego koloru wyjściowego, po przeglądzie tego, co się zmienia, a co zostaje. Najpierw tworzony jest punkt kontrolny, a potem oferowane jest **Undo**.
:::

Wszystkie trzy używają tej samej percepcyjnej matematyki kolorów (OKLCH) co silnik. W **Explore shades & harmonies** wiersze **Primary**, **Neutral** i **Secondary** pokazują sugerowane odcienie, a **Theme preview** pokazuje jasne i ciemne przykłady z odczytami kontrastu.

![Trzy sugerowane grupy odcieni, z osobnymi elementami sterującymi dodawania i osobnym Theme preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Wygenerowane akcenty, każdy z próbką koloru, automatycznie wygenerowaną nazwą, kodem hex i przyciskiem Add](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Zatwierdzanie wygenerowanej palety

Otwórz **Rebuild the whole palette…** i naciśnij **Preview full rebuild**. Przegląd liczy, ile ról zostaje tak, jak je przypisałeś, ile Twoich kolorów jest zachowanych oraz ile krzywych odcieni, blokad druku, ukrytych odcieni i punktów gradientu jest zakotwiczonych na nowo lub zachowanych. **Apply rebuilt palette** zatwierdza; **Cancel** niczego nie zmienia. Potem karta oferuje **Undo** z fokusem na nim, a punkt kontrolny wykonany przed zamianą przywraca cały system.

System z colourway zachowuje każdy colourway po przebudowie. Kanoniczny colourway podąża za nowym kolorem wyjściowym, a każdy inny colourway zachowuje własne kolory, nazwę, kolejność i ustawienia. Przegląd wymienia, który colourway podąża, a które zachowują swoje kolory. Lolly nie przebudowuje systemu, który koduje colourway w sposób, którego nie potrafi edytować; karta mówi dlaczego i nic się nie zmienia.

### Sekcje dla ekspertów

Cztery zwinięte sekcje leżą pod podglądem i rolami. Każda otwiera się bezpośrednio przez `#/start?area=color&focus=<name>`:

- **Explore shades & harmonies** (`focus=generate`), opisane wyżej.
- **Shade curves** (`focus=curves`) kształtują rampę punkt po punkcie, z osobnymi krzywymi jasności, chromy i odcienia (L / C / H) i odcieniami przerysowującymi się w trakcie przeciągania.
- **Contrast** (`focus=contrast`): **Contrast-lock** przetonuje rampę do celów APCA względem wybranego tła, a **Rotate hue** obraca całą rampę wokół koła.
- **Print** (`focus=print`) ustawia, czym kolor podstawowy staje się w druku: jego automatyczną wartością, przypiętym składem CMYK albo nazwaną farbą dodatkową.

### Paleta i każda próbka

Paleta wymienia Twoje kolory w zwijanych grupach, każda z własnym **+ Add**. Twórz i zmieniaj nazwy grup, jak chcesz. Rola nigdy nie tworzy drugiego kafla: kafel, na który wskazuje rola, nosi zamiast tego mały znak (**P**, **S**, **Su**, **T**). **Colour chart** pod kaflami pokazuje te same kolory na **Wheel** OKLCH (przeciągnij kropkę, aby przekolorować, kliknij puste miejsce, aby dodać próbkę) i wykresie **Gamut**, który pokazuje, gdzie kończy się zakres wyświetlania. `#/start?area=color&focus=chart` otwiera wykres bezpośrednio.

![Panel palety, każda grupa zwijalna, z pigułką pobierania umieszczoną przy dolnej krawędzi](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Koło OKLCH - kąt to odcień, odległość od środka to nasycenie, a szarości poruszają się po pasku jasności z boku](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Kliknij próbkę, aby otworzyć jej edytor:

- **Rename** próbkę.
- **Ustaw kolor** na suwakach OKLCH lub w **Hex**, **HSL**, **RGB** albo **CMYK**. Pole wartości czyta i zapisuje w aktywnej przestrzeni. CMYK tutaj ustawia kolor ekranowy przez konwersję; aby przypiąć dokładne farby, użyj **Print substitutes**.
- **Stored as** wybiera, jak próbka jest zapisana: **LCH** (domyślnie, percepcyjny i szeroki gamut), Hex, RGB lub HSL.
- **Use as** nadaje próbce rolę bezpośrednio. Naciśnij podświetloną rolę ponownie, aby ją wyczyścić.
- **Print substitutes** (zwinięte): zablokuj **CMYK** z **Auto** na dokładne wartości farb albo ustaw **Spot colour** z **Name** (takim jak `PANTONE 186 C`), opcjonalną **Book** i **Finish** dla folii, wytłoczenia, wgłębienia, lakieru wybiórczego, soft touch albo wykrojnika, bigowania lub perforacji. Maszyna drukarska używa tych blokad, gdy eksportujesz PDF lub TIFF CMYK; zobacz [Colour profiles](/info/exporting.html#colour-profiles).
- **In other spaces** (zwinięte): wartość dla każdej przestrzeni kolorów, wyprowadzona lub napisana przez Ciebie, a napisana wygrywa przy eksporcie.

**Usuwanie próbki** jest bezpieczne. Wyprowadzone odcienie i role motywu są ukrywane, więc nic, co je czyta, się nie psuje, a dodane przez Ciebie kolory są usuwane.

::: details Praca z wieloma próbkami
Każda próbka ma uchwyt do przeciągania. Przeciągnij, aby zmienić kolejność w grupie, lub ustaw fokus na uchwycie, naciśnij Space, użyj klawiszy strzałek i naciśnij Space ponownie, aby upuścić; Escape anuluje. Aby przenieść kolory między grupami, użyj kontrolki **Group** edytora lub zaznacz kilka i użyj **Move to**.

Zaznaczanie nie wymaga trybu. Pasek pojawia się z pierwszym zaznaczonym kaflem i znika z ostatnim.

- **Przeciągnij po pustym miejscu**, aby narysować prostokąt; każdy kafel, którego dotknie, dołącza do zaznaczenia, także między grupami. Zwinięta sekcja niczego nie dodaje.
- **Kliknięcie z Shift** bierze zakres w kolejności czytania, **kliknięcie z Cmd/Ctrl** przełącza jeden kafel, a zwykłe kliknięcie otwiera edytor.
- Każdy nagłówek grupy ma **Select all**, a **Cmd-A** z fokusem na kaflu bierze każdy kolor, który posiadasz, nigdy startowy.
- Siatka ma jeden punkt tabulacji: strzałki przesuwają, Shift-strzałki rozszerzają, Space przełącza, Delete usuwa, a Escape czyści. Aby dostroić kanał, najpierw naciśnij `l`, `c` lub `h`.
- Na ekranie dotykowym naciśnij i przytrzymaj kafel, aby zacząć zaznaczanie, a potem stukaj, aby dodawać.

Pasek brzmi **{n} selected**, potem **Move to**, **Give a role** (każdy kolor dostaje kolejną rolę po kolei), **Download** (zaznaczenie w dowolnym z sześciu formatów palety), **Duplicate** (kopia każdego, umieszczona po oryginale), **Copy values** i **Delete**. Jedna kopia otwiera się od razu w edytorze; kilka pozostaje zaznaczonych. Jedno Cmd/Ctrl-Z cofa całą akcję zbiorczą.
:::

### Gradienty

Opcjonalny panel **Gradients** buduje tokeny przejść z palety. Każdy gradient ma podgląd, od 2 do 8 nazwanych punktów i kąt. Punkt wskazuje próbkę, więc przekoloruj próbkę, a gradient podąży. Przejścia liczą się w OKLCH.

Pobrania palety (tokeny projektowe, CSS, SCSS, GIMP i Adobe Swatch Exchange) leżą w pigułce na dole palety, gdy są odcienie. [Take your palette and fonts anywhere](/info/using.html#take-your-palette-and-fonts-anywhere) opisuje każdy format.

## Typografia

Bez własnego kroju pokój to jedna karta: **Primary**, złożona w rozmiarze do czytania w kroju, który obsługuje go dziś, z tagiem **Starter**, przyciskiem **Choose a face** i linią *"Nothing installs until you choose one."* Headings, code i italic podążają za primary, dopóki ich nie wybierzesz; **Choose them separately** pokazuje ich karty.

![Pokój Type z jeszcze niewybranym krojem - jedna karta w rozmiarze czytelnym, ze znacznikiem Starter, i jedno wypełnione Choose a face](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Wybierz jeden krój, a pokój otwiera się na cztery karty ról, listę Fonts i próbkę na żywo:

- **Primary**: tekst podstawowy, przyciski i każde narzędzie.
- **Headings**: krój wyświetlania dla `h1` i `h2`.
- **Code**: krój o stałej szerokości dla kodu i danych.
- **Italic**: prawdziwa kursywa do wyróżnień, cytatów i dygresji.

Karta jest zabarwiona tylko tam, gdzie zainstalowałeś ten krój, a jej przycisk brzmi **Change** dla Twojego własnego kroju i **Choose a face** wszędzie indziej. Nic na karcie niczego nie zatwierdza: przycisk otwiera scenę porównania dla tej roli.

![Odsłonięte cztery karty ról - każda złożona w kroju, który ją obsługuje, ze znacznikiem Starter tam, gdzie nikt nie wybrał, i Italic podążającym za primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Etap porównania

Scena otwiera się wewnątrz pokoju, pod naciśniętą kartą, a karty zwijają się do paska jednej linii, aby scena była widoczna na pierwszym ekranie telefonu. Escape anuluje i zwraca fokus na kartę.

1. Naciśnij **Choose a face** na karcie.
2. Wpisz nazwę rodziny i naciśnij **Preview**, albo naciśnij jedną z sześciu rodzin **Pinned** pod polem.
3. Naciśnij **Use this face**.

![Etap porównania otwarty pod swoją kartą, z wierszem wyszukiwania, przypiętymi rodzinami i kartami zwiniętymi do jednowierszowego paska](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**Zgoda jest pytana raz.** Pierwszy raz, gdy podgląd sięga do Google Fonts, okno wyjaśnia: *Google learns the family name and your IP address. The file is then kept on this device and used offline. This is the one step in the studio that reaches a third party.* **Fetch from Google** idzie dalej i jest zapamiętywane. **Cancel** zostawia kartę z napisem *"Not fetched. Nothing was sent to Google."* i jej własnym **Fetch from Google**.

**Upuść plik czcionki na scenie** (TTF, OTF lub WOFF), aby podejrzeć licencjonowany krój, który już posiadasz. Tak czy inaczej krój zostaje na tym urządzeniu, renderuje się offline w aplikacji, narzędziach i każdym eksporcie i podróżuje w pliku systemu projektowego. Wszystko w Google Fonts jest na otwartej licencji (OFL, Apache lub UFL).

### Fonty na tym urządzeniu

Panel **Fonts** wymienia każdy krój na tym urządzeniu i rolę, której służy. Dodane przez Ciebie kroje prowadzą pod **In the design system**, każdy ze swoimi rolami i przyciskiem usuwania. Kroje startowe następują w jednym przygaszonym, zwiniętym rzędzie. **Add a face** otwiera scenę porównania dla dowolnej roli. Panel **Type roles** pokazuje próbkę na żywo każdej roli z jej rodziną i stanem, takim jak *Inter* lub *Inter · follows Primary*.

## Tokeny

Tokeny to nazwane wartości za systemem projektowym: kolory, kroje pisma, logo, rogi i odstępy. Narzędzia czytają je po nazwie, więc zmiana tutaj dociera do każdego narzędzia naraz.

![Pokój Tokens: nagłówek z przykładem z systemu i akcjami na pliku, kafle liczące każdy rodzaj tokenu, potem pary kolorów z odczytami kontrastu](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Nagłówek** podaje przykład z Twojego systemu (*Primary is Spearmint, #033633*) i akcje na pliku: **Download** (cały system jako tokeny projektowe lub paleta w pięciu innych formatach), **Copy CSS** i **Add from…** do wczytania pliku JSON z powrotem.
- **Kafle** liczą każdy rodzaj tokenu i przeskakują do jego sekcji: Colours, Type, Logos, Shape and spacing, More i All tokens. Liczą to, co Twoje, jak Overview. Na telefonie kafle przewijają się w bok.
- **Colours** zaczyna się od par, które narzędzia zestawiają (tekst na powierzchni, na kolorze podstawowym, przygaszony na powierzchni) z odczytem APCA w jasnym i ciemnym oraz oznacza **Weak contrast**, gdzie para nie dosięga. Potem każda grupa kolorów: rampa jako jeden rząd znaczników, inne kolory z wartością i odwołaniem, którego używają narzędzia, takim jak `{color.brand.spearmint}`. Naciśnij odwołanie, aby je skopiować. **Edit in Colours** otwiera grupę w pokoju Colours.
- **Type** i **Logos** wymieniają krój dla każdej roli i każdy slot logo, z **Edit in Type** i **Edit in Logos**, gdy masz własne.
- **Shape and spacing** zawiera **Rounded corners** (`shape.radius`) i **Spacing rhythm** (`space.base`). Każdy brzmi *Lolly default*, dopóki nie przesuniesz suwaka, i *Yours* potem, zapisuje się od razu i można go cofnąć.
- **More tokens** dodaje odstępy, rozmiary, grubość obrysu, krycie, obrót, zwykłe liczby i cienie, zapisane jako standardowe [tokeny projektowe](/info/design-tokens.html).
- **App appearance (advanced)** wymienia kolory, rozmiary i cienie używane przez własne ekrany Lolly, a **Inspect every token (advanced)** przeszukuje i edytuje każdą zapisaną wartość, pokazując każdą zmianę do przeglądu najpierw.

Sekcja, w której nic nie ma, oferuje sposób na wypełnienie luki: **Pick a colour**, **Choose a face** lub **Add a logo**.

## Pliki

Upuść pliki, które przechowuje Twoja marka, poza logo: pliki **vector**, **image**, **audio** i **motion** (wideo, Lottie i animacje). Pojawiają się w [Assets](/info/using.html#assets-your-library), posortowane w sekcje i gotowe w selektorze zasobów każdego narzędzia, i zostają na tym urządzeniu.

## Usage & rules

**Usage & rules** wprawia w ruch wybory Twojej marki: co ludzie mogą zmieniać, co pozostaje stałe i co Lolly może sprawdzić.

![Usage & rules w Lolly Demo: pusta karta Brand rules z Add your first rule, potem Try your brand in use z gotowymi do renderowania przykładami](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** wymienia Twoje reguły. **Add rule** (lub **Add your first rule**) otwiera krótki formularz:

- **Rule name** Twoimi słowami, na przykład *Beacon accents*;
- **Check**: **Colour choices**, **Font choices**, **Fixed artwork** lub **Text length**, z rolą marki, której używa, pod Twoją własną nazwą roli;
- **Example**, do którego się stosuje (Poster, Title slide, Content slide lub Chart), **Mode** i to, czy jest **Required**, czy **Advisory**;
- **Reviewed by**, potem **Save draft** lub **Approve & save**.

Zatwierdzenie zapisuje Twoją własną decyzję na tym urządzeniu. Zatwierdzone reguły wymagane ograniczają plakat wielokrotnego użytku, a kontrole obejmują tylko przykładowe PNG; nie zmieniają żadnego innego narzędzia.

Reguły, które system projektowy niesie w pliku tokenów, takie jak zatwierdzone zestawienia kolorów, grubość i wyrównanie tekstu lub logo na powierzchnię, są tu wymienione jako **Checked in Design**. Design sprawdza je warstwa po warstwie na karcie **Before you export** w panelu eksportu, a `lolly check` robi to samo dla zapisanego dokumentu Design ([Before you export](/info/design.html#before-you-export)). Reguła, dla której ta kompilacja nie ma sprawdzacza, jest zachowana tak, jak dostarczono, i oznaczona **Unchecked**.

**Try your brand in use** renderuje cztery przykłady z bieżącej rewizji przez **Render & check examples**. Wybierz **Brand mode** i **Try your own text** dla nagłówka, tekstu pomocniczego i tekstu slajdu. Każdy przykład zgłasza, co zmierzono, z **See checks & sources** i **Download check report**, a **Make reusable poster** pobiera `.lolly`, którego stały układ i zatwierdzone wybory danych wejściowych podróżują z plikiem. Przykłady są lokalne: uruchomienie kontroli niczego nie publikuje ani nie zatwierdza.

Kompilacja dostarczana ze stałą marką pokazuje te same reguły i przykłady tylko do odczytu, pod *This brand is set*.

## Wprowadź markę

**Add from…** na dole szyny otwiera selektor, który pyta, co masz, a nie jaki to format:

- **Design tokens or a design file**: JSON DTCG lub Tokens Studio, projekt Penpot, zip zestawów tokenów, paczka systemu projektowego Lolly lub SVG.
- **PDF**: prezentacja lub plik wytycznych, czytany na tym urządzeniu pod kątem kolorów, znaków i osadzonych krojów.
- **Logo or screenshot**: obraz staje się sugerowaną paletą, czytaną na tym urządzeniu. Czyta kolory, a nie krój ani układ.
- **Saved web page**: jeden plik HTML i jego pliki CSS albo wklejony HTML lub CSS, do 20 plików i 2 MB. Czytany jest tylko tekst, który dostarczysz: powiązane zasoby nie są pobierane, a skrypty nie działają.
- **Font file**: TTF, OTF lub WOFF. Otwiera pokój Type, gdzie krój się instaluje.
- **Website**: jedna strona, czytana pod kątem kolorów i typografii. Ten kafel pojawia się tylko na urządzeniu, które może czytać stronę, i mówi, którego czytnika używa: aplikacji na tym urządzeniu albo rozszerzenia przeglądarki w karcie w tle, zalogowanego jako Ty. Podanie adresu URL tylko wypełnia pole; naciśnięcie fetch jest zgodą.

Wybierz źródło pliku projektu, a następna karta wymienia akceptowane formaty jako kafle z ikonami, z całą kartą jako jednym celem upuszczania. Możesz też upuścić plik prosto na studio.

![Karta importu - akceptowane formaty prowadzą jako kafelki z ikonami, a cała karta jest jednym obszarem upuszczania](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- **Paczka systemu projektowego Lolly** (`.lolly` lub starszy `.zip`) instaluje się w jednym kroku.
- Eksport **Penpot** (`.penpot`) wnosi swoje tokeny projektowe.
- Plik **Design Tokens** (W3C DTCG) lub **Tokens Studio** (`.json`) wnosi swoje tokeny.
- **Zwykły SVG** jest skanowany pod kątem kolorów, z których wybierasz, a pierwszy staje się Twoim kolorem podstawowym.

### Przejrzyj odniesienie

Logo, zrzut ekranu, strona internetowa lub zapisana strona otwiera **Try these colours**: przykład w proponowanych kolorach, **Main colour**, który możesz zmienić, i nazwę nowego systemu. Ramka opisuje, co robi zastosowanie: **replaces** aktywne ustawienia tokenów wygenerowaną paletą i domyślnymi stylami, **keeps** Twoje czcionki i pliki biblioteki, a poprzedni system można **recovered**. **Apply suggested settings** stosuje palety jasną i ciemną, po punkcie kontrolnym, a **Restore brand settings** może przywrócić stare ustawienia. **Change reference** wybiera inne źródło.

**Palette, source details and individual choices** pokazuje, co odczytano, znalezione nazwy czcionek i kontrast podglądu. Nazwy czcionek to tylko sugestie; Type nadal jest miejscem, gdzie instalujesz krój. Szczegóły źródła mogą zawierać typografię, odstępy, wypełnienia i wartości rogów tam, gdzie je zaobserwowano, oznaczone **Not observed** w przeciwnym razie. Zapisana strona lub natywny odczyt witryny zgłasza deklarowane style, których strona może nie używać, a rozszerzenie przeglądarki może zgłaszać zmierzone style z próbki widocznych elementów. To obserwacje: nic nie jest instalowane, a odstępy źródła nigdy nie zastępują Twoich. **Choose individual items in the tray** zachowuje pojedyncze elementy, a **Download design context** zapisuje raport JSON z obserwacjami, proponowanymi tokenami i informacjami o źródle (z SHA-256 dostarczonego HTML lub CSS). Raport nie zawiera surowego tekstu strony i nie jest podpisanym Content Credential.

Importy PDF i plików projektowych zachowują własne kontrolki przeglądu. Elementy w **Tray** niczego nie zmieniają, dopóki nie dodasz ich w pokoju, który jest właścicielem tego rodzaju materiału. `#/start?source=<kind>` otwiera selektor na źródle (`file`, `pdf`, `image`, `font`, `url`, `page`), a `?import` otwiera zwykłą listę.

### Znajdź i porównaj wygląd

Otwórz **Find a look** z Overview lub z listy systemów projektowych w Settings. Przeglądaj systemy zapisane na tym urządzeniu i kilka przykładów Lolly wielokrotnego użytku oraz szukaj po nazwie, tagu koloru lub deklarowanej czcionce. **Closest to my current palette** sortuje według zmierzonego podobieństwa kolorów, a pasujące czcionki rozstrzygają remisy; to nie jest ocena jakości.

Zaznacz jeden wygląd, aby go przejrzeć, lub dwa, aby porównać obok siebie. Zaznaczanie niczego nie zmienia. **Use this saved system** przełącza na niego, a **Use these colours** stosuje kolory przykładu przez zwykły punkt kontrolny, zachowując Twoje czcionki. **Restore brand settings** przywraca poprzedni wygląd. Zapisane systemy mają edytowalne **Search tags** w **Details and design context**. Przykłady to oryginalne przepisy kolorów Lolly, bez zeskrobanej kolekcji i bez konta.

![Porównaj Sunroom i Orchard obok siebie, zanim zastosujesz którykolwiek z systemów kolorów.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

## Zachowaj i przenieś swój system projektowy

### Przenieś markę między urządzeniami

**Export** zapisuje jeden plik **`LollyBrand-….lolly`**: Twoje tokeny, czcionki, logo i preferencję motywu, z manifestem integralności sprawdzanym przy wczytywaniu z powrotem. Wydania web przed 1.0.7 nazywały ten sam plik `.zip` i ta pisownia nadal jest akceptowana. **Tokens (.json)** zapisuje sam zwykły dokument tokenów projektowych, bez czcionek i logo, dla repozytorium, kroku budowania lub innego narzędzia tokenów.

Aby przywrócić jeden, użyj **Add from… → Design tokens or a design file** albo upuść plik na studio. W ten sposób współpracownik przekazuje Ci markę lub przenosisz ją na drugą instalację, bez konta i bez chmury. Aby wprowadzić markę z wiersza poleceń, zobacz [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** pakuje dodane przez Ciebie czcionki w instalowalny RPM. Jeśli któreś wgrałeś sam, Lolly najpierw prosi o potwierdzenie, że możesz je redystrybuować.

### Przywróć wcześniejsze ustawienia

Wybierz **Restore brand settings**, zaznacz datowany punkt kontrolny i naciśnij **Restore**. Przywraca kolory, ustawienia typografii i inne tokeny aktywnej marki; pliki czcionek i obrazów zostają bez zmian. Lolly najpierw zapisuje Twoje bieżące ustawienia jako **Before restore**, więc możesz cofnąć przywrócenie nawet po zamknięciu przeglądarki. Na tym urządzeniu zachowywanych jest ostatnich 20 punktów kontrolnych.

### Wersje

Opublikowana wersja to **stała, nazwana kopia** zachowana na tym urządzeniu. Nigdy się nie zmienia, więc narzędzie lub link, który ją przypina (przez `designv`), rysuje wciąż to samo. System z czymś Twoim pokazuje cichy link **Versions & publishing** na dole szyny; po pierwszej publikacji staje się wpisem **Versions**. `#/start?area=versions` otwiera go bezpośrednio.

- **Wersja jest stała.** Nie ma jeszcze usuwania, a panel o tym mówi.
- **Usunięcia otwierają kartę zgodności**, ponieważ usunięty token to to, co psuje narzędzie.
- **Publikacji nie da się cofnąć; przywrócenie można.** *Restore latest from this version* to zwykła edycja, z **Undo** oferowanym od razu.

**Publish only** zachowuje wersję bez zmiany tego, za czym podążają narzędzia; **Publish and make active** sprawia, że narzędzia i aplikacja podążają za tą wersją. **Follow the latest again** sprawia, że każda edycja wchodzi na żywo w chwili jej wykonania.

## Zarządzaj swoimi systemami projektowymi

Otwórz **Settings → Preferences → Design systems**, aby przełączać, dodawać lub usuwać systemy. **Open** wybiera system i otwiera go tutaj; **Make a new one** tworzy lokalny system i otwiera go z gotowym polem nazwy. Aktywny jest jeden system naraz, dla całego urządzenia. [Brand architectures](/info/brand-architectures.html) pomaga zdecydować, kiedy marka potrzebuje własnego systemu projektowego.

**Skąd pochodzi system.** System dostarczony przez katalog wdrożenia brzmi **Came with this app** albo **From this instance** w aplikacji połączonej z jedną. Rozwiń **Catalogue source**, aby zobaczyć, kto go dostarcza, jego zasób tokenów i przestrzeń nazw oraz znaną wersję lub sumę kontrolną; jeśli odświeżenie zawiedzie, materiał z pamięci podręcznej jest oznaczony.

**Systemy zarządzane są tylko do odczytu.** System brzmi **Managed by this instance** (albo **Managed by this app** w aplikacji komputerowej bez instancji), gdy jego katalog go blokuje. Możesz go używać i pobierać, a otwarcie go tutaj pokazuje uwagę tylko do odczytu z **Make an editable copy** i **Switch**. Twoje własne lokalne systemy pozostają edytowalne, nawet gdy zarządzany był pierwszy. Kompilacja z jedną stałą marką otwiera Design System Setup na *This brand is set*, z tokenami marki i regułami użycia do przeczytania.

**Każdy inny dostarczony system jest Twój** do ukrycia, edycji i resetowania, w tym Lolly Demo i Lolly Starter na lolly.tools. Edycja jednego zachowuje jego nazwę i oznacza wiersz **Edited here**, a **Reset to original** w jego menu odrzuca zmiany wykonane na tym urządzeniu. Pusty starter jest wyjątkiem: pierwsza zmiana tam zaczyna Twój własny system projektowy, więc Lolly raz pyta, jak nazwać nowy system. [Lolly Demo in use](/info/lolly-demo-in-use.html#switch-to-your-own) pokazuje, co Twój własny system zastępuje.

### Usuwanie systemu projektowego

Wybierz **Remove** z menu systemu; potwierdzenie mówi, który system będzie potem aktywny. Zapisane sesje, wgrane pliki i materiał współdzielony z innym systemem zostają.

Usunięcie dostarczonego systemu tylko go ukrywa: jego zasoby katalogu zostają, **Bring back** pokazuje go ponownie, a wraca sam, jeśli usuniesz wszystko inne. Usunięcie zaimportowanej lub edytowanej kopii nie usuwa dostarczonego systemu, jego logo ani czcionek, a jeśli kopia była aktywna, dostarczony system znów staje się aktywny. Usunięcie aktywnej kopii hostowanej czyści tylko połączenie tej kopii; osobno wybrana instancja pozostaje wybrana.

Zmiana tego, co dostarcza serwer, jest zadaniem administratora: jego operator zmienia katalog źródłowy i wdraża ponownie, albo administrator Lolly Work przegląda i stosuje zmianę serwera. Edycje tutaj zostają lokalne. Zobacz [Removing a catalogue design system](/info/configuration.html#removing-a-catalogue-design-system) i [Configuration](/info/configuration.html#supplied-and-local-design-systems).

## Używaj kontekstu projektowego poza aplikacją

**Download design context** zapisuje dokument tokenów, rozwiązane kolory, deklarowane rodziny czcionek, identyfikatory zasobów, dowody źródłowe tam, gdzie zapisane, pokrycie i jawne reguły, bez plików czcionek i bez dowodu własności. Wiersz poleceń czyta plik bez serwera: `lolly system import` czyni go systemem projektowym terminala, a `lolly system check` sprawdza dane wejściowe Design względem zapisanego kontekstu. [Bring your design system](/info/cli.html#bring-your-design-system) opisuje import, a [Which design system a command uses](/info/cli-decks.html#which-design-system-a-command-uses) opisuje sprawdzanie, a klient MCP czyta ten sam brief z `lolly://design-context` ([MCP Server](/info/mcp.html)).

## Dokąd dalej

- **[Using Lolly](/info/using.html)**: narzędzia, zapisywanie, udostępnianie i Assets.
- **[Brand architectures](/info/brand-architectures.html)**: jak działy, produkty, marki poparte, klienci i sezony mapują się na systemy projektowe, colourway i tożsamości logo.
- **[Design Tokens](/info/design-tokens.html)**: model tokenów, w którym zapisana jest Twoja marka.
- **[Export a file](/info/exporting.html)**: jednostki druku, CMYK i formaty, w które renderuje Twoja marka.
