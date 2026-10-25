# Lolly i portale marki

_Ostatnio sprawdzono: 28 września 2026._

Jeśli Twoja organizacja trzyma zatwierdzone zasoby w Bynder, Frontify, Marq lub Brandfolder, ta strona porównuje to z Lolly plus Lolly Work: jak ludzie znajdują zasoby marki i jak tworzą z nich nowe pliki.

## Co robi lepiej ugruntowany portal

Ugruntowane portale oferują zarządzany hosting, wsparcie i rozbudowane przepływy zarządzania zasobami. [Enterprise DAM Frontify](https://www.frontify.com/en/solution/enterprise-digital-asset-management) na przykład łączy wyszukiwanie zasobów, kontrolę dostępu, przepływy zatwierdzania i dystrybucję. Stos Lolly jest młodszy, a jego łańcuchy zatwierdzania są sekwencyjne, a nie dowolnymi rozgałęzionymi przepływami. [Work status and roadmap](/info/work-status.html) zapisuje jego ograniczenia wdrożeniowe.

## Gdzie się pokrywają

Oba obejmują zatwierdzone zasoby, zablokowane szablony, kontrolę dostępu, przegląd i dystrybucję. Lolly tworzy pliki: szablony, tokeny projektowe i dozwolone dane wejściowe określają, co ktoś może zmienić, a renderowanie może zostać na jego urządzeniu. Lolly Work dodaje tożsamość, wspólny magazyn, politykę, zatwierdzenia i raportowanie na infrastrukturze kontrolowanej przez organizację.

![Aktywny system projektowy w Settings, pokazany jako okładka i strony: kolory, typografia i logo, z których rysuje każde narzędzie](/info/shots/dashboard-brand.svg)

## Co zapewniają Lolly i Lolly Work

| Potrzeba | Lolly + Lolly Work |
|---|---|
| Logowanie i provisioning | Jednokrotne logowanie OIDC, wielu dostawców tożsamości, provisioning użytkowników SCIM 2.0 i członkostwo w grupach oraz wyłączanie kont, które unieważnia istniejące sesje. Dostawca tożsamości tylko SAML może się połączyć przez most OIDC, taki jak Keycloak. |
| Zatwierdzone szablony | Lolly definiuje edytowalne dane wejściowe szablonu; Lolly Work stosuje widoczność grup i polityki danych wejściowych, które blokują wartości, ograniczają wybory lub ukrywają kontrolki. |
| Wspólna biblioteka zasobów | Wgrane pliki należące do instancji, kolekcje, metadane niestandardowe i katalogi z kontrolą dostępu, plus konektory czytające istniejące biblioteki DAM i magazynu. |
| Przegląd | Uporządkowane kroki zatwierdzania, uprawnione grupy zatwierdzających, reguły kworum i rozdział obowiązków; przegląd może obejmować zgłoszenia do katalogu i dostarczanie do celów organizacji. |
| Historia zasobów i dostępność | Wersje i wycofywanie dla zasobów należących do instancji, retencja i blokady, planowana dostępność, wygaśnięcie i unieważnienie. Połączeni dostawcy zachowują własną historię źródła. |
| Licencje i uznania autorstwa | Lolly zapisuje licencję każdego źródła używanego przez plik i przygotowuje uznania, które mu się należą; [Creative rights and credits](/info/creative-rights.html) wyjaśnia, co zapisuje i gdzie uznania są zapisywane. Nie rozstrzyga praw. |
| Raportowanie | Liczby użycia i pobrań zasobów, aktywność narzędzi i eksportów, panele i ślad audytu. Przypisanie użycia podlega polityce telemetrii wdrożenia; domyślne ustawienie przypisania wymaga zgody. |
| Dystrybucja | Wygasające, możliwe do unieważnienia linki, wspólne kolekcje, dostęp gościa i dostarczanie do skonfigurowanych miejsc docelowych organizacji. |

[Catalog and content](/info/work-catalog.html), [Approvals](/info/work-approvals.html) i [Policy and governance](/info/work-governance.html) opisują te funkcje i ich konfigurację.

## Zachowanie istniejącego portalu

Istniejące DAM może pozostać źródłem prawdy. Konektory katalogu Lolly Work udostępniają jego zatwierdzone zasoby w Lolly, gdzie ludzie tworzą nowe pliki według reguł organizacji. To wybór integracji; własna biblioteka i zatwierdzenia Lolly są tam, gdy organizacja chce je prowadzić sama. [What runs where](/info/compare.html#what-runs-where) wymienia ograniczenia wspólne dla każdego porównania.

Zobacz [How Lolly compares](/info/positioning.html), aby poznać porównanie możliwości. Nazwy dostawców identyfikują porównywane produkty; Lolly nie jest z nimi powiązane.
