# Rozszerzenie przeglądarki

Strona internetowa nie może odczytać pikseli innej witryny. W przeglądarce opartej na Chromium (Chrome, Edge, Brave, Arc lub Opera, od Chrome 111) bezpłatne rozszerzenie **Lolly URL Screenshot** pozwala aplikacji internetowej Lolly robić zrzuty strony tym samym mechanizmem, którego używa aplikacja komputerowa. Po zainstalowaniu rozszerzenia:

- **[Lolly URL Screenshot](/t/url-shot)** zapisuje przygotowaną stronę jako plik;
- adres internetowy wklejony w pole obrazu może stać się zrzutem tej strony dzięki **Screenshot this page**;
- źródło **Website** w [Lolly Design System Setup](/info/brand-studio.html) może odczytać jedną stronę jako punkt wyjścia systemu projektowego.

Zatwierdzasz każde żądanie, a aplikacja komputerowa wykonuje te same zadania bez rozszerzenia.

<!--i:eti-checklist-->
## Przed instalacją

Bez rozszerzenia **Lolly URL Screenshot** nadal się otwiera i możesz przygotować zrzut. Informacja nad kontrolkami narzędzia mówi, czego brakuje.

![Informacja w narzędziu URL Screenshot proponująca rozszerzenie, wyświetlana, gdy nie ma hosta, który mógłby wykonać zrzut do pliku](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Każda kontrolka działa bez rozszerzenia: docelowy URL, głębokość przewijania, opóźnienie na ustabilizowanie strony, marginesy kadrowania i zmiana kolorów. Tylko wykonanie zrzutu wymaga rozszerzenia.

![Kontrolki Lolly URL Screenshot z docelowym adresem URL, głębokością przewijania, opóźnieniem na ustabilizowanie strony i marginesami kadrowania, wszystkie dostępne przed zainstalowaniem rozszerzenia](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

<!--i:eti-download-->
## Instalacja

**Z Chrome Web Store:** wkrótce. Po opublikowaniu rozszerzenie zainstalujesz jednym kliknięciem.

**Wczytaj samodzielnie (dla programistów).** Kod źródłowy rozszerzenia jest w repozytorium w `shells/chrome-extension/`. Etap pakowania buduje pakiet produkcyjny z tego folderu. Ten pakiet działa tylko z Lolly pod adresem `https://lolly.tools`.

1. Uruchom `pnpm run pack:chrome-extension`. Pakiet zostanie zbudowany w `dist/chrome-extension/`.
2. Otwórz `chrome://extensions`.
3. Włącz **Developer mode** (w prawym górnym rogu).
4. Kliknij **Load unpacked** i wybierz folder `dist/chrome-extension/`.
5. Przeładuj kartę Lolly. Lolly wykrywa rozszerzenie podczas wczytywania strony, a komunikat „Get the extension” znika. **Lolly URL Screenshot** (w Utilities) może wtedy zapisywać zrzuty do pliku i działa w trybie Lolly Batch.

::: details Dla lokalnego serwera programistycznego lub folderu źródłowego
Dla lokalnego serwera programistycznego uruchom `pnpm run pack:chrome-extension:dev` i zamiast tego wczytaj `dist/chrome-extension-dev`. Ten pakiet akceptuje też `http://localhost:5173` i ma **Development** w nazwie.

Wczytanie samego folderu `shells/chrome-extension/` również działa dla zrzutów PNG. Ten folder nie ma mechanizmu przechodzenia po stronie, który jest dołączany podczas pakowania. SVG z tego folderu zawiera zrzut ekranu, a nie kształty.
:::

<!--i:eti-user-check-->
## Co się dzieje, gdy Lolly wysyła żądanie

![Karta Lolly prosi o jedną stronę, a Ty naciskasz Approve once w oknie zatwierdzania rozszerzenia. Karta w tle otwiera się, odczytuje stronę i zamyka. Następnie karta Lolly otrzymuje wynik.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly wysyła żądanie.** Mały skrypt informuje Lolly, że rozszerzenie jest obecne, więc wykonanie zrzutu lub odczyt strony może się rozpocząć bez dalszej konfiguracji.
2. **Zatwierdzasz.** Rozszerzenie otwiera własne okno **Approve page request**. Pokazuje witrynę wysyłającą żądanie, czy chce zrzutu ekranu, czy treści strony oraz adres strony. Nic nie jest odczytywane, dopóki nie naciśniesz **Approve once**. **Cancel** lub zamknięcie okna kończy żądanie.
3. **Chrome pyta raz na witrynę.** Gdy po raz pierwszy zatwierdzasz żądanie dla witryny, Chrome dodatkowo pyta, czy rozszerzenie może uzyskać do niej dostęp. Chrome zachowuje ten dostęp po Twojej zgodzie, ale każde kolejne żądanie nadal wymaga osobnego **Approve once**.
4. **Strona jest odczytywana w karcie w tle.** Rozszerzenie otwiera stronę docelową w karcie w tle, wykonuje zrzut przez DevTools Protocol (to samo `Page.captureScreenshot`, którego używa aplikacja komputerowa), zamyka kartę i przekazuje wynik do karty Lolly, która o niego poprosiła.

::: details Jak działa zrzut SVG
Dla **SVG** rozszerzenie przechodzi po stronie zamiast robić zdjęcie ekranu. Skrypt dołączony do rozszerzenia odczytuje układ strony w karcie w tle i zamienia stronę na kształty oraz tekst zamieniony na krzywe. Plik pozostaje ostry w każdym rozmiarze, a każda część pozostaje edytowalna. Obrazy na stronie pozostają obrazami. Wszystko, co strona rysuje na kanwie, wideo lub efekt, którego SVG nie potrafi wyrazić, jest kopiowane ze zrzutu ekranu z tej samej chwili. Lolly porównuje wynik z tym zrzutem. Gdy różnią się zbyt mocno, SVG zawiera zamiast tego zrzut ekranu.

Aby zamienić tekst na krzywe w kroju pisma używanym na stronie, rozszerzenie przekazuje Lolly pliki czcionek wczytane przez stronę. Chrome nie przechowuje bajtów czcionki w miejscu dostępnym dla rozszerzenia, więc rozszerzenie ponownie prosi stronę o każdą czcionkę. Przeglądarka zwykle odpowiada ze swojej pamięci podręcznej, a własna polityka bezpieczeństwa strony nadal obowiązuje dla tego żądania.
:::

Zgoda obejmuje jedno żądanie i wygasa po 30 sekundach. W danym momencie tylko jedno żądanie może oczekiwać lub być wykonywane, a zatwierdzone żądanie zatrzymuje się po 55 sekundach. Jeśli strona Lolly zostanie zamknięta lub się zmieni albo strona docelowa przejdzie do innej witryny, żądanie zostaje anulowane.

::: warning Zrzuty korzystają z Twojej sesji przeglądarki
Strona wczytuje się z Twoją sesją przeglądarki, więc strona, na której jesteś zalogowany, może pokazać prywatne informacje w wyniku.
:::

Zrzut jest wykonywany w Twojej przeglądarce i sieci, więc `localhost` i witryny wewnętrzne działają. Zrzut nie jest wysyłany. Jedyny ruch sieciowy to wczytywanie przez przeglądarkę wybranej strony, a w przypadku SVG także ponowne pobranie plików czcionek tej strony.

Podczas wykonywania zrzutu możesz przez chwilę zobaczyć baner *„…started debugging this browser”* na tymczasowej karcie. Baner pochodzi z DevTools Protocol i znika po zakończeniu zrzutu.

<a id="reading-a-site-for-design-system-setup"></a>
<!--i:eti-globe-->
## Odczytywanie witryny dla Lolly Design System Setup

Źródło **Website** w Lolly Design System Setup tworzy punkt wyjścia systemu projektowego z witryny, którą już masz. W przeglądarce Chromium stronę odczytuje rozszerzenie. W aplikacji komputerowej sama aplikacja pobiera stronę. W przeglądarce bez rozszerzenia kafelek Website nie jest dostępny.

- **Jeden adres, jedna strona.** Po zatwierdzeniu rozszerzenie otwiera stronę w takiej samej karcie w tle, odczytuje wyrenderowany kod strony, tekst arkuszy stylów i kilka obrazów ikon i logotypów, a potem zamyka kartę. Rozszerzenie nie podąża za linkami ani nie przeszukuje witryny.
- **Arkusze stylów hostowane gdzie indziej** (w CDN lub usłudze czcionek) też są pobierane, ponieważ zawierają kolory i typografię strony. Żądania do innego źródła są wysyłane bez Twoich plików cookie. Żądania do tego samego źródła używają Twoich plików cookie, tak jak sama strona.
- **Wszystko ma limity**, zarówno liczba arkuszy stylów i obrazów, jak i liczba bajtów, więc złośliwa lub częściowo uszkodzona strona zwraca niepełny materiał zamiast powodować zawieszenie.
- **Parsowanie odbywa się na Twoim urządzeniu.** Bajty trafiają bezpośrednio z powrotem do karty Lolly, która o nie poprosiła i która przekształca je w kolory, typografię i logotypy.

Wklejenie adresu tylko wypełnia pole. Nic nie jest odczytywane, dopóki nie rozpoczniesz odczytu i nie naciśniesz **Approve once**.

<!--i:eti-lock-->
## Uprawnienia

Plik `manifest.json` rozszerzenia deklaruje cztery uprawnienia oraz dostęp do witryn, o który prosi osobno dla każdej witryny. Ustawia `minimum_chrome_version: 111`, a bieżąca wersja to 0.5.0.

| Uprawnienie | Do czego służy | Kiedy jest przyznawane |
|---|---|---|
| `debugger` | Steruje kartą w tle przez DevTools Protocol, który wykonuje zrzut ekranu, a dla SVG uruchamia przechodzenie po stronie. | Przy instalacji |
| `tabs` | Otwiera tymczasową kartę w tle i zamyka ją po zakończeniu oraz sprawdza, czy od zatwierdzenia ani strona Lolly, ani strona docelowa nie zmieniły adresu. | Przy instalacji |
| `scripting` | Uruchamia czytnik pojedynczej strony w podanej witrynie dla źródła Website. | Przy instalacji |
| `storage` | Zapisuje identyfikator otwartej karty wyłącznie w pamięci sesji, aby karta została zamknięta nawet wtedy, gdy przeglądarka zawiesi rozszerzenie podczas odczytu. Dane są czyszczone przy następnym uruchomieniu; nic o Tobie nie jest przechowywane. | Przy instalacji |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Dostęp do witryny, nieprzyznawany przy instalacji. Gdy naciśniesz **Approve once**, rozszerzenie prosi Chrome o dostęp do jednej witryny wskazanej w żądaniu. | Przy pierwszym zatwierdzeniu żądania dla tej witryny, po pytaniu Chrome |

Rozszerzenie odczytuje tylko zatwierdzoną przez Ciebie stronę. Nie odczytuje ani nie wysyła Twoich danych przeglądania.

<!--i:eti-help-->
## Rozwiązywanie problemów

- **Nadal widzisz „Get the extension”?** Przeładuj kartę Lolly.
- **Nic się nie dzieje w tej witrynie?** Rozszerzenie działa tylko pod `https://lolly.tools` oraz `http://localhost:5173` w pakiecie programistycznym. Inne źródło, takie jak samodzielnie hostowana kopia Lolly, wymaga własnej kompilacji rozszerzenia z tym źródłem wymienionym zarówno w `manifest.json`, jak i `policy.js`. Sama edycja manifestu nie wystarczy.
- **Zrzut się nie udaje?** Sprawdź, czy URL jest dostępny i zaczyna się od `http://` lub `https://`. Niektóre strony blokują automatyczne zrzuty. Jeśli naciśnięto **Cancel**, zamknięto okno zatwierdzania lub upłynęło więcej niż 30 sekund, rozpocznij zrzut ponownie.
