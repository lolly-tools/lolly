# Architektura Lolly

![Ikona Lolly - duży zielono-biały lizak](/info/icon.svg)

Ta strona jest dla osób zmieniających kod Lolly: jak silnik, powłoki i paczki narzędzi do siebie pasują, gdzie każde mieszka w repozytorium oraz zobowiązania ograniczające każdą zmianę. Jeśli chcesz wiedzieć, co robi Lolly i kto go używa, najpierw przeczytaj [How Lolly works](/info/how-lolly-works.html).

Dwa uzupełnienia idą głębiej. [`engine/README.md`](../engine/README.md) to mapa silnika moduł po module, generowana z kodu. [Threat Model & Trust Boundaries](/info/threat-model.html) czyta tę samą architekturę jako granice zaufania i jest stroną na każde pytanie o to, co silnik traktuje jako niezaufane.

## Ogólny obraz

Narzędzia są danymi na górze. Silnik pośrodku nie wie nic o żadnej platformie. Powłoki na dole implementują jeden kontrakt, a katalogi dostarczają treść.

![Narzędzia dostarczają manifest, szablon i hooki wspólnemu silnikowi. Powłoki web, Tauri i terminalowa implementują most możliwości HostV1 i czytają narzędzia oraz zasoby z katalogów.](/info/diagrams/concepts/platform-layers.svg)

Jeśli da się to opisać czystymi danymi i Handlebars, należy do **silnika**. Jeśli dotyka DOM, systemu plików, sieci lub jakiegokolwiek API przeglądarki lub systemu operacyjnego, należy do **hosta**, czyli strony powłoki po stronie mostu. Silnik jest open source i nic, co zna konkretną markę lub platformę, nie trafia do silnika.

## Układ repozytorium

Lolly to jedno repozytorium. Każdy poniższy katalog jest w nim zwykłym katalogiem, z wyjątkiem `brands/suse`, **prywatnego** submodułu git z paczką narzędzi i katalogiem SUSE, którego publiczny klon nie pobiera. To, które paczki czyta kompilacja, określa profil treści (`profiles.json`), rozwiązywany dla procesu, a nie przełączany globalnie. [Build Guide](/info/build-guide.html) ma polecenie klonowania i opis zatwierdzania zmiany wewnątrz prywatnej paczki.

| Katalog | Co zawiera |
|---|---|
| `engine/` | Niezależny od platformy rdzeń: loader, runtime, dane wejściowe, szablony, tryb URL, jednostki i moduły formatów |
| `shells/` | Aplikacja internetowa, aplikacje Tauri na komputer i urządzenia mobilne, CLI, TUI i rozszerzenie przeglądarki |
| `packages/` | SDK dla autorów narzędzi (`@lolly-tools/core`), wspólne elementy powłoki Node i renderer dokumentacji, między innymi |
| `community/` | Narzędzia niezależne od marki oraz wspólne paczki emoji |
| `brands/` | Paczki marek: `lolly-demo` (Lolly Demo, system projektowy, którego używa lolly.tools), `lolly-start` (pusty starter) i prywatna `suse` |
| `services/` | Opcjonalne usługi MCP, certyfikatów i Penpot oraz kod serwerowy, który współdzielą |
| `schemas/` | JSON Schema dla manifestów narzędzi, wpisów zasobów i odwołań do zasobów |
| `scripts/`, `tests/`, `docs/`, `api/` | Skrypty budowania i katalogu, zestaw testów silnika, te dokumenty i generowane paczki bezserwerowe |

::: details Pliki silnika i powłoki, które spotkasz najpierw
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

Nie ma katalogu `tools/` ani `catalog/` w korzeniu repozytorium. `packages/node-shell/src/content-roots.ts` odpowiada na pytanie "gdzie mieszka narzędzie `<id>`" i "gdzie jest katalog" na podstawie `profiles.json`, gdy się o to zapyta. Prawdziwa para `tools/` i `catalog/` jest zapisywana tylko w wyniku budowania, takim jak `dist/`, ładunek RPM lub obraz kontenera, ponieważ przeglądarka pobiera te dwie ścieżki przez HTTP.

## Gdzie działa Lolly

Każda powierzchnia używa tego samego silnika i tych samych plików narzędzi.

- **Aplikacja internetowa.** Progresywna aplikacja internetowa, która działa offline, gdy jej service worker zapamiętał narzędzia i zasoby. Nie wymaga konta; stan żyje w IndexedDB na każdym urządzeniu. Jeden responsywny układ obsługuje komputer i telefon: na telefonie kontrolki stają się arkuszem, a kontrolki eksportu otwierają się z pływającej pigułki.
- **Aplikacje na komputer i urządzenia mobilne.** Pakiety Tauri tej samej aplikacji internetowej, z natywnymi oknami plików, stanem w systemie plików i pełnym użyciem offline.
- **CLI.** `lolly <tool-id> --input=value --output=file.png` ładuje ten sam silnik w DOM bez interfejsu i zapisuje plik. To tryb URL w innym transporcie, a nie osobna implementacja. Zobacz [CLI](/info/cli.html).
- **TUI.** Pełnoekranowa, zorientowana na klawiaturę aplikacja terminalowa, która używa mostu CLI, trzyma zapisane sesje na dysku (we własnym folderze aplikacji komputerowej, gdy jest zainstalowana, a w przeciwnym razie w `~/.lolly`) i uruchamia ograniczoną przeglądarkę bez interfejsu tylko wtedy, gdy format jej potrzebuje. Zobacz [TUI](/info/tui.html).

![Widok podzielony na komputerze: kontrolki generowane z manifestu po lewej, żywa kanwa po prawej](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

To samo narzędzie przy szerokości telefonu nie potrzebuje drugiego układu: kontrolki stają się arkuszem u góry, a podgląd zajmuje ekran.

![Audiogram na ekranie o szerokości 430 px: arkusz kontrolek u góry, gotowa kwadratowa grafika poniżej i pływająca pigułka eksportu](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

Aplikacja internetowa zawiera też **Batch** (`#/batch`, `shells/web/src/pro/`), siatkę w stylu arkusza kalkulacyjnego, która renderuje wiele wierszy naraz dla jednego lub wielu narzędzi; [Batch and Multi-edit](/info/batch.html#make-many-versions-of-one-design) opisuje Batch. **Settings → Capabilities** mapuje wszystko, co platforma deklaruje, że potrafi.

![Batch na świeżej instalacji: jeden pusty wiersz czekający na narzędzie, z powierzchnią arkusza i przyciskiem Render na miejscu, zanim pojawią się jakiekolwiek dane](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

## Zobowiązania architektoniczne

Te decyzje są ustalone. Zmiana któregokolwiek z nich to poważne przedsięwzięcie, ponieważ kształtują każdą inną decyzję w bazie kodu.

### 1. Deklaratywne narzędzia, z imperatywnym wyjściem awaryjnym

Narzędzie to manifest (`tool.json`), szablon (`template.html`) i opcjonalny `hooks.js`. **Manifest deklaruje dane wejściowe**, nigdy szablon: dane wejściowe nie są wywnioskowane z tokenów Handlebars. Większość narzędzi to sam manifest i szablon, co pozwala je pisać osobom niebędącym programistami.

![Stos kontrolek Street Map: lista miast, wybór motywu, suwaki grubości i wyzwalacze kolorów, każdy narysowany z jednej linii manifestu](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

Narzędzia, które obliczają wartości, takie jak kodowanie QR czy kształtowanie wykresów, dodają hooki: nazwane funkcje cyklu życia, które runtime wywołuje z wstrzykniętym mostem możliwości. Hooki to kontrakt przenośności, a nie piaskownica bezpieczeństwa, i działają w ramach budżetu czasu. Narzędzia, których hooki są udowodnione jako wolne od globalnych obiektów strony, mają `isolate: true` i działają w Workerze. [Tool hooks](/info/tool-hooks.html) opisuje cykl życia i budżety, a [Threat Model](/info/threat-model.html) mówi, co wykonawca w stronie zawiera, a czego nie.

### 2. Narzędzia i zasoby to dane, nie spakowany kod

Aplikacje web i Tauri pobierają katalogi narzędzi i zasobów przy starcie, zapamiętują je i pracują z tym, co jest, więc nowe narzędzie lub zasób nie wymaga wydania aplikacji. Bajty zasobów mają sumy kontrolne SHA-256, a `id` i `version` zasobu sterują unieważnianiem pamięci podręcznej.

### 3. Most możliwości to jedyne API, które widzą narzędzia

Narzędzia nigdy nie dotykają DOM poza swoim szablonem, nigdy nie wywołują `fetch` bezpośrednio i nigdy nie czytają systemu plików. Wywołują wersjonowane metody `host.*`. Kanoniczna definicja kontraktu to `packages/core/src/host-v1.ts`, SDK dla autorów narzędzi `@lolly-tools/core`, więc osoba trzecia może budować na nim bez zależności od silnika; `engine/src/bridge/host-v1.ts` reeksportuje jego typy.

| Wymagane API | Co robi |
|---|---|
| `host.profile` | Dane użytkownika; wypełnia dane wejściowe przez `bindToProfile` |
| `host.assets` | Zapytania do katalogu, rozwiązywanie zasobów i selektor hosta |
| `host.state` | Zapis i odczyt slotów danych wejściowych: IndexedDB w sieci, system plików w Tauri, pamięć w CLI |
| `host.clipboard` | Zapis tekstu lub obrazu do schowka, z rozwiązaniami zastępczymi platform |
| `host.export` | Rasteryzacja lub serializacja celu renderowania oraz ścieżka transformacji plików na urządzeniu |
| `host.log` | Logowanie z poziomami do hosta |

Każde inne API jest opcjonalne i addytywne: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` i wiele innych. Manifest narzędzia wymienia w `requires` opcjonalne API, które jego hooki wywołują bez sprawdzenia, a host, któremu któregoś brakuje, odmawia zamontowania narzędzia; hooki wykrywają resztę. Kilka, jak `recorder`, wymaga też zdolności urządzenia deklarowanej przez narzędzie. `packages/core/src/host-v1/apis.ts` wymienia je wszystkie, a [Host API](/info/host-api.html) dokumentuje każde. Dodanie metody to wersja minor; usunięcie lub zmiana to wersja major, a v1 działa dalej, gdy pojawi się v2.

### 4. Identyfikatory zasobów są na zawsze

`lolly/logo/primary` to kontrakt. Po opublikowaniu identyfikator nigdy się nie zmienia i nie jest używany ponownie. Zmiana bajtów podbija `version` we wpisie zasobu, a zamiennik ustawia `deprecated: true` i opcjonalnie `replacedBy`, więc istniejące odwołania zawsze się rozwiązują. To dzięki temu zapisane sesje i udostępnione linki działają latami.

### 5. Tryb URL jest pierwszorzędny

Każde dane wejściowe da się wyrazić jako parametr URL, więc link jest gotowym plikiem:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Ten link sam w sobie, bez niczego więcej, jest gotowym plikiem](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Zmień parametr, a masz inny plik. Cała ta paleta to jeden kolor wyjściowy, harmonia i liczba kroków:

![Dziewięć kroków w czterech odcieniach, wszystkie wyrosłe z pojedynczego koloru bazowego przekazanego w linku](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

CLI buduje ten sam stan URL ze swoich argumentów i uruchamia ten sam potok, więc CLI nie może się rozjechać z aplikacją. `engine/src/url-mode.ts` parsuje i serializuje; zestaw zarezerwowanych nazw (`format`, `width`, `dpi`, `c2pa`, `z` i inne) nigdy nie jest przekazywany narzędziu, a [Reserved URL parameters](/info/url-parameters.html) wymienia je wszystkie. Dane wejściowe typu zasób podróżują po `id` i są rozwiązywane przez `host.assets.get()`, zanim szablon się wypełni.

### 6. Pamięć idzie przez most

Aplikacja internetowa używa IndexedDB, Tauri system plików, a CLI pamięci. Narzędzia widzą tylko `host.state.save(slot, data)` i `host.state.load(slot)`, nigdy `localStorage`. Ludzie mogą trzymać kilka nazwanych sesji na narzędzie bez konta. Ponieważ most jest jedynym szwem, ten stan jest też przenośny: `shells/web/src/data-transfer.ts` odczytuje go z powrotem do jednego pliku `lolly-backup`, który importuje się na każdej innej instalacji ([Data transfer](/info/data-transfer.html)), a [Sync](/info/sync.html) wysyła ten sam pakiet do magazynu wybranego przez osobę.

### 7. Znaczniki dojrzałości mówią, czym jest narzędzie

Każde narzędzie deklaruje `status: official | community | experimental`. Galeria sortuje według statusu, a narzędzia eksperymentalne domyślnie oznaczają eksporty znakiem wodnym: runtime włącza znak wodny, chyba że wywołujący poda `watermark: false`, a narzędzia na urządzeniu są wyłączone. Jakikolwiek proces zespół ułoży wokół katalogu, leży na tym.

### 8. Dane wejściowe są typowane w manifeście

Dane wejściowe deklarują `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` lub `file`. Host renderuje kontrolkę dla każdego typu, więc narzędzia nie piszą kodu kontrolek, a każde dane wejściowe mogą nieść `bindToProfile`. Trzy mają największe znaczenie:

- **`asset`**, z `filter` i `allowUpload`, to most do systemu zasobów. `allowUpload: false` ogranicza slot do zasobów biblioteki, a wgrane przez użytkownika pliki dzielą kształt `AssetRef` biblioteki.
- **`blocks`** to powtarzalna grupa pól edytowana w panelu bocznym, używana przez Meeting Planner, Wayfinding, Diagrams i inne. Kliknięcie wyrenderowanego bloku ustawia fokus na jego wierszu.
- **`file`** trzyma własny plik użytkownika w pamięci dla utilities na urządzeniu, takich jak Strip Hidden Data i Compress, a **`vector`** grupuje stały zestaw liczb w jedną kontrolkę.

### 9. Szablony są bez logiki

Szablony to Handlebars, wybrane, aby mogły je pisać osoby niebędące programistami: `{{x}}` escapuje, a `{{{x}}}` to jawna zgoda. Logika żyje w `hooks.js`, gdzie jest jawna i podlega przeglądowi. Wiele szablonów używa `{{{` dla znaczników obliczonych przez hook, więc każdy hook musi escapować to, co przekazuje. Helpery to `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` i `media`, plus `icsStamp`, `rfcText`, `csvCell` i `arrow` dla siostrzanych szablonów `.ics`, `.vcf` i `.csv`. [Templates and rendering](/info/tool-rendering.html) je omawia.

### 10. Narzędzia komponują narzędzia

Narzędzie może osadzić render innego narzędzia bez importów między narzędziami; silnik rozwiązuje kompozycję. Manifest może zadeklarować `composes: [{ id, tool, inputs }]` i umieścić dziecko przez `{{asset <id>}}`, a przenośny adres osadzenia (`https://lolly.tools/tool/<id>.svg?…`) renderuje dziecko lokalnie, i tak Design umieszcza żywy kod QR lub wykres. Dziecko SVG pozostaje wektorowe w rodzicu SVG lub PDF. Dzieci są produktami pośrednimi, nigdy nie dostają znaku wodnego ani stempla, a powłoka, która nie może ich wyrenderować, zostawia slot pusty, podczas gdy rodzic nadal się renderuje. [Composition and brand overlays](/info/tool-composition.html) podaje szczegóły.

## Czego postanowiliśmy nie robić

- **Żadnego dowolnego JavaScriptu w szablonach.** Logika żyje w `hooks.js`.
- **Żadnego obowiązkowego serwera zasobów.** Ludzie dodają własne pliki do Assets w aplikacji i przekazują pracę jako sesję: link udostępniania dla danych wejściowych i ustawień, plik `.lolly`, gdy podróżują też wgrane pliki. Udostępniona sesja może stać się szablonem w wyborze narzędzia. Organizacja, która chce nadzorowanego katalogu, może użyć katalogu, zatwierdzeń i polityk Lolly Work albo zarządzać paczką marki w git i tam przeglądać zmiany.
- **Żadnej wymuszonej kontroli dostępu.** Otwarta aplikacja jest domyślnie publiczna, a znaczniki dojrzałości i znaki wodne niosą ryzyko marki. Logowanie organizacji, role i polityki pochodzą z Lolly Work, gdy zespół ich chce.
- **Żadnej centralnej bazy danych.** Stan użytkownika żyje na każdym urządzeniu, a opcjonalny Sync kopiuje go do magazynu wybranego przez osobę, nigdy do bazy Lolly.
- **Żadnej wspólnej ścieżki kodu między narzędziami a silnikiem.** Silnik i narzędzia społeczności są open source, a paczka marki, taka jak prywatna `brands/suse/`, niesie własne narzędzia i katalog na własnych warunkach. Żadne narzędzie nie importuje z `engine/`, więc podział pozostaje czysty.

## Cykl życia jednego renderu

Ktoś otwiera `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`:

1. **Start.** Aplikacja internetowa otwiera IndexedDB, buduje most możliwości i synchronizuje katalogi narzędzi i zasobów albo ładuje je z pamięci podręcznej offline.
2. **Trasa.** Ścieżka wybiera widok narzędzia dla `qr-code`, z zapytaniem jako wartościami początkowymi.
3. **Wczytanie.** `loadTool` pobiera `tool.json`, waliduje go względem schematu i pobiera szablon, style i hooki.
4. **Parsowanie linku.** `parseUrlState` zamienia parametry na wartości danych wejściowych. Odwołanie do zasobu, takie jak `?logo=lolly/logo/primary`, staje się nierozwiązanym `{ id }`.
5. **Uruchomienie runtime.** `createRuntime(tool, host, initialValues)` buduje model danych wejściowych z danych profilu, wartości domyślnych i linku, rozwiązuje odwołania do zasobów, ładuje hooki i wywołuje `onInit`.
6. **Renderowanie.** Powłoka subskrybuje runtime, rysuje kontrolki z modelu i zapisuje wypełniony szablon do `#tool-canvas`.
7. **Interakcja.** Pisanie wywołuje `runtime.setInput`, które stosuje ograniczenia, wywołuje `onInput`, ponownie wypełnia szablon i przerysowuje.
8. **Eksport.** **Download** wywołuje `runtime.export(node, format)`, a `host.export` powłoki tworzy plik: raster, wektor z przejścia po DOM, PDF, dokument lub jeden z pozostałych formatów w `schemas/tool.schema.json`. Jednostki fizyczne są przeliczane dla każdego formatu, a metadane i Content Credentials są osadzane tam, gdzie format może je pomieścić. Narzędzia eksperymentalne dostają znak wodny od hosta, a nie od narzędzia. [Templates and rendering](/info/tool-rendering.html) i [Export a file](/info/exporting.html) omawiają krok eksportu.

![Panel eksportu otwierany przez ?options: para nazwy pliku i formatu, rozmiar wyjściowy i kontrolki zapisujące plik](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Ten sam cykl życia działa w Tauri i w CLI z DOM bez interfejsu, gdzie wynik trafia do pliku lub stdout.

## Licencje

Kod, w tym `engine/`, `shells/`, `services/`, `schemas/` i generator dokumentacji, jest na MPL-2.0, w jednym publicznym repozytorium, [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). Proza dokumentacji jest na CC BY-SA 4.0. Paczki marek niosą własne warunki w `NOTICE.md` każdej paczki: narzędzia społeczności są na MPL-2.0, a prywatna paczka SUSE jest własnościowa SUSE. [About](/info/about.html) zawiera pełną notę licencyjną.
