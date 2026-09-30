# Přenos dat - balíček `lolly-backup`

Vše, co uživatel Lolly nashromáždí, žije **na jeho zařízení** - žádný účet, žádný cloud. Balíček pro přenos dat je způsob, jak se tato hodnota přesouvá: exportuj ho na jedné instalaci, přenes soubor jakýmkoli způsobem (USB, AirDrop, e-mail sám sobě, síťové sdílení) a naimportuj ho na jiné. Soubor *je* přenos. Cíl může být offline nebo online. Nehraje to roli, protože nic nikdy nekomunikuje se serverem.

![Dvě tlačítka, která přesunou celou instalaci: Exportovat moje data zapíše jeden zip, Import data ho zase načte](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

Tato stránka je specifikace formátu. Návod pro koncového uživatele najdeš v [Najdi a obnov svou práci → Přenes svou práci do jiného zařízení](/info/find-your-work.html#move-your-work-to-another-device). Implementace je [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) a [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) fixuje kontrakt zpětné kompatibility (round-trip).

> **Rozsah.** Balíček nese *uživatelská data*, ne nástroje z katalogu. Nástroje a assety z katalogu se synchronizují zvlášť a předpokládá se, že na cílovém zařízení už jsou (v nejhorším případě ve vyšší verzi); nástroje, které si uživatel vytvořil sám, cestují uvnitř `profile.json`. Import nikdy nenainstaluje ani neaktualizuje nástroj z katalogu.

## Cíle

- <!--i:box--> **Jeden formát, každý shell.** Webová PWA, Tauri desktop/mobilní aplikace a budoucí shelly sdílejí stejnou obálku a podporovaná schémata částí. Volitelné části závisí na schopnostech daného shellu; nepodporované části se hlásí. Každý bridge schopností dodává vlastní adaptér úložiště.
- <!--i:shieldcheck--> **Přežije cestu.** Balíček poškozený nebo zkrácený při přenosu při importu hlasitě selže, nikdy se napůl neobnoví.
- <!--i:clock--> **Přežije tuto verzi.** Starší aplikace umí importovat i rozpoznané části novějšího balíčku. Skutečně nekompatibilní formát je čistě odmítnut.
- <!--i:check--> **Bezpečné sloučení.** Import do už používané instalace nikdy nesmaže nic, co v balíčku nebylo.

## Obálka

Balíček je obyčejný `.zip`. Stažený soubor je pojmenovaný podle osoby, které patří - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (například `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - takže složka se zálohami ve Stažených souborech zůstává přehledná. Části se jménem a příjmením pocházejí z profilu a při jejich absenci se vynechají. Bez profilu vznikne `LollyTools-2026-06-26-1.zip` a jen s křestním jménem `LollyTools-Ada-2026-06-26-1.zip`. Každá část se převede na token bezpečný pro název souboru (zachovají se unicode písmena a číslice, mezery a interpunkce se odstraní, maximálně 32 znaků). `<n>` je pořadové číslo pro daný den a dané zařízení, takže se opakované exporty ve stejný den nepřekrývají a zůstávají seřazené. Název sestavuje `backupFilename()` v [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts). Obsah zipu je stejný bez ohledu na název. Uvnitř:

| Cesta | Povinné | Obsah |
|---|---|---|
| `manifest.json` | ano | ID formátu, verze, počty a integrita jednotlivých částí. To první, na co se čtenář podívá. |
| `profile.json` | pokud je nastaveno | Celý uživatelův záznam `me`: jméno, kontakt, odkaz na fotografii a příznaky, plus složky, Koš, návrhy projektů, uživatelské šablony a uživatelem vytvořené nástroje, oblíbené, skryté nástroje, volba jazyka a emoji. Čte se přes `host.profile`. |
| `sessions.json` | ano | Každá uložená relace: slot, ID/verze nástroje, štítek, náhled (data-URL) a kompletní vstupní data. Čte se přes `host.state`. |
| `assets.json` | ano | Metadata pro každý nahraný asset (obrázky, fonty, brand tokeny, loga, uložené kopie stažení), každé odkazuje na svá data v `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | u každého assetu | Surová data assetu (obrázkové a fontové soubory). Uloženo nekomprimovaně (formáty jsou už zkomprimované). Přípona je jen kosmetická. Rozhodující je MIME v `assets.json`. |
| `assets/blobs/<n>.c2pa` | pokud je přítomné | Extrahované Content Credentials jako přesné binární bajty, na které odkazuje `_credentialFile` v záznamu assetu. Nejde o podepisovací klíče zařízení. |
| `design-systems.json` | pokud je přítomné | Design systémy vytvořené nebo přidané na této instalaci, jako `{ active, records }`. Při importu se sloučí podle ID; aktivní volba balíčku se použije, jen když cíl nemá vlastní design systém. |
| `file-history.json` | volitelné | Verzované snímky assetů, hlášení terminálových souborových operací a kompletní dávkové manifesty. Část historie má vlastní verzi; poskytuje ji interní záložní adaptér `fileHistory` daného shellu. |
| `revision-history.json` | volitelné, ruční zálohy | Stabilní ID výtvorů, zachované checkpointy, náhledy a průběžné návrhy pro obnovu. Poskytuje `host.state.history.backup` tam, kde je podporováno. |
| `file-history/versions/` | u každého snímku | Předchozí data assetu a extrahované credentials, bez ohledu na to, jestli aktuální asset ještě existuje. |
| `file-history/results/` | u každé dokončené operace | Přesná výstupní data. Žádný originální soubor vybraný ke konverzi se neuchovává ani nezahrnuje. |
| `prefs.json` | ano | Lokální preference vlastněné uživatelem: `theme`, `sidebarWidth` a počítadlo aktivity `ct-metrics`. |
| `lolly.txt` | ano | Čitelné shrnutí balíčku (počty, profil, název souboru) pro každého, kdo zip otevře bez Lolly. Znovu se generuje při každém exportu a při importu je rozpoznán, takže se nikdy nepočítá jako přeskočená část. Zapisuje se *po* mapě integrity, takže do ní není zahrnut. |

Balíček je záměrně obyčejný zip: přežije jakýkoli přenos neporušený a prohlédnout si ho umí libovolný nástroj na rozbalování.

`profile.json` je nejmenší část a ta, kterou uživatel v aplikaci vidí jako první: údaje, které producent vyplní jednou, plus opt-in, který nástrojům dovolí je použít.

![Formulář s podrobnostmi profilu, který se stává souborem profile.json: jméno, kontaktní údaje a profilová fotka](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=1100&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

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

Import je sloučení, nikdy nahrazení všeho:

- Existující data na cílovém zařízení zůstávají na místě.
- Když je slot relace nebo ID nahraného obrázku na obou stranách, zachová se kopie uložená později, takže starší záloha nikdy nepřepíše novější práci na cíli. Stejné nebo neznámé časy zachovají kopii cíle. Na webové instalaci s historií výtvorů rozhoduje stejné pravidlo o tom, která kopie výtvoru zůstane aktuální, a druhá kopie se zachová jako chráněný návrh (viz níže).
- Záznam profilu se sloučí, nenahradí se. Každá složka na cíli si zachová svůj obsah; složka z balíčku, kterou cíl nemá, se přidá, a složka na obou stranách si zachová název a nadřazenou složku cíle a získá členy z balíčku, které jí chybí. Relace zařazená do složky na cíli zůstává zařazená tam.
- Oblíbené (nástroje, assety katalogu a položky Projektů) se sloučí. Šablony, šablony Projektů a uživatelské nástroje z balíčku se přidají, když cíl nemá záznam s daným ID. Položky Koše z obou stran se zachovají, takže položka, kterou bylo možné obnovit na kterékoli instalaci, to pořád jde.
- Každé další pole profilu (jméno, kontaktní údaje, jazyk, feature flags, skryté nástroje a ostatní nastavení) si zachová hodnotu cíle. Pole, které je na cíli prázdné, převezme hodnotu z balíčku. Totéž platí pro `prefs.json`: předvolba se zapíše jen tam, kde ji cíl nemá.
- Výjimkou je běžná aplikace synchronizace zařízení: aby udržela zařízení v kroku, převezme záznam profilu, předvolby, relace a obrázky ze synchronizované kopie. Obnovení dřívější kopie dělá totéž, protože se úmyslně vrací v čase. První připojení, **Přenést to do tohoto zařízení**, se slučuje jako import.
- Historické verze assetů a ID operací jsou neměnné výjimky: opakovaný import je idempotentní a ID, které už pojmenovává jiná data nebo historii, se odmítne, nepřepíše se. Opakovaný import identického aktuálního assetu zachová jeho verzi. Změněný aktuální asset musí nést jinou verzi.
- Historie výtvorů se slučuje také. Výtvor na obou stranách zachová jako aktuální kopii uloženou později a druhou kopii jako chráněný návrh; výtvor, jehož slot cíl používá pro jiný výtvor, se přidá vedle něj; výtvor v Koši cíle tam zůstává. ID checkpointu, které na cíli pojmenovává jiný obsah, zachová to cílové. Archiv, který neprojde vlastními kontrolami, zastaví import ještě před jakoukoli změnou profilu, relace, assetu nebo předvolby. Identický opakovaný import nepřidá žádné úložiště.
- Nic, co v balíčku nebylo, se nedotkne. Relace, kterou cíl měl, ale balíček ne, import přežije.

Uložené relace se ke svým obrázkům automaticky znovu propojí: reference na assety se udržují podle ID a bridge je znovu přeloží poté, co jsou nahrané obrázky obnovené (musí tak jako tak, protože URL `blob:` nepřežijí obnovení stránky).

Souhrn importu hlásí `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`. `failedAssets` počítá nahrané assety, které se nepodařilo obnovit (například plné úložiště zařízení). To je odlišné od `skipped`, které počítá části od dopředu kompatibilního novějšího zapisovatele, jež tato verze nerozpoznala. UI zobrazuje `skipped` ("… · N novějších položek přeskočeno"), takže obnova je poctivá v tom, co nechala stranou.

Když je přítomná historie souborů, souhrn nese navíc `assetVersions`, `fileOperations` a `failedHistory`. Vyčerpání úložiště nebo konflikty neměnných ID mohou způsobit částečnou obnovu; UI řekne uživateli, aby si ponechal zdrojovou zálohu. Cloudová synchronizace **ne**posune svou aplikovanou revizi po částečné nebo nepodporované obnově, takže snímek zůstává dostupný pro opakovaný pokus. Obnova není jedna transakce napříč všemi úložišti profilu/relace/assetu/historie.

## Historie výtvorů (v3)

Ruční zálohy z webového hostitele schopného historie obsahují `revision-history.json` s vlastním schématem `{ version: 1, documents, revisions, recoveries }`. Nese zachovaná ID, kanonické snímky vstupů, verzová razítka, rastrové náhledy a samostatné návrhy editoru. Adaptér historie zachytí aktuální relace a jejich hlavy v jedné čtecí transakci; `sessions.json` používá stejné aktuální snímky pro starší čtenáře.

Obnova před potvrzením archivu v jedné transakci kontroluje SHA-256 a počty bajtů payloadu, unikátní identity, vztahy dokument/hlava, původ, časová razítka, typy náhledů a limity. Zkompaktované odkazy na rodiče mohou chybět. Existující aktuální práce se nikdy tiše nenahradí: když je výtvor na obou stranách, strana, která se nezachová jako aktuální, se stane chráněným návrhem. Limit přenosu archivu 384 MiB se kontroluje explicitně a limity úložiště se vynucují bez zkracování zachovaných checkpointů. Celá záloha stále používá in-memory implementaci ZIP a není to streamovaný archiv.

Souhrn přidává `revisions` a `recoveryDrafts`, které počítají jen to, co tento import přidal, a `added`, `kept`, `replaced`, `copies` a `hidden` pro to, jak se každý výtvor sloučil. Shell bez této schopnosti obnoví běžné relace a část historie nahlásí jako přeskočenou. Historie nativního souborového systému zůstává nepodporovaná, dokud její adaptér nedodá trvalé transakce historie. Stav P2P hosta nemá trvalou historii ani archiv pro obnovu.

Osobní synchronizace snímků výslovně vylučuje historii výtvorů. Aplikace snímku na lokální dokument nesoucí historii zachová jeho předchozí pracovní stav jako samostatný návrh pro obnovu a zneplatní zapisovací token každého otevřeného editoru. Jeho neměnné checkpointy zůstávají na zařízení. Tohle chrání lokální historii během nahrazení snímkem; neslučuje souběžné historie z různých zařízení.

Historické reference na assety se zachovávají, zatímco vykreslování pořád řeší assety přes existující knihovnu cíle. Tenhle archiv zatím nezaručuje přesná stará data assetu ani staré rendery nástroje. Data verze assetu a výsledku souboru nadále cestují přes svou existující samostatnou část zálohy.

## Uložené verze a výsledky souborů (v2)

Volitelná část historie obsahuje `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`; čtenáři akceptují i starší tvar history-v1 bez batchů. Každý snímek identifikuje stabilní ID assetu a přesnou verzi, čas uložení, délku v bajtech a hex SHA-256, plus záznam assetu, jehož `_file` a volitelný `_credentialFile` ukazují na binární části. Operace nesou původní fakta o souboru, požadavek, hlášení, časová razítka a volitelný výsledek `_file`; názvy úložných backendů, OPFS handly a exekuční leasy necestují. Starší čtenáři jen s history-v1 odmítnou novou verzi historie ještě před importem, místo aby tiše zahodili členství v batchi.

Dávkové manifesty zaznamenávají každý vybraný zdroj před zpracováním, včetně souborů nikdy nepřečtených, zrušených členů, selhání rezervace místa pro výsledek a přerušené práce. Každý člen má stabilní ID operace, referenci/fakta zdroje, požadovaný název výstupu a terminálové hlášení. Nepřečtený zdroj má deklarovaná fakta, ne vymyšlený digest. Import validuje identitu člena a konzistenci s neseným hlášením operace. Dávková hlášení zůstávají dostupná, i když byly jednotlivé výsledky výslovně odstraněny, ale potvrzenka neznamená, že jeho výstupní data jsou stále uložená.

- Každý známý záznam historie, hlášení a odkazovaný soubor se validuje před jakýmkoli zápisem importu profilu nebo assetu. Chybějící data a neshodující se SHA-256 selžou, i když obálka nemá mapu integrity. Extrahované credentials zůstávají poli bajtů, včetně importů od starších zapisovatelů, kteří je serializovali do JSON jako objekty s číselnými klíči.
- Běžící operace se v záloze stanou přerušenými záznamy, s vysvětlujícím hlášením o selhání a bez výsledku. Obnova nikdy neobnoví práci na pozadí ani neimportuje aktivní lease. Opakování vyžaduje výběr originálního souboru, ověřeného proti jeho zaznamenanému SHA-256, je-li dostupné.
- Obnovené výsledky zapíšou svá data a metadata společně v IndexedDB. Běžné nové výsledky používají OPFS, kde je dostupné, se záložním řešením IndexedDB. Existující živá operace se importem nikdy nenahradí.
- Skládání ZIP historie je pořád v paměti: aktuální limit je **256 MiB payloadu historie**, **4 MiB metadat historie**, nejvýše **100 operací**, **100 dávek** a **2000 snímků**. Export výslovně odmítne příliš velkou nebo neúplnou historii; nikdy ji tiše nevynechá. Stáhni si důležité verze/výsledky jednotlivě, než odstraníš starší lokální kopie. Tyto limity nejsou změřenou zárukou špičkové paměti pro telefony.
- Lokální historie výsledků má rozpočet 512 MiB a limit 100 záznamů. Snímky assetů mají samostatný rozpočet 512 MiB a nejvýše 20 historických verzí na asset; bajty extrahovaných credentials se počítají do tohoto rozpočtu snímků. Obnova tyto limity respektuje a nikdy tiše nevyřadí existující data uživatele.
- Lokální metadata dávek mají samostatný rozpočet 4 MiB, nejvýše 100 manifestů a 20 členů na dávku. Čekající členové rezervují kapacitu metadat, se stropem 32 KiB hlášení na člena. Je to logický rozpočet, ne záruka místa na disku prohlížeče; skutečné selhání kvóty se zobrazí a hlášení v paměti zůstává ke stažení. Opakování člena dávky vytvoří novou dávku bez přepsání starého hlášení. Odstranění záznamu dávky neodstraní jednotlivá data výsledku ani assety knihovny.
- Konvertované výsledky lze výslovně přidat do knihovny bez normalizace nebo přeenkódování. Asset doprovázejí hashe zdroje/výstupu a vztah operace. Opakovaná přidání znovu použijí nezměněnou kopii; upravená kopie se nikdy nepřepíše. Rastrové obrázky mohou začít nový dokument Design. Tenhle dokument používá aktuální ID assetu knihovny: vynucení přesných verzních pinů v celém běhovém prostředí a URL cestě Designu je pořád samostatná práce. Výsledky SVG/HTML/PDF/ZIP se tímto předáním uchovávají jako neprůhledné souborové assety, ne povýšené na důvěryhodný interaktivní/vektorový obsah.
- **Convert → Recent file operations** zobrazí využití historie, hlášení, stažení a správce verzí. Správce také najde dřívější verze smazaných assetů knihovny. Obnova snímku vytvoří novou aktuální verzi a přitom zachová vybraný snímek nedotčený. **Nastavení → Úložiště** účtuje výsledky a verze odděleně od zahoditelných cache.
- Explicitní úklid dočasných souborů odstraní jen data vlastněná operací, na která už nic neodkazuje. Aktuální záznamy chrání své soubory; nedávné OPFS soubory mají hodinovou ochrannou lhůtu. Uložené výsledky a snímky assetů se automaticky nečistí.

Starší čtenáři pořád akceptují obálku v2 (`minReader: 1`) a obnoví známé části, přičemž nepodporované části historie počítají jako přeskočené. Plná obnova historie vyžaduje shell s adaptérem `fileHistory`; je to interní šev shellu, ne nová schopnost `HostV1` viditelná pro nástroje. Skutečnou obnovu mezi dvěma zařízeními pokrývá lokální Chromium gate; akceptace obnovy na nainstalovaném Tauri/iOS/Androidu zůstává samostatná.

## Co necestuje

- **Katalogové cache** (stažená metadata a data assetů, index nástrojů) - na cíli se znovu synchronizují zdarma.
- **Nástroje a assety z katalogu** - mimo rozsah, předpokládá se, že na cíli už jsou. Brand tokeny, fonty a loga, které uživatel přidal, jsou uživatelské assety, takže cestují.
- **URL `blob:` / object URL** - bridge je při načtení znovu vygeneruje.
- **Originály konverzí, živé exekuční leasy a lokální přístupová/podepisovací tajemství stroje** - nejsou přenosný payload historie. Uložený výsledek je kopie, ne příslib, že originální zdroj měl zálohu.
- **Čítač pořadí exportů** - denní čítač pro pojmenovávání stažených souborů (klíč `localStorage` `lolly-export-seq`) je jen lokální pomůcka pro pojmenovávání. Je záměrně mimo `PREF_KEYS`, takže v balíčku nikdy nejede.

Ukazatel úložiště zobrazuje stejné rozdělení. Uložené relace, Moje obrázky a Výsledky a verze souborů jedou v balíčku. Cache assetů, náhledy nástrojů a offline piny pod nimi jsou vždy odvoditelné znovu, takže zůstávají mimo.

![Ukazatel úložiště rozdělující data tohoto zařízení do pojmenovaných kategorií, kde jsou Uložené relace a Moje obrázky sledovány odděleně od Cache assetů, zde na čerstvé instalaci, kde je zatím každá kategorie prázdná](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

## Záruka napříč shelly

`data-transfer.ts` čte a zapisuje výhradně přes bridge schopností (`host.profile`, `host.state`, `host.assets`) a sdílené preference v `localStorage`. Stejný modul čte a zapisuje společnou obálku na webu i v Tauri, přes IndexedDB nebo souborové úložiště. Volitelné části historie se objeví jen tam, kde je dostupný odpovídající adaptér; nepodporovaná část se při importu nahlásí jako přeskočená. Headless sada zkouší společné části proti in-memory bridge, zatímco transakce historie mají i testy ve skutečném prohlížeči.

Mimo tuto záruku stojí dva shelly, z různých důvodů:

- **Jednorázové CLI** nemá co nést - jeho stav je in-memory a existuje jen pro dobu jednoho spuštění.
- **TUI** stav skutečně udržuje (`~/.lolly`: relace, složky, profil) a jeho pohled Profile ho umí zálohovat, ale zapisuje *jednodušší* archiv vlastní konstrukce: `saved-state/<slot>.json` pro každou relaci plus `profile.json` a `folders.json`, bez manifestu, bez `formatVersion`/`minReader` a bez mapy integrity. **Není** importovatelný tímto formátem - čtenář ho odmítne jako „not a Lolly backup“ - a matoucím způsobem používá podobný název (`lolly-backup-<stamp>.zip`). Sjednocení obou je známá mezera.

## Rezervované body pro rozšíření

Obálka je záměrně navržena jako manifest plus sada pojmenovaných částí, aby na ní později mohly jet nové druhy přenosných dat **bez nekompatibilní změny**. Zapadnou jako aditivní části (nový `formatVersion`, stejný `minReader`) a dnešní čtenář to, co nerozpozná, přeskočí. Zatím nejsou postavené. Jejich názvy jsou zde rezervované, aby formát zůstal koherentní, až přistanou.

- **`tokens.json` - design tokeny.** Dokument s design tokeny podle [W3C DTCG](https://tr.designtokens.org/format/) (formát, který [Penpot importuje a exportuje](https://help.penpot.app/user-guide/design-systems/design-tokens/) - tokeny s `$value`/`$type`/`$description`, organizované do skupin, sad a témat). Sada tokenů v balíčku umožní uživateli přenést své brandové primitivy mezi instalacemi společně s relacemi. (Vlastní brand tokeny uživatele dnes už cestují jako asset `user/tokens/brand` v `assets.json`; tahle část by nesla celý dokument DTCG s jeho sadami a tématy.) Z dlouhodobého hlediska se z importované sady tokenů stane plnohodnotný zdroj, vůči kterému se řeší nástroje a paletové assety.
- **`penpot/` - importované soubory Penpot.** Rezervovaný adresář pro soubor Penpot (nebo jeho extrahovanou, pro Lolly relevantní podmnožinu) importovaný a zpřístupněný *jako nástroj*. Balíček ponese importovanou definici, takže bude cestovat spolu se zbytkem uživatelských dat.

Cokoli mimo tyto rezervované názvy a výše uvedené části je pro čtenáře neznámá část: ponechá se nedotčená a započítá se do `skipped`.

## Reference

- Modul: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - pojmenovávač `backupFilename()` je interní).
- Kontraktní test: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - případy round-trip, sloučení, integrity, dopředné kompatibility a bránění podle verze čtenáře.
- Kontraktní testy historie: [`tests/file-history-backup.test.ts`](../tests/file-history-backup.test.ts), [`tests/file-batch-history.test.ts`](../tests/file-batch-history.test.ts) a [`tests/file-result-library.test.ts`](../tests/file-result-library.test.ts). Akceptace v prohlížeči: [`tests/file-history.browser.test.ts`](../tests/file-history.browser.test.ts), [`tests/file-batch-history.browser.test.ts`](../tests/file-batch-history.browser.test.ts) a [`tests/file-result-reuse.browser.test.ts`](../tests/file-result-reuse.browser.test.ts).
- Použitý povrch bridge: `host.profile`, `host.state`, `host.assets` - viz [Host API](/info/host-api.html).
