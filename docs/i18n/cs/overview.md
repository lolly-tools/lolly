# Architektura Lolly

![Ikona Lolly - velké zelenobílé lízátko](/info/icon.svg)

Tato stránka je pro lidi, kteří mění kód Lolly: jak do sebe zapadají engine, aplikační rozhraní a balíčky nástrojů, kde se nacházejí v repozitáři a jaké závazky omezují každou změnu. Pokud chceš zjistit, co Lolly dělá a kdo ji používá, přečti si nejprve [Jak Lolly funguje](/info/how-lolly-works.html).

[`engine/README.md`](https://github.com/lolly-tools/lolly/blob/main/engine/README.md) mapuje engine modul po modulu a generuje se z kódu. [Model hrozeb & hranice důvěry](/info/threat-model.html) popisuje stejnou architekturu z pohledu hranic důvěry a uvádí, co engine považuje za nedůvěryhodné.

<!--i:eti-layers-->
## Celkový přehled

Nahoře jsou nástroje v podobě dat. Engine uprostřed neví nic o žádné platformě. Aplikační rozhraní dole implementují jeden kontrakt a katalogy dodávají obsah.

![Nástroje dodávají sdílenému enginu manifest, šablonu a hooky. Webové, Tauri a terminálové rozhraní implementují most funkcí HostV1 a načítají nástroje a assety z katalogů.](/info/diagrams/concepts/platform-layers.svg)

Vše, co lze popsat čistými daty a Handlebars, patří do **enginu**. Vše, co pracuje s DOM, souborovým systémem, sítí nebo jakýmkoli API prohlížeče či operačního systému, patří do **hostitele**, na stranu mostu, kterou zajišťuje aplikační rozhraní. Engine má otevřený zdrojový kód. Nic, co ví o konkrétní značce, do enginu nepatří.

<!--i:eti-folder-shared-->
## Struktura repozitáře

Lolly tvoří jeden repozitář. Každý níže uvedený adresář je běžný adresář kromě `brands/suse`: **soukromého** submodulu git s balíčkem nástrojů a katalogem SUSE, který veřejný klon nestahuje. Obsahový profil (`profiles.json`) určuje, které balíčky sestavení načítá. Každý proces si určuje vlastní profil a žádný globální přepínač neexistuje. [Průvodce sestavením](/info/build-guide.html) uvádí příkaz pro klonování a postup, jak commitnout změnu uvnitř soukromého balíčku.

| Adresář | Co obsahuje |
|---|---|
| `engine/` | Jádro nezávislé na platformě: načítání, běhové prostředí, vstupy, šablony, režim URL, jednotky a moduly formátů |
| `shells/` | Webová aplikace, desktopové a mobilní aplikace Tauri, CLI, TUI a rozšíření prohlížeče |
| `packages/` | Mimo jiné SDK pro autory nástrojů (`@lolly-tools/core`), sdílené části rozhraní pro Node a vykreslovač dokumentace |
| `community/` | Nástroje nezávislé na značce a sdílené balíčky emoji |
| `brands/` | Balíčky značek: `lolly-demo` (Lolly Demo, designový systém, na kterém běží lolly.tools), `lolly-start` (prázdný výchozí balíček) a soukromý `suse` |
| `services/` | Volitelné služby MCP, certifikátů a Penpot a serverový kód, který sdílejí |
| `schemas/` | JSON Schema pro manifesty nástrojů, položky assetů a odkazy na assety |
| `scripts/`, `tests/`, `docs/`, `api/` | Skripty pro sestavení a katalogy, sada testů enginu, tato dokumentace a generované serverless balíčky |

::: details Soubory enginu a aplikačních rozhraní, se kterými se setkáš nejdřív
```
engine/src/
  index.ts          public surface: loader, runtime, template, inputs, url-mode
  loader.ts         fetches and validates tool files
  runtime.ts        orchestrates one mounted tool, from load to export
  template.ts       Handlebars hydration and annotateTemplate
  inputs.ts         manifest to runtime input model
  url-mode.ts       URL to input state and back
  validate.ts       JSON Schema validation of manifests
  compose.ts        nested tool renders (composes)
  embed.ts          portable lolly.tools embed URLs
  bridge/host-v1.ts type re-export of the @lolly-tools/core contract

shells/web/src/
  main.ts           boot and routing
  bridge/           the web implementations of the host APIs
  catalog/sync.ts   boot-time catalog sync and offline cache
  views/            the gallery, tool, projects, free canvas and the other views
  pro/              Batch (#/batch)

shells/cli/         bin/lolly.ts (entry), src/run.ts (headless render), src/bridge.ts
shells/tui/         src/main.tsx (the full-screen app), src/bridge.ts
```
:::

::: note V kořeni repozitáře není adresář `tools/` ani `catalog/`
`packages/node-shell/src/content-roots.ts` odpovídá na otázky „kde je nástroj `<id>`“ a „kde je katalog“ podle `profiles.json`. Skutečná dvojice `tools/` a `catalog/` se zapisuje jen do výstupu sestavení, například `dist/`, obsahu balíčku RPM nebo obrazu kontejneru, protože prohlížeč tyto dvě cesty načítá přes HTTP.
:::

<!--i:eti-monitor-->
## Kde Lolly běží

Každé rozhraní používá stejný engine a stejné soubory nástrojů.

- **Webová aplikace.** Progresivní webová aplikace. Funguje offline, jakmile její service worker uloží nástroje a assety do mezipaměti. Nepotřebuje účet a stav se ukládá do IndexedDB na každém zařízení. Jedno responzivní rozvržení slouží počítači i telefonu. Na telefonu se ovládací prvky přesunou do panelu a ovládání exportu se otevírá z plovoucí pilulky.
- **Desktopové a mobilní aplikace.** Balíčky Tauri stejné webové aplikace s nativními souborovými dialogy, stavem uloženým v souborovém systému a plným použitím offline.
- **CLI.** `lolly <tool-id> --input=value --output=file.png` načte stejný engine v DOM bez grafického rozhraní a zapíše soubor. Je to režim URL přes jiný přenosový mechanismus. Viz [CLI](/info/cli.html).
- **TUI.** Celoobrazovková terminálová aplikace určená především pro klávesnici. Používá most z CLI a uchovává uložené relace na disku: ve složce desktopové aplikace, pokud je nainstalovaná, jinak v `~/.lolly`. Prohlížeč bez grafického rozhraní s omezeným rozsahem spouští jen tehdy, když ho formát potřebuje. Viz [TUI](/info/tui.html).

![Rozdělené zobrazení na počítači: vlevo ovládací prvky generované z manifestu, vpravo živé plátno](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

Při šířce telefonu je panel ovládacích prvků nahoře a náhled vyplňuje obrazovku.

![Audiogram na obrazovce široké 430 px: nahoře panel ovládacích prvků, dole hotová čtvercová grafika a plovoucí pilulka exportu](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dzzfxm%3A7%3Alofi%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

Webová aplikace obsahuje také **Batch** (`#/batch`, `shells/web/src/pro/`), mřížku ve stylu tabulkového procesoru, která vykresluje mnoho řádků najednou v jednom nebo více nástrojích. Viz [Batch a Lolly Multi-edit](/info/batch.html#make-many-versions-of-one-design). **Settings → Capabilities** vypisuje vše, co platforma deklaruje, že umí.

![Batch v nové instalaci: jeden prázdný řádek čekající na nástroj, s tabulkovou plochou a tlačítkem Render připravenými ještě před příchodem dat](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

<!--i:eti-lock-->
## Architektonické závazky

Tato rozhodnutí jsou pevně daná. Každé další rozhodnutí v kódu na nich závisí, takže změna kteréhokoli z nich je velký zásah.

### 1. Deklarativní nástroje s možností použít imperativní kód

Nástroj tvoří manifest (`tool.json`), šablona (`template.html`) a volitelný `hooks.js`. **Manifest deklaruje vstupy**. Vstupy se nikdy neodvozují z tokenů Handlebars v šabloně. Většinu nástrojů tvoří jen manifest a šablona, takže je mohou vytvářet i lidé bez vývojářských znalostí.

![Sada ovládacích prvků Street Map: rozbalovací nabídka měst, výběr motivu, posuvníky tloušťky a spouštěče barev, každý vytvořený z řádku manifestu](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

Nástroje, které počítají hodnoty, například kódování QR nebo tvarování grafu, přidávají hooky: pojmenované funkce životního cyklu, které běhové prostředí volá s předaným mostem funkcí. Hooky jsou kontraktem přenositelnosti, ne bezpečnostním sandboxem. Běží v časovém limitu. Nástroje, u jejichž hooků je prokázané, že nepoužívají globální objekty stránky, nesou `isolate: true` a běží ve Workeru. [Hooky nástrojů](/info/tool-hooks.html) popisují životní cyklus a limity. [Model hrozeb](/info/threat-model.html) uvádí, co vykonavatel kódu na stránce izoluje a co ne.

### 2. Nástroje a assety jsou data, ne přibalený kód

Webová aplikace i aplikace Tauri při spuštění načtou katalogy nástrojů a assetů, uloží je do mezipaměti a pracují s jejím obsahem. Nový nástroj nebo asset nevyžaduje nové vydání aplikace. Bajty assetů se ověřují kontrolním součtem SHA-256. `id` a `version` assetu řídí zneplatnění mezipaměti.

### 3. Most funkcí je jediné API dostupné nástrojům

Nástroje nikdy nezasahují do DOM mimo svou šablonu, nikdy přímo nevolají `fetch` a nikdy nečtou souborový systém. Volají verzované metody `host.*`. Kontrakt je definovaný v `packages/core/src/host-v1.ts`, v SDK pro autory nástrojů `@lolly-tools/core`. Třetí strana může vyvíjet nad SDK bez závislosti na enginu. `engine/src/bridge/host-v1.ts` znovu exportuje jeho typy.

| Povinné API | Co dělá |
|---|---|
| `host.profile` | Údaje uživatele; předvyplňuje vstupy přes `bindToProfile` |
| `host.assets` | Dotazy do katalogu, dohledání assetů a výběr assetů hostitele |
| `host.state` | Ukládání a načítání vstupních slotů: IndexedDB na webu, souborový systém v Tauri, paměť v CLI |
| `host.clipboard` | Zápis textu nebo obrázku do schránky se záložními postupy podle platformy |
| `host.export` | Rasterizace nebo serializace cíle vykreslení a cesta transformace souborů na zařízení |
| `host.log` | Logování s úrovněmi do hostitele |

Každé další API je volitelné a rozšiřující: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` a mnoho dalších. `requires` v manifestu uvádí volitelná API, která jeho hooky volají bez předchozího ověření. Hostitel, kterému některé chybí, odmítne nástroj připojit. U ostatních hooky zjišťují dostupnost. Některá, například `recorder`, navíc potřebují funkci zařízení, kterou nástroj deklaruje. `packages/core/src/host-v1/apis.ts` je uvádí všechna a [API hostitele](/info/host-api.html) každé dokumentuje. Přidání metody znamená vedlejší verzi. Odebrání nebo změna metody znamená hlavní verzi a v1 funguje dál i po vydání v2.

### 4. ID assetů jsou navždy

`lolly/logo/primary` je kontrakt. Po zveřejnění se ID nikdy nemění a nikdy se znovu nepoužije. Změna bajtů zvýší `version` v položce assetu. Při nahrazení se nastaví `deprecated: true` a volitelně `replacedBy`. Existující odkazy se vždy vyhodnotí, takže uložené relace a sdílené odkazy fungují po léta.

### 5. Režim URL má plnou podporu

Každý vstup lze vyjádřit parametrem URL, takže odkaz je hotový soubor:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Samotný tento odkaz, bez čehokoli dalšího, je hotový soubor](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Změň parametr a dostaneš jiný soubor. Tuto paletu tvoří jedna výchozí barva, harmonie a počet kroků:

![Devět kroků ve čtyřech odstínech, všechny odvozené z jediné výchozí barvy nesené v odkazu](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

CLI ze svých argumentů sestaví stejný stav URL a spustí stejný postup zpracování, takže se nemůže odchýlit od aplikace. `engine/src/url-mode.ts` parsuje a serializuje stav URL. Vyhrazené názvy (`format`, `width`, `dpi`, `c2pa`, `z` a další) se nástroji nikdy nepředávají. [Vyhrazené parametry URL](/info/url-parameters.html) je uvádějí všechny. Vstupy assetů se přenášejí pomocí `id` a před vyplněním šablony se dohledají přes `host.assets.get()`.

### 6. Ukládání probíhá přes most

Webová aplikace používá IndexedDB, Tauri souborový systém a CLI paměť. Nástroje vidí jen `host.state.save(slot, data)` a `host.state.load(slot)`, nikdy `localStorage`. Lidé mohou uchovávat několik pojmenovaných relací pro každý nástroj bez účtu. Protože most je jediným spojovacím bodem, je tento stav také přenosný. `shells/web/src/data-transfer.ts` exportuje stav jako jeden soubor `lolly-backup`, který lze importovat do jakékoli jiné instalace ([Přenos dat](/info/data-transfer.html)). [Sync](/info/sync.html) posílá stejný balíček do úložiště, které si člověk vybere.

### 7. Štítky vyspělosti říkají, v jakém stavu nástroj je

Každý nástroj deklaruje `status: official | community | experimental`. Galerie řadí podle stavu. Experimentální nástroje ve výchozím nastavení přidávají do exportů vodoznak: běhové prostředí ho zapne, pokud volající nepředá `watermark: false`. Nástroje pracující na zařízení mají výjimku. Nad těmito štítky stojí vlastní katalogový proces týmu.

### 8. Vstupy mají typy uvedené v manifestu

Vstup deklaruje `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` nebo `file`. Hostitel vykresluje ovládací prvek pro každý typ, takže nástroje nepotřebují vlastní kód ovládacích prvků. Jakýkoli vstup může nést `bindToProfile`. Nejdůležitější jsou tři typy:

- **`asset`** s `filter` a `allowUpload` je mostem k systému assetů. `allowUpload: false` omezuje slot na assety z knihovny. Nahrané soubory uživatele mají stejnou strukturu `AssetRef` jako knihovna.
- **`blocks`** je opakující se skupina polí upravovaná v postranním panelu, kterou používají Meeting Planner, Wayfinding, Diagrams a další. Kliknutí na vykreslený blok zaměří jeho řádek.
- **`file`** drží vlastní soubor uživatele v paměti pro utility pracující na zařízení, jako jsou Lolly Strip Hidden Data a Compress, a **`vector`** seskupuje pevnou sadu čísel do jednoho ovládacího prvku.

### 9. Šablony neobsahují logiku

Šablony používají Handlebars, takže je mohou psát i lidé bez vývojářských znalostí. `{{x}}` escapuje a `{{{x}}}` je výslovné povolení neescapovaného obsahu. Logika je v `hooks.js`, kde ji lze zkontrolovat. Mnoho šablon používá `{{{` pro značkovací kód vypočítaný hookem, takže každý hook musí escapovat to, co předává dál. Pomocné funkce jsou `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` a `media` a navíc `icsStamp`, `rfcText`, `csvCell` a `arrow` pro související šablony `.ics`, `.vcf` a `.csv`. Popisují je [Šablony a vykreslování](/info/tool-rendering.html).

### 10. Nástroje skládají další nástroje

Nástroj může vložit vykreslení jiného nástroje bez vzájemných importů. Kompozici vyřeší engine. Manifest může deklarovat `composes: [{ id, tool, inputs }]` a umístit potomka pomocí `{{asset <id>}}`. Přenosná URL pro vložení (`https://lolly.tools/tool/<id>.svg?…`) vykreslí potomka lokálně; Lolly Design takto umisťuje živý QR kód nebo graf. Potomek SVG zůstává vektorem v rodiči SVG nebo PDF. Potomci jsou mezivýsledky a nikdy nedostávají vodoznak ani razítko. Aplikační rozhraní, které potomka neumí vykreslit, nechá slot prázdný a rodič se přesto vykreslí. Podrobnosti uvádí [Kompozice a překryvné vrstvy značky](/info/tool-composition.html).

<!--i:eti-scissors-->
## Co jsme se rozhodli nedělat

- **Žádný libovolný JavaScript v šablonách.** Logika je v `hooks.js`.
- **Žádný povinný server assetů.** Lidé přidávají vlastní soubory do Assets v aplikaci a předávají práci jako relaci: odkaz ke sdílení pro vstupy a nastavení, soubor `.lolly`, pokud se přenášejí i nahrané soubory. Sdílená relace se může stát šablonou ve výběru nástroje. Organizace, která chce řízený katalog, může používat katalog, schvalování a politiky Lolly Work nebo spravovat balíček značky v git a kontrolovat změny tam.
- **Žádné vynucené řízení přístupu.** Otevřená aplikace je ve výchozím stavu veřejná. Riziko pro značku ošetřují štítky vyspělosti a vodoznaky. Přihlášení organizace, role a politiky zajišťuje Lolly Work, pokud je tým chce.
- **Žádná centrální databáze.** Stav uživatele je na každém zařízení a volitelný Sync ho kopíruje do úložiště, které si člověk vybere, nikdy do databáze Lolly.
- **Žádná sdílená cesta kódu mezi nástroji a enginem.** Engine a komunitní nástroje mají otevřený zdrojový kód. Balíček značky, například soukromý `brands/suse/`, obsahuje vlastní nástroje a katalog za vlastních podmínek. Žádný nástroj neimportuje z `engine/`, takže oddělení zůstává čisté.

<!--i:eti-refresh-->
## Životní cyklus jednoho vykreslení

Někdo otevře `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`:

1. **Spuštění.** Webová aplikace otevře IndexedDB, sestaví most funkcí a synchronizuje katalogy nástrojů a assetů, nebo je offline načte z mezipaměti.
2. **Směrování.** Cesta vybere zobrazení nástroje `qr-code` s parametry dotazu jako počátečními hodnotami.
3. **Načtení.** `loadTool` načte `tool.json`, ověří ho podle schématu a načte šablonu, styly a hooky.
4. **Parsování odkazu.** `parseUrlState` převede parametry na vstupní hodnoty. Odkaz na asset, například `?logo=lolly/logo/primary`, se změní na dosud nevyhodnocený `{ id }`.
5. **Spuštění běhového prostředí.** `createRuntime(tool, host, initialValues)` sestaví vstupní model z údajů profilu, výchozích hodnot a odkazu, vyhodnotí odkazy na assety, načte hooky a zavolá `onInit`.
6. **Vykreslení.** Aplikační rozhraní začne odebírat změny běhového prostředí, nakreslí ovládací prvky podle modelu a zapíše vyplněnou šablonu do `#tool-canvas`.
7. **Interakce.** Psaní volá `runtime.setInput`, které uplatní omezení, zavolá `onInput`, znovu vyplní šablonu a překreslí ji.
8. **Export.** **Download** zavolá `runtime.export(node, format)` a `host.export` aplikačního rozhraní vytvoří soubor: rastr, vektor z průchodu DOM, PDF, dokument nebo některý z dalších formátů v `schemas/tool.schema.json`. Fyzické jednotky se převádějí podle formátu. Metadata a Content Credentials se vkládají tam, kde je formát může obsahovat. Experimentální nástroje dostávají vodoznak od hostitele, ne od nástroje. Krok exportu popisují [Šablony a vykreslování](/info/tool-rendering.html) a [Export souboru](/info/exporting.html).

![Panel exportu otevřený parametrem ?options: dvojice názvu souboru a formátu, velikost výstupu a ovládací prvky pro zápis souboru](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Stejný životní cyklus probíhá v Tauri i v CLI s DOM bez grafického rozhraní, kde výstup míří do souboru nebo na stdout.

<!--i:eti-stamp-->
## Licence

Kód včetně `engine/`, `shells/`, `services/`, `schemas/` a generátoru dokumentace je pod licencí MPL-2.0 v jednom veřejném repozitáři [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). Text dokumentace je pod licencí CC BY-SA 4.0. Balíčky značek mají vlastní podmínky v souboru `NOTICE.md` každého balíčku: komunitní nástroje jsou pod MPL-2.0 a soukromý balíček SUSE je proprietární a patří SUSE. [O projektu](/info/about.html) uvádí úplné licenční informace.
