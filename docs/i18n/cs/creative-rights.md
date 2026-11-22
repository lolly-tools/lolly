# Práva tvůrců a údaje o autorství

Měl bys mít možnost používat dobrou práci jiných lidí, aniž by ses musel stát odborníkem na licence a aniž by se potichu vytratili lidé, kteří ji vytvořili. Lolly proto uchovává zdroj každého díla, které vykresluje, čte jeho zaznamenanou licenci, zjišťuje, co tato licence požaduje pro tvůj skutečný způsob použití, provádí část, kterou zvládne program, a říká ti, kterou část můžeš provést jen ty.

::: note Nic z toho není právní rada
Ani to není rozhodnutí o tvém projektu. Lolly zaznamenává fakta, uplatňuje malou sadu pravidel vycházejících přímo z právních textů licencí a ukazuje, jak k výsledku došla. Licence s podmínkami je běžná, povolená volba. Nikdy se neprezentuje jako vadný asset.
:::

<!--i:eti-smile-->
## Kde se s tím setkáš

Běžným příkladem jsou sady emoji. Twemoji má licenci CC BY 4.0, takže nadpis s emoji se exportuje s údaji o autorství zdrojové grafiky. Obě sady OpenMoji mají licenci CC BY-SA 4.0, takže přebarvení některého z jejich glyfů podle značky je úpravou díla a při sdílení této úpravy si musíš jednou zvolit kompatibilní licenci. Evidované jsou také Fluent (MIT), Noto a Blobmoji (oba Apache 2.0) a každá sada se vyhodnocuje podle své vlastní posouzené licence.

Výběr sady se nikdy neblokuje a ovládací prvek pro výběr ukazuje její licenci přímo na místě. Stejná pravidla platí pro ilustraci z katalogu, LUT, písmo i jakékoli jiné zaznamenané dílo.

<!--i:eti-layers-->
## Tři oddělená fakta

„CC BY 4.0“, „toto použití vyžaduje údaje o autorství“ a „údaje o autorství jsou v souboru, který sis právě stáhl“ jsou tři různá tvrzení a Lolly je odděluje:

- **Podklady** jsou to, co zdroj uvedl, zaznamenané v nalezené podobě spolu s tím, kdo to uvedl a kde to bylo přečteno. Pozdější import nikdy nepřepíše dřívější záznam.
- **Povinnost** je to, co z těchto podkladů vyvozují posouzená pravidla pro jedno použití, jednu cestu doručení a jedno publikum.
- **Doručení** je to, co hotové bajty skutečně obsahují, zjištěné jejich zpětným přečtením. Lolly říká, že údaje o autorství jsou zahrnuté, teprve když je čtecí modul najde v doručeném souboru.

![Zaznamenané podklady o zdroji a zvolené použití vstupují do posouzených pravidel. Export připraví údaje o autorství a kontrola doručení pak přečte hotové bajty a oznámí, které údaje našla a které ještě chybí.](/info/diagrams/concepts/rights-evidence-to-delivery.svg)

<!--i:eti-eye-->
## Co vidíš a co máš udělat

Stejné formulace se objevují v panelu exportu, Lolly Verify, příkazovém řádku i strojovém výsledku, přibližně v pořadí podle toho, jak často se s nimi setkáš.

| Co vidíš | Co to znamená |
|---|---|
| Údaje o autorství zdrojů budou zahrnuté. | Údaje o autorství jsou připravené a daná cesta je dokáže přenést. Zatím se nic nezapsalo, takže to není zpráva o úspěchu. |
| Údaje o autorství jsou zahrnuté v metadatech tohoto souboru. | Doručené bajty se zpětně přečetly, osvědčení se ověřilo a v osvědčení se našly všechny požadované zdroje. |
| Údaje o autorství a osvědčení jsou v balíčku ke stažení. | Údaje o autorství se přenášejí v doprovodném souboru s artefaktem. Při předávání je nech pohromadě. |
| Pokud tuto úpravu díla sdílíš, potřebuje kompatibilní licenci. | Zdroj s podmínkou ShareAlike byl změněn a výsledek směřuje k jinému než soukromému použití. Výběr je jeden úkon, ne dialog pro každé umístění. |
| Přidej tyto údaje o autorství do popisu příspěvku. | Zvolená cesta nepřenáší osvědčení ani čitelné údaje o autorství, takže jejich text musíš vložit ty. |
| Zaznamenané prohlášení CC0 nevyžaduje údaje o autorství. | Prohlášení nic nepožaduje. Přesto se nabízí dobrovolné uvedení autorství. |
| Licence zdroje není zaznamenaná. | Pro tento zdroj není nic zaznamenané. Je to mezera k doplnění, ne závěr v neprospěch díla. Nikdy to není důkaz, že lze dílo volně předávat dál. |
| Podmínky jsou zaznamenané, zatím bez výkladu. | Identifikátor je rozpoznaný a jeho podmínky jsou vypsané, ale žádné zdejší pravidlo je nevykládá. Žádné automatické povolení ani automatický zákaz. |
| Dvě licenční prohlášení si odporují. | Dva záznamy uvádějí různé licence a nic neurčilo, které udělené oprávnění platí. |
| Údaje o autorství nejsou v doručeném souboru. | Údaje o autorství byly přislíbené, zpětné čtení je nenašlo a soubor je stále tvůj. Exportuj znovu nebo vlož text s údaji o autorství ručně. |

Lolly ti nikdy neříká, že dílo není zatížené právními nároky nebo že je jeho použití právně bezpečné, a nikde v produktu není jediný zelený odznak licence. Žádný program nedokáže ověřit ani jednu z těchto věcí.

<!--i:eti-user-check-->
## Co zůstává na tobě

- **Licenci si vybíráš ty.** Přihlášení se k autorství souboru odděluje tři stavy, které dříve splývaly: žádnou deklarovanou veřejnou licenci, výslovné oznámení o vyhrazení všech práv a skutečné udělení veřejné licence. Lolly zapisuje řádek o právech jen pro poslední dva stavy a nikdy ho neodvozuje z tvého profilu.
- **Licence tvé práce se nemění za tebe.** Podmínky zdroje a tvé vlastní prohlášení o výstupu jsou oddělené záznamy. Podmínka ShareAlike platí pro úpravu díla, kterou upravuje, ne automaticky pro všechno ostatní, co jsi vytvořil.
- **Soukromá práce zůstává použitelná.** Podmínky platné při sdílení se řeší, až když přichází v úvahu sdílení. Nic z toho se nestává zákazem importu a mezi tebou a tvými soubory nestojí žádný licenční dotazník.
- **Rozhodnutí se pamatuje spolu s fakty, kterých se týká.** Každá volba, kterou zaznamenáš, dostane otisk děl, použití, cesty a publika, kterých se týkala. Změň sadu, úpravu, formát nebo publikum a otázka se položí znovu. Neexistuje plošný přepínač „ignorovat licence“, protože odkliknutí varování nedokáže doručit údaje o autorství ani udělit oprávnění.
- **Tvé údaje zůstávají oddělené od údajů o autorství třetí strany.** Odstraněním svých osobních metadat neodstraníš uvedeného umělce a povinné údaje o autorství nikdy nejsou záminkou k exportu tvých kontaktních údajů.

<!--i:eti-map-pin-->
## Co Lolly dělá na jednotlivých místech

- **V katalogu.** Karta díla ukazuje jeho zdroj a tvůrce, kanonický název licence s původním označením pod ním, kopírovatelné údaje o autorství, pokud jsou zaznamenané, a jeden řádek s požadavky na použití. Dlaždice uvádí požadavek; nikdy netvrdí, že export byl dokončen.
- **V panelu exportu.** Jakmile vykreslení použije zaznamenané dílo, v sekci Content protection se objeví karta Source credits vedle Licence, kterou vybíráš pro svůj vlastní export. Ukazuje stav, text s údaji o autorství pod Details, tlačítko Copy credit a vloženou kartu, když zbývá rozhodnutí. Rozhodnutí nikdy nemá podobu blokujícího dialogu: stahování pokračuje i s nevyřízeným úkonem.
- **V souboru.** Export, který umístil zaznamenané dílo, zapíše pro každé odlišné dílo jednu zdrojovou složku Content Credentials, navázanou na původní bajty na jejich veřejné adrese, s tvůrcem, licencí a odkazem na ni, zdrojem, revizí a změnami. Lolly podepisuje to, co zjistila. Nikdy nepodepisuje tvrzení jménem původního umělce a Lolly Verify říká, která z těchto dvou možností nastala.
- **V balíčku.** Stahovaný soubor, který nemůže obsahovat osvědčení, například animace `.lottie`, nese údaje o autorství v souborech `CREDITS.txt` a `credits.json` uvnitř balíčku. Ty se po zápisu zpětně přečtou a netvrdí se o nich, že obsahují podepsané osvědčení.
- **Po zápisu.** Doručené bajty se zpětně přečtou, než cokoli oznámí, že údaje o autorství jsou zahrnuté. Osvědčení, které neprošlo ověřením, se nepočítá jako doručené údaje o autorství.
- **V upravitelném souboru `.lolly`.** Bajty se přenášejí, pokud posouzená licence zaznamenává oprávnění předat zdroj dál, pokud řádek obsahuje vlastní podmínky jeho vlastníka nebo pokud o právech k dílu není zaznamenané vůbec nic: žádná licence, žádný záznam o právech ani uvedení autorství. V posledním případě odesílatel vidí, která díla se přenášejí bez zaznamenané licence, a `CREDITS.txt` žádá každého, kdo soubor otevře, aby před opětovným použitím ověřil jejich podmínky. Zaznamenaná licence, která zatím nemá výklad, vede k zadržení díla. Stejně tak se zadrží dílo se zaznamenaným nositelem práv bez licence nebo dílo, jehož záznam v katalogu se nepodařilo přečíst. Zadržený obsah stále můžeš vědomě zahrnout a soubor s údaji o autorství zaznamená, že to byla tvá volba. Soubor `CREDITS.txt` v balíčku vypisuje, co se přeneslo, pod jakou licencí a co se zadrželo a proč.
- **V Lolly Verify.** Panel Sources vypisuje každý zdroj zaznamenaný v souboru spolu s vypočítaným souhrnem, údaji o autorství, tlačítkem Copy credit, odkazem Open source, který se otevře jen na tvou žádost, a uvedenými mezemi kontroly. Otázka Check for this use se objeví, jen když vybereš použití, a kvůli odpovědi se nic nestahuje.
- **Při odstraňování metadat.** Odstranění ti sdělí, o kolik údajů o autorství zdrojů soubor přichází, nabídne jejich text a čistý soubor s údaji o autorství v samostatném souboru. Bajty zbavené metadat se nikdy znovu neopatřují razítkem.

**Vlastní značky vlastníka.** Vlastník málokdy poskytuje logo pod otevřenou licencí. Řádek, jehož záznam o právech uvádí `own-work` spolu s vlastníkem a podmínkami, se může přenášet v souboru `.lolly` a na [stránce značky](/info/brand-page.html#publish-your-own-marks). Přenáší se s označením „Zveřejněno vlastníkem, nejde o otevřenou licenci“ a s podmínkami vedle souboru. Vychází to z údajů katalogu. Lolly neověřuje, kdo značku vlastní. Záznam bez vlastníka, s prázdnými podmínkami nebo bez prohlášení zůstává zadržený, stejně jako cizí značka bez takového záznamu.

::: details Licence, které Lolly posoudila
Verze pravidel `rights-rules-2026-11-05.1`. Každé pravidlo vychází přímo z právního textu licence a jeho zdrojové ustanovení je citované zde i vedle pravidla v `engine/src/rights-profiles.ts`. Verze a jurisdikční varianta se zachovávají tak, jak byly zaznamenané: prohlášení CC BY 3.0 si ponechá svou verzi a neuvádí se jako 4.0 jen proto, že výběr v aplikaci upřednostňuje 4.0.

| Licence | Co požaduje při použití, které Lolly umožňuje | Zdroj |
|---|---|---|
| CC BY 4.0 | Tvůrce, název, oznámení o autorských právech, název licence a odkaz na ni, odkaz na zdroj a uvedení změn, vždy pokud zdroj příslušný údaj poskytl. Žádné použití není vyloučené, včetně komerčního. | [Právní text](https://creativecommons.org/licenses/by/4.0/legalcode.en), ustanovení 2(a)(1) a 3(a) |
| CC BY-SA 4.0 | Stejné údaje o autorství. Navíc, pokud sdílíš úpravu díla, musí být pod kompatibilní licencí: CC BY-SA 4.0, Free Art License 1.3 nebo GPL-3.0-or-later, u níž kompatibilita platí jen jedním směrem. Tyto tři možnosti se přebírají jako data ze seznamu Creative Commons, nikdy se nepřiřazují podle názvu. | [Právní text](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en), ustanovení 3(a) a 3(b); [seznam kompatibilních licencí](https://creativecommons.org/compatible-licenses/) |
| CC0 1.0 | Nic. Prohlášení neobsahuje žádnou podmínku, takže Lolly nabízí dobrovolné uvedení autorství a nikdy ho neprezentuje jako povinné. | [Prohlášení](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en), ustanovení 2 a 3; [CC FAQ](https://creativecommons.org/faq/) k uvádění autorství |
| CC-PDDC | Nic. Zaznamenává se samotné tvrzení a to, kdo ho učinil, protože potvrzení je prohlášením jedné strany, nikoli důkazem. | Odstavce [prohlášení a potvrzení](https://creativecommons.org/licenses/publicdomain/) |
| Apache License 2.0 | Oznámení ze zdroje a text s údaji o autorství ze souboru NOTICE se přenášejí s distribuovaným dílem. Použití za běhu nic nevyžaduje. Licence vyžadující text oznámení u díla, které žádný neobsahuje, se hlásí jako mezera. | [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0), ustanovení 4, podmínky 1 až 4 |
| MIT | Řádek o autorských právech a oznámení o udělení oprávnění se přenášejí s kopiemi a podstatnými částmi. Použití za běhu a odkazování nic nevyžadují. | [MIT](https://opensource.org/license/mit), podmínka oznámení o udělení oprávnění |
| ISC | Totéž co MIT, stručněji: řádek o autorských právech a oznámení o udělení oprávnění se přenášejí s kopiemi. Použití za běhu a odkazování nic nevyžadují. | [ISC](https://opensource.org/license/isc-license-txt), podmínka oznámení o udělení oprávnění |
| SIL OFL 1.1 | Vykreslování textu tímto písmem na text neklade žádné požadavky. Předávání souboru písma zahrnuje licenci, oznámení o autorských právech a pravidlo vyhrazeného názvu. | [OFL 1.1](https://openfontlicense.org/open-font-license-official-text/), podmínky 2, 3 a 5; [OFL FAQ](https://openfontlicense.org/ofl-faq/) k dokumentům |

**Zaznamenané, bez výkladu.** CC BY-NC, CC BY-ND a kombinace NC-SA a NC-ND se rozpoznávají a jejich podmínky se vypisují, ale žádné zdejší pravidlo je nevykládá. Hlásí `licence.unknown` s řádkem uvádějícím podmínky. Komerční kontext nelze vyčíst z ceny ani účtu a každý kombinovaný text potřebuje vlastní posouzení, než ho pravidlo začne vykládat.

Další tři poctivé odpovědi, z nichž žádná není oprávněním:

- Identifikátor `LicenseRef-` se vrací beze změny. Odkazuje na uloženou definici a jeho zápis z něj nikdy nedělá proprietární licenci.
- Prohlášení, které nic nerozpozná, se vrací bez rozboru a původní text se zachovává.
- `A OR B` je volba nabídnutá nositelem práv, takže se vracejí všechny alternativy a žádná se nevybírá. `A AND B` znamená souběžné podmínky a tato pravidla ho zaznamenávají, místo aby vykládala dva profily společně.
:::

::: details Na příkazovém řádku a přes MCP
Vykreslení vypíše blok `Rights:` na standardní chybový výstup, pokud vyhodnocení obsahuje povinné údaje o autorství nebo problém. Obsahuje stav, jeden řádek pro každý problém ve formátu `code - summary`, výsledek zpětného přečtení doručeného souboru a text s údaji o autorství k vložení.

```
Rights: actions-required
  licence.adaptation-choice - If you share this adaptation, it needs a compatible licence.
  Credential intact. It records 1 source. The exporter recorded it; the source did not sign a credential of its own.
  Credits included in this file's metadata.
  "water wave (OpenMoji Color 17.0.0)" by Vanessa Boutzikoudi (OpenMoji), CC BY-SA 4.0 https://creativecommons.org/licenses/by-sa/4.0/, source https://raw.githubusercontent.com/hfg-gmuend/openmoji/f9fc506a3f913be9897ab0181d611d4c910a4104/color/svg/1F30A.svg, changes: recoloured.
```

Zde jsou údaje o autorství v souboru a před jeho sdílením ještě zbývá rozhodnout o licenci.

| Stav | Význam | Návratový kód |
|---|---|---|
| `ready` | Nic nečeká na člověka. | 0 |
| `actions-required` | Před sdílením souboru zbývá rozhodnutí. Soubor se přesto zapíše. | 4 |
| `use-not-covered` | Posouzené pravidlo říká, že licence toto použití nepokrývá. | 4 |
| `unknown` | Jedinými problémy jsou mezery: nezaznamenaná licence nebo podmínky bez výkladu. | 0 |
| `delivery-failed` | Nastavuje ho potvrzení, nikdy vyhodnocení: přislíbené údaje o autorství se v doručených bajtech nenašly. Panel exportu ho zobrazuje; CLI místo toho hlásí stejný fakt v řádku zpětného čtení. | nevypisuje se |

Návratový kód 4 už toto CLI používá, když ochranná kontrola něco odmítne. Není to 3, což znamená „zkus znovu na jiném vykonavateli“, protože rozhodnutí o licenci bude čekat na každém vykonavateli.

`--rights=private` uvádí, že se toto vykreslení nikomu nedoručuje. Blok se stále vypisuje a údaje o autorství jsou stále k dispozici ke zkopírování; neuplatní se podmínka platná při sdílení a nezaznamenává se žádné tvrzení o doručení. Přepínač pro ignorování podmínky neexistuje: `--rights=ignore` je chyba použití.

Kódy problémů jsou stabilní a strojově čitelné, nezávisle na přeloženém textu: `attribution.source-missing`, `attribution.delivery-missing`, `licence.adaptation-choice`, `licence.use-not-covered`, `licence.grant-conflict`, `licence.unknown`, `source.redistribution-unknown`, `credential.ingredient-missing`.

Přes MCP vrací `lolly_verify` data `rights` se souhrnem, jedním řádkem pro každý zaznamenaný zdroj a uvedenými mezemi. `lolly_render` bez prohlížeče vrací `status`, `issues`, `credits`, `fingerprint` a příznak `creditsInFile` zjištěný zpětným přečtením bajtů.
:::

::: details Kde jsou pravidla
Pět modulů enginu, všechny čisté: žádná síť, žádné hodiny, žádný souborový systém. Data pravidel jsou verzovaná a uložená v repozitáři, nikdy se nestahují.

| Modul | Co obsahuje |
|---|---|
| `engine/src/rights-profiles.ts` | Tabulku identifikátorů, minimální čtečku výrazů SPDX, posouzené profily s citacemi a jediné pravidlo pro odkaz, který se smí uvést v údajích o autorství. |
| `engine/src/rights-evaluate.ts` | Klasifikaci, problémy, plán uvedení autorství a otisk. Deterministické: stejná fakta v jiném pořadí dávají stejnou odpověď. |
| `engine/src/rights-attribution.ts` | Čitelné údaje o autorství, doprovodné soubory, zdrojové složky a potvrzení zjištěné po zápisu. |
| `engine/src/rights-companion.ts` | Zpětné čtení údajů o autorství v balíčku (`CREDITS.txt` a `credits.json` uvnitř stahovaného balíčku ZIP), které údaje potvrzuje, aniž by tvrdilo, že jde o podepsané osvědčení. |
| `engine/src/rights-report.ts` | Ověřené osvědčení zpětně přečtené jako tři otázky, které pokládá Lolly Verify. |

Soubory očekávaných výsledků v `tests/fixtures/rights/` byly napsané podle textů licencí, nikoli podle výstupu vyhodnocovače, a jejich README cituje ustanovení, ze kterého vychází každý očekávaný výsledek.
:::

<!--i:eti-hammer-->
## Co to zatím neumí

- **Žádný cíl není potvrzený.** Lolly připraví popisek. Přijetí požadavku konektorem není důkazem, že se údaje o autorství dostaly ke čtenáři, a nic zde neslibuje, že pozdější nahrání, snímek obrazovky nebo překódování zachová skrytá metadata.
- **Nativní pole metadat pro údaje o autorství se z plánu nevyplňují.** Údaje o autorství se přenášejí v Content Credentials a v čitelném textu. Pole IPTC a XMP pro údaje o autorství jednotlivých zdrojů se zatím z plánu uvedení autorství nevyplňují.
- **Opravy a stažení záznamu nejsou implementované.** Přidání chybějícího tvůrce nebo místní opravy k zaznamenanému dílu ani stažení záznamu nemá rozhraní.
- **Připojení poskytovatelé nejsou implementovaní.** Zakoupený obsah z fotobank, individuální oprávnění ani účet poskytovatele nemají cestu importu, takže jejich oprávnění lze zaznamenat jen jako tvé vlastní prohlášení.
- **Zásady organizace se s těmito výsledky nekombinují.** Zásady exportu a licenční podmínky jsou dnes oddělené a schválení organizací není oprávněním od nositele práv.
- **Několik cest doručení zatím tento postup nepoužívá.** Stažení originálu z katalogu, hromadný ZIP, Send a Copy image zatím tyto údaje o autorství nevyhodnocují ani nepřenášejí. Ořez, barevná korekce, kopie s rámečkem, převod pomocí Download as a úprava videa ano: zdroj se zaznamenanou licencí a bez vlastních Content Credentials se přenáší jako nepodepsaná zdrojová složka s údaji o autorství, LUT se uvádí pod svou vlastní licencí a nikdy pod licencí obrázku a soubor, který nedokáže nést údaje o autorství požadované zdrojem, se neuloží. Tyto soubory zatím nic zpětně nečte, takže údaje o autorství jsou zapsané, nikoli potvrzené. Retouch, odstranění pozadí a zvýšení rozlišení jednotlivého obrázku a extrakce zvuku zachovávají jen vlastní osvědčení zdroje.
