# Lolly i API renderowania

_Ostatnio sprawdzono: 5 listopada 2026._

Jeśli dziś generujesz obrazy z szablonów przez API, ta strona mówi, co się zmienia, gdy prowadzisz tę produkcję sam: na własnym urządzeniu, w CI lub na serwerze, który kontrolujesz. [Move from a hosted render API](/info/work-move-from-render-api.html) opisuje, jak to zrobić.

## Co lepiej robią hostowane API renderujące

[Bannerbear](https://www.bannerbear.com/) i [Placid](https://placid.app/) to zarządzane usługi i to realna zaleta. Wysyłasz żądanie, a ktoś inny prowadzi serwery, dba o ich działanie i obsługuje obciążenie.

- **Nic do prowadzenia.** Bez serwera, bazy danych, magazynu, aktualizacji i planowania zasobów.
- **Hostowany edytor szablonów** z gotowymi szablonami do adaptacji.
- **Więcej rodzajów wyników z jednego API.** Oba publikują punkty końcowe wideo i PDF, a Bannerbear dokumentuje też animowane wyniki, WebP i AVIF, zrzuty ekranu i usuwanie tła przez AI.
- **Własne integracje i wsparcie.**

Jeśli takiego układu chcesz, te usługi to rozsądny wybór.

## Co daje własny hosting

- **Twoje treści zostają w Twoich systemach.** Dane wejściowe, zasoby i wyniki leżą na infrastrukturze, którą wybrałeś. Renderowanie na urządzeniu lub w CI nie potrzebuje żadnej usługi.
- **Reguły żyją w narzędziu.** Kolory, typografia, logo i zablokowane dane wejściowe pochodzą z Twojego [systemu projektowego](/info/brand-studio.html), więc wywołujący może zmienić tylko to, na co pozwolisz. [Lolly Work](/info/compare.html#what-runs-where) stosuje widoczność narzędzi i polityki danych wejściowych do każdego żądania.
- **To samo narzędzie wszędzie.** Narzędzie renderuje się na laptopie, w zadaniu CI lub na serwerze z tych samych danych wejściowych, a ludzie mogą edytować to samo narzędzie w aplikacji.
- **Zapisy, które masz u siebie.** [Render receipts](/info/work-renders.html#evidence-and-identity), ślad audytu i Content Credentials tam, gdzie skonfigurujesz tożsamość podpisującą.
- **Open source i bez licznika.** Uruchamiasz kod, a płacisz za własną infrastrukturę.

Przejmujesz pracę, którą te usługi wykonują za Ciebie. Trwały serwer potrzebuje trwałej bazy danych i magazynu wyników, a narzędzia zależne od przeglądarki potrzebują workera Chromium. [Install Lolly Work](/info/work-install.html) opisuje oba.

## Jak zadania się zazębiają

| Zadanie | Hostowane API renderowania | Lolly |
|---|---|---|
| Wypełnienie szablonu z danych | Żądanie API wskazujące szablon i jego warstwy | [URL](/info/url-mode.html), [CLI](/info/cli.html) lub [API serwera](/info/work-automation-api.html) wskazujące narzędzie i jego dane wejściowe |
| Wiele plików z tabeli | Partie i kolekcje | [Batch](/info/batch.html) na Twoim urządzeniu lub [partie renderowania](/info/work-renders.html#batches-with-durable-rows) na serwerze |
| Czekanie lub odpytywanie o wynik | Odpytywanie lub opcja synchroniczna | Trwałe renderowania, które odpytujesz, lub natychmiastowe renderowanie |
| Wywołanie webhooka po zakończeniu | Tak | [Podpisane callbacki](/info/work-renders.html) do źródeł, które dopuścisz |
| Dynamiczny URL obrazu | Tak | [Linki udostępniania i URL-e `/render`](/info/url-mode.html) |
| Edycja szablonu | Hostowany edytor | [Design](/info/using.html), na Twoim urządzeniu |
| Agenci | Oba publikują serwer MCP | [MCP](/info/mcp.html), z punktem końcowym organizacji pod polityką tokenu w Lolly Work |

Własne rodzaje wyników Lolly są wymienione w [Exporting](/info/exporting.html). Na serwerze Work dziś trwałe renderowania tworzą SVG, PNG, JPG i PDF, a [wideo zostaje na urządzeniu, w CLI i MCP](/info/work-renders.html#production-still-checks-and-permitted-repairs).

## Co przechodzi, a co nie

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Twoje żądania | API migracji Work przyjmuje ten sam kształt | Tak samo | Tak samo |
| Twoje szablony | **Import** jako edytowalne dokumenty, z wyjątkiem typów warstw bez potwierdzonego schematu | Tylko nazwy pól i podgląd. Odbuduj każdy | Tylko nazwy pól i podgląd. Odbuduj każdy |
| Istniejące dynamiczne URL-e | Nieobsługiwane | Nieobsługiwane | Podpisane URL-e działają po zmianie hosta, z Twoim starym prywatnym tokenem |
| Webhooki | Zarejestrowane webhooki nie są obsługiwane | `webhook_url` działa | `webhook_success` działa |
| Wynik WebP i AVIF | Odrzucany z nazwy | Nieoferowany | WebP odrzucany z nazwy |
| Animacje, wideo, kolekcje, zrzuty ekranu | Nie w API migracji | Nie w API migracji | Nie w API migracji |

Wszystko to zbudowano z publicznej dokumentacji każdego dostawcy i nie uruchomiono na żywym koncie. [The move guide](/info/work-move-from-render-api.html#check-it-on-your-own-account) ma krótką listę kontrolną, jeśli takie konto masz.

Przejście nie jest wszystko albo nic. Możesz przenieść jeden szablon i zostawić resztę tam, gdzie są, a [odejście z Lolly](/info/work-move-from-render-api.html#leave-lolly-too) jest równie otwarte: narzędzia to zwykłe pliki, a CLI renderuje je bez serwera.

## Kto prowadzi usługę

Z Lolly osoba renderuje lokalnie albo zespół prowadzi Lolly Work na własnej infrastrukturze. Zgłoszenie zadania serwerowego wysyła jego dane wejściowe i wymagane zasoby do tej instancji, co różni się od ścieżki na urządzeniu.

Bannerbear i Placid są znakami towarowymi swoich właścicieli. Ta strona opisuje, gdzie produkty się pokrywają, na podstawie ich publicznej dokumentacji, i nie jest powiązana z żadnym z nich.
