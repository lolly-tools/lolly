# Náš postoj k AI

Lolly vytvořili uprostřed největší změny v tvorbě médií od vynálezu tiskařského lisu lidé, kteří z AI nepanikaří ani nejsou z technologie bez dechu. Tady je postoj projektu spolu s mechanismem za každým závazkem, abys mohl ověřovat místo pouhé důvěry.

> „Pijeme, jako by měl kohoutek každou chvíli vyschnout. Nevyschne - dnešní AI je nejhorší, jaká kdy bude. Pokud přežijeme povodeň, nebude to tím, že budeme hromadit to, co je v rezavé nádrži na vodu dole pod kopcem, plné usazenin. Bude to tím, že budeme zavlažovat a zúrodňovat ***naši*** půdu pro prosperující budoucnost.“
>
> - Andy Fitzsimon, přispěvatel Lolly

![Supercelární bouře propukající nad usedlostí v australském vnitrozemí - dole nádrž a kůlny, povodňová voda už vyřezává koryta v suché pastvině](/info/the-flood.webp)

%file{Gemini_Generated_Image_vmy7thvmy7thvmy7.png} %entity{Gemini} vygenerovaný obrázek %sig{signed by %entity{Google LLC}} %entity{Lolly} %act{opened}, %act{watermarked} a %act{exported to WebP} jako %file{the-flood.webp} %detail{10.6 MB down to 0.8 MB} %sig{signed by %entity{Lolly}} [Ověř to hned](/#/verify?src=%2Finfo%2Fthe-flood.webp)

Abychom byli přesní, protože tato stránka tvrdí, že na přesnosti záleží: obrázek výše je vygenerovaný, ne vyfotografovaný. Na tu usedlost nemířil žádný fotoaparát, protože žádná usedlost neexistuje. Zachycuje venkovský Queensland v Austrálii, podle zadání ze Spojeného království, vygenerovaný v datacentru ve Spojených státech. Snaží se věrně vystihnout místo, aniž by byl jeho záznamem, a právě tento rozdíl je jediným důvodem, proč obrázek nese Content Credentials.

Takhle to vypadá, když soubor zkontroluješ. V souboru se zachovalo devět kroků: pět zaznamenal Google při generování obrázku a přidávání vodoznaku, pak čtyři zaznamenala Lolly při otevření, vytvoření, označení a převodu verze na této stránce. Lolly nic nevygenerovala a její záznam to říká.

![Historie změn, kterou Lolly čte z hotového souboru - pět kroků zaznamenaných Google, pak čtyři od Lolly, končící souborem WebP na této stránce](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

V Andyho obrazu znamená přistupovat k AI jako k nedostatkovému zdroji pít zkaženou vodu z nádrže, zatímco se po pláních žene povodeň. Generovaný obsah bude brzy prakticky nekonečný. Když se něco stane nekonečným, jeho hodnota se přesune k tomu, co kolem něj zůstává vzácné: důvěře, provenienci, jednotnosti značky a lidskému úsudku. Lolly není větší kbelík na povodeň. Je to zavlažování: kanály, které vedou vodu, a půda, kde něco skutečně roste.

<!--i:eti-checklist-->
## Postoj v pěti závazcích

- <!--i:layers--> **AI je vítaná jako vstup, nikdy jako vydávání se za něco jiného.** Agenti jsou plnohodnotnými uživateli Lolly: spouštějí stejné nástroje jako lidé přes [MCP server](/info/mcp.html) a [režim URL](/info/url-mode.html), v naprosto stejných mezích. Žádný agent ale nesmí vydávat svůj výstup za něco, čím není. [Vstup, ne vydávání se za něco jiného](/info/input-not-impersonation.html) vymezuje tuto hranici.
- <!--i:shieldcheck--> **AI se přiznává.** Když pixely vygenerovala AI, export to uvede: strojově čitelným tvrzením v Content Credentials souboru a viditelným odznakem GEN AI při každém ověření souboru. Když do návrhu vložíš média, která jsi označil jako vytvořená AI, uvedou to i vlastní údaje o původu exportu: značka složeného původu a podepsaná, strojově čitelná deklarace použití AI. Lolly také čte a zobrazuje deklarace AI u souborů vytvořených jinde a upozorní, když je pravděpodobně přítomen vodoznak SynthID, přičemž čte deklaraci, ne samotný vodoznak. Stejné pravidlo platí i pro vlastní nástroj Lolly na přeformulování textu, který běží na zařízení: každá věta, kterou napíše, nese ve volbě slov veřejný statistický vodoznak, popsaný zde i v nástroji, takže text napsaný modelem sám deklaruje svůj původ i jako kopie v prostém textu a kdokoli ho může zkontrolovat v [Lolly Verify](/#/verify) ([jak kontrola funguje](/info/what-verify-checks.html#text-reworded-by-lolly)). Schéma je záměrně veřejné: ověřování pro všechny, tajemství pro nikoho. Publikum si zaslouží vědět, jak média vznikla.
- <!--i:check--> **Provenience je ve výchozím stavu zapnutá.** Exporty nesou [Content Credentials](/info/content-credentials-identity.html) ve výchozím stavu, ne jako skryté nastavení. Řetězec pokrývá úpravy a vstupní materiály, takže historie díla putuje s dílem. Můžeš si to [ověřit sám](/info/verify-yourself.html) na jakémkoli souboru, který Lolly vytvoří.
- <!--i:people--> **Lidé zůstávají autory.** Slova, obrázek, paleta, rozhodnutí vyžadující úsudek: nástroje rozšiřují dosah tohoto úsudku a nikdy člověka nezastupují. Automatizují se úmorné části: kontrola souladu se značkou, opakované exporty v každé velikosti, ruční lokalizace. Zůstává autorství.
- <!--i:globe--> **Kanály, ne kbelíky.** Dnešní modely jsou spodní mez, ne strop, proto odmítáme vytvářet cokoli, jehož hodnota závisí na hromadění přístupu k nim. Engine je open source, vykresluje na tvém vlastním zařízení a funguje offline. Žádná konkurenční bariéra založená na modelu, žádné měření spotřeby, žádné podnikání založené na nedostatku kolem samotné povodně. Trvalou investicí je infrastruktura kolem vody - a právě tu infrastrukturu dáváme zdarma.

<!--i:eti-user-check-->
## Podstatou je lidské rozhodnutí

Jednotlivci utvářejí Zemi a naše dějiny. Jejich volby, činěné jedna po druhé, se stávají světem, ve kterém žijeme my ostatní. Jejich činy tento svět tvoří. Tak se věci děly vždy.

Proto posilujeme lidské rozhodování a nikdy v tom neděláme kompromisy. Právo volby. Schopnost jednat. Autonomie. Možnost rozhodnout se a jednat a možnost, aby ten čin byl tvůj.

Zdejší nástroje rozšiřují dosah toho, co rozhodl člověk, a nikdy potichu nerozhodují za něj. Když rozhodnutí provádí automatizace, záznam stále vede zpět k člověku, který ji spustil, bez ohledu na to, kolika systémy a odbočkami cestou prošlo.

Dodržujeme to od začátku do konce a zaznamenáváme to: kvůli historii, odpovědnosti, důvěře a budoucnosti.

<!--i:eti-sliders-->
## AI podle tvých podmínek

AI tady nikdy nepotřebuješ. Pokud si ji zvolíš, platí tři věci:

- <!--i:people--> **Rozhoduješ ty.** AI pomáhá jen na tvou žádost a jen s částí, kterou jí určíš. Nic se nerozhoduje za tebe.
- <!--i:check--> **Další použití už nic nestojí.** Pokud AI jednou pomůže něco vytvořit, výsledek je tvůj. Opakované použití je zdarma, ať výsledek potřebuješ kolikrátkoli.
- <!--i:shieldcheck--> **Zůstává poctivá.** Dílo vytvořené AI to o sobě říká a to, co vytvoříš ty, nese tvé jméno a nevydává se za práci někoho jiného. Takto funguje i vestavěná nápověda: [Ask Lolly](/info/ask.html) odpovídá přímo větou z příručky a odkazem, nikdy si odpověď nevymýšlí.

<!--i:eti-info-->
## Co to neznamená

- <!--i:check--> **Žádný zákaz.** Nástroje mohou používat AI tam, kde pomáhá práci, a agenti patří mezi podporované uživatele - viz [AI agenti](/info/ai-agents.html).
- <!--i:seal--> **Žádné tvrzení o čistotě.** Lolly čte provenienci v širokém rozsahu a poctivě ji zapisuje; nepředstírá, že odhalí každý vygenerovaný pixel na internetu.
- <!--i:sunburst--> **Žádná morální panika.** Záplava není nepřítel. Voda bez uvedeného původu ano.

<!--i:eti-search-->
## Ověř si tyto závazky sám

Každý výše uvedený závazek vynucuje otevřený zdrojový kód, ne PDF se zásadami: cesta provenience, označování GEN AI i záruka absence sledovacích prvků se dodávají s testy a stránka [Ověř si to sám](/info/verify-yourself.html) tě provede ověřením těchto tvrzení na skutečném exportu.
