# Ask Lolly

Ask Lolly odpoví na otázku odpovídající částí těchto průvodců, citovanou slovo od slova, s uvedením stránky a odkazem **Open in docs** na danou část. Nic se negeneruje: odpověď se vyhledá a cituje na tvém zařízení.

Pod citovanou částí jsou místa v aplikaci, která odpovídají otázce: nástroj, utilita, uložený projekt, asset z katalogu, nastavení nebo stránka aplikace. Každý řádek slouží jen k navigaci. Nic v odpovědi nemění nastavení, neotevírá soubor ani nejedná za tebe, stejně jako v [Lolly Search](/info/search.html).

<!--i:eti-chat-->
## Položení otázky

Piš do pole pro otázku dole v zobrazení a stiskni Enter. Cokoli kratšího než dva znaky se ignoruje. Odpovědi se řadí nad polem, nejnovější nakonec.

![Ask Lolly, otevřené a prázdné: pole pro otázku dole v zobrazení s poznámkou, že odpovědi pocházejí z dokumentace](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

::: note Každá otázka stojí samostatně
Předchozí otázky nepředávají žádný kontext, takže „a co PDF?“ po otázce o exportu se čte pouze jako otázka o PDF. Pokaždé polož celou otázku.
:::

První slovo tvé otázky rozhoduje, čím odpověď začíná:

| Začneš slovem | Co je první |
|---|---|
| *where*, *find*, *open*, *show*, *go to*, *goto*, *take*, *jump*, *navigate*, *switch* | odpovídající místa v aplikaci |
| *make*, *create*, *generate*, *build*, *design*, *convert*, *resize*, *compress*, *remove*, *strip*, *export*, *render*, *add* | odpovídající nástroje |
| cokoli jiného, včetně *how do I* a *what is* | část dokumentace, což je výchozí možnost |

Vždy se načtou obě poloviny, takže chybně vyhodnocená otázka jen změní pořadí odpovědi.

Vyhledávání shod vypouští běžná slova z otázek (*how*, *do*, *I*, *the*, *my*). Řadí části podle toho, kolik tvých ostatních slov pokrývají, a pak podle toho, kde se shodují: nadpis má větší váhu než běžný text. Shoda se hledá podle podřetězce bez ohledu na velikost písmen a diakritiku, takže překlep se neopravuje. Když se nic neshoduje, Ask to oznámí a odkáže na rozcestník dokumentace.

**Better matching** je volitelné. Po první odpovědi může Ask nabídnout malý model pro vyhledávání shod i s velikostí ke stažení. Model přiřadí otázku k průvodci, který pro stejnou věc používá jiná slova. Stáhne se jen s tvým souhlasem, běží na tomto zařízení a mění pouze to, které části se řadí první. Odpověď stále používá vlastní slova dokumentace. Můžeš ho také stáhnout jako **Ask matching model** v **Settings → Preferences → Available offline** ([Dostupné offline](/info/dashboard.html#available-offline)).

<!--i:eti-clipboard-->
## Co dostaneš zpět

Karta odpovědi má pevné pořadí:

1. **Samotná část**, vykreslená ze zdroje dokumentace: odstavce, seznamy, tabulky, kód a citace, s funkčními odkazy v aplikaci i na `/info`. Dlouhá část končí tlačítkem **Show more**, které zbytek otevře na místě. Obrázky se vynechávají a odkaz na jiný web se zobrazuje jako prostý text.
2. **Citace** - *Stránka › Nadpis* - a odkaz **Open in docs** na přesnou část.
3. **More in the docs** - až čtyři další odpovídající části jako odkazy.
4. **Řádky s místy v aplikaci**, pod stejnými nadpisy skupin jako ve vyhledávání.

Úplný text pochází z markdownové verze, kterou každá stránka dokumentace zveřejňuje na `/info/<slug>.md`. Tyto verze jsou pouze v angličtině. V jiném jazyce a na několika stránkách, které nevznikají z Markdownu, odpověď místo toho zobrazuje krátký výňatek z vyhledávacího indexu. Citace a odkaz **Open in docs** stále směřují na stránku v tvém jazyce.

<!--i:eti-map-pin-->
## Kde ho najdeš

Cesta je `#/ask`. Nemá kartu ani dlaždici v mřížce Utilities. Do zobrazení se dostaneš z vyhledávacího pole nebo přes jeho adresu.

- <!--i:search--> **Z vyhledávání.** Každý panel výsledků končí řádkem **Ask Lolly: *tvůj dotaz*** pod výsledky ostatních skupin. Řádek otevře `#/ask?q=…` a zobrazení po příchodu jednou položí otázku. Slova přijdou malými písmeny a bez interpunkce, takže je v poli pro otázku podle potřeby upřesni.
- <!--i:link--> **Z odkazu.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` otevře zobrazení s již položenou otázkou. Fragment adresy předvyplní pouze první otázku. Otázky, které napíšeš potom, se zodpovídají na místě a nikdy nemění adresu.

Vyhledávací pole se v tomto zobrazení skryje, protože Enter používá pole pro otázku. Pilulka zpět tě vrátí tam, odkud jsi přišel.

Odpovědi zůstávají po dobu této relace: jsou stále na místě, když odejdeš a vrátíš se, a opětovné načtení je smaže. Do úložiště se nic nezapisuje, takže není žádná historie ke správě.

<!--i:eti-download-->
## Offline

Odpovědi pocházejí ze dvou statických souborů, které zveřejňuje web dokumentace: vyhledávacího indexu pro daný jazyk a markdownové verze stránky. Oba se stahují podle názvu, takže Ask funguje bez připojení, jakmile jsou v mezipaměti. Čtení průvodců v aplikaci je uloží do mezipaměti. **Guides & docs** v části [Dostupné offline](/info/dashboard.html#available-offline) stáhne celý web včetně snímků obrazovky najednou.

Bez těchto souborů se část odpovědi z dokumentace nezobrazí a neukáže se žádná chyba. Řádky s místy v aplikaci se zobrazují dál, protože hledají shodu v datech, která už jsou na zařízení.

<!--i:eti-lock-->
## Soukromí

Tvá otázka nikdy neopustí zařízení. Vyhledávání shod běží místně nad soubory staženými podle názvu, takže zadaný text není součástí žádného požadavku. Žádný server tvou otázku nevidí, žádný účet ji nemá a po opětovném načtení nezůstane žádný záznam. [Zásady ochrany soukromí](/info/privacy.html) uvádějí vše, co aplikace stahuje nebo odesílá.

---

**Související:** [Lolly Search](/info/search.html) pro pole, které předává otázky. [Používání Lolly](/info/using.html) pro zbytek aplikace. [Nastavení Lolly](/info/dashboard.html#available-offline) pro předchozí stažení dokumentace offline.
