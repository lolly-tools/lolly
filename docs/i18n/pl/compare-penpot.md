# Lolly i Penpot

_Ostatnio sprawdzono: 28 września 2026._

Jeśli Twój zespół projektuje w Penpot, Lolly działa obok Penpot: oba są open source i oba czytają te same tokeny projektowe. Ta strona mówi, do jakiego zadania służy każde z nich.

## Co Penpot robi lepiej

[Penpot](https://penpot.app/) zapewnia projektowanie interfejsów, komponenty, elastyczne układy, interaktywne prototypy i inspekcję dla deweloperów, z edycją w czasie rzeczywistym i kursorami na żywo. Oferuje wdrożenia hostowane i samodzielnie hostowane, z [opcjami instalacji Docker i Kubernetes](https://help.penpot.app/technical-guide/getting-started/). Do projektowania aplikacji Penpot jest właściwym narzędziem.

## Gdzie się pokrywają

[Tokeny projektowe Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) używają formatu DTCG, który Lolly też czyta, więc kolory, typografia i inne wartości tokenów przechodzą między nimi. [Import a design](/info/design-import.html) w Lolly otwiera eksport `.penpot` jako edytowalny układ, a **Send to Penpot** w Lolly wysyła projekt z powrotem jako archiwum `.penpot`. Lolly utrzymuje też [wtyczkę Lolly Export dla Penpot](https://github.com/lolly-tools/lolly-plugins-penpot-export), która używa silnika Lolly do dodawania opcjonalnych Content Credentials na urządzeniu.

## Jak Lolly wykonuje wspólne zadanie

Kanwa Design w Lolly tworzy edytowalne zasoby i może zamienić układ w [narzędzie z regułami](/info/create-a-tool.html). To samo narzędzie renderuje się w przeglądarce, aplikacji komputerowej lub CLI i tworzy warianty z danych. Samodzielne Lolly renderuje i podpisuje na urządzeniu, bez konta i serwera. [Prywatny collab](/info/collaborate.html) łączy dwa urządzenia bezpośrednio.

## Z organizacją

Lolly Work dodaje jednokrotne logowanie, provisioning SCIM, wspólne katalogi i projekty, role, zatwierdzenia, zapisy audytu, collaby robocze i renderowanie serwerowe. Oba repozytoria są na MPL-2.0, a organizacja może prowadzić oba. [What runs where](/info/compare.html#what-runs-where) zestawia obie części obok siebie.

Możesz użyć obu: Penpot do projektowania interfejsów i prototypowania, Lolly do powtarzalnych plików, połączonych wspólnymi tokenami i zaimportowanymi projektami.

Penpot jest znakiem towarowym swojego właściciela. Ta strona opisuje, gdzie oba produkty się pokrywają, i nie jest powiązana z Penpot.
