# Settings

Settings to miejsce, w którym zmieniasz sposób działania Lolly dla siebie: swoje dane, używany system projektowy, dostępność, to, co jest przechowywane na tym urządzeniu, i to, co jest gotowe offline. Otwórz je przez **Settings** na pasku na dole ekranu głównego albo z menu awatara. Otwiera się na **Preferences**, a obok jest jeszcze cztery karty.

| Karta | Adres | Co zawiera |
|---|---|---|
| **Preferences** | `#/settings` | Twoje dane, systemy projektowe, wygląd, emoji, dostępność, połączenia, pamięć i pobrania offline |
| **This device** | `#/settings?tab=device` | Odczyt na żywo tej przeglądarki i maszyny, plus dźwięk i widok pamięci tylko do odczytu |
| **Design system** | `#/settings?tab=brand` | Aktywny system projektowy jako okładka i strony, z paskiem okładek do przełączania systemów |
| **Capabilities** | `#/settings?tab=caps` | Wszystko, co potrafi Lolly, jako karty z wyszukiwaniem |
| **Activity & stats** | `#/settings?tab=activity` | Katalog, Twoje lokalne liczniki i ostatnia praca |

Każda karta ma własny adres, a stare linki `#/profile` i `#/d` nadal otwierają właściwe miejsce, aż do poszczególnych ustawień.

## Preferences

Preferences to jedna długa strona z **szyną ustawień** z boku i polem **Search settings** nad szyną, które filtruje ją w trakcie pisania. Każda sekcja otwiera się bezpośrednio z linku w postaci `#/settings?focus=<section-id>`, na przykład `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - Twoje imię i nazwisko, dane kontaktowe i zdjęcie oraz przełącznik **Use my details to create**. [Profiles](/info/profile.html) wyjaśnia, jak narzędzia z nich korzystają.
- <!--i:seal--> **Content Credentials** - opcjonalna zweryfikowana tożsamość podpisująca Twoje eksporty. Zobacz [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - przełączaj, dodawaj, ukrywaj lub usuwaj systemy projektowe. [Design System Setup](/info/brand-studio.html#manage-your-design-systems) omawia każdą akcję.
- <!--i:moon--> **Appearance** - motyw (Light, Dark lub Brand, który maluje aplikację w Twojej palecie) i **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - zestaw, z którego rysowane są Twoje emoji, gdy zaczynasz coś nowego, z jego licencją grafiki, oraz to, jak mocno Twoja paleta je przekolorowuje (**Off**, **Subtle**, **Strong**, **Full**, **Mono** lub **Duotone**). **Keep skin tones and flags** zostawia je w ich własnych kolorach. Praca, którą już zrobiłeś, zachowuje zestaw, w którym powstała.
- <!--i:eyeoff--> **Accessibility** - cztery przełączniki komfortu, plus Sound i Neurospicy Mode. Zobacz [Accessibility](#accessibility).
- <!--i:link--> **Connected services** - magazyn, który łączysz, taki jak Dropbox, Google Drive, OneDrive, Nextcloud lub S3, oraz **Sync across devices**. Zobacz [Sync your devices](/info/sync.html).
- <!--i:globe--> **Trusted sites** - witryny, z którymi box strony internetowej Design lub demo Sandbox może się łączyć bez pytania, oraz, gdy serwer to oferuje, **Allow pages from any site**. [Privacy Policy](/info/privacy.html) wymienia, co wysyła każde żądanie.
- <!--i:download--> **Your renders** - **Save my renders to my library** zachowuje w Assets kopię każdego pobranego obrazu, klipu audio i wideo, pod tagiem Renders.
- <!--i:database--> **Storage** - co Lolly przechowuje na tym urządzeniu oraz przyciski, które czyszczą lub przenoszą Twoje dane. Zobacz [Storage](#storage).
- <!--i:cpu--> **Available offline** - pobierz to, czego potrzebujesz, zanim stracisz połączenie. Zobacz [Available offline](#available-offline).
- <!--i:folder--> **Hot folder** - w aplikacji komputerowej obserwuj jeden folder i wciągaj do Lolly wszystko, co do niego wrzucisz, przez ten sam selektor, który dostaje przeciągnięcie.
- <!--i:clock--> **Your activity** - co zrobiłeś na tym urządzeniu, liczone lokalnie.
- <!--i:sliders--> **Feature flags** - włączaj lub wyłączaj części aplikacji, takie jak **Print preflight** lub **Strip metadata from uploads**.
- <!--i:server--> **Lolly instance** - skąd ta instalacja bierze narzędzia i katalog. Zobacz [Lolly instance](#lolly-instance).

Karty motywów to podglądy na żywo i stosują się w chwili wyboru, tylko na tym urządzeniu.

![Trzy karty motywów, każda z podglądem własnej typografii i koloru, z oznaczoną aktywną](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Accessibility

**Settings → Preferences → Accessibility** zawiera cztery ustawienia komfortu dla aplikacji wokół Twojej pracy. Każde jest wyłączone, dopóki go nie włączysz, i żadne nie sięga wnętrza kanwy narzędzia ani eksportu, więc spokojniejsza aplikacja nigdy nie rusza piksela pliku, który wysyłasz.

- <!--i:pause--> **Reduce motion** wyłącza przejścia, przesunięcia i ozdobniki aplikacji. Twoja kanwa i każdy animowany eksport poruszają się dalej tak, jak zaprojektowano.
- <!--i:photos--> **Hide colourful previews** zastępuje grafiki podglądu galerii spokojnymi kartami z ikoną i tekstem oraz wycisza miniatury projektów, aby pozostały rozpoznawalne bez krzyku.
- <!--i:sliders--> **High contrast** wzmacnia obramowania, tekst i pierścienie fokusu aplikacji. Kolory Twojej marki i kanwa pozostają takie, jak ustawiłeś.
- <!--i:font--> **Large text** powiększa etykiety, menu i tekst przycisków aplikacji. Typografia wewnątrz Twoich projektów pozostaje nietknięta, więc nic, co eksportujesz, nie zmienia układu.

Te ustawienia żyją w Twoim profilu, więc podróżują w eksporcie profilu i docierają na następną instalację razem z imieniem i nazwiskiem oraz sesjami. Mała kopia tylko dla urządzenia stosuje je przed pierwszym rysowaniem.

Ta sama karta zawiera **Sound**, delikatną warstwę dźwięków pomocniczych dla tego, co robisz (wejście do galerii, wynik Content Credentials, zamknięcie panelu), oraz **Neurospicy Mode**, spokojną ścieżkę skupienia. Włączenie Neurospicy otwiera mały odtwarzacz w rogu, który podąża za Tobą po aplikacji. Tam wybierasz utwór, pomijasz, ustawiasz głośność i minimalizujesz lub zamykasz odtwarzacz. Utwory to proceduralne melodie *Lolly Sings*, pętle ambientowe i bity, Twoje własne audio i internetowe stacje radiowe, które wymagają połączenia. Oba są domyślnie wyłączone i zapamiętywane, a wyłączenie Sound wycisza też ścieżkę skupienia. Menu profilu i **This device** mają ten sam przełącznik.

Interfejs jest dostępny z klawiatury, niestandardowe kontrolki mają etykiety dla czytników ekranu, a podgląd na żywo każdego narzędzia jest udostępniany jako jeden opisany obraz mówiący, co pokazuje.

### Storage

Miernik pamięci rozlicza każdy bajt, który ta instalacja przechowuje, kategoria po kategorii, względem tego, co zgłasza przeglądarka.

![Miernik pamięci, rozbijający zapisane sesje, obrazy i pamięć podręczną względem tego, co faktycznie zgłasza przeglądarka](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Pod miernikiem:

- **Move to another device** ma **Export my data**, **Import data…** i **Export my data & render everything**. [Move your work to another device](/info/find-your-work.html#move-your-work-to-another-device) prowadzi przez nie.
- **Clear cache** usuwa pobrane pliki katalogu, które pobiorą się ponownie, gdy będą potrzebne.
- **Remove automatic checkpoints older than 30 days** zwalnia miejsce w History i zachowuje zapisane oraz nazwane wersje.
- **Clear all my data** usuwa wszystko, co Lolly przechowuje w tej przeglądarce, po wpisaniu słowa potwierdzenia. [If you clear your browser data](/info/find-your-work.html#if-you-clear-your-browser-data) wymienia, co znika.

### Available offline

Lolly zapamiętuje ekrany, które odwiedzasz, co obejmuje tylko miejsca, w których już byłeś. **Available offline** jest na podróż, którą widzisz na horyzoncie: pobierz części, których będziesz potrzebować, i obserwuj jeden pasek postępu, a wszystko, co wziąłeś, działa dalej bez połączenia.

- <!--i:monitor--> **App, catalogue and guides** - **The app** (każdy widok, edytor i czcionka, w tym ekrany, których nigdy nie otworzyłeś), **Catalogue** (cały albo **Choose by tag**) i **Guides & docs** (ta dokumentacja w Twoim języku, ze zrzutami ekranu).
- <!--i:cpu--> **AI models** - każdy model na urządzeniu w osobnym wierszu z rozmiarem: Speech voices, Upscaling models, Background removal, Text recognition, Verify deep scan, Durable credential, Rewriter model, Ask matching model, AI text detector i Singing voices. Model powyżej 50 MB jest oznaczony **large download**.
- <!--i:wrench--> **Tools** - każde narzędzie pobiera się osobno albo **Download all** bierze wszystkie narzędzia. Ptaszek oznacza gotowość offline.

**Download everything** na górze bierze aplikację, wybrany zakres katalogu, przewodniki i wszystkie narzędzia. Zaznacz **Include all the AI models**, aby dodać modele, lub pobierz model z jego własnego wiersza; głosy śpiewu są pobierane wyłącznie z własnego wiersza. Polityka organizacji może wyłączyć pobieranie AI, a wiersze wtedy to mówią.

Pobieranie wznawia się tam, gdzie się zatrzymało, jeśli anulujesz lub stracisz połączenie, i odświeża się samo, gdy znów jesteś online, pobierając tylko to, co zmieniło wydanie. Jeśli przeglądarka nie przyznała trwałej pamięci, **Protect downloads** o nią prosi: to różnica między "pobrane" a "pobrane, dopóki przeglądarka nie zechce odzyskać miejsca".

### Lolly instance

**Lolly instance** mówi, skąd ta instalacja bierze narzędzia i katalog: adres instancji albo *Bundled with this app*, gdy wszystko jest dostarczone w kompilacji.

- **Design-system source** pokazuje, skąd pochodzi dostarczony system projektowy.
- **Instance console** otwiera strony administracyjne wdrożenia, gdy je oferuje.
- **Change** kieruje aplikację komputerową na inną instancję. Przeglądarka nie może ładować narzędzi i zasobów między źródłami, więc w sieci sekcja oferuje zamiast tego **Open a workspace**.
- **Leave** usuwa system projektowy, narzędzia i katalog instancji, a Twoja własna praca zostaje. Zobacz [Use Lolly at your organisation](/info/organisation.html#leaving).
- Gdy jesteś zalogowany do organizacji, **Sign out** kończy tę sesję, a **Sign out everywhere** kończy Twoje sesje na każdym urządzeniu, także tym.

## This device

- <!--i:monitor--> **This Machine** - ekran, wejście, grafika, pamięć, kodeki, backend pamięci i więcej, odczytane na żywo z tej sesji. Nic nie jest zapisywane ani wysyłane. Otwiera się samo na szerokim ekranie, gdzie karta układa się w dwie kolumny.
- <!--i:neurobeat--> **Sound** - dźwięki interfejsu i pętle skupienia Neurospicy, jedyny przełącznik na tej karcie, który cokolwiek zapisuje.
- <!--i:database--> **Storage** - widok miernika z [Preferences](#storage) tylko do odczytu, gdzie czyścisz lub przenosisz swoje dane.

## Design system

Aktywny system projektowy, rozłożony do czytania. Gdy ta przeglądarka przechowuje dwa lub więcej systemów projektowych, pasek małych okładek u góry je wymienia: wybierz jeden, aby uczynić go aktywnym, a **Undo** w następującym po tym komunikacie przywraca poprzedni.

![Karta Design system w Lolly Demo: pasek okładek do przełączania systemów, potem okładka z logo, nazwą, notą i licznikami, które otwierają każdą stronę](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

Karta otwiera się na okładce w kolorach samego systemu, z logo, nazwą w kroju wyświetlania i notą napisaną przez autora. Linia liczników na okładce prowadzi do każdej strony:

- <!--i:palette--> **Colour** - powierzchnia, tekst, kolor podstawowy i drugorzędny jasnego i ciemnego wyglądu, każdy nazwany kolor jako znacznik z nazwą i hex, pasmo dla każdej rampy odcieni i spektrum wykresów oraz role kolorów w zwijanej części. Wybierz wartość, aby skopiować hex.
- <!--i:font--> **Type** - Headings, Text, Emphasis i Code, każdy złożony własnym krojem.
- <!--i:photos--> **Logos** - każdy plik logo na tle, dla którego powstał.
- <!--i:layers--> **Colourways** - para jasny i ciemny każdego colourway, gdy system ma więcej niż jeden.
- <!--i:sliders--> **Tokens** - promień, odstępy, efekty i gradienty.
- <!--i:document--> **Print & CMYK** - kolory zablokowane na dokładną farbę oraz warunki druku, które może zadeklarować PDF CMYK.

Przełączanie to jedyna zmiana, jaką ta karta robi. System projektowy edytujesz w [Design System Setup](/info/brand-studio.html) pod `#/start`, do czego prowadzi okładka. System tylko do odczytu mówi o tym na okładce; lokalne systemy, które tworzysz, pozostają edytowalne. `/b` i `/brand` to skróty prosto do tej karty.

## Capabilities

Każda część platformy jest opisana jako karta, w dwunastu grupach: Experiences, Platforms & runtimes, Accessibility & languages, Export formats, Import formats, Print production, Automation & AI, Determinism & reproducibility, Brand & design system, Privacy & data ownership, Security & access control i Architecture (for builders). Każda grupa się zwija i pokazuje liczbę kart. Karta otwiera się w oknie z funkcjami tej możliwości i, w około połowie przypadków, ze zrzutem ekranu używanym w tej dokumentacji.

Pole wyszukiwania nad grupami filtruje karty w trakcie pisania i otwiera te grupy, które nadal mają dopasowanie. Mówi, ile możliwości przeszukuje, a zapytanie bez dopasowania mówi o tym słowami.

Ta karta to pisemna dokumentacja tego, co potrafi Lolly, utrzymywana zgodnie z tymi przewodnikami. Nie bada maszyny, na której jesteś; robi to **This device**.

## Activity & stats

Najpierw kompilacja: ile narzędzi jest wczytanych, ile istnieje formatów eksportu, na ilu powierzchniach działa platforma i ile zasobów marki niesie katalog, z panelem **Catalogue** rozbijającym to, co zawiera ta kompilacja.

Potem Twoja strona: **Your activity** liczy to, co zrobiłeś na tym urządzeniu, a **Recent creations** i **Latest exports** to stosy, które możesz przesuwać, każdy pojawia się, gdy jest co pokazać. Oba otwierają element takim, jaki był. Te liczniki zostają na urządzeniu; opcjonalna instancja Lolly Work prowadzi własne [zapisy telemetrii i audytu organizacji](/info/privacy.html#organisation-services-with-lolly-work).

## Deep links

Każda karta i sekcja Settings ma własny link, który możesz dodać do zakładek lub wkleić. [Search](/info/search.html) kieruje swoje wyniki **Settings** do tego samego rejestru, z którego Settings się renderuje, więc sekcji nie da się przemianować spod wyniku wyszukiwania.

::: details Każda forma linku

- **Karta:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **Sekcja Preferences:** `#/settings?focus=<section-id>`, na przykład `#/settings?focus=offline-section`.
- **Sekcja, dokładnie:** jej identyfikator jako goła flaga, na przykład `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` lub `#/settings?cap-formats`. Starsze linki `#/settings?dash-lock` i `#/settings?dash-palette-wheel` otwierają okładkę i stronę Colour.
- **Sekcja po słowie kluczowym:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (strona Colour) lub `#/settings?tokens`. Słowa kluczowe mogą być wspólne: `print` należy zarówno do odniesienia druku na karcie marki, jak i do grupy Print production, a wygrywa pierwsze w kolejności strony. Użyj identyfikatora, gdy ma znaczenie, które.

Głęboki link przełącza na kartę, do której należy cel, otwiera każdą grupę, w której jest złożony, a potem przewija do niego, uspokajając się na chwilę, gdy sekcje powyżej kończą układanie. Wycofane adresy `#/platform` i `#/capabilities` wchodzą do Settings z zachowanymi flagami głębokich linków.
:::

---

**Zobacz też:** [Profiles](/info/profile.html) o Twoich danych i kontekstach, w których tworzysz. [Design System Setup](/info/brand-studio.html) o edycji tego, co pokazuje karta Design system. [Find and recover your work](/info/find-your-work.html) o pamięci, kopiach zapasowych i przenoszeniu między urządzeniami.
