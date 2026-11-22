# Settings

Nasa Settings ang mga detalye mo, design system mo, accessibility, storage sa device na ito at mga offline download. Buksan ang **Settings** mula sa bar sa ibaba ng home screen o sa avatar menu mo, at bubukas ito sa **Preferences**.

| Tab | Address | Laman nito |
|---|---|---|
| **Preferences** | `#/settings` | Mga detalye mo, design system, itsura, emoji, accessibility, koneksyon, storage at mga offline download |
| **This device** | `#/settings?tab=device` | Live na impormasyon tungkol sa browser at makinang ito, kasama ang sound at read-only na view ng storage |
| **Design system** | `#/settings?tab=brand` | Ang aktibong design system bilang pabalat at mga page, na may hanay ng mga pabalat para magpalit ng system |
| **Capabilities** | `#/settings?tab=caps` | Lahat ng kayang gawin ng Lolly, bilang mga card na puwedeng hanapin |
| **Activity & stats** | `#/settings?tab=activity` | Ang catalog, mga lokal mong counter at kamakailang gawa |

Binubuksan pa rin ng mga lumang `#/profile` at `#/d` link ang tamang lugar, hanggang sa mga indibidwal na setting.

<!--i:eti-sliders-->
## Preferences

Isang mahabang page ang Preferences na may **settings rail** sa gilid. Fini-filter ng **Search settings** field sa itaas ng rail ang rail habang nagta-type ka. May link ang bawat seksyon na nasa anyong `#/settings?focus=<section-id>`, tulad ng `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - ang pangalan, mga contact detail at headshot mo, at ang **Use my details to create** switch. Ipinapaliwanag ng [Mga profile](/info/profile.html) kung paano ginagamit ng mga tool ang mga ito.
- <!--i:seal--> **Content Credentials** - ang opsyonal na na-verify na pagkakakilanlan na lumalagda sa mga export mo. Tingnan ang [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - magpalit, magdagdag, magtago o mag-alis ng mga design system. Sinasaklaw ng [Lolly Design System Setup](/info/brand-studio.html#manage-your-design-systems) ang bawat aksyon.
- <!--i:moon--> **Appearance** - ang theme (Light, Dark o Brand, na nagkukulay sa app gamit ang palette mo), **Your colourway** kapag nag-aalok ang design system ng higit sa isa ([Gawing sarili mo ang isang colourway](/info/colourways.html#make-a-colourway-your-own)) at **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - ang emoji set para sa bagong gawa, kasama ang lisensya ng artwork nito, at kung gaano kalakas binabago ng palette mo ang kulay ng emoji (**Off**, **Subtle**, **Strong**, **Full**, **Mono** o **Duotone**). Pinananatili ng **Keep skin tones and flags** ang sariling mga kulay ng mga iyon. Pinananatili ng nagawa mo na ang set nito.
- <!--i:eyeoff--> **Accessibility** - apat na switch para sa ginhawa, kasama ang Sound at Neurospicy Mode. Tingnan ang [Accessibility](#accessibility).
- <!--i:link--> **Connected services** - storage na ikinokonekta mo, tulad ng Dropbox, Google Drive, OneDrive, Nextcloud o S3, at **Sync across devices**. Tingnan ang [I-sync ang mga device mo](/info/sync.html).
- <!--i:globe--> **Trusted sites** - ang mga site na puwedeng kontakin ng web-page box ng Lolly Design o demo ng Lolly Sandbox nang hindi nagtatanong, at, kung inaalok ng server, **Allow pages from any site**. Inililista ng [Patakaran sa Privacy](/info/privacy.html) kung ano ang ipinapadala ng bawat request.
- <!--i:download--> **Your renders** - nagtatago ang **Save my renders to my library** sa Assets, sa ilalim ng Renders tag, ng kopya ng bawat larawan, audio clip at video na dina-download mo.
- <!--i:database--> **Storage** - kung ano ang itinatago ng Lolly sa device na ito, at ang mga button na naglilinis o naglilipat ng data mo. Tingnan ang [Storage](#storage).
- <!--i:cpu--> **Available offline** - i-download ang kailangan mo bago mawalan ng koneksyon. Tingnan ang [Available offline](#available-offline).
- <!--i:folder--> **Hot folder** - sa desktop app, binabantayan ng Lolly ang isang folder at ipinapasok ang anumang inilagay roon, gamit ang parehong chooser ng drag and drop.
- <!--i:clock--> **Your activity** - kung ano ang nagawa mo sa device na ito, na lokal na binibilang.
- <!--i:sliders--> **Feature flags** - i-on o i-off ang mga bahagi ng app, tulad ng **Print preflight** o **Strip metadata from uploads**. Binibigyan ng **Performance UI** ang app ng mas simpleng itsura na mas magaan iguhit. Puwedeng kusang i-on ng Lolly ang Performance UI sa mabagal na device. Sinasabi ng linya sa ilalim ng switch kung kailan at bakit, kasama ang **Allow again** ([kung paano ito nagpapasya](/info/configuration.html#curating-what-people-see)).
- <!--i:server--> **Lolly instance** - kung saan kinukuha ng install na ito ang mga tool at catalog nito. Tingnan ang [Lolly instance](#lolly-instance).

Mga live preview ang mga theme card. Inilalapat ang theme sa sandaling pumili ka, sa device na ito lang.

![Tatlong theme card, bawat isa ay nagpapakita ng preview ng sarili nitong type at kulay, na may marka ang aktibo](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Accessibility

Hawak ng **Settings → Preferences → Accessibility** ang apat na setting para sa ginhawa sa app. Naka-off ang bawat isa hanggang i-on mo, at walang nakakaabot sa loob ng canvas ng tool o export, kaya hindi kailanman gagalaw ang isang pixel ng file na ihahatid mo dahil sa mas kalmadong app. Naka-off ang bawat isa bilang default. Wala sa mga ito ang nagbabago ng canvas ng tool o export.

- <!--i:pause--> Ino-off ng **Reduce motion** ang mga transition, slide at dekoratibong galaw ng app.
- <!--i:photos--> Pinapalitan ng **Hide colourful previews** ang preview artwork ng gallery ng mga card na may icon at text at pinapahinahon ang mga thumbnail ng proyekto, na nananatiling nakikilala.
- <!--i:sliders--> Pinapalakas ng **High contrast** ang mga border, text at focus ring ng app. Nananatili ang mga kulay ng brand mo at ang canvas ayon sa itinakda mo.
- <!--i:font--> Pinalalaki ng **Large text** ang mga label, menu at text ng button sa app.

Itinatakda ng **Dominant hand** (Right o Left) kung saang panig ang mga kontrol kapag nagpapakita ang Lolly ng dalawang pane, sa foldable o halos parisukat na tablet. Binabago rin ito ng **Swap sides** sa header ng pane.

Nasa profile mo ang mga setting na ito, kaya sumasama ang mga ito sa profile export kasama ang pangalan at mga session mo. Inilalapat ang mga ito ng kopyang para lang sa device bago ang unang pagguhit sa screen.

May **Sound** din ang parehong card, mahihinang tunog na tumutulong sa mga aksyon tulad ng pagdating sa gallery, resulta ng Content Credentials o pagsasara ng panel. May **Neurospicy Mode** din ito, isang kalmadong track para sa pagtuon. Kapag in-on ang Neurospicy, bumubukas ang maliit na player sa sulok na kasama mo saanman sa app. Sa player, pumipili ka ng track, lumalaktaw, nagtatakda ng volume at nagmi-minimise o nagsasara ng player. Kasama sa mga track ang mga generated station ng Lolly, ambient loop at beat, sarili mong audio at mga internet radio station, na kailangan ng koneksyon. Parehong naka-off bilang default at natatandaan ang pagpili. Minu-mute din ng pag-off ng Sound ang track para sa pagtuon. May parehong switch sa profile menu at **This device**.

Itinatakda ng slider sa ilalim ng Sound switch kung anong tunog ang ginagamit. Patungo sa bilog na **Bouba**, nagiging banayad na patak, bula at kaunting bass ang mga ito. Patungo sa matulis na bituin na **Kiki**, nagiging tuyong tik, kalmot at tunog ng metal ang mga ito. Pinananatili sa gitna ang mga chime at nota ng Lolly. Kung mahirap mong tiisin ang mga tunog sa isang dulo, lumipat patungo sa kabila. Gumagana ang slider habang naka-off ang Sound, at nagpapatugtog ng maikling sample ang pagbitaw sa slider.

::: details Ang mga generated station
Binubuo ng mga generated station ang musika nila habang tumutugtog, na walang sample at walang naka-record na boses. May sariling mga instrumento, groove at pagkakasunod-sunod ang bawat tugtugin.

- Isang pamilya ng mga station ang **Lolly Sings**. Masigla at malamyos ang orihinal na Lolly Sings: mga major key, lead sa bawat tugtugin at mga himig ng bossa, shuffle at chiptune. May sarili ring station ang bawat genre, mula Sugar at K-pop hanggang Country, Jazz, Metal at D&B.
- Walang katapusang lo-fi beat ang **Lofi stations** (Warm, Late night at Rainy).

Sa generated station, lumilipat sa mga tugtugin ang next at previous. Mula sa seed ang bawat tugtugin, kaya pareho itong tumutugtog saan mo man ibahagi o i-save (tingnan ang [Binuong musika](/info/generated-music.html)). Sa ilalim ng mga kontrol sa playback, nagpapalit ang **Mood** sa mga Lofi station, inaalis ng **Drums** ang drum kit at mula sa malinis na tunog hanggang sa tunog ng maalikabok na plaka ang **Texture**. Kasunod ang isang hanay ng mga icon button. I-hover o pindutin nang matagal ang button para makita ang pangalan nito:

- Ang nota ng musika, **Open in the music generator**, ay nagbubukas ng tugtugin sa `#/music`, kung saan puwede mong baguhin ang mga instrumento nito bawat seksyon.
- Ang link, **Share this tune or moment**, ay nag-aalok ng link na nagpapatugtog ng parehong tugtugin, o link na nagsisimula rin kung nasaan ka at nagpapakita ng visualiser gamit ang kasalukuyan mong preset at mga kulay.
- Ang folder, **Save to library**, ay nagtatago ng tugtugin sa mga asset mo.
- Ang kidlat, **Light visualiser**, ay isang switch, na inilalarawan sa ibaba.

Nakalista ang naka-save na tugtugin sa grupo ng station nito, ayon sa key at tempo. Pinapatugtog muli ng pagpili sa naka-save na tugtugin ang parehong tugtugin, na umuulit tulad ng anumang track o nagpapatuloy sa forward mode. Station at numero lang ng tugtugin ang iniimbak nito, ilang byte, at muling binubuo ang musika habang tumutugtog. Puwede mong palitan ang pangalan o burahin ang naka-save na tugtugin sa mga asset mo, at gamitin ito bilang background music ng video. May tig-anim na naka-save na tugtugin ang Lolly Demo at Lolly Start.

Naririnig ng visualiser ang bawat track sa pare-parehong antas, kaya kapareho ng malakas na track ang paggalaw ng larawan sa mahinang track, sa anumang volume. Nag-aalok ang bawat genre ng Lolly Sings, at ang naka-save na tugtugin mula rito, ng **Light visualiser**: mga simpleng level bar na nag-iiwan sa musika ng oras sa pagproseso na kailangan nito. Nagsisimulang naka-on ang Light visualiser para sa mga touch screen at device na may apat na core o mas kaunti o 4 GB ng memory o mas kaunti.
:::

Puwede mong gamitin ang interface sa keyboard. May mga label para sa screen reader ang mga custom na kontrol. Ang live preview ng bawat tool ay isang larawang may label na naglalarawan sa ipinapakita nito.

### Storage

Ipinapakita ng storage meter ang bawat byte na hawak ng install na ito, ayon sa kategorya, kumpara sa iniuulat ng browser.

![Ang storage meter, na naghahati sa mga naka-save na session, larawan at cache kumpara sa aktuwal na iniuulat ng browser](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Sa ilalim ng meter:

- May **Export my data**, **Import data…** at **Export my data & render everything** ang **Move to another device**. Dinadaanan ng [Ilipat ang gawa mo sa ibang device](/info/find-your-work.html#move-your-work-to-another-device) ang mga ito.
- Inaalis ng **Clear cache** ang mga na-download na catalog file, na muling dina-download kapag kailangan.
- Nagpapalaya ng espasyo sa History ang **Remove automatic checkpoints older than 30 days** at pinananatili ang mga naka-save at pinangalanang bersyon.
- Inaalis ng **Clear all my data** ang lahat ng itinatago ng Lolly sa browser na ito, pagkatapos mong mag-type ng salita para kumpirmahin. Inililista ng [Kung lilinisin mo ang data ng browser mo](/info/find-your-work.html#if-you-clear-your-browser-data) kung ano ang mawawala.

### Available offline

Kina-cache lang ng Lolly ang mga screen na napuntahan mo. Dina-download ng **Available offline** ang mga bahaging kakailanganin mo, na may iisang progress bar, at patuloy na gumagana ang mga ito nang walang koneksyon.

- <!--i:monitor--> **App, catalogue and guides** - **The app** (bawat view, editor at font, pati mga screen na hindi mo pa nabubuksan), ang **Catalogue** (lahat nito, o **Choose by tag**) at **Guides & docs** (ang dokumentasyong ito sa wika mo, kasama ang mga screenshot).
- <!--i:cpu--> **AI models** - bawat model na tumatakbo sa device ay may sariling row at nakasaad na laki: Speech voices, Upscaling models, Background removal, Text recognition, Lolly Verify deep scan, Durable credential, Rewriter model, Ask matching model, AI text detector at Singing voices. Ang model na lampas 50 MB ay may markang **large download**.
- <!--i:wrench--> **Tools** - hiwalay na nada-download ang bawat tool, o kinukuha ng **Download all** ang lahat ng tool. Ang tsek ay nangangahulugang handa nang gamitin offline.

**Download everything** sa itaas ang kumukuha ng app, ang saklaw ng catalogue na pinili mo, ang mga gabay at lahat ng tool. Lagyan ng tsek ang **Include all the AI models** para idagdag ang mga model, o mag-download ng model mula sa sarili nitong row. Sa sarili lang nilang row nada-download ang mga singing voice. Puwedeng i-off ng policy ng organisasyon ang pag-download ng AI, at ipinapakita iyon ng mga row.

Nagpapatuloy ang mga download kung saan huminto ang mga ito kapag kinansela mo o nawala ang koneksyon. Kapag online na ulit, nagre-refresh ang mga ito at kinukuha lang ang binago ng isang release. Kung hindi pa pinayagan ng browser ang persistent storage, hinihingi ng **Protect downloads** ang pahintulot na iyon. Kung walang pahintulot, puwedeng burahin ng browser ang mga download kapag kailangan nitong bawiin ang espasyo.

### Lolly instance

**Lolly instance** ang nagsasabi kung saan kinukuha ng install na ito ang mga tool at catalogue nito: address ng isang instance, o *Bundled with this app* kapag kasama na ang lahat sa build.

- Ipinapakita ng **Design-system source** kung saan nanggagaling ang kasamang design system.
- Binubuksan ng **Instance console** ang mga admin page ng deployment, kung may iniaalok ito.
- Itinuturo ng **Change** ang desktop app sa ibang instance. Hindi makapag-load ang browser ng mga tool at asset mula sa ibang origin, kaya sa web, **Open a workspace** ang iniaalok ng seksyon.
- Inaalis ng **Leave** ang design system, mga tool at catalogue ng instance. Nananatili ang sarili mong gawa. Tingnan ang [Gamitin ang Lolly sa organisasyon mo](/info/organisation.html#leaving).
- Kapag naka-sign in ka sa isang organisasyon, tinatapos ng **Sign out** ang session na ito at tinatapos ng **Sign out everywhere** ang mga session mo sa bawat device, kasama ito.

<!--i:eti-monitor-->
## Ang device na ito

- <!--i:monitor--> **This Machine** - screen, input, graphics, memory, mga codec, storage backend at iba pa, na binabasa nang live mula sa session na ito. Walang iniimbak o ipinapadala. Sa malawak na screen, kusang bumubukas ang panel na ito at gumagamit ng dalawang column ang tab.
- <!--i:neurobeat--> **Sound** - mga tunog ng interface at Neurospicy focus loop. Sound lang ang switch sa tab na ito na may isinusulat.
- <!--i:database--> **Storage** - read-only na view ng meter. Burahin o dalhin ang data mo sa [Preferences](#storage).

<!--i:eti-palette-->
## Design system

Ang aktibong design system, na nakaayos para basahin. Kapag may dalawa o higit pang design system ang browser na ito, inililista ang mga ito sa isang hanay ng mga cover sa itaas. Pumili ng isa para gawin itong aktibo. Ibinabalik ng **Undo** sa kasunod na abiso ang nauna.

![Ang Design system tab sa Lolly Demo: isang hanay ng mga cover para magpalit ng system, saka ang cover na may logo, pangalan, tala at mga bilang na nagbubukas ng bawat page](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

Bumubukas ang tab sa cover na may sariling mga kulay ng system, kasama ang logo nito, pangalan sa display face nito at talang isinulat ng may-akda nito. Naka-link sa bawat page ang isang linya ng mga bilang sa cover:

- <!--i:palette--> **Colour** - ang surface, text, primary at secondary ng light at dark na itsura, bawat pinangalanang kulay bilang chip na may pangalan at hex nito, isang band para sa bawat tint ramp at chart spectrum, at ang mga role ng kulay sa isang nakatiklop na seksyon. Pumili ng value para kopyahin ang hex.
- <!--i:font--> **Type** - Headings, Text, Emphasis at Code, bawat isa ay nakatakda sa sarili nitong face.
- <!--i:photos--> **Logos** - bawat logo file sa background na ginawan nito.
- <!--i:layers--> **Colourways** - ang light at dark na pares ng bawat colourway, kapag higit sa isa ang nasa system.
- <!--i:sliders--> **Tokens** - radius, spacing, mga epekto at gradient.
- <!--i:document--> **Print & CMYK** - mga kulay na nakapirmi sa eksaktong tinta at mga kondisyon ng press na puwedeng ideklara ng CMYK PDF.

Pagpapalit lang ang pagbabagong ginagawa ng tab na ito. Mag-edit ng design system sa [Lolly Design System Setup](/info/brand-studio.html) sa `#/start`, na naka-link mula sa cover. Sinasabi sa cover kung read-only ang system. Nananatiling mae-edit ang mga lokal na system na ginawa mo. Ang `/b` at `/brand` ay mga shortlink sa tab na ito.

<!--i:eti-grid-->
## Mga kakayahan

May card ang bawat bahagi ng platform, sa labindalawang grupo: Experiences, Platforms & runtimes, Accessibility & languages, Export formats, Import formats, Print production, Automation & AI, Determinism & reproducibility, Brand & design system, Privacy & data ownership, Security & access control at Architecture (for builders). Naititiklop ang bawat grupo at ipinapakita ang bilang ng mga card nito. Nagbubukas ang isang card ng dialog na may mga feature ng kakayahang iyon at, para sa halos kalahati ng mga card, ang screenshot na ginagamit ng dokumentasyong ito.

Sinasala ng search field sa itaas ng mga grupo ang mga card habang nagta-type ka at binubuksan ang mga grupong may tugma. Ipinapakita ng field kung ilang kakayahan ang hinahanap nito. Kapag walang tugma ang query, sinasabi ito sa text.

Itinatala ng tab na ito kung ano ang kayang gawin ng Lolly, kasabay ng mga gabay na ito. Hindi nito sinusuri ang makinang ginagamit mo; **This device** ang gumagawa niyon.

<!--i:eti-gauge-->
## Aktibidad & istatistika

Una ang build: ang bilang ng mga tool na na-load, mga export format, mga platform na pinapatakbuhan nito at mga brand asset sa catalogue. Dinidetalye ng **Catalogue** panel ang kasama sa build na ito.

Kasunod ang sarili mong gawa: binibilang ng **Your activity** ang mga nagawa mo sa device na ito. Ang **Recent creations** at **Latest exports** ay mga stack na puwede mong i-swipe, na ipinapakita kapag may laman na. Pareho nilang binubuksan ang item sa dati nitong kalagayan. Nananatili sa device ang mga bilang na ito. Nag-iingat ang opsyonal na Lolly Work instance ng sarili nitong [telemetry at mga audit record ng organisasyon](/info/privacy.html#organisation-services-with-lolly-work).

<!--i:eti-link-->
## Mga deep link

May sariling link ang bawat tab at seksyon ng Settings na puwedeng i-bookmark o i-paste. Binubuo ng [Lolly Search](/info/search.html) ang mga resulta nitong **Settings** mula sa parehong registry na ginagamit ng Settings, kaya hindi kailanman nasisira ang resulta ng paghahanap kapag pinalitan ang pangalan ng seksyon.

::: details Bawat anyo ng link

- **Isang tab:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **Isang seksyon ng Preferences:** `#/settings?focus=<section-id>`, tulad ng `#/settings?focus=offline-section`.
- **Isang eksaktong seksyon:** ang id nito bilang flag lang, tulad ng `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` o `#/settings?cap-formats`. Binubuksan ng mas lumang mga link na `#/settings?dash-lock` at `#/settings?dash-palette-wheel` ang cover at Colour page.
- **Isang seksyon ayon sa keyword:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (ang Colour page) o `#/settings?tokens`. Puwedeng magkapareho ng keyword ang dalawang seksyon: kabilang ang `print` sa print reference ng brand tab at sa Print production group, at nauuna ang unang nasa pagkakasunod ng page. Gamitin ang id para pumili ng isa.

Lumilipat ang deep link sa tab na may target at binubuksan ang anumang grupong kinalalagyan ng nakatiklop na target. Pagkatapos, nag-i-scroll ito papunta sa target kapag tapos nang ma-layout ang mga seksyon sa itaas. Bumubukas sa Settings ang mga retiradong address na `#/platform` at `#/capabilities` na buo pa rin ang mga deep-link flag ng mga ito.
:::

---

**Kaugnay:** [Mga profile](/info/profile.html) para sa mga detalye mo at sa mga kontekstong ginagamit mo sa paggawa. [Lolly Design System Setup](/info/brand-studio.html) para i-edit ang ipinapakita ng Design system tab. [Hanapin at bawiin ang gawa mo](/info/find-your-work.html) para sa storage, mga backup at paglipat ng device.
