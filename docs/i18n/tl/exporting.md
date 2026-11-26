# Mag-export ng file

Pindutin ang **Export**, ang kaliwang kalahati ng **Export | Save** pill, pumili ng format sa tabi ng pangalan ng file at pindutin ang **Download**. Sa device mo ginagawa ang file.

Laman ng file ang nakikita mo sa canvas. Ang kaya lang gawin ng tool na ito sa browser na ito ang inililista ng format menu.

Isa sa tatlong format ang kailangan ng karamihan ng gawain:

| Para sa | Piliin | Dahil |
|---|---|---|
| Screen, mensahe o slide | **PNG** | Nabubuksan ito ng bawat app, at napapanatili nito ang transparent na background kapag may ganoong opsyon ang tool |
| Tapos na page, o anumang ipi-print | **PDF** | Totoong laki ng page na nai-print ayon sa nakikita; ang **Print PDF**, kapag iniaalok ng tool, ang CMYK na bersyon para sa press |
| Artwork na kailangang manatiling malinaw sa anumang laki | **SVG** | Mga vector na hugis |

::: check I-check ang file sa laki na gagamitin ito
Bago mo ipadala ang file, buksan ito sa screen na pinaglaanan nito o i-print sa aktuwal nitong laki.
:::

::: details Mga approval at paghahatid gamit ang Lolly Work (opsyonal)
Puwedeng piliin ng [organisasyong nagpapatakbo ng Lolly Work](/info/organisation.html) kung aling mga format at export setting ang nakikita ng mga miyembro nito. Kapag kailangan ng approval, pumapalit ang **Request approval** sa **Download**. Sundin ang policy na ipinapakita ng instance mo.

Puwede ring maghatid ng file ang Lolly Work sa mga naka-configure na destinasyong S3, WebDAV at HTTP, na may mga hakbang sa approval, delivery receipt at audit record. Ipinapadala ng paghahatid na iyon ang file sa serbisyo ng organisasyon. Nananatili sa device mo ang karaniwang download. Magkahiwalay ang configuration ng mga personal na Send destination at paghahatid ng organisasyon.

Ginagamit ng mga operator ang [gabay sa paghahatid ng organisasyon](/info/work-delivery.html) para i-set up ito. Para sa mga nakapilang server render at batch, tingnan ang [CLI batch at automation](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

<!--i:eti-cpu-->
## Paano gumagana ang export

Tatlong paraan ang gumagawa ng file. Karamihan ng tool ay **nagre-render ng canvas**. Ang mga text at data format (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) ay **ginagawa mula sa nilalaman ng tool**. Ang mga privacy utility tulad ng *Lolly Strip Hidden Data* ay **nagbabago ng file na pinili mo** sa device mo. Walang canvas, watermark o idinagdag na metadata ang resulta.

![Tatlong paraan ng pag-export ang nagtatagpo sa tapos na file: i-render ang canvas, gumawa ng text o data mula sa nilalaman, o baguhin sa device ang napiling file.](/info/diagrams/concepts/three-export-paths.svg)

Pinipili ng may-akda ng tool kung aling mga aksyon ang iniaalok ng export panel. Copy, Download at Save ang default na set.

- <!--i:download--> Sine-save ng **Download** ang file. Kung hindi mo ito mahanap pagkatapos, tingnan ang [Hanapin ang file na na-download mo](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> Inilalagay ng **Copy** ang larawan sa clipboard mo. Kapag hindi kayang mag-copy ng larawan ang browser, dina-download ng Copy ang file sa halip at ipinapaalam ito sa iyo.
- <!--i:folder--> Itinatago ng **Save** ang kasalukuyang design sa Projects at hindi kailanman nagda-download ng file. Tinatanong ng **Save as**, sa tabi ng **Download**, kung saan (tingnan ang [Pag-save at pagpapatuloy](/info/using.html#saving-continuing)).
- <!--i:link--> Binubuksan ng **Share** ang Share dialog: link na muling bumubuo sa design, mga toggle sa pagbukas (fullscreen, export panel, download o copy sa pagbukas) at opsyonal na **Shortest link** na naglalagay ng state sa compact na token (tingnan ang [URL Mode](/info/url-mode.html)).

**Send to**, isang card sa export panel, ang nagpapadala ng file sa serbisyong ikinonekta mo. Pagkatapos magpadala sa Google Drive, Nextcloud, S3 bucket, Dropbox o OneDrive, puwedeng gumawa roon ng link ang **Create a share link** nang hindi nag-a-upload ulit. Ipinapadala ng seksyong **Share through your cloud** sa Share dialog ang `.lolly` file at ginagawa ang link nito sa iisang hakbang. Ipinapakita ng link panel kung sino ang puwedeng magbukas ng link, kung saan nakalagay ang file at kung kailan mag-e-expire ang link. Pinapayagan ka ng **Links you've shared**, sa Share dialog, na ihinto ang pagbabahagi. Puwedeng magkaroon ng password at petsa ng pag-expire ang mga Nextcloud link. Tumatagal nang 1 hanggang 7 araw ang mga S3 link at hindi puwedeng ihinto nang mas maaga. Walang itinatagong kopya ng file o sign-in token ang Lolly sa server. Inililista ng [Privacy](/info/privacy.html#every-network-request-the-app-can-make) ang natatanggap ng bawat serbisyo.

![Ang export panel - format, laki at mga aksyong Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Kapag nag-embed ang design ng render ng ibang tool, tulad ng image box sa Lolly Design na may QR Code link, iginuguhit ng export ng parent ang nested na render. Nananatili itong vector sa SVG at PDF at nagra-rasterise sa PNG, JPG at WebP. Walang sariling watermark o provenance ang naka-embed na render; ang tapos na file lang ang mayroon. Hindi kayang maglaman ng composed na render ang mga HTML, Markdown at TXT export.

<!--i:eti-file-->
## Pumili ng format

Magkatabi ang pangalan ng file at format menu bilang iisang `name.format` pair, sa ilalim ng **Download**.

![Ang filename field na kadugtong ng format picker, kaya nababasa ang export bilang iisang name.format pair](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Magsimula sa destinasyon ng file. Inililista ng bawat card ang mga format na angkop doon.

::: figure exporting-format-chooser
Anim na destinasyon at ang mga format na angkop sa bawat isa.
:::

Ang wordmark na gumagamit ng typeface ng design system mo ay nag-e-export bilang SVG na bawat letra ay outlined na path. Nananatiling malinaw ang file sa anumang laki.

Nakadepende sa mga font na mayroon ka ang text sa ibang wika. Kapag nasa font ng design system mo ang mga letra, iginuguhit ng SVG at PDF ang mga ito bilang outline, na hinubog at nakaayos ayon sa pagbasa, kasama ang mga linyang mula kanan pakaliwa. Kapag walang ganoong font, gumagamit ang Lolly ng [fallback font](/info/fallback-fonts.html), at ipinapakita ng export card ang font na iyon. Nananatiling live text sa SVG ang text na walang fallback font na sumasaklaw dito, na iginuguhit gamit ang sariling mga font ng viewer. Sa PDF, EPS o WMF, at sa EMF na naka-on ang **Outline fonts**, nagiging mga larawan ang text na iyon. Kamukha ng nasa page ang mga salitang iyon pero hindi mapipili o mahahanap. Inililista ng export card ang mga script na iyon. Magdagdag ng font na may mga letrang iyon para mapanatili ang mga ito bilang vector text.

![Wordmark na napakanipis at maluwag ang pagitan ng mga letra na may nakasulat na Aurora, ang uri ng purong vector artwork na tinutukoy ng SVG row sa table](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Bawat format at ang gamit nito
| Kailangan mo | Gamitin | Dahilan |
|---|---|---|
| Malinaw na logo o artwork na puwedeng i-scale | **SVG** | Vector: puwedeng i-scale, maliit at mae-edit; ine-embed bilang larawan ang epektong hindi kayang iguhit ng vector export |
| Vector para sa mga Office at Windows app | **EMF** | Naipe-paste bilang mae-edit na vector sa PowerPoint at Word, na may live text; binubuksan ito ng Google Drive sa Google Drawings |
| Vector para sa mga print at design app | **EPS**, o **EPS (CMYK)** | PostScript vector para sa Illustrator at mga press workflow |
| Vector para sa mga cutting machine | **DXF** | Mga laser cutter, vinyl plotter at CNC: mga outline path na sinusukat sa millimetro |
| Slide deck na mae-edit | **PowerPoint** (PPTX) | Native na mae-edit na text at mga hugis, na napapanatiling makukuha nang hiwalay ang mga larawan at vector |
| Text document na mae-edit | **Word** (DOCX) o **OpenDocument** (ODT) | Mga talata at heading na patuloy na mae-edit ng word processor (Lolly Doc Studio) |
| Layout para sa InDesign | **InDesign IDML (static subset)** | Text, mga parihaba, oval at larawan, isang spread bawat artboard (Lolly Design) |
| Penpot document na mae-edit | **Penpot** | Mga board, hugis, text at naka-link na token |
| Litrato o larawang pangkalahatan ang gamit | **PNG** (lossless) o **JPG** (mas maliit) | Raster na malawak na sinusuportahan |
| Mas maliliit na modernong larawan | **WebP** o **AVIF** | Mas mahusay na compression, na may transparency |
| Print | **PDF**, o **Print PDF** (CMYK) | Aktuwal na laki ng page; CMYK para sa press |
| Print raster para sa press | **Print TIFF** (CMYK) | Mga DeviceCMYK pixel para sa RIP |
| Animation para sa web | **GIF** | Nagpe-play saanman; mas malalaking file |
| Animation na may buong kulay at tunay na transparency | **APNG** | Animated PNG: walang limitasyon sa palette |
| Animation, pinakamaliit na file | **Animated WebP** | Buong kulay at transparency, mas maliit kaysa GIF o APNG |
| Animated na vector na puwedeng i-scale | **Animated SVG** | Kumpleto sa iisang file; naglo-loop sa browser o `<img>`, sa anumang laki (Lottie Ad) |
| Animation na nananatiling mae-edit | **dotLottie** | Mga hugis, path at outer transform key mula sa timeline ng Lolly Design |
| Pagpapasa sa Premiere | **Premiere XML + media** | Mga clip na may timing at orihinal na media para sa Premiere (Lolly Design) |
| Video para sa social at pagbabahagi | **MP4** o **WebM** | Pinakamahusay na kalidad para sa laki ng file (tingnan ang [Video](#video)) |
| Mga caption | **SRT** o **VTT** | Text na may timing para sa video player (Captions, Audiogram at Record) |
| Mga caption para sa broadcast | **TTML** o **SCC** | IMSC1.1 na text na may timing, o CEA-608 pop-on caption (Captions; tingnan ang [Mga caption para sa broadcast](#broadcast-captions)) |
| Training course | **SCORM (LMS)** | Website, SCORM o xAPI package na may bersyon (tingnan ang [SCORM](#scorm-course-packages)) |
| Rich text o email signature | **HTML** | Naipe-paste nang may formatting sa mga mail client |
| Animation na nagpe-play sa browser | **HTML** | Player sa iisang file, mula sa timeline ng Lolly Design o Snippet (tingnan ang [Video](#video)) |
| Simpleng nilalaman | **MD** o **TXT** | Text lang |
| Event sa kalendaryo | **ICS** | Nai-import sa anumang calendar app |
| Contact card | **VCF** | Nai-import sa mga address book |
| Structured data na muling ia-import | **JSON** o **CSV** | Naie-export at naibabalik ang nilalaman ng tool |
| Favicon | **ICO** | Site icon na may maraming laki; pinagsasama ng **ZIP** ang ilang format |
:::

### Transparency

May toggle para sa transparent na background ang mga tool na sumusuporta rito, tulad ng **No BG**. Pinapanatili ng PNG, WebP, AVIF, SVG, APNG at Animated WebP ang transparency, at pinapanatili ng GIF ang malinaw na hangganan. Laging opaque ang JPG at PDF. Pina-flatten ng TIFF sa puti, o sa itim kapag sa [HDR](#hdr-bright-colours) na paraan.

<!--i:eti-crop-->
## Laki at mga yunit sa print

Ginagamit ng mga export ang native na laki sa pixel ng tool maliban kung nag-aalok ang tool ng **mga sukat**. Kung mayroon, itatakda mo ang lapad, taas at **yunit**:

- Ang **px** (ang default) ay eksaktong mga pixel.
- Ang **mm, cm, in, pt** at **pc** ay mga pisikal na sukat. Kapag pisikal na yunit ang gamit, itatakda mo rin ang **DPI** (300 ang default). Nagiging tunay na page sa sukat na iyon ang **PDF**. Nakukuha ng **raster** ang bilang ng pixel para sa DPI na iyon at itinatala ang resolution. Pinapanatili ng **SVG** ang pisikal na yunit na may pixel na viewBox.

Para sa raster na mas mataas ang resolution, maglagay ng mas malaking lapad at taas, o pumili ng pisikal na yunit at taasan ang DPI (pixels = size × DPI). Ang lapad na `210`, taas na `297` at yunit na `mm` ay gumagawa ng A4 na page.

![Ang row ng mga sukat na nakatakda sa 210 by 297 mm, na ipinapakita ang DPI field dahil pisikal ang yunit](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

<!--i:eti-images-->
## Mga still mula sa komposisyong may timing

Mula sa komposisyong may timing, tulad ng [Sequence](/info/sequence-editor.html) timeline sa Lolly Design, kinukuha ng still export **ang frame sa playhead**. Ilagay ang playhead kung saan mo gusto ang larawan at mag-export.

Para sa higit sa isang sandali, gamitin ang **Frames** field sa tabi ng laki ng output. Lumalabas lang ito para sa komposisyong may timing at still na format (PNG, JPG, WebP, SVG o PDF). Ibinibigay ng `1` ang frame sa playhead. Ang mas mataas na numero ay nagbibigay ng ganoong karaming still, na pantay ang pagitan sa buong sequence:

- Dumarating ang PNG, JPG, WebP at SVG bilang iisang ZIP: `<name>-01.png`, `-02.png` at iba pa.
- Dumarating ang PDF bilang iisang dokumento na may ganoong karaming page.

Kinukuha ang bawat still mula sa gitna ng bahagi nito sa timeline, kaya hindi kailanman kalahating fade-in ang una at hindi kailanman ang bakanteng sandali pagkatapos ng mga clip ang huli.

::: figure exporting-contact-sheet
Hinahati ng Frames: 4 ang sequence sa apat na pantay na bahagi at kinukuha ang gitna ng bawat isa.
:::

Gamitin ang Frames para sa storyboard, contact sheet para sa review o social carousel mula sa inedit na video. Hanggang 64 ang bilang. Anumang ibang i-type sa field ay bumabalik sa `1`. Karaniwang still ang bawat frame, kaya gumagana ang mga credential, Imprint, pisikal na yunit at DPI tulad ng sa iisang export. Hinihingi ng export link, CLI at MCP ang parehong sheet gamit ang `cuts=` (tingnan ang [Mga contact sheet](/info/url-export.html#contact-sheets)).

<!--i:eti-copy-->
## Maraming file nang sabay-sabay

May tatlong paraan ang Lolly para sa maramihang paggawa:

::: cols
## Nagiging iisang dokumento ang table
Ang tool na ginawa para hatiin sa mga page ang table input ay ginagawang page ang bawat row. Mag-paste ng table mula sa spreadsheet mo para makakuha ng iisang PDF. Para ayusin ang mga row, i-edit ang spreadsheet at i-paste ulit. Battlecards ang sangguniang tool. Nasa open-source na `community` folder ito at hindi nakalista sa lolly.tools.
## Nagiging isang file bawat row ang CSV
Tumatanggap ang **Batch** (`#/batch`) ng CSV at nagre-render ng isang export para sa bawat row, tulad ng mga name badge o sertipiko, na ibinibigay sa ZIP. Tingnan ang [Lolly Batch](/info/batch.html#make-many-versions-of-one-design).
## Iisang edit sa maraming design
Binubuksan ng **Lolly Multi-edit** ang ilang naka-save na session nang magkakatabi para gawin ang parehong pagbabago sa bawat isa. Tingnan ang [Lolly Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Ang tool na may maraming page, tulad ng Booklet, Print Sheet, Lolly Doc Studio o Lolly Markdown Slides, ay nag-e-export ng PNG, JPG, WebP, SVG at iba pang format para sa iisang larawan bilang isang file bawat page, sa ZIP kapag marami. Pinapanatili ng Print Sheet ang buong sheet at mga cut mark nito sa napiling DPI.

Mula sa **Projects**, ine-export ng **Render folder** ang bawat naka-save na session sa folder at mga sub-folder nito bilang iisang nested na ZIP. Ganoon din ang ginagawa ng **Render selection** para sa maramihang seleksyon. Nire-render ang isang naka-save na session sa sarili nitong file. Puwede ring magbahagi ulit ang Projects ng naka-save na session bilang tool link na muling nagbubukas sa session na may parehong mga setting.

<!--i:eti-pen-->
## Mga file na nananatiling mae-edit sa ibang app

Ipinapasa ng ilang format ang gawa mo sa ibang application bilang mae-edit na nilalaman sa halip na larawan.

### PowerPoint (PPTX)

Nag-e-export ng PowerPoint deck ang Lolly Design, Lolly Markdown Slides, Booklet, Lolly Doc Studio, Lolly Chart, Diagrams, Flow Chart at Agenda, isang slide bawat page. Hinahati ang bawat page sa mga native na bagay na mae-edit at makukuha nang hiwalay ng kasamahan:

- <!--i:font--> Nagiging mae-edit na PowerPoint text box ang **text**, na may laki ng font, kulay, weight, italics at alignment ng layout. Itinatakda ng Lolly Design deck ang typeface ng brand sa bawat text run, kahit walang slide master.
- <!--i:pentool--> Ine-embed bilang mga SVG na larawan ang mga **vector** tulad ng mga logo at icon, at puwedeng gawin sa mga ito ang *Convert to Shape* ng PowerPoint.
- <!--i:photos--> Dumarating ang mga **larawan** bilang magkakahiwalay na larawan sa native na resolution. Pinapanatili ng naka-crop na hero ang buong larawan sa likod ng crop. Anumang filter o blend sa larawan ay permanenteng kasama na rito.
- <!--i:layers--> Nagiging mga parihaba at linya ang mga **background, border at guhit**. Nananatiling native at mae-edit na hugis ang mga bilog, ellipse at pill mula sa Lolly Design.

![Ang export panel na PowerPoint ang napili: isang slide bawat page, nananatiling mae-edit ang text at mga hugis](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Tinatantiya ang layout. Anumang hindi kayang ipahayag ng walker nang native, tulad ng komplikadong bahaging may filter o mask, ay ine-embed bilang larawan. Iisa ang laki ng slide sa deck, na kinukuha mula sa unang page.

Puwede ring magpasok gamit ang PowerPoint: inililipat ng [Ilipat ang deck sa ibang brand](/info/rebrand.html) ang deck sa design system mo, at binubuksan ng [Mag-import ng design](/info/design-import.html) ang deck sa Lolly Design.

### Penpot

Karamihan ng tool na nag-e-export ng SVG ay nag-e-export din ng **Penpot file** (`.penpot`).

| Ang ginawa mo | Sa Penpot |
|---|---|
| Text | Mga mae-edit na text object |
| Mga hugis, path, gradient at larawan | Mga mae-edit na vector na hugis |
| Kulay o font mula sa design-system token | Live na link sa token: i-edit ang token at susunod ang bawat hugis na nagmamana rito |
| Ang buong design | Reusable na component sa Assets panel |
| Komplikadong ilustrasyon o live na canvas | Naka-embed na larawan; nananatiling mae-edit ang nilalaman sa paligid nito |

Mula sa Lolly Design, nagiging Penpot board ang bawat frame. Napupunta sa Assets panel ang mga kulay at typography ng design system at sa Tokens panel ang buong set ng mga token nito. Nag-iingat ang Penpot ng sarili nitong kopya. Bumabalik ang token na inedit sa Penpot sa pamamagitan ng import sa [Lolly Design System Setup](/info/brand-studio.html).

![Ang export panel na Penpot ang napili: ang .penpot file, at Send to Penpot sa tabi ng download](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Para buksan ang file, simulan ang Penpot, pumili ng project at piliin ang **Import**. Kung mag-sign in ka sa Penpot mula sa export panel, ini-import ng **Send to Penpot** ang file para sa iyo.

### Word, OpenDocument at InDesign

**Lolly Doc Studio** ang nag-e-export ng **Word** (DOCX) at **OpenDocument** (ODT) na may mae-edit na mga talata at heading. Itinatakda ng Word file ang mga font at kulay ng text ng brand sa pamamagitan ng mga style ng dokumento, sinusunod ang laki ng page na pinili mo at nagdaragdag ng PNG sa tabi ng SVG na logo para sa mga app na hindi kayang gumuhit ng SVG.

**Lolly Design** ang nag-e-export ng **InDesign IDML (static subset)**: text, mga parihaba, oval at PNG o JPEG na larawan, isang spread bawat artboard. Nananatiling mae-edit ang sinusuportahang inline formatting, sumasama ang mga larawan sa `Links` at nagiging InDesign point ang mga coordinate. Maaaring kailangang asikasuhin ang muling pag-link, pagpapalit ng font at nabagong pag-wrap. Pinapahinto ng mga epekto, animation, composed story at hindi sinusuportahang geometry ang export, na may ulat na naglilista sa mga ito. Hindi pinapanatili ng IDML ang orihinal na dokumento. Magpadala ng PDF para sa tapos na artwork.

### Mga timeline: dotLottie at Premiere

Mula sa timeline ng Lolly Design, sumusulat ang **dotLottie** ng animation na nananatiling mae-edit sa mga Lottie tool; inililista ng [Mga Lottie animation](/info/sequence-editor.html#lottie-animations) ang pinapanatili nito. Ipinapackage ng **Premiere XML + media** ang mga clip na may timing at ang orihinal na media ng mga ito para sa Premiere; tingnan ang [Palitan gamit ang Premiere XML](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (mga course package)

Naka-off ang course export hangga't hindi mo ino-on ang **Training and courses** sa ilalim ng Settings → Preferences → Feature flags.

Pagkatapos, piliin ang **Export course** mula sa sinusuportahang tool, project folder o seleksyon. Sa Lolly Design, binubuksan ng pagpili sa **SCORM (LMS)** at **Download** ang parehong course workflow. Sine-save ng Lolly ang gawa, ipinapakita ang nilalaman at pagkakasunod-sunod ng course para sa review, saka binubuksan ang module at ang export dialog nito.

- <!--i:layers--> Pumili ng rendition para sa bawat source: mga still na page, motion bilang video, audio o nada-download na resource. Magdagdag ng text ng aralin at mga alternatibong babasahin sa module.
- <!--i:clock--> I-preview ang player para sa mag-aaral at suriin ang mga paglalarawan at caption. Kasama ang motion, pati ang animation na walang tunog, bilang video.
- <!--i:document--> Piliin ang Website, SCORM 1.2, SCORM 2004 4th Edition o eksperimental na xAPI target. I-check ang nilalaman at laki ng ZIP, saka i-save at i-download ang na-check na bersyon.
- <!--i:check--> Para makumpleto, kailangang kumpirmahin ang bawat kinakailangang aralin at piliin ang Finish.

![Ang export panel sa Lolly Design deck na SCORM (LMS) ang napili](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Nasa package ang tapos na nilalaman nito at hindi kailangan ng Lolly account. Ilagay ang Website ZIP sa HTTP(S) host; i-import ang LMS ZIP nang walang pagbabago. Subukan ang destinasyon bago mo ibahagi ang course. Para sa course na binuo mula sa ilang naka-save na gawa, tingnan ang [Gumawa ng training course](/info/training-creators.html).

### Mga caption para sa broadcast

Puwede ring mag-export ng **TTML** at **SCC** ang Captions tool. Parehong isinusulat mula sa cue list na ginagamit ng mga SRT at VTT file, kaya magkatugma ang mga salita at oras.

- Ang **TTML** ay ang IMSC1.1 Text Profile, na may mga oras sa media-time clock at iisang rehiyon sa ibabang gitna. Wala itong kulay, font o posisyon para sa bawat caption, dahil simula, dulo at text lang ang laman ng mga caption ng Lolly.
- Naglalaman ang **SCC** ng mga CEA-608 pop-on caption sa channel 1 sa 29.97 frame bawat segundo na may drop-frame timecode. Sinusuportahan nito ang mga basic na North American character pati ang mga special at extended. Kung may character sa caption na wala sa set, hihinto ang export at sasabihin kung aling character. Nagwa-wrap ang bawat caption sa 32 column at hanggang 15 row. Naaantala nang ilang frame ang caption na hindi mai-load bago ang oras ng simula nito.
- Hindi isinusulat ang mga roll-up at paint-on caption.

::: note Hindi pa na-check ang SCC sa broadcast tool
Hindi pa rin ito nasusubukan sa hardware decoder. Subukan ang file sa sarili mong pipeline bago ihatid.
:::

### DXF (mga file para sa pagputol)

Nag-e-export ang Lolly Asset Export, Diagrams, Growth, Lolly Logo Wall, QR Code, Street Map, Wayfinding at Wordmark ng **DXF**, ang AutoCAD R12 interchange format na nababasa ng mga laser cutter, vinyl plotter at CNC software. Isinusulat ang geometry bilang mga outline path sa millimetro at ginagawang outline ang text. Itinutugma ang kulay sa pinakamalapit na AutoCAD Color Index, na karaniwang nagtatakda ng operasyon ng cutter. Line art lang ang DXF: walang cut path ang bahaging litrato o may filter at inaalis ito nang may babala. Gamitin ang SVG o PDF para mapanatili ang raster na nilalaman. Pinapahinto ng text na walang font na sumasaklaw dito, kahit [fallback font](/info/fallback-fonts.html), ang export na may mensaheng sumisipi sa text.

Puro stroke ang design sa Street Map, kaya nagiging cut path ang bawat kalsada at kanal.

::: showcase
![Render ng Paris sa Street Map na may tinta sa cream na background - purong line art, kaya napapanatili ang bawat stroke sa pagpapasa sa cutter](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Mag-scroll, at lumalayo ang camera sa geometry: pitong path at walang pixel. Binabasa ng cutter ang parehong file.
:::

<!--i:eti-stamp-->
## Print

**Print PDF** ang sumusulat ng CMYK ayon sa pinangalanang press condition, **Coated FOGRA39** bilang default. Pinapanatili ng mga brand swatch na may sinusukat na halaga ng tinta ang mga halagang iyon. Kino-convert ang ibang kulay sa pamamagitan ng press profile: ang sariling Coated FOGRA39 profile ng Lolly bilang default, o ang sarili mong profile kapag pinili mo ang **Embed** row nito. Nananatili sa black plate lang ang mga abo at itim, kaya hindi magkakamali sa rehistro ang maliit na type. Gumagamit ang FOGRA51, SWOP at GRACoL ng standard na device conversion. Nag-o-overprint din ang itim na type sa kulay sa ilalim nito, kaya walang naiiwang puting gilid sa palibot ng mga letra kapag bahagyang hindi nakahanay ang press. Sumusulat ang **Print TIFF** ng mga DeviceCMYK pixel para sa RIP. Kinokontrol ng Colour profile ang pareho ([Mga colour profile](#colour-profiles)). Pinaghihiwalay ng Print TIFF at **EPS (CMYK)** ang mga kulay sa pamamagitan ng parehong press profile na gamit ng Print PDF.

**Print marks & bleed** ay may sariling card sa mga print format: ang bleed sa millimetro kasama ang Crop, Registration, Bleed, Colour bars at Stamp details. Pini-print ng Stamp details ang petsa, tool at pangalan mo sa margin. Ang pangalan o pangalan ng tool na may mga letrang wala sa font ng margin, tulad ng Arabic, Chinese, Cyrillic o emoji, ay iginuguhit bilang larawan sa parehong kulay abo. Inililista ng export card ang mga script na iyon.

Gumagawa ang ilang tool, tulad ng *Booklet*, ng **PDF na maraming page**: pabalat, nilalamang umaabot sa dami ng page na kailangan nito at page sa likod. Tunay na portrait PDF page sa A4, US Letter o A5 ang bawat page. Puwede mong piliting magsimula sa bagong page ang anumang block. Mga RGB na dokumento ang mga ito na walang crop o bleed mark; para sa single-page na Print PDF ang mga markang iyon. Puwede ring maging **Notes handout** ang Lolly Design PDF: portrait na page para sa bawat slide na may mga speaker note nito sa ilalim.

**Bago ka mag-export.** Ipinapakita ng **Before you export** card sa ibaba ng panel ang makikita ng print shop: format, laki at bleed, mga trim at bleed area, saklaw ng tinta, bilang ng mga plate at bilang ng mga page, na may hatol sa tabi ng heading nito. Hindi kailanman hinaharang ng card ang export. Laging ipinapakita ng Lolly Design ang card na may sarili nitong mga check, kasama ang mga patakaran ng organisasyon sa design system sa bawat layer at ang writing signal para sa text ng dokumento ([Bago ka mag-export](/info/design.html#before-you-export)). Idinaragdag ng Lolly Design ang mga print check na ito kapag naka-on ang **Print preflight**. Sa ibang tool, i-on ang **Print preflight** sa ilalim ng Settings → Preferences → Feature flags. Naka-off ito bilang default, at puwedeng i-on ito ng Lolly Work deployment para sa mga miyembro nito.

**Pagkatapos mong mag-export.** Binabasa ulit ng Lolly ang tapos na file at inihahambing ito sa pinili mo: format, laki sa pixel o laki ng page, haba ng clip, transparent na background, CMYK na kulay, HDR, Content Credentials at password ng PDF o ZIP. Anumang pagkakaiba ay isinusulat sa export card. Galing sa file ang bawat sukat, hindi kailanman sa setting. Ang katangiang hindi masasagot ng file ay hindi binibilang bilang tugma. Isinusulat ng command line ang buong paghahambing gamit ang `--export-report` (tingnan ang [Mag-render gamit ang CLI](/info/cli-rendering.html)).

::: details Mga check sa accessibility ng PDF mula sa command line
**Mga check sa accessibility ng PDF.** Para sa PDF, naglilista rin ang command line ng 32 check sa accessibility sa `--export-report` file, sa ilalim ng `pdfAccessibility`. May id, malinaw na paglalarawan, resulta at lokasyon sa file kung saan nakita ang problema ang bawat check:

- **Passed**: may sinuri ang check at walang nakitang mali.
- **Failed**: may nakitang problema ang check. Nakalista ang mga page number o tag nito.
- **Not applicable**: walang ganoong uri ng bagay sa file na masusuri, tulad ng mga table check sa file na walang table. Wala itong sinasabi tungkol sa file.
- **Needs a person**: hindi kayang hatulan ng program ang anim na check (pagkakasunod-sunod ng pagbasa, contrast ng kulay, pag-flash, mga script, limitasyon sa oras at paulit-ulit na link).

Hindi hatol ang listahan. Hindi nito sinasabing natutugunan ng PDF ang PDF/UA o na magagamit ang PDF ng mga taong gumagamit ng assistive technology. Kailangan pa ring i-check ng tao ang file gamit ang screen reader. Bumibigo sa mga tagging check ang sariling mga PDF ng Lolly sa ngayon, dahil hindi pa nagsusulat ng mga tag ang mga exporter. Binabasa ng check ang file sa device mo at wala itong binabago. Minamarkahang hindi na-check ang mga file na nangangailangan ng password, hindi pasado. Para i-check ang PDF na ipinadala sa iyo, i-drop ito sa [Lolly Strip Hidden Data](/info/utilities.html), na nagpapakita ng parehong listahan sa ilalim ng **PDF accessibility checks**.
:::

Sinusuri ng mga inspector check ng Lolly Design at ng brand comparison sa Lolly Design System Setup ang design. Sinusuri ng dalawang card na ito ang file.

::: details Gastos mula sa rate card
Sa ilalim ng preflight, ginagawang halaga ng cost card ang parehong mga bilang, kahit naka-off ang preflight card. Kailangan nito ng dalawang bagay: trabahong kayang presyuhan ng listahan ng presyo (mga plate, sheet, area, page, variant row o output file, kaya hindi kailanman nagpapakita ng card ang simpleng PNG na logo) at **rate card**, isang listahan ng presyo sa JSON mula sa printer mo. Walang kasamang rate card ang default na build at walang paraan sa app para mag-load nito. Dumarating ang rate card bilang catalog asset na kasama sa deployment, o sa pamamagitan ng opsyonal na rate-card extension na ino-on ng self-hoster o control plane. Kapag walang rate card, walang ipinapakita.

Ang bawat halaga ay rate na ibinigay mo na pinarami sa daming binilang ng Lolly, tulad ng `4 plate × €35.00`. Ipinapakita ng kabuuan ang pinagmulan nito: ang naglabas ng card at ang petsa ng mga rate nito. Walang default na currency at walang placeholder na presyo. Ang sinasabi ng file tungkol sa sarili nito ay nananatiling iniulat na pahayag: *"Sabi ng file: … Hindi pa ito nave-verify ng Lolly."*

Kapag hindi makalkula ang halaga, inaalis ang table sa halip na punan ito:

- Ang mga linyang hindi pinipresyuhan ng card ay nangangahulugang **walang kabuuan**, heading lang na nagsasabi kung ilan ang walang presyo.
- Ang daming nagsasaad ng pinakamataas na limitasyon ay may kasamang **"hanggang"** sa subtotal nito.
- Ang mga rate na lampas na sa petsa ng bisa ay nagpapakita ng **mga bilang lang** hanggang pindutin mo ang *Use these rates anyway*; pagkatapos, mananatiling kasama ng halaga ang petsa ng pag-expire.
- Kapag binuksan sa pamamagitan ng **link**, nananatiling nakatago ang mga halaga ng pera hanggang hilingin mo ang mga ito sa device na ito. Tinatanggap ng CLI ang `--rate-card=<file.json>` bilang lokal na file at hindi kailanman bilang parameter ng link.

Inaalis ang card sa bawat yugto ng export at hindi nito kailanman binabago ang file. Pagkalkula ito, hindi pormal na alok ng presyo. Ang printer mo lang ang makakapagbigay ng ganoong alok.
:::

<!--i:eti-film-->
## Motion at tunog

### Video

Nag-e-export ng **MP4** at **WebM** ang mga animated na tool. Ang ibinahaging `?format=` link na humihingi ng container na hindi kayang gawin ng browser na ito ay bumabalik sa isa pa, na may katugmang pangalan ng file. Pinananatiling nakatigil ng **Start after** ang canvas para maging handa ang mga animation at font bago mag-record. Itinatakda ng **Duration** ang haba ng tapos na clip. Pinapalabo ng **Motion blur** (Off, Draft quality, Standard o High, na may **Shutter angle**) ang mabilis na galaw at pinapabagal ang render. Kapag sinusuportahan ng browser, nire-record ng **Record live** ang preview sa screen nang real time sa pamamagitan ng screen share.

![Ang mga setting sa timing para sa animated na export: Start after, Duration, Motion blur kasama ang Shutter angle nito at Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** ang pumipili sa Smaller file, Balanced o Best quality. Binubuksan ng **Advanced** ang **Codec**, **Frame rate**, **Rate mode** at **Hardware acceleration**. Kapag may mga caption ang tool, pinipili ng **Captions** ang **Embedded track** o **Sidecar .vtt + .srt** sa tabi ng video. Kasama sa link ang kalidad, codec, frame rate, tagal at pagkaantala ng simula bilang `vq`, `codec`, `fps`, `seconds` at `wait` ([Mga URL parameter](/info/url-parameters.html)).

Pinapanatili ng mga video export ang tunog ng mga ito. Puwedeng maglagay ang tool ng **music bed** sa ilalim ng clip: audio asset na naka-loop o pinutol ayon sa haba ng clip, na may mga fade, volume at ducking sa ilalim ng sariling tunog ng footage. Isinasama ng mga recording tool sa file ang live na audio ng mga ito.

Puwede ring mag-export bilang video ang click deck ng Lolly Design. Binubuksan ng **Export slides as video** sa Present menu ang export sheet sa MP4. Nagpe-play ang bawat slide ayon sa sarili nitong dwell, o sa Duration ng export sheet kapag wala itong itinakda. Nagpe-play ang slide transition ng deck bilang dissolve sa pagitan ng mga slide. Hindi nagbabago ang dokumento.

**HTML** mula sa dokumento ng Lolly Design na may timing, o mula sa Snippet, ay player sa iisang file: mga kontrol sa play, paglipat sa ibang oras at tunog sa ibabaw ng animation, na naka-embed ang mga sinusuportahang font, larawan at tunog nito. Nagpe-play offline ang file. Nagdaragdag ng menu ng mga scene nito ang Lolly Design film na may mga scene. Hindi pa puwedeng i-export bilang HTML ang sequence na may video, Lottie o 3D clip; i-export ang sequence bilang video.

### Mga animated na larawan

**GIF** ay nagpe-play saanman at bagay sa chat at email; mas malaki ito at mas kaunti ang kulay kaysa video. Pinapanatili ng **APNG** at **Animated WebP** ang buong kulay at transparency. Nag-e-export din ang **Lottie Ad** ng **Animated SVG**: mga vector frame na may naka-embed na CSS keyframe na nai-scale sa anumang laki at naglo-loop sa browser tab o `<img>` nang walang codec. Naka-outline ang text nito. Mas mababa ang default na frame rate nito dahil mas mabigat ang bawat frame kaysa bitmap. Walang tunog ang lahat ng ito.

### Audio

May ilang tool na nag-e-export ng tunog lang. Kinukuha ng **Lolly Voice Recorder** ang take mula sa mikropono na may live na level meter at sine-save ito bilang **MP3**, **WAV**, **M4A (AAC)** o **Opus (WebM)**, na ine-encode sa device mo. Mga karaniwang format id ang `wav`, `mp3`, `m4a` at `opus`, kaya tulad ng PNG ang audio export sa kakayahang ibahagi at gamitin sa script.

Tumatanggap ang asset picker ng maraming audio format para sa music bed, mula MP3 at FLAC hanggang MIDI at mga tracker module; inililista ang mga ito sa [Mga format](/info/formats.html). Nagpe-play ang [kantang Lolly Rondocode](/info/rondocode.html) ayon sa haba na hinihingi ng clip nito.

<!--i:eti-palette-->
## Kulay at HDR

Binabasa ng Lolly ang bawat modernong CSS na kulay, kinakalkula ang mga kulay ayon sa persepsyon at isinusulat ang bawat file sa colour space na mabubuksan ng reader: sRGB para sa mga screen, CMYK para sa print at Rec.2100 PQ para sa HDR ([Kulay sa engine](/info/colour-engine.html)). Sinusunod ng dokumento ng Lolly Design na nakatakda sa **Wide colour / HDR** ang sarili nitong mga patakaran: tingnan ang [Pag-edit ng wide colour at HDR](/info/hdr-editing.html).

### Mga colour profile

Nilalagyan ng tag na colour profile ang mga export, kaya nababasa ng mga app na may colour management, tulad ng sa mga print shop, Photoshop at mga browser, ang mga kulay ayon sa nakita mo. Walang tag ang mga thumbnail at preview para manatiling maliit.

- Ang **PNG at JPG** ay may naka-embed na **sRGB** ICC profile, ang colour space na pinagguguhitan ng preview. Nilalagyan ng tag ang mga pixel, hindi ine-encode ulit.
- Idinedeklara ng **Print PDF (CMYK)** ang press condition nito sa *OutputIntent* nito, na nagsasabi sa print shop kung paano dapat basahin ang mga CMYK na tinta nito.
- Sumusulat ang **Print TIFF (CMYK)** ng mga DeviceCMYK pixel na walang tag at itinatala ang press condition sa TIFF metadata nito. Hindi kayang mag-embed ng TIFF ng press profile, kaya pangalan lang ng profile na iyon ang itinatala ng **Embed** row.
- Ang **TIFF (RGB)** ang uncompressed na sRGB na bersyon para sa archive o pagpapasa sa editor at pagbabalik mula rito. Para lang sa desktop ang parehong TIFF, dahil hindi kayang mag-preview ng TIFF ang mga browser.
- Ang **SVG**, **EMF**, **EPS** at **DXF** ay mga vector na walang naka-embed na profile: sRGB ang mga kulay ng SVG, device RGB ang gamit ng EMF at EPS, DeviceCMYK ang isinusulat ng **EPS (CMYK)** at AutoCAD Color Index ang gamit ng DXF. Ginagawang outline path ng SVG, EPS at DXF ang text. Pinapanatili ng EMF na live at mae-edit ang text sa Office at Google Slides at ginagawang outline lang ang mga run na hindi kayang ipahayag ng format. Pinipilit ng **Outline fonts** na opsyon sa export panel na maging path ang lahat ng text, tulad ng `_text=outline` sa link at `--text=outline` sa command line. Ginagaya rin ng SVG ang mga CSS box shadow, sa loob at labas.

::: details PDF/X-4 at ang sarili mong press profile
May kasamang isang CMYK profile ang Lolly, na iniangkop sa FOGRA39 characterisation data ng Fogra at inilabas sa ilalim ng CC0, at kino-convert nito ang mga kulay sa pamamagitan nito para sa default na press condition. Hindi naka-embed ang profile, dahil ICC version 4.3 ito at hanggang version 4.2 ang tinatanggap ng PDF/X-4. Kaya isinusulat ng pinangalanang press condition ang output intent nang hindi inaangking sumusunod ito sa PDF/X-4.

Mag-load ng sarili mong CMYK profile at piliin ang **Embed** row nito sa Colour profile na kontrol. Ine-embed ito bilang *DestOutputProfile* ng file, at inaangkin ng PDF ang pagsunod sa PDF/X-4 kapag pinapayagan ng iba pang bahagi ng file. Binabasa mula sa profile na iyon ang press condition na idinedeklara nito: rehistradong pangalan kapag pinatutunayan ito ng profile, o `Custom` sa ilalim ng sariling pangalan ng profile.

Tatlong bagay ang pumipigil sa pag-angkin habang pinapanatili ang output intent: RGB na artwork na hindi na-convert ng CMYK pass, ang `prov` na credit text sa proof margin (iginuguhit sa standard na font na hindi naka-embed) at **Strong** na password, dahil ipinagbabawal ng PDF/X-4 ang encryption. May kasama ring PDF/X-4 metadata ang bawat PDF: mga page box, XMP, document ID at sRGB na output intent na may profile nito.
:::

### Mga spot ink bilang process

Puwedeng magtalaga ang isang design system ng spot ink sa isang kulay, gaya ng kulay na Pantone o HLC. Ini-print ng **Print PDF** ang kulay na iyon sa sarili nitong plate. May spot ink ang bawat kulay ng Lolly Demo maliban sa mga puti nito, Sugar at Daylight, at sa itim nito, Void. Ang Print PDF na ginawa sa Lolly Demo ay nagpi-print ng karamihan sa mga kulay sa mga spot plate at ng itim sa black plate.

Para sa karaniwang file na may apat na kulay, lagyan ng tsek ang **Print spot inks as process** sa Profile card ng export panel. Ipi-print ang bawat spot ink gamit ang cyan, magenta, yellow at black, ayon sa CMYK build na ibinibigay ng design system sa kulay na iyon. Ang kulay na walang sariling build ay gumagamit ng conversion ng press profile, tulad ng bawat ibang kulay sa artwork. Apat na process plate lang ang nasa file. Naka-off ang pagpipilian bilang default. Ipinapakita lang ng panel ang kahon para sa **Print PDF**, at kapag may kulay lang na binigyan ng spot ink ng design system.

Ang finish ay hindi ink. Pinapanatili ng foil, emboss, deboss, spot varnish, soft touch, die cut, crease at perforation ang sarili nilang pinangalanang plate kahit may tsek ang kahon, dahil ang finish na ini-print bilang process ay maglalagay ng itim nitong mask sa page.

Binibilang ng **Before you export** card at ng `lolly preflight` ang mga plate na magkakaroon ang file. Kapag may tsek ang kahon, binibilang nila ang apat na process plate at anumang finish plate at sinasabing ini-print ang mga spot ink bilang process at walang idinadagdag na plate. Kapag walang tsek ang kahon, binibilang nila ang hanggang isang spot plate para sa bawat spot ink na ibinibigay ng design system. Presyo para sa mga bilang na iyon ang nasa rate card, kaya hindi ito kailanman naniningil para sa spot plate na wala sa file.

Walang pinangalanang plate ang **Print TIFF** at **EPS (CMYK)**, kaya ini-print nila ang bawat ink bilang process, naka-on man o hindi ang pagpipilian. Para sa dalawang format na iyon, binibilang ng card at ng `lolly preflight` ang apat na process plate at hindi kailanman ang spot o finish plate. Napupunta sa mga ito ang finish bilang itim nitong mask sa black plate, at iniuulat iyon ng card bilang error.

Hinihiling ng link ang parehong file gamit ang `_spots=process`, ng command line gamit ang `--spots=process`, ng [MCP server](/info/mcp.html) gamit ang `spots: "process"` at ng terminal app gamit ang **Spot inks** row nito. Walang detalye ng pagpipilian ang napupunta sa file: ang mga ink lang ang nagbabago.

### HDR (matitingkad na kulay)

Pinapatingkad ng **HDR** card ng export panel ang karaniwang artwork para sa mga HDR screen. Para mapanatili ang mga orihinal na HDR habang nag-e-edit, tingnan ang [Pag-edit sa malawak na saklaw ng kulay at HDR](/info/hdr-editing.html).

sRGB ang karaniwang export: ang saturated na kulay ng brand ay kasingliwanag ng normal na puti ng screen. Puwedeng mas maliwanag pa ang HDR display. Pinapataas ng **HDR** card ang liwanag ng mga kulay ng brand at puting text mo patungo sa pinakamataas na liwanag. Nananatiling madilim ang mga madilim na bahagi.

![Ang HDR card sa export panel, naka-on, na nakikita sa ilalim ang mga dial na White / Reach / Dark lift / Focus](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Mga format.** PNG, JPG, AVIF at TIFF. 8-bit ang WebP at wala itong gumaganang HDR decode path, at walang HDR model ang mga vector at PDF.
- **Naka-off bilang default**, dahil binabago nito ang mga pixel. Lagyan ng tsek ang card, o ipasa ang `hdr=1` sa share link.
- **Ang mga dial.** **White** (ang pinakamataas na liwanag, 400 hanggang 2000 nits), **Reach** (hanggang saan umaabot ang glow pababa sa mga tono), **Dark lift** (kung gaano lumiliwanag ang mga madilim na bahagi; pinapanatili silang madilim ng `0`) at **Focus** (kung gaano karaming yaman ng kulay ang pinapanatili ng pagtaas ng liwanag). Magkakasama silang ipinapasa bilang isang value: ang `hdr=1600-60-0-50` ay White 1600, Reach 60, Dark lift 0 at Focus 50.
- **Ano ang isinusulat.** Nagkakaroon ang PNG ng 16-bit Rec.2100 PQ na may `cICP` chunk. Ang JPG ay ISO 21496-1 gain-map JPEG: karaniwang SDR na larawan na may idinugtong na gain map. Nagkakaroon ang AVIF ng muling isinulat na `colr` box. Nagkakaroon ang TIFF ng mga PQ pixel na may binuong ICC v4 profile na may `cicp` tag. Fina-flatten ang TIFF sa itim, dahil ang puti ang 10,000-nit code sa PQ at maglalagay ng halo sa paligid ng bawat gilid. Sinusunod ng pagtaas ng liwanag ang perceptual (OKLab) lightness at pinapanatili ang hue, kaya lumiliwanag ang berde ng brand nang hindi nagiging mint ang kulay.
- **Saan lumalabas ang glow.** Sa mga viewer na may color management sa HDR display: Preview, Quick Look at Safari sa mga Apple device, o Chrome sa HDR monitor. Karaniwang larawan ang ipinapakita ng SDR screen.
- **Mula sa terminal.** Isinusulat ng `--hdr=1` na may `--export=png` o `--export=jpg` ang parehong PNG at gain-map JPEG sa [CLI](/info/cli.html) mula sa parehong engine encoder, nang walang browser. Sa ngayon, sa web lang ine-export ang AVIF at TIFF.

::: warning Inaalis ng maraming platform ang HDR signal
Puwedeng maging madilim o maputla ang larawan kapag muling ine-encode ng platform ang mga upload. Gamitin ang HDR kung kontrolado mo ang destinasyon, tulad ng sarili mong site, video wall o deck sa maliwanag na panel.
:::

<!--i:eti-badge-check-->
## Ano ang sumasama sa file mo

Puwedeng may ilang record ang tapos na file. Ang ilan ay nasa tabi ng mga pixel at nawawala kapag muling sine-save, kinukunan ng screenshot o nililinis ang file. Dalawang marka ang nasa mismong mga pixel.

::: figure exporting-what-travels
Kung saan naroon ang bawat record, kung naka-on ito bilang default at kung aling link parameter ang kumokontrol sa bawat isa.
:::

Inilalagay ng export panel ang **Licence**, **Source credits**, **Password**, **C2PA Credentials**, **Lolly Imprint** at **Durable credential** sa iisang **Content protection** group na nagpapakita lang ng mga card na magagamit ng napiling format. Kusang bumubukas ang group kapag may lisensyang idineklara na ang link o dokumento, o kapag kailangan ng source ang desisyon mo. Nananatili sa labas ng group ang **Design system** card, nakikita sa bawat export.

![Ang Content protection group na nakabukas sa isang PNG export, ipinapakita lang ang mga card na naaangkop dito](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Pinagmulan & watermark

Kapag may mga field ang format, may **metadata ng pinagmulan** ang mga export: ang software, source, pangalan ng tool at credit line ng profile mo, na nakasulat sa PNG iTXt, JPEG EXIF, PDF info, SVG `<metadata>` o GIF comment. Itinatala lang nito ang pagiging may-akda. Walang ina-upload. Naglalagay din ng nakikitang watermark ang mga **Experimental** tool. Ang host ang naglalagay ng watermark, kaya hindi ito maaalis sa pag-edit ng tool.

**Ang Lolly Imprint** ay hindi nakikitang watermark sa mga pixel, **naka-on bilang default**. Nananatili ito kahit muling i-compress, kaya makikilala pa rin ang isang kopya bilang gawa sa Lolly. Pahiwatig ito, hindi cryptographic na garantiya, at wala itong personal na data. Isinusulat ito sa JPEG XL, PNG, JPG, WebP, AVIF, TIFF at BMP, at sa mga raster na nire-render ng Lolly sa PDF o PPTX, hindi kailanman sa larawang in-embed mo. Alisin ang tsek sa **Lolly Imprint** o ipasa ang `imprint=0` para hindi isama ang Imprint. Hindi pa naka-calibrate ang pananatili nito sa AVIF pagkatapos ng muling pag-encode. Nakikita ng [Lolly Verify](/#/verify) ang Imprint sa device mo; tingnan ang [Ang Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**Ang Durable credential** ay nagsusulat ng id ng Lolly sa mga pixel gamit ang neural model sa device mo sa TrustMark format, kaya nananatili ang link na "ginawa gamit ang Lolly" kahit alisin ang metadata at muling i-encode, at nababasa ito ng mga tool na nakakaunawa sa TrustMark. **Naka-off ito bilang default**, dahil kailangan ng isang neural pass sa bawat export at isang beses na pag-download ng model. Sakop nito ang PNG, JPG, WebP, AVIF at TIFF. Lagyan ito ng tsek sa panel o ipasa ang `durable=1`. Itinatago ng mga desktop at mobile app ang card, dahil wala silang origin na mapagkukunan ng model kapag offline.

**Licence.** Piliin kung paano magagamit ng iba ang gawa mo: *None (all rights reserved)* bilang default, CC0 1.0, Public Domain Mark 1.0 o isang Creative Commons 4.0 licence (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). Napupunta ang pangalan ng lisensya at link sa deed nito sa metadata ng lisensya ng file (EXIF, XMP at RIFF kung mayroon nito ang format) at sa Content Credential nito. Sine-save ang pagpipilian kasama ng dokumento at sumasama sa link bilang `licence=`. Isinusulat ng Lolly ang lisensyang pinili mo. Hindi sinusuri o ipinapatupad ng Lolly ang mga tuntunin. Ang tool na may sariling licence field, tulad ng Claim, ay pinapanatili ang field na iyon sa halip.

### Ang record ng design system

Itinatala ng export ang design system na gumawa ng file: ang pangalan nito, ang inilathalang bersyon na pinaghanguan nito (kapag hindi iyon ang kasalukuyang bersyong ginagawa) at ang [colourway](/info/colourways.html) na ginamit sa pagguhit. Anumang ibang theme choice na idinedeklara ng design system, tulad ng density, ay itinatala sa parehong paraan. Hindi isinasama ang pagpiling light o dark, dahil ipinapakita na ng larawan kung alin ang ginamit.

**Nakikita mo ang record bago may isulat.** Ipinapakita ng **Design system** card, na may tsek bilang default, ang eksaktong mga salitang ilalagay sa file, tulad ng *Records: Acme · Colourway: Beach*, at ang paglalarawan. Ang pangalan ng design system ay kung ano ang tinype ng mga may-ari nito, at ipinapakita ng card ang pangalan ayon sa pagkakasulat. Alisin ang tsek sa card para hindi isama ang record sa export na iyon. Inililista ng document panel ng Lolly Design ang parehong mga salita sa ilalim ng *Embedded in exports*.

**Inilalagay ng paglalarawan ang colourway sa tabi ng tool.** Kapag may tsek ang card, ang *"Ginawa gamit ang https://lolly.tools : Chart"* ay nagiging *"Ginawa gamit ang https://lolly.tools : Chart (Beach colourway)"*. Nananatili sa record ang sariling pangalan ng design system, hindi sa paglalarawan. Hindi nagbabago ang paglalarawang walang pangalan ng tool, o ang isinusulat ng tool mula sa sarili nitong mga input. Walang colourway na itinatala ang tool na hindi sumusunod sa mga colourway sa pamamagitan ng `tokenAxes`, at sinusunod ng PDF proof credit (ang `prov` print mark) ang parehong tuntunin.

::: details Mga brand skill, brand page at partner company sa record
**Mga brand skill na gumabay sa isang agent.** Kapag agent ang gumawa ng piraso at pinangalanan nito ang mga [brand skill](/info/brand-skills.html) na binasa at sinunod nito, inililista rin ng record ang bawat skill kasama ang revision nito, tulad ng *Ginabayan ng: acme-brand 1.0*. Ibig sabihin ng mga salita na ginabayan ng skill ang gawa. Hindi sinusuri ng Lolly ang piraso ayon sa isang skill. Sariling pahayag lang ng agent ang nagdaragdag ng listahan. Sa ngayon, iyon ang `brandSkills` argument ng `lolly_render` ng [MCP server](/info/mcp.html), kaya wala nito ang pirasong ginawa sa app o mula sa share link. Hawak ng Content Credential ang listahan bilang `brandSkills`, isang JSON value na may id, pangalan, revision at SHA-256 hash ng bawat skill. Hawak ng XMP packet at SVG metadata ang parehong value bilang `lolly:BrandSkills`. Ang PDF na isinulat mula sa record ay nagkakaroon ng isang keyword bawat skill. Hindi nagbabago ang paglalarawan. Hindi kailanman itinatala ang text ng internal na skill. Inaalis ng parehong mga switch ang listahan kasama ng natitirang record: ang **Design system** card, `_madewith=0`, `--no-madewith` at `madeWith: false`. Kapag iginuguhit ng MCP server ang file sa browser (PDF, JPEG at iba pang format na hindi maisulat ng paraan nito na walang browser), walang listahan ang sariling metadata ng file. Content Credential lang ang puwedeng humawak ng listahan roon. Ipasa ang `c2pa` para mapanatili ang record. Kapag walang credential, nagbababala ang render na hindi naitala ang mga brand skill.

**Ang brand page, kapag pinili ng publisher na isama ito.** Puwedeng piliin ng publisher ng design system na itala ang address ng [brand page](/info/brand-page.html#lead-back-from-your-files) nito sa mga export. Bawat design system ang saklaw ng setting at naka-off ito bilang default. Idinaragdag ng card ang address sa parehong linya, tulad ng *Records: Acme · Colourway: Beach · Brand page: https://acme.example/brand/acme/*. Inaalis ng pag-alis ng tsek sa card ang address kasama ng iba pa. Hawak ng record ang address at wala nang iba tungkol sa page. Wala nang ibang nagbabago sa file. Ang design system na walang address ay nagsusulat ng parehong file tulad ng dati.

**Hindi sumasama ang address sa pack.** Ang record sa isang pinirmahang file ay itinuturing na sariling record ng pumirma. Hindi dapat kusang ma-on ang address para sa isang taong hindi pumili ng address na iyon, at hindi dapat magawang ituro ng pack ang mga file ng ibang tao sa page na pinili nito. Ang `.lolly` pack, kopya o fork ng design system, **Try these colours**, na-restore na backup at tokens file na ibinigay para sa isang run ay lahat dumarating na naka-off ang setting. Puwede mong i-on mismo ang setting, gamit ang address na ita-type mo. Ang managed na design system ang tanging pagbubukod: pinapanatili nito ang address na itinakda ng manager nito sa source tokens. Nasa [Pabalik na link mula sa mga file mo](/info/brand-page.html#lead-back-from-your-files) ang mga detalye.

**Ang partner company, sa isang Lolly Work partner programme.** Itinatala ng pirasong ginawa para sa partner company ang kumpanya at programme nito sa parehong linya, tulad ng *Records: Acme · Colourway: Beach · Partner: Northwind IT (Resellers, EMEA)*, kasama ang revision ng mga detalye ng kumpanya sa file. Walang tao, detalye sa pakikipag-ugnayan, address o currency sa record. Kapag nakakabit ang partner kit ng kumpanya, idinaragdag ng linya ang revision ng kit, tulad ng *, kit revision 2*, at hawak ng credential ang id at revision ng kit, hindi kailanman ang mga kulay o tuntunin nito. Inaalis ng pag-alis ng tsek sa card ang partner kasama ng natitirang record. Nagkakaroon ang PDF ng keyword na *Partner: Northwind IT*, at ipinapakita ng [Lolly Verify](/info/what-verify-checks.html#partner) ang record bilang **Partner** ([Ang partner record sa mga file](/info/manage/partner-programmes.html#the-partner-record-in-files)).
:::

**Muling pagbasa sa record.** Inililista ng [Lolly Verify](/#/verify) ang record bilang **Design system** sa mga detalye ng credential ng file at ang anumang brand skill bilang **Guided by**. Hiwalay na lumalabas ang brand page, bilang [record ng address mula sa pumirma](/info/what-verify-checks.html#brand-page). Muling binubuksan ng *Recreate with these settings* ang tool sa naitalang bersyon at colourway. Bumubukas ang link gamit ang naitalang design system kapag may hawak ang device na ito na may parehong id at pangalan; kung wala, bumubukas ito gamit ang aktibo mong design system.

::: details Ano ang isinusulat at saan, at aling mga run ang hindi nagsasama ng record
| Saan | Ano ang isinusulat |
|---|---|
| Content Credential | `designSystem` (ang id), `designSystemLabel`, `designVersion` at `themes` sa `tools.lolly.export` assertion, bawat isa ay plain text value; ang `themes` ay JSON list ng mga pagpipilian. `brandPage` kapag pinili ng publisher na isama ito |
| PNG, JPEG, WebP at JXL | Ang parehong mga value bilang mga `lolly:` property ng XMP packet ng file, sa namespace na `https://lolly.tools/ns/export/1.0/`. `lolly:BrandPage` kapag pinili ng publisher na isama ito |
| SVG | Ang parehong mga `lolly:` property sa loob ng `<metadata>` block |
| PDF | Mga keyword tulad ng *Design system: Acme*, *Colourway: Beach* at, kapag pinili ng publisher na isama ito, *Brand page: https://acme.example/brand/acme/* |
| Bawat format na may description field | Ang paglalarawan, na may colourway sa tabi ng tool |

Lumalabas lang ang card kapag may maitatala at kayang hawakan ng format ang record. Walang metadata ang CSV, JSON, calendar file at iba pang text o data format, at walang field para sa record ang EPS, EMF, DXF at BMP. Sa Content Credential lang hinahawakan ng HTML, Markdown at CSS ang record, kaya para sa mga ito, walang linya ng paglalarawan ang card at nakatago ito habang naka-off ang **C2PA Credentials**. Hindi isinasama sa file ang field na hindi ibinibigay ng design system.

Ino-off ng share link ang record gamit ang `_madewith=0` ([Mga URL parameter](/info/url-parameters.html)). Tumatanggap ang command line ng `--no-madewith`, tumatanggap ang `lolly_render` ng [MCP server](/info/mcp.html) ng `madeWith: false` at may **Design system** row ang export panel ng terminal app. Ini-print ng command line sa standard error ang mga salitang nasa tapos na file, para sa render ng tool at para sa bawat file na ine-export ng `lolly run` mula sa na-save na Lolly Design session. Ini-print ng MCP render ang mga salita sa tabi ng file. Pareho nilang muling binabasa ang mga salita mula sa file. Walang file metadata ang PNG na iginuguhit ng command line nang walang browser, kaya sa credential lang sumasama ang record nito. Walang idinaragdag na metadata ang mga utility sa device.

Hindi isinasama ng mga run na walang **Design system** card ang record: isang Lolly Batch run, folder na na-export mula sa Projects at isang 3D collection export, at sa terminal app ay CSV batch, Projects folder o selection export at ang view na nagre-render ng lahat. Mag-export ng isang file mula sa tool para itala ang design system.
:::

### Content Credentials (C2PA)

Puwedeng may **Content Credentials** ang mga export: isang pinirmahang [C2PA](https://c2pa.org) manifest na nagtatala kung ano ang gumawa ng file, kailan at saan, na nakatali sa hash ng mga byte ng file para matukoy ang anumang pagbabago pagkatapos. Nagsusulat ang Lolly ng mga standard na manifest na masusuri ng anumang C2PA reader.

![Ang C2PA Credentials card, may tsek, na may haba ng bisa ng credential sa tabi ng checkbox](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Naka-on bilang default.** May tsek ang **C2PA Credentials** card para sa halos bawat tool. Alisin ang tsek para sa isang export, o ipasa ang `c2pa=off` sa link. Mawawalan ng credential ang file, at ang SVG na naglalagay ng artwork na may credential sa mismong nilalaman nito, tulad ng logo sa catalog, ay mawawalan din ng credential ng artwork na iyon. Nananatili ang Lolly Imprint at ang iba pang metadata ng file. Puwedeng piliin ng tool na hindi isama ito sa manifest nito.
- **Mga format.** PDF (RGB at Print), PNG at APNG, JPG, GIF, SVG at SVGZ, TIFF (RGB at Print), WebP (still at animated), AVIF, MP4, WebM, HTML, Markdown, CSS at ang mga audio container na MP3, WAV, M4A, OGG/Opus at FLAC. Nilalagyan ng ZIP ang bawat suportadong miyembro nito, kaya nagkakaroon ng credential ang Animated SVG. Ginagamit ng MP4, AVIF at M4A ang standard na BMFF binding at ng MP3 ang ID3v2 mapping nito, kaya nave-verify sila ng `c2patool` at iba pang reader. Wala pang standard na mapping ang WebM at OGG/Opus, kaya inilalagay ng Lolly ang manifest bilang Matroska attachment at OpusTags field, na sinusuri ng sariling verifier ng Lolly. Ang SVGZ ay compressed na SVG. Walang tinutukoy na compressed na anyo ang C2PA specification, kaya isinusulat ang credential sa SVG bago i-compress. Binabasa ng verifier ng Lolly ang file kung paano ito naroon; binabasa ng `c2patool` ang parehong credential kapag na-decompress na ang file (`gunzip`). Walang C2PA container ang ICO, EPS, EMF, DXF, BMP, PPTX, mga Office format at iba pang text at data format.
- **Ano ang itinatala nito.** Ang tool at app na gumawa ng file, ang oras ng pagpirma at ang shell na nag-export ng file. Para sa Lolly Design page na na-export bilang larawan, SVG o PDF, ang renderer na gumuhit ng page (`route` sa `tools.lolly.export` assertion: `gpu` para sa GPU page renderer, `operations` para sa mga drawing operation na isinulat bilang mga vector, `compatibility` para sa sariling renderer ng browser) at ang bersyon ng renderer na iyon (`renderer`: ang GPU recipe, `design-draw-v` at ang bersyon nito, o `dom-to-image` at `dom-walker`). Ang [design system at colourway](#the-design-system-record) habang may tsek ang **Design system** card. Ang mga aktibong setting: mga pagpipilian sa menu, numero, switch at kulay ayon sa mga ito, at anumang tinype (mga pamagat, pangalan, tala, link at petsa) bilang fingerprint lang, kaya wala sa file ang mga salita. Hindi isinasama ang mga field na nakatali sa profile, hindi aktibong kontrol, bersyon ng browser at detalye ng operating system. Lumalabas lang ang pangalan at email mo bilang may-akda kapag naka-on ang **Use my details to create** sa Settings → Preferences → Your details. Sumasama bilang mga ingredient ang mga source na inilalagay ng export. Bawat larawan sa page na may sariling Content Credential ay itinatala bilang bahagi ng page, kasama ang credential na iyon at anumang AI source type na idinedeklara nito. Ganito sa PNG, JPEG, WebP, AVIF, TIFF, SVG o PDF, at sa GIF, APNG, animated WebP, MP4 o WebM kapag iginuhit ang larawan sa kahit isang frame ng na-export na saklaw. Ang isang larawang binabago ng tool tulad ng Darkroom, Filter o Asset Export ay itinatala sa halip bilang parent ng file, binubuksan muna at sinusundan ng ginawa ng tool sa larawan. Ang iba pang ingredient ay [mga gawang binigyan ng credit](#source-credits) tulad ng emoji, [mga kanta ng Lolly Rondocode](/info/rondocode.html#songs-in-the-credential) sa video o audio export at [mga na-save na tugtugin](/info/generated-music.html#what-a-track-records) sa video o audio export. Bawat na-save na tugtugin ay may pangalan nito, lisensya kapag nagtala nito ang tugtugin, SHA-256 ng recipe nito, bersyon ng engine at algorithmic media. Idinaragdag lang ang gumawa ng na-save na tugtugin (ang pangalan sa profile noong na-save ito) habang naka-on ang **Use my details to create**, tulad ng sarili mong pangalan. Saka lang ipinapakita ng export panel ang gumawa bago ka mag-export.
- **Isang approval, kapag may naitala.** Puwedeng may pangalawang pinirmahang record sa ibabaw ng credential na ito ang file na naaprubahan sa pamamagitan ng [Lolly Work](/info/work-approvals.html#review-an-exported-file): ang approval id, petsa ng desisyon at digest ng file na sinuri. Wala itong mga pangalan, email, group, komento o pangalan ng chain. May tsek ito bilang default sa request dialog at puwedeng alisin ang tsek para sa isang request o i-off para sa isang instance. Itinatala nito na nagpahayag ng desisyon ang isang pumirma. Hindi nito sinasabing nakakatugon ang gawa sa anumang pamantayan.
- **Ano ang ipinagawa rito, para sa file na ginawa mula sa isang [intent](/info/visual-intent.html#what-goes-in-the-file).** Ang layunin, surface, tool, wika, mga bersyon ng tuntunin at bokabularyo at ang intent digest. Fingerprint lang ang okasyon, audience, rehiyon at prompt, maliban kung hilingin ng tao o agent na nagpapatakbo ng render na iyon na itala ang mga salita ng prompt. Ang render lang na nagsimula sa intent ang may record na ito. Sinasabi ng run kung ano ang naitala nito, at puwedeng hindi isama ang record.
- **Ano ang nakikita ng mga tatanggap.** Binabasa ng mga C2PA tool tulad ng Adobe apps, `c2patool` at contentcredentials.org/verify ang manifest at ipinapakita ang claim. Pumipirma ang Lolly gamit ang key na ginawa sa device mo, hindi certificate mula sa trust list, kaya iniuulat ng mga viewer ang credential bilang *hindi na-verify*. Valid ang istruktura at ebidensya ng pakikialam, pero walang gumagarantiya sa pumirma. Para baguhin iyon, mag-enrol ng **verified identity** sa Settings → Preferences → Content Credentials; tingnan ang [Content Credentials Identity](/info/content-credentials-identity.html).
- **Pagsusuri ng file.** Mag-drop ng anumang file sa [Lolly Verify](/#/verify), o patakbuhin ang `lolly validate <file>`, para sa ulat sa device na inuuna kung ginawa ng Lolly ang file at kung nagbago ito mula noon. Sinusuri rin ng Lolly Verify ang higit pa sa credential; tingnan ang [Ano ang sinusuri ng Lolly Verify](/info/what-verify-checks.html).
- **Privacy.** Ginagawa ang signing key para sa export at hindi ito kailanman umaalis sa device mo. Hawak lang ng claim ang dati nang nasa metadata ng pinagmulan. Walang idinaragdag na credential ang mga privacy utility na nagbabago ng sarili mong mga file, at inaalis ng *Lolly Strip Hidden Data* ang C2PA manifest tulad ng anumang ibang metadata. Gumagawa ng bagong audio ang Rondocode utility, kaya pinipirmahan nito ang isinusulat nito ([Mga kanta ng Lolly Rondocode](/info/rondocode.html#files-from-the-rondocode-utility)). Pinipirmahan ng music generator ang bawat WAV o M4A download. Itinatala ng credential na ginawa ng music generator ng Lolly ang track at ang lisensyang saklaw ng musika, CC BY 4.0, kasama ang credit nito ([Ano ang itinatala ng track](/info/generated-music.html#what-a-track-records)).
- **Mga interaksyon.** Hindi puwedeng magkaroon ng Content Credentials ang PDF na protektado ng password, sa alinmang tier. Huling idinaragdag ang credential, sa ibabaw ng mga tapos na byte, pagkatapos ng DPI, EXIF, color profile, PDF/X metadata at print mark.

### Mga credit sa source

Itinatala sa credential ng export ang source kapag naglalagay ito ng gawa ng ibang tao. Karaniwang halimbawa ang emoji mula sa napiling emoji set: ang gawa, gumawa nito, lisensya, pinanggalingan ng eksaktong mga byte at mga binago ay lahat sumasama sa file. Pinapanatili ng text sa tool na SVG ang template ang sariling emoji ng system, kaya walang binibigyan ng credit doon. Bago ka mag-download, sinasabi ng **Source credits** row kung ano ang hinihingi ng mga source sa paghahatid. Pagkatapos ng download, muling binabasa ng row ang mga naihatid na byte bago nito sabihing nasa file ang mga credit. Ang lisensyang humihiling sa iyong pumili, tulad ng CC BY-SA glyph na binago ang kulay na ibabahagi mo, ay nagkakaroon ng card na may mga pagpipilian. Hindi kailanman hinaharangan ang download. Nasa [Mga karapatan at credit sa likhang gawa](/info/creative-rights.html) ang mga salita, ang mga nasuring lisensya at kung ano ang nananatiling sa iyo.

<!--i:eti-lock-->
## Proteksyon ng password

Gumagawa ang Lolly ng dalawang uri ng lock, pareho sa device mo. Itinatakda ng **Password** card ng export panel ang dalawa.

![Ang Password card na pinalawak sa isang PDF export, na may password field at dalawang lock tier](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**Ang password sa pagbubukas ng PDF** ay may dalawang tier kapag nag-type ka ng password:

- **Weak**: 40-bit RC4, para sa RGB `pdf` na walang print mark o bleed at may plain ASCII na password. Lumilipat sa Strong ang password na may ibang character, dahil hindi mabubuksan ng mga reader ang file na ni-lock nang ganoon sa tier na ito. Unang 32 character lang ang binibilang.
- **Strong**: AES-256 (PDF 2.0). Naaangkop din ito sa mga Print PDF at sa bawat PDF sa loob ng batch ZIP. Pinapanatili ng Print PDF na ni-lock gamit ang Strong ang CMYK, mga mark at output intent nito pero inaalis ang PDF/X-4 claim.

::: warning Pampahirap lang ang Weak, hindi proteksyon
Gamitin ang **Strong** para sa kumpidensyal na file.
:::

**Ang naka-lock na ZIP** ay sumasaklaw sa ZIP export, folder download mula sa Projects o batch, na may isang password sa dalawang tier: **Weak** (ZipCrypto, pampahirap lang) o **Strong** (AES-256). Pinoprotektahan ng password ang bawat miyembro. Bawat PDF sa loob ay hiwalay ding naka-lock gamit ang AES-256, kaya nananatiling naka-lock ang PDF pagkatapos i-unpack ang ZIP. Lumalabas ang prompt kapag nagsimula ang download. Walang lock kapag blangko ang password.

**Hindi isinasama sa mga link ang tinype na password sa parehong tier.** Kapag dumating ang file sa pamamagitan ng `?password=` link, binabasa ng Lolly ang value at agad itong inaalis sa address. Ang link na humihiling ng lock na hindi kayang hawakan ng file nito ay walang isinusulat na file at sinasabi kung bakit (tingnan ang [`password`](/info/url-parameters.html)).

**Ang share link na may password** ay humihingi ng password sa tatanggap bago ito bumukas. Ine-encrypt ang state ng link gamit ang AES-256 sa ilalim ng key na hinango mula sa password (PBKDF2). Ciphertext lang ang ipinapasa, at nangyayari ang decryption sa browser ng tatanggap. Hindi kailanman nakikita ng server na naghahatid ng link ang password o ang design. I-on ito sa **Share** dialog. Sa Lolly lang bumubukas ang encrypted na link, hindi kailanman bilang naka-embed na larawan. Tingnan ang [URL Mode](/info/url-mode.html).

<!--i:eti-monitor-->
## Sa phone

Nasa likod ng lumulutang na **Export** button ang mga kontrol sa export, na nagbubukas ng **Export** sheet: ang parehong mga format, laki, copy, download at share, na ang laki ay para sa touch.

<!--i:eti-code-->
## Mga format id para sa mga link at sa CLI

Ito ang mga value para sa URL `format=` parameter at CLI `--export=` flag (tingnan ang [Mga URL parameter](/info/url-parameters.html) at [CLI](/info/cli.html)). Ipinapakita lang ng menu ng tool ang mga format na kayang gawin ng tool na iyon.

| Uri | Mga id |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vector | `svg` · `svgz` (SVG na naka-gzip) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (cut file) |
| Page at dokumento | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (Penpot design file) · `scorm` (course package, isang ZIP) |
| Motion | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| Audio | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` · `mid` (mga MIDI note, mula sa Lolly Rondocode) |
| Text at data | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `ttml` · `scc` · `css` · `scss` · `gpl` (GIMP palette) |
| Mga bundle at package | `zip` · `rpm` at `tar.gz` (ang render na naka-seal sa Linux package) |

May ilang id na galing sa sariling export code ng tool: `ase` (Adobe Swatch Exchange, mula sa Lolly Palette Lab) at `exr` at `hdr` (mga high-dynamic-range raster, mula sa Lolly Darkroom). Nagsusulat ang **Convert Font** ng `ttf`, `otf` at `woff` mula sa font file na ibinibigay mo, kaya walang mairender ang tool mula sa isang link lang.
