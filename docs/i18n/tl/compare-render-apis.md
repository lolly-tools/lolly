# Lolly at mga rendering API

_Huling sinuri: 28 Setyembre 2026._

Kung gumagawa ka ng mga larawan mula sa template sa pamamagitan ng API ngayon, sinasabi ng pahinang ito kung paano ginagawa ng Lolly ang parehong trabaho sa sarili mong device, sa CI o sa sarili mong server.

## Ang mas mahusay na ginagawa ng hosted rendering API

Ang [Bannerbear](https://www.bannerbear.com/) at [Placid](https://placid.app/) ay nagpa-package ng rendering bilang managed service, na may sarili nilang infrastructure, integrasyon at suporta. Nagpapadala ka ng request at ibang tao ang nagpapatakbo ng mga server.

## Kung saan sila nagtatagpo

Parehong ginagawang media ang template kasama ang mga input. Kinukuha ng Lolly ang mga input mula sa [link](/info/url-mode.html), ang [CLI](/info/cli.html), batch grid o server endpoint.

## Paano ginagawa ng Lolly ang magkapatong na trabaho

Ang parehong tool ay nagre-render sa laptop, sa CI job o sa server, mula sa parehong mga input. Ang lokal at CI na rendering ay hindi nangangailangan ng serbisyo.

![Mga setting ng batch export: file name, default na format, mga unit, DPI at bilang ng mga row na ire-render](/info/shots/use-batch-toolbar.svg)

Sa server, pinapatakbo ng [Lolly Work](/info/compare.html#what-runs-where) ang Lolly engine sa likod ng API at naglalapat ng tool visibility at input policy. Sinusuportahan ng [recoverable render service](/info/work-renders.html) nito ang mga single job at batch, idempotent na pagsusumite, status, may hangganang retry, pagkansela at itinagong output, at ang naantalang gawa ay nagpapatuloy pagkatapos ng restart kapag naka-configure ang persistent storage.

Ang server ay may mabilis na SVG at PNG path at opsyonal na Chromium worker para sa mga tool na nangangailangan ng browser. Ang automation ay nagsa-sign in gamit ang service token, ang tapos na output ay maaaring dumaan sa [aprubadong delivery](/info/work-delivery.html) papunta sa mga destinasyon ng organisasyon, at ang naka-configure na signing identity ay nagdaragdag ng Content Credentials sa sinusuportahang output.

## Sino ang nagpapatakbo ng serbisyo

Sa Lolly, ang indibidwal ay nagre-render nang lokal, o ang team ay nagpapatakbo ng Lolly Work sa sarili nitong infrastructure. Ang pagsusumite ng server job ay nagpapadala ng mga input at kinakailangang asset nito sa instance na iyon, na iba sa on-device na path. Ang matibay na serbisyo ay nangangailangan ng persistent database at output storage, at ang mga tool na umaasa sa browser ay nangangailangan ng Chromium worker; inilalarawan ng [Install Lolly Work](/info/work-install.html) ang pareho.

Ang Bannerbear at Placid ay mga trademark ng mga may-ari nila. Inilalarawan ng pahinang ito kung saan nagkakapatong ang mga produkto at hindi ito kaugnay ng alinman.
