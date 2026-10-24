# Mga tanong at sagot

Mga madalas itanong, nire-render bilang accordion sa `/info/start/faq.html`.

**Paano i-maintain:** bawat `##` heading sa ibaba ay isang tanong; lahat ng nasa ilalim nito
(hanggang sa susunod na `##`) ang sagot. Gumagamit ang mga sagot ng parehong magaan na markdown tulad ng iba pang bahagi ng site
- paghiwalayin ang mga talata gamit ang blangkong linya. Magdagdag, mag-alis o
mag-ayos ng mga tanong dito at patakbuhin ulit ang `pnpm run build:info` (o `pnpm run dev:web`).
Ang lahat ng nasa itaas ng unang `##` (ang pamagat na ito at ang mga notang ito) ay hindi pinapansin ng build.

Ang pagkakasunod-sunod ay para sa unang beses na gumagamit: una ang catch, saka ang
mga file mo, saka ang pagkuha at pagpapatakbo ng Lolly, saka ang mga organisasyon, saka
kung paano ito ginawa. Ang anchor ng bawat tanong ay binubuo mula sa English na tanong
sa parehong posisyon, kaya pinapanatili ng pagsasalin ang English na pagkakasunod-sunod.

## Bakit libre ito? Ano ang kapalit?

**Ginawa namin ang Lolly para sa sarili namin.** Kailangan ng SUSE ang libu-libong on-brand na file, ginawa nang hindi nagbibigay ng anuman sa mga panlabas na serbisyo. Kaya gumawa kami ng tool na ginagawa ang lahat ng iyon sa device, at inilabas bilang open source, tulad ng lahat ng ginagawa namin. Patuloy namin itong pinapanatili dahil ginagamit namin ito araw-araw. **Walang obligasyon:** gumagana ang lahat ng narito, kasama man o wala kami.

Ang linyang iyon ay iginuhit sa lisensya, hindi sa pangako: ang anumang tumatakbo nang lokal ay libre, magpakailanman. Ang nailabas na bersyon ay nilisensyahan para hindi na ito mababawi, at walang contributor agreement na maaaring mag-relicense sa gawa ng sinuman.

## Gaano karami ang itinatago ng SUSE bilang pribado? (o kung kailan kami iiwan sa ere)

Open source ang engine, ang mga shell, ang mga schema at ang mga brand-agnostic na tool. Ang mga trademark at branded na tool ng SUSE ang bahaging nananatiling pribado, at hiwalay na ang mga ito. Ang pampublikong instance sa [lolly.tools](https://lolly.tools) ay nagpapatakbo ng [Lolly Demo](/info/lolly-demo.html), ang sariling design system ng Lolly.

Walang nakasalalay sa pangako rito: nananatiling open source ang bawat nailabas na bersyon, at ang trademark lang ang pinipigilan. Nang isara ng ibang kumpanya ang mga enterprise Linux source nito noong 2023, co-founder ang SUSE ng [OpenELA](https://openela.org) para panatilihing bukas ang code na iyon, ang parehong paninindigang minana ng proyektong ito.

Buong pagbubunyag: *gumagawa* ang SUSE ng internal na tooling para ikonekta ang Lolly sa sarili nitong IT system. Iyon ay internal na set-up ng SUSE, hindi paghahati sa pagitan ng pampubliko at pribadong development. Layunin din ng Lolly na buuin sa pamamagitan ng [Open Build Service](https://openbuildservice.org/), na may secure na supply-chain artifact na inihahatid ng [SUSE Application Collection](https://apps.rancher.io/applications).

## Bakit "Lolly Tools" ang pangalan?

**Lolly** dahil matamis ang kalayaan, at dahil sa Australia, New Zealand at Britain, kendi ang tawag na lolly.

**Tools** dahil nakatigil lang ang isang kasangkapan hangga't hindi mo ito dinadampot. Hindi ito tumatakbo kapag hindi mo ginagamit, at hindi ka nito binabantayan habang ginagamit mo.

## Bakit berde ang lahat?

Bumubukas ang lolly.tools sa [Lolly Demo](/info/lolly-demo.html), ang sariling sample na design system ng Lolly, at berde ang lead colour nito. Sample ito, hindi patakaran. Lumipat sa **Lolly Starter**, isang blangkong design system, o sa sarili mo sa [Settings → Design systems](/#/settings?focus=design-systems-section).

## Magagamit ko ba ang sarili kong brand?

Oo. Ang **Design System Setup** (`#/start`) ay bumubuo ng design system mula sa isang kulay, design tokens file o tapos na design, at ang bawat tool ay gumuguhit na gamit ang design system mo. Ginagabayan ka ng [Simulan](/info/quickstart.html#put-your-brand-in) sa tatlong ruta.

Ang design system na ibinibigay ng organisasyon o build mo ay managed: may lock ito at nananatiling read-only, at puwede kang gumawa ng mae-edit na kopya para baguhin.

## Nasaan ang ginawa ko kahapon?

Kung pinindot mo ang **Save as** o **Save**, nasa **Projects** ito, sa home screen, sa browser o app na pinag-save-an mo. Kung **Download** lang ang pinindot mo, ang file ay nasa kung saan nagse-save ng download ang browser o system mo, at kadalasan may kopya sa **Assets**. Ang mga tool na [nagse-save habang gumagawa ka](/info/find-your-work.html#which-tools-save-as-you-work) ay nag-iingat din ng hindi pa na-save na gawa sa **Projects**. Sinasaklaw ng [Hanapin at bawiin ang gawa mo](/info/find-your-work.html) ang bawat kaso.

## Isinara ko ang tab. Nawala na ba ang ginawa ko?

Nasa **Mga Project** pa rin ang na-save na gawa. Nawawala ang hindi na-save na gawa, maliban sa mga tool na nag-sa-save habang ginagawa mo, na iniingatan din ito sa **Mga Project**. Sa susunod, pindutin ang **I-save bilang** bago ka umalis. Tingnan ang [Kung isinara mo ang tab o umalis ka sa tool](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## Puwede ko bang ibahagi ang gawa ko bilang file sa halip na link?

Oo. Kapag hindi kayang dalhin ng link ang lahat, tulad ng sarili mong mga litrato o mahabang text, sinasabi ng Share dialog kung ano ang mawawala at nag-aalok ng **.lolly** file sa halip: isang file na may hawak ng design, ng mga larawang ginagamit nito at, kung piliin mo, ng tool mismo.

Ikaw ang nagpapasya kung gaano karami ang sasama. Ang pangalan at mga detalye mo ay isinasama lang kung pumayag ang profile mo, at ang may lisensyang art ay pinipigilan maliban kung piliin mong isama ang art. Ang sinumang magbubukas ng file na may dalang tool ay tatanungin kung pinagkakatiwalaan ang tool bago ito makapagpatakbo. Tingnan ang [Pagbabahagi ng gawa mo](/info/using.html#sharing-your-work).

## Ano ang ginagawa ng mga detalye ng profile ko?

Ang mga detalye mo sa **Settings** ay pre-fill sa mga tool na humihingi ng mga ito, tulad ng pangalan sa badge. Nananatili ang mga ito sa device na ito. Kung i-on mo rin ang opt-in, ang mga detalyeng pipiliin mo ay isi-seal sa ginagawa mo, na pinangalanan ka bilang pinagmulan. Walang isinasama maliban kung piliin mong isama ang mga detalye mo.

Ang Sharing at Sync ay nagpapadala lang ng nilalamang pinili mo. Sa Lolly Work instance ng isang organisasyon, ang mga shared session at governed na gawa ay napupunta rin sa server na iyon. Tingnan ang [Privacy](/info/privacy.html).

## Paano ko makukuha ang mobile o desktop apps?

I-download ang mga ito mula sa [Install Lolly](/info/install.html). Inililista ng page ang bawat build para sa macOS, Windows, Linux at Android, at ipinapakita kung paano i-check ang file na na-download mo. Ang iPhone at iPad ay kumukuha ng **Lolly Tools** mula sa App Store; nasa [seksyon ng iPhone at iPad](/info/install.html#iphone-and-ipad) ang link.

Maaari ring bumuo at mamahagi ang sinuman ng sarili nilang kopya ng app, na may mga tool at setting na kailangan ng audience nila. Ipinapakita ng [Build Guide](/info/build-guide.html) kung paano.

## Sabi ng Lolly kailangan nito ng WebGPU. Ano ang magagawa ko?

Gumuguhit ang web app gamit ang WebGPU, isang graphics feature ng mga kasalukuyang browser, at chine-check nito ito bago magbukas ng tool. Subukan ang mga ito ayon sa pagkakasunod:

1. I-update ang browser mo sa kasalukuyang bersyon nito.
2. I-on ang graphics o hardware acceleration sa mga setting ng browser, saka i-restart ang browser.
3. Subukan ang browser na nasubukan na: inililista ng [Supported environments](/info/supported-environments.html) ang mga iyon.
4. Sa Mac, iPhone o iPad, [i-install na lang ang app](/info/install.html).

## Kaya bang i-edit at i-render ng Lolly ang mga file kong Figma, Penpot, Illustrator o InDesign?

Oo. Buksan ang **Design** at i-click ang **Import a design**: tumatanggap ito ng native na Figma **.fig** (Save local copy), Penpot **.penpot** export, Illustrator **.ai** o **.pdf**, InDesign **.idml** (File → Export → InDesign Markup) o **anumang SVG**. Hindi mo kailangan ng account, plugin o lisensya ng design app.

![Ang bukas na canvas ng Design - nasa Lolly menu ng toolbar ang Import a design](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

Dumarating ang mga layer bilang mae-edit na kahon: nananatiling matatype muli ang text, nananatiling hugis ang mga hugis at sumasali ang mga larawan sa sarili mong library. I-save ito, at maaaring gawing tool ng **Share with rules** ang layout na maaaring muling punan ng sinumang may Lolly. Tingnan ang [Import a design](/info/design-import.html).

## Puwede bang magtulungan ang dalawang tao sa iisang design nang walang internet?

Oo. Isang tao ang nagbabahagi ng imbitasyon, bilang link, QR code o maikling code, at tinatanggap ng isa. Hawak na ng parehong device ang parehong session nang live, kasama ang presence at focus ring. Gumagana ito sa anumang shared na network, kasama ang phone hotspot sa basement, dahil walang server sa gitna. Tingnan ang [Magtulungan](/info/collaborate.html). Para sa mga kasamahang nasa magkaibang network, ang Lolly Work instance ng organisasyon ay nagbibigay ng authenticated na work collab.

## Ano ang mga feature flag?

Ang mga feature flag ay nag-o-on o nag-o-off ng mga bahagi ng Lolly. Sa standalone na paggamit, ikaw ang pumipili ng personal mong setting. Ang organisasyong gumagamit ng Lolly Work ay puwedeng magtakda ng mga default o magtago ng ilang switch sa ilalim ng policy nito, at may label ang mga managed na kontrol. Tingnan ang [Gamitin ang Lolly sa organisasyon mo](/info/organisation.html).

![Mga personal na feature flag sa standalone app; ang policy ng organisasyon ay puwedeng mamahala sa ilang switch](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Ano ang pagkakaiba ng utilities sa tools?

Ang utility ay gumagawa ng isang mabilis na trabaho sa file na meron ka na, tulad ng pag-compress ng PDF, pag-convert ng litrato o pag-strip ng nakatagong data, at marami sa mga ito ay tumatakbo sa device mo nang walang ina-upload. Umiiral ang mga ito para manatili sa loob ng Lolly ang mga trabahong karaniwang ibinibigay ng mga tao sa kung anong website. Ang pag-compress ng kontrata, pag-convert ng litrato sa bakasyon na nasa loob pa ang lokasyon o pag-paste ng token sa online formatter ay hindi dapat mangahulugan ng pagbibigay ng file sa site na hindi alam ang retention, jurisdiction at business model. Inililista ng [Mga utility](/info/utilities.html) ang mga ito, at ikinukuwento ng [Ang kalakalang hindi natin kailanman pinagkasunduan](/info/status-quo.html) ang kuwento sa likod nila.

![Ang Utilities view: Strip Hidden Data, Compress PDF, Convert Image at iba pang on-device na trabaho, lahat sa iisang lugar](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Magagamit ba ng organisasyon namin ang SSO, shared project at approval?

Oo, gamit ang **Lolly Work**, ang organisation server ng parehong open-source na proyekto. Hiwalay itong tumatakbo at nagdaragdag ng single sign-on sa pamamagitan ng identity provider mo, SCIM provisioning, group permission, shared project at asset, live work collab, approval at audit record. Patuloy pa ring gumagana ang pang-araw-araw na app nang mag-isa.

Sinasaklaw ng [Gamitin ang Lolly sa organisasyon mo](/info/organisation.html) ang pag-sign in at paghahanap ng shared na gawa, at sinasaklaw ng [Deployment](/info/deployment.html#organisation-services-with-lolly-work) ang pag-setup. Ang shared na nilalaman at mga record ng organisasyon ay sumusunod sa privacy at retention policy ng instance na iyon.

## Anong mga hadlang ang puwede kong asahan sa pag-adopt ng Lolly?

Karamihan ay pagbabago sa panig ng paggawa kaysa sa teknolohiya. Ang team na gusto ng governed na hanay ng mga tool ay nangangailangan ng taong magsusulat ng design system nito at ng mga unang template, bagaman maaaring magsimulang gumawa ng sarili nilang tool ang sinuman sa Design sa unang araw, nang hindi nangangailangan ng git. At patuloy na gumagana ang mga umiiral na proseso kahit off-brand ang output nila, kaya ang mahusay na pag-convert ng isang nakikitang output, magkatabi ang bago at pagkatapos, ay mas mabilis na nagpapatunay kaysa sa isang plano.

Sinasaklaw ng [Adoption & Governance](/info/adoption-governance.html) ang onboarding ayon sa papel, kung paano sukatin ang pilot at kung ano ang itsura ng governance process.

## "Vibe coded" ba ang Lolly?

Binuo ang Lolly gamit ang AI-assisted coding, AI-assisted discovery at, sa maraming lugar, AI-assisted na nilalaman, gamit ang halo ng mga model at vendor, kabilang ang mula sa mga public-cloud frontier company. Isang tao ang lumikha ng arkitektura, maingat na nag-curate ng code at nag-art direct ng karanasan.

Ang high o critical na advisory sa mga dependency ng Lolly ay humaharang sa CI. Ang advisory na hindi pa maayos ay pinipigilan lang bilang aprubadong exception na may nakasulat na dahilan. Inililista ng [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) ang bawat exception na hawak ngayon, at inililista ng [release notes](https://github.com/lolly-tools/lolly/releases) ang dala ng bawat release. Sinasabi rin ng SECURITY.md kung paano mag-ulat ng vulnerability.

Tinatanggihan din ng mga check sa build ang mga salitang mababasang gawa ng makina sa mga code comment, sa app at sa mga docs na ito, para panatilihing payak ang text para sa bawat mambabasa. Isang side effect ay maaaring mas mahirapang malaman ng detector kung aling text ang isinulat ng model. Hindi namin ito sinadya.

Higit sa lahat, nakatayo ang Lolly sa balikat ng mga dekada ng open source na gawa ng mga eksperto sa buong mundo.

**Pagsisiwalat ng Generative AI:**

- **Code na isinulat ng LLM:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (maaaring lumawak ang listahang ito)
- **LLM discovery:** Gemini 3.1, Fable, Codex Astra
- **Dokumentasyon:** Sonnet 5
- **Mga open source library:** Ang kani-kanilang may-akda, ipinahayag sa SBOM, mga comment at file header

Hindi kasama sa listahang ito ang mga model na na-vendor sa Lolly.

**Mga ginawa ng tao:**
- **Ideation, review at feedback:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, ang Penpot Community, Tim Hildred (hindi kumpleto ang listahan)
- **Arkitektura, art direction at slop janitor:** Andy Fitzsimon

## Saan napunta ang mga SUSE-branded na tool?

Nasa hiwalay at pribadong repository ang mga ito. Hindi kailanman kinukuha ng pampublikong clone ang SUSE brand pack, kaya ang build mula rito ay gumagamit ng neutral na `lolly-start` profile maliban kung pumili ka ng iba: ang mga brand-agnostic na community tool kasama ang blangkong brand na pinupunan mo ng sarili mo. Ang [lolly.tools](https://lolly.tools) ay binuo gamit ang `lolly-demo` profile at bumubukas sa [Lolly Demo](/info/lolly-demo.html), ang sariling design system ng Lolly. Pinapatakbo ng SUSE ang sarili nitong instance para protektahan ang mga trademark nito.

## Anong lasa ang Lolly logo na iyan?

May nagsasabing Lime, may nagsasabing Mint at minsan Apple, ang Lolly ang nagdadala ng tamis, ikaw ang bahalang magpalasa!
