# Rozszerzenie przeglądarki

Strona internetowa nie może odczytać pikseli innej witryny, więc aplikacja internetowa Lolly potrzebuje pomocy, aby zrobić zrzut strony. W przeglądarce opartej na Chromium (Chrome, Edge, Brave, Arc lub Opera, od Chrome 111) darmowe rozszerzenie **Lolly URL Screenshot** daje tę pomoc, używając tego samego przechwytywania co aplikacja komputerowa. Po jego zainstalowaniu:

- **[URL Screenshot](/t/url-shot)** zapisuje skomponowaną stronę jako plik;
- adres internetowy wklejony do slotu obrazu może stać się zrzutem tej strony przez **Screenshot this page**;
- źródło **Website** w [Design System Setup](/info/brand-studio.html) może odczytać jedną stronę, aby zacząć system projektowy.

Zatwierdzasz każde żądanie, a aplikacja komputerowa wykonuje te same zadania bez rozszerzenia.

## Przed instalacją

Dopóki rozszerzenie nie jest zainstalowane, **URL Screenshot** nadal się otwiera, więc możesz skomponować ujęcie. Uwaga na górze kontrolek narzędzia mówi, czego brakuje.

![Notatka narzędzia URL Screenshot oferująca rozszerzenie, pokazywana gdy przechwytywanie do pliku nie ma hosta, na którym mogłoby działać](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Każda kontrolka działa, gdy czekasz: docelowy URL, głębokość przewijania, opóźnienie ustabilizowania, wcięcia kadru i zmiana kolorów. Samo przechwycenie potrzebuje rozszerzenia.

![Kontrolki URL Screenshot z docelowym URL, głębokością przewijania, opóźnieniem ustabilizowania i marginesami kadrowania, wszystkie użyteczne zanim rozszerzenie istnieje](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Instalacja

**Ze sklepu Chrome Web Store:** wkrótce. Gdy rozszerzenie zostanie opublikowane, zainstalujesz je jednym kliknięciem.

**Wczytaj je sam (deweloperzy).** Rozszerzenie żyje w repozytorium w `shells/chrome-extension/`. Ten folder to kompilacja produkcyjna, która działa tylko z Lolly pod `https://lolly.tools`.

1. Otwórz `chrome://extensions`.
2. Włącz **Developer mode** (prawy górny róg).
3. Kliknij **Load unpacked** i wybierz folder `shells/chrome-extension/`.
4. Przeładuj kartę Lolly. Wykrywanie dzieje się przy ładowaniu strony, więc monit "Get the extension" znika. **URL Screenshot** (w Utilities) może wtedy zapisywać przechwycenia do pliku i staje się dostępny w trybie Batch.

Dla lokalnego serwera deweloperskiego uruchom `pnpm run pack:chrome-extension:dev` i wczytaj zamiast tego `dist/chrome-extension-dev`. Ten pakiet akceptuje też `http://localhost:5173` i ma w nazwie **Development**.

## Co się dzieje, gdy Lolly prosi

![Karta Lolly prosi o jedną stronę, a Ty naciskasz Approve once w oknie zatwierdzenia rozszerzenia. Otwiera się karta w tle, czyta stronę i się zamyka. Potem karta Lolly dostaje wynik.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly prosi.** Mały skrypt mówi Lolly, że rozszerzenie jest obecne, więc przechwycenie lub odczyt strony może zacząć się bez dalszej konfiguracji.
2. **Zatwierdzasz.** Rozszerzenie otwiera własne okno **Approve page request**. Pokazuje witrynę wysyłającą żądanie, czy chce zrzutu ekranu, czy zawartości strony, oraz adres strony. Nic nie jest odczytywane, dopóki nie naciśniesz **Approve once**. **Cancel** lub zamknięcie okna kończy żądanie.
3. **Chrome pyta raz na witrynę.** Przy pierwszym zatwierdzeniu żądania dla witryny Chrome pyta też, czy rozszerzenie może mieć dostęp do tej witryny. Chrome zachowuje ten dostęp po zezwoleniu, ale każde późniejsze żądanie nadal wymaga własnego **Approve once**.
4. **Strona jest czytana w karcie w tle.** Rozszerzenie otwiera stronę docelową w karcie w tle, przechwytuje ją przez DevTools Protocol (ten sam `Page.captureScreenshot`, którego używa aplikacja komputerowa), zamyka kartę i oddaje wynik karcie Lolly, która o to poprosiła.

Zatwierdzenie obejmuje jedno żądanie i wygasa po 30 sekundach. Naraz może czekać lub działać tylko jedno żądanie, a zatwierdzone żądanie zatrzymuje się po 55 sekundach. Jeśli strona Lolly zostanie zamknięta lub się zmieni albo strona docelowa przejdzie do innej witryny, żądanie jest anulowane.

Przechwytywanie działa w Twojej przeglądarce, w Twojej sieci, więc `localhost` i witryny wewnętrzne działają. Strona ładuje się z sesją Twojej przeglądarki, więc strona, na którą jesteś zalogowany, może pokazać w wyniku prywatne informacje. Przechwycenie nie jest wysyłane: jedyny ruch sieciowy to Twoja własna przeglądarka ładująca stronę, o którą poprosiłeś.

Podczas przechwytywania możesz na chwilę zobaczyć baner *"…started debugging this browser"* na tymczasowej karcie. To działa DevTools Protocol, a baner znika po zakończeniu ujęcia.

## Odczyt witryny dla Design System Setup

Źródło **Website** w Design System Setup zaczyna system projektowy od witryny, którą już masz. W przeglądarce Chromium stronę czyta rozszerzenie. W aplikacji komputerowej aplikacja pobiera stronę sama. W przeglądarce bez rozszerzenia kafel Website nie jest oferowany.

- **Jeden adres, jedna strona.** Po zatwierdzeniu rozszerzenie otwiera stronę w takiej samej karcie w tle, odczytuje wyrenderowany kod, tekst arkuszy stylów i kilka obrazów ikon i logo, a potem zamyka kartę. Nie podąża za linkami i nie przeszukuje witryny.
- **Arkusze stylów hostowane gdzie indziej** (CDN lub usługa czcionek) też są pobierane, ponieważ kolory i typografia strony w nich mieszkają. Żądania między źródłami idą bez Twoich plików cookie; żądania do tego samego źródła ich używają, tak jak sama strona.
- **Wszystko jest ograniczone**, z limitem liczby arkuszy stylów i obrazów oraz bajtów, więc wroga lub na wpół zepsuta strona zwraca częściowy materiał, zamiast się zawiesić.
- **Parsowanie odbywa się na Twoim urządzeniu.** Bajty wracają prosto do karty Lolly, która o to poprosiła, a ona zamienia je w kolory, typografię i logo.

Wklejenie adresu tylko wypełnia pole. Nic nie jest odczytywane, dopóki nie rozpoczniesz odczytu i nie naciśniesz **Approve once**.

## Uprawnienia

`manifest.json` rozszerzenia deklaruje cztery uprawnienia oraz dostęp do witryn, o który prosi po jednej witrynie naraz. Ustawia `minimum_chrome_version: 111`, a obecna wersja to 0.4.0.

| Uprawnienie | Do czego służy | Kiedy jest przyznawane |
|---|---|---|
| `debugger` | Steruje kartą w tle przez DevTools Protocol, który robi zrzut ekranu. | Przy instalacji |
| `tabs` | Otwiera tymczasową kartę w tle i potem ją zamyka oraz sprawdza, że ani strona Lolly, ani strona docelowa nie zmieniły adresu od zatwierdzenia. | Przy instalacji |
| `scripting` | Uruchamia jednostronicowy czytnik wewnątrz wskazanej witryny, dla źródła Website. | Przy instalacji |
| `storage` | Zapisuje identyfikator otwartej karty, tylko w pamięci sesji, aby karta nadal się zamykała, jeśli przeglądarka zawiesi rozszerzenie w trakcie odczytu. Czyszczone przy następnym uruchomieniu; nic o Tobie nie jest przechowywane. | Przy instalacji |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Dostęp do witryn, nieprzyznawany przy instalacji. Po naciśnięciu **Approve once** rozszerzenie prosi Chrome o dostęp do jednej witryny z tego żądania. | Przy pierwszym zatwierdzeniu żądania dla tej witryny, po zapytaniu Cię przez Chrome |

Rozszerzenie czyta tylko jedną zatwierdzoną przez Ciebie stronę. Nie czyta ani nie wysyła Twoich danych przeglądania i nic nie jest wysyłane.

## Rozwiązywanie problemów

- **Nadal widzisz "Get the extension"?** Przeładuj kartę Lolly.
- **Nic się nie dzieje na tej witrynie?** Rozszerzenie działa tylko na `https://lolly.tools`, plus `http://localhost:5173` w pakiecie deweloperskim. Inne źródło, takie jak samodzielnie hostowana kopia Lolly, wymaga własnej kompilacji rozszerzenia, która wymienia to źródło zarówno w `manifest.json`, jak i `policy.js`. Sama edycja manifestu nie działa.
- **Przechwycenie zawodzi?** Sprawdź, czy URL jest osiągalny i zaczyna się od `http://` lub `https://`. Niektóre strony blokują automatyczne przechwytywanie. Jeśli nacisnąłeś **Cancel**, zamknąłeś okno zatwierdzenia lub czekałeś dłużej niż 30 sekund, rozpocznij przechwytywanie ponownie.
