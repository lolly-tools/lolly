# Lolly i portale marki

_Ostatnio sprawdzono: 28 września 2026._

Lolly i [lolly.work](https://lolly.work) razem obejmują przepływy tworzenia i zarządzania, do których zespoły używają portali marki: zatwierdzone zasoby, zablokowane szablony, kontrola dostępu, przegląd i dystrybucja. Porównaj to rozwiązanie łączone z Bynder, Frontify, Marq lub Brandfolder, wybierając sposób, w jaki ludzie znajdują zasoby marki i tworzą nowe.

## Tworzenie i usługi organizacyjne

Silnik i aplikacje Lolly tworzą pliki. Szablony, tokeny projektowe i dozwolone dane wejściowe określają, co można zmienić, a renderowanie może pozostać na urządzeniu użytkownika. Samodzielne Lolly nie wymaga konta.

lolly.work to usługa organizacyjna w tym samym projekcie, utrzymywana w [osobnym repozytorium](https://github.com/lolly-tools/lolly-work) i wdrażana obok Lolly. Dodaje tożsamość, współdzielone przechowywanie, zasady, zatwierdzanie i raportowanie. Obie części są open source na licencji MPL-2.0. Taki podział pozwala osobie indywidualnej korzystać z Lolly niezależnie, a organizacji uruchomić rozwiązanie łączone na infrastrukturze, którą kontroluje.

## Co zapewnia rozwiązanie łączone

| Potrzeba | Lolly + lolly.work |
|---|---|
| Logowanie i provisioning | Logowanie jednokrotne OIDC, wielu dostawców tożsamości, provisioning użytkowników SCIM 2.0 i członkostwo w grupach oraz wyłączanie kont, które unieważnia istniejące sesje. Dostawca tożsamości obsługujący wyłącznie SAML może łączyć się przez most OIDC, taki jak Keycloak. |
| Zatwierdzone szablony | Lolly definiuje edytowalne dane wejściowe szablonu; lolly.work stosuje widoczność dla grup i zasady danych wejściowych, które blokują wartości, ograniczają wybór lub ukrywają kontrolki. |
| Współdzielona biblioteka zasobów | Przesłane pliki należące do instancji, kolekcje, niestandardowe metadane i katalogi z kontrolą dostępu oraz konektory odczytujące istniejące biblioteki DAM i magazyny. |
| Przegląd | Uporządkowane kroki zatwierdzania, uprawnione grupy zatwierdzających, reguły kworum i rozdział obowiązków; przegląd może obejmować zgłoszenia do katalogów i dostarczanie do celów organizacji. |
| Historia i dostępność zasobów | Wersje i przywracanie dla zasobów należących do instancji, retencja i blokady, zaplanowana dostępność, wygasanie i unieważnianie. Podłączeni dostawcy zachowują własną historię źródłową. |
| Raportowanie | Liczniki użycia i pobrań zasobów, aktywność narzędzi i eksportów, pulpity oraz ślad audytu. Przypisywanie użycia zależy od zasad telemetrii wdrożenia; domyślne ustawienie przypisywania wymaga zgody. |
| Dystrybucja | Wygasające i odwoływalne linki, współdzielone kolekcje, dostęp dla gości i dostarczanie do skonfigurowanych miejsc docelowych organizacji. |

[Przewodniki operatora lolly.work](https://github.com/lolly-tools/lolly-work/tree/main/docs) opisują te funkcje i ich konfigurację. To dostępne możliwości, a nie funkcje, które wymagają budowania kolejnego systemu wokół Lolly.

## Wybór przepływu pracy portalu

Ugruntowane portale oferują zarządzany hosting, wsparcie i rozbudowane przepływy pracy DAM. Na przykład [enterprise DAM firmy Frontify](https://www.frontify.com/en/solution/enterprise-digital-asset-management) łączy wyszukiwanie zasobów, kontrolę dostępu, przepływy zatwierdzania i dystrybucję. Porównaj dokładny przepływ przeglądu i praw, którego potrzebujesz: Lolly zapewnia metadane oraz kontrolę dostępu i dostępności, natomiast prawne dopuszczenie i zobowiązania licencyjne nadal wymagają procesu organizacji. Jego łańcuchy zatwierdzania są sekwencyjne; nie modelują dowolnie rozgałęzionych przepływów pracy.

Stos Lolly jest młodszy, a [strona statusu lolly.work](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) rejestruje ograniczenia jego wdrożenia. W szczególności publiczna witryna lolly.work jest piaskownicą do oceny. Trwałe wdrożenie w organizacji wymaga trwałego przechowywania i operatora. Samodzielny hosting nie wiąże się z opłatą licencyjną za oprogramowanie za użytkownika; infrastruktura i administracja nadal kosztują.

Istniejący system DAM może też pozostać źródłem prawdy. Konektory katalogów lolly.work udostępniają jego zatwierdzone zasoby w Lolly, gdzie ludzie tworzą nowe pliki według reguł organizacji. To wybór integracyjny; własna biblioteka i zatwierdzanie w Lolly są dostępne, gdy organizacja chce samodzielnie zarządzać tymi przepływami pracy.

Porównanie możliwości znajdziesz w [Jak Lolly wypada w porównaniu](/info/positioning.html), a pozostałe strony tego zestawu w [Lolly w porównaniu, narzędzie po narzędziu](/info/compare.html). Nazwy dostawców identyfikują porównywane produkty; Lolly nie jest z nimi powiązane.
