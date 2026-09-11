# Časté dotazy

Časté dotazy zobrazené v rozbalovacím seznamu na úvodní stránce `/info`.

**Jak se to udržuje:** každý nadpis `##` níže je otázka; všechno pod ním
(až po další `##`) je odpověď. Odpovědi používají stejný odlehčený markdown jako
zbytek webu - odstavce odděluj prázdným řádkem. Otázky tady přidávej, odebírej nebo
přeskupuj a znovu spusť `npm run build:info` (nebo `npm run dev:web`).
Všechno nad prvním `##` (tento nadpis a tyto poznámky) build ignoruje.

## Co se stane, když na stránce /profile udělím souhlas?

Když Lolly použiješ poprvé, všechno, co kamkoli napíšeš, je zcela soukromé, dokud tu informaci záměrně nepustíš ven přes média nebo sdílecí odkaz (pokud jsi online).

Když je souhlas zapnutý, vybrané údaje z profilu se zapečetí do toho, co vytvoříš, a označí tě jako zdroj. Nic se nepřidá bez tvé volby.

Lolly vytváří velké množství obsahu. Držíme se přísné minimalizace dat, abychom předešli riziku.

## Byla Lolly "vibe codovaná"?

Lolly vznikala s pomocí AI asistovaného programování, AI asistovaného objevování a na mnoha místech i AI asistovaného obsahu, s využitím kombinace modelů a dodavatelů, včetně předních firem z oblasti veřejného cloudu.

V době psaní tohoto textu neobsahuje Lolly žádné známé bezpečnostní zranitelnosti ve svém dodavatelském řetězci a zavazuje se k rychlé reakci na bezpečnostní incidenty, jakmile se objeví CVE.

Člověk vytvořil architekturu, cíleně kurátoroval kód a umělecky vedl výsledný zážitek.

A co je nejdůležitější, Lolly stojí na ramenou desetiletí inovací open source od skutečných odborníků z celého světa.

V kódové základně Lolly existuje deterministická build-brána, která udržuje kód a dokumentaci srozumitelné pro běžného čtenáře a "odbalastňuje" celý zážitek. To může ztěžovat proprietární syntetické určování původu. Není to záměr.

**Prohlášení o generativní AI:**

- **Kód napsaný LLM:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next (tento seznam se může rozšiřovat)
- **Objevování pomocí LLM:** Gemini 3.1, Fable
- **Dokumentace:** Sonnet 5
- **Knihovny open source:** jejich příslušní autoři, uvedení v SBOM, komentářích a hlavičkách souborů

Tento seznam nezahrnuje modely začleněné (vendored) do Lolly.

**Lidský přínos:**

- **Architektura:** Andy Fitzsimon
- **Umělecké vedení:** Andy Fitzsimon
- **Kód napsaný člověkem:** Andy Fitzsimon
- **Koncepce, revize a zpětná vazba:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, komunita Penpot (seznam není úplný)

## Co jsou feature flagy?

Feature flagy zapínají a vypínají části Lolly. Obvykle je ovládá administrátor - u Lolly je máš v rukou ty.

![Každý feature flag je přepínač, který patří tobě a sedí v tvém profilu, ne v konzoli administrátora](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Jak získám mobilní nebo desktopovou aplikaci?

Vlastní aplikace může šířit kdokoli a nástroje i konfigurace takových aplikací se mají hodně lišit podle toho, pro jaké publikum jsou určené. Žádná jediná aplikace tedy neexistuje, pokud si ji nevytvoříš nebo ti ji nedá někdo relevantní.

## Proč název „Lolly Tools“?

**Lolly** proto, že svoboda je sladká, a protože v Austrálii, na Novém Zélandu a v Británii znamená lolly bonbon.

**Tools** proto, že nástroj leží v klidu, dokud ho nevezmeš do ruky. Neběží, když ho nepoužíváš, a nesleduje tě, když ho používáš.

## Jaké překážky mě při zavádění Lolly čekají?

Lolly zapadne všude tam, kde už soubory generuješ - CLI je stejný engine
jako aplikace, takže pipeline spuštěná ve dvě ráno se nemůže rozejít s tím, co si člověk
prohlédne v prohlížeči. Tření při zavádění je jen zřídka technické; je organizační. Počítej s tímto:

**Kurátorovaný katalog značky musí někdo vytvořit.** Lolly je platforma, ne
hotový balík tvých šablon. Pro *řízené nasazení* někdo nadefinuje sdílený
katalog assetů (loga, palety, fonty jako trvalá ID) a napíše manifest +
šablonu pro každý typ výstupu. Jednotlivci na to ale čekat nemusí - v
otevřené aplikaci si kdokoli může nahrát vlastní soubory do katalogu a stavět nástroje v
Designu hned první den.

**K přispívání není potřeba git.** Designéři si vlastní nástroje a šablony vyrobí
přímo v aplikaci a pak je sdílejí s kolegy nebo je pošlou tomu, kdo spravuje
nasazení, aby je zařadil mezi výchozí.

**Je to záměrně úzké - tak to i podávej.** Lolly není na zakázkový ani vlajkový
obsah. *Je* to tvůj osobní DAM - napojený a vytažený nahoru tvým design
systémem, nástroji a katalogem - a *má* otevřené plátno (Design), jenže
i tam se barvy, písmo a assety řídí aktivními design globals, takže volné
skládání zůstává uvnitř systému. Poměřováno s Figmou nebo Canvou to bude
vypadat omezeně. Poměřováno tím, čím to je - zprovozněná, opakovaná generace assetů
v obřím měřítku - nemá to konkurenci. Špatné zarámování je nejčastější brzda.

**Řízení změny na straně výroby.** Stávající procesy dnes fungují, i když
výstup neodpovídá značce. Přesměrovat je na engine znamená znovu testovat a znovu se učit
a z „soubory přece umíme dělat“ se stane výmluva, proč nemigrovat. Začni tím, že převedeš
jeden dobře viditelný výstup v produkční kvalitě a ukážeš před/po vedle sebe.

Lolly zvedne úroveň všeho.


## Čím se utility liší od nástrojů?

**Stručná odpověď →** Utility nemusí vždy renderovat, a proto mohou mít jiné UX. 

**Skutečná odpověď →** Utility jde hostovat uvnitř Lolly Tools proto, aby přidaly další „vrstvu pohodlí“ jako obranu, která odrazuje od úniku dat. 

Proč? Protože je známo, že lidé denně vezmou **důvěrný obsah, který už mají**, a předají ho
náhodnému webu, aby na něm provedl jednu malou mechanickou operaci:

- „**Zkomprimuj tohle PDF**“ → nahraje smlouvu / výplatní pásku / prezentaci pro vedení neznámým subjektům.
- „**převeď HEIC na JPG**“ → nahraje osobní fotky (s GPS v EXIF) na hosting živený reklamou
- „**ořízni / zmenši tenhle obrázek**“ → nahraje snímek produktu nebo nezveřejněný asset
- „**naformátuj tenhle JSON**“ / „dekóduj tenhle JWT“ → vloží odpovědi API, tokeny a tajné klíče do formátovače
- „**spoj tahle PDF**“ → nahraje **dva dokumenty, které nikdy neměly sdílet jeden server**

Tyhle weby a jejich obrovská vlečka klonů **nejsou ve výchozím stavu důvěryhodné** - neznámá
doba uchování, neznámé jurisdikce, neznámí subdodavatelé a reklamní/afiliační
obchodní model, který má všechny důvody nechat si, co jim dáš. Operace je
triviální; **cenou je obsah.** 

Válku o governance vyhrajeme skvělým pohodlím a službou. 

![Pohled Utilities sbírá mechanické úkony, které lidé obvykle svěří náhodnému webu, jenže tady běží uvnitř Lolly](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Umí Lolly upravovat a renderovat moje soubory z Figmy, Penpotu, Illustratoru nebo InDesignu?

Ano. Otevři **Design** a klikni na **Import a design**: bere nativní Figma **.fig** (Save local copy), export z Penpotu **.penpot**, Illustrator **.ai** nebo **.pdf**, InDesign **.idml** (File → Export → InDesign Markup) nebo **jakékoli SVG** (ta široká vrata - vyexportuje ho skoro každá designová aplikace). Není potřeba účet, plugin ani licence designové aplikace.

![Design's open canvas - Import a design sits in the toolbar's Lolly menu](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

Vrstvy přijdou jako upravitelné boxy na otevřeném plátně: text jde dál přepisovat, tvary zůstávají tvary, obrázky se přidají do tvé vlastní knihovny obrázků a písmo i barvy se řídí globálními hodnotami značky. Ulož to a z layoutu je znovupoužitelná šablona s vlastní URL, kterou může kdokoli s Lolly znovu naplnit - a můžeš do ní přimíchat živé nástroje (QR kód, graf), které se při načtení přerenderují. Odtamtud se renderuje jako cokoli jiného v Lolly - SVG, PDF, PNG a zbytek, reprodukovatelné z URL. Viz [Import designu](/info/design-import.html).

## Můžu svou práci sdílet jako soubor místo odkazu?

Ano. Když odkaz neunese všechno (tvoje vlastní fotky, dlouhý text), dialog Share přesně řekne, co by chybělo, a nabídne místo něj soubor **.lolly**: jeden soubor s designem, obrázky, které používá, a - když chceš - i se samotným nástrojem. Kolik toho pocestuje, rozhoduješ ty: tvoje jméno a údaje se přidají, jen když to profil povolí, licencovaná grafika zůstane stranou, dokud ji nepřiložíš, a kdo otevře soubor s nástrojem, dostane otázku, jestli mu důvěřuje, než se nástroj smí spustit. Viz [Sdílení tvé práce](/info/using.html#sharing-your-work).

## Můžou dva lidé pracovat na stejném designu bez internetu?

Ano. Jeden pošle pozvánku (odkaz, QR kód nebo krátký kód), druhý ji přijme a obě zařízení drží stejnou relaci živě - včetně přítomnosti a rámečků fokusu. Funguje to na jakékoli sdílené síti, i na hotspotu z telefonu ve sklepě, protože uprostřed není žádný server. Viz [Společná práce](/info/collaborate.html).

## Kam se poděly nástroje se značkou SUSE?

Žijí už v samostatném, soukromém repozitáři. Veřejný klon brand pack SUSE vůbec nestahuje, takže veřejný build běží na neutrálním profilu `lolly-start` - komunitní nástroje nezávislé na značce plus prázdná značka, kterou naplníš tou svou. SUSE provozuje vlastní instanci, aby chránilo své ochranné známky.

## Proč je to zadarmo? Kde je háček?

**Lolly jsme postavili sami pro sebe.** SUSE potřebovalo tisíce souborů v souladu se značkou, každý se svým jménem zapečetěným uvnitř, vyrobených bez toho, aby cokoli putovalo do cizích služeb. Postavili jsme tedy nástroj, který to všechno zvládne na zařízení, a vydali ho jako open source, jako všechno ostatní, co děláme. Udržujeme ho dál, protože ho používáme každý den. **Nevzniká žádný závazek:** všechno tady funguje s námi i bez nás.

Tuhle čáru kreslí licence, ne slib: cokoli běží lokálně, je zdarma, navždy. Vydaná verze je licencovaná tak, že ji nejde vzít zpět, a neexistuje žádná dohoda pro přispěvatele, která by mohla něčí práci přelicencovat. Celé vyjádření najdeš v [positioning](/info/positioning.html).

## Kolik si SUSE nechává pro sebe? (neboli kdy nám vytáhnou koberec pod nohama)

Engine, shelly, schémata a nástroje nezávislé na značce jsou open source; soukromá zůstává část s ochrannými známkami SUSE a značkovými nástroji, a ta je už oddělená. Veřejná instance na [lolly.tools](https://lolly.tools) běží na prázdné značce.

Ta hranice je strukturální, ne slíbená. Každá vydaná verze je open source a vydání nejde vzít zpět, neexistuje žádná dohoda pro přispěvatele, která by mohla něčí práci přelicencovat, a jediné, co zůstává stranou, je ochranná známka. Když v roce 2023 jiná firma uzavřela zdrojové kódy svého enterprise Linuxu, SUSE spoluzaložilo [OpenELA](https://openela.org), aby ten kód zůstal otevřený - stejný postoj dědí i tenhle projekt.

Na rovinu: SUSE *skutečně* staví interní nástroje, aby Lolly propojilo se svými IT systémy - to je o interním nastavení SUSE, ne o veřejném versus soukromém vývoji. Lolly také míří k tomu, aby se sestavovalo přes [Open Build Service](https://openbuildservice.org/), s bezpečnými artefakty dodavatelského řetězce doručovanými přes [SUSE Application Collection](https://apps.rancher.io/applications).

## Jakou příchuť má to logo Lolly?

Někdo říká limetka, jiný máta a občas jablko - Lolly přináší sladkost, příchuť si uděláš ty!
