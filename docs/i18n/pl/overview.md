# Architektura Lolly

![Ikona Lolly - duży zielono-biały lizak](/info/icon.svg)

Ta strona jest dla osób, które zmieniają kod Lolly: jak łączą się silnik, powłoki i pakiety narzędzi, gdzie znajdują się w repozytorium i jakie założenia ograniczają każdą zmianę. Aby dowiedzieć się, co robi Lolly i kto używa Lolly, najpierw przeczytaj [Jak działa Lolly](/info/how-lolly-works.html).

[`engine/README.md`](https://github.com/lolly-tools/lolly/blob/main/engine/README.md) opisuje silnik moduł po module i jest generowany z kodu. [Model zagrożeń & granice zaufania](/info/threat-model.html) przedstawia tę samą architekturę w kategoriach granic zaufania i wskazuje, co silnik uznaje za niezaufane.

<!--i:eti-layers-->
## Obraz całości

Narzędzia na górze to dane. Silnik pośrodku nie wie nic o żadnej platformie. Powłoki na dole implementują jeden kontrakt, a katalogi dostarczają treść.

![Narzędzia dostarczają manifest, szablon i hooki do wspólnego silnika. Powłoki webowa, Tauri i terminalowa implementują most możliwości HostV1 i odczytują narzędzia oraz zasoby z katalogów.](/info/diagrams/concepts/platform-layers.svg)

Wszystko, co można opisać samymi danymi i Handlebars, należy do **silnika**. Wszystko, co korzysta z DOM, systemu plików, sieci lub dowolnego API przeglądarki czy systemu operacyjnego, należy do **hosta**, czyli strony mostu należącej do powłoki. Silnik ma otwarty kod źródłowy. Nic, co wie o konkretnej marce, nie trafia do silnika.

<!--i:eti-folder-shared-->
## Układ repozytorium

Lolly to jedno repozytorium. Każdy katalog poniżej jest zwykłym katalogiem, z wyjątkiem `brands/suse`: **prywatnego** podmodułu git z pakietem narzędzi i katalogiem SUSE, którego klon publicznego repozytorium nie pobiera. Profil treści (`profiles.json`) określa, które pakiety odczytuje proces budowania. Każdy proces ustala własny profil i nie ma globalnego przełącznika. [Przewodnik budowania](/info/build-guide.html) zawiera polecenie klonowania i instrukcję zatwierdzania zmian wewnątrz prywatnego pakietu.

| Katalog | Zawartość |
|---|---|
| `engine/` | Rdzeń niezależny od platformy: moduł ładowania, środowisko wykonawcze, dane wejściowe, szablony, tryb URL, jednostki i moduły formatów |
| `shells/` | Aplikacja webowa, aplikacje Tauri na komputery i urządzenia mobilne, CLI, TUI i rozszerzenie przeglądarki |
| `packages/` | Między innymi SDK dla autorów narzędzi (`@lolly-tools/core`), wspólne elementy powłoki Node i renderer dokumentacji |
| `community/` | Narzędzia niezależne od marki oraz wspólne pakiety emoji |
| `brands/` | Pakiety marek: `lolly-demo` (Lolly Demo, system projektowy używany przez lolly.tools), `lolly-start` (pusty pakiet startowy) i prywatny `suse` |
| `services/` | Opcjonalne usługi MCP, certyfikatów i Penpot oraz ich wspólny kod serwerowy |
| `schemas/` | JSON Schema dla manifestów narzędzi, wpisów zasobów i odwołań do zasobów |
| `scripts/`, `tests/`, `docs/`, `api/` | Skrypty budowania i katalogów, zestaw testów silnika, ta dokumentacja i wygenerowane pakiety serverless |

::: details Pliki silnika i powłok, które poznasz najpierw
```
engine/src/
  index.ts          public surface: loader, runtime, template, inputs, url-mode
  loader.ts         fetches and validates tool files
  runtime.ts        orchestrates one mounted tool, from load to export
  template.ts       Handlebars hydration and annotateTemplate
  inputs.ts         manifest to runtime input model
  url-mode.ts       URL to input state and back
  validate.ts       JSON Schema validation of manifests
  compose.ts        nested tool renders (composes)
  embed.ts          portable lolly.tools embed URLs
  bridge/host-v1.ts type re-export of the @lolly-tools/core contract

shells/web/src/
  main.ts           boot and routing
  bridge/           the web implementations of the host APIs
  catalog/sync.ts   boot-time catalog sync and offline cache
  views/            the gallery, tool, projects, free canvas and the other views
  pro/              Batch (#/batch)

shells/cli/         bin/lolly.ts (entry), src/run.ts (headless render), src/bridge.ts
shells/tui/         src/main.tsx (the full-screen app), src/bridge.ts
```
:::

::: note W katalogu głównym repozytorium nie ma katalogu `tools/` ani `catalog/`
`packages/node-shell/src/content-roots.ts` odpowiada na pytania „gdzie znajduje się narzędzie `<id>`” i „gdzie jest katalog” na podstawie `profiles.json`. Rzeczywista para `tools/` i `catalog/` jest zapisywana tylko w wyniku budowania, takim jak `dist/`, zawartość pakietu RPM lub obraz kontenera, ponieważ przeglądarka pobiera te dwie ścieżki przez HTTP.
:::

<!--i:eti-monitor-->
## Gdzie działa Lolly

Każdy interfejs korzysta z tego samego silnika i tych samych plików narzędzi.

- **Aplikacja webowa.** Progresywna aplikacja webowa. Działa offline, gdy jej service worker zapisze narzędzia i zasoby w pamięci podręcznej. Nie wymaga konta, a stan znajduje się w IndexedDB na każdym urządzeniu. Jeden responsywny układ obsługuje komputer i telefon. Na telefonie kontrolki trafiają do panelu, a kontrolki eksportu otwierają się z pływającej pigułki.
- **Aplikacje na komputery i urządzenia mobilne.** Pakiety Tauri tej samej aplikacji webowej, z natywnymi oknami wyboru plików, stanem w systemie plików i pełną obsługą offline.
- **CLI.** `lolly <tool-id> --input=value --output=file.png` ładuje ten sam silnik w DOM bez interfejsu graficznego i zapisuje plik. To tryb URL z innym sposobem przekazywania danych. Zobacz [CLI](/info/cli.html).
- **TUI.** Pełnoekranowa aplikacja terminalowa obsługiwana przede wszystkim klawiaturą. Wykorzystuje most CLI i przechowuje zapisane sesje na dysku: w folderze aplikacji komputerowej, jeśli jest zainstalowana, a w przeciwnym razie w `~/.lolly`. Uruchamia przeglądarkę bez interfejsu graficznego o ograniczonym zakresie działania tylko wtedy, gdy wymaga tego format. Zobacz [TUI](/info/tui.html).

![Widok podzielony na komputerze: kontrolki wygenerowane z manifestu po lewej, kanwa na żywo po prawej](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

Przy szerokości telefonu panel kontrolek jest u góry, a podgląd wypełnia ekran.

![Audiogram na ekranie o szerokości 430px: panel kontrolek u góry, gotowa kwadratowa grafika poniżej i pływająca pigułka eksportu](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dzzfxm%3A7%3Alofi%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

Aplikacja webowa zawiera też **Batch** (`#/batch`, `shells/web/src/pro/`), siatkę przypominającą arkusz kalkulacyjny, która renderuje wiele wierszy naraz w jednym lub wielu narzędziach. Zobacz [Batch i Lolly Multi-edit](/info/batch.html#make-many-versions-of-one-design). **Settings → Capabilities** wymienia wszystko, co platforma deklaruje jako dostępne możliwości.

![Batch w nowej instalacji: jeden pusty wiersz czeka na narzędzie, a arkusz i jego przycisk Render są już widoczne przed wprowadzeniem danych](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

<!--i:eti-lock-->
## Założenia architektury

Te decyzje są ustalone. Każda inna decyzja w kodzie od nich zależy, więc zmiana którejkolwiek z nich to duże przedsięwzięcie.

### 1. Deklaratywne narzędzia z możliwością użycia kodu imperatywnego

Narzędzie to manifest (`tool.json`), szablon (`template.html`) i opcjonalny `hooks.js`. **Manifest deklaruje dane wejściowe**. Dane wejściowe nigdy nie są wywnioskowywane z tokenów Handlebars w szablonie. Większość narzędzi to sam manifest i szablon, więc mogą je tworzyć osoby niebędące programistami.

![Stos kontrolek Street Map: lista rozwijana miast, wybór motywu, suwaki grubości i przyciski kolorów, każdy utworzony na podstawie wiersza manifestu](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

Narzędzia obliczające wartości, na przykład kodujące QR lub kształtujące wykresy, dodają hooki: nazwane funkcje cyklu życia, które środowisko wykonawcze wywołuje ze wstrzykniętym mostem możliwości. Hooki są kontraktem przenośności, a nie izolowanym środowiskiem bezpieczeństwa. Działają w ramach limitu czasu. Narzędzia, których hooki są sprawdzone pod kątem braku zależności od globalnych obiektów strony, mają `isolate: true` i działają w Workerze. [Hooki narzędzi](/info/tool-hooks.html) opisują cykl życia i limity. [Model zagrożeń](/info/threat-model.html) wyjaśnia, co mechanizm wykonawczy na stronie ogranicza, a czego nie.

### 2. Narzędzia i zasoby to dane, a nie kod w pakiecie aplikacji

Aplikacje webowa i Tauri pobierają katalogi narzędzi i zasobów przy uruchomieniu, zapisują je w pamięci podręcznej i pracują na zapisanych danych. Nowe narzędzie lub zasób nie wymaga wydania aplikacji. Bajty zasobów mają sumy kontrolne SHA-256. `id` i `version` zasobu sterują unieważnianiem pamięci podręcznej.

### 3. Most możliwości to jedyne API widoczne dla narzędzi

Narzędzia nigdy nie korzystają z DOM poza swoim szablonem, nigdy nie wywołują bezpośrednio `fetch` i nigdy nie odczytują systemu plików. Wywołują wersjonowane metody `host.*`. Kontrakt jest zdefiniowany w `packages/core/src/host-v1.ts`, w SDK dla autorów narzędzi `@lolly-tools/core`. Zewnętrzny twórca może korzystać z SDK bez zależności od silnika. `engine/src/bridge/host-v1.ts` ponownie eksportuje jego typy.

| Wymagane API | Działanie |
|---|---|
| `host.profile` | Dane użytkownika; wstępnie wypełnia dane wejściowe przez `bindToProfile` |
| `host.assets` | Zapytania do katalogu, rozwiązywanie odwołań do zasobów i selektor hosta |
| `host.state` | Zapisywanie i wczytywanie slotów danych wejściowych: IndexedDB w aplikacji webowej, system plików w Tauri, pamięć w CLI |
| `host.clipboard` | Zapisywanie tekstu lub obrazu w schowku, z rozwiązaniami zastępczymi dla platform |
| `host.export` | Rasteryzacja lub serializacja celu renderowania oraz ścieżka przekształcania plików na urządzeniu |
| `host.log` | Przekazywanie logów z poziomami ważności do hosta |

Każde inne API jest opcjonalnym rozszerzeniem: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` i wiele innych. `requires` w manifeście wymienia opcjonalne API, które jego hooki wywołują bez wcześniejszego sprawdzania. Host, któremu brakuje któregoś z nich, odmawia zamontowania narzędzia. Dostępność pozostałych hooki wykrywają same. Niektóre, takie jak `recorder`, wymagają też możliwości urządzenia zadeklarowanej przez narzędzie. `packages/core/src/host-v1/apis.ts` wymienia je wszystkie, a [API hosta](/info/host-api.html) dokumentuje każde z nich. Dodanie metody oznacza zmianę wersji podrzędnej. Usunięcie lub zmiana metody oznacza zmianę wersji głównej, a v1 nadal działa po wydaniu v2.

### 4. Identyfikatory zasobów są na zawsze

`lolly/logo/primary` to kontrakt. Po opublikowaniu identyfikator nigdy się nie zmienia i nigdy nie jest używany ponownie. Zmiana bajtów podnosi `version` we wpisie zasobu. Zastąpienie ustawia `deprecated: true` i opcjonalnie `replacedBy`. Istniejące odwołania zawsze są rozwiązywane, więc zapisane sesje i udostępnione linki działają przez lata.

### 5. Tryb URL jest pełnoprawnym interfejsem

Każdą daną wejściową można wyrazić jako parametr URL, więc link jest gotowym plikiem:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Sam ten link, bez niczego więcej, jest gotowym plikiem](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Zmień parametr, a otrzymasz inny plik. Ta paleta to jeden kolor bazowy, harmonia i liczba kroków:

![Dziewięć kroków w czterech odcieniach, wszystkie utworzone z jednego koloru bazowego zawartego w linku](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

CLI buduje ten sam stan URL ze swoich argumentów i uruchamia ten sam potok, więc nie może działać inaczej niż aplikacja. `engine/src/url-mode.ts` parsuje i serializuje stan URL. Zarezerwowane nazwy (`format`, `width`, `dpi`, `c2pa`, `z` i inne) nigdy nie są przekazywane do narzędzia. [Zarezerwowane parametry URL](/info/url-parameters.html) wymieniają je wszystkie. Dane wejściowe zasobów są przekazywane przez `id`, a odwołania do nich są rozwiązywane przez `host.assets.get()` przed wypełnieniem szablonu.

### 6. Przechowywanie odbywa się przez most

Aplikacja webowa używa IndexedDB, Tauri systemu plików, a CLI pamięci. Narzędzia widzą tylko `host.state.save(slot, data)` i `host.state.load(slot)`, nigdy `localStorage`. Użytkownicy mogą zachować kilka nazwanych sesji na narzędzie bez konta. Ponieważ most jest jedynym punktem styku, ten stan jest też przenośny. `shells/web/src/data-transfer.ts` eksportuje stan jako jeden plik `lolly-backup`, który można zaimportować w dowolnej innej instalacji ([Przenoszenie danych](/info/data-transfer.html)). [Sync](/info/sync.html) wysyła ten sam pakiet do miejsca przechowywania wybranego przez użytkownika.

### 7. Znaczniki dojrzałości określają status narzędzia

Każde narzędzie deklaruje `status: official | community | experimental`. Galeria sortuje według statusu. Narzędzia eksperymentalne domyślnie dodają znak wodny do eksportów: środowisko wykonawcze włącza go, chyba że wywołujący przekaże `watermark: false`. Narzędzia działające na urządzeniu są z tego zwolnione. Własny proces zarządzania katalogiem zespołu opiera się na tych znacznikach.

### 8. Typy danych wejściowych są określone w manifeście

Dane wejściowe deklarują `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` lub `file`. Host renderuje kontrolkę dla każdego typu, więc narzędzia nie zawierają kodu kontrolek. Każde dane wejściowe mogą mieć `bindToProfile`. Najważniejsze są trzy typy:

- **`asset`**, z `filter` i `allowUpload`, jest mostem do systemu zasobów. `allowUpload: false` ogranicza slot do zasobów biblioteki. Pliki przesłane przez użytkownika mają tę samą strukturę `AssetRef` co zasoby biblioteki.
- **`blocks`** to powtarzalna grupa pól edytowana w panelu bocznym, używana przez Meeting Planner, Wayfinding, Diagrams i inne narzędzia. Kliknięcie wyrenderowanego bloku ustawia fokus na jego wierszu.
- **`file`** przechowuje własny plik użytkownika w pamięci dla narzędzi działających na urządzeniu, takich jak Lolly Strip Hidden Data i Compress, a **`vector`** grupuje stały zestaw liczb w jedną kontrolkę.

### 9. Szablony nie zawierają logiki

Szablony są napisane w Handlebars, więc mogą je tworzyć osoby niebędące programistami. `{{x}}` koduje znaki specjalne, a `{{{x}}}` jawnie wyłącza to kodowanie. Logika znajduje się w `hooks.js`, gdzie można ją poddać przeglądowi. Wiele szablonów używa `{{{` do znaczników wyliczonych przez hook, więc każdy hook musi zakodować znaki specjalne w tym, co przekazuje. Funkcje pomocnicze to `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` i `media` oraz `icsStamp`, `rfcText`, `csvCell` i `arrow` dla towarzyszących szablonów `.ics`, `.vcf` i `.csv`. Opisuje je strona [Szablony i renderowanie](/info/tool-rendering.html).

### 10. Narzędzia składają się z narzędzi

Narzędzie może osadzić render innego narzędzia bez importów między narzędziami. Kompozycję rozwiązuje silnik. Manifest może zadeklarować `composes: [{ id, tool, inputs }]` i umieścić element podrzędny przez `{{asset <id>}}`. Przenośny URL osadzania (`https://lolly.tools/tool/<id>.svg?…`) renderuje element podrzędny lokalnie; Lolly Design umieszcza w ten sposób kod QR lub wykres na żywo. Podrzędny SVG pozostaje wektorem w nadrzędnym SVG lub PDF. Elementy podrzędne są pośrednie i nigdy nie otrzymują znaków wodnych ani poświadczeń. Powłoka, która nie może wyrenderować elementu podrzędnego, pozostawia slot pusty, a element nadrzędny nadal się renderuje. Szczegóły znajdziesz w [Kompozycja i nakładki marki](/info/tool-composition.html).

<!--i:eti-scissors-->
## Z czego świadomie zrezygnowaliśmy

- **Bez dowolnego kodu JavaScript w szablonach.** Logika znajduje się w `hooks.js`.
- **Bez obowiązkowego serwera zasobów.** Użytkownicy dodają własne pliki do Assets w aplikacji i przekazują pracę jako sesję: link do udostępniania dla danych wejściowych i ustawień, plik `.lolly`, gdy dołączają też przesłane pliki. Udostępniona sesja może stać się szablonem w selektorze narzędzia. Organizacja, która chce nadzorowanego katalogu, może korzystać z katalogu, zatwierdzeń i zasad Lolly Work lub zarządzać pakietem marki w git i tam przeglądać zmiany.
- **Bez narzuconej kontroli dostępu.** Otwarta aplikacja jest domyślnie publiczna. Znaczniki dojrzałości i znaki wodne sygnalizują ryzyko dla marki. Logowanie do organizacji, role i zasady zapewnia Lolly Work, gdy zespół ich potrzebuje.
- **Bez centralnej bazy danych.** Stan użytkownika znajduje się na każdym urządzeniu, a opcjonalny Sync kopiuje go do wybranego przez użytkownika miejsca przechowywania, nigdy do bazy danych Lolly.
- **Bez wspólnej ścieżki kodu narzędzi i silnika.** Silnik i narzędzia społeczności mają otwarty kod źródłowy. Pakiet marki, taki jak prywatny `brands/suse/`, zawiera własne narzędzia i katalog na własnych warunkach. Żadne narzędzie nie importuje z `engine/`, więc podział pozostaje wyraźny.

<!--i:eti-refresh-->
## Cykl życia pojedynczego renderowania

Ktoś otwiera `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`:

1. **Uruchomienie.** Aplikacja webowa otwiera IndexedDB, buduje most możliwości i synchronizuje katalogi narzędzi i zasobów lub ładuje je z pamięci podręcznej w trybie offline.
2. **Routing.** Ścieżka wybiera widok narzędzia `qr-code`, z parametrami zapytania jako wartościami początkowymi.
3. **Ładowanie.** `loadTool` pobiera `tool.json`, sprawdza jego zgodność ze schematem i pobiera szablon, style oraz hooki.
4. **Parsowanie linku.** `parseUrlState` zamienia parametry na wartości wejściowe. Odwołanie do zasobu, takie jak `?logo=lolly/logo/primary`, staje się nierozwiązanym `{ id }`.
5. **Uruchomienie środowiska wykonawczego.** `createRuntime(tool, host, initialValues)` buduje model danych wejściowych z danych profilu, wartości domyślnych i linku, rozwiązuje odwołania do zasobów, ładuje hooki i wywołuje `onInit`.
6. **Renderowanie.** Powłoka subskrybuje środowisko wykonawcze, rysuje kontrolki na podstawie modelu i zapisuje wypełniony szablon w `#tool-canvas`.
7. **Interakcja.** Wpisywanie wywołuje `runtime.setInput`, które stosuje ograniczenia, wywołuje `onInput`, ponownie wypełnia szablon i odrysowuje widok.
8. **Eksport.** **Download** wywołuje `runtime.export(node, format)`, a `host.export` powłoki tworzy plik: raster, wektor z mechanizmu przechodzenia po DOM, PDF, dokument lub jeden z innych formatów w `schemas/tool.schema.json`. Jednostki fizyczne są przeliczane dla każdego formatu. Metadane i Content Credentials są osadzane tam, gdzie format je obsługuje. Narzędzia eksperymentalne otrzymują znak wodny od hosta, a nie od narzędzia. [Szablony i renderowanie](/info/tool-rendering.html) oraz [Eksport pliku](/info/exporting.html) opisują etap eksportu.

![Panel eksportu otwierany przez ?options: para nazwy pliku i formatu, rozmiar wyjściowy i kontrolki zapisujące plik](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Ten sam cykl życia działa w Tauri i w CLI z DOM bez interfejsu graficznego, gdzie wynik trafia do pliku lub na stdout.

<!--i:eti-stamp-->
## Licencje

Kod, w tym `engine/`, `shells/`, `services/`, `schemas/` i generator dokumentacji, jest objęty MPL-2.0 i znajduje się w jednym publicznym repozytorium, [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). Tekst dokumentacji jest objęty CC BY-SA 4.0. Pakiety marek mają własne warunki w pliku `NOTICE.md` każdego pakietu: narzędzia społeczności są objęte MPL-2.0, a prywatny pakiet SUSE jest własnościowym pakietem SUSE. [Informacje](/info/about.html) zawierają pełną notę licencyjną.
