# Skladby Lolly Rondocode

<a id="rondocode-songs"></a>

Skladba rondocode je hudba zapsaná jako kód: syntezátory, patterny a mix, které hrají při psaní. Lolly může přehrávat skladbu pod videem a utilita **Rondocode** zapisuje skladby a exportuje je jako zvuk; obě zaznamenávají skladbu v Content Credentials souboru.

<!--i:eti-music-->
## Přehrávání skladby v Lolly

Výběr assetů přijímá skladbu jako soubor `.rondo` nebo `.rondo.json` nebo jako vložený odkaz pro sdílení z `rondocode.com`. Skladba hraje po dobu, kterou požaduje její klip. Může sloužit jako **hudební podkres** pod exportem videa nebo hrát v ambientním přehrávači režimu Neurospicy.

Kód skladby běží v sandboxu Lolly, bez sítě a bez přístupu k tvým souborům. Každá část, kterou vykreslení nemůže přehrát, například živý mikrofon nebo zpěv bez hlasových modelů, je uvedena v podrobnostech assetu.

Z terminálu přijímá `lolly mix` skladbu jako celou zvukovou stopu; viz [Vykreslování CLI](/info/cli-rendering.html).

<!--i:eti-code-->
## Psaní a export skladby

Otevři nástroj **Rondocode** z **Utilities**, napiš skladbu v živém editoru rondocode a poslouchej ji při psaní. Exportuj ji jako **WAV**, **MP3**, **M4A**, **Opus** nebo **FLAC**, jako ZIP samostatných stop, jako **MIDI** nebo jako záznam toho, co právě hraje. Z terminálu zapíše `lolly rondocode --export=mid` stejný soubor MIDI. **Export length** nastavuje, kolik sekund trvá export zvuku. Soubor skladby (`.rondo.json`) je tvůj kód tak, jak je napsaný, bez čehokoli navíc.

Skladba může zpívat svůj text pomocí `sing()`. Stažené hlasové modely vytvářejí zpěv na tvém zařízení. Soubor obsahující syntetizovaný zpěv vždy deklaruje zpěv jako vytvořený pomocí AI (viz [Funkce AI](/info/ai-features.html)).

<!--i:eti-badge-check-->
## Skladby v pověření

Export videa nebo zvuku, který přehrává skladbu rondocode, zaznamenává každou skladbu ve svých Content Credentials jako zdroj:

- název skladby;
- SHA-256 jejího souboru `.rondo.json`;
- jak byla vykreslena: v sandboxu Lolly, ve třídě provádění `vm`, s verzí vykreslovače a počáteční hodnotou generátoru a se všemi částmi, které vykreslení nemohlo přehrát.

Hudba vypočítaná z kódu skladby se označuje jako algoritmické médium, takže ji Lolly Verify neoznačuje jako AI. Před exportem řádek pod **Download** vypisuje skladby, které pověření zaznamená. Po exportu stejný řádek hlásí, co zjistilo přečtení doručeného souboru. Zruš zaškrtnutí **C2PA Credentials**, aby se záznam vynechal. Statický obrázek nezaznamenává žádnou skladbu, protože nemá zvuk. Statický obrázek nezaznamenává žádnou skladbu. `lolly mix` a [MCP server](/info/mcp.html) zapisují stejný záznam.

<!--i:eti-file-->
## Soubory z utility Rondocode

Většina utilit běžících na zařízení nezapisuje pověření, protože transformují soubor, který už vlastníš. Lolly Rondocode vytváří nový zvuk, takže každý zvukový soubor, který zapíše, obsahuje Content Credentials zaznamenávající skladbu jako zdroj: WAV, MP3, M4A, Opus, FLAC, každá samostatná stopa v ZIP se stopami a záznam toho, co právě hraje.

- Vlastní vykreslení editoru běží v jeho soukromém rámci (třída provádění `frame`) a zaznamenávají verzi editoru.
- Vykreslení vytvořené pomocí CLI nebo odkazu pro sdílení běží ve třídě `vm` a zaznamenává verzi vykreslovače a počáteční hodnotu generátoru.
- WAV uvádí totéž i ve svém komentáři RIFF.

Když skladba zpívá, deklarace AI je strojově čitelná. Typ digitálního zdroje pověření je složené médium vytvořené trénovanými modely, záznam vypisuje zpívané části a jedna deklarace použití AI v C2PA pro každý model identifikuje každý model, kterým zpěv prošel: Supertonic-3 pro převod textu na řeč, zarovnávání fonémů wav2vec 2.0, kodér ContentVec a hlas RVC, s repozitářem a commitem, ze kterého jej Lolly hostuje.

### Co obsahuje soubor MIDI

Soubor MIDI je Standard MIDI File, formát 1. První stopa obsahuje tempo a taktové označení 4/4, následované jednou stopou pro každý syntezátor, pojmenovanou podle něj. Každá nota si zachovává začátek, délku a dynamiku. Syntezátor, jehož název označuje nástroj, například basu, smyčce, pad nebo klavír, dostane odpovídající nástroj General MIDI a název připomínající bicí jde na kanál 10. Ladění, které není dvanáctitónové, se zaokrouhlí na nejbližší půltón s ohybem výšky tónu.

Soubor MIDI nemůže obsahovat nastavení syntezátorů, filtry, efekty, sběrnice, samply ani zpěv, takže DAW přehrává noty vlastními nástroji. Tempo se čte z počtu cyklů skladby za sekundu, přičemž jeden cyklus je takt o čtyřech dobách, protože vlastní taktové označení skladby není součástí toho, co vykreslovač vrací.

Soubor MIDI nemá místo pro pověření, takže prohlášení nese textová událost v souboru a panel exportu tě o tom informuje. Panel to vše popisuje před exportem. Po každém exportu editor znovu přečte uložený soubor a hlásí jen to, co toto čtení zjistilo.

Co Content Credentials obecně zaznamenávají, popisuje [Export souboru](/info/exporting.html#content-credentials-c2pa).
