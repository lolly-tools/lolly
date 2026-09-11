# Transfer danych - paczka `lolly-backup`

Wszystko, co gromadzi użytkownik Lolly, znajduje się **na jego urządzeniu** - bez konta, bez chmury. Paczka transferu danych to sposób, w jaki ta wartość się przemieszcza: eksportujesz ją na jednej instalacji, przenosisz plik dowolną metodą (USB, AirDrop, e-mail do siebie, udział sieciowy) i importujesz na drugiej. Plik *jest* transportem. Cel może być offline lub online. Nie ma to znaczenia, bo nic nigdy nie łączy się z serwerem.

![Dwa przyciski przenoszące całą instalację: Eksportuj moje dane zapisuje jeden plik zip, Importuj dane wczytuje go z powrotem](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Ta strona to specyfikacja formatu. Instrukcję dla użytkownika końcowego znajdziesz w [Using Lolly → Moving to another device](/info/using.html). Implementacja to [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts), a [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) zabezpiecza kontrakt pełnego cyklu import/eksport.

> **Zakres.** Paczka niesie *dane użytkownika*, nie narzędzia. Narzędzia i zasoby katalogu są synchronizowane osobno i zakłada się, że już znajdują się na urządzeniu docelowym (w najgorszym razie w nowszej wersji). Import nigdy nie instaluje ani nie aktualizuje narzędzia.

## Cele

- <!--i:box--> **Jeden format, każda powłoka.** Te same bajty są tworzone i odczytywane przez web PWA, aplikacje desktopowe/mobilne Tauri i każdą przyszłą powłokę. Paczka jest kontraktem. Most możliwości każdej powłoki to stojący za tym adapter dla danej platformy.
- <!--i:shieldcheck--> **Przetrwa podróż.** Paczka uszkodzona lub obcięta w transporcie kończy się głośnym błędem przy imporcie, nigdy częściowym przywróceniem.
- <!--i:clock--> **Przeżyje tę wersję.** Starsza aplikacja nadal może zaimportować rozpoznane części nowszej paczki. Naprawdę niekompatybilny format jest odrzucany w sposób czysty.
- <!--i:check--> **Bezpieczne łączenie.** Import na instalację, która jest już w użyciu, nigdy nie kasuje niczego, czego nie było w paczce.

## Koperta

Paczka to zwykły plik `.zip`. Pobrany plik jest nazwany na cześć osoby, do której należy - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (na przykład `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - dzięki czemu folder Downloads z kopiami zapasowymi pozostaje czytelny. Części imienia i nazwiska pochodzą z profilu i są pomijane, gdy nie są ustawione. Brak profilu daje `LollyTools-2026-06-26-1.zip`, a samo imię daje `LollyTools-Ada-2026-06-26-1.zip`. Każda część jest sanityzowana do tokenu bezpiecznego dla nazwy pliku (zachowywane są litery i cyfry Unicode, spacje i znaki interpunkcyjne są usuwane, maksymalnie 32 znaki). `<n>` to sekwencja liczona dziennie, na urządzenie, dzięki czemu powtórzone eksporty tego samego dnia nie kolidują ze sobą i zachowują kolejność. Nazwę tworzy `backupFilename()` w [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts). Zawartość pliku zip jest identyczna niezależnie od nazwy. W środku:

| Ścieżka | Wymagane | Zawartość |
|---|---|---|
| `manifest.json` | tak | Identyfikator formatu, wersje, liczniki i integralność poszczególnych części. Pierwsza rzecz, na którą patrzy czytnik. |
| `profile.json` | gdy ustawiony | Rekord `me` użytkownika (imię i nazwisko, kontakt, odniesienie do zdjęcia, flagi). Odczytywany przez `host.profile`. |
| `sessions.json` | tak | Każda zapisana sesja: slot, identyfikator/wersja narzędzia, etykieta, miniatura (data-URL) i pełne dane wejściowe. Odczytywana przez `host.state`. |
| `assets.json` | tak | Metadane każdego przesłanego zasobu (obrazy, czcionki, tokeny marki), z których każdy wskazuje swoje bajty pod `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | na zasób | Surowe bajty zasobu (pliki obrazów i czcionek). Przechowywane bez kompresji (formaty już skompresowane). Rozszerzenie jest kosmetyczne. Rozstrzyga typ MIME w `assets.json`. |
| `prefs.json` | tak | Lokalne preferencje należące do użytkownika: `theme`, `sidebarWidth` i licznik aktywności `ct-metrics`. |
| `lolly.txt` | tak | Czytelne dla człowieka podsumowanie paczki (liczniki, profil, nazwa pliku) dla każdego, kto otworzy zip bez Lolly. Regenerowane przy każdym eksporcie i rozpoznawane przy imporcie, więc nigdy nie liczy się jako pominięta część. Jest zapisywane *po* mapie integralności, więc pozostaje poza nią. |

Paczka jest celowo zwykłym zipem: przetrwa nienaruszona każdy transport, a każde narzędzie do rozpakowywania może ją sprawdzić.

`profile.json` to najmniejsza część i ta, którą czytnik widzi jako pierwszą w aplikacji: dane, które twórca wypełnia raz, plus zgoda pozwalająca narzędziom z nich korzystać.

![Formularz danych profilu, który staje się profile.json - imię i nazwisko, kontakt, zdjęcie i zgoda obok nich](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 1,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.webp": "sha256-…",
    "prefs.json": "sha256-…"
  }
}
```

| Pole | Znaczenie |
|---|---|
| `format` | Zawsze `lolly-backup`. Plik bez tego pola jest odrzucany jako "nie jest kopią zapasową Lolly". |
| `formatVersion` | Układ, w jakim ta paczka została **zapisana**. Zwiększana przy każdej zmianie zestawu części lub ich kształtu. Czytniki **nie** blokują importu na jej podstawie. |
| `minReader` | Minimalna wersja czytnika wymagana do **bezpiecznego** zaimportowania tej paczki. To na tym polu czytniki blokują import. |
| `app` | Identyfikator aplikacji tworzącej, do celów diagnostycznych. |
| `exportedAt` | Znacznik czasu ISO utworzenia paczki. |
| `counts` | To, co umieścił twórca, do wyświetlania i kontroli poprawności. |
| `integrity` | Opcjonalne. Mapuje każdą część oprócz `manifest.json` na skrót w stylu SRI `sha256-<base64>` jej **nieskompresowanych** bajtów. |

## Polityka wersji (kompatybilność w przód)

Podział między `formatVersion` a `minReader` pozwala formatowi się rozwijać bez pozostawiania starszych instalacji bez wsparcia:

- Czytnik importuje paczkę, gdy `manifest.minReader ≤` jego własna wersja czytnika. Odmawia (z komunikatem "needs a newer version of the app") tylko wtedy, gdy paczka wprost wymaga nowszego czytnika.
- Zmiana **addytywna** - nowa część *opcjonalna* albo nowe opcjonalne pole manifestu - zwiększa `formatVersion`, ale pozostawia `minReader` bez zmian. Starsze aplikacje nadal importują każdą rozpoznaną część. Nierozpoznane części są pomijane (patrz niżej), a nie po cichu odrzucane.
- Zmiana **niekompatybilna** - taka, w której błędny import części uszkadza dane, albo w której wcześniej opcjonalna część staje się obowiązkowa - podnosi `minReader`. Starsze aplikacje wtedy odmawiają importu w sposób czysty, zamiast importować coś, czego nie potrafią obsłużyć.
- Jeśli przyszła paczka ustawia `formatVersion`, ale pomija `minReader`, czytniki ostrożnościowo blokują import na podstawie `formatVersion` (traktując zmianę jako niekompatybilną).

> **Praktyczna zasada dla autorów:** jeśli każdy istniejący czytnik nadal zachowa się poprawnie, ignorując twoje dodanie, jest to zmiana addytywna - zwiększ `formatVersion`, zostaw `minReader`. W przeciwnym razie podnieś `minReader`.

## Integralność

Gdy obecne jest `manifest.integrity`, czytnik weryfikuje SHA-256 każdej wymienionej części **zanim cokolwiek zapisze**. Niezgodność ("failed its integrity check") lub brakująca część ("incomplete") przerywa cały import - nie ma częściowego przywracania. Wychwytuje to uszkodzenia, jakie może wprowadzić transport pliku (obcięty AirDrop, bramka e-mail, która ponownie zakodowała załącznik, wadliwy sektor USB).

Integralność jest celowo najlepszym możliwym staraniem: jest zapisywana tylko tam, gdzie dostępne jest Web Crypto (każdy bezpieczny kontekst przeglądarki i nowoczesny Node), i weryfikowana tylko wtedy, gdy obecne są zarówno mapa, jak i Web Crypto. Paczka bez mapy - na przykład sprzed istnienia integralności - importuje się bez zmian. "Nie można zweryfikować" nigdy nie jest traktowane jako "uszkodzone".

Manifest nie wymienia ani samego siebie, ani regenerowanego pliku README `lolly.txt`. Skróty obejmują części, za które manifest ręczy.

## Semantyka importu

Import to **scalanie z nadpisywaniem**, nigdy pełne zastąpienie:

- Istniejące dane na urządzeniu docelowym pozostają nietknięte.
- Każdy klucz, który koliduje - profil, slot sesji, identyfikator przesłanego obrazu - jest zastępowany kopią z importu.
- Nic, czego nie było w paczce, nie zostaje naruszone. Sesja, którą miało urządzenie docelowe, a której nie było w paczce, przetrwa import.

Zapisane sesje automatycznie ponownie łączą się ze swoimi obrazami: odniesienia do zasobów są przechowywane po identyfikatorze, a most ponownie je rozwiązuje po przywróceniu przesłanych obrazów (i tak musi to zrobić, bo adresy `blob:` nie przetrwają przeładowania).

Podsumowanie importu zgłasza `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`. `failedAssets` liczy przesłane zasoby, których nie udało się przywrócić (na przykład pełna pamięć urządzenia). To coś innego niż `skipped`, które liczy części od nowszego, kompatybilnego wstecz zapisywacza, jakich ta wersja nie rozpoznała. Interfejs pokazuje `skipped` ("… · N nowszych elementów pominiętych"), więc przywracanie jest szczere co do tego, co zostawiło w tyle.

## Co nie jest przenoszone

- **Pamięci podręczne katalogu** (pobrane metadane i bajty zasobów, indeks narzędzi) - ponownie synchronizowane bezkosztowo na urządzeniu docelowym.
- **Narzędzia i zasoby marki** - poza zakresem, zakłada się, że już są obecne na urządzeniu docelowym.
- **Adresy `blob:` / object URL** - regenerowane przez most przy wczytywaniu.
- **Licznik sekwencji eksportu** - dzienny licznik nazewnictwa pobrań (klucz `localStorage` `lolly-export-seq`) to lokalna wygoda nazewnicza. Jest utrzymywany poza `PREF_KEYS`, więc nigdy nie jedzie w paczce.

Miernik pamięci wylicza ten sam podział. Zapisane sesje i Moje obrazy jadą w paczce. Pamięć podręczna zasobów, podglądy narzędzi i przypięcia offline poniżej nich są w pełni odtwarzalne, więc zostają na miejscu.

![Miernik pamięci dzielący dane tego urządzenia na nazwane kategorie, z Saved sessions i My images śledzonymi osobno od Asset cache, tutaj na świeżej instalacji, gdzie każda kategoria jest wciąż pusta](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=.store-manages%2C.storage-subsection%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&walker=1&dark=1&filename=ce-storage-categories)

## Gwarancja między powłokami

`data-transfer.ts` odczytuje i zapisuje wyłącznie przez mostek możliwości (`host.profile`, `host.state`, `host.assets`) oraz wspólne preferencje `localStorage`. Ponieważ mostek jest jedynym punktem styku, *ten sam* moduł tworzy bajt-po-bajcie identyczny pakiet na każdej powłoce, mimo że warstwa przechowywania jest inna - IndexedDB w wersji webowej, system plików w Tauri. Powłoki Tauri używają tego modułu bez zmian. Różni się tylko ich implementacja `host.state`. Test bezgłowy sprawdza pełny cykl odczytu/zapisu na mostku w pamięci, dlatego reprezentuje wszystkie pozostałe.

Dwie powłoki znajdują się poza tą gwarancją, z różnych powodów:

- **Jednorazowy CLI** nie ma nic do przeniesienia - jego stan istnieje w pamięci i jest ulotny w obrębie jednego uruchomienia.
- **TUI** rzeczywiście utrwala stan (`~/.lolly`: sesje, foldery, profil), a jego widok Profil może go zbackupować, ale zapisuje *prostsze* archiwum własnego formatu: `sessions/<slot>.json` na sesję plus `profile.json` i `folders.json`, bez manifestu, bez `formatVersion`/`minReader` i bez mapy integralności. **Nie** da się go zaimportować w tym formacie - czytnik odrzuca je jako "nie jest to kopia zapasowa Lolly" - i myląco używa podobnej nazwy (`lolly-backup-<stamp>.zip`). Ujednolicenie obu jest znaną luką.

## Zarezerwowane punkty rozszerzeń

Koperta to z założenia manifest plus zestaw nazwanych części, dzięki czemu nowe rodzaje przenośnych danych będą mogły jechać na niej później **bez zmiany łamiącej kompatybilność**. Wchodzą jako dodatkowe części (nowe `formatVersion`, ten sam `minReader`), a dzisiejszy czytnik pomija to, czego nie rozpoznaje. Są one na [mapie drogowej](/info/overview.html#roadmap), jeszcze nie zaimplementowane. Nazwy są tu zarezerwowane, żeby format pozostał spójny, gdy się pojawią.

- **`tokens.json` - tokeny projektowe.** Dokument tokenów projektowych [W3C DTCG](https://tr.designtokens.org/format/) (format, który [Penpot importuje i eksportuje](https://help.penpot.app/user-guide/design-systems/design-tokens/) - tokeny z `$value`/`$type`/`$description`, zorganizowane w grupy, zestawy i motywy). Zestaw tokenów w paczce pozwala użytkownikowi przenieść swoje prymitywy marki między instalacjami razem z sesjami. W dłuższej perspektywie zaimportowany zestaw tokenów stanie się pełnoprawnym źródłem, względem którego narzędzia i zasoby palety będą się rozwiązywać.
- **`penpot/` - zaimportowane pliki Penpot.** Zarezerwowany katalog na plik Penpot (lub jego wyodrębniony, istotny dla Lolly podzbiór) zaimportowany i udostępniony *jako narzędzie*. Paczka będzie nosić zaimportowaną definicję, więc podróżuje razem z resztą danych użytkownika.

Wszystko poza tymi zarezerwowanymi nazwami i częściami powyżej jest dla czytnika nieznaną częścią: pozostawioną nietkniętą i policzoną w `skipped`.

## Materiały źródłowe

- Moduł: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - funkcja nadająca nazwę `backupFilename()` jest wewnętrzna).
- Test kontraktowy: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - przypadki pełnego cyklu, scalania, integralności, zgodności wstecznej i bramki czytnika.
- Używana powierzchnia mostka: `host.profile`, `host.state`, `host.assets` - zobacz [Host API](/info/host-api.html).
