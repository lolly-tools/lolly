# Paggamit ng Lolly

Magbukas ng tool, baguhin ang pinapayagan nitong baguhin mo, i-save ang resulta at ibahagi ito bilang link o file.

Sa device mo tumatakbo ang lahat nang walang account, at gumagana ito offline kapag na-download na ang kailangan mong mga tool at asset. Para magsimula, kailangan ng app ng browser o app na may WebGPU. Nakalista sa [Mga sinusuportahang environment](/info/supported-environments.html) ang mga nasubukan na.

**Ang siklo**, sa apat na hakbang:

::: steps
- <!--i:eti-home--> **[Magbukas ng tool](#find-your-way-around)** I-click ang card sa home screen. Nasa tabi ng live preview ang mga kontrol.
- <!--i:eti-sliders--> **[Baguhin ang mga input](#change-what-the-tool-lets-you-change)** Ang mga input lang na pinayagang baguhin ng may-akda. I-click ang design para mahanap ang kontrol nito.
- <!--i:eti-folder-plus--> **[I-save ang gawa mo](#saving-continuing)** Itinatago ito ng **Save** sa My library, at ibinabalik ito ng Projects.
- <!--i:eti-link--> **[Ibahagi ang design](#sharing-your-work)** Isang link na dala ang bawat input, o isang `.lolly` file.
:::

<!--i:eti-home-->
## Kilalanin ang paligid

::: figure using-app-map
Ang home screen: apat na tab sa bandang itaas at ang bar sa pinakababa. Kapag bukas ang tool, nasa tabi ng live preview ang mga kontrol nito.
:::

Nasa itaas ng home screen ang apat na tab: **Tools**, **Utilities**, **Assets** at **Projects**. Sa Tools ka gumagawa. Nagko-convert, nagche-check o naglilinis ng file ang Utilities. Library mo ang Assets. Nasa Projects ang mga na-save mo.

Nasa bar sa ibaba ang **Open**, **Settings**, search field, **Verify** shortcut sa Lolly Verify at **Docs**, na nagbubukas ng mga gabay na ito. Makikita ang bar sa Tools, Utilities, Assets, Projects, Settings at mga gabay sa app, at nakatago ito kapag bukas na ang tool. Hinahanap ng [Lolly Search](/info/search.html) ang mga tool, na-save na gawa, asset at setting mo mula sa field na iyon. Sinasagot ng [Ask Lolly](/info/ask.html) ang tanong na tinype mo gamit ang katugmang seksyon sa mga gabay na ito.

I-click ang card para magsimula ng bagong gawa sa tool na iyon. Sa **Projects** muling binubuksan ang mga na-save na gawa. Sa unang pagbisita, may greeting band sa itaas ng gallery na nag-aalok ng isang aksyon para magsimula: **Start making** sa ilalim ng Lolly Demo, o **Make it yours** para i-set up ang sarili mong design system.

![Isang gallery card na may halimbawang navigation at aksyong New](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Split view ang bawat tool: nasa isang panig ang mga **kontrol** at nasa kabila ang live na **preview**. Nag-a-update ang preview habang binabago mo ang kontrol, at ang nakikita mo ang ie-export.

![Ang split view ng tool - ang control stack sa kaliwa, at sa kanan ang live na grouped bar chart na iginuguhit nito](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

Naiiba ang **Lolly Design**: isang malayang canvas ng mga kahon na dina-drag, nire-resize at tina-typan mo, na may sarili nitong top bar, timeline at mga kontrol para sa deck. Ang gabay nito ay [Lolly Design: ang malayang canvas](/info/design.html).

<!--i:eti-sliders-->
## Baguhin ang pinapayagan ng tool

Mga input lang na nilalayong magbago ang ipinapakita ng tool. Itinakda na ng may-akda ang mga kulay, layout, type at logic, kaya sumusunod ang gawa mo sa mga patakaran niya. Kabilang sa mga input ang text, mga slider, color picker, dropdown, petsa, image picker at umuulit na row group. Nasa mga natitiklop na seksyon ang ilan.

![Ang control stack ng tool - isang text field, mga colour trigger at slider at wala nang iba dahil ni-lock ng may-akda ang lahat ng iba pa](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**I-click ang design para mahanap ang kontrol nito.** I-click ang elemento sa preview at mag-i-scroll papasok sa view ang kontrol nito nang may focus. Sa umuulit na row group, bubukas ang row na na-click mo.

Ibinabalik ang bawat input sa default nito ng **Clear changes**, na nasa itaas ng mga kontrol.

**Mga pagpipilian sa design system.** Kung may higit sa isang colourway, light at dark na itsura o iba pang pagpipilian sa theme ang design system mo, nasa seksyong **Design system** sa ilalim ng mga kontrol ang mga ito. May lumalabas na pagpipilian kung may binabago lang ito sa tool na ito, kaya walang seksyon sa file utility. Isang tuldok sa sarili nitong mga kulay ang bawat colourway, dalawang button ang light at dark at isang listahan ang anumang ibang pagpipilian.

Para sa pirasong ito ang pinili mo. Kasama ito sa link at sa na-save na session. Sinusunod ito ng bawat kulay na naka-link sa design system, at nananatiling gaya ng dati ang mga kulay ng app mismo. Makikita ang parehong mga pagpipilian sa **Canvas** tab ng Inspector sa Lolly Design. Puwedeng manatili sa canonical na colourway ang tool na ang mga kulay ang mismong nilalaman nito, at wala itong ipapakitang mga colourway dot. Makikita ang mga colourway sa totoong gawa sa [Paggamit ng Lolly Demo](/info/lolly-demo-in-use.html#colourways-on-real-work). Para gumamit ng isang colourway sa app at sa bawat bagong piraso, piliin ito sa **Settings → Appearance** ([Gawing sarili mo ang isang colourway](/info/colourways.html#make-a-colourway-your-own)).

### I-zoom at i-pan ang preview

- **Zoom:** Mag-Cmd/Ctrl-scroll o mag-pinch sa trackpad, na nakasentro sa pointer mo. Sa keyboard, pinagkakasya ng `0` o `Shift+1` ang lahat, itinatakda ng `1` o `Shift+0` ang 100% at pinagkakasya ng `Shift+2` ang seleksyon. Nag-zoom ang `+` / `−` sa paligid ng pointer kapag nasa stage ang pointer, at sa paligid ng gitna kung wala roon.
- **Pan:** Hawakan ang **Space** at mag-drag, o mag-drag gamit ang middle mouse button. Magagamit pa rin ang mga karaniwang click para i-click ang mga bahagi ng design.
- **Touch:** Mag-pinch para mag-zoom, mag-drag para mag-pan at mag-double-tap para magkasya.
- **Zoom HUD:** Pindutin nang matagal ang Lolly swirl sa sulok para ilabas ang `−`, **Fit** at `+`. Binubuksan pa rin ng maikling tap sa swirl ang profile menu mo.

Sa Lolly Design, saklaw ng **Fit all** ang mga artboard at malalayang layer. Puwedeng bumaba sa 20% ang mano-manong zoom hanggang mapuno ng page ang kalahati ng view. Ang mismong hangganan ay ang mas mababa sa 5% ng karaniwang Fit scale at 2% absolute zoom.

Sa tuwing binabago ang laki ng output, bumabalik ang view sa sukat na kasya ang lahat.

![Ang zoom HUD na inilabas mula sa swirl sa sulok ng canvas - minus, Fit, plus, kasunod ang mga toggle ng theme at tunog at ang grip na ginagamit para ilipat ito](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### Undo at redo

Umaatras ang **Cmd/Ctrl-Z** at sumusulong ang **Cmd/Ctrl-Shift-Z** (o **Cmd/Ctrl-Y**). Nasa itaas ng mga kontrol ang mga button na **Undo** at **Redo**, o nasa top bar sa Lolly Design. Nagiging abo ang bawat button kapag wala na itong natitirang hakbang. May mensaheng nagsasabi kung aling input ang naibalik ng bawat undo, kasama ang **Redo** button.

- **Isang hakbang ang isang drag.** Nagiging iisang hakbang ang paulit-ulit na pagbabago sa isang kontrol sa loob ng kalahating segundo.
- **Pinapanatili ang huling 100 hakbang.** Nililinis ng bagong edit pagkatapos ng undo ang forward stack.
- **Sa text box**, para sa field ang Cmd/Ctrl-Z, paisa-isang character. Lolly ang humahawak sa mga slider, dropdown, kulay at switch.
- **Ang pagpili ng file** sa file input ay hindi isang hakbang, dahil para sa session na ito lang hinahawakan ang mga byte na iyon.

Sa live na [pagtutulungan](/info/collaborate.html), hindi kailanman napupunta sa undo stack mo ang pagbabagong galing sa kabilang device. Magagamit ang undo hanggang umalis ka sa tool o mag-reload. Para sa mas lumang pagbabago, pinapanatili ng mga tool na nagse-save habang gumagawa ka ang mga naunang bersyon sa ilalim ng **History** ([Bumalik sa naunang bersyon](/info/find-your-work.html#go-back-to-an-earlier-version)).

### Live na camera

May **Go live** button ang mga epekto ng **Filter** tool (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art at Glitch) kapag may magagamit na camera. I-on ito at susundan ng epekto ang bawat frame ng webcam mo. Nire-record ng motion export ang resulta bilang GIF, WebM o MP4. Sa device mo pinoproseso ang mga frame. Agad na binibitawan ang camera kapag huminto ka o lumabas sa tool. May **Take a photo** rin ang bawat image picker para sa iisang frame.

<!--i:eti-folder-plus-->
## Pag-save & pagpapatuloy

Para maingatan ang gawa mo, pindutin ang **Save**, ang tsek sa tabi ng **Export** sa render pill. Napupunta ang bagong gawa sa **My library**, ina-update sa kasalukuyang lokasyon ang dati nang na-save na gawa at walang dina-download. May parehong **Save** button sa export panel.

Para piliin ang paglalagyan, pindutin ang **Save as** sa tabi ng **Download** sa export panel. Sa ilalim ng **Save to a project**, panatilihing napili ang **My library** o pumili ng project (gumagawa ng bago ang **＋ New project…**), saka pindutin ang **Save**. Iniingatan ng **Save as a template** ang design bilang [template](/info/templates.html), isang panimula para sa mga bagong dokumento. Sa Lolly Design, nasa Lolly menu ang **Save as**. Sa phone, pindutin ang **•••**, saka **File menu**, saka **Save as**.

![Ang render pill na may dalawang bahagi: Export, na may pataas na arrow na nagbubukas ng export panel, at Save, na may tsek na nagse-save sa kasalukuyang lokasyon](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> Pindutin ang **Save** sa render pill, o **Save as** para pumili ng project.
- <!--i:folder--> Napupunta ang item sa **My library**, o sa pinili mong project.
- <!--i:home--> Sa susunod, pindutin ang **Home** sa kaliwang itaas at buksan ang **Projects** tab.
- <!--i:document--> Buksan ang item. Nakabalik ang bawat setting, handang baguhin at i-export muli.
:::

Ginagamit ng mga item ang pangalan ng file na tinype mo sa export panel, o kung wala, ang pangalan ng tool nito, gaya ng **QR Code**. Ang file mula sa **Download** ay isang tapos na kopya. Para baguhin ito sa susunod, buksan ang naka-save na item sa Projects.

::: note Nananatili sa device na ito ang mga na-save
Nananatili sa device na ito ang mga personal na na-save, sa browser o app kung saan ka nag-save, maliban kung i-on mo ang [Sync](/info/sync.html).
:::

Kung wala ang isang bagay sa inaasahan mong lokasyon, sakop ng [Hanapin at bawiin ang gawa mo](/info/find-your-work.html) ang bawat kaso, mula sa naisara na tab hanggang sa naburang browser data.

::: details Mga team project sa Lolly Work (opsyonal)
Kung [gumagamit ng Lolly Work ang organisasyon mo](/info/organisation.html), mag-sign in sa instance nito at buksan ang **Projects → Team projects** para sa mga session na ibinahagi sa iyo. Itinatakda ng organisasyon ang access at retention, at iniimbak ng serbisyo nitong Lolly Work ang mga session na iyon. Kapag pinapayagan ng organisasyon mo ang live editing, sumasali ang shared session sa live collab nito sa pagbukas. Ipinapaliwanag ng [Pagtutulungan](/info/collaborate.html#collabs-through-lolly-work-optional) ang mga hakbang.

Nananatiling hiwalay ang personal mong library. Kapag nag-sign in ka sa ibang device, makukuha mo ang gawa ng team. Kailangan pa rin ng Sync o backup para mailipat ang mga personal na na-save.
:::

<!--i:eti-link-->
## Pagbabahagi ng gawa mo

Magbahagi ng design bilang link o file. Binubuksan ng **Share** sa mga kontrol sa export ang dialog na nag-aalok ng pareho. Binubuksan ng **Share link** sa naka-save na session sa Projects ang parehong dialog para sa session na iyon. Pagkatapos mong magpadala ng file sa Google Drive, Nextcloud, S3 bucket, Dropbox o OneDrive, puwede ring gumawa ang dialog ng link sa pamamagitan ng serbisyong iyon ([Mag-export ng file](/info/exporting.html#how-export-works)).

::: cols
## Isang link

- Dala ang bawat input sa address, kaya nalilikha muli ng link ang design.
- Hindi kasama ang mga larawan at file na idinagdag mo mula sa device na ito, napakahabang text at napakalaking listahan.
- Bumubukas sa anumang browser, kaya puwede mong i-bookmark, i-paste o i-commit ang link.

## Isang .lolly file

- Dala ang naka-save na session kasama ang mga larawan at file sa device na ito, at puwede ring dalhin ang tool at design system.
- Hindi isinasama ang lisensyadong catalogue art maliban kung piliin mong isama ang mga file.
- Bumubukas sa Lolly: i-double-click ito, gamitin ang **Open** o i-drop ito sa app.
:::

### Ang link

Nasa itaas ng dialog ang link, kasama ang **Copy** at isang **QR** button na nagbubukas ng QR Code tool gamit ang link. Sa ilalim ng link, laman ng **Link options** ang:

- Ginagawang `lolly://` address ng **Open in the installed app** ang link para sa Shortcuts, mga launcher at automation, nang walang binabagong parameter.
- Sinisiksik ng **Shortest link** ang mahabang design sa isang compact na token at ipinapakita kung ilang character ang natipid. Available pa rin ang nababasang anyo.
- Ine-encrypt ng **Password-protect this link** ang link sa device mo gamit ang AES-256. Hindi kailanman bahagi ng link ang password.
- Idinaragdag ng **Pin this tool version** ang `_v` flag, kaya hindi mababago ng susunod na update ng tool ang nire-render ng link.
- Pinipili ng **When the recipient opens the link…** ang fullscreen, ang nakabukas nang export panel, ang pag-download sa pagbukas (`&export`) o ang pagkopya sa clipboard (`&copy`).
- Kinokopya ng **Copy credit** ang caption na "Made with Lolly" kasama ang link, para sa post o slide.

Kapag may mga personal na field ang tool, gaya ng pangalan mo, hindi isinasama ng **Review personal fields** ang bawat isa sa link hanggang lagyan mo ng tsek ang field na iyon. Sakop ng [URL mode](/info/url-mode.html) ang lahat ng puwedeng dalhin ng link.

**Sinasabi ng dialog kung ano ang hindi kayang dalhin ng link.** Binibilang ng Lolly ang anumang hindi kasya sa address habang binubuo nito ang link. Kung may hindi naisama, inililista ng dialog ang mga iyon at itinuturo ang opsyon na file. Mas banayad na paalala kasama ang bilang ng character ang nakukuha ng link na mahaba lang.

**Sa ilang tool, ang link na ang buong produkto.** Pinagsasama ng Jump Page ang mga link mo sa iisang page na maipapamahagi: isang bio link, talk o shop front. Ang page mismo ang link, kaya walang hino-host at walang account sa likod ng page. Nakikita ng bisita ang page sa buong lapad, isang link bawat scene habang nag-i-scroll.

![Jump Page sa editor: ang heading scene sa itaas ng page, kasama ang mga link scene sa ilalim nito](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Mga link na pinamamahalaan ng organisasyon sa Lolly Work
Para sa pagbabahaging nangangailangan ng expiry, pagbawi o password, nag-aalok ang Lolly Work ng mga managed link sa mga shared session, tool at catalogue asset. Dumadaan ang mga ito sa serbisyo ng organisasyon at sumusunod sa mga patakaran nito sa access. Hiwalay ang mga ito sa mga link sa itaas na dala na ang lahat ng kailangan. Hindi mababawi ng pagpapawalang-bisa sa isang link ang file na na-download na ng iba. Inililista ng [Pag-render at pagbabahagi](/info/manage/sharing.html) ang mga uri ng link at pahintulot.
:::

### Ang .lolly file

**Download .lolly**, sa seksyong **Editable file** ng Share dialog, ang nagsusulat ng kasalukuyang design bilang iisang file. Kasama ang karaniwang catalogue art sa mga larawan at file mula sa device na ito. Nananatiling external reference ang lipas o hindi available na file. Bago mag-save, ipinapakita ng dialog ang laki ng file, kung ilang file ang naka-embed, ilan ang nire-reference at kung kasama ang tool. Kung may share sheet ang device mo, ipinapasa ng **Send to…** ang file sa share sheet (AirDrop, isang Android share).

**Download project (.lolly)**, sa menu ng folder sa **Projects**, ang nagsusulat ng buong folder para maipagpatuloy ng iba ang bawat session sa folder. Hindi isinasama ang mga batch session, at sinasabi ng abiso kung ilan ang mga ito. Isinusulat ng **Download originals**, sa parehong menu, ang isang karaniwang zip na may hiwalay na file para sa bawat item.

Bago ipadala ang file, tatlong bagay ang pagpapasyahan mo:

- **Kung isasama ang pangalan mo.** Isinusulat lang ang pangalan, email at organisasyon mo kapag naka-on ang **Use my details to create** sa [profile mo](/info/profile.html). Kapag naka-off ito, itinatala lang ng file na ginawa ito gamit ang Lolly, at kung kailan.
- **Kung isasama ang art na hindi karaniwang isinasama.** Hindi kasama bilang default ang lisensyadong art at art na naka-lock sa brand, pati ang catalogue work na hindi pa mabasa ng Lolly ang nakatalang lisensya. Kung may ginagamit ang design, sinasabi ng dialog kung ilan at iniaalok ang *Download without them* o *Include and download*. Kapag isinama ang mga ito, ibinibigay ang mga file sa sinumang magbubukas ng `.lolly`. Isinasama ang catalogue work na walang nakatalang impormasyon sa mga karapatan nito, at inililista ng dialog ang bawat isa para masuri mo bago ipadala. Inililista ng `CREDITS.txt` ng file ang mga naisama at hindi naisama, kasama ang dahilan. Ipinapaliwanag ng [Mga karapatan at credit sa malikhaing gawa](/info/creative-rights.html) ang mga patakaran.
- **Kung isasama ang tool.** Ipinapaloob ng **Include the tool** ang sariling mga file ng tool, para mabuksan ang design sa device na walang tool na iyon. Naka-tsek ito sa simula para sa custom na tool, gaya ng fork, at walang tsek para sa tool na nakalista sa signed catalogue. Sa build na walang signed catalogue, itinuturing na custom ang bawat tool.

**Pagbukas ng file.** Sa mga desktop at mobile app, i-double-click o i-tap ang `.lolly`, piliin ang **Open with Lolly** o ipadala ito sa Lolly mula sa share sheet. Sa web app, pindutin ang **Open** o i-drop ang file sa Lolly. Sa bawat paraan, binabasa muna ang manifest ng file at ipinapakita ang laki, nilalaman at kung ano ang mangyayari bago magsulat ng anuman.

::: warning Pinapatakbo ng pag-install ng tool ang code nito
Kung may dalang tool ang file na wala ka pa, ipinapakita ng **Trust this tool?** ang tool at may-akda nito, at sinasabing pinapatakbo ng pagbukas nito ang sariling code ng tool sa device mo. Itinutuloy ito ng **Trust & install**.
:::

Kung tumanggi ka, sine-save pa rin ang gawa sa Projects at naghihintay hanggang idagdag mo ang tool. Hindi pa mai-install sa ganitong paraan ang tool na ang code ay ipinapamahagi bilang module, at tinatanggihan ito sa parehong paraan.

::: details Ano ang laman ng .lolly at paano ito binubuksan
Ang `.lolly` ang extension ng bundle ng Lolly, at sinasabi ng `format` sa `manifest.json` nito kung ano ang nasa loob:

- May isang naka-save na session, mga naka-embed na file nito at resibo para sa anumang nakukuha pa rin sa pamamagitan ng reference ang isang **shared design** (`lolly-share`). Puwede rin nitong dalhin ang tool at design system. Nagdaragdag ng bagong Project ang pagbukas nito at hindi kailanman pinapatungan ang isang session.
- May folder mula sa Projects ang isang **shared project** (`lolly-share`, kind `project`): mga sub-folder nito, bawat session sa mga iyon kasama ang tile nito at ang mga larawang naka-file doon. Nagdaragdag ng kopya ng folder ang pagbukas nito. Dala ang bawat session bilang `sessions/<key>.json` kasama ang tile nito sa ilalim ng `thumbs/`. Hihilingin ng Lolly na mas luma kaysa sa mga project file na mag-update ka.
- May mga token ang isang **design-system pack** (`lolly-brand`) at puwedeng may mga font, logo, nai-publish na bersyon at pinanatiling resource. Nagdaragdag ng hiwalay na pinangalanang design system ang pagbukas sa pack at ginagawa itong aktibo.
- Ang **workspace o instance pack** ay isang `lolly-brand` na may mga nakadeklarang tool, catalogue asset at opsyonal na instance address. Pinapalitan ng pag-load nito ang iisang workspace overlay na na-load dati, at inililista ng preview ang mga epektong iyon sa buong device.

Hindi `.lolly` ang buong backup ng device. Nananatili itong `LollyTools-….zip` (format na `lolly-backup`) at nire-restore sa **Settings → Storage → Import data…**. Nananatiling `.zip` din ang naka-zip na folder ng tool. Ang [Paglilipat ng data](/info/data-transfer.html) ang sanggunian para sa mga format.

Karaniwang zip ang isang `.lolly`. Palitan ang pangalan nito ng `.zip` para makita ang nasa loob. Nasa ilalim ng `assets/uploads/` ang sarili mong mga larawan at nasa `assets/catalog/` ang catalogue art. Inililista ng `manifest.json` ang bawat file, at sinasabi ng README kung ano ang file.

Nirerehistro ng macOS, Windows, Linux, iOS at Android ang format. Ipinapakita ng mga desktop file manager ang file bilang Lolly document, at kayang ipakita ng GNOME Files ang sariling thumbnail ng naka-save na session. Kapag binuksan mula sa Lolly Design System Setup, inirerekomenda ang aksyon para sa design system kung may dala nito ang shared design, pero hindi kailanman itinatago ang **Open shared design**.

Sa iOS o Android, hanggang 48 MB lang ang dokumentong ipinapasa mula sa ibang app, at sinasabi ito ng app. Kinokopya ng pagpapasa ang mga byte nito sa kabilang app. Walang ganitong limitasyon ang **Open** sa loob ng Lolly, kaya gamitin ito para sa mas malaking bundle.

Pagkatapos mong kumpirmahin, isang beses na ine-extract at bine-verify ng Lolly ang bundle. Napupunta ang mga asset sa library mo at itinutugma ayon sa checksum para magamit muli ang file na nasa device na. Napupunta ang mga session sa Projects na may mga bagong id, kaya puwedeng buksan nang dalawang beses ang parehong file. Naghihintay doon ang session na wala pa ang tool. Minamarkahang malaki ang mga file na lampas 100 MB, at nagbababala ang preview kapag mas kaunti ang iniulat na libreng espasyo ng browser storage kaysa sa kailangan ng file. Sinusuri ang bawat bahaging sakop ng integrity check bago itala ang anuman, at tinatanggihan ang sirang kopya nang walang naiiwan.
:::

Parehong nagpapasa ng snapshot ang link at file. Para sa live editing, sakop ng [Pagtutulungan](/info/collaborate.html) ang mga pribadong collab sa pagitan ng dalawang device at mga opsyonal na collab sa trabaho sa pamamagitan ng Lolly Work.

<!--i:eti-images-->
## Assets - ang library mo

**Lolly Assets** (`#/a`) ang may mga magagamit ng mga tool mo: mga logo ng brand, larawan, audio at motion na nakapangkat ayon sa uri, at sarili mong mga file. Nakaimbak sa device mo ang mga upload mo. Puwede ring magbigay ang organisasyong gumagamit ng Lolly Work ng shared catalogue sa ilalim ng sarili nitong mga patakaran sa access ([Gamitin ang Lolly sa organisasyon mo](/info/organisation.html)).

![Assets, kasama ang mga swatch at font ng brand at sarili mong mga upload](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Ipasok ang mga file mo.** Mag-drop ng larawan, SVG, audio clip, video, Lottie, PDF o PowerPoint deck sa upload area, o mag-click para pumili. Agad na lumalabas ang file sa Assets at sa asset picker ng bawat tool. Itatanong ng PDF na maraming page o ng `.pptx` kung aling mga page o slide ang itatago, at nagiging SVG asset ang bawat isa. Iniingatan nang walang pagbabago sa **My images** ang larawang idinagdag mo sa loob ng tool, kaya nabe-verify pa rin ang Content Credential nito. Napakalaking file lang ang nagtatanong kung ire-resize. Ipinapakita ng **Settings → Storage** kung gaano karami ang laman ng **My images**. Walang limitasyon bukod sa storage ng device mo. Para alisin ang EXIF at GPS data sa pag-upload, i-on ang **Strip metadata from uploads** sa ilalim ng **Settings → Feature flags**. Pinananatili ang Content Credentials sa alinmang pagpipilian.
- <!--i:star--> **Gawing favourite ang madalas mong gamitin.** Lagyan ng star ang asset o swatch ng brand at mapi-pin ito sa itaas ng bawat picker.
- <!--i:folder--> **Mag-ayos.** Ilipat ang asset sa ibang grupo, itago ang shared brand asset na hindi mo ginagamit (ibinabalik ito ng **Show hidden**) o burahin ang sarili mong mga upload. Gumagana sa buong seleksyon ang parehong selection bar na nasa Projects.
- <!--i:layers--> **Alisin ang background ng video.** Buksan ang mga detalye ng video, o i-right-click ang card nito sa asset picker, at piliin ang **Remove background…**. Inihihiwalay ng **On-device model** ang subject mula sa masalimuot na scene. Inaalis ng **Colour key** ang backdrop na pantay ang ilaw gaya ng green screen at hindi ito nangangailangan ng download. Inaayos ng **Tolerance**, **Softness** at **Spill removal** ang gilid nito. Ipinagpapalit ng **Resolution** (360, 480, 720 o 1080p, hindi kailanman mas mataas sa source) ang detalye para sa bilis. Ang cut-out ay animated WebP o PNG na may transparency, na naka-save sa tabi ng orihinal. Sumasama sa cut-out ang Content Credential ng source bilang ingredient. Ipinapaliwanag ng [Isang beses binuo, pareho ang render](/info/ai-features.html) kung bakit nananatili itong karaniwang edit.

### Dalhin ang palette at mga font mo kahit saan

Ipinapakita ng **Swatches** panel sa Assets ang mga kulay ng brand mo: mga brand colour nito, mga kulay na idinagdag mo, mga ramp nito at spectrum. Nasa likod ng abong **Show colour roles** card sa ibaba ng panel ang mga role colour na inilalaan ng Lolly para sa interface (text, mga surface, gilid, pangunahing kulay ng colourway at mga kopya ng kulay ng brand sa ibang pangalan).

Card ang bawat kulay tulad ng ibang asset. I-click ang isa para buksan ang mga detalye nito, pumili ng ilan para i-download ang mga iyon o i-download ang buong palette sa format na nababasa ng iba mong tool:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** o **CSS classes**, para sa stylesheet o build. Pinananatili ng kulay na mas malawak kaysa sa sRGB ang malawak na value nito: itinatakda ito ng CSS pagkatapos ng hex, at pinananatili ng JSON ang hex kasama ang malawak na kulay, CMYK build at spot ink.
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**, para sa Illustrator o Photoshop. Dumarating ang kulay na naka-lock sa CMYK build bilang CMYK swatch na iyon, ang spot ink bilang pinangalanang spot swatch at ang kulay na mas malawak kaysa sa sRGB bilang Lab.
- <!--i:pentool--> **GIMP palette (.gpl)**, para sa GIMP o Inkscape, at **SCSS variables**, parehong nasa sRGB.

![Ang Swatches panel - ang limang button sa pag-download ng palette sa itaas, saka ang bawat kulay ng brand bilang chip na nagbubukas ng mga detalye nito](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

::: details Pumili ng maraming kulay o buksan ang mga detalye ng isang kulay
Pumili ng mga kulay gamit ang tuldok sa bawat card: mag-Shift-click sa pangalawang tuldok para piliin ang lahat ng nasa pagitan, mag-drag ng kahon sa mga puwang o pindutin ang Cmd/Ctrl+A habang naka-focus ang isang card. Iniaalok ng bar ang **Download as…** sa parehong anim na format, **Copy hex** at **Favourite**. Bago ka pumili ng format, inililista ng menu ang anumang kulay na hindi kayang ilaman ng kahit anong format (walang kulay ang Transparent), kung aling mga format ang nagse-save ng malawak na kulay bilang sRGB fallback nito (SCSS at GIMP) at kung alin ang may dalang mga CMYK at spot value (JSON at .ase). I-right-click ang card para sa parehong mga aksyon sa iisang kulay.

Pinupuno ng mga detalye ng kulay ang preview ng kulay na iyon at inilalabas ang **Linked values** (CMYK build o spot ink nito, anumang value na ginawa para sa partikular na space o press at ang design token nito), **Every notation** (hex, OKLCH, Display-P3 at iba pa, bawat isa ay may copy button), **Plotted on a colour space**, **Tones** at **Readability**. Lumilipat sa palette ang mga arrow key, ibinabahagi ng **Copy link** ang kulay at binubuksan ng **Open in Colour Lab** ang kulay para maipagpatuloy ang paggawa.
:::

Inililista ng **Fonts** panel ang mga face ng brand mo na may **download** para sa bawat isa, para i-install sa device o ibigay sa print shop.

<!--i:eti-grid-->
## Iangkop ang grid sa iyo

- <!--i:star--> **Gawing favourite ang ginagamit mo.** I-right-click ang card at piliin ang **Add to favourites**. Nagkakaroon ang tool ng malaking tile sa strip sa itaas ng grid. Sakop ng [Mga favourite mo](/info/favourites.html) ang strip.
- <!--i:eyeoff--> **Itago ang tool na hindi mo ginagamit.** I-right-click ang card, o pumili ng marami, at piliin ang **Hide tool**. Nawawala ito sa grid at sa mga resulta ng tina-type sa grid. Nawawala ang tool sa grid at hindi na tumutugma kapag nagta-type ka sa grid. Ipinapakitang muli ng abong **Show hidden tools (N)** tile sa dulo ang mga nakatagong tool nang madilim, at bawat isa ay may **Unhide tool** sa menu nito. Grid mo lang ang binabago ng pagtatago: bumubukas pa rin ang tool mula sa link o bookmark.
- <!--i:clock--> **Mga tool mo, nauuna.** Kapag may na-save ka nang gawa sa tatlong magkakaibang tool, inuuna ng **Yours** row ng mga chip sa itaas ng grid ang mga favourite mo at mga kamakailang tool.
- <!--i:sliders--> **I-layout ayon sa gusto mo.** Itinatakda ng **View options** ang layout (**Grid**, **Card** o **List**), laki at siksik ng mga card, pagkakasunod-sunod at category filter.

![Ang dulo ng Tools grid na ipinapakita ang mga nakatagong tool: ang madilim na Wordmark card, at sa tabi nito ang abong tile na nagpakitang muli rito, na ngayon ay may label na Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed the tile. The alt says so rather than quoting the resting
label the prose above already gives.
The recipe hides nothing itself. The lolly-demo catalog the captures pin
ships Wordmark hidden (`defaultHiddenTools` in its assets index.json), so a
fresh profile already has one hidden tool and the recipe only clicks the grey
reveal tile (`.gtile--hiddenbox`, confirmed in gallery.ts). It used to tick
the QR Code card and press the bulk bar's Hide button first; under lolly-demo
that published Wordmark dimmed and QR Code not, under a caption naming QR
Code, so the steps were dropped rather than relied on. QR Code was hidden
in that run too: the End scroll had left the pointer over its card, and a
hovered hidden card lifts its dimming (gallery.css), so it read as a normal
tool. The closing `hover:` puts the pointer back on the reveal tile, which
keeps every revealed card dimmed.
-->

**Kumilos sa maraming card nang sabay-sabay.** Lagyan ng tsek ang checkbox ng bawat card, mag-drag ng selection box sa bakanteng espasyo o mag-Shift/Cmd-click, at lalabas ang bar na may mga pinapayagan ng view na iyon:

- **Tools at Utilities:** Favourite, Hide, Available offline, **View sessions** (Projects, na ipinapakita lang ang mga session na ginawa gamit ang mga tool na iyon) at Copy link para sa iisang card.
- **Assets:** Favourite at Hide para sa anumang seleksyon. Lumalabas lang ang Duplicate, Download at Delete kapag bawat napiling item ay isa sa sarili mong mga upload, dahil permanenteng kasunduan ang isang shared asset ng design system.
- **Projects:** tingnan ang [Hanapin at bawiin ang gawa mo](/info/find-your-work.html#find-something-you-saved).

![Ang selection bar ng gallery para sa dalawang tool, na nag-aalok ng Available offline, View sessions, Favourite at Hide](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
<!--
SHOT NOTE (misc-bulkbar-gallery): drive targets `[data-select="qr-code"]` /
`[data-select="gradient"]` - the `.tile-check[data-select="<ref>"]` checkbox button
confirmed directly in views/gallery.ts's card markup (the same attribute
cardMarkup gives every tile), so these two clicks tick both cards without
opening either tool.

SHOT NOTE (misc-sessions-by-tool, NOT PUBLISHED): the "View sessions" result
had a recipe of its own (`/#/p?tools=qr-code,d3`, views/projects.ts's
toolsBodyHtml()), dropped here because it has no `drive=` that can
manufacture its own content - a saved session isn't a click away, it has to
already exist, and build-docs-shots.ts gives every shot a fresh
`browser.newContext()`. It would publish an empty list. Same dependency the
`projects` shot (now on find-your-work.md) carries; revisit if the pipeline gains a
storage-seeding hook.
-->

**View sessions** ay lumalabas lang kapag may napili. I-right-click ang iisang card na hindi napili para sa **N saved sessions**: listahan ng mga naka-save na session ng tool na iyon, kung saan inililipat sa Trash ang session kapag binura.

<!--i:eti-layers-->
## Sa phone

Sa makitid na screen, nagiging iisang column ang layout:

- Ang **mga kontrol ay nagiging sheet** sa itaas na may drag grip sa ibabang gilid. I-drag ang grip para lumipat sa **peek**, **half** o **full**, o i-tap ito para tiklupin at palawakin. Pinupuno ng preview ang espasyo sa ibaba at nananatiling nakikita habang nag-e-edit ka.
- Isang lumulutang na **Export** button ang nagbubukas ng export sheet: format, laki, pagkopya, pag-save at pag-download. I-tap ang backdrop para isara ang sheet.

![Isang tool sa screen na kasinglapad ng phone - ang mga kontrol bilang sheet sa itaas, ang nabuong palette na pumupuno sa preview sa ibaba at ang render pill na lumulutang sa gitna sa ibaba](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

<!--i:eti-copy-->
## Mga foldable at iPhone Duo

Sa foldable, iPhone Duo o touch screen na halos parisukat, inilalatag ng Lolly ang tool sa dalawang pane:

- **Mga kontrol sa isang panig, canvas sa kabila.** Malayo ang mga kontrol sa kamay na ginagamit mo sa pagguhit. Piliin ang **Dominant hand** sa **Settings → Accessibility**, o pindutin ang **Swap sides** sa itaas ng mga kontrol. Sa wikang binabasa mula kanan pakaliwa, nagbabaligtad ang mga panig.
- **Ang divider ang bisagra.** Kapag iniulat ng device ang tupi nito, nagtatagpo ang mga pane sa tupi para walang kontrol o artwork sa mismong tupi. Sa tuloy-tuloy na screen, i-drag ang divider sa sangkatlo, kalahati o dalawang-katlo ng lapad. Tinatandaan ng Lolly ang pinili mo para sa bawat view sa device na ito.
- **Sa mesa.** Kapag kalahating bukas ang device at pahalang sa screen ang tupi, nasa itaas na kalahati ang canvas at nasa ibaba ng tupi ang mga kontrol. Kapag nagpe-present ka, nasa itaas ang slide, at nasa ibaba ang mga tala mo, ang susunod na slide at **Back** at **Next**. Sa Sequence, nasa itaas ang preview at nasa ibaba ang timeline.
- **Lolly Design, Design System Setup at Assets.** Sa Lolly Design, mga tab sa tabi ng canvas ang inspector, mga layer at export panel. Nasa panlabas na gilid ng canvas ang mga tool, sa tapat ng kamay mong pangguhit. Kapag hindi kasya ang mga tool, nag-i-scroll ang column at ipinapakita ng kupas na bahagi na may arrow kung saang direksyon ang iba pa. Sa mesa, nasa ibaba ng canvas ang mga tool. Pinananatili ng Lolly Design System Setup ang Board sa isang panig at ang silid na binubuksan mo sa kabila. Sa Assets, bumubukas sa tabi ng library ang mga detalye ng asset, kaya ipinapakita ng susunod na tap ang susunod na asset sa parehong lugar.
- **Walang nasa tupi.** Kapag iniulat ang tupi, bumubukas ang dialog sa page na may mga kontrol. Ganoon din ang search box sa ibaba ng home screen at ang mga resulta nito. Sa flat na screen, nananatili ang mga ito sa gitna.
- **Walang nawawala sa pagtiklop.** Pinananatili ng pagtiklop, pagbuka o pag-ikot ng device ang dokumento mo, seleksyon, zoom at field kung saan ka nagta-type, kasama ang posisyon ng cursor.

Pinananatili ng panlabas na screen ng foldable ang layout sa phone na nasa itaas, pati ng Lolly window sa isang kalahati ng split screen.

<!--i:eti-smile-->
## Mga setting, tunog at ginhawa

**Settings**, sa ibaba ng home screen, ang may mga detalye mo, mga design system, accessibility, storage at mga offline download. Inilalarawan ng [Lolly Settings](/info/dashboard.html) ang bawat tab.

- **Ang mga detalye at headshot mo** ay pumupuno sa anumang tool na ginawa para gamitin ang mga ito, gaya ng email signature o badge. Sakop ang mga ito ng [Mga profile](/info/profile.html).
- May apat na switch para sa ginhawa ang **Accessibility**: **Reduce motion**, **Hide colourful previews**, **High contrast** at **Large text**. Binabago ng mga ito ang app sa paligid ng gawa mo, hindi kailanman ang canvas ng tool o export. Sa tabi ng mga ito, pinipili ng **Dominant hand** kung saang panig ilalagay ang mga kontrol sa dalawang pane.
- Nagpapatugtog ang **Sound** ng mahihinang tunog na gumagabay sa mga aksyon mo, at nagpapatugtog ang **Neurospicy Mode** ng kalmadong track para makatulong sa pagtuon. Parehong naka-off hanggang i-on mo sa **Settings → Accessibility** o sa profile menu. Inililipat ng **Sound shape** slider sa ilalim ng Sound switch ang mga tunog mula sa malalambot at bilog na patak (Bouba) hanggang sa tuyong mga tik at kalmot (Kiki), na nasa gitna ang mga chime ng Lolly. Kasama sa mga track ng Neurospicy ang mga generated station ng Lolly: **Lolly Sings** at ang mga genre nito, at tatlong **Lofi stations**. Gumagawa ang mga station ng walang katapusang musika habang tumutugtog. May mga kontrol ang bawat isa para sa drums at texture (at mood, sa Lofi), link para ibahagi ang himig na naririnig mo at button na nagse-save ng himig sa mga asset mo. Ipinapaliwanag ng [Binuong musika](/info/generated-music.html) kung paano ginagawa ang himig. Hinahayaan ka ng **Music generator** sa Utilities (`#/music`) na bumuo ng isa.
- Dina-download ng **Available offline** ang natitirang bahagi ng app, mga tool mo, catalogue at mga gabay bago mawala ang koneksyon. Para i-install ang Lolly bilang web app, gamitin ang install button ng browser mo, o *Add to Home Screen* sa phone. Tumatakbo nang full screen ang naka-install na app at kusang nag-a-update kapag online ka na ulit.
- Binibigyan ng **Performance UI**, sa ilalim ng **Settings → Feature flags**, ang app ng mas simpleng itsura na mas magaan iguhit. Nananatiling pareho ang mga canvas ng tool at export. Sa mabagal na device, kusang ino-on ng Lolly ang itsurang ito at sinasabi kung bakit, kasama ang **Undo** at **Keep** ([Performance UI](/info/configuration.html#curating-what-people-see)).
- Ipinapakita ng **Storage** ang iniingatan ng Lolly sa device na ito. Ipinapaliwanag ng [Kung buburahin mo ang data ng browser mo](/info/find-your-work.html#if-you-clear-your-browser-data) kung ano ang inaalis ng pagbura, at inililista ng [Patakaran sa Privacy](/info/privacy.html) ang lahat ng kinukuha o ipinapadala ng app.

::: note Kung hindi ma-load ang view pagkatapos ng update
Karaniwang nawawala sa isang reload ang blangkong panel o mensaheng "failed to fetch" kaagad pagkatapos ng update. Hindi naaapektuhan ang mga naka-save mong gawa, session at design system, dahil nakaimbak ang mga ito sa device mo. Larawang idinagdag mo pero hindi kailanman na-save lang ang maaaring kailangang idagdag muli.
:::

<!--i:eti-map-pin-->
## Saan susunod

- **[Lolly Design: ang malayang canvas](/info/design.html)**: ang canvas, mga hugis, timeline at pagpe-present ng deck.
- **[Batch at Lolly Multi-edit](/info/batch.html)**: maraming bersyon ng iisang design, o maraming naka-save na design na sabay na ine-edit.
- **[Mag-export ng file](/info/exporting.html)**: pagpili ng format, laki, mga unit sa print, transparency at video.
- **[Mag-import ng design](/info/design-import.html)**: magpasok ng Figma, Penpot, Illustrator, InDesign, Affinity o DXF file sa Lolly Design at ipagpatuloy ang pag-edit.
- **[Mga template](/info/templates.html)**: mga naka-save na panimula para sa tool.
- **[Wide Colour at HDR](/info/hdr-editing.html)**: panatilihin ang orihinal na precision ng larawan sa Lolly Design at Lolly Darkroom.
- **[Hanapin at bawiin ang gawa mo](/info/find-your-work.html)**: kung nasaan ang lahat at kung paano ito ililipat sa ibang device.
