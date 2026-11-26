# Lolly Design System Setup

<a id="design-system-setup"></a>

**Lolly Design System Setup** pod adresem `#/start` zawiera Twoje logo, kolory i kroje pisma. Każde narzędzie, strona i eksport używa ich do rysowania.

Upuść logo, a Lolly odczyta jego kolory. Wybierz krój pisma lub upuść plik czcionki, na którą Twoja firma ma licencję. Każda zmiana jest od razu widoczna w całej aplikacji. Twoje logo, czcionki i tokeny pozostają na tym urządzeniu. Tylko wybór czcionki Google Font łączy się z siecią: Lolly najpierw pyta, a potem pobiera rodzinę jeden raz.

Nazwij system projektowy i naciśnij **Export**, aby uzyskać jeden plik `.lolly`. Zachowaj go, otwórz na innym urządzeniu lub przekaż współpracownikowi. [Lolly Settings](/info/dashboard.html#design-system) pokazuje aktywny system tylko do odczytu; jego okładka prowadzi tutaj do edycji.

<!--i:eti-clock-->
## Dostosuj do siebie w pięć minut

::: timeline
- <!--i:upload--> **Upuść swoje logo** w polu upuszczania w **Logos**. Lolly odczyta jego kształt i kolory.
- <!--i:palette--> **Use these colours.** Główny kolor logo staje się Twoim kolorem głównym, a ciemny kolor neutralny z logo staje się kolorem tekstu.
- <!--i:font--> **Choose a face** w **Type**: czcionkę Google Font lub własny plik czcionki.
- <!--i:pentool--> **Nazwij system.** Pierwsza edycja tworzy Twój własny system projektowy, a Lolly pyta jeden raz o jego nazwę.
- <!--i:download--> **Export** zapisuje cały system jako jeden plik `LollyBrand-….lolly`.
:::

Pasek u góry studia pokazuje nazwę systemu projektowego jako edytowalne pole. **Enter** zachowuje nową nazwę, a **Escape** przywraca poprzednią. Gdy przy pierwszej edycji pojawi się pytanie **What is this design system called?**, Lolly wstawia słowa z logo, jeśli logo je zawiera. **Save name** zachowuje nazwę; **Not now** pozostawia nazwę zastępczą, dopóki nie wpiszesz własnej na pasku. Nazwa opisuje system w Settings i podczas przełączania, a także jest nazwą pliku zapisywanego przez **Export**.

<!--i:eti-grid-->
## Sekcje

Studio to zestaw sekcji bez ustalonej kolejności. Żadna sekcja nie czeka na inną. Na komputerze sekcje znajdują się w jednym rzędzie pod paskiem. Na telefonie przenoszą się na pasek wzdłuż dolnej krawędzi, który przewija się tak, aby otwarta sekcja była widoczna. Panel palety i zasobnik wysuwają się ponad ten pasek, a pasek odsuwa się podczas pisania. Na klawiaturze Tab zatrzymuje się na rzędzie raz, a klawisze strzałek, Home i End przenoszą między sekcjami.

![Pasek studia i jego sekcje: Board, Colours, Type, Logos, Tokens, Files, Sound, Rules i Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Sekcja | Co w niej robisz | Klucz linku |
|---|---|---|
| **Board** | Zobacz zawartość systemu i przejdź do każdej sekcji | `overview` |
| **Colours** | Dodawaj kolory, przypisuj im role, twórz odcienie i paletę | `color` |
| **Type** | Wybierz cztery kroje używane przez aplikację, narzędzia i każdy eksport | `type` |
| **Logos** | Umieszczaj znaki w każdej orientacji i wersji | `logos` |
| **Tokens** | Narożniki, odstępy, cienie i wszystkie inne nazwane wartości | `tokens` |
| **Files** | Obrazy, dźwięki i pliki animacji oraz wideo Twojej marki | `catalogue` |
| **Sound** | Kształtuj tożsamość dźwiękową, muzykę do różnych zastosowań i relację z głosem | `sound` |
| **Rules** | Reguły Twojej marki, sprawdzane na rzeczywistych przykładach | `usage` |
| **Skills** | Pisemne standardy marki dla ludzi i agentów, do przeczytania i pobrania | `skills` |

Utwórz link do sekcji za pomocą `#/start?area=<key>`. Klucze sekcji są stałe, więc Files zachowuje `catalogue`, Board zachowuje `overview`, a Rules zachowuje `usage`. `?tab=` nadal działa jako starszy alias. Nieznany klucz otwiera Board.

**Pasek** zawiera akcje dla całego systemu. **Add from…** importuje markę ([Importowanie marki](#bring-a-brand-in)). **Tray** przechowuje to, co znalazło skanowanie, a czego jeszcze nie dodałeś. **Export** zapisuje system jako jeden plik. **More** zawiera **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions & publishing**, **Restore brand settings** i **Design systems**, które otwiera listę w Settings służącą do przełączania ([Zachowywanie i przenoszenie systemu projektowego](#keep-and-move-your-design-system)). Każda akcja pojawia się, gdy ma na czym działać. Na telefonie **Add from…** przenosi się do **More**, a **Export** jest widoczne jako ikona.

Dopóki system projektowy jest tym dołączonym do aplikacji, na początku paska jest **Make it yours**, menu z **Find a look**, **Add from…** i **Pick a colour**. Gdy system staje się Twój, **Export** ponownie zajmuje to miejsce.

<!--i:eti-clipboard-->
## Board

Gdy nic jeszcze nie wybrano, Board oferuje cztery sposoby rozpoczęcia. **Start from a reference** otwiera selektor źródła: logo, zrzut ekranu, strona internetowa lub plik projektu. **Pick a colour**, **Choose a face** i **Add a logo** otwierają odpowiednie kontrolki. Otwarcie którejkolwiek niczego nie zapisuje. Poniżej **Find a look** oferuje gotowe kolory i kroje do wypróbowania, a **Explore the tools** jest dostępne od początku.

Gdy choć jeden element jest Twój, Board pokazuje zawartość systemu, zaczynając od liczników Twoich elementów. Colours podaje liczbę kolorów, z przygaszonym `· N starter` dla odziedziczonych. Pasek pokazuje Twoje kolory, potem cienką linię, a za nią wyblakłe kolory początkowe. Colourways pokazuje każdy wariant kolorystyczny jako mały kafelek w jego kolorze wiodącym. Type wymienia każdą rolę i prezentuje każdą rodzinę jej własnym krojem (*Inter dla nagłówków*, z *Początkowe dla pozostałych* w wierszu poniżej). Logos podaje liczbę zajętych miejsc (lub **Not set**), Tokens pokazuje promień narożnika, a Files wyświetla **Nothing yet**, gdy biblioteka jest pusta. Każdy blok otwiera swoją sekcję.

Edytowalny system projektowy dołączony do aplikacji, taki jak Lolly Demo, od początku pokazuje swoje kolory, warianty kolorystyczne, kroje i znaki w Board, z etykietą **Came with this app** obok nagłówka. Nad nimi **Start here** oferuje **Find a look**, **Add from…** i **Pick a colour**.

### Początkowe i własne

W każdej sekcji **Starter** oznacza wszystko, co dołączono do aplikacji i czego nikt nie wybrał. Nowa instalacja nie zawiera żadnego koloru, tylko jedną skalę neutralną od atramentu do papieru, aby tła, tekst i cienkie linie mogły być renderowane, zanim ktokolwiek dokona wyboru.

::: cols
## Początkowe

- Dołączone do aplikacji: kolory neutralne od atramentu do papieru, początkowe kroje, domyślny promień narożnika.
- Przygaszone, z etykietą **Starter** i bez zabarwienia.
- Niewliczane do Twoich kolorów. Kolory neutralne są w **Tokens** jako **Neutrals · starter · 9**, a **Open** pokazuje je w Colours jako jedną zwiniętą grupę (`#/start?area=color&group=neutral`).
- Rola korzystająca z koloru początkowego pokazuje *„Starter Paper pełni rolę zastępczą”*, z opcją **Choose…** w selektorze.

## Własne

- Wybrane lub zainstalowane przez Ciebie.
- Wyświetlane bez przygaszenia, a tam, gdzie zainstalowałeś krój, na zabarwionej karcie.
- Zliczane w Board i Tokens.
- Rola powiązana z inną pokazuje **↳ follows Primary**.
:::

Odziedziczone elementy nigdy nie mają przerywanej ramki. Przerywana ramka oznacza miejsce upuszczania.

<!--i:eti-shapes-->
## Logos

Pole upuszczania u góry, **"Drop marks here, or choose several at once"**, przyjmuje dowolną liczbę plików. Lolly odczytuje kształt i kolory każdego pliku. Plik czeka potem pod **Waiting for a slot** jako znacznik opisujący, jak wygląda, na przykład *„Wygląda jak Horizontal primary”*, z użytym pomiarem i przyciskiem **Place** (**Replace**, gdy miejsce jest zajęte). Gdy Lolly nie ma pewności, znacznik o tym informuje i oferuje **Change slot**, wymieniając wszystkie osiem miejsc. Nic nie zostaje umieszczone, dopóki nie naciśniesz przycisku.

Znak z nadmiernym pustym marginesem najpierw otrzymuje propozycję przycięcia. Odpowiedz na propozycję lub naciśnij Escape, aby umieścić oryginał bez zmian. Gdy znak może wypełnić inne puste miejsce w tej samej grupie, sekcja oferuje utworzoną na jego podstawie wersję **mono** lub **reverse** jako znacznik z etykietą *Generated*.

Każdy znak trafia do siatki ośmiu opcjonalnych miejsc, po jednym dla każdej kombinacji **orientacji** i **wersji**:

- **Orientacje:** Horizontal (wordmark i symbol w rzędzie) i Vertical (jeden nad drugim, do kwadratowych i wysokich przestrzeni).
- **Wersje:** Primary, Primary reverse (na ciemne tła), Mono (jeden kolor) i Mono reverse.

Grupa bez znaków zwija się do jednego wiersza; otwórz ją, aby zobaczyć jej miejsca. Kliknij miejsce, aby dodać PNG, SVG, JPEG lub WebP albo kliknij zajęte miejsce, aby zastąpić znak. Na puste miejsce możesz też upuścić plik. Znaki poziome znajdują się w szerokich kafelkach, a pionowe w kwadratach, każdy na tle, dla którego go przygotowano, z polem ochronnym równym jednej czwartej jego wysokości. Wszystko pozostaje na tym urządzeniu.

![Miejsca na logo z rozwiniętymi Horizontal i Vertical: każda wersja ma własne miejsce, a każde miejsce jest opcjonalne](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&system=new-design-system&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails.be-logo-group--fold%3Anot%28.be-logo-group--custom%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** to znaki, którym Twoja marka nadaje własne nazwy, takie jak ikona, herb lub favicon.
- **Więcej tożsamości.** Submarka, produkt lub wydarzenie może mieć własny pełny zestaw: naciśnij **+ Add another logo** i nazwij zestaw. Twój główny zestaw to „Your logo”. [Architektury marek](/info/brand-architectures.html) pokazują, kiedy używać tożsamości logo.
- **Lolly odczytuje kolory logo.** Karta pod polem upuszczania i u góry Colours wymienia kolory logo i pyta **Which is the main colour?**. Zaznaczony jest najmocniejszy kolor, nigdy biel, na której wyeksportowano logo. **Use these colours** dodaje je do palety i ustawia główny kolor logo jako Twój kolor główny. Gdy logo ma ciemny kolor neutralny czytelny na papierze, ten kolor staje się kolorem tekstu. **Not now** pozostawia je w Tray. W nowej instalacji Lolly od razu stosuje najbardziej prawdopodobny wybór, a karta oferuje **Undo** lub inny kolor główny. SVG daje dokładne kolory; PNG, JPEG lub WebP daje kolory pokrywające znaczną część znaku.

<!--i:eti-palette-->
## Colours

Sekcja rozrasta się wraz z systemem projektowym. Przy pierwszej wizycie prosi o jedną decyzję; wraz z rozwojem palety pojawiają się kolejne kontrolki.

### Pierwszy kolor

System bez własnych kolorów pokazuje początkowe kolory neutralne w osobnej otwartej grupie. U góry sekcji znajduje się pole do wklejania i upuszczania z przerywaną ramką: jedna duża próbka i jedno pole. Upuść obraz lub listę kolorów w dowolnym miejscu pola, a Lolly odczyta kolory.

- **Próbka jest selektorem.** **Pick a colour** otwiera kartę OKLCH studia z wartością z pola. Karta pokazuje najpierw nazwę koloru i kod hex. Przestrzenie kolorów, koło, cztery pokrętła i kanał alfa są pod **Fine-tune**, a **Cancel** i **Add colour** u dołu. Nic nie trafia do systemu, dopóki nie naciśniesz **Add colour**.
- **Pole przyjmuje dowolny zapis**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` lub nazwę koloru. Wklejona lista staje się rzędem próbek, które można dodawać pojedynczo lub za pomocą **Add all**.
- **Dwa kolejne sposoby.** **Pick a colour from the screen** używa pipety tam, gdzie przeglądarka ją udostępnia, a **Take colours from an image** odczytuje zrzut ekranu lub zdjęcie na tym urządzeniu.
- **Add nigdy nie jest wyłączone.** Gdy pole jest puste, otwiera selektor; gdy nie może odczytać tekstu, informuje o tym wiersz pod polem.

Twój pierwszy kolor staje się **głównym**. Znacznik potwierdza zmianę, na przykład *„Kolor główny to teraz Vivid Violet”*, z opcją **Fine-tune**, aby go dostosować.


### Wraz z rozwojem palety

Na szerokim ekranie Twoje kolory są obok podglądu **In context**, a na mniejszym nad nim. Podgląd pokazuje plakat, wykres lub kartę interfejsu w Twojej palecie. Kolory początkowe mają własną grupę, która zwija się, gdy system zyska własne kolory. Pole do wklejania i upuszczania staje się jednym zwartym wierszem. Nagłówek sekcji nie ma eksportu; użyj **Export** na pasku lub sekcji Tokens.

![Sekcja Colours w Lolly Demo: znaczniki ról i pole do wklejania i upuszczania u góry, a poniżej paleta w zwijanych grupach, każdy kolor z nazwą i kodem hex](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![Sekcja Colours w Lolly Demo po dodaniu jednego koloru: tabela Colour roles, potem próbka nowego koloru z opcjami Use as Lead? i Fine-tune, obok podglądu kompozycji na żywo](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Role kolorów: jak nazywają się kolory

System projektowy nadaje kolorom nazwy i określa przeznaczenie każdego z nich, a Lolly odczytuje jedno i drugie. **Colour roles** znajduje się u góry sekcji Colours. **In context** od razu pokazuje każdą zmianę.

![Tabela Colour roles w Wefthouse, fikcyjnej marce tekstylnej, używająca jej własnych określeń: próbki wariantów kolorystycznych Indigo, Madder i Weld, potem Main, Accent, Supporting i Tertiary, każdy z jasnym i ciemnym kolorem, odczytywane jako kolor wiodący, kolor towarzyszący i tylko według nazwy, a pod tabelą Background, Text, Quiet text i Hairlines jako zastosowania, których nie pełni żadna rola](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=wefthouse&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

Tabela ma cztery kolumny. Na telefonie każdy wiersz staje się kartą z jasnym i ciemnym kolorem obok siebie:

| Kolumna | Co zawiera |
|---|---|
| **Role** | Własne określenie systemu projektowego, które możesz edytować w miejscu, oraz wiersz opisujący przeznaczenie koloru |
| **Light** i **Dark** | Kolor w danym wyglądzie dla wybranego wariantu kolorystycznego, z nazwą lub wartością i kontrastem |
| **Lolly reads this as** | Co narzędzie robi z daną rolą, opisane określeniami Lolly |

**Jak Lolly interpretuje rolę.** Każda interpretacja przypada jednej roli. Wybranie interpretacji przypisanej innej roli przenosi ją do tej roli. Lolly nigdy nie wyciąga znaczenia z nazwy.

| Interpretacja | Co z niej wynika |
|---|---|
| **Lead colour** | Duże kształty, przyciski, kolor przewodni narzędzia |
| **Partner colour** | Drugi kolor, po który sięga narzędzie |
| **Background** | Znajduje się za wszystkim innym |
| **Text** | Nagłówki i tekst główny |
| **Quiet text** | Podpisy i drobny druk |
| **Hairlines** | Linie, obramowania i separatory |
| **By name only** | Żadne narzędzie nie wybiera tej roli samo. Jest dostępna w każdym polu koloru i w Design, gdzie wybór pozostaje powiązany, więc podąża za wariantem kolorystycznym |

Interpretacja, której nie pełni żadna rola, zachowuje definicję systemu projektowego, a sekcja wymienia takie interpretacje pod tabelą. Rola o tym samym identyfikatorze co interpretacja, na przykład rola o nazwie Primary, jest tą interpretacją i nie można jej przenieść.

**Na wykresie.** Paleta **Design system - colour roles first** w Lolly Chart przypisuje seriom role kolorów z systemu projektowego w jego kolejności, a potem resztę palety. Rola interpretowana jako tło, tekst, tekst drugoplanowy lub cienkie linie jest pomijana, ponieważ wykres używa tych kolorów do rysowania tła i tekstu. Nic się nie zmienia, dopóki nie wybierzesz tej palety. W systemie projektowym bez ról kolorów paleta jest wyświetlana jako **Design system - ordered**.

**Wartości.** Naciśnij wartość, aby wybrać kolor tej roli dla danego wyglądu i wybranego wariantu kolorystycznego. **Same as light** sprawia, że wartość dla ciemnego wyglądu podąża za jasną, dopóki nie wybierzesz ciemnego koloru. Znacznik **Aa** pokazuje tekst, który Lolly wybiera do umieszczenia na tym kolorze. Wiersz pod wartością informuje o czytelności tego tekstu w każdym wyglądzie: **Text reads well**, **Large text only** lub **Hard to read as text**. Ocena dotyczy tylko tekstu na tym kolorze; kolor nadal może się sprawdzać w kształtach i na dużych powierzchniach. Rola interpretowana tylko po nazwie pokazuje te same słowa bez koloru ostrzeżenia, ponieważ żadne narzędzie nie umieszcza samo tekstu na tej roli. Podpowiedź i selektor pokazują liczby, najpierw APCA, potem WCAG. **Own text colour** oznacza wartość, której plik określa kolor tekstu; ten kolor tekstu zostaje. **Copied** oznacza wartość z innego wariantu kolorystycznego lub z koloru towarzyszącego, której nikt jeszcze nie wybrał; **Keep this colour** w selektorze zatwierdza wartość.

**Punkty wyjścia.** System projektowy bez własnych ról pokazuje bieżące nazwy: Primary, Secondary, Surface i Text. Nic nie jest zapisywane, dopóki nie zmienisz jednej z nich. **+ Add a role** proponuje **Primary, Secondary** lub **Main, Accent, Supporting, Tertiary** albo przyjmuje dowolne wpisane nazwy i pokazuje interpretację, którą otrzyma każda z nich. Pierwsze dwie nazwy stają się kolorem przewodnim i kolorem towarzyszącym. Narzędzia nadal rysują tymi samymi kolorami. W systemie z jednym kolorem przewodnim pierwszy wariant kolorystyczny przyjmuje nazwę tego koloru.

**Zmiana nazw, kolejności i usuwanie.** Zmiana nazwy zmienia tylko słowo; wszystko, co korzysta z roli, nadal działa. Przeciągnij rolę za uchwyt albo naciśnij Space na uchwycie, użyj klawiszy strzałek i naciśnij Space, aby upuścić. **Remove** informuje, co nadal korzysta z roli. Gdy narzędzia interpretują rolę, **Remove and keep those colours** pozostawia każdej interpretacji jej bieżący kolor. Reguła organizacji, grupa przewodnika, pole narzędzia lub inny token korzystający z roli blokuje jej usunięcie do czasu zmiany tego użycia. Zapisany dokument Design może też korzystać z roli po nazwie, a Lolly nie widzi tego w pliku tokenów. Taki dokument zgłasza kolor jako nierozpoznany.

::: details Role w ręcznie napisanym pliku tokenów
**Ręcznie napisany plik.** Kolory w pliku tokenów, których nie deklaruje żadna rola, są wymienione w **In this file, with no role yet**, każdy z polem na nazwę i przyciskiem **Make a role**. W obu przypadkach nadal działają po nazwie. Token z cyframi w nazwie nie może być rolą; pozostaje w pliku i nadal działa przez swoją ścieżkę. Jeśli rekord w pliku nie przechodzi walidacji, tabela pojawia się bez kontrolek i podaje przyczynę.
:::

**Reszta sekcji używa tych samych nazw.** Znaczniki, wiersz **Use as** próbki i grupa **Colour roles** palety używają nazw z systemu projektowego. Kafelek roli koloru otwiera jej wartość. Eksportowane pliki nie zapisują niczego nowego o rolach; kolory renderu zmieniają się, ponieważ zmieniły się tokeny.

**Gdzie trafiają nazwy.** Nazwy i opisy są przenoszone wraz z systemem projektowym. Agenci czytają je w briefie projektowym, `lolly://tokens` i pliku `AGENTS.md` strony marki. Terminal pokazuje je w `lolly system status`. Strona marki wymienia je w `brand.json` i mierzy kontrast pary dla każdej roli. Pliki DTCG i Tokens Studio zachowują wszystko, `DESIGN.md` zachowuje nazwy i interpretacje, a motyw PowerPoint zachowuje tylko kolejność marki. [Role kolorów w innych formatach](/info/design-tokens.html#colour-roles-in-other-formats) zawierają pełną listę. Nazwy są zawsze cytowane jako dane systemu projektowego, nigdy interpretowane jako instrukcje.

**Gdzie wybiera się kolor.** Każde pole koloru w narzędziu i w Lolly Design wymienia najpierw role systemu projektowego w jego kolejności, z każdą nazwą i jej przeznaczeniem. **Aa** obok roli wybiera kolor umieszczany na tej roli. Pozostałe kolory znajdują się w **Other colours**, bez kopii należących do wariantu kolorystycznego, kolorów nakładanych na inne kolory i interpretacji już pełnionych przez rolę. Wybór pozostaje powiązany z rolą i podąża za wariantem kolorystycznym. Pole pokazuje nazwę w każdym wariancie kolorystycznym, a Settings i Tokens też jej używają. System projektowy bez ról zachowuje siatkę próbek.

### Każdy kolor odczytywany przez narzędzie

Gdy **Colour roles** jest zwinięte, sekcja zaczyna się od znaczników pierwszych wyborów. Każdy znacznik pokazuje kolor roli i jej nazwę. W systemie bez własnych nazw są to **Primary**, **Secondary**, **Surface** i **Text**. Naciśnij znacznik, aby wybrać jego kolor z próbek palety. **Every colour a tool reads** na dole **Colour roles** zawiera pełny pasek.

Pasek pokazuje siedem kolorów, które narzędzie może odczytać: Primary, Secondary, Surface, Text, Muted, Edge i On primary, pod własnymi nazwami systemu projektowego, jeśli je ma. Każdy pełni tę samą funkcję w każdym narzędziu i eksporcie. Żaden nie musi być ustawiony, a każdy może być dowolnym kolorem. Trzy niezależne kolory tworzą dobry system. Odczyt informuje o czytelności tekstu na powierzchni, zaczynając od APCA. Każdy wiersz pokazuje Twój własny kolor w pełnym nasyceniu, zastępujący go kolor początkowy lub **↳ follows Primary**.

On primary jest wyprowadzany z koloru podstawowego, ma etykietę **Derived** i nie ma selektora. Przełącznik **Light** i **Dark** obok On primary oraz ten obok **In context** wybierają wygląd pokazywany przez pasek, paletę i podgląd.

Akcent samej aplikacji domyślnie podąża za systemem projektowym dzięki ustawieniu **Interface follows the design system** w **Settings → Appearance**. Gdy ustawienie jest wyłączone, interfejs aplikacji pozostaje neutralny. Narzędzia, kanwy i eksporty podążają za systemem projektowym w obu przypadkach.

**Warianty kolorystyczne.** System projektowy może zawierać kilka kolorów przewodnich wybieranych dla każdej pracy. Wiersz **Colourways** na początku **Colour roles** pokazuje po jednym znaczniku na wariant kolorystyczny, z etykietą **Default** przy kanonicznym. **+ Add** tworzy nowy wariant kolorystyczny z koloru palety. Wybierz znacznik, a tabela, pasek, paleta i podglądy pokażą ten wariant kolorystyczny. Możesz zmienić jego nazwę, zduplikować go, usunąć lub ustawić jako domyślny. W systemie z wariantami kolorystycznymi każdy wariant potrzebuje własnego koloru podstawowego i drugorzędnego oraz własnej powierzchni, gdy warianty zabarwiają tło. Te role pozostają ustawione w edytorze próbek. [Dodawanie wariantów kolorystycznych do systemu projektowego](/info/colourways.html#add-colourways-to-a-design-system) opisuje kroki i format tokenów, a [Lolly Demo w użyciu](/info/lolly-demo-in-use.html#colourways-on-real-work) pokazuje warianty kolorystyczne w rzeczywistych pracach. Każdy może wybrać własny wariant kolorystyczny w **Settings → Appearance** ([Wybierz własny wariant kolorystyczny](/info/colourways.html#make-a-colourway-your-own)).

### Znajdź więcej kolorów

Trzy narzędzia bazują na Twoim kolorze podstawowym. Pierwsze dwa tylko proponują; trzecie zastępuje paletę.

::: cols
## Odkrywaj odcienie & harmonie

Wybierz **Starting colour**, **Scheme** (Mono, Complement, Analogous lub Triad) i liczbę **Shades** (od 3 do 20, domyślnie 5). **Fine-tune** ustawia intensywność interfejsu, kontrast i tekst na kolorze marki. Kliknij odcień, aby go dodać, lub **Add 5 shades**, aby dodać grupę. Twoje kolory i role zostają.

## Znajdź pasujące kolory

Wybierz **Harmony**: Complementary, Adjacent, Triad, Tetrad lub Analogous (z **Accents** od 2 do 5 i **Angle** od 10° do 45°). Każda propozycja ma wygenerowaną nazwę i **+ Add**, jedno naciśnięcie na kolor.

## Przebuduj całą paletę

Zastępuje paletę na podstawie jednego koloru początkowego, po przeglądzie tego, co się zmienia i co zostaje.
:::

Wszystkie trzy używają tej samej percepcyjnej matematyki kolorów (OKLCH) co silnik. W **Explore shades & harmonies** wiersze **Primary**, **Neutral** i **Secondary** pokazują proponowane odcienie, a **Theme preview** pokazuje jasne i ciemne przykłady z odczytami kontrastu.

![Trzy proponowane grupy odcieni, z osobnymi kontrolkami dodawania i oddzielnym Theme preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Wygenerowane akcenty, każdy z próbką, automatycznie wygenerowaną nazwą, wartością hex i przyciskiem Add](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Zatwierdzanie wygenerowanej palety

Otwórz **Rebuild the whole palette…** i naciśnij **Preview full rebuild**. Przegląd podlicza, ile ról zachowuje Twoje przypisania, ile Twoich kolorów zostaje i ile krzywych odcieni, blokad druku, ukrytych odcieni i punktów gradientu zostaje przypisanych do nowych punktów odniesienia lub zachowanych. **Apply rebuilt palette** zatwierdza; **Cancel** niczego nie zmienia. Potem karta oferuje **Undo**, już z fokusem, a punkt kontrolny zapisany przed zamianą przywraca cały system.

System z wariantami kolorystycznymi zachowuje każdy wariant podczas przebudowy. Kanoniczny wariant kolorystyczny podąża za nowym kolorem początkowym, a każdy pozostały zachowuje własne kolory, nazwę, kolejność i ustawienia. Przegląd wymienia, który wariant podąża za nowym kolorem, a które zachowują swoje kolory. Lolly nie przebudowuje systemu, który koduje warianty kolorystyczne w sposób niepozwalający na ich edycję; karta podaje przyczynę i nic się nie zmienia.

### Sekcje dla zaawansowanych

Pod podglądem i rolami znajdują się cztery zwinięte sekcje. Każdą można otworzyć przez `#/start?area=color&focus=<name>`:

- **Explore shades & harmonies** (`focus=generate`).
- **Shade curves** (`focus=curves`) zmienia kształt skali odcieni punkt po punkcie, z osobnymi krzywymi jasności, chromatyczności i tonu (L / C / H), a odcienie są przerysowywane podczas przeciągania.
- **Contrast** (`focus=contrast`): **Contrast-lock** dostosowuje tony skali odcieni do docelowych wartości APCA na wybranym tle, a **Rotate hue** obraca całą skalę na kole.
- **Print** (`focus=print`) ustawia, czym staje się kolor podstawowy w druku: wartością automatyczną, ustalonym składem CMYK lub nazwanym kolorem dodatkowym.

### Paleta i każda próbka

Paleta wymienia Twoje kolory w zwijanych grupach, każdą z własnym **+ Add**. Możesz tworzyć grupy i zmieniać ich nazwy. Rola nigdy nie tworzy drugiego kafelka; kafelek wskazywany przez rolę pokazuje jej nazwę, na przykład **Primary**. **Colour chart** pod kafelkami pokazuje te same kolory na kole OKLCH **Wheel** (przeciągnij kropkę, aby zmienić kolor, kliknij puste miejsce, aby dodać próbkę) i na wykresie **Gamut**, który pokazuje granicę zakresu możliwego do wyświetlenia. `#/start?area=color&focus=chart` otwiera wykres.

![Panel palety, w którym każdą grupę można zwinąć](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Koło OKLCH - kąt to ton, odległość od środka to chromatyczność, a szarości biegną po bocznej skali jasności](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Kliknij próbkę, aby otworzyć jej edytor:

- **Rename** zmienia nazwę próbki.
- **Set the colour** ustawia kolor suwakami OKLCH lub w **Hex**, **HSL**, **RGB** albo **CMYK**. Pole wartości odczytuje i zapisuje w aktywnej przestrzeni. CMYK ustawia tu kolor ekranowy przez konwersję; aby ustalić dokładne wartości farb, użyj **Print substitutes**.
- **Stored as** wybiera sposób zapisu próbki: **LCH** (domyślny, percepcyjny, z szeroką gamą barw), Hex, RGB lub HSL.
- **Use as** nadaje próbce rolę, pod własną nazwą systemu projektowego, jeśli ją ma. Naciśnij ponownie podświetloną rolę, aby ją wyczyścić.
- **Print substitutes** (zwinięte): przełącz **CMYK** z **Auto** na ustalone wartości farb albo ustaw **Spot colour** z **Name** (na przykład `PANTONE 186 C`), opcjonalnym **Book** i **Finish** dla folii, tłoczenia wypukłego lub wklęsłego, lakieru wybiórczego, soft touch albo wykroju, bigowania lub perforacji. Druk używa tych ustalonych wartości przy eksporcie CMYK PDF lub TIFF; zobacz [Profile kolorów](/info/exporting.html#colour-profiles). Kolor dodatkowy jest drukowany z osobnej formy w Print PDF; aby w jednym eksporcie drukować wszystkie kolory dodatkowe jako procesowe, zobacz [Kolory dodatkowe jako procesowe](/info/exporting.html#spot-inks-as-process).
- **In other spaces** (zwinięte): wartość dla każdej przestrzeni kolorów, wyprowadzona lub określona przez Ciebie; przy eksporcie pierwszeństwo ma określona przez Ciebie.

**Usuwanie próbki** jest bezpieczne. Pochodne odcienie i role motywu są ukrywane, więc nic, co z nich korzysta, nie przestaje działać. Dodane przez Ciebie kolory są usuwane.

::: details Praca z wieloma próbkami
W stanie spoczynku próbka pokazuje kolor, nazwę i hex. Select pokazuje pole wyboru i uchwyt przeciągania każdej próbki na dowolnym ekranie, a kafelek z fokusem klawiatury też pokazuje uchwyt. Przeciągnij uchwyt, aby zmienić kolejność w grupie, albo ustaw na nim fokus, naciśnij Space, użyj klawiszy strzałek i ponownie naciśnij Space, aby upuścić; Escape anuluje. Na telefonie paleta pokazuje cztery kolory w wierszu. Aby przenieść kolory między grupami, użyj kontrolki **Group** w edytorze albo zaznacz kilka i użyj **Move to**.

Zaznaczanie nie wymaga osobnego przełącznika: pasek i pola wyboru pojawiają się przy pierwszym zaznaczonym kafelku i znikają po odznaczeniu ostatniego.

- **Przeciągnij po pustym miejscu**, aby narysować prostokąt; każdy kafelek, którego dotknie, dołącza do zaznaczenia, także w innych grupach. Zwinięta sekcja niczego nie dodaje.
- **Shift-kliknięcie** zaznacza zakres w kolejności czytania, **Cmd/Ctrl-kliknięcie** przełącza zaznaczenie jednego kafelka, a zwykłe kliknięcie otwiera edytor.
- Nagłówek każdej grupy ma **Select all**, a **Cmd-A** z fokusem na kafelku zaznacza każdy Twój własny kolor, nigdy początkowy.
- Siatka ma jeden punkt zatrzymania klawisza Tab: strzałki przenoszą fokus, Shift-strzałki rozszerzają zaznaczenie, Space je przełącza, Delete usuwa, a Escape czyści. Aby zmienić kanał małym krokiem, najpierw naciśnij `l`, `c` lub `h`.
- Na ekranie dotykowym naciśnij i przytrzymaj kafelek, aby zacząć zaznaczanie, a potem stukaj, aby dodawać.

Pasek pokazuje **{n} selected**, a dalej **Move to**, **Give a role** (każdy kolor otrzymuje po kolei następną rolę), **Download** (zaznaczenie w dowolnym z sześciu formatów palety), **Duplicate** (kopia każdego koloru umieszczona za oryginałem), **Copy values** i **Delete**. Jedna kopia otwiera się w edytorze; kilka pozostaje zaznaczonych. Jedno Cmd/Ctrl-Z cofa operację zbiorczą.
:::

### Gradienty

Opcjonalny panel **Gradients** tworzy tokeny przejść z palety. Każdy gradient ma podgląd, od 2 do 8 nazwanych punktów i kąt. Punkt wskazuje próbkę, więc gdy zmienisz kolor próbki, gradient podąży za zmianą. Przejścia są obliczane w OKLCH.

Opcje pobierania palety (tokeny projektowe, CSS, SCSS, GIMP i Adobe Swatch Exchange) znajdują się w jej nagłówku. [Zabierz swoją paletę i czcionki wszędzie](/info/using.html#take-your-palette-and-fonts-anywhere) opisuje każdy format.

<!--i:eti-type-->
## Typografia

Gdy nie ma własnego kroju, sekcja pokazuje jedną kartę: **Primary**, z tekstem w bieżącym kroju i rozmiarze do czytania, etykietą **Starter**, przyciskiem **Choose for Primary** i wierszem *„Nic nie zostanie zainstalowane, dopóki nie wybierzesz kroju.”* Nagłówki, kod i kursywa podążają za krojem podstawowym, dopóki ich nie wybierzesz; **Choose them separately** pokazuje ich karty.

![Sekcja Type bez wybranego kroju - jedna karta z tekstem w rozmiarze do czytania, etykietą Starter i jednym wypełnionym przyciskiem Choose for Primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Wybierz jeden krój, a sekcja rozwinie się do czterech kart ról, listy Fonts i próbki na żywo:

- **Primary**: tekst główny, przyciski i każde narzędzie.
- **Headings**: krój nagłówkowy dla `h1` i `h2`.
- **Code**: krój o stałej szerokości znaków do kodu i danych.
- **Italic**: prawdziwa kursywa do wyróżnień, cytatów i uwag pobocznych.

Karta jest zabarwiona tylko tam, gdzie zainstalowałeś dany krój. Jej przycisk pokazuje rolę: **Change Headings** przy własnym kroju i **Choose for Headings** wszędzie indziej. Wiersz próbki zawija się. Nic na karcie nie zatwierdza zmiany; przycisk otwiera obszar porównania dla tej roli.

![Cztery odsłonięte karty ról - każda z tekstem w przypisanym kroju, z etykietą Starter tam, gdzie nikt nie wybrał kroju, i Italic podążającym za krojem podstawowym](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Obszar porównania

Obszar otwiera się pod naciśniętą kartą. Karty zwijają się do jednowierszowego paska, aby obszar był widoczny na pierwszym ekranie telefonu. Escape anuluje i przywraca fokus na karcie.

1. Naciśnij **Choose for** z rolą na karcie.
2. Wpisz nazwę rodziny i naciśnij **Preview** albo naciśnij jedną z sześciu rodzin **Pinned** pod polem.
3. Naciśnij **Use this face**.

![Obszar porównania otwarty pod kartą, z wierszem wyszukiwania, przypiętymi rodzinami i kartami zwiniętymi do jednowierszowego paska](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**Zgoda jest wymagana raz.** Gdy podgląd po raz pierwszy łączy się z Google Fonts, okno wyjaśnia: *Google poznaje nazwę rodziny i Twój adres IP. Plik jest następnie przechowywany na tym urządzeniu i używany offline. To jedyny krok w studiu, który łączy się z podmiotem trzecim.* **Fetch from Google** kontynuuje, a wybór zostaje zapamiętany. **Cancel** pozostawia na karcie tekst *„Nie pobrano. Nic nie wysłano do Google.”* z osobnym przyciskiem **Fetch from Google**.

**Upuść plik czcionki w obszarze porównania** (TTF, OTF lub WOFF), aby zobaczyć podgląd posiadanego kroju z licencją. W obu przypadkach krój pozostaje na tym urządzeniu, jest renderowany offline w aplikacji, narzędziach i każdym eksporcie oraz jest przenoszony w pliku systemu projektowego. Wszystko w Google Fonts jest udostępniane na otwartej licencji (OFL, Apache lub UFL).

### Czcionki na tym urządzeniu

Panel **Fonts** wymienia każdy krój na tym urządzeniu i rolę, którą pełni. Dodane przez Ciebie kroje są pierwsze, w **In the design system**, każdy z rolami i opcją usunięcia. Początkowe kroje znajdują się dalej w jednym przygaszonym, zwiniętym wierszu. **Add a face** otwiera obszar porównania dla dowolnej roli. Panel **Type roles** pokazuje próbkę na żywo każdej roli z rodziną i stanem, na przykład *Inter* lub *Inter · follows Primary*.

<!--i:eti-tag-->
## Tokeny

Tokeny to nazwane wartości, na których opiera się system projektowy: kolory, kroje pisma, logo, narożniki i odstępy. Narzędzia odczytują je po nazwie, więc zmiana tutaj dociera od razu do każdego narzędzia.

![Sekcja Tokens: nagłówek z przykładem z systemu i akcjami plików, kafelki z liczbą tokenów każdego rodzaju, a dalej pary kolorów z odczytami kontrastu](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Nagłówek** podaje przykład z Twojego systemu (*Primary to Spearmint, #033633*) i akcje plików: **Download** (system jako tokeny projektowe lub paleta w pięciu innych formatach), **Copy CSS** i **Add from…**, aby ponownie wczytać plik JSON.
- **Kafelki** podliczają tokeny każdego rodzaju i przenoszą do odpowiedniej sekcji: Colours, Type, Logos, Shape and spacing, More i All tokens. Sekcja zawierająca tylko to, co pochodzi z pustego zestawu początkowego, ma etykietę **Starter**; system dostarczony z aplikacją podlicza własne materiały bez tej etykiety. Na telefonie kafelki zawijają się do dwóch rzędów po trzy.
- **Colours** zaczyna się od par łączonych przez narzędzia (tekst na powierzchni, na kolorze podstawowym, tekst przygaszony na powierzchni), z odczytem APCA w jasnym i ciemnym wyglądzie, i oznacza **Weak contrast** tam, gdzie para nie spełnia wymagań. Dalej jest każda grupa kolorów: skala odcieni jako jeden wiersz znaczników, inne kolory z wartością i odwołaniem używanym przez narzędzia, takim jak `{color.brand.spearmint}`. Naciśnij odwołanie, aby je skopiować. **Edit in Colours** otwiera grupę w sekcji Colours. W systemie projektowym z [rolami kolorów](#colour-roles-what-the-colours-are-called) **Colour roles** jest pierwsze, z każdą rolą raz, pod własną nazwą systemu i w jego kolejności. Rola zachowuje kolor dla każdego wariantu kolorystycznego i wyglądu. Te kolory są wymienione przy roli, a nie jako osobne kolory; zmieniaj je w tabeli Colour roles.
- **Type** i **Logos** wymieniają krój dla każdej roli i każde miejsce na logo, z **Edit in Type** i **Edit in Logos**, gdy masz już własne.
- **Shape and spacing** zawiera **Rounded corners** (`shape.radius`) i **Spacing rhythm** (`space.base`). Każde pokazuje *Lolly default*, dopóki nie przesuniesz suwaka, a potem *Yours*, zapisuje się od razu i można je cofnąć.
- **More tokens** dodaje odstępy, rozmiary, grubość obrysu, krycie, obrót, zwykłe liczby i cienie, zapisywane jako standardowe [tokeny projektowe](/info/design-tokens.html).
- **App appearance (advanced)** wymienia kolory, rozmiary i cienie używane na ekranach samego Lolly, a **Inspect every token (advanced)** wyszukuje i edytuje dowolną zapisaną wartość oraz najpierw pokazuje każdą zmianę do przeglądu. Wartości roli koloru w każdym wariancie kolorystycznym są tam wymienione przy roli: wybierz token roli, aby zobaczyć po jednym wierszu na wariant, z jasnym i ciemnym wyglądem obok siebie. Wiersz podsumowania podaje liczbę wartości przechowywanych przez role. System projektowy tylko do odczytu pokazuje tę samą listę.

Pusta sekcja oferuje **Pick a colour**, **Choose a face** lub **Add a logo**.

<!--i:eti-images-->
## Pliki

Upuść pliki, których używa Twoja marka, poza logo: pliki **wektorowe**, **obrazy**, **audio** i **ruchome** (wideo, Lottie i animacje). Pojawią się w [Assets](/info/using.html#assets-your-library), podzielone na sekcje, i w selektorze zasobów każdego narzędzia. Pozostają na tym urządzeniu.

## Dźwięk

**Dźwięk** wybiera się przez słuchanie. Sekcja otwiera się z trzema początkowymi brzmieniami, **Calm**, **Steady** i **Bright**, każde na karcie w kolorach swojego gatunku i z przyciskiem odtwarzania. Odtwórz jedno, aby usłyszeć krótki fragment; uruchomienie kolejnego zatrzymuje poprzednie. **Choose** ustawia to brzmienie dla każdego zastosowania. Czwarta karta, **Mixed**, nadaje każdemu zastosowaniu własne brzmienie: Calm dla Explain, Steady dla Demonstrate i Bright dla Play. Jej przycisk odtwarzania odtwarza kolejno wszystkie trzy. Nic nie jest zapisywane, dopóki nie wybierzesz **Save sound**. Dźwięk staje się wtedy częścią tego systemu projektowego, z punktem kontrolnym w tej samej historii, z której korzystają inne sekcje. System projektowy bez dźwięku nadal działa jak wcześniej.

Zastosowanie to sytuacja, w której odtwarzany jest dźwięk: na początek **Explain**, **Demonstrate** i **Play**. Każde zastosowanie ma znacznik z własnym przyciskiem odtwarzania. **Music** lub **With narration** nad znacznikami ustawia, czy znacznik odtwarza samą muzykę, czy muzykę pod głosem. Wybrane zastosowanie pokazuje swoje przeznaczenie i muzykę prostymi słowami, na przykład „Ciepłe · 84 bpm · Rhodes, płynący bas, przytłumiona perkusja”. Każde zastosowanie przyjmuje gatunek, tempo i instrumenty wybranego brzmienia (albo własne w trybie Mixed). Każde zachowuje własną melodię i proporcje: Explain sprawia, że melodia nie przeszkadza głosowi, a Play pozwala jej prowadzić. Przełączanie między Mixed a jednym brzmieniem zachowuje obie te cechy. Dodane przez Ciebie zastosowanie zachowuje brzmienie, które ma w Mixed. System projektowy zapisuje Twój wybór. **Add a use** dodaje zastosowanie i pozwala od razu wpisać jego nazwę. **Make main** wybiera zastosowanie odtwarzane, gdy nie wskazano innego. **Another tune** odtwarza nową kompozycję z tymi samymi ustawieniami.

**Edit in the music generator** otwiera [generator muzyki](/info/generated-music.html#the-music-generator) z ustawieniami tego zastosowania i wierszem u góry informującym, czyj dźwięk edytujesz. **Save to this use** przenosi ustawienia z powrotem do sekcji; **Cancel** wraca bez zmian. Niezapisane wybory w sekcji czekają podczas Twojej nieobecności. Jeśli ktoś w tym czasie zapisze dźwięk w innej karcie, nowszy zapis pozostaje, a Twoja edycja zostaje pominięta.

**Voice** wybiera głos dla zastosowania, tempo mowy i głośność muzyki pod głosem; **Hear the voice with the music** odtwarza oba. W **More** są przyciszenie podczas mowy, słowa do wypróbowania (pozostają w sekcji), uwagi dotyczące wymowy (po jednej w wierszu, zapis = wymowa) i uwagi o głosie. Podglądy korzystają z lokalnego modelu mowy i tego samego miksowania co eksport sekwencji. Podgląd stopniowo się wycisza; nie jest to skomponowane zakończenie.

**Notes and signature** zawiera wskazówki, na co zwracać uwagę przy słuchaniu danego zastosowania, i sygnaturę dźwiękową: stały początek lub zakończenie przechowywane jako osobny plik audio. Umieść sygnaturę w sekwencji; wygenerowana muzyka nigdy jej nie zawiera. Wymaganie, którego ta wersja Lolly nie potrafi sprawdzić, blokuje nową muzykę dla tego zastosowania.

**Details** zawiera charakter marki (jakie wrażenie ma wywoływać dźwięk, co pozostaje stałe i czego unikać) i ocenę odsłuchową. **Record a listening review** zapisuje imię i nazwisko oceniającego, datę i uwagi przy zapisanej wersji dźwięku. Każda zmiana ponownie nadaje dźwiękowi status wersji roboczej. Ocena obejmuje tę wersję, a nie każdy utwór utworzony później na podstawie tego brzmienia: odsłuchaj każdą nową pracę przed jej udostępnieniem.

**Make a music project** otwiera zastosowanie w generatorze muzyki jako projekt, który zachowuje zastosowanie, wersję dźwięku i dokładne ustawienia. **New tune** tworzy tam nową kompozycję i zachowuje brzmienie. Jeśli zmienisz ustawienia, **Put the sound back** przywraca brzmienie, a **Keep as my own** pozwala kontynuować z niezależnym utworem. Dopóki nie wybierzesz, projektu nie można zapisać ani pobrać jako utworzonego na podstawie tego brzmienia. Linki udostępniania zawierają tylko ustawienia muzyki. Projekt i zapisany utwór zachowują też uwagi dotyczące dźwięku, które nie trafiają do linków udostępniania ani do publicznych poświadczeń pliku audio. Zachowaj wyrenderowane nagranie, gdy dokładne audio ma przetrwać przyszłe wersje generatora.

<!--i:eti-checklist-->
## Reguły

**Rules** określa, co ludzie mogą zmieniać, co pozostaje stałe i co Lolly może sprawdzić.

![Rules w Lolly Demo: cztery reguły organizacji, każda oznaczona Checked in Design i Required lub Advisory, a dalej Try your design system in use z przykładami gotowymi do renderowania](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** wymienia Twoje reguły. **Add rule** (lub **Add your first rule**) otwiera krótki formularz:

- **Rule name** własnymi słowami, na przykład *Akcenty Beacon*;
- **Check**: **Colour choices**, **Font choices**, **Fixed artwork** lub **Text length**, z używaną rolą marki pod Twoją własną nazwą tej roli;
- **Example**, którego dotyczy (Poster, Title slide, Content slide lub Lolly Chart), **Mode** i to, czy jest **Required**, czy **Advisory**;
- **Reviewed by**, a potem **Save draft** lub **Approve & save**.

Zatwierdzenie zapisuje Twoją własną decyzję na tym urządzeniu. Zatwierdzone wymagane reguły ograniczają plakat wielokrotnego użytku, a kontrole obejmują tylko przykładowe pliki PNG; nie zmieniają żadnego innego narzędzia.

Reguły w pliku tokenów systemu projektowego, takie jak zatwierdzone pary kolorów, grubość i wyrównanie tekstu lub logo dla danej powierzchni, są tu wymienione jako **Checked in Design**. Lolly Design sprawdza je warstwa po warstwie na karcie **Before you export** w panelu eksportu, a `lolly check` robi to samo dla zapisanego dokumentu Lolly Design ([Zanim wyeksportujesz](/info/design.html#before-you-export)). Reguła, której ta kompilacja nie potrafi sprawdzić, zostaje zachowana w dostarczonej postaci i oznaczona **Unchecked**.

Lolly Demo zawiera cztery zatwierdzone reguły organizacji. Nagłówki nigdy nie są pisane samymi wielkimi literami: ta reguła jest wymagana, więc `lolly check` zgłasza taki nagłówek jako błąd. Pozostałe trzy są zaleceniami. Tekst główny jest wyrównany do lewej. Podstawowe znaki są umieszczane na jasnych powierzchniach, a znaki w kontrze na ciemnych. Linie przerywane oznaczają miejsce upuszczenia.

**Try your design system in use** renderuje cztery przykłady z bieżącej rewizji za pomocą **Render & check examples**. Wybierz **Mode** i **Try your own text** dla nagłówka, tekstu uzupełniającego i tekstu slajdu. Każdy przykład informuje o pomiarach, z **See checks & sources** i **Download check report**. **Make reusable poster** pobiera plik `.lolly` ze stałym układem i zatwierdzonymi wyborami danych wejściowych. Przykłady są lokalne: uruchomienie kontroli niczego nie publikuje ani nie zatwierdza.

Kompilacja dostarczana ze stałą marką pokazuje te same reguły i przykłady tylko do odczytu, pod *This brand is set*.

<!--i:eti-graduation-cap-->
## Umiejętności

**Skills** wymienia [umiejętności marki](/info/brand-skills.html) aktywnego systemu projektowego: spisane standardy marki, po jednym na dyscyplinę, dla ludzi i agentów AI. Każdy wiersz podaje dyscyplinę, status nadany przez markę (**Draft** lub **Approved**), informację, czy umiejętność jest publiczna, czy wewnętrzna, oraz jej rewizję. Wybierz wiersz, aby przeczytać umiejętność wraz z zakresem pokrycia, który porównuje jej zapisy z Twoimi tokenami: co Lolly sprawdza, co jest sprzeczne, co się zgadza i co jest tylko wskazówką.

**Download skill (.zip)** zapisuje umiejętność jako folder Agent Skills dla narzędzia agenta, z linkami katalogu wskazującymi na to Lolly. **Copy as one file** umieszcza ten sam tekst w schowku, gotowy do wklejenia w oknie czatu. System projektowy bez własnych umiejętności wymienia podstawowy zestaw, który Lolly tworzy z tokenów i reguł organizacji za każdym razem, gdy jest odczytywany. Sekcja odczytuje umiejętności i nigdy ich nie edytuje.

<!--i:eti-upload-->
## Importuj markę

**Add from…** na pasku otwiera selektor pytający, co masz, a nie w jakim jest formacie:

- **Design tokens or a design file**: JSON DTCG lub Tokens Studio, projekt Penpot, zip z zestawami tokenów, pakiet systemu projektowego Lolly, SVG, `DESIGN.md` lub folder strony marki.
- **PDF**: prezentacja lub plik wytycznych, odczytywany na tym urządzeniu w celu uzyskania kolorów, znaków i osadzonych krojów pisma.
- **Logo or screenshot**: obraz staje się proponowaną paletą, odczytywaną na tym urządzeniu. Odczytywane są kolory, bez kroju pisma i układu.
- **Saved web page**: jeden plik HTML i jego pliki CSS albo wklejony HTML lub CSS, do 20 plików i 2 MB. Odczytywany jest tylko dostarczony przez Ciebie tekst: zasoby z linków nie są pobierane, a skrypty nie są uruchamiane.
- **Font file**: TTF, OTF lub WOFF. Otwiera sekcję Type, w której instalowany jest krój.
- **Website**: jedna strona, odczytywana w celu uzyskania kolorów i typografii. Ten kafelek pojawia się tylko na urządzeniu, które potrafi odczytać stronę, i podaje używany mechanizm odczytu: aplikację na tym urządzeniu lub rozszerzenie przeglądarki w karcie w tle, zalogowane jako Ty. Wpisanie adresu URL tylko wypełnia pole; naciśnięcie przycisku pobierania oznacza zgodę.

Wybierz źródło w postaci pliku projektowego, a następna karta pokaże obsługiwane formaty jako kafelki z ikonami. Cała karta jest jednym miejscem upuszczania. Możesz też upuścić plik na studio.

![Karta importu - na początku obsługiwane formaty jako kafelki z ikonami, a cała karta jest jednym miejscem upuszczania](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- **Pakiet systemu projektowego Lolly** (`.lolly` lub starszy `.zip`) instaluje się w jednym kroku.
- Eksport **Penpot** (`.penpot`) importuje swoje tokeny projektowe.
- Plik **Design Tokens** (W3C DTCG) lub **Tokens Studio** (`.json`) importuje swoje tokeny. Opis, który prosi czytającego o zignorowanie instrukcji, deklaruje uprawnienia lub prosi o uruchomienie kodu, jest pomijany, a import wskazuje, gdzie się znajdował.
- **Zwykły SVG** jest skanowany w poszukiwaniu kolorów, z których wybierasz; pierwszy staje się kolorem podstawowym.
- **`DESIGN.md`** (`.md`) trafia do **Try these colours** z tokenami w zapisanej postaci. Jego treść można zachować jako roboczą umiejętność marki, a karta oznacza wiersze, które proszą czytającego o zignorowanie instrukcji, deklarują uprawnienia lub proszą o uruchomienie kodu. Agenci i strony marki nie widzą wersji roboczej, dopóki nie naciśniesz **Keep this skill** w sekcji Skills, a zachowana umiejętność pozostaje wewnętrzna.
- **Folder strony marki**, wybrany jako folder, upuszczony lub spakowany do zip, trafia do tego samego przeglądu. Każdy plik jest sprawdzany względem `brand.json` w folderze; jeden niezgodny plik powoduje odrzucenie całego folderu. Import dodaje tokeny. Logo i czcionki pozostają w folderze.

::: warning Kontrola instrukcji odczytuje wiersz po wierszu
Kontrola, która pomija instrukcje w opisach pliku tokenów, odczytuje wiersz po wierszu i nie wykrywa innych sformułowań. Przeczytaj plik od nieznanej Ci osoby, zanim zastosujesz tokeny.
:::

Lolly odczytuje stronę marki z dostarczonych przez Ciebie plików. Nie pobiera jej spod adresu innej witryny.

### Plik z własnymi nazwami kolorów

Plik tokenów lub `DESIGN.md` może używać własnych nazw kolorów, takich jak main, accent, supporting i tertiary. Gdy Lolly znajdzie takie nazwy, przegląd wymienia każdą z nich, zanim cokolwiek zostanie zastosowane: nazwę, jej kolor w każdym wyglądzie, token, z którego pochodzi, i interpretację proponowaną przez Lolly. Lolly proponuje interpretacje wyłącznie na podstawie nazw, porównując je z krótką listą, bez modelu. Nazwa spoza listy trafia jako własna nazwa marki, **By name only**. Możesz zmienić dowolną nazwę, określić jej przeznaczenie, nadać inną interpretację lub odznaczyć ją, aby zachować jako nazwany kolor.

**Install with these roles** zapisuje role; **Install without roles** instaluje plik w dostarczonej postaci. Plik bez takich nazw pomija ten krok. Plik, który określa własne role, na przykład zapisany przez Lolly, pokazuje je w zapisanej postaci i instaluje bez zmian; możesz je później edytować w sekcji Colours. Terminal nie ma przeglądu: `lolly system import` zachowuje jawnie podany zapis ról, a nazwy z innych plików pozostawia jako nazwane kolory.

### Sprawdź materiał referencyjny

Logo, zrzut ekranu, witryna lub zapisana strona otwiera **Try these colours**: przykład w proponowanych kolorach, **Main colour**, który możesz zmienić, i nazwę nowego systemu. Pole informuje o skutkach zastosowania: **zastępuje** aktywne ustawienia tokenów wygenerowaną paletą i domyślnymi stylami, **zachowuje** Twoje czcionki i pliki biblioteki, a poprzedni system można **odzyskać**. **Apply suggested settings** zapisuje punkt kontrolny, a potem stosuje jasną i ciemną paletę. **Restore brand settings** może przywrócić stare ustawienia. **Change reference** wybiera inne źródło.

::: details Co jest odczytywane z materiału referencyjnego i raport kontekstu projektowego
**Palette, source details and individual choices** pokazuje, co odczytano, znalezione nazwy czcionek i kontrast podglądu. Nazwy czcionek są tylko sugestiami; krój instalujesz w Type. Szczegóły źródła mogą obejmować typografię, odstępy, dopełnienie i wartości narożników tam, gdzie je zaobserwowano, a w przeciwnym razie mają etykietę **Not observed**. Odczyt zapisanej strony lub witryny przez natywną aplikację raportuje zadeklarowane style, których strona może nie używać. Rozszerzenie przeglądarki może raportować zmierzone style z próbki widocznych elementów. To obserwacje: nic nie jest instalowane, a odstępy ze źródła nigdy nie zastępują Twoich. **Choose individual items in the tray** zachowuje pojedyncze elementy. **Download design context** zapisuje raport JSON z obserwacjami, proponowanymi tokenami i informacjami o źródle (z SHA-256 dostarczonego HTML lub CSS). Raport nie zawiera surowego tekstu strony i nie jest podpisanym Content Credential.
:::

Importy PDF i plików projektowych zachowują własne kontrolki przeglądu. Elementy w **Tray** niczego nie zmieniają, dopóki nie dodasz ich w sekcji odpowiedzialnej za dany rodzaj materiału. `#/start?source=<kind>` otwiera selektor na źródle (`file`, `pdf`, `image`, `font`, `url`, `page`), a `?import` otwiera zwykłą listę.

### Znajdź i porównaj wygląd

Otwórz **Find a look** z Board lub z listy systemów projektowych w Settings. Przeglądaj systemy zapisane na tym urządzeniu i kilka przykładów Lolly do ponownego użycia oraz wyszukuj po nazwie, tagu koloru lub zadeklarowanej czcionce. **Closest to my current palette** sortuje według zmierzonego podobieństwa kolorów, a zgodne czcionki rozstrzygają remisy; to nie jest ocena jakości.

Kliknij wygląd, aby zobaczyć go w kontekście; podgląd niczego nie zmienia. **Use this look** na karcie stosuje ten wygląd. Zapisany system staje się aktywny, co niczego nie edytuje. Kolory przykładu trafiają do otwartego systemu projektowego po zwykłym punkcie kontrolnym. Logo, czcionki i wszystko inne w systemie, czego przykład nie definiuje, pozostają bez zmian. **Compare looks** dodaje pole wyboru do każdej karty: wybierz dwie, aby porównać je obok siebie. **Restore brand settings** odzyskuje poprzedni wygląd. Zapisane systemy mają edytowalne **Search tags** w **Details and design context**. Przykłady to oryginalne zestawienia kolorów Lolly, bez kolekcji zebranej automatycznie z sieci i bez konta.

![Lolly: porównanie Sunroom i Orchard obok siebie przed zastosowaniem któregokolwiek systemu kolorów.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

<!--i:eti-package-->
## Zachowaj i przenoś swój system projektowy

### Przenoszenie marki między urządzeniami

**Export** zapisuje jeden plik **`LollyBrand-….lolly`**: Twoje tokeny, czcionki, logo i preferencję motywu, z manifestem integralności sprawdzanym podczas importu. Wersje internetowe sprzed 1.0.7 nadawały plikowi rozszerzenie `.zip`, a Lolly nadal akceptuje ten zapis. **Tokens (.json)** zapisuje sam dokument tokenów projektowych, bez czcionek i logo, do repozytorium, etapu kompilacji lub innego narzędzia do tokenów.

Aby ponownie go wczytać, użyj **Add from… → Design tokens or a design file** albo upuść plik na studio. Tak współpracownik przekazuje Ci markę lub przenosisz ją do drugiej instalacji, bez konta i chmury. [Współpraca z partnerami](/info/partners.html) opisuje, co jeszcze wysłać, gdy odbiorca Twojej marki pracuje w innej organizacji. Aby zaimportować markę z wiersza poleceń, zobacz [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** pakuje dodane przez Ciebie czcionki w instalowalny RPM. Jeśli przesłałeś którąś z nich samodzielnie, Lolly najpierw prosi o potwierdzenie, że możesz ją dalej rozpowszechniać.

### Przywracanie wcześniejszych ustawień

Otwórz **More** na pasku, wybierz **Restore brand settings**, zaznacz punkt kontrolny z datą i naciśnij **Restore**. Przywraca to kolory, ustawienia typografii i inne tokeny aktywnej marki; pliki czcionek i obrazów pozostają bez zmian. Lolly najpierw zapisuje bieżące ustawienia jako **Before restore**, więc możesz cofnąć przywrócenie nawet po zamknięciu przeglądarki. Na tym urządzeniu zachowywanych jest ostatnich 20 punktów kontrolnych. Edycja dokonana, gdy studio pokazuje **Saving…**, przetrwa przeładowanie, a karta oferuje przywrócenie zmian, których zapisywanie się nie zakończyło.

### Wersje

Opublikowana wersja to **trwała, nazwana kopia** przechowywana na tym urządzeniu. Nigdy się nie zmienia, więc narzędzie lub link, który ją przypina (przez `designv`), nadal rysuje to samo. System zawierający coś Twojego wymienia **Versions & publishing** w menu **More** na pasku; po pierwszej publikacji do sekcji dołącza **Versions**. `#/start?area=versions` otwiera Versions.

::: warning Opublikowana wersja jest trwała
Nie ma jeszcze usuwania i panel o tym informuje. Publikacji nie można cofnąć; przywrócenie można. *Restore latest from this version* to zwykła edycja, po której od razu dostępne jest **Undo**.
:::

**Usunięcia są na początku karty zgodności**, ponieważ usunięty token zakłóca działanie narzędzia.

**Publish only** zachowuje wersję bez zmiany tego, za czym podążają narzędzia; **Publish and make active** sprawia, że narzędzia i aplikacja podążają za tą wersją. **Follow the latest again** od razu wprowadza każdą edycję w życie.

### Publikowanie strony marki

[Strona marki](/info/brand-page.html) to jeden adres dla ludzi i agentów: strona z logo, kolorami, typografią i przykładami, z tymi samymi informacjami w plikach obok. **Publish a brand page** w Versions & publishing pokazuje stronę na żywo, a obok niej:

- **Goes public**: każdy plik, w grupach, z jego rozmiarem.
- **Held back**: co pominięto i dlaczego. Logo bez zapisanej licencji jest pomijane, dopóki nie zaznaczysz jego nazwy. Plik czcionki wymaga zapisanej licencji zezwalającej na dalsze udostępnianie, a gdy plik jest pomijany, strona pokazuje próbkę zamienioną na krzywe. Wewnętrzne umiejętności marki nigdy się nie pojawiają.
- **What was checked**: pary kolorów dla każdego wariantu kolorystycznego i trybu oraz reguły organizacji. To pomiary, a nie werdykt.
- **In your words**: oświadczenie dotyczące użycia i kontakt. Strona wyświetla to, co napiszesz, a Lolly nie dodaje licencji ani twierdzeń prawnych. Przełącznik wyłącza wiersz „Made with Lolly” w stopce.
- **On exports**: przełącznik, który [zapisuje adres strony w eksportach tego systemu projektowego](/info/brand-page.html#lead-back-from-your-files). Jest wyłączony, dopóki go nie włączysz, wymaga adresu `https` i nie jest przenoszony z pakietem ani kopią. Zablokowany system projektowy nie pokazuje przełącznika, ponieważ decyduje o tym jego zarządca.

**Download folder** zapisuje folder jako ZIP, który możesz udostępnić na wybranym hostingu. Nic nie staje się publiczne, dopóki nie udostępnisz folderu. W terminalu `lolly system publish --out=<dir>` zapisuje ten sam folder. Instancja udostępniająca strony marek oferuje też **Publish to** pod swoim adresem: jedno świadome naciśnięcie, przez łańcuch zatwierdzania instancji, jeśli go ma. Zarządzany system projektowy publikuje tylko za zgodą swojego zarządcy.

### Podłącz agenta

**Connect an agent** w tym samym miejscu daje tekst do wklejenia i informuje, co potrafi każda opcja:

- **`AGENTS.md`** w projekcie: agenci odczytują nazwy i reguły systemu. Niczego nie rysuje i nie wymaga serwera.
- **Publiczny serwer Lolly**: rysuje z Lolly Demo niezależnie od tego, który system masz tu otwarty. Nie wymaga klucza.
- **Twoja instancja**: rysuje z systemami przechowywanymi przez instancję i odczytuje token usługi ze zmiennej środowiskowej. Panel podaje nazwę zmiennej i nigdy nie pokazuje tokenu.

Gdy żaden hostowany serwer nie rysuje z Twoim systemem, panel o tym informuje.

<!--i:eti-layers-->
## Zarządzaj swoimi systemami projektowymi

Otwórz **Settings → Preferences → Design systems**, aby przełączać, dodawać lub usuwać systemy. **Open** wybiera system i otwiera go tutaj; **Make a new one** tworzy lokalny system i otwiera go z gotowym polem nazwy. W danej chwili aktywny jest jeden system dla całego urządzenia. [Architektury marek](/info/brand-architectures.html) pomagają zdecydować, kiedy marka potrzebuje własnego systemu projektowego.

**Skąd pochodzi system.** System dostarczany przez katalog wdrożenia ma etykietę **Came with this app** lub **From this instance** w aplikacji połączonej z instancją. Rozwiń **Catalogue source**, aby zobaczyć dostawcę, zasób tokenów, przestrzeń nazw i znaną wersję lub sumę kontrolną; jeśli odświeżenie się nie powiedzie, materiały z pamięci podręcznej są oznaczone.

**Zarządzane systemy są tylko do odczytu.** System ma etykietę **Managed by this instance** (lub **Managed by this app** w aplikacji komputerowej bez instancji), gdy katalog go blokuje. Możesz używać zarządzanego systemu i go pobierać. Otwarcie go tutaj pokazuje informację o trybie tylko do odczytu z **Make an editable copy** i **Switch**, a potem jego role kolorów i tokeny bez kontrolek edycji. Twoje własne lokalne systemy pozostają edytowalne, nawet jeśli zarządzany system był pierwszy. Kompilacja z jedną stałą marką otwiera Lolly Design System Setup na *This brand is set*, z tokenami i regułami użycia marki do przeczytania.

**Każdy inny dostarczony system należy do Ciebie** i możesz go ukrywać, edytować i resetować, w tym Lolly Demo i Lolly Starter na lolly.tools. Edycja zachowuje jego nazwę i oznacza wiersz **Edited here**. **Reset to original** w jego menu odrzuca zmiany dokonane na tym urządzeniu. Wyjątkiem jest pusty zestaw początkowy: pierwsza zmiana tworzy w nim Twój własny system projektowy, a Lolly raz pyta o nazwę. [Lolly Demo w użyciu](/info/lolly-demo-in-use.html#switch-to-your-own) pokazuje, co zastępuje Twój własny system.

### Usuwanie systemu projektowego

Wybierz **Remove** z menu systemu; potwierdzenie podaje, który system będzie potem aktywny. Zapisane sesje, przesłane pliki i materiały współdzielone z innym systemem zostają.

Usunięcie dostarczonego systemu tylko go ukrywa: jego zasoby katalogowe zostają, **Bring back** pokazuje go ponownie i wraca on sam, jeśli usuniesz wszystko inne. Usunięcie zaimportowanej lub edytowanej kopii nie usuwa dostarczonego systemu, jego logo ani czcionek. Jeśli kopia była aktywna, dostarczony system znów staje się aktywny. Usunięcie aktywnej kopii hostowanej czyści tylko połączenie tej kopii; osobno wybrana instancja pozostaje wybrana.

::: details Zmiana systemu projektowego dostarczanego przez serwer
Zmiana tego, co dostarcza serwer, jest zadaniem administratora: operator zmienia katalog źródłowy i ponownie wdraża serwer albo administrator Lolly Work przegląda i stosuje zmianę serwera. Edycje tutaj pozostają lokalne, z jednym wyjątkiem. W instancji Lolly Work, która przyznaje Ci `brand.edit`, zarządzany system oferuje też **Edit for** dla tej instancji, co otwiera kopię do edycji. **Send to** dla tej instancji w **Versions** wysyła z powrotem kolory, warianty kolorystyczne, role kolorów i adres strony marki. [Edytowanie tej instancji ze studia](/info/work-design-system-administration.html#edit-this-instance-from-the-studio) opisuje, co można zmienić i jak instancja udostępnia zmianę. Zobacz [Usuwanie katalogowego systemu projektowego](/info/configuration.html#removing-a-catalogue-design-system) i [Konfiguracja](/info/configuration.html#supplied-and-local-design-systems).
:::

<!--i:eti-code-->
## Używaj kontekstu projektowego poza aplikacją

**Download design context** zapisuje dokument tokenów, rozpoznane kolory, zadeklarowane rodziny czcionek, identyfikatory zasobów, dowody źródłowe tam, gdzie je zapisano, zakres pokrycia i jawne reguły, bez plików czcionek i dowodu własności. Wiersz poleceń odczytuje plik bez serwera: `lolly system import` ustawia go jako system projektowy terminala, a `lolly system check` sprawdza dane wejściowe Lolly Design względem zapisanego kontekstu. [Importowanie własnego systemu projektowego](/info/cli.html#bring-your-design-system) opisuje import, a [Którego systemu projektowego używa polecenie](/info/cli-decks.html#which-design-system-a-command-uses) opisuje kontrolę. Klient MCP odczytuje ten sam brief z `lolly://design-context` ([Serwer MCP](/info/mcp.html)).

<!--i:eti-map-pin-->
## Co dalej

- **[Korzystanie z Lolly](/info/using.html)**: narzędzia, zapisywanie, udostępnianie i Assets.
- **[Architektury marek](/info/brand-architectures.html)**: jak działy, produkty, marki wspierane, klienci i sezony odpowiadają systemom projektowym, wariantom kolorystycznym i tożsamościom logo.
- **[Współpraca z partnerami](/info/partners.html)**: udostępnianie marki partnerowi i praca w otrzymanej marce.
- **[Strony marek](/info/brand-page.html)**: opublikuj system projektowy pod jednym adresem jako zestaw prasowy i zestaw dla agentów.
- **[Tokeny projektowe](/info/design-tokens.html)**: model tokenów, w którym zapisana jest Twoja marka.
- **[Eksport pliku](/info/exporting.html)**: jednostki druku, CMYK i formaty, do których renderowana jest Twoja marka.
