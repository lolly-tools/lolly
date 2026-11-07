# Lolly at mga rendering API

_Huling sinuri: 5 Nobyembre 2026._

Kung gumagawa ka ng mga larawan mula sa template sa pamamagitan ng API ngayon, sinasabi ng pahinang ito kung ano ang magbabago kapag ikaw mismo ang nagpapatakbo ng production na iyon: sa sarili mong device, sa CI o sa server na kontrolado mo. Ang [Lumipat mula sa hosted render API](/info/work-move-from-render-api.html) ang paraan.

## Ang mas mahusay na ginagawa ng hosted rendering API

Ang [Bannerbear](https://www.bannerbear.com/) at [Placid](https://placid.app/) ay mga managed service, at tunay na bentahe iyon. Nagpapadala ka ng request at ibang tao ang nagpapatakbo ng mga server, nagpapanatili ng mga ito at humahawak ng load.

- **Walang ooperahin.** Walang server, database, storage, update o capacity planning.
- **Hosted na template editor** na may mga template na handang iangkop.
- **Mas maraming uri ng output mula sa isang API.** Parehong naglalathala ng video at PDF endpoint, at dinodokumento rin ng Bannerbear ang animated output, WebP at AVIF, screenshot at AI background removal.
- **Sarili nilang integrasyon at suporta.**

Kung iyon ang kaayusang gusto mo, matinong pagpipilian ang mga serbisyong iyon.

## Ang ibinibigay ng self-hosting

- **Nananatili sa mga system mo ang content mo.** Ang mga input, asset at output ay nasa infrastructure na pinili mo. Ang pag-render sa device o sa CI ay hindi nangangailangan ng anumang serbisyo.
- **Nasa tool ang mga patakaran.** Ang mga kulay, type, logo at naka-lock na input ay galing sa [design system](/info/brand-studio.html) mo, kaya ang tumatawag ay makapagbabago lang ng pinapayagan mo. Naglalapat ang [Lolly Work](/info/compare.html#what-runs-where) ng tool visibility at input policy sa bawat request.
- **Parehong tool saanman.** Ang tool ay nagre-render sa laptop, sa CI job o sa server mula sa parehong mga input, at maaaring i-edit ng mga tao ang parehong tool sa app.
- **Mga record na hawak mo.** Ang [mga render receipt](/info/work-renders.html#evidence-and-identity), audit trail, at Content Credentials kung saan ka nag-configure ng signing identity.
- **Open source at walang metro.** Ikaw ang nagpapatakbo ng code, at ang binabayaran mo ay ang sarili mong infrastructure.

Ikaw ang kukuha sa trabahong ginagawa ng mga serbisyong iyon para sa iyo. Ang matibay na server ay nangangailangan ng persistent database at output storage, at ang mga tool na nangangailangan ng browser ay nangangailangan ng Chromium worker. Inilalarawan ng [Install Lolly Work](/info/work-install.html) ang pareho.

## Paano nagtutugma ang mga trabaho

| Trabaho | Hosted rendering API | Lolly |
|---|---|---|
| Punan ang template mula sa data | API request na nagpapangalan ng template at mga layer nito | [URL](/info/url-mode.html), [CLI](/info/cli.html) o [server API](/info/work-automation-api.html) na nagpapangalan ng tool at mga input nito |
| Maraming file mula sa table | Mga batch at collection | [Batch](/info/batch.html) sa device mo, o [mga render batch](/info/work-renders.html#batches-with-durable-rows) sa server |
| Maghintay o mag-poll ng resulta | Polling, o synchronous na opsyon | Mga durable na render na pino-poll mo, o agarang render |
| Tumawag ng webhook kapag tapos na | Oo | [Mga signed callback](/info/work-renders.html) sa mga origin na pinapayagan mo |
| Dynamic na image URL | Oo | [Mga share link at `/render` URL](/info/url-mode.html) |
| Mag-edit ng template | Hosted editor | [Design](/info/using.html), sa device mo |
| Mga agent | Parehong may inilalathalang MCP server | [MCP](/info/mcp.html), na may organisation endpoint sa ilalim ng policy ng token sa Lolly Work |

Nakalista sa [Exporting](/info/exporting.html) ang sariling mga uri ng output ng Lolly. Sa Work server ngayon, gumagawa ng SVG, PNG, JPG at PDF ang mga durable render, at [nananatili sa device, CLI at MCP ang video](/info/work-renders.html#production-still-checks-and-permitted-repairs).

## Ano ang dala, at ano ang hindi

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Ang mga request mo | Pareho ang hugis na tinatanggap ng migration API ng Work | Pareho | Pareho |
| Ang mga template mo | **Ini-import** bilang mae-edit na dokumento, maliban sa mga uri ng layer na walang kumpirmadong schema | Mga pangalan ng field at preview lang. Buuin muli ang bawat isa | Mga pangalan ng field at preview lang. Buuin muli ang bawat isa |
| Umiiral na dynamic URL | Hindi sinusuportahan | Hindi sinusuportahan | Patuloy na gumagana ang mga signed URL pagkatapos lumipat ng host, gamit ang luma mong private token |
| Mga webhook | Hindi sinusuportahan ang mga rehistradong webhook | Gumagana ang `webhook_url` | Gumagana ang `webhook_success` |
| WebP at AVIF na output | Tinatanggihan ayon sa pangalan | Hindi iniaalok | Tinatanggihan ayon sa pangalan ang WebP |
| Mga animation, video, collection, screenshot | Wala sa migration API | Wala sa migration API | Wala sa migration API |

Binuo ang lahat ng ito mula sa pampublikong dokumentasyon ng bawat vendor at hindi pa napapatakbo laban sa live na account. May maikling checklist ang [gabay sa paglipat](/info/work-move-from-render-api.html#check-it-on-your-own-account) kung may hawak kang account.

Hindi lahat-o-wala ang paglipat. Maaari kang maglipat ng isang template at iwan ang iba kung nasaan sila, at kasing-bukas din ang [pag-alis sa Lolly](/info/work-move-from-render-api.html#leave-lolly-too): ang mga tool ay payak na file at nire-render ng CLI ang mga ito nang walang server.

## Sino ang nagpapatakbo ng serbisyo

Sa Lolly, ang indibidwal ay nagre-render nang lokal, o ang team ay nagpapatakbo ng Lolly Work sa sarili nitong infrastructure. Ang pagsusumite ng server job ay nagpapadala ng mga input at kinakailangang asset nito sa instance na iyon, na iba sa on-device na path.

Ang Bannerbear at Placid ay mga trademark ng mga may-ari nila. Inilalarawan ng pahinang ito kung saan nagkakapatong ang mga produkto, mula sa pampublikong dokumentasyon ng mga ito, at hindi ito kaugnay ng alinman.
