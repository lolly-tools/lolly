# Lolly i portale marki

_Pozycjonowanie zaktualizowano: 31 października 2026. Przykład możliwości dostawcy sprawdzono: 28 września 2026._

Jeśli Twoja organizacja przechowuje zatwierdzone zasoby w Bynder, Frontify, Marq lub Brandfolder, ta strona porównuje ten portal z Lolly i Lolly Work. Opisuje, jak ludzie znajdują zasoby marki i jak tworzą z nich nowe pliki.

<!--i:eti-folder-shared-->
## Zachowanie obecnego portalu

Obecny DAM może pozostać źródłem nadrzędnym. Konektory katalogowe Lolly Work udostępniają wybraną część jego biblioteki w Lolly, gdzie ludzie tworzą nowe pliki według reguł organizacji. Dostęp regulują obsługiwane ograniczenia źródła DAM i reguły udostępniania Lolly Work. Weryfikacja końcowego wyniku to osobna decyzja.

[Używanie Lolly z obecnym DAM](/info/use-with-dam.html) wyjaśnia podział odpowiedzialności i ograniczenia. [Doświadczenia SUSE z Brandfolder](/info/suse-brandfolder.html) opisują udaną integrację, która wspierała zarządzanie zmianą przez administratorów przed planowaną migracją.

Celem Lolly jest [suwerenność treści](/info/content-sovereignty.html), w tym kontrola nad produkcją i swoboda wyboru systemów. Własna biblioteka i zatwierdzenia służą organizacjom, które decydują się samodzielnie utrzymywać te funkcje. [Lolly dla dostawców DAM i partnerów wdrożeniowych](/info/dam-partners.html) opisuje, jak połączony proces pracy może wzbogacić istniejący system nadrzędny.

<!--i:eti-award-->
## Co dojrzały portal robi lepiej

Dojrzałe portale oferują zarządzany hosting, wsparcie i rozbudowane procesy zarządzania zasobami. [DAM Frontify dla przedsiębiorstw](https://www.frontify.com/en/solution/enterprise-digital-asset-management) łączy wyszukiwanie zasobów, kontrolę dostępu, procesy zatwierdzania i dystrybucję. Stos Lolly jest młodszy. Jego łańcuchy zatwierdzania są sekwencyjne i nie mogą się dowolnie rozgałęziać. [Stan i plan rozwoju Lolly Work](/info/work-status.html) opisuje ograniczenia wdrożeń.

<!--i:eti-blend-->
## Gdzie ich możliwości się pokrywają

Oba obejmują zatwierdzone zasoby, zablokowane szablony, kontrolę dostępu, weryfikację i dystrybucję. Lolly tworzy pliki. Szablony, tokeny projektowe i dozwolone dane wejściowe określają, co ktoś może zmienić, a renderowanie może pozostać na jego urządzeniu. Lolly Work dodaje tożsamość, współdzieloną pamięć masową, politykę, zatwierdzenia i raportowanie na infrastrukturze kontrolowanej przez organizację.

![Aktywny system projektowy w Settings, pokazany jako okładka i strony: kolory, typografia i logotypy używane do rysowania przez każde narzędzie](/info/shots/dashboard-brand.svg)

<!--i:eti-lolly-->
## Co zapewniają Lolly i Lolly Work

| Potrzeba | Lolly + Lolly Work |
|---|---|
| Logowanie i aprowizacja | Logowanie jednokrotne OIDC, wielu dostawców tożsamości, aprowizacja użytkowników i członkostwa w grupach przez SCIM 2.0 oraz wyłączanie kont z unieważnianiem istniejących sesji. Dostawca tożsamości obsługujący tylko SAML może połączyć się przez most OIDC, np. Keycloak. |
| Zatwierdzone szablony | Lolly określa edytowalne dane wejściowe szablonu; Lolly Work stosuje widoczność według grup i polityki danych wejściowych, które blokują wartości, ograniczają wybór lub ukrywają kontrolki. |
| Współdzielona biblioteka zasobów | Przesłane pliki należące do instancji, kolekcje, własne metadane i katalogi z kontrolą dostępu oraz konektory odczytujące istniejące biblioteki DAM i magazyny danych. |
| Weryfikacja | Uporządkowane kroki zatwierdzania, grupy uprawnionych zatwierdzających, reguły kworum i rozdział obowiązków; weryfikacja może regulować zgłoszenia do katalogu i dostarczanie do celów organizacji. |
| Historia i dostępność zasobów | Wersje i przywracanie dla zasobów należących do instancji, retencja i blokady usuwania, zaplanowana dostępność, wygasanie i unieważnianie. Podłączeni dostawcy zachowują własną historię źródeł. |
| Licencje i oznaczenia autorstwa | Lolly zapisuje licencję każdego źródła używanego przez plik i przygotowuje wymagane oznaczenia autorstwa; [Prawa do twórczości i oznaczenia autorstwa](/info/creative-rights.html) wyjaśniają, co jest zapisywane i gdzie trafiają oznaczenia. Nie uzyskuje zezwoleń na korzystanie z praw. |
| Raportowanie | Liczby użyć i pobrań zasobów, aktywność narzędzi i eksportu, pulpity i ślad audytowy. Przypisywanie użycia do użytkowników jest zgodne z polityką telemetrii wdrożenia; domyślne ustawienie przypisywania wymaga zgody. |
| Dystrybucja | Wygasające linki, które można unieważnić, współdzielone kolekcje, dostęp gości i dostarczanie do skonfigurowanych miejsc docelowych organizacji. |
| Publiczna strona marki | Lolly zapisuje statyczną [stronę marki](/info/brand-page.html) z Lolly Design System Setup lub wiersza poleceń: logotypy, kolory, typografię, reguły i przykłady dla ludzi oraz tokeny, `DESIGN.md` i umiejętności dla agentów. Hostujesz folder samodzielnie lub administrator włącza [hosting strony marki](/info/work-design-system-administration.html#host-a-brand-page) w Lolly Work, domyślnie wyłączony. |

[Katalog i treści](/info/work-catalog.html), [Zatwierdzenia](/info/work-approvals.html) oraz [Polityka i zarządzanie](/info/work-governance.html) opisują te funkcje i ich konfigurację.

<!--i:eti-checklist-->
## Oceń połączony proces pracy

Użyj [sekwencji tworzenia karty wydarzenia](/info/dam-production.html), aby sprawdzić dostęp do źródeł, dozwolone edycje, weryfikację wyniku i dostarczanie z własną biblioteką. [Co gdzie działa](/info/compare.html#what-runs-where) wymienia ograniczenia wspólne dla wszystkich porównań. Samo połączenie ze źródłem nie oznacza partnerstwa z dostawcą ani potwierdzonej zgodności dla każdego dzierżawcy.

[Jak wypada Lolly](/info/positioning.html) zawiera porównanie możliwości. Nazwy dostawców identyfikują porównywane produkty. Lolly nie jest z nimi powiązane.
