# Paggamit ng Lolly

Bukas mo na ang Lolly at gusto mong gumawa ng isang bagay, itago ito at ipasa. Dinadaanan ng pahinang ito ang siklong iyon: magbukas ng tool, baguhin ang pinapayagang baguhin, i-save ang resulta at ibahagi bilang link o file.

Lahat ng narito ay tumatakbo sa device mo, walang account, at patuloy na gumagana offline kapag na-download na ang mga tool at asset na kailangan mo. Kailangan ng app ang browser o app na may WebGPU para magsimula; inililista ng [Supported environments](/info/supported-environments.html) ang mga nasubukan.

## Kilalanin ang paligid

::: figure using-app-map
Ang home screen: apat na tab sa itaas at ang bar sa ibaba. Ang tool, kapag bukas, ay nagpapakita ng mga kontrol nito sa tabi ng live preview.
:::

Apat na tab ang nasa itaas ng home screen: **Tools**, **Utilities**, **Assets** at **Projects**. Ang Tools ay ang ginagamit mo sa paggawa, ang Utilities ay mga workbench para sa mga gawain tulad ng pag-convert, pag-check o paglilinis ng file, ang Assets ang library mo at hawak ng Projects ang mga na-save mo.

Hawak ng bar sa ibaba ang **Open**, **Settings**, search field, **Verify** at **What?**. Lumalabas ito sa Tools, Utilities, Assets, Projects, Settings at sa mga gabay na binabasa mo sa app, at tumatabi kapag bukas na ang tool. Naaabot ng [Search](/info/search.html) ang mga tool, naka-save na gawa, asset at setting mo mula sa field na iyon. Sinasagot ng [Ask Lolly](/info/ask.html) ang tinype na tanong gamit ang katugmang seksyon ng mga gabay na ito.

Mag-click ng card para magsimula ng bago sa tool na iyon. Ang naka-save na gawa ay muling bumubukas mula sa **Projects**.

![Isang gallery card na may halimbawang navigation at isang New action](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Ang bawat tool ay split view: ang mga **kontrol** sa isang panig at ang live na **preview** sa kabila. Baguhin ang kontrol at agad sumusunod ang preview, at ang nakikita mo ang ie-export.

![Split view ng isang tool - ang control stack sa kaliwa, at ang live na grouped bar chart na iginuhit nito sa kanan](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

Ang **Design** ang pagbubukod. Bumubukas ito bilang malayang canvas ng mga kahon na dina-drag, nire-resize at tina-typan mo, na may sariling top bar, timeline at deck control. Ang [Design: ang malayang canvas](/info/design.html) ang gabay nito.

## Baguhin ang pinapayagan ng tool

Ipinapakita ng tool ang mga input na sinadyang magbago lang. Naayos na ng may-akda nito ang mga kulay, layout, type at logic, kaya anumang gagawin mo ay sumusunod sa kanilang mga patakaran. Kasama sa mga input ang text, slider, color picker, dropdown, petsa, image picker at mga umuulit na row group, at ang ilan ay nasa mga nakatiklop na seksyon.

![Ang control stack ng isang tool - isang text field, mga colour trigger at isang slider, at wala nang iba dahil ikinandado ng may-akda ang lahat ng iba pa](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**I-click ang design para hanapin ang kontrol nito.** Mag-click ng anumang elemento sa preview at magkakaroon ng focus ang katugmang kontrol at mag-i-scroll ito papasok sa view. Sa umuulit na row group, bumubukas ang eksaktong row na na-click mo.

Ibinabalik ng **Clear changes**, sa itaas ng mga kontrol, ang bawat input sa default nito.

**Mga pagpipilian sa design system.** Kapag nag-aalok ang design system mo ng higit sa isang colourway, light at dark na itsura o ibang theme choice, hawak ang mga ito ng seksyong **Design system** sa ilalim ng mga kontrol. Lumalabas lang ang pagpipilian kapag binabago nito ang tool na ito, kaya ang file utility ay walang ipinapakitang seksyon. Ang bawat colourway ay tuldok sa sarili nitong mga kulay, ang light at dark ay dalawang button at ang anumang ibang pagpipilian ay listahan.

Ang pagpipilian ay para sa piraso na ito. Sumasama ito sa link at naka-save na session, sinusunod ito ng bawat kulay na naka-link sa design system at nananatili ang sariling mga kulay ng app. Ipinapakita ng Design ang parehong mga pagpipilian sa **Canvas** tab ng Inspector. Ang tool na ang mga kulay ay ang mismong nilalaman nito ay puwedeng manatili sa canonical na colourway, at wala nang iniaalok na colourway dot. Ipinapakita ng [Lolly Demo in use](/info/lolly-demo-in-use.html#colourways-on-real-work) ang mga colourway sa totoong gawa.

### I-zoom at i-pan ang preview

Laging ipinapakita ng preview ang eksaktong ie-export.

- **Zoom:** Cmd/Ctrl-scroll o pinch sa trackpad, nakasentro sa pointer mo. Sa keyboard, ang `0` ay kasya sa window, ang `1` ay 100% at ang `+` / `−` ay nag-zoom.
- **Pan:** pindutin nang matagal ang **Space** at mag-drag, o mag-drag gamit ang middle mouse button. Libre pa rin ang karaniwang click para sa pag-click ng mga bahagi ng design.
- **Touch:** mag-pinch para mag-zoom, mag-drag para mag-pan at mag-double-tap para kumasya.
- **Zoom HUD:** pindutin nang matagal ang Lolly swirl sa sulok para buksan ang `−`, **Fit** at `+`. Ang maikling tap sa swirl ay nagbubukas pa rin ng profile menu mo.

Ang pagbabago ng laki ng output ay laging nagbabalik sa view sa malinis na fit.

![Ang zoom HUD na nakabukas mula sa swirl sa sulok ng canvas - minus, Fit, plus, saka ang theme at sound toggle at ang grip na naglilipat nito](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### Undo at redo

Ang **Cmd/Ctrl-Z** ay umaatras at ang **Cmd/Ctrl-Shift-Z** (o **Cmd/Ctrl-Y**) ay sumusulong. Ang parehong pares ay nasa bilang mga button na **Undo** at **Redo** sa itaas ng mga kontrol (sa Design ay nasa top bar), at nagiging abo ang bawat isa kapag wala nang babawiin. Sinasabi ng mensahe kung aling input ang ibinalik ng bawat undo, na may **Redo** button sa mensahe.

- **Isang hakbang ang isang drag.** Nagsasama ang paulit-ulit na pagbabago sa isang kontrol sa loob ng kalahating segundo, kaya iisang undo ang paghila ng slider sa buong saklaw nito.
- **Iniingatan ang huling 100 hakbang.** Ang bagong edit pagkatapos ng undo ay nililinis ang forward stack.
- **Sa text box**, ang Cmd/Ctrl-Z ay para sa field, character por character. Ang Lolly ang bahala sa mga slider, dropdown, kulay at switch.
- **Ang pagpili ng file** sa file input ay hindi hakbang, dahil hawak lang ang mga byte na iyon para sa session na ito.

Sa live na [collaboration](/info/collaborate.html), sa iyo lang ang history mo: ang pagbabago mula sa kabilang device ay hindi kailanman napupunta sa stack mo. Tumatagal ang undo hanggang umalis ka sa tool o mag-reload. Para sa anumang mas luma, ang mga tool na nagse-save habang gumagawa ka ay nag-iingat ng mga naunang bersyon sa ilalim ng **History**; tingnan ang [Bumalik sa naunang bersyon](/info/find-your-work.html#go-back-to-an-earlier-version).

### Live na camera

Ang mga epekto ng **Filter** tool (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art at Glitch) ay nagpapakita ng **Go live** button kapag may magagamit na camera. I-on ito at susundan ng epekto ang webcam mo frame por frame, at ire-record ng motion export ang resulta bilang GIF, WebM o MP4. Pinoproseso sa device mo ang mga frame, at binibitawan ang camera sa sandaling huminto ka o umalis sa tool. Ang anumang image picker ay may **Take a photo** din para sa isang frame.

## Pag-save at pagpapatuloy

Para itago ang gawa mo, pindutin ang **Save**, ang tsek sa tabi ng **Export** sa render pill. Ang bagong gawa ay napupunta sa **My library**, ang gawang na-save mo na dati ay ina-update kung nasaan ito at walang dina-download. May parehong **Save** button ang export panel.

Para piliin kung saan ito mapupunta, pindutin ang **Save as**, sa tabi ng **Download** sa export panel. Sa ilalim ng **Save to a project**, iwanang napili ang **My library** o pumili ng project (gumagawa ng isa ang **＋ New project…**), saka pindutin ang **Save**; ang **Save as a template** ay nag-iingat ng design bilang [template](/info/templates.html), panimulang punto para sa mga bagong dokumento. Sa Design, ang **Save as** ay nasa Lolly menu; sa phone, pindutin ang **•••**, saka **File menu**, saka **Save as**.

![Ang dalawang-kalahating render pill: Export, na may pataas na arrow na nagbubukas ng export panel, at Save, na may tsek na nagsi-save sa mismong lugar](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> Pindutin ang **Save** sa render pill, o ang **Save as** para pumili ng project.
- <!--i:folder--> Ang item ay napupunta sa **My library**, o sa project na pinili mo.
- <!--i:home--> Sa kalaunan, pindutin ang **Home** sa kaliwang itaas at buksan ang **Projects** tab.
- <!--i:document--> Buksan ang item. Bumalik ang bawat setting, handang baguhin at i-export muli.
:::

Ipinapangalan ang mga item sa file name na tinype mo sa export panel, o kung hindi ay sa tool nila, tulad ng **QR Code**. Ang file na nakuha mo gamit ang **Download** ay tapos na kopya; para baguhin ito sa kalaunan, buksan ang naka-save na item sa Projects.

Ang mga personal na save ay nananatili sa device na ito, sa browser o app na pinag-save-an mo, maliban kung i-on mo ang [Sync](/info/sync.html). Kung wala sa inaasahan mong lugar ang isang bagay, sinasaklaw ng [Hanapin at bawiin ang gawa mo](/info/find-your-work.html) ang bawat kaso, mula sa saradong tab hanggang sa na-clear na browser data.

::: details Mga team project gamit ang Lolly Work (opsyonal)
Kung [gumagamit ng Lolly Work ang organisasyon mo](/info/organisation.html), mag-sign in sa instance nito at buksan ang **Projects → Team projects** para sa mga session na ibinahagi sa iyo. Ang organisasyon ang nagtatakda ng access at retention, at ang Lolly Work service nito ang nag-iimbak ng mga session na iyon. Ang shared session ay sumasali sa live collab nito habang bumubukas kapag pinapayagan ng organisasyon mo ang live editing; ipinapaliwanag ng [Magtulungan](/info/collaborate.html#work-collabs-with-lolly-work-optional) ang mga hakbang.

Nananatiling hiwalay ang personal mong library. Ang pag-sign in sa ibang device ay nagbibigay sa iyo ng team work, habang ang mga personal na save ay nangangailangan pa rin ng Sync o backup para makalipat.
:::

## Pagbabahagi ng gawa mo

Lumalabas ang design bilang link o bilang file. Ang **Share** sa mga export control ay nagbubukas ng dialog na nag-aalok ng pareho, at ang **Share link** sa naka-save na session sa Projects ay nagbubukas ng parehong dialog para sa session na iyon.

::: cols
## Isang link

- Dala ang bawat input sa address, kaya nauulit ng link ang design.
- Iniiwan ang mga larawan at file na idinagdag mo mula sa device na ito, napakahabang text at napakalalaking listahan.
- Bumubukas sa anumang browser, kaya puwede mong i-bookmark, i-paste o i-commit ang link.

## Isang .lolly file

- Dala ang naka-save na session kasama ang mga larawan at file sa device na ito, at puwedeng dalhin pati ang tool at ang design system.
- Pinipigilan ang may lisensyang catalogue art maliban kung piliin mong isama ang mga file.
- Bumubukas sa Lolly: i-double-click ito, gamitin ang **Open** o i-drop sa app.
:::

### Ang link

Nasa itaas ng dialog ang link na handang kopyahin, na may **Copy** at **QR** button na nagbubukas ng QR Code tool sa link. Sa ilalim ng link, hawak ng **Link options** ang:

- Ang **Open in the installed app** ay inililipat ang link sa `lolly://` address para sa Shortcuts, launcher at automation, na hindi nagbabago ang bawat parameter.
- Ang **Shortest link** ay nagpa-pack ng mahabang design sa compact na token at ipinapakita ang natipid sa mga character. Nandoon pa rin lagi ang mababasang anyo.
- Ang **Password-protect this link** ay ine-encrypt ang link sa device mo gamit ang AES-256. Hindi kailanman bahagi ng link ang password.
- Ang **Pin this tool version** ay nagdaragdag ng `_v` flag, para hindi mabago ng susunod na update ng tool ang nire-render ng link.
- Ang **When the recipient opens the link…** ay pumipili ng fullscreen, export panel na nakabukas na, download pagbukas (`&export`) o kopya sa clipboard (`&copy`).
- Kinokopya ng **Copy credit** ang caption na "Made with Lolly" kasama ang link, para sa post o slide.

Kapag may personal na field ang isang tool, tulad ng pangalan mo, ang **Review personal fields** ay inilalayo ang bawat isa sa link hangga't hindi mo ito nata-tsekan. Sinasaklaw ng [URL mode](/info/url-mode.html) ang lahat ng kayang dalhin ng link.

**Sinasabi ng dialog kung ano ang hindi kayang dalhin ng link.** Ang larawan o file na idinagdag mo mula sa device na ito, napakahabang text value at napakalaking listahan ay hindi kasya sa address. Binibilang ang bawat isa habang binubuo ang link. Kung may kinailangang alisin, inililista ito ng dialog at itinuturo ka sa file option, sa halip na bigyan ka ng link na bumubukas na kulang ang larawan. Ang link na mahaba lang ay nakakakuha ng mas banayad na tala na may bilang ng character nito.

**Ang ilang tool ay ginagawang buong produkto ang link.** Tinitipon ng Jump Page ang mga link mo sa isang page na ipamamahagi: bio link, talk, shop front. Walang naka-host at walang account sa likod ng page, dahil ang page ay ang link. Nakukuha ito ng bisita nang buong lapad, isang link bawat eksena habang nag-i-scroll.

![Jump Page sa editor: ang eksenang heading sa itaas ng page, na may mga eksenang link sa ibaba nito](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Mga organisation-managed na link gamit ang Lolly Work
Para sa pagbabahaging nangangailangan ng expiry, revocation o password, nag-aalok ang Lolly Work ng mga managed link sa mga shared session, tool at catalogue asset. Dumadaan ang mga ito sa serbisyo ng organisasyon at sumusunod sa mga access rule nito. Hiwalay ang mga ito sa mga self-contained na link sa itaas, at hindi mababawi ng pag-revoke ng isa ang file na na-download na ng iba. Inililista ng [Rendering at pagbabahagi](/info/manage/sharing.html) ang mga uri ng link at permission.
:::

### Ang .lolly na file

Ang **Download .lolly**, sa **Editable file** section ng Share dialog, ay nagsusulat ng kasalukuyang design bilang isang file. Dala nito ang naka-save na session kasama ang mga larawan at file sa device na ito, at sumasama rin ang karaniwang catalogue art. Ang luma o hindi available na file ay nananatiling external reference sa halip na mawala. Bago mag-save, ipinapakita ng dialog ang laki ng file, ilang file ang naka-embed, ilan ang tinutukoy at kung kasama ang tool. Kung may share sheet ang device mo, ipinapasa ng **Send to…** ang file diretso roon (AirDrop, Android share).

Ang **Download project (.lolly)**, sa menu ng folder sa **Projects**, ay nagsusulat ng buong folder, para makapagpatuloy ang iba sa bawat session sa folder. Naiiwan ang mga batch session, at sinasabi ng notice kung ilan. Ang **Download originals**, sa parehong menu, ay nagsusulat ng simpleng zip ng bawat item bilang sarili nitong file.

Tatlong bagay ang ikaw ang magpapasya bago lumabas ang file:

- **Kung isasama ang pangalan mo.** Isinusulat lang ang pangalan, email at organisasyon mo kapag naka-on ang **Use my details to create** sa [profile mo](/info/profile.html). Kapag naka-off, itinatala lang ng file na ginawa ito gamit ang Lolly, at kailan.
- **Kung isasama ang art na pinigilan.** Ang may lisensyang art, brand-locked na art at mga catalogue work na ang lisensya ay hindi kailanman naitala ay hindi isinasama bilang default. Kung gumagamit ng alinman ang design, sinasabi ng dialog kung ilan at nag-aalok ng *Download without them* o *Include and download*, dahil ang pagsama sa mga ito ay nagbibigay ng mga file sa sinumang magbubukas ng `.lolly`. Inililista ng `CREDITS.txt` ng file kung ano ang sumama at hindi, kasama ang dahilan; ipinapaliwanag ng [Creative rights at mga credit](/info/creative-rights.html) ang mga patakaran.
- **Kung isasama ang tool.** Ipina-pack ng **Include the tool** ang sariling mga file ng tool, para bumukas ang design sa device na walang tool na iyon. Nagsisimula itong may tsek para sa custom na tool, tulad ng fork, at walang tsek para sa tool na nakalista sa signed catalogue. Sa build na walang signed catalogue, bawat tool ay itinuturing na custom.

**Pagbubukas ng isa.** Sa mga desktop at mobile app, i-double-click o i-tap ang `.lolly`, piliin ang **Open with Lolly** o ipadala ito sa Lolly mula sa share sheet. Sa web app, pindutin ang **Open** o i-drop ang file sa Lolly. Binabasa ng bawat ruta ang manifest ng file muna at ipinapakita ang laki, nilalaman at kung ano ang mangyayari, bago may maisulat.

Kung may dalang tool ang file na wala ka, ipinapakita ng **Trust this tool?** ang tool at ang may-akda nito, at sinasabing ang pagbubukas nito ay nagpapatakbo ng sariling code ng tool sa device mo. Itutuloy ito ng **Trust & install**. Kung tanggihan, nase-save pa rin ang gawa sa Projects, naghihintay sa araw na idagdag mo ang tool. Ang tool na ang code ay dumarating bilang module ay hindi pa maaaring i-install sa ganitong paraan, at tinatanggihan sa parehong paraan.

::: details Ano ang laman ng .lolly, at paano gumagana ang pagbubukas nito
Ang `.lolly` ay ang bundle extension ng Lolly, at sinasabi ng `format` sa `manifest.json` nito kung ano ang nasa loob:

- Ang **shared design** (`lolly-share`) ay may hawak na isang naka-save na session, mga naka-embed na file nito at resibo para sa anumang nareresolba pa sa pamamagitan ng reference. Maaari rin itong magdala ng tool at design system. Ang pagbubukas nito ay nagdaragdag ng bagong Project at hindi kailanman nag-o-overwrite ng session.
- Ang **shared project** (`lolly-share`, kind `project`) ay may hawak na folder mula sa Projects: ang mga sub-folder nito, bawat session sa mga ito na may tile at ang mga larawang naka-file doon. Ang pagbubukas nito ay nagdaragdag ng kopya ng buong folder. Bawat session ay sumasama bilang `sessions/<key>.json` na may tile sa ilalim ng `thumbs/`. Ang Lolly na mas matanda kaysa sa mga project file ay hihilingang mag-update ka.
- Ang **design-system pack** (`lolly-brand`) ay may hawak na token at puwedeng may mga font, logo, nailathalang bersyon at itinagong resource. Ang pagbubukas ng pack ay nagdaragdag ng hiwalay na pinangalanang design system at ginagawang aktibo ang system na iyon.
- Ang **workspace o instance pack** ay `lolly-brand` na may mga idineklarang tool, catalogue asset at opsyonal na instance address. Ang pag-load ng isa ay pumapalit sa nag-iisang workspace overlay na na-load noon, at inililista ng preview ang mga device-wide na epektong iyon.

Ang buong device backup ay hindi `.lolly`. Nananatili itong `LollyTools-….zip` (format `lolly-backup`) at ibinabalik sa pamamagitan ng **Settings → Storage → Import data…**. Ang naka-zip na tool folder ay nananatili ring `.zip`. Ang [Data transfer](/info/data-transfer.html) ang format reference.

Ang `.lolly` ay karaniwang zip. Palitan ang pangalan nito ng `.zip` para tingnan ang loob: ang sarili mong mga larawan ay nasa ilalim ng `assets/uploads/`, ang catalogue art sa ilalim ng `assets/catalog/`, inililista ng `manifest.json` ang bawat file, at sinasabi ng README kung ano ang file.

Nirerehistro ng macOS, Windows, Linux, iOS at Android ang format, ipinapakita ito ng mga desktop file manager bilang Lolly document at maipapakita ng GNOME Files ang sariling thumbnail ng naka-save na session. Ang pagbubukas mula sa Design System Setup ay nagrerekomenda ng design-system action kapag may dala ang shared design, pero hindi kailanman itinatago ang **Open shared design**.

Ang dokumentong ipinasa mula sa ibang app sa iOS o Android ay may limitasyong 48 MB, dahil kinokopya ng hand-off ang mga byte nito sa hangganan ng app, at sinasabi ito ng app. Walang ganoong limitasyon ang **Open** sa loob ng Lolly, kaya gamitin ito para sa mas malaking bundle.

Pagkatapos mong kumpirmahin, ini-inflate at vina-verify ng Lolly ang bundle nang minsan. Ang mga asset ay napupunta sa library mo, itinutugma sa checksum para magamit muli ang file na nasa device na. Ang mga session ay napupunta sa Projects na may bagong id, kaya puwedeng buksan nang dalawang beses ang parehong file; ang session na nawawala ang tool ay naghihintay doon. Ang mga file na higit sa 100 MB ay tinatawag na malaki, at nagbababala ang preview kapag mas kaunti ang libreng espasyong iniuulat ng browser storage kaysa sa kailangan ng file. Sinusuri ang bawat bahaging sakop ng integrity bago mag-commit ng anuman, at tinatanggihan ang sirang kopya nang walang naiiwan.
:::

Parehong nagpapasa ng snapshot ang link at file. Para sa live na pag-edit, sinasaklaw ng [Magtulungan](/info/collaborate.html) ang mga pribadong collab sa pagitan ng dalawang device at opsyonal na work collab sa pamamagitan ng Lolly Work.

## Mga asset - ang library mo

Tinitipon ng **Assets** (`#/a`) ang lahat ng magagamit ng mga tool mo: brand logo, larawan, audio at motion, nakagrupo ayon sa uri, kasama ang sarili mong mga file. Naka-store sa device mo ang mga upload mo. Ang organisasyong gumagamit ng Lolly Work ay puwede ring magbigay ng shared catalogue sa ilalim ng sarili nitong access rule; tingnan ang [Gamitin ang Lolly sa organisasyon mo](/info/organisation.html).

![Mga asset, kasama ang mga swatch at font ng brand at ang sarili mong mga upload](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Dalhin ang mga file mo.** I-drop ang larawan, SVG, audio clip, video, Lottie, PDF o PowerPoint deck sa upload area, o mag-click para pumili. Agad itong dumarating sa Assets at sa asset picker ng bawat tool. Ang multi-page na PDF o `.pptx` ay nagtatanong kung aling mga page o slide ang itatago, at ang bawat isa ay nagiging SVG asset. Ang larawang idinagdag mo sa loob ng tool ay iniingatan kung paano ito dumating sa **My images**, kaya ang Content Credential dito ay nabe-verify pa rin, at ang napakalaking file lang ang nagtatanong kung ire-resize. Ipinapakita ng **Settings → Storage** kung gaano karami ang hawak ng **My images**. Walang limitasyon maliban sa storage ng device mo. Para linisin ang EXIF at GPS data habang pumapasok ang mga larawan, i-on ang **Strip metadata from uploads** sa ilalim ng **Settings → Feature flags**; iniingatan ang Content Credentials sa alinmang paraan.
- <!--i:star--> **I-favourite ang madalas mong abutin.** Lagyan ng star ang asset o brand swatch at ipi-pin ito sa itaas ng bawat picker.
- <!--i:folder--> **Mag-ayos.** Ilipat ang asset sa ibang grupo, itago ang shared na brand asset na hindi mo ginagamit (ibinabalik ito ng **Show hidden**) o burahin ang sarili mong mga upload. Ang parehong selection bar tulad ng sa Projects ay kumikilos sa buong seleksyon.
- <!--i:layers--> **Ihiwalay ang video sa background nito.** Buksan ang mga detalye ng video, o i-right-click ang card nito sa asset picker, at piliin ang **Remove background…**. Ang isang **On-device model** ay naghihiwalay ng subject mula sa magulong eksena; ang **Colour key** ay nag-aalis ng pantay na ilaw na backdrop tulad ng green screen, na may **Tolerance**, **Softness** at **Spill removal** para sa gilid, at hindi nangangailangan ng download. Ang **Resolution** (360, 480, 720 o 1080p, hindi lalampas sa source) ay nagpapalit ng detalye sa bilis. Ang cut-out, isang animated na WebP o PNG na may tunay na transparency, ay sine-save sa tabi ng orihinal, at sumasama ang Content Credential ng source bilang ingredient. Ipinapaliwanag ng [Generated once, rendered the same](/info/ai-features.html) kung bakit nananatili itong simpleng edit.

### Dalhin ang palette at font mo kahit saan

Ipinapakita ng **Swatches** panel sa Assets ang mga kulay na bumubuo sa brand mo: ang mga brand colour nito, mga kulay na idinagdag mo, ang mga ramp nito at ang spectrum nito. Ang mga role colour na iniingatan ng Lolly para sa interface (text, surface, gilid, colourway lead at kopya ng brand colour sa ilalim ng ibang pangalan) ay nasa likod ng kulay-abong **Show colour roles** card sa paanan ng panel.

Ang bawat kulay ay card tulad ng anumang asset. Mag-click ng isa para buksan ang mga detalye nito, pumili ng ilan para i-download lang ang mga iyon o i-download ang buong palette sa format na binabasa ng ibang tool mo:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** o **CSS classes**, para sa stylesheet o build. Ang kulay na mas malawak sa sRGB ay nag-iingat ng malawak nitong value: itinatakda ito ng CSS pagkatapos ng hex, at iniingatan ng JSON ang hex kasama ang malawak na kulay, ang CMYK build at ang spot ink.
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**, para sa Illustrator o Photoshop. Ang kulay na naka-lock sa CMYK build ay dumarating bilang CMYK swatch na iyon, ang spot ink bilang pinangalanang spot swatch at ang kulay na mas malawak sa sRGB bilang Lab.
- <!--i:pentool--> **GIMP palette (.gpl)**, para sa GIMP o Inkscape, at **SCSS variables**, parehong sa sRGB.

![Ang Swatches panel - ang limang palette download button sa itaas, saka ang bawat brand colour bilang chip na nagbubukas ng mga detalye nito](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

Pumili ng mga kulay gamit ang tuldok sa bawat card: Shift-click ng pangalawang tuldok para sa lahat ng nasa pagitan, mag-drag ng kahon sa mga puwang o pindutin ang Cmd/Ctrl+A habang may focus ang isang card. Nag-aalok ang bar ng **Download as…** sa parehong anim na format, **Copy hex** at **Favourite**. Bago ka pumili ng format, inililista ng menu ang anumang kulay na hindi kayang hawakan ng alinmang format (walang kulay ang Transparent), aling mga format ang nagse-save ng malawak na kulay bilang sRGB fallback nito (SCSS at GIMP) at alin ang may dalang CMYK at spot value (JSON at .ase). I-right-click ang card para sa parehong aksyon sa isang kulay.

Pinupuno ng mga detalye ng kulay ang preview ng kulay at nagbubukas ng **Linked values** (ang CMYK build o spot ink nito, anumang value na isinulat para sa partikular na space o press at ang design token nito), **Every notation** (hex, OKLCH, Display-P3 at iba pa, bawat isa ay may copy button), **Plotted on a colour space**, **Tones** at **Readability**. Ang mga arrow key ay lumilipat sa palette, ang **Copy link** ay nagbabahagi ng mismong kulay at ang **Open in Colour Lab** ay dinadala ito pa.

Inililista ng **Fonts** panel ang mga brand face mo na may **download** para sa bawat isa, para i-install nang lokal o ibigay sa print shop.

## Gawing iyo ang grid

- <!--i:star--> **I-favourite ang ginagamit mo.** I-right-click ang card at piliin ang **Add to favourites**, at magkakaroon ito ng malaking tile sa strip sa itaas ng grid. Sinasaklaw ng [Mga paborito mo](/info/favourites.html) ang strip.
- <!--i:eyeoff--> **Itago ang tool na hindi mo ginagamit.** I-right-click ang card, o pumili ng ilan, at piliin ang **Hide tool**. Mawawala ito sa grid at sa mga nahahanap kapag nagta-type sa grid. Ibinabalik ito ng kulay-abong **Show hidden tools (N)** tile sa dulo, malabo, bawat isa ay may **Unhide tool** sa menu nito. Ang pagtatago ay nagbabago lang ng grid mo: bumubukas pa rin ang tool mula sa link o bookmark.
- <!--i:clock--> **Ang mga tool mo, una.** Kapag may naka-save kang gawa sa tatlong magkakaibang tool, ang **Yours** na hanay ng mga chip sa itaas ng grid ay nangunguna sa mga paborito at kamakailang tool mo.
- <!--i:sliders--> **Ayusin ayon sa gusto mo.** Itinatakda ng **View options** ang layout (**Grid**, **Card** o **List**), laki at density ng card, ang pagkakasunod-sunod at category filter.

![Ang dulo ng Tools grid na nakabunyag ang mga nakatagong tool: ang malabong Wordmark card, at sa tabi nito ang kulay-abong tile na nagbalik dito sa view, na ngayon ay nagsasabing Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
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

**Kumilos sa ilang card nang sabay.** I-tsek ang checkbox ng bawat card, mag-drag ng selection box sa walang laman na espasyo o Shift/Cmd-click, at lilitaw ang bar na may pinapayagan ng view na iyon:

- **Tools at Utilities:** Favourite, Hide, Available offline, **View sessions** (Projects, na nagpapakita lang ng mga session na ginawa gamit ang mga tool na iyon) at Copy link para sa isang card.
- **Assets:** Favourite at Hide para sa anumang seleksyon. Lumalabas lang ang Duplicate, Download at Delete kapag ang bawat napiling item ay isa sa sarili mong upload, dahil permanenteng kontrata ang shared na design-system asset.
- **Projects:** tingnan ang [Hanapin at bawiin ang gawa mo](/info/find-your-work.html#find-something-you-saved).

![Ang gallery selection bar para sa dalawang tool, nag-aalok ng Magagamit offline, Tingnan ang mga session, Favourite at Itago](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
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

Lumalabas lang ang **View sessions** kapag may napili na. I-right-click na lang ang isang hindi napiling card at mag-aalok ito ng **N saved sessions**, isang listahan ng mga naka-save na session ng tool na iyon kung saan inililipat ng pagbura ang session sa Trash.

## Sa telepono

Sa makitid na screen, nagiging isang column ang layout:

- Ang mga **kontrol ay nagiging sheet** sa itaas na may drag grip sa ibabang gilid nito. I-drag ang grip para mag-snap sa **peek**, **half** o **full**, o i-tap ito para tumiklop at lumawak. Pinupuno ng preview ang espasyo sa ibaba at nananatiling nakikita habang nag-e-edit ka.
- Ang lumulutang na **Export** button ay nagbubukas ng export sheet: format, laki, kopya, save at download sa iisang lugar. I-tap ang backdrop para isara ang sheet.

![Isang tool sa screen na kasinlapad ng telepono - mga control bilang sheet sa itaas, ang binuong palette na pumupuno sa preview sa ibaba at ang render pill na lumulutang sa ibaba-gitna](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Settings, tunog at ginhawa

Hawak ng **Settings**, sa paanan ng home screen, ang mga detalye mo, mga design system mo, accessibility, storage at offline download. Inilalarawan ng [Settings](/info/dashboard.html) ang bawat tab.

- Ang **mga detalye at headshot mo** ay pumupuno sa anumang tool na ginawang gumamit sa kanila, tulad ng email signature o badge. Sinasaklaw ng [Mga profile](/info/profile.html) ang mga ito.
- Ang **Accessibility** ay may apat na comfort switch: **Reduce motion**, **Hide colourful previews**, **High contrast** at **Large text**. Binabago nila ang app sa paligid ng gawa mo, hindi kailanman ang tool canvas o export.
- Ang **Sound** ay nagpapatugtog ng mahihinahong assistive na tunog para sa ginagawa mo, at ang **Neurospicy Mode** ay nagpapatugtog ng kalmadong focus track. Parehong naka-off hanggang i-on mo, sa **Settings → Accessibility** o sa profile menu.
- Dina-download ng **Available offline** ang natitirang bahagi ng app, mga tool mo, ang catalogue at ang mga gabay bago ka mawalan ng koneksyon. Ang Lolly ay web app na puwede mong i-install: gamitin ang install button ng browser mo, o *Add to Home Screen* sa phone, para sa full-screen na app na nag-a-update mismo kapag online ka ulit.
- Ipinapakita ng **Storage** kung ano ang iniingatan ng Lolly sa device na ito. Ipinapaliwanag ng [Kung i-clear mo ang browser data mo](/info/find-your-work.html#if-you-clear-your-browser-data) kung ano ang inaalis ng pag-clear, at inililista ng [Privacy Policy](/info/privacy.html) ang lahat ng kinukuha o ipinapadala ng app.

::: note Kung hindi ma-load ang view pagkatapos ng update
Ang blangkong panel o mensaheng "failed to fetch" pagkatapos lang ng update ay kadalasang nawawala sa isang reload. Hindi nagagalaw ang naka-save mong gawa, mga session at design system, dahil naka-store ang mga ito sa device mo. Ang larawang idinagdag mo at hindi kailanman na-save lang ang maaaring kailangang idagdag muli.
:::

## Saan susunod

- **[Design: ang malayang canvas](/info/design.html)**: ang canvas, mga hugis, ang timeline at pagpe-present ng deck.
- **[Batch at Multi-edit](/info/batch.html)**: maraming bersyon ng isang design, o ilang naka-save na design na sabay na ine-edit.
- **[Mag-export ng file](/info/exporting.html)**: pagpili ng format, laki, print unit, transparency at video.
- **[Import a design](/info/design-import.html)**: dalhin ang Figma, Penpot, Illustrator o InDesign file sa Design at ituloy ang pag-edit.
- **[Mga template](/info/templates.html)**: naka-save na panimulang punto para sa tool.
- **[Wide Colour at HDR](/info/hdr-editing.html)**: panatilihin ang orihinal na precision ng larawan sa Design at Darkroom.
- **[Hanapin at bawiin ang gawa mo](/info/find-your-work.html)**: kung nasaan ang lahat, at kung paano ilipat ito sa ibang device.
