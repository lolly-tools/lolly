# Profily

Nastav jednou své jméno, kontaktní údaje a portrétní fotku a každý nástroj, který s nimi počítá, je vyplní, například e-mailový podpis, jmenovka nebo karta řečníka. Tento záznam je tvůj **profil** a je uložený na tvém zařízení.

Tvůj profil obsahuje také uložené relace, nahrané obrázky a místní počítadlo aktivity. Spravuj ho v **Settings → Preferences**. Nástroje čtou jen pole, která mají předvyplňovat. Samostatné používání nepotřebuje účet. Volitelný Sync, sdílení a služby organizace mají každý vlastní datové toky.

<!--i:eti-user-check-->
## Co profil obsahuje

| Část | Co to je |
|---|---|
| **Name** | Jméno a příjmení. |
| **Contact** | E-mail a telefon. |
| **Location** | Město a země. |
| **Headshot** | Volitelná fotka oříznutá do čtverce a uložená jako místní obrázek pro nástroje, jako jsou e-mailové podpisy, karty s citacemi a organizační schémata. |
| **Use my details to create** | Přepínač, který zapínáš sám a po zapnutí zobrazuje **Using my details**. Určuje, zda se tvé údaje přenášejí jako uvedení autora v exportovaných souborech a při bězích Lolly Batch; viz [Jak nástroje používají tvůj profil](#how-tools-use-your-profile). |
| **Preferences** | Tvůj motiv, tvůj colourway v každém designovém systému, nastavení přístupnosti a části aplikace, které jsi zapnul ve **Feature flags**. |
| **Your work** | Uložené relace s náhledy uspořádané v [Lolly Projects](/info/find-your-work.html), tvé nahrané obrázky a místní statistiky aktivity. |

Nic z toho není povinné a funguje i prázdný profil.

![Settings na kartě Preferences: lišta nastavení a Your details s přepínačem Use my details to create a poli pro jméno, kontakt a místo](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

[Nastavení Lolly](/info/dashboard.html) popisuje zbytek Preferences, od vzhledu a emoji po úložiště a stahování pro offline použití.

<!--i:eti-users-->
## Ty, tým nebo role

V Lolly profil určuje, kým při tvorbě jsi: sám sebou, týmem nebo rolí. Lolly se všemi třemi zachází stejně.

::: cols
## Sám za sebe

Výchozí možnost: tvé jméno, e-mail a portrétní fotka. Z nich se vyplní tvůj podpis, jmenovka a konferenční sestava značky.

## Za tým

Sdílený název týmu, skupinová schránka, například `events@…`, oddělení a značka týmu. Jeden člověk nastaví profil a exportuje soubor. Všichni ostatní načtou stejný profil, takže soubory týmu nesou stejné údaje. Sdílený kiosek nebo předváděcí notebook může používat jeden týmový profil.

## V roli

Organizátor akce potřebuje tři dny v roce schránku a dílčí značku akce na jmenovkách a značení, pak zase svou obvyklou identitu. Uchovávej roli jako uložený soubor profilu, načti ho pro akci a poté ho odlož.
:::

![Ovládací prvek pro portrétní fotku, prázdný, dokud nenahraješ fotku, která pak zůstane na tomto zařízení](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot&css=.profile-details-main%7Bdisplay%3Anone%7D)

::: details Profily v organizaci používající Lolly Work
Když se přihlásíš do [Lolly své organizace](/info/organisation.html), Lolly Work může dodat ověřená pole profilu od svého poskytovatele identity a pevně nastavit pole nebo předvolby podle politik organizace. Spravované pole je v aplikaci označené.

Toto přihlášení také řídí přístup ke sdíleným projektům a assetům. Soubor týmového profilu je místní soubor. Neuděluje členství v organizaci ani nenahrazuje pracovní účet. **Use my details to create** řídí uvedení autora v exportech, ne přihlašování organizace ani auditní záznamy. Viz [Soukromí](/info/privacy.html#organisation-services-with-lolly-work).
:::

<!--i:eti-copy-->
## Uchovávej více profilů, používej jeden

Instalace má vždy jeden aktivní profil a aplikace nemá přepínač profilů. Každý profil je přenosný soubor, stejný záložní soubor, který přesouvá tvou práci na nové zařízení. Kontext změníš takto:

::: timeline
- <!--i:download--> **Export my data** v **Settings → Storage → Move to another device** uloží aktuální profil jako jeden `.zip`.
- <!--i:trash--> **Clear all my data** vyprázdní tuto instalaci.
- <!--i:upload--> **Import data…** načte soubor profilu pro kontext, do kterého přecházíš.
:::

::: note Import bez předchozího vymazání slučuje data
Importované relace a obrázky se přidají. Pokud existují obě kopie, zachová se ta uložená později. Složky, oblíbené položky a šablony se přidají vedle tvých. Tvé vlastní údaje zůstanou, kromě prázdných polí, která převezmou hodnoty ze souboru. Sloučení se hodí k převzetí relací týmu do tvého prostředí, ale ne k úplnému oddělení rolí.
:::

Pro dva kontexty současně použij samostatný profil prohlížeče, uživatelský účet nebo nainstalovanou kopii webové aplikace. Každý má vlastní profil Lolly.

![Dvě tlačítka pro přesun celé instalace: Export my data zapíše jeden zip, Import data ho načte zpět](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

::: note Uchovávej jeden soubor pro každý kontext
Každý soubor pojmenuj podle jeho účelu, například `LollyTools-events-2026.zip` a `LollyTools-me.zip`. Soubor je profil.
:::

[Přesuň práci na jiné zařízení](/info/find-your-work.html#move-your-work-to-another-device) popisuje obsah souboru, co zůstane na původním zařízení a další způsoby přesunu včetně Sync.

<!--i:eti-pen-->
## Jak nástroje používají tvůj profil

**Předvyplnění.** Autor nástroje označí vstup jako čerpající z tvého profilu (`bindToProfile: "firstname"`, `"email"`, `"headshot"` a podobně). Při otevření nástroje se vstup vyplní z tvého profilu. Hodnotu můžeš pro jednu relaci přepsat bez změny profilu, pokud politika organizace vstup nezamyká. Předvyplnění probíhá lokálně bez ohledu na to, zda je **Use my details** zapnuté.

**Uvedení autora.** Při exportu se tvé údaje mohou přenést jako uvedení autora v metadatech souboru (PNG, PDF, SVG a další). **Use my details to create** řídí toto uvedení i autora při bězích Lolly Batch. S vypnutým přepínačem export stále uvádí, že vznikl v Lolly, ale nenese osobní údaj o autorovi ani kontakt.

Autoři nástrojů: viz [`bindToProfile`](/info/tool-inputs.html#bindtoprofile) a [`host.profile`](/info/host-api.html#host-profile).

![Jediný přepínač Use my details to create, označený jako volitelný a vypnutý, dokud ho sám nezapneš](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Duse-details&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

<!--i:eti-layers-->
## Profil, designový systém a funkce

Tři věci jsou v Settings blízko sebe a snadno se zamění:

- <!--i:people--> **Profile** - ty, tvůj tým nebo role, ve které jsi: jméno, kontakt, portrétní fotka a uložená práce. Osobní, uložené na zařízení a přenosné jako soubor.
- <!--i:palette--> **Design system** - značka: barvy, písma a nastavení, se kterými každý nástroj vykresluje. Sdílené, ne osobní; viz [Lolly Design System Setup](/info/brand-studio.html).
- <!--i:sliders--> **Capabilities** - co aplikace umí: funkce a nástroje, které máš k dispozici.

Toto slovo má v Lolly ještě tři významy. **Obsahový profil** je nastavení sestavení, které určuje nástroje a katalog dodávané v nasazení; pojem definuje [Slovníček](/info/glossary.html). Parametr odkazu `profile` vybírá barevný profil exportu, například tiskovou podmínku CMYK; viz [Vyhrazené parametry URL](/info/url-parameters.html#print). **Ověřená identita** je volitelný podpisový certifikát, který spojuje tvůj e-mail s podepsanými exporty. Je oddělená od těchto údajů, ale **Use my details to create** určuje, zda se vloží údaje či identita; viz [Content Credentials](/info/content-credentials-identity.html).

![Karta Verified identity v šířce telefonu: výběr doby platnosti certifikátu a pod ním krok registrace - profil identity oddělený od tvých osobních údajů](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

<!--i:eti-lock-->
## Soukromí

Tvůj osobní profil se ukládá lokálně. Tvé údaje se mohou přenášet v záloze nebo kopii Sync, v obsahu, který sdílíš nebo exportuješ, a při volitelné registraci Content Credentials. V instanci Lolly Work jsou přihlašování, sdílená práce, politika telemetrie a auditní záznamy oddělené od tohoto místního profilu. **Settings → Preferences → Clear all my data** vymaže toto zařízení; nevymaže kopie uložené u poskytovatele úložiště nebo organizace. Viz [Zásady ochrany soukromí](/info/privacy.html).
