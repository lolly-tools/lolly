# Start

Ustaw w narzędziach własne kolory i czcionki oraz ponownie wykorzystaj pracę, którą już masz. Nie potrzebujesz konta, a tworzenie i eksport odbywają się na Twoim urządzeniu.

::: steps
- <!--i:eti-sparkles--> **[Utwórz jeden plik](/info/make-something.html)** Kod QR w kilka minut, z pokazanym każdym krokiem.
- <!--i:eti-palette--> **[Dodaj swoją markę](#put-your-brand-in)** Zacznij od jednego koloru, pliku tokenów lub gotowego projektu.
- <!--i:eti-folder-move--> **[Wczytaj swoją pracę](#bring-in-what-you-already-have)** Projekty, prezentacje i dane, które już masz, odczytywane na Twoim urządzeniu.
- <!--i:eti-repeat--> **[Twórz kolejne podobne materiały](#make-many-share-and-automate)** Udostępnij link, wypełnij arkusz kalkulacyjny lub uruchom narzędzie ze skryptu.
:::

[Czym jest Lolly?](/info/what-is-lolly.html) to pięciominutowe wprowadzenie. [Jak działa Lolly](/info/how-lolly-works.html) pokazuje, kto co robi.

<!--i:eti-palette-->
## Dodaj swoją markę

lolly.tools otwiera się z **Lolly Demo**, własnym przykładowym systemem projektowym Lolly ([Poznaj Lolly Demo](/info/lolly-demo.html)). Twój system projektowy zastępuje Lolly Demo. To niewielki zestaw tokenów projektowych (kolorów, czcionek i kilku reguł), którymi rysuje każde narzędzie. Ustaw go raz, a wszystko, co tworzysz, od początku będzie zgodne z marką.

Wybierz drogę pasującą do tego, co masz:

- <!--i:palette--> **Jeden kolor.** Otwórz widok **Design System Setup** (`#/start`), nazwij system projektowy i wybierz kolor podstawowy. Lolly wyprowadza z niego paletę spełniającą wymagania dostępności, z jasnymi i ciemnymi powierzchniami, tekstem i akcentami. Wybierz czcionkę i masz gotową identyfikację marki.
- <!--i:upload--> **Plik tokenów.** **Add from…** u góry Lolly Design System Setup przyjmuje plik tokenów DTCG, Tokens Studio lub Penpot, plik SVG albo pakiet `LollyBrand`. Paleta wypełnia się z pliku. Gdy system projektowy jest pusty, **Start from a reference** na Board otwiera ten sam selektor.
- <!--i:pentool--> **Gotowy projekt.** W Lolly Design wybierz **Import a design** i upuść plik Figma, Penpot, Illustrator, InDesign, Affinity, Photoshop, PowerPoint lub SVG ([wszystkie formaty](/info/design-import.html#what-comes-in-from-each-app)). Zobacz poniżej [Wczytaj to, co już masz](#bring-in-what-you-already-have).

Przy pierwszym otwarciu galerii powitanie u góry proponuje jeden następny krok. W lolly.tools **Start making** otwiera Lolly Design z plakatem Launch. W nowej instalacji **Make it yours** otwiera Lolly Design System Setup. Pod tym przyciskiem **Bring a file** otwiera selektor pliku projektu, a druga z tych dwóch opcji pojawia się jako link. Każda z tych akcji lub przycisk zamknięcia chowa powitanie na stałe.

![Sekcja Colours w Lolly Design System Setup dla nowego systemu projektowego: jedna aktywna próbka, jedno pole i cała pierwsza decyzja](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-colours-new-system)

Osiem sekcji, używanych w dowolnej kolejności, rozwija system projektowy: **Board**, **Colours**, **Type**, **Logos**, **Tokens**, **Files**, **Rules** i **Skills**. Każdy podgląd w aplikacji aktualizuje się podczas wpisywania. [Lolly Design System Setup](/info/brand-studio.html) opisuje każdą sekcję.

Czcionki są przechowywane na Twoim urządzeniu. Wybrana czcionka Google Fonts jest zapisywana jako zasób marki, więc Twoja typografia działa offline i nic nie jest pobierane, gdy narzędzie rysuje.

### Wyświetlanie, przełączanie i udostępnianie systemu projektowego

- **Zobacz aktywny system.** **Settings → Design system** pokazuje aktywny system projektowy jako okładkę i strony, tylko do odczytu.
- **Przełączaj systemy.** **Settings → Preferences → Design systems** wymienia wszystkie systemy projektowe na tym urządzeniu. Jedna organizacja może prowadzić kilka systemów projektowych lub jeden z kilkoma wariantami kolorystycznymi. [Architektury marek](/info/brand-architectures.html) przedstawiają te układy.
- **Udostępnij system.** Wyeksportuj system projektowy jako pakiet `LollyBrand`: jeden plik, który współpracownik importuje, aby uzyskać tę samą paletę, czcionki i reguły.

System projektowy dostarczony z Twoją kompilacją lub przez organizację jest **zarządzany**: ma ikonę kłódki i pozostaje tylko do odczytu. Aby go zmienić, utwórz edytowalną kopię w **Settings → Preferences → Design systems**.

![Karta Design system w Settings: aktywny system projektowy jako okładka i strony](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

Twój system projektowy to tokeny DTCG, format odczytywany i zapisywany przez Penpot oraz przenoszony do Figma przez Tokens Studio. Paleta, z którą projektujesz, i paleta stosowana przez Lolly to jeden dokument. Szczegóły znajdziesz w [Tokenach projektowych](/info/design-tokens.html).

::: details Dla programistów: zbuduj pakiet marki z wiersza poleceń
`ingest:brand` buduje pakiet marki do wielokrotnego użytku w lokalnej kopii repozytorium. Przyjmuje trzy postacie eksportu z Penpot i Tokens Studio: pojedynczy plik `tokens.json`, katalog z plikami poszczególnych zestawów i plikiem `$metadata.json` lub archiwum `project.penpot`.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` rejestruje markę jako profil oraz buduje i sprawdza jej katalog. Nigdy nie zmienia profilu domyślnego: uruchom z `LOLLY_PROFILE=acme`, aby użyć nowego pakietu. [Konfiguracja](/info/configuration.html) wyjaśnia powiązania między pakietami marki a profilami.
:::

<!--i:eti-folder-move-->
## Wczytaj to, co już masz

**Pliki Lolly Design.** Gotowe prace z Figma, Penpot, Illustrator, InDesign lub dowolnej aplikacji do SVG otwierają się w Lolly Design jako edytowalne układy. Tekst można dalej zmieniać, kształty pozostają kształtami, a obrazy trafiają do Twojej biblioteki. Plik jest odczytywany w przeglądarce i nic nie jest przesyłane. [Import projektu](/info/design-import.html) opisuje każdy format i to, co zostaje zachowane.

**Prezentacje.** Upuść plik PowerPoint `.pptx` w Lolly, aby zapisać jego slajdy jako zasoby. Napisz nową prezentację w Markdown w **Lolly Markdown Slides**. [Dostosowanie prezentacji do marki](/info/rebrand.html) przenosi prezentację do Twojego systemu projektowego.

**Dane.** Wklej lub upuść tabelę CSV lub JSON, aby wypełnić powtarzalne pola narzędzia. [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) tworzy jeden gotowy plik na wiersz.

### Od jednorazowego projektu do szablonu

Zaimportowany układ to zwykła sesja Lolly Design. **Share with rules** zmienia sesję w narzędzie. Wybierasz części, które inni mogą zmieniać, a oni wypełniają tylko je.

![Zachowaj wzorzec Lolly Design, wybierz dane wejściowe i ograniczenia w kopii autorskiej, a następnie udostępnij narzędzie .lolly do wielokrotnego użytku, które odbiorcy wypełniają](/info/diagrams/concepts/share-with-rules.svg)

[Udostępnianie projektu z regułami](/info/create-a-tool.html) prowadzi przez każdy krok.

<!--i:eti-repeat-->
## Twórz wiele plików, udostępniaj i automatyzuj

- <!--i:download--> **Eksportuj.** Narzędzia tworzą SVG, PDF, PNG, JPG, WebP, wideo i inne formaty, w razie potrzeby w rzeczywistych wymiarach do druku. Każde narzędzie oferuje własny zestaw formatów. Zobacz [Eksport pliku](/info/exporting.html).
- <!--i:link--> **Udostępnij link.** Ustawienia narzędzia są zapisane w linku, więc link otwiera ponownie ten sam plik w dowolnym miejscu.
- <!--i:layers--> **Utwórz plik dla każdego wiersza.** Zasil narzędzie arkuszem kalkulacyjnym w [Lolly Batch](/info/batch.html#make-many-versions-of-one-design).
- <!--i:cpu--> **Automatyzuj.** Ten sam render uruchomisz z [CLI](/info/cli.html) i przez [agenta AI](/info/ai-agents.html).

Link to kompletne żądanie. Typ, nagłówek i tabelę danych poniższego wykresu wpisano w pasku adresu.

![Wykres słupkowy miesięcznych rejestracji według kanału w kolorach systemu projektowego, z każdą wartością przekazaną jako parametr zapytania zamiast kliknięcia](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26sty%3Dposter%26pl%3Droles%26transparentBg%3Dfalse%26d%3DMonth%2CWeb%2CApp%2CPartners%250AJan%2C120%2C60%2C25%250AFeb%2C180%2C95%2C40%250AMar%2C265%2C150%2C70%250AApr%2C340%2C210%2C110%250AMay%2C455%2C290%2C160%250AJun%2C560%2C380%2C230%26t%3DSignups%2520this%2520year%26st%3DBy%2520channel%252C%2520January%2520to%2520June%26full&width=1440&height=900&dpi=192&waitMs=4000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

<!--i:eti-map-pin-->
## Co dalej

- <!--i:people--> **[Twórz](/info/creators.html)**: tworzenie, animowanie, nagrywanie, udostępnianie i eksportowanie.
- <!--i:code--> **[Automatyzuj](/info/builders.html)**: systemy projektowe, tworzenie narzędzi, wiersz poleceń, linki i agenci.
- <!--i:usercheck--> **[Zarządzaj](/info/operators.html)**: prowadzenie Lolly dla zespołu z Lolly Work.
- <!--i:server--> **[Wdrażaj](/info/operate.html)**: hosting Lolly i Lolly Work.
- <!--i:shieldcheck--> **[Zaufaj](/info/trust.html)**: prywatność, bezpieczeństwo i samodzielne sprawdzanie pliku.
