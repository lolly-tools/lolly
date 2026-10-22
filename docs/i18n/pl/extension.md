# Rozszerzenie przeglądarki

Rozszerzenie **Lolly URL Screenshot** pozwala aplikacji webowej zrobić zrzut ekranu dowolnej strony internetowej z poziomu przeglądarki. Bez niego przechwycenie URL-a wymaga aplikacji desktopowej - strona w przeglądarce nie może sama odczytać pikseli innej witryny. Rozszerzenie może, korzystając z tego samego mechanizmu przechwytywania, którego używa aplikacja desktopowa.

Wykonuje w ten sam sposób dwa inne zadania. Adres internetowy wklejony do miejsca na obraz może stać się zrzutem tej strony (**Zrób zrzut tej strony**), a rozszerzenie może odczytać pojedynczą podaną przez Ciebie stronę, dzięki czemu Brand Studio może wydobyć markę z działającej strony internetowej. Każde żądanie czeka na Twoje zatwierdzenie w rozszerzeniu.

Działa w przeglądarkach opartych na Chromium: **Chrome, Edge, Brave, Arc, Opera** - Chrome 111 lub nowszy.

Zanim zostanie zainstalowane, **URL Screenshot** nadal się otwiera, więc możesz skomponować kadr, a notatka na górze kontrolek narzędzia mówi, czego brakuje.

![Notatka narzędzia URL Screenshot oferująca rozszerzenie, pokazywana gdy przechwytywanie do pliku nie ma hosta, na którym mogłoby działać](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Każda kontrolka działa na żywo, gdy czekasz: docelowy URL, głębokość przewijania, opóźnienie ustabilizowania, marginesy kadrowania i przekolorowanie. Tylko samo przechwytywanie potrzebuje hosta.

![Kontrolki URL Screenshot z docelowym URL, głębokością przewijania, opóźnieniem ustabilizowania i marginesami kadrowania, wszystkie użyteczne zanim rozszerzenie istnieje](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Instalacja

### Ze sklepu Chrome Web Store

*Wkrótce.* Gdy zostanie opublikowane, zainstalujesz je jednym kliknięciem, a potem przeładujesz Lolly.

### Wczytaj je samodzielnie (deweloperzy)

Rozszerzenie znajduje się w repozytorium pod `shells/chrome-extension/`. Ten folder to wersja produkcyjna, która działa wyłącznie z Lolly pod adresem `https://lolly.tools`.

1. Otwórz `chrome://extensions`.
2. Włącz **Tryb dewelopera** (prawy górny róg).
3. Kliknij **Wczytaj rozpakowane** i wybierz folder `shells/chrome-extension/`.
4. Przeładuj Lolly - **URL Screenshot** działa już w przeglądarce.

Dla lokalnego serwera deweloperskiego uruchom `pnpm run pack:chrome-extension:dev` i wczytaj zamiast tego `dist/chrome-extension-dev`. Ten pakiet akceptuje też `http://localhost:5173` i ma w nazwie **Development**.

## Jak to działa

- Mały skrypt informuje Lolly, że rozszerzenie jest obecne, więc **URL Screenshot** może zapisywać przechwycenia bez dalszej konfiguracji.
- Zatwierdzasz każde żądanie. Gdy Lolly o coś prosi, rozszerzenie otwiera własne okno **Approve page request**, które pokazuje witrynę wysyłającą żądanie, informację, czy chce ona zrzutu ekranu, czy zawartości strony, oraz adres strony. Nic nie jest odczytywane, dopóki nie naciśniesz **Approve once**. **Cancel** lub zamknięcie okna kończy żądanie.
- Gdy po raz pierwszy zatwierdzisz żądanie dla danej witryny, Chrome pyta także, czy rozszerzenie może mieć dostęp do tej witryny. Chrome zachowuje ten dostęp po jego udzieleniu, ale każde kolejne żądanie nadal wymaga własnego **Approve once**.
- Zatwierdzenie obejmuje jedno żądanie i wygasa po 30 sekundach. Tylko jedno żądanie może czekać lub działać naraz, a zatwierdzone żądanie zatrzymuje się po 55 sekundach. Jeśli strona Lolly zostanie zamknięta lub zmieniona albo strona docelowa przejdzie na inną witrynę, żądanie zostaje anulowane.
- Po zatwierdzeniu rozszerzenie otwiera docelową stronę w tle, w osobnej karcie, przechwytuje ją przez DevTools Protocol (ten sam `Page.captureScreenshot`, którego używa aplikacja desktopowa), a następnie zamyka kartę i przekazuje obraz z powrotem do karty Lolly, która o niego poprosiła.
- Działa całkowicie w twojej przeglądarce, w twojej sieci - dzięki czemu przechwytywanie `localhost` lub wewnętrznej witryny działa. Strona wczytuje się w sesji twojej przeglądarki, więc strona, na którą jesteś zalogowany, może pokazać w wyniku prywatne informacje. Samo przechwycenie nigdy nigdzie nie jest przesyłane; jedynym ruchem sieciowym jest twoja własna przeglądarka wczytująca stronę, którą poprosiłeś o sfotografowanie.

Podczas przechwytywania możesz krótko zobaczyć baner *"…started debugging this browser"* na tymczasowej karcie. To działanie DevTools Protocol; znika samo, gdy kadr jest gotowy.

## Odczytywanie witryny dla Brand Studio

Źródło **Website** w Brand Studio pozwala rozpocząć markę od witryny, którą już masz. W Chromium to rozszerzenie ją odczytuje; w aplikacji desktopowej tę samą pracę wykonuje natywne pobieranie, a w zwykłej przeglądarce bez rozszerzenia kafelek w ogóle nie jest oferowany.

Co się dzieje po naciśnięciu:

- Jeden adres, jedna strona. Po zatwierdzeniu rozszerzenie otwiera ją w tej samej karcie w tle, odczytuje wyrenderowaną znacznikę, tekst arkusza stylów oraz garść obrazów ikon i logo, po czym zamyka kartę. Nie podąża za linkami i nie przeszukuje witryny.
- Arkusze stylów hostowane gdzie indziej (CDN, usługa fontów) też są pobierane, bo w nich mieszczą się kolory i typografia strony. Żądania cross-origin idą bez twoich ciasteczek; żądania same-origin ich używają, dokładnie tak jak sama strona.
- Wszystko ma ograniczony pułap - skończona liczba arkuszy, obrazów i bajtów - więc wrogo nastawiona lub częściowo uszkodzona strona zwraca materiał częściowy zamiast wieszać proces.
- Bajty trafiają prosto z powrotem do karty Lolly, która o nie poprosiła. Rozkładanie na kolory, typografię i logo dzieje się na twoim urządzeniu; nic nie jest przesyłane.

Wklejenie adresu tylko wypełnia pole. Nic nie jest odczytywane, dopóki nie rozpoczniesz odczytu i nie naciśniesz **Approve once**.

## Po instalacji

Przeładuj kartę Lolly. Podpowiedź "Get the extension" znika, **URL Screenshot** (w Narzędziach pomocniczych) może zapisywać przechwycenia do pliku, a narzędzie staje się dostępne w trybie wsadowym.

## Uprawnienia

Jego `manifest.json` deklaruje cztery uprawnienia, plus dostęp do witryn, o który prosi po jednej witrynie naraz:

- `debugger` - sterowanie kartą w tle przez DevTools Protocol. To on wykonuje zrzut ekranu.
- `tabs` - otwarcie tymczasowej karty w tle i zamknięcie jej po zakończeniu oraz sprawdzenie, że ani strona Lolly, ani strona docelowa nie zmieniły się od chwili zatwierdzenia żądania.
- `scripting` - uruchomienie czytnika jednej strony wewnątrz wskazanej witryny, dla źródła Website w Brand Studio.
- `storage` - zapisanie id otwartej karty, wyłącznie w pamięci sesji, tak by karta wciąż została zamknięta, jeśli przeglądarka zawiesi rozszerzenie w trakcie odczytu. Czyszczone przy kolejnym starcie; nic na twój temat nie jest przechowywane.
- `optional_host_permissions: ["http://*/*", "https://*/*"]` - dostęp do witryn, który nie jest przyznawany przy instalacji. Gdy naciśniesz **Approve once**, rozszerzenie prosi Chrome o dostęp do jednej witryny z tego żądania, a Chrome pyta cię o to przy pierwszym razie dla każdej witryny.

Odczytuje tylko pojedynczą zatwierdzoną przez ciebie stronę i nie odczytuje ani nie przesyła twoich danych przeglądania - nic nigdzie nie jest przesyłane.

Manifest ustawia też `minimum_chrome_version: 111`. Bieżąca wersja to 0.4.0.

## Rozwiązywanie problemów

- **Wciąż widzisz "Get the extension"?** Przeładuj kartę Lolly - wykrywanie zachodzi przy wczytaniu strony.
- **Nic się nie dzieje na tej witrynie?** Rozszerzenie działa tylko na `https://lolly.tools` oraz, w pakiecie deweloperskim, na `http://localhost:5173`. Inne źródło, na przykład własna kopia Lolly, wymaga osobnej wersji rozszerzenia, która wymienia to źródło zarówno w `manifest.json`, jak i w `policy.js`. Samo edytowanie manifestu już nie działa.
- **Przechwytywanie się nie udaje?** Sprawdź, czy URL jest osiągalny i zaczyna się od `http://` lub `https://`. Niektóre strony aktywnie blokują zautomatyzowane przechwytywanie. Jeśli naciśnięto **Cancel**, zamknięto okno zatwierdzania albo czekano dłużej niż 30 sekund, rozpocznij przechwytywanie od nowa.
