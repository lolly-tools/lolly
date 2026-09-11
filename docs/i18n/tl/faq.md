# FAQ

Mga madalas itanong na ipinapakita sa accordion sa `/info` landing page.

**Paano i-maintain:** bawat `##` heading sa ibaba ay isang tanong; lahat ng nasa
ilalim nito (hanggang sa susunod na `##`) ang sagot. Gumagamit ang mga sagot ng
parehong magaan na markdown tulad ng iba pang bahagi ng site - paghiwalayin ang mga
talata gamit ang blangkong linya. Magdagdag, mag-alis o mag-ayos ng mga tanong dito
at patakbuhin ulit ang `npm run build:info` (o `npm run dev:web`).
Ang lahat ng nasa itaas ng unang `##` (ang pamagat na ito at ang mga notang ito) ay hindi pinapansin ng build.

## Ano ang mangyayari kapag nag-opt-in ako sa /profile page?

Sa unang paggamit mo ng Lolly, ganap na pribado ang lahat ng ita-type mo kahit saan hanggang sa sadyain mong ilabas ang impormasyong iyon sa pamamagitan ng media o ng share link (kung online).

Kapag napili ang opt-in, ang mga detalye ng profile na pipiliin mo ay isinasara sa loob ng ginagawa mo, na nagpapangalan sa iyo bilang pinagmulan. Walang naisasama nang hindi mo pinipili.

Malaki ang dami ng content na nagagawa ng Lolly. Mahigpit ang aming data minimization approach para maiwasan ang panganib.

## "Vibe coded" ba ang Lolly?

Binuo ang Lolly gamit ang AI-assisted coding, AI-assisted discovery at sa maraming bahagi, AI-assisted content, gamit ang iba't ibang model at vendor, kabilang ang mula sa mga nangungunang kompanya sa public cloud.

Sa oras na isinulat ito, wala ni isang kilalang security vulnerability ang Lolly sa supply chain nito, at nangangako sa mabilisang security response kapag lumitaw ang mga CVE.

Isang tao ang lumikha ng architecture, nag-curate ng code nang may intensyon at nag-art direct sa experience.

Higit sa lahat, nakatayo ang Lolly sa balikat ng dekada-dekadang open source innovation mula sa mga tunay na eksperto sa buong mundo.

May deterministic build-gate sa codebase ng Lolly para panatilihing coherent ang code at documentation para sa average reader at "i-de-slop" ang experience. Baka mahirapan dahil dito ang proprietary synthetic enumeration ng origin nito. Hindi iyon sinadya.

**Pagsisiwalat ng Generative AI:**

- **LLM-written code:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next (posibleng lumawak ang listahang ito)
- **LLM discovery:** Gemini 3.1, Fable
- **Documentation:** Sonnet 5
- **Open source libraries:** ang kani-kanilang mga awtor, nakasaad sa SBOM, comments at file headers

Hindi kasama sa listahang ito ang mga model na na-vendor sa Lolly.

**Kontribusyon ng tao:**

- **Architecture:** Andy Fitzsimon
- **Art direction:** Andy Fitzsimon
- **Human-written code:** Andy Fitzsimon
- **Ideation, review at feedback:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, ang Penpot Community (hindi kumpleto ang listahan)

## Ano ang mga feature flag?

Binubuksan o isinasara ng mga feature flag ang mga bahagi ng Lolly. Karaniwan, administrator ang kumokontrol nito - sa Lolly, ikaw ang may kontrol.

![Bawat feature flag ay switch na pag-aari mo, nakalagay sa sarili mong profile sa halip na sa console ng isang administrator](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Paano ko makukuha ang mobile o desktop apps?

Kahit sino ay puwedeng mamahagi ng sarili niyang apps, at dapat malaki ang pagkakaiba-iba ng tools at configuration ng mga app na iyon depende sa audience na pinaglalaanan nito. Kaya walang iisang app maliban kung ikaw ang gumawa nito o may kaugnay na taong nagbigay nito sa iyo.

## Bakit "Lolly Tools" ang pangalan?

**Lolly** dahil matamis ang kalayaan, at dahil sa Australia, New Zealand at Britain, kendi ang tawag na lolly.

**Tools** dahil nakatigil lang ang isang kasangkapan hangga't hindi mo ito dinadampot. Hindi ito tumatakbo kapag hindi mo ginagamit, at hindi ka nito binabantayan habang ginagamit mo.

## Anong mga hadlang ang puwede kong asahan sa pag-adopt ng Lolly?

Kasyang-kasya ang Lolly saanman ka na gumagawa ng mga file - iisa ang engine ng CLI
at ng App, kaya hindi puwedeng lumihis ang isang pipeline na tumatakbo nang alas-dos ng
madaling araw sa nakikita ng tao sa preview sa browser. Bihirang teknikal ang hadlang sa pag-adopt; organisasyonal ito. Asahan ang mga ito:

**Kailangang may gumawa ng curated na brand catalog.** Ang Lolly ay platform, hindi
tapos nang pakete ng mga template mo. Para sa isang *governed rollout*, may nagtatakda ng
shared asset catalog (mga logo, palette, font bilang permanenteng ID) at sumusulat ng manifest +
template para sa bawat uri ng output. Pero hindi kailangang maghintay doon ng mga indibidwal - sa
bukas na app, kahit sino ay puwedeng mag-ingest ng sariling files sa catalogue at gumawa ng tools sa
Design mula sa unang araw.

**Hindi kailangan ng git para makapag-ambag.** Gumagawa ang mga designer ng sarili nilang tools at templates
sa loob ng app, saka ibinabahagi ang mga ito sa mga kasamahan o isinusumite sa kung sino man ang may-ari ng
deployment para maisama bilang default.

**Sadyang makitid ito - ganoon dapat ang pagpapakilala.** Hindi para sa bespoke o hero
content ang Lolly. Ito *ay* ang personal mong DAM - pinalusog at pinalakas ng design
system, tools at catalog mo - at *mayroon* itong open canvas (Design), pero
kahit doon ay sumusunod pa rin sa aktibong design globals ang mga kulay, type at asset, kaya
nananatili sa loob ng sistema ang malayang pag-aayos. Kapag itinabi sa Figma o Canva, mukha
itong limitado. Kapag tiningnan bilang kung ano talaga ito - naoperasyonalisa, paulit-ulit at napakalaking-eskalang
paggawa ng asset - walang kalaban. Ang maling pagpapakilala ang pinakakaraniwang balakid.

**Change management sa panig ng gumagawa.** Gumagana na ngayon ang mga umiiral nang proseso, kahit
off-brand ang output. Ang muling pagturo ng mga ito sa engine ay nangangahulugan ng muling pagsubok at muling pag-aaral,
at nagiging dahilan ang "kaya na naman naming gumawa ng file" para hindi mag-migrate. Magsimula sa pag-convert
ng isang high-visibility at production quality na output at ipakita nang magkatabi ang before/after.

Itinataas ng Lolly ang antas ng lahat.


## Ano ang pagkakaiba ng utilities sa tools?

**Simpleng Sagot →** Hindi laging kailangang mag-render ng utilities kaya puwede silang bigyan ng ibang UX. 

**Tunay na Sagot →** Ang dahilan kung bakit puwedeng i-host ang utilities sa loob ng Lolly Tools ay para magdagdag ng isa pang 'convenience layer' ng depensa na pumipigil sa data-exfiltration. 

Bakit? Dahil alam nating araw-araw, kinukuha ng mga tao ang **kumpidensyal na content na hawak na nila** at ibinibigay ito sa
kung anong website para gawin ang isang maliit na mekanikal na operasyon:

- "**I-compress ang PDF na ito**" → nag-a-upload ng kontrata / payslip / board deck sa mga hindi kilalang entidad.
- "**i-convert ang HEIC sa JPG**" → nag-a-upload ng personal na litrato (may GPS EXIF) sa host na pinondohan ng ads
- "**i-crop / i-resize ang larawang ito**" → nag-a-upload ng screenshot ng produkto o hindi pa inilalabas na asset
- "**i-format ang JSON na ito**" / "i-decode ang JWT na ito" → nagpe-paste ng API responses, tokens, secrets sa isang formatter
- "**pagsamahin ang mga PDF na ito**" → nag-a-upload ng **dalawang dokumentong hindi dapat magkasama sa iisang server**

Ang mga site na ito at ang napakaraming clone na kasunod nila ay **hindi mapagkakatiwalaan bilang default** -
hindi alam ang retention, hindi alam ang hurisdiksiyon, hindi alam ang mga subprocessor at may ad/affiliate
business model na may lahat ng dahilan para itago ang ibinibigay mo. Maliit na bagay ang operasyon;
ang **content ang bayad.** 

Napapanalunan namin ang labanan para sa governance sa pamamagitan ng mahusay na kaginhawahan at serbisyo. 

![Tinitipon ng Utilities view ang mga mekanikal na trabahong karaniwang ipinapasa ng mga tao sa kung anong website, pero dito ay tumatakbo ang lahat sa loob ng Lolly](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Kaya bang i-edit at i-render ng Lolly ang mga file kong Figma, Penpot, Illustrator o InDesign?

Oo. Buksan ang **Design** at i-click ang **Import a design**: tumatanggap ito ng native na Figma **.fig** (Save local copy), ng Penpot **.penpot** export, ng Illustrator **.ai** o **.pdf**, ng InDesign **.idml** (File → Export → InDesign Markup) o ng **kahit anong SVG** (ang malapad na pinto - halos lahat ng design app ay nag-e-export nito). Walang kailangang account, plugin o lisensya ng design app.

![Ang bukas na canvas ng Design - matatagpuan ang Mag-import ng Disenyo sa Lolly menu ng toolbar](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

Dumarating ang mga layer bilang mga kahong puwedeng i-edit sa open canvas: nananatiling puwedeng muling i-type ang teksto, nananatiling hugis ang mga hugis, sumasama ang mga larawan sa sarili mong image library at sumusunod sa brand globals ang type at mga kulay. I-save ito at magiging muling nagagamit at URL-addressable na template ang layout na puwedeng punan ng kahit sinong may Lolly - at puwede kang maghalo ng live na tools (isang QR code, isang chart) na muling nagre-render pagka-load. Mula roon ay nagre-render ito tulad ng iba pang bagay sa Lolly - SVG, PDF, PNG at iba pa, muling magagawa mula sa URL nito. Tingnan ang [Import a design](/info/design-import.html).

## Puwede ko bang ibahagi ang gawa ko bilang file sa halip na link?

Oo. Kapag hindi kayang dalhin ng link ang lahat (sarili mong mga litrato, mahabang teksto), sinasabi ng Share dialog kung ano mismo ang mawawala at nag-aalok ito ng **.lolly** file sa halip: isang file na naglalaman ng design, ng mga larawang ginagamit nito at, kung gugustuhin mo, ng tool mismo. Ikaw ang magpapasya kung gaano karami ang isasama - papasok lang ang pangalan at mga detalye mo kung naka-opt in ang profile mo, hindi kasama ang lisensyadong art maliban kung isasama mo ito, at tatanungin ang sinumang magbubukas ng file na may dalang tool kung pinagkakatiwalaan niya ito bago ito makatakbo. Tingnan ang [Pagbabahagi ng iyong gawa](/info/using.html#sharing-your-work).

## Puwede bang magtulungan ang dalawang tao sa iisang design nang walang internet?

Oo. Nagbabahagi ng imbitasyon ang isa (isang link, isang QR code o isang short code), tinatanggap ito ng isa pa, at parehong hawak ng dalawang device ang iisang live na session - kasama ang presence, focus rings at lahat. Gumagana ito sa anumang shared network, pati sa hotspot ng cellphone sa loob ng gusaling walang signal, dahil walang server sa gitna. Tingnan ang [Pagtutulungan](/info/collaborate.html).

## Saan napunta ang mga SUSE-branded na tool?

Nasa hiwalay at pribadong repository na sila. Hindi man lang kinukuha ng isang public clone ang SUSE brand pack, kaya ang tumatakbo sa isang public build ay ang neutral na `lolly-start` profile - ang mga brand-agnostic na community tool kasama ang blangkong brand na pupunan mo ng sarili mo. May sariling instance ang SUSE para protektahan ang mga trademark nito.

## Bakit libre ito? Ano ang kapalit?

**Ginawa namin ang Lolly para sa aming sarili.** Kailangan ng SUSE ng libu-libong on-brand na file, bawat isa ay may pangalan nitong nakaselyo sa loob, gawa nang walang ibinibigay sa mga panlabas na serbisyo. Kaya gumawa kami ng tool na ginagawa ang lahat ng iyon sa mismong device, at inilabas ito bilang open source, tulad ng lahat ng iba pang ginagawa namin. Patuloy namin itong minementina dahil ginagamit namin ito araw-araw. **Walang obligasyon:** gumagana ang lahat dito, kasama man kami o wala.

Nakaguhit ang linyang iyon sa lisensya, hindi sa pangako: anumang tumatakbo nang lokal ay libre, habambuhay. Lisensyado ang isang bersyong nailabas na kaya hindi na ito puwedeng bawiin, at walang contributor agreement na puwedeng mag-relicense ng gawa ninuman. Tingnan ang [positioning](/info/positioning.html) para sa buong pahayag.

## Gaano karami ang itinatago ng SUSE bilang pribado? (o kung kailan kami iiwan sa ere)

Open source ang engine, ang mga shell, ang mga schema at ang mga brand-agnostic na tool; ang mga trademark at branded na tool ng SUSE ang bahaging nananatiling pribado, at nakahiwalay na ang mga ito. Ang pampublikong instance sa [lolly.tools](https://lolly.tools) ay tumatakbo gamit ang blangkong brand.

Estruktural ang hangganan, hindi lamang pangako. Bawat inilabas na bersyon ay open source at hindi na maibabalik sa pagkakatago, walang contributor agreement na puwedeng mag-relicense ng gawa ninuman, at ang trademark lang ang pinipigil. Nang isara ng isa pang kumpanya ang mga source ng enterprise Linux nito noong 2023, isa ang SUSE sa nagtatag ng [OpenELA](https://openela.org) para manatiling bukas ang code na iyon - ito rin ang paninindigang minana ng proyektong ito.

Buong pagsisiwalat: *totoong* gumagawa ang SUSE ng internal tooling para i-integrate ang Lolly sa mga IT system nito - tungkol iyon sa internal na set-up ng SUSE, hindi sa public vs. private na development. Layunin din ng Lolly na maitayo sa pamamagitan ng [Open Build Service](https://openbuildservice.org/), na may secure supply-chain artifacts na inihahatid ng [SUSE Application Collection](https://apps.rancher.io/applications).

## Anong lasa ang Lolly logo na iyan?

May nagsasabing Lime, may nagsasabing Mint at minsan Apple, ang Lolly ang nagdadala ng tamis, ikaw ang bahalang magpalasa!
