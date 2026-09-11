# Paano ikinukumpara ang Lolly

Kung ano ang ginagawa ng Lolly na hindi ginagawa ng mga creative tool ngayon, at kung ano ang sinasadya nitong iniiwan sa kanila.

Para sa bersyong tool-by-tool, isang pahina bawat isa para sa Canva, Adobe, Figma, rendering APIs at online converters, tingnan ang [Lolly compared, tool by tool](/info/compare.html). Sinasaad ng bawat pahina kung ano ang mas mahusay na ginagawa ng ibang tool at kung ano naman ang ginagawa ng Lolly sa halip.

> **Pilot status:** Ang Lolly ay isang closed-pilot prototype, hindi isang tapos na produkto, at kasalukuyang sinasailalim ang seguridad nito sa mahigpit na infrastructure hardening ng SUSE, bilang paghahanda para sa enterprise scale. Sinasaklaw ng pahinang [Adoption & Governance](/info/adoption-governance.html#status) ang kasalukuyang kalagayan.

## Mga tool ngayon

Sinusukat ng bawat ring sa ibaba kung gaano kabuo ang paghahatid ng isang product class ng isang capability **ayon sa naka-ship ngayon** - hindi ayon sa marketing - kung saan sinusukat ang bawat class batay sa pinakamahusay nitong kinatawan. Sinusukat ang Lolly sa parehong kutsilyo: ito ang kumukuha ng tanging pulang ring sa board, para sa maturity. Buksan ang pangalan ng isang row para sa katwiran sa likod ng mga marka nito. Isinasaayos ang mga column ayon sa Overall completeness row sa itaas - ang mean ng mga scored row, na hindi kinabibilangan ng spend row.

::: figure positioning-comparison
Kumpletuhan ng kakayahan sa mga creative tool ngayon, sinaliksik noong Agosto 2026. Scoring: 0 wala, 25 workaround-grade, 50 tunay ngunit gated o partial, 75 malakas may mga caveat, 100 core competency.
:::

**Mga tala sa scoring.** Inaandar ng mga marka ng Lolly ang pagpapalagay na totoo ang mga inilathalang claim nito, kaya't ang maturity ang tanging pulang ring nito: closed pilot, may isinasagawang security hardening, wala pang na-audit. Nagpalipat ang research ng ilang cell.

Sinusukat ang Canva batay sa pinakamahusay na miyembro ng pamilya nito bawat row, dahil pag-aari nito ang Affinity at Cavalry (parehong ipinamahagi nang libre noong Oktubre 2025). Nakakuha ng 75 ang offline at on-device rendering sa pamamagitan ng Affinity - isang desktop suite na kailangan pa rin ng verified account at may dalang telemetry, ang deduction na kinukuha rin ng Adobe - samantalang ina-edit lamang ng offline mode mismo ng Canva ang mga pre-synced design, isang device, limitadong window. Nakakuha ng 50 ang Autofill: totoo pero Enterprise-gated, async, text at image lamang. Umakyat ng 25 papuntang 50 ang mass generation ng Figma nang mag-ship ang Buzz ng spreadsheet fill (free beta, Agosto 2026).

Isang panuntunan ang namamahala sa board: ang Full (100), sa mga row na humihipo sa iyong content o pagkakakilanlan, ay nangangailangan ng capability na magagamit mo nang walang account at walang cloud precondition; hindi kasali dito ang mga row na naglalarawan sa produkto mismo (maturity, ease of use). Ito ang nagpapabayad sa Adobe sa provenance: ang pinakamalawak na na-ship na C2PA (Photoshop, Lightroom, Premiere, Firefly) ay pumipirma nang lokal at sa cloud, pero hindi kailanman nang walang Adobe account at identity, kaya 75. Nililimita nito ang render APIs sa mass generation at automation sa parehong dahilan.

Ipinapakita ng 75 na provenance ng Lolly ang on-device offline signing: mas malakas sa arkitektura pero hindi pa na-audit, at nababasa ang device key bilang unverified sa stock validators hangga't hindi ito pinapatunayan ng isang identity o ng sariling CA ng isang organisasyon. Dumarating ang 50 ng Penpot sa pamamagitan ng opisyal na Lolly Export plugin: ang parehong engine signing, opt-in, at inihayag bilang pag-aari ng Lolly. Kinukuha rin ng Penpot ang tanging off-scale ring ng board, 90 sa on-device rendering - browser canvas, pag-save sa sarili mong sovereign cloud (kahit laptop), private export; ang server hop lamang ang naghihiwalay dito sa Lolly. Nakakakuha ang Cloudinary ng sarili nitong column: isang media pipeline (DAM, transform API, CDN), at ang tanging cloud column na nag-ship ng C2PA (50, dahil pumipirma ang fl_c2pa sa paghahatid, na nagpapatunay na delivered-by-Cloudinary, hindi made-by-you).

Tumatakbo naman sa kabaligtaran ang live collaboration: itinatakda ng Figma ang scale benchmark (200 editor) at nakakakuha ng Partial ang pairwise, air-gapped P2P ng Lolly. Isang hula ang presyo, at nakalagay ito bilang ganito: list-price arithmetic batay sa makatotohanang seat mix, sinadyang malawak, para sa scale hindi para sa procurement. Nakakakuha ang render APIs ng 75 sa constraints: naka-lock ang mga template, walang brand-governance layer.

Ang puwang: walang naka-ship ngayon na constraints-first at offline, walang account at walang server sa render path, at wala pang gumaya sa account clause. Ngayon, nag-ship na ang Lolly ng sarili nitong open canvas - **Design**, isang direct-manipulation na free canvas - pero ang mga kulay, type at asset dito ay sumusunod sa brand globals, kaya kahit ang malayang pag-aayos ay nananatiling constraints-first.

Ang Lolly ay **hindi pa rin** isang unconstrained design suite; magpapatuloy ang mga designer sa paggamit ng Illustrator at Figma para sa bespoke work - at kapag kailangan nang maging governed, reproducible asset ang trabahong iyon, dinadala ng [Import a design](/info/design-import.html) ng Design tool ang tapos na Figma, Penpot, Illustrator, InDesign o PDF file papunta sa canvas bilang editable, brand-conformed na mga box.

![Ang free canvas ng Design, kung saan ang mga kulay, font at asset na inaalok ay pag-aari ng brand](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&dark=1&filename=aud-open-canvas)

## Gamitin ito para sa

- Mabilis na paggawa ng operationalised creative assets (event tiles, badges, signatures, alerts)
- Malayang pag-aayos sa open canvas (Design) kapag ang mga piraso - kulay, type, icon, imahe - ay dapat manatiling sumusunod sa brand globals
- Pagdadala ng tapos na Figma, Penpot, Illustrator, InDesign o PDF design (ang Import a design ng Design tool) para ma-edit, magovern, at ma-re-render nang deterministic sa bawat format ng Lolly
- One-to-many na "punan ang tatlong field, kunin ang tapos na asset" na daloy - kasama ang bulk run mula sa isang spreadsheet/CSV sa `/pro` batch grid (i-paste o mag-import ng mga row, isang tapos na asset bawat row, i-download bilang zip)
- Always-on, paulit-ulit na branded output
- Mga bagay kung saan mas mahalaga ang sentral na kontrol sa brand expression kaysa sa expressive flexibility

Magandang panukat ng ceiling dito ang Deck Studio: isang buong slide deck na idineklara bilang data, ina-layout nang live sa canvas at ine-export bilang native editable na PowerPoint.

![Ang Deck Studio sa split view - nakalista ang mga slide ng deck bilang mga block sa kaliwa, ang naka-layout na deck na naka-render sa kanan](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## Huwag itong gamitin para sa

- Bespoke o flagship hero content (billboards, malalaking video)
- Natatanging campaign work na talagang nangangailangan ng designer
- Ideation na kailangang lumaya nang tuluyan sa brand system - patuloy na isinasailalim ng open canvas ng Lolly ang mga kulay, type at asset sa brand globals, at iyan mismo ang punto

## Mag-innovate nang probabilistiko, mag-scale nang deterministiko

Karamihan sa mga pitch na "AI creative" ay inilalagay ang model sa maling gilid ng isang lumang linya. Naayos na ito noon ng mga eskriba at illuminator: gumagawa ka nang maluwag sa sketch, kung saan kahit ano ay maaaring subukan at walang naka-commit, at pagkatapos ay pupunta ka sa printing press, na nakakatakot mismo dahil nagko-commit ito. Sa mga sketch nakasalalay ang sining. Sa press naman kung paano ito lumaganap. Dalawang kasangkapan, dalawang trabaho, bawat isa ay malikhain sa sarili nitong paraan, at mapagkakatiwalaan ang naka-print na trabaho dahil tinupad ng press ang pangako nito sa bawat pull.

Ang Lolly ang press, hindi ang sketch. Dalhin ang kahit ano sa ideation - isang model, isang designer, isang napkin - pero sa sandaling kailangan nang maging sampung libong asset ang isang ideya, dumadaan ito sa isang bagay na nagre-render nang pareho sa bawat pagkakataon, mula sa mga input na kaya ng kahit sino basahin pabalik. Iyan ang tunay na punto ng paghahambing sa itaas: hindi kung sino ang may mas mahusay na generator, kundi kung sino ang gumagawang reproducible sa committed step.

> Pagkatiwalaan ang creative process, mag-scale nang may rigor.

## I-approve ang tool, hindi ang file

Ang bawat ibang tool sa board ay gumagawa ng *file* na kailangang suriin pagkatapos - isang brand manager sa Slack thread, legal sa disclaimer, isang round ng pagbabago, isa pang review. Inililipat ni Lolly ang approval **isang hakbang paatras**. Ang mga brand rules - eksaktong hex codes, licensed font files, bleed margins, spacing - ay naka-hard-code sa HTML at CSS ng tool, kaya *hindi kayang* mag-emit ang template ng off-brand na asset. Ang layout mismo ang nag-eenforce.

Kaya titigil ka sa pag-approve ng outputs at magsisimulang mag-approve ng **tool** na gumagawa sa mga ito. I-approve ito nang isang beses, at bawat asset na ilalabas nito ay pre-approved na sa pagkabuo nito - walang tao sa loop, walang review cycle, sa kahit anong volume.

Ito ang pagbabagong talagang idinudulot ng deterministic engine: hindi ito mas mabilis na bersyon ng lumang approval process, tinatanggal nito ang proseso. Para sa creative team, ito ay guard-rail, hindi kapalit - itinatapon mo pa rin ang bola (ang data, ang copy, ang imahe) at ang code ang bumper lane na pumipigil sa bawat throw na mapunta sa gutter.

![Ang buong trabaho ng producer: i-type ang mga salita. Ang type, kulay at spacing ay naayos na noong na-approve ang tool](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DApproved&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-approve-the-tool)

| Pag-approve ng assets sa lumang paraan | Pag-approve ng tool, ang paraan ng Lolly |
|---|---|
| Bawat tapos na file ay sinusuri, isa-isa | Ang tool ay sinusuri isang beses |
| Request → gumagawa ang designer → brand review → legal check → pagbabago → re-review | Isang parameter change → tapos na asset |
| Designer, brand manager, legal at requester lahat nasa loop | Ang producer, mag-isa |
| Mga araw kada asset | Mga segundo kada asset |
| 10,000 assets = 10,000 review cycles | 10,000 assets = zero (na-approve na ang template) |

## Ang natatanging ibinibigay nito

- **Malayang design potential na ligtas na naihahatid sa konteksto.** Kayang ipahayag ng mga tool ang matapang na design ideas sa loob ng hard-coded na guard-rails.

- **Software-defined content automation na nagbabalik ng final asset.** Input → final file. Wala nang "i-save mo na lang mula sa design tool mo at i-post-process."
- **Nagsasama-sama ang mga tool.** Kayang i-embed ng isang tool ang render ng isa pang tool at ibalik ito bilang bahagi ng iisang tapos na asset, nang walang tool-to-tool code coupling - isang primitive na wala sa alinmang open-canvas o DAM-templating na produkto sa board.
- **Vendor neutrality.** Buong kontrol sa feature at gastos. Open-source na engine. Ang mga tool at asset ay git-tracked na content, hindi naka-lock sa SaaS database.

Ang una sa mga iyon ang madalas na binibigyang-kulang ng halaga ng mga tao. Isang poster-grade na city map, iginuhit bilang tunay na vector road at water paths, mula sa isang dropdown at dalawang color fields na hindi mapapatungo sa labas ng brand:

![Ang mga canal ring at road network ng Amsterdam na iginuhit gilid-hanggang-gilid gamit ang sariling tinta ng brand, bawat stroke inilagay ng template sa halip na ng kamay](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Content sovereignty

May pangalan ang pinagsama-samang resulta ng nakaraang seksyon: sovereignty. Tumatakbo ang media pipeline mo sa hardware na pag-aari mo. Ang brand mo - ang tokens, ang fonts, ang logos, ang mga tool na nag-eenforce sa mga ito - ay nakatira sa mga file na hawak mo, sa version control na kontrolado mo, hindi sa database ng isang vendor na may export button. Nangyayari ang rendering sa device na nasa harap mo, kaya hindi kailanman dumadaan ang isang asset sa third party para lang mabuo, at ang buong landas mula input hanggang tapos na file ay open source at maaaring siyasatin. Kung mawala bukas ang lahat ng SaaS design vendor, hindi mapapansin ito ng isang Lolly deployment.

Mahalaga ito sa sinumang ang trabaho ay dapat mabuhay nang mas matagal kaysa sa isang subscription: ang magulang na ang photo book ay nasa laptop na iyon, katulad ng public body na ang brand library ay nasa ilalim ng procurement rules. Para sa mga organisasyon - public bodies, regulated industries, sinumang ang brand ay strategic asset at hindi lamang palamuti - ang "saan nakatira ang content namin at sino ang makakapatay nito" ay isyu ng governance, hindi lamang preference. Ang sovereignty dito ay katangian ng architecture sa halip na hosting feature na idinagdag para sa compliance, at ang mga pahinang [Privacy Policy](/info/privacy.html) at [Verify It Yourself](/info/verify-yourself.html) ay umiiral para masuri mo ang claim na ito sa halip na paniwalaan lamang.

Sa ilalim ng lahat ng ito ay isang pangako, sinabi bilang commitment sa halip na feature: **kung nire-render ito sa device mo, ito ay libre magpakailanman.** Ang engine, ang shells, ang mga tool, ang formats - ang buong on-device creative path ay open source at mananatiling ganito. May mekanismo ang pangakong iyon: ang bersyong na-release ay lisensyado upang hindi na ito mabawi, at walang umiiral na contributor agreement na maaaring mag-relicense sa trabaho sa hinaharap. Ang buong hangganan ay kasya sa isang pangungusap: lahat ng nire-render sa device mo ay libre at open source, magpakailanman; ang pag-coordinate ng mga tao at makina sa isang network ay trabaho ng hiwalay na control plane, [lolly.work](https://lolly.work).
