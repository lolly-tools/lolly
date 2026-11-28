# Přenos dat: balík `lolly-backup`

Záložní balík přenáší osobní knihovnu, kterou Lolly uchovává na zařízení: exportuj ho z jedné instalace, přenes soubor (USB, AirDrop, e-mailem sobě nebo přes síťové sdílení) a importuj ho do jiné. Export ani import nepotřebují server a cílové zařízení může být offline.

Toto je specifikace formátu pro lidi, kteří vytvářejí prostředí, nástroje nebo skripty pro práci se zálohami. Pokud chceš přenést vlastní práci, přečti si [Přesuň svou práci na jiné zařízení](/info/find-your-work.html#move-your-work-to-another-device).

![Dvě tlačítka pro přesun celé instalace: Export my data zapíše jeden zip, Import data ho načte zpět](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

::: note Rozsah
Balík přenáší *uživatelská data*, nikoli nástroje katalogu. Nástroje a assety katalogu se synchronizují samostatně a předpokládá se, že jsou na cíli přítomné, v nejhorším případě ve vyšší verzi. Nástroje vytvořené uživatelem se přenášejí uvnitř `profile.json`. Import nikdy neinstaluje ani neaktualizuje nástroj katalogu.
:::

<!--i:eti-badge-check-->
## Cíle

- <!--i:box--> **Jeden formát, každé prostředí.** Webová aplikace, desktopové a mobilní aplikace i budoucí prostředí sdílejí stejný obal a schémata částí. Volitelné části závisejí na schopnostech jednotlivých prostředí a nepodporované části se hlásí. Každý most schopností poskytuje svůj adaptér úložiště.
- <!--i:shieldcheck--> **Přežije přenos.** Balík poškozený nebo zkrácený během přenosu při importu selže s chybou a nikdy se neobnoví jen napůl.
- <!--i:clock--> **Přežije tuto verzi.** Starší aplikace importuje části novějšího balíku, které rozpozná. Nekompatibilní formát se řádně odmítne.
- <!--i:check--> **Bezpečné sloučení.** Import do již používané instalace nikdy nesmaže nic, co nebylo v balíku.

<!--i:eti-package-->
## Obal

Balík je obyčejný `.zip`. Přežije jakýkoli přenos beze změny a jeho obsah může prozkoumat každý nástroj pro rozbalování zip.

Stažený soubor je pojmenovaný podle svého vlastníka: `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, například `LollyTools-Ada-Lovelace-2026-06-26-1.zip`. Jméno a příjmení pocházejí z profilu a pokud nejsou nastavené, vynechají se: bez profilu vznikne `LollyTools-2026-06-26-1.zip` a jen s křestním jménem `LollyTools-Ada-2026-06-26-1.zip`. Každé jméno se změní na token bezpečný pro název souboru (písmena a číslice Unicode zůstanou, mezery a interpunkce se odstraní, nejvýše 32 znaků). `<n>` je pořadové číslo pro daný den a zařízení, takže se opakované exporty v jednom dni nestřetnou a zachovají pořadí. Název sestavuje `backupFilename()` v `data-transfer.ts`. Název nemění obsah zip.

| Cesta | Povinné | Obsah |
|---|---|---|
| `manifest.json` | ano | Identifikátor formátu, verze, počty a integrita jednotlivých částí. Čtečka čte tento soubor jako první. |
| `profile.json` | pokud je nastavený | Záznam uživatele `me`: jméno, kontakt, odkaz na portrét a příznaky spolu se složkami, košem, předlohami projektů, uživatelskými šablonami a nástroji vytvořenými uživatelem, oblíbenými položkami, skrytými nástroji, jazykem a volbou emoji. Čte se přes `host.profile`. |
| `sessions.json` | ano | Každá uložená relace: slot, identifikátor a verze nástroje, popisek, náhled (datová URL) a úplná vstupní data. Čte se přes `host.state`. |
| `assets.json` | ano | Metadata každého nahraného assetu (obrázky, písma, tokeny značky, loga, uložené kopie stažených souborů), každé s odkazem na jeho bajty v `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | pro každý asset | Surové bajty assetu, uložené bez komprese, protože většina už používá komprimované formáty. Přípona je jen kosmetická; rozhodující je typ MIME v `assets.json`. |
| `assets/blobs/<n>.c2pa` | pokud je přítomný | Extrahované Content Credentials jako přesné binární bajty, na které odkazuje `_credentialFile` v záznamu assetu. Nejde o podpisové klíče zařízení. |
| `design-systems.json` | pokud je přítomný | Designové systémy vytvořené nebo přidané v této instalaci, jako `{ active, records }`. Viz [Pravidla importu](#import-rules). |
| `file-history.json` | volitelné | Verzované snímky assetů, zprávy dokončených souborových operací a úplné manifesty dávek, s vlastní verzí. Poskytuje je interní zálohovací adaptér `fileHistory` daného prostředí. |
| `revision-history.json` | volitelné, ruční zálohy | Stabilní identifikátory výtvorů, uchované kontrolní body, náhledy a průběžné koncepty pro obnovu. Poskytuje je `host.state.history.backup`, kde je podporováno. |
| `file-history/versions/` | pro každý snímek | Předchozí bajty assetů a extrahovaná pověření bez ohledu na to, zda aktuální asset ještě existuje. |
| `file-history/results/` | pro každou dokončenou operaci | Přesné výstupní bajty. Žádný původní soubor vybraný k převodu se neuchovává ani nezahrnuje. |
| `prefs.json` | ano | Místní předvolby patřící uživateli: `theme`, `sidebarWidth` a počitadlo aktivity `ct-metrics`. |
| `lolly.txt` | ano | Čitelné shrnutí balíku (počty, profil, název souboru) pro každého, kdo otevře zip bez Lolly. Při každém exportu se znovu generuje a při importu se rozpoznává, takže se nikdy nepočítá jako přeskočená část. Zapisuje se až po mapě integrity, takže mapa tento soubor nepokrývá. |

::: details Jak export zapisuje zip
Export zapisuje zip po jednotlivých částech (`shells/web/src/lib/zip-stream.ts`). Nahrané soubory, uložené výsledky a uložené verze assetů se čtou po blocích 4 MiB, nikdy celé. Uložené výsledky a verze se nejprve kontrolují proti svému zaznamenanému SHA-256. Každý soubor se pak přečte pro výpočet kontrolního součtu a otisku integrity a zip odkazuje na soubor na jeho místě.

Nic se znovu nekóduje. Každá část si zachovává přesné bajty a otisk, takže soubor obsahující Content Credentials zachovává bajty, které jeho podpis pokrývá. Pro stejné části a čas je zip totožný s výstupem dřívějšího zapisovače pracujícího v paměti, kromě toho, že soubor historie nad 16 MiB se komprimuje po částech. `tests/backup-streaming.test.ts` to kontroluje proti zaznamenaným referenčním otiskům.

U syntetické knihovny o velikosti 192 MiB, měřeno v Node, potřebovalo dokončení zálohy přibližně 125 až 150 MiB navíc ke knihovně oproti přibližně 850 MiB u zapisovače pracujícího v paměti (`node scripts/bench-backup-finalise.ts`). Import stále načítá celý zip do paměti.
:::

<!--i:eti-file-->
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
| `format` | Vždy `lolly-backup`. Soubor bez něj se odmítne jako „není záloha Lolly“. |
| `formatVersion` | Uspořádání, se kterým byl tento balík **zapsán**. Zvyšuje se při každé změně sady nebo struktury částí. Čtečky se podle tohoto pole **nerozhodují**. |
| `minReader` | Minimální verze čtečky, která může tento balík **bezpečně** importovat. Podle tohoto pole se čtečky rozhodují. |
| `app` | Identifikátor aplikace, která balík vytvořila, pro diagnostiku. |
| `exportedAt` | Časové razítko ISO vytvoření balíku. |
| `counts` | Co zapisovač vložil, pro zobrazení a kontroly smysluplnosti. |
| `integrity` | Volitelné. Mapuje každou část kromě `manifest.json` na otisk jejích **nekomprimovaných** bajtů ve stylu SRI `sha256-<base64>`. |

<!--i:eti-tag-->
## Pravidla verzování

Dvě čísla verzí umožňují formátu růst, aniž by vyřadil starší instalace.

![Změna formátu balíku je buď rozšiřující, kterou mohou staré čtečky ignorovat, nebo nekompatibilní, při které chybný import poškozuje data. Rozšiřující změna zvyšuje formatVersion a ponechává minReader; nekompatibilní zvyšuje formatVersion i minReader. Čtečka importuje, když je minReader nejvýše její vlastní verze.](/info/diagrams/concepts/backup-version-gate.svg)

- Čtečka importuje balík, když je `manifest.minReader` nejvýše její vlastní verze čtečky. Odmítne ho se zprávou „vyžaduje novější verzi aplikace“ jen tehdy, když balík požaduje novější čtečku.
- **Rozšiřující** změna, například nová volitelná část nebo nové volitelné pole manifestu, zvyšuje `formatVersion` a ponechává `minReader` beze změny. Starší aplikace stále importují každou část, kterou rozpoznají, a části, které nerozpoznají, se hlásí jako přeskočené, nikoli tiše zahozené.
- **Nekompatibilní** změna, při které chybný import části poškodí data nebo se volitelná část stane povinnou, zvyšuje `minReader`. Starší aplikace pak balík řádně odmítnou, místo aby importovaly něco, co neumějí zpracovat. Starší aplikace pak balík řádně odmítnou.
- Pokud budoucí balík nastaví `formatVersion`, ale vynechá `minReader`, čtečky se jako náhradním pravidlem řídí `formatVersion` a považují změnu za nekompatibilní.

::: note Orientační pravidlo pro autory
Pokud by každá existující čtečka stále postupovala správně, kdyby tvůj doplněk ignorovala, je změna rozšiřující: zvyš `formatVersion` a ponech `minReader`. Jinak zvyš `minReader`.
:::

<!--i:eti-shield-check-->
## Integrita

Když je přítomné `manifest.integrity`, čtečka kontroluje SHA-256 každé uvedené části **před jakýmkoli zápisem**. Neshoda („neprošla kontrolou integrity“) nebo chybějící část („neúplné“) zastaví import, takže nedojde k částečné obnově. To odhalí poškození při přenosu: zkrácený přenos přes AirDrop, e-mailovou bránu, která znovu zakódovala přílohu, vadný sektor USB.

Integrita se zajišťuje podle dostupných možností. Zapisuje se jen tam, kde je k dispozici Web Crypto (každý zabezpečený kontext prohlížeče a moderní Node), a kontroluje se jen tehdy, když jsou přítomné mapa i Web Crypto. Balík bez mapy, například z doby před zavedením integrity, se importuje beze změny: „nelze ověřit“ se nikdy nepovažuje za „poškozené“.

Manifest neuvádí ani sám sebe, ani znovu vygenerovaný `lolly.txt`.

<!--i:eti-download-->
## Pravidla importu

Import běží v jednom ze dvou režimů.

- **Merge** provádějí **Import data…** a první připojení k synchronizaci, **Bring it to this device**. Data na cíli zůstávají a nic mimo balík se nemění.
- **Replace** používá synchronizace zařízení k jejich udržení ve shodě. Přebírá záznam profilu, předvolby, relace, obrázky a volbu aktivního designového systému ze synchronizované kopie. Odstraňuje jen položky, které jiné zařízení smazalo od poslední synchronizace. Obnovení dřívější kopie nejprve uloží stav zařízení, pak uvede zařízení do shody s touto kopií a odstraní vše, co kopie neobsahuje. [Synchronizuj svá zařízení](/info/sync.html) popisuje, co vidí uživatel.

Sloučení zachází s jednotlivými druhy dat takto:

| Data | Již na cíli | Jen v balíku |
|---|---|---|
| Relace (podle slotu) a nahrané obrázky (podle identifikátoru) | Zachová se nověji uložená kopie, takže starší záloha nikdy nepřepíše novější práci. Při stejných nebo neznámých časech se zachová kopie cíle. | Přidají se |
| Složky | Zachová se název a nadřazená složka cíle a složka získá chybějící členy z balíku. Relace zařazená do složky na cíli v ní zůstane. | Přidají se |
| Oblíbené položky (nástroje, assety katalogu a položky Projects) | Sloučí se | Přidají se |
| Šablony, šablony Projects a uživatelské nástroje (podle identifikátoru) | Zachová se záznam cíle. | Přidají se |
| Položky koše | Zachová se položka cíle. | Přidají se, takže položku, kterou bylo možné obnovit v kterékoli instalaci, lze obnovit i nadále. Položka, jejíž složka se na cíli znovu používá nebo jejíž slot v koši cíl už používá, se vynechá. |
| Ostatní pole profilu (jméno, kontaktní údaje, jazyk, příznaky funkcí, skryté nástroje a další nastavení) | Zachová se hodnota cíle. | Převezmou se, pokud je pole cíle prázdné |
| Předvolby (`prefs.json`) | Zachová se hodnota cíle. | Zapíší se, pokud cíl žádné nemá |
| Designové systémy (podle identifikátoru) | Záznam z balíku nahradí záznam cíle. | Přidají se. Aktivní volba balíku se uplatní jen tehdy, když cíl nemá vlastní designový systém. |
| Historie výtvorů | Nověji uložená kopie zůstane aktuální a druhá se zachová jako chráněný koncept. | Přidá se |

**Uložené relace se automaticky znovu propojí se svými obrázky.** Odkazy na assety se uchovávají podle identifikátoru. Most je po obnovení obrázků znovu vyhodnotí, protože URL `blob:` nepřežijí opětovné načtení.

**Záznamy historie se po zápisu nikdy nemění.** Opakovaný import verzí assetů a identifikátorů operací nic nepřidává a identifikátor, který už označuje jiné bajty nebo historii, se odmítne a nepřepíše. Opětovný import totožného aktuálního assetu zachovává jeho verzi a změněný aktuální asset musí mít jinou verzi.

**Historie výtvorů má několik dalších pravidel.** Výtvor, jehož slot cíl používá pro jiný výtvor, se přidá jako samostatný výtvor a výtvor v koši cíle tam zůstane. U identifikátoru kontrolního bodu, který na cíli označuje jiný obsah, se zachová kontrolní bod cíle. Archiv, který neprojde vlastními kontrolami, zastaví import před jakoukoli změnou profilu, relace, assetu nebo předvolby a totožný opakovaný import nezabere další místo v úložišti.

**Shrnutí hlásí, co se stalo.** Každý import vrací `profile`, `sessions`, `userAssets`, `prefs`, `skipped` a `failedAssets`.

- `failedAssets` počítá nahrané assety, které se nepodařilo obnovit, například protože je úložiště zařízení plné.
- `skipped` počítá části z novějšího zapisovače, které toto sestavení nerozpoznalo. Aplikace ukazuje počet („… · N novějších položek přeskočeno“).
- S historií souborů přidává shrnutí `assetVersions`, `fileOperations`, `fileBatches` a `failedHistory`. Vyčerpání úložiště nebo konflikt neměnného identifikátoru může způsobit částečnou obnovu a aplikace pak uživateli řekne, aby si ponechal zdrojovou zálohu.
- S historií výtvorů přidává `revisions` a `recoveryDrafts`, které počítají jen to, co tento import přidal, a `added`, `kept`, `replaced`, `copies` a `hidden` podle toho, jak byl každý výtvor sloučen. `skippedCheckpoints` počítá kontrolní body, jejichž identifikátor na cíli označuje jiný obsah, a `historyLeftOut` počítá starší kontrolní body a koncepty, které se nevešly do prostoru pro historii na zařízení.
- Import s nahrazením přidává `removed` a `failedRemovals`.

Obnova není jediná transakce napříč úložišti profilu, relací, assetů a historie. Cloudová synchronizace po částečné nebo nepodporované obnově **neposune** svou použitou revizi, takže kopie zůstává k dispozici pro další pokus.

<!--i:eti-unlink-->
## Co se nepřenáší

- **Mezipaměti katalogu** (stažená metadata a bloby assetů, index nástrojů), které se na cílovém zařízení znovu synchronizují.
- **Nástroje a assety katalogu**, u kterých se předpokládá, že jsou na cílovém zařízení dostupné. Tokeny značky, písma a loga přidané uživatelem jsou uživatelské assety a přenášejí se.
- **`blob:` a objektové URL**, které most při načtení znovu vytvoří.
- **Originály pro převod, aktivní pronájmy pro běh operací a přístupové či podpisové tajné údaje uložené jen na daném zařízení.** Nejde o přenosnou historii. Uložený výsledek je kopie. Neznamená to, že byl zálohován původní zdroj.
- **Počítadlo pořadí exportů**, denní počítadlo pro pojmenování stahovaných souborů v `localStorage` (`lolly-export-seq`). Není zahrnuté v `PREF_KEYS`, takže se v balíčku nikdy nepřenáší.

Ukazatel úložiště používá stejné rozdělení. Saved sessions, My images a File results & versions se zahrnou do balíčku. Mezipaměť assetů, náhledy nástrojů a položky připnuté pro offline použití lze znovu vytvořit a zůstávají na zařízení.

![Ukazatel úložiště rozdělující data tohoto zařízení do pojmenovaných kategorií, se Saved sessions a My images sledovanými odděleně od Asset cache, zde v čerstvé instalaci, kde jsou všechny kategorie ještě prázdné](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

<!--i:eti-building-->
## Data organizace s Lolly Work

Tento balíček zálohuje osobní knihovnu zařízení. Balíček není zálohou instance **Lolly Work**. Účty organizace, přístupové politiky, sdílené projekty, verze katalogu, schválení, úlohy vykreslování a auditní záznamy uchovává tato služba. Znovu se připoj a přihlas, abys získal přístup ke sdílené práci. Import osobního balíčku ti tento přístup neudělí.

Provozovatelé zálohují, uchovávají a mažou serverová data podle vlastních průvodců Lolly Work: [Zálohování a obnova](/info/work-operations.html#backup-and-restore) a [Úložiště a životní cyklus dat Lolly Work](/info/work-data-lifecycle.html). Vymazání nebo export dat zařízení žádnou z těchto serverových operací neprovede.

<!--i:eti-monitor-->
## Napříč prostředími aplikace

`data-transfer.ts` čte a zapisuje jen přes most schopností (`host.profile`, `host.state`, `host.assets`) a sdílené předvolby v `localStorage`. Stejný modul čte a zapisuje společný obalový formát na webu i v desktopových a mobilních aplikacích, nad IndexedDB nebo souborovým úložištěm. Volitelné části historie se objeví jen tam, kde je dostupný jejich adaptér. Import označí nepodporovanou část jako přeskočenou. Sada testů bez grafického rozhraní ověřuje společné části proti mostu v paměti a transakce historie mají také testy ve skutečném prohlížeči.

Na dvě prostředí aplikace se tato záruka nevztahuje:

- **CLI pro jednorázové spuštění** nemá co přenášet: jeho stav je v paměti a trvá jedno spuštění.
- **TUI** uchovává stav v `~/.lolly` (relace, složky, profil). Jeho zobrazení Profile zapisuje vlastní jednodušší záložní archiv: `saved-state/<slot>.json` pro každou relaci a k tomu `profile.json` a `folders.json`, bez manifestu, bez `formatVersion` nebo `minReader` a bez mapy integrity. Čtečka tohoto formátu takový archiv odmítne jako „nejde o zálohu Lolly“, i když jsou názvy podobné (`lolly-backup-<stamp>.zip`). Sjednocení obou formátů je známý nedostatek.

<!--i:eti-clock-->
## Zatím nepřenosné

Nové druhy přenosných dat lze později přidat jako další části (nové `formatVersion`, stejné `minReader`). Designové systémy se už takto přenášejí, jako `design-systems.json` spolu se svými uživatelskými assety.

Dva názvy jsou vyhrazené pro data, která se zatím nepřenášejí:

- **`tokens.json`** by přenášel dokument designových tokenů [W3C DTCG](https://tr.designtokens.org/format/) s jeho skupinami, sadami a motivy, tedy formát, který [Penpot importuje a exportuje](https://help.penpot.app/user-guide/design-systems/design-tokens/). Vlastní tokeny značky uživatele se už přenášejí jako asset `user/tokens/brand` v `assets.json` a tokeny designového systému se přenášejí s jeho záznamem.
- **`penpot/`** je vyhrazený pro načtený soubor Penpot nebo jeho podmnožinu relevantní pro Lolly, zpřístupněnou jako nástroj.

<!--i:eti-history-->
## Části historie

Obě části historie jsou volitelné a mají vlastní verze.

::: details Historie tvorby (v3)
Ruční zálohy z webové instalace s historií tvorby obsahují `revision-history.json` s vlastním schématem `{ version: 1, documents, revisions, recoveries }`. Přenáší uchovaná ID, kanonické snímky vstupů, značky verzí, rastrové náhledy a samostatné koncepty zapisujících klientů. Adaptér historie zachytí aktuální relace a jejich nejnovější revize v jedné čtecí transakci a `sessions.json` používá stejné aktuální snímky pro starší čtečky.

Obnova před uložením archivu v jediné transakci kontroluje SHA-256 dat a počty bajtů, jedinečné identity, vztahy dokumentů a nejnovějších revizí, návaznost předků, časová razítka, typy náhledů a limity. Odkazy na předky odstraněné při zhušťování mohou chybět. Stávající aktuální práce se nikdy nenahradí bez upozornění: pokud je dílo na obou stranách, strana, která nezůstane aktuální, se stane chráněným konceptem.

Archiv má přenosový limit 384 MiB. Limity úložiště se vynucují bez zkracování uchovaných kontrolních bodů. Export zapisuje `revision-history.json` a `sessions.json` po částech se stejnými bajty, jaké by vytvořilo jediné `JSON.stringify`, takže text souboru nikdy není v paměti celý. Soubor historie, který překročí limit, se v tu chvíli zahodí a dále se už jen počítá jeho velikost. Archiv se pak vytvoří znovu bez nejstarších automatických kontrolních bodů a souhrn exportu je započítá jako `checkpointsLeftOut`, nebo je archiv odmítnut.

Prostředí aplikace bez této schopnosti obnoví běžné relace a označí část historie jako přeskočenou. Historie v nativním souborovém systému zůstává nepodporovaná, dokud její adaptér neposkytne trvalé transakce historie. Hosté v soukromé spolupráci nemají trvalou historii ani archiv pro obnovu.

Osobní synchronizace snímků vynechává historii tvorby. Použití snímku na místní dokument s historií uchová jeho předchozí pracovní stav jako samostatný koncept pro obnovu a zneplatní token pro zápis každého otevřeného editoru. Jeho neměnné kontrolní body zůstávají na zařízení. To chrání místní historii při nahrazení snímkem. Neslučuje to souběžné historie zařízení.

Historické odkazy na assety se uchovávají, ale vykreslování dál vyhledává assety ve stávající knihovně cílového zařízení. Tento archiv zatím nezaručuje přesné původní bajty assetů ani původní vykreslení nástrojů. Bajty verzí assetů a souborových výsledků se přenášejí ve vlastní části zálohy.
:::

::: details Uložené verze a souborové výsledky (v2)
Volitelná část historie obsahuje `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }` a čtečky přijímají i dřívější podobu history-v1 bez dávek. Každý snímek uvádí stabilní ID assetu a přesnou verzi, čas uložení, délku v bajtech a hexadecimální SHA-256 a také záznam assetu, jehož `_file` a volitelné `_credentialFile` odkazují na binární části. Operace přenášejí původní údaje o souboru, požadavek, zprávu, časová razítka a volitelný výsledek `_file`. Názvy úložných backendů, popisovače OPFS a pronájmy pro běh operací se nepřenášejí. Čtečky, které znají jen historii v1, odmítnou novou verzi historie před importem, takže příslušnost k dávce se nikdy nezahodí bez upozornění.

Manifesty dávek zaznamenávají každý vybraný zdroj před zpracováním, včetně souborů, které se nikdy nepřečetly, zrušených položek, selhání rezervace místa pro výsledek a přerušené práce. Každá položka má stabilní ID operace, odkaz na zdroj a údaje o něm, požadovaný název výstupu a závěrečnou zprávu. Nepřečtený zdroj má deklarované údaje, ne vymyšlený otisk. Import ověřuje identitu položky a soulad s případnou přenášenou zprávou o operaci. Zprávy Lolly Batch zůstávají dostupné i po odstranění jednotlivých výsledků, ale potvrzení neznamená, že bajty jeho výstupu jsou stále uložené.

- **Nejprve validace.** Každý známý záznam historie, zpráva a odkazovaný soubor se ověří před jakýmkoli zápisem importu profilu nebo assetů. Chybějící bajty a neshoda SHA-256 způsobí selhání i tehdy, když obalový formát nemá mapu integrity. Extrahované údaje o původu zůstávají poli bajtů, včetně importů ze starších zapisujících klientů, které je serializovaly jako objekty s číselnými klíči.
- **Běžící práce.** Běžící operace se v záloze stanou přerušenými záznamy se zprávou o selhání a bez výsledku. Obnova nikdy znovu nespustí práci na pozadí ani neimportuje aktivní pronájem. Opakování znamená znovu vybrat původní soubor a ověřit ho podle zaznamenaného SHA-256, pokud je dostupný.
- **Úložiště.** Obnovené výsledky ukládají své bajty a metadata společně do IndexedDB. Běžné nové výsledky používají OPFS, kde je dostupné, jinak IndexedDB. Import nikdy nenahradí stávající aktivní operaci.
- **Limity zálohy.** Export průběžně zapisuje tyto bajty do archivu, ale obnova stále rozbaluje celou zálohu v paměti, takže limity zůstávají: **256 MiB dat historie**, **4 MiB metadat historie**, nejvýše **100 operací**, **100 dávek** a **2 000 snímků**. Export výslovně odmítne příliš velkou nebo neúplnou historii a nikdy ji bez upozornění nevynechá. Před odstraněním starších místních kopií si důležité verze a výsledky stáhni jednotlivě. Tyto limity nejsou zárukou maximální spotřeby paměti změřené na telefonech.
- **Místní kapacity.** Místní historie výsledků má vyhrazených 512 MiB a limit 100 záznamů. Snímky assetů mají samostatných 512 MiB a nejvýše 20 historických verzí na asset a bajty extrahovaných údajů o původu se do této kapacity započítávají. Obnova tyto limity dodržuje a nikdy bez upozornění neodstraní stávající uživatelská data.
- **Metadata dávek.** Místní metadata dávek mají samostatných 4 MiB, nejvýše 100 manifestů a 20 položek na dávku. Čekající položky rezervují kapacitu metadat s limitem 32 KiB na zprávu každé položky. Jde o logickou kapacitu, ne záruku místa na disku v prohlížeči: skutečné překročení kvóty se zobrazí a zpráva v paměti zůstává ke stažení. Opakování položky dávky vytvoří novou dávku bez přepsání staré zprávy. Odstranění záznamu dávky neodstraní bajty jednotlivých výsledků ani assety knihovny.
- **Výsledky v knihovně.** Převedené výsledky lze přidat do knihovny bez normalizace nebo nového kódování, s připojenými hashi zdroje a výstupu a vazbou na operaci. Opakované přidání znovu použije nezměněnou kopii a upravená kopie se nikdy nepřepíše. Rastrové obrázky mohou založit nový dokument Lolly Design, který používá aktuální ID assetu knihovny. Vynucování přesně určených verzí v celém běhovém prostředí Lolly Design a při práci přes URL je samostatný úkol. Výsledky SVG, HTML, PDF a ZIP se uchovávají jako souborové assety bez interpretace obsahu, nepovyšují se na důvěryhodný interaktivní nebo vektorový obsah.
- **Kde to lidé najdou.** **Convert → Recent file operations** ukazuje využití historie, zprávy, stahování a správce verzí, který najde i starší verze odstraněných assetů knihovny. Obnova snímku vytvoří novou aktuální verzi a vybraný snímek uchová. **Settings → Preferences → Storage** počítá výsledky a verze odděleně od postradatelných mezipamětí.
- **Úklid.** Výslovně spuštěný úklid dočasných souborů odstraní jen bajty vlastněné operací, na které nic neodkazuje. Aktuální záznamy chrání své soubory a nedávné soubory OPFS mají hodinovou ochrannou lhůtu. Uložené výsledky a snímky assetů se automaticky nemažou.

Starší čtečky stále přijímají obalový formát v2 (`minReader: 1`) a obnoví části, které znají, přičemž nepodporované části historie započítají jako přeskočené. Úplná obnova historie vyžaduje prostředí aplikace s adaptérem `fileHistory`, rozhraním uvnitř tohoto prostředí, nikoli schopností `HostV1` přístupnou nástrojům. Skutečnou obnovu mezi dvěma zařízeními pokrývá místní povinná testovací kontrola v Chromium. Obnova v nainstalovaných desktopových aplikacích a aplikacích pro iOS a Android ještě vyžaduje samostatné akceptační ověření.
:::

<!--i:eti-code-->
## Reference

- Modul: `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION`; funkce pro pojmenování `backupFilename()` je interní).
- Test kontraktu: `tests/data-transfer.test.ts`, pokrývá export a zpětný import, slučování, integritu, dopřednou kompatibilitu a kontrolu verze čtečky.
- Testy kontraktu historie: `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts` a `tests/file-result-library.test.ts`. Akceptační testy v prohlížeči: `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts` a `tests/file-result-reuse.browser.test.ts`.
- Použitá rozhraní mostu: `host.profile`, `host.state` a `host.assets`; viz [Host API](/info/host-api.html).
