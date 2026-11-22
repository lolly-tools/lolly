# Spolupráce s partnery

Mnoho výtvorů nese dvě značky, například logo sponzora na plakátu akce, nabídka prodejce pod jménem výrobce, společné oznámení nebo případová studie napsaná s dodavatelem. Tato stránka je pro obě strany.

Na této stránce je **hlavní značka** ta, v jejímž designovém systému výtvor vzniká, a **partner** je druhá značka na výtvoru. Vytvořit ho může kterákoli strana. [Architektury značek](/info/brand-architectures.html#co-branding) porovnávají co-branding s dalšími uspořádáními značek.

<!--i:eti-info-->
## Jak Lolly dnes pracuje se dvěma značkami

- **Každý výtvor kreslí jeden designový systém.** Platí barvy, písmo a pravidla hlavní značky. Logo partnera se přidává jako grafika: obrázek z Assets nebo vlastní logo uložené v designovém systému.
- **Značka putuje jako soubor.** Soubor designového systému (`.lolly`) obsahuje tokeny, písma a loga. Opakovaně použitelný nástroj vytvořený pomocí **Share with rules** obsahuje jedno hotové rozvržení se vstupy, které povolíš. Dovednosti značky putují jako samostatné soubory.
- **Značka může mít také adresu.** [Stránka značky](/info/brand-page.html) zveřejňuje loga, barvy, písmo a pravidla ke čtení pro partnera, s tokeny a dovednostmi pro jeho nástroje.
- **Lolly kontroluje jen pravidla hlavní značky.** Lolly nezná pravidla partnera, například ochranný prostor nebo minimální velikost, takže je zkontroluj podle partnerových pokynů. V partnerském programu Lolly Work obsahuje partnerská sada firmy její pravidla a Lolly Design podle ní kontroluje loga firmy.
- **Celý partnerský program běží na Lolly Work.** Když prodejci, distributoři nebo jiní partneři vytvářejí výtvory ve tvé značce na tvém Lolly Work, partnerský program poskytne každé partnerské firmě jen nástroje, soubory a šablony, které vybereš. Program uchovává loga a údaje firmy, doplňuje je do tvých šablon a zaznamenává firmu v každém souboru. [Provozuj partnerský program](/info/manage/run-a-partner-programme.html) je průvodce pro tým, který ho provozuje.

<!--i:eti-folder-shared-->
## Sdílej svou značku s partnerem

### Vyber, co poslat

| Co poslat | Jak | Co partner dostane | Pro koho se hodí |
| --- | --- | --- | --- |
| Soubor designového systému | **Export** na horní liště [Lolly Design System Setup](/info/brand-studio.html#move-a-brand-between-devices) | Tvé tokeny, písma, loga a volbu motivu jako designový systém, na který může přepnout | Partner, který vytváří mnoho výtvorů ve tvé značce |
| Opakovaně použitelný nástroj | V Lolly Design, **Share with rules** ([Sdílej návrh s pravidly](/info/create-a-tool.html)) | Jedno hotové rozvržení se vstupy, které povolíš, například jeho název a logo. Soubor obsahuje vyhodnocené barvy, písma a obrázky, takže jeho vlastní designový systém nemůže změnit styl pevné grafiky | Leták, odznak nebo banner se dvěma značkami, který každý partner vyplní |
| Dovednosti značky | Sekce **Skills**: **Download skill (.zip)** nebo **Copy as one file** | Tvé písemné standardy pro jeho lidi a agenty | Kterákoli z předchozích možností, když část práce dělá agent |
| Stránka značky | **Publish a brand page** v Lolly Design System Setup nebo `lolly system publish` zapíše složku, kterou hostuješ ([Stránky značek](/info/brand-page.html)) | Tvá aktuální loga, barvy, písmo a pravidla na jedné adrese, s tokeny a dovednostmi pro jeho nástroje. Loga a soubory písem se zobrazí, když to jejich práva dovolují, a stránka uvádí, co vynechala | Sdílení s lidmi, kterým neposíláš soubory |
| Tokeny | **Tokens (.json)** v nabídce **More** ve studiu | Prostý dokument designových tokenů bez písem a log | Vlastní návrhové nástroje nebo sestavení partnera |

![Lolly Design System Setup s Lolly Demo, otevřený v sekci Skills: Export na liště, nabídka More otevřená na Tokens (.json) a Download skill (.zip) a Copy as one file vedle vybrané dovednosti](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dskills&width=1200&height=900&dpi=192&waitMs=1800&waitSelector=.skills-reader-actions&drive=click%3A%5Bdata-ds-more%5D%3Bwait%3A500&format=svg&walker=1&dark=1&filename=partners-send)

::: warning Tvá písma se přenášejí v souboru
Písma, která jsi přidal, se přenášejí v souboru designového systému, proto zkontroluj, zda jejich licence dovolují předávat soubory dál.
:::

Opakovaně použitelný nástroj si vyžádá potvrzení, než zahrne obrázek, jehož licence to omezuje ([Náhled a sdílení](/info/create-a-tool.html#preview-and-share)).

### Vytvoř šablonu pro společnou prezentaci značek

Opakovaně použitelný nástroj udrží výtvory každého partnera v tvém rozvržení. Partner změní jen to, co dovolíš.

1. V Lolly Design vytvoř dílo ve svém designovém systému. Nakresli obrazové pole tam, kam patří logo partnera, a nech kolem něj prostor, který rozvržení potřebuje.
2. V nabídce File menu zvol **Share with rules**. Vyber obrazové pole a zvol **Make editable**. V jeho **Rules** povol nahrávání náhradních obrázků, nastav minimální velikost v pixelech a přijímané formáty souborů (pokud možno SVG). Nastav **Image fit** pole na **Contain (fit inside)**, aby široké nebo vysoké logo zůstalo uvnitř pole.
3. Povol také úpravy názvu nebo nabídky partnera s limitem počtu znaků.
4. Stiskni **Preview** a vyzkoušej velmi široké logo, velmi vysoké logo a dlouhý název.
5. Zvol **Share .lolly** a napiš partnerovi pokyny: kterou verzi loga má nahrát, například plnobarevné vodorovné logo pro světlé pozadí.

![Share with rules na kartě akce se dvěma značkami: pole s logem partnera je vybrané a upravitelné a jeho Rules povolují nahrání obrázků o velikosti alespoň 480 na 110 pixelů ve formátu PNG nebo SVG](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%255B%257B%2522id%2522%253A%2522board%2522%252C%2522name%2522%253A%2522Build%2520day%2520card%2522%252C%2522kind%2522%253A%2522frame%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A0%252C%2522w%2522%253A1600%252C%2522h%2522%253A900%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.sugar%257D%2522%252C%2522clipChildren%2522%253Atrue%257D%252C%257B%2522id%2522%253A%2522dot-large%2522%252C%2522name%2522%253A%2522Large%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1040%252C%2522y%2522%253A70%252C%2522w%2522%253A480%252C%2522h%2522%253A480%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.pandanus%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522dot-small%2522%252C%2522name%2522%253A%2522Small%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1330%252C%2522y%2522%253A380%252C%2522w%2522%253A240%252C%2522h%2522%253A240%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.green-apple%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522band%2522%252C%2522name%2522%253A%2522Partner%2520band%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A680%252C%2522w%2522%253A1600%252C%2522h%2522%253A220%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.avocado%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522lolly%2522%252C%2522name%2522%253A%2522Lolly%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A96%252C%2522w%2522%253A260%252C%2522h%2522%253A90%252C%2522image%2522%253A%2522lolly%2Flogo%2Fhorizontal%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522imgpos%2522%253A%2522left%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522headline%2522%252C%2522name%2522%253A%2522Headline%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A260%252C%2522w%2522%253A880%252C%2522h%2522%253A180%252C%2522text%2522%253A%2522Build%2520day%25202026%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.liquorice%257D%2522%252C%2522fontSize%2522%253A120%252C%2522weight%2522%253A%2522700%2522%252C%2522font%2522%253A%2522display%2522%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522sub%2522%252C%2522name%2522%253A%2522Subtitle%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A450%252C%2522w%2522%253A880%252C%2522h%2522%253A90%252C%2522text%2522%253A%2522Twelve%2520hours%2520of%2520making%252C%2520with%2520friends%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A48%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522with%2522%252C%2522name%2522%253A%2522In%2520partnership%2520with%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A750%252C%2522w%2522%253A400%252C%2522h%2522%253A80%252C%2522text%2522%253A%2522In%2520partnership%2520with%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A34%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522partner%2522%252C%2522name%2522%253A%2522Partner%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A500%252C%2522y%2522%253A735%252C%2522w%2522%253A480%252C%2522h%2522%253A110%252C%2522image%2522%253A%2522%2Ftools%2Flogo-wall%2Fassets%2Fpartner-name.svg%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522frame%2522%253A%2522board%2522%257D%255D%26w%3D1600%26h%3D900&width=1280&height=1000&dpi=192&waitMs=3000&drive=click%3Abutton%5Baria-label%3D%22File%20menu%22%5D%3Bwait%3A500%3Bclick%3Atext%3DShare%20with%20rules%3Bwait%3A2500%3Bclick%3A%23tool-canvas%20%5Bdata-box-id%3D%22partner%22%5D%3Bclick%3Abutton%3Ahas-text%28%22Make%20editable%22%29%3Bwait%3A1200%3Bclick%3A.dr-input%20.dr-advanced%20%3E%20summary%3Bpress%3AControlOrMeta%2BA%7Con%3D%5Bdata-rule%3D%22image%3AminWidth%22%5D%3Bpress%3A4%3Bpress%3A8%3Bpress%3A0%3Bpress%3AControlOrMeta%2BA%7Con%3D%5Bdata-rule%3D%22image%3AminHeight%22%5D%3Bpress%3A1%3Bpress%3A1%3Bpress%3A0%3Bclick%3A%5Bdata-rule%3D%22image-format%3Ajpeg%22%5D%3Bclick%3A%5Bdata-rule%3D%22image-format%3Awebp%22%5D%3Bclick%3A%5Bdata-rule%3D%22image-format%3Aavif%22%5D&format=svg&walker=1&dark=1&filename=partners-template-rules)

Partner přetáhne soubor do Lolly, projde výzvu k potvrzení důvěryhodnosti, vyplní vstupy a stáhne povolené formáty ([Použití hotového nástroje](/info/create-a-tool.html#use-the-finished-tool)). Lolly udrží logo uvnitř pole, které jsi nakreslil. Lolly nečte pravidlo partnera pro ochrannou zónu, takže logo dostane jen prostor, který kolem pole necháš.

### Předej dovednosti své značky agentovi

Dovednosti vedou lidi a agenty. Lolly kontroluje pravidla organizace.

- V Lolly Design System Setup otevři sekci **Skills** (`#/start?area=skills`), vyber dovednost a stiskni **Download skill (.zip)**. Odkazy na katalog ve složce míří na tvou Lolly a její `lolly.json` zaznamenává, odkud kopie pochází. **Copy as one file** vloží stejný text do schránky pro okno chatu.
- V terminálu zapíše `lolly system skill <name> --into=<dir>` stejnou složku ([Ve složce pro lokální nástroj agenta](/info/brand-skills.html#in-a-folder-for-a-local-agent-tool)).
- Tvůj počítač vypisuje dovednosti označené `internal` i `public`, proto vyber, které pošleš ([Veřejné a interní dovednosti](/info/brand-skills.html#public-and-internal-skills)).
- Pro designový systém bez vlastních dovedností napíše Lolly základ z jeho tokenů a pravidel organizace a sekce tento základ zobrazí.
- Kopie se sama neaktualizuje. Když zveřejníš novou revizi dovednosti, pošli složku znovu.

<!--i:eti-download-->
## Pracuj se značkou, kterou jsi dostal

Pro partnera, který dostane soubor designového systému. Když hlavní značka provozuje partnerský program na svém Lolly Work, přihlásíš se tam: domovská obrazovka se otevře na kartě tvé firmy a šablonách, které ti byly zpřístupněny ([Co vidí partneři](/info/manage/run-a-partner-programme.html#what-partners-see)).

1. **Otevři soubor.** Přetáhni soubor do Lolly nebo stiskni **Open**; soubor přijme i **Add from…** v Lolly Design System Setup. Náhled vypíše obsah souboru, než se cokoli zapíše. Soubor designového systému přidá samostatný designový systém pod názvem hlavní značky a aktivuje ho. Tvůj vlastní designový systém zůstane na zařízení. Soubor, který místo toho připojuje aplikaci k vlastní Lolly hlavní značky, nejdřív vypíše dopady na celé zařízení; tento typ souboru popisuje [Používání Lolly v organizaci](/info/organisation.html).
2. **Prohlédni si značku.** V Lolly Design System Setup ukazuje **Board** obsah designového systému, **Logos** obsahuje jeho značky a **Rules** vypisuje pravidla organizace, která Lolly kontroluje. **Skills** ukazuje základ, který Lolly píše z tokenů a pravidel; vlastní dovednosti hlavní značky přijdou jako samostatné soubory, pokud je pošle.
3. **Přepínej mezi značkami.** **Settings → Preferences → Design systems** přepíná designový systém pro celé zařízení a **Settings → Design system** nabízí pás obálek pro přepínání. Než přepneš, dokonči dílo jedné značky.
4. **Umísti vlastní značku.** Nahraj své logo do **Assets**, kde bude k dispozici v každém designovém systému, nebo ho přidej jako **vlastní značku** do designového systému hlavní značky (sekce **Logos**, **Custom marks**), kde se přenáší v souboru tohoto designového systému. Designový systém se zámkem je jen pro čtení, proto tam použij Assets. Kontroly najdeš v části [Umísti značku partnera](#place-a-partner-s-mark).
5. **Zkontroluj před exportem.** V Lolly Design karta **Before you export** v panelu exportu vypisuje zjištění podle pravidel hlavní značky, vrstvu po vrstvě ([Před exportem](/info/design.html#before-you-export)). Karta **Design system** ukazuje designový systém zaznamenaný v souboru.
6. **Pošli práci zpět.** Pošli exportovaný soubor nebo upravitelný návrh jako `.lolly` ([Sdílení práce](/info/using.html#sharing-your-work)). Návrh se otevře v právě aktivním designovém systému, takže hlavní značka otevře tvůj návrh se svým aktivním designovým systémem.

::: note Soubor designového systému se neaktualizuje
Soubor designového systému je kopií značky ke dni exportu. Kopii nic neaktualizuje.
:::

Když hlavní značka pošle novější soubor, otevři ho stejným způsobem. Pak v **Settings → Preferences → Design systems** zkontroluj, který designový systém je aktivní, a starší kopii tam odstraň, až ji nebudeš potřebovat.

![Designové systémy v Settings: Lolly Demo je aktivní, Lolly Starter má tlačítko Use, které přepíná celé zařízení, a Open or import a file přijímá soubor designového systému](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddesign-systems-section&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23design-systems-section&format=svg&walker=1&dark=1&filename=partners-design-systems)

<!--i:eti-image-->
## Umísti značku partnera

| Způsob | Postup | Nejvhodnější pro |
| --- | --- | --- |
| Obrázek v Assets | Přetáhni soubor do oblasti pro nahrávání v **Assets**, pak ho vyber v obrazovém poli nástroje nebo v Lolly Design pomocí **Image** z nabídky přidávání na liště | Jednorázová díla. Nahraný soubor patří zařízení, takže je k dispozici bez ohledu na aktivní designový systém |
| Vlastní značka | Sekce **Logos**, **Custom marks**: zadej název značky, pak **Choose file…** | Partnera, se kterým pracuješ často. Značka patří designovému systému a přenáší se v jeho souboru |
| Hotová sestava značek | Vytvoř sestavu z obou značek ve svém kreslicím nástroji a pak ji přidej jako vlastní značku | Opakovaně používanou sestavu se „s“ nebo „ve spolupráci s“ |

::: check Před exportem zkontroluj značku
- **Správný soubor.** Použij soubor od partnera, SVG, pokud je k dispozici. Logo zkopírované z webové stránky nebo snímku se při tisku rozmaže.
- **Správná verze pro pozadí.** Na tmavém nebo členitém pozadí použij inverzní nebo jednobarevnou verzi, pokud ji pokyny partnera nabízejí.
- **Proporce.** Nastav **Image fit** obrazového pole na **Contain (fit inside)** a značka se nikdy nedeformuje.
- **Ochranná zóna a velikost.** Nech kolem značky prostor požadovaný pokyny partnera a dodrž velikost nad jeho minimem. Lolly neměří ani jedno.
- **Která značka je hlavní.** Nastav velikosti obou značek podle pokynů obou stran o tom, která je hlavní.
- **Práva.** Lolly ukazuje licenci zaznamenanou u assetu z katalogu. Soubor, který nahraješ sám, nemá záznam licence a jeho podrobnosti uvádějí *Licence not recorded*, proto si svolení partnera k použití značky ulož do vlastních záznamů ([Tvůrčí práva a uvedení autorství](/info/creative-rights.html)).
:::

![Before you export na kartě se dvěma značkami: designový systém je Lolly Demo, logo partnera je uvedeno jako obrázek mimo assety designového systému a čtyři pravidla organizace nemají žádné nálezy](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%255B%257B%2522id%2522%253A%2522board%2522%252C%2522name%2522%253A%2522Build%2520day%2520card%2522%252C%2522kind%2522%253A%2522frame%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A0%252C%2522w%2522%253A1600%252C%2522h%2522%253A900%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.sugar%257D%2522%252C%2522clipChildren%2522%253Atrue%257D%252C%257B%2522id%2522%253A%2522dot-large%2522%252C%2522name%2522%253A%2522Large%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1040%252C%2522y%2522%253A70%252C%2522w%2522%253A480%252C%2522h%2522%253A480%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.pandanus%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522dot-small%2522%252C%2522name%2522%253A%2522Small%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1330%252C%2522y%2522%253A380%252C%2522w%2522%253A240%252C%2522h%2522%253A240%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.green-apple%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522band%2522%252C%2522name%2522%253A%2522Partner%2520band%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A680%252C%2522w%2522%253A1600%252C%2522h%2522%253A220%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.avocado%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522lolly%2522%252C%2522name%2522%253A%2522Lolly%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A96%252C%2522w%2522%253A260%252C%2522h%2522%253A90%252C%2522image%2522%253A%2522lolly%2Flogo%2Fhorizontal%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522imgpos%2522%253A%2522left%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522headline%2522%252C%2522name%2522%253A%2522Headline%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A260%252C%2522w%2522%253A880%252C%2522h%2522%253A180%252C%2522text%2522%253A%2522Build%2520day%25202026%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.liquorice%257D%2522%252C%2522fontSize%2522%253A120%252C%2522weight%2522%253A%2522700%2522%252C%2522font%2522%253A%2522display%2522%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522sub%2522%252C%2522name%2522%253A%2522Subtitle%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A450%252C%2522w%2522%253A880%252C%2522h%2522%253A90%252C%2522text%2522%253A%2522Twelve%2520hours%2520of%2520making%252C%2520with%2520friends%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A48%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522with%2522%252C%2522name%2522%253A%2522In%2520partnership%2520with%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A750%252C%2522w%2522%253A400%252C%2522h%2522%253A80%252C%2522text%2522%253A%2522In%2520partnership%2520with%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A34%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522partner%2522%252C%2522name%2522%253A%2522Partner%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A500%252C%2522y%2522%253A735%252C%2522w%2522%253A480%252C%2522h%2522%253A110%252C%2522image%2522%253A%2522%2Ftools%2Flogo-wall%2Fassets%2Fpartner-name.svg%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522frame%2522%253A%2522board%2522%257D%255D%26w%3D1600%26h%3D900&width=1440&height=1000&dpi=192&waitMs=3000&drive=click%3A.edge-dock-tab%3Ahas-text%28%22Export%22%29%3Bwait%3A2500%3Bclick%3A%5Bdata-action%3D%22preflight-open%22%5D%3Bwait%3A1200&cropSelector=.preflight-modal&format=svg&walker=1&dark=1&filename=partners-before-export)

[Záznam designového systému](/info/exporting.html#the-design-system-record) v exportu uvádí designový systém a colourway hlavní značky. Značku partnera nezaznamenává, kromě partnerského programu Lolly Work, kde uvádí i partnerskou firmu a program, pro které dílo vzniklo.

### Předej agentovi dovednosti obou značek

Když práci dělá agent, dej mu dovednosti obou značek beze změny a řekni mu, která značka je hlavní. Dovednosti každé značky si ponechávají vlastní názvy a id. Lolly neslučuje dovednosti dvou značek ani nerozhoduje, která značka má přednost.

<!--i:eti-grid-->
## Stěny s logy sponzorů a akcí

Nástroj [Lolly Logo Wall](/#/tool/logo-wall) uspořádá loga do rovnoměrné mřížky pro tabuli sponzorů, snímek s partnery nebo pozadí pro tiskové konference. Na akci je hlavní značkou obvykle pořadatel: stěna vzniká v jeho designovém systému a logo každého sponzora na ní figuruje jako grafika.

![Stěna sponzorů ve třech úrovních na tmavě zeleném pozadí, všechna loga v bílé: dva zlatí partneři, tři stříbrní partneři a pět komunitních partnerů, každá úroveň pod vlastním nadpisem a každá nižší úroveň o stupeň menší](/t/url-shot?url=%2F%23%2Ftool%2Flogo-wall%3Flogos%3D%255B%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fyour-logo.svg%2522%252C%2522tier%2522%253A%2522Gold%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Flogo-here.svg%2522%252C%2522tier%2522%253A%2522Gold%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fcompany.svg%2522%252C%2522tier%2522%253A%2522Silver%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fsponsor.svg%2522%252C%2522tier%2522%253A%2522Silver%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fbrand-name.svg%2522%252C%2522tier%2522%253A%2522Silver%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fsample-co.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fexample.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Florem-ipsum.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fplaceholder.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fpartner-name.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%255D%26columns%3D3%26gap%3D64%26padding%3D96%26background%3D033633%26headingColor%3Dffffff%26vectorizeAll%3Dtrue%26inkColor%3Dffffff%26transparentBg%3Dfalse&width=1440&height=900&dpi=192&waitMs=4000&cropSelector=%23tool-canvas&format=svg&walker=1&filename=partners-logo-wall&try=1)

1. Otevři Lolly Logo Wall a přetáhni loga na **Logos**. Každé logo dostane vlastní sadu ovládacích prvků.
2. Každému logu přiřaď **Tier**, například „Zlatí partneři“. Každá úroveň dostane vlastní řádky pod svým nadpisem v pořadí, v jakém se úrovně poprvé objeví; **Tier headings** nadpisy vypne. Když je **Tier sizes** nastavené na **Step down**, vejde se do každé nižší úrovně o jedno logo na řádek víc, takže vyšší úrovně působí větší. **Presence** a **Size %** upravují jednotlivé logo v jeho úrovni.
3. Nech **Balance sizes** zapnuté. Lolly Logo Wall určuje velikost každého loga podle jeho optické váhy, takže těžké logo zmenší a lehké zvětší a každá úroveň působí vyrovnaně.
4. **Trim margins** ořízne každé logo na jeho grafiku. Vypni tuto volbu, když soubor loga už obsahuje ochrannou zónu požadovanou vlastníkem.
5. **Remove white backgrounds** odstraní bílý obdélník, ve kterém často přichází logo zkopírované ze snímku.
6. V **Layout** nastav **Columns**, mezery a odsazení. **Background** začíná barvou povrchu tvého designového systému.
7. Pro jednobarevnou stěnu zapni **Render all as vector** a vyber **Ink colour**, nebo nastav **Filter** jednoho loga na **Greyscale**. Jednobarevnou verzi použij jen tam, kde ji dovolují pokyny každého sponzora.
8. Pro pozadí tiskové konference zvol **Grid**, **Brick** nebo **Checker** v **Step & repeat** a nastav počet **Rows**.

Exportuj stěnu jako PNG, SVG, PDF nebo CMYK PDF pro tisk. V panelu exportu nastav jinou velikost a tvar, například svislé story 1080 x 1920 nebo stránku A4, a plátno stěnu znovu rozvrhne tak, aby tento tvar vyplnila, s menším nebo větším počtem log na řádku. Export odpovídá plátnu. Pro umístění stěny na plakát zvol v Lolly Design **Image** z nabídky přidávání na liště, nakresli rám a vyber Lolly Logo Wall na kartě **Tools** ve výběru ([Nástroje uvnitř návrhu](/info/design.html#tools-inside-a-design)). Pro popisky mezi logy použij v Lolly Design **Dynamic layout** nastavené na **grid**, které drží jedno obrazové pole pro každé logo ([Rozvržení v Lolly Design](/info/design-layout.html#dynamic-layouts)).

V terminálu sestaví `lolly run logo-wall logos/*.png --output=wall.svg` stěnu ze složky obrázků a CSV se sloupci `logo` a `tier` sestaví stěnu s úrovněmi. SVG a PNG nepotřebují prohlížeč ([Stěna sponzorů s úrovněmi](/info/cli-rendering.html#a-sponsor-wall-with-tiers)).

Když sponzor zveřejní [stránku značky](/info/brand-page.html), `lolly run logo-wall --logos-from=<address or folder>` převezme jeho aktuální logo pro daný povrch a vypíše, co jeho stránka říká o použití. Opakuj přepínač pro každého sponzora.

Lolly Logo Wall nezná pravidla žádného sponzora. Tiers a Presence nastavují vzájemné velikosti, ne minimální velikost sponzora, a nic nekontroluje ochrannou zónu mezi sousedy. Zkontroluj hotovou stěnu podle pokynů každého sponzora ve velikosti, ve které se bude tisknout nebo zobrazovat.

<!--i:eti-hammer-->
## Co Lolly zatím neumí

- Dílo se kreslí v jednom designovém systému. Barvy, písmo a pravidla partnera netvoří uvnitř díla designový systém a jeho značka je obrázek.
- Mimo partnerský program Lolly Work se pravidla partnera v aplikaci neukládají ani nekontrolují: ochranná zóna, minimální velikost a povolené úpravy, například jedna barva nebo inverzní provedení.
- Partnerská sada, malý balíček s logy, barvami a pravidly partnera pro použití v práci jiné značky, se do aplikace dostane jen přes partnerský program Lolly Work. Jinde se kontrola sady spouští z terminálu: `lolly check --kit=<file>` měří značky partnera v dokumentu Lolly Design ([Kontrola znovuvytvořeného návrhu](/info/cli-decks.html#check-the-recreation)).
- Lolly nevytváří sestavu ze dvou značek pro uspořádání „s“, „ve spolupráci s“ nebo „od“. Přidej hotovou sestavu jako vlastní značku.
- Pro celé zařízení je aktivní jeden designový systém, takže dvě značky nemohou být otevřené vedle sebe.
- Soubor designového systému exportovaný z aplikace neobsahuje dovednosti značky, proto je pošli jako samostatné soubory.
- Logo převzaté ze stránky značky je obrázek ve svém řádku a řádek si stránku nepamatuje. Nic neukazuje, kdo stránku zveřejnil, proto adresu zkontroluj sám.
- Hostovaná webová aplikace nemůže načíst stránku jiné značky, protože její Content Security Policy povoluje jen určené hostitele. Získej logo v terminálu nebo ulož soubor a přidej ho do **Assets**.

<!--i:eti-map-pin-->
## Kam dál

- **[Architektury značek](/info/brand-architectures.html)**: společná prezentace značek, white label a další uspořádání s postupem pro každé z nich v Lolly.
- **[Provozování partnerského programu](/info/manage/run-a-partner-programme.html)**: co partneři dostanou na tvém Lolly Work a jak program nastavit a provozovat.
- **[Sdílení návrhu s pravidly](/info/create-a-tool.html)**: opakovaně použitelné nástroje s pevným rozvržením a vstupy, které vybereš.
- **[Dovednosti značky](/info/brand-skills.html)**: jak se dovednosti píšou, čtou a předávají agentovi.
- **[Lolly Design System Setup](/info/brand-studio.html)**: loga, vlastní značky a přenos designového systému mezi zařízeními.
- **[Stránky značek](/info/brand-page.html)**: zveřejni svou značku na jedné adrese a získej logo partnera z jeho stránky.
- **[Tvůrčí práva a uvedení autorství](/info/creative-rights.html)**: co Lolly zaznamenává o dílech, která kreslí.
