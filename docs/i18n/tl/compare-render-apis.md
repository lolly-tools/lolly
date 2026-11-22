# Lolly at mga rendering API

_Huling sinuri: 5 Nobyembre 2026._

Kung bumubuo ka ng mga larawan mula sa mga template sa pamamagitan ng API, sinasabi ng pahinang ito kung ano ang nagbabago kapag pinapatakbo mo ang paggawa sa sarili mong device, sa CI o sa server na kontrolado mo. Ibinibigay ng [Lumipat mula sa hosted na render API](/info/work-move-from-render-api.html) ang mga hakbang.

<!--i:eti-award-->
## Ang mas mahusay na ginagawa ng mga hosted na rendering API

Mga pinamamahalaang serbisyo ang [Bannerbear](https://www.bannerbear.com/) at [Placid](https://placid.app/): nagpapadala ka ng request at ibang tao ang nagpapatakbo ng mga server.

- **Walang kailangang patakbuhin.** Walang server, database, storage, update o pagpaplano ng kapasidad.
- **Isang hosted na template editor** na may mga template na handang baguhin.
- **Mas maraming uri ng output mula sa iisang API.** Parehong naglalathala ng mga video at PDF endpoint, at may dokumentasyon din ang Bannerbear para sa animated na output, WebP at AVIF, mga screenshot at pag-aalis ng background gamit ang AI.
- **Sarili nilang mga integration at suporta.**

Kung iyon ang kaayusang gusto mo, mabuting piliin ang mga serbisyong iyon.

<!--i:eti-home-->
## Ang ibinibigay sa iyo ng self-hosting

- **Nananatili ang nilalaman mo sa mga system mo.** Nasa imprastrakturang pinili mo ang mga input, asset at output. Hindi kailangan ng serbisyo ang pag-render sa device o sa CI.
- **Nasa tool ang mga patakaran.** Mula sa [design system](/info/brand-studio.html) mo ang mga kulay, type, logo at nakakandadong input, kaya ang pinapayagan mo lang ang kayang baguhin ng tumatawag. Inilalapat ng [Lolly Work](/info/compare.html#what-runs-where) ang visibility ng tool at mga input policy sa bawat request.
- **Ang parehong tool saanman.** Nagre-render ang tool mula sa parehong mga input sa laptop, sa CI job o sa server. Puwedeng i-edit ng mga tao ang parehong tool sa app.
- **Mga record na hawak mo.** [Mga render receipt](/info/work-renders.html#evidence-and-identity), audit trail at Content Credentials kung saan ka nag-configure ng pagkakakilanlan sa pagpirma.
- **Open source at walang singil ayon sa paggamit.** Ikaw ang nagpapatakbo ng code at sarili mong imprastraktura lang ang binabayaran mo.

Inaako mo ang gawaing ginagawa ng mga serbisyong iyon para sa iyo. Kailangan ng pangmatagalang server ang persistent na database at storage ng output. Kailangan ng mga tool na nangangailangan ng browser ang Chromium worker. Inilalarawan ng [I-install ang Lolly Work](/info/work-install.html) ang dalawa.

<!--i:eti-table-->
## Paano nagtutugma ang mga gawain

| Gawain | Hosted na rendering API | Lolly |
|---|---|---|
| Punan ang template mula sa data | API request na nagpapangalan sa template at mga layer nito | [URL](/info/url-mode.html), [CLI](/info/cli.html) o [server API](/info/work-automation-api.html) na nagpapangalan sa tool at mga input nito |
| Maraming file mula sa talahanayan | Mga batch at collection | [Batch](/info/batch.html) sa device mo, o [mga render batch](/info/work-renders.html#batches-with-durable-rows) sa server |
| Maghintay o mag-poll para sa resulta | Polling, o synchronous na opsyon | Mga persistent na render na pino-poll mo, o agarang render |
| Tumawag ng webhook kapag tapos na | Oo | [Mga signed callback](/info/work-renders.html) sa mga origin na pinapayagan mo |
| Dynamic na URL ng larawan | Oo | [Mga share link at `/render` URL](/info/url-mode.html) |
| Mag-edit ng template | Hosted na editor | [Design](/info/using.html), sa device mo |
| Mga agent | Parehong naglalathala ng MCP server | [MCP](/info/mcp.html), na may endpoint ng organisasyon sa ilalim ng policy ng token sa Lolly Work |

Nakalista ang sariling mga uri ng output ng Lolly sa [Pag-export](/info/exporting.html). Sa Work server ngayon, gumagawa ng SVG, PNG, JPG at PDF ang mga persistent na render, at [nananatili ang video sa device, CLI at MCP](/info/work-renders.html#production-still-checks-and-permitted-repairs).

<!--i:eti-folder-move-->
## Ang naililipat at ang hindi

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Mga request mo | Tumatanggap ng parehong istruktura ang migration API ng Work | Pareho | Pareho |
| Mga template mo | **Import** bilang mga mae-edit na dokumento, maliban sa mga uri ng layer na walang kumpirmadong schema | Mga pangalan ng field at preview lang. Buuin muli ang bawat isa | Mga pangalan ng field at preview lang. Buuin muli ang bawat isa |
| Mga kasalukuyang dynamic na URL | Hindi sinusuportahan | Hindi sinusuportahan | Patuloy na gumagana ang mga signed URL matapos palitan ang host, gamit ang dati mong pribadong token |
| Mga webhook | Hindi sinusuportahan ang mga nakarehistrong webhook | Gumagana ang `webhook_url` | Gumagana ang `webhook_success` |
| WebP at AVIF output | Tinatanggihan ayon sa pangalan | Hindi iniaalok | Tinatanggihan ang WebP ayon sa pangalan |
| Mga animation, video, collection, screenshot | Wala sa migration API | Wala sa migration API | Wala sa migration API |

::: note Binuo mula sa pampublikong dokumentasyon
Binuo ito mula sa pampublikong dokumentasyon ng bawat vendor at hindi pa pinatakbo gamit ang live na account. Kung may account ka, may maikling checklist sa [gabay sa paglipat](/info/work-move-from-render-api.html#check-it-on-your-own-account).
:::

Puwede mong ilipat ang isang template at panatilihin ang iba kung nasaan sila. Kasing-bukas din ang [Pag-alis sa Lolly](/info/work-move-from-render-api.html#leave-lolly-too): mga karaniwang file ang mga tool at nire-render sila ng CLI nang walang server.

<!--i:eti-building-->
## Sino ang nagpapatakbo ng serbisyo

Sa Lolly, lokal na nagre-render ang isang tao, o nagpapatakbo ang isang team ng Lolly Work sa sarili nitong imprastraktura. Ipinapadala ng isang server job ang mga input at kinakailangang asset nito sa instance na iyon. Hindi ito ginagawa ng prosesong nasa device.

Mga trademark ng kani-kanilang may-ari ang Bannerbear at Placid. Inilalarawan ng pahinang ito kung saan magkapareho ang mga produkto, batay sa pampublikong dokumentasyon nila, at hindi ito kaanib ng alinman sa dalawa.
