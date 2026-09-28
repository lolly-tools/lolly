# Ang Brand Studio

Ang **Brand Studio** sa `#/start` ang tanging lugar kung saan mo hinuhubog ang iyong brand - ang mga logo, kulay, type, ang natitira sa iyong tokens at ang mga file na iniingatan nito. I-set ito rito nang isang beses at susundin ito ng bawat tool, page at export *sa mismong pagkakabuo*, hindi sa pamamagitan ng review.

Ang mga pagbabago ay nagpe-preview nang **live sa buong app** habang ginagawa mo ang mga ito, para makita mo ang isang kulay o font na lumalapat kahit saan bago mo ito i-commit. Nasa on-device ang lahat: ang iyong mga brand file at tokens ay hindi kailanman umaalis sa iyong makina (ang pagpili ng Google Font ay kumukuha ng iisang family na iyon mula sa Google, isang beses, matapos ang consent dialog), at ang brand ay naglalakbay sa isang solong [brand pack](#move-a-brand-between-devices) file.

> **Ito ang editor. Ang dashboard ay ang salamin.** Ang **Design system** tab sa Dashboard (`#/d`) ay *ipinapakita* ang iyong brand read-only; *ini-edit* mo ito rito sa `#/start`. Kung gusto mong baguhin ang isang kulay sa ibang pagkakataon, bumalik sa Brand Studio.

## Ang mga silid

Ang studio ay isang set ng **mga silid** na nakalista sa isang rail sa gilid - hindi mga hakbang. Walang binibilang, walang naka-gate sa iba, at ang pagpasok sa alinman sa mga ito ay lehitimo:

- **Overview** - ang hub. Ano ang mayroon ngayon, sa isang sulyap, may pinto papunta sa bawat silid.
- **Colours** - magdagdag ng mga kulay nang isa-isa, mag-assign ng roles o gumawa ng buong palette mula sa isa.
- **Type** - ang apat na face na binabasa ng app, ng iyong mga tools at ng bawat export.
- **Logos** - ang iyong mga marka, sa bawat orientation at treatment.
- **Tokens** - corner radius, spacing, shadows at ang natitira sa system.
- **Files** - ang mga image, audio at motion file na iniingatan ng iyong brand.

Sa telepono, ang parehong listahan ay nagiging horizontal chip strip na naka-pin sa ilalim ng header. Ang paglipat ng silid ay hindi kailanman nagre-reload ng anuman - pinananatili ng editor na naka-mount ang lahat ng panels nito at simpleng ipinapakita ang hiniling mo.

**I-deep-link ang isang silid** gamit ang `#/start?area=<key>`. Ang mga key ay `overview`, `color` *(pansinin ang US spelling sa URL)*, `type`, `logos`, `tokens`, `catalogue` (ang Files room - ang panel key ay isang permanenteng kontrata, kaya ipinapanatili ng URL ang lumang pangalan) at `versions`. Ang `?tab=` ay ang matagal nang alias para sa parehong bagay at gumagana pa rin, kaya patuloy na gumagana ang mga lumang link at bookmark; anumang hindi nakikilala ay nagbubukas sa Overview sa halip na mag-dead-end.

Naka-pin sa **ilalim ng rail** ang mga aksyon na kabilang sa buong design system sa halip na sa isang silid lang:

- **Add from…** - ang source picker, para sa pagpasok ng brand mula sa isang file, PDF, larawan, font o website. Tingnan ang [Bring a brand in](#bring-a-brand-in) sa ibaba.
- **Tray** - ang mga kandidato na nadiskubre ng isang scan pero hindi pa naikokomit. Nananatili itong nakatago hangga't walang aktwal na napanatili ang isang scan, at may bilang ito kapag mayroon; walang binabago sa iyong brand hangga't hindi mo pinindot ang Add sa row na iyon.
- **Export** - isinusulat ang buong design system bilang isang `LollyBrand-….lolly`.
- **Tokens (.json)** - ang plain design-tokens document nang mag-isa, para sa isang repo, build step o ibang tokens tool.
- **Restore brand settings** - bumalik sa isang checkpoint na na-save bago ang isang import o pagpapalit ng mga brand setting.
- **Versions** - i-publish, i-activate at i-restore ang mga pinangalanang kopya ng design system. Nakatago hangga't walang sarili mong ma-publish (o hangga't hiniling ito ng `?area=versions` link sa pangalan).

![Ang studio room rail - Overview, Colours, Type, Logos, Tokens at Files](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Overview

Ang Overview ang unang silid, at may dalawang mukha ito.

Kapag **wala pang napipili**, sinasabi nitong **Make it yours**. Binubuksan ng **Start from a reference** ang source picker para sa isang logo, screenshot, web page o design file. Dumeretso namang nagbubukas ng sarili nilang existing na kontrol ang **Pick a colour**, **Choose a face** at **Add a logo**. Nagsisimula ang bawat ruta sa isang desisyon; walang isinusulat ang pagbukas ng isa. Available agad ang **Explore the tools**.

Sa sandaling may sarili ka nang taglay, ipinapakita ng parehong silid **ang mayroon ka**, na ang mga bilang na ginawa mo ang nangunguna. Binabasa ng Colours ang bilang ng mga kulay na taglay ng design system, at nagdaragdag ng maputlang `· N starter` lang kung may mga inherited na kulay na ipinapakita; ang strip sa tabi nito ay inilalagay muna ang mga kulay na pinili mo, tapos isang hairline, tapos ang mga faded na starter. Binabasa ng Type ayon sa role (*Inter para sa headings*, may *Starter para sa iba pa · SUSE, SUSE Mono* sa ilalim nito). Binabasa ng Logos kung ilang slot ang napunuan, o **Not set**. Dala ng Tokens ang corner radius, naka-tag na *starter* hanggang ilipat mo ito. Sinasabi ng Files na **Nothing yet** habang walang laman ang library. Bawat block ay isang pinto papunta sa silid nito. May mga bilang dito, hindi kailanman progress bar at hindi kailanman finish card - walang inuutang sa studio na ito.

## Logos

Magsimula sa pagbuhos ng iyong folder ng mga marka sa drop zone sa itaas: kinukuha ng **"Drop marks here, or choose several at once"** kasing dami ng files na mayroon ka sa isang pagpasok. Bawat file ay binabasa para sa hugis at tinta nito, tapos pinipila sa ilalim ng **Waiting for a slot** bilang isang chip na nagsasabi ng iniisip nito - *"Looks like the Horizontal primary"*, kasama ang sinukat nito, at isang **Place** button (**Replace**, kung punô na ang slot na iyon). Kapag hindi sigurado, sinasabi ito ng chip nang tuwiran at inaalok ang **Change slot** sa halip, na naglilista ng lahat ng walo. Walang inilalagay hangga't wala kang pinindot.

Dalawang bagay ang nangyayari sa paligid ng pilang iyon. Ang isang marka na may sobrang walang laman na margin ay binibigyan muna ng **trim offer** - sagutin ito o pindutin ang Escape at ang orihinal na file ang ipapasok nang hindi ginalaw. At kapag maaaring pagkalooban ng isang marka ang isang walang laman na kapatid nitong slot, inaalok ng silid ang derived na **mono** o **reverse** na bersyon bilang sarili nitong chip, minarkahang *Generated*, na nawawala ulit kapag napunan mo ang slot na iyon sa ibang paraan.

Sa ilalim niyan ay nakaupo ang grid kung saan napupunta ang bawat marka - **orientation × treatment** slots:

- **Orientations:** Horizontal (wordmark + symbol sa isang hanay) at Vertical (nakatambak, para sa parisukat at matataas na espasyo).
- **Treatments:** Primary, Primary reverse (para sa madidilim na background), Mono (isang kulay) at Mono reverse.

Iyon ay walong opsyonal na slots. I-click ang isang slot para magdagdag ng PNG, SVG, JPEG o WebP; i-click ang punông slot para palitan ito. Bawat slot ay opsyonal at lahat ay nananatili sa device na ito.

![Ang logo matrix - bawat orientation nasa itaas, bawat treatment bilang sariling dashed slot, lahat ay opsyonal](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** - magdagdag ng mga marka na pinangalanan ng iyong brand sa sarili nitong paraan (isang icon, crest, favicon) sa ilalim ng **Custom marks**; pangalanan ito at pumili ng file.
- **More identities** - maaaring magkaroon ang sub-brand, produkto o event ng sarili nitong kumpletong set ng logos. Gamitin ang **+ Add another logo** at pangalanan ito; ang pangunahin mong set ay simpleng "Your logo".
- **Mag-upload ng SVG at babasahin ni Lolly ang mga kulay nito.** Sa bagong install, tahimik nitong itinatakda ang iyong primary colour mula sa logo at sinasabi ito. Sa isang umiiral nang brand, inaalok nito ang kulay bilang suhestyon sa halip - *"Found in the logo: #…"* na may **Use as primary** button sa tabi nito - doon sa Colours room, kung saan mo ito puwedeng tanggapin o alisin.

## Colours

Lumalaki ang silid kasabay ng design system. Walang nasa page na hindi mo pa kailangan, kaya ang unang pagbisita ay isang desisyon lang, at dumarating ang iba pa habang lumalaki ang palette.

### Ang unang kulay

Ang isang design system na wala pang sariling kulay ay nagbubukas sa isang naka-center na column: **Start with one colour**, isang malaking live na chip, isang field, at isang tahimik na linya na nagsasabing dumarating ang roles, shades at print settings habang lumalaki ang system.

- **Ang chip ang picker.** Pindutin ito at bubukas sa chip ang sariling OKLCH card ng studio, na naka-seed sa anumang hawak ng field: isang pangalan, ang wheel, ang apat na dial, alpha at **Stored as**, may **Cancel** at **Add colour** sa ilalim. Ang pag-drag ng isang dial ay pinipinta ang chip at isinusulat ulit ang field habang ginagawa mo ito, at walang naaabot sa design system hangga't hindi mo pinindot ang **Add colour**.
- **Tinatanggap ng field ang anumang notation** - `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` o isang plain na pangalan ng kulay - at ang isang buong *listahan* ng mga kulay ay nagiging isang hanay ng chips na idinaragdag mo nang isa-isa.
- **May dalawa pang pinto sa tabi nito.** Kinukuha ng eyedropper (sa browser na may nito) ang isang kulay mula sa screen, at binabasa ng **From an image** ang isang screenshot o litrato sa device na ito at inaalok ang mga kulay na nahanap nito.
- **Hindi kailanman naka-disable ang Add.** Kapag walang mababasa sa field, binubuksan nito ang picker, na siyang karaniwang ibig sabihin ng isang walang-laman na pindot; ang text na hindi nito ma-parse ay nakakakuha ng linya sa ilalim ng field na nagsasabi nito, sa halip na isang patay na button.

Ang unang kulay ay nagiging **primary**, at sinasabi ito ng chip na sumasagot sa pagdagdag - *"Primary is now Vivid Violet"* - may **Fine-tune** sa tabi nito.

![Ang Colours room na wala pang napipili - isang malaking live na chip, isang field at isang linya tungkol sa darating sa hinaharap](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Starter

Ang **Starter** ang salita para sa anumang dumating kasama ng app sa halip na pinili. Ang isang bagong install ay walang dalang kulay: ang mayroon ito ay isang neutral na ramp, ink-through-paper, kaya nagre-render na ang mga surface, text at hairline bago pa may nagdedesisyon ng kahit ano. Ang mga neutral na iyon ay scaffolding, kaya hindi sila binibilang bilang kulay at hindi sila iginuguhit sa palette pane. Naninirahan sila sa [Tokens](#tokens) room bilang **Neutrals · starter · 9**, may **Open** na nagpapakita sa kanila sa Colours pane bilang isang nakatiklop, naka-tag na grupo (`#/start?area=color&group=neutral`).

Dinadala ang parehong salita sa bawat silid: ang isang role na nakatayo sa isang starter na kulay ay nagbabasa ng *"Starter Paper stands in"* at inaalok ng picker nito ang **Choose…**; ang isang starter na face ay may suot na **Starter** tag at walang tint; ang isang starter na corner radius ay naka-tag sa Overview. Hindi kailanman iginuguhit ang inherited na materyal na may dashed border, dahil ang dashed border dito ay nangangahulugang isang drop target.

### Habang lumalaki ang palette

Nananatili ang mga kulay mo sa tabi ng isang **In context** na preview sa malawak na screen at nagtatambak sa itaas nito sa mas maliliit na screen. Kayang ipakita ng preview ang isang poster, chart o interface card gamit ang palette mo. Nananatili ang mga starter na kulay sa sarili nilang nakatiklop na grupo, hiwalay sa mga kulay na idinagdag mo.

Magdagdag ng mga indibidwal na kulay o isang set ng shades, italaga ang roles ng mga ito, at buksan ang mga advanced na seksyon kapag kailangan mo. Nananatiling kasama ng palette ang colour chart, gradients at ang mga download control.

![Ang Colours room pagkatapos magdagdag ng isang kulay, kasama ang palette nito at isang live na composition preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Roles - ang binabasa ng mga tool

Ang **Roles** ang layer sa ibabaw ng mga swatch - kung aling kulay ang gagampan sa bawat bahagi sa bawat tool at export. Opsyonal ang roles (isang design system na may tatlong maluwag na kulay at walang roles ay isa ring mahusay), maaaring kumuha ng role ang anumang swatch at sinusukat ang contrast readout laban sa surface, unang-una ang APCA.

Nagbabasa ang isang row sa isa sa tatlong register, kaya hindi kailanman inaangkin ng strip ang isang desisyong walang gumawa:

- isang sariling kulay na naglilingkod sa role, sa buong lakas;
- **Starter *Paper* stands in** - muted, may **Choose…** sa picker nito;
- **↳ follows Primary** - nare-resolve ang role sa pamamagitan ng primary sa halip na sa sarili nitong kulay.

Kapag may shades na ang palette, lumalaki ang strip sa lahat ng pitong slot na kayang basahin ng isang tool: Primary, Secondary, Surface, Text, Muted, Edge at On primary. Ang On primary ay hinango mula sa primary, nagbabasa bilang **Derived** at walang dalang picker.

**Ang sariling accent ng app ay isang preference, hindi isang token.** Bilang default, sinusunod ng interface ang design system at kinukuha ng chrome accent ang primary colour. Isa itong Appearance setting sa [profile mo](/info/profile.html) - **Interface follows the design system** - at kapag naka-off ito, nananatiling neutral ang chrome. Hindi naaapektuhan ang mga tool, canvas at export sa magkabilang paraan, at sinusunod ng mga font at ng corner radius ang design system kahit naka-on man o naka-off ang setting.

### Ang mga expert wing

Apat na nakatiklop na seksyon ang nasa ilalim ng composition preview at ng colour roles. Buksan ang gusto mo; bawat isa ay deep-linkable bilang `#/start?area=color&focus=<wing>`, na binubuksan ito anuman ang ipinapakita ng silid sa ibang paraan:

- **Explore shades & harmonies** (`focus=generate`) - isang kulay tungo sa buong set ng shades. Inilalarawan sa ibaba.
- **Shade curves** (`focus=curves`) - hubugin muli ang isang ramp point by point. Ang Lightness, chroma at hue ay bawat isa may sariling curve, pinapalitan gamit ang L / C / H, at nagre-rebake nang live ang mga shades sa ibaba habang hinihila mo.
- **Contrast** (`focus=contrast`) - ang **Contrast-lock** ay nagre-retone ng ramp para maabot ang mga APCA target laban sa background na iyong pinili, bawat hakbang ay pinananatili ang sariling hue at chroma; ibinabaling ng **Rotate hue** ang buong ramp nang buo sa paligid ng gulong, pinananatili ng bawat shade ang sariling lightness at chroma.
- **Print** (`focus=print`) - kung ano ang magiging primary sa press: ang awtomatikong screen value nito, o isang naka-pin na CMYK build o isang pinangalanang spot ink sa halip.

### Isang kulay, buong palette

Sa loob ng **Explore shades & harmonies**, pumili ng **Starting colour**. Nagmumungkahi si Lolly ng magkatugmang shades gamit ang parehong perceptual colour maths (OKLCH) na ginagamit ng engine sa ibang dako. I-tune ang mga suhestyon:

- **Scheme** - Mono, Complement, Analogous o Triad - nagtatakda kung paano nauugnay ang secondary colour sa iyong primary.
- **Shades** - isang slider mula 3 hanggang 20 (default 5) ang kumokontrol kung ilang hakbang ang gagawin ng bawat ramp.
- **Fine-tune** (nakatiklop) - **UI intensity** (Muted / Deep), **Contrast** (Comfort / High) at **Text on brand** (Auto / Light / Dark).

Ang pagbabago ng starting colour at ng mga control ay nagbabago lang ng mga suhestyon. I-click ang isang shade para idagdag ang kulay na iyon, o ang **Add 5 shades** para magdagdag ng isang grupo (sinusunod ng bilang ang Shades setting mo). Nananatili sa lugar ang mga umiiral na kulay at role. Inaalis ng Undo ang pagdagdag.

Ipinapakita ng mga row na **Primary**, **Neutral** at **Secondary** ang mga iminumungkahing shades. Buksan ang **Theme preview** para siyasatin ang mga halimbawang light at dark at ang mga contrast reading ng mga ito. Pumili ng hakbang sa Neutral o Secondary doon para ayusin ang mga iminumungkahing theme anchor. Ang muling pagbuo ng buong palette ay nananatiling hiwalay, sinuring aksyon sa ibaba.

![Tatlong iminumungkahing grupo ng shades, may mga indibidwal na add control at hiwalay na Theme preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Buuin ang palette (harmony generator)

Sa **Find matching colours**, nagmumungkahi ang harmony generator ng magkatugmang accent colours mula sa primary. Pumili ng **Harmony** - **Complementary**, **Adjacent**, **Triad**, **Tetrad** o **Analogous** (na may sariling **Accents** count, 2 hanggang 5, at isang hue **Angle** mula 10° hanggang 45°) - at bawat candidate ay may kasamang auto-generated na human-readable na pangalan at isang **+ Add** button. Kapag idinagdag ang isa, agad itong napupunta sa palette, isang pindot para sa isang token. Ipinapakita ng **In context** ang mga kulay mong idinagdag sa mga sample na composition.

![Mga nabuong accent, bawat isa may swatch, auto-generated na pangalan, hex nito at isang Add button](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Pagkumpirma ng isang nabuong palette

Ang pagdagdag ng isang iminumungkahing kulay o grupo ng shades ay pinananatili ang natitirang bahagi ng palette mo. Para sa kumpletong kapalit, buksan ang **Rebuild the whole palette…** at pindutin ang **Preview full rebuild**. Ipinapaliwanag ng review kung ano ang mga pagbabago: ilang roles ang mananatili gaya ng itinalaga mo, ilang kulay na idinagdag mo mismo ang mapapanatili, ilang shade curve ang muling ia-anchor, ilang print lock ang muling ipipin, ilang nakatagong shade ang mananatiling nakatago, ilang gradient stop ang mananatili sa kulay nila.

Ang **Apply rebuilt palette** sa card na iyon ang kumukumpirma nito; ang **Cancel** ay lalayo at walang binabago. Kapag naisagawa na ito, inaalok ng card ang **Undo** na naka-focus na - at may checkpoint ng buong design system na kinukuha *bago* ang swap, kaya ang "ibalik gaya ng dati" ay isang restore lamang, hindi isang nasayang na hapon.

### Ang palette, ang chart at bawat swatch

Nakalista ng palette ang mga kulay ng design system sa mga nakatiklop na grupo, bawat isa may sariling **+ Add** control. Gumawa at magpalit ng pangalan ng mga grupo para ayusin ang gawa mo. Hindi kailanman gumagawa ng ikalawang tile ang isang role: isang token ay isang tile, at ang isang tile na tinuturo ng isang role ay may suot na maliit na corner mark sa halip (**P**, **S**, **Su**, **T**). Sa ilalim ng mga tile, ang **Colour chart** ay bumubukas sa dalawang view ng parehong mga swatch: ang **Wheel** (ang OKLCH wheel - i-drag ang isang dot para baguhin ang kulay nito, i-click ang isang dot para i-edit ito o i-click ang bakanteng espasyo para maglagay ng bagong swatch) at ang **Gamut** chart, na nagpapakita kung saan talaga nagtatapos ang displayable range. Binubuksan ng `#/start?area=color&focus=chart` ang card nang direkta, gaya ng lagi nang ginagawa ng `?wheel`.

![Ang palette pane, bawat grupo ay maaaring i-fold, may download pill na nakalagay sa ibabang gilid](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Ang OKLCH wheel - ang angle ay hue, ang distansya palabas ay chroma at ang mga grey ay sumasakay sa isang lightness rail sa gilid](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

I-click ang alinmang swatch para buksan ang editor nito:

- **Rename** ito.
- **Set the colour** - ang picker ay nagbubukas sa perceptual **OKLCH** sliders, may mga mode para sa **Hex**, **HSL**, **RGB** at **CMYK**; ang value field ay nagbabasa *at* sumusulat sa kung anumang space ang aktibo, kaya maaari kang mag-paste ng hex o mag-type ng ink percentages. Tandaan na ang paglalagay ng CMYK ay nagtatakda ng *screen* na kulay sa pamamagitan ng conversion - para i-pin ang eksaktong mga ink, gamitin ang print lock sa ibaba.
- **Stored as** - piliin kung paano pinananatili ang swatch: **LCH** (ang default - perceptual, wide-gamut, ang pinakamainam na pagpipilian para sa pag-edit), Hex, RGB o HSL. I-override ito kapag kailangan mong i-pin ang eksaktong legacy hex o itugma ang isang sRGB value.
- **Use as** - ibigay sa swatch na ito ang isa sa mga brand roles nang direkta, nang hindi na bumabalik sa Roles panel. (Ang sariling tile ng isang role ay hindi ito inaalok - hindi maaaring kumuha ng role ang isang role.)
- **Print substitutes** (naka-fold) - i-lock ang print behaviour ng kulay:
  - **CMYK** - lipatin ito mula **Auto** patungong **Locked** para i-override ang automatic na sRGB→CMYK conversion gamit ang eksaktong ink values (C/M/Y/K, 0-100).
  - **Spot colour** - lipatin ito mula **None** patungong **Set** para i-lock ang swatch sa isang spot colour; bigyan ito ng **Name** (hal. `PANTONE 186 C`), opsyonal na **Book** at opsyonal na **Finish** (Ordinary ink bilang default) para sa mga pagkakataong hindi talaga ink ang ginagamit - isang foil, isang emboss o deboss, isang spot varnish, isang soft touch o isang die cut, crease o perforation.
- **In other spaces** (naka-fold) - pinalawak na bersyon ng parehong ideya: bawat row ay isang space na maaaring ma-express ang swatch na ito, alinman ay hango sa canonical value o binuo mo mismo, at ang binuo mo mismo ang mananaig sa export.

Ang mga print lock na ito ang ginagamit ng isang press kapag nag-export ka ng CMYK PDF o TIFF - tingnan ang [Exporting](/info/exporting.html#colour-profiles).

**Ligtas ang pagbura ng isang swatch**: ang mga derived ramp step at theme roles ay *itinatago* lamang (patuloy na nare-resolve ang underlying token, kaya walang masisira sa downstream), samantalang ang mga kulay na idinagdag mo mismo ay talagang aalisin.

### Paggamit ng maraming swatch

Bawat swatch ay may sariling drag handle. I-drag ito para muling ayusin ang mga kulay sa loob ng grupo nito, o i-focus ito, pindutin ang Space, gamitin ang arrow keys, at pindutin ulit ang Space para i-drop. Kinakansela ito ng Escape. Nabubuhay ang pagkakasunod-sunod kahit muling buksan ang studio at puwede itong i-undo. Para ilipat ang mga kulay sa pagitan ng mga grupo, gamitin ang **Group** control ng swatch editor o pumili ng ilang kulay at gamitin ang **Move**. Nananatiling buo ang mga pangalan ng token at role reference.

Ang selection sa palette pane ay isang gesture, hindi isang mode. Walang button na pipindutin muna, at dumarating ang bar kasabay ng unang napiling tile at umaalis kasabay ng huli.

- **Mag-drag sa bakanteng espasyo ng pane** para gumuhit ng rectangle: sumasali sa selection ang bawat tile na nadadaanan nito, kahit lampas sa hangganan ng grupo. Walang idinaragdag ang isang nakatiklop na section, at ang isang drag na hindi kumilos ay nagliligpit sa selection.
- Kinukuha ng **Shift-click** ang range sa reading order; nagto-toggle ang **Cmd/Ctrl-click** ng isang tile; ang plain click ay nagbubukas pa rin ng editor ng tile na iyon.
- Bawat group header ay may **Select all**, at kinukuha ng **Cmd-A** kapag naka-focus ang isang tile ang bawat kulay na taglay ng design system - hindi kailanman ang starter.
- Isang tab stop ang mayroon ang grid. Nilalakad ito ng Arrows, pinapahaba ng Shift-arrows ang selection, tino-toggle ng Space ang isang tile, inaalis ng Delete ang selection at nililinis ito ng Escape. (Ang Arrows ay gumagalaw lang sa focus: para i-nudge ang isang channel, pindutin muna ang `l`, `c` o `h`, gaya ng sinasabi ng readout.)
- Sa touch screen, walang rectangle. Pindutin at i-hold ang isang tile para simulan ang selection, tapos i-tap para magdagdag; dinadala ng per-group **Select all** ang natitira.

Ang bar mismo ay nagbabasa ng **{n} selected**, tapos **Move to** (isang umiiral na grupo, o isang bago na pinangalanan mo sa loob ng menu), **Give a role** (kumukuha ang bawat napiling kulay ng susunod na role paikot, kaya napupunuan ng apat na tile ang lahat ng apat na role sa isang pindot), **Download** (ang selection sa alinman sa anim na palette format), **Copy values** (isang linya kada kulay sa naka-store nitong notation) at **Delete**. Lumalabas ang Move to at Give a role kapag may shades na ang palette na puwedeng ilipat-lipat. Isang Ctrl/Cmd-Z ang nag-a-undo ng buong bulk action - isang paglipat ng apatnapu, isang role walk, isang delete - at sinasabi ng delete kung ano ang naitago nito, dahil may naaabot ang isang selection na mga tile na hindi tinatanggal ng silid na ito.

### Mga Gradient

May opsyonal na **Gradients** panel na bumubuo ng blend token mula sa palette para sa mga background at accent. Laktawan ito nang buo kung hindi gumagamit ng gradient ang design system. Bawat gradient ay may preview, mga named stop (2–8) at isang angle. Ang pangunahing behavior: **ang isang stop ay tumutukoy sa isang swatch**, kaya kapag binago mo ang kulay ng swatch na iyon, susunod ang gradient. Ang interpolation ay tumatakbo sa OKLCH para sa malinis na blend. Burahin ang isang stop para paikliin ang run.

### Dalhin ang palette sa ibang lugar

Ang floating pill na nakalagay sa ibabang gilid ng palette pane ay nagda-download ng buong palette bilang **Design tokens (JSON)**, **CSS variables**, **CSS classes**, **SCSS variables**, isang **GIMP palette (.gpl)** o isang **Adobe Swatch Exchange (.ase)** - para diretso itong makapasok ang design system sa Illustrator, Figma, GIMP o isang stylesheet. Nasa labas ito ng scroller ng pane, kaya nananatili itong nakatayo kahit gaano pa kalayo ang pag-scroll ng palette, at lumalabas ito kapag may shades na ang palette. (Maaari mo ring i-download ang palette mula sa [Mga asset](/info/using.html#assets-your-library).)

## Type

Lumalaki ang silid na ito sa parehong paraan. Kapag wala pang sariling face, ito ay isang card at isang desisyon: **Primary**, nakatakda sa reading size sa face na naglilingkod dito ngayon, isang **Starter** tag sa tabi ng pangalan, isang filled na **Choose a face** at ang linyang *"Nothing installs until you choose one."* Sa ilalim ng card ay nakaupo ang *"Headings, code and italic follow the primary until you choose them"*, may **Choose them separately** na naglalantad sa tatlo pang card para sa natitirang bahagi ng pagbisita.

![Ang Type room na wala pang napiling face - isang card sa reading size, may Starter tag dito, at isang filled na Choose a face](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Pumili ng isang face at bubukas ang silid tungo sa **apat na role card**, ang listahan ng Fonts at ang live specimen. Ang apat na face ay ang mga aktwal na binabasa ng app, ng mga tool at ng bawat export:

- **Primary** - body copy, mga button at bawat tool.
- **Headings** - ang display face para sa `h1`/`h2`.
- **Code** - isang monospace face para sa code at data.
- **Italic** - isang tunay na italic companion para sa emphasis, quotations at asides.

Bumabalik ang headings, code at italic sa primary hanggang italaga mo ang mga ito, kaya ang isang one-face na design system ay walang kailangang desisyon dito.

**Ibig sabihin ng tint, pinili mo ito.** Naka-tint lang ang isang card kung saan mo in-install ang face na iyon. Ang isang starter na face ay may suot na parehong **Starter** tag na suot ng mga inherited na grupo ng palette, sa muted register at walang tint, at ang isang role na walang pumili ay nagbabasa ng **↳ follows Primary** sa halip na ulitin ang pangalan ng primary na para bang napili ito. Sinasabi ng button na **Change** sa isang sarili mong face at **Choose a face** sa lahat ng iba pa. Walang kumukumpirma ng anuman sa card: ang button ay nagbubukas ng **compare stage** na naka-focus sa role na iyon.

![Ang apat na role card na nakalantad - bawat isa naka-set sa face na naglilingkod dito, may Starter tag kung saan walang pumili, at sumusunod ang Italic sa primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Ang compare stage

![Nakabukas ang compare stage sa ilalim ng card nito, may search row, ang mga pinned na family at ang mga card na nakatiklop sa isang one-line strip](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

Bumubukas ang stage **inline sa silid**, hindi sa isang dialog, at direkta sa ilalim ng card na pinindot mo. Habang nakabukas ito, nagtitiklop ang mga card tungo sa isang one-line strip ng role at face, kaya nasa unang screen ang stage kahit sa telepono. Kinakansela ito ng Escape at ibinabalik ang keyboard sa card na pinagmulan mo ng pagbukas.

Ang pagpili ng isang face ay tatlong pindot lang:

1. **Choose a face** sa card.
2. Mag-type ng pangalan ng family at pindutin ang **Preview** - o pindutin ang isa sa anim na **Pinned** na family sa ilalim ng field, isang pindot bawat isa. Lumalabas na ang card na parang loading na, may skeleton bar kung saan malalagay ang specimen sa halip na ang interface face na tumatayo bilang panandaliang kahalili ng isang face na hindi mo pa nakikita.
3. **Use this face**.

**Hinihingi ang consent nang isang beses lang, sa pindot na ginawa mo.** Sa unang pagkakataong may preview na umaabot sa Google Fonts, may dialog na nagsasabi kung ano ang mangyayari: *Nalalaman ng Google ang pangalan ng family at ang IP address mo. Pagkatapos, iniingatan ang file sa device na ito at ginagamit offline. Ito ang tanging hakbang sa studio na umaabot sa isang third party.* Nagpapatuloy ang **Fetch from Google** at naaalala ito. Iniiwan ng **Cancel** ang card na nagsasabing *"Not fetched. Nothing was sent to Google."* na may sarili nitong live na **Fetch from Google**, kaya ang pagbabago ng isip mo ay isang pindot lang sa mismong card. Walang card na nagpapakita ng patay na button: anuman ang estado nito, sinasabi ng iisa nitong primary kung ano ang susunod na hakbang.

**Mag-drop ng font file sa stage** at agad itong nagpe-preview - **TTF**, **OTF** o **WOFF** mula sa sarili mong makina, na siyang daan para sa isang licensed corporate typeface na taglay mo na. Ang drop zone na iyon ang tanging pintuan ng file sa silid.

Alinman sa dalawang paraan, ang face ay mananatili sa device na ito, nagre-render sa app, sa mga tool at sa bawat export, offline magpakailanman at naglalakbay sa design system file - walang kinukuha sa render time. Lahat ng nasa Google Fonts ay ipinapadala sa ilalim ng open licence (OFL/Apache/UFL).

### Fonts on this device

Nililista ng **Fonts** panel ang bawat face na taglay ng device na ito at ang role na pinaglilingkuran nito. Nangunguna ang mga face na idinagdag mo sa ilalim ng **In the design system**, bawat isa may mga role nito at isang delete, at ang naglilingkod sa Primary ay may suot na badge. Sumusunod ang mga starter na face sa isang nakatiklop na row - *Starter · SUSE, SUSE Mono · serving Primary and Code until you choose* - muted, walang delete at walang ipe-promote, dahil wala sa dalawa ang desisyon na ginawa ng kahit sino. Binubuksan ng **Add a face** ang parehong compare stage nang walang focus.

Ipinapakita ng **Type roles** panel sa ibaba ang live specimen ng bawat role - body at UI sa primary, opsyonal na display face para sa mga pinakaitaas na heading, isang italic para sa emphasis, isang mono para sa code at data - may family at estado nito sa tabi ng bawat isa (*Inter*, *SUSE · starter*, *SUSE · follows Primary*), kaya mababasa ang buong set nang sabay-sabay.

## Tokens

Ang natitirang bahagi ng design system, na maaaring i-edit nang hindi humihipo ng code:

![Ang Tokens room - isang corner-radius slider dagdag ang spacing, sizing, shadows at ang natitirang bahagi ng system](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Rounded corners** - isang solong radius slider (0–1.5rem) na sinusunod ng mga card, button at panel sa buong app.
- **Neutrals** - ang ink-through-paper ramp na kalakip ng isang bagong install, nakalista bilang **Neutrals · starter · 9** may siyam na hakbang nito at isang **Open** papunta sa Colours pane. Ito ang tanging lugar kung saan pinapamahalaan ang mga starter neutral, at nawawala ang *starter* tag sa sandaling ma-generate ang ramp sa halip na ma-inherit.
- **More tokens** - magdagdag at mag-edit ng **spacing**, **sizing**, **stroke width**, **opacity**, **rotation**, plain **numbers** at **shadows**. Pumili ng type, bigyan ito ng pangalan (*Gutter, Card shadow…*) at itakda ang value nito. Ang mga ito ay iniimbak bilang standard [design tokens](/info/design-tokens.html) (DTCG) at sumasama sa design system.

## Files

Idrop dito ang mga file na taglay ng brand mo - bukod sa logos: **vector**, **image**, **audio** at **motion** (video, Lottie, animated) assets. Napupunta ang mga ito sa [Mga asset](/info/using.html#assets-your-library), na naka-sort sa mga section at handa na sa asset picker ng bawat tool. Lahat ay nananatili sa device na ito. (Tinatawag ng rail ang silid na **Files**; ang URL key ay nananatiling `catalogue`, dahil ang isang panel key ay isang permanenteng kontrata.)

## Magdala ng isang brand

Ang **Add from...** sa ibaba ng rail ay nagbubukas ng two-stage picker. Ang unang stage ay nagtatanong kung ano ang *taglay* mo, hindi kung anong format ito:

- **Design tokens o isang design file** - DTCG o Tokens Studio JSON, isang Penpot project, isang **zip ng token sets**, isang Lolly design system pack o isang SVG.
- **PDF** - isang deck o isang guidelines file, na binabasa sa device na ito para sa mga kulay, marka at embedded typeface nito.
- **Logo o screenshot** - ang isang larawan ay nagiging iminumungkahing palette, binabasa sa device na ito. Walang ini-upload. Binabasa nito ang mga kulay, hindi ang typeface o layout sa larawan.
- **Naka-save na web page** - pumili ng isang HTML file at ang mga CSS file nito, o mag-paste ng HTML o CSS. Hanggang 20 file at 2 MB sa kabuuan. Ang text na ibinigay lang ang binabasa; hindi kinukuha ang mga naka-link na resource at hindi tumatakbo ang mga script. Gumagana rin ang ruta na ito nang walang extension o desktop app.
- **Font file** - TTF, OTF o WOFF. Binubuksan ang Type room, kung saan nag-i-install ang face.
- **Website** - isang pahina, binabasa para sa kulay at type nito. Lumilitaw lamang ang tile na ito sa isang device na talagang kayang magbasa ng pahina, dahil ang isang disabled na tile na nag-a-advertise ng bagay na walang kayang pindutin ay mas masahol pa kaysa sa walang tile. Kung saan man ito lumitaw, hayagan nitong pinapangalanan ang reader nito: kinukuha ng app sa device na ito, o binabasa sa pamamagitan ng browser extension sa isang background tab, naka-sign in bilang ikaw. Ang pagpapangalan ng URL ay *pina-prefill* lamang ang field - ang fetch button ang siyang pahintulot, kaya ang isang link na ipinadala sa iyo ng iba ay hindi kailanman makakapagsimula ng pagbasa.

Piliin ang design-file source at ang pangalawang stage ay ang card sa ibaba: ang mga tinatanggap na format ay nangunguna bilang icon tiles sa preference order, at ang buong card ay isang drop target - i-click kahit saan dito o mag-drag ng file papunta dito. Maaari ka ring mag-drop ng file nang direkta sa studio.

![Ang import card - ang mga tinatanggap na format ay nangunguna bilang icon tiles, at ang buong card ay isang drop target](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

Ang ibinibigay ng bawat design file:

- isang **Lolly design-system pack** (`.lolly`; tinatanggap pa rin ang legacy na `.zip`) - nag-i-install sa isang hakbang;
- isang **Penpot** export (`.penpot`) - kinukuha ang design tokens nito;
- isang **Design Tokens** file (`.json`) - W3C DTCG;
- isang **Tokens Studio** file (`.json`) - Tokens Studio;
- isang **plain SVG** (`.svg`) - sini-scan ni Lolly ang mga kulay nito at hinahayaan kang pumili kung alin ang itatago, ang una ay magiging primary mo.

Ang isang logo/screenshot, website o naka-save na page ay nagbubukas ng **Your suggested design system**. Tingnan ang isang halimbawa gamit ang mga iminumungkahing kulay, pumili ng ibang **Main colour** kung kailangan, at pangalanan ang system. Inilalapat ng **Use this design system** ang mga na-generate na light at dark na palette at bumabalik sa Overview. Nananatili sa lugar ang mga umiiral na font. Pinapalitan nito ang mga kulay at ibang token setting ng aktibong system. Kailangan munang magtagumpay ang isang checkpoint; ibinabalik ng **Restore brand settings** ang mga naunang setting.

Ipinapakita ng **Source details and individual choices** kung ano ang nabasa, ang mga na-detect na pangalan ng font at ang text/action contrast ng preview. Inaalok din nito ang **Choose individual items in the tray** at **Download design context**. Dala ng JSON report ang mga obserbasyon, iminumungkahing token at impormasyon ng source; may kasamang SHA-256 ng ibinigay na text ang naka-save na HTML/CSS. Walang laman itong raw na page text at hindi ito isang naka-sign na Content Credential. Mga suhestyon lang ang mga pangalan ng font: nananatiling Type ang lugar kung saan pipili at mag-i-install ng mga font.

Nananatili ang mga umiiral na review control ng PDF at ibang design-file import. Walang binabago ang mga item na naka-keep sa **Tray** hangga't hindi idinaragdag sa pamamagitan ng silid na siyang may-ari ng ganoong uri ng materyal.

Binubuksan ng `#/start?source=<kind>` ang picker sa isang partikular na source (`file`, `pdf`, `image`, `font`, `url`, `page`), at binubuksan ng `?import` ito sa plain list.

## Ilipat ang isang brand sa pagitan ng mga device

Sumusulat ang **Export** sa ibaba ng rail ng iisang **`LollyBrand-….lolly`** - ang iyong mga token, font, logo at theme preference, may integrity manifest na ini-verify nito sa pagbalik. Pinangalanan ng mga web release bago ang 1.0.7 ang parehong payload na `.zip`; tinatanggap pa rin ang legacy spelling na iyon. Sa tabi nito, ang **Tokens (.json)** ay sumusulat ng plain design-tokens document nang mag-isa: walang font, walang logo, mga token lang, na siyang aktwal na binabasa ng isang repo, isang CI step o ibang tokens tool.

Ang pagbabalik ng isa ay **Add from... → Design tokens or a design file** (sa itaas), o isang drag-and-drop papunta sa studio. Ito ang paraan kung paano ka bibigyan ng katrabaho ng isang brand, o kung paano mo dadalhin ang isa sa pangalawang install - walang account, walang cloud. Para magdala ng brand mula sa command line sa halip, tingnan ang [`ingest:brand`](/info/configuration.html#brand-packs).

## Ibalik ang mga naunang setting

Piliin ang **Restore brand settings** sa ibaba ng rail, pumili ng checkpoint na may petsa, tapos pindutin ang **Restore**. Ibinabalik nito ang mga kulay, type setting at ibang brand token para sa aktibong brand. Nananatili sa kasalukuyang anyo ang mga font at image file.

Sine-save ni Lolly ang kasalukuyan mong mga setting bilang **Before restore** bago ilapat ang checkpoint. Piliin ang checkpoint na iyon para ibalik ang restore, kahit pagkatapos isara at buksan ulit ang browser. Iniingatan sa device na ito ang pinakahuling 20 checkpoint. Kung hindi mabasa ang storage o hindi mase-save ang kasalukuyang mga setting, iniuulat ng dialog ang problema para masubukan mo ulit.

## Mga Bersyon

Ang **Versions** sa ibaba ng rail ang lugar kung saan huminto na ang isang design system sa pagiging isang lumilipat na target. Mag-publish ng isa at makakakuha ka ng isang **permanente, may-pangalang kopya** na nakatago sa device na ito: hindi na ito magbabago pagkatapos, kaya ang isang tool na nag-pin dito ay lagi nang gagawa ng parehong bagay. Nananatiling nakatago ang panel hanggang sa may isang bagay ng sarili mong ipe-publish, kaya ang isang studio na hindi kailanman nag-publish ay hindi kailanman makikita ang mga kontrol.

Tatlong bagay na dapat malaman bago ka mag-pindot ng anuman, at sinasabi ng panel ang tatlo bago ang pag-pindot sa halip na pagkatapos:

- **Permanente ang isang version.** Wala pang delete ngayon, kaya sinasabi ng panel kung ano ang naitago at na patuloy itong mananatiling naka-imbak sa halip na mag-alok ng isang button na nagsisinungaling.
- **Ang mga tinanggal ang nangunguna sa compatibility card.** Balita ang mga token na idinagdag at binago; ang isang *tinanggal* na token ang siyang sumisira sa isang tool, kaya ito ang unang pinangalanan at tinatawag sa tunay nitong katangian.
- **Hindi na maaaring i-undo ang pag-publish; ang pag-restore ay maaari.** Ang *Restore latest from this version* ay isang ordinaryong edit sa head, kaya napupunta ito sa undo stack ng studio at inaalok agad sa iyo ng panel ang **Undo**.

Puwede kang **Publish only**, o **Publish and make active** - ang pagkakaiba ay kung susundan ng mga tool at ng app ang version na iyon mula ngayon o patuloy na susundan ang iyong pinakahuling edit. **Follow the latest again** ang naglalagay sa bawat edit na live sa sandaling gawin ito. Binubuksan ng `#/start?area=versions` ang panel nang direkta.

## Kapag Nakapirmi ang Brand

May mga build na naglalabas ng **naka-lock na design system**, tulad ng SUSE Brand. Ang pagbukas nito ay nagpapakita ng read-only na tala na may **Make an editable copy** at **Switch**. Nananatiling buo ang orihinal na mga kulay, font at token nito. Nananatiling editable ang sarili mong mga lokal na system, kahit ang naka-lock na system ang naunang nasa device. Sa Profile, pinipili ng **Open** ang isang system at binubuksan ang studio nito; gumagawa ang **Make a new one** ng lokal na system at binubuksan ito sa `#/start` na naka-focus ang name field nito.

## Saan susunod

- **[Paggamit ng Lolly](/info/using.html)** - ang canvas, pag-save, mga proyekto at Mga asset.
- **[Design Tokens](/info/design-tokens.html)** - ang token model kung saan naipahahayag ang iyong brand.
- **[Pag-export at mga format](/info/exporting.html)** - print units, CMYK at ang mga format na ginagawan ng render ng iyong brand.


## Maghanap at magkumpara ng isang look

Buksan ang **Find a look** mula sa Overview o sa listahan ng design-system sa Profile. Mag-browse ng mga system na naka-save sa device na ito at ilang muling-magagamit na halimbawa ng Lolly. Maghanap ayon sa pangalan, colour tag o deklaradong font. Inaayos ng **Closest to my current palette** ayon sa sinukat na pagkakahawig ng kulay, na ang magkatugmang type family ang nagpapasya kung parehas; hindi ito isang quality score.

Pumili ng isang look para suriin ito, o dalawa para ikumpara. Nananatiling available ang review button kahit sa maliit na screen. Walang binabago ang pagpili ng isang look. Nagpapalit ang **Use this saved system** sa pamamagitan ng umiiral na design-system registry. Inilalapat ng **Use these colours** ang isang halimbawa sa pamamagitan ng normal na checkpoint at install flow, pinapanatili ang kasalukuyang mga font. Puwedeng ibalik ng **Restore brand settings** ang naunang look.

Sa ilalim ng **Details and design context**, may editable na **Search tags** ang mga naka-save na system at isang context download. Gumagamit ang mga halimbawa ng orihinal na colour recipe ng Lolly; walang remotely-scraped na inspiration collection o kinakailangang account.

![Ikumpara ang Sunroom at Orchard nang magkatabi bago ilapat ang alinman sa dalawang colour system.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

Pinananatili ng comparison na magkasamang nakikita ang dalawang palette. Walang binabago ang pagsusuri ng isang look hangga't hindi mo pinili ang **Use these colours** o **Use this saved system**.

## Basahin ang source evidence

Ipinapakita ng opsyonal na detalye ng source review ang typography, gaps, padding at corner value kung saan naobserbahan ang mga ito. Iniuulat ng naka-save na HTML/CSS at native na website read ang mga declaration, na maaaring hindi ginagamit ng na-render na page. Kayang iulat ng browser extension ang measured styles mula sa isang bounded sample ng mga nakikitang element, kasama ang viewport at colour preference ng browser nito. Gumagana pa rin ang mas lumang extension gamit ang declared styles. Sinasabi ng mga missing field na **Not observed**.

Mga obserbasyon lang ito, hindi automatic na style setting. Hindi kinukuha o ini-install ang mga font file ng isang reference scan, at hindi tahimik na pinapalitan ng source spacing ang sarili mo. Inilalarawan ng mga bilang ang mga occurrence sa sample, hindi ang confidence o kalidad.

## Suriin ang isang composition laban sa design system

Sa Design, buksan ang **Export**, tapos ang **Before you export**. Gumagamit ang check ng parehong effective na bersyon ng design system na ginagamit ng render. Inikukumpara nito ang mga authored na kulay, token alias, pinili na font at image asset ID. Maaaring sinasadya ang custom na value; ang isang larawan sa labas ng mga deklaradong brand asset ay isang review item, hindi isang ipinagbabawal na larawan.

Kung saan may available na konkretong suhestyon ng kulay o font, binabago ng button nito ang layer na iyon lang. Ibinabalik ng normal na **Undo** ang orihinal na value. Hindi pinapatungan ng isang lumang suhestyon ang mga naka-lock o nabagong layer. Nananatiling hiwalay ang nawawalang source evidence sa isang match. Sinusuri ng mga umiiral na mounted check ang rendered contrast at text layout. Hindi sinusuri ng brand comparison ang mga gradient, effect, nested tool content, rights at subjective quality. Hindi hinaharang ng mga check ang Download.

## Gamitin ang design context nang lokal

Kasama sa **Download design context** ang token document, mga na-resolve na kulay, deklaradong font family, asset ID, source evidence kung saan naitala, coverage at explicit na rules. Hindi kasama rito ang mga font file o patunay ng pagmamay-ari. Kasama rin sa reference review ang mga iminumungkahing token at obserbasyon nito.

Kayang basahin ng CLI ang alinman sa dalawang download nang walang server:

```bash
lolly system import ./lolly-design-context.json
lolly system context --output=design-context.json
lolly system check ./design-inputs.json --file=design-context.json
```

Tinatanggap ng `system check` ang mga input ng Design na may `boxes` array o isang compiled na Design document. Iniuulat nito ang mga iminumungkahing fix nang hindi binabago ang composition. Hindi nito kayang sukatin ang browser layout o rendered contrast. Inilalantad ng umiiral na MCP resource na **lolly://design-context** ang context ng effective na system sa pamamagitan ng na-configure na lokal na MCP process; walang bagong hosted service o API key na kailangan.
