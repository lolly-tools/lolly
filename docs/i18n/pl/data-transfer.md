# Przenoszenie danych: pakiet `lolly-backup`

Pakiet kopii zapasowej przenosi osobistą bibliotekę, którą Lolly przechowuje na urządzeniu: wyeksportuj ją w jednej instalacji, przenieś plik (USB, AirDrop, e-mail do siebie lub udział sieciowy) i zaimportuj w innej. Eksport i import nie wymagają serwera, a urządzenie docelowe może być offline.

To specyfikacja formatu dla osób budujących powłoki, narzędzia lub skrypty do obsługi kopii zapasowych. Aby przenieść własną pracę, przeczytaj [Przenoszenie pracy na inne urządzenie](/info/find-your-work.html#move-your-work-to-another-device).

![Dwa przyciski przenoszące całą instalację: Export my data zapisuje jeden plik zip, Import data wczytuje go z powrotem](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

::: note Zakres
Pakiet przenosi *dane użytkownika*, nie narzędzia katalogowe. Narzędzia i zasoby katalogowe synchronizują się osobno i zakłada się, że są obecne na urządzeniu docelowym, co najwyżej w nowszej wersji. Narzędzia utworzone przez użytkownika są przekazywane wewnątrz `profile.json`. Import nigdy nie instaluje ani nie aktualizuje narzędzia katalogowego.
:::

<!--i:eti-badge-check-->
## Cele

- <!--i:box--> **Jeden format, każda powłoka.** Aplikacja webowa, aplikacje komputerowe i mobilne oraz przyszłe powłoki współdzielą ten sam kontener i schematy części. Opcjonalne części zależą od możliwości każdej powłoki, a nieobsługiwane części są zgłaszane. Każdy mostek funkcjonalności dostarcza własny adapter pamięci masowej.
- <!--i:shieldcheck--> **Wytrzymuje przenoszenie.** Pakiet uszkodzony lub ucięty podczas przesyłania powoduje błąd importu i nigdy nie jest przywracany częściowo.
- <!--i:clock--> **Działa dłużej niż ta wersja.** Starsza aplikacja importuje te części nowszego pakietu, które rozpoznaje. Format naruszający zgodność jest odrzucany bez zmian.
- <!--i:check--> **Bezpieczne scalanie.** Import do używanej już instalacji nigdy nie usuwa niczego, czego nie było w pakiecie.

<!--i:eti-package-->
## Kontener

Pakiet to zwykły `.zip`. Przechodzi przez każdy sposób przesyłania bez zmian, a dowolne narzędzie do rozpakowywania ZIP pozwala sprawdzić zawartość.

Pobierany plik otrzymuje nazwę od właściciela: `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, na przykład `LollyTools-Ada-Lovelace-2026-06-26-1.zip`. Imię i nazwisko pochodzą z profilu i są pomijane, jeśli ich nie ustawiono: brak profilu daje `LollyTools-2026-06-26-1.zip`, a samo imię daje `LollyTools-Ada-2026-06-26-1.zip`. Każda część nazwy staje się tokenem bezpiecznym dla nazwy pliku (litery i cyfry Unicode są zachowywane, spacje i interpunkcja usuwane, maksymalnie 32 znaki). `<n>` to licznik osobny dla każdego dnia i urządzenia, więc kolejne eksporty tego samego dnia nie kolidują i pozostają w kolejności. `backupFilename()` w `data-transfer.ts` tworzy nazwę. Nazwa nie zmienia zawartości ZIP.

| Ścieżka | Wymagane | Zawartość |
|---|---|---|
| `manifest.json` | tak | Identyfikator formatu, wersje, liczby elementów i integralność poszczególnych części. Czytnik odczytuje ten plik jako pierwszy. |
| `profile.json` | jeśli ustawiono | Rekord `me` użytkownika: imię i nazwisko, kontakt, odwołanie do zdjęcia portretowego i flagi oraz foldery, Trash, schematy projektów, szablony użytkownika i narzędzia utworzone przez użytkownika, ulubione, ukryte narzędzia, język i wybór emoji. Odczytywany przez `host.profile`. |
| `sessions.json` | tak | Każda zapisana sesja: slot, identyfikator i wersja narzędzia, etykieta, miniatura (data URL) i pełne dane wejściowe. Odczytywane przez `host.state`. |
| `assets.json` | tak | Metadane każdego przesłanego zasobu (obrazy, czcionki, tokeny marki, logo, zapisane kopie pobranych plików), każde wskazujące jego bajty w `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | dla każdego zasobu | Surowe bajty zasobu, przechowywane bez kompresji, ponieważ większość formatów jest już skompresowana. Rozszerzenie jest kosmetyczne; rozstrzyga typ MIME w `assets.json`. |
| `assets/blobs/<n>.c2pa` | jeśli obecne | Wyodrębnione Content Credentials w postaci dokładnych bajtów binarnych, wskazywane przez `_credentialFile` w rekordzie zasobu. To nie są klucze podpisujące urządzenia. |
| `design-systems.json` | jeśli obecne | Systemy projektowe utworzone lub dodane w tej instalacji, jako `{ active, records }`. Zobacz [Reguły importu](#import-rules). |
| `file-history.json` | opcjonalne | Wersjonowane migawki zasobów, raporty zakończonych operacji na plikach i kompletne manifesty partii, z własną wersją. Dostarczane przez wewnętrzny adapter kopii zapasowej `fileHistory` powłoki. |
| `revision-history.json` | opcjonalne, ręczne kopie zapasowe | Stałe identyfikatory prac, zachowane punkty kontrolne, miniatury i rotacyjne wersje robocze do odzyskiwania. Dostarczane przez `host.state.history.backup`, jeśli jest obsługiwane. |
| `file-history/versions/` | dla każdej migawki | Poprzednie bajty zasobów i wyodrębnione poświadczenia, niezależnie od tego, czy bieżący zasób nadal istnieje. |
| `file-history/results/` | dla każdej zakończonej operacji | Dokładne bajty wyjściowe. Żaden oryginalny plik wybrany do konwersji nie jest zachowywany ani dołączany. |
| `prefs.json` | tak | Lokalne preferencje użytkownika: `theme`, `sidebarWidth` i licznik aktywności `ct-metrics`. |
| `lolly.txt` | tak | Czytelne podsumowanie pakietu (liczby elementów, profil, nazwa pliku) dla każdego, kto otworzy ZIP bez Lolly. Generowane ponownie przy każdym eksporcie i rozpoznawane przy imporcie, więc nigdy nie jest liczone jako pominięta część. Zapisywane po mapie integralności, więc mapa nie obejmuje tego pliku. |

::: details Jak eksport zapisuje ZIP
Eksport zapisuje ZIP po jednej części (`shells/web/src/lib/zip-stream.ts`). Przesłane pliki, zapisane wyniki i zapisane wersje zasobów są odczytywane we fragmentach po 4 MiB, nigdy w całości. Zapisane wyniki i wersje są najpierw sprawdzane względem ich zapisanego SHA-256. Następnie każdy plik jest odczytywany w celu obliczenia sumy kontrolnej i skrótu integralności, a ZIP odwołuje się do pliku w jego obecnym miejscu.

Nic nie jest ponownie kodowane. Każda część zachowuje dokładne bajty i skrót, więc plik zawierający Content Credentials zachowuje bajty objęte podpisem. Dla tych samych części i czasu ZIP jest identyczny z plikiem tworzonym przez wcześniejszy mechanizm zapisu w pamięci, z wyjątkiem tego, że plik historii większy niż 16 MiB jest kompresowany fragmentami. `tests/backup-streaming.test.ts` sprawdza to względem zapisanych skrótów referencyjnych.

Dla syntetycznej biblioteki o rozmiarze 192 MiB, w pomiarach w Node, ukończenie kopii zapasowej wymagało około 125 do 150 MiB ponad rozmiar biblioteki, w porównaniu z około 850 MiB dla mechanizmu zapisu w pamięci (`node scripts/bench-backup-finalise.ts`). Import nadal wczytuje cały ZIP do pamięci.
:::

<!--i:eti-file-->
## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 3,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3, "assetVersions": 1, "fileOperations": 1 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.bin": "sha256-…",
    "file-history.json": "sha256-…",
    "file-history/versions/0.bin": "sha256-…",
    "file-history/results/0.bin": "sha256-…",
    "prefs.json": "sha256-…"
  }
}
```

| Pole | Znaczenie |
|---|---|
| `format` | Zawsze `lolly-backup`. Plik bez tego pola jest odrzucany jako „to nie jest kopia zapasowa Lolly”. |
| `formatVersion` | Układ, w którym **zapisano** ten pakiet. Zwiększany przy każdej zmianie zestawu części lub ich struktur. Czytniki **nie** uzależniają importu od tego pola. |
| `minReader` | Minimalna wersja czytnika, która może **bezpiecznie** zaimportować ten pakiet. To od tego pola czytniki uzależniają import. |
| `app` | Identyfikator aplikacji, która utworzyła pakiet, do diagnostyki. |
| `exportedAt` | Znacznik czasu ISO utworzenia pakietu. |
| `counts` | Co umieścił mechanizm zapisu, do wyświetlania i kontroli poprawności. |
| `integrity` | Opcjonalne. Mapuje każdą część poza `manifest.json` na skrót `sha256-<base64>` w stylu SRI jej **nieskompresowanych** bajtów. |

<!--i:eti-tag-->
## Zasady wersjonowania

Dwa numery wersji pozwalają rozwijać format bez porzucania starszych instalacji.

![Zmiana formatu pakietu jest albo rozszerzająca, którą starsze czytniki mogą zignorować, albo naruszająca zgodność, przy której błędny import uszkadza dane. Rozszerzająca zwiększa formatVersion i zachowuje minReader; naruszająca zgodność zwiększa formatVersion i podnosi minReader. Czytnik importuje, gdy minReader nie przekracza jego własnej wersji.](/info/diagrams/concepts/backup-version-gate.svg)

- Czytnik importuje pakiet, gdy `manifest.minReader` nie przekracza jego własnej wersji czytnika. Odmawia z komunikatem „wymaga nowszej wersji aplikacji” tylko wtedy, gdy pakiet wymaga nowszego czytnika.
- Zmiana **rozszerzająca**, taka jak nowa opcjonalna część lub nowe opcjonalne pole manifestu, zwiększa `formatVersion` i pozostawia `minReader` bez zmian. Starsze aplikacje nadal importują każdą część, którą rozpoznają, a części, których nie rozpoznają, są zgłaszane jako pominięte, zamiast znikać bez informacji.
- Zmiana **naruszająca zgodność**, przy której błędny import części uszkadza dane lub opcjonalna część staje się obowiązkowa, podnosi `minReader`. Starsze aplikacje odmawiają wtedy bez zmian, zamiast importować coś, czego nie potrafią obsłużyć. Starsze aplikacje odrzucają wtedy pakiet bez zmian.
- Jeśli przyszły pakiet ustawi `formatVersion`, ale pominie `minReader`, czytniki uzależniają import od `formatVersion` i traktują zmianę jako naruszającą zgodność.

::: note Praktyczna reguła dla autorów
Jeśli każdy istniejący czytnik nadal działałby prawidłowo po zignorowaniu Twojego dodatku, zmiana jest rozszerzająca: zwiększ `formatVersion` i pozostaw `minReader`. W przeciwnym razie podnieś `minReader`.
:::

<!--i:eti-shield-check-->
## Integralność

Gdy `manifest.integrity` jest obecne, czytnik sprawdza SHA-256 każdej wymienionej części **przed zapisaniem czegokolwiek**. Niezgodność („kontrola integralności nie powiodła się”) lub brak części („niekompletne”) zatrzymuje import, więc nie dochodzi do częściowego przywrócenia. Wykrywa to uszkodzenia podczas przesyłania: ucięty transfer AirDrop, bramkę pocztową, która ponownie zakodowała załącznik, uszkodzony sektor nośnika USB.

Integralność jest obsługiwana w miarę możliwości. Jest zapisywana tylko tam, gdzie dostępne jest Web Crypto (każdy bezpieczny kontekst przeglądarki i współczesny Node), a sprawdzana tylko wtedy, gdy obecne są zarówno mapa, jak i Web Crypto. Pakiet bez mapy, na przykład sprzed wprowadzenia integralności, importuje się bez zmian: „nie można zweryfikować” nigdy nie oznacza „uszkodzone”.

Manifest nie wymienia ani siebie, ani ponownie wygenerowanego `lolly.txt`.

<!--i:eti-download-->
## Reguły importu

Import działa w jednym z dwóch trybów.

- **Merge** to działanie **Import data…** i pierwszego dołączenia do synchronizacji, **Bring it to this device**. Dane na urządzeniu docelowym pozostają i nic poza pakietem nie jest zmieniane.
- **Replace** to tryb, którego synchronizacja urządzeń używa do utrzymywania ich zgodności. Przejmuje rekord profilu, preferencje, sesje, obrazy i wybór aktywnego systemu projektowego z synchronizowanej kopii. Usuwa tylko elementy, które inne urządzenie usunęło od ostatniej synchronizacji. Przywrócenie wcześniejszej kopii najpierw zapisuje stan urządzenia, a potem dopasowuje urządzenie do tej kopii i usuwa wszystko, czego kopia nie zawiera. [Synchronizacja urządzeń](/info/sync.html) opisuje to, co widzi użytkownik.

Scalanie traktuje każdy rodzaj danych następująco:

| Dane | Już na urządzeniu docelowym | Tylko w pakiecie |
|---|---|---|
| Sesje (według slotu) i przesłane obrazy (według identyfikatora) | Zachowywana jest później zapisana kopia, więc starsza kopia zapasowa nigdy nie nadpisuje nowszej pracy. Przy równych lub nieznanych czasach zachowywana jest kopia urządzenia docelowego. | Dodawane |
| Foldery | Nazwa i folder nadrzędny z urządzenia docelowego są zachowywane, a folder otrzymuje brakujące elementy z pakietu. Sesja umieszczona w folderze na urządzeniu docelowym pozostaje w tym folderze. | Dodawane |
| Ulubione (narzędzia, zasoby katalogowe i elementy Projects) | Łączone | Dodawane |
| Szablony, szablony Projects i narzędzia użytkownika (według identyfikatora) | Zachowywany jest rekord urządzenia docelowego. | Dodawane |
| Wpisy Trash | Zachowywany jest wpis urządzenia docelowego. | Dodawane, więc element, który dało się przywrócić w dowolnej z instalacji, nadal można przywrócić. Wpis, którego folder jest ponownie używany na urządzeniu docelowym lub którego slot w Trash jest już zajęty na tym urządzeniu, jest pomijany. |
| Inne pola profilu (imię i nazwisko, dane kontaktowe, język, flagi funkcji, ukryte narzędzia i inne ustawienia) | Zachowywana jest wartość urządzenia docelowego. | Pobierane, gdy pole na urządzeniu docelowym jest puste |
| Preferencje (`prefs.json`) | Zachowywana jest wartość urządzenia docelowego. | Zapisywane tam, gdzie urządzenie docelowe ich nie ma |
| Systemy projektowe (według identyfikatora) | Rekord z pakietu zastępuje rekord urządzenia docelowego. | Dodawane. Aktywny wybór z pakietu obowiązuje tylko wtedy, gdy urządzenie docelowe nie ma własnego systemu projektowego. |
| Historia prac | Później zapisana kopia pozostaje bieżąca, a druga jest zachowywana jako chroniona wersja robocza. | Dodawane |

**Zapisane sesje automatycznie odzyskują powiązania z obrazami.** Odwołania do zasobów są zachowywane według identyfikatora. Mostek rozwiązuje je ponownie po przywróceniu obrazów, ponieważ adresy URL `blob:` nie przetrwają przeładowania.

**Rekordy historii nigdy nie zmieniają się po zapisaniu.** Ponowny import wersji zasobów i identyfikatorów operacji niczego nie dodaje, a identyfikator, który już oznacza inne bajty lub historię, jest odrzucany, nie nadpisywany. Ponowny import identycznego bieżącego zasobu zachowuje jego wersję, a zmieniony bieżący zasób musi mieć inną wersję.

**Historia prac ma kilka dodatkowych reguł.** Praca, której slot urządzenie docelowe wykorzystuje dla innej pracy, jest dodawana jako osobna praca, a praca w Trash urządzenia docelowego pozostaje tam. Gdy identyfikator punktu kontrolnego oznacza inną treść na urządzeniu docelowym, zachowywana jest treść tego urządzenia. Archiwum, które nie przejdzie własnych kontroli, zatrzymuje import przed jakąkolwiek zmianą profilu, sesji, zasobu lub preferencji, a ponowny identyczny import nie zajmuje dodatkowego miejsca.

**Podsumowanie informuje, co się wydarzyło.** Każdy import zwraca `profile`, `sessions`, `userAssets`, `prefs`, `skipped` i `failedAssets`.

- `failedAssets` zlicza przesłane zasoby, których nie udało się przywrócić, na przykład z powodu zapełnienia pamięci urządzenia.
- `skipped` zlicza części z nowszego mechanizmu zapisu, których ta kompilacja nie rozpoznała. Aplikacja pokazuje liczbę („… · pominięto N nowszych elementów”).
- Przy historii plików podsumowanie dodaje `assetVersions`, `fileOperations`, `fileBatches` i `failedHistory`. Brak miejsca lub konflikt niezmiennych identyfikatorów może spowodować częściowe przywrócenie, a aplikacja informuje wtedy użytkownika, by zachował źródłową kopię zapasową.
- Przy historii prac dodaje `revisions` i `recoveryDrafts`, zliczając tylko to, co dodał ten import, oraz `added`, `kept`, `replaced`, `copies` i `hidden`, określające sposób scalenia każdej pracy. `skippedCheckpoints` zlicza punkty kontrolne, których identyfikator oznacza inną treść na urządzeniu docelowym, a `historyLeftOut` zlicza starsze punkty kontrolne i wersje robocze, które nie zmieściły się w miejscu przeznaczonym na historię urządzenia.
- Import zastępujący dodaje `removed` i `failedRemovals`.

Przywracanie nie jest jedną transakcją obejmującą magazyny profilu, sesji, zasobów i historii. Synchronizacja z chmurą **nie** aktualizuje numeru zastosowanej rewizji po częściowym lub nieobsługiwanym przywróceniu, więc kopia pozostaje dostępna do ponownej próby.

<!--i:eti-unlink-->
## Co nie jest przenoszone

- **Pamięć podręczna katalogu** (pobrane metadane zasobów i bloby, indeks narzędzi), którą urządzenie docelowe synchronizuje ponownie.
- **Narzędzia i zasoby z katalogu**, które zgodnie z założeniem są obecne na urządzeniu docelowym. Tokeny marki, czcionki i logotypy dodane przez użytkownika są zasobami użytkownika i są przenoszone.
- **Adresy `blob:` i adresy URL obiektów**, które most generuje ponownie przy wczytywaniu.
- **Oryginały konwersji, aktywne dzierżawy wykonania i lokalne dla urządzenia sekrety dostępu lub podpisywania.** Nie stanowią one przenośnej historii. Zapisany wynik jest kopią. Nie oznacza to, że utworzono kopię zapasową oryginalnego źródła.
- **Licznik kolejności eksportu**, dzienny licznik nazw pobrań w `localStorage` (`lolly-export-seq`). Jest wyłączony z `PREF_KEYS`, więc nigdy nie trafia do pakietu.

Wskaźnik zajętego miejsca pokazuje ten sam podział. Saved sessions, My images i File results & versions trafiają do pakietu. Pamięć podręczną zasobów, podglądy narzędzi i elementy przypięte offline można odbudować, więc pozostają na urządzeniu.

![Wskaźnik zajętego miejsca dzieli dane tego urządzenia na nazwane kategorie, z Saved sessions i My images liczonymi osobno od Asset cache; tutaj po nowej instalacji, gdy wszystkie kategorie są jeszcze puste](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

<!--i:eti-building-->
## Dane organizacji w Lolly Work

Ten pakiet tworzy kopię zapasową osobistej biblioteki urządzenia. Pakiet nie jest kopią zapasową instancji **Lolly Work**. Konta organizacji, polityki dostępu, wspólne projekty, wersje katalogu, zatwierdzenia, zadania renderowania i zapisy audytu są przechowywane przez tę usługę. Połącz się ponownie i zaloguj, aby odzyskać dostęp do wspólnej pracy. Import osobistego pakietu nie przyznaje tego dostępu.

Operatorzy tworzą kopie zapasowe, przechowują i usuwają dane serwera według osobnych przewodników Lolly Work: [Kopie zapasowe i przywracanie](/info/work-operations.html#backup-and-restore) oraz [Przechowywanie i cykl życia danych w Lolly Work](/info/work-data-lifecycle.html). Wyczyszczenie lub eksport danych urządzenia nie wykonuje żadnej z tych operacji na serwerze.

<!--i:eti-monitor-->
## W różnych powłokach

`data-transfer.ts` odczytuje i zapisuje dane wyłącznie przez most udostępniający funkcje (`host.profile`, `host.state`, `host.assets`) oraz wspólne preferencje w `localStorage`. Ten sam moduł odczytuje i zapisuje wspólną strukturę pakietu w przeglądarce oraz aplikacjach komputerowych i mobilnych, korzystając z IndexedDB lub systemu plików. Opcjonalne części historii pojawiają się tylko tam, gdzie dostępny jest ich adapter. Import zgłasza nieobsługiwaną część jako pominiętą. Zestaw testów bez interfejsu graficznego sprawdza wspólne części z mostem działającym w pamięci, a transakcje historii mają też testy w rzeczywistej przeglądarce.

Dwie powłoki nie są objęte tą gwarancją:

- **Jednorazowy CLI** nie ma nic do przeniesienia: jego stan jest w pamięci i trwa przez jedno wywołanie.
- **TUI** przechowuje stan w `~/.lolly` (sesje, foldery, profil). Jego widok Profile zapisuje własne, prostsze archiwum kopii zapasowej: `saved-state/<slot>.json` dla każdej sesji oraz `profile.json` i `folders.json`, bez manifestu, bez `formatVersion` i `minReader` i bez mapy integralności. Czytnik tego formatu odrzuca to archiwum jako „nie jest kopią zapasową Lolly”, choć nazwy są podobne (`lolly-backup-<stamp>.zip`). Ujednolicenie obu formatów jest znanym brakiem.

<!--i:eti-clock-->
## Jeszcze nieprzenośne

Nowe rodzaje przenośnych danych mogą zostać dodane później jako kolejne części (nowy `formatVersion`, ten sam `minReader`). Systemy projektowe już są przenoszone w ten sposób, jako `design-systems.json` wraz z ich zasobami użytkownika.

Dwie nazwy są zarezerwowane dla danych, które nie są jeszcze przenoszone:

- **`tokens.json`** przenosiłby dokument tokenów projektowych [W3C DTCG](https://tr.designtokens.org/format/) z jego grupami, zestawami i motywami, w formacie, który [Penpot importuje i eksportuje](https://help.penpot.app/user-guide/design-systems/design-tokens/). Własne tokeny marki użytkownika są już przenoszone jako zasób `user/tokens/brand` w `assets.json`, a tokeny systemu projektowego są przenoszone z jego rekordem.
- **`penpot/`** jest zarezerwowane dla wczytanego pliku Penpot lub jego podzbioru istotnego dla Lolly, udostępnionego jako narzędzie.

<!--i:eti-history-->
## Części historii

Obie części historii są opcjonalne i mają własne wersje.

::: details Historia tworzenia (v3)
Ręczne kopie zapasowe z instalacji przeglądarkowej z historią tworzenia zawierają `revision-history.json`, z własnym schematem `{ version: 1, documents, revisions, recoveries }`. Przenosi on zachowane identyfikatory, kanoniczne migawki danych wejściowych, znaczniki wersji, podglądy rastrowe i osobne wersje robocze zapisujących. Adapter historii przechwytuje bieżące sesje i ich najnowsze rewizje w jednej transakcji odczytu, a `sessions.json` używa tych samych bieżących migawek dla starszych czytników.

Przywracanie sprawdza SHA-256 i liczbę bajtów danych, unikalność tożsamości, powiązania dokumentów i najnowszych rewizji, łańcuch przodków, znaczniki czasu, typy podglądów i limity, zanim zatwierdzi archiwum w jednej transakcji. Odwołania do rodziców usuniętych przy kompaktowaniu mogą nie istnieć. Istniejąca bieżąca praca nigdy nie jest zastępowana bez powiadomienia: gdy dzieło jest po obu stronach, strona, która nie pozostaje bieżąca, staje się chronioną wersją roboczą.

Archiwum ma limit transferu 384 MiB. Limity przechowywania są egzekwowane bez obcinania zachowanych punktów kontrolnych. Eksport zapisuje `revision-history.json` i `sessions.json` w fragmentach, z tymi samymi bajtami co pojedyncze `JSON.stringify`, więc tekst pliku nigdy nie jest przechowywany w całości. Plik historii, który przekracza limit, jest pomijany w chwili przekroczenia, a od tego momentu jego rozmiar jest tylko zliczany. Archiwum jest następnie tworzone ponownie bez najstarszych automatycznych punktów kontrolnych, a podsumowanie eksportu zlicza je jako `checkpointsLeftOut`, albo utworzenie archiwum zostaje odrzucone.

Powłoka bez tej funkcji przywraca zwykłe sesje i zgłasza część historii jako pominiętą. Historia w natywnym systemie plików pozostaje nieobsługiwana, dopóki jej adapter nie zapewni trwałych transakcji historii. Goście w prywatnej współpracy nie mają trwałej historii ani archiwum odzyskiwania.

Synchronizacja osobistych migawek pomija historię tworzenia. Zastosowanie migawki do lokalnego dokumentu z historią zachowuje jego poprzedni stan roboczy jako osobną wersję roboczą do odzyskania i unieważnia token zapisu każdego otwartego edytora. Jego niezmienne punkty kontrolne pozostają na urządzeniu. Chroni to lokalną historię podczas zastępowania migawką. Nie scala równoległych historii z różnych urządzeń.

Historyczne odwołania do zasobów są zachowywane, ale renderowanie nadal odnajduje zasoby w istniejącej bibliotece miejsca docelowego. To archiwum nie gwarantuje jeszcze dokładnych bajtów dawnych zasobów ani dawnych renderów narzędzi. Bajty wersji zasobów i wyników plikowych są przenoszone w osobnej części kopii zapasowej.
:::

::: details Zapisane wersje i wyniki plikowe (v2)
Opcjonalna część historii zawiera `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`, a czytniki akceptują też wcześniejszą strukturę history-v1 bez partii. Każda migawka podaje stały identyfikator zasobu i dokładną wersję, czas jej zapisu, długość w bajtach i SHA-256 w zapisie szesnastkowym oraz rekord zasobu, którego `_file` i opcjonalne `_credentialFile` wskazują części binarne. Operacje przenoszą informacje o oryginalnym pliku, żądanie, raport, znaczniki czasu i opcjonalny wynik `_file`. Nazwy zaplecza przechowywania, uchwyty OPFS i dzierżawy wykonania nie są przenoszone. Czytniki znające tylko historię v1 odrzucają nową wersję historii przed importem, więc przynależność do partii nigdy nie jest pomijana bez powiadomienia.

Manifesty partii zapisują każde wybrane źródło przed przetwarzaniem, w tym pliki nigdy nieodczytane, anulowane elementy, niepowodzenia rezerwacji miejsca na wynik i przerwaną pracę. Każdy element ma stały identyfikator operacji, odwołanie do źródła i informacje o nim, żądaną nazwę wyjściową i końcowy raport. Nieodczytane źródło ma zadeklarowane informacje, a nie zmyślony skrót. Import weryfikuje tożsamość elementu i spójność z każdym przenoszonym raportem operacji. Raporty Lolly Batch pozostają dostępne po usunięciu poszczególnych wyników, ale potwierdzenie nie oznacza, że bajty wyniku są nadal przechowywane.

- **Najpierw walidacja.** Każdy znany rekord historii, raport i wskazany plik jest sprawdzany przed jakimkolwiek zapisem importowanego profilu lub zasobu. Brakujące bajty i niezgodne SHA-256 powodują błąd nawet wtedy, gdy pakiet nie ma mapy integralności. Wyodrębnione poświadczenia pozostają tablicami bajtów, także przy imporcie ze starszych modułów zapisujących, które serializowały je jako obiekty z kluczami liczbowymi.
- **Praca w toku.** Trwające operacje stają się w kopii zapasowej rekordami przerwanych operacji, z raportem błędu i bez wyniku. Przywracanie nigdy nie wznawia pracy w tle ani nie importuje aktywnej dzierżawy. Ponowienie wymaga ponownego wybrania oryginalnego pliku, sprawdzanego względem zapisanego SHA-256, jeśli jest dostępny.
- **Przechowywanie.** Przywrócone wyniki zatwierdzają bajty i metadane razem w IndexedDB. Zwykłe nowe wyniki używają OPFS, gdy jest dostępny, a w przeciwnym razie IndexedDB. Import nigdy nie zastępuje istniejącej aktywnej operacji.
- **Limity kopii zapasowej.** Eksport strumieniowo zapisuje te bajty do archiwum, ale przywracanie nadal rozpakowuje całą kopię zapasową w pamięci, więc limity pozostają: **256 MiB danych historii**, **4 MiB metadanych historii**, najwyżej **100 operacji**, **100 partii** i **2000 migawek**. Eksport jawnie odrzuca zbyt dużą lub niekompletną historię i nigdy nie pomija jej bez powiadomienia. Pobierz ważne wersje i wyniki pojedynczo przed usunięciem starszych kopii lokalnych. Te limity nie są gwarancją szczytowego zużycia pamięci zmierzonego na telefonach.
- **Limity lokalne.** Lokalna historia wyników ma limit 512 MiB i 100 rekordów. Migawki zasobów mają osobny limit 512 MiB i najwyżej 20 historycznych wersji na zasób, a bajty wyodrębnionych poświadczeń wliczają się do tego limitu. Przywracanie przestrzega tych limitów i nigdy nie usuwa istniejących danych użytkownika bez powiadomienia.
- **Metadane partii.** Lokalne metadane partii mają osobny limit 4 MiB, najwyżej 100 manifestów i 20 elementów na partię. Oczekujące elementy rezerwują miejsce na metadane, z limitem raportu 32 KiB na element. To limit logiczny, a nie gwarancja miejsca na dysku w przeglądarce: rzeczywisty błąd przekroczenia limitu miejsca jest pokazywany, a raport w pamięci pozostaje dostępny do pobrania. Ponowienie elementu partii tworzy nową partię bez nadpisania starego raportu. Usunięcie rekordu partii nie usuwa bajtów poszczególnych wyników ani zasobów biblioteki.
- **Wyniki w bibliotece.** Przekonwertowane wyniki można dodać do biblioteki bez normalizacji ani ponownego kodowania, z dołączonymi skrótami źródła i wyniku oraz powiązaniem z operacją. Ponowne dodanie wykorzystuje niezmienioną kopię, a edytowana kopia nigdy nie jest nadpisywana. Obrazy rastrowe mogą rozpocząć nowy dokument Lolly Design, który używa bieżącego identyfikatora zasobu w bibliotece. Egzekwowanie przypięć do dokładnych wersji w całym środowisku wykonawczym Lolly Design i obsłudze adresów URL to osobne zadanie. Wyniki SVG, HTML, PDF i ZIP są przechowywane jako nieinterpretowane zasoby plikowe, bez nadawania im statusu zaufanej treści interaktywnej lub wektorowej.
- **Gdzie to widać.** **Convert → Recent file operations** pokazuje zajętość historii, raporty, pobrania i menedżer wersji, który znajduje też wcześniejsze wersje usuniętych zasobów biblioteki. Przywrócenie migawki tworzy nową bieżącą wersję i zachowuje wybraną migawkę. **Settings → Preferences → Storage** liczy wyniki i wersje osobno od pamięci podręcznych, które można usunąć.
- **Porządkowanie.** Jawne czyszczenie plików tymczasowych usuwa tylko bajty należące do operacji, do których nic się nie odwołuje. Bieżące rekordy chronią swoje pliki, a nowe pliki OPFS mają godzinny okres ochronny. Zapisane wyniki i migawki zasobów nie są czyszczone automatycznie.

Starsze czytniki nadal akceptują strukturę pakietu v2 (`minReader: 1`) i przywracają znane części, zliczając nieobsługiwane części historii jako pominięte. Pełne odzyskanie historii wymaga powłoki z adapterem `fileHistory`, wewnętrznym punktem integracji powłoki, a nie funkcją `HostV1` dostępną dla narzędzi. Rzeczywiste przywracanie między dwoma urządzeniami jest objęte lokalnymi testami warunkującymi akceptację w Chromium. Odzyskiwanie w zainstalowanych aplikacjach komputerowych, iOS i Android nadal wymaga osobnych testów akceptacyjnych.
:::

<!--i:eti-code-->
## Informacje referencyjne

- Moduł: `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION`; funkcja nadająca nazwy `backupFilename()` jest wewnętrzna).
- Test kontraktu: `tests/data-transfer.test.ts`, obejmujący eksport i ponowny import, scalanie, integralność, zgodność z przyszłymi wersjami i kontrolę wersji czytnika.
- Testy kontraktu historii: `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts` i `tests/file-result-library.test.ts`. Testy akceptacyjne w przeglądarce: `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts` i `tests/file-result-reuse.browser.test.ts`.
- Używany interfejs mostu: `host.profile`, `host.state` i `host.assets`; zobacz [Host API](/info/host-api.html).
