# Přenos dat: balíček `lolly-backup`

Lolly drží tvou osobní knihovnu na zařízení. Záložní balíček je způsob, jak se ta knihovna přesouvá: exportuj ji na jedné instalaci, přenes soubor, jak chceš (USB, AirDrop, e-mail sám sobě nebo síťový disk) a importuj ji na jiné. Export i import nepotřebují server a cíl může být offline.

Tato stránka je specifikace formátu pro lidi, kteří staví shelly, nástroje nebo skripty kolem záloh: co je v zipu, jak se verze brání, jak se import slučuje a co se kontroluje. Návod pro lidi přesouvající vlastní práci je [Přesuň svou práci na jiné zařízení](/info/find-your-work.html#move-your-work-to-another-device).

![Dvě tlačítka, která přesouvají celou instalaci: Export my data zapíše jeden zip, Import data jej přečte zpět](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> **Rozsah.** Balíček nese *uživatelská data*, ne nástroje katalogu. Nástroje a assety katalogu se synchronizují odděleně a předpokládá se, že na cíli už jsou, nanejvýš ve vyšší verzi. Nástroje, které si uživatel vytvořil sám, putují uvnitř `profile.json`. Import nikdy neinstaluje ani neaktualizuje nástroj katalogu.

## Cíle

- <!--i:box--> **Jeden formát, každý shell.** Webová aplikace, desktopové a mobilní aplikace a budoucí shelly sdílejí stejnou obálku a schémata částí. Volitelné části závisejí na schopnostech každého shellu a nepodporované části se hlásí. Každý most schopností dodává svůj adaptér úložiště.
- <!--i:shieldcheck--> **Přežije cestu.** Balíček poškozený nebo useknutý při přenosu při importu hlasitě selže a nikdy se neobnoví napůl.
- <!--i:clock--> **Přežije tuto verzi.** Starší aplikace stále importuje části novějšího balíčku, které rozpozná. Skutečně zásadní formát je čistě odmítnut.
- <!--i:check--> **Bezpečné sloučení.** Import na instalaci, která se už používá, nikdy nesmaže nic, co nebylo v balíčku.

## Obálka

Balíček je prostý `.zip`, takže přežije jakýkoli přenos nedotčen a obsah může zkontrolovat jakýkoli nástroj pro rozbalení.

Stažení je pojmenováno po osobě, které patří: `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, například `LollyTools-Ada-Lovelace-2026-06-26-1.zip`, aby složka Stažené se zálohami zůstala čitelná. Jméno a příjmení pocházejí z profilu a vynechávají se, když nejsou nastaveny: bez profilu vznikne `LollyTools-2026-06-26-1.zip` a jen s křestním jménem `LollyTools-Ada-2026-06-26-1.zip`. Každé jméno se zredukuje na token bezpečný pro název souboru (písmena a číslice Unicode se ponechají, mezery a interpunkce se odstraní, nejvýše 32 znaků). `<n>` je pořadí za den a zařízení, takže opakované exporty téhož dne nekolidují a zůstávají v pořadí. Název sestavuje `backupFilename()` v `data-transfer.ts` a obsah zipu je stejný bez ohledu na název.

| Cesta | Povinné | Obsah |
|---|---|---|
| `manifest.json` | ano | ID formátu, verze, počty a integrita po částech. První, na co se čtenář dívá. |
| `profile.json` | je-li nastaveno | Celý záznam `me` uživatele: jméno, kontakt, odkaz na portrét a příznaky, plus složky, Koš, vzory projektů, uživatelské šablony a uživatelem vytvořené nástroje, oblíbené, skryté nástroje, jazyk a volba emoji. Čteno přes `host.profile`. |
| `sessions.json` | ano | Každá uložená relace: slot, id a verze nástroje, popisek, miniatura (data URL) a úplná vstupní data. Čteno přes `host.state`. |
| `assets.json` | ano | Metadata každého nahraného assetu (obrázky, písma, tokeny značky, loga, uložené kopie stažených souborů), každý ukazující na své bajty pod `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | na asset | Surové bajty assetu, uložené nekomprimované, protože většina už je v komprimovaných formátech. Přípona je kosmetická; rozhodující je typ MIME v `assets.json`. |
| `assets/blobs/<n>.c2pa` | je-li přítomno | Extrahované Content Credentials jako přesné binární bajty, odkazované přes `_credentialFile` v záznamu assetu. Nejsou to podpisové klíče zařízení. |
| `design-systems.json` | je-li přítomno | Designové systémy vytvořené nebo přidané na této instalaci, jako `{ active, records }`. Viz [Pravidla importu](#import-rules). |
| `file-history.json` | volitelné | Verzované snímky assetů, hotové zprávy o operacích se soubory a úplné manifesty dávek, s vlastní verzí. Poskytuje interní záložní adaptér shellu `fileHistory`. |
| `revision-history.json` | volitelné, ruční zálohy | Stabilní ID tvorby, uchované kontrolní body, miniatury a průběžné záchranné koncepty. Poskytuje `host.state.history.backup`, kde je podporováno. |
| `file-history/versions/` | na snímek | Předchozí bajty assetů a extrahované credentials, ať aktuální asset ještě existuje, nebo ne. |
| `file-history/results/` | na hotovou operaci | Přesné výstupní bajty. Žádný původní soubor vybraný k převodu se neuchovává ani nezahrnuje. |
| `prefs.json` | ano | Místní předvolby vlastněné uživatelem: `theme`, `sidebarWidth` a počítadlo aktivity `ct-metrics`. |
| `lolly.txt` | ano | Čitelný souhrn balíčku (počty, profil, název souboru) pro kohokoli, kdo zip otevře bez Lolly. Znovu se generuje při každém exportu a při importu se rozpoznává, takže se nikdy nepočítá jako přeskočená část. Zapisuje se po mapě integrity, takže mapa tento soubor nepokrývá. |

::: details Jak export zapisuje zip
Export zapisuje zip po částech (`shells/web/src/lib/zip-stream.ts`). Nahrání, uložené výsledky a uložené verze assetů se čtou po úsecích 4 MiB, nikdy celé, a uložené výsledky a verze se nejprve kontrolují proti zaznamenanému SHA-256. Každý soubor se pak čte kvůli kontrolnímu součtu a digestu integrity a zip na něj odkazuje tam, kde je.

Nic se nepřekóduje, takže soubor nesoucí Content Credentials zachovává přesné bajty, které jeho podpis pokrývá, a každá část si drží přesné bajty a digest. Pro stejné části a čas je zip shodný se zipem staršího zapisovače v paměti, kromě toho, že soubor historie nad 16 MiB se komprimuje po kusech. `tests/backup-streaming.test.ts` to kontroluje proti zaznamenaným referenčním digestům.

Na syntetické knihovně 192 MiB, měřeno v Node, dokončení zálohy stálo asi 125 až 150 MiB navíc k knihovně, oproti asi 850 MiB u zapisovače v paměti (`node scripts/bench-backup-finalise.ts`). Import stále čte celý zip do paměti.
:::

## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 3,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3, "assetVersions": 1, "fileOperations": 1 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.bin": "sha256-…",
    "file-history.json": "sha256-…",
    "file-history/versions/0.bin": "sha256-…",
    "file-history/results/0.bin": "sha256-…",
    "prefs.json": "sha256-…"
  }
}
```

| Pole | Význam |
|---|---|
| `format` | Vždy `lolly-backup`. Soubor bez něj se odmítne jako "not a Lolly backup". |
| `formatVersion` | Rozvržení, s nímž byl tento balíček **zapsán**. Zvyšuje se při jakékoli změně sady částí nebo tvarů. Čtenáři podle tohoto pole **nebrání**. |
| `minReader` | Nejnižší verze čtenáře, která může tento balíček **bezpečně** importovat. Podle tohoto pole čtenáři brání. |
| `app` | ID vytvářející aplikace, pro diagnostiku. |
| `exportedAt` | Časové razítko ISO vytvoření balíčku. |
| `counts` | Co zapisovač vložil, pro zobrazení a kontrolu rozumnosti. |
| `integrity` | Volitelné. Mapuje každou část kromě `manifest.json` na digest `sha256-<base64>` ve stylu SRI jejích **nekomprimovaných** bajtů. |

## Politika verzí

Dvě čísla verzí nechají formát růst, aniž by starší instalace uvízly.

![Změna formátu balíčku je buď aditivní, což staří čtenáři mohou ignorovat, nebo zásadní, kde chybný import poškodí data. Aditivní zvyšuje formatVersion a ponechává minReader; zásadní zvyšuje formatVersion a zvedá minReader. Čtenář importuje, když je minReader nanejvýš jeho vlastní verze.](/info/diagrams/concepts/backup-version-gate.svg)

- Čtenář balíček importuje, když je `manifest.minReader` nanejvýš jeho vlastní verze čtenáře. Odmítne, s "needs a newer version of the app", jen když balíček vyžaduje novějšího čtenáře.
- **Aditivní** změna, například nová volitelná část nebo nové volitelné pole manifestu, zvyšuje `formatVersion` a `minReader` ponechává. Starší aplikace stále importují každou část, kterou rozpoznají, a části, které nerozpoznají, se hlásí jako přeskočené, ne tiše zahozené.
- **Zásadní** změna, kde chybný import části poškodí data nebo volitelná část se stane povinnou, zvedá `minReader`. Starší aplikace pak čistě odmítnou, místo aby importovaly něco, co nezvládnou.
- Pokud budoucí balíček nastaví `formatVersion`, ale vynechá `minReader`, čtenáři se vrátí k bránění podle `formatVersion` a změnu považují za zásadní.

> **Pravidlo pro autory:** pokud by každý existující čtenář udělal správnou věc ignorováním tvého přídavku, změna je aditivní: zvyš `formatVersion` a `minReader` ponech. Jinak zvyš `minReader`.

## Integrita

Když je `manifest.integrity` přítomno, čtenář zkontroluje SHA-256 každé uvedené části **dřív, než cokoli zapíše**. Neshoda ("failed its integrity check") nebo chybějící část ("incomplete") zastaví celý import, takže nedojde k částečné obnově. To zachytí poškození, které může přenos souboru způsobit: useknutý AirDrop, e-mailová brána, která přílohu překódovala, vadný sektor USB.

Integrita je podle možností. Zapisuje se jen tam, kde je Web Crypto k dispozici (každý bezpečný kontext prohlížeče a moderní Node), a kontroluje se jen tehdy, když jsou přítomny mapa i Web Crypto. Balíček bez mapy, například z doby před integritou, se importuje beze změny: "cannot verify" se nikdy nepočítá jako "corrupt".

Manifest neuvádí sebe ani znovu generovaný `lolly.txt`. Digesty pokrývají části, za které manifest ručí.

## Pravidla importu

Import běží v jednom ze dvou režimů.

- **Merge** dělá **Import data…** a první připojení synchronizace, **Bring it to this device**. Data na cíli zůstávají a nic, co nebylo v balíčku, se nedotkne: relace, kterou cíl měl a balíček ne, import přežije.
- **Replace** používá synchronizace zařízení, aby udržela zařízení v souladu: vezme záznam profilu synchronizované kopie, předvolby, relace, obrázky a volbu aktivního designového systému a odstraní jen položky, které jiné zařízení od poslední synchronizace smazalo. Obnovení dřívější kopie jde dál a přizpůsobí zařízení té kopii, odstraní vše, co kopie nedrží, po uložení zařízení. Co člověk vidí, pokrývá [Synchronizace zařízení](/info/sync.html).

Při sloučení se vše, co je jen na cíli, ponechá a každý druh dat v balíčku se s cílem setkává takto:

| Data | Už na cíli | Jen v balíčku |
|---|---|---|
| Relace (podle slotu) a nahrané obrázky (podle id) | Ponechá se kopie uložená později, takže starší záloha nikdy nepřepíše novější práci. Stejné nebo neznámé časy ponechají kopii cíle. | Přidáno |
| Složky | Ponechá se jméno a rodič cíle a složka získá členy balíčku, které jí chybí. Relace zařazená do složky na cíli tam zůstane. | Přidáno |
| Oblíbené (nástroje, assety katalogu a položky Projects) | Sloučeno | Přidáno |
| Šablony, šablony Projects a uživatelské nástroje (podle id) | Ponechá se záznam cíle. | Přidáno |
| Položky Koše | Ponechá se položka cíle. | Přidáno, takže položka, kterou lze obnovit na kterékoli instalaci, stále lze. Položka, jejíž složka je na cíli znovu používána nebo jejíž slot Koše cíl už používá, se vynechá. |
| Další pole profilu (jméno, kontakt, jazyk, příznaky funkcí, skryté nástroje a další nastavení) | Ponechá se hodnota cíle. | Převezme se, kde je pole cíle prázdné |
| Předvolby (`prefs.json`) | Ponechá se hodnota cíle. | Zapíše se, kde cíl žádnou nemá |
| Designové systémy (podle id) | Záznam balíčku nahradí záznam cíle. | Přidáno. Aktivní volba balíčku se uplatní jen tehdy, když cíl nemá vlastní designový systém. |
| Historie tvorby | Kopie uložená později zůstává aktuální a druhá se ponechá jako chráněný koncept. | Přidáno |

**Uložené relace se k obrázkům automaticky znovu propojí.** Odkazy na assety se drží podle id a most je po obnově obrázků znovu vyřeší, což stejně dělat musí, protože URL `blob:` nepřežijí znovunačtení.

**Záznamy historie se po zapsání nikdy nemění.** Opakovaný import verzí assetů a ID operací nepřidá nic a ID, které už pojmenovává jiné bajty nebo historii, se odmítne, ne přepíše. Opětovný import identického aktuálního assetu ponechá jeho verzi a změněný aktuální asset musí nést jinou verzi.

**Historie tvorby má několik dalších pravidel.** Tvorba, jejíž slot cíl používá pro jinou tvorbu, se přidá jako samostatná tvorba a tvorba v Koši cíle tam zůstane. ID kontrolního bodu, které na cíli pojmenovává jiný obsah, ponechá kontrolní bod cíle. Archiv, který selže ve vlastních kontrolách, zastaví import dřív, než se změní jakýkoli profil, relace, asset nebo předvolba, a identický opakovaný import nepřidá žádné úložiště.

**Souhrn hlásí, co se stalo.** Každý import vrací `profile`, `sessions`, `userAssets`, `prefs`, `skipped` a `failedAssets`.

- `failedAssets` počítá nahrané assety, které nešlo obnovit, například protože je úložiště zařízení plné.
- `skipped` počítá části od novějšího zapisovače, které toto sestavení nerozpoznalo. Aplikace jej zobrazí ("… · N newer items skipped"), takže obnova uvádí, co nechala za sebou.
- S historií souborů souhrn přidává `assetVersions`, `fileOperations`, `fileBatches` a `failedHistory`. Vyčerpání úložiště nebo konflikt neměnného ID může způsobit částečnou obnovu a aplikace pak řekne člověku, aby zdrojovou zálohu ponechal.
- S historií tvorby přidává `revisions` a `recoveryDrafts`, počítající jen to, co tento import přidal, a `added`, `kept`, `replaced`, `copies` a `hidden` pro to, jak se každá tvorba sloučila. `skippedCheckpoints` počítá kontrolní body, jejichž id na cíli pojmenovává jiný obsah, a `historyLeftOut` počítá starší kontrolní body a koncepty, které se nevešly do místa pro historii zařízení.
- Import typu replace přidává `removed` a `failedRemovals`.

Obnova není jedna transakce napříč úložišti profilu, relací, assetů a historie. Cloudová synchronizace po částečné nebo nepodporované obnově **neposouvá** svou uplatněnou revizi, takže kopie zůstává k dispozici pro opakování.

## Co necestuje

- **Cache katalogu** (stažená metadata a bloby assetů, index nástrojů), které cíl zdarma znovu synchronizuje.
- **Nástroje a assety katalogu**, které jsou mimo rozsah a předpokládá se, že jsou na cíli přítomny. Tokeny značky, písma a loga, která uživatel přidal, jsou uživatelské assety, takže putují.
- **URL `blob:` a objektů**, které most při načtení znovu generuje.
- **Originály převodů, živé exekuční zámky a strojově místní přístupové nebo podpisové tajemství.** Nejsou to přenosná historie. Uložený výsledek je kopie, ne příslib, že původní zdroj byl zálohován.
- **Počítadlo exportní sekvence**, denní počítadlo pojmenování stažení v `localStorage` (`lolly-export-seq`). Je držené mimo `PREF_KEYS`, takže nikdy nejede v balíčku.

Měřič úložiště ukazuje stejné rozdělení. Uložené relace, My images a File results & versions jdou do balíčku. Cache assetů, náhledy nástrojů a offline připnutí pod nimi lze všechny znovu vytvořit, takže zůstávají pozadu.

![Měřič úložiště rozdělující data tohoto zařízení do pojmenovaných kategorií, s Saved sessions a My images sledovanými odděleně od Asset cache, zde na čerstvé instalaci, kde je každá kategorie ještě prázdná](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

## Data organizace s Lolly Work

Tento balíček zálohuje osobní knihovnu zařízení. Není to záloha instance **Lolly Work**: účty organizace, politiky přístupu, sdílené projekty, verze katalogu, schvalování, úlohy vykreslení a auditní záznamy drží ta služba. Znovu se připoj a přihlas se, abys znovu získal přístup ke sdílené práci; import osobního balíčku tento přístup neuděluje.

Provozovatelé zálohují, uchovávají a mažou serverová data podle vlastních průvodců Lolly Work: [Zálohování a obnova](/info/work-operations.html#backup-and-restore) a [Úložiště Work a životní cyklus dat](/info/work-data-lifecycle.html). Vymazání nebo export zařízení nic z těchto serverových operací neprovede.

## Napříč shelly

`data-transfer.ts` čte a zapisuje jen přes most schopností (`host.profile`, `host.state`, `host.assets`) a sdílené předvolby `localStorage`. Stejný modul čte a zapisuje společnou obálku na webu i v desktopových a mobilních aplikacích, přes IndexedDB nebo úložiště souborového systému. Volitelné části historie se objevují jen tam, kde je dostupný jejich adaptér, a nepodporovaná část se při importu hlásí jako přeskočená. Bezhlavá sada ověřuje společné části proti mostu v paměti a transakce historie mají také testy ve skutečném prohlížeči.

Mimo tuto záruku stojí dva shelly, z různých důvodů:

- **Jednorázové CLI** nemá co nést: jeho stav je v paměti a vydrží jedno vyvolání.
- **TUI** drží stav v `~/.lolly` (relace, složky, profil) a jeho zobrazení Profile jej umí zálohovat, ale zapisuje jednodušší vlastní archiv: `saved-state/<slot>.json` na relaci plus `profile.json` a `folders.json`, bez manifestu, bez `formatVersion` či `minReader` a bez mapy integrity. Tento formát jej importovat neumí (čtenář jej odmítne jako "not a Lolly backup") a jeho název je matoucně podobný (`lolly-backup-<stamp>.zip`). Sjednocení obou je známá mezera.

## Zatím nepřenosné

Obálka je manifest plus pojmenované části, takže nové druhy přenosných dat se mohou později přidat jako aditivní části (nový `formatVersion`, stejný `minReader`) a dnešní čtenáři přeskočí, co nerozpoznají. Designové systémy takto putují už dnes, jako `design-systems.json` plus jejich uživatelské assety.

Dvě jména jsou rezervována pro data, která zatím nepřenášejí:

- **`tokens.json`** by nesl celý dokument designových tokenů [W3C DTCG](https://tr.designtokens.org/format/) s jeho skupinami, sadami a motivy, formát, který [Penpot importuje a exportuje](https://help.penpot.app/user-guide/design-systems/design-tokens/). Vlastní tokeny značky uživatele už putují jako asset `user/tokens/brand` v `assets.json` a tokeny designového systému putují s jeho záznamem.
- **`penpot/`** je rezervováno pro pohlcený soubor Penpot, nebo jeho podmnožinu relevantní pro Lolly, zpřístupněný jako nástroj.

Dnešní čtenáři neznají ani jedno z těchto jmen. Jako cokoli jiného mimo výše uvedené části je pro ně každé neznámou částí: ponechanou nedotčenou a započítanou do `skipped`.

## Části historie

Dvě části historie jsou volitelné a mají vlastní verze. Většina čtenářů může tuto sekci přeskočit.

::: details Historie tvorby (v3)
Ruční zálohy z webové instalace s historií tvorby obsahují `revision-history.json` s vlastním schématem `{ version: 1, documents, revisions, recoveries }`. Nese uchovaná ID, kanonické snímky vstupů, razítka verzí, rastrové náhledy a samostatné koncepty zapisovače. Adaptér historie zachytí aktuální relace a jejich hlavy v jedné čtecí transakci a `sessions.json` používá stejné aktuální snímky pro starší čtenáře.

Obnova před potvrzením archivu v jedné transakci kontroluje SHA-256 obsahu a počty bajtů, jedinečné identity, vztahy dokumentu a hlavy, předky, časová razítka, typy náhledů a limity. Zhuštěné odkazy na rodiče mohou chybět. Existující aktuální práce se nikdy nenahradí potichu: když je tvorba na obou stranách, strana, která nezůstává aktuální, se stane chráněným konceptem.

Limit přenosu archivu 384 MiB se kontroluje explicitně a limity úložiště se vynucují bez useknutí uchovaných kontrolních bodů. Export zapisuje `revision-history.json` a `sessions.json` po kusech, se stejnými bajty, jaké dává jeden `JSON.stringify`, takže se text souboru nikdy nedrží celý. Soubor historie, který by limit překročil, se zahodí v okamžiku, kdy ho překročí, a odtud se jen počítá. Archiv se pak vytvoří znovu bez nejstarších automatických kontrolních bodů a souhrn exportu je počítá jako `checkpointsLeftOut`, nebo se archiv odmítne celý.

Shell bez této schopnosti obnoví běžné relace a část historie ohlásí jako přeskočenou. Nativní historie souborového systému zůstává nepodporována, dokud její adaptér nedodá trvalé transakce historie. Hosté v soukromé kolaboraci nemají trvalou historii ani archiv obnovy.

Synchronizace osobního snímku historii tvorby vynechává. Uplatnění snímku na místní dokument s historií ponechá jeho předchozí pracovní stav jako samostatný záchranný koncept a zneplatní zápisový token každého otevřeného editoru. Jeho neměnné kontrolní body zůstávají na zařízení. To chrání místní historii při nahrazení snímkem; neslučuje souběžné historie zařízení.

Historické odkazy na assety se zachovávají, zatímco vykreslování assety stále řeší přes stávající knihovnu cíle. Tento archiv zatím nezaručuje přesné staré bajty assetů ani stará vykreslení nástrojů. Bajty verzí assetů a výsledků souborů putují ve vlastní záložní části.
:::

::: details Uložené verze a výsledky souborů (v2)
Volitelná část historie drží `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }` a čtenáři přijímají i dřívější tvar history-v1 bez dávek. Každý snímek udává stabilní ID assetu a přesnou verzi, čas uložení, délku v bajtech a hex SHA-256, plus záznam assetu, jehož `_file` a volitelný `_credentialFile` ukazují na binární části. Operace nesou původní fakta o souboru, požadavek, zprávu, časová razítka a volitelný výsledek `_file`. Názvy backendů úložiště, ukazatele OPFS a exekuční zámky nepřenášejí. Čtenáři, kteří znají jen history v1, novou verzi historie odmítnou před importem, místo aby potichu zahodili členství v dávce.

Manifesty dávek zaznamenávají každý vybraný zdroj před zpracováním, včetně souborů nikdy nepřečtených, zrušených členů, selhání rezervace místa pro výsledek a přerušené práce. Každý člen má stabilní ID operace, odkaz na zdroj a fakta, požadovaný název výstupu a konečnou zprávu. Nepřečtený zdroj má deklarovaná fakta, ne vymyšlený digest. Import ověřuje identitu člena a konzistenci s jakoukoli nesenou zprávou operace. Zprávy dávek zůstávají dostupné, i když jednotlivé výsledky byly odstraněny, ale potvrzení neznamená, že jeho výstupní bajty jsou stále uloženy.

- **Nejprve ověření.** Každý známý záznam historie, zpráva a odkazovaný soubor se ověří před jakýmkoli zápisem importu profilu nebo assetů. Chybějící bajty a neshodný SHA-256 selžou, i když obálka nemá mapu integrity. Extrahované credentials zůstávají bajtovými poli, včetně importů od starších zapisovačů, které je serializovaly jako objekty s číselnými klíči.
- **Běžící práce.** Běžící operace se v záloze stanou přerušenými záznamy, s vysvětlující zprávou o selhání a bez výsledku. Obnova nikdy znovu nespouští práci na pozadí ani neimportuje aktivní zámek. Opakování znamená znovu vybrat původní soubor, zkontrolovaný proti zaznamenanému SHA-256, je-li k dispozici.
- **Úložiště.** Obnovené výsledky potvrzují své bajty a metadata společně v IndexedDB. Běžné nové výsledky používají OPFS, kde je dostupné, s náhradou IndexedDB. Existující živá operace se importem nikdy nenahradí.
- **Limity zálohy.** Export streamuje tyto bajty do archivu, ale obnova stále rozbaluje celou zálohu v paměti, takže limity zůstávají: **256 MiB obsahu historie**, **4 MiB metadat historie**, nejvýše **100 operací**, **100 dávek** a **2 000 snímků**. Export výslovně odmítne příliš velkou nebo neúplnou historii a nikdy ji potichu nevynechá. Důležité verze a výsledky stáhni jednotlivě, než odstraníš starší místní kopie. Tyto limity nejsou změřenou zárukou špičkové paměti pro telefony.
- **Místní rozpočty.** Místní historie výsledků má rozpočet 512 MiB a strop 100 záznamů. Snímky assetů mají samostatný rozpočet 512 MiB a nejvýše 20 historických verzí na asset a bajty extrahovaných credentials se do toho rozpočtu počítají. Obnova tyto limity respektuje a nikdy potichu nevytlačí existující uživatelská data.
- **Metadata dávek.** Místní metadata dávek mají samostatný rozpočet 4 MiB, nejvýše 100 manifestů a 20 členů na dávku. Čekající členové rezervují kapacitu metadat, se stropem zprávy 32 KiB na člena. Je to logický rozpočet, ne záruka místa na disku prohlížeče: skutečné selhání kvóty se zobrazí a zpráva v paměti zůstane ke stažení. Opakování člena dávky vytvoří novou dávku bez přepsání staré zprávy. Odstranění záznamu dávky neodstraní bajty jednotlivých výsledků ani assety knihovny.
- **Výsledky v knihovně.** Převedené výsledky lze přidat do knihovny bez normalizace nebo překódování, s připojenými hashi zdroje a výstupu a vztahem operace. Opakovaná přidání znovu použijí nezměněnou kopii a upravená kopie se nikdy nepřepíše. Rastrové obrázky mohou zahájit nový dokument Design, který používá aktuální ID assetu knihovny; vynucení přesných připnutí verzí v celém runtime a cestě URL Design je samostatná práce. Výsledky SVG, HTML, PDF a ZIP se uchovávají jako neprůhledné souborové assety, nepovyšují se na důvěryhodný interaktivní ani vektorový obsah.
- **Kde to lidé vidí.** **Convert → Recent file operations** ukazuje využití historie, zprávy, stažení a správce verzí, který také nachází dřívější verze smazaných assetů knihovny. Obnovení snímku vytvoří novou aktuální verzi a vybraný snímek ponechá. **Settings → Preferences → Storage** počítá výsledky a verze odděleně od odkladných cache.
- **Úklid.** Výslovné vyčištění dočasných souborů odstraní jen bajty vlastněné operací a bez odkazů. Aktuální záznamy chrání své soubory a nedávné soubory OPFS mají hodinovou lhůtu. Uložené výsledky a snímky assetů se automaticky nečistí.

Starší čtenáři obálku v2 stále přijímají (`minReader: 1`) a obnoví části, které znají, přičemž nepodporované části historie počítají jako přeskočené. Úplná obnova historie vyžaduje shell s adaptérem `fileHistory`, švem uvnitř shellu, ne novou schopností `HostV1` pro nástroje. Skutečná obnova na dvou zařízeních je pokryta místní bránou Chromium; obnova v nainstalovaných desktopových, iOS a Android aplikacích se musí ještě samostatně přijmout.
:::

## Reference

- Modul: `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION`; pojmenovávač `backupFilename()` je interní).
- Test smlouvy: `tests/data-transfer.test.ts`, pokrývající obousměrný průběh, sloučení, integritu, dopřednou kompatibilitu a bránu čtenáře.
- Testy smlouvy historie: `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts` a `tests/file-result-library.test.ts`. Přijetí v prohlížeči: `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts` a `tests/file-result-reuse.browser.test.ts`.
- Použitý povrch mostu: `host.profile`, `host.state` a `host.assets`; viz [Host API](/info/host-api.html).
