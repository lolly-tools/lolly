# Jak działa Lolly

Narzędzie Lolly zawiera reguły dla jednego rodzaju pliku: układ, typografię, kolory i to, które części inni mogą zmieniać. Ty, współpracownik, skrypt lub agent AI wypełniacie pola, a każdy plik jest zgodny z tymi regułami.

<!--i:eti-repeat-->
## Jedno narzędzie, Twoje reguły, wiele plików

Reguły marki są zapisane w narzędziu. Skonfiguruj je raz, a każdy wynik będzie miał tę samą typografię, kolory i odstępy, od pojedynczej karty po arkusz wierszy w kilkunastu językach.

![Narzędzie do wordmarków z jednym wypełnionym polem: typografię, kolor i odstępy ustalono podczas tworzenia narzędzia](/info/shots/aud-rules-in-the-tool.svg)

Osoba tworząca setny plik tylko wpisuje tekst. Ty decydujesz, jak sprawdzać pracę i kto ją sprawdza. Z Lolly jest mniej do sprawdzenia, a kolejny plik powstaje szybciej.

<!--i:eti-users-->
## Kto pracuje z narzędziem

Trzy role w organizacji pracują nad jedną kartą kampanii.

![Projektant ustala reguły w narzędziu raz; programista uruchamia je ze skryptu, a każdy może wypełnić jego pola; obie drogi prowadzą do gotowych plików](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **Projektant ustala reguły.** Tworzy układ karty w Lolly Design z typografią i kolorami marki, a potem wybiera pola dostępne do edycji. Robi to raz, aby nikt nie musiał ponownie ręcznie lokalizować karty.
- <!--i:code--> **Programista zwiększa skalę użycia narzędzia.** To samo narzędzie działa w nocnym skrypcie przez wiersz poleceń. Nowy wykres lub nowa wersja językowa powstaje bez ponownego otwierania projektu.
- <!--i:people--> **Każdy może je wypełnić.** Przedstawiciel handlowy w samolocie, bez sieci i przygotowania projektowego, otwiera narzędzie i tworzy kartę na jutrzejsze spotkanie.
:::

Nowy wykres programisty to render taki jak ten, utworzony z ciągu danych i kilku ustawień:

![Skumulowany wykres warstwowy z tytułem, trzema pasmami serii w chłodnej palecie oraz osiami, legendą i tytułem rozmieszczonymi przez szablon zamiast ręcznie](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Ta minuta pracy handlowca opiera się na regułach projektanta i skrypcie programisty. Każda rola korzysta z tego samego narzędzia.

<!--i:eti-train-->
## Cztery drogi do pliku

Każda droga uruchamia ten sam silnik na tym samym narzędziu, więc plik ze skryptu odpowiada temu, co widzisz w podglądzie aplikacji.

![Parametry URL i argumenty wiersza poleceń tworzą ten sam model wejściowy, przetwarzany przez jedno wspólne środowisko wykonawcze i most eksportu](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **W aplikacji, pojedynczo.** Otwórz narzędzie, wypełnij pola i naciśnij **Export**. [Utwórz swój pierwszy plik](/info/make-something.html) przeprowadzi Cię przez ten proces.
- <!--i:layers--> **W aplikacji, wiele naraz.** [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) przyjmuje wklejoną lub zaimportowaną tabelę i renderuje jeden gotowy plik na wiersz.
- <!--i:cpu--> **Ze skryptu lub przez agenta AI.** [CLI](/info/cli.html) uruchamia narzędzie bez interfejsu graficznego, a [serwer MCP](/info/mcp.html) pozwala agentowi wykrywać i uruchamiać narzędzia. Link do narzędzia zawiera też dane wejściowe, więc jest kompletnym żądaniem.
- <!--i:server--> **Przez serwer Twojej organizacji.** [Lolly Work](/info/organisation.html) renderuje na serwerze zgodnie z zasadami logowania i używania narzędzi w organizacji, zachowuje zadania, które może wznowić, i przechowuje wynik do pobrania lub zatwierdzonego dostarczenia.

Dostępna droga zależy od formatów narzędzia i możliwości hosta. Niektóre formaty wymagają przeglądarki, więc wiersz poleceń przekazuje je do warstwy przeglądarkowej. [Renderowanie z CLI](/info/cli-rendering.html) wylicza formaty i miejsca, w których są renderowane.

<!--i:eti-monitor-->
## Co działa gdzie

Tworzenie, edytowanie i eksportowanie odbywa się na Twoim urządzeniu, bez konta. Funkcja wymagająca serwera, na przykład Sync lub wysyłanie pliku do połączonej usługi, łączy się tylko wtedy, gdy jej używasz. W Lolly Work wspólne projekty, zespołowa edycja na żywo, zatwierdzenia i zadania serwerowe korzystają z serwera Twojej organizacji. [Co działa gdzie](/info/compare.html#what-runs-where) zestawia te dwie części.

<!--i:eti-graduation-cap-->
## Czytaj dalej

- [Utwórz swój pierwszy plik](/info/make-something.html), aby spróbować teraz.
- [Start](/info/quickstart.html), aby dodać własny system projektowy.
- [Automatyzuj](/info/builders.html), aby poznać wiersz poleceń, linki i agentów.
- [Architektura Lolly](/info/overview.html), dla współtwórców: silnik, powłoki i reguły, które je łączą.
