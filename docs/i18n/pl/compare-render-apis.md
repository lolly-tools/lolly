# Lolly i API renderowania

_Ostatnio sprawdzono: 28 września 2026._

Jeśli dziś generujesz obrazy z szablonów przez API, ta strona mówi, jak Lolly wykonuje to samo zadanie na Twoim własnym urządzeniu, w CI lub na Twoim własnym serwerze.

## Co lepiej robią hostowane API renderujące

[Bannerbear](https://www.bannerbear.com/) i [Placid](https://placid.app/) pakują renderowanie jako zarządzane usługi, z własną infrastrukturą, integracjami i wsparciem. Wysyłasz żądanie, a ktoś inny prowadzi serwery.

## Gdzie się pokrywają

Oba zamieniają szablon plus dane wejściowe w media. Lolly bierze dane wejściowe z [linku](/info/url-mode.html), [CLI](/info/cli.html), siatki batch lub punktu końcowego serwera.

## Jak Lolly wykonuje wspólne zadanie

To samo narzędzie renderuje się na laptopie, w zadaniu CI lub na serwerze, z tych samych danych wejściowych. Renderowanie lokalne i w CI nie wymaga żadnej usługi.

![Ustawienia eksportu Batch: nazwa pliku, domyślny format, jednostki, DPI i liczba wierszy do renderowania](/info/shots/use-batch-toolbar.svg)

Na serwerze [Lolly Work](/info/compare.html#what-runs-where) uruchamia silnik Lolly za API i stosuje widoczność narzędzi i polityki danych wejściowych. Jego [usługa renderowania z odzyskiwaniem](/info/work-renders.html) obsługuje pojedyncze zadania i partie, idempotentne zgłaszanie, status, ograniczone ponowienia, anulowanie i zachowane wyniki, a przerwana praca wznawia się po restarcie, gdy skonfigurowano trwały magazyn.

Serwer ma szybką ścieżkę SVG i PNG oraz opcjonalnego workera Chromium dla narzędzi potrzebujących przeglądarki. Automatyzacja loguje się tokenami usługi, gotowe wyniki mogą przejść przez [zatwierdzone dostarczanie](/info/work-delivery.html) do miejsc docelowych organizacji, a skonfigurowana tożsamość podpisująca dodaje Content Credentials do obsługiwanych wyników.

## Kto prowadzi usługę

Z Lolly osoba renderuje lokalnie albo zespół prowadzi Lolly Work na własnej infrastrukturze. Zgłoszenie zadania serwerowego wysyła jego dane wejściowe i wymagane zasoby do tej instancji, co różni się od ścieżki na urządzeniu. Trwała usługa potrzebuje trwałej bazy danych i magazynu wyników, a narzędzia zależne od przeglądarki potrzebują workera Chromium; [Install Lolly Work](/info/work-install.html) opisuje oba.

Bannerbear i Placid są znakami towarowymi swoich właścicieli. Ta strona opisuje, gdzie produkty się pokrywają, i nie jest powiązana z żadnym z nich.
