# Lolly at mga rendering API

_Huling sinuri: 28 Setyembre 2026._

Gumagawa ang Lolly ng mga asset mula sa mga template at data sa device mo, sa CI o sa pamamagitan ng server API ng [lolly.work](https://lolly.work). Sakop ng pinagsamang solusyon ang automated na rendering pati ang identity, policy at delivery sa paligid ng mga production job ng organisasyon.

## Kung saan sila nagtatagpo

Gumagawa ang [Bannerbear](https://www.bannerbear.com/) at [Placid](https://placid.app/) ng mga imahe at iba pang media mula sa mga template sa pamamagitan ng mga API at integration. Ganito rin ang paraan ng Lolly: template at mga input, na may [URL mode](/info/url-mode.html), ang [CLI](/info/cli.html), batch grid at mga server endpoint bilang mga paraan ng pagsumite ng gawain.

## Ano ang ibinibigay ng lolly.work

Ang lolly.work ang hiwalay na dine-deploy na organisation service sa proyektong Lolly. Pinapatakbo nito ang Lolly engine sa likod ng isang API, naglalapat ng tool visibility at mga input policy, at naghahatid ng mga na-render na file at signed na sharing link. Sinusuportahan ng [recoverable render service](https://github.com/lolly-tools/lolly-work/blob/main/docs/renders.md) nito ang mga indibidwal na job at batch, idempotent na pagsumite, status, bounded na retry, pagkansela at mga nakaimbak na output. Maaaring ipagpatuloy ang naantalang gawain pagkatapos mag-restart ng server kapag naka-configure ang persistent storage.

Gumagamit ang server ng mabilis na SVG/PNG render path at opsyonal na Chromium worker para sa mga tool na nangangailangan ng browser. Nag-a-authenticate ang automation gamit ang mga service token, at maaaring ipadala ang natapos na output sa pamamagitan ng [governed delivery](https://github.com/lolly-tools/lolly-work/blob/main/docs/delivery.md) sa mga destinasyon ng organisasyon. Ang naka-configure na signing identity ang nagpapagana ng C2PA signing sa mga sinusuportahang server output.

## Sino ang nagpapatakbo ng serbisyo

Ang Bannerbear at Placid ay nagpa-package ng rendering bilang mga managed service na may sarili nilang imprastraktura at integration. Sa Lolly, maaaring mag-render nang lokal ang indibidwal o patakbuhin ng isang team ang lolly.work sa sarili nitong imprastraktura. Parehong open source sa ilalim ng MPL-2.0 ang dalawang Lolly repository; walang bayad sa software license kada render ang self-hosting, habang gastos pa ring dapat planuhin ang compute, storage at operasyon.

Evaluation sandbox ang pampublikong site ng lolly.work, hindi pangakong production hosting. Ang pangmatagalang serbisyo ay nangangailangan ng persistent na database at output storage; ang mga tool na umaasa sa browser ay nangangailangan ng Chromium worker. Inilalarawan ng [installation guide](https://github.com/lolly-tools/lolly-work/blob/main/docs/install.md) at ng [status page](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) ang mga kinakailangang iyon at ang kasalukuyang mga limitasyon.

Nananatiling available ang lokal at CI rendering nang walang organisation service. Ipinapadala ng pagsumite ng server job ang mga input at kinakailangang asset nito sa instance na iyon; naiiba ito sa on-device na landas. Tingnan ang [pangkalahatang-ideya ng pinagsamang solusyon](/info/compare.html).

Ang Bannerbear at Placid ay mga trademark ng kanilang mga may-ari. Inilalarawan ng pahinang ito kung saan nagtatagpo ang mga solusyon at hindi ito kaugnay ng alinman sa dalawa.
