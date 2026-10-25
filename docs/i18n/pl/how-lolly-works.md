# Jak działa Lolly

Narzędzie Lolly przechowuje reguły dla jednego rodzaju pliku: układ, typografię, kolory i to, które części mogą zmieniać inni. Ty, współpracownik, skrypt lub agent AI wypełniacie pola i każdy plik wychodzi poprawnie. Ta strona pokazuje, kto co robi, oraz cztery drogi od narzędzia do gotowego pliku.

## Jedno narzędzie, Twoje reguły, wiele plików

Reguły marki żyją w narzędziu, a nie w każdym pliku, który tworzy. Dopracuj narzędzie raz, a każdy wynik odziedziczy tę samą typografię, kolor i odstępy, czy to jedna karta, czy arkusz z wierszami w kilkunastu językach.

![Narzędzie wordmark z wypełnionym jednym polem: typografia, kolor i odstępy zostały ustalone, gdy narzędzie powstawało](/info/shots/aud-rules-in-the-tool.svg)

Osoba robiąca setny plik wpisuje tylko słowa. To, jak sprawdzasz pracę i kto ją sprawdza, pozostaje Twoją decyzją. Lolly zmniejsza to, co warto sprawdzić, i przyspiesza tworzenie kolejnego pliku.

## Kto dotyka narzędzia

Prześledź jedną kartę kampanii w organizacji, a pojawią się trzy pary rąk. Każda buduje na poprzedniej.

![Projektant ustawia reguły raz w narzędziu; deweloper uruchamia je ze skryptu, a każdy może wypełnić jego pola; oba sposoby dają gotowe pliki](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **Projektant ustawia reguły.** Układa kartę w Design z typografią i kolorami marki, a potem wybiera, które pola zostają otwarte. Robi to raz, więc nikt już nie lokalizuje karty ręcznie.
- <!--i:code--> **Deweloper skaluje narzędzie.** To samo narzędzie działa w nocnym skrypcie przez wiersz poleceń, więc nowy wykres lub wersja w nowym języku pojawia się bez ponownego otwierania projektu.
- <!--i:people--> **Każdy je wypełnia.** Handlowiec w samolocie, bez sieci i bez przeszkolenia projektowego, otwiera narzędzie i robi kartę na jutrzejsze spotkanie.
:::

Świeży wykres w kroku dewelopera to renderowanie takie jak to, zrobione z ciągu danych i kilku ustawień, bez otwierania pliku projektu:

![Wykres warstwowy skumulowany z tytułem, jego trzy serie w chłodnej palecie, z osiami, legendą i tytułem ustawionymi przez szablon, a nie ręcznie](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Łatwa minuta handlowca jest możliwa tylko dzięki staranności projektanta i skryptowi dewelopera. Każda rola pracuje z tym samym narzędziem, a nie z osobnym produktem.

## Cztery drogi do pliku

Każda droga uruchamia ten sam silnik na tym samym narzędziu, więc plik zrobiony przez skrypt zgadza się z tym, który oglądasz w aplikacji.

![Parametry URL i argumenty wiersza poleceń stają się tym samym modelem danych wejściowych, przepuszczonym przez jedno wspólne środowisko wykonawcze i most eksportu](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **W aplikacji, po jednym.** Otwórz narzędzie, wypełnij pola i naciśnij **Export**. [Make your first file](/info/make-something.html) prowadzi Cię przez jedno.
- <!--i:layers--> **W aplikacji, wiele naraz.** [Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) przyjmuje wklejoną lub zaimportowaną tabelę i renderuje jeden gotowy plik na wiersz.
- <!--i:cpu--> **Ze skryptu lub agenta AI.** [CLI](/info/cli.html) uruchamia narzędzie bez interfejsu, a [serwer MCP](/info/mcp.html) pozwala agentowi odkrywać i uruchamiać narzędzia. Link do narzędzia niesie też jego dane wejściowe, więc link to kompletne żądanie.
- <!--i:server--> **Przez serwer Twojej organizacji.** [Lolly Work](/info/organisation.html) renderuje na serwerze według logowania i polityki narzędzi Twojej organizacji, prowadzi zadania, które może wznowić, i przechowuje wynik do pobrania lub zatwierdzonego dostarczenia.

To, której drogi może użyć zadanie, zależy od formatów narzędzia i możliwości hosta: niektóre formaty wymagają przeglądarki, więc wiersz poleceń przekazuje je warstwie przeglądarkowej. [Render with the CLI](/info/cli-rendering.html) wymienia, które formaty renderują się gdzie.

## Co działa gdzie

Tworzenie, edycja i eksport działają na Twoim urządzeniu, bez konta. Funkcja wymagająca serwera, taka jak Sync lub wysłanie pliku do połączonej usługi, łączy się dopiero wtedy, gdy z niej korzystasz. W Lolly Work wspólne projekty, edycja zespołowa na żywo, zatwierdzenia i zadania serwerowe korzystają z serwera Twojej organizacji. [What runs where](/info/compare.html#what-runs-where) zestawia te dwie części obok siebie.

## Czytaj dalej

- [Make your first file](/info/make-something.html), aby spróbować od razu.
- [Start](/info/quickstart.html), aby wprowadzić własny system projektowy.
- [Automate](/info/builders.html), o wierszu poleceń, linkach i agentach.
- [Lolly architecture](/info/overview.html), dla współtwórców: silnik, powłoki i reguły, które je spajają.
