# Architektura Lolly

![Ikona Lolly - velký zelený a bílý lízátkový bonbon](/info/icon.svg)

Tato stránka je pro lidi, kteří mění kód Lolly: jak do sebe zapadají engine, shelly a balíčky nástrojů, kde každé žije v repozitáři a závazky, které omezují každou změnu. Chceš-li vědět, co Lolly dělá a kdo ji používá, přečti si nejprve [Jak Lolly funguje](/info/how-lolly-works.html).

Dva doprovodné texty jdou hlouběji. [`engine/README.md`](../engine/README.md) je mapa enginu po modulech, generovaná z kódu. [Threat Model & Trust Boundaries](/info/threat-model.html) čte stejnou architekturu jako hranice důvěry a je to stránka pro jakoukoli otázku, co engine považuje za nedůvěryhodné.

## Celkový obraz

Nástroje jsou nahoře data. Engine uprostřed neví nic o žádné platformě. Shelly dole implementují jednu smlouvu a katalogy dodávají obsah.

![Nástroje dodávají manifest, šablonu a hooky sdílenému enginu. Shelly web, Tauri a terminál implementují most schopností HostV1 a čtou nástroje a assety z katalogů.](/info/diagrams/concepts/platform-layers.svg)

Pokud to lze popsat čistými daty a Handlebars, patří to do **enginu**. Pokud se to dotýká DOM, souborového systému, sítě nebo jakéhokoli API prohlížeče či operačního systému, patří to do **hostitele**, strany mostu na straně shellu. Engine je open source a nic, co ví o konkrétní značce nebo platformě, do enginu nepatří.

## Uspořádání repozitáře

Lolly je jeden repozitář. Každý adresář níže je v něm obyčejným adresářem, kromě `brands/suse`, **soukromého** git submodulu s balíčkem nástrojů a katalogem SUSE, který veřejný klon nestahuje. Které balíčky sestavení čte, určuje obsahový profil (`profiles.json`), řešený pro každý proces, ne přepínaný globálně. [Build Guide](/info/build-guide.html) uvádí příkaz klonování a jak se potvrzuje změna uvnitř soukromého balíčku.

| Adresář | Co obsahuje |
|---|---|
| `engine/` | Jádro nezávislé na platformě: loader, runtime, vstupy, šablony, režim URL, jednotky a formátové moduly |
| `shells/` | Webová aplikace, desktopové a mobilní aplikace Tauri, CLI, TUI a rozšíření prohlížeče |
| `packages/` | SDK pro autory nástrojů (`@lolly-tools/core`), sdílené části shellu Node a renderer dokumentace, mimo jiné |
| `community/` | Nástroje nezávislé na značce plus sdílené sady emoji |
| `brands/` | Balíčky značek: `lolly-demo` (Lolly Demo, designový systém, který provozuje lolly.tools), `lolly-start` (prázdný startér) a soukromý `suse` |
| `services/` | Volitelné služby MCP, certifikátů a Penpot a serverový kód, který sdílejí |
| `schemas/` | JSON Schema pro manifesty nástrojů, položky assetů a odkazy na assety |
| `scripts/`, `tests/`, `docs/`, `api/` | Skripty sestavení a katalogu, testovací sada enginu, tyto dokumenty a generované serverless balíky |

::: details Soubory enginu a shellu, se kterými se setkáš nejdřív
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

Neexistuje žádný adresář `tools/` ani `catalog/` v kořeni repozitáře. `packages/node-shell/src/content-roots.ts` odpoví na "kde žije nástroj `<id>`" a "kde je katalog" z `profiles.json`, když se zeptá. Skutečný pár `tools/` a `catalog/` se zapisuje jen do výstupu sestavení, jako `dist/`, obsah RPM nebo image kontejneru, protože prohlížeč tyto dvě cesty stahuje přes HTTP.

## Kde Lolly běží

Každý povrch používá stejný engine a stejné soubory nástrojů.

- **Webová aplikace.** Progresivní webová aplikace, která funguje offline, jakmile její service worker uložil nástroje a assety do cache. Nepotřebuje účet; stav žije v IndexedDB na každém zařízení. Jedno responzivní rozvržení obsluhuje desktop i telefon: na telefonu se ovládací prvky stanou listem a ovládání exportu se otevírá z plovoucí pilulky.
- **Desktopové a mobilní aplikace.** Balíčky Tauri téže webové aplikace s nativními dialogy souborů, stavem na souborovém systému a plným offline používáním.
- **CLI.** `lolly <tool-id> --input=value --output=file.png` načte stejný engine v DOM bez rozhraní a zapíše soubor. Je to režim URL přes jiný přenos, ne samostatná implementace. Viz [CLI](/info/cli.html).
- **TUI.** Celoobrazovková terminálová aplikace s důrazem na klávesnici, která znovu používá most CLI, drží uložené relace na disku (ve vlastní složce desktopové aplikace, když je nainstalována, jinak pod `~/.lolly`) a spouští omezený prohlížeč bez rozhraní, jen když to formát vyžaduje. Viz [TUI](/info/tui.html).

![Rozdělené desktopové zobrazení: ovládací prvky generované z manifestu vlevo, živé plátno vpravo](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

Stejný nástroj v šířce telefonu nepotřebuje druhé rozvržení: ovládací prvky se stanou listem nahoře a náhled drží obrazovku.

![Audiogram na obrazovce široké 430 px: list ovládání nahoře, hotové čtvercové dílo dole a plovoucí pilulka exportu](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

Webová aplikace také obsahuje **Batch** (`#/batch`, `shells/web/src/pro/`), mřížku ve stylu tabulky, která vykresluje mnoho řádků najednou napříč jedním nebo více nástroji; Batch pokrývá [Batch a Multi-edit](/info/batch.html#make-many-versions-of-one-design). **Settings → Capabilities** mapuje vše, co platforma deklaruje, že umí.

![Batch na čerstvé instalaci: jeden prázdný řádek čekající na nástroj, s povrchem tabulky a tlačítkem Render na místě dřív, než přijdou nějaká data](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

## Architektonické závazky

Tato rozhodnutí jsou uzavřená. Změna kteréhokoli z nich je velký podnik, protože utvářejí každé další rozhodnutí v kódové základně.

### 1. Deklarativní nástroje s imperativní únikovou cestou

Nástroj je manifest (`tool.json`), šablona (`template.html`) a volitelný `hooks.js`. **Manifest deklaruje vstupy**, nikdy šablona: vstupy se nevyvozují z tokenů Handlebars. Většina nástrojů je jen manifest a šablona, což umožňuje autorům bez vývojářských znalostí je tvořit.

![Zásobník ovládání Street Map: rozbalovací nabídka města, výběr motivu, posuvníky vah a spouštěče barev, každý vykreslený z jednoho řádku manifestu](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

Nástroje, které počítají hodnoty, třeba kódování QR nebo tvarování grafů, přidávají hooky: pojmenované funkce životního cyklu, které runtime volá s vloženým mostem schopností. Hooky jsou smlouva o přenositelnosti, ne bezpečnostní sandbox, a běží v rámci časového rozpočtu. Nástroje, jejichž hooky jsou prokazatelně prosté globálů stránky, nesou `isolate: true` a běží ve Workeru. [Hooky nástrojů](/info/tool-hooks.html) uvádějí životní cyklus a rozpočty a [Threat Model](/info/threat-model.html) říká, co exekutor ve stránce obsahuje a neobsahuje.

### 2. Nástroje a assety jsou data, ne zabalený kód

Webové aplikace a aplikace Tauri stahují katalogy nástrojů a assetů při spuštění, ukládají je do cache a pracují s tím, co tam je, takže nový nástroj nebo asset nepotřebuje vydání aplikace. Bajty assetů mají kontrolní součet SHA-256 a `id` a `version` assetu řídí zneplatnění cache.

### 3. Most schopností je jediné API, které nástroje vidí

Nástroje se nikdy nedotýkají DOM mimo svou šablonu, nikdy nevolají přímo `fetch` a nikdy nečtou souborový systém. Volají verzované metody `host.*`. Kanonická definice smlouvy je `packages/core/src/host-v1.ts`, SDK pro autory nástrojů `@lolly-tools/core`, takže třetí strana může stavět proti ní, aniž by závisela na enginu; `engine/src/bridge/host-v1.ts` znovu exportuje její typy.

| Povinné API | Co dělá |
|---|---|
| `host.profile` | Údaje uživatele; předvyplňuje vstupy přes `bindToProfile` |
| `host.assets` | Dotazy na katalog, řešení assetů a výběr hostitele |
| `host.state` | Ukládání a načítání slotů vstupů: IndexedDB na webu, souborový systém v Tauri, paměť v CLI |
| `host.clipboard` | Zápis textu nebo obrázku do schránky, s platformními záložními postupy |
| `host.export` | Rasterizace nebo serializace cíle vykreslení a cesta transformace souboru na zařízení |
| `host.log` | Logování po úrovních hostiteli |

Každé další API je volitelné a doplňující: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` a mnoho dalších. Manifest nástroje uvádí pod `requires` volitelná API, která jeho hooky volají bez předchozí kontroly, a hostitel, který jedno nemá, odmítne nástroj připojit; hooky ostatní zjišťují detekcí. Některá, například `recorder`, vyžadují také schopnost zařízení, kterou nástroj deklaruje. `packages/core/src/host-v1/apis.ts` je vypisuje všechna a [Host API](/info/host-api.html) dokumentuje každé z nich. Přidání metody je menší verze; odstranění nebo změna jedné je hlavní verze a v1 funguje dál, i když vyjde v2.

### 4. ID assetů jsou navždy

`lolly/logo/primary` je smlouva. Jakmile je id zveřejněno, nikdy se nemění a nikdy se znovu nepoužije. Změna bajtů zvýší `version` v položce assetu a náhrada nastaví `deprecated: true` a volitelně `replacedBy`, takže existující odkazy se vždy vyřeší. Právě to udržuje uložené relace a sdílené odkazy funkční po léta.

### 5. Režim URL je prvotřídní

Každý vstup lze vyjádřit jako parametr URL, takže odkaz je hotový soubor:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Ten odkaz sám o sobě, bez čehokoli dalšího, je hotový soubor](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Změň parametr a máš jiný soubor. Celá tato paleta je jedna výchozí barva, harmonie a počet kroků:

![Devět kroků napříč čtyřmi odstíny, všechny vzešlé z jediné výchozí barvy neseené v odkazu](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

CLI sestaví stejný stav URL ze svých argumentů a spustí stejný řetězec, takže se CLI nemůže od aplikace rozejít. `engine/src/url-mode.ts` parsuje a serializuje; sada rezervovaných názvů (`format`, `width`, `dpi`, `c2pa`, `z` a další) se nástroji nikdy nepředá a [Rezervované parametry URL](/info/url-parameters.html) je všechny vypisují. Vstupy assetů putují podle `id` a řeší se přes `host.assets.get()`, než se vyplní šablona.

### 6. Úložiště jde přes most

Webová aplikace používá IndexedDB, Tauri souborový systém a CLI paměť. Nástroje vidí jen `host.state.save(slot, data)` a `host.state.load(slot)`, nikdy `localStorage`. Lidé mohou mít na nástroj několik pojmenovaných relací bez účtu. Protože most je jediný šev, je tento stav také přenositelný: `shells/web/src/data-transfer.ts` jej přečte zpět do jednoho souboru `lolly-backup`, který se naimportuje na jakékoli jiné instalaci ([Přenos dat](/info/data-transfer.html)), a [Sync](/info/sync.html) posílá stejný balíček do úložiště, které si osoba zvolí.

### 7. Značky zralosti říkají, co nástroj je

Každý nástroj deklaruje `status: official | community | experimental`. Galerie řadí podle stavu a experimentální nástroje ve výchozím stavu dávají na exporty vodoznak: runtime vodoznak zapne, pokud volající nepředá `watermark: false`, a nástroje na zařízení jsou vyňaty. Jakýkoli proces, který tým kolem katalogu zavede, stojí nad tímto.

### 8. Vstupy jsou typované v manifestu

Vstup deklaruje `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` nebo `file`. Hostitel vykreslí ovládací prvek pro každý typ, takže nástroje nepíší žádný kód ovládání, a jakýkoli vstup může nést `bindToProfile`. Tři nesou největší váhu:

- **`asset`**, s `filter` a `allowUpload`, je most k systému assetů. `allowUpload: false` omezuje slot na assety knihovny a uživatelská nahrání sdílejí tvar `AssetRef` knihovny.
- **`blocks`** je opakující se skupina polí upravovaná v postranním panelu, používaná v Meeting Planner, Wayfinding, Diagrams a dalších. Kliknutí na vykreslený blok zaostří jeho řádek.
- **`file`** drží vlastní soubor uživatele v paměti pro utility na zařízení, jako Strip Hidden Data a Compress, a **`vector`** seskupuje pevnou sadu čísel do jednoho ovládacího prvku.

### 9. Šablony jsou bez logiky

Šablony jsou Handlebars, zvolené, aby je mohli psát lidé bez vývojářských znalostí: `{{x}}` escapuje a `{{{x}}}` je výslovné rozhodnutí. Logika žije v `hooks.js`, kde je explicitní a revidovatelná. Mnoho šablon používá `{{{` pro značkování, které spočítal hook, takže každý hook musí escapovat to, co předává. Pomocníky jsou `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` a `media`, plus `icsStamp`, `rfcText`, `csvCell` a `arrow` pro sourozenecké šablony `.ics`, `.vcf` a `.csv`. Pokrývají je [Šablony a vykreslování](/info/tool-rendering.html).

### 10. Nástroje skládají nástroje

Nástroj může vložit vykreslení jiného nástroje bez importů mezi nástroji; kompozici řeší engine. Manifest může deklarovat `composes: [{ id, tool, inputs }]` a umístit potomka pomocí `{{asset <id>}}` a přenosná URL vložení (`https://lolly.tools/tool/<id>.svg?…`) vykreslí potomka lokálně, tak Design umisťuje živý QR kód nebo graf. Potomek SVG zůstává vektorový v rodiči SVG nebo PDF. Potomci jsou mezistupně, nikdy se neoznačují vodoznakem ani razítkem, a shell, který jednoho nevykreslí, nechá slot prázdný, zatímco rodič se stále vykreslí. [Kompozice a překryvy značky](/info/tool-composition.html) uvádějí podrobnosti.

## Co jsme se rozhodli nedělat

- **Žádný libovolný JavaScript v šablonách.** Logika žije v `hooks.js`.
- **Žádný povinný server assetů.** Lidé přidávají vlastní soubory do Assets v aplikaci a práci předávají jako relaci: sdílený odkaz pro vstupy a nastavení, soubor `.lolly`, když putují i nahrání. Sdílená relace se může stát šablonou ve výběru nástroje. Organizace, která chce řízený katalog, může použít katalog, schvalování a politiky Lolly Work, nebo spravovat balíček značky v gitu a revidovat změny tam.
- **Žádná vynucená kontrola přístupu.** Otevřená aplikace je ve výchozím stavu veřejná a rizika pro značku nesou štítky zralosti a vodoznaky. Přihlášení organizace, role a politiku dodává Lolly Work, když to tým chce.
- **Žádná centrální databáze.** Stav uživatele žije na každém zařízení a volitelný Sync ho kopíruje do úložiště, které osoba zvolí, nikdy do databáze Lolly.
- **Žádná sdílená cesta kódu mezi nástroji a enginem.** Engine a nástroje komunity jsou open source a balíček značky, například soukromý `brands/suse/`, nese vlastní nástroje a katalog podle vlastních podmínek. Žádný nástroj neimportuje z `engine/`, takže rozdělení zůstává čisté.

## Životní cyklus jednoho vykreslení

Někdo otevře `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`:

1. **Spuštění.** Webová aplikace otevře IndexedDB, sestaví most schopností a synchronizuje katalogy nástrojů a assetů, nebo je offline načte z cache.
2. **Trasa.** Cesta vybere zobrazení nástroje pro `qr-code` s dotazem jako počátečními hodnotami.
3. **Načtení.** `loadTool` stáhne `tool.json`, ověří ho proti schématu a stáhne šablonu, styly a hooky.
4. **Parsování odkazu.** `parseUrlState` změní parametry na hodnoty vstupů. Odkaz na asset jako `?logo=lolly/logo/primary` se stane nevyřešeným `{ id }`.
5. **Spuštění runtime.** `createRuntime(tool, host, initialValues)` sestaví model vstupů z dat profilu, výchozích hodnot a odkazu, vyřeší odkazy na assety, načte hooky a zavolá `onInit`.
6. **Vykreslení.** Shell se přihlásí k odběru runtime, vykreslí ovládací prvky z modelu a zapíše vyplněnou šablonu do `#tool-canvas`.
7. **Interakce.** Psaní volá `runtime.setInput`, které uplatní omezení, zavolá `onInput`, znovu vyplní šablonu a překreslí.
8. **Export.** **Download** volá `runtime.export(node, format)` a `host.export` shellu vytvoří soubor: raster, vektor z walkeru DOM, PDF, dokument nebo jeden z dalších formátů v `schemas/tool.schema.json`. Fyzické jednotky se převádějí podle formátu a metadata a Content Credentials se vkládají tam, kde je formát unese. Experimentální nástroje dostanou vodoznak od hostitele, ne od nástroje. Krok exportu pokrývají [Šablony a vykreslování](/info/tool-rendering.html) a [Export souboru](/info/exporting.html).

![Panel exportu, který otevře ?options: dvojice názvu souboru a formátu, velikost výstupu a ovládací prvky, které soubor zapíšou](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Stejný životní cyklus běží v Tauri a v CLI s DOM bez rozhraní, kde výstup jde do souboru nebo na stdout.

## Licence

Kód, včetně `engine/`, `shells/`, `services/`, `schemas/` a generátoru dokumentace, je MPL-2.0, v jednom veřejném repozitáři, [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). Prózu dokumentace pokrývá CC BY-SA 4.0. Balíčky značek nesou vlastní podmínky v `NOTICE.md` každého balíčku: nástroje komunity jsou MPL-2.0 a soukromý balíček SUSE je proprietární SUSE. [About](/info/about.html) obsahuje úplnou poznámku o licencích.
