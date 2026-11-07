# Lolly Design System Setup

<a id="design-system-setup"></a>

Twoje logo, kolory i kroje pisma należą w jednym miejscu, aby każde narzędzie, strona i eksport rysowały z nich. Tym miejscem jest **Lolly Design System Setup** pod `#/start`.

Zacznij od tego, co masz. Upuść logo, a Lolly odczyta jego kolory. Wybierz krój pisma albo upuść plik czcionki, którą licencjonuje Twoja firma. Każda zmiana od razu widać w całej aplikacji. Twoje logo, czcionki i tokeny zostają na tym urządzeniu. Wybór czcionki Google to jedyny krok, który sięga na zewnątrz: Lolly najpierw pyta, a potem pobiera rodzinę raz.

Gdy wygląda dobrze, nazwij system projektowy i naciśnij **Export**. Dostajesz jeden plik `.lolly` do zachowania, otwarcia na innym urządzeniu lub przekazania współpracownikowi. [Lolly Settings](/info/dashboard.html#design-system) pokazuje aktywny system tylko do odczytu, a jego okładka prowadzi tu do edycji.

## Zrób to swoje w pięć minut

::: timeline
- <!--i:upload--> **Upuść swoje logo** na strefie upuszczania w **Logos**. Lolly odczytuje jego kształt i kolory.
- <!--i:palette--> **Użyj tych kolorów.** Główny kolor logo staje się Twoim kolorem podstawowym, a ciemny neutralny z logo staje się kolorem tekstu.
- <!--i:font--> **Wybierz krój** w **Type**: czcionkę Google albo plik czcionki, który posiadasz.
- <!--i:pentool--> **Nazwij system.** Pierwsza edycja tworzy Twój własny system projektowy, a Lolly raz pyta o jego nazwę.
- <!--i:download--> **Export** zapisuje cały system jako jeden plik `LollyBrand-….lolly`.
:::

Pasek u góry studia pokazuje nazwę systemu projektowego, a nazwa jest polem, które możesz zmienić w każdej chwili: **Enter** zachowuje nową nazwę, a **Escape** przywraca starą. Gdy pierwsza edycja pyta **What is this design system called?**, słowa z Twojego logo są wypełnione, jeśli logo je zapisuje. **Save name** zachowuje nazwę; **Not now** zostawia zastępczą, dopóki nie wpiszesz jej na pasku. Nazwa opisuje system w Settings i przy przełączaniu oraz staje się nazwą pliku zapisywanego przez **Export**.

## Pokoje

Studio to zestaw pokoi w dowolnej kolejności: nic nie jest numerowane i nic nie czeka na nic innego. Na komputerze pokoje leżą w jednym rzędzie pod paskiem. Na telefonie przenoszą się na pasek wzdłuż dolnej krawędzi, gdzie sięga kciuk, a otwarty pokój jest przewinięty do widoku; arkusz palety i Tray unoszą się nad tym paskiem, a pasek ustępuje na czas pisania. Na klawiaturze Tab trafia do tego rzędu raz, a klawisze strzałek, Home i End przechodzą z pokoju do pokoju.

![Pasek studia i jego pokoje: Board, Colours, Type, Logos, Tokens, Files, Rules i Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Pokój | Co tam robisz | Klucz linku |
|---|---|---|
| **Board** | Zobacz, co zawiera system, z drzwiami do każdego pokoju | `overview` |
| **Colours** | Dodawaj kolory, nadawaj im role, buduj odcienie i paletę | `color` |
| **Type** | Wybierz cztery kroje, które czytają aplikacja, narzędzia i każdy eksport | `type` |
| **Logos** | Umieść swoje znaki w każdej orientacji i wariancie | `logos` |
| **Tokens** | Rogi, odstępy, cienie i każda inna nazwana wartość | `tokens` |
| **Files** | Obrazy, audio i pliki ruchu, które przechowuje Twoja marka | `catalogue` |
| **Rules** | Reguły, które stosuje Twoja marka, sprawdzane na prawdziwych przykładach | `usage` |
| **Umiejętności** | Spisane standardy marki dla ludzi i agentów, do czytania i pobrania | `skills` |

Do pokoju prowadzi `#/start?area=<key>`. Pokój Files zachowuje klucz `catalogue`, Board zachowuje `overview`, a Rules zachowuje `usage`, ponieważ klucz pokoju to trwały kontrakt, a `?tab=` nadal działa jako starszy alias. Nieznany klucz otwiera Board.

**Pasek** zawiera akcje dla całego systemu, a nie dla jednego pokoju. **Add from…** wprowadza markę ([Bring a brand in](#bring-a-brand-in)), a **Tray** przechowuje to, co znalazło skanowanie, a czego jeszcze nie dodałeś. **Export** zapisuje system jako jeden plik, a **More** zawiera **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions & publishing**, **Restore brand settings** i **Design systems**, który otwiera listę w Settings, gdzie przełączasz systemy ([Keep and move your design system](#keep-and-move-your-design-system)). Każdy pojawia się, gdy jest na czym działać. Na telefonie **Add from…** przenosi się do **More**, a **Export** wygląda jak ikona.

## Board

Gdy nic jeszcze nie wybrano, Board oferuje cztery sposoby na start. **Start from a reference** otwiera selektor źródła dla logo, zrzutu ekranu, strony internetowej lub pliku projektu, a **Pick a colour**, **Choose a face** i **Add a logo** otwierają te kontrolki bezpośrednio. Otwarcie którejś niczego nie zapisuje, a **Explore the tools** jest od początku.

Gdy cokolwiek jest Twoje, Board pokazuje, co masz, z Twoimi własnymi liczbami na przodzie. Colours podaje liczbę kolorów, z przygaszonym `· N starter` tam, gdzie widać odziedziczone kolory; jego pasek stawia Twoje kolory pierwsze, potem cienką linię, potem wyblakłe kolory startowe. Colourways pokazuje każdy colourway jako mały kafelek w kolorze wiodącym. Type czyta się według ról i ustawia każdą rodzinę w jej własnym kroju (*Inter for headings*, z *Starter for the rest* w linii poniżej). Logos mówi, ile slotów jest wypełnionych (lub **Not set**), Tokens pokazuje promień rogu, a Files mówi **Nothing yet**, gdy biblioteka jest pusta. Każdy blok otwiera swój pokój.

System projektowy, który przyszedł z aplikacją i można go edytować, jak Lolly Demo, ma to wszystko od początku: Board pokazuje jego kolory, colourway, kroje i znaki, z tagiem **Came with this app** obok nagłówka.

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
- Liczone w Board i w Tokens.
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

![Sloty logo z otwartymi Horizontal i Vertical: każdy wariant ma własny slot i każdy slot jest opcjonalny](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&system=new-design-system&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails.be-logo-group--fold%3Anot%28.be-logo-group--custom%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** to znaki, które Twoja marka nazywa własną nazwą, takie jak ikona, herb lub favicon.
- **Więcej tożsamości.** Submarka, produkt lub wydarzenie mogą mieć własny pełny zestaw: **+ Add another logo** i nadaj zestawowi nazwę. Twój główny zestaw to "Your logo". [Brand architectures](/info/brand-architectures.html) pokazuje, kiedy tożsamość logo jest właściwym klockiem.
- **Lolly odczytuje kolory logo.** Karta pod strefą upuszczania i ponownie u góry Colours wymienia kolory logo i pyta **Which is the main colour?**, z już wybranym najsilniejszym kolorem (nigdy białym, na którym logo wyeksportowano). **Use these colours** dodaje je do palety, czyni główny kolor kolorem podstawowym i, gdy logo ma ciemny neutralny czytelny na papierze, czyni go kolorem tekstu. **Not now** zostawia je w Tray. Na całkiem nowej instalacji najbardziej prawdopodobna odpowiedź jest stosowana od razu, a karta oferuje **Undo** lub inny kolor główny. SVG daje dokładne kolory; PNG, JPEG lub WebP dają kolory pokrywające realną część znaku.

## Colours

Pokój rośnie razem z systemem projektowym: pierwsza wizyta to jedna decyzja, a reszta przychodzi wraz z paletą.

### Pierwszy kolor

System bez własnych kolorów pokazuje neutralne kolory startowe, otwarte we własnej grupie, a u góry pokoju przerywane pole wklejania i upuszczania: jeden duży znacznik i jedno pole. Upuść obraz lub listę kolorów w dowolnym miejscu pola, a Lolly odczyta kolory z tego, co upuściłeś.

- **Znacznik jest selektorem.** Naciśnij **Wybierz kolor**, a otwiera się karta OKLCH studia, zasilona tym, co zawiera pole: najpierw nazwa koloru i hex, a pod **Dostrój** przestrzenie kolorów, koło, cztery pokrętła i alfa, z **Anuluj** i **Dodaj kolor** na dole. Nic nie trafia do systemu, dopóki nie naciśniesz **Dodaj kolor**.
- **Pole przyjmuje dowolny zapis**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` lub nazwę koloru. Wklej listę, a stanie się rzędem znaczników do dodania pojedynczo lub przez **Dodaj wszystko**.
- **Dwa kolejne sposoby.** **Wybierz kolor z ekranu** używa zakraplacza, gdy przeglądarka go ma, a **Pobierz kolory z obrazu** czyta zrzut ekranu lub zdjęcie na tym urządzeniu.
- **Dodaj nigdy nie jest wyłączone.** Przy pustym polu otwiera selektor; tekst, którego nie potrafi odczytać, dostaje pod polem linię mówiącą o tym.

Twój pierwszy kolor staje się **primary**, a znacznik to potwierdza, na przykład *"Primary is now Vivid Violet"*, z **Fine-tune** do dostrojenia koloru.


### W miarę jak paleta rośnie

Twoje kolory leżą obok podglądu **W kontekście** na szerokim ekranie i nad nim na mniejszym. Podgląd pokazuje plakat, wykres lub kartę interfejsu w Twojej palecie. Kolory startowe zostają we własnej zwijanej grupie, która zwija się, gdy system ma już własne kolory, a pole wklejania i upuszczania staje się jednym zwartym rzędem. Eksport jest w **Eksportuj** na pasku i w pokoju Tokens, więc nagłówek pokoju go nie zawiera.

![Pokój Colours w Lolly Demo: paleta w zwijanych grupach, każdy kolor z nazwą i hex, oraz pobieranie palety w nagłówku](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![Pokój Colours w Lolly Demo po dodaniu jednego koloru: tabela Colour roles, potem znacznik nowego koloru z opcjami Use as Lead? i Fine-tune, obok żywego podglądu kompozycji](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Role kolorów: jak nazywają się kolory

System projektowy mówi, jak nazywają się jego kolory i do czego służy każdy z nich, a Lolly to odczytuje. **Role kolorów** są na początku pokoju Colours. Na szerokim ekranie **W kontekście** dzieli widok, więc zmiana widać na plakacie, wykresie i karcie interfejsu w trakcie jej wprowadzania.

![Tabela Colour roles w Wefthouse, zmyślonej marce tekstylnej, we własnych słowach: znaczniki colourway Indigo, Madder i Weld, potem Main, Accent, Supporting i Tertiary, każda z kolorem jasnym i ciemnym, odczytane jako kolor wiodący, kolor partnera i tylko po nazwie, a Background, Text, Quiet text i Hairlines wymienione pod tabelą jako odczyty, których żadna rola nie wypełnia](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=wefthouse&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

Tabela ma cztery kolumny, a na telefonie każdy wiersz staje się kartą, która trzyma jasny i ciemny obok siebie:

| Kolumna | Co zawiera |
|---|---|
| **Rola** | Własne słowo systemu projektowego, które możesz edytować w miejscu, oraz linia mówiąca, do czego służy kolor |
| **Jasny** i **Ciemny** | Kolor w tym wyglądzie dla wybranego colourway, z jego nazwą lub wartością i kontrastem |
| **Lolly odczytuje to jako** | Co narzędzie robi z rolą, własnymi słowami Lolly |

**Jak Lolly odczytuje rolę.** Każdy odczyt przypada jednej roli, więc wybranie odczytu, który ma inna rola, przenosi ten odczyt tutaj. Lolly nigdy nie wyczytuje znaczenia ze słowa.

| Odczyt | Co z niego wynika |
|---|---|
| **Kolor wiodący** | Duże kształty, przyciski, kolor, od którego narzędzie zaczyna |
| **Kolor partnera** | Drugi kolor, po który sięga narzędzie |
| **Tło** | Leży za wszystkim innym |
| **Tekst** | Nagłówki i tekst podstawowy |
| **Tekst drugorzędny** | Podpisy i drobny druk |
| **Cienkie linie** | Linie, obramowania i separatory |
| **Tylko po nazwie** | Żadne narzędzie nie wybiera tej roli samo. Jest oferowana w każdym polu koloru i w Design, gdzie wybór pozostaje powiązany, więc podąża za colourway |

Odczyt, którego żadna rola nie wypełnia, zostaje taki, jak definiuje go system projektowy, a pokój wymienia je pod tabelą. Rola, która ma id odczytu, na przykład rola o nazwie Primary, jest tym odczytem i nie można jej przenieść.

**Wartości.** Naciśnij wartość, aby wybrać kolor dla tej roli, w tym wyglądzie, w wybranym colourway. **Tak samo jak jasny** sprawia, że ciemna wartość podąża za jasną, dopóki nie wybierzesz własnego koloru. Znacznik **Aa** pokazuje tekst, który Lolly dobiera do koloru, a linia pod wartością mówi, jak ten tekst się czyta, dla każdego wyglądu: **Tekst jest czytelny**, **Tylko duży tekst** lub **Trudny do odczytania jako tekst**. Dotyczy to tekstu na kolorze i nic nie mówi przeciw samemu kolorowi, który nadal może sprawdzać się w kształtach i dużych polach. Rola odczytywana tylko po nazwie pokazuje te same słowa bez koloru ostrzeżenia, bo żadne narzędzie samo nie kładzie na niej tekstu. Liczby za słowami, najpierw APCA, potem WCAG, są w podpowiedzi i w selektorze. **Własny kolor tekstu** oznacza wartość, której plik podaje kolor tekstu, który zostaje. **Skopiowano** oznacza wartość, która pochodzi z innego colourway lub z koloru partnera i której nikt jeszcze nie wybrał; **Zachowaj ten kolor** w selektorze rozstrzyga wartość.

**Punkty startowe.** System projektowy bez własnych ról pokazuje dzisiejsze słowa: Primary, Secondary, Surface i Text. Nic nie jest zapisywane, dopóki jednego nie zmienisz. **+ Dodaj rolę** oferuje jako sugestie **Primary, Secondary** albo **Main, Accent, Supporting, Tertiary** lub dowolne słowa, które wpiszesz, z odczytem, jaki każde by dostało. Pierwsze dwa słowa stają się kolorem wiodącym i kolorem partnera. Narzędzia rysują nadal te same kolory, a w systemie z jednym kolorem wiodącym pierwszy colourway nosi nazwę od tego koloru.

**Zmiana nazwy, kolejności, usuwanie.** Zmiana nazwy zmienia tylko słowo, więc wszystko, co używa roli, nadal działa. Przeciągnij rolę za uchwyt albo naciśnij Space na uchwycie, użyj klawiszy strzałek i naciśnij Space, aby upuścić. **Usuń** mówi, co jeszcze używa roli. Gdy narzędzia ją czytają, **Usuń i zachowaj te kolory** zostawia każdemu odczytowi kolor, który rysuje teraz. Reguła marki, grupa przewodnika, pole narzędzia lub inny token, który używa roli, trzyma ją, dopóki to użycie się nie zmieni. Zapisany dokument Design może też użyć roli po nazwie, a Lolly nie widzi tego w pliku tokenów: dokument, który to robi, zgłasza kolor jako nierozwiązany.

**Plik napisany ręcznie.** Kolory, które plik tokenów zawiera, a żadna rola ich nie deklaruje, są wymienione pod **W tym pliku, jeszcze bez roli**, każdy z polem na słowo i **Utwórz rolę**. Tak czy inaczej nadal działają po nazwie. Token z cyframi w nazwie nie może być rolą, więc zostaje w pliku i działa po swojej ścieżce. Zapis w pliku, który się nie waliduje, pokazuje tabelę bez kontrolek i mówi dlaczego.

**Reszta pokoju mówi tymi samymi słowami.** Znaczniki, wiersz **Użyj jako** próbki i grupa **Role kolorów** palety używają słów systemu projektowego, a kafel roli koloru otwiera jej wartość. Wyeksportowane pliki nie zapisują o rolach nic nowego: kolory w renderze zmieniają się, bo zmieniły się tokeny.

**Dokąd trafiają słowa.** Słowa i opisy podróżują z systemem projektowym. Agenci czytają je w briefie projektowym, `lolly://tokens` i `AGENTS.md` strony marki, terminal pokazuje je w `lolly system status`, a strona marki wymienia je w `brand.json` i mierzy parę kontrastu dla każdej roli. Każdy format eksportu zachowuje to, na co ma miejsce: pliki DTCG i Tokens Studio zachowują wszystko, `DESIGN.md` zachowuje słowa i odczyty, a motyw PowerPoint zachowuje tylko kolejność marki. [Colour roles in other formats](/info/design-tokens.html#colour-roles-in-other-formats) podaje pełną listę. Słowa są zawsze cytowane jako dane systemu projektowego, nigdy czytane jako instrukcje.

**Gdzie wybiera się kolor.** Każde pole koloru w narzędziu i w Lolly Design zaczyna się od ról systemu projektowego, w jego własnej kolejności, z widocznym każdym słowem i tym, do czego służy kolor. **Aa** obok roli wybiera kolor, który leży na tej roli. Reszta następuje pod **Pozostałe kolory**, bez własnych kopii colourway, kolorów na kolorze i odczytów, które rola już wypełnia. Wybór pozostaje powiązany z rolą i podąża za colourway, pole nadal pokazuje słowo bez względu na wybrany colourway, a Settings i Tokens też używają tego słowa. System projektowy bez ról zachowuje siatkę próbek, którą zawsze miał.

### Każdy kolor, który czyta narzędzie

Gdy **Role kolorów** są zamknięte, pierwsze decyzje prowadzą pokój jako znaczniki, każdy z kolorem, który gra rolę, i jego nazwą. W systemie bez własnych słów są to **Podstawowy**, **Wtórny**, **Powierzchnia** i **Tekst**. Naciśnij znacznik, aby wybrać jego kolor spośród próbek palety. **Każdy kolor, który odczytuje narzędzie**, na dole **Ról kolorów**, ma pełny pasek.

Pasek pokazuje siedem kolorów, które może czytać narzędzie: Primary, Secondary, Surface, Text, Muted, Edge i On primary, słowami systemu projektowego, gdy je ma. Każdy gra tę samą część w każdym narzędziu i eksporcie. Żadnego z nich nie trzeba ustawiać (trzy luźne kolory to dobry system), każdy kolor może wypełnić jeden, a odczyt mówi, jak czyta się tekst, mierzony względem powierzchni, najpierw APCA. Każdy wiersz pokazuje własny kolor w pełnej sile, zastępczy kolor startowy albo **↳ podąża za Podstawowym**.

On primary jest wyprowadzony z koloru podstawowego, brzmi **Wyprowadzony** i nie ma selektora. Przełącznik **Jasny** i **Ciemny** obok niego oraz ten obok **W kontekście** wybierają, który wygląd pokazują pasek, paleta i podgląd.

Własny akcent aplikacji domyślnie podąża za systemem projektowym. To ustawienie **Interface follows the design system** w **Settings → Appearance**; wyłączenie go zostawia obramowanie aplikacji neutralne, a narzędzia, kanwy i eksporty podążają za systemem projektowym w obu przypadkach.

**Colourways.** System projektowy może mieć kilka kolorów wiodących, wybieranych dla każdej pracy. Wiersz **Warianty kolorystyczne** na początku **Ról kolorów** pokazuje po jednym znaczniku na colourway, a **Domyślny** oznacza ten kanoniczny. **+ Dodaj** tworzy nowy colourway na podstawie jednego z kolorów palety. Wybierz znacznik, a tabela, pasek, paleta i podglądy pokazują ten colourway; wybranemu colourway można zmienić nazwę, zduplikować go, ustawić jako domyślny lub usunąć. W systemie z colourway każdy colourway potrzebuje własnego koloru podstawowego i drugorzędnego, a własnej powierzchni, gdy colourway barwią tło, więc te role zostają w edytorze próbek. [Add colourways to a design system](/info/colourways.html#add-colourways-to-a-design-system) zawiera kroki i format tokenów, a [Lolly Demo in use](/info/lolly-demo-in-use.html#colourways-on-real-work) pokazuje colourway na prawdziwej pracy.

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

Paleta wymienia Twoje kolory w zwijanych grupach, każda z własnym **+ Dodaj**. Twórz i zmieniaj nazwy grup, jak chcesz. Rola nigdy nie tworzy drugiego kafla: kafel, na który wskazuje rola, nosi zamiast tego nazwę roli, na przykład **Podstawowy**. **Wykres kolorów** pod kaflami pokazuje te same kolory na **Kole** OKLCH (przeciągnij kropkę, aby przekolorować, kliknij puste miejsce, aby dodać próbkę) i wykresie **Gamut**, który pokazuje, gdzie kończy się zakres wyświetlania. `#/start?area=color&focus=chart` otwiera wykres bezpośrednio.

![Panel palety, każda grupa zwijalna, z pobieraniem palety w nagłówku](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Koło OKLCH - kąt to odcień, odległość od środka to nasycenie, a szarości poruszają się po pasku jasności z boku](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Kliknij próbkę, aby otworzyć jej edytor:

- **Rename** próbkę.
- **Ustaw kolor** na suwakach OKLCH lub w **Hex**, **HSL**, **RGB** albo **CMYK**. Pole wartości czyta i zapisuje w aktywnej przestrzeni. CMYK tutaj ustawia kolor ekranowy przez konwersję; aby przypiąć dokładne farby, użyj **Zamienniki drukowe**.
- **Zapisane jako** wybiera, jak próbka jest zapisana: **LCH** (domyślnie, percepcyjny i szeroki gamut), Hex, RGB lub HSL.
- **Użyj jako** nadaje próbce rolę bezpośrednio, słowami systemu projektowego, gdy je ma. Naciśnij podświetloną rolę ponownie, aby ją wyczyścić.
- **Zamienniki drukowe** (zwinięte): zablokuj **CMYK** z **Auto** na dokładne wartości farb albo ustaw **Kolor spot** z **Nazwą** (taką jak `PANTONE 186 C`), opcjonalną **Book** i **Wykończeniem** dla folii, wytłoczenia, wgłębienia, lakieru wybiórczego, soft touch albo wykrojnika, bigowania lub perforacji. Maszyna drukarska używa tych blokad, gdy eksportujesz PDF lub TIFF CMYK; zobacz [Colour profiles](/info/exporting.html#colour-profiles).
- **In other spaces** (zwinięte): wartość dla każdej przestrzeni kolorów, wyprowadzona lub napisana przez Ciebie, a napisana wygrywa przy eksporcie.

**Usuwanie próbki** jest bezpieczne. Wyprowadzone odcienie i role motywu są ukrywane, więc nic, co je czyta, się nie psuje, a dodane przez Ciebie kolory są usuwane.

::: details Praca z wieloma próbkami
Każda próbka ma uchwyt do przeciągania. Przeciągnij, aby zmienić kolejność w grupie, lub ustaw fokus na uchwycie, naciśnij Space, użyj klawiszy strzałek i naciśnij Space ponownie, aby upuścić; Escape anuluje. Na telefonie paleta pokazuje cztery kolory w rzędzie, a uchwyty pojawiają się w trybie Select, zamiast jako rząd pod każdym kolorem. Aby przenieść kolory między grupami, użyj kontrolki **Group** edytora lub zaznacz kilka i użyj **Move to**.

Zaznaczanie nie wymaga osobnego przełącznika. Pasek i pola wyboru pojawiają się z pierwszym zaznaczonym kaflem i znikają z ostatnim.

- **Przeciągnij po pustym miejscu**, aby narysować prostokąt; każdy kafel, którego dotknie, dołącza do zaznaczenia, także między grupami. Zwinięta sekcja niczego nie dodaje.
- **Kliknięcie z Shift** bierze zakres w kolejności czytania, **kliknięcie z Cmd/Ctrl** przełącza jeden kafel, a zwykłe kliknięcie otwiera edytor.
- Każdy nagłówek grupy ma **Select all**, a **Cmd-A** z fokusem na kaflu bierze każdy kolor, który posiadasz, nigdy startowy.
- Siatka ma jeden punkt tabulacji: strzałki przesuwają, Shift-strzałki rozszerzają, Space przełącza, Delete usuwa, a Escape czyści. Aby dostroić kanał, najpierw naciśnij `l`, `c` lub `h`.
- Na ekranie dotykowym naciśnij i przytrzymaj kafel, aby zacząć zaznaczanie, a potem stukaj, aby dodawać.

Pasek brzmi **{n} selected**, potem **Move to**, **Give a role** (każdy kolor dostaje kolejną rolę po kolei), **Download** (zaznaczenie w dowolnym z sześciu formatów palety), **Duplicate** (kopia każdego, umieszczona po oryginale), **Copy values** i **Delete**. Jedna kopia otwiera się od razu w edytorze; kilka pozostaje zaznaczonych. Jedno Cmd/Ctrl-Z cofa całą akcję zbiorczą.
:::

### Gradienty

Opcjonalny panel **Gradients** buduje tokeny przejść z palety. Każdy gradient ma podgląd, od 2 do 8 nazwanych punktów i kąt. Punkt wskazuje próbkę, więc przekoloruj próbkę, a gradient podąży. Przejścia liczą się w OKLCH.

Pobrania palety (tokeny projektowe, CSS, SCSS, GIMP i Adobe Swatch Exchange) leżą w nagłówku palety, obok jej tytułu. [Take your palette and fonts anywhere](/info/using.html#take-your-palette-and-fonts-anywhere) opisuje każdy format.

## Typografia

Bez własnego kroju pokój to jedna karta: **Primary**, złożona w rozmiarze do czytania w kroju, który obsługuje go dziś, z tagiem **Starter**, przyciskiem **Choose for Primary** i linią *"Nothing installs until you choose one."* Headings, code i italic podążają za primary, dopóki ich nie wybierzesz; **Choose them separately** pokazuje ich karty.

![Pokój Type z jeszcze niewybranym krojem - jedna karta w rozmiarze czytelnym, ze znacznikiem Starter, i jedno wypełnione Choose for Primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Wybierz jeden krój, a pokój otwiera się na cztery karty ról, listę Fonts i próbkę na żywo:

- **Primary**: tekst podstawowy, przyciski i każde narzędzie.
- **Headings**: krój wyświetlania dla `h1` i `h2`.
- **Code**: krój o stałej szerokości dla kodu i danych.
- **Italic**: prawdziwa kursywa do wyróżnień, cytatów i dygresji.

Karta jest zabarwiona tylko tam, gdzie zainstalowałeś ten krój. Jej przycisk mówi, dla jakiej roli jest: **Change Headings** dla Twojego własnego kroju i **Choose for Headings** wszędzie indziej. Linia próbki zawija się zamiast się ucinać. Nic na karcie niczego nie zatwierdza: przycisk otwiera scenę porównania dla tej roli.

![Odsłonięte cztery karty ról - każda złożona w kroju, który ją obsługuje, ze znacznikiem Starter tam, gdzie nikt nie wybrał, i Italic podążającym za primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Etap porównania

Scena otwiera się wewnątrz pokoju, pod naciśniętą kartą, a karty zwijają się do paska jednej linii, aby scena była widoczna na pierwszym ekranie telefonu. Escape anuluje i zwraca fokus na kartę.

1. Naciśnij **Choose for** i rolę na karcie.
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
- **Kafle** liczą każdy rodzaj tokenu i przeskakują do jego sekcji: Colours, Type, Logos, Shape and spacing, More i All tokens. Liczą to, co zawiera każda sekcja; sekcja zawierająca tylko to, co przyszło z pustym szablonem startowym, nosi tag **Starter**, a system, który przyszedł z aplikacją, liczy własny materiał bez tagu. Na telefonie kafle zawijają się do dwóch rzędów po trzy.
- **Colours** zaczyna się od par, które narzędzia zestawiają (tekst na powierzchni, na kolorze podstawowym, przygaszony na powierzchni) z odczytem APCA w jasnym i ciemnym oraz oznacza **Weak contrast**, gdzie para nie dosięga. Potem każda grupa kolorów: rampa jako jeden rząd znaczników, inne kolory z wartością i odwołaniem, którego używają narzędzia, takim jak `{color.brand.spearmint}`. Naciśnij odwołanie, aby je skopiować. **Edit in Colours** otwiera grupę w pokoju Colours. W systemie projektowym z [rolami kolorów](#colour-roles-what-the-colours-are-called) pierwsze są **Colour roles**, każda rola raz, własnymi słowami i w kolejności systemu. Rola zawiera kolor dla każdego wariantu kolorystycznego i wyglądu, a te kolory zostają przy roli i nie pojawiają się jako osobne kolory: zmieniaj je w tabeli Colour roles.
- **Type** i **Logos** wymieniają krój dla każdej roli i każdy slot logo, z **Edit in Type** i **Edit in Logos**, gdy masz własne.
- **Shape and spacing** zawiera **Rounded corners** (`shape.radius`) i **Spacing rhythm** (`space.base`). Każdy brzmi *Lolly default*, dopóki nie przesuniesz suwaka, i *Yours* potem, zapisuje się od razu i można go cofnąć.
- **More tokens** dodaje odstępy, rozmiary, grubość obrysu, krycie, obrót, zwykłe liczby i cienie, zapisane jako standardowe [tokeny projektowe](/info/design-tokens.html).
- **App appearance (advanced)** wymienia kolory, rozmiary i cienie używane przez własne ekrany Lolly, a **Inspect every token (advanced)** przeszukuje i edytuje każdą zapisaną wartość, pokazując każdą zmianę do przeglądu najpierw. Tam wartości roli koloru w każdym wariancie kolorystycznym są wymienione razem z rolą: wybierz token roli, aby zobaczyć po jednym wierszu na wariant, jasny i ciemny obok siebie, a wiersz z liczbą mówi, ile wartości zawierają role. System projektowy tylko do odczytu pokazuje tę samą listę.

Sekcja, w której nic nie ma, oferuje sposób na wypełnienie luki: **Pick a colour**, **Choose a face** lub **Add a logo**.

## Pliki

Upuść pliki, które przechowuje Twoja marka, poza logo: pliki **vector**, **image**, **audio** i **motion** (wideo, Lottie i animacje). Pojawiają się w [Assets](/info/using.html#assets-your-library), posortowane w sekcje i gotowe w selektorze zasobów każdego narzędzia, i zostają na tym urządzeniu.

## Rules

**Rules** wprzęga wybory Twojej marki do pracy: co ludzie mogą zmienić, co zostaje stałe i co Lolly może sprawdzić.

![Rules w Lolly Demo: cztery reguły marki, każda oznaczona Checked in Lolly Design oraz Required lub Advisory, potem Try your design system in use z gotowymi do wyrenderowania przykładami](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** wymienia Twoje reguły. **Add rule** (lub **Add your first rule**) otwiera krótki formularz:

- **Nazwa reguły** Twoimi słowami, na przykład *Beacon accents*;
- **Sprawdzenie**: **Colour choices**, **Font choices**, **Fixed artwork** lub **Text length**, z rolą marki, której używa, pod Twoją własną nazwą tej roli;
- **Przykład**, do którego się stosuje (Poster, Title slide, Content slide lub Lolly Chart), **Tryb** oraz to, czy jest **Wymagana** czy **Advisory**;
- **Sprawdził**, potem **Zapisz szkic** lub **Zatwierdź i zapisz**.

Zatwierdzenie zapisuje Twoją własną decyzję na tym urządzeniu. Zatwierdzone reguły wymagane ograniczają plakat wielokrotnego użytku, a kontrole obejmują tylko przykładowe PNG; nie zmieniają żadnego innego narzędzia.

Reguły, które system projektowy niesie ze sobą w pliku tokenów, takie jak zatwierdzone pary kolorów, grubość i wyrównanie tekstu albo logo dla każdej powierzchni, są tu wymienione jako **Checked in Lolly Design**. Lolly Design sprawdza je warstwa po warstwie na karcie **Przed eksportem** w panelu eksportu, a `lolly check` robi to samo dla zapisanego dokumentu Lolly Design ([Before you export](/info/design.html#before-you-export)). Reguła, do której ta kompilacja nie ma sprawdzania, jest zachowana tak, jak ją dostarczono, i oznaczona jako **Niesprawdzone**.

Lolly Demo przynosi cztery zatwierdzone reguły marki. Nagłówki nigdy nie są składane wersalikami: ta reguła jest wymagana, więc `lolly check` zgłasza nagłówek z wersalików jako błąd. Pozostałe trzy są doradcze. Tekst podstawowy jest wyrównany do lewej. Znaki podstawowe leżą na jasnych powierzchniach, a odwrócone na ciemnych. Linie przerywane oznaczają: upuść tutaj.

**Wypróbuj swój system projektowy w użyciu** renderuje cztery przykłady z bieżącej wersji przez **Wyrenderuj i sprawdź przykłady**. Wybierz **Tryb** i **Wypróbuj własny tekst** dla nagłówka, tekstu pomocniczego i tekstu slajdu. Każdy przykład zgłasza, co zmierzono, z **Zobacz kontrole i źródła** i **Pobierz raport kontroli**, a **Zrób plakat wielokrotnego użytku** pobiera `.lolly`, którego stały układ i zatwierdzone wybory danych wejściowych podróżują z plikiem. Przykłady są lokalne: uruchomienie sprawdzenia niczego nie publikuje ani nie zatwierdza.

Kompilacja dostarczana ze stałą marką pokazuje te same reguły i przykłady tylko do odczytu, pod *This brand is set*.

## Umiejętności

**Umiejętności** wymienia [brand skills](/info/brand-skills.html) aktywnego systemu projektowego: spisane standardy marki, po jednym na dyscyplinę, dla ludzi i agentów AI. Każdy wiersz podaje dyscyplinę, własny status marki (**Wersja robocza** lub **Zatwierdzone**), informację, czy umiejętność jest publiczna czy wewnętrzna, oraz jej rewizję. Wybierz wiersz, aby przeczytać umiejętność obok jej pokrycia, które zestawia linie umiejętności z Twoimi tokenami: co Lolly sprawdza, co jest sprzeczne, co się zgadza i co jest tylko wskazówką.

**Pobierz umiejętność (.zip)** zapisuje umiejętność jako folder Agent Skills dla narzędzia agenta, z linkami do katalogu wskazującymi na ten Lolly, a **Kopiuj jako jeden plik** kopiuje ten sam tekst do schowka dla okna czatu. System projektowy bez własnych umiejętności wyświetla wersję bazową, którą Lolly zapisuje z jego tokenów i reguł stylu marki za każdym razem, gdy jest ona czytana. Pokój tylko czyta umiejętności i nigdy ich nie edytuje.

## Wprowadź markę

**Dodaj z…** na pasku otwiera selektor, który pyta, co masz, a nie jaki to format:

- **Design tokens or a design file**: JSON DTCG lub Tokens Studio, projekt Penpot, zip zestawów tokenów, pakiet systemu projektowego Lolly, SVG, `DESIGN.md` lub folder strony marki.
- **PDF**: prezentacja lub plik wytycznych, czytany na tym urządzeniu pod kątem kolorów, znaków i osadzonych krojów pisma.
- **Logo lub zrzut ekranu**: obraz staje się sugerowaną paletą, czytaną na tym urządzeniu. Odczytuje kolory, nie krój pisma ani układ.
- **Zapisana strona internetowa**: jeden plik HTML i jego pliki CSS albo wklejony HTML lub CSS, do 20 plików i 2 MB. Czytany jest tylko tekst, który dostarczysz: połączone zasoby nie są pobierane, a skrypty się nie uruchamiają.
- **Plik czcionki**: TTF, OTF lub WOFF. Otwiera pokój Type, gdzie krój się instaluje.
- **Strona internetowa**: jedna strona, czytana pod kątem kolorów i kroju pisma. Ten kafel pojawia się tylko na urządzeniu, które potrafi odczytać stronę, i mówi, którego czytnika używa: aplikacji na tym urządzeniu albo rozszerzenia przeglądarki w karcie w tle, zalogowanego jako Ty. Wpisanie adresu URL tylko wypełnia pole; zgodą jest naciśnięcie pobierania.

Wybierz źródło pliku projektu, a następna karta wymienia akceptowane formaty jako kafle z ikonami, z całą kartą jako jednym celem upuszczania. Możesz też upuścić plik prosto na studio.

![Karta importu - akceptowane formaty prowadzą jako kafelki z ikonami, a cała karta jest jednym obszarem upuszczania](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- **Pakiet systemu projektowego Lolly** (`.lolly` lub starszy `.zip`) instaluje się w jednym kroku.
- Eksport **Penpot** (`.penpot`) wnosi swoje tokeny projektowe.
- Plik **Design Tokens** (W3C DTCG) lub **Tokens Studio** (`.json`) wnosi swoje tokeny. Opis, który prosi czytelnika o zignorowanie instrukcji, deklaruje uprawnienia lub prosi o uruchomienie kodu, jest pomijany, a import mówi, gdzie się znajdował. To sprawdzenie linia po linii i nie wychwytuje innych sformułowań, więc przeczytaj plik od kogoś, kogo nie znasz, zanim zastosujesz tokeny.
- **Zwykły SVG** jest skanowany pod kątem kolorów, z których wybierasz, a pierwszy staje się Twoim kolorem podstawowym.
- **`DESIGN.md`** (`.md`) trafia do **Try these colours** z tokenami tak, jak je napisano. Jego prozę można zachować jako szkic umiejętności marki, a karta oznacza linie, które proszą czytelnika o zignorowanie instrukcji, deklarację uprawnień lub uruchomienie kodu. Agenci i strony marki nie widzą szkicu, dopóki nie naciśniesz **Zachowaj tę umiejętność** w pokoju Skills, a zachowana umiejętność pozostaje wewnętrzna.
- **Folder strony marki**, wybrany jako folder, upuszczony lub spakowany, trafia do tego samego przeglądu. Każdy plik jest sprawdzany względem `brand.json` folderu, a plik, który nie pasuje, odrzuca cały folder. Dodaje tokeny. Logo i czcionki zostają w folderze.

Lolly czyta stronę marki z plików, które dostarczysz. Nie pobiera adresu innej witryny.

### Plik z własnymi słowami o kolorach

Plik tokenów lub `DESIGN.md` może używać własnych słów dla swoich kolorów, takich jak main, accent, supporting i tertiary. Gdy Lolly znajdzie takie słowa, przegląd wymienia każde z nich, zanim cokolwiek zostanie zastosowane: słowo, jego kolor w każdym wyglądzie, token, z którego pochodzi, i jako co Lolly by je odczytał. Lolly sugeruje te odczyty wyłącznie ze słów, względem krótkiej listy, i nie używa żadnego modelu. Słowo spoza listy trafia jako własne słowo marki, **Tylko po nazwie**. Zmień nazwę dowolnego słowa, powiedz, do czego służy, odczytaj je jako coś innego albo odznacz je, aby zostało nazwanym kolorem.

**Zainstaluj z tymi rolami** zapisuje je, a **Zainstaluj bez ról** instaluje plik dokładnie takim, jaki przyszedł. Plik bez takich słów nie pokazuje nowego kroku. Plik, który podaje własne role, taki jak napisany przez Lolly, pokazuje je tak, jak napisano, i instaluje bez zmian, a później możesz je edytować w pokoju Colours. Terminal nie ma przeglądu, więc `lolly system import` zachowuje podany zapis, a słowa z innych plików zostawia jako nazwane kolory.

### Przejrzyj odniesienie

Logo, zrzut ekranu, strona internetowa lub zapisana strona otwiera **Try these colours**: przykład w proponowanych kolorach, **Main colour**, który możesz zmienić, i nazwę nowego systemu. Ramka opisuje, co robi zastosowanie: **replaces** aktywne ustawienia tokenów wygenerowaną paletą i domyślnymi stylami, **keeps** Twoje czcionki i pliki biblioteki, a poprzedni system można **recovered**. **Apply suggested settings** stosuje palety jasną i ciemną, po punkcie kontrolnym, a **Restore brand settings** może przywrócić stare ustawienia. **Change reference** wybiera inne źródło.

**Palette, source details and individual choices** pokazuje, co odczytano, znalezione nazwy czcionek i kontrast podglądu. Nazwy czcionek to tylko sugestie; Type nadal jest miejscem, gdzie instalujesz krój. Szczegóły źródła mogą zawierać typografię, odstępy, wypełnienia i wartości rogów tam, gdzie je zaobserwowano, oznaczone **Not observed** w przeciwnym razie. Zapisana strona lub natywny odczyt witryny zgłasza deklarowane style, których strona może nie używać, a rozszerzenie przeglądarki może zgłaszać zmierzone style z próbki widocznych elementów. To obserwacje: nic nie jest instalowane, a odstępy źródła nigdy nie zastępują Twoich. **Choose individual items in the tray** zachowuje pojedyncze elementy, a **Download design context** zapisuje raport JSON z obserwacjami, proponowanymi tokenami i informacjami o źródle (z SHA-256 dostarczonego HTML lub CSS). Raport nie zawiera surowego tekstu strony i nie jest podpisanym Content Credential.

Importy PDF i plików projektowych zachowują własne kontrolki przeglądu. Elementy w **Tray** niczego nie zmieniają, dopóki nie dodasz ich w pokoju, który jest właścicielem tego rodzaju materiału. `#/start?source=<kind>` otwiera selektor na źródle (`file`, `pdf`, `image`, `font`, `url`, `page`), a `?import` otwiera zwykłą listę.

### Znajdź i porównaj wygląd

Otwórz **Find a look** z Board lub z listy systemów projektowych w Settings. Przeglądaj systemy zapisane na tym urządzeniu i kilka przykładów Lolly wielokrotnego użytku oraz szukaj po nazwie, tagu koloru lub deklarowanej czcionce. **Closest to my current palette** sortuje według zmierzonego podobieństwa kolorów, a pasujące czcionki rozstrzygają remisy; to nie jest ocena jakości.

Kliknij styl, aby zobaczyć go w kontekście. Podgląd niczego nie zmienia. **Użyj tego stylu** na każdej karcie używa tego stylu. Zapisany system staje się aktywnym, co niczego nie edytuje. Kolory przykładu przechodzą zwykłym punktem kontrolnym do otwartego systemu projektowego, którego logo, czcionki i wszystko inne, czego przykład nie definiuje, zostają bez zmian. **Porównaj style** dodaje pole wyboru do każdej karty, więc możesz wybrać dwa i porównać je obok siebie. **Przywróć ustawienia marki** odzyskuje poprzedni styl. Zapisane systemy mają edytowalne **Szukaj etykiet** pod **Szczegóły i kontekst projektowy**. Przykłady to oryginalne receptury kolorów Lolly, bez zebranej kolekcji i bez konta.

![Porównaj Sunroom i Orchard obok siebie, zanim zastosujesz którykolwiek z systemów kolorów.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

## Zachowaj i przenieś swój system projektowy

### Przenieś markę między urządzeniami

**Export** zapisuje jeden plik **`LollyBrand-….lolly`**: Twoje tokeny, czcionki, logo i preferencję motywu, z manifestem integralności sprawdzanym przy wczytywaniu z powrotem. Wydania web przed 1.0.7 nazywały ten sam plik `.zip` i ta pisownia nadal jest akceptowana. **Tokens (.json)** zapisuje sam zwykły dokument tokenów projektowych, bez czcionek i logo, dla repozytorium, kroku budowania lub innego narzędzia tokenów.

Aby przywrócić jeden, użyj **Add from… → Design tokens or a design file** albo upuść plik na studio. W ten sposób współpracownik przekazuje Ci markę lub przenosisz ją na drugą instalację, bez konta i bez chmury. [Współpraca z partnerami](/info/partners.html) opisuje, co jeszcze wysłać, gdy osoba otrzymująca Twoją markę pracuje dla innej organizacji. Aby wprowadzić markę z wiersza poleceń, zobacz [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** pakuje dodane przez Ciebie czcionki w instalowalny RPM. Jeśli któreś wgrałeś sam, Lolly najpierw prosi o potwierdzenie, że możesz je redystrybuować.

### Przywróć wcześniejsze ustawienia

Otwórz **More** na pasku, wybierz **Restore brand settings**, zaznacz datowany punkt kontrolny i naciśnij **Restore**. Przywraca kolory, ustawienia typografii i inne tokeny aktywnej marki; pliki czcionek i obrazów zostają bez zmian. Lolly najpierw zapisuje Twoje bieżące ustawienia jako **Before restore**, więc możesz cofnąć przywrócenie nawet po zamknięciu przeglądarki. Na tym urządzeniu zachowywanych jest ostatnich 20 punktów kontrolnych.

### Wersje

Opublikowana wersja to **stała, nazwana kopia** zachowana na tym urządzeniu. Nigdy się nie zmienia, więc narzędzie lub link, który ją przypina (przez `designv`), rysuje wciąż to samo. System z czymś Twoim wymienia **Versions & publishing** w menu **More** na pasku; po pierwszej publikacji **Versions** dołącza do pokoi. `#/start?area=versions` otwiera go bezpośrednio.

- **Wersja jest stała.** Nie ma jeszcze usuwania, a panel o tym mówi.
- **Usunięcia otwierają kartę zgodności**, ponieważ usunięty token to to, co psuje narzędzie.
- **Publikacji nie da się cofnąć; przywrócenie można.** *Restore latest from this version* to zwykła edycja, z **Undo** oferowanym od razu.

**Publish only** zachowuje wersję bez zmiany tego, za czym podążają narzędzia; **Publish and make active** sprawia, że narzędzia i aplikacja podążają za tą wersją. **Follow the latest again** sprawia, że każda edycja wchodzi na żywo w chwili jej wykonania.

### Opublikuj stronę marki

[Strona marki](/info/brand-page.html) to jeden adres dla ludzi i dla agentów: strona, która pokazuje logo, kolory, kroje pisma i przykłady, z tymi samymi faktami w plikach obok strony. **Opublikuj stronę marki**, pod Wersje i publikowanie, pokazuje działającą stronę i obok niej:

- **Zostaje upublicznione**: każdy plik, pogrupowany, z rozmiarem.
- **Wstrzymane**: co zostało poza, i dlaczego. Logo bez zapisanej licencji zostaje poza, dopóki nie zaznaczysz nazwy logo. Plik czcionki wymaga zapisanej licencji, która pozwala go przekazywać dalej, a strona pokazuje próbkę z konturów, gdy plik zostaje poza. Wewnętrzne umiejętności marki nigdy się nie pojawiają.
- **Co sprawdzono**: pary kolorów dla każdego colourway i trybu oraz reguły marki. To pomiary, a nie werdykt.
- **Własnymi słowami**: oświadczenie o użyciu i kontakt. Strona drukuje to, co napiszesz, a Lolly nie dodaje żadnej licencji ani deklaracji prawnej. Przełącznik wyłącza linię „Made with Lolly” w stopce.
- **W eksportach**: przełącznik, który [zapisuje adres strony w eksportach tego systemu projektowego](/info/brand-page.html#lead-back-from-your-files). Jest wyłączony, dopóki go nie włączysz, wymaga adresu `https` i nie podróżuje z pakietem ani kopią. Zablokowany system projektowy nie pokazuje przełącznika, bo decyduje jego zarządca.

**Pobierz folder** zapisuje folder jako ZIP, który hostujesz, gdzie zechcesz, i nic nie staje się publiczne, dopóki tego nie zrobisz. W terminalu `lolly system publish --out=<dir>` zapisuje ten sam folder. Instancja, która serwuje strony marki, oferuje też **Opublikuj w** swoim adresie, co jest jednym jawnym naciśnięciem i przechodzi przez łańcuch zatwierdzeń, jeśli taki ma. Zarządzany system projektowy publikuje się tylko wtedy, gdy zarządca na to pozwala.

### Podłącz agenta

**Podłącz agenta**, w tym samym miejscu, daje tekst do wklejenia i mówi, co potrafi każda opcja:

- **`AGENTS.md`** w projekcie: agenci czytają nazwy i reguły systemu. Niczego nie rysuje i nie wymaga serwera.
- **Publiczny serwer Lolly**: rysuje z Lolly Demo, niezależnie od tego, który system masz tu otwarty. Nie wymaga klucza.
- **Twoja instancja**: rysuje z systemami, które instancja przechowuje, i czyta token usługi ze zmiennej środowiskowej. Arkusz podaje nazwę zmiennej i nigdy nie pokazuje tokenu.

Gdy żaden hostowany serwer nie rysuje z Twoim systemem, arkusz o tym mówi.

## Zarządzaj swoimi systemami projektowymi

Otwórz **Settings → Preferences → Design systems**, aby przełączać, dodawać lub usuwać systemy. **Open** wybiera system i otwiera go tutaj; **Make a new one** tworzy lokalny system i otwiera go z gotowym polem nazwy. Aktywny jest jeden system naraz, dla całego urządzenia. [Brand architectures](/info/brand-architectures.html) pomaga zdecydować, kiedy marka potrzebuje własnego systemu projektowego.

**Skąd pochodzi system.** System dostarczony przez katalog wdrożenia brzmi **Came with this app** albo **From this instance** w aplikacji połączonej z jedną. Rozwiń **Catalogue source**, aby zobaczyć, kto go dostarcza, jego zasób tokenów i przestrzeń nazw oraz znaną wersję lub sumę kontrolną; jeśli odświeżenie zawiedzie, materiał z pamięci podręcznej jest oznaczony.

**Zarządzane systemy są tylko do odczytu.** System jest opisany jako **Zarządzane przez tę instancję** (lub **Zarządzane przez tę aplikację** w aplikacji desktopowej bez instancji), gdy jego katalog blokuje system. Możesz go używać i pobrać, a otwarcie go tutaj pokazuje notatkę tylko do odczytu z **Zrób edytowalną kopię** i **Przełącz**, potem jego role kolorów i tokeny bez kontrolek edycji. Twoje własne lokalne systemy pozostają edytowalne, nawet gdy zarządzany pojawił się pierwszy. Kompilacja z jedną stałą marką otwiera Lolly Design System Setup na *Ta marka jest ustawiona*, z tokenami i regułami użycia marki do przeczytania.

**Każdy inny dostarczony system jest Twój** do ukrycia, edycji i resetowania, w tym Lolly Demo i Lolly Starter na lolly.tools. Edycja jednego zachowuje jego nazwę i oznacza wiersz **Edited here**, a **Reset to original** w jego menu odrzuca zmiany wykonane na tym urządzeniu. Pusty starter jest wyjątkiem: pierwsza zmiana tam zaczyna Twój własny system projektowy, więc Lolly raz pyta, jak nazwać nowy system. [Lolly Demo in use](/info/lolly-demo-in-use.html#switch-to-your-own) pokazuje, co Twój własny system zastępuje.

### Usuwanie systemu projektowego

Wybierz **Remove** z menu systemu; potwierdzenie mówi, który system będzie potem aktywny. Zapisane sesje, wgrane pliki i materiał współdzielony z innym systemem zostają.

Usunięcie dostarczonego systemu tylko go ukrywa: jego zasoby katalogu zostają, **Bring back** pokazuje go ponownie, a wraca sam, jeśli usuniesz wszystko inne. Usunięcie zaimportowanej lub edytowanej kopii nie usuwa dostarczonego systemu, jego logo ani czcionek, a jeśli kopia była aktywna, dostarczony system znów staje się aktywny. Usunięcie aktywnej kopii hostowanej czyści tylko połączenie tej kopii; osobno wybrana instancja pozostaje wybrana.

Zmiana tego, co dostarcza serwer, to zadanie administratora: jego operator zmienia katalog źródłowy i wdraża ponownie albo administrator Lolly Work przegląda i stosuje zmianę serwera. Edycje tutaj pozostają lokalne, z jednym wyjątkiem: w instancji Lolly Work, która przyznaje Ci `brand.edit`, zarządzany system oferuje też **Edytuj dla** tej instancji, co otwiera kopię do edycji, a **Wyślij do** tej instancji w **Wersje** odsyła jego kolory, colourway, role kolorów i adres strony marki. [Edit this instance from the studio](/info/work-design-system-administration.html#edit-this-instance-from-the-studio) opisuje, co edycja może zmienić i jak instancja serwuje zmianę. Zobacz [Removing a catalogue design system](/info/configuration.html#removing-a-catalogue-design-system) i [Configuration](/info/configuration.html#supplied-and-local-design-systems).

## Używaj kontekstu projektowego poza aplikacją

**Pobierz kontekst projektowy** zapisuje dokument tokenów, rozwiązane kolory, zadeklarowane rodziny czcionek, id zasobów, dowody źródłowe, gdzie je zapisano, pokrycie i jawne reguły, bez plików czcionek i bez dowodu własności. Wiersz poleceń czyta plik bez serwera: `lolly system import` czyni go systemem projektowym terminala, a `lolly system check` sprawdza dane wejściowe Lolly Design względem zapisanego kontekstu. [Bring your design system](/info/cli.html#bring-your-design-system) opisuje import, a [Which design system a command uses](/info/cli-decks.html#which-design-system-a-command-uses) opisuje sprawdzanie, a klient MCP czyta ten sam brief z `lolly://design-context` ([MCP Server](/info/mcp.html)).

## Dokąd dalej

- **[Using Lolly](/info/using.html)**: narzędzia, zapisywanie, udostępnianie i Zasoby.
- **[Brand architectures](/info/brand-architectures.html)**: jak działy, produkty, marki poparte, klienci i sezony odwzorowują się na systemy projektowe, colourway i tożsamości logo.
- **[Working with partners](/info/partners.html)**: udostępnianie marki partnerowi i praca w marce, którą dostałeś.
- **[Brand pages](/info/brand-page.html)**: opublikuj swój system projektowy pod jednym adresem, jako zestaw prasowy i zestaw dla agentów.
- **[Design Tokens](/info/design-tokens.html)**: model tokenów, w którym zapisana jest Twoja marka.
- **[Export a file](/info/exporting.html)**: jednostki druku, CMYK i formaty, do których renderuje się Twoja marka.
