# Profile - kim jesteś, gdy tworzysz

**Profil** to tożsamość robocza, jako którą tworzy Lolly. To niewielki zestaw danych, z których może korzystać narzędzie, żebyś nie musiał wpisywać ich za każdym razem - Twoje imię i nazwisko, dane kontaktowe, opcjonalne zdjęcie profilowe, kilka preferencji - plus wszystko, co gromadzisz podczas pracy: zapisane sesje, przesłane obrazy i lokalny licznik aktywności.

Wszystko w profilu znajduje się **na urządzeniu**, w lokalnej bazie danych przeglądarki (IndexedDB w webowej aplikacji PWA, system plików w aplikacjach Tauri). Nie ma konta i nic nie jest przesyłane. Zarządzasz tym w **Ustawienia → Preferences** (w stopce lub w menu awatara); narzędzia zawsze tylko to *odczytują*, i wyłącznie te konkretne pola, do których wstępnego wypełniania zostały stworzone.

> Ustawienia łączą twój profil i dawny Dashboard w jedno miejsce. **Preferences** zawiera twoje dane i osobiste wybory; obok nich znajdują się **To urządzenie**, **System projektowy**, **Możliwości** i **Aktywność i statystyki**. Zobacz [Ustawienia](/info/dashboard.html), aby poznać pełną mapę.

## Co zawiera profil

| Część | Co to jest |
|---|---|
| **Imię i nazwisko** | Imię i nazwisko. |
| **Kontakt** | E-mail i telefon. |
| **Lokalizacja** | Miasto i kraj. |
| **Zdjęcie profilowe** | Opcjonalne zdjęcie, przycięte do kwadratu i przechowywane jako obraz lokalny. Używane przez narzędzia takie jak podpisy e-mail, karty cytatów, schematy organizacyjne i dynamiczne układy. |
| **Use my details to create** | Pojedynczy przełącznik opt-in (po włączeniu wyświetla **Using my details**). Kontroluje, czy Twoje dane osobowe są dołączane jako **pochodzenie (provenance)** - linia autora/uznania osadzona w eksportowanych plikach - oraz jako autor w przebiegach wsadowych **/pro**. (Nie blokuje automatycznego wypełniania: zobacz [Jak narzędzia korzystają z Twojego profilu](#how-tools-use-your-profile).) |
| **Preferencje** | Twój motyw (Light, Dark lub Brand - motyw marki maluje aplikację we własnej palecie) oraz to, które części aplikacji włączyłeś przez **Flagi funkcji**. |
| **Dostępność** | Cztery przełączniki komfortu - *Reduce motion*, *Hide colourful previews*, *High contrast*, *Large text* - przechowywane w rekordzie profilu, więc podróżują w eksporcie profilu. Zobacz [Dostępność](#accessibility). |
| **Twoja praca** | Zapisane sesje (z miniaturami) - zorganizowane w zagnieżdżonych folderach w **[Projects](/info/using.html)** - Twoja biblioteka **My images** i lokalne statystyki aktywności, wszystko powiązane z tym profilem. |

Nic z tego nie jest wymagane. Pusty profil to całkowicie dobry profil; wypełniasz tylko to, co oszczędza ci pisania.

![Ekran Profile - imię i nazwisko, kontakt, opcjonalne zdjęcie profilowe i Twoje preferencje](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

Preferencje to jedyna część, która zmienia to, jak aplikacja wygląda z twojej strony. Karty motywów są żywymi podglądami i stosują się w chwili, gdy którąś wybierzesz - tylko na tym urządzeniu.

Strona jest długa, więc ma własny **pasek ustawień** z boku - Twoje dane, Wygląd, Dostępność, Instancja Lolly, Twoja aktywność, Pamięć, Dostępne offline, Flagi funkcji, Content Credentials - z polem **Szukaj w ustawieniach** nad nim, które filtruje listę podczas pisania. Każda sekcja ma własny głęboki link w postaci `#/settings?focus=<section-id>`, który ją otwiera i przewija do niej widok (`#/settings?focus=storage-section`, `?focus=feature-flags-section` i tak dalej), więc link może wskazywać jedno ustawienie zamiast góry strony.

![Trzy karty motywów, każda z podglądem własnej typografii i koloru, z oznaczoną aktywną](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

## Profil to kontekst, a nie tylko osoba

Słowo „profil" sugeruje jedną, stałą osobę, ale w Lolly to tak naprawdę **kontekst tworzenia** - *kim jesteś, gdy tworzysz daną rzecz*. Ten kontekst może przybierać trzy różne formy, a Lolly obsługuje je wszystkie tak samo.

### Jako osoba

![The headshot control, empty until you upload a photo that then stays on this device](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot&css=.profile-details-main%7Bdisplay%3Anone%7D)

![Kontrolka zdjęcia profilowego, pusta, dopóki nie prześlesz zdjęcia, które potem pozostaje na tym urządzeniu](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot&css=.profile-details-main%7Bdisplay%3Anone%7D)

### Jako zespół

Profil nie musi być jedną osobą. Może reprezentować **zespół lub funkcję w organizacji**: wspólną nazwę zespołu, adres skrzynki grupowej (`events@…`), dział, zdjęcie profilowe zespołu lub znak jednostki. Jedna osoba go konfiguruje, eksportuje (patrz niżej), a reszta zespołu wczytuje ten sam profil - dzięki czemu wszystko, co tworzy zespół, niesie spójne dane bez konieczności ponownego ich wpisywania przez kogokolwiek. Współdzielony kiosk lub wypożyczony laptop demo może działać na pojedynczym profilu zespołu, jako który tworzy każdy, kto z niego korzysta.

### Jako funkcja - rola, którą czasem przyjmujesz

To przypadek, który pomija sztywny model „jedna osoba, jeden profil". Możesz być **menedżerem wydarzeń przez trzy dni w roku**, a przez resztę czasu kimś zupełnie innym. Przez te trzy dni chcesz mieć dane wydarzenia, skrzynkę wydarzenia, może pod-markę wydarzenia, żeby wypełnić identyfikatory i oznakowanie; przez pozostałe 362 dni chcesz odzyskać swoją zwykłą tożsamość.

W Lolly ta rola to po prostu **kolejny profil, który masz pod ręką** - zapisany pakiet (następna sekcja), który wczytujesz na czas wydarzenia i odkładasz na bok po jego zakończeniu. Rola to kapelusz, a nie nowe konto. Zakładaj go, gdy go potrzebujesz, i zdejmuj, gdy skończysz.

## Jedna instalacja, jeden aktywny profil - wiele możesz zachować

W dowolnej chwili instalacja ma **jeden aktywny profil** - dane, które narzędzie widzi w tej chwili. Nie ma przełącznika profili w aplikacji; zamiast tego każdy profil to **przenośna paczka** (pojedynczy plik `.zip`, zobacz [niżej](#moving-a-profile-to-a-new-device)). To celowo ten sam mechanizm co przenoszenie na nowe urządzenie - profil to plik, który możesz zapisać, skopiować i wczytać.

Jeśli więc naprawdę żonglujesz kilkoma kontekstami (ty, twój zespół, kapelusz menedżera wydarzeń), trzymasz kilka pakietów i wczytujesz ten, którego potrzebujesz:

- <!--i:trash--> **Najczystsze przejście:** **Ustawienia → Preferences → Pamięć → Wyczyść wszystkie moje dane**, a potem **Importuj** paczkę dla kontekstu, w który wchodzisz. Od teraz tworzysz wyłącznie jako ten profil.
- <!--i:layers--> **Warstwowanie:** import *bez* wcześniejszego czyszczenia **scala** - zaimportowane sesje i obrazy lądują na tym, co już tam jest; gdy oba mają ten sam element, zachowywana jest kopia zapisana później, a reszta pozostaje nietknięta. Foldery, ulubione i szablony są dodawane do twoich, a twoje własne dane i ustawienia zostają. Przydatne, gdy chcesz przenieść zapisane sesje jednego zespołu do swojej konfiguracji; nieprzydatne, jeśli potrzebujesz czystej granicy ról.
- <!--i:monitor--> **Obok siebie:** ponieważ wszystko jest przypisane do urządzenia, osobny profil przeglądarki, osobne konto użytkownika albo druga zainstalowana aplikacja PWA - każde niesie własny, niezależny profil Lolly. Uruchom jednocześnie swoją prywatną instalację i instalację kioskową na wydarzenie, bez przełączania.

Oba te warianty żyją w sekcji Pamięć: miernik rozlicza każdy bajt, który przechowuje ta instalacja, kategoria po kategorii, a przyciski pod nim służą do wyczyszczenia albo przeniesienia danych.

![Miernik pamięci, rozbijający zapisane sesje, obrazy i pamięć podręczną względem tego, co faktycznie zgłasza przeglądarka](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

> Trzymaj po jednym pakiecie na kontekst i zmieniaj nazwy plików tak, by odzwierciedlały ich zawartość (`LollyTools-events-2026.zip`, `LollyTools-me.zip`). Plik *jest* profilem.

## Dostępność

**Ustawienia → Preferences → Dostępność** zawiera cztery ustawienia komfortu dla aplikacji *wokół* twojej pracy. Każde jest wyłączone, dopóki go nie włączysz, i żadne z nich nie sięga do wnętrza płótna narzędzia ani eksportu - spokojniejsza aplikacja nie może ruszyć ani jednego piksela pliku, który wysyłasz.

- <!--i:film--> **Reduce motion** - wyłącza przejścia, przesunięcia i animowane ozdobniki w aplikacji. Płótno Twojego narzędzia i każdy animowany eksport poruszają się dokładnie tak, jak zaprojektowano.
- <!--i:image--> **Hide colourful previews** - zamienia kolorowe grafiki podglądu w galerii na spokojne karty z ikoną i tekstem oraz obniża nasycenie i kontrast miniatur Twoich projektów, żeby pozostały rozpoznawalne bez krzykliwości. Wewnątrz narzędzia wszystko wyświetla się w pełnym kolorze.
- <!--i:sliders--> **High contrast** - wzmacnia obramowania, tekst i pierścienie fokusu aplikacji. Kolory Twojej marki i wszystko na płótnie pozostają dokładnie takie, jak je ustawiłeś.
- <!--i:font--> **Large text** - powiększa typografię aplikacji: etykiety, menu i tekst przycisków. Kontrolki zachowują swój rozmiar, więc powiększają się tylko słowa wewnątrz nich, a typografia wewnątrz Twoich projektów pozostaje nietknięta, więc nic, co eksportujesz, się nie przełamuje.

Te ustawienia znajdują się w samym rekordzie profilu, dlatego podróżują w eksporcie profilu i trafiają na kolejną instalację razem z Twoim imieniem i sesjami. (Urządzenie przechowuje też małe lokalne lustro, żeby ustawienie zadziałało przed pierwszym renderowaniem; to lustro jest lokalne dla urządzenia i nie podróżuje.)

## Twoja instancja Lolly

**Ustawienia → Preferences → Instancja Lolly** pokazuje, skąd ta instalacja pobiera swoje narzędzia i katalog - adres instancji, albo *Dołączone do tej aplikacji*, gdy wszystko jest dostarczane wewnątrz builda. Tam, gdzie wdrożenie to oferuje, link **Konsola instancji** otwiera jego panel administracyjny, **Zmień** przekierowuje instalację, a **Opuść** usuwa system projektowy, narzędzia i katalog instancji, podczas gdy twoja własna praca pozostaje (zobacz [Używaj Lolly w swojej organizacji](/info/organisation.html#leaving)).

Przekierowanie na inną instancję wymaga **aplikacji desktopowej**: przeglądarka blokuje stronie ładowanie narzędzi i zasobów z innych źródeł, więc w wersji webowej ta sekcja zgłasza tylko, gdzie jesteś, i na tym poprzestaje.

## Dostępne offline

Lolly buforuje w miarę korzystania, ale bieżące buforowanie obejmuje tylko to, gdzie już byłeś. **Ustawienia → Preferences → Dostępne offline** jest na wyjazd, który widzisz nadchodzący: godzinę na lotniskowym wifi przed lotem bez żadnego. Pobierz części, których będziesz potrzebować, obserwuj jeden pasek postępu, a wszystko, co zabrałeś, działa dalej po zniknięciu połączenia.

Siedem części, każda z podanym rozmiarem, zanim się zdecydujesz:

- <!--i:layout--> **Aplikacja** - każdy widok, edytor i czcionka, w tym te, których jeszcze nie otworzyłeś. Bez tego ekran, którego nigdy nie odwiedziłeś online, nie może wczytać się offline.
- <!--i:image--> **Katalog** - zasoby marki wykraczające poza podstawy. Weź wszystko albo otwórz *Choose by tag* i weź tylko tagi, których używasz.
- <!--i:book--> **Przewodniki i dokumentacja** - ta strona z dokumentacją, w Twoim języku, wraz ze zrzutami ekranu.
- <!--i:cpu--> **Głosy mowy** - modele głosowe stojące za dźwiękiem i narracją Script. Pobierane raz, potem działają na urządzeniu.
- <!--i:zap--> **Modele powiększania (upscaling)** - powiększacze obrazów AI: zdjęcia, ilustracji/anime i twarzy.
- <!--i:layers--> **Usuwanie tła** - modele wycinania na urządzeniu stojące za *Remove background*.
- <!--i:shield--> **Głębokie skanowanie Verify** - skaner znaków wodnych na urządzeniu, do sprawdzania Content Credentials bez połączenia.

Ostatnie cztery są oznaczone jako **duże pobieranie** i są celowo osobnymi, dobrowolnymi opcjami: **Pobierz wszystko** na górze pobiera aplikację, wybrany zakres katalogu, dokumentację i wszystkie narzędzia w jednym przebiegu i nic ponad to. Głosy mowy, moduły powiększania, usuwanie tła i głębokie skanowanie pobierają się dopiero, gdy poprosisz o dany wiersz z osobna - kilkaset megabajtów ukrytych w jednym przycisku byłoby nieuczciwe.

Pod poszczególnymi częściami znajduje się lista narzędzi: każde narzędzie pobiera się osobno (znacznik oznacza gotowość offline), albo **Pobierz wszystko** zgarnia je wszystkie naraz. Pobieranie można wznawiać - anuluj lub utrać połączenie, a kolejne uruchomienie podejmie pracę tam, gdzie się zatrzymało, pobierając tylko brakujące elementy - a gdy wrócisz do sieci, dane odświeżają się same, pobierając tylko to, co zmieniło nowe wydanie.

Jeśli przeglądarka nie przyznała trwałego magazynu, sekcja informuje o tym i oferuje **Zabezpiecz pobrane pliki**, co prosi o taką zgodę - to różnica między „pobrano” a „pobrano, dopóki przeglądarka nie zechce odzyskać miejsca”.

## Przenoszenie profilu na nowe urządzenie

Ponieważ profil jest w całości lokalny, istnieją dwa sposoby, by przenieść go na pustą instalację - nowy laptop, świeżo zresetowaną przeglądarkę, komputer współpracownika, maszynę offline. **Przenieś plik**, jak poniżej, albo trzymaj swoje urządzenia w zgodzie przez wybraną przez siebie pamięć, jak wyjaśnia [Synchronizuj swoje urządzenia](/info/sync.html). Żadne logowanie do Lolly nie przywróci go za ciebie, i o to właśnie chodzi: nic nigdy nie trafiło na serwer Lolly, żeby zacząć.

W **Ustawienia → Preferences → Pamięć → Przenieś na inne urządzenie**:

- <!--i:download--> **Eksportuj moje dane** pobiera jeden plik `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` - nazwany według profilu, do którego należy, z numerem porządkowym dnia, aby powtórne eksporty się nie zderzały (części nazwy są pomijane, gdy profil ich nie ma). Zawiera twój profil, każdą zapisaną sesję (wraz z jej miniaturą), twoje przesłane obrazy - twoje tokeny marki i zainstalowane fonty jadą razem jako zasoby użytkownika - oraz twoje preferencje (motyw, układ, lokalne statystyki aktywności).
- <!--i:upload--> **Importuj dane…** na drugiej instalacji wczytuje ten plik z powrotem i kontynuujesz dokładnie tam, gdzie skończyłeś. Bierze też kopię, którą [Synchronizacja](/info/sync.html) przechowuje w twojej pamięci.
- <!--i:box--> **Eksportuj moje dane & wyrenderuj wszystko** zapisuje tę samą kopię zapasową *plus* drugi plik zip, który renderuje każdą zapisaną sesję do jej gotowego pliku wynikowego, w folderach odzwierciedlających twoje Projekty. Kompletne archiwum offline zarówno źródeł, jak i wyników - i przy dużej liczbie sesji może być duże i wolne.

![Dwa przyciski przenoszące całą instalację: Eksportuj moje dane zapisuje jeden plik zip, Import data wczytuje go z powrotem](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

Paczka to zwykły, samowystarczalny zip, więc podróżuje **dowolnym** sposobem - przez USB, AirDrop, udział sieciowy, e-mail do samego siebie - a urządzenie docelowe może być całkowicie offline. Każda część ma sumę kontrolną, dzięki czemu plik uszkodzony w trakcie przesyłania jest wykrywany podczas importu, a nie przywracany w połowie zepsuty. Import **scala** dane (dla sesji lub obrazu o tej samej nazwie zachowywana jest kopia zapisana później; foldery, ulubione i szablony są dodawane; dane i ustawienia urządzenia docelowego zostają; wszystko inne jest zachowywane), więc nigdy nie czyści urządzenia docelowego, które już było w użyciu.

Co nie jest przenoszone: pamięć podręczna katalogu (pobiera się ponownie na nowym urządzeniu) oraz same narzędzia (zakłada się, że są już obecne).

Dokładny układ paczki, politykę wersji i zasady integralności znajdziesz w **[Data Transfer](/info/data-transfer.html)**; pełny przewodnik krok po kroku - w **[Using Lolly → Moving to another device](/info/using.html#moving-to-another-device)**.

## Jak narzędzia korzystają z twojego profilu

![The single Use my details switch, sitting beside Save Profile and off until you turn it on](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Duse-details&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

Narzędzie zawsze tylko *wstępnie wypełnia* te pola profilu, do których powiązania zostało wyraźnie stworzone:

**Opcja dobrowolna (pochodzenie).** Gdy eksportujesz zasób, twoje dane opcjonalnie jadą razem jako **pochodzenie (provenance)** - linia autora/uznania osadzona w metadanych pliku (PNG, PDF, SVG, …) - dzięki czemu gotowy zasób może wskazać, kto go stworzył. *To właśnie* reguluje **Użyj moich danych, aby utworzyć**: pozostaw to wyłączone, a eksport nadal będzie nosił atrybucję narzędzia/platformy „Wykonano w Lolly”, ale bez osadzonej osobistej linii autora/kontaktu. (Ta sama opcja ustawia autora również w przebiegach wsadowych **/pro**.) (Autorzy narzędzi: zobacz [Tworzenie narzędzi → `bindToProfile`](/info/tool-inputs.html#bindtoprofile) i [Host API → `host.profile`](/info/host-api.html#host-profile).)

![Pojedynczy przełącznik Użyj moich danych, aby utworzyć, obok Zapisz profil i wyłączony, dopóki go nie włączysz](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Duse-details&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## Profil a Platforma a Możliwości

Trzy rzeczy sąsiadują ze sobą w interfejsie i łatwo je pomylić:

- <!--i:people--> **Profil** - *Ty* (lub Twój zespół, albo pełniona rola): imię i nazwisko, kontakt, zdjęcie, zapisana praca. Osobisty, lokalny na urządzeniu, przenośny jako paczka.
- <!--i:palette--> **Platforma** - *marka*: kolory, czcionki i ustawienia globalne, względem których renderuje każde narzędzie. Współdzielona i spójna, nie osobista.
- <!--i:sliders--> **Możliwości** - *co potrafi aplikacja*: pełny zestaw funkcji i dostępnych dla Ciebie narzędzi.

Profil zmienia to, *od kogo* pochodzi zasób; platforma zmienia to, *jak wygląda*; możliwości to *to, co możesz stworzyć*.

### „Profil" ma gdzie indziej jeszcze dwa inne znaczenia - nie to opisane tutaj

Słowo to jest przeciążone znaczeniowo w całym projekcie. Żadne z poniższych nie jest osobistym profilem, o którym mowa na tej stronie:

- <!--i:box--> **Profil treści** - konfiguracja czasu budowy w `profiles.json`, wiążąca zestaw paczek narzędzi z katalogiem marki (np. `suse`, `lolly-start`). To wybiera operator wdrażający system, a jednocześnie **parametr URL/CLI** `profile` wybiera także wariant *kolorystyczny* przy eksporcie (warunki druku ICC/CMYK - zobacz [URL Mode](/info/url-mode.html)). Oba dotyczą *budowy/wyniku*, nie *Ciebie*. Zobacz [Configuration](/info/configuration.html).
- <!--i:seal--> **Profil tożsamości** - opcjonalna **zweryfikowana tożsamość Content Credentials**, którą możesz zarejestrować (krótkotrwały certyfikat wiążący Twój adres e-mail z podpisanymi eksportami). To tożsamość podpisująca, odrębna od pól imienia/kontaktu w profilu osobistym, choć przełącznik **Use my details to create** reguluje, czy którekolwiek z nich zostanie osadzone. Zobacz [Content Credentials Identity](/info/content-credentials-identity.html).

![Karta Verified identity, szerokość telefonu: wybór okresu ważności certyfikatu i krok rejestracji poniżej - profil tożsamości, odrębny od twoich danych osobowych](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## Prywatność

Poza opcjonalną rejestracją tożsamości opisaną wyżej (która wysyła zarejestrowany adres e-mail do usługi certyfikatów - zobacz [Server Surface](/info/server-surface.html)), profil nigdy nie jest przesyłany, wysyłany ani używany do identyfikacji czy śledzenia cię - nie ma tu niczego, na co trzeba wyrazić zgodę, jest to wyłącznie informacja, co jest przechowywane. Usuń to wszystko w dowolnej chwili przez **Ustawienia → Preferences → Wyczyść wszystkie moje dane**. Zobacz [Privacy Policy](/info/privacy.html).
