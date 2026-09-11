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
- **Export** - isinusulat ang buong brand bilang isang `LollyBrand-…zip`.
- **Tokens (.json)** - ang plain design-tokens document nang mag-isa, para sa isang repo, build step o ibang tokens tool.
- **Versions** - i-publish, i-activate at i-restore ang mga pinangalanang kopya ng design system. Nakatago hangga't walang sarili mong ma-publish (o hangga't hindi hiniling ng `?area=versions` link ito sa pangalan).

![Ang studio room rail - Overview, Colours, Type, Logos, Tokens at Files](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Overview

Ang Overview ang silid na kinapapasukan mo, at may dalawang mukha ito.

Kapag **wala pang naka-set up**, dalawang pinto ang inaalok nito - **Start from a file** (design tokens, Penpot project, design system pack o SVG) at **Start from scratch** (magdagdag ng isang kulay, tapos magpatuloy kailanman gusto mo) - at isang tahimik na **Explore the tools** exit sa ilalim nila, dahil ang pag-alis ay isa ring lehitimong sagot.

Kapag mayroon nang design system, ipinapakita ng parehong silid **ang mayroon ka**: ang palette at bilang ng mga kulay nito, ang mga type family na ginagamit, ilang logo slots ang napunuan, ilang tokens ang mayroon at ang Files room. Bawat block ay isang pinto papunta sa silid nito. May mga bilang dito, hindi kailanman progress bar at hindi kailanman finish card - walang inuutang sa studio na ito.

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

![The Colours room after one colour - the two panes back, the generate offer, roles reading in three registers and the pane at one colour](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

Ang pinakamayamang silid, sa dalawang pane. Ang kaliwa ay kung saan ka nagtatrabaho; ang kanan ay ang iyong **live palette**. Hilahin ang divider sa pagitan nila para i-resize (ang Enter dito ay tinitiklop ang palette palayo).

![Ang Colours room - isang primary colour na naglalabas ng ramps, mga specimen card na may contrast ratios at isang live palette](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Magdagdag ng kulay, tapos bigyan ito ng trabaho

Ang **Add a colour** ang buong simpleng daan: i-paste o pumili ng kulay sa anumang notation at magiging eksaktong isang token ito. Walang nagmumula rito, walang minumungkahi papasok dito, walang iba pang hinihingi. I-paste ang isang buong *listahan* ng mga kulay at magiging chip ang bawat isa na puwede mong idagdag nang mag-isa.

Ang **Roles** ang layer sa ibabaw - kung aling kulay ang gagampan sa bawat bahagi. Opsyonal ang roles (isang design system na may tatlong maluwag na kulay at walang roles ay isa ring mahusay), maaaring kumuha ng role ang anumang swatch at sinusukat ang contrast readout laban sa surface, unang-una ang APCA.

### Ang mga expert wing

Apat na nakatiklop na seksyon ang nasa ilalim ng dalawang iyon. Buksan ang gusto mo; bawat isa ay deep-linkable bilang `#/start?area=color&focus=<wing>`:

- **Generate a starter palette** (`focus=generate`) - isang kulay tungo sa buong set ng shades. Inilalarawan sa ibaba.
- **Shade curves** (`focus=curves`) - hubugin muli ang isang ramp point by point. Ang Lightness, chroma at hue ay bawat isa may sariling curve, pinapalitan gamit ang L / C / H, at nagre-rebake nang live ang mga shades sa ibaba habang hinihila mo.
- **Contrast** (`focus=contrast`) - ang **Contrast-lock** ay nagre-retone ng ramp para maabot ang mga APCA target laban sa background na iyong pinili, bawat hakbang ay pinananatili ang sariling hue at chroma; ibinabaling ng **Rotate hue** ang buong ramp nang buo sa paligid ng gulong, pinananatili ng bawat shade ang sariling lightness at chroma.
- **Print** (`focus=print`) - kung ano ang magiging primary sa press: ang awtomatikong screen value nito, o isang naka-pin na CMYK build o isang pinangalanang spot ink sa halip.

### Isang kulay, buong palette

Sa loob ng **Generate a starter palette**, pumili ng **Primary colour** at kakalkulahin ni Lolly ang isang kompletong palette - light at dark surfaces, text, accents at kumpletong tint/shade ramps - gamit ang parehong perceptual colour maths (OKLCH) na ginagamit ng engine sa lahat ng dako. I-tune ang derivation:

- **Scheme** - Mono, Complement, Analogous o Triad - nagtatakda kung paano nauugnay ang secondary colour sa iyong primary.
- **Shades** - isang slider mula 3 hanggang 20 (default 5) ang kumokontrol kung ilang hakbang ang gagawin ng bawat ramp.
- **Fine-tune** (nakatiklop) - **UI intensity** (Muted / Deep), **Contrast** (Comfort / High) at **Text on brand** (Auto / Light / Dark).

Walang isinusulat sa iyong brand ang wing na ito. Isa itong preview, live sa buong app para mahusgahan mo ito, hanggang sa pindutin mo ang **Replace palette** (sa ibaba).

Sa ilalim ng primary makikita mo ang live na **Primary / Neutral / Secondary / Blend** ramps at Light at Dark specimen cards, bawat isa ay may sariling contrast readout - ang WCAG ratio na may APCA `Lc` figure sa tabi nito. **I-click ang isang hakbang sa Neutral o Secondary ramp** para i-anchor ang shade na iyon sa halip ng derived default.

![Ang apat na ramp na nakapatong sa itaas ng light at dark specimen cards, bawat card may sariling WCAG contrast ratio](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Buuin ang iyong palette (harmony generator)

Nasa parehong wing pa rin, ang **Build your palette** ay bumubuo ng magkatugmang accent colours mula sa iyong primary. Pumili ng **Harmony** - **Complementary**, **Adjacent**, **Triad**, **Tetrad** o **Analogous** (na may sariling **Accents** count, 2 hanggang 5, at isang hue **Angle** mula 10° hanggang 45°) - at bawat candidate ay may kasamang auto-generated na human-readable na pangalan at isang **+ Add** button. Kapag idinagdag ang isa, agad itong napupunta sa iyong palette, isang pindot para sa isang token. Ang *"Your palette, applied"* ay nagpapakita ng preview ng buong set sa aktwal na mga graphic.

![Mga nabuong accent, bawat isa may swatch, auto-generated na pangalan, hex nito at isang Add button](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Pagkumpirma ng isang nabuong palette

Ang **Replace palette** ang tanging control sa wing na ito na sumusulat ng anuman, at hindi ito basta-basta sumusulat agad. Pindutin ito at may bubukas munang review card, may pamagat na **"Replace the palette?"**, na nakalista kung ano eksaktong mangyayari: ilang roles ang mananatili gaya ng itinalaga mo, ilang kulay na idinagdag mo mismo ang mapapanatili, ilang shade curve ang muling ia-anchor, ilang print lock ang muling ipipin, ilang nakatagong shade ang mananatiling nakatago, ilang gradient stop ang mananatili sa kulay nila.

Ang **Replace palette** sa card na iyon ang siyang kumukumpirma nito; ang **Cancel** ay lalayo at walang binabago. Kapag naisagawa na ito, ang card ay magiging **"Palette replaced."** na may kasamang **Undo** na naka-focus na - at may checkpoint ng buong design system na kinukuha *bago* ang swap, kaya ang "ibalik gaya ng dati" ay isang restore lamang, hindi isang nasayang na hapon.

### Ang palette, ang chart at bawat swatch

Nakalista sa right pane ang bawat kulay na taglay ng iyong brand, naka-grupo (Primary, Neutral, Secondary, Spectrum, Custom, Roles), bawat grupo ay maaaring i-fold, may sariling **+ Add**. Sa ibaba nito, ang **Colour chart** ay bumubukas sa dalawang view ng parehong mga swatch: ang **Wheel** (ang OKLCH wheel - i-drag ang isang dot para baguhin ang kulay nito, i-click ang isang dot para i-edit ito o i-click ang bakanteng espasyo para maglagay ng bagong swatch) at ang **Gamut** chart, na nagpapakita kung saan talaga nagtatapos ang displayable range. Binubuksan ng `#/start?area=color&focus=chart` ang card nang direkta, gaya ng lagi nang ginagawa ng `?wheel`.

![Ang palette pane, bawat grupo ay maaaring i-fold, may download pill na nakalagay sa ibabang gilid](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Ang OKLCH wheel - ang angle ay hue, ang distansya palabas ay chroma at ang mga grey ay sumasakay sa isang lightness rail sa gilid](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

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

### Mga Gradient

May opsyonal na **Gradients** panel na bumubuo ng blend tokens mula sa iyong palette para sa mga background at accent. Laktawan ito nang buo kung hindi gumagamit ng gradient ang brand mo. Bawat gradient ay may preview, mga named stop (2-8) at isang angle. Ang pangunahing behavior: **ang isang stop ay tumutukoy sa isang swatch**, kaya kapag binago mo ang kulay ng swatch na iyon, susunod ang gradient. Ang interpolation ay tumatakbo sa OKLCH para sa malinis na blend. Burahin ang isang stop para paikliin ang run.

### Dalhin ang palette sa ibang lugar

Ang floating pill na nakalagay sa ibabang gilid ng palette pane ay nagda-download ng buong palette bilang **Design tokens (JSON)**, **CSS variables**, **CSS classes**, **SCSS variables**, isang **GIMP palette (.gpl)** o isang **Adobe Swatch Exchange (.ase)** - para diretso itong makapasok ang brand sa Illustrator, Figma, GIMP o isang stylesheet. Nasa labas ito ng scroller ng pane, kaya nananatili itong nakatayo kahit gaano pa kalayo ang pag-scroll ng palette. (Maaari mo ring i-download ang palette mula sa [Catalogue](/info/using.html) view.)

## Type

![The compare stage open under its card, with the search row, the pinned families and the cards folded to a one-line strip](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

Ang silid ay nangunguna sa **apat na role card** - ang apat na face na aktwal na binabasa ng app, ng iyong mga tool at ng bawat export. Ipinapakita ng bawat card kung ano ang naglilingkod sa role na iyon ngayon, nakatakda sa face na iyon, may linya ng aktwal na copy sa ilalim nito:

- **Primary** - body copy, mga button at bawat tool.
- **Headings** - ang display face para sa `h1`/`h2`.
- **Code** - isang monospace face para sa code at data.
- **Italic** - isang tunay na italic companion para sa emphasis, quotations at asides.

Ang headings, code at italic ay bumabalik sa primary hanggang italaga mo sila, kaya ang isang one-font brand ay walang kailangang desisyon dito. Walang kumukumpirma ng anuman sa card: ang **Change** (o **Choose a face** sa isang walang laman na role) ay nagbubukas ng **compare stage** na naka-focus sa role na iyon.

![Ang Type room - ang mga role card at isang live specimen ng bawat face na ginagampanan ang trabaho nito](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

### Ang compare stage

Ang stage ay bumubukas **inline sa silid**, hindi sa isang dialog, kaya nananatili sa screen ang mga card na pinanggalingan mo. Maghanap ng Google Fonts family (Inter, Fraunces, Space Grotesk...) o mag-drop ng font file, pindutin ang **Add to the comparison** at ang mga candidate ay nagtatayuan nang magkatabi sa parehong mga salita bago pa man ma-install ang alinman sa kanila. Kinakansela ng Escape at ibinabalik ang keyboard sa card na pinagmulan mo ng pagbukas.

Iyon ang tanging pintuan papasok, kaya walang makakapasok sa brand mo nang hindi nakikita. Sa ilalim ng stage ay nakaupo ang dalawang management panel:

- **Fonts on this device** - bawat naka-install na family, ang mga role na pinaglilingkuran nito at isang delete. Ang **Add a face** dito ay nagbubukas ng parehong compare stage na walang focus.
- **Your fonts** - mag-upload ng **TTF**, **OTF** o **WOFF** mula sa sarili mong makina. Iyon ang daan para sa isang licensed corporate typeface na taglay mo na.

Alinman sa dalawang paraan, ang face ay mananatili sa device na ito, nagre-render sa app, sa iyong mga tool at sa bawat export, offline magpakailanman at kasama sa iyong brand pack - walang kinukuha sa render time. Lahat ng nasa Google Fonts ay ipinapadala sa ilalim ng open licence (OFL/Apache/UFL).

Ang **Type roles** panel sa ibaba ay nagpapakita ng live specimen ng bawat role - body at UI sa primary, opsyonal na display face para sa mga pinakaitaas na heading, isang italic para sa emphasis, isang mono para sa code at data - para makita mo ang buong set na magkakasamang gumagana.

![Ang Type roles specimen - heading, body, italic at code, bawat isa naka-set sa face na kinakatawan ng role na iyon, may pangalan ng face sa tabi nito](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

## Tokens

Ang natitirang bahagi ng design system, na maaaring i-edit nang hindi humihipo ng code:

![Ang Tokens room - isang corner-radius slider dagdag ang spacing, sizing, shadows at ang natitirang bahagi ng system](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Rounded corners** - isang solong radius slider (0-1.5rem) na sinusunod ng mga card, button at panel sa buong app.
- **More tokens** - magdagdag at mag-edit ng **spacing**, **sizing**, **stroke width**, **opacity**, **rotation**, plain **numbers** at **shadows**. Pumili ng type, bigyan ito ng pangalan (*Gutter, Card shadow...*) at itakda ang value nito. Ang mga ito ay iniimbak bilang standard [design tokens](/info/design-tokens.html) (DTCG) at sumasama sa iyong brand.

## Files

Idrop dito ang mga file na taglay ng brand mo - bukod sa logos - dito: **vector**, **image**, **audio** at **motion** (video, Lottie, animated) assets. Napupunta ang mga ito sa iyong [Catalogue](/info/using.html), na naka-sort sa mga section at handa na sa asset picker ng bawat tool. Lahat ay nananatili sa device na ito. (Tinatawag ng rail ang silid na **Files**; ang URL key ay nananatiling `catalogue`, dahil ang isang panel key ay isang permanenteng kontrata.)

## Magdala ng isang brand

Ang **Add from...** sa ibaba ng rail ay nagbubukas ng two-stage picker. Ang unang stage ay nagtatanong kung ano ang *taglay* mo, hindi kung anong format ito:

- **Design tokens o isang design file** - DTCG o Tokens Studio JSON, isang Penpot project, isang **zip ng token sets**, isang Lolly design system pack o isang SVG.
- **PDF** - isang deck o isang guidelines file, na binabasa sa device na ito para sa mga kulay, marka at embedded typeface nito.
- **Image** - isang screenshot o larawan; binabasa ang mga kulay nito sa device na ito at walang ini-upload.
- **Font file** - TTF, OTF o WOFF. Binubuksan ang Type room, kung saan nag-i-install ang face.
- **Website** - isang pahina, binabasa para sa kulay at type nito. Lumilitaw lamang ang tile na ito sa isang device na talagang kayang magbasa ng pahina, dahil ang isang disabled na tile na nag-a-advertise ng bagay na walang kayang pindutin ay mas masahol pa kaysa sa walang tile. Kung saan man ito lumitaw, hayagan nitong pinapangalanan ang reader nito: kinukuha ng app sa device na ito, o binabasa sa pamamagitan ng browser extension sa isang background tab, naka-sign in bilang ikaw. Ang pagpapangalan ng URL ay *pina-prefill* lamang ang field - ang fetch button ang siyang pahintulot, kaya ang isang link na ipinadala sa iyo ng iba ay hindi kailanman makakapagsimula ng pagbasa.

Piliin ang design-file source at ang pangalawang stage ay ang card sa ibaba: ang mga tinatanggap na format ay nangunguna bilang icon tiles sa preference order, at ang buong card ay isang drop target - i-click kahit saan dito o mag-drag ng file papunta dito. Maaari ka ring mag-drop ng file nang direkta sa studio.

![Ang import card - ang mga tinatanggap na format ay nangunguna bilang icon tiles, at ang buong card ay isang drop target](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

Ang ibinibigay ng bawat design file:

- isang **LollyBrand** pack (`.zip`) - nag-i-install sa isang hakbang;
- isang **Penpot** export (`.penpot`) - kinukuha ang design tokens nito;
- isang **Design Tokens** file (`.json`) - W3C DTCG;
- isang **Tokens Studio** file (`.json`) - Tokens Studio;
- isang **plain SVG** (`.svg`) - sini-scan ni Lolly ang mga kulay nito at hinahayaan kang pumili kung alin ang itatago, ang una ay magiging primary mo.

Ang isang source install ay kumukuha ng **checkpoint muna**, kaya ang "balikan bago mag-import" ay isang restore lamang. At ang natagpuan ng isang scan ay hindi diretsong napupunta sa loob: ang mga candidate ay napupunta sa **Tray**, kung saan bawat isa ay idinaragdag sa pamamagitan ng sarili nitong pindot, sa pamamagitan ng silid na siyang may-ari ng ganoong uri ng materyal.

Binubuksan ng `#/start?source=<kind>` ang picker sa isang partikular na source (`file`, `pdf`, `image`, `font`, `url`), at binubuksan ng `?import` ito sa plain list.

## Ilipat ang isang brand sa pagitan ng mga device

Ang **Export** sa ibaba ng rail ay sumusulat ng iisang **`LollyBrand-...zip`** - ang iyong mga token, font, logo at theme preference, may integrity manifest na ini-verify nito sa pagbalik. Sa tabi nito, ang **Tokens (.json)** ay sumusulat ng plain design-tokens document nang mag-isa: walang font, walang logo, mga token lang, na siyang aktwal na binabasa ng isang repo, isang CI step o ibang tokens tool.

Ang pagbabalik ng isa ay **Add from... → Design tokens or a design file** (sa itaas), o isang drag-and-drop papunta sa studio. Ito ang paraan kung paano ka bibigyan ng katrabaho ng isang brand, o kung paano mo dadalhin ang isa sa pangalawang install - walang account, walang cloud. Para magdala ng brand mula sa command line sa halip, tingnan ang [`ingest:brand`](/info/configuration.html#brand-packs).

## Mga Bersyon

Ang **Versions** sa ibaba ng rail ang lugar kung saan huminto na ang isang design system sa pagiging isang lumilipat na target. Mag-publish ng isa at makakakuha ka ng isang **permanente, may-pangalang kopya** na nakatago sa device na ito: hindi na ito magbabago pagkatapos, kaya ang isang tool na nag-pin dito ay lagi nang gagawa ng parehong bagay. Nananatiling nakatago ang panel hanggang sa may isang bagay ng sarili mong ipe-publish, kaya ang isang studio na hindi kailanman nag-publish ay hindi kailanman makikita ang mga kontrol.

Tatlong bagay na dapat malaman bago ka mag-pindot ng anuman, at sinasabi ng panel ang tatlo bago ang pag-pindot sa halip na pagkatapos:

- **Permanente ang isang version.** Wala pang delete ngayon, kaya sinasabi ng panel kung ano ang naitago at na patuloy itong mananatiling naka-imbak sa halip na mag-alok ng isang button na nagsisinungaling.
- **Ang mga tinanggal ang nangunguna sa compatibility card.** Balita ang mga token na idinagdag at binago; ang isang *tinanggal* na token ang siyang sumisira sa isang tool, kaya ito ang unang pinangalanan at tinatawag sa tunay nitong katangian.
- **Hindi na maaaring i-undo ang pag-publish; ang pag-restore ay maaari.** Ang *Restore latest from this version* ay isang ordinaryong edit sa head, kaya napupunta ito sa undo stack ng studio at inaalok agad sa iyo ng panel ang **Undo**.

Puwede kang **Publish only**, o **Publish and make active** - ang pagkakaiba ay kung susundan ng mga tool at ng app ang version na iyon mula ngayon o patuloy na susundan ang iyong pinakahuling edit. **Follow the latest again** ang naglalagay sa bawat edit na live sa sandaling gawin ito. Binubuksan ng `#/start?area=versions` ang panel nang direkta.

## Kapag Nakapirmi ang Brand

May mga build na naglalabas ng **naka-lock na brand** - ang mga kulay, font at token nito ang ginagamit ng bawat tool at export, at wala nang babaguhin. Sa kasong iyon, papalitan ang studio ng maikling tala na nagpapaliwanag na ang build na ito ay naglalabas ng nakapirming brand at naka-off ang pag-edit. Sinasadya ito: ganito tinitiyak ng isang organisasyon na manatiling on-brand ang lahat.

## Saan susunod

- **[Paggamit ng Lolly](/info/using.html)** - ang canvas, pag-save, mga proyekto at ang catalogue.
- **[Design Tokens](/info/design-tokens.html)** - ang token model kung saan naipahahayag ang iyong brand.
- **[Pag-export at mga format](/info/exporting.html)** - print units, CMYK at ang mga format na ginagawan ng render ng iyong brand.
