# Otázky & odpovědi

Často kladené otázky, vykreslované jako rozbalovací seznam na `/info/start/faq.html`.

**Jak udržovat:** každý nadpis `##` níže je otázka. Vše pod nadpisem
až po další `##` je odpověď. Odpovědi používají jednoduchý Markdown tohoto webu:
odstavce odděluj prázdným řádkem. Zde přidávej, odebírej nebo přeřazuj otázky a
znovu spusť `pnpm run build:info` (nebo `pnpm run dev:web`).
Sestavení ignoruje vše nad prvním `##` (tento název a tyto poznámky).

Pořadí odpovídá potřebám nováčka: nejdřív háček, pak tvé soubory, pak získání
a spuštění Lolly, potom organizace a nakonec způsob vzniku. Kotva každé otázky
vzniká z anglické otázky na stejné pozici, takže překlad zachovává
anglické pořadí.

## Proč je to zdarma? V čem je háček?

**Lolly jsme vytvořili pro sebe.** SUSE potřebovalo tisíce souborů v souladu se značkou, vytvořených bez předávání čehokoli externím službám. Proto jsme vytvořili nástroj, který vše dělá na zařízení, a vydali ho jako open source, stejně jako vše ostatní, co vytváříme. Udržujeme ho dál, protože ho používáme každý den. **Žádný závazek nevzniká:** všechno tady funguje s námi i bez nás.

Tuto hranici stanoví licence, ne slib: cokoli běží místně, je zdarma navždy. Vydaná verze má licenci, kterou nelze vzít zpět. Žádná přispěvatelská smlouva by nemohla změnit licenci něčí práce.

## Co všechno si SUSE nechává neveřejné? (aneb kdy přijde podraz)

Engine, aplikační obaly, schémata a nástroje nezávislé na značce jsou open source. Ochranné známky SUSE a značkové nástroje zůstávají neveřejné a jsou už oddělené. Veřejná instance na [lolly.tools](https://lolly.tools) používá [Lolly Demo](/info/lolly-demo.html), vlastní designový systém Lolly.

Nic tady nestojí na slibu: každá vydaná verze zůstává open source. Když jiná společnost v roce 2023 uzavřela zdrojové kódy svého podnikového Linuxu, SUSE spoluzaložilo [OpenELA](https://openela.org), aby tento kód zůstal otevřený. Tento projekt přebírá stejný postoj.

SUSE *opravdu* vytváří interní nástroje pro propojení Lolly s vlastními IT systémy. To je interní nastavení SUSE, ne rozdělení na veřejný a neveřejný vývoj. Lolly také směřuje k sestavování prostřednictvím [Open Build Service](https://openbuildservice.org/), s bezpečnými artefakty dodavatelského řetězce dodávanými přes [SUSE Application Collection](https://apps.rancher.io/applications).

## Proč název „Lolly Tools“?

**Lolly**, protože svoboda je sladká a protože v Austrálii, na Novém Zélandu a v Británii znamená lolly sladkost.

**Tools**, protože nástroj zůstává v klidu, dokud ho nevezmeš do ruky. Neběží, když ho nepoužíváš, a nesleduje tě, když ho používáš.

## Proč je všechno zelené?

lolly.tools se otevírá v [Lolly Demo](/info/lolly-demo.html), vlastním ukázkovém designovém systému Lolly, jehož hlavní barva je zelená. Přepni na **Lolly Starter**, prázdný designový systém, nebo na svůj vlastní v [Settings → Design systems](/#/settings?focus=design-systems-section).

## Můžu použít vlastní značku?

Ano. **Lolly Design System Setup** (`#/start`) vytvoří designový systém z jedné barvy, souboru designových tokenů nebo hotového návrhu. Každý nástroj pak kreslí s tvým designovým systémem. [Začátek](/info/quickstart.html#put-your-brand-in) provází všemi třemi cestami.

Designový systém, který dodává tvá organizace nebo tvé sestavení, je spravovaný. Zobrazuje zámek a zůstává jen pro čtení. Chceš-li ho změnit, vytvoř upravitelnou kopii.

## Kde je to, co jsem včera vytvořil?

Pokud jsi stiskl **Save as** nebo **Save**, tvá práce je v **Projects** na domovské obrazovce, v prohlížeči nebo aplikaci, ze které jsi ukládal. Pokud jsi stiskl pouze **Download**, soubor je ve stažených souborech prohlížeče nebo systému a kopie je obvykle v **Assets**. Nástroje, které [ukládají při práci](/info/find-your-work.html#which-tools-save-as-you-work), uchovávají v **Projects** i neuloženou práci. [Najdi a obnov svou práci](/info/find-your-work.html) pokrývá každý případ.

## Zavřel jsem kartu. Je moje práce pryč?

Uložená práce je stále v **Projects**. Neuložená práce je pryč, s výjimkou nástrojů, které ukládají při práci a uchovávají ji také v **Projects**. Příště před odchodem stiskni **Save as**. Viz [Pokud jsi zavřel kartu nebo opustil nástroj](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## Můžu svou práci sdílet jako soubor místo odkazu?

Ano. Když odkaz nemůže přenést všechno, například tvé vlastní fotky nebo dlouhý text, dialog Share uvede, co by chybělo, a nabídne soubor **.lolly**. Tento jediný soubor obsahuje návrh, použité obrázky a pokud se tak rozhodneš, i nástroj.

Rozhoduješ, kolik se toho přenese. Tvé jméno a údaje se přidají jen tehdy, když to ve svém profilu povolíš. Licencovaná grafika se vynechá, pokud se nerozhodneš ji přidat. Kdokoli otevře soubor obsahující nástroj, dostane před jeho spuštěním otázku, zda nástroji důvěřuje. Viz [Sdílení práce](/info/using.html#sharing-your-work).

## K čemu slouží údaje v mém profilu?

Tvé údaje v **Settings** předvyplní nástroje, které je vyžadují, například jméno na odznaku. Zůstávají na tomto zařízení. Nic se nepřidá do toho, co vytvoříš, dokud to výslovně nepovolíš. Pak se vybrané údaje zapečetí do výstupu a označí tě jako zdroj.

Sdílení a Sync odesílají pouze obsah, který vybereš. Na instanci Lolly Work organizace se sdílené relace a práce podléhající jejím pravidlům odesílají i na tento server. Viz [Soukromí](/info/privacy.html).

## Jak získám mobilní nebo desktopové aplikace?

Stáhni je ze stránky [Instalace Lolly](/info/install.html). Stránka uvádí všechna sestavení pro macOS, Windows, Linux a Android a ukazuje, jak zkontrolovat stažený soubor. iPhone a iPad získají **Lolly Tools** z App Store. Odkaz je v [části pro iPhone a iPad](/info/install.html#iphone-and-ipad).

Kdokoli také může sestavit a distribuovat vlastní kopii aplikace s nástroji a nastaveními, které jeho uživatelé potřebují. [Průvodce sestavením](/info/build-guide.html) ukazuje jak.

## Lolly hlásí, že vyžaduje WebGPU. Co můžu udělat?

Webová aplikace kreslí pomocí WebGPU, grafické funkce současných prohlížečů, a před otevřením nástroje kontroluje dostupnost WebGPU. Zkus postupně toto:

1. Aktualizuj prohlížeč na aktuální verzi.
2. Zapni grafickou nebo hardwarovou akceleraci v nastavení prohlížeče a pak prohlížeč restartuj.
3. Zkus otestovaný prohlížeč: [Podporovaná prostředí](/info/supported-environments.html) je uvádějí.
4. Na Macu, iPhonu nebo iPadu místo toho [nainstaluj aplikaci](/info/install.html).

## Může Lolly upravovat a vykreslovat mé soubory Figma, Penpot, Illustrator nebo InDesign?

Ano. Otevři nástroj **Design** a klikni na **Import a design**: přijímá nativní soubor Figma **.fig** (Save local copy), export Penpot **.penpot**, Illustrator **.ai** nebo **.pdf**, InDesign **.idml** nebo **.indd**, dokument Affinity, Photoshop **.psd**, PowerPoint **.pptx**, CAD **.dxf** nebo **libovolné SVG** ([všechny formáty, které čte](/info/design-import.html#what-comes-in-from-each-app)). Nepotřebuješ účet, plugin ani licenci návrhové aplikace.

![Otevřené plátno Lolly Design - Import a design je v nabídce Lolly na liště nástrojů](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

Vrstvy se načtou jako upravitelná pole. Text zůstává přepisovatelný, tvary zůstávají tvary a obrázky se přidají do tvé knihovny. Jakmile rozvržení uložíš, **Share with rules** ho může proměnit v nástroj, který kdokoli s Lolly může znovu vyplnit. Viz [Import návrhu](/info/design-import.html).

## Můžou dva lidé pracovat na stejném návrhu bez internetu?

Ano. Jeden člověk sdílí pozvánku (odkaz, QR kód nebo krátký kód) a druhý ji přijme. Obě zařízení pak udržují stejnou živou relaci s ukazateli přítomnosti a kroužky fokusu. Funguje to na jakékoli společné síti včetně hotspotu telefonu, protože mezi nimi není žádný server. Viz [Společná práce](/info/collaborate.html). Pro kolegy na různých sítích poskytuje instance Lolly Work organizace ověřenou pracovní spolupráci.

## Co jsou příznaky funkcí?

Příznaky funkcí zapínají nebo vypínají části Lolly. Při samostatném používání si vybíráš osobní nastavení. Organizace používající Lolly Work může podle svých pravidel nastavit výchozí hodnoty nebo skrýt vybrané přepínače a spravované ovládací prvky jsou označené. Viz [Používej Lolly ve své organizaci](/info/organisation.html).

![Osobní příznaky funkcí v samostatné aplikaci; pravidla organizace mohou řídit vybrané přepínače](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Čím se utility liší od nástrojů?

Utilita provede jeden rychlý úkol se souborem, který už máš, například komprimuje PDF, převede fotku nebo odstraní skrytá data. Mnohé běží na tvém zařízení bez nahrávání čehokoli na server. Utility udržují uvnitř Lolly úkoly, které lidé obvykle svěřují náhodnému webu. Komprese smlouvy, převod fotek z dovolené, které stále obsahují polohu, nebo vložení tokenu do online formátovače by neměly znamenat předání souboru webu s neznámou dobou uchovávání, jurisdikcí a obchodním modelem. [Lolly Utilities](/info/utilities.html) je uvádí a [Obchod, se kterým jsme nikdy nesouhlasili](/info/status-quo.html) vypráví příběh jejich vzniku.

![Zobrazení Utilities: Lolly Strip Hidden Data, Compress PDF, Convert Image a další úkoly prováděné na zařízení, vše na jednom místě](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Může naše organizace používat SSO, sdílené projekty a schvalování?

Ano, s **Lolly Work**, serverem pro organizace ze stejného open source projektu. Běží samostatně a přidává jednotné přihlášení přes tvého poskytovatele identity, zřizování účtů přes SCIM, skupinová oprávnění, sdílené projekty a assety, živou pracovní spolupráci, schvalování a auditní záznamy. Běžná aplikace dál funguje sama o sobě.

[Používej Lolly ve své organizaci](/info/organisation.html) pokrývá přihlášení a hledání sdílené práce. [Nasazení](/info/deployment.html#organisation-services-with-lolly-work) pokrývá nastavení Lolly Work. Sdílený obsah a záznamy organizace se řídí zásadami ochrany soukromí a uchovávání dané instance.

## Jaké překážky můžu při zavádění Lolly očekávat?

Hlavně změnu v tom, jak tým tvoří, ne v technologii. Tým, který chce spravovanou sadu nástrojů, potřebuje někoho, kdo vytvoří jeho designový systém a první šablony. Kdokoli si přesto může hned první den vytvořit vlastní nástroje v Lolly Design, bez nutnosti používat git. Stávající procesy fungují dál, i když jejich výstup neodpovídá značce. Dobře převést jeden viditelný výstup a ukázat vedle sebe stav před a po přesvědčí rychleji než plán.

[Zavádění & správa](/info/adoption-governance.html) pokrývá zapojení podle rolí, měření pilotního provozu a možnou podobu procesu správy.

## Vznikla Lolly pomocí „vibe codingu“?

Lolly vznikla s pomocí AI při psaní kódu, průzkumu a na mnoha místech i tvorbě obsahu, s využitím různých modelů a dodavatelů včetně těch od společností vyvíjejících špičkové modely ve veřejném cloudu. Člověk vytvořil architekturu, záměrně vybíral a upravoval kód a určoval výtvarné směřování aplikace.

Bezpečnostní upozornění na vysokou nebo kritickou závažnost v závislostech Lolly blokuje CI. Upozornění, které zatím nelze vyřešit, se odloží jen jako schválená výjimka s písemným zdůvodněním. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) uvádí každou aktuálně platnou výjimku a [poznámky k vydáním](https://github.com/lolly-tools/lolly/releases) uvádějí výjimky obsažené v jednotlivých vydáních. SECURITY.md také říká, jak nahlásit zranitelnost.

Kontroly při sestavení také odmítají formulace, které působí strojově, v komentářích kódu, aplikaci i této dokumentaci, aby text zůstal srozumitelný pro každého čtenáře. Vedlejším účinkem je, že detektor může obtížněji rozpoznat, který text napsal model. To nebylo naším záměrem.

Především Lolly staví na desetiletích práce odborníků z celého světa na open source.

**Informace o použití generativní AI:**

- **Kód napsaný LLM:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (tento seznam se může rozšířit)
- **Průzkum s LLM:** Gemini 3.1, Fable, Codex Astra
- **Dokumentace:** Sonnet 5
- **Open source knihovny:** Jejich příslušní autoři, uvedení v SBOM, komentářích a hlavičkách souborů

Tento seznam nezahrnuje modely přibalené přímo do Lolly.

**Lidský podíl:**
- **Nápady, revize a zpětná vazba:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, komunita Penpot, Tim Hildred (seznam není úplný)
- **Architektura, umělecké vedení & úklid balastu:** Andy Fitzsimon

## Kam se poděly nástroje se značkou SUSE?

Jsou v samostatném soukromém repozitáři. Veřejný klon nestahuje balíček značky SUSE, takže sestavení z něj používá neutrální profil `lolly-start`, pokud si nevybereš jiný. Tento profil obsahuje komunitní nástroje nezávislé na značce a prázdnou značku, kterou vyplníš vlastními údaji. [lolly.tools](https://lolly.tools) se sestavuje s profilem `lolly-demo` a otevírá se v [Lolly Demo](/info/lolly-demo.html), vlastním designovém systému Lolly. SUSE provozuje vlastní instanci, aby chránila své ochranné známky.

## Jakou příchuť má logo Lolly?

Někdo říká limetka, jiný máta a někdy jablko. Lolly dodává sladkost a ty vytváříš příchuť.

## Co Lolly myslí suverenitou obsahu?

Kontrolu nad tím, jak tvůj obsah vzniká, jak se spravuje, ukládá a přesouvá mezi systémy, které si vybereš. Lolly podporuje místní tvorbu, upravitelnou práci a přenosné nástroje. Lolly Work přidává sdílené služby řízené organizací. Stále záleží na licencích zdrojů, dostupných závislostech a datových tocích pracovního postupu. [Co je suverenita obsahu?](/info/content-sovereignty.html) vysvětluje jednotlivé možnosti kontroly a jejich meze.

## Můžeme si ponechat stávající DAM?

Ano. Podporovaný DAM může zůstat autoritativním zdrojem, zatímco Lolly Work propojí vybrané assety s nástroji Lolly. Přístup ke zdroji, povolené úpravy, práva k použití a schválení hotového výstupu jsou samostatná rozhodnutí. [Používej Lolly se stávajícím DAM](/info/use-with-dam.html) vysvětluje toto uspořádání a [Zkušenost SUSE s Brandfolder](/info/suse-brandfolder.html) zaznamenává úspěšné použití při zavádění.
