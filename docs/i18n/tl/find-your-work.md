# Hanapin at bawiin ang gawa mo

May nawawala: design na hindi mo na-save, file na dina-download mo, bersyon noong nakaraang linggo, o lahat pagkatapos ma-clear ang browser. Magsimula sa table, saka sundan ang seksyong itinuturo nito.

Ang personal na gawa ay nananatili sa browser o app na ginawan mo nito, sa device na iyon, maliban kung i-on mo ang [Sync](/info/sync.html). Ang organisasyong gumagamit ng opsyonal na Lolly Work ay nag-iingat din ng **Team projects** sa server nito, na tinatalakay sa ibaba.

| Ano ang ginawa mo | Saan titingin |
|---|---|
| Pinindot ang **I-save bilang** o **I-save** | **Mga Project** |
| Pinindot ang **I-download** | Downloads ng browser mo, at may kopya sa **Mga asset** |
| Wala sa dalawa, sa [isang tool na nag-sa-save habang ginagawa mo](#which-tools-save-as-you-work) | **Mga Project** at **History** |
| Wala sa dalawa, sa ibang tool | Ang tab lang na ginamit mo, hanggang isara mo ang tab |
| Na-delete mo ito sa app | **Trash**, sa **Mga Project**, **Mga asset** o **Mga Setting → Imbakan**, sa loob ng 30 araw |

::: figure find-your-work-places
Kung saan nakatira ang gawa mo: ang sariling storage ng browser ang may hawak ng Projects, History at Trash; ang mga download ay napupunta sa mga folder ng device mo; ang Sync at backup file ay ang mga kopya sa labas ng browser.
:::

::: details Hanapin ang shared na gawa sa Lolly Work (opsyonal)
Buksan ang Lolly ng organisasyon mo at mag-sign in, saka tumingin sa **Projects → Team projects**. Hawak ng instance na iyon ang mga shared session at lumilitaw ayon sa access mo. Ang pag-sign in ay maaaring magbalik ng access sa mga session na iyon sa ibang device; hindi nito ibinabalik ang personal mong library o device backup.

Sa [work collab](/info/collaborate.html#work-collabs-with-lolly-work-optional), hintaying lumabas ang **Saved to work** bago umalis. Kung nawawala ang shared project, i-check na nakakonekta ka sa tamang instance at itanong sa operator nito ang tungkol sa access o retention. Ang pag-clear ng browser data ay nag-aalis ng mga lokal na kopya, hindi ng kopya ng server ng organisasyon. Tingnan ang [Gamitin ang Lolly sa organisasyon mo](/info/organisation.html).
:::

## Hanapin ang na-save mong gawa

1. Pindutin ang **Home** sa kaliwang itaas ng tool.
2. Buksan ang tab na **Mga Project** sa itaas ng home screen (ang folder icon sa telepono).
3. Tingnan ang unang screen. Nandoon ang gawang na-save sa **Aking library**, at bawat project ay isang folder. Para maghanap sa lahat ng folder nang sabay, mag-type sa **Hanapin sa lahat ng project…** sa ilalim ng screen.

Ang item ay pinangalanan ayon sa file name na tinype mo sa export panel, o ayon sa tool nito, tulad ng **QR Code**, kung wala kang tinype. Buksan ang item at bumabalik ang bawat setting, handang baguhin at i-export muli. Para itago ang bagong gawa sa ganitong paraan, tingnan ang [Saving & continuing](/info/using.html#saving-continuing).

::: note Wala sa Mga Project?
- Baka nasa **Trash** ito: tingnan ang [Bawiin ang na-delete mong bagay](#get-back-something-you-deleted).
- Nagsisimulang walang laman ang ibang browser, isang private window o ibang device, maliban kung gagamitin mo ang [Sync](/info/sync.html) o [ililipat ang gawa mo](#move-your-work-to-another-device).
- Kung **I-download** lang ang pinindot mo, tingnan ang [Hanapin ang file na na-download mo](#find-a-file-you-downloaded).
:::

::: details Paggamit ng Mga Project
Puwede mo ring buksan ang **Mga Project** mula sa **Mga Setting → Imbakan → Mga naka-save na session → Ayusin sa Projects**. Gumagana ito tulad ng isang file manager:

![Ang Mga Project bago pa man magkaroon ng na-save: ang mga tile na New folder, New asset at Templates, ang History clock sa kanang itaas at ang Search all projects bar sa ilalim](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **Mga folder na nagnenest.** Igrupo ang mga naka-save na session sa mga folder, at mga folder sa loob ng mga folder, kasing-lalim ng gusto mo. Gumawa ng folder, palitan ang pangalan nito o i-drag ang tile sa ibang folder para ilipat; ibinabalik ka ng breadcrumb pataas. Ang mga session na na-save nang walang folder ay lumilitaw diretso sa **Projects** root.
- <!--i:clock--> **Ayusin ayon sa gusto mo.** Ang **View options**, ang sliders button sa kanang itaas, ay nag-aalok ng **Grid** o **List** at nag-aayos ayon sa **Name**, **Date added**, **Last modified** (ang default), **Size** at, sa loob ng folder, **By tool**. Laging nauuna ang mga folder anuman ang aktibong sort - ang sort ay nag-aayos lang ng mga session at folder sa loob ng sarili nilang grupo.
- <!--i:document--> **I-file diretso ang bagong gawa.** Ang **New asset** ay nagbubukas ng shared picker. Piliin ang **Templates** para magsimula sa naka-save na template: buksan ito para i-edit, o gamitin ang **+ Add** para agad i-save ang bagong likha.
- <!--i:checklist--> **Multi-select (desktop).** I-tsek ang checkbox ng tile, mag-drag ng selection box sa walang laman na espasyo o **Shift/Cmd-click**; **i-right-click** ang tile para sa context menu nito. Ang selection bar ay mag-aalok ng **Render selection**, **Move to…**, **New folder**, **Delete** (na naglilipat sa Trash), **Edit together** para sa dalawa hanggang walong single-tool na session, magkatabi sa ilalim ng isang sidebar, at **Edit as sheet**, na nagbubukas ng seleksyon ng anumang laki o halo bilang mga row sa batch grid.
- <!--i:download--> **I-render ang buong folder o seleksyon.** Ine-export ng **Render folder** ang bawat naka-save na session sa folder - kasama ang mga sub-folder nito - bilang isang naka-nest na `.zip`. Ginagawa ng **Render selection** ang pareho para sa anumang multi-selection, at ang isang session ay nagre-render diretso sa sarili nitong file.
- <!--i:link--> **Dumiretso sa naka-save na gawa ng tool.** I-tsek ang isa o higit pang tool sa Tools gallery at piliin ang **View sessions** mula sa selection bar - bubukas ang Projects na nagpapakita lang ng mga session na ginawa gamit ang mga tool na iyon, na may **Clear** para bumalik sa buong view.
- <!--i:link--> **Magbahagi ng naka-save na session.** I-right-click ang session (sa phone, pindutin ang **•••** sa tile nito) → **Share link** para kopyahin ang link na muling nagbubukas nito na may parehong setting; ang mga larawan mula sa device mo ay hindi sumasama sa link (ang buong Share dialog: tingnan ang [Pagbabahagi ng gawa mo](/info/using.html#sharing-your-work)).
- <!--i:pentool--> **Palitan ang pangalan o kopyahin ang isa.** I-right-click ang session (sa phone, pindutin ang **•••** sa tile nito) para sa **Rename**, **Duplicate** (kopya sa parehong folder) at **Move to…**.

![Ang View options popover sa Mga Project: Layout na may Grid at List, at Sort by na naka-set sa Last modified, sa tabi ng isang button na binabaligtad ang pagkakasunod-sunod](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
<!--
SHOT NOTE (misc-projects-sort): trigger button confirmed as
`.filter-fab.projects-viewopts` in views/projects.ts (openViewOpts() is bound
to `.projects-viewopts` specifically) - `.projects-viewopts` alone is the
more specific hook, so that's what drives the click. The popover it opens
(`.projects-viewmenu`, also confirmed directly in openViewOpts()) is body-
appended, not nested under the Projects root, so cropSelector finds it
regardless. "By tool" only appears inside a folder - this recipe captures at
the Projects ROOT (`url=/#/p`), so if the capture pass wants "By tool"
visible too, point url= at a real folder instead: the route is a path
segment, `/#/p/<folderId>` (confirmed in main.ts's hash router - `parts[0]
=== 'p'` reads `folderId` from `parts[1]`), not a query param. Caveat: a
folder has to already EXIST in the capture profile, which a per-shot fresh
context has none of.
The popover (views/projects-view-options.ts, checked 2026-09-26) holds a
Layout pair (Grid / List) and a Sort by menu with a reverse button; the
options inside the menu (Name, Date added, Last modified, Size, By tool) are
not visible in the closed menu, so the alt does not list them.
-->

:::

## Kung isinara mo ang tab o umalis ka sa tool

Nakadepende ang babalik sa kung paano ka umalis at kung aling tool ang ginamit mo:

- **Isinara mo ang tab, o bumalik ka sa ibang pagkakataon.** Wala na ang hindi na-save na gawa, maliban sa [mga tool na nagse-save habang gumagawa ka](#which-tools-save-as-you-work): buksan ang gawang iyon mula sa **Projects**.
- **Nag-reload ka ng page sa parehong tab.** Bumabalik ang mga setting mo mula sa address ng page. Sa mga tool na hindi nagse-save habang gumagawa ka, ang mga larawan at file na idinagdag mo mula sa device mo, at ang single-line na text na mas mahaba sa 150 character, ay hindi bumabalik, dahil hindi hawak ng address ang mga ito.
- **Pinindot mo ang Home, o ang back button sa kaliwang itaas.** Kung may binago ka mula noong huli mong pag-save, pag-download o pagkopya, tinatanong ng dialog na **Unsaved edits** kung mag-save muna. Sine-save ng **Save & leave** ang gawa at dinadala ka sa **Projects**, o pabalik sa project folder na pinagbuksan mo ng gawa. Itinatapon ng **Leave anyway** ang mga pagbabago mo: ang naka-save na item ay bumabalik sa kung paano mo ito huling na-save, at ang likhang hindi mo kailanman na-save ay umaalis sa **Projects**. Pinananatili ka ng **Cancel** sa tool.

Nagtatanong lang ang Lolly kapag pinindot mo ang **Home** o ang back button sa isang tool. Hindi kailanman nagtatanong ang pagsara ng tab, pag-reload at ang sariling Back button ng browser mo. Para sigurado, pindutin ang **I-save bilang**, o **I-save** sa export panel, bago ka umalis sa isang tool.

Kapag hindi available ang automatic recovery, sinasabi ng tala sa tabi ng mga editing control kung ano ang itatago:

- Sa tool na gumagana sa file na dala mo, i-save ang mga setting mo at itago rin ang mga orihinal na file.
- Sa recording tool, o utility na walang Save action, i-save o i-download ang resulta bago umalis.
- Sinasabi ng mga desktop at mobile app kapag kailangan mong mag-save nang mano-mano.
- Sa pribadong collaboration, ang taong nag-imbita ang nag-iingat ng dokumento at ng history nito, kasama ang mga pagbabago ng kabilang tao. Ang taong sumali ay gumagawa sa pansamantalang kopya at dapat mag-save ng hiwalay na kopya bago matapos ang session.

::: note Hindi sinasadyang umalis nang hindi nag-save?
Sa mga tool na nag-sa-save habang ginagawa mo, may kopya ang History ng mga natanggal na edit. Buksan ang **History** page, hanapin ang mga ito sa ilalim ng **Changes** at pindutin ang **Open as a copy**. Sa ibang tool, nawawala na ang mga pagbabago.
:::

::: details Aling mga tool ang nag-sa-save habang ginagawa mo
Sa web app, nag-sa-save habang ginagawa mo ang bawat tool na gumagawa ng dokumento: Design, Chart, QR Code, Text, Sandbox at ang iba pa. Hindi ito ginagawa ng mga sumusunod na tool:

- mga tool na gumagana sa file na dala mo, tulad ng Redact, Sign o Convert Image, dahil hindi kailanman nag-iingat ng kopya ng file na iyon ang Lolly;
- mga tool na nagre-record mula sa camera, mikropono o screen mo, tulad ng Record, Screen Capture at Voice Recorder;
- tool na walang babaguhin, tulad ng Countdown.

Sa ibang mga tool, ang unang pagbabago mo ay nagfa-file ng gawa sa **Projects** na parang nag-save ka, at ang mga susunod na pagbabago ay iniingatan habang gumagawa ka kapag natapos nang gumuhit ang tool. Ang hindi pa na-save na likha ay nasa Projects pa rin pagkatapos mong isara ang tab, at muling bumubukas na may markang unsaved ang mga pagbabago nito.

Itinatapon pa rin ng **Leave anyway** ang mga pagbabagong iyon, at nag-iingat ang History ng kopya ng mga itinapong edit sa loob ng 30 araw. Ang muling pagbubukas ng tool mula sa home screen ay nagsisimula ng bagong likha; buksan ang nauna mula sa Projects.

Ang 3D at Darkroom ay nagse-save habang gumagawa ka, pero hindi sila nag-iingat ng file na nilo-load mo sa kanila, tulad ng 3D model o LUT. Iniingatan ng History at **Save** ang pangalan, uri at laki ng file, hindi ang file. Kapag muli mong binuksan ang gawa, sinasabi ng tala kung aling file iyon, at gumagana ang tool nang wala ito hanggang i-load mo muli. Itago ang mga orihinal mong file.

Kapag naka-on ang [Sync](/info/sync.html), pumupunta rin sa ibang device mo ang isang likhang na-file sa ganitong paraan, tulad ng iba pang laman ng Projects. Nananatili ang mga bersyon nito sa device kung saan ito ginawa.

Kung bukas ang isang likha sa dalawang tab at nag-save ka sa pareho, ang huling pag-save ang mananatili. Hindi nawawala ang ginawang pinalitan nito: nasa ilalim ito ng **Protected drafts** sa History ng likha, may **Open draft as a copy**.

Gumagana ito sa web app lang, hindi sa desktop o mobile app, at hindi habang nagtatrabaho ka nang live kasama ang iba.
:::

## Hanapin ang file na na-download mo

Sa isang browser, ibinibigay ng **I-download** ang file sa browser mo, na nagse-save nito sa downloads folder nito (karaniwan ay **Downloads**) o nagtatanong sa iyo kung saan. Hindi sinasabihan ang Lolly kung saan napunta ang file, kaya tingnan ang listahan ng downloads ng browser mo.

Kung walang lumabas na file, tingnan sa export panel habang nasa tool ka pa. Sa ilalim ng **I-download**, may isang linya na nagbibigay ng pangalan ng file at ang oras, may **Retry download**, at sa Chrome, Edge at iba pang Chromium browser, may **Save file…** para pumili ka mismo ng folder. Nananatili ang linya at ang file nito hangga't hindi ka umaalis sa tool, nagre-reload o nag-export ulit.

Iniingatan din ng Lolly ang dalawang bagay pagkatapos ng bawat download:

- **Isang kopya ng file**, sa **Mga asset** sa ilalim ng **Ang iyong mga upload**, habang naka-on ang **I-save ang mga render ko sa library ko** sa ilalim ng **Mga Setting → Mga render mo** (nasa ilalim ng home screen ang **Mga Setting**). Naka-on ang setting bilang default. Ang isang video, o isang file na mahigit 50 MB, ay nagtatanong muna, at hindi kinokopya ang isang zip.
- **Ang mga setting na ginamit mo**, para sa huli mong 24 na download. Ang **Kamakailang mga export**, sa ilalim ng na-save mong gawa sa **Mga Project**, ay muling nagbubukas ng tool gamit ang mga setting na iyon para magawa mo ulit ang file, bagaman hindi kasama ang mga larawan at file na idinagdag mo mula sa device mo. Nasa ilalim din ng **Mga Setting → Aktibidad at stats → Pinakabagong exports** ang parehong listahan, at sa **Changes** tab ng **History**. Iniingatan ng listahang ito ang mga setting, hindi ang mga file.

::: details Sa desktop at mobile app
- **Desktop app:** direktang sina-save ng **I-download** sa isang **Lolly** folder sa loob ng **Downloads** folder mo, nang walang dialog. Sinasabi ng linya sa ilalim ng **I-download** kung saan ito napunta, gaya ng "Saved to Downloads/Lolly", may **Show in folder**. Binubuksan ng **Open Exports Folder**, sa **Window** o **Exports** menu, ang folder anumang oras. Ang isang file na may parehong pangalan ng naunang isa ay nase-save bilang "name (1)".
- **iPhone at iPad:** na-save ang file sa **Files** app, sa ilalim ng **Lolly**, at bubukas ang share sheet para maipadala mo ito. Ganito ang linya sa ilalim ng **I-download**: "Saved to Files → Lolly".
- **Android:** bubukas ang share menu para mapili mo kung saan mapupunta ang file.

Sa iPhone, iPad at Android, pinapalitan ng bagong file ang naunang isa na may parehong pangalan.
:::

## Bumalik sa mas naunang bersyon

- **Habang nasa pagbisitang ito:** umuurong ang **I-undo** sa huli mong 100 pagbabago, hangga't hindi ka umaalis sa tool o nagre-reload. Tingnan ang [Undo at redo](/info/using.html#undo-and-redo).
- **Sa [mga tool na nag-sa-save habang ginagawa mo](#which-tools-save-as-you-work):** iniingatan ang mas naunang bersyon ng bawat likha. Sundin ang mga hakbang sa ibaba.
- **Lahat sa device:** kapag naka-on ang [Sync](/info/sync.html), ibinabalik ng **Restore an earlier copy**, sa ilalim ng **Mga Setting → Mga nakakonektang serbisyo**, ang isa sa huling pitong pang-araw-araw na kopya, o ang kopya mula bago ang huli mong apply. Tutugma noon ang lahat sa device na ito sa kopyang iyon, hindi lang iisang disenyo.

Para buksan ang mas naunang bersyon:

1. Pindutin ang **History**, ang clock button sa tabi ng **I-undo** at **I-redo**. Sa Design, nasa top bar ang **History**; sa telepono, pindutin ang **•••** at pagkatapos ay **History**. Sa mga tool na walang **I-undo**, tulad ng Text at Sandbox, nasa tabi ng **Home** ang **History** sa kaliwang itaas.
2. Hanapin ang bersyon ayon sa petsa at oras nito. Kinukuha ang mga row ng **Automatic checkpoint** habang ginagawa mo ito; ang mga row ng **Saved version** ay ang mga oras na nag-save ka.
3. Pindutin ang **Open as a copy**. Bubukas ang bersyon bilang bagong likha, at mananatili ang isang bukas ka na sa dating anyo. Nasa **Mga Project** ang kopya, may "(copy)" pagkatapos ng pangalan nito.

Para itago ang isang bersyon ayon sa pangalan, pindutin ang **Name version**, mag-type ng pangalan at pindutin ang **Keep milestone**. Nakalista ang mga pinangalanang bersyon sa **History** page, sa ilalim ng **Milestones**.

::: details Ang History panel at ang History page
Nililista rin ng **History** panel ang mga row ng **Recovered work**, at hawak ng **Protected drafts** ang huli mong mga edit sa pagitan ng mga checkpoint, may **Open draft as a copy**. Tinutulungan ka ng **Compare** at **Check assets** na pumili bago ka magbukas ng kopya. Baguhin ang **This creation** tungong **All history on this device** para makita ang bawat likha.

Nagiging mas iilan ang Automatic checkpoint habang tumatagal: isa kada minuto para sa huling oras, isa kada oras para sa huling araw, isa kada araw para sa 30 araw, tapos isa kada linggo. Iniingatan lahat ang mga Saved version at ang mga pinangalanang bersyon. Ang pagbura ng isang likha ay naglilipat din ng mga bersyon nito sa **Trash**, at inaalis ito ng **I-delete nang tuluyan**.

Kapag napuno na ang imbakan ng History, ang pinakalumang Automatic checkpoint ng mga likhang hindi mo binuksan sa loob ng 30 araw ang unang inaalis. Palaging naiingatan ang isang save, kahit noon: isinusulat ito bilang kasalukuyang gawa, at sinasabi ng History na hindi ini-keep ang save na ito bilang isang bersyon. Ipinapakita ng **Mga Setting → Imbakan** kung gaano karami ang ginagamit ng History.

Sinasaklaw ng **History** page (`#/history`) ang bawat likha sa browser na ito. Para buksan ito, pindutin ang clock button sa kanang itaas ng home screen o ng **Projects**, piliin ang **Saved sessions** sa profile menu (sa phone, ang bilog na logo button sa kanang itaas), o pindutin ang **Open app history** sa History panel ng tool. Ang mga desktop at mobile app ay walang History page, kaya doon ang clock button ng home screen at ang **Saved sessions** ay nagbubukas ng **Your recent work** sa halip: ang mga pinakabago mong naka-save na session at export, na may link sa Projects.

- Nililista ng **Kamakailan** ang mga likha mo, bagong-bago muna, may **Ipagpatuloy**.
- Inilalagay ng **Changes** ang mga checkpoint, download at resulta ng Convert sa iisang timeline. May **Reopen settings** ang isang download.
- Nililista ng **Milestones** ang mga pinangalanang bersyon.

I-filter ayon sa project, tool at petsa (nasa likod ng **Filters** sa telepono). Walang delete button ang History page; para tanggalin ang isang item, gamitin ang Projects.
:::

## Ilipat ang gawa mo sa ibang device

| Para | Gamitin |
|---|---|
| Panatilihing magkasabay ang mga device mo | **I-sync sa lahat ng device**, sa ilalim ng **Mga Setting → Mga nakakonektang serbisyo**: tingnan ang [Sync your devices](/info/sync.html) |
| Ilipat ang lahat nang minsan | **I-export ang data ko** at **I-import ang data…**, sa ibaba |
| Ibigay ang isang disenyo o isang project | Isang `.lolly` file: **I-export**, tapos **Ibahagi**, tapos **Download .lolly**; para sa buong project, **Download project (.lolly)** sa menu ng folder. Pindutin ang **Buksan** sa ibang device. Tingnan ang [Ang .lolly na file](/info/using.html#the-lolly-file) |

Dala ng isang share link ang mga setting mo, pero hindi ang mga larawan o file na idinagdag mo mula sa device mo.

::: note Walang idinaragdag o binubura ang pag-import
Idinaragdag ang mga folder, favourite at template sa file sa tabi ng mga nasa ibang device na. Kapag nasa dalawa ang isang naka-save na item, ang kopyang mas kamakailang na-save ang mananatili. Nananatili ang mga detalye at setting mo sa device na iyon nang gaya ng dati; napupunan ang mga blangko mula sa file. Ganito rin gumagana ang **Bring it to this device**, sa Sync.
:::

Para ilipat ang lahat nang minsan:

1. Sa lumang device, buksan ang **Mga Setting → Imbakan** at, sa ilalim ng **Ilipat sa ibang device**, pindutin ang **I-export ang data ko**. Nagda-download ang Lolly ng isang `.zip` file na ang pangalan ay nagsisimula sa `LollyTools-`.
2. Dalhin ang file gamit ang USB, i-email sa sarili mo, AirDrop o isang shared folder.
3. Sa bagong device, buksan ang **Mga Setting → Imbakan**, pindutin ang **I-import ang data…**, piliin ang file at pindutin ang **I-import**.

::: note Ang naiiwan
Nananatili sa bawat device ang mga sign-in, key at sync passphrase. Hindi naglalakbay sa anumang ruta ang listahan ng kamakailang download, offline download at AI model. Naglalakbay lang ang version history sa isang **Export my data** file, hindi sa pamamagitan ng Sync o isang `.lolly`. Kapag masyadong malaki ang history para sa isang file, inaalis ang pinakalumang Automatic checkpoint at sinasabi ng export line kung ilan. Puwedeng i-download at buksan ang isang kopyang hawak ng Sync sa storage mo, o piliin sa **Import data…**, tulad ng isang backup file; hihingi ng passphrase mo ang isang naka-encrypt na kopya.
:::

::: details Ano ang laman ng backup file
Ang file ay pinangalanang `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (ang mga bahagi ng pangalan ay galing sa profile mo at inaalis kapag hindi nakatakda; ang `<n>` ay isang pang-araw-araw na counter kaya hindi nagbabanggaan ang mga export sa parehong araw). Naglalaman ito ng profile mo, kasama ang mga folder, Trash, template at favourites mo; bawat naka-save na session kasama ang thumbnail nito; ang mga na-upload mong larawan, font, logo at ang mga kopya ng mga download mo; ang mga design system mo; ang mga preference mo (theme, lapad ng sidebar, lokal na istatistika ng aktibidad); mga na-save na bersyon at resulta mula sa Convert; at, mula sa web app, ang version history ng mga likha mo.

Hindi kasama ang catalogue cache - dina-download muli nito ang sarili sa bagong device. May checksum ang bawat bahagi, kaya ang file na nasira sa daan ay nahuhuli sa pag-import sa halip na maibalik nang sira-sira. Ang mga naka-save na session ay awtomatikong nagre-re-link sa mga na-import mong larawan. Binabasa ng web, desktop at mobile app ang parehong file; ang terminal app ay nagsusulat ng mas simpleng sariling backup, na hindi binabasa ng format na ito. Ang **Export my data & render everything** ay gumagawa ng parehong file kasama ang pangalawang zip na may bawat naka-save na session na na-render sa output nito. (Buong format spec: [Data transfer](/info/data-transfer.html).)
:::

## Kung binura mo ang data ng browser mo

Sa web app, iniingatan ng Lolly ang lahat sa imbakan ng browser mo para sa site na ito: na-save na gawa, larawan, font, design system, version history at offline download. Tinatanggal ng pag-clear ng data ng site na ito sa browser mo ang lahat noon, at hindi na maibabalik ng Lolly ang kahit alin dito. Ang natitira ay ang mga umalis na sa browser: mga file na na-download mo, isang **I-export ang data ko** na file, isang kopya ng [Sync](/info/sync.html) at mga link na ibinahagi mo.

::: warning Bago ka mag-clear ng data ng browser
Pindutin ang **I-export ang data ko** sa ilalim ng **Mga Setting → Imbakan**, at itago ang file sa ibang lugar.
:::

Kapag nagsimula ang app, hinihiling ng Lolly sa browser na huwag i-clear ang storage nito kapag nauubusan ng espasyo ang device, at ang browser ang magpapasya. Sa ilalim ng **Settings → Available offline**, ang linyang nagsisimula sa **Protected** ay nangangahulugang pumayag ang browser. Ang "The browser may clear downloads if the device runs low on space" ay nangangahulugang hindi, at muling humihingi ang **Protect downloads**.

Kung hindi pumayag ang browser, maaari nitong i-clear ang naka-save na gawa pati ang mga download kapag nauubusan ng espasyo, kaya magtago ng kamakailang file ng **Export my data**.

Ipinapakita ng **Mga Setting → Imbakan** kung gaano karaming espasyo ang ginagamit ng bawat uri ng data. Binibilang ng row ng **History** nito ang Automatic checkpoint, ang mga preview at recovery draft ng mga ito; pinapalaya ng **Remove automatic checkpoints older than 30 days** ang espasyong iyon at iniingatan ang mga Saved version at pinangalanang bersyon. Inaalis ng **Burahin ang cache** ang mga na-download na catalogue file, na muling magda-download kapag kailangan. Hinihiling sa iyo ng **Burahin ang lahat ng aking data** na mag-type ng isang salita, i-off ang Sync, at pagkatapos ay alisin ang lahat ng hawak ng Lolly sa browser na ito: ang profile at setting mo, mga naka-save na session kasama ang history at Trash ng mga ito, mga upload, font at design system, ang download log, resulta ng Convert, na-download na AI model at offline copies. Nananatili ang mga file na na-download mo kung saan mo ito na-save. Magsisimula ang app tulad ng sa unang bisita.

![Ang storage card sa screen na kasinlapad ng phone: pinangalanan ang bawat kategorya ng on-device data, na may Clear all my data button sa ibaba](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Sa desktop at mobile app, ang mga naka-save na session ay mga file sa sariling data folder ng app at nasa sariling imbakan ng app ang iba, kaya hindi naaapektuhan ang mga ito ng pag-clear ng isang web browser.

::: details Kung saan iniingatan ng desktop at mobile app ang mga naka-save na session
Isang file kada naka-save na session, sa isang `saved-state` folder:

- macOS: `~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows: `%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux: `~/.local/share/tools.lolly.Desktop/saved-state/`, o ang parehong path sa ilalim ng `$XDG_DATA_HOME`
- iPhone, iPad at Android: sa loob ng sariling imbakan ng app, na hindi ipinapakita ng Files app

Nananatili ang mga larawan, design system at ang listahan ng kamakailang download sa internal storage ng app, hindi sa mga folder na ito. Binabasa ng terminal app at ng command line ang parehong `saved-state` folder: tingnan ang [Where saved sessions live](/info/cli-reference.html#where-saved-sessions-live).
:::

## Bawiin ang na-delete mong bagay

Ang pagbura ng isang naka-save na session, isang folder, isa sa mga upload mo o isa sa mga font mo sa app ay naglilipat nito sa **Trash** sa loob ng 30 araw, saan mo man ito binura: **Mga Project**, **Mga asset**, **Mga Setting → Imbakan** o ang listahan ng naka-save na session ng isang tool. Napupunta ang isang folder kasama ang lahat ng laman nito, bilang iisang entry, at pinapanatili ng isang session ang version history nito habang naroon ito. Kaagad pagkatapos, nag-aalok ang isang mensahe ng **Undo**. Pagkatapos:

1. Buksan ang **Trash**: ang **Trash** tile sa **Mga Project**, ang **Trash** button sa **Mga asset → Ang iyong mga upload**, o ang **Trash** row sa **Mga Setting → Imbakan**. Ang tatlo ay nagbubukas ng parehong listahan.
2. Pindutin ang **I-restore** sa tabi ng item. Babalik ito sa folder nito, at makukuha ulit ng isang font ang mga role nito sa design system nito.

Tinatanggal ng **I-delete nang tuluyan** ang isang item nang tuluyan. Nagtatanong muna ang **I-empty ang Trash**, saka tinatanggal ang bawat item sa Trash. Tinatanggal nang tuluyan ang mga item na mas matanda sa 30 araw.

::: warning Agad ang ilang pagbura
Ang pagbura ng isang design system, isang logo o ng iyong profile photo ay hindi napupunta sa Trash. Agad ding nagbubura ang command line at ang terminal app.
:::

Kapag naka-on ang [Sync](/info/sync.html), puwedeng ibalik ng **Restore an earlier copy** ang estado ng buong device mula sa isang naunang araw, at ibinabalik ng isang **I-export ang data ko** na file ang laman nito.
