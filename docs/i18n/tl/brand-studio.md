# Lolly Design System Setup

<a id="design-system-setup"></a>

**Lolly Design System Setup**, sa `#/start`, ang kinalalagyan ng logo, mga kulay at typeface mo. Ginagamit ang mga ito sa pagguhit ng bawat tool, page at export.

Mag-drop ng logo at babasahin ng Lolly ang mga kulay nito. Pumili ng typeface, o i-drop ang font file na may lisensya ang kompanya mo. Agad na nakikita sa buong app ang bawat pagbabago. Nananatili sa device na ito ang logo, mga font at token mo. Pagpili lang ng Google Font ang kumokonekta sa labas: nagtatanong muna ang Lolly, pagkatapos ay kinukuha ang font family nang isang beses.

Pangalanan ang design system at pindutin ang **Export** para makakuha ng isang `.lolly` file. Itago ang file, buksan ito sa ibang device o ipasa ito sa kasamahan. Ipinapakita ng [Lolly Settings](/info/dashboard.html#design-system) ang aktibong system bilang read-only; naka-link pabalik dito ang cover nito para mag-edit.

<!--i:eti-clock-->
## Gawin itong sa iyo sa loob ng limang minuto

::: timeline
- <!--i:upload--> **I-drop ang logo mo** sa drop zone sa **Logos**. Binabasa ng Lolly ang hugis at mga kulay nito.
- <!--i:palette--> **Use these colours.** Nagiging primary mo ang pangunahing kulay ng logo, at nagiging kulay ng text mo ang isang madilim na neutral mula sa logo.
- <!--i:font--> **Choose a face** sa **Type**: isang Google Font, o font file na pag-aari mo.
- <!--i:pentool--> **Pangalanan ang system.** Gumagawa ang unang edit mo ng sarili mong design system, at minsan lang hinihingi ng Lolly ang pangalan nito.
- <!--i:download--> Isinusulat ng **Export** ang buong system bilang isang `LollyBrand-….lolly` file.
:::

Ipinapakita ng bar sa itaas ng studio ang pangalan ng design system bilang field na mae-edit. Iniingatan ng **Enter** ang bagong pangalan at ibinabalik ng **Escape** ang luma. Kapag nagtanong ang unang edit mo ng **What is this design system called?**, pinupunan ng Lolly ang mga salita mula sa logo mo, kung nakasulat ang mga ito sa logo. Iniingatan ng **Save name** ang pangalan; nagpapanatili ang **Not now** ng placeholder hanggang mag-type ka ng pangalan sa bar. Ginagamit ang pangalan bilang label ng system sa Settings at kapag nagpapalit ka, at ito rin ang pangalan ng file na isinusulat ng **Export**.

<!--i:eti-grid-->
## Ang mga silid

Ang studio ay isang pangkat ng mga silid na walang nakapirming pagkakasunod. Walang silid na naghihintay sa iba. Sa desktop, magkakasama ang mga silid sa isang hanay sa ilalim ng bar. Sa phone, lumilipat ang mga ito sa bar sa ibabang gilid, at ini-scroll papasok sa view ang bukas na silid. Lumilitaw sa itaas ng bar na iyon ang palette sheet at tray, at tumatabi ang bar habang nagta-type ka. Sa keyboard, isang beses dinadaanan ng Tab ang hanay, at inililipat ka ng mga arrow key, Home at End sa pagitan ng mga silid.

![Ang bar ng studio at ang mga silid nito: Board, Colours, Type, Logos, Tokens, Files, Sound, Rules at Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Silid | Ang ginagawa mo roon | Link key |
|---|---|---|
| **Board** | Tingnan ang laman ng system, na may daan papasok sa bawat silid | `overview` |
| **Colours** | Magdagdag ng mga kulay, bigyan ang mga ito ng mga role, bumuo ng mga shade at palette | `color` |
| **Type** | Piliin ang apat na face na binabasa ng app, mga tool at bawat export | `type` |
| **Logos** | Ilagay ang mga marka mo sa bawat oryentasyon at treatment | `logos` |
| **Tokens** | Mga sulok, spacing, anino at bawat ibang pinangalanang value | `tokens` |
| **Files** | Mga larawan, audio at motion file na iniingatan ng brand mo | `catalogue` |
| **Sound** | Hubugin ang sonic identity, musika para sa iba't ibang gamit at ugnayan sa boses | `sound` |
| **Rules** | Mga patakarang ginagamit ng brand mo, na sinusuri sa mga totoong halimbawa | `usage` |
| **Skills** | Mga nakasulat na pamantayan ng brand para sa mga tao at agent, na puwedeng basahin at i-download | `skills` |

Mag-link sa silid gamit ang `#/start?area=<key>`. Permanente ang mga key ng silid, kaya pinapanatili ng Files ang `catalogue`, ng Board ang `overview` at ng Rules ang `usage`. Gumagana pa rin ang `?tab=` bilang mas lumang alias. Binubuksan ng hindi kilalang key ang Board.

Hawak ng **bar** ang mga aksyon para sa buong system. Nagpapasok ng brand ang **Add from…** ([Magpasok ng brand](#bring-a-brand-in)). Hawak ng **Tray** ang mga nahanap ng scan na hindi mo pa naidaragdag. Isinusulat ng **Export** ang system bilang iisang file. Hawak ng **More** ang **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions & publishing**, **Restore brand settings** at **Design systems**, na nagbubukas ng listahan sa Settings kung saan ka nagpapalit ([Itago at ilipat ang design system mo](#keep-and-move-your-design-system)). Lumilitaw ang bawat aksyon kapag mayroon na itong magagawa. Sa phone, lumilipat ang **Add from…** sa **More** at ipinapakita ang **Export** bilang icon nito.

Habang ang design system ay ang kasama sa app, nauuna sa bar ang **Make it yours**, isang menu ng **Find a look**, **Add from…** at **Pick a colour**. Kapag sarili mo na ang system, bumabalik ang **Export** sa puwestong iyon.

<!--i:eti-clipboard-->
## Board

Kapag wala pang napipili, nag-aalok ang Board ng apat na paraan para magsimula. Binubuksan ng **Start from a reference** ang source picker para sa logo, screenshot, web page o design file. Binubuksan ng **Pick a colour**, **Choose a face** at **Add a logo** ang mga kontrol na iyon. Walang isinusulat ang pagbubukas ng alinman sa mga ito. Sa ibaba ng mga ito, nag-aalok ang **Find a look** ng mga handa nang kulay at type na puwedeng subukan, at naroon na ang **Explore the tools** mula pa sa simula.

Kapag may sarili ka nang anuman, ipinapakita ng Board kung ano ang mayroon ka, na nauuna ang mga bilang ng sarili mo. Ibinibigay ng Colours ang bilang ng mga kulay, na may mapusyaw na `· N starter` para sa mga minana. Ipinapakita ng hanay nito ang mga kulay mo, kasunod ang manipis na linya, pagkatapos ang mga kupas na starter colour. Ipinapakita ng Colourways ang bawat colourway bilang maliit na tile sa lead colour nito. Inililista ng Type ang bawat role at itinatakda ang bawat family sa sarili nitong face (*Inter for headings*, na may *Starter for the rest* sa linya sa ibaba). Sinasabi ng Logos kung ilang slot ang may laman (o **Not set**), ipinapakita ng Tokens ang corner radius at sinasabi ng Files ang **Nothing yet** habang walang laman ang library. Binubuksan ng bawat block ang silid nito.

Ipinapakita ng mae-edit na design system na kasama sa app, tulad ng Lolly Demo, ang mga kulay, colourway, face at marka nito sa Board mula pa sa simula, na may tag na **Came with this app** sa tabi ng heading. Sa itaas ng mga ito, nag-aalok ang **Start here** ng **Find a look**, **Add from…** at **Pick a colour**.

### Starter at sa iyo

Sa bawat silid, minamarkahan ng **Starter** ang anumang kasama sa app na walang sinumang pumili. Walang dalang kulay ang bagong install, iisang neutral ramp lang mula tinta hanggang papel, para mai-render ang mga surface, text at manipis na linya bago may pumili.

::: cols
## Starter

- Kasama sa app: mga neutral mula tinta hanggang papel, mga starter face, ang default na corner radius.
- Mapusyaw, may **Starter** tag at walang tint.
- Hindi binibilang bilang mga kulay mo. Nasa **Tokens** ang mga neutral bilang **Neutrals · starter · 9**, at ipinapakita ang mga ito ng **Open** sa Colours bilang isang nakatiklop na grupo (`#/start?area=color&group=neutral`).
- Ang role na gumagamit ng starter colour ay may nakasulat na *"Starter Paper stands in"*, na may **Choose…** sa picker nito.

## Sa iyo

- Pinili o in-install mo.
- Buo ang kulay, at may tint ang card kung saan ka nag-install ng face.
- Binibilang sa Board at sa Tokens.
- Ang role na sumusunod sa iba ay may nakasulat na **↳ follows Primary**.
:::

Walang dashed na border ang minanang materyal. Ang dashed na border ay nangangahulugang puwedeng mag-drop doon.

<!--i:eti-shapes-->
## Mga logo

Tumatanggap ang drop zone sa itaas, **"Drop marks here, or choose several at once"**, ng kahit ilang file ang mayroon ka. Binabasa ng Lolly ang hugis at tinta ng bawat file. Pagkatapos, naghihintay ang file sa ilalim ng **Waiting for a slot** bilang chip na nagsasabi kung ano ang kamukha nito, tulad ng *"Looks like the Horizontal primary"*, kasama ang sukat na ginamit nito at **Place** button (**Replace** kung may laman ang slot). Kapag hindi sigurado ang Lolly, sinasabi ito ng chip at nag-aalok ng **Change slot**, na inililista ang lahat ng walo. Walang inilalagay hangga't hindi ka pumipindot ng button.

Inaalok munang i-trim ang markang may sobrang bakanteng margin. Sagutin ang alok, o pindutin ang Escape para ilagay ang orihinal nang walang pagbabago. Kapag kayang punan ng marka ang kaugnay na bakanteng slot, iniaalok ng silid ang hinangong **mono** o **reverse** na bersyon bilang chip na may markang *Generated*.

Napupunta ang bawat marka sa grid ng walong opsyonal na slot, isa bawat **oryentasyon** at **treatment**:

- **Mga oryentasyon:** Horizontal (magkahanay na wordmark at simbolo) at Vertical (nakasalansan, para sa parisukat at matataas na espasyo).
- **Mga treatment:** Primary, Primary reverse (para sa madidilim na background), Mono (iisang kulay) at Mono reverse.

Naititiklop sa iisang linya ang grupong walang marka; buksan ang grupo para makita ang mga slot nito. Mag-click ng slot para magdagdag ng PNG, SVG, JPEG o WebP, o mag-click ng slot na may laman para palitan ang marka. Tumatanggap din ng na-drop na file ang bakanteng slot. Nasa malalapad na tile ang mga pahalang na marka at nasa mga parisukat ang mga patayo, bawat isa sa surface na ginawan nito, na may bakanteng espasyong isang-kapat ng taas nito. Nananatili sa device na ito ang lahat.

![Ang mga slot ng logo na nakabukas ang Horizontal at Vertical: may sariling slot ang bawat treatment, at opsyonal ang bawat slot](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&system=new-design-system&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails.be-logo-group--fold%3Anot%28.be-logo-group--custom%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- Ang **Custom marks** ay mga markang may sariling tawag ang brand mo, tulad ng icon, sagisag o favicon.
- **Higit pang identity.** Puwedeng magkaroon ng sariling buong set ang isang sub-brand, produkto o event: pindutin ang **+ Add another logo** at pangalanan ang set. Ang pangunahing set mo ay "Your logo". Ipinapakita ng [Mga arkitektura ng brand](/info/brand-architectures.html) kung kailan gagamit ng logo identity.
- **Binabasa ng Lolly ang mga kulay ng logo.** Inililista ng card sa ilalim ng drop zone, at sa itaas ng Colours, ang mga kulay ng logo at itinatanong ang **Which is the main colour?**. Ang pinakamatinding kulay ang napipili, hindi kailanman ang puting background kung saan na-export ang logo. Idinaragdag ng **Use these colours** ang mga ito sa palette mo at ginagawang primary ang pangunahing kulay. Kapag may madilim na neutral ang logo na malinaw sa papel, nagiging kulay ng text ang neutral na iyon. Iniiwan ng **Not now** ang mga ito sa Tray. Sa bagong install, agad na inilalapat ng Lolly ang pinakamalamang na sagot, at nag-aalok ang card ng **Undo** o ibang pangunahing kulay. Nagbibigay ang SVG ng mga eksaktong kulay; nagbibigay ang PNG, JPEG o WebP ng mga kulay na sumasaklaw sa malaking bahagi ng marka.

<!--i:eti-palette-->
## Mga kulay

Lumalago ang silid kasabay ng design system. Isang desisyon ang hinihingi sa unang pagbisita; mas maraming kontrol ang lumilitaw habang lumalago ang palette.

### Ang unang kulay

Ipinapakita ng system na walang sariling mga kulay ang mga neutral ng starter sa sarili nilang bukas na grupo. Sa itaas ng silid ay may field para sa pag-paste at pag-drop na may dashed na border: isang malaking chip at isang field. Mag-drop ng larawan o listahan ng mga kulay saanman sa field, at babasahin ng Lolly ang mga kulay.

- **Ang chip ang picker.** Binubuksan ng **Pick a colour** ang OKLCH card ng studio, na may panimulang value mula sa laman ng field. Unang ipinapakita ng card ang pangalan at hex ng kulay. Nasa ilalim ng **Fine-tune** ang mga colour space, wheel, apat na dial at alpha, at nasa ibaba ang **Cancel** at **Add colour**. Walang napupunta sa system hanggang pindutin mo ang **Add colour**.
- **Tumatanggap ang field ng anumang notation**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` o pangalan ng kulay. Nagiging hanay ng mga chip ang na-paste na listahan na puwedeng idagdag nang paisa-isa o gamit ang **Add all**.
- **Dalawa pang paraan.** Ginagamit ng **Pick a colour from the screen** ang eyedropper kung mayroon ang browser, at binabasa ng **Take colours from an image** ang screenshot o larawan sa device na ito.
- **Hindi kailanman naka-disable ang Add.** Kapag walang laman ang field, binubuksan nito ang picker; kapag hindi nito mabasa ang text, may linyang nagsasabi nito sa ilalim ng field.

Nagiging **primary** ang una mong kulay. Kinukumpirma ng chip ang pagbabago, tulad ng *"Primary is now Vivid Violet"*, kasama ang **Fine-tune** para ayusin ang kulay.


### Habang lumalago ang palette

Nasa tabi ng **In context** preview ang mga kulay mo sa malawak na screen, at nasa itaas ng preview sa mas maliit na screen. Ipinapakita ng preview ang isang poster, chart o interface card gamit ang palette mo. May sariling grupo ang mga starter colour, na naititiklop kapag may sarili nang mga kulay ang system. Nagiging isang maliit na row ang field para sa pag-paste at pag-drop. Walang export sa itaas ng silid; gamitin ang **Export** sa bar o ang Tokens na silid.

![Ang Colours na silid sa Lolly Demo: mga role chip at field para sa pag-paste at pag-drop sa itaas, kasunod ang palette sa mga natitiklop na grupo, bawat kulay ay may pangalan at hex nito](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![Ang Colours na silid sa Lolly Demo matapos magdagdag ng isang kulay: ang Colour roles table, kasunod ang chip ng bagong kulay na nag-aalok ng Use as Lead? at Fine-tune, sa tabi ng live na composition preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Mga role ng kulay: ano ang tawag sa mga kulay

Pinapangalanan ng design system ang mga kulay nito at sinasabi kung para saan ang bawat isa, at parehong binabasa ng Lolly ang mga iyon. Nasa itaas ng Colours na silid ang **Colour roles**. Agad na ipinapakita ng **In context** ang bawat pagbabago.

![Ang Colour roles table sa Wefthouse, isang kathang-isip na brand ng tela, sa sarili nitong mga salita: ang mga colourway chip na Indigo, Madder at Weld, kasunod ang Main, Accent, Supporting at Tertiary, bawat isa ay may light at dark na kulay nito, na binabasa bilang lead colour, partner colour at ayon lang sa pangalan, at ang Background, Text, Quiet text at Hairlines na nakalista sa ilalim ng table bilang mga pagbasa na walang role na pumupuno](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=wefthouse&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

May apat na column ang table. Sa phone, nagiging card ang bawat row na magkatabi ang light at dark:

| Column | Ang laman nito |
|---|---|
| **Role** | Ang sariling salita ng design system, na mae-edit mo mismo sa puwesto nito, at linyang nagsasabi kung para saan ang kulay |
| **Light** at **Dark** | Ang kulay sa itsurang iyon para sa napiling colourway, kasama ang pangalan o value nito at ang contrast nito |
| **Lolly reads this as** | Ang ginagawa ng tool sa role, sa sariling mga salita ng Lolly |

**Paano binabasa ng Lolly ang isang role.** Bawat pagbasa ay para sa isang role. Kapag pinili mo ang pagbasang hawak na ng ibang role, inililipat ang pagbasa sa role na ito. Hindi kailanman humuhugot ng kahulugan ang Lolly mula sa isang salita.

| Pagbasa | Ano ang resulta nito |
|---|---|
| **Lead colour** | Malalaking hugis, mga button, ang pangunahing kulay na ginagamit ng tool |
| **Partner colour** | Ang pangalawang kulay na ginagamit ng tool |
| **Background** | Nasa likod ng lahat ng iba pa |
| **Text** | Mga heading at body text |
| **Quiet text** | Mga caption at maliit na text |
| **Hairlines** | Mga guhit, border at divider |
| **By name only** | Walang tool na kusang pumipili ng role. Iniaalok ito sa bawat colour field at sa Design, kung saan nananatiling naka-link ang pinili, kaya sumusunod ito sa colourway |

Ang pagbasang walang role na pumupuno ay nagpapanatili ng depinisyon ng design system, at inililista ng room ang mga pagbasang iyon sa ilalim ng table. Ang role na kapareho ng sariling id ng isang pagbasa, tulad ng role na tinatawag na Primary, ay ang pagbasang iyon at hindi puwedeng ilipat.

**Sa isang chart.** Ibinibigay ng **Design system - colour roles first** palette ng Lolly Chart sa mga series ang mga colour role ng design system ayon sa sarili nitong pagkakasunod, saka ang natitirang palette nito. Hindi isinasama ang role na binabasa bilang background, text, quiet text o hairlines, dahil iginuguhit ng chart ang background at mga salita nito sa mga kulay na iyon. Walang nagbabago hanggang piliin mo ang palette na iyon. Ang design system na walang colour role ay gumuguhit ng palette bilang **Design system - ordered**.

**Mga value.** Pindutin ang isang value para piliin ang kulay ng role na iyon para sa itsurang iyon at sa napiling colourway. Pinapasunod ng **Same as light** ang dark na value sa light na value hanggang pumili ka ng dark na kulay. Ipinapakita ng **Aa** chip ang text na pinipili ng Lolly para ilagay sa ibabaw ng kulay. Sinasabi ng linya sa ilalim ng value kung gaano kabasa ang text na iyon sa bawat itsura: **Text reads well**, **Large text only** o **Hard to read as text**. Tungkol lang ang rating sa text sa ibabaw ng kulay; puwede pa ring gumana ang kulay para sa mga hugis at malalaking bahagi. Ipinapakita ng role na binabasa ayon lang sa pangalan ang parehong mga salita nang walang kulay ng babala, dahil walang tool na kusang naglalagay ng text sa role na iyon. Ipinapakita ng tooltip at ng picker ang mga numero, APCA muna at WCAG kasunod. Minamarkahan ng **Own text colour** ang value na nakasaad sa file nito ang kulay ng text; nananatili ang kulay ng text na iyon. Minamarkahan ng **Copied** ang value mula sa ibang colourway o sa partner colour na wala pang pumipili; kinukumpirma ng **Keep this colour** sa picker ang value.

**Mga panimulang punto.** Ipinapakita ng design system na walang sariling role ang kasalukuyang mga salita: Primary, Secondary, Surface at Text. Walang isinusulat hanggang baguhin mo ang isa. Nagmumungkahi ang **+ Add a role** ng **Primary, Secondary** o **Main, Accent, Supporting, Tertiary**, o tumatanggap ng anumang salitang ita-type mo, at ipinapakita ang pagbasang makukuha ng bawat isa. Ang unang dalawang salita ang nagiging lead colour at partner colour. Patuloy na iginuguhit ng mga tool ang parehong mga kulay. Sa system na may isang lead colour, kinukuha ng unang colourway ang pangalan ng kulay na iyon.

**Pagpapalit ng pangalan, pag-aayos ng pagkakasunod at pag-alis.** Salita lang ang nagbabago kapag pinalitan ang pangalan; patuloy na gumagana ang lahat ng gumagamit ng role. I-drag ang role gamit ang handle nito, o pindutin ang Space sa handle, gamitin ang mga arrow key at pindutin ang Space para ibaba. Sinasabi ng **Remove** kung ano pa ang gumagamit ng role. Kapag binabasa ng mga tool ang role, iniiwan ng **Remove and keep those colours** ang bawat pagbasa sa kasalukuyang kulay nito. Pinananatili ng patakaran ng organisasyon, guide group, tool field o ibang token na gumagamit ng role ang role hanggang magbago ang paggamit na iyon. Puwede ring gumamit ng role ayon sa pangalan ang isang naka-save na Design document, at hindi iyon nakikita ng Lolly mula sa token file. Iniuulat ng ganoong dokumento na hindi ma-resolve ang kulay.

::: details Mga role sa token file na isinulat nang mano-mano
**File na isinulat nang mano-mano.** Ang mga kulay sa token file na walang role na nagdedeklara ay nakalista sa ilalim ng **In this file, with no role yet**, bawat isa ay may field para sa salita at **Make a role**. Patuloy na gumagana ang mga ito ayon sa pangalan sa alinmang kaso. Hindi puwedeng maging role ang token na may mga digit sa pangalan; nananatili ito sa file at patuloy na gumagana ayon sa path nito. Kung hindi pumasa sa validation ang isang record sa file, ipinapakita ang table nang walang mga kontrol at sinasabi kung bakit.
:::

**Parehong mga salita ang ginagamit sa natitirang bahagi ng room.** Ginagamit ng mga chip, ng **Use as** row ng swatch at ng **Colour roles** group ng palette ang mga salita ng design system. Binubuksan ng tile ng colour role ang value nito. Walang bagong itinatala ang mga na-export na file tungkol sa mga role; nagbabago ang mga kulay ng render dahil nagbago ang mga token.

**Saan napupunta ang mga salita.** Sumasama sa design system ang mga salita at paglalarawan. Binabasa ang mga ito ng mga agent sa design brief, `lolly://tokens` at `AGENTS.md` ng brand page. Ipinapakita ang mga ito ng terminal sa `lolly system status`. Inililista ang mga ito ng brand page sa `brand.json` at sinusukat ang contrast pair para sa bawat role. Pinananatili ng mga DTCG at Tokens Studio file ang lahat, pinananatili ng `DESIGN.md` ang mga salita at pagbasa, at pagkakasunod lang ng brand ang pinananatili ng PowerPoint theme. Nasa [Mga colour role sa ibang format](/info/design-tokens.html#colour-roles-in-other-formats) ang buong listahan. Laging sinisipi ang mga salita bilang data ng design system, hindi kailanman binabasa bilang mga tagubilin.

**Kung saan pumipili ng kulay.** Inililista muna ng bawat colour field sa tool at sa Lolly Design ang mga role ng design system, ayon sa sarili nitong pagkakasunod, kasama ang bawat salita at layunin nito. Pinipili ng **Aa** sa tabi ng role ang kulay na nakapatong sa role na iyon. Sumusunod ang ibang mga kulay sa ilalim ng **Other colours**, hindi kasama ang sariling mga kopya ng colourway, ang mga on-colour at anumang pagbasang pinupuno na ng role. Nananatiling naka-link sa role ang pinili at sumusunod sa colourway. Ipinapakita ng field ang salita sa bawat colourway, at ginagamit din ng Settings at Tokens ang salita. Pinananatili ng design system na walang mga role ang grid nito ng mga swatch.

### Bawat kulay na binabasa ng tool

Kapag nakasara ang **Colour roles**, nauuna sa room ang mga chip para sa mga unang pagpili. Ipinapakita ng bawat chip ang kulay at pangalan ng role. Sa system na walang sariling mga salita, ang mga ito ay **Primary**, **Secondary**, **Surface** at **Text**. Pindutin ang chip para piliin ang kulay nito mula sa mga swatch ng palette. Nasa **Every colour a tool reads**, sa ibaba ng **Colour roles**, ang buong strip.

Ipinapakita ng strip ang pitong kulay na puwedeng basahin ng tool: Primary, Secondary, Surface, Text, Muted, Edge at On primary, gamit ang sariling mga salita ng design system kung mayroon ito. Pareho ang ginagampanan ng bawat isa sa bawat tool at export. Walang kailangang itakda, at anumang kulay ay puwedeng pumuno sa isa. Sapat na ang tatlong magkakahiwalay na kulay para sa isang maayos na system. Sinasabi ng readout kung gaano kabasa ang text sa ibabaw ng surface, APCA muna. Ipinapakita ng bawat row ang sarili mong kulay nang buong tindi, ang panimulang kulay na pumapalit o **↳ follows Primary**.

Hinango ang On primary mula sa primary, may label na **Derived** at walang picker. Ang **Light** at **Dark** switch sa tabi ng On primary, at ang nasa tabi ng **In context**, ang pumipili kung aling itsura ang ipinapakita ng strip, palette at preview.

Sumusunod sa design system ang sariling accent ng app bilang default, sa pamamagitan ng setting na **Interface follows the design system** sa **Settings → Appearance**. Kapag naka-off ang setting, nananatiling neutral ang chrome ng app. Sumusunod sa design system ang mga tool, canvas at export sa alinmang kaso.

**Mga colourway.** Puwedeng maglaman ang design system ng ilang lead colour, na pinipili para sa bawat piraso. Ipinapakita ng **Colourways** row sa itaas ng **Colour roles** ang isang chip bawat colourway, na may **Default** sa canonical na colourway. Nagsisimula ang **+ Add** ng bagong colourway mula sa isang kulay sa palette. Pumili ng chip, at ipinapakita ng table, strip, palette at mga preview ang colourway na iyon. Puwede mong palitan ang pangalan, i-duplicate, alisin o gawing default ang napiling colourway. Sa system na may mga colourway, kailangan ng bawat colourway ang sarili nitong primary at secondary, at sarili nitong surface kapag kinukulayan ng mga colourway ang background. Nananatiling nakatakda ang mga role na iyon sa swatch editor. Nasa [Magdagdag ng mga colourway sa design system](/info/colourways.html#add-colourways-to-a-design-system) ang mga hakbang at token format, at ipinapakita ng [Paggamit ng Lolly Demo](/info/lolly-demo-in-use.html#colourways-on-real-work) ang mga colourway sa totoong gawa. Puwedeng pumili ang bawat tao ng sariling colourway sa **Settings → Appearance** ([Gawing sarili mo ang isang colourway](/info/colourways.html#make-a-colourway-your-own)).

### Maghanap pa ng mga kulay

Tatlong tool ang bumubuo mula sa primary mo. Nagmumungkahi lang ang unang dalawa; pinapalitan ng pangatlo ang palette.

::: cols
## Tuklasin ang mga shade & harmony

Pumili ng **Starting colour**, **Scheme** (Mono, Complement, Analogous o Triad) at kung ilang **Shades** (3 hanggang 20, default ay 5). Itinatakda ng **Fine-tune** ang tindi ng UI, contrast at text sa ibabaw ng kulay ng brand. Mag-click ng shade para idagdag ito, o **Add 5 shades** para sa isang grupo. Nananatili ang mga kulay at role mo.

## Maghanap ng magkakatugmang kulay

Pumili ng **Harmony**: Complementary, Adjacent, Triad, Tetrad o Analogous (na may **Accents** mula 2 hanggang 5 at **Angle** mula 10° hanggang 45°). Bawat kandidato ay may nabuong pangalan at **+ Add**, isang pindot bawat kulay.

## Buuin muli ang buong palette

Pinapalitan ang palette mula sa isang panimulang kulay, matapos suriin kung ano ang magbabago at mananatili.
:::

Pare-parehong ginagamit ng tatlo ang matematika ng kulay batay sa pagtingin (OKLCH) na ginagamit ng engine. Sa **Explore shades & harmonies**, ipinapakita ng mga row na **Primary**, **Neutral** at **Secondary** ang mga iminungkahing shade, at ipinapakita ng **Theme preview** ang mga halimbawa sa light at dark kasama ang mga sukat ng contrast ng mga ito.

![Tatlong grupo ng iminungkahing shade, na may mga kontrol para magdagdag nang paisa-isa at hiwalay na Theme preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Mga nabuong accent, bawat isa ay may swatch, awtomatikong nabuong pangalan, hex nito at Add button](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Paglalapat ng nabuong palette

Buksan ang **Rebuild the whole palette…** at pindutin ang **Preview full rebuild**. Binibilang ng pagsusuri kung ilang role ang nananatili ayon sa itinalaga mo, ilang sarili mong kulay ang pinananatili at ilang shade curve, print lock, nakatagong shade at gradient stop ang muling itinatali sa batayang kulay o pinananatili. Inilalapat ng **Apply rebuilt palette** ang pagbabago; walang binabago ang **Cancel**. Pagkatapos, iniaalok ng card ang **Undo**, na naka-focus na, at ibinabalik ng checkpoint na kinuha bago ang pagpapalit ang buong system.

Pinananatili ng system na may mga colourway ang bawat colourway kapag muling binuo. Sumusunod ang canonical na colourway sa bagong panimulang kulay, at pinananatili ng lahat ng ibang colourway ang sariling mga kulay, pangalan, pagkakasunod at setting. Inililista ng pagsusuri kung aling colourway ang sumusunod at alin ang nagpapanatili ng mga kulay nito. Hindi muling binubuo ng Lolly ang system na naka-encode ang mga colourway sa paraang hindi nito mae-edit; sinasabi ng card kung bakit, at walang nagbabago.

### Ang mga seksyon para sa eksperto

Nasa ilalim ng preview at mga role ang apat na nakatiklop na seksyon. Nabubuksan ang bawat isa gamit ang `#/start?area=color&focus=<name>`:

- **Explore shades & harmonies** (`focus=generate`).
- Binabago ng **Shade curves** (`focus=curves`) ang hugis ng ramp punto por punto, na may magkakahiwalay na curve para sa lightness, chroma at hue (L / C / H) at muling iginuguhit ang mga shade habang nagda-drag ka.
- **Contrast** (`focus=contrast`): binabago ng **Contrast-lock** ang tono ng ramp para maabot ang mga target na APCA sa background na pinili mo, at iniikot ng **Rotate hue** ang buong ramp sa wheel.
- Itinatakda ng **Print** (`focus=print`) kung ano ang magiging primary sa press: ang awtomatikong value nito, naka-pin na CMYK build o pinangalanang spot ink.

### Ang palette at bawat swatch

Inililista ng palette ang mga kulay mo sa mga grupong natitiklop, bawat isa ay may sariling **+ Add**. Puwede kang gumawa ng mga grupo at palitan ang pangalan ng mga ito. Hindi kailanman gumagawa ng pangalawang tile ang role; ipinapakita ng tile na tinutukoy ng role ang pangalan ng role, tulad ng **Primary**. Ipinapakita ng **Colour chart** sa ilalim ng mga tile ang parehong mga kulay sa OKLCH **Wheel** (i-drag ang tuldok para baguhin ang kulay, i-click ang bakanteng espasyo para magdagdag ng swatch) at sa **Gamut** chart, na nagpapakita kung saan nagtatapos ang saklaw na kayang ipakita. Binubuksan ng `#/start?area=color&focus=chart` ang chart.

![Ang palette pane, na natitiklop ang bawat grupo](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Ang OKLCH wheel - hue ang anggulo, chroma ang layo palabas at ang mga kulay abo ay nasa lightness rail sa gilid](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

I-click ang swatch para buksan ang editor nito:

- **Rename** para palitan ang pangalan ng swatch.
- **Set the colour** gamit ang mga OKLCH slider, o sa **Hex**, **HSL**, **RGB** o **CMYK**. Nagbabasa at nagsusulat ang value field sa aktibong colour space. Itinatakda ng CMYK dito ang kulay sa screen sa pamamagitan ng conversion; para i-pin ang eksaktong mga tinta, gamitin ang **Print substitutes**.
- Pinipili ng **Stored as** kung paano ise-save ang swatch: **LCH** (ang default, batay sa pagtingin at may malawak na gamut), Hex, RGB o HSL.
- Binibigyan ng **Use as** ng role ang swatch, gamit ang sariling mga salita ng design system kung mayroon ito. Pindutin muli ang naka-highlight na role para alisin ang role.
- **Print substitutes** (nakatiklop): i-lock ang **CMYK** mula **Auto** patungo sa eksaktong mga value ng tinta, o magtakda ng **Spot colour** na may **Name** (tulad ng `PANTONE 186 C`), opsyonal na **Book** at **Finish** para sa foil, emboss, deboss, spot varnish, soft touch o die cut, crease o perforation. Ginagamit ng press ang mga lock na ito kapag nag-export ka ng CMYK PDF o TIFF; tingnan ang [Mga colour profile](/info/exporting.html#colour-profiles). Nai-print ang spot ink sa sarili nitong plate sa Print PDF; para i-print ang bawat spot ink bilang process sa isang export, tingnan ang [Mga spot ink bilang process](/info/exporting.html#spot-inks-as-process).
- **In other spaces** (nakatiklop): isang value bawat colour space, hinango o isinulat mo, at ang isinulat mo ang sinusunod sa export.

**Ang pagtanggal ng swatch** ay ligtas. Itinatago ang mga hinangong shade at theme role, kaya walang nasisira sa anumang nagbabasa ng mga ito. Inaalis ang mga kulay na idinagdag mo.

::: details Paggamit ng maraming swatch
Kapag walang ginagawa, ipinapakita ng swatch ang kulay, pangalan at hex nito. Ipinapakita ng Select ang checkbox at drag handle ng bawat swatch sa anumang screen, at ipinapakita rin ng tile na may keyboard focus ang handle nito. I-drag ang handle para baguhin ang pagkakasunod sa loob ng grupo, o i-focus ang handle, pindutin ang Space, gamitin ang mga arrow key at pindutin muli ang Space para ibaba; kinakansela ng Escape. Sa phone, nagpapakita ang palette ng apat na kulay bawat row. Para ilipat ang mga kulay sa ibang grupo, gamitin ang **Group** control ng editor o pumili ng ilan at gamitin ang **Move to**.

Hindi kailangan ng hiwalay na switch para sa seleksyon: lumalabas ang bar at mga checkbox sa unang napiling tile at nawawala kapag wala nang napili.

- **Mag-drag sa bakanteng espasyo** para gumuhit ng parihaba; sumasama sa seleksyon ang bawat tile na nasasagi nito, kahit sa iba't ibang grupo. Walang idinaragdag ang nakatiklop na seksyon.
- Pumipili ang **Shift-click** ng magkakasunod na tile ayon sa pagkakasunod ng pagbasa, ino-on o ino-off ng **Cmd/Ctrl-click** ang isang tile, at binubuksan ng karaniwang click ang editor.
- May **Select all** ang bawat header ng grupo, at pinipili ng **Cmd-A** habang naka-focus ang tile ang bawat kulay na pag-aari mo, hindi kailanman ang panimulang kulay.
- May isang tab stop ang grid: gumagalaw ang mga arrow, pinapalawak ng Shift-arrows ang seleksyon, ino-on o ino-off ng Space ang tile, nag-aalis ang Delete at nililinis ng Escape ang seleksyon. Para bahagyang baguhin ang isang channel, pindutin muna ang `l`, `c` o `h`.
- Sa touch screen, pindutin nang matagal ang tile para magsimula ng seleksyon, saka mag-tap para magdagdag.

Ipinapakita ng bar ang **{n} selected**, saka **Move to**, **Give a role** (kinukuha ng bawat kulay ang susunod na role ayon sa pagkakasunod), **Download** (ang seleksyon sa alinman sa anim na palette format), **Duplicate** (isang kopya ng bawat isa, nakalagay pagkatapos ng orihinal), **Copy values** at **Delete**. Bumubukas ang isang kopya sa editor; nananatiling napili ang maraming kopya. Binabawi ng isang Cmd/Ctrl-Z ang maramihang aksyon.
:::

### Mga gradient

Bumubuo ang opsyonal na **Gradients** panel ng mga blend token mula sa palette. May preview, 2 hanggang 8 pinangalanang stop at anggulo ang bawat gradient. Tumutukoy ang stop sa isang swatch, kaya baguhin ang kulay ng swatch at susunod ang gradient. Gumagana ang mga blend sa OKLCH.

Nasa itaas ng palette ang mga download nito (design tokens, CSS, SCSS, GIMP at Adobe Swatch Exchange). Inilalarawan ng [Dalhin ang palette at mga font mo kahit saan](/info/using.html#take-your-palette-and-fonts-anywhere) ang bawat format.

<!--i:eti-type-->
## Type

Kapag walang sariling face, isang card ang ipinapakita ng room: **Primary**, nakatakda sa laki na pambasa gamit ang kasalukuyang face nito, na may tag na **Starter**, button na **Choose for Primary** at linyang *"Walang mai-install hanggang pumili ka ng isa."* Sumusunod sa primary ang mga heading, code at italic hanggang piliin mo ang mga ito; ipinapakita ng **Choose them separately** ang mga card ng mga ito.

![Ang Type room na wala pang napiling face - isang card sa laki na pambasa, may Starter tag at isang filled na Choose for Primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Pumili ng isang face at magbubukas ang room sa apat na role card, listahan ng Fonts at live na specimen:

- **Primary**: body copy, mga button at bawat tool.
- **Headings**: ang display face para sa `h1` at `h2`.
- **Code**: isang monospace face para sa code at data.
- **Italic**: isang tunay na italic para sa pagdidiin, mga sipi at dagdag na pahayag.

May tint lang ang card kung na-install mo ang face na iyon. Ipinapakita ng button nito ang role: **Change Headings** sa sarili mong face at **Choose for Headings** sa lahat ng iba pa. Nagre-rewrap ang halimbawang linya. Walang nasa card na naglalapat ng pagbabago; binubuksan ng button ang compare stage para sa role na iyon.

![Ang apat na role card na ipinakita - bawat isa ay nakatakda sa face na ginagamit nito, may Starter tag kung wala pang pumili at ang Italic ay sumusunod sa primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Ang compare stage

Bumubukas ang stage sa ilalim ng card na pinindot mo. Nakatiklop ang mga card bilang strip na may isang linya para makita ang stage sa unang screen ng phone. Kinakansela ng Escape at ibinabalik ang focus sa card.

1. Pindutin ang **Choose for** at ang role sa card.
2. Mag-type ng pangalan ng font family at pindutin ang **Preview**, o pindutin ang isa sa anim na **Pinned** family sa ilalim ng field.
3. Pindutin ang **Use this face**.

![Ang compare stage na nakabukas sa ilalim ng card nito, kasama ang search row, mga naka-pin na family at mga card na nakatiklop bilang strip na may isang linya](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**Isang beses lang hinihingi ang pahintulot.** Sa unang pagkakataong kumonekta ang preview sa Google Fonts, ipinapaliwanag ng dialog: *Nalalaman ng Google ang pangalan ng font family at ang IP address mo. Pagkatapos, iniingatan ang file sa device na ito at ginagamit offline. Ito lang ang hakbang sa studio na kumokonekta sa third party.* Nagpapatuloy ang **Fetch from Google** at tinatandaan ang pahintulot. Iniiwan ng **Cancel** ang card na nagsasabing *"Hindi kinuha. Walang ipinadala sa Google."*, na may sarili nitong **Fetch from Google**.

**Mag-drop ng font file sa stage** (TTF, OTF o WOFF) para i-preview ang lisensyadong typeface na pag-aari mo. Sa alinmang paraan, nananatili ang face sa device na ito, nagre-render offline sa app, mga tool at bawat export, at sumasama sa design system file. Lahat ng nasa Google Fonts ay ipinapamahagi sa ilalim ng bukas na lisensya (OFL, Apache o UFL).

### Mga font sa device na ito

Inililista ng **Fonts** panel ang bawat face sa device na ito at ang role na ginagampanan nito. Nauuna ang mga face na idinagdag mo, sa ilalim ng **In the design system**, bawat isa ay may mga role nito at pang-delete. Sumusunod ang mga panimulang face sa isang nakatiklop na row na hindi matingkad. Binubuksan ng **Add a face** ang compare stage para sa anumang role. Ipinapakita ng **Type roles** panel ang live na specimen ng bawat role kasama ang family at estado nito, tulad ng *Inter* o *Inter · follows Primary*.

<!--i:eti-tag-->
## Mga token

Ang mga token ang mga pinangalanang value sa likod ng design system: mga kulay, typeface, logo, sulok at spacing. Binabasa ang mga ito ng mga tool ayon sa pangalan, kaya umaabot agad sa bawat tool ang pagbabago rito.

![Ang Tokens room: ang itaas na may halimbawa mula sa system at mga aksyon sa file, mga tile na bumibilang sa bawat uri ng token, saka ang mga pares ng kulay kasama ang mga readout ng contrast ng mga ito](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- Nagbibigay ang **itaas na bahagi** ng halimbawa mula sa sarili mong system (*Ang Primary ay Spearmint, #033633*) at mga aksyon sa file: **Download** (ang system bilang mga design token, o ang palette sa limang ibang format), **Copy CSS** at **Add from…** para basahin pabalik ang JSON file.
- Binibilang ng mga **tile** ang bawat uri ng token at dinadala ka sa seksyon nito: Colours, Type, Logos, Shape and spacing, More at All tokens. May tag na **Starter** ang seksyong naglalaman lang ng kasama ng blankong starter; binibilang ng system na kasama ng app ang sarili nitong materyal nang walang tag. Sa phone, nakaayos ang mga tile sa dalawang row na tig-tatlo.
- Nagsisimula ang **Colours** sa mga pares na pinagsasama ng mga tool (text sa surface, sa primary, muted sa surface) na may APCA readout sa light at dark, at minamarkahan ng **Weak contrast** kapag kulang ang contrast ng pares. Kasunod ang bawat grupo ng kulay: ang ramp bilang isang row ng mga chip, ang ibang kulay kasama ang value ng mga ito at ang reference na ginagamit ng mga tool, tulad ng `{color.brand.spearmint}`. Pindutin ang reference para kopyahin ito. Binubuksan ng **Edit in Colours** ang grupo sa Colours room. Sa design system na may [mga colour role](#colour-roles-what-the-colours-are-called), nauuna ang **Colour roles**, na may bawat role nang isang beses gamit ang sariling mga salita at pagkakasunod ng system. May kulay ang role para sa bawat colourway at itsura. Nakalista ang mga kulay na iyon kasama ng role, hindi bilang magkakahiwalay na kulay; baguhin ang mga ito sa Colour roles table.
- Inililista ng **Type** at **Logos** ang face para sa bawat role at bawat logo slot, na may **Edit in Type** at **Edit in Logos** kapag mayroon ka nang sarili.
- Hawak ng **Shape and spacing** ang **Rounded corners** (`shape.radius`) at **Spacing rhythm** (`space.base`). Bawat isa ay may label na *Lolly default* hanggang galawin mo ang slider at *Yours* pagkatapos, nase-save agad at puwedeng bawiin.
- Nagdaragdag ang **More tokens** ng spacing, sizing, lapad ng stroke, opacity, rotation, mga simpleng numero at anino, na nakaimbak bilang karaniwang [mga design token](/info/design-tokens.html).
- Inililista ng **App appearance (advanced)** ang mga kulay, laki at anino na ginagamit ng sariling mga screen ng Lolly, at hinahanap at ine-edit ng **Inspect every token (advanced)** ang anumang nakaimbak na value at ipinapakita muna ang bawat pagbabago para masuri. Doon, nakalista kasama ng role ang mga value ng colour role sa bawat colourway: piliin ang token ng role para makita ang isang row bawat colourway, magkatabi ang light at dark. Sinasabi ng linya ng bilang kung ilang value ang hawak ng mga role. Parehong listahan ang ipinapakita ng read-only na design system.

Nag-aalok ang bakanteng seksyon ng **Pick a colour**, **Choose a face** o **Add a logo**.

<!--i:eti-images-->
## Mga file

I-drop ang mga file na iniingatan ng brand mo, bukod sa mga logo: mga **vector**, **image**, **audio** at **motion** file (video, Lottie at mga animation). Lumalabas ang mga ito sa [Assets](/info/using.html#assets-your-library), nakaayos sa mga seksyon, at sa asset picker ng bawat tool. Nananatili ang mga ito sa device na ito.

## Tunog

**Sound** ang pinipili mo sa pamamagitan ng pakikinig. Bumubukas ang room sa tatlong panimulang tunog, **Calm**, **Steady** at **Bright**, bawat isa ay card na nasa mga kulay ng genre nito at may play button. I-play ang isa para marinig ang maikling bahagi; humihinto ang una kapag nagsimula ka ng iba. Ginagawa ng **Choose** ang tunog na iyon bilang tunog ng bawat gamit. Binibigyan ng ikaapat na card, **Mixed**, ang bawat gamit ng sariling tunog: Calm para sa Explain, Steady para sa Demonstrate at Bright para sa Play. Pinapatugtog ng play button nito ang tatlo nang sunod-sunod. Walang nase-save hanggang piliin mo ang **Save sound**. Pagkatapos, nagiging bahagi ng design system na ito ang tunog, na may checkpoint sa parehong history na ginagamit ng ibang room. Patuloy na gumagana gaya ng dati ang design system na walang tunog.

Ang gamit ay isang pagkakataong pinatutugtog ang tunog: **Explain**, **Demonstrate** at **Play** sa simula. Bawat gamit ay chip na may sariling play button. Itinatakda ng **Music** o **With narration** sa itaas ng mga chip kung musika lang ang patutugtugin ng chip o may kasabay na boses. Ipinapakita ng gamit na pinili mo ang layunin at musika nito sa simpleng mga salita, halimbawa "Mainit · 84 bpm · Rhodes, tuloy-tuloy na bass, kit na may lumang tunog". Kinukuha ng bawat gamit ang genre, tempo at mga instrumento ng napiling tunog (o ang sarili nito kapag Mixed). Pinananatili ng bawat gamit ang sariling himig at balanse: hindi sinasapawan ng melody ng Explain ang boses, at pinangungunahan ng melody ang Play. Pinananatili ang dalawa kapag nagpapalipat-lipat sa Mixed at iisang tunog. Pinananatili ng gamit na idinagdag mo mismo ang tunog nito sa ilalim ng Mixed. Itinatala ng design system kung alin ang pinili mo. Nagdaragdag ng isa ang **Add a use** at pinapayagan kang i-type doon ang pangalan nito. Pinipili ng **Make main** ang gamit na pinatutugtog kapag walang ibang hinihingi. Pinatutugtog ng **Another tune** ang bagong komposisyon na may parehong mga setting.

**Edit in the music generator** ang nagbubukas ng [music generator](/info/generated-music.html#the-music-generator) sa mga setting ng gamit na iyon, na may linya sa itaas na nagsasabi kung kaninong tunog ang ine-edit mo. Ibinabalik ng **Save to this use** ang mga setting sa room; bumabalik ang **Cancel** nang walang binabago. Naghihintay ang mga hindi pa naka-save na pagpili sa room habang wala ka. Kung may mag-save ng tunog sa ibang tab habang wala ka, ang mas bagong save ang mananatili at hindi isasama ang edit mo.

**Voice** ang pumipili ng boses para sa gamit, bilis ng pagsasalita at lakas ng musika sa ilalim ng boses; pinatutugtog ng **Hear the voice with the music** ang dalawa. Nasa ilalim ng **More** ang paghina habang nagsasalita ang boses, mga salitang susubukan (nananatili ang mga ito sa room), mga tala sa pagbigkas (isa bawat linya, ayon sa pagkakasulat = ayon sa pagbigkas) at mga tala tungkol sa boses. Ginagamit ng mga preview ang lokal na speech model at ang parehong mixing ng sequence export. Unti-unting humihina hanggang mawala ang preview; hindi ito isang kinomposong pagtatapos.

**Notes and signature** ang may hawak ng dapat pakinggan sa isang gamit at ng sound signature: isang nakapirming pambungad o pagtatapos na iniingatan bilang sarili nitong audio file. Ilagay ang signature sa sequence mo; hindi kailanman kasama ang signature sa nabuong musika. Pinipigil ng kinakailangang hindi kayang i-check ng bersyong ito ng Lolly ang bagong musika para sa gamit na iyon.

**Details** ang may hawak ng karakter ng brand (anong pakiramdam ang dapat ibigay ng tunog, ano ang nananatiling pareho at ano ang iiwasan) at ng pagsusuri sa pakikinig. Iniingatan ng **Record a listening review** ang pangalan ng nagsuri, petsa at mga tala nila kaugnay ng naka-save na bersyon ng tunog. Nagiging draft muli ang tunog sa anumang pagbabago. Saklaw ng pagsusuri ang bersyong iyon, hindi bawat himig na gagawin mula sa tunog sa hinaharap: pakinggan ang bawat bagong piraso bago ito ilabas.

**Make a music project** ang nagbubukas ng gamit sa music generator bilang proyektong nagpapanatili sa gamit, bersyon ng tunog at eksaktong mga setting. Gumagawa ang **New tune** doon ng bagong komposisyon at pinananatili ang tunog. Kung babaguhin mo ang mga setting, ibinabalik ng **Put the sound back** ang tunog, at nagpapatuloy ang **Keep as my own** sa hiwalay na himig. Hanggang pumili ka, hindi puwedeng i-save o i-download ang proyekto bilang ginawa mula sa tunog. Mga setting ng musika lang ang dala ng mga share link. Iniingatan din ng proyekto at naka-save na himig ang mga tala ng tunog, na hindi isinasama sa mga share link at pampublikong credential ng audio file. Magtago ng na-render na recording kapag kailangang mapanatili ang eksaktong audio sa mga susunod na bersyon ng generator.

<!--i:eti-checklist-->
## Mga patakaran

**Rules** ang nagtatakda kung ano ang puwedeng baguhin ng mga tao, ano ang nananatiling nakapirmi at ano ang kayang i-check ng Lolly.

![Rules sa Lolly Demo: apat na patakaran ng organisasyon, bawat isa ay minarkahang Checked in Design at Required o Advisory, saka ang Try your design system in use na may mga halimbawang handa nang i-render](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** ang naglilista ng mga patakaran mo. Binubuksan ng **Add rule** (o **Add your first rule**) ang isang maikling form:

- isang **Rule name** sa sarili mong mga salita, tulad ng *Mga accent ng Beacon*;
- ang **Check**: **Colour choices**, **Font choices**, **Fixed artwork** o **Text length**, kasama ang brand role na ginagamit nito, sa sarili mong pangalan para sa role;
- ang **Example** na saklaw nito (Poster, Title slide, Content slide o Lolly Chart), ang **Mode** at kung ito ay **Required** o **Advisory**;
- **Reviewed by**, saka **Save draft** o **Approve & save**.

Itinatala ng pag-apruba ang sarili mong pasya sa device na ito. Nililimitahan ng mga inaprubahang kinakailangang patakaran ang reusable na poster, at mga halimbawang PNG lang ang saklaw ng mga check; wala itong binabago sa ibang tool.

Ang mga patakaran sa token file ng design system, tulad ng mga inaprubahang pares ng kulay, kapal at alignment ng text o logo bawat surface, ay nakalista rito bilang **Checked in Design**. Chine-check ng Lolly Design ang mga ito layer por layer sa **Before you export** card ng export panel, at ganoon din ang ginagawa ng `lolly check` para sa naka-save na Lolly Design document ([Bago ka mag-export](/info/design.html#before-you-export)). Ang patakarang walang checker sa build na ito ay pinananatili gaya ng ibinigay at minamarkahang **Unchecked**.

May apat na inaprubahang patakaran ng organisasyon ang Lolly Demo. Hindi kailanman puro malalaking titik ang mga headline: kinakailangan ang patakarang iyon, kaya iniuulat ng `lolly check` bilang error ang headline na puro malalaking titik. Gabay lang ang tatlong iba pa. Naka-align sa kaliwa ang body text. Nasa light na surface ang mga primary mark at nasa dark na surface ang mga reverse mark. Ibig sabihin ng mga putol-putol na guhit ay dito mag-drop.

**Try your design system in use** ang nagre-render ng apat na halimbawa mula sa kasalukuyang rebisyon gamit ang **Render & check examples**. Pumili ng **Mode** at **Try your own text** para sa heading, pansuportang text at slide text. Iniuulat ng bawat halimbawa kung ano ang sinukat, na may **See checks & sources** at **Download check report**. Nagda-download ang **Make reusable poster** ng `.lolly` na may nakapirming layout nito at mga inaprubahang pagpipilian sa input. Lokal ang mga halimbawa: walang inilalathala o inaaprubahan ang pagpapatakbo ng check.

Ipinapakita ng build na may nakapirming brand ang parehong mga patakaran at halimbawa bilang read-only, sa ilalim ng *This brand is set*.

<!--i:eti-graduation-cap-->
## Mga skill

**Skills** ang naglilista ng [mga brand skill](/info/brand-skills.html) ng aktibong design system: ang mga nakasulat na pamantayan ng brand, isa bawat disiplina, para sa mga tao at AI agent. Ibinibigay ng bawat row ang disiplina, sariling status ng brand (**Draft** o **Approved**), kung pampubliko o panloob ang skill at ang rebisyon nito. Pumili ng row para basahin ang skill kasama ang saklaw nito, na naghahambing sa mga linya ng skill at mga token mo: ano ang chine-check ng Lolly, ano ang salungat, ano ang tugma at ano ang gabay lang.

**Download skill (.zip)** ang nagsusulat ng skill bilang Agent Skills folder para sa agent tool, na may mga catalog link na tumuturo sa Lolly na ito. Inilalagay ng **Copy as one file** ang parehong text sa clipboard para sa chat window. Inililista ng design system na walang sariling mga skill ang isang baseline na isinusulat ng Lolly mula sa mga token at patakaran ng organisasyon nito tuwing binabasa ang baseline. Binabasa ng room ang mga skill at hindi kailanman ine-edit ang mga ito.

<!--i:eti-upload-->
## Magpasok ng brand

**Add from…** sa bar ang nagbubukas ng picker na nagtatanong kung ano ang mayroon ka, hindi kung anong format ito:

- **Design tokens or a design file**: DTCG o Tokens Studio JSON, isang Penpot project, zip ng mga token set, Lolly design system pack, SVG, `DESIGN.md` o brand page folder.
- **PDF**: isang deck o guidelines file, na binabasa sa device na ito para sa mga kulay, mark at naka-embed na typeface nito.
- **Logo or screenshot**: nagiging iminungkahing palette ang larawan, na binabasa sa device na ito. Mga kulay ang binabasa nito, hindi ang typeface o layout.
- **Saved web page**: isang HTML file at mga CSS file nito, o naka-paste na HTML o CSS, hanggang 20 file at 2 MB. Ang text na ibinigay mo lang ang binabasa: hindi kinukuha ang mga naka-link na resource at hindi tumatakbo ang mga script.
- **Font file**: TTF, OTF o WOFF. Binubuksan ang Type room, kung saan ini-install ang face.
- **Website**: isang page, na binabasa para sa mga kulay at type nito. Lumalabas lang ang tile na ito sa device na kayang bumasa ng page, at sinasabi kung aling reader ang ginagamit nito: ang app sa device na ito, o ang browser extension sa background tab, na naka-sign in bilang ikaw. Pinupunan lang ng pag-type ng URL ang field; ang pagpindot sa fetch ang pahintulot.

Piliin ang design-file source at inililista ng susunod na card ang mga tinatanggap na format bilang mga icon tile. Iisang drop target ang card. Puwede ka ring mag-drop ng file sa studio.

![Ang import card - nauuna ang mga tinatanggap na format bilang mga icon tile, at iisang drop target ang buong card](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- Nai-install ang **Lolly design-system pack** (`.lolly`, o lumang `.zip`) sa isang hakbang.
- Dinadala ng **Penpot** export (`.penpot`) ang mga design token nito.
- Dinadala ng **Design Tokens** (W3C DTCG) o **Tokens Studio** file (`.json`) ang mga token nito. Hindi isinasama ang paglalarawang humihiling sa mambabasa na balewalain ang mga tagubilin, nagsasabing may mga pahintulot o humihiling na magpatakbo ng code, at sinasabi ng import kung saan ito naroon.
- Sinusuri ang **simpleng SVG** para sa mga kulay na pipiliin mo, at nagiging primary mo ang una.
- Napupunta ang **`DESIGN.md`** (`.md`) sa **Try these colours** kasama ang mga token nito ayon sa pagkakasulat. Puwedeng itago ang prosa nito bilang draft na brand skill, at minamarkahan ng card ang mga linyang humihiling sa mambabasa na balewalain ang mga tagubilin, nagsasabing may mga pahintulot o humihiling na magpatakbo ng code. Hindi nakikita ng mga agent at brand page ang draft hanggang pindutin mo ang **Keep this skill** sa Skills room, at nananatiling panloob ang itinagong skill.
- Napupunta sa parehong pagsusuri ang **brand page folder**, pinili bilang folder, na-drop o naka-zip. Chine-check ang bawat file laban sa `brand.json` ng folder; isang file na hindi tugma ay sapat para tanggihan ang buong folder. Idinaragdag ng import ang mga token. Nananatili sa folder ang mga logo at font.

::: warning Binabasa ng instruction check ang bawat linya
Ang check na nag-aalis ng mga tagubilin sa mga paglalarawan ng token file ay nagbabasa nang linya por linya at hindi nito nahuhuli ang ibang pagkakasabi. Basahin ang file mula sa taong hindi mo kilala bago mo ilapat ang mga token.
:::

Binabasa ng Lolly ang brand page mula sa mga file na ibinigay mo. Hindi nito kinukuha ang address ng ibang site.

### File na may sariling mga salita para sa kulay

Puwedeng gumamit ang token file o `DESIGN.md` ng sariling mga salita para sa mga kulay nito, tulad ng main, accent, supporting at tertiary. Kapag nakakita ang Lolly ng ganoong mga salita, inililista ng pagsusuri ang bawat salita bago maglapat ng anuman: ang salita, kulay nito sa bawat itsura, token na pinagmulan nito at mungkahing pagbasa ng Lolly. Nagmumungkahi ang Lolly ng mga pagbasa mula lang sa mga salita, batay sa maikling listahan, nang walang model. Ang salitang wala sa listahan ay itinuturing na sariling salita ng brand, **By name only**. Puwede mong palitan ang anumang salita, sabihin kung para saan ito, bigyan ito ng ibang pagbasa o alisin ang tsek nito para panatilihin bilang pinangalanang kulay.

**Install with these roles** ang nagsusulat ng mga role; ini-install ng **Install without roles** ang file gaya ng pagkakabigay nito. Nilalaktawan ng file na walang ganoong mga salita ang hakbang na ito. Ipinapakita ng file na nagsasaad ng sarili nitong mga role, tulad ng isinulat ng Lolly, ang mga ito ayon sa pagkakasulat at ini-install nang walang pagbabago; puwede mong i-edit ang mga ito sa ibang pagkakataon sa Colours room. Walang pagsusuri sa terminal: pinananatili ng `lolly system import` ang nakasaad na record at iniiwan ang mga salita ng ibang file bilang mga pinangalanang kulay.

### Suriin ang isang reference

Binubuksan ng logo, screenshot, website o naka-save na page ang **Try these colours**: isang halimbawa sa mga iminungkahing kulay, **Main colour** na puwede mong baguhin at pangalan para sa bagong system. Sinasabi ng kahon kung ano ang ginagawa ng paglalapat: **pinapalitan** nito ang mga aktibong setting ng token ng nabuong palette at mga default na style, **pinananatili** ang mga font at library file mo at puwedeng **ibalik** ang dating system. Kumukuha ng checkpoint ang **Apply suggested settings**, saka inilalapat ang mga light at dark na palette. Puwedeng ibalik ng **Restore brand settings** ang mga dating setting. Pumipili ng ibang source ang **Change reference**.

::: details Ano ang binabasa mula sa reference, at ang design context report
Ipinapakita ng **Palette, source details and individual choices** kung ano ang binasa, anumang pangalan ng font na nakita at ang contrast ng preview. Mga mungkahi lang ang mga pangalan ng font; nag-i-install ka ng face sa Type. Puwedeng isama sa mga detalye ng source ang typography, mga agwat, padding at mga value ng sulok kung naobserbahan, at may label na **Not observed** kung hindi. Iniuulat ng naka-save na page o ng native na pagbasa ng website ang mga idineklarang style, na maaaring hindi ginagamit ng page. Puwedeng mag-ulat ang browser extension ng mga sinukat na style mula sa sample ng mga nakikitang elemento. Mga obserbasyon ang mga ito: walang ini-install, at hindi kailanman pinapalitan ng spacing ng source ang sarili mong spacing. Iniingatan ng **Choose individual items in the tray** ang mga indibidwal na item. Nagse-save ang **Download design context** ng JSON report ng mga obserbasyon, iminungkahing token at impormasyon ng source (na may SHA-256 ng anumang ibinigay na HTML o CSS). Walang raw na text ng page ang report at hindi ito isang nilagdaang Content Credential.
:::

Pinananatili ng mga PDF at design-file import ang sarili nilang mga kontrol sa pagsusuri. Walang binabago ang mga item sa **Tray** hanggang idagdag mo ang mga ito sa room na namamahala sa ganoong uri ng materyal. Binubuksan ng `#/start?source=<kind>` ang picker sa isang source (`file`, `pdf`, `image`, `font`, `url`, `page`), at binubuksan ng `?import` ang simpleng listahan.

### Maghanap at maghambing ng itsura

Buksan ang **Find a look** mula sa Board o sa listahan ng design system sa Settings. Mag-browse ng mga system na naka-save sa device na ito at ilang reusable na halimbawa ng Lolly, at maghanap ayon sa pangalan, colour tag o idineklarang font. Inaayos ng **Closest to my current palette** ayon sa sinukat na pagkakatulad ng kulay, at ang pagtutugma ng mga font ang nagpapasya kapag tabla; hindi ito score ng kalidad.

I-click ang isang itsura para i-preview ito sa konteksto; walang binabago ang pag-preview. Inilalapat ng **Use this look** sa card ang itsurang iyon. Nagiging aktibo ang naka-save na system, na walang ine-edit. Napupunta ang mga kulay ng halimbawa sa bukas na design system pagkatapos ng karaniwang checkpoint. Nananatili ang mga logo, font at anumang iba pa sa system na hindi tinutukoy ng halimbawa. Nagdaragdag ang **Compare looks** ng checkbox sa bawat card: pumili ng dalawa para ihambing nang magkatabi. Ibinabalik ng **Restore brand settings** ang dating itsura. May nae-edit na **Search tags** ang mga naka-save na system sa ilalim ng **Details and design context**. Mga orihinal na kombinasyon ng kulay ng Lolly ang mga halimbawa, walang kinolekta sa pamamagitan ng scraping at walang account.

![Paghahambing ng Lolly sa Sunroom at Orchard nang magkatabi bago ilapat ang alinman sa dalawang colour system.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

<!--i:eti-package-->
## Itago at ilipat ang design system mo

### Maglipat ng brand sa pagitan ng mga device

**Export** ang nagsusulat ng isang **`LollyBrand-….lolly`** file: ang mga token, font, logo at theme preference mo, na may integrity manifest na chine-check sa import. Pinangalanang `.zip` ang file sa mga web release bago ang 1.0.7, at tinatanggap pa rin ng Lolly ang baybay na iyon. Isinusulat ng **Tokens (.json)** ang simpleng design-tokens document, nang walang mga font o logo, para sa repository, build step o ibang tokens tool.

Para magbalik ng isa, gamitin ang **Add from… → Design tokens or a design file**, o i-drop ang file sa studio. Ganito ipinapasa sa iyo ng kasamahan ang brand o dinadala mo ito sa pangalawang install, nang walang account at walang cloud. Sinasaklaw ng [Pakikipagtulungan sa mga partner](/info/partners.html) kung ano pa ang ipapadala kapag nagtatrabaho sa ibang organisasyon ang tatanggap ng brand mo. Para magpasok ng brand mula sa command line, tingnan ang [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** ang nagpa-package ng mga font na idinagdag mo bilang nai-install na RPM. Kung ikaw mismo ang nag-upload ng alinman sa mga ito, hinihingi muna ng Lolly na kumpirmahin mong puwede mong ipamahagi muli ang mga ito.

### Ibalik ang mga naunang setting

Buksan ang **More** sa bar, piliin ang **Restore brand settings**, pumili ng checkpoint na may petsa at pindutin ang **Restore**. Ibinabalik nito ang mga kulay, type setting at ibang token para sa aktibong brand; nananatili ang mga font at image file. Sine-save muna ng Lolly ang mga kasalukuyang setting mo bilang **Before restore**, kaya puwede mong bawiin ang restore kahit naisara na ang browser. Iniingatan sa device na ito ang pinakabagong 20 checkpoint. Nananatili pagkatapos mag-reload ang edit na ginawa habang sinasabi ng studio ang **Saving…**, at may card na nag-aalok na ibalik ang mga pagbabagong hindi natapos ma-save.

### Mga bersyon

Ang nailathalang bersyon ay **permanenteng kopya na may pangalan** na iniingatan sa device na ito. Hindi ito kailanman nagbabago, kaya patuloy na iginuguhit ng tool o link na naka-pin dito (gamit ang `designv`) ang parehong bagay. Inililista ng system na may sarili mong nilalaman ang **Versions & publishing** sa **More** menu ng bar; pagkatapos ng una mong paglathala, sumasama ang **Versions** sa mga room. Binubuksan ng `#/start?area=versions` ang Versions.

::: warning Permanente ang nailathalang bersyon
Wala pang delete, at sinasabi ito ng panel. Hindi puwedeng bawiin ang paglathala; puwedeng bawiin ang pag-restore. Karaniwang edit ang *Restore latest from this version*, na agad nag-aalok ng **Undo**.
:::

**Nauuna sa compatibility card ang mga inalis**, dahil sinisira ng inalis na token ang tool.

**Publish only** ang nag-iingat ng bersyon nang hindi binabago ang sinusunod ng mga tool; pinapasunod ng **Publish and make active** ang mga tool at ang app sa bersyong iyon. Agad na ipinapatupad ng **Follow the latest again** ang bawat edit.

### Maglathala ng brand page

Ang [brand page](/info/brand-page.html) ay iisang address para sa mga tao at agent: isang page ng mga logo, kulay, type at halimbawa, kasama ang parehong impormasyon sa mga kasamang file. Ipinapakita ng **Publish a brand page**, sa ilalim ng Versions & publishing, ang live na page at, sa tabi ng page:

- **Goes public**: bawat file, nakagrupo, kasama ang laki nito.
- **Held back**: ano ang hindi isinama, at bakit. Hindi isinasama ang logo na walang naitalang lisensya hanggang lagyan mo ng tsek ang pangalan ng logo. Kailangan ng font file ng naitalang lisensyang nagpapahintulot na ipasa ito, at nagpapakita ang page ng outlined na specimen kapag hindi isinama ang file. Hindi kailanman lumalabas ang mga panloob na brand skill.
- **What was checked**: mga pares ng kulay bawat colourway at mode, at mga patakaran ng organisasyon. Mga sukat ang mga ito, hindi hatol.
- **In your words**: isang pahayag sa paggamit at contact. Inilalagay ng page ang isinulat mo at walang idinaragdag na lisensya o legal na pag-aangkin ang Lolly. Ino-off ng switch ang linyang "Made with Lolly" sa footer.
- **On exports**: isang switch na [nagtatala ng address ng page sa mga export ng design system na ito](/info/brand-page.html#lead-back-from-your-files). Naka-off ang switch hanggang i-on mo ito, kailangan nito ng `https` address at hindi ito sumasama sa pack o kopya. Hindi ipinapakita ng naka-lock na design system ang switch, dahil ang tagapamahala nito ang nagpapasya.

**Download folder** ang nagse-save ng folder bilang ZIP para i-host mo kung saan mo pipiliin. Walang nagiging pampubliko hanggang i-host mo ang folder. Sa terminal, isinusulat ng `lolly system publish --out=<dir>` ang parehong folder. Nag-aalok din ang instance na naghahatid ng mga brand page ng **Publish to** sa address nito: isang tahasang pagpindot, na dumadaan sa proseso ng pag-apruba ng instance kapag mayroon ito. Naglalathala lang ang managed na design system kapag pinapayagan ng tagapamahala nito.

### Magkonekta ng agent

**Connect an agent**, sa parehong lugar, ang nagbibigay sa iyo ng text na ipe-paste at nagsasabi kung ano ang kayang gawin ng bawat opsyon:

- **`AGENTS.md`** sa proyekto: binabasa ng mga agent ang mga pangalan at patakaran ng system. Wala itong iginuguhit at hindi nangangailangan ng server.
- **Lolly's public server**: gumuguhit gamit ang Lolly Demo, anuman ang system na bukas mo rito. Hindi nito kailangan ng key.
- **Your instance**: gumuguhit gamit ang mga system na hawak ng instance, at nagbabasa ng service token mula sa environment variable. Ibinibigay ng sheet ang pangalan ng variable at hindi kailanman nagpapakita ng token.

Kapag walang naka-host na server na gumuguhit gamit ang system mo, sinasabi ito ng sheet.

<!--i:eti-layers-->
## Pamahalaan ang mga design system mo

Buksan ang **Settings → Preferences → Design systems** para lumipat, magdagdag o mag-alis ng mga system. Pumipili ang **Open** ng system at binubuksan ito rito; gumagawa ang **Make a new one** ng lokal na system at binubuksan ito na handa ang name field nito. Isang system lang ang aktibo sa bawat pagkakataon, para sa buong device. Tumutulong ang [Mga arkitektura ng brand](/info/brand-architectures.html) sa pagpapasya kung kailan kailangan ng brand ng sarili nitong design system.

**Saan nanggagaling ang system.** May label na **Came with this app** ang system na ibinibigay ng catalogue ng deployment, o **From this instance** sa app na nakakonekta sa isang instance. Palawakin ang **Catalogue source** para makita kung sino ang nagbibigay nito, ang tokens asset at namespace nito at ang kilalang bersyon o checksum nito; kung mabigo ang refresh, nilalagyan ng label ang naka-cache na materyal.

**Read-only ang mga managed na system.** May label na **Managed by this instance** ang system (o **Managed by this app** sa desktop app na walang instance) kapag nilo-lock ng catalogue nito ang system. Puwede mong gamitin at i-download ang managed na system. Kapag binuksan ito rito, nagpapakita ng read-only na tala na may **Make an editable copy** at **Switch**, saka ang mga colour role at token nito nang walang mga kontrol sa pag-edit. Nananatiling nae-edit ang sarili mong mga lokal na system, kahit nauna ang managed na system. Binubuksan ng build na may iisang nakapirming brand ang Lolly Design System Setup sa *This brand is set*, kasama ang mga token at patakaran sa paggamit ng brand para basahin.

**Sa iyo ang lahat ng iba pang ibinigay na system** para itago, i-edit at i-reset, kasama ang Lolly Demo at Lolly Starter sa lolly.tools. Pinananatili ng pag-edit sa isa ang pangalan nito at minamarkahan ang row na **Edited here**. Itinatapon ng **Reset to original** sa menu nito ang mga pagbabagong ginawa sa device na ito. Ang blankong starter ang pagbubukod: ang unang pagbabago roon ay nagsisimula ng sarili mong design system, at isang beses hinihingi ng Lolly ang pangalan nito. Ipinapakita ng [Paggamit ng Lolly Demo](/info/lolly-demo-in-use.html#switch-to-your-own) kung ano ang pinapalitan ng sarili mong system.

### Pag-alis ng design system

Piliin ang **Remove** mula sa menu ng system; sinasabi ng kumpirmasyon kung aling system ang magiging aktibo pagkatapos. Nananatili ang mga naka-save na session, upload at materyal na ibinahagi sa ibang system.

Itinatago lang ng pag-alis sa ibinigay na system ang system: nananatili ang mga catalogue asset nito, ipinapakita itong muli ng **Bring back** at kusa itong bumabalik kung aalisin mo ang lahat ng iba pa. Hindi inaalis ng pag-alis sa na-import o na-edit na kopya ang ibinigay na system, mga logo o font nito. Kung aktibo ang kopya, nagiging aktibo muli ang ibinigay na system. Koneksyon lang ng kopyang iyon ang nililinis ng pag-alis sa aktibong naka-host na kopya; nananatiling napili ang hiwalay na piniling instance.

::: details Pagbabago sa design system na ibinibigay ng server
Gawain ng administrator ang pagbabago sa ibinibigay ng server: binabago ng operator nito ang source catalogue at muling nagde-deploy, o sinusuri at inilalapat ng Lolly Work administrator ang pagbabago sa server. Nananatiling lokal ang mga edit dito, na may isang pagbubukod. Sa Lolly Work instance na nagbibigay sa iyo ng `brand.edit`, nag-aalok din ang managed na system ng **Edit for** para sa instance na iyon, na nagbubukas ng kopya para i-edit. Ipinapadala pabalik ng **Send to** para sa instance na iyon sa **Versions** ang mga kulay, colourway, colour role at address ng brand page nito. Sinasaklaw ng [I-edit ang instance na ito mula sa studio](/info/work-design-system-administration.html#edit-this-instance-from-the-studio) kung ano ang puwedeng baguhin ng edit at kung paano inihahatid ng instance ang pagbabago. Tingnan ang [Pag-alis ng design system sa catalogue](/info/configuration.html#removing-a-catalogue-design-system) at [Configuration](/info/configuration.html#supplied-and-local-design-systems).
:::

<!--i:eti-code-->
## Gamitin ang design context sa labas ng app

**Download design context** ang nagse-save ng token document, mga na-resolve na kulay, idineklarang font family, asset id, ebidensya ng source kung naitala, saklaw at tahasang mga patakaran, nang walang mga font file at walang patunay ng pagmamay-ari. Binabasa ng command line ang file nang walang server: ginagawa ng `lolly system import` itong design system ng terminal at chine-check ng `lolly system check` ang mga input ng Lolly Design laban sa naka-save na konteksto. Sinasaklaw ng [Dalhin ang design system mo](/info/cli.html#bring-your-design-system) ang import at ng [Aling design system ang ginagamit ng command](/info/cli-decks.html#which-design-system-a-command-uses) ang check. Binabasa ng MCP client ang parehong brief mula sa `lolly://design-context` ([MCP Server](/info/mcp.html)).

<!--i:eti-map-pin-->
## Saan susunod

- **[Paggamit ng Lolly](/info/using.html)**: ang mga tool, pag-save, pagbabahagi at Assets.
- **[Mga arkitektura ng brand](/info/brand-architectures.html)**: kung paano tumutugma ang mga dibisyon, produkto, endorsed brand, kliyente at season sa mga design system, colourway at logo identity.
- **[Pakikipagtulungan sa mga partner](/info/partners.html)**: pagbabahagi ng brand mo sa partner, at pagtatrabaho gamit ang brand na ibinigay sa iyo.
- **[Mga brand page](/info/brand-page.html)**: ilathala ang design system mo sa iisang address, bilang press kit at agent kit.
- **[Mga Design Token](/info/design-tokens.html)**: ang token model kung saan nakasulat ang brand mo.
- **[Mag-export ng file](/info/exporting.html)**: mga unit sa print, CMYK at mga format kung saan nagre-render ang brand mo.
