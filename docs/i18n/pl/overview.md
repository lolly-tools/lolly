# Przegląd

![Ikona Lolly - duży zielono-biały lizak](/info/icon.svg)

Ten dokument opisuje cel, strukturę i decyzje architektoniczne platformy Lolly. Odzwierciedla zarówno wizję produktu, jak i obecny stan kodu.

> **Status:** Lolly to wewnętrzny prototyp w **zamkniętym pilotażu, który jeszcze się nie zakończył**. Silnik jest deterministyczny i wewnętrznie spójny, ale produkt jest wczesny - SUSE jest klientem numer jeden - a jego mechanizmy kryptografii i parsowania plików przechodzą obecnie rygorystyczne utwardzanie infrastruktury SUSE, przygotowujące je do skali korporacyjnej (naprawdę dobrze nam to wychodzi). Traktuj poniższą architekturę jako zamysł projektowy w trakcie testów, a nie gotowy, certyfikowany produkt. Zobacz [Adoption & Governance](/info/adoption-governance.html#status), by dowiedzieć się, jak pilotaż jest prowadzony i mierzony.

> **Jak czytać tę stronę.** Zawiera dwa rodzaje materiału, w tej kolejności. Pierwsza połowa to
> **dlaczego to istnieje**: problem, pozycjonowanie i cykl życia, przez który przechodzi pojedynczy zasób.
> Od [Ogólny obraz](#the-big-picture-how-the-layers-fit) w dół to już
> **jak dopasowane są warstwy**: dokument architektury dla współtwórców, obejmujący podział na silnik/powłokę/pakiet,
> układ repozytorium, cele dostarczania i zobowiązania, które ograniczają każdą
> zmianę w platformie. Jeśli jesteś tu, by zmieniać kod, a nie zrozumieć
> produkt, zacznij od ogólnego obrazu.
>
> Dwa uzupełniające dokumenty sięgają głębiej niż ta strona. [`engine/README.md`](../engine/README.md) w
> repozytorium to mapa silnika moduł po module, z wygenerowaną tabelą każdego modułu i
> tego, co parsuje lub zapisuje. [Threat Model & Trust Boundaries](/info/threat-model.html)
> to ta sama architektura odczytana jako granice zaufania i to właściwa strona na każde pytanie o to,
> co silnik traktuje jako niezaufane.

---

## Dlaczego to istnieje

Zespoły mierzą się z powtarzającym się problemem: praca kreatywna i związana z treścią, która jest zbyt przewidywalna, by za każdym razem angażować wykwalifikowane ręce, ale zbyt wrażliwa na jakość, by oddać ją bez zabezpieczeń. Efektem jest albo wolna przepustowość (wąskie gardło specjalisty), albo niespójność (ludzie używający dowolnego dostępnego narzędzia), albo uzależnienie od dostawcy (SaaS-owy DAM kontrolujący twoje szablony).

Ta platforma jest bezpośrednią odpowiedzią:

> **Programistyczna kreacja i treści na skalę** - generowanie zasobów bez pracy ręcznej, z regułami pod centralną kontrolą, dla pracowników, dostawców i partnerów.

Lolly to nie miejsce, w którym powstaje system projektowy - to miejsce, w którym jest on produkowany. Pomyśl o tym jak o automacie do projektowania: dokonujesz wyboru, dostajesz wynik. Za każdym razem. Silnik dąży do najwyższej jakości, jaką dany format może uzyskać na sprzęcie, który masz przed sobą, a ten sam silnik tworzy ten sam plik na każdej platformie, na jaką trafia.

Efektem jest **obfitość**: każde wydarzenie ma poprawne oznakowanie, każdy alert CVE pasuje do stylu firmowego, każda etykieta drukuje się czysto, każda stopka e-mail jest aktualna - wszystko bez zgłoszenia do działu projektowego. Platforma obsługuje powtarzalną, zoperacjonalizowaną kreację. Celowo nie jest to narzędzie do twórczości na zamówienie - projektanci nadal odpowiadają za flagowe prace.

### Innowacja probabilistyczna, skalowanie deterministyczne

Każda dyskusja o AI w procesie kreatywnym utyka na tym samym pytaniu: która część jest zadaniem maszyny? To stare pytanie z ustaloną odpowiedzią. Skrybowie i iluminatorzy pracowali już między dwoma narzędziami - luźnym szkicem, gdzie nic nie było ustalone i wszystko można było wypróbować, oraz prasą drukarską, onieśmielającą właśnie dlatego, że się zobowiązywała. Szkice były miejscem, gdzie działa się sztuka. Prasa była sposobem, by dotarła do kogokolwiek. Nikt nie mylił tych dwóch rzeczy, a obie wciąż się rozwijały - nowe atramenty, nowe kroje, nowe prasy - każda ulepszana w harmonii z rzemiosłem i intencją, której służyła.

Lolly wyznacza tę samą granicę. Eksploruj probabilistycznie: model, projektant, luźny pomysł, prompt, który prowadzi tam, gdzie nikt nie planował. Potem skaluj deterministycznie - rzeczą, która dociera do dziesięciu tysięcy wyników, jest *narzędzie*, a narzędzie renderuje się za każdym razem tak samo, na podstawie danych wejściowych, które można odczytać. Eksploracja pozostaje swobodna, bo nic dalej w łańcuchu nie zależy od tego, czy wypadnie tak samo dwa razy. Wynik zdobywa zaufanie, bo nie jest zgadywanką. Przełożenie eksperymentów z AI na przewidywalne, powtarzalne rezultaty nie jest nową dyscypliną; to ten sam podział pracy, który sprawił, że druk w ogóle zasługiwał na zaufanie.

> Ufaj procesowi twórczemu, skaluj z rygorem.

### Na tle alternatyw

::: figure positioning-comparison
Kompletność możliwości w dzisiejszych narzędziach kreatywnych, na podstawie badania z sierpnia 2026. Punktacja: 0 brak, 25 na poziomie obejścia, 50 realne, ale ograniczone lub częściowe, 75 mocne z zastrzeżeniami, 100 kluczowa kompetencja.
:::

Luka jest jasna: nic, co dziś jest dostępne, nie daje nam wyniku opartego najpierw na ograniczeniach, działającego offline, o niskim progu umiejętności i dostępnego wewnętrznie. Lolly zawiera nawet otwarte płótno - **Design** - gdzie kolory, typografia i zasoby podlegają globalnym ustawieniom marki, więc swobodny układ pozostaje oparty najpierw na ograniczeniach. Czym **nie** jest, to nieograniczony pakiet projektowy: projektanci nadal używają Illustratora i Figmy do flagowych prac na zamówienie. Permutacje można składać za pomocą tego narzędzia.

![Każde narzędzie w bibliotece jako karta, pogrupowane według kategorii, tak by producent mógł jedno wybrać i zacząć](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=aud-gallery-landscape)

**Użyj do:** Szybkiego generowania zoperacjonalizowanych zasobów kreatywnych - kafelków wydarzeń, identyfikatorów imiennych, stopek, alertów CVE, kodów QR, kart społecznościowych, etykiet przesyłek, ustrukturyzowanych raportów.

**Nie używaj do:** Unikalnej twórczości typu hero.

---

## Cykl życia kampanii

Najjaśniejszym sposobem zobaczenia, czym jest Lolly, nie jest lista funkcji - to śledzenie pojedynczego zasobu, gdy przechodzi z rąk do rąk. Prześledź, jak jedna zlokalizowana karta kampanii przemieszcza się przez organizację:

1. **Twórca ustala reguły.** Projektant tworzy bazowy szablon w narzędziu Design, na stałe wpisując zmienne typografii i kolorów marki. Nie robi jednej karty - wykonuje pracę podstawową *raz*, by nigdy więcej nie musieć ręcznie lokalizować.
2. **Deweloper to skaluje.** Ten sam szablon jest podłączony do nocnego pipeline'u przez CLI, więc świeży wykres lub nowy wariant językowy generuje się automatycznie - żaden projektant nie otwiera pliku ponownie.
3. **Producent po prostu z tego korzysta.** Handlowiec, offline w samolocie, otwiera to samo narzędzie i generuje w pełni zgodną z marką prezentację na spotkanie z klientem. Bez umiejętności projektowych, bez sieci, bez czekania.

"Świeży wykres" z kroku drugiego to render taki jak ten, wygenerowany z ciągu danych i garści parametrów, bez otwierania przez nikogo pliku projektowego:

![Wykres warstwowy skumulowany z tytułem, którego trzy serie są ułożone w chłodnej palecie, z osiami, legendą i tytułem rozmieszczonymi przez szablon, a nie ręcznie](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Chodzi nie o to, że Lolly jest dobre dla projektantów *i* dobre dla deweloperów *i* dobre dla sprzedaży, każde z osobna. To **sztafeta**: początkową pracę twórcy skaluje deweloper, co z kolei daje siłę producentowi. Bezwysiłkowe doświadczenie nietechnicznego handlowca w samolocie jest *możliwe* wyłącznie dzięki rygorowi, który ustalił projektant, a wdrożył deweloper.

To jest mnożnik siły. Lolly nie jest szufladą osobnych narzędzi dla osobnych ról - to jeden deterministyczny cykl życia zasobu, którego dotyka każda rola, a każda para rąk, przez którą przechodzi, mnoży wartość poprzedniej.

---

## Jedna akceptacja, dziesięć tysięcy zasobów

Ponieważ akceptacja znajduje się w narzędziu, a nie w pliku (zobacz [Jak Lolly wypada na tle innych](/info/positioning.html)), skala przestaje być problemem przeglądu. Zaakceptuj raz zlokalizowane narzędzie do kart społecznościowych, a potem wygeneruj **10 000 zasobów w 12 językach** z arkusza kalkulacyjnego - i żaden z nich nie potrzebuje nowej kontroli zgodności od działu prawnego czy marki, bo szablon, z którego wszystkie powstają, był już zaakceptowany.

To samo deterministyczne narzędzie osiąga tę skalę na trzy sposoby, z których każdy daje identyczny, wcześniej zaakceptowany wynik:

- <!--i:people--> **Osoba, w aplikacji.** Siatka wsadowa `/pro`: wklej lub zaimportuj wiersze, otrzymaj jeden gotowy zasób na wiersz, pobierz archiwum zip. Bez umiejętności projektowych, bez zgłoszenia, bez czekania.
- <!--i:code--> **Deweloper, z linii poleceń.** CLI uruchamia *ten sam* silnik i *tę samą* ścieżkę renderowania bez interfejsu, więc narzędzie można wywołać sekwencyjnie dla wszystkich 10 000 wierszy w skrypcie lub nocnym pipeline'ie. Wywołanie `lolly <tool> --field=…` w pętli to cała integracja.
- <!--i:cpu--> **System lub agent AI, przez MCP.** To samo narzędzie obsługiwane programistycznie, z tą samą wiernością i jeszcze większą skalą - bo maszyna się nie znudzi, gdy napływają tysiące plików.

![Tryb wsadowy przy świeżej instalacji: jeden pusty wiersz czekający na narzędzie, z całą powierzchnią arkusza i przyciskiem Render już na miejscu, zanim pojawią się jakiekolwiek dane](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

Jeden zestaw ograniczeń marki, ustalony raz przez projektanta; trzy drogi do identycznego, wcześniej zaakceptowanego wyniku - a droga maszynowa skaluje się najdalej ze wszystkich, bo nigdy się nie męczy, gdy napływają pliki.

---

## Ogólny obraz: jak dopasowane są warstwy

Wszystko od tego miejsca w dół to architektura. Diagram pokazuje cały system w jednym widoku: narzędzia to
dane na górze, silnik pośrodku nie wie nic o żadnej platformie, powłoki poniżej niego
implementują jeden kontrakt, a katalogi dostarczają treść.

```
                ┌─────────────────────────────────────────────┐
                │              Tools (data, not code)         │
                │   tool.json + template.html + hooks.js?     │
                └─────────────────────────────────────────────┘
                                    ▲
                                    │ talks to via Capability Bridge v1
                                    ▼
                ┌─────────────────────────────────────────────┐
                │                  Engine                     │
                │   loader · validator · runtime · template   │
                │   inputs · url-mode                         │
                │   PLATFORM AGNOSTIC. Knows nothing of DOM,  │
                │   filesystem, or You.                       │
                └─────────────────────────────────────────────┘
                                    ▲
                                    │ implements HostV1
                                    ▼
        ┌──────────────┬──────────────┬──────────────┬──────────────┐
        │  Web Shell   │ Tauri Desktop│ Tauri Mobile │  CLI Shell   │
        │   (PWA)      │              │              │              │
        └──────────────┴──────────────┴──────────────┴──────────────┘
                                    ▲
                                    │ fetches from
                                    ▼
                ┌─────────────────────────────────────────────┐
                │              Catalogs                       │
                │   catalog/tools/index.json + tool dirs      │
                │   catalog/assets/index.json + asset files   │
                └─────────────────────────────────────────────┘
```

### Układ repozytorium

Treść jest zamontowana jako pakiety: `community/`, `docs/`, każdy `shells/*`, oba `services/*` oraz `brands/suse` są osobnymi repozytoriami, wypożyczonymi jako submoduły git tego repozytorium. Repozytorium nadrzędne jest właścicielem `engine/`, `schemas/`, `scripts/`, `tests/`, `api/`, `brands/lolly-start/` i `profiles.json`. Zobacz [Build Guide » Getting the source](/info/build-guide.html), by poznać polecenie checkout i przepływ pracy między repozytoriami.

```
lolly/
├── engine/           # Platform-agnostic core. Open source (MPL-2.0).
│   └── src/
│       ├── index.ts          # public surface - loader, runtime, template, inputs, url-mode
│       ├── loader.ts         # fetches and validates tool files
│       ├── runtime.ts        # orchestrates the 5-step lifecycle
│       ├── template.ts       # Handlebars hydration + annotateTemplate
│       ├── inputs.ts         # manifest → runtime input model
│       ├── url-mode.ts       # URL ↔ input state round-trip
│       ├── validate.ts       # JSON Schema validation of manifests
│       ├── compose.ts        # resolve nested tool renders (composes)
│       ├── embed.ts          # parse portable lolly.tools embed URLs
│       └── bridge/
│           └── host-v1.ts    # type re-export of the @lolly-tools/core contract
│
├── shells/
│   ├── web/          # PWA - hosted online; primary distribution
│   │   └── src/
│   │       ├── main.ts           # boot, routing
│   │       ├── theme.ts          # theme apply/persist (FOUC prevention)
│   │       ├── bridge/           # web implementations of HostV1 APIs
│   │       │   ├── index.ts      # compose all bridge pieces
│   │       │   ├── db.ts         # IndexedDB setup
│   │       │   ├── state.ts      # host.state - saved edits
│   │       │   ├── profile.ts    # host.profile - user details
│   │       │   ├── assets.ts     # host.assets - catalog + user uploads
│   │       │   ├── clipboard.ts  # host.clipboard
│   │       │   ├── export.ts     # host.export - rasterise/serialize
│   │       │   ├── net.ts        # host.net - allowlisted fetch
│   │       │   └── media.ts      # host.media - live camera frames (onFrame)
│   │       ├── catalog/
│   │       │   └── sync.ts       # boot-time catalog sync + offline cache
│   │       ├── styles/           # app-wide CSS (app.css, picker.css, tokens.css)
│   │       └── views/
│   │           ├── gallery.ts    # tool library listing + saved-state cards
│   │           ├── tool.ts       # mounts one tool (inputs + canvas + actions)
│   │           ├── picker.ts     # asset picker UI (invoked by host.assets)
│   │           ├── profile.ts    # user details editor
│   │           ├── projects.ts   # /p - folders of saved sessions (nested; folder/selection export)
│   │           └── free-canvas.ts # free-canvas editor overlay for render.layout:"editor" tools
│   │
│   ├── cli/          # Node.js CLI - same engine, headless jsdom
│   │   ├── bin/lolly.ts
│   │   └── src/
│   │       ├── run.ts    # loadTool → createRuntime → export → write file
│   │       └── bridge.ts # CLI implementation of HostV1
│   │
│   ├── tui/          # Interactive terminal shell (Ink) - reuses the CLI bridge
│   │   └── src/
│   │       ├── main.tsx  # full-screen app: Gallery / Projects / Profile / ToolView
│   │       └── bridge.ts # CLI bridge + on-disk state under ~/.lolly
│   │
│   ├── tauri-desktop/ # downloadable desktop app
│   └── tauri-mobile/  # iOS/Android app
│
├── tools/            # profile VIEW (gitignored) - data, not code. Merged from packs:
│                     #   community/ (public, brand-agnostic, MPL) + brands/<active>/tools (brand-owned).
│                     #   A SELECTION follows - the mounted set depends on the profile.
│   ├── qr-code/
│   ├── quotes/
│   ├── email-signature/
│   ├── snippet/
│   ├── countdown-timer/
│   ├── color-palette/
│   ├── color-block/           # typed/heterogeneous blocks (addMenu discriminator)
│   ├── dynamic-layout/
│   ├── tool-logo/         # "Logo" - auto-switching brand logo
│   ├── street-map/        # offline vector city-block maps
│   ├── url-shot/          # "URL Screenshot" (capture capability)
│   ├── strip-data/        # on-device metadata strip - JPEG/PNG/SVG/PDF (file in → clean file out)
│   ├── compress-pdf/      # on-device PDF compressor - recompresses images (file in → smaller file out)
│   ├── brand-lockup/      # "Brand Lockup" - SUSE logo lockups; HarfBuzz text-to-path (wasm)
│   ├── chart-creator/     # SVG charts from structured data
│   ├── filter/            # photo effects in one tool - halftone/scanline/posterize/voronoi (vector), duotone/pixel-stretch/imperfections (raster)
│   ├── meeting-planner/   # global timezone meeting scheduler
│   ├── calendar-ics/      # event → .ics calendar file plus a card
│   ├── digi-ad/           # "Animated Ad" - looping banner from scenes
│   ├── event-name-badge/  # conference badges - composes qr-code as an SVG
│   ├── wayfinding-signage/ # event signage; directions blocks auto-fit label text
│   ├── text-helper/       # on-device text workbench (format/decode/hash/de-identify)
│   ├── design/     # "Design" - freeform WYSIWYG editor canvas (render.layout: editor)
│   ├── multi-page-pdf/    # multi-page PDF document - cover, flowing content blocks, back page
│   ├── diagram-builder/   # org / layercake / process / cycle / pyramid diagrams
│   ├── logo-wall/         # many logos → auto-packed grid
│   ├── logo-lockup-partner/ # SUSE + partner co-brand lockup
│   ├── icon/          # favicon .ico / png / svg from text + colours
│   ├── lottie-digi-ad/    # animated Lottie ad banners
│   └── pose-geeko/        # pose the SUSE Geeko mascot - print-ready stills
│
├── catalog/
│   ├── tools/index.json        # tool registry
│   └── assets/
│       ├── index.json          # asset registry
│       └── suse/...            # logo, palette, etc.
│
├── schemas/          # JSON Schema for tool.json, asset entries, AssetRef
├── scripts/          # build-catalog-index.ts, checksum-assets.ts, validate-catalog.ts
├── tests/            # engine tests
└── docs/             # this file + authoring guides + positioning
```

---

## Model dostarczania platformy

Platforma działa na kilku powierzchniach - web PWA, Tauri desktop/mobile, skryptowalne CLI oraz interaktywne TUI. Wszystkie z nich używają tego samego silnika i tych samych plików narzędzi.

### Web (PWA) - główna dystrybucja
Hostowane pod adresem URL kontrolowanym przez SUSE. Działa offline, gdy tylko service worker zapisze w pamięci podręcznej narzędzia i zasoby. To tu większość pracowników, dostawców i partnerów będzie korzystać z platformy. Konto nie jest wymagane - stan jest przechowywany w IndexedDB na każdym urządzeniu.

Powłoka web jest responsywna z jednego układu. Na desktopie narzędzie to zmieniany rozmiarowo pasek boczny z elementami sterującymi obok sceny podglądu z nawigacją po płótnie natywną dla gładzika (Cmd/Ctrl-kółko lub uszczypnięcie, by powiększyć wokół kursora, Space- lub przeciąganie środkowym przyciskiem, by przesuwać, klawisze `0`/`1`/`+`/`−` oraz HUD Fit/%). Na urządzeniach mobilnych (≤640px) elementy sterujące zmieniają się w zakotwiczony u góry arkusz z uchwytem do przeciągania, który zatrzaskuje się w pozycji peek/half/full (dotknięcie przełącza) nad statycznym podglądem pełnoekranowym, a pływający przycisk **Render** otwiera elementy sterujące **Export** w wyskakującym arkuszu od dołu. Dotyk umożliwia uszczypnięcie do powiększenia i przeciąganie na podglądzie. Ścieżka renderowania i elementy sterujące eksportu są identyczne w obu przypadkach - zmienia się tylko układ interfejsu.

![Widok podzielony na desktopie - kontrolki generowane z manifestu po lewej, kanwa na żywo po prawej](/t/url-shot?url=%2F%23%2Ftool%2Fchart-creator&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=aud-web-split)

To samo narzędzie na szerokości telefonu, bez drugiego układu do utrzymywania: kontrolki stają się arkuszem u góry, podgląd zajmuje cały ekran, a pigułka renderowania unosi się nad nim.

![Audiogram na ekranie o szerokości 430 px - arkusz sterowania u góry, gotowa kwadratowa grafika poniżej oraz pływająca pigułka renderowania](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

**Tryb wsadowy (`/pro`).** Powłoka webowa udostępnia też siatkę wsadową w stylu arkusza kalkulacyjnego (`shells/web/src/pro/`), która renderuje wiele wierszy naraz w jednym lub wielu narzędziach. Obsługuje odczyt i zapis CSV/TSV oraz wklejanie z arkusza, per-wierszowy szablon/format/rozmiar/jednostkę/dpi, panel boczny edytora bloków z podglądem na żywo, zwijalne kolumny eksportu, pasek tagów "relevance" na wiersz, zmianę kolejności wierszy przez uchwyt przeciągania po lewej, dwuetapowe potwierdzenie usunięcia, zapisane sesje wsadowe i pobieranie w formacie `.zip`. To jest powierzchnia jeden-do-wielu stojąca za pozycjonowaniem "masowego generowania treści".

### Tauri desktop / mobile
Spakowana aplikacja natywna (mały rozmiar dzięki Tauri). Zapewnia pełną dostępność offline, dostęp do systemu plików dla narzędzi zależnych od CLI (PDF Smasher, Font Outliner) i dostęp do kamery. Rozszerzenie narzędzi zaplanowane na połowę 2026.

### CLI
`lolly <tool-id> [--input=value ...] --output=file.png`

Użytkownicy desktopu mogą wywoływać wiele narzędzi z terminala. Powłoka CLI ładuje ten sam silnik, tworzy DOM jsdom, uruchamia tę samą ścieżkę renderowania i zapisuje plik. Tryb URL jest transportem - CLI nie jest osobną implementacją. To gwarantuje, że wyniki CLI i GUI są identyczne.

```bash
lolly qr-code --url=https://suse.com --output=qr.svg
lolly quotes --quote="Ship it." --output=quote.png
lolly                        # lists available tools
lolly qr-code                # lists inputs for that tool
```

### TUI
`npm run tui`

Interaktywny odpowiednik CLI: pełnoekranowa aplikacja terminalowa sterowana klawiaturą (zbudowana na Ink) do przeglądania narzędzi, wypełniania danych wejściowych, zapisywania projektów i eksportowania - wszystko bez GUI. Jej most hosta **ponownie wykorzystuje implementację CLI** dla formatów bez DOM (SVG/EMF/EPS/HTML + tekst/dane) i dodaje stan na dysku pod `~/.lolly` oraz opcjonalny podgląd inline. Poza tym ma **warstwę renderowania w przeglądarce**: ograniczoną bezgłowe Chromium (to samo, które instaluje serwer MCP), które generuje raster/PDF/wideo i przechwytywanie URL na żądanie - napędzając zbudowaną kopię powłoki webowej, więc wynik jest identyczny, i uruchamiając się dopiero przy pierwszym eksporcie takiego formatu. Dzięki temu `url-shot` (z przycinaniem + zmianą kolorów + wektorowym PDF/SVG) i każde narzędzie raster/pdf działają też w terminalu. Zobacz [przewodnik TUI](/info/tui.html).

Niezależnie od tego, na jakiej powierzchni jesteś, zakładka Capabilities w panelu jest pełną mapą tego, co platforma deklaruje, że potrafi zrobić, pogrupowaną i czytelną bez otwierania choćby jednego narzędzia.

---

## Kategorie narzędzi

Narzędzia są oznaczane `category` w manifeście do grupowania w galerii.

Wiersze są wymienione w kolejności sekcji galerii. Sekcja `utility` zawsze renderuje się **jako ostatnia** w galerii (po każdej innej kategorii, w tym przyszłych) - to szuflada "Offline Utilities" działająca on-device.

| Kategoria | Przykłady | Planowane |
|---|---|---|
| `everyone` | QR Code Generator, Quote Card, Email Signature, Logo, Wordmark, Audiogram, Battlecards, Sequence Studio, Record | Employee Image Stationery |
| `designer` | Brand Lockup, Design, Chart, Darkroom, Filter, Pose Geeko, Multi-Page PDF | Font Outliner |
| `event` | Meeting Planner, Event Name Badge, Wayfinding Signage, Calendar ICS, Booth Studio | Event Stationery, Bulk Name Badges, Room Agenda Cards |
| `product` | - | CVE Alert, Product Release Announcement, Blog OG Image |
| `utility` | Strip Hidden Data, Text Helper, Compress PDF, Convert Image, Convert Font, Redact, Run Web Code, Screen Capture, URL Screenshot | Konwertery jednostek/formatów, więcej narzędzi prywatności działających na urządzeniu |

Te komórki to **przykłady, nie inwentarze**. To, jakie narzędzia istnieją, jest właściwością zamontowanego profilu, nie tej strony: pakiet marki dodaje własne i może wykluczyć narzędzie społecznościowe, którego wolałby nie dostarczać. `catalog/tools/index.json` - wygenerowany z manifestów, rejestr faktycznie odczytywany przez galerię - jest listą autorytatywną; aby policzyć, co montuje profil, policz manifesty (`ls community/*/tool.json brands/*/tools/*/tool.json`) zamiast ufać liczbie zapisanej tutaj. (Id narzędzia obecne w dwóch pakietach montuje się raz, z pakietu, który wygrywa.)

Narzędzia są też klasyfikowane według statusu: `official` (zatwierdzone przez markę, bez znaku wodnego), `community` (wkład zewnętrzny), `experimental` (eksporty ze znakiem wodnym). Większość biblioteki to `official`; nowsze studia i narzędzia przechwytywania mają zwykle status `community` lub `experimental`, dopóki się nie ustabilizują. Każda powierzchnia pokazuje odznakę, więc czytelnik wie, co bierze, zanim to otworzy - i, podobnie jak komórki kategorii powyżej, przynależność per-status zmienia się zbyt szybko, by ją tu wyliczać. Odczytaj ją z galerii lub wygenerowanego indeksu.

**Design** to pierwsze narzędzie zbudowane na wolnej kanwie `render.layout: "editor"` - bezchromowej powierzchni bezpośredniej manipulacji, na której przeciągasz, zmieniasz rozmiar, obracasz i przyciągasz boksy tekstu, kształtów i obrazów, a następnie eksportujesz tą samą ścieżką renderowania co każde inne narzędzie.

**Strip Hidden Data** to pierwsze narzędzie **on-device** (`privacy: "on-device"`): narzędzie transformujące treść, które bierze plik dostarczony *przez ciebie*, przetwarza go całkowicie w przeglądarce i oddaje czystą kopię - nigdy nie przesłaną, nigdy nie oznaczoną znakiem wodnym, bez ostemplowanej proweniencji. **Text Helper** jest drugie - warsztat on-device do codziennych zadań typu wklej-do-strony (formatowanie JSON, dekodowanie JWT, Base64, kodowanie/dekodowanie URL, haszowanie SHA). **Compress PDF** jest trzecie - zmniejsza PDF, rekompresując jego obrazy, znów całkowicie on-device. Znacznik i tekst jego odznaki "Runs on your device - nothing is uploaded" obejmują teraz cały zbiór transformacji: Strip Hidden Data, Text Helper, Compress PDF, **Convert Image** (HEIC/TIFF/AVIF → WebP/JPG/PNG), **Convert Font**, **Redact** (niszczenie obszarów obrazu, SVG lub PDF), **Prompt to Image** i **Rebrand a Deck** (zmiana motywu `.pptx` w miejscu), tam gdzie profil je montuje. To kategoria narzędzi prywatności, która zastępuje przekazywanie poufnych plików jednofunkcyjnym stronom.

![Szuflada Utilities, gdzie każda karta to narzędzie transformujące plik, który już masz](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=aud-utilities)

> Uwaga: `category` i `status` są zdenormalizowane do `catalog/tools/index.json` (rejestru odczytywanego przez galerię) z każdego `tool.json`. Manifest jest źródłem prawdy - indeks jest **generowany** przez `npm run build:catalog`, a `npm run validate:catalog` przerywa CI, jeśli zatwierdzony indeks odbiega od manifestów.

---

## Zobowiązania architektoniczne

Te decyzje są ustalone. Zmiana którejkolwiek z nich to poważne przedsięwzięcie - kształtują każdą inną decyzję w bazie kodu.

### 1. Deklaratywne narzędzia, z imperatywnym wyjściem awaryjnym

Narzędzie to manifest (`tool.json`) + szablon (`template.html`) + opcjonalne `hooks.js`.

**Manifest deklaruje dane wejściowe.** Nie szablon. Dane wejściowe nie są wywnioskowane z tokenów Handlebars. Manifest jest umową; szablon konsumuje nazwane zmienne przez `{{id}}`.

![Stos kontrolek Street Map - rozwijana lista miast, wybór motywu, suwaki grubości i wyzwalacze kolorów, każdy z nich narysowany z linii manifestu](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

**Hooki są opcjonalne.** Większość narzędzi jest czysto deklaratywna - manifest + szablon wystarczą. Narzędzia potrzebujące obliczonych wartości (kodowanie QR, kształtowanie danych wykresu) dostarczają `hooks.js` eksponujące nazwane funkcje cyklu życia (`onInit`, `onInput`, `onFrame` - hook per-klatkowy kamery na żywo dla narzędzi reagujących na ruch - `onLevel`, `beforeExport`, `afterExport`, `exportFile` - ścieżka transformacji plik-wejście/plik-wyjście używana przez narzędzia on-device jak Strip Hidden Data - i `exportStill`, dla narzędzia, które ma własny głęboki raster). Host ładuje hooki przez `new Function('host', …)` z mostem możliwości wstrzykniętym jako zasięg domknięcia. To jest **umowa przenośności, nie piaskownica bezpieczeństwa**: hooki wciąż działają w realmie strony i *mogą* sięgać po `window`/`fetch`/`document` w powłoce przeglądarkowej - `host.*` to wspierana, przenośna powierzchnia, nie wymuszona granica. Wyniki asynchronicznych hooków są ograniczone czasowo (`onInit` 5s, `onInput` 2s, `beforeExport`/`afterExport` 5s, `exportFile`/`exportStill` 10s), a spóźnione wyniki są odrzucane; rozbiegany *synchroniczny* hook nie może zostać wywłaszczony. Niezaufany kod hooków stron trzecich nie jest więc bezpieczny do uruchamiania, dopóki nie pojawi się izolacja Worker.

Ma to znaczenie, ponieważ: narzędzia deklaratywne mogą być autorowane przez osoby niebędące programistami. Gdyby każde narzędzie było aplikacją webową, ryzyko "ograniczone umiejętności do tworzenia/utrzymywania szablonów roboczych" stałoby się permanentnym wąskim gardłem.

### 2. Narzędzia i zasoby to dane, nie spakowany kod

Aplikacje web i Tauri pobierają katalogi narzędzi i zasobów ze znanego URL przy starcie, buforują je lokalnie i działają na tym, co tam jest. **Dodanie nowego kafelka wydarzenia lub sezonowego zasobu nie wymaga wydania aplikacji.**

Bajty zasobów są sumowane kontrolnie SHA-256, by zapobiec zatruciu CDN. `id` + `version` zasobu napędzają unieważnianie pamięci podręcznej.

### 3. Most Możliwości to jedyne API, jakie widzą narzędzia

Narzędzia nigdy nie dotykają DOM poza obszarem swojego szablonu, nigdy nie wywołują `fetch` bezpośrednio, nigdy nie odczytują systemu plików. Wywołują wersjonowane metody `host.*`. Kanoniczną definicją umowy jest `packages/core/src/host-v1.ts` - SDK dla autorów narzędzi `@lolly-tools/core`, dzięki czemu strona trzecia może budować na tym bez zależności od silnika; `engine/src/bridge/host-v1.ts` jest jego reeksportem typu, a kod silnika/powłok nadal importuje z tej samej ścieżki bez zmian:

| API mostu | Co robi |
|---|---|
| `host.profile` | Imię, e-mail, zdjęcie, miasto użytkownika itd. Wstępnie wypełnia dane wejściowe przez `bindToProfile`. |
| `host.assets` | Zapytania do katalogu, rozwiązywanie zasobów, UI wyboru dostarczane przez hosta. |
| `host.state` | Zapis / odczyt slotów danych wejściowych. IndexedDB na webie, system plików na Tauri, pamięć na CLI. |
| `host.clipboard` | Zapis tekstu lub obrazu do schowka (z fallbackami platformowymi). |
| `host.export` | Rasteryzuje lub serializuje cel renderowania. Nakłada znak wodny dla narzędzi eksperymentalnych. |
| `host.net` | Fetch z listy dozwolonych - dostępny tylko jeśli narzędzie zadeklarowało możliwość `"network"`. (Żadne dostarczane narzędzie obecnie tego nie używa.) |

Opcjonalne, addytywne powierzchnie pojawiają się tylko wtedy, gdy dostarcza je powłoka. Niektóre są **bramkowane możliwościami** - eksponowane tylko wtedy, gdy narzędzie zadeklaruje pasującą flagę: `host.compose` (osadzenie renderu innego narzędzia - `compose`), `host.capture` (przechwytywanie strony dla URL Screenshot - `capture`) i `host.recorder` (przechwytywanie mikrofonu/kamery/ekranu dla narzędzi nagrywających - `microphone` / `camera` / `screen`). Reszta jest **wykrywana funkcjonalnie** - obecna zawsze, gdy powłoka może ją dostarczyć, przy czym narzędzie zachowuje fallback dla powłok, które nie mogą.

Garść flagowych powierzchni, by pokazać zakres - [Host API](/info/host-api.html) dokumentuje każdą z nich, a `packages/core/src/host-v1.ts` jest samą umową:

| Interfejs | Od wersji | Co dodaje |
|---|---|---|
| `host.tokens` | 1.0 | Tokeny projektowe DTCG - własne prymitywy marki |
| `host.text` | 1.0 | Zamiana tekstu na ścieżki przez HarfBuzz WASM (flaga możliwości `wasm` oznacza narzędzia, które z tego korzystają) |
| `host.media` | 1.4 | Klatki z kamery na żywo napędzające hook `onFrame`. Stopniowe udoskonalenie, celowo *nie* uzależnione od flagi `camera` - takie narzędzie nadal działa jako zwykłe narzędzie do nieruchomych obrazów |
| `host.color` | 1.40 | Percepcyjna matematyka koloru: ΔEOK, kontrast WCAG + APCA, rampy OKLab, podziały na klasy, palety kategoryczne, schematy harmonii (1.60), mieszanie CSS Color 4 i wypalanie gradientów (1.68). Czyste i synchroniczne - powłoki dołączają `makeColorApi()` silnika zamiast czegokolwiek implementować, więc nie może dojść do rozjazdu |
| `host.images` | 1.60 | Dekodowanie / zmiana rozmiaru / ponowne kodowanie bajtów na urządzeniu - ścieżka konwersji (HEIC → JPEG, kompresja do WebP, pomniejszanie). Dostarczane w powłoce webowej jako leniwa fasada, więc dekoder HEIC nigdy nie trafia do fragmentu startowego |
| `host.geom` | 1.64 | Dokładna geometria wektorowa: operacje logiczne na ścieżkach, offsetowanie, zamiana obrysu na wypełnienie, obniżanie splajnów, uproszczanie, wykrywanie trafień. Także czyste, synchroniczne i dołączane z silnika (`makeGeomApi()`); błędy są *zwracane*, nigdy nie rzucane |

Reszta stosuje się do tych samych zasad i jest dokumentowana obok nich: `pdf` (1.8) i `pptx` (1.58) do chirurgii dokumentów on-device, `audio` (1.71) i `speech` (1.96) do analizy klipów i TTS/transkrypcji on-device, `viz` (1.72) do umowy zastępczej MilkDrop, `codec` (1.100) i `layers` (1.102) do wyjścia głębokich bitów i warstwowej mapy bitowej, `upscale` (1.101) i `matte` (1.103) do modeli on-device, `raster` (1.105) dla hooków wykonujących własną pracę na pikselach, `connectors` (1.106) dla strzałek bezpiecznych przy eksporcie i `c2pa` (1.85) do podpisywania gotowych bajtów. Liczba rośnie; zasady nie.

Deklarowalne możliwości to: `network`, `filesystem`, `clipboard`, `camera`, `microphone`, `screen`, `ffmpeg`, `wasm`, `capture`, `compose`. (`screen`, dodana w 1.54, to przechwytywanie ekranu przez `host.recorder` - użytkownik wybiera ekran/okno/kartę w natywnym UI przeglądarki; różni się od `capture`, które rasteryzuje URL nazwany przez samo narzędzie.)

To samo narzędzie działa w przeglądarce, Tauri i bezgłowym CLI, ponieważ każda powłoka implementuje ten interfejs - narzędzie nigdy nie wie, w której jest.

Most jest wersjonowany. Dodanie metod to wersja pomniejsza. Usunięcie lub zmiana sygnatur to skok wersji głównej. Gdy wyjdzie v2, v1 musi nadal działać.

### 4. Id zasobów są wieczne

`suse/logo/primary` to umowa. Po opublikowaniu:
- Id nigdy się nie zmienia, nigdy nie jest ponownie używane.
- Zmiana bajtów → podbij `version` w manifeście.
- Zastąpione nowym zasobem → ustaw `deprecated: true` i opcjonalnie `replacedBy`.
- Istniejące odwołania zawsze się rozwiązują.

To sprawia, że zapisane stany narzędzi i linki dzielone przez URL są trwałe przez lata.

### 5. Tryb URL jest pierwszorzędny

Każde dane wejściowe muszą dać się wyrazić jako parametr URL:

```
lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H
```

![Ten link sam w sobie, bez niczego więcej, jest gotowym zasobem](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fsuse.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Tryb CLI to tryb URL pod innym transportem - powłoka CLI buduje obiekt stanu URL z argv i uruchamia **ten sam** potok silnika. Istnieje jedna ścieżka renderowania. CLI nie może dryfować od GUI, bo nie jest osobną implementacją.

`url-mode.ts` obsługuje przejazd tam i z powrotem (parsowanie i serializację). Zbiór **zarezerwowanych parametrów** nigdy nie jest przekazywany do narzędzia jako dane wejściowe: kontrolki wyjścia (`format`, `export`, `copy`, `filename`, `width`/`w`, `height`/`h`, `unit`, `dpi`), pokrętła druku i proweniencji (`bleed`, `marks`, `profile`, `password`, `c2pa`, `imprint`, `durable`, `meta`, `hdr`, `depth`, `cuts`) i nośniki stanu (`template`, `z` - spakowany token "Shortest link" - oraz `zx`, ten sam zaszyfrowany hasłem). Zbiór `RESERVED` w `engine/src/url-mode.ts` jest autorytetem i jest przypięty testem; [Tryb URL](/info/url-mode.html) dokumentuje każdy z nich, w tym garść niewymienionych tutaj. Dane wejściowe zasobów w trybie URL są serializowane przez ich `id`; runtime rozwiązuje je przez `host.assets.get()` przed hydratacją. `width`/`height` to wartości w `unit` (domyślnie `px`, także `mm`/`cm`/`in`/`pt`/`pc`); przy jednostce fizycznej `dpi` ustawia rozdzielczość rastra. Ustawiają rozmiar dokumentu kanwy i wstępnie wypełniają panel wymiarów eksportu.

Ponieważ każde dane wejściowe podróżują w linku, zmiana parametru to inny gotowy zasób. Cała ta paleta to jeden kolor bazowy, harmonia i liczba kroków:

![Dziewięć kroków w czterech odcieniach, wszystkie wyrosłe z pojedynczego koloru bazowego przekazanego w linku](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

### 6. Przechowywanie danych odbywa się przez mostek, nie bezpośrednio

Web shell: IndexedDB. Tauri: system plików. CLI: pamięć tymczasowa. Narzędzia widzą tylko `host.state.save(slot, data)` i `host.state.load(slot)`. `localStorage` nie jest używany - jest zbyt mały i nie może przechowywać blobów.

Użytkownicy mogą zapisać wiele nazwanych slotów edycji dla każdego narzędzia i wrócić do każdej sesji później. Nie jest wymagane zakładanie konta; stan jest przechowywany lokalnie na urządzeniu. Ponieważ mostek jest jedynym punktem styku, ten lokalny stan jest też *przenośny*: `shells/web/src/data-transfer.ts` odczytuje wszystko z powrotem przez `host.profile`/`host.state`/`host.assets` do jednego pliku zip `lolly-backup`, który można zaimportować w dowolnej innej instalacji - offline'owa odpowiedź na "przeniesienie na nowe urządzenie", niewymagająca serwera (pełna specyfikacja: `docs/data-transfer.md`). Integracja z SUSE ID (synchronizacja wielourządzeniowa) to przyszły etap budowany na tej podstawie.

### 7. Znaczniki dojrzałości z założenia odpowiadają na ryzyko "zatwierdzenia przez markę"

Każde narzędzie deklaruje `status: official | community | experimental` w swoim manifeście. Galeria sortuje według statusu. Narzędzia eksperymentalne automatycznie znakują swoje eksporty znakiem wodnym - znak wodny jest nakładany przez `host.export.render`, a nie przez narzędzie, więc autor narzędzia niebędącego oficjalnym nie może z niego zrezygnować.

To strukturalna odpowiedź na ryzyko odbioru, że użycie dowolnego narzędzia sugeruje zatwierdzenie przez markę. Odpowiedzi procesowe (kolejka recenzji, bramkowanie przez SUSE ID) nakładają się na to dodatkowo.

### 8. Dane wejściowe narzędzia są typowane poprzez manifest, w tym zasoby

Dane wejściowe deklarują `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` i `file`. Host renderuje generyczną kontrolkę dla każdego typu na podstawie manifestu - narzędzia nie piszą ani jednej linii kodu kontrolek. (Wstępne wypełnianie z profilu użytkownika nie jest typem - każde pole wejściowe może mieć `bindToProfile`.) Trzy z nich mają większe znaczenie niż pozostałe:

- **`asset`** (z `filter` i `allowUpload`) to mostek do globalnego systemu zasobów; `allowUpload: false` to dźwignia egzekwowania marki dla rzeczy takich jak logotypy w kafelkach sponsorskich, gdzie dozwolone są tylko zasoby z biblioteki. Przesłane przez użytkownika pliki mają tę samą strukturę `AssetRef` co zasoby biblioteczne, więc narzędzia obsługują je identycznie.
- **`blocks`** to powtarzalna grupa pól - mini-tabela wewnątrz jednego pola wejściowego, edytowana w panelu bocznym, z typowanym/rozróżnianym menu dodawania i polami zasobów dla każdego bloku. Kliknięcie wyrenderowanego bloku na canvasie ustawia fokus na wierszu tego bloku. Używane przez `meeting-planner`, `chart-creator`, `event-name-badge`, `wayfinding-signage`, `color-block` i `digi-ad`.
- **`vector`** grupuje ustalony zestaw liczb (np. transformację) w jedną złożoną kontrolkę; **`file`** przechowuje własny plik użytkownika jako bajty w pamięci dla narzędzi transformujących na urządzeniu (np. `strip-data` i `compress-pdf`).

### 9. Szablony są bezlogikowe (Handlebars, nie EJS)

Handlebars został wybrany zamiast EJS celowo:
- Bezlogikowy. Szablony mogą tworzyć osoby niebędące programistami.
- Bezpieczny domyślnie. `{{x}}` koduje HTML; `{{{x}}}` to opcjonalny surowy tryb.
- Brak dowolnego JS w szablonach oznacza brak powierzchni audytu XSS dla każdego szablonu.

Logika żyje w `hooks.js`, gdzie jest jawna i możliwa do zrecenzowania. Dostępne helpery Handlebars: `{{default}}`, `{{upper}}`, `{{lower}}`, `{{eq}}`, `{{markdown}}`, `{{asset ref}}`, `{{asset ref "property"}}` (a także helpery formatowania danych `icsStamp`/`rfcText`/`csvCell` używane przez towarzyszące szablony `.ics`/`.vcf`/`.csv`).

### 10. Narzędzia komponują narzędzia

Narzędzie może osadzić render **innego** narzędzia bez importów między narzędziami - kompozycja jest rozwiązywana przez silnik, nigdy przez kod narzędzia. Istnieją dwie powierzchnie:

- **Deklaratywny manifest** - `composes: [{ id, tool, inputs, format?, width?, height? }]`. Silnik renderuje nazwane dziecko i umieszcza wynik w bezlogikowym szablonie jako `{{asset <id>}}`. `event-name-badge` komponuje dziś `qr-code` jako SVG.
- **Przenośny adres URL osadzenia** - `<img src="https://lolly.tools/tool/<id>.<ext>?<inputs>">`. Powłoka renderuje to dziecko **lokalnie** (do czasu rozwiązania lokalnego renderu widoczny jest piksel zastępczy); nic nigdy nie jest pobierane z `lolly.tools`.

Można komponować render dowolnego narzędzia: dziecko w formacie **SVG** pozostaje prawdziwym wektorem, gdy rodzic eksportuje do SVG lub PDF, i rasteryzuje się ostro dla PNG; dzieci **PNG/JPG/WEBP** osadzają się jako obrazy. Wymaga możliwości `compose`. Skomponowane dzieci są elementami pośrednimi - nigdy nie są znakowane wodnie ani stemplowane pochodzeniem - a kompozycja degraduje się łagodnie: powłoka, która nie potrafi wyrenderować dziecka, po prostu pomija to miejsce, a rodzic i tak się renderuje.

---

## Czego celowo nie zrobiliśmy

- **Brak EJS / brak dowolnego JS w szablonach.** Powierzchnia ataku XSS wynosi zero. Logika mieszka w `hooks.js`.
- **Brak obowiązkowego CMS-a zasobów.** Poszczególne osoby wprowadzają własne pliki kreatywne prosto do swojego katalogu w aplikacji (widok [Katalog](/info/using.html) oraz Brand Studio) - bez serwera, bez konsoli administracyjnej. Praca jest przekazywana dalej jako **sesja**: link udostępniający niesie cały stan, a ta sama sesja podróżuje w kopii zapasowej lub przez sesję współpracy. Kto kontroluje wdrożenie, może następnie zablokować udostępnioną sesję jako **szablon** - otworzyć link, zapisać jego wartości jako wpis szablonu w katalogu tego narzędzia w paczce marki i zatwierdzić commitem - po czym pojawia się on w selektorze narzędzia "New from template" i jest dostępny przez głęboki link jako `?template=<id>`. Git jest krokiem blokującym po stronie właściciela wdrożenia, nigdy twórcy. Dla katalogu *współdzielonego i zarządzanego* organizacja **może** zarządzać katalogiem zasobów w ten sam sposób i bramkować aktualizacje przez przegląd PR - to dostępny model zarządzania, a nie wymóg aplikacji.
- **Brak wymuszonego RBAC.** Otwarta aplikacja jest domyślnie publicznie dostępna; ryzyko dla marki zarządzane jest przez znaczniki dojrzałości i znaki wodne. Organizacja, która chce ściślejszej kontroli, dokłada własne uwierzytelnianie oraz katalog recenzowany przez git opisany wyżej.
- **Brak centralnej bazy danych.** Cały stan użytkownika jest przypisany do urządzenia. Integracja z SUSE ID jest w planach, ale nie blokuje startu.
- **Brak wspólnej ścieżki kodu narzędzi/silnika.** Silnik jest open source, podobnie jak narzędzia niezależne od marki w `community/`; paczka marki, taka jak prywatna `brands/suse/`, niesie własne narzędzia i katalog na własnych warunkach. Tak czy inaczej rozdzielenie jest egzekwowane (brak importów krzyżowych z `engine/` do treści narzędzi), więc podział pozostaje czysty.

---

## Cykl życia od początku do końca

Użytkownik otwiera `lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H`:

1. **Uruchomienie.** Powłoka webowa otwiera IndexedDB, buduje mostek możliwości, synchronizuje katalogi narzędzi i zasobów (lub wczytuje z pamięci podręcznej offline).
2. **Routing.** Fragment URL → widok `tool`, z wyodrębnionymi `qr-code` i parametrami URL.
3. **Wczytanie.** `loadTool('qr-code', fetchFile)` pobiera `tool.json`, waliduje go względem schematu JSON, pobiera `template.html`, `styles.css` i kod źródłowy `hooks.js`.
4. **Parsowanie stanu URL.** `parseUrlState` tłumaczy parametry URL na początkowe wartości pól wejściowych. Referencje zasobów (`?logo=suse/logo/primary`) są parsowane jako lekkie obiekty `{ id, _unresolved: true }`.
5. **Środowisko wykonawcze.** `createRuntime(tool, host, initialValues)` buduje model danych wejściowych (łącząc dane profilu, wartości domyślne i wartości początkowe), rozwiązuje referencje zasobów przez `host.assets.get()`, wczytuje hooki (`host` w zasięgu domknięcia, bez piaskownicy), wywołuje `hooks.onInit`.
6. **Renderowanie.** Powłoka subskrybuje środowisko wykonawcze; przy każdej zmianie stanu otrzymuje `{ model, hydrated }`. Renderuje kontrolki wejściowe na podstawie modelu i zapisuje uwodnioną treść HTML szablonu do `#tool-canvas`.
7. **Interakcja.** Użytkownik wpisuje w pole wejściowe → `runtime.setInput(id, value)` → zastosowanie ograniczeń → wywołanie `hooks.onInput` → ponowne uwodnienie → ponowne renderowanie. Canvas aktualizuje się na żywo.
8. **Eksport.** Użytkownik klika Download(PNG) → `runtime.export(canvasNode, 'png')` → `host.export.render` (rasteryzuje przez dom-to-image-more; SVG/PDF przechodzą przez dedykowane wektoryzatory przechodzące drzewo DOM) → blob → `host.export.download`. Zakres formatów, na które narzędzie może się zdecydować, jest szeroki, a wyliczenie `render.formats` w `schemas/tool.schema.json` jest tu autorytatywnym źródłem - rastry i rastry zmiennoprzecinkowe, wektory i pliki do wycinania, druk/CMYK, ruch, edytowalne dokumenty (`pptx`, `docx`, `odt`), palety oraz dane/wyjścia tekstowe, pliki audio i fontów. [Tryb URL](/info/url-mode.html) wymienia każdy identyfikator i to, co produkuje. Audio jest w tym wyliczeniu tak jak wszystko inne (`wav`, `mp3`, `m4a`, `opus`, deklarowane przez audiogram i narzędzia nagrywające); niezależnie od tego tryb `render.capture` narzędzia nagrywającego steruje `host.recorder`, którego nagranie przychodzi jako gotowy Blob w dowolnym kontenerze, w jakim nagrała je przeglądarka. (Narzędzia, które ustawiają `render.export: false` - np. Color Palette, Countdown Timer, Strip Hidden Data, Text Helper, Compress PDF - ukrywają kontrolki pobierania/formatu/wymiarów.) Jednostki fizyczne są tu konwertowane dla każdego formatu (PDF → prawdziwe punkty strony, raster → piksele przy DPI z fragmentem `pHYs`). Metadane autorstwa/pochodzenia (autor, narzędzie, źródło - budowane przez `engine/src/metadata.ts`) są osadzane dla każdego formatu: PNG iTXt, JPEG EXIF, słownik informacyjny PDF, SVG `<metadata>`, komentarz GIF. Narzędzia eksperymentalne otrzymują znak wodny wstawiany przez host, nie przez narzędzie.

![Panel eksportu otwierany przez `?options`: para nazwa pliku i format, rozmiar wyjściowy oraz kontrolki zapisujące plik](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Ten sam cykl życia w Tauri. Ten sam cykl życia w CLI - jsdom dostarcza bezgłowy DOM; wynik trafia do pliku lub na stdout.

---

## Status open source

**Kod jest na licencji MPL-2.0.** `engine/`, `shells/*`, `services/*`, `schemas/` i `docs/` są open source na licencji **MPL-2.0** - neutralna wobec dostawców platforma szkieletowa dla narzędzi marki, z każdą jednostką wydawniczą we własnym repozytorium pod [github.com/lolly-tools](https://github.com/lolly-tools).

**Treść narzędzi jest dostarczana jako paczki marki**, każda na własnych warunkach (zobacz `NOTICE.md` danej paczki). `community/` to publiczne repozytorium [`lolly-tools`](https://github.com/lolly-tools/lolly-tools), a jego narzędzia niezależne od marki także są na licencji MPL-2.0. `brands/suse/` to prywatna paczka `suse-lolly`: narzędzia SUSE i katalog SUSE, **własność SUSE**, w tym licencjonowana muzyka PremiumBeat. `brands/lolly-start/` to pusta marka startowa, której właścicielem jest to repozytorium. Czcionki są dostarczane wewnątrz paczki na licencji **SIL Open Font License 1.1** - paczka SUSE niesie kroje SUSE i SUSE Mono.

`tools/` i `catalog/` w katalogu głównym repozytorium to ignorowane przez git *widoki*: profil składa je z `community/` oraz aktywnej paczki marki, dlatego każdy skrypt i każda powłoka odczytują te dwie ścieżki, nigdy paczkę bezpośrednio.

Podział jest egzekwowany - nie ma importów krzyżowych z `engine/` do treści narzędzi - dzięki czemu granica między platformą a treścią pozostaje czysta.

---

## Gdzie kończy się silnik, a zaczyna host

Jeśli da się to opisać w czystych danych + Handlebars → **silnik**.
Jeśli dotyka DOM, systemu plików, sieci lub dowolnego API przeglądarki/systemu operacyjnego → **host**.

Ta granica jest celowo ostra. Silnik to część open source. Wszystko, co wie o SUSE, konkretnych platformach czy środowiskach uruchomieniowych, pozostaje poza nim.

Kolejny poziom szczegółów: [`engine/README.md`](../engine/README.md) wymienia każdy moduł silnika i za co odpowiada, a [Model zagrożeń i granice zaufania](/info/threat-model.html) opisuje, gdzie ta sama granica jest jednocześnie granicą zaufania.
