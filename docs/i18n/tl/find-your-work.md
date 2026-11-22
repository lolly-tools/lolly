# Hanapin at bawiin ang gawa mo

Hanapin ang design na hindi mo na-save, ang file na na-download mo, ang bersyon noong nakaraang linggo o ang gawa mo matapos malinis ang browser. Magsimula sa table.

Nananatili ang personal na gawa sa browser o app kung saan mo ito ginawa, sa device na iyon, maliban kung i-on mo ang [Sync](/info/sync.html). Iniingatan din ng organisasyong gumagamit ng opsyonal na Lolly Work ang **Team projects** sa server nito.

| Ang ginawa mo | Saan titingin |
|---|---|
| Pinindot ang **Save as** o **Save** | **Projects** |
| Pinindot ang **Download** | Mga download ng browser mo at isang kopya sa **Assets** |
| Wala sa dalawa, sa [tool na nagse-save habang gumagawa ka](#which-tools-save-as-you-work) | **Projects** at **History** |
| Wala sa dalawa, sa tool na hindi nagse-save habang gumagawa ka | Sa tab lang na ginamit mo, hanggang isara mo ito |
| Binura ito sa app | **Trash**, sa **Projects**, **Assets** o **Settings → Storage**, sa loob ng 30 araw |

::: figure find-your-work-places
Kung saan nakalagay ang gawa mo: hawak ng sariling storage ng browser ang Projects, History at Trash; napupunta ang mga download sa mga folder ng device mo; ang Sync at backup file ang mga kopya sa labas ng browser.
:::

::: details Hanapin ang ibinahaging gawa sa Lolly Work (opsyonal)
Buksan ang Lolly ng organisasyon mo, mag-sign in at tumingin sa **Projects → Team projects**. Nasa instance na iyon ang mga ibinahaging session at ipinapakita nito ang mga may access ka. Maibabalik ng pag-sign in sa ibang device ang access sa mga session na iyon. Hindi ibinabalik ng pag-sign in ang personal mong library o backup ng device.

Sa isang [work collab](/info/collaborate.html#collabs-through-lolly-work-optional), hintayin ang **Saved to work** bago umalis. Kung may nawawalang ibinahaging project, tingnan kung nakakonekta ka sa tamang instance at tanungin ang operator nito tungkol sa access o retention. Inaalis ng paglilinis ng browser data ang mga lokal na kopya, hindi ang kopya sa server ng organisasyon. Tingnan ang [Gamitin ang Lolly sa organisasyon mo](/info/organisation.html).
:::

<!--i:eti-search-->
## Hanapin ang na-save mo

1. Pindutin ang **Home** sa kaliwang itaas ng tool.
2. Buksan ang **Projects** tab sa itaas ng home screen (ang folder icon sa phone).
3. Nasa unang screen ang lahat ng na-save mo sa **My library**. Isang folder ang bawat project. Para maghanap sa bawat folder, mag-type sa **Search all projects…** sa ibaba ng screen.

Ginagamit ng item ang pangalan ng file na tinype mo sa export panel. Kung walang pangalan ng file, ginagamit nito ang pangalan ng tool nito, tulad ng **QR Code**. Ibinabalik ng pagbubukas ng item ang bawat setting. Para mag-save ng bagong gawa, tingnan ang [Pag-save & pagpapatuloy](/info/using.html#saving-continuing).

::: note Wala sa Projects?
- Baka nasa **Trash** ito: tingnan ang [Ibalik ang binura mo](#get-back-something-you-deleted).
- Nagsisimulang walang laman ang ibang browser, private window o ibang device, maliban kung gumagamit ka ng [Sync](/info/sync.html) o [inililipat mo ang gawa mo](#move-your-work-to-another-device).
- Kung **Download** lang ang pinindot mo, tingnan ang [Hanapin ang na-download mong file](#find-a-file-you-downloaded).
:::

::: details Paggamit ng Projects
Puwede mo ring buksan ang **Projects** view mula sa **Settings → Storage → Saved sessions → Organise in Projects**. Gumagana ito tulad ng file manager:

![Ang Projects bago may ma-save: ang mga tile na New folder, New asset at Templates, ang History clock sa kanang itaas at ang Search all projects bar sa ibaba](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **Mga folder sa loob ng mga folder.** Ilagay ang mga naka-save na session sa mga folder at ang mga folder sa loob ng ibang folder, sa kahit anong lalim. Gumawa o magpalit ng pangalan ng folder, o mag-drag ng tile papunta sa folder para ilipat ang tile. Ibinabalik ka ng breadcrumb sa mas mataas na antas. Nasa root ng **Projects** ang mga session na na-save nang walang folder.
- <!--i:clock--> **Ayusin ayon sa gusto mo.** Ang **View options**, ang button na may mga slider sa kanang itaas, ay nag-aalok ng **Grid** o **List** at nag-aayos ayon sa **Name**, **Date added**, **Last modified** (ang default), **Size** at, sa loob ng folder, **By tool**. Laging nauuna ang mga folder. Magkahiwalay na inaayos ang mga session at folder sa sarili nilang grupo.
- <!--i:document--> **Direktang ilagay ang bagong gawa.** Binubuksan ng **New asset** ang pinagsasaluhang picker. Piliin ang **Templates** para magsimula sa naka-save na template. Buksan ang template para i-edit, o pindutin ang **+ Add** para agad mag-save ng bagong gawa.
- <!--i:checklist--> **Pumili ng marami (desktop).** Lagyan ng tsek ang checkbox ng tile, mag-drag ng selection box sa bakanteng espasyo o **Shift/Cmd-click**. Para sa context menu ng tile, **i-right-click** ang tile. Nag-aalok ang selection bar ng **Render selection**, **Move to…**, **New folder** at **Delete** (papunta sa Trash). Binubuksan ng **Edit together** nito ang dalawa hanggang walong session na tig-iisang tool, magkakatabi sa ilalim ng iisang sidebar. Binubuksan ng **Edit as sheet** ang seleksyon, anuman ang laki o halo, bilang mga row sa batch grid.
- <!--i:download--> **I-render ang buong folder o seleksyon.** Ine-export ng **Render folder** ang bawat naka-save na session sa folder at mga subfolder nito bilang iisang nested na `.zip`. Ganoon din ang ginagawa ng **Render selection** para sa seleksyon ng marami. Nire-render ang isang session sa sarili nitong file.
- <!--i:link--> **Dumiretso sa naka-save na gawa ng isang tool.** Lagyan ng tsek ang isa o higit pang tool sa Tools gallery at piliin ang **View sessions** sa selection bar. Pagkatapos, ipinapakita lang ng Projects ang mga session na ginawa gamit ang mga tool na iyon. Ibinabalik ng **Clear** ang buong view.
- <!--i:link--> **Magbahagi ng naka-save na session.** I-right-click ang session (sa phone, pindutin ang **•••** sa tile nito) at piliin ang **Share link**. Muling binubuksan ng link ang session na may parehong mga setting. Hindi sumasama sa link ang mga larawan mula sa device mo. Para sa buong Share dialog, tingnan ang [Pagbabahagi ng gawa mo](/info/using.html#sharing-your-work).
- <!--i:pentool--> **Palitan ang pangalan o gumawa ng kopya.** May **Rename**, **Duplicate** (kopya sa parehong folder) at **Move to…** din sa parehong menu.

![Ang View options popover sa Projects: Layout na may Grid at List, at Sort by na nakatakda sa Last modified, sa tabi ng button na bumabaligtad sa pagkakasunod](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
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

<!--i:eti-refresh-->
## Kung isinara mo ang tab o umalis sa tool

Nakadepende sa paraan ng pag-alis mo at sa tool kung ano ang babalik:

- **Isinara mo ang tab, o bumalik ka sa ibang pagkakataon.** Wala na ang hindi na-save na gawa, maliban sa [mga tool na nagse-save habang gumagawa ka](#which-tools-save-as-you-work). Buksan ang gawang iyon mula sa **Projects**.
- **Ni-reload mo ang page sa parehong tab.** Bumabalik ang mga setting mo mula sa address ng page. Sa mga tool na hindi nagse-save habang gumagawa ka, hindi hawak ng address ang mga larawan at file mula sa device mo o text na nasa iisang linya na lampas 150 character, kaya hindi bumabalik ang mga ito.
- **Pinindot mo ang Home, o ang back button sa kaliwang itaas.** Kung may binago ka mula noong huli kang nag-save, nag-download o nag-copy, nagtatanong ang **Unsaved edits** dialog kung ise-save muna. Sine-save ng **Save & leave** ang gawa at dinadala ka sa **Projects**, o pabalik sa project folder kung saan mo binuksan ang gawa. Itinatapon ng **Leave anyway** ang mga pagbabago mo. Bumabalik ang naka-save na item sa huling save nito, at inaalis sa **Projects** ang gawang hindi mo na-save kailanman. Pinapanatili ka ng **Cancel** sa tool.

::: warning Hindi muna nagtatanong kapag isinasara ang tab
Hindi kailanman nagtatanong ang pagsasara ng tab, pag-reload at sariling Back button ng browser mo. Para makasiguro, pindutin ang **Save as**, o **Save** sa export panel, bago ka umalis sa tool.
:::

Kapag walang awtomatikong recovery, sinasabi ng tala sa tabi ng mga kontrol sa pag-edit kung ano ang dapat itago:

- Sa tool na gumagana sa file na dala mo, i-save ang mga setting mo at itago rin ang mga orihinal na file.
- Sa recording tool, o utility na walang Save action, i-save o i-download ang resulta bago umalis.
- Sinasabi ng mga desktop at mobile app kung kailan mo kailangang mag-save nang mano-mano.
- Sa pribadong collaboration, ang taong nag-imbita ang nag-iingat ng dokumento at history nito, kasama ang mga pagbabago ng kabilang tao. Gumagawa sa pansamantalang kopya ang taong sumali at dapat siyang mag-save ng hiwalay na kopya bago matapos ang session.

::: note Aksidenteng umalis nang hindi nag-save?
Sa mga tool na nagse-save habang gumagawa ka, nag-iingat ang History ng kopya ng mga itinapong edit sa loob ng 30 araw. Buksan ang **History** page, hanapin ang mga ito sa ilalim ng **Changes** at pindutin ang **Open as a copy**. Sa ibang tool, wala na ang mga pagbabago.
:::

::: details Aling mga tool ang nagse-save habang gumagawa ka
Sa web app, nagse-save habang gumagawa ka ang bawat tool na gumagawa ng dokumento, tulad ng Lolly Design, Lolly Chart, QR Code, Text at Lolly Sandbox. Hindi ito ginagawa ng mga tool na ito:

- mga tool na gumagana sa file na dala mo, tulad ng Redact, Sign o Convert Image, dahil hindi kailanman nag-iingat ang Lolly ng kopya ng file na iyon;
- mga tool na nagre-record mula sa camera, mikropono o screen mo, tulad ng Record, Lolly Screen Capture at Lolly Voice Recorder;
- tool na walang mababago, tulad ng Countdown.

Sa ibang tool, inilalagay ng unang pagbabago mo ang gawa sa **Projects** na para bang nag-save ka. Iniingatan ang mga susunod na pagbabago kapag tapos nang gumuhit ang tool. Nananatili sa Projects ang hindi na-save na gawa matapos mong isara ang tab at muling bumubukas na may markang hindi pa na-save ang mga pagbabago nito.

**Leave anyway** ang nagtatapon pa rin ng mga pagbabagong iyon. Nagsisimula ng bagong gawa ang muling pagbubukas ng tool mula sa home screen; buksan ang nauna mula sa Projects.

Nagse-save habang gumagawa ka ang 3D at Lolly Darkroom, pero hindi nila iniingatan ang file na nilo-load mo sa mga ito, tulad ng 3D model o LUT. Iniingatan ng History at **Save** ang pangalan, uri at laki ng file, hindi ang file mismo. Kapag binuksan mo ulit ang gawa, sinasabi ng tala kung aling file iyon, at gumagana ang tool nang wala ang file hanggang i-load mo ulit ang file na iyon. Itago ang mga orihinal mong file.

Kapag naka-on ang [Sync](/info/sync.html), napupunta sa iba mong device ang gawang inilagay sa ganitong paraan. Nananatili ang mga bersyon nito sa device kung saan ginawa ang mga ito.

Kung bukas ang isang gawa sa dalawang tab at nag-save ka sa pareho, ang huling save ang iniingatan. Nasa ilalim ng **Protected drafts** sa History ng gawa ang napalitang gawa, na may **Open draft as a copy**.

Gumagana lang ito sa web app, hindi sa mga desktop o mobile app, at hindi habang live kang gumagawa kasama ang iba.
:::

<!--i:eti-download-->
## Hanapin ang na-download mong file

Sa browser, ipinapasa ng **Download** ang file sa browser mo. Sine-save ng browser ang file sa downloads folder nito (karaniwang **Downloads**) o nagtatanong kung saan. Hindi sinasabi sa Lolly kung saan napunta ang file, kaya tumingin sa listahan ng mga download ng browser mo.

Kung walang lumabas na file, tumingin sa export panel habang nasa tool ka pa. Sa ilalim ng **Download**, may linyang nagsasaad ng pangalan ng file at oras, kasama ang **Retry download**. Sa Chrome, Edge at iba pang Chromium browser, nag-aalok din ang linya ng **Save file…** para pumili ng folder. Nananatili ang linya at file nito hanggang umalis ka sa tool, mag-reload o mag-export ulit.

Nag-iingat din ang Lolly ng dalawang bagay pagkatapos ng bawat download:

- **Isang kopya ng file**, sa **Assets** sa ilalim ng **Your uploads**, habang naka-on ang **Save my renders to my library** sa ilalim ng **Settings → Your renders** (nasa ibaba ng home screen ang **Settings**). Naka-on ang setting sa simula. Nagtatanong muna kapag video, o file na lampas 50 MB, at hindi kinokopya ang zip.
- **Ang mga setting na ginamit mo**, para sa huling 24 na download mo. Muling binubuksan ng **Recent exports**, sa ibaba ng naka-save mong gawa sa **Projects**, ang tool na may mga setting na iyon. Hindi kasama ang mga larawan at file na idinagdag mo mula sa device mo. Nasa ilalim din ng **Settings → Activity & stats → Latest exports** at sa **Changes** tab ng **History** ang parehong listahan.

::: details Sa mga desktop at mobile app
- **Desktop app:** nagse-save ang **Download** sa **Lolly** folder sa loob ng **Downloads** folder mo, nang walang dialog. Sinasabi ng linya sa ilalim ng **Download** kung saan napunta ang file, tulad ng "Saved to Downloads/Lolly", kasama ang **Show in folder**. Binubuksan ng **Open Exports Folder**, sa **Window** o **Exports** menu, ang folder anumang oras. Ang file na kapangalan ng nauna ay sine-save bilang "name (1)".
- **iPhone at iPad:** sine-save ang file sa **Files** app, sa ilalim ng **Lolly**, at bumubukas ang share sheet. Nakasaad sa linya sa ilalim ng **Download** ang "Saved to Files → Lolly".
- **Android:** bumubukas ang share menu. Piliin kung saan pupunta ang file.

Sa iPhone, iPad at Android, pinapalitan ng bagong file ang naunang file na may parehong pangalan.
:::

<!--i:eti-history-->
## Bumalik sa naunang bersyon

- **Sa pagbisitang ito:** umaatras ang **Undo** sa huling 100 pagbabago mo, hanggang umalis ka sa tool o mag-reload. Tingnan ang [Undo at redo](/info/using.html#undo-and-redo).
- **Sa [mga tool na nagse-save habang gumagawa ka](#which-tools-save-as-you-work):** iniingatan ang mga naunang bersyon ng bawat gawa.
- **Lahat ng nasa device:** kapag naka-on ang [Sync](/info/sync.html), ibinabalik ng **Restore an earlier copy**, sa ilalim ng **Settings → Connected services**, ang isa sa huling pitong pang-araw-araw na kopya o ang kopya bago ang huli mong pag-apply. Pagkatapos, tumutugma sa kopyang iyon ang lahat ng nasa device na ito.

Para magbukas ng naunang bersyon:

1. Pindutin ang **History**, ang clock button sa tabi ng **Undo** at **Redo**. Sa Lolly Design, nasa top bar ang **History**. Sa phone, pindutin ang **•••** at pagkatapos ang **History**. Sa mga tool na walang **Undo**, tulad ng Text at Lolly Sandbox, nasa tabi ng **Home** sa kaliwang itaas ang **History**.
2. Hanapin ang bersyon ayon sa petsa at oras nito. Kinukuha ang mga row na **Automatic checkpoint** habang gumagawa ka; ang mga row na **Saved version** ang mga pagkakataong nag-save ka.
3. Pindutin ang **Open as a copy**. Bumubukas ang bersyon bilang bagong gawa, at nananatili sa dati nitong kalagayan ang nakabukas mong gawa. Nasa **Projects** ang kopya, na may "(copy)" pagkatapos ng pangalan nito.

Para mag-ingat ng bersyon na may pangalan, pindutin ang **Name version**, mag-type ng pangalan at pindutin ang **Keep milestone**. Nakalista ang mga pinangalanang bersyon sa **History** page, sa ilalim ng **Milestones**.

::: details Ang History panel at ang History page
Inililista rin ng **History** panel ang mga row na **Recovered work**, at hawak ng **Protected drafts** ang mga pinakahuling edit mo sa pagitan ng mga checkpoint, kasama ang **Open draft as a copy**. Tumutulong ang **Lolly Compare** at **Check assets** sa pagpili bago ka magbukas ng kopya. Ilipat ang **This creation** sa **All history on this device** para makita ang bawat gawa.

Paunti nang paunti ang mga awtomatikong checkpoint habang tumatagal: isa bawat minuto sa huling oras, isa bawat oras sa huling araw, isa bawat araw sa loob ng 30 araw, pagkatapos ay isa bawat linggo. Iniingatan ang lahat ng na-save at pinangalanang bersyon. Inililipat din sa **Trash** ang mga bersyon kapag binura ang isang gawa, at inaalis ang mga ito ng **Delete forever**.

Kapag napuno ang storage ng History, unang inaalis ang mga pinakalumang awtomatikong checkpoint ng mga gawang hindi mo nabubuksan sa loob ng 30 araw. Kahit ganoon, laging iniingatan ang isang save. Isinusulat ito bilang kasalukuyang gawa, at sinasabi ng History na hindi iniingatan ang save na ito bilang bersyon. Ipinapakita ng **Settings → Storage** kung gaano kalaking espasyo ang ginagamit ng History.

Sinasaklaw ng **History** page (`#/history`) ang bawat gawa sa browser na ito. Para buksan ang page, pindutin ang clock button sa kanang itaas ng home screen o ng **Projects**, piliin ang **Saved sessions** sa profile menu (sa phone, ang bilog na logo button sa kanang itaas) o pindutin ang **Open app history** sa History panel ng tool. Walang History page ang mga desktop at mobile app. Doon, binubuksan ng clock button ng home screen at ng **Saved sessions** ang **Your recent work**: ang mga pinakahuli mong naka-save na session at export, na may link sa Projects.

- Inililista ng **Recent** ang mga gawa mo, pinakabago muna, kasama ang **Resume**.
- Inilalagay ng **Changes** ang mga checkpoint, download at resulta ng Convert sa iisang timeline. May **Reopen settings** ang download.
- Inililista ng **Milestones** ang mga pinangalanang bersyon.

Bawat gawa ay isang tile na may larawan nito. Binabago ng **Grid** o **List** ang layout. Mag-filter ayon sa project, tool at petsa (sa loob ng **Filters** sa phone). Nag-aalok ang menu ng tile (right-click o pindutin nang matagal) ng **Resume**, **Versions**, **Show in Projects** at **Move to Trash**. Para mag-alis ng marami, piliin ang mga ito at piliin ang **Move to Trash**, na nag-aalok ng Undo.
:::

<!--i:eti-folder-move-->
## Ilipat ang gawa mo sa ibang device

| Para | Gamitin |
|---|---|
| Panatilihing magkatugma ang mga device mo | **Sync across devices**, sa ilalim ng **Settings → Connected services**: tingnan ang [I-sync ang mga device mo](/info/sync.html) |
| Ilipat ang lahat nang isang beses | **Export my data** at **Import data…**, sa ibaba |
| Ipasa ang isang design o isang project | Isang `.lolly` file: **Export**, pagkatapos **Share**, pagkatapos **Download .lolly**; para sa buong project, **Download project (.lolly)** sa menu ng folder. Pindutin ang **Open** sa kabilang device. Tingnan ang [Ang .lolly file](/info/using.html#the-lolly-file) |

Dala ng share link ang mga setting mo, pero hindi ang mga larawan o file na idinagdag mo mula sa device mo.

::: note Nagdaragdag ang pag-import at walang binubura
Idinaragdag ang mga folder, paborito at template sa file sa mga nasa kabilang device na. Kapag nasa pareho ang isang naka-save na item, iniingatan ang kopyang mas bagong na-save. Nananatili sa dati ang mga detalye at setting mo sa device na iyon. Pinupunan mula sa file ang mga walang laman. Ganoon din gumagana ang **Bring it to this device**, sa Sync.
:::

Para ilipat ang lahat nang isang beses:

1. Sa lumang device, buksan ang **Settings → Storage** at, sa ilalim ng **Move to another device**, pindutin ang **Export my data**. Nagda-download ang Lolly ng isang `.zip` file na nagsisimula sa `LollyTools-` ang pangalan.
2. Ilipat ang file gamit ang USB, email sa sarili mo, AirDrop o ibinahaging folder.
3. Sa bagong device, buksan ang **Settings → Storage**, pindutin ang **Import data…**, piliin ang file at pindutin ang **Import**.

::: note Ano ang naiiwan
Nananatili sa bawat device ang mga sign-in, key at sync passphrase. Hindi sumasama sa alinmang paraan ng paglipat ang listahan ng mga kamakailang download, mga offline download at AI model. Sumasama lang ang version history sa **Export my data** file, hindi sa Sync o `.lolly`. Kapag masyadong malaki ang history para sa isang file, hindi isinasama ang mga pinakalumang awtomatikong checkpoint at sinasabi ng export line kung ilan. Puwede mong i-download at buksan ang kopyang iniingatan ng Sync sa storage mo, o piliin ang kopya sa **Import data…**, tulad ng backup file. Hinihingi ng naka-encrypt na kopya ang passphrase mo.
:::

::: details Ano ang laman ng backup file
Ang pangalan ng file ay `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`. Galing sa profile mo ang mga bahagi ng pangalan at inaalis ang mga ito kung hindi nakatakda. Binibilang ng `<n>` ang mga export na ginawa sa parehong araw. Naglalaman ito ng profile mo, kasama ang mga folder, Trash, template at paborito mo; bawat naka-save na session kasama ang thumbnail nito; mga na-upload mong larawan, font, logo at kopya ng mga download mo; mga design system mo; mga preference mo (theme, lapad ng sidebar, lokal na istatistika ng aktibidad); mga naka-save na bersyon at resulta mula sa Convert; at, mula sa web app, ang version history ng mga gawa mo.

Hindi kasama ang catalogue cache. Dina-download ulit ng bagong device ang cache. May checksum ang bawat bahagi, kaya natutukoy ng pag-import ang file na nasira habang inililipat. Muling naka-link ang mga naka-save na session sa mga na-import mong larawan. Binabasa ng mga web, desktop at mobile app ang parehong file. Nagsusulat ang terminal app ng sarili nitong mas simpleng backup, na hindi nababasa ng format na ito. Ginagawa ng **Export my data & render everything** ang parehong file at isa pang zip na may bawat naka-save na session na na-render sa output nito. Nasa [Paglipat ng data](/info/data-transfer.html) ang buong format.
:::

<!--i:eti-globe-->
## Kung buburahin mo ang browser data mo

Sa web app, iniingatan ng Lolly ang lahat sa storage ng browser mo para sa site na ito: naka-save na gawa, mga larawan, font, design system, version history at mga offline download. Inaalis ang lahat ng iyon kapag binura ang data ng site na ito sa browser mo, at hindi maibabalik ng Lolly ang alinman dito. Ang natitira ay ang mga nakalabas na sa browser: mga file na na-download mo, **Export my data** file, kopya sa [Sync](/info/sync.html) at mga link na ibinahagi mo.

::: warning Bago mo burahin ang browser data
Pindutin ang **Export my data** sa ilalim ng **Settings → Storage** at itago ang file sa ibang lugar.
:::

Kapag nagsisimula ang app, hinihiling ng Lolly sa browser na huwag burahin ang storage nito kapag kapos na sa espasyo ang device, at ang browser ang nagpapasya. Sa ilalim ng **Settings → Available offline**, ang linyang nagsisimula sa **Protected** ay nangangahulugang pumayag ang browser. Ang "The browser may clear downloads if the device runs low on space" ay nangangahulugang hindi ito pumayag, at humihiling ulit ang **Protect downloads**.

Kung hindi pumayag ang browser, puwede nitong burahin ang naka-save na gawa pati ang mga download kapag kapos na sa espasyo, kaya mag-ingat ng bagong **Export my data** file.

**Settings → Storage** ang nagpapakita kung gaano kalaking espasyo ang ginagamit ng bawat uri ng data. Binibilang ng **History** row nito ang mga awtomatikong checkpoint, preview ng mga ito at mga recovery draft. Binabakante ng **Remove automatic checkpoints older than 30 days** ang espasyong iyon at iniingatan ang mga na-save at pinangalanang bersyon. Inaalis ng **Clear cache** ang mga na-download na catalogue file, na muling dina-download kapag kailangan. Hinihingi ng **Clear all my data** na mag-type ka ng isang salita, ino-off ang Sync at pagkatapos ay inaalis ang lahat ng iniingatan ng Lolly sa browser na ito: ang profile at mga setting mo, mga naka-save na session kasama ang history ng mga ito at ang Trash, mga upload, font at design system, ang download log, mga resulta ng Convert, mga na-download na AI model at offline na kopya. Nananatili ang mga na-download mong file kung saan mo sine-save ang mga ito. Pagkatapos, nagsisimula ang app na parang unang pagbisita.

![Ang storage card sa screen na kasinglapad ng phone: nakapangalan ang bawat kategorya ng data sa device, kasama ang Clear all my data button sa ibaba](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Sa mga desktop at mobile app, ang mga naka-save na session ay mga file sa sariling data folder ng app, at nasa sariling storage ng app ang lahat ng iba pa. Hindi naaapektuhan ang mga ito ng paglilinis ng web browser.

::: details Kung saan iniingatan ng mga desktop at mobile app ang mga naka-save na session
Isang file bawat naka-save na session, sa isang `saved-state` folder:

- macOS: `~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows: `%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux: `~/.local/share/tools.lolly.Desktop/saved-state/`, o ang parehong path sa ilalim ng `$XDG_DATA_HOME`
- iPhone, iPad at Android: sa loob ng sariling storage ng app, na hindi ipinapakita ng Files app

Nananatili ang mga larawan, design system at listahan ng mga kamakailang download sa internal storage ng app, hindi sa mga folder na ito. Binabasa ng terminal app at command line ang parehong `saved-state` folder: tingnan ang [Kung saan nakalagay ang mga naka-save na session](/info/cli-reference.html#where-saved-sessions-live).
:::

<!--i:eti-trash-->
## Ibalik ang binura mo

Kapag binura mo sa app ang isang naka-save na session, folder, isa sa mga upload mo o isa sa mga font mo, inililipat ito sa **Trash** sa loob ng 30 araw, saan mo man ito binura: **Projects**, **Assets**, **Settings → Storage** o listahan ng mga naka-save na session ng tool. Napupunta sa Trash bilang iisang entry ang folder at lahat ng laman nito. Nananatili ang version history ng session sa Trash. Pagkabura mo, may mensaheng nag-aalok ng **Undo**. Sa ibang pagkakataon:

1. Buksan ang **Trash**: ang **Trash** tile sa **Projects**, ang **Trash** button sa **Assets → Your uploads** o ang **Trash** row sa **Settings → Storage**. Parehong listahan ang binubuksan ng tatlo.
2. Pindutin ang **Restore** sa tabi ng item. Bumabalik ito sa folder nito, at naibabalik sa font ang mga role nito sa design system nito.

**Delete forever** ang permanenteng nag-aalis ng isang item. Nagtatanong muna ang **Empty Trash**, pagkatapos ay inaalis ang bawat item sa Trash. Permanenteng inaalis ang mga item na lampas 30 araw na.

::: warning Agad ang ilang pagbura
Hindi napupunta sa Trash ang binurang design system, logo o profile photo mo. Agad ding nagbubura ang command line at terminal app.
:::

Kapag naka-on ang [Sync](/info/sync.html), maibabalik ng **Restore an earlier copy** ang kalagayan ng buong device sa isang naunang araw, at ibinabalik ng **Export my data** file ang laman nito.
