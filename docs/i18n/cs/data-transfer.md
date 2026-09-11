# Přenos dat - balíček `lolly-backup`

Vše, co uživatel Lolly nashromáždí, žije **na jeho zařízení** - žádný účet, žádný cloud. Balíček pro přenos dat je způsob, jak se tato hodnota přesouvá: exportuj ho na jedné instalaci, přenes soubor jakýmkoli způsobem (USB, AirDrop, e-mail sám sobě, síťové sdílení) a naimportuj ho na jiné. Soubor *je* přenos. Cíl může být offline nebo online. Nehraje to roli, protože nic nikdy nekomunikuje se serverem.

![Dvě tlačítka, která přesunou celou instalaci: Exportovat má data zapíše jeden zip, Importovat data ho zase načte](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Tato stránka je specifikace formátu. Návod pro koncového uživatele najdeš v [Používání Lolly → Přechod na jiné zařízení](/info/using.html). Implementace je [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) a [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) fixuje kontrakt zpětné kompatibility (round-trip).

> **Rozsah.** Balíček nese *uživatelská data*, ne nástroje. Nástroje a assety z katalogu se synchronizují zvlášť a předpokládá se, že na cílovém zařízení už jsou (v nejhorším případě ve vyšší verzi). Import nikdy nenainstaluje ani neaktualizuje nástroj.

## Cíle

- <!--i:box--> **Jeden formát, každý shell.** Stejné bajty produkuje a konzumuje webová PWA, Tauri desktop/mobilní aplikace i každý budoucí shell. Balíček je kontrakt. Bridge schopností každého shellu je adaptér pro danou platformu za ním.
- <!--i:shieldcheck--> **Přežije cestu.** Balíček poškozený nebo zkrácený při přenosu při importu hlasitě selže, nikdy se napůl neobnoví.
- <!--i:clock--> **Přežije tuto verzi.** Starší aplikace umí importovat i rozpoznané části novějšího balíčku. Skutečně nekompatibilní formát je čistě odmítnut.
- <!--i:check--> **Bezpečné sloučení.** Import do už používané instalace nikdy nesmaže nic, co v balíčku nebylo.

## Obálka

Balíček je obyčejný `.zip`. Stažený soubor je pojmenovaný podle osoby, které patří - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (například `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - takže složka se zálohami ve Stažených souborech zůstává přehledná. Části se jménem a příjmením pocházejí z profilu a při jejich absenci se vynechají. Bez profilu vznikne `LollyTools-2026-06-26-1.zip` a jen s křestním jménem `LollyTools-Ada-2026-06-26-1.zip`. Každá část se převede na token bezpečný pro název souboru (zachovají se unicode písmena a číslice, mezery a interpunkce se odstraní, maximálně 32 znaků). `<n>` je pořadové číslo pro daný den a dané zařízení, takže se opakované exporty ve stejný den nepřekrývají a zůstávají seřazené. Název sestavuje `backupFilename()` v [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts). Obsah zipu je stejný bez ohledu na název. Uvnitř:

| Cesta | Povinné | Obsah |
|---|---|---|
| `manifest.json` | ano | ID formátu, verze, počty a integrita jednotlivých částí. To první, na co se čtenář podívá. |
| `profile.json` | pokud je nastaveno | Uživatelův záznam `me` (jméno, kontakt, odkaz na fotografii, příznaky). Čte se přes `host.profile`. |
| `sessions.json` | ano | Každá uložená relace: slot, ID/verze nástroje, štítek, náhled (data-URL) a kompletní vstupní data. Čte se přes `host.state`. |
| `assets.json` | ano | Metadata pro každý nahraný asset (obrázky, fonty, brand tokeny), každé odkazuje na svá data v `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | u každého assetu | Surová data assetu (obrázkové a fontové soubory). Uloženo nekomprimovaně (formáty jsou už zkomprimované). Přípona je jen kosmetická. Rozhodující je MIME v `assets.json`. |
| `prefs.json` | ano | Lokální preference vlastněné uživatelem: `theme`, `sidebarWidth` a počítadlo aktivity `ct-metrics`. |
| `lolly.txt` | ano | Čitelné shrnutí balíčku (počty, profil, název souboru) pro každého, kdo zip otevře bez Lolly. Znovu se generuje při každém exportu a při importu je rozpoznán, takže se nikdy nepočítá jako přeskočená část. Zapisuje se *po* mapě integrity, takže do ní není zahrnut. |

Balíček je záměrně obyčejný zip: přežije jakýkoli přenos neporušený a prohlédnout si ho umí libovolný nástroj na rozbalování.

`profile.json` je nejmenší část a ta, kterou uživatel v aplikaci vidí jako první: údaje, které producent vyplní jednou, plus opt-in, který nástrojům dovolí je použít.

![Formulář Profile details, ze kterého vznikne profile.json - jméno, kontakt, fotografie a opt-in vedle nich](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 1,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.webp": "sha256-…",
    "prefs.json": "sha256-…"
  }
}
```

| Pole | Význam |
|---|---|
| `format` | Vždy `lolly-backup`. Soubor bez něj je odmítnut jako "not a Lolly backup". |
| `formatVersion` | Rozvržení, se kterým byl balíček **zapsán**. Zvyšuje se při jakékoli změně sady nebo tvaru částí. Čtenáři se podle něj **ne**řídí. |
| `minReader` | Minimální verze čtenáře potřebná k **bezpečnému** importu tohoto balíčku. Podle tohoto pole se čtenáři řídí. |
| `app` | ID produkující aplikace, pro diagnostiku. |
| `exportedAt` | ISO časové razítko vytvoření balíčku. |
| `counts` | Co do něj zapisovatel vložil, pro zobrazení a kontrolu smysluplnosti. |
| `integrity` | Volitelné. Mapuje každou část kromě `manifest.json` na digest ve stylu SRI `sha256-<base64>` jejích **nekomprimovaných** bajtů. |

## Zásady verzování (zpětná kompatibilita)

Rozdělení mezi `formatVersion` a `minReader` umožňuje, aby formát rostl, aniž by osiřely starší instalace:

- Čtenář balíček importuje, když `manifest.minReader ≤` jeho vlastní verze čtenáře. Odmítne ho (hláškou "needs a newer version of the app") jen tehdy, když balíček výslovně vyžaduje novější čtenáře.
- **Aditivní** změna - nová *volitelná* část nebo nové volitelné pole v manifestu - zvýší `formatVersion`, ale `minReader` nechá beze změny. Starší aplikace stále importují každou část, kterou rozpoznají. Části, které nerozpoznají, se přeskočí (viz níže), ne tiše zahodí.
- **Nekompatibilní** změna - taková, kde nesprávný import části poškodí data, nebo kde se dříve volitelná část stane povinnou - zvýší `minReader`. Starší aplikace pak čistě odmítnou import místo toho, aby importovaly něco, co neumí zpracovat.
- Pokud budoucí balíček nastaví `formatVersion`, ale vynechá `minReader`, čtenáři se konzervativně řídí podle `formatVersion` (změnu považují za nekompatibilní).

> **Pravidlo pro autory:** pokud by každý existující čtenář udělal správnou věc i tak, že tvůj přírůstek ignoruje, jde o aditivní změnu - zvyš `formatVersion`, `minReader` nech beze změny. Jinak zvyš `minReader`.

## Integrita

Když je přítomné `manifest.integrity`, čtenář ověří SHA-256 každé uvedené části **před tím, než cokoli zapíše**. Neshoda ("failed its integrity check") nebo chybějící část ("incomplete") přeruší celý import - žádné částečné obnovení neexistuje. Tím se zachytí poškození, které může způsobit přenos souboru (zkrácený AirDrop, e-mailová brána, která přílohu překódovala, špatný sektor na USB).

Integrita je záměrně best-effort: zapisuje se jen tam, kde je dostupné Web Crypto (každý zabezpečený kontext prohlížeče a moderní Node), a ověřuje se jen tehdy, když jsou přítomné mapa i Web Crypto zároveň. Balíček bez mapy - třeba starší, z doby před integritou - se importuje beze změny. "Nelze ověřit" se nikdy nebere jako "poškozeno".

Manifest neuvádí ani sám sebe, ani znovu generovaný soubor `lolly.txt` README. Digesty pokrývají části, za které manifest ručí.

## Sémantika importu

Import je **sloučení s přepisem**, nikdy nahrazení všeho:

- Existující data na cílovém zařízení zůstávají na místě.
- Každý klíč, který koliduje - profil, slot relace, ID nahraného obrázku - je nahrazen importovanou kopií.
- Nic, co v balíčku nebylo, se nedotkne. Relace, kterou cíl měl, ale balíček ne, import přežije.

Uložené relace se ke svým obrázkům automaticky znovu propojí: reference na assety se udržují podle ID a bridge je znovu přeloží poté, co jsou nahrané obrázky obnovené (musí tak jako tak, protože URL `blob:` nepřežijí obnovení stránky).

Souhrn importu hlásí `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`. `failedAssets` počítá nahrané assety, které se nepodařilo obnovit (například plné úložiště zařízení). To je odlišné od `skipped`, které počítá části od dopředu kompatibilního novějšího zapisovatele, jež tato verze nerozpoznala. UI zobrazuje `skipped` ("… · N novějších položek přeskočeno"), takže obnova je poctivá v tom, co nechala stranou.

## Co necestuje

- **Katalogové cache** (stažená metadata a data assetů, index nástrojů) - na cíli se znovu synchronizují zdarma.
- **Nástroje a brand assety** - mimo rozsah, předpokládá se, že na cíli už jsou.
- **URL `blob:` / object URL** - bridge je při načtení znovu vygeneruje.
- **Čítač pořadí exportů** - denní čítač pro pojmenovávání stažených souborů (klíč `localStorage` `lolly-export-seq`) je jen lokální pomůcka pro pojmenovávání. Je záměrně mimo `PREF_KEYS`, takže v balíčku nikdy nejede.

Ukazatel úložiště zobrazuje stejné rozdělení. Uložené relace a Moje obrázky jedou v balíčku. Cache assetů, náhledy nástrojů a offline piny pod nimi jsou vždy odvoditelné znovu, takže zůstávají mimo.

![Ukazatel úložiště rozdělující data tohoto zařízení do pojmenovaných kategorií, kde jsou Uložené relace a Moje obrázky sledovány odděleně od Cache assetů, zde na čerstvé instalaci, kde je zatím každá kategorie prázdná](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=.store-manages%2C.storage-subsection%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&walker=1&dark=1&filename=ce-storage-categories)

## Záruka napříč shelly

`data-transfer.ts` čte a zapisuje výhradně přes bridge schopností (`host.profile`, `host.state`, `host.assets`) a sdílené preference v `localStorage`. Protože bridge je jediný styk, *stejný* modul produkuje bajtově identický balíček na každém shellu, i když se úložiště pod ním liší - IndexedDB na webu, souborový systém v Tauri. Tauri shelly tento modul používají beze změny. Liší se jen jejich implementace `host.state`. Headless test prochází celou zpětnou kompatibilitu (round-trip) proti in-memory bridge, a proto zastupuje všechny ostatní.

Mimo tuto záruku stojí dva shelly, z různých důvodů:

- **Jednorázové CLI** nemá co nést - jeho stav je in-memory a existuje jen pro dobu jednoho spuštění.
- **TUI** stav skutečně udržuje (`~/.lolly`: relace, složky, profil) a jeho pohled Profile ho umí zálohovat, ale zapisuje *jednodušší* archiv vlastní konstrukce: `sessions/<slot>.json` pro každou relaci plus `profile.json` a `folders.json`, bez manifestu, bez `formatVersion`/`minReader` a bez mapy integrity. **Není** importovatelný tímto formátem - čtenář ho odmítne jako "not a Lolly backup" - a matoucím způsobem používá podobný název (`lolly-backup-<stamp>.zip`). Sjednocení obou je známá mezera.

## Rezervované body pro rozšíření

Obálka je záměrně navržena jako manifest plus sada pojmenovaných částí, aby na ní později mohly jet nové druhy přenosných dat **bez nekompatibilní změny**. Zapadnou jako aditivní části (nový `formatVersion`, stejný `minReader`) a dnešní čtenář to, co nerozpozná, přeskočí. Tyto věci jsou na [roadmapě](/info/overview.html#roadmap), zatím nejsou implementované. Jejich názvy jsou zde rezervované, aby formát zůstal koherentní, až přistanou.

- **`tokens.json` - design tokeny.** Dokument s design tokeny podle [W3C DTCG](https://tr.designtokens.org/format/) (formát, který [Penpot importuje a exportuje](https://help.penpot.app/user-guide/design-systems/design-tokens/) - tokeny s `$value`/`$type`/`$description`, organizované do skupin, sad a témat). Sada tokenů v balíčku umožní uživateli přenést své brandové primitivy mezi instalacemi společně s relacemi. Z dlouhodobého hlediska se z importované sady tokenů stane plnohodnotný zdroj, vůči kterému se řeší nástroje a paletové assety.
- **`penpot/` - importované soubory Penpot.** Rezervovaný adresář pro soubor Penpot (nebo jeho extrahovanou, pro Lolly relevantní podmnožinu) importovaný a zpřístupněný *jako nástroj*. Balíček ponese importovanou definici, takže bude cestovat spolu se zbytkem uživatelských dat.

Cokoli mimo tyto rezervované názvy a výše uvedené části je pro čtenáře neznámá část: ponechá se nedotčená a započítá se do `skipped`.

## Reference

- Modul: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - pojmenovávač `backupFilename()` je interní).
- Kontraktní test: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - případy round-trip, sloučení, integrity, dopředné kompatibility a bránění podle verze čtenáře.
- Použitý povrch bridge: `host.profile`, `host.state`, `host.assets` - viz [Host API](/info/host-api.html).
