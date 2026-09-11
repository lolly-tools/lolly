# Lolly para sa mga Operator

Ikaw ang magiging taong sumang-ayon sa isang bagay na parehong ligtas at popular. Isinasara mo ang isang exfiltration hole, nakakakuha ng capability at binubura ang isang request queue sa isang kilos lamang, na siyang bihirang panalo sa seguridad na nagpapagusto sa iyo nang higit sa halip na kabaliktaran: walang tawag alas-tres ng umaga dahil may embargadong file na nakarating sa isang random na web tool, mas kaunting vendor at kontrata sa iyong plato at isang rekord na maaari mong ituro kapag may nagtanong. Piliin ang landas sa ibaba na tumutugma sa function na sinasagot mo.

Pinamamahalaan mo ang buong relay: nililikha ng isang creative ang mga alituntunin at ino-scale ito ng isang developer, at ang operator ang gumagawa nito upang maging ligtas patakbuhin sa buong organisasyon, na sinusubaybayan ng [Ang Siklo ng Buhay ng Isang Kampanya](/info/overview.html#the-lifecycle-of-a-campaign) mula umpisa hanggang dulo.

Bago ka lang dito? Ang [Pag-ampon at Pamamahala](/info/adoption-governance.html) ang buong rollout. Tinatalakay ng [Deployment](/info/deployment.html) ang deploy, serve at hybrid, at ang [Configuration](/info/configuration.html) ang humuhubog sa isang solong instance.

## Sales

Pumasok sa meeting nang dala ang eksaktong file na kailangan mo, ginawa habang papunta ka roon. I-drop ang deck na mayroon ka na at muling buuin itong maayos bilang isang native na deck file, walang request queue sa pagitan mo at ng asset.

- **[Lolly para sa mga Sales Team](/info/sales.html)** - ang playbook: pag-aayos ng deck na mayroon ka, muling pagbuo nito nang native at paggawa mismo ng one-off na asset.
- **[Pag-export at Mga Format](/info/exporting.html)** - ang bahagi ng deck, PDF at imahe ng export panel, kapag kailangang bumukas ang file sa laptop ng iba.

## Pamamahayag

Live data papunta sa mga chart, mapa at talahanayan na tugma na sa house style. Buuin ang format ng istorya nang isang beses at muling gamitin ito sa tuwing tumatakbo ang istorya, para sa print at para sa screen.

- **[Lolly para sa Newsroom](/info/press.html)** - ang playbook: ang istilong info-editoryal, papasok na live data at output na publication-quality.
- **[Mga View ng Utility](/info/utilities.html)** - ang spreadsheet at ang converter, para sa hakbang bago ang chart.

## Marketing

Bawat sukat, bawat wika, isang source of truth. I-paste ang isang spreadsheet at kumuha ng isang tapos na file kada row, walang agency sa gitna ng mga routine na file.

- **[Lolly para sa mga Marketing Team](/info/marketing.html)** - ang playbook: mga variant sa dami, localisation at kung ano ang tumitigil na maging bottleneck.
- **[Paggamit ng Lolly](/info/using.html#batch-pro-mode)** - ang batch run mismo: isang sheet papasok, isang folder ng assets palabas.

## Seguridad

Ang karaniwang paraan ng paggawa ng routine na creative work ay isang liability surface: mga file na ipina-email sa mga outside contractor, mga brand asset na ina-upload sa isang dosenang web editor, customer data na ipinapasok sa site ng estranghero para lang gumawa ng mabilisang graphic. Ang Lolly ang immune response dito, dahil pinapalitan nito ang trabaho sa halip na magdagdag ng kontrol sa ibabaw nito: ang quote card, ang localised banner at ang redacted screenshot ay ginagawa sa sariling device ng empleyado, laban sa iyong brand, kaya walang nag-a-upload na hindi mo mismo inilagay roon at bawat resulta ay reproducible mula sa mga input nito. Maaaring dalhin ng mga export ang ilang layer ng cryptographic record - isang C2PA Content Credential na pinirmahan ng isang key na nilikha sa device at hindi kailanman mababasa sa labas nito, ang di-nakikitang Lolly Imprint at isang opt-in na durable mark na nabubuhay nang mas matagal kaysa sa isang re-save - na ang bawat isa ay tamper-evident at strippable: nagmamarka ang isang credential ng pagbabago sa halip na pumipigil dito, at iyon mismo ang gumagawang posible sa lubos na offline na pagpapatunay. Dumadaan ang cryptography at ang mga file parser sa enterprise-grade na hardening ng SUSE: totoo at maipagtatanggol na ngayon ang mga seal, on-device signing at encryption, kaya kung saan hinihiling ng isang kontrata ang certified assurance, i-deploy ang mga ito bilang defence-in-depth habang natatapos ang prosesong iyon.

- **[Tiwala](/info/trust.html)** - bawat claim na ginagawa ng site na ito, may mekanismong nagpapatupad nito sa tabi nito.
- **[Seguridad at Pagpapatunay](/info/security.html)** - ang mga standard, primitive, trust model at testing, isinulat para sa isang reviewer.
- **[Threat Model at Mga Hangganan ng Tiwala](/info/threat-model.html)** - kung ano ang ipinagtatanggol ng Lolly, kung ano ang tahasang hindi nito ipinagtatanggol at kung saan bumabagsak ang bawat hangganan.
- **[Server Surface](/info/server-surface.html)** - ang kumpletong imbentaryo kung ano ang tumatakbo sa server-side (dalawang opsyonal na component) laban sa kung ano ang tumatakbo sa device.
- **[Imbentaryo ng Parser](/info/parser-inventory.html)** - bawat parser na humahawak sa isang file na binubuksan ng user at kung saan pinatibay ang bawat isa.
- **[I-verify Mo Mismo](/info/verify-yourself.html)** - suriin ang mga claim laban sa isang tunay na export, hakbang-hakbang, walang bagay na hindi mo mismo kayang patakbuhin.
- **[Patakaran sa Privacy](/info/privacy.html)** - ang pormal na pahayag kung ano ang kinokolekta at hindi kinokolekta, iniimbak at ipinapadala.
- **[Soberanong Paggawa ng Creative](/info/sovereign-production.html)** - air-gapped na deployment, consent-gated na networking at on-device signing.
- **[Pag-ampon at Pamamahala](/info/adoption-governance.html)** - sino ang nag-a-approve ng isang tool, paano nagiging enforceable ang mga alituntunin ng brand at ano ang naidudulot sa iyo ng opsyong catalog-as-a-repository.

## Legal

MPL-2.0 na walang contributor licence agreement, sinasabi nang tuwiran, may sinasabi kung ano ang hindi inaangkin nang kasinglinaw ng kung ano ang inaangkin. Ang Content Credentials ay tamper-evident at strippable, kaya sinasabi ng mga pahina sa ibaba kung ano talaga ang inaasserto ng isang signature bago ito isulat ninuman sa isang kontrata.

- **[Pagmamarka ng AI at ang EU AI Act](/info/eu-ai-act.html)** - Article 50, ang Code of Practice na tumuturo sa C2PA at ang tapat na pagkakaangkop ng Lolly.
- **[Paano Ihahambing ang Lolly](/info/positioning.html)** - ang mga katotohanan sa lisensya: MPL-2.0, walang contributor licence agreement at kung saan talaga nakasalalay ang libre magpakailanman.
- **[Pagkakakilanlan ng Content Credentials](/info/content-credentials-identity.html)** - kung ano ang inaassert ng isang naka-sign na credential, kung ano ang hindi at sino ang pinapangalanan ng certificate.
- **[Paglipat ng Data](/info/data-transfer.html)** - ang backup bundle na isinasagot sa isang records request o isang device handover.

## AI

Nagbibigay ng input ang mga agent, hindi kailanman ng persona. Tumutulong ang AI kapag hiniling ito, sinasabi ng ginawa nito na ginawa ito ng AI, at dala ng iyong trabaho ang pangalan mo sa halip na sa isang model.

- **[Ang Aming Paninindigan sa AI](/info/ai-stance.html)** - kung ano ang ginagawa at hindi ginagawa ng Lolly sa generated content, at kung ano ang nagpapatupad sa bawat commitment.
- **[Ginawa Nang Isang Beses, Pareho ang Render](/info/ai-features.html)** - ang mga AI feature na ipinapadala, at kung bakit minamarkahan ang paglikha ng mga pixel samantalang hindi ang pag-aalis sa mga ito.
- **[Input, Hindi Pagpapanggap](/info/input-not-impersonation.html)** - kung bakit nagbibigay ng input ang isang agent at hindi kailanman ng persona, kung paano ito ipinapatupad at kung ano pa rin ang hindi kayang gawin ng isang rogue agent.
- **[Mga AI Agent](/info/ai-agents.html)** - kung ano talaga ang kayang idrive ng isang agent, kung nagtuturo na ang mga team mo ng isa dito.
