# Mga Profile - kung sino ka kapag lumilikha ka

Ang isang **profile** ay ang working identity kung saan gumagawa ang Lolly. Ito ang maliit na set ng detalye na maaaring kunin ng isang tool para hindi mo na kailanganing i-type ulit ang mga ito tuwing gagamit - ang pangalan mo, mga contact details, isang optional na headshot, ilang preference - kasama ang lahat ng naiipon mo habang gumagawa: naka-save na sessions, na-upload na larawan at ang lokal na activity tally.

Ang lahat ng nasa profile ay nananatili **sa device**, sa local database ng browser (IndexedDB sa web PWA, ang filesystem sa mga Tauri app). Walang account at walang ino-upload. Pinamamahalaan mo ito sa ilalim ng **Profile** (sa kanang-itaas ng gallery); ang mga tool ay *bumabasa* lamang nito, at ang partikular na mga field lang na dinisenyo talaga nilang i-pre-fill.

> Ang isang profile ay tungkol sa *iyo* (o kung sino man ang gumagawa dito). Naiiba ito sa **Platform** - ang mga kulay, font at global settings ng brand - at sa **Capabilities**, ang katalogo ng kaya ng app. Tingnan ang [Profile vs Platform vs Capabilities](#profile-vs-platform-vs-capabilities) sa dulo.

## Ano ang laman ng profile

| Bahagi | Ano ito |
|---|---|
| **Pangalan** | Unang pangalan at apelyido. |
| **Contact** | Email at telepono. |
| **Lokasyon** | Lungsod at bansa. |
| **Headshot** | Isang optional na larawan, naka-crop sa square at itinatago bilang lokal na larawan. Ginagamit ng mga tool tulad ng email signatures, quote cards, org charts at dynamic layouts. |
| **Gamitin ang detalye ko para gumawa** | Isang solong opt-in switch (ito ay nagbabasa ng **Using my details** kapag naka-on na). Kinokontrol nito kung ang personal mong detalye ay sumasama bilang **provenance** - ang author/credit line na naka-embed sa mga na-export na file - at bilang author sa mga **/pro** batch run. (Hindi nito ni-ga-gate ang pre-fill: tingnan ang [How tools use your profile](#how-tools-use-your-profile).) |
| **Preferences** | Ang tema mo (Light, Dark o Brand - ang brand theme ay nagpipinta sa app gamit ang sarili mong palette) at kung aling bahagi ng app ang na-enable mo sa pamamagitan ng **Feature flags**. |
| **Accessibility** | Apat na comfort switch - *Reduce motion*, *Hide colourful previews*, *High contrast*, *Large text* - na nakatago sa profile record, kaya sumasama ito sa isang profile export. Tingnan ang [Accessibility](#accessibility). |
| **Ang trabaho mo** | Naka-save na sessions (may thumbnails) - naka-organisa sa nested folders sa **[Projects](/info/using.html)** - ang **My images** library mo at ang lokal na activity stats, lahat naka-key sa profile na ito. |

![Three theme cards, each previewing its own type and colour, with the active one flagged](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

![Ang Profile screen - pangalan, contact, isang optional na headshot at ang mga preference mo](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

Wala sa mga ito ang required. Ang blangkong profile ay perpektong profile pa rin; punan mo lang ang mga bagay na makakatipid sa iyo ng pag-type.

Mahaba ang page, kaya may sarili itong **settings rail** pababa sa gilid - Your details, Appearance, Accessibility, Lolly instance, Your activity, Storage, Available offline, Feature flags, Content Credentials - na may **Search settings** field sa itaas nito na nagfi-filter sa listahan habang nagta-type ka. Deep-linkable ang bawat section bilang `#/profile?focus=<section-id>`, na nagbubukas dito at nag-i-scroll papunta rito (`#/profile?focus=storage-section`, `?focus=feature-flags-section`, at iba pa), kaya maaaring itugma ng isang link ang isang setting sa halip na ang itaas ng page.

![Tatlong theme card, bawat isa ay nagpe-preview ng sariling type at kulay, na may naka-flag na aktibo](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

## Ang profile ay isang konteksto, hindi lang isang tao

Ang salitang "profile" ay parang tumutukoy sa iisang fixed na tao, pero sa Lolly, ito ay talagang isang **creating context** - *kung sino ka habang ginagawa mo ang bagay na ito*. Ang konteksto na ito ay puwedeng magkaroon ng tatlong magkakaibang anyo, at pare-pareho ang paraan ng pag-handle ni Lolly sa lahat ng ito.

### Bilang indibidwal

![The headshot control, empty until you upload a photo that then stays on this device](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

![Ang headshot control, walang laman hanggang mag-upload ka ng larawan na nananatili sa device na ito pagkatapos](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

### Bilang isang team

Hindi kailangang isang tao lang ang profile. Maaari itong tumayo para sa isang **team o function sa loob ng isang org**: ang shared na pangalan ng team, isang group inbox address (`events@…`), isang department, ang headshot o unit mark ng team. Isang tao ang mag-se-set up nito, mag-e-export nito (tingnan sa ibaba) at ang natitirang team ay mag-lo-load ng parehong profile - kaya lahat ng ginagawa ng team ay may consistent na detalye nang hindi na kailangang mag-re-enter ang sinuman. Isang shared kiosk o isang checked-out demo laptop ay maaaring magpatakbo ng iisang team profile na ginagawa bilang ng lahat ng gumagamit nito.

### Bilang isang function - isang role na minsan mong isinusuot

Ito ang sitwasyon na hindi nasasakop ng rigid na modelong "isang tao, isang profile." Puwede kang maging **event manager sa tatlong araw sa isang taon** at ibang-iba naman sa natitirang panahon. Sa tatlong araw na iyon, gusto mo ang event details, ang event inbox, at posibleng event sub-brand para punan ang iyong mga badge at signage; sa natitirang 362 araw, gusto mo namang ibalik ang iyong normal na identity.

Sa Lolly, ang role na iyon ay isa lamang **ibang profile na nakalaan sa iyo** - isang saved bundle (susunod na seksyon) na ino-load mo para sa event at inilalagay sa tabi pagkatapos. Ang role ay parang sombrero, hindi bagong account. Isuot ito kapag kailangan mo, alisin kapag tapos ka na.

## Isang install, isang aktibong profile - marami kang puwedeng itago

Sa anumang sandali, may **isang aktibong profile** ang isang install - ang mga detalyeng nakikita ng isang tool ngayon. Walang in-app profile switcher; sa halip, ang bawat profile ay isang **portable bundle** (isang solong `.zip`, tingnan [sa ibaba](#moving-a-profile-to-a-new-device)). Sadya iyon ang parehong mekanismo ng paglipat sa bagong device - ang isang profile ay isang file na maaari mong i-save, kopyahin at i-load.

![The storage meter, breaking down saved sessions, images and cache against what the browser actually reports](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

- <!--i:trash--> **Pinakamalinis na paglipat:** **Profile → Storage → Clear all my data**, tapos **Import** ang bundle para sa context na papasukan mo. Purong gumagawa ka na bilang profile na iyon.
- <!--i:layers--> **Layering:** ang pag-import *nang hindi* muna nililinis ay **nag-me-merge** - ang na-import na profile, sessions at larawan ay dumadapo sa ibabaw ng nandiyan na, pinapalitan ang anumang may parehong pangalan at iniiwan ang iba. Kapaki-pakinabang para sa pagkuha ng naka-save na sessions ng isang team papunta sa sarili mong setup; hindi ito para sa iyo kung kailangan mo ng malinis na role boundary.
- <!--i:monitor--> **Magkatabi:** dahil device-scoped ang lahat, ang isang hiwalay na browser profile, isang hiwalay na user account o isang pangalawang naka-install na PWA ay may sarili at independiyenteng Lolly profile. Patakbuhin ang personal mong install at ang event kiosk install nang sabay, walang pagpapalit.

Kaya kung talagang nagpapalit-palit ka ng maraming konteksto (ikaw, ang team mo, ang event-manager hat), magtago ka ng ilang bundle at i-load ang kailangan mo:

![Ang storage meter, na nagbabreak down ng naka-save na sessions, mga larawan at cache laban sa aktwal na iniuulat ng browser](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

> Magtago ng isang bundle bawat konteksto at palitan ang pangalan ng mga file ayon sa kung ano sila (`LollyTools-events-2026.zip`, `LollyTools-me.zip`). Ang file *ang* profile.

## Accessibility

Sa **Profile → Accessibility** naroroon ang apat na comfort setting para sa app sa *paligid* ng trabaho mo. Naka-off ang bawat isa hanggang i-on mo ito, at wala sa mga ito ang umaabot sa loob ng isang tool canvas o export - hindi dapat igalaw ng isang mas kalmadong app ang kahit isang pixel ng file na ipinapadala mo.

- <!--i:film--> **Reduce motion** - nagpapatay ng mga transitions, slides at animated flourishes sa app. Nananatiling gumagalaw ang tool canvas mo at anumang animated export sa eksaktong dinisenyo ito.
- <!--i:image--> **Hide colourful previews** - pinapalitan ang gallery preview artwork ng mga kalmadong icon-and-text cards, at binababa ang kulay at contrast ng project thumbnails mo para manatiling makikilala nang hindi nangungulit. Sa loob ng isang tool, buong kulay ang lahat na ipinapakita.
- <!--i:sliders--> **High contrast** - pinapatibay ang borders, text at focus rings ng app. Nananatiling eksaktong itinakda mo ang mga kulay ng brand mo at lahat sa canvas.
- <!--i:font--> **Large text** - pinalalaki ang type ng app: labels, menus at button text. Pinapanatili ng mga control ang laki nila, kaya ang mga salita lang sa loob nila ang lumalaki, at hindi hinihipo ang type sa loob ng mga disenyo mo, kaya walang mare-reflow sa ie-export mo.

Nakatago ang mga ito sa mismong profile record, kaya naglalakbay ito sa isang profile export at dumadapo sa susunod na install kasama ang pangalan mo at ang mga session mo. (Nagtatago rin ang device ng maliit na lokal na mirror para maaplay ang setting bago ang unang paint; device-only ang mirror na iyon at hindi ito naglalakbay.)

## Ang Lolly instance mo

Sinasabi ng **Profile → Lolly instance** kung saan kinukuha ng install na ito ang mga tool at katalogo nito - ang address ng instance, o *Bundled with this app* kapag naka-ship na lahat sa loob ng build. Kung saan may inaalok ang isang deployment, isang **Instance console** link ang nagbubukas ng admin surface nito, at ang **Change** / **Disconnect** ay muling itinuturo ang install o pinapalaya ito.

Ang muling pagtuturo sa ibang instance ay nangangailangan ng **desktop app**: pinipigilan ng browser ang isang page na mag-load ng mga tool at asset sa kabilang origins, kaya sa web, iniuulat lamang ng section kung nasaan ka at iniiwan doon.

## Available offline

Nag-cache ang Lolly habang gumagalaw ka, ngunit ang caching-as-you-go ay sumasaklaw lang sa napuntahan mo na. Ang **Profile → Available offline** ay para sa biyaheng nakikita mong papalapit: isang oras sa airport wifi bago ang isang flight na wala nito. I-download ang mga bahaging kakailanganin mo, panoorin ang isang progress bar, at patuloy na gumagana lahat ng dinala mo kahit wala nang connection.

Pitong bahagi, bawat isa ay may nakasaad na laki bago ka mag-commit:

- <!--i:layout--> **Ang app** - bawat view, editor at font, kasama pati ang mga hindi mo pa nabubuksan. Kung wala ito, ang isang screen na hindi mo binisita online ay hindi ma-lo-load offline.
- <!--i:image--> **Katalogo** - brand assets na higit pa sa mga essentials. Kunin lahat, o buksan ang *Choose by tag* at kunin lamang ang mga tag na ginagamit mo.
- <!--i:book--> **Mga Guide at doc** - ang documentation site na ito, sa wika mo, kasama ang mga screenshot.
- <!--i:cpu--> **Speech voices** - ang voice models sa likod ng Script audio at narration. Na-download nang isang beses, pagkatapos ay tumatakbo ito on-device.
- <!--i:zap--> **Upscaling models** - ang AI image upscalers: photo, illustration/anime at face.
- <!--i:layers--> **Background removal** - ang on-device na cut-out models sa likod ng *Remove background*.
- <!--i:shield--> **Verify deep scan** - ang on-device watermark scanner, para sa pagche-check ng Content Credentials malayo sa connection.

Ang huling apat ay minarkahang **large download**, at sinadyang hiwa-hiwalay ang pag-opt-in: kinukuha ng **Download everything** sa itaas ang app, ang saklaw ng catalogue na napili mo, ang docs at lahat ng tools sa isang pagkuha lang at wala nang iba. Ang speech voices, ang mga upscaler, background removal at ang deep scan ay bawat isa ay nagda-download lang kapag hiningi mo ang row na iyon sa pangalan - hindi tapat ang magtago ng ilang daang megabytes sa loob ng isang button.

Sa ilalim ng mga bahagi ay ang per-tool list: bawat tool ay nagda-download nang isa-isa (ang tsek ay nangangahulugang handa na offline), o ang **Download all** ay kinukuha ang lahat. Ma-resume ang mga download - i-cancel o mawalan ng koneksyon at ipagpapatuloy ito ng susunod na pagpapatakbo kung saan ito huminto, kinukuha lang ang nawawala - at nagre-refresh sila kapag online ka na ulit, kinukuha lang kung ano ang binago ng bagong release.

Kung hindi pa nagbigay ang browser ng persistent storage, sinasabi ito ng seksyon at inaalok ang **Protect downloads**, na humihiling nito - ang pagkakaiba sa pagitan ng "na-download" at "na-download hanggang gustuhin ng browser na kunin ulit ang espasyo".

## Paglipat ng profile sa bagong device

![The two buttons that move a whole install: Export my data writes one zip, Import data reads it back](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Dahil ganap na local ang profile, ang tanging paraan para mailagay ito sa isang blangkong install - bagong laptop, bagong-reset na browser, makina ng katrabaho, o offline na device - ay ang **dalhin ang file**. Walang login ang magre-restore nito para sa iyo, at iyon nga ang punto: wala talagang lumabas sa iyong device mula sa umpisa.

- <!--i:download--> Ang **Export my data** ay nagda-download ng isang `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` - pinangalanan para sa profile na kinabibilangan nito, may per-day sequence number para hindi magbanggaan ang paulit-ulit na exports (ibinabagsak ang mga bahagi ng pangalan kapag wala ang mga ito sa profile). Naglalaman ito ng iyong profile, bawat na-save na session (kasama ang thumbnail nito), ang iyong mga na-upload na larawan - sumasama rin ang iyong brand tokens at naka-install na fonts bilang user assets - at ang iyong mga kagustuhan (theme, layout, local activity stats).
- <!--i:upload--> Ang **Import data…** sa ibang install ay babasahin ang file na iyon at magpapatuloy ka mula mismo sa iyong iniwan.
- <!--i:box--> Isinusulat ng **Export my data & render everything** ang parehong backup *kasama* ang pangalawang zip na nagre-render ng bawat na-save na session sa finished output file nito, sa mga folder na kagaya ng iyong Projects. Isang kompletong offline archive ng parehong sources at resulta - at maaari itong maging malaki at mabagal kung marami ang sessions.

![Ang dalawang button na naglilipat ng buong install: isinusulat ng Export my data ang isang zip, binabasa ito pabalik ng Import data](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Ang bundle ay simple at self-contained na zip, kaya puwede itong dalhin sa **anumang** paraan - USB, AirDrop, network share, email-to-yourself - at maaaring ganap na offline ang target. Bawat bahagi ay may checksum, kaya ang file na nasira sa paglipat ay mahuhuli sa import sa halip na ma-restore nang kalahating-sira. Ang Import ay **nag-me-merge** (ang profile/session/image na may parehong pangalan ay ino-overwrite; pinapanatili ang lahat ng iba), kaya hindi nito kailanman bubura ang isang target na ginagamit na.

Ang hindi kasama sa paglipat: ang catalogue cache (nagda-download ulit ito mismo sa bagong device) at ang mga tool mismo (ipinapalagay na naroroon na).

Para sa eksaktong bundle layout, version policy at integrity rules, tingnan ang **[Data Transfer](/info/data-transfer.html)**; para sa end-to-end walkthrough, **[Using Lolly → Moving to another device](/info/using.html#moving-to-another-device)**.

## Paano ginagamit ng mga tool ang iyong profile

![The single Use my details switch, sitting beside Save Profile and off until you turn it on](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

Ang isang tool ay *nagpu-pre-fill* lamang ng mga field ng profile na talagang dinisenyo nitong i-bind:

**Ang opt-in (provenance).** Kapag nag-export ka ng asset, ang iyong mga detalye ay opsyonal na sumasama bilang **provenance** - isang author/credit line na naka-embed sa metadata ng file (PNG, PDF, SVG, …) - para masabi ng natapos na asset kung sino ang gumawa nito. *Ito* ang pinagagana ng **Use my details to create**: iwanan itong naka-off at dadalhin pa rin ng export ang "Made with Lolly" tool/platform attribution, pero walang personal na author/contact line na naka-embed. (Pinagagana rin ng parehong opt-in ang author sa **/pro** batch runs.) (Para sa tool authors: tingnan ang [Authoring Tools → `bindToProfile`](/info/authoring-tools.html#bindtoprofile) at [Host API → `host.profile`](/info/host-api.html#host-profile).)

![Ang iisang Use my details to create switch, katabi ng Save Profile at naka-off hangga't hindi mo ito binubuksan](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## Profile vs Platform vs Capabilities

Tatlong bagay ang magkalapit sa UI at madaling malito:

- <!--i:people--> **Profile** - *ikaw* (o ang iyong team, o ang role na hawak mo): pangalan, contact, headshot, ang iyong na-save na trabaho. Personal, device-local, portable bilang isang bundle.
- <!--i:palette--> **Platform** - ang *brand*: mga kulay, fonts at global settings na ginagamitan ng bawat tool sa pag-render. Shared at consistent, hindi personal.
- <!--i:sliders--> **Capabilities** - *ano ang kaya ng app*: ang buong feature set at ang mga tools na available sa iyo.

Ang profile ang nagbabago kung *kanino galing* ang isang asset; ang platform ang nagbabago kung *ano ang itsura* nito; ang capabilities ang *magagawa mo*.

### May dalawa pang kahulugan ang "profile" sa ibang bahagi - hindi ito ang tinutukoy dito

Masyadong marami ang kahulugan ng salitang ito sa buong proyekto. Wala sa mga sumusunod ang tumutukoy sa personal na profile na pinag-uusapan ng pahinang ito:

- <!--i:box--> **Content profile** - isang build-time configuration sa `profiles.json` na nagbibigkis ng set ng tool packs sa isang brand catalog (hal. `suse`, `lolly-start`). Ito ang pinipili ng operator kapag nag-de-deploy, at ito rin ang pinipili ng `profile` **URL/CLI parameter** bilang *kulay* variant sa oras ng export (ang ICC/CMYK press condition - tingnan ang [URL Mode](/info/url-mode.html)). Pareho itong tungkol sa *build/output*, hindi tungkol sa *iyo*. Tingnan ang [Configuration](/info/configuration.html).
- <!--i:seal--> **Identity profile** - ang opsyonal na **verified Content Credentials identity** na maaari mong i-enrol (isang short-lived certificate na nag-uugnay ng iyong email sa iyong mga naka-sign na exports). Ito ay isang signing identity, hiwalay sa mga name/contact fields ng personal profile, bagaman pinagagana ng **Use my details to create** kung ang alinman sa dalawa ay naka-embed. Tingnan ang [Content Credentials Identity](/info/content-credentials-identity.html).

![Ang Verified identity card, phone-width: ang certificate lifetime picker at ang enrolment step sa ibaba nito - ang identity profile, hiwalay sa iyong personal na detalye](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## Privacy

Bukod sa opsyonal na identity enrolment sa itaas (na nagpapadala ng email na ini-enrol mo sa certificate service - tingnan ang [Server Surface](/info/server-surface.html)), ang profile ay hindi kailanman ipinapadala, ina-upload o ginagamit para kilalanin o subaybayan ka - walang dapat payagan, ito lang ang paalala para malaman mo kung ano ang naka-imbak. Burahin ang lahat nito anumang oras gamit ang **Profile → Clear all my data**. Tingnan ang [Privacy Policy](/info/privacy.html).
