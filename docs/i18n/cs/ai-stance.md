# Náš postoj k AI

Lolly vznikla uprostřed největší změny ve způsobu tvorby médií od dob knihtisku, a to lidmi, kteří z AI nejsou ani vyděšení, ani nadšení bez dechu. Tato stránka jasně formuluje postoj projektu a ke každému tvrzení přidává mechanismus, který ho vynucuje, abys mohl ověřit, ne jen věřit.

> "Pijeme, jako by kohoutek měl každou chvíli vyschnout. Nevyschne - dnešní AI je to nejhorší, čím kdy bude. Pokud tu potopu přežijeme, nebude to hromaděním toho, co je v té rezavé nádrži dole na kopci, plné sedimentu. Bude to zavlažováním a rekultivací ***naší*** vlastní půdy pro prosperující budoucnost."
>
> - Andy Fitzsimon, přispěvatel Lolly

![Supercelární bouře propukající nad usedlostí v australském vnitrozemí - nádrž a kůlny dole, povodňová voda už protíná koryta suchou pastvinou](/info/the-flood.webp)

%file{Gemini_Generated_Image_vmy7thvmy7thvmy7.png} %entity{Gemini} vygenerovaný obrázek %sig{signed by %entity{Google LLC}} %entity{Lolly} %act{opened}, %act{resized} a %act{exported to WebP} jako %file{the-flood.webp} %detail{10.6 MB down to 0.8 MB} %sig{signed by %entity{Lolly}} [Ověřit nyní](/#/verify?src=%2Finfo%2Fthe-flood.webp)

Abychom byli přesní, protože tahle stránka tvrdí, že na přesnosti záleží: obrázek výše je vygenerovaný, ne vyfocený. Na tu usedlost nemířil žádný fotoaparát, protože žádná taková usedlost neexistuje. Zobrazuje region Queensland v Austrálii, zadaný promptem ze Spojeného království, vygenerovaný v datacentru ve Spojených státech. Snaží se být věrný místu, aniž by byl jeho záznamem, a přesně to je celý důvod, proč to jeho Content Credentials uvádějí.

Takhle to vypadá, když si to ověříš. V souboru přežije devět kroků: pět zaznamenal Google při generování a vodoznačení obrázku, čtyři pak Lolly při otevření, vytvoření, označení a konverzi verze na této stránce. Lolly nic negenerovala a její záznam to tak i uvádí.

![Historie změn, kterou Lolly zpětně vyčte z hotového souboru - pět kroků zaznamenal Google, čtyři pak Lolly, s výsledkem ve WebP na této stránce](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Andyho metafora pro povodeň je tato: postoj nedostatku vůči AI - vsadit vše na pár vyvolených, dnes se okrádat a starat se později - znamená pít zkaženou vodu z nádrže, zatímco se spouští déšť a povodňová voda se žene přes pláně přímo k tobě. Generovaný obsah se brzy stane efektivně nekonečným. Když se něco stane nekonečným, jeho hodnota se přesune na to, co kolem něj zůstává vzácné: důvěru, provenanci, soudržnost značky a lidský úsudek. Lolly není větší kýbl na tu povodeň. Je to zavlažování - kanály, které vodu usměrňují, a půda, kde věci skutečně rostou.

## Postoj v pěti závazcích

- <!--i:layers--> **AI je vítaná jako vstup, nikdy jako vydávání se za někoho jiného.** Agenti jsou plnohodnotní uživatelé Lolly: spouštějí stejné nástroje jako lidé, přes [server MCP](/info/mcp.html) a [režim URL](/info/url-mode.html), v přesně stejných omezeních. Nástroj, který nemůže vydat zdroj mimo značku pro člověka, ho nemůže vydat ani pro agenta - zábrany je jedno, kdo hází míčem. Co žádný agent dělat nesmí, je vydávat svůj výstup za něco, čím není.
- <!--i:shieldcheck--> **AI se sama deklaruje.** Když pixely vygenerovala AI, export to říká: strojově čitelné tvrzení v Content Credentials souboru a viditelný odznak GEN AI, kdykoli to někdo ověří. Lolly také čte a zobrazuje deklarace AI u souborů vytvořených jinde a označuje, kdy je pravděpodobně přítomný vodoznak SynthID - přičemž čte deklaraci, ne samotný vodoznak. Stejné pravidlo váže vlastní přepisovač textu Lolly fungující na zařízení: každá věta, kterou napíše, nese veřejný statistický vodoznak ve výběru slov, zveřejněný tady i v samotném nástroji, takže text napsaný modelem zůstává sebedeklarující i jako čistě textová kopie - a kdokoli si to může ověřit na stránce [Ověření](/info/verify-yourself.html). Toto schéma je veřejné z podstaty: ověření pro každého, tajemství pro nikoho. Publikum si zaslouží vědět, jak média vznikla - tahle věta se objevuje na naší stránce [Inkluzivní design](/info/inclusive-design.html) jako etický závazek, a právě tohle ho dělá skutečným. A když jsou média, která jsi označil jako vytvořená AI, umístěná do návrhu, vlastní certifikát exportu to říká taky: složená značka původu a podepsané, strojově čitelné oznámení o AI.
- <!--i:check--> **Původ je ve výchozím stavu zapnutý.** Exporty nesou [Content Credentials](/info/content-credentials-identity.html) ve výchozím stavu, ne jako skryté nastavení. Řetězec pokrývá úpravy a přísady, takže historie díla cestuje s ním. Můžeš si to [ověřit sám](/info/verify-yourself.html) u jakéhokoli souboru, který Lolly vytvoří.
- <!--i:people--> **Lidé zůstávají autory.** Každý vstup je nakonec rozhodnutí, spuštěné někde člověkem, bez ohledu na to, kolik systémů nebo odboček bylo potřeba, aby se sem dostalo. Agent může rozhodnutí donést daleko. Nemůže ho vytvořit. Slova, obrázek, paleta, volba, která vyžadovala úsudek: nástroje ten úsudek škálují, nenahrazují ho. Zdlouhavé části jsou to, co se automatizuje: kontrola shody se značkou, opakovaný export v každé velikosti, ruční lokalizace. Co zůstává, je autorství.
- <!--i:globe--> **Kanály, ne nádrže.** Dnešní modely jsou podlaha, ne strop, takže odmítáme stavět cokoli, jehož hodnota závisí na hromadění přístupu k nim. Jádro je open source, vykresluje na tvém vlastním zařízení a funguje offline. Neexistuje žádný příkop modelu, žádný měřič využití, žádný byznys založený na nedostatku připnutý k samotné povodni. Trvalou investicí je infrastruktura kolem vody - a právě tuto infrastrukturu rozdáváme zdarma.

## O lidské rozhodnutí tu jde především

Buďme naprosto jasní v tom, co stojí pod každým z výše uvedených závazků.

Jednotlivci formují zemi i naši historii. Jejich rozhodnutí, dělaná jedno po druhém, se stávají světem, ve kterém žijeme všichni ostatní. Tvoří ho jejich činy. Není to sentiment, je to prostě způsob, jakým se kdy cokoliv stalo.

Proto posilujeme lidské rozhodování a nekompromitujeme ho. Právo volby. Vlastní jednání. Autonomie. Schopnost rozhodnout se a jednat, a aby ten čin byl tvůj.

Nástroje tady zvětšují to, co se rozhodl člověk. Nerozhodují za něj a nikdy ho tiše nenahrazují. Tam, kde rozhodnutí nese automatizace, záznam pořád vede zpátky k člověku, který ho spustil, ať už prošel jakýmkoli počtem systémů a odboček.

Ctíme to od začátku do konce a zaznamenáváme to: kvůli historii, kvůli odpovědnosti, kvůli důvěře a kvůli zítřku.

## AI za tvých podmínek

AI tu nikdy nepotřebuješ. Pokud si ji zvolíš, platí tři věci:

- <!--i:people--> **Máš to pod kontrolou.** AI pomáhá jen když o to požádáš, a jen s částí, na kterou ukážeš. Nic se nerozhoduje za tebe.
- <!--i:check--> **Přestává to stát.** Pokud ti AI jednou pomůže něco vytvořit, výsledek je tvůj. Použít to znovu je zdarma, ať už to potřebuješ kolikrát chceš.
- <!--i:shieldcheck--> **Zůstává to poctivé.** Část vytvořená AI to uvádí, a to, co vytvoříš, nese tvé jméno místo předstírání, že jsi někdo jiný. Dokonce i vestavěná nápověda funguje takhle: [Ask Lolly](/info/ask.html) odpovídá vlastní větou z manuálu a odkazem, nikdy vymyšlenou odpovědí.

## Co tohle není

- <!--i:check--> **Není to zákaz.** Nástroje mohou AI použít, kde to práci prospívá, a agenti jsou podporovaným publikem - viz [AI Agents](/info/ai-agents.html).
- <!--i:seal--> **Není to nárok na čistotu.** Lolly čte provenienci široce a zapisuje ji poctivě; nepředstírá, že rozpozná každý generovaný pixel na internetu.
- <!--i:sunburst--> **Není to morální panika.** Nepřítelem není příval sám. Nepřiznaná voda ano.

## Jak nás k tomu přidržet

Každý závazek výše je vynucen v otevřeném kódu, ne v PDF s politikou: cesta provenience, značení GEN AI i garance bez trackerů - to všechno má testy, a stránka [Verify It Yourself](/info/verify-yourself.html) tě provede tím, jak si tvrzení ověřit na skutečném exportu. Pokud najdeš místo, kde se kód a tahle stránka rozcházejí, chyba je v kódu.
