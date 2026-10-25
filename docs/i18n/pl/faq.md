# Pytania i odpowiedzi

Często zadawane pytania, renderowane jako akordeon na `/info/start/faq.html`.

**Jak to utrzymywać:** każdy nagłówek `##` poniżej to pytanie; wszystko pod nim
(aż do następnego `##`) jest odpowiedzią. Odpowiedzi korzystają z tego samego lekkiego markdownu co
reszta strony - akapity rozdzielaj pustą linią. Dodawaj, usuwaj lub
zmieniaj kolejność pytań tutaj, a potem uruchom ponownie `pnpm run build:info` (albo `pnpm run dev:web`).
Wszystko powyżej pierwszego `##` (ten tytuł i te notatki) jest pomijane przez build.

Kolejność jest kolejnością nowicjusza: najpierw haczyk, potem Twoje pliki, potem
zdobycie i uruchomienie Lolly, potem organizacje, a na końcu jak to powstało. Kotwica
każdego pytania jest budowana z angielskiego pytania na tej samej pozycji, więc
tłumaczenie zachowuje angielską kolejność.

## Dlaczego to jest darmowe? Gdzie haczyk?

**Zbudowaliśmy Lolly dla siebie.** SUSE potrzebowało tysięcy plików zgodnych z marką, tworzonych bez oddawania czegokolwiek zewnętrznym usługom. Zbudowaliśmy więc narzędzie, które robi to wszystko na urządzeniu, i wydaliśmy je jako open source, jak wszystko inne, co tworzymy. Dalej je utrzymujemy, bo używamy go codziennie. **Nie ma żadnego zobowiązania:** wszystko tu działa z nami lub bez nas.

Ta granica jest wyznaczona w licencji, a nie w obietnicy: wszystko, co działa lokalnie, jest darmowe, na zawsze. Wydana wersja jest licencjonowana tak, że nie można jej cofnąć, i nie ma umowy współtwórców, która mogłaby zmienić licencję czyjejś pracy.

## Ile SUSE zatrzymuje dla siebie? (czyli kiedy wyciągną nam dywan spod nóg)

Silnik, powłoki, schematy i narzędzia niezależne od marki są open source. Znaki towarowe SUSE i narzędzia z marką to część, która pozostaje prywatna, i jest już wydzielona. Publiczna instancja pod [lolly.tools](https://lolly.tools) uruchamia [Lolly Demo](/info/lolly-demo.html), własny system projektowy Lolly.

Nic tu nie opiera się na obietnicy: każda wydana wersja pozostaje open source, a jedyną zatrzymaną rzeczą jest znak towarowy. Gdy w 2023 roku inna firma zamknęła źródła korporacyjnego Linuksa, SUSE współzałożyło [OpenELA](https://openela.org), aby ten kod pozostał otwarty, i ten sam sposób postępowania dziedziczy ten projekt.

Pełna jawność: SUSE *buduje* wewnętrzne narzędzia łączące Lolly z własnymi systemami IT. To wewnętrzna konfiguracja SUSE, a nie podział na rozwój publiczny i prywatny. Lolly dąży też do budowania przez [Open Build Service](https://openbuildservice.org/), z bezpiecznymi artefaktami łańcucha dostaw dostarczanymi przez [SUSE Application Collection](https://apps.rancher.io/applications).

## Skąd nazwa "Lolly Tools"?

**Lolly** dlatego, że wolność jest słodka, i dlatego, że w Australii, Nowej Zelandii i Wielkiej Brytanii "lolly" to cukierek.

**Tools** dlatego, że narzędzie leży bez ruchu, dopóki go nie weźmiesz do ręki. Nie działa, kiedy z niego nie korzystasz, i nie obserwuje cię, kiedy korzystasz.

## Dlaczego wszystko jest zielone?

lolly.tools otwiera się w [Lolly Demo](/info/lolly-demo.html), własnym przykładowym systemie projektowym Lolly, a jego kolorem wiodącym jest zielony. To próbka, a nie reguła. Przełącz na **Lolly Starter**, pusty system projektowy, albo na własny w [Settings → Design systems](/#/settings?focus=design-systems-section).

## Czy mogę użyć własnej marki?

Tak. **Design System Setup** (`#/start`) buduje system projektowy z jednego koloru, pliku tokenów projektowych lub gotowego projektu, a każde narzędzie rysuje potem Twoim systemem projektowym. [Start](/info/quickstart.html#put-your-brand-in) prowadzi przez trzy drogi.

System projektowy dostarczony przez Twoją organizację lub kompilację jest zarządzany: pokazuje kłódkę i pozostaje tylko do odczytu, a aby go zmienić, możesz zrobić edytowalną kopię.

## Gdzie jest to, co zrobiłem wczoraj?

Jeśli nacisnąłeś **Save as** lub **Save**, jest w **Projects**, na ekranie głównym, w przeglądarce lub aplikacji, z której zapisałeś. Jeśli nacisnąłeś tylko **Download**, plik jest tam, gdzie przeglądarka lub system zapisuje pobrania, a zwykle kopia jest w **Assets**. Narzędzia, które [zapisują w trakcie pracy](/info/find-your-work.html#which-tools-save-as-you-work), także trzymają niezapisaną pracę w **Projects**. [Find and recover your work](/info/find-your-work.html) omawia każdy przypadek.

## Zamknąłem kartę. Czy moja praca przepadła?

Zapisana praca nadal jest w **Projektach**. Niezapisana praca przepada, z wyjątkiem narzędzi, które zapisują w trakcie pracy - one też trzymają ją w **Projektach**. Następnym razem naciśnij **Zapisz jako**, zanim wyjdziesz. Zobacz [Jeśli zamknąłeś kartę albo opuściłeś narzędzie](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## Czy mogę udostępnić swoją pracę jako plik zamiast linku?

Tak. Gdy link nie może nieść wszystkiego, na przykład Twoich własnych zdjęć lub długiego tekstu, okno Share mówi, czego by zabrakło, i oferuje zamiast tego plik **.lolly**: jeden plik zawierający projekt, używane obrazy i, jeśli zechcesz, samo narzędzie.

To Ty decydujesz, ile podróżuje. Twoje imię i dane trafiają do pliku tylko wtedy, gdy profil na to pozwala, a licencjonowana grafika jest wstrzymywana, chyba że zdecydujesz się ją dołączyć. Ten, kto otwiera plik niosący narzędzie, jest pytany, czy mu ufa, zanim narzędzie może się uruchomić. Zobacz [Sharing your work](/info/using.html#sharing-your-work).

## Do czego służą dane w moim profilu?

Twoje dane w **Settings** wypełniają wstępnie narzędzia, które o nie proszą, takie jak imię na identyfikatorze. Zostają na tym urządzeniu. Jeśli włączysz też zgodę opcjonalną, wybrane dane są zapieczętowane w tym, co tworzysz, wskazując Cię jako źródło. Nic nie jest dołączane, chyba że zdecydujesz się dołączyć swoje dane.

Udostępnianie i Sync wysyłają tylko wybraną przez Ciebie treść. W instancji Lolly Work organizacji wspólne sesje i nadzorowana praca trafiają też na ten serwer. Zobacz [Privacy](/info/privacy.html).

## Jak zdobyć aplikację mobilną albo desktopową?

Pobierz je z [Install Lolly](/info/install.html). Strona wymienia każdą kompilację dla macOS, Windows, Linuksa i Androida i pokazuje, jak sprawdzić pobrany plik. iPhone i iPad dostają **Lolly Tools** z App Store; [sekcja o iPhonie i iPadzie](/info/install.html#iphone-and-ipad) ma link.

Każdy może też zbudować i rozdawać własną kopię aplikacji, z narzędziami i ustawieniami potrzebnymi jego odbiorcom. [Build Guide](/info/build-guide.html) pokazuje jak.

## Lolly mówi, że wymaga WebGPU. Co mogę zrobić?

Aplikacja internetowa rysuje przez WebGPU, funkcję graficzną współczesnych przeglądarek, i sprawdza ją, zanim otworzy narzędzie. Spróbuj tego po kolei:

1. Zaktualizuj przeglądarkę do bieżącej wersji.
2. Włącz akcelerację graficzną lub sprzętową w ustawieniach przeglądarki, a potem uruchom ją ponownie.
3. Spróbuj przeglądarki, która została przetestowana: [Supported environments](/info/supported-environments.html) je wymienia.
4. Na Macu, iPhonie lub iPadzie [zainstaluj aplikację](/info/install.html).

## Czy Lolly potrafi edytować i renderować moje pliki z Figmy, Penpota, Illustratora albo InDesigna?

Tak. Otwórz **Design** i kliknij **Import a design**: przyjmuje natywny plik Figma **.fig** (Save local copy), eksport Penpot **.penpot**, plik Illustratora **.ai** lub **.pdf**, plik InDesign **.idml** (File → Export → InDesign Markup) lub **dowolny SVG**. Nie potrzebujesz konta, wtyczki ani licencji na aplikację projektową.

![Otwarte płótno Design - Importowanie projektu znajduje się w menu Lolly na pasku narzędzi](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

Warstwy przychodzą jako edytowalne boksy: tekst da się dalej edytować, kształty pozostają kształtami, a obrazy dołączają do Twojej biblioteki. Zapisz, a **Share with rules** może zamienić układ w narzędzie, które każdy z Lolly może ponownie wypełnić. Zobacz [Import a design](/info/design-import.html).

## Czy dwie osoby mogą pracować nad tym samym projektem bez internetu?

Tak. Jedna osoba udostępnia zaproszenie, jako link, kod QR lub krótki kod, a druga je przyjmuje. Oba urządzenia trzymają wtedy tę samą sesję na żywo, wraz z obecnością i pierścieniami fokusu. Działa w każdej wspólnej sieci, także na hotspocie telefonu w piwnicy, ponieważ pośrodku nie ma serwera. Zobacz [Working together](/info/collaborate.html). Dla współpracowników w różnych sieciach instancja Lolly Work organizacji zapewnia uwierzytelniane collaby robocze.

## Czym są flagi funkcji?

Flagi funkcji włączają lub wyłączają części Lolly. W użyciu samodzielnym wybierasz swoje osobiste ustawienia. Organizacja używająca Lolly Work może ustawić wartości domyślne lub ukryć wybrane przełączniki według swojej polityki, a zarządzane kontrolki są oznaczone. Zobacz [Use Lolly at your organisation](/info/organisation.html).

![Osobiste flagi funkcji w aplikacji samodzielnej; polityka organizacji może rządzić wybranymi przełącznikami](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Czym narzędzia użytkowe różnią się od narzędzi?

Utility wykonuje jedno szybkie zadanie na pliku, który już masz, taki jak kompresja PDF, konwersja zdjęcia lub usunięcie ukrytych danych, a wiele z nich działa na Twoim urządzeniu bez wysyłania czegokolwiek. Istnieją po to, aby zadania, które ludzie zwykle oddają przypadkowej stronie internetowej, zostawały w Lolly. Kompresja umowy, konwersja zdjęć z wakacji z wciąż zapisaną lokalizacją czy wklejenie tokenu do internetowego formatera nie powinny oznaczać oddania pliku witrynie o nieznanej retencji, jurysdykcji i modelu biznesowym. [Utilities](/info/utilities.html) je wymienia, a [The trade we never agreed to](/info/status-quo.html) opowiada historię za nimi.

![Widok Utilities: Strip Hidden Data, Compress PDF, Convert Image i pozostałe zadania na urządzeniu, wszystko w jednym miejscu](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Czy nasza organizacja może używać SSO, wspólnych projektów i zatwierdzeń?

Tak, z **Lolly Work**, serwerem organizacji tego samego projektu open source. Działa osobno i dodaje jednokrotne logowanie przez Twojego dostawcę tożsamości, provisioning SCIM, uprawnienia grupowe, wspólne projekty i zasoby, collaby robocze na żywo, zatwierdzenia i zapisy audytu. Codzienna aplikacja nadal działa samodzielnie.

[Use Lolly at your organisation](/info/organisation.html) opisuje logowanie i znajdowanie wspólnej pracy, a [Deployment](/info/deployment.html#organisation-services-with-lolly-work) opisuje konfigurację. Wspólne treści i zapisy organizacji podlegają polityce prywatności i retencji tej instancji.

## Jakich przeszkód mogę się spodziewać przy wdrażaniu Lolly?

Zmienia się głównie strona producentów, a nie technologia. Zespół, który chce nadzorowanego zestawu narzędzi, potrzebuje kogoś, kto stworzy jego system projektowy i pierwsze szablony, choć każdy może zacząć tworzyć własne narzędzia w Design od pierwszego dnia, bez git. A istniejące procesy nadal działają, nawet gdy ich wynik jest niezgodny z marką, więc dobre przekształcenie jednego widocznego wyniku, przed i po obok siebie, przekonuje szybciej niż plan.

[Adoption & Governance](/info/adoption-governance.html) opisuje wdrożenie według ról, jak mierzyć pilotaż i jak może wyglądać proces nadzoru.

## Czy Lolly została "vibe codowana"?

Lolly zostało stworzone z pomocą kodowania wspieranego przez AI, odkrywania wspieranego przez AI i, w wielu miejscach, treści wspieranych przez AI, z użyciem mieszanki modeli i dostawców, w tym od firm frontier z chmur publicznych. Człowiek stworzył architekturę, świadomie dobierał kod i nadzorował artystycznie doświadczenie.

Wysoka lub krytyczna uwaga bezpieczeństwa w zależnościach Lolly blokuje CI. Uwaga, której jeszcze nie da się naprawić, jest wstrzymywana tylko jako zatwierdzony wyjątek z pisemnym uzasadnieniem. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) wymienia każdy wyjątek utrzymywany dziś, a [release notes](https://github.com/lolly-tools/lolly/releases) wymieniają te, które niesie każde wydanie. SECURITY.md podaje też, jak zgłosić podatność.

Kontrole w kompilacji odrzucają też sformułowania brzmiące jak maszynowe w komentarzach kodu, aplikacji i tych dokumentach, aby tekst był prosty dla każdego czytelnika. Skutkiem ubocznym jest to, że detektorowi może być trudniej rozpoznać, który tekst napisał model. Nie mieliśmy zamiaru tego powodować.

Co najważniejsze, Lolly stoi na ramionach dziesięcioleci pracy nad open source wykonanej przez ekspertów na całym świecie.

**Ujawnienie użycia generatywnej AI:**

- **Kod pisany przez LLM:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (ta lista może się rozszerzać)
- **Odkrywanie przez LLM:** Gemini 3.1, Fable, Codex Astra
- **Dokumentacja:** Sonnet 5
- **Biblioteki open source:** Ich autorzy, wyrażeni w SBOM, komentarzach i nagłówkach plików

Ta lista nie obejmuje modeli dołączonych (vendored) do Lolly.

**Deklaracje ludzi:**
- **Pomysły, przegląd i opinie:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, Penpot Community, Tim Hildred (lista niepełna)
- **Architektura, kierownictwo artystyczne i sprzątacz slopu:** Andy Fitzsimon

## Gdzie podziały się narzędzia z marką SUSE?

Żyją w osobnym, prywatnym repozytorium. Publiczny klon w ogóle nie pobiera paczki marki SUSE, więc zbudowanie z niego używa neutralnego profilu `lolly-start`, chyba że wybierzesz inny: niezależne od marki narzędzia społeczności plus pusta marka, którą wypełniasz własną. [lolly.tools](https://lolly.tools) jest budowane z profilem `lolly-demo` i otwiera się w [Lolly Demo](/info/lolly-demo.html), własnym systemie projektowym Lolly. SUSE prowadzi własną instancję, aby chronić swoje znaki towarowe.

## Jaki smak ma to logo Lolly?

Jedni mówią, że limonka, inni że mięta, a czasem że jabłko - Lolly wnosi słodycz, a smak tworzysz ty!
