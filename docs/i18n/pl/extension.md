# Rozszerzenie przeglądarki

Rozszerzenie **Lolly URL Screenshot** pozwala aplikacji webowej zrobić zrzut ekranu dowolnej strony internetowej z poziomu przeglądarki. Bez niego przechwycenie URL-a wymaga aplikacji desktopowej - strona w przeglądarce nie może sama odczytać pikseli innej witryny. Rozszerzenie może, korzystając z tego samego mechanizmu przechwytywania, którego używa aplikacja desktopowa.

Wykonuje w ten sam sposób jeszcze jedno zadanie: odczytuje pojedynczą podaną przez Ciebie stronę, dzięki czemu Brand Studio może wydobyć markę z działającej strony internetowej. Obie te funkcje opisano poniżej.

Działa w przeglądarkach opartych na Chromium: **Chrome, Edge, Brave, Arc, Opera** - Chrome 111 lub nowszy.

Zanim zostanie zainstalowane, **URL Screenshot** nadal się otwiera, więc możesz skomponować kadr, a notatka na górze kontrolek narzędzia mówi, czego brakuje.

![Notatka narzędzia URL Screenshot oferująca rozszerzenie, pokazywana gdy przechwytywanie do pliku nie ma hosta, na którym mogłoby działać](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Każda kontrolka działa na żywo, gdy czekasz: docelowy URL, głębokość przewijania, opóźnienie ustabilizowania, marginesy kadrowania i przekolorowanie. Tylko samo przechwytywanie potrzebuje hosta.

![Kontrolki URL Screenshot z docelowym URL, głębokością przewijania, opóźnieniem ustabilizowania i marginesami kadrowania, wszystkie użyteczne zanim rozszerzenie istnieje](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Instalacja

### Ze sklepu Chrome Web Store

*Wkrótce.* Gdy zostanie opublikowane, zainstalujesz je jednym kliknięciem, a potem przeładujesz Lolly.

### Wczytaj je samodzielnie (deweloperzy)

Rozszerzenie znajduje się w repozytorium pod `shells/chrome-extension/`.

1. Otwórz `chrome://extensions`.
2. Włącz **Tryb dewelopera** (prawy górny róg).
3. Kliknij **Wczytaj rozpakowane** i wybierz folder `shells/chrome-extension/`.
4. Przeładuj Lolly - **URL Screenshot** działa już w przeglądarce.

## Jak to działa

- Mały skrypt informuje Lolly, że rozszerzenie jest obecne, więc narzędzie **URL Screenshot** włącza się automatycznie - bez konfiguracji.
- Gdy renderujesz, rozszerzenie otwiera docelową stronę w tle, w osobnej karcie, przechwytuje ją przez DevTools Protocol (ten sam `Page.captureScreenshot`, którego używa aplikacja desktopowa), a następnie zamyka kartę i przekazuje obraz z powrotem.
- Działa całkowicie w twojej przeglądarce, w twojej sieci - dzięki czemu przechwytywanie `localhost` lub wewnętrznej witryny działa. Samo przechwycenie nigdy nigdzie nie jest przesyłane; jedynym ruchem sieciowym jest twoja własna przeglądarka wczytująca stronę, którą poprosiłeś o sfotografowanie.

Podczas przechwytywania możesz krótko zobaczyć baner *"…started debugging this browser"* na tymczasowej karcie. To działanie DevTools Protocol; znika samo, gdy kadr jest gotowy.

## Odczytywanie witryny dla Brand Studio

Źródło **Website** w Brand Studio pozwala rozpocząć markę od witryny, którą już masz. W Chromium to rozszerzenie ją odczytuje; w aplikacji desktopowej tę samą pracę wykonuje natywne pobieranie, a w zwykłej przeglądarce bez rozszerzenia kafelek w ogóle nie jest oferowany.

Co się dzieje po naciśnięciu:

- Jeden adres, jedna strona. Rozszerzenie otwiera ją w tej samej karcie w tle, odczytuje wyrenderowaną znacznikę, tekst arkusza stylów oraz garść obrazów ikon i logo, po czym zamyka kartę. Nie podąża za linkami i nie przeszukuje witryny.
- Arkusze stylów i fonty hostowane gdzie indziej (CDN, usługa fontów) też są pobierane, bo w nich mieszczą się kolory i typografia strony. Żądania cross-origin idą bez twoich ciasteczek; żądania same-origin ich używają, dokładnie tak jak sama strona.
- Wszystko ma ograniczony pułap - skończona liczba arkuszy, obrazów i bajtów - więc wrogo nastawiona lub częściowo uszkodzona strona zwraca materiał częściowy zamiast wieszać proces.
- Bajty trafiają prosto z powrotem do karty Lolly, która o nie poprosiła. Rozkładanie na kolory, typografię i logo dzieje się na twoim urządzeniu; nic nie jest przesyłane.

Nic nie jest odczytywane, dopóki nie naciśniesz. Wklejenie adresu tylko wypełnia pole.

## Po instalacji

Przeładuj kartę Lolly. Podpowiedź "Get the extension" znika, a **URL Screenshot** staje się dostępny w galerii i w trybie wsadowym.

## Uprawnienia

Jego `manifest.json` deklaruje cztery uprawnienia plus dostęp do hostów:

- `debugger` - sterowanie kartą w tle przez DevTools Protocol. To on wykonuje zrzut ekranu.
- `tabs` - otwarcie tymczasowej karty w tle i zamknięcie jej po zakończeniu.
- `scripting` - uruchomienie czytnika jednej strony wewnątrz wskazanej witryny, dla źródła Website w Brand Studio.
- `storage` - zapisanie id otwartej karty, wyłącznie w pamięci sesji, tak by karta wciąż została zamknięta, jeśli przeglądarka zawiesi rozszerzenie w trakcie odczytu. Czyszczone przy kolejnym starcie; nic na twój temat nie jest przechowywane.
- `host_permissions: ["<all_urls>"]` - dostęp do *wszystkich* witryn, bo możesz wskazać dowolny URL. Chrome ujawnia to przy instalacji jako szerokie ostrzeżenie "odczytuj i zmieniaj wszystkie twoje dane na wszystkich stronach".

Mimo tego ostrzeżenia odczytuje tylko pojedynczą stronę, o którą poprosisz do przechwycenia lub importu, i nie odczytuje ani nie przesyła twoich danych przeglądania - nic nigdzie nie jest przesyłane.

Manifest ustawia też `minimum_chrome_version: 111`. Bieżąca wersja to 0.2.1.

## Rozwiązywanie problemów

- **Wciąż widzisz "Get the extension"?** Przeładuj kartę Lolly - wykrywanie zachodzi przy wczytaniu strony.
- **Nic się nie dzieje na tej witrynie?** Rozszerzenie aktywuje się tylko na własnych domenach Lolly. Budujesz własną wersję na innej domenie? Dodaj ją do `content_scripts.matches` w `manifest.json` rozszerzenia.
- **Przechwytywanie się nie udaje?** Sprawdź, czy URL jest osiągalny i zaczyna się od `http://` lub `https://`. Niektóre strony aktywnie blokują zautomatyzowane przechwytywanie.
