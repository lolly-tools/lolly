# Lolly pro provozovatele

Můžeš být tím, kdo řekl ano něčemu bezpečnému i oblíbenému zároveň. Jedním tahem uzavřeš díru pro exfiltraci dat, získáš schopnosti a smažeš frontu žádostí, což je vzácné bezpečnostní vítězství, díky kterému si tě lidé oblíbí víc, ne míň: žádný telefonát ve tři ráno kvůli tomu, že se embargované soubory dostaly do náhodného webového nástroje, méně dodavatelů a smluv na tvém stole a záznam, na který můžeš ukázat, když se někdo zeptá. Vyber si níže dráhu, která odpovídá funkci, za kterou zodpovídáš.

Řídíš celou štafetu: kreativec autoruje pravidla a vývojář je škáluje, a je to operátor, kdo z toho udělá něco, co lze bezpečně provozovat napříč organizací, což [Životní cyklus kampaně](/info/overview.html#the-lifecycle-of-a-campaign) sleduje od začátku do konce.

Jsi tu nový? [Zavádění a governance](/info/adoption-governance.html) je kompletní rozjezd nasazení. [Nasazení](/info/deployment.html) pokrývá deploy, provoz a hybridní režim, a [Konfigurace](/info/configuration.html) je to, co formuje jednu instanci.

## Obchod

Vejdi na schůzku přesně s tím souborem, který potřebuješ, vytvořeným cestou tam. Vlož prezentaci, kterou už máš, a přestav ji ostře jako nativní soubor prezentace, bez fronty žádostí mezi tebou a assetem.

- **[Lolly pro obchodní týmy](/info/sales.html)** - playbook: oprava prezentace, kterou máš, její nativní přestavba a samostatná výroba jednorázového assetu.
- **[Export a formáty](/info/exporting.html)** - část exportního panelu pro prezentace, PDF a obrázky, když se soubor musí otevřít na cizím notebooku.

## Tisk

Živá data do grafů, map a tabulek, které už odpovídají house stylu. Postav formát příběhu jednou a použij ho znovu pokaždé, když příběh vyjde, pro tisk i pro obrazovku.

- **[Lolly pro redakce](/info/press.html)** - playbook: info-redakční styl, vstup živých dat a výstup v publikační kvalitě.
- **[Pomocná zobrazení](/info/utilities.html)** - tabulkový procesor a konvertor, pro krok před grafem.

## Marketing

Každá velikost, každý jazyk, jeden zdroj pravdy. Vlož tabulku a dostaneš jeden hotový soubor na řádek, bez agentury uprostřed rutinních souborů.

- **[Lolly pro marketingové týmy](/info/marketing.html)** - playbook: varianty ve velkém objemu, lokalizace a co přestává být úzkým hrdlem.
- **[Používání Lolly](/info/using.html#batch-pro-mode)** - samotný dávkový běh: tabulka na vstupu, složka assetů na výstupu.

## Zabezpečení

Obvyklý způsob, jakým se dělá rutinní kreativní práce, je plocha odpovědnosti: soubory posílané e-mailem externím dodavatelům, assety značky nahrávané do desítky webových editorů, zákaznická data vkládaná do cizí stránky kvůli rychlé grafice. Lolly je na to imunitní odpovědí, protože tu práci nahrazuje místo toho, aby nad ní přidávala kontrolu: citátová karta, lokalizovaný banner a začerněný screenshot vznikají přímo na zařízení zaměstnance podle tvé značky, takže se nikam nenahraje nic, co jsi tam nedal, a každý výsledek je reprodukovatelný ze svých vstupů. Exporty mohou nést několik vrstev kryptografického záznamu - C2PA Content Credential podepsaný klíčem vygenerovaným na zařízení, který z něj nikdy nelze přečíst, neviditelný Lolly Imprint a volitelnou trvalou značku, která přežije opětovné uložení - z nichž každá je odhalitelná při neoprávněné manipulaci a odstranitelná: credential manipulaci signalizuje, ne že jí brání, a přesně to umožňuje plně offline ověření. Kryptografie a parsery souborů procházejí hardeningem na podnikové úrovni od SUSE: pečetě, podepisování na zařízení a šifrování jsou reálné a obhajitelné už teď, takže tam, kde smlouva vyžaduje certifikovanou záruku, je nasaď jako obranu do hloubky (defence-in-depth), zatímco tento proces probíhá.

- **[Důvěra](/info/trust.html)** - každé tvrzení, které tento web dělá, s mechanismem, který ho vynucuje, vedle něj.
- **[Zabezpečení a ověřování](/info/security.html)** - standardy, primitivy, model důvěry a testování, napsáno pro recenzenta.
- **[Model hrozeb a hranice důvěry](/info/threat-model.html)** - proti čemu se Lolly brání, proti čemu výslovně ne a kde přesně leží každá hranice.
- **[Serverová plocha](/info/server-surface.html)** - úplný soupis toho, co běží na straně serveru (dvě volitelné komponenty) oproti tomu, co běží na zařízení.
- **[Přehled parserů](/info/parser-inventory.html)** - každý parser, který se dotkne souboru, jenž uživatel otevře, a proti čemu je každý z nich zpevněný.
- **[Ověř si to sám](/info/verify-yourself.html)** - projdi tvrzení proti reálnému exportu, krok za krokem, bez ničeho, co bys nemohl spustit sám.
- **[Zásady ochrany osobních údajů](/info/privacy.html)** - formální prohlášení o tom, co se sbírá, ukládá a odesílá a co ne.
- **[Suverénní kreativní produkce](/info/sovereign-production.html)** - nasazení bez připojení k síti (air-gapped), síťová komunikace podmíněná souhlasem a podepisování na zařízení.
- **[Zavádění a governance](/info/adoption-governance.html)** - kdo schvaluje nástroj, jak se pravidla značky stávají vynutitelnými a co ti přinese možnost katalogu jako repozitáře.

## Právní

MPL-2.0 bez dohody o licenci přispěvatele, řečeno jasně, a to, co se netvrdí, je řečeno stejně jasně jako to, co se tvrdí. Content Credentials jsou odhalitelné při neoprávněné manipulaci a odstranitelné, takže stránky níže říkají, co podpis skutečně tvrdí, dřív než to někdo zapíše do smlouvy.

- **[Označování AI a EU AI Act](/info/eu-ai-act.html)** - Článek 50, Code of Practice, který odkazuje na C2PA, a upřímné zařazení Lolly v něm.
- **[Jak si Lolly stojí ve srovnání](/info/positioning.html)** - licenční fakta: MPL-2.0, žádná dohoda o licenci přispěvatele a na čem skutečně stojí "zdarma navždy".
- **[Content Credentials Identity](/info/content-credentials-identity.html)** - co podepsaný credential tvrdí, co netvrdí a koho jmenuje certifikát.
- **[Přenos dat](/info/data-transfer.html)** - záložní balíček, kterým se odpovídá na žádost o záznamy nebo na předání zařízení.

## AI

Agenti dodávají vstupy, nikdy personu. AI pomáhá, když je o to požádána, co vytvořila, to i říká, a tvá práce nese tvé jméno, ne jméno modelu.

- **[Náš postoj k AI](/info/ai-stance.html)** - co Lolly s vygenerovaným obsahem dělá a nedělá, a co každý tento závazek vynucuje.
- **[Vygenerováno jednou, vykresleno stejně](/info/ai-features.html)** - funkce AI, které se dodávají, a proč je vymýšlení pixelů označené, zatímco jejich odstraňování ne.
- **[Vstup, ne napodobování](/info/input-not-impersonation.html)** - proč agent dodává vstupy a nikdy personu, jak je to vynucené a co nezvládne ani zlotřilý agent.
- **[AI agenti](/info/ai-agents.html)** - co agent skutečně může řídit, pokud na to tvé týmy už nějakého nasazují.
