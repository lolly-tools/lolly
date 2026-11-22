# Záložní písma

Když písma designového systému neumějí vykreslit písmeno, Lolly ho vykreslí otevřeným písmem Noto, takže export zachová písmeno jako vektorový obrys místo obrázku. Písma Lolly Demo, Outfit pro nadpisy a SUSE pro text, neobsahují písmena cyrilice, řečtiny, arabštiny, hebrejštiny, dévanágarí, bengálštiny, thajštiny, čínštiny, japonštiny ani korejštiny.

Písma designového systému mají vždy přednost, v uvedeném pořadí. Outfit neobsahuje vietnamská písmena, takže vietnamský nadpis je přebírá ze SUSE, dalšího písma v seznamu Lolly Demo. Záložní písmo vykresluje jen znaky, které žádné z těchto písem neumí vykreslit. Písmo značky si ponechá každé písmeno, číslici i značku, kterou obsahuje, včetně čínských znaků, a to i uvnitř slova v jiném písmu.

<!--i:eti-package-->
## Co je součástí balíčku

Patnáct písem, všechna z Google Fonts z pevně určeného commitu. U každého souboru je uvedena velikost ke stažení.

| Písmo | Font | Verze | Stažení |
|---|---|---|---|
| Arabské, včetně urdských a perských písmen | Noto Sans Arabic | 2.012 | 211 KB |
| Hebrejské | Noto Sans Hebrew | 3.001 | 37 KB |
| Dévanágarí (hindština, maráthština, nepálština) | Noto Sans Devanagari | 2.007 | 151 KB |
| Bengálské | Noto Sans Bengali | 3.011 | 139 KB |
| Thajské | Noto Sans Thai | 2.002 | 62 KB |
| Cyrilice | Noto Sans, písmena cyrilice | 2.015 | 115 KB, kurzíva 132 KB |
| Řecké | Noto Sans, řecká písmena | 2.015 | 77 KB, kurzíva 83 KB |
| Latinka, včetně vietnamských a dalších písmen s diakritikou | Noto Sans, písmena latinky | 2.015 | 316 KB, kurzíva 350 KB |
| Zjednodušené čínské, znaky GB 2312 | Noto Sans SC | 2.004 | 2.0 MB |
| Tradiční čínské, znaky Big5 | Noto Sans TC | 2.004 | 3.8 MB |
| Japonské, znaky Shift_JIS | Noto Sans JP | 2.004 | 2.2 MB |
| Korejské, všechny slabiky hangulu a znaky KS X 1001 | Noto Sans KR | 2.004 | 2.5 MB |

Každé písmo si ponechává všechny tloušťky na své ose tloušťky, takže tučný čínský, japonský nebo korejský nadpis je tučný. Písma Noto Sans mají osu šířky pevně nastavenou na normální hodnotu, což zmenšuje každý soubor na polovinu. Čínská, japonská a korejská písma osu šířky nemají. Noto Sans je rozdělené podle písem, takže slovo v cyrilici stáhne jen písmena cyrilice. Obrysy se oproti zdrojovému projektu nemění.

::: details Kde jsou písma uložená a jak se sestavují
Písma jsou v jedné sdílené složce, `community/fallback-fonts`, poskytované každému designovému systému z `/catalog/packs/fallback-fonts/`, stejně jako sady emoji. `scripts/import-fallback-fonts.ts` sestavuje soubory ze zdrojových písem pevně určených v `scripts/data/fallback-fonts.json`, kontroluje každý zdrojový soubor proti jeho zaznamenanému SHA-256 a zapisuje licenční texty vedle písem.
:::

<!--i:eti-globe-->
## Čínština, japonština a korejština

Nezkrácené čínské, japonské nebo korejské písmo má 9,6 MB až 17,8 MB. Každé je zkrácené na svou národní znakovou sadu spolu s interpunkcí, kanou, znaky plné šířky a symboly běžného textu:

- Zjednodušená čínština: GB 2312, 6 763 běžných znaků hanzi a její symboly, celkem 7 522 znaků.
- Tradiční čínština: Big5, jejích 13 053 znaků hanzi a její symboly, celkem 13 629 znaků. Hong Kong Supplementary Character Set není zahrnuta.
- Japonština: Shift_JIS tak, jak jej čtou Windows a web, tedy JIS X 0208 s doplňky NEC a IBM, které potřebují jména jako 髙 a 﨑, všechny znaky kany a katakana poloviční šířky, celkem 7 432 znaků.
- Korejština: všech 11 172 slabik hangulu a KS X 1001 s jejími 4 888 znaky hanja, celkem 17 082 znaků.

Tato čtyři písma vynechávají latinku, řecká písmena a cyrilici, které vykreslují písma designového systému a výše uvedená písma. Sady pocházejí z indexových souborů Encoding Standard z pevně určeného commitu, takže nové sestavení vytvoří stejné soubory.

Čínština, japonština a korejština sdílejí většinu znaků, ale mnohé z nich vykreslují odlišně. Například 直 se píše jinak v čínštině a jinak v japonštině. Jeden úsek textu přebírá všechny sdílené znaky z jednoho z těchto písem, nikdy ze dvou. Lolly vybírá písmo v tomto pořadí:

1. Jazyk úseku, z `lang` jeho prvku nebo nejbližšího nadřazeného prvku v dokumentu. Nastavuje ho volba jazyka nástroje, například Language u certifikátu. Jazyk vlastního rozhraní Lolly ani jazyk designového systému se nepočítají, takže se dokument exportuje pro všechny stejně.
2. Písmo úseku: kana znamená japonštinu a hangul korejštinu. Pokud úsek neobsahuje ani jedno, Lolly čte dokument, takže nadpis tvořený jen kandži v japonském dokumentu vykreslí japonsky. Dokument s kanou i hangulem v tomto kroku nic nerozhodne.
3. Znak, který používá jen tradiční čínština, například 體 nebo 說, v úseku nebo případně v dokumentu znamená tradiční čínštinu, pokud tentýž text neobsahuje i znak, který používá jen zjednodušená čínština.
4. Jinak zjednodušená čínština.

Znak, který ve zvoleném písmu chybí, se nikdy nepřebírá z některého ze zbývajících tří. Zůstane obrázkem. Kana nebo hangul, které zvolenému písmu chybí, například korejská slova v řádku označeném jako japonský, stále mohou pocházet z japonského nebo korejského písma, ale jen pokud by dané písmo nevykreslilo žádný sdílený znak řádku.

Na stránce má plátno obsahující dva z těchto jazyků v seznamu obě písma a prohlížeč vykresluje sdílené znaky prvním z nich. Export vykresluje každý úsek jeho vlastním písmem.

<!--i:eti-download-->
## Kdy se písmo stahuje

Nic se nestahuje, dokud dokument neobsahuje znak, který žádné písmo jeho designového systému neumí vykreslit. Symbol v anglickém řádku, například ★ nebo ※, nikdy nevyvolá stažení čínského, japonského ani korejského písma.

Když dokument poprvé potřebuje záložní písmo, Lolly stáhne právě toto písmo a uchová ho na tvém zařízení. Japonský dokument stáhne jen japonské písmo, 2,2 MB, a dokument v tradiční čínštině písmo pro tradiční čínštinu o velikosti 3,8 MB. Od té chvíle se dané písmo vykresluje offline a zůstává i po úklidu katalogu. Písmo se uchovává se soubory katalogu, nikdy mezi tvými nahranými písmy, a neobjeví se v seznamu písem tvé značky.

Příkazový řádek, terminálová aplikace a MCP server čtou stejné soubory z disku, takže nic stahovat nepotřebují.

<!--i:eti-eye-->
## Na stránce a v exportu

Stránka používá stejné záložní písmo jako export, takže řádek s takovými písmeny má v obou stejnou šířku. Jen na tomto plátně Lolly přidá záložní písmo za vlastní písma designového systému a před jakékoli systémové písmo. Nástroj, který nastavuje vlastní seznam písem ve stylech nebo na svých prvcích, dostane záložní písmo na stejné místo. Plátno, které pokrývá designový systém, si ponechá seznam písem beze změny.

Stránka ponechá seznam písem beze změny, pokud začíná systémovým písmem, například `system-ui` nebo Helvetica, protože export vykresluje tento text písmy designového systému, zatímco stránka ne.

V PDF se slova mění na obrysy v záložním písmu při jakémkoli nastavení textu, protože živý text PDF nemůže obsahovat znakovou sadu, která vloženému písmu chybí. V SVG, EMF, EPS, DXF a WMF se mění na obrysy, kdykoli se text převádí na obrysy. Pokud text zůstává živý, vykreslují ho vlastní písma čtečky. Když záložní písmo vykreslí část exportu, panel exportu ukáže poznámku například:

> Japonský text je vykreslen písmem Noto Sans JP, protože písma tohoto designového systému tato písmena neobsahují.

Příkazový řádek vypisuje stejnou větu jako poznámku.

<!--i:eti-image-->
## Co zůstává obrázkem

Znak mimo čtyři národní sady, například 𠮷 nebo doplňkový znak pro Hongkong, nemá záložní písmo. Vzácné znaky jako 𠮷, znaky přidané pro Hongkong jeho doplňkovou sadou i písma bez záložního písma, například tamilské, etiopské nebo syrské, se zpracovávají stejně. Záložní písmo nemají ani písma jako tamilské, etiopské nebo syrské. V PDF se řádek obsahující takový text vloží jako obrázek s rozlišením 300 dpi a panel exportu uvede použitá písma. V SVG zůstává úsek živým textem, který vykreslují vlastní písma čtečky.

::: details V exportech EPS, WMF a EMF
EPS, WMF nebo EMF se zapnutým **Outline fonts** nemá živý text, který by šlo použít jako náhradu, takže se úsek také vloží jako obrázek s rozlišením 300 dpi. Obrázek vykreslí barvu textu jen tam, kde jsou písmena, takže pozadí prosvítá. Panel exportu uvede použitá písma. Obrázek se vykresluje jen vzpřímeně, takže otočený nebo zešikmený úsek zastaví export se zprávou, která tento úsek cituje. Ve WMF nebo EMF tvoří obrázek dvojice bitmapových operací, maska a vykreslení. Microsoft Office a LibreOffice je vykreslují správně. Aplikace, která je ignoruje, například Inkscape, zobrazí slova na bílém obdélníku.

EMF s vypnutým **Outline fonts** zachovává takový úsek jako živý text, který vykreslují vlastní písma čtečky. Výjimkou je úsek, který živý text EMF nemůže obsahovat, například text s prostrkáním. Lolly tento úsek převede na obrysy, takže úsek, který žádné písmo neumí vykreslit, se i tam vloží jako obrázek.
:::

::: warning Export DXF se zastaví u textu, který žádné písmo neumí vykreslit
DXF míří do řezacích strojů a softwaru CAD, které potřebují obrysy, takže úsek, který žádné písmo neumí vykreslit, zastaví export DXF. Zpráva úsek cituje a uvádí jeho písmo. Přidej písmo s těmito písmeny nebo exportuj SVG či PDF.
:::

<!--i:eti-checklist-->
## Kontrola před exportem

Karta **Before you export** v Lolly Design a kontroly `render` příkazu `lolly check` hlásí text, který žádné písmo neumí vykreslit. Záložní písma posuzují stejně jako export, podle stejných seznamů znaků jednotlivých písem, takže text vykreslitelný záložním písmem nehlásí. Písmo bez záložního písma, například tamilské, a čínský, japonský nebo korejský znak mimo národní sady se stále hlásí, protože je export vykresluje jako obrázek nebo živý text a export DXF se u nich zastaví. Kontrola čte tyto seznamy z katalogu a žádné písmo nestahuje.

<!--i:eti-stamp-->
## Licence a uvedení autorství

Každé záložní písmo je pod licencí SIL Open Font License 1.1. Každý záznam katalogu uvádí tuto licenci s hashem licenčního textu, takže pravidla práv v [Tvůrčí práva a uvedení autorství](/info/creative-rights.html) čtou licenci stejně jako u jakéhokoli jiného písma. Licenční texty jsou vedle písem. Soubory Noto Sans nedeklarují žádný Reserved Font Name. Čínská, japonská a korejská písma patří Adobe a vyhrazují název Source. Zkrácené soubory si ponechávají názvy Noto, které tento název nepoužívají.

Licence uvádí, že se její podmínky nevztahují na dokumenty vytvořené pomocí těchto písem. Export obsahuje jen obrysy použitých písmen stejně jako u vlastních písem designového systému. Lolly pro záložní písmo nepřidává program písma, údaj o autorství ani nový záznam pověření k obsahu.
