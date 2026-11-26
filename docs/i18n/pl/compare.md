# Porównanie Lolly, narzędzie po narzędziu

Te strony mówią, czy Lolly zastępuje inny produkt, współdziała z nim czy nie pasuje do Twojej pracy. Każda strona zaczyna się od tego, co drugi produkt robi lepiej.

_Ostatnio sprawdzono: 28 września 2026._

<!--i:eti-grid-->
## Porównaj według produktu

- [Lolly i Canva](/info/compare-canva.html) - szablony, codzienne projektowanie i wspólne tworzenie materiałów marki.
- [Lolly i Adobe](/info/compare-adobe.html) - edycja, konwersja, profesjonalne pliki wynikowe i Content Credentials.
- [Lolly i Figma](/info/compare-figma.html) - projektowanie, współpraca na żywo i tworzenie zasobów do wielokrotnego użycia.
- [Lolly i Penpot](/info/compare-penpot.html) - projektowanie z otwartym kodem, wspólne tokeny i praca w organizacji.
- [Lolly i portale marki](/info/compare-brand-portals.html) - zatwierdzone biblioteki, zablokowane szablony, tożsamość, weryfikacja i raportowanie.
- [Lolly i API renderowania](/info/compare-render-apis.html) - automatyczne generowanie na Twoim urządzeniu, w CI lub na własnym serwerze oraz [jak przejść](/info/work-move-from-render-api.html) z Bannerbear lub Placid.
- [Lolly i konwertery plików online](/info/compare-converters.html) - konwersja formatów na Twoim urządzeniu.

[Jak wypada Lolly](/info/positioning.html) przedstawia porównanie poszczególnych możliwości. Każde porównanie ma datę. Twierdzenie, które przestało odpowiadać któremukolwiek z produktów, wymaga korekty.

<!--i:eti-map-pin-->
## Co gdzie działa

Każde porównanie obejmuje dwie części jednego projektu z otwartym kodem. **Lolly** to silnik, aplikacje i narzędzia. **Lolly Work** to serwer organizacji, utrzymywany w [repozytorium lolly-work](https://github.com/lolly-tools/lolly-work). Oba są na licencji MPL-2.0, a organizacja decyduje, które usługi Lolly Work włączyć.

::: cols
## Na Twoim urządzeniu: Lolly

- Bez konta przy samodzielnym użyciu
- Tworzenie, edycja, konwersja i eksport
- Działa offline po zapisaniu potrzebnych narzędzi i zasobów
- Content Credentials podpisywane na urządzeniu
- Prywatne sesje współpracy między dwoma urządzeniami, bez serwera

## Na serwerze Twojej organizacji: Lolly Work

- Logowanie jednokrotne, aprowizacja SCIM, role i polityki
- Współdzielone katalogi, projekty zespołu i służbowe sesje współpracy
- Zatwierdzenia, raportowanie użycia i zapisy audytu
- Renderowanie na serwerze, wznawialne zadania i zatwierdzone dostarczanie
- Podpisywanie na serwerze z tożsamością organizacji
:::

Samodzielne użycie zachowuje pliki na urządzeniu. Wybór współdzielonych projektów, służbowej sesji współpracy, renderu serwerowego lub dostarczania wysyła dane potrzebne tej funkcji na serwer Twojej organizacji.

<!--i:eti-info-->
## Założenia każdego porównania

Te ograniczenia dotyczą każdej strony w tym zestawie:

- **Sesje współpracy Lolly Work działają obecnie na jednym węźle serwera.** Ich skala i historia eksploatacji różnią się od produktów hostowanych o długiej historii. [Stan i plan rozwoju Lolly Work](/info/work-status.html) opisuje obecne ograniczenia.
- **Witryna [lolly.work](https://lolly.work) to demonstracyjne środowisko testowe.** Trwałe wdrożenie w organizacji wymaga trwałej pamięci masowej i operatora. [Instalacja Lolly Work](/info/work-install.html) opisuje oba wymagania.
- **Nie ma opłaty za licencję na oprogramowanie od użytkownika** dla Lolly ani Lolly Work na własnym serwerze. Hosting, przechowywanie danych i utrzymanie nadal kosztują.
- **Podpis nie oznacza zaufanego podpisującego.** Weryfikator pokazuje podpisującego jako zaufanego tylko wtedy, gdy ufa certyfikatowi użytemu do podpisania pliku. [Tożsamość Content Credentials](/info/content-credentials-identity.html) wyjaśnia, jak to działa.
