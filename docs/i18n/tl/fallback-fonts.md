# Mga fallback font

Madalas na ilang script lang sa mundo ang sakop ng mga font ng isang design system. Ang Lolly Demo ay nagtatakda ng Outfit para sa mga heading at SUSE para sa text, at wala sa dalawa ang may letrang Cyrillic, Greek, Arabic, Hebrew, Devanagari, Bengali, Thai, Chinese, Japanese o Korean. Kapag may letra ang isang dokumento na hindi kayang iguhit ng mga font ng design system nito, iginuguhit ng Lolly ang mga letrang iyon gamit ang open na Noto font, kaya nananatiling vector outline ang mga ito sa export sa halip na gawing larawan ang mga salita.

Palaging nauuna ang mga font ng design system, ayon sa pagkakasunod na inilista ng design system. Walang letrang Vietnamese ang Outfit, kaya ang Vietnamese na heading ay kumukuha ng mga ito sa SUSE, ang susunod na font sa listahan ng Lolly Demo. Ang fallback font ay gumuguhit lang ng mga karakter na hindi kayang iguhit ng alinman sa mga font na iyon, kaya iniingatan ng brand font ang bawat letra, digit at marka nito, kahit sa loob ng salita sa ibang script. Ang brand font na may isang Chinese na karakter ay iniingatan din ang karakter na iyon.

## Ano ang kasama

Labinlimang font, lahat mula sa Google Fonts sa isang naka-pin na commit at lahat ay nasa ilalim ng SIL Open Font License 1.1. Ipinapakita ang bawat file kasama ang laki ng download nito.

| Script | Font | Bersyon | Download |
|---|---|---|---|
| Arabic, kasama ang mga letrang Urdu at Persian | Noto Sans Arabic | 2.012 | 211 KB |
| Hebrew | Noto Sans Hebrew | 3.001 | 37 KB |
| Devanagari (Hindi, Marathi, Nepali) | Noto Sans Devanagari | 2.007 | 151 KB |
| Bengali | Noto Sans Bengali | 3.011 | 139 KB |
| Thai | Noto Sans Thai | 2.002 | 62 KB |
| Cyrillic | Noto Sans, mga letrang Cyrillic | 2.015 | 115 KB, italic 132 KB |
| Greek | Noto Sans, mga letrang Greek | 2.015 | 77 KB, italic 83 KB |
| Latin, kasama ang Vietnamese at iba pang may accent na letra | Noto Sans, mga letrang Latin | 2.015 | 316 KB, italic 350 KB |
| Simplified Chinese, ang mga karakter ng GB 2312 | Noto Sans SC | 2.004 | 2.0 MB |
| Traditional Chinese, ang mga karakter ng Big5 | Noto Sans TC | 2.004 | 3.8 MB |
| Japanese, ang mga karakter ng Shift_JIS | Noto Sans JP | 2.004 | 2.2 MB |
| Korean, bawat Hangul syllable at ang mga karakter ng KS X 1001 | Noto Sans KR | 2.004 | 2.5 MB |

Buo ang weight axis ng bawat font, kaya gumuguhit pa rin ang bawat weight na hinihingi ng isang design, at bold ang bold na Chinese, Japanese o Korean na heading. Nakapirmi sa normal ang width axis ng mga Noto Sans font, na nagpapaliit sa bawat file nang kalahati; walang width axis ang mga Chinese, Japanese at Korean na font. Hinahati ayon sa script ang Noto Sans, kaya ang salitang Cyrillic ay nagda-download lang ng mga letrang Cyrillic. Ang mga outline ay ang mga upstream na outline, hindi binago.

Nasa iisang shared na folder ang mga font, ang `community/fallback-fonts`, na inihahatid sa bawat design system mula sa `/catalog/packs/fallback-fonts/`, gaya ng pagbabahagi sa mga emoji set. Binubuo ng `scripts/import-fallback-fonts.ts` ang mga file mula sa mga upstream na font na naka-pin sa `scripts/data/fallback-fonts.json`, sinusuri ang bawat upstream na file laban sa naitalang SHA-256 nito at isinusulat ang mga teksto ng lisensya sa tabi ng mga font.

## Chinese, Japanese at Korean

Ang buong Chinese, Japanese o Korean na font ay 9.6 MB hanggang 17.8 MB, kaya bawat isa sa mga font na ito ay hinihiwa sa pambansang character set na ginagamit araw-araw ng mga mambabasa nito, kasama ang bantas, kana, fullwidth form at mga simbolo ng tuloy-tuloy na teksto:

- Simplified Chinese: GB 2312, ang 6,763 karaniwang hanzi at ang mga simbolo nito, 7,522 karakter sa kabuuan.
- Traditional Chinese: Big5, ang 13,053 hanzi nito at ang mga simbolo nito, 13,629 karakter sa kabuuan. Hindi kasama ang Hong Kong Supplementary Character Set.
- Japanese: Shift_JIS gaya ng pagbasa ng Windows at ng web, ibig sabihin ang JIS X 0208 kasama ang mga dagdag ng NEC at IBM na kailangan ng mga pangalang tulad ng 髙 at 﨑, bawat kana at ang halfwidth katakana, 7,432 karakter sa kabuuan.
- Korean: lahat ng 11,172 Hangul syllable at KS X 1001, kasama ang 4,888 hanja nito, 17,082 karakter sa kabuuan.

Hindi isinasama sa apat na font na ito ang mga letrang Latin, Greek at Cyrillic, dahil iginuguhit ang mga ito ng mga font ng design system at ng mga font sa itaas. Binabasa ang mga set mula sa mga index file ng Encoding Standard sa isang naka-pin na commit, kaya ang rebuild ay nagbibigay ng parehong mga file.

Magkakahawig ang karamihan ng karakter ng Chinese, Japanese at Korean, pero marami sa mga ito ay iba ang guhit sa bawat isa. Ang parehong karakter na 直 ay isinusulat sa isang paraan sa Chinese at sa ibang paraan sa Japanese. Kaya ang isang run ng text ay kumukuha ng lahat ng pinagsasaluhan nitong karakter sa isa sa mga font na ito, hindi kailanman sa dalawa, at pinipili ng Lolly ang font na iyon sa pagkakasunod na ito:

1. Ang wika ng run, mula sa `lang` ng element nito o ng pinakamalapit na nakapaligid dito sa dokumento. Ang language setting ng isang tool, tulad ng Language ng sertipiko, ang nagtatakda niyon. Hindi binibilang ang wika ng sariling interface ng Lolly at ang wika ng design system, kaya pareho ang export ng dokumento para sa lahat.
2. Ang script ng run: ang kana ay nangangahulugang Japanese at ang Hangul ay Korean. Kapag wala sa dalawa ang mismong run, binabasa ang buong dokumento, kaya ang heading na kanji lang sa Japanese na dokumento ay iginuguhit sa Japanese. Ang dokumentong may parehong kana at Hangul ay walang napagpapasyahan dito.
3. Ang karakter na Traditional Chinese lang ang gumagamit, tulad ng 體 o 說, sa run o kung wala ay sa dokumento, ay nangangahulugang Traditional Chinese, maliban kung may kasama ring karakter ang parehong text na Simplified Chinese lang ang gumagamit.
4. Kung hindi, Simplified Chinese.

Ang karakter na wala sa napiling font ay hindi kailanman kinukuha sa isa sa tatlong iba pa. Nananatili itong larawan, gaya ng inilalarawan sa ibaba. Ang kana o Hangul na wala sa napiling font, tulad ng mga salitang Korean sa linyang minarkahang Japanese, ay maaari pa ring manggaling sa Japanese o Korean na font, pero kapag walang pinagsasaluhang karakter sa linya na iguguhit ang font na iyon.

Sa page, ang canvas na may dalawa sa mga wikang ito ay naglilista ng parehong font, at ang browser ang gumuguhit ng mga pinagsasaluhang karakter gamit ang una. Iginuguhit ng export ang bawat run gamit ang sarili nitong font.

## Kapag nagda-download ang font

Walang nagda-download hanggang may karakter ang isang dokumento na hindi kayang iguhit ng alinmang font ng design system nito. Ang dokumentong Ingles, o sa anumang wikang sakop ng design system nito, ay hindi kailanman nagda-download ng fallback font. Ang simbolo sa linyang Ingles, tulad ng ★ o ※, ay hindi kailanman nagda-download ng Chinese, Japanese o Korean na font.

Sa unang beses na kailanganin ng isang dokumento ang isa, dina-download ng Lolly ang isang font na iyon, para sa isang script na iyon, at iniingatan ito sa device mo. Ang Japanese na dokumento ay nagda-download ng Japanese font lang, 2.2 MB, at ang Traditional Chinese naman ay ang 3.8 MB na Traditional font. Mula noon, gumuguhit nang offline ang script, at nananatili ang font kapag nililinis ang catalog. Iniingatan ang font kasama ng sariling mga file ng catalog, hindi kailanman sa mga font na ina-upload mo, kaya hindi ito lumilitaw sa listahan ng font ng brand mo.

Binabasa ng command line, ng terminal app at ng MCP server ang parehong mga file mula sa disk, kaya hindi nila kailangan ng download.

## Sa page at sa export

Ang page ay gumagamit ng parehong fallback font gaya ng export. Kung wala ito, gumuguhit ang browser ng gayong mga letra gamit ang system font habang Noto ang gamit ng export, at nagbabago ang lapad ng linyang may ganoong letra sa pagitan ng dalawa. Idinaragdag ng Lolly ang fallback font sa dulo ng listahan ng font ng design system sa canvas na iyon lang, pagkatapos ng sariling mga font ng design system at bago ang anumang system font. Ang tool na nagtatakda ng sarili nitong listahan ng font, sa mga style o sa mga element nito, ay nakakakuha ng fallback font sa parehong lugar: pagkatapos ng mga font na ibinibigay ng listahan at bago ang anumang system font. Ang canvas na sakop ng design system ay nananatili ang listahan ng font nito gaya ng dati.

Hindi ginagalaw ng page ang listahan ng font kapag nagsisimula ito sa system font, tulad ng `system-ui` o Helvetica, dahil iginuguhit ng export ang text na iyon gamit ang mga font ng design system at hindi ng page.

Sa PDF, nagiging mga outline na iginuhit gamit ang fallback font ang mga salita, anuman ang piliin mong text setting, dahil hindi kayang dalhin ng live PDF text ang script na wala sa naka-embed na font. Sa SVG, EMF, EPS, DXF at WMF, nagiging mga outline ang mga ito kapag kino-convert ang text sa mga outline; kapag live ang text, ang sariling mga font ng mambabasa ang gumuguhit sa mga ito, gaya ng dati. Kapag may bahagi ng export na iginuhit ng fallback font, nagpapakita ang export panel ng tala tulad ng:

> Ang Japanese na text ay iginuhit gamit ang Noto Sans JP, dahil walang mga letrang iyon ang mga font ng design system na ito.

Ini-print ng command line ang parehong pangungusap bilang tala.

## Ang nananatiling larawan

Ang karakter na labas sa apat na pambansang set ay walang fallback font. Ang mga bihirang karakter tulad ng 𠮷, ang mga karakter na idinagdag para sa Hong Kong ng supplementary set nito, at ang mga script na walang fallback font, tulad ng Tamil, Ethiopic o Syriac, ay pare-parehong tinatrato. Sa PDF, ang linyang may isa sa mga ito ay napupunta bilang 300 dpi na larawan, at inililista ng export panel ang mga script. Sa SVG, nananatiling live text ang run, na iginuguhit ng sariling mga font ng mambabasa.

## Ang check bago ka mag-export

Ang **Before you export** card ng Lolly Design, at ang mga `render` check ng `lolly check`, ay nag-uulat ng text na walang font na kayang iguhit. Binibilang nila ang mga fallback font gaya ng ginagawa ng export, mula sa parehong listahan ng mga karakter ng bawat font, kaya hindi iniuulat ang text na iginuguhit ng fallback font. Iniuulat pa rin ang script na walang fallback font, tulad ng Tamil, at ang karakter na Chinese, Japanese o Korean na wala sa mga pambansang set, dahil iginuguhit ito ng export bilang larawan o bilang live text. Binabasa ng check ang mga listahang iyon mula sa catalog at walang dina-download na font.

## Mga lisensya at credit

Nasa ilalim ng SIL Open Font License 1.1 ang bawat fallback font, at itinatala ng bawat catalog entry ang lisensyang iyon kasama ang hash ng teksto ng lisensya, kaya binabasa ng mga rights rule sa [Creative rights at mga credit](/info/creative-rights.html) ang lisensya gaya ng sa anumang ibang font. Nasa tabi ng mga font ang mga teksto ng lisensya. Walang idinedeklarang Reserved Font Name ang mga file ng Noto Sans. Ang mga Chinese, Japanese at Korean na font ay sa Adobe, at nagrereserba ng pangalang Source; iniingatan ng mga hiniwang file ang mga pangalan nilang Noto, na hindi gumagamit ng pangalang iyon.

Sinasabi ng lisensya na hindi nalalapat ang mga tuntunin nito sa mga dokumentong ginawa gamit ang mga font. Ang export ay naglalaman lang ng mga iginuhit na outline ng mga letrang ginagamit nito, gaya ng sa sariling mga font ng design system, at walang idinaragdag ang Lolly na font program, credit line o bagong entry sa content credential para sa fallback font.
