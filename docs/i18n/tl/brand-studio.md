# Lolly Design System Setup

<a id="design-system-setup"></a>

Ang logo, mga kulay at typeface mo ay nabibilang sa iisang lugar, para gumuhit ang bawat tool, page at export gamit ang mga ito. Ang lugar na iyon ay ang **Lolly Design System Setup**, sa `#/start`.

Magsimula sa anumang meron ka. Mag-drop ng logo at babasahin ng Lolly ang mga kulay nito. Pumili ng typeface, o i-drop ang font file na nilisensyahan ng kumpanya mo. Ipinapakita sa buong app ang bawat pagbabago agad. Nananatili sa device na ito ang logo, mga font at token mo. Ang pagpili ng Google Font ang nag-iisang hakbang na umaabot sa labas: nagtatanong muna ang Lolly, saka kinukuha ang family nang minsan.

Kapag maayos na ang itsura, pangalanan ang design system at pindutin ang **Export**. Makakakuha ka ng isang `.lolly` file na itatago, bubuksan sa ibang device o ibibigay sa kasamahan. Ipinapakita ng [Lolly Settings](/info/dashboard.html#design-system) ang aktibong system na read-only, at ang cover nito ay nagli-link pabalik dito para sa pag-edit.

## Gawing iyo sa limang minuto

::: timeline
- <!--i:upload--> **I-drop ang logo mo** sa drop zone sa **Logos**. Binabasa ng Lolly ang hugis at mga kulay nito.
- <!--i:palette--> **Gamitin ang mga kulay na ito.** Ang pangunahing kulay ng logo ay nagiging primary mo, at ang madilim na neutral mula sa logo ay nagiging text colour mo.
- <!--i:font--> **Pumili ng face** sa **Type**: Google Font, o font file na pag-aari mo.
- <!--i:pentool--> **Pangalanan ang system.** Ang una mong edit ay gumagawa ng sarili mong design system, at nagtatanong ang Lolly nang minsan para sa pangalan nito.
- <!--i:download--> Isinusulat ng **Export** ang buong system bilang isang `LollyBrand-….lolly` file.
:::

Dala ng bar sa tuktok ng studio ang pangalan ng design system, at ang pangalan ay field na puwede mong baguhin anumang oras: iniingatan ng **Enter** ang bagong pangalan at ibinabalik ng **Escape** ang dati. Kapag tinanong ng una mong edit ang **What is this design system called?**, napupunan ang mga salita mula sa logo mo kung binabaybay ito ng logo. Iniingatan ng **Save name** ang pangalan; pinananatili ng **Not now** ang placeholder hanggang mag-type ka ng isa sa bar. Nilalagyan ng pangalan ang system sa Settings at kapag lumilipat ka, at ito ang nagiging pangalan ng file na isinusulat ng **Export**.

## Ang mga silid

Ang studio ay hanay ng mga room nang walang takdang pagkakasunod-sunod: walang binibilang at walang naghihintay sa anupaman. Sa desk, nasa iisang strip sa ilalim ng bar ang mga room. Sa phone, lumilipat ang mga ito sa bar sa ibabang gilid, kung saan abot ng hinlalaki, na nakaskroll sa view ang bukas na room; ang palette sheet at ang tray ay umaangat sa ibabaw ng bar na iyon, at umaalis ang bar habang nagta-type ka. Gamit ang keyboard, isang beses lang inaabot ng Tab ang strip, at ang mga arrow key, Home at End ang naglilipat mula room papunta sa room.

![Ang bar ng studio at ang mga room nito: Board, Colours, Type, Logos, Tokens, Files, Rules at Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Room | Ano ang ginagawa mo roon | Link key |
|---|---|---|
| **Board** | Tingnan kung ano ang hawak ng system, na may pinto papunta sa bawat room | `overview` |
| **Colours** | Magdagdag ng mga kulay, bigyan sila ng role, gumawa ng shade at palette | `color` |
| **Type** | Piliin ang apat na face na binabasa ng app, mga tool at bawat export | `type` |
| **Logos** | Ilagay ang mga marka mo sa bawat orientation at treatment | `logos` |
| **Tokens** | Mga sulok, spacing, anino at bawat ibang pinangalanang value | `tokens` |
| **Files** | Ang mga larawan, audio at motion file na iniingatan ng brand mo | `catalogue` |
| **Rules** | Ang mga rule na inilalapat ng brand mo, sinusuri sa totoong halimbawa | `usage` |
| **Skills** | Ang mga nakasulat na pamantayan ng brand para sa mga tao at ahente, na babasahin at ida-download | `skills` |

Mag-link sa room gamit ang `#/start?area=<key>`. Pinapanatili ng Files room ang key na `catalogue`, pinapanatili ng Board ang `overview` at pinapanatili ng Rules ang `usage`, dahil permanenteng kontrata ang room key, at gumagana pa rin ang `?tab=` bilang mas lumang alias. Ang hindi kilalang key ay nagbubukas ng Board.

Ang **bar** ay may hawak ng mga aksyon para sa buong system sa halip na isang room. Ang **Add from…** ay nagdadala ng brand ([Magdala ng brand](#bring-a-brand-in)), at ang **Tray** ay may hawak ng nakita ng scan na hindi mo pa naidaragdag. Ang **Export** ay nagsusulat ng system bilang isang file, at ang **More** ay may hawak ng **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions & publishing**, **Restore brand settings** at **Design systems**, na nagbubukas ng listahan sa Settings kung saan ka lilipat ([Itago at ilipat ang design system mo](#keep-and-move-your-design-system)). Bawat isa ay lumilitaw kapag may magagawa na ito. Sa phone, lumilipat ang **Add from…** sa **More** at ang **Export** ay lumilitaw bilang icon nito.

## Board

Kapag wala pang napili, nag-aalok ang Board ng apat na paraan para magsimula. Binubuksan ng **Start from a reference** ang source picker para sa logo, screenshot, web page o design file, at ang **Pick a colour**, **Choose a face** at **Add a logo** ay direktang nagbubukas ng mga kontrol na iyon. Ang pagbubukas ng isa ay walang isinusulat, at nandoon na simula pa lang ang **Explore the tools**.

Kapag may sarili nang anumang bagay, ipinapakita ng Board ang meron ka, na nangunguna ang sarili mong mga bilang. Ang Colours ay nagbibigay ng bilang ng mga kulay, na may mahinang `· N starter` kung saan ipinapakita ang mga minanang kulay; inilalagay ng strip nito ang mga kulay mo muna, saka hairline, saka ang kupas na starter. Ipinapakita ng Colourways ang bawat colourway bilang maliit na tile sa lead colour nito. Binabasa ang Type ayon sa role at itinatakda ang bawat family sa sarili nitong face (*Inter for headings*, na may *Starter for the rest* sa linya sa ibaba). Sinasabi ng Logos kung ilang slot ang puno (o **Not set**), ipinapakita ng Tokens ang corner radius at sinasabi ng Files na **Nothing yet** habang walang laman ang library. Bawat block ay nagbubukas ng room nito.

Ang design system na kasama ng app at puwedeng i-edit, gaya ng Lolly Demo, ay may lahat ng iyan simula pa lang: ipinapakita ng Board ang mga kulay, colourway, face at marka nito, na may tag na **Came with this app** sa tabi ng heading.

### Starter at sa iyo

Ang **Starter** ay ang salita para sa anumang kasama ng app sa halip na pinili. Ang bagong install ay walang kulay, isa lang neutral na ramp mula ink hanggang paper, para makapag-render ang mga surface, text at hairline bago magpasya ang sinuman. Ang parehong salita ay nagmamarka ng minanang materyal sa bawat room.

::: cols
## Starter

- Kasama ng app: ang ink-to-paper na neutral, ang starter na face, ang default na corner radius.
- Mahina, may **Starter** tag at walang tint.
- Hindi binibilang bilang mga kulay mo. Nasa **Tokens** ang mga neutral bilang **Neutrals · starter · 9**, at ipinapakita ng **Open** ang mga ito sa Colours bilang isang nakatiklop na grupo (`#/start?area=color&group=neutral`).
- Ang role na nakatayo sa starter na kulay ay nagsasabing *"Starter Paper stands in"*, na may **Choose…** sa picker nito.

## Sa iyo

- Pinili o ini-install mo.
- Buong lakas, at may tint na card kung saan ka nag-install ng face.
- Binibilang sa Board at sa Tokens.
- Ang role na sumusunod sa iba ay nagsasabing **↳ follows Primary** sa halip na ulitin ang pangalan ng primary.
:::

Hindi kailanman iginuguhit ang minanang materyal na may dashed na border, dahil dito ang dashed na border ay nangangahulugang drop target.

## Logos

Ibuhos ang folder ng mga marka mo sa drop zone sa itaas: ang **"Drop marks here, or choose several at once"** ay tumatanggap ng kasing-dami ng file na meron ka. Binabasa ang bawat file para sa hugis at ink nito, saka naghihintay sa ilalim ng **Waiting for a slot** bilang chip na nagsasabi kung ano ang itsura nito, tulad ng *"Looks like the Horizontal primary"*, kasama ang sukat na ginamit at **Place** button (**Replace** kung puno ang slot). Kung hindi sigurado, sinasabi ito ng chip at nag-aalok ng **Change slot**, na naglilista ng lahat ng walo. Walang inilalagay hangga't wala kang pinipindot.

Ang markang may sobrang walang laman na margin ay unang nakakakuha ng trim offer; sagutin ito o pindutin ang Escape at papasok ang orihinal nang hindi ginagalaw. Kung saan puwedeng punan ng marka ang walang lamang katabing slot, nag-aalok ang room ng derived na **mono** o **reverse** na bersyon bilang chip na may markang *Generated*.

Ang bawat marka ay napupunta sa grid ng walong opsyonal na slot, isa bawat **orientation** at **treatment**:

- **Mga orientation:** Horizontal (wordmark at simbolo sa isang hanay) at Vertical (nakapatong, para sa parisukat at matataas na espasyo).
- **Mga treatment:** Primary, Primary reverse (para sa madilim na background), Mono (isang kulay) at Mono reverse.

Ang grupong wala pang marka ay tumitiklop sa isang linya; buksan ito para makita ang mga slot nito. Mag-click ng slot para magdagdag ng PNG, SVG, JPEG o WebP, o mag-click ng punong slot para palitan ang marka. Nananatili sa device na ito ang lahat.

![Ang mga logo slot na nakabukas ang Horizontal at Vertical: ang bawat treatment ay sariling slot, at opsyonal ang bawat slot](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&system=new-design-system&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails.be-logo-group--fold%3Anot%28.be-logo-group--custom%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Mga custom na marka** ay mga markang tinatawag ng brand mo sa sarili nitong pangalan, tulad ng icon, crest o favicon.
- **Mas maraming identity.** Ang sub-brand, produkto o event ay puwedeng magkaroon ng sarili nitong buong set: **+ Add another logo** at pangalanan ang set. Ang pangunahing set mo ay "Your logo". Ipinapakita ng [Brand architectures](/info/brand-architectures.html) kung kailan tamang block ang logo identity.
- **Binabasa ng Lolly ang mga kulay ng logo.** Ang card sa ilalim ng drop zone, at muli sa itaas ng Colours, ay naglilista ng mga kulay ng logo at nagtatanong ng **Which is the main colour?**, na napili na ang pinakamalakas na kulay (hindi kailanman ang puting pinag-export nito). Idinaragdag ng **Use these colours** ang mga ito sa palette mo, ginagawang primary ang pangunahing kulay at, kapag may madilim na neutral ang logo na mababasa sa paper, ginagawa itong text colour. Iniiwan ng **Not now** ang mga ito sa Tray. Sa bagong install, agad na inilalapat ang pinakamalamang na sagot, at nag-aalok ang card ng **Undo** o ibang pangunahing kulay. Ang SVG ay nagbibigay ng eksaktong kulay; ang PNG, JPEG o WebP ay nagbibigay ng mga kulay na sumasakop sa totoong bahagi ng marka.

## Colours

Lumalaki ang room kasabay ng design system: ang unang pagbisita ay isang desisyon, at ang iba ay dumarating kasabay ng palette.

### Ang unang kulay

Ang system na walang sariling kulay ay nagpapakita ng mga neutral ng starter, nakabukas sa sarili nilang grupo, at sa itaas ng room ay isang field na may putol-putol na hangganan para sa paste at drop: isang malaking chip at isang field. Mag-drop ng larawan o listahan ng mga kulay saanman sa field, at babasahin ng Lolly ang mga kulay mula sa ini-drop mo.

- **Ang chip ang picker.** Pindutin ang **Pick a colour** at bubukas ang OKLCH card ng studio, na may seed na anumang laman ng field: ang pangalan at hex ng kulay muna, kasama ang mga colour space, ang wheel, ang apat na dial at alpha sa ilalim ng **Fine-tune**, at **Cancel** at **Add colour** sa paanan. Walang umaabot sa system hanggang pindutin mo ang **Add colour**.
- **Tumatanggap ang field ng anumang notasyon**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` o pangalan ng kulay. Mag-paste ng listahan at nagiging hanay ng mga chip na idadagdag nang isa-isa o gamit ang **Add all**.
- **Dalawa pang paraan papasok.** Ginagamit ng **Pick a colour from the screen** ang eyedropper kung meron ang browser, at binabasa ng **Take colours from an image** ang screenshot o litrato sa device na ito.
- **Hindi kailanman naka-disable ang Add.** Kapag walang laman ang field, binubuksan nito ang picker; ang text na hindi nito mabasa ay may linya sa ilalim ng field na nagsasabi nito.

Ang unang kulay mo ay nagiging **primary**, at kinukumpirma ito ng chip, tulad ng *"Primary is now Vivid Violet"*, na may **Fine-tune** para i-adjust ang kulay.


### Habang lumalaki ang palette

Ang mga kulay mo ay nasa tabi ng **In context** preview sa malapad na screen, at sa ibabaw nito sa mas maliit. Ipinapakita ng preview ang poster, chart o interface card sa palette mo. Ang mga starter na kulay ay nananatili sa sarili nilang nakatiklop na grupo, na tumitiklop kapag may sarili nang kulay ang system, at ang paste at drop field ay nagiging isang compact na row. Nasa **Export** ng bar at sa Tokens room ang export, kaya walang dala nito ang head ng room.

![Ang Colours room sa Lolly Demo: ang palette sa mga nakatiklop na grupo, bawat kulay na may pangalan at hex nito, at ang palette download sa head](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![Ang Colours room sa Lolly Demo pagkatapos magdagdag ng isang kulay: ang Colour roles table, saka ang chip ng bagong kulay na nag-aalok ng Use as Lead? at Fine-tune, katabi ng live na composition preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Mga colour role: kung ano ang tawag sa mga kulay

Sinasabi ng design system kung ano ang tawag sa mga kulay nito at kung para saan ang bawat isa, at binabasa iyon ng Lolly. Nasa unahan ng Colours room ang **Colour roles**. Sa malapad na screen, kahati ng view ang **In context**, kaya lumalabas ang pagbabago sa poster, chart at interface card habang ginagawa mo ito.

![Ang Colour roles table sa Wefthouse, isang imbentong textile brand, sa sarili nitong mga salita: ang mga colourway chip na Indigo, Madder at Weld, saka Main, Accent, Supporting at Tertiary, bawat isa ay may light at dark na kulay, binabasa bilang lead colour, partner colour at sa pangalan lang, at nakalista sa ilalim ng table ang Background, Text, Quiet text at Hairlines bilang mga pagbasang walang pumupuno na role](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=wefthouse&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

Apat ang column ng table, at sa telepono ay nagiging card ang bawat row na nagtatabi ng light at dark:

| Column | Ano ang laman |
|---|---|
| **Role** | Ang sariling salita ng design system, na puwede mong i-edit mismo doon, at isang linyang nagsasabi kung para saan ang kulay |
| **Light** at **Dark** | Ang kulay sa look na iyon para sa napiling colourway, kasama ang pangalan o value nito, at ang contrast nito |
| **Lolly reads this as** | Ang ginagawa ng tool sa role, sa sariling mga salita ng Lolly |

**Paano binabasa ng Lolly ang role.** Isang role ang kinukuha ng bawat pagbasa, kaya kapag pumili ka ng pagbasang hawak ng ibang role, lilipat dito ang pagbasang iyon. Hindi kailanman kumukuha ng kahulugan ang Lolly mula sa isang salita.

| Pagbasa | Ano ang kasunod nito |
|---|---|
| **Lead colour** | Malalaking hugis, button, ang kulay na nangunguna sa isang tool |
| **Partner colour** | Ang pangalawang kulay na inaabot ng tool |
| **Background** | Nasa likod ng lahat ng iba pa |
| **Text** | Mga heading at body text |
| **Quiet text** | Mga caption at maliliit na letra |
| **Hairlines** | Mga rule, border at divider |
| **By name only** | Walang tool na pumipili sa role nang mag-isa. Inaalok ito sa bawat colour field at sa Design, kung saan nananatiling naka-link ang pick, kaya sumusunod ito sa colourway |

Ang pagbasang walang pumupuno na role ay nananatili ayon sa depinisyon ng design system, at inililista ng room ang mga iyon sa ilalim ng table. Ang role na may parehong id ng isang pagbasa, tulad ng role na tinatawag na Primary, ay ang pagbasang iyon at hindi maililipat.

**Mga value.** Pindutin ang value para pumili ng kulay para sa role na iyon, sa look na iyon, sa napiling colourway. Ang **Same as light** ay ginagawang sumunod ang dark na value sa light hanggang pumili ka ng sarili nitong kulay. Ipinapakita ng **Aa** chip ang text na pinipili ng Lolly para ilagay sa kulay, at sinasabi ng linya sa ilalim ng value kung paano nababasa ang text na iyon, bawat look: **Text reads well**, **Large text only** o **Hard to read as text**. Tungkol iyon sa text sa ibabaw ng kulay at walang sinasabing masama laban sa mismong kulay, na puwede pa ring gumana para sa mga hugis at malalaking bahagi. Ang role na binabasa lang ayon sa pangalan ay nagpapakita ng parehong mga salita nang walang babalang kulay, dahil walang tool na naglalagay ng text dito nang mag-isa. Ang mga numero sa likod ng mga salita, APCA muna at WCAG pangalawa, ay nasa tooltip at sa picker. Minamarkahan ng **Own text colour** ang value na ang file ay nagsasabi ng kulay ng text, na nananatili. Minamarkahan ng **Copied** ang value na galing sa ibang colourway o sa partner colour at wala pang pumipili; ang **Keep this colour** sa picker ang nagsasara ng value.

**Mga panimulang punto.** Ang design system na walang sariling role ay nagpapakita ng mga salita ngayon: Primary, Secondary, Surface at Text. Walang isinusulat hanggang baguhin mo ang isa. Ang **+ Add a role** ay nag-aalok ng **Primary, Secondary** o **Main, Accent, Supporting, Tertiary** bilang mungkahi, o anumang salitang tina-type mo, kasama ang pagbasang makukuha ng bawat isa. Ang unang dalawang salita ang nagiging lead colour at partner colour. Patuloy na iginuguhit ng mga tool ang parehong kulay, at sa system na may isang lead colour, ang unang colourway ay ipinapangalan sa kulay na iyon.

**Pagpapalit ng pangalan, pag-aayos ng pagkakasunod, pag-aalis.** Ang pagpapalit ng pangalan ay salita lang ang binabago, kaya patuloy na gumagana ang lahat ng gumagamit sa role. I-drag ang role sa handle nito, o pindutin ang Space sa handle, gamitin ang arrow key at pindutin ang Space para ibaba. Sinasabi ng **Remove** kung ano pa ang gumagamit sa role. Kapag binabasa ito ng mga tool, iniiwan ng **Remove and keep those colours** ang bawat pagbasa sa kulay na iginuguhit nito ngayon. Ang house rule, guide group, tool field o ibang token na gumagamit sa role ay hawak ito hanggang magbago ang paggamit na iyon. Ang naka-save na Design document ay puwede ring gumamit ng role sa pangalan, at hindi iyon nakikita ng Lolly mula sa token file: ang dokumentong gumagawa nito ay nag-uulat ng kulay bilang hindi nalutas.

**Isang file na isinulat sa kamay.** Ang mga kulay na hawak ng token file na walang role na nagdedeklara ay nakalista sa ilalim ng **In this file, with no role yet**, bawat isa ay may field para sa salita at **Make a role**. Patuloy silang gumagana ayon sa pangalan sa alinmang paraan. Ang token na may digit sa pangalan ay hindi puwedeng maging role, kaya nananatili ito sa file at gumagana pa rin ayon sa path nito. Ang record sa file na hindi pumapasa sa validation ay nagpapakita ng table na walang kontrol at sinasabi kung bakit.

**Pareho ang mga salita sa buong room.** Ang mga chip, ang **Use as** row ng swatch at ang **Colour roles** group ng palette ay gumagamit lahat ng mga salita ng design system, at binubuksan ng tile ng colour role ang value nito. Walang bagong itinatala ang mga na-export na file tungkol sa mga role: nagbabago ang mga kulay sa render dahil nagbago ang mga token.

**Saan napupunta ang mga salita.** Naglalakbay ang mga salita at paglalarawan kasama ng design system. Binabasa ng mga agent ang mga ito sa design brief, `lolly://tokens` at `AGENTS.md` ng brand page, ipinapakita ng terminal ang mga ito sa `lolly system status`, at inililista ng brand page ang mga ito sa `brand.json` at sumusukat ng contrast pair para sa bawat role. Iniingatan ng bawat export format ang kaya nitong dalhin: iniingatan ng mga DTCG at Tokens Studio file ang lahat, iniingatan ng `DESIGN.md` ang mga salita at ang mga pagbasa, at iniingatan lang ng PowerPoint theme ang pagkakasunod ng brand. Nasa [Mga colour role sa ibang format](/info/design-tokens.html#colour-roles-in-other-formats) ang buong listahan. Laging sinisipi ang mga salita bilang data ng design system, hindi kailanman binabasa bilang mga tagubilin.

**Kung saan pinipili ang kulay.** Ang bawat colour field sa tool at sa Lolly Design ay nagsisimula sa mga role ng design system, sa sarili nitong pagkakasunod, na kita ang bawat salita at kung para saan ang kulay. Pinipili ng **Aa** sa tabi ng role ang kulay na ilalagay sa role na iyon. Kasunod ang iba sa ilalim ng **Other colours**, na walang sariling kopya ng colourway, ang mga on-colour at anumang pagbasang pinupunan na ng role. Nananatiling naka-link sa role ang pick at sumusunod sa colourway, patuloy na ipinapakita ng field ang salita anumang colourway ang napili, at gumagamit din ng salita ang Settings at Tokens. Ang design system na walang role ay nananatili sa grid ng mga swatch na dati nang meron.

### Bawat kulay na binabasa ng tool

Kapag nakasara ang **Colour roles**, ang mga unang desisyon ang nangunguna sa room bilang mga chip, bawat isa ay nagpapakita ng kulay na gumaganap sa role at ang pangalan nito. Sa system na walang sariling salita, ang mga ito ay **Primary**, **Secondary**, **Surface** at **Text**. Pindutin ang chip para pumili ng kulay nito mula sa sariling mga swatch ng palette. Ang **Every colour a tool reads**, sa paanan ng **Colour roles**, ay may buong strip.

Ipinapakita ng strip ang pitong kulay na mababasa ng tool: Primary, Secondary, Surface, Text, Muted, Edge at On primary, sa sariling mga salita ng design system kung meron. Pareho ang ginagampanan ng bawat isa sa bawat tool at export. Hindi kailangang i-set ang alinman sa mga ito (ang tatlong maluwag na kulay ay magandang system na), puwedeng pumuno sa isa ang anumang kulay at sinasabi ng readout kung paano nababasa ang text, sinusukat laban sa surface, APCA muna. Ang bawat row ay nagpapakita ng sariling kulay sa buong lakas, starter na kulay na pumapalit, o **↳ follows Primary**.

Hinango ang On primary mula sa primary, nagsasabing **Derived** at walang picker. Ang switch na **Light** at **Dark** sa tabi nito, at ang nasa tabi ng **In context**, ang pumipili kung aling look ang ipapakita ng strip, palette at preview.

Ang sariling accent ng app ay sumusunod sa design system bilang default. Iyon ang setting na **Interface follows the design system** sa **Settings → Appearance**; ang pag-off ng setting ay iniiwang neutral ang chrome ng app, habang ang mga tool, canvas at export ay sumusunod sa design system sa alinmang paraan.

**Mga colourway.** Ang design system ay puwedeng may ilang lead colour, bawat isa ay pinipili bawat piraso. Ang hanay na **Colourways** sa unahan ng **Colour roles** ay nagpapakita ng isang chip bawat colourway, na may **Default** sa canonical. Ang **+ Add** ay nagsisimula ng bagong colourway mula sa isa sa mga kulay ng palette. Pumili ng chip, at ipinapakita ng table, strip, palette at mga preview ang colourway na iyon; ang napiling colourway ay puwedeng palitan ng pangalan, i-duplicate, gawing default o alisin. Sa system na may mga colourway, kailangan ng bawat colourway ang sarili nitong primary at secondary, at sarili nitong surface kapag tinatint ng mga colourway ang background, kaya nananatiling nakatakda ang mga role na iyon sa swatch editor. Nasa [Magdagdag ng mga colourway sa design system](/info/colourways.html#add-colourways-to-a-design-system) ang mga hakbang at ang token format, at ipinapakita ng [Lolly Demo in use](/info/lolly-demo-in-use.html#colourways-on-real-work) ang mga colourway sa totoong gawa.

### Humanap ng mas maraming kulay

Tatlong tool ang nagtatayo sa primary mo. Ang una at ikalawa ay nagmumungkahi lang, at ang pangatlo ay pinapalitan ang palette pagkatapos mong i-review ang pagbabago.

::: cols
## Explore shades & harmonies

Pumili ng **Starting colour**, **Scheme** (Mono, Complement, Analogous o Triad) at kung ilang **Shades** (3 hanggang 20, default 5). Ang **Fine-tune** ay nagtatakda ng UI intensity, contrast at text on brand. Mag-click ng shade para idagdag, o **Add 5 shades** para sa isang grupo. Nananatili ang mga kulay at role mo.

## Find matching colours

Pumili ng **Harmony**: Complementary, Adjacent, Triad, Tetrad o Analogous (na may **Accents** mula 2 hanggang 5 at **Angle** mula 10° hanggang 45°). Bawat kandidato ay may nabuong pangalan at **+ Add**, isang pindot bawat kulay.

## Rebuild the whole palette

Pinapalitan ang palette mula sa isang panimulang kulay, pagkatapos ng review kung ano ang magbabago at ano ang mananatili. May checkpoint na kinukuha muna, at iniaalok ang **Undo** pagkatapos.
:::

Ang tatlo ay gumagamit ng parehong perceptual colour maths (OKLCH) tulad ng engine. Sa **Explore shades & harmonies**, ipinapakita ng mga row na **Primary**, **Neutral** at **Secondary** ang mga iminumungkahing shade, at ipinapakita ng **Theme preview** ang mga halimbawang light at dark kasama ang mga contrast reading nito.

![Tatlong iminumungkahing grupo ng shades, may mga indibidwal na add control at hiwalay na Theme preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Mga nabuong accent, bawat isa may swatch, auto-generated na pangalan, hex nito at isang Add button](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Pagkumpirma ng isang nabuong palette

Buksan ang **Rebuild the whole palette…** at pindutin ang **Preview full rebuild**. Binibilang ng review kung ilang role ang nananatili ayon sa itinalaga mo, ilan sa sarili mong kulay ang iniingatan at ilang shade curve, print lock, nakatagong shade at gradient stop ang re-anchored o iniingatan. Kinukumpirma ng **Apply rebuilt palette**; walang binabago ang **Cancel**. Pagkatapos, nag-aalok ang card ng **Undo** na may focus dito, at ibinabalik ng checkpoint na kinuha bago ang pagpapalit ang buong system.

Ang system na may mga colourway ay nag-iingat ng bawat colourway sa rebuild. Sinusunod ng canonical na colourway ang bagong panimulang kulay, at ang bawat ibang colourway ay nag-iingat ng sarili nitong mga kulay, pangalan, pagkakasunod-sunod at mga setting. Inililista ng review kung alin ang sumusunod at alin ang nag-iingat ng mga kulay nila. Hindi nire-rebuild ng Lolly ang system na nag-e-encode ng mga colourway nito sa paraang hindi nito ma-edit; sinasabi ng card kung bakit, at walang nagbabago.

### Ang mga expert na seksyon

Apat na nakatiklop na seksyon ang nasa ilalim ng preview at ng mga role. Bawat isa ay direktang bumubukas gamit ang `#/start?area=color&focus=<name>`:

- **Explore shades & harmonies** (`focus=generate`), inilarawan sa itaas.
- Ang **Shade curves** (`focus=curves`) ay hinuhubog muli ang ramp punto por punto, na may magkakahiwalay na lightness, chroma at hue curve (L / C / H) at nagre-redraw ang mga shade habang nagda-drag ka.
- **Contrast** (`focus=contrast`): ang **Contrast-lock** ay nire-retone ang ramp para abutin ang mga APCA target laban sa background na pinili mo, at ang **Rotate hue** ay iniikot ang buong ramp sa wheel.
- Ang **Print** (`focus=print`) ay nagtatakda kung ano ang nagiging primary sa press: ang awtomatikong value nito, naka-pin na CMYK build o pinangalanang spot ink.

### Ang palette at bawat swatch

Inililista ng palette ang mga kulay mo sa mga nakatiklop na grupo, bawat isa ay may sariling **+ Add**. Gumawa at palitan ang pangalan ng mga grupo ayon sa gusto mo. Hindi kailanman gumagawa ng pangalawang tile ang role: ang tile na tinuturo ng role ay nagsusuot ng pangalan ng role, tulad ng **Primary**. Ipinapakita ng **Colour chart** sa ilalim ng mga tile ang parehong mga kulay sa OKLCH **Wheel** (mag-drag ng tuldok para i-recolor, mag-click sa walang laman para magdagdag ng swatch) at sa **Gamut** chart, na nagpapakita kung saan nagtatapos ang naipapakitang saklaw. Direktang binubuksan ng `#/start?area=color&focus=chart` ang chart.

![Ang palette pane, bawat grupo ay maaaring i-fold, may palette download sa head nito](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Ang OKLCH wheel - ang angle ay hue, ang distansya palabas ay chroma at ang mga grey ay sumasakay sa isang lightness rail sa gilid](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Mag-click ng swatch para buksan ang editor nito:

- **Rename** ang swatch.
- **Itakda ang kulay** sa mga OKLCH slider, o sa **Hex**, **HSL**, **RGB** o **CMYK**. Nagbabasa at nagsusulat ang value field sa aktibong space. Ang CMYK dito ay nagtatakda ng kulay sa screen sa pamamagitan ng conversion; para i-pin ang eksaktong tinta, gamitin ang **Print substitutes**.
- Pinipili ng **Stored as** kung paano sine-save ang swatch: **LCH** (ang default, perceptual at wide-gamut), Hex, RGB o HSL.
- Binibigyan ng **Use as** ang swatch ng role nang direkta, sa sariling mga salita ng design system kung meron. Pindutin muli ang naka-highlight na role para alisin ang role.
- **Print substitutes** (nakatiklop): i-lock ang **CMYK** mula **Auto** tungo sa eksaktong ink value, o magtakda ng **Spot colour** na may **Name** (tulad ng `PANTONE 186 C`), opsyonal na **Book** at **Finish** para sa foil, emboss, deboss, spot varnish, soft touch o die cut, crease o perforation. Ginagamit ng press ang mga lock na ito kapag nag-export ka ng CMYK PDF o TIFF; tingnan ang [Mga colour profile](/info/exporting.html#colour-profiles).
- **In other spaces** (nakatiklop): isang value bawat colour space, hinango o isinulat mo, at ang isinulat mo ang nananaig sa export.

Ligtas ang **pagbura ng swatch**. Itinatago ang mga hinangong shade at theme role, kaya walang masisira sa nagbabasa sa mga ito, habang inaalis ang mga kulay na idinagdag mo.

::: details Paggawa gamit ang maraming swatch
Bawat swatch ay may drag handle. Mag-drag para mag-reorder sa loob ng grupo, o mag-focus sa handle, pindutin ang Space, gamitin ang mga arrow key at pindutin muli ang Space para ibaba; kinakansela ito ng Escape. Sa phone, apat na kulay bawat hanay ang palette at lumilitaw ang mga handle sa Select mode, sa halip na isang hanay sa ilalim ng bawat kulay. Para ilipat ang mga kulay sa pagitan ng mga grupo, gamitin ang **Group** control ng editor o pumili ng ilan at gamitin ang **Move to**.

Hindi kailangan ng hiwalay na switch ang selection. Lumilitaw ang bar at ang mga checkbox kasama ng unang napiling tile at nawawala kasama ng huli.

- **Mag-drag sa walang laman na espasyo** para gumuhit ng parihaba; bawat tile na natatamaan nito ay sumasali sa seleksyon, sa iba't ibang grupo. Walang idinaragdag ang nakatiklop na seksyon.
- Ang **Shift-click** ay kumukuha ng saklaw ayon sa pagkakasunod ng pagbasa, ang **Cmd/Ctrl-click** ay nagto-toggle ng isang tile, at ang karaniwang click ay nagbubukas ng editor.
- Ang bawat header ng grupo ay may **Select all**, at ang **Cmd-A** na may naka-focus na tile ay kinukuha ang bawat kulay na pag-aari mo, hindi kailanman starter.
- Ang grid ay may iisang tab stop: gumagalaw ang mga arrow, nagpapalawak ang Shift-arrow, nagto-toggle ang Space, nag-aalis ang Delete at nagki-clear ang Escape. Para i-nudge ang channel, pindutin muna ang `l`, `c` o `h`.
- Sa touch screen, pindutin nang matagal ang tile para simulan ang seleksyon, saka mag-tap para magdagdag.

Ang bar ay nagsasabing **{n} selected**, saka **Move to**, **Give a role** (bawat kulay ay kumukuha ng susunod na role nang paisa-isa), **Download** (ang seleksyon sa alinman sa anim na palette format), **Duplicate** (kopya ng bawat isa, inilalagay pagkatapos ng orihinal), **Copy values** at **Delete**. Ang isang kopya ay direktang bumubukas sa editor; ang marami ay nananatiling napili. Ang isang Cmd/Ctrl-Z ay binabawi ang buong bulk action.
:::

### Mga Gradient

Ang opsyonal na **Gradients** panel ay bumubuo ng blend token mula sa palette. Bawat gradient ay may preview, 2 hanggang 8 pinangalanang stop at anggulo. Ang stop ay tumuturo sa swatch, kaya i-recolor ang swatch at susunod ang gradient. Ang mga blend ay tumatakbo sa OKLCH.

Ang mga palette download (design token, CSS, SCSS, GIMP at Adobe Swatch Exchange) ay nasa head ng palette, sa tabi ng heading nito. Inilalarawan ng [Dalhin ang palette at mga font mo saanman](/info/using.html#take-your-palette-and-fonts-anywhere) ang bawat format.

## Type

Kapag walang sariling face, ang room ay isang card: **Primary**, nakatakda sa laki ng pagbasa sa face na naglilingkod dito ngayon, na may **Starter** tag, **Choose for Primary** button at ang linyang *"Nothing installs until you choose one."* Ang Headings, code at italic ay sumusunod sa primary hanggang piliin mo ang mga ito; ipinapakita ng **Choose them separately** ang mga card nila.

![Ang Type room na wala pang napiling face - isang card sa reading size, may Starter tag dito, at isang filled na Choose for Primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Pumili ng isang face at bubukas ang room sa apat na role card, ang Fonts list at live na specimen:

- **Primary**: body copy, mga button at bawat tool.
- **Headings**: ang display face para sa `h1` at `h2`.
- **Code**: monospace na face para sa code at data.
- **Italic**: tunay na italic para sa diin, quotation at asides.

Ang card ay may tint lang kung saan mo ini-install ang face na iyon, at sinasabi ng button nito kung para sa anong role ito: **Change Headings** sa sarili mong face at **Choose for Headings** sa lahat ng iba. Hindi pinuputol ang sample line kundi bumabalot ito. Walang ginagawang commit ang anumang nasa card: binubuksan ng button ang compare stage para sa role na iyon.

![Ang apat na role card na nakalantad - bawat isa naka-set sa face na naglilingkod dito, may Starter tag kung saan walang pumili, at sumusunod ang Italic sa primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Ang compare stage

Bumubukas ang stage sa loob ng room, sa ilalim ng card na pinindot mo, at tumitiklop ang mga card sa isang-linyang strip para makita ang stage sa unang screen ng phone. Kinakansela ng Escape at ibinabalik ang focus sa card.

1. Pindutin ang **Choose for** at ang role sa card.
2. Mag-type ng family name at pindutin ang **Preview**, o pindutin ang isa sa anim na **Pinned** family sa ilalim ng field.
3. Pindutin ang **Use this face**.

![Nakabukas ang compare stage sa ilalim ng card nito, may search row, ang mga pinned na family at ang mga card na nakatiklop sa isang one-line strip](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**Isang beses lang itinatanong ang pahintulot.** Sa unang beses na umabot ang preview sa Google Fonts, nagpapaliwanag ang dialog: *Google learns the family name and your IP address. The file is then kept on this device and used offline. This is the one step in the studio that reaches a third party.* Itinutuloy ng **Fetch from Google** at naaalala ito. Iniiwan ng **Cancel** ang card na nagsasabing *"Not fetched. Nothing was sent to Google."*, na may sarili nitong **Fetch from Google**.

**Mag-drop ng font file sa stage** (TTF, OTF o WOFF) para i-preview ang lisensyadong typeface na pag-aari mo na. Sa alinmang paraan, nananatili ang face sa device na ito, nagre-render offline sa app, sa mga tool at sa bawat export, at sumasama sa design system file. Lahat ng nasa Google Fonts ay may bukas na lisensya (OFL, Apache o UFL).

### Fonts on this device

Inililista ng **Fonts** panel ang bawat face sa device na ito at ang role na pinaglilingkuran nito. Ang mga face na idinagdag mo ay nangunguna sa ilalim ng **In the design system**, bawat isa ay may mga role nito at pagbura. Sumusunod ang mga starter na face sa isang mahinang, nakatiklop na row. Binubuksan ng **Add a face** ang compare stage para sa anumang role. Ipinapakita ng **Type roles** panel ang live na specimen ng bawat role kasama ang family at estado nito, tulad ng *Inter* o *Inter · follows Primary*.

## Tokens

Ang mga token ay ang mga pinangalanang value sa likod ng design system: mga kulay, typeface, logo, sulok at spacing. Binabasa ng mga tool ang mga ito ayon sa pangalan, kaya ang pagbabago rito ay umaabot sa bawat tool nang sabay.

![Ang Tokens room: ang head na may halimbawa mula sa system at ang mga file action, mga tile na nagbibilang ng bawat uri ng token, saka ang mga pares ng kulay na may contrast readout](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Ang head** ay nagbibigay ng halimbawa mula sa sarili mong system (*Primary is Spearmint, #033633*) at ng mga file action: **Download** (ang buong system bilang design token, o ang palette sa limang ibang format), **Copy CSS** at **Add from…** para basahin pabalik ang JSON file.
- **Mga tile** na nagbibilang ng bawat uri ng token at lumilipat sa seksyon nito: Colours, Type, Logos, Shape and spacing, More at All tokens. Binibilang nila ang laman ng bawat seksyon; ang seksyong may hawak lang ng galing sa blangkong starter ay may tag na **Starter**, at ang system na kasama ng app ay binibilang ang sarili nitong materyal nang walang tag. Sa phone, dalawang hanay ng tatlo ang mga tile.
- Ang **Colours** ay nagsisimula sa mga pares na pinagsasama ng mga tool (text sa surface, sa primary, muted sa surface) na may APCA readout sa light at dark, at nagfa-flag ng **Weak contrast** kung saan kulang ang pares. Saka ang bawat grupo ng kulay: ramp bilang isang hanay ng mga chip, ibang mga kulay na may value nila at ang reference na ginagamit ng mga tool, tulad ng `{color.brand.spearmint}`. Pindutin ang reference para kopyahin ang reference. Binubuksan ng **Edit in Colours** ang grupo sa Colours room. Sa design system na may [mga colour role](#colour-roles-what-the-colours-are-called), nauuna ang **Colour roles**, na may bawat role nang isang beses sa sariling mga salita at ayos ng system. May kulay ang role para sa bawat colourway at look, at nananatili ang mga kulay na iyon sa role sa halip na lumabas bilang sarili nilang kulay: baguhin ang mga ito sa talahanayan ng Colour roles.
- Inililista ng **Type** at **Logos** ang face para sa bawat role at bawat logo slot, na may **Edit in Type** at **Edit in Logos** kapag may sarili ka na.
- Hawak ng **Shape and spacing** ang **Rounded corners** (`shape.radius`) at **Spacing rhythm** (`space.base`). Bawat isa ay nagsasabing *Lolly default* hanggang galawin mo ang slider at *Yours* pagkatapos, nagse-save agad at maaaring i-undo.
- Nagdaragdag ang **More tokens** ng spacing, sizing, stroke width, opacity, rotation, payak na numero at anino, naka-store bilang karaniwang [design tokens](/info/design-tokens.html).
- Inililista ng **App appearance (advanced)** ang mga kulay, laki at anino na ginagamit ng sariling mga screen ng Lolly, at hinahanap at ine-edit ng **Inspect every token (advanced)** ang anumang naka-store na value, na ipinapakita muna ang bawat pagbabago para sa review. Doon, nakalista kasama ng role ang mga value ng colour role sa bawat colourway: piliin ang token ng role para makita ang isang hilera bawat colourway, light at dark magkatabi, at sinasabi ng count line kung ilang value ang hawak ng mga role. Ipinapakita ng read-only na design system ang parehong listahan.

Ang seksyong walang laman ay nag-aalok ng paraan para punan ang puwang: **Pick a colour**, **Choose a face** o **Add a logo**.

## Files

I-drop ang mga file na iniingatan ng brand mo, bukod sa mga logo: mga **vector**, **image**, **audio** at **motion** file (video, Lottie at animation). Lumilitaw ang mga ito sa [Assets](/info/using.html#assets-your-library), nakaayos sa mga seksyon at handa sa asset picker ng bawat tool, at nananatili sa device na ito.

## Rules

Ang **Rules** ang naglalagay sa mga pinili ng brand mo sa trabaho: kung ano ang puwedeng baguhin ng mga tao, kung ano ang nananatiling nakapirmi at kung ano ang kayang suriin ng Lolly.

![Ang Rules sa Lolly Demo: apat na house rule, bawat isa ay may marka na Checked in Design at Required o Advisory, saka Try your design system in use kasama ang mga halimbawa nitong handang i-render](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

Inililista ng **Brand rules** ang mga rule mo. Ang **Add rule** (o **Add your first rule**) ay nagbubukas ng maikling form:

- isang **Rule name** sa sarili mong mga salita, tulad ng *Beacon accents*;
- ang **Check**: **Colour choices**, **Font choices**, **Fixed artwork** o **Text length**, kasama ang brand role na ginagamit nito, sa sarili mong pangalan para sa role;
- ang **Example** na pinag-aaplayan nito (Poster, Title slide, Content slide o Lolly Chart), ang **Mode** at kung **Required** o **Advisory** ito;
- **Reviewed by**, saka **Save draft** o **Approve & save**.

Itinatala ng pag-apruba ang sarili mong desisyon sa device na ito. Ang mga aprubadong required na rule ay naglilimita sa reusable na poster, at sakop lang ng mga check ang mga halimbawang PNG; wala silang binabago sa ibang tool.

Ang mga rule na dala ng design system sa token file nito, tulad ng aprubadong pagpapares ng kulay, bigat at alignment ng text o logo bawat surface, ay nakalista rito bilang **Checked in Design**. Sinusuri ng Lolly Design ang mga ito layer por layer sa **Before you export** card ng export panel, at ganoon din ang ginagawa ng `lolly check` para sa naka-save na Lolly Design document ([Before you export](/info/design.html#before-you-export)). Ang rule na walang checker ang build na ito ay iniingatan ayon sa ibinigay at minamarkahang **Unchecked**.

Apat na aprubadong house rule ang dala ng Lolly Demo. Hindi kailanman sinusulat sa capital ang mga headline: required ang rule na iyon, kaya iniuulat ng `lolly check` bilang error ang headline na naka-capital. Advisory ang tatlo pa. Naka-left-align ang body text. Nasa mga light na surface ang primary mark at nasa mga dark ang reverse mark. Ang putol-putol na linya ay nangangahulugang i-drop dito.

Nagre-render ang **Try your design system in use** ng apat na halimbawa mula sa kasalukuyang revision gamit ang **Render & check examples**. Pumili ng **Mode** at **Try your own text** para sa heading, supporting text at slide text. Bawat halimbawa ay nag-uulat ng nasukat, kasama ang **See checks & sources** at **Download check report**, at ang **Make reusable poster** ay nagda-download ng `.lolly` na ang nakapirming layout at aprubadong input choice ay sumasama sa file. Lokal ang mga halimbawa: walang nalalathala o naaaprubahan sa pagpapatakbo ng check.

Ang build na may kasamang nakapirming brand ay nagpapakita ng parehong mga rule at halimbawa na read-only, sa ilalim ng *This brand is set*.

## Skills

Inililista ng **Skills** ang [brand skills](/info/brand-skills.html) ng aktibong design system: ang mga nakasulat na pamantayan ng brand, isa bawat disiplina, para sa mga tao at AI agent. Ang bawat row ay nagbibigay ng disiplina, ang sariling status ng brand (**Draft** o **Approved**), kung pampubliko o internal ang skill at ang revision nito. Pumili ng row para basahin ang skill sa tabi ng coverage nito, na naghahambing ng mga linya ng skill sa mga token mo: ang sinusuri ng Lolly, ang nagkakasalungat, ang nagkakasundo at ang gabay lang.

Isinusulat ng **Download skill (.zip)** ang skill bilang Agent Skills folder para sa agent tool, na ang mga catalog link ay tumuturo sa Lolly na ito, at inilalagay ng **Copy as one file** ang parehong text sa clipboard para sa chat window. Ang design system na walang sariling skill ay naglilista ng baseline na isinusulat ng Lolly mula sa mga token at house rule nito sa tuwing binabasa ang baseline. Nagbabasa ng skill ang room at hindi kailanman nag-e-edit.

## Magdala ng isang brand

Ang **Add from…** sa bar ay nagbubukas ng picker na nagtatanong kung ano ang meron ka, hindi kung anong format ito:

- **Design tokens or a design file**: DTCG o Tokens Studio JSON, isang Penpot project, isang zip ng mga token set, isang Lolly design system pack, isang SVG, isang `DESIGN.md` o isang brand page folder.
- **PDF**: isang deck o guidelines file, binabasa sa device na ito para sa mga kulay, marka at naka-embed na typeface nito.
- **Logo or screenshot**: nagiging iminumungkahing palette ang larawan, binabasa sa device na ito. Kulay ang binabasa nito, hindi ang typeface o layout.
- **Saved web page**: isang HTML file at ang mga CSS file nito, o na-paste na HTML o CSS, hanggang 20 file at 2 MB. Ang text lang na ibinigay mo ang binabasa: hindi kinukuha ang mga naka-link na resource at hindi tumatakbo ang mga script.
- **Font file**: TTF, OTF o WOFF. Binubuksan ang Type room, kung saan ini-install ang face.
- **Website**: isang page, binabasa para sa mga kulay at type nito. Lumilitaw lang ang tile na ito sa device na kayang magbasa ng page, at sinasabi nito kung aling reader ang gamit: ang app sa device na ito, o ang browser extension sa background tab, naka-sign in bilang ikaw. Ang pagbibigay ng URL ay pinupunan lang ang field; ang pagpindot sa fetch ang consent.

Piliin ang design-file source at ililista ng susunod na card ang mga tinatanggap na format bilang icon tile, na ang buong card ay iisang drop target. Puwede ka ring mag-drop ng file diretso sa studio.

![Ang import card - ang mga tinatanggap na format ay nangunguna bilang icon tiles, at ang buong card ay isang drop target](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- Ang **Lolly design-system pack** (`.lolly`, o lumang `.zip`) ay ini-install sa isang hakbang.
- Ang **Penpot** export (`.penpot`) ay nagdadala ng mga design token nito.
- Ang **Design Tokens** (W3C DTCG) o **Tokens Studio** file (`.json`) ay nagdadala ng mga token nito. Ang paglalarawang humihiling sa reader na huwag pansinin ang mga tagubilin, nag-aangkin ng mga pahintulot o humihiling magpatakbo ng code ay hindi isinasama, at sinasabi ng import kung saan ito nakalagay. Pagsusuri ito linya por linya at nalalampasan nito ang ibang pananalita, kaya basahin ang file mula sa taong hindi mo kilala bago i-apply ang mga token.
- Ang **plain SVG** ay ini-scan para sa mga kulay na pipiliin mo, at ang una ang nagiging primary mo.
- Ang **`DESIGN.md`** (`.md`) ay napupunta sa **Try these colours** kasama ang mga token nito ayon sa pagkakasulat. Ang prose nito ay puwedeng itago bilang draft na brand skill, at minamarkahan ng card ang mga linyang humihiling sa reader na huwag pansinin ang mga tagubilin, mag-angkin ng mga pahintulot o magpatakbo ng code. Hindi nakikita ng mga agent at brand page ang draft hanggang pindutin mo ang **Keep this skill** sa Skills room, at nananatiling internal ang naitagong skill.
- Ang **brand page folder**, pinili bilang folder, na-drop, o naka-zip, ay napupunta sa parehong review. Sinusuri ang bawat file laban sa `brand.json` ng folder, at ang isang hindi tugma ay nagtatanggi sa buong folder. Idinadagdag nito ang mga token. Nananatili sa folder ang mga logo at font.

Binabasa ng Lolly ang brand page mula sa mga file na ibinigay mo. Hindi ito kumukuha mula sa address ng ibang site.

### Isang file na may sariling mga salita para sa kulay

Ang token file o `DESIGN.md` ay puwedeng gumamit ng sarili nitong mga salita para sa mga kulay, tulad ng main, accent, supporting at tertiary. Kapag nakakita ang Lolly ng ganitong mga salita, inililista ng review ang bawat isa bago mag-apply ng anuman: ang salita, ang kulay nito sa bawat look, ang token na pinanggalingan nito at kung ano ang babasahin dito ng Lolly. Iminumungkahi ng Lolly ang mga pagbasang iyon mula sa mga salita lang, laban sa maikling listahan, at walang ginagamit na model. Ang salitang wala sa listahan ay dumarating bilang sarili ng brand, **By name only**. Palitan ang pangalan ng anumang salita, sabihin kung para saan ito, basahin bilang iba, o alisan ng tsek para iwan bilang named colour.

Isinusulat ng **Install with these roles** ang mga ito, at ini-install ng **Install without roles** ang file nang eksakto kung paano ito dumating. Ang file na walang ganitong mga salita ay walang ipinapakitang bagong hakbang. Ang file na nagsasabi ng sarili nitong mga role, tulad ng isinulat ng Lolly, ay ipinapakita ang mga ito ayon sa pagkakasulat at ini-install nang walang pagbabago, at puwede mo silang i-edit pagkatapos sa Colours room. Walang review ang terminal, kaya iniingatan ng `lolly system import` ang nakasaad na record at iniiwang named colour ang mga salita ng ibang file.

### Mag-review ng reference

Ang logo, screenshot, website o naka-save na page ay nagbubukas ng **Try these colours**: halimbawa sa mga iminumungkahing kulay, **Main colour** na puwede mong baguhin at pangalan para sa bagong system. Isinasaad ng isang box kung ano ang ginagawa ng paglalapat: **pinapalitan** nito ang aktibong token setting ng nabuong palette at default na estilo, **iniingatan** nito ang mga font at library file mo at ang naunang system ay maaaring **mabawi**. Inilalapat ng **Apply suggested settings** ang light at dark na palette, pagkatapos ng checkpoint, at maibabalik ng **Restore brand settings** ang mga lumang setting. Pumipili ang **Change reference** ng ibang source.

Ipinapakita ng **Palette, source details and individual choices** kung ano ang nabasa, anumang font name na natagpuan at ang contrast ng preview. Mga mungkahi lang ang font name; ang Type pa rin ang kung saan ka nag-i-install ng face. Ang mga detalye ng source ay maaaring may typography, gap, padding at corner value kung naobserbahan, na may label na **Not observed** kung hindi. Ang naka-save na page o native na pagbasa ng website ay nag-uulat ng mga declared na estilo, na maaaring hindi ginagamit ng page, at ang browser extension ay maaaring mag-ulat ng mga sinukat na estilo mula sa sample ng nakikitang elemento. Mga obserbasyon ang mga ito: walang ini-install, at hindi kailanman pinapalitan ng source spacing ang sarili mo. Iniingatan ng **Choose individual items in the tray** ang mga solong item, at sine-save ng **Download design context** ang JSON report ng mga obserbasyon, iminumungkahing token at impormasyon ng source (kasama ang SHA-256 ng anumang ibinigay na HTML o CSS). Walang hilaw na text ng page ang report at hindi ito signed na Content Credential.

Ang mga PDF at design-file import ay nag-iingat ng sarili nilang review control. Ang mga item sa **Tray** ay walang binabago hanggang idagdag mo ang mga ito sa room na may-ari ng ganoong materyal. Binubuksan ng `#/start?source=<kind>` ang picker sa isang source (`file`, `pdf`, `image`, `font`, `url`, `page`), at binubuksan ng `?import` ang payak na listahan.

### Humanap at maghambing ng look

Buksan ang **Find a look** mula sa Board o mula sa design-system list sa Settings. Mag-browse ng mga system na naka-save sa device na ito at ilang reusable na halimbawa ng Lolly, at maghanap ayon sa pangalan, colour tag o declared na font. Ang **Closest to my current palette** ay nag-aayos ayon sa sinukat na pagkakahawig ng kulay, na ang tumutugmang font ang nagpapasya sa tabla; hindi ito quality score.

Mag-click ng look para i-preview ito in context. Walang binabago ang pag-preview. Ginagamit ng **Use this look** ng bawat card ang look na iyon. Ang naka-save na system ay nagiging aktibo, na walang ine-edit. Ang mga kulay ng halimbawa ay dumadaan sa karaniwang checkpoint papunta sa bukas na design system, na ang mga logo, font at lahat ng hindi tinutukoy ng halimbawa ay nananatili. Nagdaragdag ang **Compare looks** ng checkbox sa bawat card, para makapili ka ng dalawa at maihambing nang magkatabi. Binabawi ng **Restore brand settings** ang naunang look. Ang mga naka-save na system ay may mae-edit na **Search tags** sa ilalim ng **Details and design context**. Ang mga halimbawa ay orihinal na colour recipe ng Lolly, walang scraped na koleksyon at walang account.

![Ikumpara ang Sunroom at Orchard nang magkatabi bago ilapat ang alinman sa dalawang colour system.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

## Itago at ilipat ang design system mo

### Ilipat ang brand sa pagitan ng mga device

Ang **Export** ay nagsusulat ng isang **`LollyBrand-….lolly`** file: ang mga token, font, logo at theme preference mo, na may integrity manifest na sinusuri pagbalik. Ang mga web release bago ang 1.0.7 ay pinangalanang `.zip` ang parehong file, at tinatanggap pa rin ang baybay na iyon. Ang **Tokens (.json)** ay nagsusulat ng payak na design-tokens na dokumento nang mag-isa, walang font o logo, para sa repository, build step o ibang tokens tool.

Para ibalik ang isa, gamitin ang **Add from… → Design tokens or a design file**, o i-drop ang file sa studio. Ganito ibinibigay sa iyo ng kasamahan ang brand, o dinadala mo ang isa sa pangalawang install, nang walang account at walang cloud. Sinasaklaw ng [Pakikipagtulungan sa mga partner](/info/partners.html) kung ano pa ang ipapadala kapag ang tatanggap ng brand mo ay nagtatrabaho sa ibang organisasyon. Para magdala ng brand mula sa command line, tingnan ang [`ingest:brand`](/info/configuration.html#brand-packs).

Ang **Fonts for Linux (.rpm)** ay nagpa-pack ng mga font na idinagdag mo sa naii-install na RPM. Kung ikaw mismo ang nag-upload ng alinman sa mga ito, hihilingin muna ng Lolly na kumpirmahin mong puwede mong i-redistribute ang mga ito.

### Ibalik ang naunang mga setting

Buksan ang **More** sa bar, piliin ang **Restore brand settings**, pumili ng may-petsang checkpoint at pindutin ang **Restore**. Ibinabalik nito ang mga kulay, type setting at iba pang token para sa aktibong brand; nananatili ang mga font at larawang file. Sine-save muna ng Lolly ang kasalukuyan mong mga setting bilang **Before restore**, para mabawi mo ang restore kahit pagkatapos isara ang browser. Iniingatan sa device na ito ang huling 20 checkpoint.

### Mga bersyon

Ang nailathalang bersyon ay **permanente at pinangalanang kopya** na iniingatan sa device na ito. Hindi ito nagbabago, kaya ang tool o link na nagpa-pin dito (gamit ang `designv`) ay patuloy na gumuguhit ng parehong bagay. Ang system na may sarili mong laman ay naglilista ng **Versions & publishing** sa **More** menu ng bar; pagkatapos ng unang publish mo, sumasama ang **Versions** sa mga room. Direktang binubuksan ito ng `#/start?area=versions`.

- **Permanente ang bersyon.** Wala pang pagbura, at sinasabi ito ng panel.
- **Nangunguna ang mga pag-alis sa compatibility card**, dahil ang inalis na token ang sumisira sa tool.
- **Hindi mababawi ang pag-publish; mababawi ang pag-restore.** Ang *Restore latest from this version* ay karaniwang edit, na may **Undo** na iniaalok agad.

Ang **Publish only** ay nag-iingat ng bersyon nang hindi binabago ang sinusundan ng mga tool; ang **Publish and make active** ay ginagawang sumunod ang mga tool at app sa bersyong iyon. Ang **Follow the latest again** ay ginagawang live ang bawat edit sa sandaling gawin mo ito.

### Publish a brand page

Ang [brand page](/info/brand-page.html) ay isang address para sa mga tao at para sa mga agent: page na nagpapakita ng mga logo, kulay, type at halimbawa, na may parehong mga katotohanan sa mga file sa tabi ng page. Ipinapakita ng **Publish a brand page**, sa ilalim ng Versions & publishing, ang live na page at, sa tabi ng page:

- **Goes public**: bawat file, nakagrupo, kasama ang laki nito.
- **Held back**: kung ano ang hindi isinama, at bakit. Ang logo na walang naitalang lisensya ay hindi isinasama hanggang lagyan mo ng tsek ang pangalan ng logo. Kailangan ng font file ng naitalang lisensyang pumapayag na ipasa ito, at nagpapakita ang page ng outlined na specimen kapag hindi kasama ang file. Hindi kailanman lumilitaw ang mga internal brand skill.
- **What was checked**: mga pares ng kulay bawat colourway at mode, at ang mga house rule. Mga sukat ang mga ito, hindi hatol.
- **In your words**: isang usage statement at isang contact. Inililimbag ng page ang isinulat mo at walang idinaragdag na lisensya o legal na claim ang Lolly. Pinapatay ng isang switch ang linyang "Made with Lolly" sa footer.
- **On exports**: isang switch na [nagtatala ng address ng page sa mga export ng design system na ito](/info/brand-page.html#lead-back-from-your-files). Naka-off ito hanggang i-on mo, kailangan nito ng `https` na address, at hindi ito sumasama sa pack o kopya. Hindi ipinapakita ng naka-lock na design system ang switch, dahil ang manager nito ang nagpapasya.

Sine-save ng **Download folder** ang folder bilang ZIP para i-host mo saanman mo gusto, at walang nalalathala hanggang gawin mo iyon. Sa terminal, isinusulat ng `lolly system publish --out=<dir>` ang parehong folder. Ang instance na nagse-serve ng mga brand page ay nag-aalok din ng **Publish to** sa address nito, na isang tahasang pagpindot, at dumadaan sa approval chain nito kung meron. Ang managed na design system ay naglalathala lang kapag pinapayagan ng manager nito.

### Connect an agent

Ang **Connect an agent**, sa parehong lugar, ay nagbibigay ng text na ipe-paste at sinasabi kung ano ang kaya ng bawat opsyon:

- **`AGENTS.md`** sa isang project: binabasa ng mga agent ang mga pangalan at rule ng system. Wala itong iginuguhit at hindi nangangailangan ng server.
- **Pampublikong server ng Lolly**: gumuguhit gamit ang Lolly Demo, anumang system ang bukas mo rito. Walang kailangang key.
- **Ang instance mo**: gumuguhit gamit ang mga system na hawak ng instance, at nagbabasa ng service token mula sa environment variable. Ibinibigay ng sheet ang pangalan ng variable at hindi kailanman ipinapakita ang token.

Kapag walang naka-host na server na gumuguhit gamit ang system mo, sinasabi iyon ng sheet.

## Pamahalaan ang mga design system mo

Buksan ang **Settings → Preferences → Design systems** para lumipat, magdagdag o mag-alis ng mga system. Pinipili ng **Open** ang system at binubuksan ito rito; ang **Make a new one** ay gumagawa ng lokal na system at binubuksan ito na handa ang name field nito. Isang system ang aktibo sa isang pagkakataon, para sa buong device. Tinutulungan ka ng [Brand architectures](/info/brand-architectures.html) magpasya kung kailan kailangan ng brand ng sarili nitong design system.

**Kung saan nanggagaling ang system.** Ang system na ibinibigay ng catalogue ng deployment ay nagsasabing **Came with this app**, o **From this instance** sa app na nakakonekta sa isa. Palawakin ang **Catalogue source** para makita kung sino ang nagbibigay nito, ang tokens asset at namespace nito at ang alam na bersyon o checksum nito; kung mabigo ang refresh, may label ang cached na materyal.

**Read-only ang mga managed na system.** Ang system ay nagsasabing **Managed by this instance** (o **Managed by this app** sa desktop app na walang instance) kapag nilo-lock ito ng catalogue nito. Puwede mo itong gamitin at i-download, at ang pagbubukas nito rito ay nagpapakita ng read-only na tala na may **Make an editable copy** at **Switch**, saka ang mga colour role at token nito na walang kontrol sa pag-edit. Nananatiling editable ang sarili mong mga lokal na system, kahit nauna ang managed. Ang build na may isang nakapirming brand ay binubuksan ang Lolly Design System Setup sa *This brand is set*, kasama ang mga token at usage rule ng brand na mababasa.

**Ang bawat ibang ibinigay na system ay sa iyo** na itago, i-edit at i-reset, kasama ang Lolly Demo at Lolly Starter sa lolly.tools. Ang pag-edit ng isa ay nag-iingat ng pangalan nito at minamarkahan ang row na **Edited here**, at ang **Reset to original** sa menu nito ay itinatapon ang mga pagbabagong ginawa sa device na ito. Ang blangkong starter ang eksepsiyon: ang unang pagbabago roon ay nagsisimula ng sarili mong design system, kaya minsang itinatanong ng Lolly kung ano ang itatawag sa bagong system. Ipinapakita ng [Lolly Demo in use](/info/lolly-demo-in-use.html#switch-to-your-own) kung ano ang papalitan ng sarili mong system.

### Pag-alis ng design system

Piliin ang **Remove** mula sa menu ng system; sinasabi ng kumpirmasyon kung aling system ang magiging aktibo pagkatapos. Nananatili ang mga naka-save na session, upload at materyal na ibinahagi sa ibang system.

Ang pag-alis ng ibinigay na system ay nagtatago lang dito: nananatili ang mga catalogue asset nito, ipinapakita itong muli ng **Bring back** at kusa itong bumabalik kung aalisin mo ang lahat ng iba. Ang pag-alis ng na-import o na-edit na kopya ay hindi nag-aalis ng ibinigay na system, ng mga logo o font nito, at kung aktibo ang kopya, ang ibinigay na system ay muling nagiging aktibo. Ang pag-alis ng aktibong hosted na kopya ay nililinis lang ang koneksyon ng kopyang iyon; nananatiling napili ang hiwalay na pinili mong instance.

Gawain ng administrator ang pagbabago sa ibinibigay ng server: binabago ng operator nito ang source catalogue at nagre-redeploy, o nire-review at ina-apply ng Lolly Work administrator ang pagbabago sa server. Lokal ang mga edit dito, maliban sa isa: sa Lolly Work instance na nagbibigay sa iyo ng `brand.edit`, nag-aalok din ang managed na system ng **Edit for** sa instance na iyon, na nagbubukas ng editing copy, at ang **Send to** sa instance na iyon sa **Versions** ay nagpapadala pabalik ng mga kulay, colourway, colour role at address ng brand page nito. Sinasaklaw ng [Mag-edit ng instance mula sa studio](/info/work-design-system-administration.html#edit-this-instance-from-the-studio) kung ano ang puwedeng baguhin ng edit at kung paano isine-serve ng instance ang pagbabago. Tingnan ang [Pag-alis ng design system sa catalogue](/info/configuration.html#removing-a-catalogue-design-system) at [Configuration](/info/configuration.html#supplied-and-local-design-systems).

## Gamitin ang design context sa labas ng app

Sine-save ng **Download design context** ang token document, mga nalutas na kulay, mga idineklarang font family, asset id, source evidence kung may naitala, coverage at tahasang mga rule, na walang font file at walang patunay ng pagmamay-ari. Binabasa ng command line ang file nang walang server: ginagawa ng `lolly system import` na design system ng terminal ang file at sinusuri ng `lolly system check` ang mga input ng Lolly Design laban sa naka-save na context. Sinasaklaw ng [Dalhin ang design system mo](/info/cli.html#bring-your-design-system) ang import at sinasaklaw ng [Aling design system ang ginagamit ng command](/info/cli-decks.html#which-design-system-a-command-uses) ang check, at binabasa ng MCP client ang parehong brief mula sa `lolly://design-context` ([MCP Server](/info/mcp.html)).

## Saan susunod

- **[Using Lolly](/info/using.html)**: ang mga tool, pag-save, pagbabahagi at Assets.
- **[Brand architectures](/info/brand-architectures.html)**: kung paano nagmamapa ang mga division, produkto, endorsed brand, kliyente at season sa mga design system, colourway at logo identity.
- **[Working with partners](/info/partners.html)**: pagbabahagi ng brand mo sa partner, at paggawa sa brand na ibinigay sa iyo.
- **[Brand pages](/info/brand-page.html)**: ilathala ang design system mo sa isang address, bilang press kit at agent kit.
- **[Design Tokens](/info/design-tokens.html)**: ang token model na pinagsusulatan ng brand mo.
- **[Export a file](/info/exporting.html)**: mga print unit, CMYK at ang mga format na pinagre-renderan ng brand mo.
