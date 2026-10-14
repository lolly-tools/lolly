# Lolly i API renderowania

_Ostatnio sprawdzono: 28 września 2026._

Lolly generuje zasoby z szablonów i danych na Twoim urządzeniu, w CI lub przez API serwera [lolly.work](https://lolly.work). Rozwiązanie łączone obejmuje automatyczne renderowanie, a także tożsamość, zasady i dostarczanie wokół zadań produkcyjnych organizacji.

## Gdzie się pokrywają

[Bannerbear](https://www.bannerbear.com/) i [Placid](https://placid.app/) generują obrazy i inne media z szablonów przez API i integracje. Lolly stosuje to samo podejście szablonu z danymi wejściowymi, a pracę można zgłaszać przez [tryb URL](/info/url-mode.html), [CLI](/info/cli.html), siatkę wsadową i punkty końcowe serwera.

## Co zapewnia lolly.work

lolly.work to osobno wdrażana usługa organizacyjna w projekcie Lolly. Uruchamia silnik Lolly za API, stosuje zasady widoczności narzędzi i danych wejściowych oraz udostępnia wyrenderowane pliki i podpisane linki do udostępniania. Jego [usługa renderowania z możliwością odzyskiwania](https://github.com/lolly-tools/lolly-work/blob/main/docs/renders.md) obsługuje pojedyncze zadania i partie, idempotentne zgłaszanie, status, ograniczone ponowne próby, anulowanie i zachowane wyniki. Przerwana praca może zostać wznowiona po restarcie serwera, gdy skonfigurowano trwałe przechowywanie.

Serwer używa szybkiej ścieżki renderowania SVG/PNG oraz opcjonalnego workera Chromium dla narzędzi, które potrzebują przeglądarki. Automatyzacja uwierzytelnia się tokenami usługi, a gotowe wyniki można wysłać przez [zarządzane dostarczanie](https://github.com/lolly-tools/lolly-work/blob/main/docs/delivery.md) do miejsc docelowych organizacji. Skonfigurowana tożsamość podpisująca umożliwia podpisywanie C2PA obsługiwanych wyników serwera.

## Kto prowadzi usługę

Bannerbear i Placid oferują renderowanie jako usługi zarządzane z własną infrastrukturą i integracjami. W Lolly osoba indywidualna może renderować lokalnie, a zespół może prowadzić lolly.work na własnej infrastrukturze. Oba repozytoria Lolly są open source na licencji MPL-2.0; samodzielny hosting nie wiąże się z opłatą licencyjną za oprogramowanie za renderowanie, natomiast moc obliczeniowa, przechowywanie i obsługa pozostają kosztami, które trzeba zaplanować.

Publiczna witryna lolly.work to piaskownica do oceny, a nie zobowiązanie do hostingu produkcyjnego. Trwała usługa wymaga trwałej bazy danych i przechowywania wyników; narzędzia zależne od przeglądarki wymagają workera Chromium. [Przewodnik instalacji](https://github.com/lolly-tools/lolly-work/blob/main/docs/install.md) i [strona statusu](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) opisują te wymagania i obecne ograniczenia.

Renderowanie lokalne i w CI pozostaje dostępne bez usługi organizacyjnej. Zgłoszenie zadania serwerowego wysyła jego dane wejściowe i wymagane zasoby do tej instancji; to coś innego niż ścieżka na urządzeniu. Zobacz [przegląd rozwiązania łączonego](/info/compare.html).

Bannerbear i Placid są znakami towarowymi swoich właścicieli. Ta strona opisuje, gdzie rozwiązania się pokrywają, i nie jest powiązana z żadnym z nich.
