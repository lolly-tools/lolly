# Lolly i Figma

_Ostatnio sprawdzono: 28 września 2026._

Lolly obsługuje projektowanie, edycję na żywo i produkcję zasobów wielokrotnego użytku. [lolly.work](https://lolly.work) dodaje wokół tej pracy usługi organizacyjne: tożsamość, współdzielone projekty, kontrolę dostępu i zatwierdzanie.

## Gdzie się pokrywają

Oba pozwalają rozmieszczać tekst, kształty i obrazy na kanwie oraz pracować z innymi osobami. [Importuj projekt](/info/design-import.html) w Lolly odczytuje pliki Figma jako edytowalne układy. Figma obejmuje też produkcję materiałów marki opartą na szablonach: [Figma Buzz](https://help.figma.com/hc/en-us/articles/31271566667543-Guide-to-Figma-Buzz) tworzy zasoby z szablonów i wypełnia je z plików CSV lub XLSX.

Lolly zamienia projekt w [narzędzie wielokrotnego użytku z regułami](/info/create-a-tool.html). Narzędzie to działa w przeglądarce lub CLI i przyjmuje dane wejściowe z adresu URL, skryptu lub siatki wsadowej. Ten sam szablon obsługuje zarówno osobę edytującą jeden zasób, jak i zespół produkujący wiele wariantów.

## Współpraca i projektowanie produktów

[Figma Design](https://www.figma.com/design/) łączy projektowanie interfejsów, komponenty, interaktywne prototypy i przekazanie projektu deweloperom. Jej ugruntowany przepływ pracy projektowania produktów i ekosystem mają znaczenie, gdy zespół musi zaprojektować i opisać kompletną aplikację.

Lolly oferuje dwa rodzaje współpracy na żywo. [Prywatny collab](/info/collaborate.html) łączy bezpośrednio dwa urządzenia, bez konta i bez internetu w sieci współdzielonej. Collab roboczy korzysta z lolly.work do uwierzytelnionego dostępu, wspólnych edycji, kursorów na żywo i zapisanych sesji zespołu. Współpraca w środowisku pracy jest zaimplementowana zarówno w kliencie Lolly, jak i na serwerze lolly.work; jej obecne wdrożenie na jednym węźle nie dowodzi parytetu ze skalą działania Figmy.

## Wdrożenie i produkcja

Aplikacje twórcze Lolly i lolly.work to osobno wdrażane części tego samego projektu open source. Samodzielne Lolly może renderować offline bez konta. lolly.work zapewnia SSO, SCIM, współdzielone katalogi, uprawnienia projektów, zatwierdzanie, rejestry audytu i renderowanie serwerowe na infrastrukturze kontrolowanej przez organizację.

Sesje zespołu i edycje collabów roboczych trafiają do tej instancji; renderowanie lokalne może pozostać na urządzeniu. Content Credentials są opcjonalne dla obsługiwanych eksportów, a podpisywanie po stronie serwera używa skonfigurowanej tożsamości organizacji. Podział opisuje [przegląd rozwiązania łączonego](/info/compare.html), a to, jak weryfikator ufa podpisującemu, [Content Credentials Identity](/info/content-credentials-identity.html).

Figma jest znakiem towarowym swojego właściciela. Ta strona opisuje, gdzie oba rozwiązania się pokrywają, i nie jest powiązana z firmą Figma.
