# Transfer danych: paczka `lolly-backup`

Lolly przechowuje Twoją osobistą bibliotekę na urządzeniu. Paczka kopii zapasowej to sposób, w jaki ta biblioteka się przenosi: wyeksportuj ją na jednej instalacji, przenieś plik jak chcesz (USB, AirDrop, e-mail do siebie lub udział sieciowy) i zaimportuj na innej. Eksport i import nie wymagają serwera, a cel może być offline.

Ta strona to specyfikacja formatu, dla osób budujących powłoki, narzędzia lub skrypty wokół kopii zapasowych: co jest w zip, jak bramkowane są wersje, jak import scala i co jest sprawdzane. Przewodnik dla osób przenoszących własną pracę to [Move your work to another device](/info/find-your-work.html#move-your-work-to-another-device).

![Dwa przyciski przenoszące całą instalację: Export my data zapisuje jeden zip, Import data odczytuje go z powrotem](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> **Zakres.** Paczka niesie *dane użytkownika*, a nie narzędzia katalogu. Narzędzia i zasoby katalogu są synchronizowane osobno i zakłada się, że już są na celu, w najgorszym razie w wyższej wersji. Narzędzia, które użytkownik zrobił sam, podróżują w `profile.json`. Import nigdy nie instaluje ani nie aktualizuje narzędzia katalogu.

## Cele

- <!--i:box--> **Jeden format, każda powłoka.** Aplikacja internetowa, aplikacje komputerowe i mobilne oraz przyszłe powłoki dzielą tę samą kopertę i schematy części. Części opcjonalne zależą od możliwości każdej powłoki, a nieobsługiwane są zgłaszane. Każdy most możliwości dostarcza swój adapter magazynu.
- <!--i:shieldcheck--> **Przeżywa podróż.** Paczka zniekształcona lub obcięta w transporcie zawodzi głośno przy imporcie i nigdy nie przywraca się w połowie.
- <!--i:clock--> **Przeżyje tę wersję.** Starsza aplikacja nadal może zaimportować części nowszej paczki, które rozpoznaje. Naprawdę przełomowy format jest odrzucany czysto.
- <!--i:check--> **Bezpieczny do scalania.** Import na instalację, która jest już używana, nigdy nie wymazuje niczego, czego nie było w paczce.

## Koperta

Paczka to zwykły `.zip`, więc przeżywa dowolny transport w całości, a każde narzędzie do rozpakowywania może sprawdzić zawartość.

Pobrany plik nosi nazwę osoby, do której należy: `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, na przykład `LollyTools-Ada-Lovelace-2026-06-26-1.zip`, aby folder Downloads z kopiami zapasowymi pozostał czytelny. Imię i nazwisko pochodzą z profilu i są pomijane, gdy nie ustawione: brak profilu daje `LollyTools-2026-06-26-1.zip`, a samo imię daje `LollyTools-Ada-2026-06-26-1.zip`. Każda nazwa jest sprowadzana do tokenu bezpiecznego dla nazw plików (litery i cyfry Unicode zachowane, spacje i interpunkcja usunięte, najwyżej 32 znaki). `<n>` to sekwencja na dzień i urządzenie, więc powtórzone eksporty jednego dnia nie kolidują i zachowują kolejność. `backupFilename()` w `data-transfer.ts` buduje nazwę, a zawartość zip jest taka sama niezależnie od nazwy.

| Ścieżka | Wymagane | Zawartość |
|---|---|---|
| `manifest.json` | tak | Identyfikator formatu, wersje, liczby i integralność dla każdej części. Pierwsza rzecz, na którą patrzy czytnik. |
| `profile.json` | gdy ustawiony | Cały zapis `me` użytkownika: imię i nazwisko, kontakt, odwołanie do zdjęcia i flagi, plus foldery, Trash, szablony projektów, szablony użytkownika i narzędzia stworzone przez użytkownika, ulubione, ukryte narzędzia, język i wybór emoji. Odczytywane przez `host.profile`. |
| `sessions.json` | tak | Każda zapisana sesja: slot, identyfikator i wersja narzędzia, etykieta, miniatura (data URL) i pełne dane wejściowe. Odczytywane przez `host.state`. |
| `assets.json` | tak | Metadane każdego wgranego zasobu (obrazy, czcionki, tokeny marki, logo, zapisane kopie pobrań), każdy wskazujący swoje bajty w `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | na zasób | Surowe bajty zasobu, przechowywane nieskompresowane, ponieważ większość to już skompresowane formaty. Rozszerzenie jest kosmetyczne; typ MIME w `assets.json` jest miarodajny. |
| `assets/blobs/<n>.c2pa` | gdy występuje | Wyodrębnione Content Credentials jako dokładne bajty binarne, wskazywane przez `_credentialFile` w zapisie zasobu. To nie są klucze podpisujące urządzenia. |
| `design-systems.json` | gdy występuje | Systemy projektowe stworzone lub dodane na tej instalacji, jako `{ active, records }`. Zobacz [Import rules](#import-rules). |
| `file-history.json` | opcjonalne | Wersjonowane migawki zasobów, raporty zakończonych operacji na plikach i kompletne manifesty partii, z własną wersją. Dostarczane przez wewnętrzny adapter kopii zapasowej `fileHistory` powłoki. |
| `revision-history.json` | opcjonalne, ręczne kopie | Stabilne identyfikatory prac, zachowane punkty kontrolne, miniatury i ruchome szkice odzyskiwania. Dostarczane przez `host.state.history.backup` tam, gdzie jest obsługiwane. |
| `file-history/versions/` | na migawkę | Poprzednie bajty zasobów i wyodrębnione poświadczenia, niezależnie od tego, czy bieżący zasób nadal istnieje. |
| `file-history/results/` | na zakończoną operację | Dokładne bajty wyniku. Żaden oryginalny plik wybrany do konwersji nie jest zachowywany ani dołączany. |
| `prefs.json` | tak | Lokalne preferencje należące do użytkownika: `theme`, `sidebarWidth` i licznik aktywności `ct-metrics`. |
| `lolly.txt` | tak | Czytelne podsumowanie paczki (liczby, profil, nazwa pliku) dla każdego, kto otworzy zip bez Lolly. Generowane na nowo przy każdym eksporcie i rozpoznawane przy imporcie, więc nigdy nie liczy się jako pominięta część. Jest zapisywane po mapie integralności, więc mapa nie obejmuje tego pliku. |

::: details Jak eksport zapisuje zip
Eksport zapisuje zip po jednej części (`shells/web/src/lib/zip-stream.ts`). Wgrane pliki, zapisane wyniki i zapisane wersje zasobów są czytane w kawałkach po 4 MiB, nigdy w całości, a zapisane wyniki i wersje są najpierw sprawdzane względem zapisanego SHA-256. Każdy plik jest potem czytany dla swojej sumy kontrolnej i skrótu integralności, a zip odwołuje się do niego tam, gdzie jest.

Nic nie jest ponownie kodowane, więc plik niosący Content Credentials zachowuje dokładne bajty, które obejmuje jego podpis, a każda część zachowuje dokładne bajty i skrót. Dla tych samych części i czasu zip jest identyczny z wcześniejszym zapisem w pamięci, z tą różnicą, że plik historii powyżej 16 MiB jest kompresowany w kawałkach. `tests/backup-streaming.test.ts` sprawdza to względem zapisanych skrótów referencyjnych.

Na syntetycznej bibliotece 192 MiB, mierzonej w Node, zakończenie kopii zapasowej zajęło około 125 do 150 MiB ponad bibliotekę, wobec około 850 MiB dla zapisu w pamięci (`node scripts/bench-backup-finalise.ts`). Import nadal wczytuje cały zip do pamięci.
:::

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
| `format` | Zawsze `lolly-backup`. Plik bez niego jest odrzucany jako "not a Lolly backup". |
| `formatVersion` | Układ, w którym ta paczka została **zapisana**. Podbijany przy każdej zmianie zestawu lub kształtu części. Czytniki **nie** bramkują po tym polu. |
| `minReader` | Minimalna wersja czytnika, która może **bezpiecznie** zaimportować tę paczkę. To jest pole, po którym bramkują czytniki. |
| `app` | Identyfikator aplikacji tworzącej, dla diagnostyki. |
| `exportedAt` | Znacznik czasu ISO utworzenia paczki. |
| `counts` | Co zapisujący włożył, do wyświetlania i kontroli poprawności. |
| `integrity` | Opcjonalne. Mapuje każdą część poza `manifest.json` na skrót `sha256-<base64>` w stylu SRI jej **nieskompresowanych** bajtów. |

## Polityka wersji

Dwa numery wersji pozwalają formatowi rosnąć bez pozostawiania starszych instalacji w tyle.

![Zmiana formatu paczki jest albo addytywna, którą stare czytniki mogą zignorować, albo przełomowa, gdzie błędny import psuje dane. Addytywna podbija formatVersion i zachowuje minReader; przełomowa podbija formatVersion i podnosi minReader. Czytnik importuje, gdy minReader jest co najwyżej jego własną wersją.](/info/diagrams/concepts/backup-version-gate.svg)

- Czytnik importuje paczkę, gdy `manifest.minReader` jest co najwyżej jego własną wersją czytnika. Odmawia, z komunikatem "needs a newer version of the app", tylko gdy paczka wymaga nowszego czytnika.
- Zmiana **addytywna**, taka jak nowa opcjonalna część lub nowe opcjonalne pole manifestu, podbija `formatVersion` i zostawia `minReader` w spokoju. Starsze aplikacje nadal importują każdą rozpoznawaną część, a części, których nie rozpoznają, są zgłaszane jako pominięte, a nie po cichu porzucane.
- Zmiana **przełomowa**, w której błędny import części psuje dane lub opcjonalna część staje się obowiązkowa, podnosi `minReader`. Starsze aplikacje odmawiają wtedy czysto, zamiast importować coś, czego nie potrafią obsłużyć.
- Jeśli przyszła paczka ustawia `formatVersion`, ale pomija `minReader`, czytniki wracają do bramkowania po `formatVersion` i traktują zmianę jako przełomową.

> **Reguła kciuka dla autorów:** jeśli każdy istniejący czytnik nadal zrobiłby właściwą rzecz, ignorując Twój dodatek, zmiana jest addytywna: podbij `formatVersion` i zostaw `minReader`. W przeciwnym razie podnieś `minReader`.

## Integralność

Gdy `manifest.integrity` jest obecne, czytnik sprawdza SHA-256 każdej wymienionej części **zanim cokolwiek zapisze**. Niezgodność ("failed its integrity check") lub brakująca część ("incomplete") zatrzymuje cały import, więc nie ma częściowego przywracania. To wychwytuje uszkodzenia, jakie może wyrządzić transport pliku: obcięty AirDrop, bramka e-mail, która ponownie zakodowała załącznik, zły sektor USB.

Integralność jest sprawdzana w miarę możliwości. Jest zapisywana tylko tam, gdzie jest dostępne Web Crypto (każdy bezpieczny kontekst przeglądarki i nowoczesny Node), i sprawdzana tylko wtedy, gdy obecne są zarówno mapa, jak i Web Crypto. Paczka bez mapy, taka jak sprzed istnienia integralności, importuje się bez zmian: "cannot verify" nigdy nie liczy się jako "corrupt".

Manifest nie wymienia ani siebie, ani odtwarzanego `lolly.txt`. Skróty obejmują części, za które ręczy manifest.

## Reguły importu

Import działa w jednym z dwóch trybów.

- **Merge** to to, co robi **Import data…** i co robi pierwsze dołączenie synchronizacji, **Bring it to this device**. Dane na celu zostają i nic, czego nie było w paczce, nie jest dotykane: sesja, którą cel miał, a paczka nie, przeżywa import.
- **Replace** to to, czego używa synchronizacja urządzeń, aby utrzymać urządzenia w zgodzie: bierze zapis profilu synchronizowanej kopii, preferencje, sesje, obrazy i wybór aktywnego systemu projektowego i usuwa tylko elementy, które inne urządzenie usunęło od ostatniej synchronizacji. Przywrócenie wcześniejszej kopii idzie dalej i sprawia, że urządzenie odpowiada tej kopii, usuwając wszystko, czego kopia nie zawiera, po zapisaniu najpierw urządzenia. [Sync your devices](/info/sync.html) opisuje, co widzi osoba.

W scalaniu wszystko, co jest tylko na celu, zostaje, a każdy rodzaj danych z paczki spotyka cel tak:

| Dane | Już na celu | Tylko w paczce |
|---|---|---|
| Sesje (po slocie) i wgrane obrazy (po id) | Zachowywana jest kopia zapisana później, więc starsza kopia zapasowa nigdy nie nadpisuje nowszej pracy. Równe lub nieznane czasy zachowują kopię celu. | Dodane |
| Foldery | Zachowywane są nazwa i rodzic celu, a folder zyskuje elementy paczki, których mu brakuje. Sesja złożona w folderze na celu zostaje tam złożona. | Dodane |
| Ulubione (narzędzia, zasoby katalogu i elementy Projects) | Połączone | Dodane |
| Szablony, szablony Projects i narzędzia użytkownika (po id) | Zachowywany jest zapis celu. | Dodane |
| Wpisy Trash | Zachowywany jest wpis celu. | Dodane, więc element, który dało się przywrócić na którejkolwiek instalacji, nadal można. Wpis, którego folder jest znów używany na celu albo którego slot Trash cel już używa, jest pomijany. |
| Inne pola profilu (imię i nazwisko, dane kontaktowe, język, flagi funkcji, ukryte narzędzia i inne ustawienia) | Zachowywana jest wartość celu. | Przejmowane tam, gdzie pole celu jest puste |
| Preferencje (`prefs.json`) | Zachowywana jest wartość celu. | Zapisywane tam, gdzie cel żadnej nie ma |
| Systemy projektowe (po id) | Zapis paczki zastępuje zapis celu. | Dodane. Aktywny wybór paczki stosuje się tylko wtedy, gdy cel nie ma własnego systemu projektowego. |
| Historia prac | Kopia zapisana później pozostaje bieżąca, a druga jest zachowywana jako chroniony szkic. | Dodane |

**Zapisane sesje automatycznie łączą się ponownie z obrazami.** Odwołania do zasobów są trzymane po id, a most rozwiązuje je ponownie po przywróceniu obrazów, co i tak musi robić, ponieważ adresy `blob:` nie przeżywają przeładowania.

**Zapisy historii nigdy nie zmieniają się po zapisaniu.** Powtórny import wersji zasobów i identyfikatorów operacji niczego nie dodaje, a identyfikator, który już nazywa inne bajty lub historię, jest odrzucany, a nie nadpisywany. Ponowny import identycznego bieżącego zasobu zachowuje jego wersję, a zmieniony bieżący zasób musi nieść inną wersję.

**Historia prac ma jeszcze kilka reguł.** Praca, której slot cel używa dla innej pracy, jest dodawana jako osobna praca, a praca w Trash celu tam zostaje. Identyfikator punktu kontrolnego, który nazywa inną zawartość na celu, zachowuje punkt celu. Archiwum, które nie przechodzi własnych kontroli, zatrzymuje import przed zmianą jakiegokolwiek profilu, sesji, zasobu lub preferencji, a identyczny powtórny import nie dodaje pamięci.

**Podsumowanie zgłasza, co się stało.** Każdy import zwraca `profile`, `sessions`, `userAssets`, `prefs`, `skipped` i `failedAssets`.

- `failedAssets` liczy wgrane zasoby, których nie udało się przywrócić, na przykład dlatego, że pamięć urządzenia jest pełna.
- `skipped` liczy części od nowszego zapisującego, których ta kompilacja nie rozpoznała. Aplikacja to pokazuje ("… · N newer items skipped"), więc przywrócenie mówi, co zostawiło.
- Z historią plików podsumowanie dodaje `assetVersions`, `fileOperations`, `fileBatches` i `failedHistory`. Wyczerpanie pamięci lub konflikt niezmiennego identyfikatora może spowodować częściowe przywrócenie, a aplikacja mówi wtedy osobie, by zachowała źródłową kopię zapasową.
- Z historią prac dodaje `revisions` i `recoveryDrafts`, licząc tylko to, co ten import dodał, oraz `added`, `kept`, `replaced`, `copies` i `hidden` dla tego, jak scalono każdą pracę. `skippedCheckpoints` liczy punkty kontrolne, których identyfikator nazywa inną zawartość na celu, a `historyLeftOut` liczy starsze punkty kontrolne i szkice, które nie zmieściły się w miejscu historii urządzenia.
- Import typu replace dodaje `removed` i `failedRemovals`.

Przywracanie nie jest jedną transakcją w magazynach profilu, sesji, zasobów i historii. Synchronizacja w chmurze **nie** przesuwa swojej zastosowanej rewizji po częściowym lub nieobsługiwanym przywróceniu, więc kopia pozostaje dostępna do ponowienia.

## Co nie jest przenoszone

- **Pamięci podręczne katalogu** (pobrane metadane i bloby zasobów, indeks narzędzi), które cel synchronizuje ponownie za darmo.
- **Narzędzia i zasoby katalogu**, które są poza zakresem i zakłada się, że są już na celu. Tokeny marki, czcionki i logo dodane przez użytkownika są zasobami użytkownika, więc podróżują.
- **Adresy `blob:` i URL obiektów**, które most odtwarza przy wczytaniu.
- **Oryginały konwersji, żywe dzierżawy wykonania i lokalne dla maszyny sekrety dostępu lub podpisywania.** To nie jest przenośna historia. Zapisany wynik jest kopią, a nie obietnicą, że oryginalne źródło zostało objęte kopią zapasową.
- **Licznik sekwencji eksportu**, dzienny licznik nazw pobrań w `localStorage` (`lolly-export-seq`). Jest trzymany poza `PREF_KEYS`, więc nigdy nie jedzie w paczce.

Miernik pamięci pokazuje ten sam podział. Zapisane sesje, My images i File results & versions trafiają do paczki. Pamięć podręczna zasobów, podglądy narzędzi i przypięcia offline pod nimi można odbudować, więc zostają.

![Miernik pamięci rozbijający dane tego urządzenia na nazwane kategorie, z Saved sessions i My images śledzonymi osobno od Asset cache, tutaj na świeżej instalacji, gdzie każda kategoria jest jeszcze pusta](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

## Dane organizacji z Lolly Work

Ta paczka tworzy kopię zapasową osobistej biblioteki urządzenia. Nie jest kopią zapasową instancji **Lolly Work**: konta organizacji, polityki dostępu, wspólne projekty, wersje katalogu, zatwierdzenia, zadania renderowania i zapisy audytu przechowuje ta usługa. Połącz się ponownie i zaloguj, aby odzyskać dostęp do wspólnej pracy; import osobistej paczki nie daje tego dostępu.

Operatorzy tworzą kopie zapasowe, przechowują i usuwają dane serwera według własnych przewodników Lolly Work: [Backup and restore](/info/work-operations.html#backup-and-restore) i [Work storage and data lifecycle](/info/work-data-lifecycle.html). Wyczyszczenie lub eksport urządzenia nie wykonuje żadnej z tych operacji na serwerze.

## W różnych powłokach

`data-transfer.ts` czyta i zapisuje wyłącznie przez most możliwości (`host.profile`, `host.state`, `host.assets`) i wspólne preferencje `localStorage`. Ten sam moduł czyta i zapisuje wspólną kopertę w sieci i w aplikacjach komputerowych i mobilnych, na IndexedDB lub magazynie plików. Opcjonalne części historii pojawiają się tylko tam, gdzie dostępny jest ich adapter, a nieobsługiwana część jest zgłaszana jako pominięta przy imporcie. Zestaw bez interfejsu sprawdza wspólne części na moście w pamięci, a transakcje historii mają też testy w prawdziwej przeglądarce.

Dwie powłoki znajdują się poza tą gwarancją, z różnych powodów:

- **Jednorazowe CLI** nie ma czego przenosić: jego stan jest w pamięci i trwa jedno wywołanie.
- **TUI** trzyma stan w `~/.lolly` (sesje, foldery, profil), a jego widok Profile może go zarchiwizować, ale zapisuje własne, prostsze archiwum: `saved-state/<slot>.json` na sesję plus `profile.json` i `folders.json`, bez manifestu, bez `formatVersion` ani `minReader` i bez mapy integralności. Ten format nie może go zaimportować (czytnik odrzuca je jako "not a Lolly backup"), a jego nazwa jest myląco podobna (`lolly-backup-<stamp>.zip`). Ujednolicenie obu jest znaną luką.

## Jeszcze nieprzenośne

Koperta to manifest plus nazwane części, więc nowe rodzaje przenośnych danych mogą dołączyć później jako części addytywne (nowy `formatVersion`, ten sam `minReader`), a dzisiejsze czytniki pomijają to, czego nie rozpoznają. Systemy projektowe już tak podróżują, jako `design-systems.json` plus ich zasoby użytkownika.

Dwie nazwy są zarezerwowane dla danych, które jeszcze nie podróżują:

- **`tokens.json`** niosłoby cały dokument tokenów projektowych [W3C DTCG](https://tr.designtokens.org/format/) z jego grupami, zestawami i motywami, format, który [Penpot importuje i eksportuje](https://help.penpot.app/user-guide/design-systems/design-tokens/). Własne tokeny marki użytkownika już podróżują jako zasób `user/tokens/brand` w `assets.json`, a tokeny systemu projektowego podróżują z jego zapisem.
- **`penpot/`** jest zarezerwowane dla zaimportowanego pliku Penpot lub jego podzbioru istotnego dla Lolly, udostępnionego jako narzędzie.

Dzisiejsze czytniki nie znają jeszcze żadnej z tych nazw. Jak wszystko inne poza częściami powyżej, każda jest dla nich nieznaną częścią: pozostawioną nietkniętą i policzoną w `skipped`.

## Części historii

Dwie części historii są opcjonalne i mają własne wersje. Większość czytników może pominąć tę sekcję.

::: details Historia prac (v3)
Ręczne kopie zapasowe z instalacji webowej z historią prac zawierają `revision-history.json`, z własnym schematem `{ version: 1, documents, revisions, recoveries }`. Niesie zachowane identyfikatory, kanoniczne migawki danych wejściowych, stemple wersji, podglądy rastrowe i osobne szkice zapisujących. Adapter historii przechwytuje bieżące sesje i ich głowice w jednej transakcji odczytu, a `sessions.json` używa tych samych bieżących migawek dla starszych czytników.

Przywracanie sprawdza SHA-256 ładunku i liczby bajtów, unikalne tożsamości, relacje dokumentu i głowicy, pochodzenie, znaczniki czasu, typy podglądów i limity, zanim zatwierdzi archiwum w jednej transakcji. Skompaktowane odwołania do rodziców mogą brakować. Istniejąca bieżąca praca nigdy nie jest zastępowana po cichu: gdy praca jest po obu stronach, strona niezachowana jako bieżąca staje się chronionym szkicem.

Limit transferu archiwum 384 MiB jest sprawdzany jawnie, a limity pamięci są egzekwowane bez obcinania zachowanych punktów kontrolnych. Eksport zapisuje `revision-history.json` i `sessions.json` w kawałkach, z tymi samymi bajtami, które daje pojedyncze `JSON.stringify`, więc tekst pliku nigdy nie jest trzymany w całości. Plik historii, który przekroczyłby limit, jest porzucany w chwili, gdy go przekroczy, i od tego momentu tylko liczony. Archiwum jest wtedy tworzone ponownie bez swoich najstarszych automatycznych punktów kontrolnych, a podsumowanie eksportu liczy je jako `checkpointsLeftOut`, albo archiwum jest odrzucane w całości.

Powłoka bez tej możliwości przywraca zwykłe sesje i zgłasza część historii jako pominiętą. Natywna historia systemu plików pozostaje nieobsługiwana, dopóki jej adapter nie dostarczy trwałych transakcji historii. Goście w prywatnej współpracy nie mają trwałej historii ani archiwum odzyskiwania.

Osobista synchronizacja migawek pomija historię prac. Zastosowanie migawki do lokalnego dokumentu z historią zachowuje jego poprzedni stan roboczy jako osobny szkic odzyskiwania i unieważnia token zapisu każdego otwartego edytora. Jego niezmienne punkty kontrolne zostają na urządzeniu. To chroni lokalną historię podczas zastąpienia migawką; nie scala równoległych historii urządzeń.

Historyczne odwołania do zasobów są zachowywane, podczas gdy renderowanie nadal rozwiązuje zasoby przez istniejącą bibliotekę celu. To archiwum nie gwarantuje jeszcze dokładnych starych bajtów zasobów ani starych renderów narzędzi. Bajty wersji zasobów i wyników plików podróżują we własnej części kopii zapasowej.
:::

::: details Zapisane wersje i wyniki plików (v2)
Opcjonalna część historii zawiera `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`, a czytniki akceptują też wcześniejszy kształt history-v1 bez partii. Każda migawka podaje stabilny identyfikator zasobu i dokładną wersję, czas zapisu, długość w bajtach i szesnastkowy SHA-256, plus zapis zasobu, którego `_file` i opcjonalny `_credentialFile` wskazują części binarne. Operacje niosą fakty o pliku oryginalnym, żądanie, raport, znaczniki czasu i opcjonalny `_file` wyniku. Nazwy backendów magazynu, uchwyty OPFS i dzierżawy wykonania nie podróżują. Czytniki znające tylko history v1 odrzucają nową wersję historii przed importem, zamiast po cichu gubić członkostwo w partii.

Manifesty partii zapisują każde wybrane źródło przed przetwarzaniem, w tym pliki nigdy nieodczytane, anulowanych członków, niepowodzenia rezerwacji miejsca na wyniki i przerwaną pracę. Każdy członek ma stabilny identyfikator operacji, odwołanie do źródła i fakty, żądaną nazwę wyniku i końcowy raport. Nieodczytane źródło ma zadeklarowane fakty, a nie zmyślony skrót. Import waliduje tożsamość członków i zgodność z każdym niesionym raportem operacji. Raporty partii pozostają dostępne, gdy pojedyncze wyniki usunięto, ale potwierdzenie nie oznacza, że bajty jego wyniku są nadal przechowywane.

- **Najpierw walidacja.** Każdy znany zapis historii, raport i wskazywany plik jest walidowany, zanim jakikolwiek import profilu lub zasobu cokolwiek zapisze. Brakujące bajty i niezgodny SHA-256 kończą się niepowodzeniem, nawet gdy koperta nie ma mapy integralności. Wyodrębnione poświadczenia pozostają tablicami bajtów, także w importach od starszych zapisujących, którzy serializowali je jako obiekty z kluczami liczbowymi.
- **Praca w toku.** Działające operacje stają się w kopii zapasowej przerwanymi zapisami, z wyjaśniającym raportem niepowodzenia i bez wyniku. Przywracanie nigdy nie wznawia pracy w tle ani nie importuje aktywnej dzierżawy. Ponowienie oznacza ponowne wybranie oryginalnego pliku, sprawdzone względem jego zapisanego SHA-256, gdy dostępny.
- **Magazyn.** Przywrócone wyniki zatwierdzają swoje bajty i metadane razem w IndexedDB. Zwykłe nowe wyniki używają OPFS tam, gdzie dostępny, z awaryjnym IndexedDB. Istniejąca żywa operacja nigdy nie jest zastępowana przez import.
- **Limity kopii zapasowej.** Eksport strumieniuje te bajty do archiwum, ale przywracanie nadal rozpakowuje całą kopię zapasową w pamięci, więc limity zostają: **256 MiB ładunku historii**, **4 MiB metadanych historii**, najwyżej **100 operacji**, **100 partii** i **2000 migawek**. Eksport jawnie odrzuca zbyt duże lub niekompletne historie i nigdy nie pomija ich po cichu. Pobierz ważne wersje i wyniki jedna po drugiej, zanim usuniesz starsze lokalne kopie. Te limity nie są zmierzoną gwarancją szczytowej pamięci dla telefonów.
- **Budżety lokalne.** Lokalna historia wyników ma budżet 512 MiB i limit 100 zapisów. Migawki zasobów mają osobny budżet 512 MiB i najwyżej 20 wersji historycznych na zasób, a bajty wyodrębnionych poświadczeń liczą się do tego budżetu. Przywracanie respektuje te limity i nigdy po cichu nie wypiera istniejących danych użytkownika.
- **Metadane partii.** Lokalne metadane partii mają osobny budżet 4 MiB, najwyżej 100 manifestów i 20 członków na partię. Oczekujący członkowie rezerwują pojemność metadanych, z pułapem raportu 32 KiB na członka. To budżet logiczny, a nie gwarancja miejsca na dysku przeglądarki: prawdziwe niepowodzenie limitu jest pokazywane, a raport w pamięci pozostaje do pobrania. Ponowienie członka partii tworzy nową partię bez nadpisywania starego raportu. Usunięcie zapisu partii nie usuwa bajtów pojedynczych wyników ani zasobów biblioteki.
- **Wyniki w bibliotece.** Przekonwertowane wyniki można dodać do biblioteki bez normalizacji ani ponownego kodowania, z dołączonymi skrótami źródła i wyniku oraz relacją operacji. Powtórne dodania używają niezmienionej kopii, a edytowana kopia nigdy nie jest nadpisywana. Obrazy rastrowe mogą zacząć nowy dokument Design, który używa bieżącego identyfikatora zasobu biblioteki; wymuszenie dokładnych przypięć wersji w całym środowisku Design i ścieżce URL to osobna praca. Wyniki SVG, HTML, PDF i ZIP są zachowywane jako nieprzejrzyste zasoby plików, a nie awansowane do zaufanej treści interaktywnej lub wektorowej.
- **Gdzie ludzie to widzą.** **Convert → Recent file operations** pokazuje użycie historii, raporty, pobrania i menedżer wersji, który znajduje też wcześniejsze wersje usuniętych zasobów biblioteki. Przywrócenie migawki tworzy nową bieżącą wersję i zachowuje wybraną migawkę. **Settings → Preferences → Storage** liczy wyniki i wersje oddzielnie od jednorazowych pamięci podręcznych.
- **Czyszczenie.** Jawne czyszczenie plików tymczasowych usuwa tylko bajty należące do operacji i niewskazywane. Bieżące zapisy chronią swoje pliki, a niedawne pliki OPFS mają godzinę karencji. Zapisane wyniki i migawki zasobów nie są czyszczone automatycznie.

Starsze czytniki nadal akceptują kopertę v2 (`minReader: 1`) i przywracają części, które znają, licząc nieobsługiwane części historii jako pominięte. Pełne odzyskanie historii wymaga powłoki z adapterem `fileHistory`, szwem wewnątrz powłoki, a nie nową możliwością `HostV1` skierowaną do narzędzi. Prawdziwe przywracanie na dwóch urządzeniach jest objęte lokalną bramką Chromium; odzyskiwanie na zainstalowanych aplikacjach komputerowych, iOS i Androida nadal trzeba zaakceptować osobno.
:::

## Materiały źródłowe

- Moduł: `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION`; nazywacz `backupFilename()` jest wewnętrzny).
- Test kontraktu: `tests/data-transfer.test.ts`, obejmujący pełny obieg, scalanie, integralność, zgodność w przód i bramkę czytnika.
- Testy kontraktu historii: `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts` i `tests/file-result-library.test.ts`. Akceptacja w przeglądarce: `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts` i `tests/file-result-reuse.browser.test.ts`.
- Używana powierzchnia mostu: `host.profile`, `host.state` i `host.assets`; zobacz [Host API](/info/host-api.html).
