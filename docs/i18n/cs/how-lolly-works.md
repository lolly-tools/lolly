# Jak Lolly funguje

Nástroj Lolly obsahuje pravidla pro jeden druh souboru: rozvržení, písmo, barvy a části, které ostatní smějí měnit. Ty, kolega, skript nebo AI agent vyplníte pole a každý soubor tato pravidla dodrží.

<!--i:eti-repeat-->
## Jeden nástroj, tvá pravidla, mnoho souborů

Pravidla značky jsou součástí nástroje. Nastav ho jednou a každý výstup získá stejné písmo, barvy a rozestupy, od jedné kartičky po celou tabulku řádků ve dvanácti jazycích.

![Nástroj pro wordmark s jedním vyplněným polem: písmo, barva a rozestupy byly určeny při tvorbě nástroje](/info/shots/aud-rules-in-the-tool.svg)

Člověk, který vytváří stý soubor, jen napíše text. O tom, jak se práce kontroluje a kdo ji kontroluje, rozhoduješ ty. Díky Lolly je toho ke kontrole méně a další soubor vznikne rychleji.

<!--i:eti-users-->
## Kdo s nástrojem pracuje

Na jedné kartičce pro kampaň pracují tři role v organizaci.

![Designér jednou nastaví pravidla v nástroji; vývojář ho spouští ze skriptu a kdokoli může vyplnit jeho pole; oběma způsoby vznikají hotové soubory](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **Designér nastaví pravidla.** V Lolly Design navrhne kartičku s písmem a barvami značky a vybere pole, která zůstanou přístupná. Udělá to jednou, takže už nikdo nemusí kartičku ručně lokalizovat.
- <!--i:code--> **Vývojář nástroj využije ve velkém.** Tentýž nástroj běží každou noc ve skriptu přes příkazový řádek. Nový graf nebo jazyková verze vznikne, aniž by někdo znovu otevřel návrh.
- <!--i:people--> **Kdokoli ho vyplní.** Obchodní zástupce v letadle, bez připojení a bez školení v designu, otevře nástroj a vytvoří kartičku na zítřejší schůzku.
:::

Nový graf od vývojáře je vykreslení jako toto, vytvořené z datového řetězce a několika nastavení:

![Pojmenovaný skládaný plošný graf se třemi řadami v pruzích studené palety, s osami, legendou a nadpisem umístěnými šablonou místo ručního umísťování](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Obchodník má za minutu hotovo díky pravidlům designéra a skriptu vývojáře. Všechny role pracují se stejným nástrojem.

<!--i:eti-train-->
## Čtyři cesty k souboru

Každá cesta používá stejný engine se stejným nástrojem, takže soubor vytvořený skriptem odpovídá tomu, který vidíš v náhledu aplikace.

![Parametry URL a argumenty příkazového řádku se převádějí na stejný vstupní model a procházejí jedním sdíleným běhovým prostředím a exportním rozhraním](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **V aplikaci, po jednom.** Otevři nástroj, vyplň pole a stiskni **Export**. [Vytvoř svůj první soubor](/info/make-something.html) tě jedním provede.
- <!--i:layers--> **V aplikaci, mnoho najednou.** [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) přijme vloženou nebo importovanou tabulku a pro každý řádek vykreslí jeden hotový soubor.
- <!--i:cpu--> **Ze skriptu nebo přes AI agenta.** [CLI](/info/cli.html) spouští nástroj bez grafického rozhraní a [MCP server](/info/mcp.html) umožňuje agentovi vyhledávat a spouštět nástroje. Odkaz na nástroj nese i jeho vstupy, takže je úplným požadavkem.
- <!--i:server--> **Přes server tvé organizace.** [Lolly Work](/info/organisation.html) vykresluje na serveru podle pravidel organizace pro přihlašování a nástroje, uchovává úlohy, v nichž může pokračovat, a drží výstup ke stažení nebo ke schválenému doručení.

Kterou cestu může úloha použít, závisí na formátech nástroje a možnostech hostitelského prostředí. Některé formáty potřebují prohlížeč, takže je příkazový řádek předá prohlížečové vrstvě. [Vykreslování pomocí CLI](/info/cli-rendering.html) uvádí, kde se jednotlivé formáty vykreslují.

<!--i:eti-monitor-->
## Co běží kde

Tvorba, úpravy a export běží na tvém zařízení, bez účtu. Funkce, která potřebuje server, třeba Sync nebo odeslání souboru do připojené služby, se připojí jen tehdy, když ji použiješ. S Lolly Work používají sdílené projekty, živé týmové úpravy, schvalování a serverové úlohy server tvé organizace. [Co běží kde](/info/compare.html#what-runs-where) staví obě části vedle sebe.

<!--i:eti-graduation-cap-->
## Čti dál

- [Vytvoř svůj první soubor](/info/make-something.html), pokud si to chceš hned vyzkoušet.
- [Začínáme](/info/quickstart.html), pokud chceš přidat vlastní designový systém.
- [Automatizace](/info/builders.html), pro příkazový řádek, odkazy a agenty.
- [Architektura Lolly](/info/overview.html), pro přispěvatele: engine, aplikační rozhraní a pravidla, která je spojují.
