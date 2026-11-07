# Záložní písma

Písma designového systému často pokrývají jen některé světové znakové sady. Lolly Demo sází nadpisy písmem Outfit a text písmem SUSE a ani jedno nemá cyrilici, řečtinu, arabštinu, hebrejštinu, dévanágarí, bengálštinu, thajštinu ani čínské, japonské či korejské znaky. Když dokument obsahuje znaky, které písma jeho designového systému nenakreslí, Lolly je nakreslí otevřeným písmem Noto, takže export je zachová jako vektorové obrysy a nepromění slova v obrázek.

Písma designového systému mají vždy přednost, v pořadí, v jakém je designový systém uvádí. Outfit nemá vietnamské znaky, takže vietnamský nadpis je převezme z písma SUSE, dalšího v seznamu Lolly Demo. Záložní písmo kreslí jen znaky, které žádné z těch písem nenakreslí, takže písmo značky si ponechá každé písmeno, číslici i znaménko, které má, i uvnitř slova v jiné znakové sadě. Písmo značky, které má nějaký čínský znak, si ponechá i ten.

## Co je součástí

Patnáct písem, všechna z Google Fonts v pevně určeném commitu a všechna pod licencí SIL Open Font License 1.1. U každého souboru je uvedena velikost ke stažení.

| Znaková sada | Písmo | Verze | Stažení |
|---|---|---|---|
| Arabština, včetně urdských a perských písmen | Noto Sans Arabic | 2.012 | 206 KB |
| Hebrejština | Noto Sans Hebrew | 3.001 | 37 KB |
| Dévanágarí (hindština, maráthština, nepálština) | Noto Sans Devanagari | 2.007 | 147 KB |
| Bengálština | Noto Sans Bengali | 3.011 | 136 KB |
| Thajština | Noto Sans Thai | 2.002 | 61 KB |
| Cyrilice | Noto Sans, cyrilská písmena | 2.015 | 112 KB, kurzíva 129 KB |
| Řečtina | Noto Sans, řecká písmena | 2.015 | 75 KB, kurzíva 81 KB |
| Latinka, včetně vietnamštiny a dalších písmen s diakritikou | Noto Sans, latinská písmena | 2.015 | 309 KB, kurzíva 342 KB |
| Zjednodušená čínština, znaky GB 2312 | Noto Sans SC | 2.004 | 1,9 MB |
| Tradiční čínština, znaky Big5 | Noto Sans TC | 2.004 | 3,6 MB |
| Japonština, znaky Shift_JIS | Noto Sans JP | 2.004 | 2,1 MB |
| Korejština, každá slabika hangul a znaky KS X 1001 | Noto Sans KR | 2.004 | 2,4 MB |

Osa tloušťky každého písma zůstává celá, takže se nakreslí každá tloušťka, kterou návrh žádá, a tučný čínský, japonský nebo korejský nadpis je tučný. Osa šířky písem Noto Sans je pevně nastavená na normální, což každý soubor zmenší na polovinu; čínská, japonská a korejská písma osu šířky nemají. Noto Sans je rozdělené podle písma, takže cyrilské slovo stáhne jen cyrilská písmena. Obrysy jsou původní obrysy z upstreamu, beze změny.

Písma leží v jedné sdílené složce, `community/fallback-fonts`, a každému designovému systému se podávají z `/catalog/packs/fallback-fonts/`, stejně jako se sdílejí sady emoji. `scripts/import-fallback-fonts.ts` sestaví soubory z upstreamových písem připnutých v `scripts/data/fallback-fonts.json`, zkontroluje každý upstreamový soubor proti zaznamenanému SHA-256 a vedle písem zapíše texty licencí.

## Čínština, japonština a korejština

Celé čínské, japonské nebo korejské písmo má 9,6 MB až 17,8 MB, a proto je každé z nich oříznuto na národní znakovou sadu, kterou čtenáři používají denně, plus interpunkci, kanu, znaky plné šířky a symboly běžného textu:

- Zjednodušená čínština: GB 2312, 6 763 běžných znaků hanzi a jeho symboly, celkem 7 522 znaků.
- Tradiční čínština: Big5, jeho 13 053 znaků hanzi a jeho symboly, celkem 13 629 znaků. Hongkongská doplňková znaková sada v ní není.
- Japonština: Shift_JIS tak, jak ho čtou Windows a web, tedy JIS X 0208 s doplňky NEC a IBM, které potřebují jména jako 髙 a 﨑, každá kana a katakana poloviční šířky, celkem 7 432 znaků.
- Korejština: všech 11 172 slabik hangul a KS X 1001 s jeho 4 888 hanja, celkem 17 082 znaků.

Latinka, řečtina a cyrilice jsou z těchto čtyř písem vynechány, protože je kreslí písma designového systému a písma výše. Sady se čtou ze souborů indexu Encoding Standardu v pevně určeném commitu, takže nové sestavení dá stejné soubory.

Čínština, japonština a korejština sdílejí většinu znaků, ale každá mnoho z nich kreslí jinak. Stejný znak 直 se píše v čínštině jedním způsobem a v japonštině jiným. Proto jeden úsek textu bere všechny své sdílené znaky z jednoho z těchto písem, nikdy ze dvou, a Lolly vybírá písmo v tomto pořadí:

1. Jazyk úseku, podle `lang` jeho prvku nebo nejbližšího prvku kolem něj v dokumentu. Nastaví ho jazykové nastavení nástroje, například Language u certifikátu. Jazyk vlastního rozhraní Lolly a jazyk designového systému se nepočítají, takže dokument se exportuje pro každého stejně.
2. Znaková sada úseku: kana znamená japonštinu a hangul korejštinu. Když úsek nemá ani jedno, čte se celý dokument, takže nadpis jen z kandži v japonském dokumentu se nakreslí japonsky. Dokument, který obsahuje kanu i hangul, tu nic nerozhoduje.
3. Znak, který používá jen tradiční čínština, například 體 nebo 說, v úseku nebo jinak v dokumentu, znamená tradiční čínštinu, pokud stejný text neobsahuje také znak, který používá jen zjednodušená čínština.
4. Jinak zjednodušená čínština.

Znak, který zvolené písmo nemá, se nikdy nebere z jednoho z ostatních tří. Zůstane obrázkem, jak je popsáno níže. Kana nebo hangul, které zvolené písmo postrádá, například korejská slova v řádku označeném jako japonský, mohou stále přijít z japonského nebo korejského písma, ale jen když by to písmo v řádku nekreslilo žádný sdílený znak.

Na stránce plátno s dvěma z těchto jazyků uvádí obě písma a prohlížeč nakreslí sdílené znaky prvním z nich. Export kreslí každý úsek jeho vlastním písmem.

## Kdy se písmo stahuje

Nic se nestahuje, dokud dokument neobsahuje znak, který nenakreslí žádné písmo jeho designového systému. Dokument v angličtině nebo v kterémkoli jazyce, který jeho designový systém pokrývá, nikdy záložní písmo nestáhne. Symbol v anglickém řádku, například ★ nebo ※, nikdy nestáhne čínské, japonské ani korejské písmo.

Když dokument poprvé nějaké potřebuje, Lolly stáhne právě to jedno písmo, pro tu jednu znakovou sadu, a ponechá ho na tvém zařízení. Japonský dokument stáhne jen japonské písmo, 2,1 MB, a tradiční čínský 3,6MB tradiční písmo. Od té chvíle se ta znaková sada kreslí i offline a písmo zůstane i po uklizení katalogu. Písmo se drží spolu s vlastními soubory katalogu, nikdy mezi písmy, která jsi nahrál, takže se neobjeví v seznamu písem tvé značky.

Příkazový řádek, terminálová aplikace a server MCP čtou stejné soubory z disku, takže nepotřebují žádné stahování.

## Na stránce a v exportu

Stránka používá stejné záložní písmo jako export. Bez toho by prohlížeč takové znaky kreslil systémovým písmem, zatímco export použije Noto, a řádek, který je obsahuje, by mezi oběma měnil šířku. Lolly přidá záložní písmo na konec seznamu písem designového systému jen na tom plátně, za vlastní písma designového systému a před jakékoli systémové písmo. Plátno, které designový systém pokrývá, si seznam písem ponechá přesně jako dřív.

V PDF se slova stanou obrysy nakreslenými záložním písmem, ať zvolíš jakékoli nastavení textu, protože živý text v PDF nemůže nést znaky, které vložené písmo nemá. V SVG, EMF, EPS, DXF a WMF se stanou obrysy vždy, když se text převádí na obrysy; s textem ponechaným živým je kreslí vlastní písma čtenáře, jako dřív. Když záložní písmo nakreslilo část exportu, panel exportu ukáže poznámku, například:

> Japonský text je nakreslen písmem Noto Sans JP, protože písma tohoto designového systému tyto znaky nemají.

Příkazový řádek vypíše stejnou větu jako poznámku.

## Co zůstává obrázkem

Znak mimo čtyři národní sady nemá žádné záložní písmo. Vzácné znaky jako 𠮷, znaky přidané pro Hongkong jeho doplňkovou sadou a znakové sady bez záložního písma, například tamilština, etiopština nebo syrština, se řeší všechny stejně. V PDF se řádek, který takový znak obsahuje, vloží jako obrázek v 300 dpi a panel exportu vypíše tyto znakové sady. V SVG zůstane úsek živým textem, který kreslí vlastní písma čtenáře.

## Licence a uvedení autorů

Každé záložní písmo je pod licencí SIL Open Font License 1.1 a každá položka katalogu tuto licenci zaznamenává spolu s hashem textu licence, takže pravidla práv v [Tvůrčí práva a uvedení autorů](/info/creative-rights.html) čtou licenci jako u jakéhokoli jiného písma. Texty licencí leží vedle písem. Soubory Noto Sans neuvádějí žádné Reserved Font Name. Čínská, japonská a korejská písma jsou od Adobe a vyhrazují jméno Source; oříznuté soubory si ponechávají svá jména Noto, která toto jméno nepoužívají.

Licence říká, že její podmínky se nevztahují na dokumenty vytvořené s písmy. Export obsahuje jen nakreslené obrysy použitých znaků, stejně jako u vlastních písem designového systému, a Lolly k záložnímu písmu nepřidá žádný program písma, žádný řádek s uvedením ani nový záznam Content Credentials.
