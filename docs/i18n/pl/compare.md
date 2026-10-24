# Lolly w porównaniu, narzędzie po narzędziu

Jeśli już używasz innego produktu, te strony mówią, czy Lolly go zastępuje, działa obok niego, czy nie pasuje do Twojej pracy. Każda zaczyna od tego, co inny produkt robi lepiej.

_Ostatnio sprawdzono: 28 września 2026._

## Porównaj według produktu

- [Lolly and Canva](/info/compare-canva.html) - szablony, codzienny projekt i wspólna produkcja marki.
- [Lolly and Adobe](/info/compare-adobe.html) - edycja, konwersja, profesjonalny wynik i Content Credentials.
- [Lolly and Figma](/info/compare-figma.html) - projekt, współpraca na żywo i produkcja zasobów wielokrotnego użytku.
- [Lolly and Penpot](/info/compare-penpot.html) - projekt open source, wspólne tokeny i praca organizacji.
- [Lolly and brand portals](/info/compare-brand-portals.html) - zatwierdzone biblioteki, zablokowane szablony, tożsamość, przegląd i raportowanie.
- [Lolly and rendering APIs](/info/compare-render-apis.html) - zautomatyzowane generowanie na Twoim urządzeniu, w CI lub na serwerze Lolly Work.
- [Lolly and online file converters](/info/compare-converters.html) - konwersja formatów na Twoim własnym urządzeniu.

Porównanie funkcja po funkcji znajdziesz w [Jak Lolly wypada w porównaniu](/info/positioning.html). Każde porównanie jest datowane; twierdzenie, które przestało zgadzać się z którymkolwiek z produktów, wymaga poprawki.

## Co działa gdzie

Każde porównanie obejmuje dwie części jednego projektu open source. **Lolly** to silnik, aplikacje i narzędzia. **Lolly Work** to serwer organizacji, utrzymywany w [repozytorium lolly-work](https://github.com/lolly-tools/lolly-work). Oba są na MPL-2.0, a organizacja decyduje, które usługi Lolly Work włączyć.

::: cols
## Na Twoim urządzeniu: Lolly

- Bez konta przy samodzielnym użyciu
- Tworzenie, edycja, konwersja i eksport
- Działa offline, gdy potrzebne narzędzia i zasoby są zapisane
- Content Credentials podpisane na urządzeniu
- Prywatne collaby między dwoma urządzeniami, bez serwera

## Na serwerze Twojej organizacji: Lolly Work

- Jednokrotne logowanie, provisioning SCIM, role i polityki
- Wspólne katalogi, wspólne projekty i collaby robocze
- Zatwierdzenia, raportowanie użycia i zapisy audytu
- Renderowanie serwerowe, zadania do odzyskania i zatwierdzone dostarczanie
- Podpisywanie serwerowe tożsamością organizacji
:::

Samodzielne użycie zachowuje pliki na urządzeniu. Wybór wspólnych projektów, collabu roboczego, renderowania serwerowego lub dostarczania wysyła dane, których ta funkcja potrzebuje, na serwer Twojej organizacji.

## Co zakłada każde porównanie

Te ograniczenia dotyczą każdej strony w tym zestawie, więc są podane raz tutaj:

- **Collaby robocze działają dziś na jednym węźle serwera.** Ich skala i historia działania różnią się od długo ugruntowanych produktów hostowanych. [Work status and roadmap](/info/work-status.html) zapisuje bieżące ograniczenia.
- **Witryna [lolly.work](https://lolly.work) to demonstracyjna piaskownica.** Trwałe wdrożenie organizacji wymaga trwałego magazynu i operatora; [Install Lolly Work](/info/work-install.html) omawia oba.
- **Nie ma opłaty licencyjnej za stanowisko** za Lolly ani samodzielnie hostowane Lolly Work. Hosting, magazyn i obsługa nadal kosztują.
- **Podpis to nie zaufany podpisujący.** Weryfikator musi zaufać certyfikatowi, który podpisał plik, zanim pokaże podpisującego jako zaufanego; [Content Credentials Identity](/info/content-credentials-identity.html) wyjaśnia jak.
