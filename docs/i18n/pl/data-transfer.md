# Transfer danych - paczka `lolly-backup`

Wszystko, co gromadzi użytkownik Lolly, znajduje się **na jego urządzeniu** - bez konta, bez chmury. Paczka transferu danych to sposób, w jaki ta wartość się przemieszcza: eksportujesz ją na jednej instalacji, przenosisz plik dowolną metodą (USB, AirDrop, e-mail do siebie, udział sieciowy) i importujesz na drugiej. Plik *jest* transportem. Cel może być offline lub online. Nie ma to znaczenia, bo nic nigdy nie łączy się z serwerem.

![Dwa przyciski przenoszące całą instalację: Eksportuj moje dane zapisuje jeden plik zip, Import data wczytuje go z powrotem](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=%23storage-section%20.storage-subsection&dark=1&filename=pd-transfer-controls)

Ta strona to specyfikacja formatu. Instrukcję dla użytkownika końcowego znajdziesz w [Znajdź i odzyskaj swoją pracę → Przenieś swoją pracę na inne urządzenie](/info/find-your-work.html#move-your-work-to-another-device). Implementacja to [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts), a [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) zabezpiecza kontrakt pełnego cyklu.

> **Zakres.** Paczka niesie *dane użytkownika*, nie narzędzia z katalogu. Narzędzia i zasoby katalogu są synchronizowane osobno i zakłada się, że już znajdują się na urządzeniu docelowym (w najgorszym razie w nowszej wersji); narzędzia, które użytkownik stworzył sam, podróżują wewnątrz `profile.json`. Import nigdy nie instaluje ani nie aktualizuje narzędzia z katalogu.

## Cele

- <!--i:box--> **Jeden format, każda powłoka.** Web PWA, aplikacje desktopowe/mobilne Tauri i przyszłe powłoki dzielą tę samą kopertę i obsługiwane schematy części. Opcjonalne części zależą od możliwości danej powłoki; nieobsługiwane części są zgłaszane. Każdy mostek możliwości dostarcza własny adapter przechowywania.
- <!--i:shieldcheck--> **Przetrwa podróż.** Paczka uszkodzona lub obcięta w transporcie kończy się głośnym błędem przy imporcie, nigdy częściowym przywróceniem.
- <!--i:clock--> **Przeżyje tę wersję.** Starsza aplikacja nadal może zaimportować rozpoznane części nowszej paczki. Naprawdę niekompatybilny format jest odrzucany w sposób czysty.
- <!--i:check--> **Bezpieczne łączenie.** Import na instalację, która jest już w użyciu, nigdy nie kasuje niczego, czego nie było w paczce.

## Koperta

Paczka to zwykły plik `.zip`. Pobrany plik jest nazwany na cześć osoby, do której należy - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (na przykład `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - dzięki czemu folder Downloads z kopiami zapasowymi pozostaje czytelny. Części imienia i nazwiska pochodzą z profilu i są pomijane, gdy nie są ustawione. Brak profilu daje `LollyTools-2026-06-26-1.zip`, a samo imię daje `LollyTools-Ada-2026-06-26-1.zip`. Każda część jest sanityzowana do tokenu bezpiecznego dla nazwy pliku (zachowywane są litery i cyfry Unicode, spacje i znaki interpunkcyjne są usuwane, maksymalnie 32 znaki). `<n>` to sekwencja liczona dziennie, na urządzenie, dzięki czemu powtórzone eksporty tego samego dnia nie kolidują ze sobą i zachowują kolejność. Nazwę tworzy `backupFilename()` w [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts). Zawartość pliku zip jest identyczna niezależnie od nazwy. W środku:

| Ścieżka | Wymagane | Zawartość |
|---|---|---|
| `manifest.json` | tak | Identyfikator formatu, wersje, liczniki i integralność poszczególnych części. Pierwsza rzecz, na którą patrzy czytnik. |
| `profile.json` | gdy ustawiony | Cały rekord `me` użytkownika: imię i nazwisko, kontakt, odniesienie do zdjęcia profilowego i flagi, plus foldery, Kosz, szkice projektów, szablony użytkownika i narzędzia stworzone przez użytkownika, ulubione, ukryte narzędzia, wybór języka i emoji. Odczytywany przez `host.profile`. |
| `sessions.json` | tak | Każda zapisana sesja: slot, identyfikator/wersja narzędzia, etykieta, miniatura (data-URL) i pełne dane wejściowe. Odczytywana przez `host.state`. |
| `assets.json` | tak | Metadane każdego przesłanego zasobu (obrazy, fonty, tokeny marki, logotypy, zapisane kopie pobrań), z których każdy wskazuje swoje bajty pod `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | na zasób | Surowe bajty zasobu (pliki obrazów i czcionek). Przechowywane bez kompresji (formaty już skompresowane). Rozszerzenie jest kosmetyczne. Rozstrzyga typ MIME w `assets.json`. |
| `assets/blobs/<n>.c2pa` | gdy obecne | Wyodrębnione Content Credentials jako dokładne bajty binarne, wskazywane przez `_credentialFile` w rekordzie zasobu. To nie są klucze podpisujące urządzenia. |
| `design-systems.json` | gdy obecne | Systemy projektowe stworzone lub dodane na tej instalacji, jako `{ active, records }`. Scalane po identyfikatorze przy imporcie; aktywny wybór paczki ma zastosowanie tylko wtedy, gdy urządzenie docelowe nie ma własnego systemu projektowego. |
| `file-history.json` | opcjonalne | Wersjonowane migawki zasobów, raporty operacji terminalowych na plikach i kompletne manifesty wsadowe. Część historii ma własną wersję; dostarczana przez wewnętrzny adapter kopii zapasowych `fileHistory` powłoki. |
| `revision-history.json` | opcjonalne, ręczne kopie zapasowe | Stabilne identyfikatory kreacji, zachowane checkpointy, miniatury i bieżące szkice odzyskiwania. Dostarczana przez `host.state.history.backup` tam, gdzie jest obsługiwana. |
| `file-history/versions/` | na migawkę | Poprzednie bajty zasobu i wyodrębnione poświadczenia, niezależnie od tego, czy bieżący zasób nadal istnieje. |
| `file-history/results/` | na zakończoną operację | Dokładne bajty wyniku. Żaden oryginalny plik wybrany do konwersji nie jest zachowywany ani dołączany. |
| `prefs.json` | tak | Lokalne preferencje należące do użytkownika: `theme`, `sidebarWidth` i licznik aktywności `ct-metrics`. |
| `lolly.txt` | tak | Czytelne dla człowieka podsumowanie paczki (liczniki, profil, nazwa pliku) dla każdego, kto otworzy zip bez Lolly. Regenerowane przy każdym eksporcie i rozpoznawane przy imporcie, więc nigdy nie liczy się jako pominięta część. Jest zapisywane *po* mapie integralności, więc pozostaje poza nią. |

Paczka jest celowo zwykłym zipem: przetrwa nienaruszona każdy transport, a każde narzędzie do rozpakowywania może ją sprawdzić.

`profile.json` to najmniejsza część i ta, którą czytnik widzi jako pierwszą w aplikacji: dane, które twórca wypełnia raz, plus zgoda pozwalająca narzędziom z nich korzystać.

![Formularz danych profilu, który staje się profile.json - imię i nazwisko, kontakt, zdjęcie i zgoda obok nich](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

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

Import to **scalanie**, nigdy pełne zastąpienie:

- Istniejące dane na urządzeniu docelowym pozostają na miejscu.
- Gdy slot sesji lub identyfikator przesłanego obrazu występuje w obu miejscach, zachowywana jest kopia zapisana później, dzięki czemu starsza kopia zapasowa nigdy nie nadpisuje nowszej pracy na urządzeniu docelowym. Równe lub nieznane znaczniki czasu zachowują kopię urządzenia docelowego. Na instalacji webowej z historią kreacji ta sama zasada decyduje, która kopia kreacji pozostaje bieżąca, a druga jest zachowywana jako chroniony szkic (patrz niżej).
- Rekord profilu jest scalany, a nie zastępowany. Każdy folder na urządzeniu docelowym zostaje wraz ze swoją zawartością; folder z paczki, którego brakuje na urządzeniu docelowym, jest dodawany, a folder obecny w obu miejscach zachowuje nazwę i rodzica urządzenia docelowego oraz zyskuje brakujących mu członków z paczki. Sesja przypisana do folderu na urządzeniu docelowym pozostaje w nim przypisana.
- Ulubione (narzędzia, zasoby katalogu i elementy Projektów) są łączone. Szablony, szablony Projektów i narzędzia użytkownika z paczki są dodawane, gdy urządzenie docelowe nie ma rekordu z tym identyfikatorem. Wpisy Kosza z obu miejsc są zachowywane, więc element, który dało się przywrócić na dowolnej instalacji, nadal da się przywrócić.
- Każde inne pole profilu (imię i nazwisko, dane kontaktowe, język, flagi funkcji, ukryte narzędzia i pozostałe ustawienia) zachowuje wartość urządzenia docelowego. Pole puste na urządzeniu docelowym przyjmuje wartość z paczki. To samo dotyczy `prefs.json`: preferencja jest zapisywana tylko tam, gdzie urządzenie docelowe jej nie ma.
- Zwykłe zastosowanie synchronizacji urządzeń jest wyjątkiem: utrzymując urządzenia w zgodzie, przejmuje rekord profilu, preferencje, sesje i obrazy z zsynchronizowanej kopii. Przywrócenie wcześniejszej kopii robi to samo, ponieważ celowo cofa się w czasie. Pierwsze dołączenie, **Przenieś to na to urządzenie**, scala tak jak import.
- Historyczne wersje zasobów i identyfikatory operacji są niezmiennymi wyjątkami: powtórny import jest idempotentny, a identyfikator, który już nazywa inne bajty/historię, jest odrzucany, a nie nadpisywany. Ponowny import identycznego bieżącego zasobu zachowuje jego wersję. Zmieniony bieżący zasób musi nosić inną wersję.
- Historia kreacji również jest scalana. Kreacja obecna po obu stronach zachowuje jako bieżącą kopię zapisaną później, a drugą kopię jako chroniony szkic; kreacja, której slot urządzenie docelowe wykorzystuje dla innej kreacji, jest dodawana obok niej; kreacja w Koszu urządzenia docelowego zostaje w nim. Identyfikator checkpointu, który na urządzeniu docelowym nazywa inną treść, zachowuje wersję urządzenia docelowego. Archiwum, które nie przechodzi własnych kontroli, zatrzymuje import przed jakąkolwiek zmianą profilu, sesji, zasobu lub preferencji. Identyczny powtórny import nie zajmuje dodatkowej pamięci.
- Nic, czego nie było w paczce, nie zostaje naruszone. Sesja, którą miało urządzenie docelowe, a której nie było w paczce, przetrwa import.

Zapisane sesje automatycznie ponownie łączą się ze swoimi obrazami: odniesienia do zasobów są przechowywane po identyfikatorze, a most ponownie je rozwiązuje po przywróceniu przesłanych obrazów (i tak musi to zrobić, bo adresy `blob:` nie przetrwają przeładowania).

Podsumowanie importu zgłasza `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`. `failedAssets` liczy przesłane zasoby, których nie udało się przywrócić (na przykład pełna pamięć urządzenia). To coś innego niż `skipped`, które liczy części od nowszego, kompatybilnego wstecz zapisywacza, jakich ta wersja nie rozpoznała. Interfejs pokazuje `skipped` ("… · N nowszych elementów pominiętych"), więc przywracanie jest szczere co do tego, co zostawiło w tyle.

Gdy obecna jest historia plików, podsumowanie niesie też `assetVersions`, `fileOperations` i `failedHistory`. Wyczerpanie pamięci albo konflikty niezmiennych identyfikatorów mogą spowodować częściowe przywrócenie; interfejs mówi użytkownikowi, aby zachował źródłową kopię zapasową. Synchronizacja w chmurze **nie** przesuwa swojej zastosowanej rewizji po częściowym albo nieobsługiwanym przywróceniu, więc migawka pozostaje dostępna do ponowienia. Przywracanie nie jest jedną transakcją obejmującą wszystkie magazyny profilu/sesji/zasobów/historii.

## Historia kreacji (v3)

Ręczne kopie zapasowe z hosta webowego obsługującego historię zawierają `revision-history.json` z własnym schematem `{ version: 1, documents, revisions, recoveries }`. Niesie zachowane identyfikatory, kanoniczne migawki danych wejściowych, znaczniki wersji, podglądy rastrowe i osobne szkice edytora. Adapter historii przechwytuje bieżące sesje i ich głowy w jednej transakcji odczytu; `sessions.json` używa tych samych bieżących migawek dla starszych czytników.

Przywracanie sprawdza SHA-256 i liczby bajtów ładunku, unikalne tożsamości, relacje dokument/głowa, pochodzenie, znaczniki czasu, typy podglądów i limity, zanim zatwierdzi archiwum w jednej transakcji. Skompaktowane odniesienia do rodzica mogą być nieobecne. Istniejąca bieżąca praca nigdy nie jest cicho zastępowana: gdy kreacja występuje po obu stronach, strona niezachowana jako bieżąca staje się chronionym szkicem. Limit transferu archiwum wynoszący 384 MiB jest sprawdzany wprost, a limity pamięci są egzekwowane bez ucinania zachowanych checkpointów. Cała kopia zapasowa nadal używa implementacji ZIP w pamięci i nie jest archiwum strumieniowym.

Podsumowanie dodaje `revisions` i `recoveryDrafts`, licząc tylko to, co dodał ten import, oraz `added`, `kept`, `replaced`, `copies` i `hidden`, opisujące sposób scalenia każdej kreacji. Powłoka bez tej możliwości przywraca zwykłe sesje i zgłasza część historii jako pominiętą. Historia natywnego systemu plików pozostaje nieobsługiwana, dopóki jej adapter nie dostarczy trwałych transakcji historii. Stan gościa P2P nie ma trwałej historii ani archiwum odzyskiwania.

Osobista synchronizacja migawek celowo wyklucza historię kreacji. Zastosowanie migawki do lokalnego dokumentu niosącego historię zachowuje jego poprzedni stan roboczy jako osobny szkic odzyskiwania i unieważnia token zapisu każdego otwartego edytora. Jego niezmienne checkpointy pozostają na urządzeniu. To chroni lokalną historię podczas zastępowania migawką; nie scala jednoczesnych historii z różnych urządzeń.

Historyczne odniesienia do zasobów są zachowywane, podczas gdy renderowanie nadal rozwiązuje zasoby przez istniejącą bibliotekę celu. To archiwum jeszcze nie gwarantuje dokładnych starych bajtów zasobu ani starych renderów narzędzia. Bajty wersji zasobu i wyniku pliku nadal podróżują przez swoją istniejącą, osobną część kopii zapasowej.

## Zapisane wersje i wyniki plików (v2)

Opcjonalna część historii zawiera `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`; czytniki akceptują też wcześniejszy kształt history-v1 bez batchy. Każda migawka identyfikuje stabilny identyfikator zasobu i dokładną wersję, czas zapisu, długość w bajtach i szesnastkowy SHA-256, plus rekord zasobu, którego `_file` i opcjonalny `_credentialFile` wskazują na części binarne. Operacje niosą oryginalne fakty o pliku, żądanie, raport, znaczniki czasu i opcjonalny wynik `_file`; nazwy backendów przechowywania, uchwyty OPFS i dzierżawy wykonania nie podróżują. Starsze czytniki obsługujące tylko history-v1 odrzucają nową wersję historii przed importem, zamiast po cichu porzucać przynależność do batcha.

Manifesty wsadowe rejestrują każde wybrane źródło przed przetworzeniem, w tym pliki nigdy nieodczytane, anulowanych członków, niepowodzenia rezerwacji miejsca na wynik i przerwaną pracę. Każdy członek ma stabilny identyfikator operacji, odniesienie/fakty źródła, żądaną nazwę wyniku i raport terminalowy. Nieodczytane źródło ma zadeklarowane fakty, nie wymyślony skrót. Import waliduje tożsamość członka i spójność z niesionym raportem operacji. Raporty wsadowe pozostają dostępne, gdy poszczególne wyniki zostały jawnie usunięte, ale potwierdzenie nie oznacza, że jego bajty wyniku są nadal przechowywane.

- Każdy znany rekord historii, raport i odwoływany plik jest walidowany przed jakimkolwiek zapisem importu profilu lub zasobu. Brakujące bajty i niezgodny SHA-256 kończą się niepowodzeniem, nawet jeśli koperta nie ma mapy integralności. Wyodrębnione poświadczenia pozostają tablicami bajtów, w tym importy ze starszych zapisywaczy, które serializowały je do JSON jako obiekty z kluczami numerycznymi.
- Działające operacje stają się w kopii zapasowej przerwanymi rekordami, z wyjaśniającym raportem niepowodzenia i bez wyniku. Przywracanie nigdy nie wznawia pracy w tle ani nie importuje aktywnej dzierżawy. Ponowienie wymaga wybrania oryginalnego pliku, sprawdzanego względem jego zarejestrowanego SHA-256, gdy jest dostępny.
- Przywrócone wyniki zatwierdzają swoje bajty i metadane razem w IndexedDB. Zwykłe nowe wyniki używają OPFS tam, gdzie jest dostępne, z zapasowym rozwiązaniem IndexedDB. Istniejąca aktywna operacja nigdy nie jest zastępowana przez import.
- Składanie ZIP-a historii nadal odbywa się w pamięci: bieżący limit to **256 MiB ładunku historii**, **4 MiB metadanych historii**, najwyżej **100 operacji**, **100 batchy** i **2000 migawek**. Eksport wprost odmawia zbyt dużej lub niekompletnej historii; nigdy nie pomija jej po cichu. Pobierz ważne wersje/wyniki pojedynczo, zanim usuniesz starsze kopie lokalne. Te limity nie są zmierzoną gwarancją szczytowej pamięci dla telefonów.
- Lokalna historia wyników ma budżet 512 MiB i limit 100 rekordów. Migawki zasobów mają osobny budżet 512 MiB i najwyżej 20 historycznych wersji na zasób; bajty wyodrębnionych poświadczeń liczą się do tego budżetu migawek. Przywracanie respektuje te limity i nigdy po cichu nie usuwa istniejących danych użytkownika.
- Lokalne metadane batchy mają osobny budżet 4 MiB, najwyżej 100 manifestów i 20 członków na batch. Oczekujący członkowie rezerwują pojemność metadanych, z pułapem 32 KiB raportu na członka. To budżet logiczny, nie gwarancja miejsca na dysku przeglądarki; rzeczywiste przekroczenie limitu jest ujawniane, a raport w pamięci pozostaje do pobrania. Ponowienie członka batcha tworzy nowy batch bez nadpisywania starego raportu. Usunięcie rekordu batcha nie usuwa pojedynczych bajtów wyniku ani zasobów biblioteki.
- Przekonwertowane wyniki można jawnie dodać do biblioteki bez normalizacji ani ponownego kodowania. Skróty źródła/wyniku i relacja operacji towarzyszą zasobowi. Powtórne dodania używają ponownie niezmienionej kopii; edytowana kopia nigdy nie jest nadpisywana. Obrazy rastrowe mogą rozpocząć nowy dokument Design. Ten dokument używa bieżącego identyfikatora zasobu biblioteki: egzekwowanie dokładnych przypięć wersji w całym środowisku wykonawczym i ścieżce URL Design to wciąż osobna praca. Wyniki SVG/HTML/PDF/ZIP są przez to przekazanie zachowywane jako nieprzezroczyste zasoby plikowe, a nie awansowane do zaufanej treści interaktywnej/wektorowej.
- **Convert → Recent file operations** ujawnia zużycie historii, raporty, pobrania i menedżera wersji. Menedżer znajduje też wcześniejsze wersje usuniętych zasobów biblioteki. Przywrócenie migawki tworzy nową bieżącą wersję, zachowując wybraną migawkę nietkniętą. **Ustawienia → Pamięć** rozlicza wyniki i wersje osobno od pamięci podręcznych do wyrzucenia.
- Jawne czyszczenie plików tymczasowych usuwa tylko bajty należące do operacji, do których nic się już nie odwołuje. Bieżące rekordy chronią swoje pliki; niedawne pliki OPFS mają godzinny okres karencji. Zapisane wyniki i migawki zasobów nie są czyszczone automatycznie.

Starsze czytniki nadal akceptują kopertę v2 (`minReader: 1`) i przywracają znajome części, licząc nieobsługiwane części historii jako pominięte. Pełne odzyskiwanie historii wymaga powłoki z adapterem `fileHistory`; to wewnętrzny szew powłoki, nie nowa możliwość `HostV1` widoczna dla narzędzi. Prawdziwe przywracanie między dwoma urządzeniami obejmuje lokalna bramka Chromium; akceptacja odzyskiwania na zainstalowanym Tauri/iOS/Androidzie pozostaje osobną sprawą.

## Co nie jest przenoszone

- **Pamięci podręczne katalogu** (pobrane metadane i blob-y zasobów, indeks narzędzi) - ponownie synchronizowane bezkosztowo na urządzeniu docelowym.
- **Narzędzia i zasoby katalogu** - poza zakresem, zakłada się, że już są obecne na urządzeniu docelowym. Tokeny marki, fonty i logotypy dodane przez użytkownika są zasobami użytkownika, więc podróżują.
- **Adresy `blob:` / object URL** - regenerowane przez most przy wczytywaniu.
- **Oryginały konwersji, aktywne dzierżawy wykonania i lokalne dla maszyny sekrety dostępu/podpisywania** - nie są przenośnym ładunkiem historii. Zapisany wynik jest kopią, nie obietnicą, że oryginalne źródło miało kopię zapasową.
- **Licznik sekwencji eksportu** - dzienny licznik nazewnictwa pobrań (klucz `localStorage` `lolly-export-seq`) to lokalna wygoda nazewnicza. Jest utrzymywany poza `PREF_KEYS`, więc nigdy nie jedzie w paczce.

Miernik pamięci wylicza ten sam podział. Zapisane sesje, Moje obrazy oraz Wyniki i wersje plików jadą w paczce. Pamięć podręczna zasobów, podglądy narzędzi i przypięcia offline poniżej nich są w pełni odtwarzalne, więc zostają na miejscu.

![Miernik pamięci dzielący dane tego urządzenia na nazwane kategorie, z Saved sessions i My images śledzonymi osobno od Asset cache, tutaj na świeżej instalacji, gdzie każda kategoria jest wciąż pusta](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=.store-manages%2C.storage-subsection%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&walker=1&dark=1&filename=ce-storage-categories)

## Gwarancja między powłokami

`data-transfer.ts` odczytuje i zapisuje wyłącznie przez mostek możliwości (`host.profile`, `host.state`, `host.assets`) oraz wspólne preferencje `localStorage`. Ten sam moduł odczytuje i zapisuje wspólną kopertę na web i Tauri, przez IndexedDB albo pamięć systemu plików. Opcjonalne części historii pojawiają się tylko tam, gdzie dostępny jest odpowiedni adapter; nieobsługiwana część jest zgłaszana jako pominięta przy imporcie. Zestaw testów bezgłowych ćwiczy wspólne części względem mostka w pamięci, podczas gdy transakcje historii mają też testy w prawdziwej przeglądarce.

Dwie powłoki znajdują się poza tą gwarancją, z różnych powodów:

- **Jednorazowy CLI** nie ma nic do przeniesienia - jego stan istnieje w pamięci i jest ulotny w obrębie jednego uruchomienia.
- **TUI** rzeczywiście utrwala stan (`~/.lolly`: sesje, foldery, profil), a jego widok Profil może go zbackupować, ale zapisuje *prostsze* archiwum własnego formatu: `saved-state/<slot>.json` na sesję plus `profile.json` i `folders.json`, bez manifestu, bez `formatVersion`/`minReader` i bez mapy integralności. **Nie** da się go zaimportować w tym formacie - czytnik odrzuca je jako „not a Lolly backup” - i myląco używa podobnej nazwy (`lolly-backup-<stamp>.zip`). Ujednolicenie obu jest znaną luką.

## Zarezerwowane punkty rozszerzeń

Koperta jest z założenia manifestem plus zestawem nazwanych części, dzięki czemu nowe rodzaje przenośnych danych będą mogły jechać na niej później **bez zmiany łamiącej kompatybilność**. Wchodzą jako dodatkowe części (nowe `formatVersion`, ten sam `minReader`), a dzisiejszy czytnik pomija to, czego nie rozpoznaje. Nie są one jeszcze zbudowane. Nazwy są tu zarezerwowane, żeby format pozostał spójny, gdy się pojawią.

- **`tokens.json` - tokeny projektowe.** Dokument tokenów projektowych [W3C DTCG](https://tr.designtokens.org/format/) (format, który [Penpot importuje i eksportuje](https://help.penpot.app/user-guide/design-systems/design-tokens/) - tokeny z `$value`/`$type`/`$description`, zorganizowane w grupy, zestawy i motywy). Zestaw tokenów w paczce pozwala użytkownikowi przenieść swoje prymitywy marki między instalacjami razem z sesjami. (Własne tokeny marki użytkownika już dziś podróżują jako zasób `user/tokens/brand` w `assets.json`; ta część niosłaby cały dokument DTCG z jego zestawami i motywami.) W dłuższej perspektywie zaimportowany zestaw tokenów stanie się pełnoprawnym źródłem, względem którego narzędzia i zasoby palety będą się rozwiązywać.
- **`penpot/` - zaimportowane pliki Penpot.** Zarezerwowany katalog na plik Penpot (lub jego wyodrębniony, istotny dla Lolly podzbiór) zaimportowany i udostępniony *jako narzędzie*. Paczka będzie nosić zaimportowaną definicję, więc podróżuje razem z resztą danych użytkownika.

Wszystko poza tymi zarezerwowanymi nazwami i częściami powyżej jest dla czytnika nieznaną częścią: pozostawioną nietkniętą i policzoną w `skipped`.

## Materiały źródłowe

- Moduł: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - funkcja nadająca nazwę `backupFilename()` jest wewnętrzna).
- Test kontraktowy: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - przypadki pełnego cyklu, scalania, integralności, zgodności wstecznej i bramki czytnika.
- Testy kontraktowe historii: [`tests/file-history-backup.test.ts`](../tests/file-history-backup.test.ts), [`tests/file-batch-history.test.ts`](../tests/file-batch-history.test.ts) i [`tests/file-result-library.test.ts`](../tests/file-result-library.test.ts). Akceptacja w przeglądarce: [`tests/file-history.browser.test.ts`](../tests/file-history.browser.test.ts), [`tests/file-batch-history.browser.test.ts`](../tests/file-batch-history.browser.test.ts) i [`tests/file-result-reuse.browser.test.ts`](../tests/file-result-reuse.browser.test.ts).
- Używana powierzchnia mostka: `host.profile`, `host.state`, `host.assets` - zobacz [Host API](/info/host-api.html).
