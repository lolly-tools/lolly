# Settings

Ang Settings ang lugar kung saan mo binabago kung paano gumagana ang Lolly para sa iyo: ang mga detalye mo, ang design system na ginagamit mo, accessibility, kung ano ang naka-store sa device na ito at kung ano ang handa offline. Buksan ito gamit ang **Settings** sa bar sa paanan ng home screen, o mula sa avatar menu mo. Bumubukas ito sa **Preferences**, na may apat pang tab sa tabi.

| Tab | Address | Ano ang hawak nito |
|---|---|---|
| **Preferences** | `#/settings` | Ang mga detalye mo, design system, appearance, emoji, accessibility, koneksyon, storage at offline download |
| **This device** | `#/settings?tab=device` | Live na readout ng browser at makinang ito, kasama ang tunog at read-only na storage view |
| **Design system** | `#/settings?tab=brand` | Ang aktibong design system bilang cover at mga pahina, na may strip ng mga cover para lumipat ng system |
| **Capabilities** | `#/settings?tab=caps` | Lahat ng kaya ng Lolly, bilang mga card na mahahanap |
| **Activity & stats** | `#/settings?tab=activity` | Ang catalogue, ang mga lokal mong counter at kamakailang gawa |

May sariling address ang bawat tab, at ang mga lumang link na `#/profile` at `#/d` ay bumubukas pa rin sa tamang lugar, hanggang sa mga indibidwal na setting.

## Preferences

Ang Preferences ay isang mahabang page na may **settings rail** sa gilid at **Search settings** field sa itaas ng rail na nagfi-filter nito habang nagta-type ka. Bawat seksyon ay direktang bumubukas mula sa link na may anyong `#/settings?focus=<section-id>`, halimbawa `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - ang pangalan, mga detalye ng contact at headshot mo, at ang **Use my details to create** switch. Ipinapaliwanag ng [Mga profile](/info/profile.html) kung paano ginagamit ng mga tool ang mga ito.
- <!--i:seal--> **Content Credentials** - ang opsyonal na verified identity na pumipirma sa mga export mo. Tingnan ang [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - lumipat, magdagdag, magtago o mag-alis ng design system. Sinasaklaw ng [Design System Setup](/info/brand-studio.html#manage-your-design-systems) ang bawat aksyon.
- <!--i:moon--> **Appearance** - ang theme (Light, Dark o Brand, na pinipinturahan ang app sa palette mo) at **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - ang set na pinagguguhitan ng mga emoji mo kapag nagsimula ka ng bago, kasama ang lisensya ng artwork nito, at kung gaano kalakas ang pagre-recolor ng palette mo sa mga ito (**Off**, **Subtle**, **Strong**, **Full**, **Mono** o **Duotone**). Pinapanatili ng **Keep skin tones and flags** ang mga iyon sa sarili nilang kulay. Ang gawa mo na ay nag-iingat ng set na ginamit dito.
- <!--i:eyeoff--> **Accessibility** - apat na comfort switch, kasama ang Sound at Neurospicy Mode. Tingnan ang [Accessibility](#accessibility).
- <!--i:link--> **Connected services** - storage na ikinokonekta mo, tulad ng Dropbox, Google Drive, OneDrive, Nextcloud o S3, at **Sync across devices**. Tingnan ang [Sync your devices](/info/sync.html).
- <!--i:globe--> **Trusted sites** - ang mga site na maaaring kontakin ng Design web-page box o Sandbox demo nang hindi nagtatanong, at, kung inaalok ng server, **Allow pages from any site**. Inililista ng [Privacy Policy](/info/privacy.html) kung ano ang ipinapadala ng bawat request.
- <!--i:download--> **Your renders** - ang **Save my renders to my library** ay nag-iingat ng kopya ng bawat larawan, audio clip at video na dina-download mo sa Assets, sa ilalim ng Renders tag.
- <!--i:database--> **Storage** - kung ano ang iniingatan ng Lolly sa device na ito, at ang mga button na nagki-clear o nagdadala ng data mo. Tingnan ang [Storage](#storage).
- <!--i:cpu--> **Available offline** - i-download ang kailangan mo bago ka mawalan ng koneksyon. Tingnan ang [Available offline](#available-offline).
- <!--i:folder--> **Hot folder** - sa desktop app, magbantay ng isang folder at hilahin sa Lolly ang anumang inihulog dito, sa parehong chooser na nakukuha ng drag-and-drop.
- <!--i:clock--> **Your activity** - ang nagawa mo sa device na ito, binibilang nang lokal.
- <!--i:sliders--> **Feature flags** - i-on o i-off ang mga bahagi ng app, tulad ng **Print preflight** o **Strip metadata from uploads**.
- <!--i:server--> **Lolly instance** - kung saan kumukuha ang install na ito ng mga tool at catalogue. Tingnan ang [Lolly instance](#lolly-instance).

Ang mga theme card ay live na preview at agad na umiiral kapag pumili ka ng isa, sa device na ito lang.

![Tatlong theme card, bawat isa ay nagpe-preview ng sariling type at kulay, na may naka-flag na aktibo](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Accessibility

Ang **Settings → Preferences → Accessibility** ay may apat na comfort setting para sa app sa paligid ng gawa mo. Naka-off ang bawat isa hanggang i-on mo, at wala sa mga ito ang umaabot sa loob ng tool canvas o export, kaya ang mas kalmadong app ay hindi kailanman gumagalaw ng isang pixel ng file na ipinapadala mo.

- <!--i:pause--> Ino-off ng **Reduce motion** ang mga transition, slide at palamuti ng app. Ang canvas mo at anumang animated na export ay patuloy na gumagalaw ayon sa disenyo.
- <!--i:photos--> Pinapalitan ng **Hide colourful previews** ang preview artwork ng gallery ng kalmadong icon-and-text na card, at pinapahina ang mga project thumbnail para manatiling nakikilala nang hindi sumisigaw.
- <!--i:sliders--> Pinalalakas ng **High contrast** ang mga border, text at focus ring ng app. Nananatili ang mga brand colour at ang canvas ayon sa itinakda mo.
- <!--i:font--> Pinalalaki ng **Large text** ang mga label, menu at text ng button ng app. Hindi ginagalaw ang type sa loob ng mga design mo, kaya walang nagre-reflow sa ie-export mo.

Nasa profile mo ang mga setting na ito, kaya sumasama ang mga ito sa profile export at dumarating sa susunod na install kasama ang pangalan at mga session mo. Isang maliit na device-only na kopya ang naglalapat sa mga ito bago ang unang paint.

Hawak din ng parehong card ang **Sound**, isang banayad na patong ng assistive na tunog para sa ginagawa mo (pagdating sa gallery, resulta ng Content Credentials, pagsasara ng panel), at **Neurospicy Mode**, isang kalmadong focus track. Ang pag-on ng Neurospicy ay nagbubukas ng maliit na player sa sulok na sumusunod sa iyo sa buong app. Doon ka pumipili ng track, nagla-laktaw, nagtatakda ng volume at nagpapaliit o nagsasara ng player. Kasama sa mga track ang procedural na *Lolly Sings* na tugtugin, ambient loop at beat, sarili mong audio at internet radio station, na nangangailangan ng koneksyon. Parehong naka-off bilang default at naaalala, at ang pag-off ng Sound ay nagmu-mute rin sa focus track. Dala ng profile menu at **This device** ang parehong switch.

Maaaring i-navigate ang interface gamit ang keyboard, may label ang mga custom na kontrol para sa screen reader at ang live preview ng bawat tool ay inilalantad bilang iisang may-label na larawan na naglalarawan ng ipinapakita.

### Storage

Binibilang ng storage meter ang bawat byte na hawak ng install na ito, kategorya por kategorya, laban sa iniuulat ng browser.

![Ang storage meter, na naghihiwalay ng mga naka-save na session, larawan at cache laban sa talagang iniuulat ng browser](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Sa ilalim ng meter:

- Ang **Move to another device** ay may **Export my data**, **Import data…** at **Export my data & render everything**. Ginagabayan ka ng [Ilipat ang gawa mo sa ibang device](/info/find-your-work.html#move-your-work-to-another-device) sa mga ito.
- Ang **Clear cache** ay nag-aalis ng mga na-download na catalogue file, na dina-download muli kapag kailangan.
- Ang **Remove automatic checkpoints older than 30 days** ay nagpapalaya ng espasyo ng History at iniingatan ang mga naka-save at pinangalanang bersyon.
- Inaalis ng **Clear all my data** ang lahat ng iniingatan ng Lolly sa browser na ito, pagkatapos mong mag-type ng salita para kumpirmahin. Inililista ng [Kung i-clear mo ang browser data mo](/info/find-your-work.html#if-you-clear-your-browser-data) kung ano ang nawawala.

### Available offline

Nagka-cache ang Lolly ng mga screen habang binibisita mo ang mga ito, na sumasaklaw lang sa kung saan ka na nakapunta. Ang **Available offline** ay para sa biyaheng nakikita mo nang darating: i-download ang mga bahaging kakailanganin mo at manood ng isang progress bar, at patuloy na gagana ang lahat ng kinuha mo kahit walang koneksyon.

- <!--i:monitor--> **App, catalogue at mga gabay** - **The app** (bawat view, editor at font, kasama ang mga screen na hindi mo pa nabubuksan), ang **Catalogue** (lahat, o **Choose by tag**) at **Guides & docs** (ang dokumentasyong ito sa wika mo, kasama ang mga screenshot).
- <!--i:cpu--> **Mga AI model** - bawat on-device model sa sarili nitong row kasama ang laki nito: Speech voices, Upscaling models, Background removal, Text recognition, Verify deep scan, Durable credential, Rewriter model, Ask matching model, AI text detector at Singing voices. Ang model na higit sa 50 MB ay minamarkahang **large download**.
- <!--i:wrench--> **Mga tool** - bawat tool ay dina-download nang mag-isa, o kinukuha ng **Download all** ang bawat tool. Ang tsek ay nangangahulugang handa na offline.

Ang **Download everything** sa itaas ay kinukuha ang app, ang catalogue scope na pinili mo, ang mga gabay at lahat ng tool. I-tsek ang **Include all the AI models** para idagdag ang mga model, o mag-download ng model sa sarili nitong row; ang mga singing voice ay dina-download lang mula sa sarili nilang row. Ang policy ng organisasyon ay puwedeng i-off ang mga AI download, at sasabihin ito ng mga row.

Ipinagpapatuloy ng mga download kung saan sila huminto kung kanselahin mo o mawalan ng koneksyon, at nire-refresh ang sarili kapag online ka ulit, kinukuha lang ang binago ng release. Kung hindi nagbigay ng persistent storage ang browser, hinihingi ito ng **Protect downloads**: ang pagkakaiba ng "na-download" at "na-download hanggang kunin ng browser ang espasyo pabalik".

### Lolly instance

Sinasabi ng **Lolly instance** kung saan kumukuha ang install na ito ng mga tool at catalogue: address ng instance, o *Bundled with this app* kapag lahat ay kasama sa build.

- Ipinapakita ng **Design-system source** kung saan galing ang ibinigay na design system.
- Binubuksan ng **Instance console** ang mga admin page ng deployment, kung iniaalok ng mga ito.
- Itinuturo ng **Change** ang desktop app sa ibang instance. Hindi makakapag-load ang browser ng mga tool at asset sa magkakaibang origin, kaya sa web, nag-aalok ang seksyon ng **Open a workspace** sa halip.
- Inaalis ng **Leave** ang design system, mga tool at catalogue ng instance, at nananatili ang sarili mong gawa. Tingnan ang [Gamitin ang Lolly sa organisasyon mo](/info/organisation.html#leaving).
- Kapag naka-sign in ka sa organisasyon, tinatapos ng **Sign out** ang session na ito at tinatapos ng **Sign out everywhere** ang mga session mo sa bawat device, kasama ang isang ito.

## This device

- <!--i:monitor--> **This Machine** - screen, input, graphics, memory, codec, storage backend at iba pa, binabasa nang live mula sa session na ito. Walang iniimbak at walang ipinapadala. Kusa itong bumubukas sa malapad na screen, kung saan inilalatag ang tab sa dalawang column.
- <!--i:neurobeat--> **Sound** - ang mga tunog ng interface at ang mga Neurospicy focus loop, ang nag-iisang switch sa tab na ito na nagsusulat ng anuman.
- <!--i:database--> **Storage** - read-only na view ng meter sa [Preferences](#storage), kung saan mo nililinis o dinadala ang data mo.

## Design system

Ang aktibong design system, inilatag para mabasa. Kapag may dalawa o higit pang design system ang browser na ito, nililista ng strip ng maliliit na cover sa itaas ang mga ito: pumili ng isa para gawin itong aktibo, at ibinabalik ng **Undo** sa notice na kasunod ang nauna.

![Ang Design system tab sa Lolly Demo: strip ng mga cover para lumipat ng system, saka ang cover na may logo, pangalan, tala at mga bilang na nagbubukas ng bawat page](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

Bumubukas ang tab sa cover na pininturahan sa sariling mga kulay ng system, kasama ang logo nito, ang pangalan nito sa display face nito at ang tala na isinulat ng may-akda nito. Ang linya ng mga bilang sa cover ay nagli-link sa bawat page:

- <!--i:palette--> **Colour** - ang surface, text, primary at secondary ng light at dark na itsura, bawat pinangalanang kulay bilang chip na may pangalan at hex nito, banda para sa bawat tint ramp at ang chart spectrum, at ang mga colour role sa isang tiklop. Pumili ng value para kopyahin ang hex.
- <!--i:font--> **Type** - Headings, Text, Emphasis at Code, bawat isa ay nakatakda sa sarili nitong face.
- <!--i:photos--> **Logos** - bawat logo file sa ground na ginawa para dito.
- <!--i:layers--> **Colourways** - ang light at dark na pares ng bawat colourway, kapag may higit sa isa ang system.
- <!--i:sliders--> **Tokens** - radius, spacing, mga epekto at gradient.
- <!--i:document--> **Print & CMYK** - ang mga kulay na naka-lock sa eksaktong ink, at ang mga press condition na maaaring ideklara ng CMYK PDF.

Ang paglipat lang ang binabago ng tab na ito. Ine-edit mo ang design system sa [Design System Setup](/info/brand-studio.html) sa `#/start`, na nilalagyan ng link ng cover. Sinasabi ito ng cover ng read-only na system; ang mga lokal na system na ginagawa mo ay nananatiling mae-edit. Ang `/b` at `/brand` ay mga shortlink diretso sa tab na ito.

## Capabilities

Ang bawat bahagi ng platform ay nakasulat bilang card, sa labindalawang grupo: Experiences, Platforms & runtimes, Accessibility & languages, Export formats, Import formats, Print production, Automation & AI, Determinism & reproducibility, Brand & design system, Privacy & data ownership, Security & access control at Architecture (for builders). Tumitiklop ang bawat grupo at ipinapakita ang bilang ng card nito. Ang card ay bumubukas sa dialog na may mga feature ng capability na iyon at, para sa halos kalahati, ang screenshot na ginagamit ng dokumentasyong ito.

Pinapasala ng search field sa itaas ng mga grupo ang mga card habang nagta-type ka at binubuksan ang alinmang grupo na may natitirang tugma. Sinasabi nito kung ilang capability ang hinahanap nito, at ang query na walang tugma ay nagsasabi nito sa mga salita.

Ang tab na ito ay nakasulat na dokumentasyon ng kaya ng Lolly, na sinasabayan sa mga gabay na ito. Hindi nito sinusuri ang makinang gamit mo; ang **This device** ang gumagawa niyon.

## Activity & stats

Ang build muna: ilang tool ang na-load, ilang export format ang umiiral, ilang surface ang pinapatakbuhan ng platform at ilang brand asset ang dala ng catalogue, na may **Catalogue** panel na naghihiwalay kung ano ang kasama sa build na ito.

Pagkatapos ang sarili mong panig: binibilang ng **Your activity** ang nagawa mo sa device na ito, at ang **Recent creations** at **Latest exports** ay mga stack na maaari mong i-swipe, bawat isa ay lumilitaw kapag may maipapakita. Parehong nagbubukas ng item gaya ng dati. Nananatili sa device ang mga counter na ito; ang opsyonal na Lolly Work instance ay may sarili nitong [organisation telemetry at audit record](/info/privacy.html#organisation-services-with-lolly-work).

## Mga deep link

Ang bawat tab at seksyon ng Settings ay may sariling link, na puwede mong i-bookmark o i-paste. Itinuturo ng [Search](/info/search.html) ang mga resulta nitong **Settings** sa parehong registry na pinagmumulan ng pag-render ng Settings, kaya hindi mapapalitan ang pangalan ng seksyon sa ilalim ng resulta ng search.

::: details Bawat anyo ng link

- **Isang tab:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **Isang seksyon ng Preferences:** `#/settings?focus=<section-id>`, tulad ng `#/settings?focus=offline-section`.
- **Isang seksyon, eksakto:** ang id nito bilang hubad na flag, tulad ng `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` o `#/settings?cap-formats`. Ang mga mas lumang link na `#/settings?dash-lock` at `#/settings?dash-palette-wheel` ay nagbubukas sa cover at sa Colour page.
- **Isang seksyon ayon sa keyword:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (ang Colour page) o `#/settings?tokens`. Maaaring pinagsasaluhan ang mga keyword: ang `print` ay kabilang sa print reference ng brand tab at sa Print production group, at ang una sa pagkakasunod ng page ang nananalo. Gamitin ang id kapag mahalaga kung alin.

Ang deep link ay lumilipat sa tab na may-ari ng target, binubuksan ang anumang grupong kinatitiklop nito, saka nag-i-scroll dito, at nananatili saglit habang tinatapos ng mga seksyon sa itaas ang paglalatag. Ang mga inalis nang address na `#/platform` at `#/capabilities` ay tumitiklop sa Settings nang buo ang mga deep-link flag nila.
:::

---

**Kaugnay:** [Mga profile](/info/profile.html) para sa mga detalye mo at mga kontekstong ginagawan mo. [Design System Setup](/info/brand-studio.html) para sa pag-edit ng ipinapakita ng Design system tab. [Hanapin at bawiin ang gawa mo](/info/find-your-work.html) para sa storage, backup at paglipat ng device.
