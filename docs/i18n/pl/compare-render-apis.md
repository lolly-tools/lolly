# Lolly i API renderowania

_Ostatnio sprawdzono: 5 listopada 2026._

Jeśli generujesz obrazy z szablonów przez API, ta strona opisuje, co się zmienia, gdy uruchamiasz taką produkcję na własnym urządzeniu, w CI lub na kontrolowanym przez siebie serwerze. [Przejście z hostowanego API renderowania](/info/work-move-from-render-api.html) podaje kolejne kroki.

<!--i:eti-award-->
## Co hostowane API renderowania robią lepiej

[Bannerbear](https://www.bannerbear.com/) i [Placid](https://placid.app/) to usługi zarządzane: wysyłasz żądanie, a ktoś inny utrzymuje serwery.

- **Nic do utrzymywania.** Bez serwera, bazy danych, pamięci masowej, aktualizacji i planowania wydajności.
- **Hostowany edytor szablonów** z szablonami gotowymi do dostosowania.
- **Więcej rodzajów plików wynikowych z jednego API.** Oba udostępniają punkty końcowe dla wideo i PDF, a Bannerbear dokumentuje też animowane wyniki, WebP i AVIF, zrzuty ekranu i usuwanie tła przez AI.
- **Własne integracje i wsparcie.**

Jeśli takiego rozwiązania szukasz, te usługi są dobrym wyborem.

<!--i:eti-home-->
## Co daje własny hosting

- **Twoje treści zostają w Twoich systemach.** Dane wejściowe, zasoby i wyniki znajdują się na wybranej przez Ciebie infrastrukturze. Renderowanie na urządzeniu lub w CI nie wymaga usługi.
- **Reguły są w narzędziu.** Kolory, typografia, logotypy i zablokowane dane wejściowe pochodzą z Twojego [systemu projektowego](/info/brand-studio.html), więc wywołujący może zmienić tylko to, na co pozwalasz. [Lolly Work](/info/compare.html#what-runs-where) stosuje widoczność narzędzi i polityki danych wejściowych do każdego żądania.
- **To samo narzędzie wszędzie.** Narzędzie renderuje z tych samych danych wejściowych na laptopie, w zadaniu CI lub na serwerze. Ludzie mogą edytować to samo narzędzie w aplikacji.
- **Zapisy pozostają u Ciebie.** [Potwierdzenia renderowania](/info/work-renders.html#evidence-and-identity), ślad audytowy i Content Credentials tam, gdzie skonfigurujesz tożsamość podpisującą.
- **Otwarty kod i brak opłat za użycie.** Uruchamiasz kod i płacisz tylko za własną infrastrukturę.

Przejmujesz pracę, którą te usługi wykonują za Ciebie. Trwały serwer wymaga trwałej bazy danych i magazynu wyników. Narzędzia wymagające przeglądarki potrzebują procesu roboczego Chromium. [Instalacja Lolly Work](/info/work-install.html) opisuje oba wymagania.

<!--i:eti-table-->
## Jak odpowiadają sobie zadania

| Zadanie | Hostowane API renderowania | Lolly |
|---|---|---|
| Wypełnianie szablonu danymi | Żądanie API wskazujące szablon i jego warstwy | [URL](/info/url-mode.html), [CLI](/info/cli.html) lub [API serwera](/info/work-automation-api.html) wskazujące narzędzie i jego dane wejściowe |
| Wiele plików z tabeli | Partie i kolekcje | [Przetwarzanie wsadowe](/info/batch.html) na Twoim urządzeniu lub [partie renderowania](/info/work-renders.html#batches-with-durable-rows) na serwerze |
| Oczekiwanie na wynik lub odpytywanie o niego | Odpytywanie lub opcja synchroniczna | Trwale zapisywane rendery, o które odpytujesz, lub natychmiastowy render |
| Wywołanie webhooka po zakończeniu | Tak | [Podpisane wywołania zwrotne](/info/work-renders.html) do dozwolonych przez Ciebie originów |
| Dynamiczny URL obrazu | Tak | [Linki udostępniania i adresy URL `/render`](/info/url-mode.html) |
| Edycja szablonu | Hostowany edytor | [Design](/info/using.html), na Twoim urządzeniu |
| Agenci | Oba udostępniają serwer MCP | [MCP](/info/mcp.html), z punktem końcowym organizacji podlegającym polityce tokenu w Lolly Work |

Własne rodzaje plików wynikowych Lolly są wymienione w [Eksporcie](/info/exporting.html). Na serwerze Work trwale zapisywane rendery tworzą obecnie SVG, PNG, JPG i PDF, a [wideo pozostaje na urządzeniu, w CLI i MCP](/info/work-renders.html#production-still-checks-and-permitted-repairs).

<!--i:eti-folder-move-->
## Co można przenieść, a czego nie

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Twoje żądania | API migracji Work przyjmuje tę samą strukturę | Tak samo | Tak samo |
| Twoje szablony | **Import** jako edytowalne dokumenty, z wyjątkiem typów warstw bez potwierdzonego schematu | Tylko nazwy pól i podgląd. Odtwórz każdy szablon | Tylko nazwy pól i podgląd. Odtwórz każdy szablon |
| Istniejące dynamiczne adresy URL | Nieobsługiwane | Nieobsługiwane | Podpisane adresy URL działają dalej po zmianie hosta, z Twoim starym prywatnym tokenem |
| Webhooki | Zarejestrowane webhooki nie są obsługiwane | `webhook_url` działa | `webhook_success` działa |
| Wyniki WebP i AVIF | Odrzucane po nazwie | Niedostępne | WebP odrzucany po nazwie |
| Animacje, wideo, kolekcje, zrzuty ekranu | Niedostępne w API migracji | Niedostępne w API migracji | Niedostępne w API migracji |

::: note Stworzone na podstawie publicznej dokumentacji
Stworzono to na podstawie publicznej dokumentacji każdego dostawcy i nie uruchamiano z aktywnym kontem. Jeśli masz konto, [przewodnik migracji](/info/work-move-from-render-api.html#check-it-on-your-own-account) zawiera krótką listę kontrolną.
:::

Możesz przenieść jeden szablon, a resztę zostawić tam, gdzie jest. [Odejście z Lolly](/info/work-move-from-render-api.html#leave-lolly-too) jest równie otwarte: narzędzia to zwykłe pliki, a CLI renderuje je bez serwera.

<!--i:eti-building-->
## Kto utrzymuje usługę

W Lolly pojedyncza osoba renderuje lokalnie lub zespół uruchamia Lolly Work na własnej infrastrukturze. Zadanie serwerowe wysyła swoje dane wejściowe i wymagane zasoby do tej instancji. Ścieżka na urządzeniu tego nie robi.

Bannerbear i Placid są znakami towarowymi swoich właścicieli. Ta strona opisuje, gdzie możliwości produktów się pokrywają, na podstawie ich publicznej dokumentacji, i nie jest powiązana z żadnym z nich.
