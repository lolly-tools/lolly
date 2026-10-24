# Start

Do końca tej strony Twoje narzędzia będą nosić Twoje własne kolory i czcionki, a praca, którą już masz, będzie gotowa do ponownego użycia. Nie potrzebujesz konta, a tworzenie i eksport działają na Twoim urządzeniu.

::: timeline
- <!--i:sparkle--> **Zrób jeden plik.** [Make your first file](/info/make-something.html) przeprowadza Cię przez kod QR w kilka minut.
- <!--i:palette--> **Wprowadź swoją markę.** Zacznij od jednego koloru, pliku tokenów lub gotowego projektu.
- <!--i:layers--> **Rób więcej tego samego.** Udostępnij link, wypełnij arkusz kalkulacyjny albo uruchom narzędzie ze skryptu.
:::

Nowy w samej idei? [What is Lolly?](/info/what-is-lolly.html) to pięciominutowe wprowadzenie, a [How Lolly works](/info/how-lolly-works.html) pokazuje, kto co robi.

## Wprowadź swoją markę

lolly.tools otwiera się w **Lolly Demo**, własnym przykładowym systemie projektowym Lolly; [Meet Lolly Demo](/info/lolly-demo.html) pokazuje, na co patrzysz. Twój system projektowy go zastępuje: mały zestaw tokenów projektowych, czyli kolorów, czcionek i kilku reguł, z których korzysta każde narzędzie. Ustaw go raz, a wszystko, co zrobisz, zaczyna się zgodnie z marką.

Wybierz drogę odpowiednią do tego, co masz:

- <!--i:palette--> **Jeden kolor.** Otwórz **Design System Setup** (`#/start`), nazwij swój system projektowy i wybierz kolor podstawowy. Lolly wyprowadza z niego pełną, dostępną paletę, z jasnymi i ciemnymi powierzchniami, tekstem i akcentami. Wybierz czcionkę i masz działającą markę.
- <!--i:upload--> **Plik tokenów.** **Add from…** na dole szyny pokoi w Design System Setup przyjmuje plik tokenów DTCG, Tokens Studio lub Penpot, plik SVG albo paczkę `LollyBrand`. Upuść go i paleta się wypełni. Dopóki system projektowy jest pusty, **Start from a reference** w pokoju Overview otwiera ten sam selektor.
- <!--i:pentool--> **Gotowy projekt.** W Design wybierz **Import a design** i upuść plik `.fig`, `.penpot`, `.ai`, `.idml` lub SVG. Zobacz [Bring in what you already have](#bring-in-what-you-already-have) poniżej.

Przy pierwszym otwarciu galerii krótkie powitanie oferuje te same wybory: **Make it yours** otwiera Design System Setup, **Bring your design** otwiera selektor plików dla projektu, a **Explore the community tools** zamyka powitanie.

![Pokój Colours w Design System Setup na świeżej instalacji: jeden żywy znacznik, jedno pole i cała pierwsza decyzja](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

Stamtąd siedem pokoi zaprowadzi Cię tak daleko, jak chcesz, w dowolnej kolejności: **Overview**, **Colours**, **Type**, **Logos**, **Tokens**, **Files** i **Usage & rules**. Każdy podgląd w aplikacji aktualizuje się w trakcie pisania. [Design System Setup](/info/brand-studio.html) opisuje każdy pokój.

Czcionki są przechowywane na Twoim urządzeniu. Wybierz czcionkę Google, a Lolly zapisze plik jako zasób marki, więc Twoja typografia podróżuje offline i nic nie jest pobierane, gdy narzędzie rysuje.

### Zobacz, przełączaj i udostępniaj system projektowy

- **Zobacz aktywny.** **Settings → Design system** pokazuje aktywny system projektowy jako okładkę i strony, tylko do odczytu.
- **Przełączaj między nimi.** **Settings → Preferences → Design systems** wymienia każdy system projektowy na tym urządzeniu. Jedna organizacja może prowadzić kilka systemów projektowych albo jeden z kilkoma wariantami kolorystycznymi (colourway); [Brand architectures](/info/brand-architectures.html) mapuje te układy.
- **Udostępnij jeden.** Wyeksportuj system projektowy jako paczkę `LollyBrand`: jeden plik, który współpracownik importuje, aby dostać tę samą paletę, czcionki i reguły.

System projektowy dostarczony przez Twoją kompilację lub organizację jest **zarządzany**: pokazuje kłódkę i pozostaje tylko do odczytu. Aby go zmienić, utwórz edytowalną kopię w **Settings → Preferences → Design systems**.

![Karta Design system w Settings: aktywny system projektowy jako okładka i strony](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

Twój system projektowy to tokeny DTCG, format, który Penpot czyta i zapisuje, a Tokens Studio wprowadza do Figmy, więc paleta, w której projektujesz, i paleta, którą stosuje Lolly, to jeden dokument. [Design Tokens](/info/design-tokens.html) podaje szczegóły.

::: details Dla deweloperów: zbuduj paczkę marki z wiersza poleceń
Aby postawić wielokrotnego użytku paczkę marki w repozytorium, `ingest:brand` przyjmuje trzy kontenery eksportowane przez Penpot i Tokens Studio: pojedynczy `tokens.json`, katalog plików poszczególnych zestawów z `$metadata.json` lub archiwum `project.penpot`.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` rejestruje markę jako profil oraz buduje i waliduje jej katalog. Nigdy nie zmienia profilu domyślnego: uruchom z `LOLLY_PROFILE=acme`, aby użyć nowej paczki. [Configuration](/info/configuration.html) wyjaśnia, jak paczki marek i profile do siebie pasują.
:::

## Wprowadź to, co już masz

Nie zaczynasz od pustej strony.

**Pliki projektowe.** Gotowa praca z Figmy, Penpot, Illustratora, InDesign lub dowolnej aplikacji SVG otwiera się w Design jako żywy układ: tekst da się dalej edytować, kształty pozostają kształtami, a obrazy trafiają do Twojej biblioteki. Plik jest czytany w przeglądarce i nic nie jest wysyłane. [Import a design](/info/design-import.html) wymienia każdy format i to, co się przenosi.

**Prezentacje.** Upuść PowerPoint `.pptx` na Lolly, aby zapisać jego slajdy jako zasoby, napisz nową prezentację z Markdown w **Markdown Slides** albo użyj [Rebrand a deck](/info/rebrand.html), aby przenieść całą prezentację na Twój system projektowy.

**Dane.** Wklej lub upuść tabelę CSV albo JSON, a powtarzalne pola narzędzia wypełnią się z niej, lub użyj [Batch](/info/batch.html#make-many-versions-of-one-design), aby wygenerować jeden gotowy plik na wiersz.

### Od jednorazowego projektu do szablonu

Zaimportowany układ to zwykła sesja Design. **Share with rules** zamienia go w narzędzie: wybierasz, które części inni mogą zmieniać, a oni wypełniają tylko te.

![Zachowaj wzorzec Design, wybierz dane wejściowe i limity w kopii autorskiej, a potem udostępnij narzędzie .lolly wielokrotnego użytku, które odbiorcy wypełniają](/info/diagrams/concepts/share-with-rules.svg)

[Share a design with rules](/info/create-a-tool.html) prowadzi przez każdy krok.

## Twórz wiele, udostępniaj i automatyzuj

- <!--i:download--> **Eksport.** Narzędzia tworzą SVG, PDF, PNG, JPG, WebP, wideo i inne, w formatach oferowanych przez każde narzędzie, w prawdziwych rozmiarach do druku, gdy ich potrzebujesz. Zobacz [Export a file](/info/exporting.html).
- <!--i:link--> **Udostępnij link.** Ustawienia narzędzia podróżują w jego linku, więc link otwiera ten sam plik w dowolnym miejscu.
- <!--i:layers--> **Jeden plik na wiersz.** Steruj narzędziem z arkusza kalkulacyjnego w [Batch](/info/batch.html#make-many-versions-of-one-design).
- <!--i:cpu--> **Automatyzuj.** To samo renderowanie działa z [CLI](/info/cli.html) i z [agenta AI](/info/ai-agents.html).

Link to kompletne żądanie. Nikt nie rysował poniższego wykresu: jego typ, nagłówek i cała tabela danych zostały wpisane w pasek adresu, a ten sam link rysuje ten sam wykres na każdym urządzeniu.

![Wykres warstwowy comiesięcznych rejestracji, gdzie każda wartość dotarła jako parametr zapytania, a nie jako kliknięcie](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Dokąd dalej

- <!--i:people--> **[Create](/info/creators.html)**: tworzenie, animowanie, nagrywanie, udostępnianie i eksport.
- <!--i:code--> **[Automate](/info/builders.html)**: systemy projektowe, tworzenie narzędzi, wiersz poleceń, linki i agenci.
- <!--i:usercheck--> **[Manage](/info/operators.html)**: prowadzenie Lolly dla zespołu z Lolly Work.
- <!--i:server--> **[Deploy](/info/operate.html)**: hostowanie Lolly i Lolly Work.
- <!--i:shieldcheck--> **[Trust](/info/trust.html)**: prywatność, bezpieczeństwo i samodzielne sprawdzanie pliku.
