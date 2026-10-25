# Paano ikinukumpara ang Lolly

Ang Lolly ay dalawang bahagi ng iisang open-source na proyekto. Ang **Lolly** ay ang engine, mga app at tool para sa paggawa, pag-edit, pag-convert at pag-export sa device mo, nang walang account. Ang **Lolly Work** ay ang organisation server, pinapatakbo sa sarili mong infrastructure, para sa sign-in, shared project, approval at server rendering. Parehong MPL-2.0. Inihahambing ng pahinang ito ang pares sa ibang paraan ng pagdidisenyo, pamamahala at paggawa ng mga file ng mga tao.

## Mga tool ngayon

Ang bawat singsing ay nagmamarka kung gaano kakumpleto ang paghahatid ng uri ng produkto sa isang kakayahan, na ang bawat uri ay minamarkahan sa pinakamahusay nitong kinatawan. Sinasaklaw ng Lolly column ang Lolly at Lolly Work nang magkasama, at sinasabi ng bawat row kung aling bahagi ang nagbibigay ng ano. Buksan ang pangalan ng row para sa katwiran ng marka nito. Inaayos ang mga column ayon sa Overall completeness row sa itaas: ang mean ng mga minarkahang row, na hindi kasama ang spend row.

::: figure positioning-comparison
Paghahambing ng kakayahan: pananaliksik sa mga kakumpitensya at marka mula Agosto 2026; ang saklaw ng Lolly + Lolly Work ay nire-review noong 28 Setyembre 2026. Pagmamarka: 0 wala, 25 workaround-grade, 50 totoo pero may gate o bahagya, 75 malakas na may caveat, 100 pangunahing husay.
:::

::: details Mga tala sa pagmamarka
Magkahiwalay ang mga available na feature at production maturity. Nailabas na ang Lolly: ang bersyon 1.0 ay inilabas bilang open source noong 30 Agosto 2026, wala pa itong independiyenteng audit sa seguridad at ilang buwan pa lang ang ebidensya ng adoption nito (nasa [Adoption & Governance](/info/adoption-governance.html#status) ang kasalukuyang estado). Ang pagkakaroon ng single sign-on, approval o server rendering ay hindi nagpapatunay ng production track record, kaya sinasalamin ng maturity score iyon. Ang mga marka ng kakumpitensya ay nananatili sa may-petsang review nila noong Agosto.

Isang patakaran ang namamahala sa board. Ang buong marka (100), sa mga row na humahawak sa nilalaman o identity mo, ay nangangailangan ng kakayahang magagamit nang walang account at walang cloud precondition; ang mga row tungkol sa produkto mismo, tulad ng maturity at kadalian ng paggamit, ay hindi sakop. Ang patakarang iyon ay nagpapababa sa Adobe sa Content Credentials: ang pinakamalawak na naipadalang implementasyon (Photoshop, Lightroom, Premiere, Firefly) ay pumipirma nang lokal at sa cloud, pero hindi kailanman nang walang Adobe account at identity, kaya 75. Nililimitahan nito ang mga rendering API sa mass generation at automation sa parehong dahilan.

Ang Canva ay minamarkahan sa pinakamahusay nitong miyembro ng pamilya bawat row, dahil pagmamay-ari nito ang Affinity at Cavalry (parehong ipinamigay noong Oktubre 2025). Ang offline at on-device rendering ay 75 sa pamamagitan ng Affinity, isang desktop suite na nangangailangan pa rin ng na-verify na account at may telemetry, ang bawas na kinukuha rin ng Adobe; ang sariling offline mode ng Canva ay nag-e-edit lang ng mga pre-synced na design, sa isang device, sa limitadong panahon. Ang Autofill ay 50: totoo ito pero Enterprise-gated at asynchronous, at pumupuno lang ito ng text at larawan. Ang mass generation ng Figma ay tumaas mula 25 hanggang 50 nang ilabas ng Buzz ang spreadsheet fill (libreng beta, Agosto 2026).

Ang Content Credentials score ng Lolly na 75 ay sumasaklaw sa on-device signing at server signing ng Lolly Work gamit ang naka-configure na organisation identity; kailangan pa ring pagkatiwalaan ng verifier ang pumirma ([Content Credentials Identity](/info/content-credentials-identity.html)). Ang 50 ng Penpot ay dumarating sa pamamagitan ng sariling export plugin ng Lolly para sa Penpot: ang parehong engine signing, opt-in at isiniwalat bilang gawa ng Lolly. Ang Penpot ay 90 sa on-device rendering: browser canvas na may save target sa server nito, na maaaring i-self-host. Ang Cloudinary ay may sariling column para sa asset library, transform API at CDN nito; minarkahan ng review noong Agosto ang delivery signing nito ng 50.

Ang live collaboration ng Lolly ay kasama ang direktang two-device na pribadong collab at authenticated na work collab sa pamamagitan ng Lolly Work, na may shared edit, cursor at naka-save na team session. Sinasalamin ng Partial score ang kasalukuyang single-node na work deployment at maikling kasaysayan ng operasyon, hindi kawalan ng team editing. Ang mga tantiya ng presyo ay may-petsang list-price arithmetic para sa laki, hindi procurement.
:::

## Kailan abutin ang Lolly

::: cols
## Abutin ang Lolly kapag

- Paulit-ulit na kailangan ang parehong uri ng file: event tile, badge, sertipiko, alerto, social card
- Maraming file ang galing sa isang template at table ng mga value, sa [Batch](/info/batch.html#make-many-versions-of-one-design) o sa CLI
- Ang mga kulay, type at asset ay dapat manatili sa loob ng design system, kahit sa bukas na canvas
- Ang tapos na Figma, Penpot, Illustrator, InDesign o PDF na design ay dapat maging mae-edit at maulit ([Import a design](/info/design-import.html))
- Ang mga file ay dapat gawin sa sarili mong mga device o server

## Abutin ang iba kapag

- Ang gawa ay detalyadong photo retouching o ilustrasyon
- Nagdidisenyo at nagpa-prototype ka ng interface ng application
- Kailangan mo ng malaking stock at template library na handa sa unang araw
- Kailangan mo ng managed na serbisyo na may mahabang track record sa laki
:::

Ang mga na-import na design at shared na design token ay hinahayaang pagsamahin ng team ang Lolly sa mga espesyalistang application, habang pinamamahalaan ng Lolly Work ang mga shared asset, review at delivery.

Ipinapakita ng isang buong slide deck ang kisame: sa **Markdown Slides**, idinedeklara ang deck bilang data, inilalatag nang live at ine-export bilang native at mae-edit na PowerPoint file.

![Markdown Slides sa split view: ang mga slide ng deck na nakalista bilang block sa kaliwa, ang inilatag na deck na nire-render sa kanan](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## Nasa tool ang mga patakaran

Inilalagay ng Lolly ang magagamit muling mga brand rule sa tool: mga kulay, font, bleed margin, spacing at pinapayagang input. Ang template ang nag-aayos ng mga bahaging hindi dapat baguhin ng tatanggap. Nagdaragdag ang Lolly Work ng group access at input policy sa paligid ng template na iyon, kasama ang approval chain para sa mga catalogue submission at delivery.

Ang minsanang pag-check sa tool ay nagpapadali ng paulit-ulit na produksyon, dahil minamana ng bawat output ang mga layout rule nito. Ang copy, mga na-upload na larawan at karapatan sa paggamit ay maaari pa ring kailangang suriin, at nagbibigay ang Lolly Work ng mga shared catalogue at hakbang sa pag-apruba para roon. Para sa creative team, ang tool ay guard-rail: ikaw pa rin ang nagdadala ng data, copy at larawan, at pinananatili ng tool na on-brand ang bawat resulta.

![Ang buong trabaho ng gumagawa: mag-type ng mga salita. Naayos na ang type, kulay at spacing noong ginawa ang tool](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Tatlo pang bagay ang nagpapaiba sa pamamaraang ito:

- **Ang huling file, mula sa mga input.** Input papasok, tapos na file palabas, walang "ngayon i-save mo mula sa design tool mo at ayusin pa".
- **Nagko-compose ng mga tool ang mga tool.** Ang isang tool ay maaaring mag-embed ng render ng ibang tool sa iisang tapos na file, na walang code coupling sa pagitan nila.
- **Bukas hanggang sa pinakailalim.** Open source ang engine, at ang mga tool, asset at design token ay mga file na maaari mong itago sa version control o pamahalaan sa Lolly Work, hindi mga row sa database ng iba.

Nananatili ang mapangahas na disenyo sa kabila ng mga guard-rail. Ang poster-grade na mapa ng lungsod na ito ay tunay na vector na path ng kalsada at tubig, mula sa isang dropdown at dalawang colour field na hindi maituturo sa labas ng design system:

![Ang mga canal ring at road network ng Amsterdam na iginuhit mula gilid hanggang gilid sa sariling ink ng design system, bawat stroke ay inilagay ng template at hindi ng kamay](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Mag-innovate nang probabilistiko, mag-scale nang deterministiko

Karamihan ng mga "AI creative" na pitch ay inilalagay ang model sa maling panig ng lumang hangganan. Nagpasya na ang mga eskriba at illuminator kung saan ito nasa. Malaya kang gumagawa sa sketch, kung saan puwedeng subukan ang anuman at walang kinikimkim. Saka ka pupunta sa printing press, na nagko-commit. Nasa mga sketch ang sining, at ang press ang paraan para maglakbay ito, at mapagkakatiwalaan ang nakalimbag na gawa dahil tinupad ng press ang pangako nito sa bawat hila.

Ang Lolly ang press. Dalhin ang anumang gusto mo sa mga ideya, model, designer o magaspang na drawing, pero sa sandaling kailangang maging maraming file ang isang ideya, dumadaan ito sa isang bagay na nagre-render sa parehong paraan sa bawat pagkakataon, mula sa mga input na mababasa pabalik ng sinuman. Ang paghahambing sa itaas ay talagang tungkol sa kung sino ang nagpapaulit-ulit sa committed na hakbang na iyon.

> Pagkatiwalaan ang creative process, mag-scale nang may rigor.

## Libre magpakailanman

**Kung nire-render ito sa device mo, libre ito magpakailanman.** Open source ang engine, mga shell, mga tool at mga format, at hindi mababawi ang nailabas na bersyon. Open source din ang Lolly Work. Ang organisasyon ay nagbabayad para sa infrastructure at operasyong pinipili nito, nang walang per-seat o per-render na bayad sa software licence para sa self-hosting. Ikinukuwento ng [Mga tanong at sagot](/info/faq.html) ang kuwento sa likod ng pangako.

## Kung saan nakatira ang nilalaman mo

Ang creative na gawa ng Lolly ay maaaring tumakbo sa hardware na pag-aari mo, at ang mga design token, font, logo at tool nito ay mga file na maaari mong itago. Sa Lolly Work, ang mga shared project, asset, policy at audit record ay nasa storage na kino-configure ng organisasyon mo. Ipinapaliwanag ng [Tiwala](/info/trust.html) kung bakit ito mahalaga, at hinahayaan ka ng [Privacy Policy](/info/privacy.html) at [Verify It Yourself](/info/verify-yourself.html) na i-check ang pahayag sa halip na maniwala lang sa amin.

## Tool por tool

Inihahambing ng [Ang Lolly na inihambing, tool por tool](/info/compare.html) ang Lolly sa Canva, Adobe, Figma, Penpot, brand portal, rendering API at online converter, isang page bawat isa, at inilalatag ang [ano ang tumatakbo saan](/info/compare.html#what-runs-where).
