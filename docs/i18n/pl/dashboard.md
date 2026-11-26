# Ustawienia

Ustawienia zawierają Twoje dane, system projektowy, dostępność, przechowywanie na tym urządzeniu i pobieranie do pracy offline. Otwórz **Settings** z paska na dole ekranu głównego lub z menu awatara, a otworzy się karta **Preferences**.

| Karta | Adres | Zawartość |
|---|---|---|
| **Preferences** | `#/settings` | Twoje dane, systemy projektowe, wygląd, emoji, dostępność, połączenia, przechowywanie i pobieranie do pracy offline |
| **This device** | `#/settings?tab=device` | Bieżące informacje o tej przeglądarce i komputerze oraz dźwięk i widok pamięci tylko do odczytu |
| **Design system** | `#/settings?tab=brand` | Aktywny system projektowy jako okładka i strony, z paskiem okładek do przełączania systemów |
| **Capabilities** | `#/settings?tab=caps` | Wszystko, co potrafi Lolly, jako karty z możliwością wyszukiwania |
| **Activity & stats** | `#/settings?tab=activity` | Katalog, Twoje lokalne liczniki i ostatnie prace |

Stare linki `#/profile` i `#/d` nadal otwierają właściwe miejsce, aż do pojedynczych ustawień.

<!--i:eti-sliders-->
## Preferencje

Preferences to jedna długa strona z **paskiem ustawień** z boku. Pole **Search settings** nad paskiem filtruje go podczas wpisywania. Każda sekcja ma link w postaci `#/settings?focus=<section-id>`, na przykład `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - Twoje imię i nazwisko, dane kontaktowe, zdjęcie portretowe i przełącznik **Use my details to create**. [Profile](/info/profile.html) wyjaśniają, jak narzędzia ich używają.
- <!--i:seal--> **Content Credentials** - opcjonalna zweryfikowana tożsamość, która podpisuje Twoje eksporty. Zobacz [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - przełączaj, dodawaj, ukrywaj lub usuwaj systemy projektowe. [Konfiguracja systemu projektowego Lolly](/info/brand-studio.html#manage-your-design-systems) opisuje każdą czynność.
- <!--i:moon--> **Appearance** - motyw (Light, Dark lub Brand, który nadaje aplikacji kolory Twojej palety), **Your colourway**, gdy system projektowy oferuje więcej niż jeden wariant kolorystyczny ([Dostosuj wariant kolorystyczny](/info/colourways.html#make-a-colourway-your-own)) i **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - zestaw emoji dla nowych prac, z licencją grafiki, i stopień, w jakim Twoja paleta zmienia kolory emoji (**Off**, **Subtle**, **Strong**, **Full**, **Mono** lub **Duotone**). **Keep skin tones and flags** zachowuje ich własne kolory. Wcześniejsze prace zachowują swój zestaw.
- <!--i:eyeoff--> **Accessibility** - cztery przełączniki komfortu oraz Sound i Neurospicy Mode. Zobacz [Dostępność](#accessibility).
- <!--i:link--> **Connected services** - podłączone miejsca przechowywania, takie jak Dropbox, Google Drive, OneDrive, Nextcloud lub S3, i **Sync across devices**. Zobacz [Synchronizowanie urządzeń](/info/sync.html).
- <!--i:globe--> **Trusted sites** - witryny, z którymi boks strony internetowej Lolly Design lub demo Lolly Sandbox może się łączyć bez pytania, oraz **Allow pages from any site**, jeśli serwer to oferuje. [Polityka prywatności](/info/privacy.html) wymienia dane wysyłane przez każde żądanie.
- <!--i:download--> **Your renders** - **Save my renders to my library** zachowuje kopię każdego pobranego obrazu, klipu audio i wideo w Assets, pod znacznikiem Renders.
- <!--i:database--> **Storage** - co Lolly przechowuje na tym urządzeniu oraz przyciski czyszczenia i przenoszenia danych. Zobacz [Przechowywanie](#storage).
- <!--i:cpu--> **Available offline** - pobierz to, czego potrzebujesz, zanim stracisz połączenie. Zobacz [Dostępne offline](#available-offline).
- <!--i:folder--> **Hot folder** - w aplikacji komputerowej Lolly obserwuje jeden folder i importuje wszystko, co do niego trafi, przez ten sam selektor co przy przeciąganiu i upuszczaniu.
- <!--i:clock--> **Your activity** - to, co powstało na tym urządzeniu, zliczane lokalnie.
- <!--i:sliders--> **Feature flags** - włączaj lub wyłączaj części aplikacji, takie jak **Print preflight** lub **Strip metadata from uploads**. **Performance UI** nadaje aplikacji prostszy wygląd, który wymaga mniej zasobów do rysowania. Lolly może samodzielnie włączyć Performance UI na wolnym urządzeniu. Wiersz pod przełącznikiem informuje wtedy, kiedy i dlaczego, z opcją **Allow again** ([jak podejmuje decyzję](/info/configuration.html#curating-what-people-see)).
- <!--i:server--> **Lolly instance** - skąd ta instalacja pobiera narzędzia i katalog. Zobacz [Instancja Lolly](#lolly-instance).

Karty motywów to podglądy na żywo. Motyw jest stosowany od razu po wybraniu, tylko na tym urządzeniu.

![Trzy karty motywów, każda z podglądem własnej typografii i kolorów, z oznaczeniem aktywnego motywu](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Dostępność

**Settings → Preferences → Accessibility** zawiera cztery ustawienia komfortu aplikacji. Każde jest wyłączone, dopóki go nie włączysz, i żadne nie wpływa na kanwę narzędzia ani eksport, więc spokojniejsza aplikacja nigdy nie przesuwa ani piksela w przekazywanym pliku. Każde jest domyślnie wyłączone. Żadne nie zmienia kanwy narzędzia ani eksportu.

- <!--i:pause--> **Reduce motion** wyłącza przejścia, przesunięcia i ozdobne animacje aplikacji.
- <!--i:photos--> **Hide colourful previews** zastępuje grafiki podglądów w galerii kartami z ikoną i tekstem oraz wycisza miniatury projektów, które pozostają rozpoznawalne.
- <!--i:sliders--> **High contrast** wzmacnia obramowania, tekst i obwódki fokusu w aplikacji. Kolory marki i kanwa pozostają zgodne z Twoimi ustawieniami.
- <!--i:font--> **Large text** powiększa etykiety, menu i tekst przycisków aplikacji.

**Dominant hand** (Right lub Left) określa stronę kontrolek, gdy Lolly pokazuje dwa panele na urządzeniu składanym lub tablecie o niemal kwadratowym ekranie. **Swap sides** w nagłówku panelu też to zmienia.

Te ustawienia są zapisane w Twoim profilu, więc są przenoszone w eksporcie profilu razem z imieniem i nazwiskiem oraz sesjami. Kopia przechowywana tylko na urządzeniu stosuje je przed pierwszym rysowaniem interfejsu.

Ta sama karta zawiera **Sound**, łagodne dźwięki pomocnicze dla czynności takich jak przejście do galerii, wynik Content Credentials lub zamknięcie panelu. Zawiera też **Neurospicy Mode**, spokojną ścieżkę do skupienia. Włączenie Neurospicy otwiera mały odtwarzacz w rogu, który towarzyszy Ci w całej aplikacji. W odtwarzaczu wybierasz utwór, przeskakujesz dalej, ustawiasz głośność i minimalizujesz lub zamykasz odtwarzacz. Dostępne są generowane stacje Lolly, ambientowe pętle i bity, własne audio oraz internetowe stacje radiowe, które wymagają połączenia. Obie opcje są domyślnie wyłączone, a ich ustawienia zapamiętywane. Wyłączenie Sound wycisza też ścieżkę do skupienia. Menu profilu i **This device** zawierają ten sam przełącznik.

Suwak pod przełącznikiem Sound określa, z czego składają się dźwięki. W stronę okrągłej plamy **Bouba** stają się łagodnymi kroplami, bąbelkami i odrobiną basu. W stronę kolczastej gwiazdy **Kiki** stają się suchymi tyknięciami, szuraniem i metalicznymi odgłosami. Środek zachowuje dzwonki i nuty Lolly. Jeśli dźwięki przy jednym końcu są dla Ciebie trudne do zniesienia, przesuń suwak w stronę drugiego. Suwak działa przy wyłączonym Sound, a jego puszczenie odtwarza krótką próbkę.

::: details Generowane stacje
Generowane stacje komponują muzykę podczas odtwarzania, bez sampli i nagranych głosów. Każdy utwór ma własne instrumenty, groove i kolejność części.

- **Lolly Sings** to rodzina stacji. Oryginalna Lolly Sings jest pogodna i melodyjna: tonacje durowe, główna melodia w każdym utworze oraz brzmienia bossa, shuffle i chiptune. Każdy gatunek ma też własną stację, od Sugar i K-pop po Country, Jazz, Metal i D&B.
- **Stacje Lofi** (Warm, Late night i Rainy) to niekończące się bity lo-fi.

W generowanej stacji przyciski następnego i poprzedniego utworu przełączają utwory. Każdy utwór powstaje z ziarna, więc brzmi tak samo wszędzie, gdzie go udostępnisz lub zapiszesz (zobacz [Generowana muzyka](/info/generated-music.html)). Pod kontrolkami odtwarzania **Mood** przełącza stacje Lofi, **Drums** usuwa zestaw perkusyjny, a **Texture** przechodzi od czystego brzmienia do zakurzonej płyty. Dalej jest rząd przycisków z ikonami. Najedź na przycisk lub przytrzymaj go, aby zobaczyć nazwę:

- Nuta, **Open in the music generator**, otwiera utwór pod `#/music`, gdzie możesz zmieniać instrumenty w poszczególnych częściach.
- Link, **Share this tune or moment**, oferuje link odtwarzający ten sam utwór lub taki, który dodatkowo zaczyna w bieżącym miejscu i pokazuje wizualizator z Twoim aktualnym presetem i kolorami.
- Folder, **Save to library**, zachowuje utwór w Twoich zasobach.
- Błyskawica, **Light visualiser**, to przełącznik opisany poniżej.

Zapisany utwór znajduje się w grupie swojej stacji, opisany tonacją i tempem. Wybranie zapisanego utworu odtwarza go ponownie, z powtarzaniem jak dowolny utwór lub przejściem dalej w trybie odtwarzania po kolei. Zapis obejmuje tylko stację i numer utworu, kilka bajtów, a muzyka jest komponowana ponownie podczas odtwarzania. Możesz zmienić nazwę zapisanego utworu lub usunąć go w swoich zasobach i użyć go jako podkładu muzycznego do wideo. Lolly Demo i Lolly Start zawierają po sześć zapisanych utworów.

Wizualizator słyszy każdy utwór na stałym poziomie, więc cichy utwór porusza obraz tak samo jak głośny, przy dowolnej głośności. Każdy gatunek Lolly Sings i zapisany utwór z niego oferuje **Light visualiser**: proste słupki poziomu, które pozostawiają muzyce potrzebny czas przetwarzania. Light visualiser jest początkowo włączony na ekranach dotykowych i urządzeniach z najwyżej czterema rdzeniami lub pamięcią 4 GB albo mniejszą.
:::

Interfejs możesz obsługiwać klawiaturą. Niestandardowe kontrolki mają etykiety dla czytników ekranu. Podgląd na żywo każdego narzędzia to jeden obraz z etykietą opisującą jego zawartość.

### Przechowywanie

Wskaźnik zajętości pamięci pokazuje każdy bajt przechowywany przez tę instalację, według kategorii, w odniesieniu do danych zgłaszanych przez przeglądarkę.

![Wskaźnik zajętości pamięci z podziałem na zapisane sesje, obrazy i pamięć podręczną w odniesieniu do faktycznych danych zgłaszanych przez przeglądarkę](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Pod wskaźnikiem:

- **Move to another device** zawiera **Export my data**, **Import data…** i **Export my data & render everything**. [Przenoszenie pracy na inne urządzenie](/info/find-your-work.html#move-your-work-to-another-device) prowadzi przez te opcje.
- **Clear cache** usuwa pobrane pliki katalogu, które zostaną pobrane ponownie w razie potrzeby.
- **Remove automatic checkpoints older than 30 days** zwalnia miejsce w History i zachowuje zapisane oraz nazwane wersje.
- **Clear all my data** usuwa wszystko, co Lolly przechowuje w tej przeglądarce, po wpisaniu słowa potwierdzającego. [Jeśli wyczyścisz dane przeglądarki](/info/find-your-work.html#if-you-clear-your-browser-data) wymienia usuwane dane.

### Dostępne offline

Lolly zapisuje w pamięci podręcznej tylko odwiedzone ekrany. **Available offline** pobiera potrzebne Ci części, z jednym paskiem postępu, a one działają dalej bez połączenia.

- <!--i:monitor--> **App, catalogue and guides** - **The app** (każdy widok, edytor i czcionka, w tym ekrany, których jeszcze nie otwierałeś), **Catalogue** (cały lub **Choose by tag**) i **Guides & docs** (ta dokumentacja w Twoim języku, wraz ze zrzutami ekranu).
- <!--i:cpu--> **AI models** - każdy model działający na urządzeniu w osobnym wierszu z rozmiarem: Speech voices, Upscaling models, Background removal, Text recognition, Lolly Verify deep scan, Durable credential, Rewriter model, Ask matching model, AI text detector i Singing voices. Model powyżej 50 MB ma oznaczenie **large download**.
- <!--i:wrench--> **Tools** - każde narzędzie pobiera się osobno, a **Download all** pobiera wszystkie. Ptaszek oznacza gotowość do pracy offline.

**Download everything** u góry pobiera aplikację, wybrany zakres katalogu, przewodniki i wszystkie narzędzia. Zaznacz **Include all the AI models**, aby dodać modele, lub pobierz model z jego wiersza. Głosy śpiewające można pobrać tylko z ich wiersza. Polityka organizacji może wyłączyć pobieranie modeli AI, a wiersze wtedy o tym informują.

Po anulowaniu lub utracie połączenia pobieranie wznawia się od miejsca, w którym się zatrzymało. Po powrocie do sieci pobrane zasoby są odświeżane i pobierane jest tylko to, co zmieniło się w danym wydaniu. Jeśli przeglądarka nie przyznała trwałej pamięci, **Protect downloads** prosi o to uprawnienie. Bez niego przeglądarka może usunąć pobrane zasoby, gdy zechce odzyskać miejsce.

### Instancja Lolly

**Lolly instance** pokazuje, skąd ta instalacja pobiera narzędzia i katalog: adres instancji lub *Bundled with this app*, gdy wszystko jest dołączone do kompilacji.

- **Design-system source** pokazuje, skąd pochodzi dostarczony system projektowy.
- **Instance console** otwiera strony administracyjne wdrożenia, jeśli są dostępne.
- **Change** kieruje aplikację komputerową do innej instancji. Przeglądarka nie może wczytywać narzędzi i zasobów z innych źródeł, więc w wersji internetowej sekcja oferuje zamiast tego **Open a workspace**.
- **Leave** usuwa system projektowy, narzędzia i katalog instancji. Twoja praca zostaje. Zobacz [Korzystanie z Lolly w organizacji](/info/organisation.html#leaving).
- Gdy jesteś zalogowany w organizacji, **Sign out** kończy tę sesję, a **Sign out everywhere** kończy Twoje sesje na wszystkich urządzeniach, w tym na tym.

<!--i:eti-monitor-->
## To urządzenie

- <!--i:monitor--> **This Machine** - ekran, urządzenia wejściowe, grafika, pamięć, kodeki, mechanizm przechowywania danych i inne informacje odczytywane na żywo z tej sesji. Nic nie jest zapisywane ani wysyłane. Na szerokim ekranie ten panel otwiera się sam, a karta ma dwie kolumny.
- <!--i:neurobeat--> **Sound** - dźwięki interfejsu i pętle Neurospicy ułatwiające skupienie. Sound to jedyny przełącznik na tej karcie, który cokolwiek zapisuje.
- <!--i:database--> **Storage** - wskaźnik zajętego miejsca tylko do odczytu. Usuwaj lub przenoś dane w [Preferencjach](#storage).

<!--i:eti-palette-->
## System projektowy

Aktywny system projektowy w widoku do odczytu. Gdy ta przeglądarka przechowuje co najmniej dwa systemy projektowe, na pasku u góry widać ich okładki. Wybierz jeden, aby go uaktywnić. **Undo** w wyświetlonym komunikacie przywraca poprzedni.

![Karta Design system z Lolly Demo: pasek okładek do przełączania systemów, a pod nim okładka z logo, nazwą, notatką i licznikami otwierającymi poszczególne strony](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

Karta otwiera się na okładce w kolorach systemu, z jego logo, nazwą złożoną krojem ozdobnym i notatką autora. Wiersz liczników na okładce zawiera linki do poszczególnych stron:

- <!--i:palette--> **Colour** - tło, tekst, kolor główny i drugorzędny w jasnym i ciemnym wyglądzie, każdy nazwany kolor jako próbka z nazwą i kodem hex, pasmo dla każdej skali odcieni i spektrum wykresów oraz role kolorów w zwijanej sekcji. Wybierz wartość, aby skopiować kod hex.
- <!--i:font--> **Type** - Headings, Text, Emphasis i Code, każde złożone własnym krojem.
- <!--i:photos--> **Logos** - każdy plik logo na tle, dla którego go przygotowano.
- <!--i:layers--> **Colourways** - jasna i ciemna wersja każdego wariantu kolorystycznego, gdy system ma ich więcej niż jeden.
- <!--i:sliders--> **Tokens** - promień, odstępy, efekty i gradienty.
- <!--i:document--> **Print & CMYK** - kolory przypisane do dokładnej farby i warunki druku, które może deklarować PDF w CMYK.

Przełączanie to jedyna zmiana, jaką wprowadza ta karta. Edytuj system projektowy w [Lolly Design System Setup](/info/brand-studio.html) pod adresem `#/start`, do którego prowadzi okładka. System tylko do odczytu ma taką informację na okładce. Utworzone przez Ciebie systemy lokalne pozostają edytowalne. `/b` i `/brand` to skrócone linki do tej karty.

<!--i:eti-grid-->
## Możliwości

Każda część platformy ma kartę w jednej z dwunastu grup: funkcje użytkowe, platformy i środowiska uruchomieniowe, dostępność i języki, formaty eksportu, formaty importu, przygotowanie do druku, automatyzacja i AI, determinizm i powtarzalność, marka i system projektowy, prywatność i własność danych, bezpieczeństwo i kontrola dostępu oraz architektura (dla twórców). Każda grupa jest zwijana i pokazuje liczbę kart. Karta otwiera okno z funkcjami danej możliwości, a w przypadku około połowy kart także ze zrzutem ekranu użytym w tej dokumentacji.

Pole wyszukiwania nad grupami filtruje karty podczas pisania i otwiera grupy z pasującymi wynikami. Pole pokazuje, ile możliwości przeszukuje. Gdy zapytanie nie ma wyników, pojawia się informacja tekstowa.

Ta karta opisuje możliwości Lolly zgodnie z tymi przewodnikami. Nie bada urządzenia, na którym pracujesz; robi to **This device**.

<!--i:eti-gauge-->
## Aktywność i statystyki

Najpierw kompilacja: liczba wczytanych narzędzi, formatów eksportu, środowisk działania platformy i zasobów marki w katalogu. Panel **Catalogue** pokazuje szczegółowo, co zawiera ta kompilacja.

Potem Twoja praca: **Your activity** zlicza to, co utworzyłeś na tym urządzeniu. **Recent creations** i **Latest exports** to stosy, które możesz przeglądać przesunięciem palca. Pojawiają się, gdy mają zawartość. Oba otwierają element w jego wcześniejszym stanie. Te liczniki pozostają na urządzeniu. Opcjonalna instancja Lolly Work przechowuje własne [dane telemetryczne i zapisy audytu organizacji](/info/privacy.html#organisation-services-with-lolly-work).

<!--i:eti-link-->
## Linki bezpośrednie

Każda karta i sekcja Settings ma własny link, który można dodać do zakładek lub wkleić. [Lolly Search](/info/search.html) tworzy wyniki **Settings** z tego samego rejestru co Settings, więc zmiana nazwy sekcji nigdy nie psuje wyniku wyszukiwania.

::: details Wszystkie formy linków

- **Karta:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **Sekcja Preferences:** `#/settings?focus=<section-id>`, na przykład `#/settings?focus=offline-section`.
- **Konkretna sekcja:** jej identyfikator jako flaga bez wartości, na przykład `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` lub `#/settings?cap-formats`. Starsze linki `#/settings?dash-lock` i `#/settings?dash-palette-wheel` otwierają okładkę i stronę Colour.
- **Sekcja według słowa kluczowego:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (strona Colour) lub `#/settings?tokens`. Dwie sekcje mogą mieć wspólne słowo kluczowe: `print` należy zarówno do informacji o druku na karcie marki, jak i do grupy Print production. Wygrywa pierwsza w kolejności na stronie. Użyj identyfikatora, aby wybrać konkretną sekcję.

Link bezpośredni przełącza na kartę z miejscem docelowym i otwiera każdą grupę, w której jest ono zwinięte. Następnie przewija do celu, gdy sekcje powyżej skończą się układać. Wycofane adresy `#/platform` i `#/capabilities` otwierają się w Settings z zachowaniem flag linków bezpośrednich.
:::

---

**Powiązane:** [Profile](/info/profile.html) opisują Twoje dane i konteksty, w których tworzysz. [Lolly Design System Setup](/info/brand-studio.html) opisuje edycję tego, co pokazuje karta Design system. [Znajdowanie i odzyskiwanie pracy](/info/find-your-work.html) opisuje przechowywanie, kopie zapasowe i zmianę urządzeń.
