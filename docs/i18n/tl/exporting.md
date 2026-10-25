# Mag-export ng file

May ginawa ka at kailangan na nitong lumabas sa Lolly: PNG para sa chat, PDF para sa printer, deck na ipagpapatuloy i-edit ng kasamahan. Pindutin ang **Export**, ang kaliwang kalahati ng **Export | Save** pill. Pumili ng format sa tabi ng file name, saka pindutin ang **Download**. Ginagawa ang file sa device mo.

Ang nakikita mo sa canvas ang laman ng file. Inililista lang ng format menu ang kayang gawin ng tool na ito sa browser na ito.

Para sa karamihan ng trabaho, isa sa tatlong format ang tama:

| Para sa | Piliin | Dahil |
|---|---|---|
| Isang screen, mensahe o slide | **PNG** | Nabubuksan ito ng bawat app, at pinananatili nito ang transparent na background kapag inaalok ito ng tool |
| Isang tapos na page, o anumang ipi-print | **PDF** | Tunay na page size na nagpi-print kagaya ng tingin nito; ang **Print PDF**, kung saan inaalok ito ng isang tool, ay ang CMYK na bersyon para sa isang press |
| Artwork na dapat manatiling matalas sa kahit anong sukat | **SVG** | Vector shapes, malinaw mula sa isang badge hanggang sa isang banner |

::: check Suriin ang file sa sukat na gagamitin dito
Bago mo ito ipadala, buksan ito sa screen na ginawan nito, o i-print ito sa tunay na sukat nito.
:::

::: details Mga approval at delivery gamit ang Lolly Work (opsyonal)
Ang [organisasyong nagpapatakbo ng Lolly Work](/info/organisation.html) ay maaaring mamahala kung aling mga format at export setting ang nakikita ng mga miyembro nito. Kung kailangan ng approval, ang **Request approval** ang pumapalit sa **Download**. Sundin ang policy na ipinapakita ng instance mo.

Maaari ring maghatid ang Lolly Work ng file sa mga naka-configure na S3, WebDAV at HTTP na destinasyon, na may mga hakbang sa approval, delivery receipt at audit record. Ang pagsusumite ng file para sa workflow na iyon ay nagpapadala nito sa serbisyo ng organisasyon; ang karaniwang download ay nananatili sa device mo. Hiwalay na kino-configure ang mga personal na Send destination at organisation delivery.

Itinatakda ito ng mga operator gamit ang [organisation delivery guide](/info/work-delivery.html). Para sa mga queued na server render at batch, tingnan ang [CLI batch at automation](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

## Paano Gumagana ang Export

Kapag nag-export ka, nire-render ang canvas ng tool sa format na pinili mo at ibinibigay sa iyo bilang download, o inilalagay sa clipboard mo.

Tatlong daan ang gumagawa ng file. Karamihan ng tool ay **nagre-render ng canvas**. Ang mga text at data format (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) ay **binubuo mula sa nilalaman ng tool** sa halip na iginuguhit mula sa larawan. Ang mga privacy utility tulad ng *Strip Hidden Data* ay **nagbabago ng file na pinili mo**, sa device mo, at ibinabalik ito nang walang canvas, watermark o idinagdag na metadata, dahil sarili mo na itong file.

![Tatlong export path ang nagtatagpo sa isang tapos na file: i-render ang canvas, bumuo ng text o data mula sa nilalaman, o baguhin ang napiling file sa device.](/info/diagrams/concepts/three-export-paths.svg)

Nag-aalok ang export panel ng mga aksyong ito. Ang may-akda ng tool ang pumipili kung alin ang lalabas; ang default na set ay Copy, Download at Save.

- <!--i:download--> Sine-save ng **Download** ang file. Kung hindi mo ito makita pagkatapos, tingnan ang [Hanapin ang na-download mong file](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> Inilalagay ng **Copy** ang larawan sa clipboard mo, handang i-paste sa chat, email o dokumento. Kung hindi kayang mag-copy ng larawan ang browser, nagda-download ito sa halip at sinasabi sa iyo.
- <!--i:folder--> Iniingatan ng **Save** ang kasalukuyang design sa Projects sa isang click at hindi kailanman nagda-download ng file. Ang **Save as**, sa tabi ng **Download**, ay nagtatanong kung saan (tingnan ang [Saving and continuing](/info/using.html#saving-continuing)).
- <!--i:link--> Binubuksan ng **Share** ang Share dialog: link na umuulit sa design, ang mga on-visit toggle (fullscreen, export panel, download o copy kapag binuksan) at opsyonal na **Shortest link** na nagpa-pack ng buong state sa compact na token (tingnan ang [URL Mode](/info/url-mode.html)).

![Ang export panel - format, laki at ang mga aksyong Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Kapag nag-embed ang design ng render ng ibang tool, tulad ng Design image box na may hawak na QR Code link, ang nested na render ay iginuguhit sa export ng parent. Nananatili itong tunay na vector sa SVG at PDF at malinaw na nagra-rasterise sa PNG, JPG at WebP. Ang naka-embed na render ay walang watermark at walang sariling provenance; ang tapos na file lang ang mayroon. Hindi kayang hawakan ng mga HTML, Markdown at TXT export ang composed na render.

## Pumili ng format

Magkasama ang pangalan ng file at ang format menu bilang isang `name.format` pair, sa ilalim ng **I-download**.

![Ang filename field na kaisa ng format picker, kaya ang export ay nababasa bilang isang name.format pair](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Magsimula sa kung saan pupunta ang file. Inililista ng bawat card ang mga format na bagay sa destinasyong iyon; ipinapakita lang ng tool ang kaya nitong gawin.

::: figure exporting-format-chooser
Anim na destinasyon at ang mga format na bagay sa bawat isa.
:::

Ang wordmark na nakatakda sa face ng design system mo ay nag-e-export bilang SVG na ang bawat letra ay outlined na path, kaya ang isang file ay nananatiling matalas sa laki ng business card at sa laki ng building wrap.

![Isang hairline na malapad ang tracking na wordmark na nagsasabing Aurora, ang uri ng purong vector artwork na tinutukoy ng SVG row ng table](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Bawat format at para saan ito
| Gusto mo | Gamitin | Bakit |
|---|---|---|
| Matatalas na logo o artwork na nag-i-scale | **SVG** | Vector: nasusukat, maliit at mae-edit; ang epektong hindi kayang iguhit ng vector export ay ine-embed bilang larawan |
| Vector para sa Office at Windows app | **EMF** | Nape-paste bilang mae-edit na vector sa PowerPoint at Word, na may live text; binubuksan ito ng Google Drive sa Google Drawings |
| Vector para sa print at design app | **EPS**, o **EPS (CMYK)** | PostScript vector para sa Illustrator at press workflow |
| Vector para sa cutting machine | **DXF** | Laser cutter, vinyl plotter at CNC: outline path sa millimetro |
| Mae-edit na slide deck | **PowerPoint** (PPTX) | Native na mae-edit na text at hugis, kasama ang mga larawan at vector na nananatiling makukuha |
| Mae-edit na text document | **Word** (DOCX) o **OpenDocument** (ODT) | Tunay na mga talata at heading na maipagpapatuloy i-edit ng word processor (Doc Studio) |
| Layout para sa InDesign | **InDesign IDML (static subset)** | Text, parihaba, oval at larawan, isang spread bawat artboard (Design) |
| Mae-edit na Penpot document | **Penpot** | Mga board, hugis, text at naka-link na token |
| Litrato o pangkalahatang larawan | **PNG** (lossless) o **JPG** (mas maliit) | Pangkalahatang raster |
| Mas maliliit na modernong larawan | **WebP** o **AVIF** | Mas mahusay na compression, may transparency |
| Print | **PDF**, o **Print PDF** (CMYK) | Tunay na laki ng page; CMYK para sa press |
| Print raster para sa press | **Print TIFF** (CMYK) | DeviceCMYK pixel para sa RIP |
| Animated para sa web | **GIF** | Tumutugtog saanman; mas malalaking file |
| Animated na may buong kulay at tunay na transparency | **APNG** | Animated PNG: walang limitasyon sa palette |
| Animated, pinakamaliit na file | **Animated WebP** | Buong kulay at transparency, mas maliit kaysa GIF o APNG |
| Animated na vector na nag-i-scale | **Animated SVG** | Self-contained; umuulit sa browser o sa `<img>`, sa anumang laki (Lottie Ad) |
| Animation na nananatiling mae-edit | **dotLottie** | Mga hugis, path at outer transform key mula sa timeline ng Design |
| Hand-off sa Premiere | **Premiere XML + media** | Mga timed na clip at orihinal na media para sa Premiere (Design) |
| Video para sa social at pagbabahagi | **MP4** o **WebM** | Pinakamagandang kalidad para sa laki ng file (tingnan ang [Video](#video)) |
| Mga caption | **SRT** o **VTT** | Timed na text para sa video player (Captions, Audiogram at Record) |
| Kurso sa pagsasanay | **SCORM (LMS)** | Versioned na website, SCORM o xAPI package (tingnan ang [SCORM](#scorm-course-packages)) |
| Rich text o email signature | **HTML** | Nape-paste na may format sa mga mail client |
| Payak na nilalaman | **MD** o **TXT** | Text lang |
| Kaganapan sa kalendaryo | **ICS** | Naii-import sa anumang calendar app |
| Contact card | **VCF** | Naii-import sa mga address book |
| Structured na data na ii-import muli | **JSON** o **CSV** | Bumabalik-balik ang nilalaman ng tool |
| Favicon | **ICO** | Multi-size na site icon; ang **ZIP** ay nagbibigkis ng ilang format |
:::

### Transparency

Ang mga tool na sumusuporta rito ay nag-aalok ng transparent background toggle, tulad ng **No BG**. Pinapanatili ng PNG, WebP, AVIF, SVG, APNG at Animated WebP ang transparency, at ang GIF ay nagpapanatili ng matigas na gilid. Laging opaque ang JPG at PDF. Ang TIFF ay nagfa-flatten sa puti, o sa itim sa HDR path na inilalarawan sa ilalim ng [HDR](#hdr-bright-colours).

## Laki at mga print unit

Ginagamit ng mga export ang native na pixel size ng tool maliban kung nag-aalok ang tool ng **dimensions**. Pagkatapos, itatakda mo ang lapad, taas at **unit**:

- Ang **px** (ang default) ay eksaktong pixel.
- Ang **mm, cm, in, pt** at **pc** ay pisikal na laki. Sa pisikal na unit, itinatakda mo rin ang **DPI** (300 bilang default). Ang **PDF** ay nagiging tunay na page sa laking iyon, ang **raster** ay nakakakuha ng bilang ng pixel para sa DPI na iyon at itinatala ang resolution, at ang **SVG** ay nagpapanatili ng pisikal na unit na may pixel viewBox.

Para sa raster na mas mataas ang resolution, maglagay ng mas malaking lapad at taas, o pumili ng pisikal na unit at taasan ang DPI (pixel = laki × DPI). Ang lapad na `210`, taas na `297` at unit na `mm` ay gumagawa ng A4 na page.

![Ang dimensions row na naka-set sa 210 by 297 mm, na lumitaw ang DPI field dahil pisikal ang unit](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Mga Still Mula sa Naka-time na Komposisyon

Ang timed na komposisyon, tulad ng [Sequence](/info/sequence-editor.html) timeline sa Design, ay gumagalaw, kaya ang still export ay kailangang pumili ng sandali: **ang frame sa playhead**. Iparada ang playhead kung saan mo gusto ang larawan at mag-export.

Para sa higit sa isang sandali, lumilitaw ang **Frames** field sa tabi ng output size. Ipinapakita lang ito para sa timed na komposisyon at still format (PNG, JPG, WebP, SVG o PDF). Iwanan sa `1` para sa playhead frame. Taasan ito at makakakuha ka ng ganoong karaming still, pantay na nakakalat sa buong sequence:

- Ang PNG, JPG, WebP at SVG ay bumabalik bilang isang ZIP: `<name>-01.png`, `-02.png` at iba pa.
- Ang PDF ay bumabalik bilang isang dokumento na may ganoong karaming page.

Ang bawat still ay galing sa gitna ng hiwa nito ng timeline, kaya ang unang frame ay hindi kailanman kalahating-kupas na pagpasok at ang huli ay hindi kailanman ang walang lamang sandali pagkatapos matapos ang bawat clip.

::: figure exporting-contact-sheet
Frames: 4 ay hinahati ang sequence sa apat na pantay na hiwa at kinukuha ang gitna ng bawat isa.
:::

Gamitin ito para sa storyboard, review contact sheet o social carousel na hiniwa mula sa video edit. Ang bilang ay may hangganang 64, at anumang ibang tina-type sa field ay bumabalik sa `1`. Ang bawat frame ay karaniwang still, kaya ang mga credential, ang Imprint, mga pisikal na unit at DPI ay kumikilos tulad ng sa isang export. Ang export link, ang CLI at ang MCP ay humihingi ng parehong sheet gamit ang `cuts=` (tingnan ang [Contact sheets](/info/url-export.html#contact-sheets)).

## Maraming file nang sabay

May tatlong paraan ang Lolly sa paggawa nang maramihan, bawat isa para sa magkaibang trabaho:

::: cols
## Ang table ay nagiging isang dokumento
Ang tool na may table input, tulad ng **Battlecards**, ay ginagawang page ang bawat row. Mag-paste ng table mula sa spreadsheet mo at makakuha ng isang PDF. Ayusin ang mga row sa spreadsheet at mag-paste muli.
## Ang CSV ay nagiging isang file bawat row
Ang **Batch** (`#/batch`) ay kumukuha ng CSV at nagre-render ng isang export para sa bawat row: mga name badge o sertipiko, isang file bawat isa, inihahatid sa ZIP. Tingnan ang [Batch](/info/batch.html#make-many-versions-of-one-design).
## Ilang design, isang edit
Ang **Multi-edit** ay nagbubukas ng ilang naka-save na session nang magkatabi para sa parehong ayos sa iba't ibang design. Tingnan ang [Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Mula sa **Projects**, ine-export ng **Render folder** ang bawat naka-save na session sa folder at mga sub-folder nito bilang isang naka-nest na ZIP, at ginagawa ng **Render selection** ang pareho para sa anumang multi-selection; ang isang naka-save na session ay nagre-render sa sarili nitong file. Ang naka-save na session ay maaari ring ibahagi muli bilang tool link mula sa Projects, na muling nagbubukas nito na may parehong setting.

## Mga file na nananatiling mae-edit sa iba

Ang ilang format ay ipinapasa ang gawa mo sa ibang application bilang mae-edit na nilalaman sa halip na larawan.

### PowerPoint (PPTX)

Ang Design, Markdown Slides, Booklet, Doc Studio, Chart, Diagrams, Flow Chart at Agenda ay nag-e-export ng PowerPoint deck, isang slide bawat page. Ang bawat page ay hinihiwalay sa mga native na bagay, para maka-edit ang kasamahan ng deck at makakuha ng mga asset mula rito:

- <!--i:font--> Ang **Text** ay nagiging mae-edit na PowerPoint text box na may laki ng font, kulay, bigat, italic at alignment ng layout.
- <!--i:pentool--> Ang **Mga vector** tulad ng logo at icon ay ine-embed bilang SVG picture; nananatili silang matalas, at kayang *Convert to Shape* ng PowerPoint ang mga ito.
- <!--i:photos--> Ang **Mga larawan** ay dumarating sa native na resolution bilang sarili nilang larawan. Ang ginupit na hero ay nag-iingat ng buong larawan sa likod ng gupit, at ang anumang filter o blend dito ay naka-bake na.
- <!--i:layers--> Ang **Mga background, border at rule** ay nagiging parihaba at linyang hugis.

![Ang export panel na napili ang PowerPoint: isang slide bawat pahina, nananatiling nae-edit ang text at mga shape](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Tinatayang layout lang; ang layunin ay magagamit muling nilalaman. Anumang hindi kayang ipahayag nang native ng walker, tulad ng kumplikadong filtered o masked na rehiyon, ay ine-embed bilang larawan para walang mawala. Ang deck ay may iisang laki ng slide, kinuha mula sa unang page.

Daan din papasok ang PowerPoint: inililipat ng [Rebrand a deck](/info/rebrand.html) ang deck sa design system mo, at binubuksan ng [Import a design](/info/design-import.html) ang isa sa Design.

### Penpot

Karamihan ng tool na nag-e-export ng SVG ay nag-e-export din ng **Penpot file** (`.penpot`), handang ituloy ang pag-edit sa Penpot.

| Ang ginawa mo | Sa Penpot |
|---|---|
| Text | Mae-edit na text object: ayusin ang typo o i-restyle |
| Mga hugis, path, gradient at larawan | Sarili nilang mae-edit na vector shape |
| Kulay o font mula sa design-system token | Live na token link: i-edit ang token at susunod ang bawat hugis na nagmamana nito |
| Ang buong design | Magagamit muling component sa Assets panel |
| Kumplikadong ilustrasyon o live canvas | Naka-embed nang mag-isa bilang larawan, hindi ginagalaw ang mae-edit na nilalaman sa paligid nito |

Mula sa Design, ang bawat frame ay nagiging Penpot board. Ang mga kulay at typography ng design system ay napupunta sa Assets panel at ang buong token set nito sa Tokens panel. Nag-iingat ang Penpot ng sarili nitong kopya mula roon: ang token na na-edit sa Penpot ay bumabalik sa pamamagitan ng import sa [Design System Setup](/info/brand-studio.html).

![Ang export panel na napili ang Penpot: ang .penpot file, at ang Send to Penpot sa tabi ng download](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Para buksan ang file, simulan ang Penpot, pumili ng project at piliin ang **Import**. Kung naka-sign in ka sa Penpot mula sa export panel, ginagawa ng **Send to Penpot** ang hakbang na iyon para sa iyo.

### Word, OpenDocument at InDesign

Ang **Doc Studio** ay nag-e-export ng **Word** (DOCX) at **OpenDocument** (ODT) na may tunay na mga talata at heading.

Ang **Design** ay nag-e-export ng **InDesign IDML (static subset)**: text, parihaba, oval at PNG o JPEG na larawan, isang spread bawat artboard. Ang sinusuportahang inline formatting ay nananatiling mae-edit, ang mga larawan ay sumasama sa `Links` at ang mga coordinate ay nagiging InDesign point. Ang relinking, font substitution at nagbagong wrapping ay maaaring mangailangan ng pansin. Ang mga epekto, animation, composed story at hindi sinusuportahang geometry ay humihinto sa export na may ulat na naglilista ng mga ito. Hindi iniingatan ng IDML ang orihinal na dokumento, kaya magpadala ng PDF para sa tapos na artwork.

### Mga timeline: dotLottie at Premiere

Mula sa timeline ng Design, ang **dotLottie** ay nagsusulat ng animation na nananatiling mae-edit sa mga Lottie tool; inililista ng [Lottie animations](/info/sequence-editor.html#lottie-animations) kung ano ang iniingatan nito. Ang **Premiere XML + media** ay nagpa-pack ng mga timed na clip at orihinal na media nila para sa Premiere; tingnan ang [Premiere XML exchange](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (mga course package)

Naka-off ang course export hanggang i-on mo ang **Training and courses** sa ilalim ng Settings → Preferences → Feature flags.

Pagkatapos, piliin ang **Export course** mula sa sinusuportahang tool, project folder o seleksyon. Sa Design, ang pagpili ng **SCORM (LMS)** at **Download** ay nagbubukas ng parehong course workflow. Sine-save ng Lolly ang gawa, hinahayaan kang i-review ang nilalaman at pagkakasunod-sunod ng kurso, saka binubuksan ang module at ang export dialog nito.

- <!--i:layers--> Pumili ng rendition para sa bawat source: still page, motion bilang video, audio o nada-download na resource. Magdagdag ng lesson text at reading alternative sa module.
- <!--i:clock--> I-preview ang learner player at i-review ang mga paglalarawan at caption. Kasama ang motion bilang video, kasama ang tahimik na animation.
- <!--i:document--> Pumili ng Website, SCORM 1.2, SCORM 2004 4th Edition o experimental na xAPI target. I-check ang nilalaman at laki ng ZIP, saka i-save at i-download ang sinuring bersyon.
- <!--i:check--> Ang pagkumpleto ay nangangailangan ng pagkilala sa bawat kinakailangang lesson at pagpili ng Finish.

![Ang export panel sa isang Design deck na napili ang SCORM (LMS)](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Hawak ng package ang tapos nitong nilalaman at hindi nangangailangan ng Lolly account. Ilagay ang Website ZIP sa HTTP(S) host; i-import ang LMS ZIP nang hindi binabago. Subukan ang destinasyon bago ibahagi ang kurso. Para sa kursong binuo mula sa ilang naka-save na likha, tingnan ang [Gumawa ng training course](/info/training-creators.html).

### DXF (mga cut file)

Ang Asset Export, Diagrams, Growth, Logo Wall, QR Code, Street Map, Wayfinding at Wordmark ay nag-e-export ng **DXF**, ang AutoCAD R12 interchange format na binabasa ng mga laser cutter, vinyl plotter at CNC software. Ang geometry ay isinusulat bilang outline path sa millimetro, outlined ang text at ang kulay ay nagma-map sa pinakamalapit na AutoCAD Color Index, na kadalasang nagtutulak sa operasyon ng cutter. Line art lang ang DXF: ang litrato o filtered na rehiyon ay walang cut path at inaalis, na may babala. Gamitin ang SVG o PDF para panatilihin ang raster na nilalaman.

Ang Street Map ang pinakamalinaw na kaso. Ang buong design ay mga stroke na, kaya ang bawat kalsada at kanal ay nagiging cut path.

::: showcase
![Isang Street Map render ng Paris sa ink sa cream - purong line art, kaya bawat stroke ay nakakaligtas sa biyahe patungo sa isang cutter](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Mag-scroll, at bumabalik ang camera papasok sa tunay na geometry: pitong paths, walang pixels kahit saan, bawat stroke ay hairline-crisp sa kahit anong zoom. Iyon ang parehong file na binabasa ng isang cutter.
:::

## Print

Ang **Print PDF** ay nagsusulat ng CMYK laban sa pinangalanang press condition, **Coated FOGRA39** bilang default. Ang mga brand swatch na may sinukat na ink value ay eksaktong nako-convert; ang ibang kulay ay gumagamit ng karaniwang device conversion. Ang **Print TIFF** ay nagsusulat ng DeviceCMYK pixel para sa RIP at itinatala ang parehong press condition sa TIFF metadata nito. Ang Colour profile control ang nagtutulak sa pareho; nasa [Mga colour profile](#colour-profiles) ang detalye.

Ang **Print marks & bleed** ay may sariling card sa mga print format: ang bleed sa millimetro kasama ang Crop, Registration, Bleed, Colour bars at Stamp details.

Ang ilang tool ay gumagawa ng **multi-page PDF**: cover, nilalamang umaagos sa kasing-daming page na kailangan at back page, tulad sa *Booklet* tool. Ang bawat page ay tunay na portrait PDF page sa A4, US Letter o A5, at puwede mong pilitin ang anumang block sa bagong page. Mga RGB na dokumento ang mga ito na walang crop o bleed mark, na kabilang sa single-page na Print PDF. Ang Design PDF ay puwede ring **Notes handout**: portrait na page para sa bawat slide na may speaker note nito sa ilalim.

**Bago ka mag-export.** Ang **Before you export** card sa paanan ng panel ay nagsasabi kung ano ang malapit nang makita ng print shop: format, laki at bleed, trim at bleed area, ink coverage, bilang ng plate at bilang ng page, na may hatol sa tabi ng heading nito. Hindi ito kailanman humaharang sa export. Laging ipinapakita ng Design ang card na may sarili nitong mga check, kasama ang mga house rule ng design system layer por layer at ang writing signal para sa text ng dokumento ([Before you export](/info/design.html#before-you-export)), at nagdaragdag ng mga print check na ito kapag naka-on ang **Print preflight**. Sa ibang tool, i-on ang **Print preflight** sa ilalim ng Settings → Preferences → Feature flags; naka-off ito bilang default, at ang Lolly Work deployment ay maaaring i-on ito para sa mga miyembro nito.

**Pagkatapos mong mag-export.** Kapag handa na ang file, binabasa ito pabalik ng Lolly at inihahambing sa pinili mo: format, laki ng pixel o page, haba ng clip, transparent na background, kulay na CMYK, HDR, Content Credentials at password ng PDF o ZIP. Anumang magkaiba ay isinusulat sa export card. Ang bawat sukat ay galing sa file, hindi kailanman sa setting, at ang property na hindi masagot ng file ay hindi binibilang bilang tugma. Isinusulat ng command line ang buong paghahambing gamit ang `--export-report` (tingnan ang [Mag-render gamit ang CLI](/info/cli-rendering.html)).

Hiwalay na mga check ang mga check ng inspector ng Design at ang paghahambing ng brand sa Design System Setup: tinitingnan nila ang design, habang ang dalawang card na ito ay tumitingin sa file.

::: details Gastos mula sa rate card
Sa ilalim ng preflight, ginagawang pera ng cost card ang parehong mga bilang, gamit lang ang mga presyong ibinigay ng isang tao. Binabasa nito ang mga bilang na iyon kahit naka-off ang preflight card mismo. Dalawang bagay ang kailangan nito: trabahong mapepresyuhan ng price list (plate, sheet, lawak, page, variant row o output file, kaya ang payak na logo PNG ay hindi kailanman nagpapakita nito) at **rate card**, isang JSON price list mula sa printer mo. Ang default na build ay walang dala at walang in-app na paraan para mag-load nito. Dumarating ang rate card bilang catalogue asset na kasama sa deployment, o sa pamamagitan ng opsyonal na rate-card extension na ino-on ng self-hoster o control plane. Kung walang rate card, walang ipinapakita.

Ang bawat figure ay rate na ibinigay mo na pinarami sa dami na binilang ng Lolly, tulad ng `4 plate × €35.00`, at ang kabuuan ay dala ang pinagmulan nito: ang nag-isyu sa card at ang petsa ng mga rate nito. Walang default na currency at walang placeholder na presyo. Ang sinasabi ng file tungkol sa sarili nito ay nananatiling reported speech: *"The file says: … Lolly has not verified this."*

Kapag hindi makalkula ang figure, binabawi ang table sa halip na punan:

- Ang mga linyang hindi pinepresyuhan ng card ay nangangahulugang **walang kabuuan**, headline lang na nagsasabi kung ilan ang walang presyo.
- Ang dami na kisame ay dala ang **"up to"** sa subtotal nito.
- Ang mga rate na lampas sa valid-until na petsa ay nagpapakita ng **bilang lang** hanggang pindutin mo ang *Use these rates anyway*; ang petsa ng expiry ay sumasama na sa figure.
- Kapag binuksan sa pamamagitan ng **link**, nananatiling nakatago ang pera hanggang hilingin mo ito sa device na ito. Tumatanggap ang CLI ng `--rate-card=<file.json>` bilang lokal na file at hindi kailanman bilang link parameter.

Inaalis ang card sa bawat export stage, kaya hindi nito kailanman binabago ang file. Aritmetika ito, hindi quote; ang printer mo lang ang makakapag-quote.
:::

## Motion at tunog

### Video

Ang mga animated na tool ay nag-e-export ng **MP4** at **WebM**. Ipinapakita lang ng picker ang mga container na kayang gawin ng browser na ito, at ang shared na `?format=` link na humihingi ng hindi kaya nito ay bumabalik sa isa pa, na may katugmang file name. Ang mga animated na tool ay nag-aalok din ng **Start after**, na pinananatiling tahimik ang canvas saglit para maayos ang mga animation at font bago mag-record, at **Duration**, ang haba ng tapos na clip. Ang **Motion blur** (Off, Draft quality, Standard o High, na may **Shutter angle**) ay bina-blur ang mabilis na galaw kapalit ng oras ng pag-render. Kung sinusuportahan ng browser, ang **Record live** ay nagre-record ng on-screen na preview nang real time sa pamamagitan ng screen share sa halip.

![Ang mga timing setting ng animated export: Start after, Duration, Motion blur na may Shutter angle nito, at Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

Pinipili ng **Quality** ang Smaller file, Balanced o Best quality. Binubuksan ng **Advanced** ang **Codec**, **Frame rate**, **Rate mode** at **Hardware acceleration**. Kung may mga caption ang tool, pinipili ng **Captions** ang **Embedded track** o **Sidecar .vtt + .srt** sa tabi ng video. Dala ng link ang quality, codec, frame rate, duration at start delay bilang `vq`, `codec`, `fps`, `seconds` at `wait` ([Mga URL parameter](/info/url-parameters.html)).

Pinapanatili ng mga video export ang tunog nila. Ang tool ay maaaring maglatag ng **music bed** sa ilalim ng clip: audio asset na inuulit o tinatabas sa haba ng clip, na may fade, volume at ducking sa ilalim ng sariling tunog ng footage. Dinadala ng mga recording tool ang live nilang audio hanggang sa file.

Ang Design deck na nananatiling click deck ay maaari pa ring lumabas bilang video. Ang **Export slides as video** sa Present menu ay nagbubukas ng export sheet sa MP4. Bawat slide ay tumutugtog para sa sarili nitong dwell, o para sa Duration ng export sheet kapag wala itong sarili, at ang slide transition ng deck ay tumutugtog sa pagitan nila bilang dissolve. Hindi nagbabago ang mismong dokumento.

### Mga animated na larawan

Ang **GIF** ay tumutugtog saanman at bagay sa chat at email; mas malaki ito at mas kaunti ang kulay kaysa video. Ang **APNG** at **Animated WebP** ay nag-iingat ng buong kulay at transparency. Ang **Lottie Ad** ay nag-e-export din ng **Animated SVG**: mga vector frame na may naka-embed na CSS keyframe, kaya nag-i-scale ito sa anumang laki at umuulit sa browser tab o sa `<img>` nang walang codec. Outlined ang text nito, at gumagamit ito ng mas mababang default na frame rate dahil mas mabigat ang bawat frame kaysa bitmap. Tahimik ang lahat ng ito.

### Audio

Ang ilang tool ay nag-e-export ng tunog nang mag-isa. Ang **Voice Recorder** ay kumukuha ng take mula sa mikropono na may live level meter at sine-save ito bilang **MP3**, **WAV**, **M4A (AAC)** o **Opus (WebM)**, na ine-encode sa device mo. Ang `wav`, `mp3`, `m4a` at `opus` ay karaniwang format id, kaya ang audio export ay kasing-maibabahagi at kasing-ma-script ng PNG.

Tumatanggap ang asset picker ng malawak na hanay ng audio para sa music bed, mula MP3 at FLAC hanggang MIDI at tracker module; inililista ng [Mga format](/info/formats.html) ang mga ito. Ang [Rondocode song](/info/rondocode.html) ay tumutugtog sa anumang haba na hinihingi ng clip nito.

## Kulay at HDR

Binabasa ng Lolly ang bawat modernong CSS colour, ginagawa ang colour maths nito nang perceptual at isinusulat ang bawat file sa space na mabubuksan ng reader: sRGB para sa mga screen, CMYK para sa print at Rec.2100 PQ para sa HDR. Ipinapaliwanag ng [Colour sa engine](/info/colour-engine.html) kung paano. Ang Design document na nakatakda sa **Wide colour / HDR** ay sumusunod sa sarili nitong mga patakaran, na inilalarawan sa [Wide colour at HDR editing](/info/hdr-editing.html).

### Mga colour profile

Ang mga export ay may tag na colour profile, kaya ang mga colour-managed na app tulad ng print shop, Photoshop at browser ay binabasa ang mga kulay gaya ng nakita mo. Awtomatikong nangyayari ito; lumalaktaw sa tag ang mga thumbnail at preview para manatiling maliit.

- Ang **PNG at JPG** ay may dalang naka-embed na **sRGB** ICC profile, ang space kung saan iginuguhit ang preview. Tinatagan ang mga pixel, hindi ini-encode muli.
- Ang **Print PDF (CMYK)** ay nagdedeklara ng press condition nito sa *OutputIntent* nito, na nagsasabi sa print shop kung paano dapat basahin ang mga CMYK ink nito.
- Ang **Print TIFF (CMYK)** ay nagsusulat ng walang-tag na DeviceCMYK pixel at itinatala ang press condition sa TIFF metadata nito. Hindi kayang mag-embed ng press profile ang TIFF, kaya ang **Embed** row ay nagtatala lang ng pangalan ng profile na iyon.
- Ang **TIFF (RGB)** ay ang hindi-compressed na sRGB na kapatid para sa archive o editor round trip. Ina-flatten nito ang transparency sa puti. Parehong desktop-only ang dalawang TIFF, dahil hindi mapi-preview ng mga browser ang TIFF.
- Ang **SVG**, **EMF**, **EPS** at **DXF** ay mga vector na walang naka-embed na profile: ang mga kulay ng SVG ay sRGB, gumagamit ng device RGB ang EMF at EPS, ang **EPS (CMYK)** ay nagsusulat ng DeviceCMYK at gumagamit ang DXF ng AutoCAD Color Index. Ang SVG, EPS at DXF ay nag-o-outline ng text papunta sa mga path. Pinapanatili ng EMF na live at mae-edit ang text sa Office at Google Slides, bumabalik lang sa outline para sa mga run na hindi kayang ipahayag ng format; ang **Outline fonts** option ng export panel ay pinipilit ang mga path saanman. Ginagaya rin ng SVG ang mga CSS box shadow, sa loob at labas.

::: details PDF/X-4 at ang sarili mong press profile
Walang CMYK profile na kasama sa Lolly. Ang pinangalanang press condition ay nagsusulat ng output intent nang hindi nagke-claim ng PDF/X-4 conformance, dahil gusto ng PDF/X-4 na naka-embed ang profile.

Mag-load ng sarili mong CMYK profile at piliin ang **Embed** row nito sa Colour profile control. Ine-embed ito bilang *DestOutputProfile* ng file, at nagke-claim ang PDF ng PDF/X-4 kapag pinapayagan ng natitirang bahagi ng file. Ang press condition na idinedeklara nito ay binabasa mula sa profile na iyon: rehistradong pangalan kung may napatunayan ang profile, o `Custom` sa ilalim ng sariling pangalan ng profile.

Tatlong bagay ang pumipigil sa claim habang iniingatan ang output intent: RGB artwork na hindi nakonberte ng CMYK pass, ang `prov` proof-margin credit text (iginuhit sa karaniwang font na hindi naka-embed) at **Strong** na password, dahil ipinagbabawal ng PDF/X-4 ang encryption. Bawat PDF ay may dala ring PDF/X-4 metadata: page box, XMP, document ID at sRGB output intent na may profile nito.
:::

### HDR (maliliwanag na kulay)

Ito ang **HDR** card ng export panel, na pinasisigla ang karaniwang artwork para sa mga HDR screen. Ibang feature ang pag-iingat ng HDR original sa buong pag-edit: [Wide colour at HDR editing](/info/hdr-editing.html).

Ang karaniwang export ay sRGB: ang saturated na brand colour ay kasing-liwanag lang ng normal na puti ng screen. Ang HDR display ay may headroom sa itaas niyon. Ang **HDR** card ay pinalalakas ang mga brand colour at puting text mo papunta sa peak brightness, habang nananatiling madilim ang mga madilim na lugar at nagbibigay ng contrast sa glow.

![Ang HDR card sa export panel, naka-on, na may White / Reach / Dark lift / Focus dials na nakalantad sa ilalim nito](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Mga format.** PNG, JPG, AVIF at TIFF. Ang WebP ay 8-bit na walang gumaganang HDR decode path, at ang mga vector at PDF ay walang HDR model.
- **Naka-off bilang default**, dahil binabago nito ang mga pixel. I-tsek ang card, o ipasa ang `hdr=1` sa share link.
- **Ang mga dial.** **White** (ang kisame ng peak-brightness, 400 hanggang 2000 nits), **Reach** (gaano kalayo pababa sa mga tono kumakalat ang glow), **Dark lift** (gaano pinasisigla ang mga madilim; pinapanatiling madilim ng `0`) at **Focus** (gaano karaming yaman ng kulay ang iniingatan ng boost). Sumasama sila bilang isang value: ang `hdr=1600-60-0-50` ay White 1600, Reach 60, Dark lift 0 at Focus 50.
- **Ang isinusulat.** Ang PNG ay nakakakuha ng 16-bit Rec.2100 PQ na may `cICP` chunk. Ang JPG ay ISO 21496-1 gain-map JPEG: karaniwang SDR na larawan kasama ang nakadugtong na gain map. Ang AVIF ay nakakakuha ng muling isinulat na `colr` box. Ang TIFF ay nakakakuha ng PQ pixel na may nabuong ICC v4 profile na may dalang `cicp` tag, at nagfa-flatten sa itim, dahil ang puti ay ang 10,000-nit code sa PQ at lalagyan ng halo ang bawat gilid. Sinusunod ng boost ang perceptual (OKLab) lightness at pinapanatili ang hue, kaya ang brand green ay lalong sumisigla, hindi nagiging minty.
- **Kung saan lumilitaw ang glow.** Mga colour-managed na viewer sa HDR display: Preview, Quick Look at Safari sa mga Apple device, o Chrome sa HDR monitor. Ang SDR screen ay nagpapakita ng normal na larawan.
- **Bago mo ipadala.** Maraming platform ang nag-e-encode muli ng mga upload at nag-aalis ng HDR signal, na maaaring mag-iwan ng larawan na madilim o kupas. Gamitin ang HDR kung saan kontrolado mo ang destinasyon, tulad ng sarili mong site, video wall o deck sa maliwanag na panel.
- **Mula sa terminal.** Ang `--hdr=1` na may `--export=png` o `--export=jpg` ay nagsusulat ng parehong PNG at gain-map JPEG sa [CLI](/info/cli.html), mula sa parehong engine encoder, nang walang browser sa daan. Nananatiling web export muna ang AVIF at TIFF.

## Ang sumasama sa file mo

Ang tapos na file ay maaaring magdala ng ilang record bukod sa larawan. Ang ilan ay sumasabay sa mga pixel at nawawala kapag muling na-save o hinubdan ang file; dalawang marka ang nasa mismong mga pixel.

::: figure exporting-what-travels
Kung saan nakatira ang bawat record, kung naka-on ito bilang default at aling link parameter ang kumokontrol sa bawat isa.
:::

Tinitiklop ng export panel ang **Licence**, **Source credits**, *Password protect*, **C2PA Credentials**, ang **Lolly Imprint** at ang **Durable credential** sa isang **Content protection** group na nagpapakita lang ng mga card na magagamit ng napiling format. Kusa itong bumubukas kapag may idineklarang lisensya na ang link o dokumento, o kapag may source na nangangailangan ng desisyon mo. Ang **Design system** card ay nananatili sa labas ng group, nakikita sa bawat export.

![Ang Content protection group na nakabukas sa isang PNG export, na nagpapakita lang ng mga card na aplikable dito](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Provenance at watermark

Kung may mga field ang format, ang mga export ay may dalang **provenance metadata**: ang software, ang source, ang pangalan ng tool at ang credit line ng profile mo, isinusulat sa PNG iTXt, JPEG EXIF, PDF info, SVG `<metadata>` o GIF comment. Authorship lang ang itinatala nito, at walang ina-upload. Ang mga **Experimental** na tool ay nagtatatak din ng nakikitang watermark, inilalapat ng host para hindi ito matanggal ng pag-edit sa tool.

Ang **Lolly Imprint** ay di-nakikitang pixel watermark, **naka-on bilang default**. Sumasabay sa mga pixel ang credential at metadata at nawawala sa muling pag-save, screenshot o metadata strip. Ang Imprint ay nasa mga pixel at nananatili sa recompression, kaya ang kopya ay makikilala pa ring gawa ng Lolly. Pahiwatig ito at hindi cryptographic na garantiya, at walang dala itong personal na data. Sumasama ito sa JPEG XL, PNG, JPG, WebP, AVIF, TIFF at BMP, at sa mga raster na nire-render ng Lolly sa PDF o PPTX, hindi kailanman sa larawang ikaw ang nag-embed. I-untick ang **Lolly Imprint** o ipasa ang `imprint=0` para iwanan ang Imprint. Hindi pa naka-calibrate ang pananatili ng AVIF sa re-encoding. Dinidetekta ito ng [Verify](/verify) sa device mo; tingnan ang [Ang Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

Ang **Durable credential** ay nagsusulat ng id ng Lolly sa mga pixel gamit ang on-device na neural model sa TrustMark format, kaya ang "made with Lolly" link ay nananatili sa metadata strip at re-encode at nababasa ng mga TrustMark-aware na tool. **Naka-off ito bilang default**, dahil may gastos itong neural pass bawat export at minsanang model download. Sakop nito ang PNG, JPG, WebP, AVIF at TIFF; i-tsek ito sa panel o ipasa ang `durable=1`. Itinatago ng mga desktop at mobile app ang card, dahil wala silang pinagmulan para kunin ang model offline.

**Licence.** Piliin kung paano magagamit ng iba ang gawa mo: *None (all rights reserved)* bilang default, CC0 1.0, ang Public Domain Mark 1.0, o Creative Commons 4.0 na lisensya (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). Ang pangalan ng lisensya at link sa deed nito ay napupunta sa licence metadata ng file (EXIF, XMP at RIFF kung mayroon ang format) at sa Content Credential nito. Sine-save ang pagpili kasama ng dokumento at sumasama sa link bilang `licence=`. Isinusulat ng Lolly ang lisensyang pinili mo; hindi nito sinusuri o ipinapatupad ang mga tuntunin. Ang tool na may sariling licence field, tulad ng Claim, ay nag-iingat ng field na iyon sa halip.

### Ang design-system record

Itinatala ng export ang design system na gumawa ng file: ang pangalan nito, ang nailathalang bersyon na pinagguhitan (kapag hindi iyon ang working version) at ang [colourway](/info/colourways.html) kung saan ito iginuhit. Ang anumang ibang theme choice na idinedeklara ng design system, tulad ng density, ay itinatala sa parehong paraan. Hindi isinasama ang light o dark na pagpili, dahil ipinapakita na ng larawan kung alin ang ginamit.

**Nakikita mo ang record bago may isulat.** Ang **Design system** card, naka-tsek bilang default, ay nagpapakita ng eksaktong mga salitang dadalhin ng file, tulad ng *Records: Acme · Colourway: Beach*, at ang paglalarawan kung paano ito mababasa. Ang pangalan ng design system ay anumang tinype ng mga may-ari nito, kaya ipinapakita ito ng card ayon sa pagkakasulat. I-untick ang card para iwanan ang record sa export na iyon. Inililista ng document panel ng Design ang parehong mga salita sa ilalim ng *Embedded in exports*.

**Ibinibigay ng paglalarawan ang colourway sa tabi ng tool.** Kapag naka-tsek ang card, ang *"Made with https://lolly.tools : Chart"* ay nagiging *"Made with https://lolly.tools : Chart (Beach colourway)"*. Ang sariling pangalan ng design system ay nananatili sa record, hindi sa paglalarawan. Ang paglalarawang walang pangalan ng tool, o isinulat ng tool mula sa sarili nitong input, ay iniiwan ayon sa dati. Ang tool na hindi pinapansin ang mga colourway sa pamamagitan ng `tokenAxes` ay walang itinatala, at sinusunod ng PDF proof credit (ang `prov` print mark) ang parehong rule.

**Mga brand skill na gumabay sa agent.** Kapag ang agent ang gumawa ng piraso at pinangalanan ang mga [brand skill](/info/brand-skills.html) na binasa at sinunod nito, inililista rin ng record ang bawat skill kasama ang revision nito, tulad ng *Guided by: acme-brand 1.0*. Ang ibig sabihin ng mga salita ay ginabayan ng skill ang gawa. Hindi ito check: hindi sinusubok ng Lolly ang piraso laban sa skill. Ang sariling pahayag lang ng agent ang nagdaragdag ng listahan, na sa ngayon ay ang argumentong `brandSkills` ng `lolly_render` ng [MCP server](/info/mcp.html), kaya ang piraso na ginawa sa app o mula sa share link ay walang dala. Hawak ng Content Credential ang listahan bilang `brandSkills`, isang JSON value na may id, pangalan, revision at SHA-256 hash ng bawat skill. Hawak ng XMP packet at SVG metadata ang parehong value bilang `lolly:BrandSkills`, ang PDF na isinulat mula sa record ay nakakakuha ng isang keyword bawat skill at nananatili ang paglalarawan ayon sa dati. Ang internal na skill ay itinatala ayon sa id, pangalan, revision at hash nito, hindi kailanman sa text nito. Ang parehong mga switch ay iniiwan ang listahan kasama ng natitirang record: ang **Design system** card, `_madewith=0`, `--no-madewith` at `madeWith: false`. Kapag iginuhit ng MCP server ang file sa browser (PDF, JPEG at iba pang format na hindi kayang isulat ng browser-free path nito), walang listahang hawak ang sariling metadata ng file at Content Credential lang ang makakahawak nito. Ipasa ang `c2pa` para panatilihin ang record; kung walang credential, nagbababala ang render na hindi naitala ang mga brand skill.

**Pagbasa pabalik ng record.** Inililista ng [Verify](/verify) ang record bilang **Design system** sa mga detalye ng credential ng file at ang anumang brand skill bilang **Guided by**. Ang *Recreate with these settings* ay muling binubuksan ang tool sa naitalang bersyon at colourway. Bumubukas ang link gamit ang naitalang design system kapag may hawak ang device na ito na may parehong id at pangalan; kung hindi, bumubukas ito gamit ang aktibong design system mo.

::: details Ano ang isinusulat saan, at aling mga run ang nag-iiwan ng record
| Saan | Ano ang isinusulat |
|---|---|
| Content Credential | `designSystem` (ang id), `designSystemLabel`, `designVersion` at `themes` sa `tools.lolly.export` assertion, bawat isa ay payak na text value; ang `themes` ay JSON list ng mga pagpili |
| PNG, JPEG, WebP at JXL | Ang parehong apat na value bilang mga `lolly:` property ng XMP packet ng file, sa namespace na `https://lolly.tools/ns/export/1.0/` |
| SVG | Ang parehong mga `lolly:` property sa loob ng `<metadata>` block |
| PDF | Mga keyword tulad ng *Design system: Acme* at *Colourway: Beach* |
| Bawat format na may description field | Ang paglalarawan, na may colourway sa tabi ng tool |

Lumilitaw lang ang card kapag may maitatala at kayang hawakan ng format ang record. Ang CSV, JSON, calendar file at iba pang text o data format ay walang hawak na metadata, at ang EPS, EMF, DXF at BMP ay walang field para sa record. Ang HTML, Markdown at CSS ay hawak ang record sa Content Credential lang nila, kaya para sa kanila ang card ay walang ipinapakitang description line at nagtatago kapag naka-off ang **C2PA Credentials**. Ang field na hindi ibinibigay ng design system ay hindi napupunta sa file.

Ang share link ay pinapatay ang record gamit ang `_madewith=0` ([Mga URL parameter](/info/url-parameters.html)); ang command line ay tumatanggap ng `--no-madewith`, ang `lolly_render` ng [MCP server](/info/mcp.html) ay tumatanggap ng `madeWith: false`, at ang export panel ng terminal app ay may **Design system** row. Ini-print ng command line ang mga salitang dala ng tapos na file sa standard error, para sa tool render at para sa bawat file na ine-export ng `lolly run` mula sa naka-save na Design session, at ini-print ng MCP render ang mga ito sa tabi ng file, parehong binabasa pabalik mula sa file. Ang PNG na iginuguhit ng command line nang walang browser ay walang file metadata, kaya ang record nito ay sumasama sa credential lang. Ang mga on-device utility ay walang idinaragdag na metadata.

Ang mga run na walang **Design system** card ay iniiwan ang record: Batch run, folder na ine-export mula sa Projects at 3D collection export, at sa terminal app ang CSV batch, Projects folder o selection export at ang render-everything view. Mag-export ng isang file mula sa tool para maitala ang design system.
:::

### Content Credentials (C2PA)

Ang mga export ay maaaring magdala ng **Content Credentials**: isang signed na [C2PA](https://c2pa.org) manifest na nagtatala kung ano ang gumawa ng file, kailan at saan, nakatali sa hash ng mga byte ng file kaya natutuklasan ang anumang susunod na edit. Inilalathala ng C2PA ang specification, at nagsusulat ang Lolly ng mga karaniwang manifest na masusuri ng anumang C2PA reader.

![Ang C2PA Credentials card, naka-tsek, na ang credential lifetime ay nasa tabi ng checkbox](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Naka-on bilang default.** Ang **C2PA Credentials** card ay pre-selected para sa halos bawat tool. I-untick para sa isang export, o ipasa ang `c2pa=off` sa link. Ang tool ay maaaring mag-opt out sa manifest nito.
- **Mga format.** PDF (RGB at Print), PNG at APNG, JPG, GIF, SVG, TIFF (RGB at Print), WebP (still at animated), AVIF, MP4, WebM, ang mga audio container na MP3, WAV, M4A, OGG/Opus at FLAC, at HTML, Markdown at CSS. Ang ZIP ay nagtatatak sa bawat sinusuportahang member, at ganito nakakakuha ng isa ang Animated SVG. Ginagamit ng MP4, AVIF at M4A ang karaniwang BMFF binding at ng MP3 ang ID3v2 mapping nito, kaya kayang i-verify ng `c2patool` at ibang reader ang mga ito. Ang WebM at OGG/Opus ay wala pang karaniwang mapping, kaya dinadala ng Lolly ang manifest bilang Matroska attachment at OpusTags field, na sinusuri ng sariling verifier ng Lolly. Ang ICO, EPS, EMF, DXF, BMP, PPTX, ang mga Office format at ang iba pang text at data format ay walang C2PA container.
- **Ang itinatala nito.** Ang tool at app na gumawa ng file, ang oras ng pagpirma, ang shell na nag-export nito, ang [design system at colourway](#the-design-system-record) habang naka-tsek ang **Design system** card, at mga fingerprint ng aktibong input. Hindi isinasama ang input text, mga profile-bound na field, mga hindi aktibong kontrol, bersyon ng browser at detalye ng operating system. Lumilitaw ang pangalan at email mo bilang author kapag naka-on lang ang **Use my details to create** sa Settings → Preferences → Your details. Ang mga source na inilalagay ng export ay sumasama bilang ingredient: [mga credited work](#source-credits) tulad ng emoji, at [Rondocode song](/info/rondocode.html#songs-in-the-credential) sa video o audio export.
- **Ang nakikita ng mga tatanggap.** Ang mga C2PA tool tulad ng Adobe app, `c2patool` at contentcredentials.org/verify ay binabasa ang manifest at ipinapakita ang claim. Pumipirma ang Lolly gamit ang key na ginawa sa device mo, hindi certificate mula sa trust list, kaya nag-uulat ang mga viewer ng *unverified* na credential: totoo ang istruktura at tamper evidence, hindi pinatotohanan ang pumirma. Para baguhin iyon, mag-enrol ng **verified identity** sa ilalim ng Settings → Preferences → Content Credentials; tingnan ang [Content Credentials Identity](/info/content-credentials-identity.html).
- **Pag-check ng file.** Mag-drop ng anumang file sa [Verify](/verify), o patakbuhin ang `lolly validate <file>`, para sa on-device na ulat na nangunguna sa kung ang Lolly ang gumawa ng file at kung nagbago ito mula noon. Tumitingin din ang Verify lampas sa credential; tingnan ang [Ano ang sinusuri ng Verify](/info/what-verify-checks.html).
- **Privacy.** Ginagawa ang signing key para sa export at hindi kailanman lumalabas sa device mo, at ang claim ay may hawak lang ng dala na ng provenance metadata. Ang mga privacy utility na nagbabago ng sarili mong file ay walang idinaragdag na credential, at ang *Strip Hidden Data* ay nag-aalis ng C2PA manifest tulad ng anumang ibang metadata. Gumagawa ng bagong audio ang Rondocode utility, kaya pumipirma ito sa isinusulat nito ([Rondocode songs](/info/rondocode.html#files-from-the-rondocode-utility)).
- **Mga interaksyon.** Ang PDF na protektado ng password ay hindi kayang magdala ng Content Credentials, sa alinmang tier. Huling idinaragdag ang credential, sa ibabaw ng tapos na mga byte, pagkatapos ng DPI, EXIF, colour profile, PDF/X metadata at print mark.

### Source credits

Ang export na naglalagay ng gawa ng iba ay itinatala ang source na iyon sa credential. Ang emoji na iginuhit mula sa napiling emoji set ang pang-araw-araw na kaso: ang gawa, ang lumikha, ang lisensya, kung saan galing ang eksaktong mga byte at kung ano ang nagbago ay pawang sumasama sa file. Ang text sa tool na ang template ay SVG ay nag-iingat ng sariling emoji ng system, kaya walang kinikilalang credit doon. Sinasabi ng **Source credits** row kung ano ang hinihingi ng mga source sa delivery bago ka mag-download, at pagkatapos ng download, binabasa nito pabalik ang mga naihatid na byte bago sabihing nasa file ang mga credit. Ang lisensyang nagpapapili sa iyo, tulad ng recolored na CC BY-SA glyph na ibabahagi mo na, ay nakakakuha ng card na may mga opsyon; hindi kailanman hinaharang ang download. Nasa [Creative rights at mga credit](/info/creative-rights.html) ang mga salita, ang mga nasuring lisensya at kung ano ang nananatiling sa iyo.

## Password protection

Dalawang uri ng lock, parehong ginawa sa device mo. Ang *Password protect* card ng export panel ang nagtutulak sa dalawa.

![Ang Password protect card na naka-expand sa isang PDF export, kasama ang password field at ang dalawang lock tier](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

Ang **PDF open-password** ay may dalawang tier kapag nag-type ka ng password:

- **Weak**: 40-bit RC4, panakot at hindi proteksyon. Ang password nito ay maaaring sumama sa share link, sa malinaw na text. RGB na `pdf` lang.
- **Strong**: AES-256 (PDF 2.0). Tina-type sa export at hindi kailanman inilalagay sa link. Naaangkop din ito sa mga Print PDF at sa bawat PDF sa loob ng batch ZIP. Ang Print PDF na Strong-locked ay nag-iingat ng CMYK, mga marka at output intent nito pero tinatanggal ang PDF/X-4 claim.

Ang **naka-lock na ZIP** ay sumasaklaw sa ZIP export, folder download mula sa Projects o batch, na may isang password sa dalawang tier: **Weak** (ZipCrypto, panakot; maaari itong sumama sa `?password=` link) o **Strong** (AES-256, tina-type sa export, hindi kailanman sa link). Pinoprotektahan ng password ang bawat member, at ang anumang PDF sa loob ay naka-lock din gamit ang AES-256 nang mag-isa, kaya nananatili itong naka-lock pagkatapos i-unpack ang ZIP. Lumilitaw ang prompt kapag nagsimula ang download; ang blangkong password ay nangangahulugang walang lock.

Ang **share link na may password** ay humihingi ng password sa tatanggap bago ito magbukas. Ang buong link state ay ine-encrypt gamit ang AES-256 sa ilalim ng key na hinango mula sa password (PBKDF2), kaya ciphertext lang ang sumasama at nangyayari ang decryption sa browser ng tatanggap. Ang server na naghahatid ng link ay hindi kailanman nakakakita ng password o ng design. I-on ito sa **Share** dialog. Ang naka-encrypt na link ay bumubukas lang sa Lolly, hindi kailanman bilang naka-embed na larawan. Tingnan ang [URL Mode](/info/url-mode.html).

## Sa telepono

Ang mga export control ay nasa likod ng lumulutang na **Export** button, na nagbubukas ng **Export** sheet: ang parehong mga format, laki, copy, download at share, na akma sa touch.

## Mga format id para sa mga link at CLI

Ito ang mga value para sa URL `format=` parameter at CLI `--export=` flag (tingnan ang [Mga URL parameter](/info/url-parameters.html) at [CLI](/info/cli.html)). Ipinapakita lang ng menu ng tool ang mga format na kaya nitong gawin, kaya laging mas maikli ito kaysa sa listahang ito.

| Uri | Mga id |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vector | `svg` · `svgz` (gzipped SVG) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (cut file) |
| Page at dokumento | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (Penpot design file) · `scorm` (course package, isang ZIP) |
| Motion | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| Audio | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` |
| Text at data | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `css` · `scss` · `gpl` (GIMP palette) |
| Mga bundle at package | `zip` · `rpm` at `tar.gz` (ang render na selyado sa Linux package) |

Ang ilang id ay galing sa sariling export code ng tool: `ase` (Adobe Swatch Exchange, mula sa Palette Lab) at `exr` at `hdr` (high-dynamic-range raster, mula sa Darkroom). Ang **Convert Font** ay nagsusulat ng `ttf`, `otf` at `woff` mula sa font file na ibibigay mo, kaya ang hubad na link ay walang maire-render dito.
