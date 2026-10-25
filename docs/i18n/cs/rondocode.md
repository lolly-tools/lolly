# Písně Rondocode

Píseň rondocode je hudba psaná jako kód: syntezátory, vzory a mix, přehrávané při psaní. Lolly umí přehrát píseň pod videem a utilita **Rondocode** umožňuje jednu napsat a exportovat jako zvuk. Obojí zaznamenává píseň v Content Credentials souboru, takže hudba říká, odkud pochází.

## Přehraj píseň v Lolly

Výběr assetů přijímá píseň jako soubor `.rondo` nebo `.rondo.json`, nebo jako vložený sdílený odkaz `rondocode.com`. Píseň je kód, který vytváří vlastní zvuk, takže hraje v jakékoli délce, kterou její klip žádá. Může být **music bed** pod video exportem nebo hrát v ambientním přehrávači Neurospicy Mode.

Kód písně běží v sandboxu Lolly, bez sítě a bez přístupu k tvým souborům. Jakákoli část, kterou vykreslení nedokáže přehrát, například živý mikrofon nebo zpěv bez hlasových modelů, je uvedena v podrobnostech assetu.

Z terminálu bere `lolly mix` píseň jako celou zvukovou stopu; viz [Vykreslování pomocí CLI](/info/cli-rendering.html).

## Napiš a exportuj píseň

Otevři **Rondocode** z **Utilities**, abys napsal píseň v živém editoru rondocode a slyšel ji při psaní. Exportuj ji jako **WAV**, **MP3**, **M4A**, **Opus** nebo **FLAC**, jako ZIP stop, jako **MIDI** nebo jako nahrávku toho, co hraje. **Export length** nastavuje, kolik sekund zvukový export trvá. Samotný soubor písně (`.rondo.json`) je tvůj kód tak, jak je psán, a nenese nic přidaného.

Píseň může zpívat svůj text pomocí `sing()`. Zpěv vytvářejí na tvém zařízení stažené hlasové modely a soubor, který drží syntetizovaný zpěv, vždy deklaruje zpěv jako generovaný AI (viz [Funkce AI](/info/ai-features.html)).

## Písně v credential

Video nebo audio export, který hraje píseň rondocode, zaznamenává každou píseň v Content Credentials jako zdroj:

- jméno písně;
- SHA-256 jejího souboru `.rondo.json`;
- jak byla vykreslena: v sandboxu Lolly, třída provádění `vm`, s verzí a seedem vykreslovače a jakoukoli částí, kterou vykreslení nedokázalo přehrát.

Hudba vypočítaná z kódu písně je označena jako algoritmické médium, takže ji Verify neoznačí jako AI. Před exportem řádek pod **Download** vypisuje písně, které credential zaznamená; po exportu stejný řádek hlásí, co nalezlo čtení doručeného souboru. Zruš zaškrtnutí **C2PA Credentials**, aby se záznam vynechal. Statický obrázek žádnou píseň nezaznamenává, protože nenese žádný zvuk. `lolly mix` a [server MCP](/info/mcp.html) zapisují stejný záznam.

## Soubory z utility Rondocode

Většina utilit na zařízení nezapisuje žádný credential, protože transformují soubor, který už vlastníš. Rondocode vytváří nový zvuk, takže každý zvukový soubor, který zapíše, nese Content Credentials zaznamenávající píseň jako zdroj: její jméno, SHA-256 jejího souboru `.rondo.json` a kde její kód běžel. To pokrývá WAV, MP3, M4A, Opus, FLAC, každou stopu ve ZIP stop a nahrávku toho, co hraje.

- Vlastní vykreslení editoru běží v jeho soukromém rámu (třída provádění `frame`) a zaznamenávají verzi editoru.
- Vykreslení z CLI nebo sdíleného odkazu běží ve třídě `vm` a zaznamenává verzi vykreslovače a seed.
- WAV totéž uvádí také ve svém komentáři RIFF.
- Hudba vypočítaná z kódu písně je algoritmické médium a není označena jako AI.

Když píseň zpívá, soubor deklaruje ten zpěv jako generovaný AI ve strojově čitelné podobě. Typ digitálního zdroje credential je složené médium vytvořené s trénovanými modely, záznam vypisuje zpívané části a jedno oznámení AI C2PA na model identifikuje každý model, jímž zpěv prošel: převod textu na řeč Supertonic-3, zarovnávač fonémů wav2vec 2.0, enkodér ContentVec a hlas RVC, s repozitářem a commitem, z nichž ho Lolly hostuje. Soubor, který drží syntetizovaný zpěv, se nikdy neuloží bez této deklarace.

Soubor MIDI nemá místo pro credential, takže místo toho tvrzení nese textová událost v souboru a panel exportu to říká. Panel to všechno popisuje před exportem a po každém exportu editor čte uložený soubor zpět a hlásí jen to, co čtení našlo.

K tomu, co Content Credentials zaznamenávají obecně, viz [Export souboru](/info/exporting.html#content-credentials-c2pa).
