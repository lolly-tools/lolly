# Profily

Nastav své jméno, kontaktní údaje a portrét jednou a každý nástroj, který je k tomu určen, je za tebe vyplní: e-mailový podpis, jmenovku, kartu řečníka. Ten malý záznam je tvůj **profil** a žije na tvém zařízení.

Tvůj profil také drží to, co při práci nashromáždíš: uložené relace, nahrané obrázky a místní přehled aktivity. Spravuješ ho v **Settings → Preferences**; nástroje čtou jen pole, která byly vytvořeny předvyplňovat. Samostatné používání nepotřebuje účet a volitelný Sync, sdílení i služby organizace mají každý vlastní toky dat, popsané níže.

## Co je v profilu

| Část | Co to je |
|---|---|
| **Name** | Jméno a příjmení. |
| **Contact** | E-mail a telefon. |
| **Location** | Město a země. |
| **Headshot** | Volitelná fotka, oříznutá na čtverec a uložená jako místní obrázek, pro nástroje jako e-mailové podpisy, citační karty a organizační schémata. |
| **Use my details to create** | Jeden volitelný přepínač (po zapnutí se jmenuje **Using my details**). Rozhoduje, zda tvé údaje putují jako autorské uvedení v exportovaných souborech a při během úloh Batch. Neovlivňuje předvyplňování; viz [Jak nástroje používají tvůj profil](#how-tools-use-your-profile). |
| **Preferences** | Tvůj motiv, nastavení přístupnosti a které části aplikace sis zapnul v **Feature flags**. |
| **Your work** | Uložené relace s miniaturami, uspořádané v [Projects](/info/find-your-work.html), tvé nahrané obrázky a místní statistiky aktivity. |

Nic z toho není povinné. Prázdný profil funguje; vyplň jen to, co ti ušetří psaní.

![Settings na kartě Preferences: lišta nastavení a Your details s přepínačem Use my details to create a poli jména, kontaktu a polohy](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

[Settings](/info/dashboard.html) mapuje vše ostatní pod Preferences, od vzhledu a emoji po úložiště a offline stahování.

## Ty, tým nebo role

Slovo "profil" naznačuje jednu pevnou osobu. V Lolly je blíž tvůrčímu kontextu: kým jsi, zatímco vytváříš tuhle věc. Může mít tři podoby a Lolly s každou zachází stejně.

::: cols
## Jako ty sám

Výchozí. Tvé jméno, e-mail, portrét. Nastav jednou a podpis, jmenovka i konferenční lockup se vyplní samy.

## Jako tým

Sdílený název týmu, skupinová schránka jako `events@…`, oddělení a značka týmu. Jeden člověk ji nastaví a exportuje a všichni ostatní načtou stejný profil, takže soubory týmu nesou konzistentní údaje. Sdílený kiosek nebo demo notebook může provozovat jeden týmový profil.

## Jako role

Event manager tři dny v roce chce schránku akce a podznačku akce na jmenovkách a značení, pak zase svou obvyklou identitu. Uchovej tu roli jako uložený soubor profilu, načti ji pro akci a poté odlož.
:::

![Ovládací prvek fotky, prázdný, dokud nenahraješ snímek, který pak zůstane na tomto zařízení](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot&css=.profile-details-main%7Bdisplay%3Anone%7D)

::: details Profily v organizaci používající Lolly Work
Když se přihlásíš do [Lolly organizace](/info/organisation.html), Lolly Work může dodat ověřená pole profilu od svého poskytovatele identity a pevně nastavit pole či předvolby podle politiky organizace. Spravované pole je v aplikaci označeno.

Toto přihlášení také řídí přístup ke sdíleným projektům a assetům. Soubor týmového profilu je stále místní soubor: neuděluje členství v organizaci ani nenahrazuje pracovní účet. **Use my details to create** řídí uvedení v tvých exportech, ne přihlášení do organizace ani její auditní záznamy. Viz [Soukromí](/info/privacy.html#organisation-services-with-lolly-work).
:::

## Měj jich několik, používej jeden

Instalace má najednou jeden aktivní profil a v aplikaci není žádný přepínač. Místo toho je každý profil přenosný soubor, tentýž záložní soubor, který bys použil k přesunu na nové zařízení. Chceš-li vstoupit do jiného kontextu:

::: timeline
- <!--i:download--> **Export my data** pod **Settings → Storage → Move to another device** uloží aktuální profil jako jeden `.zip`.
- <!--i:trash--> **Clear all my data** vyprázdní tuto instalaci.
- <!--i:upload--> **Import data…** načte soubor profilu pro kontext, do kterého vstupuješ.
:::

Import bez předchozího vymazání místo toho **sloučí**. Importované relace a obrázky se přidají; kde existují obě kopie, ponechá se ta uložená později. Složky, oblíbené a šablony se přidají vedle tvých a tvé vlastní údaje zůstanou, kromě prázdných polí, která převezmou hodnoty ze souboru. To se hodí pro zatažení relací jednoho týmu do tvého nastavení, ne pro čistý předěl mezi rolemi.

Pro dva kontexty najednou použij samostatný profil prohlížeče, samostatný uživatelský účet nebo druhou nainstalovanou kopii webové aplikace: každá nese vlastní nezávislý profil Lolly.

![Dvě tlačítka, která přesouvají celou instalaci: Export my data zapíše jeden zip, Import data jej přečte zpět](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> Měj jeden soubor na kontext a pojmenuj každý podle toho, co je, například `LollyTools-events-2026.zip` a `LollyTools-me.zip`. Ten soubor je profil.

[Přesuň svou práci na jiné zařízení](/info/find-your-work.html#move-your-work-to-another-device) pokrývá, co soubor obsahuje, co zůstane za ním a další způsoby přesunu, včetně Sync.

## Jak nástroje používají tvůj profil

**Předvyplňování.** Autor nástroje označí vstup jako čerpající z tvého profilu (`bindToProfile: "firstname"`, `"email"`, `"headshot"` a tak dále). Když se nástroj otevře, ten vstup se vyplní z tvého profilu a můžeš ho pro jednu relaci přepsat, aniž by se profil změnil, pokud vstup nezamyká politika organizace. Předvyplňování je místní pohodlí a probíhá, ať je **Use my details** zapnuto, nebo ne.

**Uvedení autorství.** Při exportu mohou tvé údaje putovat jako autorské uvedení v metadatech souboru (PNG, PDF, SVG a další), aby hotový soubor mohl říct, kdo dílo vytvořil. Řídí to **Use my details to create** i autora u běhů Batch. Při vypnutí export stále říká, že byl vytvořen v Lolly, a nenese žádný osobní řádek autora ani kontaktu.

Autoři nástrojů: viz [`bindToProfile`](/info/tool-inputs.html#bindtoprofile) a [`host.profile`](/info/host-api.html#host-profile).

![Jediný přepínač Use my details to create, označený jako volitelný a vypnutý, dokud ho nezapneš](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Duse-details&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## Profil, designový systém a schopnosti

Tři věci leží v Settings blízko sebe a snadno se pletou:

- <!--i:people--> **Profile** - ty, tvůj tým nebo role, ve které jsi: jméno, kontakt, portrét a uložená práce. Osobní, uchovaný na zařízení a přenosný jako soubor.
- <!--i:palette--> **Design system** - značka: barvy, písma a nastavení, s nimiž se vykresluje každý nástroj. Sdílený a konzistentní, ne osobní; viz [Design System Setup](/info/brand-studio.html).
- <!--i:sliders--> **Capabilities** - co aplikace umí: funkce a nástroje, které máš k dispozici.

Profil mění, od koho soubor je; designový systém mění, jak soubor vypadá; schopnosti jsou to, co můžeš vytvořit.

Slovo má v Lolly ještě tři další významy. **Obsahový profil** je nastavení sestavení, které vybírá, jaké nástroje a katalog nasazení nese; pojem definuje [Glosář](/info/glossary.html). Parametr odkazu `profile` vybírá barevný profil exportu, například tiskovou podmínku CMYK; viz [Rezervované parametry URL](/info/url-parameters.html#print). **Ověřená identita** je volitelný podpisový certifikát, který váže tvůj e-mail na podepsané exporty, oddělený od těchto údajů, i když **Use my details to create** řídí, zda se vkládá jedno či druhé; viz [Content Credentials](/info/content-credentials-identity.html).

![Karta Ověřená identita v šířce telefonu: výběr platnosti certifikátu a pod ním krok registrace - identitní profil, oddělený od tvých osobních údajů](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## Soukromí

Tvůj osobní profil je uložen lokálně. Tvé údaje mohou putovat v záloze nebo kopii Sync, v obsahu, který sdílíš nebo exportuješ, a při volitelném zápisu Content Credentials. V instanci Lolly Work jsou přihlášení, sdílená práce, politika telemetrie a auditní záznamy oddělené od tohoto místního profilu. **Settings → Preferences → Clear all my data** vymaže toto zařízení; nesmaže kopie držené poskytovatelem úložiště nebo organizací. Viz [Zásady ochrany soukromí](/info/privacy.html).
