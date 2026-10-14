# Lolly i Penpot

_Ostatnio sprawdzono: 28 września 2026._

Lolly i Penpot oferują narzędzia projektowe open source, współdzielone tokeny projektowe i współpracę na żywo. Lolly łączy tworzenie na urządzeniu z [lolly.work](https://lolly.work), swoją osobno wdrażaną usługą organizacyjną.

## Wspólne podstawy projektowe

[Tokeny projektowe Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) używają formatu DTCG, który Lolly również odczytuje. Kolory, typografię i inne wartości tokenów można współdzielić między tymi dwoma przepływami pracy. [Importuj projekt](/info/design-import.html) w Lolly otwiera eksport `.penpot` jako edytowalny układ.

Wtyczka Lolly Export dla Penpot jest utrzymywana przez Lolly. Wykorzystuje silnik Lolly do opcjonalnych C2PA Content Credentials na urządzeniu. Integralność podpisu i zaufanie do podpisującego to osobne kwestie: weryfikator potrzebuje tożsamości, której ufa, jak opisano w [Content Credentials Identity](/info/content-credentials-identity.html).

## Przepływy pracy projektowej i zespołowej

[Penpot](https://penpot.app/) zapewnia projektowanie interfejsów, komponenty, elastyczne układy, interaktywne prototypy i inspekcję dla deweloperów. Oferuje wdrożenia hostowane i samodzielnie hostowane, z [opcjami instalacji w Dockerze i Kubernetesie](https://help.penpot.app/technical-guide/getting-started/).

Kanwa Design w Lolly tworzy edytowalne zasoby i może zamienić układ w [narzędzie z regułami](/info/create-a-tool.html). To samo narzędzie renderuje w przeglądarce, aplikacji desktopowej lub CLI i potrafi generować warianty z danych. Do pracy zespołowej Lolly ma zarówno bezpośrednie [prywatne collaby](/info/collaborate.html) między dwoma urządzeniami, jak i collaby robocze przez lolly.work, ze wspólnymi edycjami, kursorami i zapisanymi sesjami zespołu.

## Czym różnią się wdrożenia

Samodzielne Lolly renderuje i podpisuje na urządzeniu, bez konta i bez serwera. lolly.work dodaje SSO, provisioning SCIM, współdzielone katalogi i projekty, role, zatwierdzanie, rejestry audytu i renderowanie serwerowe. Oba repozytoria są open source na licencji MPL-2.0 i organizacja może je samodzielnie obsługiwać. Praca współdzielona korzysta ze skonfigurowanej instancji; tworzenie lokalne pozostaje dostępne niezależnie.

Wybór zależy od pracy: przepływ projektowania interfejsów i prototypowania w Penpot, powtarzalna produkcja zasobów w Lolly albo połączenie wykorzystujące współdzielone tokeny i zaimportowane projekty. Współpraca w środowisku pracy w Lolly działa obecnie na jednym węźle serwera, a jej [status wdrożenia](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) powinien być częścią oceny w organizacji.

Penpot jest znakiem towarowym swojego właściciela. Powyższa wtyczka należy do Lolly. Szersze porównanie znajdziesz w [Jak Lolly wypada w porównaniu](/info/positioning.html) i [przeglądzie rozwiązania łączonego](/info/compare.html).
