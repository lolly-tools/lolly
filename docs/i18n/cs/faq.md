# Otázky a odpovědi

Často kladené otázky, vykreslené jako akordeon na `/info/start/faq.html`.

**Jak se to udržuje:** každý nadpis `##` níže je otázka; všechno pod ním
(až po další `##`) je odpověď. Odpovědi používají stejný odlehčený markdown jako
zbytek webu - odstavce odděluj prázdným řádkem. Otázky tady přidávej, odebírej nebo
přeskupuj a znovu spusť `pnpm run build:info` (nebo `pnpm run dev:web`).
Všechno nad prvním `##` (tento nadpis a tyto poznámky) build ignoruje.

Pořadí je pořadí nováčka: nejprve háček, pak tvé soubory, pak získání
a provozování Lolly, pak organizace, nakonec jak vznikla. Kotva každé otázky
se tvoří z anglické otázky na stejné pozici, takže překlad zachovává
anglické pořadí.

## Proč je to zadarmo? Kde je háček?

**Lolly jsme vytvořili pro sebe.** SUSE potřebovala tisíce souborů ve značce, vytvářených bez předávání čehokoli externím službám. Postavili jsme tedy nástroj, který to všechno dělá na zařízení, a vydali jsme ho jako open source, jako všechno ostatní, co děláme. Udržujeme ho, protože ho denně používáme. **Žádná povinnost není:** vše tady funguje s námi i bez nás.

Ta hranice je vedena v licenci, ne v příslibu: cokoli běží lokálně, je zdarma, navždy. Vydaná verze je licencována tak, aby ji nešlo vzít zpět, a neexistuje žádná smlouva přispěvatele, která by mohla kohokoli přelicencovat.

## Kolik si SUSE nechává pro sebe? (neboli kdy nám vytáhnou koberec pod nohama)

Engine, shelly, schémata a nástroje nezávislé na značce jsou open source. Ochranné známky SUSE a nástroje ve značce jsou část, která zůstává soukromá, a už jsou oddělené. Veřejná instance na [lolly.tools](https://lolly.tools) provozuje [Lolly Demo](/info/lolly-demo.html), vlastní designový systém Lolly.

Nic tady nestojí na slibu: každá vydaná verze zůstává open source a zadrženo je jen ochranné označení. Když jiná firma v roce 2023 uzavřela zdrojové kódy svého podnikového Linuxu, SUSE spoluzaložila [OpenELA](https://openela.org), aby tento kód zůstal otevřený, stejný postoj dědí tento projekt.

Plná otevřenost: SUSE *staví* interní nástroje pro propojení Lolly s vlastními IT systémy. Je to interní uspořádání SUSE, ne rozdělení na veřejný a soukromý vývoj. Lolly také míří na sestavování přes [Open Build Service](https://openbuildservice.org/), s artefakty zabezpečeného dodavatelského řetězce dodávanými přes [SUSE Application Collection](https://apps.rancher.io/applications).

## Proč název „Lolly Tools“?

**Lolly** proto, že svoboda je sladká, a protože v Austrálii, na Novém Zélandu a v Británii znamená lolly bonbon.

**Tools** proto, že nástroj leží v klidu, dokud ho nevezmeš do ruky. Neběží, když ho nepoužíváš, a nesleduje tě, když ho používáš.

## Proč je všechno zelené?

lolly.tools se otevře v [Lolly Demo](/info/lolly-demo.html), vlastním ukázkovém designovém systému Lolly, a jeho vedoucí barva je zelená. Je to ukázka, ne pravidlo. Přepni na **Lolly Starter**, prázdný designový systém, nebo na vlastní v [Settings → Design systems](/#/settings?focus=design-systems-section).

## Mohu použít vlastní značku?

Ano. **Design System Setup** (`#/start`) sestaví designový systém z jedné barvy, souboru designových tokenů nebo hotového návrhu a každý nástroj pak kreslí s tvým designovým systémem. [Začni](/info/quickstart.html#put-your-brand-in) provádí třemi cestami.

Designový systém, který dodává tvá organizace nebo sestavení, je spravovaný: ukazuje zámek a zůstává jen pro čtení a pro změny si můžeš vytvořit upravitelnou kopii.

## Kde je to, co jsem včera udělal/a?

Pokud jsi stiskl **Save as** nebo **Save**, je v **Projects**, na domovské obrazovce, v prohlížeči nebo aplikaci, odkud jsi ukládal. Pokud jsi stiskl jen **Download**, soubor je tam, kam prohlížeč či systém ukládá stažené soubory, a obvykle je kopie v **Assets**. Nástroje, které [ukládají při práci](/info/find-your-work.html#which-tools-save-as-you-work), uchovávají neuloženou práci také v **Projects**. [Najdi a obnov svou práci](/info/find-your-work.html) pokrývá každý případ.

## Zavřel/a jsem kartu. Zmizela mi práce?

Uložená práce je pořád v **Projektech**. Neuložená práce zmizí, kromě nástrojů, které ukládají za chodu - ty ji taky uchovávají v **Projektech**. Příště stiskni **Uložit jako**, než odejdeš. Viz [Když zavřeš kartu nebo opustíš nástroj](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## Můžu svou práci sdílet jako soubor místo odkazu?

Ano. Když odkaz nemůže nést vše, třeba tvé vlastní fotky nebo dlouhý text, dialog Share řekne, co by chybělo, a místo toho nabídne soubor **.lolly**: jeden soubor drží návrh, obrázky, které používá, a, pokud zvolíš, i samotný nástroj.

Ty rozhoduješ, kolik putuje. Tvé jméno a údaje jdou dovnitř, jen pokud se tvůj profil přihlásí, a licencované umění se zadržuje, pokud nezvolíš jeho zahrnutí. Ten, kdo otevře soubor nesoucí nástroj, je dotázán, zda nástroji důvěřuje, než může běžet. Viz [Sdílení práce](/info/using.html#sharing-your-work).

## K čemu slouží údaje v mém profilu?

Tvé údaje v **Settings** předvyplňují nástroje, které je žádají, například jméno na jmence. Zůstávají na tomto zařízení. Pokud zapneš i výslovný souhlas, údaje, které vybereš, se zapečetí do toho, co vytvoříš, a pojmenují tě jako zdroj. Nic se nezahrne, pokud své údaje nezvolíš zahrnout.

Sdílení a Sync posílají jen obsah, který zvolíš. U instance Lolly Work organizace jdou sdílené relace a řízená práce také na ten server. Viz [Soukromí](/info/privacy.html).

## Jak získám mobilní nebo desktopovou aplikaci?

Stáhni je z [Install Lolly](/info/install.html). Stránka uvádí každé sestavení pro macOS, Windows, Linux a Android a ukazuje, jak zkontrolovat stažený soubor. iPhone a iPad dostanou **Lolly Tools** z App Store; odkaz najdeš v [části o iPhonu a iPadu](/info/install.html#iphone-and-ipad).

Kdokoli si také může sestavit a rozdat vlastní kopii aplikace s nástroji a nastavením, které jeho publikum potřebuje. Ukazuje to [Build Guide](/info/build-guide.html).

## Lolly hlásí, že vyžaduje WebGPU. Co můžu dělat?

Webová aplikace kreslí přes WebGPU, grafickou funkci současných prohlížečů, a před otevřením nástroje ji kontroluje. Zkus tohle v pořadí:

1. Aktualizuj prohlížeč na aktuální verzi.
2. Zapni grafickou nebo hardwarovou akceleraci v nastavení prohlížeče a prohlížeč restartuj.
3. Zkus otestovaný prohlížeč: [Podporovaná prostředí](/info/supported-environments.html) je uvádějí.
4. Na Macu, iPhonu nebo iPadu raději [nainstaluj aplikaci](/info/install.html).

## Umí Lolly upravovat a renderovat moje soubory z Figmy, Penpotu, Illustratoru nebo InDesignu?

Ano. Otevři **Design** a klikni na **Import a design**: přijme nativní Figma **.fig** (Save local copy), export Penpot **.penpot**, Illustrator **.ai** nebo **.pdf**, InDesign **.idml** (File → Export → InDesign Markup) nebo **jakékoli SVG**. Nepotřebuješ žádný účet, plugin ani licenci designové aplikace.

![Otevřené plátno Design - Import designu je v nabídce Lolly na liště nástrojů](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

Vrstvy přicházejí jako upravitelná pole: text zůstane přepisovatelný, tvary zůstanou tvary a obrázky se připojí k tvé vlastní knihovně. Ulož to a **Share with rules** může z rozvržení udělat nástroj, který může kdokoli s Lolly znovu vyplnit. Viz [Import návrhu](/info/design-import.html).

## Můžou dva lidé pracovat na stejném designu bez internetu?

Ano. Jeden člověk sdílí pozvánku, jako odkaz, QR kód nebo krátký kód, a druhý ji přijme. Obě zařízení pak drží stejnou relaci živě, včetně přítomnosti a kroužků fokusu. Funguje v jakékoli sdílené síti, i na hotspotu telefonu ve sklepě, protože uprostřed není žádný server. Viz [Spolupráce](/info/collaborate.html). Pro kolegy v různých sítích poskytuje instance Lolly Work organizace ověřené pracovní kolaborace.

## Co jsou feature flagy?

Příznaky funkcí zapínají nebo vypínají části Lolly. V samostatném používání volíš osobní nastavení. Organizace používající Lolly Work může podle své politiky nastavit výchozí hodnoty nebo skrýt vybrané přepínače a spravované ovládací prvky jsou označeny. Viz [Používej Lolly ve své organizaci](/info/organisation.html).

![Osobní příznaky funkcí v samostatné aplikaci; politika organizace může řídit vybrané přepínače](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Čím se utility liší od nástrojů?

Utilita udělá jednu rychlou věc se souborem, který už máš, například zkomprimuje PDF, převede fotku nebo odstraní skrytá data, a mnohé běží na tvém zařízení, aniž se cokoli nahrává. Existují proto, aby úlohy, které lidé obvykle předávají náhodnému webu, zůstaly v Lolly. Komprese smlouvy, převod dovolenkových fotek s polohou stále uvnitř nebo vložení tokenu do online formátovače by neměly znamenat předat soubor webu s neznámým uchováváním, jurisdikcí a obchodním modelem. [Utility](/info/utilities.html) je vypisují a [Obchod, na kterém jsme se nikdy nedohodli](/info/status-quo.html) vypráví příběh za nimi.

![Zobrazení Utilities: Strip Hidden Data, Compress PDF, Convert Image a další úlohy na zařízení, vše na jednom místě](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Může naše organizace používat SSO, sdílené projekty a schvalování?

Ano, s **Lolly Work**, organizačním serverem téhož open-source projektu. Běží samostatně a přidává jednotné přihlášení přes tvého poskytovatele identity, zřizování SCIM, oprávnění podle skupin, sdílené projekty a assety, živé pracovní kolaborace, schvalování a auditní záznamy. Každodenní aplikace stále funguje sama.

[Používej Lolly ve své organizaci](/info/organisation.html) pokrývá přihlášení a hledání sdílené práce a [Nasazení](/info/deployment.html#organisation-services-with-lolly-work) pokrývá zprovoznění. Sdílený obsah a záznamy organizace se řídí zásadami soukromí a uchovávání té instance.

## Jaké překážky mě při zavádění Lolly čekají?

Většinou se mění spíš strana tvorby než technologie. Tým, který chce řízenou sadu nástrojů, potřebuje někoho, kdo vytvoří jeho designový systém a první šablony, ačkoli kdokoli může začít vytvářet vlastní nástroje v Design hned první den, bez gitu. A stávající postupy fungují dál, i když je jejich výstup mimo značku, takže dobré převedení jednoho viditelného výstupu, před a po vedle sebe, uspěje rychleji než plán.

[Adoption & Governance](/info/adoption-governance.html) pokrývá zavádění podle rolí, jak měřit pilot a jak může vypadat proces řízení.

## Byla Lolly "vibe codovaná"?

Lolly vznikla s kódováním podporovaným AI, objevováním podporovaným AI a na mnoha místech i obsahem podporovaným AI, s použitím směsi modelů a dodavatelů, včetně těch od firem z hranice výzkumu veřejných cloudů. Architekturu vytvořil člověk, kód úmyslně vybíral a uměleckou režii zážitku vedl.

Vysoké nebo kritické upozornění v závislostech Lolly zablokuje CI. Upozornění, které zatím nelze opravit, se zadrží jen jako schválená výjimka s písemným důvodem. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) vypisuje každou dnes držanou výjimku a [poznámky k vydání](https://github.com/lolly-tools/lolly/releases) vypisují ty, které nese každé vydání. SECURITY.md také říká, jak nahlásit zranitelnost.

Kontroly v sestavení také odmítají formulace, které působí jako strojově vytvořené, v komentářích kódu, v aplikaci a v těchto dokumentech, aby byl text pro každého čtenáře prostý. Vedlejším účinkem je, že detektor může hůře poznat, který text napsal model. Nechtěli jsme to způsobit.

Především Lolly stojí na ramenou desetiletí open-source práce odborníků z celého světa.

**Prohlášení o generativní AI:**

- **Kód psaný LLM:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (tento seznam se může rozšířit)
- **Objevování LLM:** Gemini 3.1, Fable, Codex Astra
- **Dokumentace:** Sonnet 5
- **Open-source knihovny:** Jejich příslušní autoři, vyjádřeno v SBOM, komentářích a hlavičkách souborů

Tento seznam nezahrnuje modely začleněné (vendored) do Lolly.

**Lidská tvrzení:**
- **Nápady, revize a zpětná vazba:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, komunita Penpot, Tim Hildred (seznam není úplný)
- **Architektura, umělecká režie a uklízeč slop:** Andy Fitzsimon

## Kam se poděly nástroje se značkou SUSE?

Žijí v samostatném soukromém repozitáři. Veřejný klon balíček značky SUSE vůbec nestahuje, takže sestavení z něj používá neutrální profil `lolly-start`, pokud nezvolíš jiný: nástroje komunity nezávislé na značce plus prázdnou značku, kterou vyplníš vlastní. [lolly.tools](https://lolly.tools) je sestaven s profilem `lolly-demo` a otevírá se v [Lolly Demo](/info/lolly-demo.html), vlastním designovém systému Lolly. SUSE provozuje vlastní instanci na ochranu svých ochranných známek.

## Jakou příchuť má to logo Lolly?

Někdo říká limetka, jiný máta a občas jablko - Lolly přináší sladkost, příchuť si uděláš ty!
