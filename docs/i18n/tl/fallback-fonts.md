# Mga fallback font

Kapag hindi kayang iguhit ng mga font ng design system ang isang letra, iginuguhit ito ng Lolly gamit ang open na Noto font, kaya pinapanatili ng export ang letra bilang vector outline sa halip na larawan. Ang mga font ng Lolly Demo, Outfit para sa mga heading at SUSE para sa text, ay walang mga letrang Cyrillic, Greek, Arabic, Hebrew, Devanagari, Bengali, Thai, Chinese, Japanese o Korean.

Laging inuuna ang mga font ng design system, ayon sa pagkakasunod sa listahan. Walang mga letrang Vietnamese ang Outfit, kaya kinukuha ng Vietnamese na heading ang mga ito mula sa SUSE, ang susunod na font sa listahan ng Lolly Demo. Iginuguhit lang ng fallback font ang mga character na hindi kayang iguhit ng alinman sa mga font na iyon. Pinapanatili ng brand font ang bawat letra, numero at markang mayroon ito, kasama ang mga Chinese character, kahit sa loob ng salita sa ibang script.

<!--i:eti-package-->
## Ano ang kasama

Labinlimang font, lahat mula sa Google Fonts sa isang nakapirming commit. Ipinapakita ang bawat file kasama ang laki ng download nito.

| Script | Font | Bersyon | Download |
|---|---|---|---|
| Arabic, kasama ang mga letrang Urdu at Persian | Noto Sans Arabic | 2.012 | 211 KB |
| Hebrew | Noto Sans Hebrew | 3.001 | 37 KB |
| Devanagari (Hindi, Marathi, Nepali) | Noto Sans Devanagari | 2.007 | 151 KB |
| Bengali | Noto Sans Bengali | 3.011 | 139 KB |
| Thai | Noto Sans Thai | 2.002 | 62 KB |
| Cyrillic | Noto Sans, mga letrang Cyrillic | 2.015 | 115 KB, italic 132 KB |
| Greek | Noto Sans, mga letrang Greek | 2.015 | 77 KB, italic 83 KB |
| Latin, kasama ang Vietnamese at iba pang letrang may accent | Noto Sans, mga letrang Latin | 2.015 | 316 KB, italic 350 KB |
| Simplified Chinese, ang mga GB 2312 character | Noto Sans SC | 2.004 | 2.0 MB |
| Traditional Chinese, ang mga Big5 character | Noto Sans TC | 2.004 | 3.8 MB |
| Japanese, ang mga Shift_JIS character | Noto Sans JP | 2.004 | 2.2 MB |
| Korean, bawat pantig ng Hangul at ang mga KS X 1001 character | Noto Sans KR | 2.004 | 2.5 MB |

Pinapanatili ng bawat font ang lahat ng weight sa weight axis nito, kaya bold ang isang bold na Chinese, Japanese o Korean na heading. Nakapirmi sa normal ang width axis ng mga Noto Sans font, kaya nahahati sa kalahati ang laki ng bawat file. Walang width axis ang mga Chinese, Japanese at Korean na font. Hinahati ang Noto Sans ayon sa script, kaya mga letrang Cyrillic lang ang dina-download para sa salitang Cyrillic. Hindi binago ang mga outline mula sa upstream.

::: details Kung saan naroon ang mga font at paano binubuo ang mga ito
Nasa iisang shared folder ang mga font, `community/fallback-fonts`, na inihahatid sa bawat design system mula sa `/catalog/packs/fallback-fonts/`, tulad ng mga emoji set. Binubuo ng `scripts/import-fallback-fonts.ts` ang mga file mula sa mga upstream font na nakapirmi sa `scripts/data/fallback-fonts.json`, sinusuri ang bawat upstream file ayon sa naitalang SHA-256 nito at isinusulat ang mga text ng lisensya sa tabi ng mga font.
:::

<!--i:eti-globe-->
## Chinese, Japanese at Korean

9.6 MB hanggang 17.8 MB ang isang buong Chinese, Japanese o Korean na font. Nililimitahan ang bawat isa sa pambansang character set nito, kasama ang bantas, kana, fullwidth form at mga simbolo sa tuloy-tuloy na text:

- Simplified Chinese: GB 2312, ang 6,763 karaniwang hanzi at mga simbolo nito, 7,522 character sa kabuuan.
- Traditional Chinese: Big5, ang 13,053 hanzi nito at mga simbolo nito, 13,629 character sa kabuuan. Hindi kasama ang Hong Kong Supplementary Character Set.
- Japanese: Shift_JIS ayon sa pagbasa rito ng Windows at web, na JIS X 0208 kasama ang mga idinagdag ng NEC at IBM na kailangan ng mga pangalang tulad ng 髙 at 﨑, bawat kana at ang halfwidth katakana, 7,432 character sa kabuuan.
- Korean: lahat ng 11,172 pantig ng Hangul at KS X 1001, kasama ang 4,888 hanja nito, 17,082 character sa kabuuan.

Hindi kasama sa apat na font na ito ang mga letrang Latin, Greek at Cyrillic, na iginuguhit ng mga font ng design system at ng mga font sa itaas. Galing ang mga set sa mga index file ng Encoding Standard sa isang nakapirming commit, kaya parehong mga file ang nabubuo kapag muling binuo.

Magkakapareho ang karamihan sa mga character ng Chinese, Japanese at Korean pero marami sa mga ito ang magkaiba ang pagkakaguhit. Halimbawa, magkaiba ang pagkakasulat ng 直 sa Chinese at Japanese. Kinukuha ng isang text run ang lahat ng magkakaparehong character nito mula sa isa sa mga font na ito, hindi kailanman dalawa. Pinipili ng Lolly ang font na iyon sa ganitong pagkakasunod:

1. Ang wika ng run, mula sa `lang` ng element nito o ng pinakamalapit na element na nakapalibot dito sa dokumento. Itinatakda iyon ng language setting ng tool, tulad ng Language ng certificate. Hindi binibilang ang wika ng sariling interface ng Lolly at ang wika ng design system, kaya pareho ang export ng dokumento para sa lahat.
2. Ang script ng run: Japanese kapag kana at Korean kapag Hangul. Kapag wala ang dalawa sa run, binabasa ng Lolly ang dokumento, kaya iginuguhit sa Japanese ang heading na puro kanji sa dokumentong Japanese. Walang napagpapasyahan sa hakbang na ito kapag may kana at Hangul ang dokumento.
3. Kapag may character na Traditional Chinese lang ang gumagamit, tulad ng 體 o 說, sa run o kung wala roon ay sa dokumento, Traditional Chinese ang pinipili, maliban kung may character din sa parehong text na Simplified Chinese lang ang gumagamit.
4. Kung wala sa mga ito, Simplified Chinese.

Hindi kailanman kinukuha mula sa isa sa tatlong iba pa ang character na wala sa napiling font. Nananatili itong larawan. Ang kana o Hangul na wala sa napiling font, tulad ng mga salitang Korean sa linyang minarkahang Japanese, ay puwede pa ring manggaling sa Japanese o Korean na font, pero kapag wala lang iguguhit ang font na iyon na magkakaparehong character ng linya.

Sa page, inililista ng canvas na may dalawa sa mga wikang ito ang parehong font, at iginuguhit ng browser ang magkakaparehong character gamit ang una. Iginuguhit ng export ang bawat run gamit ang sarili nitong font.

<!--i:eti-download-->
## Kailan nagda-download ang font

Walang dina-download hangga't walang character sa dokumento na hindi kayang iguhit ng alinmang font ng design system nito. Ang simbolo sa linyang English, tulad ng ★ o ※, ay hindi kailanman nagpapasimula ng pag-download ng Chinese, Japanese o Korean na font.

Sa unang pagkakataong kailangan ng dokumento ang fallback font, dina-download ng Lolly ang font na iyon lang at itinatago ito sa device mo. Japanese na font lang, 2.2 MB, ang dina-download ng dokumentong Japanese, at ang 3.8 MB na Traditional na font para sa dokumentong Traditional Chinese. Mula noon, naiguguhit ang script nang offline, at nananatili ang font kapag nililinis ang catalog. Itinatago ang font kasama ng mga file ng catalog, hindi kailanman sa mga in-upload mong font, at hindi ito lumalabas sa listahan ng font ng brand mo.

Binabasa ng command line, terminal app at MCP server ang parehong mga file mula sa disk, kaya hindi nila kailangan ng download.

<!--i:eti-eye-->
## Sa page at sa export

Ginagamit ng page ang parehong fallback font ng export, kaya pareho ang lapad sa dalawa ng linyang may gayong mga letra. Sa canvas na iyon lang, idinaragdag ng Lolly ang fallback font pagkatapos ng sariling mga font ng design system at bago ang anumang system font. Ang tool na nagtatakda ng sarili nitong listahan ng font, sa mga style nito o sa mga element nito, ay nagkakaroon ng fallback font sa parehong puwesto. Hindi nagbabago ang listahan ng font ng canvas na sakop ng design system.

Hindi binabago ng page ang listahan ng font kapag nagsisimula ito sa system font, tulad ng `system-ui` o Helvetica, dahil iginuguhit ng export ang text na iyon gamit ang mga font ng design system at hindi ganoon ang page.

Sa PDF, nagiging mga outline sa fallback font ang mga salita sa anumang text setting, dahil hindi kayang hawakan ng live na PDF text ang script na wala sa naka-embed na font. Sa SVG, EMF, EPS, DXF at WMF, nagiging mga outline ang mga ito tuwing kino-convert ang text sa mga outline. Kapag pinananatiling live ang text, sariling mga font ng reader ang gumuguhit sa mga ito. Kapag fallback font ang gumuhit ng bahagi ng export, nagpapakita ang export panel ng tala tulad nito:

> Iginuguhit ang Japanese na text gamit ang Noto Sans JP, dahil wala ang mga letrang iyon sa mga font ng design system na ito.

Ini-print ng command line ang parehong pangungusap bilang tala.

<!--i:eti-image-->
## Ano ang nananatiling larawan

Walang fallback font ang character na wala sa apat na pambansang set, tulad ng 𠮷 o isang supplementary character ng Hong Kong. Pare-pareho ang paghawak sa mga bihirang character tulad ng 𠮷, sa mga character na idinagdag para sa Hong Kong ng supplementary set nito at sa mga script na walang fallback font, tulad ng Tamil, Ethiopic o Syriac. Wala rin nito ang script tulad ng Tamil, Ethiopic o Syriac. Sa PDF, inilalagay ang linyang may gayong text bilang 300 dpi na larawan, at inililista ng export panel ang mga script. Sa SVG, nananatiling live text ang run, na iginuguhit ng sariling mga font ng reader.

::: details Sa mga EPS, WMF at EMF export
Walang live text na mapagbabalikan ang EPS, WMF o EMF na naka-on ang **Outline fonts**, kaya inilalagay din ang run bilang 300 dpi na larawan. Iginuguhit lang ng larawan ang kulay ng text kung saan naroon ang mga letra, kaya nakikita ang background sa pagitan. Inililista ng export panel ang mga script. Tuwid lang naiguguhit ang larawan, kaya pinapahinto ng pinaikot o pinahilig na run ang export na may mensaheng sumisipi sa run. Sa WMF o EMF, pares ng bitmap operation ang larawan, isang mask at isang paint. Iginuguhit ng Microsoft Office at LibreOffice ang mga ito ayon sa layunin. Ipinapakita ng app na hindi sumusunod sa mga ito, tulad ng Inkscape, ang mga salita sa isang puting kahon.

Pinapanatili ng EMF na naka-off ang **Outline fonts** ang gayong run bilang live text, na iginuguhit ng sariling mga font ng reader. Ang pagbubukod ay run na hindi kayang hawakan ng live na EMF text, tulad ng text na may letter spacing. Ginagawang outline ng Lolly ang run na iyon, kaya inilalagay rin doon bilang larawan ang run na hindi kayang iguhit ng anumang font.
:::

::: warning Humihinto ang DXF export sa text na hindi kayang iguhit ng anumang font
Napupunta ang DXF sa mga cutting machine at CAD software, na nangangailangan ng mga outline, kaya pinapahinto ng run na hindi kayang iguhit ng anumang font ang DXF export. Sinisipi ng mensahe ang run at ibinibigay ang script nito. Magdagdag ng font na may mga letrang iyon, o mag-export ng SVG o PDF.
:::

<!--i:eti-checklist-->
## Ang pagsusuri bago ka mag-export

Iniuulat ng **Before you export** card ng Lolly Design at ng mga `render` check ng `lolly check` ang text na hindi kayang iguhit ng anumang font. Isinasama nila ang mga fallback font tulad ng ginagawa ng export, mula sa parehong mga listahan ng character bawat font, kaya hindi iniuulat ang text na iginuguhit ng fallback font. Iniuulat pa rin ang script na walang fallback font, tulad ng Tamil, at ang Chinese, Japanese o Korean na character na wala sa mga pambansang set, dahil iginuguhit sila ng export bilang larawan o live text, at humihinto sa mga ito ang DXF export. Binabasa ng pagsusuri ang mga listahang iyon mula sa catalog at walang dina-download na font.

<!--i:eti-stamp-->
## Mga lisensya at credit

Nasa ilalim ng SIL Open Font License 1.1 ang bawat fallback font. Itinatala ng bawat entry sa catalog ang lisensyang iyon kasama ang hash ng text ng lisensya, kaya binabasa ng mga tuntunin sa karapatan sa [Mga karapatan at credit sa likhang gawa](/info/creative-rights.html) ang lisensya tulad ng sa anumang ibang font. Nasa tabi ng mga font ang mga text ng lisensya. Walang idinedeklarang Reserved Font Name ang mga Noto Sans file. Sa Adobe ang mga Chinese, Japanese at Korean na font at inilalaan nila ang pangalang Source. Pinapanatili ng mga nilimitahang file ang mga pangalan nilang Noto, na hindi gumagamit ng pangalang iyon.

Sinasabi ng lisensya na hindi naaangkop ang mga tuntunin nito sa mga dokumentong ginawa gamit ang mga font. Mga outline lang ng mga letrang ginagamit nito ang hawak ng export, tulad ng sa sariling mga font ng design system. Walang idinaragdag na font program, credit line o bagong entry ng content credential ang Lolly para sa fallback font.
