# Ask Lolly

Napiš otázku a Ask Lolly odpoví částí těchto průvodců, která ji pokrývá, doslova, s citovanou stránkou, odkud pochází, a odkazem **Open in docs** rovnou na tu část. Nic se negeneruje: odpověď se vyhledá, ocituje a přiřadí, na tvém zařízení.

Pod citovanou částí jsou místa v aplikaci, která odpovídají téže otázce: nástroj, utilita, uložený projekt, asset z katalogu, nastavení nebo stránka aplikace. Každý řádek jen naviguje. Nic v odpovědi nemění nastavení, neotevírá soubor ani za tebe nejedná, stejné pravidlo dodržuje [Hledání](/info/search.html).

## Kladení otázky

Piš do pole otázky dole v zobrazení a stiskni Enter. Cokoli kratšího než dva znaky se ignoruje. Odpovědi se skládají nad polem, nejnovější poslední, a můžeš se ptát dál.

![Ask Lolly, otevřené a prázdné: pole otázky dole v zobrazení s poznámkou, že odpovědi pocházejí z dokumentace](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

Každá otázka se zodpovídá samostatně: dřívější otázky nepřenášejí žádný kontext, takže "co PDF?" po otázce o exportu se čte jako otázka o PDF a nic víc. Zeptej se pokaždé celou otázkou.

První slovo tvé otázky rozhoduje, co odpověď vede:

| Začínáš slovem | Co vede |
|---|---|
| *kde*, *najdi*, *otevři*, *ukaž*, *jdi na*, *goto*, *vezmi*, *skoč*, *naviguj*, *přepni* | místa v aplikaci, která odpovídají |
| *vytvoř*, *udělej*, *vygeneruj*, *sestav*, *navrhni*, *převeď*, *změň velikost*, *zkomprimuj*, *odstraň*, *vyčisti*, *exportuj*, *vykresli*, *přidej* | nástroje, které odpovídají |
| cokoli jiného - včetně *jak* a *co je* | sekce dokumentace, což je výchozí |

Obě poloviny se načtou vždy, takže špatně přečtená otázka odpověď přeuspořádá, ale nepřijdeš o polovinu odpovědi.

Párování vynechá běžná tázací slova (*jak*, *co*, *já*, *ten*, *můj*) a řadí sekci podle toho, kolik zbývajících slov pokrývá, pak podle toho, kde se shodovala: nadpis váží víc než běžný text. Párování probíhá po podřetězcích, bez ohledu na velikost písmen a diakritiku, takže překlep se neopravuje. Když nic neodpovídá, Ask to řekne a odkáže na index dokumentace, místo aby odpověď vymýšlel.

**Better matching** je volitelné. Po tvé první odpovědi může Ask nabídnout malý párovací model s velikostí stažení, který pomáhá spárovat otázku s průvodcem, jenž používá jiná slova pro totéž. Stáhne se, jen když souhlasíš, běží na tomto zařízení a mění jen to, které sekce se řadí první: odpověď jsou stále slova dokumentace. Můžeš jej stáhnout také v **Settings → Preferences → Available offline**, kde je uveden jako **Ask matching model** ([Available offline](/info/dashboard.html#available-offline)).

## Co se vrátí

Karta odpovědi se skládá v pevném pořadí:

1. **Samotná sekce**, vykreslená ze zdroje dokumentace - odstavce, seznamy, tabulky, kód a citace, s živými odkazy v aplikaci a na `/info`. Dlouhá sekce je omezena tlačítkem **Show more**, které ji otevře na místě. Obrázky se vynechávají a odkaz na jiný web se vykreslí jako prostý text, ne jako kotva.
2. **Citace** - *Stránka › Nadpis* - a odkaz **Open in docs** na přesně tu sekci.
3. **More in the docs** - až čtyři další sekce, které odpovídaly, jako odkazy.
4. **Řádky v aplikaci** pod stejnými nadpisy skupin, jaké používá Hledání.

Plný text pochází z prostého markdownového dvojčete, které každá stránka dokumentace publikuje na `/info/<slug>.md`, a ta dvojčata jsou jen anglicky. V jiném jazyce - a na hrstce stránek, které nejsou vytvořeny z markdownu - odpověď místo celé sekce sáhne po krátkém výtahu z vyhledávacího indexu. Citace a odkaz **Open in docs** jsou tam v obou případech a míří na stránku ve tvém jazyce.

## Kde žije

Cesta je `#/ask`. Nemá kartu ani dlaždici v mřížce Utilities; vstupem jsou vyhledávací lišta a samotná adresa.

- <!--i:search--> **Z hledání.** Každý panel výsledků nese úplně dole řádek **Ask Lolly: *tvůj dotaz***, pod všemi konkrétními nálezy ostatních skupin. Předá otázku jako `#/ask?q=…` a zobrazení se po příchodu jednou zeptá. Předaná slova přijdou malými písmeny a bez interpunkce, takže je v případě potřeby upřesni v poli otázky.
- <!--i:link--> **Z odkazu.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` otevře zobrazení s již položenou otázkou. Hash je jen počáteční zárodek: otázky, které poté napíšeš, se zodpovídají na místě a adresu nikdy nepřepisují.

Vyhledávací lišta v tomto zobrazení ustoupí, protože pole otázky bere Enter, a pilulka zpět tě vrátí, odkud jsi přišel.

Odpovědi na obrazovce vydrží po tuto relaci: pokud odejdeš a vrátíš se, jsou tam, a znovunačtení je smaže. Nic se nezapisuje do úložiště, takže není žádná historie ke správě.

## Offline

Odpovědi se skládají ze dvou statických souborů, které web dokumentace už publikuje: vyhledávacího indexu pro jazyk a markdownového dvojčete stránky. Oba se stahují podle názvu, takže Ask funguje dál bez připojení, jakmile jsou v cache. Čtení průvodců v aplikaci je průběžně ukládá a **Guides & docs** v [Available offline](/info/dashboard.html#available-offline) bere celý web včetně snímků obrazovky jedním stažením.

Bez nich se dokumentační polovina odpovědi prostě neobjeví, bez chyby. Řádky v aplikaci ano, protože se párují s daty, která už na zařízení jsou.

## Soukromí

Tvá otázka nikdy neopustí zařízení. Párování běží lokálně nad soubory stahovanými podle názvu, takže to, cos napsal, není součástí žádného požadavku; není žádný server, který by ji viděl, žádný účet, ke kterému by byla připojena, a po znovunačtení po ní nezbývá žádný záznam. Úplný seznam toho, co aplikace kdy stahuje nebo odesílá, najdeš v [Zásadách ochrany soukromí](/info/privacy.html).

---

**Související:** [Hledání](/info/search.html) pro lištu, která předává otázky. [Používání Lolly](/info/using.html) pro zbytek aplikace. [Settings](/info/dashboard.html#available-offline) pro stažení dokumentace offline jako první.
