# Lolly at Penpot

_Huling sinuri: 28 Setyembre 2026._

Parehong nag-aalok ang Lolly at Penpot ng mga open-source na design tool, shared na design token at live collaboration. Pinagsasama ng Lolly ang paglikha sa mismong device at ang [lolly.work](https://lolly.work), ang hiwalay nitong dine-deploy na organisation service.

## Magkasamang pundasyon ng disenyo

Gumagamit ang [design token ng Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) ng DTCG format, na binabasa rin ng Lolly. Maaaring ibahagi sa pagitan ng dalawang workflow ang mga kulay, type at iba pang value ng token. Binubuksan ng [Import a design](/info/design-import.html) ng Lolly ang `.penpot` export bilang nae-edit na layout.

Minementena ng Lolly ang Lolly Export plugin para sa Penpot. Ginagamit nito ang engine ng Lolly para sa opt-in na C2PA Content Credentials sa device. Magkahiwalay ang integridad ng lagda at ang tiwala sa lumagda: kailangan ng verifier ng identity na pinagkakatiwalaan nito, gaya ng inilalarawan sa [Content Credentials Identity](/info/content-credentials-identity.html).

## Mga workflow ng disenyo at team

Nagbibigay ang [Penpot](https://penpot.app/) ng interface design, mga component, flexible na layout, interactive prototype at developer inspection. Nag-aalok ito ng hosted at self-hosted na deployment, na may [mga opsyon sa pag-install para sa Docker at Kubernetes](https://help.penpot.app/technical-guide/getting-started/).

Gumagawa ang Design canvas ng Lolly ng mga nae-edit na asset at kayang gawing [tool na may mga patakaran](/info/create-a-tool.html) ang isang layout. Nagre-render ang parehong tool sa browser, desktop app o CLI at makakabuo ng mga variant mula sa data. Para sa teamwork, may direktang two-device na [private collab](/info/collaborate.html) ang Lolly at work collab sa pamamagitan ng lolly.work, na may shared edit, cursor at mga naka-save na team session.

## Paano nagkakaiba ang mga deployment

Nagre-render at pumipirma ang standalone na Lolly sa device nang walang account o server. Nagdaragdag ang lolly.work ng SSO, SCIM provisioning, shared na catalogue at proyekto, mga role, mga approval, mga audit record at server rendering. Parehong open source sa ilalim ng MPL-2.0 ang dalawang repository at maaaring patakbuhin ng organisasyon. Gumagamit ng naka-configure na instance ang shared na gawain; nananatiling available nang hiwalay ang lokal na paglikha.

Nakadepende ang pagpili sa gawain: ang workflow ng Penpot sa interface design at prototyping, ang paulit-ulit na asset production ng Lolly, o kombinasyong gumagamit ng shared token at mga na-import na disenyo. Kasalukuyang tumatakbo sa iisang server node ang work collaboration ng Lolly, at dapat bahagi ng pagsusuri ng organisasyon ang [deployment status](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) nito.

Ang Penpot ay trademark ng may-ari nito. Sa Lolly ang plugin sa itaas. Tingnan ang [Paano nakikipagkumpitensya ang Lolly](/info/positioning.html) at ang [pangkalahatang-ideya ng pinagsamang solusyon](/info/compare.html) para sa mas malawak na paghahambing.
