# Pytania & odpowiedzi

Często zadawane pytania, wyświetlane jako akordeon na `/info/start/faq.html`.

**Jak utrzymywać:** każdy nagłówek `##` poniżej jest pytaniem. Wszystko pod nagłówkiem,
aż do następnego `##`, jest odpowiedzią. Odpowiedzi używają uproszczonego Markdown witryny:
oddzielaj akapity pustą linią. Tutaj dodawaj, usuwaj lub przestawiaj pytania i
uruchom ponownie `pnpm run build:info` (lub `pnpm run dev:web`).
Proces budowania ignoruje wszystko nad pierwszym `##` (ten tytuł i te uwagi).

Kolejność jest dla początkujących: najpierw haczyk, potem Twoje pliki, potem pobranie
i uruchomienie Lolly, następnie organizacje, a na końcu sposób powstania. Kotwica każdego pytania
powstaje z angielskiego pytania na tej samej pozycji, więc tłumaczenie zachowuje
angielską kolejność.

## Dlaczego to jest bezpłatne? Gdzie jest haczyk?

**Zbudowaliśmy Lolly dla siebie.** SUSE potrzebowało tysięcy plików zgodnych z marką, tworzonych bez przekazywania czegokolwiek zewnętrznym usługom. Zbudowaliśmy więc narzędzie, które robi to wszystko na urządzeniu, i udostępniliśmy je jako open source, tak jak wszystko inne, co tworzymy. Nadal je utrzymujemy, bo używamy go codziennie. **Nie ma żadnych zobowiązań:** wszystko tutaj działa z nami lub bez nas.

Ta granica jest zapisana w licencji, nie w obietnicy: wszystko, co działa lokalnie, jest bezpłatne na zawsze. Wydana wersja ma licencję, której nie można cofnąć. Żadna umowa z twórcą nie mogłaby zmienić licencji czyjejkolwiek pracy.

## Ile SUSE zachowuje dla siebie? (czyli kiedy zostaniemy na lodzie)

Silnik, powłoki, schematy i narzędzia niezależne od marki są open source. Znaki towarowe SUSE i narzędzia związane z marką pozostają prywatne i są już wydzielone. Publiczna instancja pod [lolly.tools](https://lolly.tools) działa z [Lolly Demo](/info/lolly-demo.html), własnym systemem projektowym Lolly.

Nic tutaj nie opiera się na obietnicy: każda wydana wersja pozostaje open source. Gdy inna firma zamknęła w 2023 roku źródła swojego systemu Linux dla przedsiębiorstw, SUSE współtworzyło [OpenELA](https://openela.org), aby ten kod pozostał otwarty. Ten projekt przejmuje to podejście.

SUSE *rzeczywiście* buduje wewnętrzne narzędzia łączące Lolly z własnymi systemami IT. To wewnętrzna konfiguracja SUSE, a nie podział na rozwój publiczny i prywatny. Lolly ma też docelowo być budowane przez [Open Build Service](https://openbuildservice.org/), z artefaktami z bezpiecznego łańcucha dostaw dostarczanymi przez [SUSE Application Collection](https://apps.rancher.io/applications).

## Skąd nazwa „Lolly Tools”?

**Lolly**, bo wolność jest słodka, a w Australii, Nowej Zelandii i Wielkiej Brytanii lolly oznacza słodycz.

**Tools**, bo narzędzie czeka bezczynnie, aż po nie sięgniesz. Nie działa, gdy go nie używasz, i nie obserwuje Cię, gdy z niego korzystasz.

## Dlaczego wszystko jest zielone?

lolly.tools otwiera się z [Lolly Demo](/info/lolly-demo.html), własnym przykładowym systemem projektowym Lolly, którego głównym kolorem jest zielony. Przełącz się na **Lolly Starter**, pusty system projektowy, lub na własny w [Settings → Design systems](/#/settings?focus=design-systems-section).

## Czy mogę używać własnej marki?

Tak. **Lolly Design System Setup** (`#/start`) buduje system projektowy z jednego koloru, pliku tokenów projektowych lub gotowego projektu. Każde narzędzie rysuje potem z użyciem Twojego systemu projektowego. [Start](/info/quickstart.html#put-your-brand-in) prowadzi przez te trzy drogi.

System projektowy dostarczony przez Twoją organizację lub Twoją wersję aplikacji jest zarządzany. Pokazuje kłódkę i pozostaje tylko do odczytu. Aby go zmienić, utwórz edytowalną kopię.

## Gdzie jest to, co zrobiłem wczoraj?

Jeśli nacisnąłeś **Save as** lub **Save**, Twoja praca jest w **Projects** na ekranie głównym, w przeglądarce lub aplikacji, z której ją zapisałeś. Jeśli nacisnąłeś tylko **Download**, plik jest w pobranych plikach przeglądarki lub systemu, a kopia zwykle w **Assets**. Narzędzia, które [zapisują w trakcie pracy](/info/find-your-work.html#which-tools-save-as-you-work), przechowują też niezapisaną pracę w **Projects**. [Znajdowanie i odzyskiwanie pracy](/info/find-your-work.html) opisuje każdy przypadek.

## Zamknąłem kartę. Czy moja praca przepadła?

Zapisana praca nadal jest w **Projects**. Niezapisana praca przepada, z wyjątkiem narzędzi zapisujących w trakcie pracy, które też przechowują ją w **Projects**. Następnym razem naciśnij **Save as**, zanim wyjdziesz. Zobacz [Jeśli zamknąłeś kartę lub opuściłeś narzędzie](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## Czy mogę udostępnić pracę jako plik zamiast linku?

Tak. Gdy link nie może przenieść wszystkiego, na przykład własnych zdjęć lub długiego tekstu, okno Share podaje, czego zabraknie, i proponuje plik **.lolly**. Ten jeden plik zawiera projekt, używane w nim obrazy i, jeśli tak zdecydujesz, narzędzie.

Ty decydujesz, ile danych przekazujesz. Twoje imię i nazwisko oraz dane są dołączane tylko wtedy, gdy wyrazisz na to zgodę w profilu. Licencjonowane grafiki są pomijane, chyba że zdecydujesz się je dołączyć. Osoba otwierająca plik zawierający narzędzie musi potwierdzić, że mu ufa, zanim będzie mogło się uruchomić. Zobacz [Udostępnianie pracy](/info/using.html#sharing-your-work).

## Do czego służą dane mojego profilu?

Twoje dane w **Settings** wstępnie wypełniają narzędzia, które o nie proszą, na przykład imię i nazwisko na identyfikatorze. Pozostają na tym urządzeniu. Nic nie trafia do Twoich prac, dopóki nie włączysz opcji zgody. Wtedy wybrane dane zostają trwale dołączone i wskazują Ciebie jako źródło.

Udostępnianie i Sync wysyłają tylko wybraną przez Ciebie zawartość. W instancji Lolly Work organizacji udostępniane sesje i prace objęte nadzorem trafiają też na ten serwer. Zobacz [Prywatność](/info/privacy.html).

## Jak pobrać aplikacje mobilne lub komputerowe?

Pobierz je ze strony [Instalacja Lolly](/info/install.html). Strona wymienia wszystkie wersje dla macOS, Windows, Linux i Android oraz pokazuje, jak sprawdzić pobrany plik. Na iPhone i iPad pobierzesz **Lolly Tools** z App Store. [Sekcja o iPhone i iPad](/info/install.html#iphone-and-ipad) zawiera link.

Każdy może też zbudować i rozpowszechniać własną kopię aplikacji z narzędziami i ustawieniami potrzebnymi jej odbiorcom. [Przewodnik budowania](/info/build-guide.html) pokazuje, jak to zrobić.

## Lolly mówi, że wymaga WebGPU. Co mogę zrobić?

Aplikacja webowa rysuje za pomocą WebGPU, funkcji graficznej współczesnych przeglądarek, i sprawdza dostępność WebGPU przed otwarciem narzędzia. Wypróbuj kolejno:

1. Zaktualizuj przeglądarkę do bieżącej wersji.
2. Włącz przyspieszenie graficzne lub sprzętowe w ustawieniach przeglądarki, a potem uruchom ją ponownie.
3. Wypróbuj przetestowaną przeglądarkę: [Obsługiwane środowiska](/info/supported-environments.html) wymieniają je.
4. Na Mac, iPhone lub iPad zamiast tego [zainstaluj aplikację](/info/install.html).

## Czy Lolly może edytować i renderować moje pliki Figma, Penpot, Illustrator lub InDesign?

Tak. Otwórz narzędzie **Design** i kliknij **Import a design**: przyjmuje natywny plik Figma **.fig** (Save local copy), eksport Penpot **.penpot**, plik Illustrator **.ai** lub **.pdf**, plik InDesign **.idml** lub **.indd**, dokument Affinity, plik Photoshop **.psd**, plik PowerPoint **.pptx**, plik CAD **.dxf** lub **dowolny SVG** ([wszystkie odczytywane formaty](/info/design-import.html#what-comes-in-from-each-app)). Nie potrzebujesz konta, wtyczki ani licencji na aplikację projektową.

![Otwarta kanwa Lolly Design - Import a design znajduje się w menu Lolly na pasku narzędzi](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

Warstwy trafiają do aplikacji jako edytowalne boksy. Tekst nadal można zmieniać, kształty pozostają kształtami, a obrazy trafiają do biblioteki. Po zapisaniu układu **Share with rules** może zamienić go w narzędzie, które każda osoba z Lolly może ponownie wypełnić. Zobacz [Import projektu](/info/design-import.html).

## Czy dwie osoby mogą pracować nad tym samym projektem bez internetu?

Tak. Jedna osoba udostępnia zaproszenie (link, kod QR lub krótki kod), a druga je przyjmuje. Oba urządzenia mają wtedy tę samą sesję na żywo, ze wskaźnikami obecności i obwódkami fokusu. Działa to w każdej wspólnej sieci, także przez hotspot telefonu, ponieważ nie ma serwera pośredniczącego. Zobacz [Wspólna praca](/info/collaborate.html). Dla współpracowników w różnych sieciach instancja Lolly Work organizacji udostępnia uwierzytelnione sesje współpracy.

## Czym są flagi funkcji?

Flagi funkcji włączają lub wyłączają części Lolly. Przy samodzielnym korzystaniu wybierasz własne ustawienia. Organizacja używająca Lolly Work może ustalić wartości domyślne lub ukryć wybrane przełączniki zgodnie ze swoją polityką, a zarządzane kontrolki są oznaczone. Zobacz [Korzystanie z Lolly w organizacji](/info/organisation.html).

![Osobiste flagi funkcji w samodzielnej aplikacji; polityka organizacji może zarządzać wybranymi przełącznikami](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Czym utility różnią się od narzędzi?

Utility wykonuje jedno szybkie zadanie na pliku, który już masz, takie jak kompresja PDF, konwersja zdjęcia lub usuwanie ukrytych danych. Wiele z nich działa na Twoim urządzeniu bez przesyłania czegokolwiek. Utility pozwalają wykonywać w Lolly zadania, które ludzie zwykle powierzają przypadkowej witrynie. Kompresja umowy, konwersja zdjęć z wakacji z nadal zapisanymi danymi lokalizacji lub wklejenie tokenu do formatera online nie powinny oznaczać oddawania pliku witrynie o nieznanych zasadach przechowywania, jurysdykcji i modelu biznesowym. [Lolly Utilities](/info/utilities.html) wymienia je, a [Wymiana, na którą nigdy się nie zgodziliśmy](/info/status-quo.html) opowiada historię ich powstania.

![Widok Utilities: Lolly Strip Hidden Data, Compress PDF, Convert Image i inne zadania wykonywane na urządzeniu, wszystko w jednym miejscu](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Czy nasza organizacja może używać SSO, wspólnych projektów i zatwierdzeń?

Tak, z **Lolly Work**, serwerem organizacji w ramach tego samego projektu open source. Działa oddzielnie i dodaje jednokrotne logowanie przez Twojego dostawcę tożsamości, aprowizację SCIM, uprawnienia grupowe, wspólne projekty i zasoby, sesje współpracy na żywo, zatwierdzenia i zapisy audytu. Codzienna aplikacja nadal działa samodzielnie.

[Korzystanie z Lolly w organizacji](/info/organisation.html) opisuje logowanie i znajdowanie wspólnej pracy. [Wdrożenie](/info/deployment.html#organisation-services-with-lolly-work) opisuje konfigurację Lolly Work. Udostępniane treści i zapisy organizacji podlegają zasadom prywatności i przechowywania danych danej instancji.

## Jakich trudności mogę się spodziewać przy wdrażaniu Lolly?

Głównie zmiany sposobu pracy zespołu, nie technologii. Zespół, który chce mieć nadzorowany zestaw narzędzi, potrzebuje kogoś, kto stworzy jego system projektowy i pierwsze szablony. Każdy nadal może tworzyć własne narzędzia w Lolly Design już pierwszego dnia, bez potrzeby używania git. Istniejące procesy nadal działają, nawet gdy ich wyniki są niezgodne z marką. Dobre przekształcenie jednego widocznego rezultatu, z wersjami przed i po obok siebie, przekonuje szybciej niż plan.

[Wdrożenie & nadzór](/info/adoption-governance.html) opisuje wdrażanie użytkowników według ról, ocenę pilotażu i możliwy przebieg procesu nadzoru.

## Czy Lolly powstało przez „vibe coding”?

Lolly powstało z pomocą AI przy pisaniu kodu, poszukiwaniu rozwiązań i w wielu miejscach tworzeniu treści, z użyciem różnych modeli i dostawców, w tym firm rozwijających czołowe modele w chmurze publicznej. Człowiek stworzył architekturę, świadomie dobierał kod i kierował stroną artystyczną aplikacji.

Ostrzeżenie o podatności o wysokiej lub krytycznej wadze w zależnościach Lolly blokuje CI. Ostrzeżenie, którego przyczyny nie można jeszcze naprawić, jest pomijane tylko jako zatwierdzony wyjątek z pisemnym uzasadnieniem. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) wymienia wszystkie aktualne wyjątki, a [informacje o wydaniach](https://github.com/lolly-tools/lolly/releases) podają te, które obejmuje każde wydanie. SECURITY.md opisuje też, jak zgłosić podatność.

Kontrole podczas budowania odrzucają też sformułowania w komentarzach kodu, aplikacji i tej dokumentacji, które brzmią jak wygenerowane maszynowo, aby tekst był prosty dla każdego czytelnika. Efektem ubocznym jest to, że detektorowi może być trudniej rozpoznać, który tekst napisał model. Nie było to naszym celem.

Przede wszystkim Lolly korzysta z dorobku dziesięcioleci pracy nad open source ekspertów z całego świata.

**Informacja o wykorzystaniu generatywnej AI:**

- **Kod napisany przez LLM:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (ta lista może się rozszerzać)
- **Poszukiwanie rozwiązań z LLM:** Gemini 3.1, Fable, Codex Astra
- **Dokumentacja:** Sonnet 5
- **Biblioteki open source:** Ich autorzy, wskazani w SBOM, komentarzach i nagłówkach plików

Ta lista nie obejmuje modeli dołączonych do Lolly.

**Wkład ludzi:**
- **Pomysły, recenzje i opinie:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, społeczność Penpot, Tim Hildred (lista nie jest wyczerpująca)
- **Architektura, kierownictwo artystyczne & sprzątanie po AI:** Andy Fitzsimon

## Gdzie podziały się narzędzia z marką SUSE?

Znajdują się w osobnym, prywatnym repozytorium. Klon publicznego repozytorium nie pobiera pakietu marki SUSE, więc zbudowana z niego aplikacja używa neutralnego profilu `lolly-start`, chyba że wybierzesz inny. Ten profil zawiera narzędzia społeczności niezależne od marki i pustą markę, którą uzupełniasz własną. [lolly.tools](https://lolly.tools) jest budowane z profilem `lolly-demo` i otwiera się w [Lolly Demo](/info/lolly-demo.html), własnym systemie projektowym Lolly. SUSE prowadzi własną instancję, aby chronić swoje znaki towarowe.

## Jaki smak ma logo Lolly?

Jedni mówią, że limonkowy, inni, że miętowy, a czasem jabłkowy. Lolly daje słodycz, a Ty nadajesz smak.

## Co Lolly rozumie przez suwerenność treści?

Kontrolę nad tym, jak Twoje treści są tworzone, nadzorowane, przechowywane i przenoszone między wybranymi systemami. Lolly umożliwia lokalne tworzenie, edytowalną pracę i przenośne narzędzia. Lolly Work dodaje usługi współdzielone kontrolowane przez organizację. Nadal mają znaczenie licencje źródeł, dostępne zależności i przepływy danych w procesie pracy. [Czym jest suwerenność treści?](/info/content-sovereignty.html) wyjaśnia poszczególne mechanizmy kontroli i ich ograniczenia.

## Czy możemy zachować obecny DAM?

Tak. Obsługiwany DAM może pozostać źródłem referencyjnym, a Lolly Work połączy wybrane zasoby z narzędziami Lolly. Dostęp do źródeł, dozwolone zmiany, prawa do użycia i zatwierdzanie gotowego wyniku to osobne decyzje. [Używanie Lolly z obecnym DAM](/info/use-with-dam.html) wyjaśnia ten układ, a [doświadczenia SUSE z Brandfolder](/info/suse-brandfolder.html) opisują udane użycie podczas wdrożenia.
