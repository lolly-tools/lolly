# Pag-export at mga Format

Paano makakuha ng tapos na file mula sa isang tool - pagpili ng tamang format, pagtakda ng laki ng output at kung ano ang ginagawa ng bawat opsyon. Tulad ng lahat ng iba pa, **nangyayari ang export sa iyong device**; walang ina-upload.

## Paano Gumagana ang Export

Ang preview *ay* ang file. Kapag nag-export ka, ginagawan ng render ng host ang canvas na iyon sa format na pinili mo at ibinibigay sa iyo ang download (o inilalagay ito sa iyong clipboard). Ang isang tool ay nag-aalok lamang ng mga format na idineklara ng may-akda nito, at itinatago ng picker ang anumang hindi kayang gawin ng iyong browser (tingnan ang [Video](#video)).

Tatlong landas ang gumagawa ng file. Karamihan sa mga tool ay **nagre-render ng canvas** patungo sa napiling format. Ang mga text at data na format (HTML, MD, TXT, JSON, CSV, ICS, VCF) ay sa halip **binubuo mula sa nilalaman ng tool**, hindi rinasterize mula sa larawan. At ang mga privacy utility (hal. *Strip Hidden Data*) ay gumagamit ng ikatlong landas: ang file na *iyong* pinili ay binabago nang byte-for-byte sa device at ibinibigay pabalik nang direkta - walang canvas, walang watermark at walang idinagdag na provenance metadata, dahil ito ay iyo na ring file.

Ang mga aksyon sa export controls:

- <!--i:download--> **Download** - i-save ang file (ang pangunahing aksyon).
- <!--i:photos--> **Copy** - ilagay ang larawan sa iyong clipboard para direktang i-paste sa Slack, email, isang doc. Kung saan hindi makapag-copy ng mga larawan ang isang browser, dine-download nito sa halip at sinasabihan ka.
- <!--i:folder--> **Save** - itago ang kasalukuyang disenyo bilang isang naka-save na tool session sa iyong library.
- <!--i:link--> **Share** - binubuksan ang **Share dialog**: isang link na pwedeng kopyahin na muling gumagawa ng disenyo, mga on-visit toggle (fullscreen, export panel, download- o copy-on-open) at isang opsyonal na **Shortest link** na nagpapaloob ng buong state sa isang compact na token (tingnan ang [URL Mode](/info/url-mode.html)).

(Pinipili ng may-akda ng tool kung alin sa mga ito ang lumalabas; ang default na set ay Copy, Download at Save.)

![Ang export panel - format, laki at ang mga aksyong Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Nagbubukas ang Share sa ibabaw ng tool, na naka-build na ang link at ang mga on-visit toggle sa ilalim nito.

### Pag-render ng Marami nang Sabay

Ang iisang export ay isang file, ngunit maaari kang mag-render ng **marami** sa isang pass - bawat isa ay ihahatid bilang isang `.zip`:

- <!--i:folder--> **Projects → Render folder** ay nag-e-export ng bawat naka-save na session sa isang folder (at ang mga sub-folder nito) bilang isang naka-nest na zip; ang **Render selection** ay ginagawa rin ito para sa anumang multi-selection; ang isang solong naka-save na session ay direktang nagre-render sa sarili nitong file. Walang kailangang Batch/Pro - tingnan ang [Paggamit ng Lolly → Projects](/info/using.html).
- <!--i:layers--> **Batch (Pro)** ay nagre-render ng grid ng mga input set - bawat variant ng isang template nang sabay-sabay.

Ang isang naka-save na session ay maaari ring muling ibahagi bilang tool link mula sa Projects (muli nitong binubuo ang tool URL mula sa mga naka-save na input), kaya ang isang link ay muling magbubukas dito nang may eksaktong parehong mga setting.

## Pagpili ng Format

Ang filename at ang format picker ay nasa itaas ng panel bilang isang `name.format` pair, at ang picker ay nag-lista lamang ng mga format na idineklara ng may-akda ng tool na ito.

![Ang filename field na kaisa ng format picker, kaya ang export ay nababasa bilang isang name.format pair](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

| Gusto mo… | Gamitin | Bakit |
|---|---|---|
| Malinaw na logo / artwork na nag-iiba ang laki | **SVG** | Vector - walang limitasyong scale, maliit, at nae-edit |
| Vector para sa Office / Windows apps | **EMF** | Naipapaste bilang nae-edit na vector sa PowerPoint / Word; nananatiling live at nae-edit ang text, at binubuksan ito ng Google Drive sa Google Drawings para sa Slides |
| Vector para sa print / design apps | **EPS**, o **EPS (CMYK)** | PostScript vector para sa Illustrator / press workflows |
| Vector para sa cutting / CAD machines | **DXF** | Laser cutters, vinyl plotters, CNC - outline paths sa millimeters |
| Nae-edit na slide deck | **PowerPoint** (PPTX) | Native na nae-edit na text + shapes, kasama ang mga imahe at vector na mananatiling ma-extract |
| Kursong maiimport ng isang LMS | **SCORM** (LMS) | Isang zip na may manifest, launch page, ang mga slide, at ang narrated na pelikula na may captions - mula sa isang Design deck |
| Nae-edit na text document | **Word** (DOCX) o **OpenDocument** (ODT) | Tunay na mga paragraph at heading na patuloy na maaaring i-edit ng isang word processor (Doc Studio) |
| Larawan o pangkalahatang imahe | **PNG** (lossless) o **JPG** (mas maliit) | Universal na raster |
| Mas maliit na modernong imahe | **WebP** / **AVIF** | Mas magandang compression, may alpha |
| Print | **PDF**, o **Print PDF** (CMYK) | Tunay na page size; CMYK para sa press |
| Print raster para sa press | **Print TIFF** (CMYK) | DeviceCMYK pixels para sa RIP |
| Animated para sa web | **GIF** | Gumagana kahit saan, mas malalaking file |
| Animated na may buong kulay + tunay na alpha | **APNG** | Animated PNG - walang limitasyon sa palette, tunay na transparency |
| Animated, pinakamaliit na file | **Animated WebP** | Buong kulay + alpha, mas maganda ang compression kaysa GIF o APNG |
| Animated na vector na nag-iiba ang laki | **Animated SVG** | Self-contained; nag-lo-loop sa browser o `<img>`, walang codec, kahit anong laki |
| Video para sa social media / pagbabahagi | **MP4** o **WebM** | Pinakamahusay na quality-per-byte (tingnan sa ibaba) |
| Rich text / email signature | **HTML** | Naipapaste nang naka-format sa mga mail client |
| Plain na content | **MD** / **TXT** | Text lamang |
| Kaganapan sa kalendaryo | **ICS** | Maiimport sa kahit anong calendar app |
| Contact card | **VCF** | Maiimport sa Contacts / address books |
| Structured data na muling maii-import | **JSON** / **CSV** | Round-trips ang content ng tool |
| Favicon | **ICO** | Multi-size na icon ng site (nagbu-bundle ang **ZIP** ng ilang format) |

Ang unang row ang karaniwang kaso. Ang isang wordmark na naka-set sa iyong brand face ay nag-e-export bilang SVG, kung saan ang bawat titik ay outlined path sa halip na pixel, kaya nananatili itong malinaw sa laki ng business-card at sa laki ng building-wrap mula sa parehong file.

![Isang hairline wide-tracked wordmark na nagbabasang Aurora, ang uri ng purong vector artwork na tungkol dito ang SVG row ng talahanayan](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-wordmark-vector)

## Laki at Print Units

Bilang default, ginagamit ng mga export ang native pixel size ng tool. Kung saan naglalantad ang isang tool ng **dimensions**, maaari mong itakda ang width × height at ang isang **unit**:

- **px** (default) - eksaktong pixel.
- **mm · cm · in · pt · pc** - pisikal/print na sukat. Sa pisikal na unit, itatakda mo rin ang **DPI** (default **300** para sa print); tama ang pagko-convert ng engine kada format - ang **PDF** ay nagiging tunay na page sa sukat na iyon, ang **raster** ay nagre-render sa tamang bilang ng pixel para sa DPI (at ina-embed ang resolution), ang **SVG** ay pinananatili ang pisikal na unit na may px viewBox.

Para makakuha ng mas mataas na resolution na raster, maglagay ng mas malaking width/height, o pumili ng pisikal na unit at itaas ang DPI (pixels = size × DPI). Walang one-click scale toggle.

Halimbawa: width `210`, height `297`, unit `mm` → isang A4 page.

![Ang dimensions row na naka-set sa 210 by 297 mm, na lumitaw ang DPI field dahil pisikal ang unit](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Mga Still Mula sa Naka-time na Komposisyon

Ang isang **naka-oras na komposisyon** - isang [Sequence](/info/using.html#timeline-sequence) na timeline sa Design, o kahit anong artboard na hinahatak ng timeline - ay isang bagay na gumagalaw, kaya kailangang sagutin ng still export ang tanong na "aling sandali?". Ang panuntunan ay ang inaasahan mo: **ang frame sa playhead**. Ilagay ang playhead sa gusto mong larawan at i-export; ang nakikita mo ang siyang lalabas.

Kapag gusto mo ng higit sa isang sandali, lumilitaw ang **Frames** field sa tabi ng output size (para lamang sa naka-time na komposisyon, at para lamang sa still format - PNG, JPG, WebP, SVG o PDF). Iwanang `1` para sa playhead frame. Itaas ito at makakakuha ka ng ganoon karaming still na sampled sa pantay-pantay na agwat sa buong sequence:

- Ang **Raster at SVG** ay babalik bilang isang **zip** - `<name>-01.png`, `-02.png` at iba pa.
- Ang **PDF** ay babalik bilang **isang solong dokumento na ganoong karaming page**.

Kapaki-pakinabang para sa isang storyboard, isang thumbnail sheet, isang contact sheet para sa review o isang social carousel na hiniwa direkta mula sa isang video edit.

Kinukuha ang sampling sa **midpoint** ng bawat agwat sa halip na sa mga gilid, dahil ang unang sandali ng isang sequence ay kadalasang isang enter transition na hindi pa nag-fade in at ang huli ay ang state pagkatapos matapos ang bawat clip - ang endpoint sampling ay gagastos ng dalawa sa iyong frame sa halos-blangkong mga ito. Ang bilang ay naka-cap sa **64** (ang isang contact sheet ay para basahin ng tao), at anumang walang-katuturan na na-type sa field ay babalik sa `1` sa halip na palyahin ang export. Bawat frame ay isang ordinaryong still, kaya ang Content Credentials, ang imprint, mga pisikal na unit at DPI ay lahat kumikilos nang eksakto tulad ng ginagawa nila para sa iisang export.

Ang **Frames** field ang paraan para makakuha ng sheet ngayon. Nagre-reserve ang engine ng katumbas na `cuts` URL param, ngunit wala pang shell na nagbabasa nito mula sa isang link, kaya ang isang naibahaging link ay palaging muling bubukas sa playhead frame - tingnan ang [URL Mode](/info/url-mode.html#contact-sheets-cuts).

## Multi-page PDF

May mga tool na bumubuo ng **multi-page na PDF document** sa halip na iisang artwork - isang cover, content na dumadaloy sa kung ilang pahina man ang kailangan nito, at isang back page, lahat sa iisang file (tingnan ang *Booklet* tool). Ang bawat pahina ay isang **tunay na PDF page** na may sukat na batay sa box ng pahinang iyon, kaya nakakakuha ang mga mambabasa at printer ng tunay na mga pahina, hindi isang mahabang larawan.

- **Mga page mula sa nilalaman.** Magdagdag ng mga block ng text at larawan; awtomatikong nagagawa ang mga bagong page habang napupuno ang mga block, at maaari mong pilitin ang anumang block na magsimula ng bagong page.
- **Tunay na sukat ng page.** Pumili ng A4, US Letter o A5 (portrait - ang two-column layout ay ginawa para dito) - bawat page, at ang na-export na PDF, ay nagre-render sa eksaktong sukat na iyon.

Ang mga multi-page na PDF ay RGB documents at walang dalang crop/bleed marks - ang mga iyon ay para sa single-page na **Print PDF** path sa itaas. Dala nila ang parehong **PDF/X-4 metadata** tulad ng bawat PDF export (page boxes, XMP, document ID, isang sRGB output intent na may embedded profile), at nag-aalok sila ng **Content Credentials** (sa ibaba) - sa *Booklet* tool, naka-preselect na ang option na ito.

## Paggawa ng Maraming Bagay nang Sabay

May tatlong natatanging paraan ang Lolly para gumana sa volume, at nilulutas nila ang iba't ibang trabaho - ang batch editing ay isang first-class capability ng platform, hindi isang bagay na muling ininbento ng bawat tool:

- <!--i:document--> **Isang disenyo × isang talahanayan ng row → isang multi-page document.** Ang mga tool na may `table` input (tulad ng *Battlecards*) ay awtomatikong ginagawang page ang bawat row - i-paste ang isang talahanayan mula sa iyong spreadsheet, makakuha ng deck-sized na PDF. Ang tunay mong batch editor ay nananatiling ang spreadsheet: ayusin ang sampung row doon, i-paste ulit. Hindi kailanman namamahala ng mga page ang tool mismo.
- <!--i:layers--> **Isang disenyo × isang data file → maraming hiwalay na file.** Ang `/pro` batch grid ay kumukuha ng CSV at nagre-render ng isang export *kada row* - mga name badge, certificate, isang file bawat isa.
- <!--i:sliders--> **Maraming magkakaibang asset, na na-edit nang magkatabi.** Binubuksan ng *Multi-edit* ang ilang naka-save na session sa isang view para sa naka-coordinate na mga touch-up sa magkakaibang disenyo.

Panuntunan: mga row ng parehong disenyo na dapat nasa **isang dokumento** → isang table-driven na tool; mga row na dapat ihatid bilang **hiwalay na file** → `/pro`; **magkakaibang disenyo** na nangangailangan ng parehong ayos → multi-edit. (Isang planadong opsyon sa pag-render na "combine media" ang magkokonekta sa unang dalawa - pinagsasama ang mga export na parehong-format sa isang PDF, isang video o isang proofing contact sheet.)

## PowerPoint (PPTX)

Maaaring mag-export ng **PowerPoint deck** ang Design, Markdown Slides, Booklet, Doc Studio, Chart, at Diagrams - isang slide bawat pahina. Ang punto ay hindi isang pixel-perfect na screenshot; kundi ang pagbigay sa isang katrabaho ng deck na talagang kaya niyang **i-edit at kunan ng assets**. Kaya ang bawat pahina ay hinihiwalay sa mga native na object:

- <!--i:font--> Ang **Text** ay nagiging tunay, **naeeditang PowerPoint text boxes** - kasama ang font size, kulay, weight, italics at alignment mula sa layout - kaya puwede kang mag-ayos ng typo o mag-restyle sa PowerPoint.
- <!--i:pentool--> Ang **Vectors** (logos, icons, ang SUSE mark) ay naka-embed bilang **tunay na SVG na larawan** - nananatiling malinaw ang mga ito sa kahit anong laki, at kaya pa ng PowerPoint na *Convert to Shape* sa mga ito.
- <!--i:photos--> Ang **Images** ay dumarating sa native resolution nito bilang sarili nitong extractable na larawan (ang isang `cover`-cropped hero ay pinananatili ang buong larawan sa likod ng crop, kaya puwede mong i-reframe ito), kasama ang anumang on-image treatment (filters, blends) na naka-bake nang tapat.
- <!--i:layers--> Ang **Backgrounds, borders and rules** ay nagiging tunay na rectangle/line shapes.

![Ang export panel na napili ang PowerPoint: isang slide bawat pahina, nananatiling nae-edit ang text at mga shape](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Ang layout ay approximate sa disenyo - ang layunin ay tapat, magagamit-muling **content**, hindi isang naka-lock na screenshot. Anumang hindi kayang i-express ng walker nang native (isang kumplikadong filtered o masked region) ay naka-embed bilang larawan para walang mawala. Iisang slide size lang ang mayroon ang isang deck, kinuha mula sa unang page.

Ang PowerPoint ay isa ring paraan para **pumasok**. I-drop ang isang `.pptx` sa kahit anong upload surface at piliin ang mga slide na gusto mo - nagiging asset ang bawat isa na puwedeng ilagay, i-grade, o pagbatayan. Ang **Markdown Slides** ay sumusulat ng bagong deck mula sa Markdown (at nagbibigay ng branded na `.pptx` template), at ang **Rebrand** utility ay muling nagte-theme ng umiiral na deck sa kinaroroonan nito - theme palette, hardcoded na kulay at fonts - nang hindi ginagalaw ang mga chart, SmartArt, o animation nito, at ibinabalik ang isang `.pptx`. Tingnan ang [Mag-import ng disenyo → Mga deck at dokumento](/info/design-import.html#decks-and-documents).

## Penpot

Ang kahit anong tool na maaaring mag-export ng SVG ay maaari ring mag-export ng isang **Penpot file** (`.penpot`) - ang dokumento, handa nang patuloy na i-edit sa Penpot sa halip na tingnan lamang.

- <!--i:layout--> Mula sa **Design**, ang bawat frame ay nagiging isang Penpot **board**, dinadala ang bawat box dito bilang sarili nitong nae-edit na shape - rectangle, ellipse, text, imahe, o path - at dumarating ang resulta bilang isang magagamit-ulit na **component** sa Assets panel, handa nang i-drag palabas muli.
- <!--i:pentool--> Mula sa isang tool na ang render ay **payak na geometry** - ang mga vector tool tulad ng QR Code, Street Map, Wordmark, at Palette Lab - dinadala ang bawat path, rectangle, text run, at gradient sa parehong paraan, bilang sarili nitong nae-edit na shape.
- <!--i:font--> Mula sa isang tool na nag-la-layout ng render nito sa **HTML**, **nananatiling text ang text** - isang nae-edit na Penpot text object bawat linya, hindi isang outline at hindi isang patag na larawan. Ang isang piraso ng artwork na walang construct si Penpot para dito - isang kumplikadong ilustrasyon, isang live canvas - ay sumasakay nang mag-isa bilang isang imahe, kaya hindi nito kailanman pinapatag ang text at mga box sa paligid nito. Ang isang buong layout na hindi kayang paghiwa-hiwalayin nang tapat ni Penpot ay maaari pa ring dumating bilang isang larawan na may buong fidelity, kaya walang kahit ano ang naiiwan.
- <!--i:palette--> Ang isang kulay o font na **minamana ng isang shape mula sa isang brand token** ay nananatiling **naka-link** sa token na iyon sa file: baguhin ang token sa Tokens panel ng Penpot at muling magpi-paint nang sabay ang bawat shape na nagmana nito, habang ang isang literal na kulay na minsanan lang ginamit ay nananatili nang eksakto sa kinaroroonan nito. Ang mga kulay at typography ng brand ay dumarating din sa **Assets** panel, at ang kumpletong hanay ng design token nito sa **Tokens** panel - ang parehong DTCG token set na ginagamit ng sariling palette ng Lolly. Nagpapanatili si Penpot ng sarili nitong kopya mula roon: ang isang edit na ginawa sa Tokens panel nito ay bumabalik sa brand sa pamamagitan ng [pag-import ng Brand Studio](/info/design-import.html), hindi sa sarili nitong paraan.

| Ang ginawa mo | Sa Penpot |
|---|---|
| Text | Nae-edit na text object - ayusin ang typo o baguhin ang istilo |
| Mga shape, path, gradient, imahe | Sarili nilang nae-edit na vector shape |
| Isang kulay o font mula sa isang brand token | Isang live na token link - i-edit ang token, susunod ang bawat shape na nagmana nito |
| Ang buong disenyo | Isang magagamit-ulit na component sa Assets panel |
| Isang kumplikadong ilustrasyon o live canvas | Naka-embed nang mag-isa bilang isang imahe, hindi nagagalaw ang nae-edit na content sa paligid nito |

![Ang export panel na napili ang Penpot: ang .penpot file, at ang Send to Penpot sa tabi ng download](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Para buksan ito, simulan ang Penpot, pumili ng project at piliin ang **Import**. Kapag naka-sign in sa Penpot mula sa export panel, ginagawa ng **Send to Penpot** ang hakbang na iyon para sa iyo - pumili ng project doon at direktang pumapasok ang file dito.

## SCORM (mga course package)

Maaaring umalis ang isang Design deck bilang isang **SCORM package** - ang zip na iniimport ng isang learning management system, maging ito man ay Moodle, Canvas, Blackboard, o isang corporate LMS. Piliin ang **SCORM (LMS)** sa format picker at isusulat ng export ang:

- <!--i:layout--> **Ang mga slide**, isang imahe bawat artboard, bilang vector kung saan ito pinapayagan ng artboard, at bilang pixels lamang kung saan hindi.
- <!--i:play--> **Ang narrated na pelikula** kasama ang caption track nito - ang mga speaker note na binabasa ng isang on-device na boses, eksakto kung paano ito pinapatugtog ng [Presenting](/info/create/using.html#presenting).
- <!--i:file--> **Isang launch page** na dumadaan sa mga slide, nagpapatugtog ng pelikula, at nag-uulat ng pagkumpleto pabalik sa LMS sa pamamagitan ng SCORM 1.2 runtime, ang bersyong tinatanggap ng bawat LMS.
- <!--i:font--> Ang mga font na ginagamit ng deck, para mag-render nang pareho ang launch page kahit offline.

![Ang export panel sa isang Design deck na napili ang SCORM (LMS)](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Walang anuman sa package ang tumatawag pabalik sa server: mga file lang ito sa isang zip, at tumatakbo ito sa loob ng LMS nang walang bundler, walang CDN, at walang account. Binubuo ito ng web at desktop apps; hindi ito ginagawa ng CLI, dahil ang pagkuha ng larawan ng mga artboard at pag-encode ng pelikula ay nangangailangan ng browser.

## DXF (cut files)

Ang mga vector tool (Brand Lockup, QR Code, Street Map, Wayfinding Signage, Pose Geeko, ang mga logo lockup, Diagram Builder) ay maaaring mag-export ng **DXF** - ang AutoCAD R12 interchange format na binabasa ng mga laser cutter, vinyl plotter, at CNC/CAD software. Ang geometry ay isinusulat bilang mga outline **path sa millimeters** (pinapatag ang mga curve hanggang sa isang pinong tolerance), ang text ay naka-outline sa mga path, at ang kulay ay mina-map sa pinakamalapit na AutoCAD Color Index (na karaniwang nagtatakda ng tool/operation sa isang cutter). Line-art lang ang DXF - ang isang photographic o na-filter na rehiyon ay walang cut-path na anyo at itinatapon (nagbabala ang Lolly), kaya gamitin ang SVG/PDF kapag kailangan mong itago ang raster na content.

Ang Street Map ang pinakamalinaw na kaso: ang buong disenyo ay strokes na, kaya bawat kalsada at kanal ay nagiging cut path na walang idi-drop.

::: showcase
![Isang Street Map render ng Paris sa ink sa cream - purong line art, kaya bawat stroke ay nakakaligtas sa biyahe patungo sa isang cutter](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Mag-scroll, at bumabalik ang camera papasok sa tunay na geometry: pitong paths, walang pixels kahit saan, bawat stroke ay hairline-crisp sa kahit anong zoom. Iyon ang parehong file na binabasa ng isang cutter.
:::

## Animated SVG

Ang mga motion tool (Animated Ad, Lottie Ad) ay kayang mag-export ng **Animated SVG** - isang self-contained, *vector* na animation. Kaiba sa GIF/APNG/WebP (na nagsa-sample ng bawat frame sa pixels), ang isang animated SVG ay nagtatambak ng vector snapshots na may embedded CSS keyframes, kaya ito ay **sumusukat sa kahit anong laki na walang codec at walang external runtime** - umuulit ito sa isang browser tab o sa isang `<img>`. Nananatiling naka-outline ang text para mag-render ito kahit saan. Nagbabahagi ito ng **Duration** / frame-rate controls ng mga animated format, at (dahil mas mabigat kada frame kaysa sa isang bitmap) gumagamit ito ng mas mababang default na frame rate.

## Transparency

Ang mga tool na sumusuporta nito ay nag-aalok ng **transparent background** toggle (hal. *No BG*). Napapanatili ang transparency ng PNG, WebP, AVIF, SVG (still at animated), APNG at Animated WebP. Ang JPG at PDF ay laging opaque, at ang TIFF ay flina-flatten papunta sa white (papunta sa black sa HDR path - tingnan sa ibaba).

## Colour spaces

Dalawang magkaibang tanong, worth na panatilihing hiwalay: aling mga colour space ang kaya ng Lolly na **basahin at isipin**, at alin ang kaya nitong **isulat**.

**Pagbabasa.** Saan man isinusulat ang isang kulay - stylesheet ng isang tool, paint ng isang imported SVG, value ng isang design token, isang shadow o gradient sa loob ng isang CSS shorthand - binabasa ng Lolly ang buong bokabularyo ng **CSS Color 4**: `#hex`, `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, ang mga named colour ng CSS at `color()` sa mga predefined space - `srgb`, `srgb-linear`, `display-p3`, `a98-rgb`, `prophoto-rgb`, `rec2020`, `xyz-d50`, `xyz-d65` - kasama ang mga component na isinulat bilang `none` keyword. Iisang parser ang gumagawa nito para sa buong platform, kaya sumasang-ayon ang browser at bawat export walker kung ano ang ibig sabihin ng isang colour string.

Mas mahalaga iyon kaysa sa tunog nito, dahil ang isang browser ay nagre-resolve ng modernong CSS papunta sa modernong CSS. Isulat ang `color-mix(in oklab, …)` at kina-compute ng Chrome ang `oklab(…)`; gamitin ang isang brand token na naka-imbak bilang `oklch()` at iyon ang literal na value na nakikita ng export walker. Ang mga kulay sa mga anyong iyon ay binabasa nang tama sa halip na dina-drop - na siyang nangyari sa isang walker na naiintindihan lang ang `rgb()`, na nagexe-export ng brand-coloured na text bilang black, nawawala ang tinted panels at table rules at binabasa ang `oklch(0.7 0.1 200) 0px 2px 4px` bilang isang shadow offset na 0.7 by 0.1.

**Pag-iisip.** Ang matematika ng kulay ay nangyayari nang perceptually sa halip na sa raw na mga channel. Ang paghango ng palette, ramp, harmony, at contrast ay tumatakbo sa **OKLCH/OKLab**, at ang isang kulay na labas sa gamut ay dinadala pabalik sa saklaw ng sariling gamut-mapping algorithm ng CSS Color 4 - pagbawas ng chroma kasabay ng pagsusuri ng perceptual-distance - sa halip na pag-clip ng mga channel, kaya ang isang matingkad na kulay ay huhusto sa pinakamalapit na kulay na talagang tatanggapin mo sa halip na isang pinatag na kulay. Ang mga gradient ay nag-i-interpolate sa isang espasyong pinipili mo (OKLab bilang default, o `oklch`, `lab`, `lch`, `srgb`, `srgb-linear`, `hsl`, may direksyon ng hue-travel para sa mga polar na uri), at ang paghahalo ay **premultiplied**, kaya ang isang fade papuntang transparent ay nananatili sa tamang kulay sa halip na dumidilim papuntang itim sa daan. Isang interpolator ang naglilingkod sa parehong preview at export walker - iyon ang dahilan kung bakit hindi na naiiba ang paghahalo ng isang conic gradient sa screen kumpara sa na-export na file.

**Pagsulat.** Ang output ay sadyang mas makitid kaysa sa input, dahil ang isang file ay kailangang mabasa ng kahit anong bumubukas nito, at ang isang space ay *idi-declare* lang sa output kapag talagang na-convert ang mga numero papunta rito. Ang screen at web formats ay isinusulat bilang **sRGB** at naka-tag bilang ganoon; ang print formats ay isinusulat bilang **CMYK** laban sa isang pinangalanang press condition (sa ibaba); at ang HDR path ay **Rec.2100 PQ** (sa itaas). Ang isang wide-gamut na kulay na umaabot sa isang export ay naka-map papunta sa sRGB sa halip na mali ang pagkakalagay ng label - ang pagdadala ng `color(display-p3 …)` papasok sa isang vector file ay isang planong extension, hindi bagay na inaangkin ng mga export ngayon na kaya nila. Ang isang gradient na na-author sa OKLab ay *naka-bake* papunta sa plain sRGB stops sa daan palabas, na may extra stops na naka-insert lang kung saan halatang lalayo ang sRGB mula sa perceptual curve, dahil ang isang SVG `<linearGradient>` at isang PDF axial shading ay walang interpolation-space setting para dalhin ang intent. Iisang na-author na value, tatlong renderer, walang drift.

## Colour profiles

Para tapat na mag-reproduce ang mga kulay sa colour-managed apps (print shops, Photoshop, browsers), ang mga export ay **naka-tag ng colour profile**:

- Ang **PNG / JPG** ay may embedded **sRGB** ICC profile - ang colour space kung saan talagang na-render ang preview - kaya walang naiiwan na hulaan. (Tagging lang; hindi na-re-encode ang mga pixel.)
- Ang **Print PDF (CMYK)** ay nagde-declare ng isang target na **press condition** sa *OutputIntent* nito (default *Coated FOGRA39*), na nagsasabi sa isang RIP/print shop kung paano dapat basahin ang mga CMYK ink nito. Ang mga brand swatch na may measured ink values ay eksaktong nako-convert; ang ibang kulay ay gumagamit ng standard device conversion. Ang deklarasyong iyon ay isang *pangalan*: walang CMYK profile na kasama sa Lolly, at gusto ng PDF/X-4 na naka-embed ang profile, kaya isang named condition ay isinusulat ang output intent nang hindi inaangkin ang PDF/X-4 conformance. Mag-load ng sarili mong CMYK profile at piliin ang **Embed** row nito sa Colour profile control at ito ay naka-embed bilang *DestOutputProfile* ng file - sa puntong iyon, ang PDF ay maaaring tunay na maging PDF/X-4, at inaangkin ito kapag pinapayagan ito ng natitirang bahagi ng file. Tatlong bagay ang pumipigil sa claim habang pinapanatili ang output intent (gusto pa rin iyon ng RIP): RGB artwork na hindi na-convert ng CMYK pass, ang `prov` proof-margin credit text (naguhit sa isang standard font na hindi naka-embed, at walang exception ang X-4 para sa mga iyon) at ang isang **Strong** password, dahil ipinagbabawal ng X-4 ang encryption. Ang condition na idi-declare nito ay binabasa mula sa profile na iyon: isang registered name kung saan pinatutunayan ito ng profile, `Custom` sa ilalim ng sariling pangalan ng profile kung hindi, para hindi kailanman mapangalanan ng file ang isang press condition habang dala nito ang measurements ng iba.
- Ang **Print TIFF (CMYK)** ay nagsusulat ng untagged **DeviceCMYK** pixels at itinatala ang parehong press condition bilang provenance sa TIFF metadata nito (*ImageDescription*) sa halip na mag-embed ng profile. Ang parehong Colour-profile control ay nagpapatakbo sa dalawang CMYK format - hindi talaga makaka-embed ang isang TIFF ng press profile, kaya ang isang **Embed** row ay itinatala ang sariling pangalan ng profile na iyon doon at wala nang iba.
- Ang **TIFF (RGB)** ay ang plain, uncompressed na sRGB sibling - isang lossless raster sa piniling DPI para sa archival o editor round-trip, na may provenance na itinatala sa parehong TIFF metadata. Anumang transparency ay flina-flatten papunta sa white (walang alpha ang profile na ito). Tulad ng CMYK TIFF, desktop-only ito, dahil hindi kayang i-preview ng mga browser ang isang TIFF at nagde-dead-end ang mobile downloads.
- Ang **SVG**, **EMF**, **EPS** at **DXF** ay resolution- at profile-independent na vectors na walang embedded profile - ang mga kulay ng SVG ay plain sRGB, ang sa EMF at EPS ay device RGB (at ang **EPS (CMYK)** ay nagsusulat ng naive DeviceCMYK) at ang **DXF** ay may dala ng pinakamalapit na AutoCAD Color Index. (Ang SVG, EPS at DXF, tulad ng PDF, ay naka-outline ng anumang text papunta sa vector paths, kaya ang resulta ay nag-re-render kahit saan hindi naka-install ang font. Ang EMF sa halip ay pinapanatiling LIVE ang text bilang default - tunay na metafile text records na nananatiling selectable at naeedit sa Office at Google Slides, bumabagsak papunta sa outlines lang para sa mga run na hindi kayang i-express ng format; pinipilit ng "Outline fonts" option ng export panel ang paths kahit saan.) Ang **SVG** ay muling gumagawa rin ng CSS `box-shadow` mula sa HTML - bawat outer shadow ay iginuhit sa likod ng box, offset/spread at Gaussian-blurred para tumugma sa browser, at ang mga inset shadow ay iginuhit sa loob nito sa parehong paraan.

Ito ay automatic - walang setting na kailangang i-adjust. Ang mga thumbnail at preview ay lumalaktaw sa tag para manatiling maliit. Isang profile *ay* isang pagpili, dahil binabago nito ang mga pixel sa halip na maglagay lang ng label - tingnan ang **HDR** sa ibaba.

## HDR (bright colours)

Ang mga ordinaryong export ay sRGB: ang white ay white, at ang isang saturated na brand colour ay kasing liwanag ng normal na white ng screen. Sa isang HDR-capable display, maraming headroom sa itaas niyan, at ginagamit ito ng **HDR** card sa export panel - ang mga brand colour mo at white text ay na-boost papunta sa peak brightness kaya talagang *nag-gglow* ang mga ito, habang nananatiling madilim ang mga dark area at binibigyan nito ng contrast ang glow.

![Ang HDR card sa export panel, naka-on, na may White / Reach / Dark lift / Focus dials na nakalantad sa ilalim nito](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Mga Format.** Ang mga raster na format na may paraan para dalhin ang signal: **PNG**, **JPG**, **AVIF**, at **TIFF**. (Hindi ang WebP - 8-bit ito at walang gumaganang HDR decode path, kaya ang isang PQ WebP ay basta na lang magmumukhang madilim. Walang anumang HDR model ang mga vector at PDF.)
- **Naka-off bilang default**, hindi tulad ng colour tagging - binabago nito ang mga pixel, kaya opt-in ito. I-tick ang card, o ipasa ang `hdr=1` sa isang share link.
- **Ang aktwal na naisusulat.** Muling ini-encode ang mga pixel sa **Rec.2100 PQ** - BT.2020 primaries na may SMPTE ST 2084 (PQ) transfer curve - at dinadala ng container ang katugmang signal para malaman ng isang colour-managed na app na basahin ito nang ganoon: isang binuong **ICC v4 profile na may `cicp` tag** (JPG, TIFF), isang **`cICP` chunk** (PNG), o isang muling isinulat na `colr` box (AVIF). Ang boost ay nakabatay sa **perceptual (OKLab) lightness**, kaya tumatama sa peak ang mid-and-above na mga kulay habang pinapakalma - hindi pinapasabog - ang mga madilim, at hue-preserving ito - nagiging mas maliwanag ang isang brand green, hindi minty.
- **Ang mga dial.** Apat, ipinapakita kapag naka-on ang card: **White** (ang peak-brightness ceiling, 400–2000 nits), **Reach** (gaano kalayo pababa sa mga tono kumakalat ang glow), **Dark lift** (gaano kaliwanag magiging ang mga madilim - pinananatili silang madilim ng `0`), at **Focus** (gaano karaming yaman ng kulay ang pinapanatili ng boost). Sumasakay sila sa parehong param bilang isang compact na naka-tune na value - ang `hdr=1600-60-0-50` ay White 1600, Reach 60, Dark lift 0, Focus 50 - kaya ang isang naka-tune na hitsura ay mare-reproduce mula sa link.
- **Saan mo ito makikita.** Sa mga colour-managed na viewer sa isang HDR display: Preview / Quick Look / Safari sa mga Apple device, Chrome sa isang HDR monitor. Sa isang ordinaryong SDR screen, lumalabas pa rin ang file bilang isang normal na imahe.
- **Alamin bago mo ito ilabas.** Maraming platform ang **muling nag-e-encode** ng iniupload mo at tinatanggal ang HDR signal - social network, messaging app, ilang CMS - na maaaring magpamukha sa imahe na madilim o washed out. Gamitin ang HDR kung saan mo kontrolado ang destinasyon (isang site na binuo mo, isang video wall, isang deck sa isang maliwanag na panel), hindi bilang default para sa lahat.
- **Transparency.** Pinapanatili ng PNG at AVIF ang alpha nila; opaque naman ang JPG gaya ng dati. Ang **TIFF** path ay pumapatag papunta sa **itim**, hindi sa puti ng SDR path - sa PQ, ang puti ay ang 10,000-nit code, kaya ang pagpapatag papunta dito ay magpapalibot sa bawat gilid ng isang nakakasilaw na halo.
- **Parehong bytes mula sa terminal.** Isinusulat din ng `--hdr=1` kasama ang `--export=png` o `--export=jpg` ang 16-bit na Rec.2100 PQ PNG at ang ISO 21496-1 na gain-map JPEG sa [CLI](/info/cli.html), mula sa parehong engine encoders sa halip na isang browser - kaya ang isang `<svg>`-native na tool ay gumagawa ng HDR file na walang Chromium kahit saan sa landas, at ang PNG ay byte-identical sa sa web shell. Nananatiling web-shell exports muna ang AVIF at TIFF.

## Video

Ang mga animated tool ay nag-e-export ng motion bilang **MP4**, **WebM** o **GIF** - at, kung saan inaalok, **APNG**, **Animated WebP** o ang vector na **Animated SVG** (sa itaas). Ang video container na makikita mo ay depende sa browser mo - ipinapakita lang ng picker kung ano ang talagang kaya nitong i-record:

| Browser | Ipinapakita |
|---|---|
| Safari / iOS | **MP4** |
| Firefox | **WebM** |
| Chrome / Edge 126+ / Android | **MP4 at WebM** |
| Mas lumang Chrome | **WebM** |

Gumagana ang GIF kahit saan (mainam para sa chat/email; mas malaki at mas mababa sa kulay kaysa sa video). Ang mga animated tool ay naglalantad din ng **Wait** (segundo para hayaang mag-settle ang animation bago mag-record) at **Duration** (haba ng clip).

> Ang isang shared na `?format=…` link na humihiling ng container na hindi kayang i-record ng browser mo ay maayos na bumabagsak papunta sa isa pa at pinapangalanan ang file nang naaayon.

**Sound.** Hindi tahimik ang mga video export. Ang isang tool ay kayang maglagay ng **music bed** sa ilalim ng clip - isang audio asset mula sa catalogue, naka-loop o naka-trim sa haba ng clip, na may fade-in/out, volume at automatic ducking sa ilalim ng sariling tunog ng footage - at ang mga recording tool ay dinadala nang diretso ang live audio ng footage nila papunta sa file. Pinananatili ng **MP4** at **WebM** ang mixed track; tahimik sa likas ang GIF at ang mga animated image format (APNG, Animated WebP, Animated SVG).

## Audio

Ang ilang tool ay nag-e-export ng **audio nang mag-isa**, hindi lang bilang video track. Kinukuha ng **Voice Recorder** ang isang mic take na may live level meter at magiliw na coaching, pagkatapos ay ini-save ito bilang **MP3** (ang default, na naka-transcode sa browser mo) o sa native container nito - **M4A** (AAC), **OGG** o **WebM** (Opus), kahit alin ang na-record ng browser mo. Tulad ng lahat, ang encode ay nangyayari sa device mo - walang ini-upload.

Kasingsaklaw din ang audio na *dinadala mo papasok*. Tinatanggap ng asset picker ang **MP3**, **WAV**, **OGG**/**Opus**, **M4A**/**AAC** at **FLAC** (pinananatiling byte-for-byte at na-decode on-device), **MIDI** (`.mid` - na-convert sa import papunta sa isang maliit na on-device synth track) at **tracker modules** - **MOD**, **XM**, **IT**, **S3M**, **STM**, **MTM** (na-decode on-device ng isang kasamang player, ilang kilobytes lang ng song data). Ang alinman sa mga ito ay puwedeng maging **music bed** sa ilalim ng isang video export, o tumugtog sa ambient player ng Neurospicy Mode.

Ang audio ay *bahagi* ng `format=` / `--export=` pipeline sa ibaba: ang `wav`, `mp3`, `m4a` at `opus` ay ordinaryong format ids, kaya ang isang audio-only na export ay kasing-shareable at kasing-scriptable ng isang PNG. Ang lumalabas ay ang tunog lang, walang larawan.

## Provenance & watermark

Kung saan sinusuportahan ito ng format, ang mga export ay may dalang **provenance metadata** - software, source, pangalan ng tool at credit line ng profile mo - naka-embed nang native (PNG iTXt, JPEG EXIF, PDF info, SVG `<metadata>`, GIF comment). Authorship lang ito; walang ini-upload. Ang mga **Experimental** na tool ay dagdag pang nagtatatak ng nakikitang watermark, na inilalapat ng host kaya hindi ito matatanggal sa pamamagitan ng pag-edit ng tool.

**Ang Lolly Imprint.** Ang mga raster export ay may dala rin ng sariling **invisible pixel watermark** ng Lolly - ang *Lolly Imprint* - **naka-on bilang default**, tulad ng Content Credentials. Kung saan ang credential at ang provenance metadata ay naglalakbay *kasabay* ng mga pixel at nawawala sa isang re-save, isang screenshot o isang metadata strip, ang Imprint ay nakatira *sa loob* ng mga pixel at nakakaligtas sa recompression - kaya ang isang kopya ng larawan ay makikilala pa rin bilang Lolly-made mamaya. Isa itong matibay na palatandaan, hindi isang cryptographic guarantee, at presence-only ito (walang dalang personal na data). Sumasakay ito sa **PNG, JPG, WebP, AVIF, TIFF at BMP**, at sa mga Lolly-rendered na raster na kinompose papunta sa isang **PDF o PPTX** - hindi kailanman sa isang larawan na *ikaw* ang nag-embed, tanging sa kung ano ang talagang inire-render ng Lolly mismo. I-uncheck ang **Lolly Imprint** card sa export panel para laktawan ito, o ipasa ang `imprint=0` sa isang share link. (Hindi pa naka-calibrate ang survival ng AVIF sa re-encoding; ang detection ng PDF/PPTX ay sumasaklaw sa mga embedded na raster ng Lolly.) Dine-detect ito ng [/verify](/verify) on-device - tingnan ang [Content Credentials Identity](/info/content-credentials-identity.html#the-lolly-imprint).

**Ang durable credential.** May pangalawang, mas mabigat na marka sa tabi ng Imprint: **Durable credential**, na gumagamit ng on-device neural model (TrustMark format) para isulat ang id ng Lolly *papasok* sa mga pixel kaya ang "made with Lolly" link ay nakakaligtas sa isang metadata strip, isang re-encode at muling pagbasa ng mga TrustMark-aware na tool pati na ng sarili ng Lolly. **Naka-off ito bilang default** - di tulad ng pure-JavaScript na Imprint, may gastos itong isang neural pass kada export kasama ang isang one-time model download, kaya ito ay isang sadyang opt-in sa halip na isang tahimik na buwis. Raster lang (**PNG, JPG, WebP, AVIF, TIFF**), naka-check sa export panel o ipinapasa bilang `durable=1` sa isang share link. Sa desktop at mobile apps, ang card ay itinatago nang tuluyan sa halip na ipakita bilang isang no-op, dahil walang origin kung saan kukunin ang model nang offline.

**Content protection.** Sa export panel, ang *Password protect*, **C2PA Credentials**, ang **Lolly Imprint** at ang **Durable credential** ay tumitiklop papunta sa isang naka-collapse, format-aware na grupong **Content protection**, kaya ang provenance at protection options ng isang file ay nakatira sa isang lugar - ipinapakita lang ng grupo ang mga card na aplikable, at itinatago mismo ang sarili nang tuluyan kapag wala sa mga ito ang aplikable. Ang mga print mark ay sadyang *hindi* kasama rito: sila ay print production geometry sa halip na protection, kaya ang **Print marks & bleed** - ang bleed measurement sa millimetres kasama ang Crop, Registration, Bleed, Colour bars at Stamp details - ay pinananatili ang sarili nitong top-level na card sa mga print format.

![Ang Content protection group na nakabukas sa isang PNG export, na nagpapakita lang ng mga card na aplikable dito](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

**Bago mag-export (print preflight).** I-on ang **Print preflight** (`export-preflight`) sa mga feature flag ng Profile mo - **naka-off ito bilang default**, kaya ang isang indibidwal na nag-e-export ng PNG para sa isang chat message ay hindi kailanman biglang aatakihin ng mga natuklasan sa prepress, at ang isang deployment's control plane ([lolly.work](https://lolly.work)) ay puwedeng i-default itong naka-on para sa mga miyembro nito - at ang isang **Before you export** card ay lumalabas sa ibaba ng panel, direktang sa itaas ng mga button, sa tuwing may totoong sasabihin ang mga print rule tungkol sa trabaho: format, laki at bleed, pagkatapos ay trim at bleed areas, ink coverage, plate counts at page count, na may verdict sa tabi ng heading nito. Nakaupo ito sa ilalim ng bawat setting dahil ito ay isang pahayag *tungkol* sa mga setting na iyon sa halip na isa pa sa mga ito - at hindi ito kailanman humaharang sa isang export. Sinasabi nito sa iyo kung ano ang malapit nang makita ng isang print shop.

**Cost, na kinuha mula sa rate card mo.** Sa ibaba ng preflight - huli sa lahat, nasa itaas pa rin ng mga button - may isang card na ginagawang pera ang parehong mga bilang, at galing lang laging sa mga presyong binigay ng isang tao rito. Binabasa nito kung ano man ang binilang ng preflight pass, kahit naka-on man o hindi ang preflight card mismo, at kailangan nito na totoo ang dalawang bagay: may kayang presyuhan ng price list ang trabaho (plates, sheets, area, pages, variant rows o output files - kaya hindi ito kailanman lalabas sa isang plain logo PNG), **at** may naroroong **rate card**. Ang rate card ay isang JSON price list mula sa printer mo. Ang isang default build ay walang dala nito at walang paraan sa-app para mag-load ng isa: dumarating ito bilang isang catalogue asset na ibinibigay ng isang deployment, o sa pamamagitan ng opsyonal na rate-card extension na sina-switch on ng isang self-hoster o control plane. Kung walang rate card, walang ipinapakita - hindi isang prompt, hindi isang walang laman na table.

Ang panuntunan kung saan itinayo ang buong bagay ay hindi ito kailanman **gumagawa ng pera**. Bawat figure ay isang rate na ibinigay mo na pinarami sa isang quantity na binilang ng Lolly - `4 plate × €35.00` - at ang total ay pinapangalanan ang sarili nitong source sa parehong pangungusap ng figure: ang issuer na pinapangalanan ng card, at ang petsa na sinasabi ng card kung saan galing ang mga rate nito. Walang default na currency, walang placeholder at walang zero na tumatayo bilang kapalit ng nawawalang presyo. Ang sinasabi ng file tungkol sa sarili nito ay nananatiling reported speech: *"Sinasabi ng file: … Hindi pa ito na-verify ng Lolly."*

At kapag hindi ito makapag-compute nang tapat, ang working table ay **naglalaho** sa halip na bumagsak papunta sa isang greyed-out o filled-in na figure:

- Ang mga linyang hindi pineprisyuhan ng card ay nangangahulugang **walang total kahit anong** - headline lang na nagsasabi kung ilan sa mga ito ang unpriced. Ang isang partial sum ay hindi isang mas maliit na sagot, mali ito.
- Ang isang quantity na isang ceiling sa halip na eksaktong bilang ay may dalang **"up to"** hanggang sa subtotal nito, kaya ang isang bound ay hindi kailanman malalaundry papunta sa isang flat na figure.
- Ang mga rate na lampas na sa valid-until date nito ay nagpapakita ng **counts lang**, hanggang sa pindutin mo ang *Use these rates anyway* - at pagkatapos ay sumasakay ang expiry date kasama ng figure, kaya ang isang lapsed na total ay hindi mababasa bilang current.
- Binuksan sa pamamagitan ng isang **link**, nananatiling nakatago ang pera hanggang sa hilingin mo ito sa device na ito. Ni ang card ni ang reveal na iyon ay hindi kailanman naglalakbay sa isang URL - ang parehong dahilan kung bakit tinatanggap ng CLI ang `--rate-card=<file.json>` bilang isang local file flag at hindi kailanman bilang link param.

Ang card ay chrome, hindi kailanman content: tinatanggal ito sa bawat export stage, kaya hindi nito magagalaw ang kahit isang pixel ng file na ida-download mo. At ito ay arithmetic, hindi isang quote - ang printer mo lang ang makakapagbigay sa iyo ng isa.

**Composed renders.** Kapag ang isang tool ay nag-e-embed ng output ng isa pang tool (hal. isang *Event Name Badge* na nag-e-embed ng isang *QR Code*), ang nested render ay naka-inline papunta sa export ng parent - nananatili itong **tunay na vector** sa SVG at PDF at nagre-rasterize nang malinaw sa PNG/JPG/WebP. Ang embedded na anak ay isang intermediate: **walang** watermark at **walang** sariling provenance ito; ang natapos na parent asset lang ang mayroon. (Ang composition ay sumasaklaw sa SVG at sa mga raster format; hindi makokompose ang HTML/MD/TXT.)

## Password protection

Dalawang independiyenteng uri ng lock, parehong ganap na on-device.

**PDF open-password** - nag-aalok ng dalawang tier ang *Password protect* card ng export panel:

![Ang Password protect card na naka-expand sa isang PDF export, kasama ang password field at ang dalawang lock tier](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

- **Standard** - isang basic 40-bit lock (RC4). Nabubuksan ito sa *anumang* PDF app, at - dahil ito ay isang magaan na deterrent lang, hindi tunay na proteksyon - maaari itong sumama sa isang share link (clear-text, sadyang ganito). RGB `pdf` lang.
- **Strong** - AES-256 (PDF 2.0). Ini-type ang password nito sa oras ng export at **hindi kailanman** inilalagay sa isang link; nabubuksan lang ito sa mas bagong mga PDF app (Acrobat / Preview ~2018 pataas), at maaaring i-report ng mas lumang mga app na sira ang file. Nalalapat din ang Strong sa **Print / CMYK PDFs** at sa **bawat PDF sa loob ng isang batch zip** (kinokolekta ng batch confirm dialog ang password). Dahil ipinagbabawal ng PDF/X-4 ang encryption, ang isang Strong-locked na Print PDF ay pananatilihin ang CMYK, marks at output-intent nito ngunit itatapon ang PDF/X-4 conformance claim.

Ang alinmang tier ay mutually exclusive sa Content Credentials (hindi maaaring magkaroon ng credential ang isang naka-encrypt na PDF).

**Locked downloads (whole-zip + defense-in-depth)** - ang isang **ZIP** export (ang *ZIP* format ng export panel, na nagbu-bundle ng ilan sa mga format ng isang tool), isang **folder** download (Projects → Download), o ang **batch grid** ay maaaring i-lock ang buong zip gamit ang isang password, sa dalawang tier:

- **Standard** - tradisyonal na **ZipCrypto**: nabubuksan sa *anumang* unzip tool kabilang ang built-in extract ng Windows Explorer, ngunit mahina (isang deterrent). Maaaring sumama ang password nito sa isang `?password=` share link.
- **Strong** - **AES-256** (WinZip AE-2): malakas, ngunit **hindi** nabubuksan sa built-in extract ng Windows Explorer - kailangan ng tatanggap ng 7-Zip / WinZip / Keka / macOS. Ini-type sa oras ng export, hindi kailanman inilalagay sa isang link.

Ang parehong *Password protect* card sa export panel ang nagpapatakbo sa PDF at ZIP lock, at binabago nito ang sarili nitong pananalita depende sa napiling format. Ang isang password ay pumoprotekta sa **bawat** miyembro - mga imahe, SVG, lahat, kasama ang mga PDF (ang zip container lang ang makakaproteksyon sa mga non-PDF na file, na walang sariling lock). At ito ay **defense-in-depth**: anumang PDF sa loob ay *isa ring* indibidwal na naka-AES-256-lock gamit ang parehong password, kaya nananatiling naka-lock ang isang PDF kahit matapos i-unpack ang zip. Lumalabas ang prompt kapag sinimulan mo ang download; ang blangkong password ay nangangahulugang walang lock.

**Password-gated share links** - ang anumang share link ay maaaring i-encrypt para hingin sa tatanggap ang isang password kapag binuksan ito. Ang buong link state ay AES-256-encrypted gamit ang isang key na hinango mula sa password (PBKDF2); ciphertext lang ang naglalakbay, kaya **hindi kailanman nasa link ang password** at nangyayari ang decryption **sa browser ng tatanggap** - nakikita lang ng server na naghahatid ng link ang ciphertext sa URL, hindi kailanman ang password at hindi kailanman ang na-decrypt na disenyo. I-on ito sa **Share** dialog. Ang isang naka-encrypt na link ay maaari lang *buksan* sa Lolly (hindi ito puwedeng i-embed bilang imahe, dahil hindi maaaring mag-prompt ang landas na iyon). Tingnan ang [URL Mode → Encrypted links](/info/url-mode.html).

## Content Credentials (C2PA)

Maaaring magdala ang mga export ng **Content Credentials** - isang naka-sign na [C2PA](https://c2pa.org) manifest na naka-embed sa file na nagtatala, sa paraang tamper-evident, na ginawa ang file gamit ang Lolly at hindi ito nabago mula noon. Ito ang standards-track na bersyon ng provenance metadata sa itaas: isang cryptographic claim (kung ano ang gumawa ng file, kailan, ng kanino at saan) na nakatali sa isang hash ng mga byte ng file, kaya ang anumang susunod na pag-edit ay madedetect ng isang C2PA-aware na viewer. Ang standard ay pinamamahalaan ng [Content Authenticity Initiative](https://contentauthenticity.org) (Adobe, BBC, Microsoft, Nikon at iba pa), kaya ang mga credential na sinusulat ng Lolly ay ang mismong mga credential na inaadapt ng mga camera, newsroom at creative suite.

![Ang C2PA Credentials card, naka-pre-tick na, kasama ang credential lifetime sa tabi nito](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Mga Format.** Bawat container na may C2PA embedding: **PDF** (RGB at Print), **PNG / Animated PNG**, **JPG**, **GIF**, **SVG**, **TIFF** (RGB at Print), **WebP** (still at animated), **AVIF**, **MP4**, **WebM** at ang mga audio container na **MP3**, **WAV**, **M4A** at **OGG/Opus** - kaya ang isang na-record o synthesized na voice clip ay naghahatid ng parehong credential na taglay ng isang larawan. Ang isang **ZIP** bundle ay nag-i-stamp sa bawat suportadong miyembro nang isa-isa, na siya ring pinagmumulan ng credential ng isang **Animated SVG** (ordinaryong SVG document lang ito sa ilalim; walang sariling card ang isang direktang Animated SVG export). Ginagamit ng MP4, AVIF at M4A ang BMFF binding ng spec at ng MP3 ang ID3v2 mapping nito, kaya vine-verify sila ng `c2patool` at ng iba pang C2PA-aware na viewer; ang **WebM** at **OGG/Opus** ay wala pang standardized na C2PA mapping, kaya dinadala ng Lolly ang manifest bilang isang Matroska attachment at isang OpusTags field ayon sa pagkakabanggit, na sinusuri ng sariling verifier (at CLI) ng Lolly. (`ico`, `eps`, `emf`, `dxf`, `bmp`, `pptx`, ang mga Office format at ang mga text/data format ay walang C2PA container.)
- **Naka-on bilang default.** Ang **C2PA Credentials** card sa export panel ay pre-selected na para sa halos lahat ng tool - alisan ito ng tsek para laktawan ang credential sa isang solong export (o ipasa ang `c2pa=off` sa isang share link). Ang isang tool ay maaaring mag-opt out nang buo sa manifest nito.
- **Ang itinatala nito.** Ang tool at app na gumawa ng file, ang oras ng pag-sign, ang export surface (browser engine family + OS family - sadyang coarse, hindi kailanman isang fingerprint) at - kapag naka-on lang ang *Profile → Use my details* - ang iyong pangalan at email bilang may-akda ng gawa.
- **Ang nakikita ng mga tatanggap.** Babasahin ng mga tool na nag-iinspect ng content credentials (mga Adobe app, `c2patool`, contentcredentials.org/verify) ang manifest at ipapakita ang claim. Dahil nag-sa-sign ang Lolly gamit ang isang key na nabuo **sa iyong device** - hindi isang certificate mula sa isang trust list - iri-report ito ng mga viewer bilang isang *unverified* na credential. Tunay ang structure at ang tamper-evidence; ang pagkakakilanlan lang ng signer ang hindi binabatikos ng isang awtoridad. Para i-upgrade ito, maaari kang mag-enrol ng isang **verified identity** (Profile → Content Credentials): itinatali ng isang short-lived na certificate mula sa Lolly CA ang iyong email sa iyong mga export habang ang signing key ay hindi pa rin kailanman umaalis sa iyong device - tingnan ang [Content Credentials Identity](/info/content-credentials-identity.html).
- **Pagsuri sa isang file.** Vine-verify rin ng Lolly ang sarili nitong mga credential: i-drop ang anumang file sa [/verify](/verify) (o patakbuhin ang `lolly validate <file>` sa CLI) para sa isang on-device na report - na nangunguna sa kung tunay bang ginawa ang file gamit ang Lolly at hindi nabago mula noon. Ang web Verify view ay nagbabasa nang lampas pa sa credential: nagfa-flag ito ng **AI-generated content**, nagde-detect ng **Lolly Imprint**, sumusuri ng **SEAL** signatures at (opt-in) third-party pixel watermark at nagpapakita ng **hidden data** - lahat on-device, walang ina-upload. Tingnan ang [Content Credentials Identity → Beyond the credential](/info/content-credentials-identity.html#beyond-the-credential-what-else-verify-shows).
- **Privacy.** Nangyayari ang lahat sa iyong device: nililikha ang signing key para sa export at hindi ito kailanman umaalis sa browser, walang ina-upload at ang claim ay naglalaman lang ng taglay na ng provenance metadata. Hindi kailanman nagdaragdag ng credential ang mga privacy utility (on-device na mga transformation ng *sarili mong* mga file), at aalisin ng *Strip Hidden Data* ang isang C2PA manifest tulad ng anumang ibang naka-embed na metadata.
- **Mga Interaksyon.** Para sa mga PDF, ang Content Credentials at ang **password protection** (alinmang tier - tingnan sa itaas) ay mutually exclusive (hindi maaaring magkaroon ng credential attachment ang isang naka-encrypt na PDF). Idinaragdag ang credential bilang huling hakbang sa mga natapos na byte - pagkatapos ng DPI/EXIF/colour-profile stamping, PDF/X metadata at print marks.

## Sa telepono

Nasa likod ng lumulutang na **Render** button ang mga export control, na nagbubukas ng **Export** sheet - parehong mga format, sukat, copy, download at share, na naka-size para sa touch.

## Sanggunian ng Format

Bawat id na kayang i-render ng host, pinangkat. Ito rin ang mga value para sa URL `format=` parameter at ang CLI `--export=` flag - tingnan ang [URL Mode](/info/url-mode.html) at [CLI](/info/cli.html). Nag-aalok lang ang isang tool ng subset na idineklara ng may-akda nito, kaya palaging mas maikli ang picker kaysa sa listahang ito.

| Uri | Mga Id |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vector | `svg` · `svgz` (naka-gzip na SVG) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (cut file) |
| Pahina at dokumento | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `scorm` (SCORM course package, isang zip) · `penpot` (Penpot design file) · `docx` (Word) · `odt` (OpenDocument Text) |
| Motion | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` |
| Audio | `wav` · `mp3` · `m4a` · `opus` |
| Text at data | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `css` · `scss` · `gpl` (GIMP palette) |
| Bundle | `zip` |

May ilang karagdagang id na nanggagaling sa **sariling export hook ng isang tool** sa halip na sa shared render path: `ase` (Adobe Swatch Exchange, mula sa Palette Lab), `exr` at `hdr` (mga high-dynamic-range raster ng Darkroom) at `ttf` / `otf` / `woff` (Font Convert). Pumipili sila ng format sa parehong paraan - ang picker, `format=`, `--export=` - ginagawa lang ang mga byte ng tool. Ang Font Convert ang tanging eksepsiyon: binabago nito ang isang font file na ibinibigay *mo*, kaya walang mai-render ang isang plain na URL.
