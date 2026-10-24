# Jak Lolly funguje

Nástroj Lolly drží pravidla pro jeden druh souboru: rozvržení, písmo, barvy a které části mohou ostatní měnit. Ty, kolega, skript nebo AI agent vyplníte pole a každý soubor vyjde správně. Tato stránka ukazuje, kdo co dělá, a čtyři cesty od nástroje k hotovému souboru.

## Jeden nástroj, tvá pravidla, mnoho souborů

Pravidla značky žijí v nástroji, ne v každém souboru, který vytvoří. Nastav nástroj správně jednou a každý výstup zdědí stejné písmo, barvu a rozestupy, ať je to jedna karta, nebo tabulka řádků ve dvanácti jazycích.

![Nástroj wordmark s vyplněným jedním polem: písmo, barva a rozestupy byly určeny při tvorbě nástroje](/info/shots/aud-rules-in-the-tool.svg)

Ten, kdo vytváří stý soubor, jen píše slova. Jak práci kontroluješ a kdo ji kontroluje, zůstává tvým rozhodnutím. Lolly zmenšuje to, co stojí za kontrolu, a zrychluje výrobu dalšího souboru.

## Kdo se nástroje dotýká

Sleduj jednu kampaňovou kartu organizací a objeví se tři dvojice rukou. Každá navazuje na tu předchozí.

![Designér nastaví pravidla jednou v nástroji; vývojář ho spouští ze skriptu a kdokoli vyplňuje jeho pole; oba vytvářejí hotové soubory](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **Designér nastaví pravidla.** Rozvrhne kartu v Design s písmem a barvami značky a pak vybere, která pole zůstanou otevřená. Udělá to jednou, takže už nikdo kartu nelokalizuje ručně.
- <!--i:code--> **Vývojář nástroj rozšíří.** Stejný nástroj běží v nočním skriptu přes příkazový řádek, takže nový graf nebo nová jazyková verze dorazí, aniž by někdo znovu otevíral návrh.
- <!--i:people--> **Kdokoli ho vyplní.** Obchodník v letadle, bez sítě a bez designového vzdělání, otevře nástroj a vytvoří kartu na zítřejší schůzku.
:::

Nový graf v kroku vývojáře je vykreslení jako toto, vytvořené z datového řetězce a několika nastavení, aniž by kdo otevřel soubor návrhu:

![Nadepsaný skládaný plošný graf, jeho tři řady odstupňované v chladné paletě, s osami, legendou a nadpisem umístěnými šablonou, ne ručně](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Obchodníkova snadná minuta je možná jen díky péči designéra a skriptu vývojáře. Každá role pracuje se stejným nástrojem, ne s odděleným produktem.

## Čtyři cesty k souboru

Každá cesta spouští stejný engine se stejným nástrojem, takže soubor, který vytvoří skript, odpovídá tomu, který si prohlížíš v aplikaci.

![Parametry URL a argumenty příkazového řádku se stanou stejným modelem vstupů, procházejícím jedním sdíleným runtime a exportním mostem](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **V aplikaci, po jednom.** Otevři nástroj, vyplň pole a stiskni **Export**. [Vytvoř svůj první soubor](/info/make-something.html) tě jím provede.
- <!--i:layers--> **V aplikaci, mnoho najednou.** [Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) vezme vloženou nebo importovanou tabulku a vykreslí jeden hotový soubor na řádek.
- <!--i:cpu--> **Ze skriptu nebo od AI agenta.** [CLI](/info/cli.html) spouští nástroj bez rozhraní a [server MCP](/info/mcp.html) umožňuje agentovi nástroje objevovat a spouštět. Odkaz na nástroj nese i jeho vstupy, takže odkaz je úplný požadavek.
- <!--i:server--> **Přes server tvé organizace.** [Lolly Work](/info/organisation.html) vykresluje na serveru pod přihlášením a politikou nástrojů tvé organizace, drží úlohy, které lze obnovit, a uchovává výstup ke stažení nebo schválenému doručení.

Která cesta se pro úlohu dá použít, závisí na formátech nástroje a na tom, co hostitel umí: některé formáty potřebují prohlížeč, takže je příkazový řádek předá úrovni s prohlížečem. [Vykreslování pomocí CLI](/info/cli-rendering.html) vypisuje, které formáty se vykreslují kde.

## Co běží kde

Tvorba, úpravy a export běží na tvém zařízení, bez účtu. Funkce, která potřebuje server, například Sync nebo odeslání souboru do připojené služby, se připojí, jen když ji použiješ. S Lolly Work používají sdílené projekty, živé týmové úpravy, schvalování a serverové úlohy server tvé organizace. [Co běží kde](/info/compare.html#what-runs-where) staví obě části vedle sebe.

## Čti dál

- [Vytvoř svůj první soubor](/info/make-something.html), abys to hned zkusil.
- [Začni](/info/quickstart.html), abys vložil vlastní designový systém.
- [Automatizuj](/info/builders.html) pro příkazový řádek, odkazy a agenty.
- [Architektura Lolly](/info/overview.html) pro přispěvatele: engine, shelly a pravidla, která je drží pohromadě.
