# Ověř si to sám

Každý slib na tomto webu lze ověřit, bez účtu. Většina kontrol potřebuje jen prohlížeč; zbytek potřebuje terminál a kopii zdrojového kódu. Pokud kontrola níže nedá uvedený výsledek, je to chyba nebo porušený slib a chceme o tom vědět: viz [Když kontrola selže](#if-a-check-fails).

Začni nejrychlejší: přetáhni soubor na Verify. Pak jdi dál: sleduj síť při používání nástroje, vytáhni zástrčku a pracuj dál, spočítej cookies a přečti si zdroj.

Tyto kontroly pokrývají samotnou Lolly. Pokud tvá organizace provozuje Lolly Work, přidává přihlášení, sdílený obsah, nakonfigurovanou telemetrii a auditní záznamy; ty ověř proti [Server Surface](/info/server-surface.html) a [části o organizaci v zásadách ochrany soukromí](/info/privacy.html#organisation-services-with-lolly-work).

## Vidíš to fungovat, za deset sekund

Otevři [`/verify`](/#/verify) a přetáhni na stránku soubor. Žádné nahrávání, žádný účet a žádné čekání na server. Zde kontroluje [vygenerovanou queenslandskou bouři](/info/ai-stance.html) z Our AI Stance: obrázek, který vygeneroval Gemini a Lolly jej otevřela, označila a převedla. Každý odznak byl vypočten na zařízení, z vlastních bajtů souboru.

![Verify na obrazovce o šířce telefonu - obrázek bouře, zelený verdikt Made with Lolly a pod ním naskládané odznaky neporušený certifikát a nezměněné bajty](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Verdikt je malá hromádka odznaků, každý je nezávislý fakt:

- <!--i:lock--> **Made with Lolly**: credential je neporušený *a* zaznamenává export z Lolly.
- <!--i:seal--> **The credential is intact**: podepsaný manifest C2PA se parsuje a jeho vlastní podpis tvrzení se ověří.
- <!--i:hash--> **The bytes have not changed**: hash souboru stále odpovídá tomu, co bylo podepsáno. Změň jeden pixel a tento odznak se překlopí.
- <!--i:sparkle--> **GEN AI**: tyto pixely vytvořil stroj a soubor to říká. Lolly toto prohlášení čte zpět, místo aby fakt skrývala.

Celá historie putuje se souborem. Devět kroků zde přežilo: pět zaznamenal Google, když obrázek generoval a označil vodoznakem, a čtyři zaznamenala Lolly, když kopii na této stránce otevřela, označila a převedla. Verify je čte přímo z bajtů a kreslí jako časovou osu.

![Historie změn, kterou Verify čte zpátky z obrázku bouře - pět kroků zaznamenal Google, pak čtyři Lolly, konče WebPkem na téhle stránce](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

To je ukázka. Kontroly níže jsou záruky pod ní a každou lze reprodukovat. [Content Credentials](/info/content-credentials-identity.html) vysvětluje každý verdikt.

## Ve tvém prohlížeči, bez nástrojů

::: timeline
- <!--i:globe--> **1. Sleduj síť.** Otevři [lolly.tools](https://lolly.tools), otevři DevTools prohlížeče (F12), přepni na **Network** a použij nástroj: napiš webovou adresu do [QR Code](/t/qr-code), změň barvy, exportuj PNG. Každý požadavek zůstává na `lolly.tools`: shell aplikace, vlastní soubory nástroje a assety katalogu. Není tu žádný hostitel analytiky, žádný maják CDN, žádná písmová služba ani endpoint pro hlášení chyb. To, co napíšeš do nástroje, se neobjeví v **žádném požadavku**, protože vykreslování je lokální.
- <!--i:eyeoff--> **2. Vytáhni zástrčku.** Načti aplikaci a otevři jeden dva nástroje, pak přejdi offline (režim letadlo, nebo DevTools → Network → Offline) a znovu načti. Galerie a každý nástroj, který jsi otevřel, fungují dál, včetně vykreslování a exportu ve formátech, které jsi použil. Soubory nástroje a enkodér formátu se ukládají do cache při prvním použití, takže nástroj před testem offline jednou použij online. To je nejsilnější jednotlivá kontrola na této stránce: software, který telefonuje domů, přerušení šňůry nepřežije.
- <!--i:check--> **3. Spočítej cookies.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Seznam je prázdný: aplikace nenastavuje žádné cookies. Vlož `document.cookie` do konzole a dostaneš `""`. Volitelný zápis CA nastavuje krátkodobé `HttpOnly` cookie `lolly_ca_state` s rozsahem `/api/ca`, které `document.cookie` neukáže. Instance Lolly Work používá vlastní přihlašovací cookies; porovnej je se [Soukromím](/info/privacy.html#organisation-services-with-lolly-work).
- <!--i:layers--> **4. Přečti si vlastní úložiště.** Ve stejném panelu je před tebou vše, co Lolly uchovává: pár desítek prostých klíčů `localStorage` (motiv, jazyk, šířka postranního panelu, nastavení zvuku a zobrazení a kopie indexu veřejného katalogu nástrojů v cache) a tvé vlastní dokumenty v IndexedDB. Každá hodnota je čitelný řetězec nebo JSON, nic není zakódované. Vymazání dat webu tyto místní záznamy odstraní, ale ne zálohu Sync ani záznamy držené instancí Lolly Work. **Settings → Storage → Clear all my data** udělá totéž zevnitř aplikace a můžeš sledovat, jak se úložiště a cache vyprazdňují.
- <!--i:lock--> **5. Ověř, že kontakt pro zveřejnění existuje.** [`/.well-known/security.txt`](/.well-known/security.txt) odpovídá blokem kontaktu [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), ne stránkou HTML.
:::

::: details Co dalšího můžeš vidět na kartě Network
Některé funkce sahají do sítě, jen když je použiješ, a každá je viditelná na téže kartě:

- přidání **Google Font** v Design System Setup stáhne tu jednu rodinu od Googlu, po dialogu souhlasu, který to říká, jednou, před prvním stažením;
- kliknutí na předvolbu **ICC press-profile** stáhne profil z veřejného registru ICC na color.org;
- přehrávání volitelného vestavěného **rádia** streamuje ze stanice;
- zadání místa v **Meeting Planner** vyhledá to místo ve službě geokódování open-meteo kvůli souřadnicím a časovému pásmu, jednou na město (odpovědi se ukládají na tvém zařízení), a pole to říká tam, kde píšeš;
- **URL Screenshot** načte adresu, kterou jsi napsal, protože to je jeho úkol, a vidíš, jak se to děje.

Nástroj, který deklaruje síťovou schopnost, smí stahovat jen z hostitelů, které jeho manifest povoluje, a ta kontrola selhává bezpečně. Žádný dnes dodávaný nástroj žádnou nedeklaruje, takže seznam výše drží u jeho hostitelů Content-Security-Policy vynucená prohlížečem. [Zásady ochrany soukromí](/info/privacy.html) vedou kanonickou tabulku všech těchto, včetně provozu spravované instance, jako je obnovování zásad a zapnuté hlášení.
:::

## Z terminálu

**6. Vykreslovací endpoint odpovídá jen veřejnými daty.** Jediná serverová funkce, která vkládá napsané vstupy do URL, vykreslení přes hot-link, je zde živá. [Zásady ochrany soukromí](/info/privacy.html) říkají, co to znamená pro vstupy, které vložíš do odkazu.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Každé nasazení volí (`LOLLY_DISABLE_RENDER_GET=1`): na instanci, která to nastaví, stejná sonda vrátí `404`. Ten rozdíl je nastavení, které funguje, ne nesoulad.

**7. Zkontroluj služby, které tvé nasazení zapíná.** [Server Surface](/info/server-surface.html) vypisuje volitelné služby a odkazuje na jejich podrobné reference. U Lolly Work zahrň jeho ověřená API, spojení pro spolupráci, úložiště a nakonfigurované poskytovatele. Sonda veřejného lolly.tools neotestuje soukromou instanci organizace.

Pokud provozuješ vlastní instanci, [Nasazení doručování](/info/deploy-delivery.html) obsahuje kontroly vydání pro ni: integritu modelů, sondu okraje a její vzorový seznam, zobrazovací verze, bránu soukromého stahování a podepsaný katalog v prohlížeči.


## Ve zdrojovém kódu

Všechno výše by mohlo být stále divadlo, kdyby se nasazený kód lišil od veřejného. Zkontroluj tedy kód. Nasazení se sestavuje z [veřejného repozitáře](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Žádný tracker ani SDK analytiky nikde.** Prohledej kód, který se dodává (engine, každý shell včetně rozšíření prohlížeče, přepisy mostu Tauri a service worker, serverové funkce a balíčky nástrojů), na obvyklá podezřelá:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

Tento sken hledá SDK sledování třetích stran. Neukazuje nepřítomnost vlastního hlášení používání: Lolly Work podporuje telemetrii organizace a samostatný auditní log, s vlastní politikou a testy.

**9. Žádný překladač DNS třetí strany.** Kontrola SEAL ve Verify nikdy neposílá dotaz přes poskytovatele DNS-over-HTTPS, protože aplikace nemá žádný překladač:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Certifikační služba nevede žádný log vydávání.** Identitní CA nevede žádný log toho, co vydala, ani inventář identit: žádný řádek na stdout, žádný webhook, žádné úložiště certifikátů. Nepřítomnost lze vyhledat:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

CA udržuje krátkodobý pracovní stav: kbelíky omezování frekvence drží hashované klíče IP a e-mailu po dobu svého okna a úložiště přijetí spravovaného nasazení drží klíčovaný identifikátor a digest požadavku nejvýše deset minut. Podrobnosti uvádí [Content Credentials engineering](/info/content-credentials-engineering.html#protocol).

## Vynuceno testy

Kontroly zdroje výše nejsou jednorázový audit: jsou připnuté v testovací sadě, takže nemohou potichu zahnít. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) kontroluje delší seznam jmen trackerů než sken výše a shodí sestavení, pokud:

- se kdekoli v dodávaném zdroji, který prohledává, objeví jakékoli SDK analytiky nebo sledování, napříč kódem aplikace, enginu, serveru, rozšíření a balíčků nástrojů;
- se v tom zdroji objeví jakýkoli překladač DNS-over-HTTPS třetí strany;
- se vrátí log vydávání CA, ve zdroji **nebo** ve generovaném serverovém balíku;
- zásady ochrany soukromí ztratí své zákonem požadované údaje (pojmenovaný správce, právní základ, právo podat stížnost).

Spusť je sám v klonu (Node 22.18 nebo novější; tento soubor nepotřebuje `pnpm install`):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Celá sada (`pnpm install && pnpm test`) spustí ještě několik tisíc dalších, včetně adversariálních kryptografických testů popsaných v [Security & Verification](/info/security.html).

## Co zvenčí ověřit nelze

- **Přístupové logy hostingu.** Každý server, který odpovídá na požadavek, jej může zalogovat: IP adresu, cestu a čas. Vnější sonda nemůže zjistit, jak dlouho se logy uchovávají. Logování, rotaci a exporty řídí provozovatel a musí tyto volby zveřejnit. Místní vykreslování drží běžné úpravy na tvém zařízení; volitelné serverové vykreslování a služby sdíleného pracovního prostoru mají samostatné toky dat popsané v zásadách ochrany soukromí.
- **Že nasazení běží tento kód.** Můžeš zkontrolovat, že zdroj je čistý a že nasazené chování mu odpovídá, a výše uvedené kontroly dělají obojí. Atestace webového nasazení na úrovni binárního kódu není něco, co webová platforma nabízí. Zmírněním jsou veřejný repozitář, vynucené testy a offline kontrola: pozměněné nasazení, které telefonuje domů, selže v kontrolách 1 a 2 zároveň.
- **Hooky nástrojů.** Volitelná logika vestavěného nástroje je revidována, ne izolována: běží ve stránce, pokud se nástroj nepřihlásí k Workeru. Každý nástroj na lolly.tools je prvostranný a před dodáním revidován. [Threat Model](/info/threat-model.html#trust-boundaries) uvádí, kde hooky běží a co je omezuje.

## Když kontrola selže

Rozdíl mezi touto stránkou a tím, co pozoruješ, je bezpečnostní hlášení. Pošli jej soukromými kanály na [Security & Verification](/info/security.html#reporting-a-vulnerability). Praktikujeme koordinované zveřejňování a uvádíme nahlašovatele.
