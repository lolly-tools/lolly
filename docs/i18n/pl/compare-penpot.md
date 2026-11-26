# Lolly i Penpot

_Ostatnio sprawdzono: 28 września 2026._

Jeśli Twój zespół projektuje w Penpot, Lolly współdziała z Penpot. Oba mają otwarty kod i odczytują te same tokeny projektowe. Ta strona wskazuje, do jakich zadań służy każdy z nich.

<!--i:eti-award-->
## Co Penpot robi lepiej

[Penpot](https://penpot.app/) zapewnia projektowanie interfejsów, komponenty, elastyczne układy, interaktywne prototypy i inspekcję dla programistów, z edycją w czasie rzeczywistym i kursorami na żywo. Oferuje wdrożenia hostowane i na własnym serwerze, z [opcją instalacji przez Docker i Kubernetes](https://help.penpot.app/technical-guide/getting-started/). Do projektowania aplikacji właściwym narzędziem jest Penpot.

<!--i:eti-blend-->
## Gdzie ich możliwości się pokrywają

[Tokeny projektowe Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) używają formatu DTCG, który odczytuje też Lolly, więc kolory, typografia i inne wartości tokenów przechodzą między nimi. Funkcja Lolly [Import projektu](/info/design-import.html) otwiera eksport `.penpot` jako edytowalny układ, a **Send to Penpot** w Lolly odsyła projekt jako archiwum `.penpot`. Lolly utrzymuje też [wtyczkę Lolly Export dla Penpot](https://github.com/lolly-tools/lolly-plugins-penpot-export), która używa silnika Lolly do dodawania Content Credentials na urządzeniu po wyrażeniu zgody.

<!--i:eti-lolly-->
## Jak Lolly wykonuje wspólne zadania

Kanwa Lolly Design tworzy edytowalne zasoby i może zamienić układ w [narzędzie z regułami](/info/create-a-tool.html). To samo narzędzie renderuje w przeglądarce, aplikacji desktopowej lub CLI i tworzy warianty na podstawie danych. Samodzielne Lolly renderuje i podpisuje na urządzeniu, bez konta i serwera. [Prywatna sesja współpracy](/info/collaborate.html) łączy dwa urządzenia bezpośrednio.

<!--i:eti-building-->
## W organizacji

Lolly Work dodaje logowanie jednokrotne, aprowizację SCIM, współdzielone katalogi i projekty, role, zatwierdzenia, zapisy audytu, służbowe sesje współpracy i renderowanie na serwerze. Oba repozytoria są na licencji MPL-2.0, a organizacja może uruchamiać oba. [Co gdzie działa](/info/compare.html#what-runs-where) zestawia obie części.

Możesz używać obu: Penpot do projektowania interfejsów i prototypowania, Lolly do powtarzalnych plików.

Penpot jest znakiem towarowym swojego właściciela. Ta strona opisuje, gdzie możliwości obu produktów się pokrywają, i nie jest powiązana z Penpot.
