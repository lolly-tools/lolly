# Mga tanong & sagot

Mga madalas itanong, na ni-render bilang accordion sa `/info/start/faq.html`.

**Paano panatilihin:** bawat `##` heading sa ibaba ay tanong. Lahat ng nasa ilalim ng heading,
hanggang sa susunod na `##`, ang sagot. Ginagamit ng mga sagot ang magaan na markdown ng site:
paghiwalayin ang mga talata gamit ang blangkong linya. Magdagdag, mag-alis o mag-ayos ng pagkakasunod ng mga tanong dito at
patakbuhin ulit ang `pnpm run build:info` (o `pnpm run dev:web`).
Binabalewala ng build ang lahat ng nasa itaas ng unang `##` (ang pamagat na ito at mga talang ito).

Ang pagkakasunod ay para sa baguhan: ang kapalit muna, saka ang mga file mo, saka ang pagkuha
at pagpapatakbo ng Lolly, saka ang mga organisasyon, saka kung paano ito ginawa. Ang anchor ng bawat tanong
ay binubuo mula sa tanong sa English sa parehong posisyon, kaya pinapanatili ng salin ang
pagkakasunod sa English.

## Bakit libre ito? Ano ang kapalit?

**Ginawa namin ang Lolly para sa sarili namin.** Kailangan ng SUSE ng libo-libong file na sumusunod sa brand, na ginagawa nang walang ipinapasa sa mga panlabas na serbisyo. Kaya gumawa kami ng tool na ginagawa ang lahat sa device, at inilabas ito bilang open source, tulad ng lahat ng iba pa naming ginagawa. Patuloy namin itong pinapanatili dahil ginagamit namin ito araw-araw. **Walang obligasyon:** gumagana ang lahat ng narito, kasama man kami o wala.

Nasa lisensya ang hangganang iyon, hindi sa pangako: libre magpakailanman ang anumang tumatakbo nang lokal. Lisensyado ang inilabas na bersyon kaya hindi ito mababawi. Walang contributor agreement na puwedeng magpalit ng lisensya ng gawa ng sinuman.

## Gaano karami ang pinananatiling pribado ng SUSE? (o kailan ang biglaang pagbawi)

Open source ang engine, mga shell, schema at tool na walang partikular na brand. Nananatiling pribado ang mga trademark at branded na tool ng SUSE at nakahiwalay na ang mga ito. Pinapatakbo ng pampublikong instance sa [lolly.tools](https://lolly.tools) ang [Lolly Demo](/info/lolly-demo.html), ang sariling design system ng Lolly.

Walang nakasalalay sa pangako rito: nananatiling open source ang bawat inilabas na bersyon. Nang isara ng ibang kumpanya ang source ng enterprise Linux nito noong 2023, tumulong ang SUSE na itatag ang [OpenELA](https://openela.org) para panatilihing bukas ang code na iyon. Minamana ng proyektong ito ang paninindigang iyon.

*Gumagawa nga* ang SUSE ng mga panloob na tool para ikonekta ang Lolly sa sarili nitong mga IT system. Panloob na setup iyon ng SUSE, hindi paghihiwalay ng pampubliko at pribadong development. Nilalayon din ng Lolly na ma-build sa pamamagitan ng [Open Build Service](https://openbuildservice.org/), na may mga secure na artifact ng supply chain na inihahatid ng [SUSE Application Collection](https://apps.rancher.io/applications).

## Bakit "Lolly Tools" ang pangalan?

**Lolly** dahil matamis ang kalayaan, at dahil sa Australia, New Zealand at Britain, ang lolly ay kendi.

**Tools** dahil hindi kumikilos ang tool hanggang gamitin mo ito. Hindi ito tumatakbo kapag hindi mo ginagamit, at hindi ka nito minamanmanan habang ginagamit mo ito.

## Bakit berde ang lahat?

Bumubukas ang lolly.tools sa [Lolly Demo](/info/lolly-demo.html), ang sariling halimbawang design system ng Lolly, na berde ang pangunahing kulay. Lumipat sa **Lolly Starter**, isang blangkong design system, o sa sarili mo sa [Settings → Design systems](/#/settings?focus=design-systems-section).

## Puwede ko bang gamitin ang sarili kong brand?

Oo. Bumubuo ang **Lolly Design System Setup** (`#/start`) ng design system mula sa isang kulay, design tokens file o tapos na design. Gagamit na ng design system mo ang bawat tool sa pagguhit. Dinadaanan ng [Magsimula](/info/quickstart.html#put-your-brand-in) ang tatlong paraan.

Pinamamahalaan ang design system na ibinibigay ng organisasyon o build mo. Nagpapakita ito ng kandado at nananatiling read-only. Para baguhin ito, gumawa ng kopyang nae-edit.

## Nasaan ang ginawa ko kahapon?

Kung pinindot mo ang **Save as** o **Save**, nasa **Projects** sa home screen ang gawa mo, sa browser o app kung saan ka nag-save. Kung **Download** lang ang pinindot mo, nasa mga download ng browser o system mo ang file, at karaniwang may kopya sa **Assets**. Itinatago rin ng mga tool na [nagse-save habang gumagawa ka](/info/find-your-work.html#which-tools-save-as-you-work) ang hindi pa naka-save na gawa sa **Projects**. Sinasaklaw ng [Hanapin at bawiin ang gawa mo](/info/find-your-work.html) ang bawat kaso.

## Isinara ko ang tab. Nawala ba ang gawa ko?

Nasa **Projects** pa rin ang naka-save na gawa. Wala na ang hindi na-save na gawa, maliban sa mga tool na nagse-save habang gumagawa ka, na nagtatago rin nito sa **Projects**. Sa susunod, pindutin ang **Save as** bago ka umalis. Tingnan ang [Kung isinara mo ang tab o umalis sa tool](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## Puwede ko bang ibahagi ang gawa ko bilang file sa halip na link?

Oo. Kapag hindi kayang dalhin ng link ang lahat, tulad ng sarili mong mga litrato o mahabang text, sinasabi ng Share dialog kung ano ang mawawala at nag-aalok ng **.lolly** file. Nasa iisang file na iyon ang design, mga larawang ginagamit nito at, kung pipiliin mo, ang tool.

Ikaw ang nagpapasya kung gaano karami ang isasama. Kasama lang ang pangalan at mga detalye mo kung naka-opt in ang profile mo. Hindi isinasama ang lisensyadong artwork maliban kung piliin mong isama ito. Tinatanong ang sinumang magbukas ng file na may dalang tool kung pinagkakatiwalaan nila ang tool bago ito makatakbo. Tingnan ang [Pagbabahagi ng gawa mo](/info/using.html#sharing-your-work).

## Ano ang ginagawa ng mga detalye sa profile ko?

Awtomatikong pinupunan ng mga detalye mo sa **Settings** ang mga tool na humihingi ng mga ito, tulad ng pangalan sa badge. Nananatili ang mga ito sa device na ito. Walang napupunta sa ginagawa mo maliban kung i-on mo ang opt-in. Pagkatapos, isinasama at siniselyuhan ang mga detalyeng pinili mo at tinutukoy ka bilang pinagmulan.

Nilalamang pinili mo lang ang ipinapadala ng Sharing at Sync. Sa Lolly Work instance ng organisasyon, napupunta rin sa server na iyon ang mga ibinahaging session at gawang pinamamahalaan ng mga patakaran. Tingnan ang [Privacy](/info/privacy.html).

## Paano ko makukuha ang mga mobile o desktop app?

I-download ang mga ito mula sa [I-install ang Lolly](/info/install.html). Inililista ng page ang bawat build para sa macOS, Windows, Linux at Android, at ipinapakita kung paano suriin ang file na na-download mo. Nakukuha ng iPhone at iPad ang **Lolly Tools** mula sa App Store. Nasa [seksyon para sa iPhone at iPad](/info/install.html#iphone-and-ipad) ang link.

Puwede ring mag-build at mamahagi ang sinuman ng sarili nilang kopya ng app, na may mga tool at setting na kailangan ng mga gagamit nito. Ipinapakita ng [Gabay sa Pag-build](/info/build-guide.html) kung paano.

## Sinasabi ng Lolly na kailangan nito ng WebGPU. Ano ang puwede kong gawin?

Gumuguhit ang web app gamit ang WebGPU, isang graphics feature ng mga kasalukuyang browser, at sinusuri kung may WebGPU bago magbukas ng tool. Subukan ang mga ito sa ganitong pagkakasunod:

1. I-update ang browser mo sa kasalukuyang bersyon nito.
2. I-on ang graphics o hardware acceleration sa mga setting ng browser, saka i-restart ang browser.
3. Gumamit ng nasubukang browser: inililista ang mga ito sa [Mga sinusuportahang environment](/info/supported-environments.html).
4. Sa Mac, iPhone o iPad, [i-install ang app](/info/install.html) sa halip.

## Puwede bang i-edit at i-render ng Lolly ang mga Figma, Penpot, Illustrator o InDesign file ko?

Oo. Buksan ang **Design** tool at i-click ang **Import a design**: tumatanggap ito ng native na Figma **.fig** (Save local copy), Penpot **.penpot** export, Illustrator **.ai** o **.pdf**, InDesign **.idml** o **.indd**, Affinity document, Photoshop **.psd**, PowerPoint **.pptx**, CAD **.dxf** o **anumang SVG** ([bawat format na nababasa nito](/info/design-import.html#what-comes-in-from-each-app)). Hindi mo kailangan ng account, plugin o lisensya ng design app.

![Ang bukas na canvas ng Lolly Design - nasa Lolly menu ng toolbar ang Import a design](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

Dumarating ang mga layer bilang mga nae-edit na kahon. Puwede pa ring palitan ang text, nananatiling hugis ang mga hugis at napupunta sa library mo ang mga larawan. Kapag na-save na ang layout, puwedeng gawin itong tool ng **Share with rules** na mapupunan ulit ng sinumang may Lolly. Tingnan ang [Mag-import ng design](/info/design-import.html).

## Puwede bang gumawa ang dalawang tao sa parehong design nang walang internet?

Oo. Nagbabahagi ng imbitasyon ang isang tao (link, QR code o maikling code) at tinatanggap ito ng isa pa. Hawak na ng dalawang device ang iisang live na session, na may mga palatandaan ng presensya at mga focus ring. Gumagana ito sa anumang pinagsasaluhang network, kasama ang hotspot ng phone, dahil walang server sa pagitan. Tingnan ang [Pagtutulungan](/info/collaborate.html). Para sa mga kasamahan sa magkakaibang network, nagbibigay ang Lolly Work instance ng organisasyon ng mga work collab na may authentication.

## Ano ang mga feature flag?

Ino-on o ino-off ng mga feature flag ang mga bahagi ng Lolly. Sa standalone na paggamit, ikaw ang pumipili ng mga personal mong setting. Puwedeng magtakda ng mga default o magtago ng mga piling switch ang organisasyong gumagamit ng Lolly Work ayon sa patakaran nito, at may label ang mga pinamamahalaang kontrol. Tingnan ang [Gamitin ang Lolly sa organisasyon mo](/info/organisation.html).

![Mga personal na feature flag sa standalone na app; puwedeng pamahalaan ng patakaran ng organisasyon ang mga piling switch](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Ano ang pagkakaiba ng mga utility at mga tool?

Gumagawa ang utility ng isang mabilis na gawain sa file na mayroon ka na, tulad ng pag-compress ng PDF, pag-convert ng litrato o pag-alis ng nakatagong data. Marami ang tumatakbo sa device mo nang walang ina-upload. Pinapanatili ng mga utility sa loob ng Lolly ang mga gawaing karaniwang ipinapasa ng mga tao sa kung anong website lang. Ang pag-compress ng kontrata, pag-convert ng mga litrato sa bakasyon na may lokasyon pa rin sa loob o pag-paste ng token sa online formatter ay hindi dapat mangahulugan ng pagbibigay ng file sa site na hindi alam ang tagal ng pag-iingat ng data, hurisdiksyon at modelo ng negosyo. Inililista ang mga ito ng [Lolly Utilities](/info/utilities.html), at ikinukuwento ng [Ang palitang hindi natin kailanman sinang-ayunan](/info/status-quo.html) ang dahilan sa likod ng mga ito.

![Ang Utilities view: Lolly Strip Hidden Data, Compress PDF, Convert Image at iba pang gawaing ginagawa sa device, lahat sa iisang lugar](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Puwede bang gumamit ang organisasyon namin ng SSO, mga pinagsasaluhang project at approval?

Oo, gamit ang **Lolly Work**, ang server para sa organisasyon ng parehong open-source na proyekto. Hiwalay itong tumatakbo at nagdaragdag ng single sign-on sa pamamagitan ng identity provider mo, SCIM provisioning, mga pahintulot ng grupo, pinagsasaluhang project at asset, live na work collab, mga approval at audit record. Gumagana pa rin nang mag-isa ang pang-araw-araw na app.

Sinasaklaw ng [Gamitin ang Lolly sa organisasyon mo](/info/organisation.html) ang pag-sign in at paghahanap ng pinagsasaluhang gawa. Sinasaklaw ng [Deployment](/info/deployment.html#organisation-services-with-lolly-work) ang pag-set up ng Lolly Work. Sumusunod ang pinagsasaluhang nilalaman at mga tala ng organisasyon sa mga patakaran sa privacy at pag-iingat ng data ng instance na iyon.

## Anong mga hadlang ang puwede kong asahan sa pag-adopt ng Lolly?

Karamihan ay pagbabago sa paraan ng paggawa ng team, hindi sa teknolohiya. Ang team na gusto ng set ng mga tool na pinamamahalaan ng mga patakaran ay nangangailangan ng taong gagawa ng design system at mga unang template nito. Makakagawa pa rin ang sinuman ng sarili nilang tool sa Lolly Design sa unang araw pa lang, nang hindi kailangan ng git. Patuloy na gumagana ang mga kasalukuyang proseso kahit hindi sumusunod sa brand ang output ng mga ito. Mas mabilis na naipapakita ng mahusay na pag-convert ng isang nakikitang output, na magkatabi ang dati at bago, ang halaga nito kaysa sa isang plano.

Sinasaklaw ng [Pag-adopt & Pamamahala](/info/adoption-governance.html) ang onboarding ayon sa tungkulin, kung paano sukatin ang pilot at kung ano ang posibleng proseso ng pamamahala.

## Ginawa ba ang Lolly gamit ang "vibe coding"?

Binuo ang Lolly gamit ang coding na tinulungan ng AI, pagtuklas na tinulungan ng AI at, sa maraming bahagi, nilalamang tinulungan ng AI, gamit ang halo ng mga modelo at vendor, kasama ang mula sa mga nangungunang kumpanya sa AI sa pampublikong cloud. Tao ang gumawa ng arkitektura, sadyang pumili at nag-ayos ng code at namahala sa direksyong pansining ng karanasan.

Hinaharang ng advisory na high o critical sa mga dependency ng Lolly ang CI. Isinasantabi lang ang advisory na hindi pa maaayos bilang aprubadong eksepsyon na may nakasulat na dahilan. Inililista ng [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) ang bawat kasalukuyang eksepsyon, at inililista ng [mga release note](https://github.com/lolly-tools/lolly/releases) ang mga dala ng bawat release. Sinasabi rin ng SECURITY.md kung paano mag-ulat ng kahinaan sa seguridad.

Tinatanggihan din ng mga pagsusuri sa build ang pananalitang tila gawa ng makina sa mga komento ng code, sa app at sa mga dokumentong ito, para panatilihing simple ang text para sa bawat mambabasa. Isang epekto nito ang posibleng paghihirap ng detector na matukoy kung aling text ang isinulat ng modelo. Hindi namin nilayong mangyari iyon.

Higit sa lahat, nakasalig ang Lolly sa ilang dekada ng open source na gawa ng mga eksperto sa buong mundo.

**Pagsisiwalat tungkol sa generative AI:**

- **Code na isinulat ng LLM:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (puwedeng humaba ang listahang ito)
- **Pagtuklas gamit ang LLM:** Gemini 3.1, Fable, Codex Astra
- **Dokumentasyon:** Sonnet 5
- **Mga open source library:** Ang kani-kanilang may-akda, na nakasaad sa SBOM, mga komento at header ng file

Hindi kasama sa listahang ito ang mga model na isinama sa Lolly.

**Mga ambag ng tao:**
- **Pagbuo ng ideya, review at feedback:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, ang Penpot Community, Tim Hildred (hindi kumpleto ang listahan)
- **Arkitektura, art direction & paglilinis ng slop:** Andy Fitzsimon

## Saan napunta ang mga tool na may SUSE brand?

Nasa hiwalay at pribadong repository ang mga ito. Hindi kinukuha ng pampublikong clone ang SUSE brand pack, kaya gumagamit ng neutral na `lolly-start` profile ang build mula rito maliban kung pumili ka ng iba. May mga community tool na walang partikular na brand ang profile na iyon at blangkong brand na pupunan mo ng sarili mo. Binuo ang [lolly.tools](https://lolly.tools) gamit ang `lolly-demo` profile at bumubukas sa [Lolly Demo](/info/lolly-demo.html), ang sariling design system ng Lolly. Nagpapatakbo ang SUSE ng sarili nitong instance para protektahan ang mga trademark nito.

## Anong lasa ng Lolly logo na iyan?

Sabi ng ilan, dayap, sabi ng iba, mint at kung minsan, mansanas. Ang Lolly ang nagbibigay ng tamis, at ikaw ang gumagawa ng lasa.

## Ano ang ibig sabihin ng Lolly sa soberanya sa nilalaman?

Kontrol sa kung paano ginagawa, pinamamahalaan, iniimbak at inililipat ang nilalaman mo sa mga sistemang pinili mo. Sinusuportahan ng Lolly ang lokal na paggawa, mae-edit na gawa at mga tool na puwedeng ilipat. Nagdaragdag ang Lolly Work ng mga pinagsasaluhang serbisyong kontrolado ng organisasyon. Mahalaga pa rin ang mga lisensya ng pinagmulan, available na dependency at daloy ng data ng workflow. Ipinapaliwanag ng [Ano ang soberanya sa nilalaman?](/info/content-sovereignty.html) ang bawat kontrol at mga limitasyon nito.

## Puwede ba naming panatilihin ang umiiral naming DAM?

Oo. Puwedeng manatiling opisyal na pinagmumulan ng tala ang suportadong DAM habang ikinokonekta ng Lolly Work ang mga napiling asset sa mga tool ng Lolly. Magkakahiwalay na desisyon ang access sa pinagmulan, pinapayagang edit, karapatan sa paggamit at approval ng tapos na output. Ipinapaliwanag ng [Gamitin ang Lolly sa umiiral mong DAM](/info/use-with-dam.html) ang kaayusan, at itinatala ng [Karanasan ng SUSE sa Brandfolder](/info/suse-brandfolder.html) ang matagumpay na paggamit habang sinisimulang gamitin ito.
