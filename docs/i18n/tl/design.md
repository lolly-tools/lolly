# Design: ang malayang canvas

Ang Design ang tool para sa mga layout na hindi sakop ng template: poster mula sa simula, deck ng mga slide, motion piece na may soundtrack. Sa halip na form ng mga kontrol, may canvas ka ng mga kahon na dina-drag, nire-resize, ini-rotate at tina-typan mo. Nag-e-export ito sa parehong render path ng bawat ibang tool, kaya ang nakikita mo sa canvas ay ang file na makukuha mo.

Dinadaanan ng pahinang ito ang canvas mula sa unang kahon hanggang sa tapos na deck: ang window, paghubog ng mga kahon, pagguhit ng sarili mong mga hugis, paglalagay ng 3D scene at ibang tool, pagdaragdag ng oras, pag-check ng resulta at pagpe-present ng tapos na deck. Sinasaklaw ng [Paggamit ng Lolly](/info/using.html) ang pinagsasaluhan ng Design at bawat tool, tulad ng pag-save at pagbabahagi.

![Ang libreng canvas ng Design - ang artboard kasama ang pasteboard na nakapaligid dito](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

## Ang Design window

Nagsisimula ang **top bar** sa **Home**, ang **File menu** at ang pangalan ng dokumento (i-click ang pangalan para palitan ang pangalan ng dokumento). Nasa gitna ang **Undo**, **Redo**, **History**, ang mga kontrol sa zoom (kasama ang **Fit all** at **Fit artboard**) at mga toggle para sa **Timeline**, **Navigator** at **Inspector**. Sa kanan ay ang **Share**, **Present** at **Export**. Sa phone, lumilipat sa **More actions** ang mga bihirang gamitin na button.

Hawak ng **tool rail** sa gilid ang Lolly menu at ang mga tool na ginagamit mo sa pagguhit: **Pointer**, **Add a box**, **Pen**, **Edit points**, **Line**, saka ang mga button ng Timeline, Artboards at Auto-arrange.

![Ang tool rail ng free canvas: isang drag grip, ang Lolly menu, tapos Pointer, Add a box, Pen, Edit points, Line, Timeline, Artboards at Auto-arrange](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

Gumagana ang canvas tulad ng pasteboard ng designer sa paligid ng artboard:

- **Iparada ang mga kahon sa labas ng artboard.** I-drag ang kahon lampas sa gilid ng frame at nananatili itong nakikita at napipili. Lahat ng nasa labas ng frame ay kupas, at pinapanatili ng frame ang anino nito para markahan kung saan nagsisimula ang file.
- **Ang artboard lang ang ine-export.** Anumang nasa labas ng frame, o ang bahagi ng kahon na nakalampas sa gilid, ay pinuputol sa output sa raster at vector format.
- **Mag-zoom out lampas sa Fit** para makita ang lahat ng pinarada mo.
- **I-resize ang artboard** sa pagbabago ng export size. Nananatili ang posisyon ng mga kahon, kaya puwede mong i-reframe ang layout sa paligid ng umiiral na nilalaman.

![Ang editing stage: ang artboard sa harapan at gitna, ang tool rail sa kaliwa at ang zoom HUD sa sulok](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&chrome=1&dark=1&filename=seq-studio-stage)

### Ang Navigator at ang Inspector

Inililista ng **Navigator** ang bawat artboard (may heading na **Artboards**, o **Slides** sa deck) bilang nakatiklop na grupo ng mga **Layers** nito. Piliin ang pangalan ng artboard para pumunta roon, palawakin ito para pumili o mag-reorder ng mga layer at gamitin ang mga arrow key para lumipat sa listahan; ang Left ay bumabalik sa heading ng artboard. Ang **Pages** ay nagpapangkat ng mga artboard sa mga pinangalanang page, at ang pagpili ng page ay nagbabago lang kung aling mga artboard ang ipinapakita ng editor.

Inilalagay ng **Inspector** sa unahan ang mga kontrol ng text o larawan ng napiling bagay. Sinasaklaw ng mga option chip ang mabilis na pagpili, at hawak ng **Advanced** ang detalye ng styling. Sa phone, bumubukas ang Inspector bilang sheet mula sa **More actions**; isinasara ng Escape o Back ang sheet at pinapanatili ang seleksyon mo.

![Ang Document section ng Inspector: ang mga tab na Selection at Canvas, saka ang Dimensions at Style & look](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

## I-resize, i-scale at i-rotate

Pumili ng bagay, saka i-drag ang handle para baguhin ang laki, o i-drag ang bilog na handle sa ilalim ng seleksyon para paikutin ang bagay. Ang size drag ay gumagana sa isa sa dalawang mode:

- Ang **Resize**, ang default, ay nagbabago lang ng kahon. Nagre-rewrap ang text sa bagong laki, at nananatili ang laki ng font, lapad ng stroke, corner radius at mga epekto.
- Ang **Scale** ay nagpapalaki o nagpapaliit sa buong bagay kasama ang nilalaman nito: ang laki ng font, stroke, corner radius, anino, blur, padding at spacing ay pare-parehong nagbabago ng parehong dami.

Pindutin ang `K` para i-on o i-off ang Scale. Kung walang keyboard, piliin ang **Scale mode** sa Lolly menu, o pindutin nang matagal ang **Pointer** button sa rail (o i-right-click ang button) at piliin ang **Scale**; sa touch screen, may Scale toggle din ang object bar. Habang naka-on ang Scale, ipinapakita ng Pointer button ang Scale icon at may tuldok sa gitna ang bawat handle. Ibinabalik ng `V` o **Escape** sa Resize at pinapanatili ang seleksyon mo. Bawat dokumento ay bumubukas na naka-off ang Scale, para walang aksidenteng mag-scale ng mga stroke.

**Mag-scale ayon sa numero.** Kapag naka-on ang Scale, o kapag maraming bagay ang napili, i-click ang readout sa object bar para buksan ang **Scale** popover. Mag-type ng porsyento, lapad o taas, piliin ang punto na mananatiling nakatigil sa 3 x 3 grid, at piliin ang **Apply**. Bawat scale ay isang undo step.

**Maraming bagay.** Ang seleksyon ng maraming bagay ay may handle sa mga gilid at pati sa mga sulok. Habang bawat bagay ay tuwid o iniikot ng buong quarter turn, at walang group o bilog ang seleksyon, malayang binabago ng corner drag ang lapad at taas. Kung hindi, pinapanatili ng seleksyon ang proporsyon nito at nagdaragdag ang readout ng **Proportional**. Habang nagda-drag ka, nagpapakita ang maliit na label ng laki, o ng porsyento sa Scale mode.

**I-flip ang seleksyon.** I-right-click at piliin ang **Flip horizontal** o **Flip vertical**, o pindutin ang `Shift+H` o `Shift+V` (Shift, dahil ang hubad na `V` ay ang Pointer). Tunay na transform ang salamin, kaya pinapanatili ng na-export na SVG, PDF at PNG ang flip.

**Ang mga key na hawak mo habang nagda-drag** ay umiiral sa sandaling pindutin o bitawan mo ang mga ito; inililista rin ng shortcut sheet (`?`) ang mga ito.

| Hawakan | Pag-resize o pag-scale | Pag-rotate | Paglipat |
|---|---|---|---|
| **Shift** | Pinapanatili ang proporsyon (laging ginagawa ng Scale) | Umiikot sa hakbang na 15 digri | Walang pagbabago |
| **Alt** (Option) | Gumagana mula sa gitna | Malayang umiikot | Ino-off ang snapping at grid |
| **Cmd/Ctrl** | Ino-off ang snapping at grid | Malayang umiikot | Ino-off ang snapping at grid |

Kapag walang hawak na key, hinihila ang pag-ikot sa pinakamalapit na 15 digri kapag nasa loob na ito ng 4 na digri ng isa. Hindi umiikot ang mga artboard, kaya wala silang rotate handle.

::: details Mga handle, grab zone at touch
**Humawak kahit saan sa gilid.** Ang bawat panig ng seleksyon ay resize strip sa buong haba nito, at sa mouse o pen ay may rotate zone sa labas lang ng bawat sulok. Ipinapakita ng pointer kung ano ang gagawin ng drag. Ang pindot sa strip o zone ay nagiging resize o pag-ikot lang kapag nagsimula kang mag-drag, kaya ang karaniwang click ay pumipili pa rin gaya ng dati. Ang naka-lock na bagay ay walang handle, strip o zone.

**Nananatiling magagalaw ang maliliit na bagay.** Sa bagay na 25 screen pixel o mas maliit ang lapad, nagtatago ang mga gitnang handle at ang iba ay lumilipat nang kaunti palabas sa outline, kaya ang pindot sa bagay ay gumagalaw sa bagay. Sa 10 pixel o mas maliit, nawawala rin ang mga corner handle, at ang manipis na linya ay nagpapanatili ng handle sa bawat dulo. Ang pindot sa tabi lang ng manipis na linya o maliit na bagay, malayo sa mga handle nito, ay gumagalaw sa bagay.

**Malalaking grab area.** Sa touch screen, ang bawat corner zone ay isang kapat ng lapad at taas ng seleksyon sa screen, sa pagitan ng 24 at 44 pixel, at ang bawat side zone ay sumasakop sa pagitan ng dalawang sulok. Kapag masyadong maliit ang seleksyon para doon, lumilipat sa labas ng outline nito ang mga zone. Nalalagyan ng shade ang zone sa ilalim ng pointer o daliri mo. Para makuha ang parehong zone gamit ang mouse o pen, i-on ang **Large grab areas** sa Lolly menu; nananatili ang setting sa device na ito.

**Dalawang daliri sa seleksyon.** Sa touch screen, ilagay ang dalawang daliri sa napiling bagay: mag-pinch para mag-scale, mag-twist para umikot o igalaw ang parehong daliri para dalhin ang seleksyon, lahat bilang isang undo step. Kapag naka-on ang Scale, ang pinch ay nag-i-scale rin ng nilalaman; kapag naka-off, nagre-resize ito nang proporsyonal. Ang twist ay nag-i-snap sa pinakamalapit na 15 digri kapag malapit, at hindi kailanman nag-i-snap ang galaw ng dalawang daliri. Kailangang lumapag ang unang daliri sa seleksyon at mabilis na sumunod ang pangalawa, sa seleksyon o sa labas lang ng gilid nito. Ang dalawang daliri saanman ay nag-zoom at nag-pan ng view, at ganoon din ang dalawang daliri sa seleksyong may artboard o naka-lock na bagay, sumasakop sa halos buong view o lumalampas sa gilid nito.
:::

## Gumuhit ng sarili mong mga hugis

Sakop ng mga kahon, bilog at bilugang frame ang karamihan ng layout. Para sa anumang ibang hugis, gumuhit ng isa: ang **Pen** button ng rail (o `P`) ay naglalagay sa iyo sa drawing mode. Tatlong solong key ang lumilipat sa pagitan ng mga mode: `V` para sa Pointer, `P` para sa Pen at `N` para sa **Edit points**. Ang Pointer ang laging labasan.

- **Mag-click** para maglagay ng punto. Sa default na curve type, ang **click and drag** ay humihila ng mga handle ng punto para gumawa ng kurba; pindutin ang **Alt** habang nagki-click para sa matigas na sulok. (Sa ibang curve type, bawat punto ay sulok at walang epekto ang drag.)
- Nag-i-snap ang mga punto sa artboard at sa ibang mga kahon mo habang inilalagay. Pinipigilan ng Alt ang grid habang gumuguhit, at ang grid at mga gilid pareho habang dina-drag ang punto pagkatapos.
- **I-click ang una mong punto** para isara ang hugis. Kung hindi, pindutin ang **Enter**, mag-double-click o lumipat ng tool, at iniingatan ang drawing.
- Ang **Escape** ay gumagana isang hakbang sa bawat pagkakataon: ang unang pindot ay iniiwan ang drawing, ang pangalawa ay lumalabas sa pen.
- Ang **Delete** habang gumuguhit ay nag-aalis ng huling punto.

Ang resulta ay karaniwang kahon. Ilipat, i-resize, i-rotate, i-group, i-align, i-restack, punan, i-shade o i-fade ang path tulad ng anumang ibang kahon. Ang unang path ay kumukuha ng fill at stroke na ibinibigay ng brand mo sa path, at ang bawat bagong path pagkatapos ay kumukuha ng huli mong ginamit. Sa tool na walang itinatakda ang brand para sa mga path, ang bagong path ay may stroke sa kulay na ginamit mo sa pagguhit, kaya hindi kailanman di-nakikita ang hugis.

**I-edit muli ang mga punto.** I-double-click ang hugis, o gamitin ang **Edit points** sa object bar. I-drag ang punto para ilipat ito, i-drag ang handle para itutok muli ang kurba, mag-click sa kurba para magpasok ng punto o mag-drag ng kahon sa ilang punto at pindutin ang Delete. Laging may natitirang hindi bababa sa dalawang punto ang path.

Ang **Spline type** ang nagpapasya kung anong uri ng kurba ang dumadaan sa mga punto mo:

| Uri | Ano ang ginagawa nito |
|---|---|
| **Smooth (auto)** | Ang default. Kinakalkula nito ang sarili nitong haba ng handle, kaya ang simpleng click ay nagbibigay ng makinis na kurba. Ang handle na itinakda mo ay nagpapako ng direksyon, at ang kurba pa rin ang may hawak ng haba. |
| **Bezier handles** | Ang klasikong pen: kontrolado mo ang bawat handle, at ang pagpasok ng punto ay hindi kailanman gumagalaw sa kurba. |
| **Through the points** | Dumadaan nang eksakto sa bawat punto, walang handle. |
| **B-spline** | Dumadaloy malapit sa mga punto sa halip na sa mismong mga ito, para sa mas malambot na linya. |
| **Straight lines** | Isang polyline. |

Ang paglipat ng umiiral na path sa uri na kumakalkula ng sarili nitong mga handle ay nagtatanong muna, dahil hindi mababawi ang mga haba ng handle na itinakda mo; ang paglipat sa **Bezier handles** ay laging walang pagkawala. Sa kalagitnaan ng pagguhit, agad na umiiral ang paglipat, at tinatanggal ang anumang handle na hinila mo.

Bawat punto ay may dala ring continuity rule, na ipinapakita ng hugis nito: parisukat para sa **Corner** (nagsasarili ang paggalaw ng mga handle), bilog para sa **Smooth** (nananatiling tuwid ang mga handle) at bilog na may singsing para sa **Symmetric** (tuwid at magkasinghaba). Itakda ang rule para sa mga napiling punto at agad sumusunod ang kurba.

![Dalawang pen path na direktang na-render mula sa isang link: isang S-curve na may stroke at isang saradong blob na may fill](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

Ang iginuhit na path ay sumasama sa share link tulad ng anumang kahon at pareho ang render mula sa command line.

## Pagsamahin ang mga hugis

Pumili ng dalawa o higit pang hugis, i-right-click ang canvas (two-finger tap sa touch) at piliin ang:

- Ang **Union** ay pinagsasama sila sa isang hugis na may paint ng pinakamataas.
- Ang **Subtract** ay pinuputol ang lahat ng nasa itaas mula sa pinakamababang hugis.
- Ang **Intersect** ay iniingatan lang ang magkapatong.
- Ang **Exclude** ay iniingatan ang lahat maliban sa magkapatong.

Tatlo pa ang gumagana sa isang hugis. Ang **Outline stroke…** ay ginagawang punong outline ang stroke na kasing-bigat nito. Ang **Offset path…** ay pinalalaki ang outline palabas o, sa negatibong numero, pinaliliit ito papasok. Ang **Simplify** ay muling binubuo ang path na may mas kaunting segment sa parehong outline.

![Isang gasuklay at isang singsing na may tunay na butas, parehong gawa ng Subtract](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D%26w%3D1080%26h%3D1080&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&filename=path-ops-boolean-result)

Ang resulta ay bagong path na puwede mong ituloy na i-edit gamit ang pen, naka-store bilang simpleng Bezier curve, kaya hindi nadadala ang orihinal na spline type. Tunay na butas ang mga butas: ang **Fill rule** control sa stroke panel ang nagpapasya kung pinupunan ng magkapatong na contour (*non-zero*) o tumatagos (*even-odd*). Tumatanggi ang mga operasyon sa halip na manira: kung hihilingin mong i-intersect ang dalawang hugis na hindi magkapatong, walang magbabago. Ang mga text at image box ay walang outline, kaya hindi sila ginagalaw.

## Mga 3D scene at tool sa loob ng design

Maaaring maglaman ang kahon ng higit sa larawan. Parehong uri sa ibaba ay nag-iingat ng recipe sa halip na na-render na larawan, kaya muling iginuguhit ang mga ito sa anumang laki at sandali na hinihingi ng dokumento, at ang update sa source ay umaabot sa bawat design na gumagamit ng source.

### Mga 3D scene

Piliin ang **3D scene** sa add menu ng rail at mag-drag ng frame: bubukas ang 3D Studio sa bagong kahon, at ang itinakda mo roon ay bumabalik sa canvas. Pagkatapos, ang **Edit in 3D Studio** sa **3D scene** section ng Inspector ay muling bubuksan ang studio. Sinasaklaw ng [Maglagay ng scene sa Design](/info/3d-studio.html#place-a-scene-in-design) ang mga poster, ang timeline, export at pagbabahagi.

### Mga tool sa loob ng design

Piliin ang **Image** sa add menu ng rail, mag-drag ng frame at pumili ng tool sa **Tools** tab ng picker. Pupunan ng tool ang frame gamit ang mga default nito, at bubukas ang Inspector sa **Tool** section na may hawak ng sariling mga kontrol ng tool na iyon. Baguhin ang field at mag-a-update ang kahon pagkaraan ng sandali, bilang isang undo step. Gumagana ang **Image fit** at **Image position** tulad sa anumang larawan, at pinapalitan ng **Replace with another tool or image** ang nilalaman ng kahon.

Ang **mga tool na gumagalaw** ay tumutugtog sa loob ng kahon: ang umuulit na ilustrasyon ay patuloy na umuulit sa canvas, sumusunod sa playhead kapag bukas ang timeline at nag-e-export frame por frame sa GIF, MP4 o WebM. Kapag sinabi ng tool kung gaano katagal ang isang loop, ang kahon ay nakakakuha ng clip na eksaktong ganoon kahaba, kaya ang video ay may buong mga loop. Ang clip na binago mo ang timing ay nag-iingat ng timing mo, at ang pag-off sa motion ng tool ay ginagawang still na larawan muli ang kahon.

## Timeline (Sequence)

Ang **Sequence** ang timeline ng Design: nagdaragdag ito ng oras sa canvas. Bawat kahon ay puwedeng magsimula sa isang sandali, tumakbo nang isang haba at mag-animate papasok at palabas, at ang timeline na naka-dock sa ilalim ng artboard ang kung saan mo sila inaayos. Magsimula sa **Video** template ng Design at may maikling sequence na: dalawang timed na text card sa sequence row at procedural na music bed sa ilalim nila, para makita mo kung paano gumagana ang timeline bago ka magbago ng anuman.

![Ang Sequence timeline: ang transport, ang ruler, isang overlay lane, ang magnetic sequence row kasama ang mga clip at seam chip nito, at ang Always on strip](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

May dalawang uri ng row:

- Ang **sequence row** ay magnetic. Magkakatabi ang mga clip mula dulo hanggang dulo, ang pag-drag ng isa ay nagre-reorder ng takbo at ang pagbura ng isa ay nagsasara ng puwang. Ito ang gulugod.
- Ang **Overlay lane** ay malaya. Ang lower-third, logo o caption ay lumulutang sa ibabaw ng gulugod sa sarili nitong oras, bawat isa sa sarili nitong lane.
- Sa ibaba nila, hawak ng **Always on** ang mga kahon na walang timing, naroon sa buong takbo. Inililipat ng `+` sa chip ang isa sa lane; ibinabalik ito ng **Make always on**.

Ang pagbubukas ng timeline ay nagbibigay dito ng keyboard, kaya ang Space at mga arrow key ang nagmamaneho ng playhead. Ang komposisyong may timing na ay kusang nagbubukas ng timeline.

**Pag-edit.** I-drag ang gitna ng clip para ilipat ito, i-drag malapit sa alinmang dulo para i-trim ito at pindutin ang **Split at playhead** (o `S`) para hatiin ito sa dalawa. Kailangan ng Split ang clip na may tunay na **Length** at playhead na bahagyang nasa loob nito, kaya hindi mahahati ang open-ended na clip tulad ng music bed. Naka-on bilang default ang **Snap to edges**, na nag-i-snap sa mga gilid ng clip, playhead at buong segundo; pindutin ang Alt para mag-drag nang walang snapping. Bawat drag ay isang undo step, at gumagamit ang preview habang nagda-drag ka ng parehong aritmetika ng resulta.

Pumili ng clip at ibinibigay ng inspector ang parehong edit bilang numero: **Length**, **Trim in** (gaano kalayo sa source magsisimula ang clip), **Speed** mula ×0.25 hanggang ×4, **Animate in** at **Animate out** kasama ang mga haba nila at **Mute clip**. Ang clip sa magnetic row ay walang **Start** field, dahil ang row ang may hawak ng pagkakasunod-sunod.

Ang mga **Transition** ay mga preset: Fade, Pop, Grow, Rise, Drop, ang apat na Slide, Zoom in at out, Tilt, Swoop, Spin, Drift o **Cut (no animation)**. Nag-i-scale ang mga distansya sa bagay, kaya ang isang preset ay tama ang basa sa full-frame na card at sa maliit na badge. Sa pagitan ng dalawang clip sa sequence row, pinipili ng **seam chip** ang **Cut** o **Crossfade**; buksan itong muli para itakda ang **Length (ms)** at pindutin ang **Done**. Sa crossfade, ang unang clip ay tumutugtog lampas sa cut at nagfe-fade out habang nagfe-fade in ang susunod, pareho sa preview at sa file.

**Tunog.** Ang **Audio** clip ay nasa timeline tulad ng anumang clip, na may waveform, trim at mute. Ang generated na music bed ng Video template ay sini-synthesise sa oras ng export, kaya ang bar nito ay nananatiling payak at tahimik hanggang mag-render ka. Pindutin ang mikropono para **mag-record ng voiceover** diretso sa timeline, na may count-in at level meter; sine-save ang take bilang sarili mong asset sa playhead. Ang camera button sa tabi ng mikropono ay **nagre-record ng video** sa parehong paraan, na tinatabas sa artboard habang nagre-record, para makapagdagdag ng clip ang kasamahan mula sa shared link. Pumili ng anumang clip na may tunog at bumubukas ang strip nito sa ilalim ng timeline para sa volume, pan, EQ, pitch, normalising at mga epekto tulad ng **Voice cleanup**; sinasaklaw ng [Sound](/info/sequence-editor.html#sound) sa gabay ng sequence editor ang strip. Hiwalay ang **Audio track** ng export panel: isang bed sa ilalim ng buong clip, na may fade at ducking.

![Ang timeline na may napiling music clip: tumatakbo sa ibaba ang strip nito na may Speed, Fades, Volume, Pan, EQ, Pitch, Normalize volume, at ang Effect slot](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fbx%3Dt1%252Ctext%252C200%252C140%252C1500%252C220%252C0%252Crect%252C16%252C%252C100%252C%252Ccontain%252Cnormal%252CVoiceover%252520session%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252Cseq%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1%252C%252Cfalse%252C%252C60%252C%252C%252C1%257Ea1%252Caudio%252C200%252C500%252C400%252C80%252C0%252Crect%252C16%252C%252C100%252Clolly%25252Floops%25252F3-am-echoes%252Ccontain%252Cnormal%252C%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252C%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1.3%252C%252Cfalse%252C%252C60%252C%252C%252C1%26_sel%3Da1&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px%21important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip&drive=click%3Abutton%3Ahas-text%28%22Inspector%22%29)

**Pag-render.** Ang motion export ay gumuguhit, nagde-decode at nag-e-encode ng bawat frame sa eksaktong oras, kaya hindi umaasa ang file sa makina mong nakakasabay, at ang MP4 at WebM ay walang praktikal na limitasyon sa frame. Ang haba ng timeline ang nagtatakda ng tagal maliban kung mag-type ka ng isa, at tinatatakan ang Content Credentials gaya sa anumang ibang export. Ang still export ay nagbibigay ng frame sa playhead, o contact sheet mula sa **Frames** field; tingnan ang [Mga still mula sa timed na komposisyon](/info/exporting.html#stills-from-a-timed-composition). Ang sequence ay may takdang isang oras. Hawak ng GIF at animated PNG ang bawat frame sa memory, kaya bagay sila sa maiikling clip. Nakatago rito ang **Record live** dahil mas mainam na daan ang frame-by-frame na render.

**Mga keyframe, depth at camera.** Ina-animate ng transition ang clip habang dumarating at umaalis ito. Para i-pose ang kahon sa loob ng clip (lumutang, mag-fade, mag-blur, iangat ito sa page at ibalik), piliin ang clip at pindutin ang **+Keyframe**: ang diamante sa mga tool ng timeline, ang diamante sa object bar ng canvas o **Shift+K** habang may focus ang timeline. Ang posisyon ng playhead ang nagpapasya kung aling pose ang isusulat ng susunod mong edit. Ang parehong mga keyframe ay nagbibigay sa timed na komposisyon ng camera na nag-pu-push in, nag-pa-pan at nag-pu-pull focus. Ang [Animating](/info/animating.html) ang buong gabay, at sinasaklaw ng [Ang sequence editor](/info/sequence-editor.html) ang selection, onion skin, splitting, trimming at mga marker.

## Bago ka mag-export

Sinusuri ng Design ang dokumento mo bago mo ipadala ang file. Binabasa ng **Before you export** card, sa **Document** section ng Inspector at muli sa export panel, ang naka-save na istruktura ng layer, saka tinitingnan ang naayos na canvas para sa putol na text at flat-colour contrast. Tinatanong nito ang parehong font registry na ginagamit ng SVG at PDF outlining kung ang bawat text run ay may font byte na maaaring i-embed. Ang mga image at gradient background ay inililista bilang visual check sa halip na bigyan ng gawa-gawang contrast score.

### I-check ang komposisyon laban sa design system

Inihahambing din ng card ng export panel ang komposisyon sa design system mo, sa parehong bersyon ng design system na ginagamit ng render. Tinitingnan nito ang mga isinulat na kulay, token alias, napiling font at image asset id. Ang custom na value ay maaaring sinadya, at ang larawang wala sa mga idineklarang brand asset ay item para sa review, hindi ipinagbabawal na larawan.

Kung may konkretong suhestiyon sa kulay o font, binabago ng button nito ang isang layer na iyon, at ibinabalik ng **Undo** ang orihinal. Ang mga naka-lock o nabago nang layer ay hindi kailanman ino-overwrite ng lumang suhestiyon. Ang mga gradient, epekto, nested na nilalaman ng tool, rights at subhetibong kalidad ay labas sa paghahambing na ito, at walang check na humaharang sa Download.

### Mga house rule at ang writing signal

Sinusuri din ng card ng export panel ang mga house rule na dala ng design system mo, tulad ng bigat at alignment ng text, aprubadong pagpapares ng kulay o logo bawat surface, layer por layer. Ang bawat natuklasan ay babala na may pangalan ng layer sa itaas ng rule. Ang rule na walang checker ang build na ito ay inililista bilang hindi nasuri, hindi kailanman bilang sinusunod. Inililista ng [Usage & rules](/info/brand-studio.html#usage-rules) ang mga rule, at ang `lolly check` ay naglalapat ng parehong mga ito sa naka-save na dokumento.

Ipinapakita ng parehong card ang writing signal para sa text na iginuguhit ng dokumento: ang band nito (none, weak, notable o strong), saka ang sariling pangungusap ng Verify na may score na ang kabuuan ay 100 at hanggang tatlong naka-flag na parirala, bawat isa kasama ang layer na may hawak sa kanila. Dinadala ng **Open the text in Verify** ang text na iyon sa [Verify](/#/verify) para sa buong pagbasa; ipinapaliwanag ng [AI evidence in Verify](/info/verify-ai-evidence.html) kung ano ang tinitimbang ng score. Ang score ay signal, hindi hatol: binibilang nito ang mga pattern na karaniwan sa generated na pagsulat at hindi nito masasabi kung sino ang sumulat ng mga salita. Hindi isinasama sa dalawang check ang mga nakatagong layer, at sinasabi ng card kung ilan.

Ang mga natuklasan sa house rule at malakas na writing signal ay bumibilang sa kabuuang "to fix" ng card para madaling mahanap. Nagbibigay-alam lang sila at hindi kailanman humaharang: nananatiling available ang Download, at walang i-dismiss o itatala bilang exception. Ang agent na gumagawa sa bukas na dokumento ay nakakakuha ng parehong ulat sa pamamagitan ng mga site tool nito ([Mga agent sa bukas na dokumento](/info/open-document-agents.html)).

Sumasama sa parehong card ang mga print check (bleed, resolution, ink coverage at bilang ng plate) kapag in-on mo ang **Settings → Feature flags → Print preflight**. Sa ibang tool, ang flag na iyon ang nagpapalabas ng card; inilalarawan ng [Mag-export ng file](/info/exporting.html) ang mga print check.

## Pagpepresenta

Ang Design document na binubuo ng mga artboard ay deck na. Pindutin ang **Present** sa top bar at ang bawat artboard ay nagiging full-screen na slide, ayon sa pagkakasunod-sunod ng mga artboard sa canvas. Ang button ay nagsasabing **Preview** hanggang ang **Design outcome** ng dokumento ay **Slides**. Tumatakbo ang deck sa kopya ng mga na-render na artboard, kaya ang pag-alis ay ibabalik ka nang eksakto kung nasaan ka.

Binubuksan ng arrow sa tabi ng **Present** ang **Present from this slide**, **Speaker view**, **Present with camera**, **Narrate**, **Auto-advance slides**, **Loop the deck (kiosk)** at **Export slides as video**.

| Key | Ano ang ginagawa nito |
|---|---|
| **Space**, `→`, **Page Down** | Susunod na hakbang o slide (o i-click ang strip sa kanang gilid) |
| `←`, **Page Up** | Bumalik (o i-click ang strip sa kaliwang gilid) |
| **Home**, **End** | Una o huling slide |
| `O` | Overview: bawat artboard sa pagkakaayos mo sa canvas; mag-click ng isa para buksan |
| `S` | Speaker view: kasalukuyang slide, susunod na slide, mga note at orasan sa pangalawang window |
| `B` | Itim na screen; ibabalik ng anumang key ang slide |
| `F` | Bumalik sa fullscreen |
| `K` | I-pause o i-restart ang kiosk deck |
| **Escape** | Tanggalin ang isang patong: overview papunta sa deck, deck papunta sa editor |

Lumalabas ang maliit na control bar kapag ginalaw mo ang pointer at nagtatago muli kapag huminto ka. Kung hinarang ng browser ang speaker pop-up, bumubukas ang speaker view bilang panel sa ibabaw ng deck. Ang mga note ay pag-aari ng bawat artboard at hindi kailanman lumalabas sa slide.

- **Mga reveal step.** I-right-click ang kahon at piliin ang **Reveal at step 1**, **2** o **3** sa halip na **Always visible**, at maghihintay ang kahon hanggang umabante ka sa hakbang nito. Sabay na dumarating ang mga kahong may parehong numero.
- **Kiosk.** Bigyan ang artboard ng **Length** at mananatili ang deck doon nang ganoon katagal, saka aabante sa likod ng manipis na progress bar. Idagdag ang `kiosk` sa link at bumabalot ang deck sa dulo, para sa signage.
- **Mga sub-slide stack.** I-right-click ang artboard at piliin ang **Stack under the previous slide** para gawin itong hakbang ng slide na iyon. Isang card ang ipinapakita ng overview, at sinasabi ng **Stack** row ng inspector kung aling slide kabilang ang artboard.
- **Morph.** Kapag ang magkasunod na slide ay parehong may kahon na may parehong **Morph match** na pangalan (`hero`, halimbawa), ililipat, ire-resize at ire-recolor ng transition ang kahon na iyon sa halip na mag-cut. Ang deck-wide na **Morph** transition ay gumagawa nito para sa bawat tugmang pares.
- **Narration.** Ang **Speaker notes** ng bawat artboard ay puwedeng basahin nang malakas. Sa **Document** section ng Inspector, pumili ng **Voice**, opsyonal na pangalawang boses na **Blend with**, ang **Speed** at **Lead-in** at **Tail** sa millisecond; ipinapakita ng **Show captions when presenting** ang mga salita habang binibigkas. Tumatakbo sa device mo ang boses, at ang parehong mga note ay nagiging soundtrack ng video export, slide audio sa PowerPoint export at narrated na pelikula sa [SCORM package](/info/create/exporting.html#scorm-course-packages).

Link din ang deck. Ang `?present` ay direktang bumubukas dito at ang `s=` ang pumipili ng slide (posisyon, artboard id o `id.step` para sa build step), at sumusunod ang address sa iyo, kaya ang ipinapadala mo ay ang slide na kinaroroonan mo. Dinodokumento ito ng [Mga reserved na URL parameter](/info/url-parameters.html#what-happens-on-open).

Inilalagay ng **Present with camera** ang camera, logo at name caption mo sa ibabaw ng mga slide, na may pribadong kontrol at naka-save na scene; tingnan ang [Pagpe-present gamit ang camera](/info/presenting.html). Ang **Web page** box ay puwedeng tumanggap ng clicker sa talk kapag in-on mo ang **Make interactive** sa inspector nito: sa **Focus on click** step nito, kinokontrol ng Up at Down ang page habang itinutuloy ng Next ang deck. Sinasaklaw ng [Mga live page na tumatanggap ng clicker](/info/interactive-pages.html) ang focus style, scroll stop at pag-apruba ng site.

## Saan susunod

- **[Text sa Design](/info/text-composition.html)**: pag-edit ng text sa canvas, pagpapadaloy ng mga artikulo sa mga frame at typography.
- **[Animating](/info/animating.html)**: mga keyframe, depth, ang scene camera at mga Lift layer.
- **[Import a design](/info/design-import.html)**: buksan ang Figma, Penpot, Illustrator o InDesign file bilang mae-edit na mga kahon.
- **[Share a design with rules](/info/create-a-tool.html)**: gawing tool ang Design document na may mga input na pinili mo lang.
- **[Mag-export ng file](/info/exporting.html)**: mga format, laki, print unit at video.
