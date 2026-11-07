# Lolly i portale marki

_Pozycjonowanie zaktualizowano: 31 października 2026. Przykład możliwości dostawcy sprawdzono: 28 września 2026._

Jeśli Twoja organizacja trzyma zatwierdzone zasoby w Bynder, Frontify, Marq lub Brandfolder, ta strona porównuje to z Lolly plus Lolly Work: jak ludzie znajdują zasoby marki i jak tworzą z nich nowe pliki.

## Zachowanie istniejącego portalu

Istniejące DAM może pozostać źródłem zapisu. Konektory katalogu Lolly Work udostępniają wybraną część jego biblioteki w Lolly, gdzie ludzie tworzą nowe pliki według reguł organizacji. Dostęp regulują wspierane ograniczenia źródła DAM i reguły ekspozycji Lolly Work; końcowy przegląd wyniku to osobna decyzja.

[Use Lolly with your existing DAM](/info/use-with-dam.html) wyjaśnia odpowiedzialności i ograniczenia. [SUSE's Brandfolder experience](/info/suse-brandfolder.html) zapisuje udaną integrację, która wsparła zarządzanie zmianą przez administratorów przed planowaną migracją. Pozostawienie źródła połączonego nadal jest wspieraną opcją.

Celem Lolly jest [suwerenność treści](/info/content-sovereignty.html), w tym kontrola nad produkcją i swoboda wyboru systemów. Jego własna biblioteka i zatwierdzenia wspierają organizacje, które same chcą prowadzić te możliwości. [Lolly for DAM vendors and implementation partners](/info/dam-partners.html) opisuje, jak połączony przepływ pracy może dodać wartość istniejącemu systemowi zapisu.

## Co robi lepiej ugruntowany portal

Ugruntowane portale oferują zarządzany hosting, wsparcie i rozbudowane przepływy zarządzania zasobami. [Enterprise DAM Frontify](https://www.frontify.com/en/solution/enterprise-digital-asset-management) na przykład łączy wyszukiwanie zasobów, kontrolę dostępu, przepływy zatwierdzania i dystrybucję. Stos Lolly jest młodszy, a jego łańcuchy zatwierdzania są sekwencyjne, a nie dowolnymi rozgałęzionymi przepływami. [Lolly Work status and roadmap](/info/work-status.html) zapisuje jego ograniczenia wdrożeniowe.

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
| Publiczna strona marki | Lolly zapisuje statyczną [stronę marki](/info/brand-page.html), z Lolly Design System Setup lub wiersza poleceń: logo, kolory, typografię, reguły i przykłady dla ludzi oraz tokeny, `DESIGN.md` i skille dla agentów. Folder hostujesz sam albo administrator włącza w Lolly Work [hosting strony marki](/info/work-design-system-administration.html#host-a-brand-page), który domyślnie jest wyłączony. |

[Catalog and content](/info/work-catalog.html), [Approvals](/info/work-approvals.html) i [Policy and governance](/info/work-governance.html) opisują te funkcje i ich konfigurację.

## Oceń połączony przepływ pracy

Użyj [sekwencji produkcji kart wydarzeń](/info/dam-production.html), aby przetestować dostęp do źródła, dozwolone edycje, przegląd wyniku i dostarczenie na własnej bibliotece. [What runs where](/info/compare.html#what-runs-where) wymienia ograniczenia wspólne dla każdego porównania. Samo połączenie ze źródłem nie ustanawia partnerstwa z dostawcą ani kwalifikacji dla każdego tenanta.

Zobacz [How Lolly compares](/info/positioning.html), aby poznać porównanie możliwości. Nazwy dostawców identyfikują porównywane produkty; Lolly nie jest z nimi powiązane.
